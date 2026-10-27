# Minecraft 生态群系 × 怪物-地图绑定 × 调研报告

> **调研说明**
> - 调研问题：为体素冒险模式扩充提供设计参考——官方生态群系如何用"地表/植被/水色/天气/结构"建立辨识度、怪物如何与群系绑定形成"每个怪物都有自己的家"、物品层级与群系专属资源、结构如何给群系目标感、维度切换如何制造进度感与仪式感。
> - 所有事实性论断均来自一手来源 **Minecraft Wiki**（minecraft.wiki，Weird Gloop 托管的官方社区 Wiki；中文站为 zh.minecraft.wiki，本次抓取了中文《生物群系》全页）逐页抓取，未使用任何二手转述文章。每条论断后附来源链接。
> - 版本口径：Wiki 当前反映 **Java 版 26.3**（2026-10，版本号已改为年份制）。文中 2025–2026 年新增内容（铜质工具、鹦鹉螺、焦骸/霜冻/斑驳森林/硫磺洞穴等）单独标注"新近版本"，供项目决定是否跟进；**设计基线建议以长期稳定的经典内容（≤1.21）为准**。
> - 抓取日期：2026-10-27。本报告只做研究，不涉及任何代码改动。

## 0. 结论先行（TL;DR）

1. **群系辨识是"五感叠加"，不是单一方块差异**：官方每个群系同时差异化 ①地表方块 ②代表植被/树种 ③草与树叶的颜色（由温度/降水从色环图采样）④水色与天空色 ⑤天气（雨/雪/无降水）⑥结构。给 6 岁孩子的地图，每张至少换掉其中 3~4 项即可形成强辨识（来源：[Biome（英文）](https://minecraft.wiki/w/Biome)、[生物群系（中文）](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB)）。
2. **怪物的"家"有三种实现手法**：①**整体替换**（沙漠中 80% 僵尸被尸壳替换、雪原中 80% 骷髅被流浪者替换）；②**专属结构/水域**（女巫只随沼泽小屋常驻、溺尸绑定水体）；③**条件触发**（幻翼绑定"3 天不睡觉"、掠夺者绑定前哨站与巡逻队）。三种手法正好对应冒险模式"地图专属怪 / 水体怪 / 行为触发怪"三类设计位（来源：[Zombie](https://minecraft.wiki/w/Zombie)、[Husk](https://minecraft.wiki/w/Husk)、[Stray](https://minecraft.wiki/w/Stray)、[Witch](https://minecraft.wiki/w/Witch)、[Drowned](https://minecraft.wiki/w/Drowned)、[Phantom](https://minecraft.wiki/w/Phantom)、[Pillager](https://minecraft.wiki/w/Pillager)）。
3. **专属怪 = 同骨架 + 家乡配色 + 一招专属**：尸壳=僵尸+沙色+不烧于日光+附加饥饿；流浪者=骷髅+雪色棉服+缓慢之箭；溺尸=僵尸+水藻绿+持三叉戟远程。这是项目可直接复用的变体公式（与 docs/monster-taxonomy-research.md §2 的结论互相印证）。
4. **结构是"去这个群系的理由"**：沙漠神殿=宝箱+TNT 陷阱+考古室；丛林神庙=拉杆谜题+绊线箭矢；沉船=藏宝图指向埋藏宝藏；废弃矿井=洞穴蜘蛛刷怪笼+矿车宝箱；村庄=交易+铁傀儡。每张新地图至少放一个"只有这里有"的奖励结构（来源：[Desert Pyramid](https://minecraft.wiki/w/Desert_pyramid)、[Jungle Pyramid](https://minecraft.wiki/w/Jungle_pyramid)、[Shipwreck](https://minecraft.wiki/w/Shipwreck)、[Mineshaft](https://minecraft.wiki/w/Mineshaft)、[Village](https://minecraft.wiki/w/Village)）。
5. **工具层级是"耐久×速度×挖矿等级"的三维阶梯**：木→石→铁→钻石→下界合金每级耐久近乎翻倍（59→131→250→1561→2031），黄金反直觉地"最快最脆"（效率 12、耐久 32）。儿童版可以砍成"木/石/铁/钻"四级正增长（来源：[Tiers](https://minecraft.wiki/w/Tiers)）。
6. **维度切换的仪式感来自"要造门才能走"**：下界门=黑曜石门框+打火石点燃+站 4 秒传送（1:8 坐标映射）；末地门=要塞里 12 格末影之眼逐格点亮。两道门都是"收集材料→亲手建造→点亮→穿越"的四步仪式，儿童版冒险模式的"大关卡切换门"可直接借鉴这套节奏（来源：[Nether Portal](https://minecraft.wiki/w/Nether_portal)、[End Portal](https://minecraft.wiki/w/End_portal)）。

---

## 1. 生态群系清单与辨识要素

### 1.1 总量与分类

Java 版现有 **67 种群系类型：主世界 56 + 下界 5 + 末地 5**（另有 1 种仅用于超平坦预设）。Wiki 把主世界群系非官方地分为 8 类：海洋类、山地类、森林类、湿地类、平原类、干旱类、洞穴类、虚空（来源：[Biome § List of biomes](https://minecraft.wiki/w/Biome)）。中文站按 7 类划分（海洋/山地/森林/湿地/平原/干旱/洞穴），并注明主世界 56 种（Drop 4 2026 实验后为 57，新增冰洞穴）（来源：[生物群系 § 种类](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB)）。

### 1.2 主世界主要群系速查表

下表覆盖冒险模式最可能用到的约 22 个经典群系（合并暖冷海洋变体）。"草色"为游戏内实际渲染色值，可直接抄进美术调色板（来源：[Biome § List of biome climates](https://minecraft.wiki/w/Biome)，中文核对：[生物群系 § 气候列表](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB)）。

| 群系（中文/英文） | 地表方块 | 代表植被 | 水色/环境色 | 天气·氛围 | 生成结构 |
| --- | --- | --- | --- | --- | --- |
| 平原 Plains | 草方块 | 少量橡树、花与草丛 | 水常规；草 `#91bd59` | 降雨；视野开阔，洞穴口/熔岩湖易见 | 村庄、掠夺者前哨站 |
| 向日葵平原 Sunflower Plains | 草方块 | **唯一天然生成向日葵** | 同平原 | 降雨 | （BE 可有村庄/前哨站） |
| 森林 Forest | 草方块+枯叶堆 | 大量橡树+桦树、蘑菇 | 草 `#79c05a` | 降雨；狼出没 | —— |
| 桦木森林 Birch Forest | 草方块 | **纯桦树林**，草偏青绿 `#88bb67` | 草 `#88bb67` | 降雨；无狼 | —— |
| 繁花森林 Flower Forest | 草方块 | 树少但**近乎全种类花** | 同森林 | 降雨；蜂巢更多 | —— |
| 黑森林 Dark Forest | 草方块 | 深色橡树密林+巨型蘑菇 | 草 `#507a32`（偏暗） | 降雨；**树冠下白天也刷怪** | 林地府邸（罕见） |
| 针叶林 Taiga | 草方块 | 云杉林+蕨类+**甜浆果丛** | 草 `#86b783`（冷调） | 降雨；狼/狐狸 | 针叶林村庄、前哨站、古迹废墟 |
| 积雪针叶林 Snowy Taiga | 雪覆草方块 | 云杉、蕨类 | 草 `#80b497` | **降雪**；可生成雪屋 | 雪屋、古迹废墟 |
| 雪原 Snowy Plains | 雪覆草方块 | 少量云杉 | 草 `#80b497` | **降雪**；露天水面结冰 | 雪屋、雪原村庄、前哨站 |
| 冰刺之地 Ice Spikes | **雪块** | 无树；**浮冰冰刺 10–50 米** | —— | 降雪；地表全换雪块 | —— |
| 丛林 Jungle | 草方块 | 大型丛林树(可达 31 格)+藤蔓+**可可果+西瓜** | 草 `#59c93c`（鲜绿） | 降雨；温暖湿润 | 丛林神庙、古迹废墟 |
| 竹林 Bamboo Jungle | 草方块+灰化土 | **密集竹子**+大型丛林树 | 同丛林 | 降雨；熊猫高概率 | 丛林神庙（仅 JE） |
| 沼泽 Swamp | 草方块（浅水池） | 橡树+藤蔓+**蓝色兰花（唯一）**+睡莲+蘑菇 | **水灰绿色，水下能见度减半** | 降雨；夜间刷史莱姆 | **沼泽小屋（唯一）**、化石 |
| 红树林沼泽 Mangrove Swamp | **泥巴** | 密集红树+红树胎生苗 | 水 teal 青绿色 | 降雨温暖 | 化石（无小屋） |
| 沙漠 Desert | 沙子（下为砂岩） | **仙人掌**、枯灌木 | 草 `#bfb755`（枯黄） | **无降水**；干燥雷暴 | 沙漠村庄、**沙漠神殿（唯一）**、沙漠水井、前哨站 |
| 热带草原 Savanna | 草方块（土黄） | **金合欢树**+高草 | 草 `#bfb755`；天色 `#6eb1ff` | **无降水** | 热带草原村庄、前哨站 |
| 恶地 Badlands | **红沙+分层陶瓦** | 稀疏枯灌木/仙人掌 | 草固定 `#90814d` | 无降水；**地表金矿** | **地表废弃矿井（深色橡木）** |
| 风袭丘陵 Windswept Hills | 石头/草 | 稀疏橡树云杉 | 草 `#8ab689` | 降雨；高处降雪；**绿宝石矿+羊驼** | —— |
| 山地类（尖峭/冰封/裸岩山峰） | 雪块/石头 | 无树；Goat 山羊 | 雪白 | 降雪/高寒；Y=256 | 高地基座前哨站 |
| 草甸 Meadow | 草方块（冷绿） | **近乎全种类花**+带蜂巢孤树 | 草 `#83bb6d` | 降雨 | 平原村庄、前哨站 |
| 樱花树林 Cherry Grove | 草方块 | **粉色樱花树+粉红花簇（唯一）** | 草/叶固定 `#b6db61` | 降雨 | 前哨站 |
| 蘑菇岛 Mushroom Fields | **菌丝体** | **巨型蘑菇（唯一主世界天然点）** | 草 `#55c93f` | 降雨；**除哞菇/蝙蝠/发光鱿鱼外不刷任何怪** | —— |
| 海洋/河流（普通→暖→冷→冻） | 沙砾/沙 | 海草、海带（暖水无海带） | **水色梯度：暖水浅绿→温水浅青→普通蓝→冷水深蓝→冻洋蓝紫** | 海面无天气差异；冻洋有冰山 | 沉船、海底废墟、深海海底神殿、（沙滩）埋藏宝藏 |
| 溶洞 Lush Caves（洞穴类） | 苔藓块 | 洞穴藤蔓（发光浆果）、杜鹃 | —— | 地下；**美西螈唯一产地** | —— |
| 深暗之域 Deep Dark（洞穴类） | 幽匿块 | 无植被 | —— | **自然刷怪为零**；幽匿尖啸体→监守者 | 远古城市 |

> 设计注记：**水色梯度**是海洋家族的官方辨识方案——暖水海洋浅绿、温水浅青、普通蓝、冷水深蓝、冻洋蓝紫（来源：[生物群系 § 海洋类生物群系](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB)英文版 [Biome § Offshore biomes](https://minecraft.wiki/w/Biome)）。儿童版"水地图"同样可以用水色深浅做难度分级。
>
> 新近版本（2025–2026）新增：斑驳森林（秋色杨树林）、硫磺洞穴、冰洞穴（Fourth Drop 2026 实验特性）等（来源：[Biome § Woodland/Cave biomes](https://minecraft.wiki/w/Biome)）。建议项目不跟进，保持经典集合。

### 1.3 气候与色彩系统（引擎怎么做辨识）

- **群系 = 温度 × 降水两个数值**。Java 版里草/叶颜色从 256×256 的 `grass.png`/`foliage.png` 色环图按 (温度, 降水) 坐标采样；温度还决定天色：`T=clamp(温度/3,-1,1)`，天色 = `(0.622−0.05T, 0.5+0.1T, 1)`（来源：[Biome § Tint / § Environment / § Climate](https://minecraft.wiki/w/Biome)）。
- **特判群系用固定色覆盖色环图**：沼泽草色在 `#4c763c`/`#6a7039` 间按噪声切换；恶地草 `#90814d`；樱花树林草叶 `#b6db61`；苍白之园全天灰色 `#b9b9b9`（来源：[Biome § Special plant tints](https://minecraft.wiki/w/Biome)）。
- **降水规则**：温度 <0.15 的群系下雪、≥0.15 降雨；恶地/沙漠/热带草原降水为 false（永不降雨）；高度也影响——Y≥81 每升 1 格温度 −0.00125，所以风袭丘陵山顶有雪（来源：[Biome § Temperature / § Precipitation](https://minecraft.wiki/w/Biome)）。
- **群系边界用颜色平均过渡**（biome blend），植物与水色取邻域均值，天色/雾色取 5×5×5 高斯模糊（来源：[Biome § Transition](https://minecraft.wiki/w/Biome)）。

> 设计注记：对儿童版来说，这套系统的可借鉴点是**"每张地图一组 (地表色, 植被色, 水色, 天色) 四元组"**，用一张调色板约束整张地图的美术，而不是逐方块手工调。

### 1.4 下界与末地群系

- 下界 5 群系：**下界荒地**（下界岩+萤石+岩浆海，几乎全部下界怪）、**灵魂沙峡谷**（灵魂沙+玄武岩+蓝雾，骷髅+恶魂密集）、**绯红森林**（绯红菌"树"+垂泪藤，疣猪兽+猪灵）、**诡异森林**（诡异菌+扭曲藤，**只有末影人+炽足兽**）、**玄武岩三角洲**（玄武岩+黑石，岩浆怪高刷新）。下界整体炎热干燥、**不能放水**（来源：[Biome § The Nether](https://minecraft.wiki/w/Biome)）。
- 末地 5 群系：中央的**末地**（末地石主岛+末影龙+黑曜石柱）、外岛的**末地高地/末地中部/末地边缘/小末地岛**；**末地高地是紫颂树与末地城的唯一生成地**，大量末影人（来源：[Biome § The End](https://minecraft.wiki/w/Biome)）。

---

## 2. 怪物-群系绑定关系

### 2.1 全地形通用怪（夜晚/黑暗刷出）

以僵尸、骷髅为代表的经典怪在**几乎所有主世界群系**的光照 0 处生成，但有明确例外：**蘑菇岛、深暗之域永不刷**；基岩版额外排除河流、冻河、雪原（来源：[Zombie § Spawning](https://minecraft.wiki/w/Zombie)、[Skeleton § Spawning](https://minecraft.wiki/w/Skeleton)）。女巫同样是全群系低权重刷新（JE 权重 5/515≈1%），但**沼泽小屋是它唯一的"常驻之家"**（来源：[Witch § Spawning](https://minecraft.wiki/w/Witch)）。

| 怪物 | 行为 | 与群系的关系 |
| --- | --- | --- |
| 僵尸 Zombie | 近战、白天燃烧、可感染村民 | 全群系通用；沙漠里 80% 被尸壳替换（来源：[Zombie](https://minecraft.wiki/w/Zombie)） |
| 骷髅 Skeleton | 弓箭远程、白天燃烧、会找阴影 | 全群系通用；雪原 80% 被流浪者替换；下界灵魂沙峡谷/下界要塞也有（来源：[Skeleton](https://minecraft.wiki/w/Skeleton)） |
| 苦力怕 Creeper | 自爆 | 全群系通用（含下界荒地等）；被骷髅射死掉唱片（来源：[Skeleton § Behavior](https://minecraft.wiki/w/Skeleton)） |
| 蜘蛛 Spider | 白天变中立、可爬墙 | 全群系通用；1% 骑骷髅成蜘蛛骑士（来源：[Skeleton § Spider jockeys](https://minecraft.wiki/w/Skeleton)） |
| 末影人 Enderman | 中立、被看激怒、瞬移 | 全群系罕见；**诡异森林与末地大量出现**（来源：[Biome § The Nether/The End](https://minecraft.wiki/w/Biome)） |
| 女巫 Witch | 掷伤害/中毒药水、自饮恢复 | 全群系低概率；**沼泽小屋专属常驻**；村民遭雷击变身（来源：[Witch](https://minecraft.wiki/w/Witch)） |

### 2.2 群系专属怪（"每个怪物的家"）

| 怪物 | 家 | 视觉差异 | 行为/机制差异 | 来源 |
| --- | --- | --- | --- | --- |
| 尸壳 Husk | 沙漠（替换 80% 僵尸，JE / 70% BE） | 沙土色皮肤 | **不烧于日光**；徒手攻击附加饥饿效果；头部入水 30 秒变回僵尸 | [Husk](https://minecraft.wiki/w/Husk) |
| 流浪者 Stray | 雪原、冰刺之地（替换 80% 骷髅）；BE 另有冻洋/冻河/雪坡/山峰 | 灰白"棉服"骷髅 | 射**缓慢之箭**（30 秒缓慢）；免疫细雪冻伤；骷髅泡细雪 22 秒转化为流浪者 | [Stray](https://minecraft.wiki/w/Stray)、[Skeleton](https://minecraft.wiki/w/Skeleton) |
| 溺尸 Drowned | 全部海洋群系、河流、冻河、溶洞含水层 | 水藻绿僵尸 | 水中/雨天活跃；6.25% 持**三叉戟**远程投掷；僵尸头浸水 30+15 秒转化而来 | [Drowned](https://minecraft.wiki/w/Drowned) |
| 沼骸 Bogged | 沼泽、红树林沼泽（替换部分骷髅） | 苔藓骷髅 | 射**中毒之箭**（来源页 § 变体；新近版本稳定化） | [Skeleton § Variants](https://minecraft.wiki/w/Skeleton)、[Witch](https://minecraft.wiki/w/Witch) |
| 焦骸 Parched | 沙漠（替换部分骷髅，2025 新增） | 干枯骷髅 | 与尸壳同属沙漠敌对生态 | [Skeleton § Variants](https://minecraft.wiki/w/Skeleton) |
| 史莱姆 Slime | **沼泽/红树林沼泽**（Y51–69、光照≤7、**满月最多新月没有**）+ 全主世界**史莱姆区块**（约 1/10 区块、Y<40、无视光照） | 大中小三档、方型 | 死亡分裂 2–4 只；只掉黏液球 | [Slime](https://minecraft.wiki/w/Slime) |
| 掠夺者 Pillager | **掠夺者前哨站**（常驻刷新）+ 巡逻队（5.5 游戏日后任何群系）+ 袭击波次 | 灾厄村民、持弩 | 每 3 秒射箭；队长背灾厄旗帜、掉不祥之瓶 | [Pillager](https://minecraft.wiki/w/Pillager) |
| 幻翼 Phantom | **不绑定群系**——玩家 ≥3 个游戏日不睡/不死，夜晚或雷暴在头顶 20–34 格生成 | 蓝白蝠鲼形 | 俯冲撕咬；猫会对其威吓；JE 中连蘑菇岛都能刷 | [Phantom](https://minecraft.wiki/w/Phantom) |
| 女巫 Witch | 沼泽小屋（生成时自带黑猫、永不消失） | 紫帽绿袍 | 见 §2.1 | [Witch](https://minecraft.wiki/w/Witch) |
| 洞穴蜘蛛 Cave Spider | **废弃矿井**刷怪笼（唯一自然来源）；硫磺洞穴（新近版本） | 小型蓝色蜘蛛 | 中毒攻击、可钻 1×1 缝 | [Mineshaft](https://minecraft.wiki/w/Mineshaft) |
| 哞菇 Mooshrome | 蘑菇岛（唯一） | 红白蘑菇牛 | 剪毛变普通牛；碗+蘑菇=蘑菇煲 | [Biome § Offshore](https://minecraft.wiki/w/Biome) |
| 卫道士/唤魔者/劫掠兽 | 林地府邸（黑森林）与袭击 | 灾厄村民族 | 铁斧近战/尖牙法术/冲撞 | [Village § Raids](https://minecraft.wiki/w/Village)、[Pillager § Raids](https://minecraft.wiki/w/Pillager) |
| 守护者/远古守护者 | **深海海底神殿** | 光束鱼形 | 激光锁定攻击 | [Biome § Offshore](https://minecraft.wiki/w/Biome) |

> **沙漠的官方模板值得照抄**：沙漠把"通用怪替换为专属怪"做到了成套——僵尸→尸壳、骷髅→焦骸，且骆驼/金色兔子作为友好生物也只在沙漠出现（来源：[Biome § Arid-land biomes](https://minecraft.wiki/w/Biome)、[Zombie § Natural generation](https://minecraft.wiki/w/Zombie)、[Skeleton § Variants](https://minecraft.wiki/w/Skeleton)）。一张"沙漠地图"= 沙色地表 + 仙人掌 + 尸壳&焦骸 + 骆驼 + 沙漠神殿，五件套齐活。

### 2.3 环境转化链（怪物会"换家"）

官方用**浸水/埋雪/雷击**把怪物家族串成转化链，孩子能直观理解"怪物怕什么环境"（来源：[Drowned § Conversion](https://minecraft.wiki/w/Drowned)、[Husk § Behavior](https://minecraft.wiki/w/Husk)、[Stray § Converting](https://minecraft.wiki/w/Stray)、[Witch § Spawning](https://minecraft.wiki/w/Witch)）：

```
尸壳(沙漠) --浸水30s--> 僵尸 --浸水30s--> 溺尸(水中)
骷髅 --埋细雪22s--> 流浪者(雪原)
村民 --雷击4格内--> 女巫
溺尸 --埋细雪--> 僵尸 -->（Fourth Drop 2026 预告）霜冻僵尸
```

### 2.4 从刷怪权重看"家的浓度"

Wiki 各怪物页给出了每种群系的刷怪权重：僵尸在多数群系权重 95/515（≈18%），**在沙漠骤降到 19/515（≈3.7%）**——因为 80% 名额给了尸壳；骷髅在雪原/冰刺同样从 100 降到 20，让位给流浪者 80；溺尸在河流权重 100/615（≈16%，成组 1 只），在普通海洋只有 5/520（≈1%）（来源：[Zombie § Spawning](https://minecraft.wiki/w/Zombie)、[Skeleton § Spawning](https://minecraft.wiki/w/Skeleton)、[Stray § Spawning](https://minecraft.wiki/w/Stray)、[Drowned § Spawning](https://minecraft.wiki/w/Drowned)）。**儿童版可简化为布尔开关（此地图刷/不刷），但保留"替换"语义**：沙漠地图不刷白僵尸只刷尸壳，比"两种都刷"辨识度强得多。

---

## 3. 物品与材料层级

### 3.1 工具/武器材质层级

Java 版现有 **7 个层级**（木质→石质→铜质→铁质→钻石→下界合金，黄金独立）。层级决定：挖掘等级、耐久、挖掘效率、伤害加成、附魔能力（来源：[Tiers § Tiers](https://minecraft.wiki/w/Tiers)，表格数值照录）：

| 层级 | 挖掘等级 | 耐久 | 效率倍率 | 伤害加成 | 附魔能力 |
| --- | --- | --- | --- | --- | --- |
| 木 Wood | 0 | 59 | 2 | 0 | 15 |
| 石 Stone | 1 | 131 | 4 | 1 | 5 |
| 铜 Copper（1.21.9 新增） | —— | 191 | 5 | 1.5* | 13 |
| 铁 Iron | 2 | 250 | 6 | 2 | 14 |
| 钻石 Diamond | 3 | 1561 | 8 | 3 | 10 |
| 下界合金 Netherite | 4 | 2031 | 9 | 4 | 15 |
| 黄金 Gold | 0 | 32 | **12** | 0 | **22** |

- 挖掘等级用标签 gating：`needs_stone_tool`/`needs_iron_tool`/`needs_diamond_tool`——铁及以上才能挖钻石矿，钻石及以上才能挖黑曜石（来源：[Tiers § Mining level](https://minecraft.wiki/w/Tiers)）。
- **黄金是故意设计的"反直觉层"**：最快、最脆、最好附魔（来源：[Tiers](https://minecraft.wiki/w/Tiers) 注：表格中金耐久 32、效率 12）。儿童版若保留金工具，正好当"趣味特殊工具"而非升级线。
- 1.21.11 新增长矛（Spear）也走层级系统（来源：[Tiers § History](https://minecraft.wiki/w/Tiers)）——新近版本，建议不跟进。

### 3.2 食物体系

食物恢复两个隐藏数值：**饥饿（0–20，鸡腿图标）与饱和（隐藏，先消耗）**；耗竭度先扣饱和再扣饥饿；饥饿 ≥18 自动回血、≤6 不能疾跑、=0 开始饿伤（来源：[Food § Hunger/Saturation/Exhaustion](https://minecraft.wiki/w/Food)）。代表性食物（来源：[Food § Food hunger values](https://minecraft.wiki/w/Food)）：

| 食物 | 饥饿恢复 | 备注 |
| --- | --- | --- |
| 牛排/熟猪排 | 8 | 肉类顶配 |
| 金胡萝卜 | 6 | **饱和恢复全游戏最高（14.4）** |
| 面包 | 5 | 小麦合成，农场主路线 |
| 苹果/金苹果 | 4 | 金苹果附带回血+伤害吸收 |
| 腐肉 | 4 | **80% 概率饥饿 debuff**——僵尸掉落的"坏食物"样本 |
| 西瓜片/甜浆果/曲奇 | 2 | 低档零食 |

- 有附加效果的食物：金苹果（再生+吸收）、蜂蜜瓶（解中毒）、紫颂果（随机传送）、河豚（饥饿+反胃+中毒的"危险食物"）（来源：[Food § Food effects](https://minecraft.wiki/w/Food)）。
- 进食耗时 1.6 秒（干海带 0.8、蜂蜜瓶 2.0）（来源：[Food § Consumption time](https://minecraft.wiki/w/Food)）。

### 3.3 群系专属资源（"去这张地图的理由"之二）

| 资源 | 唯一/主要产地 | 来源 |
| --- | --- | --- |
| 仙人掌 | 沙漠、恶地 | [Biome § Arid-land](https://minecraft.wiki/w/Biome) |
| 竹子 | 丛林、竹林（竹林密集） | [Biome § Woodland](https://minecraft.wiki/w/Biome) |
| 可可果 | 丛林树干侧面 | [Biome § Woodland](https://minecraft.wiki/w/Biome) |
| 西瓜 | 丛林成片生成 | [Biome § Woodland](https://minecraft.wiki/w/Biome) |
| 甜浆果 | 针叶林/积雪针叶林地表 | [Biome § Woodland](https://minecraft.wiki/w/Biome) |
| 蓝色兰花 | **沼泽唯一** | [生物群系 § 湿地](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB) |
| 向日葵 | **向日葵平原唯一** | [Biome § Flatland](https://minecraft.wiki/w/Biome) |
| 粉红花簇/樱花木 | **樱花树林唯一** | [Biome § Highland](https://minecraft.wiki/w/Biome) |
| 珊瑚礁/海泡菜 | **暖水海洋唯一** | [Biome § Offshore](https://minecraft.wiki/w/Biome) |
| 海带 | 除暖水外的全部海洋 | [Biome § Offshore](https://minecraft.wiki/w/Biome) |
| 雪/雪球/冰/浮冰/蓝冰 | 雪原家族与冻洋（冰山） | [Biome § Offshore/Flatland](https://minecraft.wiki/w/Biome) |
| 菌丝体/巨型蘑菇/蘑菇 | **蘑菇岛唯一（巨型蘑菇）** | [Biome § Offshore](https://minecraft.wiki/w/Biome) |
| 绿宝石矿 | **山地类群系**（6 处） | [生物群系 § 山地类](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB) |
| 表层金矿 | **恶地**（不限 Y≤32） | [生物群系 § 干旱类](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB) |
| 黏液球 | 史莱姆（沼泽/史莱姆区块） | [Slime](https://minecraft.wiki/w/Slime) |
| 三叉戟 | 仅溺尸掉落（8.5%~11.5%） | [Drowned § Equipment](https://minecraft.wiki/w/Drowned) |
| 紫颂果/紫颂花 | 末地外岛 | [Biome § The End](https://minecraft.wiki/w/Biome) |

---

## 4. 结构如何赋予群系目标感

### 4.1 结构分布与"理由"一览

| 结构 | 所在群系 | 独特奖励（"为什么要去"） | 玩法/危险 | 来源 |
| --- | --- | --- | --- | --- |
| 沙漠神殿 | 沙漠唯一 | 地下 4 宝箱：金苹果 22.2%/箱、金锭 17%、钻石 5.9%；**考古可疑沙**（刷子出土陶片/钻石） | 中央蓝陶瓦下的**压力板连 9 格 TNT** 陷阱 | [Desert Pyramid](https://minecraft.wiki/w/Desert_pyramid) |
| 丛林神庙 | 丛林/竹林 | 2 宝箱：金锭 50.6%、钻石 12.7%、野性盔甲纹样 33.3% | **3 拉杆谜题**开门 + 藤蔓后**绊线连发射器**箭矢陷阱 | [Jungle Pyramid](https://minecraft.wiki/w/Jungle_pyramid) |
| 沉船 | 全部海洋+沙滩 | 至多 3 箱分三类：补给（食物/纸）、**藏宝图**、宝藏；地图指向沙滩埋藏宝藏 | 结构破损、常半埋水下 | [Shipwreck](https://minecraft.wiki/w/Shipwreck) |
| 废弃矿井 | 全主世界（除深暗之域） | 矿车宝箱：命名牌 42%、金苹果 28%、钻石 8.9% | **洞穴蜘蛛刷怪笼**+蛛网阵；恶地有**地表深色橡木变种** | [Mineshaft](https://minecraft.wiki/w/Mineshaft) |
| 村庄 | 平原/草甸/沙漠/热带草原/针叶林/雪原（6 种建筑风格） | **交易**（绿宝石经济）、战利品箱、床、农田；铁傀儡守卫 | 带不祥之兆进村触发**袭击**波次；沙漠村庄有骆驼 | [Village](https://minecraft.wiki/w/Village) |
| 掠夺者前哨站 | 平原/沙漠/热带草原/针叶林/雪原/山地/草甸/樱花树林/雪坡等 | 顶层箱+周边**唯一持续刷掠夺者**（可刷不祥之瓶） | 4 居高塔+灾厄队长 | [Pillager § Pillager outposts](https://minecraft.wiki/w/Pillager)、[Biome](https://minecraft.wiki/w/Biome) |
| 沼泽小屋 | 沼泽唯一 | 女巫+黑猫常驻（刷怪农场素材） | 女巫药水压制 | [Witch § Spawning](https://minecraft.wiki/w/Witch) |
| 海底神殿 | 深海类 | 海晶石、海绵、守卫者农场 | 守护者光束、远古守护者挖掘疲劳 | [Biome § Offshore](https://minecraft.wiki/w/Biome) |
| 雪屋 | 雪原/积雪针叶林/雪坡（三群系） | 地下藏宝箱、金苹果；50% 有僵尸村民"实验室" | —— | [生物群系 § 平原类](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB) |
| 林地府邸 | 黑森林（罕见） | 至宝级战利品、卫道士/唤魔者 | 高难敌对村民 | [Biome § Woodland](https://minecraft.wiki/w/Biome) |
| 远古城市 | 深暗之域 | 独特战利品箱 | 幽匿尖啸体召唤**监守者** | [Biome § Cave biomes](https://minecraft.wiki/w/Biome) |
| 探险家地图（新） | 废弃营地秘密箱（26.3 起指向沙漠神殿/矿井） | 给玩家"下一个目的地" | —— | [Desert Pyramid § Generation](https://minecraft.wiki/w/Desert_pyramid) |

### 4.2 结构设计的两条规律

1. **"唯一产地"结构绑定"唯一群系"**：沙漠神殿只在沙漠、沼泽小屋只在沼泽、海底神殿只在深海——结构即群系的名片（来源：[Desert Pyramid § Generation](https://minecraft.wiki/w/Desert_pyramid)、[Witch § Spawning](https://minecraft.wiki/w/Witch)、[Biome § Offshore](https://minecraft.wiki/w/Biome)）。
2. **奖励与风险同址**：官方三大神殿的宝箱全部伴随可教学的陷阱（TNT 压力板/绊线发射器/守卫者），且陷阱是**机制化**的（踩到才触发、可剪线拆除）而非剧情杀（来源：[Desert Pyramid § Structure](https://minecraft.wiki/w/Desert_pyramid)、[Jungle Pyramid § Trap](https://minecraft.wiki/w/Jungle_pyramid)）。儿童版可保留"拆除陷阱"玩法但把惩罚改为击退/掉落物损失，不爆炸致死。

---

## 5. 维度与进度感

### 5.1 三段式进度

官方进度线是 **主世界（木/石/铁）→ 下界（金/钻石强化、烈焰棒、末影之眼原料）→ 末地（末影龙决战、末地城/鞘翅）**。下界要塞产烈焰棒、末影人掉末影珍珠，两者合成末影之眼用于寻找并点亮要塞末地门——每个维度的产出是打开下一维度的钥匙（来源：[End Portal § Creation](https://minecraft.wiki/w/End_portal)、[Biome § The Nether/The End](https://minecraft.wiki/w/Biome)）。

### 5.2 两种传送门的仪式感对比

| | 下界门 | 末地门 |
| --- | --- | --- |
| 获取 | **玩家亲手建造**：黑曜石门框（最小 4×5，最大 23×23） | **世界生成**：藏在要塞传送门房间 |
| 点亮 | 用打火石/火球/雷击在框内点火，紫色漩涡展开 | 逐格放入 12 颗**末影之眼** |
| 穿越 | 站立 4 秒（可中途退出取消）| 即跳入 |
| 空间关系 | 坐标 1:8 映射（下界走 1 格=主世界 8 格）| 单向直达主岛 |
| 仪式感来源 | "我造的门"+点燃瞬间 | "寻宝（要塞）+集钥匙（眼睛）+逐格点亮" |

（来源：[Nether Portal § Creation/§ Behavior/§ Coordinate conversion](https://minecraft.wiki/w/Nether_portal)、[End Portal § Creation](https://minecraft.wiki/w/End_portal)）

> 设计注记：两道门给出两种可复用的"关卡切换仪式"——**建造式**（收集方块→搭门→点亮，适合冒险模式的家门/传送阵）与**解锁式**（找到门→收集钥匙→逐格点亮，适合大关卡 Boss 门）。下界门"站 4 秒、可反悔"的缓冲设计对低龄玩家尤其友好（防误触传送）。

---

## 6. 幼儿适配评估（6 岁受众）

### 6.1 幼儿友好的机制（可放心搬）

- **五感群系辨识**：地表色+树种+水色+天气的组合差异，学龄前儿童靠颜色和形状即可认地图（§1.2）。
- **"替换式"专属怪**：尸壳/流浪者与基础怪同骨架，孩子只需认一个新颜色+一个新招（§2.2）。
- **环境转化链**：怪物泡水/埋雪会变身，规则可视、可预测（§2.3）。
- **日光烧怪**：僵尸/骷髅白天起火，给了孩子"熬到天亮就安全"的自然安全感（[Zombie § Burning under daylight](https://minecraft.wiki/w/Zombie)）。
- **蘑菇岛=零怪安全区**：官方内置的"无怪游乐场"模板（§1.2）。
- **友好动物绑定群系**：骆驼-沙漠、山羊-雪山、熊猫-竹林、哞菇-蘑菇岛、海豚-海洋——"动物的家"比怪物更适合做低龄地图的情感锚点（[Biome](https://minecraft.wiki/w/Biome)）。
- **结构探宝**：神殿宝箱+可拆除的机关，天然的"注意力训练关卡"素材（§4.2）。
- **下界门 4 秒缓冲、可反悔**（§5.2）。

### 6.2 过于恐怖/复杂、需要简化或规避

| 机制 | 问题 | 简化建议 |
| --- | --- | --- |
| 幻翼（失眠惩罚） | 惩罚"不睡觉"，且突袭头顶的音效+俯冲模型对幼儿偏恐怖；JE 连蘑菇岛都躲不掉 | 不做失眠惩罚；或改为"守护精灵提醒你回家睡觉"（来源：[Phantom](https://minecraft.wiki/w/Phantom)） |
| 女巫药水（中毒/伤害投掷） | 中毒掉血机制+debuff 叠加对 6 岁太复杂 | 改"减速泡沫/泡泡"等可视无伤害效果 |
| 苦力怕自爆/神殿 TNT | 爆炸音效+突然死亡体验 | 改为"吹飞+掉落物散落"，不摧毁地形不致死 |
| 溺尸三叉戟/水下游击 | 水下 3D 战斗+氧气管理难度高 | 水图怪只近战、移速慢；或提供永久"潜水头盔" |
| 深暗之域/监守者、凋灵、袭击波次 | 官方定位就是恐怖/高难内容 | 整体规避；袭击类玩法改为"护送/收集"事件 |
| 恶地地表矿井·洞穴蜘蛛中毒 | 蛛网+中毒叠加 | 洞穴蜘蛛可保留外观，去中毒 |
| 饥饿/饱和双数值+耗竭 | 隐藏数值系统过于复杂 | 合并为单条"能量条"，腐肉等坏食物保留"皱眉头"提示但不 debuff |
| 下界（岩浆海、恶魂火球、猪灵） | 整体氛围压抑危险 | 如需第二维度，取"糖果/星空"等明亮皮肤，保留"造门-点亮-穿越"仪式 |
| 黄金工具反直觉属性、附魔/耐久系统 | 金=最快最脆违反直觉；附魔随机性过深 | 儿童版层级单调递增（木<石<铁<钻），金工具做成收藏品 |
| 夜晚怪密度+难度分档刷怪权重 | 幼儿无法应对成组怪物 | 每地图同屏怪数上限 2–3，夜晚提示"天亮倒计时" |

---

## 7. 来源清单（本次全部抓取的一手页面）

- Minecraft Wiki（英文）：[Biome](https://minecraft.wiki/w/Biome) · [Zombie](https://minecraft.wiki/w/Zombie) · [Skeleton](https://minecraft.wiki/w/Skeleton) · [Husk](https://minecraft.wiki/w/Husk) · [Stray](https://minecraft.wiki/w/Stray) · [Drowned](https://minecraft.wiki/w/Drowned) · [Witch](https://minecraft.wiki/w/Witch) · [Slime](https://minecraft.wiki/w/Slime) · [Phantom](https://minecraft.wiki/w/Phantom) · [Pillager](https://minecraft.wiki/w/Pillager) · [Tiers](https://minecraft.wiki/w/Tiers) · [Food](https://minecraft.wiki/w/Food) · [Desert Pyramid](https://minecraft.wiki/w/Desert_pyramid) · [Jungle Pyramid](https://minecraft.wiki/w/Jungle_pyramid) · [Shipwreck](https://minecraft.wiki/w/Shipwreck) · [Mineshaft](https://minecraft.wiki/w/Mineshaft) · [Village](https://minecraft.wiki/w/Village) · [Nether Portal](https://minecraft.wiki/w/Nether_portal) · [End Portal](https://minecraft.wiki/w/End_portal)
- Minecraft Wiki（中文）：[生物群系](https://zh.minecraft.wiki/w/%E7%94%9F%E7%89%A9%E7%BE%A4%E7%B3%BB)（全页抓取，用于官方中文命名与水色描述核对）
- 注：`minecraft.wiki/w/zh/` 路径不存在（404 已验证），中文页实际位于 `zh.minecraft.wiki` 子域，本次已按此修正引用。
