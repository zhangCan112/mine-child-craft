'use strict';
/* ============================================================
   维度规格核心 (AdventureDimsCore) — 应用层·纯核心
   ------------------------------------------------------------
   探险模式的维度注册表(docs/dimension-registry-design.md): 下界 nether
   与巢穴副本 den 两个维度相位的切界政策唯一权威——建场序列/天穹/曲目/
   昼夜开关/落点/HUD 横幅收进一行注册(地图侧 ADV_MAPS 同款先例), 壳层
   advSetDim/advPlayerDied/HUD/advSyncMood 读表驱动, 维度政策不再散在
   壳层 if 分支。维度 vocabulary 归家: 下界/巢穴副本/夜袭涌出的结构常量
   与建场/刷怪/涌出纯函数随本文件迁入(迁自 adventure-core, 2026-10-30);
   共享门词汇(advPortalFrame/advInPortal/advPortalExit)与地表 POI
   (ADV_NESTS/advBuildDenNest/ADV_DEN_NEST_DOOR)留 adventure-core。
   assets 字段是「副本素材」预留缝(GLOSSARY『副本素材』): null=走缺省
   方块集; 字段细形等第一个带专属贴图+建模的副本来定, 勿提前填实。
   interface: 维度注册表 ADV_DIMS(行字段: id/build 建场序列/sky 天穹四
     参数/mood 曲目/dayCycle 昼夜开关/spawn 进场落点(加载期从结构常量
     派生)/hud{banner,showMobs}/assets 预留缝) · advDimRow(id) 取行 ·
     advMusicMood(维度×昼夜→mood 桥接) · ADV_NETHER/advNetherBuild ·
     ADV_ERUPT/advEruptStep · ADV_DEN/ADV_DEN_TUNNELS(弯隧道折线)/
     ADV_DEN_GUARDS(固定布防表)/advDenRoomCenter(房心) · advDenBuild/
     advDenMineRoom/advDenStep(清怪波次节拍+5 轮封顶 chest 信号)/advDenWavePlan(波次计划)
       · ADV_DEN_LOOT(宝箱掉落表)/advDenLootRoll/advLootChestPlan(宝箱配对破坏计划)
      · ADV_DEN_LOOT_SMALL(低档掉落表)/advLootChestSmallPlan(低档单格破坏计划, D18)
      · advDenDailyStep(每日副本刷新判据, D20——日键注入, core 零 Date 依赖)
   依赖(均经全局名, 调用期解析): adventure-spawn-core.js 的 advSpawnPulse/
     advWeightedPick/advRingSpot(刷怪三件, 候选 2 归一——涌出/副本节拍
     薄壳组装, 加载序先于 adventure-core) · adventure-core.js 的 advPortalFrame/
     advOreSpotsReset/advTryOre(建场调用期消费; index.html 加载序:
     adventure-spawn-core → adventure-core → adventure-maps-core → 本文件 → modes/adventure →
     showroom-core) · config.js 的 B_*、WORLD_* 与 voxel.js 的
     setBlockRaw/getBlock、scene-kit.js 的 SceneKit(建场期) ·
     daylight-core.js 的 Daylight(涌出夜门)
   可测性: 零 THREE·零 DOM·有单测(test/adventure-dims-core.test.js;
   vm 装真引擎件+adventure-core 铺全局后 require 直测, adventure-maps-
   core.test 同款惯例——本文件顶层 spawn 派生与建场函数体都经全局名
   读 adventure-core 的符号, Node 侧须先 Object.assign 全局)
   ============================================================ */

/* ============================================================
   下界结构常量与建场(迁自 adventure-core 下界段, docs/nether-merge-
   design.md §3.2) — 2026-10-30 维度 vocabulary 归家迁入, 行为零改动
   ============================================================ */
const ADV_NETHER = {ground: 20, portal: {px: 24, pz: 24}, base: {x: 25.5, z: 30.5}};
/*   下界平地顶层 y(脚踩 21; 下界地面是平的) / 回程门框位置(门基 by 用
      ground 派生) / 下界落点(离门数格, 在无熔岩的出生区内) */

/* 下界建场: 平整下界岩地面 + 3×3 成片熔岩池 —— 迁自 nether 模式
   buildNetherWorld。确定性重放红线: SceneKit.rand 种子化, 零 Math.random;
   出生区(x,z<44, 回程门与落点所在)不铺熔岩。2026-10-27 修活: 原版
   hashRand(...) > 0.93 恒假(hashRand 输出域截断 [0,0.5), scene-kit 头注释
   登记的特性, 散布应走 SceneKit.rand)——退役前的下界从未长出过熔岩,
   与「平地上的可见障碍」原意/共识「唯一危险=岩浆」相悖, 本次随合并修正 */
function advNetherBuild() {
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 0; y <= ADV_NETHER.ground; y++) setBlockRaw(x, y, z, B_NETHERRACK); /* 平整地面 */
      if (x < 44 && z < 44) continue; /* 出生区/回程门: 不铺熔岩 */
      if (SceneKit.rand(Math.floor(x / 3), Math.floor(z / 3), 7) > 0.93) {
        setBlockRaw(x, ADV_NETHER.ground, z, B_LAVA);
      } /* 3×3 成片的熔岩池(同 3×3 索引喂 rand, 格内同池成片) */
    }
  }
}

