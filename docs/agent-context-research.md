# 面向 AI 编码代理的仓库文档与代码注释 · 调研报告

> 调研问题：为持续由 AI 代理开发的仓库优化文档体系与代码注释——①文档放置与分层（入口文件规范、docs/ 组织、渐进披露）；②文档-代码一致性（防漂移手段）；③代码注释的规模与分工（承载什么、多长、大段注释如何拆分下沉）。
> 所有事实性论断附来源 URL 与来源性质；抓取失败或只有二手证据的地方明确标注。引文保留英文原句 + 中文说明。
> 抓取日期：2026-10-28。本仓库现状（AGENTS.md 入口、GLOSSARY 收词方式、80 个 docs 平铺、五要素头注释契约等）引用自任务简报给定的事实，未独立重新盘点，标注为【简报给定】。

## 0. 结论先行（TL;DR）

1. **入口文件的唯一共识数字是"短"：Claude Code 官方给 CLAUDE.md/AGENTS.md 定了 ≤200 行的目标**（S4），Codex 默认整条指令链 32 KiB 封顶（S6），Cursor 建议 rule ≤500 行（S7）。更重要的是内容判据而非行数：**"只写代理读代码读不出来的东西"**（S3）——目录结构、依赖清单、架构总览都被官方点名属于应删内容。
2. **渐进披露（progressive disclosure）是原发布方反复证成的模式**：Anthropic 把它定义为代理自主导航信息的三阶段（发现→激活→执行，S8），并明确"文件名与目录层级本身就是代理的检索元数据"（S2）。落到仓库文档 = **短入口常驻 + 索引文件 + 正文按需读**；但注意 CLAUDE.md 的 `@import` 是"假分层"——被导入文件随入口一起全量加载，不省上下文（S4）。
3. **docs/ 的物理分组方式（按主题 vs 按生命周期）没有一手规范强制**；有证据的是三件事：**索引页只当"交通警察"只放链接**（S9 landing pages）、**一个文档一个目的**（S9、S11）、**失效文档要么删要么标 obsolete 并指向后继**（S9、S10 superseded 模式）。Google 自己的平铺无主 wiki 是前车之鉴（S9 GooWiki 案例成了全公司第一大抱怨）。
4. **文档-代码一致性的业界主线是 docs-as-code**：文档进版本控制、有 owner、随代码同一变更评审、"周期性被检验"（S9）。本仓库用 `test/conventions.test.js` 断言文档契约的做法恰好是官方口径里"deterministic 层"的正确定位——AGENTS.md 是 guideline（模型可违反），测试/hook 才是 enforcement（S3）。
5. **注释分工的权威表述**：头注释/接口注释描述"使用它所需的全部信息"（S13 Ousterhout），设计决策不进 API 注释、进专门的设计文档（S9），ADR 记录不可逆决策的 why（S10）。"注释解释 why、代码解释 how"这句格言查无单一原始出处，最接近的一手表述是 Ousterhout 的"注释常承载定性信息，比如*为什么*做这件事，英文（自然语言）比代码更适合表达"（S13）。
6. 【建议】对本仓库最小而具体的动作：AGENTS.md 对照 200 行与"读得出来就删"判据修剪；新增一屏内纯链接的 `docs/README.md` 索引；已完工 plan/tickets 标 obsolete 或移 `docs/archive/`（不物理挪动其余文件，避免破坏 ~50 处注释内文档引用）；头注释五要素全保留但横幅限 ≤15 行，把数百字的论证段下沉到 -design/ADR/GLOSSARY；GLOSSARY 词条压到"定义 1–2 句 + interface + _Avoid_"。逐条依据见 §4。

## 1. 文档放置与分层

### 1.1 AGENTS.md / CLAUDE.md：入口文件的业界规范

**AGENTS.md 规范**（S1，agents.md 官网，现由 Linux 基金会下 Agentic AI Foundation 托管，60k+ 开源项目采用）：

- 定位原文："Think of AGENTS.md as a **README for agents**: a dedicated, predictable place to provide the context and instructions to help AI coding agents work on your project."（把 AGENTS.md 当作给代理看的 README：一个专用、可预测的地方，存放帮助 AI 编码代理工作的上下文与指示。）
- 与 README 分工："AGENTS.md complements this by containing the extra, sometimes detailed context coding agents need: build steps, tests, and conventions that might clutter a README"（补 README 之不足：放构建步骤、测试、约定这些会弄乱 README 的代理专用细节）。
- 放置："Create an AGENTS.md file at the root of the repository."（放仓库根目录。）大仓可嵌套："Agents automatically read the nearest file in the directory tree, so the closest one takes precedence"（代理自动读目录树中最近的文件，最近者优先）。
- 收录判据："anything you'd tell a new teammate belongs here too"（任何你会告诉新队友的东西都属于这里）。
- 被证成的行为效应（FAQ 原文）："Will the agent run testing commands found in AGENTS.md automatically? **Yes—if you list them.**"（写进 AGENTS.md 的测试命令代理会自动执行——前提是你列出来。）即入口文件不只是文档，写对内容就是可执行约束。
- 维护观："Treat AGENTS.md as living documentation."（当作活文档维护。）

