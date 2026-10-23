'use strict';
/* ============================================================
   探险模式 (AdventureMode) — 应用层·模式
   ------------------------------------------------------------
   物品与合成系统的第一个消费者(设计稿 D11)。128×128 确定性草原
   (SceneKit.rand/hashRand 散布, 重进逐块复现, 只存玩家差异): 树林 ~40 ·
   湖(湖底黏土 2~3 格厚, 红砖链源头) · 2 露天矿坑(阶梯漏斗坑, 坑壁裸露
   煤/铁矿) · 1 山洞隧道通 y<10 深处(沿途裸露铁/金/钻石矿带) · 出生小屋
   (原木+木板, 工作台/熔炉不送——任务链做出来才有仪式感) · 3 怪物巢穴
   位点(土丘洞穴地形+常量表)。T14 已接巢穴战斗: 每巢限量 2~3 只·清空
   60s 再刷·索敌收敛不追出巢区(儿童可控口径, 参数见巢穴战斗段注释);
   T12 挖掘与采集亦已接线(蓄力/放置/树链/食物/耐久, 见下)。
   能进能玩地形 + 背包 UI + 击杀掉落/收集播报/玩家战斗均已落地;
   T13 合成与烧炼亦已接线(站点解锁/配方表扬/熔炉状态机/TNT 链, 见下);
   T15 任务链 12 步+终章亦已接线(计数账本+节流推进+任务卡+仪式, 见下)。
   · 玩家: 出生小屋门口 · 步行(不飞行) · 血量 30 + 头顶血条; 死亡=背包
     保留+回出生点满血+TTS 安抚(下界先例口径, 零惩罚哲学)。
   · T12 挖掘与采集(D4/D7): 按住蓄力(准星进度环+挥动循环+换目标/松手
     清零, breakTime 驱动) → 破坏碎屑+记账+rollBlockDrop 掉落真空拾取;
     tier 不足只碎不掉+TTS 节流; 放置型物品点准星面(editBlock+背包−1),
     thin 块(火把/树苗)只放实心面顶; 树苗放草地/泥土 20s 长成(计时 Map
     不落盘, 重进全图重建); 草丛确定性散布(挖掉 50% 掉种子); 食物点击吃
     (advEatPolicy, 腐肉同口径); 工具破坏成功耐久 −1, 归零消失+安抚。
   · T13 合成与烧炼(D8): 工作台/熔炉放置后走近 4 格解锁(站点坐标缓存:
     edits 重放重建, 放置/挖除经 advMarkEdit 维护, 不每帧扫全图); 合成
     成功 TTS 具体表扬(产物名入句·夸努力口径)+leftover 转脚下掉落物;
     熔炉状态机挂模式层(2.5s/件·自动燃料热值·关面板进度保留·退世界/死亡
     全额退料); TNT 合成→放置→空手点击点燃→延时爆炸(半径 3.5·方块 70%
     掉落·波及怪物, 不伤玩家——儿童挖矿神器口径)。
   · T15 任务链(D11): QUESTS 数据表 12 步+终章, 每步 = 纯函数谓词 + 语音
     引导 + 图标 + 完成表扬(夸努力口径); 事件挂点(挖掘/拾取/合成/放置/烧成)
     只往 ADV.quest.counts 累计(只增不减=跳步防护, 只认玩家亲手做——TNT
     掀掉的不算), update 内 0.5s 节流查当前步谓词(不越级), 完成 → 表扬
     TTS+toast+音效 → 语音引导下一步 → 落盘; 钻石首获专属仪式(双层冲击波+
     碎钻+金弧+专属琶音); 终章合成钻石剑 → 「小小探险家」称号+四色烟花
     (称号随 quest 存档, 重进不重复授予); 任务卡挂 advPanel.questEl,
     打开背包即见(当前步大图标+进度+划线史), HUD 常驻一行任务进度。
   · 三份存档: inventory_save(全局唯一背包, 跨模式共享) /
     adventure_world_save(场景确定性重建+edits 重放, build 模式同款) /
     adventure_quest_save({step, counts, title?}, T15 任务进度)。
   · 防沉迷: 与竞技场/TNT/建造/坦克/下界共享儿童时限(gated, 不新增账本)。
   interface: AdventureMode(mkMode 深接口: init/cleanup/update/onKey/onMouse/
     hud/touch) · AdventureMode.adv — T12~T15 接线挂点与单测触达面(常量表/
     死亡+蓄力+放置+食物+树苗+巢穴节律+站点判定+烧炼节律+TNT 掷骰纯函数/
     挥击伤害/掉落清单/播报文案/edits 记账/背包只读/熔炉状态与炉前交互/
     任务表 QUESTS 与任务卡只读引用)
   依赖(均经全局名, 调用期解析): config.js 的 BLOCKS/PLAYER/WORLD 尺寸/
     B_* 常量 · voxel.js 的 getBlock/setBlockRaw/blockKey/raycastVoxel/
     collidesAtPlayer · world.js 的 loadScene/editBlock · scene-kit.js 的
     SceneKit · items-core 的 ITEMS/isTool/toolOf · inventory-core 的
     mkInventory/HOTBAR_SLOTS/INV_SLOTS/add/count/remove/take/damageTool/
     serialize/deserialize · craft-core 的 RECIPES/canCraft/craft/FUEL/
     fuelUnits/smeltOf/breakTime · drops.js 的 rollBlockDrop/rollDrops(纯)/
     spawn/update/onCollect/clear · mobs.js 的 spawn/hit/onDeath/update/
     render/steer/move/gait/debrisColor/clear(退出清场) · combat-core.js 的
     CombatCore(节拍/弹道/盒判定) · effects.js 的 sfx/Fx(boom/arc/pop/
     debrisBurst 爆炸·引信·仪式观感) · input.js 的 doCenterClick(触屏准星点击) · mode-kit.js 的
     mkMode/mkHotbar/mkCraftPanel/mkFurnacePanel · sync.js 的 SyncDB.slot ·
     speech.js 的 SpeechKit · avatar.js 的 Avatar(setItem/swing/flash)
   可测性: THREE/DOM 惰性创建(头顶血条/箭矢网格), Node 测试可安全加载
     (test/adventure-mode.test.js, 真引擎件经 vm 装载)
   ============================================================ */

