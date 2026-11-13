'use strict';
/* 城镇模式 (js/modes/town.js) 可执行规格 — node --test (零依赖)
   运行: node --test test/town-mode.test.js
   T-MAP-02 红测(票: docs/town-architecture-design.md §11 T-MAP-02「town 模式
   骨架与 loadScene 装配」; 布局权威 docs/town-map-design.md §3-§4, 数据件
   js/town-map-core.js = T-MAP-01 交付)。只测票文要的外显行为, 全走公共 seam:
   ① 注册面: MODE_REGISTRY town 行(gated 共享儿童时限 · page:false = U3
      点卡直进无出发页 · mood calm) + index.html 双 script(先 town-map-core
      后 town, 皆先于 main.js——town-map-core 此前只有 Node require 装载面,
      浏览器侧 script 标签是本票补的消费前提) + main.js MODES 影子行;
   ② 入口卡: T-UI-00 tokens 默认值(docs/design/town-ui-entry-tokens.md
      §1.2/§1.3/§1.4: 🏘️ 占位 · 小镇漫步 · 逛广场副标题 · 樱粉 #F2B8C6);
   ③ 装配序: townAssemblyPhases 纯函数按建场 phase 全序分组消费
      townBuildSteps()(§5.1.6 地表→远景→路网→建筑→散布→锚点), 可空段不炸;
   ④ 出生意图: townSpawnIntent 从 spawn 锚点派生站立面与朝向(yaw=0 北望
      广场/钟塔), townYawOfFace 四正交 face 协议(锚点/件实例 face 的消费面);
   ⑤ 模式壳: init = loadScene(装配) → ModeKit.spawn(锚点) → requestLock
      (U3 直进), 顺序钉死; spawn 恰一次(只出生, 其余锚点的交互注册归
      T-MAP-04); 实拼几何(SceneKit/PrefabKit)归 T-MAP-03, 本规格不触。
   装具: 经典脚本共享词法环境现实还原(showroom-mode.test.js 先例), vm 里
   先载 js/town-map-core.js 再载 js/modes/town.js; 引擎缝用记录桩替身
   (mkMode 透传 / loadScene 收建场函数并同步执行 / ModeKit.spawn 与
   requestLock 只记录)——骨架对引擎的全部合法触点即这四个, 桩外触点装具
   直接 ReferenceError 暴露(越缝即红)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ModeRegistry = require('../js/mode-registry.js');

/* ---------- 记录桩装具: 装配/出生/直进事件全记录(带单调序号) ----------
   T-MAP-03 起装具升级: 引擎件(config/voxel/scene-kit/prefab-kit)真实装载,
   只有引擎缝(loadScene/ModeKit.spawn/requestLock)仍是记录桩——世界层测试
   据此用真 world 断言实拼格位。js/town-assembly-core.js 条件装载: 红期缺席
   时仅 T-MAP-03 段红(T-MAP-02 回归网不红); 绿后 town.js 消费它, 缺文件即
   装载/运行 ReferenceError 红, 无静默洞。 */
function townBoot(extra) {
  const rec = {events: [], builds: []};
  let tick = 0;
  const mark = (kind, detail) => rec.events.push({t: ++tick, kind, detail});
  const sandbox = Object.assign({
    console: {log() {}, warn() {}, error() {}},
    performance: {now: () => 0},
    mkMode: (cfg) => Object.assign({}, cfg), /* 透传 cfg(模式壳形状保真) */
    /* 真 seam 语义: 收建场函数并同步建场 */
    loadScene: (fn) => {
      assert.strictEqual(typeof fn, 'function', 'loadScene(buildFn) 须收到建场函数');
      rec.builds.push(fn);
      mark('loadScene');
      fn();
    },
    requestLock: () => mark('requestLock'),
    ModeKit: {
      spawn: (x, y, z, o) => mark('spawn', {x, y, z, yaw: (o && o.yaw) || 0}),
    },
  }, extra || {});
  const ctx = vm.createContext(sandbox);
  const files = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js'];
  if (fs.existsSync(path.join(ROOT, 'js/town-assembly-core.js'))) {
    files.push('js/town-assembly-core.js'); /* 红期缺席容忍, 见装具头注 */
  }
  files.push('js/town-map-core.js', 'js/modes/town.js');
  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotThrow(() => vm.runInContext(code, ctx, {filename: f}),
        '脚本应可加载: ' + f + '(缺文件/顶层炸错在此暴露)');
  }
  return {ctx, rec};
}

const probe = (ctx, expr) => vm.runInContext(expr, ctx);

/* ---------- ① 注册面: 三件套接线(ModeRegistry 行 + index.html + main.js) ---------- */

