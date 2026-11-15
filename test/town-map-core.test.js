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
    PrefabKit 仅供测试侧 footOf 校验(town-map-core 本体零运行时依赖);
    TOWN_NPC_ANCHORS 供散布 npc 避让断言(纯数据零依赖) */
  const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-npc-anchor-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
  }
  return vm.runInContext(
      '({TOWN_MAP, townBuildSteps, PrefabKit, TOWN_NPC_ANCHORS, WORLD_W, WORLD_D, WORLD_H})', eng);
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
    /* 民居 A 8×7 高 7(v2 双坡+阶梯山墙, checkpoint 批准几何升级;
       旧值 6 见 map-design §4.2, 被总纲 §3 G 取代) */
    'cottage-gable': {min: 7, max: 8, y: [7, 7]},
    'house-loft': {min: 8, max: 10, y: [8, 9]}, /* 民居 B 10×8 高 8-9 */
    /* 摊位 3×2~4×3 高 4-5(Step D 双层阶梯顶几何升级+1, §3 G 规格驱动,
       cottage 先例核准几何升级压文档; 旧值 3-4 见 map-design §4.2,
       漂移登记 arch 回执) */
    'stall-canopy': {min: 2, max: 4, y: [4, 5]},
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
  const farms = t.ground.filter((g) => g.kind === 'farm' || g.kind === 'farm-rows');
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
  /* 视觉重制 §3 E(v2): farm 两块升格 farm-rows 田垄(域不变, 派生侧垄/
     围栏/作物轮转; 域不变=npc 站位与巡逻面零连累) */
  assert.strictEqual(farms.filter((f) => f.kind === 'farm-rows').length, 2,
      '农田恰 2 组且全为 farm-rows 田垄(v2 升格)');
  for (const g of t.ground) {
    assert.ok(g.x1 >= t.core.x1 && g.x2 <= t.core.x2 && g.z1 >= t.core.z1 && g.z2 <= t.core.z2,
        '地表条目 ⊆ 核心区(' + g.id + ')');
  }
  /* 断头小坪(v2 #6): 恰 2 处 5×5, 贴 main-east/main-south 断头端外侧,
     与任何路域/缘石线零交(写序无关化), 坪内恰含既有驿站灯柱 1 根 */
  const shrines = t.ground.filter((g) => g.kind === 'wayshrine');
  assert.strictEqual(shrines.length, 2, '断头小坪恰 2 处(v2 #6)');
  for (const w of shrines) {
    assert.strictEqual(spanOf(w.x1, w.x2) * spanOf(w.z1, w.z2), 25,
        '小坪 5×5(' + w.id + ')');
    for (const r of t.roads) {
      assert.ok(!(w.x1 <= r.x2 && r.x1 <= w.x2 && w.z1 <= r.z2 && r.z1 <= w.z2),
          '小坪不压路域(' + w.id + ' × ' + r.id + ')');
    }
    const lamps = t.scatter.filter((s) => s.kind === 'lamp' &&
        s.x >= w.x1 && s.x <= w.x2 && s.z >= w.z1 && s.z <= w.z2);
    assert.strictEqual(lamps.length, 1, '坪内恰 1 驿站灯柱(' + w.id + '：v1 灯柱+v2 圆石小坪会师)');
  }
  assert.ok(t.ground.some((g) => g.kind === 'wayshrine' &&
      g.x1 > 120 && g.z1 > 83 && g.z2 < 89), '东驿站坪贴 main-east 断头端');
  assert.ok(t.ground.some((g) => g.kind === 'wayshrine' &&
      g.z1 > 118 && g.x1 > 75 && g.x2 < 81), '南驿站坪贴 main-south 断头端');
});

/* ============ ⑨ 远景剪影(map-design §4.2 R-01..03 · M7 默认) ============ */

