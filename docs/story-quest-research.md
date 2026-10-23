# 探险模式引导任务链（ADV_QUESTS）与箱子步设计 · 调研报告

> 调研问题：为「探险模式任务链在工作台步之后插入『合成一个箱子』并重新设计完整引导链」提供全部事实依据——现有 12 步+终章任务链的机制全景、箱子在仓库的现状与新增改动面、引导话术/TTS 模式、测试守门断言、Minecraft 原版新手进度参照。
> 来源性质：代码论断一律标注【文件:行号】（2026-10-23 工作区实读）；外部事实仅用官方一手来源（minecraft.wiki 官方 wikitext，经 Special:Export 通道抓取；minecraft.net 官方文章），附 URL；抓取失败处明确标注。
> 调研日期：2026-10-23。

## 0. 结论先行（TL;DR）

1. **任务链全貌**：`ADV_QUESTS` 12 步 + 终章，纯数据表在【js/adventure-core.js:494-549】；每步 = `id/icon/goal/target/hint/praise + prog/check 谓词`。推进引擎 `advQuestTick`【js/modes/adventure.js:971-993】0.5s 节流、只查当前步、完成即步进落盘。事件挂点五处只 `+=` 不判断，计数只增不减（跳步防护）【js/modes/adventure.js:925-929】。
2. **箱子在仓库零实现**：ITEMS / RECIPES / BLOCKS / 图集 / ITEM_PIX 五处全无箱子（grep 全仓库仅命中 mobs.js 的「胸前饰块」建模参数与文档）。设计稿已预留二期口径：「箱子：8 木板合成（MC 口径），放置打开 = 背包扩容仓库（27→27+27 每箱），二期落地」【docs/item-crafting-design.md:268】。
3. **新增装饰性箱子（路线 A）= 6 个文件各一小处**：config 方块定义一行、ITEMS 一行、RECIPES 一行、图集格号+画师+layout 挂载、ITEM_PIX 字符画一条、adventure.js 放置计数一行 + ADV_QUESTS 插一步。无新机制、无新存档。
4. **真储物箱（路线 B）的增量成本大头不在物品注册**，在四件全新机制：每箱独立 27 槽存储、开箱 UI（新面板/新交互）、内容物存档通道（**方块 id 只记「这里有个箱子」，内容物无挂载点**，需 "x,y,z"→槽位数据 Map + 新存档或扩展 world_save）、破坏/爆炸时内容散落。存档键纪律受 ADR 0002 与「三份存档」口径约束【docs/adr/0002、GLOSSARY.md:195】。
5. **插一步会碰红的测试断言至少 12 处**，最硬的两条：`ADV_QUESTS.length === 13`（两个测试文件各一）与 `qs.map(q=>q.id)` 的 13 元素 deepStrictEqual 序列断言【test/adventure-core.test.js:156、test/adventure-mode.test.js:1411-1415】；老档归一化测试以 step 下标语义写死（`step:4 /* 挖 8 圆石 */`），插在链条中部会移位其口径。
6. **MC 官方首日流程中箱子是「庇护所阶段的可选储物件」，位于石器/熔炉之后、与床同段**——官方教程原话「A chest may not be necessary at this stage, but is a convenient way to stash items…」【minecraft.wiki Tutorial:Beginner's guide】。「工作台之后立刻插箱子」比 MC 顺序提前，但本仓库儿童口径（无死亡掉落、背包 27 槽上限小）下提前教储物有独立理由，属设计裁量。
7. **原木预算数学（插步后必须重算）**：当前 q1=3 原木；插入箱子步（8 板）后，到木镐+火把的最低消耗 = 工作台 4 板 + 箱子 8 板 + 木镐 3 板 + 木棍 2 板 = 17 板 > 12 板（3 原木）——**q1 需提到 4 原木**（恰与官方教程「four logs would be enough」同口径）或 hint 引导补砍。
8. **话术并句是硬口径**：SpeechKit 是 cancel-then-speak【js/speech.js:71-72】，表扬+引导必须拼一句（现有实现全部如此）；新步的 hint/praise 文案五件套有测试逐条断言非空。
9. **零文字依赖的实际落地**：任务 UI 并非纯图标——goal 是中文短句（emoji 图标 + TTS 语音补齐），配 iconOf 像素图标/emoji 兜底【js/icons.js:839-845】；新步照抄现有字段形状即自动合规。
10. **仓库既有 MC 调研文档核对**：工作台 4 板 / 熔炉 8 圆石 / 工具材料数与官方 wiki 一致【docs/minecraft-item-crafting-research.md:265-273 抽查核对通过】；但该文档**无箱子配方条目、无首日流程章节**（本报告 §5 补齐，均经官方 wikitext 一手核实）。

---

## 1. 现有任务链全景

### 1.1 ADV_QUESTS 十二步 + 终章全表

数据表在【js/adventure-core.js:494-549】（应用层纯核心，`finale:true` 标记终章）。步序即数组序：

