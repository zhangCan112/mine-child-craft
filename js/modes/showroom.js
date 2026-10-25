'use strict';
/* ============================================================
   体验馆 (ShowroomMode, 术语见 GLOSSARY.md「体验馆」) — 模式层
   ------------------------------------------------------------
   仅开发人员可见的调试模式(注册表 dev:true + 卡默认隐藏, ?dev=1 解锁):
   真游戏场景去掉跑图与挖掘 — 平地草场空场 + 预置被测道具(v1 展品=熔炉) +
   满材料背包, 一切触手可及; 做出来的东西在这里亲手玩一遍, bug 自己冒出来
   (开发者亲手玩, 不是自动化测试管线)。
   T1 骨架: 装场 + 出生点 + HUD 坐标/FPS。
   T2 材料台: SHOWROOM_STOCK 数据表(一行=一种材料) + 内存背包每次进场
   照表重铸 + mkHotbar 材料快捷栏(数字键/滚轮/点选全自动)。
   T3 熔炉展品: 场中心预置熔炉(出生圈内, 走近点击开熔炉面板) + 烧炼节律
   update 常开 + 自动放料经背包核心扣加 + 退出三笔尽力入包。
   T4 装配收编: 面板开合/取产物/自动放料/逐炉推进喂显/退炉/燃料余量比
   全在共享熔炉 kit(js/furnace-kit.js, 探险同款两消费者——探险的炉与这里
   的炉是同一缝上的两个 adapter, 不造第二份烧炼实现); 与探险的差异只有
   供给形态(inv 取数器, 进场换新实例) 与政策降噪(零儿童提示/零掉落物/
   退出余量静默丢弃), 炉态纯内存退出即清。
   红线: 零本地存储读写/零进度档键字面量(调试永不污染真实进度, ADR 0002;
   守门测试扫源文本, 注释也用中文措辞避开存储 API 名字面量)、不接指针锁定
   (无需 conventions §6 登记; 视角操作走触屏口径, 配合 ?touch=1 强制预览即
   指针无关的完整操控)、不计儿童时限(gated:false)。
   interface: ShowroomMode(mkMode 注册对象, id='showroom'; 无菜单页,
     卡点击直进 — focus/math 同款先例) · ShowroomMode.stock(材料表挂点)
     / ShowroomMode.getInv()(内存背包 getter) / ShowroomMode.sr(熔炉展品
     触达面: furnaces/panel/isOpen/autoFill/refundAll) — 守门测试挂点
     (adventure 的 .adv 先例, 浏览器侧无害)
   依赖(均经全局名, 调用期解析): mkMode/ModeKit.spawn/ModeKit.mkHotbar
     (js/mode-kit.js) · FurnaceKit(js/furnace-kit.js 共享熔炉 kit, 加载序在
     本文件之前) · loadScene(js/world.js 场景
     装填 seam) · SceneKit(js/scene-kit.js) · B_FURNACE(js/config.js) ·
     blockKey/getBlock(js/voxel.js; 近距判定与点击查块) · mkInventory/add/
     take/count/HOTBAR_SLOTS(js/inventory-core.js) · ITEMS/isTool/toolOf
     (js/items-core.js) · advNearStation/ADV_STATION_R
     (js/adventure-core.js 探险核心纯函数, 加载序: adventure.js 在本文件
     之前, 其核心更早) · pos(js/voxel.js 玩家位置, 近距判定/HUD 只读) ·
     showToast(js/effects.js
     走近提示) · touchPlaying(js/input.js "进行中"态, main.js 跨文件写
     先例) · fps/overlay/switchMode/showPage(js/main.js, 加载序在后、
     调用期已就绪)
   可测性: THREE/DOM 全经 loadScene/ModeKit 等惰性路径, boot 冒烟(vm 桩)
   全链可跑; 数据隔离/材料表/预装/快捷栏/熔炉展品行为由 test/showroom-
   mode.test.js 守门(键扫+表校验+进场断言+烧炼编排: 只测编排不重测
   adventure-core 纯函数, 其单测在 test/adventure-core.test.js)
   ============================================================ */

