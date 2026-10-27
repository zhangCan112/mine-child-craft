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
   (无需 conventions §6 登记)、不计儿童时限(gated:false)。挖/放/门/传送门
   经 place-kit 接入(§8, 与探险同一段规则代码); TNT 点燃/爆炸链同拍接入
   (探险 D3/D4 同规则: 纯函数直用 adventure-core, 引信/爆炸不进 place-kit
   既定口径; 爆炸波及怪物段不移植——显式推迟, 不在本票范围)。进食/雪球
   (票 B): 玩家 HP 实体(CombatKit.mkFighter, 探险 30/30 同款)+头顶血条+
   右键使用链补「吃→掷」两档(站点>床>门开关>吃>雪球>放置, 探险同序),
   规则零复制——吃判据 advEatPolicy 与雪球弹道常量 ADV_SNOWBALL_* 直用
   adventure-core, 实体/冷却轨道/弹池/血条全经 CombatKit 工厂。
   昼夜+夜怪+床睡觉(票 C, 探险昼夜 D1/D5/D6 同规则薄版): init 置
   dayCycleOn 白天起步(dayTime 绝不落盘——体验馆零存档红线, cleanup 复位
   三连 dayCycleOn=false+applyDaylight+dayTime=0, 探险 cleanup 同款三连的
   不落盘版); isNight 入夜上沿在**固定地面点位**铺夜怪(SHOWROOM.nightMobs,
   离床 ≥ ADV_BED_MOB_R+余量/避开站点门展台/屋外草场, 全带 __nightMob
   私有挂件——标记口径与探险 advNightTick/advSweepNightMobs 同一份),
   isNight 下降沿/睡觉唤醒 → 温和清场(只收标记怪)。白天展馆无怪, 入夜
   才有——与「退出恢复原装」红线自洽。AI 薄版(~30 行): 索敌半径内朝玩家
   走+贴身挥击(冷却轨道 CombatCore.tickCadence/伤害 advMobDmg 直用),
   怪打玩家 → HP 实体掉血 → 吃链激活; hp 到 0 走**薄死亡政策**(满血重置+
   清夜怪+原地复活+toast, 零惩罚, 不搬探险死亡流程)。左键 melee-aim 分支
   (探险 onMouse 同位): 锥内有怪本击归战斗, 挥击伤害 advSwingDmg/磨损与
   挖掘同一缝。床点击(使用先于挖放) → advSleepCheck(夜窗+床边无怪, 签名
   冻结直用) → #fade 遮罩+advSleepStep 转场(签名冻结直用) → 唤醒沿
   dayTime=0+清夜怪; 不设床边出生点(体验馆无死亡/回家政策)。显式推迟:
   advNightStepPool 动态夜刷环带(展厅屋顶刷怪风险+自定义光照 read 复杂度)、
   骷髅远程箭池(夜怪池不排骷髅, AI 薄版只做近战半边)、TNT 炸怪波及段。
   interface: ShowroomMode(mkMode 注册对象, id='showroom'; 无菜单页,
     卡点击直进) · ShowroomMode.stock(套餐挂点, 派生产物) / getInv()
     (内存背包 getter, 引用跨进场稳定) / crates(仓库箱挂点: list/账户/
     open) / sr(站点触达面: 熔炉 furnaces/panel/isOpen/autoFill/refundAll
     + 合成 craft + 箱子 chest) / pk(放置链 kit 实例) / mine(蓄力状态机) /
     fuses(TNT 引信数组) / tntTap()(TNT 短按状态 getter) / pEnt()(HP 实体
     getter) / snowballs(雪球弹池: count/clear 直驱) / sleep(睡觉转场状态:
     on/t, 测试直驱) — 守门测试挂点(adventure 的 .adv 先例, 浏览器侧无害)
   依赖(均经全局名, 调用期解析): SHOWROOM 布局常量(U3 迁至 js/showroom-core.js
      顶部, 本文件经全局名继续引用, 值零改动) · showroomPocket/showroomCrateRows/
     showroomDisplays(js/showroom-core.js 供给派生, 加载序在本文件之前) ·
     PlaceKit(js/place-kit.js 放置链, 加载序在 adventure.js 之后本文件之前) ·
     mkMode/ModeKit.spawn/ModeKit.mkHotbar/ModeKit.mkCraftPanel/ModeKit.
     mkChestPanel(js/mode-kit.js) · FurnaceKit(js/furnace-kit.js) ·
     CombatKit(js/combat-kit.js 玩家战斗: mkFighter/mkHurtAlarm/mkMelee/
     mkArrows/killBurst/resetFighter/mkHpBar, 加载序在本文件之前;
     Avatar/CameraRig 由其调用期消费) · CombatCore.tickCadence
     (js/combat-core.js 攻击节拍) · Mobs(js/mobs.js 怪物库: spawn/list/hit/
     update/render/remove/onDeath/clear, 引擎帧序契约 render 最后) ·
     Daylight.isNight/sleepWindow(js/daylight-core.js 纯核心) ·
     dayTime/dayCycleOn/applyDaylight(js/world.js 顶层绑定与场景驱动) ·
     advChestPut/advChestTake/ADV_STATION_R/ADV_TNT_FUSE/ADV_TNT_R/
     advTntTapStep/advExplodeCells/advEatPolicy/ADV_SNOWBALL_SPEED/
     ADV_SNOWBALL_G/ADV_SNOWBALL_KPOW/ADV_SNOWBALL_LIFE/ADV_SNOWBALL_CD/
     advSleepCheck/advSleepStep/ADV_BED_MOB_R/advMobDmg/advSwingDmg/
     advDeathDrops/ADV_NEST_AGGRO_R/ADV_ATTACK_T/ADV_MELEE_R/ADV_AIM_COS
     (js/adventure-core.js, TNT/进食/雪球/睡觉/伤害纯段直用) ·
     Drops(js/drops.js 掉落物实体, update/render/onCollect 三链) ·
     loadScene(js/world.js) · SceneKit(js/scene-kit.js) · WORLD_W/WORLD_D/
     BLOCKS/B_FURNACE/B_CRAFT/B_CHEST/B_BED/B_TORCH/B_DOOR/B_DOOR_TOP/
     B_GLASS_PANE/B_TNT/B_COAL_ORE/B_IRON_ORE/B_GOLD_ORE/B_DIAMOND_ORE/
     B_CLAY(js/config.js) · blockKey/getBlock/setBlockRaw(js/voxel.js) ·
     mkInventory/add/remove/moveSlot/count/isTool/toolOf/HOTBAR_SLOTS/
     INV_SLOTS(js/inventory-core.js) · ITEMS(js/items-core.js) ·
     pos(js/voxel.js) · Fx/showToast(js/effects.js, 爆炸/火花观感与 toast) ·
     touchPlaying(js/input.js) ·
     fps/overlay/switchMode/showPage(js/main.js, 加载序在后、调用期已就绪)
   可测性: THREE/DOM 全经 loadScene/ModeKit 惰性路径, boot 冒烟(vm 桩)
     全链可跑; 数据隔离/套餐/仓库箱/建场/三站点交互/放置链/TNT/进食/雪球/
     昼夜铺怪清场/AI/睡觉链/薄死亡由 test/showroom-mode.test.js 守门
     (供给派生不变量在 test/showroom-core.test.js)
   ============================================================ */