/* ============================================================
   夜袭涌出 (den-nest-design §2.2) — 黑巢夜间从洞口爬怪的节拍纯函数
   ------------------------------------------------------------
   与环带铺怪(壳 advNightLayRing)并行的第二通道:「大量怪物从地下洞穴
   出来, 在周围游荡」的直译。涌出怪照走夜怪账(__nightMob 黎明清场/
   床跳夜清场), 家锚=巢口(AI leash 收敛在巢穴周围——游荡不离家); 与
   环带共享 ADV_NIGHT.CAP 封顶(儿童红线不松动), 涌出另有自持小配额
   (QUOTA)防把环带名额吃光。涌出锚点坐标 ADV_DEN_NEST_DOOR 与地表
   POI 建场留 adventure-core(巢穴词汇), 落地在壳层 advEruptTick。
   ============================================================ */
const ADV_ERUPT = {
  TRY_S: 3, /* 涌出节拍秒(比环带 2s 稀——涌出是主巢专属演出) */
  P: 0.6, /* 到拍掷中的概率(忽紧忽松的「涌出感」) */
  QUOTA: 5, /* 涌出怪自持配额(壳层计存活数传入) */
  POOL: [['zombie', 2], ['skeleton', 1], ['spider', 1]], /* 巢穴主力(无苦力怕——洞口贴脸爆炸对 6 岁是惊吓不是挑战) */
};

/* 涌出节拍(advNightStepPool 同构: 状态进 · {t, spawn} 出): 夜门(白天节拍器
   归零)→累计到拍→掷概率与配额门→按池权重取种。落点不在本函数(巢口坐标
   是建场常量, 壳层 ADV_DEN_NEST_DOOR 持有), spawn 只回 {type}; rnd 可注入 */
function advEruptStep(t, dt, dayTime, eruptN, rnd) {
  const m = advSpawnPulse(Daylight.isNight(dayTime), t, dt, ADV_ERUPT.TRY_S);
  if (!m.fire) return {t: m.t, spawn: null};
  if (rnd() >= ADV_ERUPT.P || eruptN >= ADV_ERUPT.QUOTA) return {t: 0, spawn: null}; /* 概率/配额门(rnd 消费序: P 门先于取种) */
  return {t: 0, spawn: {type: advWeightedPick(ADV_ERUPT.POOL, rnd)}};
}

/* ============================================================
   巢穴副本段(迁自 adventure-core 巢穴副本段, docs/den-nest-design.md §3+§7)
   — 探险模式第三维度 den, 2026-10-30 苦力怕主题改造(用户四轮拍板)
   ------------------------------------------------------------
   「苦力怕巢穴」副本 = 地下巨洞世界: 主世界黑巢洞口紫门站桩切入,
   大厅北墙回程裂隙门走出。主题改造(§7): 苦力怕为主力(低级层 ≥60%),
   弯曲隧道连七房(两巢房/两矿腔/宝箱室/关底王座/深处祭坛房), 关底
   苦力怕王(掉 10 火药+钻石剑), 刷怪祭坛迁深处祭坛房、清怪 10s 后
   波次补员且逐波变强。此处只收纯政策与地形核(下界段 D15 同口径):
   建场直用全局 setBlockRaw/advTryOre/SceneKit(确定性零 Math.random,
   两次建场逐字节一致是单测红线), 波次节拍/布防清单为纯数据与纯函数;
   切界装配(换桶/天空/冷却/话术/入口站桩)在壳 modes/adventure.js。
   ============================================================ */
