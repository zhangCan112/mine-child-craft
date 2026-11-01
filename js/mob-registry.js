'use strict';
/* ============================================================
   怪物注册表 (MobRegistry, 术语见 GLOSSARY「怪物库」「怪物谱系」) — 引擎层
   ------------------------------------------------------------
   怪物种类清单的唯一权威: 数值表 MOB_TYPES(48 键 = 43 战斗怪 + F4 农场四怪 +
   mix 伪类型) · 谱系两维表 FAMILIES/PROTOS · 击杀掉落表 MOB_DROPS(47 键 =
   43 战斗怪全覆盖 + F4 农场四怪)。
   四表纯数据零函数, 表间零程序性引用(键名的语义关联由 test/mob-registry.test.js
   闭环); 消费方(怪物库 mobs.js · 竞技场 arena.js · 掷骰 drops.js)经共享词法
   环境读全局名, 只派生不复制。2026-10 自 config.js 拆出(架构治理候选 8 T1,
   表内容逐字迁移); TANK 三表仍居 config(拍板缓行, 未来独立 tank-registry 候选)。
   interface: MOB_TYPES / FAMILIES / PROTOS / MOB_DROPS / MobRegistry(命名空间)
   依赖: 零 — 纯数据, 浏览器 defer 与 Node vm/require 同构(加载序任意,
   index.html 置 config 之后紧邻)
   可测性声明: 零 THREE·零 DOM·有单测(test/mob-registry.test.js — 谱系完整性/
   语义钉/掉落表结构/Mobs.types 恒等锚; 表内容逐字迁自 config.js, 迁移基线
   255a57c 经 JSON 恒等对账)
   ============================================================ */

/* ---------- 新怪入谱清单(加一只战斗怪要同步的五处, 漏项由守门测试红提示) ----------
   ① 本文件 MOB_TYPES 数值行(新族再补 FAMILIES 行; proto 取值 ⊆ PROTOS, 谱系
     完整性测试守门)
   ② 本文件 MOB_DROPS 掉落行(战斗怪必填, 漏键 test/mob-registry.test.js 反向
     守门红; 物品 id ⊆ ITEMS 由 test/drops.test.js 交叉断言)
   ③ js/mob-look/<type>.js 造型档案(一怪一文件, 文件名=MOB_TYPES 键, 键集=
     文件集由 test/mob-look.test.js 断言)
   ④ js/modes/arena.js ARENA_POWER 战力行(漏登 unitPower=NaN, test/arena-core.
     test.js 战力完整性反向守门红)
   ⑤ 可选: arena.js 的 FAMILY_SKILLS/MOB_QUIRKS(族技能/个体特化, 不登记=无特技)
   mix 伪类型除外(编队按钮非怪)。收尾 npm test 全绿再交。 */

/* ---------- 怪物数值表 (js/mobs.js 怪物库用; 竞技场与坦克演习场共用) ----------
   数值按 Minecraft 原版等比映射(与初代五怪同口径):
   hp≈原版生命×1.5 · dmg≈原版普通难度伤害×1.6 · speed≈原版移速属性×10
   h/hitR≈原版碰撞箱(高/半宽) — 竞技场配平战力已归位 modes/arena.js(ARENA_POWER)
   旗标: ranged 远程 · boom 自爆 · fly 飞行 · boss Boss级(不进混合编队池) ·
   passive 被动牧场动物(F4 农场一家: spawnable 排除, 不进战斗面板)
   谱系(术语见 GLOSSARY「怪物谱系」): **种族=长相接近的血统组**(用户拍板),
   另允许职责组(守卫组: 不长相近但都是"守卫"); 不按地域/维度分族。
   proto 行为原型(AI 模板位) · family 物种族(有序多标签: 首位=主族=面板归组+
   家传技能发放; 每怪必归种族, 单员族合法; 多族合法 — 僵尸猪灵/僵尸疣猪兽=猪物种+僵尸血统)。
   特有技能: 家传=族共享模板(竞技场 FAMILY_SKILLS) · 个体特化每怪至多一招
   (竞技场 MOB_QUIRKS: 守卫者系蓄力激光 · 末影人颤栗瞬移; 苦力怕扑袭/
   铁傀儡震地/末影龙龙息是移动一体型特化, 留在原型分支) */
