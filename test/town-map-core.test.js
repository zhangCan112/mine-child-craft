'use strict';
/* 城镇布局纯核心单测(镜像 js/town-map-core.js) — node --test(零依赖)
   运行: node --test test/town-map-core.test.js
   T-MAP-01 红测(可执行规格, 票: docs/town-architecture-design.md §11 行 T-MAP-01):
   vm 装载链 config→voxel→scene-kit→prefab-kit→town-map-core(prefab-kit.test.js
   同款手法, 词法 const 桥 globalThis)。规格锚 = docs/town-map-design.md §3-§4(布局
   权威)+ docs/design/town-prefab-specs.md §3(件库映射)+ §4.9(cache-cellar 覆写)。
   断言组: ①门面/结构 ②规模口径(~96×96 核心/28×28 广场/主路 4-5 支路 2-3) ③六分区
   方位语义 ④Prefab 实例清单映射(P0/P1 全入=七新行+under-room 复用+摊位 6; board-pool
   PO 推迟不列) ⑤脚印合法(footOf 校验·⊆核心区·体量域·分区归属) ⑥实例两两无交
   ⑦路网(厚度域·贴广场连通·不压建筑·门前可达) ⑧地表分类(广场铺装/农田成组)
   ⑨远景(山体必做/崖屋 1-2 脊线可见/神庙默认不落/不可达) ⑩散布(四类/广场樱花≥3/灯柱≥10/门廊对位/断头信标/
   不落建筑与路面) ⑪锚点(spawn 北望·回望钟塔视线通廊) ⑫townBuildSteps 确定性
   (phase 全序=架构 §5.1.6 建场序·两调 deepEqual) ⑬源文本守门(纯核心红线)。
   布局数值不逐坐标钉死(实现自由度), 但全部约束(尺寸/方位/间距/映射)在此钉死。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadCore() {/* vm 装载链: 引擎件按 index.html 序 + 本票新件(尾部);
    PrefabKit 仅供测试侧 footOf 校验(town-map-core 本体零运行时依赖) */
  const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
  }
  return vm.runInContext(
      '({TOWN_MAP, townBuildSteps, PrefabKit, WORLD_W, WORLD_D, WORLD_H})', eng);
}

/* ---- 几何小工具: xz 闭区间矩形(闭盒)的交/隙 ---- */
const overlapXZ = (a, b) => a.x1 <= b.x2 && b.x1 <= a.x2 && a.z1 <= b.z2 && b.z1 <= a.z2;
const gapXZ = (a, b) => {/* 盒间空隙格数: 相交=0 · 边相邻=0 · 隔 n 空格=n(切比雪夫) */
  return Math.max(a.x1 - b.x2 - 1, b.x1 - a.x2 - 1, a.z1 - b.z2 - 1, b.z1 - a.z2 - 1, 0);
};
const center = (a, b) => (a + b) / 2; /* 闭域中心 */
const spanOf = (a, b) => b - a + 1; /* 闭域跨度 */

/* ============ ① 门面与结构 ============ */

test('门面: TOWN_MAP 八段数据权威 + townBuildSteps 纯函数出口', () => {
  const c = loadCore();
  assert.ok(c.TOWN_MAP, 'TOWN_MAP 数据权威存在');
  for (const k of ['core', 'plaza']) {
    assert.ok(c.TOWN_MAP[k] && typeof c.TOWN_MAP[k] === 'object', '常量段「' + k + '」是对象');
  }
  for (const k of ['zones', 'anchors', 'prefab', 'roads', 'ground', 'backdrop', 'scatter']) {
    assert.ok(Array.isArray(c.TOWN_MAP[k]) && c.TOWN_MAP[k].length > 0, '清单段「' + k + '」非空数组');
  }
  assert.strictEqual(typeof c.townBuildSteps, 'function', 'townBuildSteps 是函数(建场步骤出口)');
});

/* ============ ② 规模口径(map-design §3.1) ============ */

