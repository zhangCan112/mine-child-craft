'use strict';
/* 探险核心 (js/adventure-core.js) 单测 — node --test (零依赖)
   运行: node --test test/adventure-core.test.js
   S1 剥核后的同名单测(conventions §1.2 守门): 纯核心只装真引擎件
   (config/voxel/scene-kit/四纯核心/掉落库, 与 test/adventure-mode.test.js
   同一套 vm 惯例)直测——地形确定性必须对着真散布函数断言, 纯函数段
   逐条钉口径; 深交互链(TTS/toast/掉落实体)仍在 adventure-mode.test.js
   经壳行为断言, 两份互不重复。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 真引擎件: config + mob-registry + voxel + scene-kit + 四纯核心/库, 共享一个 vm 词法环境 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, blockKey, isOpaque, SceneKit, Daylight,
  BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT, B_BED, B_BED_FOOT, Daylight, DAYLIGHT,
  B_FARMLAND, B_WHEAT_3, B_FLOWER_Y, B_FLOWER_W, B_CACTUS,
  B_WHEAT_0, B_WHEAT_1, B_WHEAT_2,
  B_SNOW, B_ICE, B_SANDSTONE, B_GLOWSTONE, B_CHEST, /* 扩容主题五件建场件消费(望塔灯/箱, 松林/花田/南池) */
  B_DOOR, B_DOOR_TOP, B_DOOR_OPEN, B_DOOR_TOP_OPEN, B_GLASS_PANE,
  B_SPAWNER, B_OBSIDIAN, /* 黑巢/巢穴副本建场件消费(den-nest: 巢之心/祭坛柱) */
  ITEMS, isTool, toolOf, breakTime, stackMax, durOf,
  mkInventory, add, count, remove, damageTool, serialize, deserialize, INV_SLOTS,
  rollBlockDrop, rollDrops, FUEL, fuelUnits, smeltOf, SMELT_T,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */

const Core = require('../js/adventure-core.js');

/* ---------- 世界快照与统计助手(对真 worldCells 断言) ---------- */
const W = api.WORLD_W;
const D = api.WORLD_D;
const H = api.WORLD_H;
const cell = (x, y, z) => vm.runInContext('worldCells', eng)[(y * D + z) * W + x];
const snapshot = () => Buffer.from(vm.runInContext('worldCells', eng)); /* 逐字节复现比对 */
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

/* ============ 地形生成 ============ */

test('核心地形: advBuildWorld 全图确定性(两次生成逐字节一致) + 小屋/湖形状', () => {
  Core.advBuildWorld();
  const a = snapshot();
  const hut = Core.ADV_HUT;
  assert.strictEqual(cell(hut.x1, 25, hut.z1), 5, '小屋角柱原木');
  assert.strictEqual(cell(61, 25, hut.z1), 0, '北墙正中门洞');
  const lake = Core.ADV_LAKE;
  assert.ok(countId(api.B_CLAY, (x, y, z) => Math.hypot(x - lake.cx, z - lake.cz) <= lake.r) >= 150,
      '湖底黏土层(红砖链源头)');
  /* 地层随高度场的采样断言在「T5 地形接入」测试(表面=24+advHeightAt 处草皮) */
  /* 清场重建: 逐字节复现(SceneKit.rand/hashRand 确定性, 零 Math.random) */
  vm.runInContext('worldCells.fill(0)', eng);
  Core.advBuildWorld();
  const b = snapshot();
  assert.deepStrictEqual(a, b, '两次建场 worldCells 逐块一致');
});

test('核心地形: 巢穴位点常量与矿带不越界(地图常量表是壳与单测的共同权威)', () => {
  assert.strictEqual(Core.ADV_NESTS.length, 4, '四巢穴(三普通巢 + 黑巢主巢, den-nest §2)');
  Core.ADV_NESTS.forEach((n, i) => {
    assert.ok(n.x >= 2 && n.x < W - 2 && n.z >= 2 && n.z < D - 2, '巢 ' + i + ' 在界内');
    assert.ok(Array.isArray(n.kinds) && n.kinds.length >= 2, '巢 ' + i + ' 刷怪池');
  });
  let ok = true;
  for (let y = 0; y < H && ok; y++) {
    for (let z = 0; z < D && ok; z++) {
      for (let x = 0; x < W && ok; x++) {
        const id = cell(x, y, z);
        if (id === api.B_COAL_ORE && (y < 12 || y > 20)) ok = false;
        if (id === api.B_DIAMOND_ORE && (y < 0 || y > 5)) ok = false;
      }
    }
  }
  assert.ok(ok, '矿种不越深度带(煤 y12~20 · 钻 y0~5)');
});

test('T5 坐标迁移: 湖/两坑/山洞/三巢钉死设计稿 §2.4 圈层表, 小屋与出生点不动(老档红线)', () => {
  assert.deepStrictEqual([Core.ADV_LAKE.cx, Core.ADV_LAKE.cz, Core.ADV_LAKE.r], [36, 58, 7],
      '湖挪近资源圈 (36,58)——黏土教学链步行 30 秒内可达');
  assert.deepStrictEqual([Core.ADV_PITS[0].cx, Core.ADV_PITS[0].cz], [100, 52], '煤坑 (100,52) 矿业圈东');
  assert.deepStrictEqual([Core.ADV_PITS[1].cx, Core.ADV_PITS[1].cz], [24, 44], '铁坑 (24,44) 矿业圈西');
  assert.deepStrictEqual([Core.ADV_CAVE.x1, Core.ADV_CAVE.x2, Core.ADV_CAVE.zStart, Core.ADV_CAVE.zEnd],
      [61, 62, 10, 30], '山洞口北缘 (62,10), 隧道向南深潜到穴室 z30');
  assert.ok(Core.ADV_CAVE.zEnd > Core.ADV_CAVE.zStart, '方向反转: 原隧道向北(zStart72→zEnd52), 现向南');
  assert.deepStrictEqual(Core.ADV_NESTS.map((n) => [n.x, n.z]), [[44, 60], [96, 36], [20, 16], [100, 8]],
      '四巢难度序: 近僵尸(44,60) / 中蜘蛛(96,36) / 远苦力怕(20,16) / 黑巢主巢(100,8)');
  assert.deepStrictEqual(Core.ADV_NESTS.map((n) => n.kinds[0]), ['zombie', 'spider', 'creeper', 'cave_spider'],
      '巢穴主打种随难度递进(僵尸一家→虫虫族→草木族苦力怕→洞穴蜘蛛, den-nest D7)');
  assert.ok(Core.ADV_NESTS[3].den === true, '黑巢行带 den 旗标(建场分派 advBuildDenNest)');
  /* 小屋与出生点红线: 圈层重排一律不碰(老档的出生点/床边/站立位零悬空风险) */
  assert.deepStrictEqual(Core.ADV_HUT, {x1: 58, x2: 64, z1: 78, z2: 84}, '小屋坐标不动');
  assert.deepStrictEqual([Core.ADV_SPAWN.x, Core.ADV_SPAWN.y, Core.ADV_SPAWN.z], [61.5, 25, 76.5],
      '出生点坐标与压平 y24 不动');
});

test('T5 圈层断言: 四巢距小屋距离单调递增(近<中<远<黑巢, 风险-距离梯度)', () => {
  const cx = (Core.ADV_HUT.x1 + Core.ADV_HUT.x2) / 2;
  const cz = (Core.ADV_HUT.z1 + Core.ADV_HUT.z2) / 2;
  const ds = Core.ADV_NESTS.map((n) => Math.hypot(n.x - cx, n.z - cz));
  assert.ok(ds[0] < ds[1] && ds[1] < ds[2] && ds[2] < ds[3],
      '巢穴难度距小屋单调递增: ' + ds.map((d) => d.toFixed(1)).join(' < '));
  assert.ok(ds[0] >= 25 && ds[0] <= 45, '近巢落在资源圈 25~45: ' + ds[0].toFixed(1));
  assert.ok(ds[1] >= 40 && ds[1] <= 60, '中巢落在矿业圈 40~60: ' + ds[1].toFixed(1));
  assert.ok(ds[2] > 60, '远巢落在深险圈 >60: ' + ds[2].toFixed(1));
  assert.ok(ds[3] > 60, '黑巢落在深险圈 >60: ' + ds[3].toFixed(1));
});

test('T5 迁移形状: 新坐标的湖心/坑底/洞口/穴室逐格断言(对真生成世界)', () => {
  Core.advBuildWorld();
  assert.strictEqual(cell(36, 24, 58), api.B_WATER, '湖心 (36,58) 水面齐草地');
  assert.strictEqual(cell(36, 23, 58), 8, '湖心沙底');
  assert.strictEqual(cell(100, 22, 52), 0, '煤坑 (100,52) 中心被挖开(漏斗见底)');
  assert.strictEqual(cell(24, 22, 44), 0, '铁坑 (24,44) 中心被挖开');
  assert.strictEqual(cell(62, 28, 8), 2, '山洞口小丘 (62,8) 泥皮穹顶 h4');
  assert.strictEqual(cell(61, 23, 10), 0, '隧道北端 (61,23,10) 敞口(台阶起点)');
  assert.strictEqual(cell(61, 3, 30), 0, '穴室最深处 (61,3,30) 掏空');
  assert.strictEqual(cell(61, 1, 30), api.B_DIAMOND_ORE, '穴室底板保底钻石(任务第 15 步目的地)');
});

test('T5 高度场: 圈层幅度分环 — 核心圈(≤18)恒 0 · 深险圈(>60)丘体起伏 · 幅度界 ±3', () => {
  const cx = (Core.ADV_HUT.x1 + Core.ADV_HUT.x2) / 2;
  const cz = (Core.ADV_HUT.z1 + Core.ADV_HUT.z2) / 2;
  let lo = 1; let hi = -1;
  for (let x = 2; x < 126; x++) {
    for (let z = 2; z < 126; z++) {
      const h = Core.advHeightAt(x, z);
      assert.ok(h >= -3 && h <= 3, '幅度界 ±3: (' + x + ',' + z + ')=' + h);
      const d = Math.hypot(x - cx, z - cz);
      if (d <= 18) assert.strictEqual(h, 0, '家园核心圈恒 0(' + x + ',' + z + ')');
      if (d > 60) {
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
  }
  assert.ok(lo < 0 && hi > 0, '深险圈丘体有起有伏: [' + lo + ',' + hi + ']');
  assert.ok(hi - lo >= 3, '深险圈起伏到位(圈层越远丘越高): 跨度 ' + (hi - lo));
});

test('T5 高度场: 坡度红线 — 全图相邻格高差 ≤1(儿童可登可下, heightAt 结构保证建场侧不破坏)', () => {
  for (let x = 0; x < 127; x++) {
    for (let z = 0; z < 127; z++) {
      const h = Core.advHeightAt(x, z);
      assert.ok(Math.abs(Core.advHeightAt(x + 1, z) - h) <= 1, 'x 向相邻高差 ≤1: (' + x + ',' + z + ')');
      assert.ok(Math.abs(Core.advHeightAt(x, z + 1) - h) <= 1, 'z 向相邻高差 ≤1: (' + x + ',' + z + ')');
    }
  }
});

test('T5 高度场: 既有结构压平区归 0 — 小屋/湖盆/两坑口/山洞口/三巢丘足印(ADV_FLATS 对齐)', () => {
  const pts = [];
  const rect = (x1, z1, x2, z2) => {
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) pts.push([x, z]);
  };
  const circ = (cx, cz, r) => {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        if (Math.hypot(x - cx, z - cz) <= r) pts.push([x, z]);
      }
    }
  };
  const h = Core.ADV_HUT;
  rect(h.x1 - 2, h.z1 - 2, h.x2 + 2, h.z2 + 2); /* 小屋(含出生位外扩) */
  circ(Core.ADV_LAKE.cx, Core.ADV_LAKE.cz, Core.ADV_LAKE.r + 1); /* 湖盆 */
  for (const p of Core.ADV_PITS) circ(p.cx, p.cz, p.r + 1); /* 两坑口漏斗 */
  const c = Core.ADV_CAVE;
  rect(c.x1 - 3, c.zStart - 6, c.x2 + 3, c.zStart + 4); /* 山洞口小丘+敞廊 */
  for (const n of Core.ADV_NESTS) circ(n.x, n.z, 3); /* 三巢丘 */
  for (const [x, z] of pts) {
    assert.strictEqual(Core.advHeightAt(x, z), 0, '结构足印回落 y24: (' + x + ',' + z + ')');
  }
});

test('T5 地形接入: 地层随高度场 — 表面=24+advHeightAt 处草皮, 下 4 层泥再下石; 树随丘扎根不悬空', () => {
  Core.advBuildWorld();
  const surf = (x, z) => Core.ADV_GROUND + Core.advHeightAt(x, z);
  /* 深险圈采样列: 表面贴高度场, 层序随之 */
  for (const [x, z] of [[10, 10], [120, 120], [5, 80], [80, 5]]) {
    const sy = surf(x, z);
    assert.strictEqual(cell(x, sy, z), 1, '(' + x + ',' + z + ') 表面草皮贴高度场 y' + sy);
    assert.strictEqual(cell(x, sy - 1, z), 2, '(' + x + ',' + z + ') 表面下泥层');
    assert.strictEqual(cell(x, sy - 4, z), 2, '(' + x + ',' + z + ') 泥层共 4 层(sy-4 仍是泥)');
    assert.strictEqual(cell(x, sy - 5, z), 3, '(' + x + ',' + z + ') 泥层下石头');
  }
  /* 核心圈平地照旧 y24 草皮 */
  assert.strictEqual(cell(61, 24, 66), 1, '核心圈平地 (61,66) 表面仍 y24 草');
  /* 树贴地: 每棵树干脚下恰是本地草皮表面(丘上树不悬空、坑边树不埋干) */
  for (const s of Core.advTreeSpots()) {
    const sy = surf(s.x, s.z);
    assert.strictEqual(cell(s.x, sy, s.z), 1, '树脚下是草皮表面 (' + s.x + ',' + s.z + ')');
    assert.strictEqual(cell(s.x, sy + 1, s.z), 5, '树干基部贴表面');
  }
});

test('T5 门阵广场: 屋东 15×15 圆石满铺 + 三扇门位进常量(难度序, 门体归 T7)', () => {
  const p = Core.ADV_GATE_PLAZA;
  assert.deepStrictEqual([p.x1, p.x2, p.z1, p.z2], [78, 92, 74, 88],
      '屋东 x78-92 z74-88(§2.4 核心圈; 2026-10-27 用户拍板东移离小屋远点)');
  assert.strictEqual(p.gates.length, 3, '三扇门位(每图一扇)');
  const seen = new Set();
  for (const g of p.gates) {
    assert.ok(g.px >= p.x1 - 1 && g.px + 5 <= p.x2 + 1, '门框 6 宽(px..px+5)落广场含塔位余量: px=' + g.px);
    assert.ok(g.pz >= p.z1 && g.pz <= p.z2, '门面 z 行在广场内: pz=' + g.pz);
    seen.add(g.px + ',' + g.pz);
  }
  assert.strictEqual(seen.size, 3, '三门位互不重合');
  Core.advBuildWorld();
  for (let x = p.x1; x <= p.x2; x++) {
    for (let z = p.z1; z <= p.z2; z++) {
      assert.strictEqual(cell(x, 24, z), 4, '广场圆石满铺 (' + x + ',' + z + ')');
    }
  }
});

test('T5 初始农田: 屋南 4×3 耕地+熟麦 + 西缘水路(种子→小麦→面包教学第一环)', () => {
  const f = Core.ADV_FARM;
  assert.deepStrictEqual([f.x1, f.x2, f.z1, f.z2], [59, 62, 86, 88], '屋南 4×3');
  Core.advBuildWorld();
  for (let x = f.x1; x <= f.x2; x++) {
    for (let z = f.z1; z <= f.z2; z++) {
      assert.strictEqual(cell(x, 24, z), api.B_FARMLAND, '耕地 (' + x + ',' + z + ')');
      assert.strictEqual(cell(x, 25, z), api.B_WHEAT_3, '熟麦已长成 (' + x + ',' + z + ')');
    }
  }
  for (let z = f.z1; z <= f.z2; z++) {
    assert.strictEqual(cell(f.x1 - 1, 24, z), api.B_WATER, '西缘水路(从简) z=' + z);
  }
});

test('T5 畜牧围栏: 原木柱角+木板栏一圈 2 高 + 栏内草地 + 东侧踏石(孩子可越, 牲畜留场)', () => {
  const pen = Core.ADV_PEN;
  assert.deepStrictEqual([pen.x1, pen.x2, pen.z1, pen.z2], [40, 54, 74, 90], '屋西 x40-54 z74-90');
  Core.advBuildWorld();
  /* 四角原木柱(y25~26) */
  for (const [cx, cz] of [[pen.x1, pen.z1], [pen.x2, pen.z1], [pen.x1, pen.z2], [pen.x2, pen.z2]]) {
    assert.strictEqual(cell(cx, 25, cz), 5, '角柱原木 (' + cx + ',' + cz + ')');
    assert.strictEqual(cell(cx, 26, cz), 5, '角柱两高');
  }
  /* 栏线完整: 周界每格 y25/y26 都是实心栏(原木/木板), 台阶步进 ≤1.05 的牲畜翻不出 */
  for (let x = pen.x1; x <= pen.x2; x++) {
    for (const z of [pen.z1, pen.z2]) {
      const a = cell(x, 25, z); const b = cell(x, 26, z);
      assert.ok((a === 5 || a === 6) && (b === 5 || b === 6), '南北栏线实心 (' + x + ',' + z + ')');
    }
  }
  for (let z = pen.z1; z <= pen.z2; z++) {
    for (const x of [pen.x1, pen.x2]) {
      const a = cell(x, 25, z); const b = cell(x, 26, z);
      assert.ok((a === 5 || a === 6) && (b === 5 || b === 6), '东西栏线实心 (' + x + ',' + z + ')');
    }
  }
  assert.strictEqual(cell(47, 25, pen.z1), 6, '栏中段是木板(柱只在角)');
  /* 栏内地面留草 */
  assert.strictEqual(cell(47, 24, 82), 1, '栏内草地');
  assert.strictEqual(cell(47, 25, 82), 0, '栏内净空');
  /* 东侧踏石: 孩子两级翻越(地面→踏石→栏顶); 踏石到栏顶 block-y 差恰 1=
     牲畜(stepMove ≤1.05)也爬得上来——旧注释「仍差 2」算错, 动物侧由
     advHerdClamp 栏内钳制兜底(见下), 踏石保留给孩子 */
  assert.strictEqual(cell(pen.x2 + 1, 25, 82), 4, '踏石圆石在栏外东侧');
});