/* 场地常数: 全幅平地草场(世界 128×128, 坦克演习场同幅), 世界中心出生 */
const SHOWROOM = {
  groundY: 12, // 草地顶层(站立面 y=13, 坦克演习场同标高)
  spawn: {x: 64.5, z: 64.5, yaw: 0}, // 世界中心出生, 面朝 -Z(camera-rig 口径)
  furnace: {x: 64, z: 62}, // 预置熔炉格(地面上一层): 出生点正前方 2 格, 炉中心距出生 2 格 < 4 格解锁圈
};

/* ---------- 材料台数据表(票据 T2): 一行=一种材料 {id, n} ----------
   初始清单 = SMELTS 全部原料(10 行, 照 craft-core 登记序) + 代表燃料
   (煤/木板/木棍 — FUEL 择优序的首/中/尾三档) + 各烧炼产物对照样(10 行),
   共 23 行 ≤27 槽预算(一行一槽); 加测试材料只改这张表(spec 故事 14),
   不碰任何逻辑 — id 必须在物品核心注册、数量不超堆叠上限, 守门测试
   逐行校验(test/showroom-mode.test.js)。 */
const SHOWROOM_STOCK = [
  /* 烧炼原料: SMELTS 全集(craft-core 登记序), 前 9 行正好铺满快捷栏 */
  {id: 'iron_ore', n: 16}, // 粗铁矿 → 铁锭
  {id: 'gold_ore', n: 16}, // 粗金矿 → 金锭
  {id: 'log', n: 16}, // 原木 → 木炭
  {id: 'cobble', n: 16}, // 圆石 → 石头(建材循环)
  {id: 'sand', n: 16}, // 沙子 → 玻璃
  {id: 'clay_ball', n: 16}, // 黏土球 → 红砖
  {id: 'raw_beef', n: 16}, // 生牛肉 → 牛排
  {id: 'raw_porkchop', n: 16}, // 生猪排 → 熟猪排
  {id: 'raw_chicken', n: 16}, // 生鸡肉 → 熟鸡肉
  {id: 'raw_mutton', n: 16}, // 生羊肉 → 熟羊肉
  /* 代表燃料: 煤(热值 8)/木板(1.5)/木棍(0.5) — 单位=能烧几件 */
  {id: 'coal', n: 16},
  {id: 'planks', n: 16},
  {id: 'stick', n: 16},
  /* 产物对照样: 烧前烧后摆一起, 显示层 bug 一眼对出 */
  {id: 'iron_ingot', n: 4},
  {id: 'gold_ingot', n: 4},
  {id: 'charcoal', n: 4},
  {id: 'stone', n: 4},
  {id: 'glass', n: 4},
  {id: 'brick', n: 4},
  {id: 'cooked_beef', n: 4},
  {id: 'cooked_porkchop', n: 4},
  {id: 'cooked_chicken', n: 4},
  {id: 'cooked_mutton', n: 4},
];

/* ---------- 内存背包(票据 T2): mkInventory 纯内存实例 ----------
   不经背包壳、不碰共享背包、不读不写任何进度档(数据隔离红线) — init
   每次进场照表重铸满材料, 退出即弃, 每次进场都是干净初始态(spec 故事 17)。 */
let showroomInv = mkInventory(); // require 期先备空实例(hotbar 的 cnt 闭包即有包可读)

function showroomFill() {/* 进场装满: 照表逐行入包(行数 ≤27 且不超堆叠 → 零余量) */
  showroomInv = mkInventory();
  for (const row of SHOWROOM_STOCK) add(showroomInv, row.id, row.n);
}

/* ---------- 材料快捷栏(mkHotbar item 槽型): 9 槽镜像内存背包前 9 槽 ----------
   数字键/滚轮/点选由 mkMode 默认路由全自动接走(探险同款手感); 数量经
   cnt 闭包实时读包, 名字/图标在进场装满后 showroomSyncBar 刷一次 */
