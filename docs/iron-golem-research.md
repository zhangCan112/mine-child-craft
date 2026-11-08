# 铁傀儡 (Iron Golem) 完整机制调研 —— 「怪物合成」玩法设计输入

> 目的：为「怪物合成」玩法（玩家合成友方怪物，第一个目标是铁傀儡）提供正典机制底座——判断哪些机制值得搬进我们的 Three.js 体素游戏。
> 来源口径：一手来源优先：minecraft.wiki 铁傀儡页 + Villager/Experience 等机制页（2026-11-08 抓取）；Bedrock 行为一手数据直接抓取 Mojang/bedrock-samples 仓库的 `behavior_pack/entities/iron_golem.json` 与 Microsoft Learn 的 Bedrock 组件文档。二手攻略站一律不采信。
> 访问日期：2026-11-08。版本口径：wiki 导航栏现行版 Java 26.3（26.4 upcoming）/ Bedrock 26.60；Bedrock JSON `format_version` 1.26.20。
> 可信度标注：wiki 无明文、仅有社区拆包/共识的断言，一律标 **【可信度较低】** 或 **【可信度中等】** 并写明依据。

## 0. 摘要（给赶时间的决策者）

- 铁傀儡**不是工作台合成**，是**结构搭建召唤**：4 个铁块摆 T 形 + 最后放雕刻南瓜/南瓜灯当头。摆放方向不限（正放/侧放/倒放），四个角必须是空气。
- 玩家搭的铁傀儡永远对玩家被动（`PlayerCreated` 标志），自然生成的铁傀儡是中立怪：被打会报复，声望差会主动敌对。
- 数值骨架：100 HP、移动速度 0.25、100% 击退抗性、击飞目标上天（Bedrock 官方值：水平 0.52 / 垂直 0.39 / 垂直速度上限 0.8）、攻击范围对头顶 ≥2.75（JE）/3（BE）格外的目标失效。
- 掉落：铁锭 3–5（必得）+ 虞美人 0–2（2/3），**均不受抢夺影响**；**死亡不掉经验**。
- 100 HP 掉 1/4 就裂一格（4 档裂纹），铁锭右键治疗 25 HP（正好一格裂痕），无自然回血。
- AI 三件套：主动索敌（monster 家族，苦力怕除外）、单一目标锁定至死、夜间村庄穿行巡逻。
- 「合成→守护」的结构天然适合我们：合成仪式（形状+最后一块）→ `playerCreated` 忠诚度标志 → 治疗交互 → 巡逻索敌，四段全都能平移。

## 1. 获取方式

### 1.1 不是工作台配方，是建筑结构召唤

铁傀儡没有工作台合成配方。获取靠三类途径：

