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
   (暖亮白天四参+spawn 从 TOWN_MAP 派生)/ADV_TOWN 单份权威(=== 同对象
   引用+定义段零坐标字面量)/炉键 town 占空/
   ADV_SCENE_KEYS 派生集含 town(showroom/livestock/decode 自动跟随)/
   三条全局判据零新分支/index.html 加载序上移/AudioRegistry calm 在册。
   T-SEAM-05 迁段: town 建场六装配件机械迁入 dims-core 维度段(ADR-0011
   决策 6b), 同名单测约定=函数住哪文件测试住哪——装配序/装配容错/出生
   意图/面向协议/拼装落地/世界层见证随迁本文件(原 test/town-mode.test.js
   随模式壳退场, 撤卡/注册面断言归 test/mode-registry.test.js 撤卡收口段)。
   装具加 town 系(vm 补装 town-map/assembly/prefab-kit 纯件提取挂全局+
   ModeKit 记录桩; townBuild 等改走模块导出——TOWN_MAP 提取挂 Node 全局
   仍须先于 require Dims, ADV_TOWN 加载期派生)。 */
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

/* ---------- town 维度装具(T-SEAM-05 迁入语境) ----------
   town 建场六装配件已机械迁入 dims-core 维度段(ADR-0011 决策 6b), js/modes/
   town.js 模式壳退场——vm 域只补装 town 系纯件(prefab-kit/assembly/map-core;
   townBuildSteps/townAssemblyOps 由 townBuild 建场期经全局名消费, PrefabKit
   由 townConsumeOp place op 消费); 模式壳四桩(mkMode/ModeKit/loadScene/
   requestLock)随壳退场——出生断言走 CJS 域 ModeKit 记录桩(随迁段头部自带,
   townBuild 调用期解析)。TOWN_MAP/townBuildSteps/townAssemblyOps/PrefabKit
   提取挂 Node 全局: ADV_TOWN 加载期派生读 TOWN_MAP(必须在 require Dims 之前
   就位, nether/den 结构常量同款口径), Dims.townBuild 建场期经全局名解析
   townBuildSteps/townAssemblyOps/PrefabKit(CJS 域无经典 script 词法共享)。 */
