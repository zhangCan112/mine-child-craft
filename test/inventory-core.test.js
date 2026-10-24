'use strict';
/* 背包核心 (js/inventory-core.js) 单测 — node --test (零依赖)
   运行: node --test test/inventory-core.test.js
   加载器: 同一 vm context 依次执行 items-core.js + inventory-core.js,
   镜像浏览器 <script defer> 共享词法环境(多文件加载同 test/tank-core.test.js);
   背包核心只依赖物品注册表, 不碰 config.js / THREE / DOM。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadInv() {
  const ctx = vm.createContext({console});
  for (const f of ['items-core.js', 'inventory-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  const get = vm.runInContext('(k) => eval(k)', ctx); // 未实现符号 → undefined(红在断言处)
  const names = ['ITEMS', 'stackMax', 'mkStack', 'mkInventory', 'add', 'count', 'canAfford',
    'take', 'remove', 'moveSlot', 'damageTool', 'serialize', 'deserialize', 'HOTBAR_SLOTS', 'MAIN_SLOTS', 'INV_SLOTS'];
  const h = {};
  for (const n of names) {
    try {
      h[n] = get(n);
    } catch { // 符号未实现 = undefined, 让测试红在断言处
      h[n] = undefined;
    }
  }
  return h;
}

/* vm 产物先克隆回本 realm 再 deepStrictEqual(严比原型, 先例 items-core.test.js
   的 {...mkStack(...)}); null 原样返回 */
const snap = (s) => (s == null ? s : {...s});

/* ============ 27 槽模型 ============ */

test('mkInventory: 27 槽全空(9 快捷 + 18 主格), 常量派生一致', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  assert.strictEqual(h.INV_SLOTS, 27);
  assert.strictEqual(h.HOTBAR_SLOTS, 9);
  assert.strictEqual(h.MAIN_SLOTS, 18);
  assert.strictEqual(h.HOTBAR_SLOTS + h.MAIN_SLOTS, h.INV_SLOTS);
  assert.strictEqual(inv.slots.length, 27);
  inv.slots.forEach((s) => assert.strictEqual(s, null));
});

/* ============ add: 并堆优先 → 首个空位 → 满则拒收 ============ */

test('add: 未注册物品全拒收, 返回余量且背包不动(stackMax=0 门禁)', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  assert.strictEqual(h.add(inv, 'not_an_item', 5), 5);
  inv.slots.forEach((s) => assert.strictEqual(s, null));
});

test('add: 空包进首个快捷槽, 再进优先并堆而非占新位', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  assert.strictEqual(h.add(inv, 'log', 3), 0);
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'log', n: 3});
  assert.strictEqual(h.add(inv, 'log', 2), 0);
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'log', n: 5}); // 并堆
  assert.strictEqual(inv.slots.filter((s) => s).length, 1); // 仍只占一槽
});

test('add: 并堆受 64 上限约束, 溢出部分落首个空位(拆堆)', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  assert.strictEqual(h.add(inv, 'coal', 64), 0);
  assert.strictEqual(h.add(inv, 'coal', 30), 0);
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'coal', n: 64}); // 老堆打满
  assert.deepStrictEqual(snap(inv.slots[1]), {id: 'coal', n: 30}); // 溢出走空位
});

test('add: 全包打满后拒收, 返回放不下的余量(跨多空位收容)', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  for (let i = 0; i < 27; i++) assert.strictEqual(h.add(inv, 'dirt', 64), 0); // 27 堆全满
  assert.strictEqual(h.add(inv, 'dirt', 70), 70); // 无空位无并堆空间
  // 腾一个半满槽: 64-40=24 并堆空间收下后, 剩 26 无空位 → 余量 26
  inv.slots[13] = {id: 'dirt', n: 40};
  assert.strictEqual(h.add(inv, 'dirt', 50), 26);
  assert.deepStrictEqual(snap(inv.slots[13]), {id: 'dirt', n: 64});
});