/* ---------- 地图常量(128×128, 一期口径; D14 扩容后随尺寸换算) ---------- */
const ADV_GROUND = 24; /* 草原表层 y: 下 4 层泥(y20~23), 再下石头到 y0(D5 压缩分层) */
const ADV_HUT = {x1: 58, x2: 64, z1: 78, z2: 84}; /* 出生小屋: 7×7, 北墙正中门洞 */
const ADV_SPAWN = {x: 61.5, y: ADV_GROUND + 1, z: 76.5, yaw: 0}; /* 门口两步, 面朝旷野背对小屋 */
const ADV_LAKE = {cx: 22, cz: 24, r: 7}; /* 湖: 西北角, 沙岸+可趟水+湖底黏土 */
const ADV_PITS = [ /* 露天矿坑: 阶梯漏斗坑(每级 2 格), 坑壁矿化做可见性教学 */
  {cx: 98, cz: 28, r: 6, floor: 12, ore: {id: B_COAL_ORE, yLo: 12, yHi: 20, salt: 4101}},
  {cx: 30, cz: 96, r: 7, floor: 10, ore: {id: B_IRON_ORE, yLo: 6, yHi: 16, salt: 4207}},
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

const ADV = {ground: ADV_GROUND, spawn: ADV_SPAWN, hut: ADV_HUT, lake: ADV_LAKE,
  pits: ADV_PITS, cave: ADV_CAVE, nests: ADV_NESTS,
  player: {hp: 30, maxHp: 30}, quest: {step: 0, counts: {}}, panelOpen: false, furnaceOpen: false,
  killCount: 0, swingCd: 0};

/* ---------- 三份存档(D12): mkSaveSlot 语义, SyncDB 槽创建即注册回填 ---------- */
const ADV_INV_KEY = 'inventory_save';
const ADV_WORLD_KEY = 'adventure_world_save';
const ADV_QUEST_KEY = 'adventure_quest_save';
const advWorldSlot = SyncDB.slot(ADV_WORLD_KEY, {
  defaults: {edits: []},
  encode: (st) => ({edits: [...st.edits.entries()]}),
  decode: (sv) => ({edits: new Map(sv.edits || [])}),
});
const advInvSlot = SyncDB.slot(ADV_INV_KEY, {
  defaults: {slots: new Array(INV_SLOTS).fill(null)},
  encode: (inv) => serialize(inv), /* T5 形状 {_v:1, slots} 直产 */
  decode: (sv) => deserialize(sv), /* 损坏回落空包(inventory-core 口径) */
});
/* T15 任务进度: mkSaveSlot defaults 只补缺失字段——老档 {step:N} 自动补空 counts */
const advQuestSlot = SyncDB.slot(ADV_QUEST_KEY, {defaults: {step: 0, counts: {}}});

let advEdits = new Map(); /* 玩家方块改动 "x,y,z"→id(只存差异, 重进重放) */
let advDirty = false;
let advSaveT = 0;
/* 站点坐标缓存(T13): "x,y,z"→{x,y,z,id}——B_CRAFT/B_FURNACE 只可能来自玩家
   放置(edits 全量差异), 重进由 advRescanStations 重放收集, 增删经 advMarkEdit
   顺路维护——advStationOk 只查缓存, 不每帧扫全图 */
const advStations = new Map();

function advMarkEdit(x, y, z, id) {/* T12 挖掘/放置在 editBlock 后调此记账(build 同款); T13 顺路维护站点缓存 */
  const k = blockKey(x, y, z);
  advEdits.set(k, id);
  if (id === B_CRAFT || id === B_FURNACE) advStations.set(k, {x, y, z, id});
  else advStations.delete(k); /* 挖除/覆盖皆注销(爆炸掀掉站点同样走此 seam) */
  advDirty = true;
}
function advSaveNow() {
  advWorldSlot.save({edits: advEdits});
  advInvSlot.save(advInv);
  advQuestSlot.save(ADV.quest); /* T15: 任务进度随 5s 节流一起落盘(步进时另有即时落盘) */
  advDirty = false;
}

/* ---------- 全局唯一背包 + 快捷栏镜像(9 item 型槽, D10) ----------
   advInv 永久单例(面板闭包持有同一引用), 换存档只原地换 slots 数组 */
const advInv = mkInventory();
const advHbItems = []; /* 槽描述符: {item:id} + cnt/dur 访问器(refresh 实时重读) */
for (let i = 0; i < HOTBAR_SLOTS; i++) {
  advHbItems.push({
    item: '',
    cnt: () => (advInv.slots[i] ? advInv.slots[i].n : 0),
    dur: () => {
      const s = advInv.slots[i];
      if (!s || !isTool(s.id)) return 0; /* 非工具不画耐久条 */
      const t = toolOf(s.id);
      return t ? (s.dur || 0) / t.dur : 0;
    },
  });
}
const advHb = ModeKit.mkHotbar({items: advHbItems, onPick: (i) => advHeldChanged(i)});
function advHeldChanged(i) {/* 选中槽: 工具换观感(defs 与物品 id 同名, T4), 其余回落锄头 */
  const s = advInv.slots[i];
  const it = s ? ITEMS[s.id] : null;
  if (it && it.tool) {
    Avatar.setItem(s.id);
    showToast(it.name + ' 在手！');
  } else {
    Avatar.setItem(PLAYER.heldItem); /* 放置/食物的点击政策归 T12 */
  }
  advHb.refresh();
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
}

/* ---------- 背包+配方书面板(T10 mkCraftPanel) + 熔炉面板(T13 实例化) ---------- */
function advStationOk() {/* 站点解锁(D8 拍板④): 已放置工作台距玩家 ≤4 格(水平距离, 查站点缓存不扫全图) */
  return advNearStation(advStations.values(), pos.x, pos.z, ADV_STATION_R, B_CRAFT);
}
function advOnCraft(out) {/* 合成成功(T13, D8): TTS 具体表扬(产物名入句, 夸努力口径) +
  leftover 转脚下掉落物(背包满零惩罚) — T15 任务进度在此挂合成事件 */
  const name = (ITEMS[out.item] && ITEMS[out.item].name) || out.item;
  SpeechKit.speak(name + '做好啦！你真会想办法！');
  if (out.leftover > 0) Drops.spawn(out.item, out.leftover, pos.x, pos.y + 0.5, pos.z);
  advSyncHotbar();
  showToast('✅ ' + name + ' 做好啦！');
  advTally('craft_' + out.item, out.n); /* T15: 合成件数记账(事件处只 +=, 推进归节流查) */
}
const advPanel = ModeKit.mkCraftPanel({
  inv: advInv,
  station: advStationOk,
  onCraft: advOnCraft,
  onSort: () => {
    advSyncHotbar();
    showToast('🧹 整理好啦！');
  },
});
const advFurnacePanel = ModeKit.mkFurnacePanel({inv: advInv, onAutoFill: advFurnaceAutoFill});
function advPanelToggle() {/* 🎒/Tab 入口 */
  ADV.panelOpen = !ADV.panelOpen;
  if (ADV.panelOpen) advPanel.show();
  else advPanel.hide();
}

/* ---------- 玩家实体(受击/受死共用状态, nether getPEnt 同款) ---------- */
let advPEnt = null;
function advGetPEnt() {
  if (advPEnt) return advPEnt;
  advPEnt = {pos, vel, cfg: {h: PLAYER.height, fly: false, ranged: false, dmg: 3, range: 3.0,
    cd: 0, hitR: 0.55, speed: PLAYER.speed, hp: ADV.player.hp, maxHp: ADV.player.maxHp,
    dead: false, gone: false},
  hp: ADV.player.hp, maxHp: ADV.player.maxHp, dead: false, deadT: 0,
  flashT: 0, staggerT: 0, tintBase: [1, 1, 1]};
  return advPEnt;
}

/* ---------- 头顶血条(canvas 贴图 Sprite, 血量变化才重绘; nether 同款可复制) ---------- */
let advHpBar = null; let advHpCtx = null; let advHpTex = null; let advHpLast = -1;
function advEnsureHpBar() {
  if (advHpBar || typeof THREE === 'undefined' || typeof document === 'undefined' ||
      typeof scene === 'undefined') return;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 16;
  advHpCtx = cv.getContext('2d');
  advHpTex = new THREE.CanvasTexture(cv);
  advHpBar = new THREE.Sprite(new THREE.SpriteMaterial({map: advHpTex, transparent: true}));
  advHpBar.scale.set(1.5, 0.19, 1);
  scene.add(advHpBar);
}
function advUpdateHpBar() {
  advEnsureHpBar();
  if (!advHpBar) return;
  const hp = Math.max(0, Math.ceil(advGetPEnt().hp));
  if (hp !== advHpLast) {
    advHpLast = hp;
    const c = advHpCtx; const W = 128;
    c.clearRect(0, 0, W, 16);
    c.fillStyle = 'rgba(16,16,20,0.82)'; c.fillRect(14, 3, W - 16, 10);
    c.fillStyle = '#e83a3a'; c.fillRect(16, 5, Math.max(0, (W - 20) * hp / ADV.player.maxHp), 6);
    c.strokeStyle = '#f0f0f0'; c.lineWidth = 1; c.strokeRect(14.5, 3.5, W - 17, 9);
    c.fillStyle = '#ff5a5a'; c.font = '13px sans-serif'; c.textBaseline = 'top'; c.fillText('❤', 1, 1);
    advHpTex.needsUpdate = true;
  }
  advHpBar.position.set(pos.x, pos.y + 2.2, pos.z);
}
function advDisposeHpBar() {
  if (!advHpBar) return;
  if (typeof scene !== 'undefined') scene.remove(advHpBar);
  advHpBar.material.dispose(); advHpTex.dispose();
  advHpBar = null; advHpCtx = null; advHpTex = null; advHpLast = -1;
}

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

function advBuildPit(p) {/* 露天矿坑: 阶梯漏斗坑(每级 2 格深)挖到目标层, 坑壁矿化 */
  for (let dx = -p.r; dx <= p.r; dx++) {
    for (let dz = -p.r; dz <= p.r; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > p.r) continue;
      const depth = Math.floor(p.r - d);
      const floorY = Math.max(p.floor, ADV_GROUND - depth * 2);
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
function advPlantTrees() {/* 树林 ~40: 候选按散列值排序取前 N(空间无偏且确定性) */
  const cands = [];
  for (let x = 2; x < WORLD_W - 2; x++) {
    for (let z = 2; z < WORLD_D - 2; z++) {
      if (advTreeBlocked(x, z)) continue;
      const r = SceneKit.rand(x, z, 7001);
      if (r > 0.995) cands.push({x, z, r});
    }
  }
  cands.sort((a, b) => (a.r - b.r) || (a.x - b.x) || (a.z - b.z));
  for (const cd of cands.slice(0, ADV_TREES)) SceneKit.tree(cd.x, ADV_GROUND + 1, cd.z);
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
/* 死亡结算(T14 致命一击/坠出世界共用): 只动玩家状态与位置, 背包一个不动 */
function advPlayerDied() {
  const e = advGetPEnt();
  const plan = advDeathPlan(e, ADV.spawn);
  e.dead = false; e.deadT = 0; e.flashT = 0; e.staggerT = 0; e.tintBase = [1, 1, 1];
  e.hp = plan.hp; ADV.player.hp = plan.hp;
  ModeKit.spawn(plan.x, plan.y, plan.z, {yaw: plan.yaw});
  advFurnaceReset(true); /* 死亡清炉(T13 合同): 炉内材料全额退背包, 满包余量掉在重生点脚边 */
  SpeechKit.speak('不怕不怕，回到小屋休息好啦，背包里的宝贝都在！');
  showToast('💀 回到出生小屋，满血再来！');
}

/* ============================================================
   巢穴战斗掉落 (T14, 设计稿 D6/D11/D9) — 常量→纯函数段→壳段
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

/* ---------- 纯函数段(零引擎状态, 单测直测; rand 均可注入) ---------- */

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

/* ---------- 壳段: 刷怪节律 / 玩家战斗 / 怪物 AI / 箭矢 / 收集 ---------- */

const advNestT = ADV_NESTS.map(() => 0); /* 各巢独立计时器(秒): 全清后累计 */
function advNestAlive(i) {/* 巢内存活数(m.nest 挂件是归属唯一依据; 尸体不计) */
  let n = 0;
  for (const m of Mobs.list()) {
    if (!m.dead && !m.gone && m.nest === i) n++;
  }
  return n;
}
function advSpawnNest(i) {/* 本巢首刷/再刷: 池内取种, 洞口环带落位 */
  const nest = ADV_NESTS[i];
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
  for (let i = 0; i < ADV_NESTS.length; i++) {
    const step = advNestStep(advNestAlive(i), advNestT[i], dt); /* 节拍纯函数段 */
    advNestT[i] = step.t;
    if (step.spawn) advSpawnNest(i);
  }
}

/* 玩家挥击: 准星锥内最近怪(纯方向门槛, 不依赖相机 — 与 lookDir 同式的
   yaw 朝向); 锥内无怪不出手不空挥, 点击留给挖掘/放置(T12 语义不抢) */
function advAimMob(p) {
  let best = null; let bd = ADV_MELEE_R * ADV_MELEE_R;
  const fx = -Math.sin(yaw); const fz = -Math.cos(yaw); /* 朝向(camera-rig lookDir 同式) */
  for (const m of Mobs.list()) {
    if (m.dead || m.gone) continue;
    const dx = m.pos.x - p.pos.x; const dz = m.pos.z - p.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > bd) continue;
    if (Math.abs(m.pos.y - p.pos.y) > 2.5) continue;
    const d = Math.sqrt(d2) || 1e-9;
    if ((dx / d) * fx + (dz / d) * fz < ADV_AIM_COS) continue; /* 不在准星锥内 */
    bd = d2; best = m;
  }
  return best;
}
function advAttack() {
  if (ADV.swingCd > 0) return;
  const p = advGetPEnt();
  const m = advAimMob(p);
  if (!m) return; /* 锥内无怪: 不出手(挖掘/放置的点击政策归 T12) */
  ADV.swingCd = ADV_SWING_CD;
  Avatar.swing();
  const held = advInv.slots[advHb.sel];
  const r = Mobs.hit(m, advSwingDmg(held ? held.id : ''),
      m.pos.x - p.pos.x, m.pos.z - p.pos.z, 0.35);
  sfx('hit');
  advWearTool(); /* 命中才扣耐久(空手/非工具不扣) */
  if (r.freshDead) advOnKill(m);
}
/* 手持工具耐久 -1; 归零 → remove + 安抚 TTS(D4/D9 政策, 与 T12 各管各路径) */
function advWearTool() {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  if (!s || !isTool(s.id)) return;
  if (damageTool(advInv, slot) === 0) {
    const name = (ITEMS[s.id] && ITEMS[s.id].name) || s.id;
    remove(advInv, slot);
    SpeechKit.speak('哎呀，' + name + ' 用坏了！不哭，我们再做一把新的！');
    showToast('💔 ' + name + ' 用坏了');
  }
  advSyncHotbar();
}
function advOnKill(m) {/* 击杀观感(nether 先例): 碎块+计数 toast; 掉落在 onDeath 回调 */
  ADV.killCount++;
  Fx.debrisBurst(m.pos.x, m.pos.y + 0.8, m.pos.z, 6, {color: Mobs.debrisColor(m.type), life: 0.6});
  showToast('👾 击杀 ' + ADV.killCount);
}

/* 受击提醒(非致命, nether 全套): 账本同步 + 受击音 + 闪红 + 震屏 + 语音 3s 节流 */
let advHurtT = 0; /* 受击语音节流计时(iOS TTS 频繁 cancel 是掉帧源, nether 同款) */
function advOnHurt(r) {
  ADV.player.hp = r.hp;
  sfx('hurt');
  Avatar.flash(0.4); /* 主提醒: 身体变红(剩血走头顶血条, 不再 toast) */
  Fx.kick(0.35);
  if (advHurtT <= 0) {
    advHurtT = 3;
    SpeechKit.speak('哎呀被打中了！快躲开！');
  }
}

/* 怪物 AI(nether 同款骨架 + 巢穴收敛): 索敌=玩家且同巢; 超收队半径掉头回巢;
   近战逼近→贴身打, 骷髅(ranged)保持 7 格巡航放箭(leadAim 预测弹道) */
function advMobAI(dt) {
  const p = advGetPEnt();
  for (const m of Mobs.list()) {
    if (m.dead || m.gone) continue;
    CombatCore.tickCadence(m, dt); /* 攻击节拍(战斗核心, 与竞技场/下界同一条) */
    const nest = ADV_NESTS[m.nest != null ? m.nest : 0];
    const dxP = p.pos.x - m.pos.x; const dzP = p.pos.z - m.pos.z;
    const distP = Math.hypot(dxP, dzP) || 1e-9;
    const hx = nest.x - m.pos.x; const hz = nest.z - m.pos.z;
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
          advShootArrow(m, p);
        }
      } else if (distP > m.cfg.range) {/* 近战逼近 */
        Mobs.move(m, dxP / distP * speed * dt, dzP / distP * speed * dt); moved = speed;
      } else if (Math.abs(p.pos.y - m.pos.y) < 2.5 && m.attackCd <= 0) {/* 贴身攻击玩家 */
        m.attackCd = m.cfg.cd; m.attackT = ADV_ATTACK_T;
        const r = Mobs.hit(p, advMobDmg(m), p.pos.x - m.pos.x, p.pos.z - m.pos.z, 0.4);
        if (r.freshDead) advPlayerDied();
        else advOnHurt(r);
      }
    } else if (distHome > ADV_NEST_HOME_R) {/* 收队: 慢步回巢(掉头不恋战) */
      Mobs.steer(m, Math.atan2(hx, hz));
      const sp = speed * 0.6;
      Mobs.move(m, hx / distHome * sp * dt, hz / distHome * sp * dt); moved = sp;
    }
    Mobs.gait(m, dt, moved, ADV_ATTACK_T); /* 步态+战斗姿态(引擎同一入口) */
  }
}