const MOB_TYPES = {
  /* —— 僵尸一家(主族 zombie_line, 家传·狂暴) —— */
  zombie: {name: '僵尸', hp: 30, dmg: 5, speed: 2.3, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55,
    proto: 'charger', family: ['zombie_line']},
  husk: {name: '尸壳', hp: 30, dmg: 5, speed: 2.3, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55,
    proto: 'charger', family: ['zombie_line']},
  drowned: {name: '溺尸', hp: 30, dmg: 5, speed: 2.3, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55,
    proto: 'archer', family: ['zombie_line']},
  /* —— 骷髅一家(主族 skeleton_line, 家传·强力箭节奏/节奏重斩) —— */
  skeleton: {name: '骷髅', hp: 26, dmg: 6, speed: 2.6, range: 14, cd: 2.6, h: 1.9, ranged: true, hitR: 0.55,
    proto: 'archer', family: ['skeleton_line']},
  stray: {name: '流浪者', hp: 30, dmg: 6, speed: 2.5, range: 14, cd: 2.8, h: 1.9, ranged: true, hitR: 0.55,
    proto: 'archer', family: ['skeleton_line']},
  bogged: {name: '沼骸', hp: 24, dmg: 6, speed: 2.5, range: 14, cd: 2.8, h: 1.9, ranged: true, hitR: 0.55,
    proto: 'archer', family: ['skeleton_line']},
  wither_skeleton: {name: '凋灵骷髅', hp: 30, dmg: 13, speed: 2.5, range: 2.4, cd: 1.3, h: 2.4, hitR: 0.6,
    proto: 'charger', family: ['skeleton_line']},
  /* 蜘蛛骑士三家(2026-10-31 用户票, 图源官方蜘蛛骑士): 骑手坐在蜘蛛背上的
     复合怪 — 造型一张网(骑手人形骨+蜘蛛基座, 见 mob-look/*_spider_jockey.js),
     数值 = 骑手攻性 + 蜘蛛腿劲(speed/hitR 取坐骑档); 主族 skeleton_line
     (骑手身份领家传, 面板归骷髅一家桶) */
  skeleton_spider_jockey: {name: '骷髅蜘蛛骑士', hp: 32, dmg: 6, speed: 3.0, range: 14, cd: 2.4, h: 2.1, hitR: 0.7,
    ranged: true, proto: 'archer', family: ['skeleton_line']},
  stray_spider_jockey: {name: '流浪者蜘蛛骑士', hp: 36, dmg: 6, speed: 2.9, range: 14, cd: 2.6, h: 2.1, hitR: 0.7,
    ranged: true, proto: 'archer', family: ['skeleton_line']},
  wither_skeleton_spider_jockey: {name: '凋灵骷髅蜘蛛骑士', hp: 48, dmg: 13, speed: 3.0, range: 2.6, cd: 1.2, h: 2.5, hitR: 0.8,
    proto: 'charger', family: ['skeleton_line']},
  /* —— 虫虫族(主族 arthropod, 家传·疾爬突进) —— */
  spider: {name: '蜘蛛', hp: 24, dmg: 3, speed: 3.0, range: 2.2, cd: 1.2, h: 0.9, hitR: 0.65,
    proto: 'ambusher', family: ['arthropod']},
  cave_spider: {name: '洞穴蜘蛛', hp: 18, dmg: 3, speed: 3.0, range: 2.0, cd: 1.1, h: 0.5, hitR: 0.35,
    proto: 'ambusher', family: ['arthropod']},
  silverfish: {name: '蠹虫', hp: 12, dmg: 2, speed: 2.6, range: 1.6, cd: 0.9, h: 0.35, hitR: 0.25,
    proto: 'ambusher', family: ['arthropod']},
  endermite: {name: '末影螨', hp: 12, dmg: 3, speed: 2.6, range: 1.6, cd: 1.0, h: 0.35, hitR: 0.25,
    proto: 'ambusher', family: ['arthropod']},
  /* —— 软软族(主族 slime_line, 家传·分裂) —— */
  slime: {name: '史莱姆', hp: 24, dmg: 6, speed: 2.0, range: 2.2, cd: 1.4, h: 2.0, hitR: 0.55,
    proto: 'splitter', family: ['slime_line']},
  magma_cube: {name: '岩浆怪', hp: 24, dmg: 9, speed: 2.1, range: 2.2, cd: 1.5, h: 2.0, hitR: 0.55,
    proto: 'splitter', family: ['slime_line']},
  /* —— 猪猪一家(主族 pig_line, 家传·蛮冲): 人形猪+野兽猪, 都是猪 —— */
  piglin: {name: '猪灵', hp: 24, dmg: 8, speed: 2.7, range: 2.2, cd: 1.1, h: 1.9, hitR: 0.55,
    proto: 'charger', family: ['pig_line']},
  piglin_brute: {name: '猪灵蛮兵', hp: 75, dmg: 20, speed: 2.6, range: 2.4, cd: 1.3, h: 2.0, hitR: 0.6,
    proto: 'charger', family: ['pig_line']},
  zombified_piglin: {name: '僵尸猪灵', hp: 30, dmg: 8, speed: 2.3, range: 2.2, cd: 1.1, h: 1.9, hitR: 0.55,
    proto: 'charger', family: ['pig_line', 'zombie_line']}, // 双物种血统: 主族领家传, 副族只领分组
  hoglin: {name: '疣猪兽', hp: 60, dmg: 9, speed: 2.8, range: 2.6, cd: 1.5, h: 1.4, hitR: 0.7,
    proto: 'charger', family: ['pig_line']},
  zoglin: {name: '僵尸疣猪兽', hp: 60, dmg: 9, speed: 2.8, range: 2.6, cd: 1.5, h: 1.4, hitR: 0.7,
    proto: 'charger', family: ['pig_line', 'zombie_line']}, // 双物种血统(同僵尸猪灵)
  /* —— 鬼一族(主族 ghost, 家传·阴风): 长相/气质是幽灵飘忽的 —— */
  ghast: {name: '恶魂', hp: 15, dmg: 14, speed: 3.2, range: 16, cd: 3.4, h: 3.4, fly: true, ranged: true, hitR: 1.8,
    proto: 'turret', family: ['ghost']},
  phantom: {name: '幻翼', hp: 30, dmg: 6, speed: 3.5, range: 3.5, cd: 1.3, h: 0.6, fly: true, hitR: 0.45,
    proto: 'diver', family: ['ghost']},
  blaze: {name: '烈焰人', hp: 30, dmg: 8, speed: 2.3, range: 15, cd: 2.4, h: 1.8, fly: true, ranged: true, hitR: 0.45,
    proto: 'turret', family: ['ghost']},
  wither: {name: '凋灵', hp: 450, dmg: 13, speed: 3.8, range: 15, cd: 2.2, h: 3.5, fly: true,
    ranged: true, hitR: 0.9, boss: true, proto: 'turret', family: ['ghost']},
  enderman: {name: '末影人', hp: 60, dmg: 11, speed: 3.0, range: 2.6, cd: 1.2, h: 2.9, hitR: 0.35,
    proto: 'skirmisher', family: ['ghost']}, // 个体特化=颤栗瞬移(模式层 MOB_QUIRKS)
  vex: {name: '恼鬼', hp: 21, dmg: 8, speed: 3.4, range: 3.0, cd: 1.0, h: 0.8, fly: true, hitR: 0.25,
    proto: 'diver', family: ['ghost']},
  /* —— 守卫组(主族 guard, 职责组: 不长相近但都是"守卫"; 家传·磐石) —— */
  golem: {name: '铁傀儡', hp: 110, dmg: 15, speed: 2.0, range: 3.0, cd: 1.6, h: 2.8, hitR: 1.0,
    proto: 'charger', family: ['guard']}, // 个体特化=震地/巨石(原型分支)
  warden: {name: '监守者', hp: 750, dmg: 45, speed: 2.7, range: 3.2, cd: 1.8, h: 2.9, hitR: 0.9, boss: true,
    proto: 'charger', family: ['guard']},
  guardian: {name: '守卫者', hp: 45, dmg: 8, speed: 2.0, range: 13, cd: 2.8, h: 0.9, ranged: true, hitR: 0.6,
    proto: 'turret', family: ['guard']}, // 个体特化=蓄力激光(模式层 MOB_QUIRKS)
  elder_guardian: {name: '远古守卫者', hp: 120, dmg: 13, speed: 1.9, range: 15, cd: 3.2, h: 2.0, ranged: true,
    hitR: 1.0, boss: true, proto: 'turret', family: ['guard']},
  /* —— 灾厄帮(主族 illager, 家传·袭击协同) —— */
  vindicator: {name: '卫道士', hp: 36, dmg: 20, speed: 2.9, range: 2.2, cd: 1.2, h: 1.9, hitR: 0.55,
    proto: 'charger', family: ['illager']},
  evoker: {name: '唤魔者', hp: 36, dmg: 9, speed: 2.2, range: 13, cd: 3.0, h: 1.9, ranged: true, hitR: 0.55,
    proto: 'charger', family: ['illager']},
  pillager: {name: '掠夺者', hp: 36, dmg: 6, speed: 2.4, range: 14, cd: 2.7, h: 1.9, ranged: true, hitR: 0.55,
    proto: 'archer', family: ['illager']},
  ravager: {name: '劫掠兽', hp: 150, dmg: 18, speed: 2.7, range: 2.8, cd: 1.6, h: 2.2, hitR: 1.0,
    proto: 'charger', family: ['illager']},
  witch: {name: '女巫', hp: 39, dmg: 9, speed: 2.5, range: 14, cd: 3.0, h: 2.0, ranged: true, hitR: 0.45,
    proto: 'archer', family: ['illager']}, // raider 圈: 村民的邪恶亲戚(物种归帮, 原版亦此划分)
  /* 幻术师(2026-10-31 用户票, Java 版未实装怪按官方图入册): 弓射+幻术的
     灾厄施法者 — 本游戏取弓手原型(archer), 族内战力居掠夺者与唤魔者之间 */
  illusioner: {name: '幻术师', hp: 36, dmg: 6, speed: 2.5, range: 14, cd: 2.8, h: 1.9, hitR: 0.55,
    ranged: true, proto: 'archer', family: ['illager']},
  /* —— 独行侠已撤销(用户拍板"不要不伦不类的兜底族"): 每怪必归种族, 单员族合法 —— */
  /* —— 草木族(主族 plant): 植物身子的怪(家传三期补) —— */
  creeper: {name: '苦力怕', hp: 28, dmg: 33, speed: 3.1, range: 2.0, cd: 9, h: 1.7, boom: true, hitR: 0.5,
    fuseS: 3, proto: 'bomber', family: ['plant']}, // 个体特化=扑袭+读条取消(原型分支); 引信 3s(用户拍板 2026-10-30 加长——儿童反应窗)
  creaking: {name: '嘎枝', hp: 30, dmg: 5, speed: 3.0, range: 2.2, cd: 1.1, h: 1.7, hitR: 0.5,
    proto: 'skirmisher', family: ['plant']},
  /* 突变巨型苦力怕(副本西翼两巢房小 boss, 2026-10-30 用户拍板; Mutant Creatures
     模组同源怪, 调研底座 docs/mc-mutant-creeper-research.md): 苦力怕谱系中层。
     体型按调研口径(高 ≈1.4 倍 → scale 1.4; 宽 ≈3.3 倍的体感由 hitR 0.7
     补足——本 kit 只做等比 scale); h 3.0 随三轮造型修正抬高(头前伸版
     视觉高 ≈3.1 格, 命中柱与头顶名条跟上——与王同档 2.8→3.0, 横向仍小
     于王 hitR 0.7<1.05);
     模组 HP 120 与本项目苦力怕王同值——转译
     调低到 60(谱系阶梯: 王仍是关底最强, 小 boss 血量 ≈2×常款); 引信 2.5s 与
     自爆半径 2.9 介于常款(3s/2.6)与王(2s/3.4)之间; 对玩家伤害走 ADV_DMG_CAP 封顶 */
  mutant_creeper: {name: '突变巨型苦力怕', hp: 60, dmg: 33, speed: 2.6, range: 2.2, cd: 2, h: 3.0,
    hitR: 0.7, boom: true, boss: true, fuseS: 2.5, boomR: 2.9, proto: 'bomber',
    family: ['plant']},
  /* 苦力怕王(副本关底 boss, 2026-10-30 用户拍板): 放大版苦力怕——同 bomber 原型
     (引信自爆), 更厚的血(120)与更大的自爆半径; 引信 2s 比常款(3s)更果断——
     王不犹豫; 对玩家伤害仍走 ADV_DMG_CAP 封顶。
     造型 2026-10-31 王者威仪版(用户拍板): 体型=常款整 2 倍(look scale 2.0,
     旧 1.6)+全套冠冕(金箍带/四角尖桩/红宝石)+紫底金边王披风; 视觉身高
     ≈3.25 格、冠尖到 ≈3.9 格——h 3.5=命中柱(箭矢可中头部/冠下), 名牌
     (h+0.55≈4.05)恰在冠尖之上不被遮挡 */
  creeper_king: {name: '苦力怕王', hp: 120, dmg: 33, speed: 2.1, range: 2.6, cd: 1.6, h: 3.5,
    hitR: 1.05, boom: true, boss: true, fuseS: 2, boomR: 3.4, proto: 'bomber',
    family: ['plant']},
  /* —— 龙族(主族 dragon, 单员族): 家传无(龙息即本体特化, 原型分支) —— */
  dragon: {name: '末影龙', hp: 300, dmg: 7, speed: 4.4, range: 17, cd: 4.5, h: 3.0, fly: true, hitR: 2.2, boss: true,
    proto: 'diver', family: ['dragon']},
  /* —— 海族(主族 sea, 单员族): 贝壳身子(家传无, 追踪弹特化三期补) —— */
  shulker: {name: '潜影贝', hp: 45, dmg: 6, speed: 0.3, range: 15, cd: 3.0, h: 1.0, ranged: true, hitR: 0.5,
    proto: 'turret', family: ['sea']},
  /* —— 农场一家(主族 farm_line, 二期设计稿 §4.1): 被动牧场动物 —
     passive 旗标=不可战斗部署(spawnable 收窄排除, 竞技场/演习场零影响);
     数值 hp≈MC 生命×1.5 同折算惯例 · range/cd 归零(不攻击) ·
     恐惧游荡归模式层(advHerdTick), 游荡归 Mobs 通用本能 —— */
  cow: {name: '牛', hp: 15, dmg: 0, speed: 1.4, range: 0, cd: 0, h: 1.3, hitR: 0.7,
    passive: true, proto: 'grazer', family: ['farm_line']},
  pig: {name: '猪', hp: 15, dmg: 0, speed: 1.3, range: 0, cd: 0, h: 0.9, hitR: 0.6,
    passive: true, proto: 'grazer', family: ['farm_line']},
  sheep: {name: '羊', hp: 12, dmg: 0, speed: 1.2, range: 0, cd: 0, h: 1.2, hitR: 0.65,
    passive: true, proto: 'grazer', family: ['farm_line']},
  chicken: {name: '鸡', hp: 6, dmg: 0, speed: 1.5, range: 0, cd: 0, h: 0.7, hitR: 0.35,
    passive: true, proto: 'grazer', family: ['farm_line']},
  /* —— 伪类型: 竞技场混合编队按钮(种类池在 modes/arena.js 动态生成, 不带谱系) —— */
  mix: {name: '混合编队', hp: 0, dmg: 0, speed: 0, range: 0, cd: 0, h: 2},
};

