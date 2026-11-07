'use strict';
/* ============================================================
   探险核心 (AdventureCore) — 应用层·纯核心
   ------------------------------------------------------------
   探险模式的政策与地形核心(js/modes/adventure.js 的纯函数段剥出,
   先例: world→mesh-core / tank→tank-core / mobs→mob-core): 零 THREE
   零 DOM——地形段经 setBlockRaw/getBlock 写读体素模型, 政策段经
   items/craft/inventory/drops 的纯接口取数, 全局名一律调用期解析,
   加载零副作用(仅常量与函数声明)。壳(mkMode 装配/THREE/DOM/话术/
   生命周期)留在 js/modes/adventure.js, 在本文件之后加载并经共享
   词法环境消费。
   interface: 地图常量表(ADV_GROUND/HUT/SPAWN/LAKE/PITS/CAVE/NESTS/
     ORES/TREES + T5 圈层高度场 ADV_RING/ADV_FLATS/advHeightAt 与核心圈
     建场件 ADV_GATE_PLAZA/ADV_FARM/ADV_PEN/ADV_PATH + 2026-10-27 扩容
     主题五件 ADV_PINE/ADV_TOWER/ADV_STONES/ADV_MEADOW/ADV_POND) · 地形生成
     advBuildWorld 一族(树落位清单 advTreeSpots 与 F4 牧场共用; 花丛/草丛
     随高度场贴地; 松林/花田/南池/望塔/石阵建场件同族) · 政策纯函数
     advDeathPlan/advNestCount/advNestStep/advSwingDmg/advMobDmg/
     advDeathDrops/advPickupText/advMineStep/advPlaceCheck/advEatPolicy/
     advSapDue/advNearStation(losOk 视线缝可选)/advLosBlocked(站点隔墙段采样)/advFurnaceValid/
     advFurnaceClean(F1 每炉独立+持久化的存档防错与清扫; 进度钳制界读
     craft-core 的 SMELT_T)/advTntRoll/
     advTntDmg/advWearWarn/advBagFullStep/advBreakToolText · 昼夜 D5 夜怪
      政策 ADV_NIGHT/advNightCanSpawn/advNightStep(缺省池薄壳, 签名冻结)/
      advDawnSweep · home 地图行缺省 ADV_HOME_ROW(巢穴池/夜怪池的
      行缺省权威, 冒险地图 T2——壳与 T4 注册表各行经它换池, 常量本体不动) · F4 牧场
     advLivestockPlan(确定性散布清单)/advHerdStep(恐惧游荡决策) · 床·睡觉
     政策(昼夜 D6 §7.2) advSleepCheck(两条件)/advSleepStep(转场时间账) 与
     常量 ADV_BED_MOB_R/ADV_SLEEP_* · 灯笼耗秒政策(昼夜 D7 §8.2)
     ADV_LANTERN/advLanternStep(天黑才亮才耗三前置+持满 1 秒节拍) · 任务表
     ADV_QUESTS/ADV_MINE_TALLY · 大宝箱政策 ADV_CHEST_START/ADV_CHEST_SLOTS/
     ADV_CHEST_PER/ADV_CHEST_TIERS/advChestNext/advChestCapacity(两轨容量:
     阶梯基础+每箱加格, ADR 0007)/advCountChestEdits(世界账本现算箱子数)/
     advChestPut/advChestTake(整摞出箱, 与 Put 镜像) · 节律常量 ADV_* ·
     政策下沉包(评审候选 5, 2026-10 自壳迁入;
     世界读/随机/动作全经注入 seam): advHomeReady/ADV_HOME_CD(回家冷却
     判据) · advBedSpot(床边出生位选址, 方块读注入) · ADV_TNT_TAP_T/
     advTntTapStep(TNT 短按/按住二分纯步进) · advCascadeLedger(级联清单→
     edits 账本的记账编排, 编辑动作经 sink 注入——存档红线件) · advGrowMark
     (树苗长成足迹记账, y..y+7/±2 界限——重进幂等关键) · advExplodeCells
     (TNT 半径遍历编排)/advTntWave(波及怪物清单, 线性衰减) ·
     ADV_HERD_AMBLE_WALK_P/advAmbleStep(闲逛吃草节拍, 随机注入) ·
     ADV_HERD_PAD/advHerdClamp(栏内钳制——出栏防线, 踏石爬行路线兜底) ·
     生态恢复(docs/eco-recovery-design.md, ADR 0006): advTreeSpotOpen(树位占位
     预检, 拒绝式生长)/advTreeRegenSpots(凋零树位派生)/ADV_TREE_REGROW_* ·
     advOreSpots/advOreSpotsReset(矿位白名单, advTryOre 建场期记录)/advIsOre/
     advOreKey/advOreParseKey/advOreDue/advOreRefillPlan(矿位跨天回填纯段) ·
     advBreedPairOk(繁育配对判据)/advBabyAdult(幼崽成年判)/advLivestockNormBucket
     (牧场桶四代档形归一, v3 增剪毛账 sheared)/advShearedNorm(剪毛账归一)/
     advBreedHerdOf/ADV_BREED 族/ADV_BABY 族 ·
     石阵夜晚彩蛋(2026-10-27): ADV_STONE_EGG_CD/ADV_STONE_HINT_CD/
     ADV_STONE_EGG_GIFT/advStoneAltarHit(灯坛命中)/advStoneEggPick(昼夜
     分支裁决——观感归壳) ·
      传送门段(门阵/下界/副本三家共用, docs/nether-merge-design.md §3.2):
      ADV_PORTAL 常量 · advPortalFrame(整座门, set 注入; 可选
      look 主题建材——门阵观感精细化, 缺省经典下界门逐字不变) ·
      advInPortal(内口判定, read 注入) · advPortalSiteOk(放置校验,
      read 注入) · advPortalExit(传送出口, 来向退 2.5 格+yaw 反向) ·
      黑巢主巢 ADV_NESTS[3](den 旗标行)/ADV_DEN_NEST_DOOR(洞口涌出锚点)
      ——维度专属段(ADV_NETHER/advNetherBuild/ADV_ERUPT/advEruptStep/
      ADV_DEN/advDenBuild/副本刷怪四件套/advMusicMood)已迁
      js/adventure-dims-core.js(2026-10-30, docs/dimension-registry-design.md) ·
      四方向过渡带(〔边界转正·T7〕2026-11-06 定稿收编, 源出 T2~T5 spec 走查
      定稿, docs/world-edge-design/*-spec.md): ADV_EDGE_SKY 天/雾锚点表·
      advEdgeSkyAt(按玩家到边距离的分段 lerp+主导边混合, 纯函数)·
      ADV_EDGE_HOME_SKY(腹地快速旁路共享常量, P5①)·advBuildEdgeBands(带内
      地表确定性改写+屏障件+远景剪影, 正式建场件, home 图专属, advBuildWorld
      总装内建)·advEdgeNorthMountainH(北山体几何唯一权威, 保护判据与测试
      共用)·advEdgeBarriersHidden+advSetEdgeBarriersHidden(强制全开调试缝
      与唯一写入口——URL ?edgeUnlocked=1 走查参数驱动; 〔世界边界·T8〕降级:
      OR 垫在进度派生之下)·advEdgeUnlockCounts+advSetEdgeUnlockCounts(解锁
      进度账唯一写入口, 壳 init 注入 quest counts 引用不复制)·
      advEdgeOpenDir(单一开放判据: 强制缝 OR advEdgeDirUnlocked 派生——屏障
      建场早退/保护门控/西带地表分支/西带雾表四方共吃)·advEdgeTransitDirAt
      (越线传送触发线纯几何, east 恒 null)+advEdgeHintAt(锁定向屏障近前
      引导区, 解锁态静默)·ADV_EDGE_SKY_WEST_OPEN(西带解锁态雾减半表,
      advEdgeSkyAt 换表)·advEdgeProtectedAt/advEdgeProtectedZone(边界保护
      政策纯函数, T7 转正新增: T6 修订 v2 不可挖判据/三向足迹列禁放判据
      ——三向随 advEdgeOpenDir 逐向门控, 东向恒保护)
   依赖(均经全局名, 调用期解析): adventure-spawn-core.js 的 advSpawnPulse/
      advWeightedPick/advRingSpot(刷怪三件, 候选 2 归一——advNestStep 薄壳/
      advNightStepPool 组装消费, 加载序先于本文件) · config.js 的
      BLOCKS/B_* 常量/世界(门段政策消费 B_DOOR 系 id; 门段 interface: advIsDoor/
      advIsDoorLower/advDoorSiteOk/advDoorTogglePlan——身份旗标判据/放置校验/
      开关计划, docs/door-window-design.md §3; 床两格结构 interface:
      advBedSiteOk——放置校验, 两格床改版; 配对破坏计划已迁
      js/paired-block-core.js 配对方块行注册表, 2026-11-04 架构评审候选①)
     尺寸 · daylight-core 的 Daylight(昼夜 D5 夜怪判定与 D6 睡觉夜窗) ·
     voxel.js 的 getBlock/setBlockRaw/hashRand · scene-kit.js 的
     SceneKit · items-core 的 ITEMS/toolOf/stackMax/durOf · inventory-core
     的 add · craft-core 的 fuelUnits/smeltOf/SMELT_T · drops.js 的 rollDrops/
     rollBlockDrop(加载序: 上述文件在 index.html 均先于本文件) ·
     adventure-maps-core.js 的 advEdgeDirUnlocked/ADV_EDGE_DIR_MAP(〔世界
     边界·T8〕解锁派生消费, 加载序后于本文件——共享 defer 词法调用期解析,
     index.html 顺序 spawn-core → 本文件 → maps-core → dims → modes)
   可测性: 零 THREE·零 DOM·有单测(test/adventure-core.test.js,
     vm 装真引擎件直测, 地形确定性对着真散布函数断言)
   ============================================================ */

/* ---------- 地图常量(随 NCX/NCZ 世界尺寸自适应; 2026-10-27 扩容 160×160,
   既有内容坐标零改动——扩容通道预留口径) ---------- */
const ADV_GROUND = 24; /* 草原表层 y: 下 4 层泥(y20~23), 再下石头到 y0(D5 压缩分层) */
const ADV_HUT = {x1: 58, x2: 64, z1: 78, z2: 84}; /* 出生小屋: 7×7, 北墙正中门洞 */
const ADV_SPAWN = {x: 61.5, y: ADV_GROUND + 1, z: 76.5, yaw: 0}; /* 门口两步, 面朝旷野背对小屋 */
const ADV_LAKE = {cx: 36, cz: 58, r: 7}; /* 湖: 资源圈(T5 圈层重排, 设计稿 §2.4)——挪近小屋, 黏土教学链步行可达; 沙岸+可趟水+湖底黏土 */
const ADV_PITS = [ /* 露天矿坑: 阶梯漏斗坑(每级 1 格 — 玩家跳跃 1.42 格, 下得去也上得来;
  2026-10-23 实测 2 格级困人), 坑壁矿化做可见性教学; T5 两坑分踞东西矿业圈(探索动线成环) */
  {cx: 100, cz: 52, r: 8, floor: 12, ore: {id: B_COAL_ORE, yLo: 12, yHi: 20, salt: 4101}},
  {cx: 24, cz: 44, r: 9, floor: 10, ore: {id: B_IRON_ORE, yLo: 6, yHi: 16, salt: 4207}},
];
/* 山洞: 2 宽台阶隧道 y23→y3, 穴室镶钻; T5 洞口挪北边缘 (62,10), 隧道**向南**深潜
   (原隧道向北 zStart72→zEnd52, 方向反转——穴室 z30 在最深处), 深险圈入口 */
const ADV_CAVE = {x1: 61, x2: 62, zStart: 10, steps: 20, y0: 23, zEnd: 30};
const ADV_NESTS = [ /* 怪物巢穴位点(土丘洞穴): 难度序 = 三普通巢距小屋由近到远(设计稿 §2.4 巢穴梯度,
  单测只锁普通巢单调递增——黑巢 2026-11-06 迁西带后难度移交门序, 见下行 den 行);
  kinds=本巢刷怪池(主打种在前, 重复即权重), 节律见巢穴战斗段(T14);
  den:true = 黑巢主巢(docs/den-nest-design.md §2)——地表巨丘+深洞道+巢厅巢之心,
  建场走 advBuildDenNest 分派(普通巢走 advBuildNest), 刷怪/AI/避让与普通巢同机制 */
  {x: 44, z: 60, kinds: ['zombie', 'zombie', 'skeleton']}, /* 近巢·资源圈: 僵尸一家(温和) */
  {x: 96, z: 36, kinds: ['spider', 'spider', 'zombie']}, /* 中巢·矿业圈: 虫虫族主打蜘蛛 */
  {x: 20, z: 16, kinds: ['creeper', 'creeper', 'spider']}, /* 远巢·深险圈: 草木族苦力怕(最难) */
  {x: 26, z: 72, den: true, kinds: ['cave_spider', 'zombie', 'skeleton']}, /* 黑巢·沼泽门(西带入口段):
      主巢(副本入口)。cave_spider 首秀=它的家(den-nest D7, MC 刷怪笼地牢正典);
      洞口涌出锚点 door 在丘南敞廊外(夜袭涌出的出生点, 节拍见 ADV_ERUPT 段)。
      2026-11-06 走查修订: 自北带东段 (100,8) 迁驻西带——苦力怕的副本蹲雪山边不合理,
      改驻沼泽门(西 spec 走查修订段)。落位口径: 丘体 r5 全在带内(x21..31)且裙边
      离深水带 k13~18 两格外(x21>18), 避高脚木屋(x0~4,z22~26)/铁坑压平圈(24,44),
      丘心 z72 偏北于 home 中轴(z≈81)——从家看得见, 不挡西向观感主轴; 副本难度
      改由「沼泽门=门阵解锁链末环」承担, 不再由距小屋距离梯度承担 */
];
const ADV_DEN_NEST_DOOR = {x: ADV_NESTS[3].x + 0.5, z: ADV_NESTS[3].z + 7.5}; /* 黑巢洞口外涌出点(夜怪从洞里爬出来的落位,
    敞廊南缘外 2 格——出生即「爬出洞口」观感, 家锚=洞口在壳层挂)。
    派生自 ADV_NESTS[3](单一权威, 不抄第二份坐标)——2026-11-06 副本迁驻西带, 锚随表走 */
/* 四矿物深度带(D5: 煤 y12~20 簇 4-8 · 铁 y6~16 簇 3-5 · 金 y2~10 簇 2-3 · 钻 y0~5 簇 1-2)
   p=种子点密度(每列), 盐值分层避免矿种互相踩散列 */
const ADV_ORES = [
  {id: B_COAL_ORE, yLo: 12, yHi: 20, sizeLo: 4, sizeHi: 8, p: 0.012, salt: 101},
  {id: B_IRON_ORE, yLo: 6, yHi: 16, sizeLo: 3, sizeHi: 5, p: 0.0035, salt: 211},
  {id: B_GOLD_ORE, yLo: 2, yHi: 10, sizeLo: 2, sizeHi: 3, p: 0.0035, salt: 311},
  {id: B_DIAMOND_ORE, yLo: 0, yHi: 5, sizeLo: 1, sizeHi: 2, p: 0.002, salt: 411},
];
const ADV_TREES = 56; /* 橡树林目标棵数(候选按散列值排序取前 N, 空间无偏)——
  2026-10-27 扩容 160×160 后按面积比例上调(40×1.56≈56, 密度感不稀释) */

/* ---------- T5 家园核心圈新建场件(设计稿 §2.4): 门阵广场/初始农田/畜牧围栏/圆石小径 ---------- */
/* 门阵广场(§2.3 门阵/§2.4 核心圈): 屋东 15×15 压平+圆石铺装; 三扇门位只登记坐标
   (px..px+5 为 6 宽门框, ADV_PORTAL 口径)——门体 advPortalFrame 归 T7 建, 门→目标图
   绑定归 T4 注册表各行 gatePos; gates 数组序 = 难度序(home→desert→snow→swamp 解锁链)。
   2026-10-27 用户拍板: 广场东移 8 格(屋墙 x64 → 塔楼 x79, 门离小屋远一倍不止),
   坐标零重排——广场尺寸/三门品字位关系原样平移 */
const ADV_GATE_PLAZA = {
  x1: 78, x2: 92, z1: 74, z2: 88,
  gates: [
    {px: 80, pz: 76}, /* 门一·北缘西段(沙漠之门) — 与 ADV_MAPS home 行 gates 同值对齐
      (绑定权威在 maps-core, 此处是建场避让用的副本, 一致性由
      adventure-maps-core.test.js 断言守门; T5 旧位随 T7 门阵装配作废) */
    {px: 88, pz: 76}, /* 门二·北缘东段(雪原之门, 塔楼 x94 外溢广场) */
    {px: 80, pz: 88}, /* 门三·南缘西段(沼泽之门, 步道 z89 外溢广场) */
  ],
};
/* 广场外扩门体足迹(塔楼 px-1/px+6 与步道 pz±1 的并集外接矩形): 植被避让用——
   T7 门体建场后步道会覆盖草皮, 草丛/树落在足迹上会「长在砖上」或被门框顶掉 */
const ADV_GATE_PLAZA_PAD = {
  x1: ADV_GATE_PLAZA.gates.reduce((m, g) => Math.min(m, g.px - 1), 999),
  x2: ADV_GATE_PLAZA.gates.reduce((m, g) => Math.max(m, g.px + 6), 0),
  z1: ADV_GATE_PLAZA.gates.reduce((m, g) => Math.min(m, g.pz - 1), 999),
  z2: ADV_GATE_PLAZA.gates.reduce((m, g) => Math.max(m, g.pz + 1), 0),
};
/* 初始农田(§2.4 核心圈·屋南): 4×3 耕地+熟麦(点亮种子→小麦→面包教学第一环), 西缘 x1-1 列水路(从简) */
const ADV_FARM = {x1: 59, x2: 62, z1: 86, z2: 88};
/* 畜牧围栏(§2.4 核心圈·屋西): 原木柱角+木板栏一圈 2 高(台阶步进 ≤1.05 的牲畜翻不出,
   孩子踩东侧踏石两级可越), 栏内留草地(四畜在场内, F4 AI 零改动) */
const ADV_PEN = {x1: 40, x2: 54, z1: 74, z2: 90};
const ADV_PATH = [ /* 圆石小径(§2.4 原则 2 动线成环): 门口↔广场↔农田 + 2026-10-27
   扩容延伸两段(广场→望塔/农田→花田——新元素入环, 方向引导不铺满), 2 宽走廊内
   (x+z) 偶数格间断铺圆石 */
  {x1: 62, x2: 77, z1: 76, z2: 77}, /* 门口段: 北门洞向东接广场西缘(广场东移后同步拉长) */
  {x1: 65, x2: 66, z1: 78, z2: 88}, /* 南下段: 贴屋东墙南下 */
  {x1: 63, x2: 66, z1: 87, z2: 88}, /* 西折段: 屋东南角西折接农田东缘 */
  {x1: 93, x2: 108, z1: 74, z2: 75}, /* 东段: 广场东缘向东指引望塔(矿业圈外侧) */
  {x1: 60, x2: 61, z1: 89, z2: 110}, /* 南段: 农田南缘南下指引花田 */
];

/* ---------- 2026-10-27 扩容新增元素(主题五件, 坐标避让既有圈层) ----------
   世界 128→160 后东部/南部新敞出来的草甸, 五个POI 分主题落位:
   松林(东北·针叶林)/望塔(东·登高)/远古石阵(东南·夜景)/花田(南·花海)/
   南池(南·水景)。全部确定性建场(零 Math.random), 盐值 77xx/78xx/79xx 分层
   不踩既有散布; 压平/避让登记见 ADV_FLATS 与 advTreeBlocked */
const ADV_PINE = {cx: 122, cz: 28, r: 15, n: 14, salt: 7701}; /* 松林: 云杉形针叶林
   (树形与雪原云杉同语言, 自持盐值), 橡树散布避让本圈 */
const ADV_TOWER = {x: 114, z: 66}; /* 望塔: 7×7 石砖塔(室内红蓝羊毛内旋梯登顶)+顶平台宝箱,
   矿业圈东侧的高点地标 */
const ADV_STONES = {cx: 126, cz: 106, r: 6, n: 8, salt: 7801}; /* 远古石阵: 苔石列石环 +
   中心灯块基座(夜间发光地标), 深险圈南侧 */
const ADV_MEADOW = {cx: 72, cz: 126, r: 11, salt: 7901}; /* 花田: 蒲公英/雏菊密铺花海
   (~四成半列), 家园南侧的目的地 */
const ADV_POND = {cx: 98, cz: 132, r: 5}; /* 南池: 小水泊(沙岸+沙底), 花田以东的南水景 */

/* ---------- 圈层高度场(T5, 设计稿 §2.4): SceneKit.heightAt 接入 ----------
   幅度按距小屋距离分环(核心圈 0 → 深险圈 ±3), 结构压平区并集回落 y24;
   坡度红线(全图相邻高差 ≤1)由 heightAt 的插值构造保证, 建场侧只消费不破坏 */
const ADV_RING = {CORE: 18, DEEP: 60}; /* 圈层距小屋半径界(§2.4 圈层表): ≤18 家园核心圈 · >60 深险圈 */
const ADV_HUT_C = {x: (ADV_HUT.x1 + ADV_HUT.x2) / 2, z: (ADV_HUT.z1 + ADV_HUT.z2) / 2}; /* 小屋中心: 圈层锚点 */
function advRingAmp(d) {/* 距小屋 d → 丘体幅度: 核心圈 0, 深险圈 3, 中间按距离阶梯(圈层越远丘越高) */
  if (d <= ADV_RING.CORE) return 0;
  if (d >= ADV_RING.DEEP) return 3;
  return Math.round((d - ADV_RING.CORE) / (ADV_RING.DEEP - ADV_RING.CORE) * 3);
}
const ADV_FLATS = [ /* 结构压平区清单(heightAt 的 flats 参数, 全部回落 base 0=y24)——
   与建场件足印一一对应(单测锁足印归 0): 湖盆/两坑口/山洞口/三巢丘 + T5 新增广场/农田/围栏
   + 2026-10-27 扩容新增望塔/石阵/南池(花田/松林走自然起伏, 花草随高度场扎根不压平) */
  {cx: ADV_LAKE.cx, cz: ADV_LAKE.cz, r: ADV_LAKE.r + 2}, /* 湖盆(含水岸) */
  {cx: ADV_PITS[0].cx, cz: ADV_PITS[0].cz, r: ADV_PITS[0].r + 4}, /* 煤坑口漏斗 */
  {cx: ADV_PITS[1].cx, cz: ADV_PITS[1].cz, r: ADV_PITS[1].r + 4}, /* 铁坑口漏斗 */
  {cx: ADV_CAVE.x2, cz: ADV_CAVE.zStart - 1, r: 12}, /* 山洞口小丘+敞廊(含隧道北端露天台阶) */
  {cx: ADV_NESTS[0].x, cz: ADV_NESTS[0].z, r: 8}, /* 近巢丘 */
  {cx: ADV_NESTS[1].x, cz: ADV_NESTS[1].z, r: 8}, /* 中巢丘 */
  {cx: ADV_NESTS[2].x, cz: ADV_NESTS[2].z, r: 8}, /* 远巢丘 */
  {cx: ADV_NESTS[3].x, cz: ADV_NESTS[3].z, r: 9}, /* 黑巢主巢丘+洞口敞廊(den-nest §2):
      丘 r5 比普通巢大一圈, 压平半径随之 9 */
  {cx: (ADV_GATE_PLAZA.x1 + ADV_GATE_PLAZA.x2) / 2, /* 门阵广场(含门体外扩) */
    cz: (ADV_GATE_PLAZA.z1 + ADV_GATE_PLAZA.z2) / 2, r: 12},
  {cx: (ADV_FARM.x1 + ADV_FARM.x2) / 2, cz: (ADV_FARM.z1 + ADV_FARM.z2) / 2, r: 5}, /* 农田+水路 */
  {cx: (ADV_PEN.x1 + ADV_PEN.x2) / 2, cz: (ADV_PEN.z1 + ADV_PEN.z2) / 2, r: 12}, /* 畜牧围栏 */
  {cx: ADV_TOWER.x, cz: ADV_TOWER.z, r: 20}, /* 望塔台地——深险圈丘陵带小半径压平会被
    16 格控制网格插值出 ±1 肩坡, 半径须 ≥16+结构外沿(沙漠神殿 r18 同口径) */
  {cx: ADV_STONES.cx, cz: ADV_STONES.cz, r: ADV_STONES.r + 14}, /* 石阵环场(同上口径) */
  {cx: ADV_POND.cx, cz: ADV_POND.cz, r: ADV_POND.r + 12}, /* 南池盆(同上口径, 保水面齐整) */
];
function advHeightAt(x, z) {/* 表面高度偏移(相对 ADV_GROUND): 圈层丘体 + 结构压平并集。
  amp 通道按控制格(16×16 格心)距小屋取圈层幅度; 建场件与树/草丛/花共用的唯一高度权威。
  末尾 || 0 把 Math.round 负零归一成 +0(strictEqual 语义/档一致性) */
  return SceneKit.heightAt(x, z, {salt: 3305, base: 0, flats: ADV_FLATS,
    amp: (i, j) => advRingAmp(Math.hypot(i * 16 - ADV_HUT_C.x, j * 16 - ADV_HUT_C.z))}) || 0;
}

/* ============================================================
   地形生成 — 全部确定性(SceneKit.rand/hashRand 散布, 零 Math.random)
   ============================================================ */
function advBaseTerrain() {/* 草原地层随圈层高度场(T5): 表面 y=24+advHeightAt 处草 /
  下 4 层泥 / 再下石头——丘体起伏来自 SceneKit.heightAt, 建场侧零随机数 */
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      const top = ADV_GROUND + advHeightAt(x, z);
      for (let y = 0; y <= top - 5; y++) setBlockRaw(x, y, z, 3);
      for (let y = top - 4; y < top; y++) setBlockRaw(x, y, z, 2);
      setBlockRaw(x, top, z, 1);
    }
  }
}

function advBuildLake() {/* 湖: 水面齐草地 + 沙底 + 黏土层 2~3 格厚(§3.5 红砖链源头) */
  const L = ADV_LAKE;
  for (let x = L.cx - L.r; x <= L.cx + L.r; x++) {
    for (let z = L.cz - L.r; z <= L.cz + L.r; z++) {
      const d = Math.hypot(x - L.cx, z - L.cz);
      if (d > L.r) continue;
      if (d < L.r - 1.2) {/* 湖心: 水 + 沙底 + 湖底黏土 */
        setBlockRaw(x, ADV_GROUND, z, B_WATER);
        setBlockRaw(x, ADV_GROUND - 1, z, 8);
        const clayT = 2 + (SceneKit.rand(x, z, 31) > 0.5 ? 1 : 0); /* 2~3 格 */
        for (let y = ADV_GROUND - 2; y > ADV_GROUND - 2 - clayT; y--) setBlockRaw(x, y, z, B_CLAY);
      } else {/* 沙岸 */
        setBlockRaw(x, ADV_GROUND, z, 8);
        setBlockRaw(x, ADV_GROUND - 1, z, 8);
      }
    }
  }
}

function advOreCluster(x, y, z, o) {/* 小簇随机游走(每步沿一轴 ±1, 只镶进石头) */
  const n = o.sizeLo + Math.floor(SceneKit.rand(x, z, o.salt + 2) * (o.sizeHi - o.sizeLo + 1));
  let cx = x; let cy = y; let cz = z;
  for (let k = 0; k < n; k++) {
    advTryOre(cx, cy, cz, o.id);
    const r = SceneKit.rand(x + k * 13, z + k * 7, o.salt + 3 + k);
    const sgn = SceneKit.rand(x - k * 11, z + k * 17, o.salt + 53 + k) > 0.5 ? 1 : -1;
    const axis = Math.floor(r * 3);
    if (axis === 0) cx = Math.max(1, Math.min(WORLD_W - 2, cx + sgn));
    else if (axis === 1) cy = Math.max(o.yLo, Math.min(o.yHi, cy + sgn)); /* 钳回矿带 */
    else cz = Math.max(1, Math.min(WORLD_D - 2, cz + sgn));
  }
}
function advScatterOres() {/* 种子点散布: 每列按密度掷种子, 深度带内取 y */
  for (const o of ADV_ORES) {
    for (let x = 1; x < WORLD_W - 1; x++) {
      for (let z = 1; z < WORLD_D - 1; z++) {
        if (SceneKit.rand(x, z, o.salt) < 1 - o.p) continue;
        const y = o.yLo + Math.floor(SceneKit.rand(x, z, o.salt + 1) * (o.yHi - o.yLo + 1));
        advOreCluster(x, y, z, o);
      }
    }
  }
}

function advBuildPit(p) {/* 露天矿坑: 阶梯漏斗坑(每级 1 格深)挖到目标层, 坑壁矿化; 每级恰 1 格 = 跳跃可登, 上得来(修复: 曾为 2 格级只下不上) */
  for (let dx = -p.r; dx <= p.r; dx++) {
    for (let dz = -p.r; dz <= p.r; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > p.r) continue;
      const depth = Math.floor(p.r - d);
      const floorY = Math.max(p.floor, ADV_GROUND - depth);
      const x = p.cx + dx; const z = p.cz + dz;
      for (let y = floorY + 1; y <= ADV_GROUND + 2; y++) setBlockRaw(x, y, z, 0); /* 挖空漏斗 */
      for (let y = Math.max(1, floorY - 2); y <= floorY; y++) setBlockRaw(x, y, z, 3); /* 露岩阶梯面 */
    }
  }
  for (let dx = -p.r; dx <= p.r; dx++) {/* 矿化: 坑内暴露的石头按确定性概率镶矿 */
    for (let dz = -p.r; dz <= p.r; dz++) {
      if (Math.hypot(dx, dz) > p.r) continue;
      for (let y = p.floor - 2; y <= ADV_GROUND; y++) {
        if (y < p.ore.yLo || y > p.ore.yHi) continue;
        if (getBlock(p.cx + dx, y, p.cz + dz) !== 3) continue;
        if (SceneKit.rand(p.cx + dx, p.cz + dz, p.ore.salt) < 0.65) continue;
        advTryOre(p.cx + dx, y, p.cz + dz, p.ore.id);
      }
    }
  }
}

const advOreSpots = []; /* 矿位白名单(生态恢复 C 通道, docs/eco-recovery-design.md §3):
  建场期 advTryOre 逐位记录——回填只认这份清单(插件「位置记录」套路, 调研稿 §10),
  玩家建筑不在其中天然免疫; 同 seed 同清单, 进场由壳 advBuildScene 清空重建, 零存档 */
function advOreSpotsReset() {
  advOreSpots.length = 0;
}

