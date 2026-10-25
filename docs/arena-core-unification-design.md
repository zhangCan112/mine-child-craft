# 竞技场剥核设计定稿（arena-core unification）

> 架构治理候选 3（竞技场剥 arena-core）的拍板记录与交付清单。
> 评审入口：2026-10-24 架构评审（improve-codebase-architecture 流程，HTML 报告）卡 3；
> 相关词条：GLOSSARY「竞技场核心（ArenaCore）」（随票扩至终态）及随票修订的「竞技场」「怪物谱系」；
> 前序挂账：候选 1（训练营壳 camp-kit，docs/camp-kit-unification-design.md）与候选 2（纯函数共享基座，
> docs/camp-core-unification-design.md）已就位；剥核先例 S1（world→mesh-core / tank→tank-core /
> mobs→mob-core / adventure→adventure-core）；
> 切票 C3-T1～T4 与存量缺陷修复已合入，C3-T5 为本收尾票（拍板记录 + GLOSSARY 终态修订）。
> 日期：2026-10-25 · 状态：已交付。

## 背景与证据

交接评审报告卡 3 的证据摘要：js/modes/arena.js 剥核前 **1625 行**（git 实测，ac487c7~1），
全仓最大文件且**零直测**（唯一安全网是 boot 全链冒烟——THREE/DOM 重的壳按 conventions
§1.9 口径不强制直测，但纯段没剥出来就一起没了直测）。评审对它的定位是**五段纯政策**藏在
观感编排里，全部可离线断言：

- **常数值表**：ARENA 几何 · HOTBAR 选块物品栏 · ARENA_POWER 配平战力 · ID_* 地形方块别名 ·
  TIER_MULT/TIER_NAME 晋升档位 · COUNTER 克制关系 · FLY_KNOCK_R/FLY_ORBIT_R 飞行边界两档 ·
  MAX_MOBS 数量上限——数值与口径的权威数据源；
- **配平与编队池**：unitPower/teamPower/balanceTeams 配平算术 + MIX 池构造与抽取（IIFE 惰性求值）；
- **晋升**：promoThresholds 阈值公式 · killCredit 信用判定 · teamHpFrac 队伍占比 ·
  comebackMult 翻盘系数 · levelUp 数值半（档位系数/体型/名牌放大）；
- **家传技能 tick 族**：rage/burst/charge/guard/blink/raid 六件的门控与冷却系数（决策半，
  不含观感）+ FAMILY_SKILLS/MOB_QUIRKS 两张声明式表与分发；
- **索敌权重**：retarget 的克制/残血/粘性/个体偏好/对空不可达/龙偏好权重序。

另有两段**状态×观感交织段**（tickLaserCharge 蓄力激光、弹道/挂件装配）评审同样识别为
留壳面。行号证据按各票提交正文记录的「改造前行号」（T1 用剥核前快照，T2/T3/T4 各用前一票
落点后的快照，以函数名定位为准）。

## 拍板决策

**① 新文件 js/arena-core.js 走 adventure-core 档（config/voxel/scene-kit 经全局名调用期解析）；
索敌权重是玩法概念，归应用层 core、不进 mob-core/combat-core。**

- **依赖档**：ARENA 中心在加载期读 config 的 WORLD_W/WORLD_D 折半派生；地形段 generate 的
  hashRand/setBlockRaw（voxel.js）与 SceneKit.tree（scene-kit.js）在调用期经全局名解析；
  familyMain 主族折算调用期读 MOB_TYPES（config.js）。三件加载序均在前（index.html:276
  arena-core.js 先于 index.html:277 的 js/modes/arena.js，config/voxel/scene-kit 更早），
  Node 测试先载三件再 require 被测核心（adventure-core 同款 vm 档）。**零 Mobs 依赖**——
  编队池的 spawnable 清单与 MOB_TYPES 由壳注入，core 不读 Mobs 全局。
