# T-NPC-10 townInteractBoot 接线票（交互机宿主落位 + NPC 条目入册 + 站位锚升格会师）

> 波次：**二（立票不排期）** ｜ blocking edges：**入口缝新 ADR**（交互机宿主悬空）+ T-NPC-03 + T-NPC-04
> ⚠ 本票文件域在 ADR 落地后由 engineer-manager 会同 architect 修订；以下为预算面与会师条件。
>
> **收口评审递延备忘（2026-11-14 波次一收口，派发前须并入票面）**：
> ① 标准轴 F5——装载序「kit→town_*×14→interact-core→anchor-core→registry」现编码于 2 份测试装具+2 份头注释，本票挂 index.html 后再加一处：届时按 conventions.test.js:189-198 hand-view 先例扩链序断言，并评估共享 vm loader（现状仓库先例=测试独立成文，先立断言后议共享）。
> ② 规格轴观察——face→yaw 词表含 `up` 五值但波次一无锚点使用，本票接线时对口消解（消费侧是否需要 up 或收敛词表）。
> ③ boot 冒烟覆盖债——js/town-npc.js 与 14 个 look 文件按票面设计不挂 index.html，boot 冒烟暂覆盖不到；本票挂载后此债自动清，**验收标准须显式带上「boot 全链冒烟覆盖新挂载文件」**。

## 1. 目标

NPC 实体进入交互协议：交互机宿主按 ADR 落位，`TOWN_INTERACTS` 增加 11 条 NPC 条目（V01~V10 + G01），站位锚数据升格并入布局权威，`mkTownTargets` 建机迁移到新宿主。

## 2. 会师条件（ADR 落地后逐项销号，票面开工前必须全绿）

1. **宿主落位裁定**：`townInteractBoot`/`townTargets` 的宿主——adventure 壳 town 分支（「不进表」清单惯例）vs town 维度专属装配（seam brief §③ 两候选）。现状 `js/modes/town.js:132` 建机（`mkTownTargets({emit})`）随模式壳撤除悬空。
2. **站位锚升格方式**：推荐 `TOWN_NPC_ANCHORS` 并入 `TOWN_MAP.anchors`（id 空间 `npc:` 前缀统一；已核实 `town-assembly-core.js:143` anchor 装配段零 op，并入零装配副作用）——使 NPC 交互条目满足协议冻结校验「anchorId 必在 TOWN_MAP.anchors 在册」。备选（协议扩双源）不推荐：破「锚点在册性」单源。
3. **NPC 条目 iconKey 定源**：建议复用 kit `facePixels` 头像（注册表 `faceSrc` 已预留）或 UI-01 marker 语义图标；归 ui-designer 复核后定。→ **已对齐 2026-11-15 design-lead 定稿（receipts/iconkey-decision.md）：混合方案——11 条 iconKey 字面写死（V01~V10 `'help'`、G01 `'care'`），不条件派生；Speaker 头像位走注册表 `faceSrc:'facePixels'` 供数线（归 T-NPC-11 §2 预排，本票零动作）；`TOWN_CARD_ICONS` 补 `care` 一行随本票接线落（上游授权 §五.2）。零协议增项。**
4. **重发节奏**：见 T-NPC-12 裁决（anchorOf 取数器 + 航点量化 + 重发既有 focus 事件）。

## 3. 接口形状（预算面，协议冻结部分不得改形）

- NPC 条目按冻结协议形状追加：`{ id: 'npc:v01', anchorId: 'npc:v01', kind: 'npc', iconKey: ?, label: '阿面', sessionKind: 'greet' }`——kind='npc' 必带 sessionKind（`town-interact-core.js` 校验在案）；条目数据从注册表派生，**不复制**（消费端断言：TOWN_INTERACTS 的 npc 条目 ⊆ 注册表快照）。
- 拾取/点击命中 → `interactFocus`/`interactBlur`（既有事件，零新事件名）；点选 NPC → B 侧 `click-npc` 意图（T-NPC-11 消费）。
- index.html script 挂载随宿主形态在本票一并处理（波次一刻意不挂）。

## 4. 验收标准（红绿预算面）

1. NPC 条目过 `townInteractRegistry` 校验（kind/sessionKind/anchorId 在册三重）且快照 anchor 坐标 == anchorOf 站位。
2. 宿主建机后：`focus('npc:v01')` 发恰一条 `interactFocus`（payload 六键形状不变）；`found`/`reset` 语义对 NPC 条目同样成立。
3. 注册表↔交互条目↔锚点表三表对账测试（npcId/anchorId/label 三向一致）。
4. 既有六锚点+三轻任务回归零漂移；`npm test` 全绿 + lint 零错。

## 5. 依赖的波次一产出

注册表（T-NPC-03）供条目数据；锚点表（T-NPC-04）供站位与 anchorOf；渲染适配件（T-NPC-05，可选）供实体摆放缝。

## 6. 施工记录（2026-11-15 红绿收口）

### 6.1 会师条件销号

