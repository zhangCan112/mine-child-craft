'use strict';
/* 冒险地图纯核心 (js/adventure-maps-core.js) 单测 — node --test (零依赖)
   运行: node --test test/adventure-maps-core.test.js
   S1 同名单测(conventions §1.2 守门): 镜像 test/adventure-core.test.js 的
   vm 惯例——先装真引擎件, 再把 adventure-core 的导出挂进 Node 全局
   (经典 script 共享词法环境的复刻: 本模块经全局名读 ADV_GROUND/
   ADV_HOME_ROW/advPortalExit 等), 后 require 本模块直测。四图建场确定性
   对真散布函数断言; 替换语义池/注册表完整性/政策纯函数逐条钉口径
   (票据 T4, docs/adventure-maps-tickets.md)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 真引擎件: 与 adventure-core.test.js 同一套 vm 惯例 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, groundTop, SceneKit, Daylight, DAYLIGHT, BLOCKS, PLAYER,
  WORLD_W, WORLD_D, WORLD_H, MOB_TYPES,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT, B_BED, B_FARMLAND, B_WHEAT_3,
  B_SNOW, B_SNOWY_GRASS, B_ICE, B_CACTUS, B_SANDSTONE, B_DEAD_BUSH, B_ORCHID,
  B_FLOWER_Y, B_FLOWER_W,
  B_CHEST, B_PORTAL, B_OBSIDIAN, B_GLOWSTONE, B_NETHER_BRICK,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */
/* 上一层共享词法: ADV_GROUND/ADV_SPAWN/ADV_PORTAL/ADV_HOME_ROW/advPortalExit/advBuildWorld */
Object.assign(globalThis, require('../js/adventure-core.js'));

const Maps = require('../js/adventure-maps-core.js');

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
const colTop = (x, z) => {/* 列最高非空格 y(地表抽样用) */
  for (let y = H - 1; y >= 0; y--) if (cell(x, y, z) !== 0) return y;
  return -1;
};
const clearWorld = () => vm.runInContext('worldCells.fill(0)', eng); /* 空场起建(生产 loadScene
  的 world.clear 同义; 不清则上一张图的高处残留, snow 顶面低于 desert 处会读到旧砂岩) */
function assertSameWorld(a, b, msg) {/* Buffer 不等时给首差异坐标(不走 deepStrictEqual 的
  myers diff——两个 786KB Buffer 的差异报告会爆内存, 2026-10-27 实测教训) */
  if (a.equals(b)) return;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      const x = i % W; const z = Math.floor(i / W) % D; const y = Math.floor(i / (W * D));
      assert.fail(msg + '(首个差异 @(' + x + ',' + y + ',' + z + ') ' + a[i] + '≠' + b[i] + ')');
    }
  }
}

/* ============ 注册表完整性(纯数据, 不建场) ============ */

test('注册表: 四行齐 · id 唯一 · 每行字段齐 · home 行引用 ADV_HOME_ROW(同一数据不复制)', () => {
  assert.ok(Array.isArray(Maps.ADV_MAPS), 'ADV_MAPS 是清单');
  assert.strictEqual(Maps.ADV_MAPS.length, 4, '一期四张图: home/desert/snow/swamp');
  const ids = Maps.ADV_MAPS.map((r) => r.id);
  assert.deepStrictEqual([...ids].sort(), ['desert', 'home', 'snow', 'swamp'], 'id 集合与拼写');
  assert.strictEqual(new Set(ids).size, 4, 'id 唯一');
  for (const r of Maps.ADV_MAPS) {
    assert.ok(r.id && r.name && r.hud, r.id + ' 名字三件套');
    assert.strictEqual(typeof r.build, 'function', r.id + ' 建场函数');
    assert.ok(Array.isArray(r.nests) && r.nests.length >= 2, r.id + ' 巢穴池 2+ 巢');
    assert.ok(Array.isArray(r.nightPool) && r.nightPool.length >= 2, r.id + ' 夜怪池非空');
    assert.ok(Array.isArray(r.gates) && r.gates.length >= 1, r.id + ' 门位非空');
    for (const g of r.gates) {
      assert.ok(g.to && Number.isInteger(g.px) && Number.isInteger(g.pz), r.id + ' 门位 {to,px,pz}');
      assert.ok(g.px >= 2 && g.px + ADV_PORTAL.w < W - 2 && g.pz >= 3 && g.pz < D - 3,
          r.id + '→' + g.to + ' 门框在界内(留塔楼/步道外沿)');
    }
    assert.ok(typeof r.livestock === 'string', r.id + ' 畜牧分布键');
    /* 调色板四元组: 每个 RGB 数组值域 [0,1] */
    for (const k of ['ground', 'flora', 'water', 'sky']) {
      const c = r.palette[k];
      assert.ok(Array.isArray(c) && c.length === 3 && c.every((v) => v >= 0 && v <= 1),
          r.id + ' 调色板 ' + k + ' 是 [0,1]×3');
    }
  }
  const home = Maps.ADV_MAPS[0];
  assert.strictEqual(home.id, 'home', 'home 是首行(缺省图)');
  assert.strictEqual(home.nests, ADV_HOME_ROW.nests, 'home 巢穴池=ADV_HOME_ROW 同一引用');
  assert.strictEqual(home.nightPool, ADV_HOME_ROW.nightPool, 'home 夜怪池=ADV_HOME_ROW 同一引用');
  assert.strictEqual(home.build, advBuildWorld, 'home 建场=advBuildWorld(T5 前不动 home)');
});

