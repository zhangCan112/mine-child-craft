# 项目工程结构（一文件一模块 · AI 可导航）· 调研报告

> 调研问题：为持续由 AI 代理开发的原生 JS 项目建立"文件名即模块索引"的工程规范，调研外部最佳实践并盘点仓库现状。
> 所有事实性论断附来源 URL 与来源性质；抓取失败或只有二手证据的地方明确标注。本仓库现状以源码为准。
> 抓取日期：2026-10-22。§3 与 §4 中标【建议】的内容是本报告基于证据的提案，非仓库既有规则，也不是任何外部标准的要求。

## 0. 结论先行（TL;DR）

1. **"模块身份钉在文件系统路径上"是被多种语言生态验证的惯例**：Java 用规范强制"public 类 ↔ 同名文件"、Python 模块即文件、Go 包即目录。本仓库的"文件名即模块索引"与此同构；差别是经典 `<script>` 共享词法环境没有编译器替你强制命名约定——所以本仓库用**注册表 + 测试断言**（mode-registry 模式）代替编译器，这恰好是 Google SWE 书"规则要靠工具自动执行"主张的等价物。
2. **外部没有可信的"文件行数上限"数字，且权威来源明确反对任意数字上限**：Ousterhout 指出任意数字上限制造浅模块与纠缠；Google 明确不为变更大小设自动拒绝线。判据应是**责任**（一句话说不清这个文件干什么 = 该拆或该并），行数至多是"重审责任"的触发信号。
3. **本仓库的隐性惯例已经高度接近一套成文规范**（一文件一模块、后缀语义、头注释契约、GLOSSARY 词汇表、docs 三段式、test 镜像、注册表断言），缺的主要是一份**入口文件**：根目录没有 AGENTS.md / CLAUDE.md / README，AI 新会话无法自动发现这套规范。
4. 【建议】最小补齐动作：根目录新增一份简短 AGENTS.md（指路 MISSION/GLOSSARY/docs/测试命令），把 §3 的判据与 §4 的清单作为其正文；其余惯例显式化即可，不需要重构。

## 1. 外部证据

### 1.1 Software Engineering at Google

来源性质：Google 工程师所著 *Software Engineering at Google* 官方免费在线版（CC BY-NC-ND 4.0），一手出版物。本次抓取了第 3、8、18 章。

- **规则为什么存在、如何被执行**（第 8 章 "Style Guides and Rules"，https://abseil.io/resources/swe-book/html/ch08.html ）：
  - "Rules are laws. They are not just suggestions." 规则的目标是管理复杂度、让代码库随时间与规模仍可维护；其中一致性（consistency）本身就是目的——"It's the consistency of having one answer rather than the answer itself that is the valuable part"（命名、缩进、import 顺序这类"选一个并记录之"的规则，价值在于不再争论）。
  - **"Optimize for the reader"**：代码被读的次数远多于被写；宁可信徒打字繁琐，不让读者费解。还要求代码里留下意图的"原地证据"（evidence of intended behavior），文档注释（documentation comments）描述其后代码的设计与意图。
  - **执行方式**："we strongly prefer to automate enforcement with tooling"，且 "Automated rule enforcement ensures that rules are not dropped or forgotten as time passes or as an organization scales up"——规则若只靠人的记忆必然随时间失效；工具化执行还消除了解释偏差。这正是本仓库"命名约定由 test/mode-registry.test.js 断言"做法的理论依据：无构建步骤的项目里，`node --test` 就是那个"工具"。
  - **关于大小上限**："this is why we do not have any tooling to autoreject a proposed change that exceeds an arbitrary line limit"——Google 明确拒绝为变更行数设自动拒绝线，因为"小"的定义是模糊的，20 行的改动也可能难审。
- **Readability 与知识的可发现性**（第 3 章 "Knowledge Sharing"，https://abseil.io/resources/swe-book/html/ch03.html ）：
  - Google 的 Readability 流程：通过代码评审把语言惯用法、代码结构、API 设计等最佳实践标准化地传播给每个工程师——规范的存活靠"评审/流程"而不只是文档本身。
  - "Establishing Canonical Sources of Information"：信息要有唯一权威源，对抗信息孤岛与信息碎片化——对应本仓库 mode-registry 的"唯一权威、不持影子"。
  - 文档要**可预测地放在源码旁边**（g3doc），且 "Any sufficiently undiscoverable or unsearchable documentation might as well not exist"——不可发现的文档等于不存在。这是"文件名即索引"最直接的背书：AI 或新人找模块，第一入口就是文件名与目录结构。