| # | id | icon | goal（目标文案） | target | 计数键（counts） | check 谓词 |
|---|----|------|------------------|--------|------------------|------------|
| 1 | q1_log | 🪵 | 砍树收集 3 根原木 | 3 | `collect_log` | ≥3 |
| 2 | q2_planks | 🟫 | 合成 4 块木板 | 4 | `craft_planks` | ≥4 |
| 3 | q3_table | 🛠️ | 合成并放下工作台 | 2 | `craft_craft_table` + `place_craft_table` | 两键各 ≥1（复合步） |
| 4 | q4_pick_wood | ⛏️ | 合成木镐 | 1 | `craft_pick_wood` | ≥1 |
| 5 | q5_cobble | 🪨 | 挖 8 块圆石 | 8 | `mine_cobble` | ≥8 |
| 6 | q6_pick_stone | ⛏️ | 合成石镐 | 1 | `craft_pick_stone` | ≥1 |
| 7 | q7_coal | ⚫ | 挖 5 个煤矿 | 5 | `mine_coal_ore` | ≥5 |
| 8 | q8_torch | 🔥 | 合成 4 支火把 | 4 | `craft_torch` | ≥4 |
| 9 | q9_iron | 🟠 | 挖 5 块铁矿 | 5 | `mine_iron_ore` | ≥5 |
| 10 | q10_smelt | ♨️ | 放下熔炉，烧出 3 块铁锭 | 4 | `place_furnace` + `smelt_iron_ingot` | place≥1 且 smelt≥3（复合步） |
| 11 | q11_pick_iron | ⛏️ | 合成铁镐 | 1 | `craft_pick_iron` | ≥1 |
| 12 | q12_diamond | 💎 | 挖到 3 颗钻石 | 3 | `mine_diamond_ore` | ≥3 |
| 终章 | finale | 🗡️ | 合成钻石剑 | 1 | `craft_sword_diamond` | ≥1，`finale:true` |

话术（每步 `hint` 引导 + `praise` 表扬，夸努力不夸聪明口径，逐条原文见上引行区间）：如步 1 hint「去找一棵大树，按住挖树干，捡回 3 根原木哦！」/ praise「原木收集齐啦！你一直在努力，真棒！」。计数键五类口径的注释在【js/adventure-core.js:490-493】：`collect_<物品>` 拾取件数 · `craft_<物品>` 合成件数 · `mine_<矿>` 挖掉块数 · `place_<站点>` 放置次数 · `smelt_<物品>` 炉内烧成件数。

步序的设计权威是设计稿 D11 的 12 步清单【docs/item-crafting-design.md:380-381】，测试对着它做 id 序列断言（见 §4）——重新设计链 = 同步改设计稿。

### 1.2 事件挂点 → 计数账本

计数账本 `ADV.quest.counts`（普通对象，键随事件长出来）【js/modes/adventure.js:59】。唯一写入函数 `advTally(kind, n)`：只 `+=` 不做任何判断，顺路 `advDirty = true` 随 5s 节流落盘【js/modes/adventure.js:925-929】。**只增不减 = 跳步防护**（计数依赖玩家事件、不可逆），注释明示该口径【js/modes/adventure.js:926、js/adventure-core.js:490-491】。

五类挂点（T15 接线总注【js/modes/adventure.js:1228-1231】）：

| 事件 | 挂点函数 | 位置 | 计数细节 |
|------|----------|------|----------|
| 挖掘 | `advBreakBlock` 尾部 → `advQuestMine(id,x,y,z)` | 【js/modes/adventure.js:538、933-938】 | `ADV_MINE_TALLY` 映射【js/adventure-core.js:484-487】：石头(3)/圆石(4)→`mine_cobble`，煤/铁/钻矿→各自键。**只认蓄力挖掘**——TNT 爆炸路径（advExplode）不经过此挂点 |
| 拾取 | `advOnCollect` | 【js/modes/adventure.js:660-672】 | 666 行 `advTally('collect_'+itemId, n-left)`——按**实收件数**计（满包拒收的不算） |
| 合成 | `advOnCraft` | 【js/modes/adventure.js:147-155】 | 154 行 `advTally('craft_'+out.item, out.n)`——按产出件数 |
| 放置 | `advTryPlace` 成功分支 | 【js/modes/adventure.js:588-589】 | **只有两行**：`place_craft_table` / `place_furnace`（B_CRAFT/B_FURNACE 各一行）。新站点键 = 加一行 |
| 烧成 | `advFurnaceTick` 产出分支 | 【js/modes/adventure.js:832-836】 | 836 行 `advTally('smelt_'+out.id, made)`——炉内产出即算，不等入包 |

### 1.3 推进引擎：0.5s 节流 · 不越级 · 步进链

`advQuestTick(dt)`【js/modes/adventure.js:971-993】，每帧由 update 调【js/modes/adventure.js:1122】：

- **0.5s 节流**：`ADV_QUEST_CHECK_T = 0.5`【js/adventure-core.js:479】；计时器 `advQuestT` 到窗才查，进场复位一个整窗（首查在进场半秒后）【js/modes/adventure.js:923、1039】。
- **不越级**：974-977 行 `const q = ADV_QUESTS[st.step]; if (!q || !q.check(st.counts)) return;`——只查**当前步**谓词；后期计数全满也一步一周期逐级走（有专项测试，见 §4）。
- **完成链**：`sfx(q.finale ? 'win' : 'level')` → 完成 toast → 表扬 TTS **与下一步引导并句**（987 行 `q.praise + ' 接下来：' + nxt.hint`，防 cancel-then-speak 顶掉）→ 新任务图标 toast → `st.step += 1` → `advQuestSlot.save(st)` 即时落盘 → `advQuestPaint()` 重画。
- 挖掘→计数的键映射只认 `ADV_MINE_TALLY` 登记的方块；掉落表（`BLOCKS.drop`）与任务计数是两条独立链路。