test('规模: 核心区 ~96×96 居世界 · 广场 28×28 与核心同心 · 地面基高有余量', () => {
  const c = loadCore();
  const core = c.TOWN_MAP.core;
  assert.strictEqual(core.x2 - core.x1 + 1, 96, '核心区宽 96(~96×96 口径)');
  assert.strictEqual(core.z2 - core.z1 + 1, 96, '核心区深 96');
  assert.strictEqual(core.size, 96, 'size 字段与跨度一致');
  assert.ok(core.x1 >= 0 && core.x2 < c.WORLD_W && core.z1 >= 0 && core.z2 < c.WORLD_D,
      '核心区 ⊆ 世界(160×160)');
  assert.strictEqual(core.x1, c.WORLD_W - 1 - core.x2, '东西边距对称(居中留远景过渡带)');
  assert.strictEqual(core.z1, c.WORLD_D - 1 - core.z2, '南北边距对称');
  const plaza = c.TOWN_MAP.plaza;
  assert.strictEqual(plaza.x2 - plaza.x1 + 1, 28, '主广场 28×28(§3.1)');
  assert.strictEqual(plaza.z2 - plaza.z1 + 1, 28, '主广场深 28');
  assert.ok(plaza.x1 >= core.x1 && plaza.x2 <= core.x2 && plaza.z1 >= core.z1 && plaza.z2 <= core.z2,
      '广场 ⊆ 核心区');
  assert.ok(Math.abs(center(plaza.x1, plaza.x2) - center(core.x1, core.x2)) <= 1 &&
      Math.abs(center(plaza.z1, plaza.z2) - center(core.z1, core.z2)) <= 1, '广场与核心区同心(±1)');
  assert.ok(Number.isInteger(core.groundY) && core.groundY > 0, '地面基高 groundY 为正整数');
  assert.ok(core.groundY + 16 <= c.WORLD_H - 1,
      '基高之上放得下最高档钟塔 16 层(WORLD_H 界内)');
});

/* ============ ③ 分区方位语义(map-design §4.1) ============ */

test('分区: 六带齐备 · 方位语义(北远景/北田园/中广场/东商业/西生活/南彩蛋)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const zoneIds = [...t.zones].map((z) => z.id).sort(); /* 先摊平进宿主域(vm 数组
      过不了 deepStrictEqual 跨域原型比对, prefab-kit.test.js 同款先例) */
  assert.deepStrictEqual(zoneIds,
      ['east', 'far-north', 'hub', 'north', 'south', 'west'], '分区 id 恰六带');
  const byId = Object.fromEntries(t.zones.map((z) => [z.id, z]));
  const {core, plaza} = t;
  const far = byId['far-north'];
  assert.strictEqual(far.reachable, false, '远景层不可达');
  assert.ok(far.z2 < core.z1, '远景层在核心区外北侧');
  assert.ok(byId.north.z2 < plaza.z1, '田园带在广场北侧');
  assert.deepStrictEqual([byId.hub.x1, byId.hub.z1, byId.hub.x2, byId.hub.z2],
      [plaza.x1, plaza.z1, plaza.x2, plaza.z2], 'hub 分区=广场域');
  assert.ok(byId.east.x1 > plaza.x2, '商业带在广场东侧');
  assert.ok(byId.west.x2 < plaza.x1, '生活带在广场西侧');
  assert.ok(byId.south.z1 > plaza.z2, '彩蛋带在广场南侧');
  assert.strictEqual(byId.south.optional, true, '彩蛋带标 optional(P2 可选, §4.1)');
  for (const zid of ['north', 'hub', 'east', 'west', 'south']) {
    const z = byId[zid];
    assert.notStrictEqual(z.reachable, false, zid + ' 分区可达');
    assert.ok(z.x1 >= core.x1 && z.x2 <= core.x2 && z.z1 >= core.z1 && z.z2 <= core.z2,
        zid + ' 分区 ⊆ 核心区');
  }
  assert.ok(typeof byId.hub.name === 'string' && byId.hub.name.length > 0, '分区带中文名');
});

/* ============ ④ Prefab 实例清单·映射(prefab-specs §3) ============ */