const ADV_DEN = {
  ground: 6, /* 厅地面顶面 y(脚踩 7) */
  roof: 38, /* 穹顶壳底层 y(壳厚 4: y38~41)——D10 扩高锚点, 未来升 WORLD_H 只改此值 */
  hall: {cx: 80, cz: 80, r: 14}, /* 巨洞大厅(圆厅, 进场集散地; 观感体量由黑暗+雾+发光岩承担) */
  gate: {px: 76, pz: 69}, /* 回程裂隙门框位(厅内北缘, 常亮; 基座建场直写不记账——互锁红线) */
  chest: {x: 116, y: 8, z: 80}, /* 宝箱室小宝箱(D19: B_LOOT_CHEST_SMALL 可敲补给件; 任务键 chest_den 同源坐标, 计数在打碎侧) */
  base: {x: 80.5, z: 92.5}, /* 进场落点(大厅南侧开阔区, 面朝北) */
  /* —— 苦力怕主题改造(§7): 祭坛迁离大厅 → 深处祭坛房; 关底王座 —— */
  altar: {x: 63, z: 28}, /* 刷怪祭坛中心(深处祭坛房中央; 波次出生环心, 家锚=此处) */
  boss: {x: 82, z: 37}, /* 苦力怕王王座(关底大房间北端黑曜石台上, 壳层布防表消费) */
  rooms: {/* 房间内腔(含界): 掏空 ground+1..ground+h; 坐标是布防/测试的共同权威 */
    nestA: {x1: 42, z1: 84, x2: 50, z2: 92, h: 5}, /* 西南·苦力怕巢 A */
    nestB: {x1: 42, z1: 66, x2: 50, z2: 74, h: 5}, /* 西北·苦力怕巢 B */
    mineA: {x1: 100, z1: 70, x2: 108, z2: 76, h: 5}, /* 东北·矿腔(煤铁) */
    mineB: {x1: 100, z1: 84, x2: 108, z2: 90, h: 5}, /* 东南·矿腔(金钻) */
    chestR: {x1: 112, z1: 77, x2: 118, z2: 83, h: 4}, /* 东·宝箱室 */
    bossR: {x1: 72, z1: 34, x2: 92, z2: 50, h: 8}, /* 北·关底王座大房间(高顶, 火把照明) */
    altarR: {x1: 56, z1: 22, x2: 70, z2: 34, h: 5}, /* 西北深处·刷怪祭坛房 */
  },
  WAVE_S: 10, /* 清怪后到下一波的秒数(用户拍板「打完 10 秒刷新」) */
  WAVES: 5, /* 波次封顶(用户拍板「最多 5 轮」): 第 WAVES 波全清刷战利品宝箱,
      之后节拍熄火本会话不再出波——数值封顶(D8)之外轮数也封顶(总量收口) */
  RING_LO: 1.2, RING_HI: 4.6, /* 波次出生环带(祭坛周围, 不贴脸不撞墙) */
  WAVE_HP_STEP: 0.25, WAVE_HP_MAX: 2.75, /* 逐波血量成长与封顶(越来越厉害, 儿童可控上限) */
  WAVE_SPD_STEP: 0.04, WAVE_SPD_MAX: 1.2, /* 逐波速度成长与封顶 */
  WAVE_DMG_STEP: 0.10, WAVE_DMG_MAX: 1.6, /* 逐波伤害成长(玩家侧重伤在 ADV_DMG_CAP 封顶) */
  loot: {x: 62, y: 7, z: 22}, /* 战利品宝箱左格(深处祭坛房北墙贴墙, 跨 x 62~63 两格;
      5 轮全清后壳层刷出——通关演出件与波次同命不落盘, 见 §7.5/D17) */
};
/* 房心快捷取用(布防家锚/测试) */
function advDenRoomCenter(key) {
  const r = ADV_DEN.rooms[key];
  return {x: Math.floor((r.x1 + r.x2) / 2), z: Math.floor((r.z1 + r.z2) / 2)};
}

/* 弯曲隧道折线(用户拍板: 不走全直线, 弯弯曲曲增加恐怖气氛): 每相邻两点
   carve 一段 L 形(x 段沿前点 z, z 段沿后点 x), 宽 3 净空 4; 起点在厅内/
   终点在房内(穿墙即门洞)。全表确定性——隧道形状是建场常量不是掷点 */
const ADV_DEN_TUNNELS = [
  [[68, 86], [62, 86], [62, 90], [55, 90], [55, 88], [46, 88]], /* 大厅→巢 A(S 弯南下西折) */
  [[68, 74], [62, 74], [62, 70], [55, 70], [55, 72], [46, 72]], /* 大厅→巢 B(镜像弯北上西折) */
  [[93, 77], [99, 77], [99, 72], [104, 72]], /* 大厅→矿腔 A(北折东进) */
  [[102, 72], [97, 72], [97, 83], [103, 83], [103, 86]], /* 矿腔 A→B(绕西侧双弯) */
  [[104, 87], [110, 87], [110, 80], [114, 80]], /* 矿腔 B→宝箱室(北折东进) */
  [[84, 68], [84, 61], [78, 61], [78, 55], [84, 55], [84, 47]], /* 大厅→关底(主线三连弯) */
  [[73, 40], [67, 40], [67, 31], [61, 31], [61, 27], [57, 27]], /* 关底→祭坛房(最深一程) */
];

/* 固定布防表(进场一次; 祭坛房波次另算): 按谱系与层级有高有低——低级层
   苦力怕为绝对主力(≥60%), 虫虫族/僵尸一家为中层, 凋灵骷髅为关底精英,
   苦力怕王是 boss, 突变巨型苦力怕是西翼两巢房的窝主小 boss(2026-10-30 第六批)。
   hx/hz=家锚(AI leash 原点=房心, 怪守在本房; 大厅例外=
   厅北集结点——进场落点安全缓冲, 布防位/家锚距落点 > 索敌半径 12 有测试钉死);
   y 缺省地面 ground+1, 王座台上的王 y=ground+2 */