function advTryOre(x, y, z, id) {/* 只镶进石头 + 矿位记账(白名单唯一写入点, 四处布点
  主矿带/坑壁/洞壁/固定钻全收口在此) */
  if (getBlock(x, y, z) === 3) {
    setBlockRaw(x, y, z, id);
    advOreSpots.push({x, y, z, id});
  }
}
function advBuildCave() {/* 山洞: 洞口小丘 + 2 宽台阶隧道 y23→y3 向南深潜 + 深处穴室(镶钻);
  T5 洞口挪北边缘——小丘坐在隧道北端(zStart-2)上方, 敞廊朝南(面向来路), 穴室在最深南端 */
  const c = ADV_CAVE;
  /* 洞口小丘(石芯泥皮): 让"山洞入口"在地表上读得出来 */
  const mcx = c.x2; const mcz = c.zStart - 2;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 3) continue;
      const h = d < 0.8 ? 4 : (d < 1.8 ? 3 : (d < 2.9 ? 2 : 1));
      for (let y = 25; y <= ADV_GROUND + h; y++) setBlockRaw(mcx + dx, y, mcz + dz, y === ADV_GROUND + h ? 2 : 3);
    }
  }
  SceneKit.fill(c.x1, 22, mcz, c.x2, 27, mcz + 3, 0); /* 南侧敞廊: 翻进洞口不用挖(与隧道口 zStart..zStart+1 合并敞开) */
  /* 台阶隧道: 每步 z+1·y-1(向南深潜), 洞身+头顶净空 4 高, 垫底防漏 */
  for (let i = 0; i <= c.steps; i++) {
    const z = c.zStart + i;
    const y = c.y0 - i;
    for (let x = c.x1; x <= c.x2; x++) {
      for (let yy = y; yy <= y + 3; yy++) setBlockRaw(x, yy, z, 0);
      if (getBlock(x, y - 1, z) === 0) setBlockRaw(x, y - 1, z, 3);
    }
    /* 沿途矿带(可见性教学): 铁带每 3 步 · 金带每 4 步 · 钻带每 5 步镶两侧洞壁 */
    for (const wx of [c.x1 - 1, c.x2 + 1]) {
      if (y >= 6 && y <= 16 && i % 3 === 1) advTryOre(wx, y, z, B_IRON_ORE);
      if (y >= 2 && y <= 10 && i % 4 === 2) advTryOre(wx, y, z, B_GOLD_ORE);
      if (y <= 5 && i % 5 === 4) advTryOre(wx, y, z, B_DIAMOND_ORE);
    }
  }
  /* 深处穴室(5×5, y2~5 掏空): 底板镶保底钻石(仪式感预演, 任务第 12 步的目的地) */
  SceneKit.fill(c.x1 - 2, 1, c.zEnd - 2, c.x2 + 1, 1, c.zEnd + 2, 3);
  SceneKit.fill(c.x1 - 2, 2, c.zEnd - 2, c.x2 + 1, 5, c.zEnd + 2, 0);
  advTryOre(c.x1 - 2, 1, c.zEnd - 2, B_DIAMOND_ORE);
  advTryOre(c.x2 + 1, 1, c.zEnd + 2, B_DIAMOND_ORE);
  advTryOre(c.x1, 1, c.zEnd, B_DIAMOND_ORE);
}

function advBuildHut() {/* 出生小屋: 原木角柱+木板墙/顶/地, 北门洞正对出生点; 站点件不送 */
  const h = ADV_HUT;
  SceneKit.fill(h.x1, ADV_GROUND, h.z1, h.x2, ADV_GROUND, h.z2, 6); /* 室内地板与草地齐平 */
  for (const cn of [[h.x1, h.z1], [h.x2, h.z1], [h.x1, h.z2], [h.x2, h.z2]]) {
    SceneKit.fill(cn[0], 25, cn[1], cn[0], 27, cn[1], 5); /* 角柱 y25~27(y28 留给屋顶, 与树干可区分) */
  }
  for (const y of [25, 26, 27]) {
    SceneKit.fill(h.x1 + 1, y, h.z1, h.x2 - 1, y, h.z1, 6);
    SceneKit.fill(h.x1 + 1, y, h.z2, h.x2 - 1, y, h.z2, 6);
    SceneKit.fill(h.x1, y, h.z1 + 1, h.x1, y, h.z2 - 1, 6);
    SceneKit.fill(h.x2, y, h.z1 + 1, h.x2, y, h.z2 - 1, 6);
  }
  SceneKit.fill(h.x1, 28, h.z1, h.x2, 28, h.z2, 6); /* 木板平顶 */
  const doorX = Math.floor((h.x1 + h.x2) / 2);
  SceneKit.fill(doorX, 25, h.z1, doorX, 26, h.z1, 0); /* 北门洞 */
}

function advBuildNest(n) {/* 怪物巢穴: 苔石点缀的土丘 + 朝南洞口(刷怪归 T14) */
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 2) continue;
      const h = d < 0.8 ? 3 : (d < 1.8 ? 2 : 1);
      for (let y = 25; y <= ADV_GROUND + h; y++) {
        const id = (d >= 0.8 && SceneKit.rand(n.x + dx, n.z + dz, 5101) > 0.72) ? 14 : 2;
        setBlockRaw(n.x + dx, y, n.z + dz, id);
      }
    }
  }
  for (const y of [25, 26]) setBlockRaw(n.x, y, n.z + 2, 0); /* 洞口朝南 */
}

function advBuildDenNest(n) {/* 黑巢主巢(den-nest-design §2): 黑石巨丘(r5, 黑石王冠——
  丘冠黑曜石为主+丘身苔石斑+丘裙素石苔, 纵剖面自冠向裙渐亮) + 南敞廊 + 向南深潜
  洞道(y24→y12, 沿途镶煤铁, 山洞同款 1 格级台阶) + 进厅台阶 + 地下巢厅(y8~11 腔室):
  中央怪物巢穴之心(B_SPAWNER, 巢厅地标——副本入口 2026-10-30 已迁洞口紫门) +
  角落发光岩(微弱路标) + 洞口巢穴之门(黑曜石门框柱+紫门面+发光楣, 全件上图集贴图) +
  丘顶苦力怕王半身像(巢穴地标, 观感票二批)。确定性零 Math.random; 门口刷怪归
  T14 巢穴机制(n.den 行照常进 advNestTick) */
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 5) continue;
      const h = d < 1.2 ? 5 : (d < 2.4 ? 4 : (d < 3.6 ? 3 : 2));
      for (let y = ADV_GROUND + 1; y <= ADV_GROUND + h; y++) {
        const r = SceneKit.rand(n.x + dx, n.z + dz + y * 131, 5103); /* y 入盐: 逐格掷点,
            旧版整列同 id 的「黑柱串」观感消除 */
        /* 黑曜石斑(挖不得的黑石质感=危险预告)+苔石+石芯, 纵向渐变: 丘冠(d<1.2)
           黑曜石为主=黑石王冠(中心柱整柱黑——峰顶任何角度读黑), 丘身石芯+苔石斑+
           偶黑曜石(原版比例 72/16/12), 丘裙只石苔——黑块不再撒到草皮边; 不用煤矿:
           矿带断言锁「煤矿只在 y12~20」全图红线(adventure-core.test), 丘体装饰不入矿带 */
        const id = d < 1.2 ? ((dx === 0 && dz === 0) || r > 0.35 ? B_OBSIDIAN : 3) :
          (d < 3.6 ? (r > 0.88 ? B_OBSIDIAN : (r > 0.72 ? 14 : 3)) :
            (r > 0.84 ? 14 : 3));
        setBlockRaw(n.x + dx, y, n.z + dz, id);
      }
    }
  }
  SceneKit.fill(n.x - 1, 22, n.z + 3, n.x, 27, n.z + 5, 0); /* 南敞廊: 翻进洞口不用挖 */
  /* 深洞道: 每步 z+1·y-1 向南深潜(洞身+头顶净空 4 高, 垫底防漏——山洞同款骨架),
     中段最深 y12; 沿途洞壁镶矿(煤每 2 步/铁每 3 步, 可见性教学同山洞) */
  for (let i = 0; i <= 11; i++) {
    const z = n.z + 5 + i;
    const y = 23 - i;
    for (let x = n.x - 1; x <= n.x; x++) {
      for (let yy = y; yy <= y + 3; yy++) setBlockRaw(x, yy, z, 0);
      if (getBlock(x, y - 1, z) === 0) setBlockRaw(x, y - 1, z, 3);
    }
    for (const wx of [n.x - 2, n.x + 1]) {
      if (i % 2 === 0) advTryOre(wx, y + 1, z, B_COAL_ORE);
      if (y >= 6 && y <= 16 && i % 3 === 1) advTryOre(wx, y, z, B_IRON_ORE);
    }
  }
  /* 南入口台阶(洞道 i=1..2 的 carve 顶穿草皮, 南口留下 4 格壕沟困人——露天矿坑
     2 格级困人的同款教训): z+7 回填 y21..23(顶 y23, 站 24, 与南侧草皮站 25 差 1)·
     z+6 回填 y22(顶 y22, 站 23, 与洞口步 z+5 站 23 平走)——露天段剖面全程 1 格级
     双向可走; 夜袭涌出点就在 z+7, 涌出怪站在台阶上, 「从洞口爬出来」观感不变 */
  for (let yy = 21; yy <= 23; yy++) {
    setBlockRaw(n.x - 1, yy, n.z + 7, 3);
    setBlockRaw(n.x, yy, n.z + 7, 3);
  }
  setBlockRaw(n.x - 1, 22, n.z + 6, 3);
  setBlockRaw(n.x, 22, n.z + 6, 3);
  /* 进厅台阶(巢心 z+17..z+20, y11→y8, 1 格级) + 巢厅(9×7, 地板 y7 填石/腔 y8~11 掏空) */
  for (let i = 12; i <= 15; i++) {
    const z = n.z + 5 + i;
    const y = 23 - i; /* i=12→y11 · i=15→y8(曾误写 35-i: 台阶铺到地表层, 洞道→厅断桥) */
    for (let x = n.x - 1; x <= n.x; x++) {
      for (let yy = y; yy <= y + 3; yy++) setBlockRaw(x, yy, z, 0);
      if (getBlock(x, y - 1, z) === 0) setBlockRaw(x, y - 1, z, 3);
    }
  }
  SceneKit.fill(n.x - 4, 7, n.z + 16, n.x + 4, 7, n.z + 22, 3); /* 厅地板 */
  SceneKit.fill(n.x - 4, 8, n.z + 17, n.x + 4, 11, n.z + 22, 0); /* 厅腔(巢心 z+17..z+22)——北墙(z+16)保留:
      洞道末步垫底不被掏(洞道→台阶→厅的 1 格级动线完整, 不出「直接掉进厅」) */
  /* 厅台阶重铺(厅腔 fill 在台阶之后跑, 掏空了前两步垫底——垫块须回铺):
     z+17 顶 y10(站 11)·z+18 顶 y9(站 10)·z+19 顶 y8(站 9, x 列同格由巢之心占位=
     末块踏面)——续接洞道末步站 12, 进厅全程 1 格级 */
  setBlockRaw(n.x - 1, 10, n.z + 17, 3);
  setBlockRaw(n.x, 10, n.z + 17, 3);
  setBlockRaw(n.x - 1, 9, n.z + 18, 3);
  setBlockRaw(n.x, 9, n.z + 18, 3);
  setBlockRaw(n.x - 1, 8, n.z + 19, 3); /* 台阶末块(东邻格同层即巢之心) */
  setBlockRaw(n.x, 8, n.z + 19, B_SPAWNER); /* 怪物巢穴之心: 巢厅地标(2026-10-30 起不再
      判定副本入口——入口已迁洞口紫门), 立在厅地板上的凸格(腔第一层) */
  setBlockRaw(n.x - 3, 8, n.z + 21, B_GLOWSTONE); /* 角落微光路标 */
  /* 巢穴之门(den-nest §2.1; 2026-10-30 用户拍板: 入口从「巢厅巢之心旁站桩」迁到洞口
     ——「传送门不知道在哪, 莫名被传送」): 画廊北端(z+3, 楼梯尽头)小门——黑曜石门槛+
     2×2 B_PORTAL 紫门面+发光岩门楣(画廊露天采光, 下楼梯即见); 触发在壳层
     advPortalTick(advDenDoorAt 认领, 门阵同款站桩 2s 可反悔)。建场直写不进 edits
     账本(光束扫描/nether 判据不误认——壳层查表先行认领) */
  for (const gx of [n.x - 1, n.x]) {
    setBlockRaw(gx, 21, n.z + 3, B_OBSIDIAN); /* 黑曜石门槛(嵌画廊地板, 经典门基) */
    for (let yy = 22; yy <= 23; yy++) setBlockRaw(gx, yy, n.z + 3, B_PORTAL); /* 紫门面 2×2 */
    setBlockRaw(gx, 24, n.z + 3, B_GLOWSTONE); /* 发光岩门楣(夜间也一眼可见) */
  }
  /* 门框柱(巢穴观感票): 门面两侧贴廊壁各一根黑曜石柱(y22~24, 画廊地面到草皮面)
     ——经典门框观感, 远看即「这里有一扇门」。廊壁格(x±2 列)在敞廊 fill(x-1..x)
     之外, 天然地形 y22~23 泥/y24 草, 覆写即成框柱; 触发域(门面格)不动 */
  for (const gx of [n.x - 2, n.x + 1]) {
    for (let yy = 22; yy <= 24; yy++) setBlockRaw(gx, yy, n.z + 3, B_OBSIDIAN);
  }
  /* 苦力怕王半身像(巢穴观感票二批, den-nest §2.1): 丘顶地标——一眼读出「苦力怕的
     巢穴」。方块拼像(MC 玩家造像同款语言, 三种材料全上图集贴图): 黑曜石基座坐黑石
     王冠顶 → 苔石像身与头颅(丘裙同款绿感石=「绿色苦力怕」的石像读法) → 黑曜石正典
     脸纹(苦力怕王「认脸是教学锚」不改脸, 面朝南=巢穴之门与来路方向) → 发光岩金冠
     四尖桩(苦力怕王头顶四尖金冠的方块镜像, 夜间自亮=巢穴灯塔; 门口/涌出两路刷怪
     均无光照门, 光源不改机制)。确定性直写零掷点 */
  SceneKit.fill(n.x - 1, 30, n.z - 1, n.x + 1, 30, n.z + 1, B_OBSIDIAN); /* 基座 3×3 */
  SceneKit.fill(n.x - 1, 31, n.z - 1, n.x + 1, 32, n.z + 1, 14); /* 像身胸肩 3×3×2 苔石 */
  SceneKit.fill(n.x - 2, 33, n.z - 2, n.x + 2, 37, n.z + 2, 14); /* 头颅 5×5×5 苔石 */
  /* 脸纹(南面 z+2, 苦力怕正典脸 5 宽缩放): 眼 y36 一对 · 嘴心中柱 y35~34 · 垂腿 y34 两侧 */
  for (const fx of [n.x - 1, n.x + 1]) setBlockRaw(fx, 36, n.z + 2, B_OBSIDIAN);
  setBlockRaw(n.x, 35, n.z + 2, B_OBSIDIAN);
  for (const fx of [n.x - 1, n.x, n.x + 1]) setBlockRaw(fx, 34, n.z + 2, B_OBSIDIAN);
  /* 金冠 y38~39: 头顶四角发光岩尖桩 */
  for (const [cx, cz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    SceneKit.fill(n.x + cx, 38, n.z + cz, n.x + cx, 39, n.z + cz, B_GLOWSTONE);
  }
}

function advInRect(x, z, r) {/* 矩形含界判据(建场件占位/避让共用, r 带 x1/x2/z1/z2) */
  return x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2;
}

function advTreeBlocked(x, z) {/* 树木禁区: 出生区/湖/矿坑/山洞(含洞口小丘)/巢穴/门阵广场/农田/围栏/小径(T5 建场件全避)
  + 2026-10-27 扩容新增(松林圈让位给针叶松/望塔/石阵/花田/南池——橡树不进新元素场)
  + 〔边界转正·T7〕四方向过渡带——橡树不进带: 首跑观测 56 棵有 33 棵落带内
  (雪原橡树/沙面橡树/西带水面立树/穿沙暴墙), 「少数过渡杂木」前提不成立且破
  「树脚下草皮」不变量; 带内树由带建场件自管(云杉/孤杉/圆冠树同 spec 语言) */
  if (z <= 23 || z >= 128 || x <= 31 || x >= 128) return true;
  const h = ADV_HUT;
  if (x >= h.x1 - 2 && x <= h.x2 + 2 && z >= h.z1 - 2 && z <= h.z2 + 2) return true;
  if (Math.hypot(x - ADV_LAKE.cx, z - ADV_LAKE.cz) <= ADV_LAKE.r + 2) return true;
  for (const p of ADV_PITS) {
    if (Math.hypot(x - p.cx, z - p.cz) <= p.r + 1) return true;
  }
  for (const n of ADV_NESTS) {
    if (Math.hypot(x - n.x, z - n.z) < 4) return true;
  }
  const c = ADV_CAVE;
  /* 隧道向南: 洞口小丘在北(zStart-5), 穴室在南(zEnd+4) */
  if (x >= c.x1 - 3 && x <= c.x2 + 3 && z >= c.zStart - 5 && z <= c.zEnd + 4) return true;
  if (advInRect(x, z, ADV_GATE_PLAZA_PAD) || advInRect(x, z, ADV_FARM) || advInRect(x, z, ADV_PEN)) return true;
  for (const r of ADV_PATH) {
    if (advInRect(x, z, r)) return true;
  }
  if (Math.hypot(x - ADV_PINE.cx, z - ADV_PINE.cz) <= ADV_PINE.r) return true; /* 松林圈: 只长松 */
  if (Math.hypot(x - ADV_TOWER.x, z - ADV_TOWER.z) <= 6) return true; /* 望塔(含楼梯带) */
  if (Math.hypot(x - ADV_STONES.cx, z - ADV_STONES.cz) <= ADV_STONES.r + 2) return true; /* 石阵环场 */
  if (Math.hypot(x - ADV_MEADOW.cx, z - ADV_MEADOW.cz) <= ADV_MEADOW.r + 2) return true; /* 花田留白 */
  if (Math.hypot(x - ADV_POND.cx, z - ADV_POND.cz) <= ADV_POND.r + 2) return true; /* 南池水岸 */
  return false;
}
function advTreeSpots() {/* 树林落位清单(advPlantTrees 的唯一权威): 候选按散列值排序取
  前 ADV_TREES——纯函数零世界读; F4 牧场群位避树复用同一清单(设计稿 §4.4 的
  「重进完全复现」要求清单不随玩家改动漂移, 故不走 getBlock) */
  const cands = [];
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (advTreeBlocked(x, z)) continue;
      const r = SceneKit.rand(x, z, 7001);
      if (r > 0.995) cands.push({x, z, r});
    }
  }
  cands.sort((a, b) => (a.r - b.r) || (a.x - b.x) || (a.z - b.z));
  return cands.slice(0, ADV_TREES);
}
function advPlantTrees() {/* 树林 ~40: 落位清单逐棵种(advTreeSpots); 树随高度场
  扎根本地草皮表面(丘上不悬空, T5 贴地红线) */
  for (const cd of advTreeSpots()) {
    SceneKit.tree(cd.x, ADV_GROUND + advHeightAt(cd.x, cd.z) + 1, cd.z);
  }
}

function advScatterTufts() {/* 草丛散布(T11 缺口, D7 草丛链): 确定性掷点, 只长
  草地表层顶上且上方无物(不占树干/不飘在沙/水上); 密度 ~4.5% 列 — 草原上
  可发现但不铺满, 挖掉 50% 掉小麦种子(config drop 表); 巢穴 3 格内不长
  (洞口朝南 y25~26 掏空, 草下真空会被误种进洞口) */
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (SceneKit.rand(x, z, 9101) < 0.955) continue;
      let nearNest = false;
      for (const n of ADV_NESTS) {
        if (Math.hypot(x - n.x, z - n.z) < 3) nearNest = true;
      }
      if (nearNest) continue;
      if (advInRect(x, z, ADV_GATE_PLAZA_PAD)) continue; /* 避门体足迹(T7): 步道覆盖草皮, 草会长在砖上 */
      const top = ADV_GROUND + advHeightAt(x, z); /* 表面随圈层丘体(T5): 草丛跟草皮走 */
      if (getBlock(x, top, z) !== 1) continue; /* 脚下是草地(沙岸/湖/矿坑/铺装天然排除) */
      if (getBlock(x, top + 1, z) !== 0) continue; /* 顶上无物(树干/小屋墙不占) */
      setBlockRaw(x, top + 1, z, B_GRASS_TUFT);
    }
  }
}

function advBuildPlaza() {/* 门阵广场(T5, §2.4 核心圈): 压平区(ADV_FLATS)上圆石满铺;
  三扇门位只登记在 ADV_GATE_PLAZA——门体(advPortalFrame)归 T7 建 */
  const p = ADV_GATE_PLAZA;
  for (let x = p.x1; x <= p.x2; x++) {
    for (let z = p.z1; z <= p.z2; z++) setBlockRaw(x, ADV_GROUND, z, 4);
  }
}

function advBuildFarm() {/* 初始农田(T5, §2.4 核心圈·屋南): 4×3 耕地+熟麦 + 西缘 1×3 水路
  (水路从简——灌溉观感, 不做流渠); 压平区保证与屋前草地同层 */
  const f = ADV_FARM;
  for (let x = f.x1; x <= f.x2; x++) {
    for (let z = f.z1; z <= f.z2; z++) {
      setBlockRaw(x, ADV_GROUND, z, B_FARMLAND);
      setBlockRaw(x, ADV_GROUND + 1, z, B_WHEAT_3); /* 已熟(教学链从收成开始) */
    }
  }
  for (let z = f.z1; z <= f.z2; z++) setBlockRaw(f.x1 - 1, ADV_GROUND, z, B_WATER);
}

function advBuildPen() {/* 畜牧围栏(T5, §2.4 核心圈·屋西): 角柱原木 2 高 + 木板栏一圈 2 高
  (MobCore.stepMove 台阶步进 ≤1.05——2 高栏正面翻不出, F4 AI 零改动), 东侧栏外一颗圆石踏石
  (孩子 地面→踏石→栏顶 两级翻越; 注意踏石到栏顶 block-y 差恰 1=牲畜也爬得上来——
  动物侧由 advHerdClamp 栏内钳制兜底, 踏石保留给孩子), 栏内草地不动 */
  const p = ADV_PEN;
  for (let x = p.x1; x <= p.x2; x++) {
    for (const z of [p.z1, p.z2]) {
      const corner = x === p.x1 || x === p.x2;
      for (let y = 25; y <= 26; y++) setBlockRaw(x, y, z, corner ? 5 : 6);
    }
  }
  for (let z = p.z1 + 1; z < p.z2; z++) {/* 东西栏线(不含角, 四角已由南北线落原木柱) */
    for (const x of [p.x1, p.x2]) {
      for (let y = 25; y <= 26; y++) setBlockRaw(x, y, z, 6);
    }
  }
  setBlockRaw(p.x2 + 1, 25, Math.floor((p.z1 + p.z2) / 2), 4); /* 踏石(栏外东侧居中) */
}

function advBuildPath() {/* 圆石小径(T5, §2.4 原则 2 动线成环): 门口↔广场↔农田 + 扩容
  延伸两段(广场→望塔/农田→花田)走廊, (x+z) 偶数格间断铺圆石——方向引导不铺满
  (不新增方块, 克制边界)。铺装贴本地表面(ADV_GROUND+高度场): 核心圈段恒 y24
  (高度场归 0, 逐字节同旧), 丘陵段随坡起伏不断裂 */
  for (const r of ADV_PATH) {
    for (let x = r.x1; x <= r.x2; x++) {
      for (let z = r.z1; z <= r.z2; z++) {
        if ((x + z) % 2 === 0) setBlockRaw(x, ADV_GROUND + advHeightAt(x, z), z, 4);
      }
    }
  }
}

/* ---------- 2026-10-27 扩容新增建场件(主题五件, 全确定性零 Math.random) ---------- */

function advBuildPond() {/* 南池: 小水泊(水面齐 y24 可趟)+沙岸环绕+沙底——黏土教学
  仍是湖的专属(不复制), 南池只做水景; 压平区保水面齐整 */
  const p = ADV_POND;
  for (let dx = -p.r; dx <= p.r; dx++) {
    for (let dz = -p.r; dz <= p.r; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > p.r) continue;
      const x = p.cx + dx; const z = p.cz + dz;
      if (d < p.r - 1.2) {
        setBlockRaw(x, ADV_GROUND, z, B_WATER);
        setBlockRaw(x, ADV_GROUND - 1, z, 8);
      } else {
        setBlockRaw(x, ADV_GROUND, z, 8);
        setBlockRaw(x, ADV_GROUND - 1, z, 8);
      }
    }
  }
}

function advBuildTower() {/* 望塔: 7×7 石砖塔(外沿环墙, 室内 5×5 大厅)+内旋楼梯登顶——
  梯贴内壁沿东墙向北盘旋 8 级(每级恰 1 格=跳跃可登, 矿坑级教训), 门进屋即见
  梯级(旧版塔底死屋+外挂折返梯的可发现性缺陷就此收掉); 楼梯红蓝羊毛逐级交替
  (2026-10-28 用户拍板: 一色石梯藏在石砖墙里不显眼, 孩子进塔找不到楼梯——纯色
  羊毛在灰石环境里一眼锁定; 15/16 无级联旗标, 与圆石同行为); 顶平台木板(心部
  灯砖/宝箱/满圈垛口/四角原木柱火把)——登高看全岛的地标, 垛口满圈是给幼儿的防失足墙。
  楼梯口=6~8 级顶开在平台北缘(平台板会挡 32~34 脚位的头顶净空), 掉进口=落在
  梯级上, 零坠落伤害; 楼梯/石材均无级联旗标, 结构全部实心落地不悬空 */
  const t = ADV_TOWER;
  const x1 = t.x - 3; const x2 = t.x + 3; const z1 = t.z - 3; const z2 = t.z + 3;
  SceneKit.fill(x1, ADV_GROUND + 1, z1, x2, ADV_GROUND + 1, z2, 4); /* 基座满铺(大厅地板) */
  for (let x = x1; x <= x2; x++) {/* 台阶层: 环边圆石(南面正中留门洞坎) */
    for (let z = z1; z <= z2; z++) {
      if (x === x1 || x === x2 || z === z1 || z === z2) setBlockRaw(x, ADV_GROUND + 2, z, 4);
    }
  }
  for (let y = ADV_GROUND + 3; y <= ADV_GROUND + 8; y++) {/* 塔身石砖环墙(内室 5×5) */
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        if (x === x1 || x === x2 || z === z1 || z === z2) setBlockRaw(x, y, z, 13);
      }
    }
  }
  setBlockRaw(t.x, ADV_GROUND + 2, z2, 0); /* 南门洞 2 高(坎层+墙层, 上方石砖门楣) */
  setBlockRaw(t.x, ADV_GROUND + 3, z2, 0);
  setBlockRaw(t.x, ADV_GROUND + 2, t.z, B_TORCH); /* 厅心火把(落地站膛, 防清扫) */
  const steps = [ /* 内旋楼梯 8 级(东南内角起步 → 沿东墙向北 → 北缘折西半圈):
      每级恰 +1、全部实心落地(不悬空), 首级就在门洞右前方——进屋即见;
      内圈 5×5 的周格: 东列 z2-1..z1+1 五格 + 北列 x2-2..x1+2 五格 */
    [x2 - 1, z2 - 1, 1], [x2 - 1, z2 - 2, 2], [x2 - 1, t.z, 3], [x2 - 1, z1 + 2, 4],
    [x2 - 1, z1 + 1, 5], [x2 - 2, z1 + 1, 6], [t.x, z1 + 1, 7], [t.x - 1, z1 + 1, 8],
  ];
  /* 红蓝羊毛逐级交替(16 红=奇数级 / 15 蓝=偶数级): 整柱同色——挖开任何一截,
      断口颜色仍在讲「这是第几级」; 8 级 4 红 4 蓝首尾异色, 半圈一眼数清 */
  for (let i = 0; i < steps.length; i++) {
    const [sx, sz, up] = steps[i];
    for (let y = ADV_GROUND + 2; y <= ADV_GROUND + 1 + up; y++) setBlockRaw(sx, y, sz, i % 2 ? 15 : 16);
  }
  SceneKit.fill(x1, ADV_GROUND + 9, z1, x2, ADV_GROUND + 9, z2, 6); /* 顶平台木板(y33) */
  for (const [sx, sz] of steps.slice(5, 7)) setBlockRaw(sx, ADV_GROUND + 9, sz, 0); /* 楼梯口:
      6~7 级格开天井(平台板会挡 32~33 脚位的头顶净空); 8 级柱顶恰为平台层,
      平台铺装原位盖板无缝出梯, 不可清 */
  setBlockRaw(t.x, ADV_GROUND + 9, t.z, B_GLOWSTONE); /* 平台心灯砖(发光地面) */
  setBlockRaw(x2 - 1, ADV_GROUND + 10, z2 - 1, B_CHEST); /* 顶角宝箱(登顶奖励,
      与楼梯口对角, 上来转头就见) */
  for (let x = x1; x <= x2; x++) {/* 满圈垛口墙(幼儿防失足) */
    for (const z of [z1, z2]) setBlockRaw(x, ADV_GROUND + 10, z, 4);
  }
  for (let z = z1 + 1; z < z2; z++) {
    for (const x of [x1, x2]) setBlockRaw(x, ADV_GROUND + 10, z, 4);
  }
  for (const [px, pz] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) {/* 四角原木柱+火把 */
    setBlockRaw(px, ADV_GROUND + 11, pz, 5);
    setBlockRaw(px, ADV_GROUND + 12, pz, B_TORCH);
  }
}

function advBuildStones() {/* 远古石阵: 8 根苔石列柱(石英压顶)围成环 + 中心苔石基座
  托灯块(光 15, 夜间暖光地标); 柱高 2-3 确定性掷点(盐值 7802)——
  纯观感目的地, 不刷怪不挂任务 */
  const s = ADV_STONES;
  for (let k = 0; k < s.n; k++) {
    const a = k / s.n * Math.PI * 2;
    const px = s.cx + Math.round(Math.cos(a) * s.r);
    const pz = s.cz + Math.round(Math.sin(a) * s.r);
    const h = SceneKit.rand(px, pz, s.salt + 2) > 0.5 ? 3 : 2;
    for (let y = ADV_GROUND + 1; y <= ADV_GROUND + h; y++) setBlockRaw(px, y, pz, 14);
    setBlockRaw(px, ADV_GROUND + h + 1, pz, 17); /* 石英压顶 */
  }
  setBlockRaw(s.cx, ADV_GROUND + 1, s.cz, 14); /* 中心基座 */
  setBlockRaw(s.cx, ADV_GROUND + 2, s.cz, 19); /* 灯块 */
}

/* ---------- 石阵夜晚彩蛋(2026-10-27 用户拍板: 夜晚限定互动) ----------
   点击中心灯坛(19 灯块)触发: 夜里 = 烟花 + 远古牧人小故事 + 首次赠灯笼
   (全会话一次防连点刷); 白天 = 温和提示「等天黑再来」(零惩罚不强迫)。
   命中判据/昼夜分支/节流常量在此(纯函数可单测), 观感(Fx/SpeechKit/
   Drops)归壳。判据零世界读、零 Math.random */
const ADV_STONE_EGG_CD = 8; /* 夜间彩蛋(故事+烟花)重播节流秒(防连点) */
const ADV_STONE_HINT_CD = 6; /* 白天提示节流秒(与锁门提示同量级) */
const ADV_STONE_EGG_GIFT = 'lantern'; /* 首次赠礼: 灯笼(灯坛夜之伴, 手持光源) */

function advStoneAltarHit(x, y, z, id) {/* 灯坛命中判据: 坐标 + 灯块 id 双重
  (防下界门角发光岩/望塔心灯砖等同 id 误触发)——壳的交互链先过这里 */
  return id === 19 && x === ADV_STONES.cx && y === ADV_GROUND + 2 && z === ADV_STONES.cz;
}

function advStoneEggPick(coolT, night) {/* 点击时刻的分支裁决: 节流窗内静默
  (null); 到窗按昼夜分——夜里全彩蛋 'egg', 白天只提示 'hint'。节流秒由壳按
  发放类型回填(夜 ADV_STONE_EGG_CD / 昼 ADV_STONE_HINT_CD, 夜长昼短) */
  if (coolT > 0) return null;
  return night ? 'egg' : 'hint';
}