test('镇注册: 注册表 town 行在册 — gated 共享儿童时限 · page:false(U3 点卡直进) · mood calm', () => {
  const row = ModeRegistry.all.find((m) => m.id === 'town');
  assert.ok(row, 'MODE_REGISTRY 缺 town 行(模式不存在, 三件套无从谈起)');
  assert.strictEqual(row.name, '小镇漫步', 'U1 默认命名(T-UI-00 tokens §1.4; 架构 §6.1 建议行)');
  assert.strictEqual(row.gated, true, '游玩模式进儿童时限(共享 play 预算, §6.1)');
  assert.strictEqual(row.page, false, '无出发配置页(U3 默认: 点卡直接过渡, menuTown 不采用)');
  assert.strictEqual(row.mood, 'calm', 'BGM 基线情绪 calm(§6.1 建议行)');
  assert.ok(!row.enter && !row.menu && !row.dev, '纯直进行: 无出发按钮/无菜单页/非 dev');
  assert.strictEqual(ModeRegistry.scriptSrc(row), 'js/modes/town.js', '派生脚本路径');
});

test('镇接线: index.html 双 script(先 town-map-core 后 town, 皆先于 main.js) + main.js MODES 影子行', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  const at = (f) => html.indexOf('src="' + f + '"');
  const coreAt = at('js/town-map-core.js');
  const modeAt = at('js/modes/town.js');
  const mainAt = at('js/main.js');
  assert.ok(mainAt > 0, 'main.js 在场(装具自检)');
  assert.ok(coreAt > 0, 'index.html 缺 script: js/town-map-core.js(T-MAP-01 数据件的浏览器侧唯一装载点)');
  assert.ok(modeAt > 0, 'index.html 缺 script: js/modes/town.js');
  assert.ok(coreAt < modeAt, 'town.js 必须晚于 town-map-core.js 装载(消费 TOWN_MAP/townBuildSteps, arena-core 先例)');
  assert.ok(modeAt < mainAt, '模式 script 必须先于 main.js 加载(经典脚本共享词法环境, 序即依赖)');
  assert.match(mainSrc, /^ {2}town: TownMode,$/m,
      'main.js MODES 缺 town: TownMode,(组合根漏接线, 点卡即 TypeError)');
});

/* ---------- ② 入口卡: T-UI-00 tokens 默认值(A 区交付消费) ---------- */

test('入口卡: cardTown 同构既有卡 + T-UI-00 默认(🏘️ 占位/小镇漫步/逛广场副标题)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const opener = /<div class="mode-card town" id="cardTown">/.exec(html);
  assert.ok(opener, '缺模式卡 cardTown(卡类=mode-card town, 与注册表行对齐)');
  const seg = html.slice(opener.index, opener.index + 400);
  assert.ok(seg.includes('<div class="big">🏘️</div>'), 'U2 默认主图标 🏘️(tokens §1.3 emoji 占位)');
  assert.ok(seg.includes('<h2>小镇漫步</h2>'), 'U1 默认标题「小镇漫步」(tokens §1.4)');
  assert.ok(seg.includes('<small>逛广场 · 找朋友 · 轻松玩</small>'),
      'U1 默认副标题(tokens §1.4; 无任务压力词)');
});

test('入口卡主题色: .mode-card.town 樱粉识别色 --accent #F2B8C6 + 同族 --glow(tokens §1.2)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  const rule = /\.mode-card\.town\s*\{[^}]*\}/.exec(css);
  assert.ok(rule, 'css/style.css 缺 .mode-card.town 主题色规则(每模式一块, 既有卡同构)');
  assert.ok(/--accent:\s*#f2b8c6/i.test(rule[0]), '樱粉主识别色 #F2B8C6(tokens §1.2 布幔-樱粉)');
  assert.ok(/--glow:\s*rgb\(242 184 198 \/ 35%\)/.test(rule[0]),
      '悬停柔光同族 rgb(242 184 198 / 35%)(既有卡 --glow 层级语言)');
});

/* ---------- ③ 装配序: phase 全序分组消费 townBuildSteps(可空段不炸) ---------- */

