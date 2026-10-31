# MC「突变苦力怕 / Mutant Creeper」调研（Mutant Creatures 模组 · 小 boss 取证）

> 目的：为「突变巨型苦力怕作为小 boss 加入探险」提供一手来源底座（外观 / 数值 / 行为 / 掉落 / 生成）。
> 来源口径：只收一手来源（模组源码逐字核对 + CurseForge 项目页）。FTB Wiki 本环境不可达未采信，未用任何二手营销稿。
> 访问日期：2026-10-30。作者名勘误见 §1.2（任务给的 "theatomicthinker" 查无此人）。
> 版权口径 D13（同 [mc-mob-models-research.md](mc-mob-models-research.md)）：**只取部件结构、比例、数值与配色语言，像素全部自绘**；本笔记只记录几何/数值/色值，不搬运贴图像素。

## 1. 来源清单与访问情况

### 1.1 一手来源（本笔记全部依据）

| 来源 | 用途 | URL（访问日期均为 2026-10-30） |
| --- | --- | --- |
| 原版 Mutant Creatures 1.7.10 反编译全源码，包名 `thehippomaster.MutantCreatures`（astryxion/Mutant-Creatures，Forge-1.7.10 分支） | **原版数值/AI/掉落/模型的权威** | https://github.com/astryxion/Mutant-Creatures/tree/Forge-1.7.10 |
| Mutant Beasts 1.16.5 完整源码（Chumbanotz/MutantBeasts，master，AGPL-3.0），自述 "The popular Mutant Creatures mod in modern Minecraft" | **现代忠实移植的权威**（对照版本差异） | https://github.com/Chumbanotz/MutantBeasts |
| CurseForge 项目页 mutant-creatures-mod，署名 shcott21，"A pack of huge mutant mini-bosses of the original Minecraft mobs"，5.6M+ 下载 | 项目定位/署名 | https://www.curseforge.com/minecraft/mc-mods/mutant-creatures-mod （403 反爬，标题与描述经搜索快照核对） |
| CurseForge 项目页 mutant-creatures-legacy，自述 "original Mutant Creatures mod by shcott21/thehippomaster21" | **作者双名互证** + 1.12.2 续作存在性 | https://www.curseforge.com/minecraft/mc-mods/mutant-creatures-legacy （同上，快照核对） |
| CurseForge 项目页 mutant-beasts（Chumbanotz 仓库 homepage 字段指向） | MB 官方页 | https://www.curseforge.com/minecraft/mc-mods/mutant-beasts |
| 贴图原件：原版 `assets/mutantcreatures/textures/creeper.png` 与 MB `assets/mutantbeasts/textures/entity/mutant_creeper.png`，**两文件 13429 字节完全相同**（MB 原样复用原版贴图） | 配色逐像素采样 | https://raw.githubusercontent.com/astryxion/Mutant-Creatures/Forge-1.7.10/src/main/resources/assets/mutantcreatures/textures/creeper.png · https://raw.githubusercontent.com/Chumbanotz/MutantBeasts/master/src/main/resources/assets/mutantbeasts/textures/entity/mutant_creeper.png |

逐字核对的关键源文件（正文引用记法：**【原】**=原版 1.7.10，**【MB】**=MutantBeasts 1.16.5）：

- 【原】`MutantCreeper.java` · `ai/MCAICreeperCharge.java` · `ai/MCAICreeperJump.java` · `ai/MCAISpawnCreepers.java` · `client/ModelMutantCreeper.java` · `client/RenderMutantCreeper.java` · `CreeperMinionEgg.java` · `CreeperMinion.java` · `ChemicalXEntity.java` · `SkullSpirit.java` · `item/ChemicalX.java` · `item/CreeperShard.java` · `MutantCreatures.java`（主类/配置/生成注册）
- 【MB】`entity/mutant/MutantCreeperEntity.java` · `client/renderer/entity/model/MutantCreeperModel.java` · `client/renderer/entity/MutantCreeperRenderer.java` · `entity/CreeperMinionEggEntity.java` · `entity/MBEntityType.java` · `data/mutantbeasts/loot_tables/entities/mutant_creeper.json` · `.../creeper_minion.json`

### 1.2 访问失败与勘误（透明记录）

