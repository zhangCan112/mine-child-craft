'use strict';
/* 怪物巢穴副本 单测: 黑巢 POI=js/adventure-core.js; 巢穴副本段=js/adventure-dims-core.js
   (维度规格核心, docs/den-nest-design.md §1-6 + §7 苦力怕主题改造)。
   运行: node --test test/adventure-den.test.js
   独立文件先例(nether-merge D16): 不塞 160KB 的 adventure-mode.test.js。
   真引擎件 vm 装载(adventure-core.test 同款惯例)直测: 黑巢建场(巨丘/洞道/
   巢厅/巢之心) · 副本建场确定性(岩体掏厅/七房/弯曲隧道/关底王座/深处祭坛) ·
   布防表(房腔/家锚/谱系分层) · 波次纯函数(清怪 10s 节拍/逐波变强封顶) ·
   夜袭涌出节拍(夜门/概率/配额/池)。壳层装配(切界/入口站桩/HUD/分桶/bomber
   引信 AI)由 boot 冒烟与 adventure-mode/adventure-nether 行为断言兜底。 */
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
  getBlock, setBlockRaw, SceneKit, Daylight, BLOCKS, breakTime, ITEMS,
  WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT, B_BED, B_BED_FOOT,
  B_FARMLAND, B_WHEAT_3, B_FLOWER_Y, B_FLOWER_W,
  B_SNOW, B_SANDSTONE, B_GLOWSTONE, B_CHEST,
  B_SPAWNER, B_OBSIDIAN, B_PORTAL, B_NETHER_BRICK, B_LOOT_CHEST,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */

/* 刷怪三件(候选 2): advDenStep 薄壳经全局名消费(波次环带掷点在 advDenWavePlan 内组装) */
Object.assign(globalThis, require('../js/adventure-spawn-core.js'));
const Core = require('../js/adventure-core.js');
Object.assign(globalThis, Core); /* 上一层共享词法(adventure-maps-core.test 同款惯例): dims-core 建场经全局名消费 advTryOre 等 */
const Dims = require('../js/adventure-dims-core.js'); /* 维度规格核心(dimension-registry): 巢穴副本段随迁至此 */

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
const DEN = Dims.ADV_DEN;

/* ============ 主世界 · 黑巢建场 ============ */

test('黑巢建场: 巢厅/巢之心/发光岩落位 + 洞道向南深潜连通(山洞同款 1 格级)', () => {
  clearWorld();
  Core.advBuildWorld();
  const coreX = DN.x; const coreZ = DN.z + 19;
  assert.strictEqual(cell(coreX, 8, coreZ), api.B_SPAWNER, '巢厅中央巢之心(巢厅地标; 2026-10-30 入口已迁洞口紫门)');
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
  /* 黑石王冠(巢穴观感票): 丘冠(d<1.2, h=5)黑曜石为主——顶冠读得出「黑巢」,
     丘裙(d≥3.6)不再撒随机黑块(旧版黑柱串到草皮边) */
  let crown = 0; let crownAll = 0;
  for (let yy = 25; yy <= 29; yy++) {
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (cell(DN.x + dx, yy, DN.z + dz) === 0) continue;
      crownAll++;
      if (cell(DN.x + dx, yy, DN.z + dz) === api.B_OBSIDIAN) crown++;
    }
  }
  assert.ok(crown > crownAll / 2, '丘冠以黑曜石为主(黑石王冠): ' + crown + '/' + crownAll);
  let skirtObs = 0;
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      if (Math.hypot(dx, dz) < 3.6 || Math.hypot(dx, dz) > 5) continue;
      for (let yy = 25; yy <= 26; yy++) {
        if (cell(DN.x + dx, yy, DN.z + dz) === api.B_OBSIDIAN) skirtObs++;
      }
    }
  }
  assert.strictEqual(skirtObs, 0, '丘裙无随机黑块(黑块只留在丘冠/丘身)');
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

