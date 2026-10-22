"use strict";
/* ============================================================
   下界冒险模式 (NetherMode) — 应用层
   ------------------------------------------------------------
   玩法骨架: 上界(Overworld) ↔ 下界(Nether) 穿越 + 下界打怪物探险
   · 上界: 建造模式精选场景「巨大地下室」作本模式地形(用户约定: 地形暂时就和建造模式
     里的地下室模式一样), 地表入口处放一座下界传送门(黑曜石框架 4×5, 内口 2×3)。
     主人公(小探险家)出生/待在上界, 有传送门可去下界。
   · 踩进传送门 → phase='nether': 重建下界地形(下界岩 + 熔岩湖)并放回程传送门,
     释放下界怪物 → 开始下界探险(打怪 → 打完一波 → 新一波).
   · 下界怪物(猪灵系/凋灵骷髅/烈焰人/恶魂/岩浆怪)全部 hostile: 主动攻击主人公,
     主人公进下界自动武装 — 武器栏(⚔️剑近战/🏹弓远程)数字键/滚轮/点选切换打怪;
     受击提醒=身体闪红, 头顶血条常驻; 怪死 → 击杀计数 + 碎块 + 表扬, 波清空 → 新波.
   · 防沉迷: 与竞技场/TNT/建造/坦克共属儿童时限预算(主菜单卡片 gated), 不新增账本.
   ============================================================ */

const NETHER_PORTAL_W = 4, NETHER_PORTAL_H = 5;   // 下界传送门框架(宽×高): Minecraft 下界传送门最小尺寸 4×5

const NETHER_MOBS = [ 'zombified_piglin','piglin','piglin_brute','hoglin','zoglin',
                      'wither_skeleton','blaze','ghast','magma_cube' ];
const NETHER_HOME_GROUND = 24;             // 建造模式「巨大地下室」地表草坪顶层(地形暂时复用它的场景)
const NETHER_HOME_PORTAL = { px: 61, pz: 88 };   // 上界: 地表入口下界传送门(框架底边贴地表)
const NETHER_GROUND = 20;                  // 下界平地顶层 y(脚踩 y=21) — 下界地面是平的(用户拍板)
const NETHER_RETURN_PORTAL = { by: NETHER_GROUND, px: 24, pz: 24 };   // 下界回程传送门: 落地就在它跟前(门在身后)

/* ---------- 武器政策(手持物 def 只管观感, 伤害/触及/弹道是模式政策):
   剑 dmg 16(猪灵 24 血两刀, 锄头 10 → 换剑变强) · 触及 3.0(原版玩家攻击
   距离口径, 盖过下界近战怪 2.2~2.6 — 此前 1.8 反被怪先手);
   弓 dmg 10 · 冷却 0.55s(比剑 0.38 慢, 拉弓的时间) · 箭速 22 + 重力 9.5
   (竞技场箭矢同款弹道) — 近战贴身强/远程放风筝, 各有场景 */
const NETHER = { phase: 'overworld', wave: 0, waveInProgress: false,
                 killCount: 0, swingCd: 0, swingCdMax: 0.38, swingDmg: 16, meleeR: 3.0,
                 weapon: 'sword', bowCd: 0.55, bowDmg: 10, arrowSpeed: 22,
                 player: { hp: 30, maxHp: 30 } };
const NETHER_ATTACK_T = 0.5;                // 怪物挥击姿态时长(attackT 满时长, 近战/远程统一 — gait 第 4 参)
let pEnt = null;                          // 下界探险中的"主人公实体"(AI 索敌目标 + 受击/受死共用状态)
let nArrows = [];                         // 下界怪物投射(烈焰人爆裂火球/恶魂恶魂火球 → 玩家受击)
let hurtT = 0;                            // 受击语音节流计时(3 秒最多一句 — iOS TTS 频繁
                                          // cancel+speak 是掉帧源, 坦克表扬 praiseT 同款节流)