test('装配序: townAssemblyPhases 按 §5.1.6 建场 phase 全序分组消费 townBuildSteps', () => {
  const {ctx} = townBoot();
  const groups = probe(ctx, 'townAssemblyPhases(townBuildSteps())');
  assert.ok(Array.isArray(groups) && groups.length > 0, '分组结果非空(六段清单都有货)');
  /* 权威序 = 架构 §5.1.6 建场次序(地表→远景→路网→建筑→散布→锚点),
     独立字面量, 不引用实现常量(反同义反复) */
  const order = ['ground', 'backdrop', 'road', 'prefab', 'scatter', 'anchor'];
  const seen = groups.map((g) => g.phase);
  assert.deepStrictEqual([...seen], order, 'phase 分组全序=建场次序(每段一组, 次序即装配纪律)');
  /* 跨 realm 摊平再比: vm 数组原型属 vm realm, 直比 deepStrictEqual 恒红
     (boot.test.js 同款纪律) */
  /* 每组步骤与源清单保序一致(无增删无重排; 同型多实例如 stall-canopy×3
     合法——布局权威钉脚印不交, 不钉 id 唯一) */
  const total = groups.reduce((n, g) => n + g.steps.length, 0);
  assert.strictEqual(total, probe(ctx, 'townBuildSteps().length'), '步骤总数=源清单和(无增删)');
  const srcKey = {ground: 'ground', backdrop: 'backdrop', road: 'roads',
    prefab: 'prefab', scatter: 'scatter', anchor: 'anchors'};
  for (const g of groups) {
    for (const s of g.steps) assert.strictEqual(s.phase, g.phase, '步骤带本组 phase 标签');
    const srcIds = [...probe(ctx, 'TOWN_MAP.' + srcKey[g.phase] + '.map((e) => e.id)')];
    assert.deepStrictEqual([...g.steps].map((s) => s.id), srcIds,
        g.phase + ' 段步骤与源清单 id 序列保序一致');
  }
  /* 消费只读: 分组不得改动步骤表内容(纯派生, townBuildSteps 两次调用同构) */
  const before = JSON.stringify(probe(ctx, 'townBuildSteps()'));
  probe(ctx, 'townAssemblyPhases(townBuildSteps())');
  const after = JSON.stringify(probe(ctx, 'townBuildSteps()'));
  assert.strictEqual(after, before, '分组消费零副作用(源步骤表内容不变)');
});

test('装配容错: 可空段不炸 — 空表得空组 · 乱序缺段表按权威序重整(每段保序)', () => {
  const {ctx} = townBoot();
  assert.deepStrictEqual([...probe(ctx, 'townAssemblyPhases([])')], [],
      '空步骤表 → 空分组不抛(T-MAP-03 接缝期某段可整段为空)');
  /* 乱序+缺段输入: 输出只保留在段, 但组序=权威序(骨架驱动序, 不信输入序);
     段内保持输入相对次序(同段条目间无重排) */
  const partial = [
    {phase: 'road', id: 'main-south'},
    {phase: 'anchor', id: 'spawn'},
    {phase: 'ground', id: 'plaza-paving'},
    {phase: 'road', id: 'lane-west'},
  ];
  const ctx2 = townBoot({__steps: partial}).ctx;
  const groups = probe(ctx2, 'townAssemblyPhases(__steps)');
  /* 跨 realm 摊平再比(boot.test.js 同款纪律): [...vm数组] → 宿主数组 */
  assert.deepStrictEqual([...groups].map((g) => g.phase), ['ground', 'road', 'anchor'],
      '缺段表: 只保留在段且组序=权威序(ground→road→anchor)');
  const road = [...groups].find((g) => g.phase === 'road');
  assert.deepStrictEqual([...road.steps].map((s) => s.id), ['main-south', 'lane-west'],
      '同段条目保输入相对次序(road 两步不重排)');
});

/* ---------- ④ 出生意图: spawn 锚点消费(站立面/朝向) + face 协议 ---------- */

test('出生意图: townSpawnIntent 派生自 spawn 锚点 — 站立面 y+1 · yaw=0 北望广场', () => {
  const {ctx} = townBoot();
  const it = probe(ctx, 'townSpawnIntent()');
  /* 权威字面 = TOWN_MAP.anchors spawn 锚点(68a8a5f 布局权威, T-MAP-01 已钉
     {x:79, y:24, z:112, face:'north'}), 独立写死防同义反复 */
  assert.strictEqual(it.x, 79, '出生 x = spawn 锚点 x(79, 南主路上)');
  assert.strictEqual(it.z, 112, '出生 z = spawn 锚点 z(112)');
  assert.strictEqual(it.y, 25, '站立面 = 锚点 y+1(基高 24 上站 25, tank-range groundY+1 先例)');
  assert.strictEqual(it.yaw, 0, 'yaw=0: 前向 -Z=北(引擎 camera-rig/移动同式), 面向广场');
  /* 意图关系: 面北时广场全域与钟塔锚都在前方(§4.3 出生意图/回望走廊) */
  const plaza = probe(ctx, 'TOWN_MAP.plaza');
  assert.ok(plaza.z2 < it.z, '广场全域在出生点前方(北望广场意图成立)');
  const tower = probe(ctx, 'TOWN_MAP.anchors.find((a) => a.id === \'bell-tower\')');
  assert.ok(tower.z < it.z, '钟塔锚在出生点前方(回望钟塔走廊尽头)');
});

