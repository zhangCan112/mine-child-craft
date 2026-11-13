# 架构变更需求简报：小镇入口缝变更（town 维度行 + 到达面扩展）——交 architect

> 派令链路：PO（2026-11-13）→ scrum-master（urgent note）→ 需求线回炉（本文=回炉产物之一）。
> 上游权威：机制规格定稿 **docs/town-map-design.md §6.3**（本文只做架构需求摘要与指针，规格细节以 §6.3 为准）。
> 事实底座：**.scratch/town-seam-change/research-map-facts.md**（researcher 核图 2026-11-13，全部坐标/file:line 引用的唯一来源）。
> 分区边界：机制/几何/触发判定/维度注册/回程/氛围受控/文档骨架=需求线（§6.3+本文）；视觉/色彩/音效/TTS 话术/图标/过场时序体感=ui-designer（docs/design/town-entry-transition-visual-spec.md，并行产出中）。
> 本文不 commit，由 analyst-manager 统一提交。

## ① 新缝定义（ADR 级 seam 变更三件事）

1. **ADV_DIMS 新增 town 维度行**（docs/dimension-registry-design.md §6 新维度施工单口径）：
   行规格逐字段见 town-map-design.md §6.3.3 表——id:'town'／build=城镇装配件链闭包
   （townAssemblyOps(townBuildSteps()) 逐 op 经 townConsumeOp，即现 townBuild() 本体）／
   sky 暖亮白天四参／mood:'calm'／**dayCycle:false（固定明亮白天）**／spawn 派生自
   TOWN_MAP.anchors（79,25,112 面北）／hud{banner, showMobs:false}／assets:null。
   两处引擎语义注意（设计时易踩）：
   - **dayCycle:false ≠ 恒夜**——它是「时间冻结+天体/云隐藏+基底亮光」（world.js:174-207
     applyDaylight tick0 白天观感+uSkyFloor 满档）；nether/den 的暗夜观感来自它们行上的
     暗 sky 参，不是字段本身。town 暖亮 sky 参 + dayCycle:false 即恒白天，零机制扩展。
   - **维度行没有 gates 字段**——门查表 advGateAt 读 ADV_MAPS 行数据；town 作维度行挂门
     会破「维度是相位不是生态图」的行结构纪律（回程裁定已避开，见 ④）。
   配套：**ADV_TOWN 结构常量**（坐标唯一权威仍是 TOWN_MAP，ADV_TOWN 只派生引用、不抄
   第二份坐标）；ADV_FURN_PREFIX 加 town 键（守门测试锁）；三条全局判据（pos 不进档/
   死亡单分支/ADV_SCENE_KEYS 派生）自动跟随零新分支（§6.3.3）。
2. **主路尽头 edge 到达面扩展（唯一机制增量）**：advVeilArrive 的 to 现只认 ADV_MAPS
   图行（js/modes/adventure.js:2686-2693）——扩展分流：「to ∈ ADV_MAPS → advSetMap
   （现状不动）；to ∈ ADV_DIMS → advSetDim（新增；den 分流 :2665-2669 同文件先例）」。
   配套数据两项是**必需件非可选**：ADV_EDGE_DIR_MAP 加 east:'town' 键
   （js/adventure-maps-core.js:508-511 现无 east 键）+ ADV_HOME_EDGE_GATES 加 east 锚
   （:609-615 现三向锚 east 无）——回程 advHomeArriveGate('town') 来向反查依赖此键，
   缺它回落南锚=错误落点（GLOSSARY「传送门阵」兜底口径）。
3. **撤独立模式缝三件套**（停用，撤除实现随新 ADR 节拍）：index.html 小镇卡
   （index.html:95-99）+ js/mode-registry.js town 行（:32）+ js/modes/town.js 模式壳
   （mkMode 三步 init 链 :143-151）。撤卡触发 MODE_REGISTRY 三重命名测试面
   （AGENTS.md 硬规则；test/ 断言精确行号 research §六.6 未逐条核，施工以 npm test 红点为准）。

## ② ADR-0009 待新 ADR 取代（变更动因）

- **PO 原话+两拍板**：全文见 urgent note `.scratch/handoffs/2026-11-13-urgent-po-change-detach-town-entry.md`
  （「ADR 级 seam 变更」定性原文在其 :4；PO 原话 :8；停工令与不回滚边界 :12-14）。
  两拍板：① 进入体验=维度过场式（白闪变体复用，小镇氛围受控）；② 落点=现有冒险
  地图主路尽头（home 东带主径）。
- **被取代的旧拍板三条**（含原位置 file:line 的取代记录表）：
  town-map-design.md **§6.3.6**——east 恒无传送语义 / 小镇本体 out of scope /
  ADR-0009 决策 1「不向 ADV_DIMS 新增城镇维度行」。
- 新 ADR 建议承载点（需求线视角，终稿归 architect）：town 维度行 + 到达面扩展 +
  撤卡三件套 + 回程双向边缘白闪裁定 + 「蓝图件与新缝正交」的 salvage 边界。

## ③ salvage 提示（回收面由 architect 裁，本文只供料）

- **js/modes/town.js 151 行拆解**（research §3.1 全表）：**纯装配件 6 件**——
  TOWN_PHASE_ORDER(:37)／townYawOfFace(:42-51)／townSpawnIntent(:56-60)／
  townAssemblyPhases(:65-72)／townConsumeOp(:81-108，op 执行器=引擎触点唯一面)／
  townBuild(:114-120)——预计可整体转为 town 维度行 build 装填（§6.3.3 的 build 字段
  即按「townBuild 本体=闭包」写）。落点两候选由 architect 裁：迁 adventure-dims-core
  维度段（vocabulary 随迁先例 D8）／留原文件由 build 闭包跨文件消费（加载序与模块
  归属定去留）。