/* ---------- 主人公实体: AI 索敌 + 受击状态共用(同一套 MobCore 状态机) ---------- */
function getPEnt(){
  if(pEnt) return pEnt;
  pEnt = { pos, vel, cfg: { h: PLAYER.height, fly:false, ranged:false, dmg: NETHER.swingDmg,
                   range: NETHER.meleeR, cd:0, hitR:0.55, speed: PLAYER.speed,
                   hp: NETHER.player.hp, maxHp: NETHER.player.maxHp, dead:false, gone:false },
           hp: NETHER.player.hp, maxHp: NETHER.player.maxHp, dead:false, deadT:0,
           flashT:0, staggerT:0, tintBase:[1,1,1] };
  return pEnt;
}

/* ---------- 武器栏(mkHotbar 深接口): ⚔️剑/🏹弓 两槽 ----------
   数字键/滚轮/点选全自动(hotbar 样板吸收); 观感随手持物注册表走
   (Avatar.setItem), 伤害/弹道等战斗政策在 NETHER 常量, 不进 def */
const weaponBar = ModeKit.mkHotbar({
  items: [ { icon: '⚔️', lbl: '剑' }, { icon: '🏹', lbl: '弓' } ],
  onPick: i => netherSetWeapon(i === 1 ? 'bow' : 'sword'),
});
function netherSetWeapon(id){
  NETHER.weapon = id;
  Avatar.setItem(id);
  showToast(id === 'bow' ? '🏹 换弓 · 点击射箭' : '⚔️ 换剑 · 点击挥砍');
}

/* ---------- 下界地形: 平整下界岩地面 + 成片熔岩池(平地上的可见障碍, 绕开走) ---------- */
function buildNetherWorld(){
  for(let x=0; x<WORLD_W; x++)
    for(let z=0; z<WORLD_D; z++){
      for(let y=0; y<=NETHER_GROUND; y++) setBlockRaw(x, y, z, B_NETHERRACK);   // 平整地面
      if(x < 44 && z < 44) continue;                     // 出生区/回程门/首波怪物环: 不铺熔岩
      if(hashRand(Math.floor(x/3)*11 + Math.floor(z/3)*7, Math.floor(z/3)*13) > 0.93)
        setBlockRaw(x, NETHER_GROUND, z, B_LAVA);        // 3×3 成片的熔岩池
    }
}

/* ---------- 上界地形: 建造模式精选场景「巨大地下室」(临时复用) + 地表下界传送门 ---------- */
function buildOverworldWorld(){
  if(typeof buildBasementScene === 'function') buildBasementScene();   // 地形暂时就和建造模式里的地下室模式一样
  buildPortalFrame(NETHER_HOME_GROUND, NETHER_HOME_PORTAL.px, NETHER_HOME_PORTAL.pz);
}

/* ---------- 下界传送门: 黑曜石框架 4×5(宽×高, Minecraft 下界传送门最小尺寸) + 内口 2×3 ----------
   by 为框架底边(贴地表) · px/pz 为框架位置(x/z) · 内口 = 框架面积 - 边框环(2 宽 × 3 高) */
function buildPortalFrame(by, px, pz){
  for(let x=px; x<=px+NETHER_PORTAL_W-1; x++) setBlockRaw(x, by, pz, B_OBSIDIAN);                 // 底边
  for(let x=px; x<=px+NETHER_PORTAL_W-1; x++) setBlockRaw(x, by+NETHER_PORTAL_H-1, pz, B_OBSIDIAN); // 顶边
  for(let y=by+1; y<=by+NETHER_PORTAL_H-2; y++){
    setBlockRaw(px, y, pz, B_OBSIDIAN);
    setBlockRaw(px+NETHER_PORTAL_W-1, y, pz, B_OBSIDIAN);
  }
}
/* 玩家是否站在传送门内口里(已踏入内口 y 区间, x/z 落在开口范围内) */
function inPortal(by, px, pz){
  const p = getPEnt().pos;
  return p.y >= by && p.y < by + NETHER_PORTAL_H - 1
      && p.x > px && p.x < px + NETHER_PORTAL_W - 1
      && Math.abs(p.z - pz) < 1.5;
}

/* ---------- 下界氛围: 暗红天穹 + 近雾 + 收起太阳(回上界恢复 world.js 默认天蓝) ----------
   纯渲染态切换, Node 单测无渲染场景时静默跳过 */
