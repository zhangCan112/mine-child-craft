# docs 索引 — 文档地图

> 交通警察页：只放链接与状态，不放正文。检索链路：AGENTS.md（会话常驻入口）→ 本页（按需选档）→ 正文按需读。
> 体例依据：[agent-context-research.md](agent-context-research.md)（2026-10-28，一手来源调研）。
> 状态口径：**活权威** = 描述当前行为/规范，改相关代码前必读；**历史工件** = 施工期记录（plan/spec/tickets/acceptance），只作历史依据，行为以后继设计稿与 [GLOSSARY.md](../GLOSSARY.md) 为准。

## 活权威

### 工程治理

- [conventions.md](conventions.md) — 工程与代码规范正文（改任何代码前读）
- [worktree-pitfalls.md](worktree-pitfalls.md) — worktree 生命周期安全清单（开/删 worktree 前必读）
- [held-sprite-tuning-playbook.md](held-sprite-tuning-playbook.md) — 手持薄片朝向调参手册（调任何手持物角度前读：旋钮模型/前倾=RZ−45° 恒等式/探针骨架/死路存档）
- [google-style-research.md](google-style-research.md) · [project-structure-research.md](project-structure-research.md) — 规范正文的两份依据调研
- [agent-context-research.md](agent-context-research.md) — 文档/注释体量与分层的依据调研
- ADR（不可逆决策日志，编号单调不复用）：[0001 每日预算单键](adr/0001-daily-budget-single-key.md) · [0002 专注接物品系统](adr/0002-focus-loot-integration.md) · [0003 音频入库](adr/0003-audio-assets-in-repo.md) · [0004 并行水位面](adr/0004-parallel-fluid-level-plane.md) · [0005 统一冒险壳](adr/0005-unified-adventure-shell-dev-profile.md) · [0006 生态恢复机制](adr/0006-eco-recovery.md) · [0007 大宝箱两轨容量](adr/0007-chest-two-track-capacity.md) · [0008 专注第六维搜索](adr/0008-search-sixth-dim.md) · [0009 城镇独立模式](adr/0009-town-standalone-mode.md)（**2026-11-13 PO 变更：已被 0011 取代**） · [0010 城镇 Prefab ingest 与素材权威](adr/0010-town-prefab-ingest-and-material-authority.md) · [0011 小镇维度缝与入口过场](adr/0011-town-dimension-seam-and-entry-transit.md)（小镇以 ADV_DIMS 维度行接入冒险模式/主路尽头白闪过场/撤独立模式入口，取代 0009） · [0012 门额牌 T4 光照修法](adr/0012-gate-sign-t4-light-neighbor-sampling.md)（门额牌顶点光面邻格采样 pushPane 同口径；solid:false 与假发光两案挡回）

### 设计权威（-design，按主题域）

