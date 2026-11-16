# ADR 0012: 镇维度昼夜解冻（town 维度行 `dayCycle:false → true`，PO 亲裁推翻 ADR-0011 决策 1 恒白天）

日期：2026-11-16 · 状态：**已终拍（PO 六点 P1–P6 ask_user 实答 2026-11-16：P1=0.75 标准 · P2=接受月光小镇中间态先行 · P3/P4/P5=按推荐拍 · P6=知会接受；无否决项，逐点见 §7 表末列）· 施工票已立=T-NPC-14 镇昼夜解冻（§6 建议名 T-DAY-01，票落 `.scratch/town-design/tickets/`）**

## 背景

**触发链**：T-NPC-13 §7-c 拍板 **c2 十村民日程入批**（PO ask_user 实答 2026-11-16，非推荐满配项）→ 票面 §7-c2 预警的「日程时钟机制」连锁裁决三候选（①抽象时钟 ②压缩周期 ③开昼夜）→ **PO 选 ③开昼夜**。

**PO 亲裁转录（原话口径，TIDEA-01 先例格式）**：三候选项原文——「真做昼夜循环，日程最自然但是机制大改（恒白天是之前拍板的，要推翻+氛围面牵动）」。即推翻 [ADR-0011](0011-town-dimension-seam-and-entry-transit.md) 决策 1 的 `dayCycle:false` 恒白天拍板。

**合法性**：ADR-0011 增补段（2026-11-15）确立「零机制扩展口径收窄为显式例外、再冒机制类提议逐条呈 PO 裁」——本 ADR 即该裁的落档，先例=TIDEA-01 风车（D1 批，PO 亲裁）。**破例范围护栏=「镇维度昼夜循环」本身**，方案内不夹带其他机制扩展（挡回清单见文末）。

**工程动机**：日程时间轴最自然的来源是真实昼夜——孩子看见天黑就有「村民要回家了」的可读动机。①抽象时钟动机不可读（看不见的时间基准）；②压缩周期（N 分钟=一天）与 dayTime 全局单钟冲突（两套时间流速）且失真——均被 PO 否决。

## 事实底座（2026-11-16 逐条核图，file:line 唯一权威）

