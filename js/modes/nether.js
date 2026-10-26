'use strict';
/* ============================================================
   下界冒险模式 (NetherMode) — 应用层
   ------------------------------------------------------------
   玩法骨架: 上界(Overworld) ↔ 下界(Nether) 穿越 + 下界打怪物探险
   · 上界: 建造模式精选场景「巨大地下室」作本模式地形(用户约定: 地形暂时就和建造模式
     里的地下室模式一样), 地表入口处放一座下界传送门(霸气大门: 黑曜石主框 6×7 内口 4×5 + 塔楼/阶梯门楣/
      发光岩点缀, 门中紫色光束常驻)。
     主人公(小探险家)出生/待在上界, 有传送门可去下界。
   · 踩进传送门 → phase='nether': 重建下界地形(下界岩 + 熔岩湖)并放回程传送门,
     释放下界怪物 → 开始下界探险(打怪 → 打完一波 → 新一波).
   · 下界怪物(猪灵系/凋灵骷髅/烈焰人/恶魂/岩浆怪)全部 hostile: 主动攻击主人公,
     主人公进下界自动武装 — 武器栏(⚔️剑近战/🏹弓远程)数字键/滚轮/点选切换打怪;
     受击提醒=身体闪红, 头顶血条常驻; 怪死 → 击杀计数 + 碎块 + 表扬, 波清空 → 新波.
   · 防沉迷: 与竞技场/建造/坦克共属儿童时限预算(主菜单卡片 gated), 不新增账本.
   ============================================================ */

const NETHER_PORTAL_W = 6; const NETHER_PORTAL_H = 7; // 下界传送门框架(宽×高): 比 Minecraft 最小门(4×5)放大一圈, 内口 4×5 — 大门才压得住场面

const NETHER_MOBS = ['zombified_piglin', 'piglin', 'piglin_brute', 'hoglin', 'zoglin',
  'wither_skeleton', 'blaze', 'ghast', 'magma_cube'];
const NETHER_HOME_GROUND = 24; // 建造模式「巨大地下室」地表草坪顶层(地形暂时复用它的场景)
const NETHER_HOME_PORTAL = {px: 61, pz: 90}; // 上界: 地表入口下界传送门(框架底边贴地表)。pz 90: 比小屋/出生点
// 再远 2 格 — 传送落点太贴门, 门前被击退两步就弹回门里(pad 实测)
const NETHER_GROUND = 20; // 下界平地顶层 y(脚踩 y=21) — 下界地面是平的(用户拍板)
const NETHER_RETURN_PORTAL = {by: NETHER_GROUND, px: 24, pz: 24}; // 下界回程传送门: 落地就在它跟前(门在身后)
/* 下界传送落点(enterNether 落地用): 内口判定缘是 |z-24|<1.5(即 z<25.5), 落点离门 5 格 —
   贴门落点会被门前混战的击退/回走两步弹回上界。z 也避开怪物出生环(绕 (25,28) 半径 6+), 落地不贴脸 */
const NETHER_BASE = {x: 25.5, z: 30.5};

/* ---------- 武器政策(手持物 def 只管观感, 伤害/触及/弹道是模式政策):
   剑 dmg 16(猪灵 24 血两刀, 锄头 10 → 换剑变强) · 触及 3.0(原版玩家攻击
   距离口径, 盖过下界近战怪 2.2~2.6 — 此前 1.8 反被怪先手);
   弓 dmg 10 · 冷却 0.55s(比剑 0.38 慢, 拉弓的时间) · 箭速 22 + 重力 9.5
   (竞技场箭矢同款弹道) — 近战贴身强/远程放风筝, 各有场景 */
const NETHER = {phase: 'overworld', wave: 0, waveInProgress: false,
  killCount: 0, swingCdMax: 0.38, swingDmg: 16, meleeR: 3.0,
  weapon: 'sword', bowCd: 0.55, bowDmg: 10, arrowSpeed: 22,
  player: {hp: 30, maxHp: 30}};