test('注册表: 替换语义红线 — 三张远征图双池换防(desert/husk, snow/stray, swamp/bogged)', () => {
  const row = (id) => Maps.ADV_MAPS.find((r) => r.id === id);
  const kindsOf = (nests) => [].concat(...nests.map((n) => n.kinds));
  const poolOf = (pool) => pool.map((p) => p[0]);

  const desert = row('desert');
  assert.ok(!kindsOf(desert.nests).includes('zombie') && !poolOf(desert.nightPool).includes('zombie'),
      'desert 巢穴池+夜怪池均无 zombie');
  assert.ok(kindsOf(desert.nests).includes('husk') && poolOf(desert.nightPool).includes('husk'),
      'desert 巢穴池+夜怪池均有 husk(布尔替换, 非混刷)');

  const snow = row('snow');
  assert.ok(!kindsOf(snow.nests).includes('skeleton') && !poolOf(snow.nightPool).includes('skeleton'),
      'snow 巢穴池+夜怪池均无 skeleton');
  assert.ok(kindsOf(snow.nests).includes('stray') && poolOf(snow.nightPool).includes('stray'),
      'snow 巢穴池+夜怪池均有 stray');

  const swamp = row('swamp');
  assert.ok(!kindsOf(swamp.nests).includes('skeleton') && !poolOf(swamp.nightPool).includes('skeleton'),
      'swamp 巢穴池+夜怪池均无 skeleton');
  assert.ok(kindsOf(swamp.nests).includes('bogged') && poolOf(swamp.nightPool).includes('bogged'),
      'swamp 巢穴池+夜怪池均有 bogged');
  assert.ok(poolOf(swamp.nightPool).includes('slime'), 'swamp 夜怪池有 slime(夜间水池)');
  assert.ok(!kindsOf(swamp.nests).includes('slime'),
      'slime 不进巢穴池(审查修复 P3: 史莱姆=夜间水边专属, 白天巢穴不刷)');
  assert.ok(!poolOf(swamp.nightPool).includes('witch'), 'witch 不进通用夜池(小屋常驻)');
  assert.ok(swamp.witchHut && Number.isInteger(swamp.witchHut.x) && Number.isInteger(swamp.witchHut.z),
      'swamp 行有女巫小屋常驻标记 witchHut{x,z}(T6 壳消费)');
  const others = Maps.ADV_MAPS.filter((r) => r.id !== 'swamp');
  assert.ok(others.every((r) => !r.witchHut), 'witchHut 标记仅 swamp 行有');
  /* 池里怪种都在册(mob-registry 防拼错) */
  for (const r of Maps.ADV_MAPS) {
    for (const k of [...kindsOf(r.nests), ...poolOf(r.nightPool)]) {
      assert.ok(api.MOB_TYPES[k], r.id + ' 池怪 ' + k + ' 已在 mob-registry 注册');
    }
  }
});

test('注册表: 门位网 — home 三扇门阵互不重叠且各指一张远征图; 远征图各一门回 home; to 双向成环', () => {
  const home = Maps.ADV_MAPS[0];
  const exped = Maps.ADV_MAPS.filter((r) => r.id !== 'home');
  assert.strictEqual(home.gates.length, 3, 'home 门阵三扇(desert/snow/swamp 各一)');
  assert.deepStrictEqual(home.gates.map((g) => g.to).sort(), ['desert', 'snow', 'swamp']);
  const box = (g) => [g.px - 1, g.px + ADV_PORTAL.w, g.pz - 1, g.pz + 1]; /* 含塔楼/步道的包围盒 */
  for (let i = 0; i < home.gates.length; i++) {
    for (let j = i + 1; j < home.gates.length; j++) {
      const a = box(home.gates[i]); const b = box(home.gates[j]);
      const overlap = a[0] <= b[1] && b[0] <= a[1] && a[2] <= b[3] && b[2] <= a[3];
      assert.ok(!overlap, 'home 门 ' + home.gates[i].to + ' 与 ' + home.gates[j].to + ' 不重叠');
    }
  }
  for (const r of exped) {
    assert.strictEqual(r.gates.length, 1, r.id + ' 单门回 home');
    assert.strictEqual(r.gates[0].to, 'home', r.id + ' 回程门指向 home');
  }
  /* 门位副本一致性(T8): adventure-core 的 ADV_GATE_PLAZA.gates 是建场植被避让用的
     副本(绑定权威在此表)——两份漂移会让草丛/树长在门体上, 逐门钉死同值 */
  const Core = require('../js/adventure-core.js');
  assert.strictEqual(Core.ADV_GATE_PLAZA.gates.length, home.gates.length, '副本门数一致');
  for (let i = 0; i < home.gates.length; i++) {
    assert.strictEqual(Core.ADV_GATE_PLAZA.gates[i].px, home.gates[i].px,
        '副本门位 x 同值: ' + home.gates[i].to + '(漂移=植被长在门体上)');
    assert.strictEqual(Core.ADV_GATE_PLAZA.gates[i].pz, home.gates[i].pz,
        '副本门位 z 同值: ' + home.gates[i].to);
  }
});

