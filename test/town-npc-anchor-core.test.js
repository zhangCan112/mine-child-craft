'use strict';
/* 城镇 NPC 站位锚点纯核心单测(镜像 js/town-npc-anchor-core.js) — node --test(零依赖)
   运行: node --test test/town-npc-anchor-core.test.js
   T-NPC-04 红测(可执行规格, 票: .scratch/town-design/tickets/T-NPC-04-anchor-table.md;
   节奏裁决: 同目录 README.md §3.3——anchorOf 纯取数器+航点量化, 消费与重发节奏待
   入口缝 ADR 会师(T-NPC-12), 本层零时间推进)。装具: vm 装载链 config→voxel→
   scene-kit→prefab-kit→town-map-core→本件(红期新件缺席即全组装载红);
   TOWN_MAP/PrefabKit 仅供测试侧校验(town-npc-anchor-core 本体零运行时依赖,
   镜像 town-map-core 先例: 坐标拍板死在数据表, 对齐与避让约束全在测试侧锁死)。
   断言组: ①门面与架构裁决(独立成件不并入 TOWN_MAP.anchors, npc: 前缀零碰撞)
   ②行形状恰四键+id 空间(npc:+小写 npcId, 双唯一, 字面 14 键跨表对账——
   T-NPC-03 注册表未落, 对字面清单断言) ③航点形状(face 五值词表, 日程序列
   2~5 航点字面锁/G01 四航点轴对齐闭环——c2 翻钉: 旧「静态单航点」随日程扩形翻转)
   ④贴地 y=groundY ⑤可达域 ⊆ 核心区与可达带
   ⑥不压建筑脚印(PrefabKit.footOf 全清单) ⑦避散布「≥2 格」 ⑧避导览锚「≥2 格」
   ⑨日程可走: 全部多航点锚逐段格点不穿脚印+不穿他锚驻留(c2 扩列, 含 ⑨-2
   驻留语义窗三测: 聚集/家字面+hub/生活带域+距环互距≥2)
   ⑩场景语义锚定(窗口表锁语义不锁值——票文: 建议
   坐标与约束冲突时约束赢, 实现微调坐标不改约束; c2 只查 waypoints[0] 工作位)
   ⑪取数器: G01 环取模+日程锚线性钳制(c2 翻钉: 旧「静态恒返 waypoints[0]」)
   ⑫G01 取模归一(-1/n/n+1; 缺省 legIndex=首腿, 红方拍板口径: legIndex 由装配层
   注入, 缺省注入视作 0) ⑬未知 id 拼写域抛错(镜像 townInteractRegistry/
   mkTownTargets 口径; 大小写不符属拼写域) ⑭快照拷贝(恰四键/改写不反渗/新引用)
   ⑮源文本守门(零 THREE/DOM/墙钟/随机/定时器——不做时间推进, README §3.3)。
   T-NPC-12 追加: ⑯重发判定纯谓词 anchorChanged(prev, next)(快照比较——票面 §3
   建议, 落点裁决=扩本件同域词汇 {x,y,z,face}, 零新 js 文件)。
   几何口径: 「≥2 格」= 两点切比雪夫距离 ≥2(不相邻不重叠, 即 1×1 盒 gapXZ ≥1);
   G01 段查脚印 = 轴对齐段全整数格点不落任何脚印盒。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* 装载链: 引擎件按 index.html 序 + 本票新件(尾部); 红期新件缺席抛明确中文错
   (全组装载红 = 票未施工的诚实形态, test/town-interact-core.test.js 同款)。 */
const CHAIN = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
  'js/town-map-core.js', 'js/town-npc-anchor-core.js'];

function loadCore() {
  const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of CHAIN) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) {
      throw new Error('装载链缺件: ' + f + '(T-NPC-04 红期: js/town-npc-anchor-core.js 未落实现)');
    }
    vm.runInContext(fs.readFileSync(p, 'utf8'), eng, {filename: f});
  }
  /* T-NPC-12 红期扩提取(守卫式): anchorChanged 未落实现时返 null——既有 18 测
      保持绿, 新增 ⑯ 节红在「谓词缺席」这一件事上(镜像本文件红期缺件红纪律) */
  return vm.runInContext('({TOWN_MAP, PrefabKit, TOWN_NPC_ANCHORS, anchorOf,' +
    'anchorChanged: (typeof anchorChanged === "function") ? anchorChanged : null})', eng);
}

/* ---- 几何小工具(镜像 town-map-core.test.js 先例) ---- */
const pointBox = (x, z) => ({x1: x, x2: x, z1: z, z2: z});
const overlapXZ = (a, b) => a.x1 <= b.x2 && b.x1 <= a.x2 && a.z1 <= b.z2 && b.z1 <= a.z2;
const gapXZ = (a, b) => Math.max(a.x1 - b.x2 - 1, b.x1 - a.x2 - 1, a.z1 - b.z2 - 1, b.z1 - a.z2 - 1, 0);
const cheb = (x1, z1, x2, z2) => Math.max(Math.abs(x1 - x2), Math.abs(z1 - z2));

