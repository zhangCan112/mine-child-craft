# Minecraft 液体（水/岩浆）机制 · 调研稿

> **用途**：为液体系统（流动水/岩浆）设计稿提供 MC 一手机制底座。现状：本仓水/岩浆均为
> 静态方块（config.js `B_WATER`/`B_LAVA`，探险湖 = adventure-core.js 摆好的 `B_WATER` 面、
> 建造池塘 = build.js 同款），无任何流动/水位/交互行为。本文是 docs 三段式的 research 段，
> 供后续 `liquid-plan.md` / `liquid-design.md` 引用（下文「设计稿 §n」）。
> **调研日期**：2026-10-25。全部结论逐条标注 [Sn] 脚注，来源清单见文末。
> **信息时效**：以当日抓取的 minecraft.wiki 原文（`?action=raw` 全文核对）+ Mojang 官方
> bedrock-samples 仓库 + minecraft.net 官方 changelog + mojira.dev 官方漏洞单 + PaperMC
> 反编译补丁为准；未使用任何营销文/搬运站。版本口径：Java 1.21.x 稳定版（并标注 2026-10
> 26.4 快照的流体重构——见 §2.6）。

---

## 1. 结论速览

| 机制 | 关键参数 | 一句话行为 | 来源 |
|---|---|---|---|
| 方块状态 | level 0=源；1–7 流动渐弱；8=下落（JE 9–15 仅命令可得） | 每格流体一个 0–15 的"空度"值，源/流动/下落共用一个方块 id | [S1][S2][S3] |
| 渲染高度 | h = amount/9：源 8/9≈0.889，最弱流动 1/9≈0.111；上方有水 → 1.0 | 水面永远低于满格约 1/9（≈14.2/16，**不是**民间记忆的 14/16=0.875） | [S1][S3] |
| 水平传播 | 水 7 格；岩浆主世界 3 格 / 下界 7 格（均不含源） | 从源向四周铺成菱形（水 15 格对角），每格水位 +1（主世界岩浆 +2） | [S1][S2][S3] |
| 坡向寻路 | 每方向初始权重 1000，4 步内（主世界岩浆 2 步）找"洞"，找到即取最短路距离 | 只朝（并列最低权重的）最近凹坑方向流，其余方向不流 | [S1][S2][S3] |
| 下落 | 下落块 depth 重置为 0，渲染整格 | 水柱下落不耗水平距离，落地后还能再铺满 7 格；下落优先于侧铺 | [S3] |
| 传播速度 | 水 5 game ticks/格（4 格/秒）；岩浆 30 ticks/格（主世界）/ 10（下界） | 液体按"计划刻"逐格推进，稳定后不再排程 | [S1][S2][S3][S12] |
| 源再生 | ≥2 水平源邻居 + 下方不可流入；或 1 水平源 + 正上方源 | 无限水的两条确切规则；岩浆默认**不**再生（gamerule 可开） | [S1][S3] |
| 水岩混合 | 岩浆遇水→圆石；岩浆从上流入水→石头；水碰岩浆源→黑曜石 | 确切规则表（另有 soul soil+蓝冰→玄武岩、26.4 新增水+蓝冰→脆冰） | [S2][S3][S11] |
| 实体物理 | 水流推力 ≈1.39 m/s；溺水 15 s 气泡后每秒 2 伤害；岩浆接触 4 伤害（0.5 s 免疫）+水平速度 −50%/垂直 −20% | 流动水推实体、水任意深度免摔伤、岩浆缓慢下陷烧掉落物 | [S1][S2][S8] |
| 渲染 | 顶/底用 still 纹理、侧面用 flowing 纹理；水 2 ticks/帧、岩浆 still 16 ticks/帧 | 逐帧动画（flipbook）+ 生物群系染色（基岩灰度图运行时着色）+ 半透渲 | [S9][S10] |
| 桶交互 | 只能舀**源**方块；放置 = 放一个源并触发传播 | 空桶点源收水、玻璃瓶取水不移除源、发射器可放/收源 | [S1][S3][S7] |
| 世界生成 | 海平面 layer 62；下界岩浆海 y≈32；湖床全是源块 | 生成放的是源（不是流动水）；结构不触发方块更新 → 水墙静止是常态 | [S1][S2][S3] |
| 基岩差异 | 刻率与 JE 相同，但计划刻可**堆叠**（漏洞特性）；源再生规则更宽 | 液体双方块 id（stationary/flowing）、斜对角也能成源、waterlogged 走 layers 系统 | [S1][S2][S3][S12] |

---

## 2. 方块状态模型

### 2.1 源 vs 流动方块

- 液体只有两个种类：水与岩浆；每个液体格要么是**源（source）**——满水位、可被桶舀起、
  是传播的起点；要么是**流动（flowing）**——由传播产生、水位低于满、断了供养就消退
  [S3 § Properties]。流体可像空气一样被放置固体方块**替换**（源格放方块 = 源被移除）
  [S3 § Properties]。
- 源不需要支撑：「移除源周围所有方块，它会悬在空中」[S1 § Source blocks]。
- 源被完全包围时渲染为静止（still），否则渲染流动方向动画线 [S3 § Properties]。

### 2.2 level（水位）编码

wiki 对"空度（emptiness）"的权威口径（Fluid § Level）[S3]：

- `level`（BE 叫 `liquid_depth`）度量"有多空"。源 = 0（最满）。流动水/下界岩浆每流一格
  level +1，最大 7（到 7 停止流动）；**主世界/末地岩浆每格 +2，最大 6**（所以只铺 3 格，
  且 BE 沿平线只会出现 2/4/6 三种值 [S2 § Block states]）。
