# Midport Village 城镇架构设计（Town Architecture Design）

> 文档状态：**设计权威（Phase B 架构与任务拆解，承接 town-prefab-specs / town-ui-*-spec）**  
> 产出日期：2026-11-12  
> 适用分支/工件：`town-design`（Phase B 仅架构与票据，不含实现代码）  
> 权威输入：[`docs/town-map-design.md`](town-map-design.md) · [`docs/town-villagers-design.md`](town-villagers-design.md) · [`docs/design/town-prefab-specs.md`](design/town-prefab-specs.md) · [`docs/design/town-ui-entry-hud-spec.md`](design/town-ui-entry-hud-spec.md) · [`docs/design/town-ui-dialog-spec.md`](design/town-ui-dialog-spec.md) · [`docs/design/town-buildings-visual-spec.md`](design/town-buildings-visual-spec.md) · [`docs/design/town-villagers-visual-spec.md`](design/town-villagers-visual-spec.md) · [`docs/town-assets-requirements.md`](town-assets-requirements.md) · [`docs/minecraft-movie-town-research.md`](minecraft-movie-town-research.md) · [`docs/adventure-maps-design.md`](adventure-maps-design.md) · [`docs/dimension-registry-design.md`](dimension-registry-design.md) · [`GLOSSARY.md`](../GLOSSARY.md) · [`MISSION.md`](../MISSION.md) · [`docs/conventions.md`](conventions.md)
> **2026-11-13 PO 变更**：集成 seam 变更——城镇改以 `ADV_DIMS` 维度行接入冒险模式（[ADR-0011](adr/0011-town-dimension-seam-and-entry-transit.md)，取代 ADR-0009），撤独立模式入口三件套。本文 §3.1／§6（独立模式集成设计）与 §11 T-MAP-02 保留历史语境；**新缝施工单／撤卡节拍／salvage 裁定／需求线残留处置见 §13**。

## 1. 目标与边界

- **目标**：为 Midport Village（和平、可探索、点选交互、轻任务锚点）给出可落地架构：模块边界、依赖方向、Prefab/Scene 素材流入路径、UI 接线与实现票据拆解，使后续施工可按票 TDD/并行推进且不破坏既有模式。
- **非目标（本阶段不做）**：不写 `js/` 实现、不改 `index.html`/测试、不拍板 PO 待确认项（`town-map-design.md` §8、UI specs §8、villagers §8）——票据中显式标注【待 PO 确认】依赖与默认建议承接。
- **体验约束**（MISSION + town 设计）：6 岁、纯鼠标点选、图标+中文 TTS、无键盘/指针锁定依赖、过程性表扬/零惩罚/零倒计时；固定明亮白天主态、无战斗/无怪物入侵/无死亡惩罚（默认）。
- **视觉/素材权威**：`docs/design/town-prefab-specs.md` 为**城镇建筑/场景件/植被落库契约的 sole authority**（蓝图名、`footOf`、`v` 面、材质注入、SceneKit 树家族映射、场景拼装分类）；与其他文档冲突处以 PrefabKit/SceneKit 框架契约为准改写/对齐实现，争议回退需求线澄清。

## 2. 现状锚点（与既有系统的对齐事实）

| 现状 | 位置 | 对城镇的意义 |
|---|---|---|
| 模式装配 seam：`MODE_REGISTRY` 行 + `index.html` 卡/页/script + `js/modes/<id>.js` | `js/mode-registry.js` · `index.html` | 新独立体验首选 ModeRegistry 行装配；三重命名有测试断言 |
| 场景装填 seam：`loadScene(buildFn)` 清场→建→渐进收尾 | `js/world.js` · GLOSSARY「场景装填」 | 城镇建场复用同一 seam，首屏近处优先 |
| 冒险地图注册表：`ADV_MAPS` 行（build/palette/nests/nightPool/gates/livestock）+ `advSetMap`/分桶账本 | `js/adventure-maps-core.js` · `js/modes/adventure.js` | 面向“远征/战斗/生态池”地图；城镇和平语义不匹配其池/门职责 |
| 维度注册表：`ADV_DIMS` 行（切界政策/天空/恒暗/刷怪相位） | `js/adventure-dims-core.js` | 面向 nether/den 等相位；城镇无相位战斗语义 |
| 蓝图件库：`PrefabKit.place/footOf`，行表自持，材质 id 注入，按形命名，`v` 白名单+拼写 throw，越界不写 | `js/prefab-kit.js` · `test/prefab-kit.test.js` | 城镇新增建筑件 ingest 的唯一引擎落点 |
| 场景工具：`SceneKit.fill/tree/pine/pineSnowy/scrub/rand/heightAt`，几何与落位政策分线 | `js/scene-kit.js` | 植被与地表/拼装复用；落位政策属调用方 |
| UI/HUD 组装先例：`ModeKit`/`mkMode`、训练营 `CampKit` | `js/mode-kit.js` · `js/camp-kit.js` · `js/modes/*` | 城镇 HUD/提示/交互态按应用层组装，复用既有 kit 能力 |

## 3. 架构决策总览（不可逆项见 ADR）

1. **集成 seam（ADR 0009）**：城镇作为**独立游玩模式** `town`（ModeRegistry 行 + `js/modes/town.js`）接入，不并入 `ADV_MAPS`/`ADV_DIMS`。理由：城镇为和平漫游+NPC 轻任务语义，无巢穴/夜怪池/门阵解锁/维度战斗政策；独立模式可最小化对 adventure 状态机侵入，依赖方向清晰（应用模式 → 引擎 kit）。与“探险/训练营结合”通过共享交互语言、可复用 kit 与后续入口联动承接（见 §6），不以运行时并入 adventure 壳为前提。（**2026-11-13 PO 变更取代**：独立模式缝被维度缝取代——城镇以 `ADV_DIMS` 维度行接入，撤独立入口三件套，见 [ADR-0011](adr/0011-town-dimension-seam-and-entry-transit.md) 与本文 §13；本条保留历史语境。）
2. **素材流入与 sole authority（ADR 0010）**：建筑/关键场景件按 `town-prefab-specs.md` **逐项 ingest 入 PrefabKit 行表**（形状驱动、材质注入、`v` 显式覆写、`footOf` 同参同盒）；植被用 SceneKit 树家族；地表/道路/远景/小道具散布归场景拼装（调用方）。樱花粉冠等材质差异按“调用方覆写层/后续扩展点”处理，不在本阶段改写 SceneKit 树内核契约、且不把树几何散写回模式层。冲突裁决一律以 prefab-specs + PrefabKit/SceneKit 契约为准。
3. **UI 分工与 route**：分区 A（`town-ui-entry-hud-spec.md`）与分区 B（`town-ui-dialog-spec.md`）按 §0.3 接口协作；**所有 UI 实现/规格落地票必须标注 ui-designer route**（见 §7.3）。