/* 骷髅箭矢(nether 投射先例): leadAim 预测弹道 + 重力, 命中玩家走受击/死亡 */
const advArrows = []; /* 玩家近战无远程, 弹道单向(怪 → 玩家) */
let advArrGeo = null; let advArrMat = null; /* 箭矢几何/材质全局共用(移除只摘网格) */
function advShootArrow(m, tg) {
  sfx('shoot');
  const from = {x: m.pos.x, y: m.pos.y + (m.cfg.h || 1.8) * 0.55, z: m.pos.z};
  const dir = CombatCore.leadAim(from,
      {x: tg.pos.x, y: tg.pos.y, z: tg.pos.z, vx: tg.vel.x, vz: tg.vel.z, h: tg.cfg.h},
      ADV_ARROW_SPEED, 6, 0.5);
  let mesh = null;
  if (typeof THREE !== 'undefined' && typeof scene !== 'undefined') {
    if (!advArrGeo) {
      advArrGeo = new THREE.BoxGeometry(0.06, 0.06, 0.62);
      advArrMat = new THREE.MeshBasicMaterial({color: 0xd8d0b8});
    }
    mesh = new THREE.Mesh(advArrGeo, advArrMat);
    mesh.position.set(from.x, from.y, from.z);
    scene.add(mesh);
  }
  advArrows.push({owner: m, mesh, from,
    vel: {x: dir.x * ADV_ARROW_SPEED, y: dir.y * ADV_ARROW_SPEED, z: dir.z * ADV_ARROW_SPEED},
    life: 2.5, dmg: advMobDmg(m), kpow: 0.6, g: 6});
}
function advRemoveArrow(i) {
  const a = advArrows[i];
  if (a.mesh && typeof scene !== 'undefined') scene.remove(a.mesh);
  advArrows.splice(i, 1);
}
function advUpdateArrows(dt) {
  const p = advGetPEnt();
  for (let i = advArrows.length - 1; i >= 0; i--) {
    const a = advArrows[i];
    a.vel.y -= a.g * dt;
    a.life -= dt;
    const px = a.from.x + a.vel.x * dt; const py = a.from.y + a.vel.y * dt;
    const pz = a.from.z + a.vel.z * dt;
    a.from = {x: px, y: py, z: pz};
    if (a.mesh) {
      a.mesh.position.set(px, py, pz);
      a.mesh.lookAt(px + a.vel.x, py + a.vel.y, pz + a.vel.z); /* 箭头朝飞行方向 */
    }
    if (getBlock(Math.floor(px), Math.floor(py), Math.floor(pz)) !== 0 || a.life <= 0) {
      advRemoveArrow(i);
      continue;
    }
    if (!p.dead && CombatCore.hitBody({x: px, y: py, z: pz}, p)) {/* 命中玩家(战斗核心盒判定) */
      const r = Mobs.hit(p, a.dmg, p.pos.x - px, p.pos.z - pz, a.kpow);
      if (r.freshDead) advPlayerDied();
      else advOnHurt(r);
      advRemoveArrow(i);
    }
  }
}