- **下落**：JE 中，上方有同流体（源或流动）的流动块 level = 8；BE 中 = 8 + 上方流体的
  level，超过 15 折回 8（即 BE 存在 9–15 的"下落+水平距离"态）[S3 § Level]。
- 流动块永远不会有 level 0 [S3 § Level]。

JE 方块状态（Water/Lava § Block states）[S1][S2]：单方块 id + `level` 0–15：

| blockstate level | 含义 |
|---|---|
| 0 | 源 |
| 1–7 | 流动（**与 fluidstate 反序**：blockstate 1 = fluidstate 7 = 接近满） |
| 8 | 下落（与 fluidstate 同值） |
| 9–15 | 仅命令可得（自然游戏不产生） |

JE 流体状态（fluidstate）在 26.4 之前是两个流体类型：`water`（源，`falling` 恒 false）+
`flowing_water`（`falling` + `level` 1–8，8 = 下落）[S1 § Fluid states]。

### 2.3 水位 → 渲染高度映射

- **h = fluidstate level / 9**。源（amount 8）→ 0.889；流动 1–7 → 0.778 … 0.111；
  **上方有水则该格渲染为 1.0 整块**（下落水柱因此渲染成整格）[S1 § Height]。
  即水面比满格低 **1/9 ≈ 0.111 ≈ 1.78/16**，不是常被引用的 14/16（0.875）。
- 反编译佐证：`FluidState.AMOUNT_FULL = 8`、`AMOUNT_MAX = 9`（PaperMC 补丁中的原版常量）
  [S13]。
- BE 的补充口径：liquid_depth 0 是最高水位但"不一定填满方块——取决于每个上角相邻上方
  的流体块"，渲染高度与流向显示都部分基于 level 值 [S1 § Block states (BE)][S3 § Level]。

### 2.4 已饱和格不再更新

液体的稳定态不消耗模拟：只有状态变化时才再次排程（反编译补丁中 `scheduleTick` 只出现在
"新状态 ≠ 旧状态"分支里）[S13]；被四面实心/源块围死的下落柱会永久静止 [S3 § Spread 步骤 4]。

### 2.5 每格状态的最小数据模型（对移植最有用的抽象）

```
格子流体 = 无 | { 源? 布尔, amount: 0..8 }   # 8=满（源或下落），1..7=流动渐弱
渲染高度 = amount/9，上方有同流体 ? 1.0
```

### 2.6 版本注脚：2026-10 官方正在收敛流体模型

minecraft.net 官方 changelog（26.4 Snapshot 4，2026-10-13）：**移除 `flowing_water` 与
`flowing_lava` 流体类型**；流体类型统一携带 `level`（整数 1–8）与 `source`（布尔）两个属性；
`#water`/`#lava` 流体标签标记 `@Deprecated` [S11]。即 Mojang 自己把"双流体类型"收敛成了
"单流体 + level + source 布尔"——与 §2.5 的抽象一致，对移植是直接的模型背书。

---

## 3. 流动 / 传播算法

### 3.1 参数总表（一手口径）

| 参数 | 水 | 岩浆·主世界/末地 | 岩浆·下界 | 来源 |
|---|---|---|---|---|
| 水平传播距离（不含源） | 7 格 | 3 格 | 7 格 | [S1][S2] |
| 每格水位增量 dropOff | 1 | 2 | 1 | [S3 § Level] |
| 最大"空度"（停流阈值） | 7 | 6 | 7 | [S3 § Level] |
| 传播速度 | 5 ticks/格（4 格/秒） | 30 ticks/格（2 格/3 秒） | 10 ticks/格（2 格/秒） | [S1][S2][S3] |
| 坡向搜索半径（从待流入邻格起） | 4 格（含起点 5 格范围） | 2 格（3 格范围） | 4 格 | [S1][S3 § Flow direction] |

水平铺展形状：平地上从源向四方向铺成**菱形**，水 15 格对角（7+1+7）[S3 § Spread]；岩浆
主世界 4 格对角、下界 8 格对角（wiki 附完整数值表）[S2 § Flow arrangement tables]。

### 3.2 坡向寻路（slope calculation / 朝最近凹坑流）

wiki 对权重算法的原文（Water § Spreading）[S1]：

> "When spreading horizontally, a weight is assigned to every direction water can flow. For each
> direction, this weight is initially set to **1000**. Then, for every adjacent block it can flow
> into it tries to find a way down that is reachable in **four or fewer blocks** from the block it
> wants to flow to. When found, the flow weight for that direction is set to the shortest path
> distance to the way down. Finally, water spreads in the directions with the **lowest flow
> weight**."

要点：

- 搜索的是"**低一格的洞**"：水平传播评估时，检查流体块**下方一格**周围区域内的空气/
  可流入流体/可被流体摧毁的块；搜索范围水（与下界岩浆）5 格、主世界岩浆 3 格 [S3 § Flow
  direction]。
- 结果：源放在离崖边 5 格内，水流会收成**一格宽**直奔崖边再跌落，而不是四向菱形 [S3 § Flow
  direction]。岩浆在主世界甚至会朝它实际到不了的跌口转向（搜索半径 2 但传播距离 3 的组合
  怪癖）[S2 § Flow]。
- 反编译佐证：`FlowingFluid#getSlopeDistance(...)` 递归搜索 + `SpreadContext.isHole(pos)`
  洞判定（命中即返回当前距离）[S13][S14]。
- 1 格宽岩浆流可被方块更新**重定向**到新的最近洼地，且不可逆 [S2 § Flow]。

### 3.3 向下优先 + 下落重置水平距离

