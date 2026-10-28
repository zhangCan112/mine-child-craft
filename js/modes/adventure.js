'use strict';
/* ============================================================
   探险模式 (AdventureMode) — 应用层·模式壳
   ------------------------------------------------------------
   物品与合成系统的第一个消费者(设计稿 D11)。本文件是壳: mkMode 装配 /
   THREE·DOM 观感 / 话术与 toast / 生命周期与存档; 全部政策纯函数与
   地形/任务表在 js/adventure-core.js 与 js/adventure-maps-core.js
   (先于本文件加载, 政策口径以其头注释与段注释为权威——此处只留指针)。
   特性叙事与拍板史按主题下沉在设计稿(改行为先读对应稿):
   · 物品/合成/烧炼/大宝箱/任务链 → docs/item-crafting-design.md ·
     docs/story-quest-research.md
   · 下界相位/传送门 → docs/nether-merge-design.md
   · 多地图远征/门阵 → docs/adventure-maps-design.md
   · 昼夜·夜怪·床·灯笼 → docs/mc-daylight-torch-design.md §2/§6/§7/§8
   · 统一冒险壳/dev profile → docs/adventure-shell-unification-design.md(ADR 0005)
   现行行为速览(逐特性细节见上列设计稿与 GLOSSARY「探险模式」「冒险地图」
   「下界传送门」「牧场」「大宝箱」词条):
   160×160 确定性草原(2026-10-27 扩容)四图远征 home/沙漠/雪原/沼泽 +
   下界相位(恒夜暗红天, 唯一危险=岩浆, 死亡切回上界); 出生小屋门口,
   血量 30+头顶血条; 挖放按住蓄力(tier 不足只碎不掉+TTS 节流)、掉落
   真空拾取、树苗 20s 长成(计时 Map 不落盘); 工作台/熔炉走近 4 格解锁,
   炉态随档持久化(挖炉/掀炉退料); TNT 延时爆炸不伤玩家; 牧场「收获」
   口径; 大宝箱全局单账户; 任务链 15 步+终章(事件挂点只向计数账本累计,
   0.5s 节流查步不越级); 死亡零惩罚(背包保留+满血回出生点+TTS 安抚);
   昼夜: 唯一置位 dayCycleOn 的模式(时间推进在 main.js 主循环, 重进
   时间连续); 提醒: 低耐久语音预警+背包快满一次性 toast+TTS; 与竞技场/
   建造/坦克共享儿童时限(gated, 不新增账本); 存档四份——背包(ADR 0002,
   经 backpack 壳唯一持有)/世界(确定性重建+edits 重放+玩家态+dayTime)/
   任务/宝箱, 触点收拢进存档 store 缝 advStore(ADR 0005 票 U1, 真档
   adapter 缺省装配, 触点口径见该缝头注释)。
   interface: AdventureMode(mkMode 深接口: init/cleanup/update/onKey/
     onMouse/hud/touch) · AdventureMode.adv — 接线挂点与单测触达面(31 键:
     状态账本/存档 seam·getSaveView 只读快照/布置缝/交互链入口/丢弃与扩容
     执行器(advDropSlot/advTryExpandBag/advReclaimThrown, 2026-10);
     adventure-core 的常量表与纯函数不再转发——测试侧 core 直调)
   依赖(均经全局名, 调用期解析): adventure-core 的常量表与政策纯函数 ·
      adventure-maps-core 的 ADV_MAPS/advMapArrive/advMapArriveAt/
       advMapUnlocked/advGateHoldStep(地图行数据与门阵政策, index.html
      加载序: adventure-core → adventure-maps-core → 本文件) ·
     backpack.js 的 Backpack · config.js 的 BLOCKS/PLAYER/B_* 常量 ·
     voxel.js 的 getBlock/blockKey/raycastVoxel/collidesAtPlayer ·
     world.js 的 loadScene/editBlock · items-core 的 ITEMS/isTool/toolOf/durOf ·
     item-use-registry 的 itemUses(使用动作注册表, 加载序在 items-core 后) ·
     inventory-core 的 add/count/remove/moveSlot/take/damageTool/serialize · craft-core 的
     breakTime/fuelUnits · drops.js 的 rollBlockDrop/rollDrops(纯)/
     spawn/update/onCollect/clear · mobs.js 的 spawn/hit/onDeath/update/
     render/steer/move/gait/debrisColor/clear(退出清场) · combat-core.js
     的 CombatCore(节拍/弹道/盒判定) · effects.js 的 sfx/Fx(boom/arc/
     pop/debrisBurst 爆炸·引信·仪式观感) · input.js 的 Input.holdPt(触屏
     长按屏幕点, 进度环跟手) · mode-kit.js 的 mkMode/mkHotbar/mkCraftPanel/mkFurnacePanel/
     mkChestPanel(大宝箱)与 CombatKit 玩家战斗件套(mkFighter/mkHurtAlarm/
     mkMelee/mkArrows/mkHpBar 头顶血条, C6-T3) · sync.js 的 SyncDB.slot ·
     world-journal-core.js 的 mkWorldJournal/fluidCell(世界改动日志: edits 账本/脏标/
     5s 节流/关页兜底/流体格双通道重放收编深模块, 建造同款互锁) · speech.js 的
     SpeechKit · avatar.js 的 Avatar(setItem/swing/flash) · icons 的 drawArt 与
     button-icons 的 BTN_PIX.flame(炉口火焰贴图)与 btnImg(时段图标, 两者加载序
     在本文件之后, 运行期才取——F2/昼夜 D1) · world.js 的 dayTime/dayCycleOn/
     applyDaylight 与 daylight-core 的 Daylight(昼夜, 跨文件可写绑定)
   可测性: THREE/DOM 惰性创建(头顶血条/箭矢网格/进度环/炉口火焰), Node 测试可
     安全加载(test/adventure-mode.test.js, 真引擎件经 vm 装载)
   ============================================================ */

/* ---------- 模式状态账本(常量表与政策纯函数在 adventure-core.js) ---------- */
/* 当前地图行(冒险地图 T2 池参数化): 巢穴池/夜怪池的读取权威——壳层一切池
   消费经此行, 不再直读 ADV_NESTS/ADV_NIGHT 常量; 缺省 home 行与常量同一
   引用, home 池行为逐字节不变(本票红线)。ADV_MAPS 各行以替换语义自带
   nests/nightPool, advSetMap 在此换装(行内容见 js/adventure-maps-core.js) */
let advMapRow = ADV_HOME_ROW;
let advMap = 'home'; /* 当前主世界图(advSetMap 唯一入口; nether 期间保持最后主世界图) */
const ADV_SCENE_KEYS = ADV_MAPS.map((r) => r.id).concat(['nether']); /* 分桶键全集(注册表派生) */
const ADV_WATER_ALL_DEFAULT = [BLOCKS[B_WATER].all[0], BLOCKS[B_WATER].all[1],
  BLOCKS[B_WATER].all[2]]; /* 水色缺省(cleanup 复位, 不渗其他模式; 逐元素抄=宿主域数组) */
const ADV = {ground: ADV_GROUND, spawn: ADV_SPAWN, hut: ADV_HUT, lake: ADV_LAKE,
  pits: ADV_PITS, cave: ADV_CAVE, nests: advMapRow.nests,
  player: {hp: 30, maxHp: 30}, quest: {step: 0, counts: {}}, panelOpen: false,
  chestOpen: false, killCount: 0, swingCd: 0, homeCd: -1e9};

/* ---------- 世界/任务两份存档(D12): mkSaveSlot 语义, SyncDB 槽创建即注册回填 ----------
    全局唯一背包存档不在此开键——经背包壳 js/backpack.js 唯一持有
    (ADR 0002: 专注训练营等未来消费方同走该壳, 不得自开键) */
const ADV_WORLD_KEY = 'adventure_world_save';
const ADV_QUEST_KEY = 'adventure_quest_save';
function advSceneEditsDecode(sv) {/* 档 → 桶账本(T6 分桶泛化, 三档型全兼容, 全函数式
    不抛错): 新形状 edits={home:[…],desert:[…],…} 按键收养(Map/数组皆可);
    一代老档(裸 edits 数组)全归 home 桶; 二代老档(顶层 netherEdits)迁入 nether
    桶——对已归一化的桶对象幂等(重进/坏档兜底再走一遍结果不变) */
  const out = {};
  for (const k of ADV_SCENE_KEYS) out[k] = new Map();
  const e = sv && sv.edits;
  if (Array.isArray(e)) {
    out.home = new Map(e); /* 一代老档: 两界合并前的裸 edits 恒属于 home */
  } else if (e && typeof e === 'object') {
    for (const k of ADV_SCENE_KEYS) {
      const v = e[k];
      if (v instanceof Map) out[k] = v;
      else if (Array.isArray(v)) out[k] = new Map(v);
    }
  }
  const ne = sv && sv.netherEdits;
  if (!(e && typeof e === 'object' && !Array.isArray(e) && e.nether != null)) {
    if (ne instanceof Map) out.nether = ne; /* 二代老档: 顶层 netherEdits 迁入 nether 桶 */
    else if (Array.isArray(ne)) out.nether = new Map(ne);
  }
  return out;
}
function advSceneEditsEncode(b) {/* 桶账本 → 档(五桶恒写全: 形状确定, 空桶写空数组) */
  const out = {};
  for (const k of ADV_SCENE_KEYS) out[k] = [...b[k].entries()];
  return out;
}
function advLivestockDecode(v) {/* 牧场账按图归一(档形 v3): 五桶各经
    advLivestockNormBucket 收敛历代档形(v3 {dead,bred,sheared} / v2 {dead,bred} /
    二代索引数组 / 老单账 {dead:[..]}→home 桶); 拷贝入账(档文本与运行账不共享引用) */
  const out = {};
  for (const k of ADV_SCENE_KEYS) out[k] = advLivestockNormBucket(v && v[k]);
  if (v && Array.isArray(v.dead)) {/* 老单账优先(两形状并存时; 三栏形状恒完整——缺 sheared 是残缺桶) */
    out.home = {dead: v.dead.slice(), bred: [], sheared: {}};
  }
  return out;
}
function advOreRegenDecode(v) {/* 矿位开采账归一(生态恢复 C 通道): 只收 {<场景>:x,y,z: 日期串},
   异形键值整条丢弃(坏档兜底空账) */
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k in v) {
      if (typeof v[k] === 'string' && advOreParseKey(k)) out[k] = v[k];
    }
  }
  return out;
}
const advWorldSlot = SyncDB.slot(ADV_WORLD_KEY, {
  /* v2(2026-10-28 门号段迁移): 熄门 B_PORTAL_DIM 占 63 把门段从 63~67 推到
     64~68(5708c24), 间隙档的旧 id = 关门读作熄门(solid:false 能穿透)/开门读作
     门上半(实心挡路)。migrate 链(from ≥1): advDoorIdsMigrate 检 63 铁证即整体
     +1(判据与局限见 adventure-core 同名段), 落盘 _v:2 后不再进链; from 0 无
     操作——v0 档早于门与玻璃板, 天然无门 id */
  version: 2,
  migrate: (s, from) => (from >= 1 ? advDoorIdsMigrate(s) : s),
  /* map: 当前主世界图键(老档缺省 home; nether 期间保持最后主世界图——维度不进档 D9,
     重进 pos=null → 该图回程门出生); pos(含 yaw)/hp: 玩家状态随世界档(仅主世界图随
     当前图存); furnaces: 每炉独立炉态(F1 拍板①, 炉键带图/界前缀); livestock: 牧场账
     **按图分桶**(档形 v3: {dead 死畜索引, bred 繁育账, sheared 初始畜剪毛账},
     初始清单可推导);
     oreRegen: 矿位开采账(生态恢复, '<场景>:x,y,z'→'Y-M-D', 跨天回填); dayTime: 昼夜全局单钟 */
  /* v3(2026-10-28 剪羊毛): livestock 桶增剪毛账 sheared({初始畜索引: 剪毛时刻
     dayTime}; 繁育畜剪毛时刻挂 bred 条目上)——跨天长回判据的持久化半边 */
  defaults: {edits: [], map: 'home', pos: null, hp: null, furnaces: [],
    livestock: {home: {dead: [], bred: [], sheared: {}}, desert: {dead: [], bred: [], sheared: {}},
      snow: {dead: [], bred: [], sheared: {}}, swamp: {dead: [], bred: [], sheared: {}},
      nether: {dead: [], bred: [], sheared: {}}},
    oreRegen: {}, dayTime: 0},
  /* livestock defaults 自带五桶全键: 无档路径 clone(defaults) 不经 decode
     (save-slot load 语义), 半形状 defaults 会让播种读 undefined 桶——
     形状必须两条路径都成立 */
  encode: (st) => ({edits: advSceneEditsEncode(st.edits),
    map: st.map,
    pos: st.pos || null,
    hp: (typeof st.hp === 'number') ? st.hp : null,
    furnaces: advFurnaceClean(st.furnaces), /* 空炉条目清扫(存档防膨胀) */
    livestock: st.livestock || {},
    oreRegen: st.oreRegen || {},
    dayTime: (typeof st.dayTime === 'number') ? st.dayTime : 0}),
  decode: (sv) => ({edits: advSceneEditsDecode(sv), /* 桶归一(三档型兼容, 幂等) */
    map: ADV_SCENE_KEYS.indexOf(sv.map) >= 0 && sv.map !== 'nether' ? sv.map : 'home', /* 坏键兜底 home */
    pos: sv.pos || null,
    hp: (typeof sv.hp === 'number') ? sv.hp : null,
    furnaces: new Map((sv.furnaces || []).filter((e) => advFurnaceValid(e && e[1]))), /* 非法炉态整条拒收 */
    livestock: advLivestockDecode(sv.livestock), /* 按图分桶归一(三代档形收敛) */
    oreRegen: advOreRegenDecode(sv.oreRegen), /* 矿位开采账归一(缺省 {}) */
    dayTime: (typeof sv.dayTime === 'number' && sv.dayTime >= 0 && sv.dayTime < DAYLIGHT.TICKS) ?
      sv.dayTime : 0}), /* 越界/坏档兜底清晨 */
});
/* T15 任务进度: mkSaveSlot defaults 只补缺失字段——老档 {step:N} 自动补空 counts */
const advQuestSlot = SyncDB.slot(ADV_QUEST_KEY, {defaults: {step: 0, counts: {}}});
/* 引导链 v2 大宝箱: 全局共享账户(所有放置的箱子同一份存储; 挖掉箱子内容
   保留在账户里, 零损失)——defaults 只补缺失字段, init 归一化成满长槽数组。
   两轨容量(ADR 0007): 存档 size 字段=材料阶梯基础格 base; 总容量 size =
   base + ADV_CHEST_PER×现存箱子数(chests 由世界账本现算, 不落盘) */
const ADV_CHEST_KEY = 'adventure_chest_save';
const advChestSlot = SyncDB.slot(ADV_CHEST_KEY, {defaults: {size: ADV_CHEST_START, slots: []}});
let advChest = {size: ADV_CHEST_START, base: ADV_CHEST_START, chests: 0, slots: []}; /* 账户本体(init 换装) */

/* ---------- 下界相位·地图态与按图分桶 edits 账本(D8 泛化, 票据 T6) ----------
     切图/切界 = advStore.journal.edits 换装当前桶(build 模式 buildEdits[id] 同款缝):
     journal 的 mark()/flush() 动态查 J.edits, 记账/重放/落盘全自动跟桶。
     桶键 = 四张主世界图 + nether(两界机制的 netherEdits 桶并入同一封套);
     各桶在 init 里从档收养(老档两代自动迁移, 见 advSceneEditsDecode);
     pos 仅主世界图随当前图存, nether 期间存 null(D9: 维度不进档) */
let advDim = 'overworld'; /* 当前维度(切界唯一入口 advSetDim; nether 期间 advMap 不动) */
let advPortalCd = 0; /* 传送冷却秒(ADV_PORTAL.cd): 落地空眩晕, 两界门都不触发 */
let advExitSpot = null; /* 回上界落点(进门时刻 advPortalExit 的记录, 最后进入者优先 D6) */
const advSceneEdits = {}; /* 桶账本(advSceneEditsDecode 归一化形状; init 装桶) */
for (const k of ADV_SCENE_KEYS) advSceneEdits[k] = new Map();
function advSceneKey() {/* 当前场景键('nether'|地图 id)——换桶/炉键/火焰门禁的单一口径 */
  return advDim === 'nether' ? 'nether' : advMap;
}

/* 世界改动日志(WorldJournal, js/world-journal-core.js): edits 账本/脏标/5s 节流/
   关页兜底/双通道重放五件事收编深模块(两模式互锁); 探险适配器只出档形政策——
   payload 键随读随装(两界桶各归各键), 背包+任务档在主档之后联写; 全量落盘时机
   (节流/退出兜底/死亡·回家·睡醒即时)由 journal 的 flush/tick/pageHide 统一驱动 */
const advJournal = mkWorldJournal(advWorldSlot, {
  payload: () => ({/* 桶账本整封装套(不变式: advStore.journal.edits === advSceneEdits[当前键],
      由 init/advSetMap/advSetDim/cleanup 四处换装维持)——mark/flush 记的账
      自动落在当前桶里, 各图互不串档(T6 分桶红线) */
    edits: advSceneEdits,
    map: advMap, /* 当前主世界图键(nether 期间保持最后主世界图) */
    pos: advDim === 'nether' ? null : {x: pos.x, y: pos.y, z: pos.z, yaw}, /* D9 */
    hp: ADV.player.hp, furnaces: advFurnaces, livestock: advLivestockAll, oreRegen: advOreRegen, dayTime}),
  onFlush: () => {/* 伴随联写经存档 store 缝: U3 换装 dev store 后三档联写自动跟丢弃语义 */
    advStore.saveBag(); /* 背包存档经背包壳(ADR 0002), 形状与时机不变 */
    advStore.saveQuest(ADV.quest); /* T15: 任务进度随 5s 节流一起落盘(步进时另有即时落盘) */
  },
});
let advLivestockAll = {home: {dead: [], bred: [], sheared: {}}, desert: {dead: [], bred: [], sheared: {}},
  snow: {dead: [], bred: [], sheared: {}}, swamp: {dead: [], bred: [], sheared: {}},
  nether: {dead: [], bred: [], sheared: {}}};
/* 牧场账按图分桶(档形 v3; init 从世界档换装): dead=初始死畜索引(只增不减,
    初始清单可推导); bred=繁育账 [{k: 怪物键, b: 出生日'Y-M-D', sheared?: 剪毛
    时刻}](死亡=除名); sheared=初始畜剪毛账 {索引: 剪毛时刻 dayTime}(长回=销账);
    游荡位置不存档, 重进回群位锚点 */
let advOreRegen = {}; /* 矿位开采账(生态恢复 C 通道): '<场景>:x,y,z'→'Y-M-D' 开采日,
    跨天回填(拍板②); init 从世界档换装, 回填/销账即 touch */
const advTreeRegen = new Map(); /* 凋零树位恢复计时 "x,y,z"→{x,y,z,left}; 计时不落盘,
    重进经 advRescanTreeRegen 重建(树苗同惯例; 仅 home 图——树位清单是 home 常量派生) */
/* 站点坐标缓存(T13): "x,y,z"→{x,y,z,id}——B_CRAFT/B_FURNACE 只可能来自玩家
   放置(edits 全量差异), 重进由 advRescanStations 重放收集, 增删经 advMarkEdit
   顺路维护——advStationOk 只查缓存, 不每帧扫全图 */
const advStations = new Map();

function advMarkEdit(x, y, z, id) {/* T12 挖掘/放置在 editBlock 后调此记账(build 同款); T13 顺路维护站点缓存 */
  const k = blockKey(x, y, z);
  const prev = advStations.get(k);
  const pv = advStore.journal.edits.get(k); /* 记账前旧账(ADR 0007 箱子增删判据) */
  advStore.mark(k, id); /* 记账+置脏(世界改动日志, 经存档 store 缝); 站点缓存/挖炉退包是探险私事, 留在本函数 */
  if (id === B_CRAFT || id === B_FURNACE) advStations.set(k, {x, y, z, id});
  else advStations.delete(k); /* 挖除/覆盖皆注销(爆炸掀掉站点同样走此 seam) */
  /* F1: 炉子消失(挖/TNT/覆盖) → 炉内三笔退包; 炉态键带界前缀(D14) */
  if (prev && prev.id === B_FURNACE && id !== B_FURNACE) advFurnace.drop(advFurnKey(x, y, z));
  /* ADR 0007: 箱子进账/出账(放置/挖除/TNT 掀/覆盖同走此缝) → 容量随之重算;
     结构宝箱不在账本里, 天然不触发 */
  if ((id === B_CHEST) !== (pv === B_CHEST)) advChestResync();
}
function advMeshTouch(x, z) {/* setBlockRaw 直写后的网格收口(点亮仪式/自放门/树长成共用):
    setBlockRaw 只写 worldCells 不入脏队列——直写的门面/门体/树要等跨环或重进才被
    重网格,「看着门亮起来」当帧不成立(解锁后门仍是黑框的用户报告即此)。markDirty/
    flushDirty 是 world.js 的网格 seam, Node 桩缺席时静默跳过(ADV_B 守卫同款)。
    光场不追: 门面 glass 透光不衰减, 直写前后光值一致(自放门的黑曜石/发光岩光差
    是 nether 合并 D6 的既有口径, 观感可接受, 不在本修范围) */
  if (typeof markDirty === 'function') markDirty(x, z);
}
function advMeshFlush() {/* 批量 touch 后一次入队收口(markDirty→flushDirty, editBlock 同款) */
  if (typeof flushDirty === 'function') flushDirty();
}

/* ---------- 全局唯一背包(Backpack 壳, ADR 0002) + 快捷栏镜像(9 item 型槽, D10) ----------
    advInv 引用跨 load 稳定(面板闭包持同一引用), 换存档只原地换 slots 数组 */
const advBag = Backpack.mkBackpack();
const advInv = advBag.inv;
const advHbItems = []; /* 槽描述符: {item:id} + cnt/dur 访问器(refresh 实时重读) */
for (let i = 0; i < HOTBAR_SLOTS; i++) {
  advHbItems.push({
    item: '',
    cnt: () => (advInv.slots[i] ? advInv.slots[i].n : 0),
    dur: () => {
      const s = advInv.slots[i];
      const d = s ? durOf(s.id) : 0;
      return d > 0 ? (s.dur || 0) / d : 0; /* 可耗损物画耐久条(工具/D7 灯笼, 满耐久 durOf 单一权威) */
    },
  });
}
const advHb = ModeKit.mkHotbar({items: advHbItems, onPick: (i) => advHeldChanged(i)});

/* ============================================================
   存档 store 缝 (advStore) — 模式层·四份档的供给与持久化唯一面
   ------------------------------------------------------------
   世界档(journal)/任务档/大宝箱档/共享背包的槽供给与持久化语义收拢成
   一个可整体替换的缝(ADR 0005 票 U1): 壳内一切读档·落盘·置脏·节流·
   关页兜底触点只认本面, 不再直碰槽与背包实例——体验馆(U3)在 init 前
   把本缝换装成全内存 dev store(零键字面量·落盘丢弃), 冒险壳编排零改动。
   缺省装配 = 真档 adapter: SyncDB 三槽 + 背包壳实例 + 挂在世界档槽上的
   journal(journal 是范本缝: 内存槽喂进同一个 mkWorldJournal 工厂即得
   dev 版, 不为 journal 造第二实现; 槽创建留在上方顶层, SyncDB 键注册
   回填不动)。
   直调口径(journal 薄调用去留的登记): touch/flush/tick/pageHide/load/
   mark 语义已精确, 本缝以同名薄方法收录而非让触点散直调 advJournal——
   方法体在调用期读 advStore 字段, 换装后触点自动跟随; 账本机械面(edits
   遍历/换桶/replay)不是「何时落盘」的决策而是世界账本操作, 不包方法,
   触点直取 advStore.journal.X, 换装 journal 实例时同样动态跟随。
   interface: 供给 worldSlot/questSlot/chestSlot/bag/journal(U3 换装点;
     worldSlot 仅供给登记——默认 journal 在构造期闭包持有它, 换装世界档 =
     换 journal 实例, 不改字段) + 语义面 load/mark/touch/flush/tick/
     pageHide(世界档) · loadQuest/saveQuest · loadChest/saveChest ·
     loadBag/saveBag(三份伴生档)
   依赖(均经全局名, 调用期解析): 上方定义区四份供给(advWorldSlot/
     advQuestSlot/advChestSlot/advBag/advJournal) · advChest(账户本体,
     init 换装, saveChest 调用期读)
   可测性: 纯薄委托零新逻辑, 行为由 test/adventure-mode.test.js 既有
     断言守卫(U1 零改动); 顶层 let = 登记 U4 体验馆门面的跨文件换装/还原写
   ============================================================ */
const advStoreDefault = {/* 真档 adapter 缺省(U4 还原锚点): 名字即还原目标 */
  /* —— 槽供给(四份档; U3 dev store 换装点: 整体换本缝或换单字段皆可) —— */
  worldSlot: advWorldSlot, /* 世界档槽(真档: SyncDB 注册回填在创建期已定) */
  questSlot: advQuestSlot, /* 任务档槽 */
  chestSlot: advChestSlot, /* 大宝箱档槽 */
  bag: advBag, /* 共享背包实例(ADR 0002: 存档键唯一持有在背包壳) */
  journal: advJournal, /* 世界档记账(范本缝; 换装世界档 = 换整个实例, 见上) */
  /* —— 世界档持久化语义面(薄委托 journal, 调用期读 advStore.journal) —— */
  load() {
    return advStore.journal.load();
  },
  mark(k, v) {
    advStore.journal.mark(k, v);
  },
  touch() {
    advStore.journal.touch();
  },
  flush() {
    return advStore.journal.flush();
  },
  tick() {
    return advStore.journal.tick();
  },
  pageHide() {
    advStore.journal.pageHide();
  },
  /* —— 三份伴生档语义面(槽/背包藏在身后, 触点只见业务语义) —— */
  loadQuest() {
    return advStore.questSlot.load();
  },
  saveQuest(st) {
    advStore.questSlot.save(st);
  },
  loadChest() {
    return advStore.chestSlot.load();
  },
  /* 账户落盘: 存取/扩容是离散动作, 即做即存不等 5s 节流(原 advChestSave 口径)。
     显式只写存档形状 {size: base, slots}——运行态的 chests/size(总容量) 是
     世界账本派生值(ADR 0007), 不进档; slots 全长保存, 超容存量不丢 */
  saveChest() {
    advStore.chestSlot.save({size: advChest.base, slots: advChest.slots});
  },
  loadBag() {
    return advStore.bag.load();
  },
  saveBag() {
    advStore.bag.save();
  },
};
let advStore = advStoreDefault; /* 存档缝本体(U4 体验馆门面 init 前整体换装 dev store, cleanup 收尾还原) */

/* ============================================================
   政策缝 (advProfile) — 模式层·冒险壳政策点的唯一读取面
   ------------------------------------------------------------
   冒险壳统一(ADR 0005 票 U2, docs/adventure-shell-unification-design.md):
   体验馆未来要分叉的政策点收拢成一个可整体换装的 profile 对象,
   壳内一切政策读取只认本面(缺省 = 真档政策, 行为逐字等于现行值)——
   政策不再焊死在编排函数里。体验馆(U4)在 init 前换装 dev profile
   (篡改政策值), 冒险壳编排零改动; 顶层 let 登记跨文件换装写(advStore 同款)。
   媒体三通道(TTS/sfx/toast)经下方薄包装 advSpeak/advSfx/advToast 走本面:
   壳内直接调用点与 kit 装配 opts(say/speak/sfx)全部经包装, 缺省直通。
   每条缝的分叉方向与 U4 消费方(dev profile 政策值):
   · death 'home'|'inPlace'  死亡去向: 切图回出生点(现行) | 原地满血复活
     (体验馆 D5 拍板①: 清夜怪保调试现场, showroom 薄死亡同款)
   · sleepWakeSetsSpawn      睡醒设床边出生点(现行 MC 口径) | false=只跳清晨+
     清场两连(体验馆无死亡/回家政策)
   · nightLay(dt)            夜怪铺法: 环带节拍(现行, advNightLayRing) | 入夜上沿
     固定点位铺 N 只(体验馆 D5 拍板①; 清场两侧同源共用 advSweepNightMobs)
   · speak/sfx/toast         媒体降噪: 直通 SpeechKit/sfx/showToast(现行) | dev
     全静默 speak/sfx, toast 保留面自定
   · stationAlwaysOpen       合成站点 4 格门禁(现行) | 恒真(台级配方随处可摆)
   · hiddenRecipesOpen       隐藏配方锁(现行) | 全开(二期卡进馆可测)
   · leftoverDrops           满包余量掉地上拾回(现行零损失) | 静默丢弃(体验馆
     无存档, 掉落只是噪音; 合成 leftover/关面板退料/挖炉退料三处同口径)
   interface: advProfile(政策对象) · advSpeak/advSfx/advToast(媒体薄包装);
      缺省对象名单独命名 advProfileDefault = U4 体验馆门面的还原锚点
   依赖(均经全局名, 调用期解析): SpeechKit/sfx/showToast(媒体直通缺省) ·
     advNightLayRing(本文件下方昼夜 D5 段的环带铺法, 函数声明加载期即在场)
   可测性: 缺省政策 = 既有行为, 由 test/adventure-mode.test.js 既有断言守卫
     (U2 测试零改动); 换装行为由 U4 的 dev profile 落测
   ============================================================ */
