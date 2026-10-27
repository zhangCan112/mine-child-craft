'use strict';
/* ============================================================
   冒险地图纯核心 (AdventureMapsCore) — 应用层·纯核心
   ------------------------------------------------------------
   冒险模式的地图注册表与三张生态远征图(沙漠/雪原/沼泽)的建场核心
   (docs/adventure-maps-design.md, 票据 T4): 零 THREE 零 DOM——建场段
   直用全局 setBlockRaw/getBlock/SceneKit(adventure-core 建场族同款
   惯例, 确定性零 Math.random), 政策段(门解锁/站桩/落点/死亡回家)
   纯数据进出。壳装配(切图换桶/applyMapPalette/遮罩/门体/怪物 spawn)
   归 T6/T7, 本文件只出数据与判定。
   interface: 地图注册表 ADV_MAPS(四行, 每行 id/name/hud/palette 调色板
     四元组(地表/植被/水/天, RGB 0..1)/build 建场函数/nests 巢穴池/
     nightPool 夜怪池(替换语义: 整池换防不混刷)/gates 门位清单/
     livestock 畜牧分布键, swamp 行另带 witchHut 常驻标记; home 行经
     Object.assign 并入 ADV_HOME_ROW——巢穴池/夜怪池同一引用不复制) ·
     图常量 ADV_DESERT/ADV_SNOW/ADV_SWAMP(结构坐标/巢穴/门位唯一权威,
     建场与行数据都从这里派生) · 建场函数族 advDesertBuild/
     advSnowBuild/advSwampBuild(每图建场总装, 签名零参同 advBuildWorld) ·
     政策纯函数 advMapUnlocked(门解锁判定, 任务档 counts 键
     unlockedDesert/unlockedSnow/unlockedSwamp)/advGateHoldStep(门面
     站桩步进, 2s 可反悔, 状态进 {t,fire} 出)/advMapArriveAt(指定门位
     到达落点: 回程门内侧 2.5 格、面朝外——advPortalExit 同口径;
     advMapArrive(row)=gates[0] 便捷版)/
     advMapDeathPlan(死亡回家: 远征图死=满血+home 门口, 地图行化) ·
     advTempleTrapOn/advTempleTrapCells(神殿可疑地板踩塌判定与塌落格清单,
     审查修复 P1——运行时踩塌机制在壳层 advTempleTrapTick)
   依赖(均经全局名, 调用期解析): adventure-core.js 的 ADV_GROUND/
     ADV_SPAWN/ADV_PORTAL/ADV_HOME_ROW/advBuildWorld/advDeathPlan/
     advPortalExit(index.html 加载序: adventure-core → 本文件 →
     modes/adventure; 门几何常量复用 ADV_PORTAL 不另定义) · config.js
     的 B_* 生态方块常量(54~62)与 WORLD_W/WORLD_D/WORLD_H ·
     scene-kit.js 的 SceneKit(fill/tree/rand/heightAt 高度场) ·
     voxel.js 的 setBlockRaw/getBlock
   可测性: 零 THREE·零 DOM·有单测(test/adventure-maps-core.test.js,
     vm 装真引擎件直测, 建场确定性对着真散布函数逐字节断言)
   ============================================================ */

/* ============================================================
   图常量 — 每图结构坐标/巢穴池/门位/散布盐的唯一权威
   (ADV_MAPS 行的 nests/gates/witchHut 从这里派生同引用, 坐标不在
   两处写; 布局口径: 回程门统一 (58,70), 落点在门南侧开阔区——
   advMapArrive 的面朝外前提; 远征图无床无熔炉, 死了回家 §2.2)
   ============================================================ */
const ADV_DESERT = {/* 黄沙沙漠: 沙丘地形 + 砂岩神殿 + 绿洲 + 尸壳替换僵尸 */
  gate: {px: 58, pz: 70}, /* 回程门框位(门体 T7 经 advPortalFrame 建, 此处只登记) */
  temple: {cx: 64, cz: 40, r: 7, trapY: 24}, /* 沙漠神殿: 砂岩空心金字塔(塔内可入) +
      地下宝箱室; trapY=可疑地板层(室内地表 y24 中央 2×2 砂岩显眼底板, 踩塌入口
      ——审查修复 P1: 埋两层沙下孩子踩不到, 改室内可见可踩; 运行时机制在壳层) */
  oasis: [ /* 小绿洲水泊: 水面齐 y24, 沙岸环绕 */
    {cx: 28, cz: 92, r: 5},
    {cx: 98, cz: 96, r: 4},
  ],
  nests: [ /* 巢穴池(替换语义: zombie 位→husk, 票据 T4 红线) */
    {x: 24, z: 28, kinds: ['husk', 'skeleton', 'creeper']},
    {x: 100, z: 56, kinds: ['husk', 'creeper', 'skeleton']},
    {x: 44, z: 108, kinds: ['husk', 'skeleton', 'creeper']},
  ],
  salt: 6201, /* 本图散布盐(与别图/别类散布分层, 互不踩) */
};