## 4. 模块边界与依赖方向

### 4.1 分层与依赖规则（硬约束）

- **引擎层不知道玩法**（conventions §1.6，GLOSSARY）：`js/prefab-kit.js`、`js/scene-kit.js`、`js/world.js`、`js/voxel.js`、`js/mode-kit.js` 等引擎/通用装配件**不得**引入城镇剧情、NPC 台词、任务判定或模式专属政策。
- **应用层可依赖引擎，引擎不得依赖应用**：城镇模式与其数据/装配模块可读用 PrefabKit/SceneKit/ModeKit/Input/Audio/Speech 等全局 API；不得反向把 town 知识写入引擎。
- **视觉 sole authority 边界**：几何与材质槽归 PrefabKit 行/`v` 注入与 SceneKit；落位政策（密度、避让门窗视线、包门禁）、任务触发、NPC 行为属于应用层（town build/logic），与几何分线。

### 4.2 目标模块划分（建议落点，施工票细化文件名）

| 模块（建议） | 层 | 职责（interface 摘要） | 依赖（调用期） | 可测性 |
|---|---|---|---|---|
| `js/prefab-kit.js`（扩展行表） | 引擎层 | 新增 `tower-belfry/shop-awning/stash-hut/windmill-tower/cottage-gable/house-loft/stall-canopy/board-pool` 行；`place/footOf` 契约不变 | voxel/config/scene-kit 既有 | **同名单测扩展**（`test/prefab-kit.test.js`，TDD） |
| `js/scene-kit.js`（不改内核为默认） | 引擎层 | 复用 `tree/pine/pineSnowy/scrub/fill/rand/heightAt` | voxel/config | 既有测试守卫；无必要不改 |
| `js/town-map-core.js`（新增，建议） | 应用层纯核心 | 城镇布局常量与装配计划：核心区尺寸/地标锚点/路网占位/点位清单（Prefab/SceneKit/拼装分类引用 `prefab-specs` id 与槽位），输出确定性 build 步骤数据；**零 THREE 零 DOM** | 仅数据与纯函数，可读 `prefab-specs` 对齐常量 | **同名单测**（`test/town-map-core.test.js`） |
| `js/modes/town.js`（新增） | 应用层·模式壳 | `mkMode` 装配、`loadScene` 建场编排、镜头/出生/输入（纯鼠标点选）、HUD/提示/指引/对话状态机接线、TTS/音效路由、会话与（若有）轻存档策略 | ModeKit/Input/SpeechKit/AudioMixer/PrefabKit/SceneKit/town-map-core 等 | 经 boot 冒烟；复杂逻辑下沉 core |
| `js/town-ui-core.js`（可选拆分） | 应用层纯核心/轻装配 | 提示优先级、任务锚点状态、指引目标选择等纯决策（与分区 A/B 状态契约对齐） | 纯数据/注入 | 同名单测（若拆分） |
| `index.html` + `js/mode-registry.js` + `css/*`（接线票） | 应用装配 | 新增卡片/页/script 行、城镇样式命名空间 | 既有约定 | `test/mode-registry.test.js`/conventions/boot |

> 说明：`town-map-core` 命名与粒度可在实现票中微调，但**“纯布局/计划 vs 渲染/交互装配”分离**与**引擎无玩法**不可破。

## 5. 素材件流入路径（prefab-spec → PrefabKit/SceneKit → town assembly）

### 5.1 流程

1. **权威对照**：逐件以 `docs/design/town-prefab-specs.md` 为准（§3 总览映射、§4 新增/复用件规格、§5 植被与拼装分类），并对齐 `town-buildings-visual-spec.md` 的体量/分层意图（材质经 `ids/mat/top/rock` 注入，不焊死）。
2. **Prefab ingest（引擎层，TDD 先行）**：在 `js/prefab-kit.js` 行表新增 §4.1–§4.8 所列 8 个新行；`cache-cellar` 直接复用 `under-room`、`hill-mound` 复用 `mound`（不新增行，仅在 town 装配侧给 `v`）。每个新行：实现 `kernel/foot/defaults/require/facing0` 与 `v` 白名单，遵守错误两档（拼写域 throw、数值域钳）、逐格越界不写、`footOf` 零写同盒。
3. **测试镜像**：每新增 PrefabKit 行在 `test/prefab-kit.test.js` 增补同风格断言（oracle/形状第二意见/脚印包含/朝向×mirror×变体/确定性/错误两档/必要源守门），保持“同名测试承载新增契约”的习惯（与既有 stilt-hut/under-room/mound 组一致）。
4. **SceneKit 植被**：樱花树与绿植按 `prefab-specs` §5.1 使用 `SceneKit.tree/scrub`（必要时 `pine`）。粉冠等材质差异由**调用方覆写层**在装配阶段处理（如落位后按占用格替换叶材质 id 的 town 侧 helper），不在文档或实现中复制散装树几何；几何与落位政策分线。
5. **场景拼装**：道路/广场铺装/农田田埂/远景剪影/灯柱桶箱围栏旗帜等按 `prefab-specs` §5.2 走 `SceneKit.fill`、高度场与调用方散布逻辑（`town-map-core` 产计划 + `modes/town.js` 执行），不强行塞入 PrefabKit 行表。
6. **Town assembly**：`town` 模式 `init` 经 `loadScene(buildFn)`：先地表与路网基底 → 再按布局计划 `PrefabKit.place` 建筑件（锚点/face/mirror/v.ids 来自计划与材质映射）→ 再 SceneKit 植被与道具散布 → 最后出生点/相机/交互点注册与 HUD 初始化。建场顺序需保证“后写者赢”纪律显式（与 PrefabKit 内核写序同理在装配层记录）。

### 5.2 材质注入与配置约定

- PrefabKit 行 `ids/mat/top/rock/cap/land` 等槽**必须由调用方注入或走行内安全缺省**（缺省仅限引擎已定义裸数字且与契约一致处）；城镇配色映射表（暖木/陶橙/浅石/奶油等语义 → 方块 id）应集中在应用层常量/计划数据（建议 `town-map-core` 或独立 `town-palette` 数据段），便于 PO 调色而不触碰引擎。
- 禁止在引擎行内硬编码“Lava Chicken/钟塔”等玩法命名语义；按形命名已由 spec 锁定。

## 6. 与现有系统的集成设计