const showroomHbItems = [];
for (let i = 0; i < HOTBAR_SLOTS; i++) {
  showroomHbItems.push({
    item: '',
    cnt: () => (showroomInv.slots[i] ? showroomInv.slots[i].n : 0),
    dur: () => {
      const s = showroomInv.slots[i];
      if (!s || !isTool(s.id)) return 0; /* 非工具不画耐久条(表里加工具行即自动点亮) */
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
   熔炉展品(票据 T3/T4) — 共享熔炉 kit(js/furnace-kit.js)在体验馆的 adapter
   ------------------------------------------------------------
   状态机/退炉/装配段全收编共享 kit(探险同款两消费者, 探险的炉与这里的炉
   是同一缝上的两个 adapter——不造第二份烧炼实现, kit 内部走探险核心纯
   函数); 与探险的差异只有供给形态与政策降噪: inv 走取数器(每次进场照表
   重铸新实例, kit/面板永远读到当前包) · 零儿童提示/零掉落物/退出余量
   静默丢弃(dev 调试口径) · 炉态纯内存(退出即清, 每次进场干净初始态,
   spec 故事 17) · 退出三笔尽力入包(故事 12); 关面板只取产物、烧炼照跑
   进度保留(故事 11 断档续烧可复现)。
   ============================================================ */
const showroomFurnace = FurnaceKit.mkFurnaceStation({
  inv: () => showroomInv, /* 取数器供给: 进场换新实例, kit/面板永远读到当前包 */
  onCollect: showroomSyncBar, /* 取产物成功: 快捷栏刷新(dev 场无音效/无满包提示) */
  onInvChange: showroomSyncBar, /* 自动放料动包后: 快捷栏刷新 */
});

function showroomFurnaceKey() {/* 预置炉 posKey('x,y,z', 与探险站点缓存同口径) */
  return blockKey(SHOWROOM.furnace.x, SHOWROOM.groundY + 1, SHOWROOM.furnace.z);
}
function showroomStations() {/* 站点清单(advNearStation 输入形状 {id,x,z}): v1 单炉, 加展品加行 */
  return [{id: B_FURNACE, x: SHOWROOM.furnace.x, z: SHOWROOM.furnace.z}];
}
/* 使用型站点交互(探险 advUseStation 同款): 点击熔炉后判距, 圈内开面板/
   圈外只提示不误开(v1 单炉绑预置位, 未来多炉再从点击块取 posKey 绑定) */
function showroomUseFurnace() {
  if (advNearStation(showroomStations(), pos.x, pos.z, ADV_STATION_R, B_FURNACE)) {
    showroomFurnace.open(showroomFurnaceKey());
  } else {
    showToast('♨️ 走近一点就能用熔炉啦');
  }
}
/* 面板意图的无面板直调口径: 单炉固定 key(plan 缺省自算, 测试可无开态直驱;
   退炉/推进/喂显/收口全在 kit, 经 showroomFurnace.tick/refundAll 驱动) */
function showroomFurnaceLoad(plan) {
  showroomFurnace.autoFill(plan, showroomFurnaceKey());
}

function showroomBuild() {
  /* 平地草场: 两层泥土垫底 + 整幅草皮 — 空场即调试画布, 展品预置见下 */
  SceneKit.fill(0, SHOWROOM.groundY - 2, 0, 127, SHOWROOM.groundY - 1, 127, 2);
  SceneKit.fill(0, SHOWROOM.groundY, 0, 127, SHOWROOM.groundY, 127, 1);
  /* v1 展品: 场中心预置熔炉(T3) — 装场即在场, 不靠玩家放置(体验馆去掉跑图与挖掘) */
  SceneKit.fill(SHOWROOM.furnace.x, SHOWROOM.groundY + 1, SHOWROOM.furnace.z,
      SHOWROOM.furnace.x, SHOWROOM.groundY + 1, SHOWROOM.furnace.z, B_FURNACE);
}

/* 进场一条路: 清场 → 建场 → 出生 → 收菜单 → 置"进行中"态。
   switchMode 进来时 world 已清, loadScene 的清场再兜一次重建(幂等) */
function showroomEnter() {
  loadScene(showroomBuild); // 场景装填 seam: 建场+收尾重建一步到位
  ModeKit.spawn(SHOWROOM.spawn.x, SHOWROOM.groundY + 1, SHOWROOM.spawn.z,
      {yaw: SHOWROOM.spawn.yaw});
  touchPlaying = true; // input.js 的"进行中"态(触屏同款口径; 不接指针锁定)
  overlay.style.display = 'none'; // 直进: 收主菜单(训练营壳 init 同款动作)
}

const ShowroomMode = mkMode({
  id: 'showroom',

  hotbar: showroomHb, // 材料快捷栏: mkHotbar(数字键/滚轮/点选全自动)
  chrome: {hotbar: 'deferred'}, // 先藏, init 装满材料后再现身(一次渲染到位)

  init() {
    showroomFill(); // 材料台: 照表重铸满材料背包(每次进场干净初始态)
    showroomEnter();
    showroomSyncBar();
    showroomHb.show(); // 材料栏现身: 装满后渲染, 名字数量一步到位
    showroomFurnace.reset(); // 熔炉展品(T3/T4): 炉态纯内存, 进场清零(干净初始态, spec 故事 17)
  },

  cleanup() {/* T3 收场: 退炉三笔尽力入包(零损耗, 故事 12; 满包余量静默丢弃是
    kit refundAll 的 dev 口径) + 炉态清空 + 收面板 +
    解「进行中」态(体验馆不锁指针, touchPlaying 是唯一进行中标志) */
    showroomFurnace.refundAll();
    showroomFurnace.panel.hide();
    touchPlaying = false;
  },

  update(dt) {
    showroomFurnace.tick(dt); // 烧炼节律常开(面板只是回显): 逐炉推进 + 面板开着喂显
  },

  onMouse(button, hit) {/* v1 不挖不放: 点击只接熔炉使用(左/轻点同达, 探险 advUseStation 同款) */
    if (showroomFurnace.isOpen()) return; /* 面板遮罩兜底: 开面板不吃世界点击 */
    const lookId = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
    if (lookId === B_FURNACE) showroomUseFurnace();
  },

  /* B/暂停回菜单: 体验馆无菜单页(page:false), 恢复菜单背景默认模式再回主页 —
     MODES.cur 交还 arena 后, 再点体验馆卡即全新进场(体验馆每次进场都是
     干净初始态, 炉态/背包后续票据也靠这条收场链兜住不渗漏) */
  onMenu() {
    if (showroomFurnace.isOpen()) {
      overlay.style.display = 'none'; return; /* 熔炉面板开着 = 放鼠标不是回菜单(探险同款守卫) */
    }
    switchMode('arena');
    showPage('main');
  },

  hud() {
    /* bug 报告口径: 坐标(探险同款行) + FPS(坦克演习场同款尾行) */
    return [
      '🧪 体验馆 · dev 调试场 · B 回菜单',
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      'FPS ' + fps,
    ];
  },

  onHighlight() {
    return false;
  }, // v1 不挖不放(spec Out of Scope), 隐藏方块高亮(坦克演习场同款)
});

/* 守门测试挂点(adventure 的 .adv 先例): 材料表 + 内存背包 getter(浏览器侧无害) */
ShowroomMode.stock = SHOWROOM_STOCK;
ShowroomMode.getInv = () => showroomInv;

/* 熔炉展品触达面(.sr, adventure .adv 同款内部挂点 — 单测经此驱动交互链):
   furnaces 炉态 Map(kit 的 Map 引用, 只读断言/直写同口径) · panel 面板
   实例(✕/Esc 出口全链) · isOpen 开态 · autoFill 自动放料落点(无面板直调
   口径, 单炉固定 key) · refundAll 退炉 */
ShowroomMode.sr = {furnaces: showroomFurnace.map, panel: showroomFurnace.panel,
  isOpen: () => showroomFurnace.isOpen(), autoFill: (plan) => showroomFurnaceLoad(plan),
  refundAll: () => showroomFurnace.refundAll()};

if (typeof module !== 'undefined' && module.exports) module.exports = ShowroomMode;
