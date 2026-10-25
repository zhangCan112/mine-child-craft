'use strict';
/* 模式注册表 (js/mode-registry.js) + index.html 一致性单测 — node --test
   运行: node --test test/mode-registry.test.js
   把"三重命名约定"(注册表 id ↔ cardXxx ↔ menuXxx ↔ 脚本顺序)从口头约定
   变成断言: 注册表加行而 index.html 忘加卡/页/script, 这里立刻红。
   另断言各行 mood 字段(BGM 情绪)值 ∈ 合法情绪集 — 模式情绪的唯一
   权威在此(每行必声明), audio-registry 的 MOODS 已收窄为仅 menu。
   覆盖面: 注册表 ↔ index.html(卡/页/按钮/脚本序) ↔ main.js 的 MODES
   影子清单(源文本逐行在场)三方一致; 执行期动态面(键集等价/每键 init
   可调/switchMode 全 id 不抛)在 test/boot.test.js — 双道防线。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ModeRegistry = require('../js/mode-registry.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');

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

test('模式注册表: main.js 的 MODES 影子清单与表零漂移(漏行=点新卡 undefined.init() TypeError)', () => {
  /* "影子清单上锁"的静态源文本面: 只读 main.js 源、不执行代码, 防动态
     探针(test/boot.test.js 的 boot vm)被误删后失守。MODES 手写清单是
     d6fa3c0 合一因技术限制保留的最后一处影子 — 模式对象是经典 script
     顶层 const, 纯数据 registry 反射不到, 只能由 main.js 手写接线;
     注册表加行而忘加键, 本文件其余断言仍全绿, 事故要到用户点新卡才炸,
     这里对着源文本逐键断言(排版: 两空格缩进, 值以 Mode 结尾, 行尾逗号) */
  for (const m of ModeRegistry.all) {
    assert.ok(new RegExp('^ {2}' + m.id + ': \\w+Mode,$', 'm').test(mainSrc),
        'main.js MODES 缺键行: ' + m.id + ': XxxMode,(组合根漏接线, 点卡即 TypeError)');
  }
  const ids = [...mainSrc.matchAll(/^ {2}(\w+): \w+Mode,$/gm)].map((x) => x[1]).sort();
  assert.deepStrictEqual(ids, ModeRegistry.all.map((m) => m.id).sort(),
      'MODES 键行应与注册表键集一致(注册表之外多出的键同样是影子滋生)');
});

test('模式注册表: 儿童时限成员 = gated 模式(专注训练营独立预算不入列)', () => {
  assert.deepStrictEqual(ModeRegistry.playModeIds(), ['arena', 'build', 'tank', 'nether', 'adventure']);
  assert.ok(!ModeRegistry.playModeIds().includes('focus'));
});

test('模式注册表: 训练营类模式(gated:false 接管全屏 UI)清单 = focus + math', () => {
  /* 数学冒险岛与专注训练营同形态: 独立每日预算/无菜单页/不计儿童时限;
     手滑把 math 改成 gated 会把它错并进儿童时限, 这里当场红 */
  const camps = ModeRegistry.all.filter((m) => !m.gated).map((m) => m.id);
  assert.deepStrictEqual(camps, ['focus', 'math']);
});

test('模式注册表: 限额文案的模式名由表派生(漏一个模式不再是手滑)', () => {
  const names = ModeRegistry.playModeNames();
  assert.deepStrictEqual(names, ['竞技场', '建造', '坦克演习场', '下界冒险', '探险模式']);
  assert.ok(!ModeRegistry.playModeNames('build').includes('建造'), '建造页文案排除自身');
  assert.strictEqual(ModeRegistry.playModeNames('build').length, 4);
});

test('模式注册表: mood 字段值 ∈ 合法情绪集且每行必声明(BGM 接线数据源, 模式情绪唯一权威在此)', () => {
  const legal = new Set(['calm', 'battle', 'dark', 'none']);
  /* 合法情绪集: calm/battle/dark = MUSIC_TRACKS 曲目情绪, none = 无配乐;
     引擎侧 MOODS 已收窄为仅 menu */
  for (const m of ModeRegistry.all) {
    assert.ok(legal.has(m.mood),
        m.id + ' 的 mood 未声明或非法: ' + m.mood + ' ∈ ' + [...legal].join('|'));
  }
});