> **2026-11-13 PO 变更**：§6.1（独立模式入口/模式页）随 [ADR-0011](adr/0011-town-dimension-seam-and-entry-transit.md) 撤卡节拍撤除；§6.2「不接入 ADV_MAPS/ADV_DIMS」变为「以 `ADV_DIMS` 维度行接入」——两节保留历史语境，现行为以 ADR-0011 + [`town-map-design.md` §6.3](town-map-design.md) 为准；§6.3 存档最小化原则不变（维度 pos 不进档先例自动满足）。

### 6.1 ModeRegistry / 入口与模式页

- `MODE_REGISTRY` 新增行（建议）：`{id:'town', name:'小镇漫步', gated:true, mood:'calm'}`（命名/TTS 以 UI spec §3.2 与 PO 确认为准，默认值可先落实现票）。
- `index.html`：新增 `cardTown`（与既有卡片结构同构，emoji/像素图标占位按 UI-01 方向）与 `menuTown`（如采用进入页）及 `js/modes/town.js` script；加载序置于引擎/kit 与 `mode-registry.js` 之前（与其他模式一致）。
- 进入城镇：默认**无二次确认**直接过渡（UI spec U3 建议）；复用 `#fade`/splash 语义的轻量过渡，不引入倒计时进度焦虑。

### 6.2 与 Adventure / Dimension 系统的关系

- **不接入 `ADV_MAPS`**：`ADV_MAPS` 行强绑定 `nests/nightPool/livestock/gates` 等冒险生态与切图政策；城镇无这些机制，强行并入会污染数据契约与壳层分支。
- **不接入 `ADV_DIMS`**：城镇非 nether/den 类维度相位，无恒暗战斗/HUD banner/刷怪门禁语义。
- **体验联动（设计锚点，后续票）**：`town-map-design.md` §6 所列“观察-寻找-回应/轻任务”可与探险/训练营的**产品层目标**对齐；实现上可共享 `ModeKit` 交互范式、`SpeechKit`/TTS、掉落/收集若未来引入则经既有 inventory 背包壳策略评估——本架构不预设与 adventure 存档/桶账本耦合。若未来需要“从探险世界进入城镇”入口，可作为独立票增加 mode switch 触发点，不改变本阶段“城镇=独立模式”主 seam。

### 6.3 进度/会话与存档（最小化原则）

- 城镇默认零惩罚、可随时离开；若需记忆“已完成的轻互动/导览状态”，建议独立轻量槽（`SyncDB.slot`）或会话内状态，**不复用** adventure `*_world_save` 分桶语义（避免与冒险账本耦合）。具体键名与字段由实现 spec/票据定，本架构仅约束“不得侵入冒险存档格式”。

## 7. UI 接线架构（分区 A/B，ui-designer route）

### 7.1 分层与数据流

- **世界/交互态（应用层）**：可交互对象命中（NPC/道具/地标锚点）、当前轻任务目标 id、会话状态机（Idle/Bubble/Greet/Guide/Seek/Help/Respond/Praise/Complete）产出 UI 事件；世界锚点投影与 3D 侧高亮/标记由 town 模式或 town-ui 装配层驱动。
- **HUD/提示层（分区 A）**：入口卡样式落点（`index.html`/`css`）、城镇内 HUD 锚点布局、L1 主提示卡、L2 方位指引（推荐 Landmark Pointer）、L3 过程性表扬浮现、L4 系统轻入口、A↔B 接口事件消费（`town-ui/dialog/*` 语义由实现对齐 specs）。
- **会话层（分区 B）**：World Bubble + 底部 Session Panel + Option Chip + 无压力关闭/重播 TTS；会话打开时收敛 A 侧非必要 HUD；完成回执与全局任务条分工按 `town-ui-dialog-spec.md` §2/§7。

### 7.2 约束

- 纯鼠标点选；热区 ≥44px 等效；无倒计时/失败态/警示红语义；动效克制。
- TTS 经统一语音出口（如 `SpeechKit`/既有音频约定）排队，避免会话与氛围抢话（具体仲裁实现票定）。
- UI 资产语义对齐 `town-assets-requirements.md` UI-01~UI-05；图标/底板风格与 A/B spec 一致。

### 7.3 ui-designer route（强制）

凡票据类型涉及 **HUD/菜单/覆盖层/对话/气泡/提示卡/指引器/高亮状态/入口卡视觉实现或规格细化落地**，票据字段必须包含：
- `ui_designer_route: required`
- `ui_scope: A|B|A+B`（对应 entry-hud / dialog / 交界）
- `ui_refs:` 指向 `docs/design/town-ui-entry-hud-spec.md` 与/或 `docs/design/town-ui-dialog-spec.md` 相关章节

并在验收中包含“与 ui-designer 评审/走查记录”检查项（实现阶段）。

## 8. 性能与 6 岁/时间预算约束

- **地图规模**：默认核心可玩区 ~96×96（`town-map-design.md` §3），建筑体量与 LOD/远景按“不可达剪影低细节”策略（`prefab-specs` §5.2）；避免首版引入高密度动态光/粒子。
- **建场与运行**：复用 `loadScene` 渐进收尾（先脚下后远景）；Prefab/拼装写入走批次可控顺序，避免单帧巨量同步峰值超出可接受范围（实现票需在目标设备档位做 smoke/profile 记录）。
- **对象与更新**：NPC/氛围动物/道具高亮采用事件驱动更新与可见性裁剪思路（与 6 岁注意力友好一致：同屏主提示单一、动效低频）；HUD 文本/图标状态按签名/脏标刷新，避免每帧重建 DOM。
- **时长与节奏**：轻任务单步 30–90s、核心区 3–10 分钟可自由探索（`town-map-design.md` §6）；无倒计时 UI，不在技术层引入强制计时压力。与全局儿童时限（`gated` 模式）策略一致，由既有预算系统承接（不在城镇内另造预算账本）。
- **低端设备**：延续 `QualityCore`/距离与渲染既有分档能力（如适用）；城镇首版美术密度与 NPC 数量应可配置降级（实现票预留档位参数）。

## 9. 风险、待确认与依赖

| 类别 | 项 | 影响 | 处理 |
|---|---|---|---|
| PO 确认 | `town-map-design.md` §8（M1–M8）、UI specs U1–U8/B1–B8、villagers V1–V7 | 命名、规模、首版范围、指引策略、TTS/反馈细节 | 票据携带默认建议；阻塞项标注依赖，非阻塞项可先实现可替换参数 |
| 素材扩展 | 樱花粉冠材质（SceneKit tree 固定叶 id 现状） | 视觉还原度 | 应用层覆写/后续扩展点；不破坏树几何契约（ADR 0010） |
| 角色/动画资产 | NPC 模型与行为表现属独立管线 | 交互可玩性节奏 | Phase B 票据先落地图/UI/Prefab ingest；角色接线票与资产票并行排期 |
| 性能 | 96×96 + 多 Prefab + NPC/HUD | 低端帧率 | 建场分批、对象预算、分档开关纳入验收 |