const advProfileDefault = {
  death: 'home', /* 死亡去向: 'home'=切图回出生点(现行) · 'inPlace'=原地满血复活(U4 体验馆) */
  sleepWakeSetsSpawn: true, /* 睡醒沿设床边出生点+落位(现行) · false=只跳清晨+清场(U4 体验馆) */
  nightLay: advNightLayRing, /* 夜怪铺法(缺省=环带节拍) · U4 体验馆注入固定点位铺法 */
  speak: (t) => SpeechKit.speak(t), /* TTS 通道(缺省直通) · U4 dev 全静默 */
  sfx: (k) => sfx(k), /* 音效通道(缺省直通 effects 的 sfx) · U4 dev 全静默 */
  toast: (t) => showToast(t), /* toast 通道(缺省直通) · U4 dev 自定保留面 */
  stationAlwaysOpen: false, /* 合成站点门禁: false=走近 4 格(现行) · true=恒真(U4 体验馆) */
  hiddenRecipesOpen: false, /* 隐藏配方: false=锁(现行) · true=全开(U4 体验馆) */
  leftoverDrops: true, /* 满包余量: true=掉地上拾回(现行) · false=静默丢弃(U4 体验馆) */
};
let advProfile = advProfileDefault; /* 政策缝本体(U4 体验馆门面 init 前整体换装 dev 政策值, cleanup 收尾还原) */
function advSpeak(text) {/* 媒体缝·TTS: 经 profile 取通道(缺省直通 SpeechKit.speak) */
  advProfile.speak(text);
}
function advSfx(kind) {/* 媒体缝·音效: 经 profile 取通道(缺省直通 effects 的 sfx) */
  advProfile.sfx(kind);
}
function advToast(text) {/* 媒体缝·toast: 经 profile 取通道(缺省直通 showToast) */
  advProfile.toast(text);
}

function advSyncHeldVisual() {/* 手持观感 = 选中槽内容(「手持与物品栏一致」的单一出口):
   工具/方块/食物/材料全经 HeldItems.defFor 解析, 空槽 = 空手(MC 口径) */
  const s = advInv.slots[advHb.sel];
  Avatar.setItem(s ? s.id : null);
}
function advHeldChanged(i) {/* 选中槽: 观感经 advSyncHeldVisual 跟随选中;
  「X在手」播报已随 ItemHint 统一提示撤除(mkHotbar.select 对全部槽型读提示,
  docs/item-hint-design.md §4) */
  advSyncHeldVisual();
  advHb.refresh();
  advTouchMainSync();
}
function advMainPlaceable() {/* 智能主动作的手持判定(纯 seam, 单测直触): 选中
   放置型物品(ITEMS.block 字段, D4)才走放置; 空手/工具/武器/食物/材料全走
   挖/打(探险 onMouse(0) 已内建 TNT→站点→打怪→吃→蓄力 的次序, 无需改) */
  const s = advInv.slots[advHb.sel];
  /* nether_portal 无 block 字段但也是放置型(整座门由 advTryPlace 拦截分支放置, §3.3) */
  return !!(s && ITEMS[s.id] && (ITEMS[s.id].block != null || s.id === 'nether_portal' || s.id === 'door'));
}
let advTouchUseOn = 'boot'; /* 触屏条状态签名('boot'=未声明 | 'hand'=空手(基表+锄地键) |
   物品id(有使用档, 基表+使用键) | 'item'=普通物品(基表)): 状态翻转才重声明条 */
function advTouchMainSync() {/* 主动作键观感随手持刷新(放置=砖块/其余=镐,
   2026-10-24 手持感知拍板; 持弓主键不再是弓态——2026-10-28 Route A 拍板:
   主键恒挖/打(MC 正典回归), 弓图标由专用射箭键承载); 特殊物品 = 基表 +
   使用动作键的边沿重声明(本函数挂 advSyncHotbar, 每次拾物都跑, 不能
   每次重建条——只在使用动作「有无」翻转时 setActions); input.js 未加载(桌面/Node 单测)时静默
   (2026-10-26 别名收口: 过渡名 refreshTouchMain 已撤, 走 Input.refreshMain) */
  if (typeof Input === 'undefined' || !Input || typeof Input.refreshMain !== 'function') return;
  const place = advMainPlaceable();
  Input.refreshMain(place ? 'brick' : 'pick', place ? '放置' : '挖/打');
  const s = advInv.slots[advHb.sel];
  const on = s ? (itemUses(s.id) ? s.id : 'item') : 'hand'; /* 三态签名: 空手↔普通物↔使用档物
    都要重声明(farm-and-recipe D3: 空手才有锄地键, 手持种子/骨粉才有播种/催熟键) */
  if (on !== advTouchUseOn) {
    advTouchUseOn = on;
    advTouchDeclare();
  }
}
const advTouchBase = [ /* ⛏️ 智能主动作键(手持感知, 用户拍板 2026-10-24): 拿可放置物→放置
    一次(mkMainAct 返 false 不连发), 空手/工具/食物→打/挖起步+按住连挖;
    🎒🏠 低频 → 顶部小键区, 不占拇指操作区。基表静态声明(mkMode init 用),
    特殊物品的使用动作键由 advTouchMainSync 边沿重声明追加 */
  {icon: 'pick', label: '挖/放', holdAct: mkMainAct(advMainPlaceable)},
  {icon: 'chest', label: '背包', act: () => advPanelToggle(), rare: true},
  {icon: 'house', label: '回家', act: () => advGoHome(), rare: true}, /* 受困逃生口: 回出生小屋(60s 冷却) */
];
function advTouchList() {/* 触屏条清单 = 基表 + 空手锄地键 + 手持物品的使用动作键(使用动作
    注册表驱动, 2026-10-28 拍板「弓 = 射箭 + 空手两个键」): 专用键直调执行器不走 aimClick(2)——
    专用键身份 = 恒执行使用动作(指到熔炉也射), 与轻点(走完整使用链 = MC 正典
    交互优先)是两个不同 affordance; holdAct 返 false = 一次性动作不进连发
    (input.js 对 holdAct 键自动给 main 尺寸); 空手锄地键 = 农田链 D7 两步正典的
    触屏入口(点错地方静默, 引导话术在执行器) */
  const s = advInv.slots[advHb.sel];
  const uses = (s && itemUses(s.id)) || [];
  const hoeBtn = s ? [] : [{icon: 'hoe', label: '锄地', holdAct: () => {
    advTryHoe();
    return false;
  }}];
  return advTouchBase.concat(hoeBtn, uses.map((u) => ({icon: u.icon, label: u.label,
    holdAct: () => {
      advUseRun[u.act]();
      return false;
    }})));
}
function advTouchDeclare() {/* 触屏条声明唯一出口: Input.setActions 可运行时重调
    (input.js 重build条 DOM, 安全); Node 单测缺 Input.setActions 时回落
    setTouchActions 假桩(mkMode init 同款回落口径) */
  const list = advTouchList();
  if (typeof Input !== 'undefined' && Input && typeof Input.setActions === 'function') {
    Input.setActions(list);
  } else if (typeof setTouchActions === 'function') {
    setTouchActions(list);
  }
}
let advHbSig = '';
function advSyncHotbar() {/* 背包变动后同步快捷栏: 换物重渲染, 只变数量/耐久走轻刷新 */
  let sig = '';
  let changed = false;
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const id = advInv.slots[i] ? advInv.slots[i].id : '';
    if (advHbItems[i].item !== id) {
      advHbItems[i].item = id;
      changed = true;
    }
    sig += id + '|';
  }
  if (sig !== advHbSig || changed) advHb.render();
  else advHb.refresh();
  advHbSig = sig;
  advSyncHeldVisual(); /* 背包变动可能换了手上物: 放光/吃光/被搬换 → 手上观感跟进
    (Avatar.setItem 同目标幂等, 无变化零开销; 修: 放完最后一个方块人物仍举着方块) */
  advTouchMainSync(); /* 主动作键观感同口径跟进(放置=砖/其余=镐) */
}

function advInvMove(from, to) {/* 背包面板点选搬运(2026-10-24 交互优化): moveSlot 纯核心
  搬移(空位搬家/同物并堆/异种对调, 耐久随堆); 选中槽被搬换时手持观感安静跟进;
  离散动作即做即存(大宝箱同口径)——快捷栏腾位/换序后想要的东西随手可用 */
  if (!moveSlot(advInv, from, to)) return;
  advSyncHotbar();
  if (from === advHb.sel || to === advHb.sel) advSyncHeldVisual(); /* 选中槽被搬换: 观感安静跟进(不播「在手」) */
  advStore.saveBag();
  advSfx('pick');
}

/* ---------- 背包+配方书面板(T10 mkCraftPanel) + 熔炉面板(T13 实例化) ---------- */
function advStationOk() {/* 站点解锁(D8 拍板④ + 隔墙修复 2026-10-28): 已放置工作台距玩家 ≤4 格
    (水平距离, 查站点缓存不扫全图), 且站点到人眼中间无实心墙(advLosBlocked 段采样,
    玻璃板/开门不挡=看得见即可用; 隔墙站点不算数, TTS 沿检测同此判据一并静音) */
  return advNearStation(advStations.values(), pos.x, pos.z, ADV_STATION_R, B_CRAFT,
      (st) => !advLosBlocked(getBlock, isOpaque, st.x + 0.5, st.y + 0.5, st.z + 0.5,
          pos.x, pos.y + PLAYER.eye, pos.z));
}
function advStationGate() {/* 合成站点门禁缝(U2, craftPanel 的 station opts): 缺省=4 格门禁
    (advStationOk 现行口径); U4 体验馆 stationAlwaysOpen=true 恒真——台级配方随处可摆 */
  return advProfile.stationAlwaysOpen || advStationOk();
}
function advLeftoverSpawn(items, x, y, z) {/* 满包余量政策缝(U2): 缺省掉地上拾回(零损失,
    合成 leftover/关面板退料/挖炉退料三处同口径); U4 体验馆 leftoverDrops=false 静默丢弃。
    存留期用丢弃件同款 10 分钟(刻意存放的余量比挖落件更耐等) */
  if (!advProfile.leftoverDrops) return;
  for (const it of items) Drops.spawn(it.id, it.n, x, y, z, {life: ADV_DROP_LIFE});
}

/* —— 丢弃链常量(2026-10, docs/bag-and-drop-design.md §1) —— */
const ADV_DROP_REPICK_T = 1.5; /* 丢弃静默秒: 扔出后 1.5s 内不吸附(MC 拾取延迟儿童化) */
const ADV_DROP_LIFE = 600; /* 丢弃/余量件存留 10 分钟(挖落件 3 分钟不变——刻意存放期更长) */
function advDropSlot(slot) {/* 背包/快捷面板「丢弃」: 整摞从包里取出 → 朝玩家面朝方向
    抛出(掉落物实体库接管落地弹跳/贴地浮动/真空吸附), holdFar+stillT 双门=
    「走远了才捡得回」——站着不动不吃回去; 工具耐久随件, 捡回不重铸(mkStack
    红线)。面板骨架(mkPanelShell 丢弃头钮)驱动, 政策/话术/存档在本层 */
  const st = advInv.slots[slot];
  if (!st) return;
  const dropped = remove(advInv, slot); // 整摞(inventory-core 槽级移除, 耐久随拷贝走)
  if (!dropped) return;
  const fx = -Math.sin(yaw); const fz = -Math.cos(yaw); // 前向单位向量(voxel 移动同式)
  Drops.spawn(dropped.id, dropped.n, pos.x + fx * 1.1, pos.y + 0.8, pos.z + fz * 1.1, {
    vx: fx * 2.2, vz: fz * 2.2, /* 定向前抛(覆盖随机散布) */
    stillT: ADV_DROP_REPICK_T, holdFar: true, thrown: true,
    life: ADV_DROP_LIFE,
    dur: (dropped.dur != null) ? dropped.dur : undefined, /* 耐久随件(undefined=无) */
  });
  advSyncHotbar();
  advStore.saveBag();
  advSfx('snow_throw'); /* 掷出「噗」(与雪球/播种同款脱手音) */
  const name = (ITEMS[dropped.id] && ITEMS[dropped.id].name) || dropped.id;
  advToast('👋 ' + name + ' ×' + dropped.n + ' 扔在地上啦');
}
function advOnCraft(out) {/* 合成成功(T13, D8): TTS 具体表扬(产物名入句, 夸努力口径) +
  leftover 转脚下掉落物(背包满零惩罚) — T15 任务进度在此挂合成事件;
  F3 金苹果首获仪式也挂此(合成入包侧, 与钻石首获在挖掘侧各归其位) */
  const firstGold = out.item === 'golden_apple' && !ADV.quest.counts.craft_golden_apple;
  const name = (ITEMS[out.item] && ITEMS[out.item].name) || out.item;
  advSpeak(name + '做好啦！你真会想办法！');
  if (out.leftover > 0) advLeftoverSpawn([{id: out.item, n: out.leftover}], pos.x, pos.y + 0.5, pos.z);
  advSyncHotbar();
  advToast('✅ ' + name + ' 做好啦！');
  advTally('craft_' + out.item, out.n); /* T15: 合成件数记账(事件处只 +=, 推进归节流查) */
  if (firstGold) advGoldRite(); /* F3: 首获判据取自记账前的 counts(与钻石同口径); 仪式放最后, TTS 压过常规表扬 */
}
const advPanel = ModeKit.mkCraftPanel({
  inv: advInv,
  station: advStationGate, /* 站点门禁经政策缝(缺省 4 格门禁; U4 体验馆恒真) */
  get allow() {/* 隐藏配方锁经政策缝(U2): kit 算可见集时调用期读 o.allow, getter 动态取值
      (U4 init 前换装 profile 即生效, 不受本装配期限制); KIT_HIDDEN_RECIPES 是
      mode-kit 顶层 const(Node 模块态不可见, typeof 守卫, showroom 先例)。
      探险缺省=挂账解锁子集(farm-and-recipe D2: 面包=首收小麦/骨粉=首杀骷髅/
      弓=首杀蜘蛛, 谓词在 adventure-core); 体验馆 hiddenRecipesOpen 仍全开。
      大背包「只扩一次」门禁(2026-10): 未扩容时放开卡片, 已顶格即隐藏——
      隐藏配方不参与摆放匹配, 连误合成都不会发生 */
    if (advProfile.hiddenRecipesOpen && typeof KIT_HIDDEN_RECIPES !== 'undefined') {
      return KIT_HIDDEN_RECIPES.slice();
    }
    const base = typeof advUnlockedRecipes === 'function' ?
      advUnlockedRecipes(ADV.quest.counts) : undefined;
    if (advInv.slots.length < BAG_MAX_SLOTS) {
      return (base || []).concat(['bag_upgrade']);
    }
    return base;
  },
  onCraft: advOnCraft,
  onMove: (from, to) => advInvMove(from, to), /* 背包格点选搬运(政策在本层, 面板只管格子) */
  onDrop: (slot) => advDropSlot(slot), /* 丢弃头钮→整摞扔地上(2026-10, 政策在 advDropSlot) */
  onGridMove: () => {/* 摆放台动了背包(摆入/退回/摆入卡备料): 快捷栏+在手表征同步 + 存档 */
    advSyncHotbar();
    advSyncHeldVisual(); /* 起手槽可能是选中槽: 数量变化观感安静跟进 */
    advStore.saveBag();
  },
  onReturnLeft: (left) => {/* 关面板退料装不下的余量 → 脚下掉落物(零惩罚, crafting-grid §5);
      满包余量政策经 profile 取(缺省掉地上, U4 dev 静默丢弃) */
    advLeftoverSpawn(left, pos.x, pos.y + 0.5, pos.z);
  },
  onClose: () => advPanelClose(), /* ✕/Esc 统一出口: 状态同步 + 指针回锁(修: 曾直 hide 卡 panelOpen=true) */
  onSort: () => {
    advSyncHotbar();
    advToast('🧹 整理好啦！');
  },
});
/* 熔炉装配(T4): 面板开合/取产物/自动放料/逐炉推进/挖炉退料收编共享熔炉 kit
   (js/furnace-kit.js, 体验馆同款两消费者), 探险的政策全走 4 语义事件缝——
   onPanel 指针配套/onInvTouched 背包分派(儿童满包提示·拾取音·挖炉火焰
   即时清)/onRefundLeft 余量掉炉位/onMade 烧成记账+完成播报; 开态唯一
   真值= advFurnace.isOpen()(无镜像旗标); 炉态 Map 引用即 kit 的 Map
   (F1 持久化照旧, encode/decode 在本文件世界档段) */
const advFurnace = FurnaceKit.mkFurnaceStation({
  inv: advInv, /* 探险背包: 引用跨 load 稳定(对象供给形态) */
  onDrop: (slot) => advDropSlot(slot), /* 炉面板丢弃头钮(2026-10, 与背包面板同政策) */
  onPanel: (isOpen) => {/* 开合配套: 开=放鼠标点面板(解锁不弹菜单: onMenu 守卫), 收=回锁 */
    if (isOpen) advFreeMouse();
    else advRelock();
  },
  onInvTouched: (reason, posKey) => {/* kit 动了背包: 按 reason 分派(同一动作只来一次) */
    if (reason === 'drop') {/* 挖炉收尾: 炉口火焰即时清(不等下一帧差异增删) + 快捷栏刷新 */
      advFlameOff(posKey);
      advSyncHotbar();
      return;
    }
    if (reason === 'collect-full') {/* 满包拒收: 产物/整摞留在炉里(儿童提示) */
      advToast('🎒 背包满啦，东西先躺在炉里');
      return;
    }
    advSyncHotbar(); /* collect/autofill/manual-put: 快捷栏镜像刷新 */
    if (reason === 'collect') advSfx('pick'); /* 东西入包: 拾取音 */
  },
  onRefundLeft: (posKey, left) => {/* 挖炉满包余量: 掉在炉位上方(零损失口径); 满包余量政策
      经 profile 取(缺省掉地上, U4 dev 静默丢弃); 炉键带界前缀(D14),
      坐标解析统一走 advFurnPos(剥 'n|' 再拆三段) */
    const p = advFurnPos(posKey);
    advLeftoverSpawn(left, p.x + 0.5, p.y + 0.5, p.z + 0.5);
  },
  onMade: (k, n, made) => {/* T15 烧成件数记账(炉内产出即算, 不等入包) + 完成播报(只对绑定炉, 节流) */
    advTally('smelt_' + n.out.id, made);
    if (advFurnace.isOpen() && advFurnace.at() === k && advSmeltTtsT <= 0) {
      advSmeltTtsT = ADV_SMELT_TTS_T;
      const name = (ITEMS[n.out.id] && ITEMS[n.out.id].name) || n.out.id;
      advSpeak(name + '烧好啦！继续加油！');
    }
  },
});
/* 大宝箱面板(引导链 v2): 政策与存档在本文件下方箱子段, 面板只管格子 */
const advChestPanel = ModeKit.mkChestPanel({inv: advInv, chest: () => advChest,
  next: () => advChestNext(advChest.base), have: (id) => count(advInv, id),
  onPut: (i) => advChestDeposit(i), onTake: (i) => advChestWithdraw(i),
  onDrop: (slot) => advDropSlot(slot), /* 箱面板丢弃头钮(2026-10, 与背包面板同政策) */
  onExpand: () => advChestExpand(), onClose: () => advChestClose()});
/* 指针锁配套(桌面; 触屏无此概念): 开面板放鼠标出来点卡片 — 解锁事件不弹菜单
   (onMenu 有面板守卫收 overlay); 关面板在用户手势里回锁, 游戏无缝继续 */
function advFreeMouse() {
  if (!IS_TOUCH && typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock();
  }
}
function advRelock() {
  if (IS_TOUCH || typeof document === 'undefined' || document.pointerLockElement) return;
  if (typeof renderer !== 'undefined') renderer.domElement.requestPointerLock();
}
function advPanelClose() {/* 关闭唯一出口(Tab/✕/Esc 共用): 状态同步 + 回锁 */
  if (!ADV.panelOpen) return;
  ADV.panelOpen = false;
  advPanel.hide();
  advRelock();
}
function advPanelToggle() {/* 🎒/Tab 入口 */
  if (ADV.panelOpen) {
    advPanelClose(); return;
  }
  ADV.panelOpen = true;
  advPanel.show();
  advFreeMouse();
}

/* ---------- 玩家实体(受击/受死共用状态, CombatKit 工厂 — nether 同款归一) ---------- */
let advPEnt = null;
function advGetPEnt() {
  if (advPEnt) return advPEnt;
  advPEnt = CombatKit.mkFighter({hp: ADV.player.hp, maxHp: ADV.player.maxHp,
    dmg: 3, range: ADV_MELEE_R});
  return advPEnt;
}

/* ---------- 玩家战斗壳(CombatKit, C6-T3): 受击提醒/近战/骷髅箭管线/击杀观感 ----------
   冷却与话术节流自持在 kit(update 只喂 tick); 伤害=手持工具 D9 表、
   命中扣耐久、击杀记账与掉落政策留模式层 ---------- */
const advHurt = CombatKit.mkHurtAlarm({setHp: (v) => {
  ADV.player.hp = v;
}});
const advMelee = CombatKit.mkMelee({range: ADV_MELEE_R, cooldown: ADV_SWING_CD,
  aimCos: ADV_AIM_COS, /* 准星锥门槛(纯方向, 不依赖相机 — lookDir 同式 yaw 朝向) */
  skip: (m) => !!m.__baby, /* 幼崽免伤(生态恢复差异 6): 不被选为目标——挥击落空,
    点击自然落到挖掘/放置, 静默保护(零惩罚, 不给伤害也不给击退) */
  dmg: () => {
    const held = advInv.slots[advHb.sel];
    return advSwingDmg(held ? held.id : '');
  },
  onWear: () => advWearHeld('hit'), /* 命中才扣耐久(空手/非工具不扣) */
  onHit: (m, r) => {/* F4: 受击存活的牧场动物开逃窜(怪/死畜不动作) */
    if (!r.freshDead) advHerdPanic(m);
  },
  onKill: (m) => advOnKill(m)});
const advArrows = CombatKit.mkArrows({color: 0xd8d0b8, player: advGetPEnt,
  onHitPlayer: (res) => {
    if (res.freshDead) advPlayerDied();
    else advHurt.hit(res);
  }});
/* 雪球管线(T9 第二实例, 一实例一弹种): sphere 白球·不 lookAt·零伤害+
   击退政策在逐发 spec; muteSfx 抑制内置 shoot/hit 音(音效归本层字面量,
   sfx 守门口径), 命中观感白絮 = Fx.debrisBurst 现成件(debrisBurst 白色) */
const advSnowballs = CombatKit.mkArrows({mesh: 'sphere', color: 0xffffff, lookAt: false,
  muteSfx: true,
  onHitMob: (m) => {
    advSfx('snow_hit'); /* 命中「噗嗤」(零伤害的主反馈音) */
    Fx.debrisBurst(m.pos.x, m.pos.y + 1, m.pos.z, 5, {color: 0xffffff, life: 0.5});
  }});
/* 玩家弓箭管线(第三实例, 一实例一弹种): 盒形箭与骷髅箭同观感(弹道方向即归属,
   不必另配色); 命中政策与近战挥击同拍——击杀走 advOnKill(任务记账+击杀观感,
   掉落在 onDeath 回调), 受击存活的牧场动物照 F4 逃窜; 历史口径=nether 玩家箭
   (模式已退役, 2026-10-28 弓物品化随冒险侧使用档回归) */
const advBolts = CombatKit.mkArrows({origin: () => ({x: pos.x, y: pos.y + PLAYER.height * 0.72, z: pos.z}),
  skip: (m) => !!m.__baby, /* 幼崽免伤: 箭矢直接穿过(生态恢复差异 6) */
  /* 箭从人物弓位(height*0.72)出膛不随相机——修第三人称箭从人物背后飞出
    (2026-10-28); 雪球实例不注入 origin(未报障, 最小改动; combat-kit 缺省
    = 原相机起点行为, 向后兼容) */
  onHitMob: (m, res) => {
    if (res.freshDead) advOnKill(m);
    else advHerdPanic(m);
  }});

/* 环境伤害(liquid D9): 溺水/岩浆计息事件到点 → 扣血走受击观感(音/闪红/
   节流话术与战斗伤害同源, r.line 换来源话术), 致死走既有死亡计划 */
function advEnvHurt(dmg, line) {
  const pe = advGetPEnt();
  pe.hp = Math.max(0, pe.hp - dmg);
  ADV.player.hp = pe.hp;
  if (pe.hp <= 0) {
    advPlayerDied();
    return;
  }
  advHurt.hit({hp: pe.hp, line});
}

/* ---------- 头顶血条: CombatKit.mkHpBar 深接口(S2, C6-T3 自 mode-kit 迁入) ----------
    每帧喂 {hp, maxHp, 世界坐标}(头顶 2.2 格), 重绘节流收在深接口 */
const advHpBar = CombatKit.mkHpBar();
let advBubbles = null; /* 溺气泡条(liquid D10, init 建/cleanup 收) */

/* ---------- 提醒账本(S4): 判据纯函数在 adventure-core, 这里只持账本与话术 ---------- */
const advWarnLow = new Set(); /* 已低耐久预警的工具 id(advWearWarn 消费; 破板即 delete 重置) */
let advBagArmed = true; /* 背包快满提醒账本(advBagFullStep 消费: 回落再满才再提醒) */
let advBagT = 0; /* 快满检查节流计时(ADV_BAG_CHECK_T 秒) */
function advBagTick(dt) {/* 背包快满提醒(S4②): 占用槽经纯函数判 fire, 一次性 toast+TTS;
  冷却口径 = 「回落再满」的上升沿(整理/合成腾格子后再满会再提醒一次), 持续
  满格不重复轰炸——节流即节流窗 + 账本, 不额外按时间冷却(口径详见 core) */
  advBagT -= dt;
  if (advBagT > 0) return;
  advBagT = ADV_BAG_CHECK_T;
  let used = 0;
  for (const s of advInv.slots) if (s) used++;
  const r = advBagFullStep(used, advBagArmed, advInv.slots.length); /* 容量感知(扩容档 30/33 才提醒) */
  advBagArmed = r.armed;
  if (r.fire) {
    /* 引导链 v2 联动: 已放置过箱子(任务链教过的收纳机制)→提醒指向箱子,
       否则维持合成出口——提醒复用玩家已被教过的机制, 不引入新知识 */
    if ((ADV.quest.counts.place_chest || 0) >= 1) {
      advSpeak('背包快满啦，把宝贝放进箱子里吧！');
      advToast('🎒 背包快满啦，把宝贝放进箱子里吧');
    } else {
      advSpeak('背包快满啦，去合成一些吧！');
      advToast('🎒 背包快满啦，去合成一些吧');
    }
  }
}

/* ============================================================
   巢穴战斗壳段 (T14) — 刷怪节律 / 玩家战斗 / 怪物 AI / 箭矢 / 收集
   (常量与节拍/伤害/掉落/播报纯函数在 adventure-core.js)
   ============================================================ */
const advNestT = advMapRow.nests.map(() => 0); /* 各巢独立计时器(秒): 全清后累计 */
function advNestAlive(i) {/* 巢内存活数(m.nest 挂件是归属唯一依据; 尸体不计) */
  let n = 0;
  for (const m of Mobs.list()) {
    if (!m.dead && !m.gone && m.nest === i) n++;
  }
  return n;
}
function advSpawnNest(i) {/* 本巢首刷/再刷: 池内取种, 洞口环带落位 */
  const nest = advMapRow.nests[i];
  const count = advNestCount();
  for (let k = 0; k < count; k++) {
    const type = nest.kinds[Math.floor(Math.random() * nest.kinds.length)];
    const a = Math.random() * Math.PI * 2;
    const r = ADV_NEST_RING_LO + Math.random() * (ADV_NEST_RING_HI - ADV_NEST_RING_LO);
    const m = Mobs.spawn(type, nest.x + Math.cos(a) * r, nest.z + Math.sin(a) * r, {yaw: 0});
    m.nest = i; /* 模式私有挂件: 巢穴归属(AI 收队/清巢计数的唯一依据) */
  }
}
function advNestTick(dt) {
  for (let i = 0; i < advMapRow.nests.length; i++) {
    const step = advNestStep(advNestAlive(i), advNestT[i], dt); /* 节拍纯函数段 */
    advNestT[i] = step.t;
    if (step.spawn) advSpawnNest(i);
  }
}

/* ============================================================
   昼夜 D5 夜怪壳段(mc-daylight-torch §6.2) — 夜刷怪/防刷怪圈/黎明清场
   (常数与节拍/光照/清场谓词纯函数在 adventure-core.js 的 ADV_NIGHT 段)
   ============================================================ */
let advNightT = 0; /* 夜怪节拍器(秒, 环带铺法 advNightLayRing 的私有状态; init 复位) */
let advWasNight = false; /* 入夜跨沿账本(isNight 上升沿 → 入夜播报) */
let advDawnLit = true; /* 黎明跨沿账本(advDawnSweep 上升沿 → 清场; init 对齐当下防误触) */

function advNightRead(x, z) {/* 落点光查询 seam: groundTop+1 的格(Mobs.spawn 落点同口径)
   双通道读数交核心 advNightCanSpawn 复核目标格; 界外返 null(核心拒绝本拍) */
  const bx = Math.floor(x); const bz = Math.floor(z);
  if (bx < 0 || bz < 0 || bx >= WORLD_W || bz >= WORLD_D) return null;
  const y = groundTop(bx, bz) + 1;
  return {sky: lightSkyAt(bx, y, bz), block: lightBlockAt(bx, y, bz), y};
}

function advNightAlive() {/* 怪物存量(CAP 配额的分母, hud 同款口径: 尸体/已移除/牧场动物不算怪物) */
  let n = 0;
  for (const m of Mobs.list()) {
    if (!m.dead && !m.gone && m.cfg && !m.cfg.passive) n++;
  }
  return n;
}

