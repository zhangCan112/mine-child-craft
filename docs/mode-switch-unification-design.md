# 模式切换收口设计定稿（mode-switch unification）

> 架构治理候选 4（模式切换收口）的拍板记录与交付清单。
> 评审入口：2026-10-24 架构评审（improve-codebase-architecture 流程，HTML 报告）卡 4；
> 相关词条：GLOSSARY「模式注册表（ModeRegistry）」（随票补 MODES 影子句）与随票新收的
> 「切换清场（switchMode 兜底）」（§1.8 判据 3：层的边界规则）；
> 前序挂账：候选 1（训练营壳 camp-kit，docs/camp-kit-unification-design.md）、候选 2（纯函数
> 共享基座，docs/camp-core-unification-design.md）、候选 3（竞技场剥核，
> docs/arena-core-unification-design.md）已就位；
> 切票 C4-T1（1db721b，纯测试票）与 C4-T2（28514a0，行为面保守版）已合入，C4-T3 为本
> 收尾票（拍板记录 + GLOSSARY 终态）。
> 日期：2026-10-25 · 状态：已交付。

## 背景与证据

评审卡 4 指认模式切换路径上的两个无守门风险源，证据各自成链。

**一、MODES 影子清单：漏写静默直到孩子点卡。** d6fa3c0「模式注册表合一」把游玩模式清单
收进 js/mode-registry.js 唯一权威——main.js 的 pages/MODE_CARDS/手写限额文案三份影子全部
改派生（曾出现「文案漏提坦克/下界」的漂移），唯手写 const MODES 因技术限制保留：模式对象
是经典 script 顶层 const（ArenaMode 等），纯数据 registry 反射不到，组合根只能手写接线
（现状 main.js:16-24）。它是注册表外仅存的影子清单。事故链（此前零断言能拦）：注册表加行
（新模式）漏改 MODES → test/mode-registry.test.js 既有七断言（命名约定/卡页按钮在场/脚本
序/儿童时限成员/训练营清单/限额文案/mood）仍全绿 → 用户点新卡 → switchMode 里 MODES[id]
取值 undefined，接着 undefined.init() TypeError（评审时行号 main.js:129）；boot 冒烟只默认
进 arena（main.js init → switchMode('arena')），其余六键探测不到。同构的第二条静默链：
训练营预算——focus/math 的每日预算靠 main.js setupBudgets 手写 defs，漏写时 budget() 返
undefined 被 camp-kit 守卫吞掉 = ticker 静默不入账 + 入口锁永假（不限量），全程无报错。

**二、散装清场：漏写一件，上一场状态渗进新模式。** 切模式的「旧场清哪些」散在各模式
cleanup/init（28514a0 提交正文记账，对 6 岁用户全是不能自愈也不会解释的坏状态）：

- **Mobs.clear() 8 点/4 文件**：arena.js:1201 · nether.js:177/195/341 · tank-range.js:265/401 ·
  adventure.js:1416/1457；
- **Avatar.setItem(PLAYER.heldItem) 复位 5 点/4 文件**（注释三处复制「照下界先例」）：
  nether.js:202/346 · arena.js:1397 · adventure.js:1468 · build.js:515（main.js 的 boot
  组装不计）；
- **投射物清理 6 点/3 文件**：arena.js:1202-1203（手清 arrows 数组）· nether.js:178/196/342
  （netherArrows+netherBalls）· adventure.js:1418/1459（advArrows）；
- **flyMode=false 5 点/3 文件**：nether.js:182/194 · adventure.js:1396 · build.js:390/513。

**历史 bug 考古**——散装清场的漂移史不是杞人忧天，四个实测前科：

- **2f75cff**（传送门实测修复）：enterNether/enterOverworld 补清 nArrows 确立「投射物不跨
  维度」——残留火球曾追进上界把人打死（弹道模拟证实无修复时火球 24 帧内必命中老位置）；
- **8744a74**（世界轨 T1）：摆与搭 stop() 退出清场漏写修复 + boss 世界节离场死路修复——
  退出路径漏清的实测例；
- **c90db65**（阵亡重置战场）：死亡路径漏清的实测例（死亡后无限回基地循环）；
- **f3af18c**（坦克契约矫正）：拍板「钩子常驻 clear」——Tank.clear 只清实体不解除钩子、
  at() 改真快照、model() 单一回落，是本候选契约①的源头。

**两个守恒契约**（兜底时序的硬约束，行号为 28514a0 记账时快照）：

1. **Tank「clear 只清实体不解除钩子」**（tank.js:720-733）：模式钩子（protect/obstacle/
   targeter/onExplode）是会话级接线，tank-range.js:362-367 加载期一次注册；tank-range 自己
   就 cleanup+enterField 双清 → 兜底无条件 Tank.clear() 安全幂等，非坦克模式清空列表是
   零成本空转（常态）。