1. **dayCycle 是逐维度行字段**：`ADV_DIMS` 行内字段（nether/den/town 各自持有，js/adventure-dims-core.js:706/:719/:732），切界唯一消费点 `advSetDim` 的 `dayCycleOn = drow.dayCycle`（js/modes/adventure.js:2443）；主世界侧 init/切图/回界恒 `dayCycleOn = true`（:4643/:2509/:2472），模式 cleanup 恒 false（:4800）。
2. **主循环是昼夜唯一驱动**：`if (dayCycleOn) { dayTime = Daylight.advance(dayTime, dt); applyDaylight(); }`（js/main.js:400-403）——dayCycleOn 同时闸住「时间推进」与「场景驱动」两件事。
3. **applyDaylight 全链**（js/world.js:176-223）：天色/雾色按 Daylight.skyColor(t, skyBaseDay) 插值（50 tick 量化键）、ambient/sun 光强曲线、云漂移+亮度+显隐、日月轨道+显隐（玩家参照）、顶点光材质 uniforms `uDim=skyDim(0..11)` 与 `uSkyFloor`（dayCycleOn?0:15）。**sun 光强基底 0.75 与 ambient 基底 0.65 硬编码在函数内**（:187-188）。
4. **行 sky 直写 vs 循环插值的冲突**：维度行走 `advApplySky` 直写（color/雾距/sunI，js/modes/adventure.js:1996-2003），主世界图行走 `setSkyBase` 白日端点缝（:2058-2064，昼夜插值只换昼侧锚点）。循环开启后 applyDaylight 每 50 tick 覆写 color/sunI——**循环维度的行 sky.color 必须经 setSkyBase 改道**（雾距不受触，applyDaylight 无雾距写点）。
5. **现网「冻结遗留态」隐患（解冻自然收口）**：天体/云显隐的唯一写点在 applyDaylight 内（sunSprite/moonSprite :203-204、cloudGroup :207），而 advSetDim 维度分支不调它——今天进镇（nether/den/town 任一非循环维度）后天体/云**冻结在上一场遗留态**（可见性不重置，视进镇时刻与相机方位可见冻结日/云）；同理 `uDim/uSkyFloor` 材质档冻结在主世界最后值（黄昏进镇→镇内方块带着黄昏暗档、天却亮白——「恒白天」在材质面软破）。解冻后整链恢复时间一致，无需独立修复票。
6. **镇无怪门禁是维度判据不是光照判据**：update 内 `advDim === 'overworld'` 门禁包住夜怪节拍/巢穴节律/涌出/牧场/繁育/灯笼政策全链（js/modes/adventure.js:4890-4904），den 门禁独立（:4905）；`advSetDim('town')` 切界链自带 `advSceneLeave → advEntitiesClear()` 实体五池清（:2410→:2207），town build 无怪播种——**昼夜解冻对镇无怪零牵动**。
7. **dayTime 全局单钟**：不随图/维度重置（:2488 注释口径），随世界档 payload 持久化（WorldJournal 六键含 dayTime）。**解冻后镇内时间照推世界钟**——docs/town-map-design.md §6.3.4 现文「镇内时间冻结不推进主世界昼夜」语义反转（见决策 3）。
8. **DaylightCore 接口现成**（js/daylight-core.js）：`isNight(t)`〔13000,23000) · `clockPhase(t)` 四段枚举 `{id:'day'|'dusk'|'night'|'dawn', name, icon}`（断点=DIM_KEYS 12040/13670/22330/23961）· `clockLabel` HH:MM（tick 0=06:00）。一日=24000 tick=**20 分钟实时**，夜段〔13670,22330)≈7.2 分钟。
9. **光照 Worker 零牵动**：光照场（sky/block 双通道）计算与时间无关，时间调光走材质 uniforms——区块网格不随时间重建，`serveChunkKey` Worker 协议钉（test/world-vertexlight.test.js:349）与 applyDaylight 节拍钉（:281）不受行翻转影响。
10. **BGM/HUD**：`advMusicMood` 维度行锁 mood（js/adventure-dims-core.js:750-754）——镇内昼夜恒 calm；镇 HUD 走 TIDEA-12 安静档只留镇名牌横幅（js/modes/adventure.js:4584），时段行/怪物行本来就不显示。
11. **测试钉现状**：行值锚 `dayCycle:false` 断言（test/adventure-dims-core.test.js:198）；进镇冻结断言（test/adventure-mode.test.js:4815「镇内昼夜冻结」）与回 home 断言（:4827，值不变、文案随语义改写）——是解冻票要翻的钉面；init/cleanup 昼夜断言（:762-771）不动。

## 决策

### 1. 维度行参数面：town 行 dayCycle 翻正 + sky 参语义改道

**§6.3.3 行规格表逐字段修订对照**（落表动作归施工票 T-DAY-01，本表为权威口径）：

| 字段 | 现值（§6.3.3 定稿） | 解冻后 | 口径 |
|---|---|---|---|
| dayCycle | `false`（时间冻结+天体/云隐藏+基底亮光） | **`true`** | 时间随全局钟推进；天体/云解隐随昼夜；夜间经 uDim/uSkyFloor=0 真实调暗。PO 亲裁③（背景转录） |
| sky.color | 0xa8cbe0 暖亮白天（固定观感承担） | **经 `setSkyBase` 落白日端点** | 循环维度的行色必须走天基色缝，否则每 50 tick 被 applyDaylight 覆写回主世界端点（§2-4）；夜侧端点=Daylight 折线自带月光蓝/深夜蓝，**无新行字段** |
| sky.fogNear/fogFar | 75/200 | **不变**（advApplySky 直写保留） | applyDaylight 无雾距写点（§2-4），雾距是 advApplySky 私产口径（:2005-2011 先例） |
| sky.sunI | 0.92 日光微升 | **降为首帧初值**，循环接管后基底=applyDaylight 硬编码 0.75 | 正午平行光 0.92→0.75（与主世界图一致）；保 0.92 需 world.js 缝加宽（PO 待拍点 P1） |
| mood/build/spawn/hud/assets | — | **不变** | 昼夜不动建场/落点/安静档 HUD/showMobs:false；mood 恒 calm 见 P4 |
| ADV_TOWN 结构常量 | 坐标派生面 | **零连带** | 纯坐标派生引用（TOWN_MAP 权威），昼夜不涉坐标 |

