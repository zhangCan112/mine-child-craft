'use strict';
/* 配对方块核心 (js/paired-block-core.js) 单测 — node --test (零依赖)
   运行: node --test test/paired-block-core.test.js
   同名单测(conventions §1.2 守门, 2026-11-04 架构评审候选①新立):
   门/床破坏计划(自 adventure-core.test.js 迁入, 口径不变形状统一
   null|{cells,drops}) + 触发格身份门(bed/lchest 旗标——正典形校验只挡
   轴向误配, 垂直方向邻格假命中在此钉死) + 家族行注册表(行序/行钩)。
   宝箱计划本体在 adventure-dims-core(副本词汇归家), 计划测试主体在
   test/adventure-den.test.js, 此处只钉行契约与身份门。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 真引擎件: config(vm 直载) + 两个上游 -core(require, 装载序在 paired 之前) ---------- */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8'), eng, {filename: 'js/config.js'});
/* adventure-core/dims-core 的模块级表格引用 config 的 B_ 前缀方块号常数:
   require 前先按名单(vm 上下文内求值)铺到 Node globalThis(place-kit.test
   同款; 名单从两份源码动态收集防漏) */
const acSrc = fs.readFileSync(path.join(ROOT, 'js', 'adventure-core.js'), 'utf8');
const dimsSrc = fs.readFileSync(path.join(ROOT, 'js', 'adventure-dims-core.js'), 'utf8');
const bNames = [...new Set((acSrc + dimsSrc).match(/\bB_[A-Z0-9_]+\b/g) || [])];
for (const n of bNames) globalThis[n] = vm.runInContext(n, eng);
const api = vm.runInContext(`({BLOCKS, WORLD_W, WORLD_D, WORLD_H, PLAYER})`, eng);
Object.assign(globalThis, api);
Object.assign(globalThis, require('../js/adventure-core.js')); /* advIsDoor/advIsDoorLower(门计划身份判据) */
Object.assign(globalThis, require('../js/adventure-dims-core.js')); /* advLootChestPlan/
    advLootChestSmallPlan(宝箱计划——行表常量初始化引用, 加载序在本文件之前) */

const PB = require('../js/paired-block-core.js');

/* ---------- 门身份判据(候选③: 旗标单源) ---------- */

test('门身份旗标判据: advIsDoor 四态全真 · advIsDoorLower 恰下两态 · 非门全假(读 config door/doorLower 旗标)', () => {
  for (const id of [B_DOOR, B_DOOR_OPEN, B_DOOR_TOP, B_DOOR_TOP_OPEN]) {
    assert.strictEqual(advIsDoor(id), true, 'id ' + id + ' 是门族');
  }
  assert.strictEqual(advIsDoorLower(B_DOOR), true, '关门(下)带 doorLower');
  assert.strictEqual(advIsDoorLower(B_DOOR_OPEN), true, '开门(下)带 doorLower');
  assert.strictEqual(advIsDoorLower(B_DOOR_TOP), false, '门(上)无 doorLower');
  assert.strictEqual(advIsDoorLower(B_DOOR_TOP_OPEN), false, '门上·开 无 doorLower');
  assert.strictEqual(advIsDoor(B_BED), false, '床不是门');
  assert.strictEqual(advIsDoor(0), false, '空气不是门');
  assert.strictEqual(advIsDoor(3), false, '泥土不是门');
});

/* ---------- 门配对破坏计划(自 adventure-core.test.js 迁入; 返回形状统一 drops[]) ---------- */

