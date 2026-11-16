'use strict';
/* T-NPC-10 接线票红测试 — node --test (零依赖)
   运行: node --test test/town-npc-wiring.test.js
   票面: .scratch/town-design/tickets/T-NPC-10-interact-wiring.md(会师条件/验收标准
   逐条转译)。跨四件接线对账(town-map-core/interact-core/npc-anchor-core/
   npc-registry), 装具按 index.html 真实装载序 vm 裸链(kit → town look×14 →
   town-map-core → interact-core → anchor-core → registry, 备忘① 链序)。
   断言组: ①站位锚升格并入布局权威(TOWN_MAP.anchors 21 锚, 坐标/朝向与
   anchorOf 对账) ②TOWN_INTERACTS +11 条 npc 条目(冻结协议形状+校验全过)
   ③注册表↔交互条目↔锚点表三表对账(npcId/anchorId/label 三向一致, 派生
   不复制, 动物零条目) ④宿主建机 npc 条目语义(focus/found/reset, 验收 §4.2)
   ⑤冻结协议守卫(事件名表/会话五值/交互四类零增项)。
   反同义反复: 条目计数/锚点计数/spot 字面(V01 全键+G01 首航点+既有九条
   id 清单)是独立真源(票面 §1/§3 与布局权威现状), 逐字段对账值从注册表
   派生只证「一致性」, 数据真值由 town-npc-registry.test.js 字面表另锁。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const LOOK_DIR = path.join(ROOT, 'js', 'mob-look');

/* ---------- 装具: 裸沙盒按备忘①链序装载(镜像 town-npc-registry.test.js
    registryCtx; town-map-core 在 interact-core 之前=布局权威先于协议层) ---------- */
let ctxCache = null;
function wiringCtx() {
  if (ctxCache) return ctxCache;
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  const looks = fs.readdirSync(LOOK_DIR)
      .filter((f) => f.startsWith('town_') && f.endsWith('.js')).sort()
      .map((f) => 'js/mob-look/' + f);
  const files = ['js/mob-look-kit.js'].concat(looks, ['js/town-map-core.js',
    'js/town-interact-core.js', 'js/town-npc-anchor-core.js',
    'js/town-npc-registry.js']);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  ctxCache = ctx;
  return ctx;
}

/* vm 域产物 JSON 往返摊平进宿主域(跨域原型比对, anchor-core.test.js:181 先例) */
function bridge() {
  const ctx = wiringCtx();
  const raw = vm.runInContext('({TOWN_MAP, TOWN_INTERACTS, TOWN_UI_EVENTS,' +
    ' TOWN_INTERACT_KINDS, TOWN_SESSION_KINDS, TOWN_NPC_ANCHORS, TOWN_NPCS,' +
    ' anchorOf, townInteractRegistry, mkTownTargets})', ctx);
  return {
    ctx,
    TOWN_MAP: JSON.parse(JSON.stringify(raw.TOWN_MAP)),
    TOWN_INTERACTS: JSON.parse(JSON.stringify(raw.TOWN_INTERACTS)),
    TOWN_UI_EVENTS: JSON.parse(JSON.stringify(raw.TOWN_UI_EVENTS)),
    TOWN_UI_EVENTS_FROZEN: Object.isFrozen(raw.TOWN_UI_EVENTS),
    TOWN_INTERACT_KINDS: Array.from(raw.TOWN_INTERACT_KINDS),
    TOWN_SESSION_KINDS: Array.from(raw.TOWN_SESSION_KINDS),
    TOWN_SESSION_KINDS_FROZEN: Object.isFrozen(raw.TOWN_SESSION_KINDS),
    TOWN_NPC_ANCHORS: JSON.parse(JSON.stringify(raw.TOWN_NPC_ANCHORS)),
    TOWN_NPCS: JSON.parse(JSON.stringify(raw.TOWN_NPCS)),
    anchorOf: (id, leg) => JSON.parse(JSON.stringify(raw.anchorOf(id, leg))),
    townInteractRegistry: () =>
      JSON.parse(JSON.stringify(raw.townInteractRegistry())),
    /* mkTownTargets 桥接: 机器引用留 vm 域(方法不过 JSON), 逐调用表达式探针
       + JSON 往返同 realm 化(town-interact-core.test.js probe 同款) */
    mkMachine() {
      vm.runInContext('var __emitted = []; var __m = mkTownTargets(' +
        '{emit: function(n, p) { __emitted.push({n: n, p: p}); }});', ctx);
    },
    machineCall(expr) {
      return JSON.parse(vm.runInContext('JSON.stringify((function(){ var r = ' + expr +
        '; return {r: r, emitted: __emitted.length}; })())', ctx));
    },
    machineExpr(expr) {
      return JSON.parse(vm.runInContext('JSON.stringify(' + expr + ')', ctx));
    },
  };
}