/* ============================================================
   T12 挖掘与采集 — 蓄力状态机 / 放置 / 树链 / 食物 / 耐久
   纯函数段在前(单测直测), 交互段在后(挂 onMouse/update)
   ============================================================ */

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
   (交互层据此不扣物品); healed = 实际回复量(血条动画消费) */
function advEatPolicy(hp, maxHp, food) {
  const capped = Math.min(maxHp, hp + food);
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

/* ---------- 交互段 ---------- */

const ADV_MINE_SWING = 0.28; /* 蓄力期间挥动节拍(秒/挥, Avatar.swing 循环喂 HeldItems.swingPose) */
const ADV_SAP_GROW = 20; /* 树苗 20s 长成(D7) */
let advTierT = 0; /* 「需要更硬的镐子」TTS 节流(3s) */
const advSaplings = new Map(); /* 树苗计时 "x,y,z"→{x,y,z,left}; 重进经全图扫描重建 */
const advMine = {down: false, t: 0, key: '', need: 0, drops: true, swingT: 0}; /* 蓄力状态机 */
let advMouseHeld = false; /* 桌面按住标志(document mousedown/up 维护): 按住连挖, 触屏单击挖一块 */

/* 准星命中(每帧蓄力判定用): CameraRig.aim 唯一视线入口(nether 先例);
   Node 测试无相机件时返回 null(蓄力链经 onMouse 直测) */
function advAimHit() {
  if (typeof CameraRig === 'undefined' || typeof camera === 'undefined' ||
      typeof raycastVoxel === 'undefined') return null;
  const a = CameraRig.aim(camera);
  return raycastVoxel(a.origin, a.dir, PLAYER.reach);
}

/* 蓄力清零(松手/换目标不可挖/面板打开/退出模式) */
function advMineStop() {
  advMine.down = false;
  advMine.t = 0;
  advMine.key = '';
  advMine.swingT = 0;
  advRingSet(-1);
}

/* 破坏结算: 碎屑(editBlock 内置同色 Fx.debrisBurst)+记账+掉落+耐久。
   bt 为破坏时的 breakTime 结果(drops:false = tier 不足, 只碎不掉+节流提示) */
function advBreakBlock(x, y, z, id, bt) {
  editBlock(x, y, z, 0);
  advMarkEdit(x, y, z, 0);
  if (id === B_SAPLING) advSaplings.delete(blockKey(x, y, z)); /* 挖树苗撤计时 */
  sfx('hit');
  advDamageHeld(); /* 破坏成功 −1(工具匹配与否都扣, MC 口径; 徒手无槽可扣) */
  if (!bt.drops) {/* tier 不足: 可挖慢速但掉落不触发(§3.4) */
    if (advTierT <= 0) {
      advTierT = 3;
      SpeechKit.speak('需要更硬的镐子哦！');
      showToast('⛏️ 换更硬的镐子才能挖到宝贝');
    }
    return;
  }
  for (const d of rollBlockDrop(BLOCKS[id])) Drops.spawn(d.id, d.n, x + 0.5, y + 0.8, z + 0.5);
  advQuestMine(id, x, y, z); /* T15: 挖到矿记账+钻石首获仪式(只认蓄力挖掘, TNT 链不挂) */
}

/* 手持工具耐久结算: damageTool 返 0 = 破板信号(inventory-core 口径) →
   remove 清槽 + 安抚 TTS(D4) + 观感回落锄头 */
function advDamageHeld() {
  const slot = advHb.sel;
  if (damageTool(advInv, slot) !== 0) {
    advSyncHotbar();
    return;
  }
  remove(advInv, slot); /* 工具 n=1, 整槽消失 */
  Avatar.setItem(PLAYER.heldItem);
  SpeechKit.speak('镐子累了！我们再做一个更棒的！');
  showToast('🔧 工具用坏了，再做一把更棒的吧！');
  advSyncHotbar();
}

/* 蓄力推进(update 每帧): 准星指住可挖方块才累计; 换目标/指空清零;
   到点破坏 — 桌面按住连挖(advMouseHeld), 触屏单击政策本块完成即停 */
function advMineTick(dt) {
  if (!advMine.down || ADV.panelOpen || ADV.furnaceOpen) {
    advMineStop();
    return;
  }
  const hit = advAimHit();
  const id = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
  const def = id ? BLOCKS[id] : null;
  if (!def || def.hard == null) {/* 空气/水/创造专属(字段缺失即不可采集, T2 判据) */
    advMineStop();
    return;
  }
  const held = advInv.slots[advHb.sel];
  const bt = breakTime(def, held && isTool(held.id) ? held : null); /* 非工具手持 = 徒手口径 */
  Object.assign(advMine, advMineStep(advMine, blockKey(hit.x, hit.y, hit.z), bt, dt));
  advMine.swingT += dt; /* 挥动循环: 节拍触发 Avatar.swing(swingPose 纯函数在 Avatar 内循环) */
  if (advMine.swingT >= ADV_MINE_SWING) {
    advMine.swingT = 0;
    Avatar.swing();
  }
  advRingSet(advMine.need > 0 ? advMine.t / advMine.need : -1); /* 准星进度环填充 */
  if (!advMine.done) return;
  advBreakBlock(hit.x, hit.y, hit.z, id, bt);
  advMine.t = 0;
  advMine.key = '';
  if (!advMouseHeld) advMine.down = false; /* 触屏单击/桌面已松手: 本块完成即停 */
  advRingSet(-1);
}

/* 放置交互: 选中放置型物品(ITEMS.block 字段)点击准星面 → editBlock+记账+
   背包 −1(D4); 树苗额外挂 20s 计时; thin 块非法落点给节流 toast */
function advTryPlace(hit) {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  const it = s ? ITEMS[s.id] : null;
  if (!hit || !it || it.block == null) return false;
  const lookId = getBlock(hit.x, hit.y, hit.z);
  const targetId = getBlock(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz);
  const pc = advPlaceCheck(hit, it.block, lookId, targetId);
  if (!pc.ok || collidesAtPlayer(pc.x, pc.y, pc.z)) {/* 不与玩家身体重叠(arena 先例) */
    showToast('这里放不了哦');
    return false;
  }
  editBlock(pc.x, pc.y, pc.z, it.block);
  advMarkEdit(pc.x, pc.y, pc.z, it.block);
  if (it.block === B_CRAFT) advTally('place_craft_table', 1); /* T15: 站点放置记账(任务链消费的两键) */
  if (it.block === B_FURNACE) advTally('place_furnace', 1);
  if (it.block === B_SAPLING) advSapPlant(pc.x, pc.y, pc.z);
  remove(advInv, slot, 1);
  advSyncHotbar();
  sfx('click');
  showToast('放下 ' + it.name + '！');
  return true;
}

/* 树苗挂表: 20s 后长成(D7); 重进经 advRescanSaplings 全图重建计时 */
function advSapPlant(x, y, z) {
  advSaplings.set(blockKey(x, y, z), {x, y, z, left: ADV_SAP_GROW});
}

/* 树苗长成: SceneKit.tree(确定性外观与地形树一致) + 足迹逐块记账
   (footprint 粗扫 y..y+7 / ±2, 重放同值幂等, 邻居地形冗余记账无害) */
function advGrowTree(x, y, z) {
  SceneKit.tree(x, y, z);
  for (let yy = y; yy <= y + 7; yy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const id = getBlock(x + dx, yy, z + dz);
        if (id !== 0) advMarkEdit(x + dx, yy, z + dz, id);
      }
    }
  }
  showToast('🌱 小树苗长成大树啦！');
}