test('advDoorBreakPlan 三态: 挖下连上(不补发)/挖上连下(补发1)/挖支撑整扇弹出(补发1) · 无关方块 null', () => {
  const world = {};
  const rd = (x, y, z) => (world[x + ',' + y + ',' + z] || 0);
  const ctx = {id: B_DOOR, rnd: null}; /* 门计划不消费 rnd/身份门(列向判据天然安全) */
  /* 挖掉下半(y 已清 0): 收上半; 下半自带 drop 表已常规掷掉, 计划不补发(2026-11-04 双掉修复) */
  world['1,26,1'] = B_DOOR_TOP;
  assert.deepStrictEqual(PB.advDoorBreakPlan(rd, 1, 25, 1, ctx),
      {cells: [{x: 1, y: 26, z: 1}], drops: []}, '挖下半 → 收上半不补发(防双掉)');
  /* 挖掉上半: 连下半整扇回收, drops 补发 1 扇 */
  world['1,26,1'] = 0; world['1,24,1'] = B_DOOR;
  assert.deepStrictEqual(PB.advDoorBreakPlan(rd, 1, 25, 1, ctx),
      {cells: [{x: 1, y: 24, z: 1}], drops: [{id: 'door', n: 1}]}, '挖上半 → 连下半, drops 补 1');
  /* 挖门正下方支撑: 整扇弹出(下半+上半) */
  world['1,24,1'] = 0; world['2,26,2'] = B_DOOR_OPEN; world['2,27,2'] = B_DOOR_TOP_OPEN;
  assert.deepStrictEqual(PB.advDoorBreakPlan(rd, 2, 25, 2, ctx),
      {cells: [{x: 2, y: 26, z: 2}, {x: 2, y: 27, z: 2}], drops: [{id: 'door', n: 1}]},
      '挖支撑 → 整扇弹出(开门态同款)');
  /* 上半残留缺失时不产出空格(防空 editBlock) */
  world['2,27,2'] = 0;
  assert.deepStrictEqual(PB.advDoorBreakPlan(rd, 2, 25, 2, ctx),
      {cells: [{x: 2, y: 26, z: 2}], drops: [{id: 'door', n: 1}]}, '上格已空 → 只收现存半扇');
  /* 普通方块: 无门牵连(统一契约: null) */
  assert.strictEqual(PB.advDoorBreakPlan(rd, 9, 25, 9, ctx), null, '无关方块零牵连');
});

/* ---------- 床配对破坏计划(自 adventure-core.test.js 迁入 + 触发格身份门) ---------- */

test('advBedBreakPlan 正典形认亲: 挖床尾补1/挖床头不补 · 并排两床不拆错邻床 · 孤儿 null', () => {
  const ctxFoot = {id: B_BED_FOOT, rnd: null};
  const ctxHead = {id: B_BED, rnd: null};
  /* 挖床头(5), 床尾在东(6): 伙伴=床尾 → 床头常规掷已发 1, 计划不补 */
  assert.deepStrictEqual(PB.advBedBreakPlan((x, y, z) => (x === 6 && z === 5 ? B_BED_FOOT : 0), 5, 13, 5, ctxHead),
      {cells: [{x: 6, y: 13, z: 5}], drops: []}, '挖床头: 清床尾, 不补发');
  /* 挖床尾(5), 床头在西(4): 伙伴=床头 → 床尾无 drop 表, 计划补发 1 */
  assert.deepStrictEqual(PB.advBedBreakPlan((x, y, z) => (x === 4 && z === 5 ? B_BED : 0), 5, 13, 5, ctxFoot),
      {cells: [{x: 4, y: 13, z: 5}], drops: [{id: 'bed', n: 1}]}, '挖床尾: 清床头, 补发 1');
  /* 两床并排同轴相接 [头4][尾5·被挖][头6][尾7]: 正典形唯一认亲 → 清(4)不拆错(7) */
  const row = (x, y, z) => (z === 5 ? ({4: B_BED, 6: B_BED, 7: B_BED_FOOT}[x] || 0) : 0);
  assert.deepStrictEqual(PB.advBedBreakPlan(row, 5, 13, 5, ctxFoot),
      {cells: [{x: 4, y: 13, z: 5}], drops: [{id: 'bed', n: 1}]},
      '并排两床: 候选两床头, 正典形(头<尾)唯一认亲头4, 不拆错头6的床尾7');
  /* lone 半(老档单格床): 无配对 → null(统一契约) */
  assert.strictEqual(PB.advBedBreakPlan((x, y, z) => 0, 5, 13, 5, ctxFoot), null, '无邻半 → null');
});

