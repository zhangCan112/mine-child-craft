# 共享基座统一设计定稿（camp-core unification）

> 架构治理候选 2（纯函数共享基座）的拍板记录与交付清单。
> 评审入口：2026-10-24 架构评审（improve-codebase-architecture 流程，HTML 报告）卡 2；
> 相关词条：GLOSSARY「确定性随机核心」「训练营机制核心」，及随票修订的「数学图章」「图章日历」「矿袋」「数学关卡参数表」；
> 前序挂账：候选 5（世界轨统一，docs/math-track-unification-design.md）Q5 的 seed 派生式统一由本候选收口。
> 切票 C2-A / C2-B 已合入，C2-C 为本收尾票（拍板记录 + GLOSSARY 终态核对）。
> 日期：2026-10-25 · 状态：已交付。

## 背景与证据

交接评审报告卡 2 的证据摘要：focus/math 两训练营家族与屏流/世界轨之间存在 **12 个纯函数
91–100% 逐字重合**（图章 7+7 件、日期三件套、loot 基座三件），另有 **LCG 5 份、洗牌 4 份、
timers 4 份、seed 派生三套公式**。行号采用两票提交正文记录的「改造前行号」：

- **LCG 五份**（C2-A，f642b99）：focus-levels `mkLootRand` L256 · math-levels
  `mathLootRand` L559 · math-paradigms `mRand` L83 · math-puzzles-core IIFE 内
  `mkRand` L38 · math-build-world-core IIFE 内 `mkRand` L44——同常数同语义各持一份，
  漂移即「同 seed 不同输出」的语义分叉。
- **洗牌四份**：math-paradigms `mShuffle` L100 · math-puzzles-core `shuffle` L54 ·
  math-build-world-core `shuffle` L57（三份拷贝式）+ focus-paradigms `shuffleArr` L73
  （Math.random 突变式，四份中唯一异款）。
- **seed 派生三套公式**：modes/math.js:802 `i*7919+13` · math-track.js:154
  `i*7919+si*101` · math-build-world.js:576 `seed*31+idx*101+7`——同为「索引派生种子」
  却三套写法，无统一口径。
- **图章一本七件 ×2**（C2-B，2e3fc06）：focus-levels stampRecord(499–505) /
  stampTrim(510–512) / stampCount(515–517) / stampMilestones(520–524) /
  stampRewardsDue(528–531) / stampRewardFor(534–536) / stampRewardClaimed(540–542)；
  math-levels mathStampRecord(618–624) / mathStampTrim(628–630) / mathStampCount(633–635) /
  mathStampMilestones(638–642) / mathStampRewardsDue(645–648) / mathStampRewardFor(651–653) /
  mathStampNextLine(656–661)——逐字同语义（STEP=30 递进线 / 差集幂等 / 回落金图章）。
- **日期三件套 ×2**：focus-levels focusTodayStr(395–397) / focusDayIndex(401–406) /
  trimFocusLog(413–423) 与 math-levels mathTodayStr(673–675) / mathDayIndex(679–684) /
  trimMathLog(689–699)——逐字镜像（含未来日期保留的零惩罚口径）。
- **loot 基座 ×2**：focus-levels pickLootWeighted(259–266) / grantFocusLoot(308–315) 与
  math-levels pickMathPool(559–566) / grantMathLoot(588–595)——逐字镜像
  （累积区间取件 + 浮点尾差兜底 / 逐件 add 余量静默 + full 标记）。
- **timers 四份**（拍板②豁免、未收编，以下为现树行号）：focus-paradigms `mkTimers` L75 ·
  math-paradigms `mTimers` L64 · math-world `mWTimers` L55 · math-build-world L71。

## 拍板决策

**① 两文件切分：rand-core（引擎层）+ camp-core（应用层）；否决「单份基座」的字面读法。**
随机工具的消费方不只有训练营——math-puzzles-core / math-build-world-core 两个谜题纯核心
同样要 LCG 与洗牌，它们与「训练营」无关，不该顶 camp 名；随机是零玩法知识的确定性工具，
下沉引擎层。图章/日期/loot 是训练营玩法概念（试次/关卡/奖励），按「应用可依赖引擎、
引擎不得依赖应用」的分层硬规则留在应用层。**否决项**：评审原文「单份基座」按字面执行
（全部塞进一个文件）——其本意是「对两家族不再各一份」（消除家族间镜像），不是「全仓只许
一个基座文件」；字面执行要么让引擎层文件顶应用名、要么让谜题核心依赖应用层，两者都
违反分层，故拆两文件各归其层。