**Claude Code 官方对 CLAUDE.md/AGENTS.md 的量化与内容规范**（S4 memory 文档；S3 best practices）：

- 体量红线："target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence."（目标 200 行以内；更长的文件消耗更多上下文并**降低遵循度**。）超限会触发启动警告（"Files over 200 lines consume more context and may reduce adherence"）。
- 收录判据（S3）："Only write down what Claude can't find by reading the repo, or what it would otherwise spend time rediscovering every session."（只写代理读仓库读不出来、或每个会话都要重新发现的东西。）官方给出两问检验："Could it find this by reading the code? 2. Would it actually go and look? If both are yes, leave it out."（读代码能找到吗？它真会去找吗？两个都是就别写。）
- 官方"可以停止做的事"清单（S3）里直接点名："Describe your architecture and file layout in `CLAUDE.md` | Claude reads the repo itself. Only write down what isn't in there."（在 CLAUDE.md 里描述架构和文件布局——代理自己会读仓库，只写仓库里没有的。）`/doctor` 的修剪建议也是砍三类内容："directory layouts, dependency lists, and architecture overviews"（目录布局、依赖清单、架构总览），保留 "pitfalls, rationale, and conventions that differ from tool defaults"（坑、理由、与工具默认不同的约定）。
- 分层体系（S4）：managed policy（组织级）→ user（`~/.claude/CLAUDE.md`）→ project（`./CLAUDE.md` 或 `AGENTS.md`）→ local（`CLAUDE.local.md`，gitignore）。子目录的 CLAUDE.md **按需加载**："Claude Code loads each one once Claude reads, writes, or edits another file in that subdirectory."（只有当代理真的读写了该子目录的文件才加载。）`.claude/rules/` 配 `paths:` frontmatter 可做路径作用域规则，仅匹配文件被打开时加载。
- **`@import` 是假分层**（S4 原文）："Imports help you organize a long file but don't reduce its context cost, because imported files load together with the CLAUDE.md that imports them."（import 帮你组织长文件，但**不减少上下文成本**——被导入文件随入口一起加载。）想省上下文要用按需加载机制（子目录文件/路径规则/skills），不是 import。

**OpenAI Codex 对 AGENTS.md 的处理**（S6）：指令链从全局（`~/.codex/AGENTS.md`）到项目根再向下到当前目录，"Codex concatenates files from the root down... Files closer to your current directory override earlier guidance"（从根向下拼接，越近越优先）；硬上限："Codex skips empty files and stops adding files once the combined size reaches the limit defined by `project_doc_max_bytes` (**32 KiB by default**)"（合并达到 32 KiB 默认上限即停止追加——超出的文件根本不进上下文）。openai/codex 仓库自己的提示词文档（hierarchical_agents_message.md）："Each AGENTS.md governs the entire directory that contains it and every child directory beneath that point... When two AGENTS.md files disagree, the one located deeper in the directory structure overrides the higher-level file"（每个 AGENTS.md 管辖其所在目录及全部子目录；冲突时更深的覆盖更浅的）。

**Cursor**（S7，docs.cursor.com → cursor.com/docs/context/rules）：rules 分四种加载模式（Always Apply / 按文件 glob / 按描述由代理判断相关 / 手动 @提及），量化建议 "Keep rules under 500 lines. Split large rules into multiple, composable rules"（单条 rule ≤500 行，大规则拆成可组合的小规则）。反模式清单与 Anthropic 同向："Copying entire style guides: Use a linter instead"、"Documenting every possible command: Agent knows common tools like npm, git, and pytest"、"Duplicating what's already in your codebase: Point to canonical examples instead of copying code"（别抄整个风格指南——用 linter；别罗列所有命令——代理认识常用工具；别复制代码库里已有的东西——指向权威示例）。Cursor 同时支持根目录与嵌套 AGENTS.md："Instructions from nested AGENTS.md files are combined with parent directories, with more specific instructions taking precedence."

**小结（入口文件）**：四个原发布方（OpenAI/Anthropic/Cursor/开放标准）口径一致——①放根目录、可嵌套、最近优先；②短（200 行是唯一的官方硬数字，32 KiB 是 Codex 的物理上限）；③只放"读代码读不出来"的东西（命令、坑、不可逆约定、安全线）；④能被工具强制的规则不要写在入口文件里（见 §2.4）。

