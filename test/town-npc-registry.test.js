'use strict';
/* 城镇 NPC 模型注册表 (js/town-npc-registry.js) 单测 — node --test
   运行: node --test test/town-npc-registry.test.js
   T-NPC-03 红测(规格权威: .scratch/town-design/tickets/T-NPC-03-npc-registry.md;
   conventions §1.2 -registry: 清单唯一权威必有对消费端断言的单测)。
   断言面(全走公共 seam: TOWN_NPCS 数据 + townNpcRegistry 纯函数):
   ①装载链与门面: 14 行 · CommonJS 导出守卫(mob-registry 同款)
   ②三向键集对账(票面核心红线): TOWN_NPCS 键集 == js/mob-look/town_*.js
     文件集 == MobLookKit.keys() town_ 前缀键集(三个独立真源互证)
   ③越域抛错六路(构造即抛, 违规值进消息): id 重复 · key 重复 ·
     sessionKind 越五值域 · 动物带 sessionKind · key 无 look · anchorId 不在册
   ④协议形状: 11 条交互实体 sessionKind ∈ TOWN_SESSION_KINDS · 3 条动物无 ·
     定值表(V01 greet/V04 tour/V02 V03 V05 help; 市集系 V06 seek/V07 greet;
     V08 招呼集会 greet/V09 照看帮忙 help/V10 玩耍互动 greet; G01 care=B7) ·
     五值冻结 · townTargetOf 恰六键不受影响(本票不改 town-interact-core.js)
   ⑤可追溯性: tex 基线(64×64×10 / 64×80 / 32×32×2 / 48×48)与 look 声明一致 ·
     anchorId 恒 npc:+小写 id · 与 TOWN_NPC_ANCHORS 双向对账 · anchor 前缀 npc:
   ⑥行形状定型: id/key 字面 14 键 · PO 冻结名/slug(notes §1, README §0 勿重开) ·
     category/geometry 冻结域 · 村民 expression(帧×4+greet 双模式)+accessory ·
     G01 crack(PO 首版 2 档)+flower · 动物零交互字段 · 恰好键集(无协议泄漏) ·
     可追溯字段(role/postureNote/paletteRef/devNotes)全行非空
   ⑦纯函数: 快照=源字段透传+label(=name, TTS 同源)+faceSrc('facePixels',
     dialog-prebuild §7.2 头像供给) · 同参同输出 · 调用零副作用不改源表
   架构裁决(README §5): 14 实体不进 MOB_TYPES(战斗/掉落注册表); 本票纯数据
   不接线(TOWN_INTERACTS 增 NPC 条目归 T-NPC-10)。
   装具: vm 经典脚本共享词法环境还原(mob-look.test.js 先例) — kit 真实例 +
   14 town look 真声明 + 上游冻结件(interact-core/anchor-core)真装载;
   红期注册表缺席抛明确中文错(town-npc-anchor-core.test.js 同款)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const LOOK_DIR = path.join(ROOT, 'js', 'mob-look');
const REG_REL = 'js/town-npc-registry.js';
const MobLookKit = require('../js/mob-look-kit.js');

/* 独立真源一: js/mob-look/town_*.js 文件集(文件名即 declare 键) */
const townFileKeys = fs.readdirSync(LOOK_DIR)
    .filter((f) => f.startsWith('town_') && f.endsWith('.js'))
    .map((f) => f.slice(0, -3)).sort();

/* ---------- 装具: 装载链 kit → town look×14 → interact-core → anchor-core →
    注册表(票文 §3.3 加载序); 红期新件缺席抛明确中文错 ---------- */
let ctxCache = null;
function registryCtx() {
  if (ctxCache) return ctxCache;
  const regPath = path.join(ROOT, REG_REL);
  if (!fs.existsSync(regPath)) {
    throw new Error('装载链缺少 ' + REG_REL + '(T-NPC-03 红期: 注册表未落实现)');
  }
  const ctx = vm.createContext({
    console: {log() {}, warn() {}, error() {}},
    MobLookKit,
  });
  const files = fs.readdirSync(LOOK_DIR)
      .filter((f) => f.startsWith('town_') && f.endsWith('.js')).sort()
      .map((f) => 'js/mob-look/' + f)
      .concat(['js/town-interact-core.js', 'js/town-npc-anchor-core.js', REG_REL]);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  ctxCache = ctx;
  return ctx;
}

