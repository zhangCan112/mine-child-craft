# ADR 0010: 城镇素材以 `town-prefab-specs` 为 sole authority，经 PrefabKit/SceneKit 契约 ingest 与装配

日期：2026-11-12 · 状态：已采纳

## 背景

Midport Village 需要将视觉规格（建筑、场景件、植被、远景/道具）落为可施工、可测试的引擎/装配契约。仓库已具备：

- **PrefabKit**（`js/prefab-kit.js`）：`place/footOf` 行表、材质 id 注入、按形命名、`v` 白名单+拼写域 throw/数值域钳、越界不写、同参同盒；`test/prefab-kit.test.js` 为契约测试先例。
- **SceneKit**（`js/scene-kit.js`）：`tree/pine/pineSnowy/scrub/fill/rand/heightAt`，几何与落位政策分线。
- **权威规格**：[`docs/design/town-prefab-specs.md`](../design/town-prefab-specs.md) 定义城镇建筑/场景件的蓝图名、`footOf`、`v` 面、材质注入槽、SceneKit 植被映射与“Prefabs vs Scene Assembly”分类；视觉意图由 [`docs/design/town-buildings-visual-spec.md`](../design/town-buildings-visual-spec.md)、[`docs/design/town-villagers-visual-spec.md`](../design/town-villagers-visual-spec.md) 细化。

需明确：新增几何落库位置、材质/色彩权威、植被（含樱花观感差异）处理边界，以及冲突裁决路径，避免实现期散装几何、引擎硬编码玩法语义或与契约漂移。

## 决策

1. **Sole authority**：城镇建筑/关键场景件/植被落库契约以 [`docs/design/town-prefab-specs.md`](../design/town-prefab-specs.md) 为唯一权威；材质/几何/变体语义以 PrefabKit/SceneKit 框架契约为准。与其他文档或实现冲突时，对齐 `town-prefab-specs` + 引擎契约；争议回退需求线澄清，不在实现侧擅自裁决视觉权威。
2. **Prefab ingest（引擎层，TDD 先行）**：`town-prefab-specs.md` §4.1–§4.8 新行（`tower-belfry`、`shop-awning`、`stash-hut`、`windmill-tower`、`cottage-gable`、`house-loft`、`stall-canopy`、`board-pool`）逐项 ingest 入 `js/prefab-kit.js` 行表；`cache-cellar` 复用 `under-room`、`hill-mound` 复用 `mound`（不新增行，仅调用方 `v` 覆写）。每行遵守按形命名、`ids/mat/*` 注入不焊死、`v` 白名单/错误两档、越界不写、`footOf` 零写同盒；每新增行在 `test/prefab-kit.test.js` 镜像扩展 oracle/脚印/朝向×mirror×变体/确定性/错误契约断言。
3. **SceneKit 与植被**：植被走 `SceneKit.tree/pine/pineSnowy/scrub`（`town-prefab-specs.md` §5.1）；**不**为樱花等观感差异在 SceneKit 内核散写特例几何或在模式层复制树实现。材质/色彩差异（如粉冠）由应用层装配阶段的调用方覆写/扩展点处理，与“几何与落位政策分线”一致；如需引擎级通用能力，另立设计与 ADR，不在本决策下隐式扩契约。
4. **场景拼装**：道路/广场/农田田埂/远景剪影/灯柱桶箱围栏旗帜等按 `town-prefab-specs.md` §5.2 走 `SceneKit.fill`、高度场与调用方散布逻辑（计划数据 + `modes/town.js` 执行），不强行纳入 PrefabKit 行表；建场顺序与“后写者赢”纪律在装配层显式管理。
5. 挡回的替代方案：在 `modes/town.js` 或应用层散写一次性方块几何（不可测、不可复用、破坏 sole authority）；在引擎行内硬编码城镇语义材质/命名（破坏引擎无玩法与注入契约）；为单一城镇需求直接改写 SceneKit 树内核几何（扩大回归面、模糊几何/政策边界）。

## 后果

- 正面：素材落点单一可审计；PrefabKit 契约测试可回归防漂移；材质调色与 PO 变更集中于应用层映射/`v` 注入；植被与拼装分线保持引擎简洁。
- 代价：Prefab ingest 需先行投入 TDD 成本；樱花等材质表现受当前 SceneKit 能力约束，首版可能以调用方覆写近似，像素级还原度受限。
- 不可逆性：中——已落库蓝图名/`footOf`/`v` 面形成下游装配与测试依赖，回退或改名将牵连 plan/test/assembly；材质权威一旦分叉将导致持续漂移，采纳后以 `town-prefab-specs` 为唯一裁决源。

## 证据与关联

- 架构与票据：[`docs/town-architecture-design.md`](../town-architecture-design.md) §3/§5/§9/§11（`T-PREFAB-*`、`T-MAP-*`）。
- Sole authority 与契约：[`docs/design/town-prefab-specs.md`](../design/town-prefab-specs.md) · [`js/prefab-kit.js`](../../js/prefab-kit.js) · [`test/prefab-kit.test.js`](../../test/prefab-kit.test.js) · [`js/scene-kit.js`](../../js/scene-kit.js)。
- 视觉输入（非几何契约权威）：[`docs/design/town-buildings-visual-spec.md`](../design/town-buildings-visual-spec.md) · [`docs/design/town-villagers-visual-spec.md`](../design/town-villagers-visual-spec.md)。