2. **Mobs/Drops「clear 解除会话回调」**（mobs.js:887-894 解除 onDeath · drops.js:285-291
   解除 onCollect）：adventure init 本就是「先 clear 再重挂」→ 兜底若放新 init 之后会抹掉
   新模式刚挂的回调；放之前则与 init 自清合成幂等多清，无害。

## 拍板决策

**① 方案 C 分解：test-only 先行（风险归零）→ 行为面保守版（只加不删），两票分险。**
两个风险源相互独立：清单漂移是**点卡即炸**的显性故障（与清场无关），散装清场是**渗漏
静默坏**的隐性故障（与 MODES 无关）。合在一票则测试面与行为面混装、回滚粒度粗；拆成
T1 纯测试票（js/ 零改动，先落双道防线）与 T2 行为面票（只加不删，防线已就位再动
switchMode），任一票出问题独立回滚，拍板记录随 T3 收尾。

**② MODES 影子保留+上锁，否决 globalThis.MODE_DEFS 彻底派生化。**
曾评估让 7 个模式文件各自挂 globalThis 键、main.js 循环注册表派生 MODES（影子清零）：
要动全部 7 个模式文件并重做加载序论证（挂键时序），收益边际——漏写事故已被双道防线
提前到 CI：**动态面**（test/boot.test.js boot vm 探针）键集等价 + 每键是对象且 init 可调；
**静态面**（test/mode-registry.test.js 读 main.js 源文本）注册表每个 id 在 MODES 字面量有
对应键行、全部键行集与注册表键集一致（防漏也防影子滋生）。误删任一道另一道仍守；影子
的存留理由（经典 script 顶层 const 无法反射）在 main.js 头注释与两处测试头注释登记。

**③ 兜底五件的选择依据：只收共享引擎层的实体账与跨模式存活的状态。** Mobs/Tank/Drops
是共享模块（实体账归引擎层），Avatar 跨模式存活（手持物会渗场），flyMode 是 voxel.js 的
引擎级飞行态。模式私有物（自管投射物数组/面板/计时队列）**不进兜底**，仍归各模式
cleanup——兜底不是模式 cleanup 的替代，是共享层的单一收口。插入点：clearWorld() 之后、
MODES.cur 落位/新 init 之前，与 Fx.clear/clearWorld 同拍（main.js:131-151 契约注释块即
契约文本；头注释依赖段补清场消费声明——跨文件写 voxel.js 的 flyMode，conventions §2.1
先例：input.js 写 pitch）。

**④ 两契约守恒的时序论证（引 main.js:131-146 契约注释块）。** 契约①保证兜底无条件
Tank.clear() 安全：钩子常驻不解除，非坦克模式清空列表零成本空转（常态）；契约②把兜底
钉死在新 init 之前：Mobs/Drops 的 clear 解除会话回调，放 init 之后会抹掉新模式刚挂的
回调，放之前与 init 自清合成幂等多清。两契约共同锁定插入位——旧 cleanup（模式私有物）→
兜底（共享层五件）→ 新 init（重挂回调/自清）。

**⑤ 保守版只加不删：各模式共性行保留为幂等双保险，去重登记为后续票。** 切一场变
「cleanup 清 → 兜底清 → init 清」三清，五件全部幂等（清空实体数组/解除后由 init 重挂的
会话回调/复位手持物/复位飞行态）。删各模式 cleanup 的共性行是行为面变化（需逐模式论证
私有物/共享物边界），不属收口票领地。

**⑥ arena 私有箭矢数组（arena.js:121 const arrows = []）收编 CombatKit.mkArrows——登记
为后续钩子，不进本候选。** nether/adventure 的投射物已收 CombatKit.mkArrows（C6-T3：
一实例一弹种、弹数组与 geo 缓存自持、clear() 一句），arena 仍手清 arrows 数组。收编是
combat-kit 完成件（弹种配置/命中政策/观感迁移），与本候选的共享层收口正交，留给
combat-kit 后续票。

**⑦ §1.10 升格论证：判据成立，升格形态=「单一出口 + 断言守门」。** §1.10 判据两点：
清单 ≥3 处（或两处已有漂移史）+ 手滑必炸且炸在运行时。散装清场四清单（8/5/6/5 点）均
≥3 处且各有漂移史（2f75cff 残留火球致死 / 8744a74 退出漏清 / c90db65 死亡路径漏清），
手滑=渗漏坏状态炸在运行时——两点全中，前一判据的两个分支还同时满足。路径变体：清单
的权威数据源不是新数据表，而是引擎模块自身的实体账，升格动作是**收口到 switchMode 单一
出口**（消费方不再各自复制清场序），断言面由 boot 的 switchMode 全 id 不抛探针承接（七
模式切换全链每拍都走兜底五连）。MODES 影子上锁同判：d6fa3c0 前的 pages/MODE_CARDS/
手写文案三份影子表达有漂移史（「文案漏提坦克/下界」），手滑=点卡 undefined.init()
TypeError 炸在运行时——双道断言即守门。**不写 ADR**（§1.11）：决策可逆——兜底五连删掉
即回滚，断言删掉只失去守门、无运行时影响；本文件即 -design.md 文档段。

