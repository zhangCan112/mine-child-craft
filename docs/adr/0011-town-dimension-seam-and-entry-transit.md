# ADR 0011: 小镇以 `ADV_DIMS` 维度行接入冒险模式（主路尽头白闪过场），撤独立模式入口

日期：2026-11-14 · 状态：**已采纳**（PO 2026-11-13 现场拍板）· **取代 [ADR-0009](0009-town-standalone-mode.md)**

## 背景

PO 2026-11-13 指令（原文见 `.scratch/handoffs/2026-11-13-urgent-po-change-detach-town-entry.md`）：「村庄我看到了，但是我希望村庄是冒险模式里的，他应该是目前小镇那条路过去的地方。去掉单独的村庄入口，把小镇接入冒险模式。」——ADR 级 seam 变更，两拍板：① 进入体验=维度过场式（白闪变体复用，小镇氛围受控）；② 落点=现有冒险地图（home 图）主路尽头。

[ADR-0009](0009-town-standalone-mode.md) 决策 1（城镇以独立 `town` 模式接入：`MODE_REGISTRY` 行 + `index.html` 卡/页/script + `js/modes/town.js`，**不**向 `ADV_DIMS` 新增城镇维度行）被本变更推翻；其施工产物 T-MAP-01..04 与 T-PREFAB 全线蓝图/core 工件经停工令明文**保留不回滚**（蓝图件与场景装配逻辑与新缝正交）。

机制规格定稿：[`docs/town-map-design.md` §6.3](../town-map-design.md)（触发线几何 §6.3.1／维度行规格 §6.3.3／氛围受控 §6.3.4／回程裁定 §6.3.5／旧拍板取代记录 §6.3.6／恒开放政策 §8 M9）。视觉定稿：[`docs/design/town-entry-transition-visual-spec.md`](../design/town-entry-transition-visual-spec.md)。事实底座（坐标/file:line 唯一权威）：`.scratch/town-seam-change/research-map-facts.md`。

## 决策

