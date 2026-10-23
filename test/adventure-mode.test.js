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

/* ---------- 真引擎件: config + voxel + scene-kit + 两纯核心, 共享一个 vm 词法环境 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/items-core.js', 'js/inventory-core.js',
  'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, hashRand, blockKey, world, worldCells, SceneKit,
  BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  ITEMS, isTool, toolOf, stackMax, mkStack,
  mkInventory, add, count, remove, damageTool, serialize, deserialize, HOTBAR_SLOTS, INV_SLOTS,
  rollDrops, MOB_DROPS,
})`, eng);
Object.assign(globalThis, api); /* 模式文件经全局名消费这些真件(经典 script 词法环境) */

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
globalThis.showPage = (id) => calls.push(['showPage', id]);
globalThis.uiPause = () => calls.push(['uiPause']);
globalThis.iconOf = () => ''; /* 像素图标工坊未加载: 空串=跳过图标 */
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
const ADV_MOB_CFG = { /* 四怪数值摘自 config.js MOB_TYPES(巢穴池, 行为断言所需最小集) */
  zombie: {name: '僵尸', hp: 30, dmg: 5, speed: 2.3, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55},
  skeleton: {name: '骷髅', hp: 26, dmg: 6, speed: 2.6, range: 14, cd: 2.6, h: 1.9, ranged: true, hitR: 0.55},
  spider: {name: '蜘蛛', hp: 24, dmg: 3, speed: 3.0, range: 2.2, cd: 1.2, h: 0.9, hitR: 0.65},
  creeper: {name: '苦力怕', hp: 28, dmg: 33, speed: 3.1, range: 2.0, cd: 9, h: 1.7, hitR: 0.5},
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
globalThis.Drops = {
  spawn(id, n, x, y, z) {
    dropsState.spawned.push({id, n, x, y, z});
  },
  update() {}, render() {},
  onCollect(cb) {
    dropsState.cbs.push(cb);
  },
  clear() {
    calls.push(['dropsClear']);
    dropsState.spawned.length = 0;
    dropsState.cbs.length = 0;
  },
  list() {
    return [];
  },
};
globalThis.sfx = (n) => {
  calls.push(['sfx', n]);
};
globalThis.Fx = {debrisBurst() {
  calls.push(['debris']);
}, kick() {
  calls.push(['kick']);
}};
globalThis.CombatCore = require('../js/combat-core.js'); /* 战斗核心: 真模块(弹道/盒判定是纯函数) */
globalThis.pos = {x: 61.5, y: 25, z: 76.5, set() {}};
globalThis.vel = {set() {}};
globalThis.yaw = 0;
globalThis.pitch = 0;
globalThis.onGround = false;
globalThis.flyMode = false;

const ModeKit = require('../js/mode-kit.js');
globalThis.mkMode = ModeKit.mkMode;
globalThis.ModeKit = ModeKit;
ModeKit.spawn = (x, y, z, o) => {
  calls.push(['spawn', x, y, z, o]);
}; /* 出生点记账(不写真玩家状态) */

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
  assert.ok(spoken.some((s) => String(s).indexOf('探险') >= 0 || String(s).indexOf('欢迎') >= 0), '进场欢迎语音');
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
  assert.ok(iron >= 120 && iron <= 800, '铁矿中等: ' + iron);
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
  /* init 首刷: 每巢 2~3 只, 种类取自本巢 kinds 池, 落位在土丘洞口附近环带(不贴脸) */
  const byNest = [[], [], []];
  for (const m of mobsState.spawned) {
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
