'use strict';
/* 城镇装配纯核心 (js/town-assembly-core.js) 可执行规格 — node --test (零依赖)
   运行: node --test test/town-assembly-core.test.js
   T-MAP-03 红测(票: docs/town-architecture-design.md §11 T-MAP-03「建筑/场景件/
   植被与地表拼装落地」; 布局/樱花/地表/散布口径权威 docs/town-map-design.md §3-§4;
   数据件 js/town-map-core.js = T-MAP-01 交付, 本票零数据改动)。只测票文要的
   外显行为, 全走公共 seam:
   ① 源守门: -core 纯核心文本卫生(零引擎/零 DOM/零墙钟字面量) + 裸沙盒可装载
      + ==== 五要素头注释;
   ② TOWN_PALETTE 完整性与 T-09 材质安全基线(test/prefab-kit.test.js 同款纪律:
      城镇七行双检旗标+显式清单, 收编 under-room 只检显式清单——火把 48=既有
      探险语义; stall-canopy 缺 canopy 键 = 布幔 theme 映射单源引擎侧
      PF_STALL_CANOPY, 拒双源漂移);
   ③ 钉值: 全表逐键独立字面量(设计权威转录, 防漂移);
   ④ place 调用面: 10 实例与 prefab 段一一对应, face(条目顶层字段)/ids 注入
      一律新对象——townBuildSteps 嵌套 v 与源清单共享引用, 原地改即污染布局
      权威(源清单头注释钉死「消费方只读」);
   ⑤ 植被道具: op 词表封闭 {fill,tree,scrub,recolor,place}; 禁 id 7 的 fill
      (「无散装树几何」的可执行形态——植被一律走 SceneKit 树家族 op); 樱花 =
      tree + recolor(7→16 覆写落调用方, map-design §5.4); 灌木带确定性盐;
      灯柱/路标走 fill;
   ⑥ 几何: 基底三层垫底(序列最前 = 后写者赢的显式见证)/广场农田铺装/路网/
      拱形山体逐柱(中心 44 压钟塔 38 · 两缘 24)/崖屋 3×3×6 坐山体上;
   ⑦ 通廊与不可达(op 层): 出生回望走廊 x78..80×z76..111×y≥25 零写入
      (map-design §4.3 视线管理; 塔足 z2=75), 空隙带 z29..31 零写入(远景带
      不可达的执行见证——山体 z2=28 与核心区 z1=32 之间无立地);
   ⑧ 确定性: 同参同输出;
   ⑨ 微改守门: town-map-core 头注释/GLOSSARY TownMapCore 词条「八段→九段」
      措辞随本票校正(九键清单的事实修正, 数据零改动)。
   装具: vm 载 config + town-map-core + 本件(规划器消费 TOWN_MAP.core 派生
      地表基高与基底范围, 全局名调用期解析——经典脚本同款); 世界层实拼见证
      (place/树/fill 真写世界的格位)归 test/town-mode.test.js T-MAP-03 段。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const CORE_SRC = path.join(ROOT, 'js', 'town-assembly-core.js');

/* ③ 钉值独立字面量: 设计权威(map-design §3-§4 + prefab-specs §4 材质语义 +
   T-09 基线)的测试侧转录, 不引用实现常量(反同义反复)。 */