/* ---- 校验面 F: 站位约束的测试侧消费面(TOWN_MAP + footOf 实算) ---- */
function makeFacings(c) {
  const t = c.TOWN_MAP;
  const foots = t.prefab.map((p) => ({p, b: c.PrefabKit.footOf(p.id, p.x, p.y, p.z,
      Object.assign({}, p.v, {face: p.face}))}));
  return {
    foots,
    footHit(x, z) {
      return foots.filter((f) => overlapXZ(pointBox(x, z), f.b));
    },
    gapFootMin(x, z) {
      return Math.min(...foots.map((f) => gapXZ(pointBox(x, z), f.b)));
    },
    gapGround(id, x, z) {
      const g = t.ground.find((r) => r.id === id);
      return gapXZ(pointBox(x, z), {x1: g.x1, x2: g.x2, z1: g.z1, z2: g.z2});
    },
    gapPrefabId(id, x, z) {
      return Math.min(...foots.filter((f) => f.p.id === id).map((f) => gapXZ(pointBox(x, z), f.b)));
    },
    gapPrefabTheme(theme, x, z) {
      return Math.min(...foots.filter((f) => f.p.v && f.p.v.theme === theme)
          .map((f) => gapXZ(pointBox(x, z), f.b)));
    },
    towerFoot() {
      return foots.find((f) => f.p.id === 'tower-belfry').b;
    },
    gapTower(x, z) {
      return gapXZ(pointBox(x, z), this.towerFoot());
    },
    eastOfTower(x, z) {
      return x > (this.towerFoot().x1 + this.towerFoot().x2) / 2;
    },
    chebScatter(id, x, z) {
      const s = t.scatter.find((r) => r.id === id);
      return cheb(x, z, s.x, s.z);
    },
    gapScatterMin(x, z) {
      return Math.min(...t.scatter.map((s) => cheb(x, z, s.x, s.z)));
    },
    chebAnchor(id, x, z) {
      const a = t.anchors.find((r) => r.id === id);
      return cheb(x, z, a.x, a.z);
    },
    /* 导览锚=非 npc: 行(升格后布局权威含站位锚, 自身不入避让比对) */
    gapAnchorMin(x, z) {
      return Math.min(...t.anchors.filter((a) => !String(a.id).startsWith('npc:'))
          .map((a) => cheb(x, z, a.x, a.z)));
    },
    inPlaza(x, z) {
      return x >= t.plaza.x1 && x <= t.plaza.x2 && z >= t.plaza.z1 && z <= t.plaza.z2;
    },
    onRoad(id, x, z) {
      const r = t.roads.find((rr) => rr.id === id);
      return x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2;
    },
    inReachableBand(x, z) {
      return t.zones.some((zn) => zn.reachable && x >= zn.x1 && x <= zn.x2 && z >= zn.z1 && z <= zn.z2);
    },
  };
}

/* ---- 语义窗口表(§3.3 对齐依据逐行转译; 窗口锁语义不锁值) ---- */
const SEM = [
  {id: 'npc:v01', face: 'south', why: 'main-south 路端/广场南缘, 面南对 spawn 方向',
    ok: (x, z, F) => F.onRoad('main-south', x, z) && z <= 96},
  {id: 'npc:v02', face: 'north', why: 'farm-a 南缘, 面田',
    ok: (x, z, F) => F.gapGround('farm-a', x, z) <= 2},
  {id: 'npc:v03', face: 'west', why: '广场东缘',
    ok: (x, z, F) => F.inPlaza(x, z) && x >= 88},
  {id: 'npc:v04', face: 'north', why: 'signpost-plaza 侧、钟塔足印外(足印外由硬约束承担)',
    ok: (x, z, F) => F.chebScatter('signpost-plaza', x, z) <= 3},
  {id: 'npc:v05', face: 'south', why: '广场东北角(无熔炉建筑, 票面记待建筑侧增量)',
    ok: (x, z, F) => F.inPlaza(x, z) && x >= 88 && z <= 74},
  {id: 'npc:v06', face: 'east', why: 'flower 摊西邻, 面摊',
    ok: (x, z, F) => F.gapPrefabTheme('flower', x, z) <= 2},
  {id: 'npc:v07', face: 'west', why: 'lava-chicken 锚旁门前, 面店(建议坐标压 shop-awning 足印且距锚 1, 约束赢微调)',
    ok: (x, z, F) => {
      const d = F.chebAnchor('lava-chicken', x, z); return d >= 2 && d <= 3;
    }},
  {id: 'npc:v08', face: 'east', why: '钟塔足印外东侧(建议坐标在实际足印西侧, 约束赢微调)',
    ok: (x, z, F) => F.eastOfTower(x, z) && F.gapTower(x, z) <= 2},
  {id: 'npc:v09', face: 'north', why: 'farm-b 南缘, 面田',
    ok: (x, z, F) => F.gapGround('farm-b', x, z) <= 2},
  {id: 'npc:v10', face: 'south', why: '广场东南留白(避樱花/灯柱由硬约束承担)',
    ok: (x, z, F) => F.inPlaza(x, z) && z >= 82},
  {id: 'npc:a01', face: 'south', why: 'farm-a 南侧路缘(踱步留白)',
    ok: (x, z, F) => F.gapGround('farm-a', x, z) <= 3},
  {id: 'npc:a02', face: 'north', why: 'cottage-gable 南侧门前, 面门',
    ok: (x, z, F) => F.gapPrefabId('cottage-gable', x, z) <= 2},
  {id: 'npc:a03', face: 'south', why: 'fruit 摊东北邻',
    ok: (x, z, F) => F.gapPrefabTheme('fruit', x, z) <= 2},
];

