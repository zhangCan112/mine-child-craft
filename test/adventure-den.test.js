'use strict';
/* 怪物巢穴副本 (js/adventure-core.js 黑巢/巢穴副本段, docs/den-nest-design.md) 单测
   运行: node --test test/adventure-den.test.js
   独立文件先例(nether-merge D16): 不塞 160KB 的 adventure-mode.test.js。
   真引擎件 vm 装载(adventure-core.test 同款惯例)直测: 黑巢建场(巨丘/洞道/
   巢厅/巢之心) · 副本建场确定性(岩体掏厅/祭坛/回程门/矿藏廊/宝箱室) ·
   副本刷怪纯函数(节拍/配额/光照门/掷点/取种) · 夜袭涌出节拍(夜门/概率/
   配额/池)。壳层装配(切界/入口站桩/HUD/分桶)由 boot 冒烟与 adventure-mode/
   adventure-nether 行为断言兜底。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 真引擎件: config + mob-registry + daylight + voxel + scene-kit + 四纯核心/库 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, SceneKit, Daylight, BLOCKS,
  WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT, B_BED, B_BED_FOOT,
  B_FARMLAND, B_WHEAT_3, B_FLOWER_Y, B_FLOWER_W,
  B_SNOW, B_SANDSTONE, B_GLOWSTONE, B_CHEST,
  B_SPAWNER, B_OBSIDIAN, B_PORTAL, B_NETHER_BRICK,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */

const Core = require('../js/adventure-core.js');

const W = api.WORLD_W;
const D = api.WORLD_D;
const cell = (x, y, z) => vm.runInContext('worldCells', eng)[(y * D + z) * W + x];
/* colTop: 天空往下第一个非空格(入口剖面/站位断言用, 站位=顶+1) */
const colTop = (x, z) => {
  let top = -1;
  for (let y = api.WORLD_H - 1; y >= 0; y--) {
    if (cell(x, y, z) !== 0) {
      top = y;
      break;
    }
  }
  return top;
};
const snapshot = () => Buffer.from(vm.runInContext('worldCells', eng));
const clearWorld = () => vm.runInContext('worldCells.fill(0)', eng);
const DN = Core.ADV_NESTS[3]; /* 黑巢行(巢之心坐标派生锚) */
const DEN = Core.ADV_DEN;

/* ============ 主世界 · 黑巢建场 ============ */

test('黑巢建场: 巢厅/巢之心/发光岩落位 + 洞道向南深潜连通(山洞同款 1 格级)', () => {
  clearWorld();
  Core.advBuildWorld();
  const coreX = DN.x; const coreZ = DN.z + 19;
  assert.strictEqual(cell(coreX, 8, coreZ), api.B_SPAWNER, '巢厅中央巢之心(副本入口锚, 壳 advDenCore 同源)');
  assert.strictEqual(cell(coreX, 7, coreZ), 3, '巢之心立在厅地板上(凸格)');
  assert.strictEqual(cell(coreX, 10, coreZ), 0, '巢厅净空(腔 y8~11)');
  assert.strictEqual(cell(coreX - 3, 8, DN.z + 21), api.B_GLOWSTONE, '角落发光岩微光路标');
  /* 洞道连通抽样: 洞身 4 高(y..y+3), 每步 z+1·y-1向南(i=0..11: z13..24, y23..12) */
  for (const i of [0, 5, 11]) {
    const z = DN.z + 5 + i; const y = 23 - i;
    assert.strictEqual(cell(DN.x, y, z), 0, '洞道格 ' + i + ' 掏空(z' + z + ' y' + y + ')');
    assert.strictEqual(cell(DN.x, y - 1, z), 3, '洞道垫底防漏(z' + z + ')');
  }
  assert.strictEqual(cell(DN.x - 1, 24, DN.z + 5), 0, '南敞廊翻进洞口不用挖(与山洞同款)');
  /* 进厅台阶(1 格级, 上得来): i=12..15 → z25..28, y11..8 */
  for (const i of [12, 15]) {
    const z = DN.z + 5 + i; const y = 23 - i;
    assert.strictEqual(cell(DN.x, y, z), 0, '进厅台阶步 ' + i + ' 掏空(z' + z + ' y' + y + ')');
  }
  /* 巨丘地表预告: 黑曜石斑在丘体(挖不得的黑石质感) + 丘顶高出地表 */
  let obs = 0;
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      if (Math.hypot(dx, dz) > 5) continue;
      if (cell(DN.x + dx, 26, DN.z + dz) === api.B_OBSIDIAN) obs++;
    }
  }
  assert.ok(obs > 0, '丘体黑曜石斑(危险预告, 不用煤矿——矿带全图红线)');
});