### 1.4 任务进度存档 adventure_quest_save

- 键与槽：`ADV_QUEST_KEY = 'adventure_quest_save'`，`SyncDB.slot(..., {defaults: {step: 0, counts: {}}})`【js/modes/adventure.js:66-73】。
- 形状：`{_v, step:number, counts:{<键>:number}, title?:string}`——`title` 终章达成后写入（称号）。
- 读：init 1034-1038 行 `advQuestSlot.load()` + 归一化（老档无 counts 补空表、损坏 counts 归一空表、step 钳进 `[0, ADV_QUESTS.length]`，表外=终章完成位）。
- 写：步进时**即时**落盘（991 行）+ 事件计数只置 `advDirty`、随 5s 世界存档节流经 `advSaveNow` 落盘（93 行）。
- 注意 `mkSaveSlot defaults 只补缺失字段`——插步后老档 `step:N` 的语义会整体移位（§4.4 详述风险）。

### 1.5 钻石首获仪式

挂点 `advQuestMine`【js/modes/adventure.js:933-938】：首颗判定 934 行 `id === B_DIAMOND_ORE && !ADV.quest.counts.mine_diamond_ore`（在记账**之前**查询，故为首颗）。仪式 `advDiamondRite`【js/modes/adventure.js:943-953】：`sfx('gem')` + 钻色/金光双层 `Fx.pop` 冲击波 + 钻色碎块 `Fx.debrisBurst` + 三道金弧 `Fx.arc` + 专属 TTS「哇！挖到钻石啦！亮晶晶的宝贝！你找得真仔细！」。与任务步无关——第 12 步之前挖到第一颗同样庆祝，第二颗起不再放（计数照累计，仪式≠记账≠步进）。

### 1.6 终章：钻石剑 → 称号 + 烟花

`advQuestTick` finale 分支【js/modes/adventure.js:980-984】：`st.title = ADV_QUEST_TITLE`（'小小探险家'，常量在【js/adventure-core.js:480】）+ 专属 TTS「你获得了「小小探险家」称号！为你放烟花！」+ `sfx('win')` + `advFireworks()`（四色 pop+碎块组合，不震屏【js/modes/adventure.js:956-966】）。step 走到 13（表外）后 `ADV_QUESTS[13]` 为 undefined → 不再查 → 重进不重复授予（称号随档恢复）。

### 1.7 工具耐久归零 → 句当前任务步指路

`advWearHeld`【js/modes/adventure.js:297-316】（命中/挖掘两路合一的耐久结算）：`damageTool` 返 0 = 破板 → 303 行取 `q = ADV_QUESTS[ADV.quest.step]` → `remove` 清槽 + 307 行 `SpeechKit.speak(advBreakToolText(name, q ? q.hint : null))` + 预警账本重置。话术纯函数 `advBreakToolText`【js/adventure-core.js:580-583】：安抚句 + 「接下来：」+ 当前步 hint **并句**（hint 为空不拼）。**插步对它是透明的**——它读的是 `ADV_QUESTS[step]`，链变长自动指到新步。

---

## 2. 箱子（chest）现状盘点与新增改动面

### 2.1 全仓库 grep 结论：运行时代码零实现

grep `箱子|chest|Chest`（大小写不敏感，js/html/css/md/json）：

- **js/ 运行时代码唯一命中**是【js/mobs.js:60、84-85】的 `chest`——怪物建模参数「胸前饰块（监守者光纹）」，与箱子物品无关。
- `ITEMS` 无 chest 键【js/items-core.js:23-99 全表读毕，共 54 键】。
- `RECIPES` 无箱子配方【js/craft-core.js:29-65，共 28 条】。
- `BLOCKS` 无箱子方块；新方块号段 36~50 已占满（B_SAPLING=50 顺延说明【js/config.js:337、341】）——下一个可用 id 是 **51**。
- 图集无箱子 tile：格号常量只到 `T_SAPLING = 28`、共 29 格已绘【js/texture-atlas.js:41-50】；16×16=256 格总量，注释明示「29 格余量充足」【js/texture-atlas.js:23】。
- `ITEM_PIX` 无箱子字符画【js/icons.js:721-769】。
- 文档命中：设计稿二期规划「**箱子**：8 木板合成（MC 口径），放置打开 = 背包扩容仓库（27→27+27 每箱），二期落地」【docs/item-crafting-design.md:268】、二期范围表【docs/item-crafting-design.md:154、420】、MC 挖掘硬度调研的箱子数值行（§5.4 引）。

### 2.2 工作台/熔炉先例：新增一个可放置箱子要动的全部文件

先例形状（工作台为例）：物品 `craft_table: {name:'工作台', icon:'🛠️', block:46}`【js/items-core.js:73】→ 方块 `BLOCKS[B_CRAFT] = {name, top/side/bottom 色值, hard:2.5, tool:'axe', tier:0, drop:[['craft_table',1,0]]}`【js/config.js:358-359】→ 配方 `{id:'craft_table', out:{item:'craft_table',n:1}, cost:{planks:4}, station:'hand'}`【js/craft-core.js:33】→ 图集三处（格号常量 T_CRAFT_TOP/SIDE【js/texture-atlas.js:48】、画师 PAINTERS【js/texture-atlas.js:238-264】、layout 挂载【js/texture-atlas.js:328】）→ 图标 `craft_table: {art: TABLE_ART, map:{…色板}}`【js/icons.js:764】。

