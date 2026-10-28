'use strict';
/* ============================================================
   体验馆 (ShowroomMode, 术语见 GLOSSARY.md「体验馆」) — 模式层·dev profile 门面
   ------------------------------------------------------------
   冒险壳统一终态的 dev profile 门面(ADR 0005 票 U4, 权威
   docs/adventure-shell-unification-design.md §3): v2 镜像编排段(~600 行)
   全删——壳内同名能力全部接管, 本文件只剩三件事:
   ① 换装/还原: init 前把存档缝 advStore 整体换成全内存 dev store(U3 的
      mkShowroomStore, 落盘面全丢弃)+政策缝 advProfile 换 dev 政策值,
      冒险壳编排零改动, 任务链/地图/门阵/下界/牧场/灯笼随统一自动进馆;
      cleanup 必须在 dev 装配下跑完(退炉/兜底落盘全落进 noop), 收尾把
      两缝还原真档缺省——「进场重铸、退出无痕」。
   ② 背包闭包绑定(本票最重要的正确性细节): 壳的 kit/面板在加载期就捕获
      真档背包 inv 对象引用, 换 advStore.bag 不会重绑这些闭包——dev bag
      必须包壳的真档 inv(showroomDevBag): 身份永不变、内容随 load 原地
      重铸, 闭包全对; dev 会话期真键零写入。
   ③ dev 政策值(D5 拍板①+v2 降噪口径, U2 政策缝的消费): death='inPlace'
      原地满血复活 · 床边不设出生点 · 夜怪入夜上沿固定点位铺(SHOWROOM.
      nightMobs, 池不排骷髅) · 语音/音效静默 toast 保留(kit 内置受击/
      击杀音存活是既有口径) · 站点/隐藏配方全开 · 余量静默丢弃。
   红线: 零本地存储读写/零存档键字面量(ADR 0002, 两文件键扫测试守门)、
   不接指针锁定(无需 conventions §6 登记)、不计儿童时限(gated:false)。
   interface: ShowroomMode(mkMode 门面, id='showroom'; 钩子全委托壳,
     chrome 对齐冒险壳; hud 首行加 🧪 体验馆徽标行, 其余行透传壳的 HUD;
     onMenu dev 特化=面板开着不回菜单/否则回 main) · stock/getInv/chest/
     sr/pk/mine/fuses/tntTap/pEnt/snowballs/sleep(守门测试挂点——v2 挂点
     再别名到壳内部部件, 见文件尾)
   依赖(均经全局名, 调用期解析; index.html 加载序 adventure.js →
     showroom-core.js → 本文件): js/modes/adventure.js 的 AdventureMode 与
     其顶层部件(advStore/advProfile 两缝与 advStoreDefault/advProfileDefault
     还原锚点 · advInv/advChest/ADV 账本 · advMine/advFuses/advTntTap/
     advSnowballs/advSleep/advPlaceKit/advFurnace/advPanel/advChestPanel/
     advGetPEnt 部件 · advPanelToggle/advChestOpenPanel/advChestDeposit/
     advChestWithdraw/advInvMove/advHudLines 入口) · js/showroom-core.js 的
     SHOWROOM/showroomPocket/showroomWorldEdits/showroomDevBag/
     mkShowroomStore(供给派生与 dev store 工厂) · js/daylight-core.js 的
     Daylight · js/mobs.js 的 Mobs · js/effects.js 的 showToast ·
     js/world.js 的 dayTime · js/input.js 的 touchPlaying ·
     js/main.js 的 overlay/showPage/switchMode(加载序在后、调用期已就绪)
   可测性: THREE/DOM 全经壳的惰性路径; test/showroom-mode.test.js 把本文件
     与 adventure.js 装进同一 vm 词法环境(还原经典 script 共享词法环境的
     装载现实——门面要写壳的顶层 let 缝), 换装生命周期/数据隔离/统一行为面
     在那守门
   ============================================================ */

/* ---------- dev 政策值(③, U2 政策缝的消费) ---------- */
let showroomNightWas = true; /* 入夜跨沿账本(固定点位铺法的私有状态——U2 的 nightLay(dt) 每帧被调, 环带版是节拍制、固定点位版是边沿制, 边沿状态自持; install 对齐当下) */

