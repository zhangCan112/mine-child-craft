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
for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/items-core.js',
  'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, hashRand, blockKey, world, worldCells, SceneKit,
  BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_GRASS_TUFT, B_SAPLING, B_TORCH,
  ITEMS, isTool, toolOf, stackMax, mkStack, breakTime,
  mkInventory, add, count, remove, damageTool, serialize, deserialize, HOTBAR_SLOTS, INV_SLOTS,
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
/* 单块编辑 seam: world.js 太重, 记账走真 setBlockRaw(碎屑反馈归浏览器的 editBlock 内置) */
globalThis.editBlock = (x, y, z, id) => {
  api.setBlockRaw(x, y, z, id);
  calls.push(['edit', x, y, z, id]);
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
const ADV_MOB_CFG = {/* 四怪数值摘自 config.js MOB_TYPES(巢穴池, 行为断言所需最小集) */
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
  holdOnly('pick_wood', 1, 120); /* 木镐 tier1 < 铁矿 tier2: 慢速 8s 封顶且不掉落 */
  const spot = findGrassSpot();
  api.setBlockRaw(spot.x, 24, spot.z, 0); /* 竖井直达铁矿(测试布景) */
  api.setBlockRaw(spot.x, 23, spot.z, 0);
  api.setBlockRaw(spot.x, 22, spot.z, api.B_IRON_ORE);
  globalThis.camera = {};
  globalThis.CameraRig = {aim: () => ({origin: {x: spot.x + 0.5, y: 24.5, z: spot.z + 0.5},
    dir: {x: 0, y: -1, z: 0}})};
  AdventureMode.onMouse(0, {x: spot.x, y: 22, z: spot.z, nx: 0, ny: 1, nz: 0});
  AdventureMode.update(0.01); /* 首帧锁定目标并算出 breakTime */
  assert.strictEqual(A.advMine.need, 8, '不匹配 5 倍慢速封顶 8s(breakTime 驱动)');
  for (let i = 0; i < 17 && cell(spot.x, 22, spot.z) !== 0; i++) AdventureMode.update(0.5); /* 8s 蓄满 */
  assert.strictEqual(cell(spot.x, 22, spot.z), 0, '可挖(慢) — 破坏照样发生');
  assert.ok(!globalThis.Drops.list().some((d) => d.id === 'iron_ore'), 'tier 不足不掉落(只碎)');
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 0, '背包没有铁矿石');
  assert.ok(spoken.some((s) => String(s).indexOf('更硬') >= 0), 'TTS 提示换更硬的镐子');
  clearAim();
});

test('T12 耐久政策: damageTool 归零 — remove 清槽 + 安抚 TTS + 观感回落锄头', () => {
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
  assert.ok(calls.some((c) => c[0] === 'setItem' && c[1] === globalThis.PLAYER.heldItem),
      '手持观感回落默认锄头');
  clearAim();
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
  assert.strictEqual(roll(20, () => 0).length, 0, 'TNT 源块无 drop 字段 → 空手(不自掉)');
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
  /* 自动放料: 面板只报意图, 模式层执行 take — 矿石全入炉 + 最省凑料 1 块煤(热值 8 ≥ 5 件) */
  api.add(A.advGetInv(), 'iron_ore', 5);
  api.add(A.advGetInv(), 'coal', 2);
  A.advFurnaceAutoFill();
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 0, '矿石全入炉(take 扣包)');
  assert.strictEqual(api.count(A.advGetInv(), 'coal'), 1, '最省凑料: 1 块煤已覆盖 5 件热值');
  assert.strictEqual(A.advFurnace.input.n, 5, '炉内待烧 5 件');
  assert.strictEqual(A.advFurnace.fuel.n, 1, '炉内燃料 1 块煤');
  /* 烧炼 12.5s+: 5 件铁锭 + 完成播报(产物名入句) */
  spoken.length = 0;
  for (let i = 0; i < 340; i++) AdventureMode.update(0.05); /* 17s > 12.5s */
  assert.deepStrictEqual(A.advFurnace.out, {id: 'iron_ingot', n: 5}, '5 件全部烧成');
  assert.ok(spoken.some((s) => String(s).indexOf('铁锭') >= 0 && String(s).indexOf('烧好') >= 0),
      '完成播报(产物名入句)');
  A.advFurnaceClose();
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ingot'), 5, '关面板取产入包');
  assert.strictEqual(A.ADV.furnaceOpen, false, '面板收起');
  assert.strictEqual(A.advFurnace.out, null, '产物槽清空');
});