照此先例，新增箱子 = **6 个文件的改动点**：

| 文件 | 改动点 | 参照 |
|------|--------|------|
| js/config.js | `const B_CHEST=51`（36~50 已满，顺延 51，照 B_SAPLING 顺延先例）；`BLOCKS[B_CHEST] = {name:'箱子', top/side/bottom, hard:2.5, tool:'axe', tier:0, drop:[['chest',1,0]]}` | 【js/config.js:341、358-359】 |
| js/items-core.js | ITEMS 一行 `chest: {name:'箱子', icon:'🧰', block:51}` | 【js/items-core.js:73-74】 |
| js/craft-core.js | RECIPES 一行 `{id:'chest', out:{item:'chest',n:1}, cost:{planks:8}, station:'table'}`（MC 是 3×3 配方 → table 级；station 归属属设计裁量） | 【js/craft-core.js:57】（熔炉条形状） |
| js/texture-atlas.js | 格号常量 T_CHEST=29 + 一个 PAINTERS 画师 + `layout.tiles[B_CHEST]` 挂载（可复用 planksBase 底笔） | 【js/texture-atlas.js:48-50、238、313-331】 |
| js/icons.js | `CHEST_ART` 16 行字符画（照 TABLE_ART 手绘）+ `ITEM_PIX` 一行 | 【js/icons.js:644-661、764】 |
| js/modes/adventure.js | 若任务步要「放置」计数：advTryPlace 588-589 加一行 `if (it.block === B_CHEST) advTally('place_chest', 1)` | 【js/modes/adventure.js:588-589】 |
| js/adventure-core.js | ADV_QUESTS 插步（新行：id/goal/target/hint/praise/prog/check，计数键用 `craft_chest`+`place_chest` 复合或单键） | §1.1 |

**放置/解锁逻辑现状（关键：通用路径已覆盖，站点逻辑不用动）**：

- 通用放置：`advTryPlace`【js/modes/adventure.js:574-596】由 `ITEMS.block` 字段驱动（手持放置型物品点准星面）——物品注册即自动可放置；合法性 `advPlaceCheck`【js/adventure-core.js:359-373】（落点空气 + 薄块规则）+ 不与玩家身体重叠【js/modes/adventure.js:582】。
- **「走近 4 格解锁」只用于工作台级配方与熔炉开面板**，与箱子是否需要接此逻辑取决于路线选择：
  - 半径常量 `ADV_STATION_R = 4`【js/adventure-core.js:399】；判定纯函数 `advNearStation`【js/adventure-core.js:411-417】（水平距离、含等号）。
  - 站点缓存 `advStations` Map【js/modes/adventure.js:81】：`advMarkEdit` 在放置/挖除时顺路登记——**86 行只认 `id === B_CRAFT || id === B_FURNACE`**；重进由 `advRescanStations` 从 edits 重放收集【js/modes/adventure.js:747-754】。
  - 工作台解锁（配方卡亮灰）：`advStationOk`【js/modes/adventure.js:144-146】→ `canCraft` 的 `station:'table'` 门槛【js/craft-core.js:115】；首次靠近有 TTS 引导上升沿【js/modes/adventure.js:736-744】。
  - 熔炉开面板：onMouse 左键 `lookId === B_FURNACE` + `advNearStation(…, B_FURNACE)` → 开面板/太远提示【js/modes/adventure.js:1152-1158】。
  - **路线 A 的箱子若只是装饰性方块 + 任务计数，不接站点逻辑**（合成走 `station:'table'` 即复用现有工作台门槛）；**路线 B 的箱子若要「走近点击开箱」**，则照熔炉先例：B_CHEST 加进 `advMarkEdit` 的站点登记 + onMouse 加一个 lookId 分支。

### 2.3 路线 A vs 路线 B 成本评估

**路线 A：纯引导任务（合成箱子 + 放置即完成，箱子是装饰性方块）**

- 改动 = §2.2 的 7 处数据行 + ADV_QUESTS 插步 + 相应测试更新。无新机制、无新存档、无新 UI。
- 玩法语义：箱子可合成、可放置、可挖回（drop 自身）、可被 TNT 掀掉（`advTntRoll` 通用掷骰，非 tnt 旗标即参与【js/adventure-core.js:463-468】）——与砖块/石砖等既有「合成型装饰方块」完全同构。
- 缺点：对孩子是「假箱子」（放不了东西），表扬话术只能围绕「你有了自己的箱子」做仪式感，不能兑现「存放」语义——与 goal 文案「用来存放东西」有落差，话术需回避或明示二期。

**路线 B：真储物箱（打开 UI、独立存储、存档）**

设计稿二期口径已定「放置打开 = 背包扩容仓库（27→27+27 每箱）」【docs/item-crafting-design.md:268】。路线 A 的 7 处之外还需**四件全新机制**：