/* ============ 政策纯函数段(逐条钉口径, 纯数据进出零世界读) ============ */

test('政策: 门解锁判定 — home 恒开; 远征图看任务档 counts 键(T8 点亮置 1)', () => {
  assert.strictEqual(Maps.advMapUnlocked('home', {}), true, 'home 出生图恒开');
  assert.strictEqual(Maps.advMapUnlocked('home', null), true, 'home 无档也开');
  assert.strictEqual(Maps.ADV_UNLOCK_KEYS.desert, 'unlockedDesert', 'counts 键名约定');
  assert.strictEqual(Maps.ADV_UNLOCK_KEYS.snow, 'unlockedSnow');
  assert.strictEqual(Maps.ADV_UNLOCK_KEYS.swamp, 'unlockedSwamp');
  const empty = {collect_log: 5}; /* 有任务进度但没点亮任何门 */
  for (const id of ['desert', 'snow', 'swamp']) {
    assert.strictEqual(Maps.advMapUnlocked(id, empty), false, id + ' 缺键=锁定');
    assert.strictEqual(Maps.advMapUnlocked(id, {}), false, id + ' 空档=锁定');
    assert.strictEqual(Maps.advMapUnlocked(id, undefined), false, id + ' 无档=锁定');
    assert.strictEqual(Maps.advMapUnlocked(id, {[Maps.ADV_UNLOCK_KEYS[id]]: 0}), false, id + ' 键值 0=锁定(真值判定)');
    assert.strictEqual(Maps.advMapUnlocked(id, {[Maps.ADV_UNLOCK_KEYS[id]]: 1}), true, id + ' 点亮=解锁');
  }
});

test('政策: 结构宝箱坐标 → 任务计数键(T8 探宝型) — 三座结构各一键, 他图/玩家自放箱不算', () => {
  /* 三座结构宝箱坐标与建场函数同源常量(神殿/雪屋 y20 地下宝箱室, 女巫小屋地板) */
  assert.strictEqual(Maps.advMapChestKey('desert', Maps.ADV_DESERT.temple.cx, 20, Maps.ADV_DESERT.temple.cz),
      'chest_temple', '神殿宝箱 → chest_temple');
  assert.strictEqual(Maps.advMapChestKey('snow', Maps.ADV_SNOW.hut.cx, 20, Maps.ADV_SNOW.hut.cz),
      'chest_igloo', '雪屋宝箱 → chest_igloo');
  assert.strictEqual(Maps.advMapChestKey('swamp', Maps.ADV_SWAMP.hut.x, 24 + 4, Maps.ADV_SWAMP.hut.z),
      'chest_witch', '女巫小屋宝箱 → chest_witch(地板 ADV_GROUND+4)');
  /* 反例: 图不符/同结构邻格/玩家自放箱坐标 → null(图+坐标双判定防冒名) */
  assert.strictEqual(Maps.advMapChestKey('home', Maps.ADV_DESERT.temple.cx, 20, Maps.ADV_DESERT.temple.cz),
      null, 'home 图同坐标不算(带箱远征/挖坑埋箱都骗不过)');
  assert.strictEqual(Maps.advMapChestKey('desert', Maps.ADV_DESERT.temple.cx, 21, Maps.ADV_DESERT.temple.cz),
      null, '神殿宝箱头顶一格不算');
  assert.strictEqual(Maps.advMapChestKey('snow', Maps.ADV_SNOW.hut.cx + 1, 20, Maps.ADV_SNOW.hut.cz),
      null, '雪屋宝箱旁格不算');
  assert.strictEqual(Maps.advMapChestKey('home', 61, 25, 81), null, 'home 小屋旁的箱子不算(玩家自放)');
});

test('政策: 站桩步进 — 2s 站满发令 · 走出门面即刻反悔归零 · 发令后重新累计', () => {
  assert.strictEqual(Maps.ADV_GATE_HOLD_T, 2, '站桩时长 2s(设计稿 §4.1)');
  assert.deepStrictEqual(Maps.advGateHoldStep(0, true, 0.5), {t: 0.5, fire: false}, '站内累计');
  assert.deepStrictEqual(Maps.advGateHoldStep(1.5, true, 0.4), {t: 1.9, fire: false}, '不足 2s 不发令');
  assert.deepStrictEqual(Maps.advGateHoldStep(1.5, true, 0.5), {t: 0, fire: true}, '恰站满 2s 发传送令并归零');
  assert.deepStrictEqual(Maps.advGateHoldStep(1.9, true, 1.0), {t: 0, fire: true}, '一帧跨过阈值同样发令(不丢帧)');
  assert.deepStrictEqual(Maps.advGateHoldStep(1.9, false, 0.1), {t: 0, fire: false}, '1.9s 走出=反悔归零(可反悔红线)');
  assert.deepStrictEqual(Maps.advGateHoldStep(1.9, false, 0.0), {t: 0, fire: false}, '不在门内 dt=0 也归零');
  assert.deepStrictEqual(Maps.advGateHoldStep(0, false, 0.5), {t: 0, fire: false}, '门外不计时');
});

