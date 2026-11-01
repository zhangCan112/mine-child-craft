# MC Java 版怪物掉落表调研（代位转正底座 · 12 代位怪 + 7 零掉落怪 + 12 候选物品）

> 目的：为「MOB_DROPS 代位物品升级为正典物品」提供一手来源底座——每只代位怪的 Java 正典掉落物/数量/概率/条件，正典零掉落怪确认，候选新物品的正典属性，以及折算先例的锚点核对。
> 来源口径：只收一手来源 minecraft.wiki（各怪物页 §Drops + 各物品页），每个数字可溯源到具体页面与小节；未采信任何二手攻略站。
> 访问日期：2026-11-01。Java 版本口径：wiki 导航栏现行版 26.3（26.4 upcoming），涉及页面最后编辑于 2026-10-20～10-25，掉落数值无按版本分叉标注。
> 配套：仓库现状（代位清单）权威在 `js/mob-registry.js` MOB_DROPS 行内注释；拍板记录按先例入 commit message（`bc2acf4` 同款）。

## 1. 来源清单与取证方式

| 来源 | 用途 | 说明 |
| --- | --- | --- |
| minecraft.wiki 各怪物页 §Drops | 掉落物/数量/概率/抢夺/条件 | 渲染表（Decimal/Fraction/Distribution/Expectation 四 tab）与页 wikitext 源（`DropTable` 模板参数 `quantity`/`lootingquantity`/`dropchance`/`lootingchance`/`notes`）两处互核一致 |
| minecraft.wiki 各物品页 | 候选物品用途/堆叠/燃料 | Infobox + Obtaining/Usage/Fuel 章节 |

- 诚实标注：zombie/creeper/skeleton 的 0–2 行只取到页源参数（渲染值未单独截图）；同参数行（quantity=0-2、lootingquantity=0-1）在 guardian/cave_spider/spider/wither_skeleton 等已渲染取证页面均显示 66.67%（2⁄3），据同参数模板口径标注。
- 中文名取自页面 zh 交叉链接（如 [[zh:潜影壳]]、[[zh:海晶砂粒]]），仅作对照；一切数字以英文页为准。
- 本环境不可达来源：无（全部目标页面抓取成功）。

## 2. 十二只代位怪的 Java 正典掉落表

> 「条件」列的「玩家/狼击杀」= 页面 notes=`player_or_pet`（需玩家或驯服狼击杀）。本游戏击杀者只有玩家，此类条件天然满足。

