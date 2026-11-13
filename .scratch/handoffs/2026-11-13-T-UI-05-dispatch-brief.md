# 派单：T-UI-05 UI 联调、可达性走查与文案/TTS 默认值落地

> 提票：engineer-manager（town-design Phase C）· 2026-11-13
> 安排：PO 转 scrum-master 安排执行（ui-designer route，polish 票）
> 回执：完成后合并回执交回 engineer-manager 收口（并入 town-design 分支，三门零错）

## 票面（对齐 docs/town-architecture-design.md §11）

| 字段 | 值 |
|---|---|
| 票号 | T-UI-05 |
| 标题 | UI 联调、可达性走查与文案/TTS 默认值落地 |
| 类型 | ui-wiring(polish) |
| 依赖 | T-UI-01..04（**均未完成——最早可开工条件**） |
| blocking | 发布候选 |
| ui_designer_route | **required** |
| ui_scope | **A+B** |
| ui_refs | docs/design/town-ui-entry-hud-spec.md 全文 §8（U1-U8）、docs/design/town-ui-dialog-spec.md 全文 §8（B1-B8） |
| 需 tdd | 否（走查/参数收口为主；若有代码微调按最小改动） |

## 最早可开工条件（当前未满足，可预排不可开工）

T-UI-01..04 全部完成（A/B 两分区实现闭环可联调）。

## 设计权威（按文件现状读，定稿不推翻）

1. 两 UI spec 全文 + `docs/design/town-ui-entry-tokens.md`；
2. `MISSION.md`（过程性表扬节奏/零惩罚）、`docs/town-architecture-design.md` §7.2/§12.5（体验门槛：纯鼠标可完成主路径）；
3. `docs/town-assets-requirements.md`（UI 资产语义终检）。

## 交付物（一票收口）

1. **走查清单**：纯鼠标可达（主路径「进入→识别地标→获得提示→点选交互/对话」）、热区 ≥44px 抽查、对比度抽查、无压力文案、过程性表扬节奏——逐项打勾+证据（截图/步骤）；
2. **参数表**：U1-U8/B1-B8 默认值参数化落点汇总（此前 T-UI-01..04 各票参数表并表），标注 PO 可一处改动的落点；
3. 文案/TTS 默认值落地与统一出口排队终检；
4. 微调项（若走查发现小改）按最小 diff 落地并过三门；结构性问题列票走需求线不扩本票。

## 并行冲突规避

- 禁碰 `js/prefab-kit.js`、`test/prefab-kit.test.js`；以走查/文档为主，微调范围在派工时与 engineer-manager 对齐（合并权在 engineer-manager）。

## 硬约束与验收（回执需附）

- `npm test`/`npm run lint` 零错（若含微调）；
- 回执：走查清单（逐项证据）、U/B 参数总表、微调 diff（如有）、三门结果、commit 信息；**「ui-designer 走查记录」本票为主体履行**（PO 验收时复核）。