test('实例映射: P0/P1 全入=七新行+under-room 复用 · board-pool(PO 推迟)不列', () => {
  const c = loadCore();
  const ps = c.TOWN_MAP.prefab;
  const ids = [...new Set(ps.map((p) => p.id))].sort();
  assert.deepStrictEqual(ids, ['cottage-gable', 'house-loft', 'shop-awning', 'stall-canopy',
    'stash-hut', 'tower-belfry', 'under-room', 'windmill-tower'],
  '实例 id 恰八种: T-PREFAB-01..07 七新行 + under-room(cache-cellar 复用)');
  assert.ok(!ids.includes('board-pool'), 'board-pool 按 PO 2026-11-13 裁决推迟, 不虚构实例');
  assert.ok(!ids.includes('mound'), 'hill-mound 属条件复用件(近景小丘语义时), 本布局不落');
  const stalls = ps.filter((p) => p.id === 'stall-canopy');
  assert.strictEqual(stalls.length, 6, '摊位 3→6(视觉重制 §3 A: 广场 4+主路口 2)');
  assert.ok(['bread', 'flower', 'fruit'].every((tm) => stalls.some((p) => p.v.theme === tm)),
      '摊位主题面包/花束/果篮齐(§4.2 P2-02 变体口径)');
  assert.ok(new Set(stalls.map((p) => p.v.size)).size >= 2, '摊位 sm/md 两档都有');
  const cellars = ps.filter((p) => p.id === 'under-room');
  assert.strictEqual(cellars.length, 1, 'cache-cellar 恰一处(P1-01 地下储藏组合)');
  const mat = cellars[0].v.mat;
  assert.ok(Number.isInteger(mat) && mat > 0 && ![20, 35, 40, 41, 47].includes(mat),
      'cache-cellar v.mat 必传且为安全实义方块 id(材质基线黑名单外)');
});

test('实例字段: 形状(id,x,y,z,v,face,zone) · y 统一基高 · face 四正交 · v 无材质槽', () => {
  const c = loadCore();
  const {core} = c.TOWN_MAP;
  for (const p of c.TOWN_MAP.prefab) {
    for (const k of ['id', 'x', 'y', 'z', 'face', 'v', 'zone']) {
      assert.ok(k in p, '实例 ' + p.id + ' 字段「' + k + '」在(票面字段口径)');
    }
    assert.strictEqual(p.y, core.groundY, '实例 ' + p.id + ' 锚 y=地面基高');
    assert.ok(['north', 'east', 'south', 'west'].includes(p.face),
        'face ∈ 四正交向(' + p.face + ')');
    assert.ok(p.v && typeof p.v === 'object' && !Object.prototype.hasOwnProperty.call(p.v, 'ids'),
        'v 无材质 ids 槽(集中注入归 T-MAP-03 town-palette, 本票纯几何计划)');
    assert.ok(p.x >= core.x1 && p.x <= core.x2 && p.z >= core.z1 && p.z <= core.z2,
        '锚点 ⊆ 核心区');
  }
});

/* ============ ⑤ 脚印合法·体量域·分区归属(消费 PrefabKit interface) ============ */