test('巢穴洞口紫门: 2×2 B_PORTAL 门面+黑曜石门槛+发光岩门楣(可见入口, 从巢之心旁站桩迁移)', () => {
  clearWorld();
  Core.advBuildWorld();
  const DZ = DN.z + 3; /* 门面 z 平面: 画廊北端(楼梯尽头, 下楼梯正对着) */
  for (const gx of [DN.x - 1, DN.x]) {
    for (const yy of [22, 23]) {
      assert.strictEqual(cell(gx, yy, DZ), api.B_PORTAL, '紫门面 (' + gx + ',' + yy + ',' + DZ + ')');
    }
    assert.strictEqual(cell(gx, 21, DZ), api.B_OBSIDIAN, '黑曜石门槛 (' + gx + ',21,' + DZ + ')');
    assert.strictEqual(cell(gx, 24, DZ), api.B_GLOWSTONE, '发光岩门楣 (' + gx + ',24,' + DZ + ')');
  }
  /* 门面格可走入(B_PORTAL solid:false): 玩家脚格落 (x99..100, y22..23, z11) 即触发域
     ——壳层 advDenDoorAt 与此同源派生, 建场/判定不漂移 */
  /* 门框柱(巢穴观感票): 门面两侧贴廊壁各一根黑曜石柱(y22~24)——经典门框观感,
     远看即「这里有一扇门」; 廊壁格在敞廊 fill 之外, 触发域不动 */
  for (const gx of [DN.x - 2, DN.x + 1]) {
    for (let yy = 22; yy <= 24; yy++) {
      assert.strictEqual(cell(gx, yy, DZ), api.B_OBSIDIAN, '黑曜石门框柱 (' + gx + ',' + yy + ',' + DZ + ')');
    }
  }
});

test('黑巢门口刷怪池: den 行进 ADV_NESTS(巢穴机制照跑) + 池主打洞穴蜘蛛', () => {
  assert.strictEqual(DN.den, true, 'den 旗标(advBuildWorld 分派 advBuildDenNest)');
  assert.deepStrictEqual(DN.kinds, ['cave_spider', 'zombie', 'skeleton'],
      '黑巢池主打 cave_spider(唯一产地, den-nest D7)');
});

/* ============ 副本 · advDenBuild(§7 苦力怕主题改造) ============ */

test('副本建场: 全图确定性(两次生成逐字节一致, 确定性重放红线)', () => {
  clearWorld();
  Dims.advDenBuild();
  const a = snapshot();
  clearWorld();
  Dims.advDenBuild();
  assert.deepStrictEqual(a, snapshot(), '两次建场 worldCells 逐块一致');
});

test('副本结构: 大厅净空+中央灯塔(祭坛已迁走)/穹顶遮天/回程裂隙门', () => {
  clearWorld();
  Dims.advDenBuild();
  /* 大厅: 地面层实心、净空到穹顶渐降(中央 y38); 中央是苔石墩+顶灯不再是祭坛 */
  assert.notStrictEqual(cell(DEN.hall.cx, DEN.ground, DEN.hall.cz), 0, '厅心地面实心(苔石/泥混铺)');
  assert.strictEqual(cell(DEN.hall.cx - 1, DEN.ground + 1, DEN.hall.cz), 14, '中央苔石墩(十字路口路标)');
  assert.strictEqual(cell(DEN.hall.cx, DEN.ground + 2, DEN.hall.cz), api.B_GLOWSTONE, '路标顶灯');
  assert.notStrictEqual(cell(DEN.hall.cx, DEN.ground + 1, DEN.hall.cz), api.B_SPAWNER,
      '厅心不再是巢之心(祭坛已迁深处祭坛房)');
  assert.strictEqual(cell(DEN.hall.cx, 30, DEN.hall.cz), 0, '大厅净空(穹顶下)');
  assert.strictEqual(cell(DEN.hall.cx, DEN.roof, DEN.hall.cz + DEN.hall.r + 3), 3, '厅外岩体到穹顶全实心');
  assert.strictEqual(cell(DEN.hall.cx, DEN.roof + 2, DEN.hall.cz), 0, '穹顶壳上方空气(世界顶)');
  /* 回程裂隙门(基座常亮, 不记账): 内口门面 B_PORTAL(复用 advPortalFrame) */
  assert.strictEqual(cell(DEN.gate.px + 2, DEN.ground + 1, DEN.gate.pz), api.B_PORTAL, '回程门内口门面(advInPortal 判据)');
  assert.strictEqual(cell(DEN.gate.px, DEN.ground + 3, DEN.gate.pz), api.B_OBSIDIAN, '回程门黑曜石侧柱(中段)');
  assert.strictEqual(cell(DEN.gate.px, DEN.ground + 1, DEN.gate.pz), api.B_GLOWSTONE, '开口四角发光岩(门框原版口径)');
});

