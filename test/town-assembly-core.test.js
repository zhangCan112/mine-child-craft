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
   ⑤ 植被道具: op 词表封闭 {fill,tree,scrub,recolor,place,spinner}; 禁 id 7 的 fill
      (「无散装树几何」的可执行形态——植被一律走 SceneKit 树家族 op); 樱花 =
      tree + recolor(7→16 覆写落调用方, map-design §5.4); 灌木带确定性盐;
      灯柱/路标走 fill;
   ⑥ 几何: 基底三层垫底(序列最前 = 后写者赢的显式见证)/广场农田铺装/路网/
      拱形山体逐柱(中心 44 压钟塔 38 · 两缘 24)/崖屋 3×3×6 坐山体上;
   ⑦ 通廊与不可达(op 层): 出生回望走廊 x78..80×z76..111×y≥25 零写入
      (map-design §4.3 视线管理; 塔足 z2=75), 空隙带 z29..31 体块零写入
      (Step E 起单格贴地点缀豁免——远景不可达=无立地面, 非无装饰);
   ⑧ 确定性: 同参同输出;
   ⑨ 微改守门: town-map-core 头注释/GLOSSARY TownMapCore 词条「九段→十段」
      措辞随票校正(T0 beyond 判据票十键清单的事实进位, 数据零改动)。
   ⑩ 南缘攀登走廊与裙板合脊(PO 亲需② southCorridor 门控+scene
      6413b00 裙板协同): 缺省零变化(真布局走廊列无 z 单线笔)+合成
      条目镜像公式逐点全扫(走廊包络 ≤1 阶/南端贴地/北端接山肩/
      两侧壁瀑布不受扰)+裙板合脊独立(z 域不重叠各归各, 主山逐字节
      不变)+非 bands 拼写域抛。
   ⑪ T2 墙圈派生(spec §3.3 · 方案 §1.2 ground kind town-rim): 按段出
      fill 恰 48 笔(14 段 13+2 帽 17+32 花 61/62)·花奇偶交替开口跳空·
      零盐·合法域扩 town-rim。
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
   T-09 基线; v2 起以 town-visual-revamp-spec §2 字库为准)的测试侧转录,
   不引用实现常量(反同义反复)。扩键登记见 town-assembly-core.js 头注释。 */
const PALETTE_WANT = {
  prefab: {
    'tower-belfry': {base: 13, wall: 17, pillar: 5, trim: 5, roof: 9, bell: 19,
      window: 68, flag: 78, door: 64, doorTop: 65},
    'shop-awning': {base: 13, wall: 6, plaster: 17, trim: 5, roof: 9,
      awning: 15, awningTrim: 17, signBg: 76, signBird: 52, signComb: 16,
      signLight: 19, glow: 19, window: 68},
    'windmill-tower': {base: 13, wall: 17, roof: 9, trim: 5, blade: 6, axle: 76, accent: 17},
    'cottage-gable': {base: 13, wall: 6, trim: 5, frame: 17, roof: 9, window: 18,
      door: 64, doorTop: 65, chimney: 4,
      bedGrass: 40, bedFlower1: 61, bedFlower2: 62},
    'house-loft': {base: 13, wallA: 6, wallB: 17, roof: 9, trim: 5, window: 18,
      frame: 17, door: 64, doorTop: 65, balcony: 5, awning: 15},
    'stash-hut': {base: 3, wall: 6, roof: 5, trim: 5, door: 64, doorTop: 65,
      metalAccent: 12, barrel: 5, chest: 51, mossy: 14, porchLamp: 19},
    'under-room': {chest: 51, torch: 48, cap: 8, land: 58},
    'stall-canopy': {frame: 5, counter: 6, goodsBread: 17, goodsFlower: 78,
      goodsFruit: 76, goodsLeaf1: 61, goodsLeaf2: 62, flag: 78},
    'scarecrow': {post: 5, arm: 6, shirt: 15, head: 76},
    'clothesline': {pole: 5, line: 5, shirtBlue: 15, shirtPink: 78, shirtQuartz: 17},
    'woodpile': {log: 5},
    'hencoop': {hay: 58, henBody: 52, henComb: 16},
    'board-pool': {board: 5, poolEdge: 17, water: 15, flagPole: 5, flag: 78},
    'iron-golem': {skull: 17, nose: 17, eye: 12, moss: 14, plinth: 3,
      body: 17, belt: 12},
    /* ②镇侧门楼(T1a): 石砌主体全 13(基座桥/柱/梁/配块同料), 壁灯 19,
       门额牌 80(sign 槽, T-09 thin 豁免), 柱头/檐口 17, 屋面/屋脊 79 */
    'town-gate': {base: 13, wall: 13, lamp: 19, sign: 80, capital: 17,
      eave: 17, roofTile: 79},
  },
  terrain: {deep: 3, filler: 2, surface: 1},
  ground: {plaza: 17, farm: 41, plazaBand: 58, fieldRidge: 58, fieldFence: 5,
    shrineCore: 13, shrineEdge: 4},
  road: {main: 13, lane: 4, curb: 13, curbLane: 4},
  backdrop: {mountain: 3, cliffHome: 6, mountainSnow: 54, mountainMoss: 14,
    mountainGrass: 1, boulder: 14, cliffWall: 52, cliffFrame: 17, cliffRoof: 9,
    cliffLamp: 19, cliffWindow: 18},
  props: {lampBase: 17, lampPost: 5, lampLight: 19, signPost: 5, signBoard: 6,
    tuft: 40, flagPole: 5, flowerbedRing: 40, barrel: 5, pumpkin: 76,
    plank: 5, glassPane: 68, crateBox: 51,
    flagCloth: {sakura: 78, blue: 15, quartz: 17, red: 16},
    flowerCore: {y: 61, w: 62}},
  tree: {sakuraLeaf: 78},
};
/* T-09 基线两清单(权威 = test/prefab-kit.test.js 材质基线段, 逐字同源) */
const DANGER_FLAGS = ['tnt', 'fuse', 'portal', 'fluid', 'crop', 'thin',
  'replaceable', 'door', 'bed', 'lchest'];
const BAD_EXPLICIT = [30, 31, 33, 34, 41, 46, 47, 63, 70, 71, 72];
const TOWN_ROWS = ['tower-belfry', 'shop-awning', 'stash-hut', 'windmill-tower',
  'cottage-gable', 'house-loft', 'stall-canopy', 'scarecrow', 'clothesline',
  'woodpile', 'hencoop', 'board-pool', 'iron-golem'];
/* 布局权威独立转录(docs/town-map-design.md §3-§4, = TOWN_MAP 数据的测试侧镜像;
   只抄本测试用到的坐标, 完整性归 test/town-map-core.test.js。樱花株数/点位
   不在此钉——scene 布局清单高频迭代, ⑤ 段改从 scatter 动态派生防漂移) */
const SCRUBS = [{id: 'scrub-rim-w1', x: 17, y: 25, z: 26},
  {id: 'scrub-rim-w2', x: 19, y: 26, z: 26}, {id: 'scrub-rim-w3', x: 21, y: 27, z: 27},
  {id: 'scrub-rim-e1', x: 141, y: 25, z: 26},
  {id: 'scrub-west', x: 60, y: 24, z: 70}, {id: 'scrub-east', x: 98, y: 24, z: 92}];
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

test('palette 完整性: 七段结构在册 · prefab 十五行(8 实例行+TIDEA 六行能力行+②门楼) · 值全为在册方块 id', () => {
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
    'cottage-gable', 'house-loft', 'stash-hut', 'under-room', 'stall-canopy',
    'scarecrow', 'clothesline', 'woodpile', 'hencoop', 'board-pool',
    'iron-golem', 'town-gate'],
  'prefab 十五行 = 布局实例行(7 新行+under-room 复用+②镇侧门楼 T1a)+TIDEA 六行能力行(波次一五+PO 亲需铁傀儡全身立像; 蓝图已立, 落位归 scene)');
  assert.ok(shape.allRegistered, '每个值都是 config BLOCKS 在册正整数 id');
  assert.ok(!('canopy' in probe(ctx, 'TOWN_PALETTE.prefab["stall-canopy"]')),
      'stall-canopy 缺 canopy 键: 布幔 theme 映射单源引擎侧 PF_STALL_CANOPY(双源即漂移)');
});