/* ---------- 独立真源(票面/布局权威现状字面, 非派生) ---------- */
const NPC_IDS = ['npc:v01', 'npc:v02', 'npc:v03', 'npc:v04', 'npc:v05',
  'npc:v06', 'npc:v07', 'npc:v08', 'npc:v09', 'npc:v10', 'npc:g01'];
const EXISTING_IDS = ['bell-tower', 'lava-chicken', 'windmill', 'farm',
  'market', 'stash', 'task:tour-plaza', 'task:find-bread', 'task:visit-stash'];
const SESSION_DOMAIN = ['greet', 'tour', 'seek', 'help', 'care'];

/* ============ ① 站位锚升格并入布局权威(票面会师条件 2) ============ */

test('T-NPC-10 锚升格: TOWN_MAP.anchors 并入 14 行 npc: 站位锚 — 21 锚 · 坐标/朝向与 anchorOf 逐行对账 · G01 取首航点', () => {
  const c = bridge();
  const anchors = c.TOWN_MAP.anchors;
  assert.strictEqual(anchors.length, 21,
      '锚点表 7 导览 + 14 站位 = 21 行(升格会师, 现状 ' + anchors.length + ' 行=未升格)');
  const byId = {};
  for (const a of anchors) byId[a.id] = a;
  /* npc: 14 行全在册且恰五键 {id,x,y,z,face}, 坐标/朝向=anchorOf 站位 */
  for (const row of c.TOWN_NPC_ANCHORS) {
    const a = byId[row.id];
    assert.ok(a, '站位锚「' + row.id + '」并入 TOWN_MAP.anchors(锚点在册性单源)');
    const want = Object.assign({id: row.id}, c.anchorOf(row.id, 0));
    assert.deepStrictEqual(a, want,
        '锚「' + row.id + '」= {id,x,y,z,face} 且与 anchorOf(静态取首航点, G01 巡逻取 leg0) 对账');
  }
  /* spot 字面反同义反复: 独立真源抽查(注册表 V01 站位/巡逻环首角) */
  assert.deepStrictEqual(byId['npc:v01'], {id: 'npc:v01', x: 79, y: 24, z: 94, face: 'south'},
      'npc:v01 = 广场南入口(79,24,94) 面南(票文 §3.3 字面)');
  assert.deepStrictEqual(byId['npc:g01'], {id: 'npc:g01', x: 66, y: 24, z: 66, face: 'east'},
      'npc:g01 = 巡逻环首角(66,24,66) 面东(首航点=当前 leg, T-NPC-12 管推进)');
});