function reg() {
  const raw = vm.runInContext('({TOWN_NPCS, townNpcRegistry, TOWN_SESSION_KINDS,' +
    ' TOWN_NPC_ANCHORS, townTargetOf})', registryCtx());
  /* 先摊平进宿主域(vm 域产物过不了 deepStrictEqual 跨域原型比对,
     town-npc-anchor-core.test.js:181 先例); 函数经包装层桥接, 数据 JSON 往返
     同 realm 化——断言面语义不变, 只换 harness 载体。 */
  return {
    TOWN_NPCS: JSON.parse(JSON.stringify(raw.TOWN_NPCS)),
    TOWN_NPC_ANCHORS: JSON.parse(JSON.stringify(raw.TOWN_NPC_ANCHORS)),
    TOWN_SESSION_KINDS: Array.from(raw.TOWN_SESSION_KINDS),
    /* 冻结性属源对象本身, JSON 往返不保——桥接一条查询面 */
    sessionKindsFrozen: Object.isFrozen(raw.TOWN_SESSION_KINDS),
    townNpcRegistry(list) {
      const arg = list === undefined ? undefined : JSON.parse(JSON.stringify(list));
      return JSON.parse(JSON.stringify(raw.townNpcRegistry(arg)));
    },
    townTargetOf: (entry, snap) => JSON.parse(JSON.stringify(raw.townTargetOf(entry, snap))),
  };
}

/* ---------- 独立真源二: 票面/PO 冻结定值表(期望值来自设计文档字面, 非实现自算) ----------
   PO 冻结默认名(README §0 勿重开) · slug=资产命名(notes §1 ↔ requirements §3
   town_chr_/town_amb_ 前缀) · sessionKind 定值(票面钉死+§5 角色表语义) ·
   gen ACC 附件名(CAST acc) · greet 表情帧双模式(notes §2: V01 browlift 帽饰
   角色 eyesmile) · tex 基线(README §0)。 */
const NAMES = {
  V01: '阿面', V02: '麦芽', V03: '石匠阿砌', V04: '图图', V05: '铁匠炉火',
  V06: '朵朵', V07: '小厨乐乐', V08: '钟叔', V09: '牧童豆豆', V10: '跑跑妮妮',
  G01: '铁守护·阿稳', A01: '小花鸡', A02: '咪喵', A03: '小褐驼',
};
const SLUGS = {
  V01: 'amian', V02: 'maiya', V03: 'aqi', V04: 'tutu', V05: 'luhuo',
  V06: 'duoduo', V07: 'lele', V08: 'zongshu', V09: 'doudou', V10: 'nini',
  G01: 'ashou', A01: 'xiaohuaji', A02: 'mimiao', A03: 'xiaohetuo',
};
const KINDS = {
  V01: 'greet', V02: 'help', V03: 'help', V04: 'tour', V05: 'help',
  V06: 'seek', V07: 'greet', V08: 'greet', V09: 'help', V10: 'greet',
  G01: 'care',
};
const ACCESSORY = {
  V01: 'basket', V02: 'wheat', V03: 'hammer', V04: 'scrolltube', V05: 'tongs',
  V06: 'bouquet', V07: 'tray', V08: 'bell', V09: 'feedbag', V10: 'satchel',
};
const GREET_FRAME = {V01: 'browlift', V02: 'eyesmile', V03: 'eyesmile',
  V04: 'eyesmile', V05: 'eyesmile', V06: 'eyesmile', V07: 'eyesmile',
  V08: 'eyesmile', V09: 'eyesmile', V10: 'eyesmile'};
const TEX = {
  V01: {w: 64, h: 64}, V02: {w: 64, h: 64}, V03: {w: 64, h: 64},
  V04: {w: 64, h: 64}, V05: {w: 64, h: 64}, V06: {w: 64, h: 64},
  V07: {w: 64, h: 64}, V08: {w: 64, h: 64}, V09: {w: 64, h: 64},
  V10: {w: 64, h: 64}, G01: {w: 64, h: 80},
  A01: {w: 32, h: 32}, A02: {w: 32, h: 32}, A03: {w: 48, h: 48},
};
const ID_LITERALS = ['V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08',
  'V09', 'V10', 'G01', 'A01', 'A02', 'A03'];