const NETHER_ATTACK_T = 0.5; // 怪物挥击姿态时长(attackT 满时长, 近战/远程统一 — gait 第 4 参)
const NETHER_PORTAL_CD = 0.8; // 传送冷却(秒): 落地短暂"时空眩晕"。两界落点离门触发缘都只有几格,
// 落地瞬间还推着摇杆前进会立刻弹回另一界(实测"回不到地下室"即此)
let portalCd = 0; // >0 = 眩晕中, 两座门都不触发
let pEnt = null; // 下界探险中的"主人公实体"(AI 索敌目标 + 受击/受死共用状态)

/* ---------- 主人公实体: AI 索敌 + 受击状态共用(同一套 MobCore 状态机, CombatKit 工厂) ---------- */
function getPEnt() {
  if (pEnt) return pEnt;
  pEnt = CombatKit.mkFighter({hp: NETHER.player.hp, maxHp: NETHER.player.maxHp,
    dmg: NETHER.swingDmg, range: NETHER.meleeR});
  return pEnt;
}

/* ---------- 玩家战斗壳(CombatKit, C6-T3): 受击提醒/近战(弓占同一冷却轨道)/
    双箭矢管线(玩家箭打怪 · 怪火球打玩家)/击杀观色 — 冷却与话术节流自持在
    kit(update 只喂 tick), 政策数值与击杀/死亡回调留模式层 ---------- */
const netherHurt = CombatKit.mkHurtAlarm({setHp: (v) => {
  NETHER.player.hp = v;
}});
const netherMelee = CombatKit.mkMelee({range: NETHER.meleeR, cooldown: NETHER.swingCdMax,
  swingOnMiss: true, dmg: NETHER.swingDmg, onKill: (m) => netherOnKill(m)});
const netherArrows = CombatKit.mkArrows({onHitMob: (m, res) => {
  if (res.freshDead) netherOnKill(m);
}});
const netherBalls = CombatKit.mkArrows({mesh: 'sphere', color: 0xffa53c, lookAt: false,
  player: getPEnt, onHitPlayer: (res) => {
    if (res.freshDead) netherPlayerDied();
    else netherHurt.hit(res);
  }});

/* ---------- 武器栏(mkHotbar 深接口): 剑/弓 两槽(item 槽型=像素物品图标) ----------
   数字键/滚轮/点选全自动(hotbar 样板吸收); 观感随手持物注册表走
   (Avatar.setItem), 伤害/弹道等战斗政策在 NETHER 常量, 不进 def */
const weaponBar = ModeKit.mkHotbar({
  items: [{item: 'sword_iron', lbl: '剑'}, {item: 'bow_item', lbl: '弓'}],
  onPick: (i) => netherSetWeapon(i === 1 ? 'bow' : 'sword'),
});
function netherSetWeapon(id) {
  NETHER.weapon = id;
  Avatar.setItem(id);
  showToast(id === 'bow' ? '🏹 换弓 · 点击射箭' : '⚔️ 换剑 · 点击挥砍');
}

/* ---------- 下界地形: 平整下界岩地面 + 成片熔岩池(平地上的可见障碍, 绕开走) ---------- */
function buildNetherWorld() {
  for (let x=0; x<WORLD_W; x++) {
    for (let z=0; z<WORLD_D; z++) {
      for (let y=0; y<=NETHER_GROUND; y++) setBlockRaw(x, y, z, B_NETHERRACK); // 平整地面
      if (x < 44 && z < 44) continue; // 出生区/回程门/首波怪物环: 不铺熔岩
      if (hashRand(Math.floor(x/3)*11 + Math.floor(z/3)*7, Math.floor(z/3)*13) > 0.93) {
        setBlockRaw(x, NETHER_GROUND, z, B_LAVA);
      } // 3×3 成片的熔岩池
    }
  }
}

/* ---------- 上界地形: 建造模式精选场景「巨大地下室」(临时复用) + 地表下界传送门 ---------- */
function buildOverworldWorld() {
  if (typeof buildBasementScene === 'function') buildBasementScene(); // 地形暂时就和建造模式里的地下室模式一样
  buildPortalFrame(NETHER_HOME_GROUND, NETHER_HOME_PORTAL.px, NETHER_HOME_PORTAL.pz);
  anchorPortalBeam(NETHER_HOME_GROUND, NETHER_HOME_PORTAL.px, NETHER_HOME_PORTAL.pz); // 门中紫色光束
}

