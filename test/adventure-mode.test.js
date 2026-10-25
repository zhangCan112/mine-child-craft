'use strict';
/* 探险模式 (js/modes/adventure.js) 单测 — node --test (零依赖)
   运行: node --test test/adventure-mode.test.js
   形态镜像 test/nether-mode.test.js: 引擎全局以 fake 注入(replace-don't-layer),
   但体素底座(config/voxel/scene-kit/items-core/inventory-core)用 vm 装真件——
   地形生成(矿带/密度/湖黏土/矿坑界内/重进复现)必须对着真散布函数断言,
   fake SceneKit 会把「确定性」断言变成同义反复。
   只测模式政策: 建场确定性 → 存档往返(edits 重放/背包序列化) → 死亡政策 → 面板开关。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 假 DOM(mode-kit 惰性渲染用) ---------- */
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
      el.children.length = 0;
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
  body: docBody,
};

/* ---------- 真引擎件: config + voxel + scene-kit + 四纯核心/库, 共享一个 vm 词法环境 ---------- */
const ROOT = path.join(__dirname, '..');
/* groundTop 桩: drops 壳段 restY 用(world.js 太重不装) */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/voxel.js', 'js/cascade-core.js', 'js/scene-kit.js',
  'js/items-core.js',
  'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, getFluidLv, setFluidLv, worldEvents, hashRand, blockKey, world, worldCells, SceneKit,
  BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H, IS_TOUCH, FLUID,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_GRASS_TUFT, B_SAPLING, B_TORCH, B_CHEST,
  ITEMS, isTool, toolOf, stackMax, mkStack, breakTime,
  mkInventory, add, count, remove, moveSlot, damageTool, serialize, deserialize, HOTBAR_SLOTS, INV_SLOTS,
  raycastVoxel, collidesAtPlayer, rollBlockDrop, rollDrops, MOB_DROPS, Drops,
  RECIPES, canCraft, craft, take, costEntry, FUEL, fuelUnits, smeltOf, B_TNT,
})`, eng);
Object.assign(globalThis, api); /* 模式文件经全局名消费这些真件(经典 script 词法环境) */
/* 掉落物实体库: vm 真件(壳段无 THREE/DOM 不建观感, 实体逻辑照跑), clear 记账以兼容既有断言 */
const RealDrops = api.Drops;
globalThis.Drops = {
  spawn: (...a) => RealDrops.spawn(...a),
  update: (...a) => RealDrops.update(...a),
  render: () => RealDrops.render(),
  onCollect: (cb) => RealDrops.onCollect(cb),
  list: () => RealDrops.list(),
  clear() {
    calls.push(['dropsClear']);
    RealDrops.clear();
  },
};
/* 单块编辑 seam: world.js 太重——真级联核心镜像 world.js 的装配(cascade-core
   在 vm 里加载, policy 用同一 mkPolicy 派生), 碎屑反馈归浏览器; 破坏返回级联
   清单(与真 editBlock 契约一致, 方块级联设计稿 D3) */
const engCascade = vm.runInContext('({core: CascadeCore, policy: CascadeCore.mkPolicy(BLOCKS)})', eng);
globalThis.editBlock = (x, y, z, id) => {
  const old = api.getBlock(x, y, z);
  api.setBlockRaw(x, y, z, id);
  calls.push(['edit', x, y, z, id]);
  return (id === 0 && old !== 0) ?
    engCascade.core.cascadeRemove(api.getBlock, api.setBlockRaw, x, y, z, old, engCascade.policy) : [];
};
/* 世界卫生清扫 seam(P14/D9): 镜像 world.js applySweep 的装配。Node v24 的
   vm context 对热循环不 JIT(实测 77~390× 慢), 全图扫描 ~80 万格不可行 →
   快照桥接: 世界数据拷到 Node realm, 用同一份 cascade-core(require)与
   同一 mkPolicy 派生在 Node 侧跑, 差异格回写走真 setBlockRaw(含 topCache
   失效; 干净世界零回写)。行为保真: 真核心代码+真旗标派生+真数据。 */
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
globalThis.sfx = (k) => calls.push(['sfx', k]);

/* ---------- 假应用层(调用期解析的全局名) ---------- */
const calls = [];
const spoken = [];
let touchList = null;
const mem = new Map(); /* 存储介质: SyncDB 槽底层(真 mkSaveSlot 包它) */
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
globalThis.loadScene = (fn) => {
  calls.push(['loadScene']);
  api.world.clear();
  fn();
}; /* 场景装填 seam: 清场+建场(收尾重建归渲染层, 行为断言不需要) */
globalThis.SpeechKit = {speak(s) {
  spoken.push(s);
}, cancel() {}};
globalThis.showToast = (s) => calls.push(['toast', s]);
globalThis.setTouchActions = (l) => {
  touchList = l;
};
globalThis.aimClick = (b) => calls.push(['aimClick', b]); /* 智能主动作(mkMainAct)的路由终点 */
globalThis.refreshTouchMain = (icon, label) => calls.push(['touchMain', icon, label]); /* 主动作键观感刷新 */
globalThis.showPage = (id) => calls.push(['showPage', id]);
globalThis.uiPause = () => calls.push(['uiPause']);
globalThis.iconOf = () => ''; /* 像素图标工坊未加载: 空串=跳过图标 */
globalThis.btnImg = () => ''; /* 按钮像素图标工坊未加载: 空串=面板 chrome 无图(不炸) */
globalThis.Avatar = {setItem(id) {
  calls.push(['setItem', id]);
}, swing() {
  calls.push(['swing']);
}, flash() {
  calls.push(['flash']);
}};
/* ---------- fake 怪物库/掉落物库(T14 战斗段): 窄面形状对齐真库 ----------
   行为断言全部走调用记录(spawned/hitLog/moveLog), 不伸手进模式内部;
   玩家受击走真实受击状态机(mob-core), 分支结果仍由 nextHit 脚本控制 */
const RealMobCore = require('../js/mob-core.js');
const mobsState = {spawned: [], deathCbs: []};
const dropsState = {spawned: [], cbs: []};
const hitLog = [];
const moveLog = [];
let listResult = [];
let nextHit = {hp: 10, dead: false, freshDead: false};
const ADV_MOB_CFG = {/* 四怪数值摘自 mob-registry.js MOB_TYPES(巢穴池, 行为断言所需最小集)
   + F4 农场四怪(牧场生成断言所需, passive 旗标照抄表) */
  zombie: {name: '僵尸', hp: 30, dmg: 5, speed: 2.3, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55},
  skeleton: {name: '骷髅', hp: 26, dmg: 6, speed: 2.6, range: 14, cd: 2.6, h: 1.9, ranged: true, hitR: 0.55},
  spider: {name: '蜘蛛', hp: 24, dmg: 3, speed: 3.0, range: 2.2, cd: 1.2, h: 0.9, hitR: 0.65},
  creeper: {name: '苦力怕', hp: 28, dmg: 33, speed: 3.1, range: 2.0, cd: 9, h: 1.7, hitR: 0.5},
  cow: {name: '牛', hp: 15, dmg: 0, speed: 1.4, range: 0, cd: 0, h: 1.3, hitR: 0.7, passive: true},
  pig: {name: '猪', hp: 15, dmg: 0, speed: 1.3, range: 0, cd: 0, h: 0.9, hitR: 0.6, passive: true},
  sheep: {name: '羊', hp: 12, dmg: 0, speed: 1.2, range: 0, cd: 0, h: 1.2, hitR: 0.65, passive: true},
  chicken: {name: '鸡', hp: 6, dmg: 0, speed: 1.5, range: 0, cd: 0, h: 0.7, hitR: 0.35, passive: true},
};
globalThis.Mobs = {
  spawn(type, x, z, opts) {
    const m = {type, pos: {x, y: 25, z}, dead: false, gone: false, yaw: 0, attackCd: 0, attackT: 0,
      target: null, nest: -1,
      cfg: ADV_MOB_CFG[type] || {hp: 20, dmg: 3, speed: 2, range: 2, cd: 1, h: 1.8, hitR: 0.55}};
    mobsState.spawned.push(m);
    return m;
  },
  update() {}, render() {},
  hit(m, dmg, kdx, kdz, kpow) {
    hitLog.push({m, dmg, kdx, kdz, kpow});
    if (m.pos === globalThis.pos) RealMobCore.hitState(m, dmg); /* 玩家实体走真实受击(血量断言有据) */
    return nextHit;
  },
  onDeath(cb) {
    mobsState.deathCbs.push(cb);
  },
  clear() {
    calls.push(['mobsClear']);
    mobsState.spawned.length = 0;
    mobsState.deathCbs.length = 0;
  },
  list() {
    return listResult;
  },
  steer(m, y) {
    m.yaw = y;
  },
  move(m, dx, dz) {
    moveLog.push({m, dx, dz});
    m.pos.x += dx;
    m.pos.z += dz;
  },
  gait() {},
  debrisColor() {
    return 0x1a2b3c;
  },
};
/* Drops 并线(T12×T14): 代理 vm 真件(T12 挖掘掉落/真空拾取链可真跑),
   同时记账 spawn/收集回调(T14 行为断言走调用记录) */
globalThis.Drops = {
  spawn(id, n, x, y, z) {
    dropsState.spawned.push({id, n, x, y, z});
    return RealDrops.spawn(id, n, x, y, z);
  },
  update: (...a) => RealDrops.update(...a),
  render: () => RealDrops.render(),
  onCollect(cb) {
    dropsState.cbs.push(cb);
    RealDrops.onCollect(cb);
  },
  list: () => RealDrops.list(),
  clear() {
    calls.push(['dropsClear']);
    dropsState.spawned.length = 0;
    dropsState.cbs.length = 0;
    RealDrops.clear();
  },
};
globalThis.sfx = (n) => {
  calls.push(['sfx', n]);
};
globalThis.Fx = {debrisBurst() {
  calls.push(['debris']);
}, kick() {
  calls.push(['kick']);
}, boom() {
  calls.push(['boom']);
}, arc() {
  calls.push(['arc']);
}, pop() {
  calls.push(['pop']);
}}; /* T13 爆炸组合/引信火花观感走调用记录; T15 仪式冲击波/烟花再加 pop */
globalThis.CombatCore = require('../js/combat-core.js'); /* 战斗核心: 真模块(弹道/盒判定是纯函数) */
globalThis.CombatKit = require('../js/combat-kit.js'); /* 玩家战斗壳: 真模块(C6-T3) */
globalThis.pos = {x: 61.5, y: 25, z: 76.5, set() {}};
globalThis.vel = {set() {}};
globalThis.yaw = 0;
globalThis.pitch = 0;
globalThis.onGround = false;
globalThis.flyMode = false;
globalThis.setFly = (v)=> {
  globalThis.flyMode = v;
  globalThis.vel.y = 0;
}; /* 镜像 voxel.js setFly: 模式经意图入口写飞行态 */

const ModeKit = require('../js/mode-kit.js');
globalThis.mkMode = ModeKit.mkMode;
globalThis.mkMainAct = ModeKit.mkMainAct; /* 智能主动作分派(手持感知): touch 列表顶层即消费 */
globalThis.mkBubbleBar = ModeKit.mkBubbleBar; /* 溺气泡条(liquid D10): 真件, 假 DOM 惰性渲染 */
globalThis.ModeKit = ModeKit;
globalThis.setFluidEditSink = () => {}; /* 流体账本缝(liquid D8): world.js 太重——空桩(账本入档断言不涉流体) */
globalThis.playerAirS = 15; /* 溺气余秒(liquid D9): voxel 真件在 vm, 物理不在 Node 跑——恒满气(气泡条藏) */
ModeKit.spawn = (x, y, z, o) => {
  calls.push(['spawn', x, y, z, o]);
  /* 镜像真 kitSpawn 写 pos/yaw: 位置+血量入档链(死亡·回家即时落盘)依赖
     spawn 后全局 pos 已是重生态; 出生点恰等于假 pos 初值, 既有断言不受扰 */
  globalThis.pos.x = x; globalThis.pos.y = y; globalThis.pos.z = z;
  globalThis.yaw = (o && o.yaw) || 0;
}; /* 出生点记账 + 位置/朝向写回(其余玩家状态不真写) */

/* 探险核心(S1 纯函数段迁 js/adventure-core.js) + 背包壳(S6, ADR 0002
   inventory_save 唯一持有): 浏览器按 index.html 加载序在壳之前, Node 侧
   显式铺到全局再 require 壳——壳顶层即消费这些全局名 */
const AdventureCore = require('../js/adventure-core.js');
Object.assign(globalThis, AdventureCore);
globalThis.Backpack = require('../js/backpack.js');

const AdventureMode = require('../js/modes/adventure.js');
const A = AdventureMode.adv; /* 内部挂点(常量表/政策纯函数/存档记账), 报告里给 T12~T15 的接线面 */

/* ---------- 世界快照与统计助手(对真 worldCells 断言) ---------- */
const W = api.WORLD_W;
const D = api.WORLD_D;
const H = api.WORLD_H;
const cell = (x, y, z) => api.worldCells[(y * D + z) * W + x];
const snapshot = () => Buffer.from(api.worldCells); /* 逐字节复现比对 */
function countId(id, pred) {
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (cell(x, y, z) === id && (!pred || pred(x, y, z))) n++;
      }
    }
  }
  return n;
}
function bandOk(id, yLo, yHi) {
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (cell(x, y, z) === id && (y < yLo || y > yHi)) return false;
      }
    }
  }
  return true;
}
/* 树干列: y25..28 连续原木(树高 4~6; 小屋角柱只到 y27, 不误计) */
function treeTrunks(skip) {
  let n = 0;
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (skip && skip(x, z)) continue;
      if (cell(x, 25, z) === 5 && cell(x, 26, z) === 5 && cell(x, 27, z) === 5 && cell(x, 28, z) === 5) n++;
    }
  }
  return n;
}
const inCircle = (x, z, c, r) => Math.hypot(x - c.cx, z - c.cz) <= r;
const inRect = (x, z, x1, z1, x2, z2) => x >= x1 && x <= x2 && z >= z1 && z <= z2;

function freshInit() {
  calls.length = 0;
  spoken.length = 0;
  hitLog.length = 0;
  moveLog.length = 0;
  listResult = [];
  nextHit = {hp: 10, dead: false, freshDead: false};
  AdventureMode.init();
}

/* 造一只战斗用怪(形状=模式 AI 消费的最小集; cfg 摘 MOB_TYPES, extra 覆盖测试剧本) */
function mkAdvMob(type, x, y, z, extra) {
  return Object.assign({type, pos: {x, y, z}, dead: false, gone: false, yaw: 0,
    attackCd: 0, attackT: 0, target: null, nest: 0,
    cfg: ADV_MOB_CFG[type] || {hp: 20, dmg: 3, speed: 2, range: 2, cd: 1, h: 1.8, hitR: 0.55}}, extra || {});
}

/* ============ 测试 ============ */

test('探险模式: 注册表行在场(gated 共享儿童时限 + 派生脚本路径) + main.js MODES 接线', () => {
  const ModeRegistry = require('../js/mode-registry.js');
  const row = ModeRegistry.all.find((m) => m.id === 'adventure');
  assert.ok(row, 'mode-registry.js 有 adventure 行');
  assert.strictEqual(row.gated, true, '计入儿童时限(共享 play 预算, 不新增账本)');
  assert.match(row.name, /\S/, '有面向家长的显示名');
  assert.strictEqual(ModeRegistry.scriptSrc(row), 'js/modes/adventure.js');
  assert.ok(ModeRegistry.playModeIds().includes('adventure'), '在儿童时限成员清单里');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  assert.ok(/adventure:\s*AdventureMode/.test(mainSrc), 'main.js MODES 表已接线');
  assert.strictEqual(AdventureMode.id, 'adventure', '模式对象 id');
});

test('探险模式: init 建场 — 草原地层/出生小屋/出生点/快捷栏 9 槽镜像背包', () => {
  freshInit();
  /* 地层: 地表 y24 草 / 下 4 层泥 / 再下石头到 y0 */
  assert.strictEqual(cell(10, 24, 10), 1, '地表 y24 是草地');
  assert.strictEqual(cell(10, 23, 10), 2, 'y21~23 泥土(上层)');
  assert.strictEqual(cell(10, 20, 10), 2, 'y20 泥土(第 4 层)');
  assert.strictEqual(cell(10, 19, 10), 3, 'y19 及以下石头');
  assert.strictEqual(cell(10, 0, 10), 3, '直到 y0 都是石头');
  /* 出生小屋: 原木角柱 + 木板墙/地板/顶 + 北门洞; 工作台/熔炉不送(任务链要有仪式感) */
  const hut = A.ADV.hut;
  assert.strictEqual(cell(hut.x1, 25, hut.z1), 5, '角柱是原木');
  assert.ok(countId(6, (x, y, z)=>y === 28 && inRect(x, z, hut.x1, hut.z1, hut.x2, hut.z2)) >= 40,
      '木板屋顶盖满小屋');
  assert.strictEqual(cell(61, 25, hut.z1), 0, '北墙正中是门洞');
  assert.strictEqual(countId(46, (x, y, z)=>inRect(x, z, hut.x1 - 1, hut.z1 - 1, hut.x2 + 1, hut.z2 + 1)), 0,
      '不送工作台(B_CRAFT)');
  assert.strictEqual(countId(47, (x, y, z)=>inRect(x, z, hut.x1 - 1, hut.z1 - 1, hut.x2 + 1, hut.z2 + 1)), 0,
      '不送熔炉(B_FURNACE)');
  /* 出生: 小屋门口, 步行(不飞行) */
  const sp = calls.find((c) => c[0] === 'spawn');
  assert.ok(sp, '玩家出生');
  assert.strictEqual(sp[2], A.ADV.ground + 1, '站在草地上');
  assert.ok(Math.abs(sp[1] - (hut.x1 + hut.x2 + 1) / 2) <= 1, '出生在门洞正前方(x 对齐门口)');
  assert.ok(sp[3] < hut.z1 - 0.5 && sp[3] > hut.z1 - 3.5, '出生在门北侧几步(面朝旷野背对小屋)');
  assert.strictEqual(globalThis.flyMode, false, '步行(不飞行)');
  /* 快捷栏: 9 个 item 型槽(镜像背包槽 0~8), 数字键/滚轮/点选走 mkHotbar */
  assert.strictEqual(AdventureMode.hotbar.items.length, api.HOTBAR_SLOTS, '快捷栏 9 槽');
  assert.ok(Array.isArray(touchList) && touchList.length >= 1, '声明了触屏按钮');
  assert.ok(!touchList.some((b) => b.hold === 'Space' || b.hold === 'ShiftLeft'),
      '跳跃/下降已收归引擎常驻键(直接触控改造), 模式列表不再自带');
  assert.ok(spoken.some((s) => String(s).indexOf('探险') >= 0 || String(s).indexOf('欢迎') >= 0), '进场欢迎语音');
});

test('智能主动作(手持感知, 2026-10-24): 拿放置物→aimClick(2)+返 false 不连发; 工具/食物/空手→aimClick(0); 图标随手持刷新', () => {
  freshInit();
  const inv = A.advGetInv();
  const main = touchList[0];
  assert.strictEqual(typeof main.holdAct, 'function', '主动作键 holdAct 在位');
  /* 木板: 放置型(ITEMS.block=6) → 放置一次, 不进连发 */
  inv.slots[0] = {id: 'planks', n: 4};
  AdventureMode.hotbar.select(0); /* 选中槽 0(advHeldChanged → 图标同步) */
  assert.strictEqual(A.advMainPlaceable(), true, '手持木板判定可放置');
  assert.strictEqual(main.holdAct(), false, '放置分支返 false → input.js 跳过 onHold 连发(一按一放)');
  assert.ok(calls.some((c) => c[0] === 'aimClick' && c[1] === 2), '路由 aimClick(2) 放置/使用链');
  assert.ok(calls.some((c) => c[0] === 'touchMain' && c[1] === 'brick'), '图标切到砖块(放置态)');
  calls.length = 0;
  /* 木镐: 工具(非放置) → 挖/打起步, 进连发 */
  inv.slots[0] = {id: 'pick_wood', n: 1, dur: 120};
  assert.notStrictEqual(main.holdAct(), false, '挖打分支返回非 false → 进 onHold 连发');
  assert.ok(calls.some((c) => c[0] === 'aimClick' && c[1] === 0), '路由 aimClick(0) 挖/打链');
  /* 食物与空手: 0 分支(吃路径在 onMouse(0) 内建, 不回归) */
  inv.slots[0] = {id: 'apple', n: 1};
  assert.strictEqual(A.advMainPlaceable(), false, '食物非放置物');
  inv.slots[0] = null;
  assert.strictEqual(A.advMainPlaceable(), false, '空手非放置物');
  /* 背包变动(放光/吃光/拾取)走 advSyncHotbar 的图标同步路径 */
  calls.length = 0;
  inv.slots[0] = {id: 'planks', n: 1};
  A.advSyncHotbar();
  assert.ok(calls.some((c) => c[0] === 'touchMain' && c[1] === 'brick'), 'advSyncHotbar 同步放置态图标');
});

test('探险模式: 湖 — 水面 + 沙底 + 湖底黏土层(红砖链源头) 2~3 格厚', () => {
  freshInit();
  const lake = A.ADV.lake;
  const water = countId(api.B_WATER, (x, y, z)=>y === 24 && inCircle(x, z, lake, lake.r));
  assert.ok(water >= 60, '湖心有水(可趟水): ' + water + ' 格');
  assert.ok(countId(8, (x, y, z)=>y >= 23 && inCircle(x, z, lake, lake.r)) >= 60, '沙质湖底/湖岸');
  const clay = countId(api.B_CLAY, (x, y, z)=>inCircle(x, z, lake, lake.r));
  assert.ok(clay >= 150, '湖底黏土层足够厚实(每水柱 2~3 格): ' + clay + ' 格');
  assert.ok(countId(api.B_CLAY, (x, y, z)=>!inCircle(x, z, lake, lake.r + 1)) === 0, '黏土只在湖底生成');
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (cell(x, y, z) === api.B_CLAY && (y < 19 || y > 23)) assert.fail('黏土浅层越界: ' + x + ',' + y + ',' + z);
      }
    }
  }
});

test('探险模式: 四矿物深度带 + 矿簇密度序(常见→稀有) — 全图矿不越带', () => {
  freshInit();
  assert.ok(bandOk(api.B_COAL_ORE, 12, 20), '煤矿只在 y12~20');
  assert.ok(bandOk(api.B_IRON_ORE, 6, 16), '铁矿只在 y6~16');
  assert.ok(bandOk(api.B_GOLD_ORE, 2, 10), '金矿只在 y2~10');
  assert.ok(bandOk(api.B_DIAMOND_ORE, 0, 5), '钻石矿只在 y0~5');
  const coal = countId(api.B_COAL_ORE);
  const iron = countId(api.B_IRON_ORE);
  const gold = countId(api.B_GOLD_ORE);
  const dia = countId(api.B_DIAMOND_ORE);
  assert.ok(coal > iron && iron > gold && gold > dia, '相对丰度递减(煤>铁>金>钻): ' + coal + '/' + iron + '/' + gold + '/' + dia);
  assert.ok(coal >= 300 && coal <= 1600, '煤矿常见: ' + coal);
  assert.ok(iron >= 120 && iron <= 1200, '铁矿中等: ' + iron +
      '(2026-10-23 矿坑改每级 1 格台阶, 铁坑 r7→9 加深后坑壁教学裸露 +~200, 上限随校)');
  assert.ok(gold >= 30 && gold <= 350, '金矿偏少: ' + gold);
  assert.ok(dia >= 6 && dia <= 160, '钻石稀有但任务链(3 颗)挖得到: ' + dia);
});

test('探险模式: 2 个露天矿坑 — 阶梯漏斗坑挖到地表以下, 坑壁裸露煤/铁矿(可见性教学)', () => {
  freshInit();
  const pits = A.ADV.pits;
  assert.strictEqual(pits.length, 2, '两个露天矿坑');
  pits.forEach((p, i) => {
    assert.ok(p.cx - p.r >= 0 && p.cx + p.r < W && p.cz - p.r >= 0 && p.cz + p.r < D,
        '矿坑 ' + i + ' 坐标在界内');
    assert.strictEqual(cell(p.cx, 22, p.cz), 0, '矿坑 ' + i + ' 中心被挖开(漏斗见底)');
    assert.ok(p.floor < 20, '矿坑 ' + i + ' 挖进石头层');
  });
  /* 坑壁裸露矿: 煤坑里能看见煤, 铁坑里能看见铁 */
  const coalPit = pits[0];
  const ironPit = pits[1];
  assert.ok(countId(api.B_COAL_ORE, (x, y, z)=>inCircle(x, z, coalPit, coalPit.r + 1)) >= 8,
      '煤坑壁裸露煤矿');
  assert.ok(countId(api.B_IRON_ORE, (x, y, z)=>inCircle(x, z, ironPit, ironPit.r + 1)) >= 8,
      '铁坑壁裸露铁矿');
});

test('探险模式: 山洞隧道通 y<10 深处, 沿途裸露铁/金/钻石矿(不用猜地下有矿)', () => {
  freshInit();
  const cave = A.ADV.cave;
  /* 隧道最深处: 台阶逐级向下, 存在 y<10 的洞内空间 */
  let deepAir = 0;
  for (let y = 1; y < 10; y++) {
    for (let z = cave.zEnd - 3; z <= cave.zStart + 3; z++) {
      for (let x = cave.x1 - 3; x <= cave.x2 + 3; x++) {
        if (x >= 0 && z >= 0 && cell(x, y, z) === 0) deepAir++;
      }
    }
  }
  assert.ok(deepAir >= 20, '山洞挖到 y<10 深处: ' + deepAir + ' 格空间');
  const nearCave = (x, y, z)=>x >= cave.x1 - 3 && x <= cave.x2 + 3 && z >= cave.zEnd - 3 && z <= cave.zStart + 3;
  assert.ok(countId(api.B_IRON_ORE, (x, y, z)=>nearCave(x, y, z) && y >= 6 && y <= 16) >= 4, '沿途铁矿带');
  assert.ok(countId(api.B_GOLD_ORE, (x, y, z)=>nearCave(x, y, z) && y >= 2 && y <= 10) >= 2, '沿途金矿带');
  assert.ok(countId(api.B_DIAMOND_ORE, (x, y, z)=>nearCave(x, y, z) && y <= 5) >= 2, '深处钻石矿(含穴室保底)');
});

test('探险模式: 3 个怪物巢穴 — 土丘洞穴地形就位 + init 每巢限量首刷 2~3 只(T14)', () => {
  freshInit();
  const nests = A.ADV.nests;
  assert.strictEqual(nests.length, 3, '三个巢穴位点');
  nests.forEach((n, i) => {
    assert.ok(n.x >= 2 && n.x < W - 2 && n.z >= 2 && n.z < D - 2, '巢穴 ' + i + ' 在界内');
    assert.ok(Array.isArray(n.kinds) && n.kinds.length >= 2, '巢穴 ' + i + ' 常量表带刷怪种类池');
    assert.strictEqual(cell(n.x, 25, n.z), 2, '巢穴 ' + i + ' 是土丘(泥土穹顶)');
    assert.strictEqual(cell(n.x, 25, n.z + 2), 0, '巢穴 ' + i + ' 有洞口');
  });
  /* init 首刷: 每巢 2~3 只, 种类取自本巢 kinds 池, 落位在土丘洞口附近环带(不贴脸);
     F4 牧场动物也在 spawned 里(无 nest 归属), 按挂件滤出巢穴怪再断言 */
  const byNest = [[], [], []];
  for (const m of mobsState.spawned) {
    if (m.__livestockIdx != null) continue; /* F4 牧场动物不是巢穴怪 */
    assert.ok(m.nest >= 0 && m.nest < 3, '刷出的怪挂巢穴归属(m.nest)');
    byNest[m.nest].push(m);
  }
  byNest.forEach((ms, i) => {
    assert.ok(ms.length >= 2 && ms.length <= 3, '巢 ' + i + ' 首刷 2~3 只: ' + ms.length);
    for (const m of ms) {
      assert.ok(nests[i].kinds.indexOf(m.type) >= 0, '种类取自本巢 kinds 池');
      const d = Math.hypot(m.pos.x - nests[i].x, m.pos.z - nests[i].z);
      assert.ok(d >= 1.5 && d <= 5, '巢 ' + i + ' 出生在洞口附近环带: d=' + d.toFixed(2));
    }
  });
  assert.strictEqual(mobsState.deathCbs.length, 1, '击杀掉落回调注册在 init(clear 会解除, 每次进场重挂)');
  assert.strictEqual(dropsState.cbs.length, 1, '收集回调注册在 init');
});

test('探险模式: 树林 ~40 棵, 避开出生区/巢穴/矿坑/湖/山洞', () => {
  freshInit();
  const skipZone = (x, z) => {
    const hut = A.ADV.hut;
    if (inRect(x, z, hut.x1 - 2, hut.z1 - 2, hut.x2 + 2, hut.z2 + 2)) return true; /* 出生区 */
    if (inCircle(x, z, A.ADV.lake, A.ADV.lake.r + 2)) return true; /* 湖 */
    for (const p of A.ADV.pits) if (inCircle(x, z, p, p.r + 1)) return true; /* 矿坑 */
    for (const n of A.ADV.nests) if (Math.hypot(x - n.x, z - n.z) < 4) return true; /* 巢穴 */
    const c = A.ADV.cave;
    return inRect(x, z, c.x1 - 3, c.zEnd - 4, c.x2 + 3, c.zStart + 5); /* 山洞(含洞口小丘) */
  };
  const total = treeTrunks(null);
  const outside = treeTrunks(skipZone);
  assert.ok(total >= 35 && total <= 45, '全图树 ~40 棵: ' + total);
  assert.strictEqual(total, outside, '保护区内一棵树都不种(生成时就避开, 不靠后清理)');
});

test('探险模式: 重进完全复现 — 同一地图两次生成逐字节一致(确定性散布)', () => {
  mem.clear(); /* 排除存档差异, 只比地形函数本身 */
  freshInit();
  const a = snapshot();
  AdventureMode.cleanup();
  freshInit();
  const b = snapshot();
  assert.deepStrictEqual(a, b, '两次建场 worldCells 逐块一致(SceneKit.rand/hashRand 确定性)');
});

test('探险模式: 世界存档往返 — 场景确定性重建 + 玩家 edits 重放(build 模式同款架构)', () => {
  mem.clear();
  mem.set('adventure_world_save', JSON.stringify({_v: 1, edits: [['61,24,80', 0], ['70,25,80', 4]]}));
  freshInit();
  assert.strictEqual(cell(61, 24, 80), 0, 'edits 重放: 小屋地板被玩家挖开(覆盖生成结果)');
  assert.strictEqual(cell(70, 25, 80), 4, 'edits 重放: 旷野上玩家放的圆石');
  /* 挖掘记账(T12 的挖掘/放置将调 advMarkEdit) → cleanup 落盘 → 重进重放 */
  A.advMarkEdit(90, 24, 90, 3);
  A.advMarkEdit(91, 24, 91, 0);
  AdventureMode.cleanup();
  const saved = JSON.parse(mem.get('adventure_world_save'));
  assert.ok(saved._v === 1, '存档带版本号');
  const flat = (saved.edits || []).map((e)=>e[0]);
  assert.ok(flat.includes('90,24,90') && flat.includes('91,24,91'), '改动落盘(edits 只存差异)');
  freshInit();
  assert.strictEqual(cell(90, 24, 90), 3, '重进: 玩家改动重放');
  assert.strictEqual(cell(91, 24, 91), 0, '重进: 玩家挖开的洞还在');
});

test('探险模式: 位置与血量随世界档保留 — 重进原地续命; 老档无 pos/hp 回出生点满血(不回归)', () => {
  mem.clear();
  /* 老档只有 edits(无 pos/hp) → defaults 补 null → 出生点满血 */
  mem.set('adventure_world_save', JSON.stringify({_v: 1, edits: []}));
  freshInit();
  assert.strictEqual(A.advGetPEnt().hp, 30, '老档无 hp → 满血');
  const s0 = calls.find((c) => c[0] === 'spawn');
  assert.deepStrictEqual([s0[1], s0[2], s0[3]], [A.ADV.spawn.x, A.ADV.spawn.y, A.ADV.spawn.z],
      '老档无 pos → 出生小屋门口');
  /* 残血 + 走到旷野 → cleanup 全量落盘带上 pos/hp */
  A.advGetPEnt().hp = 7; A.ADV.player.hp = 7; /* 账本与实体同源(死亡政策口径) */
  globalThis.pos.x = 90.5; globalThis.pos.y = 26; globalThis.pos.z = 91.5; globalThis.yaw = 2.5;
  AdventureMode.cleanup();
  const sv = JSON.parse(mem.get('adventure_world_save'));
  assert.strictEqual(sv.hp, 7, '血量落盘');
  assert.deepStrictEqual(sv.pos, {x: 90.5, y: 26, z: 91.5, yaw: 2.5}, '位置+朝向落盘');
  /* 重进: 原位置残血续命 */
  freshInit();
  assert.strictEqual(A.advGetPEnt().hp, 7, '重进: 残血保留');
  assert.strictEqual(A.ADV.player.hp, 7, '账本同步');
  const s1 = calls.find((c) => c[0] === 'spawn');
  assert.deepStrictEqual([s1[1], s1[2], s1[3]], [90.5, 26, 91.5], '重进: 上次退出位置');
  assert.strictEqual(s1[4].yaw, 2.5, '重进: 朝向保留');
});

test('探险模式: 死亡即时落盘 — 5s 节流窗口内重进也是出生点满血(不留死亡点残血档)', () => {
  mem.clear();
  freshInit();
  A.advGetPEnt().hp = 3; A.ADV.player.hp = 3; /* 残血 */
  globalThis.pos.x = 8; globalThis.pos.y = 8; globalThis.pos.z = 8; /* 「死亡点」远离出生小屋 */
  A.advPlayerDied();
  const sv = JSON.parse(mem.get('adventure_world_save'));
  assert.strictEqual(sv.hp, 30, '死亡落盘: 回满血');
  assert.deepStrictEqual([sv.pos.x, sv.pos.y, sv.pos.z], [A.ADV.spawn.x, A.ADV.spawn.y, A.ADV.spawn.z],
      '死亡落盘: 出生点(非死亡点)');
  freshInit();
  assert.strictEqual(A.advGetPEnt().hp, 30, '重进: 满血(死亡零惩罚语义不回归)');
  const s1 = calls.find((c) => c[0] === 'spawn');
  assert.deepStrictEqual([s1[1], s1[2], s1[3]], [A.ADV.spawn.x, A.ADV.spawn.y, A.ADV.spawn.z],
      '重进: 出生小屋门口');
});

test('探险模式: 回家即时落盘 — 满血+小屋位置即刻入档(5s 窗口内重进不在受困点残血)', () => {
  mem.clear();
  freshInit();
  A.advGetPEnt().hp = 5; A.ADV.player.hp = 5;
  globalThis.pos.x = 10; globalThis.pos.y = 10; globalThis.pos.z = 10; /* 受困点 */
  A.ADV.homeCd = -1e9; /* 就绪(冷却是跨测试的全局账本, 用完还原) */
  A.advGoHome();
  const sv = JSON.parse(mem.get('adventure_world_save'));
  assert.strictEqual(sv.hp, A.ADV.player.maxHp, '回家落盘: 满血');
  assert.deepStrictEqual([sv.pos.x, sv.pos.y, sv.pos.z], [A.ADV.spawn.x, A.ADV.spawn.y, A.ADV.spawn.z],
      '回家落盘: 小屋(非受困点)');
  A.ADV.homeCd = -1e9; /* 还原, 不影响后续冷却类测试 */
});

test('探险模式: 全局背包存档 — inventory_save 序列化往返(T5 serialize 形状) + 快捷栏镜像', () => {
  mem.clear();
  const slots = new Array(api.INV_SLOTS).fill(null);
  slots[0] = {id: 'log', n: 3};
  slots[12] = {id: 'pick_wood', n: 1, dur: 120};
  mem.set('inventory_save', JSON.stringify({_v: 1, slots}));
  freshInit();
  assert.strictEqual(A.advGetInv().slots[0].id, 'log', '背包从全局存档恢复');
  assert.strictEqual(A.advGetInv().slots[12].id, 'pick_wood', '工具槽(带耐久)恢复');
  assert.ok(String(elCache['hotbar'].children.map((c)=>c.innerHTML).join('')).indexOf('原木') >= 0,
      '快捷栏第 1 槽镜像背包(名字渲染出来)');
  /* 拾取入包(T12/T14 将经 inventory-core add) → cleanup 落盘 → 重进恢复 */
  api.add(A.advGetInv(), 'coal', 5);
  AdventureMode.cleanup();
  const invSave = JSON.parse(mem.get('inventory_save'));
  assert.strictEqual(invSave.slots.length, api.INV_SLOTS, '存档形状: 27 槽');
  assert.strictEqual(invSave._v, 1, 'T5 serialize 形状 {_v:1,slots}');
  freshInit();
  assert.strictEqual(api.serialize(A.advGetInv()).slots.filter(Boolean).length, 3, '重进: 原木+木镐+新捡的煤都在');
  assert.strictEqual(A.advGetInv().slots[12].dur, 120, '工具耐久随槽往返');
  assert.strictEqual(A.ADV.quest.step, 0, '任务存档占位 {step:0}(T15 填)');
});

test('探险模式: 死亡政策 — 背包保留 + 回出生点满血 + TTS 安抚(下界先例口径)', () => {
  mem.clear();
  freshInit();
  api.add(A.advGetInv(), 'log', 7);
  const before = api.serialize(A.advGetInv());
  const birthSpawn = calls.find((c) => c[0] === 'spawn').slice(1);
  /* 政策纯函数段: 结算=满血 + 回出生点 + 背包不动 */
  const plan = A.advDeathPlan({hp: 2, maxHp: 30}, A.ADV.spawn);
  assert.strictEqual(plan.hp, 30, '血量回满');
  assert.strictEqual(plan.keepInv, true, '背包保留(零惩罚哲学)');
  assert.strictEqual(plan.x, A.ADV.spawn.x, '回出生点');
  /* 行为链: 坠出世界(骨架期唯一可达的"死亡类"事件)走同一政策; 致命一击归 T14 */
  A.advGetPEnt().hp = 2;
  calls.length = 0;
  spoken.length = 0;
  AdventureMode.onVoidFall();
  const respawn = calls.find((c) => c[0] === 'spawn');
  assert.ok(respawn, '重生');
  assert.deepStrictEqual(respawn.slice(1), birthSpawn, '重生点 = 出生小屋门口(与出生同一处)');
  assert.ok(spoken.some((s)=>/[不怕|别怕|休息|再来]/.test(String(s))), 'TTS 安抚话术');
  assert.strictEqual(A.advGetPEnt().hp, 30, '玩家实体血量同步回满');
  assert.deepStrictEqual(api.serialize(A.advGetInv()), before, '背包原样保留(一个物品都不掉)');
});

test('探险模式: 🎒/Tab 开关背包配方书面板(本单只挂上, 合成站点解锁归 T13)', () => {
  mem.clear();
  freshInit();
  const panelRoot = docBody.children.find((c)=>c._cls.has('mkp-mask'));
  assert.ok(!panelRoot || panelRoot.parentNode !== docBody, '进场默认不开面板');
  AdventureMode.onKey('Tab');
  const root = docBody.children.find((c)=>c._cls.has('mkp-mask'));
  assert.ok(root, 'Tab 打开背包+配方书面板(自建遮罩挂 body)');
  assert.notStrictEqual(root.style.display, 'none', '面板可见');
  AdventureMode.onKey('Tab');
  assert.strictEqual(root.style.display, 'none', '再按 Tab 收起');
  AdventureMode.cleanup();
  assert.ok(calls.some((c) => c[0] === 'dropsClear') && calls.some((c) => c[0] === 'mobsClear'),
      '退出清掉落物与怪物');
  assert.strictEqual(root.parentNode, null, 'cleanup 卸载面板 DOM');
  assert.ok(calls.some((c) => c[0] === 'setItem' && c[1] === globalThis.PLAYER.heldItem),
      '退出复位默认手持物(Avatar 跨模式存活)');
});

/* ============ T14 巢穴战斗掉落 ============ */

test('T14 巢穴节律: 纯函数 — 每巢 2~3 只 + 全清 60s 发刷怪令(有活怪计时归零)', () => {
  assert.strictEqual(A.advNestCount(() => 0), 2, '数量下限 2');
  assert.strictEqual(A.advNestCount(() => 0.5), 3, '掷到上半区 3');
  assert.strictEqual(A.advNestCount(() => 0.999), 3, '数量上限 3');
  const dt = 1 / 60;
  let s = A.advNestStep(3, 37.2, dt); /* 巢里有活怪: 不刷且计时清零 */
  assert.strictEqual(s.spawn, false, '有活怪不刷');
  assert.strictEqual(s.t, 0, '有活怪计时归零(全清才起表)');
  s = A.advNestStep(0, 59.9, dt); /* 全清累计: 差一点不到 60s */
  assert.strictEqual(s.spawn, false, '60s 内不刷');
  assert.ok(Math.abs(s.t - (59.9 + dt)) < 1e-9, '计时累计');
  s = A.advNestStep(0, 59.999, dt); /* 到 60s: 发刷怪令并归零 */
  assert.strictEqual(s.spawn, true, '到 60s 发刷怪令');
  assert.strictEqual(s.t, 0, '发令后计时归零');
});

test('T14 巢穴节律: 行为 — 全清 60 秒后三巢各再刷 2~3 只', () => {
  freshInit();
  mobsState.spawned.length = 0; /* 全清(连同尸体) */
  listResult = [];
  for (let i = 0; i < 3540; i++) AdventureMode.update(1 / 60); /* 59s: 还不到 */
  assert.strictEqual(mobsState.spawned.length, 0, '60s 内不刷');
  for (let i = 0; i < 120; i++) AdventureMode.update(1 / 60); /* 跨过 60s */
  assert.ok(mobsState.spawned.length >= 6 && mobsState.spawned.length <= 9,
      '三巢各再刷 2~3 只: ' + mobsState.spawned.length);
});

test('T14 巢穴节律: 计时逐巢独立 — B/C 巢有活怪不重刷, A 巢到点单独再刷', () => {
  freshInit();
  mobsState.spawned.length = 0;
  listResult = [mkAdvMob('spider', 87, 25, 97, {nest: 1}), mkAdvMob('zombie', 57, 25, 21, {nest: 2})];
  for (let i = 0; i < 3660; i++) AdventureMode.update(1 / 60); /* 61s */
  const got = mobsState.spawned;
  assert.ok(got.length >= 2 && got.length <= 3, '只有 A 巢再刷 2~3 只: ' + got.length);
  assert.ok(got.every((m) => m.nest === 0), '再刷的都归 A 巢(B/C 巢没跟着刷)');
});

test('T14 玩家伤害: 手持工具按 D9 表取值(剑镐斧锹四阶), 空手/非工具 3', () => {
  const D9 = {sword: [7, 9, 11, 13], pick: [3, 4, 6, 8], axe: [5, 6, 8, 10], shovel: [2, 3, 4, 5]};
  const tiers = ['wood', 'stone', 'iron', 'diamond'];
  for (const kind of Object.keys(D9)) {
    tiers.forEach((t, i) => assert.strictEqual(A.advSwingDmg(kind + '_' + t), D9[kind][i],
        kind + ' ' + t + ' = ' + D9[kind][i] + '(设计稿 D9 表)'));
  }
  assert.strictEqual(A.advSwingDmg(''), 3, '空手 3');
  assert.strictEqual(A.advSwingDmg('coal'), 3, '非工具物品当空手 3');
});

test('T14 玩家挥击: 点击 → 准星方向最近怪按工具伤害受击 + 命中扣耐久 + 冷却节拍', () => {
  mem.clear();
  freshInit();
  api.add(A.advGetInv(), 'sword_wood', 1); /* 木剑进槽 0 */
  AdventureMode.onDigit(1); /* 选中槽 0 */
  globalThis.yaw = 0; /* 面朝 -Z(camera-rig lookDir 同式) */
  globalThis.pos.x = 40; globalThis.pos.y = 25; globalThis.pos.z = 50;
  const front = mkAdvMob('zombie', 40, 25, 47.4, {attackCd: 99}); /* 北侧 2.6 格(面前, 出怪反击圈) */
  listResult = [front];
  nextHit = {hp: 20, dead: false, freshDead: false};
  hitLog.length = 0;
  AdventureMode.onMouse(0);
  assert.strictEqual(hitLog.length, 1, '命中准星方向的怪');
  assert.strictEqual(hitLog[0].m, front, '打的是面前那只');
  assert.strictEqual(hitLog[0].dmg, 7, '木剑伤害 7(D9)');
  assert.ok(calls.some((c) => c[0] === 'swing'), '出手带挥臂观感');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'hit'), '命中音');
  assert.strictEqual(A.advGetInv().slots[0].dur, 119, '命中扣耐久 -1');
  /* 冷却内连点只挥一次(swingCd 0.38 口径照 nether) */
  AdventureMode.onMouse(0);
  assert.strictEqual(hitLog.length, 1, '冷却内连点不重复结算');
  /* 身后的怪不打(准星锥判定), 也不出手不空挥 */
  for (let i = 0; i < 30; i++) AdventureMode.update(1 / 60); /* 烧掉 0.38s 冷却 */
  const behind = mkAdvMob('zombie', 40, 25, 52.6, {attackCd: 99});
  listResult = [behind];
  hitLog.length = 0;
  calls.length = 0;
  AdventureMode.onMouse(0);
  assert.strictEqual(hitLog.length, 0, '身后的怪不打');
  assert.ok(!calls.some((c) => c[0] === 'swing'), '锥内无怪不出手(挖掘/放置点击政策归 T12, 不抢语义)');
});

test('T14 工具耐久: 归零即消失 + 安抚 TTS(与 T12 共用政策, 独立实现各管各路径)', () => {
  mem.clear();
  freshInit();
  api.add(A.advGetInv(), 'pick_wood', 1);
  A.advGetInv().slots[0].dur = 1; /* 下一击就坏 */
  AdventureMode.onDigit(1);
  globalThis.yaw = 0;
  globalThis.pos.x = 40; globalThis.pos.y = 25; globalThis.pos.z = 50;
  listResult = [mkAdvMob('zombie', 40, 25, 47.4, {attackCd: 99})];
  nextHit = {hp: 20, dead: false, freshDead: false};
  AdventureMode.onMouse(0);
  assert.ok(!A.advGetInv().slots[0], '破板: 工具槽清空(remove)');
  assert.ok(spoken.some((s) => /[再做|不哭|别难过|陪]/.test(String(s))), '安抚 TTS');
});

test('T14 掉落链路(纯): onDeath 实体 → rollDrops 种子化 → spawn 清单(击杀点上方 0.8)', () => {
  const m = {type: 'zombie', pos: {x: 10, y: 25, z: 20}};
  const none = A.advDeathDrops(m, () => 0.9); /* 无加成无稀有 */
  assert.deepStrictEqual(none, [{id: 'rotten_flesh', n: 1, x: 10, y: 25.8, z: 20}], '保底 1 腐肉');
  const both = A.advDeathDrops(m, () => 0.01); /* 加成与稀有都掷中 */
  assert.strictEqual(both[0].id, 'rotten_flesh');
  assert.strictEqual(both[0].n, 2, '50% 加成 +1');
  assert.strictEqual(both[1].id, 'iron_ingot');
  assert.strictEqual(both[1].n, 1, '稀有 5% 铁锭 +1');
  assert.strictEqual(both[1].y, 25.8, '掉落点 = 尸体落点 y+0.8(碎块中蹦出)');
  const sk = A.advDeathDrops({type: 'skeleton', pos: {x: 0, y: 24, z: 0}}, () => 0.99);
  assert.deepStrictEqual(sk.map((s) => [s.id, s.n]), [['bone', 1]], '骷髅保底骨头');
});

test('T14 掉落链路(行为): 击杀回调 → Drops.spawn 逐条落地(表与掷骰一致)', () => {
  freshInit();
  assert.strictEqual(mobsState.deathCbs.length, 1, 'onDeath 回调在 init 注册');
  dropsState.spawned.length = 0;
  mobsState.deathCbs[0]({type: 'creeper', pos: {x: 86, y: 25, z: 96}});
  assert.strictEqual(dropsState.spawned.length, 1, '苦力怕火药一条(保底)');
  assert.strictEqual(dropsState.spawned[0].id, 'gunpowder', '掉落 id = MOB_DROPS 表');
  assert.ok(dropsState.spawned[0].n >= 1 && dropsState.spawned[0].n <= 2, '保底 1 + 50% 加成 1');
  assert.strictEqual(dropsState.spawned[0].x, 86, '落点 = 击杀点');
  assert.strictEqual(dropsState.spawned[0].y, 25.8, '高度 = 击杀点上方 0.8');
  /* 未收录怪种不掉落(空手骷髅马之类不炸) */
  dropsState.spawned.length = 0;
  mobsState.deathCbs[0]({type: 'dragon', pos: {x: 0, y: 10, z: 0}});
  assert.strictEqual(dropsState.spawned.length, 0, '掉落表没写就是没有(不抛错)');
});

test('T14 击杀观感: 碎块(debrisColor) + 击杀计数 toast(nether 先例)', () => {
  mem.clear();
  freshInit();
  globalThis.yaw = 0;
  globalThis.pos.x = 40; globalThis.pos.y = 25; globalThis.pos.z = 50;
  listResult = [mkAdvMob('spider', 40, 25, 47.4, {attackCd: 99})];
  nextHit = {hp: 0, dead: true, freshDead: true};
  calls.length = 0;
  AdventureMode.onMouse(0); /* 空手 3 伤害击杀(脚本 freshDead) */
  assert.strictEqual(A.ADV.killCount, 1, '击杀计数 +1');
  assert.ok(calls.some((c) => c[0] === 'debris'), '击杀碎块(Fx.debrisBurst)');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('击杀') >= 0), '击杀计数 toast');
});

test('T14 收集: 入包+快捷栏镜像; 背包满拒收返 false + toast「🎒 背包满啦」', () => {
  mem.clear();
  freshInit();
  const cb = dropsState.cbs[0];
  assert.notStrictEqual(cb('bone', 2), false, '有空位: 收下(非 false)');
  assert.strictEqual(api.count(A.advGetInv(), 'bone'), 2, '骨头入包');
  assert.ok(String(elCache['hotbar'].children.map((c)=>c.innerHTML).join('')).indexOf('骨头') >= 0,
      '快捷栏镜像新物品');
  for (let i = 0; i < api.INV_SLOTS; i++) A.advGetInv().slots[i] = {id: 'coal', n: 64}; /* 27 槽全满 */
  calls.length = 0;
  assert.strictEqual(cb('bone', 1), false, '满包拒收(掉落物 1.2s 冷却后重试)');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('背包满') >= 0), 'toast 背包满啦');
  assert.strictEqual(api.count(A.advGetInv(), 'bone'), 0, '拒收不入包');
  assert.strictEqual(api.count(A.advGetInv(), 'coal'), 64 * api.INV_SLOTS, '满包原样不动');
});

test('T14 收集播报: 3 秒合并窗 — 同项合数量, 到期一句播报(防刷屏)', () => {
  assert.strictEqual(A.advPickupText(new Map([['coal', 2], ['bone', 1]])),
      '捡到 2 个煤炭、1 个骨头！', '合并文案(同项数量相加, 进账序; 量词照设计稿例句「捡到 2 个煤炭！」)');
  assert.strictEqual(A.advPickupText(new Map([['diamond', 1]])), '捡到 1 个钻石！', '单件播报');
  mem.clear();
  freshInit();
  spoken.length = 0; /* 进场欢迎语音不计入播报断言 */
  const cb = dropsState.cbs[0];
  cb('coal', 1);
  cb('coal', 1);
  cb('bone', 2);
  assert.strictEqual(spoken.length, 0, '窗口内不逐条播报');
  for (let i = 0; i < 200; i++) AdventureMode.update(1 / 60); /* 3.3s: 窗口到期 */
  const picks = spoken.filter((s) => String(s).indexOf('捡到') >= 0);
  assert.strictEqual(picks.length, 1, '到期只播一句');
  assert.ok(picks[0].indexOf('2 个煤炭') >= 0 && picks[0].indexOf('2 个骨头') >= 0,
      '同项合并数量: ' + picks[0]);
});

test('T14 玩家受击: 受击音+闪红+震屏+语音 3 秒节流(nether 全套先例)', () => {
  mem.clear();
  freshInit();
  globalThis.pos.x = 40; globalThis.pos.y = 25; globalThis.pos.z = 50;
  listResult = [mkAdvMob('zombie', 40.4, 25, 49.6), mkAdvMob('spider', 39.6, 25, 50.4)];
  nextHit = {hp: 22, dead: false, freshDead: false};
  calls.length = 0;
  spoken.length = 0;
  hitLog.length = 0;
  AdventureMode.update(1 / 60); /* 同帧两只各打一下 */
  assert.strictEqual(hitLog.length, 2, '两只怪都命中玩家');
  assert.ok(hitLog.every((h) => h.m.pos === globalThis.pos), '受击者=玩家实体');
  assert.ok(hitLog.some((h) => h.dmg === 5), '僵尸按自身 dmg 5 攻击');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'hurt'), '受击音 hurt');
  assert.ok(calls.some((c) => c[0] === 'flash'), '身体闪红(Avatar.flash 主提醒)');
  assert.ok(calls.some((c) => c[0] === 'kick'), '轻震屏');
  assert.strictEqual(spoken.filter((s) => String(s).indexOf('快躲开') >= 0).length, 1,
      '语音 3 秒节流: 同帧两击只播一句');
});

test('T14 玩家阵亡: 怪物致命一击走 advPlayerDied — 回出生小屋满血+背包保留+不播受击话术', () => {
  mem.clear();
  freshInit();
  api.add(A.advGetInv(), 'log', 5);
  const before = api.serialize(A.advGetInv());
  globalThis.pos.x = 40; globalThis.pos.y = 25; globalThis.pos.z = 50;
  listResult = [mkAdvMob('zombie', 40.4, 25, 49.6)];
  nextHit = {hp: 0, dead: true, freshDead: true};
  calls.length = 0;
  spoken.length = 0;
  AdventureMode.update(1 / 60);
  assert.ok(calls.some((c) => c[0] === 'spawn'), '致命一击 → 重生(advPlayerDied)');
  assert.ok(spoken.some((s) => /[不怕|别怕|休息]/.test(String(s))), '死亡安抚话术(专属文案)');
  assert.ok(!spoken.some((s) => String(s).indexOf('快躲开') >= 0), '致命一击不走受击话术(不抢戏)');
  assert.strictEqual(A.advGetPEnt().hp, 30, '满血重来');
  assert.deepStrictEqual(api.serialize(A.advGetInv()), before, '背包一个物品都不掉');
});

test('T14 儿童可控: 苦力怕单击伤害封顶(33 → 10, 满血 30 不被秒杀)', () => {
  freshInit();
  globalThis.pos.x = 86; globalThis.pos.y = 25; globalThis.pos.z = 96;
  listResult = [mkAdvMob('creeper', 86.4, 25, 95.6, {nest: 1})];
  nextHit = {hp: 20, dead: false, freshDead: false};
  hitLog.length = 0;
  AdventureMode.update(1 / 60);
  assert.ok(hitLog.some((h) => h.m.pos === globalThis.pos && h.dmg === 10), '伤害封顶 10');
});

test('T14 索敌收敛: 玩家在索敌半径外怪驻巢不追; 引出巢区过远掉头回巢(收队)', () => {
  freshInit();
  /* 玩家在出生小屋(61.5,76.5), 巢 0 在(40,52): 相距 ~34 格 > 索敌半径 */
  const guard = mkAdvMob('zombie', 41, 25, 53, {nest: 0});
  listResult = [guard];
  moveLog.length = 0;
  AdventureMode.update(1 / 60);
  assert.strictEqual(moveLog.length, 0, '玩家在索敌半径外: 原地驻巢(不追击不游荡出巢)');
  /* 玩家进索敌半径(距怪 4 格) → 开战逼近 */
  globalThis.pos.x = 45; globalThis.pos.y = 25; globalThis.pos.z = 53;
  moveLog.length = 0;
  AdventureMode.update(1 / 60);
  const chase = moveLog.find((mv) => mv.m === guard);
  assert.ok(chase && chase.dx > 0, '进索敌半径: 朝玩家逼近(dx>0)');
  /* 被击退引出巢区(离巢 20 格 > 收队半径 16) → 不再追, 掉头回巢 */
  guard.pos.x = 60; guard.pos.z = 53;
  globalThis.pos.x = 61.5; globalThis.pos.z = 76.5; /* 玩家远走 */
  moveLog.length = 0;
  AdventureMode.update(1 / 60);
  const home = moveLog.find((mv) => mv.m === guard);
  assert.ok(home && home.dx < 0, '离巢超收队半径: 掉头回巢(dx<0 朝巢 40)');
});

test('T14 骷髅远程: 索敌内保持距离放箭, 箭沿预测弹道命中玩家受击(CombatCore 先例)', () => {
  freshInit();
  globalThis.pos.x = 44; globalThis.pos.y = 25; globalThis.pos.z = 58; /* 距骷髅 4 格(巡航距内) */
  listResult = [mkAdvMob('skeleton', 44, 25, 54, {nest: 0})]; /* 巢 0 土丘(40,52)外的开阔地 */
  nextHit = {hp: 24, dead: false, freshDead: false};
  calls.length = 0;
  spoken.length = 0;
  hitLog.length = 0;
  AdventureMode.update(1 / 60);
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'shoot'), '骷髅放箭(shoot 音)');
  let hitPlayer = false;
  for (let i = 0; i < 150 && !hitPlayer; i++) {
    AdventureMode.update(1 / 60);
    hitPlayer = hitLog.some((h) => h.m.pos === globalThis.pos);
  }
  assert.ok(hitPlayer, '箭按弹道飞到玩家(不是即时判定)');
  assert.ok(hitLog.some((h) => h.m.pos === globalThis.pos && h.dmg === 6), '箭伤 = 骷髅 dmg 6');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'hurt'), '箭命中 → 受击音');
});

/* ============ T12 挖掘与采集交互 ============ */

test('T12 蓄力纯函数: advMineStep — 时间累积/换目标清零/breakTime 驱动', () => {
  const step = A.advMineStep;
  /* 时间累积: 同目标逐帧累加, 到点 done 且 t 钳在 need */
  const bt = {time: 1.125, drops: true};
  let m = step({t: 0, key: '', need: 0, drops: true}, '10,24,10', bt, 0.5);
  assert.strictEqual(m.t, 0.5, '第一帧累计 0.5');
  assert.strictEqual(m.key, '10,24,10', '锁定目标 key');
  assert.strictEqual(m.need, bt.time, 'need 由 breakTime 驱动');
  assert.strictEqual(m.done, false, '未到点');
  m = step(m, '10,24,10', bt, 0.5);
  assert.strictEqual(m.t, 1.0, '第二帧累计 1.0');
  m = step(m, '10,24,10', bt, 0.5);
  assert.strictEqual(m.done, true, '累计到 1.125 → done');
  assert.strictEqual(m.t, bt.time, 't 钳在 need(不外漏超额)');
  /* 换目标清零: 新 key 从头累计, need 换新目标的时长 */
  m = step({t: 5, key: '10,24,10', need: 7.5, drops: false}, '20,24,20', {time: 0.9, drops: true}, 0.3);
  assert.strictEqual(m.t, 0.3, '换目标进度清零重新累计');
  assert.strictEqual(m.need, 0.9, 'need 换成新目标时长');
  assert.strictEqual(m.drops, true, 'drops 标志随新目标刷新');
  /* 准星指空(key 空) → 完全清零待命 */
  m = step({t: 5, key: '10,24,10', need: 7.5, drops: true}, '', {time: 1, drops: true}, 0.3);
  assert.strictEqual(m.t, 0, '指空清零');
  assert.strictEqual(m.key, '', 'key 清空');
  assert.strictEqual(m.done, false, '不触发破坏');
  /* breakTime 真值驱动: 徒手石头 7.5s(§0 现状口径) · 木镐匹配 1.125s · tier 不足 drops:false */
  const bare = api.breakTime(api.BLOCKS[3], null);
  assert.strictEqual(bare.time, 7.5, '徒手石头 7.5s');
  assert.strictEqual(bare.drops, false, '石头 tier1 徒手不掉落');
  const pick = api.breakTime(api.BLOCKS[3], {id: 'pick_wood', n: 1, dur: 120});
  assert.strictEqual(pick.time, 1.125, '木镐匹配 1.5×1.5/2');
  assert.strictEqual(pick.drops, true, '木镐达 tier1 掉圆石');
  const m2 = step({t: 0, key: '', need: 0, drops: true}, '5,10,5', bare, 7.5);
  assert.strictEqual(m2.done, true, '蓄满 7.5s 一帧到点');
  assert.strictEqual(m2.drops, false, 'drops 透传(徒手石头只碎不掉)');
});

test('T12 放置合法性纯函数: advPlaceCheck — 实心块贴面/thin 只放顶面/树苗限草地泥土', () => {
  const chk = A.advPlaceCheck;
  /* 实心块(泥土): 任意朝向面都可贴放(目标位空气) */
  const side = chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 2, 1, 0);
  assert.ok(side.ok, '泥土放草地顶面 ok');
  assert.deepStrictEqual([side.x, side.y, side.z], [10, 25, 10], '落点 = 命中格 + 面法线');
  const wall = chk({x: 10, y: 24, z: 10, nx: 1, ny: 0, nz: 0}, 2, 1, 0);
  assert.ok(wall.ok, '实心块贴侧面也可');
  /* 目标位非空气 → 拒(叠块) */
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 2, 1, 5).ok, false,
      '目标位已有方块 → 拒');
  /* thin 块(火把): 只放实心面顶(点击面法线朝上), 草丛等薄块顶不可当支承 */
  assert.ok(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, api.B_TORCH, 1, 0).ok, '火把放草地顶面 ok');
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 1, ny: 0, nz: 0}, api.B_TORCH, 1, 0).ok, false,
      '火把贴侧面 → 拒(thin 只放顶面)');
  assert.strictEqual(chk({x: 10, y: 25, z: 10, nx: 0, ny: 1, nz: 0}, api.B_TORCH, api.B_GRASS_TUFT, 0).ok,
      false, '草丛(solid:false)顶上放火把 → 拒');
  /* 树苗: 顶面 + 支承限草地/泥土 */
  assert.ok(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, api.B_SAPLING, 1, 0).ok, '树苗放草地 ok');
  assert.ok(chk({x: 10, y: 23, z: 10, nx: 0, ny: 1, nz: 0}, api.B_SAPLING, 2, 0).ok, '树苗放泥土 ok');
  assert.strictEqual(chk({x: 10, y: 22, z: 10, nx: 0, ny: 1, nz: 0}, api.B_SAPLING, 3, 0).ok, false,
      '树苗放石头上 → 拒');
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 0, nz: 1}, api.B_SAPLING, 1, 0).ok, false,
      '树苗贴侧面 → 拒');
  /* 非放置型物品(无 block 方块定义)与无效输入 → 拒 */
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 9999, 1, 0).ok, false,
      '未注册方块 id → 拒');
  assert.strictEqual(chk(null, 2, 1, 0).ok, false, '无命中 → 拒');
});

test('T12 食物回血政策纯函数: advEatPolicy — 钳制上限/满血不吃/腐肉同口径', () => {
  const pol = A.advEatPolicy;
  assert.deepStrictEqual(pol(28, 30, 4), {hp: 30, healed: 2, canEat: true}, '回复钳制在 maxHp');
  assert.deepStrictEqual(pol(10, 30, 4), {hp: 14, healed: 4, canEat: true}, '未满血按 food 全回');
  assert.strictEqual(pol(30, 30, 4).canEat, false, '满血不饿(canEat=false)');
  /* 腐肉也走食物口径(儿童版无饥饿 debuff, D7): 注册表 food=2 同一函数消化 */
  assert.strictEqual(api.ITEMS.rotten_flesh.food, 2, '腐肉注册表 food=2');
  assert.strictEqual(pol(10, 30, api.ITEMS.rotten_flesh.food).hp, 12, '腐肉回 2 血(同口径)');
});

test('T12 树苗计时纯函数: advSapDue — dt 递减/到期出清单/未到期留队', () => {
  const due = A.advSapDue;
  const map = new Map([
    ['10,25,10', {x: 10, y: 25, z: 10, left: 0.5}],
    ['20,25,20', {x: 20, y: 25, z: 20, left: 3}],
  ]);
  const out = due(map, 1.0);
  assert.strictEqual(out.length, 1, '只有到期的进清单');
  assert.strictEqual(out[0].x, 10, '到期项坐标完整');
  assert.ok(!map.has('10,25,10'), '到期项移出计时 Map');
  assert.strictEqual(map.get('20,25,20').left, 2, '未到期递减留队');
  const out2 = due(map, 2.0);
  assert.strictEqual(out2.length, 1, '第二轮到期出清单');
  assert.strictEqual(map.size, 0, 'Map 清空');
});

/* ---------- 行为链共用: 动态找一块干净的草地(避开树/草丛/小屋), 准星 fake 指向它 ---------- */
function findGrassSpot() {
  for (let x = 3; x < 50; x++) {
    for (let z = 3; z < 50; z++) {
      if (cell(x, 24, z) === 1 && cell(x, 25, z) === 0 && cell(x, 26, z) === 0) return {x, z};
    }
  }
  throw new Error('找不到干净草地');
}
function aimDownAt(spot) {/* 准星 fake: 从 (x,28.5,z) 正下方 → 命中 (x,24,z) 草地 */
  globalThis.camera = {};
  globalThis.CameraRig = {aim: () => ({origin: {x: spot.x + 0.5, y: 28.5, z: spot.z + 0.5},
    dir: {x: 0, y: -1, z: 0}})};
}
function clearAim() {
  delete globalThis.camera;
  delete globalThis.CameraRig;
}
function holdOnly(id, n, dur) {/* 背包清空后只在快捷栏 0 槽放一件并选中 */
  const inv = A.advGetInv();
  inv.slots = new Array(api.INV_SLOTS).fill(null);
  if (id) inv.slots[0] = dur != null ? {id, n: 1, dur} : {id, n};
  AdventureMode.hotbar.select(0);
}

test('T12 草丛散布: 确定性 + 只长草地顶 + 密度可发现不铺满(T11 缺口补齐)', () => {
  mem.clear();
  freshInit();
  const tufts = countId(api.B_GRASS_TUFT);
  assert.ok(tufts >= 250 && tufts <= 1200, '草原上可发现但不铺满: ' + tufts + ' 丛');
  let onGrass = 0;
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (cell(x, y, z) === api.B_GRASS_TUFT) {
          assert.strictEqual(y, 25, '草丛只在地表上一层(y25)');
          if (cell(x, 24, z) === 1) onGrass++;
        }
      }
    }
  }
  assert.strictEqual(onGrass, tufts, '每丛脚下都是草地(不占沙/水/矿坑)');
  const again = (freshInit(), countId(api.B_GRASS_TUFT));
  assert.strictEqual(again, tufts, '重进草丛位置完全复现(确定性散布)');
});

test('T12 挖掘行为链: 蓄力到点破坏 — 记账/掉落物 spawn/耐久 −1/触屏政策本块即停', () => {
  mem.clear();
  freshInit();
  holdOnly('shovel_wood', 1, 120); /* 木锹 matched 草地: 0.6×1.5/2 = 0.45s */
  const spot = findGrassSpot();
  aimDownAt(spot);
  const hit = {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0};
  AdventureMode.onMouse(0, hit); /* 开始蓄力(准星指住方块按住) */
  for (let i = 0; i < 2; i++) AdventureMode.update(0.15); /* 0.3s: 不到点 */
  assert.strictEqual(cell(spot.x, 24, spot.z), 1, '蓄力未满方块还在');
  assert.ok(A.advMine.t > 0 && A.advMine.t < A.advMine.need, '进度环数据在累积');
  for (let i = 0; i < 6 && cell(spot.x, 24, spot.z) !== 0; i++) AdventureMode.update(0.15); /* 补满 0.45s(浮点尾差容错) */
  assert.strictEqual(cell(spot.x, 24, spot.z), 0, '到点破坏(editBlock 挖除)');
  assert.ok(calls.some((c) => c[0] === 'edit' && c[1] === spot.x && c[2] === 24 && c[3] === spot.z && c[4] === 0),
      'editBlock 走单块编辑 seam');
  assert.strictEqual(A.advGetInv().slots[0].dur, 119, '破坏成功工具耐久 −1');
  assert.ok(globalThis.Drops.list().some((d) => d.id === 'dirt' && d.n === 1),
      '草地掉落泥土实体 spawn(保底 1)');
  assert.strictEqual(A.advMine.down, false, '触屏单击政策: 本块完成即停(无按住)');
  clearAim();
});

test('T12 挖掘行为链: 掉落物真空拾取 — update 喂玩家胸口点 → onCollect 入包', () => {
  mem.clear();
  freshInit();
  holdOnly('shovel_wood', 1, 120);
  const spot = findGrassSpot();
  aimDownAt(spot);
  AdventureMode.onMouse(0, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  for (let i = 0; i < 8 && cell(spot.x, 24, spot.z) !== 0; i++) AdventureMode.update(0.15); /* 破坏 */
  assert.strictEqual(cell(spot.x, 24, spot.z), 0, '破坏发生(有掉落物可捡)');
  clearAim();
  const keep = {x: pos.x, y: pos.y, z: pos.z};
  pos.x = spot.x + 0.5; pos.y = 25; pos.z = spot.z + 0.5; /* 玩家站在掉落物旁 */
  for (let i = 0; i < 30 && api.count(A.advGetInv(), 'dirt') === 0; i++) {
    AdventureMode.update(0.05); /* 吸附 → 收集 → onCollect → add 入包 */
  }
  assert.strictEqual(api.count(A.advGetInv(), 'dirt'), 1, '泥土捡进背包');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'pick'), '拾取音效');
  pos.x = keep.x; pos.y = keep.y; pos.z = keep.z; /* 复位共享玩家位 */
});

test('T12 挖掘行为链: tier 不足 — 徒手/低阶镐挖铁矿只碎不掉 + TTS 节流提示', () => {
  mem.clear();
  freshInit();
  holdOnly('pick_wood', 1, 120); /* 木镐 tier1 < 铁矿 tier2: 品类对速度生效 3×5/2=7.5s, 不掉落(D1) */
  const spot = findGrassSpot();
  api.setBlockRaw(spot.x, 24, spot.z, 0); /* 竖井直达铁矿(测试布景) */
  api.setBlockRaw(spot.x, 23, spot.z, 0);
  api.setBlockRaw(spot.x, 22, spot.z, api.B_IRON_ORE);
  globalThis.camera = {};
  globalThis.CameraRig = {aim: () => ({origin: {x: spot.x + 0.5, y: 24.5, z: spot.z + 0.5},
    dir: {x: 0, y: -1, z: 0}})};
  AdventureMode.onMouse(0, {x: spot.x, y: 22, z: spot.z, nx: 0, ny: 1, nz: 0});
  AdventureMode.update(0.01); /* 首帧锁定目标并算出 breakTime */
  assert.strictEqual(A.advMine.need, 7.5, '品类对 tier 不足: 3×5/2 = 7.5(JE 保留工具速度, breakTime 驱动)');
  for (let i = 0; i < 17 && cell(spot.x, 22, spot.z) !== 0; i++) AdventureMode.update(0.5); /* 7.5s 蓄满 */
  assert.strictEqual(cell(spot.x, 22, spot.z), 0, '可挖(慢) — 破坏照样发生');
  assert.ok(!globalThis.Drops.list().some((d) => d.id === 'iron_ore'), 'tier 不足不掉落(只碎)');
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 0, '背包没有铁矿石');
  assert.ok(spoken.some((s) => String(s).indexOf('更硬') >= 0), 'TTS 提示换更硬的镐子');
  clearAim();
});

test('T12 耐久政策: damageTool 归零 — remove 清槽 + 安抚 TTS + 空手(槽已空, MC 口径)', () => {
  mem.clear();
  freshInit();
  holdOnly('shovel_wood', 1, 1); /* 剩 1 耐久: 再挖一块即破板 */
  const spot = findGrassSpot();
  aimDownAt(spot);
  AdventureMode.onMouse(0, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  for (let i = 0; i < 8 && cell(spot.x, 24, spot.z) !== 0; i++) AdventureMode.update(0.15);
  assert.strictEqual(cell(spot.x, 24, spot.z), 0, '破坏完成');
  assert.strictEqual(A.advGetInv().slots[0], null, '工具归零消失(remove 清槽)');
  assert.ok(spoken.some((s) => String(s).indexOf('再做一个') >= 0), '安抚 TTS(零惩罚哲学)');
  assert.ok(calls.some((c) => c[0] === 'setItem' && c[1] === null),
      '手持观感=空手(槽已空, 与 advHeldChanged 空槽同一口径)');
  clearAim();
});

test('手持一致: 选中槽 → Avatar 跟随(工具/方块/薄片 def, 空槽=空手)', () => {
  mem.clear();
  freshInit();
  const lastSet = () => calls.filter((c) => c[0] === 'setItem').pop();
  holdOnly('pick_wood', 1, 120); /* select(0) → onPick → advHeldChanged 全链 */
  assert.strictEqual(lastSet()[1], 'pick_wood', '选中工具 → 手持工具');
  holdOnly('planks', 5);
  assert.strictEqual(lastSet()[1], 'planks', '选中方块 → 手持方块本体(不再回落锄头)');
  holdOnly('apple', 2);
  assert.strictEqual(lastSet()[1], 'apple', '选中食物 → 手持薄片(不再回落锄头)');
  holdOnly(null);
  assert.strictEqual(lastSet()[1], null, '空槽 → 空手(MC 口径)');
});

test('T12 放置行为链: 泥土/火把/树苗 — 落点+背包 −1+记账; thin 违规落点 toast 拒绝', () => {
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  const hitTop = {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0};
  holdOnly('dirt', 3);
  calls.length = 0;
  AdventureMode.onMouse(2, hitTop);
  assert.strictEqual(cell(spot.x, 25, spot.z), 2, '泥土放草地顶(实心块贴面)');
  assert.strictEqual(A.advGetInv().slots[0].n, 2, '背包 −1');
  assert.ok(calls.some((c) => c[0] === 'edit' && c[4] === 2), '放置记账走 editBlock seam');
  /* 火把 thin: 放在刚放的泥土顶 ok / 贴侧面拒 */
  holdOnly('torch', 2);
  AdventureMode.onMouse(2, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0}); /* 泥土块顶面 */
  assert.strictEqual(cell(spot.x, 26, spot.z), api.B_TORCH, '火把放泥土顶 ok');
  assert.strictEqual(A.advGetInv().slots[0].n, 1, '火把 −1');
  calls.length = 0;
  AdventureMode.onMouse(2, {x: spot.x, y: 25, z: spot.z, nx: 1, ny: 0, nz: 0}); /* 贴侧面 → 拒 */
  assert.ok(!calls.some((c) => c[0] === 'edit'), 'thin 贴侧面不落块');
  assert.strictEqual(A.advGetInv().slots[0].n, 1, '被拒不扣物品');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('放不了') >= 0), '拒绝 toast');
  /* 收拾布景, 树苗放置走干净草地 */
  api.setBlockRaw(spot.x, 25, spot.z, 0);
  api.setBlockRaw(spot.x, 26, spot.z, 0);
  holdOnly('sapling', 1);
  AdventureMode.onMouse(2, hitTop);
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_SAPLING, '树苗放草地顶');
  assert.strictEqual(A.advSaplings.size, 1, '树苗挂上 20s 计时');
});

test('T12 树苗生长链: 20s 到期长成树 + 逐块记账 + 重进树还在(计时不落盘不重挂)', () => {
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  holdOnly('sapling', 1);
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.advSaplings.size, 1, '计时挂表');
  for (let i = 0; i < 39; i++) AdventureMode.update(0.5); /* 19.5s: 未到期 */
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_SAPLING, '19.5s 还是树苗');
  AdventureMode.update(0.5); /* 20s 到点 */
  assert.strictEqual(cell(spot.x, 25, spot.z), 5, '长成树干(SceneKit.tree 确定性外观)');
  assert.ok(cell(spot.x, 26, spot.z) === 5 || cell(spot.x, 26, spot.z) === 7, '树向上长');
  assert.strictEqual(A.advSaplings.size, 0, '到期移出计时 Map');
  AdventureMode.cleanup(); /* 落盘 */
  const saved = JSON.parse(mem.get('adventure_world_save'));
  const flat = (saved.edits || []).map((e) => e[0]);
  assert.ok(flat.includes(spot.x + ',25,' + spot.z), '树干格记账(edits 存差异)');
  freshInit(); /* 重进: 确定性重建 + edits 重放 */
  assert.strictEqual(cell(spot.x, 25, spot.z), 5, '重进树还在(不靠计时重演)');
  assert.strictEqual(A.advSaplings.size, 0, '长成的树不再是树苗, 不重挂计时');
});

test('T12 食物链: 点击吃 — 回血按 ITEMS.food + 血条账本同步 + 满血不吃不扣', () => {
  mem.clear();
  freshInit();
  A.advGetPEnt().hp = 20;
  A.ADV.player.hp = 20; /* 账本与实体同源(死亡政策口径) */
  holdOnly('apple', 2);
  spoken.length = 0;
  AdventureMode.onMouse(0, {x: 60, y: 24, z: 80, nx: 0, ny: 1, nz: 0}); /* 手持食物: 点击=吃, 不蓄力 */
  assert.strictEqual(A.advGetPEnt().hp, 24, '苹果回 4 血(ITEMS.food)');
  assert.strictEqual(A.ADV.player.hp, 24, '账本同步(头顶血条重绘依据)');
  assert.strictEqual(A.advGetInv().slots[0].n, 1, '吃掉 1 个');
  assert.ok(spoken.some((s) => String(s).indexOf('真好吃') >= 0), 'TTS 吃货播报');
  assert.strictEqual(A.advMine.down, false, '吃不打断也不开始蓄力');
  A.advGetPEnt().hp = 30;
  A.ADV.player.hp = 30; /* 满血 */
  AdventureMode.onMouse(0, {x: 60, y: 24, z: 80, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.advGetInv().slots[0].n, 1, '满血不吃不扣');
});

test('F3 金苹果行为链: 半血点击吃 — 回满血 + 扣 1 个, 满血不吃不扣(full 旗标经 advEatPolicy)', () => {
  mem.clear();
  freshInit();
  A.advGetPEnt().hp = 12;
  A.ADV.player.hp = 12; /* 账本与实体同源(死亡政策口径) */
  holdOnly('golden_apple', 2);
  spoken.length = 0;
  AdventureMode.onMouse(0, {x: 60, y: 24, z: 80, nx: 0, ny: 1, nz: 0}); /* 手持食物: 点击=吃 */
  assert.strictEqual(A.advGetPEnt().hp, 30, '金苹果回满血(full → maxHp, 无饥饿系统折算)');
  assert.strictEqual(A.ADV.player.hp, 30, '账本同步(头顶血条重绘依据)');
  assert.strictEqual(A.advGetInv().slots[0].n, 1, '吃掉 1 个');
  assert.ok(spoken.some((s) => String(s).indexOf('真好吃') >= 0), 'TTS 吃货播报');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('金苹果') >= 0), '吃掉 toast 带食物名');
  AdventureMode.onMouse(0, {x: 60, y: 24, z: 80, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.advGetInv().slots[0].n, 1, '满血不吃不扣');
  assert.strictEqual(A.advGetPEnt().hp, 30, '满血血量不动');
});

/* ============ T13 合成与烧炼接线 ============ */

test('T13 站点判定纯函数: advNearStation — 4 格边界(含等号)/按 id 过滤/空缓存', () => {
  const near = A.advNearStation;
  const sts = [{x: 10, y: 25, z: 10, id: api.B_CRAFT}, {x: 30, y: 25, z: 30, id: api.B_FURNACE}];
  assert.strictEqual(near(sts, 14.5, 10.5, 4, api.B_CRAFT), true, '水平距离恰 4 格 → 解锁(含等号)');
  assert.strictEqual(near(sts, 14.6, 10.5, 4, api.B_CRAFT), false, '4.1 格 → 不解锁');
  assert.strictEqual(near(sts, 10.5, 10.5, 4, api.B_CRAFT), true, '贴身解锁');
  assert.strictEqual(near(sts, 10.5, 10.5, 4, api.B_FURNACE), false, '按 id 过滤: 工作台位点不点亮熔炉判定');
  assert.strictEqual(near(sts, 33.5, 30.5, 4, api.B_FURNACE), true, '熔炉位点命中(缓存里两种站点并存)');
  assert.strictEqual(near([], 10, 10, 4, api.B_CRAFT), false, '空缓存(一个站点都没放过)');
});

test('T13 站点行为链: 放置工作台 → 走近 4 格解锁 + 首次靠近一句 TTS 引导 + 重进缓存重建', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  const spot = findGrassSpot();
  holdOnly('craft_table', 1);
  pos.x = spot.x + 2.5; pos.y = 25; pos.z = spot.z + 0.5; /* 站 2 格外放置(reach 6 内) */
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_CRAFT, '工作台放进世界(放置链复用 advTryPlace)');
  assert.strictEqual(A.advStationOk(), true, '站旁边 → table 级解锁(站点缓存命中, 不扫全图)');
  for (let i = 0; i < 5; i++) AdventureMode.update(1 / 60);
  assert.strictEqual(spoken.filter((s) => String(s).indexOf('工作台') >= 0).length, 1,
      '首次靠近给一句 TTS 引导(上升沿触发, 不唠叨)');
  pos.x = spot.x + 30; pos.z = spot.z + 30; /* 走远 */
  AdventureMode.update(1 / 60);
  assert.strictEqual(A.advStationOk(), false, '走出 4 格锁回(table 级卡片重新灰显)');
  /* 退世界重进: 站点只可能来自玩家放置(edits 全量差异) → 重放后缓存重建 */
  AdventureMode.cleanup();
  freshInit();
  pos.x = spot.x + 1.5; pos.z = spot.z + 0.5;
  assert.strictEqual(A.advStationOk(), true, '重进后已放置站点仍在缓存(edits 重放收集)');
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_CRAFT, '工作台方块也在(存档往返)');
});

test('T13 onCraft 链路: TTS 具体表扬(产物名入句) + leftover 转脚下掉落物 + 零余量不 spawn', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  const inv = A.advGetInv();
  const before = globalThis.Drops.list().length;
  A.advOnCraft({item: 'planks', n: 4, leftover: 3}); /* 满包合成: 3 件放不下(craft 已扣料) */
  assert.ok(spoken.some((s) => String(s).indexOf('木板') >= 0 && String(s).indexOf('做好啦') >= 0 &&
      String(s).indexOf('想办法') >= 0), 'TTS 表扬: 产物名入句 + 夸努力口径(D8 例句)');
  const got = globalThis.Drops.list().slice(before);
  assert.strictEqual(got.length, 1, '余量整撮成一个掉落物实体');
  assert.strictEqual(got[0].id, 'planks', '掉落物 = 产物本体');
  assert.strictEqual(got[0].n, 3, '余量 3 件(Drops.spawn 脚下, 零惩罚口径)');
  assert.ok(Math.hypot(got[0].x - pos.x, got[0].z - pos.z) < 1.5, '落在玩家脚边');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('木板') >= 0), 'toast 回显');
  /* 零余量: 不产生掉落物 */
  const before2 = globalThis.Drops.list().length;
  A.advOnCraft({item: 'planks', n: 4, leftover: 0});
  assert.strictEqual(globalThis.Drops.list().length, before2, 'leftover 0 不 spawn');
  assert.ok(inv, '背包对象稳定(面板闭包不脱钩)');
});

test('T13 烧炼节律纯函数: advSmeltStep — 2.5s/件 · 煤热值 8 件 · 无热暂停进度保留 · 余时结转', () => {
  const step = A.advSmeltStep;
  const mk = (n) => ({input: {id: 'iron_ore', n}, fuel: {id: 'coal', n: 1}, out: null, heat: 0, prog: 0});
  /* 一件: 恰 2.5s 烧成; 唯一一块煤折成热值入炉(自动燃料), 烧 1 件后余 7 */
  const s = step(mk(1), 2.5);
  assert.deepStrictEqual(s.out, {id: 'iron_ingot', n: 1}, '2.5s 产一件(D8: MC 10s → 儿童 2.5s)');
  assert.strictEqual(s.input, null, '料尽清空');
  assert.strictEqual(s.fuel, null, '煤 1 件已折成热值入炉');
  assert.strictEqual(s.heat, 7, '煤热值 8 件: 烧 1 件后余 7');
  assert.strictEqual(s.prog, 0, '完成后进度归零');
  /* 一块煤正好烧 8 件(ITEMS.fuel 热值口径) */
  let s8 = mk(8);
  for (let i = 0; i < 8; i++) s8 = step(s8, 2.5);
  assert.deepStrictEqual(s8.out, {id: 'iron_ingot', n: 8}, '一块煤(热值 8)烧完 8 件铁锭');
  assert.strictEqual(s8.input, null, '料尽');
  assert.strictEqual(s8.heat, 0, '热值耗光(8 件 × 2.5s = 20s = 8 热值)');
  /* 无热无燃料: 暂停且进度保留(关面板/燃料断档都不清零不白烧) */
  const ps = step({input: {id: 'iron_ore', n: 2}, fuel: null, out: null, heat: 0, prog: 1.2}, 5);
  assert.strictEqual(ps.prog, 1.2, '暂停进度保留');
  assert.strictEqual(ps.out, null, '暂停不产出');
  /* 大步长: 余时结转下一件 + 进度钳在 2.5 内 */
  const big = step(mk(3), 6);
  assert.strictEqual(big.out.n, 2, '6s 一气烧成 2 件');
  assert.ok(Math.abs(big.prog - 1) < 1e-9, '余 1s 结转下一件(6 - 2×2.5)');
  assert.ok(big.prog <= 2.5, '进度钳制(显示层再钳一次)');
});

test('T13 退炉政策纯函数: advFurnaceRefund — 炉内三笔全额退包 + 满包转余量清单', () => {
  const inv = api.mkInventory();
  const left = A.advFurnaceRefund(inv, {input: {id: 'iron_ore', n: 3}, fuel: {id: 'coal', n: 2},
    out: {id: 'iron_ingot', n: 2}, heat: 1.5, prog: 0.8});
  assert.deepStrictEqual(left, [], '有空位: 三笔全退(零惩罚口径)');
  assert.strictEqual(api.count(inv, 'iron_ore'), 3, '待烧料退回');
  assert.strictEqual(api.count(inv, 'coal'), 2, '燃料退回');
  assert.strictEqual(api.count(inv, 'iron_ingot'), 2, '产物退回');
  const full = api.mkInventory();
  for (let i = 0; i < api.INV_SLOTS; i++) full.slots[i] = {id: 'stone', n: 64};
  const left2 = A.advFurnaceRefund(full, {input: {id: 'iron_ore', n: 3}, fuel: {id: 'coal', n: 2},
    out: {id: 'iron_ingot', n: 2}, heat: 0, prog: 0});
  assert.deepStrictEqual(left2, [{id: 'iron_ore', n: 3}, {id: 'coal', n: 2}, {id: 'iron_ingot', n: 2}],
      '满包容纳不下 → 逐笔转掉落清单(调用方 Drops.spawn 脚下)');
});

test('T13 TNT 掷骰纯函数: advTntRoll — 70% 门槛种子化 + 中签才走掉落表', () => {
  /* rollBlockDrop 产自 vm 语境(数组/原型与宿主不同), 展开映射进宿主数组再比对 */
  const roll = (id, r) => [...A.advTntRoll(id, r).map((d) => [d.id, d.n])];
  assert.deepStrictEqual(roll(3, () => 0.69), [['cobble', 1]], '0.69 < 0.7 中签 → 石头掉圆石');
  assert.strictEqual(roll(3, () => 0.7).length, 0, '恰 0.7 不中签(MC 30% → 儿童加倍 70%)');
  assert.strictEqual(roll(3, () => 0.99).length, 0, '远不中签 → 只碎不掉');
  /* 树叶: 中签后掉落表条目照掷(rand 恒 0 → 三样概率全中, 无保底) */
  assert.deepStrictEqual(roll(7, () => 0).map((e) => e[0]), ['sapling', 'apple', 'stick'],
      '中签后 rollBlockDrop 原样掷(保底+概率)');
  assert.strictEqual(roll(20, () => 0).length, 0, 'tnt 旗标守卫恒空手(不自掉, D3 与 drop 字段解耦)');
});

test('T13 TNT 伤害纯函数: advTntDmg — 爆心 30 · 波及边缘 12 · 线性衰减', () => {
  assert.strictEqual(A.advTntDmg(0), 30, '爆心最痛(僵尸 30 一击清场)');
  assert.strictEqual(A.advTntDmg(1.5), 24, '中途线性衰减 24');
  assert.strictEqual(A.advTntDmg(4.5), 12, '波及边缘 12');
  assert.strictEqual(A.advTntDmg(9), 12, '越界钳制(调用方已按半径过滤)');
});

test('T13 熔炉行为链: 走近点击开面板 → 自动放料(扣包) → 2.5s/件烧成 → 关面板取产入包', () => {
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  holdOnly('furnace', 1);
  pos.x = spot.x + 0.5; pos.y = 25; pos.z = spot.z + 2.5;
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_FURNACE, '熔炉放进世界(放置链复用 advTryPlace)');
  /* 离 4 格远点击: 不开面板只给提示; 走近点击才开 */
  pos.x = spot.x + 20; pos.z = spot.z + 20;
  calls.length = 0;
  AdventureMode.onMouse(0, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.ADV.furnaceOpen, false, '离炉 20 格: 点击不开面板(4 格门槛)');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('走近') >= 0), '给走近提示');
  pos.x = spot.x + 0.5; pos.z = spot.z + 2.5; /* 距炉 2 格 */
  AdventureMode.onMouse(0, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.ADV.furnaceOpen, true, '走近 4 格内点击熔炉 → 打开烧炼面板');
  const fk = api.blockKey(spot.x, 25, spot.z);
  assert.strictEqual(A.advGetFurnaceAt(), fk, '面板绑定这台炉(F1 拍板①)');
  /* 自动放料: 面板只报意图, 模式层执行 take — 矿石全入炉 + 最省凑料 1 块煤(热值 8 ≥ 5 件) */
  api.add(A.advGetInv(), 'iron_ore', 5);
  api.add(A.advGetInv(), 'coal', 2);
  A.advFurnaceAutoFill();
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 0, '矿石全入炉(take 扣包)');
  assert.strictEqual(api.count(A.advGetInv(), 'coal'), 1, '最省凑料: 1 块煤已覆盖 5 件热值');
  assert.strictEqual(A.advFurnaceState(fk).input.n, 5, '炉内待烧 5 件');
  assert.strictEqual(A.advFurnaceState(fk).fuel.n, 1, '炉内燃料 1 块煤');
  /* 烧炼 12.5s+: 5 件铁锭 + 完成播报(产物名入句) */
  spoken.length = 0;
  for (let i = 0; i < 340; i++) AdventureMode.update(0.05); /* 17s > 12.5s */
  assert.deepStrictEqual(A.advFurnaceState(fk).out, {id: 'iron_ingot', n: 5}, '5 件全部烧成');
  assert.ok(spoken.some((s) => String(s).indexOf('铁锭') >= 0 && String(s).indexOf('烧好') >= 0),
      '完成播报(产物名入句)');
  A.advFurnaceClose();
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ingot'), 5, '关面板取产入包');
  assert.strictEqual(A.ADV.furnaceOpen, false, '面板收起');
  assert.strictEqual(A.advFurnaceState(fk).out, null, '产物槽清空');
});

test('F1 死亡不动炉: 阵亡回出生点满血, 炉内容原样保留(拍板①持久化——旧清炉政策退役)', () => {
  mem.clear();
  freshInit();
  const s = findGrassSpot();
  api.setBlockRaw(s.x, 25, s.z, api.B_FURNACE);
  A.advMarkEdit(s.x, 25, s.z, api.B_FURNACE);
  const fk = api.blockKey(s.x, 25, s.z);
  api.add(A.advGetInv(), 'iron_ore', 3);
  api.add(A.advGetInv(), 'coal', 1);
  pos.x = s.x + 0.5; pos.y = 25; pos.z = s.z + 0.5;
  AdventureMode.onMouse(0, {x: s.x, y: 25, z: s.z, nx: 0, ny: 1, nz: 0});
  A.advFurnaceAutoFill();
  const f = A.advFurnaceState(fk);
  assert.ok(f && f.input, '料已入炉(前提)');
  f.out = {id: 'iron_ingot', n: 2};
  AdventureMode.onVoidFall(); /* 死亡类事件 → advPlayerDied */
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 0, '炉料不退包(留在炉里)');
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ingot'), 0, '产物不退包');
  const f2 = A.advFurnaceState(fk);
  assert.deepStrictEqual(f2.input, {id: 'iron_ore', n: 3}, '炉态原样保留');
  assert.deepStrictEqual(f2.fuel, {id: 'coal', n: 1});
  assert.deepStrictEqual(f2.out, {id: 'iron_ingot', n: 2});
});

test('F1 炉态持久化: cleanup 只落盘不退料(旧 D8 退料退役) — 重进炉内物品/进度照旧继续烧', () => {
  mem.clear();
  freshInit();
  const s = findGrassSpot();
  api.setBlockRaw(s.x, 25, s.z, api.B_FURNACE);
  A.advMarkEdit(s.x, 25, s.z, api.B_FURNACE);
  const fk = api.blockKey(s.x, 25, s.z);
  api.add(A.advGetInv(), 'iron_ore', 3);
  api.add(A.advGetInv(), 'coal', 1);
  pos.x = s.x + 0.5; pos.y = 25; pos.z = s.z + 0.5;
  AdventureMode.onMouse(0, {x: s.x, y: 25, z: s.z, nx: 0, ny: 1, nz: 0});
  A.advFurnaceAutoFill();
  for (let i = 0; i < 24; i++) AdventureMode.update(0.05); /* 1.2s: 首件烧到半程 */
  const f = A.advFurnaceState(fk);
  assert.ok(f.prog > 0.5 && f.prog < 2.5, '首件半程进度(断点前提)');
  A.advFurnaceClose();
  AdventureMode.cleanup();
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 0, '不退料——炉态随世界档走');
  const wsv = JSON.parse(mem.get('adventure_world_save'));
  assert.ok(Array.isArray(wsv.furnaces) &&
      wsv.furnaces.some((e) => e[0] === fk && e[1].input && e[1].input.n === 3),
  '炉内三笔进 furnaces 字段');
  /* 重进: 炉态恢复(物品/热值/进度), 接着烧完——煤在开烧瞬间整件折成热值,
     断点时燃料槽空、热值在档是正确状态(燃料按件计费口径) */
  freshInit();
  const f2 = A.advFurnaceState(fk);
  assert.ok(f2, '重进炉态恢复');
  assert.deepStrictEqual({id: f2.input.id, n: f2.input.n}, {id: 'iron_ore', n: 3});
  assert.strictEqual(f2.fuel, null, '煤已折成热值(燃料槽空)');
  assert.ok(f2.heat > 7 && f2.heat <= 8, '热值随档(8 − 已烧 0.48)');
  assert.ok(Math.abs(f2.prog - f.prog) < 0.01, '烧炼进度原样(接着烧)');
  for (let i = 0; i < 140; i++) AdventureMode.update(0.05); /* 7s > 余下 6.3s */
  assert.deepStrictEqual(A.advFurnaceState(fk).out, {id: 'iron_ingot', n: 3}, '恢复后继续烧成');
});

test('F1 多炉独立: 两炉异料并烧各产各的 + 面板绑定哪台看哪台 + TTS 只报绑定炉', () => {
  mem.clear();
  freshInit();
  const spots = [];
  outer: for (let x = 3; x < 50; x++) {
    for (let z = 3; z < 50; z++) {
      if (cell(x, 24, z) === 1 && cell(x, 25, z) === 0 && cell(x, 26, z) === 0) {
        spots.push({x, z});
        if (spots.length === 2) break outer;
      }
    }
  }
  assert.strictEqual(spots.length, 2, '两块干净草地(前提)');
  for (const s of spots) {
    api.setBlockRaw(s.x, 25, s.z, api.B_FURNACE);
    A.advMarkEdit(s.x, 25, s.z, api.B_FURNACE);
  }
  const k1 = api.blockKey(spots[0].x, 25, spots[0].z);
  const k2 = api.blockKey(spots[1].x, 25, spots[1].z);
  api.add(A.advGetInv(), 'iron_ore', 3);
  api.add(A.advGetInv(), 'sand', 2);
  api.add(A.advGetInv(), 'coal', 2);
  /* 炉1: 吃首现矿种铁(单槽单矿种), 沙子留包 */
  pos.x = spots[0].x + 0.5; pos.y = 25; pos.z = spots[0].z + 0.5;
  AdventureMode.onMouse(0, {x: spots[0].x, y: 25, z: spots[0].z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.advGetFurnaceAt(), k1, '点击炉1 绑定炉1');
  A.advFurnaceAutoFill();
  assert.deepStrictEqual(A.advFurnaceState(k1).input, {id: 'iron_ore', n: 3}, '炉1 吃铁矿');
  assert.strictEqual(api.count(A.advGetInv(), 'sand'), 2, '沙子留在包里(单槽单矿种口径)');
  A.advFurnaceClose();
  /* 炉2: 吃沙 */
  pos.x = spots[1].x + 0.5; pos.z = spots[1].z + 0.5;
  AdventureMode.onMouse(0, {x: spots[1].x, y: 25, z: spots[1].z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.advGetFurnaceAt(), k2, '点击炉2 绑定切换');
  A.advFurnaceAutoFill();
  assert.deepStrictEqual(A.advFurnaceState(k2).input, {id: 'sand', n: 2}, '炉2 吃沙子');
  /* 双炉并烧 8s(炉1 3 件 7.5s / 炉2 2 件 5s): 面板开着的是炉2 —
     炉2 完成播报玻璃; 炉1 完成不播(非绑定炉不合唱) */
  spoken.length = 0;
  for (let i = 0; i < 160; i++) AdventureMode.update(0.05); /* 8s */
  assert.deepStrictEqual(A.advFurnaceState(k1).out, {id: 'iron_ingot', n: 3}, '炉1 各烧各的(铁锭×3)');
  assert.deepStrictEqual(A.advFurnaceState(k2).out, {id: 'glass', n: 2}, '炉2 各烧各的(玻璃×2)');
  assert.ok(spoken.some((t) => String(t).indexOf('玻璃') >= 0 && String(t).indexOf('烧好') >= 0),
      '绑定炉(炉2)完成播报');
  assert.ok(!spoken.some((t) => String(t).indexOf('铁锭') >= 0), '非绑定炉(炉1)烧成不播报');
});

test('F1 挖炉退料: 挖掉熔炉 → 三笔全额入包 + 炉状态删除 + 绑定面板连带关闭(挖掘/TNT 同一钩子)', () => {
  mem.clear();
  freshInit();
  const s = findGrassSpot();
  api.setBlockRaw(s.x, 25, s.z, api.B_FURNACE);
  A.advMarkEdit(s.x, 25, s.z, api.B_FURNACE);
  const fk = api.blockKey(s.x, 25, s.z);
  api.add(A.advGetInv(), 'iron_ore', 3);
  api.add(A.advGetInv(), 'coal', 2);
  pos.x = s.x + 0.5; pos.y = 25; pos.z = s.z + 0.5;
  AdventureMode.onMouse(0, {x: s.x, y: 25, z: s.z, nx: 0, ny: 1, nz: 0});
  A.advFurnaceAutoFill();
  assert.strictEqual(A.advFurnaceState(fk).fuel.n, 1, '1 块煤入炉(前提)');
  /* 蓄力链有专测 — 直接走破坏 seam(退炉钩在 advMarkEdit, 挖掘/TNT 爆炸同路) */
  A.advBreakBlock(s.x, 25, s.z, api.B_FURNACE, {time: 0.5, drops: true});
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 3, '待烧料全额退包');
  assert.strictEqual(api.count(A.advGetInv(), 'coal'), 2, '燃料退包(炉内 1 + 背包余 1)');
  assert.strictEqual(A.advFurnaceState(fk), null, '炉状态删除');
  assert.strictEqual(A.ADV.furnaceOpen, false, '绑定面板连带关闭');
});

test('F2 炉口火焰差异增删: 燃烧=heat>0且有料在列 · 无料/熄灭出列 · 挖炉即清 · 退出全清', () => {
  mem.clear();
  freshInit();
  /* 炉态直灌 Map(F1 多炉口径, T15 记账先例)——观感层不进方块数据/存档,
     Node 无 THREE 只断言差异增删节律(advFlameCount 只读计数 seam) */
  const fk = api.blockKey(12, 25, 12);
  A.advFurnaces.set(fk, {input: {id: 'iron_ore', n: 2}, fuel: {id: 'coal', n: 1}, out: null, heat: 4, prog: 0});
  assert.strictEqual(A.advFlameCount(), 0, '未起烧(计数前提)');
  AdventureMode.update(0.05);
  assert.strictEqual(A.advFlameCount(), 1, '燃烧中(heat>0 且有料) → 火焰在列');
  /* 无料有热不算烧(与 advSmeltStep 推进条件一致——设计稿 §2.1 燃烧判定) */
  A.advFurnaceState(fk).input = null;
  AdventureMode.update(0.05);
  assert.strictEqual(A.advFlameCount(), 0, '无料(余热尚在) → 差异删');
  A.advFurnaceState(fk).input = {id: 'iron_ore', n: 1};
  AdventureMode.update(0.05);
  assert.strictEqual(A.advFlameCount(), 1, '补料复烧 → 差异加');
  /* 热值耗尽(无热无燃料): 熄灭出列(advSmeltStep 每步写回新对象, 改前须重取) */
  const fx = A.advFurnaceState(fk);
  fx.heat = 0; fx.fuel = null;
  AdventureMode.update(0.05);
  assert.strictEqual(A.advFlameCount(), 0, '热值耗尽 → 熄灭出列');
  /* 挖炉(advFurnaceDrop 钩子, 挖掘/TNT 同路): 不等下一帧即时清 */
  A.advFurnaceState(fk).heat = 4;
  AdventureMode.update(0.05);
  assert.strictEqual(A.advFlameCount(), 1, '再燃(前提)');
  A.advFurnaceDrop(fk);
  assert.strictEqual(A.advFlameCount(), 0, '挖炉 → 火焰即时清(场景对象不渗漏)');
  /* 退出模式: 全清 */
  A.advFurnaces.set(fk, {input: {id: 'iron_ore', n: 2}, fuel: {id: 'coal', n: 1}, out: null, heat: 4, prog: 0});
  AdventureMode.update(0.05);
  assert.strictEqual(A.advFlameCount(), 1, '燃烧中(前提)');
  AdventureMode.cleanup();
  assert.strictEqual(A.advFlameCount(), 0, 'cleanup → 火焰全清');
});

test('T13 TNT 行为链: 放置 → 空手短按点燃 → 引信延时 → 爆炸破坏记账 + 波及怪物受击', () => {
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  holdOnly('tnt', 1);
  pos.x = spot.x + 0.5; pos.y = 25; pos.z = spot.z + 2.5;
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_TNT, 'TNT 放进世界(5 火药+4 沙合成的放置型物品)');
  holdOnly(null); /* 空手也能点(手持任意口径) */
  calls.length = 0;
  AdventureMode.onMouse(0, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0});
  AdventureMode.update(0.05); /* 短按判定(D3): 测试环境无按住 → 松手即点燃 */
  assert.strictEqual(A.advFuses.length, 1, '短按点燃引信(advTntTapTick 松手判定)');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('点燃') >= 0), '点燃提示');
  /* 玩家走远(TNT 不伤玩家 — 儿童挖矿神器口径), 引信 1.45s 后布一只静止的怪在波及圈 */
  pos.x = spot.x + 20; pos.z = spot.z + 20;
  listResult = [];
  for (let i = 0; i < 29; i++) AdventureMode.update(0.05);
  const still = {name: '僵尸', hp: 30, dmg: 5, speed: 0, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55};
  const mob = mkAdvMob('zombie', spot.x + 2.0, 25, spot.z + 0.5, {nest: 0, cfg: still}); /* 距爆心 1.5 格 */
  listResult = [mob];
  nextHit = {hp: 6, dead: false, freshDead: false};
  hitLog.length = 0;
  for (let i = 0; i < 3; i++) AdventureMode.update(0.05); /* 引信到点起爆 */
  assert.strictEqual(A.advFuses.length, 0, '引信烧完');
  assert.strictEqual(cell(spot.x, 25, spot.z), 0, 'TNT 源块清除');
  assert.ok(calls.some((c) => c[0] === 'boom'), 'Fx.boom 爆炸观感(旧 TNT 模式口径)');
  assert.ok(hitLog.some((h) => h.m === mob && h.dmg === 24), '波及怪物受击(距爆心 1.5 格 → 伤害 24)');
  /* 破坏记账: 半径内可采集方块逐块 editBlock+记账, 70% 掷骰产生掉落物 */
  const edits = calls.filter((c) => c[0] === 'edit' && c[4] === 0);
  assert.ok(edits.length >= 10, '半径内方块破坏走 editBlock+记账: ' + edits.length + ' 格');
  assert.ok(globalThis.Drops.list().length >= 1, '70% 掷骰掉落物落地(统计上必有一批)');
});

test('T13 TNT 短按/按住二分(D3): 按住 0.25s+ 转蓄力挖走回收, 短按点燃', () => {
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  holdOnly('tnt', 1);
  pos.x = spot.x + 0.5; pos.y = 25; pos.z = spot.z + 2.5;
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_TNT, 'TNT 放进世界');
  holdOnly(null); /* 空手挖(手持任意口径) */
  aimDownAt(spot); /* 准星 fake: 射线打最高块 = y25 的 TNT */
  A.advMouseHeldOn(); /* 模拟桌面 mousedown 按住 */
  AdventureMode.onMouse(0, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0});
  for (let i = 0; i < 5; i++) AdventureMode.update(0.05); /* 0.25s: 短按窗口耗尽 */
  assert.strictEqual(A.advGetTntTap(), null, 'tap 已转蓄力');
  assert.strictEqual(A.advFuses.length, 0, '按住不点燃');
  for (let i = 0; i < 6 && cell(spot.x, 25, spot.z) !== 0; i++) AdventureMode.update(0.05); /* 0.15s 蓄满 */
  assert.strictEqual(cell(spot.x, 25, spot.z), 0, 'TNT 挖走(editBlock 破坏, MC 硬度 0 可回收)');
  assert.ok(globalThis.Drops.list().some((d) => d.id === 'tnt'), '掉 tnt 物品回收');
  A.advMouseHeldOff();
  /* 短按回路: 再放一块 → 点按松手 → 点燃(现状口径回归锚点) */
  holdOnly('tnt', 1);
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  holdOnly(null);
  calls.length = 0;
  AdventureMode.onMouse(0, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0});
  AdventureMode.update(0.05); /* 无按住 → 松手即点燃 */
  assert.strictEqual(A.advFuses.length, 1, '短按=点燃(现状口径不变)');
  clearAim();
});

test('T12 剪刀树叶行为链(D2): 剪刀破坏树叶掉树叶方块, 掉落走 shearDrop 专属表', () => {
  mem.clear();
  freshInit();
  holdOnly('shears', 1, 500);
  const spot = findGrassSpot();
  api.setBlockRaw(spot.x, 25, spot.z, 7); /* 树叶布景(准星射线最高块) */
  aimDownAt(spot);
  AdventureMode.onMouse(0, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0});
  for (let i = 0; i < 4 && cell(spot.x, 25, spot.z) !== 0; i++) AdventureMode.update(0.15); /* 0.2×1.5/5 触下限 0.15s */
  assert.strictEqual(cell(spot.x, 25, spot.z), 0, '树叶剪碎(剪刀品类匹配加速)');
  assert.ok(globalThis.Drops.list().some((d) => d.id === 'leaves' && d.n === 1),
      '剪刀 × shearDrop: 掉树叶方块本身(修复 leaves 物品无获取途径)');
  assert.ok(!globalThis.Drops.list().some((d) => d.id === 'sapling'), '不掉默认表的概率件');
  assert.strictEqual(A.advGetInv().slots[0].dur, 499, '剪刀耐久 −1');
  clearAim();
});

/* ============ 引导链 v2: 15 步主线 + 终章 + 大宝箱 ============ */

test('QUESTS 数据表: 15 步主线 + 终章 — 步序照引导链 v2, 形状齐, id 唯一', () => {
  const qs = A.ADV_QUESTS;
  assert.strictEqual(qs.length, 16, '15 步主线 + 终章');
  assert.deepStrictEqual(qs.map((q) => q.id),
      ['q1_log', 'q2_planks', 'q3_table', 'q4_chest', 'q5_sapling', 'q6_pick_wood',
        'q7_cobble', 'q8_pick_stone', 'q9_coal', 'q10_torch', 'q11_iron', 'q12_smelt',
        'q13_pick_iron', 'q14_fight', 'q15_diamond', 'finale'],
      '步序 = 引导链 v2(砍树→木板→工作台→箱子→树苗→木镐→圆石→石镐→煤→火把→铁矿→熔炉铁锭→铁镐→战斗→钻石→钻石剑, docs/story-quest-research.md)');
  assert.strictEqual(qs[15].finale, true, '第 16 条是终章(主线 15 条不带 finale 标记)');
  assert.ok(qs.slice(0, 15).every((q) => !q.finale), '主线步骤无 finale 标记');
  qs.forEach((q, i) => {
    assert.ok(typeof q.id === 'string' && q.id, '步 ' + i + ' 有 id');
    assert.ok(typeof q.icon === 'string' && q.icon, '步 ' + i + ' 有图标(emoji)');
    assert.ok(typeof q.goal === 'string' && q.goal, '步 ' + i + ' 有目标文案');
    assert.ok(q.target >= 1, '步 ' + i + ' target ≥ 1');
    assert.strictEqual(typeof q.hint, 'string', '步 ' + i + ' 有语音引导');
    assert.ok(q.hint.length > 0, '步 ' + i + ' 引导非空');
    assert.strictEqual(typeof q.praise, 'string', '步 ' + i + ' 有完成表扬');
    assert.ok(q.praise.length > 0, '步 ' + i + ' 表扬非空');
    assert.strictEqual(typeof q.prog, 'function', '步 ' + i + ' prog 纯函数(进度分子)');
    assert.strictEqual(typeof q.check, 'function', '步 ' + i + ' check 纯函数(触发谓词)');
  });
  assert.strictEqual(new Set(qs.map((q) => q.id)).size, 16, 'id 唯一');
});

test('T15 谓词逐条: 最小满足触发 / 空账本或差一不触发 / 复合步条件缺一不可', () => {
  const qs = A.ADV_QUESTS;
  const ck = (i, c) => qs[i].check(c);
  assert.strictEqual(ck(0, {collect_log: 5}), true, '步1: 捡 5 原木(v2 原木预算: 5 根=20 板恰好覆盖早期链)');
  assert.strictEqual(ck(0, {collect_log: 4}), false, '步1: 差一根');
  assert.strictEqual(ck(0, {}), false, '步1: 空账本');
  assert.strictEqual(ck(1, {craft_planks: 4}), true, '步2: 合成 4 木板(一次手搓即 4)');
  assert.strictEqual(ck(1, {craft_planks: 3}), false, '步2: 差一块');
  assert.strictEqual(ck(2, {craft_craft_table: 1, place_craft_table: 1}), true, '步3: 合成+放置');
  assert.strictEqual(ck(2, {craft_craft_table: 1}), false, '步3: 只合成没放下');
  assert.strictEqual(ck(2, {place_craft_table: 1}), false, '步3: 只放下不算(文案「合成并放置」)');
  assert.strictEqual(ck(3, {craft_chest: 1, place_chest: 1, open_chest: 1}), true, '步4: 箱子三条件');
  assert.strictEqual(ck(3, {craft_chest: 1, place_chest: 1}), false, '步4: 没打开不算(收纳要教到交互)');
  assert.strictEqual(ck(3, {craft_chest: 1, open_chest: 1}), false, '步4: 没放置不算');
  assert.strictEqual(ck(4, {place_sapling: 1}), true, '步5: 种树苗');
  assert.strictEqual(ck(5, {craft_pick_wood: 1}), true, '步6: 木镐');
  assert.strictEqual(ck(6, {mine_cobble: 8}), true, '步7: 挖 8 圆石');
  assert.strictEqual(ck(6, {mine_cobble: 7}), false, '步7: 差一块');
  assert.strictEqual(ck(7, {craft_pick_stone: 1}), true, '步8: 石镐');
  assert.strictEqual(ck(8, {mine_coal_ore: 5}), true, '步9: 挖 5 煤');
  assert.strictEqual(ck(8, {mine_coal_ore: 4}), false, '步9: 差一个');
  assert.strictEqual(ck(9, {craft_torch: 4}), true, '步10: 合成 4 火把(一次配方即 4)');
  assert.strictEqual(ck(10, {mine_iron_ore: 5}), true, '步11: 挖 5 铁矿');
  assert.strictEqual(ck(11, {place_furnace: 1, smelt_iron_ingot: 3}), true, '步12: 放熔炉+烧 3 铁锭');
  assert.strictEqual(ck(11, {smelt_iron_ingot: 3}), false, '步12: 只烧没放炉不算');
  assert.strictEqual(ck(11, {place_furnace: 1, smelt_iron_ingot: 2}), false, '步12: 差一块铁锭');
  assert.strictEqual(ck(12, {craft_pick_iron: 1}), true, '步13: 铁镐');
  assert.strictEqual(ck(13, {kill_mob: 1}), true, '步14: 打败 1 只怪物');
  assert.strictEqual(ck(14, {mine_diamond_ore: 3}), true, '步15: 挖 3 钻石');
  assert.strictEqual(ck(14, {mine_diamond_ore: 2}), false, '步15: 差一颗');
  assert.strictEqual(ck(15, {craft_sword_diamond: 1}), true, '终章: 合成钻石剑');
  assert.strictEqual(ck(15, {craft_pick_diamond: 1}), false, '终章: 钻石镐不算(要的是剑)');
  /* prog 进度分子: 复合步取各条件已得之和, 单条件步钳在 target */
  assert.strictEqual(qs[2].prog({craft_craft_table: 1}), 1, '步3 prog: 合成半程');
  assert.strictEqual(qs[3].prog({craft_chest: 1, place_chest: 1}), 2, '步4 prog: 三条件走到 2');
  assert.strictEqual(qs[11].prog({place_furnace: 1, smelt_iron_ingot: 2}), 3, '步12 prog: 1+2');
  assert.strictEqual(qs[0].prog({collect_log: 9}), 5, '步1 prog: 超量钳在 target');
  assert.strictEqual(qs[0].prog({}), 0, '空账本 prog 0');
});

test('事件计数累计链: 挖→拾取→合成→放置→烧成→开箱→击杀 七类挂点只 += (与步进解耦)', () => {
  mem.clear();
  freshInit();
  const c = () => A.ADV.quest.counts;
  /* 挖: 玩家蓄力破坏石头 ×8(掉圆石) — advBreakBlock 挂点 */
  for (let i = 0; i < 8; i++) A.advBreakBlock(90 + i, 24, 90, 3, {time: 1, drops: true});
  assert.strictEqual(c().mine_cobble, 8, '挖 8 块石头 → mine_cobble 8');
  /* 拾取: init 挂的 Drops 收集回调链 — advOnCollect 挂点 */
  dropsState.cbs[0]('log', 1);
  dropsState.cbs[0]('log', 2);
  assert.strictEqual(c().collect_log, 3, '捡原木 1+2 → collect_log 3');
  /* 合成: advOnCraft 挂点(按产出件数累计) */
  A.advOnCraft({item: 'planks', n: 4, leftover: 0});
  assert.strictEqual(c().craft_planks, 4, '合成一次木板 4 件 → craft_planks 4');
  /* 放置: advTryPlace 成功分支(站点两键 + 引导链 v2 的箱子/树苗) */
  let spot = findGrassSpot();
  holdOnly('craft_table', 1);
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(c().place_craft_table, 1, '放置工作台 → place_craft_table 1');
  spot = findGrassSpot(); /* 上一格已被占, 顺延下一块净地 */
  holdOnly('chest', 1);
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(c().place_chest, 1, '放置箱子 → place_chest 1(引导链 v2)');
  spot = findGrassSpot();
  holdOnly('sapling', 1);
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(c().place_sapling, 1, '种下树苗 → place_sapling 1(引导链 v2)');
  /* 开箱: advChestOpenPanel 挂点(开箱即记账, 不等搬运) */
  A.advChestOpenPanel();
  assert.strictEqual(c().open_chest, 1, '打开箱子 → open_chest 1(引导链 v2)');
  A.advChestClose();
  /* 烧成: advFurnaceTick 产出分支(3 件铁锭 = 7.5s+) — 炉态直灌 Map(F1 多炉口径) */
  spot = findGrassSpot();
  A.advFurnaces.set(api.blockKey(spot.x, 25, spot.z), {input: {id: 'iron_ore', n: 3},
    fuel: {id: 'coal', n: 1}, out: null, heat: 0, prog: 0});
  for (let i = 0; i < 170; i++) AdventureMode.update(0.05); /* 8.5s */
  assert.strictEqual(c().smelt_iron_ingot, 3, '烧成 3 件铁锭 → smelt_iron_ingot 3');
  /* 击杀: advOnKill 挂点(挥击/箭/TNT 三路共用) */
  A.advOnKill({pos: {x: 60, y: 25, z: 60}, type: 'zombie'});
  assert.strictEqual(c().kill_mob, 1, '击杀怪物 → kill_mob 1(引导链 v2)');
  /* 未发生的事件不预置键(账本从零长出来) */
  assert.strictEqual(c().mine_diamond_ore, undefined, '没挖钻石就没有键');
});

test('T15 不越级: 第 n 步只查第 n 步谓词 — 后期计数全满仍逐级推进(一周期一步)', () => {
  mem.clear();
  freshInit();
  /* 把全部计数一次灌满(模拟玩家把后面的事全提前做了) — 步进仍从第 1 步逐级走 */
  const c = A.ADV.quest.counts;
  c.collect_log = 5; c.craft_planks = 4; c.craft_craft_table = 1; c.place_craft_table = 1;
  c.craft_chest = 1; c.place_chest = 1; c.open_chest = 1; c.place_sapling = 1;
  c.craft_pick_wood = 1; c.mine_cobble = 8; c.craft_pick_stone = 1; c.mine_coal_ore = 5;
  c.craft_torch = 4; c.mine_iron_ore = 5; c.place_furnace = 1; c.smelt_iron_ingot = 3;
  c.craft_pick_iron = 1; c.kill_mob = 1; c.mine_diamond_ore = 3; c.craft_sword_diamond = 1;
  AdventureMode.update(0.51); /* 一个节流周期只查当前步一次 */
  assert.strictEqual(A.ADV.quest.step, 1, '首查只推第 1 步(不直接跳终章)');
  AdventureMode.update(0.51);
  assert.strictEqual(A.ADV.quest.step, 2, '逐级推进: 一步一周期');
});

test('T15 步进链(行为): 捡齐 5 原木 → 表扬 TTS+完成 toast+音效+引导下一步+落盘+任务卡刷新', () => {
  mem.clear();
  freshInit();
  assert.ok(spoken.some((s) => String(s).indexOf('原木') >= 0), '进场欢迎句带第 1 步语音引导(hint 并句, 不 cancel 打断)');
  spoken.length = 0;
  calls.length = 0;
  dropsState.cbs[0]('log', 5); /* 捡齐 5 原木(v2 原木预算) */
  AdventureMode.update(0.49); /* 节流窗内 */
  assert.strictEqual(A.ADV.quest.step, 0, '0.5s 节流窗内不检查(省帧)');
  AdventureMode.update(0.03); /* 累计过窗 → 查 → 步进 */
  assert.strictEqual(A.ADV.quest.step, 1, '第 1 步完成步进');
  assert.ok(spoken.some((s) => String(s).indexOf('原木') >= 0), '表扬 TTS 提及原木');
  assert.ok(spoken.some((s) => String(s).indexOf('木板') >= 0), '语音引导下一步(木板, 表扬+引导并句)');
  assert.ok(calls.some((x) => x[0] === 'sfx' && x[1] === 'level'), '完成音效 level 琶音');
  assert.ok(calls.some((x) => x[0] === 'toast' && String(x[1]).indexOf('完成') >= 0), '完成 toast');
  assert.ok(calls.some((x) => x[0] === 'toast' && String(x[1]).indexOf('新任务') >= 0), '新任务图标 toast');
  assert.ok(String(A.advQuestEl().innerHTML).indexOf('木板') >= 0, '任务卡刷新显示当前步(木板)');
  /* 落盘: step+counts 都进 adventure_quest_save */
  AdventureMode.cleanup();
  const saved = JSON.parse(mem.get('adventure_quest_save'));
  assert.strictEqual(saved.step, 1, 'step 落盘');
  assert.strictEqual(saved.counts.collect_log, 5, 'counts 落盘(中途退出当前步进度不丢)');
  freshInit();
  assert.strictEqual(A.ADV.quest.step, 1, '重进恢复 step');
  assert.strictEqual(A.ADV.quest.counts.collect_log, 5, '重进恢复 counts');
});

test('T15 老档归一化: {step:N} 无 counts → 补空表当前步从零继续; counts 损坏同样归一', () => {
  mem.clear();
  mem.set('adventure_quest_save', JSON.stringify({_v: 1, step: 6})); /* step 0 基: QUESTS[6] = 挖 8 圆石(引导链 v2 位次) */
  freshInit();
  assert.strictEqual(A.ADV.quest.step, 6, 'step 保留');
  assert.deepStrictEqual(A.ADV.quest.counts, {}, 'counts 补空表(mkSaveSlot defaults 只补缺失字段)');
  /* 当前步(挖 8 圆石)从零累计: 历史计数不追溯——玩家挖过什么无法从世界状态重建 */
  for (let i = 0; i < 8; i++) A.advBreakBlock(80 + i, 24, 80, 3, {time: 1, drops: true});
  AdventureMode.update(0.55);
  assert.strictEqual(A.ADV.quest.step, 7, '从零计数照样推进第 7 步(圆石步完成)');
  /* 损坏 counts(非对象) → init 归一化空表, step 钳在表界 */
  mem.clear();
  mem.set('adventure_quest_save', JSON.stringify({_v: 1, step: 99, counts: 3}));
  freshInit();
  assert.deepStrictEqual(A.ADV.quest.counts, {}, '损坏 counts 归一空表');
  assert.strictEqual(A.ADV.quest.step, 16, '越界 step 钳到表外上界(终章完成位)');
});

test('T15 钻石首获仪式: 首次挖到钻石矿触发一次(专属 TTS+音效+冲击波碎块), 第二颗起不再', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  calls.length = 0;
  const bt = {time: 1, drops: true};
  A.advBreakBlock(70, 5, 70, api.B_DIAMOND_ORE, bt);
  assert.ok(spoken.some((s) => /钻石/.test(String(s)) && /亮晶晶|宝贝|仔细/.test(String(s))),
      '专属 TTS(夸仔细口径, 不与普通拾取播报同句)');
  assert.ok(calls.some((x) => x[0] === 'sfx' && x[1] === 'gem'), '专属音效 gem 琶音');
  assert.ok(calls.filter((x) => x[0] === 'pop').length >= 2, '双层冲击波球(Fx.pop 现成件, 钻色+金光)');
  assert.ok(calls.some((x) => x[0] === 'debris'), '钻色碎块(Fx.debrisBurst)');
  assert.ok(calls.some((x) => x[0] === 'arc'), '金色弧光(Fx.arc)');
  const pops = calls.filter((x) => x[0] === 'pop').length;
  const riteTts = spoken.filter((s) => /亮晶晶/.test(String(s))).length;
  A.advBreakBlock(71, 5, 70, api.B_DIAMOND_ORE, bt);
  assert.strictEqual(calls.filter((x) => x[0] === 'pop').length, pops, '第二颗不再放仪式(首获专属)');
  assert.strictEqual(spoken.filter((s) => /亮晶晶/.test(String(s))).length, riteTts, '仪式 TTS 不重播');
  assert.strictEqual(A.ADV.quest.counts.mine_diamond_ore, 2, '计数照累计(仪式≠记账)');
  assert.strictEqual(A.ADV.quest.step, 0, '仪式≠步进(第 15 步要凑满 3 颗)');
});

test('F3 金苹果首获仪式: 首次合成触发一次(金光冲击波+gem 琶音+专属 TTS), 第二次不再', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  calls.length = 0;
  A.advOnCraft({item: 'golden_apple', n: 1, leftover: 0});
  assert.ok(spoken.some((s) => /金灿灿/.test(String(s)) && /金子/.test(String(s))),
      '专属 TTS(首获话术; cancel-then-speak 压过常规合成表扬)');
  assert.ok(calls.some((x) => x[0] === 'sfx' && x[1] === 'gem'), '专属音效 gem 琶音(钻石首获同款)');
  assert.ok(calls.filter((x) => x[0] === 'pop').length >= 2, '金光双层冲击波(Fx.pop)');
  assert.ok(calls.some((x) => x[0] === 'toast' && String(x[1]).indexOf('第一个金苹果') >= 0), '仪式 toast');
  assert.strictEqual(A.ADV.quest.counts.craft_golden_apple, 1, '合成记账照走(仪式≠记账)');
  assert.strictEqual(A.ADV.quest.step, 0, '仪式≠步进(金苹果不加任务步, 自由玩出口)');
  const pops = calls.filter((x) => x[0] === 'pop').length;
  const riteTts = spoken.filter((s) => /金灿灿/.test(String(s))).length;
  A.advOnCraft({item: 'golden_apple', n: 1, leftover: 0}); /* 再合一个 */
  assert.strictEqual(calls.filter((x) => x[0] === 'pop').length, pops, '第二次合成不再仪式(首获专属)');
  assert.strictEqual(spoken.filter((s) => /金灿灿/.test(String(s))).length, riteTts, '仪式 TTS 不重播');
  assert.strictEqual(A.ADV.quest.counts.craft_golden_apple, 2, '计数照累计');
});

test('T15 终章: 合成钻石剑 → 「小小探险家」称号+烟花+入档; 只触发一次, 重进不重复', () => {
  mem.clear();
  freshInit();
  A.ADV.quest.step = 15; /* 测试捷径: 直达终章(主线 15 步谓词已由直测覆盖) */
  spoken.length = 0;
  calls.length = 0;
  A.advOnCraft({item: 'sword_diamond', n: 1, leftover: 0});
  AdventureMode.update(0.55);
  assert.strictEqual(A.ADV.quest.step, 16, '终章完成(表外 step=16)');
  assert.strictEqual(A.ADV.quest.title, '小小探险家', '称号写入 quest 账本');
  assert.ok(spoken.some((s) => String(s).indexOf('小小探险家') >= 0), '称号 TTS');
  assert.ok(calls.some((x) => x[0] === 'sfx' && x[1] === 'win'), '胜利和弦 win');
  assert.ok(calls.filter((x) => x[0] === 'pop').length >= 4, '四色烟花(Fx.pop 组合)');
  assert.ok(calls.filter((x) => x[0] === 'debris').length >= 1, '烟花碎块');
  assert.ok(calls.some((x) => x[0] === 'toast' && String(x[1]).indexOf('小小探险家') >= 0), '称号 toast');
  const pops2 = calls.filter((x) => x[0] === 'pop').length;
  const titleTts = spoken.filter((s) => String(s).indexOf('小小探险家') >= 0).length;
  A.advOnCraft({item: 'sword_diamond', n: 1, leftover: 0}); /* 再合成一把 */
  for (let i = 0; i < 20; i++) AdventureMode.update(0.05);
  assert.strictEqual(calls.filter((x) => x[0] === 'pop').length, pops2, '烟花不放第二遍');
  assert.strictEqual(spoken.filter((s) => String(s).indexOf('小小探险家') >= 0).length, titleTts,
      '称号不重复授予');
  /* 称号随档: cleanup 落盘 → 重进 step=16 不再触发 */
  AdventureMode.cleanup();
  freshInit();
  spoken.length = 0;
  calls.length = 0;
  for (let i = 0; i < 20; i++) AdventureMode.update(0.05);
  assert.strictEqual(A.ADV.quest.step, 16, '重进 step 保持表外(终章完成)');
  assert.strictEqual(A.ADV.quest.title, '小小探险家', '称号随档恢复');
  assert.ok(!spoken.some((s) => String(s).indexOf('小小探险家') >= 0), '重进不重复授予称号');
  assert.strictEqual(calls.filter((x) => x[0] === 'pop').length, 0, '重进不放烟花');
});

test('T15 任务卡 UI: 打开背包即见 — 当前步目标+进度, 完成步划线, 称号置顶, 不剧透未来步', () => {
  mem.clear();
  freshInit();
  const html = () => String(A.advQuestEl().innerHTML);
  assert.ok(html().indexOf('原木') >= 0, '进场任务卡显示第 1 步(原木)');
  assert.ok(!html().includes('钻石'), '不剧透未来步骤');
  assert.ok(!html().includes('<s>'), '还没有完成史(无划线区)');
  AdventureMode.updateHud(null); /* mkMode 把 cfg.hud 包装成 updateHud(写 MK.hud) */
  assert.ok(String(elCache['hud'].innerHTML).indexOf('任务') >= 0, 'HUD 常驻一行任务进度(免开背包)');
  /* 推到第 3 步看历史区与进度数字 */
  A.ADV.quest.step = 2;
  A.advQuestPaint();
  assert.ok(/<s>[^]*木板[^]*<\/s>/.test(html()), '已完成步划线(<s> 历史区, 木板在第 2 步)');
  assert.ok(html().indexOf('工作台') >= 0, '当前步换成工作台');
  assert.ok(html().indexOf('0 / 2') >= 0, '复合步进度 0 / 2(合成+放置)');
  /* 终章完成态: 称号置顶 + 自由玩提示 */
  A.ADV.quest.step = 16;
  A.ADV.quest.title = '小小探险家';
  A.advQuestPaint();
  assert.ok(html().indexOf('小小探险家') >= 0, '称号置顶显示');
  assert.ok(html().indexOf('自由') >= 0, '全部完成提示(循环出口: 自由玩)');
  assert.ok(html().indexOf('<s>') >= 0, '全史划线保留');
});

/* ============ 引导链 v2: 大宝箱行为链(全局共享账户 + 点选搬运 + 材料扩容) ============ */

test('大宝箱: 走近点击开面板(4 格门槛, 熔炉同款) → 存入并堆/整槽搬 → 取出耐久原样 → 账户随档', () => {
  mem.clear();
  freshInit();
  /* 放一个箱子进世界(放置链复用 advTryPlace) */
  const spot = findGrassSpot();
  holdOnly('chest', 1);
  pos.x = spot.x + 0.5; pos.y = 25; pos.z = spot.z + 2.5;
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_CHEST, '箱子放进世界');
  /* 走近 4 格门槛: 远处点击只提示, 近处点击开面板并记 open_chest */
  pos.x = spot.x + 20; pos.z = spot.z + 20;
  calls.length = 0;
  AdventureMode.onMouse(0, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.ADV.chestOpen, false, '离箱 20 格: 点击不开面板(4 格门槛)');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('走近') >= 0), '给走近提示');
  pos.x = spot.x + 0.5; pos.z = spot.z + 2.5; /* 距箱 2 格 */
  AdventureMode.onMouse(0, {x: spot.x, y: 25, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(A.ADV.chestOpen, true, '走近 4 格内点击箱子 → 打开大宝箱面板');
  assert.strictEqual(A.ADV.quest.counts.open_chest, 1, '开箱记账 open_chest(箱子步三条件之一)');
  /* 存入: 木板 20 件整槽进箱(并堆上限 64 内一次收下) */
  const inv = A.advGetInv();
  inv.slots[5] = {id: 'planks', n: 20};
  A.advChestDeposit(5);
  assert.strictEqual(inv.slots[5], null, '背包槽清空(整摞搬走)');
  assert.deepStrictEqual(A.advGetChest().slots[0], {id: 'planks', n: 20}, '入箱落首格');
  assert.strictEqual(A.advGetChest().size, 9, '初始 9 格');
  /* 工具连耐久整槽搬: 磨损铁镐入箱再取出, 耐久不被重铸满(add 会满耐久, 禁走) */
  inv.slots[6] = {id: 'pick_iron', n: 1, dur: 111};
  A.advChestDeposit(6);
  A.advChestWithdraw(1);
  assert.strictEqual(inv.slots[0].dur, 111, '取出落首个空位(槽0), 耐久原样 111(不重铸 500)');
  assert.strictEqual(A.advGetChest().slots[1], null, '箱格清空');
  /* 账户随档: cleanup → 重进, 存进去的还在 */
  AdventureMode.cleanup();
  assert.strictEqual(A.ADV.chestOpen, false, '收面板');
  freshInit();
  assert.deepStrictEqual(A.advGetChest().slots[0], {id: 'planks', n: 20}, '重进账户恢复(全局共享, 挖掉箱子也不丢)');
  A.advChestClose();
});

/* ============ 2026-10-24 背包面板点选搬运: 快捷栏腾位/换序(交互优化) ============ */

test('背包点选搬运: 快捷栏↔主格腾位 + 同物并堆 + 快捷栏镜像同步 + 即时落盘', () => {
  mem.clear();
  freshInit();
  const inv = A.advGetInv();
  calls.length = 0;
  /* 快捷栏杂物 → 主格空位: 腾出手上格 */
  inv.slots[2] = {id: 'coal', n: 10};
  A.advInvMove(2, 20);
  assert.deepStrictEqual({...inv.slots[20]}, {id: 'coal', n: 10}, '煤搬去主格槽 20');
  assert.strictEqual(inv.slots[2], null, '快捷栏槽 2 腾空');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'pick'), '搬运叮咚(与大宝箱存取同款)');
  /* 同物并堆: 40+50 → 目标吃满 64, 余量 26 留原槽 */
  inv.slots[9] = {id: 'coal', n: 40};
  inv.slots[10] = {id: 'coal', n: 50};
  A.advInvMove(10, 9);
  assert.deepStrictEqual({...inv.slots[9]}, {id: 'coal', n: 64});
  assert.deepStrictEqual({...inv.slots[10]}, {id: 'coal', n: 26});
  /* 异种对调 = 快捷栏换序; 选中槽(槽 0)被搬换时快捷栏镜像同步 + 手持观感安静跟进 */
  inv.slots[0] = {id: 'torch', n: 4};
  inv.slots[1] = {id: 'planks', n: 3};
  calls.length = 0;
  A.advInvMove(0, 1);
  assert.deepStrictEqual({...inv.slots[0]}, {id: 'planks', n: 3}, '换序: 木板进槽 0');
  assert.deepStrictEqual({...inv.slots[1]}, {id: 'torch', n: 4});
  assert.strictEqual(AdventureMode.hotbar.items[0].item, 'planks', '快捷栏镜像跟随(腾出的格立即可用)');
  assert.ok(!calls.some((c) => c[0] === 'toast' && String(c[1]).includes('在手')), '安静跟进: 不播「在手」');
  /* 原地/空搬运零副作用 */
  calls.length = 0;
  A.advInvMove(3, 3);
  A.advInvMove(5, 7);
  assert.ok(!calls.some((c) => c[0] === 'sfx'), '无变动不响不动包');
  /* 即时落盘(离散动作即做即存): 再搬一步, 另开背包壳读同一介质, 布局已在档 */
  A.advInvMove(20, 26);
  const probe = Backpack.mkBackpack().load();
  assert.deepStrictEqual({...probe.slots[26]}, {id: 'coal', n: 10}, '搬运动作已随档(不等 5s 节流)');
});

test('大宝箱扩容: 材料不够温和提示不动包 → 8 圆石扩到 18 格 → 4 铁锭顶格 27 → 顶格后无档', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  calls.length = 0;
  const inv = A.advGetInv();
  /* 没材料: 温和提示(零惩罚), 格数不动 */
  A.advChestExpand();
  assert.strictEqual(A.advGetChest().size, 9, '材料不够不扩容');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('材料') >= 0), '温和提示');
  /* 8 圆石 → 18 格(第一档, 第 7 步挖圆石即凑齐) */
  api.add(inv, 'cobble', 8);
  calls.length = 0;
  A.advChestExpand();
  assert.strictEqual(A.advGetChest().size, 18, '扩到 18 格');
  assert.strictEqual(api.count(inv, 'cobble'), 0, '8 圆石已扣');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'level'), '扩容晋升琶音');
  /* 4 铁锭 → 27 格顶格 */
  api.add(inv, 'iron_ingot', 4);
  A.advChestExpand();
  assert.strictEqual(A.advGetChest().size, 27, '顶格 27 格(与背包同宽)');
  assert.strictEqual(api.count(inv, 'iron_ingot'), 0, '4 铁锭已扣');
  /* 顶格后再扩: 静默无档 */
  const size = A.advGetChest().size;
  A.advChestExpand();
  assert.strictEqual(A.advGetChest().size, size, '顶格不再扩');
  /* 档位随档: cleanup → 重进 size 不回落(扩容不可逆) */
  AdventureMode.cleanup();
  freshInit();
  assert.strictEqual(A.advGetChest().size, 27, '重进档位保持');
});

test('大宝箱联动: 背包快满提醒在做过箱子步后指向收纳(话术升级不改触发口径)', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  const inv = A.advGetInv();
  A.ADV.quest.counts.place_chest = 1; /* 模拟箱子步已做 */
  for (let i = 0; i < 24; i++) inv.slots[i] = {id: 'coal', n: 1};
  AdventureMode.update(0.51);
  assert.ok(spoken.some((s) => String(s).indexOf('箱子里') >= 0), '话术指向箱子(教过的机制被复用)');
  assert.ok(!spoken.some((s) => String(s).indexOf('合成一些') >= 0), '不再用合成出口');
});

/* ============ code-review 修复轮 S4: 提醒政策行为链(纯函数直测在 adventure-core.test.js) ============ */

test('S4① 低耐久预警行为链: 首次 <0.25 提醒一次, 同命不唠叨, 破板重置后再做同款可再预警', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  const warnCount = () => spoken.filter((s) => String(s).indexOf('快没劲') >= 0).length;
  holdOnly('pick_wood', 1, 31); /* 31/120≈0.258: 下一击 30/120=0.25 恰在线上 */
  A.advWearHeld();
  assert.strictEqual(warnCount(), 0, '0.25 恰在线上不提醒(严小于口径)');
  A.advGetInv().slots[0].dur = 29; /* 下一击 28/120≈0.233 跌破线 */
  A.advWearHeld();
  assert.strictEqual(warnCount(), 1, '首次跌破提醒一次');
  A.advWearHeld(); /* 仍 <0.25 但本命已提醒过 */
  assert.strictEqual(warnCount(), 1, '同命第二次不唠叨(节流=账本)');
  A.advGetInv().slots[0].dur = 1; /* 下一击破板 */
  A.advWearHeld();
  assert.ok(!A.advGetInv().slots[0], '破板清槽(remove)');
  assert.ok(spoken.some((s) => String(s).indexOf('用坏了') >= 0), '破板安抚话术仍在');
  holdOnly('pick_wood', 1, 29); /* 再做一把同款(破板已重置账本) */
  A.advWearHeld();
  assert.strictEqual(warnCount(), 2, '破板重置: 新一把重新预警(每工具每命一次)');
});

test('S4② 背包快满行为链: 占用 ≥24/27 一次性 toast+TTS「背包快满啦，去合成一些吧」', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  calls.length = 0;
  const inv = A.advGetInv();
  const fullCount = () => spoken.filter((s) => String(s).indexOf('背包快满') >= 0).length;
  for (let i = 0; i < 23; i++) inv.slots[i] = {id: 'coal', n: 1};
  AdventureMode.update(0.51); /* 首查(init 复位半秒节流) */
  assert.strictEqual(fullCount(), 0, '23 格未到线不提醒');
  inv.slots[23] = {id: 'coal', n: 1}; /* 24/27 到线 */
  AdventureMode.update(0.51);
  assert.strictEqual(fullCount(), 1, '到 24/27 提醒一次');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('背包快满') >= 0),
      'toast 与 TTS 同文案');
  inv.slots[24] = {id: 'coal', n: 1}; /* 持续满格 */
  AdventureMode.update(0.51);
  assert.strictEqual(fullCount(), 1, '持续满格不重复轰炸');
  inv.slots[23] = null; inv.slots[24] = null; /* 回落(整理/合成腾格子) */
  AdventureMode.update(0.51);
  assert.strictEqual(fullCount(), 1, '回落不提醒(只重新武装) — 冷却口径: 回落再满的上升沿');
  inv.slots[23] = {id: 'coal', n: 1}; inv.slots[24] = {id: 'coal', n: 1}; /* 再满 */
  AdventureMode.update(0.51);
  assert.strictEqual(fullCount(), 2, '回落再满: 允许再提醒一次');
});

test('S4③ 工具坏指路行为链: 破板安抚 TTS 并句当前任务步 hint(挖掘路径实测)', () => {
  mem.clear();
  freshInit();
  spoken.length = 0;
  holdOnly('shovel_wood', 1, 1); /* 剩 1 耐久: 挖一块即破板 */
  const spot = findGrassSpot();
  aimDownAt(spot);
  AdventureMode.onMouse(0, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  for (let i = 0; i < 8 && cell(spot.x, 24, spot.z) !== 0; i++) AdventureMode.update(0.15);
  assert.strictEqual(cell(spot.x, 24, spot.z), 0, '破坏完成');
  assert.ok(!A.advGetInv().slots[0], '工具归零消失');
  const broke = spoken.find((s) => String(s).indexOf('用坏了') >= 0);
  assert.ok(broke, '安抚 TTS 在场');
  assert.ok(broke.indexOf('不哭') >= 0, '安抚口径不变');
  assert.ok(broke.indexOf('接下来') >= 0 && broke.indexOf('原木') >= 0,
      '并句当前任务步 hint(第 1 步「捡回 5 根原木」——cancel-then-speak 不拆两句)');
  clearAim();
});

/* ============ 2026-10-23 玩法实测修复轮: 矿坑出得来 + 面板不弹出发菜单 + 回小屋逃生口 ============ */

test('修复①: 矿坑台阶每级恰 1 格 — 跳跃 1.42 格可登, 下得去也上得来(曾每级 2 格困人)', () => {
  freshInit();
  /* 坑心 → 坑沿(+x 轴逐环)取"顶部实心高度", 相邻差 ≤1 = 每步可跳上(修复前中心差 2 格) */
  const topSolid = (x, z) => {
    for (let y = 26; y >= 1; y--) if (cell(x, y, z) !== 0) return y;
    return 0;
  };
  for (const p of A.ADV.pits) {
    let prev = null;
    for (let k = 0; k <= p.r; k++) {
      const top = topSolid(p.cx + k, p.cz);
      if (prev !== null) {
        assert.ok(top - prev <= 1,
            '台阶差 ≤1 格(距坑心 ' + k + '), 实差 ' + (top - prev) + ' — 跳跃 1.42 格上不来');
      }
      prev = top;
    }
  }
  /* 加深半径后坑底仍落在对应矿带内(可见性教学不回归) */
  assert.strictEqual(topSolid(A.ADV.pits[0].cx, A.ADV.pits[0].cz), 16,
      '煤坑底 y16(煤带 12~20)');
  assert.strictEqual(topSolid(A.ADV.pits[1].cx, A.ADV.pits[1].cz), 15,
      '铁坑底 y15(铁带 6~16)');
});

test('修复②: 面板关闭状态同步 — ✕/Esc 走 onClose 后 panelOpen 不卡 true(曾卡住挖不了矿)', () => {
  mem.clear();
  freshInit();
  AdventureMode.onKey('Tab');
  assert.strictEqual(A.ADV.panelOpen, true, 'Tab 开背包');
  A.advPanelClose(); /* ✕/Esc 统一出口(mkCraftPanel.close → onClose 也走这) */
  assert.strictEqual(A.ADV.panelOpen, false, '关闭后状态同步(修复前 ✕ 直 hide 卡 true)');
  A.advPanelClose(); /* 幂等: 已关再关不翻状态 */
  assert.strictEqual(A.ADV.panelOpen, false, '重复关闭幂等');
  AdventureMode.onKey('Tab'); /* Tab 路径不受影响: 再开 */
  assert.strictEqual(A.ADV.panelOpen, true);
  AdventureMode.onKey('Tab'); /* 再经 Tab 关 */
  assert.strictEqual(A.ADV.panelOpen, false);
});

test('修复③: 🏠 回小屋逃生口 — 满血传送 + 60s 冷却拒绝(受困自救, 不播死亡安抚)', () => {
  mem.clear();
  freshInit();
  /* 纯函数口径: 冷却判据(60s 窗口, 边界恰 60 算就绪) */
  assert.strictEqual(A.advHomeReady(-1e9, 0), true, '从未用过: 立即可用');
  assert.strictEqual(A.advHomeReady(0, 59.9), false, '冷却内拒绝');
  assert.strictEqual(A.advHomeReady(0, 60), true, '边界 60s 恰就绪');
  /* 行为链: 残血受困 → 回家满血 + 传送出生点; 冷却内再按不传送 */
  const e = A.advGetPEnt();
  e.hp = 7; A.ADV.player.hp = 7;
  A.ADV.homeCd = -1e9;
  calls.length = 0;
  A.advGoHome();
  assert.strictEqual(A.ADV.player.hp, A.ADV.player.maxHp, '回家满血');
  assert.ok(calls.some((c) => c[0] === 'spawn' && c[1] === A.ADV.spawn.x && c[4] &&
      c[4].yaw === A.ADV.spawn.yaw), '传送回出生小屋(带朝向)');
  const cdAfter = A.ADV.homeCd;
  e.hp = 7; A.ADV.player.hp = 7;
  A.advGoHome(); /* 假时钟恒 0: 冷却未过 */
  assert.strictEqual(A.ADV.player.hp, 7, '冷却内不回血');
  assert.strictEqual(A.ADV.homeCd, cdAfter, '冷却时间不被刷新');
  assert.strictEqual(calls.filter((c) => c[0] === 'spawn').length, 1, '冷却内不传送');
});

/* ============ 方块级联(设计稿 D4/D5/P6): 砍树行为链 — 「砍树悬浮」bug 的修复面 ============ */

/* 找一棵带树冠、±6 内无其它树干的自然树(确定性生成, 草地顶 y=24/干基 y=25) */
function findLoneTree() {
  for (let z = 4; z < D - 4; z++) {
    for (let x = 4; x < W - 4; x++) {
      if (cell(x, 25, z) !== 5 || cell(x, 26, z) !== 5) continue;
      if (cell(x, 29, z) !== 7 && cell(x, 30, z) !== 7) continue; /* 有树冠(th=4~6 通用) */
      let alone = true;
      for (let dz = -6; dz <= 6 && alone; dz++) {
        for (let dx = -6; dx <= 6; dx++) {
          if ((dx || dz) && cell(x + dx, 25, z + dz) === 5) {
            alone = false; break;
          }
        }
      }
      if (alone) return {x, z};
    }
  }
  throw new Error('地图上找不到独立树');
}
function treeLeaves(t) {/* 该树树冠盒(干±2 × y27..31)内树叶数 */
  let n = 0;
  for (let y = 27; y <= 31; y++) {
    for (let z = t.z - 2; z <= t.z + 2; z++) {
      for (let x = t.x - 2; x <= t.x + 2; x++) if (cell(x, y, z) === 7) n++;
    }
  }
  return n;
}

test('方块级联①: 砍树底一节=整树倒 — 干/叶全清+原木掉落雨+话术', () => {
  mem.clear();
  freshInit();
  const t = findLoneTree();
  assert.ok(treeLeaves(t) >= 40, '树冠 ~49 叶');
  A.advBreakBlock(t.x, 25, t.z, 5, {time: 3, drops: true});
  for (let y = 25; y <= 31; y++) assert.strictEqual(cell(t.x, y, t.z), 0, '干列 y=' + y + ' 清空');
  assert.strictEqual(treeLeaves(t), 0, '树冠全清(4 格内已无原木)');
  const logs = dropsState.spawned.filter((d) => d.id === 'log').length;
  assert.ok(logs >= 4, '原木掉落 ≥4(触发块+级联默认表), 实际 ' + logs);
  assert.ok(spoken.some((s) => String(s).indexOf('大树倒啦') >= 0), '整树倒话术');
});

test('方块级联②(红线): 级联块全量记账 — cleanup 落盘→重进(重建+重放)整树不复活', () => {
  mem.clear();
  freshInit();
  const t = findLoneTree();
  A.advBreakBlock(t.x, 25, t.z, 5, {time: 3, drops: true});
  assert.strictEqual(treeLeaves(t), 0, '砍后树冠清空');
  AdventureMode.cleanup(); /* 落盘 */
  freshInit(); /* 重进: 确定性重建 + edits 重放 */
  for (let y = 25; y <= 31; y++) {
    assert.strictEqual(cell(t.x, y, t.z), 0, '重进: 干列不复活(级联块漏记会复活半棵树)');
  }
  assert.strictEqual(treeLeaves(t), 0, '重进: 树冠不复活');
});

test('方块级联③: 挖火把/树苗的底座 → 依附块脱落掉落, 树苗计时撤销', () => {
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  holdOnly('torch', 1);
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(cell(spot.x, 25, spot.z), api.B_TORCH, '火把放上草地');
  A.advBreakBlock(spot.x, 24, spot.z, 1, {time: 1, drops: true});
  assert.strictEqual(cell(spot.x, 25, spot.z), 0, '火把随底座脱落');
  assert.ok(dropsState.spawned.some((d) => d.id === 'torch'), '火把掉落(默认表, 可捡回)');
  const spot2 = findGrassSpot(); /* 首块草地已挖开, 顺位找到下一块(确定性) */
  holdOnly('sapling', 1);
  AdventureMode.onMouse(2, {x: spot2.x, y: 24, z: spot2.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(cell(spot2.x, 25, spot2.z), api.B_SAPLING, '树苗放上草地');
  assert.strictEqual(A.advSaplings.size, 1, '挂上 20s 计时');
  A.advBreakBlock(spot2.x, 24, spot2.z, 1, {time: 1, drops: true});
  assert.strictEqual(cell(spot2.x, 25, spot2.z), 0, '树苗随底座脱落');
  assert.strictEqual(A.advSaplings.size, 0, '计时撤销(advCascadeApply 清理)');
  assert.ok(dropsState.spawned.some((d) => d.id === 'sapling'), '树苗掉落(可捡回重种)');
});

test('方块级联④: TNT 波及原木 → 整树级联倒 — 默认表掉落, 不进任务(P6)', () => {
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  for (let y = 25; y <= 32; y++) api.setBlockRaw(spot.x, y, spot.z, 5); /* 8 节高原木柱 */
  A.advExplode(spot.x, 25, spot.z);
  for (let y = 25; y <= 32; y++) assert.strictEqual(cell(spot.x, y, spot.z), 0, '整柱清空');
  const logs = dropsState.spawned.filter((d) => d.id === 'log').length;
  assert.ok(logs >= 4, '级联原木默认表必得(源块破坏即掀整柱), 实际 ' + logs);
  assert.ok(Object.keys(A.ADV.quest.counts).every((k) => k.indexOf('mine_') !== 0),
      'TNT 链(含级联)不进任务计数(TNT 掀掉的不算)');
});

test('方块级联⑤(二期 D7): 沙随底座沉降 — 移动两格记账, 重进不错位(红线)', () => {
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  holdOnly('sand', 1);
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(cell(spot.x, 25, spot.z), 8, '沙放草地顶(脚下实心, 放置不落)');
  A.advBreakBlock(spot.x, 24, spot.z, 1, {time: 1, drops: true}); /* 挖草皮 */
  assert.strictEqual(cell(spot.x, 24, spot.z), 8, '沙落进挖开的格(规则④)');
  assert.strictEqual(cell(spot.x, 25, spot.z), 0, '原位空出');
  /* 红线: 触发格先记+移动后记(last-write-wins), 重进不错位 */
  AdventureMode.cleanup();
  freshInit();
  assert.strictEqual(cell(spot.x, 24, spot.z), 8, '重进: 沙在落位');
  assert.strictEqual(cell(spot.x, 25, spot.z), 0, '重进: 原位不复活(两格记账)');
});

test('方块级联⑥(三期 P15): 砍树干中段=整树倒(树桩连带) — 干/叶全清+话术', () => {
  mem.clear();
  freshInit();
  const t = findLoneTree();
  assert.ok(treeLeaves(t) >= 40, '布景: 树冠在场');
  A.advBreakBlock(t.x, 26, t.z, 5, {time: 3, drops: true}); /* 砍第二节 */
  for (let y = 25; y <= 31; y++) assert.strictEqual(cell(t.x, y, t.z), 0, '干列全清 y=' + y + '(含树桩)');
  assert.strictEqual(treeLeaves(t), 0, '树冠全清(旧口径树桩会撑起 15~49 片浮空叶)');
  assert.ok(spoken.some((s) => String(s).indexOf('大树倒啦') >= 0), '整树倒话术');
  const logs = dropsState.spawned.filter((d) => d.id === 'log').length;
  assert.ok(logs >= 4, '原木掉落含树桩(材料零损失), 实际 ' + logs);
});

test('方块级联⑦(三期 P14 红线): 旧档浮空冠重进治愈 — 治愈记账落盘, 二次进世界幂等', () => {
  mem.clear();
  freshInit();
  const t = findLoneTree();
  assert.ok(treeLeaves(t) >= 40, '布景: 树冠在场');
  /* 模拟级联合并前的旧档: 当年砍光树干只记 edits(那个年代无级联) → 重进剩浮空冠 */
  const edits = [];
  for (let y = 25; cell(t.x, y, t.z) === 5; y++) edits.push([t.x + ',' + y + ',' + t.z, 0]);
  assert.ok(edits.length >= 4, '树干 edits 在场');
  mem.set('adventure_world_save', JSON.stringify({_v: 1, edits}));
  freshInit(); /* 重进: 重建+重放 → P14 清扫治愈 */
  assert.strictEqual(treeLeaves(t), 0, '孤儿冠被清扫治愈(静默, 无掉落无话术)');
  for (let y = 25; y <= 31; y++) assert.strictEqual(cell(t.x, y, t.z), 0, '干列空');
  assert.ok(!dropsState.spawned.some((d) => d.id === 'sapling' || d.id === 'apple'),
      '治愈不掉落(装场期迁移不是游戏事件, 防刷档)');
  AdventureMode.cleanup(); /* 治愈记账落盘 */
  const saved = JSON.parse(mem.get('adventure_world_save'));
  const healN = saved.edits.length - edits.length;
  assert.ok(healN >= 40, '治愈格逐块记账(漏记=重进复活/重复清扫), 实际新增 ' + healN);
  freshInit(); /* 二次进世界: 幂等 */
  assert.strictEqual(treeLeaves(t), 0, '二次进: 依然干净');
  AdventureMode.cleanup();
  const saved2 = JSON.parse(mem.get('adventure_world_save'));
  assert.strictEqual(saved2.edits.length, saved.edits.length, '幂等: 二次进世界零新增治愈记账');
});

/* ============ F4 牧场(二期设计稿 §4): 散布在场 / 收获链 / 恐惧游荡 / 死畜账 / 熟食链 ============ */

test('F4 牧场: init 动物在场 — 确定性清单 10 只(牛2羊2猪3鸡3)挂 __livestockIdx, 重进原位复现', () => {
  mem.clear();
  freshInit();
  const herd = () => mobsState.spawned.filter((m) => m.__livestockIdx != null);
  const h1 = herd();
  assert.strictEqual(h1.length, 10, '2 群共 10 只');
  assert.deepStrictEqual(h1.map((m) => m.__livestockIdx).sort((a, b) => a - b),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], '索引 0..9 各一只(死畜账的对账键)');
  const byType = {};
  for (const m of h1) {
    assert.strictEqual(m.cfg.passive, true, m.type + ' 带 passive 旗标(表照抄)');
    byType[m.type] = (byType[m.type] || 0) + 1;
  }
  assert.deepStrictEqual(byType, {cow: 2, sheep: 2, pig: 3, chicken: 3}, '群位 A 牛羊 / 群位 B 猪鸡');
  /* 不贴脸: 群位离出生 ≥15(环带 ≤1.8, 条目至少 13 格外) */
  for (const m of h1) {
    assert.ok(Math.hypot(m.pos.x - A.ADV.spawn.x, m.pos.z - A.ADV.spawn.z) > 13,
        '牧场离出生小屋足够远(群位 ≥15 的推论)');
  }
  /* 重进复现: 位置不存档, 重进回散布原位(确定性清单, 设计稿 §6 差异清单) */
  const snap1 = h1.map((m) => [m.__livestockIdx, m.type, +m.pos.x.toFixed(6), +m.pos.z.toFixed(6)])
      .sort((a, b) => a[0] - b[0]);
  freshInit();
  const snap2 = herd().map((m) => [m.__livestockIdx, m.type, +m.pos.x.toFixed(6), +m.pos.z.toFixed(6)])
      .sort((a, b) => a[0] - b[0]);
  assert.deepStrictEqual(snap2, snap1, '重进散布原位逐字段复现');
});

test('F4 收获链: 击杀动物掉落掷骰照常 + killBurst verb「收获」 + kill_mob 不记账(战斗步只认怪物)', () => {
  mem.clear();
  freshInit();
  dropsState.spawned.length = 0;
  /* 掉落链: init 挂的 onDeath 回调掷骰(收获与怪物击杀同一管线, 零新逻辑) */
  mobsState.deathCbs[0]({type: 'cow', pos: {x: 45, y: 25, z: 45}, __livestockIdx: 0});
  assert.deepStrictEqual(dropsState.spawned.map((d) => d.id).sort(), ['leather', 'raw_beef'],
      '牛掉生牛肉+皮革(MOB_DROPS 表)');
  assert.ok(dropsState.spawned.every((d) => d.y === 25.8 && d.x === 45), '落点=尸体上方 0.8(击杀观感同款)');
  assert.deepStrictEqual(A.advGetLivestock(), {dead: [0]}, '死畜索引顺手落账(同一回调)');
  /* 收获观感 + 不记账 */
  calls.length = 0;
  A.advOnKill(mkAdvMob('cow', 40, 25, 47));
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('收获') >= 0),
      'killBurst verb=收获(温和口径替代「击杀」)');
  assert.strictEqual(A.ADV.quest.counts.kill_mob, undefined, 'kill_mob 不记动物(收获不是战斗)');
  assert.strictEqual(A.ADV.killCount, 1, '击杀计数照走(toast 口径共用)');
  /* 对照: 怪物击杀照旧「击杀」+记账 */
  calls.length = 0;
  A.advOnKill(mkAdvMob('zombie', 40, 25, 47));
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('击杀') >= 0), '怪物照旧 verb=击杀');
  assert.strictEqual(A.ADV.quest.counts.kill_mob, 1, '战斗教学步只认怪物');
});

test('F4 恐惧游荡: 玩家靠近 ≤2.5 让开(×0.8 背向) · 受击存活 3 秒逃窜(×2.2) · 不进战斗 AI 不反击', () => {
  mem.clear();
  freshInit();
  const cow = mkAdvMob('cow', 40, 25, 48.4); /* 玩家正北 2.5 格(恰让开圈沿, 含等号) */
  globalThis.yaw = 0; /* 面朝 -Z */
  globalThis.pos.x = 40; globalThis.pos.y = 25; globalThis.pos.z = 50.9;
  listResult = [cow];
  moveLog.length = 0;
  hitLog.length = 0;
  AdventureMode.update(1 / 60);
  const avoid = moveLog.find((e) => e.m === cow);
  assert.ok(avoid && avoid.dz < 0 && Math.abs(avoid.dx) < 1e-9, '缓步让开: 背向玩家(dz<0)');
  assert.ok(Math.abs(Math.abs(avoid.dz) - 1.4 * 0.8 / 60) < 1e-9,
      '让开速度 = speed×0.8(牛 1.4): ' + avoid.dz.toFixed(5));
  assert.strictEqual(hitLog.length, 0, '不反击(动物零伤害也不出手)');
  /* 受击存活 → 逃窜计时挂实体私有字段, 随后 3 秒 ×2.2 背向 */
  nextHit = {hp: 10, dead: false, freshDead: false};
  AdventureMode.onMouse(0); /* 挥击命中: 动物是 Mobs 实体, 准星锥内最近怪天然在列 */
  assert.strictEqual(cow.__fleeT, 3, '受击存活 → __fleeT=3(私有字段挂受击时刻)');
  moveLog.length = 0;
  AdventureMode.update(1 / 60);
  const flee = moveLog.find((e) => e.m === cow);
  assert.ok(flee && flee.dz < 0, '逃窜方向背向玩家');
  assert.ok(Math.abs(Math.abs(flee.dz) - 1.4 * 2.2 / 60) < 1e-9,
      '逃窜速度 = speed×2.2: ' + flee.dz.toFixed(5));
  /* 计时到期 + 玩家在 2.5 格外 → 原地平静(关掉闲逛便于断言) */
  cow.__fleeT = 0;
  cow.__ambleT = 999;
  cow.__ambleWalk = false;
  moveLog.length = 0;
  AdventureMode.update(1 / 60);
  assert.ok(!moveLog.some((e) => e.m === cow), '逃窜结束且玩家在圈外: 不动(不追击不恋战)');
  assert.ok(!hitLog.some((h) => h.m.pos === globalThis.pos), '全程不反击(hitLog 里只有玩家挥击的那一记)');
});

test('F4 死畜记账: 击杀动物 → dead 索引落账随档 → 重进该索引不复活(牧场不重生, MC 口径)', () => {
  mem.clear();
  freshInit();
  const herd = mobsState.spawned.filter((m) => m.__livestockIdx != null);
  assert.strictEqual(herd.length, 10, '前提: 满员牧场');
  const victim = herd[4]; /* 群位 B 首只猪 */
  dropsState.spawned.length = 0;
  mobsState.deathCbs[0](victim); /* 走真实 onDeath 回调(掉落+落账同帧) */
  assert.deepStrictEqual(A.advGetLivestock(), {dead: [victim.__livestockIdx]}, '死畜账在内存');
  assert.ok(dropsState.spawned.length >= 1, '掉落照常(收获链不断)');
  AdventureMode.cleanup();
  const sv = JSON.parse(mem.get('adventure_world_save'));
  assert.deepStrictEqual(sv.livestock, {dead: [victim.__livestockIdx]}, '死畜索引随世界档落盘');
  freshInit();
  const again = mobsState.spawned.filter((m) => m.__livestockIdx != null);
  assert.strictEqual(again.length, 9, '重进 9 只(死畜不复活)');
  assert.ok(!again.some((m) => m.__livestockIdx === victim.__livestockIdx), '被杀索引不再生成');
  assert.strictEqual(again.filter((m) => m.type === 'pig').length, 2, '猪少一只(不重生)');
  assert.strictEqual(again.filter((m) => m.type === 'cow').length, 2, '别的群原样');
});

test('F4 熟食链: 炉烧生肉→熟肉(SMELTS 四条, 与矿物同套节律) + 吃熟肉回血走 advEatPolicy 普通口径', () => {
  /* 纯表复核(逐条钉口径在 craft-core.test; 此处验探险消费面) */
  assert.strictEqual(smeltOf('raw_beef'), 'cooked_beef');
  assert.strictEqual(smeltOf('raw_porkchop'), 'cooked_porkchop');
  assert.strictEqual(smeltOf('raw_chicken'), 'cooked_chicken');
  assert.strictEqual(smeltOf('raw_mutton'), 'cooked_mutton');
  mem.clear();
  freshInit();
  const spot = findGrassSpot();
  const fk = api.blockKey(spot.x, 25, spot.z);
  A.advFurnaces.set(fk, {input: {id: 'raw_beef', n: 1}, fuel: {id: 'coal', n: 1}, out: null, heat: 0, prog: 0});
  for (let i = 0; i < 60; i++) AdventureMode.update(0.05); /* 3s > 2.5s 烧成一件 */
  assert.deepStrictEqual(A.advFurnaceState(fk).out, {id: 'cooked_beef', n: 1}, '生牛肉烧成牛排');
  /* 吃熟肉: food 8 普通口径(无 full 旗标, 不碰政策——回血钳制同腐肉/苹果) */
  A.advGetPEnt().hp = 20;
  A.ADV.player.hp = 20; /* 账本与实体同源(死亡政策口径) */
  holdOnly('cooked_beef', 2);
  AdventureMode.onMouse(0, {x: 60, y: 24, z: 80, nx: 0, ny: 1, nz: 0}); /* 手持食物: 点击=吃 */
  assert.strictEqual(A.advGetPEnt().hp, 28, '牛排回 8 血(比生肉 3 好得多档)');
  assert.strictEqual(A.advGetInv().slots[0].n, 1, '吃掉 1 个');
});
