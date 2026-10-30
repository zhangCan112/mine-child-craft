'use strict';
/* 体验馆模式 (js/modes/showroom.js) 守门测试 — node --test (零依赖)
   运行: node --test test/showroom-mode.test.js
   U4 统一切换后的守门线(docs/adventure-shell-unification-design.md §4/§6,
   adventure-mode.test 契约先例, 只测外显行为不伸手进实现):
   ① 契约面: 门面与冒险壳装进同一 vm 词法环境可加载(门面要写壳的顶层 let
     缝——经典 script 共享词法环境的装载现实还原) + 注册行形状 + main.js
     MODES/index.html 接线正则;
   ② 数据隔离键扫(不动, 红线): 模式与供给核心两文件源文本零存储 API 名/
     零存档键字面量(含注释, ADR 0002);
   ③ 套餐供给: stock 挂点(派生产物)行形状/≤27/全 id ∈ ITEMS · 进场后
     RECIPES 每条配方 canCraft 全绿(dev bag 重铸);
   ④ 快捷栏: 壳的 9 槽镜像 dev 背包前 9 槽, 数字键/滚轮/点选全自动;
   ⑤ 统一进场: 壳 init 读篡改世界档 = home 基座 + 展馆账本重放(结构在场,
     家营地平)/房内出生/昼夜接线/巢穴怪与牧场动物随壳进馆(拍板③);
   ⑥ 三站点(统一口径): 熔炉走近点击开面板/圈外拒 · 合成面板 Tab 入口 +
     station 行为断言(远离工作台台级配方随处可摆, 源码正则已废) · 箱子
     全局单账户顶格预填(多箱方块打开同一账户, §4 行为变化);
   ⑦ 熔炉行为线: 自动放料/2.5s 件推进/关面板照烧(壳的 kit 实例);
   ⑧ 收场与重进: dev store 丢弃一切(退炉不退料·炉态随会话丢弃/背包同实例
     原地重铸/账户照派生重铸/世界逐格恢复原装);
   ⑨ 放置链(place-kit 同一实现): 单格放置/门成对/蓄力挖+掉落+真空拾取;
   ⑩ TNT 链: 短按点燃/引信/爆炸清空+70% 掉落/链式接力/按住转蓄力/掀炉
     兜底 + 波及怪物段随统一进馆(§4 行为变化) + 重进世界无痕;
   ⑪ 拾取入包: 收集回调入包并堆/满包拒返 false;
   ⑫ 玩家 HP 实体+进食+雪球(壳的链): 吃判据/金苹果 full/零伤害弹道;
   ⑬ 昼夜+夜怪+床(统一壳 + dev 政策): 入夜上沿固定点位铺怪(边沿制/
     __nightMob 标记)/黎明清场共用壳实现/睡觉三分支/唤醒两连(床边无
     出生点, D5 拍板①)/完整 AI 索敌逼近掉血/原地满血复活/击杀掉落/
     击杀不推任务步(任务档终章态);
   ⑭ U4 门面与换装生命周期: HUD 徽标包层/onMenu dev 特化/媒体降噪
     (TTS·sfx 静默·toast 保留)/onKey 单跳/换装生命周期(dev 会话真档
     mem 桩零写入 → cleanup 还原缺省 → 冒险壳照常读真档);
   ⑮ U3 展馆 edits 账本派生(世界即存档, 原样保留): 仿真 diff 确定性 ·
     重放同构 · 结构全覆盖/立面净空/地平实心 · 选址核查 · 世界档 payload ·
     dev store 丢弃语义。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 假 DOM(mode-kit 惰性渲染用, adventure-mode.test 同款) ---------- */
function fakeEl() {
  const el = {
    children: [], _cls: new Set(), style: {}, dataset: {}, textContent: '',
    addEventListener() {},
    appendChild(c) {
      c.parentNode = this;
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      c.parentNode = null;
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    querySelector(sel) {
      if (!this['q_' + sel]) this['q_' + sel] = fakeEl();
      return this['q_' + sel];
    },
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => html,
    set: (v) => {
      html = String(v);
      el.children.length = 0; /* innerHTML 重写即清子节点(真 DOM 语义, 重渲染计数不失真) */
    },
  });
  Object.defineProperty(el, 'className', {
    get: () => [...el._cls].join(' '),
    set: (v) => {
      el._cls.clear();
      String(v).split(/\s+/).filter(Boolean).forEach((c) => el._cls.add(c));
    },
  });
  Object.defineProperty(el, 'classList', {value: {
    add: (c)=>el._cls.add(c), remove: (c)=>el._cls.delete(c),
    toggle: (c, v)=>{
      const on = (v === undefined) ? !el._cls.has(c) : v;
      if (on) el._cls.add(c); else el._cls.delete(c);
    },
    contains: (c)=>el._cls.has(c),
  }});
  return el;
}

const fakeClock = 0;
globalThis.performance = {now: () => fakeClock};
const elCache = {};
const docBody = fakeEl();
globalThis.document = {
  createElement: () => fakeEl(),
  getElementById: (id) => (elCache[id] = elCache[id] || fakeEl()),
  body: docBody, /* mkBubbleBar 等面板件的挂载点(adventure-mode.test 同款) */
};

/* ---------- 行为记账账本(断言面, 各桩共享) ---------- */
const calls = [];
const spoken = [];
const dropCalls = []; /* 掉落物调用记账(收场应为零——余量静默丢弃口径) */
const dropsTicks = []; /* 掉落物 update 记账(update 应每帧喂真空拾取) */
const collectCbs = []; /* 收集回调记账(init 重挂, 切模式 Drops.clear 解除) */