function advPineTree(x, baseY, z, salt) {/* 松树: 原木 4-6 高 + 锥形叶冠(下宽上尖+顶帽)
  ——雪原 advSnowTree 同语言的针叶形, 自持盐值不跨模块借雪原件(同形保留备案,
  maps-core S3 先例); 叶贴干 ≤2 格, need:dist4 内不失撑 */
  const th = 4 + Math.floor(SceneKit.rand(x + 7, z + 3, salt) * 3);
  for (let i = 0; i < th; i++) setBlockRaw(x, baseY + i, z, 5);
  const top = baseY + th;
  for (let ly = baseY + 2; ly <= top; ly++) {
    const rad = ly >= top - 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dz = -rad; dz <= rad; dz++) {
        if (dx === 0 && dz === 0 && ly < top) continue; /* 让位树干 */
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad === 2) continue; /* 削角 */
        if (getBlock(x + dx, ly, z + dz) === 0) setBlockRaw(x + dx, ly, z + dz, 7);
      }
    }
  }
  setBlockRaw(x, top + 1, z, 7); /* 顶帽 */
}

function advBuildPineGrove() {/* 松林: 圈内候选确定性掷点取前 N(空间无偏, advTreeSpots
  同法), 橡树散布避让本圈(advTreeBlocked), 松随高度场扎根(丘上不悬空) */
  const g = ADV_PINE;
  const cands = [];
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (Math.hypot(x - g.cx, z - g.cz) > g.r) continue;
      const r = SceneKit.rand(x, z, g.salt);
      if (r > 0.96) cands.push({x, z, r}); /* 4% 列候选取前 N——圈小候选池浅, 密度比整图散布调高 */
    }
  }
  cands.sort((a, b) => (a.r - b.r) || (a.x - b.x) || (a.z - b.z));
  for (const cd of cands.slice(0, g.n)) {
    advPineTree(cd.x, ADV_GROUND + advHeightAt(cd.x, cd.z) + 1, cd.z, g.salt + 1);
  }
}

function advBuildMeadow() {/* 花田: 蒲公英黄/雏菊白密铺(~四成半列, 核心圈散布密度的
  20 倍以上)——贴本地草皮表面、顶上无物才落(最后跑, 天然不叠草丛/树); 高度场
  自然起伏不压平, 花随坡扎根 */
  const m = ADV_MEADOW;
  for (let dx = -m.r; dx <= m.r; dx++) {
    for (let dz = -m.r; dz <= m.r; dz++) {
      if (Math.hypot(dx, dz) > m.r) continue;
      const x = m.cx + dx; const z = m.cz + dz;
      if (SceneKit.rand(x, z, m.salt) < 0.55) continue;
      const top = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, top, z) !== 1) continue; /* 脚下草皮(沙/水/铺装天然排除) */
      if (getBlock(x, top + 1, z) !== 0) continue; /* 顶上无物 */
      setBlockRaw(x, top + 1, z, SceneKit.rand(x, z, m.salt + 1) > 0.5 ? B_FLOWER_Y : B_FLOWER_W);
    }
  }
}

function advScatterFlowers() {/* 花丛草场(T5, §2.4 核心圈): 蒲公英黄/雏菊白沿核心圈草场
  确定性散布(密度 ~2% 列); 脚下草皮贴本地表面、顶上净空——广场/农田/小径铺装替掉草皮
  天然排除, 围栏(牧场)不占; 与草丛互不叠格(后跑的一方顶上无物判据吃掉同格) */
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (SceneKit.rand(x, z, 9201) < 0.98) continue;
      if (Math.hypot(x - ADV_HUT_C.x, z - ADV_HUT_C.z) > ADV_RING.CORE) continue;
      if (advInRect(x, z, ADV_PEN)) continue;
      if (advInRect(x, z, ADV_GATE_PLAZA_PAD)) continue; /* 避门体足迹(T7): 同草丛口径 */
      const top = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, top, z) !== 1) continue;
      if (getBlock(x, top + 1, z) !== 0) continue;
      setBlockRaw(x, top + 1, z, SceneKit.rand(x, z, 9202) > 0.5 ? B_FLOWER_Y : B_FLOWER_W);
    }
  }
}

/* ============================================================
   〔边界转正·T7〕四方向过渡带（正式观感建场件, 2026-11-06 定稿收编）
   ------------------------------------------------------------
   docs/world-edge-design/{north,south,west,east}-spec.md 定稿的游戏内实现
   (T2~T5 轻量原型经两轮实机走查通过后转正): 带内地表渐变(确定性改写) +
   未解锁屏障件(雪崩堆/沙暴墙静态化/迷雾深水带/东向栅栏+告示牌拼块) +
   远景剪影。红线: 零 Math.random(散布全走 SceneKit.rand 坐标哈希, 两次建场
   逐字节一致); 带是 home 图专属(总装只挂 advBuildWorld, 三张远征图不挂);
   政策层(T7 转正新增: 不可挖判据/禁放柱/翻越拦截)见段末「边界保护政策」
   (advEdgeProtectedAt/advEdgeProtectedZone); 边缘传送判据层(触发线/引导区/
   单一开放判据/西带解锁两态/雾减半表)〔世界边界·T8〕已落本段, 白闪/音效/
   壳装配与存档档形归波次二(壳)——判据全部纯函数可单测。
   落位坐标口径: 北=−z 带 z∈[0,24) 全 x · 南=+z 带 z∈[128,160) 全 x ·
   西=−x 带 x∈[0,32) 全 z · 东=+x 带 x∈[128,159](栅栏线 x157/隔离带 x158~159),
   世界 160×160×48。
   地表改写守卫: 只换「草皮顶块」(id 1)——巢丘/洞口小丘/矿坑/铺装/水面天然不碰;
   南花海(ADV_MEADOW)加豁免圈(沙化毁花海)。〔2026-11-06 迁注〕黑巢巨丘原踞北屏障线
   充天然续障, 迁西带腹地(26,72)后不再承担屏障——丘基草皮被西带改写换装成泥面
   (「黑巢从沼泽里长出来」, 见 west-spec 走查修订段)。
   ============================================================ */

let advEdgeBarriersHidden = false; /* 强制全开调试缝(壳写入: URL ?edgeUnlocked=1
   走查参数驱动, 拍板 Q5 保留——T10 实机走查测「解锁态传送」有此缝不必先打穿
   任务链, 登记为调试缝不属玩家可达面)。〔世界边界·T8〕已降级: 进度驱动的
   单一开放判据是 advEdgeOpenDir(OR 语义把本开关垫在派生层下), 建场早退/
   保护门控/西带地表分支/西带雾表四方共吃那一口 */
function advSetEdgeBarriersHidden(v) {
  advEdgeBarriersHidden = !!v;
} /* 唯一写入口:
   壳与各测试域经导出消费(模块 let 不随 exports 过 vm/Node 域墙——showroom/
   adventure-mode 直写会 ReferenceError; 浏览器共享词法下同归此口) */

let advEdgeUnlockCounts = null; /* 解锁进度账(壳 init 注入 ADV.quest.counts
   **引用不复制**——任务链原地写键自动可见, 零重注入; null=缺省全锁, 与 T7
   现状行为逐位一致, 老档零迁移) */
function advSetEdgeUnlockCounts(counts) {
  advEdgeUnlockCounts = counts || null; /* 唯一写入口(advSetEdgeBarriersHidden
     同款缝模式; 传 falsy 一律归 null=全锁) */
}

function advEdgeOpenDir(dir) {/* 单一开放判据(〔世界边界·T8〕, 四方共吃一口):
   强制缝 OR 解锁派生——advEdgeDirUnlocked(AMC, advMapUnlocked 复用不绕过)
   查 advEdgeUnlockCounts; counts 缺省(null)=三向全锁, 行为与 T7 单开关
   false 逐位一致。消费方: 三向屏障建场早退/保护政策逐向门控/西带解锁态
   地表分支/西带雾表换档 + 壳传送触发与引导(波次二装配) */
  return advEdgeBarriersHidden || advEdgeDirUnlocked(dir, advEdgeUnlockCounts);
}

function advEdgeTransitDirAt(x, z) {/* 越线传送触发线(纯几何, 解锁判定分离可
   分维测试): 「中心进入最外一行格」与碰撞钳制面等效(voxel.js physics 把玩家
   中心钳在 [PLAYER.hx, WORLD_W−PLAYER.hx] × [PLAYER.hz, WORLD_D−PLAYER.hz],
   hx=hz=0.2, floor 坐标 === 0 或 === 尺寸−1 即物理可达的贴墙位); east 恒
   null=东向无传送语义(T5 定稿收尾, 栅栏彩蛋跳缝进 x158~159 条带不触发);
   角区检序北→南→西取先(advEdgeSkyAt cand 检序同源——NE 走查定稿同款裁定) */
  if (z < 1) return 'north';
  if (z >= WORLD_D - 1) return 'south';
  if (x < 1) return 'west';
  return null;
}

function advEdgeHintAt(x, z) {/* 锁定向屏障近前引导区(纯几何): 命中返回该向
   (壳节流 30s 播分向话术), 先判开放——已开放→null(解锁态静默); 东向恒 null。
   带缘常量与各 spec 带矩形同源(不抄第二份几何): 北 z≤18=山体南麓带内(北
   spec §2, 山体足迹 z4..15)/南 z≥140=apron z139..143 起(south-spec §2)/
   西 x≤22=深水带 x13..18 东缘外一圈(west-spec §4); 角区检序同 transit */
  if (z <= 18 && !advEdgeOpenDir('north')) return 'north';
  if (z >= 140 && !advEdgeOpenDir('south')) return 'south';
  if (x <= 22 && !advEdgeOpenDir('west')) return 'west';
  return null;
}

/* ---------- 天/雾锚点表与混合纯函数(壳层经 world.js setSkyBase 缝消费) ---------- */

const ADV_EDGE_HOME_SKY = [0.56, 0.78, 1]; /* home 纯天/纯雾 #8FC7FF */

/* 行格式: [到边距离 d(格), 天色 hex, 雾浓度 0..1, 雾色 hex|null(缺省随天色)],
   d 降序; 全部数值逐字取自各 spec 锚点表(北 §3/南 §3/西 §3; 东向 §4 拍板
   「保持 home 天色不做全带渐变」, 只留栅栏前雾起的走查校准档) */
const ADV_EDGE_SKY = {
  north: [[36, 0x8fc7ff, 0, null], [24, 0xa7d0fb, 0.15, null],
    [12, 0xc0d9f7, 0.35, null], [6, 0xccdef5, 0.55, null], [0, 0xccdef5, 1, null]],
  south: [[32, 0x8fc7ff, 0, null], [16, 0xbaccce, 0.25, null], [0, 0xe6d19e, 0.55, null]],
  west: [[68, 0x8fc7ff, 0, null], [40, 0x8ac0f4, 0.08, null], [24, 0x93b3d8, 0.3, null],
    [15, 0x9ea8a3, 0.88, 0xbcc5bf], [8, 0x9ea8a3, 0.9, 0xbcc5bf], [2, 0x9ea8a3, 1, 0xbcc5bf]],
  east: [[36, 0x8fc7ff, 0, null], [8, 0x8fc7ff, 0.2, null], [2, 0x8fc7ff, 0.5, null]],
};

/* 西带解锁态雾表(〔世界边界·T8〕west-spec §4.3「横雾带 opacity 约减半」):
   仅 west 行, 锚点距离/天色/雾色与 ADV_EDGE_SKY.west 逐位相同, 雾浓度整行
   减半(0.08/0.3/0.88/0.9/1 → 0.04/0.15/0.44/0.45/0.5)——步道露出的同时
   留「沼泽气息」。北/南/东不设解锁表(山体/沙丘消失不改天色目标, 雪原/
   沙漠 palette 渐变照旧)。advEdgeSkyAt 在主导边=west 且开放时换本表;
   counts 缺省(全锁)选表与现状逐位一致(测试组 9 钉) */
const ADV_EDGE_SKY_WEST_OPEN = {
  west: [[68, 0x8fc7ff, 0, null], [40, 0x8ac0f4, 0.04, null], [24, 0x93b3d8, 0.15, null],
    [15, 0x9ea8a3, 0.44, 0xbcc5bf], [8, 0x9ea8a3, 0.45, 0xbcc5bf], [2, 0x9ea8a3, 0.5, 0xbcc5bf]],
};

/* P5 可选优化①腹地旁路的返回共享常量: {dir:null, sky/fogC=home 天色, fog:0}。
   只读契约——消费方(advEdgeSkyTick/测试)不得改写, 改写会跨帧污染共享引用。 */
const ADV_EDGE_HOME_SKY_RET = {dir: null, sky: ADV_EDGE_HOME_SKY, fog: 0, fogC: ADV_EDGE_HOME_SKY};
/* 旁路阈值=四向首锚最大值(现表=west 68), 从表派生不抄死值——表改锚自动跟随。
   旁路触发区 ⊆ 全向进度 ≤0 区(进度 t>0 需 d<该向首锚), 命中时全量路径本就
   返回 home 档, 故共享常量直返与全量路径逐字段相同=行为等价(构造保证, 测试另钉)。 */
const ADV_EDGE_SKY_HOME_D = Math.max(ADV_EDGE_SKY.north[0][0], ADV_EDGE_SKY.south[0][0],
    ADV_EDGE_SKY.west[0][0], ADV_EDGE_SKY.east[0][0]);

function advEdgeRgb(hex) {/* hex → [r,g,b](0..1) */
  return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
}

function advEdgeRowsAt(rows, d) {/* 分段线性: d 落在相邻锚点间按比例插值, 两端 clamp */
  if (d >= rows[0][0]) {
    const r = rows[0];
    return {sky: advEdgeRgb(r[1]), fog: r[2], fogC: advEdgeRgb(r[3] !== null ? r[3] : r[1])};
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]; const b = rows[i + 1];
    if (d > b[0]) {
      const t = (a[0] - d) / (a[0] - b[0]);
      const mix = (x, y) => x + (y - x) * t;
      const sa = advEdgeRgb(a[1]); const sb = advEdgeRgb(b[1]);
      const fa = advEdgeRgb(a[3] !== null ? a[3] : a[1]);
      const fb = advEdgeRgb(b[3] !== null ? b[3] : b[1]);
      return {sky: [mix(sa[0], sb[0]), mix(sa[1], sb[1]), mix(sa[2], sb[2])],
        fog: mix(a[2], b[2]),
        fogC: [mix(fa[0], fb[0]), mix(fa[1], fb[1]), mix(fa[2], fb[2])]};
    }
  }
  const r = rows[rows.length - 1];
  return {sky: advEdgeRgb(r[1]), fog: r[2], fogC: advEdgeRgb(r[3] !== null ? r[3] : r[1])};
}

function advEdgeSkyAt(x, z) {/* 玩家位 → 边界天/雾观感(纯函数, 单测可断言)。
  混合口径(保守, T7 转正断言已钉: 测试「边界天/雾」块+P5① 旁路等价): 四方向各算
  进度 t∈[0,1], 取 t 最大者为主导边
  ——角部两带同时邻边时只表现更近的一条边, 不叠加混色(north-spec §1 留口的
  「四角重叠归属」在观感上的最小裁定; 同分按北/南/西/东检序取先) */
  /* P5 可选优化①腹地快速旁路: 距四缘均 > 最远首锚(west 68=ADV_EDGE_SKY_HOME_D)
     → 四向进度全 ≤0, 直接原引用返回 home 共享常量(零查表零分配, 主城腹地
     绝大多数帧命中; 等价性见 ADV_EDGE_SKY_HOME_D 注, 测试钉原引用与边界值)。 */
  if (x > ADV_EDGE_SKY_HOME_D && z > ADV_EDGE_SKY_HOME_D &&
      WORLD_W - 1 - x > ADV_EDGE_SKY_HOME_D && WORLD_D - 1 - z > ADV_EDGE_SKY_HOME_D) {
    return ADV_EDGE_HOME_SKY_RET;
  }
  const cand = [['north', z], ['south', WORLD_D - 1 - z], ['west', x], ['east', WORLD_W - 1 - x]];
  let best = null;
  for (const [dir, d] of cand) {
    const rows = ADV_EDGE_SKY[dir];
    const t = (rows[0][0] - d) / (rows[0][0] - rows[rows.length - 1][0]);
    if (t <= 0) continue;
    if (!best || t > best.t) best = {dir, d, t: Math.min(1, t)};
  }
  if (!best) return {dir: null, sky: ADV_EDGE_HOME_SKY, fog: 0, fogC: ADV_EDGE_HOME_SKY};
  /* 〔世界边界·T8〕西带解锁态换雾表(浓度减半档); 其余向/锁定态走原表逐位不变 */
  const rows = best.dir === 'west' && advEdgeOpenDir('west') ?
    ADV_EDGE_SKY_WEST_OPEN.west : ADV_EDGE_SKY[best.dir];
  const m = advEdgeRowsAt(rows, best.d);
  return {dir: best.dir, sky: m.sky, fog: m.fog, fogC: m.fogC};
}

/* ---------- 带内地表确定性改写(共享缝) ---------- */

const ADV_EDGE_KEEP = [ /* 带内豁免圈: 观感件不被带覆盖(南花海——沙化毁花海) */
  {cx: ADV_MEADOW.cx, cz: ADV_MEADOW.cz, r: ADV_MEADOW.r + 1},
];
function advEdgeKeep(x, z) {
  for (const c of ADV_EDGE_KEEP) if (Math.hypot(x - c.cx, z - c.cz) <= c.r) return true;
  return false;
}

function advEdgeRewrite(x1, x2, z1, z2, pick) {/* 矩形带内草皮顶块确定性改写:
  pick(x,z) 返回 [地表 id, 垫底 id]; B_ICE 特例=冰面下垫水+泥(雪原湖先例) */
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      if (advEdgeKeep(x, z)) continue;
      const top = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, top, z) !== 1) continue; /* 只换草皮(结构/坑/水天然不碰) */
      const pair = pick(x, z);
      setBlockRaw(x, top, z, pair[0]);
      if (pair[1]) setBlockRaw(x, top - 1, z, pair[1]);
      if (pair[0] === B_ICE) {
        setBlockRaw(x, top - 1, z, B_WATER);
        setBlockRaw(x, top - 2, z, 2);
      }
    }
  }
}

function advEdgeSurfaceId(x, z) {/* 列表面块 id(带内装饰守卫用) */
  return getBlock(x, ADV_GROUND + advHeightAt(x, z), z);
}

function advEdgeDecorate(x, z, id) {/* 顶上无物才落(草丛/花同款判据); 脚下须实感地面 */
  const top = ADV_GROUND + advHeightAt(x, z);
  const sid = getBlock(x, top, z);
  if (sid === 0 || sid === B_WATER) return false;
  if (getBlock(x, top + 1, z) !== 0) return false;
  setBlockRaw(x, top + 1, z, id);
  return true;
}

/* ---------- 北带·雪原(z∈[0,24), 6 patch 序, 北 spec §2/§4/§5) ---------- */

function advEdgeNorthSurface(x, z) {/* patch 表(2026-11-06 走查修订: 植物过渡节奏)——
  草85:雪草15 → 草45:雪草55 → 雪60:雪草40 → 纯雪 → 纯雪→冰湖缘(每 patch 独立盐值,
  混铺在 4×4 patch 窗口内交错): 草皮占比沿 z 递减, home 草丛/花(「脚下草皮」判据)
  随之在带内自然渐稀——植物过渡发生在带内而非带缘一刀切 */
  const k = Math.floor((23 - z) / 4); /* 0..5 = p1..p6 */
  const r = SceneKit.rand(x, z, 8101 + k);
  if (k === 0) return r < 0.15 ? [B_SNOWY_GRASS, 0] : [1, 0];
  if (k === 1) return r < 0.55 ? [B_SNOWY_GRASS, 0] : [1, 0];
  if (k === 2) return r < 0.6 ? [B_SNOW, 0] : [B_SNOWY_GRASS, 0];
  if (k === 3) return [B_SNOW, 0];
  if (k === 4) return [B_SNOW, 0];
  /* p6: 冰湖缘——z 越北冰越多, z0 整行成镜面横带(远景「冰湖横带」的带内落地) */
  if (z === 0) return [B_ICE, 0];
  return SceneKit.rand(x, z, 8106) < 0.3 + (3 - z) * 0.1 ? [B_ICE, 0] : [B_SNOW, 0];
}

function advEdgeNorthStand(x, z) {/* 带内材质守卫(装饰只落雪原面上); 黑巢 POI 圈不落
  ——巢丘/敞廊是副本门脸, 装饰杉冠会顶高入口剖面列(观感守); 半径 9 = ADV_FLATS
  黑巢压平圈同款。黑巢 2026-11-06 走查修订迁驻西带(26,72), 本圈随 ADV_NESTS 表键
  自动跟走、北带内已是无害空转——原样保留, 防表键回迁时北带装饰失守 */
  if (Math.hypot(x - ADV_NESTS[3].x, z - ADV_NESTS[3].z) <= 9) return false;
  const sid = advEdgeSurfaceId(x, z);
  return sid === B_SNOW || sid === B_SNOWY_GRASS || sid === B_ICE;
}

function advEdgeNorthPile(x, z) {/* 雪堆: 单块雪 */
  if (!advEdgeNorthStand(x, z)) return;
  advEdgeDecorate(x, z, B_SNOW);
}

function advEdgeNorthSpruce(x, z, salt) {/* 寒带落雪杉(advPineTree 同语言冠架): 原木干+
  锥形叶冠, 冠顶帽与冠肩两层正交位盖覆雪树叶 B_SNOWY_LEAVES——「落满雪的针叶树」
  观感 (2026-11-06 走查修订: 雪原里绿树不合理, 全带杉一律落雪, 角叶留绿透针叶底色;
  同日 T12 级联修订: 冠盖原盖 B_SNOW 无级联性质, 树倒后悬空残留——换覆雪树叶
  (need:{id:5,dist:4} 与树叶同口径), 树倒冠雪随冠一起消散, 用户实机走查拍板)。
  雪根座: 干基先垫雪(洼地越深垫越高), 干基恒 ≥y26——雪原杉永不呈现「y25/26
  双格原木干柱」剖面, 树根埋雪堆也合寒带语义, 不与家园侧选树/砍树级联口径相撞 */
  const sid = advEdgeSurfaceId(x, z);
  /* 草皮也接(只此一件放宽 stand): 渐衰草皮上的雪杉=过渡带「树线」语义;
     其余建造面(巢丘/敞廊/水/裸岩)照旧排除 */
  if (sid !== 1 && sid !== B_SNOWY_GRASS && sid !== B_SNOW && sid !== B_ICE) return;
  if (advEdgeNorthMountainH(x, z) > 0) return; /* 山体足迹不落杉(几何同一权威) */
  const hgt = advHeightAt(x, z);
  const top = ADV_GROUND + hgt;
  if (getBlock(x, top + 1, z) !== 0) return;
  const ped = 1 + Math.max(0, -hgt); /* 雪根座: 高度场 -n → 垫 n+1 层 */
  for (let i = 1; i <= ped; i++) setBlockRaw(x, top + i, z, B_SNOW);
  advPineTree(x, top + ped + 1, z, salt);
  /* 与 advPineTree 同式复算干高: 冠顶(crown)与冠肩(crown-1)的正交四叶换覆雪树叶
     (只覆叶不覆干, 读到的叶才换), 顶帽换覆雪树叶——三处皆是「叶位换叶种」,
     树叶级联性质原样(覆雪叶 need 同口径), 树倒冠盖随冠清零无悬浮残雪 */
  const crown = top + ped + 1 + (4 + Math.floor(SceneKit.rand(x + 7, z + 3, salt) * 3));
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (getBlock(x + dx, crown, z + dz) === 7) setBlockRaw(x + dx, crown, z + dz, B_SNOWY_LEAVES);
    if (getBlock(x + dx, crown - 1, z + dz) === 7) setBlockRaw(x + dx, crown - 1, z + dz, B_SNOWY_LEAVES);
  }
  setBlockRaw(x, crown + 1, z, B_SNOWY_LEAVES);
}

function advEdgeNorthMountainH(x, z) {/* 山体格高纯函数(0=足迹外): 峰高/半宽/脊线段锚
  插值 + t^2.6 凹坡剖面, 东端收势同款折算——Barrier 建体与 Dress 落杉共用同一
  几何权威(杉不落足迹: 干埋石里会让「砍树重建复活半截山」成为级联红线破绽) */
  if (x < 0 || x >= WORLD_W || z < 1 || z > 23) return 0;
  const s = Math.min(9, Math.floor(x / 16));
  const f = (x - s * 16) / 16;
  const H0 = 13 + Math.floor(SceneKit.rand(s, 0, 8141) * 6);
  const H1 = 13 + Math.floor(SceneKit.rand(s + 1, 0, 8141) * 6);
  const W0 = 5 + Math.floor(SceneKit.rand(s, 1, 8142) * 3);
  const W1 = 5 + Math.floor(SceneKit.rand(s + 1, 1, 8142) * 3);
  const Z0 = 9 + Math.floor(SceneKit.rand(s, 2, 8143) * 3);
  const Z1 = 9 + Math.floor(SceneKit.rand(s + 1, 2, 8143) * 3);
  let H = Math.round(H0 + (H1 - H0) * f);
  const W = Math.round(W0 + (W1 - W0) * f);
  const zc = Math.round(Z0 + (Z1 - Z0) * f);
  if (x >= 144) H = Math.round(H * Math.max(0, 1 - (x - 144) / 13));
  const dz = Math.abs(z - zc);
  if (dz >= W) return 0;
  return Math.max(0, Math.round(H * Math.pow((W - dz) / W, 2.6)));
}

function advEdgeNorthBarrier() {/* 未解锁屏障=巍峨高山脊(北 spec §4, 2026-11-06 走查修订
  替换雪崩堆矮丘——用户反馈「雪山也是墙的感觉, 要巍峨高山、有爬的欲望」):
  连绵山脊横贯全带, 每 16 列一段锚(峰高 13~18 / 半宽 5~7 / 脊线 z 9~11 微蜿蜒),
  段间线性插值=山势起伏无锯齿; 剖面几何唯一权威=advEdgeNorthMountainH(纯函数)。
  剖面为凹坡: 南麓起步 1~2 级 1 格缓阶(看得见脚点=「爬的欲望」), 随即升到 ≥2
  格级差(本游戏跳跃约 1 格, 翻不过——屏障语义不变, 不可挖保护判据已落地
  (advEdgeProtectedAt, T7 转正))。
  雪顶石身: 石芯(id 3)+顶盖 B_SNOW 1~3 层随峰高加厚, 檐下缘散 B_ICE 冻舌;
  南麓碎石坡(雪堆/裸石)稀疏点景。东端 x144 起峰高线性收没(让位东带栅栏/小镇
  天际线, x157 后山体退场)。豁免走地表守卫天然让位: 巢丘(土面)/山洞口小丘
  (泥面)/两处敞廊(空气面)不落山体——洞口与洞道从山体鞍部/山腹穿过(山压洞顶=
  「山腹隧道」观感, 动线零改动)。盐值 8141~8145(北带 81xx 段未用位, 旧雪崩堆
  8131/8132 随件退役)。 */
  if (advEdgeOpenDir('north')) return; /* 〔世界边界·T8〕单一开放判据换源:
     强制缝或北随 snow 解锁即不建山体(建场读键, 清场重建自动生效) */
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 1; z <= 23; z++) {
      const h = advEdgeNorthMountainH(x, z);
      if (h <= 0) continue;
      const top = ADV_GROUND + advHeightAt(x, z);
      const sid = getBlock(x, top, z);
      if (sid !== B_SNOW && sid !== B_SNOWY_GRASS && sid !== B_ICE) continue;
      const cap = h >= 11 ? 3 : (h >= 7 ? 2 : 1); /* 雪盖随峰高: 高峰 3 层矮峰 1 层 */
      for (let i = 1; i <= h; i++) {
        let id = 3; /* 石身 */
        if (i > h - cap) {
          id = B_SNOW; /* 顶盖雪 */
        } else if (i > h - cap - 2 && SceneKit.rand(x, z + i * 7, 8144) < 0.15) {
          id = B_ICE; /* 檐下冻舌: 雪线正下方偶发冻结带 */
        }
        setBlockRaw(x, top + i, z, id);
      }
    }
    /* 南麓碎石坡: 山足外缘稀疏雪包/裸石(寒带点景, 顶上无物才落; 山足行从
       MountainH 剖面反推, 与山体几何同一权威) */
    if (SceneKit.rand(x, 0, 8145) < 0.1) {
      let foot = 0;
      for (let z = 23; z >= 1; z--) {
        if (advEdgeNorthMountainH(x, z) > 0) {
          foot = z;
          break;
        }
      }
      const zr = foot + 1 + Math.floor(SceneKit.rand(x, 1, 8145) * 2);
      if (foot > 0 && zr <= 23) {
        advEdgeDecorate(x, zr, SceneKit.rand(x, 2, 8145) < 0.5 ? B_SNOW : 3);
      }
    }
  }
}

function advEdgeNorthDress() {/* p1~p3 装饰件(北 spec §2 表 2026-11-06 走查修订):
  160 列分 10 窗, 每窗按密度落位, 窗内坐标散列决定(确定性); 植物过渡节奏与地表
  查表联动——z19~21 草缘零星雪堆(home 植物渐稀处寒带件登场), z16~18 山根孤杉+
  雪堆, z13~15 坡麓云杉+雪堆(寒带植被渐密; 命中山体足迹的杉由落杉守卫自动跳过
  =树线贴着山根走); 全带杉一律落雪(冠盖见 advEdgeNorthSpruce); 旧 p5 冰点随
  山体占地并入取消 */
  const fR = (w, k, salt, n) => Math.floor(SceneKit.rand(w, k, salt) * n);
  for (let w = 0; w < 10; w++) {
    const bx = w * 16;
    advEdgeNorthPile(bx + fR(w, 1, 8111, 16), 19 + fR(w, 2, 8111, 3)); /* p1 草缘初雪堆 */
    advEdgeNorthSpruce(bx + fR(w, 3, 8121, 16), 16 + fR(w, 4, 8121, 3), 8122); /* p2 山根孤杉(落雪) */
    advEdgeNorthPile(bx + fR(w, 5, 8123, 16), 16 + fR(w, 6, 8123, 3)); /* p2 雪堆 */
    advEdgeDecorate(bx + fR(w, 7, 8125, 16), 15 + fR(w, 8, 8125, 6), 3); /* 裸石: 寒带碎石点景 */
    advEdgeNorthSpruce(bx + fR(w, 9, 8126, 16), 14 + fR(w, 10, 8126, 3), 8124); /* p3 坡麓云杉(落雪) */
    advEdgeNorthPile(bx + fR(w, 11, 8127, 16), 13 + fR(w, 12, 8127, 3)); /* p3 雪堆 */
    advEdgeNorthPile(bx + fR(w, 13, 8133, 16), 1 + fR(w, 14, 8133, 3)); /* p6 冰湖缘雪堆(山北麓) */
  }
}