test('副本七房: 房腔净空+地板实心(两巢房/两矿腔/宝箱室/关底/祭坛房)', () => {
  clearWorld();
  Dims.advDenBuild();
  for (const key of Object.keys(DEN.rooms)) {
    const r = DEN.rooms[key];
    const mx = Math.floor((r.x1 + r.x2) / 2); const mz = Math.floor((r.z1 + r.z2) / 2);
    assert.strictEqual(cell(mx, DEN.ground + 2, mz), 0, key + ' 房腔净空');
    assert.strictEqual(cell(mx, DEN.ground + r.h, mz), 0, key + ' 顶层层净空(h=' + r.h + ')');
    assert.notStrictEqual(cell(mx, DEN.ground, mz), 0, key + ' 地板实心(苔石/泥混铺)');
  }
  /* 巢房「窝」: 房心 3×3 苔石垫(苦力怕的床) */
  for (const nk of ['nestA', 'nestB']) {
    const c = Dims.advDenRoomCenter(nk);
    assert.strictEqual(cell(c.x, DEN.ground, c.z), 14, nk + ' 房心苔石窝垫');
  }
});

test('副本弯曲隧道: 七条折线全通(逐段中点净空)且每条至少两个转折(恐怖气氛)', () => {
  clearWorld();
  Dims.advDenBuild();
  for (const pts of Dims.ADV_DEN_TUNNELS) {
    for (let i = 1; i < pts.length; i++) {
      const mx = Math.floor((pts[i - 1][0] + pts[i][0]) / 2);
      const mz = pts[i - 1][1];
      assert.strictEqual(cell(mx, DEN.ground + 2, mz), 0,
          '隧道段 x 中点净空(' + mx + ',' + mz + ')');
      const mz2 = Math.floor((pts[i - 1][1] + pts[i][1]) / 2);
      assert.strictEqual(cell(pts[i][0], DEN.ground + 2, mz2), 0,
          '隧道段 z 中点净空(' + pts[i][0] + ',' + mz2 + ')');
    }
    /* 转折数: 相邻段方向变化 ≥2 = 弯弯曲曲(用户拍板「不要全直线」) */
    let bends = 0; let dir = null;
    for (let i = 1; i < pts.length; i++) {
      const d = (pts[i][0] !== pts[i - 1][0] ? 'x' : 'z');
      if (dir && d !== dir) bends++;
      dir = d;
    }
    assert.ok(bends >= 2, '隧道至少两个转折: ' + JSON.stringify(pts));
  }
});

test('副本深处祭坛房: 祭坛从大厅迁来(巢之心+苔石台+黑曜石柱), 房内无火把(MC 刷怪笼地牢口径)', () => {
  clearWorld();
  Dims.advDenBuild();
  const A = DEN.altar;
  assert.strictEqual(cell(A.x - 1, DEN.ground + 1, A.z - 1), 14, '祭坛 3×3 苔石台(角格)');
  assert.strictEqual(cell(A.x, DEN.ground + 1, A.z), api.B_SPAWNER, '祭坛中央巢之心(波次出生环心)');
  assert.strictEqual(cell(A.x - 1, DEN.ground + 2, A.z - 1), api.B_OBSIDIAN, '四角黑曜石柱');
  assert.strictEqual(cell(A.x - 1, DEN.ground + 5, A.z - 1), api.B_GLOWSTONE, '柱顶发光岩');
  const r = DEN.rooms.altarR;
  let torch = 0;
  for (let x = r.x1; x <= r.x2; x++) {
    for (let z = r.z1; z <= r.z2; z++) {
      for (let y = DEN.ground + 1; y <= DEN.ground + r.h; y++) {
        if (cell(x, y, z) === api.B_TORCH) torch++;
      }
    }
  }
  assert.strictEqual(torch, 0, '祭坛房无火把(保持黑暗, 波次房不受光照压制)');
});

