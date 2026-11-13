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
   test/adventure-nether.test.js(随迁移重指 Dims), 不在此重复。
   T-SEAM-01 扩段: town 维度行(§6.3.3 行规格表)——行完备性三行/值锚
   (暖亮白天四参+spawn 从 TOWN_MAP 派生)/build 懒引锁(装配件不迁)/
   ADV_TOWN 单份权威(=== 同对象引用+定义段零坐标字面量)/炉键 town 占空/
   ADV_SCENE_KEYS 派生集含 town(showroom/livestock/decode 自动跟随)/
   三条全局判据零新分支/index.html 加载序上移/AudioRegistry calm 在册。
   装具加 town 系(vm 补装 town-map/assembly/mode+prefab-kit, 引擎缝桩;
   TOWN_MAP 提取挂 Node 全局——ADV_TOWN 加载期派生须先于 require Dims)。 */
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
  B_ANCIENT_DEBRIS, /* 远古残骸(装备 T7): advNetherBuild 地下层散布经全局名消费 */
  B_LOOT_CHEST_SMALL, /* 宝箱室小宝箱(D19: advDenBuild 建场引用) */
  B_PORTAL, B_NETHER_BRICK,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */
/* 刷怪三件(候选 2): advEruptStep/advDenStep 薄壳经全局名消费(波次环带掷点在 advDenWavePlan 内组装) */
Object.assign(globalThis, require('../js/adventure-spawn-core.js'));
/* 上一层共享词法: ADV_PORTAL/advPortalFrame/advOreSpotsReset/advTryOre/advOreSpots */
Object.assign(globalThis, require('../js/adventure-core.js'));

/* ---------- town 维度装具(T-SEAM-01) ----------
   town 行 build 闭包懒引 js/modes/town.js 的 townBuild(装配件不迁, T-SEAM-05 才
   迁 dims-core)——vm 域补装 town 系真件(prefab-kit/assembly/map-core/mode, 装
   载序= town-mode.test.js townBoot 同款); 引擎缝用桩(mkMode 透传 / ModeKit.spawn
   记录 / loadScene/requestLock 空实现——town.js 顶层只调 mkMode, townBuild 末尾
   调 ModeKit.spawn)。TOWN_MAP/townBuild 提取挂 Node 全局: ADV_TOWN 加载期派生
   读 TOWN_MAP(必须在 require Dims 之前就位, nether/den 结构常量同款口径), 行
   build 调用期经全局名解析 townBuild(CJS 域无经典 script 词法共享)。 */
vm.runInContext('var mkMode = (cfg) => Object.assign({}, cfg); var ModeKit = {spawn() {}}; ' +
  'var loadScene = () => {}; var requestLock = () => {};', eng);