function advEdgeNorthFar() {/* 远景剪影(北 spec §5, 2026-11-06 走查修订): 主剪影已是
  高山脊本体(见 advEdgeNorthBarrier), 本段只留山脚点景——落雪云杉 3 株+冰崖一件
  (B_ICE 崖身+雪盖, 山足冰川舌)+远排小杉, 全部地形生成物, 零新贴图 */
  advEdgeNorthSpruce(80, 3, 8134);
  advEdgeNorthSpruce(86, 2, 8135);
  advEdgeNorthSpruce(92, 3, 8136);
  /* 冰崖: 崖身 3~4 高 + 雪盖(z0..2 在山体足迹外, 山脚下临冰湖) */
  for (let x = 40; x <= 43; x++) {
    for (let z = 0; z <= 2; z++) {
      if (!advEdgeNorthStand(x, z)) continue;
      const top = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, top + 1, z) !== 0) continue;
      const h = 3 + ((x + z) % 2 === 0 ? 1 : 0);
      for (let i = 1; i <= h; i++) setBlockRaw(x, top + i, z, B_ICE);
      setBlockRaw(x, top + h + 1, z, B_SNOW);
    }
  }
  for (let x = 118; x <= 142; x += 6) advEdgeNorthSpruce(x, 2, 8137 + x); /* 远排小杉——
    z=2 起(非 z=1): setBlockRaw 无界检查, z=1 的冠层 dz=-2 会把叶子写进 z=-1,
    平面数组下标回卷落南缘 z159 行(污染南带+破确定性); z=2 起冠层贴 z0 冰面
    走真实空气守卫; 山体足迹 z≥3 且 z3 处剖面值恒 0, 本排不受山体影响 */
}

function advEdgeNorth() {
  advEdgeRewrite(0, WORLD_W - 1, 0, 23, advEdgeNorthSurface);
  advEdgeNorthDress();
  advEdgeNorthBarrier();
  advEdgeNorthFar();
}

/* ---------- 南带·沙漠(z∈[128,160), 32 列查表, 南 spec §2/§4) ---------- */

const ADV_EDGE_SOUTH_ROW = 'GGGGSGGSSGSSSSSSSSSSSSSSSWWSSSS'; /* b0..31 查表(spec §2 权威
  + 走查反馈修订 2026-11-06): G=保留草皮 S=沙(8) W=绿洲水+沙底; 沙斑点注释与 §3
  「b4 才见沙斑」以查表为准; 修订: b13 草残点改沙——apron z139..143 全裸沙不落件
  (防垫脚/搭桥翻丘, 见 south-spec 走查反馈修订·修订1) */
function advEdgeSouthSurface(x, z) {
  const c = ADV_EDGE_SOUTH_ROW[z - 128];
  if (c === 'G') return [1, 0];
  if (c === 'S') return [8, 0];
  return [B_WATER, 8]; /* W */
}

function advEdgeSouthSwell(x, z) {/* 背风沙海起伏高度(z148..159): 双正弦叠加取整 0..3,
  0=丘间洼地(远端零星绿意的落点); 确定性纯函数, 与主脊线合成「一大片沙丘丘原」 */
  if (z < 148 || z > 159) return 0;
  const sw = 1.6 * Math.sin(x * 0.083 + z * 0.19 + 2.1) + 1.2 * Math.sin(x * 0.031 + 0.7);
  return Math.max(0, Math.round(sw));
}

function advEdgeSouthTop(x, z) {/* 带内柱顶(地形 + 沙海堆高): 丘区饰件/露头坐落基准 */
  return ADV_GROUND + advHeightAt(x, z) + advEdgeSouthSwell(x, z);
}

function advEdgeSouthCrest(x) {/* 主脊线高度场(4..10): 双正弦不同周期叠加, 沿 x 连绵
  起伏(相邻列高度变化 ≤~0.3=缓), 4 下限保屏障语义、10 上限不压远景天际线 */
  const h = 7 + 2.2 * Math.sin(x * 0.11 + 1.7) + 1.6 * Math.sin(x * 0.041 + 0.6);
  return Math.max(4, Math.min(10, Math.round(h)));
}

function advEdgeSouthDecorate(x, z, id) {/* 丘区版饰件落位: 坐标含沙海堆高,
  判据同 advEdgeDecorate(脚下实感地面 + 顶上无物才落) */
  const top = advEdgeSouthTop(x, z);
  const sid = getBlock(x, top, z);
  if (sid === 0 || sid === B_WATER) return false;
  if (getBlock(x, top + 1, z) !== 0) return false;
  setBlockRaw(x, top + 1, z, id);
  return true;
}

function advEdgeSouthScrub(x, z, salt) {/* 低矮耐旱树(走查修订 2「多点低矮的树」):
  矮干(原木 1~2) + 扁小冠(3×3 缺角 + 顶心), 总高 3~4=home 橡树/松杉一半高;
  冠层只落空气格(树同款守卫), x 越界守卫(冠层 dx±1 会写邻列, 平面回卷前例见
  advEdgeNorthFar 注) */
  if (x < 1 || x > WORLD_W - 2) return false;
  const top = advEdgeSouthTop(x, z);
  if (getBlock(x, top, z) !== 8) return false; /* 只立沙面/丘面(草面归 home 树) */
  if (getBlock(x, top + 1, z) !== 0) return false;
  const th = 1 + (SceneKit.rand(x, z, salt) > 0.5 ? 1 : 0);
  for (let i = 1; i <= th; i++) setBlockRaw(x, top + i, z, 5);
  const cy = top + th + 1; /* 冠心层 */
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && SceneKit.rand(x + dx, z + dz, salt + 1) > 0.5) continue;
      if (getBlock(x + dx, cy, z + dz) === 0) setBlockRaw(x + dx, cy, z + dz, 7);
    }
  }
  if (getBlock(x, cy + 1, z) === 0) setBlockRaw(x, cy + 1, z, 7); /* 顶心 */
  return true;
}

function advEdgeSouthOutcrop(x, z) {/* 砂岩露头: 2~3 高单柱 + 贴脚一块(坐标含丘面
  堆高, 基部半埋进丘面=岩石露头观感) */
  const top = advEdgeSouthTop(x, z);
  const h = 2 + (SceneKit.rand(x, z, 8204) > 0.5 ? 1 : 0);
  for (let i = 1; i <= h; i++) setBlockRaw(x, top + i, z, B_SANDSTONE);
  setBlockRaw(x + 1, top + 1, z, B_SANDSTONE);
}

function advEdgeSouthDress() {/* 段C 饰件(南 spec §2 + 走查反馈修订 2·植被过渡):
  入口侧 b0..b3 草丛+花密度较高逐行渐降 → 带内沙斑(b4..b10)零星草丛渐稀 + 低矮
  耐旱树(b5..b8, 距 apron ≥8 列=树冠搭不了桥) → 背风沙海(b20..b31)丘原起伏 +
  洼地零星草丛/低矮树; b10/b28 枯灌木 · b21 仙人掌 2 高 · b23/b25 砂岩露头沿用;
  apron z139..143 裸沙不落件(修订 1: 防垫脚翻丘); 建场序=先堆沙海后落饰件
  (饰件坐标吃堆高, 不被沙海埋掉) */
  for (let x = 0; x < WORLD_W; x++) {
    /* 入口侧 home 植被(草面上, 0.26→0.20→0.15→0.10 逐行渐降; 花不在此撒——
    花田(ADV_MEADOW)花海 r 圈已自然漫到 z137, 「花丛只在核心圈/花田/东带」的
    全图扫描口径不被南带新花破掉) */
    if (SceneKit.rand(x, 128, 8212) > 0.74) advEdgeSouthDecorate(x, 128, B_GRASS_TUFT);
    if (SceneKit.rand(x, 129, 8212) > 0.80) advEdgeSouthDecorate(x, 129, B_GRASS_TUFT);
    if (SceneKit.rand(x, 130, 8212) > 0.85) advEdgeSouthDecorate(x, 130, B_GRASS_TUFT);
    if (SceneKit.rand(x, 131, 8212) > 0.90) advEdgeSouthDecorate(x, 131, B_GRASS_TUFT);
    /* 带内沙斑零星草丛(0.12→0.08→0.05 渐稀, 只长沙面=「沙里一撮撮绿」) */
    if (SceneKit.rand(x, 132, 8215) > 0.88 && advEdgeSurfaceId(x, 132) === 8) {
      advEdgeSouthDecorate(x, 132, B_GRASS_TUFT);
    }
    if (SceneKit.rand(x, 135, 8215) > 0.92 && advEdgeSurfaceId(x, 135) === 8) {
      advEdgeSouthDecorate(x, 135, B_GRASS_TUFT);
    }
    if (SceneKit.rand(x, 138, 8215) > 0.95 && advEdgeSurfaceId(x, 138) === 8) {
      advEdgeSouthDecorate(x, 138, B_GRASS_TUFT);
    }
    /* 低矮耐旱树(沙斑里零星; z≤136 距坡脚 z144 ≥8 列, 树冠够不着坡脚) */
    if (SceneKit.rand(x, 134, 8216) > 0.955) {
      advEdgeSouthScrub(x, 133 + Math.floor(SceneKit.rand(x, 135, 8217) * 4), 8218);
    }
    /* b10/b28 枯灌木(沿用 spec §2) */
    if (SceneKit.rand(x, 138, 8201) > 0.92) advEdgeSouthDecorate(x, 138, B_DEAD_BUSH);
    if (SceneKit.rand(x, 156, 8202) > 0.92) advEdgeSouthDecorate(x, 156, B_DEAD_BUSH);
  }
  /* 背风沙海: 0..3 丘原起伏(只堆沙面, 绿洲水不碰; 先堆后饰) */
  for (let z = 148; z <= 159; z++) {
    for (let x = 0; x < WORLD_W; x++) {
      const sh = advEdgeSouthSwell(x, z);
      if (sh <= 0) continue;
      const top = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, top, z) !== 8) continue;
      for (let i = 1; i <= sh; i++) setBlockRaw(x, top + i, z, 8);
    }
  }
  /* b21 仙人掌 2 高(沿用 spec §2, 丘面坐标) + b23/b25 砂岩露头(沿用 spec §5) */
  for (let x = 6; x < WORLD_W; x += 12) {
    const t = advEdgeSouthTop(x, 149);
    if (getBlock(x, t, 149) === 8 && getBlock(x, t + 1, 149) === 0) {
      setBlockRaw(x, t + 1, 149, B_CACTUS);
      setBlockRaw(x, t + 2, 149, B_CACTUS);
    }
  }
  advEdgeSouthOutcrop(52, 151);
  advEdgeSouthOutcrop(104, 153);
  /* 沙海零星绿意(修订 2 的远端档): 草丛只落洼地(堆高=0), 低矮树沙面上零星;
  x 从 1 起(冠层 dx±1 越界守卫在 advEdgeSouthScrub 内) */
  for (let x = 1; x < WORLD_W - 1; x++) {
    if (SceneKit.rand(x, 152, 8219) > 0.958) {
      advEdgeSouthScrub(x, 150 + Math.floor(SceneKit.rand(x, 153, 8220) * 7), 8221);
    }
    const vz = 150 + Math.floor(SceneKit.rand(x, 155, 8222) * 8);
    if (SceneKit.rand(x, 155, 8223) > 0.955 && advEdgeSouthSwell(x, vz) === 0) {
      advEdgeSouthDecorate(x, vz, B_GRASS_TUFT);
    }
  }
}

function advEdgeSouthBarrier() {/* 未解锁屏障=连绵大沙丘(南 spec §4 + 走查反馈修订 1·
  2026-11-06): 原沙暴墙柱阵被走查读成「一堵墙」——改沙丘丘原语言: 脊线沿 x 双正弦
  起伏(4..10 高渐次, 丘非墙), 剖面四段=迎风坡脚(h1 ≥2)→陡升(h2−h1=2)→脊顶(C)→
  背风肩(h4=C−2 缓落接沙海); 砂岩只做脊顶零星露头(非柱芯节奏); 屏障语义不变:
  坡脚级差 ≥2(跳跃 1.42 格翻不过)+陡升级差恒 2(垫脚石即便够到坡脚顶也止步于此),
  位置 z144..147 与 spec §4 一致; 不可挖/禁放保护判据已落地(advEdgeProtectedAt/
  advEdgeProtectedZone, T7 转正); 沙暴动效销项: 不做(C4, 2026-11-06——纯沙丘
  地形无特效件, 走查通过; 沙丘地形直接作解锁态「沙暴散去」的地形底) */
  if (advEdgeOpenDir('south')) return; /* 〔世界边界·T8〕单一开放判据换源:
     强制缝或南随 desert 解锁即不建沙丘 */
  for (let x = 0; x < WORLD_W; x++) {
    const C = advEdgeSouthCrest(x);
    const h1 = Math.max(2, Math.round(C / 2)); /* 迎风坡脚: 级差 ≥2=跳不过 */
    const h2 = Math.min(C, Math.max(h1 + 2, C - 2)); /* 陡升: 级差 ≥2 续障(C ≥ h1+2 恒成立) */
    const h4 = Math.max(1, C - 2); /* 背风肩: 缓落进沙海 */
    for (const [z, h] of [[144, h1], [145, h2], [146, C], [147, h4]]) {
      const top = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, top, z) !== 8) continue; /* 只立在带内沙面上 */
      for (let i = 1; i <= h; i++) setBlockRaw(x, top + i, z, 8);
    }
    /* 脊顶砂岩零星露头: 脊顶 1~2 块换砂岩(岩石从沙脊里探头, 走查修订「零星点缀」) */
    if (SceneKit.rand(x, 146, 8224) > 0.93) {
      const top = ADV_GROUND + advHeightAt(x, 146);
      if (getBlock(x, top + C, 146) === 8) {
        setBlockRaw(x, top + C, 146, B_SANDSTONE);
        if (SceneKit.rand(x, 147, 8225) > 0.5) setBlockRaw(x, top + C - 1, 146, B_SANDSTONE);
      }
    }
  }
}

function advEdgeSouth() {
  advEdgeRewrite(0, WORLD_W - 1, 128, 159, advEdgeSouthSurface);
  advEdgeSouthDress();
  advEdgeSouthBarrier();
}

/* ---------- 西带·沼泽(x∈[0,32), 7 patch 序, 西 spec §2/§4/§5) ---------- */

function advEdgeWestSurface(x, z) {/* 带内格序 k=31−x(东→西): 草掺泥25% → 泥嵌草斑
  → 全泥 →〔屏障深水带 k13~18〕→ 泥+苔石斑 → 沼泽暗绿 → 沼泽纯色。
  登记偏差: ⑥⑦「暗绿 #4D753D」无图集格位(零新贴图红线), 以泥/草混铺替代 */
  /* 黑巢涌出走廊钉泥(走查修订 2026-11-06): 洞口前坪 z+6..z+9 双列钉泥面——
     草丛不长上门脸(colTop 断言: 入口剖面列不被草丛顶高, 涌出怪落位不踩草皮缝) */
  const ddx = x - ADV_NESTS[3].x; const ddz = z - ADV_NESTS[3].z;
  if (ddx >= -1 && ddx <= 0 && ddz >= 6 && ddz <= 9) return [2, 0];
  const k = 31 - x;
  const r = SceneKit.rand(x, z, 8301);
  if (k <= 3) return r < 0.25 ? [2, 0] : [1, 0];
  if (k <= 7) return r < 0.75 ? [2, 0] : [1, 0];
  if (k <= 12) return [2, 0];
  if (k <= 18) {/* 迷雾深水带: 六格水体南北贯穿(泥底=沼泽水洼先例)。〔世界边界·T8〕
      解锁态换泥岸步道(west-spec §4.3 定稿内容: 同格位同坐标, 不挪带不挪传送线)
      ——泥面打底, 最西四列(k15..18)各散一个落点: k16..18 苔石垫脚×3/k15 残留
      小水洼 1 格; 锁定态冒头位 (15,48)/(16,104) 在解锁态不再落水,
      advEdgeWestBarrier 的水守卫自然让位(两处无头, 无需改 barrier)。盐 8306
      (83xx 段新档, 8301~8305 已在册不踩); 掷点域收窄 z∈[24,127]: 北避 NW 角
      z16..19(CornerSweep 融冰区), 南避 z≥128(南带沙行会被改写守卫「只换草皮」
      跳过 → 垫脚不足 3); 以世界 x 掷(最西四列各恰一落点, 确定性逐字节可钉:
      实算 x13→z108/x14→z122/x15→z84 苔石, x16→z98 水洼) */
    if (!advEdgeOpenDir('west')) return [B_WATER, 2];
    if (x > 16) return [2, 0]; /* x17/18(靠岸两列 k13/k14)纯泥, 不落垫脚 */
    const wz = 24 + Math.floor(SceneKit.rand(x, 0, 8306) * 104);
    if (z !== wz) return [2, 0];
    return x === 16 ? [B_WATER, 2] : [14, 0]; /* x16 残留水洼/x13..15 苔石垫脚 */
  }
  if (k <= 22) return r < 0.18 ? [14, 0] : [2, 0]; /* 苔石斑(id 14 T_MOSSY) */
  if (k <= 26) return r < 0.75 ? [2, 0] : [1, 0];
  return [2, 0];
}

function advEdgeWestPools() {/* 水洼(②③⑥⑦ patch): 2 格宽(沿 x)+泥底, 稀疏确定性;
  守卫=地表草/泥(屏障水带与丘体不碰); 走查修订(2026-11-06): 密度西向渐密
  (②段 0.8% → ③段 1.25%, 入口水洼稀→带内密, 配合兰花 ramp 的植被过渡),
  黑巢 r9 圈不落(副本迁驻西带随迁的守卫——水洼不淹洞口台阶/敞廊前坪,
  r9=ADV_FLATS 黑巢压平圈同款口径) */
  for (let z = 0; z < WORLD_D; z++) {
    for (let x = 0; x < 31; x++) {
      const k = 31 - x;
      const inPool = (k >= 4 && k <= 12) || (k >= 23 && k <= 26) || k >= 27;
      if (!inPool) continue;
      if (SceneKit.rand(x, z, 8302) <= (k <= 7 ? 0.992 : 0.9875)) continue;
      for (const px of [x, x + 1]) {
        const ddx = px - ADV_NESTS[3].x; const ddz = z - ADV_NESTS[3].z;
        if (ddx * ddx + ddz * ddz <= 81) continue; /* 黑巢 r9 圈: 副本门脸前坪不淹 */
        const top = ADV_GROUND + advHeightAt(px, z);
        const sid = getBlock(px, top, z);
        if (sid !== 1 && sid !== 2) continue;
        setBlockRaw(px, top, z, B_WATER);
        setBlockRaw(px, top - 1, z, 2);
      }
    }
  }
}

function advEdgeWestBarrier() {/* 迷雾深水带的点睛件: 苔石冒头 ×2(暗示水深路断);
   横雾带不走物件——由天/雾锚点在屏障处的 0.88 浓度档承担(advEdgeSkyAt west 行)。
   T7 转正(E3 销项): 岸边兰花 (13,47)/(13,105) 两处调用删除——落点在深水带列
   (x13..18), advEdgeDecorate 水面守卫恒拒=从未落花的死调用(观感零变化, 逐格
   核对两格顶上恒空); 「岸边兰花」观感诉求登记备查——若补须挪 x12/x19 泥岸列,
   属新观感须再走查, 默认不做 */
  for (const [sx, sz] of [[15, 48], [16, 104]]) {
    const top = ADV_GROUND + advHeightAt(sx, sz);
    if (getBlock(sx, top, sz) === B_WATER) setBlockRaw(sx, top + 1, sz, 14);
  }
}

function advEdgeWestHut() {/* 远景·高脚木屋剪影(西 spec §5): 原木桩柱 ×4 + 木板屋身 +
  阶梯屋顶, 立在屏障以西雾区(块件只管形体, 「雾中显影」由天/雾锚点承担);
  暖窗光=顶沿火把(夜间发光, 实心下方=清扫安全); 桩脚从各自地面顶到地板, 地形
  起伏不悬空(超埋段被地形吞掉=雾中半埋, 可接受) */
  const x1 = 0; const x2 = 4; const z1 = 22; const z2 = 26;
  for (const [cx, cz] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) {
    const t = ADV_GROUND + advHeightAt(cx, cz);
    for (let y = t + 1; y <= ADV_GROUND + 3; y++) setBlockRaw(cx, y, cz, 5);
  }
  SceneKit.fill(x1, ADV_GROUND + 4, z1, x2, ADV_GROUND + 4, z2, 6); /* 地板 y28 */
  for (const y of [ADV_GROUND + 5, ADV_GROUND + 6]) {
    SceneKit.fill(x1, y, z1, x2, y, z1, 6);
    SceneKit.fill(x1, y, z2, x2, y, z2, 6);
    SceneKit.fill(x1, y, z1 + 1, x1, y, z2 - 1, 6);
    SceneKit.fill(x2, y, z1 + 1, x2, y, z2 - 1, 6);
  }
  SceneKit.fill(x1, ADV_GROUND + 7, z1, x2, ADV_GROUND + 7, z2, 6); /* 顶 y31 */
  SceneKit.fill(x1 + 1, ADV_GROUND + 8, z1 + 1, x2 - 1, ADV_GROUND + 8, z2 - 1, 6); /* 阶梯上层 */
  setBlockRaw(x1, ADV_GROUND + 8, z1 + 1, B_TORCH); /* 暖窗光 */
  advEdgeDecorate(6, 20, B_ORCHID); /* 木屋近旁兰花 ×2(远景清单) */
  advEdgeDecorate(6, 28, B_ORCHID);
}

function advEdgeWestOrchids() {/* ⑤段/⑦段兰花散布(西 spec §2 表): 稀疏确定性;
  走查修订(2026-11-06): 增入口段渐密 ramp(x28..31 0.3% → x24..27 0.5% →
  x19..23 0.8%, 盐 8305 新档不踩既有 83xx)——home 草丛随带内草皮份额自然消长
  (改写段草皮东密西疏), 兰花反向渐密, 植被消长全程发生在带内;
  黑巢 r9 圈不落(副本门脸不长花, 压平圈同款口径) */
  for (let z = 0; z < WORLD_D; z++) {
    if (SceneKit.rand(11, z, 8303) > 0.995) {
      advEdgeDecorate(10 + Math.floor(SceneKit.rand(11, z, 8304) * 4), z, B_ORCHID);
    }
    if (SceneKit.rand(2, z, 8303) > 0.995) {
      advEdgeDecorate(Math.floor(SceneKit.rand(2, z, 8304) * 5), z, B_ORCHID);
    }
    for (let x = 19; x <= 31; x++) {
      const k = 31 - x;
      const p = k <= 3 ? 0.003 : (k <= 7 ? 0.005 : 0.008);
      if (SceneKit.rand(x, z, 8305) <= 1 - p) continue;
      const ddx = x - ADV_NESTS[3].x; const ddz = z - ADV_NESTS[3].z;
      if (ddx * ddx + ddz * ddz <= 81) continue; /* 黑巢 r9 圈 */
      advEdgeDecorate(x, z, B_ORCHID);
    }
  }
}

function advEdgeWest() {
  advEdgeRewrite(0, 31, 0, WORLD_D - 1, advEdgeWestSurface);
  advEdgeWestPools();
  advEdgeWestBarrier();
  advEdgeWestHut();
  advEdgeWestOrchids();
}

/* ---------- 东带·小镇(x∈[128,159], ①②③ 段, 东 spec §3/§5/§6) ----------
   T7 拍板 Q1 销项登记(2026-11-06, 登记偏差全维持走查通过现状):
   ①栅栏碰撞「1.5 格(MC 先例)」≈桩 2/缝 1 的整格近似——跳缝=翻越彩蛋;
   ②花田红花无图集格位, 维持黄/白二色;
   ③告示牌牌面=拼块形制无字;
   ④远景剪影以石色替代(深蓝灰系无格位)。未来升级(牌面写字/深蓝灰格位/红花)
   一律走独立图集票, 不回 T7。 */

function advEdgeEastDress() {/* 渐变节奏(东 spec §3): 草色全程不插值, 渐变全靠地表块
  种类密度——①入口段土路斑 1 patch(x132~135, 主径线 z73~76)·②渐密段土斑
  2 patch + 花田 2 处(主径两侧各 5 朵)。登记偏差: 花田「黄/红/白」红花无图集
  格位(零新贴图), 以黄/白二色铺(T7 拍板 Q1 销项: 维持二色) */
  const dirt = () => [2, 0];
  advEdgeRewrite(132, 135, 73, 76, dirt);
  advEdgeRewrite(140, 143, 70, 73, dirt);
  advEdgeRewrite(148, 151, 76, 79, dirt);
  for (let i = 0; i < 5; i++) {
    advEdgeDecorate(144 + (i % 3), 66 + i * 2,
        SceneKit.rand(i, 0, 8401) > 0.5 ? B_FLOWER_Y : B_FLOWER_W);
    advEdgeDecorate(144 + ((i + 1) % 3), 84 - i * 2,
        SceneKit.rand(i, 1, 8401) > 0.5 ? B_FLOWER_Y : B_FLOWER_W);
  }
  advEdgeRewrite(152, 156, 74, 75, dirt); /* ③主径: 与既有东向小径同轴延长 */
}

function advEdgeEastSign() {/* 告示牌(东 spec §5): 立式双柱牌 x156, 板面朝主径;
  牌面=拼块形制无字(T7 拍板 Q1 销项); 不可挖保护判据已落地(advEdgeProtectedAt
  东向恒保护, T7 转正) */
  const x = 156;
  const yb = ADV_GROUND + advHeightAt(x, 74);
  for (const z of [73, 76]) {
    for (let y = yb + 1; y <= yb + 3; y++) setBlockRaw(x, y, z, 5);
  }
  SceneKit.fill(x, yb + 3, 74, x, yb + 4, 75, 6); /* 板面(两柱间 2×2) */
}

function advEdgeEastFence() {/* 木栅栏横贯东缘 x157(东 spec §5): 桩间留缝是设计本体
  ——原木柱(2 高)每 3 格一根, 缝格木板横杆(1 高), 缝口净空露出剪影=「看得见、
  过不去、但不堵心」; 碰撞≈桩 2/缝 1 整格近似(T7 拍板 Q1 销项, 跳缝=翻越彩蛋);
  挖/替换保护判据已落地(advEdgeProtectedAt 东向恒保护), 放置不设禁放柱
  (翻越=彩蛋口径, T7 转正) */
  for (let z = 0; z < WORLD_D; z++) {
    const y = ADV_GROUND + advHeightAt(157, z) + 1;
    if (z % 3 === 0) {
      setBlockRaw(157, y, z, 5);
      setBlockRaw(157, y + 1, z, 5);
    } else {
      setBlockRaw(157, y, z, 6);
    }
  }
}

function advEdgeEastTree(x, baseY, z) {/* 圆冠树(贴边裁冠版, SceneKit.tree 同语言):
  树干原木 4~6 高 + 冠层叶只落空气格; lx ≥ WORLD_W 不写——隔离带 x158 贴世界
  东缘, rad2 冠层的 lx=160 会 OOB 泄进 x=0 西缘列(平面数组回卷), 冠层就地裁半 */
  const th = 4 + Math.floor(SceneKit.rand(x + 7, z + 3, 8402) * 3);
  for (let i = 0; i < th; i++) setBlockRaw(x, baseY + i, z, 5);
  const top = baseY + th;
  for (let dy = -1; dy <= 1; dy++) {
    const rad = dy === 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dz = -rad; dz <= rad; dz++) {
        if (dx === 0 && dz === 0 && dy < 1) continue;
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad === 2) continue;
        const lx = x + dx; const ly = top + dy - 1; const lz = z + dz;
        if (lx >= WORLD_W) continue; /* 贴边裁冠(界外不写) */
        if (getBlock(lx, ly, lz) === 0) setBlockRaw(lx, ly, lz, 7);
      }
    }
  }
  setBlockRaw(x, top, z, 7);
}

function advEdgeEastSkyline() {/* 小镇远景剪影(东 spec §6): 房屋×4+钟楼×1+圆冠树×2+
  灯点 4 粒, 落栅栏外隔离带 x158~159(体素拼块=「近看不穿帮」约束的便宜实现)。
  登记偏差: 深蓝灰 #5A6B7A 系无图集格位(零新贴图), 以石色剪影替代(T7 拍板 Q1
  销项: 维持石色, 深蓝灰新格位走独立图集票); 灯点=火把(夜间发光, 「还没建好但
  已经有灯亮着」的情绪钩子) */
  const houses = [[24, 3], [56, 5], [88, 4], [120, 3]]; /* [z, 高]——高低错落 3~5 格 */
  let lamps = 0;
  for (const [z, h] of houses) {
    const top = ADV_GROUND + advHeightAt(158, z);
    for (let x = 158; x <= 159; x++) {
      for (let y = top + 1; y <= top + h; y++) setBlockRaw(x, y, z, 3);
    }
    /* 窗灯 ×3(首屋留白凑「3 窗灯+1 塔灯=4 粒」) */
    if (z !== 24) {
      setBlockRaw(158, top + h + 1, z, B_TORCH);
      lamps++;
    }
  }
  const tt = ADV_GROUND + advHeightAt(158, 74); /* 钟楼: 塔身 7 高全场最高 + 尖顶 + 顶灯 */
  for (let x = 158; x <= 159; x++) {
    for (let y = tt + 1; y <= tt + 7; y++) setBlockRaw(x, y, 74, 3);
  }
  setBlockRaw(158, tt + 8, 74, 5);
  setBlockRaw(159, tt + 8, 74, B_TORCH);
  lamps++;
  advEdgeEastTree(158, ADV_GROUND + advHeightAt(158, 40) + 1, 40); /* 圆冠树 ×2(贴边裁冠) */
  advEdgeEastTree(158, ADV_GROUND + advHeightAt(158, 108) + 1, 108);
  return lamps;
}

function advEdgeEast() {
  advEdgeEastDress();
  advEdgeEastSign();
  advEdgeEastFence();
  advEdgeEastSkyline();
}

/* ---------- 四角交接·post-pass(〔边界转正·T7〕第 5 员工, 2026-11-06) ----------
   四向带区总装后的一处收口: 相邻两个目标生态在角区「握手」——地形让势 + 植物
   消长, 零悬空/零浮树/零穿模。四角定义: NW=x0..31×z0..23, NE=x128..159×z0..23,
   SW=x0..31×z128..159, SE=x128..159×z128..159。红线遵守: 不改写四向已审函数段
   (本段只换世界已有表面块, 顶上有物一律跳过=树脚/仙人掌/饰件脚下不掏); 东带
   定稿件(栅栏 x157/告示牌/主径/花田/剪影/圆冠树)坐标零重叠——栈桩落在栅栏件
   正下方的水面格, 不写栅栏坐标; 北山脊/南沙丘主体剖面不动(角区只做端部收尾
   让势); 黑巢 r9 圈不在本段射程(西带中段, 非角区)。装饰盐 8501~8507(85xx 新段,
   全仓 grep 无撞号: 北 81xx/南 82xx/西 83xx/东 84xx/远征图 62xx~64xx)。
   建场次序背景(2026-11-06 勘察结论): advBuildEdgeBands 北→南→西→东, 后写者赢
   ——但 advEdgeRewrite 只换草皮(id 1), 北带雪/南带沙顶住后续改写, 故: NW 角=
   北雪压西沼(西向泥水只在草皮行 z16..23 现身成马赛克); SW 角=南带 G 行草皮被
   西带改写成泥水, 与沙行拼成条纹马赛克, 深水带 x13..18 在 z135 一刀切断;
   SE 角=东栅栏后写嵌进沙丘脊迎风面(读作流沙半埋)且绿洲水行 z153/154/南缘水
   z159 的桩杆脚下是水(真悬空); NE 角=山体东端收势已让位栅栏, 唯 z12..15 雪线
   贴栅栏过直。 */

