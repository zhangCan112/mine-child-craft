# 《我的世界大电影》(A Minecraft Movie, 2025) 城镇 Midport Village 调研

> 产出目的：为后续 `town-map-design` / `town-villagers-design` / `town-assets-requirements` 提供带引用的事实底座。  
> 调研日期：2026-11-12（基于本次可获取的公开资料）。  
> 口径声明：**只认一手信源优先**。但受当前网络抓取限制，部分电影画面细节无法直接逐帧核验；对无法从一手信源文本直接确认的点，本文明确标注“未在一手信源中确认/推测（基于公开剧照/画廊说明观察）”，不编造。

## 摘要

- **电影城镇身份**：Midport Village 是《A Minecraft Movie》(2025) 中 Overworld 的重要场景/聚落，为 Steve 与村民的居住与活动地（来源：Minecraft Wiki 电影条目页、Warner Bros./Minecraft 官方宣传语境下的聚合信息；详见来源清单与拆解）。[1][2][3]
- **官方可确认的氛围关键词**：和平聚落、友善村民、pacifist/素食倾向（部分）、热爱面包、Steve 亲手建造了村中大量设施（含 Steve's Lava Chicken）——来自 2025 Amazon.com 商品/宣传描述（被 Minecraft Wiki 引为引文）。[1]
- **可辨识空间要素（来自官方/准官方聚合页可读信息）**：拱形山体下的村庄、类似游戏村庄的建筑群但更具中世纪细节与非严格比例、风车与钟塔、中心开放市集/广场区、樱花树等景观元素；命名地点含 Steve's Lava Chicken!、Steve's Secret Stash! 等（来源：Minecraft Wiki Movie:Midport_Village 页面文本）。[1]
- **游戏内联动佐证（官方 Minecraft 活动）**：Minecraft 官方 Live Event 文章明确“Save Midport village from the piglins…”并描述村庄广场、商店、独特建筑、可爱生物、隐藏物品等，说明“Midport Village”作为电影关联场景被 Mojang 官方内容直接采用（虽为游戏内复刻/活动演绎，非电影逐镜头设定稿）。[4][5]
- **MC 村庄机制可复用点**：村民职业-工作站绑定、日程（工作/游荡/集会/睡觉）、床与村庄认定、钟与集会/袭击警示、铁傀儡守护与裂纹/献花/玩家搭建忠诚等，可为“祥和城镇感+可交互秩序”提供玩法骨架（来源：minecraft.wiki Village/Villager 页；仓库既有 `docs/iron-golem-research.md`、`docs/mc-mob-models-research.md`）。[6][7][8][9]
- **核心不确定性**：电影中 Midport Village 的精确平面尺寸、建筑数量/坐标级布局、昼夜全时段光照与材质清单、村民精确人数与职业分布，**未找到可公开访问的一手“设定图/场景蓝图”文本**；需在设计阶段以“可识别气质复原 + 游戏性适配”为目标并标注待 PO 确认。

---

## 一手信源清单（链接 + 简述）