/* 树苗计时推进(update 每帧): 到期清单逐棵长树 */
function advSapTick(dt) {
  for (const s of advSapDue(advSaplings, dt)) advGrowTree(s.x, s.y, s.z);
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

/* 吃食物: 点击手持食物(D4) — 满血不吃; 回血走 advEatPolicy(腐肉同口径),
   remove 吃一口返堆拷贝(inventory-core 口径), 头顶血条随 hp 变化自动重绘 */
function advTryEat() {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  const it = s ? ITEMS[s.id] : null;
  if (!it || it.food == null) return false;
  const e = advGetPEnt();
  const pol = advEatPolicy(e.hp, e.maxHp, it.food);
  if (!pol.canEat) {
    showToast('现在饱饱的，还不饿哦！');
    return true; /* 吃过 attempt 但没吃: 不进入蓄力 */
  }
  e.hp = pol.hp;
  ADV.player.hp = pol.hp;
  remove(advInv, slot, 1);
  advSyncHotbar();
  sfx('pick');
  SpeechKit.speak('咔嚓咔嚓真好吃！');
  showToast('😋 吃掉 ' + it.name + '，生命 +' + pol.healed);
  return true;
}

/* 掉落物收集回调(Drops.onCollect, init 挂/cleanup 随 Drops.clear 解除):
   入包并堆, 一件都放不下才拒返 false(掉落物停地上冷却重试, D6 背包满);
   收集 TTS 合并播报(3s 节流)归 T14, 这里只 toast+音效 */
function advOnCollect(itemId, n) {
  const left = add(advInv, itemId, n);
  if (left >= n) {
    showToast('🎒 背包满啦');
    return false;
  }
  advTally('collect_' + itemId, n - left); /* T15: 实收件数记账(满包部分入包按收到的算) */
  advSyncHotbar();
  sfx('pick');
  const name = (ITEMS[itemId] && ITEMS[itemId].name) || itemId;
  showToast('🎒 捡到 ' + name + ' ×' + n);
  return true;
}

/* ---------- 挖掘进度环(准星 conic-gradient 圆环, 自建 DOM 不依赖 index.html) ---------- */
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
  SpeechKit.speak(advPickupText(advPickBuf));
  advPickBuf.clear();
}

/* ============================================================
   T13 合成与烧炼 — 站点解锁 / 合成表扬 / 熔炉状态机 / TNT 链
   (设计稿 D8/D4) 纯函数段在前(单测直测), 交互段在后(挂 onMouse/update)
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

/* ---------- 纯函数段(零引擎状态, 单测直测; rand 均可注入) ---------- */

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

/* TNT 爆炸掉落掷骰(D4): 方块先掷 70% 门槛, 中签才走 rollBlockDrop(保底+
   概率条目原样掷)。rand 可注入; 源块 B_TNT 无 drop 字段天然空手(不自掉) */
function advTntRoll(id, rand) {
  rand = rand || Math.random;
  const def = BLOCKS[id];
  if (!def) return [];
  return rand() < ADV_TNT_DROP_P ? rollBlockDrop(def, rand) : [];
}

/* TNT 波及伤害: 爆心 HI → 波及边缘 LO 线性衰减(水平距离, 越界钳制) */
function advTntDmg(d) {
  const t = Math.max(0, Math.min(1, d / ADV_TNT_HURT_R));
  return Math.round(ADV_TNT_DMG_HI - (ADV_TNT_DMG_HI - ADV_TNT_DMG_LO) * t);
}

/* ---------- 交互段: 站点沿 / 熔炉面板与状态机 / TNT 引信与爆炸 ---------- */

/* 站点沿检测(update 每帧): 首次靠近工作台给一句 TTS 引导(上升沿一次不唠叨);
   开着配方书走近 → 亮灰实时重算(table 级卡片点亮) */
let advTableNear = false;
function advStationTick() {
  const near = advStationOk();
  if (near && !advTableNear) {
    SpeechKit.speak('走到工作台旁边啦！打开背包，更多配方亮起来咯！');
    if (ADV.panelOpen) advPanel.refresh();
  }
  advTableNear = near;
}

/* 世界重放后重建站点缓存(init 调): 站点只可能来自玩家放置 → O(edits) 收集 */
function advRescanStations() {
  advStations.clear();
  for (const [k, v] of advEdits) {
    if (v !== B_CRAFT && v !== B_FURNACE) continue;
    const p = k.split(',');
    advStations.set(k, {x: +p[0], y: +p[1], z: +p[2], id: v});
  }
}

/* 熔炉状态机(挂模式层, 不进存档——D8: 重进世界熔炉清空材料退回背包) */
const advFurnace = {input: null, fuel: null, out: null, heat: 0, prog: 0};
let advFurnSig = ''; /* 三槽签名(变化才喂 setSlots, 省 DOM) */
let advSmeltTtsT = 0; /* 完成播报节流计时 */

function advFurnacePaint() {/* 面板回显: 三槽现状 + 当前进度(0..1) */
  advFurnacePanel.setSlots({input: advFurnace.input, fuel: advFurnace.fuel, output: advFurnace.out});
  advFurnacePanel.setProgress(advFurnace.prog / ADV_SMELT_T);
}
function advFurnaceOpenPanel() {/* 走近熔炉点击打开: 先取走产物(即时回报)再回显 */
  ADV.furnaceOpen = true;
  advFurnaceCollectOut();
  advFurnacePanel.show();
  advFurnacePaint();
}
function advFurnaceClose() {/* 收面板(✕/Tab/Esc 共用): 顺带取走产物, 烧炼照跑(进度保留) */
  ADV.furnaceOpen = false;
  advFurnacePanel.hide();
  advFurnaceCollectOut();
}
/* 取产物入包: 满包一件都放不下则整撮留炉(拒收口径), 部分放不下留余量在炉 */
function advFurnaceCollectOut() {
  if (!advFurnace.out) return;
  const left = add(advInv, advFurnace.out.id, advFurnace.out.n);
  if (left >= advFurnace.out.n) {
    showToast('🎒 背包满啦，产物先躺在炉里');
    return;
  }
  advFurnace.out = left > 0 ? {id: advFurnace.out.id, n: left} : null;
  advSyncHotbar();
  sfx('pick');
}
/* 自动放料(面板 📥 意图出口): 先取产物腾槽 → 入料(单槽单矿种, 只收首现
   矿种全量) → 热值不足以覆盖剩余件数时补最省燃料(炉内已有则同种加码)。
   plan 缺省自算(面板回调会喂, 直调/测试可省) */
function advFurnaceAutoFill(plan) {
  const f = advFurnace;
  advFurnaceCollectOut();
  plan = plan || advFurnacePanel.autoPlan();
  if (!f.input && plan.load.length) {
    const ld = plan.load[0];
    if (take(advInv, {[ld.id]: ld.n})) f.input = {id: ld.id, n: ld.n};
  }
  const deficit = Math.max(0, (f.input ? f.input.n : 0) - f.heat);
  if (deficit > 0) {
    const fid = f.fuel ? f.fuel.id : (plan.fuel.length ? plan.fuel[0].id : null);
    const per = fid ? fuelUnits(fid) : 0;
    const have = fid ? count(advInv, fid) : 0;
    const want = per ? Math.min(have, Math.ceil(deficit / per)) : 0;
    if (want > 0 && take(advInv, {[fid]: want})) {
      f.fuel = (f.fuel && f.fuel.id === fid) ? {id: fid, n: f.fuel.n + want} : {id: fid, n: want};
    }
  }
  advFurnacePaint();
}
/* 清炉(退世界/死亡共用, D8): 三笔全额退背包, 满包余量掉脚边(spill=true) */
function advFurnaceReset(spill) {
  for (const it of advFurnaceRefund(advInv, advFurnace)) {
    if (spill) Drops.spawn(it.id, it.n, pos.x, pos.y + 0.5, pos.z);
  }
  advFurnaceZero();
  advSyncHotbar();
}
function advFurnaceZero() {/* 炉状态归零(不退料——init 防御性复位用) */
  advFurnace.input = null;
  advFurnace.fuel = null;
  advFurnace.out = null;
  advFurnace.heat = 0;
  advFurnace.prog = 0;
  advFurnSig = '';
}
/* 烧炼节律(update 常开, 面板只是回显——烧炼中可关面板走人):
   产出完成且面板开着 → TTS 完成播报(产物名入句, 3s 节流); ✕ 直关面板
   不经模式层 → 以 root.display 对账收状态 */
function advFurnaceTick(dt) {
  const hadOut = advFurnace.out ? advFurnace.out.n : 0;
  Object.assign(advFurnace, advSmeltStep(advFurnace, dt));
  const made = (advFurnace.out ? advFurnace.out.n : 0) - hadOut;
  if (made > 0) advTally('smelt_' + advFurnace.out.id, made); /* T15: 烧成件数记账(炉内产出即算, 不等入包) */
  advSmeltTtsT = Math.max(0, advSmeltTtsT - dt);
  if (made > 0 && ADV.furnaceOpen && advSmeltTtsT <= 0) {
    advSmeltTtsT = ADV_SMELT_TTS_T;
    const name = (ITEMS[advFurnace.out.id] && ITEMS[advFurnace.out.id].name) || advFurnace.out.id;
    SpeechKit.speak(name + '烧好啦！继续加油！');
  }
  if (ADV.furnaceOpen) {
    advFurnacePanel.setProgress(advFurnace.prog / ADV_SMELT_T);
    const sig = [advFurnace.input, advFurnace.fuel, advFurnace.out]
        .map((s) => (s ? s.id + '×' + s.n : '-')).join('|');
    if (sig !== advFurnSig) {
      advFurnSig = sig;
      advFurnacePanel.setSlots(advFurnace);
    }
    if (advFurnacePanel.root.style.display === 'none') advFurnaceClose(); /* ✕ 对账 */
  }
}