test('栏内钳制(2026-10-27 出栏修复): advHerdClamp 四边内缩 1.1 · 栏内不动 · 角上同收 · 散布环带不出带', () => {
  const p = Core.ADV_PEN;
  assert.deepStrictEqual(Core.advHerdClamp(47.5, 82.5), {x: 47.5, z: 82.5}, '栏内位置原样返回');
  assert.strictEqual(Core.advHerdClamp(40.2, 82).x, p.x1 + Core.ADV_HERD_PAD, '西出栏钳回西带');
  assert.strictEqual(Core.advHerdClamp(54.8, 82).x, p.x2 + 1 - Core.ADV_HERD_PAD, '东出栏(踏石侧)钳回东带');
  assert.strictEqual(Core.advHerdClamp(47, 73.5).z, p.z1 + Core.ADV_HERD_PAD, '北出栏钳回北带');
  assert.strictEqual(Core.advHerdClamp(47, 90.6).z, p.z2 + 1 - Core.ADV_HERD_PAD, '南出栏钳回南带');
  const corner = Core.advHerdClamp(39.9, 90.9);
  assert.strictEqual(corner.x, p.x1 + Core.ADV_HERD_PAD, '角上 x 同收');
  assert.strictEqual(corner.z, p.z2 + 1 - Core.ADV_HERD_PAD, '角上 z 同收');
  for (const e of Core.advLivestockPlan()) {/* 重生散布环带全部在钳制带内(进场无瞬移) */
    const k = Core.advHerdClamp(e.x, e.z);
    assert.ok(Math.abs(k.x - e.x) < 1e-9 && Math.abs(k.z - e.z) < 1e-9,
        '散布条目在带内: idx=' + e.idx);
  }
});

test('石阵夜晚彩蛋(2026-10-27): 灯坛命中坐标+id 双重 · 昼夜分支裁决 · 夜长昼短 · 首赠礼是注册物品', () => {
  const s = Core.ADV_STONES;
  assert.strictEqual(Core.advStoneAltarHit(s.cx, 26, s.cz, 19), true, '灯坛命中(坐标+灯块 id)');
  assert.strictEqual(Core.advStoneAltarHit(s.cx, 26, s.cz, api.B_GLOWSTONE), false, '同坐标非灯块 id 不触发');
  assert.strictEqual(Core.advStoneAltarHit(s.cx + 1, 26, s.cz, 19), false, '同 id 邻格不触发');
  assert.strictEqual(Core.advStoneAltarHit(s.cx, 25, s.cz, 19), false, '基座层不触发');
  assert.strictEqual(Core.advStoneEggPick(0, true), 'egg', '到窗+夜晚 → 全彩蛋');
  assert.strictEqual(Core.advStoneEggPick(0, false), 'hint', '到窗+白天 → 只提示');
  assert.strictEqual(Core.advStoneEggPick(2, true), null, '节流窗内 → 静默');
  assert.ok(Core.ADV_STONE_EGG_CD > Core.ADV_STONE_HINT_CD, '夜长昼短(彩蛋重播慢于提示)');
  assert.strictEqual(api.ITEMS[Core.ADV_STONE_EGG_GIFT].name, '灯笼', '首赠礼是注册物品(灯笼)');
});

test('T5 圆石小径: 门口↔广场↔农田 2 宽间断铺装((x+z) 偶数格), 五段连通', () => {
  assert.strictEqual(Core.ADV_PATH.length, 5, '五段走廊(核心圈三段 + 扩容延伸东/南两段)');
  Core.advBuildWorld();
  let paved = 0;
  for (const r of Core.ADV_PATH) {
    for (let x = r.x1; x <= r.x2; x++) {
      for (let z = r.z1; z <= r.z2; z++) {
        if ((x + z) % 2 === 0) {
          assert.strictEqual(cell(x, 24 + Core.advHeightAt(x, z), z), 4,
              '偶数格铺圆石贴本地表面 (' + x + ',' + z + ')');
          paved++;
        }
      }
    }
  }
  assert.ok(paved >= 20, '间断铺装有料: ' + paved + ' 格');
  /* 连通性: 门口段东端(x77)贴广场西缘(x78); 南下段(x65-66)接门口段(z77/78 相邻);
     西折段(x63)贴农田东缘(x62); 东段起于广场东缘(x93); 南段起于农田南缘(z89)
     ——取样取偶数格(奇数格是间断留白) */
  assert.strictEqual(cell(77, 24, 77), 4, '门口段东端接广场');
  assert.strictEqual(cell(66, 24, 78), 4, '南下段起于门口段南侧');
  assert.strictEqual(cell(63, 24, 87), 4, '西折段西端接农田');
  assert.strictEqual(cell(93, 24 + Core.advHeightAt(93, 75), 75), 4, '东段起于广场东缘(贴本地表面)');
  assert.strictEqual(cell(61, 24, 89), 4, '南段起于农田南缘');
});

test('T5 花丛草场: 蒲公英黄/雏菊白核心圈确定性散布(~2%), 贴草皮不占围栏/铺装', () => {
  Core.advBuildWorld();
  const c = {x: 61, z: 81};
  const m = Core.ADV_MEADOW;
  let n = 0; let meadowN = 0; const kinds = new Set();
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const id = cell(x, y, z);
        if (id !== api.B_FLOWER_Y && id !== api.B_FLOWER_W) continue;
        if (Math.hypot(x - m.cx, z - m.cz) <= m.r + 1) {
          meadowN++; /* 花田密铺区单算(扩容主题五件, 自己的验收在下一题) */
          continue;
        }
        n++;
        kinds.add(id);
        assert.ok(Math.hypot(x - c.x, z - c.z) <= 18, '花只长核心圈草场 (' + x + ',' + z + ')');
        assert.strictEqual(cell(x, y - 1, z), 1, '花脚下直接是草皮');
        assert.strictEqual(y, Core.ADV_GROUND + Core.advHeightAt(x, z) + 1, '花在本地表面上一层');
        assert.ok(!Core.advInRect(x, z, Core.ADV_PEN), '不占畜牧围栏');
      }
    }
  }
  assert.ok(n >= 6 && n <= 90, '密度 ~2% 可发现不铺满: ' + n + ' 丛');
  assert.strictEqual(kinds.size, 2, '黄白两款都有');
  assert.ok(meadowN >= 100, '花田密铺单算不混入核心圈口径(实测 ' + meadowN + ' 丛)');
});

test('T5 避让联动: 树/群位避新增建场件 — 广场/农田/围栏/小径无树, 群位避广场/农田/小径', () => {
  Core.advBuildWorld();
  for (const s of Core.advTreeSpots()) {
    assert.ok(!Core.advInRect(s.x, s.z, Core.ADV_GATE_PLAZA), '广场无树');
    assert.ok(!Core.advInRect(s.x, s.z, Core.ADV_FARM), '农田无树');
    assert.ok(!Core.advInRect(s.x, s.z, Core.ADV_PEN), '围栏无树');
    for (const r of Core.ADV_PATH) assert.ok(!Core.advInRect(s.x, s.z, r), '小径无树');
  }
  /* 群位约束谓词: 广场心/农田心/小径格全拒 */
  assert.strictEqual(Core.advLivestockHerdOk(85, 81, Core.advTreeSpots()), false, '广场心拒');
  assert.strictEqual(Core.advLivestockHerdOk(60, 87, Core.advTreeSpots()), false, '农田心拒');
  assert.strictEqual(Core.advLivestockHerdOk(65, 82, Core.advTreeSpots()), false, '小径格拒');
});

test('T5 畜牧群位进围栏: 两群位落栏内草地(四畜在场内), 显式坐标满足全部群位约束', () => {
  Core.advBuildWorld();
  const spots = Core.advLivestockSpots();
  assert.strictEqual(spots.length, 2, '两个群位');
  const pen = Core.ADV_PEN;
  const trees = Core.advTreeSpots();
  for (const s of spots) {
    assert.ok(s.x >= pen.x1 + 3 && s.x <= pen.x2 - 3 && s.z >= pen.z1 + 3 && s.z <= pen.z2 - 3,
        '群位在栏内且距墙 ≥3 (' + s.x + ',' + s.z + ')');
    assert.strictEqual(Core.advLivestockHerdOk(s.x, s.z, trees), true,
        '显式群位通过全部约束谓词(离出生 ≥15·避湖/坑/巢/洞/广场/农田/小径·避树)');
    assert.strictEqual(cell(s.x, 24, s.z), 1, '群位脚下栏内草地');
    assert.strictEqual(cell(s.x, 25, s.z), 0, '群位上方净空');
  }
  assert.ok(Math.hypot(spots[0].x - spots[1].x, spots[0].z - spots[1].z) >= Core.ADV_LIVESTOCK_HERD_R,
      '两群彼此 ≥10(不叠群)');
  const plan = Core.advLivestockPlan();
  assert.strictEqual(plan.length, 10, '2 群共 10 只(清单构成不回归)');
  for (const e of plan) {
    assert.ok(e.x > pen.x1 + 1 && e.x < pen.x2 + 1 && e.z > pen.z1 + 1 && e.z < pen.z2 + 1,
        '条目散布在栏内: (' + e.x.toFixed(1) + ',' + e.z.toFixed(1) + ')');
  }
});

test('T5 压平扩容: 广场/农田/围栏足印归 0(ADV_FLATS 与建场件对齐)', () => {
  const inR = (x, z, r, m) => x >= r.x1 - m && x <= r.x2 + m && z >= r.z1 - m && z <= r.z2 + m;
  const inC = (x, z, c, r) => Math.hypot(x - c.cx, z - c.cz) <= r;
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      if (inR(x, z, Core.ADV_GATE_PLAZA, 1) || inR(x, z, Core.ADV_FARM, 1) ||
          inR(x, z, Core.ADV_PEN, 0) ||
          inC(x, z, Core.ADV_TOWER, 5) || /* 望塔基座(含楼梯带, flats r9 内圈取样) */
          inC(x, z, Core.ADV_STONES, Core.ADV_STONES.r + 2) ||
          inC(x, z, Core.ADV_POND, Core.ADV_POND.r + 1)) {
        assert.strictEqual(Core.advHeightAt(x, z), 0, '新件足印回落 y24 (' + x + ',' + z + ')');
      }
    }
  }
  assert.strictEqual(Core.ADV_FLATS.length, 14,
      '压平清单与建场件一一对应(湖1+坑2+洞1+巢4+广场1+农田1+围栏1+望塔1+石阵1+南池1)');
});

test('扩容主题五件: 松林/望塔/石阵/花田/南池建场落位(确定性总装内的结构可读)', () => {
  Core.advBuildWorld();
  /* 南池: 洼心水+沙底, 池外一圈仍是草皮(压平区边缘回归草地) */
  const p = Core.ADV_POND;
  assert.strictEqual(cell(p.cx, 24, p.cz), api.B_WATER, '南池洼心水面 y24');
  assert.strictEqual(cell(p.cx, 23, p.cz), 8, '南池沙底');
  assert.strictEqual(cell(p.cx, 24, p.cz + p.r + 2), 1, '池外一圈草皮');
  /* 望塔: 基座/环墙/门洞/平台灯砖/宝箱/垛口 + 内旋楼梯逐级(7×7 外沿,
    2026-10-27 重构: 内旋梯收掉旧版「塔底死屋+外挂折返梯」的可发现性缺陷;
    2026-10-28 用户拍板: 楼梯改红蓝羊毛逐级交替——石梯在石砖墙里不显眼) */
  const t = Core.ADV_TOWER;
  assert.strictEqual(cell(t.x, 25, t.z), 4, '塔底基座圆石');
  assert.strictEqual(cell(t.x - 3, 29, t.z), 13, '塔身石砖环墙(7×7 外沿)');
  assert.strictEqual(cell(t.x, 26, t.z + 3), 0, '南门洞坎层净空');
  assert.strictEqual(cell(t.x, 27, t.z + 3), 0, '南门洞墙层净空');
  assert.strictEqual(cell(t.x, 28, t.z + 3), 13, '门洞上方石砖门楣(门高恰 2)');
  assert.strictEqual(cell(t.x, 33, t.z), api.B_GLOWSTONE, '平台心灯砖');
  assert.strictEqual(cell(t.x + 2, 34, t.z + 2), api.B_CHEST, '顶角宝箱(楼梯口对角)');
  assert.strictEqual(cell(t.x - 3, 34, t.z - 3), 4, '垛口满圈(防失足)');
  /* 内旋楼梯 8 级逐级: 内圈东南角起步沿东墙向北折西半圈, 每级恰 +1 且
    实心落地(列内 26..25+k 无空洞; 8 级柱顶由平台木板盖板同判);
    红蓝羊毛逐级交替(奇数级红 16/偶数级蓝 15, 整柱同色) */
  let spiral = 0;
  let alt = 0;
  for (let k = 1; k <= 8; k++) {
    const sx = k <= 5 ? t.x + 2 : t.x + 2 - (k - 5);
    const sz = k <= 5 ? t.z + 2 - (k - 1) : t.z - 2;
    let solid = 0;
    for (let y = 26; y <= 25 + k; y++) if (cell(sx, y, sz) !== 0) solid++;
    if (solid === k) spiral++;
    if (cell(sx, 26, sz) === (k % 2 ? 16 : 15)) alt++; /* 柱基即整柱色 */
  }
  assert.strictEqual(spiral, 8, '内旋楼梯 8 级逐级实心落地(实测=' + spiral + ')');
  assert.strictEqual(alt, 8, '红蓝羊毛逐级交替(16 红/15 蓝, 实测=' + alt + ')');
  assert.strictEqual(cell(t.x + 2, 26, t.z + 2), 16, '首级红羊毛贴门洞右前内角(进屋即见)');
  /* 楼梯口: 6~7 级格平台开天井(平台板会挡 32~33 脚位头顶净空),
    8 级柱顶由平台铺装原位盖板(无缝出梯), 5 级上方平台封闭(净空恰 2) */
  assert.strictEqual(cell(t.x + 1, 33, t.z - 2), 0, '楼梯口 6 级格开天井');
  assert.strictEqual(cell(t.x, 33, t.z - 2), 0, '楼梯口 7 级格开天井');
  assert.strictEqual(cell(t.x - 1, 33, t.z - 2), 6, '8 级柱顶平台盖板(无缝出梯)');
  assert.strictEqual(cell(t.x + 2, 33, t.z - 2), 6, '5 级上方平台封闭(净空恰 2)');
  /* 石阵: 8 柱环(苔石) + 中心基座灯块 */
  const s = Core.ADV_STONES;
  assert.strictEqual(cell(s.cx, 25, s.cz), 14, '石阵中心基座苔石');
  assert.strictEqual(cell(s.cx, 26, s.cz), 19, '石阵中心灯块');
  let pillars = 0;
  for (let x = s.cx - s.r - 1; x <= s.cx + s.r + 1; x++) {
    for (let z = s.cz - s.r - 1; z <= s.cz + s.r + 1; z++) {
      if (cell(x, 25, z) === 14 && Math.round(Math.hypot(x - s.cx, z - s.cz)) === s.r) pillars++;
    }
  }
  assert.strictEqual(pillars, s.n, '列柱数 = n(环上等分)');
  /* 松林: 圈内松干成规模(干基贴草皮), 橡树落位清单不进圈 */
  let pines = 0;
  for (let x = Core.ADV_PINE.cx - Core.ADV_PINE.r; x <= Core.ADV_PINE.cx + Core.ADV_PINE.r; x++) {
    for (let z = Core.ADV_PINE.cz - Core.ADV_PINE.r; z <= Core.ADV_PINE.cz + Core.ADV_PINE.r; z++) {
      if (Math.hypot(x - Core.ADV_PINE.cx, z - Core.ADV_PINE.cz) > Core.ADV_PINE.r) continue;
      for (let y = 21; y <= 29; y++) {/* 干基随高度场 21~28 浮动(深险圈丘/谷), 逐列扫窗 */
        if (cell(x, y, z) === 5 && cell(x, y - 1, z) === 1) {
          pines++;
          break;
        }
      }
    }
  }
  assert.ok(pines >= 12, '松林规模(实测 ' + pines + '/' + Core.ADV_PINE.n + ')');
  for (const sp of Core.advTreeSpots()) {
    assert.ok(Math.hypot(sp.x - Core.ADV_PINE.cx, sp.z - Core.ADV_PINE.cz) > Core.ADV_PINE.r,
        '橡树不进松林圈 (' + sp.x + ',' + sp.z + ')');
  }
  /* 花田: 密铺花海(>100 丛, 核心圈散布密度的 20 倍以上), 脚下草皮 */
  let meadow = 0;
  for (let x = Core.ADV_MEADOW.cx - Core.ADV_MEADOW.r - 1;
    x <= Core.ADV_MEADOW.cx + Core.ADV_MEADOW.r + 1; x++) {
    for (let z = Core.ADV_MEADOW.cz - Core.ADV_MEADOW.r - 1;
      z <= Core.ADV_MEADOW.cz + Core.ADV_MEADOW.r + 1; z++) {
      if (Math.hypot(x - Core.ADV_MEADOW.cx, z - Core.ADV_MEADOW.cz) > Core.ADV_MEADOW.r + 1) continue;
      for (let y = 24; y <= 29; y++) {
        const id = cell(x, y, z);
        if ((id === api.B_FLOWER_Y || id === api.B_FLOWER_W) && cell(x, y - 1, z) === 1) meadow++;
      }
    }
  }
  assert.ok(meadow >= 100, '花田密铺规模(实测 ' + meadow + ' 丛)');
});

/* ============ 政策纯函数段(逐条钉口径) ============ */

test('核心政策: 死亡计划 — 满血+回出生点+背包保留(零惩罚)', () => {
  const plan = Core.advDeathPlan({hp: 2, maxHp: 30}, Core.ADV_SPAWN);
  assert.deepStrictEqual(plan,
      {hp: 30, x: Core.ADV_SPAWN.x, y: Core.ADV_SPAWN.y, z: Core.ADV_SPAWN.z, yaw: Core.ADV_SPAWN.yaw,
        keepInv: true});
});