function advSlimeWaterOk(x, z) {/* 史莱姆夜刷水边门(审查修复 P4, 设计 §3「夜间水边
    专属」): 落点 6 格内有水(沼泽浅水洼水面齐 y24, 只读 y24 层)才放行; 13×13 有界
    扫描, 2s 一拍的频率成本可忽略; 远水点本拍作废——与光照不过同口径, 下一拍再掷 */
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      if (getBlock(x + dx, ADV_GROUND, z + dz) === B_WATER) return true;
    }
  }
  return false;
}

function advNightLayRing(dt) {/* 环带铺怪(缺省夜怪铺法, 政策缝 advProfile.nightLay 的缺省实现,
    U2 抽出不改一字): 纯函数节拍(夜间每 2s 一拍)掷环带+光照门出单 → 壳层按配额
    (CAP−现存怪数, 含巢穴怪)落地并挂私有字段; 节拍器 advNightT 是本铺法的私有状态。
    U4 体验馆注入「入夜上沿固定点位铺 N 只」铺法(D5 拍板①, 全带 __nightMob 标记),
    清场两侧同源共用 advSweepNightMobs(下降沿/睡醒温和清场) */
  const r = advNightStepPool(advNightT, dt, dayTime, advNightRead, pos, Math.random, advMapRow.nightPool);
  advNightT = r.t;
  if (r.spawn && advNightAlive() < ADV_NIGHT.CAP &&
      (r.spawn.type !== 'slime' || advSlimeWaterOk(r.spawn.x, r.spawn.z))) {
    /* slime 限水边(P4): 其余怪种全域放行, 不动既有口径 */
    const m = Mobs.spawn(r.spawn.type, r.spawn.x, r.spawn.z, {yaw: 0});
    m.__nightMob = true; /* 私有挂件(Mobs 许可): 黎明清场/床跳夜清场的唯一依据 */
    m.__nightHome = {x: r.spawn.x, z: r.spawn.z}; /* 家锚=出生环点(AI 收敛同巢穴口径, 不归巢) */
  }
}

function advNightTick(dt) {/* 夜怪节拍 + 入夜/黎明两个跨沿(设计稿 §6.2): 铺怪经政策缝
    advProfile.nightLay(缺省=环带节拍 advNightLayRing, U4 dev 注入固定点位铺法);
    入夜播报(首夜并句火把引导, firstNight 一次性随任务档); 黎明上沿温和清场 */
  const night = Daylight.isNight(dayTime);
  if (night && !advWasNight) {/* 入夜上沿: SpeechKit 是 cancel-then-speak, 引导并句 */
    if (!ADV.quest.firstNight) {
      ADV.quest.firstNight = true;
      advStore.saveQuest(ADV.quest); /* 一次性即时落盘(重进夜里不重教) */
      advSpeak('天黑了，放个火把照亮周围吧！');
    } else {
      advSpeak('天黑了');
    }
  }
  advWasNight = night;
  advProfile.nightLay(dt);
  const lit = advDawnSweep(dayTime);
  if (lit && !advDawnLit) advSweepNightMobs(); /* 黎明上沿: 日出温和清场(advSweepNightMobs=清夜怪唯一实现, 床跳夜 D6 同调) */
  advDawnLit = lit;
}

/* ============================================================
   昼夜 D7 灯笼壳段(mc-daylight-torch §8.2) — 手持光源/耗秒/燃尽消失
   (三前置与持满 1 秒节拍纯函数 advLanternStep 在 adventure-core.js)
   ============================================================ */
let advLanternT = 0; /* 耗秒累计器(秒, advLanternStep 的状态; init 复位) */

function advLanternTick(dt) {/* 灯笼政策(§8.2): 纯函数出三决策(累计/点亮/扣单)
  → setPlayerGlow 开关随身光(world.js 机制缝: 方块侧 uGlowPos/uGlowR 顶点衰减
  + 实体侧 PointLight 同位, 政策全在此) · 持满 1 秒走 advLanternWear 扣耐久 */
  const s = advInv.slots[advHb.sel];
  const r = advLanternStep(advLanternT, dt, s ? s.id : '', s ? (s.dur || 0) : 0,
      Daylight.skyDim(dayTime));
  advLanternT = r.t;
  setPlayerGlow(r.glow);
  if (r.drain) advLanternWear();
}

function advLanternWear() {/* 持满 1 秒扣 1 耐久(背包耐久管线 damageTool); 归零 =
  灯笼整槽消失 + TTS 安抚「灯笼用完了，我们再做一个吧」(§8.2 拍板句, D4/D9
  破板安抚惯例) + 手持观感回落空手; 燃尽是时间驱动的持续消耗, 顺路置脏档
  (与 dayTime 连续同哲学, 5s 节流落盘)。低耐久预警不做(S4① 工具专属口径) */
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  const left = damageTool(advInv, slot);
  if (left === 0 && s) {/* 燃尽: n=1 整槽消失, 安抚话术 */
    remove(advInv, slot);
    Avatar.setItem(null); /* 槽已空 = 空手(advWearHeld 破板同口径, MC 正典) */
    advSpeak('灯笼用完了，我们再做一个吧');
    advToast('🏮 灯笼用完了，我们再做一个吧');
  }
  advStore.touch(); /* 耐久变化随 5s 节流世界档落盘(退出兜底即时存) */
  advSyncHotbar();
}

/* 玩家挥击已收 CombatKit.mkMelee(C6-T3, advMelee 实例): 准星锥内最近怪(锥内无怪
   不出手不空挥, 点击留给挖掘/放置 — T12 语义不抢), 冷却/伤害/磨损/击杀经 cfg 注入 */
/* 手持工具耐久结算(S3 合一: 原 advWearTool(命中)/advDamageHeld(挖掘)两份
   同形实现合并, 来源参数 src 只剩标注用途——行为同一: damageTool 返 0 =
   破板信号(inventory-core 口径) → remove 清槽 + 安抚 TTS 并句当前任务步
   指路(S4③, advBreakToolText) + 观感回落锄头 + 预警账本重置; 非破板顺路
   做低耐久语音预警(S4①: 耐久比首次 <0.25, 每工具每命一次, 破板即重置) */
function advWearHeld(src) {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  if (!s || !isTool(s.id)) return; /* 空手/非工具不扣耐久(灯笼耗秒走 advLanternTick 专属管线, 昼夜 D7 §8.2) */
  const left = damageTool(advInv, slot);
  if (left === 0) {/* 破板: 工具 n=1 整槽消失(D4/D9), 话术并句任务指路 */
    const name = (ITEMS[s.id] && ITEMS[s.id].name) || s.id;
    const q = ADV_QUESTS[ADV.quest.step];
    remove(advInv, slot);
    advWarnLow.delete(s.id); /* 断掉即重置: 再做一把同款还能再预警(S4①) */
    Avatar.setItem(null); /* 槽已空 = 空手(与 advSyncHeldVisual 空槽同一口径, MC 正典) */
    advSpeak(advBreakToolText(name, q ? q.hint : null));
    advToast('💔 ' + name + ' 用坏了，再做一把更棒的吧！');
  } else if (left != null && s) {/* 未破: 低耐久预警判据(S4①, 空手/非工具 left=null 不进) */
    const t = toolOf(s.id);
    if (t && advWearWarn(advWarnLow, s.id, (s.dur || 0) / t.dur)) {
      advSpeak(((ITEMS[s.id] && ITEMS[s.id].name) || s.id) + '快没劲啦，记得再做一把新的哦！');
    }
  }
  advSyncHotbar();
}
function advOnKill(m) {/* 击杀观感(CombatKit.killBurst, nether 同源): 碎块+计数 toast;
   掉落在 onDeath 回调; 任务记账只认亲手击杀(挥击/箭/TNT 三路都经此——
   TNT 掀方块不算挖掘, 但炸死怪物算战果)。
   F4(二期设计稿 §4.5): passive 动物 verb 用「收获」(温和口径替代「击杀」),
   kill_mob 记账排除——冒险章战斗步只认怪物, 动物是收获不是战斗 */
  ADV.killCount++;
  const passive = !!(m.cfg && m.cfg.passive);
  if (!passive) {
    advTally('kill_mob', 1); /* 引导链 v2: 战斗教学步(铁镐后钻石前) */
    advTally('kill_' + m.type, 1); /* 怪种分账(T8 远征章): 沼骸步按种认, 与总账并行 */
  }
  CombatKit.killBurst(m, ADV.killCount, {verb: passive ? '收获' : '击杀'});
}

/* 受击提醒已收 CombatKit.mkHurtAlarm(C6-T3, advHurt 实例 — nether 全套同源):
   账本同步 + 受击音 + 闪红 + 震屏 + 语音 3s 节流 */

/* 怪物 AI(nether 同款骨架 + 巢穴收敛): 索敌=玩家且同巢; 超收队半径掉头回巢;
   近战逼近→贴身打, 骷髅(ranged)保持 7 格巡航放箭(leadAim 预测弹道) */
function advMobAI(dt) {
  const p = advGetPEnt();
  for (const m of Mobs.list()) {
    if (m.dead || m.gone || m.cfg.passive) continue; /* F4 牧场动物走 advHerdTick(恐惧游荡), 不进战斗 AI */
    CombatCore.tickCadence(m, dt); /* 攻击节拍(战斗核心, 与竞技场/下界同一条) */
    /* 家锚(收队/索敌的 leash 原点): 夜怪=出生环点(昼夜 D5, 不归巢穴), 巢穴怪=本巢 */
    const home = m.__nightHome || advMapRow.nests[m.nest != null ? m.nest : 0];
    const dxP = p.pos.x - m.pos.x; const dzP = p.pos.z - m.pos.z;
    const distP = Math.hypot(dxP, dzP) || 1e-9;
    const hx = home.x - m.pos.x; const hz = home.z - m.pos.z;
    const distHome = Math.hypot(hx, hz) || 1e-9;
    const speed = m.cfg.speed || 2;
    let moved = 0; /* 本帧实际速度(喂步态) */
    const aggro = !p.dead && distP <= ADV_NEST_AGGRO_R && distHome <= ADV_NEST_LEASH_R;
    if (aggro) {
      Mobs.steer(m, Math.atan2(dxP, dzP));
      if (m.cfg.ranged) {/* 骷髅: 炮台巡航(7 格), 太远逼近太近拉开, 节拍到就放箭 */
        const want = 7;
        if (distP > want) {
          Mobs.move(m, dxP / distP * speed * dt, dzP / distP * speed * dt); moved = speed;
        } else if (distP < want - 2) {
          Mobs.move(m, -dxP / distP * speed * dt, -dzP / distP * speed * dt); moved = speed;
        }
        if (Math.abs(p.pos.y - m.pos.y) < 3 && distP <= want && m.attackCd <= 0) {
          m.attackCd = m.cfg.cd; m.attackT = ADV_ATTACK_T;
          advArrows.shootFromMob(m, p, {speed: ADV_ARROW_SPEED, dmg: advMobDmg(m),
            kpow: 0.6, g: 6, life: 2.5}); /* 骷髅箭(伤害封顶 ADV_DMG_CAP 在纯核心) */
        }
      } else if (distP > m.cfg.range) {/* 近战逼近 */
        Mobs.move(m, dxP / distP * speed * dt, dzP / distP * speed * dt); moved = speed;
      } else if (Math.abs(p.pos.y - m.pos.y) < 2.5 && m.attackCd <= 0) {/* 贴身攻击玩家 */
        m.attackCd = m.cfg.cd; m.attackT = ADV_ATTACK_T;
        const r = Mobs.hit(p, advMobDmg(m), p.pos.x - m.pos.x, p.pos.z - m.pos.z, 0.4);
        if (r.freshDead) advPlayerDied();
        else advHurt.hit(r);
      }
    } else if (distHome > ADV_NEST_HOME_R) {/* 收队: 慢步回巢(掉头不恋战) */
      Mobs.steer(m, Math.atan2(hx, hz));
      const sp = speed * 0.6;
      Mobs.move(m, hx / distHome * sp * dt, hz / distHome * sp * dt); moved = sp;
    }
    Mobs.gait(m, dt, moved, ADV_ATTACK_T); /* 步态+战斗姿态(引擎同一入口) */
  }
}

/* ============================================================
   F4 牧场动物(二期设计稿 §4.3/§4.4) — 恐惧游荡 + 散布/存活记账
   ------------------------------------------------------------
   动物不反击不追击不索敌(不进 advMobAI); 位移全走 Mobs.move/steer
   意图 API(引擎帧序契约); 受击逃窜计时挂实体私有字段 __fleeT(Mobs
   「模式可挂私有字段」许可), 闲逛换向计时 __ambleT/__ambleDir 同款。
   剪羊毛(2026-10-28, MC 剪刀口径): 手持剪刀对准羊使用 = 剪毛不伤羊,
   掉 1~3 团羊毛, 羊进没毛态(羊毛 overlay 独立骨整骨隐藏——mobs.js
   render 逐实例跳过 hideSlots), 隔一个游戏日毛再长出来。跨天账本:
   会话侧 advWoolDayN(日回绕计数, advHerdTick 检沿自持) + 档侧
   bucket.sheared / bred 条目 sheared 字段(剪毛时刻 dayTime, 世界档
   v3); 长回判据 = 当前 dayTime 回绕到剪毛时刻之前(= 次日黎明/睡醒)。
   ============================================================ */
const ADV_WOOL_SLOTS = ['woolBody', 'woolHead']; /* 羊毛独立骨槽名(造型档案 quad wool 参数派生) */
let advWoolPrevT = null; /* 跨沿检测的上帧 dayTime(null=未初始化, 首帧对表) */
let advWoolDayN = 0; /* 会话日计数(检测到 dayTime 回绕/睡醒跳零即 +1) */
function advWoolSeed(m, sAt) {/* 重进播种剪毛态(施加, advSeedMapMobs 消费):
    sAt=剪毛时刻 dayTime; 当前时刻 ≥ 剪毛时刻 = 尚未跨天(挂没毛态),
    < 剪毛时刻 = 离场期间已长回(返 true 让调用方销账); 无账返 false */
  if (sAt == null) return false;
  if (dayTime >= sAt) {
    m.__sheared = true;
    m.__shearDay = advWoolDayN;
    m.hideSlots = ADV_WOOL_SLOTS;
    return false;
  }
  return true;
}
function advWoolRegrow(m, bucket) {/* 毛长回来(施加): 清实体态+销剪毛账+白絮观感(静默, MC 口径) */
  m.__sheared = false;
  m.hideSlots = null;
  if (m.__livestockIdx != null) delete bucket.sheared[m.__livestockIdx];
  else if (m.__bredRef) delete m.__bredRef.sheared;
  advStore.touch();
  Fx.debrisBurst(m.pos.x, m.pos.y + 1, m.pos.z, 4, {color: 0xffffff, life: 0.4});
}
function advShearSheep(m) {/* 剪毛施加(advTryShear 的 act 体): 实体态+剪毛账+羊毛
    掉落(MC 1~3 团)+耐久/音效/观感; 剪毛不伤羊(零伤害, 温和收获口径) */
  m.__sheared = true;
  m.__shearDay = advWoolDayN;
  m.hideSlots = ADV_WOOL_SLOTS;
  const bucket = advLivestockAll[advMap];
  if (m.__livestockIdx != null) bucket.sheared[m.__livestockIdx] = dayTime;
  else if (m.__bredRef) m.__bredRef.sheared = dayTime;
  advStore.touch();
  const n = 1 + Math.floor(Math.random() * 3); /* MC 口径: 1~3 团 */
  Drops.spawn('wool', n, m.pos.x, m.pos.y + 0.8, m.pos.z); /* 落点同击杀掉落(尸体上方 0.8) */
  advWearHeld('shear'); /* 剪一次扣 1 耐久(挖掘/命中同一条耐久管线) */
  advSfx('shear');
  Fx.debrisBurst(m.pos.x, m.pos.y + 1, m.pos.z, 6, {color: 0xffffff, life: 0.5});
  advToast('✂️ 咔嚓！剪到了 ' + n + ' 团羊毛，过一天还会再长出来哦');
  advSpeak('咔嚓咔嚓，羊毛剪好啦！小羊凉凉快快，明天毛就长回来啦');
}
function advHerdPanic(m) {/* 受击存活 → 3 秒逃窜(挥击 onHit / TNT 波及两路都进这) */
  if (!m.cfg || !m.cfg.passive) return; /* 怪物/死畜不动作 */
  m.__fleeT = ADV_HERD_FLEE_T;
}

function advHerdTick(dt) {/* 恐惧游荡(update 每帧): 决策纯函数段在 adventure-core(advHerdStep);
   受击逃窜(3s, speed×2.2 背向玩家) > 玩家贴近让开(≤2.5 格, speed×0.8) > 闲逛吃草
   (换向计时自持, 六成时间缓步); 每次位移后栏内钳制(advHerdClamp, 仅 home 图)——
   踏石到栏顶差恰 1 牲畜爬得出, 钳制是兜底防线(出栏个体同被收回);
   帧首兼管剪羊毛跨天账本(dayTime 回绕沿检测 → 毛长回施加, 见上段) */
  if (advWoolPrevT == null) advWoolPrevT = dayTime; /* 首帧对表(不把装场当跨天) */
  else if (dayTime < advWoolPrevT) advWoolDayN++; /* 回绕沿(自然过午夜/睡醒跳零)= 新的一天 */
  advWoolPrevT = dayTime;
  const p = advGetPEnt();
  const inPen = advMap === 'home'; /* 四畜全套留 home, 他图无牲畜不钳 */
  const bucket = advLivestockAll[advMap];
  for (const m of Mobs.list()) {
    if (m.dead || m.gone || !m.cfg || !m.cfg.passive) continue;
    if (m.__sheared && advWoolDayN > m.__shearDay) advWoolRegrow(m, bucket); /* 隔天毛长回 */
    if (m.__breedCd > 0) m.__breedCd = Math.max(0, m.__breedCd - dt); /* 繁殖冷却递减 */
    if (m.__baby) {/* 幼崽成长计时(当次内秒表; 计时不落盘——重进按繁育账 b 重挂, 差异 5) */
      m.__babyT -= dt;
      if (m.__babyT <= 0) {
        m.__baby = false;
        Mobs.scaleTo(m, 1); /* 长成: 体型回成年 */
      }
    }
    const dx = m.pos.x - p.pos.x; const dz = m.pos.z - p.pos.z;
    const dist = Math.hypot(dx, dz) || 1e-9;
    const st = advHerdStep(dist, m.cfg.speed || 1, m.__fleeT || 0, dt);
    m.__fleeT = st.fleeT;
    if (st.speed > 0) {/* 恐惧: 背向玩家让开/逃窜(模型面朝 +Z, steer 同 wanderStep 口径) */
      Mobs.steer(m, Math.atan2(dx, dz));
      Mobs.move(m, dx / dist * st.speed * dt, dz / dist * st.speed * dt);
      Mobs.gait(m, dt, st.speed);
      if (inPen) {/* 栏内钳制: 位移后强钳回内带(出栏防线+存量收回) */
        const c = advHerdClamp(m.pos.x, m.pos.z);
        m.pos.x = c.x; m.pos.z = c.z;
      }
      continue;
    }
    /* 闲逛: 换向计时自持(私有字段不落盘——动物位置本就不存档, 设计稿 §6 差异清单);
       节拍纯函数 advAmbleStep 在 adventure-core(掷点 dir→t→walk, 随机注入) */
    const am = advAmbleStep(m.__ambleT || 0, m.__ambleDir || 0, !!m.__ambleWalk, dt, Math.random);
    m.__ambleT = am.t; m.__ambleDir = am.dir; m.__ambleWalk = am.walk;
    if (am.walk) {
      const sp = (m.cfg.speed || 1) * ADV_HERD_AMBLE_MULT;
      Mobs.steer(m, Math.atan2(Math.cos(am.dir), Math.sin(am.dir)));
      Mobs.move(m, Math.cos(am.dir) * sp * dt, Math.sin(am.dir) * sp * dt);
      Mobs.gait(m, dt, sp);
      if (inPen) {/* 栏内钳制: 同逃窜分支 */
        const c = advHerdClamp(m.pos.x, m.pos.z);
        m.pos.x = c.x; m.pos.z = c.z;
      }
    }
  }
}

/* 自动繁育(生态恢复 §2, 拍板①): 2s 节流扫描——同种成年邻近配对(判据纯函数
   advBreedPairOk 在 adventure-core), 中点产崽入繁育账(世界档 v2 bred), 双亲进
   冷却, 幼崽挂三件(体型/免伤旗/成长计时); 活畜上限闸门(初始 10 + 余量 6)。
   一帧至多添一只(上限逼近时逐拍生效); 粉絮爆点=小爱心观感(Fx 现成件)。 */
let advBreedT = 0;
function advBreedTick(dt) {
  advBreedT -= dt;
  if (advBreedT > 0) return;
  advBreedT = 2;
  if (!Number.isFinite(advTodayOrd())) return; /* 精简装载环境: 无日期源不繁育(幼崽出生日无法记) */
  if (!advMapRow || advMapRow.livestock !== 'herds') return; /* 四畜全套留 home */
  const bucket = advLivestockAll[advMap];
  const snaps = [];
  for (const m of Mobs.list()) {
    if (m.dead || m.gone || !m.cfg || !m.cfg.passive) continue;
    snaps.push({m, type: m.type, baby: !!m.__baby, cd: m.__breedCd || 0});
  }
  if (snaps.length >= ADV_LIVESTOCK_CAP) return;
  for (let i = 0; i < snaps.length; i++) {
    for (let j = i + 1; j < snaps.length; j++) {
      const a = snaps[i]; const b = snaps[j];
      const dist = Math.hypot(a.m.pos.x - b.m.pos.x, a.m.pos.z - b.m.pos.z);
      if (!advBreedPairOk(a, b, dist)) continue;
      const entry = {k: a.type, b: budgetDateStr()};
      bucket.bred.push(entry);
      const mx = (a.m.pos.x + b.m.pos.x) / 2;
      const mz = (a.m.pos.z + b.m.pos.z) / 2;
      const baby = Mobs.spawn(a.type, mx, mz, {yaw: 0});
      baby.__bredRef = entry; /* 死亡记账唯一依据(与初始清单 __livestockIdx 同地位) */
      baby.__baby = true;
      baby.__babyT = ADV_BABY_GROW_S;
      Mobs.scaleTo(baby, ADV_BABY_SCALE);
      a.m.__breedCd = ADV_BREED_CD_S;
      b.m.__breedCd = ADV_BREED_CD_S;
      Fx.debrisBurst(mx, a.m.pos.y + 1, mz, 4, {color: 0xff9ec4, life: 0.6});
      advStore.touch();
      return;
    }
  }
}

/* 骷髅箭矢已收 CombatKit.mkArrows(C6-T3, advArrows 实例 — nether 投射同源):
   leadAim 预测弹道 + 重力(stepShot 步进), 命中玩家走受击/死亡回调;
   弹道单向(怪 → 玩家, 玩家近战无远程), mesh/寿命/geo 缓存自持 */

/* 死亡结算(T14 致命一击/坠出世界共用): 政策纯函数 advDeathPlan(core);
   只动玩家状态与位置, 背包一个不动。死亡去向经政策缝 advProfile.death(U2):
   缺省 'home'=切图回出生点(现行); 'inPlace'=原地满血复活(U4 体验馆 D5
   拍板①: 清夜怪保调试现场, 不切图/不落盘, showroom 薄死亡同款) */
function advPlayerDied() {
  if (advProfile.death === 'inPlace') {/* dev 政策: 满血重置+清夜怪+原地复活+toast;
      媒体经包装(U4 dev 只剩 toast), HP 双账本镜像同写(dev 档 hp=满血, 无害) */
    const e0 = advGetPEnt();
    CombatKit.resetFighter(e0); /* 复活五字段不变量(阵亡去向政策在此=原地) */
    e0.hp = e0.maxHp; ADV.player.hp = e0.maxHp;
    advSweepNightMobs();
    advToast('💀 不怕不怕，满血原地重来！');
    return;
  }
  if (advDim === 'nether') {/* D11: 下界死亡顺带切回上界(小屋语义, 不用 advPortalExit);
      advExitSpot 作废——人已死, 回程记录无意义 */
    advExitSpot = null;
    advSetDim('overworld', ADV.spawn);
  } else if (advMap !== 'home') {/* T6(§2.2/§10拍板②): 远征图死亡切回 home(满血+小屋,
      与死亡计划同语义; advExitSpot 是主世界门回程账, 与死亡无关) */
    advExitSpot = null;
    advSetMap('home', ADV.spawn);
  }
  const e = advGetPEnt();
  const plan = advDeathPlan(e, ADV.spawn);
  CombatKit.resetFighter(e); /* 复活五字段不变量(阵亡去向政策在此) */
  e.hp = plan.hp; ADV.player.hp = plan.hp;
  ModeKit.spawn(plan.x, plan.y, plan.z, {yaw: plan.yaw});
  advStore.flush(); /* 重生态即时落盘: 防 5s 节流窗口内关页面 → 重进在死亡点残血(与死亡语义矛盾);
     炉态不动也不退(F1 拍板①: 炉内物品随档保留, 死亡零惩罚不碰炉子) */
  advSpeak('不怕不怕，回到小屋休息好啦，背包里的宝贝都在！');
  advToast('💀 回到出生小屋，满血再来！');
}

/* ---------- 回小屋(受困逃生口, 2026-10-23 玩法实测补): 自挖竖井/TNT 弹坑
   可能困住玩家(跳跃 1.42 格 < 2 格直壁), 与死亡同一传送口径但零惩罚措辞;
   60s 冷却判据纯函数 advHomeReady/ADV_HOME_CD 在 adventure-core。 */
function advGoHome() {
  const now = typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
  if (!advHomeReady(ADV.homeCd, now)) {
    advToast('🏠 小屋还在休息, 稍等一下哦'); return;
  }
  ADV.homeCd = now;
  if (advDim === 'nether') advSetDim('overworld', ADV.spawn); /* 下界回家: 先切回上界再落小屋(与死亡同语义, 不走门) */
  else if (advMap !== 'home') advSetMap('home', ADV.spawn); /* 远征图回家同语义: 先切回 home 图再落小屋(T6) */
  const e = advGetPEnt();
  e.hp = e.maxHp; ADV.player.hp = ADV.player.maxHp; /* 顺带回满血(回家=安全休整, nether 先例) */
  ModeKit.spawn(ADV.spawn.x, ADV.spawn.y, ADV.spawn.z, {yaw: ADV.spawn.yaw});
  advStore.flush(); /* 回家态即时落盘(与死亡同口径): 满血+小屋位置即刻入档, 防节流窗口 */
  advSpeak('回家咯！休息一下再出发！');
  advToast('🏠 回到小屋');
}

/* ============================================================
   床·睡觉时钟 (昼夜 D6, mc-daylight-torch §7.2; 2026-10-28 用户拍板时钟改版:
   点床不再一键睡到天亮, 开「时钟拨盘」自选醒来时刻——原神式时间跳跃观感)
   — 观感与接线段
   ------------------------------------------------------------
   点击床 → 怪圈判据(advSleepCheck 一条件制, 夜窗已撤销)过 → 开时钟拨盘
   (拨盘数学 clockSnap/clockDelta/clockPhase/clockLabel 在 daylight-core,
   时间轴派生量归引擎; 面板 DOM 在本段)。确认 → advSleepStep 转场状态机
   (#fade 渐黑→全黑→渐亮, 纯函数在 adventure-core) → 唤醒沿: dayTime 推进
   到拨盘时刻(clockDelta 现算——渐黑期世界时间照走) + 非夜时刻温和清场 +
   出生点设床边。拨盘缺省拨到清晨(tick 0) = MC 一键跳夜的正典等价路径。
   出生点沿既有缝: ADV.spawn 账本换床边(死亡/回家同缝消费) +
   ModeKit.spawn 落位顺带记忆(onVoidFall 兜底), 不开第二实现。
   ============================================================ */
const advSleep = {on: false, t: 0, target: 0, x: 0, y: 0, z: 0};
/* 转场状态: on=转场中 · target=醒来时刻(tick, 已吸附) · x/y/z=床方块坐标 */

function advFadeEl() {/* #fade 全屏遮罩(index.html 既有 DOM; Node 测试取 document 桩) */
  return (typeof document !== 'undefined' && document.getElementById) ?
    document.getElementById('fade') : null;
}
function advFadeSet(op) {/* 直驱遮罩透明度: 关掉 CSS 自带 0.45s transition, 由状态机逐帧接管(§7.2 的 1.5s 渐变) */
  const el = advFadeEl();
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = op;
}
function advSleepFadeReset() {/* 收尾/中断: 遮罩归零, transition 还回 CSS(昏迷/关卡切换黑场的既有语义) */
  const el = advFadeEl();
  if (!el) return;
  el.style.transition = '';
  el.style.opacity = 0;
}

function advSweepNightMobs() {/* 夜怪温和清场(§6.2 观感; 黎明清场与床跳夜共用的唯一实现, D6 命名归一——
   D5 原实现 advClearNightMobs 已并入本函数): 按 __nightMob 私有字段过滤(D5 夜怪节拍
   advNightTick 出生时挂上; 尸体一并收=「全部 __nightMob」口径), 原地灰白烟
   碎屑 + Mobs.remove + 一句 TTS; 巢穴怪/牧场动物不带该字段天然不清(脚本怪与昼夜解耦) */
  let n = 0;
  for (const m of Mobs.list()) {
    if (m.gone || !m.__nightMob) continue;
    Fx.debrisBurst(m.pos.x, m.pos.y + 0.6, m.pos.z, 8, {color: 0xe6e6e6, life: 0.9}); /* 灰白烟(色阶 0.9, §6.2) */
    Mobs.remove(m);
    n++;
  }
  if (n > 0) advSpeak('天亮了，怪物回家啦');
  return n;
}