const ADV_DEN_GUARDS = [
  /* 大厅·进门巡守(低级层+僵尸): 布防位与家锚全在厅北半——进场落点(南缘
     80.5,92.5)到索敌圈(ADV_NEST_AGGRO_R=12, 语义在 adventure-core)之间留
     安全缓冲, 传送落地默认不挨打(2026-10-30 用户反馈「刚传送门口2个苦力怕」:
     旧表 (79,89) 距落点 3.8/(86,84) 距 10.1 开局即索敌, 且家锚=厅心收敛位
     距落点 10.5 也入圈; 家锚北移厅北集结点后战斗从大厅中段路标以北开始) */
  {type: 'creeper', x: 74, z: 76, hx: 80, hz: 72},
  {type: 'creeper', x: 86, z: 78, hx: 80, hz: 72},
  {type: 'creeper', x: 78, z: 71, hx: 80, hz: 72},
  {type: 'creeper', x: 88, z: 73, hx: 80, hz: 72},
  {type: 'zombie', x: 71, z: 83, hx: 80, hz: 72},
  /* 西翼·苦力怕巢 A/B(低级层大本营; 巢房小 boss=突变巨型苦力怕, 2026-10-30
     第六批拍板: 一窝一只窝主, 掉落阶梯高于常款低于苦力怕王) */
  {type: 'creeper', x: 44, z: 87, hx: 46, hz: 88}, {type: 'creeper', x: 48, z: 90, hx: 46, hz: 88},
  {type: 'creeper', x: 46, z: 85, hx: 46, hz: 88}, {type: 'creeper', x: 49, z: 87, hx: 46, hz: 88},
  {type: 'creeper', x: 43, z: 91, hx: 46, hz: 88}, {type: 'creeper', x: 47, z: 92, hx: 46, hz: 88},
  {type: 'mutant_creeper', x: 46, z: 90, hx: 46, hz: 88}, /* 巢 A 窝主(小 boss) */
  {type: 'silverfish', x: 45, z: 89, hx: 46, hz: 88},
  {type: 'creeper', x: 44, z: 69, hx: 46, hz: 70}, {type: 'creeper', x: 48, z: 72, hx: 46, hz: 70},
  {type: 'creeper', x: 46, z: 67, hx: 46, hz: 70}, {type: 'creeper', x: 49, z: 69, hx: 46, hz: 70},
  {type: 'creeper', x: 43, z: 73, hx: 46, hz: 70}, {type: 'creeper', x: 47, z: 74, hx: 46, hz: 70},
  {type: 'mutant_creeper', x: 46, z: 71, hx: 46, hz: 70}, /* 巢 B 窝主(小 boss) */
  {type: 'cave_spider', x: 45, z: 71, hx: 46, hz: 70},
  /* 东翼·矿腔(地底生态多样性: 虫虫族+僵尸一家, 用户拍板允带其他地底生物) */
  {type: 'cave_spider', x: 103, z: 72, hx: 104, hz: 73}, {type: 'cave_spider', x: 106, z: 75, hx: 104, hz: 73},
  {type: 'zombie', x: 104, z: 74, hx: 104, hz: 73},
  {type: 'spider', x: 103, z: 86, hx: 104, hz: 87}, {type: 'spider', x: 106, z: 89, hx: 104, hz: 87},
  {type: 'endermite', x: 104, z: 88, hx: 104, hz: 87},
  /* 北·关底王座(高层: 凋灵骷髅护卫 + 苦力怕王 boss) */
  {type: 'wither_skeleton', x: 79, z: 38, hx: 82, hz: 42},
  {type: 'wither_skeleton', x: 85, z: 38, hx: 82, hz: 42},
  {type: 'creeper_king', x: 82, z: 37, y: ADV_DEN.ground + 2, hx: 82, hz: 42},
];

/* 波次节拍(advSpawnPulse 组装) + 5 轮封顶: 门=「全清」——怪还活着计时归零,
   全清后累计到 WAVE_S 出波令并归零; wave 达 WAVES 后不再出波——第 WAVES 波
   全清即发 chest 信号(宝箱祭坛房刷出, chestDone=false 才发=恰一次), 之后熄火
   (t 恒 0, 奖励即现不等 10s)。逐拍独立(出令后布防/刷箱在壳层, 整拍作废不结转) */
function advDenStep(cleared, t, dt, wave, chestDone) {
  const w = Math.max(1, Math.floor(wave || 1));
  if (w >= ADV_DEN.WAVES) {
    if (cleared && !chestDone) return {spawn: false, chest: true, t: 0}; /* 第 5 波全清: 刷宝箱 */
    return {spawn: false, chest: false, t: 0}; /* 封顶熄火(宝箱已发或怪未清) */
  }
  const m = advSpawnPulse(cleared, t, dt, ADV_DEN.WAVE_S);
  return {spawn: m.fire, chest: false, t: m.t};
}

/* 波次计划(纯函数): 第 wave 波从祭坛环带涌出的怪与三乘数。低级层苦力怕
   为主力(每波 ≥70%); 高波渐入精英(3 波换尸壳、4 波起凋灵骷髅护卫、
   6 波双护卫), 血量/速度/伤害逐波成长到封顶——「越来越厉害」的儿童
   可控版(伤害另有 ADV_DMG_CAP 双保险)。rnd 可注入(测试确定性) */