- **细粒度模块与 1:1:1 规则**（第 18 章 "Build Systems"，https://abseil.io/resources/swe-book/html/ch18.html ）：
  - "Using Fine-Grained Modules and the 1:1:1 Rule"：粒度是性能（构建缓存/并行）与可维护性（依赖清单维护成本）的权衡；"Google tends to favor significantly smaller modules than one might typically write"；对 Java 这类有强包概念的语言，"each directory usually contains a single package, target, and BUILD file (Pants… calls this the 1:1:1 rule)"。
  - "Minimizing Module Visibility"：可见性越小越好，多数 target 只对内可见——对应本仓库"interface 摘要 + 意图 API + 白名单字段"（mobs.js 头注释）的思路。
  - 注意：该章语境是 Bazel 构建系统，本仓库技术栈锁定无构建步骤，**不适用其工具链**，但"偏细粒度 + 最小可见性"的取舍逻辑适用。

### 1.2 AGENTS.md 标准

来源性质：AGENTS.md 官网（该标准的主页与规范文本），事实标准；现由 Linux 基金会下 Agentic AI Foundation 托管，60k+ 开源项目采用，Codex/Jules/Cursor/opencode/Gemini CLI/VS Code 等代理均支持。URL：https://agents.md （GitHub 仓库 https://github.com/openai/agents.md 本次未单独抓取，官网即标准文本）。

关键内容（均为官网原文要点）：
- 定位："README for agents"——给 AI 编码代理的**可预测的、专用的**上下文与指示存放处；README 面向人类，AGENTS.md 收代理需要的构建、测试、约定。
- **放置与发现**：放仓库根目录；大仓可嵌套——"Agents automatically read the nearest file in the directory tree, so the closest one takes precedence"。
- **写什么**：项目概览、构建/测试命令、代码风格、测试指引、安全注意事项等；"What would you tell a new teammate belongs here"。
- FAQ 明确：无必填字段、纯 Markdown；"Will the agent run testing commands found in AGENTS.md automatically? **Yes—if you list them.**"——把 `node --test test/*.test.js` 写进去，代理就会在收尾前跑测试，规范因此从"文档"变成"被执行的约束"。
- 与本仓库的关系：本仓库根目录目前**没有** AGENTS.md（根目录清单核实：只有 GLOSSARY.md、MISSION.md、server.js、index.html 等）。这是 AI 可导航链条上唯一的结构性缺口。

### 1.3 深模块（Ousterhout）

来源性质：书籍 + 作者本人的公开课程页与公开讨论文本。*A Philosophy of Software Design*（2nd ed., 2021）无免费在线全文，**无法给出页码级一手引用**；以下定义引自作者本人署名的公开文本（GitHub 讨论 README），属作者自述的一手来源；课程页佐证概念体系。

- 作者官方书页（https://web.stanford.edu/~ouster/cgi-bin/aposd.php ，2026-10-22 抓取）：确认 2nd ed. 第 6 章标题为 "General-Purpose Modules are Deeper"，与新增章节 "Decide What Matters"。注：任务给的 cs190-winter25 URL 已 404——作者主页注明已退休、"CS 190 is unlikely to be offered again"，改用 winter24 课程页。
- CS190 课程页（https://www.stanford.edu/~ouster/cs190-winter24/ ，课程描述）：本课教"how to decompose large complex systems into classes that can be implemented and maintained easily"，主题含 information hiding、deep classes、API design——即"文件/类职责单一"的教学源头。
- 作者与 Robert Martin 的公开讨论（https://github.com/johnousterhout/aposd-vs-clean-code/blob/main/README.md ，作者署名一手文本，2024-09~2025-02）：
  - **深模块定义**："The best methods are those that provide a lot of functionality but have a very simple interface… I call these methods 'deep'."——深 = 功能多而接口小。
  - **浅模块**："As methods get smaller and smaller there is less and less benefit… The amount of functionality hidden behind each interface drops, while the interfaces often become more complex. I call these interfaces 'shallow'."——过度拆分反而变浅。
  - **纠缠（entanglement）**：理解 A 必须同时读 B 即为纠缠；"Entangled methods can usually be improved by **combining** them so that all the code is in one place."——拆分判据的反面：拆出互相纠缠的两个文件不如合并。
  - **反对任意数字上限**："Setting arbitrary numerical limits such as 2-4 lines in a method… exacerbates this problem."；"complexity is in the eye of the reader"——复杂度由读者判定，不由作者辩护。
  - **注释即抽象**："The first reason for comments is abstraction… without comments there is no way to have abstraction or modularity"；接口注释应描述"使用它所需的全部信息"——本仓库"文件头注释契约"（模块名 + interface 摘要）的理论根据。
