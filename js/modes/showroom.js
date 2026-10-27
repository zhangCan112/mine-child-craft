'use strict';
/* ============================================================
   体验馆 (ShowroomMode, 术语见 GLOSSARY.md「体验馆」) — 模式层
   ------------------------------------------------------------
   冒险全开实验室(docs/showroom-design.md §7): 一个「所有条件都满足、
   退出再进恢复原装」的冒险存档替身 — 合成/烧炼/物资三链全开 + 预建
   大房子与地下室(插满火把、展台陈列、站点齐备), 开发者亲手玩冒险的
   一切细节, bug 自己冒出来(不是自动化测试管线)。
   v2 三份供给全部派生自权威注册表(showroom-core.js, 派生不复制):
   背包套餐=RECIPES 材料并集(揣着就能合成任何配方) · 仓库箱=ITEMS 字段
   驱动五桶(新物品自动归箱) · 展台展品=可放置方块各一份; 冒险加新物品/
   新配方, 体验馆零改动自动同步。
   面板全走既有 kit 的第二消费者缝(不造第二份实现): 合成=mkCraftPanel
   (station 恒真=台级配方随处摆, allow 放开全部隐藏配方, dev 全开口径)
   · 箱子=mkChestPanel + advChestPut/advChestTake(每箱一个内存账户) ·
   熔炉=FurnaceKit(多炉 posKey 寻址, 按点击块绑定)。
   红线: 零本地存储读写/零进度档键字面量(调试永不污染真实进度, ADR 0002;
   守门测试扫源文本, 注释也用中文措辞避开存储 API 名字面量)、不接指针锁定
   (无需 conventions §6 登记)、不计儿童时限(gated:false)、挖/放不接
   (冒险壳交互链待 place-kit 两消费者塑形, §7 D5)。
   interface: ShowroomMode(mkMode 注册对象, id='showroom'; 无菜单页,
     卡点击直进) · ShowroomMode.stock(套餐挂点, 派生产物) / getInv()
     (内存背包 getter, 引用跨进场稳定) / crates(仓库箱挂点: list/账户/
     open) / sr(站点触达面: 熔炉 furnaces/panel/isOpen/autoFill/refundAll
     + 合成 craft + 箱子 chest) — 守门测试挂点(adventure 的 .adv 先例,
     浏览器侧无害)
   依赖(均经全局名, 调用期解析): showroomPocket/showroomCrateRows/
     showroomDisplays(js/showroom-core.js 供给派生, 加载序在本文件之前) ·
     mkMode/ModeKit.spawn/ModeKit.mkHotbar/ModeKit.mkCraftPanel/ModeKit.
     mkChestPanel(js/mode-kit.js) · FurnaceKit(js/furnace-kit.js) ·
     advChestPut/advChestTake/ADV_STATION_R(js/adventure-core.js) ·
     loadScene(js/world.js) · SceneKit(js/scene-kit.js) · WORLD_W/WORLD_D/
     BLOCKS/B_FURNACE/B_CRAFT/B_CHEST/B_BED/B_TORCH/B_DOOR/B_DOOR_TOP/
     B_GLASS_PANE/B_COAL_ORE/B_IRON_ORE/B_GOLD_ORE/B_DIAMOND_ORE/B_CLAY
     (js/config.js) · blockKey/getBlock/setBlockRaw(js/voxel.js) ·
     mkInventory/add/remove/moveSlot/count/isTool/toolOf/HOTBAR_SLOTS/
     INV_SLOTS(js/inventory-core.js) · ITEMS(js/items-core.js) ·
     pos(js/voxel.js) · showToast(js/effects.js) · touchPlaying(js/input.js) ·
     fps/overlay/switchMode/showPage(js/main.js, 加载序在后、调用期已就绪)
   可测性: THREE/DOM 全经 loadScene/ModeKit 惰性路径, boot 冒烟(vm 桩)
     全链可跑; 数据隔离/套餐/仓库箱/建场/三站点交互由 test/showroom-
     mode.test.js 守门(供给派生不变量在 test/showroom-core.test.js)
   ============================================================ */