test('政策: 到达落点 — 回程门内侧 2.5 格 · 面朝外(advPortalExit 同口径数值钉死)', () => {
  const desert = Maps.ADV_MAPS.find((r) => r.id === 'desert');
  const g = desert.gates[0];
  const sp = Maps.advMapArrive(desert);
  /* 虚拟进门者从门面朝 -z(yaw=π): 出口 = 门中心 - forward×2.5, yaw 反向
     forward=(sin,cos): yaw π=(0,-1) → 落点 z = pz+0.5+2.5 = pz+3(门南侧),
     yaw = 0(朝 +z, 背对门走向开阔区——§2.3 门在身后) */
  assert.deepStrictEqual(sp,
      {x: g.px + 2.5, y: ADV_GROUND + 1, z: g.pz + 0.5 + 2.5, yaw: 0},
      '落点=回程门内侧 2.5 格, 面朝外');
  for (const r of Maps.ADV_MAPS.filter((m) => m.id !== 'home')) {
    const a = Maps.advMapArrive(r);
    assert.ok(a.x > 1 && a.x < W - 1 && a.z > 1 && a.z < D - 1, r.id + ' 落点在界内');
    assert.strictEqual(a.y, ADV_GROUND + 1, r.id + ' 落点站基准地表(门位压平区)');
    assert.strictEqual(a.yaw, 0, r.id + ' 面朝外(朝南远离门)');
  }
});

test('政策: 指定门位到达落点 — advMapArriveAt(gate) 与 advMapArrive 同口径; home 三门各得各的落点', () => {
  const home = Maps.ADV_MAPS[0];
  for (const g of home.gates) {/* home 多门: 回程落点跟着来时的门走(沙漠门进沙漠门出) */
    const sp = Maps.advMapArriveAt(g);
    assert.deepStrictEqual(sp,
        {x: g.px + 2.5, y: ADV_GROUND + 1, z: g.pz + 0.5 + 2.5, yaw: 0},
        home.gates.find((m) => m.to === g.to) && g.to + ' 门位落点=门内侧 2.5 格面朝外');
  }
  const desert = Maps.ADV_MAPS.find((r) => r.id === 'desert');
  assert.deepStrictEqual(Maps.advMapArriveAt(desert.gates[0]), Maps.advMapArrive(desert),
      'advMapArrive(row) = gates[0] 的便捷版(远征图单门恒等)');
});

test('政策: 死亡回家 — 满血+home 门口+背包保留+map 标记回 home(零惩罚哲学)', () => {
  const plan = Maps.advMapDeathPlan('desert', {hp: 0, maxHp: 30});
  assert.strictEqual(plan.hp, 30, '满血复活');
  assert.strictEqual(plan.x, ADV_SPAWN.x, 'home 门口(出生账本)');
  assert.strictEqual(plan.y, ADV_SPAWN.y);
  assert.strictEqual(plan.z, ADV_SPAWN.z);
  assert.strictEqual(plan.yaw, ADV_SPAWN.yaw);
  assert.strictEqual(plan.keepInv, true, '背包保留');
  assert.strictEqual(plan.map, 'home', '壳按 map 切回 home(远征图死=回家红线)');
  assert.strictEqual(Maps.advMapDeathPlan('home', {hp: 3, maxHp: 30}).map, 'home', 'home 图死=原地出生点(不切图)');
});

/* ============ 建场: 黄沙沙漠 ============ */

test('沙漠建场: 两次建场 worldCells 逐字节一致(确定性红线, 零 Math.random)', () => {
  clearWorld();
  Maps.advDesertBuild();
  const a = snapshot();
  clearWorld();
  Maps.advDesertBuild();
  assertSameWorld(a, snapshot(), '两次建场 worldCells 逐块一致');
});

test('沙漠建场: 地表九成列沙+砂岩垫层 · 神殿/绿洲/巢穴占位', () => {
  Maps.advDesertBuild();
  /* 地表抽样: 全图列顶方块分类(植被/水/建筑顶之外的「地表」应为沙) */
  const counts = {};
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) counts[cell(x, colTop(x, z), z)] = (counts[cell(x, colTop(x, z), z)] || 0) + 1;
  }
  const total = W * D;
  assert.ok(counts[8] / total >= 0.9,
      '九成列地表是沙(实测 ' + (counts[8] / total * 100).toFixed(1) + '%, 审查修复 P5 对齐 spec 九成红线)');
  assert.ok(counts[api.B_SANDSTONE] > 0 && counts[api.B_SANDSTONE] / total < 0.2,
      '一成砂岩露头点缀(非铺满)');
  /* 砂岩垫层: 抽样平坦沙列的下 3 格是砂岩、再往下石头 */
  let checked = 0;
  for (let x = 20; x < W && checked < 40; x += 13) {
    for (let z = 20; z < D && checked < 40; z += 11) {
      const y = colTop(x, z);
      if (cell(x, y, z) !== 8 || y !== ADV_GROUND) continue; /* 只验平地沙列 */
      assert.strictEqual(cell(x, y - 1, z), api.B_SANDSTONE, '沙下第 1 格砂岩垫层');
      assert.strictEqual(cell(x, y - 3, z), api.B_SANDSTONE, '垫层 3 格厚');
      assert.strictEqual(cell(x, y - 5, z), 3, '垫层以下是石头');
      checked++;
    }
  }
  assert.ok(checked >= 10, '平地沙列抽样点足够');
  /* 小绿洲水泊: 水面齐 y24 + 湖底沙 */
  const o = Maps.ADV_DESERT.oasis[0];
  assert.strictEqual(cell(o.cx, ADV_GROUND, o.cz), api.B_WATER, '绿洲中心水面 y24');
  assert.strictEqual(cell(o.cx, ADV_GROUND - 1, o.cz), 8, '湖底沙');
  assert.ok(countId(api.B_WATER) > 60, '两处绿洲水体规模');
});

