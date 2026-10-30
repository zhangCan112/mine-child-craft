'use strict';
/* 维度规格核心 (js/adventure-dims-core.js) 单测 — node --test (零依赖)
   运行: node --test test/adventure-dims-core.test.js
   S1 同名单测(conventions §1.2 守门): 镜像 test/adventure-maps-core.test.js 的
   vm 惯例——先装真引擎件, 再把 adventure-core 的导出挂进 Node 全局
   (经典 script 共享词法环境的复刻: 本模块经全局名读 advPortalFrame/
   advOreSpotsReset/advTryOre 等), 后 require 本模块直测。行完备性/
   迁移等价锁(天穹与落点逐字)/mood 桥接/行建场确定性(经行 interface
   build 闭包驱动)/炉键前缀守门(源文本, 壳层 ADV_FURN_PREFIX 键集 ⊇
   维度行 id)。建场逐格断言在 test/adventure-den.test.js 与
   test/adventure-nether.test.js(随迁移重指 Dims), 不在此重复。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 真引擎件: 与 adventure-maps-core.test.js 同一套 vm 惯例 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, SceneKit, Daylight, BLOCKS,
  WORLD_W, WORLD_D, WORLD_H,
  B_NETHERRACK, B_LAVA, B_GLOWSTONE, B_SPAWNER, B_OBSIDIAN, B_CHEST, B_TORCH,
  B_PORTAL, B_NETHER_BRICK,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */
/* 刷怪三件(候选 2): advEruptStep/advDenStep 薄壳经全局名消费(波次环带掷点在 advDenWavePlan 内组装) */
Object.assign(globalThis, require('../js/adventure-spawn-core.js'));
/* 上一层共享词法: ADV_PORTAL/advPortalFrame/advOreSpotsReset/advTryOre/advOreSpots */
Object.assign(globalThis, require('../js/adventure-core.js'));

const Dims = require('../js/adventure-dims-core.js');

const snapshot = () => Buffer.from(vm.runInContext('worldCells', eng));
const clearWorld = () => vm.runInContext('worldCells.fill(0)', eng);
const ROW_KEYS = ['id', 'build', 'sky', 'mood', 'dayCycle', 'spawn', 'hud', 'assets'];

/* ============ 行完备性(手滑防线主战场: 新维度行缺键即红) ============ */

test('注册表行完备性: 两行 · id 唯一且非 overworld · 八键齐全 · 子形状合法', () => {
  assert.strictEqual(Dims.ADV_DIMS.length, 2, '两维度行(nether/den)');
  const ids = Dims.ADV_DIMS.map((r) => r.id);
  assert.deepStrictEqual(ids, ['nether', 'den'], 'id 集与顺序钉死(桶键派生消费此序)');
  assert.ok(new Set(ids).size === ids.length, 'id 唯一');
  for (const r of Dims.ADV_DIMS) {
    for (const k of ROW_KEYS) assert.ok(r[k] !== undefined, r.id + ' 行缺键 ' + k);
    assert.strictEqual(typeof r.build, 'function', r.id + ' build 是建场闭包');
    assert.strictEqual(typeof r.sky.color, 'number', r.id + ' sky.color');
    assert.ok(r.sky.fogNear > 0 && r.sky.fogFar > r.sky.fogNear, r.id + ' sky 雾距序');
    assert.ok(r.sky.sunI > 0 && r.sky.sunI < 1, r.id + ' sky.sunI 域');
    assert.strictEqual(typeof r.mood, 'string', r.id + ' mood');
    assert.strictEqual(r.dayCycle, false, r.id + ' 维度恒停昼夜(D10/D6 口径)');
    for (const f of ['x', 'y', 'z', 'yaw']) assert.strictEqual(typeof r.spawn[f], 'number', r.id + ' spawn.' + f);
    assert.strictEqual(typeof r.hud.banner, 'string', r.id + ' hud.banner');
    assert.ok(r.hud.banner.length > 0, r.id + ' 横幅非空');
    assert.strictEqual(typeof r.hud.showMobs, 'boolean', r.id + ' hud.showMobs');
    assert.strictEqual(r.assets, null, r.id + ' assets 预留缝=null(走缺省方块集, GLOSSARY『副本素材』)');
  }
  assert.strictEqual(Dims.advDimRow('nether'), Dims.ADV_DIMS[0], 'advDimRow 取行');
  assert.strictEqual(Dims.advDimRow('den'), Dims.ADV_DIMS[1], 'advDimRow 取行');
  assert.strictEqual(Dims.advDimRow('overworld'), undefined, 'overworld 无行(主世界不是维度相位)');
});