const PALETTE_WANT = {
  prefab: {
    'tower-belfry': {base: 13, wall: 17, pillar: 5, trim: 5, roof: 9, bell: 19,
      window: 68, flag: 78, door: 64, doorTop: 65},
    'shop-awning': {base: 58, wall: 6, roof: 9, trim: 5, awning: 52, signBg: 15, signAccent: 38, glow: 19, window: 18},
    'windmill-tower': {base: 13, wall: 17, roof: 9, trim: 5, blade: 6, axle: 76, accent: 17},
    'cottage-gable': {base: 58, wall: 6, roof: 9, trim: 5, window: 18, door: 6, chimney: 3},
    'house-loft': {base: 58, wallA: 6, wallB: 5, roof: 9, trim: 5, window: 18, door: 6, balcony: 5},
    'stash-hut': {base: 3, wall: 6, roof: 5, trim: 5, door: 6, metalAccent: 12},
    'under-room': {chest: 51, torch: 48, cap: 8, land: 58},
    'stall-canopy': {frame: 5, counter: 6, goods: 38},
  },
  terrain: {deep: 3, filler: 2, surface: 1},
  ground: {plaza: 17, farm: 41, plazaBand: 58},
  road: {main: 13, lane: 4, curb: 13},
  backdrop: {mountain: 3, cliffHome: 6},
  props: {lampBase: 17, lampPost: 5, lampLight: 19, signPost: 5, signBoard: 6},
  tree: {sakuraLeaf: 78},
};
/* T-09 基线两清单(权威 = test/prefab-kit.test.js 材质基线段, 逐字同源) */
const DANGER_FLAGS = ['tnt', 'fuse', 'portal', 'fluid', 'crop', 'thin',
  'replaceable', 'door', 'bed', 'lchest'];
const BAD_EXPLICIT = [30, 31, 33, 34, 41, 46, 47, 63, 70, 71, 72];
const TOWN_ROWS = ['tower-belfry', 'shop-awning', 'stash-hut', 'windmill-tower',
  'cottage-gable', 'house-loft', 'stall-canopy'];
/* 布局权威独立转录(docs/town-map-design.md §3-§4, = TOWN_MAP 数据的测试侧镜像;
   只抄本测试用到的坐标, 完整性归 test/town-map-core.test.js。樱花株数/点位
   不在此钉——scene 布局清单高频迭代, ⑤ 段改从 scatter 动态派生防漂移) */
const SCRUBS = [{id: 'scrub-west', x: 60, y: 24, z: 70}, {id: 'scrub-east', x: 98, y: 24, z: 92}];
const LAMPS = [{id: 'lamp-plaza', x: 77, y: 24, z: 92}, {id: 'lamp-west', x: 64, y: 24, z: 67}];
const SIGNS = [{id: 'signpost-plaza', x: 73, y: 24, z: 67}, {id: 'signpost-stash', x: 50, y: 24, z: 95}];
const CORRIDOR = {x1: 78, x2: 80, z1: 76, z2: 111, y1: 25}; /* 塔足 z2=75 → 走廊 z1=76 */
const MOUNTAIN = {x1: 16, z1: 8, x2: 143, z2: 28, topCenter: 44, topEdge: 24};

/* ---------- 装具: 载 config + town-map-core + 本件(红期缺文件在此红) ---------- */
function loadCore(extra) {
  assert.ok(fs.existsSync(CORE_SRC),
      '缺 js/town-assembly-core.js(T-MAP-03 交付本体: 材质映射常量 + 装配规划器)');
  const sandbox = Object.assign({console: {log() {}, warn() {}, error() {}}}, extra || {});
  const ctx = vm.createContext(sandbox);
  for (const f of ['js/config.js', 'js/town-map-core.js', 'js/town-assembly-core.js']) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotThrow(() => vm.runInContext(code, ctx, {filename: f}),
        '脚本应可加载: ' + f);
  }
  return ctx;
}
const probe = (ctx, expr) => vm.runInContext(expr, ctx);
const opsJson = (ctx) => JSON.parse(probe(ctx, 'JSON.stringify(townAssemblyOps(townBuildSteps()))'));

/* ---------- ① 源守门 ---------- */

test('源守门: 纯核心文本卫生 — 零引擎/零 DOM/零墙钟字面量 + use strict + ==== 五要素头', () => {
  const src = fs.readFileSync(CORE_SRC, 'utf8');
  assert.ok(src.startsWith('\'use strict\''), '以 "use strict" 开头(conventions 文本卫生)');
  assert.ok(!/\bTHREE\b|document\.|window\./.test(src),
      '零三维渲染库零 DOM: 源文本不含 THREE/document./window.(palette 键 window: 不带点, 不误伤)');
  assert.ok(!/Math\.random|Date\.now|performance\.now/.test(src),
      '零墙钟零随机: 确定性重放红线(散布确定性只走 SceneKit.rand/hashRand)');
  const head = src.indexOf('*/') > 0 ? src.slice(0, src.indexOf('*/')) : '';
  assert.ok(head.includes('====') &&
      head.includes('一句话职责') && head.includes('interface:') &&
      head.includes('依赖') && head.includes('可测性声明'),
  '头注释走 ==== 五要素契约(conventions §1.7)');
});