1. **每箱独立 27 槽存储**：`mkInventory`/`add`/`count`/`take`/`serialize`/`deserialize` 全套可复用【GLOSSARY.md「背包核心」词条；js/inventory-core.js】。但体素模型里方块只有数字 id——**容器内容物没有挂载点**，需要新数据结构（"x,y,z"→27 槽数组），树苗计时 Map（`advSaplings`「不落盘，重进重建」【js/modes/adventure.js:473、623-632】）是结构先例、但箱子内容**必须落盘**（重建不出来的玩家数据）。
2. **开箱 UI**：熔炉面板 `mkFurnacePanel`【js/mode-kit.js:452 起】是「三槽+进度条的纯显示面板」先例；箱子需要 27 格网格 + 与玩家背包互转——更接近 `mkCraftPanel` 的背包网格【js/mode-kit.js:241-272】，但语义是双向搬运而非合成。大概率要在 mode-kit 新增面板工厂（conventions 的 `-kit` 跨模式工具定位【AGENTS.md】）或参数化复用。交互配套：指针解锁/回锁（advFreeMouse/advRelock【js/modes/adventure.js:170-178】）、Tab 键三态切换（现在 Tab=背包/熔炉互斥【js/modes/adventure.js:1171-1178】，加第三块面板要重排）、onMenu 面板守卫【js/modes/adventure.js:1186-1193】。
3. **内容物存档通道（受存档键纪律约束）**：ADR 0002 规定 `inventory_save` 由背包壳 `js/backpack.js` 唯一持有、字面量只允许出现在该文件、消费方不得自开键【docs/adr/0002-focus-loot-integration.md:19-20；js/backpack.js:19-20；test/backpack.test.js 以键字面量守门】。箱内物品**不属于全局共享背包**，不能塞进 inventory_save；合理通道是（a）扩展 `adventure_world_save` 的 edits 重放体系为「方块差异 + 容器内容」两份 per-position 数据，或（b）新增第四存档键（如 `adventure_chests_save`）——两条都动「探险模式三份存档」的口径【GLOSSARY.md:195、js/modes/adventure.js:31-33、docs/item-crafting-design.md D12 存档表 387-393】，设计稿与 GLOSSARY 需同步修订。
4. **破坏/爆炸的内容散落**：MC 口径「破坏箱子 → 内容散落 + 掉箱子本身」【minecraft.wiki/w/Chest，§5.2 引】。实现上 `advBreakBlock` 与 `advExplode` 两处都要加「B_CHEST → 先倒出内容物 Drops.spawn 再掉自身」分支；死亡/退世界**不需要**清箱（箱子在世界里，不是炉内料）。

其他路线 B 联动：F3 曾核定「双模式可堆叠种类并集 35 + 6 件不并堆工具 > 27 槽」才把里程碑工具挪出背包【GLOSSARY.md「共享背包」词条】——真箱子恰好是这 27 槽压力的解压阀，是路线 B 的正面理由；但每箱独立存储 + 双 UI 搬运对 6 岁儿童是全新交互面（纯鼠标点选约束下，「把物品放进箱子」的交互要专门设计，MC 的拖拽/shift-点击都不可用）。

---

## 3. 引导话术与 TTS 模式

### 3.1 话术数据表

任务步全部文案收在 `ADV_QUESTS` 每条的字段里【js/adventure-core.js:494-549】：`goal`（目标短句，HUD/任务卡显示）、`hint`（语音引导）、`praise`（完成表扬）、`icon`（emoji）。无独立话术文件——**话术即数据表的一部分**，插步 = 写好这三个字符串 + 图标。话术口径「夸努力不夸聪明」（MISSION.md 反馈哲学【MISSION.md:17】），现有措辞如「你一直在努力，真棒」「你真会想办法」「你坚持到了最后，真了不起」可作新步文案的参照系。

### 3.2 TTS 表扬怎么触发

- SpeechKit 是全游戏共用 interface：`speak`/`cancel`，**cancel-then-speak** 语义（新句打断旧句）【js/speech.js:45-74，71-72 行 cancel 后 speak】；zh-CN voice 挑选、rate 0.9 / pitch 1.1【js/speech.js:50】；说话起止接 AudioMixer.duck 给 BGM 让路【js/speech.js:85-91】。
- 任务步完成：`advQuestTick` 987 行 `SpeechKit.speak(q.praise + ' 接下来：' + nxt.hint)`——**表扬与引导拼一句**（拆两句会被后句顶掉前句，模式内多处注释明示此口径【js/modes/adventure.js:578-580、1085-1086】）。终章专属句 982 行。
- 合成成功具体表扬：`advOnCraft` 150 行 `name + '做好啦！你真会想办法！'`（产物名入句）。
- 进场欢迎句带当前步 hint 并句【js/modes/adventure.js:1085-1087】。
- **对新步话术的直接影响**：hint/praise 必须为完整短句（它们会被拼接：`praise + ' 接下来：' + hint`），且 hint 会单独出现在工具坏话术（`advBreakToolText`）与欢迎句里——语义要能脱离上下文独立成立。

### 3.3 任务步在 HUD 上怎么显示

两处：

