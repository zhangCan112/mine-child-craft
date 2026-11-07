# T8 施工方案 · 边缘传送机制 + 解锁判定 + 回程门挪边（world-edge-t8-plan）

> 票：[docs/world-edge-tickets.md](world-edge-tickets.md) T8（blocked-by T7 T6 已全 closed）｜方案设计师产出，供主会话审查后编排实施。
> 依据：总账拍板 5/6/8（[world-edge-map.md](world-edge-map.md)）· T7 Resolution 交接①② · T6 修订 v2 · T1 调研（[mc-world-border-research.md](mc-world-border-research.md)）· 既有机制代码现状（门阵站桩/渐晕链 `js/modes/adventure.js` advVeil/advPortalTick · 传送门段 `js/adventure-core.js` ADV_PORTAL/advPortalFrame/advInPortal/advPortalExit · 解锁判定 `js/adventure-maps-core.js` advMapUnlocked/advMapArriveAt · T7 政策段 advEdgeProtectedAt/advEdgeProtectedZone · 碰撞钳制面 `js/voxel.js` physics L369-379 世界边缘隐形墙 · 音色表 `js/audio-registry.js`）。
> 总原则：**机制 ≠ 新造**。传送复用渐晕整链（kind 分流）、冷却复用 ADV_PORTAL.cd、解锁判定复用 advMapUnlocked、清场重建复用换图 loadScene 链；T8 新增的只有**判据纯函数**（触发线/引导区/方向映射）、**解锁派生层**（进度驱动）与**回程门挪边的落位数学**。

---

## 1. 挂账收集（逐条核对来源）

### 1.1 票面四件事（T8 Question）

| # | 挂账 | 来源 | T8 动作 |
| --- | --- | --- | --- |
| A1 | 越线瞬间传送（触发线贴现有碰撞钳制面，白闪 overlay 300~800ms+音效，冷却沿用下界门 0.8s 先例防抖） | T8 Question | 落 T8-A（触发线判据 + 壳 tick + 白闪/音效/冷却选型） |
| A2 | 未解锁走到屏障=挡住+话术（引导回任务，不传送） | T8 Question | 落 T8-B（物理挡住已成立，补近前引导话术+西带软屏障口径） |
| A3 | 远征图回程门挪到面向 home 的那条边缘（雪原图=南缘、沙漠图=北缘、沼泽图=东缘，落点=回程门内侧 2.5 格面朝图内，沿用 advPortalExit/advMapArriveAt 口径） | T8 Question | 落 T8-C（ADV_MAPS 常量+face 感知落点+x 平面门变体） |
| A4 | 解锁判定复用 advMapUnlocked 不绕过；相关政策纯函数进 adventure-maps-core/adventure-core（可单测），壳只装配 | T8 Question | 落 T8-B 派生层 + T8-D 纯函数清单 |

### 1.2 T7 交接两条（T7 Resolution）

| # | 挂账 | T8 动作 |
| --- | --- | --- |
| B1 | ①`advSetEdgeBarriersHidden` 现为单一开关缝（URL `?edgeUnlocked=1` 走查参数驱动；政策判据三向受其门控、东向恒保护）——本票把驱动源换成解锁进度时，清场重建按新参数走（t7-plan §5 R6：与既有换图重播机制同构零新机制） | 落 T8-B：两层开关设计——`advEdgeBarriersHidden` 降级为**强制全开调试缝**（URL 参数保留走这个，见拍板 Q5），新增 `advEdgeDirUnlocked(dir, counts)` 纯函数派生层（方向→图→advMapUnlocked，**分向解锁**）；清场重建走 loadScene 复用链（§2 T8-B） |
| B2 | ②屏障拒绝话术占位已挂四向（挖掘分向三条+东栅栏一条原文+放置通用一条，js 内注释标 R8），称谓与终稿归本票话术过目环节（北 spec §6「雪崩堆」称谓失准待按雪山脊新形态改词） | 落 T8-B：T8 新占位（近前引导分向 + 解锁让开播报）与 T7 占位**同归 G3 话术过目环节**批量定稿；「雪崩堆」称谓改词一并销项 |

### 1.3 总账拍板（world-edge-map.md 拍板记录）

| # | 拍板 | T8 约束 |
| --- | --- | --- |
| C1 | 拍板 5 方向分配：北=雪原、南=沙漠、西=沼泽、东=小镇 | 触发线方向映射唯一权威 `ADV_EDGE_DIR_MAP = {north:'snow', south:'desert', west:'swamp'}`（east 无键=无传送语义的自文档表达） |
| C2 | 拍板 6 触发=越线立即传送，无站桩；白闪+音效掩护（下界门「瞬间+0.8s 冷却」是仓库先例） | 边缘传送**不走** advGateHold 站桩，判据命中即 advVeilFire；冷却复用 ADV_PORTAL.cd=0.8（AC 传送门段常量，advVeilFire 已写） |
| C3 | 拍板 8 解锁判定保留：未解锁的边，过渡带中段被自然屏障挡住+话术引导回任务；回程门保留为唯一回家路且挪到面向 home 的边缘；边缘传送落点=对应回程门旁 | A2/A3 全覆盖；回程门=回家唯一通道（站桩 2s 语义不动——map「Out of scope」明确门阵站桩语义改造不做） |