test('源守门: 裸沙盒可装载 — 零依赖纯核心(无引擎全局也解析无误)', () => {
  const bare = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  const code = fs.readFileSync(CORE_SRC, 'utf8');
  assert.doesNotThrow(() => vm.runInContext(code, bare, {filename: 'js/town-assembly-core.js'}),
      '纯核心装载零依赖(config/TOWN_MAP 都只许调用期解析)');
  assert.strictEqual(probe(bare, 'typeof TOWN_PALETTE'), 'object', 'TOWN_PALETTE 在场');
  assert.strictEqual(probe(bare, 'typeof townAssemblyOps'), 'function', 'townAssemblyOps 在场');
});

/* ---------- ② palette 完整性 + T-09 危险基线 ---------- */

test('palette 完整性: 七段结构在册 · prefab 八行对齐实例清单 · 值全为在册方块 id', () => {
  const ctx = loadCore();
  const shape = JSON.parse(probe(ctx, `JSON.stringify((() => {
    const p = TOWN_PALETTE;
    const flat = [];
    const walk = (o) => Object.values(o).forEach((v) =>
      typeof v === 'object' ? walk(v) : flat.push(v));
    walk(p);
    return {sections: Object.keys(p), rows: Object.keys(p.prefab),
      allRegistered: flat.every((n) => Number.isInteger(n) && n > 0 && !!BLOCKS[n])};
  })())`));
  assert.deepStrictEqual(shape.sections,
      ['prefab', 'terrain', 'ground', 'road', 'backdrop', 'props', 'tree'],
      'palette 七段(预制件/基底/地表/路网/远景/道具/植被)');
  assert.deepStrictEqual(shape.rows, ['tower-belfry', 'shop-awning', 'windmill-tower',
    'cottage-gable', 'house-loft', 'stash-hut', 'under-room', 'stall-canopy'],
  'prefab 八行 = 布局实例清单出现的全部 id(7 新行 + under-room 复用)');
  assert.ok(shape.allRegistered, '每个值都是 config BLOCKS 在册正整数 id');
  assert.ok(!('canopy' in probe(ctx, 'TOWN_PALETTE.prefab["stall-canopy"]')),
      'stall-canopy 缺 canopy 键: 布幔 theme 映射单源引擎侧 PF_STALL_CANOPY(双源即漂移)');
});

test('T-09 材质安全基线: 城镇七行零危险旗标(door/doorTop 槽名豁免)+零显式错用 · under-room 只检显式(火把既有语义)', () => {
  const ctx = loadCore();
  const report = JSON.parse(probe(ctx, `JSON.stringify((() => {
    const FLAGS = ${JSON.stringify(DANGER_FLAGS)};
    const BAD = ${JSON.stringify(BAD_EXPLICIT)};
    const town = ${JSON.stringify(TOWN_ROWS)};
    const out = {bad: [], flag: []};
    for (const [row, ids] of Object.entries(TOWN_PALETTE.prefab)) {
      for (const [slot, bid] of Object.entries(ids)) {
        if (BAD.includes(bid)) out.bad.push(row + '.' + slot + '=' + bid);
        if (!town.includes(row)) continue; /* 收编行: 旗标检止于显式清单(prefab-kit 先例) */
        const def = BLOCKS[bid];
        for (const f of FLAGS) {
          /* v2 门叶两格按槽名豁免(总纲 §2 字库: 门=64/65 关态成对块, tower
             先例 cottage/shop 复用; 槽值仍受 BAD 显式清单管辖, 非槽名门族块
             66/67 开态等仍违例) */
          if (f === 'door' && (slot === 'door' || slot === 'doorTop')) continue;
          if (def && def[f]) out.flag.push(row + '.' + slot + '=' + bid + '(' + f + ')');
        }
      }
    }
    return out;
  })())`));
  assert.deepStrictEqual(report.bad, [],
      'prefab 材质零功能/下界/传送门系错用(30/31/33/34/41/46/47/63/70/71/72)');
  assert.deepStrictEqual(report.flag, [],
      '城镇七行材质零危险旗标块(TNT/引线/门面/流体/庄稼/薄块/可替换/门/床/配对箱; 门族仅 door/doorTop 槽豁免)');
});