- **引擎层 vs 应用层归属判断**：证据报告的论证落点即既有词条划界——mob-core 词条口径
  「战斗 AI、阵营、晋升在模式层」，combat-core 词条 _Avoid_「AI 核心（它不懂战术与阵营）」。
  retarget 的权重全读竞技场独有概念（COUNTER 克制表、晋升档位、龙的猎杀偏好、地面近战摸
  不到飞行）：进 mob-core 就是引擎层知道「竞技场的克制关系」，进 combat-core 则把弹道数学
  核心（leadAim/stepShot 纯几何）变成玩法政策杂物抽屉。权重序归应用层 arena-core，
  mob-core/combat-core 零改动；「战斗核心」词条经核对无表述冲突，不另改。

**② 快照→意图统一信封（writes/tint/buff/shock/tp/fx·sfx 标签，壳 landSkill 一处落回）——
T4 落地时超出票面最小形的决策。**

T3 票面的快照→意图是「轻段」最小形：retarget/raidTick/splitReq/decayTimers/battleEnd 各自
定义意图形状（返回字段新值、队列条目或判定结果），壳逐件落回。T4 迁家传 tick 族时拍板把
意图形状**统一成信封**：决策半只产出纯数据标签——writes=字段直写表 · tint=持久色（白名单）·
buff/buffT=按 id 清单群体写 rageBuffT · shock=冲击波 AoE 参数（壳施放）· tp/steerYaw=瞬移
三连参数（壳走 Mobs 意图 API）· fx/sfx=观感标签（参数表在壳，决策不进 core）。键可缺省，
返回 null=本拍无事。收益：tick 可直测到「意图形状」粒度、新技能 = 技能表一行 + 壳零改动；
代价：T3 的 raidT 形状作为兼容分支并入 landSkill 首段（迁移窗口零行为差）。超出票面的理由：
五件 tick 各自带群体写/持久色/AoE/瞬移，不统一信封就会长出五种局部意图形状，先立信封一次
到位。

**③ tickLaserCharge 拍板永久留壳 + MOB_QUIRKS laser 旗标缝。**

守卫者系蓄力激光是本候选**收益/风险比最差**的剥离对象：状态机（laserT 三态：-1 空闲/
蓄力中/蓄满放束）×三类意图（位移 steer 锁定转向/伤害 damageMob/观感 pulseTint 白闪渐强 +
Fx.beam）逐帧交织——起手在移动层（moveRanged 定桩）、打断在节拍层（staggerT 硬直）、
放束回写 attackCd/attackT。快照化会把状态机拆成「快照半 + 意图半」而每半都还要逐帧观感
落回，拆完壳并不变薄。处置：技能表仍声明式完整——MOB_QUIRKS 以 **laser:true 旗标**表达，
壳 familyTick 查旗标调本地 tickLaserCharge，新激光怪 = 表行加旗标；壳内头注释登记
「拍板永久留壳（C3-T4）」。

**④ 存量缺陷修复链（51d2a2c）——「迁移不夹带修复」纪律与「缺陷不搁置」的平衡示范。**

- **发现**：T3 机械迁移 tickRaid 时发现存量缺陷——e160d46（2026-10-22 怪物谱系落地）起，
  协同重数每到拍读 TIER_MULT[m.level].dmg 而表只有 2/3 档：灾厄帮（illager 系）阵容里
  level=1 的怪（出生默认档）开战 ~0.4s 内（raidT 初值 Math.random()*0.4）必 TypeError，
  炸断竞技场帧循环。
- **迁移票处置**：照搬不修（恒等声明不被修复污染），单测 **assert.throws 显式钉住该缺陷
  行为**，提交正文登记「修复归后续票，修复票翻红即见」。
- **修复票**（51d2a2c，候选内跟进）：TIER_MULT 补第 1 档 {hp:1, dmg:1, spd:1}——与
  dmgMult 出生初值 1 及「晋升系数 × 协同加成」语义对齐（独狼 1.0 / 双人组 1.06）；
  levelUp 只在 ++ 后读 ≥2 档、mobSpeed 用 ===2/===3 判断不索引表，均不受影响；TIER_NAME
  维持 2/3（基础档无名号，晋升 toast 才报名）。原 assert.throws 登记件改为修复断言，
  档位表断言扩为 1/2/3 三档。
- **纪律价值**：缺陷被测试显式钉住（存在性可断言、修复翻红即见）、修复独立成票可单独
  回滚、迁移 diff 的逐字恒等声明保持可信——「迁移不夹带修复」与「缺陷不搁置」同时成立。