test('T-09 材质安全基线: 城镇十四行零危险旗标(door/doorTop 门叶+bed* 花坛+sign 门额牌槽名豁免)+零显式错用 · under-room 只检显式(火把既有语义)', () => {
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
          /* v2 槽名豁免(总纲 §2 字库; prefab-kit EXEMPT_SLOT_FLAGS 同源):
             door/doorTop 槽=关态门叶 64/65 豁免 door 旗标; bedGrass/
             bedFlower1/bedFlower2 槽=墙根花坛 40/61/62 薄块点缀, goodsLeaf1/
             goodsLeaf2 槽=摊位 md 中景花叶 61/62(Step D 新槽)豁免 thin/
             replaceable; sign 槽=门额牌 80 S2 竖版贴图件(T1a ②门楼,
             thin 0.15 是形制本体)只豁免 thin。槽值仍受 BAD 显式清单管辖,
             非槽名门族块/裸草花仍违例 */
          if ((f === 'door' && (slot === 'door' || slot === 'doorTop')) ||
              ((f === 'thin' || f === 'replaceable') &&
                  (slot === 'bedGrass' || slot === 'bedFlower1' || slot === 'bedFlower2' ||
                   slot === 'goodsLeaf1' || slot === 'goodsLeaf2')) ||
              (f === 'thin' && slot === 'sign')) {
            continue;
          }
          if (def && def[f]) out.flag.push(row + '.' + slot + '=' + bid + '(' + f + ')');
        }
      }
    }
    return out;
  })())`));
  assert.deepStrictEqual(report.bad, [],
      'prefab 材质零功能/下界/传送门系错用(30/31/33/34/41/46/47/63/70/71/72)');
  assert.deepStrictEqual(report.flag, [],
      '城镇十二行材质零危险旗标块(TNT/引线/门面/流体/庄稼/薄块/可替换/门/床/配对箱; 门族仅 door/doorTop 槽豁免)');
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
      'JSON.stringify(townBuildSteps().filter((s) => s.phase === "prefab" && ' +
      '!(s.v && s.v.sailStatic === false)))'));
  assert.strictEqual(places.length, steps.length,
      'place op 数 = prefab 实例数(13: 原十三实例 − windmill 换防 spinner 不列' +
      ' + PO 亲需铁傀儡头)');
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
    const steps = townBuildSteps().filter((s) => s.phase === 'prefab' &&
        !(s.v && s.v.sailStatic === false));
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
test('place 执行见证: 18 实例全落场 — pfMerge 行键×蓝图键面耦合不炸, 每笔写 ∈ footOf 同参盒', () => {
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
  assert.strictEqual(places.length, 19,
      'place op 19 个(5 建筑+埋室 1+摊位 6+陈设落位 5: scarecrow/clothesline/' +
      'woodpile/hencoop/board-pool+PO 亲需铁傀儡头 1+②镇侧门楼 1(T1a); ' +
      'windmill-tower 换防 spinner op 不列——蓝图行=波次一 a73623c, 落位数据=' +
      'scene eb9175e+尾段翻转, scene §10.4 补丁底稿吸收)');
  /* v2 新键面证据: door/doorTop 与 accent 槽真的并入 place v(注入单源=palette
     行; 行键漂移时此处先红, pfMerge 执行期 throw 兜底) */
  const towerOp = places.find((o) => o.id === 'tower-belfry');
  assert.strictEqual(towerOp.v.ids.door, PALETTE_WANT.prefab['tower-belfry'].door,
      'tower 行 door 槽已并入 place v');
  assert.strictEqual(towerOp.v.ids.doorTop, PALETTE_WANT.prefab['tower-belfry'].doorTop,
      'tower 行 doorTop 槽已并入 place v');
  const windOp = ops.find((o) => o.id === 'windmill-tower');
  assert.strictEqual(windOp.op, 'spinner', 'windmill 换防 spinner op(尾段翻转, 不复入 place)');
  assert.strictEqual(windOp.v.ids.accent, PALETTE_WANT.prefab['windmill-tower'].accent,
      'windmill 行 accent 槽已并入 spinner v(place 双胞胎同形)');
  const cotOp = places.find((o) => o.id === 'cottage-gable');
  assert.strictEqual(cotOp.v.ids.bedGrass, PALETTE_WANT.prefab['cottage-gable'].bedGrass,
      'cottage 行 bedGrass 槽(花坛)已并入 place v');
  assert.strictEqual(cotOp.v.ids.frame, PALETTE_WANT.prefab['cottage-gable'].frame,
      'cottage 行 frame 槽(窗框楣)已并入 place v');
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
  const VOCAB = ['fill', 'tree', 'scrub', 'recolor', 'place', 'spinner'];
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
  }), 'scrub op 六丛带确定性盐(同参同丛, SceneKit.scrub 契约)');
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
  assert.deepStrictEqual(fillAt(70, 70, 24),
      {op: 'fill', x1: 66, y1: 24, z1: 66, x2: 93, y2: 24, z2: 93, id: PALETTE_WANT.ground.plaza},
      '广场铺装恰一条 28×28(y=地表基高, ground 条目无 y 字段——基高从 core.groundY 派生); pin 点 (70,70) 避开主轴花带(x79..80 穿广场中心, TIDEA-07 显影)');
  assert.strictEqual(fillAt(70, 50, 24).id, 42, '农田 A 田垄作物 42(farm-rows 轮转, 作物字面不入 palette)');
  assert.strictEqual(fillAt(84, 50, 24).id, 45, '农田 B 田垄作物 45(farm-rows 轮转)');
  assert.strictEqual(fillAt(79, 100, 24).id, PALETTE_WANT.road.main, '南主路 13 石砖');
  assert.strictEqual(fillAt(60, 63, 24).id, PALETTE_WANT.road.main, '北主路 13 石砖');
  assert.strictEqual(fillAt(110, 86, 24).id, PALETTE_WANT.road.main, '东主路 13 石砖');
  assert.strictEqual(fillAt(65, 79, 24).id, PALETTE_WANT.road.lane, '西支路 4');
  assert.strictEqual(fillAt(55, 50, 24).id, PALETTE_WANT.road.lane, '田园支路 4');
  assert.strictEqual(fillAt(60, 95, 24).id, PALETTE_WANT.road.lane, '储藏支路 4');
});

test('几何: 拱形山体逐柱满覆盖(基段笔顶 23, bands 后顶高由雪段表达) · 崖屋 v2 拆笔坐山体上', () => {
  const ctx = loadCore();
  const ops = opsJson(ctx);
  const cols = ops.filter((o) => o.op === 'fill' && o.id === PALETTE_WANT.backdrop.mountain &&
    o.x1 === o.x2 && o.y1 === 0 && o.z1 === MOUNTAIN.z1 && o.z2 === MOUNTAIN.z2);
  const xs = [...new Set(cols.map((c) => c.x1))].sort((a, b) => a - b);
  /* 走廊两列 x60..61 柱笔被阶梯拆 z 单线笔(southCorridor 激活见证另钉),
     不在逐柱满覆盖断言之列 */
  assert.deepStrictEqual(xs,
      Array.from({length: MOUNTAIN.x2 - MOUNTAIN.x1 + 1}, (_, i) => MOUNTAIN.x1 + i)
          .filter((x) => x < CORR.x1 || x > CORR.x2),
      '山体逐柱满覆盖 x16..143(走廊两列拆阶梯笔另钉; 宽 ≥ 核心区 96, map-design §4.2)');
  const topAt = (x) => cols.find((c) => c.x1 === x).y2;
  assert.strictEqual(topAt(79), 23, '山脊基段笔顶 23(bands 拆笔后 id3 每柱首笔)');
  assert.strictEqual(topAt(80), 23, '双中心列基段笔顶 23');
  assert.strictEqual(topAt(16), 23, '西缘基段笔顶 23(两缘列顶 24 由苔段表达)');
  assert.strictEqual(topAt(143), 23, '东缘基段笔顶 23');
  assert.ok(cols.every((c) => c.y1 === 0), '每柱自 y0 满填(崖体无悬空)');
  /* 崖屋 v2 拆笔(style:'v2', scene 9ea581b 条目): 每屋 10 笔=白墙 52 盒
     (baseY..topY-2)+石英角柱 17×4+窗 18 十字(baseY+2, 后写覆墙不撞角柱)+
     橙顶 9 双层(topY-1 全 3×3+topY 内缩芯)+顶缘灯 19(x±1 同列一笔);
     op 序=派生序(底稿 scene-closeout §7.5.1(3) 导出法实测); 过滤以
     z2≤山带 28 界定远景, id 集排山体 3/14/1/54 */
  assert.deepStrictEqual(ops.filter((o) => o.op === 'fill' && o.z2 <= MOUNTAIN.z2 &&
    [PALETTE_WANT.backdrop.cliffWall, PALETTE_WANT.backdrop.cliffFrame,
      PALETTE_WANT.backdrop.cliffWindow, PALETTE_WANT.backdrop.cliffRoof,
      PALETTE_WANT.backdrop.cliffLamp].includes(o.id)), [
    /* 瀑布两翼(TIDEA-05 波次二显影): 石英水花 id17 撞 cliffFrame 入本
       过滤器 id 集, z26≤28 在界内——头部前置=派生序(瀑布条目先于崖屋);
       柱笔 54=mountainSnow 不在 id 集自然排外 */
    {op: 'fill', x1: 62, y1: 25, z1: 26, x2: 62, y2: 26, z2: 26, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 65, y1: 25, z1: 26, x2: 65, y2: 26, z2: 26, id: PALETTE_WANT.backdrop.cliffFrame},
    /* A 屋(中心 56) */
    {op: 'fill', x1: 55, y1: 41, z1: 21, x2: 57, y2: 45, z2: 23, id: PALETTE_WANT.backdrop.cliffWall},
    {op: 'fill', x1: 55, y1: 41, z1: 21, x2: 55, y2: 45, z2: 21, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 57, y1: 41, z1: 21, x2: 57, y2: 45, z2: 21, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 55, y1: 41, z1: 23, x2: 55, y2: 45, z2: 23, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 57, y1: 41, z1: 23, x2: 57, y2: 45, z2: 23, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 55, y1: 43, z1: 22, x2: 57, y2: 43, z2: 22, id: PALETTE_WANT.backdrop.cliffWindow},
    {op: 'fill', x1: 56, y1: 43, z1: 21, x2: 56, y2: 43, z2: 23, id: PALETTE_WANT.backdrop.cliffWindow},
    {op: 'fill', x1: 55, y1: 46, z1: 21, x2: 57, y2: 46, z2: 23, id: PALETTE_WANT.backdrop.cliffRoof},
    {op: 'fill', x1: 56, y1: 47, z1: 22, x2: 56, y2: 47, z2: 22, id: PALETTE_WANT.backdrop.cliffRoof},
    {op: 'fill', x1: 55, y1: 47, z1: 22, x2: 57, y2: 47, z2: 22, id: PALETTE_WANT.backdrop.cliffLamp},
    /* B 屋(中心 103, 同构 x+47) */
    {op: 'fill', x1: 102, y1: 41, z1: 21, x2: 104, y2: 45, z2: 23, id: PALETTE_WANT.backdrop.cliffWall},
    {op: 'fill', x1: 102, y1: 41, z1: 21, x2: 102, y2: 45, z2: 21, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 104, y1: 41, z1: 21, x2: 104, y2: 45, z2: 21, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 102, y1: 41, z1: 23, x2: 102, y2: 45, z2: 23, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 104, y1: 41, z1: 23, x2: 104, y2: 45, z2: 23, id: PALETTE_WANT.backdrop.cliffFrame},
    {op: 'fill', x1: 102, y1: 43, z1: 22, x2: 104, y2: 43, z2: 22, id: PALETTE_WANT.backdrop.cliffWindow},
    {op: 'fill', x1: 103, y1: 43, z1: 21, x2: 103, y2: 43, z2: 23, id: PALETTE_WANT.backdrop.cliffWindow},
    {op: 'fill', x1: 102, y1: 46, z1: 21, x2: 104, y2: 46, z2: 23, id: PALETTE_WANT.backdrop.cliffRoof},
    {op: 'fill', x1: 103, y1: 47, z1: 22, x2: 103, y2: 47, z2: 22, id: PALETTE_WANT.backdrop.cliffRoof},
    {op: 'fill', x1: 102, y1: 47, z1: 22, x2: 104, y2: 47, z2: 22, id: PALETTE_WANT.backdrop.cliffLamp},
  ], '崖屋 v2 拆笔两栋(墙 52+角柱 17×4+窗 18 十字+顶 9 双层+灯 19, 每屋' +
    '10 笔; x56/x103 脊线肩段, style v2 条目; op 序=派生序)');
});

/* ---------- ⑥b op 派生 v2(scene 需求表 10 项): 合成 steps 契约 ---------- */

test('op 派生 v2: 合成 steps 各新 kind 派生几何与字段缺省(ground/backdrop/road/scatter)', () => {
  const ctx = loadCore();
  /* 纯函数直验: 合成 steps 直接喂 townAssemblyOps(零引擎零掷点),
     groundY=24(真地图 core); 条目顺序=steps 序, op 序=派生序。
     剥全域垫底三笔(域特征=core 全域, ⑥ 几何段已钉其形), 只验派生 */
  const run = (steps) => JSON.parse(probe(ctx,
      'JSON.stringify(townAssemblyOps(' + JSON.stringify(steps) + ').filter(' +
      '(o) => !(o.x1 === TOWN_MAP.core.x1 && o.x2 === TOWN_MAP.core.x2 && ' +
      'o.z1 === TOWN_MAP.core.z1 && o.z2 === TOWN_MAP.core.z2)))'));
  const eq = (a, w) => a.op === w.op && a.x1 === w.x1 && a.y1 === w.y1 &&
      a.z1 === w.z1 && a.x2 === w.x2 && a.y2 === w.y2 && a.z2 === w.z2 &&
      a.id === w.id;
  /* ground: farm-rows(#4) */
  const fr = run([{phase: 'ground', id: 't-farm', kind: 'farm-rows',
    x1: 10, z1: 20, x2: 13, z2: 22}]);
  const frF = fr.filter((o) => o.op === 'fill');
  assert.ok(frF.some((o) => eq(o, {op: 'fill', x1: 10, y1: 24, z1: 20,
    x2: 13, y2: 24, z2: 22, id: 41})), '田垄: 全域 41 沟底先铺');
  assert.ok(frF.some((o) => eq(o, {op: 'fill', x1: 10, y1: 24, z1: 20,
    x2: 13, y2: 24, z2: 20, id: 58})), '田垄: r=0 行=58 田埂');
  assert.ok(frF.some((o) => eq(o, {op: 'fill', x1: 10, y1: 24, z1: 21,
    x2: 13, y2: 24, z2: 21, id: 42})), '田垄: r=1 行=42 作物轮转');
  assert.ok(frF.some((o) => eq(o, {op: 'fill', x1: 10, y1: 24, z1: 22,
    x2: 13, y2: 24, z2: 22, id: 43})), '田垄: r=2 行=43 相位混排');
  assert.ok(frF.filter((o) => o.y1 === 25).length > 0 &&
      frF.filter((o) => o.y1 === 25).every((o) => o.id === 5),
  '田垄: y25 层全为 5 号围栏桩');
  /* ground: wayshrine(#6, 序=后写者赢) */
  const ws = run([{phase: 'ground', id: 't-ws', kind: 'wayshrine',
    x1: 0, z1: 0, x2: 4, z2: 4}]).filter((o) => o.op === 'fill');
  assert.ok(ws.length === 2 &&
      eq(ws[0], {op: 'fill', x1: 0, y1: 24, z1: 0, x2: 4, y2: 24, z2: 4, id: 4}) &&
      eq(ws[1], {op: 'fill', x1: 1, y1: 24, z1: 1, x2: 3, y2: 24, z2: 3, id: 13}),
  '断头小坪: 边环 4 先写+内缩芯 13 后写(序=后写者赢, 须排 road 后)');
  /* road: curb(#5) */
  const rc = run([{phase: 'road', id: 't-r1', kind: 'main',
    x1: 10, z1: 20, x2: 20, z2: 20, curb: true}]);
  assert.ok(rc.some((o) => eq(o, {op: 'fill', x1: 10, y1: 24, z1: 19,
    x2: 20, y2: 24, z2: 19, id: 13})) &&
      rc.some((o) => eq(o, {op: 'fill', x1: 10, y1: 24, z1: 21,
        x2: 20, y2: 24, z2: 21, id: 13})), '缘石: main 沿 x 两侧外扩=13');
  const lc = run([{phase: 'road', id: 't-r2', kind: 'lane',
    x1: 20, z1: 10, x2: 20, z2: 30, curb: true}]);
  assert.ok(lc.some((o) => eq(o, {op: 'fill', x1: 19, y1: 24, z1: 10,
    x2: 19, y2: 24, z2: 30, id: 4})), '缘石: lane 沿 z 外扩 x1-1=4');
  const nc = run([{phase: 'road', id: 't-r3', kind: 'main',
    x1: 10, z1: 20, x2: 20, z2: 20}]);
  assert.strictEqual(nc.filter((o) => o.op === 'fill').length, 1,
      'curb 缺省: 仅路体单笔(现行为逐字节不变)');
  /* backdrop: mountain bands(#7)+缺省+合脊 */
  const mb = run([{phase: 'backdrop', id: 't-m1', kind: 'mountain',
    x1: 10, z1: 26, x2: 12, z2: 28, topY: 44, bands: true}]);
  const col = (arr, x) => arr.filter((o) => o.op === 'fill' && o.x1 === x && o.x2 === x);
  assert.ok(col(mb, 11).some((o) => o.y1 === 24 && o.y2 === 30 &&
    o.z1 === 26 && o.z2 === 26 && o.id === 14), '分色: 苔 14 表层(z26 行)');
  assert.ok(col(mb, 11).some((o) => o.y1 === 24 && o.y2 === 30 &&
    o.z1 === 27 && o.z2 === 28 && o.id === 1), '分色: 南缘 z27..28 草坡 1 过渡');
  assert.ok(col(mb, 11).some((o) => o.y1 === 31 && o.y2 === 39 && o.id === 3),
      '分色: 中段石 3');
  assert.ok(col(mb, 11).some((o) => o.y1 === 40 && o.y2 === 44 && o.id === 54),
      '分色: 顶雪 54');
  assert.ok(col(mb, 10).every((o) => o.y2 <= 24),
      '分色: 缘列合脊顶 24(31/40 段空段跳笔)');
  const m0 = run([{phase: 'backdrop', id: 't-m2', kind: 'mountain',
    x1: 10, z1: 26, x2: 12, z2: 28, topY: 44}]);
  assert.strictEqual(m0.filter((o) => o.op === 'fill').length, 3,
      'mountain 缺省: 逐柱单笔(与旧 pin 同形)');
  assert.ok(m0.every((o) => o.id === 3), 'mountain 缺省: 全 3 单色');
  const mm = run([
    {phase: 'backdrop', id: 'mt-a', kind: 'mountain',
      x1: 10, z1: 26, x2: 12, z2: 28, topY: 30},
    {phase: 'backdrop', id: 'mt-b', kind: 'mountain',
      x1: 11, z1: 26, x2: 13, z2: 28, topY: 40},
  ]);
  /* B 拱心 x12(自身顶 40); A x12 自身公式仅 24——A 条目该列笔读到 40
     即合脊; B x11 缘列自身公式落地 24, 读到 A 脊 30 亦即合脊 */
  const x12 = mm.filter((o) => o.op === 'fill' && o.x1 === 12 && o.x2 === 12);
  assert.ok(x12.length === 2 && x12.every((o) => o.y2 === 40),
      '合脊: 重叠列取 max(A 条目 x12 笔自身仅 24, 读到 B 脊 40)');
  const bx11 = mm.filter((o) => o.op === 'fill' && o.x1 === 11 && o.x2 === 11);
  assert.ok(bx11.length === 2 && bx11.every((o) => o.y2 === 30),
      '合脊: B 条目 x11 缘笔取 A 脊 30(自身公式落地 24)');
  /* backdrop: cliff-home v2(#8)+legacy 缺省 */
  const cv = run([{phase: 'backdrop', id: 't-c1', kind: 'cliff-home',
    x: 55, z: 21, baseY: 41, topY: 47, style: 'v2'}]);
  assert.ok(cv.some((o) => eq(o, {op: 'fill', x1: 54, y1: 41, z1: 20,
    x2: 56, y2: 45, z2: 22, id: 52})), 'v2: 白墙 52 主体 baseY..topY-2');
  assert.strictEqual(cv.filter((o) => o.id === 17).length, 4,
      'v2: 石英角柱 17×4');
  assert.ok(cv.some((o) => eq(o, {op: 'fill', x1: 54, y1: 43, z1: 21,
    x2: 56, y2: 43, z2: 21, id: 18})), 'v2: 窗 18 十字(baseY+2)');
  assert.ok(cv.some((o) => eq(o, {op: 'fill', x1: 54, y1: 46, z1: 20,
    x2: 56, y2: 46, z2: 22, id: 9})) &&
      cv.some((o) => eq(o, {op: 'fill', x1: 55, y1: 47, z1: 21,
        x2: 55, y2: 47, z2: 21, id: 9})), 'v2: 橙顶 9 双层阶梯(顶盖+内缩芯)');
  assert.ok(cv.some((o) => eq(o, {op: 'fill', x1: 54, y1: 47, z1: 21,
    x2: 56, y2: 47, z2: 21, id: 19})), 'v2: 顶缘灯点 19(topY 层 x±1)');
  const cl = run([{phase: 'backdrop', id: 't-c2', kind: 'cliff-home',
    x: 55, z: 21, baseY: 41, topY: 47}]);
  assert.ok(cl.length === 1 && eq(cl[0], {op: 'fill', x1: 54, y1: 41, z1: 20,
    x2: 56, y2: 46, z2: 22, id: 6}), 'cliff-home 缺省 legacy: 3×3×6 盒 6(旧 pin 逐字节)');
  /* backdrop: scrub/boulder(#7) */
  const bs = run([{phase: 'backdrop', id: 't-s1', kind: 'scrub',
    x: 20, y: 24, z: 30}]);
  assert.deepStrictEqual(bs, [{op: 'scrub', x: 20, top: 24, z: 30,
    salt: 20 * 131 + 30}], '山脚矮丛: 确定性盐同款 op');
  const bd = run([{phase: 'backdrop', id: 't-b1', kind: 'boulder',
    x: 21, y: 24, z: 30}]);
  assert.ok(eq(bd[0], {op: 'fill', x1: 21, y1: 25, z1: 30, x2: 21, y2: 25,
    z2: 30, id: 14}), '山脚苔石: 单格 14 y+1');
  /* scatter 六新 kind(#1/#2/#3/#10) */
  const sc = run([
    {phase: 'scatter', id: 's1', kind: 'tuft', x: 70, y: 24, z: 90},
    {phase: 'scatter', id: 's2', kind: 'flower', x: 72, y: 24, z: 90},
    {phase: 'scatter', id: 's3', kind: 'flower', x: 74, y: 24, z: 90, v: {tone: 'w'}},
    {phase: 'scatter', id: 's4', kind: 'flag', x: 76, y: 24, z: 69},
    {phase: 'scatter', id: 's5', kind: 'flag', x: 78, y: 24, z: 69, v: {cloth: 'blue'}},
    {phase: 'scatter', id: 's6', kind: 'flag', x: 80, y: 24, z: 69, v: {cloth: 'quartz'}},
    {phase: 'scatter', id: 's7', kind: 'flag', x: 82, y: 24, z: 69, v: {cloth: 'red'}},
    {phase: 'scatter', id: 's8', kind: 'flowerbed', x: 84, y: 24, z: 90},
    {phase: 'scatter', id: 's9', kind: 'flowerbed', x: 88, y: 24, z: 90, v: {tone: 'w'}},
    {phase: 'scatter', id: 's10', kind: 'barrel', x: 90, y: 24, z: 90},
    {phase: 'scatter', id: 's11', kind: 'pumpkin', x: 92, y: 24, z: 90},
  ]);
  assert.ok(eq(sc[0], {op: 'fill', x1: 70, y1: 25, z1: 90, x2: 70, y2: 25,
    z2: 90, id: 40}), '草丛: 单格 40 y+1');
  assert.ok(eq(sc[1], {op: 'fill', x1: 72, y1: 25, z1: 90, x2: 72, y2: 25,
    z2: 90, id: 61}), '花: 缺省 tone y=61 蒲公英');
  assert.ok(eq(sc[2], {op: 'fill', x1: 74, y1: 25, z1: 90, x2: 74, y2: 25,
    z2: 90, id: 62}), '花: v.tone w=62 雏菊');
  assert.ok(eq(sc[3], {op: 'fill', x1: 76, y1: 25, z1: 69, x2: 76, y2: 26,
    z2: 69, id: 5}) && eq(sc[4], {op: 'fill', x1: 76, y1: 27, z1: 69,
    x2: 76, y2: 27, z2: 69, id: 78}), '旗: 柱 2 高 5+杆顶 y+3 面 78 缺省');
  assert.ok(eq(sc[5], {op: 'fill', x1: 78, y1: 25, z1: 69, x2: 78, y2: 26,
    z2: 69, id: 5}) && eq(sc[6], {op: 'fill', x1: 78, y1: 27, z1: 69,
    x2: 78, y2: 27, z2: 69, id: 15}), '旗: v.cloth blue=15(柱+面两笔)');
  assert.ok(eq(sc[8], {op: 'fill', x1: 80, y1: 27, z1: 69, x2: 80, y2: 27,
    z2: 69, id: 17}), '旗: quartz=17');
  assert.ok(eq(sc[10], {op: 'fill', x1: 82, y1: 27, z1: 69, x2: 82, y2: 27,
    z2: 69, id: 16}), '旗: red=16');
  assert.ok(eq(sc[11], {op: 'fill', x1: 83, y1: 25, z1: 89, x2: 85, y2: 25,
    z2: 91, id: 40}) && eq(sc[12], {op: 'fill', x1: 84, y1: 25, z1: 90,
    x2: 84, y2: 25, z2: 90, id: 61}), '花坛: 3×3 环 40+芯 61(tone y)');
  assert.ok(eq(sc[13], {op: 'fill', x1: 87, y1: 25, z1: 89, x2: 89, y2: 25,
    z2: 91, id: 40}) && eq(sc[14], {op: 'fill', x1: 88, y1: 25, z1: 90,
    x2: 88, y2: 25, z2: 90, id: 62}), '花坛: 芯 62(tone w)');
  assert.ok(eq(sc[15], {op: 'fill', x1: 90, y1: 25, z1: 90, x2: 90, y2: 25,
    z2: 90, id: 5}), '木桶: 单格 5 y+1');
  assert.ok(eq(sc[16], {op: 'fill', x1: 92, y1: 25, z1: 90, x2: 92, y2: 25,
    z2: 90, id: 76}), '南瓜: 单格 76 y+1');
  /* 合法域消息已扩(错误域抽查) */
  assert.throws(() => run([{phase: 'ground', id: 'x', kind: 'orchard'}]),
      /farm-rows\|wayshrine/, 'ground 合法域消息已扩');
  assert.throws(() => run([{phase: 'backdrop', id: 'y', kind: 'henge'}]),
      /scrub\|boulder/, 'backdrop 合法域消息已扩');
  assert.throws(() => run([{phase: 'scatter', id: 'z', kind: 'statue'}]),
      /tuft\|flower\|flag/, 'scatter 合法域消息已扩');
});

/* ---------- ⑥c TIDEA 波次一(arch 静态陈设批): 素墙立面三笔 scatter kind 契约 ---------- */

test('op 派生 Step F: wallflag len 钳 2..6 缺省 4 三色 i%3 轮转 · windowbox 8 格 · crates 4 格 · 合法域再扩', () => {
  const ctx = loadCore();
  /* 纯函数直验(⑥b 同款装具): 剥全域垫底三笔, 只验派生 */
  const run = (steps) => JSON.parse(probe(ctx,
      'JSON.stringify(townAssemblyOps(' + JSON.stringify(steps) + ').filter(' +
      '(o) => !(o.x1 === TOWN_MAP.core.x1 && o.x2 === TOWN_MAP.core.x2 && ' +
      'o.z1 === TOWN_MAP.core.z1 && o.z2 === TOWN_MAP.core.z2)))'));
  const eq = (a, w) => a.op === w.op && a.x1 === w.x1 && a.y1 === w.y1 &&
      a.z1 === w.z1 && a.x2 === w.x2 && a.y2 === w.y2 && a.z2 === w.z2 &&
      a.id === w.id;
  /* wallflag(TIDEA-03 ①): 缺省 len=4 三色轮转 78/15/17(78 樱粉/15 蓝/
      17 奶油, 与钟塔脚旗阵同语言; red 16 不入立面轮转) */
  const wf = run([{phase: 'scatter', id: 't-wf', kind: 'wallflag',
    x: 70, y: 24, z: 90}]).filter((o) => o.op === 'fill');
  assert.strictEqual(wf.length, 4, 'wallflag 缺省 4 笔');
  assert.ok(eq(wf[0], {op: 'fill', x1: 70, y1: 25, z1: 90, x2: 70, y2: 25,
    z2: 90, id: 78}) && eq(wf[1], {op: 'fill', x1: 70, y1: 26, z1: 90,
    x2: 70, y2: 26, z2: 90, id: 15}), 'wallflag 缺省: y+1 起 78/15');
  assert.ok(eq(wf[2], {op: 'fill', x1: 70, y1: 27, z1: 90, x2: 70, y2: 27,
    z2: 90, id: 17}) && eq(wf[3], {op: 'fill', x1: 70, y1: 28, z1: 90,
    x2: 70, y2: 28, z2: 90, id: 78}), 'wallflag 缺省: 17/78(i%3 轮转回 78)');
  /* len 值域→钳第二档: 2 下沿/6 上沿/0 收下沿/99 收上沿/小数取整/非有限回落 */
  const wfLen = (len) => run([{phase: 'scatter', id: 't-wf', kind: 'wallflag',
    x: 70, y: 24, z: 90, v: {len}}]).filter((o) => o.op === 'fill');
  assert.strictEqual(wfLen(2).length, 2, 'len 2 下沿');
  assert.ok(eq(wfLen(2)[0], {op: 'fill', x1: 70, y1: 25, z1: 90, x2: 70,
    y2: 25, z2: 90, id: 78}) && eq(wfLen(2)[1], {op: 'fill', x1: 70,
    y1: 26, z1: 90, x2: 70, y2: 26, z2: 90, id: 15}), 'len 2: 78/15');
  assert.strictEqual(wfLen(99).length, 6, 'len 99→6 上沿');
  assert.ok(eq(wfLen(99)[5], {op: 'fill', x1: 70, y1: 30, z1: 90, x2: 70,
    y2: 30, z2: 90, id: 17}), 'len 6: 第 6 笔 17(i%3 轮转 78/15/17/78/15/17)');
  assert.strictEqual(wfLen(0).length, 2, 'len 0→2 收下沿');
  assert.strictEqual(wfLen(3.9).length, 3, 'len 3.9→3 小数取整');
  assert.strictEqual(wfLen('x').length, 4, '非有限数回落缺省 4');
  /* windowbox(TIDEA-03 ②): 箱 plank 2 宽+花 61/62+窗玻璃板 2×2, 全 8 格
      ——花走 flowerCore 组单源(与墙根花坛同语言) */
  const wb = run([{phase: 'scatter', id: 't-wb', kind: 'windowbox',
    x: 80, y: 24, z: 90}]).filter((o) => o.op === 'fill');
  assert.strictEqual(wb.length, 4, 'windowbox 4 笔 fill(8 格)');
  assert.ok(eq(wb[0], {op: 'fill', x1: 80, y1: 25, z1: 90, x2: 81, y2: 25,
    z2: 90, id: 5}), '窗台箱: plank 5 2 宽 y+1');
  assert.ok(eq(wb[1], {op: 'fill', x1: 80, y1: 26, z1: 90, x2: 80, y2: 26,
    z2: 90, id: 61}) && eq(wb[2], {op: 'fill', x1: 81, y1: 26, z1: 90,
    x2: 81, y2: 26, z2: 90, id: 62}), '花两格: 61@(x,y+2)+62@(x+1,y+2)');
  assert.ok(eq(wb[3], {op: 'fill', x1: 80, y1: 27, z1: 90, x2: 81, y2: 28,
    z2: 90, id: 68}), '窗: glassPane 68 2 宽×2 高 y+3..y+4');
  /* crates(TIDEA-03 ③): 桶 5 双高+箱 51 双高各 1 列, 全 4 格 */
  const cr = run([{phase: 'scatter', id: 't-cr', kind: 'crates',
    x: 90, y: 24, z: 90}]).filter((o) => o.op === 'fill');
  assert.strictEqual(cr.length, 2, 'crates 2 笔 fill(4 格)');
  assert.ok(eq(cr[0], {op: 'fill', x1: 90, y1: 25, z1: 90, x2: 90, y2: 26,
    z2: 90, id: 5}) && eq(cr[1], {op: 'fill', x1: 91, y1: 25, z1: 90,
    x2: 91, y2: 26, z2: 90, id: 51}), '桶箱角: 桶 5@(x,y+1..2)+箱 51@(x+1,y+1..2)');
  /* 合法域消息再扩(三新 kind 入列) */
  assert.throws(() => run([{phase: 'scatter', id: 'z2', kind: 'statue'}]),
      /wallflag\|windowbox\|crates/, 'scatter 合法域消息含三新 kind');
});

/* ---------- ⑥d TIDEA 波次二(arch 机制与派生批): spinner op + porchLamp +
   groundMark 契约(合成条目直验, ⑥b/⑥c 同款装具) ---------- */

test('op 派生 ⑥d: spinner op(place 双胞胎, sailStatic===false 严格判据, period 钩穿透) · porchLamp 注入 · groundMark 四笔', () => {
  const ctx = loadCore();
  /* 纯函数直验(⑥c 同款装具): 剥全域垫底三笔, 只验派生 */
  const run = (steps) => JSON.parse(probe(ctx,
      'JSON.stringify(townAssemblyOps(' + JSON.stringify(steps) + ').filter(' +
      '(o) => !(o.x1 === TOWN_MAP.core.x1 && o.x2 === TOWN_MAP.core.x2 && ' +
      'o.z1 === TOWN_MAP.core.z1 && o.z2 === TOWN_MAP.core.z2)))'));
  /* spinner op: 严格 false 判据——undefined/true 静态无 op(scene 现状 v={}
     零行为变化, 翻转权在 scene 线) */
  const spinOps = run([{phase: 'prefab', id: 'windmill-tower', x: 56, y: 24, z: 42,
    v: {sailStatic: false}, face: 'south'}]);
  assert.strictEqual(spinOps.length, 1, 'spinner op 恰 1(替代 place)');
  assert.strictEqual(spinOps[0].op, 'spinner', 'op=spinner(place 双胞胎)');
  assert.strictEqual(spinOps[0].id, 'windmill-tower', 'id 直带');
  assert.strictEqual(spinOps[0].x, 56, 'x 直带');
  assert.strictEqual(spinOps[0].y, 24, 'y 直带');
  assert.strictEqual(spinOps[0].z, 42, 'z 直带');
  assert.strictEqual(spinOps[0].v.sailStatic, false,
      'v 原样带(塔体省叶片的 place 语义归 dims spinner case)');
  assert.strictEqual(spinOps[0].period, undefined,
      'period 缺省 undefined(SpinnerCore.clampPeriod 回落 5)');
  /* period 顶层钩穿透(可选数据钩; 条目顶层键全链静默先例, pfMerge 白名单外) */
  const spinP = run([{phase: 'prefab', id: 'windmill-tower', x: 56, y: 24, z: 42,
    v: {sailStatic: false}, face: 'south', period: 4.5}])[0];
  assert.strictEqual(spinP.period, 4.5, '顶层 period 穿透 op(秒)');
  /* true/缺省 → place(既有行为不变) */
  assert.strictEqual(run([{phase: 'prefab', id: 'windmill-tower', x: 56, y: 24,
    z: 42, v: {sailStatic: true}, face: 'south'}])[0].op, 'place',
  'sailStatic=true → place');
  assert.strictEqual(run([{phase: 'prefab', id: 'windmill-tower', x: 56, y: 24,
    z: 42, v: {}, face: 'south'}])[0].op, 'place', '缺省(v={}) → place');
  /* porchLamp: tidea.porchLamp → place v.porchLamp=true(pfMerge 白名单合法化,
     v 键检在 prefab 面已钉) */
  const stOps = run([{phase: 'prefab', id: 'stash-hut', x: 49, y: 24, z: 98,
    v: {}, face: 'east',
    tidea: {porchLamp: {dx: 2, dy: 2, dz: 0},
      groundMark: {id: 4, tiles: [{dx: 6, dz: 5}, {dx: 7, dz: 4},
        {dx: 7, dz: 6}, {dx: 9, dz: 5}]}}}]);
  const stPlace = stOps.find((o) => o.op === 'place');
  assert.strictEqual(stPlace.v.porchLamp, true, 'tidea.porchLamp → v.porchLamp=true');
  assert.deepStrictEqual(stOps.filter((o) => o.op === 'fill'), [
    {op: 'fill', x1: 55, y1: 24, z1: 103, x2: 55, y2: 24, z2: 103, id: 4},
    {op: 'fill', x1: 56, y1: 24, z1: 102, x2: 56, y2: 24, z2: 102, id: 4},
    {op: 'fill', x1: 56, y1: 24, z1: 104, x2: 56, y2: 24, z2: 104, id: 4},
    {op: 'fill', x1: 58, y1: 24, z1: 103, x2: 58, y2: 24, z2: 103, id: 4},
  ], 'groundMark 四笔: 锚+dx/dz 世界系直加(y=groundY, 顶/双翼/尾 chevron)');
  /* 无 tidea → 恰 place 一笔, v.porchLamp 不注, tidea 零渗 v(§8.2.2 教训) */
  const plain = run([{phase: 'prefab', id: 'stash-hut', x: 49, y: 24, z: 98,
    v: {}, face: 'east'}]);
  assert.strictEqual(plain.length, 1, '无 tidea: 恰 place 一笔');
  assert.strictEqual(plain[0].v.porchLamp, undefined, 'v.porchLamp 不注');
  assert.ok(!('tidea' in plain[0].v), 'tidea 命名空间键不入 v(白名单外零渗)');
});

test('op 派生 ⑥d: 真实 TIDEA 五件派生显影(瀑布三笔/emblem 16/bloom 32/harvest 3 埂存活/记号 4+灯)', () => {
  const ctx = loadCore();
  const ops = opsJson(ctx);
  const findLast = (x, y, z) => ops.findLast((o) => o.op === 'fill' &&
    x >= o.x1 && x <= o.x2 && z >= o.z1 && z <= o.z2 && y >= o.y1 && y <= o.y2);
  /* 瀑布(TIDEA-05): 柱 1 笔(x63..64, y25..39, z24..28, 54)+两翼 2 笔
     (62/65, y25..26, z26, 17)——派生契约 scene-closeout §8.2.5 逐字 */
  assert.ok(ops.some((o) => o.op === 'fill' && o.x1 === 63 && o.x2 === 64 &&
    o.y1 === 25 && o.y2 === 39 && o.z1 === 24 && o.z2 === 28 && o.id === 54),
  '瀑布柱一笔(雪块 54 南缘薄片, 顶接雪带下缘)');
  assert.ok(ops.some((o) => o.op === 'fill' && o.x1 === 62 && o.x2 === 62 &&
    o.y1 === 25 && o.y2 === 26 && o.z1 === 26 && o.z2 === 26 && o.id === 17) &&
    ops.some((o) => o.op === 'fill' && o.x1 === 65 && o.x2 === 65 &&
    o.y1 === 25 && o.y2 === 26 && o.z1 === 26 && o.z2 === 26 && o.id === 17),
  '两翼水花 2 笔(石英 17)');
  /* emblem(TIDEA-07): 16 笔逐格, 回字环纹(四角 4+芯 2×2=樱粉 78 共 8 格/
     边中 8 格石英 17——图样死字面 [[78,17,17,78],[17,78,78,17],...]) */
  const em = ops.filter((o) => o.op === 'fill' && o.y1 === 24 && o.y2 === 24 &&
    o.x1 >= 77 && o.x2 <= 80 && o.z1 >= 109 && o.z2 <= 112);
  assert.strictEqual(em.length, 16, 'emblem 16 笔(4×4 逐格)');
  const emAt = (x, z) => ops.find((o) => o.op === 'fill' && o.y1 === 24 &&
    o.x1 === x && o.x2 === x && o.z1 === z && o.z2 === z);
  assert.strictEqual(emAt(77, 109).id, 78, '徽西北角 78');
  assert.strictEqual(emAt(80, 112).id, 78, '徽东南角 78(南缘含 spawn 行)');
  assert.strictEqual(emAt(78, 110).id, 78, '徽芯 2×2 樱粉 78 @(78,110)(图样勘误: 芯非石英)');
  assert.strictEqual(emAt(79, 111).id, 78, '徽芯 2×2 樱粉 78 @(79,111)');
  assert.strictEqual(emAt(78, 109).id, 17, '边中石英 17 @(78,109)(北边上中)');
  assert.strictEqual(emAt(77, 110).id, 17, '边中石英 17 @(77,110)(西边中)');
  assert.strictEqual(emAt(78, 112).id, 17, '边中石英 17 @(78,112)(南边上中)');
  /* axisBloom(TIDEA-07): 32 笔(z76..107 两列逐行, r=(z−76)%4<2→13 石砖
     else 4 圆石; 北端 z76 贴塔足) */
  const bloom = ops.filter((o) => o.op === 'fill' && o.y1 === 24 && o.y2 === 24 &&
    o.x1 === 79 && o.x2 === 80 && o.z1 >= 76 && o.z2 <= 107);
  assert.strictEqual(bloom.length, 32, 'bloom 32 笔(z76..107 逐行)');
  assert.strictEqual(findLast(79, 24, 76).id, 13, 'r0 → 石砖 13(北端贴塔足; 与主路 pin 同色巧合已验)');
  assert.strictEqual(findLast(80, 24, 78).id, 4, 'r2 → 圆石 4(广场域内末笔)');
  /* z107 r3=4: inlay 补记后于全 steps, 南主路路面上的花带笔即末笔(嵌路面) */
  assert.strictEqual(findLast(79, 24, 107).id, 4, 'z107 r3 → 圆石 4(inlay 补记, 路面嵌花)');
  /* harvest(TIDEA-04 前半): 域内非埂行(r=(z−44)%5!==0)三行覆 45, 埂行
     z44 跳过(fieldRidge 存活); 与 farm-rows 行相位同源 */
  assert.strictEqual(findLast(66, 24, 45).id, 45, 'harvest 行 z45 → 小麦 45');
  assert.strictEqual(findLast(69, 24, 47).id, 45, 'harvest 行 z47 → 小麦 45');
  assert.strictEqual(findLast(66, 24, 44).id, 58, '埂行 z44 跳过(田埂 58 存活)');
  assert.strictEqual(findLast(70, 24, 45).id, 42, 'harvest 域外(70)不作 45(青苗相位不变)');
  /* stash 灯+记号真实显影(TIDEA-09): 真条目 tidea 契约 → v 注入+四笔 */
  const stashOp = ops.find((o) => o.op === 'place' && o.id === 'stash-hut');
  assert.strictEqual(stashOp.v.porchLamp, true, '真实 stash 条目 v.porchLamp=true');
  assert.strictEqual(findLast(55, 24, 103).id, 4, '记号顶 (55,103)');
  assert.strictEqual(findLast(58, 24, 103).id, 4, '记号尾 (58,103)');
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
  /* 空隙带 z29..31 见证翻转(PO 亲需①裙板落位): 裙板域 x16..143 山体
     基段石/苔拱笔合法在场(分段色归 dims 世界层实测 pin), 域外两缘
     x0..15/x144..159 仍体块零写入(虚空护城河); tree/recolor/scrub
     top>27 与域外 fill 仍全域拦——远景不可达翻转为「两缘无立地面+
     裙板可步行连接」 */
  const giant = boxOps.filter((o) =>
    (o.op !== 'fill' && o.op !== 'scrub') ||
    (o.op === 'fill' && (o.y1 !== o.y2 || o.y2 > 27)) ||
    (o.op === 'scrub' && o.top > 27));
  /* 墙圈翼墙/端头墩豁免(T2, spec §3.3): 防坠功能件立裙板顶上——石砖
     13、域 x16..143(裙板带)、y25..27(裙板顶 24 上 2 格, 见 town-map-core
     ⑧b 裁定注); 除此之外域外两缘+其余体块仍零写入 */
  const isRimWingPier = (o) => o.id === 13 && o.x1 >= 16 && o.x2 <= 143 &&
      o.y1 >= 25 && o.y2 <= 27;
  assert.ok(giant.every((o) => !overlaps(o, 0, 159, 0, 47, 29, 31) ||
      ([PALETTE_WANT.backdrop.mountain, PALETTE_WANT.backdrop.mountainMoss]
          .includes(o.id) && o.x1 >= 16 && o.x2 <= 143) ||
      isRimWingPier(o)),
  '空隙带 z29..31: 裙板域 x16..143 山体笔合法(PO 亲需①)+墙圈翼墙/端头墩合法(T2 防坠件), 域外两缘+其余体块仍零写入');
});

/* ---------- ⑧ 确定性 ---------- */

test('确定性: 同参同输出 — townAssemblyOps(townBuildSteps()) 两次调用全等', () => {
  const ctx = loadCore();
  const a = probe(ctx, 'JSON.stringify(townAssemblyOps(townBuildSteps()))');
  const b = probe(ctx, 'JSON.stringify(townAssemblyOps(townBuildSteps()))');
  assert.strictEqual(a, b, '规划器纯函数: 同参同输出(确定性重放红线)');
});

/* ---------- ⑨ 微改守门 ---------- */

test('微改守门: town-map-core 头注释与 GLOSSARY 词条「九段→十段」措辞校正(数据零改动)', () => {
  const coreSrc = fs.readFileSync(path.join(ROOT, 'js', 'town-map-core.js'), 'utf8');
  assert.ok(!/八段/.test(coreSrc) && !/九段/.test(coreSrc) && /十段/.test(coreSrc),
      'town-map-core interface 行「九段」→「十段」(TOWN_MAP 实有十键: core/plaza/beyond + 七清单; T0 beyond 判据票进位)');
  const gloss = fs.readFileSync(path.join(ROOT, 'GLOSSARY.md'), 'utf8');
  /* 定位锚用正文词条头形态(带换行+**: 后缀): 词条一览索引行也含同名条目
     (A2 双向对齐后), 裸名 indexOf 会先命中索引行致切片失效——精确锚非放宽 */
  const at = gloss.indexOf('\n**城镇地图核心（TownMapCore）**:');
  assert.ok(at > 0, 'GLOSSARY TownMapCore 词条在场(装具自检)');
  const entry = gloss.slice(at, gloss.indexOf('\n### ', at));
  assert.ok(!/八段/.test(entry) && !/九段/.test(entry) && /十段/.test(entry), '词条段数措辞同校「十段」');
  assert.ok(/_Avoid_:.*城镇地图（散称）/.test(entry),
      '词条补 _Avoid_: 城镇地图（散称）(模块名唯一, 散称禁用)');
});

/* ---------- ⑩ 南缘攀登走廊与裙板合脊(PO 亲需②+scene 6413b00 协同) ---------- */

/* 合成条目独立喂 townAssemblyOps(单条目 steps 纯函数可独立派生);
   M_STAIR=真布局 mountain 条目逐字转录(权威源); SKIRT=scene 数据提案
   转录(6413b00 回执 §十三, 她不预写 map-core, 等本契约随协同波次落);
   CORR=lead 裁定中带台阶列(水花列 x62 景缘域外)。 */
const M_STAIR = {id: 'm-stair', phase: 'backdrop', kind: 'mountain',
  x1: 16, z1: 8, x2: 143, z2: 28, topY: 44, bands: true};
const SKIRT = {id: 'm-skirt', phase: 'backdrop', kind: 'mountain',
  x1: 16, z1: 29, x2: 143, z2: 31, topY: 25, bands: true, reachable: true};
const CORR = {x1: 60, x2: 61};

test('southCorridor 激活见证: 真布局走廊列 z 向拆线笔 122(两列各 61)· 南端贴地 · 北端接山肩(原「缺省零变化」见证随 map-core 落键翻转)', () => {
  const ctx = loadCore();
  const ops = opsJson(ctx);
  const split = ops.filter((o) => o.op === 'fill' && o.x1 === o.x2 &&
    (o.x1 === 60 || o.x1 === 61) && o.z1 === o.z2 && o.z1 >= 8 && o.z2 <= 28);
  assert.strictEqual(split.length, 122,
      '走廊列拆线笔 122(两列各 61: z8..28 每 z 基段石+苔/石/雪分段, corridor-ops-probe 实测)');
  for (const col of [60, 61]) {
    assert.strictEqual(split.filter((o) => o.x1 === col).length, 61,
        'x' + col + ' 拆线笔 61(z28→z8 阶梯全列)');
  }
  /* 包络端点对齐真布局(公式逐点归包络 test, 此钉端点两笔) */
  assert.ok(split.some((o) => o.x1 === 60 && o.z1 === 28 && o.y1 === 24 &&
      o.y2 === 24 && o.id === PALETTE_WANT.backdrop.mountainMoss),
  '南端 z28 苔顶笔 y24(平接镇草, 攀登入口)');
  assert.ok(split.some((o) => o.x1 === 60 && o.z1 === 10 && o.y1 === 40 &&
      o.y2 === 42 && o.id === PALETTE_WANT.backdrop.mountainSnow),
  '北端 z10 雪顶笔 y40..42(接山肩平台)');
});

test('southCorridor 包络: 镜像公式逐点全扫(两台阶列) · 步高 ≤1 全扫 · 南端贴地 · 北端接山肩 · 走廊域外(两侧壁+水花列+瀑布)与缺省版逐笔全等', () => {
  const ctx = loadCore();
  const mk = (expr) => JSON.parse(probe(ctx,
      'JSON.stringify(townAssemblyOps([' + JSON.stringify(expr) + ']))'));
  const ops = mk(Object.assign({}, M_STAIR, {southCorridor: CORR}));
  const opsPlain = mk(M_STAIR);
  const hAt = (x, z) => Math.max(...ops.filter((o) => o.op === 'fill' &&
    o.x1 === x && o.x2 === x && o.z1 === z && o.z2 === z).map((o) => o.y2));
  const colTop = (x, z) => Math.max(...opsPlain.filter((o) => o.op === 'fill' &&
    o.x1 === x && o.x2 === x && o.z1 <= z && o.z2 >= z).map((o) => o.y2));
  /* 镜像公式逐点全扫: h(z)=min(合脊顶(z), h(z+1)+1) 自南缘 groundY=24 起步 */
  for (const x of [CORR.x1, CORR.x2]) {
    let prev = 23;
    for (let z = M_STAIR.z2; z >= M_STAIR.z1; z--) {
      const h = Math.min(colTop(x, z), prev + 1);
      assert.strictEqual(hAt(x, z), h, '走廊列 x' + x + ' 包络 h(z=' + z + ') 逐点');
      prev = h;
    }
  }
  /* 步高 ≤1 全扫(可攀判据, 构造性保证的独立验证) */
  for (const x of [CORR.x1, CORR.x2]) {
    for (let z = M_STAIR.z2; z > M_STAIR.z1; z--) {
      assert.ok(hAt(x, z - 1) - hAt(x, z) <= 1,
          '走廊 x' + x + ' 步高 z' + z + '→' + (z - 1) + ' ≤1(可攀)');
    }
  }
  assert.strictEqual(hAt(CORR.x1, 28), 24, '南端 z28 h=24 贴地(与镇草/裙板平接)');
  assert.strictEqual(hAt(CORR.x1, 10), 42, '北端 z10 h=42 接山肩平台(scene 探勘中带列顶恒 42)');
  assert.strictEqual(hAt(CORR.x1, 8), hAt(CORR.x1, 10), '北端收敛后维持列顶(z8..10 平台段)');
  /* 走廊域外全笔与缺省版逐笔全等: 两侧壁整柱拱形=崖壁凹槽天然防护
     (引擎无摔伤, 女儿墙不设——取舍登记回执 §十二)+水花列 x62 景缘
     原样+瀑布三笔照旧(瀑布域零写入, TIDEA-05) */
  const outS = ops.filter((o) => o.x2 < CORR.x1 || o.x1 > CORR.x2);
  const outP = opsPlain.filter((o) => o.x2 < CORR.x1 || o.x1 > CORR.x2);
  assert.deepStrictEqual(outS, outP, '走廊域外全笔与缺省版逐笔全等');
});

test('裙板合脊独立(scene 6413b00): z 域不重叠条目各归各 — skirt 拱顶 24..25 不被主山拱高顶穿 · 主山柱笔与单条目版逐笔全等(合脊键 (x,z) 单条目逐字节不变)', () => {
  const ctx = loadCore();
  const mk = (steps) => JSON.parse(probe(ctx,
      'JSON.stringify(townAssemblyOps(' + JSON.stringify(steps) + '))'));
  const plain = mk([M_STAIR]);
  const both = mk([M_STAIR, SKIRT]);
  const skOnly = mk([SKIRT]);
  /* skirt 段: 双条目 vs 单条目逐笔全等(各归各, 独立派生) */
  const skBoth = both.filter((o) => o.z1 >= 29);
  assert.deepStrictEqual(skBoth, skOnly, 'skirt 段双条目与单条目逐笔全等');
  /* skirt 拱顶: 中部 25/两缘 24(旧 x 单键 max 会把全带顶成主山拱高墙) */
  const skTop = (x) => Math.max(...skOnly.filter((o) => o.op === 'fill' &&
    o.x1 === x && o.z1 === 29).map((o) => o.y2));
  assert.strictEqual(skTop(80), 25, 'skirt 中部列顶 25(scene 提案 topY25)');
  assert.strictEqual(skTop(16), 24, 'skirt 西缘列顶 24(两缘落地=地表基高)');
  assert.strictEqual(skTop(143), 24, 'skirt 东缘列顶 24');
  /* 主山段: 排除瀑布笔(waterfall 字段主山独有, skirt 提案不设)后逐笔全等 */
  const notWf = (o) => !(o.y1 === 25 && o.z1 === 24 && o.z2 === 28) &&
    !(o.y1 === 25 && o.y2 === 26 && o.z1 === 26 && o.z2 === 26);
  const mBoth = both.filter((o) => o.z2 <= 28 && notWf(o));
  const mPlain = plain.filter((o) => o.z2 <= 28 && notWf(o));
  assert.deepStrictEqual(mBoth, mPlain,
      '主山柱笔与单条目版逐笔全等(合脊键 (x,z) 单条目逐字节不变)');
});

test('southCorridor 门控: 非 bands 拼写域抛错(不静默埋假阶梯)', () => {
  const ctx = loadCore();
  const bad = JSON.parse(JSON.stringify(M_STAIR));
  delete bad.bands;
  bad.southCorridor = CORR;
  assert.throws(() => probe(ctx,
      'townAssemblyOps([' + JSON.stringify(bad) + '])'),
  /southCorridor 需 bands/, '拼写域错误消息点名字段(id 随报)');
});

/* ---------- ⑪ T2 墙圈派生(spec §3.3 · 方案 §1.2 ground kind town-rim) ---------- */

/* 段笔键(spec §3.3 segs 域的独立字面量转录): x1,z1..x2,z2#y1-y2 */
const RIM_FILL_WANT = [
  '32,128..75,128#24-24', '81,128..127,128#24-24',
  '31,32..31,128#24-24', '128,32..128,128#24-24',
  '32,128..75,128#25-26', '81,128..127,128#25-26',
  '31,32..31,128#25-26', '128,32..128,128#25-26',
  '31,32..31,33#25-27', '128,32..128,33#25-27',
  '16,31..30,31#25-26', '129,31..143,31#25-26',
  '16,29..16,31#25-26', '143,29..143,31#25-26',
].sort();
/* 墙头花独立字面量(spec §3.3 逐位转录: ⌊(x+z)/8⌋ 偶 61 奇 62 的手算
   结果, 非实现公式复算——反同义反复; 相邻簇必异色, 开口段 x80 跳空
   =清单不含 80,128) */
const RIM_FLOWER_WANT = [
  '31,120:61', '31,112:62', '31,104:61', '31,96:62', '31,88:61',
  '31,80:62', '31,72:61', '31,64:62', '31,56:61', '31,48:62', '31,40:61',
  '128,120:62', '128,112:61', '128,104:62', '128,96:61', '128,88:62',
  '128,80:61', '128,72:62', '128,64:61', '128,56:62', '128,48:61', '128,40:62',
  '40,128:62', '48,128:61', '56,128:62', '64,128:61', '72,128:62',
  '88,128:62', '96,128:61', '104,128:62', '112,128:61', '120,128:62',
].sort();

test('town-rim 派生: 按段出 fill 恰 48 笔(14 段 13+2 帽 17+32 花 61/62) · 花奇偶交替开口跳空 · 零盐 · 合法域扩 town-rim', () => {
  const ctx = loadCore();
  /* 墙圈域 fill 抽取(谓词在 vm 内现算): 南缘行 z128 ∪ 东西缘列 x31/
     x128(z32..) ∪ 翼墙墩带 z29..31(立裙板顶上 y≥25)——域谓词不预设
     y 终值, 逐笔几何由下方 pin 收紧 */
  const rimFills = JSON.parse(probe(ctx,
      'JSON.stringify(townAssemblyOps(townBuildSteps()).filter(' +
      '(o) => o.op === "fill" && ((o.z1 <= 128 && o.z2 >= 128) || ' +
      '(o.x1 <= 31 && o.x2 >= 31 && o.z2 >= 32) || ' +
      '(o.x1 <= 128 && o.x2 >= 128 && o.z2 >= 32) || ' +
      '(o.z1 <= 31 && o.z2 >= 29 && o.y1 >= 25 && o.y2 >= 26))))'));
  /* 恰 48 笔: 14 段几何笔(13)+柱帽 2 笔(17)+墙头花 32 簇(61/62)——
     域内零额外笔(多一笔=越域写入, 少一笔=漏段) */
  assert.strictEqual(rimFills.length, 48,
      '墙圈域 fill 恰 48 笔(14 段+2 帽+32 花), 实得 ' + rimFills.length);
  const byId = (id) => rimFills.filter((o) => o.id === id);
  assert.strictEqual(byId(13).length, 14,
      '石砖 13 段笔 14(垫层4+墙身4+接头柱2+翼墙2+端头墩2)');
  assert.strictEqual(byId(17).length, 2, '石英 17 柱帽笔 2');
  assert.strictEqual(byId(61).length + byId(62).length, 32, '墙头花 32 簇');
  assert.strictEqual(
      rimFills.filter((o) => ![13, 17, 61, 62].includes(o.id)).length, 0,
      '墙圈域 fill 材质 ∈ 13/17/61/62(无杂材)');
  /* 段笔逐段 pin(帽=单格笔; 花=逐簇单格笔, 奇偶交替无同色相邻可并) */
  const capKeys = byId(17).map((o) => o.x1 + ',' + o.z1 + '#' + o.y1).sort();
  assert.deepStrictEqual(capKeys, ['128,128#27', '31,128#27'],
      '柱帽恰 (31,128)/(128,128) y27');
  const segKeys = byId(13)
      .map((o) => o.x1 + ',' + o.z1 + '..' + o.x2 + ',' + o.z2 +
          '#' + o.y1 + '-' + o.y2).sort();
  assert.deepStrictEqual(segKeys, RIM_FILL_WANT, '段笔逐段=spec §3.3 segs 域');
  /* 墙头花逐位 pin(y27 单格; 奇偶字面量=spec 转录) */
  const flowerKeys = byId(61).concat(byId(62))
      .filter((o) => o.x1 === o.x2 && o.z1 === o.z2 && o.y1 === 27 && o.y2 === 27)
      .map((o) => o.x1 + ',' + o.z1 + ':' + o.id).sort();
  assert.deepStrictEqual(flowerKeys, RIM_FLOWER_WANT,
      '墙头花 32 簇逐位+花色=spec §3.3(⌊(x+z)/8⌋ 偶61奇62)');
  assert.ok(rimFills.every((o) => !('salt' in o)), '墙圈笔零盐(确定性纯算术)');
  /* 合法域枚举扩 town-rim(拼写域 throw 改一处): 未知 kind 仍抛且点名 */
  assert.throws(() => probe(ctx,
      'townAssemblyOps([{phase: "ground", id: "x", kind: "orchard"}])'),
  /plaza\|farm\|farm-rows\|wayshrine\|town-rim/,
  'ground 合法域枚举已扩 town-rim(拼写域守卫存活)');
  /* 合成 town-rim 步骤消费不抛, 按 part 逐段出 fill(真布局外最小样本)。
     基底三层是无条件序列最前三笔(⑥ 已 pin slice(0,3)), 宿主侧 slice(3)
     剥离后恰 2 笔 rim 派生——多一笔=越域/杂派生也抓, 少一笔=漏段 */
  const syn = JSON.parse(probe(ctx,
      'JSON.stringify(townAssemblyOps([{phase: "ground", id: "t-syn", ' +
      'kind: "town-rim", segs: [{part: "pad", x1: 31, z1: 32, x2: 31, z2: 33, ' +
      'y1: 24, y2: 24}, {part: "wall", x1: 31, z1: 32, x2: 31, z2: 33, ' +
      'y1: 25, y2: 26}]}]).filter((o) => o.op === "fill"))')).slice(3);
  assert.strictEqual(syn.length, 2,
      '合成 town-rim 步骤派生恰 2 笔(剥离无条件基底三层后, 合法域扩生效)');
  assert.deepStrictEqual(
      syn.map((o) => [o.id, o.x1, o.z1, o.x2, o.z2, o.y1, o.y2]),
      [[13, 31, 32, 31, 33, 24, 24], [13, 31, 32, 31, 33, 25, 26]],
      '合成派生按 part 逐段出 fill(pad→wall 各一笔)');
});
