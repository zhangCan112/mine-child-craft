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
     ORES/TREES) · 地形生成 advBuildWorld 一族(树落位清单 advTreeSpots
     与 F4 牧场共用) · 政策纯函数
     advDeathPlan/advNestCount/advNestStep/advSwingDmg/advMobDmg/
     advDeathDrops/advPickupText/advMineStep/advPlaceCheck/advEatPolicy/
     advSapDue/advNearStation/advSmeltStep/advFurnaceRefund/advFurnaceValid/
     advFurnaceClean(F1 每炉独立+持久化的存档防错与清扫)/advTntRoll/
     advTntDmg/advWearWarn/advBagFullStep/advBreakToolText · F4 牧场
     advLivestockPlan(确定性散布清单)/advHerdStep(恐惧游荡决策) · 任务表
     ADV_QUESTS/ADV_MINE_TALLY · 大宝箱政策 ADV_CHEST_START/ADV_CHEST_SLOTS/
     ADV_CHEST_TIERS/advChestNext/advChestPut · 节律常量 ADV_*
   依赖(均经全局名, 调用期解析): config.js 的 BLOCKS/B_* 常量/世界
     尺寸 · voxel.js 的 getBlock/setBlockRaw · scene-kit.js 的
     SceneKit · items-core 的 ITEMS/toolOf/stackMax · inventory-core 的 add ·
     craft-core 的 fuelUnits/smeltOf · drops.js 的 rollDrops/
     rollBlockDrop(加载序: 上述文件在 index.html 均先于本文件)
   可测性: 零 THREE·零 DOM·有单测(test/adventure-core.test.js,
     vm 装真引擎件直测, 地形确定性对着真散布函数断言)
   ============================================================ */

/* ---------- 地图常量(128×128, 一期口径; D14 扩容后随尺寸换算) ---------- */
const ADV_GROUND = 24; /* 草原表层 y: 下 4 层泥(y20~23), 再下石头到 y0(D5 压缩分层) */
const ADV_HUT = {x1: 58, x2: 64, z1: 78, z2: 84}; /* 出生小屋: 7×7, 北墙正中门洞 */
const ADV_SPAWN = {x: 61.5, y: ADV_GROUND + 1, z: 76.5, yaw: 0}; /* 门口两步, 面朝旷野背对小屋 */
const ADV_LAKE = {cx: 22, cz: 24, r: 7}; /* 湖: 西北角, 沙岸+可趟水+湖底黏土 */
const ADV_PITS = [ /* 露天矿坑: 阶梯漏斗坑(每级 1 格 — 玩家跳跃 1.42 格, 下得去也上得来; 2026-10-23 实测 2 格级困人), 坑壁矿化做可见性教学 */
  {cx: 98, cz: 28, r: 8, floor: 12, ore: {id: B_COAL_ORE, yLo: 12, yHi: 20, salt: 4101}},
  {cx: 30, cz: 96, r: 9, floor: 10, ore: {id: B_IRON_ORE, yLo: 6, yHi: 16, salt: 4207}},
];
const ADV_CAVE = {x1: 97, x2: 98, zStart: 72, steps: 20, y0: 23, zEnd: 52}; /* 山洞: 2 宽台阶隧道 y23→y3, 穴室镶钻 */
const ADV_NESTS = [ /* 怪物巢穴位点(土丘洞穴): kinds=本巢刷怪池, 节律见巢穴战斗段(T14) */
  {x: 40, z: 52, kinds: ['zombie', 'skeleton', 'spider']},
  {x: 86, z: 96, kinds: ['creeper', 'zombie', 'spider']},
  {x: 56, z: 20, kinds: ['skeleton', 'creeper', 'zombie']},
];
/* 四矿物深度带(D5: 煤 y12~20 簇 4-8 · 铁 y6~16 簇 3-5 · 金 y2~10 簇 2-3 · 钻 y0~5 簇 1-2)
   p=种子点密度(每列), 盐值分层避免矿种互相踩散列 */
