'use strict';
/* 装备核心 (js/equipment-core.js) 单测 — node --test (零依赖)
   运行: node --test test/equipment-core.test.js
   加载器: 同一 vm context 依序执行 items-core.js + equipment-core.js —
   精确镜像浏览器 <script defer> 共享词法环境(装备核心调用期经全局名读
   items-core 的 armorOf/ITEMS, 加载序即依赖序, 设计稿 equipment-design §1.2)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEquipment(extra) {
  const ctx = vm.createContext({console});
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'items-core.js'), 'utf8'),
      ctx, {filename: 'items-core.js'});
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'equipment-core.js'), 'utf8'),
      ctx, {filename: 'equipment-core.js'});
  /* extra: 可选注入代码(跑在两模块之后、取接口之前) — vm 里造注册表
     假数据用(kbResist 封顶不变量: 真装备 Σkb 最高 0.4, 0.8 cap 到不了) */
  if (extra) vm.runInContext(extra, ctx);
  vm.runInContext('globalThis.__e = {ITEMS, EQUIP_SLOTS, mkWorn, armorReduce,' +
      ' wornWear, wornPut, armorPoints, toughPoints, kbResist, wornNormalize};', ctx);
  return ctx.__e;
}

/* vm 跨 realm: 嵌套对象原型不同, deepStrictEqual 需先拷回本地 realm
   (JSON 往返; 顶层展开回裹只够一层 — items-core.test.js 先例的嵌套版) */
function local(v) {
  return JSON.parse(JSON.stringify(v));
}

/* ============ 穿戴槽模型 ============ */

test('加载: 顶层暴露槽表 + 8 纯函数(全部切片入列的终态清单)', () => {
  const h = loadEquipment();
  /* vm 跨 realm 数组原型不同, deepStrictEqual 需先拷回本地 realm */
  assert.deepStrictEqual([...h.EQUIP_SLOTS], ['helmet', 'chestplate', 'leggings', 'boots']);
  ['mkWorn', 'armorReduce', 'wornWear', 'wornPut', 'armorPoints', 'toughPoints', 'kbResist', 'wornNormalize']
      .forEach((f) => assert.strictEqual(typeof h[f], 'function', f));
});

test('mkWorn: 四槽全空(老档缺键的归一起点)', () => {
  const {mkWorn, EQUIP_SLOTS} = loadEquipment();
  const w = mkWorn();
  for (const s of EQUIP_SLOTS) assert.strictEqual(w[s], null, s);
});

/* ============ 减伤公式(D7 正典逐字, 期望值=手算独立锚) ============ */

test('armorReduce: 正典公式手算锚(满钻/满皮/满钻零韧/空穿/小伤害)', () => {
  const {armorReduce} = loadEquipment();
  /* 公式 dmg×(1−min(20, max(armor/5, armor−dmg/(2+tough/4)))/25):
     (3,20,8) → 3−3/(2+2)=19.25 → 3×(1−19.25/25)=0.69
     (3,7,0)  → 7−3/2=5.5      → 3×(1−5.5/25)=2.34
     (3,20,0) → 20−1.5=18.5    → 3×(1−18.5/25)=0.78
     (1,20,8) → 20−0.25=19.75  → 1×(1−19.75/25)=0.21 */
  assert.strictEqual(armorReduce(3, 20, 8), 0.69);
  assert.strictEqual(armorReduce(3, 7, 0), 2.34);
  assert.strictEqual(armorReduce(3, 20, 0), 0.78);
  assert.strictEqual(armorReduce(1, 20, 8), 0.21);
  assert.strictEqual(armorReduce(3, 0, 0), 3); /* 空穿=原样 */
});

/* ============ 命中磨损(纯扣减语义, 不读注册表——校验归 wornNormalize) ============ */

test('wornWear: 逐件扣磨损, 归零件槽清空且入 broke(入参不动)', () => {
  const {wornWear} = loadEquipment();
  const w = {helmet: {id: 'helmet_iron', dur: 10}, chestplate: null,
    leggings: null, boots: {id: 'boots_leather', dur: 1}};
  const r = wornWear(w);
  assert.strictEqual(r.worn.helmet.dur, 9);
  assert.strictEqual(r.worn.boots, null); /* 归零=破碎(槽清空, 工具同款消失) */
  assert.deepStrictEqual([...r.broke], ['boots']);
  assert.strictEqual(w.helmet.dur, 10); /* 纯函数: 入参不动 */
  assert.strictEqual(w.boots.dur, 1);
});