## 10. 交付物索引（本 Phase B）

- 架构设计：本文档
- ADR：[`docs/adr/0009-town-standalone-mode.md`](adr/0009-town-standalone-mode.md)（**2026-11-13 PO 变更：已被 0011 取代**）、[`docs/adr/0010-town-prefab-ingest-and-material-authority.md`](adr/0010-town-prefab-ingest-and-material-authority.md)、[`docs/adr/0011-town-dimension-seam-and-entry-transit.md`](adr/0011-town-dimension-seam-and-entry-transit.md)
- 票据拆解与 PO 摘要：§11、§12

## 11. Tracer-bullet 票据拆解

> 约定：**TDD 先行**适用于 Prefab ingest 与新增纯核心（`-core`）；每票自包含验收与 blocking。UI 票一律 `ui_designer_route=required`。实现顺序硬约束：**(1) Prefab ingest → (2) Town map assembly → (3) UI wiring**（同组内可按 blocking 并行）。
> **2026-11-13 PO 变更**：T-MAP-01..04 已施工交付（台账关票先例 99ed7a0）；其产物处置（保留/转用途/撤除）逐件裁定见 §13.3——T-MAP-02 产物（模式骨架三件套）随新缝撤卡节拍撤除；新缝施工单 T-SEAM-01..05 见 §13.1。

| 票号 | 标题 | 类型 | 依赖 | blocking(阻塞) | 验收（摘要） | ui_designer_route | 需 tdd | 关键产物/备注 |
|---|---|---|---|---|---|---|---|---|
| T-PREFAB-01 | ingest `tower-belfry`（钟塔） | prefab-ingest | 无（PrefabKit 现状） | T-MAP-* | 按 `prefab-specs` §4.1：新增行、`v` 白名单/ids 注入、`footOf` 同盒零写、4 朝向×mirror×变体覆盖、oracle/形状/脚印/确定性/错误两档测试全绿；材质不焊死 | no | yes | `js/prefab-kit.js` 行 + `test/prefab-kit.test.js` 扩展 |
| T-PREFAB-02 | ingest `shop-awning`（Lava Chicken 店） | prefab-ingest | T-PREFAB-01 可并行 | T-MAP-* | §4.2：暖光装饰意象槽 `ids.glow` 等，禁熔岩/火语义；契约与测试同上 | no | yes | 同上 |
| T-PREFAB-03 | ingest `stash-hut`（储藏小屋） | prefab-ingest | 可并行 | T-MAP-* | §4.3：小屋几何与 `v`；与 `under-room` 组合使用由 assembly 负责（不强绑） | no | yes | 同上 |
| T-PREFAB-04 | ingest `windmill-tower`（风车） | prefab-ingest | 可并行 | T-MAP-* | §4.4：`sailStatic` 默认 true，叶片展向计入 `footOf`；朝向变体正确 | no | yes | 同上 |
| T-PREFAB-05 | ingest `cottage-gable`（民居 A） | prefab-ingest | 可并行 | T-MAP-* | §4.5：门窗/顶/可选烟囱（无烟）参数与脚印正确 | no | yes | 同上 |
| T-PREFAB-06 | ingest `house-loft`（民居 B） | prefab-ingest | 可并行 | T-MAP-* | §4.6：错层错顶包围盒与朝向/镜像正确 | no | yes | 同上 |
| T-PREFAB-07 | ingest `stall-canopy`（市集摊位） | prefab-ingest | 可并行 | T-MAP-* | §4.7：`size/theme` 变体与材质注入；低高度不遮挡契约由布局票保证，几何自洽 | no | yes | 同上 |
| T-PREFAB-08 | ingest `board-pool`（P2 彩蛋） | prefab-ingest | 可并行（可后置优先级但仍属 ingest 组） | T-MAP-*（若启用 P2） | §4.8：静态水色占位块、无流体/危险语义；`footOf` 含跳板+池联合盒 | no | yes | 同上；受 M2 范围确认 |
| T-PREFAB-09 | 复用行验收与材质映射基线（`under-room`/`mound`） | prefab-ingest(集成校验) | T-PREFAB-01..07 | T-MAP-* | `cache-cellar` 以 `under-room`、`hill-mound` 以 `mound` 的 `v` 覆写样例在测试或夹具中可复现；不新增行不破坏既有契约 | no | yes(补充用例) | 测试/夹具用例 |
| T-MAP-01 | `town-map-core` 布局与建场计划（纯数据） | town-assembly(core) | T-PREFAB-01..07,09 | T-MAP-02,T-MAP-03 | 产出 ~96×96 核心区锚点/分区/Prefab 实例清单（id,x,y,z,v,face）+ 地表/道路/远景/散布分类标记；与 `town-map-design` §3-§4、`prefab-specs` §3 映射一致；确定性输出可测 | no | yes | `js/town-map-core.js` + `test/town-map-core.test.js`（建议） |
| T-MAP-02 | `town` 模式骨架与 `loadScene` 装配 | town-assembly(mode) | T-MAP-01, T-UI-00 | T-MAP-03,T-UI-* | ModeRegistry 行、`index.html` 卡/页/script、`js/modes/town.js` 最小可进场；`loadScene` 顺序正确、出生点面向广场/可回望钟塔意图；`npm test`/boot 绿 | A(入口卡) | partial(纯逻辑下沉 core) | 模式注册三件套 + 入口 UI 骨架（**2026-11-13 PO 变更**：本票产物随新缝撤卡节拍撤除——ADR-0011 决策 5/6d，装配意图由 town 维度行 build 闭包继承） |
| T-MAP-03 | 建筑/场景件/植被与地表拼装落地 | town-assembly(scene) | T-MAP-01,T-MAP-02 | T-UI-02,T-UI-03 | 按计划调用 `PrefabKit.place`（材质注入集中映射）+ SceneKit 树/`fill` + 道具散布；樱花材质覆写策略落在调用方；无散装树几何；关键地标可达与视线通廊符合 map 设计 | no | partial | 建场函数与材质映射常量 |
| T-MAP-04 | 交互锚点与轻任务状态钩子（无 UI 细化） | town-assembly(logic) | T-MAP-02 | T-UI-02,T-UI-03 | 注册 NPC/地标/道具交互点与目标 id 协议（供指引/提示消费）；与 B 会话状态机接口对齐（§0.3）；零惩罚可离开 | no | yes(若抽 core) | `town-ui-core` 或等价状态模块 |
| T-UI-00 | 入口卡与进出过渡视觉规格落地准备 | ui-wiring(spec/design handoff) | 无 | T-MAP-02,T-UI-01 | 输出实现可直接引用的 token/资产占位清单（卡片色/图标/文案默认值 U1-U3）；过渡节奏与禁止项清单对齐 | **required (A)** | no | ui-designer 交付物/批注；`ui_refs: entry-hud-spec §3` |
| T-UI-01 | 城镇内 HUD 布局与任务提示容器（分区 A） | ui-wiring | T-MAP-02,T-UI-00,T-MAP-04 | T-UI-04 | L1-L4 布局锚点、安全区、无倒计时/无失败态；提示卡状态（进行中/完成一步）与 TTS 重播入口；与对话层级避让 | **required (A)** | partial | DOM/CSS/装配；`ui_refs: entry-hud-spec §4` |
| T-UI-02 | 方位指引（Landmark Pointer）与目标消费 | ui-wiring | T-UI-01,T-MAP-04 | T-UI-04 | 默认简化地标指引（U4/U5 默认）；钟塔/任务锚点目标切换、近距弱化；无闪烁、低负荷 | **required (A)** | partial | `ui_refs: entry-hud-spec §5` |
| T-UI-03 | 可交互高亮/标记与点选反馈（分区 A 侧） | ui-wiring | T-MAP-03,T-MAP-04,T-UI-01 | T-UI-04 | 默认/悬停/按下/完成态按 spec；与世界命中对齐；色弱友好形状区分；与 UI-03 资产语义一致 | **required (A)** | partial | `ui_refs: entry-hud-spec §6` |
| T-UI-04 | 会话 UI（气泡+面板+选项）与 A/B 接口闭环（分区 B） | ui-wiring | T-UI-01,T-UI-03,T-MAP-04 | T-UI-05 | Bubble/Session Panel/Option Chip/再听一次/稍后；状态机与 `dialog/open|update|close` 接口；会话内表扬呈现与 A 任务条分工；TTS 排队意图 | **required (A+B)** | partial | `ui_refs: dialog-spec §4-§7, §2` |
| T-UI-05 | UI 联调、可达性走查与文案/TTS 默认值落地 | ui-wiring(polish) | T-UI-01..04 | 发布候选 | 纯鼠标可达、热区、对比度抽查、无压力文案、过程性表扬节奏；PO 默认值（U1-U8/B1-B8）参数化；ui-designer 评审记录附票 | **required (A+B)** | no | 走查清单与参数表 |