### 1.4 T1 调研约束（mc-world-border-research.md）

| # | 结论 | T8 约束 |
| --- | --- | --- |
| D1 | 边界墙借形不借罚：伤害红屏不搬，零惩罚 | 越线不传送时零伤害零推搡，只有话术；白闪是「到达仪式」不是警告 |
| D2 | 雾=渲染边界是官方口径；穿雾地标要大件深色 | 西带雾带维持（解锁态雾减半有 spec 依据，见 §2 T8-B）；东向剪影已定稿不动 |
| D3 | 6 岁口径：全屏突变要渐进、忌纯黑 | 白闪复用 #portalVeil 渐晕元素（css 已是径向渐变+幼儿口径注释），白色变体忌纯白刺眼、时长 ≤ 拍板区间上限 |

---

## 2. 机制设计分解

> 落点文件缩写：AC=js/adventure-core.js · AMC=js/adventure-maps-core.js · ADV=js/modes/adventure.js · CSS=css/style.css · TEST=test/{adventure-core,adventure-maps-core,adventure-mode}.test.js。
> 共同红线（每项默认遵守）：①确定性建场（零 Math.random， SceneKit.rand 盐；解锁态/锁定态两次建场各自逐字节一致）；②零新贴图格位（西带解锁步道用既有泥 2/苔石 14/水）；③老档零迁移（counts 缺省=全锁，行为与 T7 现状一致）；④不触碰 T2~T5 定稿观感件的行为（西带解锁态替换是 west-spec §4.3 定稿内容，非新观感）；⑤注释里的「T7/T8/§2.3」票号多为旧 tracker（冒险地图设计稿）编号，与 world-edge 票号同名不同义，新注释一律写〔世界边界·T8〕避免混淆。

### T8-A · 越线传送触发线 + 传送链装配 规模 M

- **触发线几何**：贴现有碰撞钳制面。证据：voxel.js physics 的世界边缘隐形墙把玩家中心钳在 `[PLAYER.hx, WORLD_W−PLAYER.hx] × [PLAYER.hz, WORLD_D−PLAYER.hz]`（hx=hz=0.2，config.js PLAYER 段）——玩家中心**物理可达的最近位置**就是钳制面；「中心进入最外一行格」（floor 坐标 === 0 或 === 尺寸−1）与「贴钳制面」等效，且是纯整数比较。备选「带远端某条线」（如南带 z150）被否：带远端之外还有丘原/深水段地形，触发线内移会造成「还没走到世界尽头就被传送」的观感断裂，且与拍板 6「越线」字面不符。
- **判据纯函数**（AC 边界政策段新增，与 advEdgeProtectedAt 同段）：
  - `advEdgeTransitDirAt(x, z) → 'north'|'south'|'west'|null`：`z < 1 → 'north'；z ≥ WORLD_D−1 → 'south'；x < 1 → 'west'；x ≥ WORLD_W−1 → null（东向无传送——T5 定稿收尾语义，栅栏彩蛋跳缝进 x158~159 条带不触发）`。角区检序北→南→西→东取先，与 advEdgeSkyAt 的 cand 检序同源（NE 走查定稿的同款裁定）。判据只答几何，解锁判定分离（可分维测试）。
- **解锁派生层**（AMC 政策纯函数段 + AC 缝）：
  - AMC：`ADV_EDGE_DIR_MAP = {north:'snow', south:'desert', west:'swamp'}`（挨着 ADV_UNLOCK_KEYS）；`advEdgeDirUnlocked(dir, counts)` 纯函数 = `advMapUnlocked(ADV_EDGE_DIR_MAP[dir], counts)`——**复用不绕过**，home 恒开语义/缺键全锁语义自动继承。
  - AC：`let advEdgeUnlockCounts = null` + `advSetEdgeUnlockCounts(counts)` 唯一写入口（advSetEdgeBarriersHidden 同款缝模式；壳 init 注入 `ADV.quest.counts` **引用不复制**——任务链原地写键自动可见，零重注入）；`advEdgeOpenDir(dir) = advEdgeBarriersHidden || advEdgeDirUnlocked(dir, advEdgeUnlockCounts)`——**单一开放判据**，屏障建场/保护政策/传送触发/西带雾表四方共吃这一口。
  - **分向解锁语义**（对现状的实质变更）：现开关是三向一体的布尔；解锁链是逐图的（q16 广场→desert、q19 神殿→snow、q22 雪屋→swamp），T9 后边缘传送是唯一入口，q17「走进黄沙沙漠」必须靠南边解锁即可通行——三向一体会锁死任务链。故北随 snow、南随 desert、西随 swamp 分向派生。T7 交接①的「单一开关缝」保留为强制层（OR 语义），R6 的「判据自动跟随」承诺由 advEdgeOpenDir 兑现。