function advDenWavePlan(wave, rnd) {
  const n = Math.max(1, Math.floor(wave || 1));
  const r = rnd || Math.random;
  const spawns = [];
  const push = (type) => {
    const p = advRingSpot(ADV_DEN.altar.x + 0.5, ADV_DEN.altar.z + 0.5,
        ADV_DEN.RING_LO, ADV_DEN.RING_HI, r);
    spawns.push({type, x: Math.floor(p.x), z: Math.floor(p.z),
      hx: ADV_DEN.altar.x, hz: ADV_DEN.altar.z}); /* 家锚=祭坛(涌出怪围绕祭坛游荡) */
  };
  const nCreep = 5 + Math.min(3, Math.floor((n - 1) / 2)); /* 苦力怕 5→8 封顶 */
  for (let i = 0; i < nCreep; i++) push('creeper');
  push(n >= 3 ? 'husk' : 'zombie'); /* 3 波起僵尸晋级尸壳(谱系内升层) */
  if (n >= 4) push('wither_skeleton'); /* 4 波起精英护卫 */
  if (n >= 6) push('wither_skeleton'); /* 6 波起双护卫(封顶编成) */
  return {spawns,
    hpMult: Math.min(1 + ADV_DEN.WAVE_HP_STEP * (n - 1), ADV_DEN.WAVE_HP_MAX),
    spdMult: Math.min(1 + ADV_DEN.WAVE_SPD_STEP * (n - 1), ADV_DEN.WAVE_SPD_MAX),
    dmgMult: Math.min(1 + ADV_DEN.WAVE_DMG_STEP * (n - 1), ADV_DEN.WAVE_DMG_MAX)};
}

/* 战利品宝箱掉落表(§7.5/D17): 用户拍板 2026-10-30——初版占位表转正为终版
   (火药/铁锭/金锭/苹果 + 必得钻石)。条目形状与 MOB_DROPS 同契约: rolls=[itemId, 保底, 加成掷数](逐次 50% 加成) +
   rare=[itemId, 概率](独立掷)。表只存数据, 掷骰语义在 advDenLootRoll */
const ADV_DEN_LOOT = {
  rolls: [
    ['gunpowder', 3, 1], /* 苦力怕巢穴主题回礼: 火药保底 3 + 50% 一发 */
    ['iron_ingot', 2, 1], ['gold_ingot', 1, 1], /* 矿藏廊的「越危险越富」呼应 */
    ['apple', 2, 0], /* 回血干粮(打完最强一波总得口吃的) */
  ],
  rare: [['diamond', 1]], /* 钻石恒得(5 轮苦战的压轴惊喜) */
};

/* 低档奖励箱掉落表(§7.5/D18+D19): 用户拍板 2026-10-30 二轮——副本宝箱室补给
   定版「铁剑 1+苹果 10」(初版火药 2/铁锭 1/苹果 1 是试玩占位, 随箱进副本转正)。
   全保底零掷骰(敲开即得的确定回报), 形状与 ADV_DEN_LOOT 同契约(表只存数据,
   掷骰语义共用 advDenLootRoll 的 table 注入) */
const ADV_DEN_LOOT_SMALL = {
  rolls: [
    ['sword_iron', 1, 0], ['apple', 10, 0], /* 补给: 一把铁剑+十个苹果(D19 拍板) */
  ],
  rare: [],
};

/* 宝箱掉落掷骰(rollDrops 同语义: 保底必得 + 逐次 50% 加成 + rare 独立掷):
   rnd 可注入(测试确定性, 缺省 Math.random), table 可注入(缺省大箱表
   ADV_DEN_LOOT——旧调用零改动, D18 低档表注入), 返回 [{id, n}] 供破坏计划
   逐条落地——消费方(place-kit lootChestApply/TNT 链)不再各自掷骰 */
function advDenLootRoll(rnd, table) {
  const r = rnd || Math.random;
  const t = table || ADV_DEN_LOOT;
  const out = [];
  for (const e of t.rolls) {
    let n = e[1];
    for (let i = 0; i < e[2]; i++) if (r() < 0.5) n++;
    if (n > 0) out.push({id: e[0], n});
  }
  for (const e of t.rare) {
    if (r() < e[1]) out.push({id: e[0], n: 1});
  }
  return out;
}

/* 战利品宝箱配对破坏计划(床配对同款缝, D16): 触发格已清格后调用, 四邻找
   另一半(同 id 相邻即配对——系统刷出固定贴墙, 无取向歧义也无相邻双箱),
   drops=宝箱掉落表掷骰一次(恰一次, 双格不双掉)。返回 null=此处无宝箱
   (触发格无相邻宝箱——防 TNT 同拍双掷/孤儿格双掉) */
function advLootChestPlan(read, x, y, z, rnd) {
  const cells = [];
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (read(x + d[0], y, z + d[1]) === B_LOOT_CHEST) {
      cells.push({x: x + d[0], y, z: z + d[1]});
    }
  }
  if (!cells.length) return null;
  return {cells, drops: advDenLootRoll(rnd)};
}

/* 低档奖励箱破坏计划(§7.5/D18): 单格整箱**无配对**——破坏的格子本身就是
   整箱, 身份判据读破坏块的 id(调用方把 id 传进来: 大箱四邻认亲读的是世界,
   小箱读的是「刚敲的是什么」, 两判据互补不互斥)。cells 恒空(无第二格要清,
   触发格已由破坏链清格记账)。返回 null=破坏的不是小箱(调用方回退到大箱
   配对计划) */
function advLootChestSmallPlan(id, rnd) {
  if (id !== B_LOOT_CHEST_SMALL) return null;
  return {cells: [], drops: advDenLootRoll(rnd, ADV_DEN_LOOT_SMALL)};
}