/* ---------- TNT 链(D4): 放置走 advTryPlace → 点击点燃 → 引信 → 爆炸 ---------- */
const advFuses = []; /* 已点燃引信 {x,y,z,t,sparkT} */
function advIgnite(x, y, z) {/* 点击点燃(手持任意, onMouse 左键最前拦截); 重复点击不叠加 */
  for (const f of advFuses) {
    if (f.x === x && f.y === y && f.z === z) return;
  }
  advFuses.push({x, y, z, t: ADV_TNT_FUSE, sparkT: 0});
  sfx('click');
  SpeechKit.speak('点燃啦，快退后！');
  showToast('🧨 点燃啦，快退后！');
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
/* 爆炸结算: Fx.boom 观感(旧 TNT 模式口径) + 半径内可采集方块逐块破坏记账、
   70% 掷骰掉落(advTntRoll) + 圈内 TNT 链式点燃 + 波及怪物受击(线性衰减)。
   不伤玩家——儿童挖矿神器口径(D4 只给火药一个挖矿出口) */
function advExplode(x, y, z) {
  const cx = x + 0.5; const cy = y + 0.5; const cz = z + 0.5;
  Fx.boom(cx, cy, cz, {r1: ADV_TNT_R + 1.5, n: 14});
  editBlock(x, y, z, 0); /* 源块清除(B_TNT 无 hard 字段, 不进圈内判据) */
  advMarkEdit(x, y, z, 0);
  const r = Math.ceil(ADV_TNT_R);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        const bx = x + dx; const by = y + dy; const bz = z + dz;
        if (Math.hypot(bx + 0.5 - cx, by + 0.5 - cy, bz + 0.5 - cz) > ADV_TNT_R) continue;
        const id = getBlock(bx, by, bz);
        if (id === B_TNT) {
          advIgnite(bx, by, bz); /* 链式引爆(旧模式 chainR 口径): 圈内 TNT 接力点燃 */
          continue;
        }
        const def = id ? BLOCKS[id] : null;
        if (!def || def.hard == null) continue; /* 空气/水/创造专属免疫(字段缺失判据) */
        editBlock(bx, by, bz, 0);
        advMarkEdit(bx, by, bz, 0);
        if (id === B_SAPLING) advSaplings.delete(blockKey(bx, by, bz)); /* 掀掉的树苗撤计时 */
        for (const d of advTntRoll(id)) Drops.spawn(d.id, d.n, bx + 0.5, by + 0.8, bz + 0.5);
      }
    }
  }
  for (const m of Mobs.list()) {/* 波及怪物: 半径内按距离线性衰减伤害+击退 */
    if (m.dead || m.gone) continue;
    const dx = m.pos.x - cx; const dz = m.pos.z - cz;
    const dist = Math.hypot(dx, dz);
    if (dist > ADV_TNT_HURT_R || Math.abs(m.pos.y - cy) > 3) continue;
    const r2 = Mobs.hit(m, advTntDmg(dist), dx, dz, 0.8);
    if (r2.freshDead) advOnKill(m);
  }
}

/* ============================================================
   T15 任务链 — QUESTS 数据表 + 计数账本 + 推进引擎 + 任务卡 + 仪式
   (设计稿 D11) 谓词纯函数在前(单测直测), 交互段在后(挂 update/事件挂点)
   ============================================================ */
const ADV_QUEST_CHECK_T = 0.5; /* 谓词检查节流秒(update 内, 最坏延迟半秒无感) */
const ADV_QUEST_TITLE = '小小探险家'; /* 通关称号(D11 终章, 随 quest 存档) */

/* 挖掘→计数键映射: 石头/圆石都产圆石(步 5 口径「挖 8 圆石」)。只认玩家蓄力
   挖掘(advBreakBlock 挂点)——TNT 爆炸掀掉的不算, 任务链是亲手做的教学 */
const ADV_MINE_TALLY = {
  3: 'mine_cobble', 4: 'mine_cobble',
  [B_COAL_ORE]: 'mine_coal_ore', [B_IRON_ORE]: 'mine_iron_ore', [B_DIAMOND_ORE]: 'mine_diamond_ore',
};

/* 主线任务表(D11 12 步+终章): 每条 = 纯函数谓词 check + 语音引导 hint + 图标
   icon + 完成表扬 praise(夸努力不夸聪明口径); target 是进度分母, prog 算分子
   (复合步取各条件已得之和, 超量钳回)。counts 键五类(事件处只 += 不判断):
   collect_<物品> 拾取件数 · craft_<物品> 合成件数 · mine_<矿> 挖掉块数 ·
   place_<站点> 放置次数 · smelt_<物品> 炉内烧成件数 */
const ADV_QUESTS = [
  {id: 'q1_log', icon: '🪵', goal: '砍树收集 3 根原木', target: 3,
    hint: '去找一棵大树，按住挖树干，捡回 3 根原木哦！',
    praise: '原木收集齐啦！你一直在努力，真棒！',
    prog: (c) => Math.min(c.collect_log || 0, 3), check: (c) => (c.collect_log || 0) >= 3},
  {id: 'q2_planks', icon: '🟫', goal: '合成 4 块木板', target: 4,
    hint: '打开背包，用原木合成木板吧！',
    praise: '木板做好啦！你真会想办法！',
    prog: (c) => Math.min(c.craft_planks || 0, 4), check: (c) => (c.craft_planks || 0) >= 4},
  {id: 'q3_table', icon: '🛠️', goal: '合成并放下工作台', target: 2,
    hint: '先用木板合成工作台，再找块空地放下它！',
    praise: '工作台放好啦！能做的东西越来越多咯！',
    prog: (c) => Math.min(c.craft_craft_table || 0, 1) + Math.min(c.place_craft_table || 0, 1),
    check: (c) => (c.craft_craft_table || 0) >= 1 && (c.place_craft_table || 0) >= 1},
  {id: 'q4_pick_wood', icon: '⛏️', goal: '合成木镐', target: 1,
    hint: '站到工作台旁边，合成一把木镐！',
    praise: '木镐做好啦！石头也难不倒你！',
    prog: (c) => Math.min(c.craft_pick_wood || 0, 1), check: (c) => (c.craft_pick_wood || 0) >= 1},
  {id: 'q5_cobble', icon: '🪨', goal: '挖 8 块圆石', target: 8,
    hint: '用木镐去挖石头，石头会掉成圆石哦！',
    praise: '圆石挖够啦！你挖得又稳又认真！',
    prog: (c) => Math.min(c.mine_cobble || 0, 8), check: (c) => (c.mine_cobble || 0) >= 8},
  {id: 'q6_pick_stone', icon: '⛏️', goal: '合成石镐', target: 1,
    hint: '回到工作台，用圆石合成更硬的石镐！',
    praise: '石镐做好啦！你在一步步变厉害！',
    prog: (c) => Math.min(c.craft_pick_stone || 0, 1), check: (c) => (c.craft_pick_stone || 0) >= 1},
  {id: 'q7_coal', icon: '⚫', goal: '挖 5 个煤矿', target: 5,
    hint: '矿坑和山洞里有黑亮的煤矿，去挖 5 个！',
    praise: '煤矿挖够啦！火把有燃料咯！',
    prog: (c) => Math.min(c.mine_coal_ore || 0, 5), check: (c) => (c.mine_coal_ore || 0) >= 5},
  {id: 'q8_torch', icon: '🔥', goal: '合成 4 支火把', target: 4,
    hint: '用煤和木棍合成火把，山洞里就不怕黑啦！',
    praise: '火把做好啦！你想得真周到！',
    prog: (c) => Math.min(c.craft_torch || 0, 4), check: (c) => (c.craft_torch || 0) >= 4},
  {id: 'q9_iron', icon: '🟠', goal: '挖 5 块铁矿', target: 5,
    hint: '铁矿藏在更深的地方，带上火把去挖 5 块！',
    praise: '铁矿挖够啦！你真勇敢！',
    prog: (c) => Math.min(c.mine_iron_ore || 0, 5), check: (c) => (c.mine_iron_ore || 0) >= 5},
  {id: 'q10_smelt', icon: '♨️', goal: '放下熔炉，烧出 3 块铁锭', target: 4,
    hint: '用圆石合成熔炉放下来，把铁矿烧成铁锭！',
    praise: '铁锭烧好啦！等一等就有收获，你真有耐心！',
    prog: (c) => Math.min(c.place_furnace || 0, 1) + Math.min(c.smelt_iron_ingot || 0, 3),
    check: (c) => (c.place_furnace || 0) >= 1 && (c.smelt_iron_ingot || 0) >= 3},
  {id: 'q11_pick_iron', icon: '⛏️', goal: '合成铁镐', target: 1,
    hint: '用铁锭合成铁镐，最硬的矿石也能挖啦！',
    praise: '铁镐做好啦！钻石就在不远处等你！',
    prog: (c) => Math.min(c.craft_pick_iron || 0, 1), check: (c) => (c.craft_pick_iron || 0) >= 1},
  {id: 'q12_diamond', icon: '💎', goal: '挖到 3 颗钻石', target: 3,
    hint: '去山洞最深处找亮晶晶的钻石，挖 3 颗！',
    praise: '钻石挖够啦！你坚持到了最后，真了不起！',
    prog: (c) => Math.min(c.mine_diamond_ore || 0, 3), check: (c) => (c.mine_diamond_ore || 0) >= 3},
  {id: 'finale', icon: '🗡️', goal: '合成钻石剑', target: 1, finale: true,
    hint: '用 2 颗钻石和 1 根木棍，合成属于你的钻石剑！',
    praise: '钻石剑做好啦！',
    prog: (c) => Math.min(c.craft_sword_diamond || 0, 1), check: (c) => (c.craft_sword_diamond || 0) >= 1},
];