/* ---------- ③ 钉值 ---------- */

test('钉值: TOWN_PALETTE 全表独立字面量逐键相等(设计权威转录, 防漂移)', () => {
  const ctx = loadCore();
  const got = JSON.parse(probe(ctx, 'JSON.stringify(TOWN_PALETTE)'));
  assert.deepStrictEqual(got, PALETTE_WANT,
      '全表与设计权威字面量逐键相等(含键集形状: 多键少键换值皆红)');
});

/* ---------- ④ place 调用面 ---------- */

test('place 调用面: 10 实例一一对应 prefab 段保序 · face/ids 注入全走新对象(源只读)', () => {
  const ctx = loadCore();
  const ops = opsJson(ctx);
  const places = ops.filter((o) => o.op === 'place');
  const steps = JSON.parse(probe(ctx,
      'JSON.stringify(townBuildSteps().filter((s) => s.phase === "prefab"))'));
  assert.strictEqual(places.length, steps.length, 'place op 数 = prefab 实例数(13: 7 建筑+埋室+摊位 6)');
  for (let i = 0; i < places.length; i++) {
    const [op, s] = [places[i], steps[i]];
    assert.strictEqual(op.id, s.id, '实例 ' + i + ' id 对齐保序');
    assert.strictEqual(op.x, s.x, '实例 ' + i + ' 锚 x 对齐');
    assert.strictEqual(op.y, s.y, '实例 ' + i + ' 锚 y 对齐');
    assert.strictEqual(op.z, s.z, '实例 ' + i + ' 锚 z 对齐');
    assert.strictEqual(op.v.face, s.face,
        s.id + ' face 来自条目顶层字段(不在 v 内——注入须随 v 转交 place)');
    assert.deepStrictEqual(op.v.ids, PALETTE_WANT.prefab[s.id],
        s.id + ' ids = palette 集中映射值');
    for (const k of Object.keys(s.v)) {
      assert.deepStrictEqual(op.v[k], s.v[k], s.id + ' v 字段 ' + k + ' 保真透传');
    }
  }
  /* under-room 透传保真专项: exit 按 v 原样(不发明平台/沙盖), mat 必传轴在位 */
  const cellar = places.find((o) => o.id === 'under-room');
  assert.deepStrictEqual(cellar.v.exit, {steps: 5, width: 1},
      'cache-cellar exit 原样透传(无 landing/capSwap 发明)');
  assert.strictEqual(cellar.v.mat, 3, 'mat=3 石头必传轴在位');
  /* 引用纪律(in-vm 验引用, JSON 过不了引用): v/ids 新对象, 源清单零污染 */
  const refs = JSON.parse(probe(ctx, `JSON.stringify((() => {
    const steps = townBuildSteps().filter((s) => s.phase === 'prefab');
    const ops = townAssemblyOps(townBuildSteps());
    const places = ops.filter((o) => o.op === 'place');
    return {
      vFresh: places.every((o, i) => o.v !== steps[i].v),
      idsFresh: places.every((o) => o.v.ids !== TOWN_PALETTE.prefab[o.id]),
      noIdsInSource: TOWN_MAP.prefab.every((e) => !('ids' in e.v)),
      noFaceInV: TOWN_MAP.prefab.every((e) => !('face' in e.v)),
    };
  })())`));
  assert.ok(refs.vFresh, 'place 的 v 是新对象(嵌套 v 与源清单共享引用, 原地改即污染布局权威)');
  assert.ok(refs.idsFresh, 'ids 是新对象(消费方改 op 不许反渗 palette 单源)');
  assert.ok(refs.noIdsInSource, '规划后源清单 v 仍无 ids 键(TOWN_MAP 只读红线)');
  assert.ok(refs.noFaceInV, '规划后源清单 v 仍无 face 键(face 属条目顶层)');
});

