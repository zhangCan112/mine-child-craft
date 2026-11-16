# 《塞尔达传说：旷野之息》(BotW) 篝火与上升热气流机制调研报告

> **调研说明**
> - 调研日期：2026-11-16。用途：新道具「篝火」（可放置/体素照明/冒烟/滑翔翼可乘上升热气流）的**需求参数输入**，机制原型源自 BotW。
> - 版本口径：BotW（Wii U/Switch，1.x 全系行为一致，未见版本差异报告）；续作 TotK 仅作旁证并单独标注，不混入 BotW 结论。
> - 信源纪律：按派令只认一手/高可信信源，本文引用分五级标注——
>   【官方文本】游戏内加载提示/道具说明（经 Zelda Wiki 逐字转录页核对）；【GDC 官方】任天堂开发者 GDC 演讲；【数据挖掘】zeldaret/botw 逆工程源码（游戏代码的函数级复刻）与 zeldamods.org 数据挖掘 wiki；【社区实测】Reddit/GameFAQs 多帖独立一致的玩家可复现口径；【攻略转述】单一攻略站数字（未获第二来源）。无法核实的数值一律标 **未验证**。
> - 获取方式标注：每条数值注明（实测 / 数据挖掘 / 攻略转述 / 物理分析）。Reddit·GameFAQs 引文取自搜索引擎快照（本环境直连受限），快照内容与原帖一致，已注明原帖 URL。
> - 与本仓库既有研究的关系：燃尽时长的「消耗品化」锚点交叉引用 `docs/minecraft-furnace-research.md`（MC 燃料表）；滑翔契约交叉引用 `docs/adr/0012`~`0016`。

---

## 0. 结论速览（TL;DR）