/* 字面 14 键(跨表对账: T-NPC-03 注册表未落, 票文 §4.8 未落分支) */
const LITERAL_14 = ['A01', 'A02', 'A03', 'G01', 'V01', 'V02', 'V03', 'V04', 'V05',
  'V06', 'V07', 'V08', 'V09', 'V10'];

/* ============ ① 门面与架构裁决 ============ */

test('门面: TOWN_NPC_ANCHORS 14 行数据权威 + anchorOf 纯函数出口', () => {
  const c = loadCore();
  assert.ok(Array.isArray(c.TOWN_NPC_ANCHORS), 'TOWN_NPC_ANCHORS 是数组(数据权威)');
  assert.strictEqual(c.TOWN_NPC_ANCHORS.length, 14, '恰 14 行(票文 §1: 14 实体)');
  assert.strictEqual(typeof c.anchorOf, 'function', 'anchorOf 是函数(取数器出口)');
});

test('架构裁决(升格后): 14 行站位锚并入 TOWN_MAP.anchors 成布局权威 — 21 锚 · 导览七锚零漂移 · ' +
    '布局行与 anchorOf 对账(波次一「独立成件」口径随 T-NPC-10 升格翻转)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  assert.strictEqual(t.anchors.length, 21,
      'TOWN_MAP.anchors = 7 导览 + 14 站位 = 21 锚(升格并入, 单一布局权威)');
  const byId = {};
  for (const a of t.anchors) byId[a.id] = a;
  const npcIds = c.TOWN_NPC_ANCHORS.map((r) => r.id);
  assert.ok(npcIds.every((id) => id.startsWith('npc:')),
      '站位锚 id 恒 npc: 前缀(镜像 task: 先例, 与导览锚零碰撞)');
  assert.strictEqual(new Set(npcIds).size, 14, '站位锚 id 全仓唯一');
  assert.strictEqual(new Set(t.anchors.map((a) => a.id)).size, 21,
      '布局权威 21 锚 id 全表唯一(两表合并零碰撞)');
  for (const row of c.TOWN_NPC_ANCHORS) {
    const a = byId[row.id];
    assert.ok(a, '站位锚「' + row.id + '」并入布局权威(锚点在册性单源, T-NPC-10 会师)');
    const w = row.waypoints[0]; /* 静态站位=单航点; G01 首航点=leg0 现值(T-NPC-12 管推进) */
    assert.strictEqual(a.x, w.x, '「' + row.id + '」布局行 x=首航点(anchorOf 对账)');
    assert.strictEqual(a.y, w.y, '「' + row.id + '」布局行 y=首航点(groundY 贴地)');
    assert.strictEqual(a.z, w.z, '「' + row.id + '」布局行 z=首航点(anchorOf 对账)');
    assert.strictEqual(a.face, w.face, '「' + row.id + '」布局行 face=首航点(anchorOf 对账)');
  }
});

/* ============ ② 行形状与 id 空间(§3.1) ============ */

test('行形状: 恰四键 id/npcId/waypoints/note · npcId 字面 14 键跨表对账', () => {
  const c = loadCore();
  for (const row of c.TOWN_NPC_ANCHORS) {
    assert.deepStrictEqual(Object.keys(row).sort(),
        ['id', 'note', 'npcId', 'waypoints'], '行「' + row.id + '」恰四键(数据表字段口径, 不泄漏)');
    assert.ok(typeof row.note === 'string' && row.note.length > 0,
        '行「' + row.id + '」note 非空中文(场景语义注记)');
  }
  const npcIds = [...c.TOWN_NPC_ANCHORS].map((r) => r.npcId).sort(); /* 先摊平进宿主域(vm 数组过不了 deepStrictEqual 跨域原型比对) */
  assert.deepStrictEqual(npcIds, LITERAL_14, 'npcId 集 = 字面 14 键(V01~V10/G01/A01~A03)');
  assert.strictEqual(new Set(npcIds).size, 14, 'npcId 唯一');
});

test('id 空间: id = npc: + 小写 npcId(零第二命名规则)', () => {
  const c = loadCore();
  for (const row of c.TOWN_NPC_ANCHORS) {
    assert.strictEqual(row.id, 'npc:' + row.npcId.toLowerCase(),
        '行 id「' + row.id + '」= npc: 前缀 + npcId 小写');
  }
});

/* ============ ③ 航点形状与词表(§3.1) ============ */

test('航点形状: 恰四键 x/y/z/face · 非负整数 · face ∈ 五值朝向词表', () => {
  const c = loadCore();
  const FACES = ['up', 'north', 'south', 'east', 'west'];
  for (const row of c.TOWN_NPC_ANCHORS) {
    assert.ok(Array.isArray(row.waypoints) && row.waypoints.length > 0,
        '行「' + row.id + '」waypoints 非空数组');
    for (const w of row.waypoints) {
      assert.deepStrictEqual(Object.keys(w).sort(), ['face', 'x', 'y', 'z'],
          '行「' + row.id + '」航点恰四键 x/y/z/face');
      for (const k of ['x', 'y', 'z']) {
        assert.ok(Number.isInteger(w[k]) && w[k] >= 0,
            '行「' + row.id + '」航点 ' + k + '=' + w[k] + ' 非负整数');
      }
      assert.ok(FACES.includes(w.face),
          '行「' + row.id + '」face「' + w.face + '」∈ 上/北/南/东/西 词表');
    }
  }
});

