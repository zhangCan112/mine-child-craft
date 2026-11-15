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

## 6. 施工记录（2026-11-15 红绿全程，票分支 t-npc-12-anchor）

### 6.1 文件域修订与裁决落点（红方裁，均带理由）

1. **anchorChanged 纯谓词落 `js/town-npc-anchor-core.js`**（扩既有 -core + 同名单测 ⑯ 三测）——
   票面 §3 原文「数据层（T-NPC-04）零改动」按现实修订为「**数据表与 anchorOf 语义零改动；
   锚点核心扩同域纯谓词**」。理由：(a) 谓词词汇=anchorOf 快照 {x,y,z,face} 四键，同模块
   同词汇域（conventions 一文件一模块——模块是「锚点域唯一权威」，快照比较谓词不另立模块）；
   (b) 零新 js 文件=零挂载链/守门扩面（镇民链 gate 与 boot 覆盖不动）。
2. **消费机落 `js/modes/adventure.js` 装配层**：`advTownAnchorTick(legById, policy)` ——
   返回 `{changed, events}`（mkTownTargets 返回值+emit 双面暴露同款惯例）；prev 账本随
   advTownInteractBoot 建/随离镇弃机步清（advTownPuppetsLeave 同链位）；update() 逐帧接线
   （镇专属件邻位 advTownReturnTick/advTownAmbienceTick 旁，行身份维度门内 gate，零 town
   字面判据——「三条全局判据零新分支」守门口径）；挂 adv 挂点（38→39 键，注入式验收缝）。
3. **推进策略参数化**：`policy` 缺省 `'focused'`（聚焦才发——无焦点不刷事件，票面 §3 默认）；
   `'always'`（到站即发）参数在位（红测钉两态）。
4. **interactFocus 悬挂面对账（上游授权「自行设计并写票面」）**：现实核查——
   interactFocus/interactBlur 事件名在 TOWN_UI_EVENTS 冻结表在册但**全库零生产者**，
   town-ui.js targetEvent 对 `town-ui/interact/*` 静默忽略（T-UI-03 域注释自证），即**当前
   无任何 interactFocus 悬挂态可对账重发**。本票对账口径=**主目标面（targetFocus）实装**；
   机器的焦点判定点（snap.focusId === id）即未来悬挂面扩展点——T-UI-03 落地 interactFocus
   生产者时按同机器同形状续接，零协议增项的机器形状已备。
5. **协议零增项落点**：重发事件名=TOWN_UI_EVENTS.targetFocus 冻结引用；payload 恰一键
   {target}；target=townTargetOf 冻结函数构造恰六键；anchor 恰三键 {x,y,z}（face 不入协议
   载荷——townInteractRegistry 快照口径，重发同形状）。
6. **测试装具修订（报备，T-NPC-10 §6.3③ 先例）**：test/adventure-mode.test.js eng 链补装
   js/town-npc-anchor-core.js（链序镜像 index.html 镇民链）+ globalThis 扩提取
   {townTargetOf, TOWN_UI_EVENTS, TOWN_INTERACTS, anchorOf, TOWN_NPC_ANCHORS}——供
   adventure.js CJS 域全局名解析与红测断言引用；既有 181 测全绿零扰动（自证在 6.2）。
7. **GLOSSARY 回写授权**（绿方随实现落）：镇民锚点表词条 interface 句补 anchorChanged 一枚。

### 6.2 红测试清单与自证（红 commit）

15 红两文件，红因两类（机器/谓词缺席与接线缺席，非装具炸）：

- **甲组** test/town-npc-anchor-core.test.js ⑯ 节 3 红（全文件 21 测 18 绿 3 红）：
  ①anchorChanged·门面（同快照恒不变）②任一键跳变即真（x/y/z/face 逐键）③退化输入保守
  判真（快照缺席→true 宁重发不漏发）。红因：谓词缺席（守卫式提取返 null，typeof 断言红）。
- **乙组** test/adventure-mode.test.js T-NPC-12 节 12 红（全文件 193 测 181 绿 12 红，红名单
  =新节 5132-5328 行全数，既有零误伤）：
  ④消费机挂点在位⑤G01 聚焦重发恰一条（验收①正面：恰一事件/恰六键/anchor 恰三键 92,24,66
  字面对账）⑥无焦点零事件（验收①反面·默认聚焦才发：changed=true 零事件）⑦静态 13 键零重发
  （验收②：任意 legIndex 含负/超界，聚焦中静态 NPC 同样零）⑧重发稀疏幂等+账本写赢（同腿
  零事件/leg1→leg2 再发恰一）⑨重发零状态扰动（focusId/states 原位）⑩策略参数化（'always'
  到站即发对照默认零）⑪done 态重发携 done（完成态回看）⑫同形状既有事件+协议回归（验收③：
  与原生 focus 事件键集同序；TOWN_UI_EVENTS 四名表/townTargetOf 六键快照零改动）⑬账本生命
  周期（离镇清·再进首跳再发不串轮）⑭非镇维度旁路（零炸零事件）⑮update 逐帧接线源文本守门。
  红因：④-⑭ 挂点缺席（A.advTownAnchorTick is not a function）；⑮ 接线缺席（update 段内
  无 advTownAnchorTick() 调用）。
- 自证命令：`node --test test/town-npc-anchor-core.test.js`（21/18/3）；
  `node --test test/adventure-mode.test.js`（193/181/12，红=新节全数）。

### 6.3 转绿轨迹（绿方施工，验收后回填）

（绿方 implement-engineer 施工记录位）