/* ---------- 下界传送门: 霸气大门 ----------
   门核心: 黑曜石环框 W×H(6×7), 内口 (W-2)×(H-2)=4×5 填紫色门面(B_PORTAL,
   solid:false 可直接走入)。气势件全部对称、且都在内口判定区之外:
   两侧黑曜石塔楼(高出门顶两层 + 发光岩压顶) · 阶梯门楣(逐层收窄, 顶心发光岩) ·
   开口四角发光岩(暗框上勾出门洞轮廓) · 前后下界砖步道(与地表齐平, 走近有铺垫)。
   by 为框架底边(贴地表层) · px/pz 为框架位置(门面朝 ±z);
   踩入内口即传送的判定在 inPortal, 只认内口 x/y/z 区间 — 换外观不动判定 */
function buildPortalFrame(by, px, pz) {
  const W = NETHER_PORTAL_W; const H = NETHER_PORTAL_H;
  for (let x=px; x<=px+W-1; x++) setBlockRaw(x, by, pz, B_OBSIDIAN); // 底边
  for (let x=px; x<=px+W-1; x++) setBlockRaw(x, by+H-1, pz, B_OBSIDIAN); // 顶边
  for (let y=by+1; y<=by+H-2; y++) {
    setBlockRaw(px, y, pz, B_OBSIDIAN); // 侧柱
    setBlockRaw(px+W-1, y, pz, B_OBSIDIAN);
    for (let x=px+1; x<=px+W-2; x++) setBlockRaw(x, y, pz, B_PORTAL); // 内口 = 紫色门面
  }
  for (const gx of [px, px+W-1]) { // 开口四角发光岩
    for (const gy of [by+1, by+H-2]) setBlockRaw(gx, gy, pz, B_GLOWSTONE);
  }
  for (const tx of [px-1, px+W]) { // 两侧塔楼 + 发光岩压顶
    for (let y=by; y<=by+H; y++) setBlockRaw(tx, y, pz, B_OBSIDIAN);
    setBlockRaw(tx, by+H+1, pz, B_GLOWSTONE);
  }
  for (let x=px; x<=px+W-1; x++) setBlockRaw(x, by+H, pz, B_OBSIDIAN); // 门楣: 逐层收窄
  for (let x=px+1; x<=px+W-2; x++) setBlockRaw(x, by+H+1, pz, B_OBSIDIAN);
  for (let x=px+2; x<=px+W-3; x++) setBlockRaw(x, by+H+2, pz, B_GLOWSTONE); // 顶心发光岩(塔尖)
  for (const dz of [-1, 1]) { // 前后步道(与地表齐平)
    for (let x=px-1; x<=px+W; x++) setBlockRaw(x, by, pz+dz, B_NETHER_BRICK);
  }
}

/* ---------- 门中紫色光束(常驻动效): 特效唯一入口 Fx.portalBeam ----------
   模式层只报开口锚点(开口中心/底高/门面), 脉动光柱+环绕微粒全收在 Fx;
   两阶段各重锚一次(换句柄), Node 单测 fake Fx 没有该入口时静默跳过 */
let portalBeamH = null;
function anchorPortalBeam(by, px, pz) {
  if (portalBeamH && Fx.removeBeam) Fx.removeBeam(portalBeamH);
  portalBeamH = Fx.portalBeam ?
    Fx.portalBeam(px + NETHER_PORTAL_W/2, by + 1, pz + 0.5,
        {w: NETHER_PORTAL_W - 2, h: NETHER_PORTAL_H - 2}) :
    null;
}
/* 玩家是否站在传送门内口里(已踏入内口 y 区间, x/z 落在开口范围内) */
function inPortal(by, px, pz) {
  const p = getPEnt().pos;
  return p.y >= by && p.y < by + NETHER_PORTAL_H - 1 &&
      p.x > px && p.x < px + NETHER_PORTAL_W - 1 &&
      Math.abs(p.z - pz) < 1.5;
}