/* ---------- 场地常数: SHOWROOM 布局常量已迁 js/showroom-core.js(U3, 语义源唯一化——
   模式装配与展馆账本派生两处消费同参); 本文件经全局名继续引用, 值零改动 ---------- */

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

function showroomInvMove(from, to) {/* 背包格点选搬运(探险 advInvMove 同拍): moveSlot 纯核心搬移
  (空位搬家/同物并堆/异种对调, 耐久随堆), 搬成即刷快捷栏镜像——图标/名字只认 syncBar
  写的 item 字段, 不刷则关背包后快捷栏滞留旧物(2026-10-28 修复); 体验馆零存档/零音效
  (dev 降噪口径) */
  if (!moveSlot(showroomInv, from, to)) return;
  showroomSyncBar();
}

const showroomPanel = ModeKit.mkCraftPanel({
  inv: showroomInv, /* 引用跨进场稳定(原地重铸) */
  station: () => true, /* 全开: 台级配方随处可摆(dev 口径, 站点门禁是儿童引导不属调试场) */
  allow: (typeof KIT_HIDDEN_RECIPES !== 'undefined') ?
    KIT_HIDDEN_RECIPES.slice() : [], /* 隐藏配方全点亮(二期卡也进馆可测), 清单随 mode-kit 演进自动跟 */
  onCraft: () => showroomSyncBar(), /* 产物入包即刷快捷栏; 满包余量静默丢弃(dev 降噪, 与退炉余量同口径) */
  onMove: (from, to) => showroomInvMove(from, to), /* 背包格点选搬运(政策在本层, 面板只管格子) */
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

/* ---------- 放置链 kit 实例(place-kit, docs/showroom-design.md §8): 与探险
   同一段规则代码, 差异只在政策缝——零 journal(onEdit noop: 改动只活当次
   进场=恢复原装红线) · 零任务记账 · 观感静默(dev 降噪) · 掉落照掉(dev
   可测掉落物/拾取链) · 磨损简版(damageTool 扣减破板清槽, 无安抚话术)。
   左键蓄力挖 / 右键放 / 门开关 / 传送门结构放置全走与探险逐字同一实现。 ---------- */
/* 磨损简版(挖掘 wear 缝与挥击 onWear 共用一缝): 破坏/命中成功工具 −1,
   归零清槽(静默; 探险 advWearHeld 的降噪版, 无安抚话术) */
function showroomWearSel() {
  const slot = showroomHb.sel;
  const s = showroomInv.slots[slot];
  if (!s || !isTool(s.id)) return;
  if (damageTool(showroomInv, slot) === 0) remove(showroomInv, slot);
  showroomSyncBar();
}
let showroomMouseHeld = false; /* 桌面按住标志(document capture 监听, 探险同款) */
const showroomMine = {down: false, t: 0, key: '', need: 0, drops: true, swingT: 0};
const showroomPlaceKit = PlaceKit.mkEditor({
  inv: showroomInv, /* 引用跨进场稳定(原地重铸) */
  sel: () => showroomHb.sel,
  pos: () => pos,
  onEdit: () => {}, /* 无 journal: 不记账(恢复原装=世界随进场重铸, 无重放需求) */
  onConsume: () => showroomSyncBar(), /* 放置/磨损动包后快捷栏跟进 */
  cascade: {/* 级联 sink: 掉落照掉(掉落物/拾取链可测), 记账/任务/树苗撤表静默 */
    mark: () => {},
    sapling: () => {},
    drop: (id, n, x, y, z) => Drops.spawn(id, n, x, y, z),
    questMine: () => {},
  },
  wear: () => showroomWearSel(), /* 磨损简版(与挥击 onWear 同缝) */
  swing: () => {/* 挥动观感(Avatar 全局, Node 单测缺席静默) */
    if (typeof Avatar !== 'undefined' && Avatar) Avatar.swing();
  },
  mesh: {/* setBlockRaw 直写(传送门)后的网格收口: 引擎 seam, 探险同款守卫 */
    touch: (x, z) => {
      if (typeof markDirty === 'function') markDirty(x, z);
    },
    flush: () => {
      if (typeof flushDirty === 'function') flushDirty();
    },
  },
  /* say/speak/sfx/ring/onPlaced/hardText 全缺省 = dev 降噪静默(规则不受影响) */
});

/* 桌面按住检测(document capture 阶段, 先于 input.js 的 mousedown 路由;
   探险 advMouseListeners 同款——按住连挖, 松手本块完成即停) */
function showroomMouseHeldOn() {
  showroomMouseHeld = true;
}
function showroomMouseHeldOff() {
  showroomMouseHeld = false;
}
function showroomMouseListeners(on) {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  const opt = {capture: true};
  if (on) {
    document.addEventListener('mousedown', showroomMouseHeldOn, opt);
    document.addEventListener('mouseup', showroomMouseHeldOff, opt);
  } else {
    document.removeEventListener('mousedown', showroomMouseHeldOn, opt);
    document.removeEventListener('mouseup', showroomMouseHeldOff, opt);
  }
}

/* 掉落物收集回调(Drops.onCollect, init 挂/切模式随 Drops.clear 解除重挂, 探险
   advHookEntityCbs 同款): 入包并堆、并不下的进空位; 部分收下按收到的算, 一件
   都放不下才拒返 false(掉落物停地上 1.2s 冷却重试, D6 背包满口径); 快捷栏跟进。
   dev 降噪: 零 toast/零音效(探险的逐件播报不搬) */
function showroomHookDrops() {
  Drops.onCollect((id, n) => {
    const left = add(showroomInv, id, n);
    if (left >= n) return false;
    showroomSyncBar();
    return true;
  });
}

/* ---------- TNT 链(探险 D3/D4 同规则, docs/showroom-design.md §7 红线内):
   点燃/引信/爆炸壳段镜像 adventure.js, 规则零复制——短按二分 advTntTapStep、
   半径遍历 advExplodeCells 直用 adventure-core 纯函数(引信 1.5s/半径 3.5/
   不伤玩家都在其常量表); TNT 点燃不进 place-kit(GLOSSARY PlaceKit 词条既定
   口径)。政策差异只在缝: 零 journal(改动只活当次进场)/零任务记账(quest=false)/
   dev 降噪(只 toast); 波及怪物段不移植——体验馆不接 Mobs 子系统(无怪可炸)。 ---------- */
/* 炉兜底记账(探险 advMarkEdit 的体验馆镜像, 零 journal): 不记账(恢复原装=
   世界随进场重铸, 无重放需求), 唯一随行兜底=炉随世界走——改动格持有炉态而
   改后不是炉 → 挖炉退料三笔入包+炉态删除(FurnaceKit.drop, 探险 advMarkEdit
   同位同款); 爆炸 edit 与源块清格共用此缝防漏 */
function showroomMarkEdit(x, y, z, id) {
  if (id === B_FURNACE) return;
  const k = blockKey(x, y, z);
  if (showroomFurnace.state(k)) showroomFurnace.drop(k);
}
const showroomFuses = []; /* 已点燃引信 {x,y,z,t,sparkT}(纯内存, cleanup 清空) */
function showroomIgnite(x, y, z) {/* 点燃(重复点击不叠加, 探险同款) */
  for (const f of showroomFuses) {
    if (f.x === x && f.y === y && f.z === z) return;
  }
  showroomFuses.push({x, y, z, t: ADV_TNT_FUSE, sparkT: 0});
  showToast('🧨 点燃啦，快退后！');
}
function showroomFuseTick(dt) {/* 引信倒计时: 顶上火花弧观感 + 到点起爆(探险逐字同拍) */
  for (let i = showroomFuses.length - 1; i >= 0; i--) {
    const f = showroomFuses[i];
    f.t -= dt;
    f.sparkT -= dt;
    if (f.sparkT <= 0) {
      f.sparkT = 0.3;
      Fx.arc(f.x + 0.5, f.y + 1.2, f.z + 0.5, {color: 0xffd23f, dur: 0.22}); /* 引信火花 */
    }
    if (f.t <= 0) {
      showroomFuses.splice(i, 1);
      showroomExplode(f.x, f.y, f.z);
    }
  }
}
/* 爆炸结算: Fx.boom 观感 + 源块直清不经掷骰 + 半径遍历纯段 advExplodeCells
   (圈内 TNT 链式点燃/70% 掷骰掉落全在纯函数); edit sink 用本模式 place-kit
   实例拼装——级联 quest=false(TNT 掀掉的不算)+门配对整扇回收(onEdit 缝保持
   noop 红线, 只经 showroomMarkEdit 做炉兜底) */
const showroomExplodeSink = {
  ignite: showroomIgnite,
  edit: (bx, by, bz) => {
    showroomMarkEdit(bx, by, bz, 0); /* 炉兜底(零 journal, 探险 advMarkEdit 同位) */
    showroomPlaceKit.applyCascade(editBlock(bx, by, bz, 0), false);
    showroomPlaceKit.doorBreakApply(bx, by, bz, false); /* 掀门=整扇回收 */
  },
  sapling: () => {}, /* 树苗链未接入, 无计时可撤 */
  drop: (id, n, x, y, z) => Drops.spawn(id, n, x, y, z),
};
function showroomExplode(x, y, z) {
  Fx.boom(x + 0.5, y + 0.5, z + 0.5, {r1: ADV_TNT_R + 1.5, n: 14});
  showroomMarkEdit(x, y, z, 0);
  showroomPlaceKit.applyCascade(editBlock(x, y, z, 0), false);
  showroomPlaceKit.doorBreakApply(x, y, z, false); /* 源块正上方若立着门, 一并整扇回收 */
  advExplodeCells(x, y, z, getBlock, showroomExplodeSink);
}
let showroomTntTap = null; /* TNT 短按/按住二分状态 {x,y,z,held}|null(探险 advTntTap 同形) */
function showroomTntTapTick(dt) {/* 纯步进 advTntTapStep 在 adventure-core, 这里持状态与面板守卫 */
  const r = advTntTapStep(showroomTntTap, showroomMouseHeld,
      showroomCraftOpen || showroomChestOpen || showroomFurnace.isOpen(), dt);
  showroomTntTap = r.state;
  if (r.act && r.act.ignite && getBlock(r.act.x, r.act.y, r.act.z) === B_TNT) {
    showroomIgnite(r.act.x, r.act.y, r.act.z); /* 块还在才点(被掀走则作废) */
  }
  if (r.act && r.act.mine) showroomMine.down = true; /* 按住转蓄力(准星已移开则蓄力链自清) */
}

/* ---------- 玩家 HP 实体 + 进食 + 雪球(票 B 立链, 票 C 落怪激活): HP 实体是
   怪物战斗的地基——夜怪 AI 打玩家掉血、半血吃食物回血在馆内成环。规则零复制:
   吃判据 advEatPolicy、雪球弹道常量 ADV_SNOWBALL_* 直用 adventure-core,
   实体/冷却轨道/弹池/血条/受击提醒全经 CombatKit 工厂(不造第二份实现)。 ---------- */
/* 玩家战斗实体(探险 advPEnt 同形): hp 30/maxHp 30 探险同款; 体验馆无存档
   → 实体即唯一账本(无 ADV.player 镜像), cleanup 复位满血 */
const showroomPEnt = CombatKit.mkFighter({hp: 30, maxHp: 30});
/* 受击提醒(探险 advHurt 同件): 音+闪红+震屏+3s 节流话术全在 kit; 体验馆
   实体即账本 → 无 setHp 镜像缝(MobCore.hitState 直接写在实体上) */
const showroomHurt = CombatKit.mkHurtAlarm({});
/* 击杀观感(CombatKit.killBurst, 探险 advOnKill 瘦身): 碎块+计数 toast;
   掉落不在此——走 Mobs.onDeath 回调(见 showroomHookMobs) */
let showroomKillCount = 0;
function showroomOnKill(m) {
  showroomKillCount++;
  CombatKit.killBurst(m, showroomKillCount, {verb: '击杀'});
}
/* 近战(探险 advMelee 同件): 准星锥门槛/伤害/磨损/击杀全经注入——伤害
   advSwingDmg(手持工具 D9 表, 空手 3)、磨损与挖掘同一缝(showroomWearSel)、
   雪球投掷 swingAction 与挥击同一冷却轨道(下界弓口径); 冷却自持, update
   只喂 tick; aim 分支在 onMouse 左键(探险同位) */
const showroomMelee = CombatKit.mkMelee({range: ADV_MELEE_R, aimCos: ADV_AIM_COS,
  dmg: () => {
    const s = showroomInv.slots[showroomHb.sel];
    return advSwingDmg(s ? s.id : '');
  },
  onWear: () => showroomWearSel(), /* 命中才扣耐久(空手/非工具不扣) */
  onKill: (m) => showroomOnKill(m)});
/* 雪球弹池(T9 第二实例同形): sphere 白球·不 lookAt·muteSfx(kit 内置音全抑,
   馆内降噪); 零伤害红线落在逐发 spec(dmg 0 只击退); 命中即 Mobs.hit(dmg 0)
   天然生效, onHitMob 观感缝仍不需要(dev 降噪) */
const showroomSnowballs = CombatKit.mkArrows({mesh: 'sphere', color: 0xffffff,
  lookAt: false, muteSfx: true});
/* 头顶血条(探险 advHpBar 同款深接口): update 惰性建条, 重绘节流收在 kit */
const showroomHpBar = CombatKit.mkHpBar();

/* 吃食物(探险 advTryEat 镜像): 手持食物右键 → advEatPolicy 判据(满血不吃
   不扣; 金苹果 full 回满), remove 吃一口, 快捷栏跟进; 账本=实体本身 */
function showroomTryEat() {
  const slot = showroomHb.sel;
  const s = showroomInv.slots[slot];
  const it = s ? ITEMS[s.id] : null;
  if (!it || it.food == null) return false;
  const pol = advEatPolicy(showroomPEnt.hp, showroomPEnt.maxHp, it.food, it.full);
  if (!pol.canEat) {
    showToast('现在饱饱的，还不饿哦！');
    return true; /* 吃过 attempt 但没吃: 不进入放置(探险同款) */
  }
  showroomPEnt.hp = pol.hp;
  remove(showroomInv, slot, 1);
  showroomSyncBar();
  showToast('😋 吃掉 ' + it.name + '，生命 +' + pol.healed);
  return true;
}

/* 投掷雪球(T9 镜像): 手持雪球右键 — swingAction 占冷却(与挥击同轨, 冷却内
   连点被拒不扣), 弹沿准星出膛(低初速高重力), 消耗手持 1 颗; 零伤害红线:
   dmg 0 只击退(kpow 1.1), 掷出即算不问命中 */
function showroomTryThrowSnowball() {
  const slot = showroomHb.sel;
  const s = showroomInv.slots[slot];
  if (!s || s.id !== 'snowball') return false;
  showroomMelee.swingAction(showroomPEnt, {cooldown: ADV_SNOWBALL_CD, act: () => {
    showroomSnowballs.shootFromAim({speed: ADV_SNOWBALL_SPEED, dmg: 0,
      kpow: ADV_SNOWBALL_KPOW, g: ADV_SNOWBALL_G, life: ADV_SNOWBALL_LIFE});
    remove(showroomInv, slot, 1);
    showroomSyncBar();
  }});
  return true; /* 手持雪球: 点击恒算投掷 attempt, 不落放置(探险同款) */
}

/* 站点使用路由: 点击块号分流, 4 格门槛按点击块精确判距(返回 true=消费本次点击) */
function showroomUseStation(hit) {
  const lookId = getBlock(hit.x, hit.y, hit.z);
  const d = Math.hypot(hit.x + 0.5 - pos.x, hit.z + 0.5 - pos.z);
  if (d > ADV_STATION_R) {
    showToast('🚪 走近一点就能用啦');
    return true; /* 圈外只提示不误开, 点击照吞(探险 advUseStation 同款) */
  }
  if (lookId === B_FURNACE) {
    showroomFurnace.open(blockKey(hit.x, hit.y, hit.z));
    return true;
  }
  if (lookId === B_CRAFT) {
    showroomCraftToggle();
    return true;
  }
  if (lookId === B_CHEST) {
    const idx = showroomCrateList.findIndex((c, i) => {
      const p = showroomCratePos(i);
      return p.x === hit.x && p.z === hit.z;
    });
    if (idx >= 0) showroomOpenCrate(idx);
    return true;
  }
  return false;
}

/* ============================================================
   昼夜 + 夜怪 + 床睡觉(票 C, 探险昼夜 D1/D5/D6 同规则薄版)
   ------------------------------------------------------------
   时间本体 dayTime/dayCycleOn 是 world.js 顶层绑定(全局直写, 探险同款):
   init 白天起步 + cleanup 复位三连; dayTime 绝不落盘(体验馆零存档红线)。
   夜怪不走 advNightStepPool 环带(展厅屋顶刷怪风险+自定义光照 read 复杂度,
   显式推迟), 改 isNight 跨沿 + 固定点位铺怪(SHOWROOM.nightMobs); 清场
   只收 __nightMob 标记怪(标记口径与探险 advNightTick/advSweepNightMobs
   逐字同一份, 不发明第二套)。advMobAI 住探险壳且耦合其私有全局, 模式→
   模式直调禁止 → 近战半边镜像 ~30 行(骨架同源: 索敌/逼近/贴身挥击,
   判据与伤害全直用 adventure-core 纯函数)。
   ============================================================ */
let showroomWasNight = false; /* 入夜跨沿账本(isNight 上沿铺怪/下降沿清场; init 对齐当下) */

function showroomSpawnNightMobs() {/* 入夜上沿: 固定地面点位各铺 1 只(全带 __nightMob
    私有挂件——清场唯一依据, 探险 advNightTick 同一标记; 白天展馆无怪, 入夜才有) */
  for (const p of SHOWROOM.nightMobs) {
    const m = Mobs.spawn(p.type, p.x, p.z, {yaw: 0});
    m.__nightMob = true;
  }
}

function showroomSweepNightMobs() {/* 夜怪温和清场(探险 advSweepNightMobs 同形, dev 降噪
    零 TTS): 按 __nightMob 私有字段过滤(尸体一并收=「全部 __nightMob」口径), 原地
    灰白烟碎屑 + Mobs.remove; 不带标记的怪天然不清(脚本怪与昼夜解耦口径)。幂等 */
  let n = 0;
  for (const m of Mobs.list()) {
    if (m.gone || !m.__nightMob) continue;
    Fx.debrisBurst(m.pos.x, m.pos.y + 0.6, m.pos.z, 8, {color: 0xe6e6e6, life: 0.9});
    Mobs.remove(m);
    n++;
  }
  return n;
}

function showroomNightTick() {/* 昼夜跨沿(探险 advNightTick 同拍不同刷法): 上沿铺怪/
    下降沿清场; 下降沿(23000)比探险的 advDawnSweep 黎明沿(≈23517)略早, 只会更温和。
    夜内停留不加铺(边沿语义, 非节拍环带) */
  const night = Daylight.isNight(dayTime);
  if (night && !showroomWasNight) showroomSpawnNightMobs();
  if (!night && showroomWasNight) showroomSweepNightMobs();
  showroomWasNight = night;
}

function showroomMobAI(dt) {/* 夜怪 AI 薄版(探险 advMobAI 近战半边镜像): 索敌半径内
    朝玩家走+贴身挥击(冷却轨道 CombatCore.tickCadence/伤害 advMobDmg 直用);
    无收队(固定点位即家, 白天/睡觉清场兜底)/无远程(骷髅箭池显式推迟) */
  const p = showroomPEnt;
  for (const m of Mobs.list()) {
    if (m.dead || m.gone || !m.cfg || m.cfg.passive) continue;
    CombatCore.tickCadence(m, dt); /* 攻击节拍(战斗核心, 与探险/竞技场同一条) */
    const dxP = p.pos.x - m.pos.x; const dzP = p.pos.z - m.pos.z;
    const distP = Math.hypot(dxP, dzP) || 1e-9;
    const speed = m.cfg.speed || 2;
    let moved = 0; /* 本帧实际速度(喂步态) */
    if (!p.dead && distP <= ADV_NEST_AGGRO_R) {
      Mobs.steer(m, Math.atan2(dxP, dzP));
      if (distP > m.cfg.range) {/* 近战逼近 */
        Mobs.move(m, dxP / distP * speed * dt, dzP / distP * speed * dt); moved = speed;
      } else if (Math.abs(p.pos.y - m.pos.y) < 2.5 && m.attackCd <= 0) {/* 贴身打玩家 */
        m.attackCd = m.cfg.cd; m.attackT = ADV_ATTACK_T;
        const r = Mobs.hit(p, advMobDmg(m), p.pos.x - m.pos.x, p.pos.z - m.pos.z, 0.4);
        if (r.freshDead) showroomPlayerDied();
        else showroomHurt.hit(r); /* 非致命: 受击提醒(kit 全套观感) */
      }
    }
    Mobs.gait(m, dt, moved, ADV_ATTACK_T); /* 步态+战斗姿态(引擎同一入口) */
  }
}

function showroomPlayerDied() {/* 薄死亡政策(体验馆无死亡流程): 满血重置+清夜怪+原地
    复活+toast, 零惩罚; 不搬探险死亡流程(无死亡计划/无回家传送/无落盘)。
    原地而非回出生点: 清场后无威胁, 原地保住开发者当下的调试现场(准星/站位/面板) */
  const e = showroomPEnt;
  CombatKit.resetFighter(e); /* 复活五字段不变量(阵亡去向政策在此=原地) */
  e.hp = e.maxHp;
  showroomSweepNightMobs();
  showToast('💀 不怕不怕，满血原地重来！');
}

function showroomHookMobs() {/* 击杀掉落回调(探险 advHookEntityCbs 的掉落半边):
    onDeath → advDeathDrops 掷骰 → 逐条 Drops.spawn(过票 A 掉落物/真空拾取缝)
    ——击杀→掉落→拾取→入包全链馆内可玩; Mobs.clear 解除回调, init 重挂 */
  Mobs.onDeath((m) => {
    for (const s of advDeathDrops(m)) Drops.spawn(s.id, s.n, s.x, s.y, s.z);
  });
}

/* ---------- 床·睡觉转场(探险昼夜 D6 同规则, 判据/时间账纯函数签名冻结直用):
    #fade 是 index.html 共享 DOM——用完必须还原 transition/opacity(探险
    advSleepFadeReset 先例), 睡觉中切模式也归零不渗漏。与探险的唯一差异:
    不设床边出生点(体验馆无死亡/回家政策), 唤醒三连瘦身为两连。 ---------- */
const showroomSleep = {on: false, t: 0}; /* 转场状态: on=转场中(无床坐标——不设床边出生点) */

function showroomFadeEl() {/* #fade 全屏遮罩(index.html 既有 DOM; Node 测试取 document 桩) */
  return (typeof document !== 'undefined' && document.getElementById) ?
    document.getElementById('fade') : null;
}
function showroomFadeSet(op) {/* 直驱遮罩透明度: 关掉 CSS 自带 transition, 状态机逐帧接管 */
  const el = showroomFadeEl();
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = op;
}
function showroomSleepFadeReset() {/* 收尾/中断: 遮罩归零, transition 还回 CSS(昏迷/黑场既有语义) */
  const el = showroomFadeEl();
  if (!el) return;
  el.style.transition = '';
  el.style.opacity = 0;
}

function showroomTrySleep(hit, lookId) {/* 点击床(探险 advTrySleep 同形, onMouse 使用链
    床位): 两条件纯函数 advSleepCheck(夜窗+床边 ADV_BED_MOB_R 内无怪)不过 → 对应
    toast; 过 → 开转场。返回 true=消费本次点击(不放不挖) */
  if (!hit || lookId !== B_BED) return false;
  if (showroomSleep.on) return true; /* 转场中重复点击吞掉(输入另由 onMouse 顶层门挡) */
  const mobs = Mobs.list().map((m) => ({x: m.pos.x, z: m.pos.z, dead: m.dead, gone: m.gone,
    passive: !!(m.cfg && m.cfg.passive)})); /* 快照采集(passive 不拦口径与探险同份) */
  const chk = advSleepCheck(dayTime, mobs, hit.x + 0.5, hit.z + 0.5);
  if (!chk.ok) {
    showToast(chk.why === 'night' ? '🌙 晚上才能睡哦' : '👾 附近有怪物，睡不着');
    return true;
  }
  showroomSleep.on = true;
  showroomSleep.t = 0;
  showroomPlaceKit.mineStop(showroomMine); /* 蓄力中则收手(黑屏期不再挖) */
  return true;
}

function showroomSleepWake() {/* 唤醒沿两连(探险 advSleepWake 瘦身): 跳清晨+夜怪清场
    (sweep 幂等, 与白天下降沿清场同缝); 无出生点改写/无落盘(零存档红线) */
  dayTime = 0;
  showroomSweepNightMobs();
  showToast('☀️ 睡饱啦，天亮了！');
}

function showroomSleepTick(dt) {/* 转场推进(update 每帧): 纯函数时间账+遮罩直驱+唤醒沿 */
  if (!showroomSleep.on) return;
  const s = advSleepStep(showroomSleep.t, dt);
  showroomSleep.t = s.t;
  showroomFadeSet(s.opacity);
  if (s.wake) showroomSleepWake();
  if (s.phase === 'done') {
    showroomSleep.on = false;
    showroomSleepFadeReset();
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
    showroomSnowballs.clear(); /* 上一场的雪球不渗进来(T9 清场纪律, 探险 init/cleanup 双先例) */
    showroomMelee.reset(); /* 投掷冷却不复场(探险 advMelee.reset init 先例) */
    showroomPEnt.hp = showroomPEnt.maxHp; /* 进场满血(实体即账本; 探险进场血量复位同位) */
    CombatKit.resetFighter(showroomPEnt); /* 受击状态五字段复位(复活不变量) */
    /* 昼夜接线(票 C): 白天起步开循环(dayTime 绝不落盘——零存档红线);
       探险是另一个置位方, cleanup 三连保证互不渗入 */
    dayTime = 0;
    dayCycleOn = true;
    applyDaylight(); /* 进场先刷一次天色(探险同位) */
    showroomWasNight = Daylight.isNight(dayTime); /* 跨沿账本对齐当下(防首帧误触) */
    showroomKillCount = 0;
    Mobs.clear(); /* 清残留怪(switchMode 兜底外的双保险, 探险 init 同位) */
    showroomHookMobs(); /* 击杀掉落回调重挂(Mobs.clear 解除后, 探 advHookEntityCbs 同款) */
    showroomHurt.reset(); /* 受击话术节流不复场(kit 自持) */
    showroomSleep.on = false; /* 睡觉转场不跨场(双保险; cleanup 先例) */
    showroomSleep.t = 0;
    showroomSleepFadeReset(); /* 上一场遮罩不渗入(#fade 共享 DOM 纪律) */
    showroomMouseListeners(true); // 桌面按住检测(document capture, 探险同款)
    showroomHookDrops(); // 收集回调重挂(切模式 Drops.clear 解除后, 探险同款)
  },

  cleanup() {/* 收场: 收双面板(合成 close 链退台面余料) + 蓄力停 + 按住监听摘 +
    TNT 引信/tap 复位(引信不落盘, 探险先例) + 雪球弹池清空 + HP 实体复位
    满血 + 投掷冷却归零(跨进场不渗漏, 探险清场纪律先例) + 退炉三笔入包 +
    收炉面板 + 昼夜复位三连/夜怪清场/睡觉转场与遮罩归零/受击节流与击杀
    计数复位/血条回收(票 C, 全部不渗入其他模式) + 解「进行中」态(零掉落物,
    余量静默丢弃 dev 口径) */
    showroomCraftClose();
    if (showroomChestOpen) showroomChestPanel.close();
    showroomPlaceKit.mineStop(showroomMine);
    showroomMouseListeners(false);
    showroomTntTap = null; /* TNT 短按判定一并复位 */
    showroomFuses.length = 0; /* 引信不落盘 */
    showroomSnowballs.clear(); /* 上一场的雪球不渗进来(T9 清场纪律, 探险 cleanup 先例) */
    showroomMelee.reset(); /* 投掷冷却不复场(kit 自持账本复位, 探险 advMelee.reset 同款) */
    showroomPEnt.hp = showroomPEnt.maxHp; /* HP 复位满血(实体即账本, 体验馆无存档镜像) */
    CombatKit.resetFighter(showroomPEnt); /* 受击状态五字段复位(复活不变量) */
    /* 昼夜复位三连(探险 cleanup 同款的不落盘版): 关循环+白天观感+时刻归零
       ——其他模式不再被每帧昼夜驱动打扰, 重进恒白天起步 */
    dayCycleOn = false;
    dayTime = 0;
    applyDaylight();
    showroomWasNight = false; /* 跨沿账本复位 */
    Mobs.clear(); /* 夜怪清场+解除击杀回调(switchMode 兜底外的双保险, 探险 cleanup 同款) */
    showroomKillCount = 0;
    showroomSleep.on = false; /* 睡觉转场中断复位(未到唤醒沿不跳清晨——此处三连已把时刻归零) */
    showroomSleep.t = 0;
    showroomSleepFadeReset(); /* 遮罩归零还 CSS transition, 不渗入其他模式 */
    showroomHurt.reset(); /* 受击话术节流复位 */
    showroomHpBar.dispose(); /* 头顶血条回收(S2 深接口, 探险 cleanup 同款) */
    showroomFurnace.refundAll();
    showroomFurnace.panel.hide();
    touchPlaying = false;
  },

  update(dt) {
    showroomFurnace.tick(dt); // 烧炼节律常开(多炉逐炉推进, 面板只是回显)
    showroomPlaceKit.tickTimers(dt); // 话术节流递减(账本在 kit 实例; 体验馆静默)
    showroomSleepTick(dt); /* 床·睡觉转场推进(票 C): 遮罩直驱+唤醒沿跳清晨/清夜怪 */
    showroomMelee.tick(dt); /* 挥击/投掷冷却递减(kit 自持, update 只喂 tick; 探险同款喂法) */
    showroomHurt.tick(dt); /* 受击话术节流递减(kit 自持; 探险同款喂法) */
    showroomFuseTick(dt); /* TNT 引信倒计时到点起爆(先于蓄力: 当帧爆炸位置不漂移, 探险同款) */
    showroomTntTapTick(dt); /* TNT 短按/按住判定: 转蓄力需先于 mineTick 同帧生效 */
    /* 蓄力挖 → 破坏结算(级联/门配对/掉落)全在 place-kit, 与探险同一实现 */
    showroomPlaceKit.mineTick(showroomMine, PlaceKit.aimHit(), dt,
        {held: showroomMouseHeld,
          panelOpen: showroomCraftOpen || showroomChestOpen || showroomFurnace.isOpen()});
    showroomNightTick(); /* 昼夜跨沿(票 C): 入夜上沿铺怪/下降沿清夜怪(边沿语义) */
    showroomMobAI(dt); /* 夜怪 AI 薄版: 索敌逼近+贴身挥击(伤害→HP 实体→吃链激活) */
    Mobs.update(dt); /* 怪物本能(受击闪白/死亡时序; 帧序契约: 与模式 AI 相对顺序宽容) */
    Mobs.render(); /* 合批渲染(帧序契约: 必在模式 AI 之后) */
    showroomSnowballs.update(dt); /* 雪球弹道步进+命中扫描(零伤害 spec; 探险双实例并喂同拍) */
    Drops.update(dt, {x: pos.x, y: pos.y + PLAYER.height * 0.62, z: pos.z}); /* 真空拾取(挖掘/击杀两链共用, 玩家胸口点) */
    Drops.render();
    showroomHpBar.update(showroomPEnt.hp, showroomPEnt.maxHp,
        pos.x, pos.y + 2.2, pos.z); /* 头顶血条(头顶 2.2 格, 重绘节流收在 kit; 探险同位) */
  },

  onMouse(button, hit) {/* 探险同款次序: 左键 = TNT 短按记账 > 站点使用 > 床睡觉 > 门开关 >
      挥击瞄准(锥内有活怪本击归战斗, 冷却中也占住不落挖, 票 C 接入) > 蓄力挖;
      右键 = 站点使用 > 床睡觉 > 门开关 > 吃 > 雪球 > 放置(TNT 点燃不走右键,
      探险防误触拍板同款); 睡觉黑屏期照探险加顶层门 */
    if (showroomCraftOpen || showroomChestOpen || showroomFurnace.isOpen() ||
        showroomSleep.on) return; /* 面板/睡觉黑屏遮罩兜底: 不挖不放不打 */
    if (button !== 0 && button !== 2) return;
    const lookId = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
    if (button === 0 && lookId === B_TNT) {/* TNT(D3 探险镜像): mousedown 只记账不点燃
        — 短按=点燃/按住=蓄力挖走回收, 判定在 update 的 showroomTntTapTick */
      showroomTntTap = {x: hit.x, y: hit.y, z: hit.z, held: 0};
      return;
    }
    const stationHit = lookId === B_FURNACE || lookId === B_CRAFT || lookId === B_CHEST;
    if (stationHit) {
      showroomUseStation(hit); /* 圈内外都吞点击(圈外只提示不误开) */
      return;
    }
    if (showroomTrySleep(hit, lookId)) return; /* 床: 点击睡觉(使用先于挖/放, 探险同位) */
    if (showroomPlaceKit.tryDoorToggle(hit, lookId)) return; /* 使用先于挖/放(MC 正典) */
    if (button === 0) {
      if (showroomMelee.aim(showroomPEnt)) {/* 准星锥内有活怪: 本击归战斗(票 C, 探险同位) */
        showroomMelee.swing(showroomPEnt);
        return;
      }
      if (hit) showroomMine.down = true; /* 准星指住方块: 蓄力开始(推进在 update) */
    } else {
      if (showroomTryEat()) return; /* 手持食物: 右键吃(使用档在门与放置之间, 探险同序) */
      if (showroomTryThrowSnowball()) return; /* 手持雪球: 掷出(使用档在吃与放置之间, T9) */
      showroomPlaceKit.tryPlace(hit); /* 放置(单格/门/传送门结构, kit 全链) */
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

  onHold(active) {/* 触屏长按连挖(input.js 手势路由): 复用桌面按住标志(探险同款) */
    showroomMouseHeld = active;
  },

  hud() {
    return [
      '🧪 体验馆 · 冒险全开实验室 · B 回菜单',
      'Tab 背包与配方书 · 左键挖/挥击 · 右键放 · 走近 工作台/熔炉/箱子/床 点击使用',
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      Daylight.isNight(dayTime) ? '🌙 夜晚 · 怪物在馆外游荡' : '☀️ 白天', /* 时段两态(票 C, 探险 L2207 薄化) */
      'FPS ' + fps,
    ];
  },
});

/* 守门测试挂点(adventure 的 .adv 先例; 浏览器侧无害) */
ShowroomMode.stock = showroomPocketRows.rows; // 套餐(派生产物; 旧材料表挂点同名延续)
ShowroomMode.getInv = () => showroomInv;
ShowroomMode.crates = {list: showroomCrateList, accounts: () => showroomCrateAccounts,
  put: showroomCratePut, take: showroomCrateTake}; // 存/取意图(政策函数, 与面板回调同路)
ShowroomMode.pk = showroomPlaceKit; // 放置链 kit(放置/破坏/门开关, 与探险同一实现)
ShowroomMode.mine = showroomMine; // 蓄力状态机(形状同探险 advMine, 测试直驱)
ShowroomMode.fuses = showroomFuses; // TNT 引信数组(测试直驱, 探险 advFuses 先例)
ShowroomMode.tntTap = () => showroomTntTap; // TNT 短按状态 getter(let 绑定经闭包读)
ShowroomMode.pEnt = () => showroomPEnt; // HP 实体 getter(测试直驱血量; adventure advGetPEnt 先例)
ShowroomMode.snowballs = showroomSnowballs; // 雪球弹池(count/clear 测试直驱, fuses 先例)
ShowroomMode.sleep = showroomSleep; // 睡觉转场状态(测试直驱 on/t; adventure advSleep 先例)
ShowroomMode.sr = {
  furnaces: showroomFurnace.map,
  panel: showroomFurnace.panel,
  isOpen: () => showroomFurnace.isOpen(),
  autoFill: (plan, key) => showroomFurnace.autoFill(plan, key),
  refundAll: () => showroomFurnace.refundAll(),
  craft: {panel: showroomPanel, isOpen: () => showroomCraftOpen, toggle: showroomCraftToggle,
    move: showroomInvMove}, /* move: 面板 onMove 同一函数(搬运政策, 测试缝) */
  chest: {panel: showroomChestPanel, isOpen: () => showroomChestOpen, open: showroomOpenCrate},
};

if (typeof module !== 'undefined' && module.exports) module.exports = ShowroomMode;