const FRAMES = ['default', 'greet', 'focus', 'happy'];

/* 行形状定型(票文 §3.1 字段定型): 每类恰好键集, 多余字段=协议泄漏 */
const BASE_KEYS = ['anchorId', 'category', 'devNotes', 'geometry', 'id', 'key',
  'name', 'paletteRef', 'postureNote', 'role', 'slug', 'tex'];
const SHAPE_KEYS = {
  villager: BASE_KEYS.concat(['accessory', 'expression', 'sessionKind']).sort(),
  golem: BASE_KEYS.concat(['crack', 'flower', 'sessionKind']).sort(),
  animal: BASE_KEYS.slice().sort(),
};

const byId = (rows, id) => rows.find((r) => r.id === id);

/* ============================================================
   ① 装载链与门面
   ============================================================ */

test('注册表: 装载链与门面 — 14 行 · CommonJS 导出守卫', () => {
  const c = reg();
  assert.ok(Array.isArray(c.TOWN_NPCS), 'TOWN_NPCS 应为数据数组(纯数据清单)');
  assert.strictEqual(c.TOWN_NPCS.length, 14, '14 实体: V01~V10 十村民+G01+A01~A03');
  assert.strictEqual(typeof c.townNpcRegistry, 'function',
      'townNpcRegistry(list?) 纯函数在门面(镜像 townInteractRegistry)');
  /* CommonJS 导出守卫(Node 测试消费面, mob-registry 同款): 独立沙盒带 module */
  const guard = vm.createContext({module: {exports: {}}});
  vm.runInContext(fs.readFileSync(path.join(ROOT, REG_REL), 'utf8'), guard,
      {filename: REG_REL});
  const exp = guard.module.exports;
  assert.strictEqual(exp.TOWN_NPCS.length, 14, '导出守卫挂 TOWN_NPCS');
  assert.strictEqual(typeof exp.townNpcRegistry, 'function', '导出守卫挂 townNpcRegistry');
});

/* ============================================================
   ② 三向键集对账(票面核心红线, 验收 1)
   ============================================================ */

test('注册表: 三向键集对账 — TOWN_NPCS == town_*.js 文件集 == kit town_ 键集', () => {
  const c = reg();
  const regKeys = c.TOWN_NPCS.map((r) => r.key).sort();
  const kitKeys = MobLookKit.keys().filter((k) => k.startsWith('town_')).sort();
  assert.deepStrictEqual(regKeys, townFileKeys,
      'TOWN_NPCS 键集 == js/mob-look/town_*.js 文件集(文件名=键, 无私生无缺档)');
  assert.deepStrictEqual(regKeys, kitKeys,
      'TOWN_NPCS 键集 == MobLookKit.keys() town_ 前缀键集(引擎侧零私生)');
});

/* ============================================================
   ③ 越域抛错六路(验收 3: 各给一条坏清单, 构造即抛, 违规值进消息)
   ============================================================ */

test('注册表: 越域抛错 — id/key 重复 · sessionKind 越域 · 动物带 sessionKind', () => {
  const {TOWN_NPCS, townNpcRegistry} = reg();
  const bad = (mutate) => {
    const list = JSON.parse(JSON.stringify(TOWN_NPCS));
    mutate(list);
    return list;
  };
  assert.throws(() => townNpcRegistry(bad((l) => {
    l[1].id = 'V01';
  })), (e) => e.message.includes('V01'), 'id 重复构造即抛(违规值进消息)');
  assert.throws(() => townNpcRegistry(bad((l) => {
    l[1].key = 'town_v01';
  })), (e) => e.message.includes('town_v01'), 'key 重复构造即抛(违规值进消息)');
  assert.throws(() => townNpcRegistry(bad((l) => {
    l[0].sessionKind = 'play';
  })), (e) => e.message.includes('play'),
  'sessionKind 越五值域构造即抛(冻结域 greet|tour|seek|help|care)');
  assert.throws(() => townNpcRegistry(bad((l) => {
    byId(l, 'A01').sessionKind = 'greet';
  })), (e) => e.message.includes('A01'), '动物带 sessionKind 构造即抛(纯氛围非交互)');
});