test('脚印合法: footOf 同参不炸 · 盒 ⊆ 核心区与世界 · 体量域合 §4.2 表 · 分区归属', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const byId = Object.fromEntries(t.zones.map((z) => [z.id, z]));
  const span = (a, b) => b - a + 1; /* 闭域跨度 */
  /* 体量域: id → [x/z 跨(旋转对称取 min/max), y 跨](map-design §4.2 占地/高度列) */
  const FOOTPRINT = {
    'tower-belfry': {min: 6, max: 6, y: [14, 16]}, /* 钟塔 6×6 高 14-16 */
    'shop-awning': {min: 8, max: 10, y: [7, 8]}, /* 店 10×8(含前廊 10×9) 高 7-8 */
    'stash-hut': {min: 6, max: 6, y: [5, 6]}, /* 小屋 6×6 高 5-6 */
    'windmill-tower': {min: 6, max: 9, y: [12, 14]}, /* 风车塔体 6×6+叶展 高 12-14 */
    'cottage-gable': {min: 7, max: 8, y: [6, 6]}, /* 民居 A 8×7 高 6 */
    'house-loft': {min: 8, max: 10, y: [8, 9]}, /* 民居 B 10×8 高 8-9 */
    'stall-canopy': {min: 2, max: 4, y: [3, 4]}, /* 摊位 3×2~4×3 高 3-4 */
    'under-room': {min: 3, max: 12, y: null}, /* 埋室形状随 v(半宽/出路), 只验界内 */
  };
  for (const p of t.prefab) {
    const v = Object.assign({}, p.v, {face: p.face}); /* face 并入 v = 装配形 */
    const box = c.PrefabKit.footOf(p.id, p.x, p.y, p.z, v); /* 零写纯查询=校验器 */
    assert.ok(box.x1 <= box.x2 && box.z1 <= box.z2 && box.y1 <= box.y2, '盒良序');
    assert.ok(box.x1 >= t.core.x1 && box.x2 <= t.core.x2 && box.z1 >= t.core.z1 &&
        box.z2 <= t.core.z2, '脚印 ⊆ 核心区(' + p.id + ')');
    assert.ok(box.y1 >= 0 && box.y2 <= c.WORLD_H - 1, 'y ⊆ 世界高(' + p.id + ')');
    const z = byId[p.zone];
    assert.ok(z, 'zone「' + p.zone + '」在分区清单');
    assert.ok(box.x1 >= z.x1 && box.x2 <= z.x2 && box.z1 >= z.z1 && box.z2 <= z.z2,
        '脚印 ⊆ 标注分区(' + p.id + '→' + p.zone + ')');
    const f = FOOTPRINT[p.id];
    const w = span(box.x1, box.x2); const d = span(box.z1, box.z2);
    assert.ok(Math.min(w, d) >= f.min && Math.max(w, d) <= f.max,
        '占地域合 §4.2(' + p.id + ': ' + w + '×' + d + ' ∈ ' + f.min + '~' + f.max + ')');
    if (f.y) {
      assert.ok(span(box.y1, box.y2) >= f.y[0] && span(box.y1, box.y2) <= f.y[1],
          '高度域合 §4.2(' + p.id + ': ' + span(box.y1, box.y2) + ' 层)');
    }
  }
  const cellar = t.prefab.find((p) => p.id === 'under-room');
  const cellarBox = c.PrefabKit.footOf(cellar.id, cellar.x, cellar.y, cellar.z,
      Object.assign({}, cellar.v, {face: cellar.face}));
  assert.ok(cellarBox.y1 < t.core.groundY, 'cache-cellar 埋地下(§4.9 埋室语义)');
  const tower = t.prefab.find((p) => p.id === 'tower-belfry');
  const towerBox = c.PrefabKit.footOf(tower.id, tower.x, tower.y, tower.z,
      Object.assign({}, tower.v, {face: tower.face}));
  assert.ok(towerBox.x1 >= t.plaza.x1 && towerBox.x2 <= t.plaza.x2 &&
      towerBox.z1 >= t.plaza.z1 && towerBox.z2 <= t.plaza.z2, '钟塔立于广场内(视线焦点)');
  assert.ok(Math.abs(center(towerBox.x1, towerBox.x2) - center(t.plaza.x1, t.plaza.x2)) <= 2,
      '钟塔东西居中于广场(主视觉焦点)');
  for (const stall of t.prefab.filter((p) => p.id === 'stall-canopy')) {
    const sb = c.PrefabKit.footOf(stall.id, stall.x, stall.y, stall.z,
        Object.assign({}, stall.v, {face: stall.face}));
    assert.ok(sb.x1 >= t.plaza.x1 && sb.x2 <= t.plaza.x2 && sb.z1 >= t.plaza.z1 &&
        sb.z2 <= t.plaza.z2, '摊位 ⊆ 广场(沿边缘成组, 不出广场)');
  }
});

/* ============ ⑥ 实例两两无交 ============ */

test('布局自洽: 实例脚印两两无交(建筑互不叠压)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const boxes = t.prefab.map((p) => {
    const b = c.PrefabKit.footOf(p.id, p.x, p.y, p.z, Object.assign({}, p.v, {face: p.face}));
    return {p, b};
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b; const q = boxes[j].b;
      const hit = overlapXZ(a, q) && a.y1 <= q.y2 && q.y1 <= a.y2;
      assert.ok(!hit, '无交: ' + boxes[i].p.id + '(' + boxes[i].p.zone + ') × ' +
          boxes[j].p.id + '(' + boxes[j].p.zone + ')');
    }
  }
});

/* ============ ⑦ 路网(map-design §4.3) ============ */