const ADV_ORES = [
  {id: B_COAL_ORE, yLo: 12, yHi: 20, sizeLo: 4, sizeHi: 8, p: 0.012, salt: 101},
  {id: B_IRON_ORE, yLo: 6, yHi: 16, sizeLo: 3, sizeHi: 5, p: 0.0035, salt: 211},
  {id: B_GOLD_ORE, yLo: 2, yHi: 10, sizeLo: 2, sizeHi: 3, p: 0.0035, salt: 311},
  {id: B_DIAMOND_ORE, yLo: 0, yHi: 5, sizeLo: 1, sizeHi: 2, p: 0.002, salt: 411},
];
const ADV_TREES = 40; /* 树林目标棵数(候选按散列值排序取前 N, 空间无偏) */

/* ============================================================
   地形生成 — 全部确定性(SceneKit.rand/hashRand 散布, 零 Math.random)
   ============================================================ */
function advBaseTerrain() {/* 草原地层: y24 草 / y20~23 泥 / y0~19 石 */
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 0; y <= ADV_GROUND - 5; y++) setBlockRaw(x, y, z, 3);
      for (let y = ADV_GROUND - 4; y < ADV_GROUND; y++) setBlockRaw(x, y, z, 2);
      setBlockRaw(x, ADV_GROUND, z, 1);
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
    if (getBlock(cx, cy, cz) === 3) setBlockRaw(cx, cy, cz, o.id);
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
        setBlockRaw(p.cx + dx, y, p.cz + dz, p.ore.id);
      }
    }
  }
}

function advTryOre(x, y, z, id) {
  if (getBlock(x, y, z) === 3) setBlockRaw(x, y, z, id);
}
function advBuildCave() {/* 山洞: 洞口小丘 + 2 宽台阶隧道 y23→y3 + 深处穴室(镶钻) */
  const c = ADV_CAVE;
  /* 洞口小丘(石芯泥皮): 让"山洞入口"在地表上读得出来 */
  const mcx = 98; const mcz = 74;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 3) continue;
      const h = d < 0.8 ? 4 : (d < 1.8 ? 3 : (d < 2.9 ? 2 : 1));
      for (let y = 25; y <= ADV_GROUND + h; y++) setBlockRaw(mcx + dx, y, mcz + dz, y === ADV_GROUND + h ? 2 : 3);
    }
  }
  SceneKit.fill(c.x1, 22, mcz, c.x2, 27, mcz + 3, 0); /* 南侧敞廊: 翻进洞口不用挖 */
  /* 台阶隧道: 每步 z-1·y-1, 洞身+头顶净空 4 高, 垫底防漏 */
  for (let i = 0; i <= c.steps; i++) {
    const z = c.zStart - i;
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
  setBlockRaw(c.x1 - 2, 1, c.zEnd - 2, B_DIAMOND_ORE);
  setBlockRaw(c.x2 + 1, 1, c.zEnd + 2, B_DIAMOND_ORE);
  setBlockRaw(c.x1, 1, c.zEnd, B_DIAMOND_ORE);
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

function advTreeBlocked(x, z) {/* 树木禁区: 出生区/湖/矿坑/山洞(含洞口小丘)/巢穴 */
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
  return x >= c.x1 - 3 && x <= c.x2 + 3 && z >= c.zEnd - 4 && z <= c.zStart + 5;
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
function advPlantTrees() {/* 树林 ~40: 落位清单逐棵种(advTreeSpots) */
  for (const cd of advTreeSpots()) SceneKit.tree(cd.x, ADV_GROUND + 1, cd.z);
}

function advScatterTufts() {/* 草丛散布(T11 缺口, D7 草丛链): 确定性掷点, 只长
  草地表层顶上且上方无物(不占树干/不飘在沙/水上); 密度 ~4.5% 列 — 草原上
  可发现但不铺满, 挖掉 50% 掉小麦种子(config drop 表) */
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (SceneKit.rand(x, z, 9101) < 0.955) continue;
      if (getBlock(x, ADV_GROUND, z) !== 1) continue; /* 脚下是草地(沙岸/湖/矿坑天然排除) */
      if (getBlock(x, ADV_GROUND + 1, z) !== 0) continue; /* 顶上无物(树干/小屋墙不占) */
      setBlockRaw(x, ADV_GROUND + 1, z, B_GRASS_TUFT);
    }
  }
}