test('注册表: 越域抛错 — key 无 look · anchorId 不在册', () => {
  const {TOWN_NPCS, townNpcRegistry} = reg();
  const bad = (mutate) => {
    const list = JSON.parse(JSON.stringify(TOWN_NPCS));
    mutate(list);
    return list;
  };
  assert.throws(() => townNpcRegistry(bad((l) => {
    l[0].key = 'town_ghost';
  })), (e) => e.message.includes('town_ghost'),
  'key 必有 look(MobLookKit.has 调用期解析, 私生键即抛)');
  assert.throws(() => townNpcRegistry(bad((l) => {
    l[0].anchorId = 'npc:v99';
  })), (e) => e.message.includes('npc:v99'),
  'anchorId 必在 TOWN_NPC_ANCHORS 在册(锚点在册性)');
});

/* ============================================================
   ④ 协议形状(验收 4)
   ============================================================ */

test('注册表: 协议形状 — 11 交互 sessionKind ∈ 五值 · 3 动物无 · 定值表', () => {
  const c = reg();
  const villagers = c.TOWN_NPCS.filter((r) => r.category === 'villager');
  const golems = c.TOWN_NPCS.filter((r) => r.category === 'golem');
  const animals = c.TOWN_NPCS.filter((r) => r.category === 'animal');
  assert.strictEqual(villagers.length, 10, '十村民');
  assert.strictEqual(golems.length, 1, 'G01 一只');
  assert.strictEqual(animals.length, 3, '氛围动物三只');
  for (const r of villagers.concat(golems)) {
    assert.ok(c.TOWN_SESSION_KINDS.includes(r.sessionKind),
        r.id + ' sessionKind「' + r.sessionKind + '」∈ 冻结五值');
    assert.strictEqual(r.sessionKind, KINDS[r.id],
        r.id + ' sessionKind 定值表(票面钉死+§5 角色表语义)');
  }
  for (const r of animals) {
    assert.ok(!('sessionKind' in r), r.id + ' 动物无 sessionKind(纯氛围非交互)');
  }
});

test('注册表: 协议冻结消费 — 五值冻结 · townTargetOf 恰六键不受影响', () => {
  const c = reg();
  assert.deepStrictEqual(c.TOWN_SESSION_KINDS,
      ['greet', 'tour', 'seek', 'help', 'care'], '会话五值(冻结协议, 只消费不改源)');
  assert.ok(c.sessionKindsFrozen, 'TOWN_SESSION_KINDS 源对象冻结(桥接查询)');
  const t = c.townTargetOf({id: 'x', kind: 'npc', iconKey: 'i', label: '钟塔'},
      {anchor: {x: 0, y: 0, z: 0}, state: 'active'});
  assert.deepStrictEqual(Object.keys(t).sort(),
      ['anchor', 'iconKey', 'id', 'kind', 'label', 'state'],
      'townTargetOf 恰六键(本票不改 town-interact-core.js, 形状零漂移)');
});

/* ============================================================
   ⑤ 可追溯性(验收 5)
   ============================================================ */

test('注册表: 可追溯性 — tex 基线与 look 声明一致 · anchorId npc: 前缀双向对账', () => {
  const c = reg();
  for (const r of c.TOWN_NPCS) {
    assert.deepStrictEqual(r.tex, TEX[r.id],
        r.id + ' tex 基线(村民 64×64 / 傀儡 64×80 / A01 A02 32×32 / A03 48×48)');
    const painted = MobLookKit.textureBuffer(r.key);
    assert.strictEqual(painted.w, r.tex.w,
        r.id + ' tex.w 与 look 声明一致(基线口径零漂移)');
    assert.strictEqual(painted.h, r.tex.h, r.id + ' tex.h 与 look 声明一致');
    assert.strictEqual(r.anchorId, 'npc:' + r.id.toLowerCase(),
        r.id + ' anchorId 恒 npc:+小写 id(镜像 task: 先例)');
  }
  const anchorIds = c.TOWN_NPC_ANCHORS.map((a) => a.id);
  for (const r of c.TOWN_NPCS) {
    assert.ok(anchorIds.includes(r.anchorId), r.id + ' anchorId 在锚点表在册');
  }
  assert.deepStrictEqual(c.TOWN_NPCS.map((r) => r.anchorId).sort(), anchorIds.slice().sort(),
      '注册表↔锚点表双向对账(14=14, 锚 id 空间单源)');
  assert.deepStrictEqual(c.TOWN_NPC_ANCHORS.map((a) => a.npcId).sort(),
      c.TOWN_NPCS.map((r) => r.id).sort(), '锚点表 npcId 反向镜像注册表 id 集');
});