test('航点拓扑: 13 村民行=日程航点序列(2~5 航点·首航点=工作位·互异·轴对齐) · G01 恰四航点轴对齐闭环(c2 扩列, 票面 §11.7.0 数据终版字面锁)', () => {
  const c = loadCore();
  const byNpcId = Object.fromEntries(c.TOWN_NPC_ANCHORS.map((r) => [r.npcId, r]));
  /* c2 数据终版字面锁(红方探针验证器 ALL 13 PASS, 票面 §11.7.0-①): 航点数逐行锁定 */
  const SEQ_N = {V01: 3, V02: 5, V03: 3, V04: 3, V05: 4, V06: 3, V07: 3,
    V08: 3, V09: 3, V10: 3, A01: 3, A02: 3, A03: 5};
  for (const row of c.TOWN_NPC_ANCHORS) {
    if (row.npcId === 'G01') continue;
    assert.strictEqual(row.waypoints.length, SEQ_N[row.npcId],
        '「' + row.npcId + '」日程航点序列恰 ' + SEQ_N[row.npcId] + ' 点(c2 数据终版字面锁)');
    const pts = row.waypoints.map((w) => w.x + ',' + w.z);
    assert.strictEqual(new Set(pts).size, row.waypoints.length,
        '「' + row.npcId + '」航点互异(零零长段)');
    assert.strictEqual(row.waypoints[0].x + ',' + row.waypoints[0].z,
        c.TOWN_MAP.anchors.find((a) => a.id === row.id).x + ',' +
        c.TOWN_MAP.anchors.find((a) => a.id === row.id).z,
        '「' + row.npcId + '」首航点=工作位=布局行(升格对账锚, c2 扩列首航点恒不动)');
    for (let i = 0; i < row.waypoints.length - 1; i++) {
      const a = row.waypoints[i];
      const b = row.waypoints[i + 1];
      assert.ok(a.x === b.x || a.z === b.z,
          '「' + row.npcId + '」日程段 ' + i + '→' + (i + 1) + ' 轴对齐(曼哈顿路径可沿走)');
    }
  }
  const g = byNpcId.G01;
  assert.ok(g, 'G01 巡逻行在册(c2 零触碰)');
  assert.strictEqual(g.waypoints.length, 4, 'G01 恰四航点(巡逻环, villagers 设计 §5.3)');
  const pts = g.waypoints.map((w) => w.x + ',' + w.z);
  assert.strictEqual(new Set(pts).size, 4, 'G01 四航点互异(零零长段)');
  for (let i = 0; i < 4; i++) {
    const a = g.waypoints[i];
    const b = g.waypoints[(i + 1) % 4]; /* 末→首闭环边 */
    const aligned = a.x === b.x || a.z === b.z;
    assert.ok(aligned, 'G01 段 ' + i + '→' + ((i + 1) % 4) + ' 轴对齐(巡逻环可沿走)');
  }
});

/* ============ ④⑤ 世界对齐: 贴地与可达域(验收 1/2) ============ */

test('贴地: 全部航点 y = TOWN_MAP.core.groundY(零悬空零入地)', () => {
  const c = loadCore();
  const gy = c.TOWN_MAP.core.groundY;
  for (const row of c.TOWN_NPC_ANCHORS) {
    for (const w of row.waypoints) {
      assert.strictEqual(w.y, gy, '「' + row.id + '」航点贴地 y=' + w.y + '(groundY=' + gy + ')');
    }
  }
});

test('可达域: 全部航点 ⊆ 核心区 [32,127] 且落在 reachable 分区带(非 far-north 剪影带)', () => {
  const c = loadCore();
  const F = makeFacings(c);
  const core = c.TOWN_MAP.core;
  for (const row of c.TOWN_NPC_ANCHORS) {
    for (const w of row.waypoints) {
      assert.ok(w.x >= core.x1 && w.x <= core.x2 && w.z >= core.z1 && w.z <= core.z2,
          '「' + row.id + '」(' + w.x + ',' + w.z + ') ⊆ 核心区(可达带, 票文 §4.2)');
      assert.ok(F.inReachableBand(w.x, w.z),
          '「' + row.id + '」落在 reachable 分区带(非 far-north 剪影层)');
    }
  }
});

/* ============ ⑥⑦⑧ 避让约束(验收 3/4/5) ============ */

test('不压建筑脚印: 全部站位与 footOf 全清单零相交(镜像 town-map-core 先例, 校验在测试侧)', () => {
  const c = loadCore();
  const F = makeFacings(c);
  for (const row of c.TOWN_NPC_ANCHORS) {
    for (const w of row.waypoints) {
      const hits = F.footHit(w.x, w.z).map((f) => f.p.id + '@' + f.p.x + ',' + f.p.z);
      assert.strictEqual(hits.length, 0,
          '「' + row.id + '」(' + w.x + ',' + w.z + ') 不压建筑脚印' + (hits.length ? ': ' + hits.join('/') : ''));
    }
  }
});