test('远景: 拱形山体必做横贯 · 崖屋 1-2 栋 · 神庙默认不落 · 全部不可达且界内', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  for (const b of t.backdrop) {
    assert.ok(['mountain', 'cliff-home', 'scrub', 'boulder'].includes(b.kind),
        '远景 kind ∈ mountain/cliff-home/scrub/boulder(v2 山缘植被)');
    assert.strictEqual(b.reachable, false, '远景不可达(' + b.id + ')');
  }
  assert.ok(!t.backdrop.some((b) => b.kind === 'temple'),
      '神庙剪影默认不落(M7 远景可选, PO 知情批次)');
  const mts = t.backdrop.filter((b) => b.kind === 'mountain');
  assert.strictEqual(mts.length, 1, '拱形山体恰一处(R-01 必做)');
  const m = mts[0];
  /* 视觉重制 §3 B(v2 #8): bands 字段显式启用五段分色(派生侧基段石/苔/
     z27..28 草坡/石/雪, 空段跳笔; 无 bands 旧单色逐柱单笔)——数据侧
     字段门控断言, 分段几何归派生, 这里钉「开关已开」 */
  assert.strictEqual(m.bands, true, '山体 bands:true(五段分色启用, v2 #8)');
  assert.ok(spanOf(m.x1, m.x2) >= t.core.size, '山体横贯(宽 ≥ 核心区宽, 聚落背屏)');
  assert.ok(m.z2 < t.core.z1, '山体在核心区外北侧(不可达带)');
  assert.ok(m.topY <= c.WORLD_H - 1, '山体顶 ⊆ 世界高');
  const tower = t.prefab.find((p) => p.id === 'tower-belfry');
  const tb = c.PrefabKit.footOf(tower.id, tower.x, tower.y, tower.z,
      Object.assign({}, tower.v, {face: tower.face}));
  assert.ok(m.topY > tb.y2, '山体剪影高过钟塔(背景层次压过竖向地标, §3.3)');
  const cliffs = t.backdrop.filter((b) => b.kind === 'cliff-home');
  assert.ok(cliffs.length >= 1 && cliffs.length <= 2, '崖顶房屋 1-2 栋(R-02/M7 默认)');
  /* v2 #8 崖屋重皮: style:'v2'(白墙 52+角柱 17+窗 18+橙顶 9 双层+顶缘灯 19,
     数据 baseY/topY 差恒 6 不变, 几何归派生)——数据侧字段门控断言 */
  for (const h of cliffs) {
    assert.strictEqual(h.style, 'v2', '崖屋 style:v2(重皮启用, ' + h.id + ')');
  }
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
  /* 山缘植被(v2 #7): 矮丛×4+苔石×3 落低柱段墙顶——y=该列拱形列顶
     (与 archTopAt 同式, 单源核验), z 带 24..28 山体域内南缘; 冠域
     x±1/z±1 不溢空隙带 z29..31 不出山体域 */
  const rims = t.backdrop.filter((b) => b.kind === 'scrub' || b.kind === 'boulder');
  assert.ok(rims.filter((b) => b.kind === 'scrub').length === 4 &&
      rims.filter((b) => b.kind === 'boulder').length === 3,
  '山缘植被 = 矮丛 4+苔石 3(v2 #7)');
  for (const r of rims) {
    assert.strictEqual(r.y, archTopAt(r.x),
        '山缘点 y=拱形列顶(脚下表面格, ' + r.id + ': y ' + r.y +
        ' 列顶 ' + archTopAt(r.x) + ')');
    assert.ok(r.z >= 24 && r.z <= 28, '山缘点 z ∈ 24..28 山体南缘带(' + r.id + ')');
    /* scrub 冠域 x±1/z±1 不出山体域; boulder 单格无冠只查点 */
    const pad = r.kind === 'scrub' ? 1 : 0;
    assert.ok(r.x - pad >= m.x1 && r.x + pad <= m.x2,
        '山缘点(含冠)不出山体域(' + r.id + ')');
    assert.ok(r.z - pad >= m.z1 && r.z + pad <= m.z2,
        '山缘点(含冠)不溢南缘带(' + r.id + ')');
    for (const h of cliffs) {
      assert.ok(Math.abs(r.x - h.x) > 2 || Math.abs(r.z - h.z) > 2,
          '山缘点避崖屋域(' + r.id + ' × ' + h.id + ')');
    }
  }
});

/* ============ ⑩ 散布(prefab-specs §5.1/§5.2 落位政策=调用方=本计划) ============ */