| # | 来源 | 类型 | 用途/可提取信息 | 访问备注 |
|---|---|---|---|---|
| S1 | https://minecraft.wiki/w/Movie:Midport_Village | 社区百科（电影专页，聚合官方素材/引文） | Midport Village 的布局描述、历史叙事摘要、命名建筑、已知居民/访客/物种、引文（含 Amazon 描述）、截图画廊条目标题等。文中含引用标记与“2025 Amazon.com description”引文。 | **二手聚合页但含可追溯引文/画廊说明**；本次通过网页抓取获取页面 HTML 文本片段（可读到 Layout/History/Named structures/Quotes/Gallery 标题等）。用于定位事实线索，关键结论尽量回指其明确引文/官方关联内容。 |
| S2 | https://www.minecraft.net/en-us/article/a-minecraft-movie-live-event | Mojang/Minecraft 官方文章（一手） | “Save Midport village from the piglins…”；活动设定在 Midport Village；提及村庄广场(Steve 等待)、商店/独特建筑/可爱生物/隐藏物品；任务与防守墙等玩法情境（游戏内联动，非电影分镜）。 | 本次 web 搜索结果返回正文片段；用于确认 Midport Village 作为官方电影关联地名与“热闹/可防守村庄”氛围线索。 |
| S3 | https://www.minecraft.net/en-us/article/minecraft-live-2025-recap | Mojang/Minecraft 官方文章（一手） | 宣布电影联动 Live Event：“save Midport village from a piglin attack”等。 | 作为 S2 的佐证（官方同源叙述）。 |
| S4 | https://www.warnerbros.com/movies/minecraft-movie | Warner Bros. 官方电影页（一手） | 影片基本信息、剧情梗概（四名误入 Overworld 的主角与 Steve 的冒险，需面对 Piglins/Zombies 等威胁）——提供“村庄可能面临威胁但整体冒险基调”的背景，不含 Midport 细节。 | 本次可获取页面概要文本；用于背景，不用于城镇细部断言。 |
| S5 | https://minecraft.wiki/w/Village | Minecraft Wiki 游戏机制页（prompt 允许作为 MC 官方机制对照来源） | 村庄结构、路径、村庄认定/边界（JE 子区块 POI：床/钟/工作站；BE 床与中心）、集会点（钟）、工作站、袭击/僵尸围城等。 | 用于“MC 游戏官方村庄机制对照”。 |
| S6 | https://minecraft.wiki/w/Villager | Minecraft Wiki 游戏机制页（prompt 允许） | 村民职业与工作站对应、日程（工作/游荡/集会/玩耍/回家/睡觉）、交易、铁傀儡召唤（JE 恐慌/八卦；BE 人口/床/工作率）、恐慌与寻路等。 | 用于机制对照。 |
| S7 | `docs/iron-golem-research.md`（仓库内） | 仓库既有调研（复用，不重复取证） | 铁傀儡获取/属性/AI/献花/裂纹/玩家搭建忠诚/村庄关联等可迁移机制与建议。 | 直接引用文件路径。 |
| S8 | `docs/mc-mob-models-research.md`（仓库内） | 仓库既有调研（复用，不重复取证） | 村民/灾厄村民/铁傀儡等模型结构、比例、官方骨架语言（用于后续资产造型参考的“几何/命名语言”底座）。 | 直接引用文件路径。 |

> 备注：用户要求“可用来源类型：Warner Bros / Minecraft 官方网站/博客/新闻稿、官方预告片/片段…”等。本次环境下 `minecraft.net` 电影相关文章与 YouTube 预告片页面无法稳定抓取全文/逐帧，仅能依据可检索到的官方页面摘要（S2-S4）与电影专页聚合信息（S1）整理；**凡无法文本直证的电影画面细节均降级标注**。

---

## 电影城镇拆解（Midport Village）

### 1. 整体布局与空间结构

| 要点 | 说明 | 来源/证据等级 |
|---|---|---|
| 地形依托 | **【电影原样-文本证据】** 位于“拱形山体(arch-shaped mountain)”之下的聚落（S1 Layout 原文可读：“Based under an arch-shaped mountain…”）。 | S1 https://minecraft.wiki/w/Movie:Midport_Village#Layout |
| 村庄原型 | **【电影原样-文本证据】** 乍看近似游戏中典型村庄，但建筑更具细节与中世纪美学，且与游戏内结构非严格同比例（S1 Layout）。 | S1 #Layout |
| 竖向与边缘 | **【电影原样-文本证据】** 存在“神庙与位于远处崖顶的房屋”等预存在建筑暗示（S1 Layout 提及“pre-existing buildings such as the temple and homes that appear to be on top of distant cliffs”）。 | S1 #Layout |
| 中心开放空间 | **【电影原样-文本证据】** 村庄中心有“高度独特的开放市集区域(open marketplace area)”（S1 Layout）。 | S1 #Layout |
| 道路/动线 | **未在一手信源中确认/推测（基于公开画廊说明观察）**：截图画廊含“the square of the village”等条目（S1 Gallery 标题可读），推测存在广场与可通行街巷；具体路网形态未获文本蓝图确认。 | S1 Gallery 条目标题（聚合） |