test('wornWear: 空穿无破碎; n=1 缺省; 大步磨损照扣', () => {
  const {wornWear} = loadEquipment();
  const empty = wornWear({helmet: null, chestplate: null, leggings: null, boots: null});
  assert.deepStrictEqual([...empty.broke], []);
  const w = {helmet: {id: 'helmet_iron', dur: 10}, chestplate: null,
    leggings: null, boots: null};
  const r = wornWear(w, 3);
  assert.strictEqual(r.worn.helmet.dur, 7);
  assert.deepStrictEqual([...r.broke], []);
});

/* ============ 换装 wornPut(物品行/armorOf 已落地后的核心切片) ============ */

test('wornPut: 空槽穿入 — 槽形存 {id, dur}(n 剥弃, 穿戴件不可堆叠)', () => {
  const {wornPut} = loadEquipment();
  const w = {helmet: null, chestplate: null, leggings: null, boots: null};
  const r = wornPut(w, 'helmet', {id: 'helmet_iron', n: 1, dur: 330});
  assert.deepStrictEqual(local(r.worn),
      {helmet: {id: 'helmet_iron', dur: 330}, chestplate: null, leggings: null, boots: null},
      '入槽剥掉 n 存槽形');
  assert.strictEqual(r.out, null, '空槽无旧件');
  assert.strictEqual(w.helmet, null, '纯函数: 入参不动');
});

test('wornPut: 换装 — 被换下旧件带耐久原样从 out 交还(模式层回包入背包)', () => {
  const {wornPut} = loadEquipment();
  const w = {helmet: {id: 'helmet_leather', dur: 40}, chestplate: null,
    leggings: null, boots: null};
  const r = wornPut(w, 'helmet', {id: 'helmet_iron', n: 1, dur: 330});
  assert.deepStrictEqual(local(r.worn.helmet), {id: 'helmet_iron', dur: 330}, '新件入槽');
  assert.deepStrictEqual(local(r.out), {id: 'helmet_leather', dur: 40}, '旧件原样换出');
});

test('wornPut: 拒收三路 — 槽不符/非盔甲/坏槽名 → 原样 {worn, out:null}(防手滑不抛)', () => {
  const {wornPut} = loadEquipment();
  const w = {helmet: {id: 'helmet_iron', dur: 10}, chestplate: null,
    leggings: null, boots: null};
  /* 靴子往头上戴: armor.slot 与槽不符 */
  const r1 = wornPut(w, 'helmet', {id: 'boots_leather', n: 1, dur: 130});
  assert.strictEqual(r1.out, null, '槽不符拒收');
  assert.strictEqual(r1.worn.helmet, w.helmet, '原穿件不动');
  /* 材料塞槽: 非盔甲 */
  const r2 = wornPut(w, 'chestplate', {id: 'leather', n: 3});
  assert.strictEqual(r2.out, null, '非盔甲拒收');
  /* 坏槽名 */
  const r3 = wornPut(w, 'hat', {id: 'helmet_iron', n: 1, dur: 1});
  assert.strictEqual(r3.out, null, '坏槽名拒收');
});

test('wornPut: dur 缺省=满耐久(durOf 兜底手工栈形)', () => {
  const {wornPut} = loadEquipment();
  const w = {helmet: null, chestplate: null, leggings: null, boots: null};
  const r = wornPut(w, 'chestplate', {id: 'chestplate_netherite', n: 1});
  assert.deepStrictEqual(local(r.worn.chestplate), {id: 'chestplate_netherite', dur: 1184},
      '无 dur 字段=满耐久入槽');
});

/* ============ 合计三函数(设计稿 §6: armorReduce(dmg, armorPoints, toughPoints)) ============ */

test('armorPoints: 穿戴合计盔甲点 — 正典表求和手算锚, 空槽/坏件跳过', () => {
  const {armorPoints, mkWorn} = loadEquipment();
  assert.strictEqual(armorPoints(mkWorn()), 0, '空穿 0');
  const full = (t) => ({
    helmet: {id: 'helmet_' + t, dur: 1}, chestplate: {id: 'chestplate_' + t, dur: 1},
    leggings: {id: 'leggings_' + t, dur: 1}, boots: {id: 'boots_' + t, dur: 1}});
  assert.strictEqual(armorPoints(full('netherite')), 20, '下界 3+8+6+3=20(正典封顶值)');
  assert.strictEqual(armorPoints(full('iron')), 15, '铁 2+6+5+2=15');
  assert.strictEqual(armorPoints(full('leather')), 7, '皮 1+3+2+1=7');
  /* 混穿: 钻帽 3 + 皮胸 3 = 6 */
  assert.strictEqual(armorPoints({
    helmet: {id: 'helmet_diamond', dur: 1}, chestplate: {id: 'chestplate_leather', dur: 1},
    leggings: null, boots: null}), 6);
  /* 坏件(id 未注册)跳过记 0 不炸 — 全量校验归 wornNormalize, 合计只管数 */
  assert.strictEqual(armorPoints({
    helmet: {id: 'not_registered', dur: 1}, chestplate: null, leggings: null, boots: null}), 0);
});