### 1.2 docs/ 目录组织：按主题、按生命周期，还是平铺 + 索引？

没有权威来源硬性规定仓库 docs/ 的物理子目录结构。一手证据支持的是以下三条组织原则：

1. **索引页（landing page）只当"交通警察"**（S9《Software Engineering at Google》第 10 章 "Documentation"，注意：本书第 8 章"Style Guides and Rules"已被本仓库 project-structure-research.md 引为"规则是法律"的依据，本章是另一章）：原文 "ensure that a landing page clearly identifies its purpose, and then include *only* links to other pages for more information. If something on a landing page is doing more than being a traffic cop, it is *not doing its job*."（确保落地页说清自己的用途，然后**只**放通往其他页面的链接；落地页上任何超出"交通警察"职责的东西都是失职。）长度判据同章："your page should not scroll multiple screens"（不应滚动超过几屏），链接太多就按分类拆分。
2. **一个文档一个目的**（S9）："A document should have, in general, a singular purpose, and stick to it... avoid trying to do several things within one document."（一个文档只服务一个目的。）类型学（reference/code comments、design docs、tutorials、conceptual、landing pages）与 Diátaxis 四象限（S11）同构：**tutorials（学习）/ how-to（办事）/ reference（查证）/ explanation（理解）**，"each requires a different purpose... and each should be kept distinct from the others"（S11：四类各有目的，必须保持区隔）。Diátaxis 对 reference 的组织建议可直接映射到"模块术语表/接口参考"："the architecture of reference documentation should reflect the structure or architecture of the thing it's describing"（参考文档的结构应反映被描述物本身的结构——对仓库即"文档结构镜像代码结构"）。
3. **失效文档要显式退场**（S9）："when a document no longer serves any purpose, either remove it or identify it as obsolete (and, if available, indicate where to go for new information)"（要么删，要么标 obsolete 并指向新信息）。ADR 领域的同构惯例（S10 Nygard）："If a decision is reversed, we will keep the old one around, but mark it as superseded"（决策被推翻时保留旧记录但标记 superseded），且编号单调递增不复用——历史不删、状态可见。

**反面证据（平铺 + 无主的代价）**（S9 GooWiki 案例）：Google 早期全员 wiki "had a flat namespace, and people were not good at applying any hierarchy"，结果出现 7–10 篇重复的 Borg 配置文档"only a few of which seemed to be maintained"，最终 "the quality of documentation became Google's number one developer complaint on our annual developer surveys"（文档质量成了年度开发者调查第一大抱怨）。解法是把文档移进源码树、给 owner、走代码评审。即：**病灶不是"平铺"本身，是"无索引 + 无主 + 无退场机制"**。

**主题 vs 生命周期的裁断**：生命周期信息（草稿/已完工/已废弃）在一手来源里都是**文档内部的Status 字段或文件名标记**（S10 Status: proposed/accepted/deprecated/superseded；S9 obsolete 标记），而不是目录级分组依据；目录/索引分组按主题（S9 "breaking up the pages by taxonomy"、S11 结构镜像）。物理移动 80 个已存在的文件（本仓库 js/test 注释里约 50 处 `docs/<path>.md` 引用会全部断链）在证据上无收益——索引与状态标记能拿到全部收益而无破坏。

### 1.3 渐进披露在仓库文档中的应用

**原发布方的证成**：

- Anthropic 把渐进披露定义为代理上下文管理的核心机制（S2）："Letting agents navigate and retrieve data autonomously also enables progressive disclosure—in other words, allows agents to incrementally discover relevant context through exploration."（让代理自主导航与检索数据即实现渐进披露——通过探索增量地发现相关上下文。）其载体就是仓库本身："agents built with the 'just in time' approach maintain lightweight identifiers (file paths, stored queries, web links, etc.) and use these references to dynamically load data into context at runtime using tools"（维护轻量标识符——文件路径、链接——运行时按需动态加载）。
- **文件名与目录层级本身就是检索元数据**（S2）："the presence of a file named `test_utils.py` in a `tests` folder implies a different purpose than a file with the same name located in `src/core_logic/`. Folder hierarchies, naming conventions, and timestamps all provide important signals that help both humans and agents understand how and when to utilize information."——本仓库"文件名即模块索引 + 后缀语义"正是这条的正面案例。
- 入口文件与按需检索的混合模型（S2，描述 Claude Code 自己）："CLAUDE.md files are naively dropped into context up front, while primitives like glob and grep allow it to navigate its environment and retrieve files just-in-time"（入口文件预先全量进上下文，其余靠 glob/grep 按需取）——所以入口必须小（§1.1 的 200 行），其余交给可检索性。
- Agent Skills 开放标准（S8，Anthropic 发起）把三阶段写成规范："1. **Discovery**: At startup, agents load only the name and description of each available skill... 2. **Activation**: When a task matches a skill's description, the agent reads the full `SKILL.md` instructions into context. 3. **Execution**: The agent follows the instructions, optionally... loading referenced files as needed. Full instructions load only when a task calls for them."（启动只读名字+描述；任务匹配才读全文；引用文件再按需读。）Claude Code 文档（S5）的同构表述："Unlike CLAUDE.md content, a skill's body loads only when it's used, so long reference material costs almost nothing until you need it."
- Claude Code auto memory 的 MEMORY.md 是同一模式的文件化实现（S4）：索引"first 200 lines or 25KB"常驻，明细写独立话题文件按需读。
- llms.txt（S14）是同一模式在 HTTP 网站的标准化："The file itself stays small enough to fit in context. The detail lives behind the links, and is fetched only when needed."（索引文件小到可整体进上下文，详情在链接之后、需要时才取。）

