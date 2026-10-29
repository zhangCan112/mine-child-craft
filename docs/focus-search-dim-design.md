# 专注训练营 · 第六维「视觉搜索」+ 交互翻新 · 实现设计

> 需求（用户，2026-10-29）：翻新和增强专注训练营的游戏交互和 UI；看还有没有更多更新更有帮助的模式加入。
> 用户拍板：①新范式以**升格第六维度**接入 100 关螺旋（不走附加块）；②UI 翻新按「页面体验更好」从宽执行。
> 证据底座：[focus-interaction-research.md](focus-interaction-research.md)（2026-10-29 一手调研，62 条引用）——
> 第六维选型 = 视觉划消（TEA-Ch2 J 5-7 岁常模子测验 Balloon Hunt 系，§A1 首推）；交互翻新依据 §B2/B3
> （Sesame Workshop 儿童界面规范 + Dweck 过程性表扬）与 §C2（EndeavorRx 家长端「报努力不报聪明」先例）。
> 决策记录（存量进度重映射）：[adr/0008](adr/0008-search-sixth-dim.md)。

---

## 1. D6 · 视觉搜索「矿洞大扫除」（search 维）

### 构念与证据

- **认知目标**：选择性注意 + 系统性视觉扫描（自定步调划消，cancellation）。
- **一手证据**：TEA-Ch2 J（5-7 岁版）正式子测验 Balloon Hunt = 4×15 秒回合，前段纯目标、后段混入
  干扰物；Balloons 5 不限时记录用时。结构效度 SEM 把划消归「选择性注意」独立因子，与 flanker
  （强制步调+邻近干扰反应）分属不同因子——**构念重叠低，是真增量**。
- **儿童搜索发展参数**：儿童搜索速度显著慢于成人（7→10 岁才接近成人）；联合搜索童年期持续变快
  → 6 岁起步用单一特征区分，顶格才轻度提相似度。
- **红线适配**：自定步调（**无时窗压迫**——TEA-Ch2 的 15 秒时限是常模化需要，训练不搬）；纯鼠标点选；
  零文字（目标=钻石图标 + TTS 一句规则）。

### 参数曲线（`paramsFor('search', tier)`，t=(tier−1)/18）

| 参数 | 曲线 | 说明 |
| --- | --- | --- |
| rounds | 3 恒定 | Balloon Hunt 结构：回合 0 纯目标，回合 1/2 渐入干扰 |
| targets | 6 恒定 | 每回合目标数；3×6=18 恰为 `FOCUS_REWARD_TRIAL_REF`（掉落归一天然对齐） |
| cols | 6→8（round） | 网格 6×4=24 格 → 8×4=32 格（rows 恒 4） |
| density | [lerp(0.30,0.55,t), +0.15] 封 0.8 | 非目标格成为干扰矿石的概率（回合 0 恒 0） |
| similarMix | tier<8:0；8→0.3；9→0.6；10→0.9；≥11→1 | 绿宝石（同形异色高相似）混入率——与 gonogo disguiseRate 同式同门槛（cpt similar 同款台阶），qualitative 跳变渐进混编红线 |

干扰物素材：目标 = `diamond`（iconOf 像素）；干扰矿 = `coal`/`iron_ore`（iconOf）；相似干扰 =
`emerald`（mcIcon 兜底——与 cpt/gonogo 相似对同款管线）；中性填料 = `stone`（构成扫描负载，不吸引点选）。

### 记分（引擎 `runSearch`）

- **分母 = 目标总数**（自定步调无漏测试次，找齐才进下一回合——回合是干扰密度梯度，不是时限）。
- **acc = (找到 − 误点) / 总数** 钳 0：全找齐是必然事件，分数差异全由误点率承载——乱扫通吃被
  天然压制（70% 门槛 ≈ 误点 ≤5；三星 95% ≈ 误点 0，精确搜索=星级来源）。
- **反应时**：每颗钻石一条（回合起点→点中），只进家长面板 mrt，不驱动任何计分（无时窗红线）。
- 事件缝：中的 `fire(ok)` / 误点 `fire(!ok)`——连对显示、矿袋掷骰、图章落账全部照常工作；
  误点零惩罚（轻微摇摆一晃即回，无扣分动画），3 连误点走统一挫败阀安慰（mkAdapt）。