for (const f of ['js/prefab-kit.js', 'js/town-assembly-core.js', 'js/town-map-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
Object.assign(globalThis, vm.runInContext('({TOWN_MAP, townBuildSteps, townAssemblyOps, PrefabKit})', eng));

const Dims = require('../js/adventure-dims-core.js');
/* townSpawnIntent/townYawOfFace 同走模块导出上全局(既有行 spawn 值锚断言裸名解析;
   六装配件已迁 dims-core, CJS 域从导出取——town.js 退场后 eng 域无此二名) */
Object.assign(globalThis, {townSpawnIntent: Dims.townSpawnIntent, townYawOfFace: Dims.townYawOfFace});

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

test('town 行值锚: 午后暖阳四参/mood calm/恒白天/HUD 无怪/spawn 从 TOWN_MAP 加载期派生', () => {
  const t = Dims.advDimRow('town');
  assert.ok(t, 'town 行在册(§6.3.3 逐字段)');
  assert.deepStrictEqual(t.sky, {color: 0xa8cbe0, fogNear: 75, fogFar: 200, sunI: 0.92},
      'town 天穹(视觉重制 §3-F 午后暖阳定稿: 四档试拍 f0-f4, 档4越「亮而不白」界回退; 雾即奶油天际线软山)');
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

test('town 行 build=本文件维度段直引(T-SEAM-05 六装配件机械迁入, 懒引 seam 消失)· 真实建场可执行', () => {
  const dimsSrc = fs.readFileSync(path.join(ROOT, 'js/adventure-dims-core.js'), 'utf8');
  for (const fn of ['TOWN_PHASE_ORDER', 'townYawOfFace', 'townSpawnIntent',
    'townAssemblyPhases', 'townConsumeOp', 'townBuild']) {
    assert.ok(new RegExp('(function ' + fn + '\\b|const ' + fn + ' *=)').test(dimsSrc),
        '装配件「' + fn + '」在 dims-core 维度段定义(单份权威, 残留旧文件=迁移未收口)');
  }
  assert.ok(!fs.existsSync(path.join(ROOT, 'js/modes/town.js')),
      'js/modes/town.js 已退场(模式壳名实消亡, 非模式文件残留违一文件一模块)');
  assert.ok(/\btownBuild\(\);/.test(dimsSrc),
      'build 闭包直引 townBuild(同文件词法解析, 跨文件懒引 seam 消失)');
  for (const fn of ['townBuild', 'townSpawnIntent', 'townYawOfFace', 'townAssemblyPhases',
    'townConsumeOp']) {
    assert.strictEqual(typeof Dims[fn], 'function', '模块导出可驱动: ' + fn + '(同名单测约定)');
  }
  runTownBuild();
  assert.ok(snapshot().some((v) => v !== 0), 'town 建场真实写入世界(非空操作)');
  assert.strictEqual(modeSpawns.length, 1, '出生恰一次(锚点段收口, 机械迁零语义改动)');
  assert.deepStrictEqual(modeSpawns[0], {x: 79, y: 25, z: 112, yaw: 0},
      '出生四元组=spawn 锚派生(南主路 79,112 · 站立面 y=25 · 面北 yaw 0)');
});

test('ADV_TOWN 单份权威: core/spawnAnchor 引用 TOWN_MAP 同对象(不抄第二份坐标)· 定义段零坐标字面量', () => {
  assert.ok(Dims.ADV_TOWN, 'ADV_TOWN 结构常量在册并导出(行 spawn 加载期派生的坐标系)');
  assert.strictEqual(Dims.ADV_TOWN.core, TOWN_MAP.core,
      'core 引用 TOWN_MAP.core(=== 同对象引用, 拷贝即抄第二份)');
  const a = TOWN_MAP.anchors.find((x) => x.id === 'spawn');
  assert.strictEqual(Dims.ADV_TOWN.spawnAnchor, a,
      'spawnAnchor 引用 TOWN_MAP.anchors spawn 锚(=== 同对象引用)');
  const dimsSrc = fs.readFileSync(path.join(ROOT, 'js/adventure-dims-core.js'), 'utf8');
  const seg = dimsSrc.slice(dimsSrc.indexOf('const ADV_TOWN'), dimsSrc.indexOf('const ADV_DIMS'));
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

/* ============ town 建场世界层(T-SEAM-05 断言随迁, 原 test/town-mode.test.js) ============
   六装配件机械迁入维度段(T-SEAM-05, ADR-0011 决策 6b), 同名单测约定: 函数住哪
   文件测试住哪——装配序/装配容错/出生意图/面向协议与世界层实拼见证随迁本文件;
   驱动方式改经模块导出(Dims.townBuild 直引, 不再走模式壳 TownMode.init 三步链),
   出生断言走 ModeKit 记录桩(CJS 全局, townBuild 调用期解析)。模式壳/入口卡/
   注册面断言随壳作废不随迁(撤卡三件套, mode-registry.test.js 撤卡收口段接管);
   保留件(town-map/assembly/interact-core)规格归各自同名单测, 不在此重复。 */

/* 建场驱动: 清场+清出生记录+Dims.townBuild()(直引维度段, 内含锚点段出生收口) */
const modeSpawns = [];
globalThis.ModeKit = {spawn: (x, y, z, o) => modeSpawns.push({x, y, z, yaw: (o && o.yaw) || 0})};
const runTownBuild = () => {
  clearWorld();
  modeSpawns.length = 0;
  Dims.townBuild();
};
/* 世界层探针(原 town-mode.test.js 同款): 逐格见证走 eng 域 getBlock,
   界域扫描 vm 内跑(万格级免逐格跨界), 非空计数走 snapshot Buffer */
const cell = (x, y, z) => api.getBlock(x, y, z);
const scanPair = (x1, x2, y1, y2, z1, z2, idA, idB) => vm.runInContext(
    '(() => { let a = 0; let b = 0;' +
    ' for (let x = ' + x1 + '; x <= ' + x2 + '; x++)' +
    ' for (let y = ' + y1 + '; y <= ' + y2 + '; y++)' +
    ' for (let z = ' + z1 + '; z <= ' + z2 + '; z++) { const v = getBlock(x, y, z);' +
    ' if (v === ' + idA + ') a++; if (v === ' + idB + ') b++; } return a + "/" + b; })()', eng);
const blockCount = () => {
  const buf = snapshot();
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] !== 0) n++;
  return n;
};
const nonAir = (x1, x2, y1, y2, z1, z2) => {
  const zeros = Number(scanPair(x1, x2, y1, y2, z1, z2, 0, 0).split('/')[0]);
  const vol = (x2 - x1 + 1) * (y2 - y1 + 1) * (z2 - z1 + 1);
  return vol - zeros; /* 非零格数 */
};

test('装配序(T-SEAM-05 迁入): townAssemblyPhases 按 §5.1.6 建场 phase 全序分组消费 townBuildSteps', () => {
  const groups = Dims.townAssemblyPhases(vm.runInContext('townBuildSteps()', eng));
  assert.ok(Array.isArray(groups) && groups.length > 0, '分组结果非空(六段清单都有货)');
  /* 权威序 = 架构 §5.1.6 建场次序(地表→远景→路网→建筑→散布→锚点),
     独立字面量, 不引用实现常量(反同义反复) */
  const order = ['ground', 'backdrop', 'road', 'prefab', 'scatter', 'anchor'];
  assert.deepStrictEqual([...groups].map((g) => g.phase), order,
      'phase 分组全序=建场次序(每段一组, 次序即装配纪律)');
  /* 每组步骤与源清单保序一致(无增删无重排; 同型多实例如 stall-canopy×3
     合法——布局权威钉脚印不交, 不钉 id 唯一) */
  const srcKey = {ground: 'ground', backdrop: 'backdrop', road: 'roads',
    prefab: 'prefab', scatter: 'scatter', anchor: 'anchors'};
  let total = 0;
  for (const g of groups) {
    total += [...g.steps].length;
    for (const s of [...g.steps]) assert.strictEqual(s.phase, g.phase, '步骤带本组 phase 标签');
    const srcIds = [...vm.runInContext('TOWN_MAP.' + srcKey[g.phase] + '.map((e) => e.id)', eng)];
    assert.deepStrictEqual([...g.steps].map((s) => s.id), srcIds,
        g.phase + ' 段步骤与源清单 id 序列保序一致');
  }
  assert.strictEqual(total, [...vm.runInContext('townBuildSteps()', eng)].length,
      '步骤总数=源清单和(无增删)');
  /* 消费只读: 分组不得改动步骤表内容(纯派生, townBuildSteps 两次调用同构) */
  const before = JSON.stringify([...vm.runInContext('townBuildSteps()', eng)]);
  Dims.townAssemblyPhases(vm.runInContext('townBuildSteps()', eng));
  const after = JSON.stringify([...vm.runInContext('townBuildSteps()', eng)]);
  assert.strictEqual(after, before, '分组消费零副作用(源步骤表内容不变)');
});

test('装配容错(T-SEAM-05 迁入): 可空段不炸 — 空表得空组 · 乱序缺段表按权威序重整(每段保序)', () => {
  assert.deepStrictEqual([...Dims.townAssemblyPhases([])], [],
      '空步骤表 → 空分组不抛(某段可整段为空)');
  /* 乱序+缺段输入: 输出只保留在段, 但组序=权威序(驱动序, 不信输入序);
     段内保持输入相对次序(同段条目间无重排) */
  const partial = [
    {phase: 'road', id: 'main-south'},
    {phase: 'anchor', id: 'spawn'},
    {phase: 'ground', id: 'plaza-paving'},
    {phase: 'road', id: 'lane-west'},
  ];
  const groups = Dims.townAssemblyPhases(partial);
  assert.deepStrictEqual(groups.map((g) => g.phase), ['ground', 'road', 'anchor'],
      '缺段表: 只保留在段且组序=权威序(ground→road→anchor)');
  const road = groups.find((g) => g.phase === 'road');
  assert.deepStrictEqual(road.steps.map((s) => s.id), ['main-south', 'lane-west'],
      '同段条目保输入相对次序(road 两步不重排)');
});

test('出生意图(T-SEAM-05 迁入): townSpawnIntent 派生自 spawn 锚点 — 站立面 y+1 · yaw=0 北望广场', () => {
  const it = Dims.townSpawnIntent();
  /* 权威字面 = TOWN_MAP.anchors spawn 锚点(布局权威已钉
     {x:79, y:24, z:112, face:'north'}), 独立写死防同义反复 */
  assert.strictEqual(it.x, 79, '出生 x = spawn 锚点 x(79, 南主路上)');
  assert.strictEqual(it.z, 112, '出生 z = spawn 锚点 z(112)');
  assert.strictEqual(it.y, 25, '站立面 = 锚点 y+1(基高 24 上站 25, tank-range groundY+1 先例)');
  assert.strictEqual(it.yaw, 0, 'yaw=0: 前向 -Z=北(引擎 camera-rig/移动同式), 面向广场');
  /* 意图关系: 面北时广场全域与钟塔锚都在前方(§4.3 出生意图/回望走廊) */
  assert.ok(TOWN_MAP.plaza.z2 < it.z, '广场全域在出生点前方(北望广场意图成立)');
  const tower = TOWN_MAP.anchors.find((a) => a.id === 'bell-tower');
  assert.ok(tower.z < it.z, '钟塔锚在出生点前方(回望钟塔走廊尽头)');
});

test('面向协议(T-SEAM-05 迁入): townYawOfFace 四正交 face → 前向向量(north=-Z · south=+Z · east=+X · west=-X)', () => {
  const want = {north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0]};
  for (const [face, pair] of Object.entries(want)) {
    const yaw = Dims.townYawOfFace(face);
    assert.strictEqual(typeof yaw, 'number', face + ' → yaw 数值(不炸不 undefined)');
    const gx = -Math.sin(yaw);
    const gz = -Math.cos(yaw); /* 前向公式=引擎 camera-rig lookDir/移动同式 */
    assert.ok(Math.abs(gx - pair[0]) < 1e-9 && Math.abs(gz - pair[1]) < 1e-9,
        face + ' 前向应为(' + pair[0] + ',' + pair[1] + '), 实得(' + gx.toFixed(3) + ',' +
        gz.toFixed(3) + ')');
  }
});

test('拼装落地(T-SEAM-05 迁入): 规划器/执行器在场 + townBuild 全链实拼世界非空(基底 ≥ 核心区体量)', () => {
  assert.strictEqual(typeof vm.runInContext('townAssemblyOps', eng), 'function',
      '缺 js/town-assembly-core.js 的 townAssemblyOps(规划器: townBuildSteps → op 列表)');
  assert.strictEqual(typeof Dims.townConsumeOp, 'function',
      '缺 dims-core 维度段的 townConsumeOp(执行器: op → 引擎唯一触点面)');
  runTownBuild();
  const blocks = blockCount();
  assert.ok(blocks > 200000,
      '装配后世界非空且达基底体量(基底三层 ≈ 23 万格, 五段 no-op 骨架期恒 0), 实得 ' + blocks);
  assert.strictEqual(modeSpawns.length, 1, '拼装全程出生恰一次(锚点段纪律不变)');
});

test('地表与路网(T-SEAM-05 迁入): 基底三层恰覆核心区 · 广场/农田/路网对齐布局(锚点立地全覆盖)', () => {
  runTownBuild();
  assert.strictEqual(cell(35, 20, 35), 3, '基底 deep 石3 @(35,20,35)');
  assert.strictEqual(cell(35, 23, 35), 2, '基底 filler 土2 @(35,23,35)');
  assert.strictEqual(cell(35, 24, 35), 1, '基底 surface 草1 @(35,24,35)');
  assert.strictEqual(cell(32, 24, 32), 1, '核心区角 surface 恰覆(96×96 居中)');
  assert.strictEqual(cell(127, 24, 127), 1, '核心区对角 surface 恰覆');
  assert.strictEqual(cell(31, 24, 31), 0, '核心区外零基底(远景带无立地的一部分)');
  assert.strictEqual(cell(79, 24, 79), 17, '广场铺装 17 石英(28×28 与核心区同心)');
  assert.strictEqual(cell(70, 24, 50), 41, '农田 A 耕地 41');
  assert.strictEqual(cell(84, 24, 50), 41, '农田 B 耕地 41');
  assert.strictEqual(cell(79, 24, 100), 13, '南主路 13 石砖(5 宽)');
  assert.strictEqual(cell(60, 24, 63), 13, '北主路 13 石砖');
  assert.strictEqual(cell(110, 24, 86), 13, '东主路 13 石砖');
  assert.strictEqual(cell(65, 24, 79), 4, '西支路 4(3 宽)');
  assert.strictEqual(cell(55, 24, 50), 4, '田园支路 4');
  assert.strictEqual(cell(60, 24, 95), 4, '储藏支路 4');
  for (const a of TOWN_MAP.anchors) {
    assert.ok(cell(a.x, 24, a.z) !== 0,
        '锚点 ' + a.id + ' 立地有面(基底先铺/地表后写, 站立面由覆盖保证)');
  }
});

test('建筑件(T-SEAM-05 迁入): 钟塔/店/风车/双民居/储藏屋/埋室/三摊位实拼格位(集中注入材质落世界)', () => {
  runTownBuild();
  /* 钟塔: 基底先铺/建筑后写的写者赢见证 + 结构五件 */
  assert.strictEqual(cell(79, 24, 72), 13,
      '塔基 13 石砖 @(79,24,72)(surface 草1 被后写者赢覆写——序即几何)');
  assert.strictEqual(cell(78, 26, 71), 5, '塔身角柱 5 @(78,26,71)(基座上收分塔身四角柱)');
  assert.strictEqual(cell(79, 26, 71), 17, '塔身石英墙 17 @(79,26,71)');
  assert.strictEqual(cell(79, 30, 74), 68, '塔窗玻璃板 68 @(79,30,74)');
  for (const x of [79, 80]) {
    for (const y of [34, 35]) {
      for (const z of [72, 73]) {
        assert.strictEqual(cell(x, y, z), 19, '金钟 2×2×2 全 19 @(' + x + ',' + y + ',' + z + ')');
      }
    }
  }
  assert.strictEqual(cell(77, 36, 71), 78, '钟亭檐角旗 78 樱粉 @(77,36,71)');
  assert.strictEqual(cell(82, 36, 73), 78, '钟亭檐角旗 78 樱粉 @(82,36,73)');
  assert.strictEqual(cell(79, 38, 72), 9, '阶梯顶红砖 9 @(79,38,72)');
  assert.strictEqual(cell(79, 39, 72), 78, '塔顶旗 78 樱粉 @(79,39,72)');
  /* Lava Chicken 店(face=west 旋转): 招牌橙底石英点缀/展示窗/遮檐/前廊柱廊 */
  /* Lava Chicken 店(face=west 旋转, k1 (dx,dz)→(-dz,dx)): 招牌鸡剪影立板行图
     (dy6..7 恰 8×2 @x=106 列/z=75..82, Step D lead 终审)/展示窗/遮檐/前廊柱廊 */
  const SIGN7W = [5, 76, 16, 52, 52, 76, 76, 5]; /* dy7=[trim,bg,comb,bird,bird,bg,bg,trim] */
  const SIGN6W = [5, 19, 52, 52, 76, 76, 19, 5]; /* dy6=[trim,light,bird,bird,bg,bg,light,trim] */
  for (let z = 75; z <= 82; z++) {
    assert.strictEqual(cell(106, 31, z), SIGN7W[z - 75], '店招立板 dy7 行图 @(' + z + ')');
    assert.strictEqual(cell(106, 30, z), SIGN6W[z - 75], '店招立板 dy6 行图 @(' + z + ')');
  }
  assert.strictEqual(cell(107, 27, 75), 68, '展示窗玻璃板 68 @(107,27,75)');
  assert.strictEqual(cell(107, 26, 75), 19, '窗内藏暖光 19 @(107,26,75)');
  assert.strictEqual(cell(106, 29, 74), 15, '前廊遮檐布幔 15 @(106,29,74)');
  assert.strictEqual(cell(106, 26, 77), 5, '前廊柱 5 @(106,26,77)');
  /* 风车塔(face=south 恒等): 轴/十字框叶(石英框+木板叶面)/小窗(新蓝图无门洞) */
  assert.strictEqual(cell(56, 32, 43), 76, '风车轴 76 @(56,32,43)');
  assert.strictEqual(cell(56, 32, 44), 76, '风车轴 76 @(56,32,44)');
  assert.strictEqual(cell(56, 32, 45), 76, '风车轴 76 @(56,32,45)');
  assert.strictEqual(cell(55, 35, 45), 6, '风车上臂木板叶 6 @(55,35,45)');
  assert.strictEqual(cell(57, 29, 45), 6, '风车下臂木板叶 6 @(57,29,45)');
  assert.strictEqual(cell(56, 35, 45), 17, '风车叶框石英 17 @(56,35,45)');
  assert.strictEqual(cell(56, 24, 42), 13, '风车基座石砖 13 @(56,24,42)');
  assert.strictEqual(cell(56, 25, 42), 17, '风车塔身石英 17 @(56,25,42)');
  assert.strictEqual(cell(56, 25, 44), 0, '风车门洞 @(56,25,44)(南脸门洞保留)');
  assert.strictEqual(cell(56, 26, 44), 0, '风车门洞 @(56,26,44)');
  assert.strictEqual(cell(56, 28, 44), 5, '风车小窗 trim @(56,28,44)');
  /* 双民居: cottage(face=south)/loft(face=north 旋转)门叶+屋顶+阳台 */
  assert.strictEqual(cell(43, 25, 74), 64, 'cottage 门 64 @(43,25,74)');
  assert.strictEqual(cell(43, 26, 74), 65, 'cottage 门上叶 65 @(43,26,74)');
  assert.strictEqual(cell(42, 29, 68), 4, 'cottage 装饰烟囱石 4 @(42,29,68)');
  assert.strictEqual(cell(44, 28, 71), 9, 'cottage 陶橙顶 9 @(44,28,71)');
  assert.strictEqual(cell(43, 25, 82), 64, 'loft 门 64 @(43,25,82)');
  assert.strictEqual(cell(43, 26, 82), 65, 'loft 门上叶 65 @(43,26,82)');
  assert.strictEqual(cell(42, 32, 86), 9, 'loft 高屋面 9 @(42,32,86)');
  assert.strictEqual(cell(40, 28, 82), 5, 'loft 挑阳台木 5 @(40,28,82)');
  /* 储藏小屋(face=east 旋转): 门叶+基座 */
  assert.strictEqual(cell(51, 25, 98), 64, 'stash 门叶 64 @(51,25,98)');
  assert.strictEqual(cell(51, 26, 98), 65, 'stash 门上叶 65 @(51,26,98)');
  assert.strictEqual(cell(49, 24, 98), 3, 'stash 基座石 3 @(49,24,98)');
  /* 埋室(face=east): 室底/室腔/家具/顶盖/出路 */
  assert.strictEqual(cell(57, 18, 99), 3, '埋室室底石 3 @(57,18,99)');
  assert.strictEqual(cell(57, 19, 99), 0, '埋室室腔掏空 @(57,19,99)');
  assert.strictEqual(cell(58, 19, 99), 0, '埋室室腔掏空 @(58,19,99)');
  assert.strictEqual(cell(57, 20, 99), 51, '埋室宝箱 51 @(57,20,99)');
  assert.strictEqual(cell(56, 19, 98), 48, '埋室火把 48 @(56,19,98)');
  assert.strictEqual(cell(57, 22, 99), 3, '埋室顶盖石 3 @(57,22,99)');
  assert.strictEqual(cell(60, 22, 99), 2, '顶盖域外仍是 filler 2 @(60,22,99)(室形有界)');
  assert.strictEqual(cell(64, 23, 99), 0, '埋室出路末级净空 @(64,23,99)');
  assert.strictEqual(cell(65, 24, 99), 1,
      'exit 无 landing → 地表草1 原样 @(65,24,99)(执行器不得发明 v 没有的几何)');
  /* 三摊位(theme 布幔映射引擎侧单源): 顶棚色三样 + 货品位 */
  assert.strictEqual(cell(70, 27, 68), 52, '面包摊(md)顶 52 @(70,27,68)');
  assert.strictEqual(cell(89, 26, 75), 78, '花摊(sm)顶 78 樱粉 @(89,26,75)(v2 flower 案)');
  assert.strictEqual(cell(71, 27, 90), 15, '果摊(md)顶 15 @(71,27,90)');
  assert.strictEqual(cell(69, 25, 67), 17, '面包摊货品 17(后沿石英堆) @(69,25,67)');
  assert.strictEqual(cell(90, 25, 75), 78, '花摊货品 78(粉羊毛, face=west 旋转) @(90,25,75)');
  assert.strictEqual(cell(72, 25, 91), 76, '果摊货品 76(南瓜亮橙, face=north 旋转) @(72,25,91)');
});

test('植被与道具(T-SEAM-05 迁入): 樱花=SceneKit 树+樱粉覆写(两型干高冠域全覆盖) · 灌木绿冠 · 灯柱/路标', () => {
  runTownBuild();
  /* 樱花 A(广场): 立地铺装 17 石英, 干基 5, 冠盒 y[27,30] 内 78 有余且 7 清零 */
  assert.strictEqual(cell(68, 24, 88), 17, '广场樱花立地=广场铺装 17 石英 @(68,24,88)');
  assert.strictEqual(cell(68, 25, 88), 5, '樱花干基 5 @(68,25,88)');
  let stat = scanPair(66, 70, 27, 30, 86, 90, 78, 7).split('/').map(Number);
  assert.ok(stat[0] > 0, '樱花 A 冠盒樱粉叶 78 有 ' + stat[0] + ' 格(覆写生效)');
  assert.strictEqual(stat[1], 0, '樱花 A 冠盒残留绿叶 7 = ' + stat[1] + '(覆写必须清零)');
  stat = scanPair(65, 71, 26, 32, 85, 91, 78, 7).split('/').map(Number);
  assert.strictEqual(stat[1], 0, '樱花 A 宽域残留 7 = ' + stat[1] + '(冠盒须覆两型干高全冠域)');
  /* 樱花 B(田园): 立地草 1 */
  assert.strictEqual(cell(78, 24, 52), 1, '田园樱花立地=草 @(78,24,52)');
  assert.strictEqual(cell(78, 25, 52), 5, '樱花干基 5 @(78,25,52)');
  stat = scanPair(76, 80, 27, 30, 50, 54, 78, 7).split('/').map(Number);
  assert.ok(stat[0] > 0, '樱花 B 冠盒樱粉叶 78 有 ' + stat[0] + ' 格');
  assert.strictEqual(stat[1], 0, '樱花 B 冠盒残留 7 = ' + stat[1]);
  stat = scanPair(75, 81, 26, 32, 49, 55, 78, 7).split('/').map(Number);
  assert.strictEqual(stat[1], 0, '樱花 B 宽域残留 7 = ' + stat[1]);
  /* 灌木: SceneKit.scrub 绿冠保留 7(不染) */
  assert.strictEqual(cell(60, 25, 70), 5, '灌木干 5 @(60,25,70)');
  stat = scanPair(59, 61, 25, 28, 69, 71, 16, 7).split('/').map(Number);
  assert.ok(stat[1] > 0, '灌木 A 冠含绿叶 7 有 ' + stat[1] + ' 格(田园绿植不覆写)');
  stat = scanPair(97, 99, 25, 28, 91, 93, 16, 7).split('/').map(Number);
  assert.ok(stat[1] > 0, '灌木 B 冠含绿叶 7 有 ' + stat[1] + ' 格');
  /* 灯柱与路标(props fill) */
  assert.strictEqual(cell(77, 25, 92), 17, '广场灯座石英 17 @(77,25,92)(props.lampBase 新槽)');
  for (const y of [26, 27, 28]) assert.strictEqual(cell(77, y, 92), 5, '广场灯柱 5 @(' + y + ')');
  assert.strictEqual(cell(77, 29, 92), 19, '广场灯头 19 @(77,29,92)');
  assert.strictEqual(cell(64, 25, 67), 17, '西灯座石英 17 @(64,25,67)');
  assert.strictEqual(cell(64, 26, 67), 5, '西灯柱 5 @(64,26,67)');
  assert.strictEqual(cell(64, 28, 67), 5, '西灯柱 5 @(64,28,67)');
  assert.strictEqual(cell(64, 29, 67), 19, '西灯头 19 @(64,29,67)');
  assert.strictEqual(cell(73, 25, 67), 5, '广场路标柱 5 @(73,25,67)');
  assert.strictEqual(cell(73, 26, 67), 5, '广场路标柱 5 @(73,26,67)');
  assert.strictEqual(cell(73, 27, 67), 6, '广场路牌 6 @(73,27,67)');
  assert.strictEqual(cell(50, 25, 95), 5, 'stash 路标柱 5 @(50,25,95)');
  assert.strictEqual(cell(50, 27, 95), 6, 'stash 路牌 6 @(50,27,95)');
});

test('通廊与不可达(T-SEAM-05 迁入, 世界层): 出生回望走廊全空 · 空隙带无立地 · 山脊崖屋就位', () => {
  runTownBuild();
  assert.strictEqual(nonAir(78, 80, 25, 47, 76, 111), 0,
      '出生回望走廊 x78..80×z76..111×y≥25 全空(塔足 z2=75 → 走廊 z1=76, §4.3 视线管理)');
  assert.strictEqual(nonAir(0, 159, 0, 47, 29, 31), 0,
      '空隙带 z29..31 全域零方块(山体 z2=28 · 核心区 z1=32 之间无立地=远景不可达执行见证)');
  assert.strictEqual(cell(79, 44, 20), 3, '山脊石 3 @(79,44,20)(顶高过钟塔 38)');
  assert.strictEqual(cell(80, 44, 20), 3, '山脊石 3 @(80,44,20)');
  assert.strictEqual(cell(16, 24, 20), 3, '山体西缘 topY=24 @(16,24,20)');
  assert.strictEqual(cell(16, 25, 20), 0, '西缘柱顶即止 @(16,25,20)');
  assert.strictEqual(cell(143, 24, 20), 3, '山体东缘 topY=24 @(143,24,20)');
  assert.strictEqual(cell(56, 41, 22), 6, '崖屋 A 底 6 @(56,41,22)');
  assert.strictEqual(cell(56, 46, 22), 6, '崖屋 A 顶 6 @(56,46,22)');
  assert.strictEqual(cell(103, 41, 22), 6, '崖屋 B 底 6 @(103,41,22)');
  assert.strictEqual(cell(103, 46, 22), 6, '崖屋 B 顶 6 @(103,46,22)');
});

test('确定性(T-SEAM-05 迁入): 清场重建两遍 worldCells 全量逐格相等(装配全链确定性重放)', () => {
  runTownBuild();
  const blocks = blockCount();
  assert.ok(blocks > 200000,
      '首遍装配非空且达基底体量(空世界对空世界恒相等=假绿, 非空是本测前提), 实得 ' + blocks);
  const snap1 = snapshot();
  runTownBuild(); /* 清场 + townBuild 再来一遍 */
  assert.deepStrictEqual(snap1, snapshot(),
      '两次装配 worldCells 全等(零随机零墙钟: 散布走 SceneKit.rand/hashRand 确定性散列)');
});