test('路网: 主路 4-5/支路 2-3 · 放射贴广场 · 段间连通 · 不压建筑 · 门前可达', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const {core, plaza} = t;
  const mains = t.roads.filter((r) => r.kind === 'main');
  const lanes = t.roads.filter((r) => r.kind === 'lane');
  assert.ok(mains.length >= 3, '主路 ≥3 条(放射连接广场与 P0/P1 地标)');
  assert.ok(lanes.length >= 2, '支路 ≥2 条(民居门前/田园, §4.3)');
  for (const r of t.roads) {
    assert.ok(['main', 'lane'].includes(r.kind), '道路 kind ∈ main/lane');
    const thin = Math.min(spanOf(r.x1, r.x2), spanOf(r.z1, r.z2));
    const wide = r.kind === 'main' ? [4, 5] : [2, 3];
    assert.ok(thin >= wide[0] && thin <= wide[1],
        r.id + ' 厚度 ' + thin + ' ∈ ' + wide.join('-') + '(' + r.kind + ' 路宽 §4.3)');
    assert.ok(r.x1 >= core.x1 && r.x2 <= core.x2 && r.z1 >= core.z1 && r.z2 <= core.z2,
        r.id + ' ⊆ 核心区');
    assert.ok(gapXZ(r, plaza) === 0 || t.roads.some((o) => o !== r && gapXZ(r, o) === 0),
        r.id + ' 贴广场或与其他路段连通(路网占位不断链)');
  }
  const boxes = t.prefab.map((p) => ({p, b: c.PrefabKit.footOf(p.id, p.x, p.y, p.z,
      Object.assign({}, p.v, {face: p.face}))}));
  for (const {p, b} of boxes) {
    for (const r of t.roads) {
      assert.ok(!overlapXZ(b, r), '道路不压建筑: ' + r.id + ' × ' + p.id);
    }
    if (p.zone !== 'hub') {/* 广场内建筑(塔/摊)立于铺装上, 可达性由广场承担 */
      const near = Math.min(...t.roads.map((r) => gapXZ(b, r)));
      assert.ok(near <= 4, p.id + ' 门前可达(距最近路段 ≤4 格)');
    }
  }
});

/* ============ ⑧ 地表分类(prefab-specs §5.2 场景拼装) ============ */

test('地表: 广场铺装=广场域 · 农田成组(8×12~10×14)归田园带 · 不入 PrefabKit', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const plazas = t.ground.filter((g) => g.kind === 'plaza');
  const farms = t.ground.filter((g) => g.kind === 'farm');
  assert.strictEqual(plazas.length, 1, '广场铺装恰一条');
  assert.deepStrictEqual([plazas[0].x1, plazas[0].z1, plazas[0].x2, plazas[0].z2],
      [t.plaza.x1, t.plaza.z1, t.plaza.x2, t.plaza.z2], '铺装域=plaza 常量(28×28)');
  assert.ok(farms.length >= 1 && farms.length <= 3, '农田成组 1-3 组(§4.2 P1-03)');
  const north = t.zones.find((z) => z.id === 'north');
  for (const f of farms) {
    assert.ok(f.x1 >= north.x1 && f.x2 <= north.x2 && f.z1 >= north.z1 && f.z2 <= north.z2,
        '农田 ⊆ 田园带(' + f.id + ')');
    const w = spanOf(f.x1, f.x2); const d = spanOf(f.z1, f.z2);
    assert.ok(w >= 8 && w <= 10 && d >= 11 && d <= 14,
        '农田组 ' + w + '×' + d + ' ∈ 8×12~10×14(§4.2 P1-03 体量)');
  }
  for (const g of t.ground) {
    assert.ok(g.x1 >= t.core.x1 && g.x2 <= t.core.x2 && g.z1 >= t.core.z1 && g.z2 <= t.core.z2,
        '地表条目 ⊆ 核心区(' + g.id + ')');
  }
});

/* ============ ⑨ 远景剪影(map-design §4.2 R-01..03 · M7 默认) ============ */

