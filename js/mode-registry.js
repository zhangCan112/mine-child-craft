'use strict';
/* ============================================================
   模式注册表 (ModeRegistry, 术语见 GLOSSARY.md) — 应用层
   ------------------------------------------------------------
   游玩模式清单的唯一权威: 一行派生 模式卡 DOM id / 菜单页 DOM id /
   返回按钮 id / 出发按钮 id / 脚本路径 / 儿童时限成员 / 限额文案的
   模式名清单。main.js 只消费, 不再另持 MODE_CARDS/pages/手写文案三份
   影子(曾出现"文案漏提坦克/下界"的漂移)。
   新增模式 = index.html 加卡+加页+加 script, 这里加一行。
   三重命名约定(id ↔ cardXxx ↔ menuXxx)由 test/mode-registry.test.js
   对着 index.html 逐条断言, 手滑即红。
   纯数据+纯函数, Node 可直接加载。
   ============================================================ */
const MODE_REGISTRY = [
  {id: 'arena', name: '竞技场', gated: true},
  {id: 'tnt', name: 'TNT 密室', gated: true, menu: true}, /* menu: 进页后刷新模式出发配置页 */
  {id: 'focus', name: '专注训练营', gated: false, page: false}, /* 接管全屏 UI, 无菜单页/不计儿童时限 */
  {id: 'build', name: '建造', gated: true, menu: true},
  {id: 'tank', name: '坦克演习场', gated: true, menu: true, src: 'js/modes/tank-range.js'},
  {id: 'nether', name: '下界冒险', gated: true, menu: true, enter: true}, /* enter: 出发页有"进入"按钮(锁指针) */
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cardId = (m) => 'card' + cap(m.id);
const pageId = (m) => 'menu' + cap(m.id);
const backBtnId = (m) => m.id + 'BackBtn';
const enterBtnId = (m) => m.id + 'EnterBtn';
const hasPage = (m) => m.page !== false;
const scriptSrc = (m) => m.src || ('js/modes/' + m.id + '.js');

const playModeIds = () => MODE_REGISTRY.filter((m) => m.gated).map((m) => m.id);
const playModeNames = (withoutId) =>
  MODE_REGISTRY.filter((m) => m.gated && m.id !== withoutId).map((m) => m.name);

const ModeRegistry = {all: MODE_REGISTRY, cardId, pageId, backBtnId, enterBtnId,
  hasPage, scriptSrc, playModeIds, playModeNames};
if (typeof module !== 'undefined' && module.exports) module.exports = ModeRegistry;
