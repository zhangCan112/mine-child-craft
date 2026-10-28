# 机器人编程走格子玩法调研 —— 同类游戏 × 指令集 × 难度曲线 × 认知证据 × 6 岁 UX

> **调研说明**
> - 调研日期：2026-10-28。研究问题：**为"玩家提前给被控怪物编排指令序列、回放看它从起点走到终点"的新玩法（候选名：机器人编程模式）提供设计依据——同类游戏怎么做指令集与难度曲线，认知科学支持练什么，6 岁不识字孩子怎么操作。**
> - 方法：一手来源优先。游戏机制用官方规则书 / 官方产品页 / 官方课程 PDF / 官方 API 文档核对；开发者一手访谈与开发者本人撰文单独标注；学术论文给出期刊与链接（尽量可点开核对）；实在只有二手来源（媒体测评、第三方攻略）才引用并明确标注"二手"。查不到实证的说法直接写"未找到一手来源"，不编造。
> - 证据强度标记：**一手** = 官方文档原文 / 原始论文 / 开发者本人撰文；**二手** = 转引或第三方测评。**证据强/中/弱** = 结论本身的实验支持力度，与来源级别独立标注。
> - 宣称口径遵循 MISSION.md：本文只讨论"路径规划任务的结构化练习"，**不做**"提升智商 / 治疗 / 变聪明"类宣称（见 §6.5）。
> - 配套：本文是 research 段；后续方向取舍与实现另立 plan/design 文档（docs/conventions.md §1.11 三段式）。

---

## 0. 结论速览

1. **"给角色编程走到终点"是被 4 岁起验证过的成熟品类**：Robot Turtles（桌游，age 4+，官方规则书全文可得）、Lightbot Jr（App，age 4-8）、Cubetto（实物玩具，age 3-6）三家都把门槛压到了学龄前；本项目 6 岁用户正落在三家验证区间的正中间。
2. **指令集收敛到 3~5 个原语**：Robot Turtles 首局只有 前进/左转/右转 三张卡；Lightbot Jr 是 移动/跳/点亮/转向；Cubetto 是 前进/左转/右转（+函数块后解锁）。**没有任何一家在 8 岁以下引入文字；全部用图形/图标表达指令。**
3. **进阶概念引入顺序高度一致**：序列 → 调试 → 循环/函数 → 条件。Robot Turtles 的解锁顺序是 冰墙→激光→石墙→箱子→"整段编程"（Write Program）→ 函数蛙；Apple Learn to Code 1 的章节顺序是 命令→调试→函数与循环→条件→while→算法。**调试都被排在第二位**（code.org 官方论坛明确回答"课程 A-F 开头就教调试，因为不会修错就没法学编程"）。
4. **"整段提前规划"是最后的、也是最吃执行功能的台阶**：Robot Turtles 官方规则明确要求——先让孩子习惯"一回合打 3 张卡"，再放开整段规划，"否则会造成挫败"（规则书原话 "it's important not to introduce this before kids are ready or else it will cause frustration"）。这是对 6 岁用户做"先规划后执行"的直接先例。
5. **实证支持"编程游戏能练排序/序列能力"**：Kazakoff、Sullivan & Bers（2013）一周机器人编程工作坊后，幼儿故事排序任务前后测显著提升；3-8 岁编程教学元分析总效应 d=0.83（17 项研究）；但图形化编程（g=0.49）强于实物编程，且**指令数越少、幼儿表现越好**（KIBO 学前课堂研究，N=64）。
6. **规划任务与执行功能的关系有发展心理学经典支撑**：Tower of London/Hanoi 类任务的定义就是"生成并组织步骤序列以达成目标"（Diamond 2013 的 EF 三核——抑制、工作记忆、认知灵活性——恰好与本项目"抑制控制/视空记忆/规则切换"三维同构；Diamond 明确把 interference control 归入 inhibition 之下，正好对应本项目的"干扰控制"）。
7. **6 岁的规划能力是"刚起步"**：4 岁 9 个月幼儿的塔任务表现主要由任务转换能力预测（Bull et al. 2004）；6→13 岁 TOL 表现随龄线性爬升（270 人研究）。设计含义：正向顺排、步数少、逆直觉步骤（要绕路反而不能直走）是 6 岁最难啃的，要最晚出现。
8. **对 MCE（Minecraft Education）的一手核对**：官方 Agent 课程（Unit 1 "The Agency"）的路径指令就三个——`agent move`（方向+格数）、`agent turn`（左/右下拉）、`agent destroy`；触发靠聊天命令。**Minecraft 自己的"编程怪走格子"= 移动/转向/破坏 三原语起步**，与本项目"笨笨的铁傀儡/小小的苦力怕"的构想同构。
9. **五维嵌入是可行的，且有现成机制先例**：抑制控制=整段放完才能按"跑"（Run Program!）；视空记忆=先看怪物演示走一遍再编程；规则切换=不同怪物不同指令语义（DCCS 研究表明 3 岁不能切、5 岁能切，6 岁需线索凸显）；干扰控制=场上干扰物与无关方块。
10. **诚实边界**：CAL-ScratchJr 的两篇 RCT 经 WWC 评审结论是"无统计显著正效应"（meets standards with reservations）；规划训练的文献以近迁移为主。新玩法的宣称应是"练习规划与排序"，不是"提升智力"。

---

## 1. 同类游戏盘点（先表后文，每款一节）

> 收录标准：有官方一手来源（官网/官方规则书/官方文档）核实机制，且核心玩法 = **提前编排指令序列 → 回放执行 → 到达目标**。经排查不达标的见 §1.9。

### 1.0 总览表

| 游戏 | 形态 | 官方年龄 | 核心循环 | 进阶概念 | 与本项目相似度 |
| --- | --- | --- | --- | --- | --- |
| Robot Turtles | 桌游 | 4+ | 打卡→成人执行回放 | 障碍解锁、整段规划、函数 | ★★★★★ |
| Lightbot Jr | App | 4-8 | 拖指令→运行点亮方块 | 过程复用、调试 | ★★★★☆ |
| Cubetto | 实物玩具 | 3-6 | 块入槽→机器人走 | 队列上限 18 步 | ★★★★☆ |
| ScratchJr | App | 5-7 | 拼块驱动角色 | 循环、事件（自由创作型） | ★★★☆☆ |
| code.org Course A/B / Pre-reader Express | 网页课 | K-1 / K-3 | 拼块闯关 | 循环、事件、调试前置 | ★★★★☆ |
| Minecraft Education Agent | 3D 游戏 | 学龄（官方课程 3-8 年级为主） | 聊天命令驱动 Agent | 循环、条件、函数 | ★★★★★（世界观同源） |
| Swift Playgrounds Learn to Code | App | 10+（官方 Quick Start 口径） | 写 Swift 命令 Byte 走格子 | 函数、条件、while、算法 | ★★★☆☆（上界参照） |
| Robozzle | 网页/App | 无官方年龄（硬核） | 极简指令+递归 | 颜色条件、递归、栈 | ★★☆☆☆（指令集参照） |
| Cargo-Bot | iPad App | 无官方年龄（8+ 感） | 编程吊车搬箱子 | 条件色、递归、指令数星级 | ★★☆☆☆（预算星级参照） |

---

### 1.1 Robot Turtles（ThinkFun 桌游）——与本项目最同构的 4+ 先例

