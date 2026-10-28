# Minecraft（Java 版）资源恢复 / 生态恢复机制调研报告

> **调研说明**
> - 调研问题：为"被消耗的资源（树/植被=生态、矿石=矿产）缓慢恢复"机制提供设计参考——正典 MC 如何平衡"资源可再生"与"玩家建筑绝对安全"这对矛盾，即：自然生长靠什么保证**永不改写或摧毁玩家建造物**。
> - 所有事实性论断均来自一手来源 **Minecraft Wiki**（[minecraft.wiki](https://minecraft.wiki)，Weird Gloop 托管的官方社区 Wiki）逐页抓取，中文术语对照 [zh.minecraft.wiki](https://zh.minecraft.wiki/w/%E5%88%BB)《刻》页。每条论断后附来源链接；wiki 之外的推论明确标注"**推论**"；第 10 节 mod/插件部分来源等级较低，单独标注。查不到的写"**未证实**"。
> - 版本口径：Wiki 当前反映最新 Java 版（26.x 年份制）。本报告对标 **1.18+ 长期稳定口径**（随机刻、树苗空间需求、草方块规则、矿物分布自 1.18/1.20 起稳定）；新近变化单独标注（1.21.5 随机刻范围扩大、1.21.5+ 钻石经战利品库再生等）。
> - 抓取日期：2026-10-28。本报告只做研究，不涉及任何代码改动。

## 0. 结论先行（TL;DR）

1. **MC 的"恢复"只有两种：方块级自然生长（慢）与经济级生态循环（快）**。方块级=随机刻驱动（草蔓延、树苗成树、作物生长、树叶凋落），平均每个方块 **68.27 秒**才轮到一次（来源：[Tick § Random tick](https://minecraft.wiki/w/Tick)）；经济级=收获重种、动物繁殖、怪物刷新、村民交易——矿**物方块本身永不参与其中**。
2. **"建筑绝对安全"靠三层制度保证，而非靠运气**：①随机刻只对**注册进响应清单的身份方块**生效，石头/木板/建筑方块根本不响应；②每次生长执行前**逐格做可替换性检查**，被实体方块挡住就**拒绝生长**（宁可不长，绝不穿墙）；③**世界没有任何自动地形/矿床再生**——被挖掉的树叶和原木"不会随时间长回"（来源：[Tree § Growth and characteristics](https://minecraft.wiki/w/Tree)）。
3. **矿石是正典里唯一"严格不可再生"的大类**：矿物信息框"可再生=否"（来源：[Ore](https://minecraft.wiki/w/Ore)）；但**加工后的材料**大多走"生态链再生"——铁锭（铁傀儡农场）、金锭（僵尸猪灵）、红石（女巫）、青金石（牧师交易）、煤（凋灵骷髅）全部可再生（来源：[Renewable resource](https://minecraft.wiki/w/Renewable_resource)）。**分界线画在"矿块"与"材料"之间**。
4. **植物是低概率低伤害的"减法"**：树叶凋落掉树苗仅 **5%**（丛林 2.5%）、苹果 **0.5%**；玩家亲手放的树叶**永不凋落**（来源：[Leaves](https://minecraft.wiki/w/Leaves)）——恢复机制不会惩罚玩家。
5. **动物恢复主要靠玩家行为（繁殖）**：主世界动物随地形生成（默认每区块 10% 概率带出一组），生成后**不会自然消失**、也几乎不会自然补员；繁殖有 **5 分钟冷却**，幼崽 **24000 刻（20 分钟）**成年（来源：[Mob spawning](https://minecraft.wiki/w/Mob_spawning)、[Cow § Breeding](https://minecraft.wiki/w/Cow)）。
6. 服务器社区做"矿藏再生"的成熟套路是**位置记录+标记方块+定时回填**，与正典"矿不再生"哲学相反，属于插件层改造（来源等级低，见 §10）。

---

## 1. 随机刻（Random Tick）系统

### 1.1 抽样规则与频率

（来源：[Tick § Chunk tick / § Random tick](https://minecraft.wiki/w/Tick)；中文术语与数值对照：[刻 § 随机刻](https://zh.minecraft.wiki/w/%E5%88%BB)）

- 游戏以 20 刻/秒运行，1 游戏刻（gt）= 0.05 秒（来源：[Tick § Game tick](https://minecraft.wiki/w/Tick)）。
- 每个游戏刻，每个获得区块刻的**子区块**（16×16×16 = **4096** 个方块）随机抽 **`random_tick_speed`（默认 3）**个位置执行"随机刻"；同一位置可被重复抽中；**空气也是候选**；不含任何"可响应随机刻方块"的子区块整个跳过（来源：[Tick § Random tick](https://minecraft.wiki/w/Tick)）。
- 特定方块两次随机刻的间隔：**中位数 47.30 秒**（≈946.03 gt），**平均 68.27 秒**（4096/3 ≈ 1365.33 gt）；间隔 <1 秒的概率 1.38%，>5 分钟的概率 1.23%（来源：[Tick § Random tick](https://minecraft.wiki/w/Tick)）。
- **推论（计算）**：单个方块每刻被抽中的概率 = 3/4096 ≈ **0.0732%**。
- 范围变化：JE 1.21.5（25w06a）起所有完全加载的区块都接收随机刻，不再要求玩家在 8 区块（128 格）以内（来源：[Tick § History](https://minecraft.wiki/w/Tick)、[刻 § 历史](https://zh.minecraft.wiki/w/%E5%88%BB)）。

### 1.2 谁在随机刻集合里（白名单清单）

绝大多数方块**忽略**随机刻（Tick 页原话 "Most blocks ignore this tick"）。会响应的方块（来源：[Tick § Random tick](https://minecraft.wiki/w/Tick) 响应清单；中文对照：[刻 § 随机刻](https://zh.minecraft.wiki/w/%E5%88%BB)）：

- **植物类**：农作物生长/枯萎、树苗成树、蘑菇传播、藤蔓/缠怨藤/垂泪藤/洞穴藤蔓传播、仙人掌/甘蔗/海带/竹子/紫颂花/红树胎生苗/甜浆果丛/可可果/下界疣生长；
- **生态基底类**：草方块与菌丝体**蔓延**；草方块/菌丝体/菌岩**退化**；耕地**湿度更新**；
- **凋落类**：**树叶凋落**；冰/雪融化；
- 其他：熔岩点火、发光红石矿石熄灭、下界传送门方块生成僵尸猪灵、海龟蛋孵化、紫水晶母岩长芽、铜方块氧化、滴水石锥生长/填锅、失水恶魂复水、眼眸花开合等。

**要点：石头、圆石、深板岩、原木（树上的）、木板、玻璃、各类建筑方块不在清单中——它们对随机刻完全惰性**（由 1.1 节"绝大多数方块忽略随机刻"+上述穷举清单推得，清单外方块无任何随机刻行为；**推论**，依据同一来源）。

---

## 2. 树苗生长与树木生成（树=生态资源的恢复入口）

### 2.1 生长条件

（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)、[Tree § Growth and characteristics](https://minecraft.wiki/w/Tree)）

- **种植基底**：各类泥土变体（土径除外）、苔藓块、泥巴（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）。
- **光照**：阶段推进要求**树苗上方方块的光照 ≥9**（不用骨粉时）（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）；成树尝试要求**树苗方块内光照 ≥8**（来源：[Tree § Growth and characteristics](https://minecraft.wiki/w/Tree)，两页口径存在 8/9 的差异，分属两个判定位）；树苗方块内光照 **≤7 会被拔除**，除非能看到天空（玻璃等透明方块也算遮挡豁免）（来源：[Tree](https://minecraft.wiki/w/Tree)）。
- **空间需求**（上方需保留的净空，来自 [Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）：

| 树种 | 1×1 种植 | 2×2 种植 |
| --- | --- | --- |
| 橡树 | 上方 ≥5 格（3×3 柱）；成长空间内有方块（但不正上方）时**强制长成大型变体** | 无（2×2 不长） |
| 白桦 | ≥6 格（3×3 柱） | 无 |
| 云杉 | ≥6 格（5×5 柱） | 巨型云杉 ≥14 格（JE：以西北角树苗为中心 5×5 柱），且同层 3×3 需为空 |
| 丛林木 | ≥5 格（3×3 柱） | 巨型丛林 ≥11 格（JE：5×5 柱），且西北侧同层 3×3 **连透明方块都不许有**（原木/木/树叶除外） |
| 金合欢 | ≥6 格（5×5 柱） | 无 |
| 深色橡木 / 苍白橡木 | **无（1×1 不长）** | ≥7 格，**必须 4 树苗 2×2** |
| 樱花木 | ≥8 格（5×5 柱） | 无 |

（巨型丛林/巨型云杉的同层要求出处：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling) 引 MC-8187；2×2 组"西北侧（含对角）至最终高度无任何方块"：[Tree § Growth](https://minecraft.wiki/w/Tree)。）

### 2.2 被挡住时的行为（关键：拒绝而非穿墙）

- **"要长树时，先选一个高度，再检查地面与上方空间；地面不行或所选高度没空间，树就不长"**（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）。
- 每棵树苗约**每分钟获得一次生长尝试**；尝试顺序为"光照检查 → 随机选变体/尺寸 → 空间检查"，**任何一步遇阻即失败，等下一轮**——"开阔地长得快、拥挤树场会尝试多次"（来源：[Tree § Growth and characteristics](https://minecraft.wiki/w/Tree)）。
- **骨粉只是"强制发起一次尝试"**，不保证成功；对没有生长可能的受阻树苗，**骨粉照样被消耗**（来源：[Tree § Growth](https://minecraft.wiki/w/Tree)、[Bone Meal § Fertilizer/§ Wasting bone meal](https://minecraft.wiki/w/Bone_Meal)）。

### 2.3 会替换什么、绝不替换什么

- **JE 用方块标签 `#replaceable_by_trees` 定义"视为空"的方块**；生成时只把白名单方块替换成树。原木/木/去皮变体/树叶是**显式豁免**——它们不阻止生长（JE 可"穿过"既有树生成），但在 BE 中原木会阻止生长（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）。
- 树苗长成时，其下的草方块变泥土；JE 中大多数树苗还会把菌丝体等不在 `dirt` 标签里的基底转为泥土（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）。
- **被实体方块（石头、玩家建筑）挡住时绝不成树**——没有"绕开""挤开""穿墙"行为（依据 2.2 的失败语义+2.3 的白名单机制；**推论**级概括，来源同上）。

### 2.4 1×1 与 2×2、骨粉量级

- 2×2 组合见 2.1 表：云杉/丛林可 1×1 也可 2×2（2×2 出巨树）；深色橡木与苍白橡木**只能** 2×2；橡/桦/金合欢/樱花 1×1（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）。
- **骨粉催熟量级**：每次骨粉 **45%** 概率推进一个生长阶段，树苗共 2 个阶段，第 3 步"成树"仍需通过全部空间/光照检查（来源：[Bone Meal § Fertilizer](https://minecraft.wiki/w/Bone_Meal)）。**推论（计算）**：期望约 2/0.45 ≈ **4.4 次**骨粉过完两个阶段（成树是否成功另计）。

### 2.5 树不会自己长回来

**"从树上移除的树叶和原木不会随时间长回来"**（"Leaves and logs removed from a tree do not grow back over time."，来源：[Tree § Growth and characteristics](https://minecraft.wiki/w/Tree)）——砍树留下的缺口只有重新种树苗才能恢复，这是"资源可循环"与"地形不可再生"的分界句。

---

## 3. 树叶凋落（树被砍后的"善后"机制）

（来源：[Leaves § Usage](https://minecraft.wiki/w/Leaves)）

- **触发**：树叶收到随机刻时检查——若不通过其他树叶链与任何原木/木方块（含去皮）相连（**JE 最大距离 6 格**，BE 4 格，曼哈顿距离可穿角），则凋落消失；判定经由 `prevents_nearby_leaf_decay` 方块标签（来源同上；机制概述亦见 [Tick § Random tick](https://minecraft.wiki/w/Tick) 清单"Leaves may decay"）。
- **玩家放置的树叶永不凋落**（"Leaves placed by players never decay."，来源：[Leaves § Usage](https://minecraft.wiki/w/Leaves)）——**来源属性决定规则**，装饰用树叶绝对安全。
- **凋落掉落**：树苗 **5%**（1/20；丛林树叶 **2.5%**，1/40）；木棍 **2%**（1–2 根）；橡树/深色橡树树叶**另有一条独立的 0.5%**（1/200）掉苹果判定（可与树苗、木棍同时掉）。被烧掉的树叶什么都不掉（来源：[Leaves § Usage](https://minecraft.wiki/w/Leaves)）。
- 附：树叶凋落树苗概率与手工破坏一致（含时运加成表：I 级 6.25%、II 级 8.33%、III 级 10%）（来源：[Leaves § Breaking](https://minecraft.wiki/w/Leaves)）。

---

## 4. 草方块蔓延与枯死（"生态只在正确基底上恢复"的范本）

（来源：[Grass Block § Post-generation / § Death](https://minecraft.wiki/w/Grass_block)）

- **蔓延条件**（泥土要"接收"草，须同时满足）：
  1. 目标泥土在源草方块的 **3×5×3** 范围内（源方块居第二层中心）；
  2. **源草方块正上方光照 ≥9**；
  3. 目标泥土正上方的方块必须**透光**（楼梯/台阶的挡光面朝向泥土也不行）；
  4. 目标泥土正上方**不能是熔岩、水或任何含水方块**。
- **执行**：草被随机刻选中时，在范围内**检查 4 个位置**，把选中的泥土转为草；只向"泥→草"单向转换，不向砂土/缠根泥土蔓延。蔓延可跨 3 格向下，所以"向下坡扩散快于向上坡"（来源：[Grass Block § Post-generation](https://minecraft.wiki/w/Grass_block)）。
- **枯死**：草方块被**任意不透明方块**压住后，会在某个随机时刻（即轮到随机刻时）死亡变泥土；**透明方块**若使草上方光照降到 **≤4**（如水）同样致死（来源：[Grass Block § Death](https://minecraft.wiki/w/Grass_block)）。羊吃草也直接把草方块变回泥土（来源：[Grass Block § Usage](https://minecraft.wiki/w/Grass_block)）。
- **设计语义**（**推论**，依据上述两段）：恢复被限制在"正确基底 + 正确光照"上，消耗是双通道的（覆盖致死 / 啃食），且恢复与死亡共用同一个低频随机刻节拍——不会出现"瞬间全绿/瞬间全灭"。

---

## 5. 农作物（收获-重种循环的数值底座）

### 5.1 生长条件与阶段

（来源：[Tutorial:Crop farming § Growing conditions](https://minecraft.wiki/w/Tutorial:Crop_farming)、[Wheat § Farming](https://minecraft.wiki/w/Wheat)）

- 只长在**耕地**上（耕地被移除/退化则作物破坏）；要求**植物方块自身光照 ≥9**（火把可满足，不要求日光）；所在区块需被区块刻。
- 阶段数：小麦/胡萝卜/土豆 **8 段**（0–7），甜菜 **4 段**（来源：[Tutorial:Crop farming § Growing conditions](https://minecraft.wiki/w/Tutorial:Crop_farming)）。
- 耕地湿度：水平 **4 格**内（同层或上一层）有水（含流动水）即湿润；无水的干燥耕地**在没有作物时**退回泥土，旱作可行但慢（来源：[Tutorial:Crop farming § Sowing](https://minecraft.wiki/w/Tutorial:Crop_farming)）。

### 5.2 生长速度参数（维度的生长概率表）

（来源：[Tutorial:Crop farming § Growth rate](https://minecraft.wiki/w/Tutorial:Crop_farming)。注：此为 Wiki 教程页，公式来自代码分析口径，可信度高于 mod 文档、略低于正文机制页。）

- 每次随机刻，作物以概率 `1/(⌊25/速度等级⌋+1)` 进入下一阶段；速度等级 1–10 构成：
  - 基础：脚下耕地 **干燥 +2 / 湿润 +4**；
  - 邻域：周围每块干燥耕地 **+0.25**（全干邻域共 +2）、每块湿润耕地 **+0.75**（全湿共 +6），非耕地不贡献；
  - 密植惩罚：同种作物对角相邻、或南北与东西两个方向都紧邻同种作物时，速度等级**减半**。
- 概率速查表（每次随机刻进入下一阶段的概率）：

| 周围耕地数 | 湿润 | 干燥 |
| --- | --- | --- |
| 0 | 14.29% | 7.69% |
| 4 | 25.00% | 11.11% |
| 8 | 33.33% | 14.29% |

- 量级：理想条件（全湿耕地+分行种植+边缘留空）每阶段平均 **5 分钟**，最坏情况 **35 分钟**；理想条件下 **4/5 的作物在 31 分钟内成熟**（约 1.5 个游戏日）；最坏情形（干耕+对角密植）每次随机刻仅 **1/23 ≈ 4%**；小麦单株产出速率 ≈ **6.591 × 生长概率** 个/小时（来源同上）。
- 单个方块平均 68.27 秒才轮到一次随机刻（§1.1），两者相乘即"一片麦田几分钟长一格"的体感。

### 5.3 收获-重种循环与加速

- 成熟小麦收获掉 **1 小麦 + 1–4 种子**（平均 2 5⁄7 个/株）；未熟收获**只掉 1 种子**——收获即回本，天然形成"种→收→再种"不枯竭循环（来源：[Wheat § Farming](https://minecraft.wiki/w/Wheat)）。
- 骨粉：小麦/胡萝卜/土豆**一次推进 2–5 阶段**，甜菜 75% 概率推进 1 阶段；蜜蜂授粉每趟最多让 10 株作物各 +1 阶段（来源：[Bone Meal § Fertilizer](https://minecraft.wiki/w/Bone_Meal)、[Tutorial:Crop farming § Accelerating growth](https://minecraft.wiki/w/Tutorial:Crop_farming)）。
- 下界疣长在灵魂沙上、走随机刻生长，骨粉无效（来源：[Tick § Random tick](https://minecraft.wiki/w/Tick)、[Bone Meal § Usage](https://minecraft.wiki/w/Bone_Meal)）。

---

## 6. 被动生物（牛羊猪鸡：繁殖与刷新）

### 6.1 自然从哪来

（来源：[Mob spawning § Mob spawning on chunk generation / § Spawn cycle / § Passive mobs](https://minecraft.wiki/w/Mob_spawning)）

- **主通道=随地形生成**：新区块生成时以"生物生成概率"掷骰（多数群系 **0.1**，雪原/冰刺 **0.07**，恶地 **0.03**、疏林恶地 **0.04**），成功则按群系权重表带出成组动物（"农场动物"群系里：牛 4 只/组权重 8、羊 2–4 只/权重 12、猪 4 只/权重 10、鸡 4 只/权重 10）（来源：[Mob spawning § chunk generation](https://minecraft.wiki/w/Mob_spawning)）。
- **生成条件**（生成循环用）：光照 ≥9 的生成方块 + 特定基底（绝大多数动物=**草方块**；哞菇=菌丝体；山羊=石/沙砾/冰/雪等）（来源：[Mob spawning § Passive mobs](https://minecraft.wiki/w/Mob_spawning)）。
- **生成循环频率与上限**：被动生物每 **400 刻（20 秒）**才获得一次生成循环（怪物每刻一次）；生物上限"creature（动物）"类 **10 只**（全局上限按玩家周围 17×17 区块数缩放：`上限 × 区块数 ÷ 289`；繁殖/刷怪蛋/指令产生的**不受上限约束**）（来源：[Mob spawning § Java Edition mob cap / § Spawn cycle](https://minecraft.wiki/w/Mob_spawning)）。
- **生成后几乎不补员**："动物偶尔会在光照 ≥9 的草方块上刷出，**相当罕见**，且要求附近与已加载区块内动物很少；**大多数动物是随地形一起创建的**"（来源：[Grass Block § Spawning](https://minecraft.wiki/w/Grass_block)）；牛页同口径："JE 中世界生成后个别牛**可能极少出现**"（来源：[Cow § Spawning](https://minecraft.wiki/w/Cow)）。

### 6.2 繁殖机制与数值

（来源：[Cow § Breeding](https://minecraft.wiki/w/Cow)；繁殖通用机制各动物页同构）

- 喂对应食物（牛/羊/哞菇=小麦，猪=胡萝卜/土豆/甜菜根，鸡=任意种子）进入爱心模式；两只成功繁殖后生成幼崽并产出 **1–7 经验**。
- **父母 5 分钟内不可再次繁殖**（冷却 6000 刻）。
- **幼崽 24000 刻（20 分钟）成年**；喂小麦每次**削减剩余成长时间 10%**（加速喂大）。
- 繁殖产生的动物**不受生成上限约束**（来源：[Mob spawning § mob cap](https://minecraft.wiki/w/Mob_spawning)）。

### 6.3 不会消失 + 猎光后怎么恢复

- **JE 会自然消失的清单**：所有怪物/环境（蝙蝠）/水生生物（除潜影贝、凋灵、远古守卫者、末影龙），外加流浪猫、未驯服豹猫、流浪商人等；**动物（creature）类不在消失清单中**，即玩家建好的牧场种群是**持久的**（来源：[Mob spawning § Despawning](https://minecraft.wiki/w/Mob_spawning)）。
- **一片区域被猎光后的恢复途径**（结论，来源=上述全部）：①玩家携带两只到别处**繁殖回填**（主通道）；②走到**未生成的新区块**触发地形携带生成；③JE 极罕见的光照草方块零星刷新（可忽略量级）。**不存在"周期性重新铺满动物"的机制**（与 Bedrock 的定期地表动物刷新不同口径，BE 动物生成条件为光照 ≥7，来源：[Mob spawning § Bedrock Edition](https://minecraft.wiki/w/Mob_spawning)、[Grass Block § Spawning](https://minecraft.wiki/w/Grass_block)）。

---

## 7. 矿物（正典里唯一"严格不可再生"的大类）

### 7.1 矿石不再生 + 1.18+ 深度带分布

（来源：[Ore](https://minecraft.wiki/w/Ore) 及其信息框、[Ore § Distribution](https://minecraft.wiki/w/Ore)（经 `?action=raw` 维基文本逐列核对）；详细生成参数另见 [Ore (feature)](https://minecraft.wiki/w/Ore_\(feature\))）

- **信息框明确"可再生：否"**；矿石是"不常见的岩石类方块"，在**世界生成阶段**生成（矿物以 blob/矿脉配置放置，详见 Ore (feature) 页），此后没有任何随机刻/计划刻机制回填矿块（来源：[Ore](https://minecraft.wiki/w/Ore)；"没有回填机制"为否定性**推论**，依据 §1.2 随机刻响应清单与 [Renewable resource](https://minecraft.wiki/w/Renewable_resource) 全清单不含矿床再生）。
- **1.18+ 主世界深度带分布表**（Y 轴；"最常见层"为实测世界数据，"无生成层"为配置口径）：

| 矿物 | 总范围 | 最常见层 | 无生成层 | 备注 |
| --- | --- | --- | --- | --- |
| 煤 | 0 ~ 320 | 45 | −64 ~ −1 | 极常见；基岩层下无（化石中的深板岩钻石矿除外） |
| 铜 | −16 ~ 112 | 43 | −64 ~ −17、113~320 | 溶洞（钟乳石洞）群系矿团更大 |
| 青金石 | −64 ~ 64 | −2 | 65 ~ 320 | |
| 铁 | −64 ~ 72 及 80 ~ 320 | 14 | 73 ~ 79（夹层空档） | 双峰分布 |
| 金 | −64 ~ 32 | −18 | 33 ~ 320 | **恶地额外分布带 −64 ~ 256（实测最多在 32~256）** |
| 红石 | −64 ~ 16 | −59 | 16 ~ 320 | 越深越多 |
| 钻石 | −64 ~ 16 | −59 | 16 ~ 320 | 1.20.2 起 23w31a 增大 Y<0 生成量 |
| 绿宝石 | −16 ~ 320 | 85 | −64 ~ −17 | **仅山地类群系**；单块散布不成团 |

（下界：石英常见至 Y=120、下界金至 95、远古残骸峰值 **16**、Y≥120 无；来源：[Ore § The Nether](https://minecraft.wiki/w/Ore)。绿宝石每区块稀有度低于远古残骸——[Ore § Trivia](https://minecraft.wiki/w/Ore)。）

### 7.2 哪些"矿物类"资源其实是可再生的（间接机制）

（来源：[Renewable resource § List of resources](https://minecraft.wiki/w/Renewable_resource)；铁傀儡数值：[Iron Golem § Drops](https://minecraft.wiki/w/Iron_golem)）

| 资源 | 再生途径 | 数值 |
| --- | --- | --- |
| 铁锭 | **铁傀儡**掉落（村庄召唤/玩家搭建）；僵尸稀有掉落 | 傀儡 3–5 锭（均值 4）+0–2 虞美人 |
| 金锭 | **僵尸猪灵**掉落；金粒合成 | — |
| 铜锭 | 溺尸稀有掉落；铜粒合成 | — |
| 煤 | **凋灵骷髅**掉落 | — |
| 红石粉 | **女巫**掉落 | — |
| 青金石 | **牧师村民交易**（JE）；流浪商人（BE） | — |
| 绿宝石 | 交易闭环（村民折扣）、卫道士/唤魔者掉落、叼绿宝石的狐狸 | — |
| 下界石英 / 黑石 / 哭泣黑曜石 / 沙砾 / 灵魂沙 | **猪灵以物易物**（投入金锭） | — |
| 黑曜石 | 熔岩+水、下界传送门自动生成（空气中 18 块）、末地折跃平台重铺、以物易物 | — |
| 钻石 | **仅**战利品库（vault/不祥 vault）战利品表（1.21.5+；每个库记忆 128 名玩家，第 129 人顶掉第 1 人后可重复） | "仅限此途径" |

### 7.3 严格不可再生的矿类

- **矿石方块本身全部不可再生**（煤/铁/铜/金/红石/青金石/钻石/绿宝石矿石及深板岩变体、下界金矿、下界石英矿）：信息框"可再生=否"（来源：[Ore](https://minecraft.wiki/w/Ore)）。
- **远古残骸→下界合金线**：不在任何可再生清单中（来源：[Renewable resource](https://minecraft.wiki/w/Renewable_resource) 全清单查无），即终级装备材料严格有限（**未证实**有例外）。
- 钻石物品在 1.21.5+ 仅经 vault 极有限地"玩法化再生"，矿石本体仍不回填（来源：[Renewable resource § Vault](https://minecraft.wiki/w/Renewable_resource)）。

---

## 8. 关键安全不变量（本调研核心）：自然生长为何永不毁建筑

### 8.1 不变量①：随机刻只作用于"注册进响应集合"的身份方块

- **正典依据**："绝大多数方块忽略这个刻"（"Most blocks ignore this tick"），随后给出**穷举式响应清单**（§1.2）——石头、圆石、深板岩、原木、木板、玻璃、砖块等一切建筑方块**不在清单内**，对其而言随机刻是完全的空操作（来源：[Tick § Random tick](https://minecraft.wiki/w/Tick)；中文对照：[刻 § 随机刻](https://zh.minecraft.wiki/w/%E5%88%BB)首句"绝大多数方块不会响应随机刻"）。
- 抽样本身是"随机选**位置**"，但选到非响应方块后**什么都不发生**；不含响应方块的子区块甚至整段跳过（来源：[Tick § Random tick](https://minecraft.wiki/w/Tick)）。
- **推论**：玩家造的房子被随机刻"抽中"过无数次，但没有任何代码路径能把石头变掉——安全不靠"抽不中"，靠"抽中也无操作"。

### 8.2 不变量②：生长执行前逐格做可替换性检查，被挡就拒绝

- **正典依据 1（流程）**：树苗成树"先选高度 → 检查地面与上方空间 → 空间不足则**不长**"，且**下次尝试重新全查**；受阻树苗反复尝试、骨粉被白白消耗（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)、[Tree § Growth and characteristics](https://minecraft.wiki/w/Tree)、[Bone Meal § Wasting bone meal](https://minecraft.wiki/w/Bone_Meal)）。
- **正典依据 2（替换白名单）**：JE 的 `#replaceable_by_trees` 标签把"允许被树替换"的方块**显式枚举**（空气、草、蕨、花等植物与树叶），白名单外一概拒绝；原木/树叶的"可穿过"是显式豁免条款，不是无检查穿透（来源：[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）。
- **正典依据 3（大树的更严口径）**：2×2 巨树要求西北侧（**含对角**）到最终高度无任何方块；巨型丛林的同层 3×3 连**透明方块**都算阻挡（来源：[Tree § Growth](https://minecraft.wiki/w/Tree)、[Sapling § Growing trees](https://minecraft.wiki/w/Sapling)）。
- 同理，草蔓延只会落在"泥土+透光上方"（§4），作物只长在"耕地上"（§5）——**每一种生长都有自己的基底白名单**。
- **推论**：MC 的生长语义是"拒绝式"（abort on obstruction）而非"推挤式"（push through）；正典不存在"自然生长覆盖既有方块"的路径（树叶凋落是**自身消失**，也不触碰邻块）。

### 8.3 不变量③：世界没有任何自动地形/矿床再生

- **正典依据 1**："从树上移除的树叶和原木**不会随时间长回**"（来源：[Tree § Growth and characteristics](https://minecraft.wiki/w/Tree)）——正典亲口否认植被级地形回填。
- **正典依据 2**：矿石信息框"可再生=否"；矿物在**世界生成**时放置（来源：[Ore](https://minecraft.wiki/w/Ore)、[Ore (feature)](https://minecraft.wiki/w/Ore_\(feature\)) 主条目指向）。
- **正典依据 3**：官方"可再生资源"定义与全清单中，"可再生"的全部途径是**生物掉落、种植、流体反应、交易、以物易物、合成/熔炼**——没有任何一项是"地形/矿床重生成"（来源：[Renewable resource § Types](https://minecraft.wiki/w/Renewable_resource)）。
- **推论（概括性否定命题）**："整个世界不存在任何自动地形或矿床再生机制"是对上述三条的等价概括；正典没有一句"永不再生"的原话，故按调研规范标**推论**（证据为否定性：三大机制页均无此行为，随机刻响应清单穷举无矿/地形项）。

---

## 9. 平衡哲学小结：可再生 vs 不可再生的分层

- **官方对"可再生"的定义**："在生存模式中无需利用漏洞或指令即可无限获取的资源"（来源：[Renewable resource](https://minecraft.wiki/w/Renewable_resource)）。并明确指出："由于地图巨大，正常世界几乎不可能耗尽资源……只有部分资源可以不探索新地形就反复生产"——**可再生性的设计价值恰恰在"免探索"**（同上）。
- **分层结构**（来源：[Renewable resource § Types](https://minecraft.wiki/w/Renewable_resource)）：
  - **基础可再生**：无需任何前置无限资源——怪物/动物掉落、无骨粉种植、流体反应、钓鱼、试炼刷怪笼奖励。官方原话："**动物与怪物掉落的大多数物品是可再生的，因为同类生物可以不断刷新再杀**"；例外是随结构一次性生成的怪（如每座海底神殿只有 3 只远古守卫者）。
  - **复合可再生**：需要先有另一种无限资源——村民/流浪商人**交易**、猪灵**以物易物**、骨粉催熟、合成/熔炼。
  - **混合可再生**：两条路都通（箭=骷髅掉落或合成）。
  - 还有"仅方块形态可再生"与"仅 vault 可再生"（钻石）两个特例层。
- **官方的另一句设计态度**："获取某资源的可再生方法**不一定是最简单、最快或最安全的**，有时极为不实用"（来源：[Renewable resource](https://minecraft.wiki/w/Renewable_resource)）——可再生是"存在性保障"，不是"最优路线"。
- **为什么矿物不再生**：**未证实** wiki 有 Mojang 官方表述。可佐证的分层事实：①铁/金/铜锭、煤、红石、青金石、绿宝石这些"矿物加工产物"全部有再生链（§7.2），说明官方刻意把**不可再生性收窄到"矿块本体"**，让"挖矿"始终指向野外探索、而"用矿"可以农场化；②钻石的深度带（−64~16、峰 −59）+1.20.2 加大深处生成（来源：[Ore § History](https://minecraft.wiki/w/Ore)）把它定位成"探索性资源"，1.21.5 又只给了 vault 这种**玩法门控**的有限再生口（来源：[Renewable resource § Vault](https://minecraft.wiki/w/Renewable_resource)）。**推论/社区共识**：矿不再生是为了给"持续向下、向外探索"提供永久动机，同时用生态链兜住生存底线——此句为社区通行理解，非正典原文。

---

## 10. Mod 与服务器插件的"矿物再生"实现套路（来源等级：低）

> 本节来源为第三方插件/mod 商店页面，非 Mojang 正典，仅作实现参考；SpigotMC 站点有反爬（403），描述引自搜索结果与 Modrinth/CurseForge 页面。

1. **Ore Respawn / Resource Respawn**（Modrinth 插件，Bukkit/Paper/Spigot，MIT）：挖掉矿石后放置**标记方块（marker block）**，到可配置延迟后**恢复原矿石**；待回填数据带世界信息持久化、**服务器重启后仍恢复**；玩家潜行挖掘可阻止该位置再生；配置项：`respawn-delay-millis`（默认延迟）、`respawn-block`（标记方块）、`ore-blocks`（参与再生的矿石清单）——"只对清单内矿石、只在被挖的那个位置回填"（来源：[Modrinth: Ore Respawn](https://modrinth.com/project/sFEbrGdV)，页面明示 marker-block 机制；来源等级低）。
2. **Ore Regenerator**（SpigotMC 插件 #71743，"Timed block regen"）：按计时把被挖方块回填，支持 ItemsAdder/Oraxen/Nexo 自定义方块与"再生链"；另有免费的精简版（#113244/#113249）与更早的 Skript 版（#45352）（来源：[SpigotMC: Ore Regenerator](https://www.spigotmc.org/resources/%E2%9C%A8-ore-regenerator-%E2%9C%A8-itemsadder-oraxen-nexo-support-1-16-26-3-%E2%9B%93%EF%B8%8F-new-regen-chains-%E2%9B%93%EF%B8%8F.71743/)；正文因 403 未能核对，来源等级低）。
3. **Vanilla Ore Regeneration**（CurseForge mod）："把全部原版矿石转换为 regenerator ores。**矿石被挖后替换为不可挖掘的 bedrock ore（基岩矿）**，可配置时间后再生"——用"硬质占位方块"防止玩家把"矿坑"当通道、防止再生时与玩家行为冲突（来源：[CurseForge: vanilla-ore-regeneration](https://www.curseforge.com/minecraft/mc-mods/vanilla-ore-regeneration)（描述见其文件页 [8481058](https://www.curseforge.com/minecraft/mc-mods/vanilla-ore-regeneration/files/8481058)）；来源等级低）。
4. **共同套路与安全设计**（归纳，**推论**）：三条共性——①**位置记录**：只回填"被挖的那个坐标"，从不在世界内扫描/扩散，天然不可能覆盖玩家后放的建筑；②**标记方块占位**：等待期放置专属方块（marker/bedrock ore），把"未回填"状态显式化，回填时只覆盖**自己的标记方块**；③**白名单清单**：只有配置清单中的矿石类型参与再生。至于"回填前检查该位置当前仍是预期基底（石头/深板岩/标记方块）才执行"——**未证实**上述页面有明文，属社区实现的通行防御惯例（同类插件 OreRespawn #44790 提及"概率+时间可配置"，未写防御检查细节，来源：[dev.bukkit.org: Ore Respawn](https://dev.bukkit.org/projects/ore-respawn)、[SpigotMC: OreRespawn](https://www.spigotmc.org/resources/orerespawn.44790/updates)，来源等级低）。

---

## 11. 对本项目的机制启示（候选清单）

> 只列机制要点与出处，不含实现方案。每条末尾注明依据本报告哪节。

1. **恢复用"抽样预算"而非"每方块计时器"**：每区块每 tick 固定 3 个随机刻槽位，谁被抽中谁生长——并发规模与地图大小解耦，调全局速率一个参数即可（§1.1）。
2. **"慢"是特性**：单个方块平均 68.27s 才轮到一次，儿童版可整体调大速率（如等效 random_tick_speed 6~10），保持"看得见的慢慢变绿"（§1.1）。
3. **生长=拒绝式语义**：执行前逐格检查，任一格被实体方块挡住就整株放弃、什么都不改写——这是"绝不长穿玩家建筑"的正解，比"事后修正"便宜得多（§2.2、§8.2）。
4. **每种生长带显式替换白名单**：树=空气/植物/树叶（`#replaceable_by_trees` 思路），草=只落泥土，作物=只落耕地；白名单外一律拒绝（§2.3、§8.2）。
5. **玩家放置的东西永不回收**：树叶凭"玩家放置"标记豁免凋落——本项目可用 `placedBy: 'player'` 属性豁免一切恢复/凋落行为（§3、§8.2）。
6. **凋落是低概率减法**：树叶凋落掉树苗 5%、苹果 0.5%、木棍 2%，烧毁归零——恢复机制不惩罚玩家，奖励探索树（§3）。
7. **凋落有距离约束**：离最近原木 ≤6 格才保活，砍树留茬会自然"落叶归根"， children 能直观看到"树没了叶会掉"（§3）。
8. **生态只在正确基底恢复**：草只落"泥土+上方透光"，被不透明方块压住会死——用"基底方块+光照"两个布尔条件即可表达"这里适合恢复吗"（§4）。
9. **死亡与恢复共用同一低频节拍**：草的枯死也走随机刻，避免"一夜全灭"的挫败感；羊啃食是确定性的快通道（§4）。
10. **作物速度做成环境函数**：湿度（+0.75/邻块）× 邻株（密植减半）× 光照门（≥9）三个可读参数，孩子能理解"浇水+间距=长得快"（§5.2）。
11. **收获-重种自循环**：成熟收获掉"产物+≥1 份种子"，未熟只掉 1 种子——系统天然不枯竭，不需要系统层面"补种"（§5.3）。
12. **动物恢复主通道=繁殖，副通道=新地块**：被猎光的区域不自动刷满，孩子必须"留两只+喂食"；配 5 分钟繁殖冷却 + 20 分钟成长期双闸门防指数爆炸（§6.2、§6.3）。
13. **矿永不自动回填，可再生性转移到生态链**：矿石本体不再生（探索动机），但铁=保护村民刷傀儡、金=下界刷僵尸猪灵之类的"农场化再生"可以作为进阶玩法（§7.2、§8.3）。
14. **若确需"矿藏恢复"，抄插件三件套**：位置记录+标记方块占位+矿石类型白名单，回填只覆盖自己的标记方块；来源等级低，仅作参考（§10）。
15. **所有时长以游戏刻为内部单位**：68.27s、5 分钟冷却、24000 刻成长……正典全部 tick 化，展示层再换算成秒/分钟；本项目建议同样"内部 tick、外显秒"，方便日后对表（§1.1、§5.2、§6.2）。

---

## 12. 来源清单（本次全部抓取的一手页面）

- **Minecraft Wiki（英文，2026-10-28 抓取）**：
  - [Tick](https://minecraft.wiki/w/Tick)（§ Game tick / § Chunk tick / § Random tick / § History）——随机刻抽样规则、47.30s/68.27s、响应方块清单、1.21.5 范围变化
  - [刻（zh.minecraft.wiki）](https://zh.minecraft.wiki/w/%E5%88%BB)（§ 区块刻 / § 随机刻）——中文术语对照与数值复核
  - [Sapling](https://minecraft.wiki/w/Sapling)（§ Growing trees）——种植基底、光照 ≥9、各树空间需求、2×2 图表、`#replaceable_by_trees`、MC-8187
  - [Tree](https://minecraft.wiki/w/Tree)（§ Growth and characteristics）——光照 ≥8、受阻重试语义、约每分钟一次尝试、骨粉=强制尝试、2×2 西北侧净空、"树叶原木不长回"
  - [Leaves](https://minecraft.wiki/w/Leaves)（§ Breaking / § Usage）——凋落距离 6（JE）/4（BE）、玩家放置豁免、5%/2.5%/2%/0.5% 掉落表
  - [Grass Block](https://minecraft.wiki/w/Grass_block)（§ Post-generation / § Death / § Spawning）——蔓延 4 条件、3×5×3、光照 ≥9、死亡规则、动物零星刷新
  - [Wheat](https://minecraft.wiki/w/Wheat)（§ Farming）——8 阶段、光照 ≥9、1 麦+1–4 种子
  - [Tutorial:Crop farming](https://minecraft.wiki/w/Tutorial:Crop_farming)（§ Sowing / § Growing conditions / § Growth rate）——生长概率公式与 14.29%~33.33% 表、5~35 分钟/阶段、耕地湿度 4 格、蜜蜂授粉
  - [Bone Meal](https://minecraft.wiki/w/Bone_Meal)（§ Fertilizer / § Wasting bone meal）——树苗 45%/阶段、作物 2–5 阶段、受阻浪费、深色橡木须 4 联
  - [Mob spawning](https://minecraft.wiki/w/Mob_spawning)（§ chunk generation / § Spawn cycle / § mob cap / § Passive mobs / § Despawning）——地形携带生成概率、每 400 刻一轮、creature 上限 10、被动生物生成条件、消失清单不含动物
  - [Cow](https://minecraft.wiki/w/Cow)（§ Spawning / § Breeding）——世界生成 4 只/组、繁殖 5 分钟冷却、幼崽 24000 刻成年、喂食 -10%
  - [Ore](https://minecraft.wiki/w/Ore)（信息框 + § Distribution，经 `?action=raw` 维基文本逐列核对 + § History + § Trivia）——可再生=否、1.18+ 深度带全表、1.20.2 钻石加深
  - [Renewable resource](https://minecraft.wiki/w/Renewable_resource)（§ Types / § List / § Vault）——可再生定义、三类分层、铁/金/铜/煤/红石/青金石/绿宝石/黑曜石再生链、钻石仅 vault
  - [Iron Golem](https://minecraft.wiki/w/Iron_golem)（§ Drops）——3–5 铁锭（均值 4）
- **Minecraft Wiki（中文）**：[刻](https://zh.minecraft.wiki/w/%E5%88%BB)（全页抓取，随机刻/区块刻/计划刻术语与数值复核）
- **第三方（来源等级低，仅 §10 使用）**：
  - Modrinth: [Ore Respawn](https://modrinth.com/project/sFEbrGdV)（marker block + 定时恢复机制描述）
  - SpigotMC: [Ore Regenerator #71743](https://www.spigotmc.org/resources/%E2%9C%A8-ore-regenerator-%E2%9C%A8-itemsadder-oraxen-nexo-support-1-16-26-3-%E2%9B%93%EF%B8%8F-new-regen-chains-%E2%9B%93%EF%B8%8F.71743/)（正文 403 未核对）、[OreRespawn #44790](https://www.spigotmc.org/resources/orerespawn.44790/updates)
  - dev.bukkit.org: [Ore Respawn](https://dev.bukkit.org/projects/ore-respawn)
  - CurseForge: [Vanilla Ore Regeneration](https://www.curseforge.com/minecraft/mc-mods/vanilla-ore-regeneration)（描述见 [files/8481058](https://www.curseforge.com/minecraft/mc-mods/vanilla-ore-regeneration/files/8481058)）
- **明确"未证实"清单**：①Mojang 对"矿不再生"的官方设计陈述（§9 标推论/社区共识）；②"回填前检查基底方块"在上述插件文档中的明文（§10 标社区惯例）；③作物生长存在"下界/末地减半"之类的维度系数（本次各页未见，不采信）。

---

*本报告仅作调研产出，未改动任何代码。*