const ADV_SNOW = {/* 白雪雪原: 雪堆地形 + 冰面湖 + 雪屋 + 流浪者替换骷髅 */
  gate: {px: 58, pz: 70},
  hut: {cx: 40, cz: 40, r: 4}, /* 雪屋: 雪块圆顶(球半径 4) + 地下宝箱室 */
  lakes: [ /* 冰封小湖: 冰面 + 冰下水体 */
    {cx: 92, cz: 28, r: 8},
    {cx: 26, cz: 100, r: 6},
  ],
  nests: [ /* 巢穴池(替换语义: skeleton 位→stray) */
    {x: 28, z: 60, kinds: ['stray', 'zombie', 'creeper']},
    {x: 96, z: 86, kinds: ['stray', 'creeper', 'zombie']},
    {x: 62, z: 16, kinds: ['stray', 'zombie', 'creeper']},
  ],
  salt: 6301,
};

const ADV_SWAMP = {/* 青苔沼泽: 平地浅水洼 + 垂藤橡树 + 沼骸替换骷髅 + 女巫小屋 */
  gate: {px: 58, pz: 70},
  hut: {x: 90, z: 42}, /* 女巫小屋: 高脚木屋(原木柱脚+木板屋体), witch 常驻位 */
  pools: [ /* 浅水洼: 水面齐 y24 可趟, 泥岸环绕 */
    {cx: 22, cz: 26, r: 4},
    {cx: 68, cz: 34, r: 5},
    {cx: 30, cz: 92, r: 4},
    {cx: 102, cz: 96, r: 5},
    {cx: 48, cz: 58, r: 3},
  ],
  nests: [ /* 巢穴池(替换语义: skeleton 位→bogged; slime 不入巢池——设计 §3 口径
      「史莱姆=夜间水边专属」, 白天巢穴不刷, 审查修复 P3) */
    {x: 22, z: 58, kinds: ['bogged', 'zombie', 'zombie']},
    {x: 98, z: 68, kinds: ['bogged', 'zombie', 'bogged']},
  ],
  salt: 6401,
};

/* ============================================================
   建场函数族 — 确定性(SceneKit.rand/heightAt 散布, 零 Math.random),
   两次建场 worldCells 逐字节一致(单测红线); 门体不在建场内
   (T7 壳经 advPortalFrame 建, 建场只保证门位区压平净空)
   ============================================================ */

/* 参数化巢穴丘(advBuildNest 同形状, 方块随图换): top=丘体方块,
   rock=点缀方块——desert 沙+砂岩 / snow 雪块+石头 / swamp 泥+苔石
   (与 home 巢同观感)。kinds 池在图常量 nests 里, 刷怪归壳(T6) */
function advMapNest(n, top, rock) {
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 2) continue;
      const h = d < 0.8 ? 3 : (d < 1.8 ? 2 : 1);
      for (let y = ADV_GROUND + 1; y <= ADV_GROUND + h; y++) {
        const id = (d >= 0.8 && SceneKit.rand(n.x + dx, n.z + dz, 5102) > 0.72) ? rock : top;
        setBlockRaw(n.x + dx, y, n.z + dz, id);
      }
    }
  }
  for (const y of [ADV_GROUND + 1, ADV_GROUND + 2]) setBlockRaw(n.x, y, n.z + 2, 0); /* 洞口朝南 */
}

/* ---------- 黄沙沙漠 ---------- */

function advDesertFlats() {/* 压平区清单: 回程门/神殿/绿洲/巢穴(Snow/swamp 同款手法)。
    注: 三图 Flats/Blocked 族同构**有意保留**(审查修复 S3 备案)——各自禁区构成不同
    (神殿+绿洲 vs 雪屋+冰湖 vs 小屋+水洼), 逐图显式列举比抽象成配置表更可读,
    与 adventure-core 建场族的显式先例同法; 公共子句已抽 advGateZoneBlocked */
  const f = [
    {cx: ADV_DESERT.gate.px + 2, cz: ADV_DESERT.gate.pz, r: 12}, /* 门区+落点开阔带 */
    {cx: ADV_DESERT.temple.cx, cz: ADV_DESERT.temple.cz, r: 18},
  ];
  for (const o of ADV_DESERT.oasis) f.push({cx: o.cx, cz: o.cz, r: o.r + 3});
  for (const n of ADV_DESERT.nests) f.push({cx: n.x, cz: n.z, r: 6});
  return f;
}

function advDesertTerrain() {/* 沙丘地层: heightAt 幅度 2 起伏 + 九成沙面/零星砂岩露头
    (~6%, 审查修复 P5: 露头 11% 挤占沙面至 87.5% 低于 spec 九成红线)
    + 砂岩垫层 3 格 + 绿洲水泊(压平区内水面齐 y24, home 湖同款)。
    门区+落点走廊强制沙面(砂岩露头散布不进门位——门体的落位前提) */
  const gt = ADV_DESERT.gate;
  const inGateZone = (x, z) => x >= gt.px - 2 && x <= gt.px + 7 && z >= gt.pz - 2 && z <= gt.pz + 9;
  const opts = {salt: ADV_DESERT.salt, amp: 2, base: 0, flats: advDesertFlats()};
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      const top = ADV_GROUND + SceneKit.heightAt(x, z, opts);
      for (let y = 0; y <= top - 4; y++) setBlockRaw(x, y, z, 3);
      for (let y = top - 3; y < top; y++) setBlockRaw(x, y, z, B_SANDSTONE);
      const bare = !inGateZone(x, z) && SceneKit.rand(x, z, ADV_DESERT.salt + 1) > 0.94;
      setBlockRaw(x, top, z, bare ? B_SANDSTONE : 8);
    }
  }
  for (const o of ADV_DESERT.oasis) {/* 绿洲: 湖心水+沙底, 沙岸环绕 */
    for (let dx = -o.r; dx <= o.r; dx++) {
      for (let dz = -o.r; dz <= o.r; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > o.r) continue;
        const x = o.cx + dx; const z = o.cz + dz;
        if (d < o.r - 1.2) {
          setBlockRaw(x, ADV_GROUND, z, B_WATER);
          setBlockRaw(x, ADV_GROUND - 1, z, 8);
        } else {
          setBlockRaw(x, ADV_GROUND, z, 8);
          setBlockRaw(x, ADV_GROUND - 1, z, 8);
        }
      }
    }
  }
}

