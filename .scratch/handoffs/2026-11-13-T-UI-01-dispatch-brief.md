# 派单：T-UI-01 城镇内 HUD 布局与任务提示容器（分区 A）

> 提票：engineer-manager（town-design Phase C）· 2026-11-13
> 安排：PO 转 scrum-master 安排执行（ui-designer route，实现票）
> 回执：完成后合并回执交回 engineer-manager 收口（并入 town-design 分支，三门零错）

## 票面（对齐 docs/town-architecture-design.md §11）

| 字段 | 值 |
|---|---|
| 票号 | T-UI-01 |
| 标题 | 城镇内 HUD 布局与任务提示容器（分区 A） |
| 类型 | ui-wiring（实现票：DOM/CSS/装配） |
| 依赖 | T-MAP-02（town 模式骨架，**未完成——最早可开工条件**）、T-UI-00（✅ 已收口 d412cff）、T-MAP-04（交互锚点协议，**未完成**） |
| blocking | T-UI-04 |
| ui_designer_route | **required** |
| ui_scope | A |
| ui_refs | docs/design/town-ui-entry-hud-spec.md §4（4.1-4.6）、§8（U4-U8 默认参数化） |
| 需 tdd | partial（纯逻辑下沉 core 并同名单测；DOM/CSS 装配经 boot 冒烟） |

## 最早可开工条件（当前均未满足，可预排不可开工）

T-MAP-02 完成（`town` 模式可进场）且 T-MAP-04 完成（目标 id 协议可消费）。T-MAP 链被 prefab 线 gate（T-PREFAB-09 票清后 T-MAP-01 解阻）。scrum-master 可先做规格细化/资产预备，实现动工等解阻。

## 设计权威（按文件现状读，定稿不推翻）

1. `docs/design/town-ui-entry-hud-spec.md` §4：L1 主提示卡/L2 方位指引容器位/L3 表扬浮现位/L4 系统轻入口；屏幕分区锚点；提示卡状态（进行中/完成一步）；TTS 重播入口；会话时收敛（§4.6）。§8 U4-U8 未决项**参数化落默认**，不擅自拍死。
2. `docs/design/town-ui-entry-tokens.md`（T-UI-00 交付）：入口侧 token 先例，HUD 侧 token 沿同一色盘/命名体例扩展。
3. `docs/town-architecture-design.md` §7.1-§7.2（分区 A 职责/A↔B 接口事件）、§0.3 引用（两 spec 接口契约）。
4. `docs/town-assets-requirements.md` UI-01~05 资产语义；`GLOSSARY.md`、`docs/conventions.md`。

## 交付物（一票收口）

1. L1-L4 布局锚点与安全区（热区 ≥44px 等效、纯鼠标、无倒计时/无失败态——§4.5 硬约束清单逐条落实）；
2. 提示卡状态机容器（进行中/完成一步）与 TTS 重播入口接线（消费 T-MAP-04 目标协议的适配层，协议未定处留 seam 并列歧义）；
3. 与对话层级避让（会话打开收敛非必要 HUD，事件语义对齐 dialog-spec §2 接口点）；
4. 纯决策逻辑（提示优先级等）若下沉 `js/town-ui-core.js` 则配同名单测；
5. token/参数表更新（U4-U8 参数化落点显式列出，供 PO 最终验收批次）。

## 并行冲突规避

- prefab 线（engineer-manager 线）在改 `js/prefab-kit.js`、`test/prefab-kit.test.js`——**本票禁碰这两个文件**；
- T-MAP 线会改 `index.html`/`js/mode-registry.js`/`js/modes/town.js`——本票 HUD 容器/样式落点为 `css/*` 命名空间、`index.html` HUD 节点与 `js/town-ui-*`，与 T-MAP 骨架的接缝在派工时与 engineer-manager 对齐合并序（合并权在 engineer-manager）。

## 硬约束与验收（回执需附）

- MISSION：6 岁、图标+中文 TTS、零惩罚零倒计时；动效克制。
- `npm test`（全量+新增单测）/`npm run lint` 零错；boot 冒烟过。
- 回执：文件清单、与 §4 逐小节对齐说明、U4-U8 参数表、三门结果、commit 信息；「ui-designer 走查记录」项由 PO 验收时履行或另行安排（登记不扣票）。