/* ---------- 怪物谱系注册表(数值表的两张维度表, 术语见 GLOSSARY「怪物谱系」) ----------
   FAMILIES: 种族展示注册表 — 种族=长相接近的血统组(守卫组是唯一职责组例外);
             name=孩子叫法(面板组头) · order=展示顺序; **无兜底族**(独行侠已撤):
             每怪必归种族, 单员族合法(龙族/海族); 未注册键由怪物库兜底键名不丢桶。
   PROTOS: 行为原型合法值(战斗 AI 模板位, 分期③的原型化分发键)。 */
const FAMILIES = {
  zombie_line: {name: '僵尸一家', order: 1},
  skeleton_line: {name: '骷髅一家', order: 2},
  arthropod: {name: '虫虫族', order: 3},
  pig_line: {name: '猪猪一家', order: 4},
  ghost: {name: '鬼一族', order: 5},
  guard: {name: '守卫组', order: 6},
  illager: {name: '灾厄帮', order: 7},
  slime_line: {name: '软软族', order: 8},
  plant: {name: '草木族', order: 9},
  dragon: {name: '龙族', order: 10},
  sea: {name: '海族', order: 11},
  farm_line: {name: '农场一家', order: 12}, /* F4 被动动物: spawnable 排除 passive → 面板无桶, 注册仅供谱系完整性 */
};
/* grazer = 「无战斗」原型占位(F4 牧场动物): 游荡归 Mobs 通用本能, 竞技场族技能表无 farm_line 条目即不发技能 */
const PROTOS = ['charger', 'archer', 'bomber', 'ambusher', 'diver', 'turret', 'splitter', 'skirmisher', 'grazer'];

