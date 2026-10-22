# 怪物谱系/分类体系设计 · 调研报告

> 调研问题：给 37 种怪物建立"怪物谱系"（家族/血统/类别体系），让怪物技能可以按谱系系统化设计（家族共享技能模板 + 个体特化），新增怪物时有章可循。
> 所有事实性论断附来源 URL 与来源性质；抓取失败或只有二手证据的地方明确标注。
> 本仓库现状以源码为准（js/config.js 的 MOB_TYPES 134-189 行、js/mobs.js、modes/arena.js、docs/shared-monsters-design.md，读于本次调研）。

## 0. 结论先行（TL;DR）

1. **Minecraft 原版的"族"是机制判据，不是外观分类。** 不死族的判据是"瞬间伤害回血 / 治疗受伤 / 中毒与再生无效 / 亡灵杀手加成"，节肢族的判据是"节肢杀手加成 + 缓慢 IV"，而不是"长得像骷髅"。族归属直接改变战斗规则（来源：[Undead](https://minecraft.wiki/w/Undead)、[Arthropod](https://minecraft.wiki/w/Arthropod)，已抓取）。
2. **实现上，原版用"标签组合"而非"继承树"。** JE 的 `#undead` 标签内容是 `#skeletons + #zombies + phantom + wither`（标签嵌套标签）；且 `#undead` 本身不产生机制——机制活在 `#sensitive_to_smite`、`#inverted_healing_and_harm` 等"属性标签"里，这些属性标签引用 `#undead`。一个怪可以同时属于多个族（僵尸猪灵 = 猪灵系 + 不死族）。BE 干脆用 `type_family` 组件让一个实体佩戴任意多家族标签（来源：[Entity type tag](https://minecraft.wiki/w/Entity_type_tag_\(Java_Edition\))、[Family](https://minecraft.wiki/w/Family)，已抓取）。
3. **变体派生有三层手法**：①外观变体（同实体换材质/体型：史莱姆尺寸、潜影贝颜色）；②实体变体（同骨架新实体：尸壳=僵尸+沙漠特化+不灼烧+饥饿，流浪者=骷髅+雪原+缓慢箭）；③运行时转化（僵尸水下变溺尸、猪灵出下界变僵尸猪灵）。"同骨架 + 环境特化 + 一招专属 + 数值微调"是可复用的变体公式。
4. **族是设计扩展单位，不只是分类。** 灾厄村民(Illager)一族是为 Minecraft Dungeons"需要一个可复用的邪恶阵营"而先设计出来的，然后才反哺原版——有了族，"再添一种灾厄村民"就是填空题（来源：[Illager](https://minecraft.wiki/w/Illager) Trivia 转引 *Minecraft Game Design* 与 Jeb 访谈，已抓取页面）。
5. **同行经验殊途同归**：Terraria = 132 个 AI 编号模板 + 数值行 + 个体附加逻辑；D&D 5e = 14 个"自身无规则"的类型供法术/物品挂钩（3.5e 的"类型自带特性"被刻意放弃）；Pokémon = 18 属性的正交克制乘法 + 进化族管外观叙事。共同点：**行为/机制维度与外观/生态维度分开建模，用组合而非继承**。
6. 对本项目最直接的可借鉴结构：**"战斗原型(行为模板) × 血统族(弱点/抗性/外观) × 数值行"三张正交表，用标签数组粘合**——备选方案比较见 §5，§6 给出对 MOB_TYPES 的初步映射思路（不拍板，留给项目方）。

---

## 1. Minecraft 原版的怪物分族与机制判据

### 1.1 官方的"mob type"体系：六大族 + 一个行为分类

minecraft.wiki 的 [Mob type](https://minecraft.wiki/w/Mob_type) 页（已抓取）给出官方承认的玩法分类：

> "A **mob type** is a gameplay classification the game uses to group mobs. This classification is applied in several gameplay aspects, including but not limited to **achievements, mob spawning population control caps, and conditions for taking damage**."

六大族：**Animal（动物）/ Aquatic（水生）/ Arthropod（节肢）/ Illager（灾厄村民）/ Monster（怪物）/ Undead（不死）**。

同时 [Mob](https://minecraft.wiki/w/Mob) 页（已抓取）还有一套**按行为**的分类：passive（被动）/ neutral（中立）/ hostile（敌对）/ boss。两套维度**正交**：溺尸是中立+不死，骷髅马是被动但属于 monster（参与敌对怪机制，如和平难度消失），铁傀儡是中立+非 monster。"Monster"本身是机制族：和平难度消失、阻止玩家睡觉、被潮涌核心攻击、被铁傀儡/雪傀儡主动攻击（来源：[Mob type](https://minecraft.wiki/w/Mob_type) § Monsters）。

**对项目的启示**：本项目现行 4 旗标（ranged/boom/fly/boss）就是"行为分类"的雏形；要补的是"族"这一层——族不是"第三种旗标"，而是让多个机制判据可以**按族批量生效**的分组维度。

### 1.2 不死族：机制判据的范本

[Undead](https://minecraft.wiki/w/Undead) 页（已抓取）列出的族判据：

- 被瞬间伤害**治疗**、被瞬间健康**伤害**（药水反转）；
- 不受再生与中毒影响；
- 受亡灵杀手(Smite)附魔额外伤害；
- 不受溺水伤害（尸壳/僵尸例外：分别转化为僵尸/溺尸）；
- 不被凋灵攻击、也无法伤害凋灵；
- 被犰狳视为威胁；
- JE 属 `#undead` entity tag，BE 属 `undead` family。

**阳光灼烧是不死族的"子集属性"而非全族属性**——这教训很关键：`#burn_in_daylight` 标签（[Entity type tag](https://minecraft.wiki/w/Entity_type_tag_\(Java_Edition\))，已抓取）只有 11 个成员：bogged、drowned、frostbite、phantom、skeleton、stray、**wither_skeleton**（因火免疫而实际无效）、zombie、zombie_horse、zombie_nautilus、zombie_villager。**尸壳(husk)不在名单里**——沙漠特化让它免疫日烧（但并不火免疫）。下界不死族（凋灵骷髅、僵尸猪灵）则完全火免疫。族内"同族不同弱点"是官方明确做的分层。

**族成员边界会随版本调整**（同一个 wiki History 表，已抓取）：监守者在 22w12a 之前曾被认为是不死族、之后移除；疣猪兽尸变体(zoglin)到 20w15a 才被归入不死族；劫掠兽在 BE 1.19.40 起不再是 illager。**族的划分是设计决策，不是物理事实**——挪动一个怪的族籍是官方做过的正常操作。

### 1.3 节肢族：小而严的判据

[Arthropod](https://minecraft.wiki/w/Arthropod) 页（已抓取）：全部成员只有 5 个——蜜蜂、洞穴蜘蛛、末影螨、蠹虫、蜘蛛。共享判据两条：受节肢杀手附魔额外伤害并附缓慢 IV；JE `#arthropod` 标签 / BE `arthropod` family。本项目 37 怪中有 4 只（蜘蛛、洞穴蜘蛛、蠹虫、末影螨）。

### 1.4 灾厄村民：核心族 + 盟友圈的两层结构

[Illager](https://minecraft.wiki/w/Illager) 页（已抓取）展示了一个比单层族更精细的结构：

- **核心 illager（4）**：卫道士、唤魔者、掠夺者、幻术师（JE 未使用）。共享：`#illager` 标签、可戴灾厄旗帜当队长、**免疫唤魔者尖牙**、**免疫劫掠兽吼**、被"Johnny"卫道士无视、**逃离嘎枝**(24w40a 起)、不攻击幼年村民、被玩家用箭误伤（同族射的）不还手。
- **raider 圈（6 = 上述 + 劫掠兽 + 女巫）**：共享 `#raiders` 标签——参与袭击/巡逻、敲钟发光、跟随队长。**女巫和劫掠兽不是灾厄村民但算 raiders**。
- **盟友但两圈都不属于**：恼鬼（由唤魔者召唤，既非 illager 也非 raider）。

**设计史金料**（同页 Trivia，转引 *Minecraft Game Design*（archive.org）与 minecraft.net 访谈）：灾厄村民最初是为 *Minecraft Dungeons* 构思的——"需要一个泛用的邪恶士兵阵营，可以用于任何衍生媒体"；当时 Jeb 定的规则是 Dungeons 只能用原版已有怪物，于是唤魔者/卫道士**先被加进原版**（2016-11），比 Dungeons 发售（2020-05）早三年半。**先建族、再按族填个体，族本身服务于内容扩展**——这正是本项目想要的工作方式的一手实证。

### 1.5 其他机制族（原版有实无名的族）

官方 tag 页虽没有"猪灵族""史莱姆族"页面，但机制标签承认这些族：

- **史莱姆系**：`#frog_food` = slime + magma_cube（青蛙吃这两位——侧面承认"分裂怪家族"）；两者共享：尺寸字段、死亡分裂、`#non_controlling_rider`。岩浆怪另加火免疫+接触灼烧（[Slime](https://minecraft.wiki/w/Slime)、[Magma Cube](https://minecraft.wiki/w/Magma_Cube)，页面未逐一抓取，URL 为对应事实的规范页）。
- **守卫者系**：guardian + elder_guardian 都在 `#aquatic`、`#axolotl_always_hostiles`；共享激光+尖刺反击，远古守卫者加挖掘疲劳诅咒与 bossbar（[Guardian](https://minecraft.wiki/w/Guardian)）。注意：**溺尸明确不在 aquatic 族**（[Mob type](https://minecraft.wiki/w/Mob_type) 脚注引 MC-128249）——外观像水怪 ≠ 族籍是水生。
- **猪灵系**：BE `piglin` family = piglin + piglin_brute，另有 `piglin_hunter`、`baby_piglin` 等行为子标签（[Family](https://minecraft.wiki/w/Family)）；僵尸猪灵在 JE `#zombies` 里（不死族），**一身两族**。
- **下界火免疫族**（跨外观族）：blaze、ghast、magma_cube、wither_skeleton、zombified_piglin 共享火免疫；`#freeze_hurts_extra_types`（细雪 5 倍伤）= blaze + magma_cube + strider——**"怕冷"这个弱点横跨了火系外观族**。
- **末影系**（社区叫法，无官方标签）：末影人/末影螨/末影龙/潜影贝共享"末地血统"的叙事与瞬移/紫粒子语汇，但机制上各立门户——**原版不为了叙事整齐而强行建族**。

### 1.6 本项目 37 怪 · 逐怪归族表

族籍按 JE entity tag / wiki 分族页为准（§1.2-1.5 来源）；"原型"按 §4.4 的战斗原型词汇归纳；"原版核心行为"的来源为各怪 wiki 专页（URL 列于表后说明；其中带 ★ 的行为在本次抓取的族页/标签页中有直接出现）。

| # | 键名 | 中文名 | 官方/机制族籍 | 战斗原型 | 原版核心行为（技能） |
| --- | --- | --- | --- | --- | --- |
| 1 | zombie | 僵尸 | 不死→zombies | 冲锋近战(rusher) | 近战；受击概率召唤增援★；日烧★；可捡装备 |
| 2 | skeleton | 骷髅 | 不死→skeletons | 远程(ranged) | 弓箭；日烧★；受击散射逃跑 |
| 3 | creeper | 苦力怕 | **无族独行侠** | 自爆(bomber) | 潜近→引信 1.5s 自爆；雷击变充能态(变体) |
| 4 | golem | 铁傀儡 | 无族（中立/构造体） | 坦克(tank) | 高伤近战+大击退（挑飞）；攻击一切 monster★ |
| 5 | dragon | 末影龙 | 无族（boss/末影叙事） | 飞行 boss | 冲撞+龙息火球(紫雾残留区)；末影水晶回血 |
| 6 | spider | 蜘蛛 | **节肢** | 伏击(ambusher) | 爬墙；昼中立夜敌对；中立时不挡路 |
| 7 | cave_spider | 洞穴蜘蛛 | **节肢** | 伏击+毒 | 毒攻击；小碰撞箱钻 1×1 |
| 8 | silverfish | 蠹虫 | **节肢** | 蜂群(swarm) | 藏身石块；受击召唤援军成群 |
| 9 | endermite | 末影螨 | **节肢** | 蜂群 | 微型近战；被末影人敌视（叙事钩子） |
| 10 | slime | 史莱姆 | 怪物；史莱姆系 | 分裂(splitter) | 跳跃移动；死亡分裂 2-4 只（尺寸字段驱动）★(#frog_food) |
| 11 | enderman | 末影人 | 无族（末影叙事） | 中立/瞬移法师 | 瞬移；凝视激怒；水伤；搬方块 |
| 12 | witch | 女巫 | **raider 圈**（非 illager）★ | 支援/施毒 | 喷溅药水(伤害/毒/缓慢)★；自饮药水回血 |
| 13 | husk | 尸壳 | 不死→zombies | 近战+Debuff | 饥饿效果；**不日烧**★(沙漠特化)；不溺水(转僵尸)★ |
| 14 | drowned | 溺尸 | 不死→zombies（**非** aquatic★） | 近战/远程 | 水生成；概率持三叉戟远程；僵尸水下转化而来★ |
| 15 | stray | 流浪者 | 不死→skeletons | 远程+Debuff | 缓慢箭；雪原特化；日烧★ |
| 16 | bogged | 沼骸 | 不死→skeletons | 远程+毒 | 毒箭；蘑菇外观变体；日烧★ |
| 17 | phantom | 幻翼 | **不死**（非骨架非僵尸） | 飞行俯冲 | 失眠≥3夜生成；环飞后俯冲；日烧★ |
| 18 | vex | 恼鬼 | 无族（灾厄盟友：唤魔者召唤★） | 飞行游击 | **穿墙**；小剑突刺；有寿命 |
| 19 | creaking | 嘎枝 | 无族（苍白之园） | 禁锢( freezer ) | 被注视时冻结+无敌；本体是嘎枝之心(打心才死)；瞬移 |
| 20 | zombified_piglin | 僵尸猪灵 | **不死→zombies + 猪灵系**（一身两族） | 中立群体 | 单只受击→全群激怒；金剑；火免疫 |
| 21 | piglin | 猪灵 | 猪灵系（BE family★） | 中立远程/近战 | 弩或剑；以物易物；惧怕僵尸猪灵/僵尸疣猪兽；敬金装 |
| 22 | piglin_brute | 猪灵蛮兵 | 猪灵系（BE family★） | 重装近战 | 高伤斧头；不怯战、不逃金装规则简化 |
| 23 | hoglin | 疣猪兽 | 无族（敌对动物） | 野兽冲锋 | 大击退冲撞；逃离下界传送门；被猪灵猎杀（BE hoglin_huntry★） |
| 24 | zoglin | 僵尸疣猪兽 | **不死→zombies**★(20w15a 起) | 野兽冲锋 | 无差别攻击一切非亡灵★；免疫凋零 |
| 25 | wither_skeleton | 凋灵骷髅 | 不死→skeletons | 近战+Debuff | 石剑+凋零效果；火免疫（日烧无效★）；2.4 格高个 |
| 26 | blaze | 烈焰人 | 无族（下界火免疫族） | 飞行炮台 | 三连小火球；火免疫★；细雪 5 倍伤★ |
| 27 | ghast | 恶魂 | 无族（下界火免疫族） | 飞行重炮 | 大火球可被反弹（`#redirectable_projectile`★）；哭泣声暴露位置 |
| 28 | magma_cube | 岩浆怪 | 史莱姆系（`#frog_food`★）+ 下界 | 分裂+灼烧 | 死亡分裂★；接触灼烧；火免疫★；细雪 5 倍伤★ |
| 29 | guardian | 守卫者 | **水生(aquatic)**★ | 定点炮台 | 蓄力激光；尖刺反弹近战 |
| 30 | elder_guardian | 远古守卫者 | 水生（守卫者系变体） | Boss 炮台 | 同上+挖掘疲劳诅咒；bossbar |
| 31 | shulker | 潜影贝 | 无族（末地/末影叙事） | 固定炮台 | 追踪弹命中漂浮(levitation)；贴墙开合（闭合免伤） |
| 32 | vindicator | 卫道士 | **illager**★ | 冲锋近战 | 斧高伤；袭击时加速；"Johnny"彩蛋全图攻击 |
| 33 | evoker | 唤魔者 | **illager**★ | 召唤师 | 尖牙阵★；召唤恼鬼★ |
| 34 | pillager | 掠夺者 | **illager**★ | 远程 | 弩连发；可当队长★ |
| 35 | ravager | 劫掠兽 | **raider 圈**（BE 已非 illager★） | 野兽坦克 | 冲撞+吼(AoE 击退,灾厄族免疫★)；破坏作物；可被骑乘 |
| 36 | wither | 凋灵 | **不死**★（BE skeleton family 含它★） | 飞行 Boss | 双头颅弹(凋零)+蓝头颅破方块；半血护甲；不死族互不攻击★ |
| 37 | warden | 监守者 | 无族（深暗/sculk；**曾属不死、后移除**★） | 感知 Boss | 盲眼靠振动/嗅探索敌；音波炮(穿墙); 高近战伤；100% 击退抗性★ |

带 ★ 条目的直接出处：Undead/Arthropod/Illager/Mob_type/Entity_type_tag/Family 页（§8 来源索引前 6 条，均本次抓取）；其余行为条目的规范出处为表末对应怪的 wiki 专页（`https://minecraft.wiki/w/<英文名>`，如 [Creeper](https://minecraft.wiki/w/Creeper)、[Enderman](https://minecraft.wiki/w/Enderman)、[Warden](https://minecraft.wiki/w/Warden) 等），本次未逐一抓取（minecraft.wiki 对高频抓取限流），仅按公认机制记载——**已列入 §7 未验证清单**。

**本表的三个要点**（对谱系设计最有用）：

- **"无族"是合法且高发的状态**：苦力怕、末影人、铁傀儡、末影龙、烈焰人、恶魂、潜影贝、监守者、嘎枝、恼鬼、疣猪兽都不属于任何官方族。原版的原则是**族只为"多个怪共享机制判据"而建，不为分类整齐而建**——苦力怕没有族，但个性极强。
- **一身多族很正常**：僵尸猪灵（猪灵系+不死）、僵尸疣猪兽（疣猪兽叙事+不死）、凋灵（boss+不死+BE 骷髅 family）。
- **同一族内允许特化豁免**：尸壳不日烧、凋灵骷髅日烧无效、溺尸不属于水生族——族给默认值，个体可覆盖。这与"继承树"完全相反，是**标签 + 个体覆盖**的模式。

### 1.7 原版攻击方式的"技能原型"归纳

把 37 怪的攻击行为折叠，原版实际使用的技能槽位约 12 种：近战、近战+状态异常(毒/饥饿/凋零/缓慢)、纯弹道(箭/弩/三叉戟)、爆炸物(可反弹火球/头颅)、自爆、蓄力射线(守卫者)、追踪弹(潜影贝)、召唤(增援/恼鬼/分裂)、AoE 控制(劫掠兽吼/尖牙)、穿墙突袭(恼鬼)、瞬移(末影人/唤魔者族附加)、感知替代视觉的索敌(监守者)。**本项目 mobs.js 目前旗标覆盖了其中 4 种**（ranged/boom/fly/boss），族化的空间主要在"状态异常、召唤、AoE 控制、瞬移、特殊索敌"这五类未被建模的行为上（对照 §6）。

---

## 2. 原版"变体派生"手法（三层）

[Mob variant](https://minecraft.wiki/w/Mob_variant) 页（已抓取）专门收录**第一层**——同一实体内的外观/品种变体；第二、三层在该页之外，由族页与转化机制构成。

| 层 | 定义 | 原版例 | 实现载体 | 对本项目的类比 |
| --- | --- | --- | --- | --- |
| **L1 外观变体** | 同一实体类型，换材质/体型/花色，"typically without altering their basic properties"（Mob variant 页原文） | 史莱姆/岩浆怪 4 档尺寸、潜影贝各色、沼骸两种蘑菇、铁傀儡破损度贴图、兔子/羊花色 | NBT 字段(Size/Variant) + 材质 | 同一 `mobType` 的 `variant` 字段或 tint |
| **L2 实体变体** | 新实体类型，但骨架/模型/AI 同源，环境特化 + 少量专属机制 | 僵尸→尸壳(沙漠,不日烧,饥饿)/溺尸(水中,三叉戟)；骷髅→流浪者(雪原,缓慢箭)/沼骸(沼泽,毒箭)/凋灵骷髅(下界,凋零剑,高个)；猪灵→蛮兵；守卫者→远古守卫者 | JE 里是派生实体类（Husk/Drowned 派生自 Zombie、Stray/Bogged/WitherSkeleton 派生自 AbstractSkeleton——**代码层继承，二手知识未核对源码**，见 §7）+ 各自独立 ID 与专页 | `family: 'skeleton'` + 个体 override |
| **L3 运行时转化** | 游戏中 A 怪变成 B 怪 | 僵尸沉水→溺尸★、尸壳沉水→僵尸★（Undead 页）；村民被僵尸杀死→僵尸村民；猪灵/疣猪兽离开下界→僵尸猪灵/僵尸疣猪兽（[Piglin](https://minecraft.wiki/w/Piglin) 页，未抓取成功，公认机制，见 §7） | 触发器(环境/事件) + 换实体 | 模式层脚本钩子 |

**变体公式**（从 L2 案例归纳）：`新怪 = 同族骨架(模型+基础AI+族弱点) ⊕ 环境特化(生成地) ⊕ 1 个专属机制 ⊕ 数值微调`。尸壳=僵尸⊕沙漠⊕饥饿+不日烧；流浪者=骷髅⊕雪原⊕缓慢箭。**专属机制只给一招**——原版从不在变体上堆两个新机制，这让每个变体保持"一眼可读"。

另外两条派生线索：
- **Boss 也是变体手法**：远古守卫者=守卫者放大+诅咒（同族升格）；凋灵在 BE 的 skeleton family 里★。Boss 不必跳出族谱。
- **事件编队是族的用武之地**：袭击波次按"灾厄族+盟友圈"编排（掠夺者骑劫掠兽等 jockey）★——族让**编队生成器**也能按族填空。

---

## 3. 标签 vs 继承：原版怎么实现"家族"

### 3.1 JE：属性标签引用族标签（间接层）

[Entity type tag](https://minecraft.wiki/w/Entity_type_tag_\(Java_Edition\)) 页（已抓取）的关键结构：

```
#undead                = #skeletons + #zombies + phantom + wither
#skeletons             = bogged, parched, skeleton, skeleton_horse, stray, wither_skeleton
#zombies               = camel_husk, drowned, frostbite, husk, zoglin, zombie, ...
#sensitive_to_smite    = #undead          ← 机制在这层
#inverted_healing_and_harm = #undead
#ignores_poison_and_regen  = #undead
#wither_friends        = #undead
#burn_in_daylight      = (逐个列出，非引用 #undead！)
```

该页 Undead 词条与 [Undead](https://minecraft.wiki/w/Undead) 页 Trivia 都点明：**`#undead` 标签本身不直接产生大多数共享性质**——性质是"包含 `#undead` 的那些属性标签"产生的。也就是说：

- **族标签是"分组快捷方式"，属性标签才是机制的挂载点**；
- 机制可以引用族（Smite→#undead），也可以**绕开族自列名单**（burn_in_daylight 没有引用 #undead，因为灼烧本来就不是全族性质）；
- 标签存在数据包里，玩家/模组可改；标签互相嵌套形成 DAG 而非树——一个实体可以出现在任意多个标签里；
- entity tag 体系 1.14 才引入（18w43a 首个就是 `#skeletons`），**是"数据驱动化改造"的产物，不是初始设计**——先有散落的机制判定，后来收拢成标签。

### 3.2 BE：type_family 多标签组件

[Family](https://minecraft.wiki/w/Family) 页（已抓取）：家族由实体行为文件的 `minecraft:type_family` 组件定义（微软官方文档 [Type Family 组件](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_type_family)），一个实体同时佩戴多个家族，例如猪灵蛮兵 ∈ {piglin, piglin_brute, monster, mob}；BE 的 `skeleton` family 甚至包含凋灵。家族用于命令目标选择与实体行为（如猪灵的敌对判定按 family 查询）。

### 3.3 对比与结论

| 维度 | 继承树（单亲） | 标签组合（多标签） |
| --- | --- | --- |
| 归属数量 | 一个怪只能属于一个族 | 任意多（僵尸猪灵=猪灵+不死+怪物） |
| 族判据变更 | 改代码层级结构 | 改数据表一行 |
| 个体豁免 | 要靠覆写方法（容易腐化） | 属性标签本就可自列名单（burn_in_daylight 的做法） |
| 原版实践 | 仅存在于 JE 代码层（Zombie→Husk 派生，管"骨架复用"） | 数据层全面使用（管"机制分组"） |

**原版的答案是双层**：**代码层用继承复用骨架（省实现），数据层用标签组合表达族（给机制挂钩）**。两者职责不同，互不替代。D&D 走过同一条演化路：3.5e 的类型自带特性（d8 生命骰、黑暗视觉等，[Types & Subtypes](https://www.d20srd.org/srd/typesSubtypes.htm)），5e SRD 明说"The game includes the following monster types, **which have no rules of their own**"——类型退化为纯接口，供"屠龙箭对 dragon **类型**（含龙龟、双足飞龙）生效"这类规则挂钩（[5e SRD: Creatures](https://www.dandwiki.com/wiki/5e_SRD:Creatures)）。**机制放标签、个性放个体条目，是两个体系殊途同归的收敛点。**

---

## 4. 其他游戏的怪物/敌人分类经验

### 4.1 Terraria：AI 编号模板 + 数值行 + 个体附加逻辑

官方 wiki 的 [AI](https://terraria.wiki.gg/wiki/AI) 页（已抓取）原文要点：

- 共 **132 种 AI 类型**。"An AI type can be considered a **template**: some base AIs are shared across many NPCs, while others are unique. Furthermore, some NPCs have **additional AI logic on top of their base AI**"——如地表史莱姆的非攻击模式、Wandering Eye 的加速度、**部分 Fighter AI 怪的远程攻击**。
- AI 名字是 wiki 按行为观察命名的（"Most AIs are not explicitly named in the game code"）。
- 共用规模：**Slime AI（#1）约 35 只怪共用**；**Fighter AI（#3）约 126 只共用**（僵尸/骷髅/哥布林/海盗全在其中——注意骷髅弓箭手、哥布林弓箭手也是 Fighter AI + 远程附加）；Worm AI 管所有多节钻地怪；Caster AI 是"定点施法三次→传送"模板。
- 动态切换：Spider AI 的怪**离开墙就无缝切换成 Fighter AI 的行走变体**——AI 模板可按环境切换。
- 每只怪本体只是一行数值（hp/伤害/防御/击退抗性/掉落/生物群落，见 [List of NPCs](https://terraria.wiki.gg/wiki/List_of_NPCs) 表结构）+ aiStyle 编号。

**对本项目的意义**：Terraria 与本项目现状同构（扁平数值表+少量行为位），它给出的扩展路径正是"**把行为位升级为 AI 模板编号，模板之上允许个体附加逻辑**"——先做 5~8 个模板，比做 37 套专属 AI 便宜一个数量级。

### 4.2 D&D：14 个怪物类型，5e 刻意"类型无规则"

5e SRD 的 14 类型：aberration / beast / celestial / construct / dragon / elemental / fey / fiend / giant / humanoid / monstrosity / ooze / plant / undead（[5e SRD: Monsters](https://www.dandwiki.com/wiki/5e_SRD:Monsters)、[dnd5e.info 索引](https://dnd5e.info/monsters/monster)）。SRD 原文（[5e SRD: Creatures](https://www.dandwiki.com/wiki/5e_SRD:Creatures)，已抓取）：

> "A monster's type speaks to its fundamental nature. **Certain spells, magic items, class features, and other effects in the game interact in special ways with creatures of a particular type.** For example, an arrow of dragon slaying deals extra damage not only to dragons but also other creatures of the dragon type, such as dragon turtles and wyverns." … "The game includes the following monster types, **which have no rules of their own**."

另有括号子标签（humanoid (goblinoid) 等），"The tags have no rules of their own, but something in the game might refer to them."

- **类型 = 供其他系统挂钩的接口**（屠龙箭、防不死结界、侦测邪恶），而非属性包；3.5e 的"类型自带 HD/视觉/免疫"被 5e 废弃，就是为了**把怪物个体条目做成自足的**。
- monstrosity 是官方承认的**兜底族**（"serve as a catch-all category"）——体系要给"装不进去的怪"留出口（对应原版的"无族"状态）。

### 4.3 Pokémon：正交属性乘法 + 血统（进化链/蛋组）另管

- 官方："Pokémon and their attacks belong to one of **18 different types**. Each type has varying strengths and weaknesses"（[官方属性表](https://sg.portal-pokemon.com/game/type-chart)，页面 JS 渲染，正文经搜索摘要核对）。
- [Bulbapedia Type](https://bulbapedia.bulbagarden.net/wiki/Type)（403 未直抓，经搜索摘要核对，见 §7）：招式必属单属性；宝可梦可双属性，18 类型→324 种组合、171 种无序组合、162 种已被使用；克制倍率按乘法叠（飞行打虫/草 4×，地面打同 ¼×）。
- **属性(战斗)与进化族/蛋组(血统)是完全分离的两套系统**：进化链管外观叙事与数值成长，属性管克制乘法，蛋组管繁殖。海量怪物（1000+）之所以可控，是因为**每套系统的规则都极简且正交**——没有"火系都长什么样"的强制约定（有火系的狗、马、鸟、蜗牛）。

### 4.4 敌人原型学（战斗角色分类）

近一手来源（GDC 演讲 + 业界教材）：

- **Skylanders 四原型**：Activision 设计师 Mike Stout, GDC 2012《Reaching Into the Toy-Chest》提出 **"Near / Far / Swarmer / Heavy"** 四大敌型，并主张"纯近战敌人本身通常很无聊，远程敌人对关卡设计很重要"（经 [The Level Design Book § Enemy design](https://book.leveldesignbook.com/process/combat/enemy) 转引，二手转引一手演讲）。
- **正交差异化矩阵**：Matthias Worch（GDC 2014《Meaningful Choice in Game & Level Design》）用 Doom 2 怪物画二维矩阵——横轴"Stay Back ↔ Charging"行为、纵轴"Projectile ↔ Hitscan"攻击——证明**两个正交维度就能把一批怪的生态位摆开**（同上转引）。
- The Level Design Book 自己给出的角色表：Grunt/Squad/Leader/Tank/Swarm/Sniper × 速度/血量/射程/DPS 矩阵（同上，已抓取）。
- **The Division 的两级结构**："Archetypes & Factions"——原型（Assault/Rusher/Tank…）是行为层，派系(Faction)是外观与叙事层，同一原型可在不同派系复用（[Game Developer《Enemy AI Design in Tom Clancy's The Division》](https://www.gamedeveloper.com/design/enemy-ai-design-in-tom-clancy-s-the-division)，二手报道开发商演讲）。
- 社区设计词汇（如 [Hayao Design Codex: Enemy Archetypes](https://hayao.dev/docs/codex/system-enemy-archetypes)，个人设计文档，参考性质）：tank/skirmisher/artillery/swarm/support 五角色，且强调**组合才产生涌现**（tank+artillery=炮台被掩护；support+swarm=杀序倒置）——"难度来自编成，不来自数值膨胀"。

**原型学共识**：6±3 个战斗角色足够覆盖动作游戏全部敌人；角色由"速度×血量×射程×攻击方式"的少数正交轴定义；**原型(行为)与阵营/血统(外观叙事)分层**。

---

## 5. 谱系维度备选方案比较（不拍板）

从 §1-§4 提炼，可供本项目选择的"族"维度有四套，各自回答不同的设计问题：

| 方案 | 族的定义 | 族内共享什么 | 新增怪物时 | 优点 | 缺点 | 原版/同行先例 |
| --- | --- | --- | --- | --- | --- | --- |
| **A. 机制族**（弱点/抗性判据） | "受同样的特殊伤害/环境效果" | 弱点、抗性、药水反应、阳光灼烧之类的环境规则 | 先判族籍→自动继承弱点表 | 战斗规则可按族批量演化（加一种克不死族的武器=改一处）；判据客观、可测 | 与"技能设计"无直接关系——本项目的核心诉求是技能模板，A 只解决弱点 | MC 不死/节肢/水生；D&D 5e 类型 |
| **B. 行为原型族**（AI 模板） | "共用一套战斗 AI 骨架" | AI 状态机、攻击方式模板、索敌规则、附加逻辑钩子 | 挑模板→填数值→加一招附加 | **直接服务技能系统化**：模板=共享技能槽；新增成本低（Terraria 126 只共用一个模板） | 与外观/叙事完全脱节，孩子看不出"这俩是一家" | Terraria aiStyle；Skylanders 四原型；Division 原型 |
| **C. 血统/生态族**（外观+产地） | "同源/同维度/同画风" | 建模骨架、配色语汇、生成环境、叙事关系 | 复用骨架换皮+一招专属（§2 公式） | 变体扩展最便宜（尸壳式）；孩子最可读（"穿金衣服的猪家"）；叙事钩子多 | 机制负载低，对技能系统化帮助间接 | MC 变体三层；Pokémon 进化族/蛋组；MC 下界=生态分区 |
| **D. 双层组合**（B×C + 标签粘合） | 原型层管行为，血统层管外观+弱点，都用标签数组挂到怪上 | 每层各自共享各自的；个体 override 优先 | 查两张表：选原型、选血统，再写差异 | 与原版/5e/Division 的实践一致；支持一身多族、无族个体、族籍版本内调整 | 结构最重；对 6 岁孩子的 UI 呈现需要再设计一层的简化视图 | 原版（代码继承骨架 + 数据标签分族）；Division（原型×派系）；Pokémon（属性×蛋组） |

**几个与本项目相关的判断依据**（供项目方权衡时参考，不是结论）：

1. 本项目的直接诉求是"技能按谱系系统化"（家族共享技能模板+个体特化）——只有 **B（行为原型）直接命中**；A 和 C 是放大器（A 让技能可以有"对族特效"，C 让美术/叙事扩展便宜）。
2. "给 6 岁孩子"意味着**族最好在选怪面板上可读可讲**（"骷髅一家都会射箭"）——C 的可读性最强，B 的原型名需要翻译成孩子语汇（"冲冲怪/射射怪/砰砰怪"）。
3. 原版与 5e 的共同教训：**不要让族自带过多默认机制**（3.5e 的教训），机制挂载点要少而清晰（本项目可先只有 1-2 个：如"克族伤害加成"或"族共享弱点"），其余交给个体。
4. **必须保留"无族"与"多族"两个出口**（苦力怕无族、僵尸猪灵双族是原版的真实用法；monstrosity 是 D&D 的兜底族）——任何要求"37 怪每只恰好归一族"的方案都会与先例冲突。

---

## 6. 对本项目 MOB_TYPES 的映射建议（初步，供讨论）

> 本节只给结构化思路与示例，**不替项目拍板**；方案选择见 §5。

现状：`MOB_TYPES` 每行 = 数值(hp/dmg/speed/range/cd/h/hitR) + 4 旗标(ranged/boom/fly/boss)；5 怪有 arena.js 专属技能，32 怪复用旗标通用行为。

1. **旗标层升级为"原型层"（§5-B）**：ranged/boom/fly 本质已是原型位。可考虑把原型从布尔旗标改成命名模板（如 `proto: 'archer' | 'bomber' | 'diver' | 'brute' | 'turret' | 'summoner' | 'splitter' | ...`），arena.js 的通用行为按模板分发——这就是 Terraria aiStyle 的形态。现有 4 旗标可平滑映射（ranged+fly=flying turret→恶魂/烈焰人模板；boom=bomber；fly=diver）。
2. **族作为第二字段/标签数组（§5-A/C）**：例（仅示意）：
   ```js
   skeleton: { name:'骷髅', hp:26, ..., proto:'archer',
               family:['undead','skeleton_line'],          // 标签数组：可多族、可空
               trait:{ burnInDay:false /*竞技场无昼夜则免*/ } },  // 个体覆盖示例
   zombified_piglin: { ..., family:['undead','piglin_line'] },    // 一身两族的原版先例
   creeper:        { ..., family:[] },                            // 无族合法
   ```
   `family` 初期可以只做**展示与编队分组**用（竞技场混合编队池按族配平），机制挂钩（克族加成/族弱点）等有实际玩法需要时再接——原版 entity tag 也是 1.14 才补的，先分类后挂钩是正常次序。
3. **变体派生的章法（§2 公式）**：新增怪优先走"已有族的 L2 变体"（同 family + 1 招专属 + 数值微调），例如若要加"雪原僵尸"，按尸壳公式=僵尸⊕雪原⊕缓慢一招。专属技能**只给一招**，保持一眼可读——这是原版变体最稳定的规律。
4. **技能槽归纳参照 §1.7**：37 怪折叠后约 12 类技能原型，其中"状态异常、召唤、AoE 控制、瞬移、特殊索敌"5 类目前无旗标表达——若原型层要扩展，优先补这 5 类的模板，而非逐怪写专属技能。
5. **boss 不必出族谱**（远古守卫者/凋灵先例），但可享受族叙事（BE 把凋灵归进 skeleton family 就是纯叙事用法）。
6. 落点提示：数值与旗标本就"表驱动"（shared-monsters-design.md 的 D5 定稿），`family`/`proto` 字段继续放 config.js 这张表即可，不引入新文件；arena.js 的技能分发处（现为 5 怪专属 if）是原型模板化的自然落点。

---

## 7. 未验证 / 查证失败清单

| 项 | 状态 | 说明 |
| --- | --- | --- |
| minecraft.wiki 各怪专页（Creeper/Enderman/Warden/Ghast/Blaze/Shulker/Guardian/Piglin 等） | 未逐一抓取 | wiki 对高频抓取限流（多页 Transport error）。§1.6 表中不带 ★ 的行为条目按公认机制记载，规范出处为对应专页 URL；落地设计前建议抽查 2-3 只关键怪核对数值/机制细节 |
| [Mob conversion](https://minecraft.wiki/w/Mob_conversion) 页 | 抓取失败 | 多次 Transport error。僵尸↔溺尸/尸壳转化经 Undead 页★核实；猪灵/疣猪兽出下界转化的说法未取得页面原文（§2 L3 已标注） |
| [Piglin](https://minecraft.wiki/w/Piglin) 页 | 抓取失败 | 以物易物/惧怕僵尸猪灵等条目未取到原文 |
| JE 代码层继承（Husk extends Zombie 等） | 二手 | 社区共识/反编译知识，未核对官方源码；对本报告结论（数据层用标签）无影响，已在 §2 标注 |
| Bulbapedia [Type](https://bulbapedia.bulbagarden.net/wiki/Type) 页 | 403 | 经 websearch 摘要核对关键数字（18 类型/324 组合/171 无序/162 已用）；官方属性表页为 JS 渲染，正文引文经摘要核对 |
| Skylanders 四原型 / Worch Doom2 矩阵 | 二手转引 | 经 The Level Design Book 转引 GDC 2012/2014 演讲（原文为 GDC Vault 视频/PDF，未直接抓取）；引文已在正文标注转引 |
| Terraria AI 页为 wiki.gg 官方 wiki | 已抓取 | 132 AI 类型表为该页原文；Fighter AI "126 NPCs" 按该页列表统计（搜索摘要显示 126，主表原文为"most common AI"） |
| D&D 5e SRD 类型说明 | 已抓取 | dandwiki 收录的 SRD 文本（OGL 1.0a）；与 dnd5e.info/d20srd 索引交叉一致 |

---

## 附：来源索引（本次实际抓取内容的一手/权威页面）

- **minecraft.wiki（官方社区 wiki，直抓 markdown）**：[Mob](https://minecraft.wiki/w/Mob) · [Undead](https://minecraft.wiki/w/Undead) · [Mob type](https://minecraft.wiki/w/Mob_type) · [Arthropod](https://minecraft.wiki/w/Arthropod) · [Entity type tag (Java Edition)](https://minecraft.wiki/w/Entity_type_tag_\(Java_Edition\)) · [Illager](https://minecraft.wiki/w/Illager) · [Family（Bedrock）](https://minecraft.wiki/w/Family) · [Mob variant](https://minecraft.wiki/w/Mob_variant)
- **minecraft.wiki（规范页 URL，未逐一抓取，见 §7）**：[Creeper](https://minecraft.wiki/w/Creeper) · [Enderman](https://minecraft.wiki/w/Enderman) · [Warden](https://minecraft.wiki/w/Warden) · [Slime](https://minecraft.wiki/w/Slime) · [Magma Cube](https://minecraft.wiki/w/Magma_Cube) · [Guardian](https://minecraft.wiki/w/Guardian) · [Piglin](https://minecraft.wiki/w/Piglin) · [Mob conversion](https://minecraft.wiki/w/Mob_conversion) 等各怪专页
- **微软官方文档（Bedrock 实体组件）**：[minecraft:type_family 组件](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_type_family)（经 Family 页转引，未直抓）
- **Minecraft 设计史一手转引**：*Minecraft Game Design*（[archive.org](https://archive.org/details/minecraft-game-design/page/n41/mode/2up)）与 Jeb "Meet the Vindicator"（[minecraft.net, 2017](https://www.minecraft.net/en-us/article/meet-vindicator)）——均经 Illager 页 References/Trivia 转引
- **Terraria 官方 wiki（wiki.gg，直抓）**：[AI（132 AI 类型总表）](https://terraria.wiki.gg/wiki/AI) · [Fighter AI](https://terraria.wiki.gg/wiki/Fighter_AI) · [List of NPCs](https://terraria.wiki.gg/wiki/List_of_NPCs)
- **D&D**：[5e SRD: Creatures（类型定义原文）](https://www.dandwiki.com/wiki/5e_SRD:Creatures) · [5e SRD: Monsters（14 类型索引）](https://www.dandwiki.com/wiki/5e_SRD:Monsters)（OGL 1.0a 文本）· [dnd5e.info 怪物索引（交叉核对）](https://dnd5e.info/monsters/monster) · [3.5e Types & Subtypes（对照）](https://www.d20srd.org/srd/typesSubtypes.htm)
- **Pokémon**：[官方属性表（新加坡官方站）](https://sg.portal-pokemon.com/game/type-chart)（JS 渲染，引文经摘要核对）· [Bulbapedia Type](https://bulbapedia.bulbagarden.net/wiki/Type)（403，经摘要核对）· [Pokémon Database（交叉核对）](https://pokemondb.net/type)
- **敌人原型学**：[The Level Design Book § Enemy design（含 GDC 2012 Skylanders / GDC 2014 Worch 转引与角色矩阵）](https://book.leveldesignbook.com/process/combat/enemy) · [Game Developer: Enemy AI Design in The Division](https://www.gamedeveloper.com/design/enemy-ai-design-in-tom-clancy-s-the-division) · [Hayao Design Codex: Enemy Archetypes（个人设计文档，参考性质）](https://hayao.dev/docs/codex/system-enemy-archetypes)
- **本仓库源码/文档**：js/config.js（MOB_TYPES 134-189 行）· docs/shared-monsters-design.md · docs/shared-monsters-plan.md

---

研究笔记 v1 · 2026-10-22