test('面向协议: townYawOfFace 四正交 face → 前向向量(north=-Z · south=+Z · east=+X · west=-X)', () => {
  const {ctx} = townBoot();
  const want = {north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0]};
  for (const [face, pair] of Object.entries(want)) {
    const yaw = probe(ctx, 'townYawOfFace(' + JSON.stringify(face) + ')');
    assert.strictEqual(typeof yaw, 'number', face + ' → yaw 数值(不炸不 undefined)');
    const gx = -Math.sin(yaw);
    const gz = -Math.cos(yaw); /* 前向公式=引擎 camera-rig lookDir/移动同式 */
    assert.ok(Math.abs(gx - pair[0]) < 1e-9 && Math.abs(gz - pair[1]) < 1e-9,
        face + ' 前向应为(' + pair[0] + ',' + pair[1] + '), 实得(' + gx.toFixed(3) + ',' +
        gz.toFixed(3) + ')');
  }
});

/* ---------- ⑤ 模式壳: init 全链顺序(装配→出生→直进) ---------- */

test('模式壳: TownMode 接线 · init = loadScene(装配) → ModeKit.spawn(锚点) → requestLock(U3 直进)', () => {
  const {ctx, rec} = townBoot();
  assert.strictEqual(probe(ctx, 'TownMode.id'), 'town', '模式 id = 注册表行 id');
  assert.strictEqual(typeof probe(ctx, 'TownMode.init'), 'function', 'init 可调(switchMode 全链入口)');
  assert.doesNotThrow(() => probe(ctx, 'TownMode.init()'), 'init 全链不抛(最小可进场)');
  const kinds = rec.events.map((e) => e.kind);
  assert.strictEqual(kinds.filter((k) => k === 'loadScene').length, 1,
      '进场装配恰一次 loadScene');
  assert.strictEqual(kinds.filter((k) => k === 'spawn').length, 1,
      '出生恰一次 ModeKit.spawn(只出生; 其余锚点交互注册归 T-MAP-04, 重复=越权)');
  assert.ok(kinds.includes('requestLock'), 'U3 直进: init 内请求指针锁/触屏进行中(无二次确认)');
  const iLoad = kinds.indexOf('loadScene');
  const iSpawn = kinds.indexOf('spawn');
  assert.ok(iLoad >= 0 && iLoad < iSpawn, '出生在装配之后(先建场后落人, §5.1.6 锚点末段纪律)');
  const sp = rec.events[iSpawn].detail;
  assert.strictEqual(sp.x, 79, 'spawn x = spawn 锚点(79)');
  assert.strictEqual(sp.z, 112, 'spawn z = spawn 锚点(112)');
  assert.strictEqual(sp.y, 25, 'spawn y = 站立面(锚点 y+1)');
  assert.strictEqual(sp.yaw, 0, 'spawn yaw = 0 北望');
  assert.strictEqual(typeof rec.builds[0], 'function', 'loadScene 收到的是建场函数(装配路径已随 stub 同步执行)');
});

/* ============================================================
   T-MAP-03: 建筑/场景件/植被与地表拼装落地(世界层实拼见证)
   ------------------------------------------------------------
   票: docs/town-architecture-design.md §11 T-MAP-03。骨架期五段 no-op 在
   上文已钉(装配序/出生意图/模式壳), 本段钉实拼结果: 规划器
   (js/town-assembly-core.js townAssemblyOps, 纯 op 列表)× 执行器(town.js
   townConsumeOp, 引擎触点唯一面)全链把 townBuildSteps() 拼进真 world。
   断言口径: 逐格见证(getBlock) + 界域扫描(vm 内跑, 万格级免逐格跨界)。
   op 词表/planner 纯面/T-09 材质基线的细钉归同票
   test/town-assembly-core.test.js, 两卷互补不重复。红期: 装配核心缺席+
   骨架五段 no-op → 世界恒空, 本段全红; 绿后全绿。 */

/* 装配驱动: 清场 + init 全链(loadScene 桩同步执行 townBuild → 世界实拼) */
function assemble(ctx) {
  probe(ctx, 'world.clear()');
  probe(ctx, 'TownMode.init()');
}
const cell = (ctx, x, y, z) => probe(ctx, 'getBlock(' + x + ',' + y + ',' + z + ')');
/* 界域扫描(vm 内跑): 返回 "idA计数/idB计数" 二元统计 */
const scanPair = (ctx, x1, x2, y1, y2, z1, z2, idA, idB) => probe(ctx,
    '(() => { let a = 0; let b = 0;' +
  ' for (let x = ' + x1 + '; x <= ' + x2 + '; x++)' +
  ' for (let y = ' + y1 + '; y <= ' + y2 + '; y++)' +
  ' for (let z = ' + z1 + '; z <= ' + z2 + '; z++) { const v = getBlock(x, y, z);' +
  ' if (v === ' + idA + ') a++; if (v === ' + idB + ') b++; } return a + "/" + b; })()');
