# villager-wave2 收口回执（村民全量进镇·波次二）

- 日期：2026-11-15
- 派令方：scrum-vw2（需求线）；施工：T-NPC-10/11/12 各 tdd-engineer 主（绿方主内自派）
- 收口：engineer-manager（engr-mgr-vw2）
- 集成 tip：**villager-wave2 @ 807555f**（seamfix 并入 merge commit；基点 main@80d9ed2）
- 收口物料：本回执 + conventions.md 两债回写 + tickets/README.md 三票状态列改写 + 两散落回执入库

## 1. 本批票与谱系

| 票 | 内容 | 评审 | 状态 |
|---|---|---|---|
| T-NPC-10 | townInteractBoot 接线（交互机宿主落位 + 11 条 NPC 条目入册 + 站位锚升格会师 21 锚） | 双轴过审 | 已收口 |
| T-NPC-11 | 对话 UI 挂载（town-dialog-core 九态机 + 三件套装配 + TTS 排队） | 双轴过审 + 收口接缝修复 | 已收口 |
| T-NPC-12 | 锚点动态消费（anchorChanged 谓词 + advTownAnchorTick 消费机，注入式验收） | 双轴过审 | 已收口 |

谱系：main@80d9ed2 ←（三票施工并入）← ae8b1fa ← 525b19d（seamfix 红）← 7231bd2（绿）← c0f1ffc（红方收口）← **807555f（并入集成）**。

## 2. 测试终值（集成 tip 亲跑，非转述）

- `npm test`：**2158 测 / 2157 过 / 0 红 / 1 skip**（skip=T7_PERF env 门控基线常态）——基线 2154 + seamfix 新增 4 恰合
- `npm run lint`：eslint + stylelint + htmlhint 三关零错误
- `node --test test/conventions.test.js`：**13/13 全绿**（两债回写后对账）
- 合并树一致性：ae8b1fa 与评审时 01799f5 逐字节一致（评审终值 2154/0红/1skip 随树继承）

## 3. 收口整体评审与接缝修复（must 闭环）

**规格轴唯一 must**：「greet/care 不派发 route」销号前提失实——town-ui.js 驱动缝（原 :667）对一切带 sessionKind 条目无条件派发 route；T-NPC-10 入册 11 条 npc 条目后，greet×4（v01/v07/v08/v10）+ care×1（g01）共 5/11 条目点选误落 guide 兜底，非 spec §5.3 场景 4 轻问候路径。town-ui.test.js 零 `npc:` 用例，接缝无守门，三票各自评审均未见过红。

**修复**（t-npc-11-seamfix，按「修复项不换岗」追令 T-NPC-11 原主，scoped 复核 8/8 通过后并入）：
- 红测试先行：四条 npc 接缝守门用例（红相 3 红 + 正控 1 绿）
- 裁决选项 A：town-dialog-core.js **仅 CJS 导出面追加 ROUTE_BY_KIND 一项**（冻结面零改动、映射本体 :119 三值/机器语义/加载副作用零触碰亲核；scrum 备案口径「导出面可见性一项放行」）
- town-ui.js：双栖解析消费 ROUTE_BY_KIND + 驱动缝 route 派发条件化（hasOwnProperty 在册键才派发）+ speakDlgStep greet 驻留播报配套（判据同源）
- 判据单份实证：js/town-ui.js 全文件唯 ROUTE_BY_KIND 一处来源，零字面 kind 誊写
- 既有守门面零漂移：绿相零触碰红测文件（`git diff 525b19d..7231bd2 -- test/` 空）、:1094 计数钉 20 原样、T-UI-11 异议通道未触发

**守门用例列名（四条，终门全绿）**：
1. `npc greet 接缝(T-NPC-11 修复): 点选开会话零 route 派发——面板停 greet 轻问候播问候句, 挥手再见收尾 close{continue} 非 guide 误路由`
2. `npc care 接缝(T-NPC-11 修复): 点选开会话零 route 派发——面板停 greet(B7 关怀轻交互), 稍后收尾零负面`
3. `正控(T-NPC-11 修复零误伤): 任务会话自动 route 照旧——task tour→guide、task help→help(ROUTE_BY_KIND 在册键照常派发)`
4. `守门矩阵(T-NPC-11 修复): 驱动缝 route 派发只认 ROUTE_BY_KIND 在册键——五值逐条 tour→guide/seek→seek/help→help 自动 route, greet/care 豁免停 greet`

**sessionKind 五值 × route 派发行为完整矩阵**（条件化前 → 后；权威落点 T-NPC-11 票面 §7.5 第 7 条）：

