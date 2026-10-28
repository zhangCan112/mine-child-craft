# docs 索引 — 文档地图

> 交通警察页：只放链接与状态，不放正文。检索链路：AGENTS.md（会话常驻入口）→ 本页（按需选档）→ 正文按需读。
> 体例依据：[agent-context-research.md](agent-context-research.md)（2026-10-28，一手来源调研）。
> 状态口径：**活权威** = 描述当前行为/规范，改相关代码前必读；**历史工件** = 施工期记录（plan/spec/tickets/acceptance），只作历史依据，行为以后继设计稿与 [GLOSSARY.md](../GLOSSARY.md) 为准。

## 活权威

### 工程治理

- [conventions.md](conventions.md) — 工程与代码规范正文（改任何代码前读）
- [worktree-pitfalls.md](worktree-pitfalls.md) — worktree 生命周期安全清单（开/删 worktree 前必读）
- [google-style-research.md](google-style-research.md) · [project-structure-research.md](project-structure-research.md) — 规范正文的两份依据调研
- [agent-context-research.md](agent-context-research.md) — 文档/注释体量与分层的依据调研
- ADR（不可逆决策日志，编号单调不复用）：[0001 每日预算单键](adr/0001-daily-budget-single-key.md) · [0002 专注接物品系统](adr/0002-focus-loot-integration.md) · [0003 音频入库](adr/0003-audio-assets-in-repo.md) · [0004 并行水位面](adr/0004-parallel-fluid-level-plane.md) · [0005 统一冒险壳](adr/0005-unified-adventure-shell-dev-profile.md) · [0006 生态恢复机制](adr/0006-eco-recovery.md)

### 设计权威（-design，按主题域）

- **训练营**：[focus-revamp-design.md](focus-revamp-design.md)（2.0 定稿）· [focus-reward-tuning-design.md](focus-reward-tuning-design.md)（奖励段位）
- **数学岛**：[math-mode-design.md](math-mode-design.md) · [math-track-unification-design.md](math-track-unification-design.md)
- **探险**：[adventure-maps-design.md](adventure-maps-design.md)（多地图）· [nether-merge-design.md](nether-merge-design.md)（下界相位）· [adventure-shell-unification-design.md](adventure-shell-unification-design.md) · [mining-hardness-design.md](mining-hardness-design.md) · [monster-taxonomy-design.md](monster-taxonomy-design.md) · [shared-monsters-design.md](shared-monsters-design.md)
- **物品与合成**：[item-crafting-design.md](item-crafting-design.md) · [crafting-grid-design.md](crafting-grid-design.md) · [door-window-design.md](door-window-design.md) · [item-hint-design.md](item-hint-design.md) · [furnace-design.md](furnace-design.md) · [farm-and-recipe-design.md](farm-and-recipe-design.md)（农田闭环与配方补全）
- **世界机制**：[liquid-design.md](liquid-design.md) · [block-lifecycle-design.md](block-lifecycle-design.md) · [eco-recovery-design.md](eco-recovery-design.md)（生态恢复：繁育/树位再生/矿位回填） · [mc-daylight-torch-design.md](mc-daylight-torch-design.md)（昼夜/光照）
- **触控与观感**：[touch-controls-design.md](touch-controls-design.md) · [mob-look-design.md](mob-look-design.md) · [pixel-pipeline-design.md](pixel-pipeline-design.md)（底座化裁决记录：不做） · [first-person-hand-design.md](first-person-hand-design.md)（第一人称手持视图 HandView） · [ipad5-performance-design.md](ipad5-performance-design.md)（低核触屏分档/性能观测/LPM 守卫）
- **菜单与入口**：[menu-ui-design.md](menu-ui-design.md)（加载屏/主菜单门面/模式卡/音量与页脚）
- **战斗与竞技**：[combat-kit-unification-design.md](combat-kit-unification-design.md) · [arena-core-unification-design.md](arena-core-unification-design.md) · [tank-impl-design.md](tank-impl-design.md)
- **模式与装配**：[mode-switch-unification-design.md](mode-switch-unification-design.md) · [camp-core-unification-design.md](camp-core-unification-design.md) · [camp-kit-unification-design.md](camp-kit-unification-design.md) · [mob-registry-unification-design.md](mob-registry-unification-design.md) · [player-state-seam-design.md](player-state-seam-design.md) · [dev-mode-design.md](dev-mode-design.md) · [showroom-design.md](showroom-design.md)