test('黑巢入口动线·南口: 台阶回填后剖面 1 格级(x99/x100 双列, 涌出点列不困人)', () => {
  clearWorld();
  Core.advBuildWorld();
  /* 洞口步 z+5 站 23 → 回填 z+6 站 23(平走) → 回填 z+7 站 24 → 南侧草皮 z+8 站 25 */
  const stands = (x) => [5, 6, 7, 8].map((dz) => colTop(x, DN.z + dz) + 1);
  assert.deepStrictEqual(stands(DN.x - 1), [23, 23, 24, 25],
      'x99 剖面(洞口步/回填/回填/草皮)——修前 z+6/z+7 站 22/21 是 4 格壕沟');
  assert.deepStrictEqual(stands(DN.x), [23, 23, 24, 25],
      'x100 剖面(夜袭涌出点列)全程 1 格级, 出洞口爬得回来');
  for (const x of [DN.x - 1, DN.x]) {
    for (const yy of [21, 22, 23]) {
      assert.strictEqual(cell(x, yy, DN.z + 7), 3, '南口台阶回填非空 (' + x + ',' + yy + ',' + (DN.z + 7) + ')');
    }
    assert.strictEqual(cell(x, 22, DN.z + 6), 3, '南口中步回填非空 (' + x + ',22,' + (DN.z + 6) + ')');
  }
});

test('黑巢入口动线·进厅: 台阶铺在洞道→厅动线上(垫底不被厅腔掏空, 全程 1 格级)', () => {
  clearWorld();
  Core.advBuildWorld();
  /* 踏面垫底链: z+16 y11(站12) → z+17 y10(站11) → z+18 y9(站10) → z+19 y8(站9) →
     厅地板 y7(站8)——每步降 1 格(修前台阶铺错层 35-i + 厅腔掏垫底 = 4 格落差坠厅) */
  for (const [dz, yy] of [[16, 11], [17, 10], [18, 9]]) {
    assert.strictEqual(cell(DN.x, yy, DN.z + dz), 3,
        '进厅踏面非空 (' + DN.x + ',' + yy + ',' + (DN.z + dz) + ')');
  }
  assert.strictEqual(cell(DN.x - 1, 8, DN.z + 19), 3, '末块踏面 x99');
  /* 净空: 每级踏面上方一格是掏空腔, 玩家站得进(台阶 carve y..y+3 与厅腔叠加) */
  assert.strictEqual(cell(DN.x, 12, DN.z + 16), 0, '洞道末步净空');
  assert.strictEqual(cell(DN.x, 11, DN.z + 17), 0, '首步净空');
  assert.strictEqual(cell(DN.x, 10, DN.z + 18), 0, '中步净空');
  assert.strictEqual(cell(DN.x, 9, DN.z + 19), 0, '末块净空(腔第一层)');
  assert.strictEqual(cell(DN.x, 8, DN.z + 19), api.B_SPAWNER,
      '巢之心仍在末块踏面上(副本判定锚与动线末块同格, 绕行必经)');
});