function showroomNightLay(dt) {/* 夜怪铺法·dev 版(D5 拍板①): 入夜上沿按 SHOWROOM.nightMobs 各铺 1 只,
    全带 __nightMob 标记(清场唯一依据, 与壳的黎明/睡醒清场同源)+__nightHome
    家锚=铺点(完整 AI 收队不流浪); 夜内不加铺(边沿语义); 黎明/睡醒清场共用
    壳的 advSweepNightMobs(唯一实现), 本铺法不自带清场 */
  const night = Daylight.isNight(dayTime);
  if (night && !showroomNightWas) {
    for (const p of SHOWROOM.nightMobs) {
      const m = Mobs.spawn(p.type, p.x, p.z, {yaw: 0});
      m.__nightMob = true;
      m.__nightHome = {x: p.x, z: p.z};
    }
  }
  showroomNightWas = night;
}

const showroomProfile = {/* dev 政策值: 冒险壳政策缝的整体替换件(缺省逐键对照见 advProfileDefault) */
  death: 'inPlace', /* D5 拍板①: 原地满血复活+清夜怪+toast, 保调试现场(壳内已备分支) */
  sleepWakeSetsSpawn: false, /* D5 拍板①: 唤醒只跳清晨+清场两连, 不设床边出生点 */
  nightLay: showroomNightLay, /* 入夜上沿固定点位铺法(边沿制, 见上) */
  speak: () => {}, /* v2 降噪口径: TTS 全静默 */
  sfx: () => {}, /* v2 降噪口径: 音效全静默(kit 内置 hurt/击杀音不经缝, 存活是既有口径) */
  toast: (t) => showToast(t), /* toast 保留面(v2 口径) */
  stationAlwaysOpen: true, /* 台级配方随处可摆(站点门禁是儿童引导, 不属调试场) */
  hiddenRecipesOpen: true, /* 隐藏配方全点亮(二期卡进馆可测, 清单随 mode-kit 自动跟) */
  leftoverDrops: false, /* 满包余量静默丢弃(dev 无存档, 掉落只是噪音; 三处余量同口径) */
};

/* ---------- 换装/还原(①: 两缝整体换, 单并发无嵌套) ---------- */
let showroomDevOn = false; /* dev 装配在位旗(init 装/cleanup 还原, 防双装/漏装) */

function showroomDevInstall() {/* 装配 dev store+profile(必须在壳 init 前调用): ① 先触发展馆账本派生
    (惰性缓存一次算定——仿真独占全局世界, 此刻壳 init 的 loadScene 建场尚未
    发生, 时序安全); ② dev bag 包壳的真档 inv 对象(背包闭包绑定②的解:
    装配前取 advStore.bag.inv, 换装后 kit/面板闭包看到的仍是同一 inv,
    内容随 load 原地重铸); ③ 政策缝整体替换; ④ 铺法边沿账本对齐当下 */
  if (showroomDevOn) return;
  showroomWorldEdits();
  advStore = mkShowroomStore(showroomDevBag(advStore.bag.inv));
  advProfile = showroomProfile;
  showroomNightWas = Daylight.isNight(dayTime);
  showroomDevOn = true;
}

function showroomDevRestore() {/* 还原真档缺省(adventure.js 顶层的两 const 缺省对象=还原锚点):
    此后进冒险/其他模式读真档、写真盘 */
  advStore = advStoreDefault;
  advProfile = advProfileDefault;
  showroomDevOn = false;
}