- 下方可流入时空向下流：下方是空气 → 生成"depth 值 0"的下落流块——**下落不消耗水平
  距离**，"偶尔下落的流体比一直贴地流得远得多"（wiki 原文）[S3 § Spread 步骤 1]。
- 下方是会被冲毁的非固体（含蜘蛛网/竹笋）→ 冲毁掉落、替换为 depth = 上方 depth+1 的流动
  块 [S3 § Spread 步骤 3]。
- 下方是实心（或不受流体影响的少数非固体如梯子）→ 向所有开放侧面铺 [S3 § Spread 步骤 4]。
  四周全是实心或源 → 传播停止（静止水柱的成因）。
- 下方是同流体源 → 停止 [S3 § Spread 步骤 6]。
- **下落与侧铺的时序**：悬空源先向下流，**5 ticks 后**才向四侧铺 [S3 § Spread]。反编译
  补丁显示同刻门控：向下流之后仅当 `sourceNeighborCount ≥ 3`（水平相邻源数，即"湖泊级"
  的块）才**同刻**侧铺，否则等下一次更新（下方被自己的下落水占据后走侧铺分支）[S13]
  （≥3 阈值出自补丁调用点，wiki 未显式记载，标注为代码级口径）。
- 冲毁清单（流动水/岩浆都会洗掉，掉为物品）：植物（树除外）、雪、火把、地毯、红石粉及
  部分红石元件、蜘蛛网、末地烛、头颅、花盆 [S1 § Spreading]；岩浆冲毁时不掉落战利品
  [S2 § Flow]；甘蔗能挡住岩浆（但水源被岩浆毁掉后甘蔗自毁）[S2 § Flow]。

### 3.4 传播算法伪代码（综合 wiki §Spread 与反编译结构 [S3][S13]）

```
常量: DROP_OFF(水1/主世界岩浆2/下界岩浆1)  TICK_DELAY(水5/岩浆30·下界10)
      MAX_EMPTY(水7/主世界岩浆6/下界岩浆7)  SLOPE_STEPS(水4/主世界岩浆2/下界岩浆4)

tick(pos):                                # 计划刻到期执行
  if pos 不是源:
    new = recalcLevel(pos)                # 从四邻+上方重算本格水位
    if new 为空: 置空气; return           # 断供消退（不再排程）
    if new ≠ 当前: 写入 new; schedule(pos, TICK_DELAY)
  # —— 传播（源与流动块都做）——
  if 下方可被本流体替换:
    flow(下方, 下落态 amount=8)            # depth 归 0
    if 水平相邻源数 ≥ 3: sides(pos)        # 湖泊级块才同刻侧铺 [S13]
  else:
    sides(pos)                            # 含下方被自己下落水占据的情况

sides(pos):
  dir = slopeDirection(pos)
  for d in (dir ≠ 无 ? {dir} : 四个水平方向):     # 找到洞就只朝洞流
    if 本格 depth + DROP_OFF ≤ MAX_EMPTY:
      flow(邻格[d], amount = 8 − (本格depth + DROP_OFF))

slopeDirection(pos):
  for d in 四方向: w[d] = 1000
  for d in 可流入的四方向:
    w[d] = slopeDistance(邻格[d], SLOPE_STEPS)
  return { 权重 = min(w) 的方向集合 }              # 可并列

slopeDistance(p, 剩余步数):
  if p 下方是洞(可流入/可冲毁): return 1           # isHole [S13]
  if 剩余步数 = 0: return 1000
  return 1 + min(不回头的三方向 slopeDistance)      # 递归 BFS

flow(target, 新状态):                      # spreadTo
  if target 是会被冲毁的非固体: 掉落物化
  写入流体状态; schedule(target, TICK_DELAY)       # 新块入列继续传播
```

> 注：`flow` 触达水岩异流体时走 §5 混合规则而非普通写入 [S3 § Spread 步骤 5]。

---

## 4. 源的再生（无限水）

JE 权威口径（两条规则）[S1 § Source blocks][S3 § Self generation]：

1. **主流体规则**：某可流入格（含空气）或可 waterlogged 格，**水平方向 ≥2 个水源邻居**且
   **下方是液体不可流入的块**（实心或源）→ 该格成源。哪怕两侧源藏在 waterlogged 块里也
   算（除非该面不透水）。
2. **垂直规则**：流动块水平贴 1 个源 + 正上方也是源 → 成源 [S1 § Source blocks]。

- 由规则可得 2×2 / 3×1 / L 形取水器（wiki 配图）[S1 § Source blocks]。
- JE 可用 gamerule 关闭：`waterSourceConversion`（默认 true）/ `lavaSourceConversion`
  （默认 **false**）——岩浆默认**不**再生 [S3 § Self generation]。`lavaSourceConversion`
  1.19.3（22w44a）加入；历史上 Beta 1.9 Pre-5 曾可做无限岩浆，之后移除 [S2 § History]。
- 岩浆的可再生路径不是成源而是**滴水石+炼药锅**：岩浆源下方钟乳石每个随机刻有 15/256
  （≈5.9%）几率灌满 10 格内的空锅 [S2 § Renewability]。
- BE 差异：斜对角上下错位的两源也能成新源；先造 flowing 块、**5 ticks 后**才转为源；只有
  能容纳流动水的 waterlogged 块才能成源 [S3 § Self generation]。

---

## 5. 水岩交互（混合规则表）

Fluid § Mixing 的确切规则 [S3]（Water/Lava 页同口径 [S1 §Water and lava][S2]）：