- **传送触发 tick**（ADV 壳装配，新 `advEdgeTick(dt)`，update 内挂在 advEdgeSkyTick 相邻位、同 gate `advDim==='overworld' && advMap==='home'`）：
  - 早退链：`advPortalCd > 0 || advVeil.phase !== 'idle' || advSleep.on` → return（冷却/转场中/睡觉不触发，advPortalTick 同款口径）。
  - `const dir = advEdgeTransitDirAt(pos.x, pos.z)`；`dir && advEdgeOpenDir(dir)` → `advVeilFire({to: ADV_EDGE_DIR_MAP[dir], kind: 'edge'})`。
  - 无站桩（拍板 6 瞬间语义）；不走 advGateHold。
- **白闪 overlay**：**复用 #portalVeil**（零新 overlay 元素、零新渲染依赖）。advVeilSet/advVeilReset 增加可选 class 切换：kind='edge'/'rite' 时挂 `#portalVeil.edge`，CSS 新增白色径向渐变变体（中心暖白 rgb(255 250 240 / 88%) → 边缘淡金 #ffefd0 一类，**忌纯白刺眼、忌纯黑**，调研 D3 + css 现注释幼儿口径）；map/den 门阵维持紫色。 CSS 改动仅此一段。
- **时长定档**：沿用 `ADV_VEIL_T = 0.4` 双段（淡入 0.4 + 淡出 0.4，包络 0.8s，恰在票面拍板区间 300~800ms 上限；看不见画面仅 0.4s）。备选 0.3+0.3=0.6s（更贴「瞬间」感，需独立常量+分支+既有门阵时序测试帧数不动）→ 【拍板 Q1】。
- **音效**：零新增资产——advVeilArrive 既有 `advSfx('portal_travel')`（audio-registry 在册：双音上行琶音 659→988Hz，0.34s，prio 4）对 edge kind 天然生效（见下）；白闪起手**不加音**（瞬间传送无站桩阶段，无 portal_charge 对应物；调研口径边界警告无音效、突兀音有惊吓风险）。备选新增轻音色 → 【拍板 Q2】。
- **到达链复用（零新到达机制）**：advVeilArrive 现只判 `kind === 'den'` 分流，其余全走 map 路径——kind='edge' **天然落入 map 路径**：`ADV_MAPS.find(to)` → `row.gates.find(q => q.to === 'home')`（=挪边后的回程门）→ `advSetMap(to, advMapArriveAt(g))` + `visit_<图>` 到达记账（**q17/q20/q23 任务链继续成立**）+ portal_travel 音 + 到达 TTS/toast。边缘传送成为任务链的一环，零额外接线。
- **冷却防抖**：advVeilFire 末尾既有 `advPortalCd = ADV_PORTAL.cd`（0.8s，AC 传送门段常量 L2963 先例）——覆盖整个白闪窗 + 落地空眩晕；到达落点在门内侧 2.5 格（不在门面格），且远征图无触发线（tick gate 限定 home 图）——**落地不连环传送**双保险。
- **落点方向自查**（设计校验，非新机制）：北线传送→雪原图南缘门内侧 2.5 格（z≈152.5，floor≠159 非最外行）✓；南线→沙漠图北缘门内侧（z≈5.5）✓；西线→沼泽图东缘门内侧（x≈152，floor≠159）✓。
- **与现状差异**：现状走到世界边缘 = 隐形墙挡住，无任何反馈；新增触发线+传送链（纯新增政策/机制层，观感层零触碰）。
- **验收断言口径**：见 §4 test 组 1/2/5。

### T8-B · 未解锁挡住 + 话术 + 解锁「让开」演出 规模 M~L

- **「挡住」的物理现状核对**（逐向）：
  - 北：连绵雪山脊，南麓 1 格缓阶起步随即 ≥2 格级差（跳跃 1.42 翻不过）——物理挡住成立（T2 spec，已建场）✓。
  - 南：大沙丘脊线四段剖面，坡脚/陡升级差恒 ≥2——物理挡住成立（T3 spec）✓。
  - 西：迷雾深水带 = 地表改写 `[B_WATER, 2]`（AC advEdgeWestSurface k13..18）——**实为 1 格深贴地水体，蹚水（wade 物理）可穿过**；设计语义=软屏障（west-spec §4：「水是 6 岁孩子的天然过不去信号」+横雾带 0.88~1.0 浓雾；enforcement 只落了禁挖保护）。此缺口登记为风险 R1 + 【拍板 Q3】（推荐维持软屏障+近前话术，T10 实机走查复核）。
  - 东：栅栏收尾（无解锁语义），恒不触发传送，观感不动。
- **近前引导话术**（新）：
  - AC 纯函数 `advEdgeHintAt(x, z) → dir|null`：锁定向的屏障近地带——北 `z ≤ 18`（山体南麓带内）、南 `z ≥ 140`（apron z139..143 起）、西 `x ≤ 22`（深水带 x13..18 东缘外一圈）；先判 `advEdgeOpenDir(dir)` 已开放 → null（解锁态静默）；东向恒 null。带缘常量与各 spec 带矩形同源（注释标出处，不抄第二份几何）。
  - ADV 壳：并入 advEdgeTick——`advEdgeHintAt(floor(pos.x), floor(pos.z))` 命中 → 节流（advGateLockTick 同款 timer `advEdgeHintT`，一次只提一向；**G3 实机走查拍板 2026-11-07：6s 太密定 30s**，`ADV_EDGE_HINT_CD=30`）→ 分向话术占位。**分级镜像 advGateLockTick 的用户实测教训**（2026-10-27 踩坑收口：不剧透未来步）：`advUnlockQuest(ADV_EDGE_DIR_MAP[dir])` 已是当前步 → 点名该任务 goal；否则泛指「先做完任务卡上的任务」。占位骨架：拟人+指回任务+给期待（如北「雪山那边的路还在睡觉呢！先把任务卡上的任务做完，雪就会让开的！」），**不引用门阵**（T9 将拆门阵，话术指向用方向/地平线——耦合登记 R9），终稿归 G3。