const NETHER_SKY = { color: 0x2a0a08, fogNear: 26, fogFar: 120, sunI: 0.3 };
const OVERWORLD_SKY = { color: 0x8fc7ff, fogNear: 90, fogFar: 230, sunI: 0.75 };   // 与 world.js 初始值一致
function applySky(k){
  if(typeof scene === 'undefined' || !scene.fog) return;
  scene.background.set(k.color);
  scene.fog.color.set(k.color);
  scene.fog.near = k.fogNear;
  scene.fog.far = k.fogFar;
  if(typeof sun !== 'undefined') sun.intensity = k.sunI;
  if(typeof sunSprites !== 'undefined') for(const s of sunSprites) s.visible = (k === OVERWORLD_SKY);   // 下界收起太阳
}

/* ---------- 阶段切换: 上界 ↔ 下界 ---------- */
function enterNether(){
  NETHER.phase = 'nether';
  loadScene(()=>{                                       // 场景装填 seam: 清上界(不清 → 家的草坪/小屋浮在下界岩上面) + 建下界 + 收尾
    buildNetherWorld();
    buildPortalFrame(NETHER_RETURN_PORTAL.by, NETHER_RETURN_PORTAL.px, NETHER_RETURN_PORTAL.pz);   // 落地就有回程门
  });
  applySky(NETHER_SKY);                                // 暗红天穹: 一眼就知道到了下界
  Mobs.clear();
  NETHER.wave = 0; NETHER.killCount = 0; NETHER.waveInProgress = false;
  startNetherWave();
  ModeKit.spawn(25.5, NETHER_GROUND + 1, 27.5, { yaw: Math.PI });   // 从回程门前走出(门在身后, 面朝下界)
  flyMode = false;                                     // 冒险模式步行(不沿用建造的飞行)
  NETHER.swingCd = 0;                                  // 传送落地即可战斗(不留挥击锁)
  hurtT = 0;                                           // 受击语音节流复位
  weaponBar.show();                                    // 武器栏现身(上界不放武器)
  Avatar.setItem(NETHER.weapon);                       // 进下界自动武装(记住上次的选择)
  SpeechKit.speak('进了下界！回程传送门就在身后！怪物来了！');
  showToast('🌀 传送进下界！');
}
function enterOverworld(){
  NETHER.phase = 'overworld';
  loadScene(buildOverworldWorld);                       // 场景装填 seam: 清下界残留, 家原样重建
  applySky(OVERWORLD_SKY);
  ModeKit.spawn(62.5, NETHER_HOME_GROUND + 1, 85.5, { yaw: Math.PI });   // 家门口(传送门南侧几步, 不站门里)
  flyMode = false;
  Mobs.clear();
  NETHER.wave = 0; NETHER.killCount = 0; NETHER.waveInProgress = false;
  NETHER.swingCd = 0;
  hurtT = 0;                                           // 受击语音节流复位
  weaponBar.hide();                                    // 上界不放武器(回程即收)
  Avatar.setItem(PLAYER.heldItem);                     // 回上界换回默认手持物(锄头)
  SpeechKit.speak('回到上界啦');
}

/* ---------- 下界波次: 释放一波 hostile 怪物 → 空了再来一波 ---------- */
function startNetherWave(){
  NETHER.waveInProgress = true;
  const count = 2 + NETHER.wave;                       // wave0 → 2 只, 之后每波 +1
  const types = NETHER_MOBS.slice();
  for(let i=types.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); const t=types[i]; types[i]=types[j]; types[j]=t; }
  for(let i=0; i<count; i++){
    const type = types[i % types.length];
    const a = Math.random()*Math.PI*2, rr = 6 + Math.random()*8;      // 离出生点 6~14 格(看得见来袭, 不贴脸)
    Mobs.spawn(type, Math.floor(25 + Math.cos(a)*rr), Math.floor(28 + Math.sin(a)*rr),
      { yaw: 0, label: { prefix: '下界 ', color: '#ff9a3c' } });
  }
  NETHER.wave++;
}
function checkWaveClear(){
  if(!NETHER.waveInProgress) return;
  if(Mobs.list().some(m => !m.dead && !m.gone)) return;
  NETHER.waveInProgress = false;
  SpeechKit.speak('打得漂亮！新怪物来啦！');
  startNetherWave();
}