/* ---------- 场地常数: 展馆布局(§7 D4, 全部几何数据驱动) ---------- */
const SHOWROOM = {
  groundY: 12, // 草地顶层(站立面 y=13)
  spawn: {x: 64.5, z: 60.5, yaw: 0}, // 房内中央过道出生, 面朝 -Z(展台区)
  house: {x1: 48, z1: 44, x2: 79, z2: 75}, // 32×32 木构展厅(墙 y13..16+顶 y17)
  door: {x: 63, z: 75}, // 南门(1 格宽 2 格高, 门板成对在场)
  spawnFurnace: {x: 64, z: 62}, // 出生点正后方 1.5 格: 零走动即测熔炉
  kitchen: [{x: 72, z: 46}, {x: 74, z: 46}], // 北墙灶台角: 双炉
  craftTables: [{x: 52, z: 46}, {x: 54, z: 46}], // 北墙工作台×2
  bed: {x: 77, z: 73}, // 东南角床(装饰件; 睡觉链待放置票)
  crateX: 50, crateZ0: 50, crateStep: 2, crateMax: 8, // 西墙仓库箱排(箱数=派生长度, 锚位自动排)
  tables: [[55, 52], [55, 58], [55, 64], [69, 52], [69, 58], [69, 64]], // 展台 2×2 台身(木板), 顶面摆展品
  basement: {x1: 50, z1: 46, x2: 77, z2: 73}, // 地下室石壳(顶 y11=房内地基, 腔 y8..10, 地面 y7)
  stairs: {x1: 75, x2: 76, z1: 67, z2: 71}, // 楼梯井(东墙侧, 1 格台阶降/跳)
  ores: [], // 地下室矿石样本墙(建场段填 B_* 样本, 见 showroomBasement)
};

/* ---------- 供给派生(showroom-core, 模块加载期一次算定) ----------
   套餐/仓库箱/展品全从权威注册表派生; 展台排除站点四件(它们作为真站点
   装在场内, 不重复陈列)。 */
const showroomPocketRows = showroomPocket(); // {rows ≤27, overflow}
const showroomCrateList = showroomCrateRows(showroomPocketRows.overflow); // [{title, rows}]
const showroomDisplayIds = showroomDisplays(
    [B_CRAFT, B_FURNACE, B_CHEST, B_BED]); // 展品=可放置方块物品 − 站点件

/* ---------- 内存背包: 引用跨进场稳定(面板族持引用), 内容每次进场原地清空重铸 ----------
   不经背包壳、不碰共享背包、不读不写任何进度档(数据隔离红线); 面板
   (craft/chest)构造期即持有 inv 引用, 探险同款「对象供给形态」。 */
let showroomInv = mkInventory();

function showroomRefill() {/* 进场原地重铸: 清 27 槽照套餐入包(套餐 ≤27 行 ⇒ 零余量) */
  showroomInv.slots.fill(null);
  for (const row of showroomPocketRows.rows) add(showroomInv, row.id, row.n);
}

/* ---------- 仓库箱内存账户: 每箱 {size, slots} 纯内存, 进场照派生重铸 ----------
   存取意图走 adventure-core 的 advChestPut/advChestTake 纯函数(与探险
   大宝箱同一份政策实现, 不造第二份); 退出即弃, 每次进场恢复原装。 */
let showroomCrateAccounts = [];

function showroomCratesReset() {
  showroomCrateAccounts = showroomCrateList.map((crate) => {
    const acct = {size: INV_SLOTS, slots: new Array(INV_SLOTS).fill(null)};
    for (const row of crate.rows) advChestPut(acct, {id: row.id, n: row.n});
    return acct;
  });
}
function showroomCratePos(i) {/* 箱锚位: 西墙一排自动排(箱数≤crateMax, 超出由守门测试拦) */
  return {x: SHOWROOM.crateX, z: SHOWROOM.crateZ0 + i * SHOWROOM.crateStep};
}