| sessionKind | 条件化前 | 条件化后 |
|---|---|---|
| greet | 无条件派发→缺键落 guide 兜底（误路由） | 不派发→驻留 greet（轻问候，播问候句一次） |
| care | 同上误落 guide（误路由） | 不派发→驻留 greet 态（care 关怀单步呈现 B7；九态机无 care 态，实测校正如实记） |
| seek | 派发→seek | 派发→seek（不变） |
| help | 派发→help | 派发→help（不变） |
| tour | 派发→guide（**在册派发，非兜底、非行为变更**；三源实证：源码 :119 / core 测试 intent 随行铁证 / 红相复现） | 派发→guide（不变） |

**§5.3 逐行对齐声明**：上述矩阵与 docs/design/town-ui-dialog-spec.md §5.3 场景表五行（观察导览→tour / 寻找-回应→seek / 帮助完成→help / 轻问候→greet / 铁傀儡关怀→care）逐行过表对齐，无冲突。

**票面修正（三段式，双票对称）**：T-NPC-11 §7.5 第 7 条（失实前提原文 → 实测事实 5/11 → 修复后口径选项 A + 五值矩阵）+ T-NPC-10 §6.5（论证成立 + 装配面前提证伪 + 修复指针）。

## 4. T-MAP-04 销号声明

PO-pending 载体票销号：A-01 协议定稿 ③「NPC 动态锚点重发节奏归村民接线票」——本批落地：`anchorOf(id, legIndex)` 取数器（T-NPC-04 数据层）+ `anchorChanged` 同域纯谓词与 `advTownAnchorTick` 消费机（T-NPC-12，注入式验收缝，生产调用点无参=leg0 行为层预留）。**锚点坐标只在到站（航点切换）时变化、不逐帧刷新**的口径与销号方案一致，会师点闭环。

## 5. 对账结论（两轴）

- **标准轴**：零硬违规。GLOSSARY 三票回写互恰（二十条↔TOWN_INTERACTS 20、anchorChanged 词条↔头注释、face→yaw 单源消名实据）；lint 与测试面亲核零错。四条 smell 判断题全在守门/票面授权内（锚坐标双写有对账锁、look 文件名三处枚举有注释分工、policy 参数为票面明示预留、adventure.js 累积趋势记档）。
- **规格轴**：三票各自验收面兑现、无越票无 creep（四遗留指针亲核零顺手实现）；冻结四表（sessionKind 五值 / townTargetOf 六键 / TOWN_UI_EVENTS 四名 / DIALOG_EVENTS 三键）合并树零改形；三表一册 21 锚↔20 条（11 npc）↔注册表 14 行全对账。唯一 must（greet/care 误路由）已修复闭环（§3）。

## 6. 规范滞后债两笔（scrum ≤10 行授权，本批顺手落）

- **债 a**（T-NPC-10 §6.7 登记）：conventions.md §2.1 补装载序 gate 执法登记（3 行：hand-view 链序 + 镇民链序两条 gate 先例，正文不逐链誊写，新增多文件链同步扩 gate）
- **债 b**（T-NPC-11 §7.5 第 4 条登记）：conventions.md 新 §7.6 对话域守门四面登记（9 行：全枚举/事件名权威/零键盘/零段落，权威指针 town-ui-dialog-spec.md §5.3/§1.7）
- 均为事实登记（不动升格判据、不立新约定）；落笔后 `node --test test/conventions.test.js` 13/13 对账全绿。

## 7. 工件清单

- 入库：`iconkey-decision.md`（iconKey 定稿：help×10/care×1 + TOWN_CARD_ICONS care 行）、`t-npc-10-green-closeout.md`（T-NPC-10 绿方收执）、本回执
- 不入库：`RELAY-JOIN-REQUEST.md`（relay 重启期子线投递残片，记 retro 环境债）
- 票面：三票施工/修正记录各在其票面（.scratch/town-design/tickets/）

## 8. 遗留清单（皆有在册去处，零悬空）

1. 复核工备注两条（judgement call，无阻断）：守门矩阵用例的 id/label 装饰性元数据与真实注册表错位（行为断言面完整正确），后续票顺手对齐；红测块注释「dialog-core 零改动」为红相追令原文快照，与最终裁决（导出面一项放行）措辞有差，完整裁定链在票面 §7.5 第 7 条在册。
2. TTS 排队与 hotbar 会话避让装配消费：归 T-UI-04（已裁，ttsPlanFor 纯函数+断言在库）。
3. 行为层 legIndex 消费（生产恒无参=leg0）：票面明示注入式验收缝，行为层票落地前属预留。
4. 计数钉异议通道（T-UI-11）：未触发（:1094 原样 20）。
5. 回执同步回报派令方 scrum-vw2 做终局对账（六项清单）。

## 9. 验收门

PO 验收走 relay ask_user 一揽子（随本回执）；retro 落 `.opencode/power-luna/feedback/`（验收后）。