/* 全域非空格计数(vm 内跑): 非空门/确定性门共用探针 */
const blockCount = (ctx) => probe(ctx,
    '(() => { let n = 0; for (let i = 0; i < worldCells.length; i++)' +
  ' if (worldCells[i] !== 0) n++; return n; })()');
const nonAir = (ctx, x1, x2, y1, y2, z1, z2) => {
  const zeros = Number(scanPair(ctx, x1, x2, y1, y2, z1, z2, 0, 0).split('/')[0]);
  const vol = (x2 - x1 + 1) * (y2 - y1 + 1) * (z2 - z1 + 1);
  return vol - zeros; /* 非零格数 */
};

test('镇接线(T-MAP-03): index.html 三 script — town-map-core < town-assembly-core < town < main', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = (f) => html.indexOf('src="' + f + '"');
  const coreAt = at('js/town-map-core.js');
  const asmAt = at('js/town-assembly-core.js');
  const modeAt = at('js/modes/town.js');
  const mainAt = at('js/main.js');
  assert.ok(asmAt > 0, 'index.html 缺 script: js/town-assembly-core.js(浏览器侧唯一装载点)');
  assert.ok(coreAt > 0 && coreAt < asmAt,
      '装配核心必须晚于 town-map-core.js 装载(消费 TOWN_MAP.core 派生基高)');
  assert.ok(asmAt < modeAt, 'town.js 必须晚于 town-assembly-core.js 装载(消费 townAssemblyOps)');
  assert.ok(modeAt < mainAt, '模式 script 先于 main.js(经典脚本序即依赖)');
});

test('拼装落地: 规划器/执行器在场 + init 全链实拼世界非空(基底 ≥ 核心区体量)', () => {
  const {ctx, rec} = townBoot();
  assert.strictEqual(probe(ctx, 'typeof townAssemblyOps'), 'function',
      '缺 js/town-assembly-core.js 的 townAssemblyOps(规划器: townBuildSteps → op 列表)');
  assert.strictEqual(probe(ctx, 'typeof townConsumeOp'), 'function',
      '缺 town.js 的 townConsumeOp(执行器: op → 引擎唯一触点面)');
  assemble(ctx);
  const blocks = blockCount(ctx);
  assert.ok(blocks > 200000,
      '装配后世界非空且达基底体量(基底三层 ≈ 23 万格, 五段 no-op 骨架期恒 0), 实得 ' + blocks);
  assert.strictEqual(rec.events.filter((e) => e.kind === 'spawn').length, 1,
      '拼装全程出生恰一次(锚点段纪律不变)');
});

test('地表与路网: 基底三层恰覆核心区 · 广场/农田/路网对齐布局(锚点立地全覆盖)', () => {
  const {ctx} = townBoot();
  assemble(ctx);
  assert.strictEqual(cell(ctx, 35, 20, 35), 3, '基底 deep 石3 @(35,20,35)');
  assert.strictEqual(cell(ctx, 35, 23, 35), 2, '基底 filler 土2 @(35,23,35)');
  assert.strictEqual(cell(ctx, 35, 24, 35), 1, '基底 surface 草1 @(35,24,35)');
  assert.strictEqual(cell(ctx, 32, 24, 32), 1, '核心区角 surface 恰覆(96×96 居中)');
  assert.strictEqual(cell(ctx, 127, 24, 127), 1, '核心区对角 surface 恰覆');
  assert.strictEqual(cell(ctx, 31, 24, 31), 0, '核心区外零基底(远景带无立地的一部分)');
  assert.strictEqual(cell(ctx, 79, 24, 79), 58, '广场铺装 58(28×28 与核心区同心)');
  assert.strictEqual(cell(ctx, 70, 24, 50), 41, '农田 A 耕地 41');
  assert.strictEqual(cell(ctx, 84, 24, 50), 41, '农田 B 耕地 41');
  assert.strictEqual(cell(ctx, 79, 24, 100), 58, '南主路 58(5 宽)');
  assert.strictEqual(cell(ctx, 60, 24, 63), 58, '北主路 58');
  assert.strictEqual(cell(ctx, 110, 24, 86), 58, '东主路 58');
  assert.strictEqual(cell(ctx, 65, 24, 79), 4, '西支路 4(3 宽)');
  assert.strictEqual(cell(ctx, 55, 24, 50), 4, '田园支路 4');
  assert.strictEqual(cell(ctx, 60, 24, 95), 4, '储藏支路 4');
  for (const a of probe(ctx, 'TOWN_MAP.anchors')) {
    assert.ok(cell(ctx, a.x, 24, a.z) !== 0,
        '锚点 ' + a.id + ' 立地有面(基底先铺/地表后写, 站立面由覆盖保证)');
  }
});

