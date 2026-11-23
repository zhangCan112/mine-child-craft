# T-C13-R 架构方案 — 篝火几何建模化（v1.10 §4 系）

> 产出：architect（2026-11-22）｜工作现场：主 worktree（feat/campfire）｜纪律：只读调研+本文档工件，零产品代码改动。
> 设计权威：docs/design/campfire-visual-spec.md v1.10（§4 系重写）；票面：docs/campfire-tickets.md T-C13-R（:960-1011）。
> 结论逐条带证据（文件:行）；无证据判断标注【推断】。

---

## 0. 结论速览

**推荐架构 = 「静态部件驻 chunk 批网格 + 焰片全场景共享单 mesh」**，不拆每座独立 Group：

| 面 | 方案 | 关键数 |
|---|---|---|
| 静态部件（4 原木+炭堆） | **留在 chunk 图集通道**（mesh-core `pushCampfireBox` → `pushCampfireParts` 多部件发射） | 专属 mesh **0/座**；随区块网格免费拿剔除/生命周期/光照 |
| 焰片（交叉 2 片×翻页） | **全场景 1 张共享 sheet**（effects.js campfireField 场内新增，membership=fx open 格） | 专属 mesh **1/全场景**；draw call 增量 **≈+1** |
| 拾取 | 零改动（voxel-DDA 只见体素格，部件/面片天然不可拾取） | 拾取目标恒为篝火 voxel 本身 |
| 两态切换 | id 互换→既有区块重建（与今日贴图路径同成本同拍）+ fx 句柄即摘/即挂焰片 | 零材质切换、零 Group 重建 |
| 生命周期 | 静态=id 驱动（edits 重放直出）；焰片=fx 句柄驱动（台账重放走既有 open/clear 缝） | 零新产权、零孤儿 mesh 风险 |
| 预算 | 每座 ≤2 mesh（实=0 专属+共享 1）、dc 增量 ≤100（实≈+1）、部件 ≤7（实=7） | 全部大幅低于红线 |

与定稿 §4.1「渲染层大概率拆独立组合 mesh（每座一个 Group）【实现自由度】」的关系：**该句是实现自由度提示非硬性指令**；本方案在自由度范围内选择更优解（预算三项全部更优、生命周期零新增），观感判据（§4.4 几何断言+§4.5 走查）零偏离。口径裁定项见 §9。

---

## 1. 现状约束摘要（证据）

- **块注册**：`B_CAMPFIRE=81/B_CAMPFIRE_OUT=82`，`campfire:'lit'/'out'` 旗标、`light 15/0`、`thin 0.4375`、`solid:true`、两态同 drop（js/config.js:543-545）。**玩法数据面零变更红线**：本方案不动 config 方块行、不动 voxel 格层面、不动 C5 档键 `advCampfires`。
- **当前渲染路径**：mesh-core `pushCampfireBox`（thin 0.4375 扁盒、五面、分面 tile 顶灶/侧脸、两态取光分口径）进 chunk 图集通道（js/mesh-core.js:140-167, :519-524）；同一份代码在主线程兜底与 Worker 双路径运行（js/mesh-worker.js:15, js/mesh-core.js:13-14）。
- **图集**：16×16 格、count=68（0~67；62/63+64~67 存档区），`layout.tiles[81]={top:64,side:65,bottom:65}`（js/texture-atlas.js:38, :89-96, :1106；test/texture-atlas.test.js:824）。68~76 待接线，余量充足。
- **atlasMat**：`MeshLambertMaterial({map, alphaTest:0.5, FrontSide})`+顶点光注入 `aSky/aBlock`（js/world.js:297-298, :369）——65/67 alpha 真透管线先例（js/texture-atlas.js:568）。
- **chunk 生命周期**：`mountChunk/unloadChunk` 替换式重建；**距离环卸载已退役（T14），全图全细节常驻**，卸载只剩重建替换与清场两条路（js/world.js:433-458, :460-463 注释）；重建走 `remeshQueue` 每帧预算出队、视觉滞后 ≤2 帧（js/world.js:785-838）。
- **编辑管线**：一切世界写走 `editBlockDirty`→`markDirty`→区块重建（js/world.js:800-813）——浇熄/重燃的 id 互换已在此链上（js/modes/adventure.js:964-973, :3575-3587）。
- **拾取**：`raycastVoxel` Amanatides-Woo 体素 DDA，只读 `getBlock` 格数据（js/voxel.js:154-190）；全仓无 THREE.Raycaster 应用调用（grep 仅 lib/three.min.js 命中）——**产品里没有 mesh 拾取路径**。
- **特效体系**：观感状态单源 CampfireFxCore（纯逻辑、零墙钟零裸随机、mulberry32 每源派生 cellSeed——同格同流异格异流，js/campfire-fx-core.js:23-39）；渲染适配 effects.js `campfireField(fx)` 句柄制、每帧 `stepFields` 读核心产物摆位（js/effects.js:192-325, :429）；clear 连带清场（js/effects.js:404-424）。装配：adventure.js :1021-1022。
- **台账**：CampfireKit ledger（plant/tick/drop/readd/simClear/encode，js/campfire-kit.js）；读档=edits 重放重建方块+台账重灌+readd 重挂（js/modes/adventure.js:2551-2572, :5391）；**燃烧态恢复=重放点燃过渡（settle→fx.open，v1.8 认可口径）**。
- **性能基准**：T-C6 收档（.scratch/campfire/tc6-bench-report.md）——50 火 headless Chrome SwiftShader 双场景双档帧时零尾增长+CPU ≈0.35ms/帧；**未测 draw call**；其负载为旧贴图盒路径（chunk 扁盒+粒子场），粒子面（烟/旋涡/柱）本票零改动故其结论半数仍可参照，几何/dc 面作废重开。
- **先例**：十字片 `pushCross`（mesh-core.js:175-199）、薄块族 `pushThin/pushBedBox`（:68/:94）、火把采样窗 `pushTorch WINS`（:217-250）、mob-look-kit 部件表装配（js/mob-look-kit.js:24-51）、prefab-kit 声明式落位（js/prefab-kit.js:1-32）、**InstancedMesh 合批先例=怪物关节槽**（js/mobs.js:63-85）。