for (const f of ['js/prefab-kit.js', 'js/town-assembly-core.js', 'js/town-map-core.js', 'js/modes/town.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
Object.assign(globalThis, vm.runInContext('({TOWN_MAP, townBuild, townSpawnIntent, townYawOfFace})', eng));

const Dims = require('../js/adventure-dims-core.js');

const snapshot = () => Buffer.from(vm.runInContext('worldCells', eng));
const clearWorld = () => vm.runInContext('worldCells.fill(0)', eng);
const ROW_KEYS = ['id', 'build', 'sky', 'mood', 'dayCycle', 'spawn', 'hud', 'assets'];

/* ============ 行完备性(手滑防线主战场: 新维度行缺键即红) ============ */

test('注册表行完备性: 三行 · id 唯一且非 overworld · 八键齐全 · 子形状合法', () => {
  assert.strictEqual(Dims.ADV_DIMS.length, 3, '三维度行(nether/den/town)');
  const ids = Dims.ADV_DIMS.map((r) => r.id);
  assert.deepStrictEqual(ids, ['nether', 'den', 'town'], 'id 集与顺序钉死(桶键派生消费此序)');
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
  assert.strictEqual(Dims.advDimRow('town'), Dims.ADV_DIMS[2], 'advDimRow 取行');
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
  assert.strictEqual(Dims.advMusicMood('town', false), 'calm', '小镇恒 calm(AudioRegistry calm-piano 在册)');
  assert.strictEqual(Dims.advMusicMood('town', true), 'calm', '小镇不随昼夜变(dayCycle 冻结, 恒白天)');
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

/* ============ 副本刷新判据(D20→D23 两日窗口, 真实日历日键注入) ============ */

test('副本刷新判据·两日窗口: 建局日/次日续局原样带出 · 第三日/首日/老档归全新(状态归零)', () => {
  const prev = {day: '2026-10-30', wave: 3, chestDone: false, deadGuards: [2, 5]};
  /* 建局日当天: 续局——状态原样(怪尸/波次/通关旗都保持) */
  assert.deepStrictEqual(Dims.advDenDailyStep(prev, '2026-10-30', '2026-10-29'),
      {fresh: false, state: prev}, '建局日 = 续局(fresh:false)');
  /* 窗口第二天: 仍续局(D23 两日窗口——一天打不完, 放宽到两天) */
  assert.deepStrictEqual(Dims.advDenDailyStep(prev, '2026-10-31', '2026-10-30'),
      {fresh: false, state: prev}, '次日 = 仍在窗口内续局(D23)');
  /* 第三日: 出窗——全新(波次回 1/旗清/尸账清) */
  assert.deepStrictEqual(Dims.advDenDailyStep(prev, '2026-11-01', '2026-10-31'),
      {fresh: true, state: {day: '2026-11-01', wave: 1, chestDone: false, deadGuards: []}},
      '第三日 = 两日窗口翻篇一切还原(D23 拍板)');
  /* 老档/坏档(null): 首进即全新 */
  assert.deepStrictEqual(Dims.advDenDailyStep(null, '2026-10-30', '2026-10-29').fresh, true,
      '无档 = 全新(老档兼容)');
  /* 兼容口径: 不传 yesterday = 旧每日语义(次日即翻篇)——老调用零改动 */
  assert.strictEqual(Dims.advDenDailyStep(prev, '2026-10-31').fresh, true,
      '缺 yesterday 参数 = 旧每日口径(次日全新, 向后兼容)');
  /* 断档跳跃(隔两天再进): 全新且日键重锚 */
  assert.strictEqual(Dims.advDenDailyStep(prev, '2026-11-05', '2026-11-04').fresh, true,
      '长期缺席再进 = 全新(窗口按最新建局日重开)');
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

/* ============ town 维度行(T-SEAM-01, docs/town-map-design.md §6.3.3 行规格表) ============ */

test('town 行值锚: 暖亮白天四参/mood calm/恒白天/HUD 无怪/spawn 从 TOWN_MAP 加载期派生', () => {
  const t = Dims.advDimRow('town');
  assert.ok(t, 'town 行在册(§6.3.3 逐字段)');
  assert.deepStrictEqual(t.sky, {color: 0x7ec8e3, fogNear: 90, fogFar: 230, sunI: 0.85},
      'town 天穹(视觉 spec §4.1 布幔-天蓝暖亮色板; 雾距对齐上界同域, sunI 恒白天亮堂)');
  assert.strictEqual(t.mood, 'calm', '曲目 calm(沿用旧模式注册表行 mood 键)');
  assert.strictEqual(t.dayCycle, false,
      'dayCycle:false=时间冻结+天体隐藏+基底亮光, ≠恒夜——暗 sky 参才是恒夜, town 暖亮即恒白天(§6.3.3)');
  assert.strictEqual(t.hud.banner, '🏘️ 小镇 · Midport Village', 'HUD 横幅(文案终稿归 ui-designer, 现值锁)');
  assert.strictEqual(t.hud.showMobs, false, '无怪隐怪物行(§6.3.4 机制无怪=因, 行参隐行=观感果)');
  assert.strictEqual(t.assets, null, '副本素材预留缝不启用(GLOSSARY 占坑纪律)');
  const a = TOWN_MAP.anchors.find((x) => x.id === 'spawn');
  assert.ok(a, 'TOWN_MAP.anchors spawn 锚在场(装具自检)');
  assert.deepStrictEqual(t.spawn, {x: a.x, y: TOWN_MAP.core.groundY + 1, z: a.z, yaw: 0},
      'spawn 派生自 TOWN_MAP(南主路 spawn 锚, y=groundY+1 站立面; 坐标权威不在此行)');
  assert.strictEqual(t.spawn.yaw, townYawOfFace(a.face),
      'yaw= townYawOfFace(spawn 锚 face) 派生口径(face:north→yaw 0)');
  assert.deepStrictEqual(t.spawn, (({x, y, z, yaw}) => ({x, y, z, yaw}))(townSpawnIntent()),
      '行 spawn 与 townSpawnIntent 出生意图同值(两派生面同口径活锁)');
});

test('town 行 build=现有装配件链懒引(装配件不迁住 js/modes/town.js, T-SEAM-05 才迁)· 真实建场可执行', () => {
  const t = Dims.advDimRow('town');
  const dimsSrc = fs.readFileSync(path.join(ROOT, 'js/adventure-dims-core.js'), 'utf8');
  for (const fn of ['TOWN_PHASE_ORDER', 'townYawOfFace', 'townSpawnIntent',
    'townAssemblyPhases', 'townConsumeOp', 'townBuild']) {
    assert.ok(!(new RegExp('(function ' + fn + '\\b|const ' + fn + ' *=)').test(dimsSrc)),
        '装配件「' + fn + '」不在 dims-core 定义(单份权威, 提前迁移=越 T-SEAM-05 节拍)');
  }
  assert.ok(dimsSrc.includes('townBuild()'), 'build 闭包懒引 townBuild(调用期解析)');
  clearWorld();
  t.build(); /* 真实执行: townAssemblyOps(townBuildSteps()) 逐 op 经 townConsumeOp + 出生收口 */
  assert.ok(snapshot().some((v) => v !== 0), 'town 建场真实写入世界(非空操作)');
});

test('ADV_TOWN 单份权威: core/spawnAnchor 引用 TOWN_MAP 同对象(不抄第二份坐标)· 定义段零坐标字面量', () => {
  assert.ok(Dims.ADV_TOWN, 'ADV_TOWN 结构常量在册并导出(行 spawn 加载期派生的坐标系)');
  assert.strictEqual(Dims.ADV_TOWN.core, TOWN_MAP.core,
      'core 引用 TOWN_MAP.core(=== 同对象引用, 拷贝即抄第二份)');
  const a = TOWN_MAP.anchors.find((x) => x.id === 'spawn');
  assert.strictEqual(Dims.ADV_TOWN.spawnAnchor, a,
      'spawnAnchor 引用 TOWN_MAP.anchors spawn 锚(=== 同对象引用)');
  const dimsSrc = fs.readFileSync(path.join(ROOT, 'js/adventure-dims-core.js'), 'utf8');
  const seg = dimsSrc.slice(dimsSrc.indexOf('ADV_TOWN'), dimsSrc.indexOf('const ADV_DIMS'));
  assert.ok(seg.includes('TOWN_MAP.core') && seg.includes('TOWN_MAP.anchors'),
      'ADV_TOWN 定义段显式派生引用 TOWN_MAP(core/groundY 与 spawn 全引权威)');
  assert.ok(!/[xyz]1?\s*:\s*-?\d/.test(seg) && !/groundY\s*:\s*\d/.test(seg),
      'ADV_TOWN 定义段零坐标字面量(出现第二份坐标即红)');
});

test('炉键守门: town 键位占空(空串无前缀, 镇内无熔炉内容物)', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'js/modes/adventure.js'), 'utf8');
  const line = shell.split('\n').find((l) => l.includes('const ADV_FURN_PREFIX ='));
  assert.ok(/town\s*:\s*''/.test(line), '前缀表 town 键占空(空串=无前缀; ADV_FURN_PREFIXED 派生自动不收空串)');
});

test('ADV_SCENE_KEYS 派生集含 town: 壳层两注册表派生/showroom/livestock/decode 兜底自动跟随(残留#5 验证)', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'js/modes/adventure.js'), 'utf8');
  assert.ok(/ADV_SCENE_KEYS\s*=\s*ADV_MAPS\.map\(\(r\) => r\.id\)/.test(shell) &&
      /concat\(ADV_DIMS\.map\(\(r\) => r\.id\)\)/.test(shell),
  '壳层 ADV_SCENE_KEYS=两注册表派生(零手抄——town 行在册即自动纳入)');
  Object.assign(globalThis, require('../js/adventure-maps-core.js'));
  globalThis.ADV_DIMS = Dims.ADV_DIMS;
  const Showroom = require('../js/showroom-core.js');
  assert.ok(Showroom.showroomSceneKeys().includes('town'),
      'showroomSceneKeys 真调用含 town(挂真注册表走派生分支——showroom 桶自动跟随)');
  assert.ok(/ADV_SCENE_KEYS\.reduce\(\(o, k\)/.test(shell),
      'livestock/桶集从 ADV_SCENE_KEYS 派生(加维度零手抄, 桶自动跟随)');
  const coreSrc = fs.readFileSync(path.join(ROOT, 'js/adventure-core.js'), 'utf8');
  assert.ok(/ADV_DIMS\.map\(\(r\) => r\.id\)/.test(coreSrc),
      'decode 兜底三级回退含 ADV_DIMS 派生(adventure-core 键白名单)');
});

test('showroomSceneKeys 回落清单含 town: 回落面与派生面一致(两回落分支对齐 nether/den 条目形状)', () => {
  /* 干净 vm 域(零注册表零污染): 复刻纯 Node 回落环境, 真调用回落分支 */
  const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/showroom-core.js'), 'utf8'), eng,
      {filename: 'js/showroom-core.js'});
  const keys0 = vm.runInContext('showroomSceneKeys()', eng);
  assert.ok(Array.isArray(keys0) && keys0.includes('home') && keys0.includes('nether') &&
      keys0.includes('den'), '零注册表走固定清单(回落分支自检在册)');
  assert.ok(keys0.includes('town'), '零注册表回落清单含 town(与派生面一致——showroom 桶回落环境不缺 town)');
  vm.runInContext('ADV_MAPS = [{id: \'home\'}]', eng);
  const keys1 = vm.runInContext('showroomSceneKeys()', eng);
  assert.ok(keys1.includes('nether') && keys1.includes('den'),
      'dims 内层回落分支自检在册(ADV_MAPS 在场 ADV_DIMS 缺席)');
  assert.ok(keys1.includes('town'), 'ADV_DIMS 缺席的 dims 回落清单含 town(对齐 nether/den 条目形状)');
});