test('核心政策: 巢穴节拍/刷怪数/挥击伤害/怪物伤害封顶/掉落清单/播报文案', () => {
  assert.strictEqual(Core.advNestCount(() => 0), Core.ADV_NEST_MIN, '数量下限');
  assert.strictEqual(Core.advNestCount(() => 0.999), Core.ADV_NEST_MAX, '数量上限');
  assert.strictEqual(Core.advNestStep(1, 59, 1).t, 0, '有活怪计时归零');
  assert.strictEqual(Core.advNestStep(0, 59.9, 0.05).spawn, false, '60s 内不刷');
  assert.strictEqual(Core.advNestStep(0, 59.9, 0.2).spawn, true, '到 60s 发刷怪令');
  assert.strictEqual(Core.advSwingDmg('sword_wood'), 7, '木剑 7(D9)');
  assert.strictEqual(Core.advSwingDmg(''), Core.ADV_FIST_DMG, '空手 3');
  assert.strictEqual(Core.advMobDmg({cfg: {dmg: 33}}), Core.ADV_DMG_CAP, '苦力怕 33 封顶 10');
  const drops = Core.advDeathDrops({type: 'zombie', pos: {x: 1, y: 25, z: 2}}, () => 0.5);
  assert.deepStrictEqual(drops, [{id: 'rotten_flesh', n: 1, x: 1, y: 25.8, z: 2}], '保底腐肉, 落点 y+0.8');
  assert.strictEqual(Core.advPickupText(new Map([['coal', 2], ['bone', 1]])),
      '捡到 2 个煤炭、1 个骨头！', '合并播报(进账序)');
});

test('核心政策: 蓄力步进/放置合法性/食物/树苗计时', () => {
  const bt = {time: 1, drops: true};
  let m = Core.advMineStep({t: 0, key: '', need: 0, drops: true}, '5,24,5', bt, 0.4);
  assert.strictEqual(m.t, 0.4, '首帧累计');
  m = Core.advMineStep(m, '5,24,5', bt, 0.7);
  assert.strictEqual(m.done, true, '累计到点');
  assert.strictEqual(m.t, 1, 't 钳在 need');
  assert.strictEqual(Core.advMineStep(m, '9,24,9', {time: 2, drops: false}, 0.3).t, 0.3, '换目标清零');
  assert.strictEqual(Core.advMineStep(m, '', bt, 0.3).t, 0, '指空清零');
  assert.strictEqual(Core.advPlaceCheck({x: 5, y: 24, z: 5, nx: 0, ny: 1, nz: 0}, 2, 1, 0).ok, true,
      '实心块贴顶面 ok');
  assert.strictEqual(Core.advPlaceCheck({x: 5, y: 24, z: 5, nx: 1, ny: 0, nz: 0}, api.B_TORCH, 1, 0).ok,
      true, '墙火把: wall 薄块贴实心侧面 ok');
  assert.deepStrictEqual(Core.advEatPolicy(28, 30, 4), {hp: 30, healed: 2, canEat: true}, '回复钳制');
  assert.strictEqual(Core.advEatPolicy(30, 30, 4).canEat, false, '满血不吃');
  const map = new Map([['1,25,1', {x: 1, y: 25, z: 1, left: 0.5}], ['2,25,2', {x: 2, y: 25, z: 2, left: 3}]]);
  assert.strictEqual(Core.advSapDue(map, 1).length, 1, '到期出清单');
  assert.ok(!map.has('1,25,1') && map.has('2,25,2'), '到期移出, 未到期留队');
});

test('F3 金苹果食物政策: advEatPolicy full 旗标 — 半血吃直接回满, 满血不吃口径不回归(二期设计稿 §3)', () => {
  /* full 语义收进政策纯函数: 设计稿原写在模式层 advTryEat 解读, 收编后
     消费方只吃结果(seam 级偏差, 见 F3 报告; 食物回血政策已有本单测先例) */
  assert.deepStrictEqual(Core.advEatPolicy(12, 30, 30, true), {hp: 30, healed: 18, canEat: true},
      'full → hp 直接 maxHp(无饥饿系统: MC 饥饿+吸收+再生折算一次回满)');
  assert.deepStrictEqual(Core.advEatPolicy(10, 30, 4, true), {hp: 30, healed: 20, canEat: true},
      'food 名义值被 full 覆盖: 缺口 20>food 4 也回满(与不加旗标的 14 区分)');
  assert.strictEqual(Core.advEatPolicy(30, 30, 30, true).canEat, false, '满血不吃(旗标不破既有口径)');
  assert.strictEqual(Core.advEatPolicy(30, 30, 30, true).healed, 0, '满血 healed=0');
  /* 无旗标(缺省)走既有口径 — 三参调用方零改动 */
  assert.deepStrictEqual(Core.advEatPolicy(28, 30, 4), {hp: 30, healed: 2, canEat: true});
  assert.deepStrictEqual(Core.advEatPolicy(10, 30, 4), {hp: 14, healed: 4, canEat: true});
});

test('核心政策: 站点判定/TNT 掷骰与衰减', () => {
  const sts = [{x: 10, y: 25, z: 10, id: api.B_CRAFT}];
  assert.strictEqual(Core.advNearStation(sts, 14.5, 10.5, 4, api.B_CRAFT), true, '恰 4 格解锁(含等号)');
  assert.strictEqual(Core.advNearStation(sts, 14.6, 10.5, 4, api.B_CRAFT), false, '4.1 格不解锁');
  /* 烧炼单步 smeltStep/退炉 furnaceRefund 已迁 craft-core, 直测随迁
     test/craft-core.test.js(节拍常量 SMELT_T 同批迁入) */
  assert.strictEqual(Core.advTntRoll(3, () => 0.69).length, 1, '中签掉落');
  assert.strictEqual(Core.advTntRoll(3, () => 0.7).length, 0, '恰 0.7 不中签');
  assert.strictEqual(Core.advTntDmg(0), Core.ADV_TNT_DMG_HI, '爆心 30');
  assert.strictEqual(Core.advTntDmg(9), Core.ADV_TNT_DMG_LO, '越界钳边缘 12');
});

test('站点隔墙修复(2026-10-28): advLosBlocked 段采样 + advNearStation losOk 视线缝', () => {
  /* 假世界: Map 邻接表, read/opaque 全注入(纯函数零全局); 测试口径=非空即墙 */
  const mk = (walls) => {
    const m = new Map(walls.map(([x, y, z]) => [x + ',' + y + ',' + z, 1]));
    return {
      read: (x, y, z) => m.get(x + ',' + y + ',' + z) || 0,
      opaque: (id) => id !== 0,
    };
  };
  const w = mk([]);
  assert.strictEqual(Core.advLosBlocked(w.read, w.opaque, 0.5, 10.5, 0.5, 4.5, 10.5, 0.5), false,
      '空旷通视: 中间无格不算墙');
  const wWall = mk([[2, 10, 0]]);
  assert.strictEqual(Core.advLosBlocked(wWall.read, wWall.opaque,
      0.5, 10.5, 0.5, 4.5, 10.5, 0.5), true, '中间一堵实心墙: 隔墙不可用');
  const wDiag = mk([[2, 10, 2]]);
  assert.strictEqual(Core.advLosBlocked(wDiag.read, wDiag.opaque,
      0.5, 10.5, 0.5, 3.5, 10.5, 3.5), true, '斜向穿墙同样拦下(采样步长 0.25 不漏对角)');
  const wEnds = mk([[0, 10, 0], [4, 10, 0]]);
  assert.strictEqual(Core.advLosBlocked(wEnds.read, wEnds.opaque,
      0.5, 10.5, 0.5, 4.5, 10.5, 0.5), false,
  '两端点格跳过: 站点实心不挡自己, 人眼格不挡人');
  /* 真判据抽查: isOpaque(玻璃板/开门不挡, 关门挡)——「看得见即可用」与光照挡光同源 */
  assert.strictEqual(api.isOpaque(api.B_DOOR), true, '关门=实心挡');
  assert.strictEqual(api.isOpaque(api.B_DOOR_OPEN), false, '开门=可穿行不挡');
  assert.strictEqual(api.isOpaque(api.B_GLASS_PANE), false, '玻璃板=透明不挡');
  assert.strictEqual(Core.advLosBlocked(
      (x, y, z) => (x === 2 && y === 10 && z === 0) ? api.B_GLASS_PANE : 0,
      api.isOpaque, 0.5, 10.5, 0.5, 4.5, 10.5, 0.5), false,
  '隔窗(玻璃板)可用的完整链: read 真 id + isOpaque 真判据');
  /* advNearStation losOk 缝: 距离命中后逐站点问视线, 不命中继续找下一个 */
  const near = {x: 10, y: 25, z: 10, id: api.B_CRAFT};
  const far = {x: 10, y: 25, z: 13, id: api.B_CRAFT};
  assert.strictEqual(Core.advNearStation([near, far], 10.5, 10.5, 4, api.B_CRAFT,
      (st) => st !== near), true, '被挡站点不算数: 继续找下一个通视站点');
  assert.strictEqual(Core.advNearStation([near], 10.5, 10.5, 4, api.B_CRAFT, () => false), false,
      '全部被挡: 不解锁');
  assert.strictEqual(Core.advNearStation([near], 10.5, 10.5, 4, api.B_CRAFT), true,
      '不传 losOk=既有纯距离口径(缺省零变化)');
});

test('核心任务表: 16 条主线形状齐 + 谓词口径抽样(全量逐条在 adventure-mode.test.js)', () => {
  assert.strictEqual(Core.ADV_QUESTS[15].finale, true, '第 16 条是终章(远征章追加其后, 老档 step 不回退)');
  Core.ADV_QUESTS.forEach((q, i) => {
    assert.ok(q.id && q.icon && q.goal && q.hint && q.praise, '步 ' + i + ' 文案五件套');
    assert.strictEqual(typeof q.prog, 'function', '步 ' + i + ' prog 谓词');
    assert.strictEqual(typeof q.check, 'function', '步 ' + i + ' check 谓词');
  });
  assert.strictEqual(Core.ADV_QUESTS[0].check({collect_log: 5}), true, '步1 最低满足(v2 提到 5 根: 箱子步的原木预算)');
  assert.strictEqual(Core.ADV_QUESTS[0].check({collect_log: 4}), false, '步1 差一不满足');
  assert.strictEqual(Core.ADV_QUESTS[3].id, 'q4_chest', '步4 = 箱子步(工作台后, 用户拍板)');
  assert.strictEqual(Core.ADV_QUESTS[3].check({craft_chest: 1, place_chest: 1, open_chest: 1}), true,
      '箱子步三条件齐: 合成+放置+打开');
  assert.strictEqual(Core.ADV_QUESTS[3].check({craft_chest: 1, place_chest: 1}), false,
      '箱子步只合成放置没打开: 不满足(收纳闭环要教到交互)');
  assert.strictEqual(Core.ADV_QUESTS[4].id, 'q5_sapling', '步5 = 种树苗步(生态闭环)');
  assert.strictEqual(Core.ADV_QUESTS[13].id, 'q14_fight', '步14 = 战斗教学步(铁镐后钻石前)');
  assert.strictEqual(Core.ADV_MINE_TALLY[3], 'mine_cobble', '石头也计圆石(步7 口径)');
});

test('远征章(T8): 追加在终章之后 — 11 条(引导 1 + 每图 3 + 巢穴宝箱 1), 前 16 条序不变(老档 step 不回退)', () => {
  assert.strictEqual(Core.ADV_QUESTS.length, 27, '主线 16 + 远征章 11(den-nest D12 追加巢穴宝箱条)');
  assert.strictEqual(Core.ADV_QUESTS[16].id, 'q16_plaza', '第 17 条 = home 门阵广场引导(远征章首条)');
  assert.strictEqual(Core.ADV_QUESTS[16].unlock, 'desert', '广场引导完成点亮沙漠门(线性链第一环)');
  assert.strictEqual(Core.ADV_QUESTS[19].id, 'q19_temple', '第 20 条 = 沙漠神殿宝箱(远征章链尾)');
  assert.strictEqual(Core.ADV_QUESTS[19].unlock, 'snow', '神殿宝箱完成点亮雪原门(线性链第二环)');
  assert.strictEqual(Core.ADV_QUESTS[22].id, 'q22_igloo', '第 23 条 = 雪屋宝箱(雪原链尾)');
  assert.strictEqual(Core.ADV_QUESTS[22].unlock, 'swamp', '雪屋宝箱完成点亮沼泽门(线性链第三环)');
  assert.strictEqual(Core.ADV_QUESTS[25].id, 'q25_witch_chest', '第 26 条 = 女巫小屋宝箱(沼泽链尾, 无 unlock)');
  assert.strictEqual(Core.ADV_QUESTS[26].id, 'q26_den_chest', '末条 = 巢穴副本宝箱(den-nest D12, 自由探险目标)');
  /* unlock 只许挂在三环链尾: 别处冒出 unlock 会破坏「一任务一点亮」的仪式稀缺感 */
  const unlocks = Core.ADV_QUESTS.filter((q) => q.unlock).map((q) => q.id + '→' + q.unlock);
  assert.deepStrictEqual(unlocks, ['q16_plaza→desert', 'q19_temple→snow', 'q22_igloo→swamp'],
      '解锁绑定恰三环: home→desert→snow→swamp 线性(设计稿 §2.3)');
  /* 解锁链反查(锁门话术与点亮仪式共用): 目标图 → 挂 unlock 的那条任务 */
  assert.strictEqual(Core.advUnlockQuest('desert').id, 'q16_plaza', '反查: 沙漠门 ← 广场引导');
  assert.strictEqual(Core.advUnlockQuest('snow').id, 'q19_temple', '反查: 雪原门 ← 神殿宝箱');
  assert.strictEqual(Core.advUnlockQuest('swamp').id, 'q22_igloo', '反查: 沼泽门 ← 雪屋宝箱');
  assert.strictEqual(Core.advUnlockQuest('home'), null, 'home 恒开无解锁任务');
  assert.strictEqual(Core.advUnlockQuest('nonsense'), null, '未知图返 null 不炸');
});

test('远征章(T8): 谓词口径 — 发现型 visit_ / 收集型 mine_cactus / 探宝型 chest_ / 投掷型 throw_ / 击杀型 kill_', () => {
  const q17 = Core.ADV_QUESTS[17];
  assert.strictEqual(q17.check({visit_desert: 1}), true, '到达记账 1 次即完成(发现型轻谓词)');
  assert.strictEqual(q17.check({}), false, '未到达不完成');
  assert.strictEqual(Core.ADV_QUESTS[18].check({mine_cactus: 3}), true, '挖满 3 根仙人掌');
  assert.strictEqual(Core.ADV_QUESTS[18].check({mine_cactus: 2}), false, '差一根不满足');
  assert.strictEqual(Core.ADV_QUESTS[19].check({chest_temple: 1}), true, '神殿宝箱开箱记账(结构键, 玩家自放箱不算)');
  assert.strictEqual(Core.ADV_QUESTS[21].check({throw_snowball: 5}), true, '雪球掷出 5 颗(投掷记账)');
  assert.strictEqual(Core.ADV_QUESTS[21].check({throw_snowball: 4}), false, '差一颗不满足');
  assert.strictEqual(Core.ADV_QUESTS[22].check({chest_igloo: 1}), true, '雪屋宝箱开箱记账');
  assert.strictEqual(Core.ADV_QUESTS[24].check({kill_bogged: 2}), true, '打跑 2 只沼骸(按怪种击杀记账)');
  assert.strictEqual(Core.ADV_QUESTS[24].check({kill_mob: 5}), false, '杀别的不算沼骸步(按怪种分账)');
  assert.strictEqual(Core.ADV_QUESTS[25].check({chest_witch: 1}), true, '女巫小屋宝箱开箱记账');
  assert.strictEqual(Core.ADV_MINE_TALLY[B_CACTUS], 'mine_cactus', '仙人掌挖掘挂 mine_cactus 键(ADV_MINE_TALLY 既有通道)');
});


/* ============ 大宝箱政策(引导链 v2 纯函数段) ============ */

test('大宝箱阶梯: 9→18(8 圆石)→27(4 铁锭), 顶格 null, 材料取任务链产物', () => {
  assert.strictEqual(Core.ADV_CHEST_START, 9, '初始 9 格');
  assert.strictEqual(Core.ADV_CHEST_SLOTS, 27, '顶格 27 格(与背包同宽)');
  assert.deepStrictEqual(Core.advChestNext(9), {size: 18, cost: {cobble: 8}}, '第一档 8 圆石(第 7 步挖圆石即凑齐)');
  assert.deepStrictEqual(Core.advChestNext(18), {size: 27, cost: {iron_ingot: 4}}, '第二档 4 铁锭(第 12 步烧铁)');
  assert.strictEqual(Core.advChestNext(27), null, '顶格后无下一档');
  assert.strictEqual(Core.advChestNext(5).size, 18, '异常低档也指向第一档');
});

test('大宝箱两轨容量(ADR 0007): advChestCapacity 基础+每箱 9 · advCountChestEdits 跨桶数账本 B_CHEST', () => {
  assert.strictEqual(Core.ADV_CHEST_PER, 9, '每箱加 9 格');
  assert.strictEqual(Core.advChestCapacity(9, 0), 9, '没放箱子=基础档');
  assert.strictEqual(Core.advChestCapacity(9, 3), 36, '三箱 9+27=36(不设上限)');
  assert.strictEqual(Core.advChestCapacity(27, 5), 72, '顶格基础+五箱=72');
  assert.strictEqual(Core.advChestCapacity(9, -2), 9, '负数箱子数兜底 0(坏档不倒扣)');
  /* 账本计数: 只数值 === B_CHEST 的条目; 空气(0)/流体对象 {id,lv}/其他方块不计 */
  const buckets = {
    home: new Map([['1,24,1', B_CHEST], ['1,24,2', 0], ['1,24,3', {id: B_CHEST, lv: 0}], ['1,24,4', B_CHEST]]),
    desert: new Map([['2,24,2', B_CHEST]]),
    snow: new Map(),
    swamp: new Map([['3,24,3', 1]]),
    nether: new Map([['4,10,4', B_CHEST]]),
  };
  assert.strictEqual(Core.advCountChestEdits(buckets), 4, '跨桶求和(home 2+desert 1+nether 1); 流体对象形状不误中');
});