/* ============================================================
   ⑥ 行形状定型
   ============================================================ */

test('注册表: 行形状 — id/key 字面 14 键 · PO 冻结名/slug · category/geometry 冻结域', () => {
  const c = reg();
  assert.deepStrictEqual(c.TOWN_NPCS.map((r) => r.id).sort(), ID_LITERALS.slice().sort(),
      'id 字面 14 键(资产 ID 设计文档口径)');
  assert.deepStrictEqual(c.TOWN_NPCS.map((r) => r.key).sort(), townFileKeys.slice().sort(),
      'key 字面=town look 文件名(=declare 键)');
  const CATS = ['villager', 'golem', 'animal'];
  const GEOM = {villager: 'illager-base', golem: 'golem-town'};
  for (const r of c.TOWN_NPCS) {
    assert.strictEqual(r.name, NAMES[r.id], r.id + ' 中文名=PO 冻结默认名(README §0)');
    assert.strictEqual(r.slug, SLUGS[r.id], r.id + ' slug=资产命名(notes §1)');
    assert.match(r.slug, /^[a-z]+$/, r.id + ' slug 小写 snake(命名规范 §3)');
    assert.ok(CATS.includes(r.category), r.id + ' category ∈ 冻结域');
    const geo = r.category === 'animal' ? r.id.toLowerCase() : GEOM[r.category];
    assert.strictEqual(r.geometry, geo,
        r.id + ' geometry 血统引用(illager-base|golem-town|a01/a02/a03)');
  }
});

test('注册表: 行形状 — 恰好键集(无协议泄漏) · 村民 expression/accessory', () => {
  const c = reg();
  for (const r of c.TOWN_NPCS) {
    assert.deepStrictEqual(Object.keys(r).sort(), SHAPE_KEYS[r.category],
        r.id + ' 行键集恰好定型(' + r.category + ')');
  }
  for (const r of c.TOWN_NPCS.filter((x) => x.category === 'villager')) {
    assert.deepStrictEqual(r.expression.frames, FRAMES,
        r.id + ' 表情帧元数据 ×4(裁决二: 只留数据不实现切换)');
    assert.strictEqual(r.expression.greet, GREET_FRAME[r.id],
        r.id + ' greet 帧双模式(notes §2: V01 browlift / 帽饰角色 eyesmile)');
    assert.strictEqual(r.accessory, ACCESSORY[r.id],
        r.id + ' gen ACC 附件名(装饰追加骨, 随 look 文件)');
  }
});

test('注册表: 行形状 — G01 crack(PO 首版 2 档)+flower · 动物零交互字段', () => {
  const c = reg();
  const g = byId(c.TOWN_NPCS, 'G01');
  assert.deepStrictEqual(g.crack,
      {states: ['ok', 'crack1', 'crack2', 'crack3'], firstVersion: ['ok', 'crack2']},
      'G01 裂纹四档语义+PO 首版 2 档(完好+中裂)');
  assert.deepStrictEqual(g.flower, {box: [4, 4, 4], pose: 'reserved'},
      'G01 花盒数据预留(显隐逻辑后置)');
  for (const r of c.TOWN_NPCS.filter((x) => x.category === 'animal')) {
    for (const k of ['sessionKind', 'expression', 'accessory', 'crack', 'flower']) {
      assert.ok(!(k in r), r.id + ' 动物不带交互/装饰预留字段 ' + k);
    }
  }
});