/* ---------- 材料快捷栏: 9 槽镜像内存背包前 9 槽(v1 同款, 数字键/滚轮/点选全自动) ---------- */
const showroomHbItems = [];
for (let i = 0; i < HOTBAR_SLOTS; i++) {
  showroomHbItems.push({
    item: '',
    cnt: () => (showroomInv.slots[i] ? showroomInv.slots[i].n : 0),
    dur: () => {
      const s = showroomInv.slots[i];
      if (!s || !isTool(s.id)) return 0; /* 非工具不画耐久条 */
      const t = toolOf(s.id);
      return t ? (s.dur || 0) / t.dur : 0;
    },
  });
}
const showroomHb = ModeKit.mkHotbar({items: showroomHbItems});
function showroomSyncBar() {/* 槽内容 → 槽型 item 字段(图标/名字跟着换; 数量走 cnt 闭包) */
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const s = showroomInv.slots[i];
    showroomHbItems[i].item = s ? s.id : '';
  }
  showroomHb.render();
}

/* ============================================================
   面板族(v2): 合成 / 仓库箱 / 熔炉 — 三块面板都是 mode-kit/kit 的
   第二消费者 adapter, 政策差异只在 dev 降噪(零 TTS/零记账/满包静默)。
   开态旗标只做世界点击与回菜单的守卫; 面板自身开合真值在 kit
   (✕/Esc 直关不经模式层, 与探险同款对账口径)。
   ============================================================ */
let showroomCraftOpen = false;
let showroomChestOpen = false;

const showroomPanel = ModeKit.mkCraftPanel({
  inv: showroomInv, /* 引用跨进场稳定(原地重铸) */
  station: () => true, /* 全开: 台级配方随处可摆(dev 口径, 站点门禁是儿童引导不属调试场) */
  allow: (typeof KIT_HIDDEN_RECIPES !== 'undefined') ?
    KIT_HIDDEN_RECIPES.slice() : [], /* 隐藏配方全点亮(二期卡也进馆可测), 清单随 mode-kit 演进自动跟 */
  onCraft: () => showroomSyncBar(), /* 产物入包即刷快捷栏; 满包余量静默丢弃(dev 降噪, 与退炉余量同口径) */
  onMove: (from, to) => moveSlot(showroomInv, from, to), /* 背包格点选搬运(政策在背包核心) */
  onGridMove: () => showroomSyncBar(),
  onClose: () => {
    showroomCraftOpen = false;
  },
  onSort: () => showroomSyncBar(),
});
function showroomCraftToggle() {
  if (showroomCraftOpen) {
    showroomPanel.close(); /* close 链含关面板退料(台面余料回包, 零损失) */
    return;
  }
  showroomCraftOpen = true;
  showroomPanel.show();
}
function showroomCraftClose() {
  if (showroomCraftOpen) showroomPanel.close();
}

let showroomCrateIdx = -1; /* 当前打开的箱号(面板 chest() 经此路由到对应账户) */
const showroomChestPanel = ModeKit.mkChestPanel({
  inv: showroomInv,
  chest: () => showroomCrateAccounts[showroomCrateIdx] || {size: 0, slots: []},
  next: () => null, /* 体验馆箱恒顶格(dev 全开无扩容), 扩容行隐藏 */
  have: (id) => count(showroomInv, id),
  onPut: (i) => showroomCratePut(i),
  onTake: (i) => showroomCrateTake(i),
  onClose: () => {
    showroomChestOpen = false;
  },
});
function showroomCratePut(i) {/* 背包格 → 箱: 整摞入箱(政策纯函数), 装不下留背包 */
  const st = remove(showroomInv, i);
  if (!st) return;
  const left = advChestPut(showroomCrateAccounts[showroomCrateIdx], st);
  if (left > 0) {
    st.n = left;
    showroomInv.slots[i] = st;
  }
  showroomSyncBar();
}
function showroomCrateTake(i) {/* 箱格 → 背包: 整摞出箱(满包整摞留箱, 政策纯函数) */
  advChestTake(showroomCrateAccounts[showroomCrateIdx], showroomInv, i);
  showroomSyncBar();
}
function showroomOpenCrate(idx) {
  showroomCrateIdx = idx;
  showroomChestOpen = true;
  showroomChestPanel.show();
  showroomChestPanel.refresh(); /* chest 面板契约: show 只装 chrome, 内容消费方自刷 */
}

/* 熔炉展品(多炉 posKey 寻址): 点击哪台绑哪台, 炉态按块号分账(kit 原生
   多炉口径); 政策降噪同 v1(零儿童提示/零掉落物/退出余量静默丢弃) */