**② timers 四份豁免、不收编。** math-world.js:55 已登记刻意分立注释（「math-paradigms
mTimers 同构的本地副本，不跨引擎复用是刻意的——两轨生命周期不同」），math-paradigms:64
与 math-build-world:71 有同款登记；每份约 18 行、同构度虽高但收益低；且计时器是
`setTimeout` 环境副作用，进 -core 就得把 setTimeout 注入进来，违背纯核心「零副作用、
到点驱动归调用方」的既有口径（触控手势核心同款判例）。四份保留分立，注释即豁免登记。

**③ 图章机制走 mkStampBook 工厂 + levels 家族名薄委托。** `CampCore.mkStampBook(
{rewards, keepDays, dailyCap})` 返回八件（record/trim/count/milestones/rewardsDue/
rewardFor/rewardClaimed/nextLine），家族差异只注入三参；两 levels 在家族常量后建
FocusStampBook / MathStampBook 实例（dailyCap 按值 6，保留「DAILY_LEVELS=6 按值拷贝
免跨文件依赖」口径），七个图章家族函数与三个日期家族函数体改一行委托。模式层
（focus.js/math.js）与既有 levels 测试**零改动**；掷骰政策不对称（段位变率 vs 族池）
留在各自 levels 是有意设计，不进核心。

**④ seed 派生统一 `seedAt(base, i, j) = base*7919 + i*101 + (j||0) + 13`——还候选 5 的
Q5 挂账。** math-track-unification-design.md 的 Q5 明言「统一会改『同 seed 同输出』的
具体值；留奖励基座票统一收口」，其后续钩子并承诺「测试不锁派生式（只锁 LCG 常数与
同 seed 确定性），迁移窗口安全」。本票兑现：三个消费点逐一拍板——

- modes/math.js 关卡种子：`seedAt(i, 0) === i*7919+13`，**恒等**（单测存迁移安全锚断言）；
- math-track.js boss 小节：`seedAt(i, si)` 比旧式 `i*7919+si*101` 恒多 **+13**，小节种子
  偏移 → boss 小节换题；
- math-build-world.js 试次：`seedAt(seed, idx)` 替换旧式 `seed*31+idx*101+7`，公式本体
  （底数 31→7919、尾常数 7→13）变了 → 摆与搭试次换题。

**已拍板接受换题**：存档按关号记账、不按种子记账，换题不伤存档（关号语义未变，
「版本位 v 清空三表」的红线不触发）；测试只锁 LCG 常数与同 seed 确定性，不锁派生式，
与候选 5 的前置承诺一致。

**⑤ stampCount null 入参语义统一（防御版）。** focus 侧原实现
`Object.keys(stamps).length` 无防御（null 入参抛 TypeError），math 侧原有 `|| {}` 兜底；
统一取防御版（null/undefined 返回 0）——focus 侧从抛错变为返回 0，空账本按无章处理、
不炸渲染。两家族其余件入参语义本就一致，无行为面变化。

**⑥ 加载序变更：index.html 两处纯增行 + 测试装载器补行。** rand-core.js 插在 items-core.js
之前（index.html:247/248），camp-core.js 插在 focus-icons.js 与 focus-levels.js 之间
（index.html:263——levels 顶层构造期即建图章本实例，加载序即依赖序）。测试侧：C2-A 补
8 个 vm 装载器清单行 + math-puzzles / math-build-world-core 两测试挂 `global.RandCore`；
C2-B 补 focus-paradigms（两处）/ math-levels / math-paradigms（两处），另 grep 扫出并同步
补工单未列的 hop-world-core 与 math-track 两处装载器，math-paradigms 的 index.html 脚本序
断言加行。**判断：不动任何既有相对序、纯增行，回滚 = 删行，完全可逆，不触发 ADR。**

## 升格与 ADR 判断（conventions §1.10 / §1.11）

本候选**不触发升格、不写 ADR**：无新约定——两文件切分遵循既有「引擎/应用分层」与
「-core 纯核心必配同名单测」约定，家族名薄委托沿用既有兼容先例，不满足 §1.10 的
「清单 ≥3 处 + 手滑必炸」升格判据；纯重构可逆——薄委托删委托行恢复函数体即回滚，
加载序回滚即删行，无不可逆决策。本文件即 §1.11 文档三段式的 -design.md 段。

## 交付清单