/* ---------- 模式门面: 钩子全委托冒险壳, 差异只在换装与 dev 特化 ---------- */
const ShowroomMode = mkMode({
  id: 'showroom',

  hotbar: AdventureMode.hotbar, /* 壳的快捷栏(dev bag 同 inv, 9 槽镜像/数字键/滚轮全自动) */
  chrome: {score: 'none', hotbar: 'flex'}, /* 对齐冒险壳(v2 的 'deferred' 退役) */

  init() {
    showroomDevInstall(); /* 装 dev(账本派生+dev store+dev 政策) → 壳 init 全链读篡改档 */
    AdventureMode.init();
    showroomNightWas = Daylight.isNight(dayTime); /* 铺法边沿账本对齐装载后的当下(dev 档恒清晨) */
    touchPlaying = true; /* input.js 的「进行中」态(无菜单页卡点击直进, v2 口径; 不接指针锁定) */
    overlay.style.display = 'none'; /* 直进: 收主菜单(v2 口径) */
  },

  cleanup() {/* 必须在 dev 装配下退场(幂等守卫: 异常路径未装也能正确退场): 退炉/兜底
      落盘全落进 noop; 收尾还原真档缺省——「退出无痕」红线在此闭环 */
    showroomDevInstall();
    AdventureMode.cleanup();
    showroomDevRestore();
    touchPlaying = false; /* 解「进行中」态(v2 口径) */
  },

  update(dt) {
    AdventureMode.update(dt); /* 喂序/使用链/昼夜/夜怪/AI/任务/灯笼全在壳 */
  },
  onMouse(button, hit) {
    AdventureMode.onMouse(button, hit);
  },
  onKey(code) {
    AdventureMode.onKey(code);
  },
  onHold(active) {/* 触屏长按连挖(input.js 手势路由) */
    AdventureMode.onHold(active);
  },
  onVoidFall() {
    AdventureMode.onVoidFall(); /* 壳的坠虚出口(dev 政策=原地复活) */
  },
  onPageHide() {
    AdventureMode.onPageHide(); /* dev journal 的关页兜底=flush 落进 noop(丢弃式) */
  },

  onMenu() {/* dev 特化(v2 口径): 面板开着=放鼠标不是回菜单(收 overlay 即可); 全关=回
      主页(体验馆无菜单页, 恢复菜单背景默认模式) */
    if (ADV.panelOpen || advFurnace.isOpen() || ADV.chestOpen) {
      overlay.style.display = 'none';
      return;
    }
    switchMode('arena');
    showPage('main');
  },

  hud(hit) {/* HUD 门面包层: 首行体验馆徽标, 其余行透传壳的 HUD(图名/生命/位置/时段/
      怪物/背包/任务——任务行在篡改档下显示终章称号) */
    return ['🧪 体验馆 · 冒险全开实验室 · B 回菜单'].concat(advHudLines(hit));
  },
});

/* ---------- 守门测试挂点(v2 挂点再别名到壳内部部件; adventure 的 .adv 先例,
    浏览器侧无害——共享词法环境直取壳顶层部件, 与 .adv 键名等价) ---------- */
ShowroomMode.stock = showroomPocket().rows; /* 套餐(派生产物, dev bag 的装配内容) */
ShowroomMode.getInv = () => advInv; /* 壳的真档 inv 对象——dev bag 包同一引用(②的解), 引用跨进场稳定 */
ShowroomMode.chest = () => advChest; /* 大宝箱全局账户动态读(dev 会话=顶格预填篡改档, 多箱同账户) */
ShowroomMode.pk = advPlaceKit; /* 放置链 kit 实例(壳的, 与冒险同一实现) */
ShowroomMode.mine = advMine; /* 蓄力状态机(壳的) */
ShowroomMode.fuses = advFuses; /* TNT 引信数组(壳的) */
ShowroomMode.tntTap = () => advTntTap; /* TNT 短按状态 getter(let 绑定经闭包读) */
ShowroomMode.pEnt = advGetPEnt; /* HP 实体 getter(壳的) */
ShowroomMode.snowballs = advSnowballs; /* 雪球弹池(壳的) */
ShowroomMode.sleep = advSleep; /* 睡觉转场状态(壳的) */
ShowroomMode.sr = {/* 站点触达面: 熔炉/合成/箱子三件(壳的 kit 实例与意图入口) */
  furnaces: advFurnace.map,
  panel: advFurnace.panel,
  isOpen: () => advFurnace.isOpen(),
  autoFill: (plan, key) => advFurnace.autoFill(plan, key),
  refundAll: () => advFurnace.refundAll(),
  craft: {panel: advPanel, isOpen: () => ADV.panelOpen, toggle: advPanelToggle,
    move: advInvMove}, /* move: 面板 onMove 同一函数(搬运政策, 测试缝) */
  chest: {panel: advChestPanel, isOpen: () => ADV.chestOpen, open: advChestOpenPanel,
    deposit: advChestDeposit, withdraw: advChestWithdraw}, /* 统一后=全局单账户(§4 行为变化) */
};

if (typeof module !== 'undefined' && module.exports) module.exports = ShowroomMode;