- 与"文件=模块"的关系：Ousterhout 的 deep module 是"接口小、藏得多"的模块观，直接支持判据"一个文件配得上存在 ⇔ 它是一个深模块：一句话说得清的 interface，收走一大块实现细节"。

### 1.4 跨语言"文件即模块"先例

来源性质：三种语言生态的**一手规范文档**。共同点：模块身份都由文件系统路径决定，人与工具都按名字定位模块。

| 生态 | 一手来源 | 关键条文 | "文件名=模块名"的形态 |
|---|---|---|---|
| Java | Java Language Specification §7.6（https://docs.oracle.com/javase/specs/jls/se21/html/jls-7.html#jls-7.6 ） | 包存于文件系统时，实现可强制"public 类型必须位于以类名命名的文件中"，否则编译错误；"This restriction makes it easy for a Java compiler to find a named class or interface within a package. **In practice, many programmers choose to put each class or interface in its own compilation unit**, whether or not it is public" | 文件名 = public 类名（编译器强制的查找键） |
| Python | PEP 8（https://peps.python.org/pep-0008/ ） | "Modules should have short, all-lowercase names. Underscores can be used in the module name if it improves readability."；包名同款；公共/内部接口靠 `__all__` 显式声明、`_` 前缀表内部；"code is read much more often than it is written"；一致性层级："Consistency within a project is more important… within one module or function is the most important" | 文件即模块（module），文件名即 import 名 |
| Go | How to Write Go Code（https://go.dev/doc/code ） | "A package is a collection of source files in the same directory that are compiled together. Functions, types… defined in one source file are visible to all other source files within the same package."；包的 import path = module path + 子目录 | **目录**即包（文件不是模块边界），但身份同样由路径唯一决定 |

推论（本报告综合）：三种生态形态不同（Java=文件、Python=文件、Go=目录），但都把"模块的身份与查找键"钉在文件系统命名上，使"按名定位"无需读代码。本仓库"文件名即模块索引"是同一惯例在无构建 JS 里的手工实现；由于没有编译器强制，命名约定必须靠**测试断言**兜底（本仓库已有先例，见 §2）。

### 1.5 AI 可导航代码库的工程实践

来源性质：**厂商工程博客/实验报告，属观点文与经验文，不是标准**。采纳时标注性质，不与 1.1–1.4 混同。

- **Anthropic《Claude Code: Best practices for agentic coding》**（https://www.anthropic.com/research/claude-code-best-practices ，2025-03 发布；文首声明该文已停止维护、最新版迁至官方 docs——抓取时已注明）：
  - CLAUDE.md（Anthropic 版的 AGENTS.md 等价物）会被代理**自动拉入上下文**，是记录命令、代码风格、测试指引、仓库礼仪的推荐位置；可放根目录/父目录/子目录，根目录最常用，应提交进 git。
  - "We recommend keeping them concise and human-readable"，并且要像调 prompt 一样迭代它。
  - 工作流："explore, plan, code, commit"；TDD（先写测试、确认失败、再实现）在代理场景更有效——"Claude performs best when it has a clear target to iterate against"。
- **Anthropic Labs《Harness design for long-running application development》**（https://www.anthropic.com/research/harness-design-long-running-apps ，2026-03）：
  - 长任务代理的核心机制：**context reset + 结构化 handoff 工件**（"using structured artifacts to hand off context between sessions"），代理间通信"via files"——文件是跨会话/跨代理的唯一可靠载体。含义：文件名可预测 = handoff 工件可发现；本仓库每个模块文件头注释就是天然的 handoff 工件。
  - 生成者/评估者分离：自评普遍偏乐观，独立评估者 + 可测试的"完成判据"（sprint contract）才可靠。含义：把命名/结构约定写成单测（会红的断言），就是给 AI 的"完成判据"。