/* ---------- 主人公攻击: 武器栏当前武器 — 剑=近战挥击(即时判定) / 弓=射箭(弹道飞行) ---------- */
function netherAttack(){
  if(NETHER.swingCd > 0) return;
  const bow = NETHER.weapon === 'bow';
  NETHER.swingCd = bow ? NETHER.bowCd : NETHER.swingCdMax;
  Avatar.swing();                          // 出手观感(桌面由 input 先行调用; 触屏 👾 按钮从这里补上; 弓=放箭短促前推, 随 def)
  if(bow){ netherShootArrow(); return; }
  const p = getPEnt();
  let best = null, bd = NETHER.meleeR * NETHER.meleeR;
  for(const m of Mobs.list()){
    if(m.dead || m.gone) continue;
    const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z;
    const d = dx*dx + dz*dz;
    if(d > bd) continue;
    if(Math.abs(m.pos.y - p.pos.y) > 2.5) continue;
    if(d < bd){ bd = d; best = m; }
  }
  if(!best) return;
  const r = Mobs.hit(best, NETHER.swingDmg, best.pos.x - p.pos.x, best.pos.z - p.pos.z, 0.35);
  sfx('hit');
  if(r.freshDead) netherOnKill(best);
}

function netherOnKill(m){
  NETHER.killCount++;
  Fx.debrisBurst(m.pos.x, m.pos.y + 0.8, m.pos.z, 6, { color: Mobs.debrisColor(m.type), life: 0.6 });
  showToast('👾 消灭 ' + NETHER.killCount);
  checkWaveClear();
}

/* ---------- 受击提醒(非致命): 身体变红 + 受击音 + 震屏 + 节流语音 ----------
   主提醒是 Avatar.flash 身体闪红(直观即见); 剩血不再走 toast — 头顶血条
   常驻可见(每帧刷新)。致命一击不走这里 — 死亡路径已有专属文案/话术(引擎
   death 音), 且 SpeechKit 是 cancel-then-speak, 后播的受击话术会把死亡话术顶掉 */
function netherOnHurt(r){
  sfx('hurt');                                    // 受击专属音(与"主人公打怪"的 hit 区分)
  Avatar.flash(0.4);                              // 主人公身体变红(主提醒)
  Fx.kick(0.35);                                  // 轻震屏(Fx 震屏入口, 主循环消费)
  if(hurtT <= 0){ hurtT = 3; SpeechKit.speak('哎呀被打中了！快躲开！'); }    // 语音 3 秒节流
}

/* ---------- 下界怪物 AI: 全部 hostile, 索敌=主人公 → 逼近/攻击/射击 ---------- */
function netherAI(dt){
  const p = getPEnt();
  for(const m of Mobs.list()){
    if(m.dead || m.gone) continue;
    const gp = m.pos;
    CombatCore.tickCadence(m, dt);                 // 攻击节拍(与竞技场同一条, 战斗核心)
    if(!m.target || m.dead || m.gone) m.target = p;
    const tg = m.target;
    const dx = tg.pos.x - gp.x, dz = tg.pos.z - gp.z;
    const dist = Math.hypot(dx, dz);
    Mobs.steer(m, Math.atan2(dx, dz));
    const speed = m.cfg.speed || 2;
    let moved = 0;                          // 本帧实际移动速度(喂步态用)

    if(m.cfg.fly){
      if(m.cfg.ranged){
        const want = (m.type === 'blaze') ? 7 : 10;          // 炮台巡航距离(烈焰人绕近, 恶魂拉开)
        const sp = Math.min(speed, 3);
        if(dist > want){ Mobs.move(m, dx/dist*sp*dt, dz/dist*sp*dt); moved = sp; }
        else if(dist < want - 1.5){ Mobs.move(m, -dx/dist*sp*dt, -dz/dist*sp*dt); moved = sp; }
        if(Math.abs(tg.pos.y - gp.y) < 3 && dist <= want && m.attackCd <= 0){
          m.attackCd = m.cfg.cd; m.attackT = NETHER_ATTACK_T;
          netherShoot(m, tg);
        }
      }
    } else {
      if(dist > m.cfg.range){                                   // 逼近
        Mobs.move(m, dx/dist*speed*dt, dz/dist*speed*dt); moved = speed;
      } else if(Math.abs(tg.pos.y - gp.y) < 2.5 && m.attackCd <= 0){   // 近战攻击玩家
        m.attackCd = m.cfg.cd; m.attackT = NETHER_ATTACK_T;
        const r = Mobs.hit(p, Math.round(m.cfg.dmg*(m.dmgMult||1)), p.pos.x - gp.x, p.pos.z - gp.z, 0.4);
        if(r.freshDead) netherPlayerDied(); else netherOnHurt(r);
      }
    }
    /* 步态+战斗姿态: 与竞技场同一条怪物库 gait 入口(此前下界只跑 AI 不喂步态 —
       怪连走路都不摆腿; 第 4 参 = attackT 满时长 → 有臂挥臂(挥击手=持械手)/无臂头前扑) */
    Mobs.gait(m, dt, moved, NETHER_ATTACK_T);
  }
}