let advQuestT = 0; /* 谓词检查节流计时(init 复位一个整窗, 首查在进场半秒后) */

function advTally(kind, n) {/* 任务计数: 事件挂点只 += 不做判断(推进归 advQuestTick 节流查);
   counts 只增不减 = 跳步防护(计数依赖事件, 不可逆); 顺路挂脏标记随 5s 存档节流落盘 */
  ADV.quest.counts[kind] = (ADV.quest.counts[kind] || 0) + n;
  advDirty = true;
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
  sfx('gem');
  Fx.pop(x + 0.5, y + 1.1, z + 0.5, {color: 0x4ee1d2, r0: 0.3, r1: 2.4, dur: 0.7});
  Fx.pop(x + 0.5, y + 1.1, z + 0.5, {color: 0xffd23f, r0: 0.2, r1: 1.6, dur: 0.9, opacity: 0.7});
  Fx.debrisBurst(x + 0.5, y + 1.2, z + 0.5, 10, {color: 0x4ee1d2, life: 1.3});
  for (let i = 0; i < 3; i++) {
    Fx.arc(x + 0.5, y + 1.4 + i * 0.5, z + 0.5, {color: 0xffd23f, dur: 0.3, spread: 1.2, pts: 5});
  }
  SpeechKit.speak('哇！挖到钻石啦！亮晶晶的宝贝！你找得真仔细！');
  showToast('💎 第一颗钻石！一共要挖 3 颗哦！');
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
  const q = ADV_QUESTS[st.step];
  if (!q || !q.check(st.counts)) return;
  sfx(q.finale ? 'win' : 'level');
  showToast('✅ ' + q.icon + ' ' + q.goal + ' 完成！');
  if (q.finale) {/* 终章: 称号入档(step 走到表外不再查) + 烟花, 重进不重复授予 */
    st.title = ADV_QUEST_TITLE;
    SpeechKit.speak(q.praise + '你获得了「' + ADV_QUEST_TITLE + '」称号！为你放烟花！');
    showToast('🏅 获得称号：' + ADV_QUEST_TITLE + '！');
    advFireworks();
  } else {
    const nxt = ADV_QUESTS[st.step + 1];
    SpeechKit.speak(q.praise + (nxt ? ' 接下来：' + nxt.hint : ''));
    if (nxt) showToast(nxt.icon + ' 新任务：' + nxt.goal);
  }
  st.step += 1;
  advQuestSlot.save(st);
  advQuestPaint();
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
}
function advQuestEl() {/* 任务卡容器只读引用(单测触达面) */
  return advPanel.questEl;
}

/* ============================================================
   模式对象
   ============================================================ */