/* ---------- ④' place 执行见证: 行键×蓝图键面的运行时耦合 ---------- */

/* pfMerge 键校验(palette 行键 ⊆ 蓝图 defaults.ids 键)是装配链唯一隐性炸点:
   palette 行与蓝图 kernel 分居两文件——assembly 侧只钉「行=PALETTE_WANT 同形」,
   蓝图侧只钉「defaults 键面」, 谁也拦不住「行有键而蓝图没收」的 merge 期 throw;
   唯一可靠拦截 = 真执行: vm 同上下文载 prefab-kit + 本件, spy 世界把全部
   place op 落场, 断言每笔写 ⊆ footOf 同参盒——运行时消费方(adventure-dims-core
   place 执行路径)的等价见证。装具手法借 test/prefab-kit.test.js loadKit。 */
test('place 执行见证: 13 实例全落场 — pfMerge 行键×蓝图键面耦合不炸, 每笔写 ∈ footOf 同参盒', () => {
  const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-assembly-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
  }
  /* spy 世界: setBlockRaw 后到重绑换记录器(voxel 顶函数声明=全局绑定,
     PrefabKit 调用期解析跟随——prefab-kit.test.js loadKit.spySet 同款) */
  vm.runInContext('var __rec = [];\n' +
      'setBlockRaw = function (x, y, z, id) { __rec.push([x, y, z, id]); };', eng);
  const rec = vm.runInContext('__rec', eng);
  const ops = JSON.parse(vm.runInContext(
      'JSON.stringify(townAssemblyOps(townBuildSteps()))', eng));
  const places = ops.filter((o) => o.op === 'place');
  assert.strictEqual(places.length, 13, 'place op 13 个(7 建筑+埋室+摊位 6)');
  /* v2 新键面证据: door/doorTop 与 accent 槽真的并入 place v(注入单源=palette
     行; 行键漂移时此处先红, pfMerge 执行期 throw 兜底) */
  const towerOp = places.find((o) => o.id === 'tower-belfry');
  assert.strictEqual(towerOp.v.ids.door, PALETTE_WANT.prefab['tower-belfry'].door,
      'tower 行 door 槽已并入 place v');
  assert.strictEqual(towerOp.v.ids.doorTop, PALETTE_WANT.prefab['tower-belfry'].doorTop,
      'tower 行 doorTop 槽已并入 place v');
  const windOp = places.find((o) => o.id === 'windmill-tower');
  assert.strictEqual(windOp.v.ids.accent, PALETTE_WANT.prefab['windmill-tower'].accent,
      'windmill 行 accent 槽已并入 place v');
  for (const o of places) {
    rec.length = 0;
    const box = vm.runInContext(
        'PrefabKit.place(' + JSON.stringify(o.id) + ', ' + o.x + ', ' + o.y + ', ' +
        o.z + ', ' + JSON.stringify(o.v) + ')', eng);
    assert.ok(rec.length > 0, o.id + ' 落场有写(防全空假绿)');
    for (const w of rec) {
      assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
          w[2] >= box.z1 && w[2] <= box.z2,
      o.id + ' 写 (' + w + ') ⊄ footOf 盒 ' + JSON.stringify(box) + '(行键/变体与蓝图键面漂移?)');
    }
  }
});

/* ---------- ⑤ 植被道具 ---------- */

