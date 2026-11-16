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

- 转绿轨迹：红相 d6ebfcf → 绿方 implement-engineer 施工 → 绿相 **8c762eb**
  「多值边 payload.to 越边拒绝——resolveBranch 验边转绿(六红全收)」。
  修法语义（仅 js/town-dialog-core.js，+10/-5）：`resolveBranch(type, payload, allowed)`
  增边数组参——`payload.to` 只认边数组内 outcome（图内照常显式优先，越边返回 null）；
  handle 调用点对 null 零惩罚拒绝（早退先于 close 分支，to='idle' 侧门封死）；
  缺省分路零漂移（route 按 sessionKind、next-step 缺省 complete，两缺省值均在边数组内）。
  五守门测试现状合规，实现零改动。
- 验收绿（本岗亲跑复核，非绿方自报转抄）：
  - `node --test test/town-dialog-core.test.js test/town-ui.test.js`：81 测 81 绿 0 红；
  - `npm test`：**2128 测 0 红**（2122 基线+6 新增；1 skipped=T7 性能钉测 env 门控，基线常态）；
  - `npm run lint`：eslint + stylelint + htmlhint 全链零错误；
  - 纪律：测试文件对红相 d6ebfcf 逐字节零漂移（git diff=0 行）；禁触清单
    （index.html/town-ui.js/town-interact-core.js/town-map-core.js/adventure.js）零触碰；
    实现域单文件单提交。
- **票分支 tip = `8c762eb`**（t-npc-11-dialog：80d9ed2 → d6ebfcf 红 → 8c762eb 绿）。

### 7.5 票外发现与移交（不扩票，如实登记）

1. **route 缺省分路对 sessionKind='greet'/'care' 落 'guide'**（ROUTE_BY_KIND 无此二键，
   `|| 'guide'` 兜底）：现网 task 条目仅 tour/seek/help 三键不受影响；T-NPC-10 接线
   npc 条目（greet 问候类/care 阿稳关怀类）时须先对齐分路口径——greet 类按 spec §5.3
   场景 4 应走 L1 轻问候 close 路径而非 guide 导览。本票票面无此断言面，移交 T-NPC-10。
2. **Speaker 头像位 facePixels 消费未接线**：供给面在册（registry faceSrc:'facePixels'），
   装配层 Speaker Strip 现只有名字——消费归 T-NPC-10 驱动面（对账表 #26）。
3. **TTS 排队与 hotbar 会话避让归 T-UI-04**（已裁 2）：ttsPlanFor 纯函数+断言在库，
   装配层 SpeechKit 排队消费未接线，本票不涉（对账表 #24/#25）。
4. **规范正文滞后债（评审 should 补登）**：本票新增四类守门断言（9 态 × 11 意图全枚举/
   事件名权威/零键盘依赖/零段落文本）后，conventions.md / GLOSSARY.md 无对应回写——
   存量票豁免硬性验收（README §6 自下批新立票生效），但滞后事实在册；规范正文回写
   归 scrum-master 会师时统筹。
5. **备查两则（评审观察项，一句话级）**：①票面 §3 `mkDialogMachine({emit, now})` 措辞
   与实现 `mkDialogMachine(opts)` 有出入——prebuild §5.2 明示命名以实现票定稿为准，
   实现零墙钟达成确定性（偏离登记在 core 测试头），非缺陷，票文维护时订正；
   ②resolveBranch 缺省分路不经 allowed 验边的不对称性已核实有界（route 按
   sessionKind 与 next-step 缺省 complete 两缺省值均在边数组内），记录备查。