/* ---------- 下界氛围: 暗红天穹 + 近雾 + 压暗日光(回上界恢复 world.js 默认天蓝) ----------
   纯渲染态切换, Node 单测无渲染场景时静默跳过; 日月天体显隐归 dayCycleOn(下界不置位即隐藏) */
const NETHER_SKY = {color: 0x2a0a08, fogNear: 26, fogFar: 120, sunI: 0.3};
const OVERWORLD_SKY = {color: 0x8fc7ff, fogNear: 90, fogFar: 230, sunI: 0.75}; // 与 world.js 初始值一致
function applySky(k) {
  if (typeof scene === 'undefined' || !scene.fog) return;
  scene.background.set(k.color);
  scene.fog.color.set(k.color);
  scene.fog.near = k.fogNear;
  scene.fog.far = k.fogFar;
  if (typeof sun !== 'undefined') sun.intensity = k.sunI;
}

/* ---------- 阶段切换: 上界 ↔ 下界 ---------- */
function enterNether() {
  NETHER.phase = 'nether';
  loadScene(()=>{ // 场景装填 seam: 清上界(不清 → 家的草坪/小屋浮在下界岩上面) + 建下界 + 收尾
    buildNetherWorld();
    buildPortalFrame(NETHER_RETURN_PORTAL.by, NETHER_RETURN_PORTAL.px, NETHER_RETURN_PORTAL.pz); // 落地就有回程门
    anchorPortalBeam(NETHER_RETURN_PORTAL.by, NETHER_RETURN_PORTAL.px, NETHER_RETURN_PORTAL.pz); // 门中紫色光束重锚
  });
  applySky(NETHER_SKY); // 暗红天穹: 一眼就知道到了下界
  Mobs.clear();
  netherArrows.clear(); netherBalls.clear(); // 投射物不跨维度: 门只渡人, 火球/箭留在原界
  NETHER.wave = 0; NETHER.killCount = 0; NETHER.waveInProgress = false;
  startNetherWave();
  ModeKit.spawn(NETHER_BASE.x, NETHER_GROUND + 1, NETHER_BASE.z, {yaw: Math.PI}); // 从回程门前走出(门在身后, 面朝下界)
  setFly(false); // 冒险模式步行(不沿用建造的飞行; 走意图入口)
  netherMelee.reset(); netherHurt.reset(); // 传送落地即可战斗(冷却/话术节流不留锁)
  weaponBar.show(); // 武器栏现身(上界不放武器)
  Avatar.setItem(NETHER.weapon); // 进下界自动武装(记住上次的选择)
  SpeechKit.speak('进了下界！回程传送门就在身后！怪物来了！');
  showToast('🌀 传送进下界！');
}
function enterOverworld() {
  NETHER.phase = 'overworld';
  loadScene(buildOverworldWorld); // 场景装填 seam: 清下界残留, 家原样重建
  applySky(OVERWORLD_SKY);
  ModeKit.spawn(62.5, NETHER_HOME_GROUND + 1, 85.5, {yaw: 0}); // 家门口(门南侧几步); 面朝房子背对门 —
  setFly(false); // 落地推"前进"只会走离门口, 不会一头弹回下界(走意图入口)
  Mobs.clear();
  netherArrows.clear(); netherBalls.clear(); // 投射物不跨维度: 残留火球追进门会在上界把人打死 → 重生点落进地下室土里(实测根因)
  const e = getPEnt(); // 回家 = 安全休整: 生命回满(空血进下界 = 落地即死,
  e.hp = e.maxHp; NETHER.player.hp = NETHER.player.maxHp; // 又回基地又死 — "死亡循环"的另一半根因)
  NETHER.wave = 0; NETHER.killCount = 0; NETHER.waveInProgress = false;
  netherMelee.reset(); netherHurt.reset();
  weaponBar.hide(); // 上界不放武器(回程即收)
  Avatar.setItem(PLAYER.heldItem); // 回上界换回默认手持物(锄头)
  SpeechKit.speak('回到上界啦');
}

