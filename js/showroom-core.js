'use strict';
/* ============================================================
   体验馆供给核心 (ShowroomCore, 术语见 GLOSSARY.md「体验馆」) — 应用层·纯核心
   ------------------------------------------------------------
   冒险全开实验室(showroom v2)的供给派生器 + U3 的「世界即存档」三件套
   (ADR 0005 票表, docs/adventure-shell-unification-design.md §3/§5):
   · 三份物资派生(单一设计约束=「派生不复制」, docs/showroom-design.md
     §7 D3): 一切内容从权威注册表(ITEMS/RECIPES/SMELTS/FUEL)按字段规则
     派生, 冒险模式新增物品/配方时体验馆零改动自动同步——手抄清单是同步
     漂移的根源, 本文件存在的意义就是让手抄清单消失。
     - showroomPocket(): 背包套餐 = RECIPES 全配方 shapeCost 材料并集
       (候选展开), 每 id 一行 n=stackMax; 超 INV_SLOTS 预算的尾部行溢出
       进 overflow(由消费方并入「套餐补箱」)。同步不变量: 从套餐出发每条
       配方 canCraft(inv, r, true) 全绿(test/showroom-core.test.js 守门)。
     - showroomCrateRows(): 仓库箱 = ITEMS 字段驱动五桶的首中归桶划分:
       工具·耗损(tool‖dur) → 食物(food) → 烧炼·燃料(SMELTS∪fuel) →
       方块·功能(block) → 材料杂物(兜底); 桶内按注册序, 桶满 INV_SLOTS 行
       自动「·续」箱, 空桶不建; 套餐溢出行(若有)并入为首只「套餐补箱」。
     - showroomDisplays(excludeBlockIds): 展台展品 = 有 block 字段的物品
       (注册序), 排除站点件(消费方传入站点方块 id 清单——「哪些方块是
       可交互站点」是模式层政策, 不在核心硬编码)。
   · 展馆布局常量 SHOWROOM(U3 自模式文件迁入, 本文件是唯一语义源——
     模式文件与展馆账本派生两处消费同参): groundY 12 是 v2 独立世界的
     地平; dev 档在家营重放时经 showroomDevLayout() 平移到 ADV_GROUND。
   · 展馆 edits 账本派生(「世界即存档」核心): 把「home 图上建展馆」表达为
     对 home 基座的逐格差异账本(键 "x,y,z"→裸方块 id, 与世界改动日志的
     edits 值形状一致)。路线=仿真 diff(钉死): 基座建场快照 vs 基座+展馆
     绘制快照, 逐格 diff——保证「重放后=目标态」而不需要解析式重算地形
     (home 有起伏/树/水, 重算地形等于复制建场逻辑)。绘制函数
     showroomPaint* 族 = v2 建场族语义的地平参数化版(v2 字面 y 值全部
     化为 groundY 偏移, groundY=12 时逐字节等价); 模式文件里的 v2 建场
     族待 U4 统一切换时随镜像编排段一起退役。
   · 篡改档 payload + dev store 工厂(全内存, 零真实读写): mkShowroomStore()
     返回与冒险壳存档缝同形可整体换装的 store——load=喂篡改 payload
     (全解锁任务档/顶格预填宝箱档/房内出生世界档), 落盘面全 noop(丢弃
     一切), mark 正常(edits 活在内存账本里)。U3 只出不接线, U4 消费。
   interface: SHOWROOM · showroomPocket · showroomCrateRows ·
     showroomDisplays · showroomCrateStock · showroomDisplayBlocks ·
     showroomDevLayout · showroomFlatRegion · showroomPaintFlat/
     PaintHouse/PaintHall/PaintBasement/PaintSite · showroomWorldEditsCompute
     (纯计算面, 每次重算) · showroomWorldEdits(缓存面, 惰性一次算定) ·
     showroomSceneKeys/SceneEnvelope · showroomWorldPayload/QuestPayload/
     ChestPayload · showroomDevBag(inv?) · mkShowroomStore(bag?)(inv/bag 可注入:
     U4 门面把壳的真档 inv 包进 dev bag——壳闭包绑定不脱钩)
   依赖(均经全局名, 调用期解析): js/items-core.js 的 ITEMS/stackMax/durOf ·
     js/craft-core.js 的 RECIPES/SMELTS/FUEL/shapeCost · js/inventory-core.js
     的 INV_SLOTS/mkInventory/add · js/config.js 的 B_* 方块常数与
     WORLD_H(加载序: 四件在本文件之前) · js/voxel.js 的 world/setBlockRaw/
     getBlock(仅展馆账本派生调用期使用——清场+快照, 模块加载期禁跑仿真) ·
     js/scene-kit.js 的 SceneKit · js/adventure-core.js 的 ADV_GROUND/
     ADV_QUESTS/ADV_QUEST_TITLE/ADV_CHEST_SLOTS/advChestPut/advBuildWorld ·
     js/adventure-maps-core.js 的 ADV_MAPS/ADV_UNLOCK_KEYS ·
     js/world-journal-core.js 的 mkWorldJournal(后四件加载序在本文件之前,
     均经惰性调用面消费, 缺席环境只测纯派生不受影响)
   可测性: 零 THREE·零 DOM·有单测(test/showroom-core.test.js 纯派生面 +
     test/showroom-mode.test.js 世界仿真/重放同构面, vm 直测); 派生惰性
     (首次调用算一次缓存——仿真独占全局世界, 只准进场装配期/测试触发)
   ============================================================ */

