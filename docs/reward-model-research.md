# 奖励数值设计模型研究（reward-model-research）

> 研究型文档：为「专注训练营」的关卡掉落奖励设计（幅度随难度递增、总产出受控、可被后续带奖励模式复用）收集一手来源依据。
> 红线背景：儿童游戏零惩罚、不做付费、不做抽卡赌博化。本文只整理证据与可操作建议，不改代码。

---

## 1. 研究问题与背景

本游戏是面向 6 岁儿童的 Minecraft 风格体素注意力训练游戏：「专注训练营」（每日限 6 关 / 20 分钟）产出物品进入跨模式共享背包，「探险模式」消耗物品（合成 / 烧炼 / 耐久）。研究三个问题：

1. 奖励幅度随进度 / 难度递增时，应选什么曲线（线性 / 多项式 / 指数 / 边际递减 / S 曲线 / 有界渐近）；
2. 如何用产出预算（per-session / per-day 期望值）控制跨模式经济通胀；
3. 面向儿童的外在奖励（掉落物）如何校准才不侵蚀内在动机、不滑向赌博化。

---

## 2. 奖励递增曲线模型对比

一手教材：Ian Schreiber《Game Balance Concepts》免费在线课程（2010，
<https://gamebalanceconcepts.wordpress.com/>）。曲线数学主要在 Level 2（Numeric Relationships，
<https://gamebalanceconcepts.wordpress.com/2010/07/14/level-2-numeric-relationships/>）；
进度与奖励节奏在 Level 7（Advancement, Progression and Pacing，
<https://gamebalanceconcepts.wordpress.com/2010/08/18/level-7-advancement-progression-and-pacing/>）。
付费扩充版为 Romero & Schreiber《Game Balance》(CRC Press 2021, DOI: 10.1201/9781315156422)。

| 曲线 | 定义 | 适用场景 | 参数取法与注意 | 来源 |
| --- | --- | --- | --- | --- |
| 线性 | `R(n) = a + b·n`，每关增量恒定 | 短进度条（6 关/日）的底座：可预测、总量天然 = `6a+15b`，预算好算 | Schreiber：线性/恒等关系是「换算率恒定」的最简关系；两个三角关系叠加会抵消成线性（Baldur's Gate 案例），说明「等级成本递增 + 单怪经验递增」最终应校准成近线性的时间收益 | Schreiber L2 |
| 三角数（多项式，超线性） | 增量本身线性递增：1,3,6,10,15…（第 n 次增量 = n） | 「奖励幅度逐级递增」的默认首选：既明显递增又远慢于指数 | Schreiber 原文："Triangular numbers usually make a pretty good first guess for increasing costs"；注意任何公式在数学极端处会崩坏，**必须配硬上限**（"set hard limits on the formula"） | Schreiber L2 |
| 指数 | 每级 ×k（如翻倍：1,2,4,8,16） | 超长进度条（MMO 等级成本），且必须同步配指数级产出才不失控 | Schreiber 警告："numbers get prohibitively large very quickly… be very, very careful when using exponentials"；CCG 里几乎所有印着「双倍」的卡都超模。本项目每日仅 6 关，指数曲线几关内就会把日预算炸穿，**不建议** | Schreiber L2、L3 |
| 边际递减（对数型） | 增量随 n 递减；重复同一内容收益越来越低 | 反刷屏 / 重复玩已通关卡时的收益衰减（"bulk discount"是同一数学） | Schreiber 把「递减关系」用于批量折扣；FarmVille 案例指出后期"reward loop rewards you less and less frequently"是社交游戏自然收尾手段。可用于：当日第 4~6 关若重复低难度内容，掉率回落 | Schreiber L2、L7 |
| S 曲线（logistic） | 慢启动→快速爬升→饱和 | 理论上适合「新手保护期 + 中期爬升 + 后期封顶」 | **未找到免费教材单列章节**（付费书第 4 章 "The Components of Progression—Curves" 未开放）。可用「前段线性 + 中段三角数 + 硬上限」组合近似实现，不必引入新公式 | 见左侧说明；实现方式依 Schreiber L2 |
| 有界渐近（bounded） | `R(n) = R_max·(1-e^(-kn))` 或分段封顶，单调递增但有上限 | **本项目核心需求**：奖励随进度递增但总产出受控 | Schreiber 的通用解是给任何递增公式**设硬限制**（如封顶件数），而不是发明新公式；FarmVille 的无限升级 + 奖励频率衰减是「软封顶」变体 | Schreiber L2、L7 |