/* 每日副本刷新判据(§7.5/D20): 真实日历日键(与每日预算/图章同钟——键由壳层
   DailyBudget.budgetDateStr 算好注入, core 零 Date 依赖)。prev=世界档 den
   每日态|null(老档/坏档); 同日=续局(fresh:false, 状态原样带出——怪尸/破坏/
   波次都保持); 异日/首日=全新(fresh:true, 状态归零: 波次回 1/通关旗清/守卫
   尸账清——地形复原由壳层清桶落地, 判据只管状态) */
function advDenDailyStep(prev, today) {
  if (prev && prev.day === today && Array.isArray(prev.deadGuards)) {
    return {fresh: false, state: prev};
  }
  return {fresh: true, state: {day: today, wave: 1, chestDone: false, deadGuards: []}};
}

/* 副本建场: 整图岩体(y0~roof+1 实心——巨洞从岩体里掏出来, 矿腔镶矿/岩壁
   体感/天空光全遮都依赖实心; 雾把远处吃掉, 观感与性能的平衡点), 掏出
   大厅/七房/弯曲隧道, 地面混铺苔石/泥, 关底王座+壁雕+火把, 深处祭坛,
   回程门+发光岩簇。确定性重放红线: 零 Math.random; 矿藏走 advTryOre
   白名单(矿位跨天回填在副本同样生效); 镶矿在隧道之后(门洞格已空不镶) */