test('沙漠建场: 仙人掌 2-3 高柱 · 枯灌木散布 · 只长沙上', () => {
  Maps.advDesertBuild();
  const cacti = countId(api.B_CACTUS);
  assert.ok(cacti >= 15, '仙人掌柱规模(实测 ' + cacti + ')');
  assert.ok(countId(api.B_DEAD_BUSH) >= 15, '枯灌木散布规模');
  /* 柱高 2-3: 从柱顶格向下数到沙面 */
  const heights = [];
  for (let y = ADV_GROUND + 1; y < ADV_GROUND + 5; y++) {
    for (let z = 1; z < D - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        if (cell(x, y, z) !== api.B_CACTUS) continue;
        if (cell(x, y + 1, z) === api.B_CACTUS) continue; /* 只看柱顶格 */
        let h = 0; let yy = y;
        while (cell(x, yy, z) === api.B_CACTUS) {
          h++; yy--;
        }
        heights.push(h);
      }
    }
  }
  assert.ok(heights.length >= 15, '株数与柱顶扫描一致');
  assert.ok(heights.every((h) => h >= 2 && h <= 3), '柱高一律 2-3(实测集合 ' + [...new Set(heights)] + ')');
  /* 只长沙上: 柱脚下是沙 */
  for (let z = 1; z < D - 1; z += 7) {
    for (let x = 1; x < W - 1; x += 5) {
      const y = colTop(x, z);
      if (cell(x, y, z) === api.B_DEAD_BUSH) assert.strictEqual(cell(x, y - 1, z), 8, '枯灌木脚下是沙');
    }
  }
});

test('沙漠建场: 神殿 — 空心砂岩金字塔(北门)+外楼梯 · 地下宝箱室(B_CHEST+可疑地板+出路楼梯)', () => {
  Maps.advDesertBuild();
  const t = Maps.ADV_DESERT.temple;
  /* 金字塔: 塔底 15×15 **空心**(每级只砌外圈——塔内可入, 审查修复 P1), 塔顶尖格 */
  assert.strictEqual(cell(t.cx, 25, t.cz), 0, '塔底层中心净空(空心塔, 室内可站)');
  assert.strictEqual(cell(t.cx - t.r, 25, t.cz - t.r), api.B_SANDSTONE, '塔底四角齐(外圈)');
  assert.strictEqual(cell(t.cx - t.r + 1, 25, t.cz - t.r + 1), 0, '塔底层内圈净空(空心)');
  assert.strictEqual(cell(t.cx, ADV_GROUND + 8, t.cz), api.B_SANDSTONE, '塔顶(8 级到 y32)');
  assert.strictEqual(cell(t.cx, ADV_GROUND + 9, t.cz), 0, '塔顶之上净空');
  /* 北门: 塔脚北面 2 宽 × 2 高门洞(南有外楼梯/东有出路楼梯, 门开北面) */
  assert.strictEqual(cell(t.cx, 25, t.cz - t.r), 0, '北门洞下格净空');
  assert.strictEqual(cell(t.cx, 26, t.cz - t.r), 0, '北门洞上格净空');
  assert.strictEqual(cell(t.cx - 1, 25, t.cz - t.r), 0, '北门洞 2 宽(西格)');
  assert.strictEqual(cell(t.cx + 2, 25, t.cz - t.r), api.B_SANDSTONE, '门洞旁仍是塔壁');
  /* 外楼梯: 南面 2 宽台阶逐级(相邻高差 1, 顶与塔尖平步相接) */
  for (let i = 0; i <= 6; i++) {
    const z = t.cz + t.r - i;
    const y = 26 + i;
    assert.strictEqual(cell(t.cx, y, z), api.B_SANDSTONE, '楼梯第 ' + i + ' 级(南面嵌塔)');
  }
  assert.strictEqual(cell(t.cx, 32, t.cz + 1), api.B_SANDSTONE, '楼梯末级与塔尖平步相接');
  /* 地下宝箱室: y18~21 室腔 + 砂岩地板/室顶 + 宝箱 + 火把 */
  assert.strictEqual(cell(t.cx, 17, t.cz), api.B_SANDSTONE, '室地板砂岩');
  assert.strictEqual(cell(t.cx, 18, t.cz), 0, '室腔净空');
  assert.strictEqual(cell(t.cx, 20, t.cz), api.B_CHEST, '宝箱在室中央');
  assert.ok(cell(t.cx - 2, 18, t.cz - 2) === api.B_TORCH || cell(t.cx + 2, 18, t.cz + 2) === api.B_TORCH,
      '室内火把(照明防刷怪, 落地站膛防清扫)');
  assert.strictEqual(cell(t.cx, 22, t.cz), 0, '室顶中央 2×2 是竖井空腔(踩塌坠入口)');
  assert.strictEqual(cell(t.cx - 3, 22, t.cz - 3), api.B_SANDSTONE, '室顶其余仍是砂岩');
  /* 可疑地板: 室内地表(y24)中央 2×2 砂岩显眼底板(周围是沙——「颜色不一样的地板」
      踩塌滑落入口, 审查修复 P1: 从埋两层沙下改为室内可见可踩) */
  assert.strictEqual(cell(t.cx - 1, t.trapY, t.cz - 1), api.B_SANDSTONE, '可疑地板 2×2 砂岩(西北格)');
  assert.strictEqual(cell(t.cx, t.trapY, t.cz), api.B_SANDSTONE, '可疑地板 2×2 砂岩(东南格)');
  assert.strictEqual(cell(t.cx - 3, t.trapY, t.cz - 3), 8, '可疑地板周边室内地表是沙');
  assert.strictEqual(cell(t.cx + 3, t.trapY, t.cz + 3), 8, '可疑地板周边室内地表是沙(东南向)');
  /* 踩塌格清单纯函数: 4 格单层, 与 footprint 一致 */
  const cells = Maps.advTempleTrapCells();
  assert.strictEqual(cells.length, 4, '踩塌清单 4 格(单层)');
  assert.ok(cells.every((c) => c.y === t.trapY && Maps.advTempleTrapOn(c.x, c.z)),
      '清单格全在 trapY 层且落在 footprint 内');
  assert.ok(!Maps.advTempleTrapOn(t.cx - 2, t.cz), 'footprint 外不误判');
  /* 出路: 东侧 1 格级楼梯从室底回到地表(矿坑级教训, 不困人) */
  let steps = 0;
  for (let i = 0; i <= 6; i++) {
    const x = t.cx + 4 + i;
    const y = 19 + i;
    if (cell(x, y, t.cz) !== 0 || cell(x, y - 1, t.cz) === 0) continue;
    steps++; /* 净空在, 垫脚在 */
  }
  assert.ok(steps >= 5, '东侧楼梯多数台阶成立(实测 ' + steps + '/7)');
  assert.strictEqual(cell(t.cx + 10, ADV_GROUND, t.cz), 8, '楼梯出口回到地表沙面');
});

