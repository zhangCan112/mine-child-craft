# 训练营壳统一设计定稿（camp-kit unification）

> 架构治理候选 1（训练营壳机器收编 camp-kit）的拍板记录与交付清单。
> 评审入口：2026-10-24 架构评审（improve-codebase-architecture 流程，HTML 报告）卡 1；
> 相关词条：GLOSSARY「训练营壳 kit」（随票扩至终态）及本票修订的「专注训练营」「数学冒险岛
> （MathMode）」，补词汇债新词「模式面板 kit（ModeKit）」；
> 前序挂账：候选 2（纯函数共享基座，docs/camp-core-unification-design.md）已就位——camp-kit
> 只装配 CampCore/RandCore，不动两核心文件；
> 切票 C1-T1~T4 已合入，C1-T5 为本收尾票（拍板记录 + GLOSSARY 终态修订）。
> 日期：2026-10-25 · 状态：已交付。

## 背景与证据

交接评审报告卡 1 的证据摘要：js/modes/focus.js ↔ js/modes/math.js 存在 **≈500+ 行换前缀镜像**
（函数名加 f-/m- 前缀、DOM id/类名换前缀、其余逐字同构），评审清点 **29 组样板对**；四票提交
正文记录了实收编面的行号证据（评审快照，前序票已减行，以函数名定位为准）：

- **战利品回路（T1）**：ticker focus.js 104-121 ↔ math.js 462-482 · 矿袋会话状态 focus.js 80-84 ↔
  math.js 126-128 · grantIntoBag focus.js 431-443 ↔ math.js 207-219 · flyLoot focus.js 460-482 ↔
  math.js 235-257 · addBagSlot focus.js 486-505 ↔ math.js 261-280 · recapHtml/runRecap
  focus.js 509-529 ↔ math.js 284-304。
- **图章仪式（T2）**：日历条 focusStampCalendarHtml(189-215) ↔ mathStampCalendarHtml(267-290)
  （含 focusStampKind 185-187 ↔ mathStampKindOf 262-264 与两侧章名表）· 授予仪式块
  focusStampAwardHtml(249-264，村长喝彩图) ↔ mathStampAwardHtml(322-334，裸文本) · 三选一
  picker 接线 wireFocusStampPicker(266-282) ↔ wireMathStampPicker(336-352) · 烟花
  launchFocusFirework(234-241) ↔ launchMathFirework(356-363)。
- **家长门与面板件（T3）**：家长门 showFocusParentGate ↔ showMathParentGate（逐字同构算术题门，
  类名 f-gate-row/f-btn ↔ m-gate-row/m-btn）· spark 折线 spark(h) ↔ mathSpark(series)（嵌于各自
  showParent，SVG 同参）· CSV 下载 focus.js ≈1057-1062 ↔ math.js ≈549-554（BOM+Blob+click+5s
  revoke）· 结算星显 onFocusLevelEnd ↔ onMathLevelEnd（350ms*n 逐星 pop）· 自动续程
  focusAutoTimer 4000ms ↔ mathAutoTimer 4500ms。
- **壳骨架（T4）**：ensureRoot ↔ ensureRoot · screen 挂屏 ↔ 挂屏（+常驻钟差异）· exit ↔ exit ·
  init ↔ init（bag.load 重进必重读）· cleanup ↔ cleanup · 表扬话术 praiseLine/comfortLine ↔
  mathPraiseLine/mathComfortLine · 预算访问器 focusBudget/focusLocked ↔ mathBudget/mathLocked ·
  存档槽三件套 focusSlot/loadFocusSave/saveFocusSave ↔ mathSlot/loadMathSave/saveMathSave。

**镜像已漂移的实证——flyLoot 宽度守卫**：math 侧（235-257 现状）在飞行前查
`getBoundingClientRect().width` 为 0 即放弃观感（世界轨宿主隐 DOM 屏下 HUD 无宽度，飞行会飞向
错误坐标）；focus 侧同源函数无此守卫——两份拷贝已经长歪，是「复制体必漂移」的直接证据。

**mode-kit 定位错位**：js/mode-kit.js 头注释自称「术语见 GLOSSARY.md」却无专条（词汇债）；其
合成/熔炉/宝箱面板族只服务探险等游玩模式，训练营壳（屏幕流生命周期/预算入账/授予/图章仪式/
家长门）在两个模式文件里各自复制、无人收编。

## 拍板决策