- **FTB Wiki**（https://ftb.fandom.com/wiki/Mutant_Creeper ）：本环境连接被拒（webfetch 与直连均 ECONNREFUSED，archive.org 同样不可达），**其内容未采信**；URL 留备复查。
- **Modrinth**：无官方 Mutant Creatures 项目（搜索仅命中无关同名模组）；用户 `theatomicthinker` 返回 404。
- **minecraft.wiki**：只收原版内容，无此模组条目。
- **作者勘误**：任务给的作者名 "theatomicthinker" 在 CurseForge / Modrinth / GitHub 均查无此人。原作者 = **thehippomaster21**（CurseForge 署名 **shcott21**）。铁证：源码包名 `thehippomaster.MutantCreatures`【原】+ Legacy 页自述 "original Mutant Creatures mod by shcott21/thehippomaster21"。
- **同名警惕**：Fuzs 的《Mutant Monsters》（https://github.com/Fuzss/mutant-monsters ，48M+ 下载）是另起炉灶的现代重制，机制数值与本模组不同，别混淆。

## 2. 版本谱系

| 模组 | MC 版本 | 说明 |
| --- | --- | --- |
| Mutant Creatures（原版，thehippomaster21/shcott21） | 1.5.x–1.7.10（CurseForge 文件页可见 v1.4.7 mc1.7.10） | 停更；本调研的主对象 |
| Mutant Creatures Legacy（Elite Modding Team 分叉） | 1.12.2 | 修复原版 1.12.2 移植的续作（https://github.com/Elite-Modding-Team/MutantCreaturesLegacy ） |
| Mutant Beasts（Chumbanotz） | 1.15.2/1.16.5（源码为 1.16.5） | 忠实移植，模型与贴图原样复用，数值微调（见 §4 差异列） |

## 3. 外观

### 3.1 体型（相对普通苦力怕的倍数）

- 碰撞箱 `setSize(2.0F, 2.4F)`：**宽 2.0 格 × 高 2.4 格**【原】`MutantCreeper.java`。
- 普通苦力怕 0.6×1.7 → **宽 ≈3.3 倍、高 ≈1.4 倍**（巨在「宽扁」，不是单纯拉高）。
- 渲染在模型上再乘 **1.2**（死亡动画中线性缩到 0.8）【原】`RenderMutantCreeper.java`；MB 同样 1.2，站姿眼高 2.6【MB】`MutantCreeperRenderer.java` / `MutantCreeperEntity.java`。视觉站立高度约 2.5~3 格。

### 3.2 模型结构（两版逐字段同构，贴图 128×64）

【原】`ModelMutantCreeper.java` ≡ 【MB】`MutantCreeperModel.java`：

| 部件 | 尺寸(px) | 挂载层级 |
| --- | --- | --- |
| pelvis 骨盆 | 10×14×8 | 根（pivot y14） |
| body 身体 | 9×16×7 | pelvis 子 |
| neck 颈 | 8×14×6 | body 子 |
| head 头 | 10×12×10 | neck 子 |
| 前腿×2 | 上节 6×4×14 + 前肢 7×20×8 | pelvis 子（两节链） |
| 后腿×2 | 上节 4×4×14 + 前肢 6×18×6 | pelvis 子（两节链） |

- **4 条腿、每条 2 节、共 8 段**；前对粗壮、后对细短——蜘蛛式四足，不是普通苦力怕的 4 只短桩脚。
- 躯干 **4 段链式**（骨盆→身体→颈→头），头仍是 10×12×10 的苦力怕方头，脸画在贴图上。

### 3.3 姿态与动画

- 静态角度：pelvis −45°（弓身）、body +54°、neck +60°、head +30°，前肢外张 ±45°、后肢 ±36°——**拱背低伏的爬行姿态**【原】`ModelMutantCreeper.setAngles()`。
- 呼吸 = 三段躯干各 sin(t×0.1)×0.02 微摆；走路 = 前后腿反相摆动 + 骨盆上下浮动；近战挥击 = 躯干下压 60° + 颈回收 45°【原】同文件 `setRotationAngles()`。

### 3.4 贴图配色（PNG 逐像素采样，见 §1.1 贴图行）

- **主底色：浅豆绿 rgb(128,192,112)**（占面积最大的平坦基色）。
- **斑纹：高饱和亮绿噪点** rgb 约 (48–64, 160–240, 0)——原版苦力怕的斑驳肌理语言，但更鲜艳、颗粒更碎。
- **暗部与五官：近黑绿 rgb(32,48,32)**；脸 = 黑色经典苦力怕眯眼 + 下垂嘴（画在 10×12×10 头的正面 UV）。
- **charged（高压）变体**：不换贴图，套原版高压苦力怕的 `creeper_armor.png` 电弧贴图做半透明 pass 层（模型 inflate 2.0），并整体染蓝紫色 (r160,g180)【原】`RenderMutantCreeper.renderCreeperPassModel()`；MB 用同构的 `CreeperChargeLayer`【MB】。

## 4. 数值（版本对照）