test('沙漠建场: 三巢穴沙丘+砂岩点缀+朝南洞口(advMapNest 参数化件)', () => {
  Maps.advDesertBuild();
  for (const n of Maps.ADV_DESERT.nests) {
    const top = colTop(n.x, n.z);
    assert.strictEqual(cell(n.x, top, n.z), 8, '巢丘顶沙');
    assert.ok(top >= ADV_GROUND + 2, '丘高 ≥2(洞口在丘体上)');
    assert.strictEqual(cell(n.x, ADV_GROUND + 1, n.z + 2), 0, '洞口朝南净空(壳 spawn 环带)');
    assert.ok(cell(n.x + 2, ADV_GROUND + 1, n.z) !== 0 && cell(n.x - 2, ADV_GROUND + 1, n.z) !== 0,
        '丘体直径 ≥5(东西丘脚)');
  }
});

/* ============ 建场: 白雪雪原 ============ */

test('雪原建场: 两次建场 worldCells 逐字节一致 + 雪堆起伏(高度场消费, 地表不恒平)', () => {
  clearWorld();
  Maps.advSnowBuild();
  const a = snapshot();
  clearWorld();
  Maps.advSnowBuild();
  assertSameWorld(a, snapshot(), '两次建场 worldCells 逐块一致');
  /* 雪堆起伏: 远离结构的采样线上 colTop 有多种高度(heightAt 幅度 2 生效) */
  const tops = new Set();
  const nest0 = Maps.ADV_SNOW.nests.find((n) => n.z < 30) || Maps.ADV_SNOW.nests[0]; /* 北缘最近巢 */
  for (let x = 4; x < W - 4; x += 3) {
    const z = 6; /* 北缘采样线: 距各压平圆(门/雪屋/湖)中心均 >26 格 */
    if (Math.abs(x - nest0.x) < 30) continue; /* 避北缘巢压平带 */
    tops.add(colTop(x, z));
  }
  assert.ok(tops.size >= 3, '采样线地表高度 ≥3 种(实测 ' + [...tops].sort((p, q) => p - q) + ')');
});

test('雪原建场: 全铺雪覆草 · 冰封小湖(冰面+冰下水) · 云杉树+雪堆点缀', () => {
  Maps.advSnowBuild();
  const counts = {};
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const id = cell(x, colTop(x, z), z);
      counts[id] = (counts[id] || 0) + 1;
    }
  }
  const total = W * D;
  assert.ok(counts[api.B_SNOWY_GRASS] / total >= 0.9,
      '全铺雪覆草(实测 ' + (counts[api.B_SNOWY_GRASS] / total * 100).toFixed(1) + '%)');
  /* 冰封湖: 湖心冰面 y24 + 冰下水体(挖开冰见水) + 湖岸雪覆草 */
  const l = Maps.ADV_SNOW.lakes[0];
  assert.strictEqual(cell(l.cx, ADV_GROUND, l.cz), api.B_ICE, '湖心冰面 y24');
  assert.strictEqual(cell(l.cx, ADV_GROUND - 1, l.cz), api.B_WATER, '冰下第一格水');
  assert.strictEqual(cell(l.cx, ADV_GROUND - 2, l.cz), api.B_WATER, '冰下第二格水');
  assert.strictEqual(cell(l.cx, ADV_GROUND, l.cz + l.r + 2), api.B_SNOWY_GRASS, '湖岸仍是雪覆草');
  assert.ok(countId(api.B_ICE) > 120, '两处冰湖规模(实测 ' + countId(api.B_ICE) + ')');
  /* 云杉: 原木树干成规模(雪原唯一原木来源), 树叶锥冠存在 */
  assert.ok(countId(5) >= 60, '云杉树干规模(实测 ' + countId(5) + ')');
  assert.ok(countId(7) >= 150, '锥形叶冠规模(实测 ' + countId(7) + ')');
  /* 雪堆点缀: 雪块散布在雪覆草之上(挖掉得雪球, 雪仗弹药) */
  assert.ok(countId(api.B_SNOW, (x, y, z) => cell(x, y - 1, z) === api.B_SNOWY_GRASS) >= 50,
      '雪堆点缀长在雪覆草上');
});

