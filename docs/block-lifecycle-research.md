# 方块生命周期伴生机制 · 调研稿

> 起因（2026-10-23 用户报告）：「我砍树，卡了一节，树上面包含叶子还悬浮在空中」。
> 根因结论（代码侧全链路静态审读 + 机制核对）：**不是引擎 bug，是"半截移植"**——挖掘链忠实
> 移植了 MC 的逐块破坏与掉落，但 MC 让砍树结果"看起来正常"的**伴生状态机制**（树叶衰减等）
> 从未移植。全代码库无任何倒树/衰减/支撑脱落机制；同类未爆雷：挖掉火把/树苗/草丛的支撑块，
> 它们同样悬空（放置侧规则 `advPlaceCheck` 存在，破坏侧完全缺失）。
> 用户拍板（2026-10-23）：① 整树砍倒 + 通用支撑机制；② **放引擎层全模式生效**；③ 白名单按
> **身份原则**——「机制跟着'它是什么'走，不跟着'它在哪'走」：是树就该倒（哪怕是孩子自己搭的、
> 哪怕长在洞里），是石头/泥土就永远不塌（地下安全是身份的推论，不是位置豁免）。
> 本文为 docs 三段式的 research 段，供 `block-lifecycle-design.md` 引用（下文「设计稿 §n」）。

---

## 1. MC 的引擎底座：方块更新传播

MC 不是给每种方块写一套特殊逻辑，而是有一个统一的引擎概念：**方块更新（block update /
neighbor changed）**——任何方块被放置/破坏/改变时，引擎通知其邻居，邻居按自己的规则反应
（火把检查支撑、沙子检查下方、树叶更新与原木的距离状态）。时间维度的变化则走**计划刻与
随机刻**（scheduled tick / random tick）：树叶衰减、树苗生长都是随机刻驱动。

对本项目的映射结论：

- 「邻居通知」这一层对应我们的**编辑事件**：全部破坏路径已收敛在 world.js 的
  `editBlock` / `editBlockDirty` 两个入口（挖掘/TNT/建造/竞技场/坦克炮击已逐一核实），
  级联机制挂此即可全模式生效，无需逐模式改造。
- 「随机刻」这一层**不移植**：本游戏世界重进要确定性逐块复现（只存差异，物品与合成设计稿
  §11），且儿童即时反馈哲学（MISSION）不允许"等 30 秒才消失"。伴生效果改为**编辑后即时结算**。

## 2. 机制逐条查证（MC 一手口径）

### 2.1 树叶衰减（leaf decay）——本次 bug 的直接缺口