test('三条全局判据零新分支: 维度判据无 town 特判(pos 不进档/死亡单分支/分桶派生)', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'js/modes/adventure.js'), 'utf8');
  const coreSrc = fs.readFileSync(path.join(ROOT, 'js/adventure-core.js'), 'utf8');
  const dimsSrc = fs.readFileSync(path.join(ROOT, 'js/adventure-dims-core.js'), 'utf8');
  assert.ok(!/advDim\s*[!=]==?\s*'town'/.test(shell), '壳层维度判据零 town 特判(不变量不是每维政策)');
  assert.ok(!/advDim\s*[!=]==?\s*'town'/.test(coreSrc), '核心维度判据零 town 特判');
  assert.ok(!/advDim\s*[!=]==?\s*'town'/.test(dimsSrc), 'dims-core 维度判据零 town 特判');
  const posLines = shell.split('\n').filter((l) => l.includes('advDim !== \'overworld\' ? null'));
  assert.ok(posLines.length >= 2, 'pos 不进档单点判据在册(journal payload + advSaveView 同判据)');
  const deadLine = shell.split('\n').filter((l) => l.includes('if (advDim !== \'overworld\')'));
  assert.ok(deadLine.length >= 1, '死亡语义单分支在册(切回主世界回家, 镇内无伤害源不触发)');
});