test('建筑件: 钟塔/店/风车/双民居/储藏屋/埋室/三摊位实拼格位(集中注入材质落世界)', () => {
  const {ctx} = townBoot();
  assemble(ctx);
  /* 钟塔: 基底先铺/建筑后写的写者赢见证 + 结构五件 */
  assert.strictEqual(cell(ctx, 79, 24, 72), 58,
      '塔基 58 @(79,24,72)(surface 草1 被后写者赢覆写——序即几何)');
  assert.strictEqual(cell(ctx, 78, 25, 71), 5, '塔柱 5 @(78,25,71)');
  assert.strictEqual(cell(ctx, 79, 25, 71), 5, '塔身中线竖缝 trim 5 @(79,25,71)');
  assert.strictEqual(cell(ctx, 78, 28, 72), 18, '塔窗玻璃 18 @(78,28,72)');
  for (const x of [79, 80]) {
    for (const y of [32, 33]) {
      for (const z of [72, 73]) {
        assert.strictEqual(cell(ctx, x, y, z), 38, '钟体 2×2×2 全 38 @(' + x + ',' + y + ',' + z + ')');
      }
    }
  }
  assert.strictEqual(cell(ctx, 77, 34, 71), 16, '檐下旗 16 @(77,34,71)');
  assert.strictEqual(cell(ctx, 82, 34, 73), 16, '檐下旗 16 @(82,34,73)');
  assert.strictEqual(cell(ctx, 79, 35, 72), 9, '顶饰红砖 9 @(79,35,72)');
  assert.strictEqual(cell(ctx, 79, 38, 72), 5, '塔尖 trim 5 @(79,38,72)');
  /* Lava Chicken 店(face=west 旋转): 招牌/展示窗/遮檐/门洞敞开 */
  assert.strictEqual(cell(ctx, 106, 31, 78), 38, '店招暖金 38 @(106,31,78)');
  assert.strictEqual(cell(ctx, 106, 31, 79), 38, '店招暖金 38 @(106,31,79)');
  assert.strictEqual(cell(ctx, 106, 31, 76), 15, '店招底板天蓝 15 @(106,31,76)');
  assert.strictEqual(cell(ctx, 107, 26, 78), 0, '店门洞白天敞开 @(107,26,78)');
  assert.strictEqual(cell(ctx, 107, 27, 76), 19, '展示窗灯块暖光 19 @(107,27,76)');
  assert.strictEqual(cell(ctx, 106, 29, 74), 52, '前廊遮檐羊毛 52 @(106,29,74)');
  /* 风车塔(face=south 恒等): 轴/双臂叶/门洞/小窗 */
  assert.strictEqual(cell(ctx, 56, 32, 43), 12, '风车轴 12 @(56,32,43)');
  assert.strictEqual(cell(ctx, 56, 32, 44), 12, '风车轴 12 @(56,32,44)');
  assert.strictEqual(cell(ctx, 56, 32, 45), 12, '风车轴 12 @(56,32,45)');
  assert.strictEqual(cell(ctx, 56, 33, 45), 52, '风车上臂叶 52 @(56,33,45)');
  assert.strictEqual(cell(ctx, 56, 31, 45), 52, '风车下臂叶 52 @(56,31,45)');
  assert.strictEqual(cell(ctx, 56, 24, 42), 3, '风车基座石 3 @(56,24,42)');
  assert.strictEqual(cell(ctx, 56, 25, 42), 6, '风车塔身木板 6 @(56,25,42)');
  assert.strictEqual(cell(ctx, 56, 25, 44), 0, '风车门洞 @(56,25,44)');
  assert.strictEqual(cell(ctx, 56, 28, 44), 5, '风车小窗 trim @(56,28,44)');
  /* 双民居: cottage(face=south)/loft(face=north 旋转)门叶+屋顶+阳台 */
  assert.strictEqual(cell(ctx, 43, 25, 74), 6, 'cottage 门叶 6 @(43,25,74)');
  assert.strictEqual(cell(ctx, 43, 26, 74), 6, 'cottage 门叶 6 @(43,26,74)');
  assert.strictEqual(cell(ctx, 42, 29, 68), 3, 'cottage 装饰烟囱石 3 @(42,29,68)');
  assert.strictEqual(cell(ctx, 44, 28, 71), 9, 'cottage 陶橙顶 9 @(44,28,71)');
  assert.strictEqual(cell(ctx, 43, 25, 82), 6, 'loft 门叶 6 @(43,25,82)');
  assert.strictEqual(cell(ctx, 43, 26, 82), 6, 'loft 门叶 6 @(43,26,82)');
  assert.strictEqual(cell(ctx, 42, 32, 86), 9, 'loft 高屋面 9 @(42,32,86)');
  assert.strictEqual(cell(ctx, 40, 28, 82), 5, 'loft 挑阳台木 5 @(40,28,82)');
  /* 储藏小屋(face=east 旋转): 门叶+基座 */
  assert.strictEqual(cell(ctx, 51, 25, 98), 6, 'stash 门叶 6 @(51,25,98)');
  assert.strictEqual(cell(ctx, 51, 26, 98), 6, 'stash 门叶 6 @(51,26,98)');
  assert.strictEqual(cell(ctx, 49, 24, 98), 3, 'stash 基座石 3 @(49,24,98)');
  /* 埋室(face=east): 室底/室腔/家具/顶盖/出路 */
  assert.strictEqual(cell(ctx, 57, 18, 99), 3, '埋室室底石 3 @(57,18,99)');
  assert.strictEqual(cell(ctx, 57, 19, 99), 0, '埋室室腔掏空 @(57,19,99)');
  assert.strictEqual(cell(ctx, 58, 19, 99), 0, '埋室室腔掏空 @(58,19,99)');
  assert.strictEqual(cell(ctx, 57, 20, 99), 51, '埋室宝箱 51 @(57,20,99)');
  assert.strictEqual(cell(ctx, 56, 19, 98), 48, '埋室火把 48 @(56,19,98)');
  assert.strictEqual(cell(ctx, 57, 22, 99), 3, '埋室顶盖石 3 @(57,22,99)');
  assert.strictEqual(cell(ctx, 60, 22, 99), 2, '顶盖域外仍是 filler 2 @(60,22,99)(室形有界)');
  assert.strictEqual(cell(ctx, 64, 23, 99), 0, '埋室出路末级净空 @(64,23,99)');
  assert.strictEqual(cell(ctx, 65, 24, 99), 1,
      'exit 无 landing → 地表草1 原样 @(65,24,99)(执行器不得发明 v 没有的几何)');
  /* 三摊位(theme 布幔映射引擎侧单源): 顶棚色三样 + 货品位 */
  assert.strictEqual(cell(ctx, 70, 27, 68), 52, '面包摊(md)顶 52 @(70,27,68)');
  assert.strictEqual(cell(ctx, 89, 26, 75), 16, '花摊(sm)顶 16 @(89,26,75)');
  assert.strictEqual(cell(ctx, 71, 27, 90), 15, '果摊(md)顶 15 @(71,27,90)');
  assert.strictEqual(cell(ctx, 69, 25, 67), 38, '面包摊货品 38 @(69,25,67)');
  assert.strictEqual(cell(ctx, 90, 25, 75), 38, '花摊货品 38 @(90,25,75)');
  assert.strictEqual(cell(ctx, 72, 25, 91), 38, '果摊货品 38 @(72,25,91)');
});