## 交付清单

- **C4-T1**（1db721b，纯测试票）：js/ 零改动，只加测试。test/boot.test.js：引导逻辑提取
  为全文件共享的 boot() 缓存 vm（同文件 test 按声明序同步执行，有状态探针放最后）+
  localStorage 内存最小真件桩（sync.js 双写/预算 migrate 走它，缺席会被 try/catch 吞成
  静默离线降级——修桩不修断言）；+3 test：MODES 影子清单（键集等价——跨 realm 数组先
  展开再 deepStrictEqual；每键是对象且 init 可调）、训练营预算契约（!gated id 在 Budgets
  具备 accrue/flush/blocked，camp-kit 壳真实消费面的最小充分集）、switchMode 全 id 不抛
  （依注册表序切满七个模式 + MODES.cur 落位，尾探针不恢复现场）。test/mode-registry.test.js
  +1 test：MODES 影子清单与表零漂移（静态源文本：每个 id 有键行 `/^ {2}<id>: \w+Mode,$/m` +
  键行集与注册表键集排序后一致）。测试 960 → **964**。负向验证：挖 MODES.tank 键行 →
  两文件 4 处断言红；挖 setupBudgets 的 math defs 行 → boot 预算契约红；均已恢复。
- **C4-T2**（28514a0，行为面保守版）：js/main.js 一处插入（24 行 = 兜底五连 + 契约注释块 +
  头注释依赖段清场消费声明），js/modes/** 与其余 js/ 零改动（只加不删）。测试 **964**
  不变——T1 的 switchMode 全 id 不抛探针自动覆盖兜底路径（每模式切换都走五连），本票
  无需新测试。
- **C4-T3**（本票）：本文件 + GLOSSARY 终态修订——「模式注册表（ModeRegistry）」词条补
  MODES 仅存合法影子与双道断言口径句；按 §1.8 判据 3（层的边界规则）新收「切换清场
  （switchMode 兜底）」词条（置于模式注册表词条之后）：单一收口五件 + 两契约 + 模式私有
  物归属，_Avoid_ 登记两类误用。

## 行为面影响登记（诚实口径）

零可感知差异，逐条登记：

1. **三清幂等**：各模式 init 自带的 clear 变「cleanup 清 → 兜底清 → init 清」，五件全部
   为幂等操作——清空实体数组（Tank.clear 兼清在飞炮弹）/解除后由 init 重挂的会话回调/
   复位手持物（PLAYER.heldItem）/复位飞行态。
2. **boot 首切空转**：首次 switchMode('arena')（MODES.cur=null 无旧场）时五件全空转，
   一样安全。
3. **只加不删**：各模式 cleanup 共性行原样保留为双保险；模式私有物清理路径零改动
   （js/modes/** 本候选零改动）。

## 测试与守门

- **基线**：npm test **964 pass / 0 fail**（960 → 964，+4 test 全在 T1；T2/T3 零新增
  测试）；ESLint / Stylelint / htmlhint 三 lint 零错。
- **双道防线覆盖说明**：动态面三探针互补——键集等价拦漏键与影子滋生、每键 init 可调拦
  空键/坏键、switchMode 全 id 不抛把七模式切换全链（含兜底五连）跑进 CI；静态面不执行
  代码，动态探针被误删后仍守。训练营预算契约钉住第二条静默链（漏写=不入账+不限量）。
- **探针性质**：switchMode 尾探针按声明序放最后一个 test（有状态：init 会重建战场/重挂
  UI，之后 test 进程即退出，不恢复现场——做成，无降级）；boot() 缓存 vm 全文件共享，
  忠实复刻经典 script 共享词法环境。

## 遗留与后续钩子

- **cleanup 共性行去重**（拍板⑤）：三清幂等无害但重复，去重需逐模式论证私有物/共享物
  边界，留给后续票评估。
- **arena 私有箭矢数组收编 CombatKit.mkArrows**（拍板⑥，arena.js:121）：combat-kit 完成
  件（弹种配置/命中政策/观感迁移），不进本候选。
- **MODES 彻底派生化否决理由存档**（拍板②）：globalThis.MODE_DEFS 方案要动 7 模式文件 +
  重做加载序论证，收益边际；双道防线已把漏写事故提前到 CI，「保留+上锁」是成本最优点。
  除非未来模式对象脱离经典 script 顶层 const（改模块化导出），不再评估。