test('T13 死亡清炉: 炉内材料全额退背包 + 状态归零(退世界同一政策)', () => {
  mem.clear();
  freshInit();
  A.advFurnace.input = {id: 'iron_ore', n: 3};
  A.advFurnace.fuel = {id: 'coal', n: 1};
  A.advFurnace.out = {id: 'iron_ingot', n: 2};
  AdventureMode.onVoidFall(); /* 死亡类事件 → advPlayerDied → 清炉 */
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 3, '待烧料退包');
  assert.strictEqual(api.count(A.advGetInv(), 'coal'), 1, '燃料退包');
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ingot'), 2, '产物退包');
  assert.strictEqual(A.advFurnace.input, null, '炉清空(状态归零)');
  assert.strictEqual(A.advFurnace.heat, 0, '热值清零');
});

test('T13 退世界清炉: cleanup 先退料落盘再清场(重进熔炉是空的, 材料在背包)', () => {
  mem.clear();
  freshInit();
  A.advFurnace.input = {id: 'iron_ore', n: 3};
  AdventureMode.cleanup();
  assert.strictEqual(api.count(A.advGetInv(), 'iron_ore'), 3, '退炉材料进背包');
  const invSave = JSON.parse(mem.get('inventory_save'));
  assert.ok(invSave.slots.some((s) => s && s.id === 'iron_ore' && s.n === 3), '退料随 inventory_save 落盘');
  freshInit();
  assert.strictEqual(A.advFurnace.input, null, '重进熔炉是空的(炉态不进存档, D8 口径)');
});