const showroomFurnace = FurnaceKit.mkFurnaceStation({
  inv: () => showroomInv, /* 取数器供给(kit 归一两种形态) */
  onInvTouched: () => showroomSyncBar(),
});

/* ---------- 站点使用路由: 点击块号分流, 4 格门槛按点击块精确判距 ---------- */
function showroomUseStation(hit) {
  const lookId = getBlock(hit.x, hit.y, hit.z);
  const d = Math.hypot(hit.x + 0.5 - pos.x, hit.z + 0.5 - pos.z);
  if (d > ADV_STATION_R) {
    showToast('🚪 走近一点就能用啦');
    return;
  }
  if (lookId === B_FURNACE) {
    showroomFurnace.open(blockKey(hit.x, hit.y, hit.z));
    return;
  }
  if (lookId === B_CRAFT) {
    showroomCraftToggle();
    return;
  }
  if (lookId === B_CHEST) {
    const idx = showroomCrateList.findIndex((c, i) => {
      const p = showroomCratePos(i);
      return p.x === hit.x && p.z === hit.z;
    });
    if (idx >= 0) showroomOpenCrate(idx);
  }
}

/* ============================================================
   建场(全几何数据驱动, 走 SceneKit/setBlockRaw; 光照归 loadScene 全量)
   ============================================================ */

/* 火把插点 helper: 地面一层 thin 火把(光 14, loadScene 全量点亮) */
function showroomTorches(points, y) {
  for (const p of points) setBlockRaw(p[0], y, p[1], B_TORCH);
}

function showroomBuild() {
  const g = SHOWROOM.groundY;
  /* 全幅平地草场(随世界尺寸; v1 只铺 0..127 是 128 时代旧值, 扩容 160 后纠偏) */
  SceneKit.fill(0, g - 2, 0, WORLD_W - 1, g - 1, WORLD_D - 1, 2);
  SceneKit.fill(0, g, 0, WORLD_W - 1, g, WORLD_D - 1, 1);
  showroomHouse();
  showroomHall();
  showroomBasement();
}

function showroomHouse() {
  const h = SHOWROOM.house; const g = SHOWROOM.groundY;
  const top = 16;
  SceneKit.fill(h.x1, g, h.z1, h.x2, g, h.z2, 6); // 木板地板(覆草皮)
  /* 四墙(实心 y13..16), 再开门洞与玻璃板窗 */
  SceneKit.fill(h.x1, g + 1, h.z1, h.x2, top, h.z1, 6);
  SceneKit.fill(h.x1, g + 1, h.z2, h.x2, top, h.z2, 6);
  SceneKit.fill(h.x1, g + 1, h.z1, h.x1, top, h.z2, 6);
  SceneKit.fill(h.x2, g + 1, h.z1, h.x2, top, h.z2, 6);
  for (const x of [54, 60, 68, 74]) { // 南北墙窗(y14 单排玻璃板)
    setBlockRaw(x, 14, h.z1, B_GLASS_PANE);
    if (x !== SHOWROOM.door.x) setBlockRaw(x, 14, h.z2, B_GLASS_PANE);
  }
  for (const z of [54, 60, 68]) { // 东西墙窗
    setBlockRaw(h.x1, 14, z, B_GLASS_PANE);
    setBlockRaw(h.x2, 14, z, B_GLASS_PANE);
  }
  const d = SHOWROOM.door; // 南门: 门洞 + 门板成对(关态在场, 开关链待放置票)
  setBlockRaw(d.x, g + 1, d.z, 0);
  setBlockRaw(d.x, g + 2, d.z, 0);
  setBlockRaw(d.x, g + 1, d.z, B_DOOR);
  setBlockRaw(d.x, g + 2, d.z, B_DOOR_TOP);
  SceneKit.fill(h.x1, top + 1, h.z1, h.x2, top + 1, h.z2, 6); // 木板顶
  /* 站点件: 即测炉(出生圈) + 灶台角双炉 + 工作台×2 + 床 */
  SceneKit.fill(SHOWROOM.spawnFurnace.x, g + 1, SHOWROOM.spawnFurnace.z,
      SHOWROOM.spawnFurnace.x, g + 1, SHOWROOM.spawnFurnace.z, B_FURNACE);
  for (const f of SHOWROOM.kitchen) setBlockRaw(f.x, g + 1, f.z, B_FURNACE);
  for (const c of SHOWROOM.craftTables) setBlockRaw(c.x, g + 1, c.z, B_CRAFT);
  setBlockRaw(SHOWROOM.bed.x, g + 1, SHOWROOM.bed.z, B_BED);
  /* 仓库箱排: 箱数=仓库箱派生长度(≤crateMax, 守门测试拦超出) */
  for (let i = 0; i < Math.min(showroomCrateList.length, SHOWROOM.crateMax); i++) {
    const p = showroomCratePos(i);
    setBlockRaw(p.x, g + 1, p.z, B_CHEST);
  }
  /* 火把插满: 室内四面墙+中央过道(地面一层) */
  showroomTorches([[50, 45], [58, 45], [66, 45], [74, 45], [50, 74], [58, 74],
    [66, 74], [74, 74], [49, 50], [49, 58], [49, 66], [78, 50], [78, 58],
    [78, 66], [62, 56], [66, 64]], g + 1);
}