1. **玩家搭建**（含发射器、甚至末影人代放南瓜）：4 个铁块摆成 T 形（横 3 竖 1），在最上格放**雕刻过的南瓜 (carved pumpkin)** 或**南瓜灯 (jack o'lantern)** 作为头部，南瓜必须**最后放置**。方向不限：正着摆、侧着摆、倒着摆都能触发（JE 1.8 14w25a 起）。
   - 四个空位（手臂上下共 4 格）**必须是空气**：雪片、草、小花、水等任何非空气方块都会阻止生成。
   - 生成成功后铁傀儡**永远朝南**；头部若嵌在方块里可能受到窒息伤害。
   （来源：[/w/Iron_Golem §Creation](https://minecraft.wiki/w/Iron_Golem#Creation)）
2. **村庄自然生成**（见 1.3）。
3. **掠夺者前哨站**：世界生成时部分前哨站旁的深色橡木笼子里关着一只铁傀儡，放出来后会主动攻击附近掠夺者（它隔 1 格墙也能攻击到怪）。JE 1.14 18w47a 加入。（来源：[/w/Iron_Golem §Pillager outposts](https://minecraft.wiki/w/Iron_Golem#Pillager_outposts)）

### 1.2 南瓜触发的细节（对「合成仪式感」设计最有参考价值）

- **雕刻南瓜、南瓜灯都能当头**。JE 1.7.2 曾因花改虞美人顺手禁过南瓜灯，1.8.1 pre1 恢复。（来源：[/w/Iron_Golem 历史](https://minecraft.wiki/w/Iron_Golem#Java_Edition)）
- **未雕刻的普通南瓜**：JE 里至今可用——按任意顺序摆好铁块+普通南瓜，然后玩家用剪刀剪一下南瓜，铁傀儡即时生成（wiki 现行描述）。**Bedrock 1.21.30 起已禁止**未雕刻南瓜触发（Preview 1.21.30.21 变更）。（来源：[/w/Iron_Golem §Creation](https://minecraft.wiki/w/Iron_Golem#Creation) + [/w/Iron_Golem §Bedrock 历史](https://minecraft.wiki/w/Iron_Golem#Bedrock_Edition)）
- **发射器 (dispenser) 可以代放南瓜**并触发生成：JE 1.8 14w04a 加入，Legacy Console 同期也有；wiki 现行正文明确「南瓜可由玩家、发射器或末影人放置」。（来源：[/w/Iron_Golem §Creation](https://minecraft.wiki/w/Iron_Golem#Creation) + 历史小节）
- **末影人也能搬南瓜放对位置**触发生成（wiki Trivia 确认）。

### 1.3 村庄自然生成机制（简述）

**Java 版——村民「恐慌/八卦」召唤制**：村民集体满足 5 条件时召唤铁傀儡（来源：[/w/Iron_Golem §Villages Java](https://minecraft.wiki/w/Iron_Golem#Java_Edition) + [/w/Villager §Iron golem summoning](https://minecraft.wiki/w/Villager#Iron_golem_summoning)）：

1. 该村民 20 分钟内睡过觉；
2. 30 秒内没在 16 格（±16 X/Z/Y）内探测到铁傀儡（每 10 秒扫描一次）；
3. 30 秒内没接近过别的成功召唤点（10 格内）；
4. 10 格内参与人数达标：**八卦 (gossiping) 场景 ≥5 人，恐慌 (panicking) 场景 ≥3 人**；
5. 找到合法落点（17×13×17 体积内最多试 10 次，取该柱顶部的空气/液体格且下方为 solid-blocking）。
- 生成节奏约 **每 30 秒一次**（1.20.2 23w31a 起恢复 30s；1.19 曾因 bug 变 35s）。世界生成时村庄自带 1 只（JE 19w08a 起）。gamerule `spawn_mobs=false` 时铁傀儡仍会照常召唤（wiki 原文如此）。

**Bedrock 版——村庄「人口/工作率」周期制**（来源：[/w/Iron_Golem §Villages Bedrock](https://minecraft.wiki/w/Iron_Golem#Bedrock_Edition)）：

- 村庄生成时自带 1 只；此后村庄需 **≥20 张床 + ≥10 名村民**才继续刷。
- 75% 村民在过去 24000 tick（20 分钟）内到岗工作过（呆子 nitwit 不计），100% 村民已认床，村庄中心在玩家模拟距离内。
- 以村庄中心（床枕头或钟，不保证）为基准 17×13×17 体积内尝试，每 tick 1/700 概率 ≈ **每 35 秒**一次。
- **每多 10 名村民多刷 1 只**；原有的铁傀儡死后，条件不重新满足就不再刷——小村庄死了守卫不会再生。

## 2. 基础属性数值表

| 属性 | 数值 | 备注 / 来源 |
| --- | --- | --- |
| 生命值 | **100 HP（❤×50）** | 两版一致；裂纹 4 档按 75%/50%/25% 阈值（见 §4） |
| 攻击力（Java，按难度随机） | 简单 4.75–11.75 HP；普通 7.5–21.5 HP；困难 11.25–32.25 HP | [/w/Iron_Golem Infobox/§Attacking](https://minecraft.wiki/w/Iron_Golem#Attacking)。【可信度中等】社区拆包反编译给出基础式 `7 + rand(0..14)`（普通难度），与 wiki 普通档范围吻合，但未经一手验证 |
| 攻击力（Bedrock） | **7–21 随机区间**，不随难度分档 | 一手：[iron_golem.json `minecraft:attack`](https://github.com/Mojang/bedrock-samples/blob/main/behavior_pack/entities/iron_golem.json)。与 wiki 表普通档 7.5–21.5 有 ±0.5 出入，两处口径并存 |
| 移动速度 | **0.25** | 两版一致（wiki Infobox + BE JSON `minecraft:movement`）。JE 未被激怒时移动更慢；BE 任何时候都快（wiki §Behavior） |
| 击退抗性 | **100%** | 普通攻击推不动；风弹 (wind charge) 与 Wind Burst 附魔仍能推动（wiki §Being attacked）。JE 15w39a 加入 |
| 击飞（把目标抛上天） | **BE 官方：水平 0.52 / 垂直 0.39 / 垂直速度上限 0.8**（blocks/tick 量级） | 一手：BE JSON `minecraft:apply_knockback_rules` + [Microsoft Learn 组件文档](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_apply_knockback_rules?view=minecraft-bedrock-stable)。【可信度较低】JE 无 wiki 数值，社区反编译为垂直 ≈0.4——与 BE 官方 0.39 高度吻合，可互为旁证 |
| 攻击判定高度上限 | 目标在铁傀儡上方 **≥2.75 格（JE）/ ≥3 格（BE）** 就打不到 | wiki §Attacking原文；站 3 格柱子可安全白嫖。JE 1.20.2 23w33a 收窄攻击范围，**不能再隔 1 格厚墙打到人** |
| 碰撞箱 | 高 2.7 格（JE）/ 2.9 格（BE），宽 1.4 格 | wiki Infobox + BE JSON `collision_box`。JE 1.9 15w39a 从 2.9 缩到 2.7 |
| 索敌范围 (follow_range) | BE **64 格** | 一手：BE JSON `minecraft:follow_range`。JE 无 wiki 数值【未查证】 |
| 掉落物 | **铁锭 3–5 · 100%（均值 4）；虞美人 0–2 · 2/3（均值 1）**；均**不受抢夺影响** | 两版一致 [/w/Iron_Golem §Drops](https://minecraft.wiki/w/Iron_Golem#On_death)。虞美人即 1.7.2 前的玫瑰（2010 年《天空之城》梗，见 wiki Trivia） |
| 经验值 | **0（不掉经验球）** | [/w/Experience](https://minecraft.wiki/w/Experience) 明确把 Iron Golem 列入「死亡不掉经验的实体」，且「golems 一律不给经验」；BE 一手 JSON 亦无任何 `experience_reward` 组件。⚠️ Iron Golem 页掉落表里有一行含义不明的「Killed \| 1」表格残迹，与 Experience 页矛盾，不采信 |
| 沉降/溺水 | 免疫溺水 + 免疫摔落伤害 | JE 实体标签 `can_breathe_under_water`、`fall_damage_immune`（wiki ID 表）；BE JSON `damage_sensor` 摔落 deals_damage: no。入水沉底但能横走、能上 1 格台阶 |
| 可骑乘 | 船：否；矿车：BE 可以（推矿车进去）、JE 不行 | wiki Infobox + Trivia |
|拴绳 | 可以拴（`leashable`）；拴住的铁傀儡看到怪只盯着看、不会挣绳追击 | wiki §Behavior + BE JSON。BE JSON 还带 `balloonable`（质量 2.0，教育版气球玩法） |

## 3. AI 行事逻辑

### 3.1 索敌与目标选择（Bedrock 一手优先级表）

BE 行为文件给出了完整的 AI 优先级（priority 数字越小越优先），是移植的最佳参考骨架（来源：[iron_golem.json](https://github.com/Mojang/bedrock-samples/blob/main/behavior_pack/entities/iron_golem.json)）：

| 优先级 | 行为 | 触发条件 |
| --- | --- | --- |
| 1 | `melee_box_attack` | 近战攻击当前目标（持续锁定） |
| 1 | `target_when_pushed` | 被 monster 家族（非苦力怕）推挤时，**5% 概率**锁定推挤者 |
| 2 | `hurt_by_target` | 被打就报复（苦力怕除外）；**玩家搭的**版本额外排除 player（见 §5） |
| 2 | `move_towards_target` | 朝 32 格内的目标移动，速度 ×0.9 |
| 3 | `nearest_attackable_target` | 主动索敌：`monster` 家族且非苦力怕；hoglin/zoglin 不在和平难度索敌；`must_see` + `must_reach` |
| 3 | `move_through_village` | **仅夜间**穿行村庄，速度 ×0.6 |
| 4 | `move_towards_dwelling_restriction` | 回村庄束缚区（village_created 组才有 dweller） |
| 5 | `offer_flower` | 白天献花 |
| 6 | `random_stroll` | 游荡，速度 ×0.6，水平 16 格 |
| 7/8 | `look_at_player` / `random_look_around` | 6 格内看玩家 1–2 秒 / 随机张望 |

wiki 补充的索敌规则（来源：[/w/Iron_Golem §Attacking/§Fighting](https://minecraft.wiki/w/Iron_Golem#Fighting_with_other_mobs)）：

- **单一目标锁定至死**：打一群怪时锁定一只打到死才换目标，哪怕自己被别怪围殴。目标丢失视线且「不够愤怒」时改打下一个打它的怪；【wiki 标 verify】有时会改打群里最近的一只。
- **天然生成的铁傀儡能隔墙/隔地感知袭击者位置**并主动扑过去；玩家搭建的或命令召唤的**没有**这个隔墙雷达（对玩法是条重要差异，见 §5）。
- 苦力怕是著名例外：**铁傀儡不主动打苦力怕**（1.2 时代误打过，1.8.1 AI 重构后修正），被苦力怕炸也不报复；山羊、硫磺方块（2026 新怪）同理。
- 铁傀儡之间**永不互殴**（攻击不会误伤同类）。
- 对高飞怪（恶魂、幻翼）无能为力——够不着。

### 3.2 攻击流程

wiki 描述的动作序列（来源：[/w/Iron_Golem §Attacking](https://minecraft.wiki/w/Iron_Golem#Attacking)）：

1. 锁定目标后**快速冲向目标**（BE `move_towards_target` 速度 ×0.9）；
2. **双臂上挥攻击**，命中后把目标**抛上天**（击飞数值见 §2 表）；
3. 伤害按难度随机（见 §2 表）；多个铁傀儡同时命中同一目标会叠加击飞高度【wiki 标 verify，BE only】；
4. 站在 3 格柱顶的玩家安全——高度上限 2.75/3 格（见 §2 表）；
5. 铁傀儡击杀的怪照样掉物品，但**玩家拿不到经验**；BE 里铁傀儡杀袭击村庄的 raid 怪时 raid 战利品照掉。
- 【可信度较低】JE 抬手动画约 10 tick（社区反编译 `attackAnimationTick = 10` + 广播事件），wiki 无数值记载。

### 3.3 会攻击谁、不会攻击谁

wiki 给了完整的敌对交互表（来源：[/w/Iron_Golem §Fighting with other mobs](https://minecraft.wiki/w/Iron_Golem#Fighting_with_other_mobs)），对玩法设计的关键几行：

| 类别 | 铁傀儡主动打？ | 对方反击？ |
| --- | --- | --- |
| 僵尸系/溺尸/尸壳/僵尸村民、骷髅系、流髑、旋风怪 (bogged/breeze)、掠夺者系、卫道士、唤魔者、劫掠兽、凋灵、烈焰使者、猪灵系（被打后反打）、史莱姆/岩浆怪、蜘蛛/洞穴蜘蛛（光照 <12 时主动打铁傀儡）、恶鬼系 | **主动打** | 大多主动反打 |
| 苦力怕、山羊、硫磺方块 | **不打**（山羊反而会随机撞铁傀儡） | 互不理睬 |
| 末影龙、恶魂 | JE 打 / **BE 不打** | 不反击 |
| 村民、河豚、鹦鹉螺 | 被打才还手 | 不打铁傀儡 |
| 驯服的狼 | 被打才还手 | 主人被打/主动攻击时反打 |
| 雪傀儡、羊驼 | 被打才还手 | 同左 |
| 其余所有生物 | 被打才还手 | 不打 |

被怪物主动挑衅的例外规则：**别的怪打村民不会激怒铁傀儡**（它不是「村民保镖」，是「村子清道夫」）；女巫在 raid 里误丢正面药水它照打不误；烟花伤害会激怒它（JE 1.16 20w10a 起——村民庆祝的烟花误伤也算）。

### 3.4 对玩家阵营：谁搭的、愤怒值、声望

- **玩家搭建的铁傀儡永远不攻击玩家**——无论怎么被打、无论是否目睹玩家打村民/打别的傀儡。落盘为 `PlayerCreated` NBT 标志（来源：[/w/Iron_Golem §Entity data](https://minecraft.wiki/w/Iron_Golem#Entity_data)，BE 对应 `player_created` 组件组排除 player）。唯一例外：玩家的**驯服狼**咬它，它会还手打狼。
- **「愤怒值」机制的澄清**：Java 并不存在 1.79 版本（用户提法疑为口误；截至 2026-11 Java 最新正式版为 26.3）。现行机制是两套并存：
  1. **愤怒 NBT**：铁傀儡实体数据继承 angerable 模板——`anger_end_time`（被激怒时随机设 400–800 tick，逐 tick 衰减）与 `angry_at`（记仇目标的 UUID）（来源：[/w/Iron_Golem §Entity data](https://minecraft.wiki/w/Iron_Golem#Entity_data) + [/w/Template:Nbt_inherit/angerable/template](https://minecraft.wiki/w/Template:Nbt_inherit/angerable/template)）。这解释了 3.1 里「丢失视线且不够愤怒时换目标」的行为。
  2. **村庄声望 (popularity/reputation) 敌对**：自然生成的铁傀儡在玩家村庄声望 **≤ −15**，或与附近任一村民好感 **≤ −100** 时主动敌对，直到双值回升过线（来源：[/w/Iron_Golem §Provocation by players](https://minecraft.wiki/w/Iron_Golem#Provocation_by_players)；Villager 页补充：以铁傀儡为中心 ±10 水平/±8 垂直的盒内检测村民好感，[/w/Villager §Gossiping](https://minecraft.wiki/w/Villager#Gossiping)）。⚠️ wiki 自身在该段挂着「事实准确性可能过时」的模板，移植时按设计需要自由取值即可。
- 被打必报复：村庄铁傀儡被玩家打（哪怕是雪球、末影珍珠这类零伤害投掷物）就还手；村子里多只自然铁傀儡时，一只被当众打、其余可能一起敌对【BE only，wiki 标 verify】。
- BE 特有：玩家在铁傀儡附近打村民 → 铁傀儡**立即**敌对；玩家杀铁傀儡 → 村庄 popularity −10（BE 交易价不受影响）。
- 不因玩家打流浪商人而愤怒（wiki 有脚注佐证）。

### 3.5 巡逻、游荡、开门与各种物理行为

- **巡逻**：沿村庄建筑**巡逻式游荡**，不离村（无论怎么生成的都不离村，偶尔站在村界张望）；不在村里时四处游荡清怪，通常会自己走到最近的村庄然后定居。BE 行为层是 `move_through_village`（**仅夜间**、速度 ×0.6）+ `move_towards_dwelling_restriction` + 16 格游荡（见 3.1 表）。
- **开门：不能**。BE 一手 JSON 里没有 `behavior.open_door` 行为组件（村民有），只有寻路层的 `using_door_annotation` 注解——即只走开着的门；社区观察一致（铁傀儡会被门卡住）。【JE 部分可信度中等：wiki 未明文，社区共识为不能开门】
- **不追出很远**：拴在栅栏上时会攻击拴绳范围内的怪，但怪跑出拴绳距离**不会挣绳追**；看到怪时被拴的铁傀儡只盯着看（wiki §Behavior）。
- **回避危险方块**：主动绕开水、熔岩、火、仙人掌（wiki §Behavior + BE JSON `navigation.walk` 的 `avoid_water: true, avoid_damage_blocks: true`）。
- **不会淹死**、免疫摔伤（§2 表）；在水里沉底走路如履平地。
- **跨障**：不跳就能上 1 格台阶（JE 19w08a 起），能跨过 1 格宽的洞不掉下去；能攀爬梯子/藤蔓（被推上去或路径经过时）；BE JSON 限定寻路最大落差 `max_fall_blocks: 1`。
- **偏好路径（BE）**：走低代价方块——土径 0、石系/玻璃系 1、工作方块 50、其余 1.5、跳跃 5；会走 1 格宽小径但更爱宽路（wiki §Preferred path + BE JSON `preferred_path`，数值一致）。
- 不能捡武器装备；被命名、 Commands 给装不渲染。

### 3.6 献花与裂痕（表现层，强烈建议搬运）

- **献花**：手里凭空「掏出」虞美人（不是捡的），递给村民和铜傀儡（1.21.9 25w33a 起，BE 1.21.111 起）；幼年村民接过花是 **BE only**（wiki 标注疑似 bug 行为）。献花途中被玩家打 → 收回花并转入攻击；献花途中发现敌人 → 立刻冲过去打。（来源：[/w/Iron_Golem §Behavior](https://minecraft.wiki/w/Iron_Golem#Behavior)）
- **裂纹四档**（血量可视化，对玩家极友好）：≥75% 无裂纹；≥50% 轻裂；≥25% 中裂；<25% 重裂。1.15 19w41a 加入。（来源：[/w/Iron_Golem §Cracking](https://minecraft.wiki/w/Iron_Golem#Cracking)）

## 4. 治疗与维持

- **铁锭治疗**：对受损铁傀儡使用 1 个铁锭 → **回 25 HP（❤×12.5）**，恰好恢复一档裂纹，铁锭消耗。JE 1.15 19w41a 加入，BE 1.18.10 跟进。（来源：[/w/Iron_Golem §Healing](https://minecraft.wiki/w/Iron_Golem#Healing) + BE JSON `minecraft:interact` 的 `health_amount: 25`（一手））
- **无自然回血**：wiki 未记载任何自然回血机制，BE 一手 JSON 也没有任何回血组件；多数生物默认不自然回血。【可信度中等：属「未记载即无」推断】
- BE 已知 bug：同 tick 内死亡+治疗会得到一只除 `/kill` 外无敌的铁傀儡（卡死在死亡动画，重载区块恢复）——记入案，不做机制。（来源：[/w/Iron_Golem §Healing 脚注](https://minecraft.wiki/w/Iron_Golem#Healing)）
- 隐身效果下裂纹不显示（JE 1.15.2 pre1）。

## 5. 「玩家搭建」vs「自然生成」的差异（玩法设计重点）

| 维度 | 玩家搭建（含发射器） | 自然生成（村庄召唤/村庄自带/前哨站笼） |
| --- | --- | --- |
| 对玩家 | **任何情况下永不主动攻击玩家**（`PlayerCreated` NBT / BE `player_created` 组件组），被打也不报复玩家；驯服狼咬它例外 | 中立：被打必报复（雪球级零伤害也报复）；玩家声望 ≤−15 或任一村民好感 ≤−100 → **主动敌对**（JE，段落带过时警告）；BE 玩家打村民立即敌对 |
| 雷达 | **不能**隔墙/隔地感知袭击者 | **能**隔墙、隔地感知 raid 袭击者方位并主动接敌 |
| 村庄绑定 | 无村庄归属（BE `player_created` 组不带 `dweller`/`defend_village_target`） | BE `village_created` 组带 `defend_village_target`（优先级 1）+ `dweller`（守卫角色，可迁移） |
| 别的怪打村民 | 两者都**不**因此激怒（除非自己是受害者） | 同左；但 BE 玩家打村民例外（立即敌对） |
| 掉落与经验 | 相同：铁锭 3–5 + 虞美人 0–2，0 XP | 相同 |
| 生成条件 | 4 铁块 T 形 + 南瓜最后放；角落必须空气 | Java 5 条件恐慌/八卦召唤；Bedrock 20 床 10 村民 75% 工作率 1/700 每 tick；前哨站笼子 |

（来源汇总：[/w/Iron_Golem §Creation/§Attacking/§Provocation](https://minecraft.wiki/w/Iron_Golem)、[/w/Iron_Golem §Entity data](https://minecraft.wiki/w/Iron_Golem#Entity_data)、BE JSON component_groups、[/w/Villager §Gossiping](https://minecraft.wiki/w/Villager#Gossiping)）

## 6. Java / Bedrock 关键行为差异（挑对玩法有影响的）

1. **碰撞箱**：JE 2.7 格高，BE 2.9 格高——影响门洞/通道设计（2 格高缝隙 JE 能过 BE 卡头）。
2. **攻击力口径**：JE 按难度分档（7.5–21.5 普通）；BE JSON 固定 7–21 不分档。
3. **普通南瓜触发**：JE 至今可用（剪一下），**BE 1.21.30 起已禁止**——只认雕刻南瓜/南瓜灯。
4. **攻击范围**：BE 打不到 ≥3 格高目标，JE ≥2.75 格；JE 23w33a 收窄后**不能隔 1 格墙**打，BE 用 `melee_box_attack` 盒判定。
5. **移动节奏**：JE 未激怒时移动慢、激怒后冲刺；BE 全程一个速度（偏快）。
6. **恶魂/末影龙**：JE 会打，BE 不打。
7. **矿车**：BE 可被推入矿车运走，JE 不行；船两版都不坐。
8. **偏好路径**：BE 有完整方块代价表（土径 0 … 工作方块 50）；JE 无此系统。
9. **声望敌对细节**：JE 走 popularity/reputation 双阈值；BE 是「打村民立即敌对」+ 杀傀儡 popularity −10。
10. **铁傀儡击杀 raid 怪**：BE 会掉 raid 战利品，JE 掉普通掉落（wiki §Attacking）。

## 7. 对本项目「怪物合成」玩法的搬运建议（非正典，仅供拍板）

- **合成仪式**：形状摆放 + 「最后一块是头」的触发判定（+ 角落空气校验）是低成本高仪式感的设计，直接照搬 T 形也行、换形状也行。
- **忠诚标志**：`PlayerCreated` 单布尔就能撑起「合成出的怪永不背刺主人」的核心体验；想要「狼咬它才反击」这种边角戏可后补。
- **血量可视化**：4 档裂纹（75/50/25 阈值）比血条更 Minecraft；铁锭治疗 25 HP = 一档裂纹，数值闭环漂亮，建议原样搬。
- **击飞打击感**：垂直 0.39–0.4 + 水平 0.52 的抛上天是铁傀儡的招牌手感；我们子夜的物理尺度接近时可先用官方 BE 数值。
- **索敌骨架**：monster 家族黑名单（排除苦力怕）+ 单一目标锁定至死 + 夜间村庄穿行，直接映射成我们 mob AI 的目标选择三件套。
- **可暂缓**：声望/愤怒值系统依赖村庄人口机制，我们无村庄模拟，按需简化成「合成怪永不敌对」即可。

## 8. 引用来源列表

| # | 来源 | 用途 |
| --- | --- | --- |
| 1 | [minecraft.wiki /w/Iron_Golem](https://minecraft.wiki/w/Iron_Golem)（§Spawning/Creation/Drops/Behavior/Attacking/Provocation/Being attacked/Cracking/Healing/Preferred path/Data values/History） | 本报告主体：搭建、属性、AI、治疗、搭建 vs 生成、历史 |
| 2 | [minecraft.wiki /w/Villager](https://minecraft.wiki/w/Villager)（§Iron golem summoning/§Gossiping/§Panicking） | Java 恐慌/八卦召唤条件、村民好感 −100 敌对盒 |
| 3 | [minecraft.wiki /w/Experience](https://minecraft.wiki/w/Experience) | 铁傀儡 0 XP 的明确清单 |
| 4 | [Mojang/bedrock-samples · behavior_pack/entities/iron_golem.json](https://github.com/Mojang/bedrock-samples/blob/main/behavior_pack/entities/iron_golem.json)（raw 抓取，format_version 1.26.20） | Bedrock 一手：attack 7–21、health 100、movement 0.25、knockback_resistance 1.0、follow_range 64、collision_box 2.9×1.4、apply_knockback_rules (0.52/0.39/0.8)、interact 治疗 25、AI 优先级表、player_created/village_created 组件组、navigation（avoid_water/avoid_damage_blocks/using_door_annotation、max_fall_blocks 1）、preferred_path、无 experience_reward |
| 5 | [Microsoft Learn — minecraft:apply_knockback_rules](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_apply_knockback_rules?view=minecraft-bedrock-stable) | 击飞组件语义：水平/垂直威力与垂直速度上限 |
| 6 | [minecraft.wiki /w/Template:Nbt_inherit/angerable/template](https://minecraft.wiki/w/Template:Nbt_inherit/angerable/template) | Java 愤怒 NBT：anger_end_time 400–800 tick、angry_at UUID |
| 7 | [MicrosoftDocs/minecraft-creator · Update1.26.20.md](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/creator/Documents/Update1.26.20.md) | apply_knockback_rules 组件上线说明（BE 26.20） |

**可信度较低/中等条目汇总**（正文已就地标注）：

- JE 攻击基础式 `7 + rand(0..14)` 与击飞垂直 ≈0.4：社区反编译数据，无一手来源，与 wiki 难度表/BE 官方值互洽【可信度较低/中等】。
- JE 抬手动画 10 tick：社区反编译【可信度较低】。
- JE 索敌 follow_range：wiki 无记载，未查证【未查证】。
- 「铁傀儡无自然回血」「JE 不能开门」：一手来源静默 + BE JSON 无对应组件/行为 + 社区共识【可信度中等】。
- Iron Golem 页掉落表「Killed \| 1」行：含义不明，与 Experience 页 0 XP 冲突，不采信。
- wiki 「popularity ≤ −15 敌对」段落自带事实性过时警告模板，数值仅供设计参考。
