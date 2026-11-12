# ADR 0009: 城镇（Midport Village）以独立 `town` 模式接入，不并入冒险地图/维度注册表

日期：2026-11-12 · 状态：已采纳

## 背景

Midport Village（和平漫游 + NPC 轻交互/轻任务锚点 + 可探索地标）需要一个可落地的集成 seam。现有可选装配面：

- **模式装配**：`MODE_REGISTRY` 行 + `index.html` 卡/页/script + `js/modes/<id>.js`，场景经 `loadScene(buildFn)` 装填（`js/world.js`）。
- **冒险地图**：`ADV_MAPS` 行绑定 `build/palette/nests/nightPool/gates/livestock` 等远征/生态/切图政策（`js/adventure-maps-core.js`、`js/modes/adventure.js`）。
- **维度注册表**：`ADV_DIMS` 行绑定切界政策/天空/恒暗/刷怪相位（`js/adventure-dims-core.js`）。

城镇语义（固定明亮白天主态、无战斗/无巢穴夜怪池/无门阵解锁/无维度相位战斗、纯鼠标点选低压探索，见 [town-map-design.md](../town-map-design.md)、[town-villagers-design.md](../town-villagers-design.md)、[MISSION.md](../../MISSION.md)）与 `ADV_MAPS`/`ADV_DIMS` 的职责不匹配。

## 决策

1. **城镇作为独立游玩模式 `town` 接入**：在 `MODE_REGISTRY` 注册新行，并以 `js/modes/town.js` + `index.html` 卡/页/script 三件套装配，经 `loadScene` 建场；**不**向 `ADV_MAPS` 新增城镇地图行，**不**向 `ADV_DIMS` 新增城镇维度/相位行。
2. **依赖与分层**：城镇模式（应用层）可依赖引擎/通用 kit（`PrefabKit`、`SceneKit`、`ModeKit`、`Input`、`SpeechKit` 等）；引擎层不知道玩法，城镇剧情/NPC/任务判定不下沉引擎（[conventions.md](../conventions.md) §1.6，[GLOSSARY.md](../../GLOSSARY.md)）。
3. **与探险/训练营的关系**：运行时不并入 adventure 壳、不复用其巢穴/夜怪池/门阵/分桶账本语义；产品层联动（共享交互语言、TTS/kit 范式、后续入口切换）作为后续独立票承接，不改变本 seam。城镇轻状态（如导览/轻互动记忆）若需持久化，使用独立轻量槽或会话态，**不得侵入** `*_world_save` 等冒险存档格式。
4. 挡回的替代方案：并入 `ADV_MAPS`（将和平城镇伪装为冒险地图行，污染池/门/生态数据契约并迫使 adventure 壳分支膨胀）；并入 `ADV_DIMS`（强加无意义相位/战斗政策）。两者均以高耦合换取表面复用，不采纳。

## 后果

- 正面：边界清晰、对既有 adventure/dimension 状态机零侵入；城镇可按自身节奏/预算与 UI 会话模型演进；便于 TDD/分票并行（Prefab ingest → assembly → UI wiring）。
- 代价：需新增 mode 三件套与入口资产；与冒险“同一世界连续旅行”的产品叙事需后续通过显式 mode switch/联动票实现，而非复用现成地图切换。
- 不可逆性：中——回退为并入 `ADV_MAPS/ADV_DIMS` 将迫使重构数据契约与壳层并破坏已建立的城镇状态边界；采纳后不以“复用注册表行”为由回退本决策。

## 证据与关联

- 架构与票据：[`docs/town-architecture-design.md`](../town-architecture-design.md) §3/§4/§6/§11。
- 设计输入：[`docs/town-map-design.md`](../town-map-design.md) · [`docs/town-villagers-design.md`](../town-villagers-design.md) · [`docs/design/town-ui-entry-hud-spec.md`](../design/town-ui-entry-hud-spec.md) · [`docs/design/town-ui-dialog-spec.md`](../design/town-ui-dialog-spec.md)。
- 既有 seam/前例：[`docs/adventure-maps-design.md`](../adventure-maps-design.md) · [`docs/dimension-registry-design.md`](../dimension-registry-design.md) · [`docs/adr/0005-unified-adventure-shell-dev-profile.md`](0005-unified-adventure-shell-dev-profile.md)（统一壳的适用边界对照）。
