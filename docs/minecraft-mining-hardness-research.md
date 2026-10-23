# Minecraft（Java 版）方块硬度 / 破坏速度 / 工具分级调研报告

> **调研说明**
> - 调研日期：2026-10-23。数值与公式逐条抓取自第一手权威来源 **Minecraft Wiki**（[minecraft.wiki](https://minecraft.wiki)，Weird Gloop 托管的 wiki.gg 系社区 Wiki），并交叉核对了 **Mojang 官方映射（Mojang Mappings）反编译源码的公开镜像仓库**（MCFireworkDev/MinecraftDeobfuscated-Mojang）。未使用任何二手博客。
> - 版本口径：Wiki 当前反映最新 Java 版（抓取时为 26.x，即 1.21.x 之后；铜质工具为 1.21.9 加入、矛为 1.21.11 加入）。**本报告对标 1.20+**：工具分级按 木/石/铁/钻/下界合金（+金）六系，铜/矛仅作脚注。核心破坏公式自 1.13 前后定型，1.20.x–1.21.x 数值口径一致；版本差异处文中单独标注（如 1.21.2 起水中惩罚改走属性、1.20.5 起工具速度迁入数据组件）。
> - 本文所有耗时数值除特别说明外均为 **Java 版（JE）**、玩家站在地面、头部不在水中、无药水效果、无附魔的口径；带 * 的数值表示"该工具品类正确但等级不足"——**能破坏、但无掉落**的耗时。
> - 本报告服务于本项目（6 岁儿童注意力训练体素游戏）后续实现参考，**不涉及任何代码改动**。

---

## 1. 破坏时间公式

### 1.1 基础规则

- 按住破坏键时，工具每游戏刻（1/20 秒）对方块造成一次"伤害"，累计到 1.0 方块破坏；裂纹动画即进度的可视化（来源: [Breaking § Basics of breaking](https://minecraft.wiki/w/Breaking)）。
- 触达距离：JE 生存 4.5 格、创造 5.2 格（来源: [Breaking § Basics of breaking](https://minecraft.wiki/w/Breaking)）。
- 换目标方块或松开按键会**清零进度**；移动、跳跃、游泳中可继续挖，但有速度惩罚（见 §6）（来源: [Breaking § Basics of breaking](https://minecraft.wiki/w/Breaking)）。
- 每个方块有 hardness（硬度）值；硬度 -1 表示不可破坏（基岩等，进度恒为 0），硬度 0 表示瞬间破坏（TNT 等）（来源: [Breaking § Blocks by hardness](https://minecraft.wiki/w/Breaking)）。
- "基础耗时"= 硬度 × 1.5（当前工具**能采集**该方块时）或 硬度 × 5（**不能采集**时）（来源: [Breaking § Mining efficiency](https://minecraft.wiki/w/Breaking)）。

### 1.2 每刻伤害公式（总公式）

Wiki 给出的 JE 完整口径（来源: [Breaking § Calculation](https://minecraft.wiki/w/Breaking)，伪代码与映射源码逐行对应，见 §8）：

```
speed = 工具对该方块的有效速度（品类不匹配 = 1，徒手 = 1）
if (speed > 1 且有效率附魔):  speed += 效率等级² + 1
if (急迫 或 潮涌能量):        speed *= 1 + 0.2 × max(急迫等级, 潮涌等级)   // JE
if (挖掘疲劳):                speed *= 0.3^min(疲劳等级, 4)               // JE，等级 I–IV 实为硬编码 0.3/0.09/0.0027/0.00081
if (头部在水下 且 无水中亲和): speed /= 5
if (双脚不在地面):            speed /= 5

damage(每刻伤害) = speed / hardness / (canHarvest ? 30 : 100)

hardness = -1  → 永不破坏（进度恒 0）
hardness = 0   → 瞬间破坏
damage >= 1    → 瞬间破坏（0 tick）
否则: ticks = ceil(1 / damage);  seconds = ticks / 20
```

要点：

- **×1.5 / ×5 的本质**不是两个独立系数，而是每刻伤害分母 30 与 100 的区别：能采集时 30 tick（1.5 秒）的"满速度基线"，不能采集时 100 tick（5 秒）（来源: [Breaking § Mining efficiency](https://minecraft.wiki/w/Breaking)；源码 `getDestroyProgress` 见 §8）。
- `canHarvest`（能否采集）由两层条件决定：方块是否声明"需要正确工具才掉落" + 手持工具的品类/等级是否达标（详见 §4、§5）。
- **总耗时恒为 1/20 秒的整数倍**（向上取整到下一游戏刻）（来源: [Breaking § Mining efficiency](https://minecraft.wiki/w/Breaking)）。
- JE 若干官方数值比理论值多 1 tick（如黑曜石徒手 250.05s 而非 250s），是浮点进度先差一点不到 1.0、下一刻才判定的既定行为；Wiki 硬度表如实按 JE 标注（来源: [Breaking § Blocks by hardness](https://minecraft.wiki/w/Breaking)）。
- 瞬时破坏门槛：速度值直接 ≥ 硬度×30 即 0 延迟；否则破坏一个方块后到开始挖下一个之间有 6 tick（0.3 秒）间隔，但**耗时 ≤0.05s 的方块豁免该间隔**（来源: [Breaking § Instant breaking](https://minecraft.wiki/w/Breaking)）。

### 1.3 手工验算示例

（公式来源: [Breaking § Calculation](https://minecraft.wiki/w/Breaking)；数值与 Wiki 硬度表一致）

| 场景 | 代入 | 结果 |
| --- | --- | --- |
| **徒手挖石头**（硬度 1.5，石头需镐才掉落 → canHarvest=false） | damage = 1 / 1.5 / 100 = 1/150 | 150 ticks = **7.5s**（Wiki 表值 7.5 ✓） |
| **木镐挖石头**（速度 2，等级 0 ≥ 需求 0 → canHarvest=true） | damage = 2 / 1.5 / 30 = 2/45 ≈ 0.0444 | ticks = ceil(22.5) = 23 → **1.15s**（Wiki 表值 1.15 ✓） |
| 木镐挖铁矿石（硬度 3，需石镐 → 等级不足，canHarvest=false，但**速度仍生效**） | damage = 2 / 3 / 100 = 1/150 | 150 ticks = **7.5s，不掉落**（Wiki 表值 7.5 ✓） |
| 铁镐挖钻石矿石（硬度 3，速度 6，canHarvest=true） | damage = 6/90 ≈ 0.0667 | 15 ticks = **0.75s**（Wiki 表值 0.75 ✓） |
| 钻石镐挖黑曜石（硬度 50，速度 8） | damage = 8/1500 ≈ 0.00533 | ceil(187.5)=188 ticks = **9.4s**（Wiki 表值 9.4 ✓） |
| 徒手挖黑曜石 | damage = 1/5000 | 5000 ticks = **250s**（Wiki 表值 JE 250.05 ✓） |
| 钻镐+效率 V+急迫 II 挖石头 | speed=(8+26)×1.4=47.6 ≥ 1.5×30=45 | **瞬间破坏**（Wiki 例题 ✓） |

### 1.4 与 Bedrock 版的关键差异（易混点）

BE 伪代码里 `if (not canHarvest): speedMultiplier = 1`——即 BE 在不能采集时**把工具速度乘数整个归 1**；JE 则保留工具速度、只是分母 30→100（来源: [Breaking § Calculation](https://minecraft.wiki/w/Breaking) 两版伪代码并列）。所以"木镐挖铁矿"在 JE 是 7.5s（比徒手 15s 快），在 BE 是 15s（与徒手相同）。本报告以 JE 为准。

---

## 2. 工具速度乘数（挖掘效率）

### 2.1 分级乘数表

（来源: [Breaking § Mining efficiency](https://minecraft.wiki/w/Breaking) 速度表；[Tiers](https://minecraft.wiki/w/Tiers)；[Pickaxe](https://minecraft.wiki/w/Pickaxe)；源码 `DiggerItem.getDestroySpeed = tier.getSpeed()` 见 §8）

| 工具材质 | 速度乘数 | 挖掘等级 | 耐久度（JE） |
| --- | --- | --- | --- |
| 徒手 / 任意非工具物品 | 1 | — | — |
| 木 Wooden | 2 | 0 | 59 |
| 石 Stone | 4 | 1 | 131 |
| 铜 Copper（1.21.9+） | 5 | 1 | 190 |
| 铁 Iron | 6 | 2 | 250 |
| 钻石 Diamond | 8 | 3 | 1561 |
| 下界合金 Netherite | 9 | 4 | 2031 |
| 金 Golden | **12** | **0** | 32 |

注意两个反直觉点：**金的挖掘等级与木同为 0**（挖不动铁矿石）但速度全场最高；**下界合金速度是 9 不是 12**。同一材质的镐/斧/锹/锄共享同一速度乘数（源码层面统一为 `tier.getSpeed()`，见 §8）。

### 2.2 效率附魔与急迫（简述，本项目无附魔）

- 效率 Efficiency：当且仅当工具对该方块速度 > 1（品类正确）时，速度额外 `+ 等级² + 1`（效率 I +2，V +26）（来源: [Breaking § Mining efficiency](https://minecraft.wiki/w/Breaking)；源码 `if (f > 1.0F) f += i*i+1` 见 §8）。
- 急迫 Haste / 潮涌能量 Conduit Power（JE）：每级 +20%，即 `×(1 + 0.2×等级)`；信标最高急迫 II = ×1.4（来源: [Haste § Effect](https://minecraft.wiki/w/Haste)）。
- 挖掘疲劳 Mining Fatigue（JE）：×0.3^min(等级,4)，等级 I–IV 实际硬编码 0.3 / 0.09 / 0.0027 / 0.00081（来源: [Breaking § Calculation](https://minecraft.wiki/w/Breaking)）。

---

## 3. 工具品类匹配（"正确工具"）

### 3.1 各品类的适用方块类

（来源: [Breaking § Best tools](https://minecraft.wiki/w/Breaking)，按材质分组的大表；工具页 [Pickaxe](https://minecraft.wiki/w/Pickaxe) 等）

| 工具 | 主要方块类（常见例子） |
| --- | --- |
| **镐 Pickaxe** | 岩石 I 类：石头/圆石/砂岩/各类深板岩/混凝土/下界岩…；矿石类；金属类（铁块/铜块/钻石块…）；冰；铁质构件（铁门/铁栏杆/漏斗/铁砧/灯笼…） |
| **斧 Axe** | 木材类：原木/木板/木台阶楼梯/木门/木牌/栅栏/木按钮…；工作台/箱子/木桶/制图台/织布机/锻造台/讲台/唱片机/营火/书架；植物类：南瓜/西瓜/可可/藤蔓（藤蔓需剪刀采集）；蜂巢类 |
| **锹 Shovel** | 地面类：泥土/沙子/沙砾/黏土/耕 地/草方块/菌丝/灰化土/灵魂沙/混凝土粉末/雪层/雪块… |
| **锄 Hoe** | 植物与真菌类（1.16/20w09a 起）：**树叶**、干草块、苔块、菌丝体类、海绵、标靶、sculk 系列、下界疣块…（锄是树叶的品类工具，铁锄+即达瞬破阈值） |
| **剑 Sword** | 蛛网、竹子（对其他方块仅通用 ×1.5，见 3.3） |
| **剪刀 Shears** | 树叶、羊毛、蛛网、藤蔓/苔藓/枯灌木等植物（采集获得本体） |

### 3.2 用错工具的后果

- **品类不匹配 = 速度 ×1（无加成），没有额外的"惩罚乘数"**（源码 `blockState.is(this.blocks) ? this.speed : 1.0F`，见 §8）。
- 但若方块声明了"需要正确工具才掉落"（石头类几乎都是），则 canHarvest=false，每刻伤害分母从 30 变 100 → 耗时相当于 硬度×5。即"惩罚"来自掉落门禁，不来自速度本身（来源: [Breaking § Mining efficiency](https://minecraft.wiki/w/Breaking)）。
- 因此：**斧挖石头 7.5s**（速度 1 + 分母 100，与徒手相同）；**镐挖泥土 0.75s**（速度 1，但泥土无掉落门禁 → 分母 30）；**木镐挖铁矿石 7.5s**（速度 2 生效，分母 100，为徒手 15s 的一半）。

### 3.3 剪刀与剑的特殊速度

（来源: [Breaking § Mining efficiency](https://minecraft.wiki/w/Breaking) 速度表；[Shears § Breaking blocks](https://minecraft.wiki/w/Shears)；[Sword](https://minecraft.wiki/w/Sword)）

| 工具 × 方块 | 速度乘数 | 实测耗时 |
| --- | --- | --- |
| 剪刀（通用） | 2 | — |
| 剪刀 × 羊毛（硬度 0.8） | 5 | 徒手 1.2s → 剪刀 **0.25s** |
| 剪刀 × 树叶 / 蛛网 | 15 | 树叶 **0.05s**、蛛网 **0.4s** |
| 剑（通用，所有方块） | 1.5 | 比徒手略快 |
| 剑 × 蛛网（硬度 4） | 15 | **0.4s**（与剪刀同速，掉线而非蛛网） |
| 剑 × 竹子 | 30 | 瞬时（剑每砍一根竹耐久 -2） |

---

## 4. 工具等级门禁（tier gating / 挖掘等级）

### 4.1 等级数值与门槛标签

挖掘等级（mining level）是镐的内部数值，通过方块标签实现门禁（来源: [Tiers § Mining level](https://minecraft.wiki/w/Tiers)）：

| 标签 | 要求等级 ≥ | 对应镐 |
| --- | --- | --- |
| （无标签） | 0 | 木镐、金镐即可 |
| `minecraft:needs_stone_tool` | 1 | 石镐（及铜镐 1.21.9+） |
| `minecraft:needs_iron_tool` | 2 | 铁镐 |
| `minecraft:needs_diamond_tool` | 3 | 钻石镐 |
| `minecraft:needs_netherite_tool` | 4 | **原版未使用**（下界合金镐等级 4 但无方块要求） |

### 4.2 完整门槛清单

（来源: [Tiers § Mining level 脚注](https://minecraft.wiki/w/Tiers) 列出的标签成员；[Breaking § Best tools](https://minecraft.wiki/w/Breaking) 的 Rock/Metal 分组）

- **等级 0（任何镐，含木/金）**：石头、圆石、砂岩、凝灰岩、末地石、下界岩、煤矿石、下界金矿石、下界石英矿石、深板岩煤矿；金属 I 类（铁砧、钟、潜影盒、铁门/栏杆/活板门、灯笼、红石块、酿造台、炼药锅、漏斗）；冰（另需精准采集才掉落）。
- **等级 1（石镐+）**：铁矿石、铜矿石、青金石矿石及三者的深板岩变体；金属 II 类（铁块、生铁块、铜块、生铜块、切铜系列、避雷针、青金石块）。
- **等级 2（铁镐+）**：钻石矿石、绿宝石矿石、金矿石、红石矿石及四者的深板岩变体；金属 III 类（钻石块、绿宝石块、金块、生金块）。
- **等级 3（钻石镐+）**：黑曜石、哭泣黑曜石、远古残骸、下界合金块、重生锚（+BE 的发光黑曜石）。
- **唯一非镐的掉落门禁：雪层/雪块需要锹**才会掉雪球（来源: [Breaking § Best tools](https://minecraft.wiki/w/Breaking) Shovel/Snow 行；[Breaking § Basics](https://minecraft.wiki/w/Breaking) "with the exception of snow and snow blocks"）。

### 4.3 等级不足时的行为（三问三答）

以木镐挖铁矿石为例（来源: [Breaking](https://minecraft.wiki/w/Breaking) 全页公式与硬度表；源码见 §8）：

1. **能否破坏？能。** MC 没有"等级不足就挖不动"的设定；只要硬度 ≠ -1，任何方块都能被任何工具（含徒手）破坏，进度照常累计。
2. **破坏后掉不掉？不掉。** `isCorrectToolForDrops` 返回 false → 方块消失但无掉落物（矿石被"白白挖掉"）。
3. **速度有无惩罚？有，但不是"归零"。** JE 保留工具速度乘数（木镐仍是 ×2），只是每刻伤害分母 30→100：木镐挖铁矿 7.5s（徒手 15s 的一半）。BE 才会把速度乘数归 1（见 §1.4）。

### 4.4 "×1/3 惩罚"说法核实

社区常传"等级不足时破坏速度 ×1/3"。核实结论（来源: [Breaking § Calculation](https://minecraft.wiki/w/Breaking)）：

- 精确值是 **0.3 = 3/10，不是 1/3**。来源是分母 30 vs 100（30/100 = 0.3），换算成耗时是 ×10/3 ≈ 3.33 倍。
- 且它不是独立的"惩罚乘数"，而是 canHarvest=false 时的分母切换；同时生效的还有"JE 保留工具速度"这一细节——所以对高等级工具而言，实际耗时差距不止 3.33 倍（如石镐挖钻石矿 3.75s vs 铁镐 0.75s，差 5 倍，因为速度 4 vs 6 也变了）。

---

## 5. requiresCorrectToolForDrops（掉落门禁）与掉落物规则

### 5.1 两层门禁机制

（来源: 映射源码，见 §8；[Breaking § Best tools](https://minecraft.wiki/w/Breaking) 各组注释）

- 方块声明 `requiresCorrectToolForDrops`（代码里的布尔属性，即社区说的 "toolRequired"）：
  - **声明了**（石头/圆石/矿石/金属/冰…）：必须"品类对 + 等级够"才有掉落。例：石头必须任何镐；铁矿石必须石镐及以上。
  - **未声明**（泥土、沙、沙砾、原木、木板、树叶、羊毛、玻璃、TNT、工作台、箱子…）：任何方式破坏都有掉落（各自对应的掉落物）。
- 判定链（源码）：`Player.hasCorrectToolForDrops(state) = !state.requiresCorrectToolForDrops() || 手持物.isCorrectToolForDrops(state)`；后者 = 等级标签检查（§4.1）**且** 方块在该工具的适用方块标签里（`blockState.is(this.blocks)`）。品类与等级**同时**达标才算"正确工具"。

### 5.2 常见方块的掉落口径

（来源: [Breaking § Best tools](https://minecraft.wiki/w/Breaking) 各行 Notes；硬度表脚注）

| 方块 | 徒手/错工具破坏 | 正确工具破坏 |
| --- | --- | --- |
| 泥土/沙/沙砾/原木/木板/工作台/箱子 | 照常掉自身 | 照常掉自身（工具只影响速度） |
| 石头 | **无掉落** | 掉**圆石**（精准采集才掉石头本身） |
| 煤矿石 | 无掉落 | 掉**煤**（非精准采集；精准采集才掉矿石本身，铁矿/钻石矿同理掉原矿） |
| 草方块 | 掉**泥土**（非精准采集） | 掉泥土 |
| 沙砾 | 照常破坏 | 90% 掉沙砾、10% 掉燧石 |
| 树叶 | 掉树苗/木棍（橡树 0.5% 苹果） | **剪刀或精准采集才掉树叶本身**；锄只加速，不掉树叶 |
| 玻璃 | **无掉落**（任何方式，除精准采集） | 同左 |
| 羊毛 | 掉自身（任何方式） | 掉自身（剪刀只加速） |
| 蛛网 | 无掉落 | **剑破坏掉线**；剪刀或精准采集掉蛛网本身 |
| 雪层/雪块 | 无掉落 | **锹**破坏掉雪球（精准采集锹才掉方块本身） |
| TNT | 瞬时破坏，掉自身 | 同左（无工具要求） |

---

## 6. 环境修正

（来源: [Breaking § Mining efficiency](https://minecraft.wiki/w/Breaking)；[Haste § Effect](https://minecraft.wiki/w/Haste)；源码 `Player.getDestroySpeed` 见 §8）

| 修正 | 条件 | 效果 | 公式中的位置 |
| --- | --- | --- | --- |
| 水下 | 头部（眼睛）在水中且头盔无水中亲和附魔 | 速度 **÷5** | 速度侧乘区，先于地面判定（1.21.2 起改为属性 `submerged_mining_speed`，默认 0.2，数值等价） |
| 悬空 | 双脚不踩地面（跳跃、飞行、游泳中） | 速度 **÷5** | 速度侧最后一个乘区 |
| 水中+悬空叠加 | 浮在水中挖 | ÷5 × ÷5 = **÷25** | 两个独立乘区直接叠乘 |
| 急迫/潮涌能量 | 有状态效果 | ×(1 + 0.2×等级)，每级 +20% | 速度侧乘区（在效率加成之后） |
| 挖掘疲劳 | 有状态效果 | ×0.3^min(等级,4) | 速度侧乘区 |

顺序（JE 源码）：工具速度 → 效率加成（仅速度>1 时）→ 急迫 → 疲劳 → 水下 → 悬空，全部乘完得到最终 speed，再进入每刻伤害公式。

---

## 7. 数值总表：常见方块 × 工具耗时矩阵

数据列：硬度、正确工具、掉落所需最低等级、各工具实际破坏耗时（秒，JE，站在地面/无水/无药水）。耗时列引自 Wiki 硬度表（来源: [Breaking § Blocks by hardness](https://minecraft.wiki/w/Breaking)，表中数值由 hardness 与 §1.2 公式生成，已逐项抽验）；**带 * = 品类对但等级不足：可破坏、无掉落**；（瞬）= 瞬时破坏档（速度 ≥ 硬度×30，0 延迟并豁免 0.3s 连挖间隔；铁锄挖树叶恰好踩在阈值 speed 6 = 0.2×30 上）。

| 方块 | 硬度 | 正确工具 | 掉落门槛 | 徒手 | 木 | 石 | 铁 | 钻 | 特殊工具 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 泥土 | 0.5 | 锹 | 无 | 0.75 | 0.4 | 0.2 | 0.15 | 0.1 | |
| 草方块 | 0.6 | 锹 | 无（掉泥土） | 0.9 | 0.45 | 0.25 | 0.15 | 0.15 | |
| 沙子 | 0.5 | 锹 | 无 | 0.75 | 0.4 | 0.2 | 0.15 | 0.1 | |
| 沙砾 | 0.6 | 锹 | 无 | 0.9 | 0.45 | 0.25 | 0.15 | 0.15 | 10% 掉燧石 |
| 石头 | 1.5 | 镐 | 木镐 | 7.5 | 1.15 | 0.6 | 0.4 | 0.3 | 掉圆石 |
| 圆石 | 2 | 镐 | 木镐 | 10.05 | 1.5 | 0.75 | 0.5 | 0.4 | |
| 煤矿石 | 3 | 镐 | 木镐 | 15 | 2.25 | 1.15 | 0.75 | 0.6 | 掉煤 |
| 铁矿石 | 3 | 镐 | 石镐 | 15 | 7.5* | 1.15 | 0.75 | 0.6 | 掉粗铁 |
| 钻石矿石 | 3 | 镐 | 铁镐 | 15 | 7.5* | 3.75* | 0.75 | 0.6 | 掉钻石 |
| 黑曜石 | 50 | 镐 | 钻镐 | 250.05 | 125.05* | 62.55* | 41.7* | 9.4 | 金镐 20.85*、下界合金镐 8.35 |
| 原木 | 2 | 斧 | 无 | 3 | 1.5 | 0.75 | 0.5 | 0.4 | |
| 木板 | 2 | 斧 | 无 | 3 | 1.5 | 0.75 | 0.5 | 0.4 | |
| 树叶 | 0.2 | 锄 | 无（掉树苗） | 0.3 | 0.15⁽ʰᵒᵉ⁾ | 0.1⁽ʰᵒᵉ⁾ | 0.05（瞬）⁽ʰᵒᵉ⁾ | 0.05（瞬）⁽ʰᵒᵉ⁾ | **剪刀 0.05（并掉树叶）、剑 0.2** |
| 玻璃 | 0.3 | 无 | 无（不掉落） | 0.45 | 0.45 | 0.45 | 0.45 | 0.45 | 无任何工具加成 |
| 羊毛 | 0.8 | 剪刀 | 无 | 1.2 | 1.2 | 1.2 | 1.2 | 1.2 | **剪刀 0.25** |
| 蛛网 | 4 | 剪刀/剑 | 剑（掉线）或剪刀 | 20.05 | 20.05 | 20.05 | 20.05 | 20.05 | **剪刀 0.4、剑 0.4** |
| TNT | 0 | 无 | 无 | 瞬 | 瞬 | 瞬 | 瞬 | 瞬 | 掉自身 |
| 工作台 | 2.5 | 斧 | 无 | 3.75 | 1.9 | 0.95 | 0.65 | 0.5 | |
| 熔炉 | 3.5 | 镐 | 木镐 | 17.5 | 2.65 | 1.35 | 0.9 | 0.7 | |
| 箱子 | 2.5 | 斧 | 无 | 3.75 | 1.9 | 0.95 | 0.65 | 0.5 | |
| 雪块 | 0.2 | 锹 | 木锹（掉雪球） | 1 | 0.15 | 0.1 | 0.05（瞬） | 0.05（瞬） | |
| 雪层 | 0.1 | 锹 | 木锹（掉雪球） | 0.5 | 0.1 | 0.05（瞬） | 0.05（瞬） | 0.05（瞬） | |

补充对照（同表来源）：金镐速度 12 但等级 0，挖铁矿 1.3*、挖钻石矿 1.3*、挖黑曜石 20.85*；下界合金镐挖石头 0.25s、黑曜石 8.35s；深板岩矿石硬度 4.5（普通矿石 3），如深板岩铁矿石石镐 1.7s。

---

## 8. 1.20+ 的 canHarvest 判定口径（映射源码核实）

来源：Mojang 官方映射反编译的公开镜像 [MCFireworkDev/MinecraftDeobfuscated-Mojang（snapshot 分支）](https://github.com/MCFireworkDev/MinecraftDeobfuscated-Mojang)。该镜像未标注精确版本，按类签名推断为 **1.20.4/1.20.5 期**（`ItemInteractionResult`、属性持有者化、`isCorrectToolForDrops` 命名均为 1.20.2–1.20.5 特征）；下列逻辑在 1.20.1–1.21.x 稳定（差异见本节末尾）。文件路径前缀 `minecraft/src/net/minecraft/`。

**① 每刻伤害** — [`world/level/block/state/BlockBehaviour.java`](https://github.com/MCFireworkDev/MinecraftDeobfuscated-Mojang/blob/snapshot/minecraft/src/net/minecraft/world/level/block/state/BlockBehaviour.java)：

```java
public float getDestroyProgress(BlockState blockState, Player player, ...) {
    float f = blockState.getDestroySpeed(blockGetter, blockPos);   // = destroyTime（即硬度）
    if (f == -1.0F) {
        return 0.0F;                                              // 硬度 -1 → 永不破坏
    } else {
        int i = player.hasCorrectToolForDrops(blockState) ? 30 : 100;
        return player.getDestroySpeed(blockState) / f / (float)i; // 每刻伤害 = 速度 / 硬度 / (30|100)
    }
}
```

硬度即 `Properties.destroyTime`，由方块声明 `strength(硬度, 爆炸抗性)` 写入；`instabreak()` = `strength(0)`。`BlockStateBase.getDestroySpeed()` 直接返回该值，没有额外计算（即不存在 Wiki 之外的隐藏系数）。

**② canHarvest 判定** — [`world/entity/player/Player.java`](https://github.com/MCFireworkDev/MinecraftDeobfuscated-Mojang/blob/snapshot/minecraft/src/net/minecraft/world/entity/player/Player.java)：

```java
public boolean hasCorrectToolForDrops(BlockState blockState) {
    return !blockState.requiresCorrectToolForDrops()   // 方块未声明"需要正确工具" → 恒可采集
        || this.inventory.getSelected().isCorrectToolForDrops(blockState);
}
```

**③ 速度汇总** — 同 `Player.java`（与 Wiki 伪代码逐行对应）：

```java
public float getDestroySpeed(BlockState blockState) {
    float f = this.inventory.getDestroySpeed(blockState);      // 工具速度；品类不匹配 = 1
    if (f > 1.0F) {                                           // 只有"有效工具"才吃效率附魔
        int i = EnchantmentHelper.getBlockEfficiency(this);
        if (i > 0 && !itemStack.isEmpty()) f += i * i + 1;
    }
    if (MobEffectUtil.hasDigSpeed(this))                      // 急迫/潮涌：每级 +20%
        f *= 1.0F + (MobEffectUtil.getDigSpeedAmplification(this) + 1) * 0.2F;
    if (this.hasEffect(MobEffects.DIG_SLOWDOWN))              // 挖掘疲劳：硬编码 0.3/0.09/0.0027/0.00081
        f *= switch (amplifier) { case 0 -> 0.3F; case 1 -> 0.09F; case 2 -> 0.0027F; default -> 8.1E-4F; };
    if (this.isEyeInFluid(FluidTags.WATER) && !EnchantmentHelper.hasAquaAffinity(this))
        f /= 5.0F;                                            // 水下 ÷5
    if (!this.onGround())
        f /= 5.0F;                                            // 悬空 ÷5
    return f;
}
```

**④ 工具侧双判定** — [`world/item/DiggerItem.java`](https://github.com/MCFireworkDev/MinecraftDeobfuscated-Mojang/blob/snapshot/minecraft/src/net/minecraft/world/item/DiggerItem.java)（镐/斧/锹/锄的共同基类）：

```java
public float getDestroySpeed(ItemStack itemStack, BlockState blockState) {
    return blockState.is(this.blocks) ? this.speed : 1.0F;    // 品类不匹配 → 速度 1（无惩罚乘数）
}

public boolean isCorrectToolForDrops(BlockState blockState) {
    int i = this.getTier().getLevel();                        // 木/金=0 石=1 铁=2 钻=3 下界合金=4
    if (i < 3 && blockState.is(BlockTags.NEEDS_DIAMOND_TOOL)) return false;
    else if (i < 2 && blockState.is(BlockTags.NEEDS_IRON_TOOL)) return false;
    else return !(i < 1 && blockState.is(BlockTags.NEEDS_STONE_TOOL)) && blockState.is(this.blocks);
}                                                            // 品类标签与等级标签必须同时满足
```

**版本差异备注**：1.20.1 中 `isCorrectToolForDrops` 尚名 `canHarvestBlock`（逻辑相同）；1.20.5 起工具的速度与适用方块从 `Tier + TagKey` 硬编码迁入物品数据组件 `minecraft:tool`（`rules` + `default_mining_speed`/`speed`），判定结果不变（来源: [Breaking § Calculation](https://minecraft.wiki/w/Breaking) 伪代码 "mining speed for block determined by the tool item component"）；1.21.2 起水下与总速度改走属性 `submerged_mining_speed`（默认 0.2）与 `block_break_speed`（默认 1.0），数值行为与 ÷5 口径等价（来源: [Breaking § Calculation](https://minecraft.wiki/w/Breaking) 计算器参数区）。

---

## 9. 与大众印象不同的结论（本次逐条核实）

1. **"等级不足 = 白挖但更慢、等于徒手速度"是错的（JE）。** 工具速度保留，只是分母 30→100：木镐挖铁矿 7.5s < 徒手 15s。"速度归 1"是 Bedrock 行为（§1.4、§4.3）。
2. **"等级不足速度 ×1/3"不精确。** 实为 30/100 = **0.3 = 3/10**（耗时 ×10/3 ≈ 3.33），且它不是独立乘数而是分母切换（§4.4）。
3. **下界合金速度是 9 不是 12**；12 是金——金的挖掘等级是 0（与木同级），挖不动铁矿石（§2.1）。
4. **树叶的「品类工具」是锄**（1.16 起，Wiki Best tools 表按锄归类，速度走镐同款乘数表）；剪刀对树叶速度 15 是全场最高乘数（> 下界合金锄 9），但两者同过瞬破阈值、表值同为 0.05s——剪刀的不可替代性在「让树叶掉落自身」这一掉落门禁，不在速度（§3.1、§3.3、§5.2）。
5. **剪刀速度不是单一值**：通用 2、羊毛 5、树叶/蛛网 15（§3.3）。
6. **剑对所有方块都有 ×1.5 速度**（不只蛛网）；蛛网 15、竹子 30（§3.3）。
7. **MC 没有"挖不动"，只有"不值得挖"。** 黑曜石徒手 250 秒也能挖掉（只是无掉落）；真正不可破坏的只有硬度 -1 的基岩类（§1.1、§4.3）。
8. **徒手挖石头 7.5s 的成因是 canHarvest=false（硬度×5），不是"手慢"。** 若石头没有掉落门禁，徒手只需 2.25s（§1.3）。
9. **工作台/箱子/书架是"斧"方块**（徒手 3.75s 也能掉自身），**熔炉是"镐"方块**（必须木镐+才掉落）——"木质方块 = 无门禁"的直觉对，但熔炉这类石质功能方块容易被误归为无门禁（§7）。
10. **水中与悬空是两个独立乘区，可叠成 ÷25**；判定顺序：效率→急迫→疲劳→水下→悬空（§6）。
11. **JE 官方耗时表若干值带 +0.05s 尾差**（黑曜石 250.05s 等），浮点累计差一刻的既定行为，不是印刷错误（§1.2）。

---

## 10. 对本项目的启示

项目现状（读取自本仓库）：`js/config.js` 方块表有 `hard/tool/tier/drop` 四字段；`js/craft-core.js` 的 `breakTime(blockDef, toolStack)` 声称"MC 公式 + 儿童封顶 8s、下限 0.15s"；`js/items-core.js` 工具有 `speed/tier`（tier 从 1 起：木=1/石=2/铁=3/钻=4，与 MC 的 0 起错一位）。对照本报告，差距要点如下（**只列差距，不给实现方案**）：

1. **"品类对但 tier 不足"的处理比 MC 更狠。** 项目走 `hard×5` 且完全丢弃工具速度（木镐挖铁矿=15s）；JE 是保留速度、分母 30→100（=7.5s），项目实际等价于 Bedrock 口径（§4.3）。儿童向是否要保留"高级工具挖不动低级矿也快不了多少"的感知差异，值得在设计稿里显式决策。
2. **"无门禁方块 + 错工具"被误伤。** 拿镐挖泥土：项目按 `hard×5` 给 2.5s；MC 只是无加成（速度 1）仍按 ×1.5 → 0.75s。MC 里"错工具 = 无加成"，项目是"错工具 = 惩罚"，两种口径混在同一条 `fast` 分支里（§3.2）。
3. **速度与掉落两套开关耦合。** MC 是两个正交判定：`requiresCorrectToolForDrops` 管掉不掉、品类标签管快不快；项目把两者合并进单一 `matched`（`drops = tier===0 || matched`），出现"泥土拿镐：时间被罚 3.3 倍但掉落正常"这类口径不闭环的组合（§5.1）。
4. **封顶 8s 抹平了黑曜石档。** MC 徒手挖黑曜石 250s、木镐 125s——"必须做钻镐"的动机来自 31 倍的时间差；项目一律 8s 后，钻镐（0.4s 档）与木镐（8s 封顶）差只剩 20 倍且绝对值都很短。儿童封顶合理，但"钻石工具的意义"要靠其他维度补偿（§7）。
5. **下限 0.15s 吞掉了瞬时档。** MC 硬度 0 的方块（草丛/TNT 类）是真·瞬破（0s），且耗时 ≤0.05s 的方块豁免连挖间隔；项目 `hard=0` 会被 `max(0.15, …)` 顶到 0.15s。草丛/麦苗这类高频交互方块差 0.15s × 次数，手感差距可感知（§1.2）。
6. **无 tick 量化。** MC 的特色数字（木镐挖石头 1.15s 而非 1.125s）来自 `ceil` 到 1/20s；项目输出连续时间并对 1e5 圆整。要对齐 MC 手感需引入游戏刻概念，不对齐则所有耗时都应是"理论值"而非 Wiki 表值（§1.2、§1.3）。
7. **环境修正缺失**（悬空 ÷5、水下 ÷5、急迫）。项目有 `flyMode`（常驻悬空），若照搬 MC 会全局 ÷5——大概率故意不做，但设计稿应写明"知晓并豁免"，而不是没意识到（§6）。
8. **剪刀速度口径单一。** 项目剪刀统一 speed 5；MC 是 通用 2 / 羊毛 5 / 树叶 15 三个档，且"剪刀 = 树叶掉落门禁工具"而非单纯加速器。若项目树叶/羊毛用同一把剪刀，两类方块的相对节奏与 MC 不同（§3.3、§5.2）。
9. **剑没有挖掘身份。** MC 剑是"通用 ×1.5 + 蛛网 15"的挖掘参与者；项目剑只有 `dmg`（纯武器）。若后续引入蛛网类方块需补此档位（§3.3）。
10. **tier 基准错位是映射隐患。** 项目 tier 1=木（MC level 0），对照 Wiki/数据包数值时所有等级都要 -1；项目现有门槛（煤 tier1/铁 tier2/金矿+钻石 tier3）换算后与 MC 完全一致（煤=木镐、铁=石镐、钻石=铁镐 ✓），这个错位靠的是约定俗成，建议在后续设计稿中固定换算表（§4.1、§4.2）。
11. **效率附魔/急迫/挖掘疲劳不存在**——符合"游戏暂无附魔"的裁剪，无差距动作，仅存档说明（§2.2）。

---

*本报告仅作调研产出，未改动任何代码。*