/* ---------- 下界波次: 释放一波 hostile 怪物 → 空了再来一波 ---------- */
function startNetherWave() {
  NETHER.waveInProgress = true;
  const count = 2 + NETHER.wave; // wave0 → 2 只, 之后每波 +1
  const types = NETHER_MOBS.slice();
  for (let i=types.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1)); const t=types[i]; types[i]=types[j]; types[j]=t;
  }
  for (let i=0; i<count; i++) {
    const type = types[i % types.length];
    const a = Math.random()*Math.PI*2; const rr = 6 + Math.random()*8; // 离出生点 6~14 格(看得见来袭, 不贴脸)
    Mobs.spawn(type, Math.floor(25 + Math.cos(a)*rr), Math.floor(28 + Math.sin(a)*rr),
        {yaw: 0, label: {prefix: '下界 ', color: '#ff9a3c'}});
  }
  NETHER.wave++;
}
function checkWaveClear() {
  if (!NETHER.waveInProgress) return;
  if (Mobs.list().some((m) => !m.dead && !m.gone)) return;
  NETHER.waveInProgress = false;
  SpeechKit.speak('打得漂亮！新怪物来啦！');
  startNetherWave();
}

/* ---------- 主人公攻击: 武器栏当前武器 — 剑=近战挥击(即时判定) / 弓=射箭(弹道飞行) ---------- */
let netherHoldAtk = false; /* ⛏️ 主动作键按住中: update 里持续补刀(冷却自节流) */
function netherAttack() {
  if (NETHER.weapon === 'bow') {
    /* 弓: 占近战件的同一条冷却轨道(拉弓 0.55s, 换武器不躲冷却 — 原 NETHER.swingCd
       共享口径), 出手观感同拍, 弹由箭矢管线沿准星出膛 */
    netherMelee.swingAction(getPEnt(), {cooldown: NETHER.bowCd, act() {
      netherArrows.shootFromAim({speed: NETHER.arrowSpeed, dmg: NETHER.bowDmg,
        kpow: 0.35, g: 9.5, life: 3});
    }});
    return;
  }
  netherMelee.swing(getPEnt());
}

function netherOnKill(m) {
  NETHER.killCount++;
  CombatKit.killBurst(m, NETHER.killCount, {after: checkWaveClear}); /* 碎块+计数 toast(消灭) */
}

/* 受击提醒已收 CombatKit.mkHurtAlarm(C6-T3, netherHurt 实例): 账本同步+
   受击音+闪红+震屏+3s 节流话术; 致命一击不走那里 — 死亡路径有专属文案
   (引擎 death 音), 且 SpeechKit 是 cancel-then-speak, 后播受击话术会把
   死亡话术顶掉 */

/* ---------- 下界怪物 AI: 全部 hostile, 索敌=主人公 → 逼近/攻击/射击 ---------- */
function netherAI(dt) {
  const p = getPEnt();
  for (const m of Mobs.list()) {
    if (m.dead || m.gone) continue;
    const gp = m.pos;
    CombatCore.tickCadence(m, dt); // 攻击节拍(与竞技场同一条, 战斗核心)
    if (!m.target || m.dead || m.gone) m.target = p;
    const tg = m.target;
    const dx = tg.pos.x - gp.x; const dz = tg.pos.z - gp.z;
    const dist = Math.hypot(dx, dz);
    Mobs.steer(m, Math.atan2(dx, dz));
    const speed = m.cfg.speed || 2;
    let moved = 0; // 本帧实际移动速度(喂步态用)

    if (m.cfg.fly) {
      if (m.cfg.ranged) {
        const want = (m.type === 'blaze') ? 7 : 10; // 炮台巡航距离(烈焰人绕近, 恶魂拉开)
        const sp = Math.min(speed, 3);
        if (dist > want) {
          Mobs.move(m, dx/dist*sp*dt, dz/dist*sp*dt); moved = sp;
        } else if (dist < want - 1.5) {
          Mobs.move(m, -dx/dist*sp*dt, -dz/dist*sp*dt); moved = sp;
        }
        if (Math.abs(tg.pos.y - gp.y) < 3 && dist <= want && m.attackCd <= 0) {
          m.attackCd = m.cfg.cd; m.attackT = NETHER_ATTACK_T;
          netherBalls.shootFromMob(m, tg, {speed: 17, dmg: Math.round(m.cfg.dmg),
            kpow: 1.0, g: 6, life: 2.5}); /* 预测弹道在箭矢管线(战斗核心 leadAim) */
        }
      }
    } else {
      if (dist > m.cfg.range) { // 逼近
        Mobs.move(m, dx/dist*speed*dt, dz/dist*speed*dt); moved = speed;
      } else if (Math.abs(tg.pos.y - gp.y) < 2.5 && m.attackCd <= 0) { // 近战攻击玩家
        m.attackCd = m.cfg.cd; m.attackT = NETHER_ATTACK_T;
        const r = Mobs.hit(p, Math.round(m.cfg.dmg*(m.dmgMult||1)), p.pos.x - gp.x, p.pos.z - gp.z, 0.4);
        if (r.freshDead) netherPlayerDied(); else netherHurt.hit(r);
      }
    }
    /* 步态+战斗姿态: 与竞技场同一条怪物库 gait 入口(此前下界只跑 AI 不喂步态 —
       怪连走路都不摆腿; 第 4 参 = attackT 满时长 → 有臂挥臂(挥击手=持械手)/无臂头前扑) */
    Mobs.gait(m, dt, moved, NETHER_ATTACK_T);
  }
}

