'use strict';
/* 模式注册表 (js/mode-registry.js) + index.html 一致性单测 — node --test
   运行: node --test test/mode-registry.test.js
   把"三重命名约定"(注册表 id ↔ cardXxx ↔ menuXxx ↔ 脚本顺序)从口头约定
   变成断言: 注册表加行而 index.html 忘加卡/页/script, 这里立刻红。
   另断言各行 mood 字段(BGM 情绪)值 ∈ 合法情绪集 — 模式情绪的唯一
   权威在此(每行必声明), audio-registry 的 MOODS 已收窄为仅 menu。
   覆盖面: 注册表 ↔ index.html(卡/页/按钮/脚本序) ↔ main.js 的 MODES
   影子清单(源文本逐行在场)三方一致; 执行期动态面(键集等价/每键 init
   可调/switchMode 全 id 不抛)在 test/boot.test.js — 双道防线;
   dev 行(体验馆类)另守三层派生产物: 卡带 dev 类 · 样式表隐藏/还原 ·
   main.js ?dev=1 解锁(docs/showroom-design.md D1)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ModeRegistry = require('../js/mode-registry.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const configSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');

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
  assert.deepStrictEqual(ModeRegistry.playModeIds(), ['arena', 'build', 'tank', 'adventure']);
  assert.ok(!ModeRegistry.playModeIds().includes('focus'));
});

test('模式注册表: gated:false 清单 = 两训练营 + 体验馆(dev 调试场)', () => {
  /* 数学冒险岛与专注训练营同形态: 独立每日预算/无菜单页/不计儿童时限;
     体验馆同走 gated:false(孩子任何情况下看不到入口, 也不进儿童时限)。
     手滑把任何一员改成 gated 会把它错并进儿童时限, 这里当场红 */
  const camps = ModeRegistry.all.filter((m) => !m.gated).map((m) => m.id);
  assert.deepStrictEqual(camps, ['focus', 'math', 'showroom']);
});

test('模式注册表: dev 行三层派生产物一致 — 卡在场带 dev 类 · 样式表默认隐藏+解锁还原 · main.js 读 ?dev=1', () => {
  /* dev 可见性(docs/showroom-design.md D1): 注册表 dev:true 是唯一权威,
     HTML 卡声明身份(class 含 dev)、CSS 拥有默认隐藏(构造性防闪现, 弱网下
     也不露脸)、JS 只做解锁(?dev=1 → body.dev-on)。三方都是派生产物,
     这里对着派生端逐条断言(三重命名同款守门路径) — 后来者加 dev 模式
     忘带 dev 类/样式表被删/解锁接线丢, 任一漂移当场红 */
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const devs = ModeRegistry.all.filter((m) => m.dev);
  assert.ok(devs.length > 0, 'dev 行清单非空(体验馆应在册, 注册表漏行=功能不存在)');
  for (const m of devs) {
    const card = new RegExp('<div class="([^"]*)" id="' + ModeRegistry.cardId(m) + '">').exec(html);
    assert.ok(card, '缺 dev 模式卡: ' + ModeRegistry.cardId(m));
    const cls = card[1].split(/\s+/);
    assert.ok(cls.includes('mode-card'), ModeRegistry.cardId(m) + ' 须保留常规卡类 mode-card');
    assert.ok(cls.includes('dev'), ModeRegistry.cardId(m) + ' 的 class 缺 dev 身份类(HTML 身份层)');
  }
  assert.ok(/\.mode-card\.dev\s*\{\s*display:\s*none;\s*\}/.test(css),
      '样式表缺 .mode-card.dev 默认隐藏规则(构造性防闪现的 CSS 层)');
  /* 还原值 = 基类 .mode-card 的 display(单一事实来源: 基类改显示模型,
     还原规则必须跟; 2026-10-28 菜单改版基类从隐式 block 变显式 flex) */
  const baseDisplay = /\.mode-card\s*\{[^}]*?display:\s*(\w+);/.exec(css);
  assert.ok(baseDisplay, '样式表缺 .mode-card 基类 display 声明(dev 还原值的参照)');
  assert.ok(new RegExp('body\\.dev-on\\s+\\.mode-card\\.dev\\s*\\{\\s*display:\\s*' +
      baseDisplay[1] + ';\\s*\\}').test(css),
  '样式表 body.dev-on .mode-card.dev 还原值须与常规卡显示模型(' + baseDisplay[1] + ')一致');
  assert.ok(/const DEV = \(\(\)=>\{[\s\S]*?dev=1/.test(configSrc),
      'config.js 缺 DEV 旗标(?dev=1 读取收口于此, ?touch=1 同款惯例 — dev 能力面的唯一口径)');
  assert.ok(mainSrc.includes('DEV') && mainSrc.includes('dev-on'),
      'main.js 缺 DEV → body.dev-on 解锁接线(旗标读取在 config.js, 这里只做派生消费)');
});

test('模式注册表: 限额文案的模式名由表派生(漏一个模式不再是手滑)', () => {
  const names = ModeRegistry.playModeNames();
  assert.deepStrictEqual(names, ['竞技场', '建造', '坦克演习场', '探险模式']);
  assert.ok(!ModeRegistry.playModeNames('build').includes('建造'), '建造页文案排除自身');
  assert.strictEqual(ModeRegistry.playModeNames('build').length, 3);
});

test('模式注册表: mood 字段值 ∈ 合法情绪集且每行必声明(BGM 接线数据源, 模式情绪唯一权威在此)', () => {
  const legal = new Set(['calm', 'adventure', 'night', 'nether', 'battle', 'none']);
  /* 合法情绪集: calm/adventure/night/nether/battle = MUSIC_TRACKS 曲目情绪
     (探险行只填基线 adventure, 夜晚/下界由壳层 advSyncMood 动态报),
     none = 无配乐; 引擎侧 MOODS 已收窄为仅 menu */
  for (const m of ModeRegistry.all) {
    assert.ok(legal.has(m.mood),
        m.id + ' 的 mood 未声明或非法: ' + m.mood + ' ∈ ' + [...legal].join('|'));
  }
});