---

## 2. 方案总览：数据流全生命周期

### 2.1 渲染架构（两件套）

```
┌─ 静态部件（4 原木织席 + 炭堆主盒 + 1 小盒）────────────────┐
│ chunk 图集通道（既有 atlasMat，零新材质零新产权）              │
│ MeshCore.pushCampfireParts(t,x,y,z,out,atlas,lsky,lblk)       │
│  · 替换 pushCampfireBox（分派点 b.campfire 不变, :519）        │
│  · 部件布局表 CF_PARTS（§4 建议值, 全确定性零随机）            │
│  · 逐部件逐面取 tile: 端面68/皮侧69/炭顶70|72/炭侧71|73        │
│  · 两态取光分口径原样继承(:146-154): lit=自身格 / out=面邻格   │
│  · 贴地部件跳底面(pushBedBox 惯例), 部件间半搭互穿防共面       │
│  · 随 Worker 路径免费（同一份 MeshCore, mesh-worker.js:15）     │
└──────────────────────────────────────────────────────────┘
┌─ 焰片（交叉 2 片 90° × UV 翻页 3 帧 × 逐火错相）──────────────┐
│ 全场景 1 张共享 sheet（每 campfireField 场一份, 惰性建）        │
│  · membership = fx.cells() 过滤 open===true（=台账在册燃烧格）  │
│  · 帧 = floor((now + phase·T)/frameS) % 3, phase=fx.flamePhase │
│    (cellSeed 派生, 确定性, 同格同流异格异流)                    │
│  · UV 翻页改写该火 8 顶点(脏检 amortized O(1)/帧)              │
│  · 材质 MeshBasic{map:atlasMat.map, alphaTest:0.5,             │
│    DoubleSide, vertexColors}——自发光语义(夜间读发光体§4.5-2)   │
│  · 渐弱: 帧距×(1+tint) 降档 + 顶点色亮度插值(§5.8)              │
│  · frustumCulled=false(三角量≈200 可忽略, 免包围球维护)         │
│  · 产权=field 句柄, clear/removeField 既有唯一释放口(:404-424)  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 全生命周期数据流（状态迁移 × 渲染动作）

| 环节 | 机制链（既有） | 静态部件 | 焰片 sheet |
|---|---|---|---|
| 放置即燃 | onPlaced→editBlock(81)+ledger.plant+fx.open（adventure.js:3550, campfire-kit.js:106-113） | 区块重建出燃态多部件（tile 70/71+光=自身格） | open→挂 planes（点燃 pop+发射器渐起既有；可选用 y-scale 渐起，见 §6） |
| 燃烧中 | fx.tick 喂刻（20tps）+setLeft 喂余量 | 静态零成本 | 帧推进（now+phase）；错相=位置哈希 |
| 渐弱窗 ≤10% | setLeft→fadeState | 不变 | 帧率降档+亮度插值（§5.8 扩含面片） |
| 水浇 | quenchHit→fx.quench+editBlock(82)（:964-973） | 区块重建出熄态（tile 72/73+光=面邻格，结构零差） | quench→**即刻摘**（open=false） |
| 点击重燃 | tryCampfireRelight→editBlock(81)+plant+fx.open（:3575-3587, :5668） | 重建出燃态 | open→重挂（新的一炉） |
| 燃尽 | 到期→fx.burnout+editBlock(0)+级联（:974-986） | 重建=整体消失（干净消失） | burnout→即摘（渐熄粒子尾巴归 fx 既有） |
| 挖掘 | drop+fx.dig+editBlock(0)（:415-416） | 重建=消失 | dig→即摘 |
| 读档/进图 | edits 重放→方块 id 直出；settle→fx.open 重放点燃（v1.8） | **id 驱动**：meshChunk 按 81/82 直出两态 | **fx 句柄驱动**：settle 逐燃烧格 open→sheet 重建恰为燃烧集 |
| 切模式 | Fx.clear→fields 全清（effects.js:404-424） | clearWorld 卸区块网格 | sheet 随 field 清（零孤儿） |

**产权一览**：静态部件无独立产权（chunk 网格托管）；焰片产权=field 句柄（既有释放口）。全链零新增生命周期所有者——这是对必答题 h 整类 bug 的结构性免疫。

### 2.3 变更面清单（零新 js 文件）

| 文件 | 变更 | 性质 |
|---|---|---|
| js/texture-atlas.js | PAINTERS +9 格（68~76）、layout.tiles[81]/[82] 改部件表形状、count 68→77 | 数据+布局 |
| js/mesh-core.js | pushCampfireBox→pushCampfireParts + CF_PARTS 表 + 头注更新 | 纯核心 |
| js/campfire-fx-core.js | params.flamePlanes 行+fx.flamePhase(x,y,z) 导出；（裁量）flame.rate 降档 | 纯核心增量 |
| js/effects.js | campfireField 场内焰片 sheet（惰性建/成员同步/翻页/释放） | 渲染适配 |
| test/… | 详见 §8 | 守门翻新 |
| js/config.js / js/voxel.js / js/world.js / js/campfire-kit.js / js/modes/*.js | **零改动**（装配缝全部复用既有） | — |

---

## 3. 必答题 a~j 逐题

### a. 独立装配与 chunk 剔除/LOD/光照的关系

**本方案只有焰片移出 chunk 批（静态部件不移出）**，故分两半答：

- **静态部件（驻 chunk 批）**：视锥剔除=chunk mesh 级 `frustumCulled`（three 缺省 true，随区块整 mesh 剔除，零新代码）；区块「卸载」=T14 后距离卸载已退役，只剩替换式重建与 clearWorld 清场两条路（world.js:451-458 注释），静态部件随区块网格生灭，**免问谁管**；光照=atlasMat 顶点光注入（aSky/aBlock）+ 两态取光分口径逐面采样（pushCampfireBox :146-154 原样继承，燃=自身格 light 15 自亮、熄=面朝向邻格——ADR 0012 同构已测）。LOD 不存在（全图全细节常驻），不适用。
- **焰片 sheet（移出）**：单 mesh 恒绘（`frustumCulled=false`）——全场景 50 火 ×2 面片=200 三角，GPU 成本可忽略，换来免每帧包围球维护与成员增删时的重算；「卸载」不适用（产权跟 field 句柄，模式切换 Fx.clear 连带清，跨图随 fx.clear/rebuild——与粒子场同一套纪律，adventure.js :2551-2572 已有）。
- **若走备选案（每座 Group）**：剔除=每 mesh three 缺省剔除（免费）；卸载=需自挂 chunk 重建/清场事件新产权（这正是本方案否决它的主因之一，见 c）。

### b（含 j）. raycast 拾取路径 + 焰片拾取穿透

- **拾取路径维持体素拾取，零改动**：方块交互全走 `raycastVoxel`（voxel.js:154-190，Amanatides-Woo 逐格 DDA，只读 `getBlock`）；全仓无 Raycaster 应用调用（grep 证）。重燃入口 `tryCampfireRelight(hit)` 吃的就是体素命中（adventure.js:5668）。
- **焰片拾取政策=「面片零参与拾取」且天然成立，无需 non-pickable 配置**：面片与多部件盒几何都只是渲染体，不在体素格数据里，DDA 永远看不见它们；射线穿过焰片区域=穿过篝火所在格→命中格 id 81/82→**拾取目标恒为篝火 voxel 本身**。「点着火焰点不燃」结构性不可能。
- **配套不变量（进几何断言）**：全部部件严格落在自有格 [x,x+1)³ 内（焰片顶 0.71<1.0，见 §4 表）——不侵入邻格，邻格拾取语义零污染；本不变量由 mesh-core 测试锁定（部件包围盒 ⊆ 单元格）。
- 该政策不可逆（拾取语义+几何边界），建议落 ADR（§7）。

### c. 合批策略——50 火 dc 增量 ≤100 的达成路径

| 案 | 每座 mesh | 50 火 dc 增量 | 判定 |
|---|---|---|---|
| **推荐：静态入 chunk 批 + 焰片共享单 sheet** | 0 专属 + 全场共享 1 | **≈+1**（另+受影响区块 atlas 通道从无到有的边角 ≤区块数，实测口径里量化） | ✅ 预算三项全优 |
| 备选 1：每座 Group（静态合批 1+焰片 1） | 2 | +100（恰顶格零余量） | ❌ 顶格无余量；新增 50×2 mesh 产权与生命周期挂钩（h 类 bug 面）；clearWorld/跨图需自证零孤儿 |
| 备选 2：InstancedMesh 焰片 | 1（实例） | +1~2 | ❌ 仓库有先例（mobs.js:63-85 关节槽）但 r128 InstancedMesh 只带 instanceMatrix/instanceColor——**逐火 UV 翻帧需自定义 instanced 属性+改 shader**（引新管线语言，违「零新管线」原则§2-4）；单几何 sheet 已是同一收益的更简实现 |

推荐案理由细化：静态部件与全区块共享同一 `atlasMat` 同一 draw call（chunk 图集通道，world.js:440）；焰片一张 sheet 一次 draw call（MeshBasic 独立材质，不透明队列）；「合批」由两条既有语言承担——chunk 批内合批（mesh-core 一贯做法）+单 mesh 多火拼合（sheet，几何预分配容量按需翻倍，mobs 容量策略 :63-70 同款）。风险与对策：sheet 恒绘=三角量 200 可忽略；成员同步 O(燃烧数)/帧，与既有 stepFields 每帧逐格循环同量级（C6 实测字段同步 0.32ms/帧@2550 mesh，本 sheet 远轻于粒子池）。

### d（含 i + alphaTest 注记）. fx 整合 + 焰片动画错相与确定性

- **挂靠点分层**：动画**状态**归 campfire-fx-core（纯逻辑：`params.flamePlanes={frames:3,frameS:0.15,…}` 参数行 + `fx.flamePhase(x,y,z)` 实例查询——cellSeed(rootSeed,x,y,z) 派生，:33-39 既有哈希单一来源，不复制公式）；动画**驱动**归 effects.js campfireField 场内 sheet（`Fx.update→stepFields` 每帧既有泵，:427-429）；**烟/火星/气柱/过渡粒子代码路径零改动**（红线，§5.3/§5.4 裁决 4）。
- **错相与确定性（i）**：每火相位 `phase=cellSeed 派生 ∈[0,1)`（同格同流=重开重放一致，异格异流=50 火不齐翻——campfire-fx-core.js:32 既有注释即此纪律，§5.2 建议的正式兑现）；帧号 `frame = floor(((now + phase·T)/frameS)) % 3` 纯函数（now 只由 tick(dt) 推进，零墙钟零裸随机——fx-core 卫生扫描测试续用罩住）。翻页不逐帧改 UV：每火脏检（帧号/渐弱档位变化才写 8 顶点），稳态摊 O(1)/帧。
- **alphaTest 注记（g 边界句）**：焰片材质 `MeshBasicMaterial{map: atlasMat.map, alphaTest: 0.5, side: DoubleSide, vertexColors: true}`——alpha 真透裁切走 65/67 已验证管线（texture-atlas.js:568 注、world.js:297-298）；`transparent:false` 入**不透明队列**、depthWrite on、序无关；与烟粒子（`transparent:true, depthWrite:false` alpha 混合，effects.js:216-217）分属 opaque/transparent 两队列，three 渲染序 opaque 先于 transparent，**天然免排序免互扰**。

### e（含 h）. 两态切换运行时开销 + 台账重放渲染状态恢复

- **运行时开销（e）**：浇熄/重燃=「id 互换一笔编辑」既有链（adventure.js:972 → editBlockDirty → markDirty → remesh 队列 ≤2 帧滞后，world.js:800-838）——**与今日贴图路径同一次区块重建、同成本同拍，无新增**；焰片侧=fx.quench/open 即摘/即挂（O(该火 8 顶点)）。**不选**材质属性切换（静态件共享区块材质，物理上不可逐座切）；**不选** Group 重建（无 Group）；**不选**内容换装（tile 已分态，重建即换）。50 火同时浇熄的极端面=50 个区块重建入队——既有预算泵按帧出队兜底（与 50 火连置同量级，C6 放置链实测 0.4~0.5ms/火 摊放置过程）。
- **台账重放恢复（h）**：静态面**id 驱动**——读档 edits 重放→世界格 81/82 就位→meshChunk 直出对应态（:519 分派），漏不了；焰片面**fx 句柄驱动**——settle 逐燃烧格 `fx.open`（v1.8「重放点燃过渡」既有实现），sheet membership 只吃 `fx.cells()` 的 open 格→重建恰为燃烧集；熄灭态格 id=82 不 open→零焰片。**「熄灭态重建成燃态」bug 的两条歧路明令禁止**：①扫任意 campfire id（81∪82）建 sheet——会把熄态点着；②挂 chunk 网格重建事件建 sheet——把渲染恢复跟错了权威源。红线落断言：open=false 格永不贡献 plane（fx-core/sheet 同步逻辑纯函数化后可单测）。
- **Group 生命周期归属结论**：焰片产权跟台账重放走（经既有 fx open/clear 缝）、不跟 chunk 网格重建走；静态件无产权问题（id 即权威）。此归属不可逆，落 ADR（§7）。

### f. C6 基准重跑口径

- **定性：重立基线**（新基线 T-C6b 口径），旧收档作历史参照不作对照门槛——旧路径 dc 面从未测过（tc6 报告无 dc 字段），几何面已换血，帧时面可并排陈列仅供语境。旧收档不删（存档纪律）。
- **复用装具**：tc6 双口径（headless Chrome SwiftShader 页面口径 + node vm CPU 微测）原样复跑，场景复用（7×7 去四角+5=50 火，A 密集 step5/B 疏散 step18 + 空景基线，采样节拍同 tc6 §1-§3）。
- **新增观察面**：①**draw call 增量**：`renderer.info.render.calls` 采样，dc(50 火)−dc(空景) ≤100 判定（含区块 atlas 通道边角如实计入）；②三角量增量；③**50 火错相自然感**（设计线预告的验收面）：确定性结构断言——任一采样时刻 t，50 火帧号分布覆盖全部 3 帧+相位散布非同值（装具可程序判定，落 campfire-bench.test.js 族）；④焰片 sheet 同步 CPU 摊帧（node 口径微测）。
- **判定纪律沿用 tc6**：不在测试里自断帧率阈值；报告落判定（.scratch/campfire/tc13r-c6/ 收档，回填 spec §3.9 注记归经理线）。

### g. 三先例各自可借什么、边界在哪（+alphaTest 一句）

| 先例 | 可借 | 边界（不可外推处） |
|---|---|---|
| 十字片 `pushCross`（mesh-core.js:175-199） | alpha 面片+alphaTest 裁形语言；FrontSide 材质下「每面正反两绘+镜像 UV」的双面可见解法 | chunk 内**静态**满格面片、无逐火 UV 动画——焰片因翻页+错相必须脱离 chunk 静态批（这正是拆 sheet 的根因，也证明静态件不必跟着拆） |
| 薄块特殊渲染 `pushThin/pushBedBox/pushCampfireBox`（:68/:94/:140） | 多面盒发射原语、分面/分窗取 tile（采样窗 WINS 先例 :220）、跳底面惯例、**两态取光分口径**（out=面邻格，ADR 0012/pushGateSign 同构）、「图集通道无 colors 不乘 tint」纪律 | 全是**单盒**形态；多部件复合=同原语的新布局函数（CF_PARTS），不是新通道 |
| mob-look-kit 多部件装配（mob-look-kit.js:24-51） | 部件表驱动、纯数据缓冲、px→格换算、惰性 THREE | 为动态实体服务（骨骼/傀儡逐帧）；篝火静态件无逐帧自由度，入 chunk 批零装配成本更优；其 InstancedMesh 消费面在 mobs.js:63-85（c 题已评） |
| prefab-kit 场景装配（prefab-kit.js:1-32） | 声明式部件表+确定性落位+越界守卫纪律 | 装配**装场期静态结构**；篝火要运行时两态迁移，生命周期权威不同（id/台账 vs 蓝图一次性写格） |
| alphaTest 一句 | 65/67 已验证 alpha 真透+alphaTest 0.5 管线（texture-atlas.js:568、world.js:297-298）；焰片 74~76 沿用同一语义，且不透明通道序无关、与烟粒子（alpha blend）不需排序处理（d 题详） | — |

---

## 4. 几何布局建议值表（【实现自由度】缺省案；不变量=§4.4 断言）

格内局部坐标 [0,1)³，全确定性零随机（§4.5-3「无 rng 几何」）。**建议值**——施工可在不变量内微调（中缝交叠观感以近景探针验收）：

| 部件 | 落位（x×y×z 区间） | tile/UV 窗 | 备注 |
|---|---|---|---|
| 原木·沿 X ×2 | x∈[0.125,0.875]（长 0.75）·y∈[0,0.15]·z 心 0.29/0.71（截面 0.15） | 端面 68 窗 [4,12]×[4,12]；皮侧 69 窗 u 全幅×v∈[5,11] | 下层；贴地跳底面 |
| 原木·沿 Z ×2 | z∈[0.125,0.875]·y∈[0.075,0.225]（半搭互穿 0.075）·x 心 0.29/0.71 | 同上 | 上层；**半搭交错=交叠感在中缝、面不共面防 z-fight**；底面 0.075 在中缝可见，绘 |
| 炭堆主盒 | x/z∈[0.3,0.7]（0.4 见方）·y∈[0.15,0.30] | 顶=70/72 全幅；侧=71/73 窗 u 全幅×v∈[0,6]（0.4w:6px 与 0.15h 等比=方形像素密度） | 坐原木层上，与 Z 原木角部互穿非共面 |
| 炭堆小盒 ×1 | 0.2 见方，心 (0.56,0.56)，y∈[0.24,0.34]（沉入主盒 0.06） | 同主盒（侧窗等比缩 [0,8]×[0,4]） | **炭堆顶 0.34 ≤0.35**；静态整体顶 0.34 ≤0.5 |
| 焰片 A（法线 ±Z） | x∈[0.325,0.675]（宽 0.35）·y∈[0.26,0.71]（高 0.45）·z=0.5 | 帧 74/75/76 全幅（alpha 裁形） | 基部沉入炭堆 0.04=焰根衔接炭堆橙缝 |
| 焰片 B（法线 ±X） | 同 A 转 90°：z∈[0.325,0.675]·x=0.5 | 同上 | 2 片正交；顶 0.71<1.0 不出格 |

- **不变量（→几何断言面，§4.4）**：部件合计 ≤7（口径=静态件 4+1+1 + 焰片组 1 组=7，见 §9-1 裁定项）；织席两轴各 2 根交错；炭堆顶 ≤0.35；静态整体 ≤0.5；焰片 2 片 90°、高 0.4~0.5×宽 0.35；**任意两部件无共面重叠面**（静态 z-fight 免疫，程序可验：面片对 AABB 非共面判定）；**全部件 ⊆ 自有格**（拾取/邻格语义零污染，b 题配套）。
- 顶点量估算：静态 ≈128 顶点/座（旧扁盒 20）×50=6400——三角负载可忽略；取光语义继承后 lit 态自亮/熄态邻格点亮与今日完全一致（既有测 :1158/:1184/:1212 续用换载体）。

---

## 5. 性能方案（红线数值细化）

| 红线 | 定稿原文 | 本案细化口径 | 本案预期 |
|---|---|---|---|
| 每座 ≤2 mesh | §4.1 | 释义=**上限**非下限；静态专属 mesh 0/座（并入区块图集 mesh）+焰片共享 1/全场 | 0+共享 ≪2 ✅ |
| 50 火 dc 增量 ≤100 | §4.1 | 实测口径=同机同视角同场景 dc(50 火)−dc(空景)，renderer.info 采样，含区块通道边角 | ≈+1~+少数区块 ✅ |
| 部件 ≤7/座 | §4.4 | 计数口径=静态件+焰片组（§9-1） | =7 ✅ |
| C6 重跑 | §4.1 | §3-f 口径（重立基线+dc/三角/错相三新观察面） | R-6 票落 |

---

## 6. §5.2 裁量移交——技术侧建议（终裁归 design-lead）

- **火苗发射器：建议「降档保留」**——速率 6→**2 粒/s**（桌面）/3→**1 粒/s**（低核），尺寸/寿命/色生命周期不动。理由：①焰片承担火本体后，6/s 上升火苗粒有读「火星四溅」之险（spec §4.1 裁决 3 自己的否决逻辑外溢）；②完全移除损失近景「火在呼吸」点缀，且 §5.8 火苗粒子渐弱（速率 40%+色插值）是**已实现已测**的通道，移除=多删一段已绿代码；③降档=params 一行（`params.flame.rate`，campfire-fx-core.js:102）+bench 计数随动，可逆。观感影响面：每火常驻火苗粒上界 4.2→1.4，密集景总粒子上界 900→≈700（烟/旋涡不动）。**烟柱/气柱零改动**（裁决 4）。
- **焰片帧率档位（§5.8 语境）**：缺省 `frameS=0.15s/帧`（≈6.7fps 翻页，MC 量级）；渐弱期帧距 ×(1+tint)（0.15→0.30s 封顶=「火小了也慢了」）；低核恒 ×2（0.30s）。数值进 `params.flamePlanes` 参数表单源，design-lead 复核可调。
- 点燃渐起的焰片面（可选加分项）：open 后 0.5s 内 y-scale 0→1（与发射器渐起同拍 §5.5-2）；pop 已承担「噗」事件面，此项可裁——留 R-4 施工自选，验收不挂。

---

## 7. 不可逆决策 → 建议 ADR 清单

**建议合并落一份 ADR-0020《篝火渲染架构：静态驻 chunk 批+焰片共享 sheet》**（随 R-2 票落 docs/adr/，草稿要点如下）：

1. **静态部件驻 chunk 图集通道**，不立每座独立 Group/mesh（否决案：每座 Group=dc 顶格+新生命周期产权；InstancedMesh=逐火 UV 翻帧需自定义 shader 引新管线）。
2. **拾取政策**：方块交互恒走体素 DDA（voxel.js raycastVoxel），渲染部件/焰片零参与拾取；配套不变量「全部部件 ⊆ 自有格 [0,1)³」由几何断言守门（防未来有人把焰片伸出格顶后邻格拾取被遮）。
3. **焰片生命周期归属**：跟台账重放（fx 句柄 open/clear 缝）不跟 chunk 网格重建；membership 只吃 fx open 格；禁止扫任意 campfire id 建焰片、禁止挂区块重建事件建焰片（「熄灭态重建成燃态」类 bug 的结构性禁令）。
4. 图集 68~76 接线与 62~67 存档零删纪律延续（存档测试守着，texture-atlas.test.js:846/:881/:913/:932/:971/:998）。

（若评审认为 2/3 应独立成册，可拆 ADR-0020/0021 两份；内容无争议，建议合一份减少流转。）

---

## 8. 风险清单与守门测试面波及（逐名）

### 8.1 守门测试翻新（波及=绿测翻红面，逐文件逐测名列）

**test/texture-atlas.test.js（现 40 测，篝火相关 15）**：
- 翻新 9：`:814` 行宽断言（四张→九张，§4.5-5）；`:824` 布局接线（`81={top:64…}`→部件表 `{logEnd:68,logSide:69,top:70,side:71}`/82 同构 72/73，count 68→77）；`:1035` 焰色判据（64/65 灶面口径→焰帧 74~76 单帧 ≥80px/白芯亮黄 ≥20px，§4.4）；`:1069` 确定性（六格→九格全走）；`:1081` 图集相邻走查对象（62/63 vs 61→68~76 与 61~67 含存档区，fallback=70↔72/71↔73）；`:1098` meshChunk 两态扁盒→多部件断言（部件数/织席/高度预算/无底面/tile 分派）；`:1158/:1184/:1212` 顶点光两态断言（语义不变、载体换多部件）。
- 零改动 6：`:846/:881`（62/63 存档逐字符）、`:913/:932/:971/:998`（64~67 存档像素）——**存档红线测，翻红即违规**。
- 新增：68~76 九格像素/char art 逐字符断言、layout 部件表形状、（R-2）几何不变量（无共面/⊆格/部件 ≤7/高度预算）。
**test/campfire-fx-core.test.js**：新增 flamePlanes/flamePhase 段（相位确定性同格同流异格异流/帧号纯函数/渐弱降档数学）；§5.2 若降档→flame.rate 相关断言随动；源码卫生扫描（:550-571）续用且自动罩住新增面（零墙钟零裸随机）。
**test/campfire-bench.test.js（8 断言）**：火苗计数断言随 §5.2 降档改设计数学（若终裁降档）；R-6 新增错相/帧分布/dc 结构断言（或立新装具文件）。
**test/campfire-kit.test.js**：`:81-82` thin 0.4375 断言**零波及**（config 不动；它恰是「玩法数据面零变更」的在职守门——本票全周期必须保持其绿）。
**test/mesh-core.test.js**：火把/十字片等既有测零波及（预估，[[推断]]）；新增 pushCampfireParts 断言段。
**test/mesh-worker.test.js**：零波及（篝火走 Worker 路径由 boot 冒烟覆盖）。
**boot 全链冒烟 + conventions.test.js**：effects.js 改动后冒烟罩 sheet 装配/清场；模块头注五要素更新（mesh-core/effects/fx-core 三处头注契约）过守门。门禁对账：基线 2476/2475/0/1+净增列名（票面要求）。

### 8.2 工程风险

| 风险 | 概率×影响 | 对策 |
|---|---|---|
| 半搭互穿处观感穿帮（面片相交读「插穿」） | 低×低 | MC 同款互穿语言；近景探针走查；不变量只锁「非共面」，落位可调 |
| sheet 常驻恒绘被误报性能问题 | 中×低 | ADR+注记写明 200 三角量级；C6' 实测收档背书 |
| §5.2 降档牵动 bench 计数断言漏改 | 中×中 | R-3/R-6 票面互指；design-lead 终裁先行 |
| layout 部件表形状切换期（R-1→R-2 之间）中间态红 | 结构性 | R-1 只增 painters 不动 tiles[81]/[82]（保持旧接线全绿），R-2 一票内完成接线+mesh 切换+测翻新（见票图） |
| 体验馆/探险双模式装配差异漏走查 | 低×中 | 装配缝共享（place-kit 同缝）；§5.10 两模式同观感走查项续用 |
| PO 实机再不过（几何观感主观面） | 中×高 | §4.4 断言+近景探针+五锚实机前置（管线复验照 C13 模式）；布局数值留微调自由度不动结构 |

---

## 9. 设计线校阅清单（口径裁定项，非阻塞、均给缺省）

1. **部件计数算术**：定稿 §4.1「4+1+1~2+2=≤7」不自洽（4+1+2+2=9）；建议口径=静态件（4 原木+主盒+小盒×N）+焰片组（2 片计 1 组）≤7 → **缺省 N=1 恰 7**。若定稿要 2 小盒，需裁定「焰片不计部件」或放宽 8。
2. **「每座一个 Group」自由度解读**：本方案 0 专属静态 mesh+全场共享焰片 sheet，预算三项全优；请认可该解读属 §4.1【实现自由度】范围内（观感判据零偏离）。
3. **§5.2 转性终裁**：降档保留 2/1 粒/s 建议+观感影响面（§6）已给，移除案影响面同段。
4. **焰片帧率档位数值**：0.15s/帧缺省+渐弱 ×(1+tint)+低核 ×2（§6），请复核。
5. **小盒数量**：缺省 1（联动项 1）。

---

## 10. 证据索引（本方案引用过的源码位置一览）

mesh-core.js:33-40(FACES)/:68(pushThin)/:94(pushBedBox)/:140-167(pushCampfireBox)/:175-199(pushCross)/:217-250(pushTorch,WINS:220)/:519-524(campfire 分派)｜mesh-worker.js:15(importScripts)/:17-59(协议)｜world.js:45(scene)/:297-298(atlasMat)/:369(injectVoxelLight)/:414-428(makeTexGeo/addSceneMesh)/:433-458(mount/unload+退役注)/:460-463(全图常驻)/:493-501(worker 回挂)/:744-745(UPDRAFT_SIM)/:800-838(editBlockDirty/markDirty/pumpRemesh)｜voxel.js:150-190(raycastVoxel)/:513-525(烫伤计息)｜texture-atlas.js:38/:89-96/:466-467/:568/:1028/:1106/:1158｜campfire-fx-core.js:23-39(mulberry32/cellSeed)/:100-113(params)/:176-200(open)/:203-219(quench)/:224-242(burnout)/:246-255(dig/clear)/:258-390(tick)/:410-418(cellsList)/:429-456(emitters)｜effects.js:192-325(campfireField 族)/:216-217(粒子材质)/:404-424(clear)/:427-429(update)｜campfire-kit.js:106-113(plant)/:122-161(tick)/:165-171(drop)/:201-203(encode)｜modes/adventure.js:964-986(onQuench/onBurnout)/:1004-1022(fx 装配)/:2551-2572(读档 readd)/:3550(onPlaced)/:3575-3587(重燃钩)/:5391(台账重灌)/:5668(tryCampfireRelight)｜config.js:141-146/:529-545｜mobs.js:63-85(InstancedMesh)｜mob-look-kit.js:24-51｜prefab-kit.js:1-32｜test/texture-atlas.test.js:814/:824/:846/:881/:913/:932/:971/:998/:1035/:1069/:1081/:1098/:1158/:1184/:1212｜test/campfire-kit.test.js:81-82｜test/campfire-fx-core.test.js:129-133/:243-244/:550-571｜.scratch/campfire/tc6-bench-report.md｜docs/campfire-tickets.md:960-1011｜docs/design/campfire-visual-spec.md v1.10 §4/§5.2/§5.6/§5.8/§8
