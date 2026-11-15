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

## 7. 施工记录（对账补缺票 · T-NPC-11 · 2026-11-15）

> 本票按 scrum-master 派令口径以**对账先行**施工：先逐条对账票面验收与 T-UI 链
> 已交付现状（基点 80d9ed2）的差距，只补缺口不推倒重做。对账结论逐条在册如下。

### 7.1 对账结论表（票面验收 §5 + 会师条件 §4 逐条 vs 现状）

| # | 票面项 | 现状证据 @80d9ed2 | 结论 |
|---|---|---|---|
| 1 | §5.3-1 转移表全覆盖 | core test「转移表逐边」（逐边+图外组合不可寻） | 在册有测试 |
| 2 | §5.3-2 非法意图不抛 | core test「非法意图零抛零变零事件」——**仅 idle 态枚举**；「9 态 × 全意图集枚举」半边缺 | 缺→补（红测：全枚举守门） |
| 3 | §5.3-3 open 恰发一次 | core test「open 恰发一次」 | 在册有测试 |
| 4 | §5.3-4 close 三值路由 | core test「close 三值路由」+「轻问候收尾」 | 在册有测试 |
| 5 | §5.3-5 bubble 不发 open | core test「bubble 边零 dialog 事件」+ ui test「hover 气泡」 | 在册有测试 |
| 6 | §5.3-6 徽章上限 | core test「dialogBadgesAfter 封顶」+「机器内徽章」 | 在册有测试 |
| 7 | §5.3-7 TTS 仲裁三分支 | core test「ttsPlanFor 三分支」+「A 通道抑制」 | 在册有测试 |
| 8 | §5.3-8 收敛跃迁 | core test「hudConvergenceFor」+ ui-core「会话衔接」+ ui「点选开会话/稍后/seek 全链」 | 在册有测试 |
| 9 | §5.3-9 确定性 | core test「确定性」 | 在册有测试 |
| 10 | §5.3-10 零突变 | core tests（badges/queue 入参零突变 + snapshot 只读） | 在册有测试 |
| 11 | §5.3-11 会话可重入 | core test「会话可重入」+ ui test「离镇卫生」 | 在册有测试 |
| 12 | 收敛矩阵（§3.1）open 收敛/close 恢复 | ui-core「会话衔接」（open→dialog-dimmed 冻结/close 按结果恢复）+「可见性」两测 + ui「稍后无压力关闭/seek 全链 done 落完成」 | 在册有测试 |
| 13 | TTS 仲裁三分支断言 | 同 #7 | 在册有测试 |
| 14 | §1.7 无倒计时 | core「参数表禁区」+「话术零倒计时」+ ui-core「任意事件序列不产生失败态」 | 在册有测试 |
| 15 | §1.7 无红叉 | ui「CSS 守门切片（零警示红）」+ ui-core css 零警示红 | 在册有测试 |
| 16 | §1.7 无键盘依赖 | 双 js 源扫描零键盘绑定（对账自证），**零守门测试** | 缺→补（红测：源文本守门） |
| 17 | §1.7 无段落文本 | 文案面短句在库，**零段落守门测试** | 缺→补（红测：文案守门） |
| 18 | B1-B8 参数默认值（prebuild §6） | core test「B1-B8 参数表落点显式」逐键 | 在册有测试 |
| 19 | 三件套 DOM 装配 | ui tests：会话层挂载/hover 气泡/点选开会话/签名门控/E2E 两链 | 在册有测试 |
| 20 | 会师 1：入口缝 ADR | ADR-0011 在库（docs/adr/0011）；宿主现实=town-ui.js 持有（dlg=mkDialogMachine :302/:961，dialog-core 挂 index.html:378） | 销号（按现状对账，票面 §4-1 口径以此为准） |
| 21 | 会师 2：T-NPC-10 click-npc 意图源 | 本票不接线 npc 条目（已裁）；验收走既有 task 条目驱动面（ui tests DLG_TASK_*）+ 单测合成 payload（core tests entryOf） | 销号（已裁口径） |
| 22 | 会师 3：T-UI 链派工边界 | T-UI 线本轮不在场，无双线同文件风险 | 销号 |
| 23 | 会师 4：双事件名 | `town-ui/dialog/*` 唯一权威已实现（DIALOG_EVENTS 三键+全链行为断言）；旧名 `town:dialog*` 双 js+index.html 零出现（对账自证），**零守门** | 在册缺守门→补（红测：事件名权威守门） |
| 24 | SpeechKit TTS 排队接线（票面 §1） | ttsPlanFor 纯函数+断言在库；装配层 SpeechKit 排队消费未接线 | **归 T-UI-04，本票不涉**（已裁 2） |
| 25 | hotbar 会话避让 | 不在本票验收面 | **归 T-UI-04，本票不涉**（已裁 2） |
| 26 | Speaker 头像位（票面 §2 供数） | 供给面在库：registry faceSrc:'facePixels'（town-npc-registry.js:168）；装配未消费 | 供给已备=票面 §2 口径满足；消费归 T-NPC-10 接线驱动面，本票标注不补 |

### 7.2 文件域修订记录（授权：已裁 5，按 ADR-0011 后现实）

- 票面原文无显式文件域节（README §2：波次二票文件域 ADR 后修订）。本票施工文件域裁定：
  `js/town-dialog-core.js`、`js/town-ui.js`、`test/town-dialog-core.test.js`、
  `test/town-ui.test.js`、本票面（§7 施工记录）。
- 红线维持：不触 index.html / js/town-interact-core.js / js/town-map-core.js /
  js/modes/adventure.js（T-NPC-10 并行域）；index.html 仅测试只读扫描（装配守门先例）。

### 7.3 红测试清单（TDD 红相）

| 红测 | 红因分类 | 自证 |
|---|---|---|
| core「多值边 payload.to 越边拒绝」 | 真缺口（实现越边）：resolveBranch 对 payload.to 不验边数组，垃圾 to 把机器带出 DIALOG_STATES / 经 close 侧门收会话 | 红跑输出：route{to:'bogus-state'} 后 state()='bogus-state' ∉ 九态 |
| core「全枚举守门 9 态 × 11 意图」 | 守门（既有合规，突变自证） | 突变 resolveBranch 缺省 outcome→红；还原→绿 |
| core「事件名权威守门（常量面）」 | 守门（既有合规，突变自证） | 突变 DIALOG_EVENTS 值→红；还原→绿 |
| core「禁止项守门：文案零段落」 | 守门（既有合规，突变自证） | 突变 PANEL_BODY 注入换行长段→红；还原→绿 |
| ui「禁止项守门：零键盘绑定」 | 守门（既有合规，突变自证） | 突变 town-ui.js 注入 keydown 探针→红；还原→绿 |
| ui「事件名权威守门（源扫描）」 | 守门（既有合规，突变自证） | 突变注入 town:dialog 字面量→红；还原→绿 |

### 7.4 绿轨迹与终验（本岗验收后回填）

（验收绿后回填：转绿轨迹、npm test 终值、lint 终值、tip SHA。）