### 装配面（一处不改处处生效）

`FOCUS_DIMS` 追加 `'search'`（末位，教学第 6 关）→ 螺旋轮换 `k%6`、大师关六节、`FOCUS_CHECK_PARAMS`
六节（search 特例：2 回合×4 目标×5 列控时长）、魔鬼特训 `%6` 六天一轮、今日任务单/我的进步/家长面板
按 FOCUS_DIMS 派生——全部自动带上 search。掉落无独立池（奖励调优后按 tier 段位，不按维度）。

### 编排重排（ADR 0008）

第 1~6 教学关；第 7~99 螺旋 `dim=FOCUS_DIMS[k%6], tier=min(19, 2+⌊k/5⌋)`（k=i−6）；第 100 关六节大师。
tier 公式不变 → 顶格 19 仍在 i=91 达到；每维出现 15~16 次。
**存量档影响**：unlocked 之后的关卡内容重排（同档带不同游戏序），stars 按关卡号的历史归维展示有
装饰性漂移；tier 带、门槛、三星、mkAdapt 阶梯与挫败阀全部不动，孩子体验无断崖。

## 2. 交互翻新（B 块落地）

### 2.1 具体过程性表扬 + 连败策略（B3）

- 结算表扬升级为**带当关统计的具体版** `focusSpecificPraise(level, st)`：cpt「盯住了 N 颗钻石」、
  gonogo「挖对 N 块 + 忍住 M 次」、flanker「N 排看清中间那只」、corsi「N 条顺序记对」、switch
  「N 次听对指挥」、search「N 颗一颗颗找出来」——Mueller & Dweck 1998 夸具体过程 + Sesame
  「指向孩子选择」句式，禁人物句（「你真聪明」话术表中不存在，此处加结构性保证）。
- 连败话术从「你很努力」升级为**指向策略**（Dweck 2007：失败情境只夸努力会听成「没能力」）：
  逐维一条可执行策略（FOCUS_STRATEGY，如 search「一排一排找」、gonogo「先停半秒看清再下手」），
  结算屏新增 `.f-strategy` 金色策略行并进 TTS。
- 家长面板新增**陪玩一句话**（按日轮播）：给家长现成的过程性表扬话术。

### 2.2 mousedown 即判定（B2）

flanker 左右大按钮、switch 方块、corsi 格子全部改为 **onmousedown 即判定 + onclick 键盘兜底**
（answered/inputOn/step 互斥保证不双计）——Sesame「触点即响应」的鼠标等价物，6 岁连点场景消除
click 抬手判定的迟滞感。cpt/gonogo 刺激本就是 onmousedown（F2 现状），至此六维一致。

### 2.3 教学关三级脚手架（B2 Sesame 错误反馈）

教学关（kind=tutorial，`runFocusLevel` 注入 `params.scaffold`）答错**不惩罚只重教**，四级引擎各按
最小自然形态落地：判别=漏点刺激留场高亮+句尾指引 / 误点念「不点」；flanker=高亮中间只+念方向；
corsi=**原序列重演一遍**（亮格带提示，不推进）；switch=高亮正确方块。仅教学关生效，正式关零改动。

### 2.4 今日页层级翻新（B2「重要交互首屏可见」）

纵向按钮堆叠改为五层：**顶栏**（进度+今日额度点同行）→ 村长问候 → **主行动区** `.f-hero`
（今天玩什么 + 大开始钮，卡片化）→ 活动行（任务单/体检/魔鬼特训）→ **次菜单行** `.f-menu-row`
（宝物柜/我的进步双列）→ 日历 → 家长角。所有元素 id 不变，纯 markup+CSS 重排。

### 2.5 家长面板努力口径区块（C2）

近 7 天 练习关数/体检天数/魔鬼特训次数一行 + 陪玩一句话轮播——对齐 EndeavorRx 家长端
「报努力与完成」先例，无任何跨儿童比较。免责声明口径补第六维。

### 2.6 已核对无需改动的红线项

断签不惩罚（图章现状=漏签空白无负面标记，Lally 2010 背书 ✓）；训练块内零菜单/选择权在关外 ✓；
热区≥视觉区（search 格子 aspect-ratio 全尺寸热区，高档只压图标视觉尺寸——`pointer-events:none`
保证点选目标恒为格子本身）✓；会话节奏（6×2-3 分钟在处方带内）✓。