test('植被与道具: 樱花=SceneKit 树+樱粉覆写(两型干高冠域全覆盖) · 灌木绿冠 · 灯柱/路标', () => {
  const {ctx} = townBoot();
  assemble(ctx);
  /* 樱花 A(广场): 立地铺装 58, 干基 5, 冠盒 y[27,30] 内 16 有余且 7 清零 */
  assert.strictEqual(cell(ctx, 68, 24, 88), 58, '广场樱花立地=广场铺装 @(68,24,88)');
  assert.strictEqual(cell(ctx, 68, 25, 88), 5, '樱花干基 5 @(68,25,88)');
  let stat = scanPair(ctx, 66, 70, 27, 30, 86, 90, 16, 7).split('/').map(Number);
  assert.ok(stat[0] > 0, '樱花 A 冠盒樱粉 16 有 ' + stat[0] + ' 格(覆写生效)');
  assert.strictEqual(stat[1], 0, '樱花 A 冠盒残留绿叶 7 = ' + stat[1] + '(覆写必须清零)');
  stat = scanPair(ctx, 65, 71, 26, 32, 85, 91, 16, 7).split('/').map(Number);
  assert.strictEqual(stat[1], 0, '樱花 A 宽域残留 7 = ' + stat[1] + '(冠盒须覆两型干高全冠域)');
  /* 樱花 B(田园): 立地草 1 */
  assert.strictEqual(cell(ctx, 78, 24, 52), 1, '田园樱花立地=草 @(78,24,52)');
  assert.strictEqual(cell(ctx, 78, 25, 52), 5, '樱花干基 5 @(78,25,52)');
  stat = scanPair(ctx, 76, 80, 27, 30, 50, 54, 16, 7).split('/').map(Number);
  assert.ok(stat[0] > 0, '樱花 B 冠盒樱粉 16 有 ' + stat[0] + ' 格');
  assert.strictEqual(stat[1], 0, '樱花 B 冠盒残留 7 = ' + stat[1]);
  stat = scanPair(ctx, 75, 81, 26, 32, 49, 55, 16, 7).split('/').map(Number);
  assert.strictEqual(stat[1], 0, '樱花 B 宽域残留 7 = ' + stat[1]);
  /* 灌木: SceneKit.scrub 绿冠保留 7(不染) */
  assert.strictEqual(cell(ctx, 60, 25, 70), 5, '灌木干 5 @(60,25,70)');
  stat = scanPair(ctx, 59, 61, 25, 28, 69, 71, 16, 7).split('/').map(Number);
  assert.ok(stat[1] > 0, '灌木 A 冠含绿叶 7 有 ' + stat[1] + ' 格(田园绿植不覆写)');
  stat = scanPair(ctx, 97, 99, 25, 28, 91, 93, 16, 7).split('/').map(Number);
  assert.ok(stat[1] > 0, '灌木 B 冠含绿叶 7 有 ' + stat[1] + ' 格');
  /* 灯柱与路标(props fill) */
  for (const y of [25, 26, 27]) assert.strictEqual(cell(ctx, 77, y, 92), 5, '广场灯柱 5 @(' + y + ')');
  assert.strictEqual(cell(ctx, 77, 28, 92), 19, '广场灯块 19 @(77,28,92)');
  assert.strictEqual(cell(ctx, 64, 25, 67), 5, '西灯柱 5 @(64,25,67)');
  assert.strictEqual(cell(ctx, 64, 28, 67), 19, '西灯块 19 @(64,28,67)');
  assert.strictEqual(cell(ctx, 73, 25, 67), 5, '广场路标柱 5 @(73,25,67)');
  assert.strictEqual(cell(ctx, 73, 26, 67), 5, '广场路标柱 5 @(73,26,67)');
  assert.strictEqual(cell(ctx, 73, 27, 67), 6, '广场路牌 6 @(73,27,67)');
  assert.strictEqual(cell(ctx, 50, 25, 95), 5, 'stash 路标柱 5 @(50,25,95)');
  assert.strictEqual(cell(ctx, 50, 27, 95), 6, 'stash 路牌 6 @(50,27,95)');
});