test('避让散布: 与 TOWN_MAP.scatter 全点位保持 ≥2 格(樱花/灯柱/路标不可站不可贴)', () => {
  const c = loadCore();
  const F = makeFacings(c);
  for (const row of c.TOWN_NPC_ANCHORS) {
    for (const w of row.waypoints) {
      assert.ok(F.gapScatterMin(w.x, w.z) >= 2,
          '「' + row.id + '」(' + w.x + ',' + w.z + ') 距最近散布点 ' +
          F.gapScatterMin(w.x, w.z) + ' ≥2 格(切比雪夫)');
    }
  }
});

test('避让既有导览锚: 与 TOWN_MAP.anchors 非 npc: 七导览锚各 ≥2 格(交互点留玩家站位; 升格后站位锚自身不入比对)', () => {
  const c = loadCore();
  const F = makeFacings(c);
  for (const row of c.TOWN_NPC_ANCHORS) {
    for (const w of row.waypoints) {
      assert.ok(F.gapAnchorMin(w.x, w.z) >= 2,
          '「' + row.id + '」(' + w.x + ',' + w.z + ') 距最近导览锚 ' +
          F.gapAnchorMin(w.x, w.z) + ' ≥2 格(切比雪夫)');
    }
  }
});

/* ============ ⑨ 巡逻可走(验收 6) ============ */

test('日程可走: 全部多航点锚(G01+13 村民)相邻航点连线段全格点不穿任何 prefab 脚印 · 且不穿他锚任何驻留航点(互穿观感守门, c2 扩列)', () => {
  const c = loadCore();
  const F = makeFacings(c);
  /* 驻留点字面集=聚集∪家(票面 §11.7.0-① 口径: 驻留=站立语义, 表值为 [x,z]) */
  const stay = new Set([...Object.values(C2_GATHER), ...Object.values(C2_HOME)]
      .map(([x, z]) => x + ',' + z));
  for (const row of c.TOWN_NPC_ANCHORS) {
    if (row.waypoints.length < 2) continue; /* 单航点行无段(日历兼容守卫) */
    for (let i = 0; i < row.waypoints.length; i++) {
      /* G01 闭环边含末→首; 村民日程行不含闭环(首末不相连=日程往返路径) */
      const j = row.npcId === 'G01' ? (i + 1) % row.waypoints.length : i + 1;
      if (j >= row.waypoints.length) break;
      const a = row.waypoints[i];
      const b = row.waypoints[j];
      const cells = [];
      if (a.x === b.x) {
        const [z1, z2] = a.z <= b.z ? [a.z, b.z] : [b.z, a.z];
        for (let z = z1; z <= z2; z++) cells.push([a.x, z]);
      } else if (a.z === b.z) {
        const [x1, x2] = a.x <= b.x ? [a.x, b.x] : [b.x, a.x];
        for (let x = x1; x <= x2; x++) cells.push([x, a.z]);
      } else {
        cells.push(null); /* 斜腿守卫(拓扑测已锁轴对齐, 此处防静默) */
      }
      assert.ok(cells[0] !== null, '「' + row.npcId + '」段 ' + i + '→' + j + ' 轴对齐(可走格点法前提)');
      for (const [x, z] of cells) {
        const hits = F.footHit(x, z).map((f) => f.p.id + '@' + f.p.x + ',' + f.p.z);
        assert.strictEqual(hits.length, 0,
            '「' + row.npcId + '」段 ' + i + '→' + j + ' 格点 (' + x + ',' + z + ')' +
            (hits.length ? ' 穿脚印: ' + hits.join('/') : ' 不穿脚印'));
        for (const other of c.TOWN_NPC_ANCHORS) {
          if (other.id === row.id) continue;
          for (const w of other.waypoints) {
            /* 驻留判定豁免(c2 绿相裁决终版, 替代 k=0 窄域): 票面 §11.7.0-①
               约束「路段不穿他村驻留点」——驻留点=聚集/家两表字面, 执法点=
               站立重叠; 工作位(k=0, 既有拍板现状: G01 南腿 z92 恰过 A03 站位
               (73,92)/V09 直列 x83 恰过 V08 (83,76))与途经拐点(A03 t1 (75,92)
               恰落环南腿整行)皆路过形态同豁——路过瞬间重叠≠驻留重叠;
               聚集/家驻留格全查不豁免 */
            if (!stay.has(w.x + ',' + w.z)) continue;
            assert.ok(!(w.x === x && w.z === z),
                '「' + row.npcId + '」段 ' + i + '→' + j + ' 格点 (' + x + ',' + z + ')' +
                ' 不穿他锚「' + other.id + '」驻留航点 (' + w.x + ',' + w.z + ')(互穿观感守门)');
          }
        }
      }
    }
  }
});

/* ============ ⑨-2 c2 日程驻留语义窗与互避(数据终版=票面 §11.7.0-①) ============
   驻留点=末位航点(家 h)与段表聚集位——段表在 behavior-core, 本层以「航点语义」
   锁位置域: 聚集候选∈hub 带(广场集会)·家∈西/南生活带(回屋休息)·距 G01 环
   ≥2(铁傀儡不穿站立村民)·驻留互距≥2。字面逐行锚定见拓扑测 SEQ_N 与取数器测。 */
