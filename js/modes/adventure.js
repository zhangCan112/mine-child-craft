'use strict';
/* ============================================================
   探险模式 (AdventureMode) — 应用层·模式壳
   ------------------------------------------------------------
   物品与合成系统的第一个消费者(设计稿 D11)。本文件是壳: mkMode 装配 /
   THREE·DOM 观感 / 话术与 toast / 生命周期与存档; 全部政策纯函数段、
   地形生成与任务表在 js/adventure-core.js(先于本文件加载, 经共享词法
   环境直用, 政策口径以其头注释与段注释为权威——此处只留指针):
   · 地形: 128×128 确定性草原(advBuildWorld 一族)——树林 ~40 · 湖(湖底
     黏土, 红砖链源头) · 2 露天矿坑 · 山洞隧道通 y<10 钻石带 · 出生小屋
     (站点件不送, 任务链做出来才有仪式感) · 3 怪物巢穴 · 草丛散布
   · 玩家: 出生小屋门口 · 步行(不飞行) · 血量 30 + 头顶血条(mkHpBar);
     死亡 = 背包保留 + 回出生点满血 + TTS 安抚(advDeathPlan, 零惩罚哲学)
   · 挖掘与采集(T12, D4/D7): 按住蓄力(breakTime 驱动, 准星进度环+挥动
     循环) → 掉落真空拾取; tier 不足只碎不掉 + TTS 节流; 放置型点准星面;
     树苗 20s 长成(计时 Map 不落盘, 重进重建); 食物点击吃; 工具耐久归零
     消失 + 安抚 TTS 并句当前任务步指路(S4③)
   · 合成与烧炼(T13, D8): 工作台/熔炉放置后走近 4 格解锁(站点坐标缓存);
     合成成功 TTS 具体表扬 + leftover 转脚下掉落物; 熔炉 2.5s/件自动
     烧炼(关面板进度保留, 退世界/死亡全额退料); TNT 合成→放置→点燃→
     延时爆炸(不伤玩家——儿童挖矿神器)
   · 巢穴战斗(T14, D6/D11/D9): 每巢限量 2~3 只 · 清空 60s 再刷 · 索敌
     收敛不追出巢区; 击杀掉落(rollDrops) + 收集 3s 合并播报; 玩家战斗
     (nether 同骨架 AI, 单击伤害封顶 10)
   · 任务链(引导链 v2): 15 步+终章(安家/挖矿/冶炼/冒险四章, 12 步版与
     插步依据见 docs/story-quest-research.md), 事件挂点只往计数账本累计
     (只增不减=跳步防护), update 内 0.5s 节流查当前步谓词(不越级);
     钻石首获仪式; 终章合成钻石剑 → 「小小探险家」称号+烟花;
     任务卡挂 advPanel.questEl
   · 大宝箱(引导链 v2 拍板): 全局共享账户——所有放置的箱子同一份存储
     (adventure_chest_save), 只储物不解锁配方(合成仍要工作台); 点击放置
     的箱子(走近 4 格, 熔炉同款)开 mkChestPanel 点选搬运; 9/18/27 三档
     材料扩容, 政策纯函数 advChestNext/advChestPut 在 adventure-core
   · 提醒政策(S4): 低耐久语音预警(耐久比首次 <0.25, 每工具每命一次,
     破板即重置) · 背包快满一次性 toast+TTS(占用槽 ≥24/27, 回落再满才
     再提醒; 放过箱子后话术指向收纳)——判据纯函数
     advWearWarn/advBagFullStep/advBreakToolText
   · 四份存档: 全局唯一背包存档键经背包壳 js/backpack.js 唯一持有
     (ADR 0002, 跨模式共享背包) / adventure_world_save(场景确定性重建+
     edits 重放, build 模式同款) / adventure_quest_save({step,counts,title?})
     / adventure_chest_save({size, slots} 大宝箱全局账户)
   · 防沉迷: 与竞技场/建造/坦克/下界共享儿童时限(gated, 不新增账本)
   interface: AdventureMode(mkMode 深接口: init/cleanup/update/onKey/
     onMouse/hud/touch) · AdventureMode.adv — 接线挂点与单测触达面
     (状态账本/存档 seam/交互链入口, 及 adventure-core 常量表与纯函数
     的转发)
   依赖(均经全局名, 调用期解析): adventure-core 的常量表与政策纯函数 ·
     backpack.js 的 Backpack · config.js 的 BLOCKS/PLAYER/B_* 常量 ·
     voxel.js 的 getBlock/blockKey/raycastVoxel/collidesAtPlayer ·
     world.js 的 loadScene/editBlock · items-core 的 ITEMS/isTool/toolOf ·
     inventory-core 的 add/count/remove/take/damageTool · craft-core 的
     breakTime/fuelUnits · drops.js 的 rollBlockDrop/rollDrops(纯)/
     spawn/update/onCollect/clear · mobs.js 的 spawn/hit/onDeath/update/
     render/steer/move/gait/debrisColor/clear(退出清场) · combat-core.js
     的 CombatCore(节拍/弹道/盒判定) · effects.js 的 sfx/Fx(boom/arc/
     pop/debrisBurst 爆炸·引信·仪式观感) · input.js 的 doCenterClick ·
     mode-kit.js 的 mkMode/mkHotbar/mkCraftPanel/mkFurnacePanel/
     mkChestPanel(大宝箱)/mkHpBar(头顶血条, S2) · sync.js 的 SyncDB.slot · speech.js 的
     SpeechKit · avatar.js 的 Avatar(setItem/swing/flash)
   可测性: THREE/DOM 惰性创建(头顶血条/箭矢网格/进度环), Node 测试可
     安全加载(test/adventure-mode.test.js, 真引擎件经 vm 装载)
   ============================================================ */