function advDesertTemple() {/* 沙漠神殿: 砂岩**空心**金字塔(MC 原版口径——塔内可入,
    北面 2×2 门洞)+南面外楼梯 + 地下宝箱室(B_CHEST 接大宝箱阶梯) + 可疑地板
    (室内地面中央 2×2 砂岩显眼底板, 踩塌滑落入口——MC TNT 陷阱的儿童版,
    附录 B #5: 无爆炸无致死; 运行时踩塌机制在壳层, 审查修复 P1) + 东侧出路
    楼梯(矿坑 1 格级教训, 不困人) */
  const t = ADV_DESERT.temple;
  /* 地下宝箱室 7×7×4(先掏, 金字塔再压顶) */
  SceneKit.fill(t.cx - 3, 17, t.cz - 3, t.cx + 3, 17, t.cz + 3, B_SANDSTONE); /* 室地板 */
  SceneKit.fill(t.cx - 3, 18, t.cz - 3, t.cx + 3, 21, t.cz + 3, 0); /* 室腔 */
  SceneKit.fill(t.cx - 3, 22, t.cz - 3, t.cx + 3, 23, t.cz + 3, B_SANDSTONE); /* 室顶+地基 */
  /* 室顶竖井: 中央 2×2 掏穿 y22~23——室内地面的可疑地板正下方, 踩塌即坠入 */
  SceneKit.fill(t.cx - 1, 22, t.cz - 1, t.cx, 23, t.cz, 0);
  /* 可疑地板: 室内地表(y24)中央 2×2 砂岩显眼底板——周围是沙, 「颜色不一样的
      地板」踩上去就塌(P1: 从埋两层沙下改为室内可见可踩; 砂岩无 fall 旗,
      悬井而建不被 P14 清扫) */
  SceneKit.fill(t.cx - 1, t.trapY, t.cz - 1, t.cx, t.trapY, t.cz, B_SANDSTONE);
  setBlockRaw(t.cx, 20, t.cz, B_CHEST);
  setBlockRaw(t.cx - 2, 18, t.cz - 2, B_TORCH); /* 照明(防室内刷怪+不困黑的); 落地站
      膛(y18 站室地板 y17)——悬空 thin 会被 P14 清扫首进治愈, 违反桶重放确定性红线 */
  setBlockRaw(t.cx + 2, 18, t.cz + 2, B_TORCH);
  /* 东侧出路: 1 格级楼梯 y19→y25 回地表(穿地层向东); 楼梯道上方沙柱换砂岩盖
      (fall 旗沙被掏空后悬空 → 首进清扫迁移, 同红线) */
  for (let i = 0; i <= 6; i++) {
    const x = t.cx + 4 + i; const y = 19 + i;
    SceneKit.fill(x, y, t.cz - 1, x, y + 2, t.cz + 1, 0); /* 净空 */
    for (let z = t.cz - 1; z <= t.cz + 1; z++) {
      for (let yy = y + 3; yy <= ADV_GROUND; yy++) {
        if (getBlock(x, yy, z) === 8) setBlockRaw(x, yy, z, B_SANDSTONE); /* 沙顶盖砂岩(稳定地层) */
      }
    }
    if (getBlock(x, y - 1, t.cz) === 0) setBlockRaw(x, y - 1, t.cz, B_SANDSTONE); /* 垫脚 */
  }
  SceneKit.fill(t.cx + 10, ADV_GROUND, t.cz - 1, t.cx + 11, ADV_GROUND, t.cz + 1, 8); /* 出口沙平台 */
  /* 金字塔 8 级(底 15×15 → 顶尖 1×1), 塔底 y25 起于地表 y24 之上——**每级只砌
      外圈 1 格厚**(空心, 塔内可站人); 北面塔脚留 2×2 门洞(lv0~1 跳过——南面有
      外楼梯、东侧有出路楼梯, 门开北面互不打架) */
  for (let lv = 0; lv <= 7; lv++) {
    const r = t.r - lv;
    const y = ADV_GROUND + 1 + lv;
    for (let x = t.cx - r; x <= t.cx + r; x++) {
      for (let z = t.cz - r; z <= t.cz + r; z++) {
        const onRing = x === t.cx - r || x === t.cx + r || z === t.cz - r || z === t.cz + r;
        if (!onRing) continue; /* 空心: 只砌外圈 */
        const isDoor = lv <= 1 && z === t.cz - t.r && x >= t.cx - 1 && x <= t.cx;
        if (isDoor) continue; /* 北门 2 宽 × 2 高 */
        setBlockRaw(x, y, z, B_SANDSTONE);
      }
    }
  }
  /* 南面外楼梯: 2 宽台阶嵌塔身(y26→y32, 顶与塔尖 y32 平步相接, 相邻高差 1) */
  for (let i = 0; i <= 6; i++) {
    SceneKit.fill(t.cx - 1, ADV_GROUND + 2 + i, t.cz + t.r - i, t.cx, ADV_GROUND + 2 + i, t.cz + t.r - i, B_SANDSTONE);
  }
}