test('通廊与不可达(世界层): 出生回望走廊全空 · 空隙带无立地 · 山脊崖屋就位', () => {
  const {ctx} = townBoot();
  assemble(ctx);
  assert.strictEqual(nonAir(ctx, 78, 80, 25, 47, 76, 111), 0,
      '出生回望走廊 x78..80×z76..111×y≥25 全空(塔足 z2=75 → 走廊 z1=76, §4.3 视线管理)');
  assert.strictEqual(nonAir(ctx, 0, 159, 0, 47, 29, 31), 0,
      '空隙带 z29..31 全域零方块(山体 z2=28 · 核心区 z1=32 之间无立地=远景不可达执行见证)');
  assert.strictEqual(cell(ctx, 79, 44, 20), 3, '山脊石 3 @(79,44,20)(顶高过钟塔 38)');
  assert.strictEqual(cell(ctx, 80, 44, 20), 3, '山脊石 3 @(80,44,20)');
  assert.strictEqual(cell(ctx, 16, 24, 20), 3, '山体西缘 topY=24 @(16,24,20)');
  assert.strictEqual(cell(ctx, 16, 25, 20), 0, '西缘柱顶即止 @(16,25,20)');
  assert.strictEqual(cell(ctx, 143, 24, 20), 3, '山体东缘 topY=24 @(143,24,20)');
  assert.strictEqual(cell(ctx, 40, 36, 16), 6, '崖屋 A 底 6 @(40,36,16)');
  assert.strictEqual(cell(ctx, 40, 41, 16), 6, '崖屋 A 顶 6 @(40,41,16)');
  assert.strictEqual(cell(ctx, 112, 35, 20), 6, '崖屋 B 底 6 @(112,35,20)');
  assert.strictEqual(cell(ctx, 112, 40, 20), 6, '崖屋 B 顶 6 @(112,40,20)');
});

test('确定性: 清场重建两遍 worldCells 全量逐格相等(装配全链确定性重放)', () => {
  const {ctx} = townBoot();
  assemble(ctx);
  const blocks = blockCount(ctx);
  assert.ok(blocks > 200000,
      '首遍装配非空且达基底体量(空世界对空世界恒相等=假绿, 非空是本测前提), 实得 ' + blocks);
  probe(ctx, 'globalThis.__snap1 = new Uint8Array(worldCells)');
  assemble(ctx); /* world.clear() + init 再来一遍 */
  const same = probe(ctx,
      '(() => { for (let i = 0; i < worldCells.length; i++)' +
      ' if (__snap1[i] !== worldCells[i]) return false; return true; })()');
  assert.strictEqual(same, true,
      '两次装配 worldCells 全等(零随机零墙钟: 散布走 SceneKit.rand/hashRand 确定性散列)');
});
