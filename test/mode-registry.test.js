'use strict';
/* 模式注册表 (js/mode-registry.js) + index.html 一致性单测 — node --test
   运行: node --test test/mode-registry.test.js
   把"三重命名约定"(注册表 id ↔ cardXxx ↔ menuXxx ↔ 脚本顺序)从口头约定
   变成断言: 注册表加行而 index.html 忘加卡/页/script, 这里立刻红。
   另断言各行 mood 字段(BGM 情绪)与 audio-registry.js 的 MOODS 逐键对齐:
   两处权威各改一半即红(消费端断言先例, 见 test/audio-registry.test.js)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ModeRegistry = require('../js/mode-registry.js');
const {MOODS} = require('../js/audio-registry.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('模式注册表: 派生 id 符合命名约定(cardXxx / menuXxx / xxxBackBtn / xxxEnterBtn)', () => {
  for (const m of ModeRegistry.all) {
    assert.strictEqual(ModeRegistry.cardId(m), 'card' + m.id[0].toUpperCase() + m.id.slice(1), m.id);
    assert.strictEqual(ModeRegistry.pageId(m), 'menu' + m.id[0].toUpperCase() + m.id.slice(1), m.id);
    assert.strictEqual(ModeRegistry.backBtnId(m), m.id + 'BackBtn', m.id);
    assert.match(m.name, /\S/, '每行都有面向家长的显示名(限额文案用)');
  }
});

test('模式注册表: index.html 里卡片/页面/返回/出发按钮逐条在场', () => {
  for (const m of ModeRegistry.all) {
    assert.ok(html.includes('id="' + ModeRegistry.cardId(m) + '"'), '缺模式卡: ' + ModeRegistry.cardId(m));
    if (ModeRegistry.hasPage(m)) {
      assert.ok(html.includes('id="' + ModeRegistry.pageId(m) + '"'), '缺菜单页: ' + ModeRegistry.pageId(m));
      assert.ok(html.includes('id="' + ModeRegistry.backBtnId(m) + '"'), '缺返回按钮: ' + ModeRegistry.backBtnId(m));
    }
    if (m.enter) {
      assert.ok(html.includes('id="' + ModeRegistry.enterBtnId(m) + '"'), '缺出发按钮: ' + ModeRegistry.enterBtnId(m));
    }
  }
});

test('模式注册表: 每个模式的 script 在 main.js 之前加载(经典脚本共享词法环境, 顺序即依赖)', () => {
  const mainAt = html.indexOf('js/main.js');
  assert.ok(mainAt > 0, 'main.js 在 index.html 里');
  for (const m of ModeRegistry.all) {
    const tag = ModeRegistry.scriptSrc(m);
    const at = html.indexOf('src="' + tag + '"');
    assert.ok(at > 0, '缺 script: ' + tag);
    assert.ok(at < mainAt, tag + ' 必须先于 main.js 加载');
  }
});

test('模式注册表: 儿童时限成员 = gated 模式(专注训练营独立预算不入列)', () => {
  assert.deepStrictEqual(ModeRegistry.playModeIds(), ['arena', 'build', 'tank', 'nether', 'adventure']);
  assert.ok(!ModeRegistry.playModeIds().includes('focus'));
});

test('模式注册表: 限额文案的模式名由表派生(漏一个模式不再是手滑)', () => {
  const names = ModeRegistry.playModeNames();
  assert.deepStrictEqual(names, ['竞技场', '建造', '坦克演习场', '下界冒险', '探险模式']);
  assert.ok(!ModeRegistry.playModeNames('build').includes('建造'), '建造页文案排除自身');
  assert.strictEqual(ModeRegistry.playModeNames('build').length, 4);
});

test('模式注册表: mood 字段值 ∈ MOODS 值集且逐键对齐(BGM 接线数据源, 两处权威漂移即红)', () => {
  const legal = new Set(Object.values(MOODS)); /* 合法情绪集 = MOODS 值集(calm/battle/dark/none) */
  for (const m of ModeRegistry.all) {
    assert.ok(legal.has(m.mood),
        m.id + ' 的 mood 未声明或非法: ' + m.mood + ' ∈ ' + [...legal].join('|'));
    assert.strictEqual(m.mood, MOODS[m.id],
        m.id + ' 的 mood 与 audio-registry 的 MOODS.' + m.id + ' 漂移(须二处一致)');
  }
});