/* ---------- 模式状态账本(常量表与政策纯函数在 adventure-core.js) ---------- */
const ADV = {ground: ADV_GROUND, spawn: ADV_SPAWN, hut: ADV_HUT, lake: ADV_LAKE,
  pits: ADV_PITS, cave: ADV_CAVE, nests: ADV_NESTS,
  player: {hp: 30, maxHp: 30}, quest: {step: 0, counts: {}}, panelOpen: false, furnaceOpen: false,
  chestOpen: false, killCount: 0, swingCd: 0, homeCd: -1e9};

/* ---------- 世界/任务两份存档(D12): mkSaveSlot 语义, SyncDB 槽创建即注册回填 ----------
    全局唯一背包存档不在此开键——经背包壳 js/backpack.js 唯一持有
    (ADR 0002: 专注训练营等未来消费方同走该壳, 不得自开键) */
const ADV_WORLD_KEY = 'adventure_world_save';
const ADV_QUEST_KEY = 'adventure_quest_save';
const advWorldSlot = SyncDB.slot(ADV_WORLD_KEY, {
  defaults: {edits: []},
  encode: (st) => ({edits: [...st.edits.entries()]}),
  decode: (sv) => ({edits: new Map(sv.edits || [])}),
});
/* T15 任务进度: mkSaveSlot defaults 只补缺失字段——老档 {step:N} 自动补空 counts */
const advQuestSlot = SyncDB.slot(ADV_QUEST_KEY, {defaults: {step: 0, counts: {}}});
/* 引导链 v2 大宝箱: 全局共享账户(所有放置的箱子同一份存储; 挖掉箱子内容
   保留在账户里, 零损失)——defaults 只补缺失字段, init 归一化成满长槽数组 */
