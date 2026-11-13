# 派单：T-UI-02 方位指引（Landmark Pointer）与目标消费（分区 A）

> 提票：engineer-manager（town-design Phase C）· 2026-11-13
> 安排：PO 转 scrum-master 安排执行（ui-designer route，实现票）
> 回执：完成后合并回执交回 engineer-manager 收口（并入 town-design 分支，三门零错）

## 票面（对齐 docs/town-architecture-design.md §11）

| 字段 | 值 |
|---|---|
| 票号 | T-UI-02 |
| 标题 | 方位指引（Landmark Pointer）与目标消费 |
| 类型 | ui-wiring（实现票） |
| 依赖 | T-UI-01（**未完成**）、T-MAP-04（**未完成——最早可开工条件**） |
| blocking | T-UI-04 |
| ui_designer_route | **required** |
| ui_scope | A |
| ui_refs | docs/design/town-ui-entry-hud-spec.md §5（5.1-5.3）、§8（U4/U5 默认） |
| 需 tdd | partial（目标选择/近距弱化纯逻辑下沉 core 配单测） |

## 最早可开工条件（当前未满足，可预排不可开工）

T-UI-01 完成（L1-L4 容器在位）且 T-MAP-04 完成（目标 id 协议可消费）。

## 设计权威（按文件现状读，定稿不推翻）

1. `docs/design/town-ui-entry-hud-spec.md` §5：5.2 推荐默认=**简化地标方位指引（Landmark Pointer）**为游玩默认；钟塔/任务锚点目标切换；近距弱化；无闪烁低负荷。5.3 完整小地图为可选后续（PO 核准后启用）——本票不做。§8 U4/U5 默认参数化。
2. `docs/design/town-ui-entry-tokens.md` token 先例；`docs/town-architecture-design.md` §7、§8（性能：事件驱动、签名/脏标刷新、避免每帧重建 DOM）。
3. `docs/town-assets-requirements.md` 地标 marker 资产语义（marker SVG 已有占位资产在 .scratch/town-design/assets/ui/，入库与否按资产票线）。

## 交付物（一票收口）

1. Landmark Pointer 指引器：目标（钟塔/任务锚点）切换、屏幕边缘指向、近距弱化/隐藏；
2. 目标消费适配：读 T-MAP-04 目标 id 协议（未定处留 seam 列歧义走需求线）；
3. 目标选择/弱化阈值纯逻辑下沉 core 配同名单测（确定性可测）；
4. U4/U5 参数表（显式默认值落点，供 PO 最终验收批次）。

## 并行冲突规避

- 禁碰 `js/prefab-kit.js`、`test/prefab-kit.test.js`（prefab 线在改）；与 T-MAP 线 `index.html`/`js/modes/town.js` 接缝在派工时对齐合并序（合并权在 engineer-manager）。

## 硬约束与验收（回执需附）

- 无闪烁、低负荷（事件驱动更新，非每帧重建）；6 岁、纯鼠标；零倒计时。
- `npm test`/`npm run lint` 零错；boot 冒烟过。
- 回执：文件清单、与 §5 对齐说明、U4/U5 参数表、三门结果、commit 信息。