function advDenBuild() {
  const D = ADV_DEN;
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 0; y <= D.roof + 1; y++) setBlockRaw(x, y, z, 3); /* 岩体(壳顶 2 层遮天空光) */
    }
  }
  const h = D.hall;
  for (let x = h.cx - h.r; x <= h.cx + h.r; x++) {
    for (let z = h.cz - h.r; z <= h.cz + h.r; z++) {
      const d = Math.hypot(x - h.cx, z - h.cz);
      if (d > h.r) continue;
      for (let y = D.ground + 1; y <= D.roof - Math.floor(d / 3); y++) {
        setBlockRaw(x, y, z, 0);
      } /* 大厅掏空: 穹顶随半径渐降(中央 38 → 厅缘 34, 深盆巨洞轮廓) */
      const r = SceneKit.rand(x, z, 8101);
      setBlockRaw(x, D.ground, z, r > 0.82 ? 14 : (r < 0.08 ? 2 : 3)); /* 苔石/泥地混铺 */
      if (r > 0.965) setBlockRaw(x, D.ground + 1, z, B_GLOWSTONE); /* 地面微光簇(~3% 列) */
    }
  }
  /* 大厅中央路标(祭坛已迁走): 2×2 苔石墩+顶灯——十字路口的集散灯塔 */
  SceneKit.fill(h.cx - 1, D.ground + 1, h.cz - 1, h.cx, D.ground + 1, h.cz, 14);
  setBlockRaw(h.cx, D.ground + 2, h.cz, B_GLOWSTONE);
  /* 七房掏空+地面混铺(盐值分层防与大厅同噪; 苔石/泥地/微光簇同款配比) */
  const ROOM_SALT = {nestA: 8401, nestB: 8403, mineA: 8405, mineB: 8407,
    chestR: 8409, bossR: 8411, altarR: 8413};
  for (const key of Object.keys(D.rooms)) {
    const rm = D.rooms[key];
    for (let x = rm.x1; x <= rm.x2; x++) {
      for (let z = rm.z1; z <= rm.z2; z++) {
        for (let y = D.ground + 1; y <= D.ground + rm.h; y++) setBlockRaw(x, y, z, 0);
        const r = SceneKit.rand(x, z, ROOM_SALT[key]);
        setBlockRaw(x, D.ground, z, r > 0.82 ? 14 : (r < 0.08 ? 2 : 3));
        if (r > 0.955) setBlockRaw(x, D.ground + 1, z, B_GLOWSTONE);
      }
    }
  }
  /* 巢房「窝」观感: 房心 3×3 苔石垫(苦力怕的床) */
  for (const nk of ['nestA', 'nestB']) {
    const c = advDenRoomCenter(nk);
    SceneKit.fill(c.x - 1, D.ground, c.z - 1, c.x + 1, D.ground, c.z + 1, 14);
  }
  /* 弯曲隧道(先掏后镶矿的顺序红线: 隧道在镶矿之前) */
  for (const pts of ADV_DEN_TUNNELS) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]; const b = pts[i];
      SceneKit.fill(Math.min(a[0], b[0]) - 1, D.ground + 1, a[1] - 1,
          Math.max(a[0], b[0]) + 1, D.ground + 4, a[1] + 1, 0); /* x 段(宽 3) */
      SceneKit.fill(b[0] - 1, D.ground + 1, Math.min(a[1], b[1]) - 1,
          b[0] + 1, D.ground + 4, Math.max(a[1], b[1]) + 1, 0); /* z 段(宽 3) */
    }
  }
  advDenMineRoom(104, 73, [B_COAL_ORE, B_IRON_ORE], 8201); /* 矿腔 A: 煤铁(东北) */
  advDenMineRoom(104, 87, [B_GOLD_ORE, B_DIAMOND_ORE], 8301); /* 矿腔 B: 金钻(东南) */
  /* 宝箱室: 小宝箱(D19——原木箱 B_CHEST 换低档奖励箱: 储物箱退场, 敲 2 秒
     碎箱掉补给 sword_iron×1+apple×10, 建场预置随世界档持久——打碎经 edits
     记账, 重进不复活=一次补给; 任务键 chest_den 计数随迁「打开→打碎」, 壳层
     onLootChestBreak 消费)+两角落地站膛火把(thin 悬空会被清扫治愈, 神殿先例) */
  setBlockRaw(D.chest.x, D.chest.y, D.chest.z, B_LOOT_CHEST_SMALL);
  setBlockRaw(D.rooms.chestR.x1 + 1, D.ground + 1, D.rooms.chestR.z1 + 1, B_TORCH);
  setBlockRaw(D.rooms.chestR.x2 - 1, D.ground + 1, D.rooms.chestR.z2 - 1, B_TORCH);
  /* 关底王座大房间(用户拍板: 最后关底大房=苦力怕王, 有布置有火把照亮):
     北端黑曜石王座台(3×3+角灯) + 四角黑曜石柱(顶发光岩) + 北墙苦力怕脸
     壁雕(黑曜石底/发光岩眼口) + 六支落地火把——王座房是副本唯一亮堂的房 */
  const BR = D.rooms.bossR;
  SceneKit.fill(D.boss.x - 1, D.ground + 1, D.boss.z - 1, D.boss.x + 1, D.ground + 1,
      D.boss.z + 1, B_OBSIDIAN); /* 王座台(王脚踩 ground+2, 布防表 y 同源) */
  for (const cn of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    setBlockRaw(D.boss.x + cn[0], D.ground + 2, D.boss.z + cn[1], B_GLOWSTONE); /* 台角灯 */
  }
  for (const pc of [[BR.x1 + 1, BR.z1 + 1], [BR.x2 - 1, BR.z1 + 1],
    [BR.x1 + 1, BR.z2 - 1], [BR.x2 - 1, BR.z2 - 1]]) {
    for (let y = D.ground + 2; y <= D.ground + 6; y++) setBlockRaw(pc[0], y, pc[1], B_OBSIDIAN);
    setBlockRaw(pc[0], D.ground + 7, pc[1], B_GLOWSTONE); /* 房角柱+顶灯 */
  }
  const FACE = ['.GG.GG.', '.GG.GG.', '..GGG..', '.GGGGG.', '.GG.GG.', '.GG.GG.'];
  for (let fy = 0; fy < FACE.length; fy++) {
    for (let fx = 0; fx < 7; fx++) {
      setBlockRaw(D.boss.x - 3 + fx, D.ground + 8 - fy, BR.z1, B_OBSIDIAN); /* 壁雕底板 */
      if (FACE[fy][fx] === 'G') {
        setBlockRaw(D.boss.x - 3 + fx, D.ground + 8 - fy, BR.z1, B_GLOWSTONE); /* 眼与嘴 */
      }
    }
  }
  for (const tc of [[74, 36], [90, 36], [74, 48], [90, 48], [77, 44], [87, 44]]) {
    setBlockRaw(tc[0], D.ground + 1, tc[1], B_TORCH); /* 落地站膛火把×6 */
  }
  /* 深处刷怪祭坛房(从大厅迁来, 用户拍板: 副本深处的另外一个房间): 3×3 苔石
     台+中央巢之心(微红光)+四角黑曜石柱(顶发光岩)——波次从这里涌出; 刻意
     不放火把(祭坛房保持黑暗, MC 刷怪笼地牢口径) */
  SceneKit.fill(D.altar.x - 1, D.ground + 1, D.altar.z - 1, D.altar.x + 1, D.ground + 1,
      D.altar.z + 1, 14);
  setBlockRaw(D.altar.x, D.ground + 1, D.altar.z, B_SPAWNER);
  for (const cn of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let y = D.ground + 2; y <= D.ground + 4; y++) {
      setBlockRaw(D.altar.x + cn[0], y, D.altar.z + cn[1], B_OBSIDIAN);
    }
    setBlockRaw(D.altar.x + cn[0], D.ground + 5, D.altar.z + cn[1], B_GLOWSTONE);
  }
  advPortalFrame(setBlockRaw, D.ground, D.gate.px, D.gate.pz); /* 回程裂隙门(常亮, 厅内北缘) */
}

/* 矿腔镶矿(建场件): 房间已掏空, 四壁高密度镶矿(两种矿交替, advTryOre 只镶
   进石头+白名单记账——矿位回填在副本同样生效); 先掏后镶(顺序红线):
   隧道/门洞格已空自然不镶——白名单账实一致(回填不在门洞里长矿挡路) */
function advDenMineRoom(cx, cz, ores, salt) {
  const D = ADV_DEN;
  for (let x = cx - 4; x <= cx + 4; x++) {
    for (const z of [cz - 4, cz + 4]) {
      for (let y = D.ground + 1; y <= D.ground + 4; y++) {
        if (SceneKit.rand(x, y * 61 + z, salt) > 0.45) advTryOre(x, y, z, ores[(x + z) % 2]);
      }
    }
  }
  for (let z = cz - 3; z <= cz + 3; z++) {
    for (const x of [cx - 5, cx + 5]) {
      for (let y = D.ground + 1; y <= D.ground + 4; y++) {
        if (SceneKit.rand(x, y * 61 + z, salt + 1) > 0.45) advTryOre(x, y, z, ores[(x + z) % 2]);
      }
    }
  }
}