test('advChestPut: 并堆优先→空位→余量; 只认前 size 格; 工具连耐久整槽搬', () => {
  const mk = (size, slots) => ({size, slots: slots.slice()});
  /* 并堆: 已有 60 圆石, 再进 10 → 并满 64, 余 6 落空位 */
  let ch = mk(9, [{id: 'cobble', n: 60}, null, null]);
  let left = Core.advChestPut(ch, {id: 'cobble', n: 10});
  assert.strictEqual(left, 0, '全部收下');
  assert.strictEqual(ch.slots[0].n, 64, '并堆到 64 上限');
  assert.strictEqual(ch.slots[1].n, 6, '溢出 6 落首个空位');
  /* 档位上限: size=9 时第 10 格(下标 9)不可见也不可入 */
  ch = mk(9, Array(27).fill(null));
  ch.slots[9] = {id: 'cobble', n: 64}; /* 异常档直塞(防 expand 前可见) */
  left = Core.advChestPut(ch, {id: 'cobble', n: 70});
  assert.strictEqual(ch.slots[9].n, 64, '越档格(≥size)不被并堆');
  /* 满箱: 9 格各 64 圆石, 再进一件余量=1 */
  ch = mk(9, Array(9).fill({id: 'cobble', n: 64}));
  left = Core.advChestPut(ch, {id: 'cobble', n: 1});
  assert.strictEqual(left, 1, '满箱整批拒收返回余量(只拒不惩罚)');
  /* 工具: n=1 连 dur 原样搬, 不重铸满耐久 */
  ch = mk(9, Array(27).fill(null));
  left = Core.advChestPut(ch, {id: 'pick_iron', n: 1, dur: 200});
  assert.strictEqual(left, 0, '工具入箱成功');
  assert.deepStrictEqual(ch.slots[0], {id: 'pick_iron', n: 1, dur: 200}, '耐久 200 原样保留');
  /* 未注册物品整批拒收(stackMax=0 → mv=0, 余量原数) */
  left = Core.advChestPut(mk(9, []), {id: 'not_a_thing', n: 3});
  assert.strictEqual(left, 3, '未注册整批拒收');
});

/* ============ 提醒政策(S4 纯函数段) ============ */

test('S4① 低耐久预警纯函数: 首次 <0.25 提醒一次, 同命不重复, 重置后再提醒', () => {
  const warned = new Set();
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 1), false, '满耐久不提醒');
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 0.25), false, '恰 0.25 不提醒(严小于)');
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 0.249), true, '首次跌破 0.25 提醒');
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 0.1), false, '同命第二次不唠叨');
  assert.strictEqual(Core.advWearWarn(warned, 'axe_stone', 0.1), true, '别的工具各管各账');
  warned.delete('pick_wood'); /* 破板/消失重置(壳在破板分支 delete) */
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 0.2), true, '重置后(再做一把)再预警');
});

test('S4② 背包快满纯函数: ≥24/27 触发一次, 回落重新武装, 持续满格不重复', () => {
  let r = Core.advBagFullStep(23, true);
  assert.deepStrictEqual(r, {armed: true, fire: false}, '23 格未到线: 保持武装');
  r = Core.advBagFullStep(24, true);
  assert.deepStrictEqual(r, {armed: false, fire: true}, '到 24/27: 开火并缴械');
  r = Core.advBagFullStep(27, r.armed);
  assert.deepStrictEqual(r, {armed: false, fire: false}, '持续满格不重复轰炸');
  r = Core.advBagFullStep(20, r.armed);
  assert.deepStrictEqual(r, {armed: true, fire: false}, '回落(整理/合成腾格子): 重新武装');
  r = Core.advBagFullStep(24, r.armed);
  assert.deepStrictEqual(r, {armed: false, fire: true}, '再满再提醒(回落再满的上升沿口径)');
});

test('S4③ 工具坏话术纯函数: 安抚句 + 任务步 hint 并句(无 hint 不拼)', () => {
  const txt = Core.advBreakToolText('木镐', '打开背包，用原木合成木板吧！');
  assert.ok(txt.indexOf('不哭') >= 0 && txt.indexOf('木镐') >= 0, '安抚句含工具名');
  assert.ok(txt.indexOf('接下来：打开背包') >= 0, '并句当前任务步 hint');
  const done = Core.advBreakToolText('木镐', null);
  assert.ok(done.indexOf('接下来') < 0, '任务全部完成(hint 空)不拼引导');
});

/* ============ F1 每炉独立 + 持久化(furnace-plan 拍板①) ============ */

test('F1 炉状态纯函数: advFurnaceValid — 五元组形状校验, 非法整条拒收(decode 防错)', () => {
  assert.strictEqual(Core.advFurnaceValid(null), false, 'null 拒收');
  assert.strictEqual(Core.advFurnaceValid({}), false, '缺字段拒收');
  assert.strictEqual(Core.advFurnaceValid({input: null, fuel: null, out: null, heat: 0, prog: 0}),
      true, '空炉合法');
  assert.strictEqual(Core.advFurnaceValid(
      {input: {id: 'iron_ore', n: 3}, fuel: {id: 'coal', n: 1}, out: {id: 'iron_ingot', n: 2}, heat: 5, prog: 1.2}),
  true, '满炉合法');
  assert.strictEqual(Core.advFurnaceValid(
      {input: {id: 'nope_item', n: 1}, fuel: null, out: null, heat: 0, prog: 0}),
  false, '未注册物品拒收(交叉校验归 ITEMS)');
  assert.strictEqual(Core.advFurnaceValid(
      {input: {id: 'iron_ore', n: 0}, fuel: null, out: null, heat: 0, prog: 0}),
  false, '零数量槽拒收');
  assert.strictEqual(Core.advFurnaceValid({input: null, fuel: null, out: null, heat: -1, prog: 0}),
      false, '负热值拒收');
  assert.strictEqual(Core.advFurnaceValid({input: null, fuel: null, out: null, heat: 0, prog: 3}),
      false, '进度越界拒收(钳制界 SMELT_T——常量在 craft-core, 经全局名消费)');
  assert.strictEqual(Core.advFurnaceValid({input: 'iron_ore', fuel: null, out: null, heat: 0, prog: 0}),
      false, '槽形状必须是对象拒收');
});

test('F1 炉状态纯函数: advFurnaceClean — 空炉条目清扫(三槽全空且无余热), 有料条目保留', () => {
  const m = new Map([
    ['1,25,1', {input: null, fuel: null, out: null, heat: 0, prog: 0}], /* 空炉 → 清 */
    ['2,25,2', {input: {id: 'iron_ore', n: 2}, fuel: null, out: null, heat: 0, prog: 0}], /* 有料 → 留 */
    ['3,25,3', {input: null, fuel: {id: 'coal', n: 1}, out: null, heat: 0, prog: 0}], /* 有燃料 → 留 */
    ['4,25,4', {input: null, fuel: null, out: null, heat: 3, prog: 0}], /* 有余热 → 留(下批料免烧) */
    ['5,25,5', {input: null, fuel: null, out: {id: 'glass', n: 1}, heat: 0, prog: 0}], /* 有产物 → 留 */
  ]);
  const kept = Core.advFurnaceClean(m);
  assert.deepStrictEqual(kept.map(([k]) => k), ['2,25,2', '3,25,3', '4,25,4', '5,25,5'],
      '只清空炉, 存档不膨胀');
  assert.strictEqual(Core.advFurnaceClean(new Map()).length, 0, '空 Map 照跑');
});

/* ============ F4 牧场(二期设计稿 §4.4/§4.3): 散布清单 + 恐惧游荡决策 ============ */

test('F4 advLivestockPlan: 确定性 — 同种子同清单, 玩家改动不漂移(零世界读)', () => {
  Core.advBuildWorld();
  const a = Core.advLivestockPlan();
  assert.strictEqual(a.length, 10, '2 群共 10 只');
  assert.deepStrictEqual(Core.advLivestockPlan(), a, '两次生成逐字段一致(SceneKit.rand 同种子口径)');
  /* 挖掉群位草皮/放块: 清单不变(重进完全复现的前提——清单不读世界现状) */
  api.setBlockRaw(Math.floor(a[0].x), Core.ADV_GROUND, Math.floor(a[0].z), 0);
  api.setBlockRaw(Math.floor(a[5].x), Core.ADV_GROUND, Math.floor(a[5].z), 3);
  assert.deepStrictEqual(Core.advLivestockPlan(), a, '世界被玩家改动后清单原样');
});

test('F4 advLivestockSpots/Plan: 群位约束成立 — 离出生 ≥15 · 避湖/避坑/避巢 · 平地草地 · 两群 ≥10 · 10 只构成', () => {
  Core.advBuildWorld(); /* 对真生成世界断言(清单本身不读世界) */
  const spots = Core.advLivestockSpots();
  assert.strictEqual(spots.length, 2, '两个群位');
  const spawn = Core.ADV_SPAWN;
  const lake = Core.ADV_LAKE;
  for (const s of spots) {
    assert.ok(Math.hypot(s.x - spawn.x, s.z - spawn.z) >= Core.ADV_LIVESTOCK_SPAWN_R,
        '群位离出生点 ≥15: ' + Math.hypot(s.x - spawn.x, s.z - spawn.z).toFixed(1));
    assert.ok(Math.hypot(s.x - lake.cx, s.z - lake.cz) > lake.r + 4, '避湖(含外扩裕量)');
    for (const p of Core.ADV_PITS) {
      assert.ok(Math.hypot(s.x - p.cx, s.z - p.cz) > p.r + 4, '避矿坑漏斗');
    }
    for (const n of Core.ADV_NESTS) {
      assert.ok(Math.hypot(s.x - n.x, s.z - n.z) >= 6, '避巢穴(怪物窝边不放牧场)');
    }
    /* 平地贴地: 群位脚下是整块草地且上方净空(基础草原面在禁区外天然平坦) */
    assert.strictEqual(api.getBlock(s.x, Core.ADV_GROUND, s.z), 1, '脚下是草地');
    assert.strictEqual(api.getBlock(s.x, Core.ADV_GROUND + 1, s.z), 0, '上方净空(不撞树干)');
  }
  assert.ok(Math.hypot(spots[0].x - spots[1].x, spots[0].z - spots[1].z) >= Core.ADV_LIVESTOCK_HERD_R,
      '两群彼此 ≥10 格(不叠群)');
  /* 清单构成: idx 0..9 稳定 · 群 A 牛2羊2 + 群 B 猪3鸡3 · 条目在群位环带内贴地 */
  const plan = Core.advLivestockPlan();
  assert.deepStrictEqual(plan.map((e) => e.idx), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], '索引稳定(死畜账的对账键)');
  const byType = {};
  for (const e of plan) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    const near = spots.find((s) => Math.hypot(e.x - s.x - 0.5, e.z - s.z - 0.5) <= Core.ADV_LIVESTOCK_RING_HI + 1e-9);
    assert.ok(near, '条目落在某群位环带内: ' + e.type);
    assert.strictEqual(e.y, Core.ADV_GROUND + 1, '贴地锚点 y=地表+1');
    assert.strictEqual(api.getBlock(Math.floor(e.x), Core.ADV_GROUND, Math.floor(e.z)), 1,
        '条目脚下是草地(平地贴地)');
    assert.strictEqual(api.getBlock(Math.floor(e.x), Core.ADV_GROUND + 1, Math.floor(e.z)), 0,
        '条目落位上方净空');
  }
  assert.deepStrictEqual(byType, {cow: 2, sheep: 2, pig: 3, chicken: 3}, '群 A 牛×2+羊×2 / 群 B 猪×3+鸡×3');
});

test('F4 advHerdStep: 逃窜优先(3s 递减 ×2.2) · 贴近让开(≤2.5 ×0.8) · 平静不动(设计稿 §4.3)', () => {
  assert.deepStrictEqual(Core.advHerdStep(1.0, 1.4, 3, 0.1), {fleeT: 2.9, speed: 1.4 * 2.2},
      '逃窜中: 计时递减, 速度 ×2.2');
  assert.deepStrictEqual(Core.advHerdStep(1.0, 1.4, 0.05, 0.1), {fleeT: 0, speed: 1.4 * 2.2},
      '到期帧仍按逃窜(下一帧回落)');
  assert.deepStrictEqual(Core.advHerdStep(5, 1.4, 0, 0.1), {fleeT: 0, speed: 0}, '逃窜结束且玩家不在圈内: 停');
  assert.deepStrictEqual(Core.advHerdStep(2.5, 1.4, 0, 1 / 60), {fleeT: 0, speed: 1.4 * 0.8},
      '恰 2.5 格让开(含等号, ×0.8 缓步)');
  assert.deepStrictEqual(Core.advHerdStep(2.51, 1.4, 0, 1 / 60), {fleeT: 0, speed: 0}, '2.51 格不动');
  assert.deepStrictEqual(Core.advHerdStep(8, 1.2, 0, 1), {fleeT: 0, speed: 0}, '远距平静(闲逛归壳层)');
  /* 逃窜优先于让开: 受击计时未到期时距离不影响速度档 */
  assert.strictEqual(Core.advHerdStep(8, 1.4, 2, 0.1).speed, 1.4 * 2.2, '逃窜中距离再远也是 ×2.2');
});

/* ============ 昼夜 D5 夜怪政策(mc-daylight-torch §6.1) ============ */

test('昼夜 D5 夜怪常数表: ADV_NIGHT 上限/环带/节拍/池(设计稿 §6.1 拍板④)', () => {
  assert.strictEqual(Core.ADV_NIGHT.CAP, 12, '夜怪上限 12(MC 70/200 → 儿童, 差异 #9)');
  assert.strictEqual(Core.ADV_NIGHT.RING_LO, 24, '出生环带内沿 24 格(MC 24 格内不刷)');
  assert.strictEqual(Core.ADV_NIGHT.RING_HI, 40, '出生环带外沿 40 格');
  assert.strictEqual(Core.ADV_NIGHT.TRY_MS, 2000, '每 2 秒一次刷怪尝试(夜间才跑)');
  assert.deepStrictEqual(Core.ADV_NIGHT.POOL, [['zombie', 2], ['creeper', 1], ['spider', 1]],
      '池 2:1:1, 无骷髅(夜间无远程, 差异 #8)');
});

test('昼夜 D5 advNightCanSpawn: 单表达式 = 方块光 0 且 internalSky≤7(MC 1.18+ 语义)', () => {
  const N = 18000; /* 午夜(skyDim 11) */
  assert.strictEqual(Core.advNightCanSpawn(15, 0, N), true, '夜地表: internal 15-11=4 ≤7 → 可刷');
  assert.strictEqual(Core.advNightCanSpawn(15, 1, N), false, '火把圈(方块光 ≥1)拒绝——防刷怪圈');
  assert.strictEqual(Core.advNightCanSpawn(15, 14, N), false, '火把本格(光 14)拒绝');
  assert.strictEqual(Core.advNightCanSpawn(15, 0, 6000), false, '白天地表: internal 15 >7 拒绝');
  assert.strictEqual(Core.advNightCanSpawn(0, 0, 6000), true, '白天洞穴(sky 0): 暗处可刷(MC 语义, 时间门在节拍器)');
  assert.strictEqual(Core.advNightCanSpawn(18, 0, N), true, '边界: internal 18-11=7 恰 ≤7 通过');
  assert.strictEqual(Core.advNightCanSpawn(19, 0, N), false, 'internal 8 >7 拒绝');
});

test('昼夜 D5 advNightStep: 节拍 2s 一拍 · 白天归零 · 环带落位 · 池权重 · 光照/界外拒绝', () => {
  const N = 18000; /* 午夜 */
  const P = {x: 61.5, z: 76.5};
  const dark = () => ({sky: 15, block: 0}); /* 夜地表可刷口径 */
  const seq = (arr) => {/* 脚本 rnd: 按序耗尽(角度/半径/池各吃一次) */
    let i = 0;
    return () => arr[i++];
  };
  /* 白天: 不刷且计时归零(advNestStep 同构——前置不满足即复位) */
  let r = Core.advNightStep(1.5, 0.6, 6000, dark, P, Math.random);
  assert.strictEqual(r.spawn, null, '白天不出单');
  assert.strictEqual(r.t, 0, '白天节拍器归零');
  /* 未到拍: 只累计不出单 */
  r = Core.advNightStep(1.5, 0.4, N, dark, P, Math.random);
  assert.strictEqual(r.spawn, null, '累计 1.9s 未到 2s 拍');
  assert.ok(Math.abs(r.t - 1.9) < 1e-9, '计时累计(秒)');
  /* 到拍: 出单 + 计时归零; rnd=[0, 0.5, 0] → 角度 0 · 半径 24+8=32 · 池首 zombie */
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0, 0.5, 0]));
  assert.strictEqual(r.t, 0, '到拍后计时归零(逐拍独立)');
  assert.ok(r.spawn, '到拍出刷怪令');
  assert.strictEqual(r.spawn.type, 'zombie', '池权重 2/4 首段: 掷 0 → zombie');
  const d = Math.hypot(r.spawn.x - P.x, r.spawn.z - P.z);
  assert.ok(Math.abs(d - (24 + 0.5 * 16)) < 1e-9, '落点恰在环带上(半径 32 ∈ [24,40]): ' + d.toFixed(2));
  /* 环带两端: rnd 半径 0 → 恰 24 · →1 → 恰 40(角度 90°) */
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0.25, 0, 0]));
  assert.ok(Math.abs(Math.hypot(r.spawn.x - P.x, r.spawn.z - P.z) - 24) < 1e-9, '内沿 24');
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0.25, 1 - 1e-12, 0]));
  assert.ok(Math.hypot(r.spawn.x - P.x, r.spawn.z - P.z) <= 40 + 1e-6, '外沿不越 40');
  /* 池权重: 第三掷 0.5(总 4) → creeper · 0.99 → spider */
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0, 0, 0.5]));
  assert.strictEqual(r.spawn.type, 'creeper', '掷 2/4 落 creeper(权重 1)');
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0, 0, 0.99]));
  assert.strictEqual(r.spawn.type, 'spider', '掷 3.96/4 落 spider(权重 1)');
  /* 光照拒绝: read 报火把格 → 本拍作废不出单(节拍照归零, 下一拍再掷) */
  r = Core.advNightStep(1.9, 0.2, N, () => ({sky: 15, block: 3}), P, Math.random);
  assert.strictEqual(r.spawn, null, '方块光 ≥1 的落点拒绝(防刷怪圈)');
  assert.strictEqual(r.t, 0, '被拒的拍也归零(2s 后再试)');
  /* 界外: read 返 null(壳层界外口径) → 不出单 */
  r = Core.advNightStep(1.9, 0.2, N, () => null, P, Math.random);
  assert.strictEqual(r.spawn, null, '界外/无效落点不出单');
});