function advGateZoneBlocked(gate, x, z) {/* 门区植被禁区子句(审查修复 S3 抽取: 三图 Blocked
    逐字重复的公共判定——门体包围盒外扩 10, 与建场门位压平净空同宽) */
  return Math.abs(x - gate.px - 2) <= 10 && Math.abs(z - gate.pz) <= 10;
}

function advDesertBlocked(x, z) {/* 植被禁区: 门区/神殿(含楼梯出口)/绿洲/巢穴 */
  const d = ADV_DESERT;
  if (advGateZoneBlocked(d.gate, x, z)) return true;
  if (Math.abs(x - d.temple.cx) <= d.temple.r + 2 && Math.abs(z - d.temple.cz) <= d.temple.r + 2) return true;
  for (const o of d.oasis) if (Math.hypot(x - o.cx, z - o.cz) <= o.r + 2) return true;
  for (const n of d.nests) if (Math.hypot(x - n.x, z - n.z) < 6) return true;
  return false;
}

function advDesertPlants() {/* 仙人掌 2-3 高柱 + 枯灌木散布(确定性, 只长
    沙面——列顶 getBlock 判定, 砂岩露头/水泊/结构天然排除) */
  const d = ADV_DESERT;
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (advDesertBlocked(x, z)) continue;
      const r = SceneKit.rand(x, z, d.salt + 2);
      if (r <= 0.988) continue;
      const y = groundTop(x, z);
      if (getBlock(x, y, z) !== 8) continue; /* 只长沙面 */
      if (r > 0.995) {/* 仙人掌柱(~0.5% 列) */
        const h = 2 + (SceneKit.rand(x, z, d.salt + 3) > 0.5 ? 1 : 0);
        for (let i = 1; i <= h; i++) setBlockRaw(x, y + i, z, B_CACTUS);
      } else {/* 枯灌木(~0.7% 列) */
        setBlockRaw(x, y + 1, z, B_DEAD_BUSH);
      }
    }
  }
}

function advDesertBuild() {/* 沙漠建场总装 */
  advDesertTerrain();
  advDesertTemple();
  for (const n of ADV_DESERT.nests) advMapNest(n, 8, B_SANDSTONE);
  advDesertPlants();
}

/* ---------- 白雪雪原 ---------- */

function advSnowFlats() {/* 压平区: 回程门/雪屋/冰湖/巢穴 */
  const f = [
    {cx: ADV_SNOW.gate.px + 2, cz: ADV_SNOW.gate.pz, r: 12},
    {cx: ADV_SNOW.hut.cx, cz: ADV_SNOW.hut.cz, r: 12},
  ];
  for (const l of ADV_SNOW.lakes) f.push({cx: l.cx, cz: l.cz, r: l.r + 3});
  for (const n of ADV_SNOW.nests) f.push({cx: n.x, cz: n.z, r: 6});
  return f;
}

function advSnowTerrain() {/* 雪堆地层: heightAt 幅度 2 起伏 + 全铺雪覆草 +
    冰封小湖(冰面 y24 + 冰下 2 格水 + 泥底; 湖岸雪覆草——雪原一切雪白) */
  const opts = {salt: ADV_SNOW.salt, amp: 2, base: 0, flats: advSnowFlats()};
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      const top = ADV_GROUND + SceneKit.heightAt(x, z, opts);
      for (let y = 0; y <= top - 5; y++) setBlockRaw(x, y, z, 3);
      for (let y = top - 4; y < top; y++) setBlockRaw(x, y, z, 2);
      setBlockRaw(x, top, z, B_SNOWY_GRASS);
    }
  }
  for (const l of ADV_SNOW.lakes) {
    for (let dx = -l.r; dx <= l.r; dx++) {
      for (let dz = -l.r; dz <= l.r; dz++) {
        if (Math.hypot(dx, dz) > l.r - 1.2) continue; /* 冰面内圈 */
        const x = l.cx + dx; const z = l.cz + dz;
        setBlockRaw(x, ADV_GROUND, z, B_ICE);
        setBlockRaw(x, ADV_GROUND - 1, z, B_WATER);
        setBlockRaw(x, ADV_GROUND - 2, z, B_WATER);
        setBlockRaw(x, ADV_GROUND - 3, z, 2); /* 泥底 */
      }
    }
  }
}