- 未抓到、如实标注：本次未找到"为 AI 设计代码库"的独立于厂商的权威研究；上述两篇是最常被引用的一手经验来源，观点性质。

## 2. 本仓库现状盘点（隐性惯例显式化）

以下每条都以源码核实（读于 2026-10-22）。行数统计为 `Measure-Object -Line` 结果。

### 2.1 目录宪法

| 事实 | 引用 |
|---|---|
| 根目录只有：`css/ data/ docs/ js/ lib/ test/` + `.gitignore GLOSSARY.md MISSION.md index.html server.js`；**无 AGENTS.md / CLAUDE.md / README** | 根目录清单 |
| `js/` 平铺 29 个模块文件 + `js/modes/` 6 个模式文件；共 35 个 js 文件 | `js/`、`js/modes/` 目录清单 |
| `lib/` 只有 vendored `three.min.js` | `lib/` 目录清单 |
| `data/` 是运行时数据，整体 gitignore | `.gitignore:1` |
| `css/` 按端拆 3 个文件：style.css(189 行)/focus.css(128)/touch.css(67)，index.html:7-9 顺序加载 | 目录清单 + index.html |
| `server.js` 零依赖静态服务器（用法 `node server.js [端口]`），server.js:1-5 | server.js 头注释 |
| 测试 `node --test test/*.test.js`（test/ 下 21 个 `*.test.js`） | test/ 目录清单；各测试头注释（如 combat-core.test.js 头部运行说明） |

### 2.2 文件命名语法（现状）

- 全部 kebab-case（29+6 文件无一例外）。
- **后缀语义**（从各文件头注释归纳）：
  - `-core` = 引擎层纯核心，零 THREE/零 DOM/零全局可变依赖，Node 直测：`mesh-core.js:3-8`（"纯变换…零 THREE · 零 DOM…Node 可直接加载单测"）、`combat-core.js:3-10`（"零全局依赖…Node 可直接加载; 有单测"）、`voxel.js:3-9`（体素模型，同款声明）、`tank-core.js:3-6`（"零 THREE · 零 DOM · 不读键盘…Node 直测"）、`quality-core.js:9`（"纯核心不碰 renderer/DOM"）、`mob-core.js`。
  - `-registry` = 清单唯一权威（纯数据+纯函数）：`mode-registry.js:3-13`（"游玩模式清单的唯一权威…main.js 只消费, 不再另持…影子"）。
  - `-kit` = 多模式共用的工具集/interface 收口：`mode-kit.js:3-13`（"把四个模式各自复制的样板收进一个深 interface"）、`scene-kit.js:3-9`。
  - `-levels` = 关卡/数据表：`tnt-levels.js`、`focus-levels.js`。
  - `-worker` = Worker 入口：`mesh-worker.js`（**不在 index.html script 列表里**，由 Worker 构造加载——index.html:224-258 核实）。
  - 无后缀 = 引擎 adapter（THREE/DOM 所在）：`world.js:3-4`（"渲染 adapter (THREE)…本文件不定义游戏规则"）、`effects.js`、`mobs.js`、`tank.js` 等。
- **模式目录约定**：`js/modes/<modeId>.js`；唯一例外 `tank-range.js` 对应 id `tank`，例外本身登记在注册表（`mode-registry.js:19` 的 `src: 'js/modes/tank-range.js'` 字段）。
- 命名三元组（id ↔ `cardXxx` ↔ `menuXxx`）由注册表派生函数生成（mode-registry.js:23-29），`test/mode-registry.test.js` 对着 index.html 逐条断言（test/mode-registry.test.js:2-5 自述："把'三重命名约定'…从口头约定变成断言: 注册表加行而 index.html 忘加卡/页/script, 这里立刻红"）。

### 2.3 文件头注释契约（现状格式，抽样 12 个文件）

通行格式 = `"use strict"` 后的块注释，含四到五要素（强弱不齐，逐文件核实）：