test('T2 池参数化: ADV_HOME_ROW 缺省口径 + advNightStepPool 池注入(冒险地图票据 T2)', () => {
  const N = 18000; /* 午夜(与 advNightStep 测试同时刻口径) */
  const P = {x: 61.5, z: 76.5};
  const dark = () => ({sky: 15, block: 0}); /* 夜地表可刷口径 */
  const seq = (arr) => {
    let i = 0;
    return () => arr[i++];
  };
  /* home 地图行缺省数据 = 常量本体(同一引用): T4 地图行/T6 壳换装以行为池权威时,
     home 行为与既有常量逐字节一致(导出口径不变红线) */
  assert.strictEqual(Core.ADV_HOME_ROW.id, 'home', '行 id: home');
  assert.strictEqual(Core.ADV_HOME_ROW.nests, Core.ADV_NESTS, '巢穴池缺省 = ADV_NESTS 本体');
  assert.strictEqual(Core.ADV_HOME_ROW.nightPool, Core.ADV_NIGHT.POOL, '夜怪池缺省 = ADV_NIGHT.POOL 本体');
  /* 池经入参注入(T4 替换语义的可行性证明): 沙漠味池 2:1 → 掷 0 落首段 husk,
     节拍/环带/光照门口径与缺省池完全同构 */
  const desertPool = [['husk', 2], ['creeper', 1]];
  let r = Core.advNightStepPool(1.9, 0.2, N, dark, P, seq([0, 0.5, 0]), desertPool);
  assert.ok(r.spawn, '注入池同样到拍出单');
  assert.strictEqual(r.spawn.type, 'husk', '掷 0 → 注入池首段 husk(权重 2/3)');
  assert.strictEqual(r.t, 0, '计时口径同缺省版(到拍归零)');
  r = Core.advNightStepPool(1.9, 0.2, N, dark, P, seq([0, 0.5, 0.99]), desertPool);
  assert.strictEqual(r.spawn.type, 'creeper', '掷 2.97/3 → 注入池末段 creeper(浮点尽头兜底)');
  assert.ok(Math.abs(Math.hypot(r.spawn.x - P.x, r.spawn.z - P.z) - 32) < 1e-9,
      '落点仍在缺省环带(环带/节拍常量不随池换)');
  /* 池缺省回落: 不传第 7 参 = ADV_NIGHT.POOL 口径, 与 advNightStep 同 rnd 序输出逐字节一致
     (advNightStep 是签名冻结的缺省薄壳, 行为等价由本断言锚定) */
  const a = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0, 0.5, 0.5]));
  const b = Core.advNightStepPool(1.9, 0.2, N, dark, P, seq([0, 0.5, 0.5]));
  assert.deepStrictEqual(b, a, '缺省池回落: 两版同 rnd 序输出逐字节一致');
  /* 注入池不影响光照门/白天归零(拒绝路径先于池选种, 池零消费) */
  assert.strictEqual(Core.advNightStepPool(1.9, 0.2, 6000, dark, P, Math.random, desertPool).spawn,
      null, '白天归零口径不随池变');
  assert.strictEqual(Core.advNightStepPool(1.9, 0.2, N, () => ({sky: 15, block: 3}), P,
      Math.random, desertPool).spawn, null, '火把格拒绝口径不随池变');
});

test('昼夜 D5 advDawnSweep: internalSky(15)≥12(= skyDim≤3) 黎明谓词(跨沿归壳层账本)', () => {
  assert.strictEqual(Core.advDawnSweep(0), true, '清晨: dim 0 → 天已亮');
  assert.strictEqual(Core.advDawnSweep(18000), false, '午夜: dim 11 → 夜怪还在');
  assert.strictEqual(Core.advDawnSweep(23000), false, 'isNight 出界(23000)但 dim≈6.5>3: 清场未到点');
  assert.strictEqual(Core.advDawnSweep(23400), false, 'dim≈3.8 仍 >3');
  assert.strictEqual(Core.advDawnSweep(23600), true, '日出折线下穿 3(≈23517): 清场时刻');
  assert.strictEqual(Core.advDawnSweep(12400), true, '黄昏早期 dim≤3 也为 true——跨沿取上升沿归壳层, 此处只给谓词');
});

test('场景 BGM advMusicMood: 下界=nether · 上界夜=night · 上界昼=adventure', () => {
  assert.strictEqual(Core.advMusicMood('overworld', false), 'adventure', '上界白天');
  assert.strictEqual(Core.advMusicMood('overworld', true), 'night', '上界夜晚');
  assert.strictEqual(Core.advMusicMood('nether', false), 'nether', '下界恒 nether');
  assert.strictEqual(Core.advMusicMood('nether', true), 'nether', '下界不随昼夜变');
});

/* ============ 昼夜 D6: 床·睡觉政策纯函数(设计稿 §7.2) ============ */

test('D6 睡觉政策(时钟改版): advSleepCheck 一条件制 — 床 8 格内无活怪(passive 不算怪); 夜窗已撤销', () => {
  /* 时钟改版(2026-10-28): 床点击开「时钟拨盘」自选醒来时刻, 白天也可拨 —
   * 原夜窗条件撤销(拨盘本身就是选时刻), 只剩床边无怪一条件 */
  assert.deepStrictEqual(Core.advSleepCheck([], 10.5, 20.5), {ok: true, why: ''},
      '无怪可睡(白天黑夜都一样——拨盘选时刻)');
  /* 床边无怪: 水平 8 格(MC 口径 research §1.6); 床坐标取格心 */
  const near = (mobs) => Core.advSleepCheck(mobs, 10.5, 20.5);
  assert.deepStrictEqual(near([{x: 13, z: 23}]), {ok: false, why: 'mob'},
      '3 格内有活怪(why=mob → toast「附近有怪物，睡不着」)');
  assert.deepStrictEqual(near([{x: 18.5, z: 20.5}]), {ok: false, why: 'mob'},
      '恰 8 格整也算「8 格内」(advNearStation 同含等号口径)');
  assert.deepStrictEqual(near([{x: 19.2, z: 20.5}]), {ok: true, why: ''},
      '8.7 格外的怪不拦');
  /* 尸体/已移除/牧场动物(passive)不拦(F4 口径: 动物不算怪) */
  assert.deepStrictEqual(near([{x: 11, z: 21, dead: true}]), {ok: true, why: ''}, '尸体不拦');
  assert.deepStrictEqual(near([{x: 11, z: 21, gone: true}]), {ok: true, why: ''}, '已移除不拦');
  assert.deepStrictEqual(near([{x: 11, z: 21, passive: true}]), {ok: true, why: ''},
      '牧场动物贴床也不拦(MC 口径: 动物不妨碍睡觉)');
  assert.strictEqual(Core.ADV_BED_MOB_R, 8, '床边无怪半径 = 8 格(常量表)');
});

/* ============ 两格床结构 (2026-10-29 两格床改版, 门结构同款缝) ============ */

test('两格床放置校验: advBedSiteOk — 两格空气+各自下方实心+玩家不入; 床头=正典形较小坐标端', () => {
  const air = () => 0;
  assert.deepStrictEqual(Core.advBedSiteOk(air, {x: 10.5, y: 13, z: 20.5}, 0, 12, 13, 20),
      {ok: false, reason: 'nosupport'}, '全空世界无支撑 → 拒(门同款 reason 口径)');
  /* 地板实心: yaw 0 朝北(−z) → 床头候选 = 目标格 z−1; 正典形床头在较小 z 端 */
  const floor = (x, y, z) => (y === 12 ? 3 : 0);
  assert.deepStrictEqual(Core.advBedSiteOk(floor, {x: 10.5, y: 13, z: 20.5}, 0, 12, 13, 20),
      {ok: true, cells: [{x: 12, y: 13, z: 19, id: 53}, {x: 12, y: 13, z: 20, id: 69}]},
      'yaw0: 床头(12,13,19)+床尾(12,13,20)');
  /* yaw π/2: fx=−1 朝西 → 床头候选 x−1, 正典形床头在较小 x 端 */
  assert.deepStrictEqual(Core.advBedSiteOk(floor, {x: 10.5, y: 13, z: 20.5}, Math.PI / 2, 12, 13, 20),
      {ok: true, cells: [{x: 11, y: 13, z: 20, id: 53}, {x: 12, y: 13, z: 20, id: 69}]},
      'yawπ/2: 床头(11,13,20)+床尾(12,13,20)');
  /* 床头候选格被占 → blocked */
  const occ = (x, y, z) => (y === 12 ? 3 : (x === 12 && z === 19 ? 3 : 0));
  assert.deepStrictEqual(Core.advBedSiteOk(occ, {x: 10.5, y: 13, z: 20.5}, 0, 12, 13, 20),
      {ok: false, reason: 'blocked'}, '床头候选格被占 → 拒');
  /* 玩家站床头候选格 → inside */
  assert.deepStrictEqual(Core.advBedSiteOk(floor, {x: 12.5, y: 13, z: 19.5}, 0, 12, 13, 20),
      {ok: false, reason: 'inside'}, '玩家在床头格 → 拒(advDoorPlayerIn 同款)');
});

test('两格床配对破坏: advBedBreakPlan — 正典形认亲(并排两床不拆错邻床)/drop 分配(挖床尾补 1, 挖床头不补)', () => {
  /* 挖床头(5), 床尾在东(6): 伙伴=床尾 → 床头常规掷已发 1, 计划不补 */
  assert.deepStrictEqual(Core.advBedBreakPlan((x, y, z) => (x === 6 && z === 5 ? 69 : 0), 5, 13, 5),
      {cells: [{x: 6, y: 13, z: 5}], drop: 0}, '挖床头: 清床尾, 不补发');
  /* 挖床尾(5), 床头在西(4): 伙伴=床头 → 床尾无 drop 表, 计划补发 1 */
  assert.deepStrictEqual(Core.advBedBreakPlan((x, y, z) => (x === 4 && z === 5 ? 53 : 0), 5, 13, 5),
      {cells: [{x: 4, y: 13, z: 5}], drop: 1}, '挖床尾: 清床头, 补发 1');
  /* 两床并排同轴相接 [头4][尾5·被挖][头6][尾7]: 正典形唯一认亲 → 清(4)不拆错(7) */
  const row = (x, y, z) => (z === 5 ? ({4: 53, 6: 53, 7: 69}[x] || 0) : 0);
  assert.deepStrictEqual(Core.advBedBreakPlan(row, 5, 13, 5),
      {cells: [{x: 4, y: 13, z: 5}], drop: 1}, '并排两床: 候选两床头, 正典形(头<尾)唯一认亲头4, 不拆错头6的床尾7');
  /* lone 半(老档单格床/TNT 拆半): 无配对不补发 */
  assert.deepStrictEqual(Core.advBedBreakPlan((x, y, z) => 0, 5, 13, 5),
      {cells: [], drop: 0}, '无邻半 → 空计划');
});

test('D6 睡觉转场: advSleepStep — 渐黑 1.5s → 停 2s(唤醒沿) → 渐亮 1.5s ≈ 5s(MC 101 tick 观感)', () => {
  const S = Core;
  /* 渐黑段: opacity 线性升, phase='out' */
  let s = S.advSleepStep(0, 0.75);
  assert.strictEqual(s.phase, 'out');
  assert.strictEqual(Math.round(s.opacity * 100) / 100, 0.5, '半程半黑');
  assert.strictEqual(s.wake, false);
  assert.strictEqual(s.t, 0.75);
  /* 停段: opacity=1, phase='hold' */
  s = S.advSleepStep(1.5, 1.0);
  assert.strictEqual(s.phase, 'hold');
  assert.strictEqual(s.opacity, 1, '全黑停留');
  assert.strictEqual(s.wake, false, '停段未到唤醒沿');
  /* 唤醒沿: 跨过 3.5s(1.5+2)恰一帧 wake=true — 渐亮起点 = 跳清晨+清场+设出生点 */
  s = S.advSleepStep(3.4, 0.2);
  assert.strictEqual(s.phase, 'in');
  assert.strictEqual(s.wake, true, '跨 3.5s 的这一步恰一次唤醒沿');
  assert.strictEqual(Math.round(s.opacity * 100) / 100, 0.93, '渐亮起点近全黑(3.6s → (5-3.6)/1.5)');
  s = S.advSleepStep(3.6, 0.1);
  assert.strictEqual(s.wake, false, '沿只发一次(后续帧不重发)');
  /* 大步跨沿也只发一次(后台标签页回来 dt 被主循环钳 0.05, 但状态机自身鲁棒) */
  s = S.advSleepStep(2.0, 2.0);
  assert.strictEqual(s.wake, true, '一步跨过 3.5s 也发沿');
  assert.strictEqual(s.phase, 'in');
  /* 收尾: 5s 到点 done, opacity 归 0 */
  s = S.advSleepStep(4.9, 0.2);
  assert.strictEqual(s.phase, 'done');
  assert.strictEqual(s.opacity, 0);
  assert.strictEqual(s.t, 5, 't 钳在总时长');
  /* 渐亮中点透明度对称 */
  s = S.advSleepStep(4.25, 0);
  assert.strictEqual(Math.round(s.opacity * 100) / 100, 0.5, '4.25s(渐亮中点)半透明');
  assert.strictEqual(S.ADV_SLEEP_TOTAL, 5, '总时长常量 ≈ MC 101 tick=5.05s(差异 #2 观感等价)');
});

/* ============ 昼夜 D7: 灯笼耗秒政策纯函数(设计稿 §8.2) ============ */

test('D7 灯笼常数表: ADV_LANTERN 物品 id 与耗秒节拍(设计稿 §8.2 拍板)', () => {
  assert.strictEqual(Core.ADV_LANTERN.ID, 'lantern', '物品键 = items-core 注册的 lantern');
  assert.strictEqual(Core.ADV_LANTERN.DRAIN_S, 1, '每持满 1 秒扣 1 耐久(dt 累计器)');
});

test('D7 advLanternStep: 三前置(选中灯笼·耐久>0·skyDim>0)才亮才耗 · 前置不满足累计器归零', () => {
  const L = Core;
  /* 白天(skyDim 0): 不亮不耗, 且累计器归零(advNightStep 白天同构) */
  let r = L.advLanternStep(0.9, 0.2, 'lantern', 300, 0);
  assert.strictEqual(r.glow, false, '白天不亮');
  assert.strictEqual(r.drain, false, '白天不耗(孩子不会白浪费)');
  assert.strictEqual(r.t, 0, '白天累计器归零');
  /* 手持别物/空手: 不亮不耗归零 */
  r = L.advLanternStep(0.9, 0.2, 'torch', 300, 11);
  assert.strictEqual(r.glow, false, '非灯笼不亮');
  assert.strictEqual(r.t, 0, '换下手累计器归零(半秒进度不白送也不白扣)');
  r = L.advLanternStep(0.9, 0.2, '', 300, 11);
  assert.strictEqual(r.glow, false, '空手不亮');
  /* 耐久归零: 不亮不耗(燃尽灯笼静默, 消失政策在壳层) */
  r = L.advLanternStep(0.9, 0.2, 'lantern', 0, 11);
  assert.strictEqual(r.glow, false, '燃尽不亮');
  assert.strictEqual(r.drain, false, '燃尽不耗');
  /* 黄昏沿(skyDim 恰 >0)即亮: 判据是 skyDim 而非 isNight(§8.2 字面口径) */
  r = L.advLanternStep(0, 0.2, 'lantern', 300, 0.5);
  assert.strictEqual(r.glow, true, '天微暗(skyDim 0.5>0)灯笼已亮');
});

test('D7 advLanternStep: 持满 1 秒出扣单 · 余时结转下一秒 · 未满只累计', () => {
  const L = Core;
  /* 未满 1 秒: 只累计不出扣单 */
  let r = L.advLanternStep(0, 0.6, 'lantern', 300, 11);
  assert.strictEqual(r.drain, false, '0.6s 未持满');
  assert.ok(Math.abs(r.t - 0.6) < 1e-9, '累计器推进');
  assert.strictEqual(r.glow, true, '点亮中');
  /* 跨过 1 秒: 出扣单, 余时结转(不整段清零) */
  r = L.advLanternStep(0.9, 0.3, 'lantern', 300, 11);
  assert.strictEqual(r.drain, true, '1.2s 持满出扣单(damageTool 扣 1)');
  assert.ok(Math.abs(r.t - 0.2) < 1e-9, '余时 0.2s 结转下一秒');
  /* 恰满 1 秒整: 出扣单 */
  r = L.advLanternStep(0.5, 0.5, 'lantern', 300, 11);
  assert.strictEqual(r.drain, true, '恰 1.0s 也算持满');
  assert.strictEqual(r.t, 0, '无余时');
  /* 低帧率大步: 钳 0.05 的 dt 单步最多跨一拍, 状态机自身仍按余时结转 */
  r = L.advLanternStep(0.99, 0.05, 'lantern', 300, 11);
  assert.strictEqual(r.drain, true, '大步跨沿也恰一扣单');
});

/* ============ 政策下沉包(评审候选 5, 2026-10) — 自壳迁入的八件政策直测 ============ */

test('下沉包① advHomeReady: 60s 冷却窗口(边界恰 60 算就绪)', () => {
  assert.strictEqual(Core.ADV_HOME_CD, 60, '冷却窗口常量 60s');
  assert.strictEqual(Core.advHomeReady(-1e9, 0), true, '从未用过: 立即可用');
  assert.strictEqual(Core.advHomeReady(0, 59.9), false, '冷却内拒绝');
  assert.strictEqual(Core.advHomeReady(0, 60), true, '边界 60s 恰就绪');
});