const ADV_CHEST_KEY = 'adventure_chest_save';
const advChestSlot = SyncDB.slot(ADV_CHEST_KEY, {defaults: {size: ADV_CHEST_START, slots: []}});
let advChest = {size: ADV_CHEST_START, slots: []}; /* 账户本体(init 换装) */

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
  advBag.save(); /* 背包存档经背包壳(ADR 0002), 形状与时机不变 */
  advQuestSlot.save(ADV.quest); /* T15: 任务进度随 5s 节流一起落盘(步进时另有即时落盘) */
  advDirty = false;
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
  onClose: () => advPanelClose(), /* ✕/Esc 统一出口: 状态同步 + 指针回锁(修: 曾直 hide 卡 panelOpen=true) */
  onSort: () => {
    advSyncHotbar();
    showToast('🧹 整理好啦！');
  },
});
const advFurnacePanel = ModeKit.mkFurnacePanel({inv: advInv, onAutoFill: advFurnaceAutoFill,
  onClose: () => advFurnaceClose()});
/* 大宝箱面板(引导链 v2): 政策与存档在本文件下方箱子段, 面板只管格子 */
const advChestPanel = ModeKit.mkChestPanel({inv: advInv, chest: () => advChest,
  next: () => advChestNext(advChest.size), have: (id) => count(advInv, id),
  onPut: (i) => advChestDeposit(i), onTake: (i) => advChestWithdraw(i),
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

/* ---------- 头顶血条: mode-kit mkHpBar 深接口(S2, 探险/下界两模式同形归一) ----------
    每帧喂 {hp, maxHp, 世界坐标}(头顶 2.2 格), 重绘节流收在深接口 */
const advHpBar = ModeKit.mkHpBar();

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
  const r = advBagFullStep(used, advBagArmed);
  advBagArmed = r.armed;
  if (r.fire) {
    /* 引导链 v2 联动: 已放置过箱子(任务链教过的收纳机制)→提醒指向箱子,
       否则维持合成出口——提醒复用玩家已被教过的机制, 不引入新知识 */
    if ((ADV.quest.counts.place_chest || 0) >= 1) {
      SpeechKit.speak('背包快满啦，把宝贝放进箱子里吧！');
      showToast('🎒 背包快满啦，把宝贝放进箱子里吧');
    } else {
      SpeechKit.speak('背包快满啦，去合成一些吧！');
      showToast('🎒 背包快满啦，去合成一些吧');
    }
  }
}

/* ============================================================
   巢穴战斗壳段 (T14) — 刷怪节律 / 玩家战斗 / 怪物 AI / 箭矢 / 收集
   (常量与节拍/伤害/掉落/播报纯函数在 adventure-core.js)
   ============================================================ */
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
  advWearHeld('hit'); /* 命中才扣耐久(空手/非工具不扣) */
  if (r.freshDead) advOnKill(m);
}
/* 手持工具耐久结算(S3 合一: 原 advWearTool(命中)/advDamageHeld(挖掘)两份
   同形实现合并, 来源参数 src 只剩标注用途——行为同一: damageTool 返 0 =
   破板信号(inventory-core 口径) → remove 清槽 + 安抚 TTS 并句当前任务步
   指路(S4③, advBreakToolText) + 观感回落锄头 + 预警账本重置; 非破板顺路
   做低耐久语音预警(S4①: 耐久比首次 <0.25, 每工具每命一次, 破板即重置) */