/* 飞行怪投射(烈焰人爆裂火球 / 恶魂恶魂火球): 预测弹道(战斗核心 leadAim,
   与竞技场箭矢同一套提前量+重力补偿 — 原直线弹道对移动中的主人公常打空) */
let nFireGeo = null, nFireMat = null;                 // 火球几何/材质全局共用(移除只摘网格)
function netherShoot(m, tg){
  sfx('shoot');
  const from = { x: m.pos.x, y: m.pos.y + (m.cfg.h||1.8)*0.55, z: m.pos.z };
  const dir = CombatCore.leadAim(from,
    { x: tg.pos.x, y: tg.pos.y, z: tg.pos.z, vx: tg.vel.x, vz: tg.vel.z, h: tg.cfg.h },
    17, 6, 0.5);
  let mesh = null;
  if(typeof THREE !== 'undefined' && typeof scene !== 'undefined'){
    if(!nFireGeo){ nFireGeo = new THREE.SphereGeometry(0.16, 6, 6); nFireMat = new THREE.MeshBasicMaterial({color:0xffa53c}); }
    mesh = new THREE.Mesh(nFireGeo, nFireMat);
    mesh.position.set(from.x, from.y, from.z);
    scene.add(mesh);
  }
  nArrows.push({ owner: m, mesh, from, vel: { x: dir.x*17, y: dir.y*17, z: dir.z*17 },
                 life: 2.5, dmg: Math.round(m.cfg.dmg), kpow: 1.0, g: 6 });
}
/* 主人公射箭(弓): 沿准星方向(CameraRig.lookDir 相机装置的唯一视线入口),
   竞技场箭矢同款重力弹道(箭速/伤害是 NETHER 政策常量) */