test('下沉包② advBedSpot: 床四邻取「两格净空+实心支承」首格, 全堵回落注入位', () => {
  /* 假世界经 getB 注入(seam 先例: advNightStep 的 read); 床占 (10,25,20), 邻取序 +x/−x/+z/−z */
  const w = new Map();
  const g = (x, y, z) => w.get(x + ',' + y + ',' + z) || 0;
  const fb = {x: 61.5, y: 25, z: 76.5, yaw: 2};
  const clear = (x, z) => {/* 站位两格净空 + 脚下泥支承 */
    w.set(x + ',25,' + z, 0); w.set(x + ',26,' + z, 0); w.set(x + ',24,' + z, 2);
  };
  clear(11, 20); /* 仅 +x 合格 */
  assert.deepStrictEqual(Core.advBedSpot(10, 25, 20, g, fb), {x: 11.5, y: 25, z: 20.5, yaw: 0},
      '+x 邻合格取首格(格心, yaw 归零)');
  w.set('11,26,20', 7); /* +x 头顶被叶堵 */
  clear(9, 20); /* −x 合格 */
  assert.deepStrictEqual(Core.advBedSpot(10, 25, 20, g, fb), {x: 9.5, y: 25, z: 20.5, yaw: 0},
      '+x 堵 → 按取序落 −x');
  w.set('9,24,20', api.B_TORCH); /* −x 支承是薄块(火把): 当不了支承 */
  clear(10, 21); /* +z 合格 */
  assert.deepStrictEqual(Core.advBedSpot(10, 25, 20, g, fb), {x: 10.5, y: 25, z: 21.5, yaw: 0},
      '薄块支承跳过 → +z');
  w.set('10,24,21', api.B_GRASS_TUFT); /* +z 支承 solid:false(草丛) */
  w.set('11,25,20', 0); w.set('11,26,20', 0); w.set('11,24,20', api.B_TORCH); /* +x 薄块支承 */
  w.set('9,25,20', 7); /* −x 堵死 */
  clear(10, 19); /* −z 合格 */
  assert.deepStrictEqual(Core.advBedSpot(10, 25, 20, g, fb), {x: 10.5, y: 25, z: 19.5, yaw: 0},
      '草丛支承(solid:false)跳过 → −z');
  w.set('10,24,19', api.B_TORCH); /* −z 支承也薄: 四邻全堵 */
  assert.strictEqual(Core.advBedSpot(10, 25, 20, g, fb), fb, '四邻全堵回落调用方位(原样引用)');
});

test('下沉包③ advTntTapStep: 短按点燃/按住转蓄力/面板期取消/无状态直过', () => {
  const st = (held) => ({x: 1, y: 2, z: 3, held});
  assert.deepStrictEqual(Core.advTntTapStep(null, false, false, 0.1), {state: null, act: null},
      '无状态直过');
  assert.deepStrictEqual(Core.advTntTapStep(st(0.1), false, true, 0.1), {state: null, act: null},
      '面板期取消不点燃(状态清)');
  let r = Core.advTntTapStep(st(0), true, false, 0.1);
  assert.ok(r.state && r.state.held === 0.1 && r.state.x === 1, '按住窗口内累计');
  assert.strictEqual(r.act, null, '窗口内无动作');
  r = Core.advTntTapStep(st(0.2), false, false, 0.01);
  assert.deepStrictEqual(r, {state: null, act: {ignite: true, x: 1, y: 2, z: 3}},
      '松手短按(累计 0.21 < 0.25)出点燃令(块在不在由壳验)');
  r = Core.advTntTapStep(st(0.25), false, false, 0.01);
  assert.strictEqual(r.act, null, '松手长按(0.26 ≥ 0.25)无令');
  assert.strictEqual(r.state, null, '状态照常消费');
  assert.strictEqual(Core.ADV_TNT_TAP_T, 0.25, '短按窗口常量 0.25s');
  r = Core.advTntTapStep(st(0.24), true, false, 0.02);
  assert.deepStrictEqual(r, {state: null, act: {mine: true}}, '按住跨 0.25s 转蓄力挖走回收');
});

test('下沉包④(红线) advCascadeLedger: 移动两格先原格后落格/移除链动作序/fell 与 quest 旗标', () => {
  const log = [];
  const sink = {
    mark: (x, y, z, id) => log.push(['mark', x, y, z, id]),
    sapling: (x, y, z) => log.push(['sap', x, y, z]),
    drop: (id, n) => log.push(['drop', id, n]),
    questMine: (id) => log.push(['quest', id]),
  };
  /* 移动项(落沙 D7): 记账两格且键序即契约——原格 0 在前, 落格 id 在后
     (确定性重放红线: 漏格/错序 → edits 逐格最后写赢口径下重进即错位) */
  let r = Core.advCascadeLedger([{x: 5, y: 20, z: 6, id: 8, to: {x: 5, y: 19, z: 6}}], false, sink);
  assert.deepStrictEqual(log, [['mark', 5, 20, 6, 0], ['mark', 5, 19, 6, 8]],
      '移动两格记账, 先原格后落格');
  assert.strictEqual(r.felled, false, '移动不置 fell(不掉落不喊话)');
  /* 移除项动作序: mark 0 → 树苗撤表 → 默认表掉落(保底) → quest 旗标门控 */
  log.length = 0;
  r = Core.advCascadeLedger([
    {x: 1, y: 25, z: 2, id: api.B_SAPLING},
    {x: 3, y: 25, z: 4, id: 5}, /* 原木(fell 旗标) */
    {x: 7, y: 25, z: 8, id: 2}, /* 泥土(保底掉泥土) */
  ], true, sink);
  assert.deepStrictEqual(log, [
    ['mark', 1, 25, 2, 0], ['sap', 1, 25, 2], ['drop', 'sapling', 1], ['quest', api.B_SAPLING],
    ['mark', 3, 25, 4, 0], ['drop', 'log', 1], ['quest', 5],
    ['mark', 7, 25, 8, 0], ['drop', 'dirt', 1], ['quest', 2],
  ], '同清单必同动作序(清单序驱动, 逐项 mark→撤表→掉落→任务)');
  assert.strictEqual(r.felled, true, '含原木(fell)置整树倒旗标(壳据此喊话)');
  /* quest=false(TNT 链): 任务挂点整段静默, 记账/掉落照走 */
  log.length = 0;
  Core.advCascadeLedger([{x: 3, y: 25, z: 4, id: 5}], false, sink);
  assert.deepStrictEqual(log, [['mark', 3, 25, 4, 0], ['drop', 'log', 1]],
      'TNT 链不进任务计数(P6: TNT 掀掉的不算)');
});

test('下沉包⑤(红线) advGrowMark: 足迹界限恰为 y..y+7 × ±2, 盒内非空才记', () => {
  const marks = [];
  const world = new Map();
  world.set('10,25,10', 5); /* 树干基(盒角 y 起点) */
  world.set('12,32,12', 7); /* 盒角(y+7, ±2) inclusive */
  world.set('13,25,10', 7); /* 越界 ±3 → 不扫 */
  world.set('10,33,10', 5); /* 越界 y+8 → 不扫 */
  Core.advGrowMark(10, 25, 10, (x, y, z) => world.get(x + ',' + y + ',' + z) || 0,
      (x, y, z, id) => marks.push([x, y, z, id]));
  assert.deepStrictEqual(marks, [[10, 25, 10, 5], [12, 32, 12, 7]],
      '盒内非空逐格记账, 界外不扫(y..y+7 / ±2 的粗扫界限=重进幂等关键)');
  /* 重进一致性: 记账键值即重放账本(同编辑序必同终态——树完整, 不复活半棵树) */
  const ledger = new Map(marks.map(([x, y, z, id]) => [x + ',' + y + ',' + z, id]));
  assert.strictEqual(ledger.get('10,25,10'), 5, '树干格入账');
  assert.ok(!ledger.has('13,25,10') && !ledger.has('10,33,10'), '界外格不入账(冗余记账只限盒内)');
});

test('下沉包⑥ advChestTake: 可堆叠 add 并堆/可耗损物整槽搬耐久不重铸/满包拒收箱格原样', () => {
  /* 可堆叠: 箱 40 煤取回并入包(20+40) */
  let chest = {size: 9, slots: Array(9).fill(null)};
  chest.slots[0] = {id: 'coal', n: 40};
  let inv = api.mkInventory();
  api.add(inv, 'coal', 20);
  assert.strictEqual(Core.advChestTake(chest, inv, 0), 'ok', '搬运成功');
  assert.strictEqual(api.count(inv, 'coal'), 60, '并堆入包');
  assert.strictEqual(chest.slots[0], null, '箱格清空');
  /* 可耗损物(工具): 连耐久整槽搬首个空位——不走 add(mkStack 会重铸满耐久) */
  chest = {size: 9, slots: Array(9).fill(null)};
  chest.slots[1] = {id: 'pick_iron', n: 1, dur: 111};
  inv = api.mkInventory();
  assert.strictEqual(Core.advChestTake(chest, inv, 1), 'ok');
  assert.deepStrictEqual({...inv.slots[0]}, {id: 'pick_iron', n: 1, dur: 111},
      '耐久原样 111(不重铸满 500)');
  assert.strictEqual(chest.slots[1], null, '箱格清空');
  /* 满包: 可堆叠物放不下 → 整摞留在箱里, 箱格原样 */
  chest = {size: 9, slots: Array(9).fill(null)};
  chest.slots[0] = {id: 'coal', n: 5};
  inv = api.mkInventory();
  for (let i = 0; i < api.INV_SLOTS; i++) inv.slots[i] = {id: 'stone', n: 64};
  assert.strictEqual(Core.advChestTake(chest, inv, 0), 'full', '满包拒收');
  assert.deepStrictEqual({...chest.slots[0]}, {id: 'coal', n: 5}, '箱格原样不动');
  /* 满包 + 可耗损物无空位: 同拒收 */
  chest.slots[0] = {id: 'shears', n: 1, dur: 30};
  assert.strictEqual(Core.advChestTake(chest, inv, 0), 'full', '无空位整槽搬也拒收');
  /* 空槽: 无动作 */
  assert.strictEqual(Core.advChestTake({size: 9, slots: Array(9).fill(null)}, api.mkInventory(), 3),
      'empty', '空槽返 empty(壳据此不 toast)');
});

test('下沉包⑦ advExplodeCells: 半径界/TNT 链式点燃不破坏/树苗撤表/掷骰 rand 注入', () => {
  const ignite = []; const edits = []; const saps = []; const drops = [];
  const sink = {
    ignite: (x, y, z) => ignite.push([x, y, z]),
    edit: (x, y, z) => edits.push([x, y, z]),
    sapling: (x, y, z) => saps.push([x, y, z]),
    drop: (id, n) => drops.push([id, n]),
  };
  /* 假世界(爆心 0,0,0, 半径 3.5): (3,1,1) 格心距 √(2.5²+0.5²+0.5²)≈2.6 界内;
     (3,3,3) 格心距 √(3×2.5²)≈4.33 越界——立方角天然出球 */
  const w = new Map();
  w.set('3,1,1', 3); /* 石头: 界内破坏 */
  w.set('3,3,3', 3); /* 立方角: 越界不进遍历 */
  w.set('2,0,0', api.B_TNT); /* 圈内 TNT: 只点燃不破坏 */
  w.set('1,0,0', api.B_SAPLING); /* 树苗: 破坏+撤表 */
  const read = (x, y, z) => w.get(x + ',' + y + ',' + z) || 0;
  Core.advExplodeCells(0, 0, 0, read, sink, () => 0); /* rand 恒 0: 70% 门槛必中签 */
  assert.deepStrictEqual(ignite, [[2, 0, 0]], '圈内 TNT 只链式点燃不走破坏链');
  assert.ok(edits.some((e) => e[0] === 1 && e[1] === 0 && e[2] === 0) &&
      edits.some((e) => e[0] === 3 && e[1] === 1 && e[2] === 1), '界内可采集格逐块破坏');
  assert.ok(!edits.some((e) => e[0] === 3 && e[1] === 3 && e[2] === 3), '立方角越界不破坏(球半径判据)');
  assert.ok(!edits.some((e) => e[0] === 2 && e[1] === 0 && e[2] === 0), 'TNT 格不进 edit');
  assert.deepStrictEqual(saps, [[1, 0, 0]], '掀掉的树苗撤计时');
  assert.ok(drops.some((d) => d[0] === 'sapling'), '掉落经 advTntRoll(rand 注入恒中签)');
  /* rand 恒 0.99: 门槛不中 → 只碎不掉 */
  drops.length = 0;
  Core.advExplodeCells(0, 0, 0, read, sink, () => 0.99);
  assert.strictEqual(drops.length, 0, '不中签只碎不掉(D4 掉落率 70%)');
  /* 同 read+sink+rand 重放: 动作序逐条一致(确定性重放红线) */
  const snap = () => JSON.stringify([ignite, edits, saps, drops]);
  ignite.length = 0; edits.length = 0; saps.length = 0; drops.length = 0;
  Core.advExplodeCells(0, 0, 0, read, sink, () => 0);
  const a = snap();
  ignite.length = 0; edits.length = 0; saps.length = 0; drops.length = 0;
  Core.advExplodeCells(0, 0, 0, read, sink, () => 0);
  assert.strictEqual(snap(), a, '同输入必同动作序(遍历序 dx→dy→dz 即契约)');
});

test('下沉包⑦b advTntWave: 水平半径+垂距过滤 · 线性衰减伤害与击退向量 · 尸体不计', () => {
  const mk = (x, y, z, extra) => Object.assign({pos: {x, y, z}, dead: false, gone: false}, extra || {});
  /* 爆心格 (0,0,0) → 心 (0.5,0.5,0.5) */
  const mobs = [
    mk(2.5, 0.5, 0.5), /* 距 2.0: 界内 */
    mk(4.4, 0.5, 0.5), /* 距 3.9: 界内边缘 */
    mk(6, 0.5, 0.5), /* 距 5.5: 越水平界 */
    mk(0.5, 5.5, 0.5), /* 垂距 5 > 3: 越垂直界 */
    mk(0.5, 0.5, 0.5, {dead: true}), /* 尸体不计 */
    mk(0.5, 0.5, 0.5, {gone: true}), /* 已移除不计 */
  ];
  const out = Core.advTntWave(mobs, 0, 0, 0);
  assert.strictEqual(out.length, 2, '只圈内存活怪入清单');
  assert.strictEqual(out[0].m, mobs[0], '实体引用原样带回(壳喂 Mobs.hit)');
  assert.strictEqual(out[0].dmg, Core.advTntDmg(2.0), '伤害 = 线性衰减(距 2.0)');
  assert.ok(Math.abs(out[0].kdx - 2) < 1e-9 && Math.abs(out[0].kdz) < 1e-9, '击退向量 = 爆心指向怪');
  assert.strictEqual(out[1].dmg, Core.advTntDmg(3.9), '边缘伤害 = 衰减到 12 档');
});

test('下沉包⑧ advAmbleStep: 递减续期不掷随机/到期三掷 dir→t→walk(次序锁)/在走概率严小于', () => {
  let n = 0;
  const rnd = () => {
    n++; return 0.5;
  };
  assert.deepStrictEqual(Core.advAmbleStep(2, 1.2, true, 0.1, rnd), {t: 1.9, dir: 1.2, walk: true},
      '未到期只递减, 方向/在走原样续期');
  assert.strictEqual(n, 0, '未到期不掷随机');
  assert.deepStrictEqual(Core.advAmbleStep(0.1, 0, false, 0.2, rnd),
      {t: 3.5, dir: 0.5 * Math.PI * 2, walk: true}, '到期重掷: dir=0.5·2π · t=2+0.5·3 · walk(0.5<0.6)');
  assert.strictEqual(n, 3, '恰三掷(方向/时长/在走)');
  assert.strictEqual(Core.ADV_HERD_AMBLE_WALK_P, 0.6, '在走概率常量(六成在走四成吃草)');
  const pick = (a) => {
    let i = 0;
    return () => a[i++];
  };
  assert.strictEqual(Core.advAmbleStep(0.05, 0, false, 0.05, pick([0, 0, 0.59])).walk, true,
      '第三掷 0.59 < 0.6 → 在走');
  assert.strictEqual(Core.advAmbleStep(0.05, 0, false, 0.05, pick([0, 0, 0.6])).walk, false,
      '恰 0.6 站着吃草(严小于口径)');
  assert.deepStrictEqual(Core.advAmbleStep(0.05, 0, false, 0.05, pick([0, 0.2, 0])).t, 2.6,
      '时长 = 2 + rnd·3(2~5s 窗口)');
});

/* ============ 自壳测副本迁入的纯函数簇(adventure-mode.test.js 删重复) ============ */

test('挥击伤害全表: 手持工具按 D9 表取值(剑镐斧锹四阶), 空手/非工具 3', () => {
  const D9 = {sword: [7, 9, 11, 13], pick: [3, 4, 6, 8], axe: [5, 6, 8, 10], shovel: [2, 3, 4, 5]};
  const tiers = ['wood', 'stone', 'iron', 'diamond'];
  for (const kind of Object.keys(D9)) {
    tiers.forEach((t, i) => assert.strictEqual(Core.advSwingDmg(kind + '_' + t), D9[kind][i],
        kind + ' ' + t + ' = ' + D9[kind][i] + '(设计稿 D9 表)'));
  }
  assert.strictEqual(Core.advSwingDmg(''), Core.ADV_FIST_DMG, '空手 3');
  assert.strictEqual(Core.advSwingDmg('coal'), Core.ADV_FIST_DMG, '非工具物品当空手 3');
});

test('击杀掉落清单变体: 加成与稀有都掷中/骷髅保底骨头/未收录怪种空清单', () => {
  const m = {type: 'zombie', pos: {x: 10, y: 25, z: 20}};
  const both = Core.advDeathDrops(m, () => 0.01);
  assert.strictEqual(both[0].id, 'rotten_flesh');
  assert.strictEqual(both[0].n, 2, '50% 加成 +1');
  assert.strictEqual(both[1].id, 'iron_ingot');
  assert.strictEqual(both[1].n, 1, '稀有 5% 铁锭 +1');
  assert.strictEqual(both[1].y, 25.8, '掉落点 = 尸体落点 y+0.8(碎块中蹦出)');
  const sk = Core.advDeathDrops({type: 'skeleton', pos: {x: 0, y: 24, z: 0}}, () => 0.99);
  assert.deepStrictEqual(sk.map((s) => [s.id, s.n]), [['bone', 1]], '骷髅保底骨头');
  assert.deepStrictEqual(Core.advDeathDrops({type: 'dragon', pos: {x: 0, y: 10, z: 0}}, () => 0.5), [],
      '掉落表没写就是没有(不抛错)');
});