test('toughPoints: 穿戴合计韧性 — 与 armorPoints 同口径遍历(armorReduce 第二入参)', () => {
  const {toughPoints, mkWorn} = loadEquipment();
  assert.strictEqual(toughPoints(mkWorn()), 0, '空穿 0');
  const full = (t) => ({
    helmet: {id: 'helmet_' + t, dur: 1}, chestplate: {id: 'chestplate_' + t, dur: 1},
    leggings: {id: 'leggings_' + t, dur: 1}, boots: {id: 'boots_' + t, dur: 1}});
  assert.strictEqual(toughPoints(full('netherite')), 12, '下界 3×4=12');
  assert.strictEqual(toughPoints(full('diamond')), 8, '钻 2×4=8');
  assert.strictEqual(toughPoints(full('iron')), 0, '铁及以下韧性 0(仅钻/下界有)');
  /* 混穿: 钻帽 2 + 下界靴 3 = 5 */
  assert.strictEqual(toughPoints({
    helmet: {id: 'helmet_diamond', dur: 1}, chestplate: null,
    leggings: null, boots: {id: 'boots_netherite', dur: 1}}), 5);
});

test('kbResist: 穿戴合计击退抗性 — min(0.8, Σkb), 真装备上限 0.4(下界全套)', () => {
  const {kbResist, mkWorn} = loadEquipment();
  assert.strictEqual(kbResist(mkWorn()), 0, '空穿 0');
  const full = (t) => ({
    helmet: {id: 'helmet_' + t, dur: 1}, chestplate: {id: 'chestplate_' + t, dur: 1},
    leggings: {id: 'leggings_' + t, dur: 1}, boots: {id: 'boots_' + t, dur: 1}});
  assert.strictEqual(kbResist(full('netherite')), 0.4, '0.1×4=0.4(真装备上限, 测试记录)');
  assert.strictEqual(kbResist(full('iron')), 0, 'kb 字段缺省当 0(仅下界合金有)');
  /* 单件: 只穿下界靴 = 0.1 */
  assert.strictEqual(kbResist({
    helmet: null, chestplate: null, leggings: null,
    boots: {id: 'boots_netherite', dur: 1}}), 0.1);
});

test('kbResist: 防御性封顶 0.8 — Σkb 超 cap 夹住(不变量兜底, 调用方做 kpow×(1−r))', () => {
  /* vm 注入 kb 0.3 假盔甲四件 → Σ1.2 → cap 0.8(真数据到不了, 注册表形状守门仍在 items-core) */
  const inject =
    'ITEMS.test_helmet={name:"t",armor:{slot:"helmet",tier:"test",pts:1,tough:0,dur:9,kb:0.3}};' +
    'ITEMS.test_chestplate={name:"t",armor:{slot:"chestplate",tier:"test",pts:1,tough:0,dur:9,kb:0.3}};' +
    'ITEMS.test_leggings={name:"t",armor:{slot:"leggings",tier:"test",pts:1,tough:0,dur:9,kb:0.3}};' +
    'ITEMS.test_boots={name:"t",armor:{slot:"boots",tier:"test",pts:1,tough:0,dur:9,kb:0.3}};';
  const {kbResist} = loadEquipment(inject);
  const w = {
    helmet: {id: 'test_helmet', dur: 9}, chestplate: {id: 'test_chestplate', dur: 9},
    leggings: {id: 'test_leggings', dur: 9}, boots: {id: 'test_boots', dur: 9}};
  assert.strictEqual(kbResist(w), 0.8, 'Σkb=1.2 → min(0.8, ·)=0.8');
});

