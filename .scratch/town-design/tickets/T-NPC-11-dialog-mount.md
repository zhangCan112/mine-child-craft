# T-NPC-11 对话 UI 挂载票（B 侧会话三件套落地）

> 波次：**二（立票不排期）** ｜ blocking edges：**入口缝新 ADR** + T-NPC-10（click-npc 意图源=交互命中）（+T-UI 链对口：本票与 T-UI-04 预排同源，派工时与 UI 线对齐避免双线同文件）
> 设计权威（不推翻）：`docs/design/town-ui-dialog-spec.md` §2/§4/§5/§6/§7/§10 · `docs/design/town-ui-dialog-prebuild.md`（token/状态机×接口闭环/纯函数面 §5.1~§5.3 全套已预排，解阻即插即用）

## 1. 目标

B 侧会话能力落地：`js/town-dialog-core.js` 会话状态机纯核心（prebuild §5.1 建议独立文件）+ 三件套（World Bubble / Session Panel / Option Chip·Action Ghost）DOM 装配 + SpeechKit TTS 排队接线。NPC 侧由本线供数。

## 2. 本线供数接口（波次一已备）

- **会话对象元数据**：注册表快照 `label`（TTS 播报名，PO 默认名）/ `role` / `sessionKind`（五值冻结，N4 已销号）。
- **Speaker 头像位**（prebuild §7.2 缺口表「角色头像另立资产票」的零资产解）：`MobLookKit.facePixels(key)` 16×16 头像网，注册表 `faceSrc: 'facePixels'` 已预留——**无需新头像资产**。
- **open payload**（prebuild §2.2 冻结形状）：`{ npcId, anchor, sessionKind, taskRef? }`——anchor 取 `anchorOf` 当前值（动态锚见 T-NPC-12）。
- **图标**：手持物/职业符号复用 UI-05（`.scratch/town-design/assets/ui/town_ui_prop_*.svg` 与村民手持附件一一对应，assets-requirements §7 UI-05 行「可复用角色附件贴图渲染」）。

## 3. 接口形状（全部照 prebuild §5.2，票面不重定义）

`DIALOG_STATES`（九态小写）/ `DIALOG_TRANSITIONS` / `DIALOG_INTENTS` / `DIALOG_OPTS` / `mkDialogMachine({emit, now})` / `dialogViewFor` / `dialogEventsFor` / `hudConvergenceFor` / `ttsPlanFor` / `dialogBadgesAfter`——断言面照 prebuild §5.3 十一条红线（转移表全覆盖/非法意图不抛/open 恰发一次/close 三值/徽章上限/确定性/零突变/可重入）。

B1-B8 参数默认值照 prebuild §6 落定（PO 可后验推翻，仅改参数不改结构）。

## 4. 会师条件

1. 入口缝新 ADR：挂载宿主（谁持有 dialog machine 与 DOM 层）。
2. T-NPC-10：click-npc 意图源与 focus 事件接线。
3. 与 T-UI 链的派工边界：prebuild 已按独立 `town-dialog-core.js` 建议规避与 T-MAP-04 产物同文件冲突（§5.1 表，结论 B）；本票派工时与 ui-designer/T-UI 线对齐文件域，避免双线同文件。
4. 双事件名歧义（`town-ui/dialog/*` vs `town:dialogue:*` 旧名）按 T-MAP-04 回执口径：**`town-ui/dialog/*` 为唯一权威**，旧名不实现。

## 5. 验收标准（预算面）

prebuild §5.3 十一条断言面全绿 + 收敛矩阵（§3.1）open 收敛/close 恢复断言 + TTS 仲裁三分支断言 + 禁止项硬清单（§1.7：无倒计时/无红叉/无键盘依赖/无段落文本）扫过。`npm test` 全绿 + lint 零错。

## 6. 备注

纯核心（town-dialog-core）理论上不受宿主悬空影响、可提前施工——但为避免与 T-UI 线（持有该文件域建议权）撞车，**本线不抢先立波次一票**；若 engineer-manager 裁定本线先行，先与本票会师条件 3 对齐再开工。