**施工口径（切界序）**：`advSetDim` 维度分支对 `drow.dayCycle === true` 的行——`setSkyBase(行色转 [r,g,b]) → advApplySky(行参=雾距+初值) → dayCycleOn=true → applyDaylight()` 一次（对齐 overworld 分支 :2471-2473 序）。分支内补这一拍同时消除 §2-5 冻结遗留态（白闪遮罩内即完成首帧正确）。hex→[r,g,b] 换算等细节留施工票。回程端点复位零新工：overworld 分支 `advApplyMapPalette` 与 cleanup `advMapRowCleanup` 既有链自动恢复（:2471/:4806）。

### 2. 引擎语义核查结论（解冻后活过来什么、破什么、隔离什么）

- **活过来**：镇内时间推进+每帧 applyDaylight 全链（天色/雾色插值、光强曲线、云、日月轨道、uDim/uSkyFloor 材质档）；dayTime 随世界档照常持久化。
- **破除的隐含假设**（均为解冻红利，非风险）：行 sky 直写会被循环覆写（→决策 1 改道）；§2-5 冻结遗留态家族（天体/云可见性、材质暗档）随链路复活自然消解。
- **隔离确认（零漂移结构保证）**：dayCycle 逐行字段——nether/den 恒 false 不动（恒暗观感来自行上暗 sky 参，口径不变）；overworld init/切图/回界/cleanup 全链不触；光照 Worker 协议与节拍钉零牵动（§2-9）；床时钟/睡窗是主世界专属（镇无床，建场词表 {fill,tree,scrub,recolor,place}）；den 日更窗口走现实日期非游戏钟。

### 3. 氛围受控边界：镇内恒无怪维持（ADR-0011 决策 7 重确认）

- **维持=零代码**：门禁是维度判据（§2-6），昼夜解冻不触碰任何刷怪路径。推荐口径：**夜间观感靠光照/氛围而非威胁**——PO 终拍点 P3。
- **语义反转注记**：镇内时间照推世界钟（§2-7）→ 离镇时可能已入夜，home 东带夜怪为既有主世界机制（夜池/环带节拍照旧），非新机制、首版不做「出镇保温」类处理（那会是新机制，挡回）。知会项 P6。
- **观感面维持**：`hud.showMobs:false` 不变；TIDEA-12 安静档（镇内只留镇名牌）不变、不加时段行（P5）。
- **「镇=安全的地方」儿童叙事（GLOSSARY）优先**：夜间镇=无怪+恒 calm 曲+月光蓝天穹；禁焦虑先例（docs/design/town-entry-transition-visual-spec.md §A）作为夜间观感约束传 light 线。

### 4. 日程时间轴接口缝（只定缝，日程本体归 T-NPC-13 c2）

- **时间源=全局 dayTime 单钟**：不建镇独立时钟、不建抽象钟、不加时间缩放（三者均挡回）。暂停不推进=与全部既有系统同拍（SpinnerCore 先例）。
- **时段枚举=Daylight.clockPhase 四段** `{day|dusk|night|dawn}`（零新枚举、零新常量）；更细锚点（如「傍晚钟塔停驻」）用 tick 常量进 T-NPC-13 行为核参数表——该票域，本 ADR 不预写。
- **日程=纯函数推导**：`f(dayTime) → 各 NPC 航点/legIndex/意图`，无村民级计时器、无新存档字段；巡逻腿推进仍 dt 注入（T-NPC-13 §5.1 既有口径）——位姿层 dt 驱动与日程层钟读数两层互不污染。
- **节奏约束（传 T-NPC-13 排期用）**：一日=20 分钟实时、夜段≈7.2 分钟——日程锚点需在此节奏内可观察（设计约束，非本 ADR 决策项）。
- 「傍晚钟塔停驻」预留指针（T-NPC-13 §5.1 因恒白天不入首版）自本 ADR 落地起激活，归 c2 面排期。