/* ---------- 场地常数: 展馆布局(§7 D4, 全部几何数据驱动; U3 迁自模式文件, 值零改动) ---------- */
const SHOWROOM = {
  groundY: 12, // 草地顶层(站立面 y=13)——v2 独立世界的地平; 家营重放经 showroomDevLayout 平移
  spawn: {x: 64.5, z: 60.5, yaw: 0}, // 房内中央过道出生, 面朝 -Z(展台区)
  house: {x1: 48, z1: 44, x2: 79, z2: 75}, // 32×32 木构展厅(墙 y g+1..g+4+顶 y g+5)
  door: {x: 63, z: 75}, // 南门(1 格宽 2 格高, 门板成对在场)
  spawnFurnace: {x: 64, z: 62}, // 出生点正后方 1.5 格: 零走动即测熔炉
  kitchen: [{x: 72, z: 46}, {x: 74, z: 46}], // 北墙灶台角: 双炉
  craftTables: [{x: 52, z: 46}, {x: 54, z: 46}], // 北墙工作台×2
  bed: {x: 77, z: 73}, // 东南角床(票 C 睡觉链: 夜窗+床边无怪即可睡, 无床边出生点)
  crateX: 50, crateZ0: 50, crateStep: 2, crateMax: 8, // 西墙仓库箱排(箱数=派生长度, 锚位自动排)
  tables: [[55, 52], [55, 58], [55, 64], [69, 52], [69, 58], [69, 64]], // 展台 2×2 台身(木板), 顶面摆展品
  basement: {x1: 50, z1: 46, x2: 77, z2: 73}, // 地下室石壳(顶 y g-1=房内地基, 腔 y g-4..g-2, 地面 y g-5)
  stairs: {x1: 75, x2: 76, z1: 67, z2: 71}, // 楼梯井(东墙侧, 1 格台阶降/跳)
  ores: [], // 地下室矿石样本墙(建场段填 B_* 样本, 见 showroomPaintBasement)
  /* 整地圈(U3): footprint 外扩格数, 数据驱动——北/西/东 2 防房子半埋进丘体(家营中环
      幅度 ±2); 南 0 = 屋南紧贴圆石小径两行(z76..77)与门阵广场, 一格不铲(小径是
      门口↔广场的动线)。圈=展馆账本条目的界(派生条目全部落在圈内, 单测锁) */
  flatPad: {n: 2, w: 2, e: 2, s: 0},
  /* 夜怪固定铺点(票 C): 入夜上沿各铺 1 只 — 屋外草场(不在展厅屋顶, Risk③ 绕法)、
      离床心 (77.5,73.5) ≥ ADV_BED_MOB_R+余量(最近 15 格)、避开站点/门/展台/ TNT 东场 */
  nightMobs: [
    {x: 84, z: 60, type: 'zombie'}, // 东墙外草场(离床 ≈15)
    {x: 84, z: 48, type: 'spider'}, // 东北角草场(离床 ≈26)
    {x: 40, z: 60, type: 'creeper'}, // 西墙外草场(离床 ≈40)
  ],
};