6. **移交条目销号 + 发起侧新约束（T-NPC-10 线核毕，2026-11-15 追令回登）**：本台账
   第 1 条「route 缺省分路对 sessionKind='greet'/'care' 兜底 'guide'」**销号**——
   dialog-core 零改动定案：①条目六键无 payload 维度，分路裁决权不在条目层；②route
   缺省兜底仅对显式派发的 route 事件生效，greet 态自有 `end:'idle'` 直达边
   （click-npc 双起步），即 dialog-spec §5.3 场景 4/5 协议路径，无需流分派；③route
   目标域冻结三值无问候目标，补映射不可表达，改目标域即动冻结面。**新约束（发起侧
   口径，归 dialog 装配面）**：greet/care 会话**不得派发 route 边**——town-ui.js:641-665
   驱动缝现只对任务会话自动 route，npc 条目（greet/care）点选走 click-npc 双起步即达
   终态不发 route；未来任何 dialog 装配/驱动改动必须保持「greet/care 不派发 route」。
   出处：T-NPC-10 票面施工记录 / T-NPC-10 回执（核毕证据在其线在册）。
7. **第 6 条装配面前提证伪与接缝修复（T-NPC-11 接缝票，2026-11-15，分支
   t-npc-11-seamfix）**：
   - **失实前提（第 6 条原文）**：「town-ui.js:641-665 驱动缝现只对任务会话
     自动 route，npc 条目（greet/care）点选走 click-npc 双起步即达终态
     不发 route」。
   - **实测事实（红相 525b19d 四条测试复现）**：驱动缝（town-ui.js:667）对
     一切带 sessionKind 条目**无条件**派发 route——5/11 npc 条目误路由
     （greet×4=v01/v07/v08/v10 + care×1=g01 落 `ROUTE_BY_KIND` 缺键
     `'guide'` 兜底，非轻问候路径）；tour/seek/help 在册键不受影响。第 6 条
     ①②③（dialog-core 侧协议论证+冻结面论证）依然成立，失实的仅装配面
     现状描述。
   - **修复后口径（绿 7231bd2，裁决选项 A）**：ROUTE_BY_KIND 经 CJS 导出面
     双栖可见（映射本体单份在 core，映射/冻结三值/机器语义/加载副作用
     零触碰）；驱动缝 route 派发条件化——只认在册键（tour|seek|help），
     greet/care 豁免零派发停 greet 态（轻问候路径，§2.2 矩阵 greet 行
     自动播问候句一次，判据同源 ROUTE_BY_KIND）；speakDlgStep 在册键
     瞬态不播照旧（任务会话零双播）。「greet/care 不派发 route」约束
     （第 6 条新约束）自此由守门矩阵测试执法（test/town-ui.test.js 尾
     四条，绿 commit 对红相逐字节零漂移）。
   - **sessionKind 五值 × route 派发行为矩阵（条件化前→后，记录完整性
     追令 2026-11-15）**：

     | sessionKind | 条件化前 | 条件化后 |
     |---|---|---|
     | greet | 无条件派发→缺键落 'guide' 兜底（**误路由**） | 不派发→驻留 greet 态（轻问候，播问候句一次） |
     | care | 同上误落 guide（**误路由**） | 不派发→驻留 greet 态（care 关怀单步呈现，B7） |
     | seek | 派发→seek | 派发→seek（不变） |
     | help | 派发→help | 派发→help（不变） |
     | tour | 派发→guide（**在册派发，非兜底、非行为变更**） | 派发→guide（不变） |

     tour 行实证三源：core 源码 :119 映射在册（tour→'guide' 为显式键值，
     非缺省兜底）；dialog-core 测试「route 分路」（update 随行 intent 词
     =机器语义铁证，兜底路径不给 intent）；红相复现 tour→guide 正确。
     **核对声明**：上表与 dialog-spec §5.3 场景表五行逐行对齐（观察导览
     →tour / 寻找-回应→seek / 帮助完成→help / 轻问候→greet / 铁傀儡
     关怀→care），逐行过表核对无冲突。
   - commit 谱系：525b19d 红相（3 红+正控绿）→ 7231bd2 绿（四条全绿；
     npm test 2158 测 0 红 1 skipped；测试对红相逐字节零漂移）→ 本条
     票面修正与红方 lint 自修同 commit 收口（:2134 测试名折行拼接、
     运行时名逐字节等值，文件尾空行收净；断言零触碰，56 测 0 红复跑；
     系红相 525b19d 自带 lint 缺陷，绿方零触碰纪律下留红方职权修正）。