1. **任务卡**（打开背包即见）：容器 `advPanel.questEl` 是 `mkCraftPanel` 创建的 `aside.mkp-quest` 占位容器【js/mode-kit.js:218-220、425】；渲染函数 `advQuestPaint`【js/modes/adventure.js:997-1016】——当前步大图标 + goal + `p/target` 进度数字 + 进度条（`prog` 谓词算分子，复合步取各条件之和、超量钳回【js/adventure-core.js:506、535】）；已完成步 `<s>` 划线史；称号置顶（`advq-badge`）；未来步不剧透。样式类 `.advq-*` 在【css/style.css:1192-1283】、触屏适配【css/touch.css:303】。
2. **HUD 常驻一行**：`hud()` 方法【js/modes/adventure.js:1195-1209】，1198-1199 行拼 `📖 任务: {icon} {goal} {p}/{target}`（免开背包可见进度）。

### 3.4 「零文字依赖」约束的实际影响

MISSION.md 约束原文：「目标用户 6 岁：纯鼠标点选、零文字依赖（图标+中文 TTS 语音）、无键盘/指针锁定」【MISSION.md:14】。实际落地口径：

- 任务 UI **并非纯图标**——goal 是中文文字短句，与 emoji 图标、TTS 语音三通道并存（图标做视觉锚点、文字给家长看、TTS 给孩子听）。真正的零文字依赖落在**交互件**上：配方卡是「图标+数量角标」无文字（iconOf 像素图标/emoji 兜底【js/icons.js:839-845；js/mode-kit.js:305-309】）、站点徽标用 🛠️/♨️【js/mode-kit.js:192】、分类页签纯图标【js/mode-kit.js:196-201】。
- 对新任务步的约束就是**照抄现有字段形状**：icon 用一个语义明确的 emoji（现有任务步全用 emoji 而非像素图——注意任务卡 `advq-ic` 直接渲染 `q.icon` 字符串，未走 iconOf）；hint/praise 短句（TTS 读）；goal 短句。若走路线 B，箱内物品搬运交互必须纯鼠标点选（MC 的拖拽/shift 点击不可用）——这是路线 B UI 设计的硬约束。

---

## 4. 测试守门

### 4.1 覆盖探险任务链/核心的测试文件

| 文件 | 覆盖面 | 关键位置 |
|------|--------|----------|
| test/adventure-core.test.js | 任务表形状 + 谓词抽样 + 提醒政策纯函数 | 155-166（任务表）、168-200（S4） |
| test/adventure-mode.test.js | 任务链行为全链（约 95KB，T12~T15+S4 全量行为断言） | 1407-1657（T15 段） |
| test/boot.test.js | index.html 全脚本共享词法环境依序加载冒烟（顶层重名/解析错会红） | 48-78 |
| test/conventions.test.js | 新文件命名/头注释/LF 无 BOM/`-core` 必配同名测 | 28-58 |
| 数据表联动（加箱子物品会碰） | RECIPES 数量 / ITEM_PIX 键集 / block 号段 / BLOCKS 字段 / 图集 UV | 见 4.3 |

### 4.2 插一步会碰红的断言（精确清单）

test/adventure-mode.test.js：

1. 1411 行 `qs.length === 13` → 14。
2. 1412-1415 行 `deepStrictEqual(qs.map((q) => q.id), ['q1_log', …, 'finale'])`——**id 序列写死 13 元素**，必须同步插入新 id（如 `q4_chest`）。
3. 1416-1417 行 `qs[12].finale === true` / 主线 12 条无 finale——终章下标移到 13。
4. 1418-1429 行逐条形状断言（id/icon/goal/target≥1/hint 非空/praise 非空/prog/check 函数）——新步自动纳入 forEach，写齐字段即过。
5. 1430 行 `new Set(qs.map(q=>q.id)).size === 13`。
6. 1433-1465 行**谓词逐条**：全部用下标 `ck(0..12)`——插在链条中部则其后所有下标移位，且要为新步补 `ck(n, {craft_chest:…})` 式断言。
7. 1467-1493 行事件计数链：若新步消费新键（`place_chest`），应在此测试补挂点断言（放置挂点在 1481-1485 行的模式）。
8. 1495-1508 行不越级测试：1500-1503 行把 15 个计数键一次灌满——需加新步的键，且 1507 行「逐级推进」断言的周期数语义不变。
9. 1539 行老档归一化 `step: 4 /* QUESTS[4] = 挖 8 圆石 */`——**注释与断言语义绑定下标**；插在 q3_table 之后则 step=4 不再是圆石步，此测试的口径要重写（1546 行「第 5 步」同理）。
10. 1552 行越界 step 钳到 13 → 14。
11. 1580-1608 行终章测试：`A.ADV.quest.step = 12`（直达终章捷径）、1585 行 `step === 13`——全部 +1。
12. 1611-1633 行任务卡 UI：1621 行 `step = 2`（当前步=工作台）、1623 行「木板在第 2 步」、1627 行 `step = 13`——下标移位。

test/adventure-core.test.js：156-157 行 `length === 13` / `ADV_QUESTS[12].finale` 同步改。

### 4.3 加箱子物品/方块/配方会碰的数据表断言

- `RECIPES.length === 28`（「一期全表 4+16+8 条」）【test/craft-core.test.js:57-61】→ 29。
- `ITEM_PIX` 键集与 `ITEMS` 键集 deepStrictEqual【test/icons-item.test.js:72-77】——加物品不加像素画即红（防错网）。
- ITEMS 条目形状与 block 字段号段断言、名字抽查（TTS/任务链引用键名稳定性）【test/items-core.test.js:62-64、93、144】。
- BLOCKS 新方块必带 hard/tool/tier/drop 四字段、drop 物品 id 非空、RGB 三元组形状【test/blocks-fields.test.js:79、141、181】。
- 图集：`layout.tiles` 每格号 `0 ≤ idx < count`、MeshCore UV 契约【test/texture-atlas.test.js:61-66、171-172】——新格号 29 在界内即过。
- drops.test.js 对 BLOCKS.drop 物品 id 交叉校验【js/items-core.js:9-10 注释明示】。