### 2. 地标建筑与可辨识元素

| 元素 | 说明 | 来源/证据等级 |
|---|---|---|
| Steve's Lava Chicken! | **【电影原样-文本证据】** Steve 在思考“热熔岩与鸡混合会怎样”后建造的店铺/餐饮地标；Amazon 描述称其为“legendary Steve's Lava Chicken!”；亦为联动活动中可见地点名。 | S1 History/Quotes/Named structures；S2 活动文本提及 Lava Chicken 相关地点/物品语境 |
| Steve's Secret Stash! | **【电影原样-文本证据】** Steve 建造的秘密储藏处/据点类建筑。 | S1 History/Named structures |
| Steve's World | **【电影原样-文本证据】** 列为命名结构之一。 | S1 Named structures |
| Diamond Boot-ique / The Exploding Pig! | **【电影原样-文本证据】** 列为命名结构（S1 Named structures 可读）；具体功能/外观细节未在可得文本中展开。 | S1 Named structures |
| 风车与钟塔 | **【电影原样-文本证据】** S1 Layout 明确提到新增了风车与钟塔（“windmills and bell towers”）。钟塔在玩法上映射 MC 的“钟/集会点”意象（见机制对照）。 | S1 #Layout |
| 神庙/崖顶房屋 | **【电影原样-文本证据】** 作为预存在建筑被提及（temple, homes on distant cliffs）；具体样式未详述。 | S1 #Layout |
| 樱花树与市集陈设 | **【电影原样-文本证据】** 中心市集区域“featuring things such as cherry trees”。 | S1 #Layout |
| 高跳板与小水池 | **【电影原样-文本证据】** Steve 建造“世界最高跳板通向世界最小水池”，并用羊驼测试（S1 History）。偏趣味地标，是否作为核心可交互点待设计取舍。 | S1 #History |
| 广场/村庄方场 | **未在一手信源中确认/推测（基于公开剧照/画廊说明观察）**：画廊条目“The square of the village”；联动活动中 Steve 在村庄广场等待（S2）。可作为中心节点设计锚点。 | S1 Gallery；S2 |

### 3. 道路与广场

- **【电影原样-文本证据】** 中心为开放市集/广场感区域（S1）；联动活动反复强调“village square/streets”作为玩家集合与活动空间（S2 为游戏内复刻叙述，佐证“广场+街道”的空间语法被官方采用）。  
- **未在一手信源中确认/推测（基于公开剧照/画廊说明观察）**：具体铺面材质（石砖/土径/木板）、道路宽度、围栏与摊位布局无一手尺寸/材质表；建议在设计阶段采用“可读的主广场 + 放射/环绕小径”的游戏化组织。

### 4. 材质与配色

- **【电影原样-文本证据】** S1 描述建筑“more detail and a decidedly more medieval aesthetic”（相较游戏方块更细节、偏中世纪），暗示木构/石构混合与装饰性构件的观感倾向；但**未提供官方色板/材质清单**。  
- **未在一手信源中确认/推测（基于公开剧照/画廊说明观察）**：从“典型村庄相似+樱花树+市集”可推测暖色木材、浅石、绿植与粉白点缀可能并存，但具体色值/方块对应无法确认。  
- **【建议为游戏性调整】** 资产阶段应输出可落地的体素材质表（木/石/屋顶/布幔/植被），以“温暖、明亮、低对比威胁感”为约束，优先服务 6 岁可读性（见后文）。

### 5. 白天/夜晚氛围

- **【电影原样-文本证据】** 影片发生在 Overworld 冒险语境中，村庄作为和平据点出现（S1、S4 剧情梗概背景）；Amazon 引文强调“peaceful settlement… gentle Villagers…”（S1 Quotes）。  
- **未在一手信源中确认/推测（基于公开剧照/画廊说明观察）**：白天/夜晚的具体光色、灯具密度、是否在电影中展示夜间安睡循环，当前可得文本未逐场景说明。画廊存在“Ghasts arriving at the village”等条目（S1 Gallery 标题），表明至少存在受袭击/紧张时刻的画面，但时段与光照需以实际镜头为准。  
- **【建议为游戏性调整】** 面向 6 岁与“祥和无威胁”目标：默认采用**明亮黄昏前/白天氛围**作为主态；夜晚若保留，仅作柔和灯火与安睡氛围，不引入真实恐惧源（默认待确认）。