### 调研参考（-research，长期有效）

- **MC 正典取证**：[mc-daylight-torch](mc-daylight-torch-research.md) · [mc-torch-model](mc-torch-model-research.md) · [mc-liquid](mc-liquid-research.md) · [mc-mob-models](mc-mob-models-research.md) · [mc-touch-controls](mc-touch-controls-research.md) · [mc-held-item-action](mc-held-item-action-research.md) · [mc-held-item-render](mc-held-item-render-research.md) · [mc-first-person-hand](mc-first-person-hand-research.md)（手持物渲染续篇：第一人称通道/裸臂/挥击数学） · [mc-button-icons](mc-button-icons-research.md) · [mc-crafting-grid](mc-crafting-grid-research.md) · [minecraft-biome](minecraft-biome-research.md) · [minecraft-furnace](minecraft-furnace-research.md) · [minecraft-item-crafting](minecraft-item-crafting-research.md) · [minecraft-mechanism](minecraft-mechanism-research.md) · [minecraft-mining-hardness](minecraft-mining-hardness-research.md) · [minecraft-eco-recovery](minecraft-eco-recovery-research.md)（资源恢复/随机刻/繁育/矿再生取证）
- **设计输入**：[story-quest](story-quest-research.md) · [map-transition](map-transition-research.md) · [monster-taxonomy](monster-taxonomy-research.md) · [reward-model](reward-model-research.md) · [math-thinking](math-thinking-research.md) · [game-audio](game-audio-research.md) · [block-lifecycle](block-lifecycle-research.md) · [door-window](door-window-research.md) · [chunk-streaming-lod](chunk-streaming-lod-research.md) · [ipad5-performance](ipad5-performance-research.md)

## 历史工件（施工期记录，行为以后继为权威）

| 主题 | 工件 | 状态 |
|---|---|---|
| 冒险地图 | [plan](adventure-maps-plan.md) · [spec](adventure-maps-spec.md) · [tickets](adventure-maps-tickets.md) · [acceptance](adventure-maps-acceptance.md) | 已完工 → [adventure-maps-design.md](adventure-maps-design.md) |
| 训练营 2.0 | [spec](focus-revamp-spec.md) · [tickets](focus-revamp-tickets.md) | 已完工 → [focus-revamp-design.md](focus-revamp-design.md) |
| 物品与合成 | [plan](item-crafting-plan.md) · [tickets](item-crafting-tickets.md) | 已完工 → [item-crafting-design.md](item-crafting-design.md) |
| 熔炉 | [plan](furnace-plan.md) | 已完工 → [furnace-design.md](furnace-design.md) |
| 音频重建 | [plan](game-audio-plan.md) · [spec](game-audio-spec.md) · [tickets](game-audio-tickets.md) | 已完工 → [adr/0003](adr/0003-audio-assets-in-repo.md) |
| 数学岛 | [plan](math-mode-plan.md) · [spec](math-mode-spec.md) | 已完工 → [math-mode-design.md](math-mode-design.md) |
| 液体 | [plan](liquid-plan.md) | 已完工 → [liquid-design.md](liquid-design.md) |
| 坦克 | [plan](tank-plan.md) | 已完工 → [tank-impl-design.md](tank-impl-design.md) |
| 怪物共享/分类 | [shared-monsters-plan](shared-monsters-plan.md) · [monster-taxonomy-plan](monster-taxonomy-plan.md) | 已完工 → 对应 -design |
| 体验馆 | [spec](showroom-spec.md) · [tickets](showroom-tickets.md) | 已完工 → [showroom-design.md](showroom-design.md) + [adr/0005](adr/0005-unified-adventure-shell-dev-profile.md) |
| 第一人称手持视图 | [tickets](first-person-hand-tickets.md) | 已完工 → [first-person-hand-design.md](first-person-hand-design.md) |
| 下界独立模式 | [plan](nether-plan.md) | **已废弃**（模式退役并入探险）→ [nether-merge-design.md](nether-merge-design.md) |
| 挖矿缺口分析 | [mining-gap-analysis.md](mining-gap-analysis.md) | 分析快照 → [mining-hardness-design.md](mining-hardness-design.md)（config.js 注释仍引用） |
| 架构快照 | [design.html](design.html) | 静态快照 2026-10-18，**非权威**，改代码不自动更新 |