function advWearHeld(src) {
  const slot = advHb.sel;
  const s = advInv.slots[slot];
  const left = damageTool(advInv, slot);
  if (left === 0) {/* 破板: 工具 n=1 整槽消失(D4/D9), 话术并句任务指路 */
    const name = (ITEMS[s.id] && ITEMS[s.id].name) || s.id;
    const q = ADV_QUESTS[ADV.quest.step];
    remove(advInv, slot);
    advWarnLow.delete(s.id); /* 断掉即重置: 再做一把同款还能再预警(S4①) */
    Avatar.setItem(PLAYER.heldItem); /* 观感回落锄头(槽已空, 命中/挖掘两路同一政策) */
    SpeechKit.speak(advBreakToolText(name, q ? q.hint : null));
    showToast('💔 ' + name + ' 用坏了，再做一把更棒的吧！');
  } else if (left != null && s) {/* 未破: 低耐久预警判据(S4①, 空手/非工具 left=null 不进) */
    const t = toolOf(s.id);
    if (t && advWearWarn(advWarnLow, s.id, (s.dur || 0) / t.dur)) {
      SpeechKit.speak(((ITEMS[s.id] && ITEMS[s.id].name) || s.id) + '快没劲啦，记得再做一把新的哦！');
    }
  }
  advSyncHotbar();
}
function advOnKill(m) {/* 击杀观感(nether 先例): 碎块+计数 toast; 掉落在 onDeath 回调;
   任务记账只认亲手击杀(挥击/箭/TNT 三路都经此—— TNT 掀方块不算挖掘, 但炸死怪物算战果) */
  ADV.killCount++;
  advTally('kill_mob', 1); /* 引导链 v2: 战斗教学步(铁镐后钻石前) */
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

/* 死亡结算(T14 致命一击/坠出世界共用): 政策纯函数 advDeathPlan(core);
   只动玩家状态与位置, 背包一个不动 */
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

/* ---------- 回小屋(受困逃生口, 2026-10-23 玩法实测补): 自挖竖井/TNT 弹坑
   可能困住玩家(跳跃 1.42 格 < 2 格直壁), 与死亡同一传送口径但零惩罚措辞;
   60s 冷却防滥用(躲怪用)。ADV_HOME_CD 与 advHomeReady 纯函数供单测。 */
const ADV_HOME_CD = 60;
function advHomeReady(cd, now) {
  return now - cd >= ADV_HOME_CD;
}
function advGoHome() {
  const now = typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000;
  if (!advHomeReady(ADV.homeCd, now)) {
    showToast('🏠 小屋还在休息, 稍等一下哦'); return;
  }
  ADV.homeCd = now;
  const e = advGetPEnt();
  e.hp = e.maxHp; ADV.player.hp = ADV.player.maxHp; /* 顺带回满血(回家=安全休整, nether 先例) */
  ModeKit.spawn(ADV.spawn.x, ADV.spawn.y, ADV.spawn.z, {yaw: ADV.spawn.yaw});
  SpeechKit.speak('回家咯！休息一下再出发！');
  showToast('🏠 回到小屋');
}

/* ============================================================
   T12 挖掘与采集 — 交互段(挂 onMouse/update)
   (蓄力步进/放置合法性/食物政策/树苗计时纯函数在 adventure-core.js)
   ============================================================ */
let advTierT = 0; /* 「需要更硬的镐子」TTS 节流(3s) */
const advSaplings = new Map(); /* 树苗计时 "x,y,z"→{x,y,z,left}; 重进经全图扫描重建 */
const advMine = {down: false, t: 0, key: '', need: 0, drops: true, swingT: 0}; /* 蓄力状态机 */
let advMouseHeld = false; /* 桌面按住标志(document mousedown/up 维护): 按住连挖, 触屏单击挖一块 */

/* TNT 短按/按住二分(D3, 挖掘硬度修正): mousedown 只记账不点燃 — 松手
   <0.25s = 点燃(现状口径), 按住 ≥0.25s = 转蓄力挖走回收(hard 0)。
   触屏单击天然走「松手」分支(advMouseHeld 恒 false)。 */
let advTntTap = null; /* {x, y, z, held} | null */
const ADV_TNT_TAP_T = 0.25; /* 短按窗口(秒) */
function advTntTapTick(dt) {
  if (!advTntTap) return;
  if (ADV.panelOpen || ADV.furnaceOpen) {
    advTntTap = null; return; /* 面板期取消不点燃 */
  }
  advTntTap.held += dt;
  if (!advMouseHeld) {/* 松手: 短按=点燃(块还在才点), 长按已转蓄力不在此 */
    if (advTntTap.held < ADV_TNT_TAP_T && getBlock(advTntTap.x, advTntTap.y, advTntTap.z) === B_TNT) {
      advIgnite(advTntTap.x, advTntTap.y, advTntTap.z);
    }
    advTntTap = null;
    return;
  }
  if (advTntTap.held >= ADV_TNT_TAP_T) {/* 按住转蓄力: 挖走回收(准星已移开则蓄力链自清) */
    advTntTap = null;
    advMine.down = true;
  }
}

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

/* 级联块结算(方块级联设计稿 D4/D5/P6): editBlock 返回的级联清单逐块——
   存档记账(重进不复活红线: 漏记会复活半棵树)+树苗计时清理+默认表掉落
   (零惩罚, 不传工具=砸倒不是剪)+任务计数(quest=true 蓄力链视同玩家亲手挖;
   TNT 链传 false——「TNT 掀掉的不算」既有口径)。含原木时给整树倒话术。 */
function advCascadeApply(removed, quest) {
  let felled = false;
  for (const r of removed) {
    advMarkEdit(r.x, r.y, r.z, 0);
    if (r.id === B_SAPLING) advSaplings.delete(blockKey(r.x, r.y, r.z));
    if (BLOCKS[r.id] && BLOCKS[r.id].fell) felled = true;
    for (const d of rollBlockDrop(BLOCKS[r.id], null, null)) Drops.spawn(d.id, d.n, r.x + 0.5, r.y + 0.8, r.z + 0.5);
    if (quest) advQuestMine(r.id, r.x, r.y, r.z);
  }
  if (felled) {/* 整树倒: 只为含原木的级联喊话(火把/草丛脱落不出声) */
    SpeechKit.speak('哇！大树倒啦！');
    showToast('🌳 大树倒啦！');
  }
}

/* 破坏结算: 碎屑(editBlock 内置同色 Fx.debrisBurst)+记账+掉落+耐久。
   bt 为破坏时的 breakTime 结果(drops:false = tier 不足, 只碎不掉+节流提示);
   级联块(整树/依附脱落)经 advCascadeApply 结算(方块级联设计稿 D4) */
function advBreakBlock(x, y, z, id, bt) {
  advCascadeApply(editBlock(x, y, z, 0), true); /* 级联: 记账+默认表掉落+任务(蓄力链视同亲手挖, P6) */
  advMarkEdit(x, y, z, 0);
  if (id === B_SAPLING) advSaplings.delete(blockKey(x, y, z)); /* 挖树苗撤计时 */
  sfx('hit');
  advWearHeld('mine'); /* 破坏成功 −1(工具匹配与否都扣, MC 口径; 徒手无槽可扣) */
  if (!bt.drops) {/* tier 不足: 可挖慢速但掉落不触发(§3.4) */
    if (advTierT <= 0) {
      advTierT = 3;
      SpeechKit.speak('需要更硬的镐子哦！');
      showToast('⛏️ 换更硬的镐子才能挖到宝贝');
    }
    return;
  }
  const held = advInv.slots[advHb.sel];
  /* 剪刀 × shearDrop 掷专属表(D2); 爆炸路径不传工具走默认表 */
  for (const d of rollBlockDrop(BLOCKS[id], null, held)) Drops.spawn(d.id, d.n, x + 0.5, y + 0.8, z + 0.5);
  advQuestMine(id, x, y, z); /* T15: 挖到矿记账+钻石首获仪式(只认蓄力挖掘, TNT 链不挂) */
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
  if (it.block === B_CHEST) advTally('place_chest', 1); /* 引导链 v2: 箱子步(合成/放置/打开三条件) */
  if (it.block === B_SAPLING) {
    advTally('place_sapling', 1); /* 引导链 v2: 种树苗步(砍了树要种回去) */
    advSapPlant(pc.x, pc.y, pc.z);
  }
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
   T13 合成与烧炼 — 交互段(挂 onMouse/update)
   (站点判定/烧炼节律/退炉政策/TNT 掷骰纯函数在 adventure-core.js)
   ============================================================ */

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
  advFreeMouse(); /* 放鼠标点面板(解锁不弹菜单: onMenu 守卫) */
}
function advFurnaceClose() {/* 收面板(✕/Tab/Esc/onClose 共用): 顺带取走产物, 烧炼照跑(进度保留) */
  ADV.furnaceOpen = false;
  advFurnacePanel.hide();
  advFurnaceCollectOut();
  advRelock();
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
  /* 源块直接清除不经掷骰(圈内 TNT 链式点燃分支在前, D3); 级联块默认表掉落
     不进任务(P6: TNT 掀掉的不算——级联同理) */
  advCascadeApply(editBlock(x, y, z, 0), false);
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
        advCascadeApply(editBlock(bx, by, bz, 0), false); /* 级联块: 记账+默认表掉落, 不进任务(P6) */
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
   大宝箱 (引导链 v2) — 全局共享账户 + 点选搬运面板 + 材料扩容
   (阶梯表与政策纯函数 advChestNext/advChestPut 在 adventure-core.js)
   ============================================================ */
function advChestSave() {/* 账户落盘: 存取/扩容是离散动作, 即做即存不等 5s 节流 */
  advChestSlot.save(advChest);
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
    showToast('📦 箱子满啦');
    return;
  }
  if (left > 0) s.n = left; else advInv.slots[slotIdx] = null;
  advChestSave();
  advSyncHotbar();
  sfx('pick');
}
/* 取出(账户槽整摞搬回背包): 可堆叠走 add 并堆; 工具连耐久找空位整槽搬
   (add 会经 mkStack 把工具重铸满耐久, 工具禁走); 背包满整摞留在箱里 */
function advChestWithdraw(i) {
  const st = advChest.slots[i];
  if (!st) return;
  if (!isTool(st.id)) {
    const left = add(advInv, st.id, st.n);
    if (left >= st.n) {
      showToast('🎒 背包满啦');
      return;
    }
    if (left > 0) st.n = left; else advChest.slots[i] = null;
  } else {
    const j = advInv.slots.findIndex((t) => !t);
    if (j < 0) {
      showToast('🎒 背包满啦');
      return;
    }
    advInv.slots[j] = st;
    advChest.slots[i] = null;
  }
  advChestSave();
  advSyncHotbar();
  sfx('pick');
}
/* 扩容(面板 ＋ 按钮出口): canAfford 验费 → take 扣料 → 档位落盘; 材料
   不够温和提示(零惩罚; 阶梯取任务链产物, 目标随进度自然到期) */
function advChestExpand() {
  const nx = advChestNext(advChest.size);
  if (!nx) return;
  if (!take(advInv, nx.cost)) {
    showToast('材料还不够，先去挖一挖吧！');
    SpeechKit.speak('扩容的材料还不够，先去挖一挖，等会儿再来！');
    return;
  }
  advChest.size = nx.size;
  advChestSave();
  advSyncHotbar();
  sfx('level');
  SpeechKit.speak('宝箱变大啦！能放更多宝贝咯！');
  showToast('📦 宝箱扩到 ' + nx.size + ' 格！');
}

/* ============================================================
   T15 任务链 — 计数账本 + 推进引擎 + 任务卡 + 仪式
   (QUESTS 数据表与谓词纯函数在 adventure-core.js)
   ============================================================ */
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
    /* 大宝箱账户(引导链 v2): 归一化成满长槽数组, size 钩进档位界(扩容只升不降);
       账户槽 ≥ size 的存量(异常档)不清理——扩容后自然可见, 零损失口径 */
    advChest = advChestSlot.load();
    if (!Array.isArray(advChest.slots)) advChest.slots = [];
    for (let i = 0; i < ADV_CHEST_SLOTS; i++) if (!advChest.slots[i]) advChest.slots[i] = null;
    advChest.slots.length = ADV_CHEST_SLOTS;
    advChest.size = Math.max(ADV_CHEST_START, Math.min(advChest.size | 0, ADV_CHEST_SLOTS));
    advQuestT = ADV_QUEST_CHECK_T; /* 谓词检查节流复位(进场半秒后首查) */
    advQuestPaint();
    advBag.load(); /* 全局背包经背包壳读档(原地换槽, 面板/快捷栏闭包不脱钩) */
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
    ADV.chestOpen = false; /* 引导链 v2: 箱子面板一并复位 */
    advFurnaceZero();
    advFuses.length = 0;
    advTableNear = false;
    advMineStop(); /* 蓄力状态复位(上次退出可能按住) */
    advTntTap = null; /* TNT 短按判定复位(上次退出可能按在 TNT 上) */
    advMouseListeners(true); /* 桌面按住连挖检测(capture) */
    advSyncHotbar();
    advWarnLow.clear(); /* S4① 预警账本复位: 新一命重新预警 */
    advBagArmed = true; /* S4② 快满提醒复位(进场满包会在首查时提醒一次) */
    advBagT = ADV_BAG_CHECK_T; /* 首查在进场半秒后(欢迎语音先落地不被顶掉) */
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
    ADV.chestOpen = false;
    advPanel.remove(); /* 卸载面板 DOM */
    advFurnacePanel.remove(); /* T13: 熔炉面板一并卸载 */
    advChestPanel.remove(); /* 引导链 v2: 箱子面板一并卸载 */
    advChestSave(); /* 账户兜底落盘(存取/扩容已即做即存, 双保险口径) */
    Avatar.setItem(PLAYER.heldItem); /* 手持物复位(Avatar 跨模式存活) */
    advMouseListeners(false);
    advMineStop(); /* 蓄力清零 + 进度环收起 */
    advTntTap = null; /* TNT 短按判定一并复位 */
    advSaplings.clear(); /* 计时不落盘, 重进经全图扫描重建 */
    advFuses.length = 0; /* 引信不落盘 */
    advStations.clear(); /* 站点缓存重进由 advRescanStations 重建 */
    advTableNear = false;
    advTierT = 0;
    advRingDispose();
    advHpBar.dispose(); /* 头顶血条回收(S2 深接口) */
  },

  update(dt) {
    if (advDirty && performance.now() - advSaveT > 5000) {/* 世界存档节流(build 同款) */
      advSaveT = performance.now();
      advSaveNow();
    }
    advTierT = Math.max(0, advTierT - dt); /* tier 提示节流递减(T12) */
    advStationTick(); /* 站点沿检测: 首次靠近工作台 TTS 引导 + 开面板亮灰刷新(T13) */
    advQuestTick(dt); /* 任务链推进: 节流查当前步谓词, 完成走表扬/引导/落盘(T15) */
    advBagTick(dt); /* 背包快满提醒(S4②): 0.5s 节流查占用槽 */
    advFurnaceTick(dt); /* 烧炼节律常开(面板只是回显), ✕ 关闭对账(T13) */
    advFuseTick(dt); /* TNT 引信倒计时到点起爆(T13, 先于怪物 AI——当帧爆炸位置不漂移) */
    advTntTapTick(dt); /* TNT 短按/按住判定(D3): 转蓄力需先于 advMineTick 同帧生效 */
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
    advHpBar.update(advGetPEnt().hp, ADV.player.maxHp, pos.x, pos.y + 2.2, pos.z); /* 头顶血条 */
  },

  onMouse(button, hit) {/* 左键并线(T12×T13×T14): TNT 短按点燃/按住挖走(D3)/熔炉走近点击开面板(T13, 准星块
    精确命中故在最前)/箱子走近点击开面板(引导链 v2, 站点缓存外故按点击块直算距离), 准星锥内有
    活怪→挥击(T14), 否则吃/挖掘蓄力(T12); 右键放置 */
    if (ADV.panelOpen || ADV.furnaceOpen || ADV.chestOpen) return; /* 面板遮罩兜底: 开面板不挖不放不打 */
    if (button === 0) {
      const lookId = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
      if (lookId === B_TNT) {/* TNT(D3): 短按=点燃(松手<0.25s 在 advTntTapTick 判定),
        按住=蓄力挖走回收 — mousedown 只记账不点燃, 与现状点击点燃逐点一致 */
        advTntTap = {x: hit.x, y: hit.y, z: hit.z, held: 0};
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
      if (lookId === B_CHEST) {/* 箱子交互(引导链 v2): 走近 4 格开大宝箱; 箱子不是
        站点(不在 advStations 缓存), 对点击块直算水平距离(与站点同半径口径) */
        if (Math.hypot(hit.x + 0.5 - pos.x, hit.z + 0.5 - pos.z) <= ADV_STATION_R) {
          advChestOpenPanel();
        } else {
          showToast('📦 走近一点就能打开箱子啦');
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
      if (ADV.chestOpen) {/* 箱子开着先收箱子(body 级遮罩不叠层) */
        advChestClose();
        return;
      }
      if (ADV.furnaceOpen) {/* 熔炉开着先收熔炉(两块 body 级遮罩不叠层) */
        advFurnaceClose();
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
    if (ADV.panelOpen || ADV.furnaceOpen || ADV.chestOpen) {
      overlay.style.display = 'none'; return;
    }
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
    {label: '🏠', act: () => advGoHome()}, /* 受困逃生口: 回出生小屋(60s 冷却) */
  ],
});

/* T12~T15 的接线挂点(内部接口, 不进模式公共行为; 单测亦经此触达状态账本、
    交互链入口与 adventure-core 的常量表/纯函数转发):
    T12 已落地(蓄力/放置/树苗/食物交互段, 站点/TNT 放置复用 advTryPlace) ·
    T13 已落地(advStationOk 真判定/advOnCraft 表扬链/熔炉状态机与面板/
    TNT 引信爆炸; TNT 点燃与熔炉开面板在 onMouse 左键最前拦截) ·
    T14 已落地(ADV.killCount 击杀账本, 击杀挂 Mobs.onDeath; 左键语义与
    挖掘在 onMouse 并线: 准星锥内有怪=挥击, 否则让位挖掘/放置) ·
    T15 已落地(ADV.quest.counts 事件计数账本, 挂点=advBreakBlock 尾部/
    advOnCollect/advOnCraft/advTryPlace/advFurnaceTick 产出分支只 +=;
    推进=update 内 advQuestTick 0.5s 节流只查当前步; 任务卡=advQuestPaint
    挂 advPanel.questEl; 仪式=advDiamondRite 首获专属/advFireworks 终章烟花) ·
    引导链 v2 已落地(任务表 15 步+终章; 新挂点=advTryPlace 的箱子/树苗
    放置 · advChestOpenPanel 的 open_chest · advOnKill 的 kill_mob;
    大宝箱=全局共享账户 advChest+advChestPanel 点选搬运+材料扩容,
    政策纯函数 advChestNext/advChestPut 在 adventure-core) ·
    code-review 修复轮已落地(纯函数段与任务表迁 adventure-core.js 经此转发;
    advWearHeld=原 advWearTool/advDamageHeld 合一(S3)+低耐久预警(S4①)+
    破板指路(S4③); advBagTick=背包快满提醒(S4②, 放过箱子后话术指向收纳)) */
AdventureMode.adv = {ADV, ADV_NESTS, ADV_QUESTS, advDeathPlan, advMarkEdit, advGetInv: () => advInv,
  advGetPEnt, advPlayerDied, advPanelToggle, advSyncHotbar, advQuestEl, advQuestPaint,
  advNestCount, advNestStep, advSwingDmg, advDeathDrops, advPickupText, advOnKill,
  advMineStep, advPlaceCheck, advEatPolicy, advSapDue, advMine, advSaplings, advBreakBlock,
  advCascadeApply, advExplode,
  advGetTntTap: () => advTntTap, advMouseHeldOn, advMouseHeldOff,
  advTryPlace, advGrowTree, advMineStop, advWearHeld,
  advNearStation, advStationOk, advOnCraft, advSmeltStep, advFurnaceRefund,
  advTntRoll, advTntDmg, advFurnace, advFurnaceAutoFill, advFurnaceOpenPanel,
  advFurnaceClose, advIgnite, advFuses, advStations,
  advGetChest: () => advChest, advChestOpenPanel, advChestClose,
  advChestDeposit, advChestWithdraw, advChestExpand,
  advPanelClose, advGoHome, advHomeReady, ADV_HOME_CD};

if (typeof module !== 'undefined' && module.exports) module.exports = AdventureMode;