```
模块名（中文 + 英文/括注） — 层（引擎层/应用层/模式层）
一句话职责
interface 摘要（入口函数/对象清单）
依赖（"均经全局名, 调用期解析"）与加载序
术语引用 GLOSSARY.md
```

- 五要素齐全的样板：`mobs.js:2-30`（含 interface 清单 + 模式可写白名单 + "THREE/DOM 全部惰性创建:…Node 测试环境可安全加载"）、`mesh-core.js:2-16`、`combat-core.js:2-11`、`mode-registry.js:2-13`、`tank-core.js:2-11`、`mode-kit.js:2-13`、`modes/nether.js:2-16`。
- 较弱的：`world.js:1-5`（有职责与指向 voxel.js，但无 interface 摘要、未引 GLOSSARY 条目）、`main.js:1-4`（仅一行"模式注册 / 菜单页面 / 主循环"）、`quality-core.js:2-10`（无 GLOSSARY 引用）。

### 2.4 分层规则

- 引擎层定义：GLOSSARY.md:9-11（"不含玩法与政策…引擎不知道任何具体玩法"）；应用层：GLOSSARY.md:73-75（"应用可依赖引擎，**引擎不得依赖应用**"）。
- 代码内自证：mode-kit.js:12（"引擎层(world/input)对本文件零依赖; 本文件属应用层"）。

### 2.5 GLOSSARY / MISSION / docs / test

- `GLOSSARY.md`：deep-module 风格术语表——每条 = 名词 + interface/职责描述 + **_Avoid_ 别名**（防散称），如"网格化核心（MeshCore）"GLOSSARY.md:21-23、"模式注册表（ModeRegistry）…唯一权威"GLOSSARY.md:77-79。词汇覆盖层名、引擎模块、政策、玩法模式。
- `MISSION.md`：项目使命/成功标准/约束（技术栈锁定在 Constraints，MISSION.md:15）。
- `docs/` 三段式：同一主题 `-plan.md` / `-design.md` / `-research.md`（实例：monster-taxonomy-plan/design/research.md、shared-monsters-plan/design.md、tank-plan.md + tank-impl-design.md）；调研文档有统一头部格式（问题 + 来源声明 + "本仓库现状以源码为准"，chunk-streaming-lod-research.md:1-7）；`docs/adr/NNNN-slug.md` 收不可逆决策（adr/0001-daily-budget-single-key.md，含 Considered Options/Consequences）。
- `test/` 镜像规则（21 个文件逐一对照）：
  - 同名镜像多数：combat-core、daily-budget、focus-paradigms、held-item、mesh-core、mesh-worker、mob-core、mobs、mode-kit、mode-registry、quality-core、save-slot、speech、tank-core、tnt-levels、voxel。
  - 命名偏差（既成事实）：`world-rings.test.js` ↔ world.js；`nether-mode.test.js` ↔ modes/nether.js；`tank-mode.test.js` ↔ modes/tank-range.js；`mob-taxonomy.test.js` ↔ config.js 的 MOB_TYPES/FAMILIES 数据；`boot.test.js` = 全链冒烟（boot.test.js:2-9：按 index.html 真实顺序在共享 vm context 执行全部脚本，专抓"共享词法环境顶层 const 重名即炸"这类只有浏览器才暴露的错误）。
  - 无专属测试的模块：effects、avatar、camera-rig、input、sync、icons、focus-icons、focus-levels、config、tank、modes/{arena,build,tnt,focus}——均为 THREE/DOM 重的 adapter 或模式层，经 boot 冒烟与模式测试间接覆盖。**"可测的都剥成了 -core"是现状的隐性分层策略**。

### 2.6 行数分布（事实，供 §3 判据讨论）

28（icons.js）～1399（modes/arena.js）；前列：arena.js 1399、mobs.js 1129、modes/tnt.js 648、tank.js 640、focus-paradigms.js 477、modes/nether.js 439、modes/build.js 414；`-core` 文件全部 ≤221 行。现状无任何行数规则，也未发现因行数本身引发的问题记录。

## 3. "一文件一模块"判据（建议稿）

以下均为【建议】（基于 §1 证据 + §2 现状归纳），供项目所有者裁剪后写进 AGENTS.md。

### 3.1 一个文件配得上存在 ⇔ 它是一个"一句话模块"