/* ---------- 四角梯度参数(T7 P7 提常量, 四 spec 四角交接小节出处; 原式逐字
   搬运含浮点运算序——快照零漂移, 验收=重构前后 advBuildWorld 逐字节一致。
   命名口径: 数据表=CONSTANT_CASE; 公式型梯度(返回函数的常量)走 adv camelCase
   (new-cap 红线: 大写名按构造函数把门), 同段集中不改) ---------- */
const ADV_EDGE_CORNER_NW_P_ICE = [0.75, 0.55, 0.35, 0.15];
/* NW 浮冰密度(按 z16..19 索引): 北密南疏(north/west spec 四角交接) */
const ADV_EDGE_CORNER_NW_P_MUD = [0.6, 0.45, 0.3, 0.15];
/* NW 泥融密度(按 z16..19 索引): 同向北强 */
const ADV_EDGE_CORNER_NE_P_THAW = [0.7, 0.6, 0.45, 0.25];
/* NE 融雪密度(按 z12..15 索引): 北强南弱, 往带内递减(north/east spec 四角交接) */
const advEdgeCornerSwFz = (z) => Math.max(0, 1 - (z - 128) / 14);
/* SW 带缘衰减(z128..142): 愈深入沙带愈轻, z142 归零(south/west spec 四角交接) */
const ADV_EDGE_CORNER_SW_P_WATER = {135: 0.55, 136: 0.4, 138: 0.3, 139: 0.2, 140: 0.12, 141: 0.06, 142: 0.03};
/* SW 潮尾概率(z135..142 逐键; z137 缺键=该行不落水) */
const advEdgeCornerSeFz = (z) => Math.max(0, Math.min(1, (138 - z) / 10 + 0.25));
/* SE 草甸楔带缘强(z128..138): apron 前收势(east/south spec 四角交接) */
const advEdgeCornerSeP = (x) => Math.max(0, Math.min(1, (x - 136) / 21));
/* SE 草甸楔横向强: 近栅栏强、西向弱 */

function advEdgeCornerNW() {/* NW 角·雪原×沼泽(冻沼渐变): 西带深水带/泥楔被北带雪原
  改写挡到 z16 才现身(单格水洼嵌雪=马赛克断层)——补一段向北渐冻: 水面→冰(浮冰
  越北越密, 接 z15 纯雪带), 泥面→雪覆草(越北越融, 草探头=消长); 西带兰花 ramp
  穿带误落雪/冰/石面者, 脚下换融斑泥点(植株原地留=融雪湖畔开花)。盐 8502/8503/8504 */
  for (let z = 16; z <= 19; z++) {
    const pIce = ADV_EDGE_CORNER_NW_P_ICE[z - 16];
    const pMud = ADV_EDGE_CORNER_NW_P_MUD[z - 16];
    for (let x = 0; x <= 31; x++) {
      const t = ADV_GROUND + advHeightAt(x, z);
      const sid = getBlock(x, t, z);
      if (sid === B_WATER) {
        if (SceneKit.rand(x, z, 8502) < pIce) {
          setBlockRaw(x, t, z, B_ICE);
          if (getBlock(x, t - 1, z) === 2) setBlockRaw(x, t - 1, z, B_WATER); /* 冰下垫水(北带冰湖先例) */
        }
      } else if (sid === 2 && getBlock(x, t + 1, z) === 0 &&
          SceneKit.rand(x, z, 8503) < pMud) {
        setBlockRaw(x, t, z, B_SNOWY_GRASS);
      }
    }
  }
  /* 误落兰花脚下换泥(只动地表不搬植株) */
  for (let z = 0; z <= 23; z++) {
    for (let x = 0; x <= 31; x++) {
      const t = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, t + 1, z) !== B_ORCHID) continue;
      const sid = getBlock(x, t, z);
      if (sid === B_SNOW || sid === B_SNOWY_GRASS || sid === 3) {
        setBlockRaw(x, t, z, 2); /* 融斑泥点; 冰面不换——z0 冰湖镜带整行冰是北带定稿 */
      }
    }
  }
}

function advEdgeCornerNE() {/* NE 角·雪山×小镇(镇郊融雪楔): 山体东端收势(x144 起峰高
  线性收没)已由 MountainH 让位栅栏, 角区只补一小步——x146..156 雪面→雪覆草, 越
  北越稀(草线绕栅栏北端轻微回勾, 与 p2 草雪混铺行相接); 山体足迹格(顶上有石/冰)
  与已定稿的远排小杉(x118..142)天然让位。盐 8501 */
  for (let z = 12; z <= 15; z++) {
    const p = ADV_EDGE_CORNER_NE_P_THAW[z - 12];
    for (let x = 146; x <= 156; x++) {
      const t = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, t, z) !== B_SNOW) continue;
      if (getBlock(x, t + 1, z) !== 0) continue; /* 山体足迹/饰件不换 */
      if (SceneKit.rand(x, z, 8501) < p) setBlockRaw(x, t, z, B_SNOWY_GRASS);
    }
  }
}

function advEdgeCornerSW() {/* SW 角·沙丘×沼泽(沙洲没入沼泽): 南带 G 行草皮被西带改写
  成泥/水后与沙行拼成条纹马赛克, 深水带 x13..18 在 z135 一刀切断——补两笔让势:
  ①角区西半沙面→泥(75%)/草斑(25%), 强度随距西缘/带缘衰减(角区东缘让给沙丘,
  脊线 z144..147 与丘原 z148+ 冻结不碰); ②潮尾: 深水带列的沙面接回绿洲水+沙底
  (南带 W 行同语言)向南渐稀归零。误落沙面的兰花换枯灌木(沙地语义, 原地换种)。
  盐 8505/8507/8504 */
  for (let z = 128; z <= 142; z++) {
    const fz = advEdgeCornerSwFz(z);
    for (let x = 0; x <= 31; x++) {
      const t = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, t, z) !== 8) continue; /* 只融沙(G 行泥/水已是沼泽语言) */
      if (getBlock(x, t + 1, z) !== 0) continue; /* 耐旱树/仙人掌/饰件脚下不掏 */
      /* 潮尾优先(只列 x13..18): 沙面→绿洲水(水面+沙底), 向南渐稀 */
      if (x >= 13 && x <= 18 && z >= 135) {
        const pW = ADV_EDGE_CORNER_SW_P_WATER[z];
        if (pW && SceneKit.rand(x, z, 8507) < pW) {
          setBlockRaw(x, t, z, B_WATER);
          setBlockRaw(x, t - 1, z, 8);
          continue;
        }
      }
      const p = Math.max(0, 1 - x / 36) * fz; /* 西缘强、角区东缘弱(沙丘东行不碰) */
      if (p <= 0.02) continue;
      const r = SceneKit.rand(x, z, 8505);
      /* 草斑只铺 x≤18(深水带以西的沼泽侧): x19..23 是西带「全泥段」——
         西带植被过渡单测钉死该列带全 z 无草皮(rDeep===0), 草皮语言不得越列 */
      if (x <= 18 && r < p * 0.25) setBlockRaw(x, t, z, 1); /* 草斑: home 草皮随散布长草丛 */
      else if (r < p) setBlockRaw(x, t, z, 2); /* 泥: 沼泽吞沙 */
    }
  }
  /* 误落沙面的兰花→枯灌木(沙地语义) */
  for (let z = 128; z <= 159; z++) {
    for (let x = 0; x <= 31; x++) {
      const t = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, t + 1, z) === B_ORCHID && getBlock(x, t, z) === 8) {
        setBlockRaw(x, t + 1, z, B_DEAD_BUSH);
      }
    }
  }
}

function advEdgeCornerSE() {/* SE 角·沙丘×小镇(流沙半埋栅栏+草甸南侵): 东栅栏后写嵌进
  沙丘脊迎风面(z144..147 的嵌木读作「流沙半埋栅栏」, 脊线剖面冻结不动)——真悬空
  只有一处: 绿洲水行 z153/154 与南缘水 z159 的桩/杆脚下是水, 落原木栈桩支起(栅栏
  桩打在水床的读法, 坐标在栅栏件正下方, 不写栅栏件本身); 镇南郊补草甸南侵楔:
  近栅栏平沙→草皮(草丛随散布归乡, 两端植物此消彼长), apron z139..143 净空(防垫脚
  翻丘, 南带走查修订 1)不碰——楔止步 z138; 仙人掌/枯灌木/草丛脚下不掏。盐 8506 */
  for (const z of [153, 154, 159]) {
    const t = ADV_GROUND + advHeightAt(157, z);
    if (getBlock(157, t, z) === B_WATER && getBlock(157, t + 1, z) !== 0) {
      setBlockRaw(157, t, z, 5); /* 原木栈桩(半埋水面格, 支起栅栏桩/杆) */
    }
  }
  for (let z = 128; z <= 138; z++) {
    const fz = advEdgeCornerSeFz(z);
    for (let x = 144; x <= 157; x++) {
      const t = ADV_GROUND + advHeightAt(x, z);
      if (getBlock(x, t, z) !== 8) continue; /* 只接平沙(G 行草皮/脊线不碰) */
      if (getBlock(x, t + 1, z) !== 0) continue; /* 仙人掌/枯灌木/草丛脚下不掏 */
      const p = advEdgeCornerSeP(x) * fz;
      if (SceneKit.rand(x, z, 8506) < p) setBlockRaw(x, t, z, 1); /* 草皮: 镇郊草甸南侵 */
    }
  }
}

function advEdgeCornerSweep() {/* 角区收尾安检: 植物件(草丛/枯灌木/兰花/花)脚下是水
  的悬空株一律垫泥洲(水面格换泥, 植株原地落脚)——南带 G 行草丛先落、西带改写/池
  水后至造成的「草丛漂水面」在角区归零(零悬空红线) */
  for (const [x1, x2, z1, z2] of [
    [0, 31, 0, 23], [128, 159, 0, 23], [0, 31, 128, 159], [128, 159, 128, 159]]) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        const t = ADV_GROUND + advHeightAt(x, z);
        const pid = getBlock(x, t + 1, z);
        if (pid !== B_GRASS_TUFT && pid !== B_DEAD_BUSH && pid !== B_ORCHID &&
            pid !== B_FLOWER_Y && pid !== B_FLOWER_W) continue;
        if (getBlock(x, t, z) !== B_WATER) continue;
        setBlockRaw(x, t, z, 2); /* 泥洲垫脚 */
      }
    }
  }
}

function advEdgeCorners() {/* 四角 post-pass 总入口(挂 advBuildEdgeBands 末, 一处收口):
  先让势后安检——各角函数只换表面块/垫桩, 零 Math.random(SceneKit.rand 确定性) */
  advEdgeCornerNW();
  advEdgeCornerNE();
  advEdgeCornerSW();
  advEdgeCornerSE();
  advEdgeCornerSweep();
}

function advBuildEdgeBands() {/* 边界带总装(确定性): 建场序挂结构段之后/植被之前——
  带内地表换装后, 草丛/花田的「脚下草皮」判据天然不在雪/沙/泥上重播; 橡树落位
  清单(advTreeSpots 纯函数)不受影响, 少数树落进带内=可接受的过渡杂木;
  北→南→西→东后写者赢, 末尾四角 post-pass 收口(相邻生态角区握手+角区安检) */
  advEdgeNorth();
  advEdgeSouth();
  advEdgeWest();
  advEdgeEast();
  advEdgeCorners(); /* 〔边界转正·T7〕四角交接(第 5 员工): 见四角段头注 */
}

function advBuildWorld() {/* 建场总装: 场景函数确定性重建(build 模式同款架构);
  T5 核心圈四件(广场/农田/围栏/小径)在地形与既有结构之后、树之前——树与散布件
  经避让判据/顶上无物判据自动让位; 2026-10-27 主题五件入列: 南池/望塔/石阵随
  结构段, 松林随树段, 花田殿后(贴草皮顶上无物判据, 不叠草丛);
  〔边界转正·T7〕四方向过渡带挂结构段末(带是 home 图专属, 远征图不挂) */
  advBaseTerrain();
  advBuildLake();
  advScatterOres();
  for (const p of ADV_PITS) advBuildPit(p);
  advBuildCave();
  advBuildHut();
  for (const n of ADV_NESTS) (n.den ? advBuildDenNest : advBuildNest)(n); /* 黑巢分派(den-nest §2) */
  advBuildPlaza();
  advBuildFarm();
  advBuildPen();
  advBuildPath();
  advBuildPond();
  advBuildTower();
  advBuildStones();
  advBuildEdgeBands(); /* 〔边界转正·T7〕四方向过渡带(正式建场件, T7 转正收编) */
  advPlantTrees();
  advBuildPineGrove(); /* 松林圈内橡树已被避让判据排除, 序仅定确定性 */
  advScatterTufts(); /* 树立好再撒草丛(顶上无物判据吃树干占位) */
  advScatterFlowers();
  advBuildMeadow();
}

/* ---------- 边界保护政策(T7 转正新增, 施工方案 §2 P2/P3; 判据依据 T6 修订 v2
   唯一保护清单) ----------
   选型=「坐标+件纯函数」(方案 P2 裁定): 零状态(无模块级 Set/旗标位)·零
   THREE/DOM·零 Math.random·零建场改动。同源原则(方案 R3): 判据直接调用各向
   建场权威函数/同一坐标式, 不抄几何公式第二份; 实施中发现判据与建场漂移,
   以建场为准修判据。三向保护随 advEdgeOpenDir 单一开放判据**逐向**门控
   (〔世界边界·T8〕落地: 强制缝 OR 解锁派生, T7 的 R6「判据自动跟随」承诺
   由它兑现——分向解锁只让开对应向); 东向栅栏/告示牌/栈桩无解锁语义,
   恒保护。消费方(波次一·乙 / 波次二 TEST): 挖掘守卫
   与放置替换守卫经 hardText 扩缝调 advEdgeProtectedAt; 翻越拦截经
   opts.placeGuard 注入调 advEdgeProtectedZone——两者均为事件路径(mineTick
   起手/tryPlace 点击), 零逐帧成本(方案 §3.2-5)。 */

function advEdgeProtectedAt(x, y, z) {/* 不可挖判据(T6 v2: 三向未解锁屏障件+
  东向栅栏/告示牌/栈桩=像基岩, 不可挖不可替换) */
  const top = ADV_GROUND + advHeightAt(x, z); /* 列地形面(与带内地表改写同一高度权威) */
  /* 北·山体列: 几何唯一权威=advEdgeNorthMountainH(Barrier 建体同源), 命中
     范围以函数现算为准(当前种子实测 z4..15; 北 spec §7 旧矩形 z∈[11,13]
     已失准不用)。误伤登记(R2 同款): 让势格无山体实体也在保——山洞口小丘
     (x61..62/z6..13 泥面)/敞廊空气面落在山体足迹内, 洞口顶面挖/放受限,
     解锁态随判据整体让开; G2 实机走查复核接受度 */
  if (!advEdgeOpenDir('north') && advEdgeNorthMountainH(x, z) > 0 && y >= top) return true;
  /* 南·沙丘脊列 z144..147: 权威剖面在 advEdgeSouthBarrier(脊体立带内沙面,
     top+1..top+h), y≥地形面整段在保(含脊顶砂岩露头; south-spec §4) */
  if (!advEdgeOpenDir('south') && z >= 144 && z <= 147 && y >= top) return true;
  /* 西·迷雾深水带列 x13..18: 权威=advEdgeWestSurface k13..18 的[水,泥底]
     列带+advEdgeWestBarrier 苔石冒头(top+1)——水体格(面)/泥岸格(底)/苔石
     坐标一格不落(west-spec §4; 判据按列带坐标不读块 id, 角区后写换装
     (NW 融冰/SW 潮尾水)天然同在保; 〔世界边界·T8〕解锁态判据让开与地表
     换泥岸步道同口advEdgeOpenDir, 步道块可正常挖放) */
  if (!advEdgeOpenDir('west') && x >= 13 && x <= 18 && y >= top - 1 && y <= top + 1) return true;
  /* 东·栅栏线 x157(east-spec §5): 杆/桩基 y0 恒在(全 z 无条件写, 判据同式
     无条件), 桩顶 y0+1 只 z%3===0 桩位, 栈桩 y0−1 只 z153/154/159(SE 角
     post-pass 原木桩脚; 已逐格核对三格均实落桩=建场实录) */
  if (x === 157) {
    const y0 = top + 1; /* = ADV_GROUND + advHeightAt(157,z)+1(advEdgeEastFence 同式) */
    if (y === y0) return true;
    if (z % 3 === 0 && y === y0 + 1) return true;
    if ((z === 153 || z === 154 || z === 159) && y === y0 - 1) return true;
  }
  /* 东·告示牌 x156(east-spec §5): 双柱 z73/76=yb+1..yb+3, 板面 z74/75=
     yb+3..yb+4; 锚 yb 取 advHeightAt(156,74)(advEdgeEastSign 同式) */
  if (x === 156) {
    const yb = ADV_GROUND + advHeightAt(156, 74);
    if ((z === 73 || z === 76) && y >= yb + 1 && y <= yb + 3) return true;
    if ((z === 74 || z === 75) && y >= yb + 3 && y <= yb + 4) return true;
  }
  return false;
}

function advEdgeProtectedZone(x, z) {/* 翻越拦截判据(P3, T6 v2 授权口径): 三向
  未解锁屏障足迹列整列禁放(y 全高——垫塔/架桥第一格必落禁放列, 零旁路, 判据
  最简纯 x/z 不读高度场); 东向恒 false=翻栅栏彩蛋(拍板语义: 桩 2 格跳不过,
  缝格木板 1 格可跳) */
  if (!advEdgeOpenDir('north') && advEdgeNorthMountainH(x, z) > 0) return true; /* 北: 山体足迹列 */
  if (!advEdgeOpenDir('south') && z >= 144 && z <= 147) return true; /* 南: 沙丘脊列(south-spec §4) */
  if (!advEdgeOpenDir('west') && x >= 13 && x <= 18) return true; /* 西: 深水带列(west-spec §4) */
  return false;
}

/* ============================================================
   〔世界边界·T11〕过渡带主题夜怪（邻接世界主题换怪, T7 拍板 Q2 立票实施）
   ------------------------------------------------------------
   2026-11-06 用户拍板「按主题换怪」（未采纳「全域同池」推荐,
   docs/world-edge-tickets.md T11 段为权威）: home 图过渡带夜间刷怪按
   玩家落点邻接带主题换怪。判据=落点 → 邻接带主题 O(1) 查表, 主题池返回
   共享常量引用或 null——壳层夜怪铺法每帧消费零分配零世界读（性能红线
   同 T7: 零逐帧新增）。
   · 带矩形与四带建场权威同源（不抄第二份几何）: 北 z<24=advEdgeNorth
     建场矩形 z0..23 / 南 z≥128=advEdgeSouth z128..159 / 西 x<32=
     advEdgeWest x0..31（本文件 T2~T5 建场段「落位坐标口径」段头同文;
     改带先改建场, 本判据数值随改）。东向不设主题（x≥128 → null=home
     同池——小镇是彩蛋收尾方向, 票面「东向或维持 home 同池」取维持）。
   · 四角重叠归属按既有检序北→南→西取先（advEdgeTransitDirAt/advEdgeHintAt
     同款裁定; 东向无主题不参序）。
   · 怪种配置表: 北雪原带=流浪者 stray / 南沙漠带=尸壳 husk（用户拍板
     既定, 皮肤资产在册 mob-look）; 西沼泽带=沼骸 bogged（在册怪种按
     沼泽主题选型: MC 官方沼泽骷髅变体, 与远征沼泽图夜池主角同款——
     adventure-maps-core swamp 行 nightPool 同怪, T2 池参数化先例）。
   · 与夜怪封顶兼容: 只换「铺什么怪」不换「怎么铺」——ADV_NIGHT.CAP/
     环带/光照门/节拍/清场/家锚全走既有路径（壳 advNightLayRing 只换
     池来源一行, js/modes/adventure.js 同名段）。
   ============================================================ */
const ADV_EDGE_NIGHT_POOL = {/* 带主题 → 夜怪池（格式同 ADV_NIGHT.POOL 的
   [种, 权重] 二元组清单; 各带单种——主题换怪是「换主角」不是「换整池」,
   权重位留池格式同构, CAP 配额语义不变） */
  snow: [['stray', 1]], /* 北雪原带: 流浪者(雪原骷髅变体) */
  desert: [['husk', 1]], /* 南沙漠带: 尸壳(沙漠僵尸变体) */
  swamp: [['bogged', 1]], /* 西沼泽带: 沼骸(沼泽骷髅变体, 选型理由见段头) */
};

function advEdgeThemeAt(x, z) {/* 玩家落点 → 邻接带主题键(纯几何 O(1) 查表,
    零分配零世界读; 命中返回 ADV_EDGE_NIGHT_POOL 键, 带外腹地返回 null=
    home 同池)。带缘数值与四带建场矩形一字同源(见段头), 角区检序北→南→西 */
  if (z < 24) return 'snow'; /* 北带 z∈[0,24) 全 x(advEdgeNorth z0..23) */
  if (z >= 128) return 'desert'; /* 南带 z∈[128,160) 全 x(advEdgeSouth z128..159) */
  if (x < 32) return 'swamp'; /* 西带 x∈[0,32) 全 z(advEdgeWest x0..31) */
  return null; /* 腹地与东带(x≥128)=home 同池(东向不设主题) */
}

function advEdgeNightPoolAt(x, z) {/* 落点 → 主题夜怪池(壳层铺法的换装缝):
    命中返回共享池引用(零分配), 未命中 null=壳回落当前地图行池(现状逐位) */
  const theme = advEdgeThemeAt(x, z);
  return theme ? ADV_EDGE_NIGHT_POOL[theme] : null;
}

/* ---------- 死亡政策(纯函数段): 满血 + 回出生点 + 背包保留(零惩罚哲学) ---------- */
function advDeathPlan(player, spawn) {
  return {hp: player.maxHp, x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw, keepInv: true};
}

/* ---------- 回小屋逃生口(2026-10-23 玩法实测补): 冷却判据纯函数 ----------
    自挖竖井/TNT 弹坑可能困住玩家(跳跃 1.42 格 < 2 格直壁), 与死亡同一传送
    口径但零惩罚措辞; 60s 冷却防滥用(躲怪用)。壳 advGoHome 只做传送/回血/
    落盘/话术, 判据在此。 */
const ADV_HOME_CD = 60; /* 回家冷却秒数(窗口内拒绝) */
function advHomeReady(cd, now) {/* 冷却判据(边界恰 ADV_HOME_CD 秒算就绪); cd 为上次
    使用的时刻账(壳持有, 初始 -1e9=从未用过), now 为当前秒 */
  return now - cd >= ADV_HOME_CD;
}

/* ============================================================
   巢穴战斗掉落 (T14, 设计稿 D6/D11/D9) — 常量与纯函数段
   ------------------------------------------------------------
   儿童可控口径(半径与节拍自行配平, 出处标注):
   · 每巢存量 2~3 只(MC 刷怪笼感觉, 但封顶不滚雪球) · 全清 60s 再刷
     (每巢独立计时 — 一个巢清完不影响另外两个) · 出生环带 1.5~4.5 格
     (洞口附近不贴脸: 巢中心 2 格土丘, 环带落在丘脚一圈)。
   · 索敌半径 12: 玩家进巢区才被追(草原视距内看得见来敌, 巢间不串联);
     收队半径 16: 怪被击退/引诱出巢超此距离就掉头回家(不会一路追到
     出生小屋 — 三巢到小屋最近 ~27 格, 永远收队)。
   · 单击伤害封顶 10(苦力怕表值 33 → 10: 满血 30 三击才倒, 不秒杀)。
   · 挥击 meleeR 3.0 / swingCd 0.38 / 攻击姿态 0.5s 全部照 nether 口径,
     玩家触及盖过全部近战怪(2.0~2.2) — 先手优势给孩子的。
   ============================================================ */
const ADV_NEST_MIN = 2; const ADV_NEST_MAX = 3; /* 每巢存量(D11) */
const ADV_NEST_RESPAWN_T = 60; /* 全清到再刷的间隔秒数(D11) */
const ADV_NEST_AGGRO_R = 12; /* 索敌半径: 玩家距怪 ≤ 此值才开战 */
const ADV_NEST_LEASH_R = 16; /* 收队半径: 怪离巢超此值不再追, 掉头回巢 */
const ADV_NEST_HOME_R = 2; /* 到家判定: 距巢 ≤ 此值原地驻守 */
const ADV_NEST_RING_LO = 1.5; const ADV_NEST_RING_HI = 4.5; /* 出生环带(洞口附近不贴脸) */
const ADV_DMG_CAP = 10; /* 怪物对玩家单击伤害封顶(儿童不秒杀) */
const ADV_MELEE_R = 3.0; const ADV_SWING_CD = 0.38; /* 玩家挥击触及/冷却(nether 口径) */
const ADV_FIST_DMG = 3; /* 空手伤害(D9) */
const ADV_AIM_COS = 0.5; /* 准星锥余弦(±60°): 「对准星方向最近怪」的朝向门槛 */
const ADV_ATTACK_T = 0.5; /* 怪物挥击姿态时长(nether 同款, gait 第 4 参) */
const ADV_ARROW_SPEED = 16; /* 骷髅箭速(竞技场/nether 弹道档) */
const ADV_SNOWBALL_SPEED = 12; const ADV_SNOWBALL_G = 14; /* 雪球弹道: 低初速高重力(比箭慢比箭坠, T9 打雪仗) */
const ADV_SNOWBALL_KPOW = 1.1; /* 雪球击退力(零伤害红线: 只推不疼, 重击退档) */
const ADV_SNOWBALL_LIFE = 1.6; const ADV_SNOWBALL_CD = 0.6; /* 雪球寿命/投掷冷却秒(T9) */
const ADV_BOW_SPEED = 22; const ADV_BOW_G = 9.5; /* 玩家弓箭弹道: 高初速低重力(nether
   箭道口径; 2026-10-28 弓物品化启用——雪球之外的第二条使用档弹道, 比雪球快且平) */
const ADV_BOW_DMG = 10; const ADV_BOW_KPOW = 0.35; /* 弓箭伤害/击退: 铁剑(11)略下一档——
   远程安全的代价(儿童版不设蓄力档, 单发定值) */
const ADV_BOW_LIFE = 3; const ADV_BOW_CD = 0.55; /* 弓箭寿命/拉弓冷却秒(nether bowCd 原值;
   与挥击同一条冷却轨道——换武器不躲冷却) */
const ADV_PICKUP_WINDOW = 3; /* 收集播报合并窗秒数(D6: 计数累计 3 秒合并播报) */

/* 每巢刷怪数量: 2~3 只(D11), rand 可注入(缺省 Math.random) */
function advNestCount(rand) {
  const r = (rand || Math.random)();
  return ADV_NEST_MIN + Math.floor(r * (ADV_NEST_MAX - ADV_NEST_MIN + 1));
}

/* 巢穴节拍: 巢里有活怪 → 不刷且计时归零; 全清 → 累计到 60s 发刷怪令并归零。
   返回 {spawn, t} — t 由调用方逐巢各存一份(计时独立是结构保证) */
function advNestStep(alive, t, dt) {
  const m = advSpawnPulse(alive <= 0, t, dt, ADV_NEST_RESPAWN_T); /* 刷怪核心薄壳 */
  return {spawn: m.fire, t: m.t};
}

/* 挥击伤害: 手持工具按 D9 表(toolOf.dmg), 空手/非工具 3 */
function advSwingDmg(heldId) {
  const t = heldId ? toolOf(heldId) : null;
  return t ? t.dmg : ADV_FIST_DMG;
}

/* 怪物对玩家伤害: 表值单击封顶 ADV_DMG_CAP(苦力怕 33 → 10) */
function advMobDmg(m) {
  return Math.min(ADV_DMG_CAP, Math.round(m.cfg.dmg * (m.dmgMult || 1)));
}

/* 击杀掉落清单(D6 链路的事件侧): onDeath 报实体 → 掷骰 → 逐条 spawn 落点
   (尸体落点上方 0.8 — 从击杀碎块里蹦出来的观感)。rollDrops 种子可注入 */
function advDeathDrops(m, rand) {
  const out = [];
  for (const s of rollDrops(m.type, rand)) {
    out.push({id: s.id, n: s.n, x: m.pos.x, y: m.pos.y + 0.8, z: m.pos.z});
  }
  return out;
}

/* 合并播报文案: 「捡到 2 个煤炭、1 根骨头！」(Map 迭代序=进账序, 同项已合数量) */
function advPickupText(buf) {
  const parts = [];
  for (const entry of buf) {
    const name = (ITEMS[entry[0]] && ITEMS[entry[0]].name) || entry[0];
    parts.push(entry[1] + ' 个' + name);
  }
  return '捡到 ' + parts.join('、') + '！';
}

/* ============================================================
   昼夜 D5 夜怪政策(mc-daylight-torch §6.1) — 常量与纯函数段
   ------------------------------------------------------------
   节拍器 advNightStep 与 advNestStep 同构(状态进 · {t, spawn} 出);
   光照门 advNightCanSpawn 一条表达式(MC 1.18+ 口径: 方块光 0 且
   internalSky≤7)——火把半径 13 菱形内方块光 ≥1, 天然防刷怪圈
   (「放火把守家」成立); 上限配额(CAP−现存怪数)与实体记账在壳层
   advNightTick(Mobs 是壳层依赖, 核心保持零实体耦合)。
   ============================================================ */
const ADV_NIGHT = {
  CAP: 12, /* 夜怪上限(含巢穴怪在内的怪物总量口径: 配额 = CAP − 现存怪数, 壳层结算) */
  RING_LO: 24, RING_HI: 40, /* 出生环带(MC 24 格内不刷——research TL;DR #5) */
  TRY_MS: 2000, /* 每 2 秒一次刷怪尝试(夜间才跑) */
  POOL: [['zombie', 2], ['creeper', 1], ['spider', 1]], /* 无骷髅: 夜间无远程(差异 #8) */
};

/* home 地图行缺省数据(冒险地图 T2 池参数化): 巢穴池/夜怪池从「模块常量被壳
   直读」改为「行缺省」——壳经当前地图行读取(缺省即本行, 同一引用), T4 的
   ADV_MAPS 注册表各行以替换语义自带池, T6 壳换装当前行即成覆盖; 常量本体
   与导出口径不动(home 池行为逐字节不变是本票红线) */
const ADV_HOME_ROW = {id: 'home', nests: ADV_NESTS, nightPool: ADV_NIGHT.POOL};


/* 夜怪出生格判定(单表达式, MC 1.18+ 语义): 方块光为 0(火把圈=防刷怪圈)
   且内部天空光 ≤7(白天地表 15 自动拒绝; 洞穴与夜地表通过——时间维度
   已折进 internalSky, 节拍器另有一道 isNight 硬门) */
function advNightCanSpawn(skyAt, blockAt, dayTime) {
  return blockAt === 0 && Daylight.internalSky(skyAt, dayTime) <= 7;
}

/* 夜怪节拍·池注入版(冒险地图 T2 通道): 第 7 参 pool = [种, 权重] 二元组清单,
   缺省回落 ADV_NIGHT.POOL(home 行缺省口径); 节拍/环带/光照门仍取 ADV_NIGHT
   常量, 不随池换。其余口径同 advNightStep(其签名冻结, 本函数是它的全参实现,
   供壳层喂当前地图行池, T4/T6 替换语义的注入缝) */