**① 应用层 -kit 收编，新文件 `js/camp-kit.js`，术语「训练营壳 kit（CampKit）」；否决「扩展
mode-kit」。** 训练营壳是与引擎 chrome/HUD/物品面板不同族的 vocabulary（屏幕流生命周期/预算/
图章/家长门是训练营玩法概念），按「应用可依赖引擎、引擎不得依赖应用」留在应用层；CombatKit
已立「按家族拆 -kit」先例，塞进 mode-kit 会把它变成两个不相干家族的杂物抽屉、且诱导未来把
训练营壳件错装进去。**否决项**：评审原文按「训练营壳并入 mode-kit」的字面读法执行——两 kit
消费面不同（mode-kit 消费方是四游玩模式，camp-kit 消费方是两训练营），收编地必须分开（本票
同时补 ModeKit 词条把分工写死）。

**② 家族差异三种处置口径：统一 / 参数化保真 / 拍板不收编。**

- **统一**（消除漂移，收编时取一侧）：
  - **flyLoot 宽度守卫**：统一为 math 侧带守卫版——HUD 宽度 0（隐藏/世界轨宿主隐 DOM 屏）直接
    放弃观感，入包已完成不受影响；focus 侧实践上 no-op（HUD 隐藏即不在试次中）。
  - **家长门洗牌换 RandCore.shuffle**：两侧原 `.sort(random-0.5)` 手写洗牌分布有偏（比较器
    不一致），Fisher-Yates 单件实现且不偏分布；题面集合与正解恒不撞的口径不变（分布质量
    改善，见行为面登记）。
- **参数化保真**（差异经工厂入参注入，不强行统一）：
  - **缺省飞行起点 defaultOrigin**：focus=训练区 #fArea 矩心（引擎缺席兜底常量 640×380）↔
    math=屏心 innerWidth/2·innerHeight/2（摆与搭指针锁宿主无点击位可记）。
  - **spark 数值域与空态 {max, noData}**：focus max=100（save.history 尾 20 条 acc∈0–100）+
    「数据不足」（f-nodata 样式）↔ math max=1（mathPanelTrend 序列 acc∈0..1）+「—」；同点位
    换算恒等（50/100 ↔ 0.5/1 落同 y）。
  - **自动续程时长 autoMs**：focus 4000 ↔ math 4500（math 结算屏 TTS 更长是刻意）；armAuto(fn,
    ms?) 可逐次覆盖——focus 里程碑串播复用同一轨道的 4500ms 现状保真。
  - **魔鬼角标 badge 缝**：focus 日历单元格查 save.devil.days 盖鬼图章角标（B8，与普通章并存、
    不改集章口径），math 无此概念——badge(day, save)→角标 html|null，缺省无角标。
  - **喝彩图 awardIcon 缝**：focus 仪式块带村长喝彩图且奖励文本包进 f-award-text ↔ math 裸
    文本——有图时文本包进 {p}-award-text、无图裸文本，两家族输出与现状字节一致。
  - **根级 pointerDown 挂点 onRootPointerDown**：math 根级捕获期自记 tap（屏流/世界轨两轨
    通用）经缝注入；focus 挂点在每关 areaEl 的现状不动。
  - 其余注入面：prefix（f-/m-，CSS 契约不变）· budgetName（预算访问器）· onFull（满包 toast）·
    saveKey/saveDefaults/saveMigrate（存档槽三件套）· onScreen/headerExtra（math 停常驻钟/钟面
    容器）· initPre/initPost（focus 矿洞皮肤/补授仪式，math 首屏）· bindRoot（根元素回写模式层
    变量——mathRoot 是 math-world/track/build-world 三处 typeof 守卫直读的跨文件契约）·
    screen/scope（家长门渲染与按钮查询范围缝）。
- **拍板不收编**（政策分叉或家族面，登记备查）：
  - **连败换路 moveOn**：focus 走 unlocked 推进 + focusFailCount 重试放宽 ↔ math 走 0 星占位
    入账 + frontier 派生——0 星占位/unlocked vs frontier 是两家族的**存档政策分叉**而非实现
    漂移，收编会强迫统一政策，留在各自 onLevelEnd。
  - **onLevelEnd 骨架与结算流程话术、今日页/地图页/宝物柜/体检/魔鬼特训/里程碑仪式**：家族面
    （focus 专属或两家族数据聚合与布局不同形），不属镜像复制。
  - **FOCUS_STAMP_REWARD_TEXT 位置漂移**：focus 奖励文案表在模式层（结算屏集章 toast 也查此
    表，kit 侧经 rewardText 注入）↔ math 的 MATH_STAMP_REWARD_TEXT 在库层 math-levels——同族
    数据表两家族放置位置不一致；**登记不治理**（搬表是纯搬家无归一收益，focus 结算屏直查是
    调用契约；math.js:257 已有同款登记注释）。