### 11.1 关键 blocking 边（汇总）

- `T-PREFAB-01..09` → `T-MAP-01..03`（库件未就绪不得 assembly 依赖缺失几何）
- `T-MAP-01` → `T-MAP-02,03`；`T-MAP-02` → `T-UI-01..04`
- `T-UI-00` → `T-MAP-02,T-UI-01`（入口视觉输入）；`T-MAP-04` → `T-UI-02,03,04`（目标与交互态）
- `T-UI-01..04` → `T-UI-05`

### 11.2 并行建议

- Prefab ingest 组内：`T-PREFAB-01..08` 可按人并行（同文件冲突需串行合并），`T-PREFAB-09` 收口。
- Assembly：`T-MAP-01`（core）与 `T-UI-00`（设计交付）可并行；`T-MAP-02/03` 在 ingest 与 core 就绪后推进。
- UI：`T-UI-01/02/03` 在骨架与锚点就绪后部分并行，`T-UI-04` 依赖 A 侧容器与接口。

## 12. PO Architecture Summary（产品/排期视角）

### 12.1 一句话

城镇以**独立模式 `town`（小镇漫步）**落地：先把 `town-prefab-specs` 的建筑件 **TDD ingest 进 PrefabKit**，再用 **SceneKit + 场景拼装**组装 ~96×96 和平小镇，最后按 **UI 分区 A/B（强制 ui-designer 路由）**接入 HUD/指引/对话与轻任务提示；不改动 adventure 地图/维度注册表语义。

（**2026-11-13 PO 变更**：集成口径已被维度缝取代——城镇以 `ADV_DIMS` 维度行接入冒险模式，主路尽头白闪过场进镇，撤独立模式入口；见 [ADR-0011](adr/0011-town-dimension-seam-and-entry-transit.md) 与本文 §13。素材 ingest 与 UI 分区结论不受影响。）

### 12.2 价值与范围

- **交付价值**：可识别的 Midport Village 空间骨架 + 可发现的点选交互 UI（入口、提示、指引、会话）+ 可扩展的轻任务锚点，为 6 岁低压探索与注意力友好“观察-寻找-回应”提供载体。
- **首版默认范围建议**：P0+P1 建筑与场景件优先，P2 彩蛋（`board-pool`/额外摊位变体）按 M2 确认后置；远景剪影必做山体轮廓、其余按 M7。
- **明确不做（首版）**：战斗/入侵/倒计时惩罚、复杂小地图、与 adventure 战斗存档耦合、真实熔岩/危险流体行为。

### 12.3 里程碑（建议）

1. **M0 素材库就绪**：`T-PREFAB-01..09` 合并，`npm test`/`npm run lint` 绿（新增 prefab 行与同名测试覆盖）。
2. **M1 可进城镇**：`T-MAP-01..03` 完成，可从主菜单进入、场景可读（钟塔/广场/主路/关键地标）。
3. **M2 可交互与可引导**：`T-UI-00..04` 完成，提示/指引/高亮/对话闭环可用，ui-designer 走查通过。
4. **M3 打磨与验收**：`T-UI-05` + 性能/可达性检查 + PO 待确认项收口。

### 12.4 依赖与决策待办（PO）

- 确认城镇命名/文案/TTS（U1）、入口图标与过渡（U2/U3）、指引与任务显隐策略（U4–U6）、反馈节奏（U7）、A/B 联调顺序（U8/B8）。
- 确认地图规模与首版地标范围（M1/M2）、昼夜与危险元素（M3/M4）、Steve 形象边界（M5）等（`town-map-design.md` §8）。
- 角色命名/出场与动物密度等（`town-villagers-design.md` §8）影响会话内容与资产，但不阻塞 M0–M1 地图骨架。

### 12.5 验收门槛（阶段出口）