const C2_GATHER = {
  V01: [79, 80], V02: [73, 72], V03: [68, 85], V04: [74, 69], V05: [90, 71],
  V06: [87, 80], V07: [68, 79], V08: [76, 76], V09: [83, 78], V10: [78, 86],
  A01: [72, 70], A02: [70, 76], A03: [80, 84],
};
const C2_HOME = {
  V01: [79, 96], V02: [56, 72], V03: [56, 85], V04: [74, 96], V05: [88, 96],
  V06: [87, 94], V07: [56, 79], V08: [76, 96], V09: [34, 78], V10: [64, 86],
  A01: [48, 70], A02: [56, 76], A03: [80, 98],
};

test('c2 日程驻留字面: 聚集/家航点=数据终版字面(逐行坐标+face 语义锚定, 红方探针定案)', () => {
  const c = loadCore();
  const FACES_G = {V01: 'north', V02: 'east', V03: 'east', V04: 'south', V05: 'west',
    V06: 'west', V07: 'east', V08: 'east', V09: 'west', V10: 'north',
    A01: 'east', A02: 'east', A03: 'north'};
  const byNpcId = Object.fromEntries(c.TOWN_NPC_ANCHORS.map((r) => [r.npcId, r]));
  for (const id of Object.keys(C2_GATHER)) {
    const row = byNpcId[id];
    assert.ok(row, '「' + id + '」行在册');
    const gi = row.waypoints.findIndex((w) => w.x === C2_GATHER[id][0] && w.z === C2_GATHER[id][1]);
    assert.ok(gi > 0, '「' + id + '」聚集航点 (' + C2_GATHER[id] + ') 在序列中(非首航点)');
    assert.strictEqual(row.waypoints[gi].face, FACES_G[id],
        '「' + id + '」聚集 face=' + FACES_G[id] + '(面钟塔主轴语义)');
    const hi = row.waypoints.findIndex((w) => w.x === C2_HOME[id][0] && w.z === C2_HOME[id][1]);
    assert.ok(hi > gi, '「' + id + '」家航点 (' + C2_HOME[id] + ') 在聚后(日程序: 工作位→聚集→家)');
    assert.strictEqual(row.waypoints[hi].face, 'north',
        '「' + id + '」家 face=north(面镇心安眠语义)');
    assert.strictEqual(row.waypoints[row.waypoints.length - 1].x + ',' +
        row.waypoints[row.waypoints.length - 1].z, C2_HOME[id][0] + ',' + C2_HOME[id][1],
    '「' + id + '」末航点=家(夜间归家=序列终点)');
  }
});

test('c2 日程驻留域: 聚集 ∈ hub 带(广场集会语义) · 家 ∈ 西/南生活带(回屋休息语义)', () => {
  const c = loadCore();
  const t = c.TOWN_MAP;
  const hub = t.zones.find((zn) => zn.id === 'hub');
  const inHub = (x, z) => x >= hub.x1 && x <= hub.x2 && z >= hub.z1 && z <= hub.z2;
  const inLife = (x, z) => t.zones.some((zn) => (zn.id === 'west' || zn.id === 'south') &&
      zn.reachable && x >= zn.x1 && x <= zn.x2 && z >= zn.z1 && z <= zn.z2);
  for (const id of Object.keys(C2_GATHER)) {
    assert.ok(inHub(C2_GATHER[id][0], C2_GATHER[id][1]),
        '「' + id + '」聚集 (' + C2_GATHER[id] + ') ∈ hub 带(傍晚向广场/钟塔聚集, villagers 设计 §5.1)');
    assert.ok(inLife(C2_HOME[id][0], C2_HOME[id][1]),
        '「' + id + '」家 (' + C2_HOME[id] + ') ∈ 西/南生活带(夜间回屋休息语义)');
  }
});

test('c2 日程驻留互避: 新驻留点距 G01 环全格点 ≥2(铁傀儡不穿站立村民) · 驻留互距 ≥2(集会散布观感)', () => {
  const c = loadCore();
  const g01 = c.TOWN_NPC_ANCHORS.find((r) => r.npcId === 'G01');
  const ring = [];
  for (let i = 0; i < g01.waypoints.length; i++) {
    const a = g01.waypoints[i];
    const b = g01.waypoints[(i + 1) % g01.waypoints.length];
    if (a.x === b.x) {
      const [z1, z2] = a.z <= b.z ? [a.z, b.z] : [b.z, a.z];
      for (let z = z1; z <= z2; z++) ring.push([a.x, z]);
    } else {
      const [x1, x2] = a.x <= b.x ? [a.x, b.x] : [b.x, a.x];
      for (let x = x1; x <= x2; x++) ring.push([x, a.z]);
    }
  }
  const stays = [];
  for (const id of Object.keys(C2_GATHER)) {
    stays.push([id, 'g', C2_GATHER[id]]);
    stays.push([id, 'h', C2_HOME[id]]);
  }
  for (const [id, role, [x, z]] of stays) {
    for (const [rx, rz] of ring) {
      const d = Math.max(Math.abs(x - rx), Math.abs(z - rz));
      assert.ok(d >= 2, '「' + id + role + '」(' + x + ',' + z + ') 距 G01 环格 (' + rx + ',' + rz + ') ' +
          d + ' ≥2(铁傀儡巡逻不穿站立村民)');
    }
    for (const [oid, orole, [ox, oz]] of stays) {
      if (oid === id && orole === role) continue;
      if (oid === id && orole !== role) continue; /* 同村 g/h 可近(往返两端) */
      const d = Math.max(Math.abs(x - ox), Math.abs(z - oz));
      assert.ok(d >= 2, '「' + id + role + '」(' + x + ',' + z + ') 与「' + oid + orole +
          '」(' + ox + ',' + oz + ') 距 ' + d + ' ≥2(驻留互距, 集会散布)');
    }
  }
});