test('T-NPC-10 升格零漂移: 既有七导览锚逐字不动 — id/坐标/朝向全等 · spawn 唯一 · npc: 前缀不占导览锚 id 空间', () => {
  const c = bridge();
  const byId = {};
  for (const a of c.TOWN_MAP.anchors) byId[a.id] = a;
  const GUIDES = {
    'spawn': {x: 79, y: 24, z: 112, face: 'north'},
    'bell-tower': {x: 79, y: 24, z: 76, face: 'north'},
    'lava-chicken': {x: 105, y: 24, z: 79, face: 'east'},
    'stash': {x: 53, y: 24, z: 98, face: 'west'},
    'windmill': {x: 56, y: 24, z: 47, face: 'north'},
    'farm': {x: 71, y: 24, z: 58, face: 'north'},
    'market': {x: 85, y: 24, z: 75, face: 'east'},
  };
  for (const [id, want] of Object.entries(GUIDES)) {
    assert.deepStrictEqual(Object.assign({id}, byId[id]), Object.assign({id}, want),
        '导览锚「' + id + '」逐字零漂移(升格只增不改, 布局权威现状=回归基准)');
  }
  assert.strictEqual(c.TOWN_MAP.anchors.filter((a) => a.id === 'spawn').length, 1,
      'spawn 唯一(升格不引入第二出生锚)');
  assert.strictEqual(new Set(c.TOWN_MAP.anchors.map((a) => a.id)).size, 21,
      '21 锚 id 全表唯一(两表 id 空间合并后仍无碰撞)');
});

/* ============ ② TOWN_INTERACTS +11 条 npc 条目(票面 §1/§3) ============ */

test('T-NPC-10 条目入册: TOWN_INTERACTS 追加 11 条 npc 条目 — 恰六键冻结形状 · ' +
    'kind/sessionKind/iconKey 域 · 追加在册尾(V01..V10+G01)', () => {
  const c = bridge();
  const list = c.TOWN_INTERACTS;
  assert.strictEqual(list.length, 20, '九条既有 + 11 条 npc = 20 条(现状 ' +
      list.length + ' 条=条目未入册)');
  const npcEntries = list.filter((e) => e.kind === 'npc');
  assert.strictEqual(npcEntries.length, 11, 'kind=npc 条目恰 11 条(V01~V10 + G01)');
  assert.deepStrictEqual(npcEntries.map((e) => e.id), NPC_IDS,
      'npc 条目 id 集=11 键且保源序追加(票文 §1 枚举序, G01 收尾)');
  assert.deepStrictEqual(list.slice(0, 9).map((e) => e.id), EXISTING_IDS,
      '既有九条在前零漂移(id 序回归基准)');
  for (const e of npcEntries) {
    assert.deepStrictEqual(Object.keys(e).sort(),
        ['anchorId', 'iconKey', 'id', 'kind', 'label', 'sessionKind'],
        '条目「' + e.id + '」恰六键冻结形状(票面 §3, 不多不少)');
    assert.strictEqual(e.id, e.anchorId, '条目「' + e.id + '」id 恒等 anchorId(目标 id 继承锚 id 空间)');
    assert.strictEqual(e.iconKey, e.id === 'npc:g01' ? 'care' : 'help',
        '条目「' + e.id + '」iconKey=2026-11-15 定稿(§三: 村民统一 help=💬, G01 care=💗)');
  }
});

test('T-NPC-10 条目过注册校验: townInteractRegistry 全 20 条快照 — npc 条目带 sessionKind 五值 · ' +
    'anchorId 在册 · anchor 坐标单源 == anchorOf 站位', () => {
  const c = bridge();
  let reg;
  assert.doesNotThrow(() => {
    reg = c.townInteractRegistry();
  }, '全清单构造即抛=注册校验不过(kind/sessionKind/anchorId 在册三重)');
  assert.strictEqual(reg.length, 20, '快照 20 条');
  const anchorById = {};
  for (const a of c.TOWN_MAP.anchors) anchorById[a.id] = a;
  const npcIds = new Set(NPC_IDS);
  for (const s of reg) {
    if (!npcIds.has(s.id)) continue;
    assert.ok(SESSION_DOMAIN.includes(s.sessionKind),
        '「' + s.id + '」sessionKind ∈ 冻结五值(greet|tour|seek|help|care)');
    assert.deepStrictEqual(s.anchor, {x: anchorById[s.id].x, y: anchorById[s.id].y, z: anchorById[s.id].z},
        '「' + s.id + '」快照 anchor 坐标单源取锚(票面验收 §4.1; 快照行无 anchorId 键, 锚引用=行 id 本身)');
    const w = c.anchorOf(s.id, 0);
    assert.deepStrictEqual(
        [s.anchor.x, s.anchor.y, s.anchor.z], [w.x, w.y, w.z],
        '「' + s.id + '」快照 anchor 坐标 == anchorOf 站位(验收 §4.1: 两表坐标一张嘴)');
  }
  /* spot 字面: npc:v01 快照全键(六键+sessionKind, state 初始 active) */
  const v01 = reg.find((s) => s.id === 'npc:v01');
  assert.deepStrictEqual(v01, {id: 'npc:v01', kind: 'npc', iconKey: 'help',
    label: '阿面', anchor: {x: 79, y: 24, z: 94}, state: 'active', sessionKind: 'greet'},
  'npc:v01 快照字面(独立真源: 票面 §3 示例+注册表 PO 冻结名)');
});