function advSleepWake() {/* 唤醒沿(§7.2 时钟改版): 跳拨盘时刻 + (非夜)夜怪清场 + 出生点设床边;
   顺带即时落盘(醒来时刻与床边位即刻入档——死亡/回家同口径, 防 5s 节流窗口内关页面回旧时刻)。
   清场判据: 醒在天亮段(!isNight)夜怪回家(与黎明清场同缝); 醒在夜里不清(夜怪照常——
   夜铺怪层 advNightTick 每帧现算, 跳进夜里/夜里跳时会自然接住); 黎明窗(22330..23000,
   isNight=true)跳入时次帧 advDawnSweep 跨沿自动清场, 不在此重复。
   床边出生点经政策缝 advProfile.sleepWakeSetsSpawn(U2): 缺省 true(现行 MC 口径);
   U4 体验馆 false——唤醒瘦身为「跳时刻+清场」两连(showroom 先例, 无出生点改写/无落位) */
  dayTime = Daylight.advance(dayTime, Daylight.clockDelta(dayTime, advSleep.target) / 20);
  if (!Daylight.isNight(dayTime)) advSweepNightMobs();
  if (advProfile.sleepWakeSetsSpawn) {/* 出生点账本换床边: 死亡(advDeathPlan)/回家/坠虚同缝消费 */
    const spot = advBedSpot(advSleep.x, advSleep.y, advSleep.z, getBlock,
        {x: pos.x, y: pos.y, z: pos.z, yaw}); /* 四邻全堵回落玩家当前位(选址纯函数在 core) */
    ADV.spawn = spot;
    ModeKit.spawn(spot.x, spot.y, spot.z, {yaw: spot.yaw}); /* 落位+记忆(顺带把黑屏期游走的玩家拉回床边醒来) */
  }
  const ph = Daylight.clockPhase(dayTime);
  if (ph.id === 'day' || ph.id === 'dawn') {
    advSpeak('睡饱啦，天亮了！');
    advToast('☀️ 睡饱啦，天亮了！');
  } else {
    advSpeak('睡了一觉，现在是' + ph.name + '呀');
    advToast(ph.icon + ' 醒来了，现在是' + ph.name);
  }
  advStore.flush(); /* 落盘调用点不动: U3 dev store 丢弃式, 换装后自动无害 */
}

function advSleepTick(dt) {/* 转场推进(update 每帧): 纯函数时间账 + 遮罩直驱 + 唤醒沿/收尾 */
  if (!advSleep.on) return;
  const s = advSleepStep(advSleep.t, dt);
  advSleep.t = s.t;
  advFadeSet(s.opacity);
  if (s.wake) advSleepWake();
  if (s.phase === 'done') {
    advSleep.on = false;
    advSleepFadeReset();
  }
}

/* ---------- 时钟拨盘面板(2026-10-28 时钟改版): 惰性 DOM 单例, Node 桩可安全创建 ---------- */
const advSleepClock = {on: false, target: 0, x: 0, y: 0, z: 0};
/* 拨盘态: on=面板开着 · target=醒来时刻(tick, 已吸附) · x/y/z=床方块坐标 */
let advClockDom = null; /* 惰性单例 {root, box, cv, read} — 开盘建, cleanup 卸 */
let advClockDragging = false; /* 拨针拖拽中(pointermove 现算) */

/* 表盘角: 正午朝上(MC tick 6000=正午), 顺时针走时——日出(0)在左 · 日落在右,
   白天弧朝上夜晚弧朝下, 孩子一眼读出「指针在哪边=天什么色」 */
function advClockAngle(tick) {
  return ((tick - 6000) / DAYLIGHT.TICKS) * Math.PI * 2;
}

function advClockDraw() {/* 表盘绘制: 昼夜四段色环 + 现在针(细白) + 拨针(粗琥珀);
   canvas 不可用(Node 桩 fakeEl 无 getContext)静默跳过——面板仍可预设钮/确认 */
  if (!advClockDom) return;
  const cv = advClockDom.cv;
  const g = (typeof cv.getContext === 'function') ? cv.getContext('2d') : null;
  if (!g) return;
  const S = cv.width; const c = S / 2; const r = c - 14;
  g.clearRect(0, 0, S, S);
  const k = DAYLIGHT.DIM_KEYS; /* 相位断点与 Daylight.clockPhase 同源, 零手抄 */
  const segs = [
    {a0: 0, a1: k[1][0], col: '#a8ddf7'}, /* 白天 */
    {a0: k[1][0], a1: k[2][0], col: '#ff9d5c'}, /* 傍晚 */
    {a0: k[2][0], a1: k[3][0], col: '#1d2f57'}, /* 夜晚 */
    {a0: k[3][0], a1: DAYLIGHT.TICKS, col: '#ffb3a3'}, /* 清晨 */
  ];
  for (const s of segs) {
    g.beginPath();
    g.strokeStyle = s.col;
    g.lineWidth = 18;
    g.arc(c, c, r, advClockAngle(s.a0) - Math.PI / 2, advClockAngle(s.a1) - Math.PI / 2);
    g.stroke();
  }
  g.font = '16px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('☀️', c, c - r + 24); /* 正午(上) */
  g.fillText('🌙', c, c + r - 24); /* 午夜(下) */
  g.fillText('🌅', c - r + 24, c); /* 日出(左) */
  g.fillText('🌇', c + r - 24, c); /* 日落(右) */
  const hand = (tick, w, col) => {
    const a = advClockAngle(tick);
    g.beginPath();
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.moveTo(c, c);
    g.lineTo(c + Math.sin(a) * (r - 12), c - Math.cos(a) * (r - 12));
    g.stroke();
  };
  hand(dayTime, 3, '#f5f9ff'); /* 现在针 */
  hand(advSleepClock.target, 6, '#ffb84d'); /* 拨针(醒来时刻) */
  g.beginPath();
  g.fillStyle = '#ffb84d';
  g.arc(c, c, 5, 0, Math.PI * 2);
  g.fill();
}

function advClockPointTick(e) {/* 指针位置 → 表盘 tick(clockSnap 吸附后; 圆心死区返 null) */
  const cv = advClockDom && advClockDom.cv;
  if (!cv || typeof cv.getBoundingClientRect !== 'function') return null;
  const b = cv.getBoundingClientRect();
  const dx = e.clientX - (b.left + b.width / 2);
  const dy = e.clientY - (b.top + b.height / 2);
  if (Math.hypot(dx, dy) < 8) return null;
  let a = Math.atan2(dx, -dy); /* 屏幕向量 → tick 角(正午朝上口径, 与 advClockAngle 互逆) */
  if (a < 0) a += Math.PI * 2;
  return Daylight.clockSnap(((a / (Math.PI * 2)) * DAYLIGHT.TICKS + 6000) % DAYLIGHT.TICKS);
}

function advClockRefresh() {/* 读数行 + 重绘: 现在/醒来/相位/睡几小时(拨针与预设共用) */
  if (!advClockDom) return;
  const now = Daylight.clockPhase(dayTime);
  const to = Daylight.clockPhase(advSleepClock.target);
  const hrs = Math.round(Daylight.clockDelta(dayTime, advSleepClock.target) / 100) / 10;
  advClockDom.read.textContent = '现在 ' + Daylight.clockLabel(dayTime) + ' ' + now.icon + ' ' +
      now.name + ' → ⏰ ' + Daylight.clockLabel(advSleepClock.target) + ' ' + to.icon + ' ' +
      to.name + ' · 睡 ' + hrs + ' 小时';
  advClockDraw();
}

function advClockBuild() {/* 建面板 DOM(壳模式专用): 遮罩+盒+表盘+读数+预设+睡觉/✕ */
  const root = document.createElement('div');
  root.className = 'slp-mask';
  const box = document.createElement('div');
  box.className = 'slp-box';
  root.appendChild(box);
  const title = document.createElement('div');
  title.className = 'slp-title';
  title.textContent = '⏰ 拨到想醒的时间';
  box.appendChild(title);
  const cv = document.createElement('canvas');
  cv.width = 240;
  cv.height = 240;
  cv.className = 'slp-dial';
  box.appendChild(cv);
  const read = document.createElement('div');
  read.className = 'slp-read';
  box.appendChild(read);
  const presets = document.createElement('div');
  presets.className = 'slp-presets';
  for (const p of [['🌅', '清晨', 0], ['☀️', '正午', 6000], ['🌇', '傍晚', 12000], ['🌙', '半夜', 18000]]) {
    const b = document.createElement('button');
    b.className = 'slp-preset';
    b.textContent = p[0] + p[1];
    b.onclick = () => {
      advSleepClock.target = p[2];
      advClockRefresh();
    };
    presets.appendChild(b);
  }
  box.appendChild(presets);
  const go = document.createElement('button');
  go.className = 'slp-go';
  go.textContent = '😴 睡觉';
  go.onclick = () => advSleepClockConfirm();
  box.appendChild(go);
  const x = document.createElement('button');
  x.className = 'slp-x';
  x.textContent = '✕';
  x.onclick = () => advSleepClockClose();
  box.appendChild(x);
  /* 拨针拖拽(pointer 事件, 触屏/鼠标同源): down 开拖 + move 现算 + up 收 */
  cv.onpointerdown = (e) => {
    advClockDragging = true;
    const t = advClockPointTick(e);
    if (t != null) {
      advSleepClock.target = t;
      advClockRefresh();
    }
  };
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pointermove', (e) => {
      if (!advClockDragging) return;
      const t = advClockPointTick(e);
      if (t != null) {
        advSleepClock.target = t;
        advClockRefresh();
      }
    });
    window.addEventListener('pointerup', () => {
      advClockDragging = false;
    });
  }
  document.body.appendChild(root);
  root.style.display = 'none';
  return {root, box, cv, read};
}

function advSleepClockOpen(x, y, z) {/* 开拨盘(怪圈已过): 缺省拨到清晨(tick 0)=MC 一键跳夜的正典等价 */
  advSleepClock.on = true;
  advSleepClock.target = 0;
  advSleepClock.x = x;
  advSleepClock.y = y;
  advSleepClock.z = z;
  if (!advClockDom) advClockDom = advClockBuild();
  advClockDom.root.style.display = 'flex';
  ADV.panelOpen = true; /* 复用面板门卫: onMouse 挖/放/打与 TNT/蓄力全关(顶层判 panelOpen) */
  advFreeMouse(); /* 放鼠标拨针(解锁不弹菜单: onMenu 有面板守卫) */
  advClockRefresh();
  advSpeak('想睡到什么时候呀？');
}

function advSleepClockClose() {/* 收拨盘(✕/Tab/onKey 共用): 状态同步 + 回锁 */
  if (!advSleepClock.on) return;
  advSleepClock.on = false;
  if (advClockDom) advClockDom.root.style.display = 'none';
  ADV.panelOpen = false;
  advRelock();
}

function advSleepClockConfirm() {/* 「睡觉」: 收拨盘 → 开转场(醒来时刻随行, 唤醒沿跳到点) */
  advSleep.on = true;
  advSleep.t = 0;
  advSleep.target = advSleepClock.target;
  advSleep.x = advSleepClock.x;
  advSleep.y = advSleepClock.y;
  advSleep.z = advSleepClock.z;
  advSleepClockClose();
  advMineStop(); /* 蓄力中则收手(黑屏期不再挖) */
  advSpeak('呼——呼——'); /* 鼾声(§7.2) */
  advFadeSet(0); /* 接管遮罩: 从全透开始渐黑 */
}

function advTrySleep(hit, lookId) {/* 点击床(§7.2 时钟改版, 挖掘左键与轻点/右键共用入口): 怪圈纯函数
   advSleepCheck(床边 8 格无怪; 夜窗已撤销——拨盘本身就是选时刻)不过 → toast;
   过 → 开时钟拨盘(确认才开转场)。返回 true=消费了本次点击(不放不挖) */
  if (!hit || lookId !== B_BED) return false;
  if (advSleep.on || advSleepClock.on) return true; /* 转场/拨盘中重复点击吞掉(输入另由 onMouse 顶层门挡) */
  const mobs = Mobs.list().map((m) => ({x: m.pos.x, z: m.pos.z, dead: m.dead, gone: m.gone,
    passive: !!(m.cfg && m.cfg.passive)})); /* 快照采集: 牧场动物 passive 不拦(F4 口径) */
  const chk = advSleepCheck(mobs, hit.x + 0.5, hit.z + 0.5);
  if (!chk.ok) {
    advToast('👾 附近有怪物，睡不着');
    return true;
  }
  advSleepClockOpen(hit.x, hit.y, hit.z);
  return true;
}

/* 点击门开关 → kit 薄转发(使用先于放置/挖掘的次序在 onMouse 编排, 不变) */
function advTryDoor(hit, lookId) {
  return advPlaceKit.tryDoorToggle(hit, lookId);
}

/* ============================================================
   下界相位·切图装配 (docs/nether-merge-design.md §3.3 泛化, 票据 T6) —
   切图/切界/天空调色板/光束/传送触发
   ------------------------------------------------------------
   nether 模式退役后, 下界 = 探险模式内部 phase(D1); T6 又把两界机制泛化
   为 N 图: advDim('overworld'|'nether') 之上的 advMap(home/desert/snow/
   swamp) 管四张主世界图, nether 期间保持最后主世界图。维度/地图态与按图
   分桶 edits 在文件头 advSceneEdits 段; 门框建场/内口判定/放置校验/出口
   折算纯核心在 adventure-core 下界段(ADV_PORTAL/ADV_NETHER 等), 地图行
   数据在 adventure-maps-core(ADV_MAPS)。本段只做装配: 换桶→重装场景
   (地图行 build+当前桶重放→门阵建场)→调色板→清场→出生→站点重扫→节拍器复位→
   光束重锚一条链, 以及 update 内的传送触发节拍(地图门站桩/nether 门即时分流, T7 装配见下「传送门阵」段)。
   ============================================================ */

/* ---------- 下界方块段 id 集中解析(精简装载守卫, mode-kit typeof 先例) ----------
     旧 Node 装载序(test/adventure-mode.test.js 的 vm api)可能没铺下界常量——
     typeof 取值缺省 0(方块 id ≥1, 永不命中=传送机制整体静默停用), 浏览器与
     全量装载(test/adventure-nether.test.js)拿到真值 */
const ADV_B = {
  portal: (typeof B_PORTAL !== 'undefined') ? B_PORTAL : 0,
  portalDim: (typeof B_PORTAL_DIM !== 'undefined') ? B_PORTAL_DIM : 0, /* 熄门微光门面(不可触发, id 异于 B_PORTAL) */
  obsidian: (typeof B_OBSIDIAN !== 'undefined') ? B_OBSIDIAN : 0,
  netherrack: (typeof B_NETHERRACK !== 'undefined') ? B_NETHERRACK : 0,
  glowstone: (typeof B_GLOWSTONE !== 'undefined') ? B_GLOWSTONE : 0,
  brick: (typeof B_NETHER_BRICK !== 'undefined') ? B_NETHER_BRICK : 0,
};

/* ---------- 天空(观感逐字迁自退役 nether.js, 改名对齐本文件 ADV_ 前缀) ----------
     暗红天穹+近雾+压暗日光一眼是下界, 回上界恢复 world.js 初始天蓝; 纯渲染态,
     Node/无渲染场景静默跳过; 日月天体显隐归 dayCycleOn(下界不置位即隐藏) */
const ADV_SKY_NETHER = {color: 0x2a0a08, fogNear: 26, fogFar: 120, sunI: 0.3};
const ADV_SKY_OVER = {color: 0x8fc7ff, fogNear: 90, fogFar: 230, sunI: 0.75};
function advApplySky(k) {
  if (typeof scene === 'undefined' || !scene.fog) return;
  scene.background.set(k.color);
  scene.fog.color.set(k.color);
  scene.fog.near = k.fogNear;
  scene.fog.far = k.fogFar;
  if (typeof sun !== 'undefined') sun.intensity = k.sunI;
}

/* ---------- 地图行换装与调色板(T6) ----------
     advApplyMapRow: 池/常量视图/巢穴计时器一次换装(T2 通道唯一入口);
     advApplyMapPalette: 行 palette 的天/水色基准——天基色经 world.js 的
     setSkyBase 缝(昼夜插值仍走 Daylight/applyDaylight, 只换白日端点,
     设计 §2.1), 水色写 BLOCKS[B_WATER].all(纯色方块, 须在 loadScene 前
     换——网格重建烘色), 雾距/日光沿用主世界口径。home 行与全局缺省逐字节
     同值(观感零变化); nether 不走此缝(ADV_SKY_NETHER 口径不变) */
