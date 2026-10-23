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
for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/items-core.js', 'js/inventory-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, hashRand, blockKey, world, worldCells, SceneKit,
  BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  ITEMS, isTool, toolOf,
  mkInventory, add, serialize, deserialize, HOTBAR_SLOTS, INV_SLOTS,
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
}, swing() {}, flash() {}};
globalThis.Mobs = {clear() {
  calls.push(['mobsClear']);
}, list() {
  return [];
}};
globalThis.Drops = {clear() {
  calls.push(['dropsClear']);
}};
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