test('远景: 拱形山体必做横贯 · 崖屋 1-2 栋 · 神庙默认不落 · 全部不可达且界内', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  for (const b of t.backdrop) {
    assert.ok(['mountain', 'cliff-home'].includes(b.kind), '远景 kind ∈ mountain/cliff-home');
    assert.strictEqual(b.reachable, false, '远景不可达(' + b.id + ')');
  }
  assert.ok(!t.backdrop.some((b) => b.kind === 'temple'),
      '神庙剪影默认不落(M7 远景可选, PO 知情批次)');
  const mts = t.backdrop.filter((b) => b.kind === 'mountain');
  assert.strictEqual(mts.length, 1, '拱形山体恰一处(R-01 必做)');
  const m = mts[0];
  assert.ok(spanOf(m.x1, m.x2) >= t.core.size, '山体横贯(宽 ≥ 核心区宽, 聚落背屏)');
  assert.ok(m.z2 < t.core.z1, '山体在核心区外北侧(不可达带)');
  assert.ok(m.topY <= c.WORLD_H - 1, '山体顶 ⊆ 世界高');
  const tower = t.prefab.find((p) => p.id === 'tower-belfry');
  const tb = c.PrefabKit.footOf(tower.id, tower.x, tower.y, tower.z,
      Object.assign({}, tower.v, {face: tower.face}));
  assert.ok(m.topY > tb.y2, '山体剪影高过钟塔(背景层次压过竖向地标, §3.3)');
  const cliffs = t.backdrop.filter((b) => b.kind === 'cliff-home');
  assert.ok(cliffs.length >= 1 && cliffs.length <= 2, '崖顶房屋 1-2 栋(R-02/M7 默认)');
  for (const h of cliffs) {
    assert.ok(h.x >= m.x1 && h.x <= m.x2 && h.z >= m.z1 && h.z <= m.z2,
        '崖屋落在山体域内(' + h.id + ')');
    assert.ok(h.baseY < h.topY && h.topY <= c.WORLD_H - 1, '崖屋高度域良序界内');
  }
  /* 视觉重制 §3 B 可见性拍板: 崖屋盒顶须高出装配侧拱形公式
     round(topY·(1-t²)+groundY·t²)(与 town-assembly-core backdrop 段
     同式)的局部脊高 ≥3 格, 剪影才从山体里读出来; 且 2 栋分列钟塔
     影轴两侧, 不被塔影吞(塔半宽张角 ~4°, ±14° 侧位安全) */
  const archTopAt = (x) => {
    const tt = (x - center(m.x1, m.x2)) / ((m.x2 - m.x1) / 2);
    return Math.round(m.topY * (1 - tt * tt) + t.core.groundY * (tt * tt));
  };
  for (const h of cliffs) {
    assert.ok(h.topY - 1 >= archTopAt(h.x) + 3,
        '崖屋盒顶高出局部脊线 ≥3 格(剪影可见, ' + h.id + ': 脊 ' +
        archTopAt(h.x) + ' 顶 ' + (h.topY - 1) + ')');
  }
  assert.ok(cliffs.length === 2 &&
      cliffs.some((h) => h.x < center(tb.x1, tb.x2)) &&
      cliffs.some((h) => h.x > center(tb.x1, tb.x2)),
  '崖屋 2 栋分列钟塔轴两侧(塔影不吞剪影)');
});

/* ============ ⑩ 散布(prefab-specs §5.1/§5.2 落位政策=调用方=本计划) ============ */

