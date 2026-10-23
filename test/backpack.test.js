'use strict';
/* 背包壳 (js/backpack.js) 单测 — node --test (零依赖)
   运行: node --test test/backpack.test.js
   S6/ADR 0002: inventory_save 由背包壳唯一持有——本文件守两件事:
   ① 装配口径(load/save 往返、空档回落、引用稳定); ② 唯一持有守门
   (存档键字面量只许出现在 backpack.js, 消费方不得自开键)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
/* 真引擎件: items-core + inventory-core 共享一个 vm 词法环境(背包规则归核心) */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/items-core.js', 'js/inventory-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({ITEMS, mkInventory, add, count, serialize, deserialize, INV_SLOTS})`, eng);
Object.assign(globalThis, api); /* 背包壳经全局名消费(inventory-core 无导出守卫, 经 vm 铺全局) */

/* 假 SyncDB(adventure-mode.test.js 同款): 真 mkSaveSlot 包内存 Map */
const mem = new Map();
globalThis.SyncDB = {
  ready: Promise.resolve(),
  slot(key, schema) {
    return require('../js/save-slot.js').mkSaveSlot({
      get: (k)=> (mem.has(k) ? mem.get(k) : null),
      set: (k, v)=> {
        mem.set(k, v);
      },
      remove: (k)=> {
        mem.delete(k);
      },
    }, key, schema);
  },
};

const Backpack = require('../js/backpack.js');

test('背包壳: load/save 往返 — T5 形状 {_v:1,slots} 落盘, 槽位与耐久恢复', () => {
  mem.clear();
  const bag = Backpack.mkBackpack();
  api.add(bag.inv, 'log', 3);
  api.add(bag.inv, 'pick_wood', 1);
  const ti = bag.inv.slots.findIndex((s) => s && s.id === 'pick_wood');
  bag.inv.slots[ti].dur = 77; /* 手工压低耐久(往返保真断言) */
  bag.save();
  const saved = JSON.parse(mem.get('inventory_save'));
  assert.strictEqual(saved._v, 1, '版本号');
  assert.strictEqual(saved.slots.length, api.INV_SLOTS, '27 槽形状');
  /* 新壳实例(模拟重进/另一消费方)从同一介质恢复 */
  const bag2 = Backpack.mkBackpack();
  bag2.load();
  assert.strictEqual(api.count(bag2.inv, 'log'), 3, '原木恢复');
  assert.strictEqual(bag2.inv.slots[ti].id, 'pick_wood', '工具槽恢复');
  assert.strictEqual(bag2.inv.slots[ti].dur, 77, '耐久随槽往返');
});

test('背包壳: 空档/损坏回落空包 + inv 引用跨 load 稳定(消费方闭包不脱钩)', () => {
  mem.clear();
  const bag = Backpack.mkBackpack();
  bag.load();
  assert.strictEqual(bag.inv.slots.filter(Boolean).length, 0, '空档 = 27 空槽(defaults 路径)');
  api.add(bag.inv, 'coal', 2);
  mem.set('inventory_save', JSON.stringify({_v: 1, slots: [{id: 'coal', n: -3}]})); /* 损坏单槽 */
  const same = bag.load();
  assert.strictEqual(same, bag.inv, 'load 返回同一引用');
  assert.strictEqual(bag.inv.slots.every((s) => !s), true, '非法槽归 null(inventory-core 口径)');
});

test('背包壳: ADR 0002 唯一持有守门 — inventory_save 键字面量只在 backpack.js', () => {
  const KEY = 'inventory_save'; /* 守门对象: 存档键字面量 */
  const bp = fs.readFileSync(path.join(ROOT, 'js', 'backpack.js'), 'utf8');
  assert.ok(bp.includes(KEY), 'backpack.js 持有存档键(BACKPACK_KEY 定义处)');
  for (const f of ['js/modes/adventure.js', 'js/adventure-core.js', 'js/main.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!src.includes(KEY),
        f + ' 不得出现 inventory_save 字面量(消费方必须经背包壳, ADR 0002)');
  }
});