test('植被道具: op 词表封闭 · 禁 id7 的 fill(无散装树几何) · 樱花=tree+recolor 覆写落调用方', () => {
  const ctx = loadCore();
  const ops = opsJson(ctx);
  const VOCAB = ['fill', 'tree', 'scrub', 'recolor', 'place'];
  assert.ok(ops.every((o) => VOCAB.includes(o.op)), '词表封闭: ' +
    [...new Set(ops.map((o) => o.op))].join('/'));
  const fills = ops.filter((o) => o.op === 'fill');
  assert.ok(fills.every((f) => f.id !== 7),
      '零 id7 的 fill: 树叶几何单源 SceneKit 树家族(map-design §5.4), 散装树叶即红');
  /* 樱花: tree op 落散布点位 + recolor 盒(叶域=[y+3,y+6]: SceneKit.tree 叶层
     ly=top+dy-1 ∈ [top-2,top], 干高 {4,5} × 基 y+1 的并集)。株数/点位从
     scatter 清单动态派生(随 scene 布局迭代走, 防过期钉值漂移); op 形
     (recolor 盒几何与覆写对)仍钉死——那是本件派生逻辑的权威。 */
  const sakuraSites = JSON.parse(probe(ctx,
      'JSON.stringify(townBuildSteps().filter((s) => s.phase === "scatter" && s.kind === "sakura"))'));
  assert.ok(sakuraSites.length > 0, '散布清单樱花在场(装具自检)');
  const trees = ops.filter((o) => o.op === 'tree');
  assert.deepStrictEqual(trees, sakuraSites.map((s) => {
    return {op: 'tree', x: s.x, y: s.y, z: s.z};
  }),
  'tree op 与散布清单樱花一一对应保序');
  const recolors = ops.filter((o) => o.op === 'recolor');
  assert.deepStrictEqual(recolors, sakuraSites.map((s) => {
    return {op: 'recolor', x1: s.x - 2, y1: s.y + 3, z1: s.z - 2,
      x2: s.x + 2, y2: s.y + 6, z2: s.z + 2, from: 7, to: PALETTE_WANT.tree.sakuraLeaf};
  }), 'recolor 盒恰覆两型干高冠域, 7→78 樱粉覆写(§5.4 覆写策略落调用方)');
  assert.deepStrictEqual(ops.filter((o) => o.op === 'scrub'), SCRUBS.map((s) => {
    return {op: 'scrub', x: s.x, top: s.y, z: s.z, salt: s.x * 131 + s.z};
  }), 'scrub op 两丛带确定性盐(同参同丛, SceneKit.scrub 契约)');
  const lampSite = (s) => fills.filter((f) => f.x1 === s.x && f.x2 === s.x &&
    f.z1 === s.z && f.z2 === s.z);
  for (const s of LAMPS) {
    assert.deepStrictEqual(lampSite(s), [
      {op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 1, z2: s.z,
        id: PALETTE_WANT.props.lampBase},
      {op: 'fill', x1: s.x, y1: s.y + 2, z1: s.z, x2: s.x, y2: s.y + 4, z2: s.z,
        id: PALETTE_WANT.props.lampPost},
      {op: 'fill', x1: s.x, y1: s.y + 5, z1: s.z, x2: s.x, y2: s.y + 5, z2: s.z,
        id: PALETTE_WANT.props.lampLight},
    ], s.id + ' 灯柱=座1+柱3+灯1 三笔 fill(props palette 单源, 视觉重制 §3 M)');
  }
  for (const s of SIGNS) {
    assert.deepStrictEqual(lampSite(s), [
      {op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 2, z2: s.z,
        id: PALETTE_WANT.props.signPost},
      {op: 'fill', x1: s.x, y1: s.y + 3, z1: s.z, x2: s.x, y2: s.y + 3, z2: s.z,
        id: PALETTE_WANT.props.signBoard},
    ], s.id + ' 路标=柱2+牌1 两笔 fill');
  }
});

/* ---------- ⑥ 几何 ---------- */

