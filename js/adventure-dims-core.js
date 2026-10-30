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
     ADV_ERUPT/advEruptStep · ADV_DEN/advDenBuild/advDenMineRoom/
     advDenCanSpawn/advDenStep/advDenSpot/advDenPick
   依赖(均经全局名, 调用期解析): adventure-core.js 的 advPortalFrame/
     advOreSpotsReset/advTryOre(建场调用期消费; index.html 加载序:
     adventure-core → adventure-maps-core → 本文件 → modes/adventure →
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
  if (!Daylight.isNight(dayTime)) return {t: 0, spawn: null};
  const nt = t + dt;
  if (nt < ADV_ERUPT.TRY_S) return {t: nt, spawn: null};
  if (rnd() >= ADV_ERUPT.P || eruptN >= ADV_ERUPT.QUOTA) return {t: 0, spawn: null};
  let total = 0;
  for (const p of ADV_ERUPT.POOL) total += p[1];
  let pick = rnd() * total;
  let type = ADV_ERUPT.POOL[ADV_ERUPT.POOL.length - 1][0]; /* 浮点尽头兜底末段 */
  for (const p of ADV_ERUPT.POOL) {
    pick -= p[1];
    if (pick < 0) {
      type = p[0];
      break;
    }
  }
  return {t: 0, spawn: {type}};
}

/* ============================================================
   巢穴副本段(迁自 adventure-core 巢穴副本段, docs/den-nest-design.md §3)
   — 探险模式第三维度 den, 2026-10-30 维度 vocabulary 归家迁入, 行为零改动
   ------------------------------------------------------------
   「怪物巢穴」副本 = 地下巨洞世界: 主世界黑巢巢厅的巢之心(B_SPAWNER)
   站桩切入, 大厅北墙回程裂隙门走出。此处只收纯政策与地形核(下界段
   D15 同口径): 建场直用全局 setBlockRaw/advTryOre/SceneKit(确定性零
   Math.random, 两次建场逐字节一致是单测红线), 刷怪节拍/光照门/出生
   环带为纯函数; 切界装配(换桶/天空/冷却/话术/入口站桩)在壳 modes/
   adventure.js。副本怪池主打 cave_spider——已建模入册的唯一产地(D7)。
   ============================================================ */
const ADV_DEN = {
  ground: 6, /* 厅地面顶面 y(脚踩 7) */
  roof: 38, /* 穹顶壳底层 y(壳厚 4: y38~41)——D10 扩高锚点, 未来升 WORLD_H 只改此值 */
  hall: {cx: 80, cz: 80, r: 14}, /* 巨洞大厅(圆厅, 观感体量由黑暗+雾+发光岩承担) */
  altar: {x: 80, z: 80}, /* 刷怪祭坛中心(副本怪家锚与出生环心, 壳层挂 __nightHome) */
  gate: {px: 76, pz: 69}, /* 回程裂隙门框位(厅内北缘, 常亮; 基座建场直写不记账——互锁红线) */
  chest: {x: 116, y: 8, z: 80}, /* 宝箱室宝箱(任务键 chest_den, advMapChestKey 同源坐标) */
  base: {x: 80.5, z: 92.5}, /* 进场落点(大厅南侧开阔区, 面朝北一眼看到祭坛) */
  CAP: 6, /* 副本怪自持配额(独立于主世界 ADV_NIGHT.CAP——两界怪数不叠加, 儿童可控) */
  TRY_S: 2.5, /* 刷怪节拍秒 */
  RING_LO: 1.8, RING_HI: 4.2, /* 祭坛出生环带(巢之心附近不贴脸, 巢穴环带同款口径) */
  POOL: [['zombie', 2], ['spider', 1], ['cave_spider', 1], ['skeleton', 1]], /* 副本主力 */
};