/* ---------- 背包套餐: RECIPES 全配方材料并集 ----------
   「所有条件都满足」的最小充分集: 揣着这包, 冒险里任何配方都能当场合成
   (站点门禁在体验馆面板恒开, 不需材料以外的条件)。遍历按配方登记序
   (稳定且与配方书同序), 候选数组(煤/木炭任选等)逐个展开; 每 id 一行
   n=stackMax(材料 64/可耗损 1, 一行一槽与旧表同形)。 */
function showroomPocket() {
  const seen = new Set();
  const ids = [];
  for (const recipe of RECIPES) {
    for (const [key, val] of Object.entries(shapeCost(recipe))) {
      const e = costEntry(key, val); /* 候选数组+数量(inventory-core 统一形状, canCraft 同款解读) */
      if (!e) continue;
      for (const id of e.cands) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
  }
  const rows = ids.map((id) => ({id, n: stackMax(id)}));
  return {rows: rows.slice(0, INV_SLOTS), overflow: rows.slice(INV_SLOTS)};
}

/* ---------- 仓库箱: ITEMS 字段驱动五桶 ----------
   归桶判据只读注册字段, 不抄物品 id 清单——新物品按它注册时声明的字段
   自动落箱(全无字段落兜底杂物箱), 冒险加物品本函数零改动。桶序即优先级
   (两性物按首个命中桶归单, 保证五桶是全集划分): 原木可烧可放 → 烧炼·燃料
   箱(烧炼对照样摆一起正是它的展陈语义); 生肉可吃可烧 → 食物箱。 */
function showroomCrateRows(pocketOverflow) {
  const isSmeltSide = (id) => typeof SMELTS[id] === 'string' ||
    Object.values(SMELTS).indexOf(id) >= 0;
  const buckets = [
    {title: '工具·耗损箱', match: (it, id) => isTool(id) || durOf(id) > 0},
    {title: '食物箱', match: (it) => typeof it.food === 'number'},
    {title: '烧炼·燃料箱', match: (it, id) => isSmeltSide(id) || typeof it.fuel === 'number'},
    {title: '方块·功能箱', match: (it) => typeof it.block === 'number'},
    {title: '材料杂物箱', match: () => true}, /* 兜底桶恒命中: 划分的封闭性由它保证 */
  ];
  const hits = buckets.map(() => []);
  for (const id of Object.keys(ITEMS)) {
    const it = ITEMS[id];
    for (let b = 0; b < buckets.length; b++) {
      if (buckets[b].match(it, id)) {
        hits[b].push({id, n: stackMax(id)});
        break; /* 首中归单: 一物一箱(划分不变量) */
      }
    }
  }
  const crates = [];
  if (pocketOverflow && pocketOverflow.length) {
    crates.push({title: '套餐补箱', rows: pocketOverflow});
  }
  for (let b = 0; b < buckets.length; b++) {
    for (let i = 0; i < hits[b].length; i += INV_SLOTS) {
      const more = i + INV_SLOTS < hits[b].length || i > 0; /* 续箱(或被续)挂后缀 */
      crates.push({title: buckets[b].title + (more ? '·续' : ''), rows: hits[b].slice(i, i + INV_SLOTS)});
    }
  }
  return crates;
}

/* ---------- 展台展品: 可放置方块各摆一份 ----------
   excludeBlockIds = 站点方块 id 清单(工作台/熔炉/箱子/床——它们作为真
   站点装在场内, 不上展台重复陈列); 返回物品 id 数组(注册序, 消费方经
   ITEMS[id].block 取放置方块号)。 */
function showroomDisplays(excludeBlockIds) {
  const skip = excludeBlockIds || [];
  return Object.keys(ITEMS).filter((id) => {
    const b = ITEMS[id].block;
    return typeof b === 'number' && skip.indexOf(b) < 0;
  });
}

/* ============================================================
   展馆绘制语义源(U3) — v2 建场族的纯绘制函数版, 输入布局常量
   ------------------------------------------------------------
   与 js/modes/showroom.js 的 showroomBuild 族同语义: v2 字面 y 值
   (墙 13..16/窗 14/顶 17/地下室 6..11/楼梯底 8)全部化为 groundY 偏移,
   groundY=12 时逐字节等价; 差异只有整地是区域化的一圈(圈外地形保持
   基座原样, 「玩家平整过地面再建房」的存档语义)。仅经 setBlockRaw/
   SceneKit 写世界, 零 THREE 零 DOM, Node 可跑。
   ============================================================ */

function showroomCrateStock() {/* 仓库箱派生清单(模式装配与展馆绘制同源一份): 套餐溢出并入五桶 */
  return showroomCrateRows(showroomPocket().overflow);
}

function showroomDisplayBlocks() {/* 展台展品方块号清单(注册序): 展品排除站点四件(它们作为真站点装在场内)与
    need 旗标方块(树叶——失依即落, 壳 init 的 P14 世界卫生清扫每场都会把它从台面
    静默收走, 陈了等于空位; U4 遗留观察①收口。thin 依附块(火把/树苗)在木板台面
    有底座可依附, 存活不排除) */
  return showroomDisplays([B_CRAFT, B_FURNACE, B_CHEST, B_BED])
      .map((id) => ITEMS[id].block)
      .filter((b) => !(BLOCKS[b] && BLOCKS[b].need));
}

function showroomDevLayout() {/* dev 档布局 = SHOWROOM 坐标不动(x/z 与 v2 语义源/既有测试同参——选址压界
    三处已登记, 见 test/showroom-mode.test.js 选址核查), 地平 12 → 家营地平 ADV_GROUND */
  return Object.assign({}, SHOWROOM, {groundY: ADV_GROUND});
}

function showroomFlatRegion(L) {/* 整地圈(footprint 外扩, 数据驱动 SHOWROOM.flatPad): 展馆账本条目的界 */
  const p = L.flatPad;
  const h = L.house;
  return {x1: h.x1 - p.w, z1: h.z1 - p.n, x2: h.x2 + p.e, z2: h.z2 + p.s};
}

function showroomPaintTorch(points, y) {/* 火把插点 helper: 地面一层 thin 火把(光归装场全量点亮) */
  for (const p of points) setBlockRaw(p[0], y, p[1], B_TORCH);
}

function showroomPaintFlat(L, R) {/* 整地(v2 全幅平地的区域化): 列清至展馆地平——地平以上全空, 下垫两层泥, 表层草皮 */
  const g = L.groundY;
  SceneKit.fill(R.x1, g + 1, R.z1, R.x2, WORLD_H - 1, R.z2, 0);
  SceneKit.fill(R.x1, g - 2, R.z1, R.x2, g - 1, R.z2, 2);
  SceneKit.fill(R.x1, g, R.z1, R.x2, g, R.z2, 1);
}

function showroomPaintHouse(L, crateCount) {/* 展厅(v2 showroomHouse 语义): 地板/四墙/窗/南门/木板顶/站点件/仓库箱排/室内火把 */
  const h = L.house;
  const g = L.groundY;
  const top = g + 4;
  SceneKit.fill(h.x1, g, h.z1, h.x2, g, h.z2, 6); // 木板地板(覆草皮)
  /* 四墙(实心 y g+1..g+4), 再开门洞与玻璃板窗 */
  SceneKit.fill(h.x1, g + 1, h.z1, h.x2, top, h.z1, 6);
  SceneKit.fill(h.x1, g + 1, h.z2, h.x2, top, h.z2, 6);
  SceneKit.fill(h.x1, g + 1, h.z1, h.x1, top, h.z2, 6);
  SceneKit.fill(h.x2, g + 1, h.z1, h.x2, top, h.z2, 6);
  for (const x of [54, 60, 68, 74]) { // 南北墙窗(y g+2 单排玻璃板)
    setBlockRaw(x, g + 2, h.z1, B_GLASS_PANE);
    if (x !== L.door.x) setBlockRaw(x, g + 2, h.z2, B_GLASS_PANE);
  }
  for (const z of [54, 60, 68]) { // 东西墙窗
    setBlockRaw(h.x1, g + 2, z, B_GLASS_PANE);
    setBlockRaw(h.x2, g + 2, z, B_GLASS_PANE);
  }
  const d = L.door; // 南门: 门洞 + 门板成对(关态在场, 开关链待放置票)
  setBlockRaw(d.x, g + 1, d.z, 0);
  setBlockRaw(d.x, g + 2, d.z, 0);
  setBlockRaw(d.x, g + 1, d.z, B_DOOR);
  setBlockRaw(d.x, g + 2, d.z, B_DOOR_TOP);
  SceneKit.fill(h.x1, top + 1, h.z1, h.x2, top + 1, h.z2, 6); // 木板顶(y g+5)
  /* 站点件: 即测炉(出生圈) + 灶台角双炉 + 工作台×2 + 床 */
  SceneKit.fill(L.spawnFurnace.x, g + 1, L.spawnFurnace.z,
      L.spawnFurnace.x, g + 1, L.spawnFurnace.z, B_FURNACE);
  for (const f of L.kitchen) setBlockRaw(f.x, g + 1, f.z, B_FURNACE);
  for (const c of L.craftTables) setBlockRaw(c.x, g + 1, c.z, B_CRAFT);
  setBlockRaw(L.bed.x, g + 1, L.bed.z, B_BED);
  /* 仓库箱排: 箱数=仓库箱派生长度(≤crateMax, 守门测试拦超出) */
  for (let i = 0; i < crateCount; i++) {
    setBlockRaw(L.crateX, g + 1, L.crateZ0 + i * L.crateStep, B_CHEST);
  }
  /* 火把插满: 室内四面墙+中央过道(地面一层) */
  showroomPaintTorch([[50, 45], [58, 45], [66, 45], [74, 45], [50, 74], [58, 74],
    [66, 74], [74, 74], [49, 50], [49, 58], [49, 66], [78, 50], [78, 58],
    [78, 66], [62, 56], [66, 64]], g + 1);
}

function showroomPaintHall(L, displayBlocks) {/* 中央展台(v2 showroomHall 语义): 2×2 木板台身, 顶面照清单各摆一份展品 */
  let k = 0;
  for (const [tx, tz] of L.tables) {
    SceneKit.fill(tx, L.groundY + 1, tz, tx + 1, L.groundY + 1, tz + 1, 6);
    for (let dx = 0; dx <= 1; dx++) {
      for (let dz = 0; dz <= 1; dz++) {
        if (k < displayBlocks.length) {
          setBlockRaw(tx + dx, L.groundY + 2, tz + dz, displayBlocks[k]);
          k++;
        }
      }
    }
  }
}

function showroomPaintBasement(L) {/* 地下室(v2 showroomBasement 语义, 石壳底/内腔/矿样墙/楼梯井随 g 平移) */
  const b = L.basement;
  const s = L.stairs;
  const g = L.groundY;
  SceneKit.fill(b.x1, g - 6, b.z1, b.x2, g - 1, b.z2, 4); // 石壳整体(cobble, 底 y g-6)
  SceneKit.fill(b.x1 + 1, g - 4, b.z1 + 1, b.x2 - 1, g - 2, b.z2 - 1, 0); // 掏空内腔(地面 y g-5 顶, 高 3)
  /* 矿石样本墙(北壁内面, 站立面高度): 五种矿物各一格 */
  const ores = [B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY];
  for (let i = 0; i < ores.length; i++) setBlockRaw(b.x1 + 2 + i, g - 4, b.z1 + 1, ores[i]);
  /* 楼梯井: 五级 1 格台阶(降=走落, 升=跳跃), 顶通房内地面 */
  for (let i = 0; i <= 4; i++) {
    SceneKit.fill(s.x1, Math.max(g - 4, g - i), s.z2 - i, s.x2, g, s.z2 - i, 0);
  }
  /* 踏步回填: 内腔掏空吃掉了壳层, 三级踏步显式落位(每级降 1 格, 站位 2 格净空) */
  SceneKit.fill(s.x1, g - 2, s.z2 - 1, s.x2, g - 2, s.z2 - 1, 4);
  SceneKit.fill(s.x1, g - 3, s.z2 - 2, s.x2, g - 3, s.z2 - 2, 4);
  SceneKit.fill(s.x1, g - 4, s.z2 - 3, s.x2, g - 4, s.z2 - 3, 4);
  /* 地下室火把插满: 内腔周界 + 井口侧壁照明(不占楼梯通道格) */
  showroomPaintTorch([[60, 47], [68, 47], [52, 72], [60, 72], [68, 72],
    [51, 52], [51, 60], [51, 68], [76, 52], [76, 60], [76, 68],
    [s.x1 - 1, s.z1]], g - 4);
}

function showroomPaintSite(L) {/* 展馆绘制总装(= v2 showroomBuild 语义的目标态): 整地一圈 → 展厅 → 展台 → 地下室。
    只动整地圈内的世界(圈外基座原样), 输入布局常量——账本派生与单测重放同构共用本入口 */
  showroomPaintFlat(L, showroomFlatRegion(L));
  showroomPaintHouse(L, Math.min(showroomCrateStock().length, L.crateMax));
  showroomPaintHall(L, showroomDisplayBlocks());
  showroomPaintBasement(L);
}

/* ============================================================
   展馆 edits 账本派生(U3「世界即存档」) — 仿真 diff, 钉死路线
   ------------------------------------------------------------
   三步: ①清世界跑 home 基座建场(advBuildWorld, 确定性)快照整地圈为
   基座态; ②清世界跑基座 + 展馆绘制(showroomPaintSite)快照同区域为
   目标态; ③逐格 diff, 差异格即 edits 条目——edits 语义=逐格最后写赢
   的绝对值, 重放(基座→逐格覆写)后必等于目标态, 不需要理解基座。
   目标态是「基座 + 玩家整地/建房」的 overlay 而非清世界独立重建:
   独立重建会把整地圈下掏到基岩(重放后地面悬空, 装场清扫会拆馆),
   玩家语义也从未如此; 圈下未触及的格基座=目标态, diff 天然为零。
   条目全裸值(圈不压水面, 无流体格); 确定性=基座建场零随机 +
   绘制零随机 + 快照遍历定序。仿真独占全局世界(清场两次), 只准
   进场装配期/测试调用, 模块加载期禁跑; 算完全清场(不接手脏世界)。
   ============================================================ */

let showroomEditsCache = null; /* 展馆账本惰性缓存(首次调用算一次; 顶层 let=装配期独占写) */

function showroomWorldEditsCompute() {/* 纯计算面: 每次重跑仿真(测试锁「两次派生逐字节一致」用); 返回 [["x,y,z", id], …] */
  const L = showroomDevLayout();
  const R = showroomFlatRegion(L);
  const xw = R.x2 - R.x1 + 1;
  const zw = R.z2 - R.z1 + 1;
  const snap = () => {/* 整地圈全高快照(列优先定序): 逐格 getBlock, 与 worldCells 同布局 */
    const out = new Uint8Array(xw * zw * WORLD_H);
    let i = 0;
    for (let x = R.x1; x <= R.x2; x++) {
      for (let z = R.z1; z <= R.z2; z++) {
        for (let y = 0; y < WORLD_H; y++) out[i++] = getBlock(x, y, z);
      }
    }
    return out;
  };
  world.clear();
  advBuildWorld(); /* ① 基座态: home 建场总装(= ADV_MAPS home 行的 build; ADV_HOME_ROW 只带池数据不带 build) */
  const base = snap();
  world.clear();
  advBuildWorld(); /* ② 目标态: 基座 + 展馆绘制 overlay(v2 语义: 整地一圈+展厅+展台+地下室) */
  showroomPaintSite(L);
  const target = snap();
  world.clear(); /* 仿真收尾: 世界清空(装配期随后建场重放, 不接手脏世界) */
  /* ③ 逐格 diff: 差异格即账本条目(值=目标态绝对值, 重放后写赢基座) */
  const entries = [];
  let i = 0;
  for (let x = R.x1; x <= R.x2; x++) {
    for (let z = R.z1; z <= R.z2; z++) {
      for (let y = 0; y < WORLD_H; y++) {
        if (base[i] !== target[i]) entries.push([x + ',' + y + ',' + z, target[i]]);
        i++;
      }
    }
  }
  return entries;
}

function showroomWorldEdits() {/* 缓存面(装配入口): 首次调用算一次, 之后同实例——两次建场仿真只在装配期付一次账 */
  if (!showroomEditsCache) showroomEditsCache = showroomWorldEditsCompute();
  return showroomEditsCache;
}

/* ============================================================
   篡改档 payload(U3) — 全解锁/全顶格/房内出生, 全内存零真实读写
   ------------------------------------------------------------
   形状口径 = 冒险壳读档侧 decode 的输入形状(decode 吃什么就供什么):
   世界档 edits 五桶(数组条目)/furnaces 对数组/livestock 分桶数组;
   init 的桶归一对数组/双桶形状幂等。任务档四键(step/counts/firstNight/
   title)与壳内存档视图同形。宝箱档 {size, slots} 满长槽数组(顶格+预填)。
   ============================================================ */

function showroomSceneKeys() {/* 分桶键全集: 地图注册表派生(ADV_MAPS 同款口径); 无注册表环境回落固定五桶 */
  return (typeof ADV_MAPS !== 'undefined') ?
    ADV_MAPS.map((r) => r.id).concat(['nether']) : ['home', 'desert', 'snow', 'swamp', 'nether'];
}

function showroomEmptyBuckets() {/* 五桶空账本(edits/livestock 共用的桶形): 键集随注册表, 只增不减 */
  const out = {};
  for (const k of showroomSceneKeys()) out[k] = [];
  return out;
}

function showroomSceneEnvelope(homeEntries) {/* 条目 → 桶形档: home=展馆账本条目数组(键值对数组), 其余桶空数组 */
  const out = showroomEmptyBuckets();
  for (const e of homeEntries || []) out.home.push([e[0], e[1]]);
  return out;
}

function showroomWorldPayload(entries) {/* 世界档篡改 payload: 展馆账本进 home 桶 · map=home · pos=房内出生
    (地平+1, 与 v2 出生位同点) · hp=满血(冒险玩家 30/30 口径) · 炉空 · 五桶死畜空账 · 清晨。
    entries 可注入(纯形状测试面); 缺省=展馆账本缓存面(要跑世界仿真) */
  const L = showroomDevLayout();
  return {edits: showroomSceneEnvelope(entries || showroomWorldEdits()),
    map: 'home',
    pos: {x: SHOWROOM.spawn.x, y: L.groundY + 1, z: SHOWROOM.spawn.z, yaw: SHOWROOM.spawn.yaw},
    hp: 30,
    furnaces: [],
    livestock: showroomEmptyBuckets(),
    dayTime: 0};
}

function showroomQuestPayload() {/* 任务档篡改 payload: 表外步=终章+远征章全完成的自由探险态 · 门解锁键全置 1
    (三扇门全亮, 键名从 ADV_UNLOCK_KEYS 派生不手抄) · 首夜教学已给(不重教) · 终章称号在档 */
  const counts = {};
  for (const mapId of Object.keys(ADV_UNLOCK_KEYS)) counts[ADV_UNLOCK_KEYS[mapId]] = 1;
  return {step: ADV_QUESTS.length, counts, firstNight: true, title: ADV_QUEST_TITLE};
}

function showroomChestPayload() {/* 宝箱档篡改 payload: 基础格顶格 27 档 + 仓库箱派生清单逐行灌入(整摞入箱政策纯函数,
    装不下的余量自然截断); {size, slots} 形状=壳 init 归一化的输入——size 字段语义=材料阶梯
    基础格(ADR 0007); 总容量由壳 init 从展馆账本现算, 陈列仓库箱与冒险同口径逐只计入 */
  const acct = {size: ADV_CHEST_SLOTS, slots: new Array(ADV_CHEST_SLOTS).fill(null)};
  for (const crate of showroomCrateStock()) {
    for (const row of crate.rows) advChestPut(acct, {id: row.id, n: row.n});
  }
  return acct;
}

function showroomDevBag(inv) {/* 背包供给(内存实例): {inv, load=照套餐原地重铸, save=丢弃}——与背包壳同供给
    形态, 引用跨进场稳定, 内容每次进场原地清空重铸(面板族闭包不脱钩)。
    inv 可注入(U4 门面消费): 冒险壳的 kit/面板在加载期捕获真档背包的 inv 对象
    引用, 换 bag 不重绑闭包——门面把壳的真档 advStore.bag.inv 注入进来, dev
    bag 包同一对象(身份永不变、内容随 load 换), 壳的全部闭包自动对准 dev 内容 */
  const own = inv || mkInventory();
  return {inv: own,
    load() {
      own.slots.fill(null);
      for (const row of showroomPocket().rows) add(own, row.id, row.n);
      return own;
    },
    save() {}};
}

/* ============================================================
   dev store 工厂(U3, 不接线) — 与冒险壳存档缝同形可整体换装
   ------------------------------------------------------------
   mkShowroomStore() 返回与真档 adapter(冒险壳 advStore)同形的 store:
   槽供给(worldSlot/questSlot/chestSlot=内存槽, bag=内存背包, journal=
   内存槽喂进同一个 mkWorldJournal 工厂——不为 journal 造第二实现) +
   语义面(load=喂篡改 payload; mark 正常=edits 活在内存账本, 切图换桶/
   重进重放的账本面照常工作; touch/flush/tick/pageHide 与三份 saveX
   落盘全 noop——丢弃一切, 脏标不清即是未走真落盘链路的可观察证据)。
   U4 把冒险壳的存档缝整体换装成本工厂产物, 编排零改动。
   ============================================================ */

function mkShowroomStore(bag) {/* bag 可注入(U4 门面消费: 包壳真档 inv 的 dev bag, 见 showroomDevBag);
    缺省自建内存背包(U3 形状) */
  const worldSlot = {load: () => showroomWorldPayload(), save: () => {}}; /* 内存槽: load=篡改档, save=丢弃 */
  const questSlot = {load: () => showroomQuestPayload(), save: () => {}};
  const chestSlot = {load: () => showroomChestPayload(), save: () => {}};
  const store = {
    /* —— 槽供给(四份档; 换装点=整体替换冒险壳真档装配) —— */
    worldSlot,
    questSlot,
    chestSlot,
    bag: bag || showroomDevBag(),
    /* 世界档记账: 内存槽喂同一工厂(范本缝), 联写经本面 noop——三档联写的丢弃版 */
    journal: null,
    /* —— 世界档持久化语义面(load=喂篡改 payload; 落盘决策点全 noop) —— */
    load() {
      return store.journal.load();
    },
    mark(k, v) {
      store.journal.mark(k, v); /* 正常记账: edits 活在内存账本(重进/切图重放消费) */
    },
    touch() {}, /* 置脏只为落盘服务, 丢弃式 store 无盘可落 */
    flush() {
      return true; /* 无事可落=恒成功(真档语义的丢弃版) */
    },
    tick() {
      return false; /* 节流泵恒不触发落盘 */
    },
    pageHide() {}, /* 关页兜底 noop: 退出无痕 */
    /* —— 三份伴生档语义面(save 全丢弃, load 恒喂篡改 payload) —— */
    loadQuest() {
      return questSlot.load();
    },
    saveQuest() {},
    loadChest() {
      return chestSlot.load();
    },
    saveChest() {},
    loadBag() {
      return store.bag.load();
    },
    saveBag() {},
  };
  store.journal = mkWorldJournal(worldSlot, {/* payload=桶形封套(真档世界档同形; 落盘面 noop, 此钩仅保形 */
    payload: (edits) => ({edits: showroomSceneEnvelope([...edits.entries()]),
      map: 'home', pos: null, hp: null, furnaces: [],
      livestock: showroomEmptyBuckets(), dayTime: 0}),
    onFlush: () => {
      store.saveBag(); /* 联写走本面(全 noop)——真档三档联写的丢弃版 */
      store.saveQuest();
    },
  });
  return store;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {SHOWROOM, showroomPocket, showroomCrateRows, showroomDisplays,
    showroomCrateStock, showroomDisplayBlocks, showroomDevLayout, showroomFlatRegion,
    showroomPaintFlat, showroomPaintHouse, showroomPaintHall, showroomPaintBasement,
    showroomPaintSite, showroomWorldEditsCompute, showroomWorldEdits, showroomSceneKeys,
    showroomSceneEnvelope, showroomWorldPayload, showroomQuestPayload, showroomChestPayload,
    showroomDevBag, mkShowroomStore};
}
