# 我的世界昼夜与火把光照机制 · 调研报告

> 调研问题：为 my-craft-demo 上「昼夜循环 + 火把光照」机制取证——Minecraft（Java 版为主、Bedrock 版差异为辅）的一天多长、天空光怎么随时间变、光怎么传播、火把怎么放怎么生效、刷怪与阳光燃烧的光照规则是什么。
> 来源性质：以下事实性论断均来自 minecraft.wiki 各条目原文（2026-10-25 用 `index.php?title=…&action=raw` 抓取的 wikitext 一手原文，标注为「已抓取」），关键数值引英文原文并附中文翻译；Java / Bedrock 差异按 wiki 标注保留；随版本变化的规则（尤其 Java 1.18 刷怪光照改动、1.21.11 gamerule 改名）写明版本分界。抓取失败或 wiki 无直接原文的点，明确标注「未能核实」或「推断」（推断仅在 §5 落地启示展开）。
> 调研日期：2026-10-25。

## 0. 结论先行（TL;DR）

1. **一天 = 24000 game tick = 20 分钟**（20 tick/秒），游戏时间流速是现实 72 倍；**tick 0 对应早上 06:00**（不是午夜），6000 = 正午，12000 = 日落开始，13000 = 夜晚开始，18000 = 午夜，23000 = 日出开始。白天 10 分钟、夜晚 8 分 20 秒、日出/日落各 50 秒。（来源：[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle)，已抓取）
2. **天空光（sky light）本身不随夜晚衰减**——夜晚变暗发生在「internal sky light（暗化天空光）」和渲染亮度曲线上：正午晴天 internal sky light = 15，**夜晚最低降到 4**（tick 13670 起）；下雨/降雪时正午上限 12，**雷暴时正午只有 10**（且刷怪系统按更暗处理，白天也刷怪）。（来源：[Light](https://minecraft.wiki/w/Light)、[Weather](https://minecraft.wiki/w/Weather)，已抓取）
3. **光等级 0–15，方块光每传播 1 格（曼哈顿距离）衰减 1**；天空光在 heightmap 顶为 15，**垂直向下传播不衰减、横向/向上每格 −1**；游戏计算用的最终值 = `max(internal sky light, block light)`（主世界）。（来源：[Light](https://minecraft.wiki/w/Light)，已抓取）
4. **刷怪规则以 Java 1.18 为分界**：1.18 起（2021-11-30 发布）「**Block light level now must be 0** for many hostile mobs to spawn（天空光仍照旧阻止刷怪）」+ internal sky light ≤ 7；**1.18 之前是"光照 ≤ 7 即可刷"**（Mob 条目历史：v1.2.1 "back to light level 7 or lower"）。Bedrock 现行规则：「天空光 < 7 **且** block light = 0」才能刷大多数主世界怪物。（来源：[Light](https://minecraft.wiki/w/Light)、[Mob spawning](https://minecraft.wiki/w/Mob_spawning)、[Mob](https://minecraft.wiki/w/Mob)，已抓取）
5. **距玩家 24 格（球形）内不刷怪**；Java 怪物上限 70，Bedrock 全局上限 200；Java 大多数怪每 game tick 一个刷怪周期；离玩家 >128 格立即消失。（来源：[Mob spawning](https://minecraft.wiki/w/Mob_spawning)，已抓取）
6. **阳光燃烧的判定**：「sunlight 可视为 internal sky light ≥ 12 且 sky light = 15 同时成立」；僵尸/骷髅在水中、戴头盔、阴凉处、抗火效果下不烧，**玻璃不挡燃烧**；晴天 tick 12542 停止燃烧、23460 恢复燃烧。（来源：[Sun](https://minecraft.wiki/w/Sun)、[Zombie](https://minecraft.wiki/w/Zombie)、[Skeleton](https://minecraft.wiki/w/Skeleton)、[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle)，已抓取）
7. **火把：木棍 + 煤/木炭 → 4 支，光等级 14**；以曼哈顿距离每格 −1，即照亮半径 13 格（菱形）；**融化 2 格内雪层、3 格内冰**；作物生长需光 ≥ 9（火把光算数）；**火把不会烧完/熄灭**（vanilla 从未实现 Notch 2010 年的"火把烧完"计划）；**火把不能当熔炉燃料**（已对照 wiki 完整燃料表）。**手持火把（主手/副手）不发光**——此点 wiki 无直接原文，属据光源定义得出的推断（见 §3.3）。（来源：[Torch](https://minecraft.wiki/w/Torch)、[Light](https://minecraft.wiki/w/Light)、[Smelting](https://minecraft.wiki/w/Smelting)，已抓取）
8. **灵魂火把：煤/木炭 + 木棍 + 灵魂土/灵魂沙 → 4 支，光等级 10**，驱赶猪灵（不含猪灵蛮兵）；因光 < 12 不融雪融冰。（来源：[Soul Torch](https://minecraft.wiki/w/Soul_Torch)，已抓取）
9. **床**：internal sky light ≤ 11 才能睡（晴天 12523–23477 tick、雨天 12002–23998、**雷暴全天可睡**）；床头 8×5 格内有敌对怪则不能睡；睡 101 tick（5.05 秒）后**时间跳到 tick 0（日出）并清空天气**。（来源：[Bed](https://minecraft.wiki/w/Bed)，已抓取）
10. **gamerule**：`doDaylightCycle`（Java 1.6.1/13w24a 引入）在 **Java 1.21.11（快照 25w44a）改名 `advance_time`**，Bedrock 仍叫 `dodaylightcycle`；`/time set day` 设的是 **1000**（不是 0）。（来源：[Game rule](https://minecraft.wiki/w/Game_rule)、[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle)，已抓取）
11. **时钟 = 4 金锭 + 1 红石**，主世界任何界面/物品形态都显示当前昼夜；**下界/末地乱转**（那两维没有昼夜循环）。（来源：[Clock](https://minecraft.wiki/w/Clock)，已抓取）
12. **月相 8 个，`phase = (day mod 8) + 1`**，每天日出时换相；确认的效果只有：沼泽史莱姆数量与月圆度成正比（新月不刷）、区域难度（影响怪装备/附魔/蜘蛛 buff）、满月黑猫 1/11 概率；**没有潮汐系统**。（来源：[Moon](https://minecraft.wiki/w/Moon)，已抓取）

---

## 1. 昼夜系统

### 1.1 时间刻度与换算

- 原文："The '''daylight cycle''' is a 20-minute-long cycle in a world between two main light settings: day and night."（译：昼夜循环是一个 20 分钟长的世界内循环，在"白天/黑夜"两种光照设定间交替。）（来源：[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle)，已抓取）
- 原文："time is 72 times faster than normal time. This can be easily calculated as the proportion 1440/20 = 72"（译：游戏时间比现实快 72 倍：现实一天 1440 分钟对游戏一天 20 分钟。）（来源同上）
- 换算表（wiki 原表摘录）：1 game tick = 0.05 秒；游戏 1 小时 = 1000 tick = 50 秒；**1 天 = 24000 tick = 20 分钟**；1 个月相周期（8 天）= 192000 tick ≈ 2 小时 40 分。（来源同上）
- 单人新世界出生时时间总是 0（白天开始）：原文 "When a player first spawns in singleplayer, the daylight cycle always starts at the beginning of the daytime (0:00)."（来源同上）
- Bedrock 历史：昼夜循环最初 12 分钟（v0.4.0 提到 16 分钟）→ **v0.12.1 起才改成 24000 tick / 20 分钟**，与 Java 对齐。（来源：[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle) Bedrock History，已抓取）

### 1.2 一天的分段（Java 版 24000 制，两版现行一致）

wiki「24-hour Minecraft day」表 + 四段定义（来源：[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle)，已抓取）：

| 时段 | tick 区间 | 游戏时刻 | 真实时长 | 备注 |
|---|---|---|---|---|
| 白天 Daytime | 0 – 12000 | 06:00–18:00 | 10 分钟 | "Daytime, not including sunset and sunrise, is 10 minutes long." |
| 日落 Sunset | 12000 – 13000 | 18:00–19:00 | 50 秒（1000 tick） | "Sunset … always lasts 50 seconds (1000 ticks)." |
| 夜晚 Nighttime | 13000 – 23000 | 19:00–05:00 | 8 分 20 秒（10000 tick） | "Nighttime lasts 8 minutes and 20 seconds. (10000 ticks)" |
| 日出 Sunrise | 23000 – 24000 | 05:00–06:00 | 50 秒（1000 tick） | 同日落逆放 |

关键 tick 点（同一张表，标注版别差异的已注明）：

- 0：一天开始，玩家与村民起床（村民开始工作是 **Bedrock only** 标注，Java 在 2000）。
- 6000：正午，太阳最高，`/time set noon` 的值。
- 1000：`/time set day` 的值——**注意不是 0**。
- 12000：日落开始（Bedrock `/time set sunset` 也是它）；村民上床睡觉。
- 12010：雨天从这时起可以睡觉、雨天 internal sky light 开始下降。
- 12040：晴天 internal sky light 开始下降。
- 12542：晴天从这时起可以睡觉；**晴天亡灵生物停止燃烧**；蜜蜂回巢。
- 13000：夜晚开始（`/time set night`）。
- 13188：**晴天户外第一只怪物可刷出的 tick**（12969 为雨天）。
- 13670：internal sky light 降到 4（夜间最低值）。
- 18000：午夜，月亮最高（`/time set midnight`）。
- 22331：internal sky light 开始回升。
- 22812（Java）/ 22813（Bedrock）：晴天户外怪物可刷出的最后一 tick（版差 1 tick，wiki 已分别标注）。
- 23000：日出开始（Bedrock `/time set sunrise`）。
- 23460：晴天不能再睡觉；**晴天亡灵生物开始燃烧**；蜜蜂出巢。
- 23961：晴天 internal sky light 回到 15；23992：雨天回到 12（雨天最高只有 12）。

### 1.3 天体角度（celestial angle）公式

wiki 原文（来源：[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle) Sky angle 节，已抓取）：

> "The sky, including sun, moon, and stars, move faster during noon and midnight and slower during sunrises and sunsets. Given the current time in ticks since dawn as *t*, the current angle of the sky with 0° being noon can be calculated as:"
>
> `α = (1 − cos(π · mod₁((t − 6000) / 24000)) + mod₄((t − 6000) / 6000)) · 60°`
>
> （译：天空——含太阳、月亮、星星——在正午和午夜移动更快，在日出日落时更慢。给定黎明起算的 tick 数 t，以正午为 0° 的天空角度按上式计算。）

- 校验：t = 6000（正午）时代入得 0°；t = 18000（午夜）得 180°，自洽。**这是近似变角速度曲线，不是简单的"tick 线性映射角度"**——如果本项目只想做太阳位置动画，可用它做 MC 观感还原，也可以退化为线性（见 §5）。
- 同节注明："For Vibrant Visuals, this formula is rotated by 180° as 0° is midnight."（Vibrant Visuals 图形下公式旋转 180°，0° 定义为午夜。）

### 1.4 天空光随昼夜/天气变化（internal sky light）

先澄清三层概念（来源：[Light](https://minecraft.wiki/w/Light)，已抓取）：

- **sky light（天空光）**：纯几何量——只要方块垂直暴露于天空就是 15，**夜晚不衰减**。原文："Sky light is not reduced at night; rather, the spawning of mobs is determined by internal light values."（译：天空光在夜间不减少；怪物的生成由内部光值决定。）
- **internal sky light（暗化天空光）**：天空光 × 时间 × 天气折算出的 0–15 整数（可以更小），用于游戏逻辑（刷怪、阳光燃烧等）。
- **rendered brightness（渲染亮度）**：决定画面亮度的曲线，见 §2.4。

internal sky light 关键值（wiki 原表，来源：[Light](https://minecraft.wiki/w/Light)，已抓取）：

| 天气（天空光 15 处） | internal sky light |
|---|---|
| 正午，晴天 | 15 |
| 正午，下雨/降雪 | 12 |
| 正午，雷暴 | 10（脚注：雷暴时刷怪按"internal sky light = 5"对待） |
| 午夜，任何天气 | **4**（月光） |

- 衰减进度（晴天，tick 顺序）：12040 开始从 15 下降 → 13670 降到 4 → 全夜保持 4 到 22330（共 8660 tick ≈ 7 分 13 秒）→ 22331 开始回升 → 23961 回到 15。每一级停留约 160 tick（8 秒），黄昏比黎明略慢。
- 雨天：白天的上限是 12（23992–12009 区间为 12）；雷暴：正午也只剩 10，且 60–11940 期间为 10。
- 若所在处天空光 s < 15，公式：`internal = L − (15 − s)`（L 是上表 15 处的值）。（原文："take the internal level L at 15 and subtract from it the difference between 15 and s"，已抓取）
- Bedrock 的 tick 边界与 Java 有 ±1 tick 的出入（如 22812 vs 22813、23460–23623 vs 23460–23624），wiki 在表内逐格标注了 `{{Only|java}} / {{Only|bedrock}}`；量级上两版一致。
- 雷暴刷怪：[Weather](https://minecraft.wiki/w/Weather) 雷暴节原文 "At noon the internal sky light level at surface is only 10. However, in mob spawning system, the light level from the sky is treated as if it were 0, allowing hostile mobs to spawn at any time of the day."（译：正午地表 internal sky light 只有 10；但刷怪系统把天空光当作 0 处理，允许敌对生物在一天中任何时候生成。）注意 [Light](https://minecraft.wiki/w/Light) 页脚注说的是"当作 5"，两页措辞略有出入（0 vs 5），**效果一致：雷暴白天也能刷怪**。

### 1.5 gamerule 与 /time 命令

- 开关昼夜：原文 "To enable or disable the daylight cycle, use the following command: `/gamerule advance_time`(JE) / `/gamerule dodaylightcycle`(BE) true|false"。（来源：[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle)，已抓取）
- **改名历史**：`doDaylightCycle` 在 Java 1.6.1（13w24a）加入；**Java 1.21.11 快照 25w44a 把所有 gamerule 移入注册表并改名，`doDaylightCycle → advance_time`**（同批还有 `doWeatherCycle → advance_weather`、`doInsomnia → spawn_phantoms` 等）。Bedrock 保持 `dodaylightcycle`（Bedrock 1.1.0 alpha 加入）。（来源：[Game rule](https://minecraft.wiki/w/Game_rule) 改名清单与 History，已抓取）
- `/time set <number|day|noon|night|midnight>`（Java）；Bedrock 另有 `sunset`/`sunrise`。取值：day=1000、noon=6000、night=13000、midnight=18000、sunset=12000（BE）、sunrise=23000（BE）。`/time set 0` = 一天开始（06:00）。`/time add 24000` 推进一天换月相。（来源：[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle)，已抓取）
- 联机时昼夜照常推进；游戏暂停（菜单）时昼夜暂停（单机）。（来源同上）

### 1.6 床睡觉跳夜

（来源：[Bed](https://minecraft.wiki/w/Bed) Sleeping 节，已抓取）

- **可睡条件**：原文 "A player sleeps by using a bed when the internal sky light is 11 or below. This occurs between 12523 and 23477 ticks in clear weather … between 12002 and 23998 ticks in rainy weather, and at any time of day during thunderstorms."（译：当 internal sky light ≤ 11 时可以用床睡觉——晴天 12523–23477 tick、雨天 12002–23998 tick、雷暴全天。）
  - 注意 [Daylight cycle](https://minecraft.wiki/w/Daylight_cycle) 的 24 小时表给出的是"晴天 12542 起 / 12010 雨天起"，两页相差约 20 tick（判定口径不同），量级一致。
- **周围无怪**：原文 "If a monster is within 8 blocks of the bed head horizontally (in the X- and Z-axis), and 5 blocks vertically (in the Y-axis) … the player is prevented from sleeping until the monsters leave or are killed."（译：床头水平 8 格、垂直 5 格内有怪物则不能睡，直到怪物离开或被杀。）多数敌对/中立怪都算（Java/Bedrock 名单略有差异：如岩浆怪/史莱姆 BE 算 JE 不算）。
- **睡醒时间**：原文 "A player sleeps in a bed for 101 in-game ticks, or 5.05 seconds before the time skips to the next day." 与 "after 5 seconds (100 ticks) the time of day changes to sunrise. (time 0)"（译：睡 101 tick 后时间直接跳到下一天日出 = tick 0）。**睡觉同时清空天气**："Sleeping changes the time of day to sunrise and resets the weather cycle, changing the weather to clear conditions."（Java 仅在雨/雪天重置天气循环。）
- **睡觉不加速世界过程**："Sleeping does not accelerate processes that take place over time such as the growth of crops or smelting."（译：睡觉不加速作物生长、熔炼等随时间进行的过程。）
- 联机跳夜比例由 gamerule `players_sleeping_percentage` 控制（默认 100%）。
- **Bedrock 差异**：消息走聊天框（Java 显示在快捷栏上方）；入睡有 Ore UI 动画；**Peaceful 难度下睡觉回满血**（BE only）；下界/末地的床爆炸规则两版一致（威力 5）。
- 尺寸细节：Java 距床 3 格内、Bedrock 2 格内才能睡。

### 1.7 时钟（Clock）

- 合成：4 金锭（十字）+ 1 红石（中心）。原文配方（来源：[Clock](https://minecraft.wiki/w/Clock)，已抓取）。
- 行为：原文 "The dial always shows the current in-game time when in the Overworld, regardless of where it appears. This includes a player's hand, an inventory slot, a crafting grid, an item frame, or even as a dropped item."（译：在主世界，表盘无论出现在哪——手上、物品栏、合成格、展示框、掉落物——都显示当前时间。）时间突变（睡觉/`/time`）时表盘快速旋转追平。
- **下界/末地**：原文 "Because there is no day–night cycle in The Nether or The End, clocks do not work properly in these dimensions. Instead, the dial rotates rapidly and randomly."（译：下界和末地没有昼夜循环，时钟不能正常工作，表盘快速乱转。）（来源同上）
- 判夜技巧（来自同页）："The player is able to sleep a few seconds after the clock shows exactly dusk."（表盘恰好显示黄昏后几秒即可睡觉。）

### 1.8 月相

（来源：[Moon](https://minecraft.wiki/w/Moon)，已抓取）

- **8 相、每天换**：原文 "The moon … goes through eight lunar phases, and changes phase at the end of every sunrise."（译：月亮有 8 个月相，在每次日出结束时换相。）顺序（Java 排列）：满月 → 亏凸月 → 下弦月 → 亏蛾眉月 → 新月 → 盈蛾眉月 → 上弦月 → 盈凸月；**Bedrock 顺序相反**（"Moon phases follow the direction of real moon phases in the southern hemisphere in Java Edition, or reverse in Bedrock Edition."）。
- 公式：原文 "There is an equation to calculate the moon phase on any given day: `phase = (day mod 8) + 1`."
- **wiki 确认的效果只有三条**：
  1. 沼泽史莱姆数量与月圆度成正比（满月最多、新月为 0；不影响史莱姆区块内 Y<40 的生成）；
  2. 月相影响区域难度（regional difficulty）——骷髅/僵尸拾取装备与带武器出生率、天然装备附魔、蜘蛛随机增益效果概率；
  3. 仅满月时黑猫有 1/11 出生概率。
- **没有潮汐系统**（wiki 无任何潮汐条目；夜光/亮度差异见 §1.4 午夜 4）。Moon 页"nighttime lasts about 7 minutes"对应的是 internal sky light 停留在最低段（13670–22330，8660 tick ≈ 7 分 13 秒）的口径；夜段全长（13000–23000）按 [Daylight cycle](https://minecraft.wiki/w/Daylight_cycle) 是 8 分 20 秒——两处口径不同，以 Daylight cycle 页为准。

---

## 2. 光照系统

### 2.1 光等级与两条通道

（来源：[Light](https://minecraft.wiki/w/Light)，已抓取）

- **0–15 共 16 级**：原文 "There are 16 light levels, specified by an integer from 0 (the minimum) through 15 (the maximum)."
- **两条主通道**：原文 "There exist two main types of light: sky light and block light."（天空光与方块光。）调试屏的 **client light** 公式：原文 "calculated by the formula: `max(sky light, block light)`"。
- **游戏逻辑用的 internal light**：原文 "the internal light level is calculated as the maximum level of the block light and the internal sky light (formula: `max(internal sky light, block light)`)"。主世界如此；其他维度没有天空光，internal light = block light。
- 即：**画面的暗（夜晚）走渲染曲线，逻辑的暗（刷怪）走 max(暗化天空光, 方块光)**——火把光能"顶替"夜晚的天空光，这就是火把防刷怪的机制基础。

### 2.2 传播规则

（来源：[Light](https://minecraft.wiki/w/Light)，已抓取）

- **方块光**：flood fill，每格 −1，按曼哈顿距离（taxicab）计。wiki 原例："If a torch with light level 14 is placed on the floor, the light level of the adjacent floor blocks in all four directions is 13, while the diagonal blocks in all four directions have a light level of 12 (14 minus 1 south, minus 1 east)."（译：地面上的 14 级火把，四邻格 13，对角格 12。）地面呈菱形光斑。
- **完全不透明方块**挡光；玻璃、铁栏杆等透明方块不衰减天空光。
- **天空光**：原文 "The sky light level for blocks vertically exposed to the sky is 15."；"When sky light of a level of 15 spreads down through a transparent block, the level remains unchanged. When it spreads horizontally or upwards, it reduces its level by 1."（译：15 级天空光向下穿过透明方块不衰减；横向或向上传播每格 −1；<15 的天空光则像方块光一样六向每格 −1 直到 0。）——"垂直暴露于天空"即 heightmap 顶的概念（wiki 无独立 heightmap 词条；Bedrock 刷怪一节用 "the highest spawnable block at a given coordinate" 表达同一概念，见 [Mob spawning](https://minecraft.wiki/w/Mob_spawning)，已抓取）。
- **滤光方块**：
  - Java：水、冰、蜘蛛网、树叶、史莱姆方块、蜂蜜块、刷怪笼、熔岩、信标、紫颂植株/花、潜影盒、气泡柱等**统一让天空光 −1**（不影响方块光）。
  - Bedrock：按方块扣不同数值（原文表摘录）：树叶 −2、水/蜘蛛网/细雪/台阶 −1、铁砧/漏斗/酿造台/炼药锅/冰 −3、信标 −14。（已抓取）
- Java 还会对活塞、耕地、讲台、台阶、楼梯等做**形状感知**（方向性透光），如土路不向下传光（原文见 Light 页 Block light/Sky light 两节，已抓取）。

### 2.3 敌对生物刷怪的光照规则（重点：1.18 分界）

**Java 版现行（1.18+）**（来源：[Light](https://minecraft.wiki/w/Light) Effects of light / Mobs 节 + [Mob spawning](https://minecraft.wiki/w/Mob_spawning) Spawn conditions 节，已抓取）：

- 总则原文："These mobs need a maximum internal sky light level of 7 (however, the smaller the value, the more successful spawn attempts happen) and a block light level of 0 to spawn."（译：这些怪需要 internal sky light ≤ 7 且 block light = 0 才能生成；值越小刷怪尝试越容易成功。）
- 随机化判定："When doing the light check in the Overworld and End, the spawn chances are randomized and a spawn only occurs if the light level is less than or equal to a random number between 0 and 7."（译：主世界/末地做光照检定时，仅当光照 ≤ 一个 0–7 的随机数才生成。）下界："as long as the light level is 11 or below, the spawn is allowed."（下界光照 ≤ 11 即允许。）
- **版本分界（必须写明）**：[Light](https://minecraft.wiki/w/Light) History 原文："**1.18 (Experimental Snapshot 1)**: Block light level now must be 0 for many hostile mobs to spawn (the sky light can still prevent these mobs from spawning like before)."（译：1.18 起众多敌对生物生成要求方块光为 0；天空光仍照旧阻止生成。）——**1.18 之前（自 2010 年 Alpha v1.2.1 起）的规则是"光照 ≤ 7 即可刷"**，[Mob](https://minecraft.wiki/w/Mob) History 原文："v1.2.1: Reverted hostile mob spawning code back to light level 7 or lower, regardless of height."（译：敌对生物生成改回"光照 7 或更低、与深度无关"。）因此"火把周围光 ≥ 8 就不刷怪"是**旧版（≤1.17）口径**；1.18+ 语义变为"**只要目标格 block light ≥ 1（有任何火把光）就不刷**，天空光是否 ≤7 另算"。
- Java 1.18 发布于 2021-11-30（wiki History 链接官方公告 "Caves & Cliffs: Part II out today on Java, November 30, 2021"，已抓取）。

**Bedrock 版现行**（来源：[Mob spawning](https://minecraft.wiki/w/Mob_spawning) Bedrock spawn conditions，已抓取）：

- 原文："Most Overworld monsters cannot spawn if the sky light level is greater than or equal to 7 or the block light level is greater than 0."（译：大多数主世界怪物在 天空光 ≥ 7 **或** 方块光 > 0 时不能生成。）——即同样要求"天空光 < 7 且方块光 = 0"。**Bedrock 何时从"光照 ≤ 7"改为该规则的准确版本号，现行 wiki 未记载（未能核实）**；以现行 wiki 口径为准。
- 动物（对比用）：Java "require a block light level of 9 or higher when the block is not exposed to the sky"；Bedrock "most animals can spawn at light level 7 or higher rather than 9 or higher"（Bedrock 动物看合并光 ≥ 7）。（来源：[Light](https://minecraft.wiki/w/Light) Mobs 节 + [Mob spawning](https://minecraft.wiki/w/Mob_spawning)，已抓取）

**个别怪物的光照/条件差异**（来源：[Light](https://minecraft.wiki/w/Light) 两张 Mobs 表——主世界表按 block light 0–15 列、下界表同，已抓取）：

| 怪物 | 生成光照（现行） | 其他关键条件 |
|---|---|---|
| 骷髅 / 僵尸 / 溺尸 | block light 0（主世界）；骷髅下界灵魂沙峡谷可到 11 | 骷髅/僵尸 block light 15（晴天户外）时不生成且**阳光燃烧**；尸壳需头顶露天 |
| 苦力怕 / 女巫 / 尸壳 | block light 0 | 不燃烧（苦力怕无燃烧条目） |
| 蜘蛛 / 洞穴蜘蛛 | block light 0 | block light ≥ 12 时中立（除非已被激怒） |
| 末影人 | block light 0（全三维） | 天空光 15 时随机传送 |
| 蝙蝠 | **block light ≤ 3** 且在固体方块下 | 亮度 >3 不生成 |
| 史莱姆（史莱姆区块） | **任意光照**，Y −64–40 | 与光照无关（表格原文 "Spawn in slime chunks at Y: -64–40"） |
| 史莱姆（沼泽） | block light ≤ 7 | Y 51–69（[Mob spawning](https://minecraft.wiki/w/Mob_spawning)）/ Y 50–70（[Light](https://minecraft.wiki/w/Light) 表，两页口径差 1 格，均已标注）；失败率随月相 |
| 幻翼 | block light ≤ 7 | 玩家 3 个游戏日未睡/未死才可生成；block light 15 时燃烧 |
| 烈焰人（下界要塞） | **block light ≤ 11** | 下界总则"光照 ≤ 11 即允许" |
| 恶魂/岩浆怪/猪灵类 | 任意光照（表格 colspan 16） | — |

### 2.4 渲染亮度（brightness curve）

（来源：[Light](https://minecraft.wiki/w/Light) Rendered brightness 节，已抓取）

- 原文："the game uses the light level (instead of internal light level), time, and weather to compute the rendered brightness of a given object"；"sky light is not reduced at night, instead, **the brightness curve itself changes based on the time**"（译：渲染亮度由光等级 + 时间 + 天气共同计算；夜晚不是天空光变小，而是亮度曲线本身随时间变暗）。
- 数值锚点（最低亮度档/gamma=0）：原文 "In the Overworld with the lowest brightness setting, full daylight reaches 98% brightness, while at night brightness is reduced to about 17% and is shaded blue. Full darkness is about 5% brightness."（译：最低亮度设置下，主世界满日照约 98% 亮度，夜晚降到约 17% 且偏蓝；全黑约 5%。）Bedrock 日出日落有动态橙色染色（"brightness during sunrise and sunset is dynamically tinted orange"）。
- 方块光偏橙："Light due to blocks also tends toward orange in the middle ranges, while sky light in the Overworld daytime is white."（译：中等档位的方块光偏橙，白天主世界天空光为白色。）
- **具体的亮度曲线/gamma 公式现行 wiki 已不再给出**（仅有 lightmap 纹理截图与上述百分比锚点）——旧版 wiki 的显式公式**未能核实**（现行页面无此内容）。

### 2.5 与夜间玩法直接相关的其他刷怪约束

（来源：[Mob spawning](https://minecraft.wiki/w/Mob_spawning)，已抓取）

- **24 格不刷**：原文 "There must be no players or the world spawn point within a 24 block radius (spherical) of the spawning block."（刷怪格 24 格球形范围内不得有玩家/世界出生点。）
- **刷怪半径**：Java 自然刷怪发生在玩家 128 格球形内（区块中心水平 128 格内有玩家）；Bedrock 在距玩家 24–44 格（模拟距离 4）或 24–128 格球壳（模拟距离 ≥6，水平另有约 96 格限制）内。**即两版 24 格内都绝不刷**。
- **周期**：Java "Most mobs have a spawning cycle once every game tick"（多数怪每 game tick 一个刷怪周期），被动怪每 400 tick 一次；Bedrock "There is a 11/2000 chance of the mob spawning algorithm attempting to run per chunk, per tick."
- **上限**：Java 怪物（monster 类）上限 70；Bedrock 全局上限 200（另有 9×9 区块的种群上限与密度上限）。
- **消失（despawn）**：Java：离玩家 >128 格立即消失；32–128 格区间闲置 30 秒后每 tick 1/800 概率消失（怪物在 >12 光照下闲置计数加速，10 秒即可开始消失）。这解释了为什么"夜里远处刷的怪，白天晒一晒就没了"。

### 2.6 阳光燃烧（亡灵生物）

**"阳光"的严格定义**（来源：[Sun](https://minecraft.wiki/w/Sun) Sunlight 节，已抓取）：

- 原文："Strictly speaking, sunlight can be considered as the presence of both an **internal sky light level of at least 12** and a **sky light level of 15**."（译：严格说，"阳光"可视为 internal sky light ≥ 12 **且** sky light = 15 同时成立。）——即**既要求垂直暴露于满天空光（sky light 15，几何直射），又要求时间/天气足够亮（internal ≥ 12）**；只满足 sky light 15 而在夜里/雨天仍不算。
- 同节："Mobs can shelter from the sunlight by staying underneath any block that does not fully let light through, like glass does, therefore creating a shadow. Clouds can hide the sun, but do not technically block any light and let mobs still burn."（译：站在不完全透光的方块下可以躲避阳光——玻璃那种全透光的不算；云能遮住太阳但技术上不挡光，怪照样烧。）"During inclement weather, the sky darkens and reduces the amount of light in the world."（坏天气使天空变暗、世界光量减少。）

**通用亡灵规则**（来源：[Light](https://minecraft.wiki/w/Light) Mobs 节，已抓取）：原文 "Several undead mobs are set on fire for 8 seconds when hit by sunlight; these mobs try to avoid such areas and do not burn while **in water, in the rain, wearing a helmet, or in the shade**."（译：若干亡灵被阳光点燃（8 秒）；它们会避开此类区域，在水中、雨中、戴头盔、阴凉处不燃烧。）——此句为跨版通则。

**僵尸**（来源：[Zombie](https://minecraft.wiki/w/Zombie)，已抓取）：

- 时间点：原文 "Zombies burn when exposed to direct sunlight starting 27 seconds (540 ticks) before the beginning of a new day."（译：僵尸从新一天开始前 27 秒/540 tick 起暴露于直射阳光即燃烧——即 tick 23460。）
- 抑制条件（原文列表）：所在处 **sunlight level ≤ 14**（即需要满值）；在水中；**戴头部盔甲**（头盔每燃烧 tick 50% 概率掉 1 耐久）；抗火效果；站在蜘蛛网里（MC-62182，WAI）。
- 原文 "Transparent blocks, such as glass, do not prevent them from burning."（译：玻璃等透明方块不阻止燃烧。）

**骷髅**（来源：[Skeleton](https://minecraft.wiki/w/Skeleton)，已抓取）：

- 触发：原文 "When the moon can no longer be seen (Dawn) and the sun is above 15°, skeletons can burn."（译：黎明月亮消失且太阳升到 15° 以上时骷髅开始燃烧。）
- 抑制条件（原文列表）：头顶有非空气方块（**Java 版要求该方块挡光**）；"in a sufficiently shaded area: a **sunlight level of 11 or less**"（足够阴凉处：sunlight level ≤ 11）；在水中（骷髅会主动找水）；戴头盔；抗火；蜘蛛网。
- 原文 "Transparent and translucent blocks, including glass and ice, do not prevent them from burning.{{only|java}}"（玻璃/冰不挡燃烧，Java 标注）；与僵尸不同，骷髅白天会主动找掩体。
- **注意**：僵尸页抑制阈值写 ≤14、骷髅页写 ≤11，两页原文不一致（见附录·未能核实 4）；但"需要近似满日照直射 + 水中/头盔/阴凉豁免 + 玻璃不挡"的结论两版两页一致。

**Bedrock 差异**：燃烧规则与 Java 基本一致；[Weather](https://minecraft.wiki/w/Weather) 雨水一节明确 "Mobs that are on fire are extinguished on contact with rain; **this prevents skeletons and zombies from burning during the day**."（译：接触雨水会浇灭身上的火，白天骷髅/僵尸因此不燃烧。）（已抓取）时间锚点：晴天 12542 停止燃烧（黄昏）、23460 恢复（黎明），雨天顺延（§1.2 表）。

---

## 3. 火把（Torch）

### 3.1 获得：合成与天然生成

（来源：[Torch](https://minecraft.wiki/w/Torch)，已抓取）

- **配方**：木棍 + 煤/木炭（竖排）→ **4 支火把**（配方模板原文 `B2 = Coal; Charcoal / B3 = Stick / Output = Torch, 4`）。Java Beta 1.2 起支持木炭合成（原文 "Torches can now be crafted using charcoal, making them the first renewable light source…"）。
- 天然生成：矿井走廊支架、村庄灯柱与多数房屋、要塞各房间、雪屋地下室、林地府邸、掠夺者前哨站顶、古城。
- 挖掘：**任何工具即时破坏并掉落自身**（"broken instantly using anything, and drop themselves as an item"）。

### 3.2 火把能否当燃料：**不能**

- [Torch](https://minecraft.wiki/w/Torch) 全文（已抓取）无任何"作为燃料/Fuel"章节；wiki 权威燃料总表（[Smelting](https://minecraft.wiki/w/Smelting) 的 `{{Smelting table}}` 完整模板，已抓取并全文检索）**不含火把/灵魂火把**。0.5 件燃料的是碗、木按钮、杜鹃花等（web 检索核对，非火把）。
- 结论：**两个版本火把都不能当熔炉燃料**。（这是常见误区，例如把"火柴"直觉带进 MC。）

### 3.3 手持火把是否发光：**不发光（推断，wiki 无直接原文）**

- **未能核实项**：现行 wiki（Torch / Light / Soul Torch 各条目，均已抓取全文）**没有一句"手持火把发光/不发光"的直接原文**——因为 vanilla 根本不存在"手持光源"概念，wiki 不为"不存在的东西"写条目。
- 推断链（明确标注为推断，非 wiki 原文）：[Light](https://minecraft.wiki/w/Light) 把 block light 定义为来自"**light-emitting blocks**（发光方块）"，光源清单全部是**放置后的方块**（见 §4 表）；手持/掉落的火把是 **item** 形态，不在任何光源清单中。因此 Java 与 Bedrock 的 vanilla 行为都是：**主手/副手持火把不产生光照**。
- 二手佐证：CurseForge/Modrinth 的 Dynamic Lights、Bedrock 的 Dynamic Light addon 等模组/附加包的存在意义就是补上这个能力（web 检索，2026-10-25）。
- **副手持火把的实际意义**是通用副手机制：另一只手拿镐/剑的同时可以用副手放置火把（wiki 手持物动作调研详见本仓库 [mc-held-item-action-research.md](mc-held-item-action-research.md)），与光照无关。

### 3.4 放置规则

（来源：[Torch](https://minecraft.wiki/w/Torch)，已抓取）

- 原文："Torches can be placed on the **top or the sides** of most solid blocks, although some blocks require sneaking. Being non-solid, torches have no collision box."（译：火把可放在多数固体方块的**顶面（立式）或侧面（壁挂倾斜）**，个别方块需潜行；火把非固体、无碰撞箱。）
- **不能放天花板**：Torch 页方块状态原文——Java 仅有 `torch` 与 `wall_torch`（`facing: north/south/east/west`）；Bedrock `torch_facing_direction` 取值 `west/east/north/south/top`——**没有 bottom/ceiling 值**，即不存在"倒挂火把"。
- 具体哪些方块能放/不能放：wiki 转至 [Opacity/Placement](https://minecraft.wiki/w/Opacity/Placement)（巨型矩阵页，已抓取确认存在；火把页正文只给通则）。历史条目可作参考：玻璃**顶面**可放（Java 1.2.1/12w07a 原文 "Torches can now be placed on top of glass blocks"）、栅栏顶可放（1.7）、火把曾短暂不能放萤石（Beta 1.6 Test Build 3 → 1.6.6 恢复）。
- **支撑方块被破坏后**：原文 "A torch is removed and drops itself as an item if: Its attachment block is moved, removed, or destroyed; Water flows into its space; A piston pushes it or moves a block into its space."（译：依附方块被移动/移除/破坏、水流入、活塞推挤时，火把掉落为物品。）**熔岩**流入则直接销毁无掉落（"When lava flows into a torch's space, it will be destroyed without dropping anything."）。
- 彩蛋机制（对本项目可有可无）：沙/砾石落在火把上会被破坏成掉落物（重力方块粉碎机原理）。

### 3.5 生效：光照与衍生机制

（来源：[Torch](https://minecraft.wiki/w/Torch)、[Soul Torch](https://minecraft.wiki/w/Soul_Torch)、[Light](https://minecraft.wiki/w/Light)，已抓取）

- **光等级 14**：原文（Torch 页）"Torches give off a light level of 14."；按 §2.2 每格 −1 传播，**有效照亮半径 13 格**（距火把曼哈顿距离 13 处为 1 级，14 格处为 0），地面上呈菱形。
- **阻止敌对生物生成**：机制即 §2.3——火把让周围格 block light ≥ 1，从而在 Java 1.18+ / Bedrock 现行规则下直接封死"block light = 0"条件；在 Java ≤1.17 旧规则下则需推到 ≥ 8（半径 6 格）才保险。**做"火把=安全区"的机制依据即此**。[Light](https://minecraft.wiki/w/Light) Mobs 节原文："torches and other light-emitting blocks prevent the mobs' spawn."（译：火把与其他发光方块阻止这些怪生成。）
- **融雪/融冰**：原文（Torch 页）"Torches also melt snow layers within 2 blocks and ice within 3 blocks (taxicab distance)."（译：火把融化 2 格内雪层、3 格内冰。）与 [Light](https://minecraft.wiki/w/Light) 方块效果表对得上：**雪 block light ≥ 12 融化、冰 ≥ 11 融化**（14−2=12、14−3=11；边界档 11/10 在 Java 有"既不结也不融"的已知 bug MC-217420/MC-217424，Bedrock 行为不同，已标注）。
- **作物生长**：[Light](https://minecraft.wiki/w/Light) 方块效果表（Java）——小麦/胡萝卜/马铃薯/甜菜根在 **client light ≥ 9** 才生长，≤7 连根拔起（Java）/"不生长"（Bedrock，MCPE-36863）；client light = max(sky, block)，**火把光当然算数**（火把周围曼哈顿 5 格内 block light ≥ 9）。原文："most types of plants can grow at night … as long as plants of certain types are receiving a sufficient sky light value"（Java 多数作物夜里靠天空光也能长）。树苗同样 ≥9（检查上方一格）。
- **火把永不熄灭/烧完**：现行 Torch 条目全文无任何耐久/熄灭机制；History 仅存一条 2010-10-04 的未实现计划，原文 "Notch originally planned for torches to become temporary light sources that would eventually burn out and require re-lighting with flint and steel. This was planned to add with the Halloween Update."（译：Notch 原计划让火把成为最终会烧完、需用打火石复燃的临时光源，拟随 2010 万圣节更新加入。）——从未实装。
- **灵魂火把 vs 普通火把**（来源：[Soul Torch](https://minecraft.wiki/w/Soul_Torch)，已抓取）：

| 属性 | 火把 | 灵魂火把 |
|---|---|---|
| 配方 | 煤/木炭 + 木棍 → 4 | 煤/木炭 + 木棍 + 灵魂土/灵魂沙 → 4 |
| 光等级 | 14 | **10** |
| 融雪(≥12)/融冰(≥11) | 能（2/3 格内） | **不能**（原文 "Because their light level is lower than 12, soul torches do not melt snow or ice."） |
| 防刷怪（block light ≥1 即可） | 能 | 能（10 级传播 9 格仍有 1） |
| 对生物 | — | **驱赶猪灵**（"Soul torches repel piglins but not piglin brutes."）；不属于 piglin_repellents 的火把无此效 |
| 光色（Vibrant Visuals 点光源） | #f39a5e（暖橙） | #36d9e6（青蓝） |
| 依附/破坏行为 | 相同 | 相同（同一套规则） |

---

## 4. 其他光源对照与联动机制

### 4.1 主流光源发光等级对照表

（全部来自 [Light](https://minecraft.wiki/w/Light) Light-emitting blocks 表，已抓取；"实验性颜色"列为 Vibrant Visuals 点光色，仅参考）

| 光源 | 光等级 | 备注 |
|---|---|---|
| 灯笼 Lantern | **15** | 点光源 #f39a5e |
| 萤石 Glowstone | **15** | — |
| 海晶灯 Sea Lantern | **15** | #b0dad3 |
| 菌光体 Shroomlight | **15** | #d3852b |
| 营火（点燃）Campfire | **15** | 灵魂营火只有 10 |
| 熔岩 Lava / 熔岩锅 | **15** | — |
| 南瓜灯 Jack o'Lantern | **15** | #d3852b |
| 火 Fire | **15** | — |
| 信标 Beacon / 潮涌核心 Conduit（激活） | 15 | — |
| 红石灯（点亮） | 15 | 需红石 |
| 铜灯笼 Copper Lantern | 15 | 1.21+ 新方块；同族铜灯泡（点亮）随氧化 15/12/8/4 |
| **火把 Torch** | **14** | 点光源 #f39a5e |
| 末地烛 End Rod | **14** | 点光源 #da73de |
| 铜火把 Copper Torch | 14 | — |
| 熔炉/高炉/烟熏炉（点燃） | 13 | — |
| 下界传送门 | 11 | #a233eb |
| 哭泣的黑曜石 Crying Obsidian | **10** | #a233eb |
| 灵魂火把 / 灵魂灯笼 / 灵魂营火 / 灵魂火 | **10** | #36d9e6 |
| 红石火把（点亮） | **7** | 点光源 #c32c1f |
| 附魔台 / 末影箱 / 发光地衣 | 7 | — |
| 紫水晶簇 | 5 | — |
| 岩浆块 Magma Block | **3** | — |
| 萤火虫丛 Firefly Bush | 2 | #e8c398 |
| 棕色蘑菇 / 酿造台 | 1 | — |
| 光方块 Light (block) | 0–15 可调 | 命令方块专用 |

### 4.2 与昼夜/光照联动最强的机制

- **雷暴与床**：雷暴 internal sky light = 10，**全天任意时刻可睡觉**（[Bed](https://minecraft.wiki/w/Bed)，已抓取）；白天也能刷怪（§1.4）。雷暴时床爆炸规则不变（仅限错误维度）。
- **村民作息**（[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle) 24 小时表，已抓取）：Java 村民 2000 开始工作、9000 下班社交、**12000 日落时上床**；Bedrock 0 点起床即开始工作、8000 社交、10000 复工——两版作息表不同（wiki 逐行标注 JE/BE）。雨天村民回家（[Weather](https://minecraft.wiki/w/Weather)，已抓取）。
- **蝙蝠**：主世界唯一按光照生成的环境类生物——**block light ≤ 3 且头顶有固体方块**才生成（[Light](https://minecraft.wiki/w/Light) Mobs 表，已抓取），是最"暗处指示器"式的生物。萤火虫丛（1.20.5+）夜里冒萤火虫粒子、光级只有 2（同表）。
- **亡灵燃烧时间表**：晴天 12542 停止燃烧（黄昏）→ 23460 恢复燃烧（黎明），雨天再推迟（[Daylight cycle](https://minecraft.wiki/w/Daylight_cycle) 24 小时表，已抓取）；雨天浇灭身上的火（[Weather](https://minecraft.wiki/w/Weather)："Rain extinguishes fires … this prevents skeletons and zombies from burning during the day."）。
- **蜜蜂/睫颜花（eyeblossom）等次要昼夜事件**：蜜蜂 12542 回巢/23460 出巢；睫颜花 12600 开、23401 谢夜（同表，已抓取）。幻翼：3 个游戏日不睡觉才生成（§2.3 表）。

---

## 5. 对本项目的落地启示

> **性质声明**：本节是**推断性设计建议**，不是 §1–§4 那样的事实论断；目的是把 MC 的"官方手感"翻译成 my-craft-demo（体素世界、Three.js r128 经典 script 架构、目标用户 6 岁、无构建步骤）能直接用的参数。所有偏差 MC 原作的地方都注明了理由。

### 5.1 昼夜循环参数

- **时间制**：沿用 MC 的 `dayTime ∈ [0, 24000)`、20 tick/秒语义，驱动用秒即可：`dayTime = (dayTime + dt * 20) % 24000`。tick 0 = 06:00（与 MC 一致，别按 0 点=午夜直觉去做）。
- **一天时长对 6 岁孩子偏长**：MC 的夜有 8 分 20 秒，低龄玩家易焦虑。建议把昼夜比例做成常量：白天段（0–12000）保持，**夜晚段压缩到 2–3 分钟**（等价于把 13000–23000 映射更短），或保持 MC 比例但提供**床/睡袋一键跳夜**（MC 语义：直接设 dayTime = 0）。二者选一即可，不建议同时上。
- **天空光映射表（可直接抄的折线）**：`skyDarken(time)` 晴天关键点（来自 §1.4，MC 原值）：`(0,15) → (12040,15) → (13670,4) → (22330,4) → (23961,15)`，中间线性插值；天气修正：雨天上限 12、雷暴上限 10。渲染上建议再加一步 gamma：`sceneLight = 0.17 + 0.83 * (skyDarken / 15)`，其中 0.17 来自 MC 夜晚约 17% 亮度的锚点（§2.4）；夜晚色调偏蓝（MC 同款）。
- **天体角度**：MC 公式（§1.3）是变角速度近似；本项目做太阳/月亮贴图旋转时**用线性 `angle = (dayTime/24000) * 2π` 即可**，6 岁用户感知不出差异；若追求 MC 观感再抄原公式。

### 5.2 光照引擎（Three.js r128 约束下的做法）

- **数据层完全照抄 MC**：两通道 `blockLight`（flood fill，曼哈顿距离每格 −1）+ `skyLight`（heightmap 列 15，向下不衰减、横向 −1），最终亮度 `max(skyDarken(skyLight), blockLight)`。这套整数规则实现简单、可单测，且和 MC 数值完全可对照。
- **渲染层不要用 Three.js 动态光**（PointLight 数量受限且无体素感）：建议**顶点色/面光烘焙**——把每格亮度乘进顶点色（`mesh.geometry` 顶点色 + `vertexColors: true`），方块光乘暖色（火把 #f39a5e）、天空光乘白色、夜晚天空光乘蓝调，正好复刻 MC"方块光偏橙、天空光偏白/夜偏蓝"的观感（§2.4）。
- 火把增删只需局部重算 flood fill（半径 14 的盒子），不用全图重算——这与本仓库现有 chunk 局部更新模式一致。

### 5.3 火把参数

- **光等级 14、照亮半径 13（曼哈顿）**：照抄。对孩子可以额外画一个柔和的地面光晕贴片（半径 5–6）帮助理解"火把管哪片"，机制仍按 13。
- **防刷怪语义采用 Java 1.18+ 口径**（block light ≥ 1 即不刷）：实现最简单——`canSpawn = blockLight === 0 && skyDarken(skyLight) <= 7 && distToPlayer > 24`，一条表达式。**不要**按 ≤1.17 的"光照 ≤7"做，否则火把要摆得非常密（半径 6 才到 8 级），对孩子太苛刻。
- **融雪 ≥12、作物 ≥9** 可作为彩蛋机制；对孩子建议只保留"作物夜里不长/长得慢"的简化版（光 ≥9 生长），火把光算数（MC 同款）。
- **火把不会烧完、不能当燃料**：照抄 MC——孩子无需燃料管理；同时把"火把不是燃料"写进设计文档防踩坑（§3.2 误区）。
- **放置规则**：顶面立式 + 侧面壁挂倾斜两种姿态、不能放天花板、依附方块破坏即掉落为物品——这四条照抄 MC，交互自然且实现只是方块状态 + 射线命中面判断。
- **（可选故意偏离）手持火把发光**：MC 原作手持不发光（§3.3）；但 6 岁孩子下矿洞容易怕黑，建议**故意偏离**：手持火把时给玩家所在格 blockLight 视觉加成（如视半径 6 内最低亮度抬到 7）。若偏离，在代码注释与本文档登记"有意偏离 MC"即可；若不偏离，则正好用游戏教会孩子"进洞要放火把"。

### 5.4 刷怪/安全区（孩子难度简化）

- **只在夜间 + 火把外刷**：`isNight = dayTime ∈ (13188, 22812)`（MC 晴天户外可刷怪窗口，§1.2）或简化为 13000–23000。
- **24 格安全圈**：照抄 MC（§2.5）——这同时天然保证"怪物不会在孩子脸前凭空出现"。
- **怪物上限 10–15 只**（MC Java 70 / Bedrock 200 对孩子太多），周期建议 1–2 秒一次判定即可（MC 每 tick 一次没必要）。
- **黎明清场**：MC 的做法是亡灵 23460 起阳光燃烧；对孩子建议直接"太阳升起 → 夜间怪原地消失 + 冒烟粒子"（比燃烧动画温和，避免吓到孩子；若做燃烧，参考 §2.6 豁免规则：水中/戴头盔不烧可全部省略）。
- **不做**的 MC 子系统（明确排除，降低复杂度）：月相（含沼泽史莱姆丰度、区域难度）、雷暴（含白天刷怪、闪电转化）、幻翼（3 天不睡惩罚——对 6 岁孩子是负面压力）、随机化光照刷怪判定、精确的 0–7 随机刷怪检定。
- **床**：条件简化为"夜晚即可睡"（不做 internal sky light ≤11 与雨天窗口），睡后 dayTime = 0、天气清空、**夜间怪清场**（MC 只跳时间不清怪，这里故意更宽容）；"床边 8 格有怪不能睡"建议保留——它教孩子"先清怪再睡觉"的安全感闭环。

### 5.5 数值速查（实现时直接抄）

| 参数 | 建议值 | MC 出处 |
|---|---|---|
| 一天 | 24000 单位，驱动 `dt*20` | §1.1 |
| tick 0 | 06:00 | §1.2 |
| 夜间窗口 | 13188–22812（晴天户外刷怪窗口） | §1.2 |
| skyDarken 关键点 | (0,15)(12040,15)(13670,4)(22330,4)(23961,15) | §1.4 |
| 夜晚渲染亮度 | ≈17% + 蓝调；全黑 ≈5% | §2.4 |
| 火把光级/半径 | 14 / 13（曼哈顿） | §3.5 |
| 防刷怪条件 | blockLight ≥ 1（火把 13 格内） | §2.3 |
| 刷怪安全圈 | 距玩家 24 格 | §2.5 |
| 怪物上限 | 10–15（偏离 MC 的 70/200） | §2.5 |
| 融雪/冰/作物阈值 | 12 / 11 / 9 | §3.5 |
| 睡觉跳夜 | dayTime → 0，清天气（+清怪，故意偏离） | §1.6 |
| 火把暖色 / 灵魂火把 | #f39a5e / #36d9e6（光级 10） | §4.1 |

---

## 附：未能核实清单

1. **手持火把不发光**：wiki 无直接原文（§3.3 按光源定义推断 + 二手佐证）；若需"官方口径"级别的证据，只能引 Mojang 源码反编译（超出本次调研范围）。
2. **渲染亮度曲线的显式公式**（旧 wiki 曾有的 brightness/gamma 公式）：现行 [Light](https://minecraft.wiki/w/Light) 页已删除，仅存百分比锚点，未能核实原公式。
3. **Bedrock 从"光照 ≤7"改为"天空光 <7 且方块光 =0"的准确版本号**：[Mob spawning](https://minecraft.wiki/w/Mob_spawning) 的 Bedrock History 未记载该变动条目（现行规则本身有原文）。
4. **僵尸页"sunlight level ≤14 抑制燃烧"与骷髅页"≤11 抑制燃烧"的阈值差异**：两页原文各自如此（§2.6 引用原句），wiki 未解释差异原因，未能进一步核实。
5. Minecraft 官网帮助中心无这些数值的官方文档（本次调研以 minecraft.wiki 为唯一一手信源，未发现可用的官方数值页面）。