**③ 引擎话术调用契约红线。** praiseLine/comfortLine/mathPraiseLine/mathComfortLine 四个全局名
是引擎调用契约——focus-paradigms **无守卫直调** comfortLine（调用期解析全局名），math 三引擎
typeof 守卫调用。收编只把「均匀随机取一行」的机械件 pickLine 进 kit（两侧现状均无防重复/
游标），四个全局名**零改零删**、函数体一行委托 `CampKit.pickLine(表)`；话术表本体
（FOCUS/MATH_PRAISE·COMFORT）是应用层文案家族面，留 modes。

**④ ADR 0002 与选型 B 守恒声明。** bag.load 重进必重读（ADR 0002：双消费方共用存档介质）随
init 骨架迁移——步序保真（建根→initPre→显示→收 overlay→背包读档→initPost）；入包即 save
（grantIntoBag 经 CampCore.grantLoot + bag.save()，频率低不批量）不变；**里程碑工具记账不动**
（选型 B：工具记训练营存档 tools 字段、不进共享背包，宝物柜工具组从该字段渲染）。

**⑤ f3c1fee ticker 钳制保真。** 单拍钳制 2000ms 系 f3c1fee 修复语义——iPad 锁屏/切后台时系统
冻结 timer，恢复后第一拍的墙钟差是整段挂机时长，曾把 20 分钟日限一夜灌成 20.6 小时；收编进
mkCampTicker 单份保真并加直测：只认连续在场的真实训练时长，缺预算的拍不入账也不推 t0（下一拍
仍受钳制保护），start 幂等、stop 复位。

**⑥ 壳骨架与停止钩子注册表（「退出收口权」，T4 核心 vocabulary）。** onStop(fn) 自注册，exit
与 cleanup 骨架统一跑；注册动作在 modes 顶层一次完成。家族停止件分账：focus 注册 {关卡
runner(focusCtrl), abortDevilRun}，math 注册 {settle 清续程, MathTrack.stop, stopMathClock}；
ticker 停是四条路径共件，由骨架直持。单层注册表的恒等性论证：focus 的 abortDevilRun 现状只在
cleanup 跑——特训进行中返回钮已改结算（settleDevilRun），focusExit 在 devilRun 非空时不可达，
故「退出也跑该钩子」在全部可达状态下 no-op（abortDevilRun 首行 null 早退），不需要分层注册表。

**⑦ 加载序与形态。** index.html 插 camp-kit.js 于 modes 块前（index.html:275，rand-core/
camp-core 之后、两训练营模式文件之前，加载序即依赖序）；共享词法环境顶层函数 + 尾部
CommonJS 守卫（module.exports 供 vm 测试装载，CombatKit 同款）；THREE/DOM 惰性（调用期才碰），
Node 测试可安全加载。

## 升格与 ADR 判断（conventions §1.10 / §1.11）

本候选**不触发升格、不写 ADR**，理由同 camp-core 文档口径：无新约定——-kit 跨模式工具与
「应用可依赖引擎」分层遵循既有规则，家族名薄委托沿用既有兼容先例；不满足 §1.10 的「清单
≥3 处 + 手滑必炸」升格判据（停止钩子注册表是 kit 内部实现 vocabulary，不是跨文件清单约定）；
纯重构可逆——薄委托删委托行恢复函数体即回滚，加载序回滚即删行，无不可逆决策。本文件即
§1.11 文档三段式的 -design.md 段；GLOSSARY 收词走 §1.8 判据（CampKit 跨两模式文件出现；
ModeKit 名字跨 mode-kit.js 头注释与消费方出现且曾有「塞错抽屉」风险，_Avoid_ 有实际内容）。

## 交付清单

终态 js/camp-kit.js = **487 行**，出口九件 = 六工厂（mkCampTicker/mkLootHud/mkStampRites/
mkParentGate/mkSettleBits/mkCampShell，一实例一家族）+ 三散件（sparkSvg/downloadCsv/pickLine）。

