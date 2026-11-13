# 派单：T-UI-04 会话 UI（气泡+面板+选项）与 A/B 接口闭环（分区 B）

> 提票：engineer-manager（town-design Phase C）· 2026-11-13
> 安排：PO 转 scrum-master 安排执行（ui-designer route，实现票）
> 回执：完成后合并回执交回 engineer-manager 收口（并入 town-design 分支，三门零错）

## 票面（对齐 docs/town-architecture-design.md §11）

| 字段 | 值 |
|---|---|
| 票号 | T-UI-04 |
| 标题 | 会话 UI（气泡+面板+选项）与 A/B 接口闭环（分区 B） |
| 类型 | ui-wiring（实现票） |
| 依赖 | T-UI-01（**未完成**）、T-UI-03（**未完成**）、T-MAP-04（**未完成——最早可开工条件**） |
| blocking | T-UI-05 |
| ui_designer_route | **required** |
| ui_scope | **A+B**（交界票） |
| ui_refs | docs/design/town-ui-dialog-spec.md §4-§7、§2；docs/design/town-ui-entry-hud-spec.md §0.3、§4.6 |
| 需 tdd | partial（会话状态机纯逻辑下沉 core 配同名单测） |

## 最早可开工条件（当前未满足，可预排不可开工）

T-UI-01 + T-UI-03 完成（A 侧容器/反馈在位）+ T-MAP-04 完成（会话状态机接口对齐 §0.3）。

## 设计权威（按文件现状读，定稿不推翻）

1. `docs/design/town-ui-dialog-spec.md`：§2 与分区 A 的边界与接口（接口点/冲突裁决）；§4 视觉（气泡/底板/尺寸层级/锚位安全区/图标文案 TTS 协同/儿童可读）；§5 会话分层与状态（Idle/Bubble/Greet/Guide/Seek/Help/Respond/Praise/Complete，与 villagers §7/map §6 映射）；§6 选项按钮（无压力关闭/再听一次）；§7 会话内表扬（对齐 MISSION，与 A 侧分工）。
2. `docs/town-architecture-design.md` §7.1（A↔B 接口事件 `town-ui/dialog/*` 语义由实现对齐 specs）。
3. `docs/design/town-ui-entry-tokens.md` token 体例；`docs/town-assets-requirements.md` UI-04/05 资产语义。

## 交付物（一票收口）

1. World Bubble + 底部 Session Panel + Option Chip 三件套（再听一次/稍后，无压力关闭）；
2. 会话状态机与 `dialog/open|update|close` 接口闭环（消费 T-MAP-04 协议；未定处留 seam 列歧义走需求线）；
3. 会话打开时收敛 A 侧非必要 HUD（消费 §4.6 收敛事件）；完成回执与 A 任务条分工按 §2/§7；
4. 会话内过程性表扬呈现；TTS 排队意图（统一语音出口，仲裁与 A 侧不抢话——具体仲裁实现记参数）；
5. 状态机纯逻辑下沉 core 配同名单测；B1-B8 未决项参数化列表（供 PO 最终验收批次）。

## 并行冲突规避

- 禁碰 `js/prefab-kit.js`、`test/prefab-kit.test.js`（prefab 线在改）；DOM/CSS 落点 `css/*` 命名空间与 `js/town-ui-*`；与 T-MAP/T-UI-01..03 接缝在派工时对齐合并序（合并权在 engineer-manager）。

## 硬约束与验收（回执需附）

- 6 岁、纯鼠标、热区 ≥44px、无压力文案、零倒计时零失败态。
- `npm test`/`npm run lint` 零错；boot 冒烟过。
- 回执：文件清单、与 dialog-spec §2/§4-§7 逐节对齐说明、B1-B8 参数表、三门结果、commit 信息。