**⑤ rage 群体冲锋跨阵营口径照搬（原实现无 team 过滤，测试钉住，改口径另开票）。**

rageTick 的群体冲锋 buff 收集只按「同族 zombie_line + 距离 + 存活」过滤，**无 team 过滤**——
附近敌我僵尸一家都会吃到 rageBuffT 冲锋加成。这是 e160d46 家传技能落地以来的原口径，T4
机械迁移照搬并以单测钉住（「群体冲锋跨阵营」用例）；改成同阵营过滤是行为面变化（对战
平衡会动），不属重构票领地，登记待另开票拍板。

**⑥ 编队池惰性化（core 零 Mobs 依赖）+ 配平三件套去状态直写。**

- MIX 三份 IIFE/reduce 改 core 构造纯函数（mixPool/mixAvgPower/mixBuckets/pickMix，rand
  可注入）；壳保加载期一次性求值与顶层 const 名（MIX_POOL/MIX_AVG_POWER/MIX_BUCKETS/
  MIX_FAMS）——Mobs.spawnable() 的加载期调用留壳，测试用假清单直造编队池。
- balanceTeams 从「直写 to.count + 读 lastEdited」改 balanceTeams(from, to, mixAvg) 返回
  新 count（钳 1..MAX_MOBS）；壳保 lastEdited 选边与写回——autoBalance/lastEdited/
  teamInitHp **会话状态留壳**（unitPower/teamPower 同款薄委托传 MIX_AVG_POWER）。
- teamHpFrac/killCredit/promoThresholds 同口径：状态读改入参、直写改返回值，壳侧口径
  （死者信用照累计、存活才升级）逐分支等价。

## 升格与 ADR 判断（conventions §1.10 / §1.11）

本候选**不触发升格、不写 ADR**，口径同候选 1/2：无新约定——adventure-core 档遵循既有
seam 先例，快照→意图统一信封遵循「纯核心零副作用、到点驱动归调用方」既有口径（触控手势
核心 / CombatCore.stepShot 同判例）；不满足 §1.10「清单 ≥3 处 + 手滑必炸」升格判据（信封
是 core↔壳一对一契约，不是跨文件清单约定）；纯重构可逆——壳内 ArenaCore.* 直引改回本地
函数体即回滚，加载序回滚即删行，缺陷修复是一行表值补档可逆。本文件即 §1.11 文档三段式
的 -design.md 段；GLOSSARY 收词走 §1.8 判据（T1 已建词条，本票改写终态）。

## 交付清单

终态 js/arena-core.js = **534 行**（git 实测），IIFE 命名空间 + 尾部 CommonJS 守卫，出口
**58 件**：常数表 19 · 纯函数 34（叶子 6 / 地形 3 / 编队池 4 / 配平晋升 6 / 快照→意图 8 /
tick 族与结算 7）· 技能表 2 · 分发 3。js/modes/arena.js = **1435 行**（剥核前 1625，净减
190；票面速记 −189 系行尾计数差，以 git 实测为准）。

- **C3-T1**（ac487c7）常数表 + 叶子纯函数（原 arena.js 行号）：ARENA 几何 L7-13（cx/cz 由
  config WORLD_W/WORLD_D 加载期折半派生）· HOTBAR L16 · ARENA_POWER L21-29 ·
  ID_GRASS..ID_LAMP L33-34 · TIER_MULT/TIER_NAME L114-115 · COUNTER L117-122 ·
  FLY_KNOCK_R/FLY_ORBIT_R L249-251 · MAX_MOBS L1336；angleLerp L172-177 · mobSpeed
  L178-189 · tierStars/tierHot L206-209 · comebackMult L433-436（参数化为双方血量占比）·
  fusingCreeperNear L619-631（参数化为读条清单）。index.html +1 行；test/arena-core.test.js
  12 用例（装载器 adventure-core 档：vm 先载真 config，全局名桥主域，require 被测核心；
  几何派生用换桩重载证明非硬编码）。测试 924 → **936**。
