'use strict';
/* 体验馆模式 (js/modes/showroom.js) 守门测试 — node --test (零依赖)
   运行: node --test test/showroom-mode.test.js
   v2「冒险全开实验室」守门线(docs/showroom-design.md §7, adventure-mode.test
   契约先例, 只测外显行为不伸手进实现):
   ① 契约面: 模式文件可 require + 注册行形状 + main.js MODES 接线正则;
   ② 数据隔离键扫: 模式与供给核心两文件源文本零存储 API 名/零存档键
     字面量(含注释, 红线 = 调试永不读写真实进度, ADR 0002);
   ③ 套餐供给: stock 挂点(派生产物)行形状/≤27/全 id ∈ ITEMS · 进场后
     RECIPES 每条配方 canCraft 全绿(「所有条件都满足」的模式侧复验);
   ④ 快捷栏: 9 槽镜像背包前 9 槽, 数字键/滚轮/点选全自动;
   ⑤ 建场真件断言(vm 装真体素底座): 全幅草场/房子墙顶门板窗/站点件
     (即测炉+灶台双炉+工作台×2+仓库箱排+床)/展台展品=派生清单/火把
     插满(室内+地下室计数)/地下室石壳+矿样墙+楼梯井;
   ⑥ 三站点交互: 熔炉走近点击开面板/圈外拒 · 工作台开合成面板(Tab 同达)
     · 箱子开对应仓库箱(逐箱内容=派生账户);
   ⑦ 熔炉行为线: 自动放料(首现矿种全量+最省燃料)/2.5s 件推进/关面板
     照烧/退出三笔退包——只测编排不重测纯函数(craft-core/furnace-kit
     各有单测);
   ⑧ 收场与重进: 面板全收+零掉落物 · 背包同实例原地重铸 · 仓库箱恢复
     原装(退出即弃, 每次进场干净初始态)。 */
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
globalThis.document = {
  createElement: () => fakeEl(),
  getElementById: (id) => (elCache[id] = elCache[id] || fakeEl()),
};