test('T13 TNT 行为链: 放置 → 空手点击点燃 → 引信延时 → 爆炸破坏记账 + 波及怪物受击', () => {
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
  assert.strictEqual(A.advFuses.length, 1, '点击点燃引信(左键分支最前拦截)');
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

/* ============ T15 任务链 12 步 + 仪式感 ============ */

test('T15 QUESTS 数据表: 12 步主线 + 终章 — 步序照设计稿 D11, 形状齐, id 唯一', () => {
  const qs = A.ADV_QUESTS;
  assert.strictEqual(qs.length, 13, '12 步主线 + 终章');
  assert.deepStrictEqual(qs.map((q) => q.id),
      ['q1_log', 'q2_planks', 'q3_table', 'q4_pick_wood', 'q5_cobble', 'q6_pick_stone',
        'q7_coal', 'q8_torch', 'q9_iron', 'q10_smelt', 'q11_pick_iron', 'q12_diamond', 'finale'],
      '步序 = 设计稿 D11 清单(砍树→木板→工作台→木镐→圆石→石镐→煤→火把→铁矿→熔炉铁锭→铁镐→钻石→钻石剑)');
  assert.strictEqual(qs[12].finale, true, '第 13 条是终章(主线 12 条不带 finale 标记)');
  assert.ok(qs.slice(0, 12).every((q) => !q.finale), '主线步骤无 finale 标记');
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
  assert.strictEqual(new Set(qs.map((q) => q.id)).size, 13, 'id 唯一');
});

test('T15 谓词逐条: 最小满足触发 / 空账本或差一不触发 / 复合步两条件缺一不可', () => {
  const qs = A.ADV_QUESTS;
  const ck = (i, c) => qs[i].check(c);
  assert.strictEqual(ck(0, {collect_log: 3}), true, '步1: 捡 3 原木 → 达成');
  assert.strictEqual(ck(0, {collect_log: 2}), false, '步1: 差一根');
  assert.strictEqual(ck(0, {}), false, '步1: 空账本');
  assert.strictEqual(ck(1, {craft_planks: 4}), true, '步2: 合成 4 木板(一次手搓即 4)');
  assert.strictEqual(ck(1, {craft_planks: 3}), false, '步2: 差一块');
  assert.strictEqual(ck(2, {craft_craft_table: 1, place_craft_table: 1}), true, '步3: 合成+放置');
  assert.strictEqual(ck(2, {craft_craft_table: 1}), false, '步3: 只合成没放下');
  assert.strictEqual(ck(2, {place_craft_table: 1}), false, '步3: 只放下不算(文案「合成并放置」)');
  assert.strictEqual(ck(3, {craft_pick_wood: 1}), true, '步4: 木镐');
  assert.strictEqual(ck(4, {mine_cobble: 8}), true, '步5: 挖 8 圆石');
  assert.strictEqual(ck(4, {mine_cobble: 7}), false, '步5: 差一块');
  assert.strictEqual(ck(5, {craft_pick_stone: 1}), true, '步6: 石镐');
  assert.strictEqual(ck(6, {mine_coal_ore: 5}), true, '步7: 挖 5 煤');
  assert.strictEqual(ck(6, {mine_coal_ore: 4}), false, '步7: 差一个');
  assert.strictEqual(ck(7, {craft_torch: 4}), true, '步8: 合成 4 火把(一次配方即 4)');
  assert.strictEqual(ck(8, {mine_iron_ore: 5}), true, '步9: 挖 5 铁矿');
  assert.strictEqual(ck(9, {place_furnace: 1, smelt_iron_ingot: 3}), true, '步10: 放熔炉+烧 3 铁锭');
  assert.strictEqual(ck(9, {smelt_iron_ingot: 3}), false, '步10: 只烧没放炉不算');
  assert.strictEqual(ck(9, {place_furnace: 1, smelt_iron_ingot: 2}), false, '步10: 差一块铁锭');
  assert.strictEqual(ck(10, {craft_pick_iron: 1}), true, '步11: 铁镐');
  assert.strictEqual(ck(11, {mine_diamond_ore: 3}), true, '步12: 挖 3 钻石');
  assert.strictEqual(ck(11, {mine_diamond_ore: 2}), false, '步12: 差一颗');
  assert.strictEqual(ck(12, {craft_sword_diamond: 1}), true, '终章: 合成钻石剑');
  assert.strictEqual(ck(12, {craft_pick_diamond: 1}), false, '终章: 钻石镐不算(要的是剑)');
  /* prog 进度分子: 复合步取各条件已得之和, 单条件步钳在 target */
  assert.strictEqual(qs[2].prog({craft_craft_table: 1}), 1, '步3 prog: 合成半程');
  assert.strictEqual(qs[9].prog({place_furnace: 1, smelt_iron_ingot: 2}), 3, '步10 prog: 1+2');
  assert.strictEqual(qs[0].prog({collect_log: 9}), 3, '步1 prog: 超量钳在 target');
  assert.strictEqual(qs[0].prog({}), 0, '空账本 prog 0');
});

test('T15 事件计数累计链: 挖→拾取→合成→放置→烧成 五类挂点只 += (与步进解耦)', () => {
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
  /* 放置: advTryPlace 成功分支(站点两键) */
  const spot = findGrassSpot();
  holdOnly('craft_table', 1);
  AdventureMode.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(c().place_craft_table, 1, '放置工作台 → place_craft_table 1');
  /* 烧成: advFurnaceTick 产出分支(3 件铁锭 = 7.5s+) */
  A.advFurnace.input = {id: 'iron_ore', n: 3};
  A.advFurnace.fuel = {id: 'coal', n: 1};
  for (let i = 0; i < 170; i++) AdventureMode.update(0.05); /* 8.5s */
  assert.strictEqual(c().smelt_iron_ingot, 3, '烧成 3 件铁锭 → smelt_iron_ingot 3');
  /* 未发生的事件不预置键(账本从零长出来) */
  assert.strictEqual(c().mine_diamond_ore, undefined, '没挖钻石就没有键');
});

test('T15 不越级: 第 n 步只查第 n 步谓词 — 后期计数全满仍逐级推进(一周期一步)', () => {
  mem.clear();
  freshInit();
  /* 把全部计数一次灌满(模拟玩家把后面的事全提前做了) — 步进仍从第 1 步逐级走 */
  const c = A.ADV.quest.counts;
  c.collect_log = 3; c.craft_planks = 4; c.craft_craft_table = 1; c.place_craft_table = 1;
  c.craft_pick_wood = 1; c.mine_cobble = 8; c.craft_pick_stone = 1; c.mine_coal_ore = 5;
  c.craft_torch = 4; c.mine_iron_ore = 5; c.place_furnace = 1; c.smelt_iron_ingot = 3;
  c.craft_pick_iron = 1; c.mine_diamond_ore = 3; c.craft_sword_diamond = 1;
  AdventureMode.update(0.51); /* 一个节流周期只查当前步一次 */
  assert.strictEqual(A.ADV.quest.step, 1, '首查只推第 1 步(不直接跳终章)');
  AdventureMode.update(0.51);
  assert.strictEqual(A.ADV.quest.step, 2, '逐级推进: 一步一周期');
});

test('T15 步进链(行为): 捡齐 3 原木 → 表扬 TTS+完成 toast+音效+引导下一步+落盘+任务卡刷新', () => {
  mem.clear();
  freshInit();
  assert.ok(spoken.some((s) => String(s).indexOf('原木') >= 0), '进场欢迎句带第 1 步语音引导(hint 并句, 不 cancel 打断)');
  spoken.length = 0;
  calls.length = 0;
  dropsState.cbs[0]('log', 3); /* 捡齐 3 原木 */
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
  assert.strictEqual(saved.counts.collect_log, 3, 'counts 落盘(中途退出当前步进度不丢)');
  freshInit();
  assert.strictEqual(A.ADV.quest.step, 1, '重进恢复 step');
  assert.strictEqual(A.ADV.quest.counts.collect_log, 3, '重进恢复 counts');
});

test('T15 老档归一化: {step:N} 无 counts → 补空表当前步从零继续; counts 损坏同样归一', () => {
  mem.clear();
  mem.set('adventure_quest_save', JSON.stringify({_v: 1, step: 4})); /* step 0 基: QUESTS[4] = 挖 8 圆石 */
  freshInit();
  assert.strictEqual(A.ADV.quest.step, 4, 'step 保留');
  assert.deepStrictEqual(A.ADV.quest.counts, {}, 'counts 补空表(mkSaveSlot defaults 只补缺失字段)');
  /* 当前步(挖 8 圆石)从零累计: 历史计数不追溯——玩家挖过什么无法从世界状态重建 */
  for (let i = 0; i < 8; i++) A.advBreakBlock(80 + i, 24, 80, 3, {time: 1, drops: true});
  AdventureMode.update(0.55);
  assert.strictEqual(A.ADV.quest.step, 5, '从零计数照样推进第 5 步(圆石步完成)');
  /* 损坏 counts(非对象) → init 归一化空表, step 钳在表界 */
  mem.clear();
  mem.set('adventure_quest_save', JSON.stringify({_v: 1, step: 99, counts: 3}));
  freshInit();
  assert.deepStrictEqual(A.ADV.quest.counts, {}, '损坏 counts 归一空表');
  assert.strictEqual(A.ADV.quest.step, 13, '越界 step 钳到表外上界(终章完成位)');
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
  assert.strictEqual(A.ADV.quest.step, 0, '仪式≠步进(第 12 步要凑满 3 颗)');
});

test('T15 终章: 合成钻石剑 → 「小小探险家」称号+烟花+入档; 只触发一次, 重进不重复', () => {
  mem.clear();
  freshInit();
  A.ADV.quest.step = 12; /* 测试捷径: 直达终章(主线 12 步谓词已由直测覆盖) */
  spoken.length = 0;
  calls.length = 0;
  A.advOnCraft({item: 'sword_diamond', n: 1, leftover: 0});
  AdventureMode.update(0.55);
  assert.strictEqual(A.ADV.quest.step, 13, '终章完成(表外 step=13)');
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
  /* 称号随档: cleanup 落盘 → 重进 step=13 不再触发 */
  AdventureMode.cleanup();
  freshInit();
  spoken.length = 0;
  calls.length = 0;
  for (let i = 0; i < 20; i++) AdventureMode.update(0.05);
  assert.strictEqual(A.ADV.quest.step, 13, '重进 step 保持表外(终章完成)');
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
  A.ADV.quest.step = 13;
  A.ADV.quest.title = '小小探险家';
  A.advQuestPaint();
  assert.ok(html().indexOf('小小探险家') >= 0, '称号置顶显示');
  assert.ok(html().indexOf('自由') >= 0, '全部完成提示(循环出口: 自由玩)');
  assert.ok(html().indexOf('<s>') >= 0, '全史划线保留');
});