新文件（或存疑的旧文件）过三问，全部"是"才成立：
1. **一个责任**：能用一句中文说清"这个文件是什么"，说清时不需要"和"、"以及"连接两个不相干的动词？（Ousterhout：深模块 = 接口小、藏得多；§1.3）
2. **一份 vocabulary**：它引入或收口了至少一个有名字的概念，这个词值得进 GLOSSARY 或至少进头注释？（GLOSSARY 的 _Avoid_ 别名即证据：名字被人叫错过的模块才是真模块）
3. **一个 interface**：能在一个对象/少量入口函数后面藏住实现，调用方不需要读它的实现细节？（"零 THREE · 零 DOM"的 -core 是其最强形态）
反之，若一段代码离开邻近代码无法独立理解（entanglement，§1.3），它**不该**成为独立文件——合并回去。

### 3.2 命名语法

- 一律 kebab-case（现状 35/35，保持）。
- 后缀语义表（显式化 §2.2）：
  - `-core`：纯逻辑核心。零 THREE、零 DOM、零全局可变依赖、加载零副作用，**必须有同名单测**。依赖一律"经全局名、调用期解析"并在头注释列出。
  - `-registry`：某类清单的唯一权威（纯数据+纯函数），消费方不得持影子副本；**必须配"对着消费端断言"的测试**。
  - `-kit`：跨模式共用工具/深 interface 收口。
  - `-levels` / `-icons`：数据表/图标资源。
  - `-worker`：Worker 入口（不进 index.html）。
  - 无后缀（js/ 平铺）：引擎或应用的 adapter（THREE/DOM 允许在此）。
- 模式文件：`js/modes/<modeId>.js`；id 与文件名不一致时，**例外必须登记在注册表 src 字段**（先例 mode-registry.js:19），并在 GLOSSARY 模式条目可查。

### 3.3 何时拆分 / 何时合并——责任是判据，行数不是

- **拆分信号**（满足其一即考虑拆）：
  1. 头注释的 interface 摘要写不下或开始自相矛盾（责任超载的直接证据）；
  2. 文件里出现第二份 vocabulary——两组词各自只被不同的调用方使用；
  3. 纯逻辑与 THREE/DOM 装配搅在一起，想测逻辑必须起浏览器——按先例剥 `-core`（world.js→mesh-core.js、tank.js→tank-core.js、mobs.js→mob-core.js 均此路径）；
  4. 两个模式开始复制同一段样板——收进 `-kit`（mode-kit.js 自述先例）。
- **合并信号**：拆出的两部分互相纠缠——读 A 必须同时翻 B，或 A 的头注释必须解释 B 的内部状态（§1.3 entanglement；Ousterhout："combining them so that all the code is in one place"）。
- **行数**：外部**没有**可信的文件行数上限（§1.1 Google 不设自动拒绝线；§1.3 Ousterhout 反对任意数字上限；各来源均未见"每文件 ≤N 行"的规范数字），本报告**不设行数规则**。行数只作自查触发器【建议】：超过约 800 行（现状 P99 附近）时重问一遍 §3.1 三问——答得上来就不拆（arena.js 1399 行若仍是"竞技场玩法"一句话，就是合法的）。

### 3.4 新文件放哪（决策树）

```
纯逻辑、想单测            → js/<name>-core.js        (+ test/<name>-core.test.js)
清单/注册（多处消费）      → js/<name>-registry.js    (+ 对消费端断言的测试)
跨模式工具/interface      → js/<name>-kit.js
THREE/DOM 装配（引擎）     → js/<name>.js
玩法模式                  → js/modes/<modeId>.js     (+ 注册表加行 + index.html 卡/页/script)
数据表（关卡/数值/图标）   → config.js 或独立 <name>-levels.js
Worker 入口               → js/<name>-worker.js
样式                      → css/ 按端拆分
调研/设计/计划文档        → docs/<topic>-{research,design,plan}.md
不可逆决策                → docs/adr/NNNN-slug.md
术语                      → GLOSSARY.md（见 3.6）
```

### 3.5 模块头注释契约（显式化为硬格式）