test('放置合法性全簇: 实心贴面/thin 只放实心顶+墙火把贴墙/树苗限草地泥土/叠放与无效输入拒', () => {
  const chk = Core.advPlaceCheck;
  const side = chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 2, 1, 0);
  assert.ok(side.ok, '泥土放草地顶面 ok');
  assert.deepStrictEqual([side.x, side.y, side.z], [10, 25, 10], '落点 = 命中格 + 面法线');
  assert.ok(chk({x: 10, y: 24, z: 10, nx: 1, ny: 0, nz: 0}, 2, 1, 0).ok, '实心块贴侧面也可');
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 2, 1, 5).ok, false,
      '目标位已有方块 → 拒(叠放)');
  assert.ok(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, api.B_TORCH, 1, 0).ok, '火把放草地顶面 ok');
  assert.ok(chk({x: 10, y: 24, z: 10, nx: 1, ny: 0, nz: 0}, api.B_TORCH, 1, 0).ok,
      '墙火把: 火把贴实心侧面 ok(wall 旗标)');
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 0, nz: 1}, api.B_TORCH, api.B_GRASS_TUFT, 0).ok,
      false, '火把贴草丛侧面 → 拒(solid:false 当不了支承)');
  assert.strictEqual(chk({x: 10, y: 25, z: 10, nx: 0, ny: 1, nz: 0}, api.B_TORCH, api.B_GRASS_TUFT, 0).ok,
      false, '草丛(solid:false)顶上放火把 → 拒');
  assert.ok(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, api.B_SAPLING, 1, 0).ok, '树苗放草地 ok');
  assert.ok(chk({x: 10, y: 23, z: 10, nx: 0, ny: 1, nz: 0}, api.B_SAPLING, 2, 0).ok, '树苗放泥土 ok');
  assert.strictEqual(chk({x: 10, y: 22, z: 10, nx: 0, ny: 1, nz: 0}, api.B_SAPLING, 3, 0).ok, false,
      '树苗放石头上 → 拒');
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 0, nz: 1}, api.B_SAPLING, 1, 0).ok, false,
      '树苗贴侧面 → 拒');
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 9999, 1, 0).ok, false,
      '未注册方块 id → 拒');
  assert.strictEqual(chk(null, 2, 1, 0).ok, false, '无命中 → 拒');
});

test('覆盖放置(用户拍板 2026-10-28): 命中 replaceable 薄块 → 落点=被点格本身盖掉; thin 新块支承认正下方', () => {
  const chk = Core.advPlaceCheck;
  /* 实心新块覆盖: 即便法线侧落点非空气也放(旧路径会拒/架半空) */
  const rep = chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 2, api.B_GRASS_TUFT, 3);
  assert.ok(rep.ok, '泥土命中草丛: 覆盖 ok(法线侧叠放拒不适用于覆盖)');
  assert.deepStrictEqual([rep.x, rep.y, rep.z], [10, 24, 10], '覆盖落点 = 被点格本身');
  const wall = chk({x: 10, y: 24, z: 10, nx: 1, ny: 0, nz: 0}, 2, api.B_TORCH, 3);
  assert.ok(wall.ok, '泥土命中墙火把: 覆盖 ok(新块贴墙不悬空)');
  assert.deepStrictEqual([wall.x, wall.y, wall.z], [10, 24, 10], '火把覆盖落点 = 被点格本身');
  /* thin 新块覆盖(拿火把点花草): 支承=被覆盖格正下方(belowId), 面法线路径不适用 */
  assert.ok(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, api.B_TORCH, api.B_GRASS_TUFT, 0, 1).ok,
      '火把覆盖草丛: 正下方草地块(实心) ok');
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, api.B_TORCH, api.B_GRASS_TUFT, 0, 0).ok,
      false, '火把覆盖草丛: 正下方悬空 → 拒');
  assert.ok(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, api.B_SAPLING, api.B_GRASS_TUFT, 0, 1).ok,
      '树苗覆盖草丛: 正下方草地 ok');
  assert.strictEqual(chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, api.B_SAPLING, api.B_GRASS_TUFT, 0, 3).ok,
      false, '树苗覆盖草丛: 正下方石头 → 拒(限草地/泥土 D7)');
  /* 非覆盖族(thin 但无旗标): 走原路径——庄稼/家具防误盖 */
  const wheat = chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 2, api.B_WHEAT_3, 0);
  assert.ok(wheat.ok, '泥土命中熟麦: 不覆盖(庄稼保护), 走原路径放法线侧');
  assert.deepStrictEqual([wheat.x, wheat.y, wheat.z], [10, 25, 10],
      '麦走原路径: 落点 = 命中格 + 面法线(旧行为)');
  const bedHit = chk({x: 10, y: 24, z: 10, nx: 0, ny: 1, nz: 0}, 2, api.B_BED, 3);
  assert.strictEqual(bedHit.ok, false, '泥土命中床: 不覆盖且法线侧非空气 → 拒(家具防误盖)');
});

test('食物回血补充: 腐肉注册表 food=2 走同一政策口径(儿童版无饥饿 debuff)', () => {
  assert.strictEqual(api.ITEMS.rotten_flesh.food, 2, '腐肉注册表 food=2(D7)');
  assert.strictEqual(Core.advEatPolicy(10, 30, api.ITEMS.rotten_flesh.food).hp, 12, '腐肉回 2 血(同口径)');
});

test('树苗计时第二轮: 到期逐轮出清单直至 Map 清空', () => {
  const map = new Map([
    ['10,25,10', {x: 10, y: 25, z: 10, left: 0.5}],
    ['20,25,20', {x: 20, y: 25, z: 20, left: 3}],
  ]);
  const out = Core.advSapDue(map, 1.0);
  assert.strictEqual(out.length, 1, '只有到期的进清单');
  assert.strictEqual(out[0].x, 10, '到期项坐标完整');
  assert.ok(!map.has('10,25,10'), '到期项移出计时 Map');
  assert.strictEqual(map.get('20,25,20').left, 2, '未到期递减留队');
  const out2 = Core.advSapDue(map, 2.0);
  assert.strictEqual(out2.length, 1, '第二轮到期出清单');
  assert.strictEqual(map.size, 0, 'Map 清空');
});

test('站点判定补充: 按 id 过滤/贴身/两站点并存/空缓存', () => {
  const near = Core.advNearStation;
  const sts = [{x: 10, y: 25, z: 10, id: api.B_CRAFT}, {x: 30, y: 25, z: 30, id: api.B_FURNACE}];
  assert.strictEqual(near(sts, 10.5, 10.5, 4, api.B_CRAFT), true, '贴身解锁');
  assert.strictEqual(near(sts, 10.5, 10.5, 4, api.B_FURNACE), false,
      '按 id 过滤: 工作台位点不点亮熔炉判定');
  assert.strictEqual(near(sts, 33.5, 30.5, 4, api.B_FURNACE), true, '熔炉位点命中(两种站点并存)');
  assert.strictEqual(near([], 10, 10, 4, api.B_CRAFT), false, '空缓存(一个站点都没放过)');
});

test('TNT 掷骰补充: 中签后掉落表原样掷(保底+概率)/tnt 旗标守卫恒空手', () => {
  const roll = (id, r) => [...Core.advTntRoll(id, r).map((d) => [d.id, d.n])];
  assert.deepStrictEqual(roll(7, () => 0).map((e) => e[0]), ['sapling', 'apple', 'stick'],
      '树叶中签后 rollBlockDrop 原样掷(rand 恒 0 → 三样概率全中, 无保底)');
  assert.strictEqual(roll(api.B_TNT, () => 0).length, 0,
      'tnt 旗标守卫恒空手(不自掉, D3 与 drop 字段解耦)');
});

test('TNT 衰减补充: 中途 24 与波及边缘 12(线性内插)', () => {
  assert.strictEqual(Core.advTntDmg(0), Core.ADV_TNT_DMG_HI, '爆心 30');
  assert.strictEqual(Core.advTntDmg(1.5), 24, '中途线性衰减 24');
  assert.strictEqual(Core.advTntDmg(4.5), Core.ADV_TNT_DMG_LO, '波及边缘 12');
  assert.strictEqual(Core.advTntDmg(9), Core.ADV_TNT_DMG_LO, '越界钳制(调用方已按半径过滤)');
});

/* ============ 门与玻璃板政策(docs/door-window-design.md §3, 全走注入 seam) ============ */

test('门身份: advIsDoor 认四态 id, 不认玻璃板/普通方块', () => {
  assert.strictEqual(Core.advIsDoor(api.B_DOOR), true);
  assert.strictEqual(Core.advIsDoor(api.B_DOOR_OPEN), true);
  assert.strictEqual(Core.advIsDoor(api.B_DOOR_TOP), true);
  assert.strictEqual(Core.advIsDoor(api.B_DOOR_TOP_OPEN), true);
  assert.strictEqual(Core.advIsDoor(api.B_GLASS_PANE), false, '玻璃板不是门(不进开关链)');
  assert.strictEqual(Core.advIsDoor(api.B_CRAFT), false);
});

test('advDoorSiteOk: 两格空气+下方实心 → 闭合态对; 空中/占用/玩家在门框 → 拒', () => {
  const world = {}; /* read 桩: key 'x,y,z' → id */
  const rd = (x, y, z) => (world[x + ',' + y + ',' + z] || 0);
  const P = {x: 10.5, y: 25, z: 10.5};
  world['20,24,20'] = 3; /* 泥土支撑(站点校验要求下方实心, 级联 isSupport 同判据) */
  const ok = Core.advDoorSiteOk(rd, P, 20, 25, 20);
  assert.deepStrictEqual(ok, {ok: true, cells: [{x: 20, y: 25, z: 20, id: api.B_DOOR},
    {x: 20, y: 26, z: 20, id: api.B_DOOR_TOP}]}, '空气+泥土支撑 → 闭合态对(63/64)');
  world['20,26,20'] = 3; /* 上格被石头占 */
  assert.deepStrictEqual(Core.advDoorSiteOk(rd, P, 20, 25, 20), {ok: false, reason: 'blocked'}, '上格非空气 → 拒');
  delete world['20,26,20'];
  world['20,24,20'] = 0; /* 下方挖空 */
  assert.deepStrictEqual(Core.advDoorSiteOk(rd, P, 20, 25, 20), {ok: false, reason: 'nosupport'}, '下方非实心 → 拒');
  world['20,24,20'] = 3; /* 恢复支撑(下一用例要走到玩家占位分支) */
  world['10,24,10'] = 3; /* 玩家脚下的门位也要有支撑, 才能走到 inside 分支 */
  assert.deepStrictEqual(Core.advDoorSiteOk(rd, P, 10, 25, 10), {ok: false, reason: 'inside'}, '玩家站门框 → 拒');
});

test('advDoorTogglePlan: 下/上半命中都定位下半 · 关↔开成对换 id · 玩家站门洞拒关不拒开', () => {
  const world = {};
  const rd = (x, y, z) => (world[x + ',' + y + ',' + z] || 0);
  const P = {x: 10.5, y: 25, z: 10.5}; /* 远处玩家(占位拒关用例另用 Pin) */
  world['40,25,40'] = api.B_DOOR; world['40,26,40'] = api.B_DOOR_TOP;
  const plan = Core.advDoorTogglePlan(rd, api.B_DOOR, P, 40, 25, 40);
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.open, true, '关门 → 开');
  assert.deepStrictEqual(plan.writes.map((w) => [w.x, w.y, w.z, w.id]),
      [[40, 25, 40, api.B_DOOR_OPEN], [40, 26, 40, api.B_DOOR_TOP_OPEN]], '两格成对 65/66');
  /* 点上半(命中格 y=26)同样定位下半 —— 桩世界翻到开态再点 */
  world['40,25,40'] = api.B_DOOR_OPEN; world['40,26,40'] = api.B_DOOR_TOP_OPEN;
  const plan2 = Core.advDoorTogglePlan(rd, api.B_DOOR_TOP_OPEN, P, 40, 26, 40);
  assert.strictEqual(plan2.open, false, '开门 → 关');
  assert.deepStrictEqual(plan2.writes.map((w) => w.id), [api.B_DOOR, api.B_DOOR_TOP], '开 → 关(点上半同款)');
  /* 玩家站门洞: 拒关不拒开 */
  const Pin = {x: 40.5, y: 25, z: 40.5};
  world['40,25,40'] = api.B_DOOR_OPEN; world['40,26,40'] = api.B_DOOR_TOP_OPEN;
  assert.deepStrictEqual(Core.advDoorTogglePlan(rd, api.B_DOOR_OPEN, Pin, 40, 25, 40),
      {ok: false, reason: 'occupied'}, '关门有人 → 拒');
  assert.strictEqual(Core.advDoorTogglePlan(rd, api.B_DOOR_OPEN, Pin, 40, 25, 40).reason, 'occupied');
  world['40,25,40'] = api.B_DOOR; world['40,26,40'] = api.B_DOOR_TOP;
  assert.strictEqual(Core.advDoorTogglePlan(rd, api.B_DOOR, Pin, 40, 25, 40).ok, true, '开门不查人');
  /* 半扇残门(上半在下半不在): 无从开关 */
  world['40,25,40'] = 0;
  assert.deepStrictEqual(Core.advDoorTogglePlan(rd, api.B_DOOR_TOP, P, 40, 26, 40),
      {ok: false, reason: 'half'}, '下半缺失 → half');
});

test('advDoorTogglePlan: 双开耦合(2026-10-28) — 相邻同状态门随动同开同关 · 随动列占位拒关 · 异态不耦合', () => {
  const world = {};
  const rd = (x, y, z) => (world[x + ',' + y + ',' + z] || 0);
  const P = {x: 10.5, y: 25, z: 10.5};
  /* 两扇并排(40/41 列)全关: 点左扇 → 两扇四格一起开 */
  world['40,25,40'] = api.B_DOOR; world['40,26,40'] = api.B_DOOR_TOP;
  world['41,25,40'] = api.B_DOOR; world['41,26,40'] = api.B_DOOR_TOP;
  const plan = Core.advDoorTogglePlan(rd, api.B_DOOR, P, 40, 25, 40);
  assert.strictEqual(plan.ok, true);
  assert.deepStrictEqual(plan.writes.map((w) => [w.x, w.y, w.z, w.id]), [
    [40, 25, 40, api.B_DOOR_OPEN], [40, 26, 40, api.B_DOOR_TOP_OPEN],
    [41, 25, 40, api.B_DOOR_OPEN], [41, 26, 40, api.B_DOOR_TOP_OPEN],
  ], '双开随动: 四格成对换开态(本列在前, 随动列在后)');
  /* 全开态点右扇 → 两扇一起关(随动列=西邻) */
  world['40,25,40'] = api.B_DOOR_OPEN; world['40,26,40'] = api.B_DOOR_TOP_OPEN;
  world['41,25,40'] = api.B_DOOR_OPEN; world['41,26,40'] = api.B_DOOR_TOP_OPEN;
  const plan2 = Core.advDoorTogglePlan(rd, api.B_DOOR_OPEN, P, 41, 25, 40);
  assert.strictEqual(plan2.open, false);
  assert.deepStrictEqual(plan2.writes.map((w) => [w.x, w.y, w.z, w.id]), [
    [41, 25, 40, api.B_DOOR], [41, 26, 40, api.B_DOOR_TOP],
    [40, 25, 40, api.B_DOOR], [40, 26, 40, api.B_DOOR_TOP],
  ], '双开随动: 四格成对换关态');
  /* 玩家站右扇门洞点左扇关门 → 拒(随动列占位同查) */
  const Pin = {x: 41.5, y: 25, z: 40.5};
  assert.strictEqual(
      Core.advDoorTogglePlan(rd, api.B_DOOR_OPEN, Pin, 40, 25, 40).reason, 'occupied',
      '随动列有人 → 拒关');
  /* 异态不耦合: 左开右关, 点左扇只动左扇 */
  world['40,25,40'] = api.B_DOOR_OPEN; world['40,26,40'] = api.B_DOOR_TOP_OPEN;
  world['41,25,40'] = api.B_DOOR; world['41,26,40'] = api.B_DOOR_TOP;
  const plan3 = Core.advDoorTogglePlan(rd, api.B_DOOR_OPEN, P, 40, 25, 40);
  assert.deepStrictEqual(plan3.writes.map((w) => w.x), [40, 40], '异态邻居不随动');
  /* 单扇无邻居: 只有两格(既有口径零变化) */
  world['41,25,40'] = 0; world['41,26,40'] = 0;
  const plan4 = Core.advDoorTogglePlan(rd, api.B_DOOR_OPEN, P, 40, 25, 40);
  assert.strictEqual(plan4.writes.length, 2, '单扇不耦合');
});

test('advDoorBreakPlan: 挖下连上/挖上连下/挖门下支撑整扇弹出 · drop 恒 1 · 空格过滤', () => {
  const world = {};
  const rd = (x, y, z) => (world[x + ',' + y + ',' + z] || 0);
  /* 挖掉下半(y 已清 0): 收上半 */
  world['1,26,1'] = api.B_DOOR_TOP;
  assert.deepStrictEqual(Core.advDoorBreakPlan(rd, 1, 25, 1),
      {cells: [{x: 1, y: 26, z: 1}], drop: 1}, '挖下半 → 收上半, 掉 1');
  /* 挖掉上半: 连下半整扇回收 */
  world['1,26,1'] = 0; world['1,24,1'] = api.B_DOOR;
  assert.deepStrictEqual(Core.advDoorBreakPlan(rd, 1, 25, 1),
      {cells: [{x: 1, y: 24, z: 1}], drop: 1}, '挖上半 → 连下半, 掉 1');
  /* 挖门正下方支撑: 整扇弹出(下半+上半) */
  world['1,24,1'] = 0; world['2,26,2'] = api.B_DOOR_OPEN; world['2,27,2'] = api.B_DOOR_TOP_OPEN;
  assert.deepStrictEqual(Core.advDoorBreakPlan(rd, 2, 25, 2),
      {cells: [{x: 2, y: 26, z: 2}, {x: 2, y: 27, z: 2}], drop: 1}, '挖支撑 → 整扇弹出(开门态同款)');
  /* 上半残留缺失时不产出空格(防空 editBlock) */
  world['2,27,2'] = 0;
  assert.deepStrictEqual(Core.advDoorBreakPlan(rd, 2, 25, 2),
      {cells: [{x: 2, y: 26, z: 2}], drop: 1}, '上格已空 → 只收现存半扇');
  /* 普通方块: 无门牵连 */
  assert.deepStrictEqual(Core.advDoorBreakPlan(rd, 9, 25, 9), {cells: [], drop: 0}, '无关方块零牵连');
});

/* ============ 门号段存档迁移(2026-10-28 关门能穿/开门挡路根因修复) ============ */