来源：[Leaves § Usage – Minecraft Wiki](https://minecraft.wiki/w/Leaves)（2026-10-23 抓取原文）：

> "Leaves from trees spontaneously decay (disappear) when they receive a **block tick** if they
> are **not connected to any log or wood blocks**, stripped or otherwise, either **directly or via
> other leaf blocks**, with a maximum distance of **6 blocks [JE only] or 4 blocks [BE only]**.
> The distance is **taxicab distance, but can cross corners**. **Leaves placed by players never
> decay.**"
>
> "Leaves that decay have the **same drop chances as when broken by players**."

要点提炼：

| 维度 | MC 口径 |
|---|---|
| 触发 | 随机刻（时序异步、非确定延迟） |
| 存活判据 | 经叶链连通到原木/木块（可直接相邻或经其它树叶），taxicab 距离 JE ≤6 / BE ≤4 |
| 玩家例外 | 玩家放置的树叶永不衰减 |
| 掉落 | 衰减掉落率与玩家破坏完全一致（树苗 5% / 木棍 2% / 苹果 0.5%，本项目已在 D7 儿童加倍为 12%/8%/4%） |
| 即时侧 | JE 里树叶的"距离状态"在邻近原木变化的 **1 game tick 内**即更新（红石章节口径）——衰减反应本身是即时的，只是结算等随机刻 |

补充（红石章节原文）："The state of a leaves block … changes after 1 game tick when the distance
to the nearest log or wood block changes"——支持我们把判据改成事件驱动即时结算，这是 MC 自己
的语义，不是我们发明。

### 2.2 依附方块脱落（attachment pop）——同类未爆雷

本项目放置侧已有规则（`advPlaceCheck`：thin 块只准放实心面顶）；MC 破坏侧的对称规则是：
支撑块被移除/被活塞推走时，依附其上的方块（火把/花草/铁轨等）破碎为掉落物。来源：
[Torch – Minecraft Wiki](https://minecraft.wiki/w/Torch)（依附方块 attached block 族通行行为）
与 `docs/minecraft-mechanism-research.md` §3（「红石粉、火把、压力板等'依附型方块'被推会
破碎成掉落物」——同一依附概念的活塞侧表现）。

现状缺口：挖掉火把/树苗/草丛/麦脚下的方块，它们悬空（代码审读确认：`advBreakBlock` 与
`editBlock` 均无邻居处理）。麦/草丛出现在探险地表与（二期）农田链，火把/树苗是玩家高频
放置物——这是与"砍树悬空"完全同类的世界完整性缺口。

### 2.3 重力方块（falling blocks）——沙子/沙砾

来源：`docs/minecraft-mechanism-research.md` §4.3（已查证入库）：沙/沙砾/混凝土粉末失去
支撑时化为下落实体，落在第一个支撑面上；下落 600 刻未落地即删除。

本项目相关性：探险湖畔有沙滩（`advBuildWorld` 沙层），建造模式沙子在调色板中。挖沙底悬空
沙柱与"砍树悬空"同观感。但下落是**移动语义**（非移除），且理想形态需要下落动画——工程量
与观感打磨都大于移除型级联，列入二期（设计稿 §分期）。

### 2.4 生长（growth）——已有实现，维持现状

树苗 20s 长成树已落地（模式层计时 Map，`ADV_SAP_GROW`）。物品与合成设计稿 §35 拍板过
「树苗计时用模式层 Map，不进体素数据」（世界无方块元数据约束）。**本调研不推翻该决策**：
生长是时间驱动而非编辑驱动，与"编辑后即时级联"是两个引擎概念；把计时升进引擎没有第二个
消费者（§1.10 升格判据不过），维持模式层。

### 2.5 水流（water flow）——明确不移植

探险湖是静态水面方块（`B_WATER`，`solid:false`）。MC 水流是七个方向扩散+消融的流体模拟，
复杂度高且对 6 岁受众收益存疑（挖开湖岸看水墙反而是 MC 老玩家才在意的破绽）。登记为
**不做**，理由入设计稿附录 B。

## 3. 本游戏现状盘点

| 伴生机制 | MC | 本游戏现状 | 缺口后果（用户可见） |
|---|---|---|---|
| 树叶衰减 | 随机刻衰减 | **无** | 砍树后整团树叶永久悬空（本次 bug） |
| 依附脱落 | 支撑没了即碎 | **无**（放置侧有规则） | 火把/树苗/草丛悬空 |
| 整树砍倒 | 无（MC 逐块） | **无** | 砍 1 节留 5 节，6 岁孩子逐块砍 ~49 片叶 ≈ 15s 苦工 |
| 重力方块 | 沙下落 | 无 | 沙柱悬空（观感同类） |
| 生长 | 随机刻 | 已有（模式层 20s 计时） | 无缺口 |
| 水流 | 流体扩散 | 静态水面（不移植） | — |
| 破坏链路收敛 | neighbor update | **已收敛**（editBlock/editBlockDirty 两入口，全模式） | 级联挂点现成 |

## 4. 移植裁剪判据（MISSION 对齐）

1. **确定性**：世界重进逐块复现（只存差异）⇒ 级联必须纯函数可重放（同输入同结果），
   随机刻不移植，改编辑后即时结算。
2. **即时反馈**：砍树 → 当帧整树倒 + 掉落雨，不等衰减延迟。
3. **零惩罚**：级联块的掉落走各自默认掉落表（保底必得），不因"不是你亲手挖的"而克扣。
4. **身份原则（用户拍板）**：级联判据只看方块身份旗标（fell/need/thin），代码中不出现
   任何位置/模式/场景条件——地下挖石头不塌是因为石头没有旗标，不是因为"在地下"。
5. **世界无方块元数据**：MC「玩家放置的树叶永不衰减」的例外**无法实现**（Uint8Array 只存
   id，分不清树叶是长的还是放的）——登记为永久偏差（设计稿附录 B）。缓解：本设计的树叶
   检查只在原木被移除时触发，纯装饰叶团只要不挨着被砍的原木就永不被检查。

## 5. 来源清单

- [Leaves – Minecraft Wiki](https://minecraft.wiki/w/Leaves)（§Usage 衰减判据/距离/玩家例外/掉落；§Redstone component 距离状态 1 tick 更新）——2026-10-23 全文抓取核对
- [Torch – Minecraft Wiki](https://minecraft.wiki/w/Torch)（依附方块随支撑移除而破碎）
- `docs/minecraft-mechanism-research.md` §3（依附型方块）、§4.3（重力方块）——既有入库调研
- `docs/minecraft-item-crafting-research.md` §4.2（树叶掉落概率 MC 5%/0.5%/2% 儿童加倍口径）
- `docs/item-crafting-design.md` §D7（树链：掉落表与树苗生长）、§"世界无方块元数据"约束
- 代码侧核实（2026-10-23）：js/world.js 编辑管线、js/modes/{adventure,build,arena}.js 破坏路径、
  js/tank.js:494 注入链、js/config.js thin 族旗标、js/scene-kit.js tree 结构、js/adventure-core.js advMineStep