1. **town 维度行接入（取代独立模式缝）**：`ADV_DIMS`（`js/adventure-dims-core.js:480-506`）新增 `town` 行，逐字段按 §6.3.3 行规格表落——id `'town'`／build=城镇装配件链闭包（`townAssemblyOps(townBuildSteps())` 逐 op 经 `townConsumeOp`，即现 `townBuild()` 本体）／sky 暖亮白天四参／mood `'calm'`／**`dayCycle:false`（固定明亮白天）**／spawn `{x:79,y:25,z:112,yaw:0}` 派生自 `TOWN_MAP.anchors`／hud `{banner:'🏘️ 小镇 · Midport Village', showMobs:false}`／assets `null`。配套 **ADV_TOWN 结构常量**（新维度施工单口径，`docs/dimension-registry-design.md` §6）：坐标唯一权威仍是 TOWN_MAP（GLOSSARY「城镇地图核心」），ADV_TOWN 只派生引用、**不抄第二份坐标**；`ADV_FURN_PREFIX` 加 `town` 键（`js/modes/adventure.js:2238`，守门测试锁）。三条全局判据（pos 不进档／死亡单分支／ADV_SCENE_KEYS 派生）自动跟随零新分支。引擎语义注意：`dayCycle:false` = 时间冻结+天体/云隐藏+基底亮光，**≠ 恒夜**（nether/den 的暗夜观感来自行上暗 sky 参）；town 暖亮 sky 参 + dayCycle:false 即恒白天，零机制扩展。**维度行没有 gates 字段**——town 挂门会破「维度是相位不是生态图」的行结构纪律（回程裁定已避开，见决策 4）。
2. **到达面扩展（本缝唯一机制增量）**：`advVeilArrive`（`js/modes/adventure.js:2660-2697`）现 kind='edge' 到达只认 ADV_MAPS 图行——扩展分流：**to ∈ ADV_MAPS 行 → advSetMap（现状不动）；to ∈ ADV_DIMS 行 → advSetDim（新增分支；den 分流 `js/modes/adventure.js:2665-2669` 同文件先例）**。新增分支必须落在 map 路径守卫之前——现网 `:2686-2687` 的 `!row`（town 不在 ADV_MAPS）与 `row.id === advMap`（town 维度期间 advMap 冻结在 home，回程 to='home' 会命中「已在该图」）两守卫都会静默吞掉本缝到达，这是施工必须避开的实证坑。配套数据两项是**必需件非可选**：`ADV_EDGE_DIR_MAP` 加 `east:'town'` 键（`js/adventure-maps-core.js:508-511` 现无 east 键）+ `ADV_HOME_EDGE_GATES` 加 east 锚（`js/adventure-maps-core.js:609-615` 现三向锚、east 无）——回程 `advHomeArriveGate('town')` 来向反查依赖此键，缺它回落南锚=错误落点（GLOSSARY「传送门阵」兜底口径）。来向取值口径：`advVeilFire` 的 from 取 `advMap`（`js/modes/adventure.js:2654`），维度期间 advMap 不动，镇侧发令须以来向场景 id（维度态读 `advDim` 或显式带 from，施工二选一）喂反查，验收锚=从镇内越线回 home 落 east 锚。到达播报按 den 分支先例在分支内定值（「到小镇啦！」／「回到家啦！」沿用 `:2695-2697` 现成句式），**不给 ADV_DIMS 行加 name 字段**（行契约保持 `docs/dimension-registry-design.md` §2 纯净；视觉 spec §A.4 的「维度行 name 建议」就此收口）。
3. **去程触发线与恒开放政策**：east 分支落 `advEdgeTransitDirAt`（`js/adventure-core.js:832-841` 现状「east 恒 null」处），判据 `x ≥ 157 且 z ∈ [74,75]`（轴向带式——「走到路尽头才触发」，与既有三向全缘行判据形状不同、与翻越彩蛋天然分流）；开放政策=**恒开放**（`advEdgeOpenDir` east 短路开放，`js/adventure-core.js:824-830`，收口现状「east 查表得 undefined→false 恒锁」派生面 `js/adventure-maps-core.js:519-521`），承接旧小镇卡 `gated` 行「随时可去」语义（§8 M9，PO 已拍板）。**无任何条件开放分支**：不挂任务解锁键（q16 解锁链不动、east 不进 `ADV_UNLOCK_KEYS`）、不设时段窗、不做渐进解锁——途中再冒条件开放类提议一律按拍板挡回。近前引导区 east 维持恒 null（`advEdgeHintAt` 零改动），引导话术层零改动。东带收编四条随去程票落：门口开间（z74~75 栅栏让位的建场几何增量）／告示牌语义「小镇建造中→小镇由此去」（形制位置不动，拼块图案归 UI 资产票）／隔离带+剪影维持远景／翻越彩蛋维持现状。栅栏保护拒绝话术随票改稿（`js/modes/adventure.js:2979` 现句「小镇还没盖好呢」与随时可去矛盾，替换文案以视觉 spec §B.4 定稿为准）。
4. **回程裁定=双向边缘白闪（无门件）**：镇侧挂壳层 town 维度分支（「不进表」清单惯例，`docs/dimension-registry-design.md` §5；早退链=冷却/白闪中同款纪律），触发线 `z ≥ 132（任意 x）` 南向镇口带式——z132=核心区南界（z127）外 5 格缓冲，南彩蛋带（z94~127）整段在线北零误触；缓冲格数是防误触参数可微调、判据形状不变。白闪发令 `advVeilFire({to:'home', kind:'edge'})` 复用现成白闪变体整链（0.4s×2／0.8s 冷却／满格同步切／portal_travel 音）。裁定理由四条（§6.3.5）：① PO 拍板语言对称——白闪进、白闪出，孩子只学一条规则；② 观感语义纪律——「紫=地图门语义、白=大地让开语义」（GLOSSARY「白闪变体」），门件把紫调危险相位语言带进祥和镇口；③ 零新件+行结构纪律——门件方案需 advPortalFrame 几何+门包围盒查表，且 gates 字段是 ADV_MAPS 行数据，维度行没有 gates 字段；④ 6 岁体验——无站桩、无需找门、与既有三向边缘传送同款心智模型。
5. **撤独立模式缝三件套（停用→收尾节拍撤除）**：`index.html:95-99` 小镇卡 + `js/mode-registry.js:32` town 行 + `js/modes/town.js:143-151` 模式壳（`TownMode = mkMode({id:'town', init})` 三步链 `loadScene→townInteractBoot→requestLock`）。撤除触发 `MODE_REGISTRY` 三重命名测试面（AGENTS.md 硬规则；精确断言行号施工以 `npm test` 红点为准）。**撤除时点=收尾节拍**：镇维度全链（注册/去程/回程/交互宿主）验绿后才原子撤除——任何中间态不出现「无入口可进镇」；同节拍完成装配件迁移（决策 6）与 GLOSSARY 词条改写债随行（§6.3.6 登记：不提前改词条防名实不符）。儿童时限语义自动保持：进镇改走探险模式内维度相位后，时限随探险模式共享（GLOSSARY「儿童时限」，下界同口径），无独立时限面、无新账本。
6. **salvage 边界与悬空点裁定**（本 ADR 终裁四项）：
   - **a. townInteractBoot/townTargets 宿主=adventure 壳 town 分支**（`js/modes/town.js:126` 模式态、`:132-135` boot，T-MAP-04 产物）：按「不进表」清单惯例挂壳层——先例=den 副本状态机（update 门禁 `advDim==='den'`、`advSetDim` 内 den 专属步 `advDenT` 复位+`advDenSeed` 首刷，设计稿 §5）；进镇建机（`advSetDim('town')` 专属步）/离镇弃机（下次进场新机不串轮）。不选 town 维度专属装配：交互运行态是玩法语义，不进注册表文件（D4 红线：表只收纯数据+build 闭包，不设生命周期钩子）。此裁定给 T-UI-01 定锚：HUD 挂点语境=adventure 壳维度态 chrome（横幅已由行上 `hud.banner` 承担）；T-UI-05 走查起点=主菜单进冒险→主路→白闪进镇全程 adventure 壳。
   - **b. salvage 装配件落点=迁 `adventure-dims-core` 维度段**（D8 同构：维度建场住 dims-core）：`js/modes/town.js` 六纯装配件——`TOWN_PHASE_ORDER:37`／`townYawOfFace:42-51`／`townSpawnIntent:56-60`／`townAssemblyPhases:65-72`／`townConsumeOp:81-108`（op 执行器=引擎触点唯一面）／`townBuild:114-120`——机械迁 dims-core 维度段（nether=`advNetherBuild`、den=`advDenBuild` 同栖先例，ADV_DIMS 表上方维度段邻位）；不选「留原文件由 build 闭包跨文件消费」：技术可行（闭包体调用期解析），但撤壳后 `js/modes/town.js` 文件身份错位——「模式壳」名实消亡后残留非模式文件违「一文件一模块、文件名即模块索引」纪律，且词条改写债（TownMode→「小镇维度」立新词）落地后旧文件名成持续误导。迁移连带：`js/town-map-core.js` script 加载位上移至 `adventure-maps-core.js` 之后、`adventure-dims-core.js` 之前（ADV_TOWN 加载期派生读 TOWN_MAP，nether/den 先例口径）；`test/town-mode.test.js` 断言随迁并入 `test/adventure-dims-core.test.js`（同名单测约定：函数住哪文件测试住哪同名文件），该测试文件随撤卡节拍退场。
   - **c. 镇口件首版不入 TOWN_MAP 九段**：机制面不依赖此件（town 侧触发线全带宽 `z≥132` 无走错面）；回程视觉引导已由视觉定稿 §B.5 镜像渐稀铺装+路口轻提示语言覆盖，无需「栅栏开间+告示牌」重件镜像；TOWN_MAP 九段是已交付布局权威，新缝首版不夹带蓝图增量（「蓝图件与新缝正交」纪律的反向运用）。镜像叙事诉求留档：若 PO 走查后想要，走蓝图数据增量票（现成件复用、增量入 TOWN_MAP 数据、机制零动），登记不派。
   - **d. T-MAP-01..04 已交付工件逐件处置**：T-MAP-01（`js/town-map-core.js`+test）**保留+升格**——TOWN_MAP 九段直接成为 town 维度 build 的布局权威，ADV_TOWN 派生引用之；T-MAP-02（模式骨架三件套+`js/modes/town.js` 最小可进场）**撤除**（本 ADR 决策 5 撤卡三件套即其产物撤除票；装配意图「出生面向广场/可回望钟塔」由维度行 build 闭包继承，台账标记历史工件）；T-MAP-03（`js/town-assembly-core.js` 规划器+材质映射）**保留+转用途**——`townAssemblyOps(townBuildSteps())` 被维度 build 闭包原样消费；T-MAP-04（`js/town-interact-core.js` 的 `mkTownTargets`）**保留 core+转宿主**——core 文件与同名单测原样不动，宿主接线随决策 a 迁 adventure 壳 town 分支，T-UI 线消费面不变（「T-UI 票只换 emit 实现，不改机器」）。