- **C2-A**（f642b99）：新建 `js/rand-core.js`（59 行，IIFE 命名空间 + 尾部 CommonJS 守卫，
  四件 mkRand/shuffle/seedAt/childSeed，零 THREE 零 DOM）。删除的本地副本：`mkLootRand`
  （focus-levels）· `mathLootRand`（math-levels）· `mRand`（math-paradigms；
  math-world.js:109 调用点一并切 RandCore.mkRand）· `mkRand` ×2（math-puzzles-core 与
  math-build-world-core 的 IIFE 内）· `mShuffle`（math-paradigms）· `shuffle` ×2
  （math-puzzles-core、math-build-world-core）· `shuffleArr`（focus-paradigms，三处调用点
  改 `RandCore.shuffle(Math.random, …)`，观感随机语义不变）。seed 派生三消费点切 seedAt。
  index.html +1 行；test/rand-core.test.js 14 件；GLOSSARY 新词「确定性随机核心」。
- **C2-B**（2e3fc06）：新建 `js/camp-core.js`（144 行，同款 IIFE + CommonJS 守卫，六件
  todayStr/dayIndex/trimLog/pickWeighted/grantLoot/mkStampBook）。两 levels：图章七件 ×2、
  日期三件 ×2 改一行薄委托，建 FocusStampBook / MathStampBook 实例；rollFocusLoot /
  rollMathLoot 掷骰调用点改 `CampCore.pickWeighted`；删除的本地副本：`pickLootWeighted`
  （focus-levels）· `pickMathPool`（math-levels），grantFocusLoot / grantMathLoot 变薄委托。
  明确不动：掷骰政策本体、devilDimFor / checkBaseline、存档迁移段、js/modes/focus.js 与
  js/modes/math.js。index.html +1 行；六处 vm 装载器补行 + 脚本序断言加行；
  test/camp-core.test.js 15 件；GLOSSARY 新词「训练营机制核心」+ 修订「数学图章」
  「图章日历」「矿袋」「数学关卡参数表」四词条的机制归属口径。

历史名全部进 GLOSSARY _Avoid_：RandCore 词条收 mkLootRand/mathLootRand/mRand/pzSeed/
shuffleArr；CampCore 词条收「把两家族函数当独立实现（历史认知）」。

## 行为面影响登记（诚实口径）

归一是纯重构为主，但决策④/⑤有孩子可感知差异，逐条登记：

1. **boss 小节 +13**（math-track.js）：同关同小节的种子比旧版大 13 → boss 串链的题目
   内容与旧版不同（换题）。难度曲线、记分、boss 节拍、存档进度全部不变。
2. **摆与搭试次换题**（math-build-world.js）：试次种子公式从 `seed*31+idx*101+7` 换成
   `seedAt(seed, idx)` → 同一关每次进场的谜题形状与旧版不同（换题）。par / 判分 /
   三星口径不变。
3. **stampCount null 入参**（focus 侧）：从抛 TypeError 变为返回 0——正常运行无可见
   差异（原抛错路径本身是缺陷面），登记在案以求诚实。
4. **其余恒等**：modes/math.js 关卡种子恒等（有迁移安全锚断言）；focus-paradigms 三处
   shuffleArr 改注入 Math.random，观感随机语义不变；图章/日期/loot 机制归一后的行为面
   由既有安全网断言全绿背书恒等。

## 测试与守门

- **新增**：test/rand-core.test.js 14 件（首步手算对照 / 同 seed 同序列 / 缺省不炸 /
  洗牌非突变与多重集不变 / seedAt 公式与旧式恒等锚 / childSeed 值域）；
  test/camp-core.test.js 15 件（mkStampBook 八件小假表全覆盖 / 日期三件套边界 /
  todayStr 委托桩断言 / pickWeighted 尾差兜底 / grantLoot 真件语义——items/inventory/
  camp-core 同 vm 缝接真 add）。
- **既有安全网全程绿 = 行为面恒等的证据**：focus 边界种子锁定、math 首骰边界、图章与
  裁剪断言、NaN 回归锁（math-levels）零断言改动全绿；模式测试装载器各补一行真模块。
- **增长账**：885 → 899（C2-A：+14）→ 914（C2-B：+15），零 fail；ESLint / Stylelint /
  htmlhint 三 lint 零错。

## 后续钩子

- **候选 1（训练营壳 camp-kit）**：将消费 CampCore / RandCore 装配两家族共享的 HUD 与
  流程壳，但不动本两文件——核心已就位，壳只装配。
- **modes 层边界声明**：js/modes/focus.js 与 js/modes/math.js 本候选零改动——掷骰政策
  本体、devilDimFor / checkBaseline、存档迁移段都留在 levels / 模式层，是候选 1 的领地。
- **timers 再评估窗口**：若未来屏流与世界轨的生命周期统一（如全部由世界轨驱动器持有），
  再评估四份 timers 的收编；当前各份头注释已登记刻意分立理由。