function advNightStepPool(s, dt, dayTime, read, playerPos, rnd, pool) {
  const P = pool || ADV_NIGHT.POOL;
  const m = advSpawnPulse(Daylight.isNight(dayTime), s, dt, ADV_NIGHT.TRY_MS / 1000);
  if (!m.fire) return {t: m.t, spawn: null}; /* 白天等门关: 节拍器归零 */
  const spot = advRingSpot(playerPos.x, playerPos.z, ADV_NIGHT.RING_LO, ADV_NIGHT.RING_HI, rnd);
  const lt = read(spot.x, spot.z);
  if (!lt || !advNightCanSpawn(lt.sky, lt.block, dayTime)) return {t: 0, spawn: null};
  return {t: 0, spawn: {type: advWeightedPick(P, rnd), x: spot.x, z: spot.z}};
}

/* 夜怪节拍(advNestStep 同构: 前置不满足即归零 · 到拍出单): s 为秒累计,
   read(x,z)→{sky,block}|null 是落点光查询 seam(壳层封装 groundTop+1
   同一格的双通道读数, null=界外), rnd 可注入。到拍掷环带一点(角度/半径
   均匀), 光照不过 → 本拍作废(2s 后再掷, MC 式逐拍独立); 过 → POOL 按
   权重取种出刷怪令。返回 {t, spawn}(spawn=null 或 {type,x,z})。
   签名冻结(T2 红线): 缺省池薄壳, 全参实现见 advNightStepPool */
function advNightStep(s, dt, dayTime, read, playerPos, rnd) {
  return advNightStepPool(s, dt, dayTime, read, playerPos, rnd);
}

/* 黎明清场谓词: internalSky(15) ≥12(= skyDim≤3)——夜末(skyDim 11)为
   false, 日出折线下穿 3(≈tick 23517)翻 true; 上升沿(跨沿)由壳层账本
   检测后触发清场, 本函数只给时刻不持状态 */
function advDawnSweep(dayTime) {
  return Daylight.internalSky(15, dayTime) >= 12;
}


/* ============================================================
   F4 牧场(二期设计稿 §4.4/§4.3) — 确定性散布清单 + 恐惧游荡决策
   ------------------------------------------------------------
   散布=纯函数零世界读(树避让复用 advTreeSpots 清单): 重进完全复现,
   玩家挖掘/放块不改变清单; 世界档只存已杀索引 livestock.dead(初始
   清单可推导, 存档最小)。恐惧游荡只做标量决策(方向/位移归壳的
   advHerdTick, 走 Mobs.move/steer 意图 API)。
   ============================================================ */
const ADV_LIVESTOCK_SPAWN_R = 15; /* 群位离出生点最小距离(设计稿 §4.4: ≥15 格) */
const ADV_LIVESTOCK_HERD_R = 10; /* 两群彼此最小间距(群位互斥, 不叠群) */
const ADV_LIVESTOCK_RING_LO = 0.8; const ADV_LIVESTOCK_RING_HI = 1.8; /* 群内散布环带(≤1.8 保证不撞 ±3 避树盒外的树干列) */
const ADV_LIVESTOCK_HERDS = [ /* 2 群共 10 只(设计稿 §4.4); T5 群位挪进屋西围栏内——
  栏内可用面 11×13 容不下「全图无偏扫描 + 两群 ≥10」, 群位改显式坐标(距墙 ≥3·
  离出生 ≥15·两群 ≥10, 约束成立由单测对 advLivestockHerdOk 逐点断言) */
  {x: 43, z: 77, kinds: ['cow', 'cow', 'sheep', 'sheep']}, /* 群位 A·栏内北段: 牛×2+羊×2 */
  {x: 46, z: 87, kinds: ['pig', 'pig', 'pig', 'chicken', 'chicken', 'chicken']}, /* 群位 B·栏内南段: 猪×3+鸡×3 */
];
const ADV_HERD_AVOID_R = 2.5; /* 玩家贴近让开距离(设计稿 §4.3: ≤2.5 格) */
const ADV_HERD_AVOID_MULT = 0.8; /* 让开速度系数(speed×0.8, 缓步) */
const ADV_HERD_FLEE_T = 3; /* 受击逃窜秒数(设计稿 §4.3: 3 秒) */
const ADV_HERD_FLEE_MULT = 2.2; /* 逃窜速度系数(speed×2.2) */
const ADV_HERD_AMBLE_MULT = 0.5; /* 闲逛速度系数(吃草步, 六成时间在走) */
const ADV_HERD_AMBLE_WALK_P = 0.6; /* 闲逛掷点在走概率(四成时间站着吃草, 设计稿 §4.3) */

function advLivestockHerdOk(x, z, trees) {/* 群位约束(设计稿 §4.4): 离出生点 ≥15 · 避湖/
  矿坑/巢穴/山洞/小屋(外扩裕量盖过群内环带) · 避树干 ±3 盒 · T5 起避门阵广场/农田/小径
  (群位挪进围栏后此三条为防御性约束, 供 T4 异图复用); 零世界读——基础草原面
  在禁区外天然是整块平草地(advBaseTerrain), 不必逐格验草 */
  if (Math.hypot(x - ADV_SPAWN.x, z - ADV_SPAWN.z) < ADV_LIVESTOCK_SPAWN_R) return false;
  if (Math.hypot(x - ADV_LAKE.cx, z - ADV_LAKE.cz) <= ADV_LAKE.r + 4) return false;
  for (const p of ADV_PITS) {
    if (Math.hypot(x - p.cx, z - p.cz) <= p.r + 4) return false;
  }
  for (const n of ADV_NESTS) {
    if (Math.hypot(x - n.x, z - n.z) < 6) return false; /* 怪物窝边不放牧场 */
  }
  const h = ADV_HUT;
  if (x >= h.x1 - 5 && x <= h.x2 + 5 && z >= h.z1 - 5 && z <= h.z2 + 5) return false;
  const c = ADV_CAVE;
  if (x >= c.x1 - 5 && x <= c.x2 + 5 && z >= c.zStart - 6 && z <= c.zEnd + 5) return false; /* 隧道向南同向矩形 */
  if (advInRect(x, z, ADV_GATE_PLAZA) || advInRect(x, z, ADV_FARM)) return false; /* 避广场/农田 */
  for (const r of ADV_PATH) {
    if (advInRect(x, z, r)) return false; /* 避小径 */
  }
  for (const t of trees) {
    if (Math.abs(t.x - x) <= 3 && Math.abs(t.z - z) <= 3) return false;
  }
  return true;
}

function advLivestockSpots() {/* 群位清单(advLivestockPlan 的位点权威, 单测直触): T5 群位
  挪进屋西围栏内, 坐标由 ADV_LIVESTOCK_HERDS 显式携带(见其注释), 本函数退化为
  投影清单——约束成立(离出生 ≥15·避湖/坑/巢/洞/广场/农田/小径·两群 ≥10)由单测
  对 advLivestockHerdOk 逐点断言, 零世界读保持(清单不随玩家改动漂移) */
  return ADV_LIVESTOCK_HERDS.map((h) => ({x: h.x, z: h.z}));
}

function advLivestockPlan() {/* 确定性散布清单(设计稿 §4.4, SceneKit.rand 同种子口径):
  群内条目按环带确定性散布。条目 {idx,type,x,y,z}, idx 0..9 稳定——世界档
  livestock.dead 只存索引, 重进按本清单对账 */
  const out = [];
  let idx = 0;
  advLivestockSpots().forEach((s, herd) => {
    for (const type of ADV_LIVESTOCK_HERDS[herd].kinds) {
      const a = SceneKit.rand(s.x + idx, s.z - idx, 7400 + idx) * Math.PI * 2;
      const rr = ADV_LIVESTOCK_RING_LO +
          SceneKit.rand(s.x - idx, s.z + idx, 7500 + idx) * (ADV_LIVESTOCK_RING_HI - ADV_LIVESTOCK_RING_LO);
      out.push({idx: idx++, type, x: s.x + 0.5 + Math.cos(a) * rr, y: ADV_GROUND + 1,
        z: s.z + 0.5 + Math.sin(a) * rr});
    }
  });
  return out;
}

/* 恐惧游荡决策(纯函数, 设计稿 §4.3): 返回 {fleeT, speed} — 受击逃窜计时优先
   (3 秒 speed×2.2), 到期回落玩家贴近判定(≤2.5 格 speed×0.8 缓步让开),
   否则不动(闲逛归壳的换向计时)。方向由调用方算(背向玩家), 这里只管标量 */
function advHerdStep(dist, speed, fleeT, dt) {
  if (fleeT > 0) return {fleeT: Math.max(0, fleeT - dt), speed: speed * ADV_HERD_FLEE_MULT};
  if (dist <= ADV_HERD_AVOID_R) return {fleeT: 0, speed: speed * ADV_HERD_AVOID_MULT};
  return {fleeT: 0, speed: 0};
}

/* 闲逛吃草节拍(纯函数, 随机经 rnd 注入——rand-core 口径: 随机源由调用方供给):
   t 递减, 归零即重掷——方向均匀 0..2π · 时长 2~5s · ADV_HERD_AMBLE_WALK_P
   概率在走(四成站着吃草); 重掷三掷的次序 dir→t→walk 与历史壳实现逐字一致
   (同 rnd 序列同行为)。方向/位移的施加归壳 advHerdTick(Mobs.move/steer 意图 API) */
function advAmbleStep(t, dir, walk, dt, rnd) {
  const nt = t - dt;
  if (nt > 0) return {t: nt, dir, walk}; /* 未到期: 只递减, 方向/在走原样续期 */
  const nd = rnd() * Math.PI * 2;
  const ntt = 2 + rnd() * 3;
  const nw = rnd() < ADV_HERD_AMBLE_WALK_P;
  return {t: ntt, dir: nd, walk: nw};
}

/* 栏内钳制(2026-10-27 出栏修复): 牲畜每次位移后强钳回围栏内带——踏石(栏外
   东侧)到栏顶高差恰 1(≤1.05 爬行口径), 动物能沿「地面→踏石→栏顶→栏外」
   爬出(建场旧注释「仍差 2」是 block-y 口径算错); 钳制带自墙列内缩 1.1 格
   (不贴栏站立), 存量出栏个体也会被逐步收回。纯函数可单测, 壳 advHerdTick
   施加(仅 home 图——四畜全套留 home, 他图无牲畜) */
const ADV_HERD_PAD = 1.1; /* 钳制带内缩格(墙列占整格, 留 0.1 贴面余量) */

function advHerdClamp(x, z) {/* 位置 → 钳回栏内带(四边独立 min/max, 角上同收) */
  const p = ADV_PEN;
  return {x: Math.min(Math.max(x, p.x1 + ADV_HERD_PAD), p.x2 + 1 - ADV_HERD_PAD),
    z: Math.min(Math.max(z, p.z1 + ADV_HERD_PAD), p.z2 + 1 - ADV_HERD_PAD)};
}

/* ============================================================
   生态恢复·牧场繁育 (docs/eco-recovery-design.md §2, ADR 0006) — 常量与纯函数段
   MC 繁殖模型照抄(调研稿 §6): 冷却+成长+上限三闸门防指数爆炸; 触发力按拍板
   改自动(同种成年邻近即成对, 附录 B 差异 4——猪无对应食物物品); 幼崽免伤为
   永久偏差(差异 6, 零惩罚哲学)。
   ============================================================ */
const ADV_BREED_CD_S = 300; /* 繁殖冷却秒(MC 6000 刻=5min 1:1, 调研稿 §6.2) */
const ADV_BABY_GROW_S = 600; /* 幼崽当次成长秒(MC 24000 刻=20min 砍半: 日限内可见, 差异 5) */
const ADV_BREED_R = 4; /* 配对水平距离(格) */
const ADV_LIVESTOCK_CAP = 16; /* 活畜上限(初始 10 + 繁育余量 6; MC creature 上限 10 锚点) */
const ADV_BABY_SCALE = 0.55; /* 幼崽体型(MC 约半体型) */

function advBredNorm(v) {/* 繁育账条目归一(纯函数): 只收 {k: 怪物键, b: 日期串[, sheared: 剪毛
    时刻 tick]}(v3 剪毛字段可选), 异形整条丢弃; sheared 非有限数值即剥除(回落有毛) */
  return (Array.isArray(v) ? v : [])
      .filter((e) => e && typeof e.k === 'string' && typeof e.b === 'string')
      .map((e) => (typeof e.sheared === 'number' && Number.isFinite(e.sheared)) ?
        {k: e.k, b: e.b, sheared: e.sheared} : {k: e.k, b: e.b});
}

function advShearedNorm(v) {/* 剪毛账归一(纯函数, 档形 v3): 只收 {初始畜索引: 剪毛时刻 tick}
    的有限数值对, 异形键值整条丢弃(坏档兜底空账); 繁育畜的剪毛时刻挂在
    bred 条目上(advBredNorm), 两者分工与 dead/bred 同构 */
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) {
      if (/^\d+$/.test(k) && typeof v[k] === 'number' && Number.isFinite(v[k])) out[k] = v[k];
    }
  }
  return out;
}

function advLivestockNormBucket(v) {/* 牧场桶形状归一(纯函数, 世界档 v3): 四代档形收敛——
    v3 {dead:[..], bred:[..], sheared:{idx: 剪毛时刻}} 校验拷贝 · v2 {dead,bred}
    → sheared 空 · 二代纯死畜索引数组 → bred/sheared 空 · 坏值兜底空 */
  if (Array.isArray(v)) return {dead: v.slice(), bred: [], sheared: {}};
  if (v && typeof v === 'object') {
    return {dead: Array.isArray(v.dead) ? v.dead.slice() : [], bred: advBredNorm(v.bred),
      sheared: advShearedNorm(v.sheared)};
  }
  return {dead: [], bred: [], sheared: {}};
}

function advBreedPairOk(a, b, dist) {/* 配对判据(纯谓词): 快照 {type,baby,cd} × 实距——
   同种·双成年·双不在冷却·距离 ≤R; 实体扫描与产崽施加归壳 */
  return a.type === b.type && !a.baby && !b.baby &&
    a.cd <= 0 && b.cd <= 0 && dist <= ADV_BREED_R;
}

function advBabyAdult(bornOrd, todayOrd) {/* 幼崽成年判(纯函数): 出生日序数 ≠ 今日即成年
   (跨天必成年; 'Y-M-D' 无前导零不可字典序比较, 序数换算归壳 CampCore.dayIndex) */
  return bornOrd !== todayOrd;
}

function advBreedHerdOf(kind) {/* 繁育畜归群(纯函数): kind 首个所属群的群号, 查无回落 0
   ——重播落位只用作围栏锚点(游荡位置不存档) */
  for (let i = 0; i < ADV_LIVESTOCK_HERDS.length; i++) {
    if (ADV_LIVESTOCK_HERDS[i].kinds.indexOf(kind) >= 0) return i;
  }
  return 0;
}

/* ============================================================
   挖掘与采集政策 (T12, 设计稿 D4/D7) — 常量与纯函数段
   ============================================================ */
const ADV_MINE_SWING = 0.28; /* 蓄力期间挥动节拍(秒/挥, Avatar.swing 循环喂 HeldItems.swingPose) */
const ADV_SAP_GROW = 20; /* 树苗 20s 长成(D7) */

/* 蓄力单步(纯函数): m 为当前状态 {t,key,need,drops}, key 为准星目标
   blockKey、bt 为 breakTime 结果 {time,drops}。同目标累加 t, 换目标/指空
   清零重来; need 每帧以 bt.time 刷新(中途换工具重估), 到点 done 且 t 钳
   在 need(不外漏超额给消费方)。 */
function advMineStep(m, key, bt, dt) {
  if (!key || !bt) return {t: 0, key: '', need: 0, drops: true, done: false};
  if (m.key !== key) return {t: dt, key, need: bt.time, drops: bt.drops, done: dt >= bt.time};
  const t = m.t + dt;
  return {t: Math.min(t, bt.time), key, need: bt.time, drops: bt.drops, done: t >= bt.time};
}

/* 放置合法性(纯函数): hit 为准星命中 {x,y,z,nx,ny,nz}, blockId 为物品的
   block 字段, lookId 为命中格方块 id, targetId 为落点格现有方块 id,
   belowId 为被点格正下方方块 id(仅覆盖放置的 thin 新块消费, 可省)。
   规则(D4): 落点必须空气 · thin 块(火把/树苗)只放实心面顶(点击面法线
   朝上, 支承块 solid) · wall 旗标薄块(火把)额外认实心侧面(墙火把, 支承
   口径同顶面) · 树苗支承限草地/泥土(D7)。
   覆盖放置(用户拍板 2026-10-28, config replaceable 旗标): 命中 replaceable
   薄块(花草/火把)时落点=被点格本身, 新块盖掉它——镂空薄块占整格却几乎
   看不见, 新块架在半空很出戏; thin 新块(火把/树苗)的支承改认 belowId
   (被覆盖格正下方), 面法线支承路径不适用。返回 {ok,x,y,z} 或
   {ok:false}(不可放置的旗标语义: 草丛/麦等薄块自身 solid:false, 天然
   当不了支承; 草丛/麦物品不存在 block 字段, 进不了本函数)。 */
function advPlaceCheck(hit, blockId, lookId, targetId, belowId) {
  const def = blockId != null ? BLOCKS[blockId] : null;
  if (!hit || !def) return {ok: false};
  const lookDef = lookId != null ? BLOCKS[lookId] : null;
  if (lookDef && lookDef.replaceable) {/* 覆盖放置: 落点=被点格, 盖掉旧薄块 */
    const x = hit.x; const y = hit.y; const z = hit.z;
    if (def.thin != null) {/* thin 新块依附口径: 支承=被覆盖格正下方(实心) */
      const below = belowId != null ? BLOCKS[belowId] : null;
      const solidSup = below && below.solid !== false && below.thin == null;
      if (!solidSup) return {ok: false};
      if (blockId === B_SAPLING && belowId !== 1 && belowId !== 2) return {ok: false}; /* 树苗限草地/泥土 */
    }
    return {ok: true, x, y, z};
  }
  if (targetId !== 0) return {ok: false}; /* 落点非空气 → 拒(不可叠放) */
  const x = hit.x + hit.nx;
  const y = hit.y + hit.ny;
  const z = hit.z + hit.nz;
  if (def.thin != null) {/* 薄块依附口径(B_FUSE 同款): 顶面认实心支承;
      wall 旗标(火把)额外认实心侧面——点击侧面时支承=被点格, 取向由
      邻块派生不存档(cascade/mesh 同判据, 见 config B_TORCH 注) */
    const support = lookId != null ? BLOCKS[lookId] : null;
    const solidSup = support && support.solid !== false && support.thin == null;
    const sideFace = hit.ny === 0 && (hit.nx !== 0 || hit.nz !== 0);
    const attached = sideFace ?
      (def.wall === true && solidSup) : (hit.ny === 1 && solidSup);
    if (!attached) return {ok: false};
    if (blockId === B_SAPLING && lookId !== 1 && lookId !== 2) return {ok: false}; /* 树苗限草地/泥土 */
  }
  return {ok: true, x, y, z};
}

/* 食物回血政策(纯函数, D7 腐肉同口径): 回复钳制在 maxHp, 满血 canEat=false
   (交互层据此不扣物品); healed = 实际回复量(血条动画消费)。
   full 旗标(F3 金苹果, 二期设计稿 §3): 直接回 maxHp——本游戏无饥饿系统,
   MC 金苹果的饥饿+吸收+再生折算成一次回满; 设计稿原写在模式层 advTryEat
   解读, 收编进本政策纯函数(seam 级偏差: 食物政策已有单测先例, 消费方
   只吃结果), 缺省不传走既有口径 */
function advEatPolicy(hp, maxHp, food, full) {
  const capped = full ? maxHp : Math.min(maxHp, hp + food);
  return {hp: capped, healed: Math.max(0, capped - hp), canEat: hp < maxHp};
}

/* 树苗计时到期(纯函数): 全员递减 dt, 到期项出清单并移出 Map, 未到期留队。
   20s 的挂表政策在交互段(advSapPlant), 这里只管时间账(D7) */
function advSapDue(map, dt) {
  const due = [];
  for (const [k, s] of map) {
    s.left -= dt;
    if (s.left <= 0) {
      due.push(s);
      map.delete(k);
    }
  }
  return due;
}

/* 树苗长成足迹记账(纯政策段, D7): y..y+7 / ±2 的粗扫界限是**重进幂等关键**——
   SceneKit.tree 冠幅不超过此盒, 盒内逐格非空即记 edits(重放同值幂等, 邻居
   地形冗余记账无害); read/mark 全注入, 壳 advGrowTree 只管种树与 toast */
function advGrowMark(x, y, z, read, mark) {
  for (let yy = y; yy <= y + 7; yy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const id = read(x + dx, yy, z + dz);
        if (id !== 0) mark(x + dx, yy, z + dz, id);
      }
    }
  }
}

/* ============================================================
   农田链判定(farm-and-recipe 设计稿 D3) — 锄/种/长/催四步的纯判定段
   ------------------------------------------------------------
   D7 二期农田链落地: 状态机政策在纯函数, 世界写/扣件/计时表在壳。
   与 MC 差异(登记 farm-and-recipe 附录): 锄头不是物品(空手=锄, 免耐久
   免 tier) · 耕地不需水不退化 · 骨粉确定 +1 阶段(MC 随机 2-5)。
   ------------------------------------------------------------ */
const ADV_WHEAT_GROW = 20; /* 每阶段生长秒数(D7: 4 阶段×20s; 与 ADV_SAP_GROW 同拍) */

/* 可垦判定: 草地(1)/泥土(2) 且上方空(播种位, 也挡「麦苗嵌进草丛」);
   雪覆草/耕地不可再锄(MC 口径: 开垦只对土面) */
function advHoeOk(id, aboveId) {
  return (id === 1 || id === 2) && !aboveId;
}

/* 播种判定: 目标格是耕地且上方空 */
function advPlantOk(id, aboveId) {
  return id === B_FARMLAND && !aboveId;
}

/* 下一生长阶段: 42→43→44→45, 成熟(45)/非麦格返 0(无下一步) */
function advWheatNext(id) {
  if (id === B_WHEAT_0) return B_WHEAT_1;
  if (id === B_WHEAT_1) return B_WHEAT_2;
  if (id === B_WHEAT_2) return B_WHEAT_3;
  return 0;
}

/* 可催熟判定: 麦苗 0~2 阶段(成熟 45 骨粉无意义, MC 同口径) */
function advRipenOk(id) {
  return id >= B_WHEAT_0 && id < B_WHEAT_3;
}

/* ============================================================
   生态恢复·树位再生 (docs/eco-recovery-design.md §1, ADR 0006) — 常量与纯函数段
   MC 拒绝式生长语义(调研稿 §2.2/§8.2): 执行前逐格检查, 被实体方块挡住就
   整株放弃——宁可不长, 绝不改写玩家建筑。预检盒 = SceneKit.tree 实际会写
   的格子超集(树干柱 + 冠层双环带), 比 advGrowMark 粗扫盒贴树形, 坡邻地形
   不会造成永久误拒。
   ============================================================ */
const ADV_TREE_REGROW_S = 180; /* 凋零树位恢复基准秒(±抖动错峰长出; MC 树苗约每分钟一次尝试) */
const ADV_TREE_REGROW_JIT = 60; /* 恢复计时抖动幅(SceneKit.rand 派生) */
const ADV_TREE_REGROW_RETRY_S = 90; /* 占位预检不过的重试间隔(受阻树苗无限重试语义) */
const ADV_LOG_ID = 5; /* 原木方块 id(树干判据, SceneKit.tree 同源) */

function advTreeSpotOpen(x, y, z, read) {/* 树位占位预检(纯函数): 脚下草地/泥土
   (树苗放置同款基底判据) + 树干柱(x,z 列 y..y+5)与冠层环带(y+2..y+5 半径 2
   去四角 / y+4..y+6 半径 1)全为空气或 replaceable 薄块(草丛/花——MC
   #replaceable_by_trees 思路)——任何实体方块(玩家建筑/地形)即 false。read 注入保零全局 */
  const g = read(x, y - 1, z);
  if (g !== 1 && g !== 2) return false;
  const open = (cx, cy, cz) => {
    const id = read(cx, cy, cz);
    if (id === 0) return true;
    const def = BLOCKS[id];
    return !!(def && def.replaceable);
  };
  for (let yy = y; yy <= y + 5; yy++) {
    if (!open(x, yy, z)) return false; /* 树干柱 */
  }
  for (let yy = y + 2; yy <= y + 5; yy++) {/* 冠层主环(半径 2, 四角不算——SceneKit.tree 同款) */
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (!open(x + dx, yy, z + dz)) return false;
      }
    }
  }
  for (let yy = y + 4; yy <= y + 6; yy++) {/* 冠层小环(半径 1) */
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!open(x + dx, yy, z + dz)) return false;
      }
    }
  }
  return true;
}

function advTreeRegenSpots(spots, groundY, heightAt, read) {/* 凋零树位派生(纯函数):
   位清单逐位判基格无原木 → 凋零位清单(壳挂恢复计时)。零全局, 单测直触 */
  const out = [];
  for (const s of spots) {
    const y = groundY + heightAt(s.x, s.z) + 1;
    if (read(s.x, y, s.z) !== ADV_LOG_ID) out.push({x: s.x, y, z: s.z});
  }
  return out;
}

/* ============================================================
   生态恢复·矿位回填 (设计稿 §3) — 纯函数段
   插件三件套(调研稿 §10): 位置记录(advOreSpots 白名单) + 类型白名单(advIsOre)
   + 基底检查(只回填空气位)。日期走序数比较——budgetDateStr 的 'Y-M-D' 无前导零,
   字典序会错(9 月 vs 10 月), 序数换算归壳 CampCore.dayIndex。
   ============================================================ */
const ADV_ORE_IDS = [B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE];

function advIsOre(id) {
  return ADV_ORE_IDS.indexOf(id) >= 0;
}

function advOreKey(scene, x, y, z) {
  return scene + ':' + x + ',' + y + ',' + z;
}

function advOreParseKey(k) {/* 账键解析(纯函数): '<场景>:x,y,z' → {scene,x,y,z} | null */
  const i = k.indexOf(':');
  if (i < 0) return null;
  const parts = k.slice(i + 1).split(',');
  if (parts.length !== 3) return null;
  const x = +parts[0]; const y = +parts[1]; const z = +parts[2];
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return null;
  return {scene: k.slice(0, i), x, y, z};
}

function advOreDue(dayOrd, todayOrd) {
  return dayOrd < todayOrd;
} /* 跨天口径(拍板②) */

function advOreRefillPlan(entries, read) {/* 到期矿位结算分流(纯函数): 目标格空气 →
   回填; 被占 → 销账(玩家改建永久优先于恢复) */
  const fill = []; const drop = [];
  for (const e of entries) {
    if (read(e.x, e.y, e.z) === 0) fill.push(e);
    else drop.push(e);
  }
  return {fill, drop};
}

/* ============================================================
   方块级联记账政策(设计稿 D4/D5/P6) — 级联清单 → edits 账本的编排
   ------------------------------------------------------------
   存档红线件: editBlock 返回的级联清单逐块入账, 顺序即契约——
   · 移动项(r.to, 落沙 D7)两格记账: 先原格 0 后落格 id(漏格/错序重进即错位);
   · 移除项: 记 0 + 树苗撤计时表 + fell 旗标(整树倒话术依据) + 默认表掉落
     (不传工具=砸倒不是剪, 零惩罚) + quest 旗标(蓄力链视同亲手挖; TNT 链
     传 false——「TNT 掀掉的不算」既有口径)。
   编辑/撤表/掉落/任务动作全经 sink 注入({mark, sapling, drop, questMine, mined}),
   观感(fell 话术/Fx)留壳回调; 返回 {felled} 供壳决定是否喊话。
   确定性重放红线: 同一 removed 清单+同一 sink 必产生同一动作序(测试锁)。 */
function advCascadeLedger(removed, quest, sink) {
  let felled = false;
  for (const r of removed) {
    if (r.to) {/* 移动(落沙, D7): 方块存活——不掉落不进任务, 记账两格(漏一格重进错位) */
      sink.mark(r.x, r.y, r.z, 0);
      sink.mark(r.to.x, r.to.y, r.to.z, r.id);
      continue;
    }
    sink.mark(r.x, r.y, r.z, 0);
    if (r.id === B_SAPLING) sink.sapling(r.x, r.y, r.z);
    if (BLOCKS[r.id] && BLOCKS[r.id].crop && sink.crop) sink.crop(r.x, r.y, r.z); /* 麦苗脱落撤生长计时(farm-and-recipe D3) */
    if (BLOCKS[r.id] && BLOCKS[r.id].fell) felled = true;
    if (sink.mined) sink.mined(r.id, r.x, r.y, r.z); /* 生态恢复: 矿位开采记账(TNT/挖掘两路同经此处) */
    for (const d of rollBlockDrop(BLOCKS[r.id], null, null)) sink.drop(d.id, d.n, r.x + 0.5, r.y + 0.8, r.z + 0.5);
    if (quest) sink.questMine(r.id, r.x, r.y, r.z);
  }
  return {felled};
}

/* ============================================================
   站点解锁·炉存档防错·TNT 政策 (T13/F1, 设计稿 D8/D4) — 常量与纯函数段
   (烧炼单步 smeltStep/退炉 furnaceRefund/节拍 SMELT_T 已迁 craft-core
   与烧炼表同居; ADV_SMELT_TTS_T 是探险话术政策, 留守此地)
   ============================================================ */
const ADV_STATION_R = 4; /* 站点解锁半径(拍板④: 走近 4 格; 水平距离口径与巢穴 AI 一致) */
const ADV_TNT_FUSE = 1.5; /* TNT 引信秒数(旧 TNT 模式 1.0 → 儿童留足走开时间) */
const ADV_TNT_R = 3.5; /* 爆炸破坏半径(旧 TNT 模式 radius 先例口径) */
const ADV_TNT_HURT_R = 4.5; /* 波及怪物半径(旧 TNT 模式 hurtR 先例口径) */
const ADV_TNT_DMG_HI = 30; /* 爆心伤害(僵尸 30 一击清场——挖矿神器兼防身) */
const ADV_TNT_DMG_LO = 12; /* 波及边缘伤害(与半径内线性衰减) */
const ADV_TNT_DROP_P = 0.7; /* 爆炸掉落率(D4: MC 30% → 儿童加倍 70%, 附录 B) */
const ADV_SMELT_TTS_T = 3; /* 烧炼完成播报节流秒数(受击语音同款节拍) */

/* 站点解锁判定: stations 为缓存值集合({x,z,id}), 玩家水平距离 ≤r 且 id 匹配
   (wantId 省略=任意站点)即命中——缓存即判据, 不碰世界数据;
   losOk(st) 可选视线缝(隔墙修复 2026-10-28): 距离命中后逐站点再问一眼,
   返回 false 视作不命中继续找下一个(缺省不传=纯距离, 既有口径零变化) */
function advNearStation(stations, px, pz, r, wantId, losOk) {
  for (const st of stations) {
    if (wantId != null && st.id !== wantId) continue;
    if (Math.hypot(st.x + 0.5 - px, st.z + 0.5 - pz) <= r) {
      if (!losOk || losOk(st)) return true;
    }
  }
  return false;
}

/* 视线阻断判定(隔墙修复 2026-10-28): 站点方块中心(a*)到人眼(b*)的体素段
   等步采样, 任一中间格 opaque 即隔墙不可用——两端点格(站点自身/人眼所在格)
   跳过(站点实心不挡自己); 步长 0.25 格(4 格半径至多 ~20 采样, 每帧仅对
   距离命中的站点才调, 可忽略)。read(x,y,z)→方块 id, opaque(id)→实心墙判定
   (壳传 voxel isOpaque: 玻璃板/开门不挡——「看得见即可用」, 与光照挡光
   判据同源; 关门挡)。返回 true=中间有墙 */