function showroomHall() {/* 中央展台: 2×2 木板台身, 顶面照派生清单各摆一份展品 */
  let k = 0;
  for (const [tx, tz] of SHOWROOM.tables) {
    SceneKit.fill(tx, SHOWROOM.groundY + 1, tz, tx + 1, SHOWROOM.groundY + 1, tz + 1, 6);
    for (let dx = 0; dx <= 1; dx++) {
      for (let dz = 0; dz <= 1; dz++) {
        if (k < showroomDisplayIds.length) {
          setBlockRaw(tx + dx, SHOWROOM.groundY + 2, tz + dz,
              ITEMS[showroomDisplayIds[k]].block);
          k++;
        }
      }
    }
  }
}

function showroomBasement() {/* 房下石壳(自密封: 清空世界里下方是空的) + 矿样墙 + 楼梯井 */
  const b = SHOWROOM.basement; const s = SHOWROOM.stairs; const g = SHOWROOM.groundY;
  SceneKit.fill(b.x1, 6, b.z1, b.x2, g - 1, b.z2, 4); // 石壳整体(cobble)
  SceneKit.fill(b.x1 + 1, 8, b.z1 + 1, b.x2 - 1, 10, b.z2 - 1, 0); // 掏空内腔(地面 y7 顶, 高 3)
  /* 矿石样本墙(北壁内面, 站立面高度): 五种矿物各一格 */
  const ores = [B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY];
  for (let i = 0; i < ores.length; i++) setBlockRaw(52 + i, 8, b.z1 + 1, ores[i]);
  /* 楼梯井: 五级 1 格台阶(降=走落, 升=跳跃), 顶通房内地面 */
  for (let i = 0; i <= 4; i++) {
    SceneKit.fill(s.x1, Math.max(8, g - i), s.z2 - i, s.x2, g, s.z2 - i, 0);
  }
  /* 踏步回填: 内腔掏空吃掉了壳层, 三级踏步显式落位(每级降 1 格, 站位 2 格净空) */
  SceneKit.fill(s.x1, 10, s.z2 - 1, s.x2, 10, s.z2 - 1, 4);
  SceneKit.fill(s.x1, 9, s.z2 - 2, s.x2, 9, s.z2 - 2, 4);
  SceneKit.fill(s.x1, 8, s.z2 - 3, s.x2, 8, s.z2 - 3, 4);
  /* 地下室火把插满: 内腔周界 + 井口侧壁照明(不占楼梯通道格) */
  showroomTorches([[60, 47], [68, 47], [52, 72], [60, 72], [68, 72],
    [51, 52], [51, 60], [51, 68], [76, 52], [76, 60], [76, 68],
    [s.x1 - 1, s.z1]], 8);
}