### 4.4 老档兼容（插步特有的风险点）

`advQuestSlot` 的 `mkSaveSlot defaults 只补缺失字段`【js/modes/adventure.js:72-73】：老档 `{step:6}` 在新链里指向**不同的任务**（例：原 step6=合成石镐，插入箱子步后 step6=挖煤）。后果：当前步谓词对老 counts 可能立即满足（计数已超）→ 一步一周期快速滑进、每步都放完成音效+表扬——观感是「进场连响 7 声」。这不是崩溃而是体验毛刺；测试 1537-1553 的归一化断言会逼着设计者显式决策（顺移 step / 接受滑步 / 存档加版本号迁移）。**插步位置越靠前，受影响的老档玩家越多**——从「工作台之后」插入意味着 step≥4 的所有老档全部移位。

---

## 5. Minecraft 原版新手进度参考（外部一手来源）

抓取说明：minecraft.wiki 页面正文直抓被防护拦截（webfetch Transport error），改经官方 `Special:Export` 通道抓到 **Chest 与 Tutorial:Beginner's guide 两页的官方 wikitext 全文**（版本号 3818487 / 2026-10-04 与 3798422 / 2026-09-27），内容为 wiki 当前原文，属一手来源。minecraft.net 文章经 websearch 摘要获取（官方站点官方文章，一手；未全文抓取，标注）。

### 5.1 箱子：配方与容器作用