**儿童游戏参数建议（依 L7）**：

- 节奏："offer new levels or areas on a slightly increasing curve"——新内容 / 大奖的间隔**轻微递增**，前期密、后期疏；
- 颗粒度："many little gains produce a lot more happiness than one big gain"——多次小奖励优于一次大奖励（同总量下）；
- 奖励过密同样有害（"giving too many rewards can also be hazardous"），会稀释后续成就感；
- 时长："young kids need short games to fit their attention span"——短会话 + 每日上限本身符合儿童注意力特征；
- 设计方法：**从终点倒推**——先定末期想要的状态（如"第 6 关期望产出 = X"），再倒着推每一关的数值（Schreiber L2 结尾的等级曲线校准法）。

---

## 3. 产出预算与通胀控制手法

### 3.1 期望值（EV）台账：把掉落当成本曲线来管

Schreiber L3（Transitive Mechanics and Cost Curves，
<https://gamebalanceconcepts.wordpress.com/2010/07/21/level-3-transitive-mechanics-and-cost-curves/>）的核心方法可以直接迁移：
用电子表格做「单列 = 数值收益 − 成本」的台账，逐项检查是否超预算。迁移到本游戏即：

- 每关掉落期望值 `EV(n) = p(n) × 掉落表价值(n)`，`Σ EV(1..6) ≤ 每日预算`；
- 台账里同时记探险模式的消耗速率（合成 / 烧炼 / 耐久），产出 / 消耗比就是跨模式经济的「通胀表」；
- 调参出偏差时**宁弱勿强**："it is better to make an object too weak than too strong"——奖励偏弱只是该模式吸引力不足，奖励过强会直接压垮探险经济（同文）。

### 3.2 每日上限的先例：EndeavorRx 的剂量锁定

EndeavorRx（FDA 首个获批的儿童 ADHD 数字疗法游戏）在 FDA De Novo 审批摘要（DEN200026，
<https://www.accessdata.fda.gov/cdrh_docs/reviews/DEN200026.pdf>）中明确：

- 处方剂量 ≈ **25 分钟/天、每周 5 天**，软件在 "lock-out after the allocated gameplay"——**用硬锁屏而不是靠孩子自觉停止**；
- 游戏体验 "leverages art, music, storytelling, and reward cycles to keep patients engaged"，即奖励循环是**维持参与**的工具，治疗剂量由会话锁控制。

本游戏「每日 6 关 / 20 分钟」与该先例同构：日上限是第一道产出闸门，关卡内曲线是第二道。

### 3.3 水龙头 / 下水道（faucet / sink）与通胀