- **C3-T2**（3d9f867）参数化即纯段（T1 后快照行号）：floorBlock/wallBlock（原 L10-21）与
  generate（L22-55）地形段整体迁 core · MIX_POOL/MIX_AVG_POWER/MIX_BUCKETS/pickMix
  （L68-85）改构造纯函数 · teamHpFrac（L376-382）· addKillCredit 判定半（L401-406）·
  unitPower/teamPower/balanceTeams（L1276-1287）· queueTeam 内晋升阈值两行（L1315-1316）→
  promoThresholds(ec)。签名对照：unitPower/teamPower → (cfg, mixAvg)；balanceTeams →
  (from, to, mixAvg) 返回新 count；killCredit(kills, credit, level, k2, k3) → {kills, ups}；
  teamHpFrac(roster, team, initHp)。+9 用例（共 21），装载器扩 config+voxel+scene-kit
  三件（adventure-core 同款）。测试 936 → **945**。
- **C3-T3**（ba7831e）快照化·轻段（T2 后快照行号）：retarget 索敌权重 L689-713 · tickRaid
  L599-609 · splitDeath 决策半 L667-674 · tickTimers 递减半 L521-535（13 字段）·
  checkBattleEnd 判定半 L495-505 · rangedVolley 节奏除数 L214 · moveMelee 重斩拍 L893 ·
  damageMob 阴风判定 L172-173。壳新增 collectCandidates（每帧候选快照，retarget/raidTick/
  awardKillPlan 共用，分裂新生儿同帧入册；collectFusing 同款防 O(n²)）。+8 用例（共 29），
  含 tickRaid 缺陷 assert.throws 登记件（处置链见拍板④）。测试 945 → **953**。
- **fix**（51d2a2c）存量缺陷修复：TIER_MULT 补第 1 档基础系数 {1,1,1}（处置链见拍板④）；
  原 assert.throws 件改修复断言（独狼 1.0 / 双人组 1.06），档位表断言扩 1/2/3 三档。
  测试 **953** 不变（改件 + 扩档不加数），未动 arena.js。
- **C3-T4**（2e7335d）家传技能 tick 族 + 技能表（T3 后快照行号）：tickRage L538-553 ·
  tickBurst L556-565 · tickCharge L569-580 · tickGuard L583-595 · tickBlink L633-651 ·
  levelUp 数值半 L350-356（含 applyTierVisual 的 tierScale/labelScale 公式）· awardKill
  决策半 L324-341 · FAMILY_SKILLS/MOB_QUIRKS/familyMain/familyTick/familyOnDead（L36-77）
  声明式迁移（tick 直引 core 函数，无加载序问题）。壳薄包装保留：familyTick（建 20 字段
  tick 快照 → core 分发 → landSkill 落回）/ familyOnDead（数存活 + push pendingSplits）/
  SKILL_FX 观感参数表 / landSkill（信封落回，含 raidT 形状 T3 兼容分支）/ awardKill（状态
  门 + find 落回）/ levelUp（意图 API 施放序 + toast）/ applyTierVisual（挂件装配）/
  tickLaserCharge（永久留壳，拍板③）。+7 用例（共 36）。测试 953 → **960**。
- **C3-T5**（本票）：本文件 + GLOSSARY 终态修订——「竞技场核心」词条改写终态（四期范围句
  去掉、interface 全清单、adventure-core 档依赖说明、_Avoid_ 扩 tickLaserCharge 与索敌权重
  划界）；「竞技场」词条补「政策与数值段在 js/arena-core.js，壳只留观感/编排/装配」口径句；
  「怪物谱系」词条技能表归属从「在竞技场模式层」改为「在 js/arena-core.js（2026-10 迁入）」；
  「战斗核心」词条核对无表述冲突（_Avoid_「AI 核心——它不懂战术与阵营」已是划界），不改。

**量化（git 实测行数，含空行）**：arena.js 1625 → 1562（T1）→ 1501（T2）→ 1493（T3）→
1493（fix 未动 arena.js）→ **1435**（T4，净减 190）；arena-core.js 0 → 125 → 255 → 371 →
375 → **534**；test/arena-core.test.js 0 → **612 行 / 36 用例**。**mode-registry 模式注册表
的 arena 条目无变化**（{id:'arena', name:'竞技场', gated:true, mood:'battle'}，
js/mode-registry.js:18）——剥核是壳内核，模式接口/卡片/加载位零改动，index.html 仅 +1 行。