test('散布: 樱花/灌木/灯柱/路标四类 · 广场樱花必备 · 不落建筑与路面 · 密度克制', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const kinds = ['sakura', 'scrub', 'lamp', 'signpost'];
  assert.ok(t.scatter.every((s) => kinds.includes(s.kind)), '散布 kind ⊆ 四类');
  for (const k of kinds) {
    assert.ok(t.scatter.some((s) => s.kind === k), '「' + k + '」类有落点');
  }
  assert.ok(t.scatter.length >= 6 && t.scatter.length <= 24, '散布总数 6-24(视觉重制 §3 A 氛围密度升级)');
  assert.ok(t.scatter.some((s) => s.kind === 'sakura' && s.x >= t.plaza.x1 && s.x <= t.plaza.x2 &&
      s.z >= t.plaza.z1 && s.z <= t.plaza.z2), '广场核心樱花 ≥1 棵(prefab-specs §5.1 必备)');
  /* 视觉重制 §3 A 氛围层密度拍板: 灯柱 2→10(广场环+主路沿线)、广场
     樱花 ≥3(核心 1+角樱 2) */
  const lamps = t.scatter.filter((s) => s.kind === 'lamp');
  assert.ok(lamps.length >= 10, '灯柱 ≥10(广场环+主路沿线, §3 A)');
  const plazaSakuras = t.scatter.filter((s) => s.kind === 'sakura' &&
      s.x >= t.plaza.x1 && s.x <= t.plaza.x2 && s.z >= t.plaza.z1 && s.z <= t.plaza.z2);
  assert.ok(plazaSakuras.length >= 3, '广场樱花 ≥3(核心 1+角樱 2, §3 A)');
  /* 视觉重制 §3 构图层·进镇门廊: spawn(面北望钟塔)前方主路两侧
     x≤75/x≥81 各有樱花+灯柱对位(z 98..106), 树冠覆路缘成「穿过樱
     花拱门望钟塔」的出生第一眼前景框 */
  for (const kind of ['sakura', 'lamp']) {
    assert.ok(t.scatter.some((s) => s.kind === kind && s.x <= 75 && s.z >= 98 && s.z <= 106) &&
        t.scatter.some((s) => s.kind === kind && s.x >= 81 && s.z >= 98 && s.z <= 106),
    '进镇门廊两侧「' + kind + '」对位(出生第一眼前景框, §3 构图层)');
  }
  /* 视觉重制 §3 E·断头驿站信标(v1 灯柱先行, 圆石小坪 v2): 任一道路
     端帽若「三不贴」——不贴广场、不贴其他路段、也不贴任何建筑脚印
     (贴建筑=目的地终站, 如 lane-farm 尽头的风车)——判为断头, 其
     2 格内必有灯柱信标 */
  const lampNear = (x, z) => t.scatter.some((s) => s.kind === 'lamp' &&
      Math.max(Math.abs(s.x - x), Math.abs(s.z - z)) <= 2);
  const prefabBoxes = t.prefab.map((p) => c.PrefabKit.footOf(p.id, p.x, p.y, p.z,
      Object.assign({}, p.v, {face: p.face})));
  for (const r of t.roads) {
    const alongX = spanOf(r.x1, r.x2) >= spanOf(r.z1, r.z2);
    const caps = alongX ?
        [{x: r.x1, z: center(r.z1, r.z2)}, {x: r.x2, z: center(r.z1, r.z2)}] :
        [{x: center(r.x1, r.x2), z: r.z1}, {x: center(r.x1, r.x2), z: r.z2}];
    for (const cap of caps) {
      const capBox = alongX ?
          {x1: cap.x, z1: r.z1, x2: cap.x, z2: r.z2} :
          {x1: r.x1, z1: cap.z, x2: r.x2, z2: cap.z};
      const served = gapXZ(capBox, t.plaza) === 0 ||
          t.roads.some((o) => o !== r && gapXZ(capBox, o) === 0) ||
          prefabBoxes.some((b) => gapXZ(capBox, b) === 0);
      if (served) continue;
      assert.ok(lampNear(cap.x, cap.z),
          '断头端点灯柱信标(' + r.id + ' 端帽 ' + cap.x + ',' + cap.z + ', §3 E)');
    }
  }
  const boxes = t.prefab.map((p) => c.PrefabKit.footOf(p.id, p.x, p.y, p.z,
      Object.assign({}, p.v, {face: p.face})));
  for (const s of t.scatter) {
    assert.strictEqual(s.y, t.core.groundY, '散布点 y=地面基高(' + s.id + ')');
    assert.ok(s.x >= t.core.x1 && s.x <= t.core.x2 && s.z >= t.core.z1 && s.z <= t.core.z2,
        '散布点 ⊆ 核心区(' + s.id + ')');
    for (const b of boxes) {
      assert.ok(!(s.x >= b.x1 && s.x <= b.x2 && s.z >= b.z1 && s.z <= b.z2),
          '散布不落建筑脚印(' + s.id + ' × ' + b.x1 + '~' + b.x2 + '/' + b.z1 + '~' + b.z2 + ')');
    }
    for (const r of t.roads) {
      assert.ok(!(s.x >= r.x1 && s.x <= r.x2 && s.z >= r.z1 && s.z <= r.z2),
          '散布不落路面(' + s.id + ' × ' + r.id + ')');
    }
  }
});

/* ============ ⑪ 锚点(出生/地标导览, 供 T-MAP-02/04 消费) ============ */