/* ============ 迁移等价锁(收口票红线: 行为逐字等价, 值锚死) ============ */

test('迁移等价: 天穹/落点/曲目与收口前逐字同值(spawn 从结构常量派生)', () => {
  const [n, d] = Dims.ADV_DIMS;
  assert.deepStrictEqual(n.sky, {color: 0x2a0a08, fogNear: 26, fogFar: 120, sunI: 0.3},
      'nether 天穹(原壳层 ADV_SKY_NETHER)');
  assert.deepStrictEqual(d.sky, {color: 0x07040a, fogNear: 18, fogFar: 80, sunI: 0.12},
      'den 天穹(原壳层 ADV_SKY_DEN)');
  assert.deepStrictEqual(n.spawn, {x: Dims.ADV_NETHER.base.x, y: Dims.ADV_NETHER.ground + 1,
    z: Dims.ADV_NETHER.base.z, yaw: Math.PI}, 'nether 落点=结构常量派生');
  assert.deepStrictEqual(d.spawn, {x: Dims.ADV_DEN.base.x, y: Dims.ADV_DEN.ground + 1,
    z: Dims.ADV_DEN.base.z, yaw: Math.PI}, 'den 落点=结构常量派生');
  assert.strictEqual(n.mood, 'nether', 'nether 曲目');
  assert.strictEqual(d.mood, 'nether', 'den 曲目(den-nest D13: 洞穴语义同源)');
  assert.strictEqual(n.hud.showMobs, false, '下界无怪不显怪物行');
  assert.strictEqual(d.hud.showMobs, true, '副本有怪照显(配额观感)');
});

/* ============ mood 桥接(迁自 adventure-core.test, 补 den 断言) ============ */

test('场景 BGM advMusicMood: 维度行恒行值 · 上界夜=night · 上界昼=adventure', () => {
  assert.strictEqual(Dims.advMusicMood('overworld', false), 'adventure', '上界白天');
  assert.strictEqual(Dims.advMusicMood('overworld', true), 'night', '上界夜晚');
  assert.strictEqual(Dims.advMusicMood('nether', false), 'nether', '下界恒 nether');
  assert.strictEqual(Dims.advMusicMood('nether', true), 'nether', '下界不随昼夜变');
  assert.strictEqual(Dims.advMusicMood('den', false), 'nether', '副本恒 nether(D13)');
  assert.strictEqual(Dims.advMusicMood('den', true), 'nether', '副本不随昼夜变');
});

/* ============ 行建场确定性(经行 interface 驱动, 不旁敲实现) ============ */

test('行 build 建场确定性: 两维度各两遍逐字节一致(确定性重放红线)', () => {
  for (const r of Dims.ADV_DIMS) {
    clearWorld();
    if (r.id === 'den') globalThis.advOreSpotsReset(); /* 与壳层 advSetDim 同拍(白名单是建场期累积账) */
    r.build();
    const a = snapshot();
    clearWorld();
    if (r.id === 'den') globalThis.advOreSpotsReset();
    r.build();
    assert.deepStrictEqual(a, snapshot(), r.id + ' 两次建场 worldCells 逐块一致');
    if (r.id === 'den') globalThis.advOreSpotsReset(); /* 收尾清账不外溢 */
  }
});

/* ============ 炉键前缀守门(源文本: 壳层 ADV_FURN_PREFIX 键集 ⊇ 维度行 id) ============ */

test('炉键前缀守门: ADV_FURN_PREFIX 单份权威键集覆盖全部维度行(新维度忘配即红)', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'js/modes/adventure.js'), 'utf8');
  const line = shell.split('\n').find((l) => l.includes('const ADV_FURN_PREFIX ='));
  assert.ok(line, '壳层 ADV_FURN_PREFIX 表存在(S2 单份权威)');
  for (const r of Dims.ADV_DIMS) {
    assert.ok(line.includes(r.id + ':'), '前缀表含维度键 ' + r.id + '(炉键分桶缺配=串档事故)');
  }
});