**落到仓库文档的三层结构**：L1 常驻入口（AGENTS.md，≤200 行）→ L2 索引层（docs 索引/GLOSSARY 词头：只给名字+一句话，正文在链接后）→ L3 正文按需读（靠文件名语义与索引可达性）。**反模式**是用 `@import`/正文内联把 L3 提进 L1（S4：import 不减上下文成本；S3：入口每行都在每个任务上收"注意力税"）。

### 1.4 llmstxt.org 适用性判定

llm.txt v2（S14）自我定位："A proposal to standardise on using an `/llms.txt` file to provide information to help agents use a **website**."（标准化用 /llms.txt 向代理提供**网站**信息的提案。）它对标 robots.txt/sitemap.xml，服务对象是 HTTP 站点。本仓库文档的消费者是文件系统里的编码代理（AGENTS.md 生态），**规范本身不适用**；但其"小索引 + 链接后置详情"的结构原则与 §1.3 的 L2 索引层完全同构，可作为索引文件的设计参照。若未来 docs/ 挂上 GitHub Pages 供外部代理抓取，再考虑生成 llms.txt。

## 2. 文档-代码一致性

### 2.1 docs-as-code（主线方案）

《Software Engineering at Google》第 10 章（S9）的完整清单，原文："your documentation should: Have internal policies or rules to be followed / Be placed under source control / Have clear ownership responsible for maintaining the docs / Undergo reviews for changes (**and change *with* the code it documents**) / Have issues tracked, as bugs are tracked in code / **Be periodically evaluated (tested, in some respect)**"（文档应：有规则、进版本控制、有明确 owner、变更走评审且**随其描述的代码一起变更**、像 bug 一样被跟踪、**周期性地被"检验"**）。关键论断："Like code, documents should also have owners. **Documents without owners become stale and difficult to maintain.**"（无主文档必然 stale。）以及去重："it is important to designate *canonical* documentation: determine the primary source and consolidate other associated documents into that primary source (or deprecate the duplicates)"（指定唯一权威源，合并或废弃重复品）。

文档位置的结论也在这章：放源码旁边（g3doc 模式），"documents existed side by side with the source code within the engineer's development environment. Now, engineers could update the code and its associated documentation in the same change"（在同一变更里同时改代码与文档）。ADR 惯例（S10）同构："We will keep ADRs in the project repository under doc/arch/adr-NNN.md"（ADR 放仓库里，与代码同版本控制）。

### 2.2 用测试断言文档契约（本仓库现行做法的定位）

SWE 书只说文档应"periodically evaluated (tested, in some respect)"，未给出单测断言的具体形态；一手来源里对"规则如何才不失效"的最强表述在本书第 8 章（本仓库已引用）：自动化工具执行使规则"not dropped or forgotten as time passes"。Claude Code 文档（S3）提供了更精确的现代框架——**指令的二分法**：

- "Non-deterministic: you write the instruction, and Claude (the model) reads it... there's no *guarantee* that it'll follow your instructions."（写出来的指令模型只是"通常会遵守"，无保证。）
- "Deterministic: you configure the instruction, and Claude Code (the harness) *has to* execute it."（配置化指令由 harness 强制执行，每次都生效。）
- 判据原文："`CLAUDE.md` is for guidelines, and Claude is allowed to decide a guideline doesn't apply." 以及 "If you keep adding emphasis to a `CLAUDE.md` line and Claude still misses it, that's a sign the line belongs in a hook."（在入口文件里反复加重点还不管用，就说明该下沉到 hook/测试。）

映射到本仓库：AGENTS.md 是 non-deterministic 层（指南），`test/conventions.test.js` 断言命名/横幅/测试镜像是 deterministic 层（强制）。文档一致性同理——**"注释里的 docs/<path>.md 指针指向存在的文件"这类可机械检验的契约，正确位置是测试，不是文档措辞**。

