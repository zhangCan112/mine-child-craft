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
3. **NPC 条目 iconKey 定源**：建议复用 kit `facePixels` 头像（注册表 `faceSrc` 已预留）或 UI-01 marker 语义图标；归 ui-designer 复核后定。
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