function advSnowTree(x, baseY, z) {/* 云杉: 原木 4-6 高 + 锥形叶冠——「现有树形
    换色口径」: 复用原木(5)/树叶(7) 两方块, 尖塔轮廓(下宽上尖+顶帽)与
    橡树圆冠(SceneKit.tree)拉开辨识; 叶贴干 ≤2 格, need:dist4 内不失撑 */
  const th = 4 + Math.floor(SceneKit.rand(x + 7, z + 3, ADV_SNOW.salt + 5) * 3);
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

function advSnowHut() {/* 雪屋: 雪块圆顶(球壳 r4, 室内掏空) + 南门洞 + 地下宝箱室
    (屋内雪面挖开即入——雪块硬度 0.2, 儿童三四下; 宝箱+火把+东侧出路楼梯) */
  const h = ADV_SNOW.hut;
  for (let dx = -4; dx <= 4; dx++) {
    for (let dy = 0; dy <= 4; dy++) {
      for (let dz = -4; dz <= 4; dz++) {
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const x = h.cx + dx; const y = ADV_GROUND + dy; const z = h.cz + dz;
        if (d >= 3 && d <= 4) setBlockRaw(x, y, z, B_SNOW);
        else if (d < 3 && dy > 0) setBlockRaw(x, y, z, 0); /* 室内净空 */
      }
    }
  }
  SceneKit.fill(h.cx - 1, ADV_GROUND + 1, h.cz + h.r, h.cx, ADV_GROUND + 2, h.cz + h.r, 0); /* 门洞朝南 2×2 */
  /* 地下宝箱室 5×5×3(y19~21) */
  SceneKit.fill(h.cx - 2, 18, h.cz - 2, h.cx + 2, 18, h.cz + 2, B_SNOW); /* 室地板 */
  SceneKit.fill(h.cx - 2, 19, h.cz - 2, h.cx + 2, 21, h.cz + 2, 0); /* 室腔 */
  SceneKit.fill(h.cx - 2, 22, h.cz - 2, h.cx + 2, 23, h.cz + 2, B_SNOW); /* 室顶(屋内地面下) */
  setBlockRaw(h.cx, 20, h.cz, B_CHEST);
  setBlockRaw(h.cx - 1, 19, h.cz - 1, B_TORCH); /* 落地站膛(y19 站室地板 y18, 悬空 thin 会被清扫治愈) */
  for (let i = 0; i <= 5; i++) {/* 东侧 1 宽出路台阶 y19→y24 */
    const x = h.cx + 3 + i; const y = 19 + i;
    for (let yy = y; yy <= y + 2; yy++) setBlockRaw(x, yy, h.cz, 0);
    if (getBlock(x, y - 1, h.cz) === 0) setBlockRaw(x, y - 1, h.cz, B_SNOW);
  }
}

function advSnowBlocked(x, z) {/* 植被禁区: 门区/雪屋(含出路外延)/冰湖/巢穴 */
  const d = ADV_SNOW;
  if (advGateZoneBlocked(d.gate, x, z)) return true;
  if (Math.abs(x - d.hut.cx) <= d.hut.r + 9 && Math.abs(z - d.hut.cz) <= d.hut.r + 3) return true;
  for (const l of d.lakes) if (Math.hypot(x - l.cx, z - l.cz) <= l.r + 2) return true;
  for (const n of d.nests) if (Math.hypot(x - n.x, z - n.z) < 6) return true;
  return false;
}

function advSnowScatter() {/* 云杉 ~22(候选按散列值排序取前 N, advTreeSpots 同法
    ——空间无偏) + 雪堆点缀(单块雪, 挖掉得雪球=雪仗弹药)。
    注: 「cands→sort→slice(0,N)」三处同构**有意保留**(审查修复 S3 备案)——散布
    门类(树/兰花/枯灌木)各自 blocker 与密度不同, 抽公共 helper 反而藏起差异,
    与 adventure-core advTreeSpots 先例同法 */
  const d = ADV_SNOW;
  const cands = [];
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (advSnowBlocked(x, z)) continue;
      const r = SceneKit.rand(x, z, d.salt + 4);
      if (r > 0.996) cands.push({x, z, r});
      /* 雪堆点缀 ~1.5% 列: 只长雪覆草上 */
      if (r > 0.985 && r <= 0.996) {
        const y = groundTop(x, z);
        if (getBlock(x, y, z) === B_SNOWY_GRASS) setBlockRaw(x, y + 1, z, B_SNOW);
      }
    }
  }
  cands.sort((a, b) => (a.r - b.r) || (a.x - b.x) || (a.z - b.z));
  for (const cd of cands.slice(0, 22)) {
    const y = groundTop(cd.x, cd.z);
    if (getBlock(cd.x, y, cd.z) === B_SNOWY_GRASS) advSnowTree(cd.x, y + 1, cd.z);
  }
}

function advSnowBuild() {/* 雪原建场总装 */
  advSnowTerrain();
  advSnowHut();
  for (const n of ADV_SNOW.nests) advMapNest(n, B_SNOW, 3);
  advSnowScatter();
}

/* ---------- 青苔沼泽 ---------- */

function advSwampTerrain() {/* 沼泽地层: 平地草/泥/石(home 口径, 无丘——票据
    只给沙丘/雪堆轻用高度场) + 浅水洼(水面齐 y24 可趟+泥底) + 泥岸环绕 */
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 0; y <= ADV_GROUND - 5; y++) setBlockRaw(x, y, z, 3);
      for (let y = ADV_GROUND - 4; y < ADV_GROUND; y++) setBlockRaw(x, y, z, 2);
      setBlockRaw(x, ADV_GROUND, z, 1);
    }
  }
  for (const p of ADV_SWAMP.pools) {
    for (let dx = -p.r - 1; dx <= p.r + 1; dx++) {
      for (let dz = -p.r - 1; dz <= p.r + 1; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > p.r + 1.2) continue;
        const x = p.cx + dx; const z = p.cz + dz;
        if (d < p.r - 0.5) {/* 洼心: 水 + 泥底 */
          setBlockRaw(x, ADV_GROUND, z, B_WATER);
          setBlockRaw(x, ADV_GROUND - 1, z, 2);
        } else {/* 泥岸 */
          setBlockRaw(x, ADV_GROUND, z, 2);
        }
      }
    }
  }
}