/* ---------- 怪物掉落表 (物品与合成一期起, 设计稿 §3.3) ----------
   儿童配平: 击杀必得保底数, 再以 50% 掷「加成次数」次(替代 MC 66%×0-2 的空手可能)。
   rolls: [itemId, 保底, 加成次数] · rare: [itemId, 概率](独立小概率额外掉落)。
   43 战斗怪全覆盖(2026-11-01 retro 按族补齐, 漏键由 test/mob-registry.test.js 反向守门红):
   同族照族内既有口径(僵尸一家→腐肉 · 骷髅一家→骨 · 虫虫族→线 · 软软族→粘液球); F4 农场四怪照二期设计稿 §4.5。
   2026-11-01 拍板: 12 只代位怪升级为正典物品(末影珍珠/烈焰棒/下界之星等, 注册见 items-core.js,
   逐条正典取证 docs/mc-mob-drops-research.md)——rolls=正典常规掉落(0-1·50% 型折算保底1+50%加成1),
   rare=正典稀有掉落(铜锭 11% 直录, 金锭 2.5%→5% 同僵尸铁先例); 凋灵/末影人代位期附加件
   (骨×4/5% 钻石)退役=正典纯净拍板。正典零掉落七怪(蠹虫/末影螨/恼鬼/猪灵双怪/幻术师/嘎枝)
   照族口径掉落维持——保底≥1 是结构守门(「儿童不空手」, 测试断言在案), 拍板不破例。
   消费者: Drops.rollDrops(T7) — 掷骰语义在此表, 表只存数据。 */