### 2.3 ADR 与代码注释的分工

- ADR 记录单条不可逆决策及其理由（S10 adr.github.io）："An *Architectural Decision Record (ADR)* captures a single AD and its rationale"，集合构成 decision log。体量约束："The whole document should be one or two pages long. We will write each ADR as if it is a conversation with a future developer."（一两页以内，像与未来开发者的对话。）动机段原文值得引用："Large documents are never kept up to date. Small, modular documents have at least a chance at being updated."（大文档永远没人维护；小而模块化的文档至少有机会被更新。）
- 设计决策不进 API/代码注释：S9 原文 "Much like you should ideally separate the interface from an implementation within a well-designed API, you should avoid discussing design decisions in an API document. Users don't need to know this. Instead, put those decisions in a specialized document for that purpose (usually a design doc)."（像分离接口与实现一样，不要在 API 文档里讨论设计决策——放进专门的设计文档。）同章 audience 分析给出同一结论的注释版：API 注释 "don't need to discuss implementation details or design decisions"。
- 跨模块的概念解释放独立文档而非头注释（S9 conceptual documentation）："it often cannot be embedded directly within the source code because there isn't a canonical location to place it... The only logical place to document such complex behavior is through a separate conceptual document." 金句："If comments are the unit tests of documentation, conceptual documents are the integration tests."（注释是文档的单测，概念文档是集成测试。）

### 2.4 防漂移的手段光谱（按强制力排序）

1. **测试断言**（deterministic，S3 框架 + 本仓库 conventions.test.js 先例）：断言结构性契约——指针指向存在文件、横幅五要素存在、命名规则。
2. **同变更同评审**（流程，S9）：改行为必须同 CL 改权威文档；文档 diff 与代码 diff 在同一次评审里互相校对。
3. **单一权威源 + 别名登记**（结构，S9 canonical；本仓库 GLOSSARY 的 _Avoid_ 行即此模式）：重复信息出现时合并或废弃，不允许两处权威。
4. **显式退场**（生命周期，S9/S10）：obsolete/superseded 标记 + 指向后继；比删除安全（保留决策史），比沉默诚实（S9："someone adding a note that 'This no longer works!' is more helpful than... something that seems authoritative but no longer works"）。
5. **新鲜度标注**（S9 freshness dates，Google 用元数据在文档数月未动时自动提醒 owner 复审；进版本控制的文档日期由 git 隐式承载）。对 AI 代理仓库，git 日期即可，无需额外机制。

## 3. 代码注释的规模与分工

### 3.1 注释应承载什么：接口抽象 + why

一手来源的最清晰表述来自 Ousterhout 本人的公开对谈（S13，与 Robert Martin 2024-09~2025-02 的署名讨论，全文已抓取）：

- **注释的第一功能是抽象**："The first reason for comments is abstraction. Simply put, **without comments there is no way to have abstraction or modularity**."（没有注释就没有抽象与模块化。）
- **接口注释的完备性判据**："It should be possible to use a method without reading its code. The way we achieve this is by writing a header comment that describes the method's *interface* (**all the information someone needs in order to invoke the method**)."（头注释 = 调用所需全部信息。）他给出的示例注释包含前置条件、副作用、参数约束——正是"接口契约"而非"实现解说"。
- **"why" 的出处**："Comments often contain qualitative information such as ***why* something is being done**, or the overall idea of something. English works better for these than code because it is a more expressive language."（注释常承载定性信息——为什么做、整体思路——自然语言比代码更擅长。）**注**：坊间"code tells you how, comments tell you why"的格言查无单一可信原始出处；一手层面最接近的即此句与 SWE 书第 10 章的 WHY/HOW 论述（"there's a tendency for software engineers to jump straight into the 'HOW'... a design document is an exception because an equivalent aspect is often the WHY"，S9）。
- **缺失注释的代价量化**："For me the cost of missing comments is easily **10-100x the cost of incorrect comments**."（缺注释的代价是错注释的 10–100 倍。）"I waste *enormous* amounts of time because of inadequate documentation."
- **实现注释的节制**（两位作者一致的罕见共识）："We agree that **implementation code only needs comments when the code is nonobvious**."（实现代码只在不自明处需要注释。）
- **长名不能替代注释**："the traditional approach of using shorter names with descriptive comments is more convenient and conveys the required information more effectively"（短名 + 描述性注释优于超长名）。

SWE 书第 10 章（S9）的分工：注释是最常写的文档形态——"most of the documentation an engineer at Google writes comes in the form of code comments"；文件注释 "should begin with an outline of what's contained in the code"（以内容提纲开头）；两类读者两个收益——seekers 靠**一致性**快速扫描（"have your comments follow a similar format so that readers can quickly scan a reference"），stumblers 靠**文件头的用途说明**定向（"Provide overviews or introductions (at the top of a file, for example) that explain the purpose of the code"）。