/* ============ ③ 三表对账(票面验收 §4.3) ============ */

test('T-NPC-10 三表对账: 注册表↔交互条目↔锚点表 — 非动物注册行恰一交互条目 · npcId/anchorId/label 三向一致 · 派生不复制 · 动物零条目', () => {
  const c = bridge();
  const npcEntries = c.TOWN_INTERACTS.filter((e) => e.kind === 'npc');
  const interactByAnchor = {};
  for (const e of npcEntries) interactByAnchor[e.anchorId] = e;
  /* 注册表(非动物行) → 交互条目: 恰一行一条, label/sessionKind/anchorId 全等 */
  const solid = c.TOWN_NPCS.filter((r) => r.category !== 'animal');
  assert.strictEqual(solid.length, 11, '注册表非动物行 11 条(10 村民+傀儡)');
  for (const r of solid) {
    const e = interactByAnchor[r.anchorId];
    assert.ok(e, '注册行「' + r.id + '」(anchorId=' + r.anchorId + ') 恰对应一条 npc 交互条目(npcId 对账)');
    assert.strictEqual(e.label, r.name, '「' + r.id + '」label=注册表 name(TTS 同源, label 对账)');
    assert.strictEqual(e.sessionKind, r.sessionKind, '「' + r.id + '」sessionKind=注册表定值(会话五值对账)');
  }
  /* 反向: 交互条目 ⊆ 注册表快照(无孤儿条目) */
  const regAnchors = new Set(c.TOWN_NPCS.map((r) => r.anchorId));
  for (const e of npcEntries) {
    assert.ok(regAnchors.has(e.anchorId),
        '条目「' + e.id + '」anchorId 在注册表 anchorId 集内(条目 ⊆ 注册表, 零私生键)');
  }
  /* 动物零条目: 纯氛围不进交互协议(注册表校验「动物必无 sessionKind」的消费面) */
  const animalAnchors = new Set(c.TOWN_NPCS.filter((r) => r.category === 'animal').map((r) => r.anchorId));
  for (const e of npcEntries) {
    assert.ok(!animalAnchors.has(e.anchorId), '动物锚「' + e.anchorId + '」零交互条目(氛围件不进协议)');
  }
  assert.strictEqual(npcEntries.length, solid.length, '11↔11 双向恰满(不多不少)');
});

/* ============ ④ 宿主建机 npc 条目语义(票面验收 §4.2) ============ */