test('副本关底王座房: 王座台+四角柱+苦力怕脸壁雕+火把照明(用户拍板「有布置有火把」)', () => {
  clearWorld();
  Dims.advDenBuild();
  const B = DEN.boss; const r = DEN.rooms.bossR;
  assert.strictEqual(cell(B.x, DEN.ground + 1, B.z), api.B_OBSIDIAN, '王座台 3×3 黑曜石(中心)');
  assert.strictEqual(cell(B.x - 1, DEN.ground + 2, B.z - 1), api.B_GLOWSTONE, '台角灯');
  assert.strictEqual(cell(r.x1 + 1, DEN.ground + 2, r.z1 + 1), api.B_OBSIDIAN, '房角柱(西南)');
  assert.strictEqual(cell(r.x1 + 1, DEN.ground + 7, r.z1 + 1), api.B_GLOWSTONE, '房角柱顶灯');
  /* 壁雕: 北墙面 7×6 有黑曜石底+发光岩眼口(苦力怕脸读得出) */
  let obs = 0; let glow = 0;
  for (let fy = 0; fy < 6; fy++) {
    for (let fx = 0; fx < 7; fx++) {
      const id = cell(B.x - 3 + fx, DEN.ground + 8 - fy, r.z1);
      if (id === api.B_OBSIDIAN) obs++;
      if (id === api.B_GLOWSTONE) glow++;
    }
  }
  assert.ok(obs >= 16, '壁雕黑曜石底板非零: ' + obs);
  assert.ok(glow >= 20, '壁雕发光岩眼口非零: ' + glow);
  /* 火把×6 落地站膛(照明=王座房是副本唯一亮堂的房) */
  let torch = 0;
  for (let x = r.x1; x <= r.x2; x++) {
    for (let z = r.z1; z <= r.z2; z++) {
      if (cell(x, DEN.ground + 1, z) === api.B_TORCH) torch++;
    }
  }
  assert.strictEqual(torch, 6, '王座房六支火把');
});

