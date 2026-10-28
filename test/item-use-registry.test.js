'use strict';
/* 物品使用动作注册表 (js/item-use-registry.js) 单测 — node --test (零依赖)
   运行: node --test test/item-use-registry.test.js
   加载器: 同一 vm context 依次执行 items-core.js + item-use-registry.js —
   精确镜像浏览器 <script defer> 的共享词法环境(镜像 item-hint-registry.test.js 惯例)。
   本文件承担 -registry 契约的对消费端断言: 键 ⊆ ITEMS(稀疏表防死键——物品
   改名后使用动作不悬空) · 条目形状(act/icon/label 非空) · bow_item 有 'shoot'
   (消费端 adventure.js 的 advUseRun 执行器表绑 'shoot' → advTryShootBow)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadUses() {
  const ctx = vm.createContext({console});
  for (const f of ['items-core.js', 'item-use-registry.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__u = {ITEMS, ITEM_USES, itemUses};', ctx);
  return ctx.__u;
}

/* ============ 对消费端断言(-registry 契约) ============ */

test('稀疏表死键守门: ITEM_USES 键 ⊆ ITEMS(物品改名后使用动作不悬空)', () => {
  const u = loadUses();
  const dead = Object.keys(u.ITEM_USES).filter((k) => !(k in u.ITEMS));
  assert.deepStrictEqual(dead, [], '引用了不存在的物品键');
});

test('条目形状: 每条 act/icon/label 均非空字符串(执行键·按钮图标·无障碍名)', () => {
  const u = loadUses();
  for (const [k, list] of Object.entries(u.ITEM_USES)) {
    assert.ok(Array.isArray(list) && list.length > 0, k + ' 条目是非空数组');
    for (const e of list) {
      assert.strictEqual(typeof e.act, 'string', k + '.act');
      assert.ok(e.act.length > 0, k + '.act 非空');
      assert.strictEqual(typeof e.icon, 'string', k + '.icon');
      assert.ok(e.icon.length > 0, k + '.icon 非空');
      assert.strictEqual(typeof e.label, 'string', k + '.label');
      assert.ok(e.label.length > 0, k + '.label 非空');
    }
  }
});

test('bow_item 有 shoot 动作(adventure.js advUseRun 绑执行器); 普通物品/空键 → null', () => {
  const u = loadUses();
  const bow = u.itemUses('bow_item');
  assert.ok(bow && bow.some((e) => e.act === 'shoot'), 'bow_item 有 shoot');
  assert.strictEqual(u.itemUses('pick_iron'), null, '工具无使用动作 → null');
  assert.strictEqual(u.itemUses(''), null, '空键 → null');
  assert.strictEqual(u.itemUses('nope'), null, '未注册物品 → null');
});