test('雪原建场: 雪屋 — 雪块圆顶+南门洞+室内净空 · 地下宝箱室(B_CHEST+火把+出路楼梯)', () => {
  Maps.advSnowBuild();
  const h = Maps.ADV_SNOW.hut;
  assert.strictEqual(cell(h.cx, ADV_GROUND + 4, h.cz), api.B_SNOW, '圆顶壳顶');
  assert.strictEqual(cell(h.cx, ADV_GROUND + 2, h.cz), 0, '室内净空(壳内掏空)');
  assert.strictEqual(cell(h.cx - 1, ADV_GROUND + 1, h.cz + h.r), 0, '门洞朝南 2 宽');
  assert.strictEqual(cell(h.cx, ADV_GROUND + 2, h.cz + h.r), 0, '门洞 2 高');
  /* 地下宝箱室 */
  assert.strictEqual(cell(h.cx, 20, h.cz), api.B_CHEST, '地下宝箱');
  assert.strictEqual(cell(h.cx - 1, 19, h.cz - 1), api.B_TORCH, '室内火把(落地站膛防清扫)');
  assert.strictEqual(cell(h.cx, 19, h.cz), 0, '室腔净空');
  /* 出路: 东侧 1 宽竖井台阶(y19→y24 相邻高差 1) */
  let steps = 0;
  for (let i = 0; i <= 5; i++) {
    const x = h.cx + 3 + i; const y = 19 + i;
    if (cell(x, y, h.cz) === 0 && cell(x, y - 1, h.cz) !== 0) steps++;
  }
  assert.ok(steps >= 4, '出路台阶多数成立(实测 ' + steps + '/6)');
});

test('雪原建场: 三巢穴雪块丘+石头点缀+朝南洞口', () => {
  Maps.advSnowBuild();
  for (const n of Maps.ADV_SNOW.nests) {
    const top = colTop(n.x, n.z);
    assert.strictEqual(cell(n.x, top, n.z), api.B_SNOW, '巢丘顶雪块');
    assert.ok(top >= ADV_GROUND + 2, '丘高 ≥2');
    assert.strictEqual(cell(n.x, ADV_GROUND + 1, n.z + 2), 0, '洞口朝南');
  }
});

/* ============ 建场: 青苔沼泽 ============ */

test('沼泽建场: 两次建场 worldCells 逐字节一致(确定性红线)', () => {
  clearWorld();
  Maps.advSwampBuild();
  const a = snapshot();
  clearWorld();
  Maps.advSwampBuild();
  assertSameWorld(a, snapshot(), '两次建场 worldCells 逐块一致');
});

test('沼泽建场: 浅水洼+泥岸 · 垂藤橡树(从简口径) · 兰花散布(唯一产地)', () => {
  Maps.advSwampBuild();
  /* 浅水洼: 洼心水面齐 y24 可趟 + 泥底; 洼外一圈泥岸 */
  const p = Maps.ADV_SWAMP.pools[0];
  assert.strictEqual(cell(p.cx, ADV_GROUND, p.cz), api.B_WATER, '洼心水面 y24(浅水)');
  assert.strictEqual(cell(p.cx, ADV_GROUND - 1, p.cz), 2, '洼底泥');
  assert.ok(countId(api.B_WATER) > 120, '五处水洼规模(实测 ' + countId(api.B_WATER) + ')');
  const shore = {found: false};
  for (let dx = -p.r - 1; dx <= p.r + 1 && !shore.found; dx++) {
    for (let dz = -p.r - 1; dz <= p.r + 1 && !shore.found; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > p.r && d <= p.r + 1.2 && cell(p.cx + dx, ADV_GROUND, p.cz + dz) === 2) shore.found = true;
    }
  }
  assert.ok(shore.found, '水洼外圈泥岸');
  /* 垂藤橡树: 橡树树形(SceneKit.tree)成规模——垂藤从简=暗绿观感留给 T6 调色板 */
  assert.ok(countId(5) >= 40, '橡树树干规模(实测 ' + countId(5) + ')');
  assert.ok(countId(7) >= 120, '橡树冠规模(实测 ' + countId(7) + ')');
  /* 兰花: 沼泽唯一产地, 只长草上 */
  const orchid = countId(api.B_ORCHID, (x, y, z) => cell(x, y - 1, z) === 1);
  assert.ok(orchid >= 20, '兰花散布规模且脚下是草(实测 ' + orchid + ')');
});

