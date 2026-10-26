'use strict';
/* 物品提示注册表 (js/item-hint-registry.js) 单测 — node --test (零依赖)
   运行: node --test test/item-hint-registry.test.js
   加载器: 同一 vm context 依次执行 config.js + items-core.js + item-hint-registry.js —
   精确镜像浏览器 <script defer> 的共享词法环境(镜像 drops.test.js 惯例)。
   本文件承担 -registry 契约的对消费端断言: ITEMS 全键覆盖(新增物品忘写提示即红) ·
   BLOCK_HINTS 键 ⊆ BLOCKS 且覆盖两调色板全号段 1~19(BUILD_PALETTE 与竞技场
   HOTBAR 的数字方块 id ⊆ 1~19, 以号段收口避免装载模式文件) — 话术口径见
   docs/item-hint-design.md §4/§6。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHints() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'items-core.js', 'item-hint-registry.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__h = {ITEMS, BLOCKS, hintForItem, hintForSlot,' +
      ' hintForBlock, ITEM_HINTS, BLOCK_HINTS};', ctx);
  return ctx.__h;
}

/* ============ 对消费端断言: 覆盖与死键(-registry 契约) ============ */

test('覆盖: ITEMS 全键 ⊆ ITEM_HINTS, 说明非空且 ≤24 字(新增物品忘写提示即红)', () => {
  const h = loadHints();
  const missing = Object.keys(h.ITEMS).filter((k) => !(k in h.ITEM_HINTS));
  assert.deepStrictEqual(missing, [], '漏写提示的物品键');
  for (const [k, v] of Object.entries(h.ITEM_HINTS)) {
    assert.strictEqual(typeof v, 'string', k);
    assert.ok(v.length > 0, '说明非空: ' + k);
    assert.ok(v.length <= 24, '说明 ≤24 字: ' + k + ' → ' + v);
  }
});

test('覆盖: ITEM_HINTS 无死键(⊆ ITEMS, 防物品改名后话术悬空)', () => {
  const h = loadHints();
  const dead = Object.keys(h.ITEM_HINTS).filter((k) => !(k in h.ITEMS));
  assert.deepStrictEqual(dead, []);
});

test('覆盖: BLOCK_HINTS 键 ⊆ BLOCKS 且覆盖调色板号段 1~19(建造/竞技场选块全量)', () => {
  const h = loadHints();
  const dead = Object.keys(h.BLOCK_HINTS).filter((k) => !(k in h.BLOCKS) || !h.BLOCKS[k]);
  assert.deepStrictEqual(dead, [], 'BLOCK_HINTS 引用了不存在的方块 id');
  for (let id = 1; id <= 19; id++) {
    assert.ok(id in h.BLOCK_HINTS, '调色板号段缺说明: 方块 ' + id);
    assert.ok(h.BLOCK_HINTS[id].length > 0 && h.BLOCK_HINTS[id].length <= 24, '方块 ' + id + ' 说明长度');
  }
});

/* ============ 解析行为: hintForItem / hintForSlot ============ */

test('hintForItem: 名字取 ITEMS, tts = 名字+逗号+说明; 未注册/空键 → null', () => {
  const h = loadHints();
  const r = h.hintForItem('iron_pick_candidate'); /* 未注册 */
  assert.strictEqual(r, null);
  assert.strictEqual(h.hintForItem(''), null);
  assert.strictEqual(h.hintForItem('apple').name, '苹果');
  assert.strictEqual(h.hintForItem('apple').desc, '香香甜甜，吃了能回血');
  assert.strictEqual(h.hintForItem('apple').tts, '苹果，香香甜甜，吃了能回血');
  /* 生态地图件(设计稿 §6): 新提示走同一 tts 拼装口径 */
  assert.strictEqual(h.hintForItem('snowball').name, '雪球');
  assert.strictEqual(h.hintForItem('cactus').tts, '仙人掌，沙漠里的绿刺柱，不扎手');
});

test('hintForBlock: 未收录说明的方块回落名字-only(名字唯一权威在 BLOCKS)', () => {
  const h = loadHints();
  assert.strictEqual(h.hintForBlock(999), null);
  assert.strictEqual(h.hintForBlock(3).name, '石头'); /* 名字取方块表, 不在话术表复述 */
  assert.strictEqual(h.hintForBlock(3).tts, '石头，结结实实的灰石头');
  const wool = h.hintForBlock(16); /* 红羊毛: 名字即说明的典型(说明句补观感) */
  assert.strictEqual(wool.tts, '红羊毛，红红的软羊毛');
});

test('hintForSlot: 三型槽 — item(含空槽判空) / block / icon 名字-only; null 安全', () => {
  const h = loadHints();
  assert.strictEqual(h.hintForSlot(null), null);
  /* item 型: 有货报提示, cnt()≤0 空槽静默(探险换物/耗尽口径) */
  assert.strictEqual(h.hintForSlot({item: ''}), null);
  assert.strictEqual(h.hintForSlot({item: 'pick_wood'}).tts, '木镐，能挖石头的木头镐');
  assert.strictEqual(h.hintForSlot({item: 'pick_wood', cnt: () => 0}), null, '数量归零 = 没东西可介绍');
  assert.strictEqual(h.hintForSlot({item: 'pick_wood', cnt: () => 1}).name, '木镐');
  assert.strictEqual(h.hintForSlot({item: 'nope'}), null, '未注册物品 → null');
  /* block 型: 建造/竞技场调色板槽 */
  assert.strictEqual(h.hintForSlot({block: 18}).name, '玻璃');
  /* icon 型: 名字即说明(存量槽型——消费先例为已退役的下界武器栏) — 逐字段断言(vm realm 对象不走 deepStrictEqual) */
  const sw = h.hintForSlot({icon: '🗡️', lbl: '剑'});
  assert.strictEqual(sw.name, '剑');
  assert.strictEqual(sw.desc, '');
  assert.strictEqual(sw.tts, '剑');
  assert.strictEqual(h.hintForSlot({icon: '❓'}), null, 'icon 型无名 → null');
});