- **C1-T1**（cd25ea2）战利品回路五件套：mkCampTicker({budget}) + mkLootHud（begin/grantIntoBag/
  noteTap/fly/addSlot/recapHtml/runRecap/clear，会话状态自持实例；focusStreakChimes/focusLootDry
  为 focus 奖励调优专属留 focus.js 不迁）。新增两模式 cleanup 调 clear()。index.html +1 行；
  test/camp-kit.test.js 3 条直测（钳制/缺预算与幂等/授予节流）；math-paradigms 装载器与脚本序
  断言加行。测试 914 → **917**。
- **C1-T2**（1e9c89d）图章仪式四件套：mkStampRites（kindOf/calendarHtml/awardHtml/wirePicker/
  firework）。决策登记：mathStampTodayHtml/mathStampBlockHtml **不迁**——票面条件「focus 内联
  同款」经查不成立（focus 今日页/结算屏无对应件，只有日历条），它们是 math 专属拆分件且依赖
  库层 mathStampCount/mathStampNextLine，非镜像复制面；FOCUS/MATH_STAMP_KIND_NAMES 数据表留
  模式层经 kindNames 注入。直测 +2（kindOf 回落/awardHtml 两分支与 picker 条件渲染；
  calendarHtml 网格/badge 缝/金章阈值）。测试 917 → **919**。
- **C1-T3**（3876da2）家长门/spark/CSV/星显/续程：mkParentGate({prefix,scope,screen,onPass,
  onFail})→{open()} · sparkSvg(series,{cls,max,noData}) · downloadCsv(filename,rows) ·
  mkSettleBits({prefix,autoMs})→{starSpans/popStars/armAuto/clear}。modes 的 let 续程计时器变量
  消亡，全部清理点（家族 screen 换屏/里程碑串播/exit/startLevel/onLevelEnd/两模式 cleanup）改走
  kit 件；行构造不收（focus 模式层内联拼行/math 走库层 mathPanelCsv）。直测 +3（结算件时长
  参数化与重挂先清/折线数值域与空态/家长门题面与接线）。测试 919 → **922**。
- **C1-T4**（a6939c2）壳骨架+停止钩子注册表+话术件：mkCampShell({prefix, rootId, bindRoot,
  ticker, loot, settle, bag, saveKey, saveDefaults, saveMigrate, budgetName, onRootPointerDown?,
  onScreen?, headerExtra?, initPre?, initPost?})→{ensureRoot · screen · exit · init · cleanup ·
  onStop · budget · locked · slot} + pickLine(table)。不收编清单：连败换路（拍板②）· onLevelEnd
  骨架与结算流程话术 · 今日页/地图页/宝物柜/体检/魔鬼特训/里程碑仪式（focus 专属或家族面）·
  mountMathClock（math 家族件，经 onScreen/onStop 进骨架）· 世界轨驱动器 MathTrack 本体（经
  onStop 停止钩子收口）· 话术表内容。直测 +2（mkCampShell 生命周期/停止钩子次序/预算访问器/
  挂屏缝；pickLine 取行）。测试 922 → **924**。

**modes 薄委托映射摘要**（家族函数名 = 测试面与调用契约，全部保留为一行委托）：

- focus：praiseLine/comfortLine→pickLine · startFocusTicker/stopFocusTicker→focusCampTicker ·
  grantFocusLootIntoBag/flyFocusLoot/addFocusBagSlot/runFocusLootRecap→focusLootHud ·
  focusStampKind/focusStampCalendarHtml/focusStampAwardHtml/wireFocusStampPicker/
  launchFocusFirework→focusStampRites · showFocusParentGate→focusParentGate.open · spark（嵌套
  保留）→CampKit.sparkSvg · focusBudget/focusLocked→focusShell · focusSlot=focusShell.slot
  （loadFocusSave/saveFocusSave 委托）· ensureFocusRoot/focusScreen/focusExit→focusShell ·
  FocusMode.init/cleanup 内部改走 shell。
- math：同构 m 前缀族（mathPraiseLine/mathComfortLine · startMathTicker/stopMathTicker ·
  grantMathLootIntoBag/flyMathLoot/addMathBagSlot/runMathLootRecap · mathStampKindOf/
  mathStampCalendarHtml/mathStampAwardHtml/wireMathStampPicker/launchMathFirework ·
  showMathParentGate · mathSpark（嵌套保留）· mathBudget/mathLocked · mathSlot=mathShell.slot ·
  ensureMathRoot/mathScreen/mathExit · MathMode.init/cleanup）。