/* 箭矢管线已收 CombatKit.mkArrows(C6-T3): 飞行怪火球=netherBalls 实例(预测弹道
   在战斗核心 leadAim — 原直线弹道对移动中的主人公常打空), 主人公弓箭=
   netherArrows 实例(沿统一瞄准射线 CameraRig.aim, 竞技场同款重力弹道,
   箭头朝飞行方向/火球不转); 步进在战斗核心 stepShot, mesh/寿命/geo 缓存自持 */

/* ---------- 玩家阵亡: 被送回家(地下室)满血重来 ----------
   用户拍板: 死亡不在下界原地挣扎(怪就在身边, 原地重生即再被围殴), 而是送回家 —
   家是安全的, 想再战就再走进传送门(enterNether 波次从头开)。enterOverworld
   一并完成: 切地图/清怪/收投射物/回满血/收武器/落点背对门 */
function netherPlayerDied() {
  const e = getPEnt();
  CombatKit.resetFighter(e); /* 复活五字段不变量(阵亡去向政策在此) */
  enterOverworld();
  SpeechKit.speak('被怪物追上了！先回家休息，再回来冒险吧！'); // 后播顶掉"回到上界啦"(cancel-then-speak)
  showToast('💀 被怪物打死了，回家重来！');
}

/* ---------- 主人公头顶血条(下界常驻): CombatKit.mkHpBar 深接口(S2 两模式归一,
    C6-T3 自 mode-kit 随战斗 vocabulary 迁入) ----------
    血量变化才重绘(逐帧纹理上传是移动端掉帧源); 上界不放血条(visible
    回调按阶段控制); Node 单测无 THREE/DOM 时 update 静默跳过 */
const hpBar = CombatKit.mkHpBar({visible: () => NETHER.phase === 'nether'});
function updateHpBar() {/* S2: 逐帧喂血量与世界坐标(头顶 2.2 格), 重绘/显隐收在深接口 */
  hpBar.update(getPEnt().hp, NETHER.player.maxHp, pos.x, pos.y + 2.2, pos.z);
}

/* ============================================================
   模式对象
   ============================================================ */
