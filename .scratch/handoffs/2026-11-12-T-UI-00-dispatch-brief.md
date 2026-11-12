# 派单：T-UI-00 入口卡与进出过渡视觉规格落地准备

> 提票：engineer-manager（town-design Phase C）· 2026-11-12
> 安排：PO 已指示由 scrum-master 安排执行（本会话无 ui-designer 派发权限）
> 回执：完成后合并回执交回 engineer-manager 收口（本票并入 town-design 分支）

## 票面（对齐 docs/town-architecture-design.md §11）

| 字段 | 值 |
|---|---|
| 票号 | T-UI-00 |
| 标题 | 入口卡与进出过渡视觉规格落地准备 |
| 类型 | ui-wiring(spec/design handoff)，纯设计交付 |
| 依赖 | 无（可立即开工） |
| blocking | T-MAP-02、T-UI-01（入口视觉输入） |
| ui_designer_route | **required** |
| ui_scope | A |
| ui_refs | docs/design/town-ui-entry-hud-spec.md §3、§8（U1-U3） |
| 需 tdd | 否（不写代码/测试） |

## 环境

- worktree：`C:\Users\user\.local\share\opencode\worktree\1631a8\town-design`，分支 `town-design`（HEAD 随施工推进，以 git log 为准）
- **本票只产出文档**：不改 `js/`、`test/`、`index.html`、`css/`（实现归后续票）
- 并行冲突规避：prefab 线正在改 `js/prefab-kit.js`、`test/prefab-kit.test.js`；本票仅触碰 `docs/design/`（新增）与 `docs/README.md`（索引行）
- 若在独立 worktree 施工：完工后由 engineer-manager 合并入 town-design（合并权在本岗）

## 设计权威（必须按文件现状读，不私改）

1. `docs/design/town-ui-entry-hud-spec.md` §3（3.1-3.4 入口卡全部小节）、§8 待确认点 U1-U3 —— **定稿，本票是落地准备/细化，不得推翻**；发现内部矛盾列歧义走需求线，不擅自裁决
2. `docs/design/town-buildings-visual-spec.md` §4（城镇总色盘，卡片识别色取色来源）
3. 现有实现参照（只读）：`index.html` 模式卡结构（mode-card / big / h2 / small）、`js/mode-registry.js`、`css/` 既有卡片样式约定
4. 架构约束：`docs/town-architecture-design.md` §6.1（ModeRegistry 接入建议：`{id:'town', name:'小镇漫步', gated:true, mood:'calm'}` 为默认建议）、§7（UI 接线架构）

## 交付物（一票收口）

1. **入口卡 token 清单**：卡片识别色（暖樱粉+浅石暖底+天蓝点缀的具体色值，逐项对齐 buildings spec §4 色盘 HEX）、主图标方案（emoji 🏘️ 占位 + 后续像素图标 UI-01 风格规格）、标题/副标题默认文案（U1 默认「小镇漫步」/「逛广场 · 找朋友 · 轻松玩」+ TTS 读法）、hover/pressed 反馈档（对齐既有卡片层级语言，不另造营销 hero 样式）
2. **进出过渡规格**：无二次确认（U3 默认）、复用 `#fade`/splash 语言的轻量过渡参数（时长 0.8-2s 体感区间建议、暖色渐显、小镇图标/钟塔剪影占位、可选 TTS「我们去小镇啦」）、禁止项清单（无进度条焦虑、无倒计时、无风险提示弹窗）
3. **资产占位清单**：UI-01~UI-05 中入口阶段涉及的图标/底板，标注哪些用现有资产/emoji 占位、哪些留待后续票（对齐 `docs/town-assets-requirements.md` §7）
4. **待 PO 确认项显式列表**：U1/U2/U3 默认值已按 spec 落，标注可参数化的落点

落点建议：`docs/design/town-ui-entry-tokens.md`（体例对齐既有 -spec 文档），并更新 `docs/README.md` 索引。

## 硬约束

- 6 岁可读、纯鼠标点选、图标+中文 TTS、零惩罚零倒计时（MISSION.md）
- 文档收尾带换行；`npm run lint` 与 `node --test test/conventions.test.js`（文档指针零死链）通过

## 验收（回执需附）

- 新增/修改文档路径 + 与 entry-hud-spec 定稿的对齐说明（逐小节）
- `npm run lint` 结果、`node --test test/conventions.test.js` 结果
- commit 信息（如已在 town-design 提交；否则说明施工 worktree 位置待本岗合并）

## 后续同类票预告（本次不派，仅登记）

T-UI-01..05（HUD/指引/高亮/会话/联调）均 `ui_designer_route=required`，当前被 T-MAP-02 等阻塞；解阻后按同口径提票安排。