test('锚点: 核心导览锚齐 · spawn 北望落南主路 · 回望钟塔视线通廊无遮挡', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const ids = t.anchors.map((a) => a.id);
  for (const need of ['spawn', 'bell-tower', 'lava-chicken', 'stash', 'windmill', 'farm', 'market']) {
    assert.ok(ids.includes(need), '锚点「' + need + '」在(观察-寻找-回应锚点底料)');
  }
  assert.strictEqual(ids.filter((i) => i === 'spawn').length, 1, 'spawn 唯一');
  for (const a of t.anchors) {
    assert.strictEqual(a.y, t.core.groundY, '锚点 y=地面基高(' + a.id + ')');
    assert.ok(a.x >= t.core.x1 && a.x <= t.core.x2 && a.z >= t.core.z1 && a.z <= t.core.z2,
        '锚点 ⊆ 核心区(' + a.id + ')');
  }
  const spawn = t.anchors.find((a) => a.id === 'spawn');
  assert.strictEqual(spawn.face, 'north', '出生点面向北=面向广场(T-MAP-02 出生意图)');
  assert.ok(t.roads.some((r) => r.kind === 'main' && spawn.x >= r.x1 && spawn.x <= r.x2 &&
      spawn.z >= r.z1 && spawn.z <= r.z2), 'spawn 落在某条主路段上(南主路=玩家进入动线)');
  const tower = t.prefab.find((p) => p.id === 'tower-belfry');
  const tb = c.PrefabKit.footOf(tower.id, tower.x, tower.y, tower.z,
      Object.assign({}, tower.v, {face: tower.face}));
  assert.ok(Math.abs(spawn.x - center(tb.x1, tb.x2)) <= 2, 'spawn 与钟塔东西对齐(±2)');
  /* 回望通廊: spawn→钟塔之间宽 3 格走廊, 除塔外无建筑阻挡(§4.3 视线管理) */
  const corridor = {x1: spawn.x - 1, z1: tb.z2 + 1, x2: spawn.x + 1, z2: spawn.z - 1};
  for (const p of t.prefab) {
    if (p.id === 'tower-belfry') continue;
    const b = c.PrefabKit.footOf(p.id, p.x, p.y, p.z, Object.assign({}, p.v, {face: p.face}));
    assert.ok(!overlapXZ(b, corridor), '视线通廊无遮挡: ' + p.id + ' 不入走廊');
  }
});

/* ============ ⑫ townBuildSteps 确定性(架构 §4.2/§5.1.6 建场序) ============ */

test('buildSteps: phase 全序=地表→远景→路网→建筑→散布→锚点 · 与源清单一一对应 · 确定性', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const steps = c.townBuildSteps();
  assert.ok(Array.isArray(steps) && steps.length > 0, '步骤清单非空');
  const order = ['ground', 'backdrop', 'road', 'prefab', 'scatter', 'anchor'];
  const seen = [];
  for (const s of steps) {
    if (!seen.includes(s.phase)) seen.push(s.phase);
  }
  assert.deepStrictEqual(seen, order, 'phase 首现全序=建场次序(§5.1.6 先地表路网基底→' +
      '建筑件→植被道具散布→出生点; backdrop 属地表模块紧随地基底)');
  const byPhase = (ph) => steps.filter((s) => s.phase === ph);
  const pairs = [['ground', t.ground], ['backdrop', t.backdrop], ['road', t.roads],
    ['prefab', t.prefab], ['scatter', t.scatter], ['anchor', t.anchors]];
  for (const [ph, src] of pairs) {
    assert.deepStrictEqual(byPhase(ph).map((s) => s.id), src.map((e) => e.id),
        ph + ' 段步骤与源清单 id 保序一致');
  }
  assert.strictEqual(steps.length, t.ground.length + t.backdrop.length + t.roads.length +
      t.prefab.length + t.scatter.length + t.anchors.length, '步骤总数=六段清单和(无增删)');
  assert.deepStrictEqual(c.townBuildSteps(), steps, '同参同输出: 两调 deepEqual(确定性红线)');
});

/* ============ ⑬ 源文本守门(纯数据/纯函数红线, 票面确定性约束) ============ */

test('源文本守门: 零渲染库·零 DOM·零墙钟·零随机(确定性红线)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'town-map-core.js'), 'utf8');
  assert.ok(/^['"]use strict['"];/.test(src), '"use strict"; 首行');
  assert.ok(!src.includes('THREE'), '零三维渲染库(纯数据计划模块)');
  assert.ok(!src.includes('document') && !src.includes('window'), '零 DOM');
  assert.ok(!src.includes('Math.random'), '零随机源(同参同输出)');
  for (const banned of ['Date.now', 'new Date', 'performance.now']) {
    assert.ok(!src.includes(banned), '零墙钟(' + banned + ')');
  }
});