```
"use strict";
/* ============================================================
   <中文名>（<EnglishName>）— <引擎层|应用层|模式层>（术语见 GLOSSARY.md）
   ------------------------------------------------------------
   <一句话：它是什么、藏住什么；调用方只需要知道什么>
   interface: <入口函数/对象一行清单>
   依赖(均经全局名, 调用期解析): <文件与符号；加载序说明>
   [可测性声明: 零 THREE · 零 DOM · 有单测 | THREE/DOM 惰性创建: Node 测试环境可安全加载]
   ============================================================ */
```

现状多数文件已达标（§2.3）；world.js、main.js、quality-core.js 等 3 处补齐即全部一致【建议】。

### 3.6 进 GLOSSARY 的判据

满足任一即收：
1. 该词**跨模块**出现（≥2 个文件的调用方在用，或跨层引用——如"每日预算"同时被政策与代码引用）；
2. 该名字**曾被叫错/有历史别名**（_Avoid_ 行有实际内容即是证据，如 focusSpeak、MODE_CARDS）；
3. 它是**层的名字或层的边界规则**（引擎层/应用层这类约束全仓库的词）。
一次性实现细节、只在一个文件内部使用的名字不进。每条格式沿用现状：定义 + interface/职责 + _Avoid_ 别名。

### 3.7 test 镜像规则

- 默认：`test/<模块文件同名>.test.js`（js/modes/x.js 的测试去掉目录、加 `-mode` 后缀或同名均可，但**选定一种并保持**）。
- `-core` / `-registry` 必须有同名测试（现状如此，显式化）。
- THREE/DOM adapter 不强制直测：由 boot.test.js 冒烟（共享词法环境重名/顶层炸错）+ 模式测试覆盖；要直测就先剥 `-core`。
- 【建议】存量命名偏差（world-rings、nether-mode、tank-mode、mob-taxonomy）不必改名，但各自测试头注释写明"↔ 对应哪个模块文件"，让 AI 按名能双向找到。

### 3.8 "注册表 + 测试断言"模式何时用

判据【建议】：一条约定满足以下两点，就该从口头约定升格为注册表+断言：
1. **清单出现在 ≥3 处**（或"两处即有漂移史"）——如模式清单曾出现"三份影子表达已归一"（GLOSSARY.md:77-79、mode-registry.js:7-8）；
2. **手滑必炸且炸在运行时**（浏览器里才红）——断言把它变成提交前就红（test/mode-registry.test.js 的存在理由，其头注释自述）。
升级路径固定：**唯一权威数据源（纯数据+纯函数） → 消费方只派生不复制 → 测试对着消费端产物（index.html）逐条断言**。反例即 Google SWE 书的"信息孤岛/信息碎片化"（§1.1）。

## 4. AI 可导航性清单（已有/缺失）

目标链路：**新会话 AI 自动读到入口文件 → 靠 GLOSSARY 术语找模块 → 靠文件名/目录直达文件 → 靠头注释契约获得 interface → 靠测试断言知道约定是硬的**。

| # | 环节 | 依据 | 本仓库现状 |
|---|---|---|---|
| 1 | 根目录 AGENTS.md（入口：测试命令 `node --test test/*.test.js`、启动 `node server.js`、规范指路、编码规约摘要） | AGENTS.md 标准（§1.2：根目录、代理自动读取、测试命令会被自动执行）；Anthropic 经验（§1.5：简短、可读、像 prompt 一样迭代） | **缺失**（根目录无 AGENTS.md/CLAUDE.md/README）——全链条唯一结构性缺口 |
| 2 | 词汇表 = 模块索引的"人读版" | swe-book"不可发现的文档等于不存在"（§1.1）；Ousterhout 注释即抽象（§1.3） | ✅ 已有 GLOSSARY.md（含 _Avoid_ 别名），质量高 |
| 3 | 文件名即模块索引（平铺 + modes/ + 后缀语义） | 跨语言先例（§1.4） | ✅ 已有且 35/35 一致；后缀语义未成文（本文 §3.2 即成文稿） |
| 4 | 每模块头注释 = interface 摘要（handoff 工件） | Ousterhout 接口注释（§1.3）；Anthropic"结构化工件跨会话交接"（§1.5） | ✅ 大体已有；3 个文件偏弱（§2.3） |
| 5 | 命名约定 = 测试断言（口头约定变硬约束） | swe-book 规则工具化执行（§1.1）；Anthropic 可验证完成判据（§1.5） | ✅ 已有 mode-registry.test.js + boot.test.js；未推广（§3.8 给判据） |
| 6 | 决策与方案文档三段式 + ADR | swe-book 文档即代码/有唯一权威（§1.1） | ✅ 已有（docs/ 三段式 + adr/0001）；惯例本身未成文，可写进 AGENTS.md 一行 |
| 7 | 层级规则（引擎不知道玩法） | swe-book 最小可见性（§1.1）；GLOSSARY 既有条目 | ✅ 已有（GLOSSARY.md:9-11,73-75）；同样只差在 AGENTS.md 里指路 |