/* 进场一条路: 清场 → 建场 → 出生 → 收菜单 → 置"进行中"态(v1 同款) */
function showroomEnter() {
  loadScene(showroomBuild); // 场景装填 seam: 建场+光场+收尾重建一步到位
  ModeKit.spawn(SHOWROOM.spawn.x, SHOWROOM.groundY + 1, SHOWROOM.spawn.z,
      {yaw: SHOWROOM.spawn.yaw});
  touchPlaying = true; // input.js 的"进行中"态(触屏同款口径; 不接指针锁定)
  overlay.style.display = 'none'; // 直进: 收主菜单
}

const ShowroomMode = mkMode({
  id: 'showroom',

  hotbar: showroomHb,
  chrome: {hotbar: 'deferred'}, // 先藏, init 装满材料后再现身

  init() {
    showroomRefill(); // 套餐: 原地清空重铸(每次进场干净初始态)
    showroomCratesReset(); // 仓库箱: 照派生重铸(恢复原装)
    showroomEnter();
    showroomSyncBar();
    showroomHb.show();
    showroomFurnace.reset(); // 炉态纯内存, 进场清零
  },

  cleanup() {/* 收场: 收双面板(合成 close 链退台面余料) + 退炉三笔入包 +
    收炉面板 + 解「进行中」态(零掉落物, 余量静默丢弃 dev 口径) */
    showroomCraftClose();
    if (showroomChestOpen) showroomChestPanel.close();
    showroomFurnace.refundAll();
    showroomFurnace.panel.hide();
    touchPlaying = false;
  },

  update(dt) {
    showroomFurnace.tick(dt); // 烧炼节律常开(多炉逐炉推进, 面板只是回显)
  },

  onMouse(button, hit) {/* 不挖不放: 点击只接站点使用(工作台/熔炉/箱子, 左右键同达) */
    if (showroomCraftOpen || showroomChestOpen || showroomFurnace.isOpen()) return;
    if (button !== 0 && button !== 2) return;
    const lookId = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
    if (lookId === B_FURNACE || lookId === B_CRAFT || lookId === B_CHEST) {
      showroomUseStation(hit);
    }
  },

  /* B/暂停回菜单: 无菜单页, 恢复菜单背景默认模式再回主页; 三面板开着 =
     放鼠标不是回菜单(探险同款守卫) */
  onMenu() {
    if (showroomCraftOpen || showroomChestOpen || showroomFurnace.isOpen()) {
      overlay.style.display = 'none'; return;
    }
    switchMode('arena');
    showPage('main');
  },

  onKey(code) {/* Tab 背包+配方书(探险同款入口); 箱/炉开着先收箱/炉 */
    if (code !== 'Tab') return;
    if (showroomChestOpen) {
      showroomChestPanel.close();
      return;
    }
    if (showroomFurnace.isOpen()) {
      showroomFurnace.close();
      return;
    }
    showroomCraftToggle();
  },

  hud() {
    return [
      '🧪 体验馆 · 冒险全开实验室 · B 回菜单',
      'Tab 背包与配方书 · 走近 工作台/熔炉/箱子 点击使用',
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      'FPS ' + fps,
    ];
  },

  onHighlight() {
    return false;
  }, // 不挖不放, 隐藏方块高亮(v2 同 v1 口径, 放置链待 place-kit)
});

/* 守门测试挂点(adventure 的 .adv 先例; 浏览器侧无害) */
ShowroomMode.stock = showroomPocketRows.rows; // 套餐(派生产物; 旧材料表挂点同名延续)
ShowroomMode.getInv = () => showroomInv;
ShowroomMode.crates = {list: showroomCrateList, accounts: () => showroomCrateAccounts,
  put: showroomCratePut, take: showroomCrateTake}; // 存/取意图(政策函数, 与面板回调同路)
ShowroomMode.sr = {
  furnaces: showroomFurnace.map,
  panel: showroomFurnace.panel,
  isOpen: () => showroomFurnace.isOpen(),
  autoFill: (plan, key) => showroomFurnace.autoFill(plan, key),
  refundAll: () => showroomFurnace.refundAll(),
  craft: {panel: showroomPanel, isOpen: () => showroomCraftOpen, toggle: showroomCraftToggle},
  chest: {panel: showroomChestPanel, isOpen: () => showroomChestOpen, open: showroomOpenCrate},
};

if (typeof module !== 'undefined' && module.exports) module.exports = ShowroomMode;