function advLosBlocked(read, opaque, ax, ay, az, bx, by, bz) {
  const axc = Math.floor(ax); const ayc = Math.floor(ay); const azc = Math.floor(az);
  const bxc = Math.floor(bx); const byc = Math.floor(by); const bzc = Math.floor(bz);
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / 0.25));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(ax + (bx - ax) * t);
    const y = Math.floor(ay + (by - ay) * t);
    const z = Math.floor(az + (bz - az) * t);
    if ((x === axc && y === ayc && z === azc) ||
        (x === bxc && y === byc && z === bzc)) continue; /* 两端点格不算墙 */
    if (opaque(read(x, y, z))) return true;
  }
  return false;
}

/* F1 炉状态形状校验(拍板①: 每炉独立+持久化): 世界档 decode 侧逐条防错,
   非法整条拒收(不炸模式, 材料随损坏档损失——mkSaveSlot 损坏回落先例)。
   槽形状 {id,n}(id 在 ITEMS 注册且 n≥1) · heat ≥0 · prog ∈[0, SMELT_T] */
function advFurnaceValid(s) {
  if (!s || typeof s !== 'object') return false;
  const slot = (v) => v === null || (typeof v === 'object' && v !== null &&
      !!ITEMS[v.id] && Number.isFinite(v.n) && v.n >= 1);
  if (!slot(s.input) || !slot(s.fuel) || !slot(s.out)) return false;
  return Number.isFinite(s.heat) && s.heat >= 0 &&
      Number.isFinite(s.prog) && s.prog >= 0 && s.prog <= SMELT_T;
}

/* F1 空炉条目清扫(encode 侧): 三槽全空且无余热的炉不进存档(长期游玩防膨胀);
   返回 [posKey, state] entries 数组(世界档 furnaces 字段的存档形状) */
function advFurnaceClean(map) {
  const out = [];
  for (const [k, s] of map) {
    if (s.input || s.fuel || s.out || s.heat > 0) out.push([k, s]);
  }
  return out;
}

/* TNT 爆炸掉落掷骰(D4): 方块先掷 70% 门槛, 中签才走 rollBlockDrop(保底+
   概率条目原样掷, 不传工具=默认表)。rand 可注入; tnt 旗标守卫恒空手 —
   TNT 不经爆炸自掉(圈内 TNT 走链式点燃分支本就不进掷骰, 守卫与 drop
   字段解耦, 挖掘硬度修正 D3) */
function advTntRoll(id, rand) {
  rand = rand || Math.random;
  const def = BLOCKS[id];
  if (!def || def.tnt) return [];
  return rand() < ADV_TNT_DROP_P ? rollBlockDrop(def, rand) : [];
}

/* TNT 波及伤害: 爆心 HI → 波及边缘 LO 线性衰减(水平距离, 越界钳制) */
function advTntDmg(d) {
  const t = Math.max(0, Math.min(1, d / ADV_TNT_HURT_R));
  return Math.round(ADV_TNT_DMG_HI - (ADV_TNT_DMG_HI - ADV_TNT_DMG_LO) * t);
}

/* ---------- TNT 短按/按住二分(D3, 挖掘硬度修正) — 纯步进 ----------
   mousedown 只记账不点燃: 松手 <窗口 = 点燃, 按住 ≥窗口 = 转蓄力挖走回收
   (hard 0)。触屏单击天然走「松手」分支。壳 advTntTapTick 持状态与面板守卫,
   步进在此: state 为 {x,y,z,held}|null, held 为当前是否按住(桌面鼠标/
   触屏 onHold), blocked 为面板期取消旗标, dt 为帧步。返回 {state, act} —
   act 为 null / {ignite:true,x,y,z}(松手短按, 块还在与否由壳验) /
   {mine:true}(按住转蓄力, 准星已移开则蓄力链自清)。 */
const ADV_TNT_TAP_T = 0.25; /* 短按窗口(秒) */
function advTntTapStep(state, held, blocked, dt) {
  if (!state) return {state: null, act: null};
  if (blocked) return {state: null, act: null}; /* 面板期取消不点燃 */
  const h2 = state.held + dt;
  if (!held) {/* 松手: 短按=点燃(块还在才点), 长按已转蓄力不在此 */
    if (h2 < ADV_TNT_TAP_T) return {state: null, act: {ignite: true, x: state.x, y: state.y, z: state.z}};
    return {state: null, act: null};
  }
  if (h2 >= ADV_TNT_TAP_T) return {state: null, act: {mine: true}}; /* 按住转蓄力 */
  return {state: {x: state.x, y: state.y, z: state.z, held: h2}, act: null};
}

/* TNT 爆炸半径遍历编排(纯政策段): 圈内逐格分派——圈内 TNT 链式点燃接力
   (旧模式 chainR 口径) · 可采集方块破坏(hard 缺失=空气/水/创造专属免疫)
   · 掀掉的树苗撤计时 · 70% 掷骰掉落(advTntRoll, rand 注入保可测)。
   read 为方块读 seam, 动作全经 sink({ignite, edit, sapling, drop}) 注入——
   edit 对应「触发格先记账+editBlock+级联记账」的整段(壳接线), 签名附带方块
   id(奖励箱家族破坏计划认主: 小箱按 id、大箱按四邻, D18), 爆炸观感
   (Fx.boom)与怪物波及(advTntWave)不在此。遍历序 dx→dy→dz 与历史壳实现
   逐字一致(同世界同破坏序=同 edits 账本, 确定性重放红线)。 */
function advExplodeCells(x, y, z, read, sink, rand) {
  const cx = x + 0.5; const cy = y + 0.5; const cz = z + 0.5;
  const r = Math.ceil(ADV_TNT_R);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        const bx = x + dx; const by = y + dy; const bz = z + dz;
        if (Math.hypot(bx + 0.5 - cx, by + 0.5 - cy, bz + 0.5 - cz) > ADV_TNT_R) continue;
        const id = read(bx, by, bz);
        if (id === B_TNT) {
          sink.ignite(bx, by, bz); /* 链式引爆: 圈内 TNT 接力点燃 */
          continue;
        }
        const def = id ? BLOCKS[id] : null;
        if (!def || def.hard == null) continue; /* 空气/水/创造专属免疫(字段缺失判据) */
        sink.edit(bx, by, bz, id); /* id 附带透传(奖励箱家族计划认主, D18; 旧 sink 桩少参不炸) */
        if (id === B_SAPLING) sink.sapling(bx, by, bz);
        if (def.crop && sink.crop) sink.crop(bx, by, bz); /* 掀掉麦苗撤生长计时(farm-and-recipe D3) */
        for (const d of advTntRoll(id, rand)) sink.drop(d.id, d.n, bx + 0.5, by + 0.8, bz + 0.5);
      }
    }
  }
}

/* TNT 波及怪物清单(纯函数): 水平距离 ≤HURT_R 且垂距 ≤3 的活怪逐只附线性衰减
   伤害与击退向量(爆心指向怪); 空间筛与算伤在此, Mobs.hit/击杀/逃窜观感归壳
   (快照进、决策出——mob 实体只读不改, 与 advMobDmg 同口径) */
function advTntWave(mobs, x, y, z) {
  const cx = x + 0.5; const cy = y + 0.5; const cz = z + 0.5;
  const out = [];
  for (const m of mobs) {
    if (m.dead || m.gone) continue;
    const dx = m.pos.x - cx; const dz = m.pos.z - cz;
    const dist = Math.hypot(dx, dz);
    if (dist > ADV_TNT_HURT_R || Math.abs(m.pos.y - cy) > 3) continue;
    out.push({m, dmg: advTntDmg(dist), kdx: dx, kdz: dz});
  }
  return out;
}

/* ============================================================
   任务链数据表 (T15, 设计稿 D11) — 谓词纯函数 + 计数键口径
   ============================================================ */
const ADV_QUEST_CHECK_T = 0.5; /* 谓词检查节流秒(update 内, 最坏延迟半秒无感) */
const ADV_QUEST_TITLE = '小小探险家'; /* 通关称号(D11 终章, 随 quest 存档) */

/* 挖掘→计数键映射: 石头/圆石都产圆石(步 7 口径「挖 8 圆石」)。只认玩家蓄力
   挖掘(advBreakBlock 挂点)——TNT 爆炸掀掉的不算, 任务链是亲手做的教学 */
const ADV_MINE_TALLY = {
  3: 'mine_cobble', 4: 'mine_cobble',
  [B_COAL_ORE]: 'mine_coal_ore', [B_IRON_ORE]: 'mine_iron_ore', [B_DIAMOND_ORE]: 'mine_diamond_ore',
  [(typeof B_CACTUS !== 'undefined') ? B_CACTUS : 0]: 'mine_cactus', /* 远征章(T8): 沙漠仙人掌收集步;
      T1 方块常量旧测试装载序可能没铺——typeof 守卫缺省 0(方块 id ≥1 永不命中, ADV_B 同哲学) */
};

/* 主线任务表(引导链 v2, 15 步+终章; 12 步版与插步依据见
   docs/story-quest-research.md): 每条 = 纯函数谓词 check + 语音引导 hint +
   图标 icon + 完成表扬 praise(夸努力不夸聪明口径); target 是进度分母,
   prog 算分子(复合步取各条件已得之和, 超量钳回)。counts 键七类(事件处只
   += 不判断): collect_<物品> 拾取件数 · craft_<物品> 合成件数 · mine_<矿>
   挖掉块数 · place_<方块> 放置次数 · open_<站点> 打开次数 · smelt_<物品>
   炉内烧成件数 · kill_mob 击杀只数。
   步序设计: 安家章(1~5 原木→木板→工作台→箱子→树苗, 5 原木=20 板恰好
   覆盖 工作台4+箱子8+木镐3+木棍2=17 板) → 挖矿章(6~10 工具两阶+燃料)
   → 冶炼章(11~13 铁链) → 冒险章(14 战斗教学, 15 钻石) → 终章(钻石剑)。 */
const ADV_QUESTS = [
  {id: 'q1_log', icon: '🪵', goal: '砍树收集 5 根原木', target: 5,
    hint: '去找一棵大树，按住挖树干，捡回 5 根原木哦！',
    praise: '原木收集齐啦！你一直在努力，真棒！',
    prog: (c) => Math.min(c.collect_log || 0, 5), check: (c) => (c.collect_log || 0) >= 5},
  {id: 'q2_planks', icon: '🟫', goal: '合成 4 块木板', target: 4,
    hint: '打开背包，用原木合成木板吧！',
    praise: '木板做好啦！你真会想办法！',
    prog: (c) => Math.min(c.craft_planks || 0, 4), check: (c) => (c.craft_planks || 0) >= 4},
  {id: 'q3_table', icon: '🛠️', goal: '合成并放下工作台', target: 2,
    hint: '先用木板合成工作台，再找块空地放下它！',
    praise: '工作台放好啦！能做的东西越来越多咯！',
    prog: (c) => Math.min(c.craft_craft_table || 0, 1) + Math.min(c.place_craft_table || 0, 1),
    check: (c) => (c.craft_craft_table || 0) >= 1 && (c.place_craft_table || 0) >= 1},
  {id: 'q4_chest', icon: '📦', goal: '合成、放下并打开箱子', target: 3,
    hint: '站到工作台旁边，用木板合成一个箱子，找块空地放下，再点一点把它打开！',
    praise: '箱子放好啦！你的宝贝有家咯，你安排得真好！',
    prog: (c) => Math.min(c.craft_chest || 0, 1) + Math.min(c.place_chest || 0, 1) +
        Math.min(c.open_chest || 0, 1),
    check: (c) => (c.craft_chest || 0) >= 1 && (c.place_chest || 0) >= 1 && (c.open_chest || 0) >= 1},
  {id: 'q5_sapling', icon: '🌱', goal: '种下 1 棵树苗', target: 1,
    hint: '打一打树叶，可能会掉下小树苗！把它种在泥土上，等它长成大树哦！',
    praise: '小树苗种好啦！你懂得爱护大自然，真棒！',
    prog: (c) => Math.min(c.place_sapling || 0, 1), check: (c) => (c.place_sapling || 0) >= 1},
  {id: 'q6_pick_wood', icon: '⛏️', goal: '合成木镐', target: 1,
    hint: '站到工作台旁边，合成一把木镐！',
    praise: '木镐做好啦！石头也难不倒你！',
    prog: (c) => Math.min(c.craft_pick_wood || 0, 1), check: (c) => (c.craft_pick_wood || 0) >= 1},
  {id: 'q7_cobble', icon: '🪨', goal: '挖 8 块圆石', target: 8,
    hint: '用木镐去挖石头，石头会掉成圆石哦！',
    praise: '圆石挖够啦！你挖得又稳又认真！',
    prog: (c) => Math.min(c.mine_cobble || 0, 8), check: (c) => (c.mine_cobble || 0) >= 8},
  {id: 'q8_pick_stone', icon: '⛏️', goal: '合成石镐', target: 1,
    hint: '回到工作台，用圆石合成更硬的石镐！',
    praise: '石镐做好啦！你在一步步变厉害！',
    prog: (c) => Math.min(c.craft_pick_stone || 0, 1), check: (c) => (c.craft_pick_stone || 0) >= 1},
  {id: 'q9_coal', icon: '⚫', goal: '挖 5 个煤矿', target: 5,
    hint: '矿坑和山洞里有黑亮的煤矿，去挖 5 个！',
    praise: '煤矿挖够啦！火把有燃料咯！',
    prog: (c) => Math.min(c.mine_coal_ore || 0, 5), check: (c) => (c.mine_coal_ore || 0) >= 5},
  {id: 'q10_torch', icon: '🔥', goal: '合成 4 支火把', target: 4,
    hint: '用煤和木棍合成火把，山洞里就不怕黑啦！',
    praise: '火把做好啦！你想得真周到！',
    prog: (c) => Math.min(c.craft_torch || 0, 4), check: (c) => (c.craft_torch || 0) >= 4},
  {id: 'q11_iron', icon: '🟠', goal: '挖 5 块铁矿', target: 5,
    hint: '铁矿藏在更深的地方，带上火把去挖 5 块！',
    praise: '铁矿挖够啦！你真勇敢！',
    prog: (c) => Math.min(c.mine_iron_ore || 0, 5), check: (c) => (c.mine_iron_ore || 0) >= 5},
  {id: 'q12_smelt', icon: '♨️', goal: '放下熔炉，烧出 3 块铁锭', target: 4,
    hint: '用圆石合成熔炉放下来，把铁矿烧成铁锭！',
    praise: '铁锭烧好啦！等一等就有收获，你真有耐心！',
    prog: (c) => Math.min(c.place_furnace || 0, 1) + Math.min(c.smelt_iron_ingot || 0, 3),
    check: (c) => (c.place_furnace || 0) >= 1 && (c.smelt_iron_ingot || 0) >= 3},
  {id: 'q13_pick_iron', icon: '⛏️', goal: '合成铁镐', target: 1,
    hint: '用铁锭合成铁镐，最硬的矿石也能挖啦！',
    praise: '铁镐做好啦！钻石就在不远处等你！',
    prog: (c) => Math.min(c.craft_pick_iron || 0, 1), check: (c) => (c.craft_pick_iron || 0) >= 1},
  {id: 'q14_fight', icon: '⚔️', goal: '打败 1 只怪物', target: 1,
    hint: '拿起工具，去怪物窝打败 1 只小怪物！害怕了就跑回家，一点都不丢人！',
    praise: '怪物被你打败啦！你真勇敢！',
    prog: (c) => Math.min(c.kill_mob || 0, 1), check: (c) => (c.kill_mob || 0) >= 1},
  {id: 'q15_diamond', icon: '💎', goal: '挖到 3 颗钻石', target: 3,
    hint: '去山洞最深处找亮晶晶的钻石，挖 3 颗！',
    praise: '钻石挖够啦！你坚持到了最后，真了不起！',
    prog: (c) => Math.min(c.mine_diamond_ore || 0, 3), check: (c) => (c.mine_diamond_ore || 0) >= 3},
  {id: 'finale', icon: '🗡️', goal: '合成钻石剑', target: 1, finale: true,
    hint: '用 2 颗钻石和 1 根木棍，合成属于你的钻石剑！',
    praise: '钻石剑做好啦！',
    prog: (c) => Math.min(c.craft_sword_diamond || 0, 1), check: (c) => (c.craft_sword_diamond || 0) >= 1},
  /* 远征章(T8, 冒险地图设计稿 §2.3 解锁链): 追加在终章之后——前 16 条序不变,
     老档 step 不回退(已通关档 step=16 顺位接棒远征章, 称号保留); 线性解锁链
     home→desert→snow→swamp, unlock 字段 = 该任务完成时点亮的门(目标图 id),
     壳层置 ADV_UNLOCK_KEYS[unlock] 键(键名权威在 adventure-maps-core, T4)。
     counts 新增四类(事件处仍只 += 不判断): visit_<图> 到达记账(站桩切图时) ·
     chest_<结构> 结构宝箱开箱(建场件坐标判定, 玩家自放箱不算) ·
     throw_<物品> 投掷件数 · kill_<怪种> 按怪种击杀(与 kill_mob 并行记账) */
  {id: 'q16_plaza', icon: '🏛️', goal: '去门阵广场看一看', target: 1, unlock: 'desert',
    hint: '小屋东边有一座门阵广场，走过去看一看吧！',
    praise: '找到门阵广场啦！你观察得真仔细！',
    prog: (c) => Math.min(c.visit_plaza || 0, 1), check: (c) => (c.visit_plaza || 0) >= 1},
  {id: 'q17_desert', icon: '🏜️', goal: '走进黄沙沙漠', target: 1,
    hint: '沙漠之门亮起来啦！站进门里等一等，就去黄沙沙漠咯！',
    praise: '到黄沙沙漠啦！你真勇敢！',
    prog: (c) => Math.min(c.visit_desert || 0, 1), check: (c) => (c.visit_desert || 0) >= 1},
  {id: 'q18_cactus', icon: '🌵', goal: '挖 3 根仙人掌', target: 3,
    hint: '沙漠里有绿绿的仙人掌，挖 3 根带回家吧！',
    praise: '仙人掌挖到啦！你收获满满！',
    prog: (c) => Math.min(c.mine_cactus || 0, 3), check: (c) => (c.mine_cactus || 0) >= 3},
  {id: 'q19_temple', icon: '📦', goal: '打开沙漠神殿的宝箱', target: 1, unlock: 'snow',
    hint: '找到大金字塔，踩一踩地上颜色不一样的地板，下面藏着宝箱哦！',
    praise: '神殿宝箱打开啦！你像小侦探一样厉害！',
    prog: (c) => Math.min(c.chest_temple || 0, 1), check: (c) => (c.chest_temple || 0) >= 1},
  {id: 'q20_snow', icon: '🌨️', goal: '走进白雪雪原', target: 1,
    hint: '雪原之门亮起来啦！站进门里等一等，就去玩雪咯！',
    praise: '到白雪雪原啦！雪白的世界真漂亮！',
    prog: (c) => Math.min(c.visit_snow || 0, 1), check: (c) => (c.visit_snow || 0) >= 1},
  {id: 'q21_snowball', icon: '❄️', goal: '扔 5 个雪球', target: 5,
    hint: '挖雪块能拿到雪球，拿着雪球轻轻一点，扔出去吧！',
    praise: '雪球扔得又远又好！你玩得真开心！',
    prog: (c) => Math.min(c.throw_snowball || 0, 5), check: (c) => (c.throw_snowball || 0) >= 5},
  {id: 'q22_igloo', icon: '📦', goal: '打开雪屋里的宝箱', target: 1, unlock: 'swamp',
    hint: '找到圆圆的雪屋，屋里的雪面下藏着宝箱哦！',
    praise: '雪屋宝箱打开啦！你找得真仔细！',
    prog: (c) => Math.min(c.chest_igloo || 0, 1), check: (c) => (c.chest_igloo || 0) >= 1},
  {id: 'q23_swamp', icon: '🌿', goal: '走进青苔沼泽', target: 1,
    hint: '沼泽之门也亮起来啦！站进门里等一等，就去探险咯！',
    praise: '到青苔沼泽啦！你的胆子越来越大啦！',
    prog: (c) => Math.min(c.visit_swamp || 0, 1), check: (c) => (c.visit_swamp || 0) >= 1},
  {id: 'q24_bogged', icon: '⚔️', goal: '打跑 2 只小沼骸', target: 2,
    hint: '沼泽里住着小沼骸，拿起工具打跑 2 只！打不过就先跑回家，一点也不丢人！',
    praise: '小沼骸被你打跑啦！你越来越勇敢！',
    prog: (c) => Math.min(c.kill_bogged || 0, 2), check: (c) => (c.kill_bogged || 0) >= 2},
  {id: 'q25_witch_chest', icon: '📦', goal: '打开女巫小屋的宝箱', target: 1,
    hint: '高高的木头小屋里住着女巫，小心一点，打开屋里的宝箱吧！',
    praise: '女巫的宝箱打开啦！你是真正的大探险家！',
    prog: (c) => Math.min(c.chest_witch || 0, 1), check: (c) => (c.chest_witch || 0) >= 1},
  {id: 'q26_den_chest', icon: '🕳️', goal: '打碎怪物巢穴深处的宝箱', target: 1,
    hint: '东北边的黑石丘下藏着怪物的巢穴，钻进最深处，敲碎小宝箱吧！',
    praise: '巢穴宝箱敲碎啦！黑暗深处也难不倒你！',
    prog: (c) => Math.min(c.chest_den || 0, 1), check: (c) => (c.chest_den || 0) >= 1},
];

/* 门解锁链反查(§2.3 锁门话术与点亮仪式共用): 目标图 id → 挂 unlock 的那条
   任务(每图至多一条, 表结构由单测锁定); home 恒开/未知图 → null 不炸 */
function advUnlockQuest(mapId) {
  return ADV_QUESTS.find((q) => q.unlock === mapId) || null;
}

/* ------------------------------------------------------------
   隐藏配方解锁表(farm-and-recipe 设计稿 D2, 2026-10-28 用户拍板①)
   ------------------------------------------------------------
   KIT_HIDDEN_RECIPES(mode-kit 一期锁)的配方卡在探险缺省隐藏, 达成因果
   事件即解锁——解锁本身是教学时刻。谓词纯读 counts 记账键(事件处只 +=
   不判断的既有红线不破), 键 = 配方 id; 挂任务链解锁、不插任务步序
   (插步移老档 step 下标, 远征章「只追加」先例)。
   ------------------------------------------------------------ */
const ADV_RECIPE_UNLOCK = {
  bread: (c) => (c.collect_wheat || 0) >= 1, /* 首收小麦: 收成→食物链入口 */
  bone_meal: (c) => (c.kill_skeleton || 0) >= 1, /* 首杀骷髅: 骨头→骨粉 */
  bow_item: (c) => (c.kill_spider || 0) >= 1, /* 首杀蜘蛛: 线→弓(因果与骨粉同构) */
};

/* 当前已解锁清单(纯函数): 键序稳定(表声明序), 供壳 allow getter 与差集播报 */
function advUnlockedRecipes(counts) {
  return Object.keys(ADV_RECIPE_UNLOCK).filter((id) => ADV_RECIPE_UNLOCK[id](counts));
}

/* 新解锁差集(纯函数): now 有而 prev 没有的键——壳在任务节拍里播报「解锁啦」,
   prev 为壳侧已播集合快照 */
function advRecipeUnlockedNew(prev, counts) {
  const seen = new Set(prev);
  return advUnlockedRecipes(counts).filter((id) => !seen.has(id));
}

/* ============================================================
   大宝箱政策 (引导链 v2 / ADR 0007) — 纯函数段: 全局共享账户 +
   两轨容量(材料阶梯基础格 + 每个已放置箱子加格)
   ============================================================ */
const ADV_CHEST_SLOTS = 27; /* 材料阶梯顶格档(基础格上限, 与背包同宽) */
const ADV_CHEST_START = 9; /* 初始基础格数: 合成解锁的第一档 */
const ADV_CHEST_PER = 9; /* 每个已放置箱子的容量加格(ADR 0007: 多放箱子多格子) */
/* 材料扩容阶梯(拍板: 箱子只储物+全局共享+材料扩容): 9→18 档 8 圆石(第 7 步挖
   圆石即凑齐) · 18→27 档 4 铁锭(第 12 步烧铁)——材料刻意取任务链产物,
   扩容目标随引导进度自然到期; 挖掉箱子内容保留在账户里(零损失口径) */
const ADV_CHEST_TIERS = [
  {size: 18, cost: {cobble: 8}},
  {size: 27, cost: {iron_ingot: 4}},
];

/* 当前基础格数 → 下一档 {size, cost} | null(已顶格) */
function advChestNext(size) {
  for (const t of ADV_CHEST_TIERS) if (t.size > size) return t;
  return null;
}

/* 总容量(两轨合成, ADR 0007): 阶梯基础格 base + 每个已放置箱子 ADV_CHEST_PER
   格, 不设上限; chests 为负数按 0 兜底(坏档/异常不倒扣) */
function advChestCapacity(base, chests) {
  return base + ADV_CHEST_PER * Math.max(0, chests | 0);
}

/* 现存已放置箱子数(世界账本现算, 不落盘——ADR 0007): 各场景 edits 桶
   (advSceneEdits, 桶键→Map "x,y,z"→id|{id,lv})里值 === B_CHEST 的条数。
   只有玩家放置/挖除才进账本: 结构宝箱(神殿/雪屋/女巫小屋, 确定性建场)
   天然不计入; 挖掉的箱子账面变空气即除名; 流体格是 {id,lv} 对象,
   === 永不误中。调用时机=箱子增删(init/advMarkEdit 缝), edits 量级小 */
function advCountChestEdits(buckets) {
  let n = 0;
  for (const k of Object.keys(buckets)) {
    for (const v of buckets[k].values()) if (v === B_CHEST) n++;
  }
  return n;
}

/* 整摞入箱: 前 size 格先并堆(可堆叠)再进空位, 返回放不下的余量件数
   (0=全部收下; 满箱只拒收不惩罚, 余量由调用方留在背包原槽)。
   与 InventoryCore.add 的两处刻意差异: ① 只认前 size 格(总容量, 两轨合成
   见 advChestCapacity); ② 工具按原耐久整槽搬——add 经 mkStack 会把工具
   重铸满耐久, 不能复用 */
function advChestPut(chest, stack) {
  const max = stackMax(stack.id);
  if (!max) return stack.n; /* 未注册 = 拒收门禁(items-core, add 同口径): 不落格不污染 */
  let n = stack.n;
  if (max > 1) {
    for (let i = 0; i < chest.size && n > 0; i++) {
      const t = chest.slots[i];
      if (t && t.id === stack.id && t.n < max) {
        const mv = Math.min(max - t.n, n);
        t.n += mv; n -= mv;
      }
    }
  }
  for (let i = 0; i < chest.size && n > 0; i++) {
    if (chest.slots[i]) continue;
    const mv = Math.min(n, max);
    const st = {id: stack.id, n: mv};
    if (stack.dur != null) st.dur = stack.dur; /* 工具耐久原样保留 */
    chest.slots[i] = st;
    n -= mv;
  }
  return n;
}

/* 整摞出箱(advChestPut 的镜像): 可堆叠走 add 并堆; 可耗损物(工具/D7 灯笼)
   连耐久找空位整槽搬——add 经 mkStack 会把工具重铸满耐久, 可耗损物禁走
   (灯笼放箱一晚再取不能白得新耐久); 背包满整摞留在箱里。返回 'ok'(已搬)/
   'full'(满包拒收, 箱格原样)/'empty'(空槽无动作); 掉落/存档/观感归壳 */
function advChestTake(chest, inv, i) {
  const st = chest.slots[i];
  if (!st) return 'empty';
  if (!durOf(st.id)) {
    const left = add(inv, st.id, st.n);
    if (left >= st.n) return 'full';
    if (left > 0) st.n = left; else chest.slots[i] = null;
    return 'ok';
  }
  const j = inv.slots.findIndex((t) => !t);
  if (j < 0) return 'full';
  inv.slots[j] = st;
  chest.slots[i] = null;
  return 'ok';
}

/* ============================================================
   提醒政策 (code-review 修复轮 S4) — 纯函数段
   ============================================================ */
const ADV_WEAR_WARN_AT = 0.25; /* 低耐久预警线: 耐久比 <0.25 提醒(D9 耐久条红档同阈值) */
const ADV_BAG_FULL_BUFFER = 3; /* 背包快满周转格数: 占用 ≥ 容量-3 提醒(27 档=24, 33 扩容档=30) */
const ADV_BAG_CHECK_T = 0.5; /* 快满检查节流秒(update 内, 与任务链节拍同量级) */

/* 低耐久语音预警(S4①): 耐久比首次跌破 ADV_WEAR_WARN_AT → 返回 true(提醒
   一次)。warned 为调用方持有的工具 id 账本(Set)——同一把命只提醒一次
   (节流不唠叨), 破板/换掉由调用方 delete 重置; 纯函数不改入参以外的状态 */
function advWearWarn(warned, id, ratio) {
  if (!(ratio < ADV_WEAR_WARN_AT)) return false; /* 未到线不提醒 */
  if (warned.has(id)) return false; /* 本命已提醒过 */
  warned.add(id);
  return true;
}

/* 背包快满提醒(S4②): 占用槽 ≥ 容量-ADV_BAG_FULL_BUFFER → fire 一次; armed 为
   调用方持有的布尔账本——冷却口径=「回落再满」的上升沿: 占用回落到线下即
   重新武装(不按时间冷却, 整理/合成腾出格子后再满会再提醒一次); 持续满格
   不重复轰炸。cap 省略=基础 27 档(扩容档传 inv.slots.length)。返回新账本
   {armed, fire} */
function advBagFullStep(used, armed, cap) {
  const fullN = (typeof cap === 'number' && isFinite(cap)) ?
    Math.max(1, cap - ADV_BAG_FULL_BUFFER) : INV_SLOTS - ADV_BAG_FULL_BUFFER;
  if (used < fullN) return {armed: true, fire: false};
  return armed ? {armed: false, fire: true} : {armed: false, fire: false};
}

/* 工具坏话术(S4③): 安抚句 + 当前任务步 hint 并句——SpeechKit 是 cancel-
   then-speak, 拆两句会被后句顶掉前句(与任务链「表扬+引导并句」同口径);
   hint 为空(任务全部完成)不拼引导 */
function advBreakToolText(name, hint) {
  return '哎呀，' + name + ' 用坏了！不哭，我们再做一个更棒的！' +
      (hint ? ' 接下来：' + hint : '');
}

/* ============================================================
   床·睡觉政策 (昼夜 D6, mc-daylight-torch §7.2; 2026-10-28 用户拍板时钟改版:
   床点击不再一键睡到天亮, 开「时钟拨盘」自选醒来时刻——拨盘纯函数在
   daylight-core 的 clock* 族(时间轴派生量归引擎), 这里只剩睡觉判据) —
   常量与纯函数段
   ------------------------------------------------------------
   睡觉条件一条件制(原「夜窗+床边无怪」两条件, 时钟改版撤销夜窗——
   拨盘本身就是选时刻, 白天也可拨; 怪圈保留): 床 8 格(水平)内无活怪
   (MC 口径; passive 牧场动物不算怪——F4「动物不算怪」同口径)。
   转场观感(#fade 遮罩/TTS/跳时刻/出生点设床边)在壳 modes/adventure.js,
   这里只有判据与时间账。
   ============================================================ */
const ADV_BED_MOB_R = 8; /* 床边无怪判定半径(水平格, 含等号——advNearStation 同口径) */
const ADV_SLEEP_FADE = 1.5; /* 渐黑秒数(§7.2) */
const ADV_SLEEP_HOLD = 2; /* 全黑停留秒数(§7.2) */
const ADV_SLEEP_TOTAL = 5; /* 总时长 ≈ MC 101 tick=5.05s 观感等价(差异 #2) */