test('黑巢门口刷怪池: den 行进 ADV_NESTS(巢穴机制照跑) + 池主打洞穴蜘蛛', () => {
  assert.strictEqual(DN.den, true, 'den 旗标(advBuildWorld 分派 advBuildDenNest)');
  assert.deepStrictEqual(DN.kinds, ['cave_spider', 'zombie', 'skeleton'],
      '黑巢池主打 cave_spider(唯一产地, den-nest D7)');
});

/* ============ 副本 · advDenBuild ============ */

test('副本建场: 全图确定性(两次生成逐字节一致, 确定性重放红线)', () => {
  clearWorld();
  Core.advDenBuild();
  const a = snapshot();
  clearWorld();
  Core.advDenBuild();
  assert.deepStrictEqual(a, snapshot(), '两次建场 worldCells 逐块一致');
});

test('副本结构: 大厅净空+地面/祭坛巢之心+黑曜石柱/穹顶遮天/回程裂隙门', () => {
  clearWorld();
  Core.advDenBuild();
  /* 大厅: 地面层实心、净空到穹顶渐降(中央 y38) */
  assert.notStrictEqual(cell(DEN.hall.cx, DEN.ground, DEN.hall.cz), 0, '厅心地面实心(苔石/泥混铺)');
  assert.strictEqual(cell(DEN.altar.x - 1, DEN.ground + 1, DEN.altar.z - 1), 14, '祭坛 3×3 苔石台(角格)');
  assert.strictEqual(cell(DEN.altar.x, DEN.ground + 1, DEN.altar.z), api.B_SPAWNER, '祭坛中央巢之心(副本刷怪锚)');
  assert.strictEqual(cell(DEN.altar.x - 1, DEN.ground + 3, DEN.altar.z - 1), api.B_OBSIDIAN, '四角黑曜石柱');
  assert.strictEqual(cell(DEN.altar.x - 1, DEN.ground + 6, DEN.altar.z - 1), api.B_GLOWSTONE, '柱顶发光岩');
  assert.strictEqual(cell(DEN.hall.cx, 30, DEN.hall.cz), 0, '大厅净空(穹顶下)');
  assert.strictEqual(cell(DEN.hall.cx, DEN.roof, DEN.hall.cz + DEN.hall.r + 3), 3, '厅外岩体到穹顶全实心');
  assert.strictEqual(cell(DEN.hall.cx, DEN.roof + 2, DEN.hall.cz), 0, '穹顶壳上方空气(世界顶)');
  /* 回程裂隙门(基座常亮, 不记账): 内口门面 B_PORTAL(复用 advPortalFrame) */
  assert.strictEqual(cell(DEN.gate.px + 2, DEN.ground + 1, DEN.gate.pz), api.B_PORTAL, '回程门内口门面(advInPortal 判据)');
  assert.strictEqual(cell(DEN.gate.px, DEN.ground + 3, DEN.gate.pz), api.B_OBSIDIAN, '回程门黑曜石侧柱(中段)');
  assert.strictEqual(cell(DEN.gate.px, DEN.ground + 1, DEN.gate.pz), api.B_GLOWSTONE, '开口四角发光岩(门框原版口径)');
});