- **训练营**：[focus-revamp-design.md](focus-revamp-design.md)（2.0 定稿）· [focus-reward-tuning-design.md](focus-reward-tuning-design.md)（奖励段位）· [camp-rotation-design.md](camp-rotation-design.md)（每日轮换+表现奖励）· [focus-search-dim-design.md](focus-search-dim-design.md)（第六维视觉搜索+交互翻新）
- **数学岛**：[math-mode-design.md](math-mode-design.md) · [math-track-unification-design.md](math-track-unification-design.md)
- **探险**：[adventure-maps-design.md](adventure-maps-design.md)（多地图）· [nether-merge-design.md](nether-merge-design.md)（下界相位）· [den-nest-design.md](den-nest-design.md)（怪物巢穴与地下副本）· [dimension-registry-design.md](dimension-registry-design.md)（维度规格注册表/副本素材坑）· [adventure-shell-unification-design.md](adventure-shell-unification-design.md) · [mining-hardness-design.md](mining-hardness-design.md) · [monster-taxonomy-design.md](monster-taxonomy-design.md) · [shared-monsters-design.md](shared-monsters-design.md)
- **物品与合成**：[item-crafting-design.md](item-crafting-design.md) · [crafting-grid-design.md](crafting-grid-design.md) · [door-window-design.md](door-window-design.md) · [item-hint-design.md](item-hint-design.md) · [furnace-design.md](furnace-design.md) · [farm-and-recipe-design.md](farm-and-recipe-design.md)（农田闭环与配方补全） · [bag-and-drop-design.md](bag-and-drop-design.md)（丢弃在地上 + 大背包扩容） · [equipment-design.md](equipment-design.md)（装备系统：盔甲六材质/金银阶工具/下界合金链） · [mob-crafting-design.md](mob-crafting-design.md)（怪物合成：友方铁傀儡结构召唤/南瓜生长链/锚点巡逻 AI，2026-11-08）
- **世界机制**：[liquid-design.md](liquid-design.md) · [block-lifecycle-design.md](block-lifecycle-design.md) · [eco-recovery-design.md](eco-recovery-design.md)（生态恢复：繁育/树位再生/矿位回填） · [mc-daylight-torch-design.md](mc-daylight-torch-design.md)（昼夜/光照）
- **触控与观感**：[touch-controls-design.md](touch-controls-design.md) · [mob-look-design.md](mob-look-design.md) · [pixel-pipeline-design.md](pixel-pipeline-design.md)（底座化裁决记录：不做） · [first-person-hand-design.md](first-person-hand-design.md)（第一人称手持视图 HandView） · [ipad5-performance-design.md](ipad5-performance-design.md)（低核触屏分档/性能观测/LPM 守卫）
- **菜单与入口**：[menu-ui-design.md](menu-ui-design.md)（加载屏/主菜单门面/模式卡/音量与页脚）
- **战斗与竞技**：[combat-kit-unification-design.md](combat-kit-unification-design.md) · [arena-core-unification-design.md](arena-core-unification-design.md) · [tank-impl-design.md](tank-impl-design.md)
- **城镇（我的世界城镇）**：[town-architecture-design.md](town-architecture-design.md)（Phase B 架构与 tracer-bullet 票据拆解/PO 摘要）· [town-map-design.md](town-map-design.md)（地图/布局/氛围/玩法锚点；**§6.3 入口缝=2026-11-13 PO 变更后的进镇机制权威**）· [town-villagers-design.md](town-villagers-design.md)（村民图鉴/配色与三视图规格）· [town-assets-requirements.md](town-assets-requirements.md)（素材制作清单）· [design/town-prefab-specs.md](design/town-prefab-specs.md)（素材件库就绪规格：PrefabKit 蓝图名/`footOf`/`v` 变种面/材质注入与 SceneKit 植被映射，城镇落库契约）；视觉细化定稿：[design/town-buildings-visual-spec.md](design/town-buildings-visual-spec.md) · [design/town-villagers-visual-spec.md](design/town-villagers-visual-spec.md)；UI 设计定稿：[design/town-entry-transition-visual-spec.md](design/town-entry-transition-visual-spec.md)（入口过场/路径引导视觉定稿：白闪过场/TTS 话术/告示牌改读/回程预案，2026-11-13 PO 变更的 UI 侧主文档，2026-11-14 定稿）· [design/town-ui-entry-hud-spec.md](design/town-ui-entry-hud-spec.md)（HUD/任务提示/方位指引/交互高亮，分区 A；§3 入口卡章已废弃，见 2026-11-13 PO 变更注记）· [design/town-ui-entry-tokens.md](design/town-ui-entry-tokens.md)（T-UI-00 入口卡 token/进出过渡/占位落地，分区 A）（**2026-11-13 PO 变更**：入口卡随独立入口撤除待重定义，进镇过渡改维度过场，视觉规格已由上方入口过场视觉定稿承接，2026-11-14 定稿） · [design/town-ui-hud-prebuild.md](design/town-ui-hud-prebuild.md)（T-UI-01..03 HUD/指引/交互预排细化，分区 A）· [design/town-ui-dialog-spec.md](design/town-ui-dialog-spec.md)（村民对话框/气泡/会话与选项，分区 B） · [design/town-ui-dialog-prebuild.md](design/town-ui-dialog-prebuild.md)（T-UI-04 会话 UI 预排细化，A+B 交界） · [design/town-ui-polish-prebuild.md](design/town-ui-polish-prebuild.md)（T-UI-05 走查清单+U/B/N/P 参数总表预备） · [design/town-east-boundary-landscape-spec.md](design/town-east-boundary-landscape-spec.md)（home 东带「已开放」边界风景 v1 定稿，**已被野心版取代留档**）· [design/town-east-boundary-landscape-spec-v2.md](design/town-east-boundary-landscape-spec-v2.md)（home 东带边界风景野心版定稿·现行为：PO 走查翻案「去围栏化」重设计——镇门楼/镇界矮墙/前街重排/引道花径灯柱+素材需求清单+行为面升级候选+票面 F1~F5，2026-11-15）
- **指挥官**：[robot-program-design.md](robot-program-design.md)（编程解谜训练营，设计候选待拍板）
- **模式与装配**：[mode-switch-unification-design.md](mode-switch-unification-design.md) · [camp-core-unification-design.md](camp-core-unification-design.md) · [camp-kit-unification-design.md](camp-kit-unification-design.md) · [mob-registry-unification-design.md](mob-registry-unification-design.md) · [player-state-seam-design.md](player-state-seam-design.md) · [dev-mode-design.md](dev-mode-design.md) · [showroom-design.md](showroom-design.md)

