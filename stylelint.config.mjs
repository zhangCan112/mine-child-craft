// Stylelint 配置 —— 规范正文见 docs/conventions.md，规则依据见 docs/google-style-research.md
// 预设: stylelint-config-standard（错误类 + 约定类规则；现代 stylelint 不管空格排版，
//       排版条款由 Google CSS 格式化落地、规则 declaration-block-single-line-max-declarations 守门）。
const standard = await import('stylelint-config-standard');

export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // 本仓库 DOM id 是模式注册表三元组契约(id ↔ cardXxx ↔ menuXxx, 有测试断言)，
    // Google 指南"id 含连字符"条款不适用于这套契约，豁免（记录于 conventions.md）。
    'selector-id-pattern': null,
    // css 按加载顺序分层覆盖(style.css → focus.css → touch.css)，后层用更高特异性
    // 覆盖前层是既有架构；Google 指南无选择器排序要求，豁免。
    'no-descending-specificity': null,
  },
};
