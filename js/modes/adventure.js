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
   合成站点解锁(T13)/任务链 12 步(T15) 依次接线。
   · 玩家: 出生小屋门口 · 步行(不飞行) · 血量 30 + 头顶血条; 死亡=背包
     保留+回出生点满血+TTS 安抚(下界先例口径, 零惩罚哲学)。
   · T12 挖掘与采集(D4/D7): 按住蓄力(准星进度环+挥动循环+换目标/松手
     清零, breakTime 驱动) → 破坏碎屑+记账+rollBlockDrop 掉落真空拾取;
     tier 不足只碎不掉+TTS 节流; 放置型物品点准星面(editBlock+背包−1),
     thin 块(火把/树苗)只放实心面顶; 树苗放草地/泥土 20s 长成(计时 Map
     不落盘, 重进全图重建); 草丛确定性散布(挖掉 50% 掉种子); 食物点击吃
     (advEatPolicy, 腐肉同口径); 工具破坏成功耐久 −1, 归零消失+安抚。
   · 三份存档: inventory_save(全局唯一背包, 跨模式共享) /
     adventure_world_save(场景确定性重建+edits 重放, build 模式同款) /
     adventure_quest_save({step:0} 占位, T15 填)。
   · 防沉迷: 与竞技场/TNT/建造/坦克/下界共享儿童时限(gated, 不新增账本)。
   interface: AdventureMode(mkMode 深接口: init/cleanup/update/onKey/onMouse/
     hud/touch) · AdventureMode.adv — T12~T15 接线挂点与单测触达面(常量表/
     死亡+蓄力+放置+食物+树苗+巢穴节律纯函数/挥击伤害/掉落清单/播报文案/
     edits 记账/背包只读)
   依赖(均经全局名, 调用期解析): config.js 的 BLOCKS/PLAYER/WORLD 尺寸/
     B_* 常量 · voxel.js 的 getBlock/setBlockRaw/blockKey/raycastVoxel/
     collidesAtPlayer · world.js 的 loadScene/editBlock · scene-kit.js 的
     SceneKit · items-core 的 ITEMS/isTool/toolOf · inventory-core 的
     mkInventory/HOTBAR_SLOTS/INV_SLOTS/add/remove/damageTool/serialize/
     deserialize · craft-core 的 breakTime/RECIPES(面板缺省全表) ·
     drops.js 的 rollBlockDrop/rollDrops(纯)/spawn/update/onCollect/clear ·
     mobs.js 的 spawn/hit/onDeath/update/render/steer/move/gait/debrisColor/
     clear(退出清场) · combat-core.js 的 CombatCore(节拍/弹道/盒判定) ·
     effects.js 的 sfx/Fx · input.js 的 doCenterClick(触屏准星点击) ·
     mode-kit.js 的 mkMode/mkHotbar/mkCraftPanel · sync.js 的 SyncDB.slot ·
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
  player: {hp: 30, maxHp: 30}, quest: {step: 0}, panelOpen: false,
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
const advQuestSlot = SyncDB.slot(ADV_QUEST_KEY, {defaults: {step: 0}}); /* T15 填任务进度 */

let advEdits = new Map(); /* 玩家方块改动 "x,y,z"→id(只存差异, 重进重放) */
let advDirty = false;
let advSaveT = 0;