let nArrowGeo = null, nArrowMat = null;               // 玩家箭矢几何/材质全局共用(移除只摘网格)
function netherShootArrow(){
  sfx('shoot');
  const d = CameraRig.lookDir();
  const from = { x: pos.x + d.x*0.3, y: pos.y + (PLAYER.eye || 1.6) + d.y*0.3, z: pos.z + d.z*0.3 };   // 眼位前移 0.3: 第一人称不贴相机, 贴墙不误判撞块
  let mesh = null;
  if(typeof THREE !== 'undefined' && typeof scene !== 'undefined'){
    if(!nArrowGeo){ nArrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.62); nArrowMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d0 }); }
    mesh = new THREE.Mesh(nArrowGeo, nArrowMat);
    mesh.position.set(from.x, from.y, from.z);
    scene.add(mesh);
  }
  nArrows.push({ fromPlayer: true, mesh, from, vel: { x: d.x*NETHER.arrowSpeed, y: d.y*NETHER.arrowSpeed, z: d.z*NETHER.arrowSpeed },
                 life: 3, dmg: NETHER.bowDmg, kpow: 0.35, g: 9.5 });
}
function removeNetherArrow(i){
  const a = nArrows[i];
  if(a.mesh && typeof scene !== 'undefined') scene.remove(a.mesh);
  nArrows.splice(i, 1);
}
function updateNetherArrows(dt){
  const p = getPEnt();
  for(let i=nArrows.length-1; i>=0; i--){
    const a = nArrows[i];
    a.vel.y -= (a.g || 6)*dt;
    a.life -= dt;
    const px = a.from.x + a.vel.x*dt, py = a.from.y + a.vel.y*dt, pz = a.from.z + a.vel.z*dt;
    a.from = { x: px, y: py, z: pz };
    if(a.mesh){
      a.mesh.position.set(px, py, pz);
      if(a.fromPlayer) a.mesh.lookAt(px + a.vel.x, py + a.vel.y, pz + a.vel.z);   // 箭头朝飞行方向(火球是球, 不用转)
    }
    if(getBlock(Math.floor(px), Math.floor(py), Math.floor(pz)) !== 0 || a.life <= 0){ removeNetherArrow(i); continue; }
    if(a.fromPlayer){                              // 主人公的箭 → 打怪(同一套盒判定, 战斗核心)
      let hitMob = null;
      for(const m of Mobs.list()){
        if(m.dead || m.gone) continue;
        if(CombatCore.hitBody({ x: px, y: py, z: pz }, m)){ hitMob = m; break; }
      }
      if(hitMob){
        const r = Mobs.hit(hitMob, a.dmg, hitMob.pos.x - px, hitMob.pos.z - pz, a.kpow);
        sfx('hit');
        if(r.freshDead) netherOnKill(hitMob);
        removeNetherArrow(i);
      }
    } else if(!p.dead && CombatCore.hitBody({x:px, y:py, z:pz}, p)){     // 怪的火球 → 命中主人公(与竞技场箭矢同一判定, 战斗核心)
      const r = Mobs.hit(p, a.dmg, p.pos.x - px, p.pos.z - pz, a.kpow);
      if(r.freshDead) netherPlayerDied(); else netherOnHurt(r);
      removeNetherArrow(i);
    }
  }
}

/* ---------- 玩家阵亡: 下界重生 ---------- */
function netherPlayerDied(){
  const e = getPEnt();
  e.hp = NETHER.player.maxHp;                          // 实体血量同步回满(不回满 → 重生后被一碰再死)
  e.dead = false; e.deadT = 0; e.flashT = 0; e.staggerT = 0; e.tintBase = [1,1,1];
  NETHER.player.hp = NETHER.player.maxHp;
  ModeKit.spawn(25.5, NETHER_GROUND + 1, 27.5, { yaw: Math.PI });   // 回下界出生点(回程门前)
  flyMode = false;
  SpeechKit.speak('被怪物追上了！回出生点！');
  showToast('💀 被怪物打死了，回出生点！');
}

/* ---------- 主人公头顶血条(下界常驻): canvas 贴图 Sprite, 头顶 2.2 格 ----------
   血量变化才重绘(逐帧纹理上传是移动端掉帧源); 无 THREE/DOM 的 Node 单测
   环境静默跳过(渲染态不参与行为断言) */
let pHpBar = null, pHpCtx = null, pHpTex = null, pHpLast = -1;
function ensureHpBar(){
  if(pHpBar || typeof THREE === 'undefined' || typeof document === 'undefined' || typeof scene === 'undefined') return;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16;
  pHpCtx = cv.getContext('2d');
  pHpTex = new THREE.CanvasTexture(cv);
  pHpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: pHpTex, transparent: true }));
  pHpBar.scale.set(1.5, 0.19, 1);                     // 128×16 的等比世界尺寸
  scene.add(pHpBar);
}
function updateHpBar(){
  ensureHpBar();
  if(!pHpBar) return;
  pHpBar.visible = NETHER.phase === 'nether';         // 上界头顶不放血条
  if(!pHpBar.visible) return;
  const hp = Math.max(0, Math.ceil(getPEnt().hp));
  if(hp !== pHpLast){                                 // 血量变化才重绘
    pHpLast = hp;
    const c = pHpCtx, W = 128;
    c.clearRect(0, 0, W, 16);
    c.fillStyle = 'rgba(16,16,20,0.82)'; c.fillRect(14, 3, W - 16, 10);        // 底槽
    c.fillStyle = '#e83a3a'; c.fillRect(16, 5, Math.max(0, (W - 20) * hp / NETHER.player.maxHp), 6);   // 血量
    c.strokeStyle = '#f0f0f0'; c.lineWidth = 1; c.strokeRect(14.5, 3.5, W - 17, 9);
    c.fillStyle = '#ff5a5a'; c.font = '13px sans-serif'; c.textBaseline = 'top'; c.fillText('❤', 1, 1);
    pHpTex.needsUpdate = true;
  }
  pHpBar.position.set(pos.x, pos.y + 2.2, pos.z);     // 头顶(身高 1.8 + 余量; billboard 正面视角也常读)
}
function disposeHpBar(){
  if(!pHpBar) return;
  if(typeof scene !== 'undefined') scene.remove(pHpBar);
  pHpBar.material.dispose(); pHpTex.dispose();
  pHpBar = null; pHpCtx = null; pHpTex = null; pHpLast = -1;
}