- **工程门槛**：每合并批次 `npm test`、`npm run lint` 通过；Prefab ingest 票附同名测试证据。
- **体验门槛**：纯鼠标点选可完成“进入→识别地标→获得提示→点选交互/对话”主路径；无倒计时/无失败惩罚 UI；过程性表扬反馈符合 MISSION。
- **一致性门槛**：几何/材质落位与 `town-prefab-specs.md` 一致；UI 行为与 A/B specs 接口边界一致；新增文档已入 `docs/README.md` 索引。

## 13. 新缝施工单与撤卡节拍（**2026-11-13 PO 变更**，ADR-0011 承载）

> **变更背景**：PO 拍板进镇=冒险模式 home 图主路尽头维度过场、撤独立模式入口（急件与停工令原文见 `.scratch/handoffs/2026-11-13-urgent-po-change-detach-town-entry.md`）。机制权威=[`town-map-design.md` §6.3](town-map-design.md)；ADR=[`adr/0011-town-dimension-seam-and-entry-transit.md`](adr/0011-town-dimension-seam-and-entry-transit.md)；视觉权威=[`design/town-entry-transition-visual-spec.md`](design/town-entry-transition-visual-spec.md)；事实底座（坐标/file:line 唯一权威）=`.scratch/town-seam-change/research-map-facts.md`。本节票据沿用 §11 体例；**恒开放政策为 PO 拍板（§8 M9）——任何票不得引入条件开放变体（任务解锁/时段窗/渐进解锁一律挡回）**。

### 13.1 新缝施工单（T-SEAM-01..05）