test('沼泽建场: 女巫小屋 — 高脚木屋(原木柱脚+木板屋体) + 宝箱 + 门洞 · 两巢穴泥丘', () => {
  Maps.advSwampBuild();
  const h = Maps.ADV_SWAMP.hut;
  /* 高脚: 原木柱脚从地面撑起屋体 */
  assert.strictEqual(cell(h.x - 2, ADV_GROUND + 1, h.z - 1), 5, '柱脚原木 y25');
  assert.strictEqual(cell(h.x - 2, ADV_GROUND + 3, h.z - 1), 5, '柱脚原木到屋底 y27');
  assert.strictEqual(cell(h.x - 2, ADV_GROUND + 4, h.z - 1), 6, '屋体地板木板 y28');
  assert.strictEqual(cell(h.x, ADV_GROUND + 5, h.z), 0, '屋内净空');
  assert.strictEqual(cell(h.x, ADV_GROUND + 7, h.z), 6, '木板屋顶 y31');
  assert.strictEqual(cell(h.x - 2, ADV_GROUND + 5, h.z + 2), 6, '南墙木板');
  assert.strictEqual(cell(h.x, ADV_GROUND + 4, h.z), api.B_CHEST, '屋内宝箱');
  assert.strictEqual(cell(h.x - 2, ADV_GROUND + 5, h.z - 1), api.B_TORCH, '屋内火把(西墙)');
  /* 门洞朝南 + 台阶进门(高脚屋地板 y28, 台阶 1 格级上到门口) */
  assert.strictEqual(cell(h.x, ADV_GROUND + 5, h.z + 2), 0, '门洞 2 高下格');
  assert.strictEqual(cell(h.x, ADV_GROUND + 6, h.z + 2), 0, '门洞上格');
  assert.strictEqual(cell(h.x, ADV_GROUND + 1, h.z + 5), 6, '进屋台阶第 1 级');
  assert.strictEqual(cell(h.x, ADV_GROUND + 3, h.z + 3), 6, '台阶末级(平步入地板)');
  /* 巢穴: 泥丘+苔石点缀(与 home 巢同款观感) */
  for (const n of Maps.ADV_SWAMP.nests) {
    const top = colTop(n.x, n.z);
    assert.ok(top >= ADV_GROUND + 2, '丘高 ≥2');
    assert.strictEqual(cell(n.x, ADV_GROUND + 1, n.z + 2), 0, '洞口朝南');
  }
});

/* ============ 门位完整性(对建场后的真实世界断言, 票据验收) ============ */

test('门位: 四图门位不落水 · 地表压平净空不撞结构(T7 门体的落位前提)', () => {
  /* 各图地表方块清单(home 含 T5 门阵广场的圆石铺装) */
  const groundOf = {home: [1, 4], desert: [8], snow: [api.B_SNOWY_GRASS], swamp: [1]};
  for (const r of Maps.ADV_MAPS) {
    clearWorld();
    r.build(); /* 该图真实建场 */
    for (const g of r.gates) {
      const x1 = g.px - 1; const x2 = g.px + ADV_PORTAL.w; /* 含塔楼/步道的包围盒 */
      const z1 = g.pz - 1; const z2 = g.pz + 1;
      for (let x = x1; x <= x2; x++) {
        for (let z = z1; z <= z2; z++) {
          assert.notStrictEqual(cell(x, ADV_GROUND, z), api.B_WATER,
              r.id + ' 门(' + g.to + ') 不落水 @(' + x + ',' + z + ')');
          assert.ok(groundOf[r.id].includes(cell(x, ADV_GROUND, z)),
              r.id + ' 门区地表压平为' + r.name + '地表 @(' + x + ',' + z + ')=' + cell(x, ADV_GROUND, z));
          for (let y = ADV_GROUND + 1; y <= ADV_GROUND + ADV_PORTAL.h + 2; y++) {
            const id = cell(x, y, z);
            const ok = id === 0 || (r.id === 'home' && id === api.B_GRASS_TUFT); /* home 现散布场
              允许 thin 草丛(solid:false 不挡门体, T7 门基座覆盖; T5 重排后压平区不再散草) */
            assert.ok(ok, r.id + ' 门区净空(不撞结构/植被) @(' + x + ',' + y + ',' + z + ')=' + id);
          }
        }
      }
      /* 落点走廊: 门南侧到落点+2 格也是平地净空(advMapArrive 的面朝外前提) */
      const a = Maps.advMapArrive(r.id === 'home' ? Maps.ADV_MAPS.find((m) => m.id === 'desert') : r);
      if (r.id !== 'home') {
        for (let z = g.pz + 1; z <= Math.floor(a.z) + 2; z++) {
          assert.ok(groundOf[r.id].includes(cell(g.px + 2, ADV_GROUND, z)),
              r.id + ' 落点走廊地表 @(' + (g.px + 2) + ',' + z + ')');
          assert.strictEqual(cell(g.px + 2, ADV_GROUND + 1, z), 0, r.id + ' 落点走廊净空');
          assert.strictEqual(cell(g.px + 3, ADV_GROUND + 1, z), 0, r.id + ' 落点走廊净空(东列)');
        }
      }
    }
  }
});