/* ============ ⑩ 场景语义锚定(§3.3, 窗口锁语义不锁值) ============ */

test('语义锚定: 14 行站位逐条落对齐依据窗口(建议坐标与约束冲突时约束赢, 微调不改语义)', () => {
  const c = loadCore();
  const F = makeFacings(c);
  const byId = Object.fromEntries(c.TOWN_NPC_ANCHORS.map((r) => [r.id, r]));
  for (const sem of SEM) {
    const row = byId[sem.id];
    assert.ok(row, '语义行「' + sem.id + '」在册');
    const w = row.waypoints[0];
    assert.strictEqual(w.face, sem.face,
        '「' + sem.id + '」face=' + w.face + ' 合语义(' + sem.why + ')');
    assert.ok(sem.ok(w.x, w.z, F),
        '「' + sem.id + '」(' + w.x + ',' + w.z + ') 落窗口: ' + sem.why);
  }
  const g = byId['npc:g01'];
  for (const w of g.waypoints) {
    assert.ok(F.inPlaza(w.x, w.z), 'G01 角 (' + w.x + ',' + w.z + ') ⊆ 广场(环广场四角)');
  }
});

/* ============ ⑪⑫⑬ 取数器 anchorOf(验收 7 + §3.2) ============ */

test('取数器·日程锚: legIndex 线性取数 waypoints[leg](界内全覆盖) · 越界两端钳制(线性序列非环, c2 翻钉: 旧「静态恒返 waypoints[0]」随日程取数翻转)', () => {
  const c = loadCore();
  const row = c.TOWN_NPC_ANCHORS.find((r) => r.id === 'npc:v01');
  const n = row.waypoints.length;
  const flat = (w) => ({x: w.x, y: w.y, z: w.z, face: w.face});
  /* 界内逐腿: 日程机产出域 [0, n-1] 全覆盖(工作位→[途经]→聚集→家 线性取数) */
  for (let leg = 0; leg < n; leg++) {
    assert.deepStrictEqual({...c.anchorOf('npc:v01', leg)}, flat(row.waypoints[leg]),
        'npc:v01 legIndex=' + leg + ' 返 waypoints[' + leg + '](日程线性取数)');
  }
  /* 缺省=首航点(工作位=白天初值, 与 G01 缺省=首腿同口径) */
  assert.deepStrictEqual({...c.anchorOf('npc:v01')}, flat(row.waypoints[0]),
      '缺省 legIndex=首航点(工作位=白天初值)');
  /* 越界钳制: 线性序列非环——超界读数钉两端不绕回
     (取模会使 leg=n 绕回 waypoints[0]「家绕回工作位」错位; 钳制=日程终点语义;
      leg=n 取模返 wp[0] 而钳制返 wp[n-1], 两语义可区分, 本断言排除取模) */
  assert.deepStrictEqual({...c.anchorOf('npc:v01', n)}, flat(row.waypoints[n - 1]),
      'legIndex=n 越上界钳末航点(家=日程序终点, 非取模绕回)');
  assert.deepStrictEqual({...c.anchorOf('npc:v01', 99)}, flat(row.waypoints[n - 1]),
      'legIndex=99 钳末航点(防御性, 日程机永不产)');
  assert.deepStrictEqual({...c.anchorOf('npc:v01', -7)}, flat(row.waypoints[0]),
      'legIndex=-7 钳首航点(防御性, 日程机永不产)');
});

test('取数器·巡逻锚: G01 航点环取模正确(legIndex=-1/n/n+1 归一; 缺省=首腿)', () => {
  const c = loadCore();
  const g = c.TOWN_NPC_ANCHORS.find((r) => r.npcId === 'G01');
  const n = g.waypoints.length;
  const flat = (w) => ({x: w.x, y: w.y, z: w.z, face: w.face});
  for (let leg = 0; leg < 2 * n + 1; leg++) {
    assert.deepStrictEqual({...c.anchorOf('npc:g01', leg)}, flat(g.waypoints[leg % n]),
        'npc:g01 legIndex=' + leg + ' 返 waypoints[' + (leg % n) + ']');
  }
  assert.deepStrictEqual({...c.anchorOf('npc:g01', -1)}, flat(g.waypoints[n - 1]),
      'legIndex=-1 归一到末腿(取模语义)');
  assert.deepStrictEqual({...c.anchorOf('npc:g01', n + 1)}, flat(g.waypoints[1]),
      'legIndex=n+1 归一到第二腿(取模语义)');
  assert.deepStrictEqual({...c.anchorOf('npc:g01')}, flat(g.waypoints[0]),
      '缺省 legIndex=首腿(红方拍板: legIndex 由装配层注入, 缺省注入视作 0)');
});

test('取数器·未知 id: 拼写域抛错(镜像 townInteractRegistry 口径; 大小写不符属拼写域)', () => {
  const c = loadCore();
  for (const bad of ['npc:zz9', 'NPC:V01', 'npc:', 'v01', 'npc:G01 ']) {
    assert.throws(() => c.anchorOf(bad),
        /* 跨域 instanceof 恒 false(vm 域原型), 只查消息; 非 Error thrown 的
           e.message 为 undefined 同样 false = 红守门不破 */
        (e) => String(e && e.message).includes(bad) && String(e && e.message).includes('未知'),
        'anchorOf("' + bad + '") 抛拼写域错(消息含 id 与「未知」)');
  }
});