### 3.2 多长合适：判据而非字数

- **文件头的"说得清"判据**（S9）："Any API that cannot be succinctly described in the first paragraph or two is usually the sign of an API that is not well thought out. Consider breaking the API into separate components in those cases."（一两段话说不清 = API 本身有问题，该拆 API 而不是写长注释。）这是"头注释长度"的权威检验：**说不短，是设计问题**。
- **文档总体**（S9）："it helps to keep your documents *short*. Writing a short document often requires you to write a longer one... and then doing an edit pass"（写短往往要先写长再删——短是编辑出来的）。Nygard 对 ADR 的"一两页"（S10）同向。
- **注释形态**（S12 Google JS Style Guide）：§7.5 "The top level comment is designed to orient readers unfamiliar with the code to what is in this file. If present, it may provide a description of the file's contents and any dependencies or compatibility information."（文件头注释用于让不熟悉代码的读者定向：内容描述 + 依赖/兼容信息——与五要素契约的"职责 + interface + 依赖"高度同构。）§4.8.1 有一个本仓库需知悉的条款："**Comments are not enclosed in boxes drawn with asterisks or other characters.**"（注释不得用星号或其他字符画框包围。）本仓库 `====` 横幅属对该条的本地偏离（Google 基线的既知差异，应在 conventions.md §6 偏离表登记，见 §4）。
- **对 AI 的额外约束**：注释是代理每次读文件都要付的 token 成本。Anthropic 的注意力预算论（S2："Context, therefore, must be treated as a finite resource with diminishing marginal returns"，上下文是有限资源、边际收益递减——context rot）意味着注释和文档一样服从"最小高信号 token 集"原则："finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome"。

### 3.3 大段注释的拆分与下沉

综合 §2.3 与 §3.1，业界分工是四层去向：

| 注释里的内容 | 应去的地方 | 依据 |
| --- | --- | --- |
| 接口契约（入口、前置条件、副作用、约束） | 头注释/接口注释，保留 | S13 |
| 模块在文件内的定位（是什么、给谁用） | 文件头一句话职责，保留 | S9、S12 §7.5 |
| 设计决策、权衡、备选方案 | -design 文档或 ADR | S9（"avoid discussing design decisions in an API document"）、S10 |
| 术语、历史别名 | 术语表（GLOSSARY）的 _Avoid_ | S9 canonical sources |
| 教程式使用示范 | how-to/tutorial 文档 | S9 types、S11 |
| 实现细节解说（代码不自明时） | 就地短注释；更常见的是先改代码至自明 | S13（"only needs comments when the code is nonobvious"） |

判断式：**头注释回答"调用我需要知道什么"，设计文档回答"为什么长成这样"，ADR 回答"为什么不选别的路"，术语表回答"这词什么意思、以前叫什么"**。一段注释如果同时在回答后三问，它就该拆出去。

## 4. 对本仓库的可执行建议

以下为基于证据的提案【建议】，非仓库既有规则。每条标注依据来源编号。

### 4.1 入口 AGENTS.md：修剪到"命令 + 高压线 + 指路"

1. **行数目标 ≤200 行**（依据：S4 唯一官方硬数字；Codex 32 KiB 链上限 S6 是物理边界，200 行是效果边界——超限"reduce adherence"）。【简报给定】本仓库 AGENTS.md 现为指路式结构，方向正确；对照判据逐段检查。
2. **用两问判据删内容**（依据：S3 "Could it find this by reading the code? Would it actually go and look? If both are yes, leave it out."）：现有"硬规则浓缩"段与 conventions.md 存在复述（如一文件一模块、`let` 规则、后缀语义）。建议保留一句话 + 指向 conventions.md 的链接，不重复正文——官方明确把"目录布局/依赖清单/架构总览"列为应删内容（S3 stop-doing 表、S4 /doctor 修剪项），把"坑、理由、与默认不同的约定"列为应留内容。
3. **测试命令保留并保持精确**（依据：S1 FAQ "Yes—if you list them"；S3 "the single most useful line in your CLAUDE.md is the command that runs it"）。`npm test` / `npm run lint` / `node server.js` 三行是入口文件里价值密度最高的行。
4. **不可违反的规则指向测试而不是加语气词**（依据：S3 deterministic/non-deterministic 二分；本仓库三重命名/横幅守门已在 test/conventions.test.js——这正是 deterministic 层的正确用法）。AGENTS.md 里"收尾前必跑"保留一行即可，强制力由测试承担。

### 4.2 docs/：索引 + 状态标记，不物理重排