/* ---------- 真引擎件: 体素底座+纯核心(vm), 共享一个 vm 词法环境 ----------
   建场断言对着真 fill/getBlock(fake SceneKit 会把「方块真的在场」变成
   同义反复, T3 起惯例); 其全局名依赖经 Object.assign 就位到 Node 侧 */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/config.js', 'js/voxel.js', 'js/cascade-core.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({ITEMS, stackMax, mkStack, isTool, toolOf, durOf, mkInventory, add, count, remove,
  take, moveSlot, damageTool, costEntry, shapeCost, canCraft, matchGrid, gridCraft, fillGrid,
  RECIPES, SMELTS, FUEL, fuelUnits, smeltOf, breakTime,
  HOTBAR_SLOTS, INV_SLOTS, WORLD_W, WORLD_D, PLAYER,
  BLOCKS, B_FURNACE, B_CRAFT, B_CHEST, B_BED, B_TORCH, B_DOOR, B_DOOR_TOP, B_DOOR_OPEN,
  B_DOOR_TOP_OPEN, B_GLASS_PANE,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY,
  getBlock, setBlockRaw, blockKey, collidesAtPlayer, rollBlockDrop, SceneKit})`, eng);
Object.assign(globalThis, api); /* 模式/供给核心/放置链经全局名消费这些真件 */
/* 单块编辑 seam: world.js 太重——真级联核心镜像 world.js 的装配
   (adventure-mode.test 同款): setBlockRaw + 破坏侧 cascadeRemove */
const engCascade = vm.runInContext('({core: CascadeCore, policy: CascadeCore.mkPolicy(BLOCKS)})', eng);
globalThis.editBlock = (x, y, z, id) => {
  const old = api.getBlock(x, y, z);
  api.setBlockRaw(x, y, z, id);
  return (id === 0 && old !== 0) ?
    engCascade.core.cascadeRemove(api.getBlock, api.setBlockRaw, x, y, z, old, engCascade.policy) : [];
};
globalThis.Fx = {debrisBurst() {}, kick() {}, boom() {}, arc() {}, pop() {}}; /* 碎屑观感桩 */
/* place-kit/adventure-core 的自由标识符引用 config 的 B_ 前缀常数(const 词法绑定
   不挂 vm 全局对象): 按两文件源码动态收集名单, 在上下文内求值铺到 Node 全局 */
for (const src of [fs.readFileSync(path.join(ROOT, 'js', 'adventure-core.js'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'js', 'place-kit.js'), 'utf8')]) {
  for (const n of [...new Set(src.match(/\bB_[A-Z0-9_]+\b/g) || [])]) {
    if (globalThis[n] === undefined) globalThis[n] = vm.runInContext(n, eng);
  }
}
const AdventureCore = require('../js/adventure-core.js');
Object.assign(globalThis, AdventureCore); /* advChestPut/advChestTake/ADV_STATION_R 等 */
const CraftCore = require('../js/craft-core.js');
Object.assign(globalThis, {SMELT_T: CraftCore.SMELT_T, smeltStep: CraftCore.smeltStep,
  furnaceRefund: CraftCore.furnaceRefund});

/* ---------- 假应用层(调用期解析的全局名, nether-mode.test 先例) ---------- */
const calls = [];
globalThis.loadScene = (fn) => {
  calls.push(['loadScene']);
  fn();
}; /* 场景装填 seam: 清场+建场+光场(收尾重建归渲染层, 行为断言不需要) */
globalThis.showToast = (s) => calls.push(['toast', s]);
const dropCalls = []; /* 掉落物调用记账: 体验馆退出收场应为零(满包余量静默丢弃口径) */
const dropsTicks = []; /* 掉落物 update 记账: 放置链接入后 update 应每帧喂真空拾取 */
const collectCbs = []; /* 收集回调记账: init 重挂(切模式 Drops.clear 解除后重挂, 探险同款) */
globalThis.Drops = {spawn: (id, n) => dropCalls.push([id, n]),
  update: (dt, p) => dropsTicks.push([dt, p]), render: () => {},
  onCollect: (cb) => collectCbs.push(cb)};
globalThis.switchMode = (id) => calls.push(['switchMode', id]);
globalThis.showPage = (id) => calls.push(['showPage', id]);
globalThis.overlay = fakeEl();
globalThis.fps = 60;
globalThis.pos = {x: 64.5, y: 13, z: 64.5, set() {}};
globalThis.vel = {set() {}};
globalThis.touchPlaying = false;
globalThis.iconOf = (id) => (globalThis.ITEMS[id] && globalThis.ITEMS[id].icon) || '';
globalThis.btnImg = () => '';
globalThis.setTouchActions = () => {};

const ModeKit = require('../js/mode-kit.js');
globalThis.mkMode = ModeKit.mkMode;
globalThis.ModeKit = ModeKit;
globalThis.FurnaceKit = require('../js/furnace-kit.js');
globalThis.PlaceKit = require('../js/place-kit.js'); /* 放置链 kit(模式顶层即构造 editor) */
ModeKit.spawn = (x, y, z, o) => {
  calls.push(['spawn', x, y, z, o]);
};

/* ---------- 玩家战斗桩(票 B: HP 实体/进食/雪球弹池经 CombatKit, 全调用期解析) ---------- */
globalThis.CombatKit = require('../js/combat-kit.js');
globalThis.CombatCore = require('../js/combat-core.js'); /* stepShot/leadAim(combat-kit 自由标识符消费) */
globalThis.Avatar = {swing() {}, flash() {}, setItem() {}}; /* 挥臂/闪红观感桩(Node 无渲染) */
globalThis.camera = {}; /* 相机件: shootFromAim 沿准星出膛的取景入参(raycastVoxel 缺席, aimHit 守卫仍返 null) */
const mobsRig = {list: [], hits: []}; /* 体验馆无怪: 名单恒空(mkArrows 命中扫描面); 雪球红线用例临时塞假怪 */
globalThis.Mobs = {
  list: () => mobsRig.list,
  hit(m, dmg, kdx, kdz, kpow) {
    mobsRig.hits.push({m, dmg, kdx, kdz, kpow});
    return {freshDead: false};
  },
  debrisColor: () => 0xffffff,
};

/* 供给核心先于模式装载(mode-kit 同款: 模式顶层即调其派生函数) */
const ShowroomCore = require('../js/showroom-core.js');
globalThis.showroomPocket = ShowroomCore.showroomPocket;
globalThis.showroomCrateRows = ShowroomCore.showroomCrateRows;
globalThis.showroomDisplays = ShowroomCore.showroomDisplays;

const ShowroomMode = require('../js/modes/showroom.js');
const showroomSrc = fs.readFileSync(path.join(ROOT, 'js', 'modes', 'showroom.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, 'js', 'showroom-core.js'), 'utf8');

function freshEnter() {
  calls.length = 0;
  elCache['hotbar'].children.length = 0;
  collectCbs.length = 0; /* switchMode 兜底清共享实体账(Drops.clear 解除回调)的同拍 */
  ShowroomMode.init();
}

/* ============ ① 契约面 ============ */

test('体验馆: 模式文件可 require + 注册行形状(dev 调试场) + main.js MODES 接线正则', () => {
  assert.ok(ShowroomMode, 'CommonJS 导出守卫(nether 先例): require 不炸且有导出');
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
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  assert.match(mainSrc, /^ {2}showroom: ShowroomMode,$/m,
      'main.js MODES 表接线(两空格缩进+行尾逗号)');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<script src="js\/showroom-core\.js" defer><\/script>/,
      'index.html 装载供给核心(加载序在模式之前)');
});

/* ============ ② 数据隔离键扫(模式+供给核心两文件) ============ */

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

test('体验馆: 进场即全开 — 背包套餐出发, RECIPES 每条配方 canCraft 全绿', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  for (const r of api.RECIPES) {
    const check = api.canCraft(inv, r, true);
    assert.ok(check.ok, '配方可合成: ' + r.id + ' 缺 ' + JSON.stringify(check.missing));
  }
});

/* ============ ④ 快捷栏 ============ */

test('体验馆: 材料快捷栏 — mkHotbar 9 槽镜像背包前 9 槽, 数字键/滚轮/点选全自动', () => {
  freshEnter();
  const hb = ShowroomMode.hotbar;
  assert.ok(hb, '模式壳接了 mkHotbar');
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
  assert.strictEqual(elCache['hotbar'].style.display, 'flex', '进场快捷栏可见');
});

/* ============ ⑤ 建场真件断言 ============ */

const SR_FURNACE = {x: 64, y: 13, z: 62}; /* 即测炉: 出生点正后方 1.5 格 */

test('体验馆: 装场 — 全幅草场/房子墙顶门板窗/站点件齐备/仓库箱数=派生箱数(真件 getBlock)', () => {
  freshEnter();
  const g = 12;
  assert.strictEqual(api.getBlock(5, g, 5), 1, '全幅草皮(160 世界不再只铺 128)');
  assert.strictEqual(api.getBlock(159, g, 159), 1, '世界东南角也在场(扩容纠偏)');
  /* 房子: 地板/墙角/屋顶/南门成对/玻璃板窗 */
  assert.strictEqual(api.getBlock(55, g, 55), 6, '木板地板');
  assert.strictEqual(api.getBlock(48, 14, 44), 6, '木墙(西北角)');
  assert.strictEqual(api.getBlock(63, 17, 60), 6, '木板顶');
  assert.strictEqual(api.getBlock(63, 13, 75), api.B_DOOR, '南门(下扇)');
  assert.strictEqual(api.getBlock(63, 14, 75), api.B_DOOR_TOP, '南门(上扇)');
  assert.strictEqual(api.getBlock(54, 14, 44), api.B_GLASS_PANE, '北墙窗');
  assert.strictEqual(api.getBlock(48, 14, 60), api.B_GLASS_PANE, '西墙窗');
  /* 站点件: 即测炉 + 灶台双炉 + 工作台×2 + 床 */
  assert.strictEqual(api.getBlock(SR_FURNACE.x, SR_FURNACE.y, SR_FURNACE.z), api.B_FURNACE,
      '出生圈内即测熔炉');
  assert.strictEqual(api.getBlock(72, 13, 46), api.B_FURNACE, '灶台角炉 1');
  assert.strictEqual(api.getBlock(74, 13, 46), api.B_FURNACE, '灶台角炉 2');
  assert.strictEqual(api.getBlock(52, 13, 46), api.B_CRAFT, '工作台 1');
  assert.strictEqual(api.getBlock(54, 13, 46), api.B_CRAFT, '工作台 2');
  assert.strictEqual(api.getBlock(77, 13, 73), api.B_BED, '床');
  /* 仓库箱排: 箱方块数 = 派生箱数(且 ≤ 锚位上限, 超出即红) */
  const crates = ShowroomMode.crates.list;
  assert.ok(crates.length > 0 && crates.length <= 8, '仓库箱 1..8 只: ' + crates.length);
  for (let i = 0; i < crates.length; i++) {
    assert.strictEqual(api.getBlock(50, 13, 50 + i * 2), api.B_CHEST,
        '第 ' + i + ' 箱(' + crates[i].title + ')在场');
  }
  /* 火把插满: 室内 + 地下室(扫描区域计数) */
  let houseTorch = 0;
  for (let x = 48; x <= 79; x++) {
    for (let z = 44; z <= 75; z++) {
      for (let y = 13; y <= 16; y++) {
        if (api.getBlock(x, y, z) === api.B_TORCH) houseTorch++;
      }
    }
  }
  assert.ok(houseTorch >= 10, '室内火把成排: ' + houseTorch);
  let baseTorch = 0;
  for (let x = 50; x <= 77; x++) {
    for (let z = 46; z <= 73; z++) {
      if (api.getBlock(x, 8, z) === api.B_TORCH) baseTorch++;
    }
  }
  assert.ok(baseTorch >= 8, '地下室火把成排: ' + baseTorch);
});

test('体验馆: 展台 — 展品=派生清单, 每件展品的方块都在台面上(真件扫描)', () => {
  freshEnter();
  const found = new Set();
  for (let x = 54; x <= 72; x++) {
    for (let z = 51; z <= 66; z++) {
      const b = api.getBlock(x, 14, z);
      if (b) found.add(b);
    }
  }
  for (const id of ShowroomCore.showroomDisplays(
      [api.B_CRAFT, api.B_FURNACE, api.B_CHEST, api.B_BED])) {
    assert.ok(found.has(api.ITEMS[id].block), '展品在台面: ' + id);
  }
});

test('体验馆: 地下室 — 自密封石壳/内腔净空/矿样墙/楼梯井逐级通透(真件)', () => {
  freshEnter();
  assert.strictEqual(api.getBlock(63, 7, 60), 4, '地下室内腔地面(圆石)');
  assert.strictEqual(api.getBlock(63, 9, 60), 0, '内腔净空(高 3)');
  assert.strictEqual(api.getBlock(63, 11, 60), 4, '腔顶石壳(上承房内地板, 不塌不漏)');
  assert.strictEqual(api.getBlock(52, 8, 47), api.B_COAL_ORE, '矿样墙: 煤');
  assert.strictEqual(api.getBlock(55, 8, 47), api.B_DIAMOND_ORE, '矿样墙: 钻');
  assert.strictEqual(api.getBlock(56, 8, 47), api.B_CLAY, '矿样墙: 黏土');
  /* 楼梯井: 五级 1 格台阶(降=走落, 升=跳跃), 顶通房内地面; 每级站位净空+踏步在位 */
  for (let i = 0; i <= 4; i++) {
    const z = 71 - i; const standY = 12 - i;
    for (let y = standY; y <= 12; y++) {
      assert.strictEqual(api.getBlock(75, y, z), 0, '楼梯井通透: (75,' + y + ',' + z + ')');
    }
    assert.strictEqual(api.getBlock(75, standY - 1, z), 4,
        '踏步在位: (75,' + (standY - 1) + ',' + z + ')');
  }
});

/* ============ ⑥ 三站点交互 ============ */

/* 面板 DOM 面读: 递归找类名(旧版同款辅助) */
function findByClass(el, cls) {
  if (String(el.className || '').split(/\s+/).includes(cls)) return el;
  for (const c of el.children || []) {
    const r = findByClass(c, cls);
    if (r) return r;
  }
  return null;
}

test('体验馆: 熔炉交互 — 走近点击开面板/太远 toast 拒/✕ 统一出口收起', () => {
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

test('体验馆: 工作台/Tab — 合成面板开合, station 恒真全开(隐藏配方也点亮)', () => {
  freshEnter();
  const sx = pos.x; const sz = pos.z;
  pos.x = 52.5; pos.z = 47.5; /* 走近工作台 1 */
  ShowroomMode.onMouse(2, {x: 52, y: 13, z: 46});
  assert.ok(ShowroomMode.sr.craft.isOpen(), '点击工作台开合成面板');
  assert.notStrictEqual(ShowroomMode.sr.craft.panel.root.style.display, 'none', '面板可见');
  ShowroomMode.sr.craft.panel.close();
  assert.ok(!ShowroomMode.sr.craft.isOpen(), '✕ 出口收起');
  pos.x = sx; pos.z = sz;
  ShowroomMode.onKey('Tab'); /* Tab 同达(探险同款入口) */
  assert.ok(ShowroomMode.sr.craft.isOpen(), 'Tab 开面板');
  ShowroomMode.onKey('Tab');
  assert.ok(!ShowroomMode.sr.craft.isOpen(), 'Tab 再按收面板');
  assert.match(showroomSrc, /station: \(\) => true/, '台级配方随处可摆(dev 全开口径)');
  assert.match(showroomSrc, /KIT_HIDDEN_RECIPES/, '隐藏配方全点亮(清单随 mode-kit 自动跟)');
});

test('体验馆: 仓库箱 — 点箱开对应账户(箱格首件=派生首件) · 整摞存取零损耗(政策纯函数)', () => {
  freshEnter();
  const accounts = ShowroomMode.crates.accounts();
  assert.strictEqual(accounts[0].slots[0].id, 'shears', '工具箱首件=注册序首个工具(剪刀)');
  const sx = pos.x; const sz = pos.z;
  pos.x = 50.5; pos.z = 51.5; /* 走近第 0 箱 */
  ShowroomMode.onMouse(2, {x: 50, y: 13, z: 50});
  assert.ok(ShowroomMode.sr.chest.isOpen(), '点箱开面板');
  assert.notStrictEqual(ShowroomMode.sr.chest.panel.root.style.display, 'none', '面板可见');
  /* 面板箱格首格渲染当前账户首件图标(路由到了第 0 箱) */
  const grid = findByClass(ShowroomMode.sr.chest.panel.root, 'mkp-chestgrid');
  assert.ok(grid && grid.children[0] &&
      String(grid.children[0].innerHTML).indexOf(api.ITEMS.shears.icon) >= 0,
  '箱格首格=工具箱首件(剪刀图标)');
  /* 背包→箱→背包: 套餐首件原木整摞走一个来回(advChestPut/Take 政策路径) */
  ShowroomMode.sr.chest.open(2); /* 直开第 2 箱(烧炼·燃料箱) */
  const inv = ShowroomMode.getInv();
  const before = api.count(inv, 'log');
  ShowroomMode.crates.put(0); /* 背包槽 0(原木×64)整摞入箱 */
  assert.strictEqual(api.count(inv, 'log'), 0, '整摞出包入箱');
  const slot = accounts[2].slots.findIndex((s) => s && s.id === 'log' && s.n === 64);
  assert.ok(slot >= 0, '原木整摞躺在第 2 箱');
  ShowroomMode.crates.take(slot); /* 整摞取回 */
  assert.strictEqual(api.count(inv, 'log'), before, '整摞取回(零损耗)');
  ShowroomMode.sr.chest.panel.close();
  assert.ok(!ShowroomMode.sr.chest.isOpen(), '✕ 出口收起');
  pos.x = sx; pos.z = sz;
});

/* ============ ⑦ 熔炉行为线(编排口径, 纯函数不重测) ============ */

test('体验馆: 熔炉 — 自动放料(套餐首现矿种全量+最省燃料) · 2.5s/件 · 关面板照烧 · 退包', () => {
  freshEnter();
  const hit = {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z};
  ShowroomMode.onMouse(2, hit);
  ShowroomMode.sr.autoFill(); /* 绑定炉自算真 plan(读真包) */
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

/* ============ ⑧ 收场与重进 ============ */

test('体验馆: 收场与重进 — 面板全收+零掉落物 · 背包同实例原地重铸 · 仓库箱恢复原装', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  ShowroomMode.onMouse(2, {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z});
  ShowroomMode.sr.autoFill();
  ShowroomMode.update(2.6);
  ShowroomMode.sr.panel.close(); /* 先收熔炉面板(产物入包), Tab 才轮到合成面板 */
  ShowroomMode.onKey('Tab'); /* 合成面板开着一起收 */
  assert.ok(ShowroomMode.sr.craft.isOpen(), '面板开着(收场前提)');
  ShowroomMode.cleanup();
  assert.ok(!ShowroomMode.sr.isOpen() && !ShowroomMode.sr.craft.isOpen(),
      '双面板全收');
  assert.strictEqual(ShowroomMode.sr.furnaces.size, 0, '炉态清空');
  assert.strictEqual(dropCalls.length, 0, '常规收场零掉落物');
  assert.strictEqual(api.count(inv, 'log'), 63, '退炉三笔入包(炉内待烧料 63)');
  assert.strictEqual(api.count(inv, 'coal'), 63, '燃料退回(56 + 炉内 7)');
  assert.strictEqual(api.count(inv, 'charcoal'), 65, '产物已随关面板入包(对照样 64 + 新烧 1)');
  /* 重进: 同实例原地重铸 + 仓库箱恢复原装(退出即弃) */
  inv.slots[0] = null; /* 破坏现场 */
  ShowroomMode.crates.accounts()[0].slots[0] = null;
  freshEnter();
  assert.strictEqual(ShowroomMode.getInv(), inv, '背包引用跨进场稳定(面板族持引用)');
  assert.strictEqual(api.count(inv, ShowroomMode.stock[0].id),
      ShowroomMode.stock[0].n, '套餐照表重铸(恢复原装)');
  assert.strictEqual(ShowroomMode.crates.accounts()[0].slots[0].id, 'shears',
      '仓库箱照派生重铸(恢复原装)');
});

/* ============ ⑨ 放置链接入(place-kit, showroom-design §8) ============
   与冒险同一段规则代码: 单格放置(advPlaceCheck)/门结构(advDoorSiteOk/
   advDoorTogglePlan 成对换 id)/蓄力挖(breakTime+级联+掉落)。体验馆差异只在
   政策缝(零 journal/零 TTS/掉落照掉)。左键挖右键放的次序=使用先于挖放。 */

test('体验馆: 右键放置 — 套餐首行原木落地+扣件(单格放置走 kit 全链)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  assert.strictEqual(inv.slots[0].id, 'log', '套餐首行=原木(选中槽 0)');
  ShowroomMode.onMouse(2, {x: 58, y: 12, z: 68, nx: 0, ny: 1, nz: 0}); /* 草地顶面 */
  assert.strictEqual(api.getBlock(58, 13, 68), 5, '原木方块在场(木块 id 5)');
  assert.strictEqual(api.count(inv, 'log'), 63, '扣 1 件');
});

/* 注: 测试桩 loadScene 不清场(真件有 clearWorld), 三用例用互不重叠坐标 */
test('体验馆: 门 — 放置两格+左键点击开关(与冒险同一结构放置/成对换 id)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('door', 2); /* 从仓库取门进选中槽(测试捷径) */
  ShowroomMode.onMouse(2, {x: 58, y: 12, z: 70, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(api.getBlock(58, 13, 70), api.B_DOOR, '门下扇');
  assert.strictEqual(api.getBlock(58, 14, 70), api.B_DOOR_TOP, '门上扇');
  assert.strictEqual(api.count(inv, 'door'), 1, '扣 1 扇');
  ShowroomMode.onMouse(0, {x: 58, y: 13, z: 70, nx: 0, ny: 0, nz: 0}); /* 左键点门=开关(使用先于挖) */
  assert.strictEqual(api.getBlock(58, 13, 70), api.B_DOOR_OPEN, '点击开门(成对换 id)');
  ShowroomMode.onMouse(0, {x: 58, y: 13, z: 70, nx: 0, ny: 0, nz: 0});
  assert.strictEqual(api.getBlock(58, 13, 70), api.B_DOOR, '再点关回实心');
});

test('体验馆: 左键蓄力挖 — 到点破坏+掉落物照掉+update 喂真空拾取(与冒险同一实现)', () => {
  freshEnter();
  ShowroomMode.onMouse(2, {x: 60, y: 12, z: 72, nx: 0, ny: 1, nz: 0}); /* 放原木 (60,13,72) */
  dropCalls.length = 0;
  dropsTicks.length = 0;
  const origAim = PlaceKit.aimHit;
  PlaceKit.aimHit = () => ({x: 60, y: 13, z: 72, nx: 0, ny: 0, nz: 0}); /* Node 无相机: 桩准星 */
  ShowroomMode.mine.down = true;
  try {
    ShowroomMode.update(3); /* 原木徒手 3s: 一步到点破坏(蓄力链全在 kit) */
  } finally {
    PlaceKit.aimHit = origAim;
    ShowroomMode.mine.down = false;
  }
  assert.strictEqual(api.getBlock(60, 13, 72), 0, '到点破坏');
  assert.ok(dropCalls.some((d) => d[0] === 'log'), '掉落物照掉(级联 sink→Drops.spawn)');
  assert.ok(dropsTicks.length > 0, 'update 每帧喂掉落物真空拾取(玩家胸口点)');
});

/* ============ ⑩ TNT 点燃+爆炸链(adventure-core 纯函数直用) ============
   与探险逐字同规则(docs/showroom-design.md §7 红线内): 短按/按住二分
   (advTntTapStep)→引信 1.5s→爆炸(advExplodeCells 半径遍历: 圈内 TNT 链式
   接力点燃/70% 掷骰掉落)。体验馆差异只在政策缝: 零 journal(onEdit noop
   红线)/零任务记账(quest=false)/掀炉兜底退料。测试桩 loadScene 不清场,
   TNT 用例用东场空地(x 108..120, z 98..110), 与既有用例坐标零重叠。 */

test('体验馆: TNT 短按点燃 — tap 记账→引信 1.5s→爆炸圈内清空+70% 掉落(Drops.spawn)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 110, y: 12, z: 100, nx: 0, ny: 1, nz: 0}); /* TNT 落 (110,13,100) */
  assert.strictEqual(api.getBlock(110, 13, 100), B_TNT, 'TNT 在场');
  inv.slots[1] = api.mkStack('planks', 4);
  ShowroomMode.hotbar.select(1);
  ShowroomMode.onMouse(2, {x: 112, y: 12, z: 100, nx: 0, ny: 1, nz: 0}); /* 木板落 (112,13,100), 距爆心 2<3.5 */
  assert.strictEqual(api.getBlock(112, 13, 100), 6, '圈内对照木板在场');
  dropCalls.length = 0;
  ShowroomMode.onMouse(0, {x: 110, y: 13, z: 100}); /* 左键: mousedown 只记账不点燃 */
  assert.ok(ShowroomMode.tntTap(), 'tap 状态在位(短按判定待 update)');
  assert.strictEqual(ShowroomMode.fuses.length, 0, 'mousedown 当帧未点燃');
  ShowroomMode.update(0.05); /* 松手 <0.25s: 短按→点燃 */
  assert.strictEqual(ShowroomMode.tntTap(), null, '判定完状态出列');
  assert.strictEqual(ShowroomMode.fuses.length, 1, '短按点燃(引信在位)');
  assert.strictEqual(api.getBlock(110, 13, 100), B_TNT, '点燃不摘块');
  const realRandom = Math.random;
  Math.random = () => 0; /* 70% 掷骰必中签(注入口径, 纯函数单测同款) */
  try {
    ShowroomMode.update(1.6); /* 引信 1.5s 走完: 起爆 */
  } finally {
    Math.random = realRandom;
  }
  assert.strictEqual(ShowroomMode.fuses.length, 0, '引信出列');
  assert.strictEqual(api.getBlock(110, 13, 100), 0, '源块直清(不经掷骰)');
  assert.strictEqual(api.getBlock(112, 13, 100), 0, '圈内方块清空');
  assert.ok(dropCalls.some((d) => d[0] === 'planks'), '70% 掉落经 Drops.spawn(木板)');
});

test('体验馆: TNT 链式接力 — 圈内第二块被接力点燃(块还在), 二拍连环爆', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 8);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 114, y: 12, z: 100, nx: 0, ny: 1, nz: 0}); /* A (114,13,100) */
  ShowroomMode.onMouse(2, {x: 117, y: 12, z: 100, nx: 0, ny: 1, nz: 0}); /* B (117,13,100), 距 A 3<3.5 */
  assert.strictEqual(api.getBlock(114, 13, 100), B_TNT, 'A 在场');
  assert.strictEqual(api.getBlock(117, 13, 100), B_TNT, 'B 在场');
  ShowroomMode.onMouse(0, {x: 114, y: 13, z: 100});
  ShowroomMode.update(0.05); /* 点燃 A */
  assert.strictEqual(ShowroomMode.fuses.length, 1, 'A 引信在位');
  ShowroomMode.update(1.6); /* A 爆 → B 接力点燃(不即爆) */
  assert.strictEqual(api.getBlock(114, 13, 100), 0, 'A 爆');
  assert.strictEqual(api.getBlock(117, 13, 100), B_TNT, 'B 块还在(接力而非同爆)');
  assert.strictEqual(ShowroomMode.fuses.length, 1, 'B 引信在位');
  assert.strictEqual(ShowroomMode.fuses[0].x, 117, '接力引信=B 的位置');
  ShowroomMode.update(1.6); /* B 爆 */
  assert.strictEqual(api.getBlock(117, 13, 100), 0, 'B 二拍连环爆');
  assert.strictEqual(ShowroomMode.fuses.length, 0, '引信清空');
});

test('体验馆: TNT 按住转蓄力 — ≥0.25s 不点燃转挖(hard 0 挖走回收, 探险 D3 二分同款)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.onMouse(2, {x: 118, y: 12, z: 100, nx: 0, ny: 1, nz: 0}); /* TNT (118,13,100) */
  dropCalls.length = 0;
  ShowroomMode.onMouse(0, {x: 118, y: 13, z: 100}); /* 记账 */
  const origAim = PlaceKit.aimHit;
  PlaceKit.aimHit = () => ({x: 118, y: 13, z: 100, nx: 0, ny: 0, nz: 0}); /* Node 无相机: 桩准星 */
  ShowroomMode.onHold(true); /* 桌面按住/触屏长按同轨道 */
  try {
    ShowroomMode.update(0.3); /* ≥0.25s: 转蓄力(同帧 mineTick 到点破坏) */
  } finally {
    PlaceKit.aimHit = origAim;
    ShowroomMode.onHold(false);
    ShowroomMode.mine.down = false;
  }
  assert.strictEqual(ShowroomMode.fuses.length, 0, '按住不点燃');
  assert.strictEqual(api.getBlock(118, 13, 100), 0, '转挖: TNT 被挖走(hard 0 秒碎)');
  assert.ok(dropCalls.some((d) => d[0] === 'tnt'), '可回收: 掉 TNT 物品(挖掘硬度修正 D3)');
});

test('体验馆: TNT 掀门 — 整扇回收(掉 1 扇不双掉), 级联不进任务档(quest=false noop)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 110, y: 12, z: 104, nx: 0, ny: 1, nz: 0}); /* TNT (110,13,104) */
  inv.slots[1] = api.mkStack('door', 2);
  ShowroomMode.hotbar.select(1);
  ShowroomMode.onMouse(2, {x: 110, y: 12, z: 102, nx: 0, ny: 1, nz: 0}); /* 门 (110,13,102)+(110,14,102), 距爆心 2 */
  assert.strictEqual(api.getBlock(110, 13, 102), api.B_DOOR, '门下扇在场');
  assert.strictEqual(api.getBlock(110, 14, 102), api.B_DOOR_TOP, '门上扇在场');
  dropCalls.length = 0;
  ShowroomMode.onMouse(0, {x: 110, y: 13, z: 104});
  ShowroomMode.update(0.05);
  ShowroomMode.update(1.6);
  assert.strictEqual(api.getBlock(110, 13, 102), 0, '门下扇掀掉');
  assert.strictEqual(api.getBlock(110, 14, 102), 0, '门上扇整扇回收');
  assert.strictEqual(dropCalls.filter((d) => d[0] === 'door').length, 1, '掉 1 扇(不双掉)');
  assert.match(showroomSrc, /questMine: \(\) => \{\}/,
      '任务记账 noop(quest=false 不进任务档——体验馆零任务面)');
});

test('体验馆: 爆炸掀炉兜底 — 炉内三笔退包+炉态删除(探险「炉没了退料」同款缝)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[1] = api.mkStack('furnace', 2);
  ShowroomMode.hotbar.select(1);
  ShowroomMode.onMouse(2, {x: 110, y: 12, z: 106, nx: 0, ny: 1, nz: 0}); /* 炉 (110,13,106) */
  const key = api.blockKey(110, 13, 106);
  ShowroomMode.sr.autoFill(null, key); /* 无面板直调上料(kit 契约: posKey 寻址) */
  const f = ShowroomMode.sr.furnaces.get(key);
  assert.ok(f && f.input, '炉已上料(兜底前提)');
  const logBefore = api.count(inv, 'log');
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.onMouse(2, {x: 110, y: 12, z: 104, nx: 0, ny: 1, nz: 0}); /* TNT (110,13,104), 距炉 2 */
  ShowroomMode.onMouse(0, {x: 110, y: 13, z: 104});
  ShowroomMode.update(0.05);
  ShowroomMode.update(1.6);
  assert.strictEqual(api.getBlock(110, 13, 106), 0, '炉块掀掉');
  assert.ok(!ShowroomMode.sr.furnaces.has(key), '炉态删除(无幽灵炉)');
  assert.ok(api.count(inv, 'log') > logBefore, '炉内待烧料三笔退包');
});

test('体验馆: onEdit 红线 — TNT 全程零记账(源码 noop 守门)+重进恢复原装', () => {
  assert.match(showroomSrc, /onEdit: \(\) => \{\}/,
      'kit onEdit 缝保持 noop(恢复原装红线: 改动只活当次进场, 不进任何档)');
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.onMouse(2, {x: 120, y: 12, z: 100, nx: 0, ny: 1, nz: 0});
  ShowroomMode.onMouse(0, {x: 120, y: 13, z: 100});
  ShowroomMode.update(0.05);
  ShowroomMode.update(1.6); /* 爆完(东场留坑) */
  assert.strictEqual(api.getBlock(120, 13, 100), 0, '爆点已清');
  freshEnter(); /* 重进: 世界整场重铸 */
  assert.strictEqual(api.getBlock(120, 12, 100), 1, '草地复原(无重放需求=改动只活当次进场)');
});

test('体验馆: cleanup 复位 — 引信清空+tap 状态归零(不渗漏到下一模式)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('tnt', 4);
  ShowroomMode.onMouse(2, {x: 110, y: 12, z: 108, nx: 0, ny: 1, nz: 0});
  ShowroomMode.onMouse(0, {x: 110, y: 13, z: 108});
  ShowroomMode.update(0.05); /* 点燃: 引信在位 */
  assert.strictEqual(ShowroomMode.fuses.length, 1, '引信在位(复位前提)');
  ShowroomMode.onMouse(0, {x: 110, y: 13, z: 108}); /* 再记一笔 pending tap */
  assert.ok(ShowroomMode.tntTap(), 'tap 状态在位');
  ShowroomMode.cleanup();
  assert.strictEqual(ShowroomMode.fuses.length, 0, 'cleanup 引信清空(探险先例: 引信不落盘)');
  assert.strictEqual(ShowroomMode.tntTap(), null, 'cleanup tap 归零');
});

/* ============ ⑪ 拾取入包(Drops.onCollect, 现状缺口: 吸到玩家即蒸发) ============ */

test('体验馆: 拾取入包 — 收集回调入包+快捷栏跟进, 满包拒返 false(停地上冷却重试)', () => {
  freshEnter();
  assert.strictEqual(collectCbs.length, 1, 'init 注册收集回调(切模式 Drops.clear 后重挂, 探险同款)');
  const inv = ShowroomMode.getInv();
  for (let i = 0; i < api.INV_SLOTS; i++) inv.slots[i] = api.mkStack('log', 64); /* 满仓: 27 槽全满 */
  inv.slots[0] = api.mkStack('log', 60); /* 槽 0 腾并堆余量(仍无空槽) */
  let renders = 0;
  const origRender = ShowroomMode.hotbar.render;
  /* 间谍: 快捷栏同步被调观察面 */
  ShowroomMode.hotbar.render = () => {
    renders++;
    origRender();
  };
  try {
    assert.strictEqual(collectCbs[0]('log', 5), true, '部分收下返回 true(掉落物照常消失)');
    assert.strictEqual(api.count(inv, 'log'), api.INV_SLOTS * 64,
        '背包计数增加(并堆收满, 余量无空位即止)');
    assert.ok(renders > 0, '快捷栏同步被调(showroomSyncBar)');
    const n = renders;
    assert.strictEqual(collectCbs[0]('log', 3), false, '一件都放不下: 拒返 false(D6 背包满口径)');
    assert.strictEqual(renders, n, '拒收不刷快捷栏');
  } finally {
    ShowroomMode.hotbar.render = origRender;
  }
});

/* ============ ⑫ 玩家 HP 实体 + 进食 + 雪球(票 B, 探险同款镜像) ============
   吃判据 advEatPolicy(满血不吃不扣/金苹果 full 回满)、雪球冷却轨道
   (mkMelee.swingAction 与挥击同轨)+零伤害弹池(红线: 雪球不伤人)。体验馆
   无伤害源 → HP 恒满, 用例直驱实体血量(票 C 落怪后的同一路径); 用例坐标
   在西场空地(x 20..28, z 20), 与既有用例零重叠(桩 loadScene 不清场)。 */

test('体验馆: 进食链 — 半血右键吃: hp 回升+扣 1+快捷栏同步; 满血不吃不扣(advEatPolicy 政策)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('apple', 2);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.pEnt().hp = 15; /* 直驱至半血(实体即账本; 体验馆无伤害源, 票 C 落怪后同一路径) */
  let renders = 0;
  const origRender = ShowroomMode.hotbar.render;
  /* 间谍: 快捷栏同步被调观察面(⑪ 同款) */
  ShowroomMode.hotbar.render = () => {
    renders++;
    origRender();
  };
  try {
    ShowroomMode.onMouse(2, {x: 20, y: 12, z: 20, nx: 0, ny: 1, nz: 0}); /* 草地: 吃吞点击不落放置 */
    assert.strictEqual(ShowroomMode.pEnt().hp, 19, '苹果回 4 血(ITEMS.food)');
    assert.strictEqual(inv.slots[0].n, 1, '吃掉 1 个');
    assert.ok(renders > 0, '快捷栏同步被调(showroomSyncBar)');
    assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('吃掉')), '吃货 toast(dev 降噪: 零 TTS/零音效)');
    assert.strictEqual(api.getBlock(20, 13, 20), 0, '吃吞点击: 不落放置');
  } finally {
    ShowroomMode.hotbar.render = origRender;
  }
  ShowroomMode.pEnt().hp = 30; /* 满血 */
  ShowroomMode.onMouse(2, {x: 20, y: 12, z: 20, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(inv.slots[0].n, 1, '满血不吃不扣(政策口径)');
  assert.strictEqual(ShowroomMode.pEnt().hp, 30, '满血血量不动');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('饱')),
      '满血提示(attempt 被吞, 仍不落放置)');
  assert.strictEqual(api.getBlock(20, 13, 20), 0, '满血 attempt 也不落放置');
});

test('体验馆: 金苹果 — 半血右键吃回满(full 旗标经 advEatPolicy)+扣 1', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('golden_apple', 2);
  ShowroomMode.hotbar.select(0);
  ShowroomMode.pEnt().hp = 12;
  ShowroomMode.onMouse(2, {x: 22, y: 12, z: 20, nx: 0, ny: 1, nz: 0});
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
  mobsRig.list.push({type: 'zombie', pos: {x: 64.5, y: 13, z: 62.3}, vel: {x: 0, z: 0},
    cfg: {h: 1.8, hitR: 0.55}, dead: false, gone: false}); /* 面前 2.2 格假怪(仅判定面) */
  try {
    ShowroomMode.onMouse(2, {x: 24, y: 12, z: 20, nx: 0, ny: 1, nz: 0}); /* 草地: 掷出吞点击 */
    assert.strictEqual(inv.slots[0].n, 2, '掷出消耗 1 颗');
    assert.strictEqual(ShowroomMode.snowballs.count(), 1, '弹池 1 发');
    ShowroomMode.onMouse(2, {x: 24, y: 12, z: 20, nx: 0, ny: 1, nz: 0});
    assert.strictEqual(inv.slots[0].n, 2, '冷却内连点不扣(swingAction 与挥击同轨)');
    assert.strictEqual(ShowroomMode.snowballs.count(), 1, '冷却内不出膛');
    /* 弹道步进至命中: 零伤害红线 — update 喂弹池的行为面同证 */
    for (let i = 0; i < 60 && !mobsRig.hits.length; i++) ShowroomMode.update(1 / 60);
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
  ShowroomMode.onMouse(2, {x: 26, y: 12, z: 20, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(api.getBlock(26, 13, 20), 2, '泥土照常放置(放置链)');
  assert.strictEqual(inv.slots[0].n, 1, '扣 1(放置链口径)');
  assert.strictEqual(ShowroomMode.snowballs.count(), 0, '没有雪球出膛');
});

test('体验馆: cleanup 复位 — 雪球弹池清空+HP 实体复位满血(跨进场不渗漏, 探险清场纪律先例)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  inv.slots[0] = api.mkStack('snowball', 3);
  ShowroomMode.hotbar.select(0);
  const origRig = globalThis.CameraRig;
  globalThis.CameraRig = {aim: () => ({origin: {x: pos.x, y: pos.y + 1.6, z: pos.z},
    dir: {x: 0, y: 0, z: -1}})};
  ShowroomMode.onMouse(2, {x: 28, y: 12, z: 20, nx: 0, ny: 1, nz: 0}); /* 掷出一发 */
  globalThis.CameraRig = origRig;
  assert.strictEqual(ShowroomMode.snowballs.count(), 1, '弹池在位(复位前提)');
  ShowroomMode.pEnt().hp = 7; /* 破坏现场: 残血 */
  ShowroomMode.cleanup();
  assert.strictEqual(ShowroomMode.snowballs.count(), 0, '弹池清空(不渗漏下一模式)');
  assert.strictEqual(ShowroomMode.pEnt().hp, ShowroomMode.pEnt().maxHp, 'HP 复位满血');
  freshEnter(); /* 重进: 干净初始态 */
  assert.strictEqual(ShowroomMode.snowballs.count(), 0, '重进弹池仍空');
  assert.strictEqual(ShowroomMode.pEnt().hp, ShowroomMode.pEnt().maxHp, '重进满血');
});