function advSwampHut() {/* 女巫小屋(MC 沼泽小屋同款位): 高脚木屋——原木柱脚
    y25~27 撑起木板屋体(地板 y28/墙 y29~30/顶 y31), 南门洞+台阶进门;
    屋内宝箱+火把。witch 常驻位在图常量(ADV_SWAMP.hut), spawn 归壳 T6 */
  const h = ADV_SWAMP.hut;
  for (const cn of [[h.x - 2, h.z - 1], [h.x + 2, h.z - 1], [h.x - 2, h.z + 1], [h.x + 2, h.z + 1]]) {
    for (let y = ADV_GROUND + 1; y <= ADV_GROUND + 3; y++) setBlockRaw(cn[0], y, cn[1], 5); /* 柱脚 */
  }
  SceneKit.fill(h.x - 2, ADV_GROUND + 4, h.z - 1, h.x + 2, ADV_GROUND + 4, h.z + 2, 6); /* 地板 */
  for (const y of [ADV_GROUND + 5, ADV_GROUND + 6]) {/* 墙(留南门洞) */
    SceneKit.fill(h.x - 2, y, h.z - 1, h.x + 2, y, h.z - 1, 6);
    SceneKit.fill(h.x - 2, y, h.z + 2, h.x + 2, y, h.z + 2, 6);
    SceneKit.fill(h.x - 2, y, h.z, h.x - 2, y, h.z + 1, 6);
    SceneKit.fill(h.x + 2, y, h.z, h.x + 2, y, h.z + 1, 6);
  }
  SceneKit.fill(h.x, ADV_GROUND + 5, h.z + 2, h.x, ADV_GROUND + 6, h.z + 2, 0); /* 南门洞 2 高 */
  SceneKit.fill(h.x - 2, ADV_GROUND + 7, h.z - 1, h.x + 2, ADV_GROUND + 7, h.z + 2, 6); /* 顶 */
  setBlockRaw(h.x, ADV_GROUND + 4, h.z, B_CHEST);
  setBlockRaw(h.x - 2, ADV_GROUND + 5, h.z - 1, B_TORCH); /* 西墙火把 */
  for (let i = 0; i <= 2; i++) {/* 台阶: y25..y27 三级到地板平步(1 格级) */
    setBlockRaw(h.x, ADV_GROUND + 1 + i, h.z + 5 - i, 6);
  }
}

function advSwampBlocked(x, z) {/* 植被禁区: 门区/小屋(含台阶)/水洼(+泥岸)/巢穴 */
  const d = ADV_SWAMP;
  if (advGateZoneBlocked(d.gate, x, z)) return true;
  if (Math.abs(x - d.hut.x) <= 6 && Math.abs(z - d.hut.z) <= 8) return true;
  for (const p of d.pools) if (Math.hypot(x - p.cx, z - p.cz) <= p.r + 2) return true;
  for (const n of d.nests) if (Math.hypot(x - n.x, z - n.z) < 6) return true;
  return false;
}

function advSwampScatter() {/* 垂藤橡树 ~18(SceneKit.tree 橡树形; 垂藤从简——
    暗绿观感由 T6 调色板氛围补) + 兰花散布(沼泽唯一产地, 只长草上) */
  const d = ADV_SWAMP;
  const cands = [];
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (advSwampBlocked(x, z)) continue;
      const r = SceneKit.rand(x, z, d.salt + 4);
      if (r > 0.997) cands.push({x, z, r});
      if (r > 0.99 && r <= 0.997) {/* 兰花 ~0.7% 列 */
        const y = groundTop(x, z);
        if (getBlock(x, y, z) === 1) setBlockRaw(x, y + 1, z, B_ORCHID);
      }
    }
  }
  cands.sort((a, b) => (a.r - b.r) || (a.x - b.x) || (a.z - b.z));
  for (const cd of cands.slice(0, 18)) {
    const y = groundTop(cd.x, cd.z);
    if (getBlock(cd.x, y, cd.z) === 1) SceneKit.tree(cd.x, y + 1, cd.z);
  }
}

function advSwampBuild() {/* 沼泽建场总装 */
  advSwampTerrain();
  advSwampHut();
  for (const n of ADV_SWAMP.nests) advMapNest(n, 2, 14); /* 泥丘+苔石(home 巢同款) */
  advSwampScatter();
}

/* ============================================================
   地图注册表 — 每图一行, 五件套(调色板/专属怪/唯一结构/专属资源/
   门位)齐活才算一张图(设计稿 §2.1); 壳 T6 按行换池/换天/换名。
   调色板四元组是每图美术基准: T6 applyMapPalette 消费水/天, 地表/
   植被色由方块自带(登记为辨识度基准, 与设计稿 §2.1 表一一对应)。
   ============================================================ */