test('add: 工具(堆叠1)永不并堆, 各占空位且带满耐久', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  assert.strictEqual(h.add(inv, 'pick_wood', 3), 0); // n 钳到 1
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'pick_wood', n: 1, dur: 120});
  assert.strictEqual(h.add(inv, 'pick_wood', 1), 0);
  assert.deepStrictEqual(snap(inv.slots[1]), {id: 'pick_wood', n: 1, dur: 120});
  assert.strictEqual(inv.slots[0].n, 1); // 没并进老堆
});

/* ============ count: 跨槽合计 ============ */

test('count: 同物品散在多槽(含主格)合计, 不在包=0', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'coal', n: 64};
  inv.slots[9] = {id: 'coal', n: 30}; // 主格的堆照样计入
  inv.slots[10] = {id: 'stick', n: 4};
  assert.strictEqual(h.count(inv, 'coal'), 94);
  assert.strictEqual(h.count(inv, 'stick'), 4);
  assert.strictEqual(h.count(inv, 'diamond'), 0);
});

/* ============ canAfford: {itemId:n} 计费 + 任选材料数组项 ============ */

test('canAfford: 普通计费, 跨槽合计够即 true, 不足 false, 不改包', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'planks', n: 3};
  inv.slots[5] = {id: 'planks', n: 2};
  assert.strictEqual(h.canAfford(inv, {planks: 4}), true); // 3+2 跨槽合计
  assert.strictEqual(h.canAfford(inv, {planks: 6}), false);
  assert.strictEqual(h.canAfford(inv, {planks: 5, stick: 1}), false); // 一项不足即不足
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'planks', n: 3}); // 只查不扣
});

test('canAfford: 任选材料数组项(设计稿 §3.2 火把配方), 候选合计判定', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'coal', n: 1}; // 单候选都不够
  inv.slots[9] = {id: 'charcoal', n: 1}; // 合起来才够
  inv.slots[2] = {id: 'stick', n: 1}; // 火把另一料: 木棍
  const torchCost = {fuel: [['coal', 'charcoal'], 2], stick: 1};
  assert.strictEqual(h.canAfford(inv, torchCost), true); // 煤+木炭各 1 合计 2
  inv.slots[9].n = 0; // 合计掉到 1
  assert.strictEqual(h.canAfford(inv, torchCost), false);
  assert.strictEqual(h.canAfford(inv, {any: [['coal', 'charcoal'], 1]}), true); // 键名只是占位, 判定看候选
});

/* ============ take: 扣料边界(同物品多堆拆堆 · 任选顺序) ============ */

test('take: 同物品多堆正确拆(64 上限拆出的堆), 从前向后扣', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'coal', n: 64};
  inv.slots[1] = {id: 'coal', n: 30};
  inv.slots[2] = {id: 'stick', n: 10};
  assert.strictEqual(h.take(inv, {coal: 70, stick: 2}), true);
  assert.strictEqual(inv.slots[0], null); // 首堆 64 全部拿走 → 清槽
  assert.deepStrictEqual(snap(inv.slots[1]), {id: 'coal', n: 24}); // 次堆补扣 6
  assert.deepStrictEqual(snap(inv.slots[2]), {id: 'stick', n: 8});
  assert.strictEqual(h.count(inv, 'coal'), 24);
});

test('take: 任选材料按候选顺序优先扣, 可跨候选凑数', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'coal', n: 1};
  inv.slots[1] = {id: 'charcoal', n: 3};
  assert.strictEqual(h.take(inv, {fuel: [['coal', 'charcoal'], 2]}), true);
  assert.strictEqual(inv.slots[0], null); // coal 先扣光
  assert.deepStrictEqual(snap(inv.slots[1]), {id: 'charcoal', n: 2});
});

test('take: 料不足则整体不动并返回 false(防御漏检 canAfford)', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'planks', n: 1};
  inv.slots[1] = {id: 'stick', n: 5};
  assert.strictEqual(h.take(inv, {planks: 2, stick: 1}), false);
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'planks', n: 1}); // stick 不被殃及
  assert.deepStrictEqual(snap(inv.slots[1]), {id: 'stick', n: 5});
});

/* ============ remove: 槽级移除(UI 拖拽/丢弃/耐久归零清槽的底座) ============ */

