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

/* ---------- 记录桩装具: 装配/出生/直进事件全记录(带单调序号) ---------- */
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
  for (const f of ['js/town-map-core.js', 'js/modes/town.js']) {
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