| 票号 | 标题 | 类型 | 依赖 | blocking(阻塞) | 验收（摘要） | ui_designer_route | 需 tdd | 关键产物/备注 |
|---|---|---|---|---|---|---|---|---|
| T-SEAM-01 | `ADV_DIMS` town 维度行注册（ADV_TOWN 结构常量+炉键前缀+加载位上移） | town-dim(core) | 无（`js/town-map-core.js`/`js/town-assembly-core.js` 已交付） | T-SEAM-02,03,04,05 | 按 [`town-map-design.md` §6.3.3](town-map-design.md) 行规格表逐字段落 town 行：id `'town'`／build 闭包（先懒引现 `townBuild`，T-SEAM-05 改直引）／sky 暖亮白天四参（值随实施按 buildings visual spec §4 色板定）／mood `'calm'`／**dayCycle:false**（恒白天≠恒夜，引擎语义见 §6.3.3）／spawn `{x:79,y:25,z:112,yaw:0}` 派生自 `TOWN_MAP.anchors`（js/town-map-core.js:44-47，y=groundY+1 站立面，face:'north'→yaw 0 按 townSpawnIntent/townYawOfFace 派生口径）／hud `{banner:'🏘️ 小镇 · Midport Village', showMobs:false}`（横幅文案终稿归 ui-designer）／assets `null`。**ADV_TOWN 结构常量**：坐标唯一权威仍是 TOWN_MAP（GLOSSARY「城镇地图核心」），ADV_TOWN 只派生引用（core/groundY 引 `TOWN_MAP.core`、spawn 引 `TOWN_MAP.anchors`）**不抄第二份坐标**。`ADV_FURN_PREFIX` 加 town 键（js/modes/adventure.js:2238，守门测试锁，键位占空）。`js/town-map-core.js` script 加载位上移至 `adventure-maps-core.js` 之后、`adventure-dims-core.js` 之前（index.html 现 :377 行上移到 :369 行之后；ADV_TOWN 加载期派生读 TOWN_MAP，nether/den 先例口径）。验收：`test/adventure-dims-core.test.js` 扩段（行完备性/炉键守门/ADV_TOWN 单份权威断言=不出现第二份坐标字面量/ADV_SCENE_KEYS 派生集含 town——showroom/livestock 桶自动跟随，残留#5 判断在此验证）；AudioRegistry 核对 mood:'calm' 键（缺曲登记音频资产线补曲票，**不阻塞**维度行落地，残留#1）；三条全局判据零新分支（pos 不进档/死亡单分支/分桶派生） | no | yes | `js/adventure-dims-core.js` 维度段 + `test/adventure-dims-core.test.js` 扩段 + `index.html` script 行移动 |
| T-SEAM-02 | 去程：east 带式触发线+恒开放+到达面扩展+门口开间 | town-seam(shell) | T-SEAM-01 | T-SEAM-03,05 | ① 触发线：`advEdgeTransitDirAt` 加 east 分支 `x ≥ 157 且 z ∈ [74,75]`（js/adventure-core.js:832-841 现状「east 恒 null」处；轴向带式判据，检序插入位无冲突）；② **恒开放**：`advEdgeOpenDir` east 短路开放（js/adventure-core.js:824-830），收口「east 查表 undefined→false 恒锁」派生面（js/adventure-maps-core.js:519-521）——**无条件开放，不挂任务解锁键**（q16 解锁链不动、east 不进 ADV_UNLOCK_KEYS）；**必需件 1**：`ADV_EDGE_DIR_MAP` 加 `east:'town'` 键（js/adventure-maps-core.js:508-511 现无 east 键）；③ **到达面扩展（唯一机制增量）**：`advVeilArrive` 新增 ADV_DIMS 分流→`advSetDim`（den 分流 js/modes/adventure.js:2665-2669 同文件先例），**分支必须插在 map 路径守卫之前**（:2686-2687 `!row` 与 `row.id === advMap` 两守卫会吞本缝到达——town 不在 ADV_MAPS、town 维度期间 advMap 冻结在 home）；到达播报**分支内定值**「到小镇啦！」+toast（den 先例，行契约不加 name 字段，ADR-0011 决策 2）；visit_town 到达记账可选（`advTally` 发现型 T8 惯例，工程线裁量不阻塞，残留#2）；任务链不挂 town。④ 门口开间建场几何：z74~75 两格栅栏桩/横杆让位（桩位让至开间两侧邻格），开间内无栅栏件、其余段不可挖保护照旧；⑤ 栅栏保护拒绝话术改稿：js/modes/adventure.js:2979 现句「小镇还没盖好呢」与随时可去矛盾，替换文案以视觉 spec §B.4 定稿为准。验收：home 主径踩线（x≥157 且 z∈[74,75]）白闪进镇落 spawn 锚面北望广场；偏离主径的栅栏段不触发；翻越彩蛋（z 出带）不触发、落隔离带照旧；近前引导区 east 恒 null 零改动；**GLOSSARY 词条随行**：「边缘传送」定义正文「east 恒无传送语义」+_Avoid「东向加传送」改写、「传送门阵」「边缘传送是去远征图的唯一入口」句更新含 town（§6.3.6 #1 名实同步）；`npm test` 全绿（east 触发几何纯函数单测） | no | partial（触发判据纯函数直测） | `js/adventure-core.js`/`js/adventure-maps-core.js`/`js/modes/adventure.js` + home 建场几何段 + `GLOSSARY.md`（east 词条行） |
| T-SEAM-03 | 回程：镇侧带式触发线+east 来向锚（双向边缘白闪收口） | town-seam(shell) | T-SEAM-01（镇维度在场方可回程） | T-SEAM-05 | 按 §6.3.5 裁定（双向边缘白闪，无门件）：① 壳层 town 维度分支挂回程触发线（「不进表」清单惯例，早退链=冷却/白闪中/睡觉同款纪律）：判据 `z ≥ 132（任意 x）`（南向镇口带式；缓冲 5 格=防误触参数可微调、判据形状不变）→ `advVeilFire({to:'home', kind:'edge'})` 复用现成白闪整链（0.4s×2/0.8s 冷却/满格同步切/portal_travel 音）；② **必需件 2**：`ADV_HOME_EDGE_GATES` 加 east 锚（js/adventure-maps-core.js:609-615 现三向锚 east 无；约 (154.5,75) 面朝西，门口内侧 2.5 格、所落格可站立、锚位不落触发线口袋，精确值施工探针实测取值——三向现锚同款）；③ **来向取值口径**：现 `advVeilFire` 的 from=advMap（js/modes/adventure.js:2654），维度期间 advMap 冻结在 home，直喂 `advHomeArriveGate('home')` 反查落空兜底南锚=错误落点——镇侧发令须以来向场景 id 喂反查（到达侧维度态读 `advDim`，或发令显式带 from；施工二选一，验收锚=从镇内越线回 home 落 east 锚面西）；④ 到达播报「回到家啦！」现成句沿用。验收：镇内南缘越线白闪回 home 门口内侧 east 锚（约 (154.5,75) 面西）；南彩蛋带（z94~127）零误触；回 home 后主世界昼夜照转（镇内时间冻结不外溢，js/modes/adventure.js:2376）；`npm test` 全绿 | no | partial | `js/modes/adventure.js` 壳层 town 维度分支 + `js/adventure-maps-core.js` east 锚 |
| T-SEAM-04 | 镇内交互机宿主挂载（adventure 壳 town 分支） | town-seam(shell) | T-SEAM-01 | T-SEAM-05；解阻 T-UI-01..03 | ADR-0011 决策 6a 落地：`townInteractBoot`/`townTargets`（js/modes/town.js:126、:132-135，T-MAP-04 产物）宿主迁 **adventure 壳 town 分支**（「不进表」清单惯例）——`advSetDim('town')` 专属步建机（den 专属步先例：advDenT 复位+advDenSeed 首刷，dimension-registry-design.md §5），`townTargets` 状态归壳层 town 分支，离镇弃机、下次进场新机不串轮；`mkTownTargets` 本体（js/town-interact-core.js）与同名单测**零改动**（「T-UI 票只换 emit 实现，不改机器」契约保持）；落地时在 dimension-registry-design.md §5「不进表」清单补 town 分支登记（登记性回填一句话，设计权威新增条目非改写）。验收：进镇建机（交互注册快照与目标状态机可用）/离镇再进新机不串轮；boot 冒烟绿；**T-UI 挂点语境就此定锚**：T-UI-01 HUD 挂 adventure 壳维度态 chrome（横幅已由 hud.banner 承担）、T-UI-05 走查起点=主菜单进冒险→主路→白闪进镇全程 adventure 壳 | no | no | `js/modes/adventure.js` town 分支 + dimension-registry-design.md §5 清单登记回填 |
| T-SEAM-05 | 撤卡三件套+装配件迁移+词条改写债随行（**收尾原子节拍**） | town-seam(detach) | T-SEAM-01..04 全绿 | 无（发布节拍终点） | **原子收口单提交**：① 撤 `index.html:95-99` 小镇卡 + `:380` `js/modes/town.js` script 标签；② 撤 `js/mode-registry.js:32` town 行；③ 六纯装配件机械迁 `js/adventure-dims-core.js` 维度段（ADR-0011 决策 6b，D8 同构）：`TOWN_PHASE_ORDER`(:37)/`townYawOfFace`(:42-51)/`townSpawnIntent`(:56-60)/`townAssemblyPhases`(:65-72)/`townConsumeOp`(:81-108)/`townBuild`(:114-120)，T-SEAM-01 的懒闭包改直引，`js/modes/town.js` 模式壳（:143-151）作废、**全文件退场**；④ `test/town-mode.test.js` 断言随迁并入 `test/adventure-dims-core.test.js`（同名单测约定），本测试文件退场；⑤ **GLOSSARY 词条改写债随行**（§6.3.6 登记，撤卡即名实相符时机）：「小镇漫步（TownMode）」词条重定义→「小镇维度」立新词（init 链/模式态词条面随壳作废退役）；「城镇地图核心（TownMapCore）」消费方路径改指 dims-core 维度段（原「js/modes/town.js 起被 TownMode 的 townAssemblyPhases/townSpawnIntent 消费」）。验收：撤卡触发 `MODE_REGISTRY` 三重命名测试面（AGENTS.md 硬规则；**以 `npm test` 红点为准，残留#4**），红点清零；boot 冒烟绿；主菜单无小镇卡；进镇/回程/交互/镇内交互机全链绿；`npm test`+`npm run lint` 零错误。**任何中间态不得出现「无入口可进镇」**（本票 blocking=T-SEAM-01..04 全绿） | no | yes（断言随迁） | `index.html`/`js/mode-registry.js`/`js/modes/town.js`（删）/`js/adventure-dims-core.js`/`test/town-mode.test.js`（删）+`test/adventure-dims-core.test.js` 扩段/`GLOSSARY.md`（TownMode/城镇地图核心词条） |

### 13.2 关键 blocking 边与撤卡节拍