/* 副本建场: 整图岩体(y0~roof+1 实心——巨洞从岩体里掏出来, 矿腔镶矿/岩壁
   体感/天空光全遮都依赖实心; 雾把远处吃掉, 观感与性能的平衡点), 掏出大厅/
   走廊/矿腔/宝箱室, 地面混铺苔石/泥, 祭坛+回程门+发光岩簇。确定性重放红线:
   零 Math.random; 矿藏走 advTryOre 白名单(矿位跨天回填在副本同样生效) */
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
  /* 刷怪祭坛: 3×3 苔石台 + 中央巢之心 + 四角黑曜石柱(柱顶发光岩)——副本的视觉锚 */
  SceneKit.fill(D.altar.x - 1, D.ground + 1, D.altar.z - 1, D.altar.x + 1, D.ground + 1, D.altar.z + 1, 14);
  setBlockRaw(D.altar.x, D.ground + 1, D.altar.z, B_SPAWNER);
  for (const cn of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let y = D.ground + 2; y <= D.ground + 5; y++) setBlockRaw(D.altar.x + cn[0], y, D.altar.z + cn[1], B_OBSIDIAN);
    setBlockRaw(D.altar.x + cn[0], D.ground + 6, D.altar.z + cn[1], B_GLOWSTONE);
  }
  advPortalFrame(setBlockRaw, D.ground, D.gate.px, D.gate.pz); /* 回程裂隙门(常亮, 厅内北缘) */
  /* 矿藏廊: 东墙洞口 → 东向走廊(净空 4) → 两间矿腔(煤铁腔/金钻腔, 壁镶矿
     高密度——「越危险越富」的实体) + 尽头宝箱室(B_CHEST 接全局账户)。
     门洞先掏再镶矿(顺序红线): 镶矿走 advTryOre「只镶进石头」, 门洞格已空
     自然不镶——白名单账实一致(矿位回填不会在门洞里长出矿挡路) */
  SceneKit.fill(h.cx + h.r - 2, D.ground + 1, D.altar.z - 1, 112, D.ground + 4, D.altar.z + 1, 0); /* 洞口+走廊 */
  SceneKit.fill(101, D.ground + 1, 77, 102, D.ground + 3, 78, 0); /* 腔 A 门洞(穿墙接走廊) */
  SceneKit.fill(101, D.ground + 1, 82, 102, D.ground + 3, 83, 0); /* 腔 B 门洞 */
  advDenMineRoom(102, 74, [B_COAL_ORE, B_IRON_ORE], 8201); /* 矿腔 A: 煤铁(走廊北侧) */
  advDenMineRoom(102, 86, [B_GOLD_ORE, B_DIAMOND_ORE], 8301); /* 矿腔 B: 金钻(走廊南侧) */
  SceneKit.fill(114, D.ground + 1, D.altar.z - 2, 118, D.ground + 3, D.altar.z + 2, 0); /* 宝箱室腔 */
  setBlockRaw(D.chest.x, D.chest.y, D.chest.z, B_CHEST);
  setBlockRaw(114, D.ground + 1, D.altar.z - 2, B_TORCH); /* 角落落地站膛(thin 悬空会被清扫治愈, 神殿先例) */
  setBlockRaw(118, D.ground + 1, D.altar.z + 2, B_TORCH);
}

/* 矿腔(建场件): 7×5 腔室掏空 + 四壁高密度镶矿(两种矿交替, advTryOre 只镶
   进石头+白名单记账——矿位回填在副本同样生效); salt 分层防与地面混铺同噪 */
function advDenMineRoom(cx, cz, ores, salt) {
  const D = ADV_DEN;
  SceneKit.fill(cx - 3, D.ground + 1, cz - 2, cx + 3, D.ground + 4, cz + 2, 0);
  for (let x = cx - 3; x <= cx + 3; x++) {
    for (const z of [cz - 3, cz + 3]) {
      for (let y = D.ground + 1; y <= D.ground + 4; y++) {
        if (SceneKit.rand(x, y * 61 + z, salt) > 0.45) advTryOre(x, y, z, ores[(x + z) % 2]);
      }
    }
  }
  for (let z = cz - 2; z <= cz + 2; z++) {
    for (const x of [cx - 4, cx + 4]) {
      for (let y = D.ground + 1; y <= D.ground + 4; y++) {
        if (SceneKit.rand(x, y * 61 + z, salt + 1) > 0.45) advTryOre(x, y, z, ores[(x + z) % 2]);
      }
    }
  }
}

/* 副本刷怪光照门(单表达式): 方块光 0(火把圈=防刷怪圈, 教学与主世界一致)
   且天空光 ≤7——穹顶内天空光恒 0 天然过; 无时间维度(副本恒暗, 冻结的
   dayTime 不参与——advNightCanSpawn 的 internalSky 项在这里恒不可用) */
function advDenCanSpawn(skyAt, blockAt) {
  return blockAt === 0 && skyAt <= 7;
}

/* 副本刷怪节拍(advNestStep 同构: 状态进 · {spawn, t} 出): 存量满配额 → 不刷
   且计时归零; 未满累计到拍出刷怪令(落点/取种/光照复核在壳层——光照不过本拍
   作废, 夜怪同款「逐拍独立」) */
function advDenStep(alive, t, dt) {
  if (alive >= ADV_DEN.CAP) return {spawn: false, t: 0};
  const nt = t + dt;
  if (nt >= ADV_DEN.TRY_S) return {spawn: true, t: 0};
  return {spawn: false, t: nt};
}

/* 祭坛出生环带掷点(角度/半径均匀, 巢穴出生环带同款几何; 环心=祭坛中心) */
function advDenSpot(rnd) {
  const a = rnd() * Math.PI * 2;
  const r = ADV_DEN.RING_LO + rnd() * (ADV_DEN.RING_HI - ADV_DEN.RING_LO);
  return {x: ADV_DEN.altar.x + 0.5 + Math.cos(a) * r, z: ADV_DEN.altar.z + 0.5 + Math.sin(a) * r};
}

/* 副本池权重取种(advEruptStep 同构; 浮点尽头兜底末段) */
function advDenPick(rnd) {
  let total = 0;
  for (const p of ADV_DEN.POOL) total += p[1];
  let pick = rnd() * total;
  let type = ADV_DEN.POOL[ADV_DEN.POOL.length - 1][0];
  for (const p of ADV_DEN.POOL) {
    pick -= p[1];
    if (pick < 0) {
      type = p[0];
      break;
    }
  }
  return type;
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
    /* 大厅南侧开阔区, 面朝北一眼看到祭坛; 坐标唯一权威在 ADV_DEN, 加载期派生 */
    hud: {banner: '🕳️ 怪物巢穴 · 黑暗深处', showMobs: true}, /* 恒暗不显时段行; 怪物行照显(副本有怪——配额观感) */
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
    ADV_DEN, advDenBuild, advDenMineRoom, advDenCanSpawn, advDenStep, advDenSpot, advDenPick};
}