7. **氛围受控=零新分支**：`advDim === 'overworld'` 门禁（`js/modes/adventure.js:4650-4663`）已包住巢穴节律/夜怪节拍/涌出/牧场/繁育全链，`advSetDim('town')` 切界自带实体五池清（`:2281-2283`），town build 无怪播种=镇内恒无怪；`hud.showMobs:false` 是观感面。施工自查项（逐池复核维度判据）与昼夜配合注记按 §6.3.4。

## 挡回的替代方案

- **保留 ADR-0009 独立模式缝**：PO 明令撤除，挡回。
- **回程走镇口门件**（nether/den 门件口径）：§6.3.5 裁定 (b)——紫调地图门语义进镇口／需破维度行无 gates 字段纪律／站桩 2 秒是反向摩擦，挡回。
- **给 ADV_MAPS 伪装 town 图行**（不动到达面扩展、复用 advSetMap）：污染地图行的池/门/生态数据契约并迫使壳分支膨胀（ADR-0009 决策 4 同款理由），挡回。
- **条件开放变体**（任务链解锁挂 east／时段窗／渐进解锁）：违恒开放拍板（§8 M9），一律挡回，不留分支。
- **装配件留 `js/modes/town.js` 由 build 懒闭包跨文件消费**：决策 6b 论证，挡回。
- **发明第三套转场系统**：违「不发明新机制」设计纪律（§6.3 前言——新缝全部由「边缘传送」「触发线」「白闪变体」「维度规格」四词条现成件拼装），挡回。