function advApplyMapRow(row) {
  advMapRow = row;
  ADV.nests = row.nests; /* 常量视图跟行(测试面 ADV.nests 与池权威一致) */
  advNestT.length = row.nests.length; /* 计时器随行伸缩(每图巢数不同) */
  advNestT.fill(0); /* 节拍器复位: 进图重播=全清后 60s 再刷口径 */
}
function advApplyMapPalette(row) {
  if (typeof setSkyBase === 'function') setSkyBase(row.palette.sky);
  BLOCKS[B_WATER].all = row.palette.water.slice();
  const c = row.palette.sky;
  const skyHex = (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
  advApplySky({color: skyHex, fogNear: ADV_SKY_OVER.fogNear,
    fogFar: ADV_SKY_OVER.fogFar, sunI: ADV_SKY_OVER.sunI});
}
function advMapRowCleanup() {/* 退场复位(T6): 图账本/行视图/调色板归缺省——home 行与
    全局缺省逐字节同值, 天基色缝归 null, 雾距/日光回主世界口径(观感零残留) */
  advMap = 'home';
  advApplyMapRow(ADV_HOME_ROW);
  if (typeof setSkyBase === 'function') setSkyBase(null);
  BLOCKS[B_WATER].all = ADV_WATER_ALL_DEFAULT.slice();
  advApplySky(ADV_SKY_OVER);
}

/* ---------- 传送门紫色光束(常驻动效): 特效唯一入口 Fx.portalBeam ----------
     多门多束(advBeamHs 句柄清单); 锚定 = 下界回程门(固定坐标) + 当前桶 edits
     里值===B_PORTAL 的格子(玩家门只以 edits 形态存在)——按 z 分组、同 z 相邻
     x 连续段为一个内口(内口 4×5 全格是门面, min-x/min-y 各退 1 即门基)。
     切界先全清再重锚; Node/fake Fx 无入口时句柄为 null 占位, remove 无害 */
let advBeamHs = []; /* 当前界的光束句柄(Fx.portalBeam 返回值; null=无渲染环境) */
function advBeamAdd(by, px, pz) {/* 单门一束(原版句式: 束心=门基宽中点/内口底/门面 z+0.5) */
  advBeamHs.push(Fx.portalBeam ? Fx.portalBeam(px + ADV_PORTAL.w / 2, by + 1, pz + 0.5,
      {w: ADV_PORTAL.w - 2, h: ADV_PORTAL.h - 2}) : null);
}
function advBeamsClear() {/* 全清(切界/cleanup): 悬空句柄再 remove 无害 */
  for (const h of advBeamHs) if (h && Fx.removeBeam) Fx.removeBeam(h);
  advBeamHs.length = 0;
}
function advBeamsRelayout() {/* 重锚当前界全部门: 下界回程门(基座, 不在 edits) +
    地图门阵亮门(建场件, 不在 edits) + edits 扫描 */
  if (advDim === 'nether') {
    advBeamAdd(ADV_NETHER.ground, ADV_NETHER.portal.px, ADV_NETHER.portal.pz);
  } else {
    for (const g of advMapRow.gates) {
      if (advGateLit(g)) advBeamAdd(ADV_GROUND, g.px, g.pz); /* 亮门才有束(熄门无门面) */
    }
  }
  const cols = new Map(); /* z → 门面格清单 [{x,y}...] */
  for (const [k, v] of advStore.journal.edits) {
    if (v !== ADV_B.portal) continue;
    const p = k.split(',');
    const z = +p[2];
    if (!cols.has(z)) cols.set(z, []);
    cols.get(z).push({x: +p[0], y: +p[1]});
  }
  for (const [z, pts] of cols) {
    const xs = [...new Set(pts.map((q) => q.x))].sort((a, b) => a - b); /* 同列 5 格去重 */
    let start = 0;
    for (let i = 1; i <= xs.length; i++) {/* 相邻 x 连续段 = 一个内口(两门紧贴时正确分束) */
      if (i < xs.length && xs[i] === xs[i - 1] + 1) continue;
      let minY = Infinity;
      for (const q of pts) if (q.x >= xs[start] && q.x <= xs[i - 1] && q.y < minY) minY = q.y;
      advBeamAdd(minY - 1, xs[start] - 1, z); /* 门基 = 内口 min-x/min-y 各退 1 */
      start = i;
    }
  }
}

/* ---------- 传送门阵(票据 T7, 设计稿 §2.3/§4): 建场/绑定/解锁读 ----------
     门→目标图的绑定 = 当前地图行 gates 固定坐标表(ADV_MAPS 各行, T4 权威);
     门体是建场件(setBlockRaw 直写不记账, 与 nether 回程门同款互锁口径——
     每次装场重建同一份, 门体不进 edits 账本); 解锁读任务档 counts 键
     (advMapUnlocked, 点亮仪式归 T8); 门框/门面方块走「声明式不可破坏」
     (无 hard 字段, 蓄力链给 advMineHardText 儿童话术——nether 门先例) */
function advGateLit(g) {/* 门亮否: 目标图解锁(回程门 to=home 恒亮); 纯读任务档 */
  return advMapUnlocked(g.to, ADV.quest.counts);
}
function advGatesBuild() {/* 当前图门阵建场(loadScene 基座段收尾, 不记账): home 三扇
    门阵 + 远征图单回程门; 熄门立框+**暗紫微光门面**(2026-10-27 用户拍板: 从「只立框
    空洞黑」改为 B_PORTAL_DIM——读得出「这是传送门, 只是还没开」; 无 portal 旗标且
    id 不同, advInPortal 天然不命中=「不可触发」口径不变), T8 点亮仪式以 B_PORTAL
    原位覆写换装门体才「长亮脸」。
    ADV_B.portal=0(精简装载守卫)时整体静默——门体核心引用下界方块常量 */
  if (advDim === 'nether' || !ADV_B.portal || !ADV_B.obsidian) return; /* 下界无门阵(回程门在 advSetDim 建场段) */
  for (const g of advMapRow.gates) {
    const lit = advGateLit(g);
    advPortalFrame((x, y, z, id) => {
      if (id === ADV_B.portal && !lit) {
        if (ADV_B.portalDim) setBlockRaw(x, y, z, ADV_B.portalDim); /* 熄门: 门面降级微光 */
        return;
      }
      setBlockRaw(x, y, z, id);
    }, ADV_GROUND, g.px, g.pz, g.look); /* g.look = 门体主题建材(home 门阵三扇各配,
      远征图回程门无 look=经典下界门; 熄/亮只换门面格, 建材两态同款) */
  }
}
function advGateAt(x, z) {/* 门阵包围盒查表(advInPortal 命中后): 玩家脚格落在当前行
    某扇门的门面平面(fx∈门框 6 宽, fz=门面 z) → 返回该门 {to,px,pz};
    未命中返回 null = 玩家自放的 nether 门(保持 D6 即时语义) */
  if (advDim !== 'overworld') return null;
  const fx = Math.floor(x); const fz = Math.floor(z);
  for (const g of advMapRow.gates) {
    if (fz !== g.pz) continue; /* 门面是单 z 平面(advPortalFrame 口径) */
    if (fx >= g.px && fx <= g.px + ADV_PORTAL.w - 1) return g;
  }
  return null;
}

/* ---------- 上界怪播种/实体回调重挂(init 与切界共用) ----------
     Mobs.clear/Drops.clear 会解除死亡/收集回调(与实例同生命周期)——切界清场
     后必须重挂, 回挂在 init 与 advSetDim 是同一份(单一实现) */
function advHookEntityCbs() {
  Mobs.onDeath((m) => {/* 击杀掉落链路(D6): 掷骰→逐条 spawn(尸体落点上方 0.8)。
      F4 牧场记账并进同一回调: 初始畜挂清单索引(死畜账只增不减), 繁育畜按
      __bredRef 从繁育账除名(种群收缩)——掉落与落账同帧 */
    const bucket = advLivestockAll[advMap];
    if (m.__livestockIdx != null && bucket.dead.indexOf(m.__livestockIdx) < 0) {
      bucket.dead.push(m.__livestockIdx);
      delete bucket.sheared[m.__livestockIdx]; /* 死畜剪毛账一并销(索引不再生成, 账不留孤儿) */
      advStore.touch();
    }
    if (m.__bredRef) {/* 繁育畜死亡 = 繁育账除名(生态恢复 §2; 不进死畜索引——初始清单推导不含它) */
      const bi = bucket.bred.indexOf(m.__bredRef);
      if (bi >= 0) bucket.bred.splice(bi, 1);
      advStore.touch();
    }
    for (const s of advDeathDrops(m)) {
      if (m.__sheared && s.id === 'wool') continue; /* 剪过毛的羊身上没毛可掉(MC 口径; 肉照掉) */
      Drops.spawn(s.id, s.n, s.x, s.y, s.z);
    }
  });
  Drops.onCollect((id, n, dur) => {/* 收集并线(T12×T14): 入包/镜像/逐件 toast(T12) → 3s 合并播报窗(T14) */
    if (!advOnCollect(id, n, dur)) return false; /* 满包拒返 false → 1.2s 冷却重试(D6) */
    advPickBuf.set(id, (advPickBuf.get(id) || 0) + n); /* 并入 3s 合并播报窗 */
    advPickT = ADV_PICKUP_WINDOW;
  });
}
function advSeedMapMobs() {/* 主世界怪播种(T6 行化): 当前行巢穴首刷 + 牲畜(仅
    home 行 herds——初始清单按死畜账跳过已杀(不重生 MC 口径), 繁育账逐条重播:
    跨天成年/当日幼崽重挂成长计时) + swamp 行女巫小屋常驻(家锚=小屋位,
    收队不流浪); init 与切图/回界共用同一份(单一实现) */
  for (let i = 0; i < advMapRow.nests.length; i++) advSpawnNest(i);
  if (advMapRow.livestock === 'herds') {
    const bucket = advLivestockAll[advMap];
    const today = advTodayOrd();
    const spots = advLivestockSpots();
    for (const e of advLivestockPlan()) {
      if (bucket.dead.indexOf(e.idx) >= 0) continue;
      const m = Mobs.spawn(e.type, e.x, e.z, {yaw: 0});
      m.__livestockIdx = e.idx; /* 模式私有挂件(Mobs 许可) */
      if (e.type === 'sheep' && advWoolSeed(m, bucket.sheared[e.idx])) {
        delete bucket.sheared[e.idx]; /* 离场期间已跨天长回: 销账(矿位回填同款卫生) */
        advStore.touch();
      }
    }
    for (let bi = 0; bi < bucket.bred.length; bi++) {/* 繁育畜重播(位置不存档, 回群位锚点) */
      const b = bucket.bred[bi];
      const spot = spots[advBreedHerdOf(b.k) % spots.length];
      const m = Mobs.spawn(b.k, spot.x + 0.5 + (bi % 3) * 0.8, spot.z + 0.5, {yaw: 0});
      m.__bredRef = b;
      if (b.k === 'sheep' && advWoolSeed(m, b.sheared)) {
        delete b.sheared; /* 同上: 离场期间已长回(繁育畜账挂条目上, 销字段) */
        advStore.touch();
      }
      if (!advBabyAdult(CampCore.dayIndex(b.b), today)) {/* 当日出世: 幼崽形态重挂成长计时 */
        m.__baby = true;
        m.__babyT = ADV_BABY_GROW_S;
        Mobs.scaleTo(m, ADV_BABY_SCALE);
      }
    }
  }
  if (advMapRow.witchHut) {/* 常驻女巫: 小屋室内落位(地板 y+1, groundTop 会量到屋顶) */
    const w = Mobs.spawn('witch', advMapRow.witchHut.x + 0.5, advMapRow.witchHut.z + 0.5, {yaw: Math.PI});
    w.pos.y = ADV_GROUND + 5; /* 小屋地板 y=GROUND+4, 站立位在其上(Mobs 许可直写) */
    w.__nightHome = {x: advMapRow.witchHut.x, z: advMapRow.witchHut.z}; /* 家锚复用夜怪缝 */
  }
}
function advNightReset() {/* 夜怪账本对齐当下(昼夜 D5): 节拍器归零 + 入夜/黎明跨沿
    账本取当下值(重进/回上界夜里不补播「天黑了」, 明侧不误触黎明清场) */
  advNightT = 0;
  advWasNight = Daylight.isNight(dayTime);
  advDawnLit = advDawnSweep(dayTime);
}

/* ---------- 场景 BGM 情绪(2026-10-27 换曲) ----------
   mode-registry 的 adventure 是基线; 真正播什么由维度×昼夜决定:
   下界=nether · 上界夜=night · 上界昼=adventure(纯映射在 adventure-core
   的 advMusicMood)。advMood 是已报给 AudioMixer 的缓存 — 同值不重复报,
   换值才触发 1.2s 淡出 + 1.5~4s 后新曲。 */
let advMood = null; /* null = 本场尚未同步(首帧 update 必报一次) */
function advSyncMood() {
  const m = advMusicMood(advDim, Daylight.isNight(dayTime));
  if (m === advMood) return;
  advMood = m;
  AudioMixer.setMood(m);
}

/* ---------- 熔炉图/界键(D14 泛化, T6): nether 'n|'/远征图各带前缀, home 键不前缀 ----------
     参照 nether 合并的 'n|' 先例: 各图炉位互不串档; home(=两界时代的上界)不
     前缀 → 旧档天然兼容。**前缀知识单份在 ADV_FURN_PREFIX**(审查修复 S2: 正则/
     场景数组原先各持一份字面量, 加第五张图要改三处——两处派生物全部从表派生) */
const ADV_FURN_PREFIX = {home: '', desert: 'd|', snow: 's|', swamp: 'w|', nether: 'n|'};
const ADV_FURN_PREFIXED = Object.keys(ADV_FURN_PREFIX) /* 带前缀场景清单(表派生, 长度序同表序) */
    .filter((s) => ADV_FURN_PREFIX[s])
    .sort((a, b) => ADV_FURN_PREFIX[b].length - ADV_FURN_PREFIX[a].length);
function advFurnKey(x, y, z) {/* 方块坐标 → 当前场景的炉态键(开炉/建炉/退炉全走此) */
  return ADV_FURN_PREFIX[advSceneKey()] + blockKey(x, y, z);
}
function advFurnPos(k) {/* 炉态键 → 方块坐标(退料落点/火焰挂点解析; 剥图/界前缀再拆三段) */
  const rx = new RegExp('^(?:' + /* 前缀正则从表派生(审查修复 S2): 加图只改表一处 */
      ADV_FURN_PREFIXED.map((s) => ADV_FURN_PREFIX[s].replace('|', '\\|')).join('|') + ')');
  const p = k.replace(rx, '').split(',');
  return {x: +p[0], y: +p[1], z: +p[2]};
}
function advFurnKeyDim(k) {/* 炉态键属于哪个场景(火焰挂载门禁/核销消费) */
  for (const s of ADV_FURN_PREFIXED) {
    if (k.slice(0, ADV_FURN_PREFIX[s].length) === ADV_FURN_PREFIX[s]) return s;
  }
  return 'home';
}
function advFurnaceSettle(sceneKey) {/* 炉态核销(参照 decode 侧 advFurnaceValid「非法
    整条拒收」口径): 该场景炉键在场景重放后块已不是 B_FURNACE(手工改档/旧档
    错位) → 炉态丢弃; 他图/界键留到进那张图建场后再核 */
  for (const k of [...advFurnaces.keys()]) {
    if (advFurnKeyDim(k) !== sceneKey) continue;
    const p = advFurnPos(k);
    if (getBlock(p.x, p.y, p.z) !== B_FURNACE) advFurnaces.delete(k);
  }
}

/* ---------- 切图/切界(D8/D10/D11 泛化, §3.3 + 票据 T6) ----------
     换装共通清单抽 advSceneLeave(nether 合并既有清单照抄扩位): 换桶→清蓄力/
     TNT 判定/炉面板/光束/火焰/树苗计时/引信→清怪清掉落清箭→重挂实体回调。
     advSetDim 切维度(nether 期间 advMap 保持最后主世界图), advSetMap 切主世界
     图(T7 的门阵站桩触发器接此; 本票可被测试直调) */
function advSceneLeave() {/* 离开当前场景的共通清单: 世界无关观感/实体/计时一次清空 */
  advStore.journal.edits = advSceneEdits[advSceneKey()]; /* 换桶: mark/flush 动态查 J.edits, 记账/重放/落盘自动跟桶 */
  advMineStop(); /* 蓄力目标在旧世界: 清零(准星跨世界无意义) */
  advTntTap = null; /* TNT 短按判定同上(按住状态不跨场) */
  if (advFurnace.isOpen()) advFurnace.close(); /* 炉面板绑定旧场景炉: 先收 */
  advBeamsClear(); /* 光束句柄全清再重锚(旧世界的束不跨场) */
  advFlamesClear(); /* 炉口火焰 Sprite 同理(炉态随档跨场保留, 观感不跨) */
  advSaplings.clear(); /* 树苗计时不跨场(进图重扫重建, 防旧图坐标在新图长树——串档事故) */
  advTreeRegen.clear(); /* 凋零树位恢复计时同不跨场(同款串档防线) */
  advFuses.length = 0; /* 已点燃的 TNT 不跨场引爆(会在新图坐标起爆——串档事故) */
  Mobs.clear(); /* 怪/掉落/箭不跨场: 门只渡人(下界无怪, 回主世界重播) */
  advReclaimThrown(); /* 丢弃件切图前收回包(零损失红线: 扔下的宝贝不换图蒸发) */
  Drops.clear();
  advArrows.clear();
  advSnowballs.clear(); /* 雪球同收(T9: 双实例清场纪律) */
  advBolts.clear(); /* 玩家弓箭同收(三实例清场纪律) */
  advHookEntityCbs(); /* clear 解除回调: 重挂(击杀掉落/收集并线, init 同一份) */
}
function advMapSpawn(spot) {/* 主世界缺省出生: 显式点 > home 出生账本 > 远征图回程门
    (advMapArrive 口径: 落地就在回程门跟前, 门在身后) */
  if (spot) return spot;
  if (advMap === 'home') return ADV.spawn;
  return advMapArrive(advMapRow);
}
function advSetDim(dim, spot) {/* 切界: 换桶 → 重装场景(基座+当前桶重放) → 换天/昼夜门 →
    清场 → 出生 → 站点重扫 → 光束重锚。spot 显式出生点: 死亡/回家传小屋
    (ADV.spawn 账本, 与 advPortalExit 无关), 正常回上界缺省用 advExitSpot
    (最后进入的门, D6)——其坐标属于离开时的那张图, 回界即回该图 */
  if (dim === advDim) return;
  advDim = dim; /* advMap 不动: nether 期间保持最后主世界图(T6) */
  advSceneLeave();
  if (dim === 'nether') {
    loadScene(() => {/* 下界基座: 平地+熔岩池+固定回程门(不记账——互锁红线) + 下界桶重放 */
      advNetherBuild();
      advPortalFrame(setBlockRaw, ADV_NETHER.ground, ADV_NETHER.portal.px, ADV_NETHER.portal.pz);
      advStore.journal.replay({block: setBlockRaw, fluid: setFluidLv});
      advFurnaceSettle('nether'); /* 'n|' 炉键此时才有块可对(D14) */
      advRescanStations(); /* 站点缓存只反映当前场景(读当前桶) */
    });
    advApplySky(ADV_SKY_NETHER); /* 暗红天穹: 一眼就知道到了下界 */
    dayCycleOn = false; /* D10: dayTime 暂停 + 恒夜(日月天体随之隐藏) */
    setPlayerGlow(false); /* 灯笼随身光熄灭(下界不亮不耗, 门禁见 update) */
    advLanternT = 0; /* 耗秒累计器归零(回主世界从整秒重新累计) */
    ModeKit.spawn(ADV_NETHER.base.x, ADV_NETHER.ground + 1, ADV_NETHER.base.z,
        {yaw: Math.PI}); /* 落点在回程门前数格, 面朝下界背对门(走出即离开门) */
    setFly(false); /* 落地推前进=离开门, 不会一头弹回上界(走意图入口) */
  } else {
    loadScene(() => {/* 主世界基座确定性重建(当前地图行 build) + 当前桶重放; 不跑
        applySweep——那是 init 旧档治愈专用, 切回来的世界本来就是干净的 */
      advBuildScene(advMapRow);
      advStore.journal.replay({block: setBlockRaw, fluid: setFluidLv});
      advGatesBuild(); /* 门阵重建(T7): 重放之后立门——玩家对门区的误放被门体盖回 */
      advRescanSaplings(); /* 世界里的树苗重挂 20s 计时(计时 Map 不落盘) */
      advRescanWheats(); /* 未熟麦重挂生长计时(farm-and-recipe D3, 计时 Map 不落盘) */
      advRescanTreeRegen(); /* 凋零树位重挂恢复计时(仅 home 图有树位清单) */
      advOreRegenTick(); /* 到期矿位回填(跨天口径; 只结本场景的账) */
      advRescanStations();
      advFurnaceSettle(advMap);
    });
    advApplyMapPalette(advMapRow); /* 行调色板换装(home 行=缺省同值, 天色随后由昼夜驱动接管) */
    dayCycleOn = true;
    applyDaylight(); /* 恢复到暂停时刻的天色/光强/日月 */
    advNightReset(); /* 夜怪节拍与跨沿账本对齐暂停后的当下 */
    advNestT.fill(0); /* 巢穴节律从头计(世界重播=全清后 60s 再刷口径) */
    const sp = spot || advExitSpot || advMapSpawn(null); /* 显式点 > 回程记录 > 图缺省 */
    ModeKit.spawn(sp.x, sp.y, sp.z, {yaw: (sp.yaw != null) ? sp.yaw : 0});
    setFly(false);
    advSeedMapMobs(); /* 主世界怪重播(当前行巢穴+牲畜/女巫, init 同款) */
  }
  advBeamsRelayout();
  advSyncMood(); /* 切界即换场景曲: 下界=nether / 回上界按当下昼夜 */
}

function advSetMap(mapId, spot) {/* 切主世界图(T6, T7 门阵触发器的装配终点): 地图行
    换装(池/计时器) → 共通清场 → 行调色板(先于 loadScene——水色烘进重建网格)
    → loadScene(行 build+当前桶重放) → 昼夜复位 → 出生(回程门口径) → 站点
    重扫 → 炉键核销 → 怪物重播 → 光束重锚。dayTime 全局单钟不随图重置 */
  if (advDim !== 'overworld' || mapId === advMap) return; /* 下界不切图; 幂等 */
  const row = ADV_MAPS.find((r) => r.id === mapId);
  if (!row) return; /* 未知图键: 静默不动作(注册表权威) */
  advMap = mapId;
  advApplyMapRow(row);
  advSceneLeave();
  advApplyMapPalette(row);
  loadScene(() => {
    advBuildScene(row);
    advStore.journal.replay({block: setBlockRaw, fluid: setFluidLv});
    advGatesBuild(); /* 门阵重建(T7): 重放之后立门(远征图回程门常亮) */
    advRescanSaplings();
    advRescanWheats();
    advRescanTreeRegen();
    advOreRegenTick();
    advRescanStations();
    advFurnaceSettle(advMap);
  });
  dayCycleOn = true; /* 主世界图昼夜照转(D10 只关 nether) */
  applyDaylight(); /* 天色按行 skyBase 基准落到当前时刻 */
  advNightReset(); /* 夜怪节拍与跨沿账本对齐当下(夜池已随行换装) */
  const sp = advMapSpawn(spot) || ADV.spawn; /* 显式点(死亡/回家/T7 门绑定) > 图缺省 */
  ModeKit.spawn(sp.x, sp.y, sp.z, {yaw: (sp.yaw != null) ? sp.yaw : 0});
  setFly(false);
  advSeedMapMobs();
  advBeamsRelayout();
}

/* ---------- 门阵站桩与渐晕遮罩(票据 T7, 设计稿 §4.1 时序) ----------
     时序: 门面内站桩 2s(走出门面即刻归零, 可反悔; 纯步进 advGateHoldStep 在
     adventure-maps-core) → 站满进渐晕: 400ms 淡入 → 满格瞬间切图(advSetMap,
     同步实测一二帧) → 400ms 淡出 + 到达音/TTS 播报。全程 2.8s(遮罩红线 ≤5s,
     真正看不见画面仅 0.8s); 渐晕是紫白径向渐变(index.html #portalVeil +
     css/style.css, 幼儿忌纯黑)。冷却复用 ADV_PORTAL.cd(落地空眩晕, 两类门同款) */
const advGateHold = {t: 0}; /* 门面站桩秒累计(advGateHoldStep 的状态; nether 门不入账) */
const ADV_VEIL_T = 0.4; /* 渐晕单段时长秒(双段共 0.8s) */
const advVeil = {phase: 'idle', t: 0, to: '', from: ''}; /* 渐晕转场态: idle/in/out · to=目标图 · from=来时图(找对应回程门) */
function advVeilEl() {/* #portalVeil 渐晕遮罩(index.html; Node 测试取 document 桩, 缺席静默) */
  return (typeof document !== 'undefined' && document.getElementById) ?
    document.getElementById('portalVeil') : null;
}
function advVeilSet(op) {/* 直驱渐晕透明度(advFadeSet 同款: 关 transition 逐帧接管) */
  const el = advVeilEl();
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = op;
}
function advVeilReset() {/* 收尾/中断: 转场归零 + 遮罩收起(不渗其他模式) */
  advVeil.phase = 'idle';
  advVeil.t = 0;
  advVeilSet(0);
}
function advVeilFire(gate) {/* 站满发令: 开渐晕转场 + 进冷却(0.8s 盖过整个转场窗, 防连触) */
  advVeil.phase = 'in';
  advVeil.t = 0;
  advVeil.to = gate.to;
  advVeil.from = advMap; /* 来时图: 到达侧找 to===from 的那扇门(沙漠门进沙漠门出) */
  advGateHold.t = 0;
  advPortalCd = ADV_PORTAL.cd;
}
function advVeilArrive() {/* 渐晕满格瞬间(§4.1 ②③): 切图 + 落对应回程门内 + 到达音/播报 */
  const row = ADV_MAPS.find((r) => r.id === advVeil.to);
  if (!row || row.id === advMap) return; /* 未知键/已在该图(死亡竞态): 静默 */
  const g = row.gates.find((q) => q.to === advVeil.from) || row.gates[0]; /* 对应门, 单门图兜底 */
  advSfx('portal_travel'); /* 双段式第二段: 与遮罩满格同拍 */
  advSetMap(advVeil.to, advMapArriveAt(g)); /* 回程门落点(advPortalExit 口径) */
  if (advVeil.to !== 'home') advTally('visit_' + advVeil.to, 1); /* 到达记账(T8 发现型): home 无此键 */
  const home = advVeil.to === 'home';
  advSpeak(home ? '回到家啦！' : '到' + row.name + '啦！');
  advToast(home ? '🏡 回到家啦！' : '🌀 到' + row.name + '啦！');
}
function advVeilTick(dt) {/* 转场推进(update 每帧): 淡入→满格沿→淡出→收起 */
  if (advVeil.phase === 'idle') return;
  advVeil.t += dt;
  if (advVeil.phase === 'in') {
    advVeilSet(Math.min(1, advVeil.t / ADV_VEIL_T));
    if (advVeil.t >= ADV_VEIL_T) {
      advVeilArrive(); /* 看不见画面的峰值瞬间执行切图(loadScene 先脚下后远景) */
      advVeil.phase = 'out';
      advVeil.t = 0;
      advVeilSet(1);
    }
    return;
  }
  advVeilSet(Math.max(0, 1 - advVeil.t / ADV_VEIL_T)); /* 淡出: 渐进收尾已铺开 */
  if (advVeil.t >= ADV_VEIL_T) advVeilReset();
}

/* ---------- 锁门提示(T7, §2.3): 熄门不可触发, 走近给儿童话术 ----------
     解锁=任务链点亮(§2.3), 本段只读 counts 键; 话术**按任务进度分级**(2026-10-27
     用户实测踩坑收口): 前置任务(挂 unlock 的那条, advUnlockQuest 反查)还没成为
     当前步时不剧透未来步(任务卡「一步步揭示」同款), 只说「先做完手上的任务」——
     照旧话术会把孩子引去「做了也不亮」的地方(如主链没走完时对他说「去门阵广场
     看一看」, 他站进去毫无反馈) */
let advGateLockT = 0; /* 锁门提示节流秒(6s, update 递减) */
const ADV_GATE_LOCK_R = 3.5; /* 提示半径: 玩家到门中心的格数 */
const ADV_GATE_LOCK_CD = 6; /* 同门口提示间隔(不啰嗦) */
function advGateLockTick(dt) {
  advGateLockT = Math.max(0, advGateLockT - dt);
  if (advGateLockT > 0 || advDim !== 'overworld') return;
  for (const g of advMapRow.gates) {
    if (advGateLit(g)) continue; /* 亮门不提示 */
    if (Math.hypot(pos.x - (g.px + ADV_PORTAL.w / 2), pos.z - (g.pz + 0.5)) > ADV_GATE_LOCK_R) continue;
    const row = ADV_MAPS.find((r) => r.id === g.to);
    const nm = row ? row.name : '';
    const uq = advUnlockQuest(g.to); /* 前置任务(挂 unlock 的那条): 缺位兜底泛称 */
    if (!uq || ADV.quest.step < ADV_QUESTS.indexOf(uq)) {/* 链还没走到: 泛指先做任务 */
      advSpeak('这扇门还在睡觉呢！先把任务卡上的任务做完，' + nm + '之门就会亮起来');
      advToast('🔒 先做完任务卡的任务，' + nm + '之门就会亮起来');
    } else {/* 前置任务已是当前步: 点名具体做什么 */
      advSpeak('先' + uq.goal + '，' + nm + '之门就会亮起来');
      advToast('🔒 先' + uq.goal + '，' + nm + '之门就会亮起来');
    }
    advGateLockT = ADV_GATE_LOCK_CD;
    break; /* 一次只提一扇(两门贴近时也不叠话) */
  }
}

function advPortalTick(dt) {/* 传送触发(update 每帧): 冷却递减 + 脚/头格任一在紫色
    门面内(advInPortal, 玩家门/回程门/门阵同一条判据) → 门阵包围盒查表分流
    (advGateAt, T7): 命中=地图门走站桩(2s 可反悔), 否则=玩家 nether 门即时切界。
    进下界前把 advPortalExit 落点记账(回上界出生用, 最后进入者优先 D6);
    下界任意门(回程门/玩家放的门)回上界语义统一。y 用 pos.y 原样(来向地面
    已知安全)。ADV_B.portal=0(精简装载守卫)时整体静默——判据纯核心引用
    下界方块常量 */
  if (advPortalCd > 0) advPortalCd = Math.max(0, advPortalCd - dt);
  if (advPortalCd > 0 || !ADV_B.portal || advSleep.on) return; /* 冷却/睡觉转场/无下界段不触发 */
  if (!advInPortal(getBlock, pos.x, pos.y, pos.z)) {
    advGateHold.t = advGateHoldStep(advGateHold.t, false, dt).t; /* 走出门面即刻归零(可反悔红线) */
    return;
  }
  const gate = advGateAt(pos.x, pos.z); /* 门→目标图绑定: 门阵包围盒查表(未命中=nether 门) */
  const was = advGateHold.t;
  const hold = advGateHoldStep(advGateHold.t, !!gate, dt); /* 站桩步进只对地图门累计 */
  advGateHold.t = hold.t;
  if (gate && was === 0 && hold.t > 0) advSfx('portal_charge'); /* 站桩起步蓄能音(§4.1 双段式第一段) */
  if (gate) {
    if (hold.fire) advVeilFire(gate); /* 站满: 进渐晕转场(冷却/切图在转场段) */
    return; /* 地图门只走站桩——熄门无门面(advInPortal 进不来), 不落 nether 语义 */
  }
  advPortalCd = ADV_PORTAL.cd;
  if (advDim === 'overworld') {
    advExitSpot = advPortalExit(pos.x, pos.y, pos.z, yaw);
    advSetDim('nether');
    advSpeak('进了下界！回到紫色门里就能回家啦！');
    advToast('🌌 进了下界！回到紫色门里就能回家啦！');
  } else {
    advSetDim('overworld');
    advSpeak('回到上界啦');
    advToast('🏡 回到上界啦');
  }
}

/* 神殿可疑地板踩塌(审查修复 P1): 站上神殿室内中央 2×2 砂岩地板 → 4 格塌空
   (先记账后破坏, 爆炸段同款 seam——editBlock 走光场/级联/脏标全链) + 塌沙音 +
   话术; 正下方 y22~23 是建场竖井, 掏掉地板即坠入宝箱室(落室地板 y17, 无摔落
   伤害=坠落限速口径)。幂等: 塌后脚下不是砂岩, 判据天然不复发; edits 已记账
   重进不复位(一次性机关, 塌开的入口保持敞开); 级联不进任务(机关塌落不算孩子挖的) */
function advTempleTrapTick() {
  if (advMap !== 'desert') return;
  const bx = Math.floor(pos.x); const bz = Math.floor(pos.z);
  const by = Math.floor(pos.y - 0.05); /* 脚下支撑格(站上地板=trapY 层) */
  if (getBlock(bx, by, bz) !== B_SANDSTONE || !advTempleTrapOn(bx, bz)) return;
  for (const c of advTempleTrapCells()) {
    if (getBlock(c.x, c.y, c.z) === 0) continue; /* 已塌格跳过(半塌态补刀) */
    advMarkEdit(c.x, c.y, c.z, 0);
    advCascadeApply(editBlock(c.x, c.y, c.z, 0), false);
  }
  advSfx('sand_collapse');
  advSpeak('哇——地板塌啦！下面藏着宝贝！');
  advToast('🕳️ 可疑地板塌啦！');
}

/* ============================================================
   T12 挖掘与采集 — 交互段(挂 onMouse/update)
   (蓄力步进/放置合法性/食物政策/树苗计时纯函数在 adventure-core.js;
    蓄力循环/放置/破坏/门开关的壳段在 place-kit.js, 本段只剩状态与输入)
   ============================================================ */
const advSaplings = new Map(); /* 树苗计时 "x,y,z"→{x,y,z,left}; 重进经全图扫描重建 */
const advMine = {down: false, t: 0, key: '', need: 0, drops: true, swingT: 0}; /* 蓄力状态机 */
let advMouseHeld = false; /* 桌面按住标志(document mousedown/up 维护; 失焦/解锁经 onHold(false) 自愈 —
  丢 mouseup 不再卡连挖): 按住连挖, 触屏单击挖一块 */

/* TNT 短按/按住二分(D3, 挖掘硬度修正): mousedown 只记账不点燃 — 松手
   <0.25s = 点燃(现状口径), 按住 ≥0.25s = 转蓄力挖走回收(hard 0)。
   触屏单击天然走「松手」分支(advMouseHeld 恒 false)。状态机纯步进
   advTntTapStep/ADV_TNT_TAP_T 在 adventure-core, 这里持状态与面板守卫。 */
let advTntTap = null; /* {x, y, z, held} | null */
function advTntTapTick(dt) {
  const r = advTntTapStep(advTntTap, advMouseHeld, ADV.panelOpen || advFurnace.isOpen(), dt);
  advTntTap = r.state;
  if (r.act && r.act.ignite && getBlock(r.act.x, r.act.y, r.act.z) === B_TNT) {
    advIgnite(r.act.x, r.act.y, r.act.z); /* 块还在才点(被掀走则作废) */
  }
  if (r.act && r.act.mine) advMine.down = true; /* 按住转蓄力(准星已移开则蓄力链自清) */
}

/* 准星命中(每帧蓄力判定用) → kit 静态件薄转发(Node 测试无相机件返 null) */
function advAimHit() {
  return PlaceKit.aimHit();
}

/* 蓄力清零(松手/换目标不可挖/面板打开/退出模式) → kit 薄转发 */
function advMineStop() {
  advPlaceKit.mineStop(advMine);
}

/* 级联块结算(方块级联设计稿 D4/D5/P6): 记账编排(移动两格/树苗撤表/掉落清单/
   任务旗标)纯段在 adventure-core(advCascadeLedger, 存档红线件——重进不复活:
   漏记会复活半棵树), 编辑动作经 sink 接线到本壳的记账/掉落/任务入口;
   观感(整树倒话术)留此回调。quest=true 蓄力链视同玩家亲手挖; TNT 链传
   false——「TNT 掀掉的不算」既有口径。 */
const advCascadeSink = {
  mark: advMarkEdit,
  sapling: (x, y, z) => advSaplings.delete(blockKey(x, y, z)),
  crop: (x, y, z) => advWheats.delete(blockKey(x, y, z)), /* 麦苗脱落撤生长计时(farm-and-recipe D3) */
  drop: (id, n, x, y, z) => Drops.spawn(id, n, x, y, z),
  questMine: advQuestMine,
  mined: advOreMined, /* 生态恢复: 矿位开采记账(挖掘/TNT 两路同经 advCascadeLedger) */
};
/* ---------- 放置链 kit 实例(PlaceKit, docs/showroom-design.md §8): 探险政策全走缝 ----------
    规则(合法性/结构/级联/掉落/蓄力)早已在纯函数与 kit, 这里只注入探险侧
    政策: 世界档 journal+站点缓存(onEdit=advMarkEdit) · 任务 tally+树苗挂表
    (onPlaced) · 快捷栏同步(onConsume) · 级联 sink(advCascadeSink 原样) ·
    整树倒话术 · 磨损(advWearHeld('mine')) · 儿童 TTS/toast/音效 · 准星环/
    挥动 · 网格收口(传送门直写) · 硬块话术(advMineHardText 纯 seam 原样)。
    体验馆是同一缝上的另一个 adapter(dev 降噪: 无 journal/无 TTS/静默)。 */
const advPlaceKit = PlaceKit.mkEditor({
  inv: advInv,
  sel: () => advHb.sel,
  pos: () => pos,
  onEdit: advMarkEdit,
  onPlaced: (blockId, x, y, z) => {
    if (blockId === B_CRAFT) advTally('place_craft_table', 1); /* T15: 站点放置记账(任务链消费的两键) */
    if (blockId === B_FURNACE) advTally('place_furnace', 1);
    if (blockId === B_CHEST) advTally('place_chest', 1); /* 引导链 v2: 箱子步(合成/放置/打开三条件) */
    if (blockId === B_SAPLING) {
      advTally('place_sapling', 1); /* 引导链 v2: 种树苗步(砍了树要种回去) */
      advSapPlant(x, y, z);
    }
  },
  onConsume: advSyncHotbar,
  onPortalPlaced: (by, px, pz) => advBeamAdd(by, px, pz), /* 这扇门的光束顺路锚上(切界时随全量重锚) */
  cascade: advCascadeSink,
  onFelled: () => {/* 整树倒: 只为含原木的级联喊话(火把/草丛脱落不出声) */
    advSpeak('哇！大树倒啦！');
    advToast('🌳 大树倒啦！');
  },
  wear: () => advWearHeld('mine'),
  say: advToast, /* say/speak/sfx 媒体三通道经包装走政策缝 advProfile(U2): 缺省直通, U4 dev 静默 */
  speak: (t) => advSpeak(t),
  sfx: advSfx,
  ring: advRingSet,
  swing: () => Avatar.swing(),
  mesh: {touch: advMeshTouch, flush: advMeshFlush},
  hardText: advMineHardText,
});
function advCascadeApply(removed, quest) {
  return advPlaceKit.applyCascade(removed, quest);
}

/* 破坏结算 → kit 薄转发(挂点名保留, advBreakBlock 既有测试/TNT 链零改动) */
function advBreakBlock(x, y, z, id, bt) {
  advPlaceKit.breakBlock(x, y, z, id, bt);
}

/* 「挖不动」话术(微默认3, D5/D7): 无 hard 方块 = 声明式不可破坏, 蓄力链不起
   进度, 改给 3s 节流的儿童话术(节流账本在 place-kit 实例内, tickTimers 递减);
   判据用 ADV_B 集中解析(精简装载守卫), 其余无 hard 方块(水等)保持静默 */
function advMineHardText(id) {/* 目标格 → 话术(纯 seam, 单测直触); 空串 = 不出声 */
  if (id === ADV_B.portal || id === ADV_B.obsidian) return '传送门是魔法做的，挖不动哦';
  if (id === ADV_B.netherrack || id === ADV_B.glowstone || id === ADV_B.brick) {
    return '这块石头太硬啦，挖不动哦';
  }
  return '';
}

/* 蓄力推进(update 每帧) → kit 薄转发: 状态(advMine)/准星(advAimHit)/
   按住(advMouseHeld)/面板守卫是探险输入, 循环编排与破坏结算全在 kit */
function advMineTick(dt) {
  advPlaceKit.mineTick(advMine, advAimHit(), dt,
      {held: advMouseHeld, panelOpen: ADV.panelOpen || advFurnace.isOpen()});
}

/* 放置交互 → kit 薄转发(挂点名保留, 既有测试/触屏 mkMainAct 零改动):
   单格放置 + 门/传送门结构拦截分支全在 kit, 树苗挂表经 onPlaced 缝回来 */
function advTryPlace(hit) {
  return advPlaceKit.tryPlace(hit);
}

/* 下界传送门放置 → kit 薄转发(挂点名保留; 结构/记账/扣件全在 kit,
   光束观感经 onPortalPlaced 缝回探险) */
function advPlacePortal(hit) {
  return advPlaceKit.placePortal(hit);
}

/* 门放置 → kit 薄转发(挂点名保留, door-window 既有测试零改动) */
function advPlaceDoor(hit) {
  return advPlaceKit.placeDoor(hit);
}

/* 门配对破坏 → kit 薄转发(TNT 链 quest=false 同走此处, 口径不变) */
function advDoorBreakApply(bx, by, bz, quest) {
  advPlaceKit.doorBreakApply(bx, by, bz, quest);
}

/* 树苗挂表: 20s 后长成(D7); 重进经 advRescanSaplings 全图重建计时 */
function advSapPlant(x, y, z) {
  advSaplings.set(blockKey(x, y, z), {x, y, z, left: ADV_SAP_GROW});
}

/* 树苗长成: SceneKit.tree(确定性外观与地形树一致) + 足迹逐块记账(纯段
   advGrowMark 在 adventure-core: y..y+7 / ±2 粗扫, 重放同值幂等) */
function advGrowTree(x, y, z, line) {/* 长树全链: SceneKit.tree + 足迹逐块记账(纯段
   advGrowMark: y..y+7 / ±2 粗扫, 重放同值幂等) + 网格收口 + toast(树苗/自主恢复两路共用) */
  SceneKit.tree(x, y, z);
  advGrowMark(x, y, z, getBlock, advMarkEdit);
  for (let dx = -2; dx <= 2; dx++) {/* 网格收口: 树 footprint ±2 与 advGrowMark 同款——
      SceneKit.tree 也是 setBlockRaw 直写, 不标脏会长出「看不见的树」 */
    for (let dz = -2; dz <= 2; dz++) advMeshTouch(x + dx, z + dz);
  }
  advMeshFlush();
  advToast(line || '🌱 小树苗长成大树啦！');
}

/* 树苗计时推进(update 每帧): 到期先过占位预检(拒绝式——被实体方块围住就
   不长, 重挂 20s 再试, MC 受阻树苗同语义, 调研稿 §2.2), 过检才长 */
function advSapTick(dt) {
  for (const s of advSapDue(advSaplings, dt)) {
    if (!advTreeSpotOpen(s.x, s.y, s.z, getBlock)) {
      advSapPlant(s.x, s.y, s.z);
      continue;
    }
    advGrowTree(s.x, s.y, s.z);
  }
}

/* 全图扫树苗重建计时(init 重放 edits 后调): 计时不落盘, 重进重挂 20s */
function advRescanSaplings() {
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 1; y < WORLD_H; y++) {
        if (getBlock(x, y, z) === B_SAPLING) advSapPlant(x, y, z);
      }
    }
  }
}