/* ============ ⑭ 快照拷贝(零突变红线) ============ */

test('快照拷贝: 返回恰四键 · 改写返回值不反渗数据表 · 两次调用新引用同值', () => {
  const c = loadCore();
  const snap = c.anchorOf('npc:v02', 0);
  assert.deepStrictEqual(Object.keys(snap).sort(), ['face', 'x', 'y', 'z'],
      '快照恰四键(表内 note/id 等字段不外泄)');
  snap.x = -999;
  snap.face = 'boom';
  const again = c.anchorOf('npc:v02', 0);
  assert.notStrictEqual(again.x, -999, '外部改写不反渗数据表(零突变红线)');
  assert.notStrictEqual(again.face, 'boom', 'face 改写同样不反渗');
  assert.notStrictEqual(snap, again, '两次调用返回新对象(非共享引用)');
  assert.deepStrictEqual(again, c.anchorOf('npc:v02', 0), '同参同值(纯函数)');
});

/* ============ ⑮ 源文本守门(纯核心红线 + 零时间推进) ============ */

test('源文本守门: 零渲染库·零 DOM·零墙钟·零随机·零定时器(不做时间推进, README §3.3)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'town-npc-anchor-core.js'), 'utf8');
  assert.ok(/^['"]use strict['"];/.test(src), '"use strict"; 首行');
  assert.ok(!src.includes('THREE'), '零三维渲染库(纯数据+纯函数核心)');
  assert.ok(!src.includes('document') && !src.includes('window'), '零 DOM');
  assert.ok(!src.includes('Math.random'), '零随机源(同参同输出)');
  for (const banned of ['Date.now', 'new Date', 'performance.now']) {
    assert.ok(!src.includes(banned), '零墙钟(' + banned + ')');
  }
  for (const banned of ['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame']) {
    assert.ok(!src.includes(banned), '零定时器(' + banned + '——消费与重发节奏待入口缝 ADR, 本层零时间推进)');
  }
});

/* ============ ⑯ 重发判定纯谓词 anchorChanged(T-NPC-12, README §3.3 裁决三) ============
   快照比较: 航点身份=四键 {x,y,z,face} 全等——任一键跳变即真(到站跳变的判定
   数据基础), 同参取数幂等即零重发的基础。零时间推进纪律同 ⑮(纯比较无墙钟)。 */

test('anchorChanged·门面: 同域纯谓词在册 · 同快照(同参两取/深等值字面量)恒判不变', () => {
  const c = loadCore();
  assert.strictEqual(typeof c.anchorChanged, 'function',
      'anchorChanged 在册(T-NPC-12 红本体: 重发判定纯函数未落实现)');
  const a = c.anchorOf('npc:g01', 0);
  const b = c.anchorOf('npc:g01', 0);
  assert.notStrictEqual(a, b, '前置: anchorOf 两次调用新引用(既有 ⑭ 规格)');
  assert.strictEqual(c.anchorChanged(a, b), false,
      '同参两快照(值等引用异)判不变——取数幂等=零重发的数据基础');
  assert.strictEqual(c.anchorChanged({x: 66, y: 24, z: 66, face: 'east'},
      {x: 66, y: 24, z: 66, face: 'east'}), false, '深等值字面量判不变');
});

test('anchorChanged·任一键跳变即真: x/y/z/face 逐键变体各判真(快照全四键比较)', () => {
  const c = loadCore();
  const base = {x: 66, y: 24, z: 66, face: 'east'};
  const variants = [
    [{x: 92, y: 24, z: 66, face: 'east'}, 'x'],
    [{x: 66, y: 25, z: 66, face: 'east'}, 'y'],
    [{x: 66, y: 24, z: 92, face: 'east'}, 'z'],
    [{x: 66, y: 24, z: 66, face: 'south'}, 'face'],
  ];
  for (const [next, key] of variants) {
    assert.strictEqual(c.anchorChanged(base, next), true,
        '任一键(' + key + ')跳变判真(航点身份=四键全等)');
  }
  assert.strictEqual(c.anchorChanged(base,
      {x: 92, y: 24, z: 92, face: 'west'}), true, '全键变判真(G01 对角到站形态)');
});

test('anchorChanged·退化输入保守判真: 快照缺席 → true(宁重发不漏发); 缺键按键级 !== 比较', () => {
  const c = loadCore();
  const snap = {x: 66, y: 24, z: 66, face: 'east'};
  const degenerates = [[null, snap], [snap, null], [undefined, snap], [snap, undefined]];
  for (const [prev, next] of degenerates) {
    const missing = (prev === null || prev === undefined) ? 'prev' : 'next';
    assert.strictEqual(c.anchorChanged(prev, next), true,
        '快照缺席(' + missing + ')判真——保守方向, 防脏账本静默漏发');
  }
  assert.strictEqual(c.anchorChanged({x: 66, y: 24, z: 66},
      {x: 66, y: 24, z: 66, face: 'east'}), true,
  '缺 face 键(undefined) vs 有 face → 键级 !== 判真');
});