test('副本矿藏廊: 隧道连通两矿腔分矿种镶矿 + 宝箱室(任务键同源坐标)', () => {
  clearWorld();
  Dims.advDenBuild();
  /* 矿腔 A(煤铁, 东北)与腔 B(金钻, 东南): 腔内净空(七房测试已覆盖中心),
     此处锁分矿种——腔 A 壁只有煤/铁、腔 B 壁只有金/钻(advTryOre=白名单) */
  const counts = {};
  for (let x = 94; x <= 114; x++) {
    for (let z = 64; z <= 96; z++) {
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
  const cr = DEN.rooms.chestR;
  assert.strictEqual(cell(cr.x1 + 1, DEN.ground + 1, cr.z1 + 1), api.B_TORCH, '室角落地站膛火把');
});

test('副本白名单: 矿腔镶矿进矿位账(跨天回填在副本同样生效)', () => {
  clearWorld();
  Core.advOreSpotsReset(); /* 壳层 advBuildScene 同款先清后建(白名单是建场期累积账) */
  Dims.advDenBuild();
  assert.ok(Core.advOreSpots.length > 50, '副本镶矿逐位记账(advTryOre 白名单)');
  for (const s of Core.advOreSpots) {
    assert.strictEqual(cell(s.x, s.y, s.z), s.id, '白名单格与世界一致(' + s.x + ',' + s.y + ',' + s.z + ')');
  }
  Core.advOreSpotsReset(); /* 测试收尾清账(不泄漏给后续用例) */
});

/* ============ 副本布防与波次纯函数(§7) ============ */

test('副本布防表: 全部怪落在所属房腔地板上 · 家锚=房心 · 谱系分层(苦力怕 ≥60%)', () => {
  /* 房腔判定: 大厅(圆)或七房(矩形, 含界) */
  const inRoom = (x, z) => {
    if (Math.hypot(x - DEN.hall.cx, z - DEN.hall.cz) <= DEN.hall.r) return true;
    for (const key of Object.keys(DEN.rooms)) {
      const r = DEN.rooms[key];
      if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) return true;
    }
    return false;
  };
  for (const g of Dims.ADV_DEN_GUARDS) {
    assert.ok(inRoom(g.x, g.z), g.type + ' 布防位在房腔内(' + g.x + ',' + g.z + ')');
    assert.ok(g.hx != null && g.hz != null, g.type + ' 家锚(房心)存在');
  }
  /* 谱系分层统计(布防+第一波): 苦力怕(含王) ≥60%(用户拍板), 且四种族齐上
     (草木族主力/虫虫族/僵尸一家/骷髅一家——「按谱系和层级有高有低」) */
  const w1 = Dims.advDenWavePlan(1, () => 0.5);
  const all = Dims.ADV_DEN_GUARDS.map((g) => g.type).concat(w1.spawns.map((s) => s.type));
  const nCreep = all.filter((t) => t === 'creeper' || t === 'creeper_king').length;
  assert.ok(nCreep / all.length >= 0.6,
      '苦力怕族占比 ≥60%: ' + nCreep + '/' + all.length);
  for (const need of ['creeper', 'creeper_king', 'silverfish', 'cave_spider', 'spider',
    'endermite', 'zombie', 'wither_skeleton']) {
    assert.ok(all.includes(need), '地底生态多样性含 ' + need);
  }
  assert.strictEqual(Dims.ADV_DEN_GUARDS.filter((g) => g.type === 'creeper_king').length, 1,
      '苦力怕王恰一位(关底 boss)');
});

test('副本布防表: 布防位与家锚收敛位都在进场落点索敌圈外(传送落地安全缓冲)', () => {
  /* 2026-10-30 用户反馈「刚传送门口2个苦力怕」: 落点默认不在怪物攻击范围
     是儿童红线。索敌=distP ≤ AGGRO_R(12); 收队聚齐=家锚 ± HOME_R(2)。
     两口径对全表 28 只钉死——大厅北移之外, 未来加怪也进不了落点圈 */
  for (const g of Dims.ADV_DEN_GUARDS) {
    const dSpawn = Math.hypot(g.x + 0.5 - DEN.base.x, g.z + 0.5 - DEN.base.z);
    assert.ok(dSpawn > Core.ADV_NEST_AGGRO_R,
        g.type + ' 布防位在落点索敌圈外(' + g.x + ',' + g.z + ' d=' + dSpawn.toFixed(1) + ')');
    const dHome = Math.hypot(g.hx - DEN.base.x, g.hz - DEN.base.z) - Core.ADV_NEST_HOME_R;
    assert.ok(dHome > Core.ADV_NEST_AGGRO_R,
        g.type + ' 家锚收敛位也在索敌圈外(收队聚齐同样索敌不到落点)');
  }
});

test('副本波次节拍: 全清才计时 · 10s 到拍出波令 · 有怪活着计时归零(打完 10 秒刷新)', () => {
  assert.deepStrictEqual(Dims.advDenStep(false, 3, 1), {spawn: false, chest: false, t: 0},
      '怪还活着: 计时归零(见怪即重数)');
  assert.deepStrictEqual(Dims.advDenStep(true, 0, 1), {spawn: false, chest: false, t: 1}, '全清后未到拍只累计');
  assert.deepStrictEqual(Dims.advDenStep(true, 9, 1.5), {spawn: true, chest: false, t: 0}, '到 10s 出波令并归零');
  assert.strictEqual(DEN.WAVE_S, 10, '波次间隔 10 秒(用户拍板)');
});

test('副本波次封顶: 最多 5 轮 — 第 5 波全清即发 chest 信号(恰一次), 之后熄火(D15)', () => {
  assert.strictEqual(DEN.WAVES, 5, '波次封顶 5 轮(用户拍板「最多 5 轮」)');
  /* 1~4 波: 既有 10s 脉冲节拍(chest 恒 false) */
  for (const w of [1, 2, 3, 4]) {
    assert.deepStrictEqual(Dims.advDenStep(false, 3, 1, w, false),
        {spawn: false, chest: false, t: 0}, '第 ' + w + ' 波怪未清不计时');
    assert.deepStrictEqual(Dims.advDenStep(true, DEN.WAVE_S, 0.5, w, false),
        {spawn: true, chest: false, t: 0}, '第 ' + w + ' 波全清 10s 出波令');
  }
  /* 第 5 波: 全清 → chest 信号(t 恒 0——奖励即现不等 10s); chestDone 后熄火 */
  assert.deepStrictEqual(Dims.advDenStep(false, 5, 1, 5, false),
      {spawn: false, chest: false, t: 0}, '第 5 波怪未清: 什么都不发');
  assert.deepStrictEqual(Dims.advDenStep(true, 0, 0.1, 5, false),
      {spawn: false, chest: true, t: 0}, '第 5 波全清: 全清当帧即发 chest(不等 10s)');
  assert.deepStrictEqual(Dims.advDenStep(true, 0, 1, 5, true),
      {spawn: false, chest: false, t: 0}, '宝箱已发: 熄火(本会话不再出波不再刷箱)');
  assert.deepStrictEqual(Dims.advDenStep(true, 99, 1, 6, true),
      {spawn: false, chest: false, t: 0}, 'wave 超封顶同熄火(防御)');
  /* 缺省入参兼容(旧 3 参调用 = wave 1 从头跑) */
  assert.deepStrictEqual(Dims.advDenStep(true, 9.5, 1), {spawn: true, chest: false, t: 0});
});

test('副本波次计划: 祭坛环带界内 · 逐波变强有封顶 · 苦力怕每波为主力 · 高波入精英', () => {
  const seq = (n) => Array.from({length: n}, (_, i) => 0.3 + (i % 7) * 0.09);
  for (const wave of [1, 3, 5, 8, 12, 50]) {
    const rnd = seq(64);
    let ri = 0;
    const w = Dims.advDenWavePlan(wave, () => rnd[ri++ % rnd.length]);
    assert.ok(w.spawns.length >= 6, '第 ' + wave + ' 波至少 6 只');
    for (const s of w.spawns) {
      const d = Math.hypot(s.x + 0.5 - DEN.altar.x - 0.5, s.z + 0.5 - DEN.altar.z - 0.5);
      assert.ok(d <= DEN.RING_HI + 1, '波次出生在祭坛环带内: ' + d.toFixed(2));
    }
    const cre = w.spawns.filter((s) => s.type === 'creeper').length;
    assert.ok(cre / w.spawns.length >= 0.6, '第 ' + wave + ' 波苦力怕占比 ≥60%: ' + cre + '/' + w.spawns.length);
    for (const s of w.spawns) {
      assert.strictEqual(s.hx, DEN.altar.x, '波次家锚=祭坛(涌出怪围绕祭坛)');
    }
  }
  /* 逐波变强(单调)且封顶(儿童可控): 50 波与 8 波同乘数(hp 2.75/spd 1.2/dmg 1.6) */
  const m = (wave) => Dims.advDenWavePlan(wave, () => 0.5);
  assert.ok(m(3).hpMult > m(1).hpMult && m(5).hpMult > m(3).hpMult, '血量逐波成长');
  assert.deepStrictEqual(
      [m(50).hpMult, m(50).spdMult, m(50).dmgMult],
      [DEN.WAVE_HP_MAX, DEN.WAVE_SPD_MAX, DEN.WAVE_DMG_MAX], '封顶后不再涨');
  /* 高波编成: 3 波换尸壳(僵尸一家谱系内升层), 4 波起凋灵骷髅, 6 波双护卫 */
  assert.ok(m(1).spawns.some((s) => s.type === 'zombie'), '1 波有僵尸');
  assert.ok(m(3).spawns.some((s) => s.type === 'husk') && !m(3).spawns.some((s) => s.type === 'zombie'),
      '3 波起僵尸晋级尸壳');
  assert.strictEqual(m(4).spawns.filter((s) => s.type === 'wither_skeleton').length, 1, '4 波单护卫');
  assert.strictEqual(m(6).spawns.filter((s) => s.type === 'wither_skeleton').length, 2, '6 波双护卫(封顶编成)');
  /* 怪种合法: 全部 ∈ MOB_TYPES(注册表即合法性唯一权威) */
  const legal = new Set(Object.keys(require('../js/mob-registry.js').MOB_TYPES));
  for (const s of m(2).spawns) assert.ok(legal.has(s.type), '波次怪种已注册: ' + s.type);
});

/* ============ 战利品宝箱纯件(§7.5, 2026-10-30 二批拍板) ============ */

test('战利品宝箱: 常量空间关系 — 宝箱在祭坛房内 · 波次环带外 · 建场不预置(通关才刷)', () => {
  const L = DEN.loot;
  const ar = DEN.rooms.altarR;
  for (const x of [L.x, L.x + 1]) {
    assert.ok(x >= ar.x1 && x <= ar.x2 && L.z >= ar.z1 && L.z <= ar.z2,
        '宝箱格 (' + x + ',' + L.z + ') 在深处祭坛房内(贴北墙)');
    const d = Math.hypot(x + 0.5 - DEN.altar.x - 0.5, L.z + 0.5 - DEN.altar.z - 0.5);
    assert.ok(d > DEN.RING_HI, '宝箱在波次出生环带外(d=' + d.toFixed(2) + ' > ' + DEN.RING_HI + ')');
    assert.strictEqual(api.BLOCKS[api.B_LOOT_CHEST].lchest, true, 'lchest 旗标在册(配对破坏身份)');
  }
  /* 敲 2 秒口径(D16): hard 1.33 → 徒手 1.995s ≈ 2s, tier 0 恒掉落 */
  const bt = api.breakTime(api.BLOCKS[api.B_LOOT_CHEST], null);
  assert.ok(Math.abs(bt.time - 2) < 0.05, '徒手敲击 ' + bt.time + 's ≈ 2 秒(用户拍板)');
  assert.strictEqual(bt.drops, true, 'tier 0 恒掉落(儿童徒手也拿得到战利品)');
  /* 建场不预置宝箱(演出件——advDenBuild 不刷, 5 轮全清后壳层才刷, D17) */
  clearWorld();
  Dims.advDenBuild();
  assert.strictEqual(cell(L.x, L.y, L.z), 0, '建场后宝箱格 A 空(祭坛房净空)');
  assert.strictEqual(cell(L.x + 1, L.y, L.z), 0, '建场后宝箱格 B 空');
});

test('战利品宝箱掷骰: 保底必得 + 50% 加成 + 钻石恒得 — 注入 rnd 全确定(D17 掉落表, 2026-10-30 拍板)', () => {
  const ITEMS = api.ITEMS; /* 注册表唯一权威(vm 真件; items-core 无导出守卫, 不可 require) */
  /* 全不中(rnd=0.9): 保底恰 = 火药 3 + 铁锭 2 + 金锭 1 + 苹果 2; 钻石 rare p=1 恒得 */
  assert.deepStrictEqual(Dims.advDenLootRoll(() => 0.9), [
    {id: 'gunpowder', n: 3}, {id: 'iron_ingot', n: 2},
    {id: 'gold_ingot', n: 1}, {id: 'apple', n: 2}, {id: 'diamond', n: 1},
  ], '全不中 = 纯保底 + 钻石恒得');
  /* 全中(rnd=0.4 < 0.5): 加成逐次命中 → 火药 4 + 铁锭 3 + 金锭 2 */
  const lucky = Dims.advDenLootRoll(() => 0.4);
  assert.deepStrictEqual(lucky.find((d) => d.id === 'gunpowder').n, 4, '火药 3+1');
  assert.deepStrictEqual(lucky.find((d) => d.id === 'iron_ingot').n, 3, '铁锭 2+1');
  assert.deepStrictEqual(lucky.find((d) => d.id === 'gold_ingot').n, 2, '金锭 1+1');
  /* 表里每个物品 id 都在 ITEMS 注册(掷出的东西必须拿得起来) */
  for (const e of Dims.ADV_DEN_LOOT.rolls) {
    assert.ok(ITEMS[e[0]], '掉落表物品已注册: ' + e[0]);
  }
  for (const e of Dims.ADV_DEN_LOOT.rare) assert.ok(ITEMS[e[0]], 'rare 物品已注册: ' + e[0]);
});

test('战利品宝箱配对计划: 四邻认亲 · 恰一次掉落 · 无相邻宝箱返 null(D16)', () => {
  const L = DEN.loot;
  const at = (x, y, z) => (x === L.x || x === L.x + 1) && y === L.y && z === L.z ? api.B_LOOT_CHEST : 0;
  /* 挖左半(触发格已清): 右半在东邻 → cells=[右], drops 恰掷一次 */
  const pA = Dims.advLootChestPlan(at, L.x, L.y, L.z, () => 0.9);
  assert.deepStrictEqual(pA.cells, [{x: L.x + 1, y: L.y, z: L.z}], '东邻右半入计划');
  assert.strictEqual(pA.drops.length, 5, '掉落恰掷一次(保底 4 条 + 钻石, 0.9 全不中)');
  /* 挖右半: 左半在西邻 → 对称 */
  const pB = Dims.advLootChestPlan(at, L.x + 1, L.y, L.z, () => 0.9);
  assert.deepStrictEqual(pB.cells, [{x: L.x, y: L.y, z: L.z}], '西邻左半入计划');
  /* 无相邻宝箱(孤儿格): null——防 TNT 同拍双掷/双掉 */
  assert.strictEqual(Dims.advLootChestPlan(() => 0, 80, 7, 80, () => 0.9), null,
      '四周皆空: 无宝箱可配, 返 null');
});

/* ============ 夜袭涌出纯函数(§2.2, 未改动——回归锁) ============ */

test('夜袭涌出: 夜门(白天归零) · 到拍掷概率 · 配额门 · 池合法(无苦力怕)', () => {
  const NIGHT = 15000; const DAY = 5000; /* isNight [13000,23000) */
  assert.deepStrictEqual(Dims.advEruptStep(0, 1, DAY, 0, Math.random), {t: 0, spawn: null},
      '白天节拍器归零(涌出只在夜间)');
  assert.deepStrictEqual(Dims.advEruptStep(0, 1, NIGHT, 0, Math.random), {t: 1, spawn: null},
      '夜间未到拍只累计');
  assert.deepStrictEqual(Dims.advEruptStep(Dims.ADV_ERUPT.TRY_S, 0, NIGHT, 0, () => 0.99),
      {t: 0, spawn: null}, '到拍掷概率不过(0.99 ≥ P)本拍作废');
  assert.strictEqual(Dims.advEruptStep(Dims.ADV_ERUPT.TRY_S, 0, NIGHT, 0, () => 0).spawn.type,
      'zombie', '到拍概率过+池首权重取种(浮点起点=zombie)');
  assert.deepStrictEqual(Dims.advEruptStep(Dims.ADV_ERUPT.TRY_S, 0, NIGHT, Dims.ADV_ERUPT.QUOTA, () => 0),
      {t: 0, spawn: null}, '配额满本拍作废(涌出自持小配额, 不吃光环带名额)');
  const legal = new Set(Dims.ADV_ERUPT.POOL.map((p) => p[0]));
  assert.ok(!legal.has('creeper'), '池无苦力怕(洞口贴脸爆炸对 6 岁是惊吓不是挑战——副本内才是苦力怕主场)');
  for (let i = 0; i < 200; i++) {
    const r = Dims.advEruptStep(Dims.ADV_ERUPT.TRY_S, 0, NIGHT, 0, Math.random);
    if (r.spawn) assert.ok(legal.has(r.spawn.type), '涌出取种不出池: ' + r.spawn.type);
  }
});

test('副本常量: 落点/门位在厅内 · 祭坛在深处房 · 关底在北 · 宝箱在东(儿童可控的空间关系)', () => {
  const inHall = (x, z) => Math.hypot(x - DEN.hall.cx, z - DEN.hall.cz) <= DEN.hall.r;
  assert.ok(inHall(DEN.base.x, DEN.base.z), '进场落点在厅内');
  assert.ok(inHall(DEN.gate.px + 2, DEN.gate.pz), '回程门框在厅内(内口判定可达)');
  const ar = DEN.rooms.altarR;
  assert.ok(DEN.altar.x >= ar.x1 && DEN.altar.x <= ar.x2 && DEN.altar.z >= ar.z1 && DEN.altar.z <= ar.z2,
      '祭坛在深处祭坛房内(不再压厅心)');
  assert.ok(Math.hypot(DEN.base.x - DEN.altar.x, DEN.base.z - DEN.altar.z) >= 40,
      '祭坛离进场落点 ≥40 格(「深处」的空间直译)');
  const br = DEN.rooms.bossR;
  assert.ok(DEN.boss.x >= br.x1 && DEN.boss.x <= br.x2 && DEN.boss.z >= br.z1 && DEN.boss.z <= br.z2,
      '王座在关底大房内');
  assert.ok(br.z2 < DEN.hall.cz - DEN.hall.r, '关底大房在大厅以北(探索动线收尾)');
  assert.ok(DEN.chest.x > DEN.hall.cx + DEN.hall.r, '宝箱室在大厅以东(矿藏廊尽头, 探索动线)');
  assert.ok(DEN.WAVE_HP_MAX <= 3 && DEN.WAVE_SPD_MAX <= 1.25, '波次成长封顶在儿童可控带');
});
