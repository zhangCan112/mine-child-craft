# Google 代码风格规范（JS/HTML/CSS）· 调研报告

> 调研问题：为本仓库（原生 JS 无构建步骤）选定并落地 Google 代码风格规范，及自动化执行工具链。
> 所有事实性论断附来源 URL 与来源性质（一手指南原文 / 官方仓库 / 官方文档）；抓取失败或只有二手证据的地方明确标注。
> 调研日期：2026-10-22。本地数据（行数/偏差计数）均为本次用命令行抽样统计，标注为【本地核实】。

## 0. 结论先行（TL;DR）

1. **JS 指南已冻结**：官方横幅声明"This guide is no longer being updated. Google recommends migrating to TypeScript"。旧地址 `google.github.io/jsguide/` 已 404，现行地址为 `google.github.io/styleguide/jsguide.html`。对坚持原生 JS 的本仓库，仍可将其作为基准（内容稳定反而利于长期遵守），但应在风格文档中记录这一背景。（来源：[Google JS Style Guide](https://google.github.io/styleguide/jsguide.html)，已抓取）
2. **JS 现状与指南大体同向，属"可收敛"**：2 空格缩进、单引号、分号、const/let、camelCase、kebab-case 文件名均已符合；主要机械偏差是 `if(`/`}else{` 无空格（约 1364 处）、`"use strict"` 用双引号（35/35 文件）、超 80 列约 950 行（9.2%，集中在中文注释）。前三类可 `eslint --fix` 自动收敛，列宽需适配。
3. **HTML/CSS 指南对"格式"确有硬性规定**（冒号后必须一个空格、选择器与 `{` 间必须空格、每个声明独占一行、规则间空行）——本仓库紧凑 CSS **明确不符合**；但"声明按字母排序"是**可选**规则。指南结尾 Parting Words 与 JS 指南 §8.4.1/§8.5 明确允许"尊重存量/本地风格，不必全量重排"。
4. **现代 stylelint 已不检查空格类格式规则**（官方定位改为错误+约定检查，格式交给 Prettier 类工具），因此自动化层面**无法同时**"保留紧凑 CSS"和"符合 Google CSS 格式条款"——只能二选一，或在风格文档中把紧凑 CSS 记录为本地偏离（本报告推荐后者）。
5. **eslint-config-google 只是指南子集**：格式类基本覆盖；明显缺口有 `no-eval`（指南 §5.11.2 禁用但配置里为 off）、`eqeqeq`、JSDoc 强制、CONSTANT_CASE/PascalCase 命名。它只是纯 rules 对象，可直接嵌入 ESLint 9 flat config。
6. **经典 script 架构的 ESLint 要点**：`sourceType: 'script'`，用 `languageOptions.globals` 声明 `THREE` 与各模块导出的顶层绑定，test 目录用 CommonJS globals；`no-undef` 需配合 globals 使用。
7. **stylelint 用 `stylelint-config-standard` + 关 4 条规则即可与现状零冲突**（单行块声明数上限、类名/ID kebab-case 模式、颜色函数记法、媒体查询范围记法），错误类规则（未知属性、重复选择器等）立刻受益。
8. **依赖落地**：仓库当前无 package.json；devDependencies 方案不影响运行时（server.js 仅用 Node 内建模块【本地核实】），但需补 `.gitignore`；npx 直跑仅适合无共享配置的工具（如 htmlhint），eslint/stylelint 的 config 依赖需落到 node_modules。

## 1. JavaScript 指南：关键规则与原文

以下原文均抓取自 [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)（已抓取全文，3885 行）。仓库状态标注为【本仓库已符合 / 不符合 / 指南未覆盖】+【本地核实】依据。

### 1.1 指南现状与模块形态前提

- **原文**："Important: This guide is no longer being updated. Google recommends migrating to TypeScript, and following the TypeScript guide."
  （译：本指南不再更新。Google 建议迁移到 TypeScript 并遵循 TypeScript 指南。）（来源：[jsguide 顶部横幅](https://google.github.io/styleguide/jsguide.html)，已抓取）
- **原文**（§3 Source file structure）："All new source files should either be a `goog.module` file (a file containing a `goog.module` call) or an ECMAScript (ES) module (uses `import` and `export` statements)."（译：所有新源文件应是 goog.module 文件或 ES module。）（来源：[§3](https://google.github.io/styleguide/jsguide.html#3-source-file-structure)，已抓取）
- 【本仓库不符合（结构性、有意为之）】本仓库为"经典 `<script>` 共享词法全局 + CommonJS 导出守卫"，是指南未直接覆盖的形态（指南 §9.4 的遗留例外针对 pre-ES6 平台，不适用）。依据 §8.5（见 1.7）应作为**本地规则**记录，而非逐条违规处理。

### 1.2 命名（§6）

- **方法/变量 camelCase**：原文（§6.2.3）"Method names are written in `lowerCamelCase`."；（§6.2.8）"Local variable names are written in `lowerCamelCase`, except for module-local (top-level) constants"。（来源：[§6.2](https://google.github.io/styleguide/jsguide.html#62-rules-by-identifier-type)，已抓取）
  【本仓库已符合】【本地核实：mode-registry.js 的 `cardId`/`playModeIds` 等】
- **类/接口 PascalCase**：原文（§6.2.2）"Class, interface, record, and typedef names are written in `UpperCamelCase`."（来源同上）
  【指南未覆盖本场景】仓库模块模式为"一个 const 对象表 + 纯函数"，`ModeRegistry` 这类**命名空间式容器对象**在指南中无对应类别（§6.2.5.1 认为可变集合不是"常量"，按 §6.2.8 应 lowerCamelCase）；属灰色地带，建议在本地风格文档中固定为 PascalCase 容器名。
- **常量 CONSTANT_CASE**：原文（§6.2.5）"Constant names use `CONSTANT_CASE`: all uppercase letters, with words separated by underscores."（来源同上）
  【本仓库已符合】【本地核实：`MODE_REGISTRY`、server.js 的 `PORT`/`DATA_DIR`】。注意 §6.2.5.1 的"深不可变"判据：普通 `const` 对象表严格说不算 constant，不强求改写。
- **文件名**：原文（§2.1）"File names must be all lowercase and may include underscores (`_`) or dashes (`-`), but no additional punctuation. Follow the convention that your project uses. Filenames' extension must be `.js`."（译：文件名全小写，可用下划线或连字符，扩展名 .js。）（来源：[§2.1](https://google.github.io/styleguide/jsguide.html#21-file-name)，已抓取）
  【本仓库已符合：全部 kebab-case】【本地核实】
- **非 ASCII（中文注释的合法性）**：原文（§2.3.3）"either the actual Unicode character (e.g. `∞`) or the equivalent hex or Unicode escape ... depending only on which makes the code **easier to read and understand**"；§9.2 明确 "Non-ASCII characters are allowed in string literals, comments and JSDoc"。（译：允许在注释/字符串直接用非 ASCII 字符，以可读性为准。）（来源：[§2.3.3](https://google.github.io/styleguide/jsguide.html#233-non-ascii-characters)，已抓取）
  【本仓库已符合：中文注释为指南允许，且文件 UTF-8（§2.2）】

### 1.3 格式（§4）

- **2 空格缩进**：原文（§4.2）"Each time a new block or block-like construct is opened, the indent increases by two spaces."；（§2.3.1）"Tab characters are **not** used for indentation."（来源：[§4.2](https://google.github.io/styleguide/jsguide.html#42-block-indentation-2-spaces)，已抓取）
  【本仓库已符合】【本地核实】
- **分号**：原文（§4.3.2）"Every statement must be terminated with a semicolon. Relying on automatic semicolon insertion is forbidden."（来源：[§4.3.2](https://google.github.io/styleguide/jsguide.html#432-semicolons-are-required)，已抓取）
  【本仓库已符合】
- **列宽 80**：原文（§4.4）"JavaScript code has a column limit of 80 characters."（来源：[§4.4](https://google.github.io/styleguide/jsguide.html#44-column-limit-80)，已抓取）
  【本仓库不符合】：约 950/10321 行超 80 列（9.2%），集中在中文注释与 HTML 构建字符串【本地核实】。建议适配为 100 或 120 并忽略 URL，而非重排 950 行。
- **水平空白**：原文（§4.6.2）保留字后接 `(` 需一个空格（"Separating any reserved word (such as `if`, `for`, or `catch`) except for `function` and `super`, from an open parenthesis"）、`}` 与 `else`/`catch` 之间需一个空格。（来源：[§4.6.2](https://google.github.io/styleguide/jsguide.html#462-horizontal-whitespace)，已抓取）
  【本仓库不符合】：`if(`/`}else{`/`}catch(` 无空格约 1364 处（正则近似计数）【本地核实】。全部可 `eslint --fix` 自动修复，但会大面积触碰存量文件（见 §4.3）。
- **大括号**：原文（§4.1.1）所有控制结构必须大括号，例外是"单行可完整放下的无 else 简单 if"；（§4.1.2）K&R 风格（左括号不换行）。（来源：[§4.1](https://google.github.io/styleguide/jsguide.html#41-braces)，已抓取）
  【本仓库已符合（紧凑 K&R 变体，结构上等价）】
- **每行一条语句**（§4.3.1）、**行续接缩进至少 +4**（§4.5.2）、**禁止水平对齐**（§4.6.3 "Horizontal alignment: discouraged"）。
  【本仓库部分不符合】mode-registry.js 第 24–27 行的等号对齐属指南"不鼓励"项；§4.6.3 明确"允许但一般不鼓励"，非硬违规。

### 1.4 语言特性（§5）

- **const/let**：原文（§5.1.1）"Declare all local variables with either `const` or `let`. Use `const` by default... The `var` keyword must not be used."（来源：[§5.1.1](https://google.github.io/styleguide/jsguide.html#511-use-const-and-let)，已抓取）
  【本仓库已符合】【本地核实抽样未见 var】
- **单引号**：原文（§5.6.1）"Ordinary string literals are delimited with single quotes (`'`), rather than double quotes (`"`)."（来源：[§5.6.1](https://google.github.io/styleguide/jsguide.html#561-use-single-quotes)，已抓取）
  【本仓库大体符合，两处例外】：① 35/35 文件 `"use strict";` 用双引号；② 全 js/ 目录约 224 处双引号字符串（含 DOM 构建代码）【本地核实】。均可 autofix。
- **模板字符串**（§5.6.2）：复杂拼接优先模板字面量。指南允许；仓库混用 `+` 拼接——非硬违规（"over complex string concatenation" 的判定弹性大）。
- **箭头函数**：原文（§5.5.3）"Prefer arrow functions over the `function` keyword for nested functions"；"Parentheses around the parameters are optional if there is only a single non-destructured parameter."（译：单参数箭头函数的括号可省。）（来源：[§5.5.3](https://google.github.io/styleguide/jsguide.html#553-arrow-functions)，已抓取）
  【本仓库已符合】：抽样 17 处单参无括号 / 41 处有括号，指南两者皆允许；但 eslint-config-google 设 `arrow-parens: always` 更严（17 处会被标记）。
- **尾逗号**（§5.2.1/§5.3.1）：多行字面量末元素后要尾逗号。【本仓库已符合（抽样）】
- **相等**（§5.10）"Use identity operators (`===`/`!==`) except in the cases documented below"（例外：`== null` 同时捕获 null/undefined）。【未全量统计，不下结论】

### 1.5 JSDoc 与 `@fileoverview`（§7）

- 原文（§7 开篇）："JSDoc is used on all classes, fields, and methods."（译：所有类、字段、方法都用 JSDoc。）（来源：[§7](https://google.github.io/styleguide/jsguide.html#7-jsdoc)，已抓取）
- 原文（§7.5）："A file may have a top-level file overview... File overviews are generally recommended whenever a file consists of more than a single class definition."（译：文件可有顶层概述注释，超出单一类定义的文件建议有。）（来源：[§7.5](https://google.github.io/styleguide/jsguide.html#75-topfile-level-comments)，已抓取）
- 【本仓库不符合（形式）】仓库用 `====` 包边的中文块注释承担 fileoverview 职能，非 JSDoc 语法。**指南的"精神"（文件头概述）已满足，形式未满足**。eslint-config-google 不含 require-jsdoc/valid-jsdoc（源码已核实，见 §3.1），故自动化不强制；建议保持中文头注释不动，仅对新增公共纯函数按需补 `@param/@return`。

### 1.6 政策：存量代码与本地规则（§8）

- 原文（§8.4.1）："It is not required to change all existing code to meet current style guidelines. Reformatting existing code is a trade-off between code churn and consistency... However, if significant changes are being made to a file it is expected that the file will be in Google Style."（译：不要求把存量代码全部改成现行风格；大改某文件时该文件应符合。）（来源：[§8.4.1](https://google.github.io/styleguide/jsguide.html#841-reformatting-existing-code)，已抓取）
- 原文（§8.5）："Teams and projects may adopt additional style rules beyond those in this document."（译：团队可在本指南之外增加本地规则。）（来源：[§8.5](https://google.github.io/styleguide/jsguide.html#85-local-style-rules)，已抓取）
- 【评注】这两条是本仓库"新代码遵守、存量渐进收敛、紧凑 CSS 记录为本地规则"策略的**指南级依据**。

## 2. HTML/CSS 指南：关键规则与原文

以下原文均抓取自 [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)（已抓取全文）。

### 2.1 HTML 关键规则

- **文档类型**："Use `<!doctype html>`."（引 no-quirks 模式）（来源：[Document Type](https://google.github.io/styleguide/htmlcssguide.html#document-type)，已抓取）
  【本仓库已符合：`<!DOCTYPE html>`；指南示例为小写 doctype，验证器两种大小写均接受——视为符合，附注】
- **编码**："Use UTF-8 (no BOM)... Specify the encoding ... via `<meta charset="utf-8">`."（来源：[Encoding](https://google.github.io/styleguide/htmlcssguide.html#encoding)）【本仓库已符合：`<meta charset="UTF-8">` + `lang="zh-CN"`】
- **小写**："Use only lowercase. All code has to be lowercase: This applies to HTML element names, attributes, attribute values (unless `text/CDATA`)..."（来源：[Capitalization](https://google.github.io/styleguide/htmlcssguide.html#capitalization)）【本仓库已符合】（`lang="zh-CN"`、charset 值为规范标准写法，实用上豁免。）
- **`type` 属性省略**："Omit `type` attributes for style sheets and scripts (unless not using JavaScript, or when loading a JavaScript module with `type="module"`)."（来源：[type Attributes](https://google.github.io/styleguide/htmlcssguide.html#type-attributes)）【本仓库已符合：35 个 `<script src ... defer>` 均无 type 属性，全部外链无内联脚本】【本地核实】
- **`id` 属性（较新条款）**："Avoid unnecessary `id` attributes... Where `id` attributes are strictly required, always include a hyphen in the value... e.g. use `user-profile` rather than just `profile` or `userProfile`."（来源：[id Attributes](https://google.github.io/styleguide/htmlcssguide.html#id-attributes)）【本仓库不符合：`scoreA`/`menuMain`/`cardArena` 等 camelCase id 且大量使用】
- **属性双引号**："When quoting attribute values, use double quotation marks."（来源：[HTML Quotation Marks](https://google.github.io/styleguide/htmlcssguide.html#html-quotation-marks)）【本仓库已符合】
- **HTML 格式**："Use a new line for every block, list, or table element, and indent every such child element."（来源：[General Formatting](https://google.github.io/styleguide/htmlcssguide.html#general-formatting)）【本仓库不符合：index.html 为扁平无缩进结构；按 §8.4.1 精神可记录为本地风格】
- 其他：语义化（Semantics）、多媒体 fallback（alt）、结构/表现/行为分离（Separation of Concerns）、不用实体引用（Entity References）、可选标签省略（**optional**）。【本仓库大体符合；可选标签未省略——该条本身可选，无妨】

### 2.2 CSS 关键规则（"风格"类）

- **合法性**："Use valid CSS where possible."（W3C CSS validator）（来源：[CSS Validity](https://google.github.io/styleguide/htmlcssguide.html#css-validity)）【本仓库已符合（抽样）】
- **类名连字符**："Separate words in class names by a hyphen."（来源：[Class Name Delimiters](https://google.github.io/styleguide/htmlcssguide.html#class-name-delimiters)）【本仓库不符合：`.menuPage`/`.modeCard`/`.slot.active` 等 camelCase 约 205 处（style.css 151 + focus.css 37 + touch.css 17）】【本地核实】
- **避免 ID 选择器**："Avoid ID selectors."（来源：[ID Selectors](https://google.github.io/styleguide/htmlcssguide.html#id-selectors)）【本仓库不符合：CSS 大量 `#id` 选择器——记录为本地偏离】
- **简写属性**："Use shorthand properties where possible... even in cases where only one value is explicitly set."（来源：[Shorthand Properties](https://google.github.io/styleguide/htmlcssguide.html#shorthand-properties)）【本仓库已符合】
- **0 无单位**："Omit unit specification after '0' values, unless required."（来源：[0 and Units](https://google.github.io/styleguide/htmlcssguide.html#0-and-units)）【本仓库已符合：`margin:0` 等】
- **前导零**："Always include leading '0's in values. Put `0`s in front of values or lengths between -1 and 1."（来源：[Leading 0s](https://google.github.io/styleguide/htmlcssguide.html#leading-0s)）【本仓库不符合：`opacity:.85`、`rgba(0,0,0,.35)` 等省略前导零多处——注意这是**风格规则**（数值写法），不是排版空格问题】【本地核实】
- **hex 3 位**："Use 3 character hexadecimal notation where possible."（来源：[Hexadecimal Notation](https://google.github.io/styleguide/htmlcssguide.html#hexadecimal-notation)）【本仓库已符合：`#fff` 已用短式，不可压缩的 6 位保留（27+25 处）合规】
- **`!important`**："Avoid using `!important` declarations."（来源：[Important Declarations](https://google.github.io/styleguide/htmlcssguide.html#important-declarations)）【未全量统计，抽样未见】
- **声明排序**："**Alphabetize declarations (optional).** Sort declarations consistently within a project..."（来源：[Declaration Order](https://google.github.io/styleguide/htmlcssguide.html#declaration-order)）【可选规则；仓库未按字母排序，不采用无妨——但"项目内一致"要自觉】

### 2.3 关键澄清：指南对 CSS"格式"（空格/换行）是否有硬性规定？

**有，而且写得很具体**。CSS Formatting Rules 各条均为祈使句规则（非 optional 标注）：

- 冒号后空格："**Use a space after a property name's colon.** Always use a single space between property and value (but no space between property and colon) for consistency reasons."（来源：[Property Name Stops](https://google.github.io/styleguide/htmlcssguide.html#property-name-stops)，已抓取）
- 选择器与花括号："**Always use a single space** between the last selector and the opening brace... The opening brace should be on the same line as the last selector."（来源：[Declaration Block Separation](https://google.github.io/styleguide/htmlcssguide.html#declaration-block-separation)）
- 每声明/每选择器独占一行："**Always start a new line for each selector and declaration.**"（来源：[Selector and Declaration Separation](https://google.github.io/styleguide/htmlcssguide.html#selector-and-declaration-separation)）
- 规则间空行："**Always put a blank line** (two line breaks) between rules."（来源：[Rule Separation](https://google.github.io/styleguide/htmlcssguide.html#rule-separation)）
- 每条声明以分号结束："End every declaration with a semicolon for consistency and extensibility reasons."（来源：[Declaration Stops](https://google.github.io/styleguide/htmlcssguide.html#declaration-stops)）
- 缩进 2 空格（含 `@media` 内层）（来源：[Indentation](https://google.github.io/styleguide/htmlcssguide.html#indentation)）
- CSS 引号：属性值/属性选择器用**单引号**，`url()` 不加引号（来源：[CSS Quotation Marks](https://google.github.io/styleguide/htmlcssguide.html#css-quotation-marks)）

【本仓库现状】紧凑风格（`html,body{margin:0;...}`、冒号后无空格、一行多声明、单行块末声明无分号）与上述各条**全部冲突**。结论：指南把"展开式排版"当作规则而非偏好；仓库要么全量格式化（成本见 §4.3），要么依据指南结尾 **Parting Words**（"Be consistent... local style is also important"，[原文](https://google.github.io/styleguide/htmlcssguide.html#parting-words)）与 JS 指南 §8.4.1/§8.5 把紧凑排版固定为**本地规则**。本报告推荐后者，并用 stylelint 只管"风格/合法性"层面的可机检子集（§3.2）。

## 3. 自动化执行工具链

### 3.1 ESLint + eslint-config-google

**覆盖面**（以已抓取的源码 `index.js` 为准，来源：[eslint-config-google/index.js](https://github.com/google/eslint-config-google/blob/main/index.js)，已抓取；[README](https://github.com/google/eslint-config-google)，已抓取）：

- **启用且与本仓库相关的**：`quotes: single(+模板字面量)`、`semi`、`no-var`、`prefer-const`、`indent: 2`（含对象/参数细节）、`max-len: 80`（ignoreUrls、ignorePattern goog.require）、`keyword-spacing`、`space-before-blocks`、`space-before-function-paren {named:'never', anonymous:'never', asyncArrow:'always'}`、`block-spacing: never`（单行块 `{a:0}` 内无空格）、`brace-style`、`comma-dangle: always-multiline`、`one-var: never`、`no-tabs`、`no-trailing-spaces`、`eol-last`、`camelcase {properties:'never'}`、`arrow-parens: always`、`curly: multi-line`、`operator-linebreak: after`、`padded-blocks: never`、`quote-props: consistent`、`guard-for-in`、`no-invalid-this`、`no-extend-native`、`no-array-constructor`、`no-throw-literal`、`prefer-promise-reject-errors`、`no-with`、`spaced-comment: always`、`linebreak-style`、`new-cap`、`no-multi-spaces`、`no-multiple-empty-lines {max:2}`、`no-unused-vars {args:'none'}` 等。
- **指南有、配置没有（缺口）**：`no-eval` 为 off（指南 §5.11.2 禁 eval/Function 构造器）；`eqeqeq` off（指南 §5.10 要求 ===）；JSDoc 强制（require-jsdoc/valid-jsdoc 不存在）；CONSTANT_CASE 与 PascalCase 命名检查（仅 camelcase+new-cap）；模块结构（§3）、`for-of` 偏好、行续接 +4 细节。README 自己说明可与 `eslint:recommended` 叠加并参考 index.js 对照（已抓取）。
- **flat config 用法（我的落地建议，基于源码结构推断）**：该包导出的只是纯 `{rules}` 对象、无 plugins/无 extends（源码已核实），因此 ESLint 9 flat config 可直接展开使用，无需 FlatCompat：

```js
// eslint.config.mjs（建议稿，非现行文件）
import google from 'eslint-config-google';
import globals from 'globals'; // 官方 globals 数据包（来源：https://github.com/sindresorhus/globals，未抓取，通用常识）

export default [
  { ignores: ['lib/three.min.js', 'node_modules/'] },
  {
    files: ['js/**/*.js', 'server.js'],
    languageOptions: {
      sourceType: 'script',     // 经典 script 共享全局，不是 ES module
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        THREE: 'readonly',      // lib/three.min.js 注入
        ModeRegistry: 'readonly', CombatCore: 'readonly', /* …各模块导出名 */
      },
    },
    rules: {
      ...google.rules,
      'max-len': ['error', { code: 100, ignoreUrls: true }], // 适配中文注释（指南 80 的本地放宽）
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.node, require: 'readonly', module: 'writable' }, // node --test 的 CommonJS
    },
    rules: { ...google.rules, 'no-invalid-this': 'off' },
  },
];
```

要点：`sourceType:'script'`（default）即可，不要设 `module`（否则顶层 `const` 的跨文件共享语义与 `no-undef` 行为都会错）；`no-undef` 不在 google 配置里，如需启用必须配合上面的 globals（`THREE` 与各模块顶层绑定都是经典 script 的全局词法绑定，ESLint 逐文件 lint 无法跨文件推断）。eslint-plugin-html 的文档也确认了"多个 script 标签默认共享全局作用域"的仿真行为（来源：[eslint-plugin-html README](https://github.com/BenoitZugmeyer/eslint-plugin-html)，已抓取），与本项目架构一致——但见 §3.3，本仓库无内联脚本，用不上它。

### 3.2 Stylelint

- **定位**：官方主页："A mighty CSS linter that helps you avoid errors and enforce conventions"，100+ 内置规则、可 autofix、可共享 config；并明确 "**We recommend using a pretty printer like Prettier alongside Stylelint.**"（来源：[stylelint.io](https://stylelint.io/)，已抓取）
- **格式类规则已不在规则集中**：官方规则总览页的全部规则分类里，空白类仅剩 `comment-whitespace-inside`；没有"冒号后空格/花括号前空格/每声明一行"这类排版规则（来源：[Rules 列表页](https://stylelint.io/user-guide/rules)，已抓取）。这印证：**现代 stylelint 不再管空格排版**，紧凑 CSS 与 stylelint 无结构性冲突。
- **预设**：`stylelint-config-standard` 发布版 extends `stylelint-config-recommended`（错误类）再加约定类规则（来源：[stylelint-config-standard 发布版 index.js（unpkg）](https://unpkg.com/stylelint-config-standard@latest/index.js)，已抓取；`config-recommended` 源码未单独抓取，其内容=错误类规则，此为基于规则页 ✅ 标注的推断）。
- **与本仓库现状冲突的 4 条 standard 规则**（发布版源码逐条核实）：
  1. `declaration-block-single-line-max-declarations: 1`——紧凑单行块（`html,body{margin:0;height:100%;…}`）全灭；style.css 抽样约六成规则行为单行多声明【本地核实】。（注：GitHub main 分支源码暂无此条、unpkg 发布版有——以 `npm i` 到手的发布版为准，两处不一致如实记录）
  2. `selector-class-pattern` / `selector-id-pattern`（kebab-case 正则）——约 205 处 camelCase 选择器【本地核实】。
  3. `color-function-notation: 'modern'`——`rgba(0,0,0,.35)` 需改 `rgb(0 0 0 / 35%)`，约 112 处（可 autofix 🔧）【本地核实】。
  4. `media-feature-range-notation: 'context'`——touch.css 1 处 `@media`【本地核实】。
- **其余 standard 规则与紧凑风格兼容**（抽查关键项）：`rule-empty-line-before: always-multi-line`（仓库规则间本就有空行）、`declaration-empty-line-before`（`ignore: inside-single-line-block` 豁免单行块）、`comment-whitespace-inside`（`/* 准星 */` 合规）、`color-hex-length: short`、`length-zero-no-unit`、`value-keyword-case: lower`、错误类（未知属性/函数/重复选择器等）全部兼容。
- **零冲突配置（我的建议）**：extends standard + 关上述 4 条（`null`）即可全量通过现状；错误类规则立即产生价值。若愿意做一次性迁移，可再放开 `color-function-notation`（112 处 autofix）。

### 3.3 HTML lint

- **eslint-plugin-html**：定位是"extract and lint **scripts** from HTML files"，且 README 明言 "It does not provide any rule related to HTML. For that, you can use other plugins like **@html-eslint**"（来源：[README](https://github.com/BenoitZugmeyer/eslint-plugin-html)，已抓取）。**本仓库 index.html 全部为外链 `<script src defer>`、无内联脚本**【本地核实】→ 该插件对本仓库无用武之地。
- **HTML 规则检查**：可选 `@html-eslint`（转述自 eslint-plugin-html README，未直接抓取其文档）或 **HTMLHint**（来源：[HTMLHint README](https://github.com/htmlhint/HTMLHint)，已抓取；其规则清单页 <https://htmlhint.com/rules/> 未抓取——文档站 list-rules 路径 404，如实标注）。HTMLHint 支持 `.htmlhintrc`、有 `tag-pair`、`id-class-value`（可设 dash）等规则，Node ≥22，可 `npm i -D htmlhint` 或 `npx htmlhint index.html` 直接跑。
- **合法性验证**：Google 指南自身推荐 **W3C HTML validator**（<https://validator.w3.org/nu/>）与 **W3C CSS validator**（<https://jigsaw.w3.org/css-validator/>）（来源：HTML/CSS 指南 HTML Validity / CSS Validity 节，已抓取）。这是 HTML"合法性"层面的零依赖检查途径（手动/CI 调 URL 均可）。

### 3.4 .editorconfig

（来源：[editorconfig.org](https://editorconfig.org/)，已抓取；[正式规范 spec.editorconfig.org](https://spec.editorconfig.org/)，未抓取）

支持的属性：`indent_style`、`indent_size`、`tab_width`、`end_of_line`、`charset`、`trim_trailing_whitespace`、`insert_final_newline`、`root`；INI 格式、节名是 glob、向下读取取最近优先。它只约束编辑器行为（缩进/行尾/编码/尾空白），**管不了**"冒号后空格/引号风格"——后者归 lint。

本仓库事实：无 `.editorconfig`；git index 与工作区均为 LF（个别文件工作区 CRLF）；源文件 UTF-8【本地核实：`git ls-files --eol`】。建议文件（我的建议）：

```ini
# EditorConfig: https://editorconfig.org
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,mjs,cjs}]
indent_style = space
indent_size = 2

[*.{css,html}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false   # Markdown 行尾双空格是换行语法
```

（紧凑 CSS 的续行也用 2 空格【本地核实】，故 `indent_size = 2` 与现状一致。）

### 3.5 依赖落地：devDependencies 与 npx

- 现状：**仓库无 package.json**；Node v24.13.0 / npm 11.6.2；`server.js` 仅 require Node 内建模块（http/fs/path/os/zlib）【本地核实】→ 新增 package.json + devDependencies **不影响** `node server.js`、file:// 直开与 `node --test`（零构建约束不受损）。`.gitignore` 目前只有 `data/`，需补 `node_modules/`。
- npx 直跑：`npx htmlhint index.html` 这类**无共享配置依赖**的工具可即开即用；`eslint`/`stylelint` 的 config 会 `import 'eslint-config-google'`/`extends standard`，没有本地 node_modules 就解析不到 → **建议 package.json + devDependencies + npm scripts**（`npm run lint` / `npm run lint:fix`），npx 仅用于一次性尝鲜。（此为基于 npm/npx 解析机制的常识性推断，未单独抓取 npm 文档。）

## 4. 对本仓库的落地建议

### 4.1 原样采纳（与现状零冲突或近零冲突）

1. JS：2 空格、单引号、分号、const/let、camelCase/CONSTANT_CASE/PascalCase、文件名小写连字符、大括号全带、尾逗号、`===`、禁 with/eval/改内建对象、UTF-8+中文注释。
2. HTML：doctype、UTF-8、小写、属性双引号、省略 `type`、语义化、结构/表现/行为分离、W3C validator 抽查。
3. CSS"风格"类（非排版）：类名有意义+尽量短、连字符分隔（**新类名起 kebab-case**）、简写属性、0 无单位、hex 尽量 3 位、避免 `!important`、hack 与 UA 检测。
4. 工具：`.editorconfig`（§3.4 稿）；stylelint standard（关 4 条规则）+ 错误类规则即刻生效；eslint-config-google 作为基线（修 4.2 的适配项）。

### 4.2 适配调整（记录为本地规则，依据 JS 指南 §8.5、HTML/CSS 指南 Parting Words）

1. **列宽**：80 → 建议 100/120 或忽略注释（中文注释按字符数计列宽天然更长；~950 行超限不值得人工重排）。
2. **CSS 紧凑排版**：保留"一行一规则、冒号后无空格、选择器后无空格"，记录为本地规则；同时把指南的"前导零"一条一并豁免（`.85` 简写）或顺手改为 `0.85`（约几十处，正则可改，非排版问题、stylelint 也不查——见 §2.2/§2.3）。
3. **存量 camelCase 类名/id**：不强改（牵动 index.html 与 JS 查询 ~205 处）；新增一律 kebab-case + id 值含连字符（指南 §id Attributes）。
4. **`"use strict";`**：保留（经典 script 必需），引号改单引号（35 处，autofix）。
5. **`if(` / `}else{` 空格**：新代码遵守 `if (` / `} else {`；存量靠一次 `eslint --fix` 收敛（见下）。
6. **JSDoc**：不强推；中文 `====` 模块头注释保留为本地惯例（指南 §7.5 允许"if present"，eslint-config-google 不检查）。
7. **补 eslint-config-google 缺口**（可选加规则）：`no-eval`、`eqeqeq: ['error', 'allow-null']`。

### 4.3 存量迁移成本（抽样统计【本地核实】）

- **JS**：js/（除 three.min.js）35 文件 / 10,321 行。
  - 可 autofix 的机械偏差：`if(/for(/while(/switch(/catch(` 无空格 ~1364 处（正则近似）、双引号字符串 ~224 处、`"use strict"` 35 处、单参箭头无括号 17 处、对象字面量 `{ id: ... }` 与 `block-spacing: never` 的冲突（mode-registry.js 等普遍）、少量 indent/对齐重排。**预计一次 `eslint --fix` 触及全部 35 个文件的相当比例行**——建议单独一个 commit 做，避免混入功能改动（JS 指南 §8.4.1 第 2 条同此精神）。
  - 不可 autofix：max-len 80 → ~950 行（放宽列宽后归零）。
- **CSS**：style.css 208 行 / focus.css 142 行 / touch.css 69 行。若全量对齐 Google 排版条款：约六成规则行需展开为多行 + 补末分号 + 加空格（~419 行文件近乎全文件重排）；若对齐 standard 全量规则：rgba→rgb 112 处（autofix）+ 选择器改名 ~205 处（无 autofix，牵动 HTML/JS）。**建议均不做**，走 §4.2 的"关闭规则+本地规则"路线，成本≈0。
- **HTML**：扁平缩进不改（指南格式条款记为本地偏离）；可选跑 `npx htmlhint index.html` 与 W3C validator 做一次合法性体检。

## 5. 来源清单

**一手指南（均已抓取原文）**

- Google JavaScript Style Guide（现行地址，旧地址 jsguide/ 已 404）：https://google.github.io/styleguide/jsguide.html
- Google HTML/CSS Style Guide：https://google.github.io/styleguide/htmlcssguide.html

**官方仓库（已抓取）**

- eslint-config-google README：https://github.com/google/eslint-config-google （README 经 raw 抓取）
- eslint-config-google 源码规则清单（main 分支）：https://raw.githubusercontent.com/google/eslint-config-google/main/index.js
- stylelint-config-standard 发布版源码（unpkg @latest，npm 实际安装内容）：https://unpkg.com/stylelint-config-standard@latest/index.js
- eslint-plugin-html README：https://github.com/BenoitZugmeyer/eslint-plugin-html
- HTMLHint README：https://github.com/htmlhint/HTMLHint （规则清单页 https://htmlhint.com/rules/ 未抓取；文档站 list-rules 路径 404）

**官方文档（已抓取）**

- Stylelint 主页（定位与 Prettier 分工）：https://stylelint.io/
- Stylelint 规则总览（证实无空格排版类规则）：https://stylelint.io/user-guide/rules
- EditorConfig 官网（属性表/示例文件）：https://editorconfig.org/ （规范 spec.editorconfig.org 未抓取）

**指南内引用的验证工具（未抓取，仅转述指南）**

- W3C HTML validator：https://validator.w3.org/nu/
- W3C CSS validator：https://jigsaw.w3.org/css-validator/

**本地核实（本次命令行统计，非网络来源）**

- 仓库文件清单、无 package.json、server.js 零依赖、Node v24.13.0/npm 11.6.2、LF 行尾、无 .editorconfig、.gitignore 仅 `data/`；js/ 35 文件 10321 行、超 80 列 ~950 行、`if(` 类无空格 ~1364 处、双引号字符串 ~224 处、`"use strict"` 双引号 35 处、单参箭头无括号 17 处；css/ 三文件 camelCase 选择器 ~205 处、rgba ~112 处、@media 1 处；index.html 全外链 defer script、无 type 属性、无内联脚本。