const NetherMode = mkMode({
  id: 'nether',

  hotbar: weaponBar, // 武器栏: mkHotbar(数字键/滚轮/点选全自动)
  chrome: {hotbar: 'deferred'}, // 上界先藏, 进下界现身(enterNether 里 show)

  init() {
    portalCd = 0; // 新进场无冷却(冷却只在传送触发点置位)
    enterOverworld();
  },

  cleanup() {
    Mobs.clear();
    netherArrows.clear(); netherBalls.clear(); // 火球/箭矢网格一并摘除
    netherHoldAtk = false; /* ⛏️ 按住场随模式退出收起 */
    NETHER.wave = 0; NETHER.killCount = 0; NETHER.waveInProgress = false;
    applySky(OVERWORLD_SKY); // 天空复位: 红天不渗进其他模式
    Avatar.setItem(PLAYER.heldItem); // 手持物复位: 剑/弓不渗进其他模式(Avatar 跨模式存活)
    weaponBar.hide(); // 武器栏复位
    hpBar.dispose(); // 头顶血条网格/纹理回收(S2 深接口)
    if (portalBeamH && Fx.removeBeam) Fx.removeBeam(portalBeamH); // 常驻光束摘除(句柄置空, 不等 switchMode 的 Fx.clear)
    portalBeamH = null;
    portalCd = 0;
  },

  update(dt) {
    netherMelee.tick(dt); /* 攻击冷却递减(剑/弓同一轨道, kit 自持) */
    if (netherHoldAtk) netherAttack(); /* ⛏️ 按住连打(挥击/射箭冷却自节流, 同探险按住连挖的节奏) */
    netherHurt.tick(dt); // 受击语音节流递减
    /* 岩浆接触伤害(liquid D9): 引擎计息到点的事件在此结算 HP(下界有 HP 账本;
       溺水不结算——下界无水, MC 下界蒸发口径附录 B #29) */
    if (worldEvents.lavaTick) {
      worldEvents.lavaTick = false;
      const pe = getPEnt();
      pe.hp = Math.max(0, pe.hp - FLUID.lavaDps);
      NETHER.player.hp = pe.hp;
      if (pe.hp <= 0) netherPlayerDied();
      else netherHurt.hit({hp: pe.hp, line: '好烫！快离开岩浆！'});
    }
    if (portalCd > 0) portalCd = Math.max(0, portalCd - dt); // 传送眩晕递减(本帧先扣再判 — 到点即刻可再触发)
    if (NETHER.phase === 'overworld') {
      if (portalCd <= 0 && inPortal(NETHER_HOME_GROUND, NETHER_HOME_PORTAL.px, NETHER_HOME_PORTAL.pz)) {
        portalCd = NETHER_PORTAL_CD; enterNether();
      }
    } else {
      if (portalCd <= 0 && inPortal(NETHER_RETURN_PORTAL.by, NETHER_RETURN_PORTAL.px, NETHER_RETURN_PORTAL.pz)) {
        portalCd = NETHER_PORTAL_CD; enterOverworld();
      }
    }
    netherAI(dt);
    Mobs.update(dt);
    Mobs.render();
    netherArrows.update(dt); netherBalls.update(dt);
    updateHpBar();
    checkWaveClear();
  },

  onMouse(button) {
    if (button === 0 || button === 2) netherAttack(); // 左键/右键都当挥击
  },

  /* onMenu 不声明 → Esc/B 走 mkMode 默认: 回本模式出发页(showPage('nether')), 与坦克/建造同款 */

  hud() {
    const alive = Mobs.list().filter((m) => !m.dead && !m.gone).length;
    return [
      `阶段: ${NETHER.phase === 'overworld' ? '上界 · 有下界传送门' : '下界 · 怪物来袭'}`,
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      `❤️ 生命: ${Math.max(0, Math.ceil(getPEnt().hp))} / ${NETHER.player.maxHp}`,
      `👾 怪物: ${alive} · ☠️ 击杀: ${NETHER.killCount}`,
      `武器: ${NETHER.weapon === 'bow' ? '🏹 弓 · 点击射箭' : '⚔️ 剑 · 点击挥砍'}（1/2 键 · 滚轮 · 点武器栏切换）`,
      `B 菜单 · 打怪中`,
    ];
  },

  touch: [ /* ⛏️ 智能主动作键与探险同款(用户拍板 2026-10-24): 按一下打怪, 按住连续攻击。
     手持感知规则在此天然恒为攻击 — 剑/弓皆非放置物(放置分支永不触发),
     与 MC「Attack/Destroy 同键、分派与手持无关」同构(docs/mc-held-item-action-research.md Q6) */
    {icon: 'sword', label: '攻击', holdAct: netherAttack},
  ],
  /* ⛏️ 按住=连续攻击(挥击冷却自节流, 弓按 bowCd 节奏) */
  onHold(active) {
    netherHoldAtk = active;
  },
});

if (typeof module !== 'undefined' && module.exports) module.exports = NetherMode;