## 行为面影响登记（诚实口径）

恒等为主，两处例外逐条登记：

1. **tickRaid level=1：从开战 0.4s 必炸变为正常**（fix 51d2a2c）——原实现灾厄帮 level=1 怪
   到拍即 TypeError 炸断帧循环（不可玩路径），补基础档后 dmgMult 从 1.0 起算协同（独狼 1.0 /
   双人组 1.06）。这是缺陷修复面，不是重构引入的差异。
2. **索敌候选改帧首快照的一帧内 skew**（T3 已登记）——原实现逐怪在 updateMobs 循环内即时
   读同帧先更新者的新位姿，现统一读帧首 collectCandidates 快照；权重序不变，一帧内
   （60fps ≈ 16ms）位姿差属噪声。
3. **其余恒等**：五 tick 的门控/冷却系数/公式逐字迁移（含 rage 跨阵营原口径与 guard 40%
   跌破边界）；信封落回顺序（writes→tint→buff→fx→sfx→shock→tp）与原实现同帧等效；
   levelUp 的 setMaxHp→heal（新上限 20%）→dmgMult/invulnT 施放序不变；配平算术与 MIX
   同公式同顺序；generate 逐字节等价（ID_*/ARENA 在 core 内回归本名）——由既有安全网
   断言全绿背书。

## 测试与守门

- **新增**：test/arena-core.test.js **0 → 36 用例**（T1 12 / T2 9 / T3 8 / T4 7）——常数表
  对 config 注册表的存在性与单调（几何换桩重载证明派生 / HOTBAR 铁锹哨兵与方块槽 /
  ARENA_POWER 全键都在 MOB_TYPES / ID_* 恒等 / TIER_MULT 三档与单调 / COUNTER 键值都在）；
  配平算术与入参不变性 / promoThresholds 钳位扫描（ec=1/4/7/10/100）/ killCredit 连跳 /
  teamHpFrac 空清与满血 / mix 族假清单构造与 rand 注入 / generate 两次生成逐字节一致；
  快照→意图段小假 roster 直测（索敌权重序把距离构造放进「无加成必输、有加成必赢」区间 /
  raidTick 计数与 dmgMult 公式〔含 level=1 修复断言〕/ splitReq 边界 / decayTimers 全字段 /
  battleEnd 四分支 / 节奏两件阈值 / ghostChill）；tick 族信封形状（rage 血线与跨阵营 /
  burst·charge 距离门与档位冷却 / guard 跌破口径 / blink rand 注入与场内圆钳制 /
  levelUpIntent 两跳公式 / awardKillPlan 敌对口径与苦力怕特权）+ 技能表完整性（tick 直引 /
  laser 旗标 / 豁免形键集）与 familyTick 路由 / familyOnDead / familyMain（装载器补桥
  MOB_TYPES）。
- **既有安全网**：boot 全链冒烟零改动全绿（arena-core.js 装载即在 index.html 真序链上，
  专抓共享词法环境顶层重名/炸错）；竞技场既有断言零改动。
- **增长账**：924 → 936（T1 +12）→ 945（T2 +9）→ 953（T3 +8）→ 953（fix 改件）→
  **960**（T4 +7），零 fail；ESLint / Stylelint / htmlhint 三 lint 零错。

## 遗留与后续钩子

- **tickLaserCharge 永久留壳**（拍板③）：壳内头注释已登记；除非未来把「蓄力型技能」整体
  重设计，不再评估剥离。
- **rage 群体冲锋跨阵营口径**（拍板⑤）：测试钉住现状；改同阵营过滤是行为面变化（对战
  平衡），另开票拍板。
- **retarget 帧首快照 skew**（T3 登记）：一帧内位姿差属噪声，不治理；若未来 updateMobs
  改并行化，此口径天然消失。
- **mode-registry 无变化声明**：本候选不动模式接口——「新模式 = index.html 卡/页/script +
  mode-registry 加行」的注册口径与竞技场条目零交集，剥核不产生新模式注册面。