**量化（git 实测行数，含空行）**：focus.js 1149 → 1092（T1）→ 1062（T2）→ 1037（T3）→
**1034**（T4，净减 115）；math.js 923 → 857 → 827 → 795 → **785**（净减 138）；两模式镜像面
清零、合计净减 253 行，换 487 行 kit 单份（含五段模块头契约注释与三家族缝文档）。

## 行为面影响登记（诚实口径）

归一以恒等为主，四项有可登记差异：

1. **家长门洗牌分布改善**：RandCore.shuffle（Fisher-Yates）替 `.sort(random-0.5)`——原比较器
   洗牌分布有偏、三键排列不均匀，现无偏；孩子观感差异≈无（题面集合与正解恒不撞口径不变），
   登记在案。
2. **spark 紧凑拼接**：kit 侧 SVG 模板单行拼接（focus 原模板字面量含换行+缩进空白）——SVG
   内部空白无观感差异，渲染字节不同。
3. **focus 飞行宽度守卫**：统一带守卫后 focus 侧新增宽度 0 早退分支——实践上 no-op（HUD
   隐藏即不在试次中，该状态飞行调用点不可达）。
4. **飞行件跨模式漂浮修复**：两模式 cleanup 调 clear()——飞行件挂 document.body、换页收不走，
   原实现切模式后 620ms 内仍会漂浮并触发落袋音，现立即清场。
5. **其余恒等**：挂屏 html 字节（屏头结构/返回钮接线）· exit/cleanup 停止集合与收尾三行 ·
   init 步序 · 存档槽键与迁移链 · 预算缺席防御 · 话术随机取行 · ticker 每秒 accrue 与缺预算
   拍不推 t0 · 飞行 620ms 贝塞尔落袋 · 并槽计数角标 · 结算级联 220ms*k+250 与前 3 件 sfx
   节流 · 日历网格/金章阈值/角标位置 · 仪式块文案与 picker 三键 · 烟花 1600ms 自清 · 门题面/
   三键/比对语义 · 折线点位与空态 · CSV 仪式字节 · 三星 spans 与 350ms*n pop——由既有安全网
   断言全绿背书。

## 测试与守门

- **新增**：test/camp-kit.test.js 10 条直测（3+2+3+2）——mkCampTicker 钳制/缺预算拍与幂等/
  授予节流；mkStampRites kindOf 回落/awardHtml 两分支与 picker 条件渲染、calendarHtml 网格/
  badge 缝/金章阈值；mkParentGate 题面与接线、sparkSvg 数值域与空态、mkSettleBits 时长参数化
  与重挂先清；mkCampShell 生命周期/停止钩子次序/预算访问器/挂屏缝 + pickLine。装载器：vm 缝
  接 rand-core + camp-core + camp-kit 真模块（时钟/定时器/入包/章图标/按钮查询以记录桩注入，
  combat-kit.test.js 同款分层口径）。
- **既有安全网**：boot 冒烟与 math-paradigms 流程断言零改动全绿（camp-kit.js 装载器与脚本序
  断言各 +1 行）；两训练营家族函数名零改动——interface 即测试面。
- **增长账**：914 → 917（T1 +3）→ 919（T2 +2）→ 922（T3 +3）→ **924**（T4 +2），零 fail；
  ESLint/Stylelint/htmlhint 三 lint 零错。

## 遗留与后续钩子

- **连败换路 / onLevelEnd / 今日页不收编**：理由登记见拍板②第三档——存档政策分叉与家族面；
  若未来两家族存档政策统一（unlocked vs frontier），再评估收编 moveOn。
- **FOCUS_STAMP_REWARD_TEXT 位置漂移**：登记不治理（拍板②第三档；math.js:257 注释同款登记）。
- **math-track T5（屏流引擎迁第三插件）与本候选无依赖**：camp-kit 不碰 MathTrack 本体——世界轨
  收口经 onStop 停止钩子，驱动器是世界轨家族件（docs/math-track-unification-design.md）。
- **GLOSSARY 词汇债清偿**：本票补「模式面板 kit（ModeKit）」专条（mode-kit.js 头注释自称
  「术语见 GLOSSARY.md」却无词条），与 CampKit 词条相邻宣示两 kit 分工；「专注训练营」「数学
  冒险岛」补 camp-kit 交叉引用。