| 属性 | 原版 1.7.10【原】`MutantCreeper.java` | Mutant Beasts 1.16.5【MB】`MutantCreeperEntity.java` |
| --- | --- | --- |
| 生命值 | **120（60 颗心）** | 120（同） |
| 近战攻击力 | **4（2 颗心）** | 5（2.5 颗心） |
| 移动速度 | 0.26 | 0.26（同） |
| 索敌范围 | 未设（EntityMob 默认 16） | 24 |
| 击退抗性 | 0（默认） | 1.0（免疫击退） |
| 经验 | 30 | 30（同，仅玩家击杀时掉） |
| 碰撞箱 | 2.0 宽 × 2.4 高 | 眼高 2.6（注册值未能从源码提取） |
| 每 chunk 上限 | `getMaxSpawnedInChunk()=1` | 1（同） |
| 摔落伤害 | 免疫（`fall()` 置空） | 免疫（同） |
| 爆炸伤害 | **半价**：受爆炸伤害时回血一半（净扣 50%）并出爱心粒子 | **完全免疫**，且血不满时再回伤量一半 |
| 蓄力中受击 | 每次受击打断计数 −1 | 同（`chargeHits`） |
| charged 状态 | 免火 + 电弧 overlay | 同 |

## 5. 行为与技能

无传统「两阶段」：蓄力与死亡是**状态演出**，不是血量阈值换阶段。战斗 = 四招 + 死亡演出：

1. **近战扑击**：碰撞攻击 4/5 伤害，冷却 20–30 tick；命中把目标以 0.5 倍水平速度击飞（+0.15 上抛）；原版举盾可免击退【原】`attackEntityAsMob()`；MB 追加 `MBMeleeAttackGoal`(1.3)【MB】。
2. **超级跳扑**：0.9%/tick 概率（目标 ≤32 格、在地面）跃向目标（motionY=1.4，水平 0.2×距离向量）；**落地即爆**：威力 4（charged 6），是否拆方块遵守 mobGriefing【原】`MCAICreeperJump.java` + `updateSuperJump()`；【MB】`JumpAttackGoal` 同参数。
3. **蓄力（回血读条）**：目标 5–32 格且已损血 ≥20（HP≤100）时 0.7%/tick 触发；站定闪白、每秒 chime 音效；**蓄满 100 tick（5 秒）回 30 HP**（=1/4 上限）+ 15 颗爱心；**被击中 3–5 次打断**（后续 4–6 次）。1/6 概率附带闪电特效（MB：雷暴时 1/2、否则 1/6，要求头顶露天）：玩家靠近到 5 格内会引来闪电劈中自己 → **当场变 charged 强化体**（风险机制/彩蛋）【原】`MCAICreeperCharge.java`；【MB】`ChargeAttackGoal`。
4. **召唤小苦力怕**：目标 ≤16 格（MB 放宽到 32 格）时 0.6%/tick，按剩余血量比例吐出 `ceil(HP比×4)` 只 Creeper Minion（满血 4 只、残血 1 只），朝目标掷出并继承 charged 状态【原】`MCAISpawnCreepers.java`；【MB】`SpawnMinionsGoal`。
5. **死亡演出（招牌机制）**：倒地不消失，**5 秒（100 tick）抖动 + 白闪 + 逐渐缩小**，同时以自身为中心 **12 格（charged 18 格）引力圈把周围实体吸向自己**（吸力随进度增强到 0.09）；倒数结束**终爆威力 8（charged 12）**，遵守 mobGriefing；随后掉 30 经验，若被玩家击杀则在尸位生成苦力怕蛋【原】`onDeath()` + `onDeathUpdate()`；【MB】完全同构。

补充行为：

- 目标选择：原版锁玩家 + **豹猫**（苦力怕怕豹猫的梗反转——它主动猎豹猫）【原】targetTasks；MB 只锁玩家 + 受击反击，且**铁傀儡看不见它**（对铁傀儡可见度为 0）【MB】`getVisibilityMultiplier()`。
- Creeper Minion（小怪）：碰撞箱 0.2×0.8（迷你），HP 4，继承原版苦力怕 AI（膨胀自爆，爆半径默认 2.0），怕豹猫；被蛋孵出后为驯服态（跟随/坐下/帮主人打）【原】`CreeperMinion.java`。
- 雷击本体直接变 charged【原】`onStruckByLightning()`。

## 6. 掉落