- **解锁「让开」演出**（票面 T8 补的解锁时刻语义）：
  - 触发点：既有 `advUnlockRite(mapId)`（ADV，点亮仪式：gate_unlock 琶音+门位冲击波+门面熄→亮）**扩展**——仪式末尾若 `advDim==='overworld' && advMap==='home'` → `advVeilFire({to: mapId, kind: 'rite'})`（白闪起）；玩家在远征图完成点亮时只播报（**「回家就能看到」**——与门面同语义：屏障显隐是建场读键，下次 home 装场自动消失，零额外机制）。
  - advVeilArrive 加 rite 分支（在 den 分支旁）：白闪满格瞬间执行**同图重建** + 边缘话术占位（如「通往白雪雪原的路打开啦！从家的北边一直走就能到！」）+ toast；**不切图不记账不清场实体**。
  - 同图重建 = 复用换图 loadScene 整链（R6 拍板口径）：把 advSetDim overworld 分支的 loadScene 闭包体（advBuildScene+journal.replay+advGatesBuild+四 rescan+ore/furnace）提为单一实现 `advOverworldReload()`，advSetDim 与 rite 两处共用（单一实现纪律，diff 最小）。重建耗时（≈换图量级，见 §3）在白闪满格遮蔽下同步执行——孩子看到的顺序：白闪起→（遮蔽）→白闪退=新地貌，与换图同款体验。
  - 拒绝的备选（登记）：增量拆墙（按建场权威函数反推屏障格清单逐格吹除+粒子）——零顿挫但新增格清单枚举/edits 互操作/脏格批处理三件新机制，且 R6 已明确清场重建走既有链；不做。
- **建场侧显隐换源**（T7 交接①落地，判据零结构改动只换门控）：
  - `advEdgeNorthBarrier` / `advEdgeSouthBarrier` 早退：`if (advEdgeBarriersHidden) return` → `if (advEdgeOpenDir('north'/'south')) return`。
  - `advEdgeProtectedAt` / `advEdgeProtectedZone`：`const lock = !advEdgeBarriersHidden` → 逐向 `lockN = !advEdgeOpenDir('north')` 等（三向各自门控；**东向栅栏/告示牌/栈桩恒保护不变**）。T7 全部既有断言在 counts 缺省（全锁）下行为逐位不变。
  - **西带解锁态替换**（west-spec §4.3 定稿内容，「同格位同坐标、不挪带、不挪传送线」）：`advEdgeWestSurface` k13..18 分支按 `advEdgeOpenDir('west')` 分派——锁定 `[B_WATER, 2]`（现状冻结）；解锁=泥岸步道（泥底+苔石垫脚×3+残留 1 格小水洼，83xx 段盐确定性散布，advEdgeWestBarrier 两处苔石冒头在水体守卫下自然让位）。两态各自确定性断言钉住。
  - **西带解锁雾减半**（同 §4.3「横雾带 opacity 约减半」）：AC 新常量表 `ADV_EDGE_SKY_WEST_OPEN`（west 行雾浓度约减半档，锚点距离不变），`advEdgeSkyAt` 在 best.dir==='west' 且开放时换表；北/南/东表冻结不动（山体/沙丘消失不改天色目标——雪原/沙漠 palette 渐变照旧）。counts 缺省时选表与现状逐位一致（T7 P5①旁路等价断言原样绿）。
- **与现状差异**：现状解锁=仅门面亮（门阵入口语义）；T8 后解锁同时驱动屏障显隐/西带步道/西带雾/传送通行，解锁时刻有白闪+重建+播报演出。
- **验收断言口径**：见 §4 test 组 3/4/6/7。

### T8-C · 回程门挪边（三图新缘 + 落点口径） 规模 M

- **常量改动**（AMC 图常量段，单一权威，下游全派生）：
  - `ADV_DESERT.gate: {px: 58, pz: 3, face: 'north'}`（北缘，面向 home=home 在沙漠图北方）
  - `ADV_SNOW.gate: {px: 58, pz: 155, face: 'south'}`（南缘，home 在雪原图南方）
  - `ADV_SWAMP.gate: {px: 154, pz: 70, face: 'east'}`（东缘，home 在沼泽图东方）
  - 坐标为推荐值（框架占位 z±1 / x 平面跨 8 行，已避开三图既有结构：神殿/绿洲/雪屋/冰湖/水洼/女巫小屋均不叠；审查可调）。face 字段=该门贴在哪条图缘，同时是落点内向向量与门体平面朝向的唯一权威；**face 缺省=现行为**（home 门阵三扇不写 face，零影响）。
  - 罗盘核对：home 北缘→雪原（从雪原南缘来）⇒ 雪原回程门在南缘 ✓；home 南缘→沙漠 ⇒ 沙漠回程门在北缘 ✓；home 西缘→沼泽 ⇒ 沼泽回程门在东缘 ✓——三图 gate 均在「面向 home」的那条边缘（拍板 8 字面）。