5. **新增 `docs/README.md` 索引，一屏内、只放链接**（依据：S9 landing pages "include *only* links... If something on a landing page is doing more than being a traffic cop, it is *not doing its job*"；结构参照 S14 小索引模式与 S4 MEMORY.md 索引模式）。建议两张清单：**活权威**（conventions / 各 -design 权威 / ADR 列表）与**历史工件**（已完工 -plan/-tickets/-spec），每行"文件名 + 一句话 + 状态"。
6. **已完工文档不删、标状态、指向后继**（依据：S9 "either remove it or identify it as obsolete (and, if available, indicate where to go for new information)"；S10 superseded 模式 "we will keep the old one around, but mark it as superseded"）。操作：完工的 plan/tickets 在文件头加一行"状态：已完工 YYYY-MM，权威后继：<链接>"，或集中移入 `docs/archive/`；ADR 保持 Nygard 式单调编号。
7. **不按主题物理移动其余文档**（依据：§1.2 裁断——无一手证据支持目录重排收益，而【简报给定】js/test 注释里约 50 处 `docs/<path>.md` 引用会断链；索引 + 状态标记拿到全部证据支持的收益）。生命周期用文件名后缀（既有惯例）+ 索引状态列承载，与 S10（目录放 adr-NNN，状态放文档内 Status 字段）同构。
8. **design.html 标注"快照 + 日期"**（依据：S9 canonical 文档原则——两处权威必然漂移，弱者应自我声明非权威）。

### 4.3 一致性：把"指针"从人肉维护升级为测试断言

9. **新增一条守门测试：注释/文档里的 `docs/<path>.md` 引用必须指向存在的文件**（依据：S9 "Be periodically evaluated (tested, in some respect)"；S3 deterministic 层定位；本仓库 conventions.test.js 已有同类先例）。死链即时失败，替代人肉巡检。
10. **conventions.md 明文规定"改行为同 CL 改权威文档"**（依据：S9 "change *with* the code it documents"——Google 用同一变更单同时改代码与文档是 docs-as-code 的核心条款）。
11. **GLOSSARY 保持词汇唯一权威地位，词条瘦身**（依据：S9 canonical sources；S9 "keep your documents *short*"）。建议词条结构固化为：**定义（1–2 句）+ interface 清单 + _Avoid_ 别名行**；数百字的论证/历史段下沉到对应模块的 -design 文档或 ADR；GLOSSARY 顶部加"全部词条一览"索引行（依据：S4 索引常驻/正文按需的两层模式；S9 seekers 靠一致性快速扫描）。

### 4.4 头注释五要素：全保留、限行数、内容下沉

12. **五要素全部保留，固定顺序不动**（依据：S9 file comments（几乎所有文件必须有文件注释、以提纲开头）+ S9 seekers 的"格式一致才可快速扫描" + S13 接口注释=调用所需全部信息）。五要素与 S12 §7.5"内容 + 依赖"的官方文件头定义同构，且本仓库经典 `<script>` 共享词法环境里**加载序只存在于 index.html，头注释是唯一就近声明处**——第 4 要素（依赖+加载序）正是"代理读单个文件读不出来的信息"（S3 判据），必须留。
13. **横幅限额 ≤15 行，"一句话职责"执法为真·一句话**（依据：S9 "cannot be succinctly described in the first paragraph or two... sign of an API that is not well thought out"——说不短先怀疑模块切分；S2 最小高信号 token 集）。超过 15 行的横幅按 §3.3 的四层去向表下沉，不是删信息而是挪位置。
14. **下沉映射**（依据：§3.3 表）：横幅里的设计动机/权衡 → `docs/<topic>-design.md` 或 ADR（S9、S10）；术语史/别名 → GLOSSARY _Avoid_（S9）；用法示范 → 模式文档；段注释只在代码不自明处保留短句（S13 "implementation code only needs comments when the code is nonobvious"）。
15. **`====` 框线登记为对 Google 基线的本地偏离**（依据：S12 §4.8.1 原文 "Comments are not enclosed in boxes drawn with asterisks or other characters."）。保留与否是本地裁量（框线对 AI 与人无损，且已有测试断言其存在），但应在 conventions.md §6 偏离表显式登记，与"规则是法律 + 例外要记录"的既有立场（本书 ch.8，本仓库已引用）一致。

### 4.5 明确不做的事

16. **不引入 CLAUDE.md 双入口，不用 `@import` 做"分层"**（依据：S4——有 CLAUDE.md 时 Claude Code 默认不再读 AGENTS.md；import 文件随入口全量加载"doesn't reduce its context cost"。单入口 + 索引才是真分层）。
17. **不在 AGENTS.md 里复述风格指南正文**（依据：S7 反模式清单 "Copying entire style guides: Use a linter instead"；本仓库 ESLint + conventions.test.js 已是强制层，AGENTS.md 只需指向）。
18. **不建 llms.txt**（依据：§1.4 适用性判定——规范面向 HTTP 网站，本仓库无此消费方）。