### 调研参考（-research，长期有效）

- **MC 正典取证**：[mc-daylight-torch](mc-daylight-torch-research.md) · [mc-torch-model](mc-torch-model-research.md) · [mc-liquid](mc-liquid-research.md) · [mc-mob-models](mc-mob-models-research.md) · [mc-touch-controls](mc-touch-controls-research.md) · [mc-held-item-action](mc-held-item-action-research.md) · [mc-held-item-render](mc-held-item-render-research.md) · [mc-sword-model](mc-sword-model-research.md)（剑=手持像素薄片正典取证，2026-10-29） · [mc-first-person-hand](mc-first-person-hand-research.md)（手持物渲染续篇：第一人称通道/裸臂/挥击数学） · [mc-button-icons](mc-button-icons-research.md) · [mc-crafting-grid](mc-crafting-grid-research.md) · [minecraft-biome](minecraft-biome-research.md) · [minecraft-furnace](minecraft-furnace-research.md) · [minecraft-item-crafting](minecraft-item-crafting-research.md) · [minecraft-mechanism](minecraft-mechanism-research.md) · [minecraft-mining-hardness](minecraft-mining-hardness-research.md) · [minecraft-eco-recovery](minecraft-eco-recovery-research.md)（资源恢复/随机刻/繁育/矿再生取证） · [mc-mutant-creeper](mc-mutant-creeper-research.md)（Mutant Creatures 突变苦力怕：模组源码+贴图采样取证，2026-10-30） · [mc-mob-drops](mc-mob-drops-research.md)（Java 掉落表取证：12 代位怪+7 零掉落怪+12 候选物品，MOB_DROPS 代位转正底座，2026-11-01） · [mc-equipment](mc-equipment-research.md)（装备系统取证：盔甲六材质四件套数值/金银阶工具/锻造链/造型规格，2026-11-04） · [iron-golem](iron-golem-research.md)（铁傀儡完整机制：搭建召唤/属性数值/AI 优先级/铁锭治疗/搭建 vs 生成差异，2026-11-08）
- **城镇/电影取证**：[minecraft-movie-town](minecraft-movie-town-research.md)（Midport Village 调研：一手信源引用、【电影原样】/【建议为游戏性调整】、待确认点与默认值，2026-11-12）
- **设计输入**：[story-quest](story-quest-research.md) · [map-transition](map-transition-research.md) · [monster-taxonomy](monster-taxonomy-research.md) · [reward-model](reward-model-research.md) · [math-thinking](math-thinking-research.md) · [game-audio](game-audio-research.md) · [block-lifecycle](block-lifecycle-research.md) · [door-window](door-window-research.md) · [chunk-streaming-lod](chunk-streaming-lod-research.md) · [ipad5-performance](ipad5-performance-research.md) · [robot-program](robot-program-research.md)（编程走格子同类游戏×儿童编程实证） · [focus-interaction](focus-interaction-research.md)（专注范式扩展×儿童训练游戏 UI 一手证据）

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