- 依赖汇总：`T-SEAM-01` → `T-SEAM-02/03/04`（镇维度在场是去程到达/回程发令/交互机挂载的前提）→ `T-SEAM-05`（收尾原子节拍）。T-SEAM-02 与 T-SEAM-03 相互独立可并行（去程/回程各触两侧几何），同文件（`js/modes/adventure.js` 壳段）合并序由 engineer-manager 派工时对齐。
- **撤卡节拍一句话**：撤卡是**收尾节拍**——T-SEAM-01..04 全绿后 T-SEAM-05 原子收口（撤三件套+六装配件迁移+TownMode 词条改写同一提交），全程 `npm test` 红点驱动；任何中间态不出现「无入口可进镇」，也不出现「双入口并存」超过一个施工批次。
- east-spec 话术改稿随行关系（视觉 spec §A.4/§B.3/B.4 已带替换文案）：**代码侧**拒绝话术随 T-SEAM-02 改稿（:2979）；**文档侧** `docs/world-edge-design/east-spec.md` 主话术退役与告示牌改读归 ui-designer 域随撤卡节拍收口（不阻塞施工票，T-SEAM-05 票尾知会需求线/ui-designer）；告示牌拼块专属图案归 UI-01 资产票（视觉 spec §B.3 主案），不在本表。
- 儿童时限：进镇改走探险维度相位后随探险模式共享（GLOSSARY「儿童时限」，§6.3.0），撤卡后无独立时限面、无新账本——T-SEAM-05 验收含 `boot.test` 预算契约绿。

### 13.3 salvage 裁定表（ADR-0011 决策 6 兑现，停工令「不回滚」边界内）

**票级处置（T-MAP-01..04）**：

| 票 | 产物 | 处置 | 口径 |
|---|---|---|---|
| T-MAP-01 | `js/town-map-core.js`（TOWN_MAP 九段/townBuildSteps）+ 同名单测 | **保留+升格** | TOWN_MAP 九段直接成为 town 维度 build 的**布局唯一权威**（§6.3.3 单份权威纪律）；ADV_TOWN 只派生引用不抄坐标；script 加载位上移随 T-SEAM-01 |
| T-MAP-02 | ModeRegistry 行+index.html 卡/页/script+`js/modes/town.js` 最小可进场 | **撤除**（=T-SEAM-05 撤卡三件套本体） | 台账标记历史工件（关票记录保留勿删改）；「出生面向广场/可回望钟塔」装配意图由维度行 build 闭包继承（townBuild 内 ModeKit.spawn 已然其后） |
| T-MAP-03 | `js/town-assembly-core.js`（townAssemblyOps 规划器+材质映射）+ 同名单测 | **保留+转用途** | `townAssemblyOps(townBuildSteps())` 被 town 维度 build 闭包原样消费；樱花覆写等调用方策略随迁 dims-core 维度段（机械搬移零逻辑改动） |
| T-MAP-04 | `js/town-interact-core.js`（mkTownTargets）+ 同名单测；boot 接线（townTargets/townInteractBoot） | **保留 core+转宿主** | core 文件与测试零改动；宿主接线迁 adventure 壳 town 分支（ADR-0011 决策 6a，T-SEAM-04）；T-UI 线消费面不变 |

**文件级处置（`js/modes/town.js` 151 行拆解，research §3.1 全表）**：

| 件 | 位置 | 去向 | 随行票 |
|---|---|---|---|
| `TOWN_PHASE_ORDER` | :37 | 迁 `js/adventure-dims-core.js` 维度段 | T-SEAM-05 |
| `townYawOfFace` | :42-51 | 迁 dims-core 维度段 | T-SEAM-05 |
| `townSpawnIntent` | :56-60 | 迁 dims-core 维度段（ADV_TOWN spawn 派生口径同源） | T-SEAM-05 |
| `townAssemblyPhases` | :65-72 | 迁 dims-core 维度段 | T-SEAM-05 |
| `townConsumeOp` | :81-108（op 执行器=引擎触点唯一面） | 迁 dims-core 维度段 | T-SEAM-05 |
| `townBuild` | :114-120 | 迁 dims-core 维度段；T-SEAM-01 期间原地懒引、T-SEAM-05 直引 | T-SEAM-01（懒引）/05（迁移） |
| `townTargets`/`townInteractBoot` | :126、:132-135 | 宿主迁 adventure 壳 town 分支（不进表清单惯例） | T-SEAM-04 |
| `TownMode = mkMode(...)` | :143-151 | **作废撤除**（模式壳三步 init 链随卡退场；输入流/requestLock 归 adventure 壳现成链） | T-SEAM-05 |
| script 标签 | index.html:380 | 撤除 | T-SEAM-05 |

> 镇口件（回程视觉地标，残留#3）：**首版不入 TOWN_MAP 九段**（ADR-0011 决策 6c——机制面不依赖、触发线全带宽无走错面、回程视觉引导由视觉 spec §B.5 铺装渐稀+路口轻提示语言覆盖）；登记为**可选蓝图增量票**不派，若 PO 走查后想要则走蓝图数据增量（现成件复用、增量入 TOWN_MAP 九段数据、机制零动）。

### 13.4 需求线残留五条的票面处置（登记不阻塞，不新开争议）

| # | 残留 | 处置注记 |
|---|---|---|
| 1 | mood:'calm' 曲目若 AudioRegistry 无现成键 | T-SEAM-01 验收核对；缺曲→登记**音频资产线补曲票**，维度行落地不阻塞（§6.3.3 mood 行注记） |
| 2 | visit_town 到达记账可选 | T-SEAM-02 票面可选项（发现型 T8 惯例，工程线裁量）；任务链不挂 town（引导链 v2 十五步不动） |
| 3 | 镇口件可选蓝图增量 | **已裁**：首版不入九段，登记可选增量票不派（§13.3 表后注） |
| 4 | MODE_REGISTRY 三重命名测试断言行号未核 | T-SEAM-05 验收口径：**以 `npm test` 红点为准**（test/mode-registry.test.js + conventions/boot 断言面） |
| 5 | showroom town 桶显式引用未核 | T-SEAM-01 验收断言：ADV_SCENE_KEYS 派生集含 town（D7 派生先例自动跟随），施工时验证（js/modes/adventure.js:82 派生面 + showroomSceneKeys 派生） |

### 13.5 本线不承载（边界登记）

- **T-UI-00..05 brief 重发/解阻派工**：归 engineer-manager（受损清单=`.scratch/handoffs/2026-11-13-tui-briefs-impact-list.md`；「镇的宿主形态终裁方=BA」一项已由 ADR-0011 决策 6a 终裁承接——town=维度行、模式壳撤除，T-UI-01 HUD 挂点语境与 T-UI-05 走查起点见 T-SEAM-04 验收栏）。
- **视觉/话术/图标/过场体感**：归 ui-designer（`design/town-entry-transition-visual-spec.md` 定稿，已定稿 commit 本文只引用）。
- **设计权威改写**：本文与 ADR-0011 只引用不修改 [`town-map-design.md` §6.3](town-map-design.md)、视觉 spec、GLOSSARY（T-SEAM 票内的词条改写债是 §6.3.6 预登记的随实现落地项，非设计变更）；途中再发现设计冲突→登记回报，不擅自改权威。

---