| 维度 | 内容 | 来源级别 |
| --- | --- | --- |
| 年龄 | 4 岁起（"Pre-Kindergarten to 2nd grade is the sweet spot!"） | 一手（官方新闻稿） |
| 玩家角色 | 孩子当"乌龟大师"（程序员），成人当"乌龟搬动工"（计算机） | 一手（官方规则书） |
| 基础指令 | 仅 3 张卡：前进 / 左转 / 右转 | 一手（官方规则书） |
| 回放执行 | 成人按卡移动乌龟，**必须配搞笑音效**（"Turtle Movers absolutely MUST make funny noises"） | 一手（官方规则书） |
| 撤销 | Bug 卡：喊 "Bug!" 拍卡即撤销，当回合可无限次 | 一手（官方规则书） |
| 障碍解锁序 | 冰墙 → 激光（融冰墙）→ 石墙（不可拆）→ 箱子（可推不可拉） | 一手（官方规则书） |
| 高阶玩法 | Write Program（整段规划一回合走完）→ Function Frog（动作序列抽象成一张卡） | 一手（官方规则书） |
| 胜利条件 | 无输家："Everyone who gets their Jewel wins!" | 一手（官方规则书） |

- 规则书原文要点：孩子每回合选一张 Code Card 放在面前排成一列，成人照卡移动乌龟——**卡列本身就是"程序清单"，一局下来孩子看到自己的完整程序**（"Turtle Masters should place their cards in a line or sequence so that at the end of the game they have one long 'program'"）。[来源：ThinkFun 官方规则书 PDF https://legacy.thinkfun.com/wp-content/uploads/2014/09/Robot-1900-Instructions.pdf — 一手]
- **Write Program 的防挫败阶梯（对本项目最重要的一条先例）**：规则书要求成人先让孩子习惯"一回合放 3 张卡"，熟练后才引入"整段规划一回合走完、喊 Run Program!"，且明确警告 "it's important not to introduce this before kids are ready or else it will cause frustration"；失败时成人要**倒着**把所有移动一步步还原（连融掉的冰墙都要复原），孩子下一回合调整程序再来。[来源：同上 PDF — 一手]
- 定位自述："sneakily teaches preschoolers the fundamentals of computer programming"，发明人 Dan Shapiro 为自己 4 岁双胞胎设计，是 Kickstarter 史上众筹额最高的桌游。[来源：ThinkFun 官方产品页 https://thinkfun.com/robot-turtles/ — 一手；官方新闻稿 https://www.prnewswire.com/news-releases/now-nationwide-robot-turtles-by-thinkfun-is-first-board-game-to-teach-coding-skills-to-kids-as-young-as-four-270760351.html — 一手（出版方发布）]
- 溯源：官方产品描述自述灵感来自 **Logo 海龟绘图语言**。[来源：ThinkFun 经销商页转述官方文案 https://www.thinkfunlearn.com/product/thinkfun-robot-turtles-game/ — 二手（转官方文案）]

### 1.2 Lightbot / Lightbot Jr——图标编程 App 的年龄分档标杆

| 维度 | Lightbot Jr | Lightbot |
| --- | --- | --- |
| 官方年龄 | 4-8 岁（"specifically designed for ages 4-8"） | 9 岁以上 |
| 关卡数 | 42 关 | 官方未给总数（分章） |
| 指令集 | 移动 / 跳 / 点亮 / 转向（拖拽进指令槽） | 同左 + 过程槽 P1/P2 |
| 进阶概念 | 排序指令、调试、可复用过程、循环执行 | 排序、重载、过程、递归循环、条件 |
| 目标 | 引导机器人点亮所有蓝方块 | 同左 |

- 官方年龄分档：官网把 iOS 入口明确分成 "Ages 4 to 8" 与 "Ages 9+" 两个按钮。[来源：Lightbot 官网 https://lightbot.com/ios.html — 一手]
- Jr 的官方描述："cultivates a real understanding of sequencing instructions, debugging problems, creating reusable procedures and executing loops"，42 关。[来源：Lightbot Jr App Store 官方页 https://apps.apple.com/ca/app/lightbot-jr-coding-puzzles-for-ages-4/id858640629 — 一手]
- 本体概念清单（官方）："What You'll Learn: Sequencing, Overloading, Procedures, Recursive Loops, Conditionals"；语言规范页把游戏抽象成 MAIN + proc1() + proc2() 的"真编程"。[来源：https://lightbot.com/index.html — 一手；https://lightbot.com/hoclearn.html — 一手]
- 循环用**递归**实现（过程调用自身），教师材料还专门提醒"关卡通满后循环自动终止"。[来源：官方教师文档《How Does Lightbot Teach Programming》 https://lightbot.com/Lightbot_HowDoesLightbotTeachProgramming.pdf — 一手；官方答案册 https://lightbot.com/LightbotSolns.pdf — 一手]
- **开发者一手设计思路**：作者 Danny Yaroslavski（滑铁卢大学 CS）访谈自述——最初只想做带编程味的解谜游戏，教育性是玩家反馈催生的；选哪些构造的标准是"几乎所有语言都必需的控制流"。[来源：Game Developer 访谈 https://www.gamedeveloper.com/business/interview-with-light-bot-creator-danny-yaroslavski — 一手（开发者访谈）]
- **"图标足够，文字吓人"的实证自述**：Yaroslavski 本人撰文 "Text is Keeping Kids from Coding"——"我们已经证明 5 岁以上的孩子能用图标写出复杂程序……对很多试玩者来说，学文字代码才是心理拦路虎（'Coding is hard because text is scary.'）"。[来源：https://medium.com/@dannyyaroslavski/text-is-keeping-kids-from-coding-b70988dd7541 — 一手（开发者本人撰文）]
- Jr 指令细节（移动/跳/点亮/转向四原语拖槽）来自 Common Sense Media 对游戏的描述。[来源：https://www.commonsensemedia.org/app-reviews/lightbot-jr-coding-puzzles-for-ages-4 — 二手]

### 1.3 Cubetto（Primo Toys 实物编程玩具）——3 岁可用的"槽位队列"UX 标杆

| 维度 | 内容 | 来源级别 |
| --- | --- | --- |
| 年龄 | 官方 FAQ："specifically designed to be most useful for children aged 3-6" | 一手 |
| 交互 | 把指令块插进接口板的**槽位队列**，按 Go 一次执行；每槽位下有反馈 LED | 一手（官方用户手册） |
| 语言 | "让儿童在不用识字、不用屏幕的情况下接触编程队列（queue）概念" | 一手（官方用户手册） |
| 容量 | Cubetto+ 官方口径：**24 个指令块、板上 18 步（18 slots）** | 一手（官方首页） |
| 无障碍设计 | 指令块形状各异 + 双色纹理音效，盲童不看也能玩 | 二手（Dezeen 转述官方设计说明） |

- 官方手册原话： Cubetto 是"tangible programming interface designed to introduce children aged 3 to 6 to computational thinking... allowing them to program a small wooden robot using colourful blocks. Children play with the 'queue' of instructions... **without using literacy or screens**."[来源：https://primotoys.com/cubetto-user-manual/ — 一手]
- 官方 FAQ：拆掉屏幕键盘这些"不熟悉的干扰物"后，3 岁孩子就能写出并执行自己的第一个程序。[来源：https://www.primotoys.com/faq — 一手]
- **18 步槽位是本调研唯一拿到官方数字的"单程序指令上限"**（Cubetto+ 版，2026 在售口径）。[来源：https://primotoys.com/ — 一手]
- 商业背书：Kickstarter 众筹 160 万美元、6,553 人支持（edtech 类纪录）。[来源：TechCrunch https://techcrunch.com/2016/10/31/primo-toys-rolls-out-cubetto-a-wooden-robot-that-teaches-kids-to-code — 二手]
- 一年级课堂研究：NSF 资助的论文以 Cubetto 设计幼儿园算法思维任务（单格移动 = 最小运动单元、连续移动 = 迭代）。[来源：《Teaching Coding in Kindergarten: Supporting Students' Activity with Robot Coding Toys》NSF 公共存档 https://par.nsf.gov/servlets/purl/10439114 — 一手（论文 PDF 存档）]

### 1.4 ScratchJr（TUFTS/BC DevTech × MIT）——5-7 岁自由创作对照组

| 维度 | 内容 | 来源级别 |
| --- | --- | --- |
| 年龄 | 5-7 岁（官方口径） | 一手 |
| 形态 | 拼图形块让角色移动/跳/唱/跳——**开放式创作**，不是关卡通关 | 一手 |
| 底层 | 基于 DevTech 20+ 年研究设计（"designed, based on evidence from over 20 years of research"） | 一手 |
| 块面 | 图形化块（无文字依赖），触发/运动/外观/声音/控制五类 | 一手（官方与论文） |

- 官方 About："ScratchJr is an introductory programming language that enables young children (ages 5-7) to create their own interactive stories and games. Children snap together graphical programming blocks to make characters move, jump, dance, and sing."[来源：https://www.scratchjr.org/about — 一手]
- 与本玩法的差异：ScratchJr 是**多角色自由创作**，没有"起点-终点"的关卡结构；它的价值在本调研里是（a）证明 5-7 岁能拼多块程序，（b）提供**哪类块对幼儿最难**的实证（见 §4.3：元层控制流块、多角色协调最难——提示我们单角色、单队列更稳）。[来源：De Ruiter & Bers (2021) The Coding Stages Assessment, Computer Science Education, DOI 10.1080/08993408.2021.1956216，官方存档 PDF https://sites.bc.edu/devtech/wp-content/uploads/sites/181/2021/07/CodingStages.pdf — 一手]
- 研究生态：官方研究页列有 >10 个国际研究伙伴、多项游戏化评估（Solve-Its、CSA）。[来源：https://www.scratchjr.org/research — 一手]

### 1.5 code.org CS Fundamentals：Course A / Course B / Pre-reader Express——课标级爬坡

| 维度 | Course A | Course B | Pre-reader Express |
| --- | --- | --- | --- |
| 年级 | K-1 | 1-2 | K-3（自学版） |
| 时长 | 约 1 个月 | 约 1 个月 | 约 1 个月 |
| 概念 | 问题解决、**循环与事件**入门 | 编程基础续、坚持性、Play Lab 做游戏 | 平行覆盖 A+B |
| 阅读要求 | 不依赖识字（音频朗读支持） | 同左 | "为前读者/初读者设计，假设形状与数字知识也有限" |

- 官方课程目录："Course A: In this course, students work with others, investigate problem-solving techniques, and learn to program using commands like loops and events."；"Course B: Students continue learning programming basics, as well as persistence and critical thinking. At the end of the course, students can create games in Play Lab!"；Pre-reader Express（K-3）自 pacing 版。[来源：code.org 官方课程页 https://code.org/en-US/curriculum/computer-science-fundamentals — 一手]
- 前读者版定位原文："Pre-Express was developed with early and pre-readers in mind. **Tailored to a novice reading level, this course also assumes limited knowledge of shapes and numbers.** Pre-Express closely parallels Courses A and B in a single course."[来源：官方教学指南 PDF https://curriculum.code.org/csf-19/pre-express.pdf — 一手]
- **"flurb 走到水果"与本玩法零概念差**：Course A 的 Happy Maps 不插电课，就是"用箭头卡把 flurb 从起点排到水果"，学习目标包含"解码并运行**别人写好**的程序""发现并修复顺序指令里的 bug"。[来源：官方课页 https://curriculum.code.org/csf-20/coursea/3 — 一手]
- 循环的引入套路（官方 Happy Loops 课）："This activity revisits Happy Maps. This time, students will be solving **bigger, longer puzzles**... leading them to see utility in structures that let them write longer code in an easier way."——即**先让长序列痛苦，再给循环**。[来源：https://curriculum.code.org/csf-20/coursea/7 — 一手]
- 无障碍支持：CSF 全系课程提供指令的 TTS 朗读（可设自动朗读）。[来源：官方支持文档 https://support.code.org/hc/en-us/articles/360058843692-How-to-automatically-play-Read-Aloud-instructions-for-students — 一手]
- 调试为什么前置（官方员工答）："We chose to teach debugging at the beginning in courses A-F because it's hard for students to begin programming if they don't know how to fix errors."[来源：code.org 官方论坛员工回帖 https://forum.code.org/t/choosing-coding-courses/37629 — 一手（官方人员）]

### 1.6 Minecraft Education 的 Agent——"编程怪物走格子"的 Minecraft 官方做法

| 维度 | 内容 | 来源级别 |
| --- | --- | --- |
| 载体 | Agent：游戏内可编程机器人同伴，MakeCode 积木或 Python 控制 | 一手 |
| 路径指令 | `agent move`（方向+格数）、`agent turn`（左/右）、`agent destroy` / `place` / `till` / `attack` / `collect` / `detect` | 一手（官方 API 文档） |
| 触发方式 | 聊天命令（on chat command） | 一手 |
| 官方课 | Unit 1 "The Agency"：L1 认识 Agent → L2 移动与破坏 → L3 建造（每课 45-60 分钟） | 一手（官方课程 PDF） |
| 进阶课 | 循环（Dance Dance Agent / Help Your Agent Farm）→ 条件（Agent Tree Chopper / All Mine!）→ AI | 一手（官方课程总览 PDF） |

- 官方 Unit 1 教学目标原文："Describe the concept of coding... **Code the Agent using on chat commands to move in different directions**"；转向通过 MakeCode 下拉框在 left/right 间切换；L2 是 "Code Your Agent to Move & Destroy"。[来源：官方课程支持文件《Computing with Minecraft Unit 1: The Agency》 https://education.minecraft.net/lessonsupportfiles/6325506197555818-Computing%20with%20Minecraft_Unit%201_The%20Agency.pdf — 一手]
- Agent 指令集（官方 API）：`move(direction, blocks)`、`turn(direction)`、`detect`（探测身前是否有方块）等；官方教程 "Agent Moves" 就是三个聊天命令 fd/lt/rt 分别做 前进 N 格 / 左转 / 右转——**这就是 Minecraft 版"前进/左转/右转"**。[来源：MakeCode 官方文档 https://minecraft.makecode.com/reference/agent 与教程 https://minecraft.makecode.com/tutorials/agent-moves — 一手]
- 官方课程总览把迭代教学挂在 Agent 上："Introduction to the Agent and the Dance Dance Agent coding activities"（循环）、"Agent Tree Chopper and All Mine!"（条件）、AI 单元（智能 Agent）。[来源：《Coding with Minecraft Curriculum Overview》官方 PDF https://education.minecraft.net/lessonsupportfiles/7010954984185451-Coding%20with%20Minecraft_Curriculum%20Overview.pdf — 一手]
- 新动向（2025-26 学年口径）：与 Microsoft、Code.org 合作的 Hour of AI: The First Night——"Program an AI Agent to craft tools and build shelter before dusk"，玩法循环含"教 Agent、调试它的错误"。[来源：Minecraft Education 官方页 https://education.minecraft.net/en-us/resources/hour-of-ai-the-first-night — 一手]
- 对本项目的关键判读：Minecraft 官方的 Agent 课**不是 6 岁 UX**——MakeCode 积木带英文标签、靠键盘打聊天命令触发，官方课程按 45-60 分钟课时面向小学中高年级以上。它给我们的不是 UX 参照，而是**世界观参照**：Minecraft 自己把"编程一个被控怪物走格子"当作计算思维入门的正统玩法，本项目做成"铁傀儡/苦力怕"不违背 IP 感，且可全面图标化降龄。

### 1.7 Apple Swift Playgrounds "Learn to Code"——上界参照与章节架构

| 维度 | 内容 | 来源级别 |
| --- | --- | --- |
| 角色 | Byte（3D 方块世界里的角色） | 一手 |
| 官方年龄 | Quick Start to Code 活动标 **10 岁+**；课程指南建议高小学段与初中 | 一手 |
| LTC1 章节 | L1 命令与序列 → L2 **调试** → L3 函数与 for 循环 → L4 条件 → L5 while → L6 算法 | 一手 |
| 语言 | 真 Swift 代码 | 一手 |

- 官方课程指南的 LTC1 章节结构（逐条列出）："Lesson 1 — Think Like a Computer: Commands and Sequences... Lesson 2 — **Think Like a Detective: Debugging**... Lesson 3 — Think Efficiently: Functions and a Bit of Loops... Lesson 4 — Thinking Logically: Conditional Code... Lesson 5 — Think Again and Again: While Loops... Lesson 6 — Think the Same Idea: Algorithms."；并且指明"for use with older primary school and junior high school students"。[来源：Swift Playgrounds Curriculum Guide 官方 PDF https://www.apple.com/au/education/docs/Swift_Playgrounds_Curriculum_Guide.pdf — 一手]
- 概念清单（官方开发者页）：Commands / Loops / Operators / Functions / Conditional statements / Parameters / Types / Variables / Initialization。[来源：https://developer.apple.com/swift-playground/ — 一手]
- 年龄口径：官方 Quick Start to Code 指南封面 "designed for beginners ages 10 and up"。[来源：https://education-static.apple.com/teaching-code/quick-start-to-code.pdf — 一手]
- 判读：Apple 的"图标块拼 Byte 走格子"在交互形态上与本项目几乎一致（点块→角色执行），但**官方把整条产品线定在 10+**，连 Apple 都没有做 6 岁的文字编程。6 岁玩法只能做"图标化的 LTC1 前两章"（命令与序列、调试）。

### 1.8 Robozzle / Cargo-Bot——极简指令集与"指令数星级"参照

**Robozzle**（网页游戏，作者 Alfonso Ruiz 后开源社区化）：

- 指令集极小：前进 / 左转 / 右转 + F1-F4 函数调用，指令可挂颜色条件（本格是红/绿/蓝才生效）+ 涂色块；**没有显式循环构造，靠递归实现循环**。[来源：官方网页版 https://www.robozzle.com/js/index.aspx 可直接游玩核对；iOS 官方描述 "Using only a few simple commands, teach the robot to recurse a tree, follow a linked list, or count in binary" https://apps.apple.com/us/app/robozzle/id350729261 — 一手；颜色条件与栈机制细节部分二手（社区解答 https://puzzling.stackexchange.com/questions/119622/solving-robozzle-puzzle — 二手）]
- 调试 UX 先例（官方更新说明）："instant trace" 让你编辑指令时**实时预览机器人路径**；"step backwards" 单步回看。[来源：官方 App 更新日志 https://robozzle-ios.soft112.com/ 转载官方 release notes — 二手（转载官方文本）]
- 判读：Robozzle 是"指令压缩比"的天花板参照——同样的地图，把 50 步路径压成 5 条指令是它的全部乐趣；这个乐趣对 6 岁太难，但**"同一路径两种写法"的星标目标可以降龄沿用**。

**Cargo-Bot**（Two Lives Left，iPad）：

- 官方口径："a puzzle game where you teach a robot how to move crates"；App Store 自述"the first game programmed entirely on iPad using Codea"。[来源：https://apps.apple.com/us/app/cargo-bot/id519690804 — 一手]
- 机制细节（二手，官方页未详述）：拖指令进**主程序 + 3 个函数槽**，吊车指令含左右移/爪升降/抓放，爪上 crate 颜色可作条件；**星级按指令数给——用的指令越少星越多**；36 关。[来源：JayIsGames 评测 https://jayisgames.com/review/cargo-bot.php — 二手]
- 判读：**"指令数 = 星级"的预算制**来自这里（Cargo-Bot）与 Lightbot 的"简单解 vs 优雅解"双解官方答案册——这是把"循环压缩比"变成可评分目标的两个一手/近一手先例。

### 1.9 排查后不收录的两款（按任务要求说明理由）

- **Boxel**：检索到的同名游戏是独立开发者的小型体素解谜（itch.io，Godot 制作），**没有官方来源证明它是"编程角色走格子"品类**，也未找到权威官方主页。未找到一手来源，不收录。
- **Mech Mice**：官方新闻稿口径是 "an all-new **tactical strategy game**"、"turn-based, tactical squad game for kids aged 10 and up"（Hyper Hippo，2013）——回合制战棋（每回合现场决策移动/攻击），**不是提前编排指令序列的编程解谜**，机制类别不同，不收录。[来源：官方新闻稿 https://www.prnewswire.com/news-releases/hyper-hippo-productions-launches-mech-mice-228001441.html — 一手（仅用于排除判断）]

---

## 2. 指令集设计横向对比

### 2.1 原语矩阵（一手来源核对）

| 游戏/课程 | 移动 | 转向 | 跳/升降 | 特殊动作 | 循环 | 函数/过程 | 条件 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Robot Turtles | 前进×1 | 左/右 90° | 无 | 激光（融冰墙） | ✗（全程无） | Function Frog（最后解锁） | ✗ |
| Lightbot Jr | 前进 | 左/右 | 跳 | 点亮 | （隐含：过程重复） | 过程槽 | ✗ |
| Lightbot | 前进 | 左/右 | 跳 | 点亮 | 递归循环 | P1/P2（可重载） | ✓（9+） |
| Cubetto | 前进 | 左/右 | 无 | （函数块，高版本） | ✗ | 函数块 | ✗ |
| ScratchJr | 移动/跳 | 旋转 | 跳 | 说话/声音/外观 | ✓（repeat 块） | ✗（无自定义函数） | 触发类事件块 |
| code.org Course A | 前进（箭头） | 左/右 | 无 | — | ✓ | ✗ | 事件块 |
| Minecraft Agent（MakeCode） | move(方向,格数) | turn(左/右) | 无 | destroy/place/collect/detect | ✓（for/while） | ✓（函数） | ✓（if/detect） |
| Swift LTC1 | moveForward | turnLeft/Right | （跳关） | collectGem/toggleSwitch | for → while | ✓ | ✓ |
| Robozzle | 前进 | 左/右 | 无 | 涂色 | （递归实现） | F1-F4 | 颜色条件 |
| Cargo-Bot | 吊车左右 | （爪升降） | 爪升/降 | 抓/放 | （递归/函数自调） | 主程序+函数槽 | 爪上颜色条件 |

### 2.2 引入年龄/阶段的一致规律

| 概念 | 最早出现 | 典型引入方式 | 来源 |
| --- | --- | --- | --- |
| 序列 | 全员起点 | 2-4 步直线 | 各官方课纲 — 一手 |
| 调试 | 第二阶段（**不是最后**） | 修一个预置错误的程序 | Swift LTC1 L2；code.org A-F 开头 — 一手 |
| 循环 | K-1（code.org A）到 9+（Lightbot 本体条件章） | "先让长序列痛苦，再给循环" | code.org Happy Loops 课 — 一手 |
| 函数/过程 | 学龄后（LT 9+ 的 P1/P2；Turtles 的 Function Frog 垫底解锁） | 把重复模式打包命名 | Lightbot 官方答案册；Turtles 规则书 — 一手 |
| 条件 | 9 岁上下才见（Lightbot 本体；Course A 只有"事件"不算条件） | 颜色/传感器判断 | Lightbot 官网清单 — 一手 |

- **单关指令数上限**：Cubetto+ 官方给的是 **18 步槽位**（3-6 岁）；Robot Turtles 首局只有 3 种卡、成人逐张执行；Lightbot 槽位数与 Cargo-Bot 槽位数**未找到官方数字**（答案册与攻略可见 main+P1+P2 结构，具体格数二手传闻不一，不引）。对 6 岁产品，唯一可靠的一手锚点是 Cubetto 的 18——且那是实物、有成人陪玩场景的上限，屏幕端建议更低（见 §6）。

---

## 3. 难度曲线：各家怎么爬坡

### 3.1 爬坡轴总表

| 爬坡轴 | Robot Turtles | Lightbot | code.org Course A | Minecraft Agent 课 |
| --- | --- | --- | --- | --- |
| 网格/地图 | 8×8 固定板，障碍物数量与种类递增 | 3D 堆叠地形渐复杂 | 单卡地图 → XL 大地图 | 3D 世界任务渐复杂 |
| 障碍类型 | 冰墙(可融)→石墙(不可拆)→箱子(可推) | 高度差需"跳" | 无 → 有 | 方块需 destroy |
| 程序长度 | 1 卡/回合 → 3 卡/回合 → 整段 | 槽位逐章吃紧 | 单箭头 → 多箭头 → 循环 | 单命令 → 命令序列 → 循环 |
| 目标压缩 | 无星级（全员通关） | 官方答案册给"简单解/优雅解"双解 | 无星级（课内进度） | 无星级 |
| 概念解锁 | 显式"解锁清单"由成人逐个发放 | 按章节 | 按课时 | 按课时 |

### 3.2 四个可直接抄的关卡设计套路（均有一手依据）

1. **解锁制（content unlock）**：Robot Turtles 规则书明文列出解锁顺序（冰墙→激光→石墙→箱子→Write Program→Function Frog），且每项都给了"什么时候该解锁"的观察判据（"once they begin to unlock obstacles"/"whenever you feel they are ready"）。[一手：官方规则书 PDF]
2. **"先痛苦再给循环"**：code.org Happy Loops 课的官方设计意图原话是"解更大更长的谜题，让孩子**自己看到**长代码的痛苦，然后引入让代码变短的结构"。循环不是提前教的，是被长序列逼出来的。[一手：官方课页]
3. **双目标星级（步数 vs 指令数）**：Lightbot 官方答案册为每关同时给"简单解"（直接堆步骤）与"优雅解"（用模式/过程压缩），并注明"每关存在多种正确解"；Cargo-Bot 星级直接按指令数。把"最短路径"与"最短程序"拆成两颗星，是让 6 岁和 8 岁玩同一关的办法。[一手：Lightbot 答案册 PDF；二手：Cargo-Bot JayIsGames]
4. **"解码他人程序"作为前置关**：Happy Maps 的官方学习目标包含"Decode and run a program created by someone else"——在读程序之前不要求写程序。映射到本项目：先看怪物按一段预置程序走一遍，让孩子预测/补空缺，再进入自己写。[一手：官方课页]

### 3.3 幼儿实证给出的两条硬约束

- **指令越少表现越好**：KIBO 学前课堂研究（N=64，3-5 岁）结论原话："all students generally performed better on the programming tasks that required them to manipulate **less programming instructions**."[来源：Computers in the Schools 33(3), 2016, DOI 10.1080/07380569.2016.1216251；ERIC EJ1114093 — 一手（期刊摘要）] 3 岁幼儿已能造出语法正确的程序，但任务长度直接决定成功率。
- **循环是学龄前最难的构造**：2026 年 CAL-KIBO 幼儿园课程研究发现，"**The most challenging task in KIBO programming is repeat loops for preschoolers**"，最难的计算思维 powerful idea 是设计过程。[来源：Thinking Skills and Creativity（ScienceDirect S1871187126000672），2026 — 一手（期刊论文摘要）] ScratchJr 侧同样：幼儿园班最难的是"元层控制流块"与多角色协调（CSA 研究，§1.4）。
- 设计含义：6 岁玩法的 v1 不应有循环——用"重复卡组"或最多一个"再来一次"块做温和替代，循环等 7 岁后的版本（与 Robot Turtles 全程无循环的先例一致）。

---

## 4. 认知训练视角：这类玩法到底在练什么

### 4.1 执行功能框架与本项目五维的对齐

- 经典框架（Diamond 2013 综述）：EF 三核 = **inhibition**（含 response inhibition 抑制冲动 + **interference control 干扰控制/选择性注意**）、**working memory**、**cognitive flexibility**；计划（planning）属高阶 EF，由三核支撑。[来源：Diamond, A. (2013). Executive Functions. *Annual Review of Psychology*, 64, 135-168. DOI 10.1146/annurev-psych-113011-143750 https://doi.org/10.1146/annurev-psych-113011-143750 — 一手；PMC 全文 https://pmc.ncbi.nlm.nih.gov/articles/PMC4084861 — 一手]
- **命名对齐**：Diamond 把 interference control 明确归在 inhibition 之下——本项目五维里"抑制控制"与"干扰控制"分立是符合文献层级的（干扰控制是抑制的子成分，任务设计上可以分开练）。
- 本玩法对三核的天然占用：
  - **抑制（含干扰控制）**：指令要"想好了再放"，放完统一执行；场上放干扰物（无关方块、会动的怪）逼孩子选择性注意目标路径。
  - **工作记忆（视空）**：整条路径要装在脑子里才能排指令；先演示后编程=路径复述任务（Corsi 式）。
  - **认知灵活性**：换怪物=换规则（见 4.5）。

### 4.2 "提前规划整条路径"的发展心理学定位（Tower of London / Hanoi）

- TOL 的定义句："planning, defined as the capacity to generate and organize the necessary step sequence to carry out a goal-directed behavior"。270 名 6/8/11/13 岁儿童数据显示：计划生成与组织耗时随难度上升，年龄越大越快——**6 岁处于该能力曲线的最底端起点**。[来源：Injoque-Ricle et al. (2014). Tower of London: planning development in children from 6 to 13 years of age. *The Spanish Journal of Psychology*, 17, E77. PubMed https://pubmed.ncbi.nlm.nih.gov/26054740；Cambridge Core 页 https://www.cambridge.org/core/journals/spanish-journal-of-psychology/article/abs/tower-of-london-planning-development-in-children-from-6-to-13-years-of-age/E7C57639D4C073061373C9C8C0F63D9D — 一手]
- 幼儿版关键发现：118 名平均 4 岁 9 个月的儿童，**Tower of Hanoi 表现被"任务转换（shifting）"能力独特预测**，TOL 则与命名速度绑定；两塔任务在幼儿身上不可互换；需要"逆直觉步数"的复杂 trial 最吃 EF。[来源：Bull, Espy & Wiebe (2004). A comparison of performance on the Towers of London and Hanoi in young children. *JCPP*. DOI 10.1111/j.1469-7610.2004.00268.x https://acamh.onlinelibrary.wiley.com/doi/10.1111/j.1469-7610.2004.00268.x；PubMed https://pubmed.ncbi.nlm.nih.gov/15056306 — 一手]
- 4 岁 9 个月到 8 岁半的 TOL 研究：年龄与流体智力共同预测计划表现。[来源：PMC 存档 https://pmc.ncbi.nlm.nih.gov/articles/PMC5619150 — 一手（期刊原文存档）]
- **设计换算**：TOL/Hanoi 里最难的部分是"为了后赢，先走看似后退的一步"。6 岁 v1 关卡应全部"正向顺排"（看到路→按路排），"绕行/后退"类逆直觉步骤放 7 岁难度档；这与 Robot Turtles"石墙绕行"是后期解锁的先例一致。

### 4.3 编程游戏的学习效果实证（5-7 岁）

| 研究 | 样本/设计 | 结果 | 级别 |
| --- | --- | --- | --- |
| Kazakoff, Sullivan & Bers 2013（*Early Childhood Education Journal* 41:245-255） | 幼儿园 1 周机器人编程工作坊（CHERP 实物编程），前后测 + 对照 | **参与组故事排序任务显著提升**（"experienced significant increases in post-test compared to pre-test sequencing scores"） | 一手；证据中（准实验、小样本） |
| 同团队 2014（"Put Your Robot In, Put Your Robot Out", *JECR* 50(4):553-573） | 幼儿园编程×机器人 | 编程情境下幼儿同时习得排序技能 | 一手 |
| Strawhacker et al. 2019（*ETR&D*，"What They Learn When They Learn Coding"） | N=57，K-2，6 周 ScratchJr 课程 | "all students mastered foundational coding concepts"，但年级间差异显著 | 一手 |
| De Ruiter & Bers 2021（CSA 量表，*Computer Science Education*） | ScratchJr 能力量表开发 | 幼儿园班最难：元层控制流块、多角色协调 | 一手 |
| CAL-ScratchJr RCT Study A/B 2023（WWC 评审 91257/91069） | 簇随机对照，571 名二年级等 | **WWC 结论："No statistically significant positive findings"**（meets standards with reservations） | 一手（RCT + 官方评审） |
| 元分析：3-8 岁 CT 干预（*JECR* 2024，17 项研究 34 效应量） | PRISMA 元分析 | 总效应 **d=0.83**（95%CI 0.730-0.890），脚手架是显著调节变量 | 一手（元分析） |
| 元分析：幼儿编程教育模态（Wei et al. 2024，*JCAL*，32 项研究） | 3-12 岁口径为主 | 总效应 **g=0.49**；**图形化 > 实物 > 不插电** | 一手（元分析） |
| 元分析：K-12 编程教学（Xu et al. 2022/2023，*EAIT*，28 项研究） | K-12 | 总效应 **ES=0.72**；脚手架式教学最高 **ES=1.84** | 一手（元分析） |

- Kazakoff 2013 原文与 PDF：https://eric.ed.gov/?id=EJ1003594 ；官方存档 https://sites.bc.edu/devtech/wp-content/uploads/sites/181/2018/02/kazsullbers2013.pdf 。
- Strawhacker 2019 PDF：https://sites.bc.edu/devtech/wp-content/uploads/sites/181/2019/09/Strawhacker_et_al-2019-Educational_Technology_Research_and_Development-2.pdf 。
- WWC 评审页：https://www.ies.ed.gov/ncee/WWC/Study/91257 与 https://www.ies.ed.gov/ncee/WWC/Study/91069 。
- 3-8 岁元分析：https://eric.ed.gov/?id=EJ1440206 。Wei 2024：https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.13038 。Xu 2022：https://dl.acm.org/doi/10.1007/s10639-022-11445-2 。
- **诚实判读**：方向一致（编程活动对幼儿 CT/排序有中到大效应），但**最严格的 RCT 评审未确认正效应**，且元分析的大效应主要来自带脚手架的结构化课程——对本项目的含义是：**玩法必须自带脚手架（示范→半成品→独立），不能指望自由玩就有训练效果。**

### 4.4 计划/抑制/记忆与"编程走格子"的具体对应

- **抑制控制（不能冲动放指令）**：本玩法的核心循环"想全→排完→一次执行"天然要求 response inhibition（忍住不先点"跑"）。Robot Turtles 的 Write Program 是最纯粹的版本：卡全放完喊 "Run Program!" 才执行，错了整段回滚重排。[一手：Turtles 规则书]
- **视空记忆（记路径）**：标准测具是 Corsi 积木（按顺序复现空间序列）；发展规范数据显示空间广度随龄线性增长，约 14 岁到成人平台（成人均值约 7）；2026 年新研究发现 **4 岁与 6 岁儿童在实物版 Corsi 上显著好于数字版**——提示我们的"演示路径"最好用 3D 世界里怪物真的走一遍（具身示范），而不是 2D 小地图闪一下。[来源：Kessels et al. (2006) Developmental normative data for the Corsi Block-tapping task, *J Clin Exp Neuropsychol* 28(6):1043-52, PubMed https://pubmed.ncbi.nlm.nih.gov/16822742 — 一手；Zhang, Scerif et al. (2026) *Neuropsychologia* 226:109437, PubMed https://pubmed.ncbi.nlm.nih.gov/41887321 — 一手]
- **规则切换（不同怪物不同规则）**：经典测具 DCCS——3 岁儿童在换规则后固着旧规则（perseveration），5 岁多数能灵活切换；元分析（69 份报告/426 条件）确认切换率随龄上升，且**新规则线索越凸显切换越好**。[来源：Zelazo (2006) DCCS protocol, *Nature Protocols* 1:297-301, DOI 10.1038/nprot.2006.46 — 一手；Doebel & Zelazo (2016) DCCS 元分析, *Developmental Review* 38:241-268, DOI 10.1016/j.dr.2015.09.001 — 一手] → 6 岁玩家做"换怪换规则"需要**高凸显的当前规则提示**（怪物头顶规则徽章 + TTS 开局念规则），且切换频率要低（不是每关换）。
- **干扰控制（场上有干扰物）**：Diamond 框架内属 inhibition 子成分（选择性注意）；品类内现成机制：Robot Turtles 的石墙（诱你去拆但拆不了，必须抑制）与冰墙（该拆才拆）就是一对"抑制诱惑"设计。[一手：Turtles 规则书；框架：Diamond 2013]

### 4.5 五维训练范式嵌入映射表（对本项目）

| 五维 | 现成机制先例 | 嵌入点子 |
| --- | --- | --- |
| 持续警觉 | 回放执行（Robot Turtles 成人逐卡移动；Lightbot 运行全程可见） | 回放时怪物逐步走，孩子要**预测下一格**（走前先问"下一步它去哪？"，答对加星）；长程序监控本身就是警觉任务 |
| 抑制控制 | Write Program 的"放完才能跑"；Bug 卡喊停 | "先排完再执行"强制化：不排满不许按跑（后期放开）；加入"陷阱卡"——排进去会失败，孩子要忍住不排 |
| 干扰控制 | 石墙 vs 冰墙的"能不能拆"区分；Robozzle 无关色块 | 场上放装饰方块/假终点/来回晃的小怪；目标方块的辨识要过滤干扰色 |
| 视空记忆 | Corsi 实物示范优于数字版（2026 EEG 研究）；Happy Maps"解码他人程序" | 先让怪物演示走一遍（或亮出脚印），孩子凭记忆复原指令序列；脚印延迟消失=难度旋钮 |
| 规则切换 | DCCS 线索凸显效应；Robot Turtles 逐项解锁 | 铁傀儡=只能前进+跳，苦力怕=前进+爆炸清障；切怪物时开局 TTS 念规则+头顶徽章；同关双怪串行=切换挑战（7 岁档） |

---

## 5. 学龄前儿童 UX（不识字、纯鼠标）

### 5.1 指令的表达：图标化是被一手反复验证的唯一解

- 开发者一手结论：Lightbot 作者"我们已经证明 5 岁以上孩子能用图标写复杂程序"，文字是试玩者最大心理障碍。[一手：Yaroslavski Medium]
- 品类事实：Robot Turtles（卡牌图形）、Cubetto（形状积木，连盲童靠触觉都能玩）、ScratchJr（图形块）、code.org 前读者课（图形块+TTS）——**没有一家用文字**。[一手：各自官方文档，见 §1]
- TTS 是 code.org 的官方配套（CSF 全系可自动朗读指令）。[一手：code.org 支持文档]

### 5.2 编辑器形态：槽位队列 vs 自由画布

- **槽位队列**（Cubetto 的板上槽位、Lightbot 的指令槽、Cargo-Bot 的命令条）对幼儿的优势：容量可见（还剩几格一目了然→天然的工作记忆外挂）、顺序天然从左到右（与执行序一致）、错误局部化（只检查一格）。[一手：Cubetto 官方手册 "queue" 口径]
- **自由画布**（ScratchJr）的实证代价：多角色协调与控制流块是幼儿园班最难点（CSA 研究）。本玩法是单角色单目标，**选槽位队列**。
- 反馈 LED 先例：Cubetto 每个槽位下有对应 LED，执行时逐格点亮——"程序指针可视化"在 3 岁玩具上已被验证。[一手：官方手册]

### 5.3 调试当玩法、失败不惩罚

- **喊 "Bug!" 是官方玩法**：Robot Turtles 把撤销做成孩子最爱喊的仪式（拍 Bug 卡+喊出来），当回合无限次，不扣任何分。[一手：规则书]
- **回滚也要有趣**：Write Program 失败时，成人要**倒着**还原全部移动、连音效都倒放——失败过程被包装成表演。[一手：规则书]
- **单步回退**：Robozzle 官方做了 step backwards 调试。[二手转载官方 release notes]
- 成功庆祝：Robot Turtles 无输家（拿到宝石全赢）、成人必须配滑稽音效——庆祝是社交性的，不是积分性的。[一手：规则书]

### 5.4 操作与界面参数（多为二手，标注）

- 点按目标 ≥75×75px、大字号（18-19px）、**每个动作都要给反馈**、避免把关键按钮放屏幕底部（幼儿误触）。[来源：Smashing Magazine《A Practical Guide To Designing For Children》https://www.smashingmagazine.com/2024/02/practical-guide-design-children — 二手（行业实践综述，引 Deb Gelman《Design for Kids》）]
- 4-6 岁图标设计不能只做"简化成人图标"，要按认知发展理论单独设计（语义透明、避免抽象隐喻）。[来源：IARIA 论文 https://www.thinkmind.org/articles/achi_2017_11_40_20068.pdf — 二手（同行评审会议论文，非一手产品数据）]
- **本项目特有约束**：纯鼠标操作（无拖拽要求也行，点选槽位+点击指令块即可，与现有触摸/点击交互一致）；中文 TTS 全程补语言（参照 SpeechKit 的 cancel-then-speak 并句口径，见 docs/story-quest-research.md §1.3，表扬+引导拼一句防顶掉）。

---

## 6. 对本项目的启示

> 以下为可直接落地的设计含义；具体取舍在 plan/design 文档定（conventions.md §1.11）。

### 6.1 指令集建议（v1）

1. **首发 4 个原语图标**：前进 / 左转 / 右转 / 怪物技能（跳 or 爆炸，按怪而定）。理由：Turtles 首局 3 卡、Cubetto 3 块起、Minecraft Agent 课 move/turn/destroy 三件套——三家一手先例都在 3-5 个。
2. **单队列槽位 6-8 格**：一手锚点是 Cubetto+ 的 18（3-6 岁实物上限），屏幕端无成人陪玩应减半起步；配合 KIBO 实证"指令越少表现越好"，最低难度关 2-3 格。
3. **v1 不做循环/函数/条件**：全部一手先例（Turtles 全程无循环；code.org 循环要靠长序列痛苦逼出来；KIBO 实证循环是幼儿最难）都支持后置。二期可上"再来一次（重复上一格）"单块。
4. **图标 + 颜色 + TTS 三编码**：每指令块 = 像素图标 + 固定颜色（方向用色相区分，参照 Robozzle 颜色条件的一手机制留接口）+ 点击后 TTS 念动作（"前进！""左转！"）。
5. **指令块进槽时即预览**：Hover/点住槽位显示该步之后怪物面朝哪（Robozzle instant trace 的一手思路降龄版）。

### 6.2 难度曲线建议

1. **沿"程序长度"爬坡，而不是沿"地图大小"**：2 格直线 → 3 格一个弯 → 4-5 格两个弯 → 5×5 场地 6-8 格。地图尺寸是次要变量（Turtles 板子固定 8×8 也在 4 岁能玩）。
2. **前置"解码关"**：先放 2-3 关"怪物按预置程序走，孩子在缺口处补一张卡"（Happy Maps"解码他人程序"一手目标降龄）。
3. **障碍分两档**：软障碍（可炸/可跳过的箱子——对应 Turtles 冰墙可融）与硬障碍（必须绕的岩壁——对应石墙不可拆）。软硬混用就是天然的干扰控制题。
4. **整段规划是终局挑战，必须带过渡**：照抄 Turtles 官方阶梯——先"边走边排"（走一步排一步），再"分批排"（3 格一批），最后才是"整段排完一次跑"。规则书"提前上会挫败"原话直接引用进 design 文档。
5. **星级拆两颗**：⭐ 通关；⭐⭐ 指令数 ≤ 预算（优雅解）。给 6 岁只展示第一颗，第二颗作为 7 岁/家长向目标存在（Lightbot 官方答案册"简单解/优雅解"双解制）。
6. **每关预算重算**：参照仓库惯例（ADV_QUESTS 原木预算先例，docs/story-quest-research.md §0.7），改指令预算要连动星标与 TTS 文案。

### 6.3 五维训练怎么嵌（v1 只嵌前两个，其余留二期）

- **抑制控制（v1 必嵌）**："排完才能跑"按钮锁（未放完时跑按钮置灰，放完亮起并 TTS 提示"程序装好啦，出发！"）；后期反过来放开允许"边跑边补"，制造"忍住不先跑"的张力。
- **视空记忆（v1 必嵌）**："先看演示"——每关开场怪物自己演示走一遍（脚印逐格亮起），然后孩子复现；高难度档脚印不亮或加速。演示=具身版本 Corsi（2026 研究支持实物/3D 演示优于 2D 快闪）。
- **干扰控制（二期）**：装饰方块、假终点、晃动小怪入场上；先从"无关但无害"开始（纯装饰），再加"有代价"（碰到假终点重置）。
- **规则切换（二期）**：第二只怪（不同技能语义）入场；开局 TTS 念规则 + 头顶规则徽章（DCCS 线索凸显一手结论）；双怪串行关卡放最后。
- **持续警觉（自然涌现，不特设）**：回放监控本身即警觉任务；可加"预测下一步"轻量问句（答对口头表扬，不设惩罚）。

### 6.4 6 岁 UX 注意点（对照本项目既有机制）

1. **零文字**：全部图标 + 中文 TTS；指令块点击有 TTS 念名；无任何需要认读的 UI 文案。
2. **槽位队列 + 点选输入**：点指令块→自动落下一个空槽；点槽内块→删除。避免拖拽（纯鼠标可点选实现，操作成本更低；Cubetto 槽位范式）。
3. **程序指针可视化**：回放时当前执行槽高亮（Cubetto LED 范式），怪物走到哪格与槽位进度强绑定。
4. **失败零惩罚 + 撤销有趣**：撞墙/掉坑时怪物卖萌（摔倒动画+滑稽音效），TTS："哎呀，第 3 步撞墙啦！我们改一下哪里？"；一键撤销单张或清空重来，不扣任何东西（Turtles Bug 卡范式）。
5. **成功仪式复用成关框架**：渐进关卡/星评价/过程性表扬（夸努力不夸聪明）全部沿用专注训练营既有口径（docs/math-thinking-research.md §0.4）；表扬+下一步引导**并句**过 TTS（SpeechKit cancel-then-speak 约束）。
6. **新怪物 = 新关卡包**：按 Turtles 解锁制，铁傀儡包、苦力怕包分开投放；每包 5-8 关，包内只教一个新语义。
7. **存档与模式注册**：新模式 = index.html 加卡/页/script + mode-registry.js 加行（三重命名有测试断言）；进度走 SyncDB slot 惯例（参照 adventure_quest_save 形状）。

### 6.5 边界与红线（宣称口径）

1. 只宣称"**练习规划顺序、路径记忆与按规则行动**"（对应文献：序列能力可练——Kazakoff 2013；CT 干预总效应中到大——元分析），**不宣称**"提升智商/注意力治疗"（MISSION.md 口径）。
2. 不得引用 CAL-ScratchJr RCT 之外的"编程游戏提升执行功能"强因果宣称——**该方向的直接 RCT 证据目前不成立**（WWC："no statistically significant positive findings"），本文 §4.3 的诚实结论必须带入后续 design 文档的风险节。
3. 规划能力发展的文献结论是"6 岁在曲线底端"（TOL 研究），因此关卡深度天花板要按"最多 8 格、单规则、正向顺排"设计，超出即是给 7-8 岁的难度档。
4. 来源时效：code.org / Minecraft Education / Cubetto 均为在线产品，页面随版本变化；本文引用以 2026-10-28 抓取为准，后续落地前若口径变更以官方页为准。

---

## 附：本文引用来源清单（按节序，去重）

**一手（官方/原始论文/开发者本人）**
- Robot Turtles 官方规则书 PDF：https://legacy.thinkfun.com/wp-content/uploads/2014/09/Robot-1900-Instructions.pdf
- ThinkFun 官方产品页：https://thinkfun.com/robot-turtles/ ；官方新闻稿：https://www.prnewswire.com/news-releases/now-nationwide-robot-turtles-by-thinkfun-is-first-board-game-to-teach-coding-skills-to-kids-as-young-as-four-270760351.html
- Lightbot 官网（年龄分档）：https://lightbot.com/ios.html ；概念清单：https://lightbot.com/index.html ；语言规范：https://lightbot.com/hoclearn.html ；教师文档：https://lightbot.com/Lightbot_HowDoesLightbotTeachProgramming.pdf ；答案册：https://lightbot.com/LightbotSolns.pdf
- Lightbot Jr App Store 官方页：https://apps.apple.com/ca/app/lightbot-jr-coding-puzzles-for-ages-4/id858640629
- Yaroslavski 访谈（Game Developer）：https://www.gamedeveloper.com/business/interview-with-light-bot-creator-danny-yaroslavski ；本人撰文（Medium）：https://medium.com/@dannyyaroslavski/text-is-keeping-kids-from-coding-b70988dd7541
- Cubetto 官方手册：https://primotoys.com/cubetto-user-manual/ ；官方 FAQ：https://www.primotoys.com/faq ；官方首页（Cubetto+ 24 块/18 步）：https://primotoys.com/
- ScratchJr 官方 About / Research：https://www.scratchjr.org/about 、https://www.scratchjr.org/research
- ScratchJr 研究论文：Strawhacker et al. 2019（ETR&D，BC 存档 PDF）；De Ruiter & Bers 2021（CSA，DOI 10.1080/08993408.2021.1956216）；Kazakoff, Sullivan & Bers 2013（ECEJ 41:245-255，ERIC EJ1003594 + BC 存档 PDF）；Kazakoff & Bers 2014（JECR 50(4)）
- CAL-ScratchJr RCT 与 WWC 评审：https://www.ies.ed.gov/ncee/WWC/Study/91257 、https://www.ies.ed.gov/ncee/WWC/Study/91069
- KIBO 学前研究：Computers in the Schools 33(3) 2016，DOI 10.1080/07380569.2016.1216251（ERIC EJ1114093）；CAL-KIBO 幼儿园研究 2026（ScienceDirect S1871187126000672）
- code.org：课程目录 https://code.org/en-US/curriculum/computer-science-fundamentals ；Pre-reader Express 教学指南 https://curriculum.code.org/csf-19/pre-express.pdf ；Happy Maps 课 https://curriculum.code.org/csf-20/coursea/3 ；Happy Loops 课 https://curriculum.code.org/csf-20/coursea/7 ；TTS 支持文档 https://support.code.org/hc/en-us/articles/360058843692 ；调试前置官方答复 https://forum.code.org/t/choosing-coding-courses/37629
- Minecraft Education：Unit 1 The Agency 官方 PDF https://education.minecraft.net/lessonsupportfiles/6325506197555818-Computing%20with%20Minecraft_Unit%201_The%20Agency.pdf ；Coding with Minecraft 总览 PDF https://education.minecraft.net/lessonsupportfiles/7010954984185451-Coding%20with%20Minecraft_Curriculum%20Overview.pdf ；MakeCode Agent 文档 https://minecraft.makecode.com/reference/agent 、教程 https://minecraft.makecode.com/tutorials/agent-moves ；Hour of AI https://education.minecraft.net/en-us/resources/hour-of-ai-the-first-night
- Swift Playgrounds：课程指南 PDF https://www.apple.com/au/education/docs/Swift_Playgrounds_Curriculum_Guide.pdf ；Quick Start PDF https://education-static.apple.com/teaching-code/quick-start-to-code.pdf ；开发者页 https://developer.apple.com/swift-playground/
- Cargo-Bot App Store（Two Lives Left 官方）：https://apps.apple.com/us/app/cargo-bot/id519690804
- Robozzle 官方网页版 https://www.robozzle.com/js/index.aspx ；iOS 官方页 https://apps.apple.com/us/app/robozzle/id350729261
- 认知科学：Diamond 2013（Annu Rev Psychol 64:135-168，DOI 10.1146/annurev-psych-113011-143750）；Injoque-Ricle et al. 2014（SJP 17:E77，PubMed 26054740）；Bull et al. 2004（JCPP，DOI 10.1111/j.1469-7610.2004.00268.x）；TOL 4.5-8.5 岁研究（PMC5619150）；Kessels et al. 2006（JCEN 28(6)，PubMed 16822742）；Zhang & Scerif et al. 2026（Neuropsychologia 226:109437）；Zelazo 2006（Nat Protoc 1:297-301，DOI 10.1038/nprot.2006.46）；Doebel & Zelazo 2016（Dev Review 38:241-268，DOI 10.1016/j.dr.2015.09.001）
- 元分析：3-8 岁 CT（JECR 2024，ERIC EJ1440206）；Wei et al. 2024（JCAL，DOI 10.1111/jcal.13038）；Xu et al. 2022（EAIT，DOI 10.1007/s10639-022-11445-2）

**二手（转引/第三方，正文已逐条标注）**
- Common Sense Media（Lightbot Jr 指令细节）；JayIsGames（Cargo-Bot 机制细节）；TechCrunch（Cubetto 众筹数据）；Dezeen（Cubetto 无障碍设计说明）；Smashing Magazine 儿童设计指南；IARIA 4-6 岁图标设计论文；Robozzle 栈机制社区解答与 Puzzling SE；Mech Mice 排除判断用的官方新闻稿（一手，仅作排除依据）
