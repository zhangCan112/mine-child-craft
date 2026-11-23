# 工程与代码规范（Conventions）

> 依据：[docs/google-style-research.md](google-style-research.md)（Google JS/HTML/CSS 指南逐条查证）与
> [docs/project-structure-research.md](project-structure-research.md)（一文件一模块/AI 可导航的外部证据与仓库盘点），
> 每条规则的来源引句见这两份调研报告。本文是**规范正文**：只写结论与执行方式。
> 适用：本仓库全部现有与未来代码。新 AI 会话由根目录 AGENTS.md 引导至此。
> 原则（Software Engineering at Google, ch.8）：规则是法律不是建议；优先用工具自动执行；
> 不可发现的文档等于不存在——所以本文每节都标注它的执行者（lint / 测试 / 头注释契约）。

## 0. 一页速览

| 事项 | 规则 | 执行者 |
|---|---|---|
| 命令 | `npm run lint` · `npm run lint:fix` · `npm test` · `node server.js` | package.json scripts |
| 代码风格 | JS/CSS/HTML 以 Google 官方指南为基线，本地偏离全部登记在 §6 | ESLint + Stylelint + htmlhint |
| 结构 | 一文件一模块：文件名即模块索引（§1） | test/conventions.test.js + 命名语法 |
| 改完必跑 | `npm test`（含 boot 全链冒烟与规范守门）+ `npm run lint` | AGENTS.md 承诺 + 提交纪律 |
| 装具与环境 | 测试假 DOM 一律 test/helpers/fake-dom.js；vm 装载/红因分类/Windows 纪律见 §7 | test/conventions.test.js + .scratch/run-green.js + 纪律 |
| 新约定 | 先过 §1.10 升格判据；不可逆决策写 ADR | docs/adr/ |

## 1. 工程结构：一文件一模块

### 1.1 目录宪法

```
index.html        # 唯一入口；经典 <script defer> 按依赖顺序加载全部 js
js/               # 引擎与应用模块，平铺，一文件一模块
js/modes/         # 游玩模式层（<modeId>.js，清单权威在 mode-registry.js）
js/mob-look/      # 造型档案声明（<type>.js 一怪一文件，文件名=declare 键 ∈ MOB_TYPES∪{player} ∪ town_*
                  #   （键集=镇民注册表 town-npc-registry；白名单超集口径，非 MOB_TYPES 键必 town_ 前缀）；
                  #   基座/换算/贴图的缝在 mob-look-kit.js，键集与布局合法性由 test/mob-look.test.js 断言）
css/              # 按端拆分：style(桌面) → focus(训练营) → touch(触屏)，按此顺序覆盖
test/             # node --test 单测，与 js 模块镜像命名
docs/             # README.md 索引(文档地图) + <topic>-research / -design / -plan 三段式 + adr/NNNN-slug.md
lib/              # 仅 vendored 三方库（three.min.js），只读
assets/audio/     # CC0 音频资产 + CREDITS.md 溯源清单（只放转码后产物，源 wav/flac/ogg 不入库，见 adr/0003）
data/             # 运行时数据（gitignore）
server.js         # 零依赖静态服务器（Node 内建模块，无 npm 依赖）
```