- 虚拟经济治理的系统论述见 Lehdonvirta & Castronova《Virtual Economies: Design and Analysis》(MIT Press, 2014,
  <https://mitpress.mit.edu/9780262027250/virtual-economies/>)：产出（faucet）必须配消耗（sink），否则货币 / 物品存量单调上升、价格体系通胀。早期学术一手：Castronova "On Virtual Worlds", Game Studies 3(2), 2003,
  <https://www.gamestudies.org/0302/castronova/>（虚拟世界货币超发与 sink 治理论述）。
- 本游戏已有天然 sink：探险模式的合成消耗、烧炼燃料、工具耐久。预算公式的正确写法是**以 sink 速率定 faucet 上限**（如"训练营日产出 ≤ 探险模式日均消耗的 k 倍以内"），而不是拍一个绝对数。
- Schreiber L3 另警告持久游戏的「力量通胀」（escalation of power）：任何版本都做不到完美平衡，**新增奖励宁可偏慢偏弱**，让通胀是"slow and gradual process"。

### 3.4 「奖励预算占经济总量百分比」的惯例数值

**未找到可靠一手来源**给出「训练模式产出应占全游戏经济 X%」的行业惯例数值（Schreiber 课程、EndeavorRx 文件、虚拟经济教材均无此类百分比）。建议：把 `k = 日常产出/日常消耗` 当作内部调参变量，初值取保守（如 0.8~1.0，即产出略低于消耗，存量缓慢下降，靠里程碑奖励补足），上线后用背包净增数据校准——这是**推导建议，非来源结论**。

---

## 4. 儿童教育 / 训练游戏的奖励校准

### 4.1 外在奖励 × 内在动机：效应量速查

| 奖励形态 | 对内在动机的影响（Cohen's d，自由选择行为指标） | 来源 |
| --- | --- | --- |
| 意外获得（事前不知情）的实物奖励 | **≈ 0 无害**（d = 0.01，不显著） | Deci, Koestner & Ryan 1999 |
| 期望获得的实物奖励（总体） | 侵蚀（d = −0.36；实物总体 d = −0.34） | 同上 |
| 「做了就给」（engagement-contingent） | 侵蚀（d = −0.40，儿童受害更重） | 同上 |
| 「做完就给」（completion-contingent） | 侵蚀（d = −0.36；去极值后 d = −0.44） | 同上 |
| 「表现好才给」且并非人人拿满 | **最危险**（d = −0.88，全表最大损害） | 同上（2001 综述转引） |
| 言语 / 信息型正反馈 | 增强（总体 d = +0.33；大学生 +0.43；**儿童仅 +0.11 不显著**） | 同上 |
| 信息型风格（肯定能力） vs 控制型风格 | +0.66 vs −0.44 | 同上 |
| 无任务关联的奖励 | 无显著影响（d = −0.14，ns） | 同上 |

关键文献：

- Lepper, Greene & Nisbett (1973). Undermining children's intrinsic interest with extrinsic reward. *JPSP, 28*(1), 129–137. DOI: 10.1037/h0035519。3~5 岁儿童，预期拿奖状组后续自由玩耍时间显著少于「意外拿奖状」与「无奖」组（后两组无差异）。**边界条件**（原文 Discussion）：效应只在「儿童本来就有兴趣 + 奖励是多余的」时出现；对低初始兴趣活动，代币奖励能有效启动参与（token-economy 证据），且建议只在弱手段无效时使用。
- Cameron & Pierce (1994). Reinforcement, Reward, and Intrinsic Motivation: A Meta-Analysis. *Review of Educational Research, 64*(3), 363–423. DOI: 10.3102/00346543064003363。结论：总体上奖励不降低内在动机；言语表扬提升；唯一负面是「预期实物奖励、仅仅做了就给」的小幅损害。
- Deci, Koestner & Ryan (1999). A meta-analytic review… *Psychological Bulletin, 125*(6), 627–668. DOI: 10.1037/0033-2909.125.6.627（128 项实验）。指出 C&P 1994 方法缺陷（混入奖励仍在生效期的测量等）；上表数字均出此。
- Deci, Koestner & Ryan (2001). Extrinsic Rewards and Intrinsic Motivation in Education. *Review of Educational Research, 71*(1), 1–27（<https://www.selfdeterminationtheory.org/SDT/documents/2001_DeciKoestnerRyan.pdf>）。教育场景综述：**实物且有条件的奖励对学龄儿童损害显著大于大学生**；损害在停奖一周后仍可测得，非短暂现象。

**对本项目的安全 / 危险形态结论**：

- 安全：① 关卡**完成后的即时庆祝**（惊喜层，模拟"unexpected"）；② 明确的能力信息反馈（"这一关你连续对了 8 个"——informational 风格，d = +0.66）；③ 基础产出保底（人人可得满，绝不搞只有前 X% 能拿的阶梯）。
- 危险：① 把掉落物做成「进训练场就发」的参与津贴（engagement-contingent，d = −0.40）；② 预期中的大额物质奖励直接挂在「完成」上且幅度醒目（completion-contingent，且儿童组更敏感）；③ 按表现排名发放差额奖励（d = −0.88，最危险形态，同时违反零惩罚红线——拿不到即是隐性惩罚）。
- Schreiber L7 从设计侧给出同向结论：随机奖励必须**挂在孩子的主动行为上**（"far more powerful to reward the player because of their deliberate action"），否则会稀释真实成就感。

### 4.2 儿童认知训练产品的实践参数

- **EndeavorRx**：见 §3.2。两点对设计最重要：① 奖励循环用于**维持参与**，临床驱动力是自适应难度引擎（SSME）；② STARS-ADHD 随机对照试验里，**对照组刻意复刻了 EndeavorRx 的奖励与参与设计但去掉自适应算法**，主要终点改善弱于治疗组（FDA De Novo 摘要转述；临床试验：Kollins et al. 2020, *Lancet Digital Health, 2*(4), e168–e178, DOI: 10.1016/S2589-7500(20)30017-0）。→ 奖励研究里「有奖励无难度调控」被当作安慰剂级设计，说明奖励只是放大器，不是训练本身。
- **自适应难度的最新证据**：JMIR 2026 年对 EndeavorRx 类数字疗法的 RCT 二次分析（*Association Between Task Difficulty Regulation in Game-Based Digital Therapeutics and ADHD Symptoms in Children*，
  <https://games.jmir.org/2026/1/e83932>）："adaptive algorithms should prioritize the stabilization and personalization of task difficulty rather than implementing uniform or progressively increasing difficulty schedules"——**奖励递增应挂在「个体化稳定爬升的难度」上，而不是全局均匀调高**。
- **K-CPT（Conners Kiddie CPT）**：未找到公开的奖励 / 反馈数值设计参数。K-CPT 是 4~5 岁注意力**诊断测验**，公开文献面向临床计分而非游戏奖励设计，无可引用的掉落 / 奖励参数。如实说明：**未找到可靠一手来源**。

### 4.3 变率强化（variable ratio）：力度与节制

- 一手：Ferster & Skinner (1957). *Schedules of Reinforcement*. Appleton-Century-Crofts（全文 PDF：
  <https://www.bfskinner.org/wp-content/uploads/2015/05/Schedules_of_Reinforcement_PDF.pdf>）。变率程序维持**高而稳定的反应率、停顿最少、消弱抵抗最强**——这正是它危险的原因：Skinner 本人在 1953 年即指出它与赌博机制同构。
- 赌博红线证据：Drummond & Sauer (2018). Video game loot boxes are psychologically akin to gambling. *Nature Human Behaviour, 2*(8), 530–532, DOI: 10.1038/s41562-018-0360-1——22 款游戏的战利品箱中 10 款满足全部 5 条赌博心理学标准，且指出变率强化是老虎机的核心机制；Zendle & Cairns (2018, *PLOS ONE* 13(11): e0206767) 发现战利品箱消费与问题赌博相关。
- 应用行为分析（ABA）的节制建议：强化程序要**逐步稀释**（schedule thinning），稀释过快会导致行为反弹（Hagopian, Boelter & Jarmolowicz (2011). Reinforcement Schedule Thinning Following Functional Communication Training: Review and Recommendations. *Behavior Analysis in Practice, 4*(1), 4–16）。
- **对儿童掉落设计的转译**：变率掉率可以用（本项目正是 p=0.45 的变率），但必须 ① 概率对家长透明；② 加**保底 / 干燥计时器**（长期不出稀有则必出——Schreiber L7 明确背书这种做法："having it deliberately give a big reward if the player hasn't seen one in a while"）；③ 每日次数有硬上限（EndeavorRx 锁定先例）；④ 绝不与付费耦合（Drummond & Sauer）。

---

## 5. 材料稀缺性分层参照：Minecraft 矿石案例

数据来源：minecraft.wiki《Ore》页（1.18+ 分布表，
<https://minecraft.wiki/w/Ore>）与《Ore (feature)》页（生成参数，
<https://minecraft.wiki/w/Ore_(feature)>，Java 版数据）。

| 矿石 | 生成参数（矿簇尺寸 × 每区块尝试次数） | 高度范围 | 稀缺手段（叠加使用） |
| --- | --- | --- | --- |
| 煤 | 17 × 20（三角分布）+ 30 ×（高处均匀带） | Y 0~320，实测峰值约 Y=45~96 | 无——量大面广，新手第一小时就能见到 |
| 铁 | 4 × 10（-64~72 均匀）+ 9 × 10（三角）+ 90 ×（山地三角带） | Y -64~72、80~320 | 多频次、遍布全高度；量中 |
| 铜 | 10 × 16（三角） | Y -16~112 | 中层限定 |
| 红石 | 8 × 4（均匀）+ 8 ×（深层三角） | Y -64~15 | 深层限定 |
| 金 | 9 × 4（三角）+ 埋藏小簇 + 恶地专属大簇 | 主带 Y -64~32（恶地例外至 256） | 深层限定 + 群系例外通道 |
| **钻石** | **4 × 7**（三角）+ 埋藏变体 | **Y -64~16，Y=16 以上不生成，实测峰值 Y=-59** | **四重叠加**：只出现在最深层 + 矿簇最小之一 + 每区块次数少 + `discard_on_air_exposure = 0.5`（**一半暴露在洞穴空气中的矿簇直接不生成**——必须主动挖） |
| 绿宝石 | 3 × 100（三角） | 山地群系限定 | 群系门控（长线目标） |
| 远古残骸 | 3 × 1~2（scatter） | 下界 Y 8~24 | 需钻石镐；全游戏最稀缺 |

分层逻辑总结（作为跨模式经济的参照）：

1. **高价值 = 晚出现**：钻石被深度门控（Y≤16），玩家必须先攒铁镐、挖穿浅层——进度门控的天然形态；
2. **高价值 = 少出现**：矿簇尺寸（4 vs 煤 17）与尝试次数（7 vs 20）同时压低；
3. **高价值 = 藏起来**：暴露空气丢弃概率 0.5，杜绝"顺路捡到钻石"；
4. **工具门槛**：钻石需铁镐、远古残骸需钻石镐——上一档产出是下一档的钥匙，形成产出→消耗→解锁链（正好复用探险模式的合成 / 耐久 sink）；
5. **例外通道**：恶地的金、山地的绿宝石——高价值物在特定"群系"（对应我们的特定高难度关卡）少量集中出现，做长线目标。

---

## 6. 对本项目的可操作建议

1. **掉落曲线用「保底线性底座 + 三角数难度加成 + 硬性日封顶」三段式**，即
   `EV(n) = base + step·T(n)（封顶于 EV_max）`，n 为关卡序号/难度档，`Σ EV(1..6) ≤ 每日预算`。
   依据：三角数是递增成本首选初值 + 任何递增公式必须设硬上限（Schreiber L2）；「轻微递增曲线」节奏（Schreiber L7）。
2. **以探险消耗定产出闸门**：建 faucet/sink 台账，令训练营日产出 ≤ 探险日均消耗的 k 倍（k 初值保守取 ≤1，上线后按背包净增校准）；调参宁可偏弱——奖励过强会压垮消耗侧经济。
   依据：Schreiber L3（成本曲线台账、「宁弱勿强」、力量通胀需缓慢）；Lehdonvirta & Castronova 2014（faucet/sink）。百分比惯例数值：未找到一手来源，k 为内部推导变量。
3. **高价值物品按「钻石模式」投放**：只在最高难度档出现、掉率显著低、且对当日前几关不可见（进度门控），必要时叠加坡度门槛（如需要先用掉落物合成某个钥匙类物品）。依据：minecraft.wiki Ore/Ore (feature) 数据页（分层 + 隐藏概率 + 工具门槛 + 群系例外通道）。
4. **奖励形态：庆祝在完成之后，反馈指向能力，而非「进场费」**：每关保底产出（人人可得满）+ 完成瞬间的庆祝演出（惊喜层）+ 信息型能力反馈（"你连续答对 N 个"）；绝不做按表现排名的差额奖励。
   依据：Lepper 1973（预期奖励损害、意外奖励无害）；Deci, Koestner & Ryan 1999/2001（engagement-contingent d=−0.40、儿童更敏感、非满额表现奖励 d=−0.88 最危险、信息型 +0.66）；Schreiber L7（奖励挂在主动行为上）。
5. **变率掉率 + 保底干燥计时器 + 每日硬上限，概率对家长透明，永不付费化**；难度（及挂在其上的奖励幅度）做**个体化稳定爬升**而非全局均匀调高。
   依据：Ferster & Skinner 1957（变率反应率最高、消弱抵抗最强）；Hagopian et al. 2011（程序稀释需渐进）；Drummond & Sauer 2018（变率随机奖励与赌博同构，儿童产品红线）；Schreiber L7（干燥期后必给大奖的设计背书）；EndeavorRx FDA DEN200026（25 分钟/日锁定剂量先例）；JMIR 2026（稳定化/个体化优先于均匀递增）。

### 复用性提示

以上 1、2、5 条与具体模式无关：任何新增带奖励模式只需登记 `{基础EV, 难度曲线参数, 每日封顶, 稀有档门槛}` 四元组进共享预算台账，即可纳入同一套通胀治理——数值模型可收敛为一个共享模块 + 各模式注册行的结构（与仓库 `-registry` 惯例一致；具体工程化属后续设计文档范围）。

---

## 参考来源总表

**游戏设计教材 / 课程**

1. Schreiber, Ian. *Game Balance Concepts* (2010), 免费在线课程.
   L2 Numeric Relationships: <https://gamebalanceconcepts.wordpress.com/2010/07/14/level-2-numeric-relationships/>
   L3 Transitive Mechanics and Cost Curves: <https://gamebalanceconcepts.wordpress.com/2010/07/21/level-3-transitive-mechanics-and-cost-curves/>
   L7 Advancement, Progression and Pacing: <https://gamebalanceconcepts.wordpress.com/2010/08/18/level-7-advancement-progression-and-pacing/>
2. Romero, Brenda & Schreiber, Ian. *Game Balance*. CRC Press, 2021. DOI: 10.1201/9781315156422（付费，本文仅以免费博客版为一手依据）。

**动机心理学**

3. Lepper, M. R., Greene, D., & Nisbett, R. E. (1973). Undermining children's intrinsic interest with extrinsic reward: A test of the "overjustification" hypothesis. *Journal of Personality and Social Psychology, 28*(1), 129–137. DOI: 10.1037/h0035519
4. Cameron, J., & Pierce, W. D. (1994). Reinforcement, Reward, and Intrinsic Motivation: A Meta-Analysis. *Review of Educational Research, 64*(3), 363–423. DOI: 10.3102/00346543064003363
5. Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin, 125*(6), 627–668. DOI: 10.1037/0033-2909.125.6.627
6. Deci, E. L., Koestner, R., & Ryan, R. M. (2001). Extrinsic Rewards and Intrinsic Motivation in Education. *Review of Educational Research, 71*(1), 1–27. <https://www.selfdeterminationtheory.org/SDT/documents/2001_DeciKoestnerRyan.pdf>

**强化程序与赌博化边界**

7. Ferster, C. B., & Skinner, B. F. (1957). *Schedules of Reinforcement*. New York: Appleton-Century-Crofts. 全文 PDF: <https://www.bfskinner.org/wp-content/uploads/2015/05/Schedules_of_Reinforcement_PDF.pdf>
8. Hagopian, L. P., Boelter, E. W., & Jarmolowicz, D. P. (2011). Reinforcement Schedule Thinning Following Functional Communication Training: Review and Recommendations. *Behavior Analysis in Practice, 4*(1), 4–16.
9. Drummond, A., & Sauer, J. D. (2018). Video game loot boxes are psychologically akin to gambling. *Nature Human Behaviour, 2*(8), 530–532. DOI: 10.1038/s41562-018-0360-1
10. Zendle, D., & Cairns, P. (2018). Video game loot boxes are linked to problem gambling. *PLOS ONE, 13*(11), e0206767.

**儿童数字疗法产品**

11. FDA De Novo 分类摘要 DEN200026（EndeavorRx）. <https://www.accessdata.fda.gov/cdrh_docs/reviews/DEN200026.pdf>
12. Kollins, S. H., et al. (2020). A novel digital intervention for actively reducing severity of paediatric ADHD (STARS-ADHD): a randomised, controlled trial. *The Lancet Digital Health, 2*(4), e168–e178. DOI: 10.1016/S2589-7500(20)30017-0
13. Association Between Task Difficulty Regulation in Game-Based Digital Therapeutics and ADHD Symptoms in Children: Secondary Analysis of a Randomized Controlled Trial. *JMIR (Serious) Games*, 2026;6(1):e83932. <https://games.jmir.org/2026/1/e83932>
14. K-CPT 奖励设计参数：未找到可靠一手来源（诊断工具，公开文献面向临床计分）。

**虚拟经济**

15. Lehdonvirta, V., & Castronova, E. (2014). *Virtual Economies: Design and Analysis*. MIT Press. <https://mitpress.mit.edu/9780262027250/virtual-economies/>
16. Castronova, E. (2003). On Virtual Worlds. *Game Studies, 3*(2). <https://www.gamestudies.org/0302/castronova/>
17. 「奖励预算占经济总量百分比」的行业惯例数值：未找到可靠一手来源。

**Minecraft 数据**

18. minecraft.wiki《Ore》（1.18+ 矿石分布表）. <https://minecraft.wiki/w/Ore>
19. minecraft.wiki《Ore (feature)》（生成参数：矿簇尺寸 / 尝试次数 / 高度 / 暴露丢弃概率）. <https://minecraft.wiki/w/Ore_(feature)>