### 5. 夜间观感面：本 ADR 只圈边界不定义观感

- 解冻票（T-DAY-01）**不含任何夜间美术件**——灯柱/窗光/街灯/夜端点暖化全归 light 线另票（T-LIGHT）。
- **中间态口径**：氛围票落地前，镇夜=月光蓝天穹+环境光残量+无怪+calm 曲=「安静的月光小镇」，诚实观感非破相——PO 终拍点 P2。
- 镇翻新 light 定稿是白天档（午后暖阳 sky 档3/0xa8cbe0）；夜档定稿权归 light 线设计，含是否需要夜端点暖化缝（引擎微缝，届时不夹带、另呈）。

### 6. 拆票建议与波次

| 票 | 面 | 成本级 | blocking edges |
|---|---|---|---|
| **T-DAY-01 镇昼夜解冻**（引擎/维度行层，票名建议、终名归需求线） | town 行 dayCycle 翻正+注释改写；advSetDim 循环行 setSkyBase 改道+分支内 applyDaylight 一拍；钉测翻新（adventure-dims-core.test.js:198、adventure-mode.test.js:4815/:4827 文案）；docs/town-map-design.md §6.3.3 行表/§6.3.4 昼夜配合段/:168 主态注记/§6.3.6 取代记录加行；GLOSSARY「小镇维度」词条改写（恒白天→随世界钟昼夜） | **S**（行级翻转+一缝改道+文档债） | 上游=本 ADR 决策 7 终拍；下游=解锁 T-NPC-13 c2 面与 T-LIGHT |
| **T-LIGHT 镇夜间氛围**（light 线另票） | 窗光/街灯/（可选）夜端点暖化缝——视觉方案由 light 线出 | **M** | 依赖 T-DAY-01（对着真夜调参） |
| **T-NPC-13 c2 面**（票已在册） | 13 单航点扩多航点日程+日程时钟消费 | **M-L**（需求线已立票） | 硬边=本 ADR 决策 7 终拍 + T-DAY-01 落地；**a2/b1 面已开工不受本 ADR 阻塞** |

**排序**：T-DAY-01 先落——与 T-NPC-13 a2 面（已开工）同文件不同段（advSetDim 段 vs update 镇民段），行级小票先行降冲突面；案卷修复批已收口，无遗留冲突。波次：T-DAY-01 →（T-LIGHT ∥ T-NPC-13 c2）。

**T-DAY-01 验收锚**：进镇日/夜两态天色端点正确（白日=暖亮端点、夜=月光蓝）、回 home 端点自动复位、天体/云随昼夜走（冻结遗留态消除）、镇内恒无怪回归钉全绿、主仓与既有昼夜钉（world-vertexlight 两钉）零漂移。

### 7. PO 待拍点清单（终拍汇总，scrum-master 转 PO）

**终拍结果（2026-11-16 relay ask_user 实答）**：P1–P6 全按推荐/确认通过，**无否决项**；本 ADR 随之定稿，施工票已立=T-NPC-14 镇昼夜解冻（§6 建议名 T-DAY-01，票落 `.scratch/town-design/tickets/T-NPC-14-town-day-cycle-unfreeze.md`）。