test('注册表: 可追溯字段 — role/postureNote/paletteRef/devNotes 全行非空', () => {
  const c = reg();
  for (const r of c.TOWN_NPCS) {
    for (const k of ['role', 'postureNote', 'paletteRef', 'devNotes']) {
      assert.strictEqual(typeof r[k], 'string', r.id + '.' + k + ' 应为字符串');
      assert.ok(r[k].length > 0, r.id + '.' + k + ' 非空(可追溯性: 一处收口)');
    }
    assert.ok(r.paletteRef.startsWith('gen '),
        r.id + ' paletteRef 指向 gen 色表(可追溯 notes §1 / spec §5)');
  }
});

/* ============================================================
   ⑦ 纯函数(镜像 townInteractRegistry 风格)
   ============================================================ */

test('注册表: 纯函数 — 快照透传+label+faceSrc · 同参同输出 · 零副作用', () => {
  const {TOWN_NPCS, townNpcRegistry} = reg();
  const before = JSON.parse(JSON.stringify(TOWN_NPCS));
  const s1 = townNpcRegistry();
  const s2 = townNpcRegistry();
  assert.strictEqual(s1.length, 14, '缺省=全表快照');
  assert.deepStrictEqual(s1, s2, '同参同输出(零随机零墙钟)');
  assert.deepStrictEqual(TOWN_NPCS, before, '调用零副作用: 源清单不被改写');
  for (let i = 0; i < TOWN_NPCS.length; i++) {
    const src = TOWN_NPCS[i];
    const snap = s1[i];
    for (const k of Object.keys(src)) {
      assert.deepStrictEqual(snap[k], src[k], '透传: ' + src.id + '.' + k);
    }
    const derived = Object.keys(snap).filter((k) => !(k in src)).sort();
    assert.deepStrictEqual(derived, ['faceSrc', 'label'],
        src.id + ' 快照派生恰两键: label+faceSrc');
    assert.strictEqual(snap.label, src.name, src.id + ' label=name(TTS label 同源)');
    assert.strictEqual(snap.faceSrc, 'facePixels',
        src.id + ' faceSrc=kit 头像裁切供给(dialog-prebuild §7.2 Speaker Strip)');
  }
  assert.deepStrictEqual(townNpcRegistry([TOWN_NPCS[0]]).length, 1,
      '参数清单可用(缺省参数 TOWN_NPCS)');
});

/* ---------- T-NPC-06 F4: greet 帧双源 join 对账(独立真源三: look 文件
   declare 元数据, 捕获桩同 town-npc-look.test.js「表情帧元数据」款)。
   look greet(T-NPC-02 源)与注册表 expression.greet(T-NPC-03 源)原各被
   自己的冻结定值表钉死、无 join——两源各带各的表一致漂移时不被抓住;
   此断言直接对源对账(票面二选一裁决: 择对账断言, 不改注册表派生;
   择 registry.test 侧因装具已装载 14 look 文件, 零新依赖不引入环)。 ---------- */
function lookDeclareMeta() {
  const captured = {};
  const ctx = vm.createContext({MobLookKit: {declare: (k, def) => {
    captured[k] = def;
  }}});
  for (const f of fs.readdirSync(LOOK_DIR)
      .filter((n) => n.startsWith('town_') && n.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(LOOK_DIR, f), 'utf8'), ctx, {filename: f});
  }
  return captured;
}

test('注册表: greet 帧双源 join 对账 — look declare greet == expression.greet(10 村民逐 id; G01/动物两侧皆无)', () => {
  const c = reg();
  const meta = lookDeclareMeta();
  let joined = 0;
  for (const r of c.TOWN_NPCS) {
    assert.ok(meta[r.key], r.id + ' look 声明缺失: ' + r.key);
    if (r.category === 'villager') {
      assert.strictEqual(meta[r.key].greet, r.expression.greet,
          r.id + ' greet 帧双源漂移: look ' + r.key + '.greet=' + meta[r.key].greet +
          ' vs 注册表 expression.greet=' + r.expression.greet +
          '(T-NPC-06 F4 join 对账, 修源须两侧同改)');
      joined++;
    } else {
      assert.strictEqual(meta[r.key].greet, undefined,
          r.id + ' 非村民 look 不带 greet 元数据(02 票: 无表情帧体系)');
      assert.ok(!('expression' in r), r.id + ' 非村民注册行无 expression 字段(03 票行形状)');
    }
  }
  assert.strictEqual(joined, 10, 'join 对账恰覆盖十村民(14 实体全量走查)');
});