test('T-NPC-10 建机 npc 语义: focus(npc:v01) 恰一条 target/focus · payload 恰六键形状不变 · ' +
    'found/reset 对 npc 条目成立 · 未知 npc id 仍拼写域炸', () => {
  const c = bridge();
  c.mkMachine();
  /* focus: 恰一条 targetFocus, payload.target 恰六键(townTargetOf 消费最小面) */
  const f = c.machineCall('__m.focus("npc:v01")');
  assert.strictEqual(f.emitted, 1, 'emit 旁路恰一次(与 events 同步)');
  assert.strictEqual(f.r.changed, true, 'focus(npc:v01) 迁移成功(条目在注册集)');
  assert.strictEqual(f.r.events.length, 1, '恰发一条事件');
  assert.strictEqual(f.r.events[0].name, 'town-ui/target/focus', '事件名=冻结表 targetFocus(零新事件名)');
  assert.deepStrictEqual(f.r.events[0].payload.target, {id: 'npc:v01', kind: 'npc',
    iconKey: 'help', label: '阿面', anchor: {x: 79, y: 24, z: 94}, state: 'active'},
  'payload.target 恰六键形状不变(票面验收 §4.2; anchor=站位快照, state 携当前值)');
  /* found: active→done 单向, 恰一条 targetUpdate */
  const fd = c.machineCall('__m.found("npc:v01")').r;
  assert.strictEqual(fd.changed, true, 'found(npc:v01) 迁移成功');
  assert.strictEqual(fd.events.length, 1, 'found 恰一条事件');
  assert.deepStrictEqual(fd.events[0], {name: 'town-ui/target/update',
    payload: {id: 'npc:v01', state: 'done'}}, 'targetUpdate {id, state:done} 对 npc 条目成立');
  /* done 态回看: 重复 focus 再发一条, 携 done 态(机器既有语义对 npc 条目同样成立) */
  const again = c.machineCall('__m.focus("npc:v01")').r;
  assert.strictEqual(again.events[0].payload.target.state, 'done', '完成态回看携 done');
  /* reset: 全量回 active + 清主目标, 零事件 */
  const r = c.machineCall('__m.reset()').r;
  assert.deepStrictEqual(r, {changed: true, events: []}, 'reset 零事件');
  assert.strictEqual(c.machineExpr('__m.snapshot().states["npc:v01"]'), 'active', 'reset 后 npc 条目回 active');
  assert.strictEqual(c.machineExpr('__m.snapshot().focusId'), null, 'reset 清主目标');
  /* 未知 npc id 仍拼写域炸(注册集边界对 npc 条目不放宽) */
  assert.throws(() => c.machineCall('__m.focus("npc:v99")'), /未知目标/, '未知目标「npc:v99」抛拼写域错');
});

test('T-NPC-10 建机 npc 全量: snapshot states 键集=20 条 · focusId 语义零漂移(既有六锚点+三轻任务回归)', () => {
  const c = bridge();
  c.mkMachine();
  const ids = Object.keys(c.machineExpr('__m.snapshot().states')).sort();
  assert.strictEqual(ids.length, 20, 'states 键集 20 条(9 既有 + 11 npc)');
  for (const id of EXISTING_IDS) assert.ok(ids.includes(id), '既有条目「' + id + '」在键集(回归零漂移)');
  for (const id of NPC_IDS) assert.ok(ids.includes(id), 'npc 条目「' + id + '」在键集');
  assert.strictEqual(c.machineExpr('__m.snapshot().focusId'), null, '初始无主目标(零漂移)');
  const fw = c.machineCall('__m.focus("windmill")').r;
  assert.strictEqual(fw.changed, true, '既有条目 focus 迁移照旧(回归)');
  assert.strictEqual(fw.events[0].payload.target.label, '风车', '既有条目 payload 字面照旧(回归)');
});

/* ============ ⑤ 冻结协议守卫(README §0: 不得改形) ============ */

test('T-NPC-10 冻结协议守卫: 事件名表恰四键零增项 · 会话五值冻结 · 交互四类含 npc · 词表/协议常量全 frozen', () => {
  const c = bridge();
  assert.deepStrictEqual(c.TOWN_UI_EVENTS, {targetFocus: 'town-ui/target/focus',
    targetUpdate: 'town-ui/target/update', interactFocus: 'town-ui/interact/focus',
    interactBlur: 'town-ui/interact/blur'}, '事件名表恰四键零增项(冻结协议, 零新事件名)');
  assert.ok(c.TOWN_UI_EVENTS_FROZEN, '事件名表 frozen');
  assert.deepStrictEqual(c.TOWN_SESSION_KINDS, ['greet', 'tour', 'seek', 'help', 'care'],
      '会话五值冻结(sessionKind 域零增项)');
  assert.ok(c.TOWN_SESSION_KINDS_FROZEN, '会话五值 frozen');
  assert.deepStrictEqual(c.TOWN_INTERACT_KINDS.sort(), ['landmark', 'npc', 'prop', 'task'],
      '交互四类(landmark|npc|prop|task)冻结');
});