| # | 点 | 推荐 | 备选及其成本 | PO 终拍（2026-11-16） |
|---|---|---|---|---|
| P1 | 正午平行光基底 | **0.75 标准**（与主世界图一致，零缝改动；PO 实屏后验可调） | 保 0.92 暖阳=world.js applyDaylight 的 sun 基底参数化（缝加宽，微成本，参数级补票） | **拍 0.75 标准**——applyDaylight 硬编码不动、world.js 零改；实屏后验若调，参数级补票另呈 |
| P2 | 夜间观感中间态 | **接受机制票先行**（月光小镇诚实观感，c2 日程早解锁） | 压到 T-LIGHT 齐交付才上解冻（c2 阻塞拉长） | **拍接受机制票先行**——月光小镇诚实中间态；c2 日程早解锁，氛围归 T-NPC-15 后调 |
| P3 | 镇内恒无怪 | **维持**（夜间靠光照/氛围非威胁；零代码） | ——（开夜间怪违儿童叙事，属挡回域非选项） | **拍维持**（零代码——门禁是维度判据，昼夜解冻结构零牵动） |
| P4 | 镇 BGM 夜间 | **恒 calm**（维度行锁 mood 现状，零改动） | 夜间换曲=音频线补曲另票 | **拍恒 calm**（零改动；夜间换曲归音频线届时另票） |
| P5 | 镇 HUD | **安静档维持、不加时段行**（TIDEA-12 PO 拍板方向） | 加时段行=逆 TIDEA-12 方向，微成本 | **拍安静档维持、不加时段行**（零改动） |
| P6 | 知会项（非选点） | 镇内时间照推世界钟——离镇可能入夜（home 夜怪为既有机制） | PO 若有异议→回本 ADR 重议出口策略 | **知会接受**——首版不做「出镇保温」；日后再议走 ADR 重议出口 |

## 挡回的替代方案

- **①抽象时钟 / ②压缩周期**：PO 三候选裁决中已否决（动机不可读 / 两套时间流速失真），落档不再议。
- **保持恒白天**：被本 ADR 取代（PO 亲裁③）。
- **镇夜间刷怪/威胁化**：违「镇=安全的地方」儿童叙事（GLOSSARY 优先考量）——挡回，不作 PO 选项。
- **镇独立时钟/时间缩放**：违 dayTime 全局单钟既有口径（:2488）与 nether/den 冻结先例——挡回。
- **「出镇保温」（离镇时刻不受镇内逗留影响）**：新机制，超破例范围——挡回（P6 知会后 PO 仍坚持才重议）。
- **夜端点暖化缝/保 0.92 缝加宽/夜间换曲/时段行**：**不挡回也不随票夹带**——分别归 P1/P4/P5 待拍或 T-LIGHT 届时另呈，拍了才动。

## 后果

- **正面**：日程动机自然可读（天黑=村民回家的可见因果）；§2-5 冻结遗留态家族随解冻消解；T-NPC-13「傍晚钟塔停驻」等预留指针激活；镇获得时间厚度（日出/日落/星空巡访各有时味）。
- **代价**：镇夜间中间态（T-LIGHT 落地前街道偏暗，P2）；离镇可能入夜（P6）；四处文档/钉测修订债由 T-DAY-01 一票收口（§6.3.3/§6.3.4/§6.3.6/GLOSSARY/两测试钉）。
- **不可逆性：低**——行字段翻回 false 即回恒白天（文档/钉测同步回翻即可）；T-NPC-13 c2 落地后回退将牵动日程语义（届时重估，登记在案）。

## 证据与关联

- 被修订对象：[ADR-0011](0011-town-dimension-seam-and-entry-transit.md) 决策 1（dayCycle:false 行规格）·决策 7（本 ADR 决策 3 重确认）·增补段（破例先例格式出处）。
- 机制规格权威：[docs/town-map-design.md](../town-map-design.md) §6.3.3 行规格表 / §6.3.4 氛围受控（昼夜配合段随 T-DAY-01 改写）。
- 引擎链核图（本 ADR §2，2026-11-16）：js/main.js:400-403 · js/world.js:53/:66-81/:176-223 · js/modes/adventure.js:1996-2003/:2058-2064/:2395-2483/:2443/:4890-4911/:4570-4605 · js/adventure-dims-core.js:698-754 · js/daylight-core.js。
- 测试钉：test/adventure-dims-core.test.js:192-209 · test/adventure-mode.test.js:762-771/:4815/:4827 · test/world-vertexlight.test.js:281/:349（后两钉零漂移确认）。
- 票务：`.scratch/town-design/tickets/T-NPC-13-behavior-patrol.md`（§7-c 拍板与 c2 连锁预警）· T-NPC-13-DECISION-RELAY.md（PO 拍板回执）。
- PO 亲裁链：scrum-master 通报 2026-11-16（三候选呈报）→ ask_user 实答选③（本文背景转录）。