/* 睡觉条件(时钟改版后一条件制): mobs 为怪物快照([{x,z,dead?,gone?,passive?}]
   壳层从 Mobs.list() 采集成), bx/bz 为床格心坐标。返回 {ok, why}:
   'mob'(→toast「附近有怪物，睡不着」)。夜窗撤销(2026-10-28 时钟改版):
   白天点床=开拨盘选时刻, 不再 toast「晚上才能睡哦」。 */
function advSleepCheck(mobs, bx, bz) {
  for (const m of mobs) {
    if (m.dead || m.gone || m.passive) continue; /* 尸体/已移除/牧场动物不拦 */
    if (Math.hypot(m.x - bx, m.z - bz) <= ADV_BED_MOB_R) return {ok: false, why: 'mob'};
  }
  return {ok: true, why: ''};
}

/* 睡觉转场时间账(纯函数): t 为已进行秒, 返回 {t, phase, opacity, wake} —
   phase: 'out' 渐黑(opacity=t/1.5) → 'hold' 全黑停 → 'in' 渐亮
   (opacity=(5−t)/1.5) → 'done'; wake=true 恰在跨过 1.5+2=3.5s 的一步
   (渐亮起沿, 壳层在此做 dayTime=0 + 夜怪清场 + 出生点设床边), 大步跨沿
   也只发一次; t 钳在总时长 */
function advSleepStep(t, dt) {
  const nt = Math.min(ADV_SLEEP_TOTAL, t + dt);
  const edge = ADV_SLEEP_FADE + ADV_SLEEP_HOLD; /* 唤醒沿 = 渐黑+停留 */
  const wake = t < edge && nt >= edge;
  let phase = 'out';
  let opacity = nt / ADV_SLEEP_FADE;
  if (nt >= ADV_SLEEP_TOTAL) {
    phase = 'done';
    opacity = 0;
  } else if (nt >= edge) {
    phase = 'in';
    opacity = (ADV_SLEEP_TOTAL - nt) / ADV_SLEEP_FADE;
  } else if (nt >= ADV_SLEEP_FADE) {
    phase = 'hold';
    opacity = 1;
  }
  return {t: nt, phase, opacity, wake};
}

/* 床边出生位选址(§7.2 MC 口径, 纯函数): 床四水平邻(取序 +x/−x/+z/−z)取
   「两格净空+脚下实心支承」的首格格心(advPlaceCheck 同款支承判: 薄块/
   无定义当不了支承); 四邻全堵回落 fb(壳传玩家当前位——点得到床必在触达内,
   人本就在床边)。方块读经 getB 注入(seam 先例: advNightStep 的 read)。 */
function advBedSpot(bx, by, bz, getB, fb) {
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = bx + d[0]; const nz = bz + d[1];
    if (getB(nx, by, nz) !== 0 || getB(nx, by + 1, nz) !== 0) continue; /* 站位两格净空 */
    const sup = BLOCKS[getB(nx, by - 1, nz)];
    if (!sup || sup.solid === false || sup.thin != null) continue; /* 脚下实心 */
    return {x: nx + 0.5, y: by, z: nz + 0.5, yaw: 0};
  }
  return fb;
}

/* ============================================================
   昼夜 D7 灯笼耗秒政策(mc-daylight-torch §8.2) — 常量与纯函数段
   ------------------------------------------------------------
   节拍器 advLanternStep 与 advNightStep 同构(状态进 · {t, 决策} 出);
   三前置「选中灯笼 且 耐久>0 且 skyDim>0」= 天黑才亮才耗(白天/手持
   别物/燃尽全不亮不耗, 耗秒器归零)。扣耐久(damageTool 管线)/归零
   消失+TTS 安抚/setPlayerGlow 双通道光照开关(引擎机制缝, D3 备好)
   全在壳 modes/adventure.js 的 advLanternTick——核心保持零实体耦合。
   ============================================================ */
const ADV_LANTERN = {
  ID: 'lantern', /* 灯笼物品键(items-core 注册, 可耗损物 dur=300) */
  DRAIN_S: 1, /* 每持满 1 秒扣 1 耐久(dt 累计器, §8.2) */
};

/* 灯笼耗秒节拍: s 为秒累计, heldId 为快捷栏选中物品 id, dur 为灯笼
   当前耐久, skyDim 为天空暗度(壳层从 Daylight.skyDim(dayTime) 取)。
   返回 {t, glow, drain} — t=新累计秒 · glow=是否点亮(壳层喂
   setPlayerGlow) · drain=本步是否持满 1 秒(壳层 damageTool 扣 1) */
function advLanternStep(s, dt, heldId, dur, skyDim) {
  if (heldId !== ADV_LANTERN.ID || dur <= 0 || skyDim <= 0) {
    return {t: 0, glow: false, drain: false}; /* 前置不满足: 不亮不耗且累计器归零 */
  }
  const nt = s + dt;
  if (nt < ADV_LANTERN.DRAIN_S) return {t: nt, glow: true, drain: false};
  return {t: nt - ADV_LANTERN.DRAIN_S, glow: true, drain: true}; /* 余时结转下一秒 */
}

/* ============================================================
   传送门段 (docs/nether-merge-design.md §3.2) — 门词汇三家共用
   ------------------------------------------------------------
   门阵/下界/巢穴副本三家共用的传送门结构与判定留本文件
   (ADV_PORTAL 门框几何·advPortalFrame 整门建场·advInPortal O(1) 内口判定·
   advPortalSiteOk 放置校验·advPortalExit 落点口径)。维度专属段
   (ADV_NETHER/advNetherBuild、ADV_ERUPT/advEruptStep、ADV_DEN 副本段与
   advMusicMood) 已随维度 vocabulary 归家迁入 js/adventure-dims-core.js
   (2026-10-30, docs/dimension-registry-design.md)。
   ============================================================ */
const ADV_PORTAL = {w: 6, h: 7, cd: 0.8};
/*   门框宽×高(内口 4×5) + 传送冷却秒(落地时空眩晕, 两界门都不触发) */

/* 整座下界传送门: 黑曜石框 + 紫色内口门面 + 塔楼 + 门楣 + 发光岩 + 前后
   步道 —— 逐字迁自 nether 模式 buildPortalFrame(行为逐字等价)。
   set(x,y,z,id) 注入缝: 场景基座传 setBlockRaw, 玩家放置传「setBlockRaw+
   逐格记账」sink(结构以 edits 形态存在, 重放即重建——与 journal 互锁
   红线同构)。
   look 观感主题(2026-10-27 门阵精细化, 缺省 undefined = 经典下界门):
   {tower 塔楼主体, crown 冠带, path 步道主砖, pathAlt 步道花砖} 四建材随
   目的地换装(ADV_MAPS home 行 gates[].look——沙漠砂岩/雪原雪冰/沼泽苔石),
   并附步道前缘双火把灯柱; 黑曜石门框环(底边/顶边/侧柱/四角发光岩)与紫色
   门面**永不换装**——「传送门魔法」的辨识底座。逐格契约: 内口 4×5 门面
   (px+1..px+4 / by+1..by+5 / 单 z 平面)与结构包围盒(px-1..px+W,
   pz-1..pz+1)不变——advGateAt/advPortalSiteOk/光束锚定全靠它 */
function advPortalFrame(set, by, px, pz, look) {
  const W = ADV_PORTAL.w; const H = ADV_PORTAL.h;
  const tw = look ? look.tower : B_OBSIDIAN; /* 塔楼主体(缺省黑曜石=经典) */
  const cr = look ? look.crown : B_OBSIDIAN; /* 冠带: 塔顶带/门楣横带 */
  const p1 = look ? look.path : B_NETHER_BRICK; /* 步道主砖 */
  const p2 = look ? look.pathAlt : p1; /* 步道花砖(缺省同主砖=经典整铺) */
  for (let x = px; x <= px + W - 1; x++) set(x, by, pz, B_OBSIDIAN); /* 底边 */
  for (let x = px; x <= px + W - 1; x++) set(x, by + H - 1, pz, B_OBSIDIAN); /* 顶边 */
  for (let y = by + 1; y <= by + H - 2; y++) {
    set(px, y, pz, B_OBSIDIAN); /* 侧柱 */
    set(px + W - 1, y, pz, B_OBSIDIAN);
    for (let x = px + 1; x <= px + W - 2; x++) set(x, y, pz, B_PORTAL); /* 内口 = 紫色门面 */
  }
  for (const gx of [px, px + W - 1]) {/* 开口四角发光岩 */
    for (const gy of [by + 1, by + H - 2]) set(gx, gy, pz, B_GLOWSTONE);
  }
  for (const tx of [px - 1, px + W]) {/* 两侧塔楼: 主体收顶 + 冠带 + 发光岩灯 */
    for (let y = by; y <= by + H - 1; y++) set(tx, y, pz, tw);
    set(tx, by + H, pz, cr);
    set(tx, by + H + 1, pz, B_GLOWSTONE);
  }
  for (let x = px; x <= px + W - 1; x++) set(x, by + H, pz, cr); /* 门楣: 冠带横贯(与塔顶带同高) */
  for (let x = px + 1; x <= px + W - 2; x++) set(x, by + H + 1, pz, cr); /* 上带逐层收窄 */
  for (let x = px + 2; x <= px + W - 3; x++) set(x, by + H + 2, pz, B_GLOWSTONE); /* 顶心发光岩 */
  for (const dz of [-1, 1]) {/* 前后步道(与地表齐平): 后排主/花砖相间出纹理, 前排整条主砖 */
    for (let x = px - 1; x <= px + W; x++) {
      set(x, by, pz + dz, dz < 0 ? (((x - px) % 2 === 0) ? p1 : p2) : p1);
    }
  }
  if (look) {/* 门前灯柱(主题门限定): 步道前缘两端火把, 夜里给门阵引光 */
    set(px - 1, by + 1, pz + 1, B_TORCH);
    set(px + W, by + 1, pz + 1, B_TORCH);
  }
}

/* x 平面门体变体(〔世界边界·T8〕world-edge-t8-plan §2 T8-C): 门面法线 ±x 的
   门——沼泽东缘回程门「内侧 2.5 格面朝图内」字面成立的唯一几何(z 平面门的
   内向位移会落进门框柱/塔楼柱实心格, 孩子东行回家还得侧身蹭门)。实现用
   **转置包装**(几何零第二份, 同源原则): 内层 advPortalFrame 以原点为锚建
   标准 z 平面门, 写入缝做坐标转置 (x,y,z) → set(px+z, y, pz+x, id)——得
   x∈[px−1,px+1]、z∈[pz−1,pz+6] 的镜像门, 内口 4×5 门面在 x=px 单平面上;
   黑曜石框/门面/发光岩/步道/火把全继承, 观感件零重写。所有 z_local=0 元素
   (底/顶边/柱/门面/发光岩/门楣/塔楼)全落 x=px 单平面, 塔楼在 (px,·,pz−1)/
   (px,·,pz+6), 步道在 x=px±1。消费点(advGatesBuild/advGateAt/光束锚 x 平面
   分派)归波次二壳层, 本体只建场 */
function advPortalFrameX(set, by, px, pz, look) {
  advPortalFrame((x, y, z, id) => set(px + z, y, pz + x, id), by, 0, 0, look);
}

/* 传送门内口判定(O(1), 免门位注册表): 玩家浮点坐标 → 脚格(floor x,
   floor y, floor z)与头格(+1)任一为 B_PORTAL 即在门内——玩家放置的门
   与下界回程门同一条判据; read 为方块读 seam(壳传 getBlock) */
function advInPortal(read, x, y, z) {
  const fx = Math.floor(x); const fy = Math.floor(y); const fz = Math.floor(z);
  return read(fx, fy, fz) === B_PORTAL || read(fx, fy + 1, fz) === B_PORTAL;
}

/* 传送门放置校验: 结构包围盒(x: px-1..px+ADV_PORTAL.w, y: by..by+
   ADV_PORTAL.h+2, z: pz-1..pz+1——塔楼/门楣/步道外沿全含)内全部格为
   空气, 且玩家(浮点 {x,y,z}, 按脚格判)不入盒(放置瞬间不被结构罩住)。
   返回 {ok:true} | {ok:false, reason:'blocked'|'inside'} */
function advPortalSiteOk(read, p, by, px, pz) {
  const x1 = px - 1; const x2 = px + ADV_PORTAL.w;
  const y1 = by; const y2 = by + ADV_PORTAL.h + 2;
  const z1 = pz - 1; const z2 = pz + 1;
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) {
        if (read(x, y, z) !== 0) return {ok: false, reason: 'blocked'};
      }
    }
  }
  const inside = Math.floor(p.x) >= x1 && Math.floor(p.x) <= x2 &&
      Math.floor(p.y) >= y1 && Math.floor(p.y) <= y2 &&
      Math.floor(p.z) >= z1 && Math.floor(p.z) <= z2;
  if (inside) return {ok: false, reason: 'inside'};
  return {ok: true};
}

/* 传送出口: 沿玩家来向退 2.5 格、yaw 反向(落地推前进=离开门)——yaw 约定
   forward=(sin yaw, cos yaw), 与 Mobs.steer 的 atan2(dx,dz) 同源, 单测
   钉死数值; y 原样(来向地面已知安全)。回上界出生点用进门时刻记录的
   本函数结果(设计稿 §3.3) */
function advPortalExit(x, y, z, yaw) {
  return {x: x - Math.sin(yaw) * 2.5, y, z: z - Math.cos(yaw) * 2.5, yaw: yaw + Math.PI};
}


/* ============================================================
   门与玻璃板段 (docs/door-window-design.md §3) — 合成家具政策
   ------------------------------------------------------------
   门 = 2 格真结构(拍板①), 放置校验/开关计划在此段(引擎零改动): 级联旗标
   不可用(isSupport=实心判定, 下半开门态非实心会误判失撑, 见设计稿 §2.2),
   走「放置校验 / 开关计划」纯函数 + 配对破坏在配对方块行注册表
   (js/paired-block-core.js, 2026-11-04 架构评审候选①), 壳与 kit 只认行表。
   玻璃板无专门政策——常规单格放置路径天然成立。
   ============================================================ */
/* 门四态 id 集(下/上半 × 关/开, config B_DOOR~B_DOOR_TOP_OPEN):
   身份判据读 config 旗标(door/doorLower, config.js:410 哲学——mesh-core
   同源; 配对方块行注册表 js/paired-block-core.js 消费同款), 不含位置/
   朝向条件(级联身份原则同款) */
function advIsDoor(id) {
  const b = BLOCKS[id];
  return !!(b && b.door);
}
function advIsDoorLower(id) {
  const b = BLOCKS[id];
  return !!(b && b.door && b.doorLower);
}

/* 玩家(浮点 {x,y,z})是否占据 (x,y,z) 与 (x,y+1,z) 两格之一(按脚/头格判) */
function advDoorPlayerIn(p, x, y, z) {
  const px = Math.floor(p.x); const py = Math.floor(p.y); const pz = Math.floor(p.z);
  return px === x && pz === z && (py === y || py === y + 1 || py + 1 === y || py + 1 === y + 1);
}

/* 门放置校验(结构放置, advPortalSiteOk 同款缝): 目标格与上格全空气 +
   下方实心支撑(solid!==false, 级联同判据) + 玩家不入两格。
   返回 {ok:true, cells:[{x,y,z,id}×2 闭合态对]} | {ok:false, reason} */
function advDoorSiteOk(read, p, x, y, z) {
  if (read(x, y, z) !== 0 || read(x, y + 1, z) !== 0) return {ok: false, reason: 'blocked'};
  const below = BLOCKS[read(x, y - 1, z)];
  if (!below || below.solid === false) return {ok: false, reason: 'nosupport'};
  if (advDoorPlayerIn(p, x, y, z)) return {ok: false, reason: 'inside'};
  return {ok: true, cells: [{x, y, z, id: B_DOOR}, {x, y: y + 1, z, id: B_DOOR_TOP}]};
}

/* 门开关计划(交互纯段): lookId 命中门任一半 → 定位下半格 → 产出两格的
   成对换 id 写入(64↔66 / 65↔67, 状态即 id)。关门且玩家站门洞 → 拒
   (children 话术由壳出; 怪物不查, 附录 B)。开不查人(开门永不受阻)。
   双开耦合(MC 口径, 2026-11-04 修订): 四向(x±1/z±1)直接相邻门列随动写入目标态
   (南北墙双门/地上沿 z 摆的双门此前不在 x±1 内各开各的; 目标态同步让状态发散
   一步收敛), 关门占位检查含随动列; 只耦合直接相邻一列不链式传播(三连门点中间
   带两扇 = 可接受退化)。2 格门洞放两扇即成双开门, 一点全开。
   返回 {ok:true, writes:[{x,y,z,id}×2 或 ×4], open} | {ok:false} */
function advDoorTogglePlan(read, lookId, p, x, y, z) {
  if (!advIsDoor(lookId)) return {ok: false};
  const ly = advIsDoorLower(lookId) ? y : y - 1; /* 命中上半 → 下半在脚下 */
  const lowId = read(x, ly, z);
  if (!advIsDoorLower(lowId)) return {ok: false, reason: 'half'}; /* 半扇残门: 无从开关 */
  const opening = lowId === B_DOOR;
  if (!opening && advDoorPlayerIn(p, x, ly, z)) return {ok: false, reason: 'occupied'};
  const topId = read(x, ly + 1, z);
  const writes = [{x, y: ly, z, id: opening ? B_DOOR_OPEN : B_DOOR},
    {x, y: ly + 1, z, id: opening ? (topId === B_DOOR_TOP ? B_DOOR_TOP_OPEN : topId) : B_DOOR_TOP}];
  /* 双开耦合(2026-11-04 修订): 四向直接相邻门列(x±1/z±1, 南北墙双门与地上
     沿 z 摆的双门此前各开各的)随动写入**目标态**(非「同状态才耦合」——状态
     发散(开侧放新门等)一步收敛同态); 已在目标态零写入(占位检查仍含);
     只耦合直接相邻一列不链式传播(三连门点中间带两扇 = 可接受退化) */
  const lo = opening ? B_DOOR_OPEN : B_DOOR;
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nx = x + dx; const nz = z + dz;
    const nLow = read(nx, ly, nz);
    if (!advIsDoorLower(nLow)) continue;
    if (!opening && advDoorPlayerIn(p, nx, ly, nz)) return {ok: false, reason: 'occupied'};
    const nTop = read(nx, ly + 1, nz);
    const hi = opening ? (nTop === B_DOOR_TOP ? B_DOOR_TOP_OPEN : nTop) : B_DOOR_TOP;
    if (nLow === lo && nTop === hi) continue; /* 已在目标态: 不产冗余写入 */
    writes.push({x: nx, y: ly, z: nz, id: lo}, {x: nx, y: ly + 1, z: nz, id: hi});
  }
  return {ok: true, open: opening, writes};
}

/* 门配对破坏计划: 已迁 js/paired-block-core.js(配对方块行注册表, 2026-11-04
   架构评审候选①)——三态补发口径在彼处唯一权威; 门身份判据仍在此文件
   (advIsDoor/advIsDoorLower 读 config door/doorLower 旗标)。 */

/* ---------- 床两格结构 (两格床改版 2026-10-29, 门结构放置同款缝) ----------
   床头 53 + 床尾 69 成对, 取向不存档(确定性重放红线): 配对用正典形
   「床头恒在轴向较小坐标端」从世界状态唯一重建——放置按此形落格
   (advBedSiteOk); 配对破坏按此形认亲(advBedBreakPlan, 已迁
   js/paired-block-core.js 配对方块行注册表, 正典形判据+触发格身份门随迁)。 */
/* 床放置校验: 目标格与床头格(沿玩家朝向的邻格)全空气 + 两格下方实心支撑
   (级联同判据) + 玩家不入两格(advDoorPlayerIn 同款两格高判)。
   返回 {ok:true, cells:[{x,y,z,id}×2 床头/床尾]} | {ok:false, reason} */
function advBedSiteOk(read, p, yaw, x, y, z) {
  if (read(x, y, z) !== 0) return {ok: false, reason: 'blocked'};
  const fx = -Math.sin(yaw); const fz = -Math.cos(yaw); /* 朝向(camera-rig lookDir 同式) */
  const dx = Math.abs(fx) > Math.abs(fz) ? Math.sign(fx) : 0; /* 朝向取主导轴(45° 平局归 z, 确定性) */
  const dz = Math.abs(fx) > Math.abs(fz) ? 0 : Math.sign(fz);
  const hx = x + dx; const hz = z + dz; /* 床头候选格(沿朝向的邻格) */
  if (read(hx, y, hz) !== 0) return {ok: false, reason: 'blocked'};
  const belowT = BLOCKS[read(x, y - 1, z)]; const belowH = BLOCKS[read(hx, y - 1, hz)];
  if (!belowT || belowT.solid === false || !belowH || belowH.solid === false) {
    return {ok: false, reason: 'nosupport'};
  }
  if (advDoorPlayerIn(p, x, y, z) || advDoorPlayerIn(p, hx, y, hz)) {
    return {ok: false, reason: 'inside'};
  }
  const headFirst = (dx !== 0) ? (hx < x) : (hz < z); /* 正典形: 床头在较小坐标端 */
  return {ok: true, cells: [
    {x: headFirst ? hx : x, y, z: headFirst ? hz : z, id: B_BED},
    {x: headFirst ? x : hx, y, z: headFirst ? z : hz, id: B_BED_FOOT},
  ]};
}

/* 床配对破坏计划: 已迁 js/paired-block-core.js(配对方块行注册表, 2026-11-04
   架构评审候选①)——正典形认亲 + 触发格身份门(bed 旗标)在彼处唯一权威 */

/* ---------- 门号段存档迁移(2026-10-28 用户报告「关门能穿/开门过不去」根因) ----------
   门与玻璃板首落地号段 63~67(6461fa9), 熄门 B_PORTAL_DIM 占 63 后整体 +1
   (5708c24)——间隙里落盘的世界档 edits 账本存的是旧 id: 旧关门(63/64)新读作
   B_PORTAL_DIM(solid:false → 门关着也能穿)与 B_DOOR(错位), 旧开门(65/66)新读
   作 B_DOOR_TOP(实心 → 门开着也过不去)。
   迁移触发 = 账本里出现 63: 熄门是建场件(setBlockRaw 直写不记账, T7)+声明式
   不可破坏(无 hard)+TNT 免疫, 新档的 63 永不进账本——有 63 即旧档铁证, 此时
   63~67 逐值 +1(单遍映射, 无连锁移位); 无 63 不动(新档 64~68 合法在档, 盲移
   会误伤)。已知保守局限: 旧档账本终态只剩开门态(65/66, 关门格全被后写覆盖)
   时无 63 不触发——宁漏移不误移, 该形态只能靠后续版本位兜底。
   接线: adventure.js advWorldSlot schema version 2 的 migrate 链(from ≥1 才
   跑, v0 档早于门与玻璃板天然无门); 幂等由触发条件保证——移位后 63 清零,
   落盘 _v:2 不再进链。 */
function advDoorEditBuckets(sv) {/* 原始档 → 数组账本清单(三代档形, 原引用不拷贝) */
  const out = [];
  if (!sv || typeof sv !== 'object') return out;
  if (Array.isArray(sv.edits)) out.push(sv.edits); /* 一代老档: 裸 edits 数组恒属 home */
  else if (sv.edits && typeof sv.edits === 'object') {
    for (const k in sv.edits) if (Array.isArray(sv.edits[k])) out.push(sv.edits[k]);
  } /* 现行分桶对象: home/desert/snow/swamp/nether 各一数组 */
  if (Array.isArray(sv.netherEdits)) out.push(sv.netherEdits); /* 二代老档: 顶层 nether 账 */
  return out;
}
function advDoorIdsStale(sv) {/* 旧档判定: 任一账本格值 = 63(旧 B_DOOR, 今熄门) */
  for (const arr of advDoorEditBuckets(sv)) {
    for (const e of arr) {
      if (!Array.isArray(e)) continue;
      const v = e[1];
      const id = (v && typeof v === 'object') ? v.id : v;
      if (id === 63) return true;
    }
  }
  return false;
}
function advDoorIdsMigrate(sv) {/* 原地移位 63~67 → +1; 无旧档特征原样返回 */
  if (!advDoorIdsStale(sv)) return sv;
  for (const arr of advDoorEditBuckets(sv)) {
    for (const e of arr) {
      if (!Array.isArray(e)) continue;
      const v = e[1];
      if (typeof v === 'number') {
        if (v >= 63 && v <= 67) e[1] = v + 1;
      } else if (v && typeof v === 'object' && typeof v.id === 'number' &&
          v.id >= 63 && v.id <= 67) {
        v.id += 1; /* 流体格 {id,lv} 同窗兜底(窗口内本无流体, 形状对齐 fluidCell) */
      }
    }
  }
  return sv;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {ADV_GROUND, ADV_HUT, ADV_SPAWN, ADV_LAKE, ADV_PITS, ADV_CAVE, ADV_NESTS,
    ADV_ORES, ADV_TREES, ADV_RING, ADV_HUT_C, ADV_FLATS, advRingAmp, advHeightAt,
    ADV_GATE_PLAZA, ADV_GATE_PLAZA_PAD, ADV_FARM, ADV_PEN, ADV_PATH, advInRect,
    ADV_PINE, ADV_TOWER, ADV_STONES, ADV_MEADOW, ADV_POND,
    advBaseTerrain, advBuildLake, advOreCluster, advScatterOres,
    advBuildPit, advTryOre, advBuildCave, advBuildHut, advBuildNest, advTreeBlocked,
    advBuildPlaza, advBuildFarm, advBuildPen, advBuildPath, advScatterFlowers,
    advBuildPond, advBuildTower, advBuildStones, advPineTree, advBuildPineGrove, advBuildMeadow,
    advPlantTrees, advTreeSpots, advScatterTufts, advBuildWorld, advDeathPlan,
    ADV_NEST_MIN, ADV_NEST_MAX, ADV_NEST_RESPAWN_T, ADV_NEST_AGGRO_R, ADV_NEST_LEASH_R,
    ADV_NEST_HOME_R, ADV_NEST_RING_LO, ADV_NEST_RING_HI, ADV_DMG_CAP, ADV_MELEE_R,
    ADV_SWING_CD, ADV_FIST_DMG, ADV_AIM_COS, ADV_ATTACK_T, ADV_ARROW_SPEED, ADV_PICKUP_WINDOW,
    ADV_SNOWBALL_SPEED, ADV_SNOWBALL_G, ADV_SNOWBALL_KPOW, ADV_SNOWBALL_LIFE, ADV_SNOWBALL_CD,
    ADV_BOW_SPEED, ADV_BOW_G, ADV_BOW_DMG, ADV_BOW_KPOW, ADV_BOW_LIFE, ADV_BOW_CD,
    advNestCount, advNestStep, advSwingDmg, advMobDmg, advDeathDrops, advPickupText,
    ADV_NIGHT, ADV_HOME_ROW, advNightCanSpawn, advNightStep, advNightStepPool,
    advDawnSweep,
    ADV_MINE_SWING, ADV_SAP_GROW, advMineStep, advPlaceCheck, advEatPolicy, advSapDue,
    ADV_STATION_R, ADV_TNT_FUSE, ADV_TNT_R, ADV_TNT_HURT_R, ADV_TNT_DMG_HI,
    ADV_TNT_DMG_LO, ADV_TNT_DROP_P, ADV_SMELT_TTS_T, advNearStation, advLosBlocked,
    advFurnaceValid, advFurnaceClean, advTntRoll, advTntDmg,
    ADV_LIVESTOCK_SPAWN_R, ADV_LIVESTOCK_HERD_R, ADV_LIVESTOCK_RING_LO,
    ADV_LIVESTOCK_RING_HI, ADV_LIVESTOCK_HERDS, ADV_HERD_AVOID_R, ADV_HERD_AVOID_MULT,
    ADV_HERD_FLEE_T, ADV_HERD_FLEE_MULT, ADV_HERD_AMBLE_MULT,
    advLivestockHerdOk, advLivestockSpots, advLivestockPlan, advHerdStep,
    ADV_HERD_PAD, advHerdClamp,
    ADV_BREED_CD_S, ADV_BABY_GROW_S, ADV_BREED_R, ADV_LIVESTOCK_CAP, ADV_BABY_SCALE,
    advBredNorm, advShearedNorm, advLivestockNormBucket, advBreedPairOk, advBabyAdult, advBreedHerdOf,
    ADV_TREE_REGROW_S, ADV_TREE_REGROW_JIT, ADV_TREE_REGROW_RETRY_S, ADV_LOG_ID,
    advTreeSpotOpen, advTreeRegenSpots,
    ADV_ORE_IDS, advIsOre, advOreKey, advOreParseKey, advOreDue, advOreRefillPlan,
    advOreSpots, advOreSpotsReset,
    ADV_STONE_EGG_CD, ADV_STONE_HINT_CD, ADV_STONE_EGG_GIFT,
    advStoneAltarHit, advStoneEggPick,
    ADV_EDGE_SKY, advEdgeRgb, advEdgeSkyAt, advBuildEdgeBands,
    ADV_EDGE_SKY_WEST_OPEN, /* 〔世界边界·T8〕组 9 钉「缺省选表逐位一致」消费 */
    advEdgeNorth, advEdgeSouth, advEdgeWest, advEdgeEast,
    advSetEdgeBarriersHidden, advSetEdgeUnlockCounts,
    advEdgeOpenDir, advEdgeTransitDirAt, advEdgeHintAt,
    advEdgeProtectedAt, advEdgeProtectedZone,
    ADV_EDGE_NIGHT_POOL, advEdgeThemeAt, advEdgeNightPoolAt, /* 〔世界边界·T11〕过渡带主题夜怪判据 */
    advEdgeNorthMountainH, ADV_EDGE_HOME_SKY, /* T7 转正测试消费(找山体列/旁路原引用钉) */
    ADV_QUEST_CHECK_T, ADV_QUEST_TITLE, ADV_MINE_TALLY, ADV_QUESTS, advUnlockQuest,
    ADV_CHEST_SLOTS, ADV_CHEST_START, ADV_CHEST_PER, ADV_CHEST_TIERS, advChestNext,
    advChestCapacity, advCountChestEdits, advChestPut, advChestTake,
    ADV_WEAR_WARN_AT, ADV_BAG_FULL_BUFFER, ADV_BAG_CHECK_T, advWearWarn, advBagFullStep,
    advBreakToolText, ADV_HOME_CD, advHomeReady,
    ADV_BED_MOB_R, ADV_SLEEP_FADE, ADV_SLEEP_HOLD, ADV_SLEEP_TOTAL,
    advSleepCheck, advSleepStep, advBedSpot,
    ADV_LANTERN, advLanternStep,
    ADV_TNT_TAP_T, advTntTapStep, advCascadeLedger, advGrowMark,
    advExplodeCells, advTntWave, ADV_HERD_AMBLE_WALK_P, advAmbleStep,
    ADV_PORTAL, advPortalFrame, advPortalFrameX,
    advInPortal, advPortalSiteOk, advPortalExit,
    ADV_DEN_NEST_DOOR,
    advIsDoor, advIsDoorLower, advDoorSiteOk, advDoorTogglePlan,
    advDoorIdsStale, advDoorIdsMigrate,
    advBedSiteOk,
    ADV_WHEAT_GROW, advHoeOk, advPlantOk, advWheatNext, advRipenOk,
    ADV_RECIPE_UNLOCK, advUnlockedRecipes, advRecipeUnlockedNew};
}
