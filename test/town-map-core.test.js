'use strict';
/* 城镇布局纯核心单测(镜像 js/town-map-core.js) — node --test(零依赖)
   运行: node --test test/town-map-core.test.js
   T-MAP-01 红测(可执行规格, 票: docs/town-architecture-design.md §11 行 T-MAP-01):
   vm 装载链 config→voxel→scene-kit→prefab-kit→town-map-core(prefab-kit.test.js
   同款手法, 词法 const 桥 globalThis)。规格锚 = docs/town-map-design.md §3-§4(布局
   权威)+ docs/design/town-prefab-specs.md §3(件库映射)+ §4.9(cache-cellar 覆写)。
   断言组: ①门面/结构 ②规模口径(~96×96 核心/28×28 广场/主路 4-5 支路 2-3)
   ②b beyond 白名单自检(ADR-0013 五段钉死·⊆世界界·贴界越界·判据面采样)
   ③六分区
   方位语义 ④Prefab 实例清单映射(P0/P1 全入=七新行+under-room 复用+摊位 6; board-pool
   PO 推迟不列) ⑤脚印合法(footOf 校验·⊆核心区∪beyond·体量域·分区归属) ⑥实例两两无交
   ⑦路网(厚度域·贴广场连通·不压建筑·门前可达) ⑧地表分类(广场铺装/农田成组)
   ⑧b town-rim 防坠墙圈(segs 十六段逐件 pin·开口净空·互证 rim-* ⊇ segs·红线)
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
      '({TOWN_MAP, townBuildSteps, PrefabKit, TOWN_NPC_ANCHORS, WORLD_W, WORLD_D, WORLD_H,' +
      ' worldCells})', eng);
}

/* ---- 几何小工具: xz 闭区间矩形(闭盒)的交/隙 ---- */
const overlapXZ = (a, b) => a.x1 <= b.x2 && b.x1 <= a.x2 && a.z1 <= b.z2 && b.z1 <= a.z2;
const gapXZ = (a, b) => {/* 盒间空隙格数: 相交=0 · 边相邻=0 · 隔 n 空格=n(切比雪夫) */
  return Math.max(a.x1 - b.x2 - 1, b.x1 - a.x2 - 1, a.z1 - b.z2 - 1, b.z1 - a.z2 - 1, 0);
};
const center = (a, b) => (a + b) / 2; /* 闭域中心 */
const spanOf = (a, b) => b - a + 1; /* 闭域跨度 */
/* beyond 白名单判据(ADR-0013, 方案 §2.2; 本文件单份, 不散写第二份几何):
   盒 ⊆ core 或 ⊆ beyond 某段(闭盒整数坐标语义)。beyond 未落时退化为
   core 严判——红态=越界样本被拒(T0 判据先行票的红形态) */
const inCoreOrBeyond = (t, box) => {
  if (box.x1 >= t.core.x1 && box.x2 <= t.core.x2 && box.z1 >= t.core.z1 &&
      box.z2 <= t.core.z2) return true;
  return (t.beyond || []).some((b) =>
    box.x1 >= b.x1 && box.x2 <= b.x2 && box.z1 >= b.z1 && box.z2 <= b.z2);
};

/* ============ ① 门面与结构 ============ */

