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
  ITEMS, isTool, toolOf, breakTime,
  mkInventory, add, count, remove, damageTool, serialize, deserialize, HOTBAR_SLOTS, INV_SLOTS,
  raycastVoxel, collidesAtPlayer, rollBlockDrop, Drops,
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
}, swing() {}, flash() {}};
globalThis.Mobs = {clear() {
  calls.push(['mobsClear']);
}, list() {
  return [];
}}; /* Drops 走上方 vm 真件包装(T12 挖掘掉落链可真跑) */
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
  AdventureMode.init();
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

test('探险模式: 3 个怪物巢穴位点 — 土丘洞穴地形就位, 常量表给 T14(本单不刷怪)', () => {
  freshInit();
  const nests = A.ADV.nests;
  assert.strictEqual(nests.length, 3, '三个巢穴位点');
  nests.forEach((n, i) => {
    assert.ok(n.x >= 2 && n.x < W - 2 && n.z >= 2 && n.z < D - 2, '巢穴 ' + i + ' 在界内');
    assert.ok(Array.isArray(n.kinds) && n.kinds.length >= 2, '巢穴 ' + i + ' 常量表带刷怪种类备注(T14 消费)');
    assert.strictEqual(cell(n.x, 25, n.z), 2, '巢穴 ' + i + ' 是土丘(泥土穹顶)');
    assert.strictEqual(cell(n.x, 25, n.z + 2), 0, '巢穴 ' + i + ' 有洞口');
  });
  assert.strictEqual(calls.filter((c) => c[0] === 'mobsClear').length, 0, 'init 不刷怪(战斗归 T14)');
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
      '退出清掉落物与怪物(T14 预留)');
  assert.strictEqual(root.parentNode, null, 'cleanup 卸载面板 DOM');
  assert.ok(calls.some((c) => c[0] === 'setItem' && c[1] === globalThis.PLAYER.heldItem),
      '退出复位默认手持物(Avatar 跨模式存活)');
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