test('remove: 默认整槽移除, 返回被移除堆的拷贝, 原槽清空', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[3] = {id: 'coal', n: 40};
  const out = h.remove(inv, 3);
  assert.deepStrictEqual(snap(out), {id: 'coal', n: 40});
  assert.strictEqual(inv.slots[3], null);
});

test('remove: 指定 n 只拿走部分(工具/食物消耗一口), 请求超量按整槽钳制', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'apple', n: 3};
  assert.deepStrictEqual(snap(h.remove(inv, 0, 1)), {id: 'apple', n: 1}); // 吃一口
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'apple', n: 2});
  assert.deepStrictEqual(snap(h.remove(inv, 0, 99)), {id: 'apple', n: 2}); // 超量=剩下的全部
  assert.strictEqual(inv.slots[0], null);
});

test('remove: 空槽返回 null 不炸', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  assert.strictEqual(h.remove(inv, 7), null);
});

/* ============ moveSlot: 点选搬运(空位搬家 · 同物并堆 · 异种对调) ============ */

test('moveSlot: 目标空位=整摞搬家(快捷栏→主格/主格→快捷栏), 耐久随堆', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[2] = {id: 'coal', n: 10};
  inv.slots[9] = h.mkStack('pick_iron'); // dur 500
  assert.strictEqual(h.moveSlot(inv, 2, 20), true); // 快捷栏 → 主格空位
  assert.deepStrictEqual(snap(inv.slots[20]), {id: 'coal', n: 10});
  assert.strictEqual(inv.slots[2], null);
  assert.strictEqual(h.moveSlot(inv, 9, 0), true); // 主格工具 → 快捷栏空位
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'pick_iron', n: 1, dur: 500}); // 耐久不被重铸
  assert.strictEqual(inv.slots[9], null);
});

test('moveSlot: 同物并堆——目标吃满, 余量留原槽; 全并下则源槽清空', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'coal', n: 40};
  inv.slots[9] = {id: 'coal', n: 50}; // 64 上限: 只吃得下 24
  assert.strictEqual(h.moveSlot(inv, 9, 0), true);
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'coal', n: 64});
  assert.deepStrictEqual(snap(inv.slots[9]), {id: 'coal', n: 26}); // 余量留原槽
  inv.slots[10] = {id: 'log', n: 5};
  inv.slots[11] = {id: 'log', n: 30};
  assert.strictEqual(h.moveSlot(inv, 11, 10), true);
  assert.deepStrictEqual(snap(inv.slots[10]), {id: 'log', n: 35});
  assert.strictEqual(inv.slots[11], null); // 全并下 → 源槽清空
});

test('moveSlot: 异种=整摞对调(快捷栏换序的底座); 同物工具(上限1)也对调不并堆', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'coal', n: 10};
  inv.slots[8] = {id: 'torch', n: 4};
  assert.strictEqual(h.moveSlot(inv, 0, 8), true); // 异种对调 = 调整快捷栏顺序
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'torch', n: 4});
  assert.deepStrictEqual(snap(inv.slots[8]), {id: 'coal', n: 10});
  inv.slots[1] = {id: 'pick_stone', n: 1, dur: 100}; // 同 id 两把工具, 耐久不同
  inv.slots[2] = {id: 'pick_stone', n: 1, dur: 260};
  assert.strictEqual(h.moveSlot(inv, 1, 2), true);
  assert.deepStrictEqual(snap(inv.slots[1]), {id: 'pick_stone', n: 1, dur: 260}); // 对调, 耐久随堆
  assert.deepStrictEqual(snap(inv.slots[2]), {id: 'pick_stone', n: 1, dur: 100});
});

test('moveSlot: 原地/源空/同物目标已满 均 false 且不动包', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[3] = {id: 'coal', n: 64};
  assert.strictEqual(h.moveSlot(inv, 3, 3), false); // 原地
  assert.strictEqual(h.moveSlot(inv, 5, 9), false); // 源空
  inv.slots[9] = {id: 'coal', n: 64};
  assert.strictEqual(h.moveSlot(inv, 3, 9), false); // 同物已满: 点了也白点
  assert.deepStrictEqual(snap(inv.slots[3]), {id: 'coal', n: 64});
  assert.deepStrictEqual(snap(inv.slots[9]), {id: 'coal', n: 64});
});