### 6. 热闹与祥和感的视觉线索

- **【电影原样-文本证据】** 村民“热爱交易与吃面包”、铁傀儡保护村民（S1 History）；“peaceful… gentle… pacifists…”（S1 Quotes）。  
- **【电影原样-文本证据/联动佐证】** 联动活动描述“bustling settlement filled with shops, unique structures, adorable mobs, and hidden items”（S2），强化“热闹但友好”的空间感（注意：这是游戏活动文案，反映官方希望传达的村庄气质）。  
- **未在一手信源中确认/推测（基于公开剧照/画廊说明观察）**：摊贩叫卖、音乐、粒子/烟火等动态热闹元素的具体呈现需画面核验；可作为“氛围目标”而非已证事实。

### 7. 村民群像与活动

- **【电影原样-文本证据】** 已知居民/物种包含 Steve、各类村民（含 nitwit、不同生物群系村民、铁傀儡、农场动物、Technoblade 猪等）与访客（主角团、猪灵/恶魂等入侵相关角色）——见 S1 “Known inhabitants / Known visitors / Species”列表。  
- **未在一手信源中确认/推测（基于公开剧照/画廊说明观察）**：同屏村民数量、行走路径、是否展示工作/集会/睡觉循环，文本未给定；画廊标题提示“Multiple villagers and an armorer near a farm”“An iron golem in the village”等场景存在。  
- **与 MC 的对应**：职业外观、村民-工作站、铁傀儡守护等可直接借鉴游戏机制（见对照表）；电影特有命名角色（如联动/剧情角色）是否纳入需 PO 决策。

---

## MC 村庄机制对照表（电影元素 vs 游戏机制/可复用点）

> 依据：S5 https://minecraft.wiki/w/Village 、S6 https://minecraft.wiki/w/Villager 、S7 `docs/iron-golem-research.md`、S8 `docs/mc-mob-models-research.md`。