## 5. 来源清单

| # | 来源 | 性质 | 抓取状态 |
| --- | --- | --- | --- |
| S1 | AGENTS.md 官网 https://agents.md （规范文本；Linux 基金会 Agentic AI Foundation 托管） | 一手规范 | 已抓取全文（2026-10-28） |
| S2 | Anthropic Engineering《Effective context engineering for AI agents》 https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents （2025-09-29） | 一手工程博客 | 已抓取全文。注：任务给的标题 "Writing effective context for AI agents" 未检索到对应文章，此文即 Anthropic 关于上下文工程的工程博客正主 |
| S3 | Claude Code Best Practices https://www.anthropic.com/engineering/claude-code-best-practices （原工程博客 URL，现服务现行版官方文档内容） | 一手官方文档 | 已抓取全文（现行版；原 2025 博客版已被此版取代） |
| S4 | Claude Code Memory 文档 https://code.claude.com/docs/en/memory （含分层表、200 行目标、@import、rules、AGENTS.md 互操作、MEMORY.md 索引） | 一手官方文档 | 已抓取全文 |
| S5 | Claude Code Skills 文档 https://code.claude.com/docs/en/skills | 一手官方文档 | 已抓取（前 424/1251 行，引文均在已抓部分） |
| S6 | OpenAI Codex AGENTS.md 指引：learn.chatgpt.com/docs/agent-configuration/agents-md（官方页）与 openai/codex 仓库的 agents_md.md、codex-rs/core/hierarchical_agents_message.md | 一手官方 | 直抓 developers.openai.com 403、learn.chatgpt.com 传输失败；已直抓该仓库 agents_md.md（raw），其余两页全文经搜索快照核对，标注为【快照获取】 |
| S7 | Cursor Rules 文档 https://cursor.com/docs/context/rules （docs.cursor.com 重定向至此） | 一手官方文档 | 已抓取全文 |
| S8 | Agent Skills 开放标准 https://agentskills.io （Anthropic 发起） | 一手规范 | 已抓取首页（三阶段渐进披露定义所在） |
| S9 | 《Software Engineering at Google》第 10 章 "Documentation" https://abseil.io/resources/swe-book/html/ch10.html （免费官方全文，CC BY-NC-ND 4.0；章节号经目录页 https://abseil.io/resources/swe-book/html/toc.html 核实：ch.8 Style Guides and Rules（本仓库另一报告已引）、ch.10 Documentation） | 一手出版物 | 已抓取全文（419 行中前 390 行，引文均在） |
| S10 | Michael Nygard《Documenting Architecture Decisions》 https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions （2011-11-15）+ ADR GitHub 组织主页 https://adr.github.io/ | 一手博客 / 一手组织页 | 均已抓取全文 |
| S11 | Diátaxis 官方站 https://diataxis.fr/ （Daniele Procida；含 /application/ 页） | 一手框架官网 | 已抓取首页与 /application/ 全文。注：任务给的 diataxis.org 四次直抓均传输失败，官方站现为 diataxis.fr（同一作者体系）；reference/explanation 细节引文经搜索快照核对 diataxis.fr 内容，标注为【快照获取】 |
| S12 | Google JavaScript Style Guide https://google.github.io/styleguide/jsguide.html （§4.8 Comments、§7 JSDoc；指南已冻结，横幅建议迁 TS） | 一手风格指南 | 已抓取（3887 行全文，§4.8/§7.5/§7.6/§7.8 原文已核） |
| S13 | John Ousterhout《A Philosophy of Software Design》：作者官方书页 https://web.stanford.edu/~ouster/cgi-bin/aposd.php + 作者署名公开对谈 https://github.com/johnousterhout/aposd-vs-clean-code/blob/main/README.md （2024-09~2025-02） | 作者一手公开材料 | 书页已抓取；对谈 README 已抓取全文（2288 行）。书籍本身无免费全文（O'Reilly 页 403、官方节选 PDF 不支持抓取），注释章节（书第 12/13 章）无法页码级引用，引文均取自对谈中 Ousterhout 署名原文 |
| S14 | llms.txt 规范 v2 https://llmstxt.org （Jeremy Howard，2024 发布 / 2026-08 修订） | 一手提案 | 已抓取全文 |

补充说明：S6/S11 标注【快照获取】的引文均逐字来自搜索结果内嵌的官方页正文，非第三方转述；凡只有二手证据处（如"格言无原始出处"）已在正文明确标注。