运行时零依赖 `node_modules`：浏览器直引 js/*.js，服务器只用 Node 内建模块。
package.json 只承载开发期工具链（lint + 一次性音频转码 ffmpeg-static，见 §5；均为 devDependencies）。

### 1.2 文件命名语法（后缀语义表）

文件名一律 **kebab-case**；后缀是模块类型的声明，读文件名即知可测性与层：

| 后缀 | 语义 | 硬性要求 |
|---|---|---|
| `-core` | 纯逻辑核心：零 THREE · 零 DOM · 零全局可变依赖 · 加载零副作用 | **必有同名单测**（Node 直测） |
| `-registry` | 某类清单的唯一权威（纯数据+纯函数） | **必有对着消费端断言的单测** |
| `-kit` | 跨模式共用工具 / 深 interface 收口 | — |
| `-levels` / `-icons` | 数据表 / 图标资源 | — |
| `-worker` | Worker 入口（不进 index.html script 列表） | — |
| 无后缀 | 引擎或应用的 adapter（THREE/DOM 允许在此） | 经 boot 冒烟覆盖 |

模式文件：`js/modes/<modeId>.js`；id 与文件名不一致时例外登记在注册表 `src` 字段
（先例：`mode-registry.js` 的 tank-range）。新增模式 = index.html 加卡/页/script +
注册表加行，三重命名约定（id ↔ cardXxx ↔ menuXxx）由 test/mode-registry.test.js 断言。

### 1.3 一个文件配得上存在 ⇔ 三问全"是"

1. **一个责任**：一句中文能说清这个文件是什么，不需要"和/以及"连接两个不相干的动词；
2. **一份 vocabulary**：它引入或收口了至少一个有名字的概念（值得进 GLOSSARY 或头注释）；
3. **一个 interface**：能在一个对象/少量入口后面藏住实现，调用方无需读实现细节
   （`-core` 的"零 THREE · 零 DOM"是其最强形态）。

### 1.4 何时拆分 / 何时合并——责任是判据，行数不是

- **拆分信号**（其一即考虑拆）：头注释 interface 摘要写不下/自相矛盾；文件里出现第二份
  vocabulary；纯逻辑与 THREE/DOM 装配纠缠（按先例剥 `-core`：world→mesh-core、
  tank→tank-core、mobs→mob-core）；两个模式复制同一段样板（收进 `-kit`）。
- **合并信号**：拆出的两部分互相纠缠——读 A 必须翻 B，或 A 的头注释要解释 B 的内部状态。
- **行数**：无权威行数上限（调研确认 Google 与 Ousterhout 均明确反对任意数字上限）。
  超过 ~800 行（现状 P99 附近）时重问一遍 §1.3 三问，答得上来就不拆。

### 1.5 新文件放哪（决策树）

```
纯逻辑、想单测              → js/<name>-core.js       (+ test/<name>-core.test.js)
清单/注册（多处消费）        → js/<name>-registry.js   (+ 对消费端断言的测试)
跨模式工具/interface        → js/<name>-kit.js
THREE/DOM 装配（引擎）       → js/<name>.js
玩法模式                    → js/modes/<modeId>.js    (+ 注册表加行 + html 卡/页/script)
数据表（关卡/数值/图标）     → config.js 或 <name>-levels.js
Worker 入口                 → js/<name>-worker.js
样式                        → css/ 按端拆分
调研/设计/计划              → docs/<topic>-{research,design,plan}.md
不可逆决策                  → docs/adr/NNNN-slug.md
术语                        → GLOSSARY.md（判据见 §1.8）
```

### 1.6 分层规则

引擎层（引擎不知道任何具体玩法）⊂ 应用层（玩法与政策）。**应用可依赖引擎，引擎不得
依赖应用**（GLOSSARY"引擎层/应用层"条）。新概念先问它在哪一层，名字进对应层。

### 1.7 模块头注释契约

每个 js 文件 `"use strict";` 之后是 `====` 包边的块注释，五要素：

```
模块名（English，术语见 GLOSSARY.md）— 层（引擎层/应用层/模式层）
一句话职责（它是什么、藏住什么；调用方只需知道什么）
interface: 入口函数/对象一行清单
依赖(均经全局名, 调用期解析): 文件与符号、加载序说明
可测性声明（零 THREE·零 DOM·有单测 | THREE/DOM 惰性创建，Node 测试可安全加载）
```

由 test/conventions.test.js 守门（strict 首行 + 横幅存在性）；interface 摘要质量靠评审。
注释用中文（Google JS 指南 §9.2 明确允许非 ASCII）。

横幅纪律（2026-10-28 增补，依据 [docs/agent-context-research.md](agent-context-research.md) §3/§4.4）：

- 五要素中的「职责」是真·一句话（至多三行）；特性叙事/拍板史/逐票说明不进横幅，按
  四层去向下沉：设计权衡 → `docs/<topic>-design.md` 或 ADR；术语与历史别名 → GLOSSARY；
  用法示范 → 设计稿；实现解说 → 代码不自明处的就地短注释。
- 「叙事段」（职责+设计说明，不含 interface/依赖清单）≤15 行；interface/依赖清单不设
  行数上限，但只列符号、语义与加载序，不写论证与历史——接口宽是模块面积的诚实反映
  （先例：furnace-kit / adventure-core 的长横幅=接口清单长，非叙事肥，勿砍）。
- 一句话说不短先怀疑模块切分（SWE 书 ch.10「一两段话说不清=API 没想清楚」），不是加行。

### 1.8 GLOSSARY 收录判据（满足任一即收）

1. 该词跨模块出现（≥2 个文件的调用方在用，或跨层引用）；
2. 该名字曾被叫错/有历史别名（_Avoid_ 行有实际内容即是证据）；
3. 它是层的名字或层的边界规则。

一次性实现细节、单文件内部的名字不进。每条格式：定义 + interface/职责 + _Avoid_ 别名。

词条格式纪律（2026-10-28 增补，依据 [agent-context-research.md](agent-context-research.md) §4.3/§4.4）：
长论证/拍板史/逐票说明不进词条——与设计稿、模块头注释三重复制必漂移；词条超过 ~800
字符时按「定义 1–2 句 + interface 紧凑清单（入口名/键名一个不丢）+ _Avoid_」重写，
别处无据的独有事实（数值/口径/红线/加载序）必须保留；**词条名一经被 js/test 头注释
具名引用（「术语见 GLOSSARY『XXX』」）即冻结，改名=断链且死链测试查不出**。

### 1.9 test 镜像规则

- 默认 `test/<模块同名>.test.js`；`-core`/`-registry` 必须同名（§1.2，有守门测试）。
- THREE/DOM adapter 不强制直测：boot.test.js 按 index.html 真实顺序在共享 vm 全链冒烟，
  专抓共享词法环境的顶层重名/炸错；要直测就先剥 `-core`。
- 存量命名偏差（world-rings、world-integrity、world-vertexlight、nether-mode、tank-mode、
  effects-campfire-sheet——js/effects.js 的篝火焰片 sheet 段专测，T-C13-R4 落、
  T-C13-R5 c5 核对登记）不改名，测试头注释写明对应哪个模块文件。（mob-taxonomy 原列于此，2026-10-25 随 mob-registry.js
  落地 git mv 改名收编为 test/mob-registry.test.js，偏差消名。）

### 1.10 "注册表 + 测试断言"升格判据

一条约定满足两点即从口头约定升格为注册表+断言：**清单出现在 ≥3 处**（或两处已有漂移史）；
**手滑必炸且炸在运行时**。路径固定：唯一权威数据源（纯数据+纯函数）→ 消费方只派生不
复制 → 测试对着消费端产物逐条断言。先例：mode-registry。

### 1.11 文档三段式 + ADR

同一主题：`-research.md`（调研，来源逐条可溯）→ `-plan.md`（计划）→ `-design.md`
（设计定稿）；不可逆决策进 `docs/adr/NNNN-slug.md`（Considered Options + Consequences）。

完工或废弃的 plan/spec/tickets/acceptance **不删除**：文件头加
`> 生命周期：已完工/已废弃 — 仅作历史依据；权威后继 <链接>` 一行，
[docs/README.md](README.md) 的历史工件栏同步登记；ADR 沿用 superseded
标记惯例，编号单调不复用（依据 agent-context-research.md §2.4：显式退场
比删除安全、比沉默诚实）。

### 1.12 移植参考机制须连伴生状态机制

移植参考游戏的机制时，必须同时列出它的**状态伴生机制清单**（衰减/生长/重力/支撑/
传播），逐条决定移植或不移植；不移植的项登记在对应设计稿的差异登记表（附录 B）并
写明后果。判据：只移植"瞬时规则"（掉落/数值）而漏掉"状态规则"（编辑后的世界自洽），
世界会在玩家操作序列后呈现出参考游戏永远不会出现的状态——先例：砍树悬空
（docs/block-lifecycle-research.md，2026-10-23）。
执行者：设计稿附录 B + test/world-integrity.test.js（极端交互后全图不变量扫描）。

## 2. JavaScript —— Google JS 指南为基线

指南现行地址 `google.github.io/styleguide/jsguide.html`（已官方冻结，对原生 JS 仓库反而是
稳定基准）。**机械规则全部由 ESLint 执行**（`eslint .` 必须零错误）：

- 2 空格缩进、单引号、分号、const/let（禁 var）、K&R 大括号、每声明一行、
  命名 camelCase/PascalCase 类/CONSTANT_CASE 常量、文件名小写连字符、禁 eval、
  `===`（例外 `== null`）、尾逗号、保留字后空格（`if (`、`} else {`）。
- **列宽 120**（本地放宽自 80，中文注释与参数表行友好）；数据表行豁免折行
  （`key: {…},` 整行记录与 `BLOCKS[K] = {…};` 方块表行——参数表驱动是 MISSION 锁定风格）。

### 2.1 共享词法环境机制（本仓库特有，新模块自动生效）

所有 js 文件是经典 `<script defer>`：顶层声明互为全局（加载序即依赖序）；Node 侧经
CommonJS 导出守卫 `if (typeof module !== 'undefined' && module.exports)` 供单测 require。
eslint.config.mjs 在加载时**动态扫描 js/ 顶层声明生成跨文件全局名单**——`no-undef`
由此可查跨文件引用手滑，新增模块无需登记。关键链的**加载序**由守门断言执法
（test/conventions.test.js 的 hand-view 链序 gate 与镇民链序 gate 先例——index.html
script 列表逐对比较）；正文不逐链誊写链序清单，新增多文件链时同步在 gate 扩列。

由此产生的两条本地规则：

- **可能被其他文件写的顶层绑定用 `let`**（input.js 写 pitch、build.js 写 flyMode——
  prefer-const 的文件级分析看不见跨文件赋值，曾在 js/ 关闭之，test/ 与 server.js 保留）。
- 文件内变量默认 const；命名空间容器对象（`ModeRegistry`、`Mobs`）用 PascalCase。

### 2.2 其他本地约定

- 中文注释；`====` 头注释契约承担 fileoverview 职能（指南 §7.5 允许，不强推 JSDoc 语法）。
- 关联常量可成对放一行（`const LABEL_W = 160; const LABEL_H = 40;`——既有惯例）。
- 单行 `if (x) return;` 允许（指南 §4.1.1 例外条款）；跨行必须大括号。

## 3. CSS —— Google HTML/CSS 指南为基线

格式条款已**全量落地为展开式排版**并由 Stylelint 守门（`declaration-block-single-line-
max-declarations` 禁止退回单行多声明）：

- 每选择器独占一行（逗号选择器拆行）；选择器与 `{` 之间一个空格；
- 每声明独占一行，冒号后一个空格，分号结尾；规则之间空行；缩进 2 空格（@media 内再进）。
- 风格条款：**类名 kebab-case**（2026-10 已全量迁移，新类名一律 kebab-case）；简写属性；
  0 无单位；**前导零补全**（`0.85` 非 `.85`）；hex 尽量 3 位；避免 `!important`；
  颜色记法现代化（`rgb(0 0 0 / 35%)`，Stylelint autofix 维护）。

本地偏离见 §6（id 选择器等）。

## 4. HTML —— Google HTML 指南为基线

`<!DOCTYPE html>` · UTF-8（无 BOM）· 小写 · 属性双引号 · 省略 `type` · 块级元素逐行
**按深度缩进**（已全量落地）· 语义化 · 结构/表现/行为分离。htmlhint 守门。
id 命名偏离见 §6。

## 5. 工具链与执行

| 文件 | 职责 |
|---|---|
| `eslint.config.mjs` | google 基线 + no-eval/eqeqeq 补缺 + 动态全局扫描 + 列宽 120（配置内注释逐条说明） |
| `stylelint.config.mjs` | standard 预设 + §6 登记的两条豁免（配置内注释说明） |
| `.htmlhintrc` | htmlhint 子集（id 命名豁免） |
| `.editorconfig` | UTF-8 · LF · 2 空格 · 收尾换行 · 去尾空白 |
| `.gitattributes` | `* text=auto eol=lf`（覆盖 Windows autocrlf，检出也是 LF） |
| `test/conventions.test.js` | 结构约定断言：命名语法 / strict+头注释横幅 / -core·-registry 配单测 / 文本卫生 / 文档指针零死链 |
| `package.json` 的 `ffmpeg-static`（devDependency） | 一次性音频转码工具链（A7 素材入库：mono 44.1kHz AAC/m4a，决策见 adr/0003）；不进运行时——浏览器直引 js、server.js 只用内建模块，零依赖定位不破 |

规范分三层被执行：**格式归 lint**（零错误才算过）、**结构归守门测试**（手滑即红）、
**运行时归 boot 冒烟 + 各模块单测**。三者都绿才可提交。

## 6. 本地偏离登记表（对 Google 指南的已批准偏离）

| # | 偏离 | 理由 | 豁免位置 |
|---|---|---|---|
| 1 | JS 列宽 120（指南 80）+ 数据表行豁免 | 中文注释/参数表驱动（MISSION 锁定风格） | eslint.config.mjs |
| 2 | js/ 关闭 prefer-const、no-unused-vars | 共享词法环境：跨文件赋值/消费文件级分析不可见（§2.1） | eslint.config.mjs |
| 3 | 经典 script + CommonJS 导出守卫（非 ES module） | 无构建步骤约束（MISSION） | MISSION.md Constraints |
| 4 | CSS/HTML 用 id 选择器且 id 为 camelCase | DOM id 是模式注册表三元组契约（id↔cardXxx↔menuXxx），有测试断言 | stylelint.config.mjs / .htmlhintrc |
| 5 | CSS 关闭 no-descending-specificity | css 按加载顺序分层覆盖是既有架构 | stylelint.config.mjs |
| 6 | HTML id 不含连字符（指南 id 条款） | 同 #4 | .htmlhintrc |
| 7 | CSS 保留 `-webkit-appearance` 前缀版（与标准版并存，行内 disable property-no-vendor-prefix） | 旧 iPad Safari 只认前缀版外观属性；音量滑杆（A8）自绘 thumb 必须去默认外观 | css/touch.css 两处行内 |
| 8 | math-build-world（摆与搭世界轨）采用指针锁定宿主，偏离 MISSION"无键盘/指针锁定"约束 | 放置类变体需要瞄准射线持续操作（MC 建造形态的关卡内临时放置）；hop 混合宿主仍保持纯点选不锁指针——仅此一宿主受限 | docs/math-mode-design.md §9 |
| 9 | js/mob-look/ 文件名带下划线（如 zombified_piglin.js），不合 kebab-case | 造型档案文件名=declare 键=MOB_TYPES id（票②拍板：文件名与注册表键零变换，防第二条映射规则漂移）；与 modes/（文件名=模式 id）同理按注册表管，test/mob-look.test.js 断言文件名=键集 | test/conventions.test.js 命名断言豁免 js/mob-look/ |
| 10 | 模块头注释用 `====` 框线包边（Google JS 指南 §4.8.1 "Comments are not enclosed in boxes drawn with asterisks or other characters"） | 框线是横幅契约的可识别边界，test/conventions.test.js 断言其存在；查证与裁决见 docs/agent-context-research.md §3.2 | test/conventions.test.js 横幅断言 |
| 11 | CSS 保留 `-webkit-user-select` 前缀版（与标准版并存，行内 disable property-no-vendor-prefix） | Safari/iOS Safari 只认前缀版（caniuse 对 user-select 记的是合并前缀口径，css-tricks 前缀表明列 Safari 须 `-webkit-`）；缺前缀则 touch.css 全局防误选在 iPad 上整体失效（2026-10-28 真机复现） | css/touch.css 行内 |

新增偏离必须登记在此表并给理由；未登记的偏离视为违规。

## 7. 测试装具与环境纪律（2026-11-14 retro 沉淀）

> 出处：2026-11-14 两份 retro（入口缝线 + 村民波次一）的机械错误与环境债收敛。
> 判断题能机器判的落测试断言/脚本，不能机器判的如实登记为约定并给证据指针——
> 不硬造防线。本节各条标注执行者；「勿拆」属性同已落地防线。

### 7.1 Node 测试 vm 装载规约（村民债 2 三连坑成文——评审执行）

vm 沙盒与宿主跨域三条铁律（同族坑三连后成文，**新红测立票默认引用本节**）：

1. **宿主域摊平门面**：vm 沙盒对象与宿主对象原型不同 realm，`deepStrictEqual` 按原型比对必假红——vm 域产物先摊平进宿主域（数据 JSON 往返 / `Array.from` 拷回 / 逐字段抄写）再断言；
2. **跨域断言走桥接查询**：冻结性、函数行为等 JSON 往返不保的面，桥接一条查询面回宿主域断言（「冻结性属源对象本身, JSON 往返不保——桥接一条查询面」先例，town-npc-registry.test.js）；
3. **桩挂宿主 global + 共享实例保 instanceof**：ESM/script 混载下闭包自由变量按定义处词法作用域解析——THREE/document 等桩塞进 vm ctx 拦不住宿主域闭包，桩必须挂宿主 global 且宿主/vm 共享同一实例（mob-look.test.js `global.THREE = stubThree()` 先例）。

先例指针（动装具前先读）：test/prefab-kit.test.js:122（vm 对象先摊平进 Node 域）、
test/town-npc-registry.test.js:72（先摊平+桥接查询）、test/adventure-mode.test.js:150（快照桥接）、
test/math-levels.test.js:1128（Array.from 拷回本 realm）、test/tank-mode.test.js:41（mkMode 全局桥接）、
test/mob-look.test.js:331（桩挂宿主 global 共享实例）。
执行者：评审（红测立票引用）+ 装具改动现场自检。

### 7.2 假 DOM 装具单一来源（缝线 A1——守门测试执行）

test/ 假元素一律 `require('./helpers/fake-dom.js')` 的 `mkEl`；测试文件禁止自定义元素工厂
（`fakeEl`/`mkEl`/`mkFakeEl` 定义即红）。缘起：T-UI-03/04 两度复发——本地副本假 DOM 暴露
非标准面（attrs 私有小平面/裸数组 children），生产照装具形状写而非照真实 DOM 契约写，
三门全绿真机即炸；「第四站点」=再造一份本地工厂继续撒谎。工厂面清单与设计缘起见
test/helpers/fake-dom.js 头注释（面收敛一处改处处改）。

登记例外（专用驱动桩非通用元素工厂，理由见各自文件头）：math-world / math-paradigms /
math-track / math-build-world 的 `mkFakeEl`、focus-paradigms 的 `mkFakeElDrv`（守门断言
内 `ALLOW` 表是唯一权威）。不在扫描面：vm 笼源码串（town-ui.test.js `__el`，标准面同形）、
生产 headless（js/town-ui.js mkHeadlessDoc——业务文件，与工厂同形；收敛走工程线票）。
测试体清场/探针走标准面：清子件用 `while (el.children.length) el.removeChild(el.children[0])`
（js/town-ui.js clearChildren 同款），类名探针用 `classList.contains`——live 集合无
`length` 赋值面，裸 `_cls` 探针随工厂收敛一并绝迹。
执行者：test/conventions.test.js「假 DOM 元素工厂单一来源」+「工厂 smoke」两条断言。

### 7.3 Windows/PowerShell 提交与日志纪律（村民债 4 模板化——纪律登记）

- git 提交消息避免 `~` `#` em-dash（扫描器拒）；多语句拆单条，commit 用多个 `-m`；
- 日志落盘一律工具直写（write/edit 或 `.scratch/run-green.js`），**禁 `| Out-File` 管道**
  （GBK 代码页把中文写成混合编码，日志报废重写）；中文核对 grep/read 直读文件；
- 起服务先探 8080 占用，`node server.js <port>` 换口（多分区同机冲突）。

执行者：纪律（评审抽查）。本节是「对策散在交接文与各票派令」的模板化收敛，替代逐派令重发。

### 7.4 红基线红因分类留痕（缝线建议 2——脚本面+纪律面）

装具炸（TypeError/ReferenceError 等）**≠**断言红（AssertionError）——红自证必须区分表述，
以日志实读为准，勿凭印象写（先例：T-UI-05 回执红因 800ms 失真）。机械面：
`.scratch/run-green.js` 捕获到失败输出时自动在日志尾段追加 `[red-cause]` 分类段
（断言红/装具炸嫌疑的 Error 类名计数 + 失败测试清单）；回执引用该段，不手写红因。
执行者：run-green.js 分类段（机械）+ 回执表述纪律（人）。

### 7.5 DOM 交互码写前对照 MDN 标准面（缝线建议 1——纪律登记）

新 DOM 交互代码写码前对照 MDN 标准面；「stub 真实化」后自问「还有哪个面没核」
（classList/attrs/children/click/contains/removeChild/parent…）——T-UI-04 判例：
按列举修了三处面仍漏 children 维度，第二次渲染即断。生产代码禁读装具私有小平面
（`.attrs` 等），一律以真实 Element 契约为准（js/town-ui.js 禁 `.attrs` 直读 +
禁 `.children.数组方法` 直调的源码切片守门已在库）。
执行者：评审 + 既有源码切片守门（面扩列随守门走，不另立清单脚本——第二份清单必漂移）。

### 7.6 对话域守门四面（T-NPC-11 登记——测试侧执法）

对话链四类既有守门断言：①状态机 **9 态 × 全意图集**逐对全枚举（按表转移/click-npc
双起步/零惩罚拒绝三择，永不抛永不出表外）②事件名权威常量面（DIALOG_EVENTS 冻结三键
= town-ui/dialog/* 唯一权威，禁第二份誊写）③对话链源文本零键盘绑定（点击为唯一
必要操作）④三件套文案零段落语义（面板正文/选项标签零换行且 bounded）。权威面：
town-ui-dialog-spec.md §5.3（场景表）/§1.7（无段落文本）；test/town-dialog-core.test.js
与 test/town-ui.test.js 执法；新增会话类型或状态时同步扩枚举。

### 7.7 .scratch 工件追踪口径（villager-wave3 件④裁决——需求线登记）

.scratch 不设 .gitignore 规则，入册与否全由显式 `git add`（收口入库）决定。三类口径：

- **跨会话协调工件一律入册**：tickets/（票面+台账）、receipts/（收口回执/提案/拍板投递）、
  briefs/、handoffs/、PO-REVIEW-RECORD 等跨会话协调件——产出后在当票收口 commit 入库，
  不留未跟踪窗口（「收口入库」先例链：63ac879、9989491、dfdb543、ab461bf、342704c）。
  教训（2026-11-16 villager-wave3）：工件在 A checkout 产出未入库的窗口期，B checkout
  （worktree）读不到，易误判「未跟踪分裂/数据丢失」而被迫跨仓绝对路径读件——根因是入库
  窗口与分支不同步，非追踪口径分裂（涉案 receipt 自波前基线 a30f7f6 起即在册）。
  长驻 worktree 分支开工前先并一次当值 main，防同类误读。
- **生成器与批产资产有意不入册**：`.scratch/town-design/gen/` 与 `assets/villagers-mobs/`
  （eslint 不豁免 .scratch，gen js 禁入仓库——town 线裁决一在案）；持久真源由
  `js/mob-look/town_*.js` + `test/fixtures/town-npc-golden.json` 承接（T-NPC-01 硬要求）。
- **瞬态运行日志不入册**：跑测/lint 留痕（`*.log`/`*.txt`）落 .scratch 不 add；历史存量
  （glider/town-seam-change 时代日志）系 worktree 删前保全批量收拢，不回改不迁移。

引用卫生：权威内容已并入 docs/ 的工件（判例：案⑤提案 → `docs/design/town-ui-dialog-spec.md`），
票面/台账引用一律指 docs/ 权威位，原工件只作过程溯源；存量指针不回改，随所在行下次正当变更改指。
执行者：纪律（各线收口自查，评审抽查）。

## 变更记录

- 2026-10-22：初版。基于两份调研报告成文；同日完成存量全量对齐（ESLint 清零 21057→0、
  CSS 展开式排版+类名 kebab-case 迁移 134 处、HTML 缩进、行尾统一 LF、头注释契约补齐），
  209 项既有测试全数通过。
- 2026-10-23：§6 登记 #7（css/touch.css 的 `-webkit-appearance` 行内豁免——A8 音量滑杆
  入库时的旧账补记）。
- 2026-10-23：§1.12 新增（移植伴生机制守则——方块级联一期的流程沉淀：移植机制须连
  状态伴生机制一起清点，不移植项登记设计稿附录 B）。
- 2026-10-24：§6 登记 #8（math-build-world 指针锁宿主对 MISSION"无指针锁定"约束的
  偏离——数学冒险岛 T6 收尾补记）。
- 2026-10-25：§1.9 存量命名偏差清单删「mob-taxonomy」行——随 mob-registry.js 落地
  （架构治理候选 8 T1：MOB 四表自 config.js 拆出，-registry 契约），测试 git mv
  改名收编为 test/mob-registry.test.js，偏差消名。
- 2026-10-26：§1.9 存量命名偏差清单补收 world-integrity 与 world-vertexlight——昼夜
  D2/D3 落地的两个专题测试（js/world.js 的全图不变量扫描与顶点光材质注入），同款口径：
  不改名，测试头注释写明对应哪个模块文件（双轴评审跟进补账）。
- 2026-10-26：§6 登记 #9（js/mob-look/ 文件名=declare 键带下划线——造型档案票②铺开
  36 怪时落地：键集与文件名零变换由 test/mob-look.test.js 断言，命名守卫豁免该目录）。
- 2026-10-26：造型档案票③拆旧收尾（mobs.js 内联骨架/手绘头像/碎块表退役，rigOf 直查
  造型档案——三票过渡双轨消名，无新增偏离登记项）。
- 2026-10-28：文档结构治理（依据调研 docs/agent-context-research.md）：新增 docs/README.md
  索引（交通警察页，只放链接与状态）；§1.11 增补生命周期状态标注约定（已完工/已废弃
  不删、标后继——22 个历史工件补标）；§1.7 增补横幅纪律（叙事段 ≤15 行 + 四层下沉
  去向）；§6 登记 #10（==== 框线对 Google §4.8.1 的偏离）；conventions.test.js 新增
  文档指针零死链断言（含 md 相对链接，防根目录 `../` 出仓式断链）；五个超长横幅叙事段
  瘦身（adventure/mode-kit/math/camp-kit/showroom 门面，-134 行，interface/依赖清单
  逐字节保留）；修正 RESOURCES.md 根目录断链 6 处；GLOSSARY 补词条一览索引并修正
  探险地图尺寸 128→160 漂移。
- 2026-10-28：iPad5 误选蓝框修复（紧张连点/拖动把 UI 文字选中）——根因是 touch.css
  全局 `user-select: none` 只有无前缀版，WebKit 只认 `-webkit-user-select`，规则在
  iPad 上从未生效；§6 登记 #11（css/touch.css 行内豁免）+ js/input.js 增
  `selectstart` 全局兜底（表单控件放行）。
- 2026-11-14：§1.1 mob-look 行键集口径回写（T-NPC-06 F1，非新约定）：白名单测试
  test/mob-look.test.js 已改源为「存量键集(MOB_TYPES∪player)⊆ 造型键集 · 非 MOB_TYPES 键必
  town_ 前缀且 ∈ 镇民注册表键集」（T-NPC-01 §6.5 / T-NPC-03 §4.2 两轮授权改源，
  14 个 town_* 镇民档案不入战斗注册表），§1.1 补 ∪ town_*（键集=镇民注册表
  town-npc-registry）对齐现状。
- 2026-11-14：§7 新增「测试装具与环境纪律」（两份 retro 环境改进落地，env-steward 线）：
  7.1 Node 测试 vm 装载规约（村民债 2 三连坑成文）、7.2 假 DOM 装具单一来源
  （工厂 test/helpers/fake-dom.js + test/conventions.test.js 守门断言 + 工厂 smoke）、
  7.3 Windows 提交与日志纪律模板化（村民债 4）、7.4 红基线红因分类（.scratch/run-green.js
  机械分类段 + 回执表述纪律）、7.5 DOM 交互码 MDN 标准面自检；§0 速览补「装具与环境」行。
  同日 GLOSSARY 一览↔正文双向对齐修正（确定性检查首战抓获的漂移：城镇地图核心索引名
  去「数据件」后缀对齐被守门钉死的正文头、7 条目随正文归位游戏模式分区 38→45、
  大分块 74→67、玩法时间预算正文头形态统一为 **词条**: 惯例式）；
  新增 GLOSSARY 一览计数=实际+双向对齐确定性检查（A2，手数漂移史 69→70→71→74 一次到位）。
- 2026-11-16：§7.7 新增（.scratch 工件追踪口径三类：协调工件收口入库 / 生成器与批产资产
  有意不入册 / 瞬态运行日志不入册 + 引用一律指 docs/ 权威位——villager-wave3 件④转需求线
  裁决落档；查证勘正「receipts 未跟踪」误诊：涉案 receipt 自波前基线起即在册，根因是入库
  窗口与分支不同步）。