| 维度 | MC 官方机制要点（可引用） | 电影/联动中对应线索 | 可复用设计点（本项目） | 备注 |
|---|---|---|---|---|
| 村庄空间与认定 | JE：含已认领床/钟/工作站的子区块构成村庄中心（3×3×3 子区块范围扩展）；BE：村庄以床与村民链接建立，有中心与边界概念（S5 Mechanics）。 | Midport 为具名聚落、有中心广场/建筑群（S1）；联动强调村庄广场与防线（S2）。 | **建议**将“中心广场 + POI（钟/工作台/床位/店铺）”作为地图逻辑锚点，便于生成巡逻、集会与任务点；不必 1:1 复刻 JE/BE 算法。 | 【建议为游戏性调整】 |
| 村民职业与工作站 | 失业村民认领工作站获得职业；已交易村民锁定职业；工作站类型与职业一一对应（如制图台-制图师、熔炉/高炉/烟熏炉等对应不同职业等）（S6 Professions/Job site blocks）。 | S1 画廊/居民提及 mason、armorer、cartographer 等职业化形象；联动有商店/功能点语境。 | 用“职业=视觉身份+可交互功能”做内容组织：铁匠铺、农田、图书/制图角等；6 岁向可简化为 3-5 个高辨识职业。 | 【建议为游戏性调整】 |
| 日程（工作/游荡/集会/睡觉） | 村民有日程：工作、游荡、集会（围绕钟）、玩耍（幼体）、回家、睡觉等；会开关门、避雨、社交凝视（S6 Schedules/Movement patterns）。 | 电影文本未详述日程循环；联动呈现“白天热闹村庄”气质（S2）。 | 做轻量日程驱动的“生活感”背景行为（白天走动/工作姿态/傍晚归巢），增强祥和与可预期性，避免复杂 AI 负担。 | 【建议为游戏性调整】 |
| 钟与集会 | 集会点定义为村庄边界内的钟；村民会在钟附近聚集，袭击时可敲钟（S5 Gathering site；S6 Gathering）。 | S1 Layout 提到“bell towers”；画廊有广场场景。 | 将钟塔/广场钟设为**视觉与行为双锚点**：平时集会、事件时提示（可做无威胁版“集合”）。 | 【电影原样】元素+【建议为游戏性调整】用法 |
| 床与村庄人口/繁殖 | 床是村庄/链接与繁殖关键（有效床数量影响人口上限与意愿；S5 Bedrock 村庄、S6 Breeding）。 | 未在电影文本中确认床的机制化呈现。 | 若做“家/休息”氛围，可放置床作为装饰与叙事道具；**不建议**在儿童注意力训练主线中引入繁殖/人口管理复杂度。 | 【建议为游戏性调整】 |
| 铁傀儡与安全感 | 自然/村庄关联铁傀儡守护村民、会献花、受损有裂纹、可用铁锭修复；玩家搭建版本永不攻击玩家（S7 详表）；模型为长臂无颈守卫造型（S8 §5）。 | S1 居民/画廊含 Iron Golem、Super Iron Golem 等；电影中铁傀儡是村庄守护的直观符号。 | 作为“祥和守护者”核心 NPC：可巡逻广场、对玩家友好、展示献花/裂纹状态（若做交互）；契合无威胁基调。详见 S7 §7。 | 【电影原样】符号+【建议为游戏性调整】交互深度 |
| 村民外观/职业模型 | 村民与灾厄村民有明确头身/鼻/袍等结构语言（S8：villager_v2、witch/vindicator 基座等），职业与生物群系影响外观（S6 Appearance/Professions）。 | S1 列出多种村民变体（沙漠/热带草原/雪地村民等）与职业角色。 | 资产制作按 S8 的“基座+覆写”思路规划：统一村民基座 + 少量职业配件/配色，控制成本并保留辨识度。 | 复用 S8 |
| 袭击/威胁 | 村庄可遭遇袭击、僵尸围城等（S5 Events）；村民恐慌、铁傀儡应对（S6）。 | 电影存在外部威胁入侵村庄的情节线索（S1 访客含 Ghast/Piglin 等，画廊有“Ghasts arriving at the village”；S4 梗概提到需对抗 Piglins/Zombies 等）；联动以“防御猪灵入侵”为主题（S2）。 | **本项目基调“祥和无威胁”**：默认不做真实战斗/raid；可改为“演习/寻物/帮助村民”的正向事件替代威胁（待 PO 确认）。 | 【建议为游戏性调整】关键项 |

---

## 【电影原样】与【建议为游戏性调整】对照清单