来源：[Chest – Minecraft Wiki](https://minecraft.wiki/w/Chest)（官方 wikitext 已抓取）。

- **配方 = 8 任意木板**：Crafting 模板 `A1/B1/C1/A2/C2/A3/B3/C3 = Any Planks`（3×3 满圈、中心留空）→ Chest。任意木材的木板皆可。
- **容器作用**："A small chest has 27 slots of inventory space, and a large chest has twice that amount, at 54 slots."——小箱 27 格、相邻双箱合成 54 格大箱。
- **破坏行为**："A chest can be broken using anything, but an axe is the fastest. Chests always drop themselves when mined. If the chest contains items, the items are also dropped when the chest is broken."——任何方式可破坏、斧最快、总是掉自身、**内容物随破坏散落**。
- **配方解锁**（Trivia）："The chest recipe is not unlocked by any specific item, but rather, having enough slots in the inventory occupied by any item."——按背包占用解锁，非物品触发（与 JE 配方书机制相关，本仓库无此机制，仅供参考）。

### 5.2 箱子在新手流程中的位置

来源：[Tutorial:Beginner's guide – Minecraft Wiki](https://minecraft.wiki/w/Tutorial:Beginner%27s_guide)（官方 wikitext 已抓取；注意该页已从 `Tutorials/` 命名空间迁至 `Tutorial:`，旧链重定向）。

官方「Your first day」章节序：**Wood & basic crafting**（砍树→原木→木板→工作台→木棍）→ **First tools & stone**（木镐→挖石→石镐+石斧+**熔炉同批**："This time, you'll need a stone pickaxe, a stone axe, and a furnace."）→ **Obtaining food** → **Making shelter**（必需清单：1 工作台 + 1 熔炉 + 1 床；**箱子是可选件**）→ **The first night**（火把=煤/木炭+木棍→4 支；床睡过夜）。

箱子的原话定位（Making shelter 段）：**"A chest may not be necessary at this stage, but is a convenient way to stash items you don't want to carry around. If you get killed, anything in the chest remains there, waiting for you rather than scattered around your death site."**——此阶段非必需、但方便存放不想随身带的物品；死亡后箱内物品原地等你而不是散落死亡点。同段还给了箱子的合成模板（8 板）与「破坏→内容散落+掉自身」「两箱相邻合成大箱」的行为说明。

**对照结论**：官方口径中箱子位于**石器/熔炉之后、庇护所阶段**，且从不在「必做」清单里。「工作台之后立刻插箱子」比 MC 顺序提前了约 3 个工具级差（跳过了木镐/圆石/石镐整段）。本仓库可辩护的提前理由：① 儿童版死亡零惩罚（背包保留【js/adventure-core.js:258-260】），MC 的「箱子保死亡财产」动机不存在，但**背包只有 27 槽且与专注训练营共享**（ADR 0002，F3 曾因 27 槽塞不下把里程碑工具挪出背包【GLOSSARY.md「共享背包」词条】），储物压力真实存在；② 早期教「存放」概念成本低。反向理由：q3_table 后孩子还没有镐，「箱子 vs 继续做镐」在配方书里同屏竞争，8 木板的成本（2 原木）在 3 原木预算下会挤掉木镐的材料。这是设计裁量，事实摆如上。

### 5.3 工作台 / 熔炉 / 工具配方对照

来源：[Tutorial:Beginner's guide](https://minecraft.wiki/w/Tutorial:Beginner%27s_guide)（已抓取）；与本仓库调研文档【docs/minecraft-item-crafting-research.md:265-273】**抽查核对一致**：

| 配方 | 官方（已核实） | 仓库现状 | 仓库调研文档记载 |
|------|----------------|----------|------------------|
| 工作台 | 4 任意木板（2×2 满格） | `{planks:4}, station:'hand'`【js/craft-core.js:33】 | 【minecraft-item-crafting-research.md:273】一致 |
| 熔炉 | 8 圆石（3×3 满圈中心空，**不需煤**） | `{cobble:8}, station:'table'`【js/craft-core.js:57】 | 【minecraft-item-crafting-research.md:272】一致（且该文档已纠正过「8 圆石+煤」的讹传） |
| 木镐 | 3 板 + 2 棍 | `{planks:3, stick:2}`【js/craft-core.js:39】 | 【minecraft-item-crafting-research.md:262-265】工具材料数一致 |
| 钻石剑 | 2 钻 + 1 棍 | `{diamond:2, stick:1}`【js/craft-core.js:50】 | 同上（剑=2 材+1 棍）一致 |
| 火把 | 煤/木炭 + 木棍 → **4 支** | `{fuel:[[coal,charcoal],1], stick:1} → n:4`【js/craft-core.js:35】 | 官方 Beginner's guide 模板 `Output=Torch,4`——产出 4 支一致 |
| 箱子 | **8 任意木板** | 无（§2.1） | 仓库文档无此条目（缺口）；设计稿【item-crafting-design.md:268】口径「8 木板」与官方一致 |

另外【docs/minecraft-mining-hardness-research.md:245、332】记载箱子挖掘数值：hardness 2.5 / 斧 / 无 tier 门槛 / 徒手 3.75s 照常掉自身——与官方 Chest 页「broken using anything, axe fastest, always drop themselves」核对**一致**；新方块 `BLOCKS[B_CHEST]` 的四字段可径直照此数值（与 B_CRAFT 同值）。

### 5.4 官方首日流程的另一个一手版本（minecraft.net）

来源：[How to Survive your First Day – minecraft.net](https://www.minecraft.net/en-us/article/how-survive-your-first-day)（官方文章，《Minecraft Guide to Exploration》官方摘录；经 websearch 获取步骤摘要，未全文抓取——标注）。

步骤序：标记出生点 → 收 20 木头 → 木板 → **工作台（4 板）** → 木棍 → 木镐/斧/剑/锹 → 挖 20 圆石 → 石器 → 石斧再收 20 木头 → **杀 3 羊做床** → **熔炉** → 挖煤 → 火把 → L 形庇护所+木门。此版本中床在熔炉前、未提箱子——与 wiki 教程（熔炉与石器同批、箱子是庇护所可选件）互为印证：**箱子在两个官方版本里都不属首日必做链**。

### 5.5 原木预算数学（插步设计的关键事实）

现有任务链的材料流水（配方数据【js/craft-core.js:31-54】）：

- q1 收 3 原木 → 12 板预算；q2 木板步耗 1 原木（产 4 板）；q3 工作台耗 4 板；q4 木镐耗 3 板 + 2 棍（棍配方 2 板→4 棍，一次覆盖镐 2 棍 + q8 火把 1 棍）。现状：3 原木 = 12 板 ≥ 4+3+2 = 9 板，**够**。
- **插入箱子步（8 板）后**：最低消耗 = 工作台 4 + 箱子 8 + 木镐 3 + 棍 2 = 17 板 > 12 板——**3 原木不够串到木镐**。
- 官方教程起步口径恰好是「**four logs would be enough**」（Beginner's guide，Wood & basic crafting 段原文）——4 原木 = 16 板，仍差 1 板；5 原木 = 20 板 ≥ 17 板才稳。
- 设计含义：插箱步大概率要同时把 q1 的 target 从 3 提到 4~5（动 q1 的 goal/hint/praise 与 check 谓词），或在箱步 hint 里明示「再去砍一棵树」。这是「重新设计完整引导链」绕不开的第一笔账。

---

## 6. 附：插步设计速查卡

- **插入点候选**：用户设想「q3_table 之后」（新步成为 step 4，原 q4~q12/finale 全部 +1）——测试 §4.2 全清单适用；越往后插，老档移位面越小但与 MC 顺序差越大。
- **新步字段模板**（照 q3_table 复合步形状【js/adventure-core.js:503-507】）：`{id:'q4_chest', icon:'🧰', goal:'合成并放下箱子', target:2, hint:'…', praise:'…', prog:(c)=>Math.min(c.craft_chest||0,1)+Math.min(c.place_chest||0,1), check:(c)=>(c.craft_chest||0)>=1&&(c.place_chest||0)>=1}`。
- **计数键自动接通**：`craft_chest` 由合成挂点（advOnCraft）自动累计——只要 RECIPES 产出 item id 为 `chest`；`place_chest` 需在 advTryPlace 加一行（§2.2 表）。
- **同步要改的口径文档**：设计稿 D11 12 步清单与实施状态注记【docs/item-crafting-design.md:11、380-381】、GLOSSARY.md「探险模式」词条「12 步+终章」【GLOSSARY.md:195】、两个模块的头注释【js/adventure-core.js:490、js/modes/adventure.js:27】。
- **收尾必跑**：`npm test`（397+ 测试基线）+ `npm run lint`【AGENTS.md 收尾清单】。
