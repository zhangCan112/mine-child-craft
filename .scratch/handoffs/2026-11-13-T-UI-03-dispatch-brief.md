# 派单：T-UI-03 可交互高亮/标记与点选反馈（分区 A 侧）

> 提票：engineer-manager（town-design Phase C）· 2026-11-13
> 安排：PO 转 scrum-master 安排执行（ui-designer route，实现票）
> 回执：完成后合并回执交回 engineer-manager 收口（并入 town-design 分支，三门零错）

> **【2026-11-13 PO 变更·brief 重发注记】**（engineer-manager 重发 2026-11-14；依据同 T-UI-01 重发注记：ADR-0011 + town-architecture-design.md §13 + tui-briefs-impact-list.md）
> - 四态高亮规格全量**零改动**（impact list 已核）；entry-hud-spec §6.1「出口/返回入口」行语义更新为**回程边缘白闪预案**（双向边缘白闪，无门件，ADR-0011 决策 4 / town-map-design.md §6.3.5），四态规格本身不动。
> - **接缝句作废**：下文并行冲突段「与 T-MAP-03 场景装配（js/modes/town.js 建场段）接缝」随独立缝撤除失效——建场装配由 T-SEAM-01 town 维度行 build 闭包消费现 townAssemblyOps/townBuildSteps（T-MAP-03 产物**保留+转用途**），装配件迁移与撤壳在 T-SEAM-05；同文件合并序派工时与 engineer-manager 对齐。
> - **依赖改锚**：T-MAP-03/T-MAP-04 → T-SEAM-01/T-SEAM-04（§13.1）；T-UI-01 依赖不变。

## 票面（对齐 docs/town-architecture-design.md §11）

| 字段 | 值 |
|---|---|
| 票号 | T-UI-03 |
| 标题 | 可交互高亮/标记与点选反馈（分区 A 侧） |
| 类型 | ui-wiring（实现票） |
| 依赖 | T-MAP-03（场景装配，**未完成**）、T-MAP-04（**未完成**）、T-UI-01（**未完成——最早可开工条件**） |
| blocking | T-UI-04 |
| ui_designer_route | **required** |
| ui_scope | A |
| ui_refs | docs/design/town-ui-entry-hud-spec.md §6（6.1-6.4）、§8 |
| 需 tdd | partial（命中/状态判定纯逻辑下沉 core 配单测） |

## 最早可开工条件（当前未满足，可预排不可开工）

T-MAP-03 完成（世界命中对象可注册）+ T-MAP-04 完成（交互点协议）+ T-UI-01 完成（容器在位）。

## 设计权威（按文件现状读，定稿不推翻）

1. `docs/design/town-ui-entry-hud-spec.md` §6：可交互对象分类（A 侧提示范围）；默认/悬停/按下/完成态视觉；色弱友好形状区分（6.3）；当前以鼠标指针为默认（6.4 前瞻不实现）。
2. `docs/town-architecture-design.md` §7.1（世界/交互态→UI 事件流）、§4.1（应用层职责：命中/高亮驱动）。
3. `docs/town-assets-requirements.md` UI-03 资产语义（select_hover/active SVG 占位已有）；`docs/design/town-ui-entry-tokens.md` token 体例。

## 交付物（一票收口）

1. 可交互对象默认/悬停/按下/完成四态与点选反馈（与世界命中对齐，事件驱动）；
2. 色弱友好形状区分落实；
3. 命中/状态判定纯逻辑下沉 core 配同名单测；
4. 高亮刷新走签名/脏标（性能口径，非每帧重建）。

## 并行冲突规避

- 禁碰 `js/prefab-kit.js`、`test/prefab-kit.test.js`（prefab 线在改）；与 T-MAP-03 场景装配（`js/modes/town.js` 建场段）接缝在派工时对齐合并序（合并权在 engineer-manager）。

## 硬约束与验收（回执需附）

- 6 岁、纯鼠标点选、零惩罚视觉（无警示红语义）；动效克制。
- `npm test`/`npm run lint` 零错；boot 冒烟过。
- 回执：文件清单、与 §6 对齐说明、三门结果、commit 信息。