- **模式壳三步作废**：TownMode=mkMode({id:'town',init}) 的
  loadScene→townInteractBoot→requestLock 接线（:143-151）随卡撤除作废；输入流/
  requestLock 归 adventure 壳现成链（顺带收获：镇内输入体验与探险统一）。
- **交互机宿主悬空（需 architect 定）**：townInteractBoot/townTargets（:126、:132-135，
  T-MAP-04 产物）的宿主随模式壳撤除而悬空——镇内交互（HUD/指针/对话框，T-UI 面）
  在维度形态下的挂载点两候选：adventure 壳 town 分支（「不进表」清单惯例）或
  town 维度专属装配。T-UI-01..05 briefs 的接缝句子引用旧缝文件名（research §四
  逐票盘点），受损度归 UI 设计工复核。
- **保留面（停工令明文，不回滚）**：T-MAP-01..04／T-PREFAB 全线蓝图与 core 工件
  （js/town-map-core.js／js/town-assembly-core.js／js/town-interact-core.js 等）保留
  （urgent note :13）——蓝图件与场景装配逻辑与新缝正交；TOWN_MAP 九段直接成为
  town 维度 build 的布局权威（单份权威纪律见 §6.3.3）。

## ④ 氛围受控与回程机制（规格指针）

- **氛围受控=零新分支**：`advDim==='overworld'` 门禁（js/modes/adventure.js:4650-4663）
  已包住夜怪/涌出/巢穴/牧场全链，advSetDim 切界自带五池清（:2281-2283），town build
  无怪播种=镇内恒无怪；hud.showMobs:false 是观感面。施工自查项（逐池复核维度判据）
  与昼夜配合注记：town-map-design.md **§6.3.4**。
- **回程机制已裁定：双向边缘白闪**（无门件）。裁定理由四条：PO 拍板语言对称／
  「紫=地图门语义、白=大地让开语义」观感纪律（GLOSSARY「白闪变体」）／零新件+
  维度行无 gates 字段的结构纪律／6 岁无站桩体验。两侧几何：town 侧触发线
  `z≥132`（南向镇口带式，核心区南界外 5 格缓冲防 P2 彩蛋带误触）；home 侧
  ADV_HOME_EDGE_GATES 加 east 锚（门口内侧 2.5 格面西，探针实测取值，约 (154.5,75)）。
  完整几何与理由：town-map-design.md **§6.3.5**。
  **ui-designer 协调注记**：ui-designer 按「双向边缘白闪」倾向出视觉预案并注记依赖
  本岗——本岗终裁与倾向一致，**无需返工协调**。

## ⑤ 入口过场/路径引导 UI 规格指针（分区契约）

- 视觉/色彩/音效/TTS 话术/图标/过场时序体感=ui-designer 域：
  **docs/design/town-entry-transition-visual-spec.md**（并行产出中，文件名契约已定）。
- 机制侧已保证的槽位：白闪 kind='edge' 现成参数链（GLOSSARY 词条权威：0.4s×2/
  0.8s 冷却/满格同步切/portal_travel 音）；到达播报句式槽位（「到小镇啦！」/
  「回到家啦！」现成分流，js/modes/adventure.js:2695-2697）；TTS/toast 现成缝。
- 旧入口卡产物受损面：T-UI-00 产物（docs/design/town-ui-entry-tokens.md）引用面
  坐落独立入口缝（research §5.3），entry-hud-spec §3（入口卡章）同——重定义归
  ui-designer；docs/README.md 城镇族行已加变更注记。

## ⑥ 触发线几何与东带收编口径（引 research 事实块）

- **去程触发线**：`x≥157 且 z∈[74,75]`（主径轴向门口开间带式判据，落
  advEdgeTransitDirAt east 分支）；栅栏线 x157／主径 z74~75／告示牌 x156／剪影钟楼
  z74 的同轴事实块=research-map-facts.md **§1.3【主路尽头事实块】**（逐字引用面）。
- **东带收编四条**：门口开间（z74~75 栅栏桩/横杆让位，建场几何增量）／告示牌语义
  「小镇建造中→小镇由此去」（形制位置不动）／隔离带+剪影维持远景（「建造中」叙事
  退役）／翻越彩蛋维持现状（与入口 z 轴带判据天然分流，零机制改动）。
- **开放政策默认=恒开放**（town-map-design.md §8 M9）：承接旧小镇卡「随时可去」；
  近前引导区 east 恒 null 零改动。几何与收编全文：town-map-design.md **§6.3.1**。

## 需求线残留（不阻塞施工单，登记在案）

1. mood:'calm' 曲目若 AudioRegistry 无现成键→补曲归音频资产线（§6.3.3 mood 行注记）。
2. visit_town 到达记账可选（发现型 T8 惯例，工程线裁量）；任务链不挂 town（引导链
   v2 十五步不动）。
3. 镇口件（回程视觉地标，镜像 home 东带门口件）=可选蓝图增量，归 architect 裁是否
   入 TOWN_MAP 九段（§6.3.5）；机制面不依赖此件。
4. MODE_REGISTRY 三重命名测试断言精确行号未核（research §六.6），施工以 npm test 为准。
5. showroom 对 town 桶的显式引用未核（research §六.7）——按 ADV_SCENE_KEYS 派生先例
   （D7）判断自动跟随，施工时验证。

—— business-analyst · 产出 2026-11-14（PO 拍板 2026-11-13）；不 commit，由 analyst-manager 统一提交
