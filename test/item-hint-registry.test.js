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

/* ============ 篝火文案守门(篝火票据 T-C10, UI 定稿 §6 D 区) ============
   审计型守门(设计即绿, C3 守门先例): ①§6.5-1 逐字+长度+tts 名字拼装
   ②§6.4 禁词表零命中(⭐R2-3 防回潮——【UI 建议】项, 本票经理线要求落地)
   ③BLOCK_HINTS 改道核对(spec §3.4 裁定: 81/82=零消费死数据不挂,
   熄灭态话术走重燃点击气泡通道, 物品级说明由 ITEM_HINTS.campfire 承担)。 */

/* UI 定稿 §6.4 禁词集(设计冻结, 逐字照抄; spec §3.1 红线词四枚全在列) */
const CF_BANNED = ['风', '升', '上升', '飞', '气流', '翅膀', '翼', '滑翔', '乘', '托', '任务', '倒计时'];

test('T-C10 判据1: ITEM_HINTS.campfire 逐字定稿+≤16 字+tts 名字拼装(UI 定稿 §6.1/§6.5-1)', () => {
  const h = loadHints();
  assert.strictEqual(h.ITEM_HINTS.campfire, '放在地上，烧好久好久，又亮又暖',
      '逐字=UI 定稿 §6.1(禁改写; 不复述名字, 「篝火」二字由 tts 拼装带出)');
  assert.ok(h.ITEM_HINTS.campfire.length <= 16, '长度 ≤16(§6.1 定稿 15 字)');
  const hint = h.hintForItem('campfire');
  assert.strictEqual(hint.name, '篝火', '名字单源 ITEMS');
  assert.strictEqual(hint.tts, '篝火，放在地上，烧好久好久，又亮又暖',
      'tts=名字+，+说明(§6.5-1: 点选读出「篝火，放在地上……」)');
});

test('T-C10 判据2: §6.4 禁词表扫描 — §6.1 物品提示零命中(⭐R2-3 不剧透守门)', () => {
  const h = loadHints();
  for (const w of CF_BANNED) {
    assert.ok(!h.ITEM_HINTS.campfire.includes(w), '禁词「' + w + '」零命中(§6.4 词集)');
  }
});

test('T-C10 判据4(按 spec §3.4 裁定改读): BLOCK_HINTS 无 81/82 行 · 无 campfire 旗标行' +
    '(改道=熄灭态话术走重燃点击气泡通道, 消费面见 place-kit tryCampfireRelight)', () => {
  const h = loadHints();
  assert.ok(!('81' in h.BLOCK_HINTS), '无 81(燃烧态)行——燃烧态条不落注册表(零消费死数据)');
  assert.ok(!('82' in h.BLOCK_HINTS), '无 82(熄灭态)行——重燃可供性话术在点击气泡通道, 不挂注册表');
  const cfIds = Object.keys(h.BLOCKS).filter((k) => h.BLOCKS[k] && h.BLOCKS[k].campfire);
  assert.deepStrictEqual(cfIds.sort(), ['81', '82'],
      '前置: 两态 id=81/82(config 现状; 若号段顺延, 本行随票面施工注记同步)');
  for (const k of cfIds) {
    assert.ok(!(k in h.BLOCK_HINTS), 'campfire 旗标行 ' + k + ' 不落 BLOCK_HINTS(旗标判据, id 改号免疫)');
  }
});