/* ---------- 触发格身份门(2026-11-04 架构评审候选①: 漏油的泛配对收口) ---------- */

test('触发格身份门: 非床 id 的垂直邻格不再假命中床(正典形校验只挡轴向) · 非 lchest id 不再误收贴墙大箱', () => {
  /* 旧缺陷几何: 床头(5)床尾(6)沿 x; 挖床头板正后方石头(5,13,6)——
     旧正典形校验对垂直方向邻格失效(headAxis 5 < footAxis 6 假命中),
     会误收床头; 身份门(ctx.id 读 bed 旗标)在此钉死 */
  const world = {};
  world['5,13,5'] = B_BED; world['6,13,5'] = B_BED_FOOT;
  const rd = (x, y, z) => (world[x + ',' + y + ',' + z] || 0);
  assert.strictEqual(PB.advBedBreakPlan(rd, 5, 13, 6, {id: 3, rnd: null}), null,
      '挖床边石头(非床 id) → null, 床纹丝不动');
  assert.strictEqual(PB.advBedBreakPlan(rd, 6, 13, 6, {id: 3, rnd: null}), null,
      '床尾正后方石头同理 → null');
  /* 旧缺陷几何: 大箱双格贴墙(10/11), 挖贴墙的土(12)——旧四邻认亲无触发格
     门, 会整箱误收; lchest 旗标门在此钉死 */
  world['10,13,10'] = B_LOOT_CHEST; world['11,13,10'] = B_LOOT_CHEST;
  assert.strictEqual(advLootChestPlan(rd, 12, 13, 10, {id: 3, rnd: () => 0.9}), null,
      '挖大箱贴墙邻格(非 lchest id) → null, 箱与战利品不动');
  /* 真触发(挖箱半)照旧: 门放行 → 四邻认亲 + 掷骰恰一次 */
  const p = advLootChestPlan(rd, 11, 13, 10, {id: B_LOOT_CHEST, rnd: () => 0.9});
  assert.deepStrictEqual(p.cells, [{x: 10, y: 13, z: 10}], '挖右半 → 左半入计划');
  assert.strictEqual(p.drops.length, 5, '保底 4 条 + 钻石恒得(0.9 全不中)');
  /* 小箱触发不吃大箱配对(D18 先小箱后大箱 + 大箱身份门双保险) */
  assert.strictEqual(advLootChestPlan(rd, 11, 13, 10, {id: B_LOOT_CHEST_SMALL, rnd: () => 0.9}), null,
      '小箱 id 触发 → 大箱计划自拒(72 邻 71 不误吃)');
});

/* ---------- 家族行注册表(清单唯一权威) ---------- */

test('advPairedBlockRows: 行序=小箱先于大箱(D18) · 四行形状(name/plan) · 钩只挂宝箱两行', () => {
  assert.deepStrictEqual(PB.advPairedBlockRows.map((r) => r.name),
      ['lootChestSmall', 'lootChest', 'door', 'bed'], '家族四行, 小箱行在前');
  for (const r of PB.advPairedBlockRows) {
    assert.strictEqual(typeof r.plan, 'function', r.name + ' 行带 plan');
  }
  assert.strictEqual(PB.advPairedBlockRows[0].hook, 'onLootChestBreak', '小箱行钩=探宝 tally 缝(D19)');
  assert.strictEqual(PB.advPairedBlockRows[1].hook, 'onLootChestBreak', '大箱行钩同缝');
  assert.ok(!PB.advPairedBlockRows[2].hook, '门行无钩');
  assert.ok(!PB.advPairedBlockRows[3].hook, '床行无钩');
  /* 行契约冒烟: 门行 plan 经注册表调用与直调同形 */
  const world = {'1,26,1': B_DOOR_TOP};
  const rd = (x, y, z) => (world[x + ',' + y + ',' + z] || 0);
  assert.deepStrictEqual(PB.advPairedBlockRows[2].plan(rd, 1, 25, 1, {id: B_DOOR}),
      {cells: [{x: 1, y: 26, z: 1}], drops: []}, '行表 plan 即计划函数(零适配)');
});