const MOB_DROPS = {
  zombie: {rolls: [['rotten_flesh', 1, 1]], rare: [['iron_ingot', 0.05]]}, // MC 稀有铁锭 0.83% → 5%(§3.1)
  /* 僵尸一家照僵尸口径(腐肉+5% 稀有铁锭) */
  husk: {rolls: [['rotten_flesh', 1, 1]], rare: [['iron_ingot', 0.05]]},
  drowned: {rolls: [['rotten_flesh', 1, 1]], rare: [['copper_ingot', 0.11]]}, // MC 铜锭稀有 11%(玩家击杀, 每级抢夺+2%, 本游戏无抢夺)→11% 直录(2026-11-01 转正, 原铁锭代位退役)
  skeleton: {rolls: [['bone', 1, 1]]}, // 箭二期(弓物品化)
  /* 骷髅一家照骷髅口径(骨, 箭同骷髅二期不设); 凋灵骷髅加 MC 煤(双条目同蜘蛛骑士先例) */
  stray: {rolls: [['bone', 1, 1]]},
  bogged: {rolls: [['bone', 1, 1]]},
  wither_skeleton: {rolls: [['bone', 1, 1], ['coal', 1, 1]]},
  creeper: {rolls: [['gunpowder', 1, 1]]},
  /* 苦力怕王战利品(用户拍板 2026-10-30): 保底 10 火药(0 加成——「更多火药」整数口径)
     + 稀有掉落必得钻石剑(概率 1, 副本唯一钻石剑产地之外的惊喜出口) */
  creeper_king: {rolls: [['gunpowder', 10, 0]], rare: [['sword_diamond', 1]]},
  /* 突变巨型苦力怕战利品(副本小 boss, 2026-10-30 用户拍板): 掉落阶梯居中——
     保底 4 火药+50%×2 掷(4~6, 高于常款 1~2, 低于王 10); 25% 稀有铁锭是小 boss
     的额外甜头, 不动王「必得钻石剑」的唯一性 */
  mutant_creeper: {rolls: [['gunpowder', 4, 2]], rare: [['iron_ingot', 0.25]]},
  creaking: {rolls: [['stick', 1, 2]]}, // MC 原版无掉落; 木头身子→木棍读法
  spider: {rolls: [['string', 1, 1]]},
  /* 虫虫族照蜘蛛口径(线); 蜘蛛眼 2026-11-01 转正(洞穴蜘蛛加掉); 蠹虫/末影螨正典零掉落——族口径维持(保底≥1 守门, 拍板不破例) */
  cave_spider: {rolls: [['string', 1, 1], ['spider_eye', 1, 1]]}, // MC 线 0-2·66.67% + 蜘蛛眼 0-1·33.33%(玩家击杀)→眼折算保底1+加成1
  silverfish: {rolls: [['string', 1, 1]]},
  endermite: {rolls: [['string', 1, 1]]},
  /* 蜘蛛骑士三家(2026-10-31): 骑手掉骨 + 坐骑掉线 — 一怪双掉落 */
  skeleton_spider_jockey: {rolls: [['bone', 1, 1], ['string', 1, 1]]},
  stray_spider_jockey: {rolls: [['bone', 1, 1], ['string', 1, 1]]},
  wither_skeleton_spider_jockey: {rolls: [['bone', 1, 1], ['string', 1, 1]]},
  slime: {rolls: [['slimeball', 1, 1]]}, // MC 粘液球 0-2·66.67%(现行 wiki 无玩家击杀标注——仅经验条目需要, 勘误 2026-11-01 见调研 §5)
  magma_cube: {rolls: [['magma_cream', 1, 1]]}, // MC 岩浆膏 0-1·25%(中大型, 非青蛙击杀)→保底1+加成1(2026-11-01 转正, 原粘液球代位退役)
  /* —— 猪猪一家战斗五怪(人形猪按随身金饰读法, 野兽猪照猪掉肉; 僵尸血统带腐肉) —— */
  piglin: {rolls: [['gold_ingot', 1, 1]]}, // MC 原版无掉落; 金甲金剑的金缘读法, 儿童不空手
  piglin_brute: {rolls: [['gold_ingot', 2, 1]]}, // 精英档: 保底 2 居猪灵与 boss 之间
  zombified_piglin: {rolls: [['rotten_flesh', 1, 1], ['gold_nugget', 1, 1]], rare: [['gold_ingot', 0.05]]}, // MC 腐肉 0-1+金粒 0-1+稀有金锭 2.5%(玩家击杀)→金粒转正保底1+加成1, 金锭 5% 同僵尸铁先例; 腐肉随僵尸血统
  hoglin: {rolls: [['raw_porkchop', 2, 1]]}, // MC 生猪排 2~4 → 保底 2+加成 1
  zoglin: {rolls: [['rotten_flesh', 1, 2]]}, // MC 腐肉 1~3
  /* —— 鬼一族(MC 族内无统一掉落, 逐怪按原版物品找注册代位) —— */
  ghast: {rolls: [['gunpowder', 1, 1], ['ghast_tear', 1, 1]]}, // MC 火药 0-2 + 恶魂之泪 0-1(无抢夺扩量)→泪转正保底1+加成1(原「泪未做」补齐)
  phantom: {rolls: [['phantom_membrane', 1, 1]]}, // MC 幻翼膜 0-1·50%(玩家击杀)→保底1+加成1(2026-11-01 转正, 原皮革代位退役)
  blaze: {rolls: [['blaze_rod', 1, 1]]}, // MC 烈焰棒 0-1·50%(玩家击杀)→保底1+加成1(转正; 燃料 12 件=§3.3 二期划档落地, 原煤炭代位退役)
  wither: {rolls: [['nether_star', 1, 0]]}, // MC 下界之星必得(无论死法)→boss 整数口径必得 1; 代位期骨×4+钻石奖杯退役(正典纯净拍板)
  enderman: {rolls: [['ender_pearl', 1, 1]]}, // MC 末影珍珠 0-1·50%→保底1+加成1(转正); 代位期铁锭+5% 稀有钻石退役(正典纯净拍板)
  vex: {rolls: [['iron_nugget', 1, 1]]}, // MC 原版无掉落; 铁剑小妖→铁粒小件(铁锭 1/9)
  /* —— 守卫组(铁傀儡是 MC 原版铁锭大户; 监守者按 boss 整数口径) —— */
  golem: {rolls: [['iron_ingot', 3, 2]]}, // MC 铁锭 3~5
  warden: {rolls: [['iron_ingot', 5, 0]], rare: [['diamond', 1]]}, // boss 整数口径; MC 幽匿催发体(未注册)→必得钻石奖杯
  guardian: {rolls: [['prismarine_shard', 1, 1], ['prismarine_crystals', 1, 1]]}, // MC 碎片 0-2·66.67%+砂粒 0-1·40%→双件各保底1+加成1(2026-11-01 转正, 原铁粒代位退役; 鳕鱼/随机鱼组件不扩, 调研 §2 在案)
  elder_guardian: {rolls: [['prismarine_shard', 2, 1], ['prismarine_crystals', 1, 1]]}, // 小 boss 阶梯: 碎片保底 2(守卫者 2 倍口径沿用); MC 砂粒 33.33%/湿海绵必得(海绵方块件不扩)——原铁粒代位退役
  /* —— 灾厄帮(MC 掉落物多未注册, 按帮派随身物件代位) —— */
  vindicator: {rolls: [['iron_ingot', 1, 1]]}, // MC 铁斧 8.5%(工具不作怪掉, 王的钻石剑是唯一例外)→铁锭代位
  evoker: {rolls: [['gold_ingot', 1, 1]]}, // MC 绿宝石+不死图腾(均未注册)→金锭代位
  pillager: {rolls: [['iron_nugget', 1, 2]]}, // MC 偶掉弩(未注册)→铁粒小件
  ravager: {rolls: [['leather', 2, 1]]}, // MC 鞍(未注册)→皮革代位(兽皮读法)
  witch: {rolls: [['glass', 1, 1]]}, // MC 玻璃瓶(红石/糖未注册)→玻璃代位
  illusioner: {rolls: [['iron_nugget', 1, 1]]}, // MC 未实装无官方掉落→掠夺者同款(帮派口径)
  /* —— 龙族/海族(单员族, MC 掉落物未注册代位) —— */
  dragon: {rolls: [['gold_ingot', 4, 0]], rare: [['diamond', 1]]}, // boss 整数口径; 龙之宝库读法, MC 龙蛋(未注册)→必得钻石奖杯
  shulker: {rolls: [['shulker_shell', 1, 1]]}, // MC 潜影壳 0-1·50%(页源 dropchance=0.5, 每级抢夺+6.25%)→保底1+加成1(2026-11-01 转正, 原黏土球代位退役)
  /* F4 农场一家(二期设计稿 §4.5, 儿童配平「保底 1+50%+1」沿用): 生肉+副产物 */
  cow: {rolls: [['raw_beef', 1, 1], ['leather', 1, 1]]},
  pig: {rolls: [['raw_porkchop', 1, 1]]},
  chicken: {rolls: [['raw_chicken', 1, 1], ['feather', 1, 1]]},
  sheep: {rolls: [['wool', 1, 1], ['raw_mutton', 1, 1]]},
};

/* CommonJS 导出守卫(mode-registry/audio-registry 同款): 浏览器经典脚本共享词法
   环境, 顶层 const 即全局, 供消费方直接引用; Node 下仅测试消费, 挂 module.exports */
const MobRegistry = {MOB_TYPES, FAMILIES, PROTOS, MOB_DROPS};
if (typeof module !== 'undefined' && module.exports) module.exports = MobRegistry;