test('副本矿藏廊: 走廊连通 + 两矿腔分矿种镶矿 + 宝箱室(任务键同源坐标)', () => {
  clearWorld();
  Core.advDenBuild();
  /* 东墙洞口+走廊连通大厅与矿腔区(x 92..112, z 79..81 净空) */
  assert.strictEqual(cell(DEN.hall.cx + DEN.hall.r, DEN.ground + 2, DEN.altar.z), 0, '东墙洞口');
  assert.strictEqual(cell(105, DEN.ground + 2, DEN.altar.z), 0, '走廊中段');
  /* 腔 A(煤铁, 走廊北)与腔 B(金钻, 走廊南): 腔内净空 + 门洞连通 */
  assert.strictEqual(cell(102, DEN.ground + 2, 74), 0, '矿腔 A 腔内');
  assert.strictEqual(cell(102, DEN.ground + 2, 86), 0, '矿腔 B 腔内');
  assert.strictEqual(cell(101, DEN.ground + 2, 77), 0, '腔 A 门洞(穿墙接走廊)');
  assert.strictEqual(cell(101, DEN.ground + 2, 83), 0, '腔 B 门洞');
  /* 分矿种: 腔 A 壁只有煤/铁、腔 B 壁只有金/钻(镶矿走 advTryOre=白名单, 回填生效) */
  const counts = {};
  for (let x = 96; x <= 110; x++) {
    for (let z = 69; z <= 91; z++) {
      for (let y = DEN.ground + 1; y <= DEN.ground + 5; y++) {
        const id = cell(x, y, z);
        if (id === api.B_COAL_ORE || id === api.B_IRON_ORE || id === api.B_GOLD_ORE ||
            id === api.B_DIAMOND_ORE) counts[id] = (counts[id] || 0) + 1;
      }
    }
  }
  assert.ok((counts[api.B_COAL_ORE] || 0) > 0 && (counts[api.B_IRON_ORE] || 0) > 0, '腔 A 煤铁镶矿非零');
  assert.ok((counts[api.B_GOLD_ORE] || 0) > 0 && (counts[api.B_DIAMOND_ORE] || 0) > 0, '腔 B 金钻镶矿非零');
  /* 宝箱室: 宝箱坐标与 advMapChestKey 'den' 行同源(maps-core 消费 ADV_DEN.chest) */
  assert.strictEqual(cell(DEN.chest.x, DEN.chest.y, DEN.chest.z), api.B_CHEST, '宝箱室宝箱');
  assert.strictEqual(cell(DEN.chest.x - 2, DEN.ground + 1, DEN.chest.z - 2), api.B_TORCH, '室角落地站膛火把');
});

test('副本白名单: 矿腔镶矿进矿位账(跨天回填在副本同样生效)', () => {
  clearWorld();
  Core.advOreSpotsReset(); /* 壳层 advBuildScene 同款先清后建(白名单是建场期累积账) */
  Core.advDenBuild();
  assert.ok(Core.advOreSpots.length > 50, '副本镶矿逐位记账(advTryOre 白名单)');
  for (const s of Core.advOreSpots) {
    assert.strictEqual(cell(s.x, s.y, s.z), s.id, '白名单格与世界一致(' + s.x + ',' + s.y + ',' + s.z + ')');
  }
  Core.advOreSpotsReset(); /* 测试收尾清账(不泄漏给后续用例) */
});

/* ============ 副本刷怪纯函数 ============ */

test('副本刷怪: 节拍到拍出单/配额归零 · 光照门认方块光(火把圈=防刷怪圈)', () => {
  /* 节拍(advNestStep 同构): 未满累计 2.5s 出单; 满配额不刷且计时归零 */
  assert.deepStrictEqual(Core.advDenStep(0, 0, 1), {spawn: false, t: 1}, '未到拍只累计');
  assert.deepStrictEqual(Core.advDenStep(0, 2, 1), {spawn: true, t: 0}, '到拍出刷怪令并归零');
  assert.deepStrictEqual(Core.advDenStep(DEN.CAP, 2, 1), {spawn: false, t: 0}, '满配额不出单');
  /* 光照门: 只认双光(方块光 0 + 天空光 ≤7)——副本穹顶内天空光恒 0 天然过,
     火把半径 13 内方块光 ≥1 拒刷; 无时间维度(副本恒暗, 冻结 dayTime 不参与) */
  assert.strictEqual(Core.advDenCanSpawn(0, 0), true, '全黑可刷');
  assert.strictEqual(Core.advDenCanSpawn(7, 0), true, '天空光恰 7 过(≤7 边界)');
  assert.strictEqual(Core.advDenCanSpawn(8, 0), false, '天空光 8 拒刷(与主世界同门)');
  assert.strictEqual(Core.advDenCanSpawn(0, 1), false, '火把圈拒刷(教学与主世界一致)');
});