/* ---------- 农田生长(farm-and-recipe 设计稿 D3): 计时 Map 不落盘, 重进
   advRescanWheats 全图扫未熟麦重挂——树苗计时同款三通道(挂表/推进/撤表);
   纯判定(下一阶段/可垦/可种/可催)在 adventure-core ---------- */
const advWheats = new Map(); /* 生长计时 "x,y,z"→{x,y,z,left}; 每阶段 20s(D7) */
function advWheatArm(x, y, z) {
  advWheats.set(blockKey(x, y, z), {x, y, z, left: ADV_WHEAT_GROW});
}
/* 阶段推进: 换 id + 记账 + 收口(setBlockRaw 直写不标脏会长出「看不见的麦子」,
   advGrowTree 同理); 未熟重挂下一阶段, 成熟撤表静等收割(0=无下一步不动作) */
function advWheatAdvance(x, y, z) {
  const nxt = advWheatNext(getBlock(x, y, z));
  if (!nxt) return;
  setBlockRaw(x, y, z, nxt);
  advMarkEdit(x, y, z, nxt);
  advMeshTouch(x, z);
  advMeshFlush();
  if (advRipenOk(nxt)) advWheatArm(x, y, z);
}
function advWheatTick(dt) {/* 生长推进(update 每帧): 复用 advSapDue 通用到期步进 */
  for (const s of advSapDue(advWheats, dt)) advWheatAdvance(s.x, s.y, s.z);
}
function advRescanWheats() {/* 全图扫未熟麦重建计时(init 重放 edits 后调) */
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 1; y < WORLD_H; y++) {
        if (advRipenOk(getBlock(x, y, z))) advWheatArm(x, y, z);
      }
    }
  }
}

/* ============================================================
/* ============================================================
   生态恢复·壳装配 (docs/eco-recovery-design.md §1/§3, ADR 0006) — 账本接线
   纯函数段(占位预检/凋零派生/矿位结算)在 adventure-core; 这里只持账本与
   施加(树苗同款: 计时不落盘, 重进重扫重建)。
   ============================================================ */
function advTodayOrd() {/* 今日日序数(生态恢复日期唯一换算点): 精简装载环境
   (体验馆 vm 子集)无 CampCore/budgetDateStr 时回落 NaN——消费方 NaN 比较
   恒不到期/成年兜底, item-hint 的 SpeechKit 守卫同款口径 */
  return (typeof budgetDateStr === 'function' && typeof CampCore !== 'undefined') ?
    CampCore.dayIndex(budgetDateStr()) : NaN;
}
function advBuildScene(row) {/* 建场统一缝(init/切图/回界三处共用): 矿位白名单
   先清后建——建场期 advTryOre 逐位记录, 同 seed 同清单, 回填只认本场清单 */
  advOreSpotsReset();
  row.build();
}
function advOreMined(id, x, y, z) {/* 矿位开采记账(级联账本 mined sink——挖掘/TNT
   两路同经 advCascadeLedger): 被移除的是矿石 → 记开采日(跨天回填依据), 当日不回填 */
  if (!advIsOre(id)) return;
  advOreRegen[advOreKey(advSceneKey(), x, y, z)] = budgetDateStr();
  advStore.touch();
}
function advRescanTreeRegen() {/* 进场重扫(advRescanSaplings 同拍同法): 凋零树位逐个
   挂抖动恢复计时——SceneKit.rand 派生 ±JIT 错峰; 树位清单是 home 常量派生,
   他图清账不挂(远征图树不参与自主恢复, 附录 B 差异 2 的范围注记) */
  advTreeRegen.clear();
  if (advMap !== 'home') return;
  for (const s of advTreeRegenSpots(advTreeSpots(), ADV_GROUND, advHeightAt, getBlock)) {
    const jit = (SceneKit.rand(s.x, s.z, 7301) * 2 - 1) * ADV_TREE_REGROW_JIT;
    advTreeRegen.set(blockKey(s.x, s.y, s.z), {x: s.x, y: s.y, z: s.z, left: ADV_TREE_REGROW_S + jit});
  }
}
function advTreeRegenTick(dt) {/* 凋零树位到期(update 每帧, 与树苗同拍): 基格已有
   原木=孩子补种赢了 → 撤销; 占位预检不过 → 重挂再试(拆了占位建筑树会回来);
   过检 → 走 advGrowTree 全链(足迹记账+网格收口, 重放幂等) */
  for (const s of advSapDue(advTreeRegen, dt)) {
    if (getBlock(s.x, s.y, s.z) === ADV_LOG_ID) continue;
    if (!advTreeSpotOpen(s.x, s.y, s.z, getBlock)) {
      advTreeRegen.set(blockKey(s.x, s.y, s.z), {x: s.x, y: s.y, z: s.z, left: ADV_TREE_REGROW_RETRY_S});
      continue;
    }
    advGrowTree(s.x, s.y, s.z, '🌲 空地上的小树悄悄长回来啦！');
  }
}
function advOreRegenTick() {/* 到期矿位回填(跨天拍板②): 只结当前场景的账——日期早于
   今日的矿位, 空气位回填原矿种(edits 记账+网格收口, 重放幂等), 被占位销账
   (玩家改建永久优先于恢复); 矿种从建场期白名单查, 查无=孤儿账一并销 */
  const keys = Object.keys(advOreRegen);
  if (!keys.length) return; /* 空账速返(常见路径) */
  const today = advTodayOrd();
  if (Number.isNaN(today)) return; /* 精简装载环境: 无法判「今日」→ 保守不回填 */
  const scene = advSceneKey();
  const entries = [];
  for (const k of keys) {
    const p = advOreParseKey(k);
    if (!p || p.scene !== scene) continue;
    const dayOrd = CampCore.dayIndex(advOreRegen[k]);
    if (!Number.isNaN(dayOrd) && advOreDue(dayOrd, today)) entries.push(p);
  }
  if (!entries.length) return;
  const spots = {};
  for (const s of advOreSpots) spots[s.x + ',' + s.y + ',' + s.z] = s.id;
  const plan = advOreRefillPlan(entries, getBlock);
  for (const e of plan.drop) delete advOreRegen[advOreKey(e.scene, e.x, e.y, e.z)];
  let n = 0;
  for (const e of plan.fill) {
    const id = spots[e.x + ',' + e.y + ',' + e.z];
    delete advOreRegen[advOreKey(e.scene, e.x, e.y, e.z)];
    if (id == null) continue;
    setBlockRaw(e.x, e.y, e.z, id);
    advMarkEdit(e.x, e.y, e.z, id);
    advMeshTouch(e.x, e.z);
    n++;
  }
  if (n) {
    advMeshFlush();
    advToast('⛏️ 矿山慢慢长回来了一些！');
  }
}

/* 吃食物: 点击手持食物(D4) — 满血不吃; 回血走 advEatPolicy(腐肉同口径),
   remove 吃一口返堆拷贝(inventory-core 口径), 头顶血条随 hp 变化自动重绘;
   full 旗标(金苹果)由 advEatPolicy 解读=直接回满(F3, 二期设计稿 §3),
   此处只透传不判断 */
function advTryEat() {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  const it = s ? ITEMS[s.id] : null;
  if (!it || it.food == null) return false;
  const e = advGetPEnt();
  const pol = advEatPolicy(e.hp, e.maxHp, it.food, it.full);
  if (!pol.canEat) {
    advToast('现在饱饱的，还不饿哦！');
    return true; /* 吃过 attempt 但没吃: 不进入蓄力 */
  }
  e.hp = pol.hp;
  ADV.player.hp = pol.hp;
  remove(advInv, slot, 1);
  advSyncHotbar();
  advSfx('pick');
  advSpeak('咔嚓咔嚓真好吃！');
  advToast('😋 吃掉 ' + it.name + '，生命 +' + pol.healed);
  return true;
}

/* 投掷雪球(T9): 手持雪球右键/触屏轻点 — swingAction 占冷却与剑同一条轨道
   (换手不躲冷却, 下界弓口径), 弹沿准星出膛(低初速高重力), 消耗手持 1 颗;
   零伤害红线: dmg 0 只击退(kpow 1.1), 命中观感/音效归 advSnowballs.onHitMob */
function advTryThrowSnowball() {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  if (!s || s.id !== 'snowball') return false;
  const threw = advMelee.swingAction(advGetPEnt(), {cooldown: ADV_SNOWBALL_CD, act: () => {
    advSnowballs.shootFromAim({speed: ADV_SNOWBALL_SPEED, dmg: 0, kpow: ADV_SNOWBALL_KPOW,
      g: ADV_SNOWBALL_G, life: ADV_SNOWBALL_LIFE});
    remove(advInv, slot, 1);
    advTally('throw_snowball', 1); /* 投掷记账(T8 雪原远征步): 掷出即算, 不问命中 */
    advSyncHotbar();
  }});
  if (threw) advSfx('snow_throw'); /* 掷出「噗」(冷却内连点不播) */
  return true; /* 手持雪球: 点击恒算投掷 attempt, 不落放置 */
}

/* 大背包使用器(2026-10, docs/bag-and-drop-design.md §2): 手持 bag_upgrade 使用
   (右键使用档/触屏专用键两处触达, ItemUseRegistry 'expand_bag' 档) → 背包就地
   +BAG_EXPAND_SLOTS 空槽(27→33, push 保引用稳定——面板/快捷栏闭包不脱钩);
   一次性=已顶格礼貌拒绝不消耗(配方卡也已隐藏, 这是孩子硬留旧件时的兜底话术) */
function advTryExpandBag() {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  if (!s || s.id !== 'bag_upgrade') return false;
  if (advInv.slots.length >= BAG_MAX_SLOTS) {
    advSpeak('背包已经是最大的啦！');
    advToast('🎒 背包已经扩过容啦');
    return true; /* 恒算使用 attempt 不落放置(弓同口径), 也不消耗 */
  }
  for (let i = 0; i < BAG_EXPAND_SLOTS; i++) advInv.slots.push(null);
  remove(advInv, slot, 1); /* 消耗手持件(农田链同款扣件) */
  advSyncHotbar();
  advStore.saveBag(); /* 扩容即存: slots 长度 33 随背包存档落盘(重进不缩回; ADR 0002 键面在背包壳) */
  advTally('expand_bag', 1);
  advSfx('level'); /* 晋升琶音(仪式音): 背包变大的庆祝感 */
  advSpeak('哇！背包变大啦，可以装更多宝贝了！');
  advToast('🎒 背包扩容成功！多了 6 格');
  return true;
}

const advUseRun = {shoot: () => advTryShootBow(),
  plant: () => advTryPlant(), ripen: () => advTryRipen(),
  expand_bag: () => advTryExpandBag(),
  shear: () => advTryShear()}; /* 使用动作注册表 act 键 → 执行器
   (行为不进注册表——「战斗政策在模式层」红线, 手持物注册表词条同款口径;
    plant/ripen 为农田链两键, farm-and-recipe D3; expand_bag 为扩容件, 2026-10;
    shear 为剪羊毛键, 2026-10-28) */
function advTryUseHeld() {/* 使用档通用分派(2026-10-28 Route A): 选中物品在使用动作
   注册表有条目 → 逐 act 调执行器, 有使用动作的物品点击恒算使用 attempt
   不落放置(弓同雪球口径); 未注册物品返 false 回落吃/放置链 */
  const s = advInv.slots[advHb.sel];
  const uses = s ? itemUses(s.id) : null;
  if (!uses) return false;
  for (const u of uses) {
    if (advUseRun[u.act]) advUseRun[u.act]();
  }
  return true;
}

/* 射箭(手持弓, 2026-10-28 弓物品化): 'shoot' 执行器——onMouse(2) 使用档经
   advTryUseHeld(使用动作注册表驱动)与触屏 🏹 专用键两处触达; 攻击键不放箭
   (2026-10-28 Route A 拍板回归 MC 正典: 持弓左键=空手挖/打, 近战伤害空手
   3 点——1148fe2 的攻击键弓分支撤销); swingAction 占剑同一条冷却轨道(拉弓
   0.55s, 换武器不躲冷却, nether 弓口径), 出手观感=弓 def 的蓄力前送
   (Avatar.swing 随 def 走), 弹由 advBolts 管线步进(shoot/hit 音效与骷髅箭
   同源, mkArrows 默认内置);
   无弹药设计(儿童版): 箭不消耗、弓无耐久不磨损, 冷却即节奏——远程优势不设资源门槛 */
function advTryShootBow() {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  if (!s || s.id !== 'bow_item') return false;
  advMelee.swingAction(advGetPEnt(), {cooldown: ADV_BOW_CD, act: () => {
    advBolts.shootFromAim({speed: ADV_BOW_SPEED, dmg: ADV_BOW_DMG, kpow: ADV_BOW_KPOW,
      g: ADV_BOW_G, life: ADV_BOW_LIFE});
  }});
  return true; /* 手持弓: 点击恒算放箭 attempt, 不落放置 */
}

/* ---------- 剪羊毛执行器(2026-10-28, F4 牧场延伸) ----------
   手持剪刀对准羊使用: 桌面右键(使用档经 advTryUseHeld)与触屏 ✂️ 专用键
   两处触达(弓同款两 affordance)。目标 = 准星锥内最近目标(与挥击同一瞄准,
   advMelee.aim)中可剪的羊: 成年(幼崽免伤同口径)且未剪过。剪毛零伤害
   (温和收获口径——攻击键照旧能伤羊, 剪是另一回事); 挥击/剪共用一条冷却
   轨道(swingAction), 防连点连剪。点错目标给引导话术(农田链同款节流),
   指空静默(右键悬空不叨叨)。恒算使用 attempt 不落放置(弓同口径) */
function advTryShear() {
  const s = advInv.slots[advHb.sel];
  if (!s || s.id !== 'shears') return false;
  const m = advMelee.aim(advGetPEnt());
  if (m && m.type === 'sheep' && !m.__baby && !m.__sheared) {
    advMelee.swingAction(advGetPEnt(), {act: () => advShearSheep(m)});
  } else if (m) {
    advFarmHint(m.type === 'sheep' ? '这只羊刚剪过啦，等毛长回来再剪哦' : '要对着毛茸茸的羊才能剪哦');
  }
  return true;
}

/* ---------- 农田交互三执行器(farm-and-recipe 设计稿 D3) ----------
   纯判定(advHoeOk/advPlantOk/advWheatNext/advRipenOk)在 adventure-core;
   世界写=setBlockRaw 直写+记账+收口(advGrowTree 同款), 扣件经背包核心
   remove(雪球掷出同款), 引导话术 3s 节流(挖不动话术同拍)。 */
let advFarmHintT = 0; /* 引导话术节流账本(update 递减) */
function advFarmHint(text) {
  if (advFarmHintT > 0) return;
  advFarmHintT = 3;
  advSpeak(text);
}
/* 锄地(空手=锄, D7 两步正典): 桌面右键空手点击/触屏🪓锄地键两处触达;
   非可垦块返 false 回落放置链(空手 noop); **手持任意物品直接让路**——
   右键归使用/放置链(MC 口径: 拿着东西点击=用/放, 不锄地) */
function advTryHoe() {
  const held = advInv.slots[advHb.sel];
  if (held) return false;
  const hit = advAimHit();
  if (!hit) return false;
  if (!advHoeOk(getBlock(hit.x, hit.y, hit.z), getBlock(hit.x, hit.y + 1, hit.z))) return false;
  setBlockRaw(hit.x, hit.y, hit.z, B_FARMLAND);
  advMarkEdit(hit.x, hit.y, hit.z, B_FARMLAND);
  advMeshTouch(hit.x, hit.z);
  advMeshFlush();
  advSfx('sand_collapse');
  advFarmHint('地翻好啦！拿着种子点耕地就能种麦子哦');
  return true;
}
/* 播种(手持种子, 注册表 act 'plant'): 点耕地落麦苗+扣 1 件+挂生长计时;
   点错地方给引导话术不扣件, 恒算使用 attempt 不落放置(弓同口径) */
function advTryPlant() {
  const hit = advAimHit();
  if (!hit || !advPlantOk(getBlock(hit.x, hit.y, hit.z), getBlock(hit.x, hit.y + 1, hit.z))) {
    advFarmHint('种子要种在翻好的耕地上哦');
    return true;
  }
  remove(advInv, advHb.sel, 1);
  setBlockRaw(hit.x, hit.y + 1, hit.z, B_WHEAT_0);
  advMarkEdit(hit.x, hit.y + 1, hit.z, B_WHEAT_0);
  advMeshTouch(hit.x, hit.z);
  advMeshFlush();
  advWheatArm(hit.x, hit.y + 1, hit.z);
  advSyncHotbar();
  advSfx('snow_throw');
  advTally('plant_wheat', 1);
  return true;
}
/* 催熟(手持骨粉, 注册表 act 'ripen'): 麦苗 +1 阶段(D7 确定性, MC 随机 2-5 的
   差异登记在案)+扣 1 件; 催到成熟有庆祝句(收成的仪式感) */
function advTryRipen() {
  const hit = advAimHit();
  const cur = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
  if (!advRipenOk(cur)) {
    advFarmHint('骨粉要撒在麦苗上哦');
    return true;
  }
  remove(advInv, advHb.sel, 1);
  const nxt = advWheatNext(cur);
  setBlockRaw(hit.x, hit.y, hit.z, nxt);
  advMarkEdit(hit.x, hit.y, hit.z, nxt);
  advMeshTouch(hit.x, hit.z);
  advMeshFlush();
  advWheats.delete(blockKey(hit.x, hit.y, hit.z));
  if (advRipenOk(nxt)) advWheatArm(hit.x, hit.y, hit.z);
  advSyncHotbar();
  advSfx('pick');
  if (!advRipenOk(nxt)) advSpeak('小麦熟啦！你真有耐心！');
  return true;
}

/* 掉落物收集回调(Drops.onCollect, init 挂/cleanup 随 Drops.clear 解除):
   入包并堆, 一件都放不下才拒返 false(掉落物停地上冷却重试, D6 背包满);
   dur 非 null=玩家丢弃的耐久件(工具/灯笼): 空槽直放不经 add——mkStack
   会把耐久重铸满(捡回即白得耐久=作弊), 与 advChestTake 同一红线;
   收集 TTS 合并播报(3s 节流)归 T14, 这里只 toast+音效 */
function advOnCollect(itemId, n, dur) {
  if (dur != null) {
    const i = advInv.slots.findIndex((t) => !t);
    if (i < 0) {
      advToast('🎒 背包满啦');
      return false;
    }
    advInv.slots[i] = {id: itemId, n, dur}; /* 耐久原样回家 */
    advTally('collect_' + itemId, n);
    advSyncHotbar();
    advSfx('pick');
    const dname = (ITEMS[itemId] && ITEMS[itemId].name) || itemId;
    advToast('🎒 捡回 ' + dname + ' ×' + n);
    return true;
  }
  const left = add(advInv, itemId, n);
  if (left >= n) {
    advToast('🎒 背包满啦');
    return false;
  }
  advTally('collect_' + itemId, n - left); /* T15: 实收件数记账(满包部分入包按收到的算) */
  advSyncHotbar();
  advSfx('pick');
  const name = (ITEMS[itemId] && ITEMS[itemId].name) || itemId;
  advToast('🎒 捡到 ' + name + ' ×' + n);
  return true;
}

/* 丢弃件退场回收(2026-10, docs/bag-and-drop-design.md §1): 切图/重进/退出
   模式前, 地上还没被捡回的丢弃件(thrown 旗)原样收回归包——「扔出去的东西
   不因退场蒸发」(零损失红线; 挖落/怪落件不在册, 沿用旧到期口径)。装不下的
   部分(整摞无空槽/并堆余量)转普通掉落物留地上: 摘掉 thrown/holdFar 旗,
   掐断「回收→再回收」循环, 按旧口径到点静默消失 */
function advReclaimThrown() {
  let touched = false;
  for (const d of Drops.list()) {
    if (!d.thrown || d.gone) continue;
    d.gone = true; /* 先按收走记账(不触发收集回调——退场播报没有意义) */
    if (d.dur != null) {/* 耐久件: 空槽直放, 不经 add(mkStack 重铸红线) */
      const i = advInv.slots.findIndex((t) => !t);
      if (i >= 0) {
        advInv.slots[i] = {id: d.id, n: d.n, dur: d.dur};
        touched = true;
        continue;
      }
    } else {
      const left = add(advInv, d.id, d.n);
      if (left === 0) {
        touched = true;
        continue;
      }
      d.n = left; /* 部分入包: 余量留地上 */
    }
    d.gone = false;
    d.thrown = false;
    d.holdFar = false;
  }
  if (touched) advSyncHotbar();
}

/* ---------- 挖掘进度环(conic-gradient 圆环, 自建 DOM 不依赖 index.html) ----------
   位置: 触屏长按期间画在指尖(Input.holdPt, MC 口径"进度图形跟手"),
   桌面/准星口径仍在屏幕中心 */
let advRingEl = null;
function advRingSet(p) {
  if (typeof document === 'undefined') return;
  if (!advRingEl) {
    if (p < 0) return;
    advRingEl = document.createElement('div');
    advRingEl.style.cssText = 'position:fixed;left:50%;top:50%;width:40px;height:40px;' +
        'margin:-20px 0 0 -20px;border-radius:50%;pointer-events:none;z-index:9;';
    advRingEl.style.webkitMask = advRingEl.style.mask =
        'radial-gradient(circle, transparent 12px, #000 13px)'; /* 中心留孔露出准星 */
    document.body.appendChild(advRingEl);
  }
  advRingEl.style.display = p < 0 ? 'none' : 'block';
  if (p >= 0) {
    const hp = (typeof Input !== 'undefined' && Input.holdPt) ? Input.holdPt : null;
    advRingEl.style.left = hp ? hp.x + 'px' : '50%';
    advRingEl.style.top = hp ? hp.y + 'px' : '50%';
    advRingEl.style.background =
        'conic-gradient(#ffd23f ' + Math.round(p * 360) + 'deg, rgba(255,255,255,0.3) 0)';
  }
}
function advRingDispose() {
  if (!advRingEl) return;
  if (advRingEl.parentNode) advRingEl.parentNode.removeChild(advRingEl);
  advRingEl = null;
}

/* ---------- 桌面按住检测(capture 阶段先于 input.js 的 mousedown 路由) ---------- */
function advMouseHeldOn() {
  advMouseHeld = true;
}
function advMouseHeldOff() {
  advMouseHeld = false;
}
function advMouseListeners(on) {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  const opt = {capture: true};
  if (on) {
    document.addEventListener('mousedown', advMouseHeldOn, opt);
    document.addEventListener('mouseup', advMouseHeldOff, opt);
  } else {
    document.removeEventListener('mousedown', advMouseHeldOn, opt);
    document.removeEventListener('mouseup', advMouseHeldOff, opt);
  }
}

/* 收集播报合并窗(D6): 进账并入缓冲并开/续 3s 窗, 到期一句合并播报 */
const advPickBuf = new Map(); /* 物品 id → 窗内累计数量 */
let advPickT = 0;
function advPickupTick(dt) {
  if (advPickBuf.size === 0) return;
  advPickT -= dt;
  if (advPickT > 0) return;
  advSpeak(advPickupText(advPickBuf));
  advPickBuf.clear();
}

/* ============================================================
   T13 合成与烧炼 — 交互段(挂 onMouse/update)
   (站点判定/烧炼节律/退炉政策/TNT 掷骰纯函数在 adventure-core.js)
   ============================================================ */

/* 站点沿检测(update 每帧): 首次靠近工作台给一句 TTS 引导(上升沿一次不唠叨;
    隔墙不算「靠近」——advStationOk 的视线缝一并管住播报, 门外不误报);
    开着配方书走近 → 亮灰实时重算(table 级卡片点亮) */
let advTableNear = false;
function advStationTick() {
  const near = advStationOk();
  if (near && !advTableNear) {
    advSpeak('走到工作台旁边啦！打开背包，更多配方亮起来咯！');
    if (ADV.panelOpen) advPanel.refresh();
  }
  advTableNear = near;
}

/* 世界重放后重建站点缓存(init 调): 站点只可能来自玩家放置 → O(edits) 收集 */
function advRescanStations() {
  advStations.clear();
  for (const [k, v] of advStore.journal.edits) {
    if (v !== B_CRAFT && v !== B_FURNACE) continue;
    const p = k.split(',');
    advStations.set(k, {x: +p[0], y: +p[1], z: +p[2], id: v});
  }
}

/* 熔炉状态机(F1 拍板①: 每炉独立 + 随世界档持久化) — T4 起装配收编共享熔炉
   kit(js/furnace-kit.js, 体验馆同款): 面板开合/取产物/自动+手动放料/炉槽
   取回/逐炉推进/签名节流喂显(产物槽 out→output 桥接随 kit 修复)/挖炉退料/
   燃料余量比全在 kit; 本壳经 advFurnace 站点实例直达(open/close/isOpen/at/
   state/autoFill/manualPut/slotClick/drop/map——开态唯一真值 isOpen, 炉态
   Map 引用即 kit 的 Map, 测试触达面经此不再另设名号薄委托), 探险特有的
   完成播报节流计时(原 advFurnaceTick 的节律尾钩拆归 update)。 */
const advFurnaces = advFurnace.map; /* 炉态 Map(引用即 kit 的 Map, init 重灌/火焰差异增删消费) */
let advSmeltTtsT = 0; /* 完成播报节流计时(update 递减, kit onMade 消费) */

/* ---------- 炉口火焰(F2 点燃观感, 设计稿 §2.1): 纯观感层, 不进方块数据/存档 ----------
   燃烧判定 heat>0 && input(与 smeltStep 推进条件一致——无料有热不算烧);
   advFlames 差异增删挂在 advFurnaceTick 尾部(起燃加/熄灭删), Sprite 惰性
   创建(mkHpBar 同款守卫: THREE/DOM/scene 缺任一不建观感, 逻辑集照记 null——
   Node 单测经 advFlameCount() 断言增删节律); 明确不采用「燃烧换方块 id」
   (lit furnace 会污染 edits 账本, plan 决策 7) */
const advFlames = new Map(); /* posKey → THREE.Sprite(无渲染环境值为 null) */
let advFlameTex = null; /* 共享贴图: 全部火焰一个 16×16 CanvasTexture(drops.texCache 口径, 不随实例销毁) */
let advFlamePhase = 0; /* 脉动相位(update 的 dt 累计, 全炉同相) */
const ADV_FLAME_T = 0.9; /* 脉动周期(秒, 设计稿 §2.1 参数表) */
const ADV_FLAME_SIZE = 0.38; const ADV_FLAME_AMP = 0.07; /* 基准尺寸与振幅 */
const ADV_FLAME_COLOR = 0xffa040; /* 加色混合暖色 */

function advFlameTexture() {/* 贴图惰性建一次: 按钮工坊 flame 字符画 16×16 画布 → CanvasTexture
  (button-icons 加载序在本文件之后, 故运行期才取 BTN_PIX——mkHpBar 用 heart 同款) */
  if (advFlameTex || typeof THREE === 'undefined' || typeof document === 'undefined') return advFlameTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  drawArt(cv.getContext('2d'), BTN_PIX.flame.art, BTN_PIX.flame.map);
  advFlameTex = new THREE.CanvasTexture(cv);
  return advFlameTex;
}
function advFlameMount(posKey) {/* 起燃建 Sprite 挂场景: 炉顶(x+0.5, y+1.05, z+0.5), 加色混合
  暖色, renderOrder 高于方块(设计稿 §2.1 参数表); 无渲染环境返 null */
  const tex = advFlameTexture();
  if (!tex || typeof scene === 'undefined') return null;
  const p = advFurnPos(posKey); /* 炉键解析统一走界键助手(剥 'n|', D14) */
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, color: ADV_FLAME_COLOR}));
  sp.renderOrder = 10;
  sp.position.set(+p[0] + 0.5, +p[1] + 1.05, +p[2] + 0.5);
  sp.scale.set(ADV_FLAME_SIZE, ADV_FLAME_SIZE, 1);
  scene.add(sp);
  return sp;
}
function advFlameOff(posKey) {/* 熄灭/消失单清: 摘场景销毁材质(贴图共享不销), 逻辑集出列 */
  const sp = advFlames.get(posKey);
  if (sp && typeof scene !== 'undefined') {
    scene.remove(sp);
    sp.material.dispose();
  }
  advFlames.delete(posKey);
}
function advFlamesClear() {/* 全清(退出模式/init 复位): 场景对象不渗漏 */
  for (const k of [...advFlames.keys()]) advFlameOff(k);
}
function advFlameTick(dt) {/* 节律: 相位累计 → 差异增删(燃烧判定逐炉) → 尺寸正弦脉动;
  异界键不挂 Sprite(D14): 炉照烧(advFurnace.tick 不门禁)但火焰只属于玩家所在界 */
  advFlamePhase += dt * Math.PI * 2 / ADV_FLAME_T;
  for (const [k, f] of advFurnaces) {
    const lit = f.heat > 0 && f.input;
    if (lit && !advFlames.has(k) && advFurnKeyDim(k) === advSceneKey()) {
      advFlames.set(k, advFlameMount(k)); /* 起燃加(本场景键) */
    }
    if (!lit) advFlameOff(k); /* 熄灭删(不在列时 delete 幂等) */
  }
  for (const k of [...advFlames.keys()]) {
    if (!advFurnaces.has(k)) advFlameOff(k); /* 炉没了(挖/TNT 兜底): 火焰必须没了 */
  }
  const sz = ADV_FLAME_SIZE + ADV_FLAME_AMP * Math.sin(advFlamePhase); /* 0.38 ± 0.07 */
  for (const sp of advFlames.values()) if (sp) sp.scale.set(sz, sz, 1);
}
/* F2 余量比(设计稿 §2.2)已随 T4 上收共享熔炉 kit(furnaceFuelR, 体验馆同源) */