- **本体无常规物品掉落**（不重写 `dropFewItems`），只掉 **30 经验**（玩家击杀）【原】`MutantCreeper.java`；【MB】loot table 仅一条：被骷髅射杀 → 掉随机音乐唱片（把原版苦力怕的唱片梗加给了突变体；**原版突变苦力怕没有这条**）【MB】`loot_tables/entities/mutant_creeper.json`。
- **主掉落 = 苦力怕蛋（CreeperMinionEgg，实体而非物品）**：玩家击杀后生成在尸位，记录击杀者为主人【原】`onDeathUpdate()`。
  - 孵化：60–100 分钟（`(60+rand(40))×1200` tick）后孵出**驯服的小苦力怕**（坐下待机）【原】`CreeperMinionEgg.java`；MB 蛋带 powered 继承，孵化时长未逐字核对。
  - 蛋可交互：玩家可以骑蛋、叠蛋（彩蛋）【原】`interactFirst()`。
  - 蛋被打碎（8 HP）：**1/3 概率掉 Creeper Shard，否则掉 5–10 火药**【原】`attackEntityFrom()`；【MB】charged 蛋必掉碎片再碎（`entity/CreeperMinionEggEntity.java`）。
  - 蛋吃爆炸：**不碎，反而加速孵化**（每点爆炸伤害 −80 tick）+ 爱心粒子【原】同上。
- **Creeper Shard（苦力怕碎片，玩具武器）**：堆叠 1、耐久 32、+2 攻击伤害；命中造成大击退（0.9 倍水平速度）且 25% 概率**攻击者自己中毒**；右键在脚下引爆（伤害 5×充能比，满充能 +2）；砍怪每刀回充 1 点【原】`item/CreeperShard.java`。
- 获取碎片/化学 X 的另一条路（生成机制，见 §7）：化学 X 由**黑曜石×4 + 药水**合成（epic 稀有度）【原】`MutantCreatures.java` 配方。

## 7. 生成条件

- **自然生成**：monster 类别，权重 1（极低）、每群 1 只、每 chunk 上限 1 只；群系白名单 = 主世界常规群系 20 余种（plains/desert/forest/taiga/swamp/jungle/雪原等，static 块列举）【原】`MutantCreatures.java`；另有额外门槛 `rand.nextInt(50/spawnrate)==0`，配置 `Spawnrate` 默认 10（钳制 1–20）→ **1/5 放行率**，整体稀有【原】`getRandomSpawnChance()`。
- **【MB】1.16.5**：配置权重 + biome 白名单，排除蘑菇岛/虚空/下界/末地；ON_GROUND + 常规怪物光照规则【MB】`MBEntityType.addSpawns()`。
- **化学 X 突变**：右键投掷 → 命中处随机选中 12×8×12 内一只非突变体生物（直接命中优先）→ SkullSpirit 幽灵缠住 4–6 秒 → 目标死亡（威力 2.0 小爆）→ **50% 概率突变为对应突变体**（苦力怕→突变苦力怕）【原】`item/ChemicalX.java` + `ChemicalXEntity.java` + `SkullSpirit.java`。
- **雷击** → charged 强化变体（见 §5）。

## 8. 与本项目的差异转译建议（本项目判断，非取证）

面向 6 岁儿童（爆炸不拆方块、伤害封顶、零惊吓死局），建议按下表转译：

| 原版机制 | 原版值 | 转译建议 |
| --- | --- | --- |
| 爆炸拆方块 | 跳扑 4/6、终爆 8/12，遵守 mobGriefing | 一律不拆方块：爆炸 = 粒子 + 震屏 + 击退的观赏演出 |
| 伤害封顶 | 近战 4/5，终爆 8/12 | 死亡终爆改「击飞 + 短眩晕」为主，真伤害封顶到本项目玩家上限的小比例；跳扑爆同封顶 |
| 死亡引力圈 | 12–18 格持续吸 5 秒 | 半径缩到 ≤5 格、吸 2 秒停 1 秒给逃跑窗口；总时长缩到 ~3 秒并提前给可爱预告（憋气变白变圆）避免惊吓 |
| 蓄力读条 | 5 秒回 30 HP，打 3–5 次打断 | **保留打断机制**——天然的「打断读条」教学关；打断时闪红 + 音效正反馈；闪电自充能概率改 0（或纯视觉） |
| 召唤小怪 | 满血 4 只、会自爆 | 满血只 1–2 只、只近战不爆炸，HP 用本项目小怪基线 |
| 苦力怕蛋 | 60–100 分钟孵化 | 击杀即掉、短孵化动画（<10 秒）后得驯服小苦力怕，作为 boss 战利品 |
| 体型/模型 | 2.0×2.4 碰撞箱，4 段弓身 + 4 条两节腿 | 比例关系保留（宽扁弓身是辨识度来源）；按 [mc-mob-models-research.md](mc-mob-models-research.md) 的 px 语言重新标部件尺寸适配本项目 Q 版基座 |
| 贴图 | 浅豆绿底 + 亮绿噪点 + 黑绿脸 | 只取 §3.4 三件套配色语言，像素全部自绘（D13 口径） |