test('副本掷点/取种: 祭坛环带界内 + 池合法(主打 zombie, cave_spider 在池)', () => {
  for (let i = 0; i < 200; i++) {
    const s = Core.advDenSpot(Math.random);
    const d = Math.hypot(s.x - DEN.altar.x - 0.5, s.z - DEN.altar.z - 0.5);
    assert.ok(d >= DEN.RING_LO - 1e-9 && d <= DEN.RING_HI + 1e-9,
        '环带界内(RING_LO~RING_HI): ' + d.toFixed(2));
  }
  const picks = new Set();
  for (let i = 0; i < 500; i++) picks.add(Core.advDenPick(Math.random));
  const legal = new Set(DEN.POOL.map((p) => p[0]));
  for (const p of picks) assert.ok(legal.has(p), '取种不出池: ' + p);
  assert.ok(picks.size >= 3, '500 次取种覆盖多数池种(权重活签): ' + [...picks].join('/'));
});

/* ============ 夜袭涌出纯函数 ============ */

test('夜袭涌出: 夜门(白天归零) · 到拍掷概率 · 配额门 · 池合法(无苦力怕)', () => {
  const NIGHT = 15000; const DAY = 5000; /* isNight [13000,23000) */
  assert.deepStrictEqual(Core.advEruptStep(0, 1, DAY, 0, Math.random), {t: 0, spawn: null},
      '白天节拍器归零(涌出只在夜间)');
  assert.deepStrictEqual(Core.advEruptStep(0, 1, NIGHT, 0, Math.random), {t: 1, spawn: null},
      '夜间未到拍只累计');
  assert.deepStrictEqual(Core.advEruptStep(Core.ADV_ERUPT.TRY_S, 0, NIGHT, 0, () => 0.99),
      {t: 0, spawn: null}, '到拍掷概率不过(0.99 ≥ P)本拍作废');
  assert.strictEqual(Core.advEruptStep(Core.ADV_ERUPT.TRY_S, 0, NIGHT, 0, () => 0).spawn.type,
      'zombie', '到拍概率过+池首权重取种(浮点起点=zombie)');
  assert.deepStrictEqual(Core.advEruptStep(Core.ADV_ERUPT.TRY_S, 0, NIGHT, Core.ADV_ERUPT.QUOTA, () => 0),
      {t: 0, spawn: null}, '配额满本拍作废(涌出自持小配额, 不吃光环带名额)');
  const legal = new Set(Core.ADV_ERUPT.POOL.map((p) => p[0]));
  assert.ok(!legal.has('creeper'), '池无苦力怕(洞口贴脸爆炸对 6 岁是惊吓不是挑战)');
  for (let i = 0; i < 200; i++) {
    const r = Core.advEruptStep(Core.ADV_ERUPT.TRY_S, 0, NIGHT, 0, Math.random);
    if (r.spawn) assert.ok(legal.has(r.spawn.type), '涌出取种不出池: ' + r.spawn.type);
  }
});

test('副本常量: 落点/门位/宝箱在厅内且互不重叠(儿童可控的空间关系)', () => {
  const inHall = (x, z) => Math.hypot(x - DEN.hall.cx, z - DEN.hall.cz) <= DEN.hall.r;
  assert.ok(inHall(DEN.base.x, DEN.base.z), '进场落点在厅内');
  assert.ok(inHall(DEN.gate.px + 2, DEN.gate.pz), '回程门框在厅内(内口判定可达)');
  assert.ok(Math.hypot(DEN.base.x - DEN.altar.x, DEN.base.z - DEN.altar.z) >= 6,
      '落点离祭坛 ≥6 格(出生不贴脸, 巢穴环带同款思路)');
  assert.ok(DEN.chest.x > DEN.hall.cx + DEN.hall.r, '宝箱室在大厅以东(矿藏廊尽头, 探索动线)');
  assert.ok(DEN.CAP >= 1 && DEN.CAP <= 8, '副本配额儿童可控(独立小封顶, den-nest D7)');
});