/* ============ damageTool: 耐久政策在本层, 归零只发信号 ============ */

test('damageTool: 工具槽 dur-1 返回剩余耐久, 槽内同步', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = h.mkStack('pick_stone'); // dur 260
  assert.strictEqual(h.damageTool(inv, 0), 259);
  assert.strictEqual(inv.slots[0].dur, 259);
});

test('damageTool: 归零恰返回 0(破板信号), 但槽不自动清(消失+安抚政策在模式层 D4/D9)', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'sword_wood', n: 1, dur: 1};
  assert.strictEqual(h.damageTool(inv, 0), 0); // 破板信号
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'sword_wood', n: 1, dur: 0}); // 槽还在
  assert.strictEqual(h.damageTool(inv, 0), 0); // 已废工具再敲不炸不越界
});

test('damageTool: 非工具槽/空槽返回 null 且不动包', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'coal', n: 5};
  assert.strictEqual(h.damageTool(inv, 0), null); // 材料
  assert.deepStrictEqual(snap(inv.slots[0]), {id: 'coal', n: 5});
  assert.strictEqual(h.damageTool(inv, 5), null); // 空槽
});

/* ============ serialize / deserialize: D12 存档形状往返 ============ */

test('serialize: 产出 D12 存档形状 {slots:27, _v:1}, 深拷贝不与背包共享引用', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  inv.slots[0] = {id: 'coal', n: 40};
  inv.slots[12] = h.mkStack('pick_iron'); // 工具带耐久
  const save = h.serialize(inv);
  assert.strictEqual(save._v, 1);
  assert.strictEqual(save.slots.length, 27);
  assert.deepStrictEqual({...save.slots[0]}, {id: 'coal', n: 40});
  assert.deepStrictEqual({...save.slots[12]}, {id: 'pick_iron', n: 1, dur: 500});
  assert.strictEqual(save.slots[5], null);
  save.slots[0].n = 99; // 改存档不反噬背包
  assert.strictEqual(inv.slots[0].n, 40);
});

test('deserialize: serialize 往返逐槽一致(含空槽与耐久)', () => {
  const h = loadInv();
  const inv = h.mkInventory();
  h.add(inv, 'log', 70); // 64+6 两堆
  h.add(inv, 'axe_diamond', 1); // dur 1500
  const back = h.deserialize(h.serialize(inv));
  for (let i = 0; i < 27; i++) {
    assert.deepStrictEqual(snap(back.slots[i]), snap(inv.slots[i]), '槽 ' + i);
  }
});

test('deserialize: 损坏回落空包(整包非对象/槽数不对/单槽非法 → 该槽置 null)', () => {
  const h = loadInv();
  assert.strictEqual(h.deserialize(null).slots.length, 27); // 整包损坏 → 空包
  assert.strictEqual(h.deserialize('garbage').slots.length, 27);
  assert.strictEqual(h.deserialize({slots: 'x'}).slots.length, 27);
  assert.strictEqual(h.deserialize({slots: [null, null]}).slots.length, 27); // 槽数不对
  const pad27 = (head) => head.concat(new Array(27 - head.length).fill(null)); // 补满 27 格
  const back = h.deserialize({slots: pad27([ // 单槽非法只殃及该槽
    {id: 'coal', n: 3},
    {id: 'ghost_item', n: 1}, // 未注册物品
    {n: 2}, // 缺 id
    {id: 'coal', n: 0}, // 数量非法
    null,
  ])});
  assert.deepStrictEqual({...back.slots[0]}, {id: 'coal', n: 3}); // 合法槽保留
  for (const i of [1, 2, 3, 4]) assert.strictEqual(back.slots[i], null);
});

test('deserialize: 老档缺 _v / 超量数量也按形状校验收容(数量钳回堆叠上限)', () => {
  const h = loadInv();
  const back = h.deserialize({slots: [{id: 'coal', n: 999}].concat(new Array(26).fill(null))}); // 超 64 钳回
  assert.deepStrictEqual({...back.slots[0]}, {id: 'coal', n: 64});
});