/* ---------- TNT 链(D4): 放置走 advTryPlace → 点击点燃 → 引信 → 爆炸 ---------- */
const advFuses = []; /* 已点燃引信 {x,y,z,t,sparkT} */
function advIgnite(x, y, z) {/* 点击点燃(手持任意, onMouse 左键最前拦截); 重复点击不叠加 */
  for (const f of advFuses) {
    if (f.x === x && f.y === y && f.z === z) return;
  }
  advFuses.push({x, y, z, t: ADV_TNT_FUSE, sparkT: 0});
  advSfx('click');
  advSpeak('点燃啦，快退后！');
  advToast('🧨 点燃啦，快退后！');
}
function advFuseTick(dt) {/* 引信倒计时: 顶上火花弧观感 + 到点起爆 */
  for (let i = advFuses.length - 1; i >= 0; i--) {
    const f = advFuses[i];
    f.t -= dt;
    f.sparkT -= dt;
    if (f.sparkT <= 0) {
      f.sparkT = 0.3;
      Fx.arc(f.x + 0.5, f.y + 1.2, f.z + 0.5, {color: 0xffd23f, dur: 0.22}); /* 引信火花 */
    }
    if (f.t <= 0) {
      advFuses.splice(i, 1);
      advExplode(f.x, f.y, f.z);
    }
  }
}
/* 爆炸结算: Fx.boom 观感(旧 TNT 模式口径) + 半径遍历/链式引爆/树苗撤表/
   70% 掷骰掉落(纯段 advExplodeCells 在 adventure-core, read/sink 注入) +
   波及怪物受击(线性衰减, 清单纯函数 advTntWave)。
   不伤玩家——儿童挖矿神器口径(D4 只给火药一个挖矿出口) */
const advExplodeSink = {
  ignite: advIgnite,
  edit: (bx, by, bz) => {/* 触发格先记账(级联移动可能落回此格) → 破坏+级联记账(不进任务, P6) */
    advMarkEdit(bx, by, bz, 0);
    advCascadeApply(editBlock(bx, by, bz, 0), false);
    advDoorBreakApply(bx, by, bz, false); /* TNT 掀门=整扇回收(不进任务, P6 口径) */
  },
  sapling: (bx, by, bz) => advSaplings.delete(blockKey(bx, by, bz)),
  crop: (bx, by, bz) => advWheats.delete(blockKey(bx, by, bz)), /* 掀掉麦苗撤生长计时(D3) */
  drop: (id, n, x, y, z) => Drops.spawn(id, n, x, y, z),
};
function advExplode(x, y, z) {
  Fx.boom(x + 0.5, y + 0.5, z + 0.5, {r1: ADV_TNT_R + 1.5, n: 14});
  /* 源块直接清除不经掷骰(圈内 TNT 链式点燃分支在前, D3); 级联块默认表掉落
     不进任务(P6: TNT 掀掉的不算——级联同理) */
  advMarkEdit(x, y, z, 0);
  advCascadeApply(editBlock(x, y, z, 0), false);
  advDoorBreakApply(x, y, z, false); /* 源块正上方若立着门, 一并整扇回收 */
  advExplodeCells(x, y, z, getBlock, advExplodeSink);
  for (const w of advTntWave(Mobs.list(), x, y, z)) {/* 波及怪物: 线性衰减伤害+击退 */
    if (w.m.__baby) continue; /* 幼崽免伤: TNT 不波及(生态恢复差异 6, 零惩罚) */
    const r2 = Mobs.hit(w.m, w.dmg, w.kdx, w.kdz, 0.8);
    if (r2.freshDead) advOnKill(w.m);
    else advHerdPanic(w.m); /* F4: 受击存活的牧场动物逃窜(怪物 no-op) */
  }
}

/* ============================================================
   大宝箱 (引导链 v2 / ADR 0007) — 全局共享账户 + 点选搬运面板 +
   两轨容量(材料阶梯基础格 + 每个已放置箱子加 9 格, 不设上限)
   (阶梯表与政策纯函数 advChestNext/advChestPut/advChestCapacity/
   advCountChestEdits 在 adventure-core.js)
   ============================================================ */
/* 容量重算(ADR 0007): chests 从五桶世界账本现算(玩家放置的箱子才进账本),
   size=总容量=base+9×chests; 触点=init 归一化 + advMarkEdit 唯一记账缝的
   箱子增删检测——挖/TNT 掀/覆盖全路径自动覆盖, 无漂移无第二账本。
   体验馆与冒险同口径(2026-10-28 真机验证拍板): 展馆陈列箱本身是 edits,
   一并计入容量, 不为体验馆造第二口径 */
function advChestResync() {
  advChest.chests = advCountChestEdits(advSceneEdits);
  advChest.size = advChestCapacity(advChest.base, advChest.chests);
}
function advChestOpenPanel() {/* 走近箱子点击打开: open_chest 记账(步 4 三条件之一) + 回显 */
  ADV.chestOpen = true;
  advTally('open_chest', 1);
  advChestPanel.show();
  advChestPanel.refresh();
  advFreeMouse(); /* 放鼠标点面板(解锁不弹菜单: onMenu 守卫) */
}
function advChestClose() {/* 收面板(✕/Tab/Esc/onClose 共用): 账户无会话态, 直接收 */
  ADV.chestOpen = false;
  advChestPanel.hide();
  advRelock();
}
/* 存入(背包槽整摞搬进账户): advChestPut 只认前 size 格, 放不下的余量留在
   背包原槽——满箱只拒收不惩罚 */
function advChestDeposit(slotIdx) {
  const s = advInv.slots[slotIdx];
  if (!s) return;
  const left = advChestPut(advChest, s);
  if (left >= s.n) {
    advToast('📦 箱子满啦');
    return;
  }
  if (left > 0) s.n = left; else advInv.slots[slotIdx] = null;
  advStore.saveChest();
  advSyncHotbar();
  advSfx('pick');
}
/* 取出(账户槽整摞搬回背包): 政策纯函数 advChestTake 在 adventure-core(与
   advChestPut 镜像成对)——可堆叠 add 并堆/可耗损物连耐久整槽搬(禁走 add
   重铸)/满包整摞留在箱里; 这里只管满包提示与落盘观感 */
function advChestWithdraw(i) {
  const r = advChestTake(advChest, advInv, i);
  if (r === 'full') {
    advToast('🎒 背包满啦');
    return;
  }
  if (r !== 'ok') return; /* 空槽无动作 */
  advStore.saveChest();
  advSyncHotbar();
  advSfx('pick');
}
/* 扩容(面板 ＋ 按钮出口): canAfford 验费 → take 扣料 → 基础档升格重算容量落盘;
   材料不够温和提示(零惩罚; 阶梯取任务链产物, 目标随进度自然到期)。
   阶梯升的是基础格 base(ADR 0007): 提示报总容量——箱子轨的加格照算在内 */
function advChestExpand() {
  const nx = advChestNext(advChest.base);
  if (!nx) return;
  if (!take(advInv, nx.cost)) {
    advToast('材料还不够，先去挖一挖吧！');
    advSpeak('扩容的材料还不够，先去挖一挖，等会儿再来！');
    return;
  }
  advChest.base = nx.size;
  advChestResync();
  advStore.saveChest();
  advSyncHotbar();
  advSfx('level');
  advSpeak('宝箱变大啦！能放更多宝贝咯！');
  advToast('📦 宝箱扩到 ' + advChest.size + ' 格！');
}

/* ============================================================
   T15 任务链 — 计数账本 + 推进引擎 + 任务卡 + 仪式
   (QUESTS 数据表与谓词纯函数在 adventure-core.js)
   ============================================================ */
let advQuestT = 0; /* 谓词检查节流计时(init 复位一个整窗, 首查在进场半秒后) */
const advUnlockedSeen = []; /* 已播报解锁配方(farm-and-recipe D2): init 从 counts 播种, 差集只报新鲜达成 */

function advTally(kind, n) {/* 任务计数: 事件挂点只 += 不做判断(推进归 advQuestTick 节流查);
   counts 只增不减 = 跳步防护(计数依赖事件, 不可逆); 顺路挂脏标记随 5s 存档节流落盘 */
  ADV.quest.counts[kind] = (ADV.quest.counts[kind] || 0) + n;
  advStore.touch();
}

/* 发现型记账(远征章 T8): 玩家脚格进 home 门阵广场 → visit_plaza 首次记账
   (查后写去重, 与 advQuestMine 首钻判定同款——目标型键只记一次) */
function advQuestVisitTick() {
  if (ADV.quest.counts.visit_plaza || advDim !== 'overworld' || advMap !== 'home') return;
  if (advInRect(Math.floor(pos.x), Math.floor(pos.z), ADV_GATE_PLAZA)) advTally('visit_plaza', 1);
}

/* 挖掘挂点(advBreakBlock 尾部): 矿物记账 + 钻石首获仪式(与任务步无关——
   第 12 步之前挖到第一颗同样庆祝, 仪式属于"第一颗"这个时刻) */
function advQuestMine(id, x, y, z) {
  const firstDia = id === B_DIAMOND_ORE && !ADV.quest.counts.mine_diamond_ore;
  const k = ADV_MINE_TALLY[id];
  if (k) advTally(k, 1);
  if (firstDia) advDiamondRite(x, y, z);
}

/* 钻石首获仪式(D11): 钻色+金光双层冲击波 · 钻色碎块 · 金弧 · 专属琶音——
   现成件组合约 1s 收场, 克制不抢戏(不做慢镜: 引擎无 timescale 先例, 不为
   一处观感动主循环) */
function advDiamondRite(x, y, z) {
  advSfx('gem');
  Fx.pop(x + 0.5, y + 1.1, z + 0.5, {color: 0x4ee1d2, r0: 0.3, r1: 2.4, dur: 0.7});
  Fx.pop(x + 0.5, y + 1.1, z + 0.5, {color: 0xffd23f, r0: 0.2, r1: 1.6, dur: 0.9, opacity: 0.7});
  Fx.debrisBurst(x + 0.5, y + 1.2, z + 0.5, 10, {color: 0x4ee1d2, life: 1.3});
  for (let i = 0; i < 3; i++) {
    Fx.arc(x + 0.5, y + 1.4 + i * 0.5, z + 0.5, {color: 0xffd23f, dur: 0.3, spread: 1.2, pts: 5});
  }
  advSpeak('哇！挖到钻石啦！亮晶晶的宝贝！你找得真仔细！');
  advToast('💎 第一颗钻石！一共要挖 3 颗哦！');
}

/* F3 金苹果首获仪式(advDiamondRite 轻量版, 二期设计稿 §3): 金光双层冲击波 +
   gem 琶音 + 专属 TTS/toast——挂 advOnCraft 合成入包侧首获(钻石在挖掘侧,
   口径各归其位); 位置取玩家(合成发生在面板前, 无方块坐标可挂), 现成件
   组合约 1s 收场, 克制不抢戏 */
function advGoldRite() {
  advSfx('gem');
  Fx.pop(pos.x, pos.y + 1.1, pos.z, {color: 0xffd23f, r0: 0.3, r1: 2.4, dur: 0.7});
  Fx.pop(pos.x, pos.y + 1.1, pos.z, {color: 0xfff3b0, r0: 0.2, r1: 1.6, dur: 0.9, opacity: 0.7});
  advSpeak('哇！金灿灿的苹果！挖到的金子变成宝贝啦！');
  advToast('🍎 第一个金苹果！吃一口就能回满血！');
}

/* 通关烟花(D11 终章): 玩家四周四色礼花(pop 冲击波球+碎块), 不震屏不轰鸣 */
function advFireworks() {
  const cols = [0xff5a5a, 0xffd23f, 0x4ee1d2, 0xb78af7];
  for (let i = 0; i < cols.length; i++) {
    const a = (i / cols.length) * Math.PI * 2 + 0.6;
    const fx = pos.x + Math.cos(a) * 2.5;
    const fz = pos.z + Math.sin(a) * 2.5;
    const fy = pos.y + 2 + (i % 2) * 0.8;
    Fx.pop(fx, fy, fz, {color: cols[i], r0: 0.4, r1: 2.2, dur: 0.6});
    Fx.debrisBurst(fx, fy + 0.2, fz, 8, {color: cols[i], life: 1.4});
  }
}

/* 任务推进节流入口(update 每帧): 到窗查**当前步**谓词(不越级——第 n 步只认
   第 n 步; 计数提前灌满也一步一周期逐级走), 完成 → 音效+完成 toast → 表扬
   TTS(与下一步引导并句, 防 cancel 打断) → 新任务图标 toast → 步进+落盘+重画 */
function advQuestTick(dt) {
  advQuestT -= dt;
  if (advQuestT > 0) return;
  advQuestT = ADV_QUEST_CHECK_T;
  const st = ADV.quest;
  /* 配方解锁播报(farm-and-recipe D2): 与任务谓词同拍 0.5s 差集; seen 在 init
     从 counts 播种——老档已解锁的不重播, 只报游玩中新鲜达成的 */
  for (const id of advRecipeUnlockedNew(advUnlockedSeen, st.counts)) {
    advUnlockedSeen.push(id);
    const name = (ITEMS[id] && ITEMS[id].name) || id;
    advSfx('gate_unlock');
    advToast('🎉 新配方解锁：' + name + '！');
    advSpeak(name + '配方解锁啦！打开背包看看吧！');
  }
  const q = ADV_QUESTS[st.step];
  if (!q || !q.check(st.counts)) return;
  advSfx(q.finale ? 'win' : 'level');
  advToast('✅ ' + q.icon + ' ' + q.goal + ' 完成！');
  if (q.finale) {/* 终章: 称号入档(step 走到下一步不再查) + 烟花, 重进不重复授予;
      远征章接棒(T8): 钻石剑后门阵召唤——终章句并句远征首条引导(老玩家无缝知道下一步) */
    st.title = ADV_QUEST_TITLE;
    const nxt = ADV_QUESTS[st.step + 1];
    advSpeak(q.praise + '你获得了「' + ADV_QUEST_TITLE + '」称号！为你放烟花！' +
        (nxt ? ' 接下来：' + nxt.hint : ''));
    advToast('🏅 获得称号：' + ADV_QUEST_TITLE + '！');
    advFireworks();
  } else {
    const nxt = ADV_QUESTS[st.step + 1];
    advSpeak(q.praise + (nxt ? ' 接下来：' + nxt.hint : ''));
    if (nxt) advToast(nxt.icon + ' 新任务：' + nxt.goal);
  }
  st.step += 1;
  if (q.unlock) {/* 解锁链(T8, §2.3): 完成挂 unlock 的任务 → 任务档 counts 置
      T4 键名键(解锁即成就, 语义同源) → 点亮仪式; 键在 save 前置位(落盘含键) */
    ADV.quest.counts[ADV_UNLOCK_KEYS[q.unlock]] = 1;
    advStore.touch();
    advUnlockRite(q.unlock);
  }
  advStore.saveQuest(st);
  advQuestPaint();
}

/* 门点亮仪式(T8, §2.3「看着门亮起来」): 解锁键置位后的观感接线 —
   gate_unlock 四音琶音 + 门位冲击波 + 当前图门面运行时熄→亮(增量补 B_PORTAL
   门面, setBlockRaw 不记账与建场同口径; T7 只在装场读一次键, 会话内切换在此)
   + Fx.portalBeam 常驻光束重锚(增量一束; 切图全量重锚归 advBeamsRelayout)。
   玩家不在门所在图时(远征图完成点亮 home 的门)只播报, 门面等回 home 由
   advGatesBuild 读键路径覆盖——「回家就能看到」 */
function advUnlockRite(mapId) {
  advSfx('gate_unlock');
  const row = ADV_MAPS.find((r) => r.id === mapId);
  const nm = row ? row.name : mapId;
  let g = (advDim === 'overworld') ? advMapRow.gates.find((q) => q.to === mapId) : null;
  if (g && !ADV_B.portal) g = null; /* 精简装载守卫(ADV_B 同款): 无门面方块不补格 */
  if (g) {
    advPortalFrame((x, y, z, id) => {
      if (id === ADV_B.portal) {
        setBlockRaw(x, y, z, id); /* 只补门面(框熄门时已立) */
        advMeshTouch(x, z); /* 门面格同拍入脏队列: 当帧重网格立刻可见(不标脏=黑框) */
      }
    }, ADV_GROUND, g.px, g.pz, g.look); /* 主题建材与建场同款(g.look, 点亮只换门面) */
    advMeshFlush();
    advBeamAdd(ADV_GROUND, g.px, g.pz); /* 常驻光束: 亮门才有束(熄门无门面口径) */
    Fx.pop(g.px + ADV_PORTAL.w / 2, ADV_GROUND + 2, g.pz + 0.5,
        {color: 0xb676f2, r0: 0.3, r1: 2.6, dur: 0.8}); /* 紫色门面同款色系冲击波 */
  }
  advSpeak(nm + '之门亮起来啦！' + (g ? '' : '回到家里就能看到！'));
  advToast('✨ ' + nm + '之门亮起来啦！');
}

/* 任务卡(背包面板 aside, 打开背包即见): 当前步大图标+进度条, 已完成步划线史,
   称号置顶; 未来步不剧透(一步步揭示) */
function advQuestPaint() {
  const st = ADV.quest;
  const q = ADV_QUESTS[st.step];
  let html = '<div class="advq-head">📖 探险任务</div>';
  if (st.title) html += '<div class="advq-badge">🏅 ' + st.title + '</div>';
  if (q) {
    const p = Math.min(q.prog(st.counts), q.target);
    html += '<div class="advq-cur"><span class="advq-ic">' + q.icon + '</span>' +
        '<div><div class="advq-goal">' + q.goal + '</div>' +
        '<div class="advq-pg">' + p + ' / ' + q.target + '</div>' +
        '<div class="advq-bar"><i style="width:' + Math.round(p / q.target * 100) + '%"></i></div></div></div>';
  } else {
    html += '<div class="advq-done">🎉 全部完成！<br>自由探险咯！</div>';
  }
  if (st.step > 0) {
    html += '<div class="advq-hist">' + ADV_QUESTS.slice(0, st.step).map((h) =>
      '<div class="advq-row"><s>' + h.icon + ' ' + h.goal + '</s></div>').join('') + '</div>';
  }
  advPanel.questEl.innerHTML = html;
  return advPanel.questEl; /* 重画并返回任务卡(只读查询面) */
}

/* ---------- 石阵夜晚彩蛋(2026-10-27 用户拍板): 判据/节流常量在 adventure-core,
   观感(Fx/SpeechKit/Drops)在此。点击中心灯坛: 夜里 = 四色烟花 + 远古牧人小
   故事 + 首次赠灯笼(Drops 真空拾取, 全会话一次防连点刷); 白天 = 温和提示
   「等天黑再来」(零惩罚不强迫)。距离口径与站点同半径(太远只提示) ---------- */
let advStoneEggT = 0; /* 点击节流秒(update 递减, advGateLockT 同款) */
let advStoneGifted = false; /* 灯笼已赠旗(全会话一次, 不入档——重开页面可再得, 零惩罚) */

function advStoneEggActivate(hit) {/* 灯坛点击(轻点/右键共用入口 advUseStation 转接) */
  if (Math.hypot(hit.x + 0.5 - pos.x, hit.z + 0.5 - pos.z) > ADV_STATION_R) {
    advToast('🏮 走近一点再点灯坛啦');
    return;
  }
  const act = advStoneEggPick(advStoneEggT, Daylight.isNight(dayTime));
  if (!act) return; /* 节流窗内: 静默吞掉点击(防音效/话术连刷) */
  advStoneEggT = act === 'egg' ? ADV_STONE_EGG_CD : ADV_STONE_HINT_CD;
  if (act === 'hint') {/* 白天: 灯坛「不算数」, 温和指引夜里再来 */
    advSpeak('天还亮着呢，等天黑再来点亮灯坛吧！');
    advToast('🌙 天黑再来，石阵藏着故事');
    return;
  }
  advSfx('gem');
  advStoneFireworksAt(hit.x + 0.5, hit.y + 1.2, hit.z + 0.5);
  if (!advStoneGifted) {/* 首次: 灯笼落在灯坛旁(走既有收集链真空入包) */
    advStoneGifted = true;
    Drops.spawn(ADV_STONE_EGG_GIFT, 1, hit.x + 1.2, hit.y + 1.2, hit.z + 0.5);
    advToast('🏮 灯坛送你一只灯笼！');
  }
  advSpeak('远古牧人赶羊回家的夜里，会点亮这座石阵——走散的羊看见灯光，就自己找到回家的路啦！');
}

function advStoneFireworksAt(fx, fy, fz) {/* 灯坛四色礼花(advFireworks 同语言换锚点:
   以灯坛为心小半径, 不震屏不轰鸣) */
  const cols = [0xff5a5a, 0xffd23f, 0x4ee1d2, 0xb78af7];
  for (let i = 0; i < cols.length; i++) {
    const a = (i / cols.length) * Math.PI * 2 + 0.6;
    const px = fx + Math.cos(a) * 1.8; const pz = fz + Math.sin(a) * 1.8;
    const py = fy + (i % 2) * 0.6;
    Fx.pop(px, py, pz, {color: cols[i], r0: 0.4, r1: 2.0, dur: 0.6});
    Fx.debrisBurst(px, py + 0.2, pz, 6, {color: cols[i], life: 1.2});
  }
}

/* 使用型站点交互(熔炉/箱子, 挖掘左键与轻点/右键共用): 走近 4 格开面板,
   太远只提示不误触; 消耗了本次点击返回 true。
   箱子不是站点(不在 advStations 缓存), 对点击块直算水平距离(与站点同半径口径)。 */
function advUseStation(hit, lookId) {
  if (!hit) return false;
  if (advStoneAltarHit(hit.x, hit.y, hit.z, lookId)) {/* 石阵灯坛(判据在 core):
      轻点/右键都转接彩蛋链(白天提示/夜晚烟花+故事+赠礼), 消耗本次点击 */
    advStoneEggActivate(hit);
    return true;
  }
  if (lookId === B_FURNACE) {
    /* F1: 对点击的这台炉直算距离(箱子同款)并绑定它——多炉各有各的内容 */
    if (hit && Math.hypot(hit.x + 0.5 - pos.x, hit.z + 0.5 - pos.z) <= ADV_STATION_R) {
      advFurnace.open(advFurnKey(hit.x, hit.y, hit.z)); /* 界键(D14): 下界炉与上界同坐标炉互不串档 */
    } else {
      advToast('♨️ 走近一点就能用熔炉啦');
    }
    return true;
  }
  if (lookId === B_CHEST) {
    if (Math.hypot(hit.x + 0.5 - pos.x, hit.z + 0.5 - pos.z) <= ADV_STATION_R) {
      const ck = advMapChestKey(advMap, hit.x, hit.y, hit.z); /* 结构宝箱键(T8 探宝型): 图+坐标双判定 */
      if (ck) advTally(ck, 1); /* 他图/自放箱返 null 只走 open_chest, 防冒名 */
      advChestOpenPanel();
    } else {
      advToast('📦 走近一点就能打开箱子啦');
    }
    return true;
  }
  return false;
}

/* HUD 行构造(具名提出: mkMode 把 cfg.hud 收进帧循环不外露, 挂点经此触达——
   查询 seam 口径, 下界态分支见内注释) */