/* ============================================================
   维度注册表 ADV_DIMS — 本文件的成立理由(docs/dimension-registry-design.md)
   ------------------------------------------------------------
   一行 = 一个维度的全部切界政策, 壳层读表驱动(advSetDim/advPlayerDied/
   HUD/advSyncMood/ADV_SCENE_KEYS 派生)。新维度 = 加一行(+建场函数),
   不再抄壳层 if 分支。三条全局判据刻意不设行字段(不变量不是每维政策,
   dimension-registry §2): pos 存档与死亡语义都是「维度不进档」单点判据;
   update 门禁/入口门认领等真差异留壳层显式分支(§5「不进表」清单)。
   build 是建场序列闭包(ADV_MAPS 行带 build 的同款先例, 非生命周期钩子):
   nether 的回程门框、den 的矿位白名单先清后建, 差异收进闭包不设旗标。
   ============================================================ */
const ADV_DIMS = [
  {id: 'nether', /* 下界相位(docs/nether-merge-design.md) */
    build: () => {/* 下界基座+回程门(建场直写不记账——互锁红线) */
      advNetherBuild();
      advPortalFrame(setBlockRaw, ADV_NETHER.ground, ADV_NETHER.portal.px, ADV_NETHER.portal.pz);
    },
    sky: {color: 0x2a0a08, fogNear: 26, fogFar: 120, sunI: 0.3}, /* 暗红天穹(迁自壳层 ADV_SKY_NETHER) */
    mood: 'nether', /* seeing-pool 曲目键(AudioRegistry BGM 表) */
    dayCycle: false, /* dayTime 暂停+恒夜(日月天体随之隐藏, D10) */
    spawn: {x: ADV_NETHER.base.x, y: ADV_NETHER.ground + 1, z: ADV_NETHER.base.z, yaw: Math.PI},
    /* 落点在回程门前数格, 面朝下界背对门(走出即离开门); 坐标唯一权威在 ADV_NETHER, 此处加载期派生 */
    hud: {banner: '🌌 下界 · 黑漆漆亮晶晶', showMobs: false}, /* 恒夜无怪: 隐时段行与怪物行(§3.3/D10) */
    assets: null}, /* 副本素材预留缝(null=走缺省方块集, GLOSSARY『副本素材』) */
  {id: 'den', /* 巢穴副本相位(docs/den-nest-design.md) */
    build: () => {/* 副本基座: 矿位白名单先清后建(副本矿藏走同一白名单, 回填在
        副本同样生效) + 地下巨洞(建场直写不记账——互锁红线) */
      advOreSpotsReset();
      advDenBuild();
    },
    sky: {color: 0x07040a, fogNear: 18, fogFar: 80, sunI: 0.12}, /* 近黑天穹+近雾(迁自壳层 ADV_SKY_DEN, den-nest §3.2) */
    mood: 'nether', /* 洞穴水声 ambient——副本的洞穴语义同源(den-nest D13) */
    dayCycle: false, /* 副本恒暗, dayTime 暂停(下界 D10 同口径) */
    spawn: {x: ADV_DEN.base.x, y: ADV_DEN.ground + 1, z: ADV_DEN.base.z, yaw: Math.PI},
    /* 大厅南侧开阔区, 面朝北; 坐标唯一权威在 ADV_DEN, 加载期派生 */
    hud: {banner: '🕳️ 苦力怕巢穴 · 深处', showMobs: true}, /* 恒暗不显时段行; 怪物行照显(副本有怪——波次观感) */
    assets: null}, /* 副本素材预留缝(null=走缺省方块集, GLOSSARY『副本素材』) */
];

/* 维度行查询(壳层与桥接政策的取行唯一入口): 'nether'|'den' → 行 | undefined */
function advDimRow(id) {
  return ADV_DIMS.find((r) => r.id === id);
}

/* 场景 BGM 情绪映射(迁自 adventure-core, 2026-10-27 换曲): 维度行恒行值
   mood(下界/副本同曲 nether); 上界按昼夜切 night/adventure。纯函数
   (维度 + isNight 入) — 壳层 advSyncMood 只在值变化时报给 AudioMixer,
   同值续播不打断 */
function advMusicMood(dim, isNight) {
  const row = advDimRow(dim);
  if (row) return row.mood;
  return isNight ? 'night' : 'adventure';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {ADV_DIMS, advDimRow, advMusicMood,
    ADV_NETHER, advNetherBuild,
    ADV_ERUPT, advEruptStep,
    ADV_DEN, ADV_DEN_TUNNELS, ADV_DEN_GUARDS, advDenRoomCenter,
    advDenBuild, advDenMineRoom, advDenStep, advDenWavePlan,
    ADV_DEN_LOOT, ADV_DEN_LOOT_SMALL, advDenLootRoll, advLootChestPlan,
    advLootChestSmallPlan, advDenDailyStep};
}