## 3. 明确不做（调研 §6 同步登记）

n-back（<8 岁）、双任务（8+）、SART 独立成模（6 岁高误击违反零惩罚）、加工速度独立范式（只有近迁移）、
平滑 pursuit（7-8 岁才成熟）、Cogmed 式 WM 新维度（零远迁移）、听观数狗叫（P1 候选，下轮评估）、
选关/跳关（防刷红线）。

## 4. 工程与测试

| 文件 | 变更 |
| --- | --- |
| `js/focus-levels.js` | FOCUS_DIMS+search；paramsFor D6；FOCUS_META.search；编排 1~6 教学/k%6/大师六节；FOCUS_CHECK_PARAMS search 特例；口径注释五维→六维 |
| `js/focus-paradigms.js` | runSearch 引擎；focusDispatch search 分支；runFocusLevel 注入 scaffold；四引擎教学脚手架 + mousedown 即判定 |
| `js/modes/focus.js` | focusSpecificPraise/FOCUS_STRATEGY；结算屏策略行；今日页层级重排；家长努力区块+陪玩一句话；口径注释 |
| `css/focus.css` | 今日页五层布局（topline/hero/menu-row）；search 提示条与格阵（c5~c8 类名列、found/miss/clear/hint 动画）；corsi hint；策略行/陪玩行；reduced-motion 降级 |
| `test/focus-paradigms.test.js` | 六维不变量（教学 6 关/轮换/tier 公式/大师六节/体检六节/魔鬼 %6）；search 曲线不变量（常量带/渐进混编/单调密度）；runSearch 驱动测试（首回合纯目标/acc 口径/低档无绿宝石/教学 hint）；corsi 脚手架重演测试；编排索引等价替换（stageLevel k 值不变） |

不动：mode-registry.js、daily-budget.js、camp-kit.js、backpack.js、index.html（无新增 script）。

## 变更记录

- 2026-10-29 初版（随实现回写）。证据：docs/focus-interaction-research.md §A1/§B2/§B3/§C2；
  决策：用户两问拍板（第六维升格 + UI 从宽）；重排决策：adr/0008。
- 2026-10-29 二轮增量（同日续工单，P1/P2 清单落地）：
  - **P1 回声矿洞（听觉持续注意附加块）**：TEA-Ch2 J Barking 系（调研 §A2）——数狼嚎报总数，
    长间隔声序列（1.5~2.2s，刻意"不抓"注意）考核自主维持；干扰猫叫 decoyRate tier≥8 渐入
    （音色可分，注册表恒定合成 bark/meow，杜绝音色漂移=知觉干扰）；答案格=点阵点选（零文字）。
    **形态=今日页附加块**（ADR 0008 预留的低风险入口）：不进螺旋、存量进度零重排，计 1 关额度 +
    计时长，每日一次，存档 `echo={days:{日期:{acc,rounds}}}` 滚动 90 天；答对照常掷骰入矿袋
    （试次=回合，params.trials=5）；历史记录 i=-1 不指涉编排关卡（进度/突破/星柱统计防御跳过）。
    纯函数 echoParamsFor（focus-levels）+ 引擎 runEcho（focus-paradigms）+ 流程装配（modes/focus）。
  - **P2 gonogo 拆弹窗（儿童版停止信号）**：tier≥12 `params.defuse`——误点 No-Go 不立即终局，
    进引信燃烧窗（fuseMs 650→380 随档收窄），窗内再点=拆弹成功按答对计（stats.defuseTries/Wins，
    家长 CSV 可见拆弹率），烧完=错误与直接误点同口径；放弃 SSRT 阶梯计分（6 岁不收敛，调研 §A3），
    tip 进 TTS 教「再点一下拆掉」。事件缝仍在最终结局恰发一次。
  - **P2 矿洞深度图（目标梯度可视化）**：我的进步页内 20 段横条（每段 5 关），打通段点火把、
    当前段 ⛏️ 游标；点击 TTS 读层号；只可视化不选关（防刷红线），未打通段零负面标记。
  - 新增音效键 bark/meow（audio-registry synth-only，同 level/gem 惯例）；新增狼像素头像
    wolfFace（focus-icons，同 pigFace 管线，不进怪物库）。