| # | 场景 | 结果 |
|---|---|---|
| 1 | **流动岩浆**接触水块（源或流动，任意方向**除从正上向下**） | 岩浆 → **圆石** |
| 2 | 岩浆**从上方流入**水块 | 水 → **石头**（因规则 1，只可能发生在从上流入） |
| 3 | 水（源或流动）接触**岩浆源**（顶面或侧面） | 岩浆源 → **黑曜石** |
| 4 | 岩浆上方贴灵魂土 + 邻蓝冰 | 岩浆 → 玄武岩 |
| 5 | 水接触蓝冰 | 水 → 脆冰（26.4 起的新规则，Fourth Drop 2026） |

- 伴随音效：混合时 `block.lava.extinguish`（嘶嘶声）[S2 § Sounds]。
- Waterlogged 块与岩浆也能产出圆石/黑曜石，但岩浆不能把 waterlogged 块变石头 [S6 § Properties]。
- 任何方块都放不进岩浆源格（没有"岩浆 logged"）[S3 § Properties]。
- BE 历史注脚：v0.8.0 build 5 起"岩浆落到水上铺开成石头"与 JE 对齐 [S2 § History BE]。

---

## 6. 刻调度（scheduled tick）

- 1 game tick = 1/20 s（50 ms）[S4 § Game tick]。
- 液体走**计划刻（scheduled tick）**："water schedules a tick when it needs to flow" [S4]。
  JE 计划刻分两类：**block ticks 先**（按优先级+排程序），**fluid ticks 后**（无优先级、
  纯按排程序）[S4 § Scheduled tick]。
- 排程上限：JE 每 game tick 65,536 条；BE **每 chunk 每 game tick 100 条** [S4]。
- 游戏循环次序（JE）：维度内先计划刻（block→fluid）、区块随机刻（含冰雪冻结）、后实体，
  即流体更新在随机刻与实体物理之前 [S4 § Game process]。
- **刻率**：水 5 ticks；岩浆主世界 30 / 下界 10 [S1][S2][S3]（反编译 `getTickDelay`
  同口径 [S14]）。BE 实测口径：水 5 / 岩浆 30——与 JE 相同 [S12]。
- **触发面（update cascade）** [S3 § Block updates]：
  - BE 三种：有方块放进本格 / 邻格开始流入 / 既有的流入停止。
  - JE：post-placement 更新只在**来自同流体**时影响流体源（含 waterlogged）；neighbor-changed
    更新影响除 waterlogged 外的全部流体。
  - **世界生成的结构不会触发邻接流体的方块更新**——挖开水墙不动它就一直静止；结构内部
    生成的流体若未完全封闭则会立即流动 [S3 § Block updates]。
- BE 特性/漏洞：计划刻延迟**不被后续更新重置**且可**堆叠**（对液体反复更新可实现
  2.5× 速刷石机）——官方漏洞单 MCPE-21038 承认并讨论是否修复（截至该单仍为游戏行为）
  [S12]。
- BE 流体还响应**随机刻**（v0.11.0 build 14 起"Fluids once [again] attempt to spread upon
  receiving a random tick"）[S3 § History BE]；JE 流体不参与随机刻 [S4]。

---

## 7. 实体物理

### 7.1 水

- **游速**（JE 实测口径，wiki Swimming）[S8]：静水面游泳 2.20 格/秒；半没水 1.97；
  顺流 1.81；逆流 0.39。冲刺游（sprint-swim，1.13 加入）≈3.918 m/s（比步行 4.317 慢 10%）；
  Depth Strider III 达 5.305 m/s。游泳姿态高 1 格、可钻 1×1 洞 [S8]。
- 非游泳状态**缓慢下沉**；跳跃键上浮、潜行键加速下潜 [S1 § Swimming]。水中移动效率属性
  （Depth Strider 每 1/3 档）同时**减小站立时被水流推动的速度** [S1 § Water movement
  efficiency]。
- **水流推力**：有 current 的水块以 ≈**1.39 m/s**（18 秒 25 格）推动玩家与生物；创造飞行
  不被推 [S1 § Current]。current 方向 = 本格对四邻的流入/流出**向量合成**，共 16 个水平
  方向；源块通常无横向 current，除非隔着的不是 motion-blocking 块（玻璃挡、梯子不挡）
  [S1 § Current]。掉落物浮在水面并被水流携带（水流运物是原版物流）[S3 § Properties]。
- **溺水**：气泡条 15 秒（300 ticks），耗尽后每秒 **2 伤害**直至死亡/露头/进气泡柱；水生
  生物、亡灵、铁傀儡无气泡条 [S1 § Drowning]。僵尸溺水会转化成溺尸、尸壳先变僵尸 [S1]。
- 判定口径：wiki 对挖掘惩罚用"**head underwater**"（头部没水）表述 [S1 § Submerged mining
  speed]；swim mode 要求"completely submerged" [S1 § Swimming]。
- **水下挖掘**：头没水时挖掘耗时 ×5（站地面）/ ×25（悬空）；Aqua Affinity 头盔消除悬空
  惩罚 [S1]。
- **摔伤**：任意深度水完全免摔伤 [S1 § Swimming]。水熄灭实体着火 [S2 § Burning]。
- 感官：水下视野按生物群系染色雾 + FOV −10（refraction 模拟）[S1 § Fog][S1 § Trivia]；
  Levitation 效果碰水即失效（MC-83369）[S1 § Trivia]。水会关闭滑翔翼（BE 的岩浆不关）
  [S2 § Trivia]。
- 接触伤害：水伤害末影人/雪傀儡/炽足兽/烈焰人（每半秒 1）；蜜蜂浸水 >20 ticks 起同样受伤；
  末影人/潜影贝碰水传送逃走 [S1 § Direct contact]。

### 7.2 岩浆