function advHudLines(hit) {
  const s = advInv.slots[advHb.sel];
  const q = ADV_QUESTS[ADV.quest.step];
  const qTxt = q ? q.icon + ' ' + q.goal + ' ' + Math.min(q.prog(ADV.quest.counts), q.target) + '/' + q.target :
      (ADV.quest.title ? '🏅 ' + ADV.quest.title : '全部完成 🎉');
  const alive = Mobs.list().filter((m) => !m.dead && !m.gone && !m.cfg.passive).length; /* F4: 牧场动物不算怪物 */
  if (advDim === 'nether') {/* 下界态(§3.3/D10): 首行换下界横幅; 不显白日/夜历(恒夜,
      dayTime 已暂停, 时段行无信息); 怪物行也隐——下界无怪, 恒 0 徒增困惑 */
    return [
      '🌌 下界 · 黑漆漆亮晶晶',
      `❤️ 生命: ${Math.max(0, Math.ceil(advGetPEnt().hp))} / ${ADV.player.maxHp}`,
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      `🎒 背包: Tab / 🎒 · 手上: ${s ? ((ITEMS[s.id] && ITEMS[s.id].name) || s.id) : '空手'}`,
      `📖 任务: ${qTxt}`,
      `注视: ${ModeKit.lookName(hit)} · B 菜单`,
    ];
  }
  return [
    advMapRow.hud, /* 图名行随地图行(T6): 一眼知道自己在哪张图 */
    `❤️ 生命: ${Math.max(0, Math.ceil(advGetPEnt().hp))} / ${ADV.player.maxHp}`,
    `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
    Daylight.isNight(dayTime) ? btnImg('moon') + ' 夜晚' : btnImg('sun') + ' 白天', /* 时段两态(昼夜 D1 §2.4): 太阳/月亮像素图, 不加时分 */
    `👾 怪物: ${alive} · ☠️ 击杀: ${ADV.killCount}`,
    `🎒 背包: Tab / 🎒 · 手上: ${s ? ((ITEMS[s.id] && ITEMS[s.id].name) || s.id) : '空手'}`,
    `📖 任务: ${qTxt}`,
    `注视: ${ModeKit.lookName(hit)} · B 菜单`,
  ];
}

/* ============================================================
   模式对象
   ============================================================ */
const AdventureMode = mkMode({
  id: 'adventure',

  hotbar: advHb, /* 快捷栏 9 item 型槽(镜像背包, 数字键/滚轮/点选全自动) */
  chrome: {score: 'none', hotbar: 'flex'},

  init() {
    const advLoad = advStore.load(); /* 读档+decode(桶归一化/老档两代迁移在 advSceneEditsDecode) */
    /* 地图/维度相位装桶(D8/D9 泛化, T6): 维度不进档——重进恒主世界(下界退出时
       pos 存 null); map 键恢复最后主世界图(老档缺省 home), 桶从档收养
       (Map 原样/数组转 Map/旧档缺省空——decode 已归一, 此处整只换装) */
    advDim = 'overworld';
    advPortalCd = 0;
    advExitSpot = null;
    advMood = null; /* 首帧 update 按当下昼夜补报场景曲(main 随后会先报基线 adventure) */
    advGateHold.t = 0; /* 门阵站桩归零(T7): 转场不跨场次 */
    advVeilReset(); /* 渐晕遮罩收起归零(T7) */
    advGateLockT = 0; /* 锁门提示节流复位 */
    advMap = advLoad.map;
    advApplyMapRow(ADV_MAPS.find((r) => r.id === advMap) || ADV_HOME_ROW);
    const advBuckets = advSceneEditsDecode(advLoad); /* 幂等再归一(decode 坏档兜底路径
        会漏跑 slot decode, 此处对 defaults/数组/桶对象三种输入都成立) */
    for (const k of ADV_SCENE_KEYS) advSceneEdits[k] = advBuckets[k];
    advStore.journal.edits = advSceneEdits[advSceneKey()]; /* 当前桶换装 */
    /* 昼夜时刻随世界档恢复(昼夜 D1, mc-daylight-torch §2.2/§2.5): decode 已兜底
       清晨 0; 探险是唯一置位 dayCycleOn 的模式, 天色/雾/光强/日月轨道由
       world.applyDaylight 每帧驱动(进场先刷一次, 夜晚重进当帧即夜) */
    dayTime = advLoad.dayTime;
    dayCycleOn = true;
    advApplyMapPalette(advMapRow); /* 行调色板先于建场(水色烘进网格); 天色随下句 applyDaylight */
    applyDaylight();
    advNightReset(); /* 夜怪账本复位并对齐当下(昼夜 D5; 切图/回界共用) */
    /* 位置与血量随世界档保留(2026-10 拍板): 老档/坏档无 pos/hp → 图缺省出生/满血
       (home=小屋 ADV_SPAWN 口径, 远征图=回程门 advMapArrive); hp 钳 1~maxHp;
       存的 pos 是退出时站的合法空腔(世界经 edits 重放同坐标系), 不必二次校验 */
    const svPos = advLoad.pos;
    const advSpawnAt = (svPos && typeof svPos.x === 'number' && typeof svPos.y === 'number' &&
        typeof svPos.z === 'number') ?
      {x: svPos.x, y: svPos.y, z: svPos.z, yaw: (typeof svPos.yaw === 'number') ? svPos.yaw : ADV_SPAWN.yaw} :
      advMapSpawn(null);
    const advHpIn = (typeof advLoad.hp === 'number' && advLoad.hp >= 1) ?
      Math.min(advLoad.hp | 0, ADV.player.maxHp) : ADV.player.maxHp;
    ADV.quest = advStore.loadQuest();
    /* T15 归一化: 老档 {step:N} 无 counts(或损坏) → 补空表, 当前步从零累计——
       历史计数不追溯(玩家挖过什么无法从世界状态重建); step 钳进表界(表外=终章完成) */
    if (!ADV.quest.counts || typeof ADV.quest.counts !== 'object') ADV.quest.counts = {};
    ADV.quest.step = Math.max(0, Math.min(ADV.quest.step | 0, ADV_QUESTS.length));
    /* 大宝箱账户(引导链 v2 / ADR 0007): 存档 size 字段=阶梯基础格 base(老档
       零迁移——老档无箱子数概念, base=老 size 恰好兼容); chests 从五桶世界
       账本现算, size=总容量=base+9×chests; 槽位数组补齐到容量但永不截断——
       容量缩水(挖箱)后超容存量不清理不丢失, 容量回来自然可见(零损失口径) */
    advChest = advStore.loadChest();
    if (!Array.isArray(advChest.slots)) advChest.slots = [];
    advChest.base = Math.max(ADV_CHEST_START, Math.min(advChest.size | 0, ADV_CHEST_SLOTS));
    advChestResync();
    for (let i = 0; i < advChest.size; i++) if (!advChest.slots[i]) advChest.slots[i] = null;
    if (advChest.slots.length < advChest.size) advChest.slots.length = advChest.size;
    advQuestT = ADV_QUEST_CHECK_T; /* 谓词检查节流复位(进场半秒后首查) */
    advUnlockedSeen.length = 0;
    for (const id of advUnlockedRecipes(ADV.quest.counts)) advUnlockedSeen.push(id); /* 解锁集合播种(读档后, 老档不重播报, D2) */
    advQuestPaint();
    advStore.loadBag(); /* 全局背包经背包壳读档(原地换槽, 面板/快捷栏闭包不脱钩) */
    /* 流体账本缝(liquid D8): 流体写格(流动/消退/混合/冲毁)即时入 edits 账本——
       逐格最后写赢, 重进精确恢复水位; 流体格带 {id,lv}, 其余保持数字(旧档零迁移) */
    setFluidEditSink((x, y, z, id, lv) => {
      advStore.mark(x + ',' + y + ',' + z, fluidCell(id, lv, BLOCKS));
      /* 流体写格入节流窗: 漏置位 → 只动水时永不触发 5s 落盘, 关页即丢水位(mark 自带置脏) */
    });
    advBubbles = mkBubbleBar(); /* 溺气泡条(liquid D10): 剩 3 泡 TTS 提醒, 气满藏条 */
    advOreRegen = advOreRegenDecode(advLoad.oreRegen); /* 矿位开采账换装(生态恢复; 归一兜底——
       dev store/旧档缺键 → 空账; 先于 loadScene, 回填在其内结算) */
    loadScene(() => {/* 场景装填 seam: 清场→建场(当前地图行 build, T6)→收尾入队一步到位 */
      advBuildScene(advMapRow);
      advStore.journal.replay({block: setBlockRaw, fluid: setFluidLv}); /* 双通道重放(liquid D8): 流体格→方块+水位, 裸值→方块 */
      /* P14 世界卫生清扫(设计稿 D9): 级联合并前的旧档浮空(孤儿冠/悬浮树/浮沙/
         悬空依附块)在重进时一次性治愈——静默结算(装场期迁移不是游戏事件:
         无掉落无话术无任务, 防刷档), 逐块记 edits 幂等(D5 红线: 治愈落盘后
         重进无违例, 清扫成空操作)。建造模式不清扫(故意搭的浮空装饰保护)。 */
      for (const r of applySweep()) {
        if (r.to) {/* 移动两格记账(与 advCascadeApply 同口径, D7) */
          advMarkEdit(r.x, r.y, r.z, 0);
          advMarkEdit(r.to.x, r.to.y, r.to.z, r.id);
        } else {
          advMarkEdit(r.x, r.y, r.z, 0);
        }
      }
      advRescanSaplings(); /* 世界里的树苗重挂 20s 计时(计时 Map 不落盘; 清扫之后跑——被治愈掀掉的悬空树苗不再重挂) */
      advRescanWheats(); /* 未熟麦重挂生长计时(farm-and-recipe D3, 计时 Map 不落盘) */
      advRescanTreeRegen(); /* 凋零树位重挂恢复计时(仅 home 图; 清扫之后跑) */
      advOreRegenTick(); /* 到期矿位回填(跨天口径; 只结本场景的账, 重放后结算) */
      advGatesBuild(); /* 门阵建场(T7): 治愈之后立门——门体不被清扫/重放翻动, 每次装场同一份 */
      advRescanStations(); /* 已放置站点收进缓存(T13: edits 重放收集, O(edits)) */
    });
    ModeKit.spawn(advSpawnAt.x, advSpawnAt.y, advSpawnAt.z, {yaw: advSpawnAt.yaw}); /* 有档用档: 上次退出的位置+朝向 */
    setFly(false); /* 探险步行(不沿用建造的飞行; 走意图入口) */
    advSyncHeldVisual(); /* 进场观感对齐选中槽(空档 = 空手) */
    ADV.panelOpen = false;
    ADV.chestOpen = false; /* 引导链 v2: 箱子面板一并复位 */
    advFurnace.reset(); /* T4: 炉态/绑定/开态/签名复位(kit Map 引用不变, 开态真值在 kit 不设镜像); 档里有什么恢复什么(F1) */
    advFlamesClear(); /* F2: 炉口火焰一并复位(上一场的观感不渗进来) */
    for (const [k, s] of advLoad.furnaces) advFurnaces.set(k, s); /* F1: 每炉独立炉态重进照旧(decode 已过滤非法) */
    advFurnaceSettle(advMap); /* D14: 当前图炉键对重放后的世界核销(块没了炉态丢); 他图/界键进那张图建场后再核 */
    advFuses.length = 0;
    advTableNear = false;
    advMineStop(); /* 蓄力状态复位(上次退出可能按住) */
    advTntTap = null; /* TNT 短按判定复位(上次退出可能按在 TNT 上) */
    advMouseListeners(true); /* 桌面按住连挖检测(capture) */
    advTouchUseOn = false; /* 触屏条回到基表态(mkMode init 已声明 advTouchBase);
      持弓进场时随后的 advSyncHotbar → advTouchMainSync 边沿重声明补射箭键 */
    advSyncHotbar();
    advWarnLow.clear(); /* S4① 预警账本复位: 新一命重新预警 */
    advBagArmed = true; /* S4② 快满提醒复位(进场满包会在首查时提醒一次) */
    advBagT = ADV_BAG_CHECK_T; /* 首查在进场半秒后(欢迎语音先落地不被顶掉) */
    /* —— 巢穴战斗段(T14): 清残留 → 重挂引擎回调(clear 会解除, 每次进场重挂) → 三巢首刷 */
    Mobs.clear();
    advReclaimThrown(); /* 重进/换图回收丢弃件(零损失红线, 同 advSceneLeave 口径) */
    Drops.clear(); /* 重进清残留掉落物(挖掘/击杀两链共用; 并解除旧收集回调) */
    advArrows.clear(); /* 上一场的箭不渗进来 */
    advSnowballs.clear(); /* 上一场的雪球不渗进来(T9) */
    advBolts.clear(); /* 上一场的玩家弓箭不渗进来(弓物品化) */
    ADV.killCount = 0;
    advMelee.reset(); advHurt.reset(); /* 冷却/受击节流不复场 */
    advPickBuf.clear(); advPickT = 0;
    advNestT.fill(0);
    advLanternT = 0; /* 灯笼耗秒累计器归零(昼夜 D7: 重进从整秒重新累计) */
    const pe = advGetPEnt(); /* 进场血量随世界档(重进保留残血); 老档/坏档 → 满血 */
    pe.hp = advHpIn; ADV.player.hp = advHpIn;
    advHookEntityCbs(); /* 击杀掉落/收集并线两回调(Mobs/Drops.clear 解除后重挂, 切界共用同一份) */
    /* F4 牧场(设计稿 §4.4): 死畜账先换装再播种——确定性清单按死畜账跳过已杀索引
        生成, 不重生(MC 口径动物也不刷, 牧场会空是「保护动物」的隐性教育);
        游荡位置不存档(重进回散布原位); 实体挂 __livestockIdx 是记账唯一依据 */
    advLivestockAll = advLivestockDecode(advLoad.livestock); /* 牧场账换装(档形 v2 归一——dev store
        字面量/二代老档数组均收敛 {dead,bred}; 世界档 decode 同一函数, 双路径同口径) */
    advSeedMapMobs(); /* 当前行巢穴首刷 + 牧场清单/女巫常驻(切图/回界的怪物重播共用同一份, T6) */
    const qNow = ADV_QUESTS[ADV.quest.step]; /* 进场欢迎句带上当前步引导(hint 并句, 防 cancel 打断;
        「小小探险家」字样留给终章称号的仪式感) */
    advSpeak('欢迎来到探险草原！' + (qNow ? qNow.hint : '任务全部完成啦，自由探险咯！'));
    advToast('🌲 探险草原 · 按 Tab 或点 🎒 打开背包');
  },

  onPageHide() {/* 关页兜底存档(main.js pagehide 收口, 2026-10 树苗丢档修复):
      世界档 5s 节流窗口内直接关页/刷新 → 窗口内的世界改动(种下的树苗/挖掘/
      放置/水位)全丢, 而任务档步进是即时落盘 → 重进出现「任务说树苗种过了、
      世界里却没有」的错位。这里同步落盘(localStorage 同步写, pagehide 内
      安全); 服务器 push 由 main.js 统一补发 */
    advStore.pageHide();
  },

  cleanup() {
    /* F1 拍板①: 退世界不清炉不退料——炉态随下方落盘, 重进原样接着烧 */
    advStore.flush();
    /* 昼夜复位(昼夜 D1, 设计稿 §2.2): 关循环 + 白天观感复位(幂等)——其余模式
       与下界换天(applySky)都不再被每帧昼夜驱动打扰 */
    dayCycleOn = false;
    applyDaylight();
    /* 下界相位·地图态复位(D9/D10/T6): 维度/冷却/回程点归零, 图账本回 home,
       天空雾距复位(applyDaylight 只管天色, fog near/far 是 advApplySky 的私产),
       行调色板复位(天基色/水色不渗其他模式), 光束句柄摘除, journal 桶换回 home */
    advDim = 'overworld';
    advPortalCd = 0;
    advExitSpot = null;
    advMood = null; /* 下一场/下一模式重新同步(不把本场缓存带出去) */
    advGateHold.t = 0; /* 门阵站桩归零(T7) */
    advVeilReset(); /* 渐晕遮罩收起(T7): 中途退出模式不留紫屏 */
    advGateLockT = 0; /* 锁门提示节流复位 */
    advMapRowCleanup(); /* 行调色板复位内含 advApplySky(ADV_SKY_OVER), 不另重复调用 */
    advBeamsClear(); /* 红天光束不渗进其他模式 */
    advStore.journal.edits = advSceneEdits.home;
    setPlayerGlow(false); /* 灯笼随身光一并熄灭(昼夜 D7): PointLight 不渗入其他模式 */
    advLanternT = 0; /* 耗秒累计器复位(重进从整秒重新累计) */
    setFluidEditSink(null); /* 流体账本缝解除(liquid D8: 不渗进其他模式) */
    if (advBubbles) {
      advBubbles.dispose(); advBubbles = null; /* 溺气泡条收 DOM(liquid D10) */
    }
    Mobs.clear(); /* 清怪+解除击杀回调: 不渗进其他模式 */
    advReclaimThrown(); /* 退出模式前收回丢弃件(零损失红线): 未捡回的原样回家 */
    Drops.clear(); /* 清掉落物+解除收集回调 */
    advArrows.clear(); /* 箭矢网格一并摘除 */
    advSnowballs.clear(); /* 雪球网格一并摘除(T9) */
    advBolts.clear(); /* 玩家弓箭网格一并摘除(弓物品化) */
    advFlamesClear(); /* F2: 炉口火焰 Sprite 一并摘除(炉态随档保留, 观感重建) */
    ADV.panelOpen = false;
    ADV.chestOpen = false;
    advPanel.remove(); /* 卸载面板 DOM */
    advFurnace.panel.remove(); /* T13: 熔炉面板一并卸载 */
    advChestPanel.remove(); /* 引导链 v2: 箱子面板一并卸载 */
    advStore.saveChest(); /* 账户兜底落盘(存取/扩容已即做即存, 双保险口径) */
    Avatar.setItem(PLAYER.heldItem); /* 手持物复位(Avatar 跨模式存活) */
    advMouseListeners(false);
    advMineStop(); /* 蓄力清零 + 进度环收起 */
    advSleep.on = false; /* 睡觉转场中断复位(昼夜 D6): 未到唤醒沿不跳时刻 */
    advSleep.t = 0;
    advSleepClock.on = false; /* 拨盘开着退出模式: 状态复位(panelOpen 已归零) */
    if (advClockDom) { // 拨盘 DOM 随模式卸载, 重进惰性重建
      if (advClockDom.root.parentNode) advClockDom.root.parentNode.removeChild(advClockDom.root);
      advClockDom = null;
    }
    advSleepFadeReset(); /* 遮罩归零还 CSS transition, 不渗入其他模式 */
    advTntTap = null; /* TNT 短按判定一并复位 */
    advSaplings.clear(); /* 计时不落盘, 重进经全图扫描重建 */
    advTreeRegen.clear(); /* 恢复计时同不落盘, 重进经 advRescanTreeRegen 重建 */
    advFuses.length = 0; /* 引信不落盘 */
    advStations.clear(); /* 站点缓存重进由 advRescanStations 重建 */
    advTableNear = false;
    advPlaceKit.resetTimers(); /* 话术节流复位(账本在 place-kit 实例) */
    advRingDispose();
    advHpBar.dispose(); /* 头顶血条回收(S2 深接口) */
  },

  update(dt) {
    advStore.tick(); /* 世界存档节流 5s(build 同款, 时序收编 journal) */
    advSyncMood(); /* 场景曲随昼夜/维度走(同值空转; 首帧补报夜间重进) */
    advPlaceKit.tickTimers(dt); /* tier/硬块话术节流递减(账本在 place-kit 实例, T12/微默认3) */
    advStationTick(); /* 站点沿检测: 首次靠近工作台 TTS 引导 + 开面板亮灰刷新(T13) */
    advQuestTick(dt); /* 任务链推进: 节流查当前步谓词, 完成走表扬/引导/落盘(T15) */
    advQuestVisitTick(); /* 发现型记账(T8): 脚格进门阵广场首记 visit_plaza(每帧查, 内部去重) */
    advBagTick(dt); /* 背包快满提醒(S4②): 0.5s 节流查占用槽 */
    advSmeltTtsT = Math.max(0, advSmeltTtsT - dt); /* 完成播报节流递减(T13) */
    advFurnace.tick(dt); /* 烧炼节律常开(面板只是回显, 烧成经 kit onMade 回调), ✕ 关闭对账(T13);
      下界照烧不门禁(MC 口径, 炉态键已分界 D14) */
    advFlameTick(dt); /* F2 炉口火焰: 差异增删 + 脉动(原烧炼节律尾钩, T4 起独立挂 update) */
    advFuseTick(dt); /* TNT 引信倒计时到点起爆(T13, 先于怪物 AI——当帧爆炸位置不漂移) */
    advTntTapTick(dt); /* TNT 短按/按住判定(D3): 转蓄力需先于 advMineTick 同帧生效 */
    advSleepTick(dt); /* 床·睡觉转场推进(昼夜 D6): 遮罩直驱+唤醒沿跳拨盘时刻/设床边出生点 */
    advVeilTick(dt); /* 门阵渐晕转场推进(T7): 淡入→满格切图→淡出(先于传送触发: 发令帧从零起淡) */
    advGateLockTick(dt); /* 锁门提示(T7): 走近熄门给「完成任务就会亮」话术(节流) */
    advStoneEggT = Math.max(0, advStoneEggT - dt); /* 石阵灯坛点击节流递减(彩蛋段) */
    advPortalTick(dt); /* 传送触发(§3.3/T7): 冷却递减 + 门面判定 → 地图门站桩/nether 切界分流 */
    advTempleTrapTick(); /* 神殿可疑地板踩塌(审查修复 P1): 站上 2×2 砂岩地板即塌入宝箱室 */
    advMineTick(dt); /* 挖掘蓄力: 进度环+挥动循环+到点破坏(T12) */
    advMelee.tick(dt); /* 挥击冷却递减(kit 自持, T14 口径不变) */
    advHurt.tick(dt); /* 受击语音节流递减(T14) */
    /* 流体环境伤害(liquid D9): 引擎计息到点的事件在此结算 HP(探险有 HP 账本);
       下界不门禁——岩浆是下界唯一危险(D2) */
    if (worldEvents.drownTick) {
      worldEvents.drownTick = false;
      advEnvHurt(FLUID.drownDps, '呛水啦，快抬头换气！');
    }
    if (worldEvents.lavaTick) {
      worldEvents.lavaTick = false;
      advEnvHurt(FLUID.lavaDps, '好烫！快离开岩浆！');
    }
    if (advBubbles) advBubbles.update(playerAirS / FLUID.airMaxS); /* 溺气泡条(liquid D10) */
    if (advDim === 'overworld') {/* 维度门禁(§3.3 泛化, T6): 人在下界时停掉主世界专属
        子系统——树苗计时若在下界跑, 树会长在「当前世界」且足迹记账进下界桶(串档事故);
        巢穴节律/夜怪刷怪/牧场 AI 是主世界怪的系统(下界无怪, 池随当前地图行);
        灯笼耗秒是主世界夜晚机制(D10 下界恒夜由天穹呈现, 不亮不耗)。切图不门禁
        (各图都有树苗/巢穴/夜晚, 计时账随 advSceneLeave 清空防跨图坐标串档)。
        任务/背包提醒两图/界照旧 */
      advSapTick(dt); /* 树苗 20s 计时到期长树(T12; 占位预检拒绝式) */
      advWheatTick(dt); /* 麦 20s/阶段生长推进(farm-and-recipe D3) */
      if (advFarmHintT > 0) advFarmHintT -= dt; /* 农田引导话术节流递减 */
      advTreeRegenTick(dt); /* 凋零树位恢复计时到期长回(生态恢复 A 通道) */
      advMobAI(dt); /* 巢穴怪物: 索敌/攻击/收队(nether 同骨架; passive 动物在此排除) */
      advHerdTick(dt); /* F4 牧场动物: 恐惧游荡/闲逛(与战斗 AI 互斥的两条驱动) */
      advBreedTick(dt); /* 自动繁育: 同种成年邻近配对产崽(生态恢复 B 通道, 拍板①) */
      advNestTick(dt); /* 巢穴节律: 全清 60s 再刷(每巢独立计时) */
      advNightTick(dt); /* 夜怪节拍 + 入夜/黎明跨沿(昼夜 D5: 环带刷怪/配额/温和清场/播报) */
      advLanternTick(dt); /* 灯笼政策(昼夜 D7): 天黑手持才亮才耗, 持满 1 秒扣耐久 */
    }
    Mobs.update(dt);
    Mobs.render();
    advArrows.update(dt); /* 骷髅箭矢弹道 */
    advSnowballs.update(dt); /* 雪球弹道(T9 双实例并喂) */
    advBolts.update(dt); /* 玩家弓箭弹道(弓物品化, 三实例并喂) */
    Drops.update(dt, {x: pos.x, y: pos.y + PLAYER.height * 0.62, z: pos.z}); /* 真空拾取(挖掘/击杀两链共用, 玩家胸口点) */
    Drops.render();
    advPickupTick(dt); /* 收集播报合并窗 */
    advHpBar.update(advGetPEnt().hp, ADV.player.maxHp, pos.x, pos.y + 2.2, pos.z); /* 头顶血条 */
  },

  onMouse(button, hit) {/* 左键并线(T12×T13×T14): TNT 短按点燃/按住挖走(D3)/熔炉走近点击开面板(T13, 准星块
    精确命中故在最前)/箱子走近点击开面板(引导链 v2, 站点缓存外故按点击块直算距离), 准星锥内有
    活怪→挥击(T14, 持弓=空手伤害 3 点——2026-10-28 Route A 拍板回归 MC 正典,
    射箭只在右键/触屏专用键), 否则吃/挖掘蓄力(T12); 右键放置; 床=点击开时钟拨盘
    (昼夜 D6 时钟改版, 判据与拨盘在 advTrySleep) */
    if (ADV.panelOpen || advFurnace.isOpen() || ADV.chestOpen || advSleep.on) return; /* 面板/睡觉黑屏遮罩兜底: 不挖不放不打 */
    if (button === 0) {
      const lookId = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
      if (lookId === B_TNT) {/* TNT(D3): 短按=点燃(松手<0.25s 在 advTntTapTick 判定),
        按住=蓄力挖走回收 — mousedown 只记账不点燃, 与现状点击点燃逐点一致 */
        advTntTap = {x: hit.x, y: hit.y, z: hit.z, held: 0};
        return;
      }
      if (advUseStation(hit, lookId)) return; /* 熔炉/箱子: 走近开面板(见下) */
      if (advTrySleep(hit, lookId)) return; /* 床: 点击睡觉(昼夜 D6, 使用先于打/挖) */
      if (advTryDoor(hit, lookId)) return; /* 门: 点击开关(设计稿 §4.2, 使用先于打/挖) */
      if (advMelee.aim(advGetPEnt())) {/* 锥内有活怪: 本击归战斗(冷却中也占住, 不落挖;
        持弓=空手 3 点——2026-10-28 Route A 回归 MC 正典, 射箭走右键/触屏专用键) */
        advMelee.swing(advGetPEnt());
        return;
      }
      if (advTryEat()) return; /* 手持食物: 点击吃, 不进蓄力 */
      if (hit) advMine.down = true; /* 准星指住方块: 蓄力开始(推进在 update) */
    } else if (button === 2) {
      /* 轻点/右键 = 使用优先(MC 正典: 交互先于放置): 熔炉/箱子走近开面板 →
         手持食物吃 → 手持雪球掷出(T9) → 使用动作物品放箭(弓, 注册表驱动) → 放置。TNT 点燃不走轻点(用户拍板 2026-10-24 防误触):
         ⛏️ 键短按点燃/按住挖走(onMouse(0) 的 advTntTap 二分) */
      const lookId = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
      if (advUseStation(hit, lookId)) return;
      if (advTrySleep(hit, lookId)) return; /* 床: 点击睡觉(昼夜 D6 §7.2, 使用先于吃/放) */
      if (advTryDoor(hit, lookId)) return; /* 门: 点击开关(设计稿 §4.2, 使用先于吃/放) */
      if (advTryEat()) return;
      if (advTryThrowSnowball()) return; /* 手持雪球: 掷出(T9, 使用档在吃与放置之间) */
      if (advTryUseHeld()) return; /* 手持使用动作物品(弓/种子/骨粉): 注册表驱动使用(farm-and-recipe D3
        +弓 Route A), 恒算使用 attempt 不落放置——MC 正典弓走使用键 */
      if (advTryHoe()) return; /* 空手锄地(D7 两步正典): 指可垦块才命中, 否则回落放置(空手 noop) */
      advTryPlace(hit);
    }
  },

  onKey(code) {
    if (code === 'Tab') {
      if (advSleepClock.on) {/* 拨盘开着先收拨盘(body 级遮罩不叠层) */
        advSleepClockClose();
        return;
      }
      if (ADV.chestOpen) {/* 箱子开着先收箱子(body 级遮罩不叠层) */
        advChestClose();
        return;
      }
      if (advFurnace.isOpen()) {/* 熔炉开着先收熔炉(两块 body 级遮罩不叠层) */
        advFurnace.close();
        return;
      }
      advPanelToggle(); /* 🎒/Tab 开关背包+配方书 */
    }
    if (code === 'KeyH') advGoHome(); /* 🏠 回小屋(受困逃生口, 桌面键) */
  },

  onVoidFall() {/* 坠出世界: 与死亡同一零惩罚出口(T14 的致命一击走 advPlayerDied) */
    advPlayerDied();
  },

  onMenu() {/* 解锁回调(Esc/✕开面板期的 exitPointerLock 都会到这): 面板开着 =
      放鼠标不是回菜单 — 收掉 onLockChanged 弹起的 overlay 即可(修: 曾在此
      强收面板+翻出发页, 表现为「关背包弹出发菜单」); 面板全关时才是真回菜单 */
    if (ADV.panelOpen || advFurnace.isOpen() || ADV.chestOpen) {
      overlay.style.display = 'none'; return;
    }
    showPage('adventure');
  },

  hud: advHudLines, /* HUD 行构造(下界态分支在内; 具名提出供挂点触达) */

  touch: advTouchList(), /* 触屏条初表(空手=⛏️主键+🪓锄地键+rare 🎒🏠, farm-and-recipe D3;
    装载期求值一次, init 读档后 advSyncHotbar→advTouchMainSync 按实际手态重声明); 手持
    特殊物品时 advTouchMainSync 边沿重声明为 advTouchList()(基表 + 使用动作键) */
  /* 触屏长按连挖(input.js 手势路由): 复用桌面按住标志 — 蓄力链自动连挖/触屏松手即停 */
  onHold(active) {
    advMouseHeld = active;
  },
});

/* T12~T15 的接线挂点(内部接口, 不进模式公共行为; 2026-10 评审候选 5 收敛为 20 键测试面,
    下界相位装配追加 5 键、冒险地图 T6 追加 advSetMap、T5 圈层高度场与审查修复
    advSlimeWaterOk 再追加、时钟改版追加 advSleepClock/advSleepClockConfirm——
    现 30 键(键计数以本清单为准); 键清单即 interface——
    adventure-core 常量表与纯函数经 core 直调不再转发):
    · 状态账本: ADV · advMine(蓄力) · advSaplings(树苗计时) · advSleep(睡觉转场)
      · advSleepClock(时钟拨盘态) · advNetherState(下界相位·地图态只读快照: dim/map/portalCd/exitSpot)
    · 存档面: advJournal(世界档记账 seam) · getSaveView(四份存档只读快照)
    · 布置缝: advGetInv · advGetPEnt · advFurnace(熔炉站点直达: map/state/at/open/
      close/isOpen/autoFill/manualPut/slotClick/drop) · advFlameCount
    · 下界相位·切图: advSetDim(切界唯一入口) · advSetMap(切图唯一入口, T7 触发器
      接此) · advSceneEdits(按图分桶账本) · advNetherState
    · 交互链入口: advBreakBlock · advOnCraft · advInvMove · advChest{Deposit,Withdraw,Expand}
      · advPanelClose(幂等守卫回归锚点) · advMineHardText(挖不动话术判据)
      · advSleepClockConfirm(拨盘「睡觉」确认, 测试与触屏共用行为面)
    · 查询 seam: advStationOk · advNightRead · advQuestPaint(重画并返回任务卡) · advHudLines(HUD 行)
    已删键的行为面等价物: advPlayerDied→onVoidFall · advGoHome→onKey('KeyH') ·
    advChestOpenPanel/advChestClose→点击与 onKey('Tab') · advExplode→TNT 引信行为链 ·
    advGetTntTap/advMouseHeldOn/Off→onHold+advMine.down · advMainPlaceable→holdAct ·
    advOnKill/advWearHeld→挥击行为链 · advMarkEdit→advJournal.mark(非站点格) ·
    advPlacePortal→onMouse(2) 手持 nether_portal */
function advSaveView() {/* 四份存档的可断言快照(只读缝): 与 journal payload 同构的 world 键
    (按图分桶/当前图键/维度感知 pos) + 任务档 + 大宝箱账户 + 背包 serialize; 槽/清单为浅拷贝,
    调用方改不动壳内状态 */
  return {
    world: {edits: advSceneEditsEncode(advSceneEdits),
      map: advMap,
      pos: advDim === 'nether' ? null : {x: pos.x, y: pos.y, z: pos.z, yaw},
      hp: ADV.player.hp, furnaces: advFurnaceClean(advFurnaces), livestock: advLivestockAll, dayTime},
    quest: {step: ADV.quest.step, counts: ADV.quest.counts, title: ADV.quest.title,
      firstNight: ADV.quest.firstNight},
    chest: {size: advChest.size, slots: advChest.slots.slice()},
    inv: serialize(advInv),
  };
}
AdventureMode.adv = {ADV, advJournal, getSaveView: advSaveView,
  advGetInv: () => advInv, advGetPEnt, advMine, advSaplings, advSleep, advSleepClock,
  advSleepClockConfirm,
  heightAt: advHeightAt, /* T5 圈层高度场(建场件与测试共用的唯一高度权威) */
  advFurnace, advFlameCount: () => advFlames.size,
  advBreakBlock, advOnCraft, advInvMove, advDropSlot, advTryExpandBag, advReclaimThrown,
  advChestDeposit, advChestWithdraw, advChestExpand, advPanelClose,
  advStationOk, advNightRead, advQuestPaint, advSlimeWaterOk,
  advSetDim, advSetMap, advSceneEdits,
  advNetherState: () => ({dim: advDim, map: advMap, portalCd: advPortalCd, exitSpot: advExitSpot}),
  advMineHardText, advHudLines};

if (typeof module !== 'undefined' && module.exports) module.exports = AdventureMode;