【建议】的最小落地顺序：① 写根目录 AGENTS.md（半页：两条命令 + 指路 MISSION/GLOSSARY/本文 §3 + "改完必跑 node --test"）；② 补齐 3 个弱头注释；③ 在 AGENTS.md 里写死"新约定先问 §3.8 判据"。无需改动任何现有代码结构。

## 5. 来源清单

| # | 来源 | 性质 | URL | 抓取结果 |
|---|---|---|---|---|
| 1 | Software Engineering at Google, ch.8 "Style Guides and Rules" | 一手出版物（官方免费在线版） | https://abseil.io/resources/swe-book/html/ch08.html | ✅ 2026-10-22 |
| 2 | 同上, ch.3 "Knowledge Sharing"（Readability/权威信息源） | 同上 | https://abseil.io/resources/swe-book/html/ch03.html | ✅ |
| 3 | 同上, ch.18 "Build Systems"（1:1:1 规则/最小可见性） | 同上 | https://abseil.io/resources/swe-book/html/ch18.html | ✅ |
| 4 | AGENTS.md 标准官网 | 事实标准文本 | https://agents.md | ✅ |
| 5 | openai/agents.md（标准仓库） | 标准仓库 | https://github.com/openai/agents.md | 未单独抓取（官网即标准文本，如实标注） |
| 6 | Ousterhout 官方书页（APOSD 2nd ed.） | 作者官方页 | https://web.stanford.edu/~ouster/cgi-bin/aposd.php | ✅ |
| 7 | Stanford CS190 Winter 2024 课程页 | 作者课程页 | https://www.stanford.edu/~ouster/cs190-winter24/ | ✅（任务原给的 cs190-winter25 URL 404，作者已退休停课，改用 winter24） |
| 8 | Ousterhout vs Robert Martin 公开讨论 README | 作者署名一手文本 | https://github.com/johnousterhout/aposd-vs-clean-code/blob/main/README.md | ✅（deep/shallow/entanglement 定义出处） |
| 9 | *A Philosophy of Software Design*（书本体） | 书籍（无免费全文） | — | 未抓取；定义以 #8 作者自述代替，页码级引用不可得，如实标注 |
| 10 | Java Language Specification §7.6 (SE 21) | 一手语言规范 | https://docs.oracle.com/javase/specs/jls/se21/html/jls-7.html#jls-7.6 | ✅ |
| 11 | PEP 8 | 一手规范（Python 官方） | https://peps.python.org/pep-0008/ | ✅ |
| 12 | Go: How to Write Go Code | 一手官方文档 | https://go.dev/doc/code | ✅ |
| 13 | Anthropic: Claude Code Best Practices | 厂商工程经验文（观点；文首注明已迁官方 docs） | https://www.anthropic.com/research/claude-code-best-practices | ✅ |
| 14 | Anthropic Labs: Harness design for long-running application development | 厂商实验报告（观点） | https://www.anthropic.com/research/harness-design-long-running-apps | ✅ |
| 15 | "文件行数上限"权威数字 | — | — | **未找到**（#1 明确不设自动拒绝线；#8 明确反对任意数字上限）；如实标注为"无共识数字" |

仓库现状引用均以源码为准：GLOSSARY.md、MISSION.md、.gitignore、server.js(1-60)、index.html(1-260)、js/ 全目录（重点读 mesh-core/combat-core/mode-registry/mobs/world/voxel/quality-core/mode-kit/scene-kit/tank-core/main/modes/nether 共 12 个头部）、test/（mode-registry、boot 头部 + 全目录清单）、docs/（含 adr/0001、chunk-streaming-lod-research 头部）、css/、lib/；行数为实测。