test('加载序: town-map-core 上移至 adventure-maps-core 之后 adventure-dims-core 之前(ADV_TOWN 加载期派生读 TOWN_MAP)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = (f) => html.indexOf('src="' + f + '"');
  assert.ok(at('js/adventure-maps-core.js') > 0, 'adventure-maps-core 在场(装具自检)');
  assert.ok(at('js/town-map-core.js') > 0, 'town-map-core 在场');
  assert.ok(at('js/adventure-dims-core.js') > 0, 'adventure-dims-core 在场');
  assert.ok(at('js/adventure-maps-core.js') < at('js/town-map-core.js'),
      'town-map-core 必须晚于 adventure-maps-core(script 序即依赖序, ADV_TOWN 派生读 TOWN_MAP)');
  assert.ok(at('js/town-map-core.js') < at('js/adventure-dims-core.js'),
      'town-map-core 必须先于 adventure-dims-core(加载期派生, nether/den 结构常量同款口径)');
});

test('AudioRegistry mood:calm 曲目在册(town 行 mood 键有曲可依, 残留#1 核对不阻塞)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/audio-registry.js'), 'utf8');
  assert.ok(/mood:\s*'calm'/.test(src), 'AudioRegistry 存在 calm 曲目(缺曲才登记音频资产线补曲票)');
});