- **落点口径泛化**（AMC `advMapArriveAt`，纯函数）：
  - 门心：z 平面门（face north/south）= `(px+2.5, pz+0.5)`（现口径）；x 平面门（face east/west）= `(px+0.5, pz+2.5)`。
  - 落点 = 门心 + 内向单位向量×2.5，yaw=面朝图内（forward=(sin yaw, cos yaw) 约定取内向方向；`% 2π` 归一口径沿用）：
    - face 'north'：落 `(px+2.5, pz+3.0)` yaw 0——**与现公式数值恒等**（现公式 `advPortalExit(px+2.5, G+1, pz+0.5, π)` 恰好就是「北缘门」的特例，泛化后逐字节兼容）；
    - face 'south'：落 `(px+2.5, pz−2.0)` yaw π（门在身后南侧，面朝图内北上）；
    - face 'east'：落 `(px−2.0, pz+2.5)` yaw −π/2 归一 3π/2（门在身后东侧，面朝图内西行）。
  - 数值等价断言：无 face 的既有 gates（home 三扇+三图旧位回归用例）结果与现实现逐字段相等——老断言零改动即绿。
- **x 平面门体变体**（AC 传送门段，新 `advPortalFrameX(set, by, px, pz, look)`）：沼泽东缘门若沿用 z 平面（门面法线 ±z），「内侧 2.5 格面朝图内」在几何上不成立（内向位移会落进门框柱/塔楼柱实心格），且孩子东行回家要「侧身蹭进」南北朝向的门面——读不了。故东/西向门需要门面法线 ±x 的变体：
  - 实现用**转置包装**（几何零第二份，同源原则）：`advPortalFrame(set, by, 0, 0, look)` 以原点为锚建标准 z 平面门，写入缝做坐标转置 `(x,y,z) → set(px+z, y, pz+x, id)`——得到 x∈[px−1,px+1]、z∈[pz−1,pz+6] 的镜像门（内口 4×5 门面在 x=px 单平面上）。黑曜石框/门面/发光岩/步道/火把全部继承，观感件零重写。
  - 消费点适配（逐个核对过的完整清单）：`advGatesBuild` 按 face 选 frame 函数；`advGateAt` 增 x 平面匹配分支（face east/west → `fx === g.px && fz ∈ [pz, pz+ADV_PORTAL.w−1]`）；`advBeamsRelayout` 亮门束锚 x 平面变体（advBeamAdd 锚点交换——Fx.portalBeam 是竖直光柱，锚 (px+0.5, by+1, pz+w/2+1) 即可，柱体对称无朝向问题）；`advInPortal` 格判据方向无关零改动；`advPortalSiteOk` 只服务玩家自放门（恒 z 平面）零改动；门体不可破坏走「声明式不可破坏」（黑曜石/门面无 hard 字段，引擎级口径方向无关）零改动。
  - 备选 B（登记不推荐）：沼泽门维持 z 平面临东缘（面朝语义降级为「门在东缘附近、开口朝南北」）——若实施中发现 x 平面变体影响面超预期（R2），降级走此案，落点口径相应降级并过话术走查。
- **下游派生核对**（改常量自动跟随清单）：`advDesertFlats` 门区压平圈与 `inGateZone` 门区走廊、snow/swamp 同构 Flats 族（同引用 gate 常量派生——已核 desert 侧代码，snow/swamp 实施时逐图核对同构性）、建场门位压平净空——全部读 `ADV_*.gate` 单一权威，改常量即跟随；**实施须为三图新门区各补压平圈覆盖核对**（x 平面门跨 8 行 z，压平圈 r12 需盖住）。
- **老档兼容**（零迁移口径）：门体=建场件（setBlockRaw 直写不进 edits）——重进重建，旧位 (58,70) 门自然消失、新位门自然出现；老档在旧门区的玩家 edits 原样保留（玩家财产，玩家赢口径）；老档 pos 恰存于旧门面格时 B_PORTAL 已不存在，advInPortal 不命中=无幽灵传送；advExitSpot 不落盘，无跨档落点残留。**edits/存档格式零改动**。
- **回程链核对**（全链零改动）：孩子在远征图走进回程门面（advInPortal）→ advGateAt 命中 `to:'home'` → 2s 站桩可反悔（advGateHold 语义不动，out-of-scope 明示）→ advVeil → home 行 `gates.find(to === 来时图)` → 门阵落点。远征图回程门 `to:'home'` 恒亮（advMapUnlocked('home')===true），无熄门态。T9 拆 home 门阵时本链的 home 侧落点再改，T8 不预动。
- **拍板 3 约束**：远征图自身边界维持空气边界——本项只挪门，不做任何边界化 ✓。
- **验收断言口径**：见 §4 test 组 8/9。

### T8-D · 政策纯函数清单（可单测，壳只装配）