/* ============================================================
   模式对象
   ============================================================ */
const NetherMode = mkMode({
  id: 'nether',

  hotbar: weaponBar,                     // 武器栏: mkHotbar(数字键/滚轮/点选全自动)
  chrome: { hotbar: 'deferred' },        // 上界先藏, 进下界现身(enterNether 里 show)

  init(){
    enterOverworld();
  },

  cleanup(){
    Mobs.clear();
    while(nArrows.length) removeNetherArrow(0);      // 火球/箭矢网格一并摘除
    NETHER.wave = 0; NETHER.killCount = 0; NETHER.waveInProgress = false;
    applySky(OVERWORLD_SKY);                         // 天空复位: 红天不渗进其他模式
    Avatar.setItem(PLAYER.heldItem);                 // 手持物复位: 剑/弓不渗进其他模式(Avatar 跨模式存活)
    weaponBar.hide();                                // 武器栏复位
    disposeHpBar();                                  // 头顶血条网格/纹理回收
  },

  update(dt){
    if(NETHER.swingCd > 0) NETHER.swingCd = Math.max(0, NETHER.swingCd - dt);
    hurtT = Math.max(0, hurtT - dt);         // 受击语音节流递减
    if(NETHER.phase === 'overworld'){
      if(inPortal(NETHER_HOME_GROUND, NETHER_HOME_PORTAL.px, NETHER_HOME_PORTAL.pz)) enterNether();
    } else {
      if(inPortal(NETHER_RETURN_PORTAL.by, NETHER_RETURN_PORTAL.px, NETHER_RETURN_PORTAL.pz)) enterOverworld();
    }
    netherAI(dt);
    Mobs.update(dt);
    Mobs.render();
    updateNetherArrows(dt);
    updateHpBar();
    checkWaveClear();
  },

  onMouse(button){
    if(button === 0 || button === 2) netherAttack();   // 左键/右键都当挥击
  },

  /* onMenu 不声明 → Esc/B 走 mkMode 默认: 回本模式出发页(showPage('nether')), 与坦克/建造同款 */

  hud(){
    const alive = Mobs.list().filter(m => !m.dead && !m.gone).length;
    return [
      `阶段: ${NETHER.phase === 'overworld' ? '上界 · 有下界传送门' : '下界 · 怪物来袭'}`,
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      `❤️ 生命: ${Math.max(0, Math.ceil(getPEnt().hp))} / ${NETHER.player.maxHp}`,
      `👾 怪物: ${alive} · ☠️ 击杀: ${NETHER.killCount}`,
      `武器: ${NETHER.weapon === 'bow' ? '🏹 弓 · 点击射箭' : '⚔️ 剑 · 点击挥砍'}（1/2 键 · 滚轮 · 点武器栏切换）`,
      `B 菜单 · 打怪中`,
    ];
  },

  touch: [
    { label: '⬆️', hold: 'Space' },
    { label: '⬇️', hold: 'ShiftLeft' },
    { label: '👾', act: netherAttack },
  ],
});

if(typeof module !== 'undefined' && module.exports) module.exports = NetherMode;