- **接触伤害**：多数实体每 tick 4 伤害（伤害免疫使实际每 0.5 秒结算一次），并点燃
  （`remainingFireTicks` = 300 = 15 秒，离开后燃尽）[S2 § Burning]。无甲玩家 2.5 秒死亡
  （JE/BE 铁甲 5.5/6.5 秒等对照表）[S2]。
- **运动**：水平速度 −50%、垂直速度 −20%；不能冲刺游 [S2 § Other]。每 tick 摔距减半
  （相当于大幅吸收摔伤）[S2 § Other]。
- **掉落物**落入岩浆立即销毁（下界合金系除外）[S2 § Other]。
- 视野：岩浆内浓雾（Fire Resistance 略缓解；旁观模式可透视）[S2 § Burning]。
- **岩浆也推实体**（JE 1.16 20w09a 起；BE 一度移除又在 1.17.20.22 恢复，MCPE-75124）
  [S2 § History]。
- 岩浆不可溺水，但 BE 中可窒息（MCPE-17073）[S2 § Trivia]。

---

## 8. 渲染

### 8.1 网格化与高度

- 顶面高度随水位变化：h = amount/9（源 0.889 … 弱流 0.111），上方有水渲染整格 1.0
  [S1 § Height]。各水平距离档的**观测高度区间表**（含邻居平滑效应）：水 1 格距 → 1；
  2 格距 → 0.75–1；… 7 格距 → 0.125–0.25 [S1 § Flow arrangement tables]；主世界岩浆与
  下界岩浆另有对应表 [S2]。BE 的水位 0 "不一定填满方块——取决于每个上角相邻上方的流体"
  [S1 § Block states BE]，即侧面暴露由相邻上方角落决定。
- 封闭源渲染 still、开放流体渲染带流向动画线 [S3 § Properties]；流向渲染部分基于 level
  值 [S3 § Level]。
- 水的透渲：与冰/传送门互相可见（13w41a 起）[S5 § History]；"从内看与从外看到的是外平面
  的相反面——仅顶面与四个侧面，底面从上方永不可见"（MC-202578 WAI、MC-190053）[S1 §
  Appearance]。本仓现状 `B_WATER` 走 glass 透明通道，概念上同路。

### 8.2 纹理与动画（Mojang bedrock-samples 官方证据）

resource_pack/textures/flipbook_textures.json（逐帧翻页动画声明）[S9]：

| 纹理 | atlas tile | 帧率 |
|---|---|---|
| `water_still_grey` | still_water_grey | ticks_per_frame **2**（默认 32 帧） |
| `water_flow_grey` | flowing_water_grey | replicate **2** |
| `cauldron_water` | cauldron_water | ticks_per_frame 2 |
| `lava_still` | still_lava | ticks_per_frame **16** |
| `lava_flow` | flowing_lava | ticks_per_frame **10** + replicate 2 |

blocks.json（方块→纹理面映射）[S10]：`water`/`flowing_water` = 顶/底 `still_water_grey`、
侧面 `flowing_water_grey`；`lava` = 顶/底 `still_lava`、侧面 `flowing_lava`（且
`isotropic: true`）。**顶面用静水纹理、侧面用流动纹理**——即 JE 的"顶面 UV 流动方向"
在 BE 的对应实现是分面纹理。

- BE 水纹理是**灰度图**（`*_grey`），运行时按生物群系染色（BE 水色表按生物群系列出表面色/
  雾色/雾距/透明度四元组）[S1 § Appearance BE]；JE 默认水色 #3F76E4、沼泽 #617B64 等表
  [S1 § Appearance JE]。
- BE 新图形管线（Vibrant Visuals）：水面全反射/焦散/体积雾（生物群系色不可见）[S1 §
  Vibrant Visuals]。
- 下落水柱渲染为整格（§2.3）[S1 § Height]。
- 液体穿层滴落粒子（下方实心+上方液体 → 底面滴水/滴岩浆粒子，仅提示不造成伤害）[S3 §
  Dripping][S2 § Other]。

---

## 9. 桶与物品交互

- **只舀源**：桶对着源块使用才能收水/岩浆（岩浆也可从满岩浆锅舀）；对流动块使用无效
  [S2 § Obtaining][S7 § Usage]。满桶放置 = 在目标格放**一个源**并立即触发传播 [S7]。
- 玻璃瓶从水源装水**不移除源** [S3 § Properties][S7]。
- 发射器：装满桶的发射器在前方空格放源；空桶发射器吸走正前方源 [S1 § Source blocks][S7]。
- 湿海绵在熔炉烘干时，燃料槽的空桶会被产出水填满 [S7]。
- 下界例外：水桶在下界放水即刻蒸发（炼药锅里的水可以存在）[S1 § Natural generation]。
- **海绵**（简述）：干海绵接触水变湿海绵，吸收 **taxicab 距离 7** 内的水（源或流动），
  上限 **65 块**、最近的先吸；吸收只沿水→水传播、不跳过非水块；waterlogged 块的水不吸；
  被吸区域内的海带/睡莲毁掉掉落、海草毁掉不掉落；区域外的水重新流入时湿海绵不再吸
  （wiki 另有"吸收 3–5 格内所有水"的粗略表述，两段口径有张力，精确段为准）[S1 § Sponges]。

---

## 10. 世界生成

- **海平面**：主世界海洋/河流水位在 **layer 62**；含水层系统使洞穴/峡谷的水位随地势变化
  [S1 § Natural generation]。下界岩浆海 y≈32（可下探至 19–22）[S2 § Natural generation]。