const ADV_MAPS = [
  Object.assign({/* home: 并入 ADV_HOME_ROW 的 id/nests/nightPool(同一引用不复制,
     巢穴池/夜怪池缺省即本图, T2 通道; 建场仍 advBuildWorld, 布局重排归 T5) */
    name: '家园草原', hud: '🏡 家园草原',
    palette: {/* 草绿/橡树/常规蓝/常规天(§2.1) */
      ground: [0.43, 0.74, 0.34], flora: [0.20, 0.50, 0.22],
      water: [0.25, 0.45, 0.85], sky: [0.56, 0.78, 1.00],
    },
    build: advBuildWorld,
    gates: [ /* 三扇门阵(T5 广场压平区 x78-92 z74-88 内品字落位, 门体 T7 建;
       现散布场校准: 落位避树冠/树干, 撞上的只有 thin 草丛——门基座直接覆盖。
       look = 门体观感主题(2026-10-27 精细化): 塔楼/冠带/步道主砖/步道花砖
       随目的地换装——沙漠砂岩+沙花砖/雪原雪块+冰花砖/沼泽苔石+泥花砖, 另附
       步道前缘双火把灯柱; 黑曜石门框环与门面不换装(传送门辨识底座)) */
      {to: 'desert', px: 80, pz: 76,
        look: {tower: B_SANDSTONE, crown: 8, path: B_SANDSTONE, pathAlt: 8}},
      {to: 'snow', px: 88, pz: 76,
        look: {tower: B_SNOW, crown: B_ICE, path: B_SNOW, pathAlt: B_ICE}},
      {to: 'swamp', px: 80, pz: 88,
        look: {tower: 14, crown: 5, path: 14, pathAlt: 2}},
    ],
    livestock: 'herds', /* 四畜全套留 home(设计稿 §10 拍板⑤) */
  }, ADV_HOME_ROW),
  {
    id: 'desert', name: '黄沙沙漠', hud: '🏜️ 黄沙沙漠',
    palette: {/* 沙色/仙人掌绿/绿洲青/暖黄天(§2.1: 沙 #86,0.80,0.55) */
      ground: [0.86, 0.80, 0.55], flora: [0.29, 0.53, 0.22],
      water: [0.30, 0.60, 0.65], sky: [0.90, 0.82, 0.62],
    },
    build: advDesertBuild,
    nests: ADV_DESERT.nests,
    nightPool: [['husk', 2], ['creeper', 1], ['spider', 1]], /* home 夜池 zombie 位→husk */
    gates: [{to: 'home', px: ADV_DESERT.gate.px, pz: ADV_DESERT.gate.pz}],
    livestock: 'none',
  },
  {
    id: 'snow', name: '白雪雪原', hud: '🌨️ 白雪雪原',
    palette: {/* 雪白/云杉深绿/冰面淡蓝/冷白天(§2.1) */
      ground: [0.93, 0.95, 0.98], flora: [0.14, 0.34, 0.20],
      water: [0.63, 0.78, 0.94], sky: [0.80, 0.87, 0.96],
    },
    build: advSnowBuild,
    nests: ADV_SNOW.nests,
    nightPool: [['stray', 2], ['zombie', 1], ['creeper', 1]], /* 主角换流浪者 */
    gates: [{to: 'home', px: ADV_SNOW.gate.px, pz: ADV_SNOW.gate.pz}],
    livestock: 'none',
  },
  {
    id: 'swamp', name: '青苔沼泽', hud: '🌿 青苔沼泽',
    palette: {/* 沼泽草绿/垂藤暗绿/灰绿水/灰蒙天(§2.1, 草色 MC #4c763c 口径) */
      ground: [0.30, 0.46, 0.24], flora: [0.16, 0.36, 0.16],
      water: [0.35, 0.48, 0.42], sky: [0.62, 0.66, 0.64],
    },
    build: advSwampBuild,
    nests: ADV_SWAMP.nests,
    nightPool: [['bogged', 2], ['zombie', 1], ['slime', 1]], /* 沼骸主角+史莱姆夜池 */
    gates: [{to: 'home', px: ADV_SWAMP.gate.px, pz: ADV_SWAMP.gate.pz}],
    livestock: 'none',
    witchHut: {x: ADV_SWAMP.hut.x, z: ADV_SWAMP.hut.z}, /* 女巫小屋常驻标记(T6 壳 spawn 消费) */
  },
];

/* ============================================================
   政策纯函数段 — 切图时序的判定核心(设计稿 §4), 依赖全注入
   ============================================================ */

/* 门解锁的任务档 counts 键(§10 拍板③: 解锁账进任务档, 与任务成就同源;
   点亮仪式/解锁链 home→desert→snow→swamp 归 T8) */
const ADV_UNLOCK_KEYS = {desert: 'unlockedDesert', snow: 'unlockedSnow', swamp: 'unlockedSwamp'};

/* 门解锁判定: home 恒开(出生图); 远征图看任务档 counts 键真值
   (T8 点亮仪式置 1; 缺键/0/undefined = 门面熄灭+锁定话术) */
function advMapUnlocked(mapId, counts) {
  if (mapId === 'home') return true;
  const k = ADV_UNLOCK_KEYS[mapId];
  return !!(k && counts && counts[k]);
}