test('散布: 十类词表 · 广场樱花必备 · 不落建筑与路面 · 密度分档(实体带宽+地被下限)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  /* 视觉重制 §3 E(v2): kind 域扩十类(原四类+散布草丛/花/旗/花坛/木桶/南瓜) */
  const kinds = ['sakura', 'scrub', 'lamp', 'signpost', 'tuft', 'flower',
    'flag', 'flowerbed', 'barrel', 'pumpkin'];
  const groundCover = ['tuft', 'flower']; /* 地被类: 全域密度档+最严避让 */
  const furniture = ['flag', 'flowerbed', 'barrel', 'pumpkin']; /* 家具类: 显式点 */
  assert.ok(t.scatter.every((s) => kinds.includes(s.kind)), '散布 kind ⊆ 十类');
  for (const k of kinds) {
    assert.ok(t.scatter.some((s) => s.kind === k), '「' + k + '」类有落点');
  }
  /* 密度分档(v2 口径重构: 原「总数 6..24」只辖实体类时代; 地被类按
     「每 8×8/16×16 一件档」全域枚举, 数量级另立——实体类保带宽断言,
     地被类保密度下限(过滤后存量), 两档不相乘不混算) */
  const solid = t.scatter.filter((s) => !groundCover.includes(s.kind));
  assert.ok(solid.length >= 6 && solid.length <= 40,
      '实体类(非地被)散布总数 6-40(氛围密度带宽)');
  const tufts = t.scatter.filter((s) => s.kind === 'tuft');
  const flowers = t.scatter.filter((s) => s.kind === 'flower');
  assert.ok(tufts.length >= 100,
      '草丛 ≥100 件(每 8×8 块 1 件档全域枚举·过滤后存量, 实得 ' + tufts.length + ')');
  assert.ok(flowers.length >= 20,
      '花 ≥20 件(每 16×16 块 1 件档, 实得 ' + flowers.length + ')');
  assert.ok(t.scatter.length <= 220, '散布总数 ≤220(性能守门, 实得 ' + t.scatter.length + ')');
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
  /* 旗阵(v2 #3): 恰 4 杆·四色齐·贴钟塔足印半环(足印 x77..82×z70..75 外
     1 格内 2 格, z<76 避回望走廊) */
  const flags = t.scatter.filter((s) => s.kind === 'flag');
  assert.strictEqual(flags.length, 4, '旗恰 4 杆(v2 #3 钟塔脚四色旗阵)');
  const cloths = new Set(flags.map((s) => s.v.cloth || 'sakura'));
  for (const cloth of ['sakura', 'blue', 'quartz', 'red']) {
    assert.ok(cloths.has(cloth), '旗色「' + cloth + '」在阵(v.cloth 四色齐)');
  }
  const towerFoot = t.prefab.find((p) => p.id === 'tower-belfry');
  const tb = c.PrefabKit.footOf(towerFoot.id, towerFoot.x, towerFoot.y, towerFoot.z,
      Object.assign({}, towerFoot.v, {face: towerFoot.face}));
  for (const f of flags) {
    const dx = Math.max(tb.x1 - f.x, f.x - tb.x2, 0);
    const dz = Math.max(tb.z1 - f.z, f.z - tb.z2, 0);
    const dd = Math.max(dx, dz);
    assert.ok(dd >= 1 && dd <= 2,
        '旗贴塔足印外 1..2 格切比(' + f.id + ': dx ' + dx + ' dz ' + dz + ')');
  }
  /* 家具类(v2 #10): 花坛 3(广场东南角+cottage/loft 门前)·桶 2·南瓜 2 */
  const beds = t.scatter.filter((s) => s.kind === 'flowerbed');
  assert.strictEqual(beds.length, 3, '花坛恰 3 处(v2 #10)');
  assert.ok(beds.filter((b) => b.x >= t.plaza.x1 && b.x <= t.plaza.x2 &&
      b.z >= t.plaza.z1 && b.z <= t.plaza.z2).length === 1, '花坛广场内恰 1(东南角)');
  assert.ok(beds.filter((b) => !(b.x >= t.plaza.x1 && b.x <= t.plaza.x2 &&
      b.z >= t.plaza.z1 && b.z <= t.plaza.z2)).length === 2, '花坛建筑门前恰 2');
  for (const tone of beds.map((b) => b.v.tone || 'y')) {
    assert.ok(['y', 'w'].includes(tone), '花坛芯 tone ∈ y/w');
  }
  assert.strictEqual(t.scatter.filter((s) => s.kind === 'barrel').length, 2, '木桶恰 2');
  assert.strictEqual(t.scatter.filter((s) => s.kind === 'pumpkin').length, 2, '南瓜恰 2');
  for (const f of t.scatter.filter((s) => s.kind === 'flower')) {
    assert.ok(['y', 'w'].includes(f.v.tone || 'y'), '散布花 tone ∈ y/w');
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
  /* 缘石外扩线(与派生同式: 路体两侧外扩一格, 长轴判走向)——地被类
     不立缘石, 实体类(灯柱/路标门廊既有)允许贴缘石(柱基路肩先例) */
  const curbLines = t.roads.map((r) => {
    const ax = spanOf(r.x1, r.x2) >= spanOf(r.z1, r.z2);
    return ax ?
        [{x1: r.x1, z1: r.z1 - 1, x2: r.x2, z2: r.z1 - 1},
          {x1: r.x1, z1: r.z2 + 1, x2: r.x2, z2: r.z2 + 1}] :
        [{x1: r.x1 - 1, z1: r.z1, x2: r.x1 - 1, z2: r.z2},
          {x1: r.x2 + 1, z1: r.z1, x2: r.x2 + 1, z2: r.z2}];
  }).flat();
  const shrines = t.ground.filter((g) => g.kind === 'wayshrine');
  const npcPts = [];
  for (const row of c.TOWN_NPC_ANCHORS) for (const w of row.waypoints) npcPts.push(w);
  const cheb = (ax, az, bx, bz) => Math.max(Math.abs(ax - bx), Math.abs(az - bz));
  const seenXZ = new Set();
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
    /* 回望走廊零立地(§4.3 视线管理, 严于派生侧体块口径): 全类禁入 */
    assert.ok(!(s.x >= 78 && s.x <= 80 && s.z >= 76 && s.z <= 111),
        '散布不入出生回望走廊(' + s.id + ')');
    /* npc 站位切比 ≥2(npc 锚核测试同款口径, 数据驱动对全散布) */
    for (const p of npcPts) {
      assert.ok(cheb(s.x, s.z, p.x, p.z) >= 2,
          '散布避 npc 站位 ≥2(' + s.id + ' vs ' + p.x + ',' + p.z + ')');
    }
    /* 互不重格(含 v1 既有与 v2 新增全类) */
    const k = s.x + ',' + s.z;
    assert.ok(!seenXZ.has(k), '散布互不重格(' + s.id + ' @ ' + k + ')');
    seenXZ.add(k);
    if (groundCover.includes(s.kind)) {
      /* 地被类最严避让: 不上广场铺装/不进农田/不上驿站坪/不立缘石线 */
      assert.ok(!(s.x >= t.plaza.x1 && s.x <= t.plaza.x2 &&
          s.z >= t.plaza.z1 && s.z <= t.plaza.z2), '地被不上广场(' + s.id + ')');
      for (const f of t.ground.filter((g) => g.kind === 'farm-rows')) {
        assert.ok(!(s.x >= f.x1 && s.x <= f.x2 && s.z >= f.z1 && s.z <= f.z2),
            '地被不进农田(' + s.id + ' × ' + f.id + ')');
      }
      for (const w of shrines) {
        assert.ok(!(s.x >= w.x1 && s.x <= w.x2 && s.z >= w.z1 && s.z <= w.z2),
            '地被不上驿站坪(' + s.id + ' × ' + w.id + ')');
      }
      for (const l of curbLines) {
        assert.ok(!(s.x >= l.x1 && s.x <= l.x2 && s.z >= l.z1 && s.z <= l.z2),
            '地被不立缘石线(' + s.id + ')');
      }
    }
    if (furniture.includes(s.kind) && s.kind !== 'flag') {
      /* 家具类(旗除外=广场家具)避 npc 站位加严到切比 ≥3(花坛 3×3 域
         外缘再留 1 格) */
      for (const p of npcPts) {
        assert.ok(cheb(s.x, s.z, p.x, p.z) >= 2,
            '家具避 npc 站位(' + s.id + ')');
      }
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

/* ============ ⑪b TIDEA 波次一: 五件翻新数据契约(scene-plan-tidea1 同式复算) ============ */

test('TIDEA 波次一: 瀑布域·南门回程件·镇徽花带·stash 记号·丰收角(数据契约)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const npcs = c.TOWN_NPC_ANCHORS.flatMap((r) => r.waypoints);
  const cheb = (x, z, p) => Math.max(Math.abs(x - p.x), Math.abs(z - p.z));
  /* ① TIDEA-05(W-05) 山体瀑布白线: waterfall 列域显式启用——域内列顶
      ≥40(雪带在场, 白线从雪带下缘接续)·避崖屋剪影·避钟塔影轴·⊆山体域;
      派生几何(54 柱+17 水花)归 assembly 需求清单, 数据侧钉开关与落域 */
  const mtn = t.backdrop.find((b) => b.kind === 'mountain');
  assert.ok(mtn.waterfall, '山体条目带 waterfall 字段(TIDEA-05 契约开关)');
  const bcx = (mtn.x1 + mtn.x2) / 2;
  const bhalf = (mtn.x2 - mtn.x1) / 2;
  for (let x = mtn.waterfall.x1; x <= mtn.waterfall.x2; x++) {
    const bt = (x - bcx) / bhalf;
    const top = Math.round(mtn.topY * (1 - bt * bt) + t.core.groundY * (bt * bt));
    assert.ok(top >= 40, '瀑布列 x' + x + ' 拱形列顶 ' + top + ' ≥40(雪带在场)');
    assert.ok(x >= mtn.x1 && x <= mtn.x2, '瀑布列 ⊆ 山体域');
  }
  for (const cl of t.backdrop.filter((b) => b.kind === 'cliff-home')) {
    assert.ok(mtn.waterfall.x2 < cl.x - 2 || mtn.waterfall.x1 > cl.x + 2,
        '瀑布与崖屋剪影 ' + cl.id + ' 间隔 ≥2(白线不叠剪影)');
  }
  assert.ok(mtn.waterfall.x2 < 78 || mtn.waterfall.x1 > 80,
      '瀑布在钟塔影轴 x78..80 外(北望不被塔挡)');
  /* ② TIDEA-06(W-06, ADR-0011 决策 6c) 南门回程件: 现成 signpost 落南
      主路终端段 + 灯复用既有(零新增)+npc/锚避让; 栅栏桩契约归需求清单 */
  const home = t.scatter.find((s) => s.id === 'signpost-home');
  assert.ok(home && home.kind === 'signpost', '南门回程件 signpost-home 在册(现成 kind)');
  assert.ok(home.z >= 119 && home.z <= 127 && (home.x <= 75 || home.x >= 81),
      'signpost-home 落南主路终端段路侧(z119..127, 回程触发线前最后视觉件)');
  assert.ok(t.scatter.some((s) => s.id === 'lamp-end-south' && s.x === 79 && s.z === 119),
      '南门灯=既有 lamp-end-south(79,119) 坪芯复用(零新增灯)');
  for (const w of npcs) {
    assert.ok(cheb(home.x, home.z, w) >= 2, 'signpost-home 距 npc 站位切比 ≥2');
  }
  for (const a of t.anchors) {
    assert.ok(cheb(home.x, home.z, a) >= 2, 'signpost-home 距导览锚切比 ≥2');
  }
  /* ③ TIDEA-07(W-07) 镇徽+主轴花带: plaza 条目双字段——徽 4×4 全嵌
      main-south 路面且 spawn 落域内(落地低头第一眼); 花带 x79..80 两列
      全格在广场/路域·零压脚印·贴塔足; 徽与带互斥 */
  const plaza = t.ground.find((g) => g.id === 'plaza-paving');
  assert.ok(plaza.emblem && plaza.axisBloom, 'plaza 条目带 emblem/axisBloom 字段(TIDEA-07 契约)');
  const em = plaza.emblem;
  const mainS = t.roads.find((r) => r.id === 'main-south');
  assert.ok(em.x1 >= mainS.x1 && em.x2 <= mainS.x2 && em.z1 >= mainS.z1 && em.z2 <= mainS.z2,
      '镇徽域全嵌 main-south 路面(嵌路不嵌草)');
  assert.strictEqual((em.x2 - em.x1 + 1) * (em.z2 - em.z1 + 1), 16, '镇徽恰 4×4');
  const spawn = t.anchors.find((a) => a.id === 'spawn');
  assert.ok(spawn.x >= em.x1 && spawn.x <= em.x2 && spawn.z >= em.z1 && spawn.z <= em.z2,
      'spawn 落在镇徽域内(白闪落地低头第一眼脚下)');
  const ab = plaza.axisBloom;
  assert.ok(ab.x2 - ab.x1 + 1 <= 2, '花带宽 ≤2(细地毯带)');
  assert.ok(!overlapXZ(em, ab), '镇徽与花带域不相交');
  const foots = t.prefab.map((p) => c.PrefabKit.footOf(p.id, p.x, p.y, p.z,
      Object.assign({}, p.v, {face: p.face})));
  for (let z = ab.z1; z <= ab.z2; z++) {
    for (let x = ab.x1; x <= ab.x2; x++) {
      const inPlaza = x >= t.plaza.x1 && x <= t.plaza.x2 && z >= t.plaza.z1 && z <= t.plaza.z2;
      const inRoad = t.roads.some((r) => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);
      assert.ok(inPlaza || inRoad, '花带格 (' + x + ',' + z + ') 在广场/路域内');
      assert.ok(!foots.some((f) => x >= f.x1 && x <= f.x2 && z >= f.z1 && z <= f.z2),
          '花带格 (' + x + ',' + z + ') 不压建筑脚印');
    }
  }
  const towerIdx = t.prefab.findIndex((p) => p.id === 'tower-belfry');
  assert.ok(ab.z1 > foots[towerIdx].z2, '花带不压钟塔足印(北端贴足=直抵塔前台阶)');
  /* ④ TIDEA-09(W-09) stash 寻宝记号: 顶层 tidea 命名空间键(pfMerge v 键
      集守门故不入 v)——挂灯契约+地面 chevron 4 圆石, tiles 全约束复算 */
  const hut = t.prefab.find((p) => p.id === 'stash-hut');
  assert.ok(hut.tidea && hut.tidea.porchLamp, 'stash-hut tidea.porchLamp 挂灯契约在');
  assert.strictEqual(hut.tidea.porchLamp.dx, 2, '挂灯门洞上方居中(门朝东 dx+2)');
  assert.ok(hut.tidea.groundMark && hut.tidea.groundMark.tiles.length === 4,
      '地面 chevron 恰 4 圆石(W-09 放射箭头)');
  const gmAbs = hut.tidea.groundMark.tiles.map((tl) => ({x: hut.x + tl.dx, z: hut.z + tl.dz}));
  const curbLines = t.roads.map((r) => {
    const ax = (r.x2 - r.x1) >= (r.z2 - r.z1);
    return ax ?
        [{x1: r.x1, z1: r.z1 - 1, x2: r.x2, z2: r.z1 - 1},
          {x1: r.x1, z1: r.z2 + 1, x2: r.x2, z2: r.z2 + 1}] :
        [{x1: r.x1 - 1, z1: r.z1, x2: r.x1 - 1, z2: r.z2},
          {x1: r.x2 + 1, z1: r.z1, x2: r.x2 + 1, z2: r.z2}];
  }).flat();
  const inAnyB = (x, z, bs) => bs.some((b) => x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2);
  for (const g of gmAbs) {
    assert.ok(!inAnyB(g.x, g.z, foots), '记号格 (' + g.x + ',' + g.z + ') 不压脚印(埋室足印实测避开)');
    assert.ok(!inAnyB(g.x, g.z, curbLines), '记号格 (' + g.x + ',' + g.z + ') 不压缘石线');
    assert.ok(!(g.z >= 29 && g.z <= 31), '记号格 (' + g.x + ',' + g.z + ') 不入空隙带');
    for (const w of npcs) {
      assert.ok(cheb(g.x, g.z, w) >= 2, '记号格 (' + g.x + ',' + g.z + ') 距 npc 切比 ≥2');
    }
    for (const a of t.anchors) {
      if (a.id !== 'stash') {
        assert.ok(cheb(g.x, g.z, a) >= 2, '记号格距锚 ' + a.id + ' 切比 ≥2');
      }
    }
    for (const s of t.scatter) {
      assert.ok(!(s.x === g.x && s.z === g.z), '记号格与散布 ' + s.id + ' 不同格');
    }
  }
  /* ⑤ TIDEA-04 前半(W-04①) 丰收角: farm-a harvest 域 ⊆ 田域·4×4·风车侧;
      域内非埂行强制 45 的派生几何归需求清单, 数据侧钉开关与落域 */
  const fa = t.ground.find((g) => g.id === 'farm-a');
  assert.ok(fa.harvest, 'farm-a 带 harvest 字段(TIDEA-04 前半契约开关)');
  const hv = fa.harvest;
  assert.ok(hv.x1 >= fa.x1 && hv.x2 <= fa.x2 && hv.z1 >= fa.z1 && hv.z2 <= fa.z2,
      '丰收角域 ⊆ farm-a(格色 override 零几何变化)');
  assert.strictEqual((hv.x2 - hv.x1 + 1) * (hv.z2 - hv.z1 + 1), 16, '丰收角恰 4×4');
  const wm = t.prefab.find((p) => p.id === 'windmill-tower');
  assert.ok(wm.x < fa.x1 && hv.x1 === fa.x1, '丰收角贴 farm-a 西缘(风车侧, W-04 语义)');
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