## 后果

- 正面：与冒险「同一世界连续旅行」的产品叙事成立（孩子沿主路走到尽头白闪进镇）；进镇输入/时限/HUD/存档判据全部继承 adventure 壳现成链（镇内输入体验与探险统一）；机制增量收敛为到达面一处分流+两向触发线判据+两个数据键，无新机制、无新系统；旧缝工件零回滚，T-UI 预排资产大部分正交存活。
- 代价：`js/modes/town.js` 全文件退场（装配件迁 dims-core、壳作废），GLOSSARY「小镇漫步」等词条需随撤卡节拍改写；`index.html`/`js/mode-registry.js`/`mode-registry.test.js` 三重命名测试面随撤卡红点驱动；镇维度坐标与 home 坐标是两套独立系（无格位映射，维度切换=整场景重建——伪问题不立项）。
- 不可逆性：中——独立入口撤除后回退需重建模式三件套与入口卡（工件历史可考但属新工程）；维度行接入使 town 进入 ADV_SCENE_KEYS 派生面（桶键/showroom/decode 兜底自动跟随），回退需逐一摘除。采纳后不以「复用注册表行」为由回退本决策；后续分歧回退需求线澄清。

## 证据与关联

- 机制规格（权威）：[`docs/town-map-design.md` §6.3](../town-map-design.md)（含 §6.3.6 旧拍板取代记录——本 ADR 是其第 3 行「新 ADR 由 architect 出」的兑现）。
- 视觉定稿：[`docs/design/town-entry-transition-visual-spec.md`](../design/town-entry-transition-visual-spec.md)（§A 白闪过场/TTS 双播报/禁焦虑清单；§B 路径引导/告示牌改读/回程预案）。
- 事实底座：`.scratch/town-seam-change/research-map-facts.md`（researcher 核图 2026-11-13，坐标/file:line 唯一来源）。
- 被取代对象：[`docs/adr/0009-town-standalone-mode.md`](0009-town-standalone-mode.md)（状态已改注记，正文保留历史语境）。
- 票务承载：[`docs/town-architecture-design.md` §13](../town-architecture-design.md)（新缝施工单 T-SEAM-01..05／撤卡节拍／salvage 裁定表／需求线残留处置）。
- 维度注册表契约：[`docs/dimension-registry-design.md`](../dimension-registry-design.md)（§2 行字段契约／§5 不进表清单／§6 新维度施工单；D8 维度词汇随迁先例）。
- PO 指令与停工令：`.scratch/handoffs/2026-11-13-urgent-po-change-detach-town-entry.md`（不回滚边界原文）。
- 既有 seam 先例：[`docs/world-edge-map.md`](../world-edge-map.md)（T8 拍板与东向观感收尾的取代注记）· [ADR-0010](0010-town-prefab-ingest-and-material-authority.md)（蓝图 sole authority——TOWN_MAP/PrefabKit 工件保留的契约依据）。