| 文件 | 新增/改动 | 性质 |
| --- | --- | --- |
| AMC | `ADV_EDGE_DIR_MAP` · `advEdgeDirUnlocked(dir, counts)` · `ADV_GATE_FACE_*`（内向向量/门心偏移常量）· `advMapArriveAt` face 感知泛化 | 纯函数，同名单测 |
| AC | `advEdgeTransitDirAt(x,z)` · `advEdgeHintAt(x,z)` · `advEdgeOpenDir(dir)` + `advSetEdgeUnlockCounts` 缝 · `advPortalFrameX` · `ADV_EDGE_SKY_WEST_OPEN` 表 · advEdgeWestSurface 解锁分支（建场件，两态确定性） | 纯函数/确定性建场，单测直测 |
| ADV（壳） | `advEdgeTick`（transit+hint 装配）· advVeilFire kind/style · advVeilArrive rite 分支 · `advOverworldReload` 提取 · `advUnlockRite` 扩展 · init counts 注入 | 只装配，行为断言在 mode 假环境 |
| CSS | `#portalVeil.edge` 白色渐变变体 | 静态资源 |

加载序/依赖登记：AMC 政策段新函数被 AC 运行时消费（浏览器 defer 共享词法环境成立；test/adventure-core.test.js 的 vm 装载清单需补 `require('../js/adventure-maps-core.js')` 一行——adventure-spawn-core 同款先例）；AC/maps-core 头注 interface 清单（五要素契约）随新导出补全，conventions 守门跟随。

---

## 3. 性能口径（T7 红线延续）

| 项 | 口径 |
| --- | --- |
| 传送触发路径 | advEdgeTick 事件门槛（`advDim/advMap` 两比较先退，他图/维度/腹地零成本）+ O(1) 比较链（触发判据 ≤4 次整数比较 + 解开判据一次查表；引导判据节流计时器先退）。**零逐帧分配、零世界读、零 setSkyBase 触达**——延续 T7 §3.2 审计口径（分配/世界读/冗余写零新增；数值比较不属红线计量，与既有早退链同类） |
| 白闪 | CSS class 一次性切换；透明度逐帧直驱=既有 advVeilSet（零新增代码路径）；Node/无 DOM 环境静默（advVeilEl 桩既有） |
| 解锁清场重建 | 一次性 `advOverworldReload()` ≈ 既有换图重建成本量级（T7 基线 advBuildWorld 中位 655ms + 光照全量 + 全网格重建）；每存档至多 3 次（每图解锁一次）；白闪满格遮蔽下同步执行，非逐帧成本；老档/未解锁档永不触发 |
| 驱动源切换 | 建场分支只换门控布尔来源——**锁定态建场序逐字节不变** ⇒ T7_PERF 钉测口径原样有效（带建场增量倍率 ≤0.93 阈值不调、防呆线 1500ms 不调）；解锁态建场更便宜（山体/沙丘列早退、西带水体换泥步道），不设钉测只登记 |
| 贴图/内存 | 零新贴图格位（泥/苔石/水全在册）；零新常驻大对象（counts 引用 1 个 + ADV_EDGE_SKY_WEST_OPEN 静态表 + css class 字符串） |
| boot 冒烟 | advGatesBuild 新坐标被既有装场链覆盖（home 门阵未动；三图建场由 maps-core/core 单测与 boot 全链覆盖面核对，若 boot 只建 home 则以单测建场补覆盖——实施时登记） |

---

## 4. 测试清单

> 组 1/4/8/9 落 TEST(adventure-core)（vm 装载清单补 AMC）；组 2/3 落 TEST(adventure-maps-core)；组 5/6/7 落 TEST(adventure-mode)（mem/freshInit/pos/calls/spoken 假环境惯例，站桩穿门端到端 L3526 同款）；全部进独立 `test('T8 …')` 群，不动既有断言行。