test('几何: 基底三层垫底恰覆核心区(序列最前=后写者赢显式见证) · 铺装/路网对齐布局清单', () => {
  const ctx = loadCore();
  const ops = opsJson(ctx);
  const C = {x1: 32, z1: 32, x2: 127, z2: 127}; /* TOWN_MAP.core 独立转录(96×96 居中) */
  assert.deepStrictEqual(ops.slice(0, 3), [
    {op: 'fill', x1: C.x1, y1: 0, z1: C.z1, x2: C.x2, y2: 20, z2: C.z2, id: PALETTE_WANT.terrain.deep},
    {op: 'fill', x1: C.x1, y1: 21, z1: C.z1, x2: C.x2, y2: 23, z2: C.z2, id: PALETTE_WANT.terrain.filler},
    {op: 'fill', x1: C.x1, y1: 24, z1: C.z1, x2: C.x2, y2: 24, z2: C.z2, id: PALETTE_WANT.terrain.surface},
  ], '基底三层(deep 0..20 石/filler 21..23 土/surface 24 草)是 op 序列最前三笔——后写者赢, 建筑压得住草地');
  const fillAt = (x, z, y) => ops.findLast((o) => o.op === 'fill' &&
    x >= o.x1 && x <= o.x2 && z >= o.z1 && z <= o.z2 && y >= o.y1 && y <= o.y2); /* 末笔覆盖=写者赢 */
  assert.deepStrictEqual(fillAt(79, 79, 24),
      {op: 'fill', x1: 66, y1: 24, z1: 66, x2: 93, y2: 24, z2: 93, id: PALETTE_WANT.ground.plaza},
      '广场铺装恰一条 28×28(y=地表基高, ground 条目无 y 字段——基高从 core.groundY 派生)');
  assert.strictEqual(fillAt(70, 50, 24).id, PALETTE_WANT.ground.farm, '农田 A 铺耕地');
  assert.strictEqual(fillAt(84, 50, 24).id, PALETTE_WANT.ground.farm, '农田 B 铺耕地');
  assert.strictEqual(fillAt(79, 100, 24).id, PALETTE_WANT.road.main, '南主路 13 石砖');
  assert.strictEqual(fillAt(60, 63, 24).id, PALETTE_WANT.road.main, '北主路 13 石砖');
  assert.strictEqual(fillAt(110, 86, 24).id, PALETTE_WANT.road.main, '东主路 13 石砖');
  assert.strictEqual(fillAt(65, 79, 24).id, PALETTE_WANT.road.lane, '西支路 4');
  assert.strictEqual(fillAt(55, 50, 24).id, PALETTE_WANT.road.lane, '田园支路 4');
  assert.strictEqual(fillAt(60, 95, 24).id, PALETTE_WANT.road.lane, '储藏支路 4');
});

test('几何: 拱形山体逐柱满覆盖(中心 44 压钟塔 38 · 两缘 24) · 崖屋 3×3×6 坐山体上', () => {
  const ctx = loadCore();
  const ops = opsJson(ctx);
  const cols = ops.filter((o) => o.op === 'fill' && o.id === PALETTE_WANT.backdrop.mountain &&
    o.x1 === o.x2 && o.y1 === 0 && o.z1 === MOUNTAIN.z1 && o.z2 === MOUNTAIN.z2);
  const xs = [...new Set(cols.map((c) => c.x1))].sort((a, b) => a - b);
  assert.deepStrictEqual(xs,
      Array.from({length: MOUNTAIN.x2 - MOUNTAIN.x1 + 1}, (_, i) => MOUNTAIN.x1 + i),
      '山体逐柱满覆盖 x16..143(宽 ≥ 核心区 96, map-design §4.2)');
  const topAt = (x) => cols.find((c) => c.x1 === x).y2;
  assert.strictEqual(topAt(79), MOUNTAIN.topCenter, '山脊中心 44(压钟塔 38, 顶高过钟塔)');
  assert.strictEqual(topAt(80), MOUNTAIN.topCenter, '双中心列同高 44');
  assert.strictEqual(topAt(16), MOUNTAIN.topEdge, '西缘 24(二次拱形落地)');
  assert.strictEqual(topAt(143), MOUNTAIN.topEdge, '东缘 24');
  assert.ok(cols.every((c) => c.y1 === 0), '每柱自 y0 满填(崖体无悬空)');
  assert.deepStrictEqual(ops.filter((o) => o.op === 'fill' &&
    o.id === PALETTE_WANT.backdrop.cliffHome && o.z2 <= MOUNTAIN.z2), [
    {op: 'fill', x1: 55, y1: 41, z1: 21, x2: 57, y2: 46, z2: 23, id: PALETTE_WANT.backdrop.cliffHome},
    {op: 'fill', x1: 102, y1: 41, z1: 21, x2: 104, y2: 46, z2: 23, id: PALETTE_WANT.backdrop.cliffHome},
  ], '崖顶房屋两栋 3×3×6 盒(baseY..baseY+5, 数据 baseY/topY 差恒 6; x56/x103 脊线' +
    '肩段露剪影 5 格, 视觉重制 §3 B); 过滤以 z2≤山带28 界定远景——' +
    'id 6 与路牌 signBoard 共值, 牌在核心区 z≥32 不入集');
});