1. **点燃 = 木柴 + 点火源**，标准配方是「1 捆木柴 + 1 块打火石，用金属武器击打打火石出火花点燃」（打火石一次性消耗）；火焰武器/火箭/火杖/已点燃的火把或木械可直接点燃（来源: [Zelda Wiki: Campfire](https://zeldawiki.wiki/wiki/Campfire)（含官方 Tips 转录）、[IGN Wood 指南](https://ign.com/wikis/the-legend-of-zelda-breath-of-the-wild/Wood)、[Zelda Wiki: Wood](https://zeldawiki.wiki/wiki/Wood)）。
2. **BotW 营火没有燃尽计时器**：世界固定营火永久燃烧；玩家自建营火被「雨天/强风/坐火跳时间」熄灭，熄灭后留下未燃营火可再次点燃；**不存在「烧 X 分钟后自然熄灭」的燃料消耗机制**——这正是 PO 拍板不照抄的永久口径（来源: [Reddit 实测帖](https://reddit.com/r/Breath_of_the_Wild/comments/7okv5y/)、[Zeldapedia: Wood](http://zelda.wikia.com/wiki/Wood)、[Zelda Dungeon: Campfire](https://zeldadungeon.net/wiki/Campfire)）。燃尽数值须从相邻锚点移植（见 §6）。
3. **单个营火不产生可乘气流**：火势必须「扩散/堆叠」到一定规模才生成上升气流——社区一致口径 **4 捆木柴起流（3 捆可维持）/稳妥 4~5 捆**（来源: [MyGaming.News 气流指南](https://mygaming.news/zelda/guide-to-updrafts-botw)（攻略）、[Reddit 多帖实测](https://reddit.com/r/Breath_of_the_Wild/comments/byhtii/)、[GameFAQs](https://gamefaqs.gamespot.com/boards/632936-the-legend-of-zelda-breath-of-the-wild/75111710)）。
4. **气流只有燃烧中存在**（"lasts for as long as the logs burn"），火越大流越强（往火里追加木柴=更大火+更强气流）；多个气流可以在空中**纵向串联叠加**（边乘边点第二团火），BotW 玩家用 5 个辣椒串联堆出超希卡塔高度的气流（来源: [Reddit i6mflk](https://reddit.com/r/Breath_of_the_Wild/comments/i6mflk/)、[MyGaming.News](https://mygaming.news/zelda/guide-to-updrafts-botw)、[GameFAQs 76524529](https://gamefaqs.gamespot.com/boards/189707-the-legend-of-zelda-breath-of-the-wild/76524529)）。
5. **乘流 = 滑翔伞开伞进柱即被抬升**（官方加载提示原文："When fire spreads, it creates an updraft. You can use the paraglider to catch that updraft and ride it high into the sky."）；气流为**柱状**（"column of wind"），引擎侧带**旋转分量**与**温度驱动**（数据挖掘：`WindControl` 动作参数 `Radius/MaxSpeed/MaxRadSpeed/RadAccel/Temperature`，来源: [zeldaret/botw actionWindControl.h](https://github.com/zeldaret/botw/blob/master/src/Game/Actor/Action/actionWindControl.h)）。
6. 数值锚点：开伞**终端下沉速度 ≈ 3.2 m/s**（物理分析：约 70 m 高塔开伞下落约 22 s，来源: [莱斯特大学物理学生期刊](https://journals.le.ac.uk/index.php/pst/article/view/3330)）；纯滑翔平均水平速度 ≈ 5.7 m/s（22 分钟滑行 7500 m 的玩家记录，来源: [Nintendo Everything](https://nintendoeverything.com/player-sends-link-gliding-over-7500-meters-during-22-minute-flight-in-zelda-breath-of-the-wild)）。**气流风速与柱高的官方数值未验证**（数值在 actor 参数文件中，未见公开 dump）。

---

## 1. 点燃方式与所需材料

### 1.1 标准路径：木柴 + 打火石

- **材料：1 捆木柴（Wood）+ 1 块打火石（Flint）**。操作：手持两者丢在地上叠放，用**金属武器击打打火石**迸出火花点燃木柴；**打火石一次性消耗**（击打后消失），木柴转为燃烧的营火（来源: [IGN: Things You Should Know](https://ign.com/wikis/the-legend-of-zelda-breath-of-the-wild/Things_You_Should_Know_in_Breath_of_the_Wild)（"Hold one flint and one bundle of wood... strike the flint toward the wood with a metal weapon"）；打火石消耗为【社区实测】[Reddit: How to Start a Fire](https://reddit.com/r/Breath_of_the_Wild/comments/6147nm/how_to_start_a_fire)（"The flint sparks and is destroyed"））。
- 官方游戏内提示（加载画面 Tips，【官方文本】）："To start a campfire, simply set some wood ablaze. You can use a torch or some flint to do just that."——只钉「把木柴点着」这一目标，不限定点火源（来源: [Zelda Wiki: Campfire](https://zeldawiki.wiki/wiki/Campfire) 页内 `{{Cite|...|Tips and Tricks|BotW}}` 转录）。

### 1.2 点火源清单（全部可点燃营火）

| 点火源 | 额外材料消耗 | 来源 |
| --- | --- | --- |
| 打火石 ×1 + 任意金属武器 | 打火石 1 块 | IGN / Reddit（【社区实测】，见上） |
| 火焰武器（Flameblade/Great Flameblade/火杖/陨石杖）直接挥击木柴 | 0（武器仅耗耐久） | 【攻略】[PlayerAssist](https://playerassist.com/the-legend-of-zelda-breath-of-the-wild-how-to-start-a-fire)、【社区实测】[Reddit: Ditch the Flint](https://reddit.com/r/Breath_of_the_Wild/comments/614abz/ditch_the_flint_use_a_great_flameblade) |
| 火箭射木柴 | 1 支箭 | 【攻略】[MyGaming.News](https://mygaming.news/zelda/guide-to-updrafts-botw) |
| 已点燃的火把/木制武器/木枝接触 | 0 | 【官方文本】Zelda Wiki Campfire 页 Tips 转录（torch）；[Zeldapedia: Wood](http://zelda.wikia.com/wiki/Wood) |
| 炸箭爆炸的余焰 | 1 支炸箭 | 【攻略】MyGaming.News（同上） |
| 地形热（死亡山脉等高温区，木柴自燃） | 0 | 【攻略】MyGaming.News（同上） |
| 木柴丢进任何已存在的火（营火/火堆） | 0 | 【社区实测】[Reddit i6mflk](https://reddit.com/r/Breath_of_the_Wild/comments/i6mflk/) |

### 1.3 前置条件

- **雨天不能点燃**（露天）；须找遮蔽（屋檐/岩壁下）才能点（【社区实测】[Reddit: BoTW How to start a fire](https://reddit.com/r/zelda/comments/er4cxd/botw_how_to_start_a_fire)："it cannot be raining, or it won't work"；[Reddit: wait out the rain](https://reddit.com/r/Breath_of_the_Wild/comments/pdqxr5/)）。
- 木柴获取：砍倒树后再击打/炸倒木即可捡「木柴」（捆）（【官方文本】[Zelda Wiki: Wood](https://zeldawiki.wiki/wiki/Wood) 页 BotW 段，来源含游戏内物品说明转录）。

**小结（供合成口径）**：BotW 走的是「材料 + 工具动作」二段交互（无合成台配方）；打火石是消耗性点火器（1 次/块），木柴 1 捆 = 1 座营火。我们已拍板获取走合成系统，对应关系为「合成出篝火道具 → 放置即得火」，无需复刻打火石环节。

---

## 2. 营火存续 / 熄灭条件与「燃尽时长」考察

### 2.1 存续规则（【社区实测】多源一致）

- **世界固定营火（马厩/营地等场景摆放）：默认永久燃烧**，不随时间流逝衰减（【社区实测】[Reddit 7okv5y](https://reddit.com/r/Breath_of_the_Wild/comments/7okv5y/how_do_i_keep_fire_going_in_the_rain)："The only fires that won't go out are from fixed places like stables"）。
- **玩家自建营火（木柴点燃）：坐火跳时间（休息至早晨/中午/夜晚）后必定熄灭**（同帖："A campfire YOU make in a random place will always run out after you rest on it"）。营火本体保留，**可原样重燃**（【二手转述，游戏可复现】[Zelda Dungeon: Campfire](https://zeldadungeon.net/wiki/Campfire)："A campfire which was lit by Link and has gone out (such as after sitting at it to pass time) can always be relit in the same way provided the conditions remain dry"）。
- **雨天/强风会熄灭任何露天营火**，有遮蔽则不灭（【二手转述】[Zeldapedia: Wood](http://zelda.wikia.com/wiki/Wood)："rain or strong wind will put out any lit campfires unless it is [sheltered]"；马厩固定火也怕雨：Reddit 7okv5y 注 "which unfortunately go out when raining"）。
- **时间流逝本身不燃尽**：未发现任何「营火烧 N 分钟自然熄灭」机制或实测；大篝火（多捆木柴）「气流持续到木柴烧完为止」（【社区实测】[Reddit i6mflk](https://reddit.com/r/Breath_of_the_Wild/comments/i6mflk/)："will last for as long as the logs burn"），但"logs burn"本身无公开计秒——**营火气流被社区描述为非临时性**（对比：辣椒/太阳菇气流是临时的）（[Reddit fgp0mh](https://reddit.com/r/Breath_of_the_Wild/comments/fgp0mh/)）。
- **加柴**：可以随时往火里再丢木柴做出「更大的火」（见 §3.2）；未见「加柴延长计时」概念（本就无计时器）。
- **主动熄灭**：玩家没有「浇水/扑灭」类主动灭火操作；熄灭手段就是环境（雨/风）或坐火跳时间（未见到任何来源提及主动灭火；冰系武器能否扑灭 **未验证**）。

### 2.2 「燃尽时长/燃料消耗」数值结论

- **BotW 原值：不存在。** 营火是永久口径（固定火永久、自建火直到被环境/休息熄灭），没有燃料格、没有燃烧倒计时、没有「一根柴 = X 秒」的换算（本节全部来源见 §2.1；【数据挖掘】侧证：逆工程中营火行为类 `FireWood`/`FireBurnBase` 仅加载 `ChemicalRigidOn`/`InitBurnState` 两个参数——燃烧的初始状态开关，无任何时长字段，来源: [zeldaret/botw actionFireBurnBase.cpp](https://github.com/zeldaret/botw/blob/master/src/Game/Actor/Action/actionFireBurnBase.cpp)）。
- **最接近的可参考量级（迁移锚点，供 spec 折算）**：
  - BotW 自建营火的「一次生命周期」实际由**使用事件**终结（坐火跳时间≈一次性时间服务道具），不是时长；
  - 同仓 `docs/minecraft-furnace-research.md` 的燃料表是现成的消耗品化锚点：煤 80 s/块、木板/原木 15 s、木棍 5 s（MC Wiki 一手口径，本仓已核）；
  - 结构侧证：数据挖掘标签体系把「木柴捆」归入**可烤（CookOre）**物品组（营火接触即烤），旁证营火对木柴是「形态转化」（木柴→木炭）而非燃料计量（来源: [zeldamods.org: Actor tag](https://zeldamods.org/wiki/Actor_tag) 页 `CookOre` 列表含 `Obj_FireWoodBundle`；木柴烤后产物名 **未验证**）。

---

## 3. 上升气流：触发条件 / 范围 / 高度 / 叠加

### 3.1 触发条件：火势规模门槛（BotW 最反直觉的一条）

- **单个营火不产生可乘气流**（【社区实测】多帖独立一致）：
  - [Reddit 66pygf](https://reddit.com/r/Breath_of_the_Wild/comments/66pygf/)："A single campfire doesn't create an updraft. Fire needs to 'spread' to create one."
  - [GameFAQs 75111710](https://gamefaqs.gamespot.com/boards/632936-the-legend-of-zelda-breath-of-the-wild/75111710)："I don't think campfires create an updraft, no... the fire has to be more widespread."
  - [Reddit megdty](https://reddit.com/r/Breath_of_the_Wild/comments/megdty/)："you'll need multiple campfires right next to one another to get an updraft going, just one won't do it."
- **规模门槛（木柴计）**：**4 捆起流 / 3 捆维持**（【攻略】[MyGaming.News](https://mygaming.news/zelda/guide-to-updrafts-botw)："You need 4 wood bundles to start the updraft, but only 3 are needed to keep it"）；社区互证口径 **4 为下限、4~5 稳妥**（【社区实测】[Reddit byhtii](https://reddit.com/r/botw/comments/byhtii/)："4 is the minimum"；[Reddit 6mymwv](https://reddit.com/r/Breath_of_the_Wild/comments/6mymwv/)："at least 4 or 5 bundles"；GameFAQs 75111710 另有 "a ring of at least five campfires" 的 5 座口径——**4~5 区间，非官方数值**）。
- **等价触发物**：烧草地（火势蔓延开后起流，【官方文本】Tips："When fire spreads, it creates an updraft"；【社区实测】[Reddit 61dafi](https://reddit.com/r/Breath_of_the_Wild/comments/61dafi/)）；点燃辣椒/太阳菇等辛辣食材（临时气流，[Reddit fgp0mh](https://reddit.com/r/Breath_of_the_Wild/comments/fgp0mh/)、[Zelda Wiki: Updraft](https://zeldawiki.wiki/wiki/Updraft)）；龙飞行自带气流；固定地热喷口（Flight Range 训练场等，Zelda Wiki: Updraft）。
- **只有燃烧中才有气流**：熄灭即消失（Reddit i6mflk"as long as the logs burn"；fgp0mh 对比临时/非临时）。
- TotK 旁证（非 BotW）：官方道具说明——海利亚松果「含油、易燃，**投入火中会增强火势**」，投入营火产生强气流（【官方文本】[Zelda Wiki: Campfire](https://zeldawiki.wiki/wiki/Campfire) 页转录 TotK 物品说明 + 页内 Updraft 图注）。

### 3.2 火势大小 → 气流强度

- 往已燃营火**追加木柴**得到「大得多的大火」，产生「相当可观的气流」（【社区实测】[Reddit i6mflk](https://reddit.com/r/Breath_of_the_Wild/comments/i6mflk/)："throw them down onto the fire to create a much larger fire. Large campfires create a pretty significant updraft"）。
- 【数据挖掘】结构佐证「火的热度驱动风」：`WindControl` 动作（火类 actor 挂载）持有 `Temperature`（温度）与 `UseEnvTemperature`（是否取环境温度）参数——风强由温度参与计算，即引擎用「热」解释「升」（来源: [zeldaret/botw actionWindControl.h](https://github.com/zeldaret/botw/blob/master/src/Game/Actor/Action/actionWindControl.h)；该设计思路源自 GDC 2017 官方演讲所述化学引擎——物理引擎是"基于规则的移动计算器"，化学引擎是"基于规则的状态计算器"，五元素含火与风，来源: [GDC Vault: Change and Constant](https://www.gdcvault.com/play/1024562/Change-and-Constant-Breaking-Conventions)、[演讲视频](https://youtube.com/watch?v=QyMsF31NdNc)）。

### 3.3 范围与高度

- **形状：柱状**（"gusts of wind that push upward... the column of wind"，【二手转述·词条定义】[Zelda Wiki: Updraft](https://zeldawiki.wiki/wiki/Updraft)）。
- **半径/高度：官方数值未公开，公开 dump 亦未见**（【数据挖掘】仅见参数**名**：`Radius`（半径）、`MaxSpeed`（最大风速）挂在 `WindControl`/`WindBoxPlace` 上，数值本体在 actor 参数文件（aiprog/gparamlist），本调研未找到公开镜像——**未验证**；来源: [actionWindControl.h](https://github.com/zeldaret/botw/blob/master/src/Game/Actor/Action/actionWindControl.h)、[aiWindBoxPlace.h](https://github.com/zeldaret/botw/blob/master/src/Game/Actor/AI/aiWindBoxPlace.h)）。
- **高度量级（实测/转述折算，供参考）**：
  - 单团 4~5 捆木柴的火：社区称「小气流」(fgp0mh) / 上一段崖壁够用（[Reddit 12akurq](https://reddit.com/r/botw/comments/12akurq/)、[1br58k8](https://reddit.com/r/botw/comments/1br58k8/)）——量级 **数米到十余米**（**未验证**精确值）；
  - 辣椒堆叠串联（空中续点）可达 **希卡塔全高**（MyGaming.News："reach the top of Sheikah Towers straight from the bottom"）——希卡塔量级约 **70 m**（【物理分析】莱斯特大学学生期刊实测口径：研究用塔高约 70 m，[PDF](https://journals.le.ac.uk/index.php/pst/article/download/3330/3017/8787)）→ 叠加气流上限量级 **数十米**（**攻略转述**）。

### 3.4 叠加

- **可以叠加**：乘流途中在气流上方再点第二团火，气流柱可纵向接力（「updraft over an updraft」），反复串联超过 Revali's Gale 的高度（【社区实测】[GameFAQs 76524529](https://gamefaqs.gamespot.com/boards/189707-the-legend-of-zelda-breath-of-the-wild/76524529)；【攻略】MyGaming.News 辣椒串联法）。
- 横向并列多座火（4~5 捆聚一堆）= 单条更强的柱，不是多条柱（触发门槛见 §3.1）。

---

## 4. 滑翔伞乘流交互手感

- **进入即乘**：开伞状态下进入气流柱就被抬升——官方加载提示原文（【官方文本】）："When fire spreads, it creates an updraft. You can use the paraglider to catch that updraft and ride it high into the sky."（来源: [Zelda Wiki: Updraft](https://zeldawiki.wiki/wiki/Updraft) 页内 `{{Cite|...|Tips and Tricks|BotW}}` 转录）。Zelda Wiki 词条定义："gusts of wind that push upward, often carrying whatever enters the column of wind with them"（同页）。
- **升速（多快到顶）**：**未验证**——未见任何官方数值或可靠实测给出气流风速/净升速。可用的物理锚点：
  - 开伞终端下沉速度 **≈ 3.2 m/s**（【物理分析】约 70 m 高塔开伞下落约 22 s：70 ÷ 22 ≈ 3.2，来源: [莱斯特大学物理学生期刊 A1_3 "Paragliding through Hyrule"](https://journals.le.ac.uk/index.php/pst/article/view/3330)，基于游戏内可复现测量）；
  - 推论（本报告分析，非实测）：气流风速须 **> 3.2 m/s** 才有净上升；净升速 = 风速 − 下沉速度。以叠加辣椒流约 20 s 内送人上塔顶（70 m 量级）粗估，强气流净升速量级 ≈ **3~4 m/s**（**未验证**，仅量级参考）。
- **离开气流顶部后的行为**：出柱后气流推力即止（词条定义的"进入柱内才携带"），玩家保持 airborne 转入普通滑翔下落——社区玩法证明顶部离开后仍滞空且可衔接动作（空中开弓再点一团火串联第二段气流，[GameFAQs 76524529](https://gamefaqs.gamespot.com/boards/189707-the-legend-of-zelda-breath-of-the-wild/76524529)；22 分钟连续滑行 7500 m 的滞空记录，[Nintendo Everything](https://nintendoeverything.com/player-sends-link-gliding-over-7500-meters-during-22-minute-flight-in-zelda-breath-of-the-wild)）。水平速度≈ **5.7 m/s**（7500 m ÷ 22 min，【玩家记录·媒体转述】）。精确的动量保持/边界缓冲行为 **未验证**。
- **柱宽（几格量级）**：**未验证**。结构上由 `Radius` 参数控制（见 §3.3）；视觉上柱宽与火堆占地同量级（4~5 捆柴聚成一堆，占地约 2~3 m 直径——【社区实测】帖内"right next to each other"摆法推断，**未验证**）。
- **旋转观感**：【数据挖掘】`WindControl` 持有 `MaxRadSpeed`/`RadAccel`（切向速度与切向加速度）——气流柱带**旋涡**分量，与游戏内白色螺旋粒子观感一致（来源: [actionWindControl.h](https://github.com/zeldaret/botw/blob/master/src/Game/Actor/Action/actionWindControl.h)）。
- 参照系：Revali's Gale（角色技能气流）= 3 次充能/6 现实分钟冷却（城堡内 2 分钟；Gale+ 减半），产生的气流柱「可重复乘用直至消失」（【二手转述·数值为 wiki 记载的官方口径】[Zelda Wiki: Revali's Gale](https://zeldawiki.wiki/wiki/Revali%27s_Gale)）。

---

## 5. 烟 / 火焰表现（供特效模块参考的量级）

- **烟**：营火持续冒**灰白色烟粒子柱**，向上飘散；烟是玩家远距离发现营火/篝火点的主要视觉信号（【社区实测·定性】——如 Lost Woods 气流微粒讨论 [Reddit 1fgczwz](https://reddit.com/r/botw/comments/1fgczwz/)；Unity 美术还原讨论证实 BotW 烟雾为 billboard 粒子贴图序列，[Unity 论坛](https://discussions.unity.com/t/breath-of-the-wild-style-particles-effects/657846)）。**烟柱高度/可见距离的官方数值：未查到**（查了 Zelda Wiki Campfire/Fire/Updraft 词条、zeldamods、逆工程源码结构——均为定性描述）。
- **气流可视化**：气流柱以**白色/灰白旋涡粒子流**呈现（螺旋上升）， grass 火气流还会卷起叶片碎屑；这是「这里有风可乘」的可读性语言（【社区实测·定性】Reddit 各乘流帖视频；词条图注 [Zelda Wiki: Updraft](https://zeldawiki.wiki/wiki/Updraft)）。
- **火焰**：橙红色明火，火堆规模随木柴量明显变化（1 捆 = 小火，4~5 捆 = 大火，视觉差异显著——Reddit i6mflk"much larger fire"）。
- **量级参考（本报告折算，非官方）**：单营火烟柱在游戏画面中约数个 Link 身高量级（Link 身高 ≈ 1.7~1.8 m 级）；乘流柱（含粒子）延伸至气流全高（崖壁级到塔级，见 §3.3）。给体素游戏做特效时建议以「格」为单位另定（见 §6 表），不必折算米。

---

## 6. 参数参考表（供 spec 直接引用）

> BotW 原值列 = 本报告核到的口径（含未验证标注）；建议列 = **【建议】本报告分析**（面向 6 岁儿童体素游戏，单位：格 = 1 方块 ≈ 1 m，时间 = 现实秒），最终数值归 spec/PO 拍板。

| 参数 | BotW 原值（获取方式） | 面向 6 岁体素游戏的建议量级【建议】 |
| --- | --- | --- |
| 点燃材料 | 1 木柴 + 1 打火石（打火石消耗）/火焰武器 0 消耗（社区实测） | 不设点火步骤：合成即得「已点燃篝火」，放置即燃（省掉二段交互与失败挫败） |
| 气流触发门槛 | 单火无气流；≥4 捆木柴起流、3 捆维持（攻略+社区实测，非官方） | **1 座篝火即出气流**（单篝火=完整功能；堆柴玩法对 6 岁是材料管理负担） |
| 气流高度 | 单火崖壁级（数米~十余米，未验证）；串联可达塔级 ≈ 70 m（攻略转述+物理分析塔高口径） | **8~12 格**（一段崖壁/一栋楼的可达性收益，单次乘流 4~6 s 到顶；不做串联叠加） |
| 气流宽度 | 柱状，半径由 Radius 参数控制（数据挖掘·结构；数值未验证），目测与火堆占地同量级（2~3 m） | **3×3 水平截面（判定半径 1 格）**，整数格列判定，对齐体素网格 |
| 升速 | 无官方值；净升速 = 风速 − 下沉 3.2 m/s（物理分析）；强流量级估 3~4 m/s（未验证） | **2~3 格/s 净升**（温和可感；到顶 4~6 s，孩子来得及观察与转向） |
| 到顶后行为 | 出柱即止推力，转普通滑翔下落，可空中衔接动作（社区实测） | 同口径：出柱回落到既有滑翔缓降；柱内「高度只减不增」约束暂停执行（见 §7-2） |
| 燃尽时长 | **无燃尽机制**（永久口径；熄灭=雨/风/坐火，数据挖掘无时长字段） | **90~120 s 燃尽**（对标本仓 MC 煤 80 s/件量级 `minecraft-furnace-research.md` §3；单局 2~3 min 可看完整一轮生灭） |
| 燃料消耗/加柴 | 无燃料格；加柴=更大火+更强流，不延长计时（社区实测） | 可选加柴：+1 木柴 **+40~60 s**，上限 3 根（可选功能，首版可砍） |
| 熄灭条件 | 雨/强风熄灭露天火；坐火跳时间熄灭；熄后可重燃（社区实测多源一致） | 首版**只有自然燃尽**（化灰/消失）；雨水熄灭视天气系统进度再议 |
| 烟/粒子 | 灰白 billboard 烟柱 + 白色旋涡气流粒子（定性；官方数值未查到） | 烟柱 4~6 格高、上浮小方块粒子 3~5 个/篝火；气流柱用 2~3 圈旋转粒子示流；纯表现层，不进确定性核心 |
| 照明 | BotW 营火发光（连续光照，无数值口径） | 对标既有火把光照等级（`mc-daylight-torch-design.md`），熄灭即归零 |

---

## 7. 与体素游戏迁移注意点

1. **连续空间 → 方块世界**：BotW 气流是连续场（`Radius` 浮点半径 + 温度场）；我们是整数网格。建议气流柱离散为**方块列**：判定 = 「玩家水平坐标所在格 ∈ 柱截面 && 玩家 y ∈ [火面, 火面+高度]」，全整数运算，天然可存档。
2. **与滑翔契约（ADR 0016）的正面冲突必须显式开口**：ADR 0016（2026-11-15 采纳）钉死「**只缓降，高度只减不增，起点即最高点**」，且明确否决了「微爬升/主动爬升」。热气流抬升 = 滑翔中高度增加，与该条直接冲突。建议在 spec 里以「**外部升力源豁免**」口径修订（柱内允许高度增加，柱外严格只减不增；建议补一条 ADR 修订或新 ADR 记录，避免实现期被守门测试按旧契约打回）。同时钉死两个衔接点：**取消闩锁 × 气流柱**（取消展翼后在柱内悬空——落地条件永远不满足，闩锁如何解锁需 spec 裁决）；**自动展翼触发**（离地 >2 格自动展翼，乘流中天然满足，无需特判）。
3. **摔落规则联动（ADR 0014）**：无翼 3 格以上坠落摔伤。气流顶点（8~12 格）远超 3 格——若孩子中途收翼会摔。建议：「气流只在**滑翔展开状态**生效抬升」（收翼=自由落体，再展翼又接住，与 ADR 0016 的再展操作同键自洽），或顶点高度可调低；spec 定。
4. **零墙钟确定性（引擎层热空气核心硬要求）**：燃尽倒计时、气流存在性、光照等级必须挂**模拟 tick（固定 dt）**，禁用 `Date.now`/性能计数器；范围判定用 tick 内位置采样。烟/火焰/旋涡粒子是**纯表现层**，可非确定、可按帧率分档（对齐 `ipad5-performance-design.md` 的低核分档）。
5. **引擎/玩法分层**：BotW 把风做进世界系统（`worldWindMgr`、温度驱动），我们不能照搬——按仓库铁律「引擎层不知道玩法」，建议玩法层自管「篝火列注册表 + 滑翔态查询」，引擎层最多提供通用「上升场查询」原语；归属进 spec 时引用 `GLOSSARY.md` 定名。
6. **叠加策略**：BotW 的多火叠流是高资源投入的进阶玩法（4~5 捆柴、空中续点）；6 岁用户建议**不叠加**：多篝火时就近取最强一条柱（max 语义，非求和），物理稳定且省判定。
7. **消耗品口径的正名**：BotW 营火本无燃尽——我们做的「自然燃尽的消耗品」是**主动偏离原型**（PO 已拍板），数值锚点取本仓 MC 燃料研究（80 s/煤）而非 BotW；spec 里写清楚偏离理由可防后续"对齐 BotW"的回头票。
8. **材料经济**：BotW 气流成本集中在触发门槛（4~5 捆柴）；我们把成本移到合成与燃尽（1 篝火 = 1 次完整体验），避免儿童版"堆柴失败→没有气流→挫败"链路。

---

## 8. 来源清单

| # | 主题 | URL | 信源类型 | 抓取结果 |
| --- | --- | --- | --- | --- |
| 1 | 营火（做法/用途/官方 Tips 转录/TotK 松果旁证） | https://zeldawiki.wiki/wiki/Campfire | 二手 wiki（含官方游戏内文本逐字转录） | ✅ 经 MediaWiki API 取 wikitext |
| 2 | 上升气流（定义/来源/官方 Tips 转录） | https://zeldawiki.wiki/wiki/Updraft | 同上 | ✅ 同上 |
| 3 | 木柴（获取/点燃方式/官方物品说明转录） | https://zeldawiki.wiki/wiki/Wood | 同上 | ✅ 同上 |
| 4 | Revali's Gale（充能/冷却数值） | https://zeldawiki.wiki/wiki/Revali%27s_Gale | 同上 | ✅ 同上 |
| 5 | 火（蔓延/草火气流/风助火势） | https://zeldawiki.wiki/wiki/Fire | 同上 | ✅ 同上 |
| 6 | 营火行为类源码（FireWood/FireBurnBase，无时长字段） | https://github.com/zeldaret/botw/blob/master/src/Game/Actor/Action/actionFireBurnBase.cpp | 逆工程源码（一手级） | ✅ raw 直读 |
| 7 | 风控制动作（Radius/MaxSpeed/MaxRadSpeed/RadAccel/Temperature 参数名） | https://github.com/zeldaret/botw/blob/master/src/Game/Actor/Action/actionWindControl.h | 逆工程源码（一手级） | ✅ raw 直读 |
| 8 | 风盒 AI（Radius/MaxSpeed/WindSpeed 参数名） | https://github.com/zeldaret/botw/blob/master/src/Game/Actor/AI/aiWindBoxPlace.h | 逆工程源码（一手级） | ✅ raw 直读 |
| 9 | 滑翔动作（GlideSpeedMax/WindScale/EnergyGlide 参数名） | https://github.com/zeldaret/botw/blob/master/src/Game/Actor/Player/Action/actionPlayerParashawlGlide.h | 逆工程源码（一手级） | ✅ raw 直读 |
| 10 | Actor 标签体系（FireWood/FireWoodFromBundle/FireWoodDie；木柴捆 CookOre） | https://zeldamods.org/wiki/Actor_tag | 数据挖掘 wiki | ✅ API 取 wikitext |
| 11 | 对象重生表（Wood=Obj_FireWoodBundle） | https://zeldamods.org/wiki/Object_respawning | 数据挖掘 wiki | ✅ 同上 |
| 12 | GDC 2017 官方演讲（化学引擎=状态计算器/五元素） | https://www.gdcvault.com/play/1024562/Change-and-Constant-Breaking-Conventions · https://youtube.com/watch?v=QyMsF31NdNc | 开发者演讲（官方） | ✅ 页面可达（内容经讲谈摘要页核对） |
| 13 | 滑翔物理分析（塔高 ~70 m/开伞下落 22 s/下沉 3.2 m/s） | https://journals.le.ac.uk/index.php/pst/article/view/3330 （PDF: .../download/3330/3017/8787） | 大学物理学生期刊（基于游戏内实测的分析） | ✅ 摘要与 PDF 快照核对（PDF 机读受限） |
| 14 | 气流指南（4 捆起流/3 捆维持/点火源清单/辣椒串联塔高） | https://mygaming.news/zelda/guide-to-updrafts-botw | 攻略站（二手） | ✅ 全文抓取 |
| 15 | 点火方式与打火石消耗 | https://ign.com/wikis/the-legend-of-zelda-breath-of-the-wild/Wood · https://ign.com/wikis/the-legend-of-zelda-breath-of-the-wild/Things_You_Should_Know_in_Breath_of_the_Wild | 攻略 wiki（二手） | ✅ 搜索快照摘录 |
| 16 | 单火无气流/多捆起流（多帖独立） | https://reddit.com/r/Breath_of_the_Wild/comments/66pygf/ · https://reddit.com/r/Breath_of_the_Wild/comments/6mymwv/ · https://reddit.com/r/botw/comments/byhtii/ · https://reddit.com/r/Breath_of_the_Wild/comments/fgp0mh/ · https://gamefaqs.gamespot.com/boards/632936-the-legend-of-zelda-breath-of-the-wild/75111710 | 社区实测（二手·多源一致） | ✅ 搜索快照摘录（直连受限） |
| 17 | 大火强流/持续到木柴烧尽 | https://reddit.com/r/Breath_of_the_Wild/comments/i6mflk/ | 社区实测（二手） | ✅ 同上 |
| 18 | 雨天熄灭/坐火后熄灭/遮蔽可保火 | https://reddit.com/r/Breath_of_the_Wild/comments/7okv5y/ · https://zeldadungeon.net/wiki/Campfire · http://zelda.wikia.com/wiki/Wood | 社区实测+二手 wiki | ✅ 快照+检索摘要（zeldadungeon 直连 403） |
| 19 | 气流纵向串联叠加 | https://gamefaqs.gamespot.com/boards/189707-the-legend-of-zelda-breath-of-the-wild/76524529 | 社区实测（二手） | ✅ 搜索快照摘录 |
| 20 | 22 分钟滑行 7500 m（水平速度量级） | https://nintendoeverything.com/player-sends-link-gliding-over-7500-meters-during-22-minute-flight-in-zelda-breath-of-the-wild | 媒体报道玩家记录（二手） | ✅ 搜索快照摘录 |
| 21 | 烟粒子形态（billboard 贴图） | https://discussions.unity.com/t/breath-of-the-wild-style-particles-effects/657846 | 开发者社区讨论（美术向二手） | ✅ 搜索快照摘录 |

**交叉引用（本仓库既有工件）**：`docs/minecraft-furnace-research.md`（燃料时长锚点：煤 80 s）、`docs/mc-daylight-torch-design.md`（光照等级口径）、`docs/adr/0012`~`0016`（滑翔翼决策集：无消耗永久/触发与取消契约/摔落阈值）、`docs/glider-spec.md`（滑翔施工规格）、`docs/ipad5-performance-design.md`（表现层分档）。

> **未验证事项汇总**（写 spec 前如需精确值，须自测或找 actor 参数 dump）：① 气流风速/柱高的官方数值（参数值本体未公开）；② 单火气流精确高度；③ 气流柱精确宽度；④ 升速与到顶耗时实测；⑤ 烟柱高度/可见距离数值；⑥ 木柴烤制产物名；⑦ 冰系武器能否主动灭火；⑧ 出柱顶部瞬间动量行为。