| 条目 | 分类 | 内容 | 依据/说明 |
|---|---|---|---|
| 地名与核心身份 | 【电影原样】 | 使用 **Midport Village** 作为地图名/地标认知；定位为 Overworld 中和平、友善的村庄聚落。 | S1 标题与描述；S2/S3 官方联动沿用地名。 |
| 关键地标命名 | 【电影原样】 | 保留高辨识命名：**Steve's Lava Chicken!**、**Steve's Secret Stash!**（及可选 Steve's World）作为场景锚点。 | S1 Named structures/History。 |
| 空间母题 | 【电影原样】 | 拱形山体下的村庄意象；中心开放市集/广场；风车与钟塔；樱花等温暖点缀。 | S1 Layout。 |
| 村庄守护者 | 【电影原样】 | 铁傀儡作为守护存在的视觉符号；村民友善、爱面包/交易的性格基调。 | S1 History/Quotes/Gallery；S7 机制背景。 |
| 建筑比例与细节度 | 【建议为游戏性调整】 | 不追求电影镜头级非等比写实；采用**体素可读性优先**的中世纪-村庄混合风（保留风车/钟塔/市集轮廓），简化过密细节以适配低龄与性能。 | 电影“更细节/非游戏比例”（S1）在体素引擎中需转译。 |
| 城镇规模 | 【建议为游戏性调整】 | **默认建议：小镇级可漫游核心区**（1 个主广场 + 4~8 栋功能建筑 + 2~3 条短路径 + 少量农田/装饰），保证 3-10 分钟可探索完且不迷路。**默认待确认**。 | 未找到一手尺寸数据；面向 6 岁注意力与实现成本。 |
| 村民数量与密度 | 【建议为游戏性调整】 | **默认建议：同屏常驻 6~10 位村民 + 1 位铁傀儡**（含 2-3 种职业外观），分时段局部活动避免拥挤。**默认待确认**。 | 电影未给人数；需兼顾热闹感与可读性/性能。 |
| 危险与冲突 | 【建议为游戏性调整】 | **默认建议：无战斗、无怪物入侵、无死亡惩罚**。将电影/联动中的猪灵/恶魂威胁改写为“远处背景故事”或“帮助修理/送物”等和平任务。**默认待确认（是否含夜晚危险）**。 | PO 目标“祥和无威胁”；与 S1/S2 中出现威胁画面冲突，需显式取舍。 |
| 昼夜与天气 | 【建议为游戏性调整】 | **默认建议：固定白天或长白昼**，柔和光照；不做僵尸围城/袭击触发。 | 服务安全感与注意力训练。 |
| 互动深度 | 【建议为游戏性调整】 | 优先实现：打招呼/表情反馈、简单交易或送礼、指路/集会动画；铁傀儡可做献花/巡逻氛围互动（参考 S7）。复杂声望/繁殖/经济系统暂缓。 | 复用 MC 机制语义但降复杂度。 |

---

## 设计输入建议

### 给 `town-map-design` 的要点
- **空间骨架**：拱形山体作为北/背向地景剪影；中央开放广场（市集+钟塔视觉焦点）为主 hub；放射连接 4-6 个功能点（Lava Chicken 店、秘密储藏点/小屋、铁匠/工具角、农田、民居簇、风车景观位）。【电影原样】母题 + 【建议为游戏性调整】动线简化。
- **地标优先级**：P0 广场+钟塔/钟、Lava Chicken；P1 铁傀儡巡逻点、民居与农田；P2 跳板/水池等彩蛋（视范围裁剪）。
- **可读性**：主路径宽于支路、避免回环死胡同；高对比地标色块帮助 6 岁玩家定位。
- **边界与背景**：远处崖顶房屋/神庙可做不可达远景剪影以还原层次感（S1），不必可进入。

### 给 `town-villagers-design` 的要点
- **角色构成**：以友善村民群像为主；建议 1 个“向导型”村民 + 若干背景村民 + 1 个铁傀儡守护者。可选保留 Steve 相关叙事元素但需明确是否出场。
- **职业与外观**：从 S1 可见职业线索（farmer/mason/armorer/cartographer 等）中挑 3-5 个高辨识职业；外观/比例遵循仓库 `docs/mc-mob-models-research.md` 的村民/铁傀儡结构语言，做自绘贴图与简化变体。
- **行为气质**：和平、爱面包/交易、会聚集与注视玩家的友好反馈；铁傀儡慢速巡逻、可献花（参考 `docs/iron-golem-research.md` §3.6 表现层建议）。
- **去威胁化**：不出现追逐/伤害玩家的敌对 AI；任何“入侵”叙事仅作背景或被替换为和平事件（待确认）。

### 给 `town-assets-requirements` 的要点
- **建筑资产**：广场铺装与摊位、钟塔/风车、Lava Chicken 店面招牌与室内陈设（熔岩+鸡的趣味意象需儿童化处理）、普通民居（2-3 套模块复用）、栅栏/路灯/花坛/樱花树。
- **角色与生物**：村民基座+职业配件、铁傀儡（含裂纹贴图状态可选）、少量动物氛围（鸡/猫/羊驼等按需，参考 S1 物种线索）。
- **材质/氛围**：暖木+浅石+彩色布幔点缀；白天高亮低阴影；避免恐怖/战损材质。
- **音视反馈（若后续涉及）**：轻快环境音、村民咕哝/脚步等柔和反馈；不使用警报/战斗强刺激音效（设计建议）。