const AdventureMode = mkMode({
  id: 'adventure',

  hotbar: advHb, /* 快捷栏 9 item 型槽(镜像背包, 数字键/滚轮/点选全自动) */
  chrome: {score: 'none', hotbar: 'flex'},

  init() {
    advEdits = advWorldSlot.load().edits;
    /* 空存档时 load() 返回 defaults 深拷贝(edits 是数组, 不经 decode) → 归一化成 Map */
    if (!(advEdits instanceof Map)) advEdits = new Map(advEdits || []);
    ADV.quest = advQuestSlot.load();
    /* T15 归一化: 老档 {step:N} 无 counts(或损坏) → 补空表, 当前步从零累计——
       历史计数不追溯(玩家挖过什么无法从世界状态重建); step 钳进表界(表外=终章完成) */
    if (!ADV.quest.counts || typeof ADV.quest.counts !== 'object') ADV.quest.counts = {};
    ADV.quest.step = Math.max(0, Math.min(ADV.quest.step | 0, ADV_QUESTS.length));
    advQuestT = ADV_QUEST_CHECK_T; /* 谓词检查节流复位(进场半秒后首查) */
    advQuestPaint();
    advInv.slots = advInvSlot.load().slots; /* 原地换槽, 面板/快捷栏闭包不脱钩 */
    loadScene(() => {/* 场景装填 seam: 清场→建场→收尾入队一步到位 */
      advBuildWorld();
      for (const [k, v] of advEdits) {
        const p = k.split(',');
        setBlockRaw(+p[0], +p[1], +p[2], v);
      }
      advRescanSaplings(); /* 世界里的树苗重挂 20s 计时(计时 Map 不落盘) */
      advRescanStations(); /* 已放置站点收进缓存(T13: edits 重放收集, O(edits)) */
    });
    ModeKit.spawn(ADV_SPAWN.x, ADV_SPAWN.y, ADV_SPAWN.z, {yaw: ADV_SPAWN.yaw});
    flyMode = false; /* 探险步行(不沿用建造的飞行) */
    Avatar.setItem(PLAYER.heldItem);
    ADV.panelOpen = false;
    ADV.furnaceOpen = false; /* T13 熔炉面板/炉态/引信全部复位 */
    advFurnaceZero();
    advFuses.length = 0;
    advTableNear = false;
    advMineStop(); /* 蓄力状态复位(上次退出可能按住) */
    advMouseListeners(true); /* 桌面按住连挖检测(capture) */
    advSyncHotbar();
    /* —— 巢穴战斗段(T14): 清残留 → 重挂引擎回调(clear 会解除, 每次进场重挂) → 三巢首刷 */
    Mobs.clear();
    Drops.clear(); /* 重进清残留掉落物(挖掘/击杀两链共用; 并解除旧收集回调) */
    while (advArrows.length) advRemoveArrow(0); /* 上一场的箭不渗进来 */
    ADV.killCount = 0; ADV.swingCd = 0;
    advHurtT = 0;
    advPickBuf.clear(); advPickT = 0;
    advNestT.fill(0);
    const pe = advGetPEnt(); /* 进场满血(不带上一次退出时的残血) */
    pe.hp = pe.maxHp; ADV.player.hp = ADV.player.maxHp;
    Mobs.onDeath((m) => {/* 击杀掉落链路(D6): 掷骰→逐条 spawn(尸体落点上方 0.8) */
      for (const s of advDeathDrops(m)) Drops.spawn(s.id, s.n, s.x, s.y, s.z);
    });
    Drops.onCollect((id, n) => {/* 收集并线(T12×T14): 入包/镜像/逐件 toast(T12) → 3s 合并播报窗(T14) */
      if (!advOnCollect(id, n)) return false; /* 满包拒返 false → 1.2s 冷却重试(D6) */
      advPickBuf.set(id, (advPickBuf.get(id) || 0) + n); /* 并入 3s 合并播报窗 */
      advPickT = ADV_PICKUP_WINDOW;
    });
    for (let i = 0; i < ADV_NESTS.length; i++) advSpawnNest(i);
    const qNow = ADV_QUESTS[ADV.quest.step]; /* 进场欢迎句带上当前步引导(hint 并句, 防 cancel 打断;
        「小小探险家」字样留给终章称号的仪式感) */
    SpeechKit.speak('欢迎来到探险草原！' + (qNow ? qNow.hint : '任务全部完成啦，自由探险咯！'));
    showToast('🌲 探险草原 · 按 Tab 或点 🎒 打开背包');
  },

  cleanup() {
    advFurnaceReset(true); /* 退世界清炉(D8): 材料全额退背包并随下方落盘; 满包余量掉脚边,
       随 Drops.clear 清场不跨模式渗漏(背包仍满属极端角例, 弃损不渗漏) */
    advSaveNow();
    Mobs.clear(); /* 清怪+解除击杀回调: 不渗进其他模式 */
    Drops.clear(); /* 清掉落物+解除收集回调 */
    while (advArrows.length) advRemoveArrow(0); /* 箭矢网格一并摘除 */
    ADV.panelOpen = false;
    ADV.furnaceOpen = false;
    advPanel.remove(); /* 卸载面板 DOM */
    advFurnacePanel.remove(); /* T13: 熔炉面板一并卸载 */
    Avatar.setItem(PLAYER.heldItem); /* 手持物复位(Avatar 跨模式存活) */
    advMouseListeners(false);
    advMineStop(); /* 蓄力清零 + 进度环收起 */
    advSaplings.clear(); /* 计时不落盘, 重进经全图扫描重建 */
    advFuses.length = 0; /* 引信不落盘 */
    advStations.clear(); /* 站点缓存重进由 advRescanStations 重建 */
    advTableNear = false;
    advTierT = 0;
    advRingDispose();
    advDisposeHpBar();
  },

  update(dt) {
    if (advDirty && performance.now() - advSaveT > 5000) {/* 世界存档节流(build 同款) */
      advSaveT = performance.now();
      advSaveNow();
    }
    advTierT = Math.max(0, advTierT - dt); /* tier 提示节流递减(T12) */
    advStationTick(); /* 站点沿检测: 首次靠近工作台 TTS 引导 + 开面板亮灰刷新(T13) */
    advQuestTick(dt); /* 任务链推进: 节流查当前步谓词, 完成走表扬/引导/落盘(T15) */
    advFurnaceTick(dt); /* 烧炼节律常开(面板只是回显), ✕ 关闭对账(T13) */
    advFuseTick(dt); /* TNT 引信倒计时到点起爆(T13, 先于怪物 AI——当帧爆炸位置不漂移) */
    advMineTick(dt); /* 挖掘蓄力: 进度环+挥动循环+到点破坏(T12) */
    advSapTick(dt); /* 树苗 20s 计时到期长树(T12) */
    if (ADV.swingCd > 0) ADV.swingCd = Math.max(0, ADV.swingCd - dt); /* 挥击冷却(T14) */
    advHurtT = Math.max(0, advHurtT - dt); /* 受击语音节流递减(T14) */
    advMobAI(dt); /* 巢穴怪物: 索敌/攻击/收队(nether 同骨架) */
    Mobs.update(dt);
    Mobs.render();
    advUpdateArrows(dt); /* 骷髅箭矢弹道 */
    Drops.update(dt, {x: pos.x, y: pos.y + PLAYER.height * 0.62, z: pos.z}); /* 真空拾取(挖掘/击杀两链共用, 玩家胸口点) */
    Drops.render();
    advNestTick(dt); /* 巢穴节律: 全清 60s 再刷(每巢独立计时) */
    advPickupTick(dt); /* 收集播报合并窗 */
    advUpdateHpBar();
  },

  onMouse(button, hit) {/* 左键并线(T12×T13×T14): TNT 点击点燃/熔炉走近点击开面板(T13, 准星块
    精确命中故在最前), 准星锥内有活怪→挥击(T14), 否则吃/挖掘蓄力(T12); 右键放置 */
    if (ADV.panelOpen || ADV.furnaceOpen) return; /* 面板遮罩兜底: 开面板不挖不放不打 */
    if (button === 0) {
      const lookId = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
      if (lookId === B_TNT) {/* TNT: 手持任意, 点击点燃(T13 拦截在最前——B_TNT 无 hard 不可挖) */
        advIgnite(hit.x, hit.y, hit.z);
        return;
      }
      if (lookId === B_FURNACE) {/* 熔炉交互: 走近 4 格点击开面板; 太远只提示不误挖 */
        if (advNearStation(advStations.values(), pos.x, pos.z, ADV_STATION_R, B_FURNACE)) {
          advFurnaceOpenPanel();
        } else {
          showToast('♨️ 走近一点就能用熔炉啦');
        }
        return;
      }
      if (advAimMob(advGetPEnt())) {/* 锥内有活怪: 本击归战斗(冷却中也占住, 不落挖) */
        advAttack();
        return;
      }
      if (advTryEat()) return; /* 手持食物: 点击吃, 不进蓄力 */
      if (hit) advMine.down = true; /* 准星指住方块: 蓄力开始(推进在 update) */
    } else if (button === 2) {
      advTryPlace(hit);
    }
  },

  onKey(code) {
    if (code === 'Tab') {
      if (ADV.furnaceOpen) {/* 熔炉开着先收熔炉(两块 body 级遮罩不叠层) */
        advFurnaceClose();
        return;
      }
      advPanelToggle(); /* 🎒/Tab 开关背包+配方书 */
    }
  },

  onVoidFall() {/* 坠出世界: 与死亡同一零惩罚出口(T14 的致命一击走 advPlayerDied) */
    advPlayerDied();
  },

  onMenu() {/* Esc/B 回出发页: 先收面板再翻页(面板是 body 级遮罩, 不收会叠在菜单上) */
    if (ADV.furnaceOpen) advFurnaceClose();
    if (ADV.panelOpen) advPanelToggle();
    showPage('adventure');
  },

  hud(hit) {
    const s = advInv.slots[advHb.sel];
    const q = ADV_QUESTS[ADV.quest.step];
    const qTxt = q ? q.icon + ' ' + q.goal + ' ' + Math.min(q.prog(ADV.quest.counts), q.target) + '/' + q.target :
        (ADV.quest.title ? '🏅 ' + ADV.quest.title : '全部完成 🎉');
    const alive = Mobs.list().filter((m) => !m.dead && !m.gone).length;
    return [
      `❤️ 生命: ${Math.max(0, Math.ceil(advGetPEnt().hp))} / ${ADV.player.maxHp}`,
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      `👾 怪物: ${alive} · ☠️ 击杀: ${ADV.killCount}`,
      `🎒 背包: Tab / 🎒 · 手上: ${s ? ((ITEMS[s.id] && ITEMS[s.id].name) || s.id) : '空手'}`,
      `📖 任务: ${qTxt}`,
      `注视: ${ModeKit.lookName(hit)} · B 菜单`,
    ];
  },

  touch: [
    {label: '⬆️', hold: 'Space'},
    {label: '⛏️', act: () => doCenterClick(0)}, /* 准星点击(arena 先例): 开始蓄力挖 */
    {label: '🧱', act: () => doCenterClick(2)}, /* 准星放置(手持放置型物品) */
    {label: '🎒', act: () => advPanelToggle()},
    {label: '👾', act: () => advAttack()},
  ],
});

/* T12~T15 的接线挂点(内部接口, 不进模式公共行为; 单测亦经此触达常量与纯函数段):
    T12 已落地(蓄力/放置/树苗/食物纯函数与交互, 站点/TNT 放置复用 advTryPlace) ·
    T13 已落地(站点判定/烧炼节律/退炉政策/TNT 掷骰纯函数 + advStationOk 真判定/
    advOnCraft 表扬链/熔炉状态机与面板/TNT 引信爆炸; TNT 点燃与熔炉开面板在
    onMouse 左键最前拦截) ·
    T14 已落地(巢穴节律/挥击伤害/掉落清单/播报文案纯函数 + ADV.killCount 击杀账本,
    击杀挂 Mobs.onDeath; 左键语义与挖掘在 onMouse 并线: 准星锥内有怪=挥击,
    否则让位挖掘/放置) ·
    T15 已落地(ADV_QUESTS 12 步+终章数据表与谓词纯函数 + ADV.quest.counts 事件
    计数账本, 挂点=advBreakBlock 尾部/advOnCollect/advOnCraft/advTryPlace/
    advFurnaceTick 产出分支五处只 +=; 推进=update 内 advQuestTick 0.5s 节流
    只查当前步; 任务卡=advQuestPaint 挂 advPanel.questEl; 仪式=advDiamondRite
    首获专属/advFireworks 终章烟花) */
AdventureMode.adv = {ADV, ADV_NESTS, ADV_QUESTS, advDeathPlan, advMarkEdit, advGetInv: () => advInv,
  advGetPEnt, advPlayerDied, advPanelToggle, advSyncHotbar, advQuestEl, advQuestPaint,
  advNestCount, advNestStep, advSwingDmg, advDeathDrops, advPickupText,
  advMineStep, advPlaceCheck, advEatPolicy, advSapDue, advMine, advSaplings, advBreakBlock,
  advTryPlace, advGrowTree, advMineStop,
  advNearStation, advStationOk, advOnCraft, advSmeltStep, advFurnaceRefund,
  advTntRoll, advTntDmg, advFurnace, advFurnaceAutoFill, advFurnaceOpenPanel,
  advFurnaceClose, advIgnite, advFuses, advStations};

if (typeof module !== 'undefined' && module.exports) module.exports = AdventureMode;