| 怪物 | 正典掉落（空手） | 抢夺加成 | 条件 | 来源 |
| --- | --- | --- | --- | --- |
| blaze 烈焰人 | **blaze_rod 烈焰棒 0–1 · 50%** | L3 0–4 · 91.67% | 玩家/狼击杀 | [/w/Blaze §Drops](https://minecraft.wiki/w/Blaze#Drops) |
| wither 凋灵 | **nether_star 下界之星 1 · 必得** | 无（各档恒 1） | 无（无论死法必掉）；Java 掉落物 10 分钟才消失 | [/w/Wither §Drops](https://minecraft.wiki/w/Wither#Drops) |
| enderman 末影人 | **ender_pearl 末影珍珠 0–1 · 50%** | L3 0–4 · 91.67% | 页面未标注击杀者条件 | [/w/Enderman §Drops](https://minecraft.wiki/w/Enderman#Drops) |
| phantom 幻翼 | **phantom_membrane 幻翼膜 0–1 · 50%** | L3 0–4 · 91.67% | 玩家/狼击杀 | [/w/Phantom §Drops](https://minecraft.wiki/w/Phantom#Drops) |
| guardian 守卫者 | **prismarine_shard 海晶碎片 0–2 · 66.67%**；prismarine_crystals 海晶砂粒 0–1 · 40%；raw_cod 生鳕鱼 0–2 · 40.9%（玩家/狼击杀、未燃烧口径） | 碎片 L3 0–5 · 94.44%；砂粒/鳕鱼数量上限每级 +1（概率不变） | 碎片/砂粒无条件 | [/w/Guardian §Drops](https://minecraft.wiki/w/Guardian#Drops) |
| elder_guardian 远古守卫者 | **wet_sponge 湿海绵 1 · 必得**（玩家/狼击杀）；prismarine_shard 0–2 · 66.67%；prismarine_crystals 0–1 · 33.33%；raw_cod 0–2 · 50.75%（玩家/狼击杀、未燃烧口径）；tide_armor_trim 潮汐纹饰 0–1 · 20% | 同守卫者 | 碎片/砂粒/纹饰无条件 | [/w/Elder_Guardian §Drops](https://minecraft.wiki/w/Elder_Guardian#Drops) |
| cave_spider 洞穴蜘蛛 | **string 线 0–2 · 66.67%**；spider_eye 蜘蛛眼 0–1 · 33.33% | 线 L3 0–5 · 94.44%；眼 L3 0–4 · 88.89% | 眼需玩家/狼击杀 | [/w/Cave_Spider §Drops](https://minecraft.wiki/w/Cave_Spider#Drops) |
| magma_cube 岩浆怪 | **magma_cream 岩浆膏 0–1 · 25%** | L3 0–4 · 87.5%（物品页：受抢夺影响最大的掉落物，L3 为默认 7 倍） | 仅中/大型；非被青蛙击杀 | [/w/Magma_Cube §Drops](https://minecraft.wiki/w/Magma_Cube#Drops) |
| zombified_piglin 僵尸猪灵 | **rotten_flesh 腐肉 0–1**；**gold_nugget 金粒 0–1**；gold_ingot 金锭稀有 · 2.5% | 金锭每级 +1% → L3 5.5%；腐肉/金粒不随抢夺扩量 | 金锭需玩家/狼击杀 | [/w/Zombified_Piglin §Drops](https://minecraft.wiki/w/Zombified_Piglin#Drops) |
| shulker 潜影贝 | **shulker_shell 潜影壳 0–1 · 50%** | 每级 +6.25% → L3 68.75%（页源 `dropchance=0.5, lootingchance=0.0625`） | 页面未标注击杀者条件 | [/w/Shulker §Drops](https://minecraft.wiki/w/Shulker#Drops) |
| drowned 溺尸 | **rotten_flesh 腐肉 0–2 · 66.67%**；copper_ingot 铜锭稀有 · 11% | 铜锭每级 +2% → L3 17% | 铜锭需玩家/狼击杀 | [/w/Drowned §Drops](https://minecraft.wiki/w/Drowned#Drops) |
| ghast 恶魂 | **gunpowder 火药 0–2 · 66.67%**；**ghast_tear 恶魂之泪 0–1**（无抢夺扩量） | 火药每级 +0–1 | 泪无条件 | [/w/Ghast §Drops](https://minecraft.wiki/w/Ghast#Drops) |

- 守卫者两家补充（照录）：鳕鱼另有燃烧/火焰附加变体与非玩家击杀变体（守卫者 0–1 · 40%、远古 0–1 · 50%），结构为四变体分行；玩家击杀另有 2.5%（每级抢夺 +1%）走钓鱼战利品表掉 1 条随机鱼（鲑鱼/河豚/热带鱼各 0.62%/0.33%/0.05%）；远古守卫者的湿海绵为玩家/狼击杀必得。本游戏无燃烧与抢夺系统，这些分支记录在案即可。(来源: 两页 §Drops)
- 末影人手持方块 100% 掉该方块、恶魂唱片/苦力怕头颅类特殊触发掉落，与本轮无关，记录在案。(来源: 各页 §Drops)

## 3. 七只「正典零掉落」怪确认

| 怪物 | Java 正典死亡掉落 | 来源 |
| --- | --- | --- |
| silverfish 蠹虫 | 无物品掉落，仅 5 XP（玩家/狼击杀） | [/w/Silverfish §Drops](https://minecraft.wiki/w/Silverfish#Drops) |
| endermite 末影螨 | 无物品掉落，仅 3 XP（玩家/狼击杀） | [/w/Endermite §Drops](https://minecraft.wiki/w/Endermite#Drops) |
| vex 恼鬼 | 无物品掉落（手持铁剑掉落几率为 0，不受抢夺影响），仅 5 XP | [/w/Vex §Drops](https://minecraft.wiki/w/Vex#Drops) |
| piglin 猪灵 | 掉落表仅 piglin_head（充能苦力怕炸死限定）；装备按 8.5%/件规则掉，无普通物品掉落 | [/w/Piglin §Drops](https://minecraft.wiki/w/Piglin#Drops) |
| piglin_brute 猪灵蛮兵 | 无掉落表物品；仅自带金斧按 8.5% 装备规则 | [/w/Piglin_Brute §Drops](https://minecraft.wiki/w/Piglin_Brute#Drops) |
| illusioner 幻术师 | 无掉落表物品；仅自带弓按 8.5% 装备规则 | [/w/Illusioner §Drops](https://minecraft.wiki/w/Illusioner#Drops) |
| creaking 嘎枝 | 完全无掉落（无物品无经验）："Creakings do not drop any items or experience on death." | [/w/Creaking §Drops](https://minecraft.wiki/w/Creaking#Drops) |

- piglin 以物易物是**交易行为**（拾金锭→检查 6 秒→按战利品表吐随机物品），与死亡掉落无关，死后不吐拾取物。(来源: [/w/Piglin §Bartering](https://minecraft.wiki/w/Piglin#Bartering))

## 4. 候选新物品 12 项正典属性

| 物品 | 中文名 | 来源怪（见 §2） | 正典用途 | 堆叠 | 燃料 |
| --- | --- | --- | --- | --- | --- |
| ender_pearl | 末影珍珠 | enderman | 投掷传送；合成**末影之眼**；猪灵以物易物可得 | **16** | 无 |
| blaze_rod | 烈焰棒 | blaze | 合成烈焰粉/酿造台；烈焰粉→末影之眼。**熔炉燃料 120 秒 = 烧 12 件** | 64 | **12 件** |
| nether_star | 下界之星 | wither | 合成**信标**；免疫爆炸损坏 | 64 | 无 |
| phantom_membrane | 幻翼膜 | phantom | 缓降药水；铁砧修复鞘翅（每张 25%） | 64 | 无 |
| spider_eye | 蜘蛛眼 | cave_spider / spider | 中毒药水；可食用（带中毒）；合成发酵蛛眼 | 64 | 无 |
| magma_cream | 岩浆膏 | magma_cube | 抗火药水；合成岩浆块；烈焰粉+粘液球可合成 | 64 | 无 |
| gold_nugget | 金粒 | zombified_piglin | 9 粒合成**金锭**；金胡萝卜；下界金矿 2–6 粒 | 64 | 无 |
| shulker_shell | 潜影壳 | shulker | **仅用于合成潜影盒**（页面原文 "used solely to craft shulker boxes"） | 64 | 无 |
| prismarine_shard | 海晶碎片 | guardian / elder_guardian | 海晶灯与海晶石方块系；**怪物之外无获取途径**（物品页仅 Mob Loot 一章） | 64 | 无 |
| prismarine_crystals | 海晶砂粒 | guardian / elder_guardian | 海晶灯；怪物之外可挖海晶灯得 2–3 | 64 | 无 |
| copper_ingot | 铜锭 | drowned | 铜块/铜灯/刷子/望远镜（2 铜+紫水晶碎片）等 | 64 | 无 |
| ghast_tear | 恶魂之泪 | ghast | 再生药水；合成末影水晶 | 64 | 无 |

(来源: 各物品页 https://minecraft.wiki/w/Ender_Pearl · /w/Blaze_Rod §Fuel 「lasts 120 seconds (12 items)」 · /w/Nether_Star · /w/Phantom_Membrane · /w/Spider_Eye · /w/Magma_Cream · /w/Gold_Nugget · /w/Shulker_Shell §Obtaining · /w/Prismarine_Shard §Obtaining · /w/Prismarine_Crystals §Obtaining · /w/Copper_Ingot · /w/Ghast_Tear ，访问日期均为 2026-11-01)

## 5. 折算先例锚点核对（本表既有口径的正典出处）

| 本表既有口径 | 正典事实 | 来源 |
| --- | --- | --- |
| zombie 腐肉 [1,1]（保底 1+50% 加成，替代空手） | rotten_flesh 0–2、每级抢夺 +0–1；同参数模板渲染 66.67% | [/w/Zombie §Drops](https://minecraft.wiki/w/Zombie#Drops) |
| zombie rare 铁 5%（原注释「MC 0.83%」） | 页源 `dropchance=0.025, lootingchance=0.01, multiplychance=1/3`，需玩家/狼击杀 → 2.5%×1⁄3≈**0.83%**，L3 5.5%×1⁄3≈1.83%（换算值，参数照录） | 同上 |
| slime 行注释「MC 需玩家击杀口径」 | **现行页面粘液球行无玩家击杀标注**：notes=`small_slime,not_frog`（仅小型、非青蛙击杀）；「玩家击杀」仅出现在经验条目——该注释已过时（勘误，见 §6.4） | [/w/Slime §Drops](https://minecraft.wiki/w/Slime#Drops) |
| wither_skeleton 煤炭 [1,1] | coal 0–1 · 33.33%（L3 0–4 · 88.89%），无击杀者条件 | [/w/Wither_Skeleton §Drops](https://minecraft.wiki/w/Wither_Skeleton#Drops) |
| creeper 火药 / skeleton 骨+箭 / spider 线 | 均 0–2 · 66.67% 模板；spider 另有蜘蛛眼 0–1 · 33.33%（玩家/狼击杀）；skeleton 弓 8.5% 装备规则；creeper 唱片/头颅特殊触发 | [/w/Creeper](https://minecraft.wiki/w/Creeper#Drops) · [/w/Skeleton](https://minecraft.wiki/w/Skeleton#Drops) · [/w/Spider](https://minecraft.wiki/w/Spider#Drops) |

## 6. 结构性张力清单（拍板输入，本文只录事实）

1. **零掉落怪 vs 保底守门**：§3 七怪正典为空（或仅装备/特殊触发项）；本表 `test/mob-registry.test.js` 断言所有条目保底≥1（「儿童不空手」，mob-registry.js:272 行测试注释）。二者互斥——现状给这七怪族口径掉落（蠹虫/末影螨/恼鬼→线，猪灵双怪→金锭，幻术师→铁粒，嘎枝→木棍）。
2. **0–1·50% 型掉落 vs 保底必得**：blaze_rod/ender_pearl/phantom_membrane/magma_cream(25%)/shulker_shell(50%)/ghast_tear/crystals 正典都是「可能空手」；本表掷骰语义是保底必得+加成掷（替代 MC 66%×0–2 空手，mob-registry.js:207 头注）。折算口径逐项落在掉落行注释（先例：僵尸稀有铁 0.83%→5%）。
3. **堆叠档**：ender_pearl 正典堆叠 16；本游戏 stackMax 只有 64/1 两档（items-core.js 注释「不设 16 档」，设计稿 §2）。
4. **slime 行注释勘误**：源码注释「MC 需玩家击杀口径」与现行 wiki 不符（§5 表）——注释级修正，无行为变化。
5. **boss 附加件去留**：wither 现状骨×4+稀有钻石、enderman 现状铁锭+5% 钻石，均为代位期补偿口径；正典 wither 只掉下界之星、enderman 只掉珍珠（§2 表）。转正后附加件去留属拍板项。