1. 宿主落位：ADR-0011 裁定 adventure 壳 town 分支承载，`advTownInteractBoot`/`mkTownTargets` 已在 js/modes/adventure.js（上游已裁，本票销号不重裁）。
2. 站位锚升格：14 行 npc: 锚并入 `TOWN_MAP.anchors`（共 21 锚），town-map-core 保持零依赖纯核，双表一致性由对账测试锁（禁装载序 concat）；`TOWN_NPC_ANCHORS` 保留为航点计划+anchorOf 真源。
3. iconKey 定源：按 2026-11-15 定稿落（§2.3 标注），11 条数据行 help×10 + care×1，条目块注释同步定稿口径（绿方纯注释裁量，裁定通过）。
4. 重发节奏：归 T-NPC-12（本票站位恒 leg0，未触行为层）。

### 6.2 三备忘销号

- ① 装载序断言：conventions.test.js 镇民链 gate 落地（kit→town_*×14→interact-core→anchor-core→registry→town-npc.js 全链先于消费方），绿；共享 vm loader 评估维持「测试独立成文」现状（仓库先例）。
- ② face→yaw 消解：消费侧不需要 up——placeTownNpc 消费维度段权威 `townYawOfFace`（js/adventure-dims-core.js），`townNpcYawOfFace` 已消名（d52aea8）；town-npc.test.js 装具补装 town-map-core/adventure-dims-core 后 8/8 全绿（golden 修订见 6.3③）。
- ③ boot 覆盖债：挂载后 boot 冒烟覆盖 18 文件（挂载覆盖测试+链上符号在位+真实装载序注册快照 20 条），债清。

### 6.3 文件域修订记录（红方裁决，均带证据）

1. **js/town-ui.js `TOWN_CARD_ICONS` 补 `care: '💗',` 一行**（f6762fb 单独 commit）——跨域一行，上游授权=iconkey-decision.md §五.2「随 T-NPC-10 接线一并落」；help 键已在册未动。
2. **test/town-ui.test.js :1094 挂标计数 9→20**——本票 11 条入册使 T-UI-03 时代既有计数钉过时，数据跟随裁决归本票（`npm test` 全绿硬门不能等 T-UI-11）；**报备 T-UI-11：若对话消费节拍对该面另有安排，异议走票面修订回滚此钉**。
3. **test/town-npc.test.js 装具装载链扩装 js/town-map-core.js + js/adventure-dims-core.js**——消名 golden 修订（绿方实验证伪「零测试改动」：placeTownNpc 消费权威后装具须装 dims-core，且 dims-core :517 顶层消费 TOWN_MAP 故 map-core 必须先装）；registryCtx 先例同款，波次一测试装具修订报备。
4. **绿方两处纯注释裁量裁定通过**：town-interact-core.js 条目块注释同步 iconKey 定稿口径（注释与数据矛盾必须消）；town-ui.js care 行附授权出处行内注释。
5. 红方测试缺陷修（34036c8）：boot 挂载覆盖 src 前缀互斥、wiring 对账锚引用=行 id（快照行无 anchorId 键，不扩波次一冻结形状）、红期自带 lint 11 错清零。

### 6.4 对账结论

四条现状坐标动工前复核一致（零出入）；收口终值 `npm test` 2133 测 2132 过 0 红 1 skip（既有豁免）+ `npm run lint` 三关零错（红方终门亲跑复核，非转述）。

### 6.5 票外移交销号（T-NPC-11 并行线追令）

dialog-core route 缺省分路（`ROUTE_BY_KIND` 对 greet/care 兜底 'guide'）**核毕无需改**：① 条目协议恰六键无 payload 维度，分路裁决权不在条目数据层；② 兜底仅对显式派发的 route 事件生效，greet 态自有 `end:'idle'` 边即 dialog-spec §5.3 场景 4/5（轻问候/铁傀儡关怀：单步呈现+表情反馈、可无 Complete 任务语义）的协议内路径，两场景呈现列均无流分派选项；③ route 目标域冻结三值（guide/seek/help）无问候目标，「补 greet/care 映射」在现协议下不可表达，改目标域即动 T-NPC-11 冻结面。约束落发起侧：greet/care 会话不得派发 route 边（归 dialog 装配面口径，T-NPC-11/后续装配票承接）。

### 6.6 commit 谱系（分支 t-npc-10-wiring）

`76cec93` 红测试先行（五面 13 红）→ `b9800bd` 绿方施工一（10 处转绿）→ `34036c8` 红方裁决修（iconKey 定稿对齐+四裁决项+lint 清零）→ `d52aea8` 绿方定稿落地（数据行+消名）→ `f6762fb` town-ui care 行（单独 commit）。tip `f6762fb`，树净。

### 6.7 遗留指针

- T-NPC-12：站位锚动态（anchorOf legIndex 推进/重发节奏）——本票零触。
- T-UI-11：town-ui.test.js :1094 计数钉异议通道（6.3②）。
- T-NPC-11：Speaker 头像 faceSrc 供数线 + greet/care 不派发 route 的发起侧口径（6.5）。