1. **触发线判据**（纯几何）：`(80, 0.5)→north · (80, 159.5)→south · (0.5, 80)→west · (159.5, 80)→null（东）· (80, 80)→null · 角区 (0.5,0.5)→north（检序）· (159.5, 0.5)→north`；钳制域边界值（z=0.2 可达域内 true）。
2. **解锁派生**：counts 缺省 → 三向全 false；`{unlockedDesert:1}` → 仅 south true；全键 → 三向 true；强制缝 `advSetEdgeBarriersHidden(true)` → OR 全 true；`advEdgeDirUnlocked` 直测（AMC 侧，advMapUnlocked 复用语义：缺键/0/undefined=锁）。
3. **落点泛化**（AMC）：无 face 既有 gates → 与现公式逐字段相等（回归钉）；face 'north' → 与现公式数值恒等；face 'south' → `(px+2.5, pz−2.0)` yaw π；face 'east' → `(px−2.0, pz+2.5)` yaw 3π/2（归一域 [0,2π)）；y 恒 ADV_GROUND+1。
4. **x 平面门体镜像**：advPortalFrame 与 advPortalFrameX 同锚建场 → 转置格集 id 逐格相等；内口 4×5 在 x=px 单平面；advGateAt x 平面命中/未命中（偏出 z 跨度 null）。
5. **传送链端到端**（假环境）：counts 注入解锁沙漠 → pos 置南缘行 → update 推帧 → `advNetherState().map==='desert'` + 落点=沙漠新门内侧坐标 + yaw 面朝图内 + `visit_desert===1` + portal_travel 音 + 到达播报 + `advPortalCd===0.8`；**冷却防抖**：落 地后模拟回 home 南缘行，0.8s 内 update 不二次传送、过后可；veil 非空闲帧不触发。
6. **解锁拦截**：counts 全锁 → 三向缘行 update 零切图；近前区（北 z≤18 等）命中 → 31s 窗话术恰 1 次、再 31s 才第 2 次（30s 节流窗，G3 拍板 2026-11-07）+ 占位含该向世界名；解锁态 → hint 静默；东向 x159 行任何状态零话术零传送。
7. **解锁演出**：home 上完成挂 unlock 任务（counts 捷径+update，L3526 同款）→ rite 白闪后山体正面格（advEdgeNorthMountainH 命中列）变空气 + `advEdgeProtectedAt` 同格 false + 边缘播报出现；远征图完成点亮 → 地图不切 + 播报含「回家」语义 + `advSetMap('home')` 后山体不存在（建场读键延迟生效）。
8. **回程门落位**：三图建场 → 新位门框格集存在（desert (58,3) 北缘 z 平面 / snow (58,155) / swamp (154,70) x 平面）、旧位 (58,70) 无门体；advMapArriveAt(三图 gate) 落点在新缘内侧且所落格可站立（无实心）；advGateAt 在新位门面命中 to:'home'。
9. **西带两态建场**：锁定 → k13..18 列顶 B_WATER（现状回归）；`advSetEdgeUnlockCounts({unlockedSwamp:1})` 重建 → 水体仅剩残留小水洼、苔石垫脚在场；两态各自两次建场逐字节一致；西带解锁态 advEdgeSkyAt 雾档≈锁定态减半、锁定态选表与现状逐位一致。
10. **回归保障**：既有 T7 边界断言群（保护判据/禁放/天雾/确定性/四角）在 counts 缺省下全绿零改动；`npm test` 全量 + `npm run lint`；`T7_PERF=1 npm test` 钉测原阈值通过。

---

## 5. 风险清单

| # | 风险 | 等级 | 缓解 |
| --- | --- | --- | --- |
| R1 | 西向软屏障物理不拦（1 格深贴地水体可蹚过，锁定态孩子可走到西缘） | 中 | 【拍板 Q3】推荐维持软屏障（west-spec 设计语义+禁挖保护已堵挖穿绕过）+ 近前话术；T10 实机走查复核「一眼过不去」接受度；加深水位备案（游泳可穿+溺气惩罚感，儿童红线存疑，不推荐） |
| R2 | x 平面门体新几何影响面（advGateAt/光束锚/落点数学三处适配） | 中 | 转置包装=几何零第二份+镜像断言钉；适配点已在 §2 T8-C 列全；超预期时降级备选 B（z 平面临东缘，面朝语义降级并过走查） |
| R3 | 解锁重建 ~0.7s 同步顿挫（rAF 冻结在白屏满格） | 低 | 白闪满格遮蔽+每档至多 3 次；与既有换图同步切图同款体验（G2 走查复核）；增量拆墙备案不做（新机制） |
| R4 | 老档兼容：counts 缺键=全锁（屏障照旧、传送不通）与 T7 现状行为一致；旧门位 edits/pos 残留 | 低 | §2 T8-C 逐项核对（门=建场件、B_PORTAL 消失即无幽灵传送）；零迁移口径登记；测试组 5/7 覆盖 |
| R5 | 东向语义破坏（收尾感/彩蛋） | 低 | 触发判据 east 恒 null；hint 判据不含东；东带观感件零触碰；测试组 6 东向断言钉住 |
| R6 | 白闪儿童红线（惊吓/刺眼） | 低 | 0.8s 包络在拍板区间内（Q1 可调 0.6s）；暖白径向渐变忌纯白纯黑（调研 D3）；起手无音爆只有到达琶音；G2 实机走查专测三连传 |
| R7 | 解锁演出时序（任务完成瞬间 rite 白闪与点亮仪式观感叠加） | 低 | 顺序=既有仪式（琶音/门面亮）→ 白闪重建 → 边缘播报，一秒内三拍递进不抢戏（GoldRite「克制不抢戏」同款口径）；cleanup/切模式经 advVeilReset 幂等收起（既有） |
| R8 | showroom/他模式影响 | 低 | 全部改动落在 AC/AMC/ADV/CSS 四文件；无新共享缝（placeGuard/hardText 均为 T7 已有缝，T8 只换 AC 侧门控源）；voxel.js 引擎零改动（触发读 pos 在壳层）；showroom 不消费新函数 |
| R9 | 任务文案耦合：q17/q20/q23 hint 提「站进门里等一等」（门阵语义），T9 才改 | 低 | T8 话术占位一律用方向词不引用门阵；T9 改任务文案时与本票话术终稿（G3）互查 |
| R10 | counts 注入时序（init 在 advLoad 之后；假环境测试需显式注入） | 低 | 注入=引用赋值一行；freshInit 惯例补一行；cleanup 不清引用（进场重注入同对象，幂等） |