test('advDoorIdsMigrate: 旧档(63 铁证)三代档形全移位 63~67→+1, 窗外 id 原样', () => {
  /* 一代老档: 裸 edits 数组(关门 63/64 + 开门 65/66 + 玻璃板 67 + 窗外对照) */
  const g1 = {edits: [['1,24,1', 63], ['2,24,2', 64], ['3,25,3', 65], ['4,25,4', 66],
    ['5,25,5', 67], ['6,25,6', 35], ['7,25,7', 0], ['8,25,8', {id: 24, lv: 2}]]};
  Core.advDoorIdsMigrate(g1);
  assert.deepStrictEqual(g1.edits.map((e) => e[1]),
      [64, 65, 66, 67, 68, 35, 0, {id: 24, lv: 2}], '门段 +1, 熄门/空气/流体不动');
  /* 现行分桶对象 + 二代顶层 netherEdits 同迁 */
  const g2 = {edits: {home: [['1,24,1', 63]], desert: [['9,24,9', 67]], nether: []},
    netherEdits: [['2,20,2', 63]]};
  Core.advDoorIdsMigrate(g2);
  assert.strictEqual(g2.edits.home[0][1], 64, 'home 桶移位');
  assert.strictEqual(g2.edits.desert[0][1], 68, '远征图桶移位');
  assert.strictEqual(g2.netherEdits[0][1], 64, '二代顶层 nether 账移位');
  /* 流体格 {id,lv} 形状窗口内兜底(窗口内本无流体, 形状对齐 fluidCell) */
  const g3 = {edits: [['1,24,1', {id: 63, lv: 2}]]};
  Core.advDoorIdsMigrate(g3);
  assert.deepStrictEqual(g3.edits[0][1], {id: 64, lv: 2}, '流体格形状同移');
});

test('advDoorIdsMigrate: 新档(64~68 合法在档, 无 63)不误移', () => {
  const fresh = {edits: {home: [['1,24,1', 64], ['2,24,2', 65], ['3,25,3', 66],
    ['4,25,4', 67], ['5,25,5', 68]]}};
  const before = JSON.stringify(fresh);
  Core.advDoorIdsMigrate(fresh);
  assert.strictEqual(JSON.stringify(fresh), before, '无 63 → 原样(盲移会把现行门 id 推错一段)');
});

test('advDoorIdsMigrate: 幂等 —— 移位后 63 清零, 二次调用不再触发', () => {
  const sv = {edits: [['1,24,1', 63], ['2,24,2', 66]]};
  Core.advDoorIdsMigrate(sv);
  assert.deepStrictEqual(sv.edits.map((e) => e[1]), [64, 67], '首次移位');
  const once = JSON.stringify(sv);
  Core.advDoorIdsMigrate(sv);
  assert.strictEqual(JSON.stringify(sv), once, '二次调用原样(落盘 _v:2 后同款不再进链)');
});

test('advDoorIdsStale: 63 出现任一账本即旧档; 异形/空档与开门-only 保守不触发', () => {
  assert.strictEqual(Core.advDoorIdsStale({edits: [['1,24,1', 63]]}), true, '一代裸数组');
  assert.strictEqual(Core.advDoorIdsStale({edits: {nether: [['1,20,1', 63]]}, netherEdits: []}), true, '分桶对象');
  assert.strictEqual(Core.advDoorIdsStale({edits: [['1,24,1', 65], ['2,24,2', 66]]}), false,
      '开门-only 旧档无 63: 宁漏移不误移(已知局限, 注释即契约)');
  assert.strictEqual(Core.advDoorIdsStale(null), false, '空档不抛');
  assert.strictEqual(Core.advDoorIdsStale({}), false, '半形档不抛');
});

test('迁移接线源文本守门: advWorldSlot schema version:2 + migrate 链挂 advDoorIdsMigrate', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'modes', 'adventure.js'), 'utf8');
  const i = src.indexOf('SyncDB.slot(ADV_WORLD_KEY');
  assert.ok(i >= 0, '世界档槽在档');
  const head = src.slice(i, i + 1200);
  assert.ok(/version: 2/.test(head), 'schema version 2 漂移即红(门号段迁移锚点)');
  assert.ok(/from >= 1 \? advDoorIdsMigrate\(s\) : s/.test(head),
      'migrate 链挂 advDoorIdsMigrate(v0 无操作)漂移即红');
});

/* ============ 农田链判定与配方解锁(farm-and-recipe 设计稿 D2/D3) ============ */

test('农田四判定: 锄(草地/泥土+上方空)/种(耕地+上方空)/长(42→43→44→45→0)/催(0~2 阶)', () => {
  /* 锄地: 草地(1)/泥土(2)可垦, 上方有块不可(播种位), 耕地/石头不可再锄 */
  assert.strictEqual(Core.advHoeOk(1, 0), true, '草地可垦');
  assert.strictEqual(Core.advHoeOk(2, 0), true, '泥土可垦');
  assert.strictEqual(Core.advHoeOk(1, api.B_WHEAT_0), false, '上方有块不可垦(播种位被占)');
  assert.strictEqual(Core.advHoeOk(api.B_FARMLAND, 0), false, '耕地不可再锄');
  assert.strictEqual(Core.advHoeOk(3, 0), false, '石头不可垦');
  /* 播种: 只认耕地且上方空 */
  assert.strictEqual(Core.advPlantOk(api.B_FARMLAND, 0), true, '耕地可播');
  assert.strictEqual(Core.advPlantOk(api.B_FARMLAND, api.B_WHEAT_0), false, '已有苗不可再播');
  assert.strictEqual(Core.advPlantOk(1, 0), false, '草地不可直播(两步正典: 先锄后种)');
  /* 生长: 阶段线性推进, 成熟/非麦格无下一步 */
  assert.strictEqual(Core.advWheatNext(api.B_WHEAT_0), api.B_WHEAT_1, '麦苗0→1');
  assert.strictEqual(Core.advWheatNext(api.B_WHEAT_1), api.B_WHEAT_2, '麦苗1→2');
  assert.strictEqual(Core.advWheatNext(api.B_WHEAT_2), api.B_WHEAT_3, '麦苗2→熟');
  assert.strictEqual(Core.advWheatNext(api.B_WHEAT_3), 0, '成熟无下一步');
  assert.strictEqual(Core.advWheatNext(0), 0, '空气无下一步');
  /* 催熟: 未熟三阶可催, 成熟/空气不可 */
  assert.strictEqual(Core.advRipenOk(api.B_WHEAT_0), true, '0 阶可催');
  assert.strictEqual(Core.advRipenOk(api.B_WHEAT_2), true, '2 阶可催');
  assert.strictEqual(Core.advRipenOk(api.B_WHEAT_3), false, '成熟不可催');
  assert.strictEqual(Core.advRipenOk(0), false, '空气不可催');
  assert.strictEqual(Core.ADV_WHEAT_GROW, 20, '每阶段 20s(D7, 与树苗同拍)');
});

test('配方解锁表(D2): 三谓词读 counts 记账键, 键序稳定, 差集只报新鲜达成', () => {
  assert.deepStrictEqual(Core.advUnlockedRecipes({}), [], '零计数全锁');
  assert.deepStrictEqual(Core.advUnlockedRecipes({collect_wheat: 1}), ['bread'], '首收小麦解锁面包');
  assert.deepStrictEqual(Core.advUnlockedRecipes({kill_skeleton: 1}), ['bone_meal'], '首杀骷髅解锁骨粉');
  assert.deepStrictEqual(Core.advUnlockedRecipes({kill_spider: 2}), ['bow_item'], '杀蜘蛛(≥1)解锁弓');
  assert.deepStrictEqual(Core.advUnlockedRecipes({collect_wheat: 3, kill_skeleton: 1, kill_spider: 1}),
      ['bread', 'bone_meal', 'bow_item'], '全达成按表序全开(键序稳定)');
  /* 差集: now 有 prev 无才报; prev 全有报空(防重复播报) */
  assert.deepStrictEqual(Core.advRecipeUnlockedNew([], {collect_wheat: 1}), ['bread'], '无到有报新');
  assert.deepStrictEqual(
      Core.advRecipeUnlockedNew(['bread'], {collect_wheat: 1, kill_skeleton: 1}),
      ['bone_meal'], '增量只报未播过的');
  assert.deepStrictEqual(Core.advRecipeUnlockedNew(['bread', 'bone_meal', 'bow_item'],
      {collect_wheat: 1, kill_skeleton: 1, kill_spider: 1}), [], '已播过不再报');
});


/* ============ 生态恢复(docs/eco-recovery-design.md, ADR 0006) ============ */

test('生态恢复·矿位白名单: advBuildWorld 逐位记录 + 两次建场同清单 + 只收四矿', () => {
  Core.advOreSpotsReset();
  Core.advBuildWorld();
  const key = (s) => s.x + ',' + s.y + ',' + s.z + ':' + s.id;
  const a = Core.advOreSpots.map(key).sort().join('|');
  assert.ok(Core.advOreSpots.length > 100, '矿位应上千级(主矿带+坑壁+洞壁+固定钻)');
  for (const s of Core.advOreSpots) {
    assert.ok(Core.advIsOre(s.id), '白名单只收四矿');
  }
  Core.advOreSpotsReset();
  Core.advBuildWorld();
  const b = Core.advOreSpots.map(key).sort().join('|');
  assert.strictEqual(a, b, '同 seed 同清单(确定性零漂移)');
});

test('生态恢复·矿位账键: advOreKey/advOreParseKey 往返 + 坏键拒收', () => {
  const k = Core.advOreKey('home', 12, 34, 56);
  assert.strictEqual(k, 'home:12,34,56');
  assert.deepStrictEqual(Core.advOreParseKey(k), {scene: 'home', x: 12, y: 34, z: 56});
  assert.strictEqual(Core.advOreParseKey('nether:1,2,3').scene, 'nether', '界键同构');
  assert.strictEqual(Core.advOreParseKey('bad-key'), null, '无冒号拒收');
  assert.strictEqual(Core.advOreParseKey('home:1,2'), null, '段数不足拒收');
  assert.strictEqual(Core.advOreParseKey('home:a,b,c'), null, '非整数拒收');
});

test('生态恢复·矿位回填: 跨天到期 + 空气才回填(被占销账=玩家改建永久优先)', () => {
  assert.strictEqual(Core.advOreDue(5, 6), true, '昨日 < 今日 = 到期(序数比较)');
  assert.strictEqual(Core.advOreDue(6, 6), false, '当日不回填(跨天拍板)');
  assert.strictEqual(Core.advOreDue(7, 6), false, '未来序数不到期');
  const read = (x) => {
    if (x === 1) return 0; /* 空气 → 回填 */
    if (x === 2) return 6; /* 木板(玩家改建) → 销账 */
    return 3; /* 石头(未挖) → 销账 */
  };
  const plan = Core.advOreRefillPlan([
    {scene: 'home', x: 1, y: 2, z: 3},
    {scene: 'home', x: 2, y: 2, z: 3},
    {scene: 'home', x: 3, y: 2, z: 3},
  ], read);
  assert.deepStrictEqual(plan.fill, [{scene: 'home', x: 1, y: 2, z: 3}], '只回填空气位');
  assert.deepStrictEqual(plan.drop.map((e) => e.x).sort(), [2, 3], '被占位销账');
});

test('生态恢复·树位占位预检: 拒绝式逐条 + 四角不算 + replaceable 放行', () => {
  const G = 10; /* 树位基面 y */
  const mkRead = (overrides) => (x, y, z) => {
    const k = x + ',' + y + ',' + z;
    if (overrides[k] !== undefined) return overrides[k];
    if (y === G - 1) return 1; /* 默认草地基底 */
    return 0; /* 默认空气 */
  };
  assert.strictEqual(Core.advTreeSpotOpen(5, G, 5, mkRead({})), true, '空旷草地可长');
  assert.strictEqual(Core.advTreeSpotOpen(5, G, 5, mkRead({'5,9,5': 8})), false, '基底非草地/泥土拒');
  assert.strictEqual(Core.advTreeSpotOpen(5, G, 5, mkRead({['5,' + (G + 2) + ',5']: 6})), false, '树干柱被木板挡拒');
  assert.strictEqual(Core.advTreeSpotOpen(5, G, 5, mkRead({['7,' + (G + 3) + ',5']: 6})), false, '冠层主环被挡拒');
  assert.strictEqual(Core.advTreeSpotOpen(5, G, 5, mkRead({['7,' + (G + 3) + ',7']: 6})),
      true, '主环四角不算(SceneKit.tree 同款)');
  assert.strictEqual(Core.advTreeSpotOpen(5, G, 5, mkRead({['6,' + (G + 6) + ',5']: 6})), false, '冠层小环被挡拒');
  assert.strictEqual(Core.advTreeSpotOpen(5, G, 5,
      mkRead({['5,' + (G + 1) + ',5']: api.B_GRASS_TUFT})), true, '草丛=replaceable 放行(树长过草丛)');
  assert.strictEqual(Core.advTreeSpotOpen(5, G, 5,
      mkRead({['5,' + (G + 1) + ',5']: api.B_SAPLING})), true, '树苗=replaceable 放行(补种同位不冲突)');
});

test('生态恢复·凋零树位派生: 基格无原木=凋零, 有原木=在位', () => {
  const spots = [{x: 3, z: 3}, {x: 7, z: 3}];
  const heightAt = () => 0;
  const read = (x, y) => (x === 3 && y === 11 ? 5 : 0); /* (3,11) 有原木(groundY10+1) */
  assert.deepStrictEqual(Core.advTreeRegenSpots(spots, 10, heightAt, read),
      [{x: 7, y: 11, z: 3}], '只有无原木的位进凋零清单');
});

test('生态恢复·牧场档形归一: 四代档形收敛 + 坏条目丢弃 + 剪毛账(v3)', () => {
  assert.deepStrictEqual(Core.advLivestockNormBucket([1, 2]), {dead: [1, 2], bred: [], sheared: {}},
      '二代索引数组');
  assert.deepStrictEqual(Core.advLivestockNormBucket({dead: [3], bred: [{k: 'cow', b: '2026-10-28'}]}),
      {dead: [3], bred: [{k: 'cow', b: '2026-10-28'}], sheared: {}}, 'v2 桶 → sheared 空');
  assert.deepStrictEqual(
      Core.advLivestockNormBucket({dead: [3], bred: [{k: 'cow', b: '2026-10-28', sheared: 5000}],
        sheared: {'2': 12000}}),
      {dead: [3], bred: [{k: 'cow', b: '2026-10-28', sheared: 5000}], sheared: {'2': 12000}},
      'v3 桶原样拷贝(初始畜+繁育畜剪毛时刻两处都收)');
  assert.deepStrictEqual(Core.advLivestockNormBucket({dead: [3], bred: [{k: 'cow'}, 'x', null, {k: 'pig', b: 5}]}),
      {dead: [3], bred: [], sheared: {}}, '异形 bred 条目整条丢弃');
  assert.deepStrictEqual(Core.advLivestockNormBucket(null), {dead: [], bred: [], sheared: {}}, '坏档兜底空');
  assert.deepStrictEqual(Core.advLivestockNormBucket(undefined), {dead: [], bred: [], sheared: {}}, '缺桶兜底空');
  /* 剪毛账归一: 只收数字索引键 × 有限数值, 异形键值整条丢 */
  assert.deepStrictEqual(Core.advShearedNorm({'2': 5000, '10': 0}), {'2': 5000, '10': 0}, '合法账拷贝');
  assert.deepStrictEqual(Core.advShearedNorm({'x': 1, '1.5': 2, '3': 'l', '4': NaN, '5': Infinity}),
      {}, '异形键值全丢(非数字键/非有限值)');
  assert.deepStrictEqual(Core.advShearedNorm(null), {}, '坏档兜底空');
  /* bred 条目 sheared 字段: 非有限数值剥除(回落有毛), 合法数值保留 */
  assert.deepStrictEqual(Core.advBredNorm([{k: 'sheep', b: '2026-10-28', sheared: 777}]),
      [{k: 'sheep', b: '2026-10-28', sheared: 777}], '合法剪毛字段保留');
  assert.deepStrictEqual(Core.advBredNorm([{k: 'sheep', b: '2026-10-28', sheared: 'x'}]),
      [{k: 'sheep', b: '2026-10-28'}], '坏剪毛字段剥除');
  assert.deepStrictEqual(Core.advBredNorm([{k: 'sheep', b: '2026-10-28'}]),
      [{k: 'sheep', b: '2026-10-28'}], '无剪毛字段形状不变(v2 兼容)');
});

test('生态恢复·繁育判据: 同种成年邻近, 冷却/幼崽/超距/异种拒绝', () => {
  const ok = {type: 'cow', baby: false, cd: 0};
  assert.strictEqual(Core.advBreedPairOk(ok, {type: 'cow', baby: false, cd: 0}, 3), true, '基准配对');
  assert.strictEqual(Core.advBreedPairOk(ok, {type: 'pig', baby: false, cd: 0}, 3), false, '异种拒');
  assert.strictEqual(Core.advBreedPairOk(ok, {type: 'cow', baby: true, cd: 0}, 3), false, '幼崽不配对');
  assert.strictEqual(Core.advBreedPairOk(ok, {type: 'cow', baby: false, cd: 5}, 3), false, '冷却中不配对');
  assert.strictEqual(Core.advBreedPairOk({type: 'cow', baby: false, cd: 9},
      {type: 'cow', baby: false, cd: 0}, 3), false, '己方冷却同拒');
  assert.strictEqual(Core.advBreedPairOk(ok, {type: 'cow', baby: false, cd: 0}, 4.1), false, '超距拒(≤4)');
});

test('生态恢复·幼崽成年判: 跨天成年(序数), 坏序数兜底成年', () => {
  assert.strictEqual(Core.advBabyAdult(20700, 20700), false, '当日=仍幼崽');
  assert.strictEqual(Core.advBabyAdult(20699, 20700), true, '昨日=成年');
  assert.strictEqual(Core.advBabyAdult(20701, 20700), true, '未来序数=成年兜底');
});

test('生态恢复·繁育归群: kind→群号(重播落位锚点)', () => {
  assert.strictEqual(Core.advBreedHerdOf('cow'), 0);
  assert.strictEqual(Core.advBreedHerdOf('sheep'), 0);
  assert.strictEqual(Core.advBreedHerdOf('pig'), 1);
  assert.strictEqual(Core.advBreedHerdOf('chicken'), 1);
  assert.strictEqual(Core.advBreedHerdOf('zombie'), 0, '查无回落 0');
});
