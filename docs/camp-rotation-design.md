# 训练营每日轮换 + 表现奖励（设计定稿）

> 状态：**活权威**（2026-10-28 定稿并落地）。模块词条见 [GLOSSARY.md](../GLOSSARY.md)
> 「训练营轮换」；实现：js/camp-rotation-core.js（纯核心+同名单测）+ js/main.js 接线。

## 0. 背景与拍板

三训练营（专注 / 数学 / 怪物指挥官）全做每日负担渐重；且部分营简单做得快，
孩子不过瘾。产品目标：**每天负担可控、表现好有甜头**。用户拍板三项：

1. 奖励营由**孩子二选一**（不做随机/跳位指定）；
2. 未放行的训练营卡**彻底隐藏**（孩子眼里每天只有 1~2 张训练营卡）；
3. 计时口径 = **关卡内时间**（复用每日预算的 spentMs，地图页/今日页发呆不计）。

## 1. 规则

- **每日轮换**：主菜单每天只放出一个"今日训练营"，顺序 `robot → focus → math`
  按日期天序（纪元天数 % 3）循环；上线日 2026-10-28 = robot（用户要求第一天
  从机器人开始，test/camp-rotation-core.test.js 钉死）。
- **表现奖励**：今日营 **6 关全部做完**（预算关数封顶，失败重试也计——预算口径
  即"做完"口径）且 **关卡内总用时 ≤ 8 分钟**（`Budgets.<camp>.spentMs()`）且
  **当日平均正确率 ≥ 80%**（各营结算上报的当关正确率均值）→ 当天解锁一个奖励营。
- **二选一**：解锁后主菜单亮出剩余两营（✨徽章+一次性语音播报），孩子点哪张哪张
  当今日奖励营（点卡即落选并进入模式），另一张随即隐藏。
- **一天至多 2 营**：奖励营做完不再触发评估（只有今日营能发奖）；已解锁幂等。
- **额度不变**：奖励营沿用自身 6 关/20 分钟预算。本政策只改"今天开不开门"，
  不碰 MISSION 的防沉迷红线。

## 2. 判据口径（全部复用现成机制，零新增计时器）

| 判据 | 来源 | 触发点 |
|---|---|---|
| 做完 6 关 | `Budgets.<camp>` spentCount/capCount | 预算 `onExhausted`（时长或关数任一触顶都进评估；时长触顶必然超 8 分钟，判据自然判否） |
| ≤8 分钟 | `Budgets.<camp>.spentMs()` | 同上（三营结算先 stopTicker 再 count，评估读到的即终值） |
| ≥80% | 各营结算 `noteCampResult` 上报 | **上报必须在 `count(1)` 之前**——onExhausted 在 count 内同步触发，顺序颠峰会漏计第 6 关成绩 |

成绩口径按营：focus / math = `st.acc`（0..1 → 百分比）；robot = 答对盘/总盘
（与家长日志 `b<带>.acc` 同式）。4 盘全对 = 100%，3/4 = 75%——robot 的 80% 线
实际即"全对"，与 ⭐⭐⭐ 的"全对"口径同源。

## 3. 模块与存档

- `js/camp-rotation-core.js`（纯核心，零 THREE/DOM，配 test/camp-rotation-core.test.js）：
  轮换表 CAMP_ROTATION_ORDER · 日期天序 · evalReward 纯判定 · 账本无突变迁移
  （freshState/ensureDate/noteAcc/earnReward/chooseBonus/isRewardChoice）。
- `js/main.js` 接线（规模同 setupBudgets）：`setupCampRotation`（读账本 + 挂三营
  onExhausted）· `noteCampResult`（模式上报缝）· `campRotPickIfPending`（卡片点击
  落选）· `refreshCampCards`（显隐 + 📌/✨ 徽章 + 二选一开场播报一次性）。
- `js/modes/{focus,math,robot}.js`：结算处各一行 `noteCampResult(...)`（在 count 前）。
- `index.html`：core 脚本一行；`css/style.css`：`.camp-off`（彻底隐藏）/ `.camp-badge`。
- 存档单键 `camp_rotation_save`（SyncDB 同步，registerSyncKeys 登记）：
  `{date:'Y-M-D', reward:bool, bonus:id|null, acc:{<camp>:{n,sum}}}`；
  午夜翻转 = 整本重置（ensureDate，同每日预算惯例），奖励态与正确率累计都是当日的。

## 4. 边界情况

- **中途关页**：预算 ms/关数与正确率累计均已落盘（每关直写），重进后第 6 关结算照样判奖。
- **磨蹭**（20 分钟时长先触顶、6 关未完）：判否，今日无奖励（onExhausted 每天至多触发一次，无重复评估）。
- **奖励营做完**：onExhausted 同样进钩，但 dailyCamp 不匹配直接返回——结构上保证至多 2 营。
- **?dev=1**：预算全开 → onExhausted 永不触发 → 三卡全显（refreshCampCards 的 DEV 旁路），方便调试（同 dev-mode-design D2 口径）。
- **跨午夜**：ensureDate 翻转，奖励态与 acc 累计作废重计。
- **多设备**：账本随 SyncDB 按设备整份覆盖（后到者赢），与 daily_budget_save 同语义。
- **启动时序**：buildMenu 时 CampRotState 尚未装载——今日营派生不依赖存档，显隐即时生效；
  奖励态在 SyncDB.ready → setupCampRotation 补刷。

## 5. 后续可选（未做）

- 家长面板"今天全开"应急开关（按项目惯例走存储临时放行，不把日期写进源码）。
- 奖励营改三选一 / 随机：纯核心 rewardChoices/chooseBonus 已隔离该政策，只动接线。