/* ---------- ⑦ 通廊与不可达(op 层) ---------- */

test('通廊与不可达(op 层): 出生回望走廊零写入 · 空隙带 z29..31 零写入', () => {
  const ctx = loadCore();
  const ops = opsJson(ctx);
  const overlaps = (o, x1, x2, y1, y2, z1, z2) =>
    o.x1 <= x2 && o.x2 >= x1 && o.y1 <= y2 && o.y2 >= y1 && o.z1 <= z2 && o.z2 >= z1;
  /* fill/tree/scrub/recolor 逐盒判交(place 盒归世界层 footOf 见证, 此处不重复) */
  const boxOps = ops.filter((o) => o.op !== 'place');
  assert.ok(boxOps.every((o) => !overlaps(o, CORRIDOR.x1, CORRIDOR.x2,
      CORRIDOR.y1, 47, CORRIDOR.z1, CORRIDOR.z2)),
  '出生回望走廊 x78..80×z76..111×y≥25 零非 place 写入(塔足 z2=75 → 走廊 z1=76; §4.3 视线管理)');
  assert.ok(boxOps.every((o) => !overlaps(o, 0, 159, 0, 47, 29, 31)),
      '空隙带 z29..31 全域零写入(山体 z2=28 · 核心区 z1=32 之间无立地=远景不可达执行见证)');
});

/* ---------- ⑧ 确定性 ---------- */

test('确定性: 同参同输出 — townAssemblyOps(townBuildSteps()) 两次调用全等', () => {
  const ctx = loadCore();
  const a = probe(ctx, 'JSON.stringify(townAssemblyOps(townBuildSteps()))');
  const b = probe(ctx, 'JSON.stringify(townAssemblyOps(townBuildSteps()))');
  assert.strictEqual(a, b, '规划器纯函数: 同参同输出(确定性重放红线)');
});

/* ---------- ⑨ 微改守门 ---------- */

test('微改守门: town-map-core 头注释与 GLOSSARY 词条「八段→九段」措辞校正(数据零改动)', () => {
  const coreSrc = fs.readFileSync(path.join(ROOT, 'js', 'town-map-core.js'), 'utf8');
  assert.ok(!/八段/.test(coreSrc) && /九段/.test(coreSrc),
      'town-map-core interface 行「八段」→「九段」(TOWN_MAP 实有九键: core/plaza/zones + 六清单)');
  const gloss = fs.readFileSync(path.join(ROOT, 'GLOSSARY.md'), 'utf8');
  /* 定位锚用正文词条头形态(带换行+**: 后缀): 词条一览索引行也含同名条目
     (A2 双向对齐后), 裸名 indexOf 会先命中索引行致切片失效——精确锚非放宽 */
  const at = gloss.indexOf('\n**城镇地图核心（TownMapCore）**:');
  assert.ok(at > 0, 'GLOSSARY TownMapCore 词条在场(装具自检)');
  const entry = gloss.slice(at, gloss.indexOf('\n### ', at));
  assert.ok(!/八段/.test(entry) && /九段/.test(entry), '词条段数措辞同校「九段」');
  assert.ok(/_Avoid_:.*城镇地图（散称）/.test(entry),
      '词条补 _Avoid_: 城镇地图（散称）(模块名唯一, 散称禁用)');
});