/* 结构宝箱坐标 → 探宝型任务计数键(T8): 三座结构的建场宝箱各记一键
   (chest_temple/chest_igloo/chest_witch), 图+坐标双重判定(坐标与建场函数
   同源常量)——他图同坐标/玩家自放的箱子/结构邻格返 null(防「带箱远征」
   与「挖坑埋箱冒名」的 cheese, 探宝要探真结构) */
function advMapChestKey(mapId, x, y, z) {
  if (mapId === 'desert' && x === ADV_DESERT.temple.cx && y === 20 && z === ADV_DESERT.temple.cz) {
    return 'chest_temple';
  }
  if (mapId === 'snow' && x === ADV_SNOW.hut.cx && y === 20 && z === ADV_SNOW.hut.cz) {
    return 'chest_igloo';
  }
  if (mapId === 'swamp' && x === ADV_SWAMP.hut.x && y === ADV_GROUND + 4 && z === ADV_SWAMP.hut.z) {
    return 'chest_witch';
  }
  return null;
}

const ADV_GATE_HOLD_T = 2; /* 门面站桩秒数(§4.1: MC 4s 减半防幼儿失耐心, 全程可反悔) */

/* 站桩步进(advNestStep/advNightStep 同构: 状态进 → {t, fire} 出):
   s 为秒累计, inGate 为本帧是否在门面内(advInPortal 判定, 壳喂),
   dt 为帧间隔。走出门面即刻归零(可反悔, MC 下界门口径); 站满 2s 发
   传送令并归零(遮罩与冷却归壳层, 冷却复用 ADV_PORTAL.cd) */
function advGateHoldStep(s, inGate, dt) {
  if (!inGate) return {t: 0, fire: false};
  const nt = s + dt;
  if (nt < ADV_GATE_HOLD_T) return {t: nt, fire: false};
  return {t: 0, fire: true};
}

/* 指定门位的到达落点(advPortalExit 同口径的泛化): 站进绑定 g.to 图的门后,
    落在 g 这扇门自身内侧 2.5 格、面朝外——门阵多门时回程落点跟着来时的门走
    (沙漠门进沙漠门出, §2.3「落地就在门跟前, 门在身后」)。虚拟玩家从门面
    朝 -z 进门(yaw=π), 出口=沿来向退 2.5 格(门南侧)+yaw 反向(朝 +z 背对门);
    y 取基准地表上方(门位压平区, 建场保证 y24 顶面) */
function advMapArriveAt(g) {
  const p = advPortalExit(g.px + 2.5, ADV_GROUND + 1, g.pz + 0.5, Math.PI);
  p.yaw = p.yaw % (Math.PI * 2); /* π+π=2π 归一 0: 与朝向等价, 免壳层拿到裸 6.28 */
  return p;
}

/* 到达落点(行便捷版): 取 gates[0]——远征图单门=回程门, 与泛化版恒等;
    home 多门场景请用 advMapArriveAt(对应门), 各门落点不同 */
function advMapArrive(row) {
  return advMapArriveAt(row.gates[0]); /* 远征图单门=回程门 */
}

/* 死亡回家计划(§10 拍板②, nether 合并 D11 回家口径的地图行化):
   无论死在哪张图, 满血+回 home 门口(ADV_SPAWN 出生账本)+背包保留;
   map 字段告诉壳切回 home(已在 home 则无操作)。零惩罚哲学与
   advDeathPlan 同源 */
function advMapDeathPlan(mapId, player) {
  return Object.assign(advDeathPlan(player, ADV_SPAWN), {map: 'home'});
}

/* ---------- 神殿可疑地板(审查修复 P1): 踩塌入口的判定与格清单 ----------
   建场只铺「中央 2×2 沙面 + 下层砂岩顶盖」(advDesertTemple), 运行时
   踩塌机制在壳层——本段提供纯判定, 壳消费(踩上→8 格清空+记账+音效)。
   幂等口径: 塌后脚下不再是沙, 判据天然不复发; edits 记账保证重进不复位。 */
function advTempleTrapOn(x, z) {/* 玩家所站格是否落进可疑地板 footprint(中央 2×2) */
  const t = ADV_DESERT.temple;
  return x >= t.cx - 1 && x <= t.cx && z >= t.cz - 1 && z <= t.cz;
}
function advTempleTrapCells() {/* 踩塌时清空的格清单: 中央 2×2 砂岩地板共 4 格
    (单层——正下方 y22~23 已是竖井空腔, 掏掉地板即坠入宝箱室, 落在室地板
    y17 上, 无摔落伤害=坠落限速口径) */
  const t = ADV_DESERT.temple;
  const cells = [];
  for (let x = t.cx - 1; x <= t.cx; x++) {
    for (let z = t.cz - 1; z <= t.cz; z++) cells.push({x, y: t.trapY, z});
  }
  return cells;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {ADV_MAPS, ADV_DESERT, ADV_SNOW, ADV_SWAMP,
    advDesertBuild, advDesertTerrain, advDesertTemple, advDesertPlants,
    advSnowBuild, advSnowTerrain, advSnowTree, advSnowHut, advSnowScatter,
    advSwampBuild, advSwampTerrain, advSwampHut, advSwampScatter, advMapNest,
    ADV_UNLOCK_KEYS, advMapUnlocked, ADV_GATE_HOLD_T, advGateHoldStep, advMapChestKey,
    advMapArriveAt, advMapArrive, advMapDeathPlan, advTempleTrapOn, advTempleTrapCells};
}