function advBuildWorld() {/* 建场总装: 场景函数确定性重建(build 模式同款架构) */
  advBaseTerrain();
  advBuildLake();
  advScatterOres();
  for (const p of ADV_PITS) advBuildPit(p);
  advBuildCave();
  advBuildHut();
  for (const n of ADV_NESTS) advBuildNest(n);
  advPlantTrees();
  advScatterTufts(); /* 树立好再撒草丛(顶上无物判据吃树干占位) */
}

/* ---------- 死亡政策(纯函数段): 满血 + 回出生点 + 背包保留(零惩罚哲学) ---------- */
function advDeathPlan(player, spawn) {
  return {hp: player.maxHp, x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw, keepInv: true};
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
const ADV_PICKUP_WINDOW = 3; /* 收集播报合并窗秒数(D6: 计数累计 3 秒合并播报) */

/* 每巢刷怪数量: 2~3 只(D11), rand 可注入(缺省 Math.random) */
function advNestCount(rand) {
  const r = (rand || Math.random)();
  return ADV_NEST_MIN + Math.floor(r * (ADV_NEST_MAX - ADV_NEST_MIN + 1));
}

/* 巢穴节拍: 巢里有活怪 → 不刷且计时归零; 全清 → 累计到 60s 发刷怪令并归零。
   返回 {spawn, t} — t 由调用方逐巢各存一份(计时独立是结构保证) */
function advNestStep(alive, t, dt) {
  if (alive > 0) return {spawn: false, t: 0};
  const nt = t + dt;
  if (nt >= ADV_NEST_RESPAWN_T) return {spawn: true, t: 0};
  return {spawn: false, t: nt};
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
const ADV_LIVESTOCK_HERDS = [ /* 2 群共 10 只(设计稿 §4.4) */
  {kinds: ['cow', 'cow', 'sheep', 'sheep']}, /* 群位 A: 牛×2+羊×2 */
  {kinds: ['pig', 'pig', 'pig', 'chicken', 'chicken', 'chicken']}, /* 群位 B: 猪×3+鸡×3 */
];
const ADV_HERD_AVOID_R = 2.5; /* 玩家贴近让开距离(设计稿 §4.3: ≤2.5 格) */
const ADV_HERD_AVOID_MULT = 0.8; /* 让开速度系数(speed×0.8, 缓步) */
const ADV_HERD_FLEE_T = 3; /* 受击逃窜秒数(设计稿 §4.3: 3 秒) */
const ADV_HERD_FLEE_MULT = 2.2; /* 逃窜速度系数(speed×2.2) */
const ADV_HERD_AMBLE_MULT = 0.5; /* 闲逛速度系数(吃草步, 六成时间在走) */

function advLivestockHerdOk(x, z, trees) {/* 群位约束(设计稿 §4.4): 离出生点 ≥15 · 避湖/
  矿坑/巢穴/山洞/小屋(外扩裕量盖过群内环带) · 避树干 ±3 盒; 零世界读——基础草原面
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
  if (x >= c.x1 - 5 && x <= c.x2 + 5 && z >= c.zEnd - 5 && z <= c.zStart + 6) return false;
  for (const t of trees) {
    if (Math.abs(t.x - x) <= 3 && Math.abs(t.z - z) <= 3) return false;
  }
  return true;
}

function advLivestockSpots() {/* 群位清单(advLivestockPlan 的位点权威, 单测直触): 候选全图
  收集按散列值排序(advPlantTrees 同款空间无偏), 依次取满足约束且两群 ≥HERD_R 的前两个 */
  const trees = advTreeSpots();
  const cands = [];
  for (let x = 4; x < WORLD_W - 4; x++) {
    for (let z = 4; z < WORLD_D - 4; z++) {
      if (!advLivestockHerdOk(x, z, trees)) continue;
      cands.push({x, z, r: SceneKit.rand(x, z, 7301)});
    }
  }
  cands.sort((a, b) => (a.r - b.r) || (a.x - b.x) || (a.z - b.z));
  const spots = [];
  for (const c of cands) {
    if (spots.length >= ADV_LIVESTOCK_HERDS.length) break;
    if (spots.every((s) => Math.hypot(s.x - c.x, s.z - c.z) >= ADV_LIVESTOCK_HERD_R)) spots.push(c);
  }
  return spots;
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
   block 字段, lookId 为命中格方块 id, targetId 为落点格现有方块 id。
   规则(D4): 落点必须空气 · thin 块(火把/树苗)只放实心面顶(点击面法线
   朝上, 支承块 solid) · 树苗支承限草地/泥土(D7)。返回 {ok,x,y,z} 或
   {ok:false}(不可放置的旗标语义: 草丛/麦等薄块自身 solid:false, 天然
   当不了支承; 草丛/麦物品不存在 block 字段, 进不了本函数)。 */
function advPlaceCheck(hit, blockId, lookId, targetId) {
  const def = blockId != null ? BLOCKS[blockId] : null;
  if (!hit || !def) return {ok: false};
  if (targetId !== 0) return {ok: false}; /* 落点非空气 → 拒(不可叠放) */
  const x = hit.x + hit.nx;
  const y = hit.y + hit.ny;
  const z = hit.z + hit.nz;
  if (def.thin != null) {/* 薄块贴地口径(B_FUSE 同款): 只认实心面顶 */
    const support = lookId != null ? BLOCKS[lookId] : null;
    const solidTop = hit.ny === 1 && support && support.solid !== false && support.thin == null;
    if (!solidTop) return {ok: false};
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

/* ============================================================
   合成与烧炼政策 (T13, 设计稿 D8/D4) — 常量与纯函数段
   ============================================================ */
const ADV_STATION_R = 4; /* 站点解锁半径(拍板④: 走近 4 格; 水平距离口径与巢穴 AI 一致) */
const ADV_SMELT_T = 2.5; /* 每件烧炼秒数(D8: MC 10s → 儿童缩短; 附录 B 差异清单) */
const ADV_TNT_FUSE = 1.5; /* TNT 引信秒数(旧 TNT 模式 1.0 → 儿童留足走开时间) */
const ADV_TNT_R = 3.5; /* 爆炸破坏半径(旧 TNT 模式 radius 先例口径) */
const ADV_TNT_HURT_R = 4.5; /* 波及怪物半径(旧 TNT 模式 hurtR 先例口径) */
const ADV_TNT_DMG_HI = 30; /* 爆心伤害(僵尸 30 一击清场——挖矿神器兼防身) */
const ADV_TNT_DMG_LO = 12; /* 波及边缘伤害(与半径内线性衰减) */
const ADV_TNT_DROP_P = 0.7; /* 爆炸掉落率(D4: MC 30% → 儿童加倍 70%, 附录 B) */
const ADV_SMELT_TTS_T = 3; /* 烧炼完成播报节流秒数(受击语音同款节拍) */

/* 站点解锁判定: stations 为缓存值集合({x,z,id}), 玩家水平距离 ≤r 且 id 匹配
   (wantId 省略=任意站点)即命中——缓存即判据, 不碰世界数据 */
function advNearStation(stations, px, pz, r, wantId) {
  for (const st of stations) {
    if (wantId != null && st.id !== wantId) continue;
    if (Math.hypot(st.x + 0.5 - px, st.z + 0.5 - pz) <= r) return true;
  }
  return false;
}

/* 烧炼单步: s 为炉状态 {input, fuel, out, heat, prog}, heat 单位=件(1 件=
   ADV_SMELT_T 秒, 燃料热值经 fuelUnits 折算), prog 为当前这件已烧秒数。
   无料停炉; 无热且无燃料暂停(进度与热值保留——关面板/断档都不清零不白烧);
   有热折算可烧秒数推进, 满 2.5s 产一件(产物槽同 id 叠加, 异 id 占满则停炉
   待取——MC 阻塞口径), 余时结转下一件, 料尽 prog 归零。返回新状态不改入参。 */
function advSmeltStep(s, dt) {
  const n = {input: s.input, fuel: s.fuel, out: s.out, heat: s.heat, prog: s.prog};
  if (!n.input) return n;
  if (n.heat <= 0) {
    if (!n.fuel) return n; /* 暂停: 等燃料(自动放料)或玩家回来 */
    n.heat += fuelUnits(n.fuel.id); /* 自动燃料: 热值烧尽才耗下一件燃料 */
    n.fuel = n.fuel.n > 1 ? {id: n.fuel.id, n: n.fuel.n - 1} : null;
  }
  const burn = Math.min(dt, n.heat * ADV_SMELT_T); /* 热值折秒, 本步不白烧 */
  n.heat = Math.max(0, n.heat - burn / ADV_SMELT_T);
  n.prog += burn;
  while (n.prog >= ADV_SMELT_T && n.input) {
    const pid = smeltOf(n.input.id);
    if (!pid || (n.out && n.out.id !== pid)) break; /* 非法料/产物槽被占: 停炉待取 */
    n.out = n.out ? {id: pid, n: n.out.n + 1} : {id: pid, n: 1};
    n.input = n.input.n > 1 ? {id: n.input.id, n: n.input.n - 1} : null;
    n.prog -= ADV_SMELT_T;
  }
  if (!n.input) n.prog = 0; /* 料尽: 半件进度清零, 下一炉从头烧 */
  n.prog = Math.min(n.prog, ADV_SMELT_T); /* 进度钳制(显示层 setProgress 再钳一次) */
  return n;
}

/* 退炉政策(D8): 炉内三笔(待烧料/燃料/产物)全额入包, 返回满包容纳不下的
   余量清单——调用方 Drops.spawn 脚下(零惩罚口径); 不动炉状态(清炉归调用方) */
function advFurnaceRefund(inv, f) {
  const leftover = [];
  for (const st of [f.input, f.fuel, f.out]) {
    if (!st) continue;
    const left = add(inv, st.id, st.n);
    if (left > 0) leftover.push({id: st.id, n: left});
  }
  return leftover;
}

/* F1 炉状态形状校验(拍板①: 每炉独立+持久化): 世界档 decode 侧逐条防错,
   非法整条拒收(不炸模式, 材料随损坏档损失——mkSaveSlot 损坏回落先例)。
   槽形状 {id,n}(id 在 ITEMS 注册且 n≥1) · heat ≥0 · prog ∈[0, ADV_SMELT_T] */
function advFurnaceValid(s) {
  if (!s || typeof s !== 'object') return false;
  const slot = (v) => v === null || (typeof v === 'object' && v !== null &&
      !!ITEMS[v.id] && Number.isFinite(v.n) && v.n >= 1);
  if (!slot(s.input) || !slot(s.fuel) || !slot(s.out)) return false;
  return Number.isFinite(s.heat) && s.heat >= 0 &&
      Number.isFinite(s.prog) && s.prog >= 0 && s.prog <= ADV_SMELT_T;
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
];

/* ============================================================
   大宝箱政策 (引导链 v2) — 纯函数段: 全局共享账户 + 材料扩容
   ============================================================ */
const ADV_CHEST_SLOTS = 27; /* 账户槽位硬上限(顶格档, 与背包同宽) */
const ADV_CHEST_START = 9; /* 初始格数: 合成解锁的第一档 */
/* 扩容阶梯(拍板: 箱子只储物+全局共享+材料扩容): 9→18 档 8 圆石(第 7 步挖
   圆石即凑齐) · 18→27 档 4 铁锭(第 12 步烧铁)——材料刻意取任务链产物,
   扩容目标随引导进度自然到期; 挖掉箱子内容保留在账户里(零损失口径) */
const ADV_CHEST_TIERS = [
  {size: 18, cost: {cobble: 8}},
  {size: 27, cost: {iron_ingot: 4}},
];

/* 当前格数 → 下一档 {size, cost} | null(已顶格) */
function advChestNext(size) {
  for (const t of ADV_CHEST_TIERS) if (t.size > size) return t;
  return null;
}

/* 整摞入箱: 前 size 格先并堆(可堆叠)再进空位, 返回放不下的余量件数
   (0=全部收下; 满箱只拒收不惩罚, 余量由调用方留在背包原槽)。
   与 InventoryCore.add 的两处刻意差异: ① 只认前 size 格(扩容档);
   ② 工具按原耐久整槽搬——add 经 mkStack 会把工具重铸满耐久, 不能复用 */
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

/* ============================================================
   提醒政策 (code-review 修复轮 S4) — 纯函数段
   ============================================================ */
const ADV_WEAR_WARN_AT = 0.25; /* 低耐久预警线: 耐久比 <0.25 提醒(D9 耐久条红档同阈值) */
const ADV_BAG_FULL_N = 24; /* 背包快满线: 占用槽 ≥24/27 提醒(留 3 格周转) */
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

/* 背包快满提醒(S4②): 占用槽 ≥ADV_BAG_FULL_N(24/27) → fire 一次; armed 为
   调用方持有的布尔账本——冷却口径=「回落再满」的上升沿: 占用回落到线下即
   重新武装(不按时间冷却, 整理/合成腾出格子后再满会再提醒一次); 持续满格
   不重复轰炸。返回新账本 {armed, fire} */
function advBagFullStep(used, armed) {
  if (used < ADV_BAG_FULL_N) return {armed: true, fire: false};
  return armed ? {armed: false, fire: true} : {armed: false, fire: false};
}

/* 工具坏话术(S4③): 安抚句 + 当前任务步 hint 并句——SpeechKit 是 cancel-
   then-speak, 拆两句会被后句顶掉前句(与任务链「表扬+引导并句」同口径);
   hint 为空(任务全部完成)不拼引导 */
function advBreakToolText(name, hint) {
  return '哎呀，' + name + ' 用坏了！不哭，我们再做一个更棒的！' +
      (hint ? ' 接下来：' + hint : '');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {ADV_GROUND, ADV_HUT, ADV_SPAWN, ADV_LAKE, ADV_PITS, ADV_CAVE, ADV_NESTS,
    ADV_ORES, ADV_TREES, advBaseTerrain, advBuildLake, advOreCluster, advScatterOres,
    advBuildPit, advTryOre, advBuildCave, advBuildHut, advBuildNest, advTreeBlocked,
    advPlantTrees, advTreeSpots, advScatterTufts, advBuildWorld, advDeathPlan,
    ADV_NEST_MIN, ADV_NEST_MAX, ADV_NEST_RESPAWN_T, ADV_NEST_AGGRO_R, ADV_NEST_LEASH_R,
    ADV_NEST_HOME_R, ADV_NEST_RING_LO, ADV_NEST_RING_HI, ADV_DMG_CAP, ADV_MELEE_R,
    ADV_SWING_CD, ADV_FIST_DMG, ADV_AIM_COS, ADV_ATTACK_T, ADV_ARROW_SPEED, ADV_PICKUP_WINDOW,
    advNestCount, advNestStep, advSwingDmg, advMobDmg, advDeathDrops, advPickupText,
    ADV_MINE_SWING, ADV_SAP_GROW, advMineStep, advPlaceCheck, advEatPolicy, advSapDue,
    ADV_STATION_R, ADV_SMELT_T, ADV_TNT_FUSE, ADV_TNT_R, ADV_TNT_HURT_R, ADV_TNT_DMG_HI,
    ADV_TNT_DMG_LO, ADV_TNT_DROP_P, ADV_SMELT_TTS_T, advNearStation, advSmeltStep,
    advFurnaceRefund, advFurnaceValid, advFurnaceClean, advTntRoll, advTntDmg,
    ADV_LIVESTOCK_SPAWN_R, ADV_LIVESTOCK_HERD_R, ADV_LIVESTOCK_RING_LO,
    ADV_LIVESTOCK_RING_HI, ADV_LIVESTOCK_HERDS, ADV_HERD_AVOID_R, ADV_HERD_AVOID_MULT,
    ADV_HERD_FLEE_T, ADV_HERD_FLEE_MULT, ADV_HERD_AMBLE_MULT,
    advLivestockHerdOk, advLivestockSpots, advLivestockPlan, advHerdStep,
    ADV_QUEST_CHECK_T, ADV_QUEST_TITLE, ADV_MINE_TALLY, ADV_QUESTS,
    ADV_CHEST_SLOTS, ADV_CHEST_START, ADV_CHEST_TIERS, advChestNext, advChestPut,
    ADV_WEAR_WARN_AT, ADV_BAG_FULL_N, ADV_BAG_CHECK_T, advWearWarn, advBagFullStep,
    advBreakToolText};
}
