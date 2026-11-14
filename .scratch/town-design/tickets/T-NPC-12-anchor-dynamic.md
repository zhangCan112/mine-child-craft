# T-NPC-12 锚点动态化消费票（anchorOf 消费 + focus 重发节奏）

> 波次：**二（立票不排期）** ｜ blocking edges：**入口缝新 ADR** + T-NPC-04（锚点表与 anchorOf）+ T-NPC-10（交互机宿主）+ 未来「村民日程/巡逻行为层票」（legIndex 推进者）
> 遗留销号对象：T-MAP-04 A-01 协议定稿 ③「NPC 动态锚点本票全静态、重发节奏归村民接线票（PO-pending）」

## 1. 裁决（已定，票面记录；消费侧会师后实施）

**anchorOf 纯取数器 + 航点量化更新**（非逐帧插值、非纯静态锚）——裁决与四条论证见本目录 `README.md` §3.3。本票把该裁决**接到事件流上**：

- 行为层（日程/巡逻，未来票）推进 `legIndex`；装配层每帧调 `anchorOf(id, legIndex)` 取当前锚——**取数免费，变更稀疏**（仅到站跳变）。
- 到站跳变时：若该 NPC 正被 `focus`（主目标或 interactFocus 悬挂），**重发同形状既有事件**（`targetFocus` / `interactFocus`，payload.anchor 携新值）——**零协议增项**（A-01 事件表不动；新增 `npcMove` 类事件为备选，不推荐，留会师裁定）。
- 量化节奏约束：重发事件天然 ≥ 航点步长时长（G01 慢速巡逻，秒级），HUD 侧按脏标刷新（架构 §8 口径），无抖动。

## 2. 会师条件（ADR 落地后销号）

1. 宿主 tick 归属：谁在什么时候调 anchorOf 并比对变更（维度 build 后的装配层 vs adventure 壳 town 分支）。
2. 重发挂既有 focus 事件 vs 新事件（推荐前者，理由：A-01 协议零增项、B 侧 dialog 无需感知移动）。
3. legIndex 推进者：村民日程行为是否入首个行为层票（G01 巡逻环优先，十村民日程可后置——静态锚在其日程落地前天然成立）。
4. 站位锚若已升格入 `TOWN_MAP.anchors`（T-NPC-10 会师条件 2），anchorOf 的 id 空间随之对齐（`npc:` 前缀沿用，交互条目 anchorId 恒等）。

## 3. 接口形状（预算面）

- 消费面只新增装配层逻辑，数据层（T-NPC-04）与协议层（town-interact-core）零改动。
- 重发判定纯函数建议：`anchorChanged(prev, next) → boolean`（快照比较，可测）；推进策略（到站即发 vs 聚焦才发）参数化，默认「聚焦才发」（无焦点不刷事件）。

## 4. 验收标准（预算面）

1. G01 巡狐环：legIndex 0→1 时，若 npc:g01 在 focus，重发恰一条 targetFocus（anchor=新航点）；无 focus 时零事件。
2. 静态站位 13 键：任意 legIndex 下零重发（锚不变幂等）。
3. 协议回归：TOWN_UI_EVENTS 四事件名表、townTargetOf 六键零改动（快照形状断言）。
4. `npm test` 全绿 + lint 零错。

## 5. 备注

本票是 T-MAP-04 遗留 PO-pending 的销号载体：实施回执中注明「NPC 动态锚点节奏=anchorOf 取数器+航点量化，已落地」，随波次二收口一揽子请 PO 验收（与樱花冠近似等 PO-pending 项同批）。