---

## 待 PO 确认点（含默认建议）

| # | 待确认问题 | 为什么重要 | 建议默认值（**默认待确认**） |
|---|---|---|---|
| 1 | 城镇规模（可游玩面积、建筑数量） | 影响地图工作量、寻路与注意力负荷 | 小核心区：1 广场 + 5-7 建筑 + 短路径，单次探索 3-10 分钟可覆盖 |
| 2 | 村民数量与职业种类 | 影响热闹感、资产量与性能 | 常驻 6-10 村民、3-5 职业 + 1 铁傀儡 |
| 3 | 是否包含夜晚/危险/战斗元素 | 直接关系“祥和无威胁”基调与机制复杂度 | **不含**：固定白天/黄昏明亮氛围，无敌对生物与伤害 |
| 4 | 是否还原电影中的入侵场景（猪灵/恶魂）作为剧情 | 与安全感目标可能冲突 | 仅作背景提及或完全不出现；若要事件，仅做和平救援/修复小游戏 |
| 5 | Steve 及电影主角团是否作为 NPC 出场 | 涉及角色授权感知与叙事范围 | 默认不直接复刻电影真人角色形象；可用“村庄创建者的传说/物件”间接致敬（待确认） |
| 6 | 必须复原的地标清单与优先级 | 决定首版范围 | P0：广场+钟塔、Steve's Lava Chicken；P1：Secret Stash、风车、农田；P2：跳板等彩蛋 |
| 7 | 交互目标（注意力训练机制落点） | 地图/村民/资产需服务玩法 | 默认建议：在广场与店铺间设置“观察-寻找-回应”类轻任务锚点（具体由后续 spec 定义） |

---

## 引用与来源备注

- [1] Minecraft Wiki, *Movie:Midport Village*, https://minecraft.wiki/w/Movie:Midport_Village （访问日期 2026-11-12；页面含 Layout/History/Named structures/Quotes 等文本及画廊条目；其中引文标注“— 2025 Amazon.com description”）。  
- [2] Minecraft Wiki, *A Minecraft Movie*, https://minecraft.wiki/w/A_Minecraft_Movie （检索结果摘要，访问 2026-11-12；用于影片与场景背景交叉印证）。  
- [3] Warner Bros., *A Minecraft Movie*, https://www.warnerbros.com/movies/minecraft-movie （访问 2026-11-12；官方影片页剧情梗概）。  
- [4] Minecraft (Mojang), *A Minecraft Movie Live Event*, https://www.minecraft.net/en-us/article/a-minecraft-movie-live-event （发布 2025-03-25；检索可见正文片段，访问 2026-11-12）。  
- [5] Minecraft (Mojang), *Minecraft LIVE 2025 Recap*, https://www.minecraft.net/en-us/article/minecraft-live-2025-recap （发布 2025-03-22；检索可见正文片段，访问 2026-11-12）。  
- [6] Minecraft Wiki, *Village*, https://minecraft.wiki/w/Village （访问 2026-11-12）。  
- [7] Minecraft Wiki, *Villager*, https://minecraft.wiki/w/Villager （访问 2026-11-12）。  
- [8] 仓库内既有调研：`docs/iron-golem-research.md`（2026-11-08 抓取口径，见该文来源表）。  
- [9] 仓库内既有调研：`docs/mc-mob-models-research.md`（2026-10-26，基于 Mojang bedrock-samples 等）。

**未查到/未能直接确认的信源缺口**：Warner Bros./Legendary/Mojang 发布的 Midport Village 专项设定图、场景平面图、官方材质/色板表、含逐镜头村庄布局说明的官方制作笔记（本次未检索到可公开访问的一手页面文本）。因此建筑精确数量、尺寸比例、完整材质清单与部分活动细节在本文中按规则降级为“未在一手信源中确认/推测”或“默认待确认建议”。  
