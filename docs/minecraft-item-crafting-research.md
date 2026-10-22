# Minecraft（Java 版）物品系统与合成系统调研报告

> **调研说明**
> - 调研日期：2026-10-22。全部结论来自第一手权威来源 **Minecraft Wiki**（[minecraft.wiki](https://minecraft.wiki)，即 wiki.gg 系官方社区 Wiki，由 Weird Gloop 托管），未使用任何二手博客。
> - 版本口径：Wiki 当前反映最新 Java 版（26.x，即 1.21.x 分支之后；工具等级表中"铜质工具"为 1.21.9 加入、配方 JSON 的 `result.id` 写法为 1.20.5+ 格式）。本文涉及的核心机制（堆叠、掉落、矿物分布、合成规则）分别自 1.13/1.18 等版本起保持稳定，文中在版本相关处单独标注。
> - 掉落数据如无特别说明均为 **Java 版**数值；概率与期望值直接摘自 Wiki 掉落表。

---

## 1. 物品系统基础

### 1.1 物品（Item）与方块（Block）的关系

- **物品**是存在于玩家/生物/盔甲架的物品栏、各类容器（箱子、发射器等）、物品展示框中的对象；**方块**是世界中被放置的物体。两者是同一资源的两种形态："在物品栏里是物品，被放置后是方块"，例如船被放置后变成实体、仙人掌被放置后变成方块（来源：[Item – Minecraft Wiki](https://minecraft.wiki/w/Item)）。
- 方块和实体被破坏/死亡时会**掉落物品实体**（dropped item），掉落物会在已加载区块中存在 5 分钟后消失（下界之星除外），可被玩家、漏斗等拾取（来源：[Item – Minecraft Wiki](https://minecraft.wiki/w/Item)）。
- 许多物品"直接对应同名方块"（如原木、木板、矿石），Wiki 将其归为"与方块同名的物品"；另一些物品会放置成**不同名称的方块**（如小麦种子→小麦作物、胡萝卜→胡萝卜作物）（来源：[Item – Minecraft Wiki](https://minecraft.wiki/w/Item)）。

### 1.2 物品 ID 与命名空间机制

- 游戏对象用**命名空间标识符**（identifier / resource location）声明，格式为 `namespace:path`，例如 `minecraft:iron_ingot`（来源：[Identifier – Minecraft Wiki](https://minecraft.wiki/w/Identifier)）。
- 命名空间与路径只允许：数字、小写字母、`_`、`-`、`.`；`/` 只能出现在路径中；命名首选 `snake_case`。若字符串中不含 `:`，Java 版自动默认命名空间为 `minecraft`（即 `iron_ingot` 等价于 `minecraft:iron_ingot`）（来源：[Identifier – Minecraft Wiki](https://minecraft.wiki/w/Identifier)）。
- `minecraft` 命名空间为官方保留，用于原版内容；数据包/模组应使用自己的命名空间以避免冲突（Mojang 开发者 Dinnerbone 的官方说明亦收录于该页）（来源：[Identifier – Minecraft Wiki](https://minecraft.wiki/w/Identifier)）。
- Java 版自 1.8（14w02a）起将数字 ID 改为 `minecraft:item_name` 形式的命名空间 ID；1.13"扁平化"后资源路径成为唯一合法标识（来源：[Identifier – Minecraft Wiki](https://minecraft.wiki/w/Identifier)）。

### 1.3 物品堆叠机制（64 / 16 / 1）

（来源：[Item – Minecraft Wiki](https://minecraft.wiki/w/Item)；[Inventory – Minecraft Wiki](https://minecraft.wiki/w/Inventory)）

| 最大堆叠数 | 规则 | 例子 |
| --- | --- | --- |
| **64** | 绝大多数物品，包括所有完整方块 | 圆石、铁锭、木板等 |
| **16** | 部分功能性/投射物类 | 雪球、空桶、鸡蛋、告示牌、末影珍珠、船等 |
| **1（不可堆叠）** | 一切有耐久度的物品（武器/盔甲/工具）、装满的桶、药水等 | 镐、剑、盔甲、水桶 |

- 命令可强制堆叠到 99（JE）/127（BE）（来源：[Item – Minecraft Wiki](https://minecraft.wiki/w/Item)）。
- 物品栏中的堆叠管理操作（左键整组、右键对半、Shift 快速转移等）见（来源：[Inventory – Minecraft Wiki](https://minecraft.wiki/w/Inventory)）。

### 1.4 物品稀有度与 Tooltip（提示文本）

- **稀有度只影响物品名称的显示颜色，对玩法没有任何影响**。四级稀有度及颜色（JE）（来源：[Rarity – Minecraft Wiki](https://minecraft.wiki/w/Rarity)）：

| 稀有度 | 颜色（十六进制） | 说明 |
| --- | --- | --- |
| Common（常见） | `#FFFFFF` 白 | 默认等级 |
| Uncommon（少见） | `#FFFF55` 黄 | 唱片、图腾、头颅、锁链盔甲等 |
| Rare（稀有） | `#55FFFF` 青 | 附魔书（JE）、附魔金苹果、三叉戟、信标等 |
| Epic（史诗） | `#FF55FF` 品红 | 鞘翅、龙蛋、重锤等 |

- **附魔会将稀有度提升一级**：Common/Uncommon→Rare，Rare→Epic，Epic 不再升（来源：[Rarity – Minecraft Wiki](https://minecraft.wiki/w/Rarity)）。
- **Tooltip**：鼠标悬停时物品会显示名称与附加信息（附魔、lore、物品特定信息）；Java 版按 `F3+H` 可额外显示物品 ID 等调试信息（来源：[Item – Minecraft Wiki](https://minecraft.wiki/w/Item)；[Inventory – Minecraft Wiki](https://minecraft.wiki/w/Inventory)）。
- 合成出的物品"应继承其材料中最高的稀有度"（Mojang 官方准则），但实际存在不少人工设定的例外（来源：[Rarity – Minecraft Wiki](https://minecraft.wiki/w/Rarity)）。

### 1.5 工具：耐久度、攻击伤害、挖掘等级

**工具等级表**（Java 版数值；BE 每项耐久 +1）——当前版本共 7 个等级：木、金、石、铜（1.21.9 加入）、铁、钻石、下界合金（来源：[Tiers – Minecraft Wiki](https://minecraft.wiki/w/Tiers)）：

| 等级 | 挖掘等级 | 耐久度 | 挖掘效率 | 伤害加成 | 附魔能力 |
| --- | --- | --- | --- | --- | --- |
| 木 Wood | 0 | 59 | 2 | 0 | 15 |
| 石 Stone | 1 | 131 | 4 | 1 | 5 |
| 铜 Copper | 1* | 191 | 5 | 13（盔甲为 8）附魔能力 | 13 |
| 铁 Iron | 2 | 250 | 6 | 2 | 14（盔甲为 9） |
| 钻石 Diamond | 3 | 1561 | 8 | 3 | 10 |
| 下界合金 Netherite | 4 | 2031 | 9 | 4 | 15 |
| 金 Gold | 0 | 32 | 12 | 22（盔甲为 25）附魔能力 | 22 |

> 注：铜质为 1.21.9 新增等级（挖掘等级与石质同级，表中原文未单列挖掘等级值，其耐久 191、效率 5、附魔能力 13）。"伤害加成"加在基础攻击伤害 1 之上（来源：[Tiers – Minecraft Wiki](https://minecraft.wiki/w/Tiers)）。

**挖掘等级（mining level）与方块需求**（来源：[Tiers – Minecraft Wiki](https://minecraft.wiki/w/Tiers)）：

- 方块通过标签限制挖掘等级：`needs_stone_tool`（≥1）、`needs_iron_tool`（≥2）、`needs_diamond_tool`（≥3）；无标签则等级 0 即可。存在未使用的 `needs_netherite_tool`（等级 4）。
- 具体归属（Wiki 脚注）：
  - **等级 1（石镐+）**：铁矿、铜矿、青金石矿及其深板岩变体、铁/铜/青金石块等；
  - **等级 2（铁镐+）**：钻石矿、绿宝石矿、金矿、红石矿及其深板岩变体等；
  - **等级 3（钻石镐+）**：远古残骸、黑曜石、哭泣的黑曜石、下界合金块等。
- 各镐攻击伤害（JE，手持显示值）：木/金镐 2、石/铜镐 3、铁镐 4、钻石镐 5、下界合金镐 6；攻速 1.2；所有镐**不可堆叠**（来源：[Pickaxe – Minecraft Wiki](https://minecraft.wiki/w/Pickaxe)）。
- 矿石类方块硬度：普通/石头系矿石 **3**，深板岩变体 **4.5**（更难挖，耗时约 1.5 倍）；远古残骸 30（来源：[Ore – Minecraft Wiki](https://minecraft.wiki/w/Ore)）。

### 1.6 燃料系统

- 熔炉**每件物品烧炼耗时 10 秒（200 game ticks）**；烟熏炉/高炉速度翻倍（5 秒/件），但每件燃料可烧物品数不变（燃料烧得更快、产出相同）（来源：[Smelting – Minecraft Wiki](https://minecraft.wiki/w/Smelting)）。
- 常用燃料（来源：[Smelting § Fuel – Minecraft Wiki](https://minecraft.wiki/w/Smelting)）：

| 燃料 | 燃烧时间 | 可烧物品数 |
| --- | --- | --- |
| 岩浆桶 | 1000 秒（20000 ticks） | 100 件 |
| 煤炭块 | 800 秒 | 80 件 |
| **煤炭** | **80 秒（1600 ticks）** | **8 件** |
| 木板/原木等木质燃料 | 15 秒 | 1.5 件 |
| 木棍 | 5 秒 | 0.5 件 |

> 用户示例"煤炭 80 秒 / 8 个物品"与 Wiki 完全一致。燃料在开始燃烧时立即扣除整件，即使没有待烧物品也会燃尽（来源：[Smelting – Minecraft Wiki](https://minecraft.wiki/w/Smelting)；[Furnace – Minecraft Wiki](https://minecraft.wiki/w/Furnace)）。

---

## 2. 主世界自然矿物（Overworld Ores）

### 2.1 生成分布（Java 版 1.18+ 世界生成，沿用至今）

下表整理自 Ore 页分布表；"最常见层"为 Wiki 基于真实世界生成统计的数据（脚注 f），并非理论峰值（来源：[Ore § Distribution – Minecraft Wiki](https://minecraft.wiki/w/Ore)）：

| 矿物 | 总生成范围（Y） | 实测最常见层 | 丰度 | 最低镐等级 |
| --- | --- | --- | --- | --- |
| 煤 Coal | 0 ~ 320 | 45 | 非常常见 | 木镐 |
| 铜 Copper | -16 ~ 112 | 43 | 常见（滴水石洞穴中矿簇更大） | 石镐 |
| 青金石 Lapis Lazuli | -64 ~ 64 | -2 | 罕见 | 石镐 |
| 铁 Iron | -64 ~ 72 与 80 ~ 320 两段 | 14 | 常见 | 石镐 |
| 金 Gold | -64 ~ 32；恶地额外 32 ~ 256 | -18（恶地 32~256 全段） | 常见（恶地显著增多） | 铁镐 |
| 红石 Redstone | -64 ~ 16 | -59 | 常见 | 铁镐 |
| 钻石 Diamond | -64 ~ 16 | -59 | 非常稀有 | 铁镐 |
| 绿宝石 Emerald | -16 ~ 320（仅山地类群系） | 85 | 不常见 | 铁镐 |

- 绿宝石与其它矿不同：**不以多方块矿簇而以单方块散布**生成（Wiki 脚注 b）；红石与钻石越深越多，在 Y=-59 附近最集中（来源：[Ore – Minecraft Wiki](https://minecraft.wiki/w/Ore)）。
- 矿簇（blob）具体尺寸/频率的逐群系数据见（来源：[Ore (feature) – Minecraft Wiki](https://minecraft.wiki/w/Ore_(feature))，Ore 页主引用）。

### 2.2 掉落物、时运与精准采集

（来源：[Ore § Usage – Minecraft Wiki](https://minecraft.wiki/w/Ore)）

- **掉落 1 个成品**：煤矿→煤、钻石矿→钻石、绿宝石矿→绿宝石、下界石英矿→下界石英。
- **掉落 1 个粗矿（需熔炼成锭）**：铁矿→粗铁、金矿→粗金。1.17（21w14a）起，铁/金/铜矿不带精准采集挖掘时掉落粗矿而非矿石方块。
- **掉落多个**：铜矿→2–5 粗铜；红石矿→4–5 红石粉；青金石矿→4–9 青金石；下界金矿→2–6 金粒。
- **时运（Fortune）**：上述所有矿石的**平均产量都会被时运提升**（Wiki 原文："The average yield of any of the ores in the list above can be increased by using a pickaxe with Fortune"）。
- **精准采集（Silk Touch）**：大多数矿石需要精准采集镐才能掉落矿石方块本身；远古残骸天然掉落自身，需熔炼成下界碎片。
- 挖矿经验（正常挖掘时）：煤 0–2、红石 1–5、青金 2–5、绿宝石 3–7、钻石 3–7、下界石英 2–5；**烧炼矿石的 XP**：粗铁/铁矿/铜 0.7、粗金/金 1.0、煤 0.1、青金 0.2、钻石 1.0、绿宝石 1.0、远古残骸 2.0（来源：[Smelting § Recipes – Minecraft Wiki](https://minecraft.wiki/w/Smelting)）。
- 用精准采集采下"多掉落"类矿石再烧炼通常不划算（产物更少、XP 更低）；下界金矿是唯一例外（来源：[Ore – Minecraft Wiki](https://minecraft.wiki/w/Ore)）。

### 2.3 深板岩层（Y=0 以下）

- 深板岩及其矿石变体**只在 Y=8 以下生成**（生成于深板岩取代石头处，Wiki 脚注 c：'Deepslate and its ore variants only generate under layer 8'）（来源：[Ore – Minecraft Wiki](https://minecraft.wiki/w/Ore)）。
- 与石头系矿石（硬度 3）相比，**深板岩矿石硬度 4.5**，挖掘明显更慢（来源：[Ore – Minecraft Wiki](https://minecraft.wiki/w/Ore)）。
- 圆石类对应物：深板岩挖掘掉落**深板岩圆石**（cobbled deepslate），可作为石质工具的替代材料（修复与合成均可与圆石/黑石互换）（来源：[Tiers – Minecraft Wiki](https://minecraft.wiki/w/Tiers)；[Furnace – Minecraft Wiki](https://minecraft.wiki/w/Furnace)）。

---

## 3. 怪物掉落（Mob Drops）

### 3.1 敌对生物掉落表（Java 版）

整理自各生物页"on death"掉落表（数量/掉落概率；`Looting I/II/III` 为各级最大值与概率）：

| 生物 | 常规掉落（默认） | Looting III 时 | 稀有/条件掉落 | 经验（玩家击杀） |
| --- | --- | --- | --- | --- |
| 僵尸 | 腐肉 0–2（66.67%） | 0–5（94.44%） | 铁锭/胡萝卜/土豆 各 0–1（各 0.83%，Looting III 1.83%），**仅玩家/驯服狼击杀**；着火死→烤土豆 | 5（幼尸 12） |
| 骷髅 | 骨头 0–2 + 箭 0–2（各 66.67%） | 各 0–5 | 被充能苦力怕炸死→骷髅头颅；天然装备（含弓）8.5% 掉落 | 5 + 每件装备 1–3 |
| 蜘蛛 | 线 0–2（66.67%） | 0–5 | 蜘蛛眼 0–1（33.33%），**仅玩家/驯服狼击杀** | 5 |
| 苦力怕 | 火药 0–2（66.67%） | 0–5 | 被骷髅/流浪者等射杀→随机唱片；被充能苦力怕炸死→苦力怕头 | 5 |
| 末影人 | 末影珍珠 0–1（50%） | 0–4（91.67%） | 手持方块 100% 掉落 | 5 |
| 史莱姆（小型） | 粘液球 0–2（66.67%），**仅玩家击杀且非青蛙杀死** | 0–5 | 大型死亡分裂 2–4 中型；中型分裂 2–4 小型 | 大 4 / 中 2 / 小 1 |

来源：[Zombie – Minecraft Wiki](https://minecraft.wiki/w/Zombie)；[Skeleton – Minecraft Wiki](https://minecraft.wiki/w/Skeleton)；[Spider – Minecraft Wiki](https://minecraft.wiki/w/Spider)；[Creeper – Minecraft Wiki](https://minecraft.wiki/w/Creeper)；[Enderman – Minecraft Wiki](https://minecraft.wiki/w/Enderman)；[Slime – Minecraft Wiki](https://minecraft.wiki/w/Slime)。

- 补充：一只大型史莱姆连拆到底总共期望约 9 个粘液球、0–32 个（来源：[Slime – Minecraft Wiki](https://minecraft.wiki/w/Slime)）。
- 僵尸稀有掉落机制（Wiki 原文）：僵尸/尸壳/僵尸村民被玩家或驯服狼杀死时，各有 2.5%（1/40）机会掉落铁锭/胡萝卜/土豆三者之一，折合单项约 0.83%（1/120），抢夺每级 +1%（来源：[Carrot § Mob loot – Minecraft Wiki](https://minecraft.wiki/w/Carrot)）。

### 3.2 "玩家击杀"条件与抢夺（Looting）附魔

- **需玩家（或驯服狼）击杀才掉落的物品**：僵尸的稀有掉落（铁锭/胡萝卜/土豆）、蜘蛛的蜘蛛眼、小型史莱姆的粘液球，以及一切经验掉落（来源：各生物页注脚，同上）。
- **抢夺附魔**：Java 版表现为掉落数量上限每级 +1（如腐肉 0–2 → Looting III 0–5），并提高稀有掉落概率；Bedrock 版仅提高上限概率不提高数值（两版表格并列于各生物页）（来源：同上各页）。
- 苦力怕被骷髅箭射死掉唱片、被充能苦力怕炸死掉头颅，均与玩家击杀无关（来源：[Creeper – Minecraft Wiki](https://minecraft.wiki/w/Creeper)）。

### 3.3 动物掉落（Java 版）

| 动物 | 掉落（默认） | 火焰/火焰附加击杀 | 经验 |
| --- | --- | --- | --- |
| 牛 | 生牛肉 1–3 + 皮革 0–2（Looting 提升至 1–6 / 0–5） | 掉牛排（熟） | 1–3 |
| 羊 | 生羊肉 1–2 + **1 个对应颜色羊毛**（已剪毛的羊不掉羊毛） | 掉熟羊肉 | 1–3 |
| 鸡 | 生鸡肉 1 + 羽毛 0–2 | 掉熟鸡肉 | 1–3（鸡骑士 10） |
| 猪 | 生猪排 1–3 | 掉熟猪排 | 1–3 |

来源：[Cow – Minecraft Wiki](https://minecraft.wiki/w/Cow)；[Sheep – Minecraft Wiki](https://minecraft.wiki/w/Sheep)；[Chicken – Minecraft Wiki](https://minecraft.wiki/w/Chicken)；[Pig – Minecraft Wiki](https://minecraft.wiki/w/Pig)。

- 幼年动物（小牛/小猪/小鸡）**不掉任何物品和经验**（来源：[Cow](https://minecraft.wiki/w/Cow)、[Pig](https://minecraft.wiki/w/Pig)、[Chicken](https://minecraft.wiki/w/Chicken)）。
- 鸡每 5–10 分钟自然下蛋 1 个；抛出的蛋有 1/8 概率孵出小鸡（来源：[Chicken – Minecraft Wiki](https://minecraft.wiki/w/Chicken)）。

### 3.4 装备掉落逻辑

- 生物**捡起过的装备死亡时必定掉落**；**自然生成**的装备（含骷髅的弓）被玩家/驯服狼杀死时每件独立以 **8.5%** 掉落，抢夺 I/II/III 提升至 **9.5% / 10.5% / 11.5%**（来源：[Skeleton – Minecraft Wiki](https://minecraft.wiki/w/Skeleton)）。
- 带装备生成的生物每件装备额外掉 1–3 经验（来源：[Skeleton – Minecraft Wiki](https://minecraft.wiki/w/Skeleton)）。
- 末影人手持的方块 100% 掉落（来源：[Enderman – Minecraft Wiki](https://minecraft.wiki/w/Enderman)）。

---

## 4. 采集物（Gathering / Harvesting）

### 4.1 农作物与生长阶段（growth stages）

| 作物 | 生长阶段 | 成熟掉落（Java 版） | 备注 |
| --- | --- | --- | --- |
| 小麦 | **8 个阶段**（age 0–7，7 为成熟） | 1 小麦 + 1–4 种子（期望约 2 5⁄7 种）；未成熟只掉 1 种子 | 打碎草丛 12.5% 得 1 种子；时运提升种子数 |
| 胡萝卜 | **8 个阶段**（age 0–7，仅 4 种外观） | 2–5 胡萝卜（期望 3 5⁄7） | 2 个保底 + 3 次 57% 二项判定；时运每级 +1 次判定 |
| 土豆 | 与胡萝卜相同机制（8 阶段，4 外观） | 2–5 土豆（另有小概率毒土豆） | 参见土豆页 |
| 甜菜根 | **4 个阶段**（age 0–3） | 1 甜菜根 + 1–4 种子 | 种子亦可打草获得 |
| 甜浆果丛 | 4 个阶段（age 0–3） | 成熟采集 2–3 浆果、第 3 阶段 1–2，采集后回到第 2 阶段；直接破坏成熟丛掉 2–3 | 时运每级 +1；针叶林自然生成 |

来源：[Wheat Seeds – Minecraft Wiki](https://minecraft.wiki/w/Wheat_Seeds)；[Carrot – Minecraft Wiki](https://minecraft.wiki/w/Carrot)；[Potato – Minecraft Wiki](https://minecraft.wiki/w/Potato)；[Beetroot Seeds – Minecraft Wiki](https://minecraft.wiki/w/Beetroot_Seeds)；[Sweet Berries – Minecraft Wiki](https://minecraft.wiki/w/Sweet_Berries)。

- 共同生长条件：需光照 ≥9（JE 种植需 ≥8）；**耕地湿润加速生长**；**骨粉随机推进 2–5 个生长阶段**（小麦/胡萝卜页原文）（来源：[Wheat Seeds](https://minecraft.wiki/w/Wheat_Seeds)、[Carrot](https://minecraft.wiki/w/Carrot)）。
- 甜浆果丛还有防御属性：减缓并伤害进入的实体（狐狸免疫），可作天然陷阱（来源：[Sweet Berries – Minecraft Wiki](https://minecraft.wiki/w/Sweet_Berries)）。

### 4.2 树木

- **原木种类**：橡木、云杉、白桦、丛林、金合欢、深色橡木、红树、樱花、苍白橡木（1.21.4 加入），另有下界巨型菌与竹块（来源：[Leaves § Variants – Minecraft Wiki](https://minecraft.wiki/w/Leaves)；[Item – Minecraft Wiki](https://minecraft.wiki/w/Item)）。
- **树叶掉落概率**（徒手/工具破坏或自然枯萎；时运可提升）（来源：[Leaves § Breaking – Minecraft Wiki](https://minecraft.wiki/w/Leaves)）：

| 掉落物 | 来源 | 无时运 | 时运 III |
| --- | --- | --- | --- |
| 树苗 | 多数树叶 | **5%（1/20）** | 10%（1/10） |
| 树苗 | 丛林树叶 | 2.5%（1/40） | 4.17% |
| 木棍 1–2 | 所有树叶 | 2%（1/50） | 3.33% |
| 苹果 | 仅橡树/深色橡树树叶 | **0.5%（1/200）** | 0.833%（1/120） |

- 锄头是破坏树叶的默认正确工具；**剪刀或精准采集**才能获得树叶方块本身；烧炼树叶得叶地毯（新版本）（来源：[Leaves – Minecraft Wiki](https://minecraft.wiki/w/Leaves)）。
- **转化比例**：1 原木 → 4 木板；2 木板 → 4 木棍（这两个经典比例长期稳定，见 [Planks – Minecraft Wiki](https://minecraft.wiki/w/Planks)、[Stick – Minecraft Wiki](https://minecraft.wiki/w/Stick)；合成系统页亦说明木板/木棍可在 2×2 格内制作，来源：[Crafting – Minecraft Wiki](https://minecraft.wiki/w/Crafting)）。

### 4.3 其他采集物

- **甘蔗**：种在水边沙/土上，自然生长最高 3 格，逐节破坏整株掉落（参见 [Sugar Cane – Minecraft Wiki](https://minecraft.wiki/w/Sugar_Cane)）。
- **竹子**：生长最快的植物之一，可作燃料（0.25 件/个）与熊猫食物，自然最高可长到 12–16 格（参见 [Bamboo – Minecraft Wiki](https://minecraft.wiki/w/Bamboo)；燃料数值见 [Smelting § Fuel](https://minecraft.wiki/w/Smelting)）。
- **蘑菇**：小蘑菇可直接用手采集，在阴暗处可繁殖扩散，红/棕蘑菇各 1 个 + 木碗可做蘑菇煲（参见 [Mushroom – Minecraft Wiki](https://minecraft.wiki/w/Mushroom)；蘑菇煲配方见 [Carrot § Crafting ingredient](https://minecraft.wiki/w/Carrot) 兔子煲同款碗类配方）。
- **花朵**：徒手破坏即掉落自身，可用来做染料；对花朵使用骨粉可复制出更多花朵（参见 [Flower – Minecraft Wiki](https://minecraft.wiki/w/Flower)）。
- **浆果**：见 4.1 甜浆果丛；洞穴藤蔓（发光浆果）为同类可采集食物（参见 [Sweet Berries – Minecraft Wiki](https://minecraft.wiki/w/Sweet_Berries)）。

---

## 5. 合成系统（Crafting）

### 5.1 2×2 个人合成格 与 3×3 工作台

- 生存/冒险模式的玩家**物品栏自带 2×2 合成格**；最大 2×2 的配方（木板、木棍、工作台、火把等）可在此合成（来源：[Crafting § Manual crafting – Minecraft Wiki](https://minecraft.wiki/w/Crafting)）。
- **工作台**：用 4 块任意木板填满 2×2 格即可合成；放置并打开后提供 **3×3 合成格**，可合成游戏中全部配方；2×2 配方也能在 3×3 中完成（来源：[Crafting – Minecraft Wiki](https://minecraft.wiki/w/Crafting)）。
- Java 版创造/旁观模式的物品栏界面**没有** 2×2 合成格（来源：[Inventory – Minecraft Wiki](https://minecraft.wiki/w/Inventory)）。
- 1.21+ 加入**合成器（crafter）**可用漏斗+红石实现全自动合成（来源：[Crafting § Automated crafting – Minecraft Wiki](https://minecraft.wiki/w/Crafting)）。

### 5.2 有序合成（shaped）与无序合成（shapeless）

（来源：[Crafting § Manual crafting – Minecraft Wiki](https://minecraft.wiki/w/Crafting)）

- **无序配方**：材料可任意摆放，如发酵蛛眼。
- **有序配方**：材料必须保持正确的相对位置，但**可整体上下左右平移、可水平镜像，不可垂直翻转**。例：面包（3 小麦一排）可放在 3×3 的任意一行；弓的弦可在左侧也可在右侧。
- **固定配方（JE 不存在，仅 BE 旗帜图案等）**：位置完全固定，JE 只能靠数据包添加。
- 实例（见各物品页）：
  - 镐（shaped）：顶部一行 3 材料 + 中下 2 木棍（来源：[Pickaxe § Crafting – Minecraft Wiki](https://minecraft.wiki/w/Pickaxe)）；
  - 火把：煤/木炭 + 木棍 → **4 支火把**（来源：[Torch § Crafting – Minecraft Wiki](https://minecraft.wiki/w/Torch)）；
  - 打火石（shapeless 示例，配方 JSON 文档直接以其为例）：铁锭 + 燧石（来源：[Recipe (Java Edition) § crafting_shapeless](https://minecraft.wiki/w/Recipe_(Java_Edition))）。

### 5.3 烧炼（Smelting）配方举例

（来源：[Smelting § Recipes – Minecraft Wiki](https://minecraft.wiki/w/Smelting)）

| 产物 | 原料 | 经验 |
| --- | --- | --- |
| 铁锭 | 铁矿石 / 粗铁 | 0.7 |
| 铜锭 | 铜矿石 / 粗铜 | 0.7 |
| 金锭 | 金矿石 / 粗金 / 下界金矿 | 1.0 |
| 木炭 | 任意原木 | 0.15 |
| 石头 | 圆石 | 0.1 |
| 熟食系列 | 生牛肉→牛排、生猪排→熟猪排、生鸡肉→熟鸡肉、生羊肉→熟羊肉、土豆→烤土豆（均 0.35） | 0.35 |

- 熔炉 3 槽位：左上原料、左下燃料、右输出；高炉只烧矿石类、烟熏炉只烹食物，速度 2 倍（来源：[Smelting § Methods](https://minecraft.wiki/w/Smelting)）。

### 5.4 常见工具配方材料数量

- **镐 = 3 材料 + 2 木棍**（Wiki 原文明确："crafted using two sticks and three of the tier's material"；木质可用任意木板、石质可用圆石/黑石/深板岩圆石互换）（来源：[Pickaxe § Crafting – Minecraft Wiki](https://minecraft.wiki/w/Pickaxe)）。
- **斧 = 3 材料 + 2 木棍；锹 = 1 材料 + 2 木棍；锄 = 2 材料 + 2 木棍；剑 = 2 材料 + 1 木棍**（标准工具配方，见工具配方总表；来源：[Crafting/Tools – Minecraft Wiki](https://minecraft.wiki/w/Crafting/Tools)、[Sword – Minecraft Wiki](https://minecraft.wiki/w/Sword)）。
- 下界合金工具**不能直接合成**：需在锻造台用"下界合金升级模板 + 钻石工具 + 下界合金锭"升级（来源：[Pickaxe § Smithing – Minecraft Wiki](https://minecraft.wiki/w/Pickaxe)）。

### 5.5 食物与基础方块配方

- **面包 = 3 小麦**（一行有序配方；Wiki 历史表注明"由 6 小麦改为 3 小麦"）（来源：[Crafting § Changed recipes – Minecraft Wiki](https://minecraft.wiki/w/Crafting)）。
- **蛋糕 = 3 牛奶 + 3 小麦 + 2 糖 + 1 鸡蛋**（配方 JSON 官方示例，见 5.6）（来源：[Recipe (Java Edition) § crafting_shaped](https://minecraft.wiki/w/Recipe_(Java_Edition))）。
- **熔炉 = 8 个"石类"方块**（圆石/黑石/深板岩圆石围成一圈；注意**不需要煤炭**——用户提纲中"8 圆石 + 煤炭"的煤炭一项并不存在）（来源：[Furnace § Crafting – Minecraft Wiki](https://minecraft.wiki/w/Furnace)）。
- **工作台 = 4 任意木板**（2×2 满格）（来源：[Crafting – Minecraft Wiki](https://minecraft.wiki/w/Crafting)）。

### 5.6 配方的 JSON 格式（1.20+ 数据包，当前版本）

配方以 JSON 存于数据包 `data/<namespace>/recipe/*.json`，所有配方根节点都有 `type` 字段；可用类型包括 `crafting_shaped`、`crafting_shapeless`、`smelting`、`blasting`、`smoking`、`campfire_cooking`、`stonecutting`、`smithing_transform` 等（来源：[Recipe (Java Edition) § JSON format](https://minecraft.wiki/w/Recipe_(Java_Edition))）。

**有序合成示例（蛋糕，官方文档示例）**：

```json
{
  "type": "minecraft:crafting_shaped",
  "category": "misc",
  "key": {
    "A": "minecraft:milk_bucket",
    "B": "minecraft:sugar",
    "C": "minecraft:wheat",
    "E": "#minecraft:eggs"
  },
  "pattern": [
    "AAA",
    "BEB",
    "CCC"
  ],
  "result": {
    "count": 1,
    "id": "minecraft:cake"
  }
}
```

**无序合成示例（打火石，官方文档示例）**：

```json
{
  "type": "minecraft:crafting_shapeless",
  "category": "equipment",
  "ingredients": [
    "minecraft:iron_ingot",
    "minecraft:flint"
  ],
  "result": {
    "count": 1,
    "id": "minecraft:flint_and_steel"
  }
}
```

**烧炼示例（裂纹石砖，官方文档示例）**：

```json
{
  "type": "minecraft:smelting",
  "category": "blocks",
  "cookingtime": 200,
  "experience": 0.1,
  "ingredient": "minecraft:stone_bricks",
  "result": {
    "id": "minecraft:cracked_stone_bricks"
  }
}
```

- 字段要点：`pattern` 每行 ≤3 字符、空格代表空位；`key` 值可为物品 ID、`#`开头的标签或 ID 数组；`result` 使用 **`id`**（1.20.5 起由旧 `item` 字段改为 `id`，可为字符串或对象带 `count`/`components`）；`smelting` 的 `cookingtime` 默认 200 ticks、`blasting` 默认 100（来源：[Recipe (Java Edition)](https://minecraft.wiki/w/Recipe_(Java_Edition))）。
- 配方解锁后进入配方书；数据包同 ID 配方可覆盖原版配方（来源：[Recipe (Java Edition) § Obtaining](https://minecraft.wiki/w/Recipe_(Java_Edition))）。

---

## 6. 物品栏 / 背包系统

- **玩家物品栏构成**：4 个盔甲槽 + **27 个主储物槽 + 9 个快捷栏槽**（即通常所说的"36 格"）+ 1 个**副手槽**（Java 版按 F 在快捷栏与副手间切换），外加 2×2 合成格（来源：[Inventory § Slots – Minecraft Wiki](https://minecraft.wiki/w/Inventory)）。
- 快捷栏用数字键 1–9 或滚轮选择；盔甲只有放进盔甲槽才算"穿戴"并生效（来源：[Inventory – Minecraft Wiki](https://minecraft.wiki/w/Inventory)）。
- 悬停显示物品 Tooltip；`F3+H` 显示额外调试信息（ID 等）（来源：[Inventory – Minecraft Wiki](https://minecraft.wiki/w/Inventory)）。
- **创造模式 vs 生存模式**：创造模式物品栏是包含生存全部物品（外加若干生存不可得物品）的**物品选取菜单**，按分类分页（Java/Bedrock 页签不同）；创造模式还保留一个"生存物品栏"页签；Java 版创造模式物品栏界面无 2×2 合成格（来源：[Inventory § Creative inventory](https://minecraft.wiki/w/Inventory)）。
- 死亡掉落可通过游戏规则 `keepInventory` 保留（来源：[Inventory § History](https://minecraft.wiki/w/Inventory)）。

---

## 7. 主要参考来源汇总（均为 Minecraft Wiki，minecraft.wiki）

| 主题 | URL |
| --- | --- |
| 物品/堆叠/掉落物实体 | https://minecraft.wiki/w/Item |
| 命名空间标识符 | https://minecraft.wiki/w/Identifier |
| 稀有度 | https://minecraft.wiki/w/Rarity |
| 工具等级/耐久/挖掘等级 | https://minecraft.wiki/w/Tiers |
| 镐（配方/数值） | https://minecraft.wiki/w/Pickaxe |
| 矿物分布与掉落 | https://minecraft.wiki/w/Ore |
| 烧炼与燃料 | https://minecraft.wiki/w/Smelting |
| 熔炉 | https://minecraft.wiki/w/Furnace |
| 合成系统 | https://minecraft.wiki/w/Crafting |
| 工具配方总表 | https://minecraft.wiki/w/Crafting/Tools |
| 配方 JSON 格式 | https://minecraft.wiki/w/Recipe_(Java_Edition) |
| 火把 | https://minecraft.wiki/w/Torch |
| 物品栏 | https://minecraft.wiki/w/Inventory |
| 僵尸/骷髅/蜘蛛/苦力怕/末影人/史莱姆 | https://minecraft.wiki/w/Zombie 、/Skeleton 、/Spider 、/Creeper 、/Enderman 、/Slime |
| 牛/羊/鸡/猪 | https://minecraft.wiki/w/Cow 、/Sheep 、/Chicken 、/Pig |
| 小麦种子/胡萝卜/土豆/甜菜根种子 | https://minecraft.wiki/w/Wheat_Seeds 、/Carrot 、/Potato 、/Beetroot_Seeds |
| 树叶 | https://minecraft.wiki/w/Leaves |
| 甜浆果 | https://minecraft.wiki/w/Sweet_Berries |
| 木板/木棍/剑 | https://minecraft.wiki/w/Planks 、/Stick 、/Sword |
| 甘蔗/竹子/蘑菇/花 | https://minecraft.wiki/w/Sugar_Cane 、/Bamboo 、/Mushroom 、/Flower |

> **数据核验提示**：文中概率/数值均逐条取自上述页面（2026-10-22 抓取）。少数条目（土豆、甜菜根、甘蔗、竹子、蘑菇、花的细节数值）为页面通用常识性描述，已在正文以"参见"标注对应 URL，如需写入正式设计文档建议再逐页核对当日版本。