test('门面: TOWN_MAP 十段数据权威 + townBuildSteps 纯函数出口', () => {
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

/* ============ ②b beyond 白名单自检(ADR-0013, 方案 §2.1/§2.2) ============ */

test('beyond 自检: 五段显式闭域一次立全 · ⊆ 世界界 · 贴界越界(防域飞出)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  /* beyond 不是通行证(ADR-0013 准入语义): 每段=一件有正当语义的越界件
     声明域——②门楼+基座桥=回程缓冲带服务面 / ③墙圈=防坠功能件;
     加段须先过判据, 不收「散写越界」(方案 §2.3) */
  assert.ok(Array.isArray(t.beyond), 'beyond 白名单域在册(TOWN_MAP 顶层段)');
  const segs = [...t.beyond]; /* vm 数组先归化本 realm(③分区同款手法) */
  assert.strictEqual(segs.length, 5, 'beyond 恰五段(一次立全, 方案 §2.1)');
  assert.deepStrictEqual(segs.map((b) => b.id).sort(),
      ['gate-south', 'rim-east', 'rim-skirt', 'rim-south', 'rim-west'],
      '段 id 恰五个: 门楼缓冲带 1 段+墙圈 4 段');
  /* 逐段坐标钉死(闭域整数坐标, 方案 §2.1): 白名单=判据权威, 动坐标必须
     连判据面一起过票(N5 防第二份几何的字面落点) */
  const byId = Object.fromEntries(segs.map((b) => [b.id, b]));
  const pin = (id, x1, z1, x2, z2) => {
    const b = byId[id];
    assert.ok(b, '段「' + id + '」在册');
    assert.deepStrictEqual([b.x1, b.z1, b.x2, b.z2], [x1, z1, x2, z2],
        '段「' + id + '」坐标(闭域)=' + JSON.stringify([x1, z1, x2, z2]));
  };
  pin('gate-south', 75, 128, 81, 131); /* ②门楼+基座桥域(含檐口出挑 x75/x81) */
  pin('rim-south', 32, 128, 127, 128); /* ③南缘墙线 z128 行(开口段含于域) */
  pin('rim-west', 31, 32, 31, 128); /* 西缘墙线(含接头柱 z32..33 与南角) */
  pin('rim-east', 128, 32, 128, 128); /* 东缘墙线(同上, 闭南角) */
  pin('rim-skirt', 16, 29, 143, 31); /* 裙板翼墙+端头墩域(实际写入仅翼段) */
  for (const b of segs) {
    assert.ok(Number.isInteger(b.x1) && Number.isInteger(b.z1) &&
        Number.isInteger(b.x2) && Number.isInteger(b.z2) &&
        b.x1 <= b.x2 && b.z1 <= b.z2, '段「' + b.id + '」闭域良序(整数坐标)');
    assert.ok(b.x1 >= 0 && b.x2 < c.WORLD_W && b.z1 >= 0 && b.z2 < c.WORLD_D,
        '段「' + b.id + '」⊆ 世界界(160×160)');
    /* 贴界(方案 §2.2「与 core 交集逐段非空」的闭域离散读法): gapXZ=0=
       相交或边相邻——段必须贴着 core 界, 不许悬空飞出 */
    assert.ok(gapXZ(b, t.core) === 0,
        '段「' + b.id + '」贴 core 界(相交或边相邻, 防域飞出)');
    assert.ok(b.x1 < t.core.x1 || b.x2 > t.core.x2 ||
        b.z1 < t.core.z1 || b.z2 > t.core.z2,
    '段「' + b.id + '」有出界部分(越界域非空, 不是 core 内改名)');
  }
});

test('beyond 判据面: inCoreOrBeyond 单份判据(core∪beyond 闭盒 ⊆ 语义采样)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const box = (x1, z1, x2, z2) => ({x1, z1, x2, z2});
  /* 基线语义不回退: core 内样本恒真 */
  assert.ok(inCoreOrBeyond(t, box(40, 40, 45, 45)), 'core 内样本放行');
  /* 界外远样本(缓冲带以南悬空域): 严判拒绝——白名单不是通行证 */
  assert.ok(!inCoreOrBeyond(t, box(76, 135, 80, 136)), '界外远样本拒绝');
  /* 部分压 beyond 段但溢出段的盒: 判据=⊆ 某段, 不是相交 */
  assert.ok(!inCoreOrBeyond(t, box(74, 128, 76, 129)), '溢段样本拒绝(闭盒 ⊆ 语义)');
  /* beyond 五段逐段采样(几何未落时现判据拒绝=红; beyond 段落地后转绿):
     断言只依赖 TOWN_MAP.beyond 本体, 不依赖消费方几何(T1a/T2 未上) */
  assert.ok(inCoreOrBeyond(t, box(76, 129, 80, 131)), '门楼缓冲带样本放行(gate-south)');
  assert.ok(inCoreOrBeyond(t, box(32, 128, 127, 128)), '南缘墙线样本放行(rim-south)');
  assert.ok(inCoreOrBeyond(t, box(31, 100, 31, 100)), '西缘墙线样本放行(rim-west)');
  assert.ok(inCoreOrBeyond(t, box(128, 64, 128, 64)), '东缘墙线样本放行(rim-east)');
  assert.ok(inCoreOrBeyond(t, box(70, 30, 70, 30)), '裙板墩域样本放行(rim-skirt)');
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
  assert.strictEqual(far.reachable, true,
      '远景层随山体波可达(南缘走廊+裙板落位, PO 亲需①②)');
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

test('实例映射: P0/P1 全入+under-room 复用 · 波次二五件转正(board-pool 解禁落位)', () => {
  const c = loadCore();
  const ps = c.TOWN_MAP.prefab;
  const ids = [...new Set(ps.map((p) => p.id))].sort();
  assert.deepStrictEqual(ids, ['board-pool', 'clothesline', 'cottage-gable',
    'hencoop', 'house-loft', 'iron-golem', 'scarecrow', 'shop-awning',
    'stall-canopy', 'stash-hut', 'tower-belfry', 'town-gate', 'under-room',
    'windmill-tower', 'woodpile'],
  '实例 id 恰十五种: 七新行 + under-room(复用) + 波次二五件 + PO 亲需铁傀儡全身像 + ②镇侧门楼(T1a)');
  /* town-gate(T1a ②镇侧门楼落行, spec §2.6 候选行逐字): 锚 (76,24,128) 面
     北 zone south(缓冲带服务面, 越带注记豁免归 ⑤), v 素坯空对象 */
  const gates = ps.filter((p) => p.id === 'town-gate');
  assert.strictEqual(gates.length, 1, 'town-gate 恰一处(回程轴唯一正门)');
  /* v 经展开拷贝摊平进宿主域再断言(conventions §7.1 摊平门面: vm 域对象
     与宿主对象原型不同 realm, deepStrictEqual 直比必假红——本行逐字断言
     的 v 是唯一对象字段, 其余皆标量直取) */
  assert.deepStrictEqual(
      {id: gates[0].id, x: gates[0].x, y: gates[0].y, z: gates[0].z,
        v: {...gates[0].v}, face: gates[0].face, zone: gates[0].zone},
      {id: 'town-gate', x: 76, y: 24, z: 128, v: {}, face: 'north', zone: 'south'},
      'town-gate 行=spec §2.6 候选行逐字(锚 76,24,128 · face north 牌面朝北 · zone south)');
  assert.strictEqual(ps.filter((p) => p.id === 'board-pool').length, 1,
      'board-pool 波次二转正落位(scene-plan-tidea2 problems=0, 动骨架-轻)');
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
    /* 山域豁免(PO 山体波): far-north 雕像落核心区外山域(头版山肩面
        y41/全身像山脚裙板嵌面 y25), 不走镇区地面基高; 锚点亦在核心区外 */
    assert.ok(p.y === core.groundY || p.zone === 'far-north',
        '实例 ' + p.id + ' 锚 y=地面基高(山域件=山肩/山脚锚)');
    assert.ok(['north', 'east', 'south', 'west'].includes(p.face),
        'face ∈ 四正交向(' + p.face + ')');
    assert.ok(p.v && typeof p.v === 'object' && !Object.prototype.hasOwnProperty.call(p.v, 'ids'),
        'v 无材质 ids 槽(集中注入归 T-MAP-03 town-palette, 本票纯几何计划)');
    /* 判据扩 beyond(ADR-0013, 方案 §2.2 行 2): town-gate 行锚 z128 将落
        南缓冲带服务面(T1a 落行后经 beyond.gate-south 放行); helper 单份 */
    assert.ok(p.zone === 'far-north' ||
        inCoreOrBeyond(c.TOWN_MAP, {x1: p.x, x2: p.x, z1: p.z, z2: p.z}),
    '锚点 ⊆ 核心区∪beyond(山域件归 far-north 域)');
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
    'windmill-tower': {min: 6, max: 6, y: [11, 11]}, /* 塔体 6×6 高 11(sailStatic=false 拆叶口径: 叶归 mesh 不入 foot, 锥尖 dy10) */
    /* 民居 A 8×7 高 7(v2 双坡+阶梯山墙, checkpoint 批准几何升级;
       旧值 6 见 map-design §4.2, 被总纲 §3 G 取代) */
    'cottage-gable': {min: 7, max: 8, y: [7, 7]},
    'house-loft': {min: 8, max: 10, y: [8, 9]}, /* 民居 B 10×8 高 8-9 */
    /* 摊位 3×2~4×3 高 4-5(Step D 双层阶梯顶几何升级+1, §3 G 规格驱动,
       cottage 先例核准几何升级压文档; 旧值 3-4 见 map-design §4.2,
       漂移登记 arch 回执) */
    'stall-canopy': {min: 2, max: 4, y: [4, 5]},
    'under-room': {min: 3, max: 12, y: null}, /* 埋室形状随 v(半宽/出路), 只验界内 */
    /* 波次二五件(TIDEA-04/08/10, footOf 实测: 稻草人 3×1×3/晾衣绳 5×1×3/
       柴堆 3×1×2/鸡窝 2×2×3/跳板池 4×10~5×13 高 7 旗顶) */
    'scarecrow': {min: 1, max: 3, y: [3, 3]},
    'clothesline': {min: 1, max: 5, y: [3, 3]},
    'woodpile': {min: 1, max: 3, y: [2, 2]},
    'hencoop': {min: 2, max: 2, y: [3, 3]},
    'board-pool': {min: 4, max: 13, y: [7, 7]},
    /* PO 亲需③铁傀儡全身像(footOf 实测: 基座/肩 9 宽×背 dz-2 到鼻凸
       dz+1 → 面向跨 4×9, 高 18) */
    'iron-golem': {min: 4, max: 9, y: [18, 18]},
    /* ②镇侧门楼(T1a, footOf 实测: 檐口出挑 x75..81 宽 7 × 桥深 z128..131
       4 × 桥底 y20 到屋脊 y33 高 14——恒等 north 单形制无旋转变体) */
    'town-gate': {min: 4, max: 7, y: [14, 14]},
  };
  for (const p of t.prefab) {
    const v = Object.assign({}, p.v, {face: p.face}); /* face 并入 v = 装配形 */
    const box = c.PrefabKit.footOf(p.id, p.x, p.y, p.z, v); /* 零写纯查询=校验器 */
    assert.ok(box.x1 <= box.x2 && box.z1 <= box.z2 && box.y1 <= box.y2, '盒良序');
    /* 山域豁免(PO 山体波): far-north 雕像落核心区外北侧山域(z<32,
        山肩/山脚裙板), 核心区断言只对核心区内件生效; far-north 件归分区
        断言管(域 x0..159 z0..31——全身像盒 z28..31 ⊆ 此界) */
    /* 判据扩 beyond(ADR-0013, 方案 §2.2 行 1): town-gate 脚印(含基座桥
        z128..131)将越 core 南界, 经 beyond.gate-south 放行(T1a 落行后
        生效; 几何未落时对本批既有件判据恒等, 空转不红) */
    assert.ok(p.zone === 'far-north' || inCoreOrBeyond(t, box),
        '脚印 ⊆ 核心区∪beyond(' + p.id + ')');
    assert.ok(box.y1 >= 0 && box.y2 <= c.WORLD_H - 1, 'y ⊆ 世界高(' + p.id + ')');
    const z = byId[p.zone];
    assert.ok(z, 'zone「' + p.zone + '」在分区清单');
    /* town-gate 注记豁免(方案 §2.2 行 3/§2.3): zone 归 'south'(带 z2=127)
        而脚印 z128..131 越带 1 格=南缓冲带服务面(锚=带外服务面的自然
        延伸, beyond 注释同源); 不新开 zone 不动六带设计权威(map-design
        §4.1)。越界放行由「脚印 ⊆ 核心区∪beyond」判据承担(T1a 落行生效) */
    assert.ok(p.id === 'town-gate' ||
        (box.x1 >= z.x1 && box.x2 <= z.x2 && box.z1 >= z.z1 && box.z2 <= z.z2),
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
  /* town-gate 精确盒(T1a 门楼专项前置): 脚印=几何权威 footOf 的恒等 north
     投影, 精确=beyond.gate-south 域(x75..81 × z128..131) */
  const gate = t.prefab.find((p) => p.id === 'town-gate');
  assert.ok(gate, 'town-gate 行在册(T1a 落行后转绿; 红态=行未加)');
  const gateBox = c.PrefabKit.footOf(gate.id, gate.x, gate.y, gate.z,
      Object.assign({}, gate.v, {face: gate.face}));
  assert.deepStrictEqual({...gateBox}, {x1: 75, y1: 20, z1: 128, x2: 81, y2: 33, z2: 131},
      'town-gate 脚印精确盒(檐口出挑 x75/x81 · 桥垫层 y20..24 · 总高 y33)');
  const gateSeg = t.beyond.find((b) => b.id === 'gate-south');
  assert.ok(gateBox.x1 >= gateSeg.x1 && gateBox.x2 <= gateSeg.x2 &&
      gateBox.z1 >= gateSeg.z1 && gateBox.z2 <= gateSeg.z2,
  'town-gate 脚印 ⊆ beyond.gate-south(ADR-0013 白名单放行, 越界唯一通道)');
  assert.ok(gateBox.z2 <= 131,
      'town-gate 几何 z≤131 全在回程判据内侧(ADV_TOWN_RETURN_Z=132 之前, 判据行为面零改动前提)');
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

/* ============ ⑥' 门楼专项(T1a, spec §2.7 锚 3 的蓝图世界面) ============ */

test('town-gate 门楼专项: z129 墙身平面逐行 · 净空 x77..79×y25..27 · 桥面 y24 与 core 草地同高 · 牌格 (78,29,129)=80', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const g = t.prefab.find((p) => p.id === 'town-gate');
  assert.ok(g, 'town-gate 行在册(T1a 落行后转绿; 红态=行未加)');
  /* 蓝图落场(TOWN_MAP 行锚直驱, face north=行 facing0 恒等): 清空世界单件
     落位, 断言不掺地表/散布笔——纯蓝图几何世界面 */
  c.worldCells.fill(0);
  c.PrefabKit.place(g.id, g.x, g.y, g.z, Object.assign({}, g.v, {face: g.face}));
  const cell = (x, y, z) => c.worldCells[(y * c.WORLD_D + z) * c.WORLD_W + x];
  /* z129 墙身平面: 侧柱 x76/x80 y25..29(壁灯 y27 嵌柱替换)/横梁 y28/
     门额带 y29(牌居中+配块两翼)/柱头 y30+中段让空(v2 同构) */
  for (const x of [76, 80]) {
    for (const y of [25, 26, 28, 29]) {
      assert.strictEqual(cell(x, y, 129), 13, '侧柱 13 @(' + x + ',' + y + ',129)');
    }
    assert.strictEqual(cell(x, 27, 129), 19, '壁灯 19 嵌柱 @(' + x + ',27,129)');
    assert.strictEqual(cell(x, 30, 129), 17, '柱头 17 @(' + x + ',30,129)');
  }
  for (const x of [77, 78, 79]) {
    for (const y of [25, 26, 27]) {
      assert.strictEqual(cell(x, y, 129), 0, '净空空气 @(' + x + ',' + y + ',129)');
    }
    assert.strictEqual(cell(x, 28, 129), 13, '横梁 13 @(' + x + ',28,129)');
    assert.strictEqual(cell(x, 30, 129), 0, '中段让空 @(' + x + ',30,129)');
  }
  assert.strictEqual(cell(77, 29, 129), 13, '门额配块 13 @(77,29,129)');
  assert.strictEqual(cell(78, 29, 129), 80, '门额牌 80 @(78,29,129)(居中 1 格, 贴图朝北归 T1b)');
  assert.strictEqual(cell(79, 29, 129), 13, '门额配块 13 @(79,29,129)');
  /* 桥面 y24 与 core 草地同高(spec §2.2: 无缝衔接=同层) */
  assert.strictEqual(t.core.groundY, 24, 'core 草地层 y24(同高语义锚)');
  for (let x = 76; x <= 80; x++) {
    for (let z = 128; z <= 131; z++) {
      assert.strictEqual(cell(x, 24, z), 13, '桥面 13 @(' + x + ',24,' + z + ')');
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
    /* 陈设件豁免(波次二): scarecrow/clothesline/woodpile/hencoop/board-pool
       是贴建筑/田内/彩蛋带的叙事物, 可达性由所属建筑与既有路网承担,
       「门前可达」仅辖独立建筑; 山域件(far-north 雕像)可达性由攀登
       走廊承担(PO 山体波), 不辖路网 */
  const PROPS = ['scarecrow', 'clothesline', 'woodpile', 'hencoop', 'board-pool'];
  /* 出镇门楼豁免(GATE 注记, 方案 §2.2 行 4/spec §2.7 预注): town-gate=
     动线终点仪式件, 可达性由 main-south 轴线 x76..80 直连承担, 路口
     距离断言不适用(T1a 落行后生效; 几何未落时豁免名单空转不红) */
  const GATE = ['town-gate'];
  for (const {p, b} of boxes) {
    for (const r of t.roads) {
      assert.ok(!overlapXZ(b, r), '道路不压建筑: ' + r.id + ' × ' + p.id);
    }
    if (p.zone !== 'hub' && p.zone !== 'far-north' &&
        !PROPS.includes(p.id) && !GATE.includes(p.id)) {/* 广场内建筑(塔/摊)立于铺装上, 可达性由广场承担 */
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
    /* 判据扩 beyond(ADR-0013, 方案 §2.2 行 5): town-rim 条目(③墙圈, T2
       落条目)主域=segs 显式分段清单——逐 seg 判 ⊆∪beyond; 其余地表条目
       维持 ⊆core 严判(几何未落时本批既有条目全走严判分支, 空转不红) */
    if (g.kind === 'town-rim') {
      for (const seg of g.segs) {
        assert.ok(inCoreOrBeyond(t, seg),
            'town-rim seg ⊆ 核心区∪beyond(' + g.id + ':' + (seg.part || 'seg') + ')');
      }
    } else {
      assert.ok(g.x1 >= t.core.x1 && g.x2 <= t.core.x2 && g.z1 >= t.core.z1 && g.z2 <= t.core.z2,
          '地表条目 ⊆ 核心区(' + g.id + ')');
    }
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

/* ============ ⑧b town-rim 防坠墙圈(T2, spec §3.3 块级规格逐件 pin) ============ */

/* segs 逐段规格(spec §3.3 坐标表的测试侧独立字面量转录, 防漂移)。
   翼墙/端头墩 y 域裁定注(T2 票内发现): spec 坐标列写 y26..27, 前提是
   「立裙板顶 y25 上」——但裙板在翼/墩列(x16..30/x129..143/x16/x143)的
   实测列顶=24(拱形端点; 下方裙板合脊测试 skTop(16)=24 与 dims 世界层
   断言 (16,24,30)=14 同证), 中带 x35..124 才是 25; 按 y26..27 落将浮空
   1 格, 违同表说明列「墩脚=裙板实底,不落虚空」与垫层行「剖面不悬空」
   纪律。按 spec 相对定义「立裙板顶上 2 格」换算实测地形 → y25..26
   (2 格高/封口/防登数学不变, spec §4 体量表 60+12=72 格不变)。提请
   design-lead 走查终审; 若裁回绝对值 26..27, 改本清单与 segs 各一行。 */
const RIM_SEGS_WANT = [
  /* 墙基垫层 pad: y24 单层 13, 南段两截避门楼开口 x76..80(T1a 桥域) */
  'pad:32,128..75,128#24..24', 'pad:81,128..127,128#24..24',
  'pad:31,32..31,128#24..24', 'pad:128,32..128,128#24..24',
  /* 墙身 wall: y25..26 两格 13; 东西缘 z32..128(闭南角, 止于 127 会对角
     缺口+柱帽悬空——spec §3.3 东西缘行说明) */
  'wall:32,128..75,128#25..26', 'wall:81,128..127,128#25..26',
  'wall:31,32..31,128#25..26', 'wall:128,32..128,128#25..26',
  /* 北端接头柱 post: y25..27 三格无帽(防自裙板登脊) */
  'post:31,32..31,33#25..27', 'post:128,32..128,33#25..27',
  /* 南角柱帽 cap: y27 石英(北端接头格故意不加帽) */
  'cap:31,128..31,128#27..27', 'cap:128,128..128,128#27..27',
  /* 裙板翼墙 wing: z31 行 y25..26(立实测裙板顶 24 上 2 格, 见上注) */
  'wing:16,31..30,31#25..26', 'wing:129,31..143,31#25..26',
  /* 北缘端头墩 pier: x16/x143 列 z29..31 y25..26(同上) */
  'pier:16,29..16,31#25..26', 'pier:143,29..143,31#25..26',
].sort();
const rimSegKey = (s) => s.part + ':' + s.x1 + ',' + s.z1 + '..' + s.x2 + ',' +
  s.z2 + '#' + s.y1 + '..' + s.y2;

test('town-rim 条目: segs 十六段一次立全(spec §3.3 逐件 pin) · 开口段 x76..80 净空 · 闭南角实接 · 互证 rim-* ⊇ 各 seg', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const rims = t.ground.filter((g) => g.kind === 'town-rim');
  assert.strictEqual(rims.length, 1, 'town-rim 条目恰一条(几何权威单源)');
  const rim = rims[0];
  assert.strictEqual(rim.id, 'town-rim', '条目 id=town-rim');
  assert.ok(Array.isArray(rim.segs) && rim.segs.length === 16,
      'segs 显式分段清单恰十六段(垫层4+墙身4+接头柱2+柱帽2+翼墙2+端头墩2)');
  for (const s of rim.segs) {
    assert.ok(['pad', 'wall', 'post', 'cap', 'wing', 'pier'].includes(s.part),
        'seg part ∈ pad/wall/post/cap/wing/pier(实得 ' + (s.part || '缺') + ')');
    assert.ok(Number.isInteger(s.x1) && Number.isInteger(s.x2) &&
        Number.isInteger(s.z1) && Number.isInteger(s.z2) &&
        Number.isInteger(s.y1) && Number.isInteger(s.y2) &&
        s.x1 <= s.x2 && s.z1 <= s.z2 && s.y1 <= s.y2,
    'seg 坐标良序闭域(' + rimSegKey(s) + ')');
    /* 回程触发线内侧(硬红线): 几何全在 z≤131, 触发线 z132 不设任何新块 */
    assert.ok(s.z2 <= 131, 'seg ⊆ z≤131(触发线 z132 内侧: ' + rimSegKey(s) + ')');
    /* 北缘不开墙(PO 亲需可达线): core 北界线 z32 行 x32..127 不闭 */
    const northWall = s.z1 <= 32 && s.z2 >= 32 && s.x1 <= 127 && s.x2 >= 32;
    assert.ok(!northWall, 'seg 不闭北缘 z32 行(' + rimSegKey(s) + ')');
    /* 登北山走廊零连累: 攀登走廊列 x60..61 及其裙板进深 z28..31 不落块 */
    const corrHit = s.x1 <= 61 && s.x2 >= 60 && s.z1 <= 31 && s.z2 >= 28;
    assert.ok(!corrHit, 'seg 不入登北山走廊域 x60..61×z28..31(' + rimSegKey(s) + ')');
    /* rim 走道保留(spec §3.4): z29..30 两行 x17..142 零 rim 落块(端头墩
       柱位 x16/x143 豁免=spec 端头封口) */
    const walkHit = s.z1 <= 30 && s.z2 >= 29 && s.x1 <= 142 && s.x2 >= 17;
    assert.ok(!walkHit, 'seg 不占 rim 走道 z29..30 行(' + rimSegKey(s) + ')');
  }
  /* 逐段 pin(集合相等不拘清单序); vm 域数组先展开归化宿主域再比
     (conventions §7.1: 跨 realm 原型 deepStrictEqual 必炸, 打印全同仍 fail) */
  const segKeys = [...rim.segs].map(rimSegKey).sort();
  assert.deepStrictEqual(segKeys, RIM_SEGS_WANT,
      'segs 逐段表=spec §3.3(part:x,z..x,z#y..y)');
  /* 门楼开口净空(硬红线): x76..80×z128 归 T1a 门楼/基座桥, 本票显式排除 */
  for (const s of rim.segs) {
    const hitOpen = s.x1 <= 80 && s.x2 >= 76 && s.z1 <= 128 && s.z2 >= 128;
    assert.ok(!hitOpen, 'seg 不入开口段 x76..80(' + rimSegKey(s) + ')');
  }
  /* 闭南角实接(spec §3.3 东西缘行): 墙身两缘 seg 止于 z128 */
  const wallAt = (x, z) => rim.segs.some((s) => s.part === 'wall' &&
      s.x1 <= x && s.x2 >= x && s.z1 <= z && s.z2 >= z);
  assert.ok(wallAt(31, 128) && wallAt(128, 128),
      '东西缘墙身实接南角 (31,128)/(128,128)');
  assert.ok(wallAt(31, 32) && wallAt(128, 32), '东西缘墙身北端起 z32');
  /* 接头柱恰两根三格无帽; 柱帽恰两枚只在南角 y27(spec §3.3) */
  /* [...segs] 先归化宿主域(§7.1 跨 realm 原型, 同上) */
  const shape = (part) => [...rim.segs].filter((s) => s.part === part)
      .map((s) => [s.x1, s.z1, s.x2, s.z2, s.y1, s.y2])
      .sort((a, b) => a[0] - b[0]); /* 首格数值序(默认 sort 按字符串序, 128 会排在 31 前) */
  assert.deepStrictEqual(shape('post'),
      [[31, 32, 31, 33, 25, 27], [128, 32, 128, 33, 25, 27]],
      '北端接头柱恰两根 (31/128, z32..33) y25..27 无帽(防登墙)');
  assert.deepStrictEqual(shape('cap'),
      [[31, 128, 31, 128, 27, 27], [128, 128, 128, 128, 27, 27]],
      '南角柱帽恰两枚 (31,128)/(128,128) y27(北端故意不加帽)');
  /* 互证 rim-* ⊇ town-rim 各 seg(ADR-0013 待办随本票补=T0 ②b 遗留):
     白名单 ⊇ 实际几何, 几何第二份防御 */
  for (const s of rim.segs) {
    const host = (t.beyond || []).find((b) => b.id.indexOf('rim-') === 0 &&
        s.x1 >= b.x1 && s.x2 <= b.x2 && s.z1 >= b.z1 && s.z2 <= b.z2);
    assert.ok(host, '互证: seg ⊆ beyond.rim-*(seg=' + rimSegKey(s) + ')');
    assert.ok(inCoreOrBeyond(t, s),
        '⑧判据复跑: seg ⊆ 核心区∪beyond(' + rimSegKey(s) + ')');
  }
});

test('town-rim 红线: 散布零连累(花不入 scatter) · U4 townProtectedAt 不落 · modes/adventure.js 零触碰', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  /* 散布零连累(硬红线): 墙头花走 town-rim 派生不入 scatter——散布清单
     无任何条目落墙线域(x≤31/x≥128/z≥128), ⑩ ⊆core 严判维持 */
  for (const s of t.scatter) {
    assert.ok(s.x >= 32 && s.x <= 127 && s.z >= 32 && s.z <= 127,
        '散布维持 ⊆core(墙头花不入 scatter: ' + s.id + ')');
  }
  /* U4 保护判据不归本票(T2b): townProtectedAt 不落——墙圈先可挖 */
  const mapSrc = fs.readFileSync(path.join(ROOT, 'js', 'town-map-core.js'), 'utf8');
  assert.ok(!mapSrc.includes('townProtectedAt'),
      'townProtectedAt 不落(U4 归 T2b 票, 本票墙圈先可挖)');
  const advSrc = fs.readFileSync(path.join(ROOT, 'js', 'modes', 'adventure.js'), 'utf8');
  assert.ok(!advSrc.includes('town-rim') && !advSrc.includes('townProtectedAt'),
      'modes/adventure.js 零触碰(回程判据行为面零改动, T2b 前无镇域接线)');
});

/* ============ ⑨ 远景剪影(map-design §4.2 R-01..03 · M7 默认) ============ */

test('远景: 拱形山体必做横贯 · 崖屋 1-2 栋 · 神庙默认不落 · 全部不可达且界内', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  for (const b of t.backdrop) {
    assert.ok(['mountain', 'cliff-home', 'scrub', 'boulder'].includes(b.kind),
        '远景 kind ∈ mountain/cliff-home/scrub/boulder(v2 山缘植被)');
    /* 山体波(PO 亲需①②): reachable 翻旗仅限两山条目(southCorridor 主山+
        裙板), 其余远景件仍不可达 */
    assert.ok(b.reachable === false ||
        (b.kind === 'mountain' && b.reachable === true),
    '远景不可达(山体波两山件例外: ' + b.id + ')');
  }
  assert.ok(!t.backdrop.some((b) => b.kind === 'temple'),
      '神庙剪影默认不落(M7 远景可选, PO 知情批次)');
  const mts = t.backdrop.filter((b) => b.kind === 'mountain');
  assert.strictEqual(mts.length, 2,
      '山体恰两处: 主山(R-01 必做)+裙板(PO 亲需①连接, z 域不重叠)');
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

test('山体波(PO 亲需①②③): 南缘走廊+裙板字段契约 · 铁傀儡全身像落山脚裙板(避走廊切列·界内·far-north 翻旗)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  /* ① 主山全键 pin(arch §12.1① 逐字): +southCorridor 后其余键零动。
      vm 对象先 JSON 归化本 realm(deepStrictEqual 比原型, 跨 realm 必红;
      probe 同款手法) */
  const arch = JSON.parse(JSON.stringify(
      t.backdrop.find((b) => b.id === 'mountain-arch')));
  assert.deepStrictEqual(arch, {id: 'mountain-arch', kind: 'mountain',
    x1: 16, z1: 8, x2: 143, z2: 28, topY: 44, bands: true,
    waterfall: {x1: 63, x2: 64}, reachable: true,
    southCorridor: {x1: 60, x2: 61}},
  'mountain-arch 全键 = §12.1①(+southCorridor·reachable:true, 其余零动)');
  /* ② 裙板逐字节 pin(arch §12.1②): z29..31 贴地拱带, 北缘紧贴主山南缘 */
  const skirt = JSON.parse(JSON.stringify(
      t.backdrop.find((b) => b.id === 'mountain-skirt')));
  assert.deepStrictEqual(skirt, {id: 'mountain-skirt', kind: 'mountain',
    x1: 16, z1: 29, x2: 143, z2: 31, topY: 25, bands: true, reachable: true},
  'mountain-skirt 逐字节 = §12.1②(贴地连接 PO 亲需①)');
  assert.strictEqual(skirt.z1, arch.z2 + 1,
      '裙板北缘紧贴主山南缘(z 域不重叠=合脊键 (x,z) 各归各)');
  /* ③ 铁傀儡全身像位姿 pin(arch §12.3.6, 选址=scene §13.7): 山脚裙板
     南向, footOf 盒避走廊切列 */
  const golem = JSON.parse(JSON.stringify(
      t.prefab.find((p) => p.id === 'iron-golem')));
  assert.deepStrictEqual(golem, {id: 'iron-golem', x: 70, y: 25, z: 30,
    v: {}, face: 'south', zone: 'far-north'},
  '铁傀儡全身像位姿 = 山脚裙板门口东侧 x70/y25/z30 南向(落位几何依据见条目注释)');
  const gb = c.PrefabKit.footOf(golem.id, golem.x, golem.y, golem.z,
      Object.assign({}, golem.v, {face: golem.face}));
  assert.ok(gb.x2 < arch.southCorridor.x1 || gb.x1 > arch.southCorridor.x2,
      '雕像足印与走廊切列 x60..61 净隔(基座不悬空于 trench, x' +
      gb.x1 + '..' + gb.x2 + ')');
  assert.ok(gb.y1 >= 0 && gb.y2 <= c.WORLD_H - 1,
      '雕像盒 ⊆ 世界高(y' + gb.y1 + '..' + gb.y2 + ', 嵌面下埋顶 y42 抵 WORLD_H=48)');
  /* far-north 翻旗(随步改条款④): 北带自剪影层转可达 */
  const fn = t.zones.find((z) => z.id === 'far-north');
  assert.strictEqual(fn.reachable, true,
      'far-north reachable:true(南缘走廊+裙板落位后北带可达)');
});

/* ============ ⑩ 散布(prefab-specs §5.1/§5.2 落位政策=调用方=本计划) ============ */

test('散布: 十类词表 · 广场樱花必备 · 不落建筑与路面 · 密度分档(实体带宽+地被下限)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  /* 视觉重制 §3 E(v2): kind 域扩十类(原四类+散布草丛/花/旗/花坛/木桶/南瓜)
     · 波次二(W-03): +立面三笔 wallflag/windowbox/crates(挂墙格位陈设) */
  const kinds = ['sakura', 'scrub', 'lamp', 'signpost', 'tuft', 'flower',
    'flag', 'flowerbed', 'barrel', 'pumpkin', 'wallflag', 'windowbox', 'crates'];
  const groundCover = ['tuft', 'flower']; /* 地被类: 全域密度档+最严避让 */
  const furniture = ['flag', 'flowerbed', 'barrel', 'pumpkin']; /* 家具类: 显式点 */
  assert.ok(t.scatter.every((s) => kinds.includes(s.kind)), '散布 kind ⊆ 十三类');
  for (const k of kinds) {
    assert.ok(t.scatter.some((s) => s.kind === k), '「' + k + '」类有落点');
  }
  /* 密度分档(v2 口径重构: 原「总数 6..24」只辖实体类时代; 地被类按
     「每 8×8/16×16 一件档」全域枚举, 数量级另立——实体类保带宽断言,
     地被类保密度下限(过滤后存量), 两档不相乘不混算) */
  const solid = t.scatter.filter((s) => !groundCover.includes(s.kind));
  const tufts = t.scatter.filter((s) => s.kind === 'tuft');
  const flowers = t.scatter.filter((s) => s.kind === 'flower');
  assert.ok(tufts.length >= 100,
      '草丛 ≥100 件(每 8×8 块 1 件档全域枚举·过滤后存量, 实得 ' + tufts.length + ')');
  assert.ok(flowers.length >= 20,
      '花 ≥20 件(每 16×16 块 1 件档, 实得 ' + flowers.length + ')');
  assert.ok(t.scatter.length <= 220, '散布总数 ≤220(性能守门, 实得 ' + t.scatter.length + ')');
  /* 波次二 +4 立面件: 实体类带宽 40→44(v2 拍板 40 恰满额) */
  assert.ok(solid.length >= 6 && solid.length <= 44,
      '实体类(非地被)散布总数 6-44(氛围密度带宽)');
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
  /* 立面三笔豁免(波次二 W-03): wallflag/windowbox/crates 是挂墙格位
       陈设(覆写墙块, 后写者赢), 有意落在建筑盒缘行=「挂墙」语义本身 */
  const FACADE = ['wallflag', 'windowbox', 'crates'];
  for (const s of t.scatter) {
    assert.strictEqual(s.y, t.core.groundY, '散布点 y=地面基高(' + s.id + ')');
    /* 镇域散布维持 ⊆core 严判(方案 §2.2 行 6 红线, 本判据不扩 beyond):
       墙头花走 town-rim 派生不入 scatter(T2), 开放通道不设白名单 */
    assert.ok(s.x >= t.core.x1 && s.x <= t.core.x2 && s.z >= t.core.z1 && s.z <= t.core.z2,
        '散布点 ⊆ 核心区(' + s.id + ')');
    if (!FACADE.includes(s.kind)) {
      for (const b of boxes) {
        assert.ok(!(s.x >= b.x1 && s.x <= b.x2 && s.z >= b.z1 && s.z <= b.z2),
            '散布不落建筑脚印(' + s.id + ' × ' + b.x1 + '~' + b.x2 + '/' + b.z1 + '~' + b.z2 + ')');
      }
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
  /* ② TIDEA-06(W-06, ADR-0011 决策 6c 预授权路径升格兑现) 南门回程件退役:
      门楼(T1a)建成后三职能整体由门楼接棒——门本身=最大指路件·壁灯接棒
      「门内灯」·门洞兑现开间(spec §2.5 升级吞并裁定); signpost-home 退役
      不在册: 散布清单无此 id·建场写序零此件·十段全域无孤儿引用;
      lamp-end-south 保留照明(服务 wayshrine 小坪非门楼专属);
      留档备选(迁 (75,124))不做, 走查触发再裁(spec §2.5); 不落新 ADR(架构 §5) */
  assert.ok(!t.scatter.some((s) => s.id === 'signpost-home'),
      'signpost-home 已退役不在册(门楼 T1a 建成后拆旧件, spec §6)');
  assert.ok(!JSON.stringify(t).includes('signpost-home'),
      'TOWN_MAP 十段全域无 signpost-home 孤儿引用(退役=整件摘除非移位)');
  const steps = c.townBuildSteps();
  assert.ok(!steps.some((st) => st.id === 'signpost-home'),
      '建场写序零 signpost-home 步骤(门楼前无冗余件, spec §6 走查判据)');
  assert.ok(t.scatter.some((s) => s.id === 'lamp-end-south' && s.x === 79 && s.z === 119),
      '南门灯=既有 lamp-end-south(79,119) 坪芯复用(零新增灯)');
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

/* ============ ⑫ TIDEA 波次二: 四组落位契约(scene-plan-tidea2 同式复算) ============ */

test('TIDEA 波次二: 丰收角稻草人·人家两件·鸡店鸡窝·南带跳板池·素墙立面三笔(落位契约+变体钳)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const npcs = c.TOWN_NPC_ANCHORS.flatMap((r) => r.waypoints);
  /* G01 环线全格点(轴对齐段离散, 与 npc 表同源) */
  const pts = npcs.slice();
  for (const row of c.TOWN_NPC_ANCHORS.filter((r) => r.waypoints.length > 1)) {
    const w = row.waypoints;
    for (let i = 0; i < w.length; i++) {
      const a = w[i]; const b = w[(i + 1) % w.length];
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.z - a.z));
      for (let s = 0; s <= steps; s++) {
        pts.push({x: a.x + Math.sign(b.x - a.x) * Math.min(s, Math.abs(b.x - a.x)),
          z: a.z + Math.sign(b.z - a.z) * Math.min(s, Math.abs(b.z - a.z))});
      }
    }
  }
  const cheb = (x, z, p) => Math.max(Math.abs(x - p.x), Math.abs(z - p.z));
  const fb = (p) => c.PrefabKit.footOf(p.id, p.x, p.y, p.z,
      Object.assign({}, p.v, {face: p.face}));
  const boxEdgeCheb = (b, p) => {
    let best = Infinity;
    for (let x = b.x1; x <= b.x2; x++) {
      for (let z = b.z1; z <= b.z2; z++) best = Math.min(best, cheb(x, z, p));
    }
    return best;
  };
  const sc = t.prefab.find((p) => p.id === 'scarecrow');
  const cl = t.prefab.find((p) => p.id === 'clothesline');
  const wp = t.prefab.find((p) => p.id === 'woodpile');
  const hc = t.prefab.find((p) => p.id === 'hencoop');
  const bp = t.prefab.find((p) => p.id === 'board-pool');
  assert.ok(sc && cl && wp && hc && bp, '波次二五件全在册');
  /* ① scarecrow ⊆ harvest 丰收角域+面南(金黄高潮区构图互证) */
  const farmA = t.ground.find((g) => g.id === 'farm-a');
  const scb = fb(sc);
  assert.ok(scb.x1 >= farmA.harvest.x1 && scb.x2 <= farmA.harvest.x2 &&
      scb.z1 >= farmA.harvest.z1 && scb.z2 <= farmA.harvest.z2,
  'scarecrow 足印 ⊆ harvest 丰收角域(立麦中)');
  assert.strictEqual(sc.face, 'south', 'scarecrow 面南(朝 farm-a 南缘来客)');
  /* ② clothesline 贴 cottage 南墙门前(衣格投影 ⊆ 墙段)/woodpile 贴 loft
     北墙门前; 各距 npc 切比 ≥2 */
  const cot = c.PrefabKit.footOf('cottage-gable', 44, 24, 71,
      {face: 'south'});
  const clb = fb(cl);
  assert.strictEqual(clb.z1, cot.z2 + 1, 'clothesline 贴 cottage 南墙门前第一行');
  assert.ok(clb.x1 + 1 >= cot.x1 && clb.x2 - 1 <= cot.x2,
      'clothesline 衣格 ⊆ 门脸墙段投影(端桩出段避 a02)');
  const loft = c.PrefabKit.footOf('house-loft', 42, 24, 85, {face: 'north'});
  const wpb = fb(wp);
  assert.strictEqual(wpb.z1, loft.z1 - 1, 'woodpile 贴 loft 北墙门前第一行');
  const flowerLoft = t.scatter.find((s) => s.id === 'flowerbed-loft');
  const pumpkin = t.scatter.find((s) => s.id === 'pumpkin-cottage');
  for (let x = clb.x1; x <= clb.x2; x++) {
    assert.ok(!(x === pumpkin.x && clb.z1 === pumpkin.z), 'clothesline 不压 pumpkin 格');
  }
  for (let x = wpb.x1; x <= wpb.x2; x++) {
    assert.ok(!(x === flowerLoft.x && wpb.z1 === flowerLoft.z), 'woodpile 不压花坛格');
  }
  /* ③ hencoop 贴 shop-awning 西墙线+纵向落店脸段(v07/锚切比 ≥2) */
  const shop = c.PrefabKit.footOf('shop-awning', 110, 24, 79, {face: 'west'});
  const hcb = fb(hc);
  assert.strictEqual(hcb.x2, shop.x1 - 1, 'hencoop 紧贴鸡店西墙线(贴店)');
  assert.ok(hcb.z1 >= shop.z1 && hcb.z2 <= shop.z2, 'hencoop 纵向落店脸段内');
  const v07 = pts.find((p) => p.x === 103 && p.z === 79);
  assert.ok(v07 && boxEdgeCheb(hcb, v07) >= 2, 'hencoop 距 v07 站位切比 ≥2');
  assert.strictEqual(hc.face, 'west', 'hencoop 面西(鸡迎广场来客)');
  /* ④ board-pool 南彩蛋带+回程线北+板爬升几何(变体钳) */
  const bpb = fb(bp);
  assert.ok(bpb.z1 >= 94 && bpb.z2 <= 127, 'board-pool 落镇南彩蛋带 z94..127');
  assert.ok(bpb.z2 < 132, 'board-pool 在回程触发线 z≥132 以北');
  assert.ok(bpb.x2 < 78 || bpb.x1 > 80, 'board-pool 在回望走廊 x78..80 外');
  assert.strictEqual(bp.v.boardLen, 6, 'board-pool 缺省档 len 6(实拍自裁前的初档)');
  assert.strictEqual(bp.v.poolSize, 2, 'board-pool 缺省档池径 2');
  /* 变体钳: len 6/8 dy 序(P2-01 契约, 顶恒 dy4) */
  const dys6 = []; const dys8 = [];
  for (let i = 0; i < 6; i++) dys6.push(Math.round(i * 4 / 5));
  for (let i = 0; i < 8; i++) dys8.push(Math.round(i * 4 / 7));
  assert.deepStrictEqual(dys6, [0, 1, 2, 2, 3, 4], 'len6 dy 序=中段平台读感');
  assert.deepStrictEqual(dys8, [0, 1, 1, 2, 2, 3, 3, 4], 'len8 dy 序=匀梯读感');
  const b8 = c.PrefabKit.footOf('board-pool', bp.x, bp.y, bp.z,
      Object.assign({}, bp.v, {face: bp.face, boardLen: 8, poolSize: 3}));
  assert.strictEqual(b8.x2 - b8.x1 + 1, 5, 'len8/池3 档盒宽 5(rot1 宽轴=池径+2)');
  assert.strictEqual(b8.z2 - b8.z1 + 1, 13, 'len8/池3 档盒深 13(P2-01 契约上限)');
  /* ④' 立面三笔: 墙段内+互不重格+间隔(W-03 素墙活化) */
  const wf = t.scatter.find((s) => s.id === 'wallflag-loft');
  const wbW = t.scatter.find((s) => s.id === 'windowbox-loft-w');
  const wbE = t.scatter.find((s) => s.id === 'windowbox-loft-e');
  const cr = t.scatter.find((s) => s.id === 'crates-loft');
  assert.ok(wf && wbW && wbE && cr, '立面三笔四条目全在册');
  const wallXs = [38, 39, 40, 41, 42, 43, 44, 45, 46, 47];
  for (const f of [wf, wbW, wbE, cr]) {
    assert.strictEqual(f.z, loft.z1, '立面件 ' + f.id + ' 落 loft 北墙线 z82');
    const span = f.kind === 'wallflag' ? 1 : 2;
    for (let dx = 0; dx < span; dx++) {
      assert.ok(wallXs.includes(f.x + dx), '立面件 ' + f.id + ' 格 x' + (f.x + dx) + ' ⊆ 墙段');
    }
  }
  const cells = new Set();
  for (const f of [wf, wbW, wbE, cr]) {
    const span = f.kind === 'wallflag' ? 1 : 2;
    for (let dx = 0; dx < span; dx++) {
      const k = (f.x + dx) + ',' + f.z;
      assert.ok(!cells.has(k), '立面格不重复 ' + k);
      cells.add(k);
    }
  }
  assert.ok(wbE.x - (wbW.x + 1) >= 2, 'windowbox 两扇间隔 ≥2');
  assert.strictEqual(wf.v.len, 4, 'wallflag len 4(钳域 2..6 缺省档)');
  /* 通用复算: 五件+立面四件 距全部 npc/锚切比 ≥2 */
  const newPrefabs = [[sc, scb], [cl, clb], [wp, wpb], [hc, hcb], [bp, bpb]];
  for (const [p, b] of newPrefabs) {
    for (const n of pts) {
      assert.ok(boxEdgeCheb(b, n) >= 2, p.id + ' 距 npc 站位/巡逻格切比 ≥2');
    }
    for (const a of t.anchors) {
      assert.ok(boxEdgeCheb(b, a) >= 2, p.id + ' 距导览锚切比 ≥2');
    }
  }
  for (const f of [wf, wbW, wbE, cr]) {
    const span = f.kind === 'wallflag' ? 1 : 2;
    for (let dx = 0; dx < span; dx++) {
      for (const n of pts) {
        assert.ok(cheb(f.x + dx, f.z, n) >= 2,
            f.id + ' 距 npc 站位/巡逻格切比 ≥2');
      }
      for (const a of t.anchors) {
        assert.ok(cheb(f.x + dx, f.z, a) >= 2, f.id + ' 距导览锚切比 ≥2');
      }
    }
  }
  /* 脚印两两无交: 新五件 vs 既有全部 */
  for (const p of t.prefab) {
    if (p === sc || p === cl || p === wp || p === hc || p === bp) continue;
    const ob = fb(p);
    for (const [, b] of newPrefabs) {
      const hit = ob.x1 <= b.x2 && b.x1 <= ob.x2 && ob.z1 <= b.z2 && b.z1 <= ob.z2;
      assert.ok(!hit, '既有 ' + p.id + ' × 新件脚印无交(动骨架-轻)');
    }
  }
});

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
  assert.ok(!/\bwindow\b/.test(src) && !src.includes('document'),
      '零 DOM(\\bwindow\\b 词边界: 不误伤 wallflag/windowbox 数据 kind 名)');
  assert.ok(!src.includes('Math.random'), '零随机源(同参同输出)');
  for (const banned of ['Date.now', 'new Date', 'performance.now']) {
    assert.ok(!src.includes(banned), '零墙钟(' + banned + ')');
  }
});