function advMarkEdit(x, y, z, id) {/* T12 挖掘/放置在 editBlock 后调此记账(build 同款) */
  advEdits.set(blockKey(x, y, z), id);
  advDirty = true;
}
function advSaveNow() {
  advWorldSlot.save({edits: advEdits});
  advInvSlot.save(advInv);
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

/* ---------- 背包+配方书面板(T10 mkCraftPanel, 本单只挂上) ---------- */
function advStationOk() {/* 站点解锁判定归 T13: 放置工作台/熔炉走近 4 格才亮 table 级卡片 */
  return true; /* 骨架期背包为空无卡可点, 恒 true 不影响行为 */
}
function advOnCraft(out) {/* 合成回调占位: T13 接 TTS 表扬+leftover 转掉落物 */
  advSyncHotbar();
  showToast('✅ ' + ((ITEMS[out.item] && ITEMS[out.item].name) || out.item) + ' 做好啦！');
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
  if (!advMine.down || ADV.panelOpen) {
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
    advInv.slots = advInvSlot.load().slots; /* 原地换槽, 面板/快捷栏闭包不脱钩 */
    loadScene(() => {/* 场景装填 seam: 清场→建场→收尾入队一步到位 */
      advBuildWorld();
      for (const [k, v] of advEdits) {
        const p = k.split(',');
        setBlockRaw(+p[0], +p[1], +p[2], v);
      }
      advRescanSaplings(); /* 世界里的树苗重挂 20s 计时(计时 Map 不落盘) */
    });
    ModeKit.spawn(ADV_SPAWN.x, ADV_SPAWN.y, ADV_SPAWN.z, {yaw: ADV_SPAWN.yaw});
    flyMode = false; /* 探险步行(不沿用建造的飞行) */
    Avatar.setItem(PLAYER.heldItem);
    ADV.panelOpen = false;
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
    SpeechKit.speak('欢迎来到探险草原！你是小小探险家！');
    showToast('🌲 探险草原 · 按 Tab 或点 🎒 打开背包');
  },

  cleanup() {
    advSaveNow();
    Mobs.clear(); /* 清怪+解除击杀回调: 不渗进其他模式 */
    Drops.clear(); /* 清掉落物+解除收集回调 */
    while (advArrows.length) advRemoveArrow(0); /* 箭矢网格一并摘除 */
    ADV.panelOpen = false;
    advPanel.remove(); /* 卸载面板 DOM */
    Avatar.setItem(PLAYER.heldItem); /* 手持物复位(Avatar 跨模式存活) */
    advMouseListeners(false);
    advMineStop(); /* 蓄力清零 + 进度环收起 */
    advSaplings.clear(); /* 计时不落盘, 重进经全图扫描重建 */
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

  onMouse(button, hit) {/* 左键并线(T12×T14): 准星锥内有活怪→挥击(T14, 无怪不出手不占冷却), 否则吃/挖掘蓄力(T12); 右键放置 */
    if (ADV.panelOpen) return; /* 面板遮罩兜底: 开面板不挖不放不打 */
    if (button === 0) {
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
    if (code === 'Tab') advPanelToggle(); /* 🎒/Tab 开关背包+配方书 */
  },

  onVoidFall() {/* 坠出世界: 与死亡同一零惩罚出口(T14 的致命一击走 advPlayerDied) */
    advPlayerDied();
  },

  onMenu() {/* Esc/B 回出发页: 先收面板再翻页(面板是 body 级遮罩, 不收会叠在菜单上) */
    if (ADV.panelOpen) advPanelToggle();
    showPage('adventure');
  },

  hud(hit) {
    const s = advInv.slots[advHb.sel];
    const alive = Mobs.list().filter((m) => !m.dead && !m.gone).length;
    return [
      `❤️ 生命: ${Math.max(0, Math.ceil(advGetPEnt().hp))} / ${ADV.player.maxHp}`,
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      `👾 怪物: ${alive} · ☠️ 击杀: ${ADV.killCount}`,
      `🎒 背包: Tab / 🎒 · 手上: ${s ? ((ITEMS[s.id] && ITEMS[s.id].name) || s.id) : '空手'}`,
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
    T13 站点判定在 advStationOk(替换恒 true) · T14 已落地(巢穴节律/挥击伤害/
    掉落清单/播报文案纯函数 + ADV.killCount 击杀账本, 击杀挂 Mobs.onDeath;
    左键语义与挖掘在 onMouse 并线: 准星锥内有怪=挥击, 否则让位挖掘/放置) ·
    T15 任务进度挂 ADV.quest(advQuestSlot 落盘), 击杀/掉落事件挂点 =
    advOnKill(观感+计数) 与 init 里的 onDeath/收集回调两处闭包 */
AdventureMode.adv = {ADV, ADV_NESTS, advDeathPlan, advMarkEdit, advGetInv: () => advInv,
  advGetPEnt, advPlayerDied, advPanelToggle, advSyncHotbar,
  advNestCount, advNestStep, advSwingDmg, advDeathDrops, advPickupText,
  advMineStep, advPlaceCheck, advEatPolicy, advSapDue, advMine, advSaplings, advBreakBlock,
  advTryPlace, advGrowTree, advMineStop};

if (typeof module !== 'undefined' && module.exports) module.exports = AdventureMode;