- **放的是源，不是流动**：岩浆湖（含底部 10 层的"flood lava"）**全部由源块组成**；泉/
  瀑布来自单个源块 [S2 § Flow]。BE 口径：泉生成为 flowing、海洋与河流生成为 stationary，
  且大部分时间流体保持 stationary（收到方块更新才瞬时变 flowing 算完再变回）[S1][S2 §
  Data values]。
- **结构不触发更新**：世界生成的结构不会让邻接流体开始流动（水墙静止的根源）；结构内部
  生成的流体若不封闭则立即流动（海底裂开入峡谷会流）[S3 § Block updates]。
- 岩浆生成面：洞穴/峡谷 Y=−55~−63 的空气被岩浆替换；Y=0 以上任意群系可出小岩浆湖；下界
  还有隐蔽岩浆袋 [S2 § Natural generation]。
- 水还会生成在村庄/沙漠井/要塞/林地府邸/远古城市/海底神庙等结构中 [S1]。

---

## 11. 基岩版差异总表

| 维度 | Java | Bedrock | 来源 |
|---|---|---|---|
| 方块 id | 单 id + level 状态（1.13 大扁平后） | 双 id：water(8)/flowing_water(9)、lava(11)/flowing_lava(10)；平时 stationary、更新时瞬时 flowing | [S1][S2 § ID] |
| 下落水位编码 | level 恒 8（9–15 仅命令） | 8 + 上方 level（9–15 正常存在，>15 折回 8） | [S3 § Level] |
| 源再生 | ≥2 水平源 + 下托；垂直规则 | 额外：斜对角两源也行；先造 flowing 5 ticks 后转源；限可含流水的 waterloggable | [S3 § Self generation] |
| 刻率 | 水 5 / 岩浆 30（下界 10） | 相同（水 5 / 岩浆 30）；但**延迟不重置、可堆叠**（MCPE-21038） | [S1][S2][S12] |
| 排程上限 | 65,536/游戏刻（全局） | 100/游戏刻/**chunk** | [S4] |
| 更新触发 | post-placement（仅同流体）+ neighbor-changed（除 waterlogged） | 仅三种：占位、流入、断流；流体还吃随机刻（v0.11.0 b14 起） | [S3] |
| waterlogging | `waterlogged` 方块状态 | layers 系统（任意方块理论上可含源）；不能用非整块排开水造气室，只能替换**流动**水 | [S6 § Properties] |
| 红石遇水 | 流水冲毁红石粉/中继器/比较器（掉落） | 红石粉仍被冲毁；**中继器/比较器不被流水毁**（waterloggable: BE Yes） | [S15][S16] |
| 光照 | 水不额外减方块光、只漫射天光 | 每格水额外 −1 光 | [S1 § Light] |
| 岩浆推实体 | 1.16 起 | 曾移除（beta 1.16.0.59）后恢复（1.17.20.22，MCPE-75124） | [S2 § History] |
| 渲染 | 生物群系染色水+雾；still/flow 分面 | 灰度纹理运行时染色；still/flow 分面（bedrock-samples 证据）；Vibrant Visuals 反射/焦散 | [S9][S10][S1] |
| 溺水于岩浆 | 不可 | 不可溺水、但可**窒息**（MCPE-17073） | [S2 § Trivia] |
| 滑翔翼 | 水与岩浆都关闭 elytra | 岩浆不关闭 elytra | [S2 § Trivia] |

---

## 12. 伴生状态机制清单总表（§1.12 用）

移植液体机制时必须连伴生机制一起清点。下表逐条列出 MC 中"有液体参与"的状态机制，
宁多勿漏；每条给 MC 行为与参数，供设计稿逐条拍板移植/不移植并登记附录 B。

| # | 机制 | MC 行为与参数 | 来源 |
|---|---|---|---|
| 1 | 挖掘触发流动 | 破坏邻接方块 → 方块更新 → 液体排程流动（JE：neighbor-changed 生效） | [S3] |
| 2 | 放置阻挡 | 固体放进源格=替换源；放进流动格=阻断/改向该方向流动 | [S3] |
| 3 | 冲毁非固体 | 植物（树除外）/雪/火把/地毯/红石粉等被流水冲掉为物品（岩浆冲毁不掉落） | [S1][S2] |
| 4 | 水灭火 | 流动水接触火块即熄灭；水也熄灭着火实体 | [S1][S2] |
| 5 | 源再生/无限水 | §4 两规则 + gamerule 双开关 | [S1][S3] |
| 6 | 断供消退 | 源被舀走/挡住后流动块逐刻消退（1.6.1 起岩浆不再滞留） | [S3][S2 § History] |
| 7 | 水岩混合 | §5 规则表（圆石/石头/黑曜石/玄武岩/脆冰） | [S3] |
| 8 | 冰冻 | 雪原系生物群系 + 头顶露天 + 水块内方块光 <10 + ≥1 水平非水邻块 → 源冻成冰（区块刻驱动、受 randomTickSpeed 影响、需玩家在附近） | [S5 § Snowy biomes] |
| 9 | 冰融 | 邻面方块光 >11 即融回源（天光不计，太阳晒不化）；下界不产水 | [S5][S1 § Post-generation] |
| 10 | 破冰成水 | 冰被挖掉：下方有阻挡移动的块或任意流体 → 变水源；否则消失。精准采集得冰 | [S5 § Breaking/Creating water] |
| 11 | 农田灌溉 | 水平 4 格内的耕地被浇灌：作物加速+不退化 | [S1 § Irrigation] |
| 12 | 甘蔗需水 | 甘蔗只能种在水旁；水没了甘蔗自毁。甘蔗挡岩浆 | [S1 § Irrigation][S2 § Flow] |
| 13 | 水生植物依水 | 睡莲只能放在源上；海带/海草只存在于源中；珊瑚需接触水存活 | [S1 § Irrigation] |
| 14 | 混凝土粉固化 | 水接触混凝土粉 → 固化为混凝土 | [S1 § Hardening] |
| 15 | 水下挖掘减速 | 头没水 ×5（离地 ×25），Aqua Affinity 消除 | [S1] |
| 16 | 溺水转化 | 僵尸溺水→溺尸、尸壳→僵尸（摇晃转化动画） | [S1 § Drowning] |
| 17 | 吸水伤害 | 末影人/雪傀儡/炽足兽/烈焰人每 0.5 s 1 伤害；蜜蜂 >20 ticks 起；末影人/潜影贝传送逃水 | [S1 § Direct contact] |
| 18 | 掉落物浮运 | 物品浮于水面被水流携带（水流物流）；岩浆中立即销毁（下界合金除外）；运输中照常消失计时 | [S3][S2] |
| 19 | 摔伤重置 | 落入任意深度的水免摔伤；岩浆每 tick 摔距减半 | [S1][S2] |
| 20 | 推动实体 | 水流 ≈1.39 m/s（向量合成 16 方向）；岩浆 1.16 起也推 | [S1 § Current][S2] |
| 21 | 爆炸吸收 | 水 blast resistance 100：吸收普通爆炸（水下 TNT 例外） | [S1 § Explosions] |
| 22 | 光照衰减 | BE 每格水 −1 光；JE 漫射天光随深度衰减 | [S1 § Light] |
| 23 | 海绵吸水 | taxicab 7、≤65 块、近者先吸、只沿水传播 | [S1 § Sponges] |
| 24 | 滴水石集水/集浆 | 钟乳石上方有源时随机刻滴水，可灌满 10 格内炼药锅（岩浆 15/256/刻）；锅=桶的中转站 | [S2 § Renewability] |
| 25 | 气泡柱 | 水下 magma block=下拽、soul sand=上浮的垂直运输 | [S1 § Vertical transport] |
| 26 | waterlogging | 非整块可与源共存一格；活塞推走通常去水；waterlogged 块不可燃/防爆/免疫冻结/可与岩浆成圆石黑曜石 | [S6] |
| 27 | 红石反应 | 流水冲毁红石粉（JE 还毁中继器/比较器，BE 不毁）；waterlogged 的导能块（如红树根）继续导电；比较器可读炼药锅水量 | [S15][S16][S17] |
| 28 | 依附块脱落（水冲） | 火把/红石粉/压力板等依附块被水流入 → 弹出掉落（与"支撑移除"同一族） | [S16 § Breaking][S1 § Spreading] |
| 29 | 下界蒸发 | 主世界水桶进下界立即消失（锅/命令例外）；冰在下界不产水 | [S1][S5] |
| 30 | 感官状态 | 水下 FOV −10、生物群系雾色、岩浆浓雾、水下叠加旧水纹；Levitation 碰水失效 | [S1 § Fog/Trivia][S2] |
| 31 | 滑翔翼关闭 | 水关闭 elytra（BE 岩浆不关） | [S2 § Trivia] |
| 32 | 游泳姿态/冲刺游 | 完全没水时可切换 1 格高游泳姿态、可钻 1×1；冲刺游消耗饥饿 | [S8] |

---

## 13. 对本仓移植的初步可行性注记（客观注记，不做决策）

### 13.1 参数表驱动可直接抄的部分

MISSION 锁定"参数表驱动"风格，MC 液体的核心恰好是一张小参数表 + 一组规则表：

- **流体参数表**（§3.1 一行一种流体：dropOff/maxEmpty/tickDelay/slopeSteps/flowRange/
  渲染高度公式 amount/9）——纯数据。
- **混合规则表**（§5 五行）、**源再生规则**（§4 两条布尔判据）、**冲毁旗标**（§12#3，
  可挂 config BLOCKS 旗标如 `wash:true`，与 fell/need/thin 同构）。
- **实体数值**（推力 1.39 m/s、气泡 15 s、溺水 2 伤害/秒、岩浆 4 伤害/0.5 s、速度乘数
  −50%/−20%、挖掘 ×5/×25）——数值表直接进 config。

### 13.2 需要体素引擎引入的新概念（现状没有的）

1. **每格水位**：`Uint8Array` 每格只存 id（"世界无方块元数据"是已登记约束，
   block-lifecycle-research §5）。水位是液体的一等状态——要么扩 id 段（水×9 个 id 编码
   0–8），要么加一层并行的水位平面。这是最大的结构决策，26.4 官方模型（level 1–8 +
   source 布尔，§2.6）给出了最小状态形态的参照。
2. **计划刻调度器**：引擎目前没有时间维度的方块更新（树叶衰减即时结算、树苗生长在模式层
   Map）。液体传播天然逐刻异步；本仓确定性重放红线要求队列按**排程序**而非墙钟推进（MC
   的 fluid tick 恰好就是"纯按排程序"[S4]，语义可直接照抄）。儿童即时反馈哲学与 5 ticks
   （0.25 s）的传播节奏基本兼容（MC 自己就是这个速率）。
3. **编辑事件挂点**：液体对邻居变化的反应已可挂 world.js 的 editBlock/editBlockDirty
   两个收敛入口（block-lifecycle-research §1 已核实全部破坏路径收敛于此）——与方块级联
   同一挂点，无需逐模式改造。
4. **渲染高度可变的流体网格**：mesh-core 目前每格整格几何。需要"顶面 y 偏移 + 部分高度
   侧面 + 相邻水位平滑"的流体通道；透渲底座现成（B_WATER 已走 glass 通道）。动画面
   （UV 滚动/帧动画）在本仓是全新概念（贴图图集目前是静态的）；顶面 still/侧面 flowing
   的分面（bedrock-samples 口径）是最省的动画切入点。
5. **玩家物理的水内分支**：voxel.js 玩家段目前无浮力/阻力/推力概念；需在 physics 内加
   "接触流体 → 换运动参数 + 外推力"分支，属新增而非改造。
6. **水面高度≠1 的碰撞语义**：水位 0.1–0.9 的格子"算不算挡路/怎么走进去"MC 用
   motion-blocking 与碰撞盒分层（梯子不挡水、玻璃挡），本仓 solid:false 旗标只有二值，
   需要类似"对流体可流入性"的判据面。

### 13.3 与本仓约束的张力点（只登记，不裁）

- 溺水扣血/岩浆伤害与"零惩罚"反馈哲学（MISSION）——气泡条本身是好的注意力反馈素材，
  伤害结算是否保留留给设计稿。
- 流动传播的**逐刻异步**与"世界重进逐块复现"的确定性——排程序驱动的队列可满足，但需要
  专门的不变量测试（§1.12 执行者 test/world-integrity.test.js）。
- 探险湖/建造池塘现有静态水面 = MC 的"结构不触发更新"形态（§10），与流动系统天然兼容：
  静止源块本就是 MC 的稳定态，不需要为兼容旧场景改数据。

---

## 14. 来源清单

| # | 来源 | 类型 | URL | 支撑段落 |
|---|---|---|---|---|
| S1 | Minecraft Wiki — Water | Wiki（社区对反编译源码的整理） | https://minecraft.wiki/w/Water | §1 §2 §3 §4 §6 §7 §8 §9 §10 §11 §12 |
| S2 | Minecraft Wiki — Lava | Wiki | https://minecraft.wiki/w/Lava | §1 §2 §3 §5 §6 §7 §10 §11 §12 |
| S3 | Minecraft Wiki — Fluid | Wiki | https://minecraft.wiki/w/Fluid | §2 §3 §4 §5 §6 §9 §10 §11 §12 |
| S4 | Minecraft Wiki — Tick | Wiki | https://minecraft.wiki/w/Tick | §6 |
| S5 | Minecraft Wiki — Ice | Wiki | https://minecraft.wiki/w/Ice | §8 §12#8–10 |
| S6 | Minecraft Wiki — Waterlogging | Wiki | https://minecraft.wiki/w/Waterlogging | §11 §12#26 |
| S7 | Minecraft Wiki — Bucket | Wiki | https://minecraft.wiki/w/Bucket | §9 |
| S8 | Minecraft Wiki — Swimming | Wiki | https://minecraft.wiki/w/Swimming | §7.1 §12#32 |
| S9 | Mojang bedrock-samples（GitHub 官方样例仓）— resource_pack/textures/flipbook_textures.json | **Mojang 官方第一手** | https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/flipbook_textures.json | §8.2 §11 |
| S10 | Mojang bedrock-samples — resource_pack/blocks.json | **Mojang 官方第一手** | https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/blocks.json | §8.2 §11 |
| S11 | minecraft.net — Minecraft 26.4 Snapshot 4 官方 changelog | **Mojang 官方第一手** | https://www.minecraft.net/en-us/article/minecraft-26-4-snapshot-4 | §2.6 §5 |
| S12 | mojira.dev — MCPE-21038（基岩版液体刻率/更新堆叠） | **Mojang 官方漏洞单** | https://mojira.dev/MCPE-21038 | §6 §11 |
| S13 | PaperMC 反编译补丁 FlowingFluid.java / FluidState.java（SteamWar 镜像） | 反编译源码公开镜像 | https://git.steamwar.de/SteamWar/Paper/commit/4707f46b253b02767f2796c884507a203624fc9e.patch | §2.3 §3.3 §3.4 |
| S14 | NeoForge 1.21.1 Javadoc — FlowingFluid（社区镜像） | 反编译 API 文档 | https://lexxie.dev/neoforge/1.21.1/net/minecraft/world/level/material/FlowingFluid.html | §3.2 §3.4 §6 |
| S15 | Minecraft Wiki — Redstone Repeater | Wiki | https://minecraft.wiki/w/Redstone_Repeater | §11 §12#27 |
| S16 | Minecraft Wiki — Redstone Dust | Wiki | https://minecraft.wiki/w/Redstone_Dust | §12#27–28 |
| S17 | Minecraft Wiki — Conductivity | Wiki | https://minecraft.wiki/w/Conductivity | §12#27 |

**抓取方式**：minecraft.wiki 经 `?action=raw` 取 wikitext 全文核对（2026-10-25）；
bedrock-samples（S9=纹理帧率声明 flipbook_textures.json，S10=方块→纹理面映射 blocks.json）
经 raw.githubusercontent 直取 JSON；S11 为 minecraft.net 官方 changelog 原文。

**未能获取/存疑的来源（如实说明）**：

- **Bedrock 下界岩浆 10 ticks 口径**：wiki 流速表 [S3] 未分版别，MCPE-21038 [S12] 只实测
  主世界（水 5/岩浆 30）；下界 10 ticks 在 BE 未单独一手验证，引用时按 wiki 通用表。
- **`sourceNeighborCount ≥ 3` 是否计入自身**：PaperMC 补丁 [S13] 只给出调用点与阈值，方法
  体计数口径未在本次抓取的公开片段中完整出现；§3.4 按"水平相邻源数"表述并标注代码级推定。
- **海绵"3–5 格"与"taxicab 7"两段 wiki 原文**内部张力：§9 已并列标注，以精确段为准。