---

## 6. 实施编排建议（含 HITL 位置）

- **波次一（单 agent，AC+AMC owner）**：T8-D 纯函数全部（DIR_MAP/派生层/触发线/引导区/arrive 泛化/frameX/west 两态分支/sky open 表）+ AC 头注 interface 清单 + TEST core/maps 侧组 1/2/3/4/8/9。AC 政策段+西带段+传送门段+天雾表四处连续行区间内写，已审函数段行为零触碰。
- **波次二（单 agent，ADV+CSS owner）**：advEdgeTick/veil kind 与 class/rite 分支/advOverworldReload 提取/advUnlockRite 扩展/init 注入 + `#portalVeil.edge` + TEST mode 侧组 5/6/7。接口契约先定（一行签名表）：`advEdgeTransitDirAt(x,z)→dir|null` · `advEdgeHintAt(x,z)→dir|null` · `advEdgeOpenDir(dir)→bool` · `advSetEdgeUnlockCounts(counts)` · `advVeilFire({to, kind:'edge'|'rite'})`。
- **波次三**：组 10 回归保障 + 老档/节流补断言 + GLOSSARY 词条（边缘传送/触发线/回程门挪边/白闪变体）+ world-edge-map Decisions 回填材料准备（Resolution 由主会话回填）。
- **门禁与 HITL**：
  - **G1**（方案审查）：主会话 relay 用户 §7 拍板批量——不阻塞波次一纯函数先行，波次二前收齐。
  - **G2**（波次二后，核心 HITL 实机走查）：三条向「解锁态越线白闪→到达回程门旁→回程门站桩回家」全环；锁定态屏障+话术；解锁时刻演出（白闪+屏障让开+播报）；东向走到栅栏收尾不变（彩蛋仍可跳缝）；`?edgeUnlocked=1` 与真实解锁两条路径都走（Q5 保留时）。
  - **G3**（走查通过后）：**话术过目环节**（票标 HITL 归口）——T8 新占位（近前引导分向+分级+解锁播报）与 T7 交接②占位（挖掘/放置四向+「雪崩堆」改词）批量过目定稿，替换后全量回归。
  - **G4**（收尾）：`npm test` + `npm run lint` + `T7_PERF=1 npm test` + T8 Resolution 回填（T9/T10 解锁）。

---

## 7. 【需用户拍板】项清单（主会话审查本方案时一并问，共六题）

| 题 | 候选 | 推荐 | 理由 |
| --- | --- | --- | --- |
| Q1 · 白闪时长定档 | A. 0.4s+0.4s=0.8s（沿用 ADV_VEIL_T，与门阵转场同一节拍）；B. 0.3s+0.3s=0.6s（更贴「瞬间」感，需独立常量+分支，门阵不变） | **A** | 零新常量零新机制；门阵已走查过的节拍孩子已熟悉（一致的传送语言可学习）；0.8s 恰在票面区间上限；B 的边际收益（快 0.2s）不值一次新时序 |
| Q2 · 白闪音效 | A. 复用 portal_travel 到达琶音单段（零新资产）；B. 新增白闪专用轻音色（audio-registry 加行+选型） | **A** | 到达琶音（659→988Hz 正弦双音，prio 4）已是传送语义的听觉锚；起手加音=瞬间传送反而多一拍延迟感；B 留给未来「传送音家族」需求 |
| Q3 · 西向锁定屏障 enforcement | A. 维持软屏障（浓雾+深水观感+近前话术引导；物理上可蹚过但锁定态不传送）；B. 锁定态加深水位 2~3 格（游泳可穿+溺气风险） | **A** | west-spec §4 设计语义即软屏障（「水是天然过不去信号」+横雾带），禁挖保护已堵挖穿；B 引入溺水惩罚感违背借形不借罚（调研 §4）；T10 走查复核，不够再议 |
| Q4 · 解锁瞬间演出形态 | A. 白闪+整场重建（复用换图 loadScene 链，零新机制，R6 口径）；B. 增量拆墙+粒子动效（屏风格清单枚举，新机制） | **A** | R6 已拍板「清场重建与换图重播同构零新机制」；白闪正好遮蔽重建顿挫；B 三件新机制换一个 0.7s 的顺滑，收益低风险高 |
| Q5 · `?edgeUnlocked=1` URL 参数去留 | A. 保留为强制全开调试缝（OR 在进度派生上）；B. 移除，纯进度驱动 | **A** | T10 实机走查要测「解锁态传送」，有此缝不必先打穿任务链；G2 走查两路径都过一遍；一行 OR 成本，登记为调试缝不属玩家可达面 |
| Q6 · 三图回程门落位推荐值 | A. 沙漠 (58,3) 北缘 / 雪原 (58,155) 南缘 / 沼泽 (154,70) 东缘（x 平面朝西），face 口径如 §2 T8-C；B. 调整坐标或沼泽门降级 z 平面（备选 B） | **A** | 三位坐标均避开既有结构且压平圈可覆盖；罗盘语义（面向 home 边缘）逐图核对成立；沼泽 x 平面是「内侧 2.5 格面朝图内」字面成立的唯一几何，备选 B 只在影响面超预期时降级 |