/* ---------- 真引擎件: 体素底座+纯核心(vm) ----------
   U4 起本文件把 js/modes/adventure.js 与 js/modes/showroom.js 也装进同一个
   vm 词法环境(引擎件同款手法): 门面要写壳的顶层 let 缝(advStore/advProfile),
   CommonJS 逐文件 require 的模块作用域看不见彼此的顶层声明——共享 context
   才是经典 <script> 装载现实的忠实复刻。引擎件的真状态与本文件的断言面
   共用同一 world 对象。 */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}},
  groundTop: () => 24, /* world.js 顶层函数的桩(adventure-mode.test 同款) */
});
for (const f of ['js/config.js', 'js/voxel.js', 'js/cascade-core.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/item-use-registry.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/mob-registry.js',
  'js/daylight-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({ITEMS, stackMax, mkStack, isTool, toolOf, durOf, itemUses,
  mkInventory, add, count, remove,
  take, moveSlot, damageTool, serialize, deserialize, costEntry, shapeCost, canCraft, matchGrid, gridCraft, fillGrid,
  RECIPES, SMELTS, FUEL, fuelUnits, smeltOf, breakTime,
  HOTBAR_SLOTS, INV_SLOTS, WORLD_W, WORLD_D, WORLD_H, PLAYER, IS_TOUCH, FLUID, DAYLIGHT,
  BLOCKS, B_FURNACE, B_CRAFT, B_CHEST, B_BED, B_TORCH, B_DOOR, B_DOOR_TOP, B_DOOR_OPEN,
  B_DOOR_TOP_OPEN, B_GLASS_PANE, B_TNT,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY,
  B_SANDSTONE, B_SNOW, B_ICE, B_PORTAL, B_PORTAL_DIM, B_OBSIDIAN, B_NETHERRACK,
  B_GLOWSTONE, B_NETHER_BRICK,
  getBlock, setBlockRaw, getFluidLv, setFluidLv, world, worldCells, worldEvents,
  blockKey, collidesAtPlayer, rollBlockDrop, rollDrops,
  Daylight, SceneKit, Drops})`, eng);
Object.assign(globalThis, api); /* 模式/供给核心/放置链经全局名消费这些真件 */
/* 玩家状态绑定(pos/vel 是 voxel.js 的顶层词法绑定): 壳在 eng 里读到的是 eng 词法
    对象——Node 侧(CombatKit/测试断言)必须与之同一引用, 否则距离判定/血量断言
    全部各说各话(替换而非另建桩) */
globalThis.pos = vm.runInContext('pos', eng);
globalThis.vel = vm.runInContext('vel', eng);
/* 掉落物库(drops.js 顶层 const, eng 词法): 壳经 eng 词法取到真件——在真件对象上
    包记账壳(调用透传), spawn/update/onCollect/clear 的行为断言面与真实拾取链共存
    (adventure-mode.test 的代理记账口径, 差别只在记账挂在真件本身) */
const RealDrops = vm.runInContext('Drops', eng);
const realDropSpawn = RealDrops.spawn;
const realDropUpdate = RealDrops.update;
const realDropOnCollect = RealDrops.onCollect;
const realDropClear = RealDrops.clear;
RealDrops.spawn = (id, n, x, y, z) => {
  dropCalls.push([id, n, x, y, z]);
  return realDropSpawn(id, n, x, y, z);
};
RealDrops.update = (dt, p) => {
  dropsTicks.push([dt, p]);
  return realDropUpdate(dt, p);
};
RealDrops.onCollect = (cb) => {
  collectCbs.push(cb);
  return realDropOnCollect(cb);
};
RealDrops.clear = () => {
  realDropClear();
  collectCbs.length = 0; /* 镜像 v2 桩: clear 解除收集回调(init 重挂前提) */
};
globalThis.Drops = RealDrops;
/* 单块编辑 seam: world.js 太重——真级联核心镜像 world.js 的装配
    (adventure-mode.test 同款): setBlockRaw + 破坏侧 cascadeRemove */
const engCascade = vm.runInContext('({core: CascadeCore, policy: CascadeCore.mkPolicy(BLOCKS)})', eng);
globalThis.editBlock = (x, y, z, id) => {
  const old = api.getBlock(x, y, z);
  api.setBlockRaw(x, y, z, id);
  return (id === 0 && old !== 0) ?
    engCascade.core.cascadeRemove(api.getBlock, api.setBlockRaw, x, y, z, old, engCascade.policy) : [];
};
/* 世界卫生清扫 seam(P14/D9, adventure-mode.test 同款快照桥接): init 的
    loadScene 回调会跑 applySweep——同一份 cascade-core 在 Node 侧对快照
    扫描, 差异格回写真 setBlockRaw(含 topCache 失效; 干净世界零回写) */
const Core = require('../js/cascade-core.js');
const localBlocks = {};
for (const k of Object.keys(api.BLOCKS)) {
  const b = api.BLOCKS[k];
  const nb = {};
  if (b.fell) nb.fell = true;
  if (b.thin != null) nb.thin = b.thin;
  if (b.fall) nb.fall = true;
  if (b.solid === false) nb.solid = false;
  if (b.need) nb.need = {id: b.need.id, dist: b.need.dist};
  localBlocks[+k] = nb;
}
const localPolicy = Core.mkPolicy(localBlocks);
globalThis.applySweep = () => {
  const W = api.WORLD_W; const H = api.WORLD_H; const D = api.WORLD_D;
  const snap = new Uint8Array(api.worldCells);
  const read = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) ?
    0 : snap[(y * D + z) * W + x];
  const write = (x, y, z, id) => {
    snap[(y * D + z) * W + x] = id;
  };
  const removed = Core.cascadeSweep(read, write, localPolicy, W, H, D);
  const orig = api.worldCells;
  for (let i = 0; i < snap.length; i++) {
    if (snap[i] === orig[i]) continue;
    const x = i % W;
    const t = (i - x) / W;
    const z = t % D;
    const y = (t - z) / D;
    api.setBlockRaw(x, y, z, snap[i]);
  }
  return removed;
};

/* ---------- 假应用层(调用期解析的全局名, adventure-mode.test 同款) ---------- */
globalThis.loadScene = (fn) => {
  calls.push(['loadScene']);
  api.world.clear(); /* 真件口径: 装填前清场(adventure-mode.test 同款) */
  fn();
}; /* 场景装填 seam: 清场+建场(收尾重建归渲染层, 行为断言不需要) */
globalThis.showToast = (s) => calls.push(['toast', s]);
globalThis.sfx = (n) => calls.push(['sfx', n]);
globalThis.SpeechKit = {speak(s) {
  spoken.push(s);
}, cancel() {}};
globalThis.AudioMixer = {setMood(m) {
  calls.push(['mood', m]);
}};
/* 真档存储介质(adventure-mode.test 同款 mem 桩): dev 会话零写入的红线断言面 */
const mem = new Map();
globalThis.SyncDB = {
  ready: Promise.resolve(),
  slot(key, schema) {
    return require('../js/save-slot.js').mkSaveSlot({
      get: (k)=> (mem.has(k) ? mem.get(k) : null),
      set: (k, v)=> {
        mem.set(k, v);
      },
      remove: (k)=> {
        mem.delete(k);
      },
    }, key, schema);
  },
};
globalThis.switchMode = (id) => calls.push(['switchMode', id]);
globalThis.showPage = (id) => calls.push(['showPage', id]);
globalThis.uiPause = () => calls.push(['uiPause']);
globalThis.overlay = fakeEl();
globalThis.fps = 60;
globalThis.setFly = (v)=> {
  globalThis.flyMode = v;
  globalThis.vel.y = 0;
}; /* 意图入口桩(eng 侧壳读到 voxel 词法的真 setFly, 此桩供 Node 侧消费方) */
globalThis.touchPlaying = false;
globalThis.iconOf = (id) => (globalThis.ITEMS[id] && globalThis.ITEMS[id].icon) || '';
globalThis.btnImg = () => '';
globalThis.setTouchActions = () => {};
globalThis.dayTime = 0;
globalThis.dayCycleOn = false;
globalThis.applyDaylight = () => calls.push(['applyDaylight']);
globalThis.setPlayerGlow = (on) => calls.push(['glow', on]);
globalThis.setFluidEditSink = () => {}; /* 流体账本缝(world.js 太重): 空桩 */
globalThis.playerAirS = 15; /* 溺气余秒: 恒满气(气泡条藏, adventure 同款) */
globalThis.camera = {}; /* 相机件: shootFromAim 的取景入参(raycastVoxel 缺席, aimHit 守卫返 null) */
globalThis.Avatar = {swing() {}, flash() {}, setItem() {}}; /* 挥臂/闪红观感桩 */
globalThis.Fx = {debrisBurst() {}, kick() {}, boom() {}, arc() {}, pop() {}}; /* 观感桩 */

/* ---------- 怪物库桩(窄面桩法, 行为断言全走调用记录; 玩家实体受击走真实
    受击状态机 mob-core——血量断言有据) ---------- */
const RealMobCore = require('../js/mob-core.js');
const mobsRig = {list: [], hits: [], spawned: [], deathCbs: []};
const SR_MOB_CFG = {name: '僵尸', hp: 30, dmg: 5, speed: 2.3, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55};
globalThis.Mobs = {
  spawn(type, x, z, opts) {/* 记账+落清单(铺怪点位/标记断言有据) */
    const m = {type, pos: {x, y: 25, z}, dead: false, gone: false,
      yaw: (opts && opts.yaw) || 0, attackCd: 0, attackT: 0, target: null,
      cfg: Object.assign({}, SR_MOB_CFG, {name: type})};
    mobsRig.spawned.push(m);
    mobsRig.list.push(m);
    return m;
  },
  list: () => mobsRig.list,
  update() {}, render() {},
  hit(m, dmg, kdx, kdz, kpow) {
    mobsRig.hits.push({m, dmg, kdx, kdz, kpow});
    if (m.pos === globalThis.pos) return RealMobCore.hitState(m, dmg); /* 玩家实体走真实受击状态机 */
    return {freshDead: false};
  },
  onDeath(cb) {
    mobsRig.deathCbs.push(cb);
  },
  remove(m) {
    m.gone = true; /* 镜像真库: 置 gone 交回收(清场断言消费) */
  },
  clear() {
    mobsRig.list.length = 0;
    mobsRig.spawned.length = 0;
    mobsRig.deathCbs.length = 0;
  },
  steer(m, y) {
    m.yaw = y;
  },
  move(m, dx, dz) {
    m.pos.x += dx;
    m.pos.z += dz;
  },
  gait() {},
  debrisColor: () => 0xffffff,
};

/* ---------- 纯核心与 kit(Node 侧 require, 全局名铺到两侧) ---------- */
/* adventure-core/place-kit 的自由标识符引用 config 的 B_ 前缀常数(const 词法绑定
    不挂 vm 全局对象): 按源码动态收集名单铺到 Node 全局(v2 同款手法) */
for (const src of [fs.readFileSync(path.join(ROOT, 'js', 'adventure-core.js'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'js', 'adventure-maps-core.js'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'js', 'adventure-dims-core.js'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'js', 'place-kit.js'), 'utf8')]) {
  for (const n of [...new Set(src.match(/\bB_[A-Z0-9_]+\b/g) || [])]) {
    if (globalThis[n] === undefined) globalThis[n] = vm.runInContext(n, eng);
  }
}
const SpawnCore = require('../js/adventure-spawn-core.js'); /* 刷怪三件(候选 2): 薄壳/壳层经全局名消费, 加载序先于 adventure-core */
Object.assign(globalThis, SpawnCore); Object.assign(eng, SpawnCore);
const AdventureCore = require('../js/adventure-core.js');
Object.assign(globalThis, AdventureCore); /* advChestPut/advSwingDmg/ADV_GROUND/advBuildWorld 等 */
Object.assign(globalThis, require('../js/adventure-maps-core.js')); /* ADV_MAPS/ADV_UNLOCK_KEYS 等 */
Object.assign(globalThis, require('../js/adventure-dims-core.js')); /* ADV_DIMS/advLootChestPlan 等——
    place-kit 宝箱配对计划经全局名消费(index.html 全量加载同构, TNT 链要它) */
const CraftCore = require('../js/craft-core.js');
Object.assign(globalThis, {SMELT_T: CraftCore.SMELT_T, smeltStep: CraftCore.smeltStep,
  furnaceRefund: CraftCore.furnaceRefund});
const ModeKit = require('../js/mode-kit.js');
globalThis.mkMode = ModeKit.mkMode;
globalThis.mkMainAct = ModeKit.mkMainAct; /* 智能主动作分派(adventure touch 顶层即消费) */
globalThis.mkBubbleBar = ModeKit.mkBubbleBar; /* 溺气泡条: 真件, 假 DOM 惰性渲染 */
globalThis.ModeKit = ModeKit;
ModeKit.spawn = (x, y, z, o) => {
  calls.push(['spawn', x, y, z, o]);
  /* 镜像真 kitSpawn 写 pos/yaw(adventure-mode.test 同款): 位置断言有据 */
  globalThis.pos.x = x; globalThis.pos.y = y; globalThis.pos.z = z;
  globalThis.yaw = (o && o.yaw) || 0;
};
globalThis.FurnaceKit = require('../js/furnace-kit.js');
globalThis.PlaceKit = require('../js/place-kit.js'); /* 放置链 kit(壳顶层即构造 editor) */
globalThis.CombatKit = require('../js/combat-kit.js');
globalThis.CombatCore = require('../js/combat-core.js'); /* stepShot/leadAim(combat-kit 自由标识符消费) */
globalThis.Backpack = require('../js/backpack.js'); /* 背包壳(ADR 0002 唯一持有 inventory 存档键) */
const WorldJournalMod = require('../js/world-journal-core.js');
globalThis.mkWorldJournal = WorldJournalMod.mkWorldJournal;
globalThis.fluidCell = WorldJournalMod.fluidCell;

/* 供给核心先于模式装载(其派生函数经全局名供给门面) */
const ShowroomCore = require('../js/showroom-core.js');
globalThis.SHOWROOM = ShowroomCore.SHOWROOM;
globalThis.showroomPocket = ShowroomCore.showroomPocket;
globalThis.showroomCrateRows = ShowroomCore.showroomCrateRows;
globalThis.showroomDisplays = ShowroomCore.showroomDisplays;
globalThis.showroomWorldEdits = ShowroomCore.showroomWorldEdits;
globalThis.showroomDevBag = ShowroomCore.showroomDevBag;
globalThis.mkShowroomStore = ShowroomCore.mkShowroomStore;

/* ---------- 两个模式文件装进 eng(共享词法环境; index.html 加载序同构:
    adventure.js → showroom-core(上方已铺全局) → showroom.js) ---------- */
Object.assign(eng, {
  document: globalThis.document, performance: globalThis.performance,
  loadScene: globalThis.loadScene, showToast: globalThis.showToast, sfx: globalThis.sfx,
  SpeechKit: globalThis.SpeechKit, AudioMixer: globalThis.AudioMixer, Fx: globalThis.Fx,
  Mobs: globalThis.Mobs, Drops: globalThis.Drops,
  switchMode: globalThis.switchMode, showPage: globalThis.showPage, uiPause: globalThis.uiPause,
  overlay: globalThis.overlay, fps: globalThis.fps,
  setFly: globalThis.setFly, touchPlaying: false, camera: globalThis.camera,
  dayTime: 0, dayCycleOn: false,
  applyDaylight: globalThis.applyDaylight, setPlayerGlow: globalThis.setPlayerGlow,
  setFluidEditSink: globalThis.setFluidEditSink, playerAirS: globalThis.playerAirS,
  iconOf: globalThis.iconOf, btnImg: globalThis.btnImg, setTouchActions: globalThis.setTouchActions,
  Avatar: globalThis.Avatar, SyncDB: globalThis.SyncDB, Backpack: globalThis.Backpack,
  mkWorldJournal: globalThis.mkWorldJournal, fluidCell: globalThis.fluidCell,
  editBlock: globalThis.editBlock, applySweep: globalThis.applySweep,
  ModeKit, mkMode: globalThis.mkMode, mkMainAct: globalThis.mkMainAct,
  mkBubbleBar: globalThis.mkBubbleBar, FurnaceKit: globalThis.FurnaceKit,
  PlaceKit: globalThis.PlaceKit, CombatKit: globalThis.CombatKit, CombatCore: globalThis.CombatCore,
});/* 注: pos/vel/yaw/pitch/onGround/flyMode/Drops 是 eng 词法绑定(voxel/drops 顶层),
    属性赋值只会被词法遮蔽——Node 侧已改为直接共享词法对象(见上方提取/包装) */
/* 隐藏配方清单(mode-kit 顶层 const, 浏览器侧是共享词法名; Node 模块作用域取不到
    → 从语义源源文本解析真值铺进 eng, 壳的 allow getter(typeof 守卫)读到真清单
    ——生产行为(隐藏配方经 dev 政策点亮)的忠实复刻, 修桩不修断言 */
{
  const mkSrc = fs.readFileSync(path.join(ROOT, 'js/mode-kit.js'), 'utf8');
  const m = mkSrc.match(/const KIT_HIDDEN_RECIPES = (\[[^\]]*\]);/);
  assert.ok(m, 'mode-kit 隐藏配方清单可解析(桩 provisioning 前提)');
  eng.KIT_HIDDEN_RECIPES = JSON.parse(m[1].replace(/'/g, '"'));
}
Object.assign(eng, AdventureCore); /* 冒险纯核心常量表与政策纯函数(adventure-core) */
Object.assign(eng, require('../js/adventure-maps-core.js')); /* 地图注册表(缓存实例) */
Object.assign(eng, require('../js/adventure-dims-core.js')); /* 维度规格注册表(ADV_DIMS/advDimRow,
   dimension-registry——壳层 ADV_SCENE_KEYS 加载期派生消费) */
Object.assign(eng, {SMELT_T: CraftCore.SMELT_T, smeltStep: CraftCore.smeltStep,
  furnaceRefund: CraftCore.furnaceRefund});
Object.assign(eng, {SHOWROOM: ShowroomCore.SHOWROOM, showroomPocket: ShowroomCore.showroomPocket,
  showroomWorldEdits: ShowroomCore.showroomWorldEdits, showroomDevBag: ShowroomCore.showroomDevBag,
  mkShowroomStore: ShowroomCore.mkShowroomStore});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/modes/adventure.js'), 'utf8'),
    eng, {filename: 'js/modes/adventure.js'});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/modes/showroom.js'), 'utf8'),
    eng, {filename: 'js/modes/showroom.js'});
const SRV = vm.runInContext(`({
  get ShowroomMode() { return ShowroomMode; },
  get AdventureMode() { return AdventureMode; },
  get store() { return advStore; }, /* 两缝与缺省(U4 换装生命周期断言面) */
  get profile() { return advProfile; },
  get storeDefault() { return advStoreDefault; },
  get profileDefault() { return advProfileDefault; },
  advStationGate, /* 站点门禁缝(station 行为断言直触, 与面板 opts 同一函数) */
})`, eng);
const ShowroomMode = SRV.ShowroomMode;
const AdventureMode = SRV.AdventureMode;
const A = AdventureMode.adv; /* 壳的 28 键测试面(挂点别名优先走它, 见各用例) */
const showroomSrc = fs.readFileSync(path.join(ROOT, 'js/modes/showroom.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, 'js/showroom-core.js'), 'utf8');

const G = ADV_GROUND; /* 家营地平 24(展馆 dev 档的地平; v2 独立世界地平 12 已退役) */
const SR_FURNACE = {x: 64, y: G + 1, z: 62}; /* 即测炉: 出生点正后方 1.5 格 */
const nightMobList = () => mobsRig.list.filter((m) => m.__nightMob);

function freshEnter() {
  calls.length = 0;
  spoken.length = 0;
  dropCalls.length = 0;
  dropsTicks.length = 0;
  mobsRig.hits.length = 0;
  elCache['hotbar'].children.length = 0;
  collectCbs.length = 0; /* switchMode 兜底清共享实体账(Drops.clear 解除回调)的同拍 */
  ShowroomMode.init();
}

/* 面板 DOM 面读: 递归找 recipe 键(v2 辅助延续, 配方卡 dataset.recipe) */
function findCardByRecipe(el, rid) {
  if (el.dataset && el.dataset.recipe === rid) return el;
  for (const c of el.children || []) {
    const r = findCardByRecipe(c, rid);
    if (r) return r;
  }
  return null;
}

/* ============ ① 契约面 ============ */

test('体验馆: 门面经共享词法环境装载 + 注册行形状(dev 调试场) + main.js/index.html 接线', () => {
  assert.ok(ShowroomMode, '门面与冒险壳同 context 装载不炸(门面写壳的顶层 let 缝)');
  assert.strictEqual(ShowroomMode.id, 'showroom', '模式对象 id');
  const ModeRegistry = require('../js/mode-registry.js');
  const row = ModeRegistry.all.find((m) => m.id === 'showroom');
  assert.ok(row, 'mode-registry.js 有 showroom 行');
  assert.match(row.name, /\S/, '有面向开发者的显示名');
  assert.strictEqual(row.gated, false, '不进儿童时限(gated:false)');
  assert.strictEqual(row.page, false, '无菜单页(卡点击直进)');
  assert.strictEqual(row.dev, true, 'dev 行(卡默认隐藏, ?dev=1 解锁)');
  assert.strictEqual(row.mood, 'none', '情绪 none');
  assert.strictEqual(ModeRegistry.scriptSrc(row), 'js/modes/showroom.js', '派生脚本路径');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  assert.match(mainSrc, /^ {2}showroom: ShowroomMode,$/m,
      'main.js MODES 表接线(两空格缩进+行尾逗号)');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<script src="js\/showroom-core\.js" defer><\/script>/,
      'index.html 装载供给核心(加载序在模式之前)');
  const orderOk = html.indexOf('js/modes/adventure.js') < html.indexOf('js/showroom-core.js') &&
      html.indexOf('js/showroom-core.js') < html.indexOf('js/modes/showroom.js');
  assert.ok(orderOk, '加载序: 冒险壳 → 供给核心 → 门面(门面加载期即引用壳顶层部件)');
});

/* ============ ② 数据隔离键扫(模式+供给核心两文件, 红线不动) ============ */

function scanSaveKeys() {
  const keys = new Set(['audio_vol_save', 'inventory_save', 'daily_budget_save',
    'daily_budget_migrate_backup', 'play_time_save', 'focus_camp_save', 'play_extra_save',
    'build_world_save', 'adventure_world_save', 'adventure_quest_save',
    'adventure_chest_save', 'math_camp_save']);
  const walk = (d) => {
    const out = [];
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) out.push(...walk(p));
      else if (p.endsWith('.js')) out.push(p);
    }
    return out;
  };
  const re = /'([a-z0-9]+(?:_[a-z0-9]+)*_(?:save|backup))'/g;
  for (const p of walk(path.join(ROOT, 'js'))) {
    const src = fs.readFileSync(p, 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) keys.add(m[1]);
  }
  return keys;
}

test('体验馆: 数据隔离键扫 — 两文件源文本零存储 API 名/零存档键字面量(含注释)', () => {
  const keys = scanSaveKeys();
  assert.ok(keys.size >= 12, '扫描器失灵? 全库存档键应不少于 12 个');
  for (const src of [showroomSrc, coreSrc]) {
    for (const bad of ['localStorage', 'sessionStorage', 'SyncDB']) {
      assert.ok(!src.includes(bad), '不得出现存储 API 名: ' + bad);
    }
    for (const k of keys) {
      assert.ok(!src.includes(k), '不得出现存档键字面量: ' + k);
    }
  }
});

/* ============ ③ 套餐供给(派生挂点 + 模式侧复验同步不变量) ============ */

test('体验馆: 套餐 — stock 行形状/≤27/全 id ∈ ITEMS/n=stackMax(手抄材料表已废, 全派生)', () => {
  const stock = ShowroomMode.stock;
  assert.ok(Array.isArray(stock) && stock.length > 0, '套餐挂点在位');
  assert.ok(stock.length <= api.INV_SLOTS, '套餐行数 ≤ 27(一行一槽): ' + stock.length);
  const ids = new Set();
  for (const row of stock) {
    assert.ok(row && typeof row.id === 'string' && Number.isInteger(row.n) && row.n >= 1,
        '行形状 {id, n}: ' + JSON.stringify(row));
    assert.ok(Object.prototype.hasOwnProperty.call(api.ITEMS, row.id), 'id ∈ ITEMS: ' + row.id);
    assert.strictEqual(row.n, api.stackMax(row.id), 'n=堆叠上限: ' + row.id);
    assert.ok(!ids.has(row.id), '无重复: ' + row.id);
    ids.add(row.id);
  }
});

test('体验馆: 进场即全开 — dev bag 照套餐重铸, RECIPES 每条配方 canCraft 全绿', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  assert.strictEqual(inv, A.advGetInv(), '门面 getInv = 壳的背包 inv(dev bag 包同一引用)');
  for (const r of api.RECIPES) {
    const check = api.canCraft(inv, r, true);
    assert.ok(check.ok, '配方可合成: ' + r.id + ' 缺 ' + JSON.stringify(check.missing));
  }
});

/* ============ ④ 快捷栏 ============ */

test('体验馆: 壳的快捷栏 — 9 槽镜像 dev 背包前 9 槽, 数字键/滚轮/点选全自动', () => {
  freshEnter();
  const hb = ShowroomMode.hotbar;
  assert.ok(hb, '门面接壳的 mkHotbar');
  assert.strictEqual(hb, AdventureMode.hotbar, '与冒险壳同一实例(统一壳的快捷栏)');
  assert.strictEqual(hb.items.length, api.HOTBAR_SLOTS, '快捷栏 9 槽');
  const inv = ShowroomMode.getInv();
  for (let i = 0; i < api.HOTBAR_SLOTS; i++) {
    assert.strictEqual(hb.items[i].item, inv.slots[i] ? inv.slots[i].id : '',
        '槽 ' + i + ' 镜像背包');
  }
  hb.select(2);
  assert.strictEqual(hb.sel, 2, '点选选中第 3 槽');
  ShowroomMode.onDigit(1);
  assert.strictEqual(hb.sel, 0, '数字键 1 → 槽 0');
  ShowroomMode.onWheel(1);
  assert.strictEqual(hb.sel, 1, '滚轮下滚 → 下一槽');
  ShowroomMode.onWheel(-1);
  assert.strictEqual(hb.sel, 0, '滚轮上滚 → 上一槽');
  assert.strictEqual(elCache['hotbar'].style.display, 'flex', '进场快捷栏可见(chrome 对齐冒险壳)');
});

/* ============ ⑤ 统一进场: 壳 init 读篡改世界档 = home 基座 + 展馆账本重放 ============ */

test('体验馆: 统一装场 — 展馆结构经壳的建场+重放链在场(家营地平 y' + G + ', 真件 getBlock)', () => {
  freshEnter();
  /* 展厅: 地板/墙角/屋顶/南门成对/玻璃板窗 */
  assert.strictEqual(api.getBlock(55, G, 55), 6, '木板地板');
  assert.strictEqual(api.getBlock(48, G + 2, 44), 6, '木墙(西北角)');
  assert.strictEqual(api.getBlock(63, G + 5, 60), 6, '木板顶');
  assert.strictEqual(api.getBlock(63, G + 1, 75), api.B_DOOR, '南门(下扇)');
  assert.strictEqual(api.getBlock(63, G + 2, 75), api.B_DOOR_TOP, '南门(上扇)');
  assert.strictEqual(api.getBlock(54, G + 2, 44), api.B_GLASS_PANE, '北墙窗');
  assert.strictEqual(api.getBlock(48, G + 2, 60), api.B_GLASS_PANE, '西墙窗');
  /* 站点件: 即测炉 + 灶台双炉 + 工作台×2 + 床 */
  assert.strictEqual(api.getBlock(SR_FURNACE.x, SR_FURNACE.y, SR_FURNACE.z), api.B_FURNACE,
      '出生圈内即测熔炉');
  assert.strictEqual(api.getBlock(72, G + 1, 46), api.B_FURNACE, '灶台角炉 1');
  assert.strictEqual(api.getBlock(74, G + 1, 46), api.B_FURNACE, '灶台角炉 2');
  assert.strictEqual(api.getBlock(52, G + 1, 46), api.B_CRAFT, '工作台 1');
  assert.strictEqual(api.getBlock(54, G + 1, 46), api.B_CRAFT, '工作台 2');
  assert.strictEqual(api.getBlock(77, G + 1, 73), api.B_BED, '床');
  /* 试玩工位·奖励箱双工位(2026-10-30; D18 加小箱): 大箱双格 + 小箱单格错行
     (B_ 名经夹具动态收集进 globalThis——dims-core 源码扫描, api 对象无此二名) */
  assert.strictEqual(api.getBlock(66, G + 1, 62), B_LOOT_CHEST, '试玩工位大箱左格');
  assert.strictEqual(api.getBlock(67, G + 1, 62), B_LOOT_CHEST, '试玩工位大箱右格');
  assert.strictEqual(api.getBlock(66, G + 1, 60), B_LOOT_CHEST_SMALL, '试玩工位小箱(北邻错行不共线)');
  /* 仓库箱排: 箱方块数 = 派生箱数(且 ≤ 锚位上限, 超出即红) */
  const crates = ShowroomCore.showroomCrateStock();
  assert.ok(crates.length > 0 && crates.length <= SHOWROOM.crateMax,
      '仓库箱 1..' + SHOWROOM.crateMax + ' 只: ' + crates.length);
  for (let i = 0; i < Math.min(crates.length, SHOWROOM.crateMax); i++) {
    assert.strictEqual(api.getBlock(50, G + 1, 50 + i * 2), api.B_CHEST,
        '第 ' + i + ' 箱(' + crates[i].title + ')在场');
  }
  /* 展台展品: 派生方块清单(U5 起 need 旗标块在派生层排除——失依即落, 台面无原木
      可依, P14 清扫每场都会收走, 陈了等于空位)逐件在台面(y G+2 扫描区) */
  const found = new Set();
  for (let x = 54; x <= 72; x++) {
    for (let z = 51; z <= 66; z++) {
      const b = api.getBlock(x, G + 2, z);
      if (b) found.add(b);
    }
  }
  for (const bid of ShowroomCore.showroomDisplayBlocks()) {
    assert.ok(found.has(bid), '展品在台面: ' + bid);
  }
  /* 火把插满: 室内 + 地下室(扫描区域计数) */
  let houseTorch = 0;
  for (let x = 48; x <= 79; x++) {
    for (let z = 44; z <= 75; z++) {
      for (let y = G + 1; y <= G + 4; y++) {
        if (api.getBlock(x, y, z) === api.B_TORCH) houseTorch++;
      }
    }
  }
  assert.ok(houseTorch >= 10, '室内火把成排: ' + houseTorch);
  let baseTorch = 0;
  for (let x = 50; x <= 77; x++) {
    for (let z = 46; z <= 73; z++) {
      if (api.getBlock(x, G - 4, z) === api.B_TORCH) baseTorch++;
    }
  }
  assert.ok(baseTorch >= 8, '地下室火把成排: ' + baseTorch);
  /* 地下室: 内腔净空/腔顶石壳/矿样墙/楼梯井踏步 */
  assert.strictEqual(api.getBlock(63, G - 3, 60), 0, '内腔净空');
  assert.strictEqual(api.getBlock(63, G - 1, 60), 4, '腔顶石壳(上承房内地板)');
  assert.strictEqual(api.getBlock(55, G - 4, 47), api.B_DIAMOND_ORE, '矿样墙: 钻');
  assert.strictEqual(api.getBlock(75, G - 5, 71), 4, '楼梯井踏步在位');
  /* 基座世界在场(整地圈外的 home 图建场件): 门阵广场圆石铺装(坐标避开三扇门
      的门框平面 pz=76/88 与塔列, 帧 x88..93 属雪原门 x 向) */
  assert.strictEqual(api.getBlock(90, G, 80), 4, '门阵广场圆石(基座建场在展馆外完好)');
});

test('体验馆: 统一进场 — 房内出生(篡改档 pos)·昼夜接线·昼夜时刻恒清晨(dev 档不落盘)', () => {
  freshEnter();
  assert.ok(calls.some((c) => c[0] === 'spawn' && c[1] === 64.5 && c[2] === G + 1 && c[3] === 60.5),
      '出生=篡改档 pos(房内过道, 家营地平+1)');
  assert.strictEqual(eng.dayCycleOn, true, '壳 init 置位昼夜循环');
  assert.strictEqual(eng.dayTime, 0, '白天起步(篡改档 dayTime=0)');
  assert.ok(calls.some((c) => c[0] === 'applyDaylight'), '进场先刷一次天色(壳同位)');
  eng.dayTime = 18000; /* 破坏现场: 深夜退场 */
  ShowroomMode.cleanup();
  assert.strictEqual(eng.dayCycleOn, false, 'cleanup 关循环(壳同位)');
  assert.ok(calls.some((c) => c[0] === 'applyDaylight'), '复位即刷天色(幂等)');
  freshEnter(); /* 重进: dev 档重铸, 时刻回清晨 */
  assert.strictEqual(eng.dayTime, 0, '重进恒清晨(dev 档每次进场重铸, 不读深夜残留)');
});

test('体验馆: 馆内生态 — 巢穴怪与牧场动物随统一壳进馆(拍板③), 白天无夜怪', () => {
  freshEnter();
  /* 巢穴怪种类掷骰是无种子 Math.random(adventure.js advSpawnNest, 每进场不同
      是既有口径)——「三怪都会来」的守门面是**池数据**(随统一壳进馆的确定性
      事实), 播种结果只校验非空且 ⊆ 池并集(不赌运气, 全量并行跑不偶发红) */
  const nestKinds = new Set();
  for (const nest of eng.ADV_HOME_ROW.nests) {
    for (const k of nest.kinds) nestKinds.add(k);
  }
  for (const t of ['zombie', 'spider', 'creeper']) {
    assert.ok(nestKinds.has(t), '巢穴池含 ' + t + '(壳的 advSeedMapMobs 播的就是这张池)');
  }
  const spawned = mobsRig.spawned.map((m) => m.type);
  const nestSpawned = spawned.filter((t) => nestKinds.has(t));
  assert.ok(nestSpawned.length > 0, '巢穴怪已播(非空): ' + nestSpawned.join(','));
  for (const t of nestSpawned) {
    assert.ok(nestKinds.has(t), '播种种类 ∈ 巢穴池: ' + t);
  }
  for (const t of ['cow', 'sheep', 'pig', 'chicken']) {
    assert.ok(spawned.indexOf(t) >= 0, '牧场动物在场: ' + t + '(F4 牧场确定性清单随统一进馆)');
  }
  assert.strictEqual(nightMobList().length, 0, '白天无夜怪(入夜上沿才铺)');
});

/* ============ ⑥ 三站点交互(统一口径) ============ */

test('体验馆: 熔炉交互 — 走近点击开面板/太远 toast 拒/✕ 统一出口收起/左键同达', () => {
  freshEnter();
  const hit = {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z};
  const sx = pos.x; const sz = pos.z;
  pos.x = 64.5; pos.z = 72.5; /* 圈外(距 10 > 4) */
  ShowroomMode.onMouse(2, hit);
  assert.ok(!ShowroomMode.sr.isOpen(), '圈外点击不开面板');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('走近')),
      '圈外点击给走近提示');
  pos.x = sx; pos.z = sz; /* 回出生点(圈内 1.5 格) */
  ShowroomMode.onMouse(2, hit);
  assert.ok(ShowroomMode.sr.isOpen(), '圈内轻点开熔炉面板');
  ShowroomMode.sr.panel.close();
  assert.ok(!ShowroomMode.sr.isOpen(), '✕ 统一出口后状态同步收起');
  ShowroomMode.onMouse(0, hit);
  assert.ok(ShowroomMode.sr.isOpen(), '左键同达');
  ShowroomMode.sr.panel.close();
});

test('体验馆: 合成面板 — Tab 开合(统一入口) · 点击工作台不再开面板(统一口径)', () => {
  freshEnter();
  /* 统一后合成面板入口=Tab/🎒(站点门禁是合成时校验, 不是点击开面板); 点击
      工作台落放置链——这是拍板过的统一口径, 非回归 */
  ShowroomMode.onMouse(2, {x: 52, y: G + 1, z: 46, nx: 0, ny: 1, nz: 0});
  assert.ok(!ShowroomMode.sr.craft.isOpen(), '点击工作台不开面板(统一口径: 入口在 Tab)');
  ShowroomMode.onKey('Tab'); /* Tab 开面板 */
  assert.ok(ShowroomMode.sr.craft.isOpen(), 'Tab 开面板');
  assert.notStrictEqual(ShowroomMode.sr.craft.panel.root.style.display, 'none', '面板可见');
  ShowroomMode.onKey('Tab');
  assert.ok(!ShowroomMode.sr.craft.isOpen(), 'Tab 再按收面板');
});

test('体验馆: station 行为断言 — 远离工作台台级配方随处可摆(dev 政策, 源码正则已废)', () => {
  freshEnter();
  /* 站在房内过道(64.5,60.5): 距最近工作台(52/54,46) > 20 格——真实 4 格门禁
      必假; 政策缝 advStationGate(面板 opts 消费的同一函数)恒真 */
  assert.strictEqual(A.advStationOk(), false, '4 格内无工作台(真实站点门禁为假)');
  assert.strictEqual(SRV.advStationGate(), true, 'advStationGate 恒真(dev: 台级配方随处可摆)');
  /* 隐藏配方全点亮: bread ∈ mode-kit 隐藏清单, dev 政策下面板卡片在场且不灰 */
  ShowroomMode.onKey('Tab');
  const bread = findCardByRecipe(ShowroomMode.sr.craft.panel.root, 'bread');
  assert.ok(bread, '隐藏配方面包卡片在场(hiddenRecipesOpen)');
  const tableR = api.RECIPES.find((r) => r.station === 'table');
  const card = findCardByRecipe(ShowroomMode.sr.craft.panel.root, tableR.id);
  assert.ok(card, '台级配方卡片在场(远离工作台): ' + tableR.id);
  assert.ok(!card.classList.contains('dim'), '台级配方不灰(station 门禁被 dev 政策放开)');
  ShowroomMode.onKey('Tab');
});

test('体验馆: 箱子全局单账户 — 顶格预填 · 多箱方块打开同一账户(§4 行为变化)', () => {
  freshEnter();
  const account = ShowroomMode.chest();
  const stock = ShowroomCore.showroomCrateStock();
  /* 基础格顶格 27 + 陈列仓库箱逐只计入(与冒险同口径, ADR 0007 修正——
     初版曾为保「顶格 27」把体验馆箱轨整条关掉, 真机造箱验证拍板撤销) */
  assert.strictEqual(account.size, ADV_CHEST_SLOTS + 9 * stock.length,
      '基础顶格 ' + ADV_CHEST_SLOTS + ' + 陈列箱 ' + stock.length + ' 只 ×9');
  assert.strictEqual(account.slots[0].id, stock[0].rows[0].id,
      '首槽=派生首行(' + stock[0].title + '): 仓库箱物资经 U3 payload 预填');
  assert.ok(account.slots.every((s) => !s || Object.prototype.hasOwnProperty.call(api.ITEMS, s.id)),
      '槽内容 ∈ ITEMS');
  /* 满箱拒收(预填 27 槽 + 尾部陈列箱加成格直接灌满, 还原「满箱」前提):
     整摞存入被温和拒绝(零惩罚口径) */
  for (let i = ADV_CHEST_SLOTS; i < account.size; i++) account.slots[i] = {id: 'cobble', n: 1};
  const inv = ShowroomMode.getInv();
  const logBefore = api.count(inv, 'log');
  calls.length = 0;
  A.advChestDeposit(0); /* 背包槽 0(原木×64)整摞入箱尝试 */
  assert.strictEqual(api.count(inv, 'log'), logBefore, '满箱拒收: 背包不动');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('满')),
      '满箱提示 toast');
  /* 两只仓库箱方块 → 同一账户: 从 A 箱取走的槽, 从 B 箱看也是空的 */
  const sx = pos.x; const sz = pos.z;
  pos.x = 50.5; pos.z = 51.5; /* 走近第 0 箱(50,50) */
  ShowroomMode.onMouse(2, {x: 50, y: G + 1, z: 50});
  assert.ok(ShowroomMode.sr.chest.isOpen(), '点箱 A 开面板');
  assert.ok(ShowroomMode.sr.chest.panel.root.style.display !== 'none', '面板可见');
  A.advChestWithdraw(0); /* 从 A 箱取走首槽 */
  assert.strictEqual(account.slots[0], null, 'A 箱取走首槽');
  ShowroomMode.sr.chest.panel.close();
  assert.ok(!ShowroomMode.sr.chest.isOpen(), '✕ 出口收起');
  ShowroomMode.onMouse(2, {x: 50, y: G + 1, z: 52}); /* 走近第 1 箱(50,52) */
  assert.ok(ShowroomMode.sr.chest.isOpen(), '点箱 B 开面板');
  assert.strictEqual(ShowroomMode.chest(), account, '多箱方块同一账户(全局单账户口径)');
  assert.strictEqual(account.slots[0], null, 'B 箱看到的也是取空的首槽(A/B 同账户)');
  /* 背包→账户→背包: 取空一格后整摞走一个来回零损耗(advChestPut/Take 政策路径) */
  A.advChestDeposit(0); /* 背包槽 0(原木×64)整摞入箱(取空的首槽恰可容) */
  assert.strictEqual(api.count(inv, 'log'), 0, '整摞出包入箱');
  const slot = account.slots.findIndex((s) => s && s.id === 'log' && s.n === 64);
  assert.ok(slot >= 0, '原木整摞躺进账户');
  A.advChestWithdraw(slot);
  assert.strictEqual(api.count(inv, 'log'), logBefore, '整摞取回(零损耗)');
  ShowroomMode.sr.chest.panel.close();
  pos.x = sx; pos.z = sz;
});

test('体验馆: 箱轨容量(ADR 0007 修正) — 展馆造箱也 +9 · 挖箱 −9, 与冒险同口径', () => {
  freshEnter();
  const before = ShowroomMode.chest().size;
  assert.ok(before > ADV_CHEST_SLOTS, '陈列仓库箱已计入入场容量: ' + before);
  const inv = ShowroomMode.getInv();
  const held0 = inv.slots[0];
  inv.slots[0] = api.mkStack('chest', 2); /* 手持两只箱(门测试同款捷径) */
  /* 整地圈西条带连放两箱(右键草地顶面, 放置链测试同坐标带) */
  ShowroomMode.onMouse(2, {x: 46, y: G, z: 55, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(api.getBlock(46, G + 1, 55), api.B_CHEST, '箱子 A 在场');
  assert.strictEqual(ShowroomMode.chest().size, before + 9, '造箱 A: 容量 +9(用户真机报告的回归护栏)');
  ShowroomMode.onMouse(2, {x: 46, y: G, z: 57, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(ShowroomMode.chest().size, before + 18, '造箱 B: 再 +9');
  /* 挖掉一箱: 容量随之缩回(随现存箱子数缩放) */
  A.advBreakBlock(46, G + 1, 57, api.B_CHEST, {time: 1, drops: false});
  assert.strictEqual(ShowroomMode.chest().size, before + 9, '挖掉 B: 缩回 +9 格');
  inv.slots[0] = held0;
});

/* ============ 2026-10-28 背包点选搬运: 快捷栏镜像同步(壳的 advInvMove) ============ */

test('体验馆: 背包点选搬运 — 搬进/搬出/换序快捷栏镜像跟随(壳同一函数)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  /* 主格 → 快捷栏空位: 火把搬进槽 5, 图标要立即可见(图标只认 sync 写的 item 字段) */
  inv.slots[5] = null;
  inv.slots[20] = {id: 'torch', n: 4};
  ShowroomMode.sr.craft.move(20, 5);
  assert.deepStrictEqual({...inv.slots[5]}, {id: 'torch', n: 4}, '火把搬进快捷栏槽 5');
  assert.strictEqual(ShowroomMode.hotbar.items[5].item, 'torch',
      '快捷栏镜像跟随(修: 关背包后图标滞留旧物)');
  /* 异种对调 = 快捷栏换序: 两格图标都要换 */
  inv.slots[0] = {id: 'coal', n: 10};
  inv.slots[1] = {id: 'planks', n: 3};
  ShowroomMode.sr.craft.move(0, 1);
  assert.strictEqual(ShowroomMode.hotbar.items[0].item, 'planks', '换序: 木板进槽 0 图标已换');
  assert.strictEqual(ShowroomMode.hotbar.items[1].item, 'coal', '煤挪槽 1 图标已换');
  /* 快捷栏 → 主格空位: 腾出的槽图标清空 */
  inv.slots[26] = null;
  ShowroomMode.sr.craft.move(1, 26);
  assert.strictEqual(ShowroomMode.hotbar.items[1].item, '', '腾空槽镜像清空');
  /* 原地搬运零副作用 */
  ShowroomMode.sr.craft.move(3, 3);
  assert.strictEqual(ShowroomMode.hotbar.items[3].item,
      inv.slots[3] ? inv.slots[3].id : '', '原地搬运不动镜像');
});

/* ============ ⑦ 熔炉行为线(壳的 kit 实例, 编排口径) ============ */

test('体验馆: 熔炉 — 自动放料(套餐首现矿种全量+最省燃料) · 2.5s/件 · 关面板照烧', () => {
  freshEnter();
  const hit = {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z};
  ShowroomMode.onMouse(2, hit);
  ShowroomMode.sr.autoFill(); /* 绑定炉自算真 plan(读真包, 与探险同一实现) */
  const key = api.blockKey(SR_FURNACE.x, SR_FURNACE.y, SR_FURNACE.z);
  const f = ShowroomMode.sr.furnaces.get(key);
  /* 套餐首行=原木(RECIPES 首配方 planks 的材料): 全量入炉; 热值缺口 64,
      FUEL 择优序首煤(8 件/块) → 8 块 */
  const first = ShowroomMode.stock[0];
  assert.strictEqual(first.id, 'log', '套餐首行=原木(配方书首配方的材料, 派生序)');
  assert.deepStrictEqual(f.input, {id: 'log', n: 64}, '待烧料=首现矿种全量');
  assert.deepStrictEqual(f.fuel, {id: 'coal', n: 8}, '燃料=最省凑料(煤 8 块覆盖 64 件)');
  const inv = ShowroomMode.getInv();
  assert.strictEqual(api.count(inv, 'log'), 0, '背包原木全额扣减');
  assert.strictEqual(api.count(inv, 'coal'), 56, '背包煤扣 8 块');
  ShowroomMode.update(2.6);
  const f2 = ShowroomMode.sr.furnaces.get(key); /* tick 写回新状态对象, 重取再断言 */
  assert.deepStrictEqual(f2.out, {id: 'charcoal', n: 1}, '烧满 2.5s 出 1 木炭');
  assert.ok(Math.abs(f2.prog - 0.1) < 1e-9, '余 0.1s 结转(半件不丢)');
  ShowroomMode.sr.panel.close(); /* 关面板顺带收产物入包, 烧炼照跑 */
  assert.strictEqual(f2.out, null, '关面板取走产物');
  assert.strictEqual(api.count(inv, 'charcoal'), 65, '产物入包(对照样 64 + 新烧 1)');
  ShowroomMode.update(2.5);
  const f3 = ShowroomMode.sr.furnaces.get(key);
  assert.deepStrictEqual(f3.out, {id: 'charcoal', n: 1}, '面板关着照烧');
});

/* ============ ⑧ 收场与重进(dev store 丢弃一切) ============ */

test('体验馆: 收场与重进 — 退炉不退料(统一口径)·零掉落物·背包同实例重铸·账户照派生重铸', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  ShowroomMode.onMouse(2, {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z});
  ShowroomMode.sr.autoFill();
  ShowroomMode.update(2.6);
  ShowroomMode.sr.panel.close(); /* 先收熔炉面板(产物入包), Tab 才轮到合成面板 */
  ShowroomMode.onKey('Tab'); /* 合成面板开着一起收 */
  assert.ok(ShowroomMode.sr.craft.isOpen(), '面板开着(收场前提)');
  ShowroomMode.cleanup();
  assert.ok(!ShowroomMode.sr.craft.isOpen() && !ShowroomMode.sr.chest.isOpen(),
      '面板旗标全收(壳 cleanup)');
  assert.strictEqual(dropCalls.length, 0, '常规收场零掉落物(余量静默丢弃口径)');
  assert.strictEqual(api.count(inv, 'log'), 0,
      '退炉不退料(F1 拍板①: 炉态随会话丢弃, v2 的退炉三笔入包退役)');
  /* 重进: dev 档全部重铸(背包同实例原地重铸/账户照派生/炉态清空/世界重建) */
  inv.slots[0] = null; /* 破坏现场 */
  ShowroomMode.chest().slots[0] = null;
  freshEnter();
  assert.strictEqual(ShowroomMode.getInv(), inv, '背包引用跨进场稳定(②的解: 同一 inv 对象)');
  assert.strictEqual(api.count(inv, ShowroomMode.stock[0].id),
      ShowroomMode.stock[0].n, '套餐照表重铸(恢复原装)');
  assert.strictEqual(ShowroomMode.chest().slots[0].id, ShowroomCore.showroomCrateStock()[0].rows[0].id,
      '账户照派生重铸(恢复原装)');
  assert.strictEqual(ShowroomMode.sr.furnaces.size, 0, '炉态清空(壳 init reset)');
  assert.ok(!ShowroomMode.sr.isOpen(), '熔炉面板复位');
});

/* ============ ⑨ 放置链(place-kit 同一实现; 用整地圈西条带, 地平恒 G) ============ */

test('体验馆: 右键放置 — 套餐首行原木落地+扣件(单格放置走壳的 kit 全链)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  assert.strictEqual(inv.slots[0].id, 'log', '套餐首行=原木(选中槽 0)');
  ShowroomMode.onMouse(2, {x: 46, y: G, z: 55, nx: 0, ny: 1, nz: 0}); /* 整地圈西条带草地顶面 */
  assert.strictEqual(api.getBlock(46, G + 1, 55), 5, '原木方块在场(木块 id 5)');
  assert.strictEqual(api.count(inv, 'log'), 63, '扣 1 件');
});

test('体验馆: 门 — 放置两格+左键点击开关(与冒险同一结构放置/成对换 id)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('door', 2); /* 从仓库取门进选中槽(测试捷径) */
  ShowroomMode.onMouse(2, {x: 46, y: G, z: 52, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(api.getBlock(46, G + 1, 52), api.B_DOOR, '门下扇');
  assert.strictEqual(api.getBlock(46, G + 2, 52), api.B_DOOR_TOP, '门上扇');
  assert.strictEqual(api.count(inv, 'door'), 1, '扣 1 扇');
  ShowroomMode.onMouse(0, {x: 46, y: G + 1, z: 52, nx: 0, ny: 0, nz: 0}); /* 左键点门=开关 */
  assert.strictEqual(api.getBlock(46, G + 1, 52), api.B_DOOR_OPEN, '点击开门(成对换 id)');
  ShowroomMode.onMouse(0, {x: 46, y: G + 1, z: 52, nx: 0, ny: 0, nz: 0});
  assert.strictEqual(api.getBlock(46, G + 1, 52), api.B_DOOR, '再点关回实心');
});

test('体验馆: 左键蓄力挖 — 到点破坏+掉落物照掉+update 喂真空拾取(与冒险同一实现)', () => {
  freshEnter();
  ShowroomMode.onMouse(2, {x: 47, y: G, z: 58, nx: 0, ny: 1, nz: 0}); /* 放原木 (47,G+1,58) */
  dropCalls.length = 0;
  dropsTicks.length = 0;
  const origAim = PlaceKit.aimHit;
  PlaceKit.aimHit = () => ({x: 47, y: G + 1, z: 58, nx: 0, ny: 0, nz: 0}); /* Node 无相机: 桩准星 */
  ShowroomMode.mine.down = true;
  try {
    ShowroomMode.update(3); /* 原木徒手 3s: 一步到点破坏(蓄力链全在 kit) */
  } finally {
    PlaceKit.aimHit = origAim;
    ShowroomMode.mine.down = false;
  }
  assert.strictEqual(api.getBlock(47, G + 1, 58), 0, '到点破坏');
  assert.ok(dropCalls.some((d) => d[0] === 'log'), '掉落物照掉(级联 sink→Drops.spawn)');
  assert.ok(dropsTicks.length > 0, 'update 每帧喂掉落物真空拾取(玩家胸口点)');
});

/* ============ ⑩ TNT 链(adventure-core 纯函数 + 壳的引信/爆炸编排; 用整地圈
    东条带 x80..81, 地平恒 G, 与结构断言互不干扰——每次 freshEnter 世界重建) ============ */

test('体验馆: TNT 短按点燃 — tap 记账→引信 1.5s→爆炸圈内清空+70% 掉落+波及怪物段(§4)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 81, y: G, z: 55, nx: 0, ny: 1, nz: 0}); /* TNT 落 (81,G+1,55) */
  assert.strictEqual(api.getBlock(81, G + 1, 55), B_TNT, 'TNT 在场');
  inv.slots[1] = api.mkStack('planks', 4);
  ShowroomMode.hotbar.select(1);
  ShowroomMode.onMouse(2, {x: 81, y: G, z: 57, nx: 0, ny: 1, nz: 0}); /* 木板落 (81,G+1,57), 距爆心 2<3.5 */
  assert.strictEqual(api.getBlock(81, G + 1, 57), 6, '圈内对照木板在场');
  mobsRig.list.push({type: 'zombie', pos: {x: 81.5, y: G + 1, z: 56.5}, dead: false, gone: false,
    attackCd: 0, attackT: 0, cfg: Object.assign({}, SR_MOB_CFG)}); /* 波及怪(距 1.5) */
  const bystander = mobsRig.list[mobsRig.list.length - 1];
  dropCalls.length = 0;
  ShowroomMode.onMouse(0, {x: 81, y: G + 1, z: 55}); /* 左键: mousedown 只记账不点燃 */
  assert.ok(ShowroomMode.tntTap(), 'tap 状态在位(短按判定待 update)');
  assert.strictEqual(ShowroomMode.fuses.length, 0, 'mousedown 当帧未点燃');
  ShowroomMode.update(0.05); /* 松手 <0.25s: 短按→点燃 */
  assert.strictEqual(ShowroomMode.tntTap(), null, '判定完状态出列');
  assert.strictEqual(ShowroomMode.fuses.length, 1, '短按点燃(引信在位)');
  assert.strictEqual(api.getBlock(81, G + 1, 55), B_TNT, '点燃不摘块');
  const realRandom = Math.random;
  Math.random = () => 0; /* 70% 掷骰必中签(注入口径, 纯函数单测同款) */
  try {
    ShowroomMode.update(1.6); /* 引信 1.5s 走完: 起爆 */
  } finally {
    Math.random = realRandom;
  }
  assert.strictEqual(ShowroomMode.fuses.length, 0, '引信出列');
  assert.strictEqual(api.getBlock(81, G + 1, 55), 0, '源块直清(不经掷骰)');
  assert.strictEqual(api.getBlock(81, G + 1, 57), 0, '圈内方块清空');
  assert.ok(dropCalls.some((d) => d[0] === 'planks'), '70% 掉落经 Drops.spawn(木板)');
  assert.ok(mobsRig.hits.some((h) => h.m === bystander && h.dmg > 0),
      '波及怪物段随统一进馆(advTntWave: 线性衰减伤害, §4 行为变化)');
});

test('体验馆: TNT 链式接力 — 圈内第二块被接力点燃(块还在), 二拍连环爆', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 8);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 80, y: G, z: 58, nx: 0, ny: 1, nz: 0}); /* A (80,G+1,58) */
  ShowroomMode.onMouse(2, {x: 80, y: G, z: 61, nx: 0, ny: 1, nz: 0}); /* B (80,G+1,61), 距 A 3<3.5 */
  assert.strictEqual(api.getBlock(80, G + 1, 58), B_TNT, 'A 在场');
  assert.strictEqual(api.getBlock(80, G + 1, 61), B_TNT, 'B 在场');
  ShowroomMode.onMouse(0, {x: 80, y: G + 1, z: 58});
  ShowroomMode.update(0.05); /* 点燃 A */
  assert.strictEqual(ShowroomMode.fuses.length, 1, 'A 引信在位');
  ShowroomMode.update(1.6); /* A 爆 → B 接力点燃(不即爆) */
  assert.strictEqual(api.getBlock(80, G + 1, 58), 0, 'A 爆');
  assert.strictEqual(api.getBlock(80, G + 1, 61), B_TNT, 'B 块还在(接力而非同爆)');
  assert.strictEqual(ShowroomMode.fuses.length, 1, 'B 引信在位');
  assert.strictEqual(ShowroomMode.fuses[0].z, 61, '接力引信=B 的位置');
  ShowroomMode.update(1.6); /* B 爆 */
  assert.strictEqual(api.getBlock(80, G + 1, 61), 0, 'B 二拍连环爆');
  assert.strictEqual(ShowroomMode.fuses.length, 0, '引信清空');
});

test('体验馆: TNT 按住转蓄力 — ≥0.25s 不点燃转挖(hard 0 挖走回收, 探险 D3 二分同款)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.onMouse(2, {x: 80, y: G, z: 64, nx: 0, ny: 1, nz: 0}); /* TNT (80,G+1,64) */
  dropCalls.length = 0;
  ShowroomMode.onMouse(0, {x: 80, y: G + 1, z: 64}); /* 记账 */
  const origAim = PlaceKit.aimHit;
  PlaceKit.aimHit = () => ({x: 80, y: G + 1, z: 64, nx: 0, ny: 0, nz: 0}); /* Node 无相机: 桩准星 */
  ShowroomMode.onHold(true); /* 桌面按住/触屏长按同轨道 */
  try {
    ShowroomMode.update(0.3); /* ≥0.25s: 转蓄力(同帧 mineTick 到点破坏) */
  } finally {
    PlaceKit.aimHit = origAim;
    ShowroomMode.onHold(false);
    ShowroomMode.mine.down = false;
  }
  assert.strictEqual(ShowroomMode.fuses.length, 0, '按住不点燃');
  assert.strictEqual(api.getBlock(80, G + 1, 64), 0, '转挖: TNT 被挖走(hard 0 秒碎)');
  assert.ok(dropCalls.some((d) => d[0] === 'tnt'), '可回收: 掉 TNT 物品(挖掘硬度修正 D3)');
});

test('体验馆: TNT 掀门 — 整扇回收(掉 1 扇不双掉), 击杀不推任务步(任务档终章态)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 80, y: G, z: 68, nx: 0, ny: 1, nz: 0}); /* TNT (80,G+1,68) */
  inv.slots[1] = api.mkStack('door', 2);
  ShowroomMode.hotbar.select(1);
  ShowroomMode.onMouse(2, {x: 80, y: G, z: 70, nx: 0, ny: 1, nz: 0}); /* 门 (80,G+1/2,70), 距爆心 2 */
  assert.strictEqual(api.getBlock(80, G + 1, 70), api.B_DOOR, '门下扇在场');
  assert.strictEqual(api.getBlock(80, G + 2, 70), api.B_DOOR_TOP, '门上扇在场');
  dropCalls.length = 0;
  const stepBefore = A.ADV.quest.step;
  ShowroomMode.onMouse(0, {x: 80, y: G + 1, z: 68});
  ShowroomMode.update(0.05);
  ShowroomMode.update(1.6);
  assert.strictEqual(api.getBlock(80, G + 1, 70), 0, '门下扇掀掉');
  assert.strictEqual(api.getBlock(80, G + 2, 70), 0, '门上扇整扇回收');
  assert.strictEqual(dropCalls.filter((d) => d[0] === 'door').length, 1, '掉 1 扇(不双掉)');
  /* v2 的 questMine noop 源码正则 → 行为断言: 级联/爆炸不推任务步(篡改档
      本就是表外终章态, 推进链在壳内天然空转; 记账进内存 dev 档随会话丢弃) */
  assert.strictEqual(A.ADV.quest.step, stepBefore, '任务步不动(终章态不推进)');
  assert.strictEqual(A.ADV.quest.step, ADV_QUESTS.length, '任务档=表外终章态(篡改 payload)');
});

test('体验馆: 爆炸掀炉兜底 — 炉内三笔退包+炉态删除(壳「炉没了退料」同款缝)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[1] = api.mkStack('furnace', 2);
  ShowroomMode.hotbar.select(1);
  ShowroomMode.onMouse(2, {x: 81, y: G, z: 67, nx: 0, ny: 1, nz: 0}); /* 炉 (81,G+1,67) */
  const key = api.blockKey(81, G + 1, 67);
  ShowroomMode.sr.autoFill(null, key); /* 无面板直调上料(kit 契约: posKey 寻址) */
  const f = ShowroomMode.sr.furnaces.get(key);
  assert.ok(f && f.input, '炉已上料(兜底前提)');
  const logBefore = api.count(inv, 'log');
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 81, y: G, z: 65, nx: 0, ny: 1, nz: 0}); /* TNT (81,G+1,65), 距炉 2 */
  ShowroomMode.onMouse(0, {x: 81, y: G + 1, z: 65});
  ShowroomMode.update(0.05);
  ShowroomMode.update(1.6);
  assert.strictEqual(api.getBlock(81, G + 1, 67), 0, '炉块掀掉');
  assert.ok(!ShowroomMode.sr.furnaces.has(key), '炉态删除(无幽灵炉)');
  assert.ok(api.count(inv, 'log') > logBefore, '炉内待烧料三笔退包');
});

test('体验馆: dev store 丢弃一切 — 挖放爆全程改动只活当次进场, 重进世界逐格恢复原装', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 80, y: G, z: 72, nx: 0, ny: 1, nz: 0}); /* TNT (80,G+1,72) */
  ShowroomMode.onMouse(0, {x: 80, y: G + 1, z: 72});
  ShowroomMode.update(0.05);
  ShowroomMode.update(1.6); /* 爆完(东条带留坑) */
  assert.strictEqual(api.getBlock(80, G + 1, 72), 0, '爆点已清');
  assert.notStrictEqual(api.getBlock(80, G, 72), 1, '爆坑深入地平(dev 会话内的改动)');
  freshEnter(); /* 重进: 世界=基座+展馆账本重放, dev 会话改动随 store 丢弃 */
  assert.strictEqual(api.getBlock(80, G + 1, 72), 0, 'TNT 不在场(非账本内容不重放)');
  assert.strictEqual(api.getBlock(80, G, 72), 1, '地平草地复原(改动只活当次进场)');
  assert.strictEqual(api.getBlock(55, G, 55), 6, '展馆结构复原(账本重放)');
});

test('体验馆: cleanup 复位 — 引信清空+tap 状态归零(不渗漏到下一模式)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.onMouse(2, {x: 80, y: G, z: 74, nx: 0, ny: 1, nz: 0});
  ShowroomMode.onMouse(0, {x: 80, y: G + 1, z: 74});
  ShowroomMode.update(0.05); /* 点燃: 引信在位 */
  assert.strictEqual(ShowroomMode.fuses.length, 1, '引信在位(复位前提)');
  ShowroomMode.onMouse(0, {x: 80, y: G + 1, z: 74}); /* 再记一笔 pending tap */
  assert.ok(ShowroomMode.tntTap(), 'tap 状态在位');
  ShowroomMode.cleanup();
  assert.strictEqual(ShowroomMode.fuses.length, 0, 'cleanup 引信清空(壳先例: 引信不落盘)');
  assert.strictEqual(ShowroomMode.tntTap(), null, 'cleanup tap 归零');
});

/* ============ ⑪ 拾取入包(Drops.onCollect → 壳的收集链) ============ */

test('体验馆: 拾取入包 — 收集回调入包+快捷栏跟进, 满包拒返 false(停地上冷却重试)', () => {
  freshEnter();
  assert.strictEqual(collectCbs.length, 1, 'init 注册收集回调(壳 init 重挂, 探险同款)');
  const inv = ShowroomMode.getInv();
  /* 满仓化: 套餐行数可能 <27(材料并集按注册序), 空槽补满原木做满包口径 */
  for (let i = 0; i < api.INV_SLOTS; i++) {
    if (!inv.slots[i]) inv.slots[i] = api.mkStack('log', 64);
  }
  inv.slots[0] = api.mkStack('log', 60); /* 槽 0 腾并堆余量(仍无空槽) */
  const logBefore = api.count(inv, 'log');
  let syncs = 0; /* 壳的 advSyncHotbar 语义: 换物 render / 同物轻刷新 refresh——两者任一即同步 */
  const origRender = ShowroomMode.hotbar.render;
  const origRefresh = ShowroomMode.hotbar.refresh;
  ShowroomMode.hotbar.render = () => {
    syncs++;
    origRender();
  };
  ShowroomMode.hotbar.refresh = () => {
    syncs++;
    origRefresh();
  };
  try {
    assert.notStrictEqual(collectCbs[0]('log', 5), false,
        '部分收下(非 false=掉落物照常消失, drops.js 消费口径: 壳包装成功返 undefined)');
    assert.strictEqual(api.count(inv, 'log'), logBefore + 4,
        '背包计数增加(并堆收满 60→64, 余量无空位即止)');
    assert.ok(syncs > 0, '快捷栏同步被调(壳的 advSyncHotbar: render/refresh 任一)');
    const n = syncs;
    assert.strictEqual(collectCbs[0]('log', 3), false, '一件都放不下: 拒返 false(D6 背包满口径)');
    assert.strictEqual(syncs, n, '拒收不刷快捷栏');
    assert.strictEqual(api.count(inv, 'log'), logBefore + 4, '拒收计数不动');
  } finally {
    ShowroomMode.hotbar.render = origRender;
    ShowroomMode.hotbar.refresh = origRefresh;
  }
});

/* ============ ⑫ 玩家 HP 实体 + 进食 + 雪球(壳的链; 用整地圈西条带空地) ============ */

test('体验馆: 进食链 — 半血右键吃: hp 回升+扣 1+快捷栏同步; 满血不吃不扣(advEatPolicy 政策)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('apple', 2);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.pEnt().hp = 15; /* 直驱至半血(实体即账本; 受击走同一路径) */
  let syncs = 0; /* 壳的 advSyncHotbar 语义: 换物 render / 同物轻刷新 refresh(拾取用例同款) */
  const origRender = ShowroomMode.hotbar.render;
  const origRefresh = ShowroomMode.hotbar.refresh;
  ShowroomMode.hotbar.render = () => {
    syncs++;
    origRender();
  };
  ShowroomMode.hotbar.refresh = () => {
    syncs++;
    origRefresh();
  };
  try {
    ShowroomMode.onMouse(2, {x: 46, y: G, z: 58, nx: 0, ny: 1, nz: 0}); /* 草地: 吃吞点击不落放置 */
    assert.strictEqual(ShowroomMode.pEnt().hp, 19, '苹果回 4 血(ITEMS.food)');
    assert.strictEqual(inv.slots[0].n, 1, '吃掉 1 个');
    assert.ok(syncs > 0, '快捷栏同步被调(壳的 advSyncHotbar: render/refresh 任一)');
    assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('吃掉')), '吃货 toast(dev 降噪: TTS 静默 toast 保留)');
    assert.strictEqual(api.getBlock(46, G + 1, 58), 0, '吃吞点击: 不落放置');
  } finally {
    ShowroomMode.hotbar.render = origRender;
    ShowroomMode.hotbar.refresh = origRefresh;
  }
  ShowroomMode.pEnt().hp = 30; /* 满血 */
  ShowroomMode.onMouse(2, {x: 46, y: G, z: 58, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(inv.slots[0].n, 1, '满血不吃不扣(政策口径)');
  assert.strictEqual(ShowroomMode.pEnt().hp, 30, '满血血量不动');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('饱')),
      '满血提示(attempt 被吞, 仍不落放置)');
  assert.strictEqual(api.getBlock(46, G + 1, 58), 0, '满血 attempt 也不落放置');
});

test('体验馆: 金苹果 — 半血右键吃回满(full 旗标经 advEatPolicy)+扣 1', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('golden_apple', 2);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.pEnt().hp = 12;
  ShowroomMode.onMouse(2, {x: 46, y: G, z: 60, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(ShowroomMode.pEnt().hp, 30, '金苹果回满血(full → maxHp, 无饥饿系统折算)');
  assert.strictEqual(inv.slots[0].n, 1, '吃掉 1 个');
});

test('体验馆: 雪球投掷 — 右键掷出: 扣 1+弹池出膛+冷却内再掷被拒不扣; 零伤害红线(命中怪 dmg=0)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('snowball', 3);
  ShowroomMode.hotbar.select(0);
  /* 准星 fake: 眼高沿 -Z 平射(adventure-mode.test 同款; 只换 CameraRig,
     camera/raycastVoxel 缺席 → PlaceKit.aimHit 守卫返 null, 蓄力链不受扰) */
  const origRig = globalThis.CameraRig;
  globalThis.CameraRig = {aim: () => ({origin: {x: pos.x, y: pos.y + 1.6, z: pos.z},
    dir: {x: 0, y: 0, z: -1}})};
  mobsRig.list.push({type: 'zombie', pos: {x: pos.x, y: pos.y, z: pos.z - 2.2}, vel: {x: 0, z: 0},
    cfg: {h: 1.8, hitR: 0.55}, dead: false, gone: false,
    __nightHome: {x: pos.x, z: pos.z - 2.2}}); /* 面前 2.2 格假怪(家锚=自身: 完整 AI 索敌不拉走) */
  try {
    ShowroomMode.onMouse(2, {x: 47, y: G, z: 62, nx: 0, ny: 1, nz: 0}); /* 草地: 掷出吞点击 */
    assert.strictEqual(inv.slots[0].n, 2, '掷出消耗 1 颗');
    assert.strictEqual(ShowroomMode.snowballs.count(), 1, '弹池 1 发');
    ShowroomMode.onMouse(2, {x: 47, y: G, z: 62, nx: 0, ny: 1, nz: 0});
    assert.strictEqual(inv.slots[0].n, 2, '冷却内连点不扣(swingAction 与挥击同轨)');
    assert.strictEqual(ShowroomMode.snowballs.count(), 1, '冷却内不出膛');
    /* 弹道步进至命中: 零伤害红线 — update 喂弹池的行为面同证 */
    for (let i = 0; i < 90 && !mobsRig.hits.length; i++) ShowroomMode.update(1 / 60);
    assert.strictEqual(mobsRig.hits.length, 1, '雪球飞到怪(update 喂弹道)');
    assert.strictEqual(mobsRig.hits[0].dmg, 0, '零伤害红线: 雪球永不扣血');
    assert.strictEqual(ShowroomMode.snowballs.count(), 0, '命中出池');
  } finally {
    globalThis.CameraRig = origRig;
    mobsRig.list.length = 0;
    mobsRig.hits.length = 0;
  }
});

test('体验馆: 手持非食物/非雪球右键 — 照旧落放置链(使用链不吞点击)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('dirt', 2);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 47, y: G, z: 64, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(api.getBlock(47, G + 1, 64), 2, '泥土照常放置(放置链)');
  assert.strictEqual(inv.slots[0].n, 1, '扣 1(放置链口径)');
  assert.strictEqual(ShowroomMode.snowballs.count(), 0, '没有雪球出膛');
});

test('体验馆: cleanup 复位 — 雪球弹池清空 + 重进满血(壳清场纪律)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('snowball', 3);
  ShowroomMode.hotbar.select(0);
  const origRig = globalThis.CameraRig;
  globalThis.CameraRig = {aim: () => ({origin: {x: pos.x, y: pos.y + 1.6, z: pos.z},
    dir: {x: 0, y: 0, z: -1}})};
  ShowroomMode.onMouse(2, {x: 46, y: G, z: 62, nx: 0, ny: 1, nz: 0}); /* 掷出一发 */
  globalThis.CameraRig = origRig;
  assert.strictEqual(ShowroomMode.snowballs.count(), 1, '弹池在位(复位前提)');
  ShowroomMode.pEnt().hp = 7; /* 破坏现场: 残血 */
  ShowroomMode.cleanup();
  assert.strictEqual(ShowroomMode.snowballs.count(), 0, '弹池清空(壳 cleanup, 不渗漏下一模式)');
  freshEnter(); /* 重进: dev 档满血重铸 */
  assert.strictEqual(ShowroomMode.snowballs.count(), 0, '重进弹池仍空');
  assert.strictEqual(ShowroomMode.pEnt().hp, ShowroomMode.pEnt().maxHp, '重进满血(篡改档 hp=30)');
});

/* ============ ⑬ 昼夜+夜怪+床睡觉(dev 政策下的统一壳) ============ */

test('体验馆: 入夜上沿铺怪 — 固定点位铺 3 只全带夜怪标记+家锚; 夜内不加铺; 黎明清场共用壳实现', () => {
  freshEnter();
  ShowroomMode.update(0.05); /* 白天: 馆内无夜怪(巢穴怪/牧场动物另计) */
  assert.strictEqual(nightMobList().length, 0, '白天无夜怪(入夜才有)');
  eng.dayTime = 13000; /* 入夜上沿(NIGHT_A) */
  ShowroomMode.update(0.05);
  const laid = nightMobList();
  assert.strictEqual(laid.length, 3, '固定点位各铺 1 只(dev 铺法注入政策缝)');
  assert.ok(laid.every((m) => m.__nightMob === true),
      '全带 __nightMob 标记(与壳的环带版同一口径, 清场唯一依据)');
  assert.ok(laid.every((m) => m.__nightHome), '全带家锚=铺点(完整 AI 收队不流浪)');
  const byPos = laid.map((m) => SHOWROOM.nightMobs.find((p) => p.x === Math.floor(m.pos.x)));
  assert.ok(byPos.every(Boolean), '铺怪点位=SHOWROOM.nightMobs(布局常量唯一语义源)');
  assert.ok(laid.every((m) => Math.hypot(m.pos.x - 77.5, m.pos.z - 73.5) > 8),
      '铺怪点离床心 > ADV_BED_MOB_R(睡觉判定不被自家怪长期堵死)');
  ShowroomMode.update(0.05); /* 夜内第二拍 */
  assert.strictEqual(nightMobList().length, 3, '跨沿只铺一次(边沿制, 非节拍环带)');
  eng.dayTime = 23600; /* 过黎明沿(advDawnSweep ≈23517 翻真) */
  ShowroomMode.update(0.05);
  assert.ok(nightMobList().every((m) => m.gone), '黎明上沿温和清场(壳的 advSweepNightMobs 唯一实现)');
});

test('体验馆: 清场只收标记怪 — 巢穴怪/牧场动物/脚本怪不动(与壳同源口径)', () => {
  freshEnter();
  const dayMobs = mobsRig.list.slice(); /* 巢穴怪+牧场动物(壳播种, 无标记) */
  const stray = {type: 'zombie', pos: {x: 84, y: G + 1, z: 60}, dead: false, gone: false,
    attackCd: 0, attackT: 0, cfg: Object.assign({}, SR_MOB_CFG)};
  mobsRig.list.push(stray); /* 未标记怪(脚本怪同位) */
  eng.dayTime = 13000;
  ShowroomMode.update(0.05); /* 铺 3 只夜怪 */
  assert.strictEqual(nightMobList().length, 3, '夜怪 3 只');
  eng.dayTime = 23600; /* 回白天 */
  ShowroomMode.update(0.05);
  assert.ok(nightMobList().every((m) => m.gone), '夜怪全收');
  assert.ok(!stray.gone, '未标记怪不动(只收标记怪)');
  assert.ok(dayMobs.every((m) => !m.gone), '巢穴怪/牧场动物不动(与昼夜解耦口径)');
});

test('体验馆: 睡觉三分支(时钟改版) — 白天开拨盘/床边 8 格内有怪拒/怪远开拨盘+确认入睡', () => {
  freshEnter();
  const bed = {x: 77, y: G + 1, z: 73}; /* 床(建场真件) */
  eng.dayTime = 6000; /* 正午 */
  ShowroomMode.onMouse(2, bed);
  assert.strictEqual(ShowroomMode.sleepClock.on, true, '白天点床开拨盘(夜窗已撤销, 自选时刻)');
  assert.strictEqual(ShowroomMode.sleep.on, false, '未确认不开转场');
  ShowroomMode.sleepClock.on = false; /* 手动复位, 不渗入后续分支 */
  A.ADV.panelOpen = false; /* 拨盘的面板门卫一并复位(否则 onMouse 顶层吞点击) */
  eng.dayTime = 20000; /* 深夜 */
  mobsRig.list.push({type: 'zombie', pos: {x: 79.5, y: G + 1, z: 73.5}, dead: false, gone: false,
    attackCd: 0, attackT: 0, cfg: Object.assign({}, SR_MOB_CFG)}); /* 床边 2 格 */
  calls.length = 0;
  ShowroomMode.onMouse(2, bed);
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('附近有怪物')),
      '床边有怪拒睡 toast');
  assert.strictEqual(ShowroomMode.sleepClock.on, false, '有怪连拨盘都不开(怪圈保留)');
  assert.strictEqual(ShowroomMode.sleep.on, false, '不开转场');
  mobsRig.list.length = 0; /* 怪远(清场) */
  calls.length = 0;
  ShowroomMode.onMouse(2, bed);
  assert.strictEqual(ShowroomMode.sleepClock.on, true, '夜+床边无怪: 开拨盘');
  ShowroomMode.sleepConfirm(); /* 「睡觉」确认 → 开转场(拨盘缺省清晨) */
  assert.strictEqual(ShowroomMode.sleep.on, true, '确认后开转场');
  ShowroomMode.cleanup(); /* 收场复位(测试隔离) */
});

test('体验馆: 睡着转场 — 唤醒沿恰一次: 跳清晨+清夜怪+不设床边出生点(D5 拍板①)+遮罩归零', () => {
  /* 纯函数面: 全程步进 wake 恰一次(签名冻结直用的行为锁) */
  let wakes = 0; let t = 0;
  while (t < 5) {
    const s = advSleepStep(t, 0.05);
    if (s.wake) wakes++;
    t = s.t;
  }
  assert.strictEqual(wakes, 1, '唤醒沿恰发一次(大步跨沿也只一次)');
  /* 行为面: 点床入睡 → 推过唤醒沿 → 跳清晨+清夜怪+出生点不动 */
  freshEnter();
  const spawnRef = A.ADV.spawn; /* 出生点账本引用(D5: 睡醒不设床边) */
  eng.dayTime = 13000;
  ShowroomMode.update(0.05); /* 铺夜怪(清场前提) */
  const nightMobs = nightMobList();
  assert.strictEqual(nightMobs.length, 3);
  calls.length = 0;
  ShowroomMode.onMouse(2, {x: 77, y: G + 1, z: 73}); /* 点床(使用先于挖放) → 开拨盘 */
  assert.strictEqual(ShowroomMode.sleepClock.on, true, '点床开拨盘(时钟改版)');
  ShowroomMode.sleepConfirm(); /* 确认睡觉(拨盘缺省拨到清晨 tick 0) */
  assert.strictEqual(ShowroomMode.sleepClock.on, false, '确认后拨盘收起');
  assert.strictEqual(ShowroomMode.sleep.on, true, '转场开启');
  for (let i = 0; i < 74; i++) ShowroomMode.update(0.05); /* +3.7s: 过唤醒沿(3.5s) */
  assert.strictEqual(eng.dayTime, 0, '唤醒沿跳清晨(dayTime=0)');
  assert.ok(nightMobs.every((m) => m.gone), '唤醒清夜怪(与黎明清场同缝, 幂等)');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('睡饱啦')), '睡饱 toast');
  assert.strictEqual(A.ADV.spawn, spawnRef, '出生点账本不动(sleepWakeSetsSpawn=false, 床边无出生点)');
  for (let i = 0; i < 30; i++) ShowroomMode.update(0.05); /* 走完渐亮(总 5s) */
  assert.strictEqual(ShowroomMode.sleep.on, false, '转场结束');
  assert.strictEqual(+globalThis.document.getElementById('fade').style.opacity, 0,
      '渐亮收尾遮罩归零');
});

test('体验馆: 睡觉中 cleanup — 遮罩归零还 CSS transition/转场复位(切模式不渗漏 #fade)', () => {
  freshEnter();
  eng.dayTime = 20000;
  ShowroomMode.onMouse(2, {x: 77, y: G + 1, z: 73});
  ShowroomMode.sleepConfirm(); /* 点床开拨盘 → 确认入睡(时钟改版两步) */
  assert.strictEqual(ShowroomMode.sleep.on, true, '转场开启');
  ShowroomMode.update(0.5); /* 渐黑中 */
  const fade = globalThis.document.getElementById('fade');
  assert.ok(+fade.style.opacity > 0, '遮罩在渐黑(复位前提)');
  assert.strictEqual(fade.style.transition, 'none', '遮罩直驱期 CSS transition 被接管');
  ShowroomMode.cleanup();
  assert.strictEqual(ShowroomMode.sleep.on, false, 'cleanup 复位转场(中断不触发唤醒沿)');
  assert.strictEqual(+fade.style.opacity, 0, '遮罩归零');
  assert.strictEqual(fade.style.transition, '', 'CSS transition 还原(不渗入其他模式)');
});

test('体验馆: 左键挥击 — 准星锥内怪命中扣血(advSwingDmg 面)+本击归战斗不落挖', () => {
  freshEnter();
  mobsRig.list.push({type: 'zombie', pos: {x: pos.x, y: pos.y, z: pos.z - 2}, dead: false, gone: false,
    attackCd: 0, attackT: 0, cfg: Object.assign({}, SR_MOB_CFG)}); /* 正前方 2 格(yaw 0 朝 -Z) */
  ShowroomMode.onMouse(0, {x: 46, y: G, z: 55}); /* 准星指草地 */
  assert.strictEqual(mobsRig.hits.length, 1, '挥击命中怪');
  assert.strictEqual(mobsRig.hits[0].dmg, advSwingDmg(''), '空手伤害=ADV_FIST_DMG(伤害函数直用)');
  assert.strictEqual(ShowroomMode.mine.down, false, '本击归战斗: 不进蓄力(壳同款占位)');
  assert.strictEqual(api.getBlock(46, G + 1, 55), 0, '草地无损伤');
});

test('体验馆: 左键挥击·工具 — 手持木剑伤害按 D9 表+命中扣耐久(与挖掘磨损同一缝)', () => {
  freshEnter();
  mobsRig.hits.length = 0; /* 上一用例的命中记账清零(本用例从零数) */
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('sword_wood', 1);
  ShowroomMode.hotbar.select(0);
  mobsRig.list.push({type: 'zombie', pos: {x: pos.x, y: pos.y, z: pos.z - 2}, dead: false, gone: false,
    attackCd: 0, attackT: 0, cfg: Object.assign({}, SR_MOB_CFG)});
  ShowroomMode.onMouse(0, {x: 46, y: G, z: 55});
  assert.strictEqual(mobsRig.hits.length, 1, '挥击命中怪');
  assert.strictEqual(mobsRig.hits[0].dmg, advSwingDmg('sword_wood'), '工具伤害随 D9 表(同份纯函数)');
  assert.strictEqual(inv.slots[0].dur, api.toolOf('sword_wood').dur - 1,
      '命中扣 1 耐久(onWear 与挖掘 wear 同缝)');
});

test('体验馆: 完整 AI — 索敌半径内朝玩家走+贴身挥击: pEnt.hp 下降(吃链激活前提)', () => {
  freshEnter();
  const m = {type: 'zombie', pos: {x: pos.x, y: pos.y, z: pos.z - 8}, dead: false, gone: false,
    attackCd: 0, attackT: 0, cfg: Object.assign({}, SR_MOB_CFG),
    __nightHome: {x: pos.x, z: pos.z - 8}}; /* 8 格: 索敌 12 内、触及外; 家锚=自身(收队不拉走) */
  mobsRig.list.push(m);
  ShowroomMode.update(0.25);
  const d0 = Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z);
  assert.ok(d0 < 8 && d0 > 2.1, '索敌逼近(初始 8 → ' + d0.toFixed(2) + ', 未及触及)');
  for (let i = 0; i < 200 && ShowroomMode.pEnt().hp === 30; i++) ShowroomMode.update(0.05);
  assert.ok(ShowroomMode.pEnt().hp < 30, '贴身挥击: 玩家掉血(Mobs.hit → 真实受击状态机)');
  assert.strictEqual(ShowroomMode.pEnt().hp, 25, '单击伤害=advMobDmg(zombie 5, 封顶面)');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'hurt'), '受击提醒(CombatKit.mkHurtAlarm 内置音, 既有口径)');
});

test('体验馆: 原地满血复活 — hp 到 0: 满血重置+夜怪清场+原地复活(dev 政策 death=inPlace)', () => {
  freshEnter();
  eng.dayTime = 13000;
  ShowroomMode.update(0.05); /* 铺夜怪 */
  const nightMobs = nightMobList();
  assert.strictEqual(nightMobs.length, 3);
  ShowroomMode.pEnt().hp = 1; /* 直驱濒死 */
  const killer = {type: 'zombie', pos: {x: pos.x, y: pos.y, z: pos.z - 1.5}, dead: false, gone: false,
    attackCd: 0, attackT: 0, cfg: Object.assign({}, SR_MOB_CFG),
    __nightHome: {x: pos.x, z: pos.z - 1.5}}; /* 未标记(脚本怪同位), 家锚=自身保索敌 */
  mobsRig.list.push(killer);
  const px = pos.x; const pz = pos.z;
  ShowroomMode.update(0.05); /* 贴身一击 5 伤: hp≤0 → freshDead → 原地复活 */
  assert.strictEqual(ShowroomMode.pEnt().hp, ShowroomMode.pEnt().maxHp, '满血重置');
  assert.strictEqual(ShowroomMode.pEnt().dead, false, 'dead 复位(复活不变量)');
  assert.strictEqual(pos.x, px, '原地复活(不切图不落出生点, 保调试现场)');
  assert.strictEqual(pos.z, pz, '原地复活 z');
  assert.ok(nightMobs.every((m2) => m2.gone), '夜怪清场(壳内 inPlace 分支)');
  assert.ok(!killer.gone, '未标记的凶手怪不被清场(只收标记怪)');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('满血')), '提示 toast');
});

test('体验馆: 击杀掉落 — Mobs.onDeath → advDeathDrops 掷骰 → Drops.spawn(拾取缝成环)', () => {
  freshEnter();
  assert.strictEqual(mobsRig.deathCbs.length, 1, 'init 恰挂一个击杀回调(壳 init 重挂)');
  const m = {type: 'zombie', pos: {x: 10, y: G + 1, z: 10}, cfg: Object.assign({}, SR_MOB_CFG),
    dead: true, gone: false};
  dropCalls.length = 0;
  mobsRig.deathCbs[0](m); /* 引擎在 hit 判死瞬间回调; 桩内手动触发(同拍行为) */
  assert.ok(dropCalls.length >= 1, '掷骰保底必得: 至少掉 1 条');
  assert.ok(dropCalls.every((d) => d[2] === 10 && d[4] === 10), '落点=尸体上方(m.pos 同缝)');
});

/* ============ ⑭ U4 门面与换装生命周期 ============ */

test('体验馆 U4: HUD 门面包层 — 首行体验馆徽标, 其余行透传壳的 HUD(mkMode 节流链)', () => {
  freshEnter();
  const hit = {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z};
  ShowroomMode.updateHud(hit); /* mkMode 包装的 HUD 链(性能桩恒 0 → 首调必过) */
  const html = elCache['hud'].innerHTML;
  assert.ok(html.startsWith('🧪'), '首行体验馆徽标行: ' + html.split('<br>')[0]);
  const shellHtml = AdventureMode.adv.advHudLines(hit).join('<br>');
  assert.ok(html.endsWith(shellHtml), '其余行=壳的 HUD 透传(图名/生命/位置/时段/怪物/背包/任务)');
  assert.ok(html.includes('任务'), '任务行在场(篡改档下显示终章称号)');
});

test('体验馆 U4: onMenu dev 特化 — 面板开着收 overlay 不回菜单; 全关回主页(v2 口径)', () => {
  freshEnter();
  ShowroomMode.onKey('Tab'); /* 开合成面板 */
  assert.ok(ShowroomMode.sr.craft.isOpen(), '面板开着(前提)');
  overlay.style.display = 'flex'; /* 模拟指针锁遮罩弹起 */
  calls.length = 0;
  ShowroomMode.onMenu();
  assert.strictEqual(overlay.style.display, 'none', '面板开着: 收 overlay 不回菜单');
  assert.ok(!calls.some((c) => c[0] === 'switchMode'), '不切模式');
  ShowroomMode.onKey('Tab'); /* 收面板 */
  assert.ok(!ShowroomMode.sr.craft.isOpen(), '面板全关(前提)');
  calls.length = 0;
  ShowroomMode.onMenu();
  assert.ok(calls.some((c) => c[0] === 'switchMode' && c[1] === 'arena'), '恢复菜单背景默认模式(v2 口径)');
  assert.ok(calls.some((c) => c[0] === 'showPage' && c[1] === 'main'), '回主页(体验馆无菜单页)');
  freshEnter(); /* 恢复 showroom 态(后续用例前提) */
});

test('体验馆 U4: 媒体降噪 — TTS/音效经政策缝全静默 · toast 保留(v2 口径)', () => {
  freshEnter();
  assert.strictEqual(spoken.length, 0, '进场欢迎 TTS 静默(壳的 advSpeak → dev noop)');
  assert.ok(calls.some((c) => c[0] === 'toast'), '进场 toast 保留(壳的 advToast → showToast)');
  assert.strictEqual(calls.filter((c) => c[0] === 'sfx').length, 0,
      '壳内音效调用点全静默(advSfx → dev noop; kit 内置音不计——既有口径)');
});

test('体验馆 U4: onKey 单跳 — KeyB 经门面只触发一次 uiPause(委托不双跳)', () => {
  freshEnter();
  ShowroomMode.onKey('KeyB');
  assert.strictEqual(calls.filter((c) => c[0] === 'uiPause').length, 1,
      'mkMode 两层包装各自吃掉 KeyB, 委托后恰好一次');
});

test('体验馆 U4: 换装生命周期 — dev 会话真档零写入 · cleanup 还原缺省 · 冒险壳照常读真档', () => {
  freshEnter();
  assert.notStrictEqual(SRV.store, SRV.storeDefault, 'dev store 在位(init 装配)');
  assert.strictEqual(SRV.profile.death, 'inPlace', 'dev 政策在位(death=inPlace)');
  assert.strictEqual(mem.size, 0, '装配后真档介质零写入');
  /* dev 会话内的全套写路径: 放置(mark) · 爆炸(mark+touch) · 节流泵(tick) · 存取账户 */
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 81, y: G, z: 75, nx: 0, ny: 1, nz: 0}); /* 放置(mark) */
  ShowroomMode.onMouse(0, {x: 81, y: G + 1, z: 75}); /* 点燃 */
  ShowroomMode.update(0.05);
  ShowroomMode.update(1.6); /* 爆炸(mark/touch/tick 全链) */
  ShowroomMode.update(6.1); /* 推过节流窗(真档会 flush, dev 落 noop) */
  A.advChestDeposit(0); /* 账户存取(saveChest noop) */
  assert.strictEqual(mem.size, 0, 'dev 会话全程真档介质零写入(dev store 丢弃一切)');
  ShowroomMode.cleanup();
  assert.strictEqual(SRV.store, SRV.storeDefault, 'cleanup 后存档缝还原缺省');
  assert.strictEqual(SRV.profile, SRV.profileDefault, 'cleanup 后政策缝还原缺省');
  assert.strictEqual(mem.size, 0, '退场兜底落盘全落进 noop(退出无痕)');
  /* 还原后冒险壳照常工作: 真档读档(空介质→defaults)·基座建场·真盘可写 */
  assert.doesNotThrow(() => AdventureMode.init(), '还原后壳 init 可用(真档读档)');
  assert.ok(calls.some((c) => c[0] === 'spawn' && c[1] === ADV_SPAWN.x && c[3] === ADV_SPAWN.z),
      '真档出生=ADV_SPAWN(门口两步, 非篡改档房内)');
  assert.strictEqual(api.getBlock(55, G, 55) !== 6, true, '真档世界=home 基座(展馆不在)');
  assert.strictEqual(api.getBlock(90, G, 80), 4, '真档世界建场完好(门阵广场圆石, 避开门框平面)');
  AdventureMode.cleanup(); /* 真档退场: flush 走真链路落盘——与 dev 会话零写入对照 */
  assert.ok(mem.size >= 1, '真档会话落盘在位(还原后写链路健康, dev 零写入非断管)');
});

/* ============ ⑮ U3 展馆 edits 账本派生(世界即存档, ADR 0005) — 世界仿真类(原样保留) ============
    布局常量 SHOWROOM 在 js/showroom-core.js(语义源唯一化); 世界清场面/水位写
    缝/世界格数组从 vm 引擎件取出, 供仿真 diff 与重放同构断言直用。本段用例
    会整场清掉并重建世界(home 基座), 全部排在既有用例之后, 互不渗漏。 */
globalThis.mkWorldJournal = require('../js/world-journal-core.js').mkWorldJournal; /* 已在, 保险 */
Object.assign(globalThis, vm.runInContext('({WORLD_H, setFluidLv, worldCells})', eng));

test('体验馆 U3: 布局常量迁移 — 模式文件不再声明 SHOWROOM, 供给核心持有(经全局名引用, 行为不变)', () => {
  assert.ok(!/^const SHOWROOM = \{/m.test(showroomSrc), '模式文件不再声明常量块(唯一允许改动=删原块)');
  assert.ok(coreSrc.includes('const SHOWROOM = {'), '供给核心持有常量(语义源)');
  assert.match(showroomSrc, /SHOWROOM\./, '模式文件经全局名继续引用(nightMobs 铺法)');
  assert.strictEqual(globalThis.SHOWROOM, ShowroomCore.SHOWROOM, '全局名=供给核心常量(同引用)');
});

test('体验馆 U3: 展馆账本派生确定性 — 两次仿真逐字节一致 · 缓存面同实例 · 条目落整地圈+全裸值', () => {
  const a = ShowroomCore.showroomWorldEditsCompute();
  const b = ShowroomCore.showroomWorldEditsCompute();
  assert.ok(a.length > 0, '账本非空(整地+结构条目在场)');
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b), '两次派生逐字节一致(基座建场+绘制双零随机)');
  assert.strictEqual(ShowroomCore.showroomWorldEdits(), ShowroomCore.showroomWorldEdits(),
      '缓存面: 惰性一次算定(同实例)');
  assert.deepStrictEqual(ShowroomCore.showroomWorldEdits(), a, '缓存=计算结果');
  const L = ShowroomCore.showroomDevLayout();
  const R = ShowroomCore.showroomFlatRegion(L);
  for (const e of a) {
    const p = e[0].split(',');
    const x = +p[0];
    const y = +p[1];
    const z = +p[2];
    assert.ok(x >= R.x1 && x <= R.x2 && z >= R.z1 && z <= R.z2,
        '条目落 footprint+整地圈: ' + e[0]);
    assert.ok(Number.isInteger(y) && y >= 0 && y < globalThis.WORLD_H, 'y 在世界高内: ' + e[0]);
    assert.ok(typeof e[1] === 'number' && Number.isInteger(e[1]) && e[1] >= 0,
        '全裸值(无 {id,lv} 流体格): ' + e[0]);
  }
});

test('体验馆 U3: 重放同构 — 基座+账本重放 = 目标态绘制, 全世界逐格一致(迁移等价性的可执行表达)', () => {
  const entries = ShowroomCore.showroomWorldEditsCompute();
  /* 重放态: home 基座 → 世界改动日志同一条重放链(裸值→方块一笔) */
  globalThis.world.clear();
  advBuildWorld();
  globalThis.mkWorldJournal({load: () => null, save: () => {}}, {edits: new Map(entries)})
      .replay({block: setBlockRaw, fluid: globalThis.setFluidLv});
  const replayed = globalThis.worldCells.slice();
  /* 目标态: home 基座 → 展馆绘制(v2 语义: 整地一圈+展厅+展台+地下室) */
  globalThis.world.clear();
  advBuildWorld();
  ShowroomCore.showroomPaintSite(ShowroomCore.showroomDevLayout());
  const target = globalThis.worldCells.slice();
  assert.ok(Buffer.from(replayed).equals(Buffer.from(target)),
      '重放后=目标态(逐格一致, 世界即存档: 进场=建场+重放同一份账本)');
});

/* 重放态世界装配 helper: 基座+账本重放(结构覆盖/净空/实心断言共用) */
function srReplayWorld() {
  globalThis.world.clear();
  advBuildWorld();
  globalThis.mkWorldJournal({load: () => null, save: () => {}},
      {edits: new Map(ShowroomCore.showroomWorldEdits())})
      .replay({block: setBlockRaw, fluid: globalThis.setFluidLv});
}

test('体验馆 U3: 重放后结构全覆盖 — 墙/顶/门/窗/站点件/床/仓库箱/展台展品/火把/地下室(家营地平 y24)', () => {
  srReplayWorld();
  const g = ADV_GROUND;
  assert.strictEqual(api.getBlock(55, g, 55), 6, '木板地板');
  assert.strictEqual(api.getBlock(48, g + 2, 44), 6, '木墙(西北角 y26)');
  assert.strictEqual(api.getBlock(63, g + 5, 60), 6, '木板顶(y29)');
  assert.strictEqual(api.getBlock(63, g + 1, 75), api.B_DOOR, '南门(下扇)');
  assert.strictEqual(api.getBlock(63, g + 2, 75), api.B_DOOR_TOP, '南门(上扇)');
  assert.strictEqual(api.getBlock(54, g + 2, 44), api.B_GLASS_PANE, '北墙窗');
  assert.strictEqual(api.getBlock(48, g + 2, 60), api.B_GLASS_PANE, '西墙窗');
  /* 站点件: 即测炉+灶台双炉+工作台×2+床 */
  assert.strictEqual(api.getBlock(64, g + 1, 62), api.B_FURNACE, '出生圈内即测熔炉');
  assert.strictEqual(api.getBlock(72, g + 1, 46), api.B_FURNACE, '灶台角炉 1');
  assert.strictEqual(api.getBlock(74, g + 1, 46), api.B_FURNACE, '灶台角炉 2');
  assert.strictEqual(api.getBlock(52, g + 1, 46), api.B_CRAFT, '工作台 1');
  assert.strictEqual(api.getBlock(54, g + 1, 46), api.B_CRAFT, '工作台 2');
  assert.strictEqual(api.getBlock(77, g + 1, 73), api.B_BED, '床');
  /* 仓库箱排: 箱方块数=派生箱数(≤锚位上限) */
  const crates = ShowroomCore.showroomCrateStock();
  for (let i = 0; i < Math.min(crates.length, SHOWROOM.crateMax); i++) {
    assert.strictEqual(api.getBlock(50, g + 1, 50 + i * 2), api.B_CHEST,
        '第 ' + i + ' 箱(' + crates[i].title + ')在场');
  }
  /* 展台展品: 派生方块清单(U5 起 need 旗标块在派生层排除)的方块都在台面(y g+2 扫描区) */
  const found = new Set();
  for (let x = 54; x <= 72; x++) {
    for (let z = 51; z <= 66; z++) {
      const b = api.getBlock(x, g + 2, z);
      if (b) found.add(b);
    }
  }
  for (const bid of ShowroomCore.showroomDisplayBlocks()) {
    assert.ok(found.has(bid), '展品在台面: ' + bid);
  }
  /* 火把插满: 室内(y25..28)+地下室(y20)计数 */
  let houseTorch = 0;
  for (let x = 48; x <= 79; x++) {
    for (let z = 44; z <= 75; z++) {
      for (let y = g + 1; y <= g + 4; y++) {
        if (api.getBlock(x, y, z) === api.B_TORCH) houseTorch++;
      }
    }
  }
  assert.ok(houseTorch >= 10, '室内火把成排: ' + houseTorch);
  let baseTorch = 0;
  for (let x = 50; x <= 77; x++) {
    for (let z = 46; z <= 73; z++) {
      if (api.getBlock(x, g - 4, z) === api.B_TORCH) baseTorch++;
    }
  }
  assert.ok(baseTorch >= 8, '地下室火把成排: ' + baseTorch);
  /* 地下室: 石壳/内腔净空/矿样墙/楼梯井逐级通透(v2 断言的 y+12 平移版) */
  assert.strictEqual(api.getBlock(63, g - 5, 60), 4, '内腔地面(圆石 y19)');
  assert.strictEqual(api.getBlock(63, g - 3, 60), 0, '内腔净空(y21)');
  assert.strictEqual(api.getBlock(63, g - 1, 60), 4, '腔顶石壳(y23, 上承房内地板)');
  assert.strictEqual(api.getBlock(52, g - 4, 47), api.B_COAL_ORE, '矿样墙: 煤');
  assert.strictEqual(api.getBlock(55, g - 4, 47), api.B_DIAMOND_ORE, '矿样墙: 钻');
  assert.strictEqual(api.getBlock(56, g - 4, 47), api.B_CLAY, '矿样墙: 黏土');
  for (let i = 0; i <= 4; i++) {
    const z = 71 - i;
    const standY = g - i;
    for (let y = standY; y <= g; y++) {
      assert.strictEqual(api.getBlock(75, y, z), 0, '楼梯井通透: (75,' + y + ',' + z + ')');
    }
    assert.strictEqual(api.getBlock(75, standY - 1, z), 4, '踏步在位: y=' + (standY - 1));
  }
});

test('体验馆 U3: 重放后立面净空+地平实心 — 地平以上除结构外全空 · 地平连圈实心 · 屋南小径完好', () => {
  srReplayWorld();
  const g = ADV_GROUND;
  const h = SHOWROOM.house;
  const R = ShowroomCore.showroomFlatRegion(ShowroomCore.showroomDevLayout());
  /* 立面净空: footprint 顶板(y29)以上全空; 圈(footprint 外的整地环)地平以上全空 */
  for (let x = h.x1; x <= h.x2; x++) {
    for (let z = h.z1; z <= h.z2; z++) {
      for (let y = g + 6; y < globalThis.WORLD_H; y++) {
        assert.strictEqual(api.getBlock(x, y, z), 0, '顶上净空: (' + x + ',' + y + ',' + z + ')');
      }
    }
  }
  for (let x = R.x1; x <= R.x2; x++) {
    for (let z = R.z1; z <= R.z2; z++) {
      if (x >= h.x1 && x <= h.x2 && z >= h.z1 && z <= h.z2) continue; /* footprint 另断言 */
      for (let y = g + 1; y < globalThis.WORLD_H; y++) {
        assert.strictEqual(api.getBlock(x, y, z), 0, '整地环净空: (' + x + ',' + y + ',' + z + ')');
      }
    }
  }
  /* 地平实心: 圈内每列地平非空(整地补齐凹陷+房地板); 楼梯井开口除外——
      房内下地下室的入口(v2 同款: 井道逐级掏穿房内地板, z67..71 列顶层开天) */
  const sw = SHOWROOM.stairs;
  const inStairWell = (x, z) => x >= sw.x1 && x <= sw.x2 && z >= sw.z1 && z <= sw.z2;
  for (let x = R.x1; x <= R.x2; x++) {
    for (let z = R.z1; z <= R.z2; z++) {
      if (inStairWell(x, z)) continue;
      assert.ok(api.getBlock(x, g, z) !== 0, '地平实心: (' + x + ',' + g + ',' + z + ')');
    }
  }
  /* 屋南小径(圈外)完好: 南 pad=0 一格不铲, 门口↔广场动线不断 */
  let pathCobble = 0;
  for (let x = 62; x <= 77; x++) {
    for (const z of [76, 77]) {
      if ((x + z) % 2 === 0 && api.getBlock(x, g, z) === 4) pathCobble++;
    }
  }
  assert.ok(pathCobble >= 12, '门口段小径圆石在位: ' + pathCobble);
});

test('体验馆 U3: footprint 选址核查 — 不压水面 · 硬结构清单不相交 · 压界恰为登记三处', () => {
  globalThis.world.clear();
  advBuildWorld(); /* 纯基座世界(结构清单的几何判定+登记压界的逐格清点) */
  const h = SHOWROOM.house;
  const R = ShowroomCore.showroomFlatRegion(ShowroomCore.showroomDevLayout());
  /* 不压水面/沙岸: 圈内无流体无沙(重放后湖水不会经流体泵渗入整地区) */
  for (let x = R.x1; x <= R.x2; x++) {
    for (let z = R.z1; z <= R.z2; z++) {
      for (let y = 0; y < globalThis.WORLD_H; y++) {
        const b = api.BLOCKS[api.getBlock(x, y, z)];
        assert.ok(!b || !b.fluid, '圈内无流体: (' + x + ',' + y + ',' + z + ')');
      }
      assert.notStrictEqual(api.getBlock(x, ADV_GROUND, z), 8, '圈地平无沙岸: (' + x + ',' + z + ')');
    }
  }
  /* 硬结构不相交(footprint vs 几何清单, 常量全部来自冒险纯核心) */
  const away = (cx, cz, r, why) => {
    const nx = Math.max(h.x1, Math.min(cx, h.x2));
    const nz = Math.max(h.z1, Math.min(cz, h.z2));
    assert.ok(Math.hypot(nx - cx, nz - cz) > r, why + ' 不相交');
  };
  away(ADV_LAKE.cx, ADV_LAKE.cz, ADV_LAKE.r + 1, '湖(含沙岸)');
  for (const p of ADV_PITS) away(p.cx, p.cz, p.r, '矿坑漏斗(' + p.cx + ',' + p.cz + ')');
  away(ADV_TOWER.x, ADV_TOWER.z, 4, '望塔基座');
  away(ADV_STONES.cx, ADV_STONES.cz, ADV_STONES.r + 1, '石阵环');
  away(ADV_POND.cx, ADV_POND.cz, ADV_POND.r + 1, '南池(含水岸)');
  for (const n of ADV_NESTS) away(n.x, n.z, 2, '巢丘(' + n.x + ',' + n.z + ')');
  const noRect = (r, why) => {
    assert.ok(h.x2 < r.x1 || r.x2 < h.x1 || h.z2 < r.z1 || r.z2 < h.z1, why + ' 不相交');
  };
  noRect(ADV_HUT, '出生小屋');
  noRect(ADV_FARM, '农田(含水路)');
  noRect({x1: ADV_CAVE.x1 - 3, x2: ADV_CAVE.x2 + 3, z1: ADV_CAVE.zStart - 5, z2: ADV_CAVE.zEnd + 4},
      '山洞(洞口小丘+隧道+穴室)');
  for (const g of ADV_GATE_PLAZA.gates) {
    assert.ok(h.z2 < g.pz, '门面/塔列平面(z=' + g.pz + ')在 footprint 之外');
  }
  /* 登记压界三处(布局常量坐标被既有测试锁死, 压界如下登记——恰好这些, 漂移即红) */
  let paving = 0;
  for (let x = h.x1; x <= h.x2; x++) {
    for (let z = h.z1; z <= h.z2; z++) {
      if (api.getBlock(x, ADV_GROUND, z) === 4) paving++;
    }
  }
  assert.strictEqual(paving, 4, '压界①: 门阵广场铺装西北角恰 4 格(重放后覆上木地板)');
  let fence = 0;
  for (let x = h.x1; x <= 54; x++) {
    for (const y of [ADV_GROUND + 1, ADV_GROUND + 2]) {
      if (api.getBlock(x, y, 74) !== 0) fence++;
    }
  }
  assert.strictEqual(fence, 14, '压界②: 牧场围栏北线恰 7 柱×2 高=14 格(重放后清空, 房南墙代偿栏体)');
  let moundCols = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.hypot(dx, dz) > 2) continue;
      const x = ADV_NESTS[0].x + dx;
      const z = ADV_NESTS[0].z + dz;
      if (x >= R.x1 && x <= R.x2 && z >= R.z1 && z <= R.z2) moundCols++;
    }
  }
  assert.strictEqual(moundCols, 1, '压界③: 近巢丘(44,60)东缘恰 1 列(46,60)入整地圈(削平丘脚)');
  assert.ok(api.getBlock(46, ADV_GROUND + 1, 60) !== 0, '该列基座确有丘块(清点前提)');
});

test('体验馆 U3: 世界档 payload(真账本) — home 桶=派生条目 · 房内出生 · 数组桶可归一成 Map', () => {
  const store = ShowroomCore.mkShowroomStore();
  const p = store.load();
  assert.strictEqual(p.map, 'home', 'map=home');
  assert.deepStrictEqual(p.edits.home, ShowroomCore.showroomWorldEdits(), 'home 桶=展馆账本原条目');
  for (const k of ['desert', 'snow', 'swamp', 'nether']) {
    assert.deepStrictEqual(p.edits[k], [], k + ' 空桶');
  }
  const m = new Map(p.edits.home); /* 档→桶账本归一(读档侧 decode 同款吃法) */
  assert.strictEqual(m.size, p.edits.home.length, '条目键无重复(逐格最后写赢的账本面)');
  assert.ok(p.pos.x > SHOWROOM.house.x1 && p.pos.x < SHOWROOM.house.x2, '房内出生 x');
  assert.ok(p.pos.z > SHOWROOM.house.z1 && p.pos.z < SHOWROOM.house.z2, '房内出生 z');
  assert.strictEqual(p.pos.y, ADV_GROUND + 1, '出生 y=家营地平+1');
  assert.strictEqual(p.pos.yaw, SHOWROOM.spawn.yaw, '朝向随常量');
  assert.strictEqual(p.hp, 30, '满血');
  assert.strictEqual(p.dayTime, 0, '清晨起步');
  assert.deepStrictEqual(p.furnaces, [], '炉空');
  assert.deepStrictEqual(Object.keys(p.livestock).sort(),
      ['den', 'desert', 'home', 'nether', 'snow', 'swamp'], '死畜六桶空账(桶集随 ADV_DIMS 对齐, dimension-registry)');
});

test('体验馆 U3: dev store 丢弃语义 — 落盘面全 noop · mark 进内存账本 · 三档再读仍篡改', () => {
  const store = ShowroomCore.mkShowroomStore();
  const loaded = store.load(); /* 喂篡改 payload(journal 桶形不收养=消费方自装当前桶) */
  assert.ok(loaded && loaded.edits.home.length > 0, '世界档 payload 在位');
  assert.strictEqual(store.journal.edits.size, 0, 'journal 初始空账本(桶形不收养, init 换装当前桶)');
  store.mark('48,24,44', 6);
  assert.strictEqual(store.journal.edits.get('48,24,44'), 6, '记账进内存(切图换桶/重进重放的账本面)');
  assert.strictEqual(store.journal.dirty(), true, 'mark 后脏标在位');
  store.touch();
  store.flush();
  store.tick();
  store.pageHide();
  assert.strictEqual(store.journal.dirty(), true,
      '落盘面全 noop: 脏标不清(真档 flush 会清脏标)——丢弃式的可观察证据');
  assert.strictEqual(store.loadQuest().step, ADV_QUESTS.length, '任务档仍篡改(saveQuest 丢弃)');
  assert.strictEqual(store.loadChest().size, ADV_CHEST_SLOTS, '宝箱档仍篡改(saveChest 丢弃)');
  const inv = store.loadBag();
  const row = ShowroomCore.showroomPocket().rows[0];
  assert.strictEqual(api.count(inv, row.id), row.n, '背包装配重铸套餐首行');
});