test('组合锚: armorReduce(dmg, armorPoints(worn), toughPoints(worn)) — 模式层实际调用式端到端', () => {
  const {armorPoints, toughPoints, armorReduce} = loadEquipment();
  const full = (t) => ({
    helmet: {id: 'helmet_' + t, dur: 1}, chestplate: {id: 'chestplate_' + t, dur: 1},
    leggings: {id: 'leggings_' + t, dur: 1}, boots: {id: 'boots_' + t, dur: 1}});
  const nl = full('netherite');
  /* 下界全套(armor 20, tough 12)吃 10 伤: inner=20−10/(2+12/4)=18 → 10×(1−18/25)=2.8 */
  assert.strictEqual(armorReduce(10, armorPoints(nl), toughPoints(nl)), 2.8);
  const lf = full('leather');
  /* 皮全套(armor 7, tough 0)吃 10 伤: inner=7−5=2 → max(7/5,2)=2 → 10×(1−2/25)=9.2 */
  assert.strictEqual(armorReduce(10, armorPoints(lf), toughPoints(lf)), 9.2);
});

/* ============ 存档归一 wornNormalize(存档路径: 坏件逐条丢弃, 不修复 dur) ============ */

test('wornNormalize: 好档原样过 — id/dur 保真, 槽形只带 {id, dur}', () => {
  const {wornNormalize} = loadEquipment();
  const w = {helmet: {id: 'helmet_iron', dur: 123}, chestplate: null,
    leggings: null, boots: {id: 'boots_leather', dur: 5}};
  assert.deepStrictEqual(local(wornNormalize(w)), local(w));
});

test('wornNormalize: 老档缺键补 null — 半形状/空对象归全四键', () => {
  const {wornNormalize, mkWorn} = loadEquipment();
  assert.deepStrictEqual(local(wornNormalize({helmet: {id: 'helmet_iron', dur: 10}})),
      {helmet: {id: 'helmet_iron', dur: 10}, chestplate: null, leggings: null, boots: null},
      '只有头键的老档归全');
  assert.deepStrictEqual(local(wornNormalize({})), local(mkWorn()), '空对象=空穿');
});

test('wornNormalize: 坏件逐条丢弃 — 未注册/非盔甲/槽不符/dur 非正数 → 该槽 null(好槽保真)', () => {
  const {wornNormalize} = loadEquipment();
  /* 四坏槽各占一型, 全丢 */
  const bad = wornNormalize({
    helmet: {id: 'not_registered', dur: 5}, /* 未注册 */
    chestplate: {id: 'pick_wood', dur: 5}, /* 非盔甲(工具) */
    leggings: {id: 'boots_leather', dur: 5}, /* 槽不符(靴塞腿槽) */
    boots: {id: 'boots_iron', dur: 0}, /* dur 非正数(0) */
  });
  assert.deepStrictEqual(local(bad),
      {helmet: null, chestplate: null, leggings: null, boots: null}, '四坏全丢');
  /* 一好一坏混档: 金帽保真, 材料塞胸槽丢 */
  const mix = wornNormalize({
    helmet: {id: 'helmet_gold', dur: 7}, chestplate: {id: 'log', dur: 1},
    leggings: null, boots: null});
  assert.deepStrictEqual(local(mix.helmet), {id: 'helmet_gold', dur: 7}, '好槽保真');
  assert.strictEqual(mix.chestplate, null, '非盔甲丢');
  /* dur 缺失/负数/非数字同为坏件 — 存档路径不修复(与 wornPut 交互路径政策不同) */
  for (const dur of [undefined, -3, '10', NaN]) {
    const r = wornNormalize({helmet: {id: 'helmet_iron', dur},
      chestplate: null, leggings: null, boots: null});
    assert.strictEqual(r.helmet, null, 'dur=' + String(dur) + ' → 丢弃不修复');
  }
});

test('wornNormalize: 幂等 — 归一两次与一次同结果(存档往返安全)', () => {
  const {wornNormalize} = loadEquipment();
  const raw = {helmet: {id: 'x', dur: -3}, chestplate: null,
    leggings: {id: 'leggings_iron', dur: 9}, boots: null, tail: {id: 'log', dur: 1}};
  const once = wornNormalize(raw);
  assert.deepStrictEqual(local(wornNormalize(once)), local(once), 'normalize∘normalize = normalize');
  assert.ok(!('tail' in once), '多余键不带走');
});

test('wornNormalize: 垃圾入参防炸 — null/标量返回空穿(存档容错最后一道)', () => {
  const {wornNormalize, mkWorn} = loadEquipment();
  assert.deepStrictEqual(local(wornNormalize(null)), local(mkWorn()));
  assert.deepStrictEqual(local(wornNormalize(42)), local(mkWorn()));
  assert.deepStrictEqual(local(wornNormalize('x')), local(mkWorn()));
  /* 槽位本身非对象也是坏件 */
  const r = wornNormalize({helmet: 42, chestplate: null, leggings: null, boots: null});
  assert.strictEqual(r.helmet, null, '槽对象非对象 → 丢弃');
});
