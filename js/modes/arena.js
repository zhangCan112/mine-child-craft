"use strict";
/* ============================================================
   竞技场模式:环形竞技场 + 双阵营怪物 PVP 对战
============================================================ */

/* ---------- 竞技场地形生成 ---------- */
function floorBlock(x,z,dx,dz,r){
  if(r < 8.6) return dx < 0 ? 16 : 15;             // 中央徽章 红西蓝东
  if(Math.abs(r-9.5) < 0.6 || Math.abs(r-30) < 0.6) return 17; // 石英环
  if(Math.hypot(dx+19, dz) < 3.3) return 16;       // 红方出生垫
  if(Math.hypot(dx-19, dz) < 3.3) return 15;       // 蓝方出生垫
  const t = hashRand(x*5+z, z*7+x);
  return t < 0.8 ? 3 : (t < 0.95 ? 4 : 14);
}
function wallBlock(x,y,z){
  const t = hashRand(x*7+z*3, y*13+z);
  return t < 0.7 ? 13 : (t < 0.9 ? 4 : 14);
}
function generate(){
  const G = ARENA.floorY;
  for(let x=0;x<WORLD_W;x++){
    for(let z=0;z<WORLD_D;z++){
      const dx = x+0.5-ARENA.cx, dz = z+0.5-ARENA.cz;
      const r = Math.hypot(dx,dz);
      for(let y=0;y<=G;y++) setBlockRaw(x,y,z,3);           // 地基
      if(r < ARENA.rIn-0.5)          setBlockRaw(x,G,z, floorBlock(x,z,dx,dz,r));
      else if(r <= ARENA.rOut+0.5)   setBlockRaw(x,G,z, wallBlock(x,G,z));
      else                           setBlockRaw(x,G,z, 1); // 外部草原
      if(r >= ARENA.rIn-0.5 && r <= ARENA.rOut+0.5){        // 环形墙 + 看台
        for(let y=G+1;y<=G+7;y++) setBlockRaw(x,y,z, wallBlock(x,y,z));
        setBlockRaw(x, G+8, z, hashRand(x*3,z) < 0.88 ? 13 : 4);
      }
      if(r >= ARENA.rIn-0.6 && r <= ARENA.rIn+0.6)          // 内侧玻璃护栏(1格,不挡视线)
        setBlockRaw(x, G+9, z, 18);
      if(r >= ARENA.rOut-0.6 && r <= ARENA.rOut+0.6){       // 外侧玻璃护栏(2格)
        setBlockRaw(x, G+9, z, 18);
        setBlockRaw(x, G+10, z, 18);
      }
      if(r > ARENA.rOut+7 && x>2 && z>2 && x<WORLD_W-3 && z<WORLD_D-3
         && hashRand(x+31, z+17) > 0.988) plantTree(x, G+1, z);
    }
  }
  for(let i=0;i<12;i++){                                    // 看台立柱 + 灯
    const a = i*Math.PI/6 + Math.PI/12;
    const px = Math.round(ARENA.cx + Math.cos(a)*(ARENA.rOut-1.4));
    const pz = Math.round(ARENA.cz + Math.sin(a)*(ARENA.rOut-1.4));
    for(let y=G+9;y<=G+11;y++) setBlockRaw(px,y,pz,13);
    setBlockRaw(px, G+12, pz, 19);
  }
}
function plantTree(x,baseY,z){
  const th = 4 + Math.floor(hashRand(x+7,z+3)*3);
  for(let i=0;i<th;i++) setBlockRaw(x, baseY+i, z, 5);
  const top = baseY+th;
  for(let dy=-1;dy<=1;dy++){
    const rad = dy===1?1:2;
    for(let dx=-rad;dx<=rad;dx++){
      for(let dz=-rad;dz<=rad;dz++){
        if(dx===0&&dz===0&&dy<1) continue;
        if(Math.abs(dx)===rad&&Math.abs(dz)===rad&&rad===2) continue;
        const lx=x+dx, ly=top+dy-1, lz=z+dz;
        if(getBlock(lx,ly,lz)===0) setBlockRaw(lx,ly,lz,7);
      }
    }
  }
  setBlockRaw(x, top, z, 7);
}
function spawnPlayer(){
  const sx = ARENA.cx;                              // 南侧看台正中
  const sz = ARENA.cz + (ARENA.rIn + ARENA.rOut)/2; // 走道中心
  const sy = groundTop(sx, sz);
  pos.set(sx+0.5, sy+1.0, sz+0.5);
  vel.set(0,0,0);
  yaw = 0; pitch = -0.22;                           // 面朝 -Z 俯瞰全场
}

/* ---------- 怪物类型 ----------
   特有技能: 僵尸=狂暴(半血加速+群体冲锋) 骷髅=强力箭(每3箭)
             苦力怕=扑袭(跃进扑脸) 铁傀儡=震地(震慑+震落) 末影龙=龙息毒云 */
const MOB_TYPES = {
  zombie:  {name:'僵尸',   hp:30,  dmg:5,  speed:2.3, range:2.1, cd:1.1, h:1.9, hitR:0.55, power:170},
  skeleton:{name:'骷髅',   hp:26,  dmg:6,  speed:2.6, range:14,  cd:2.6, h:1.9, ranged:true, hitR:0.55, power:165},
  creeper: {name:'苦力怕', hp:28,  dmg:33, speed:3.1, range:2.0, cd:9,   h:1.7, boom:true, hitR:0.5, power:195},
  golem:   {name:'铁傀儡', hp:110, dmg:15, speed:2.0, range:3.0, cd:1.6, h:2.8, hitR:1.0, power:1000},
  dragon:  {name:'末影龙', hp:300, dmg:7,  speed:4.4, range:17,  cd:4.5, h:3.0, fly:true, hitR:2.2, power:2000},
  mix:     {name:'混合编队', hp:0, dmg:0, speed:0, range:0, cd:0, h:2, power:0}
};
// 混合编队战力 = 各兵种平均值
const MIX_POOL = ['zombie','skeleton','creeper','golem','dragon'];
MOB_TYPES.mix.power = Math.round(MIX_POOL.reduce((s,k)=>s+MOB_TYPES[k].power,0) / MIX_POOL.length);

/* ---------- 升级系统 ----------
   个人击杀累积信用(劣势方×加成), 达标晋升:
   2级精英=属性暴涨+现有技能强化  3级王者=解锁新技能
   阈值随敌方初始数量缩放(25%/60%), 封顶 6/14 杀 */
const TIER_MULT = {2:{hp:1.6, dmg:1.4, spd:1.1}, 3:{hp:2.5, dmg:2.0, spd:1.2}};
const TIER_NAME = {2:'精英', 3:'王者'};
const COUNTER = {zombie:'skeleton', skeleton:'creeper', creeper:'golem', golem:'zombie'};  // A克B(龙另行特判)
let teamInitHp = {A:1, B:1};          // 劣势加成基准(开战时总HP)
const pendingBooms = [];              // 王者苦力怕·连环爆破二段
const beams = [];                     // 升级光柱

function angleLerp(a, b, t){
  let d = (b - a) % (Math.PI*2);
  if(d >  Math.PI) d -= Math.PI*2;
  if(d < -Math.PI) d += Math.PI*2;
  return a + d*Math.min(1, t);
}
/* 狂暴/群体冲锋 速度系数 */
function mobSpeed(m){
  let s = m.cfg.speed;
  if(m.raged)      s *= 1.5;
  if(m.rageBuffT > 0) s *= 1.25;
  if(m.level===2)  s *= 1.1;
  else if(m.level===3) s *= 1.2;
  return s;
}
const mkBox = (w,h,d,m)=> new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);

function buildZombie(){
  const skin  = new THREE.MeshLambertMaterial({color:0x5e9440});
  const shirt = new THREE.MeshLambertMaterial({color:0x2e7a70});
  const pants = new THREE.MeshLambertMaterial({color:0x4a3f70});
  const dark  = new THREE.MeshLambertMaterial({color:0x1c2b16});
  const mats = [skin,shirt,pants,dark];
  const g = new THREE.Group();
  const legL = new THREE.Group(); legL.position.set(-0.13,0.75,0);
  legL.add(mkBox(0.24,0.75,0.24,pants)); legL.children[0].position.y=-0.375;
  const legR = new THREE.Group(); legR.position.set(0.13,0.75,0);
  legR.add(mkBox(0.24,0.75,0.24,pants)); legR.children[0].position.y=-0.375;
  const body = mkBox(0.5,0.75,0.26,shirt); body.position.y = 1.12;
  const armL = new THREE.Group(); armL.position.set(-0.37,1.42,0);
  armL.add(mkBox(0.2,0.72,0.2,skin)); armL.children[0].position.y=-0.34;
  armL.rotation.x = -1.45;
  const armR = new THREE.Group(); armR.position.set(0.37,1.42,0);
  armR.add(mkBox(0.2,0.72,0.2,skin)); armR.children[0].position.y=-0.34;
  armR.rotation.x = -1.45;
  const head = new THREE.Group(); head.position.y = 1.5;
  const skull = mkBox(0.5,0.5,0.5,skin); skull.position.y=0.25; head.add(skull);
  const eL = mkBox(0.1,0.08,0.04,dark); eL.position.set(-0.12,0.3,0.26); head.add(eL);
  const eR = mkBox(0.1,0.08,0.04,dark); eR.position.set( 0.12,0.3,0.26); head.add(eR);
  g.add(legL,legR,body,armL,armR,head);
  return {group:g, parts:{legL,legR,armL,armR,head}, mats};
}

function buildSkeleton(){
  const bone  = new THREE.MeshLambertMaterial({color:0xd8d8d2});
  const bone2 = new THREE.MeshLambertMaterial({color:0xb8b8b0});
  const dark  = new THREE.MeshLambertMaterial({color:0x1a1a1a});
  const wood  = new THREE.MeshLambertMaterial({color:0x6b4a2a});
  const mats = [bone,bone2,dark,wood];
  const g = new THREE.Group();
  const legL = new THREE.Group(); legL.position.set(-0.1,0.75,0);
  legL.add(mkBox(0.16,0.75,0.16,bone2)); legL.children[0].position.y=-0.375;
  const legR = new THREE.Group(); legR.position.set(0.1,0.75,0);
  legR.add(mkBox(0.16,0.75,0.16,bone2)); legR.children[0].position.y=-0.375;
  const body = mkBox(0.5,0.72,0.24,bone); body.position.y = 1.11;
  const armL = new THREE.Group(); armL.position.set(-0.34,1.4,0);
  armL.add(mkBox(0.16,0.72,0.16,bone)); armL.children[0].position.y=-0.34;
  const bow = mkBox(0.07,0.6,0.09,wood); bow.position.set(0,-0.72,0.1); armL.add(bow);
  const armR = new THREE.Group(); armR.position.set(0.34,1.4,0);
  armR.add(mkBox(0.16,0.72,0.16,bone)); armR.children[0].position.y=-0.34;
  const head = new THREE.Group(); head.position.y = 1.47;
  const skull = mkBox(0.5,0.5,0.5,bone); skull.position.y=0.25; head.add(skull);
  const eL = mkBox(0.12,0.1,0.04,dark); eL.position.set(-0.12,0.3,0.26); head.add(eL);
  const eR = mkBox(0.12,0.1,0.04,dark); eR.position.set( 0.12,0.3,0.26); head.add(eR);
  const nose = mkBox(0.08,0.08,0.04,dark); nose.position.set(0,0.18,0.26); head.add(nose);
  g.add(legL,legR,body,armL,armR,head);
  return {group:g, parts:{legL,legR,armL,armR,head}, mats};
}

function buildCreeper(){
  const green = new THREE.MeshLambertMaterial({color:0x4fae4f});
  const green2= new THREE.MeshLambertMaterial({color:0x3d8f3d});
  const dark  = new THREE.MeshLambertMaterial({color:0x101510});
  const mats = [green,green2,dark];
  const g = new THREE.Group();
  // 对角腿对 (两组合并成 legL/legR)
  const legL = new THREE.Group(); legL.position.set(0,0.42,0);
  const la = mkBox(0.26,0.42,0.28,green2); la.position.set(-0.14,-0.21, 0.18); legL.add(la);
  const lb = mkBox(0.26,0.42,0.28,green2); lb.position.set( 0.14,-0.21,-0.18); legL.add(lb);
  const legR = new THREE.Group(); legR.position.set(0,0.42,0);
  const ra = mkBox(0.26,0.42,0.28,green2); ra.position.set( 0.14,-0.21, 0.18); legR.add(ra);
  const rb = mkBox(0.26,0.42,0.28,green2); rb.position.set(-0.14,-0.21,-0.18); legR.add(rb);
  const body = mkBox(0.44,0.9,0.3,green); body.position.y = 0.85;
  const head = new THREE.Group(); head.position.y = 1.28;
  const skull = mkBox(0.5,0.5,0.5,green); skull.position.y=0.25; head.add(skull);
  const eL = mkBox(0.12,0.12,0.05,dark); eL.position.set(-0.13,0.32,0.26); head.add(eL);
  const eR = mkBox(0.12,0.12,0.05,dark); eR.position.set( 0.13,0.32,0.26); head.add(eR);
  const m1 = mkBox(0.26,0.1,0.05,dark);  m1.position.set(0,0.13,0.26); head.add(m1);
  const m2 = mkBox(0.1,0.16,0.05,dark);  m2.position.set(0,0.05,0.26); head.add(m2);
  g.add(legL,legR,body,head);
  return {group:g, parts:{legL,legR,head}, mats};
}

function buildGolem(){
  const iron  = new THREE.MeshLambertMaterial({color:0xcdd0d8});
  const iron2 = new THREE.MeshLambertMaterial({color:0xaab0bb});
  const dark  = new THREE.MeshLambertMaterial({color:0x555a63});
  const eyeM  = new THREE.MeshBasicMaterial({color:0xff2a1a});
  const mats = [iron,iron2,dark,eyeM];
  const g = new THREE.Group();
  const legL = new THREE.Group(); legL.position.set(-0.34, 0.85, 0);
  legL.add(mkBox(0.5,0.85,0.5,iron2)); legL.children[0].position.y = -0.425;
  const legR = new THREE.Group(); legR.position.set( 0.34, 0.85, 0);
  legR.add(mkBox(0.5,0.85,0.5,iron2)); legR.children[0].position.y = -0.425;
  const body = mkBox(1.35,1.5,0.85,iron); body.position.y = 1.6;
  const armL = new THREE.Group(); armL.position.set(-0.87, 2.28, 0);
  armL.add(mkBox(0.45,1.55,0.45,iron)); armL.children[0].position.y = -0.775;
  const armR = new THREE.Group(); armR.position.set( 0.87, 2.28, 0);
  armR.add(mkBox(0.45,1.55,0.45,iron)); armR.children[0].position.y = -0.775;
  const head = new THREE.Group(); head.position.set(0, 2.35, 0);
  const skull = mkBox(0.72,0.66,0.72,iron); skull.position.y = 0.35; head.add(skull);
  const nose = mkBox(0.16,0.34,0.16,dark); nose.position.set(0,0.28,0.42); head.add(nose);
  const eL = mkBox(0.13,0.09,0.05,eyeM); eL.position.set(-0.17,0.44,0.37); head.add(eL);
  const eR = mkBox(0.13,0.09,0.05,eyeM); eR.position.set( 0.17,0.44,0.37); head.add(eR);
  g.add(legL, legR, body, armL, armR, head);
  return {group:g, parts:{legL,legR,armL,armR,head}, mats};
}

function buildDragon(){
  const body = new THREE.MeshLambertMaterial({color:0x16161f});
  const dark = new THREE.MeshLambertMaterial({color:0x262633});
  const memb = new THREE.MeshLambertMaterial({color:0x3a2055, side:THREE.DoubleSide});
  const eyeM = new THREE.MeshBasicMaterial({color:0xd06bff});
  const mats = [body,dark,memb,eyeM];
  const g = new THREE.Group();
  // 躯干 + 腹板
  const torso = mkBox(1.7,1.3,3.4,body); torso.position.set(0,1.15,0);
  const belly = mkBox(1.5,0.35,3.0,dark); belly.position.set(0,0.45,0);
  // 颈 (前伸 +Z)
  const neck = mkBox(0.75,0.75,1.7,body); neck.position.set(0,1.5,2.3); neck.rotation.x = 0.25;
  // 头
  const head = new THREE.Group(); head.position.set(0,1.85,3.3);
  const skull = mkBox(0.95,0.85,1.2,body); head.add(skull);
  const snout = mkBox(0.6,0.45,0.7,dark); snout.position.set(0,-0.12,0.9); head.add(snout);
  const eL = mkBox(0.14,0.12,0.1,eyeM); eL.position.set(-0.32,0.18,0.35); head.add(eL);
  const eR = mkBox(0.14,0.12,0.1,eyeM); eR.position.set( 0.32,0.18,0.35); head.add(eR);
  const hL = mkBox(0.16,0.55,0.16,dark); hL.position.set(-0.3,0.6,-0.35); head.add(hL);
  const hR = mkBox(0.16,0.55,0.16,dark); hR.position.set( 0.3,0.6,-0.35); head.add(hR);
  // 尾巴三节
  const t1 = mkBox(0.95,0.85,1.5,body); t1.position.set(0,1.15,-2.3);
  const t2 = mkBox(0.7,0.6,1.4,body);   t2.position.set(0,1.2,-3.5);
  const t3 = mkBox(0.45,0.4,1.3,dark);  t3.position.set(0,1.25,-4.6);
  // 双翼 (枢轴在肩)
  const wingL = new THREE.Group(); wingL.position.set(-0.85,1.75,0.2);
  const wl1 = mkBox(3.2,0.12,2.2,memb); wl1.position.set(-1.6,0,0); wingL.add(wl1);
  const wl2 = mkBox(1.8,0.1,1.4,memb);  wl2.position.set(-3.9,-0.05,-0.2); wingL.add(wl2);
  const wingR = new THREE.Group(); wingR.position.set(0.85,1.75,0.2);
  const wr1 = mkBox(3.2,0.12,2.2,memb); wr1.position.set(1.6,0,0); wingR.add(wr1);
  const wr2 = mkBox(1.8,0.1,1.4,memb);  wr2.position.set(3.9,-0.05,-0.2); wingR.add(wr2);
  // 悬垂后腿
  const legL = mkBox(0.32,1.0,0.45,dark); legL.position.set(-0.55,0.25,-1.1);
  const legR = mkBox(0.32,1.0,0.45,dark); legR.position.set( 0.55,0.25,-1.1);
  g.add(torso,belly,neck,head,t1,t2,t3,wingL,wingR,legL,legR);
  return {group:g, parts:{wingL,wingR,head}, mats};
}

const BUILDERS = { zombie:buildZombie, skeleton:buildSkeleton, creeper:buildCreeper, golem:buildGolem, dragon:buildDragon };

/* ---------- 怪物实例 / 战斗 ---------- */
const mobs = [];
const fusingCreeps = [];  // 每帧收集:正在读条的苦力怕(逃跑AI用,避免O(n²))
const sepGrid = new Map();   // 挤开检测用的空间网格(1×1 格)
let mobId = 0;
let battleState = 'idle';   // idle | fighting | over
let battleResult = '';

const arrows = [];
const arrowGeo = new THREE.BoxGeometry(0.07,0.07,0.8);
const arrowMat = new THREE.MeshLambertMaterial({color:0x3a2c1c});
const arrowPowerMat = new THREE.MeshBasicMaterial({color:0xfff2b0});   // 强力箭(亮白)
const breathBalls = [];
const clouds = [];

function spawnMob(team, type, x, z){
  const cfg = MOB_TYPES[type];
  const built = BUILDERS[type]();
  const lc = document.createElement('canvas'); lc.width=160; lc.height=40;
  const ltex = new THREE.CanvasTexture(lc);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({map:ltex, transparent:true, depthTest:false}));
  label.scale.set(2.6, 0.65, 1);
  scene.add(built.group); scene.add(label);
  const m = {
    id:mobId++, team, type, cfg,
    group:built.group, parts:built.parts, mats:built.mats,
    label, labelCanvas:lc, labelTex:ltex,
    pos:new THREE.Vector3(x, cfg.fly ? ARENA.floorY+ARENA.flyAlt : groundTop(Math.floor(x), Math.floor(z))+1, z),
    yaw: team==='A' ? Math.PI/2 : -Math.PI/2,
    hp:cfg.hp, maxHp:cfg.hp, dead:false, deadT:0, gone:false,
    target:null, retargetT:Math.random()*0.5,
    attackT:0, attackCd:0.6+Math.random()*0.6, staggerT:0, flashT:0,
    walkPhase:Math.random()*6, speedNow:0, wanderT:0, fuse:-1,
    vx:0, vz:0, strafeT:0, strafeDir:1,
    air:false, vy:0, jumpVX:0, jumpVZ:0, slamming:false,
    slamCd:2+Math.random()*3, pounceCd:2+Math.random()*3,
    shotCnt:0, raged:false, rageBuffT:0,
    level:1, kills:0, k2:2, k3:5, dmgMult:1, invulnT:0, rockCd:2,
    baseMaxHp:cfg.hp, tierScale:1, tierFx:null, tierMats:[],
    orbitA:Math.random()*Math.PI*2, flyPhase:Math.random()*6,
    flank:(Math.random()*2-1) * (cfg.ranged ? 0.35 : 0.85),
    lastLabelHp:-1, lastLabelDead:false, labelT:0
  };
  drawMobLabel(m);
  mobs.push(m);
}

function drawMobLabel(m){
  const g = m.labelCanvas.getContext('2d');
  g.clearRect(0,0,160,40);
  g.font='bold 15px sans-serif';
  g.shadowColor='#000'; g.shadowBlur=4;
  const isA = m.team==='A';
  const full = (isA?'红方·':'蓝方·')+m.cfg.name+(m.level>1?'★'.repeat(m.level-1):'');
  if(m.dead){
    g.textAlign='center'; g.fillStyle='#9a9a9a'; g.fillText(full, 80, 15);
  } else if(m.level>1){
    const pre = isA?'红方·':'蓝方·';                 // 前缀保持阵营色
    const wPre = g.measureText(pre).width, wFull = g.measureText(full).width;
    const x0 = 80 - wFull/2;
    g.textAlign='left';
    g.fillStyle = isA ? '#ff6055' : '#5ab0ff';
    g.fillText(pre, x0, 15);
    g.fillStyle = '#ffd44d';                          // 晋升金光
    g.shadowColor='#ffb018'; g.shadowBlur=8;
    g.fillText(full.slice(pre.length), x0+wPre, 15);
  } else {
    g.textAlign='center'; g.fillStyle = isA ? '#ff6055' : '#5ab0ff';
    g.fillText(full, 80, 15);
  }
  g.shadowBlur = 0;
  g.fillStyle='rgba(0,0,0,.65)'; g.fillRect(30,22,100,10);
  const r = Math.max(0, m.hp/m.maxHp);
  g.fillStyle = r>0.5 ? '#48d848' : (r>0.25 ? '#e8c030' : '#e04030');
  g.fillRect(32,24,96*r,6);
  m.labelTex.needsUpdate = true;
}

function disposeMob(m){
  scene.remove(m.group); scene.remove(m.label);
  m.group.traverse(o=>{ if(o.isMesh) o.geometry.dispose(); });
  m.mats.forEach(mt=>mt.dispose());
  m.tierMats.forEach(mt=>mt.dispose());
  m.label.material.map.dispose(); m.label.material.dispose();
}

function stepMove(m, mx, mz){
  const nx = m.pos.x+mx, nz = m.pos.z+mz;
  const ddx = nx-ARENA.cx, ddz = nz-ARENA.cz;
  if(Math.hypot(ddx,ddz) > ARENA.rIn-1.2) return;
  const curTop = groundTop(Math.floor(m.pos.x), Math.floor(m.pos.z));
  const newTop = groundTop(Math.floor(nx), Math.floor(nz));
  if(newTop - curTop <= 1.05){ m.pos.x = nx; m.pos.z = nz; }
}

function damageMob(m, dmg, kdx, kdz, kpow, src){
  if(m.dead || m.gone) return;
  if(m.invulnT > 0) return;                    // 升级金身
  m.hp -= dmg;
  m.flashT = 0.25; m.staggerT = 0.22;
  const l = Math.hypot(kdx,kdz) || 1;
  if(m.cfg.fly){
    m.pos.x += kdx/l*0.9*kpow;
    m.pos.z += kdz/l*0.9*kpow;
    const cdx = m.pos.x-ARENA.cx, cdz = m.pos.z-ARENA.cz;
    const cd = Math.hypot(cdx,cdz);
    if(cd > ARENA.rIn-2){ const k=(ARENA.rIn-2)/cd; m.pos.x=ARENA.cx+cdx*k; m.pos.z=ARENA.cz+cdz*k; }
  } else {
    stepMove(m, kdx/l*0.9*kpow, 0);
    stepMove(m, 0, kdz/l*0.9*kpow);
  }
  if(m.hp <= 0){
    m.hp = 0; m.dead = true; m.deadT = 0;
    m.mats.forEach(mt=>{ mt.transparent = true; mt.needsUpdate = true; });
    sfx('death');
    awardKill(src, m);
    checkBattleEnd();
  }
}

function setEmissive(m, r, g, b){
  m.mats.forEach(mt=>{ if(mt.emissive) mt.emissive.setRGB(r,g,b); });
}

function shootArrow(m, tg, power, yawOff){
  sfx('shoot');
  const v0 = power ? 34 : 26, g = 9.5;            // 强力箭更快更痛更重击退
  const from = new THREE.Vector3(m.pos.x, m.pos.y+1.45, m.pos.z);
  const vx = tg.vx||0, vz = tg.vz||0;
  let t = tg.pos.distanceTo(from)/v0;                        // 飞行时间预估(3D,兼容空中目标)
  const tx = tg.pos.x + vx*t, tz = tg.pos.z + vz*t;          // 目标移动提前量
  t = Math.hypot(tx-from.x, tz-from.z)/v0;
  const lift = 0.5*g*t*t;                                    // 重力下坠补偿(抬高瞄准点)
  const aim = new THREE.Vector3(tx, tg.pos.y + tg.cfg.h*0.55 + lift, tz);
  const dir = aim.sub(from).normalize();
  dir.x += (Math.random()-0.5)*(power?0.02:0.04);            // 强力箭更精准
  dir.y += (Math.random()-0.5)*0.02;
  dir.z += (Math.random()-0.5)*(power?0.02:0.04);
  dir.normalize();
  if(yawOff){                                                // 箭雨散射偏转
    const c=Math.cos(yawOff), s=Math.sin(yawOff);
    dir.set(dir.x*c - dir.z*s, dir.y, dir.x*s + dir.z*c).normalize();
  }
  const mesh = new THREE.Mesh(arrowGeo, power ? arrowPowerMat : arrowMat);
  if(power) mesh.scale.set(1.6,1.6,1.6);
  mesh.position.copy(from);
  mesh.lookAt(from.x+dir.x, from.y+dir.y, from.z+dir.z);
  scene.add(mesh);
  arrows.push({mesh, vel:dir.multiplyScalar(v0), life:2.5, team:m.team,
    dmg: Math.round((power ? 10+Math.floor(Math.random()*3) : 6+Math.floor(Math.random()*3))*m.dmgMult),
    kpow: power ? 0.8 : 0.35, owner:m});
}

/* 王者铁傀儡·巨石投掷(抛物线 + 落点AoE) */
const rockGeo = new THREE.BoxGeometry(0.45,0.45,0.45);
const rockMat = new THREE.MeshLambertMaterial({color:0x8a8f98});
function throwRock(m, tg){
  sfx('shoot');
  const v0 = 20;
  const from = new THREE.Vector3(m.pos.x, m.pos.y+3.0, m.pos.z);
  const vx = tg.vx||0, vz = tg.vz||0;
  let t = tg.pos.distanceTo(from)/v0;
  const tx = tg.pos.x + vx*t, tz = tg.pos.z + vz*t;
  t = Math.hypot(tx-from.x, tz-from.z)/v0;
  const lift = 0.5*9.5*t*t;
  const dir = new THREE.Vector3(tx, tg.pos.y + tg.cfg.h*0.5 + lift, tz).sub(from).normalize();
  const mesh = new THREE.Mesh(rockGeo, rockMat);
  mesh.position.copy(from);
  mesh.rotation.set(Math.random()*3, Math.random()*3, 0);
  scene.add(mesh);
  arrows.push({mesh, vel:dir.multiplyScalar(v0), life:2.5, team:m.team,
    dmg: Math.round(22*m.dmgMult), kpow:1.4, aoe:2.6, owner:m});
}
function rockBlast(a, p){
  boomVisual(p.x, p.y, p.z, a.aoe, 6);
  shake = Math.max(shake, 0.3);
  for(const t of mobs){
    if(t.dead || t.gone || t.team===a.team) continue;
    const dx=t.pos.x-p.x, dz=t.pos.z-p.z;
    const d = Math.hypot(dx, t.pos.y+1-p.y, dz);
    if(d < a.aoe){
      damageMob(t, Math.round(a.dmg*(1-d/a.aoe*0.6)), dx, dz, 1.2, a.owner);
      t.staggerT = Math.max(t.staggerT, 0.4);
    }
  }
}

function golemSlam(m){
  m.slamming = false;
  m.staggerT = 0.5;                                  // 落地后短暂硬直
  shake = Math.max(shake, 0.45);
  sfx('boom');
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,12,10),
    new THREE.MeshBasicMaterial({color:0xd8c9a8, transparent:true, opacity:0.8, depthWrite:false}));
  mesh.position.set(m.pos.x, m.pos.y+0.3, m.pos.z);
  scene.add(mesh);
  effects.push({mesh, t:0, dur:0.35, r0:0.5, r1: m.level>=2 ? 5.2 : 4.2});
  for(let i=0;i<8;i++){
    const d = new THREE.Mesh(debrisGeo, debrisMat);
    d.position.set(m.pos.x, m.pos.y+0.2, m.pos.z);
    scene.add(d);
    const a = Math.random()*Math.PI*2;
    debris.push({mesh:d, life:0.7,
      vel:new THREE.Vector3(Math.cos(a)*(2+Math.random()*3), 2+Math.random()*4, Math.sin(a)*(2+Math.random()*3))});
  }
  const R = m.level>=2 ? 5 : 4;                       // 精英:震地范围更大
  for(const t of mobs){
    if(t===m || t.dead || t.gone || t.team===m.team) continue;
    const dx = t.pos.x-m.pos.x, dz = t.pos.z-m.pos.z;
    const d = Math.hypot(dx,dz);
    if(d < R && Math.abs(t.pos.y-m.pos.y) < 3.5){
      damageMob(t, Math.round(18*m.dmgMult*(1-d/R*0.6)), dx, dz, 2.2, m);
      t.staggerT = Math.max(t.staggerT, 1.0);              // 震地:震慑 1 秒
    } else if(t.cfg.fly && d < R+0.5 && (t.pos.y-m.pos.y) < 8){
      t.staggerT = Math.max(t.staggerT, 1.2);              // 冲击波:震落低空单位
    }
  }
}

function explode(x,y,z,team,owner,ratio){
  ratio = ratio || 1;
  const lv = owner ? owner.level : 1;
  const r = 5.5*ratio*(1+0.15*(lv-1));
  boomVisual(x,y,z,r,Math.round(11*ratio));
  for(const t of mobs){
    if(t.dead || t.gone) continue;
    if(team!==undefined && t.team===team) continue;   // 自爆不炸友方
    const dx=t.pos.x-x, dz=t.pos.z-z;
    const d = Math.hypot(dx, t.pos.y+1-y, dz);
    if(d < r){
      damageMob(t, Math.round(33*ratio*(owner?owner.dmgMult:1)*(1-d/r*0.75)), dx, dz, 2.0, owner);
      t.staggerT = Math.max(t.staggerT, 0.5);         // 爆炸冲击:短暂硬直
    }
  }
}

/* ---------- 升级系统逻辑 ---------- */
function teamHpFrac(team){
  const init = teamInitHp[team];
  if(!init) return 1;
  let hp = 0;
  for(const t of mobs) if(t.team===team && !t.dead && !t.gone) hp += t.hp;
  return Math.min(1, hp/init);
}
function comebackMult(team){                          // 劣势方击杀信用加成(1~2)
  const mine = teamHpFrac(team), theirs = teamHpFrac(team==='A'?'B':'A');
  return Math.min(2, Math.max(1, 1 + 0.8*(theirs - mine)));
}
function awardKill(killer, victim){
  if(battleState !== 'fighting') return;
  const mult = comebackMult(victim.team==='A' ? 'B' : 'A');
  if(killer && killer.team!==victim.team && !killer.dead && !killer.gone)
    addKillCredit(killer, mult);
  // 苦力怕特权:每击杀随机挑一只存活苦力怕分得经验(避免全群同步晋升)
  const creeps = [];
  for(const c of mobs)
    if(c!==killer && c.type==='creeper' && c.team!==victim.team && !c.dead && !c.gone) creeps.push(c);
  if(creeps.length)
    addKillCredit(creeps[Math.floor(Math.random()*creeps.length)], 0.5*mult);
}
function addKillCredit(m, credit){
  m.kills += credit;
  while(m.level < 3 && !m.dead && !m.gone && m.kills >= (m.level===1 ? m.k2 : m.k3))
    levelUp(m);                                       // 同帧多杀可连跳级
}
function levelUp(m){
  m.level++;
  const tm = TIER_MULT[m.level];
  m.maxHp = Math.round(m.baseMaxHp*tm.hp);
  m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp*0.2));   // 升级回复20%最大生命
  m.dmgMult = tm.dmg;
  m.invulnT = 0.5;                                    // 金身免死
  m.lastLabelHp = -1;
  applyTierVisual(m);
  drawMobLabel(m);
  levelUpFx(m);
  showToast((m.team==='A'?'红方 ':'蓝方 ')+TIER_NAME[m.level]+m.cfg.name+' 晋升！', 2000);
}
/* 外形:体型放大 + 脚下光环(精英蓝/王者金) + 标志性附件 */
function applyTierVisual(m){
  m.tierScale = m.level===2 ? 1.3 : (m.level===3 ? 1.6 : 1);   // 体型明显变大(体积≈2.2×/4×)
  m.group.scale.set(m.tierScale, m.tierScale, m.tierScale);
  if(m.tierFx){
    m.group.remove(m.tierFx);
    m.tierFx.children.forEach(c=>c.geometry.dispose());
    m.tierMats.forEach(mt=>mt.dispose());
    m.tierMats = [];
  }
  m.tierFx = null;
  if(m.level < 2) return;
  const ls = m.level===3 ? 1.5 : 1.25;               // 升级后名牌放大
  m.label.scale.set(2.6*ls, 0.65*ls, 1);
  const fx = new THREE.Group();
  const mat = col => { const mt = new THREE.MeshBasicMaterial({color:col}); m.tierMats.push(mt); return mt; };
  const add = (w,h,d,x,y,z,col)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(col)); b.position.set(x,y,z); fx.add(b); };
  const aura = new THREE.Mesh(
    new THREE.CircleGeometry(m.cfg.fly?1.5:0.85, 24),
    new THREE.MeshBasicMaterial({color: m.level===3?0xffd44d:0x6cd8ff, transparent:true, opacity:0.5, depthWrite:false}));
  m.tierMats.push(aura.material);
  aura.rotation.x = -Math.PI/2; aura.position.y = 0.07;
  fx.add(aura); fx.userData.aura = aura;
  switch(m.type){
    case 'zombie':                                    // 肩甲 → 金盔
      if(m.level>=2){ add(0.3,0.16,0.5,-0.42,1.42,0,0x2a2a30); add(0.3,0.16,0.5,0.42,1.42,0,0x2a2a30); }
      if(m.level>=3){ add(0.56,0.22,0.56,0,1.98,0,0xd8b028); add(0.24,0.12,0.12,0,1.98,0.32,0xd8b028); }
      break;
    case 'skeleton':                                  // 铁盔 → 金冠金甲
      if(m.level>=2){ add(0.54,0.2,0.54,0,1.86,0,0x3a3a44); }
      if(m.level>=3){ add(0.48,0.16,0.48,0,2.04,0,0xd8b028);
        add(0.3,0.14,0.46,-0.4,1.44,0,0xd8b028); add(0.3,0.14,0.46,0.4,1.44,0,0xd8b028); }
      break;
    case 'creeper':                                   // 充能电光 → 红裂纹+金环
      if(m.level>=2){ add(0.16,0.16,0.16,0,1.86,0,0x9fe8ff); }
      if(m.level>=3){ add(0.5,0.14,0.5,0,1.86,0,0xd8b028);
        add(0.06,0.42,0.03,-0.09,0.9,0.17,0xff5a30); add(0.06,0.42,0.03,0.09,0.9,0.17,0xff5a30);
        add(0.06,0.3,0.03,-0.1,1.28,0.27,0xff5a30);  add(0.06,0.3,0.03,0.1,1.28,0.27,0xff5a30); }
      break;
    case 'golem':                                     // 肩刺 → 金冠
      if(m.level>=2){ add(0.3,0.44,0.3,-0.87,3.1,0,0x8a8f98); add(0.3,0.44,0.3,0.87,3.1,0,0x8a8f98); }
      if(m.level>=3){ add(0.8,0.2,0.8,0,3.12,0,0xd8b028); }
      break;
    case 'dragon':                                    // 金角尖 → 背脊金刺
      if(m.level>=2){ add(0.2,0.34,0.2,-0.3,2.62,2.95,0xd8b028); add(0.2,0.34,0.2,0.3,2.62,2.95,0xd8b028); }
      if(m.level>=3){ add(0.16,0.4,0.16,0,2.1,0.6,0xd8b028);
        add(0.16,0.4,0.16,0,2.15,-0.6,0xd8b028); add(0.16,0.4,0.16,0,2.1,-1.7,0xd8b028); }
      break;
  }
  m.tierFx = fx;
  m.group.add(fx);
}
function levelUpFx(m){
  sfx('level');
  const ring = new THREE.Mesh(new THREE.SphereGeometry(1,12,10),
    new THREE.MeshBasicMaterial({color:0xffe27a, transparent:true, opacity:0.9, depthWrite:false}));
  ring.position.set(m.pos.x, m.pos.y+1, m.pos.z);
  scene.add(ring);
  effects.push({mesh:ring, t:0, dur:0.5, r0:0.5, r1:2.6});
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.34,6,10,1,true),
    new THREE.MeshBasicMaterial({color:0xffe27a, transparent:true, opacity:0.55, depthWrite:false}));
  beam.position.set(m.pos.x, m.pos.y+3, m.pos.z);
  scene.add(beam);
  beams.push({mesh:beam, t:0, dur:0.7});
}
function updateBeams(dt){
  for(let i=beams.length-1;i>=0;i--){
    const b = beams[i]; b.t += dt;
    const p = b.t/b.dur;
    if(p >= 1){ scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); beams.splice(i,1); continue; }
    b.mesh.material.opacity = 0.55*(1-p);
    b.mesh.scale.set(1+p*0.6, 1, 1+p*0.6);
  }
}
function updatePendingBooms(dt){
  for(let i=pendingBooms.length-1;i>=0;i--){
    const b = pendingBooms[i]; b.t -= dt;
    if(b.t <= 0){ explode(b.x, b.y, b.z, b.team, b.owner, 0.65); pendingBooms.splice(i,1); }
  }
}

/* 苦力怕平A: 吐舌头舔击(短伸缩特效) */
const tongueFx = [];
function spawnTongue(m, tg){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.1,0.7),
    new THREE.MeshBasicMaterial({color:0xff8fb0}));
  const a = Math.atan2(tg.pos.x-m.pos.x, tg.pos.z-m.pos.z);
  mesh.position.set(m.pos.x + Math.sin(a)*0.95, m.pos.y + 1.32, m.pos.z + Math.cos(a)*0.95);
  mesh.rotation.y = a;
  scene.add(mesh);
  tongueFx.push({mesh, t:0});
}
function updateTongues(dt){
  for(let i=tongueFx.length-1;i>=0;i--){
    const f = tongueFx[i];
    f.t += dt;
    f.mesh.scale.z = 1 + Math.sin(Math.min(1, f.t/0.28)*Math.PI)*0.7;   // 伸缩
    if(f.t > 0.3){
      scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose();
      tongueFx.splice(i,1);
    }
  }
}
function clearTongues(){
  for(const f of tongueFx){ scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); }
  tongueFx.length = 0;
}

function checkBattleEnd(){
  if(battleState !== 'fighting') return;
  const a = mobs.some(m=>m.team==='A' && !m.dead && !m.gone);
  const b = mobs.some(m=>m.team==='B' && !m.dead && !m.gone);
  if(a && b) return;
  battleState = 'over';
  battleResult = a ? '红方获胜！' : (b ? '蓝方获胜！' : '两败俱伤！');
  showToast(battleResult + '  按 R 再来一场', 4000);
  sfx('win');
}

/* 附近有正在读条的敌方苦力怕则返回之(自己读条中,或贴脸两击能反杀时除外) */
function fusingCreeperNear(m){
  if(m.type==='creeper' && m.fuse >= 0) return null;
  for(const t of fusingCreeps){
    if(t.team===m.team) continue;
    const fd = Math.hypot(t.pos.x-m.pos.x, t.pos.z-m.pos.z);
    if(fd < 5.5){
      if(!m.cfg.ranged && fd < m.cfg.range && m.cfg.dmg*m.dmgMult*2 >= t.hp) return null;
      return t;
    }
  }
  return null;
}

function updateMobs(dt){
  updateTongues(dt);
  fusingCreeps.length = 0;
  for(const t of mobs)
    if(t.type==='creeper' && t.fuse>=0 && !t.dead && !t.gone) fusingCreeps.push(t);
  for(const m of mobs){
    if(m.gone) continue;
    const gp = m.pos;
    m.label.position.set(gp.x, gp.y + m.cfg.h + 0.55, gp.z);
    const prevX = gp.x, prevZ = gp.z;

    if(m.dead){
      m.deadT += dt;
      if(m.cfg.fly){                                 // 飞行单位死亡坠落
        const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
        if(gp.y > gy) gp.y = Math.max(gy, gp.y - 16*dt);
      }
      m.group.rotation.z = Math.min(Math.PI/2, m.deadT*3);
      if(m.deadT > 0.8){
        const o = Math.max(0, 1 - (m.deadT-0.8)/1.4);
        m.mats.forEach(mt=>{ mt.opacity = o; });
      }
      if(m.deadT > 2.2) m.group.visible = false;
      if(!m.lastLabelDead){ drawMobLabel(m); m.lastLabelDead = true; }
      continue;
    }
    if(m.lastLabelHp !== m.hp){                       // 大兵团时血条节流重绘
      m.labelT -= dt;
      if(m.labelT <= 0){ drawMobLabel(m); m.lastLabelHp = m.hp; m.labelT = 0.3; }
    }

    if(m.flashT > 0){
      m.flashT -= dt;
      const f = Math.max(0, m.flashT)/0.25;
      setEmissive(m, f*0.9, f*0.1, f*0.1);
    }
    if(m.raged && m.flashT <= 0) setEmissive(m, 0.30, 0.02, 0.02);  // 狂暴红光
    if(m.staggerT > 0) m.staggerT -= dt;
    if(m.attackCd  > 0) m.attackCd  -= dt;
    if(m.attackT   > 0) m.attackT   -= dt;
    if(m.slamCd    > 0) m.slamCd    -= dt;
    if(m.pounceCd  > 0) m.pounceCd  -= dt;
    if(m.rageBuffT > 0) m.rageBuffT -= dt;
    if(m.invulnT   > 0) m.invulnT   -= dt;
    if(m.rockCd    > 0) m.rockCd    -= dt;
    if(m.tierFx && m.tierFx.userData.aura){          // 阶级光环呼吸
      const as = 1 + Math.sin(performance.now()*0.004 + m.id)*0.12;
      m.tierFx.userData.aura.scale.set(as, as, as);
    }
    // 僵尸狂暴:血量触发(精英70%/基础50%),自身加速+攻速,附近同伴群体冲锋
    if(m.type==='zombie' && !m.raged && m.hp < m.maxHp*(m.level>=2?0.7:0.5)){
      m.raged = true;
      sfx('roar');
      const rr = m.level>=2 ? 9 : 6;
      for(const t of mobs){
        if(t!==m && t.type==='zombie' && !t.dead && !t.gone
           && Math.hypot(t.pos.x-gp.x, t.pos.z-gp.z) < rr) t.rageBuffT = m.level>=3?5:4;
      }
      if(m.level>=3){                                // 王者·狂暴冲击波
        const ring = new THREE.Mesh(new THREE.SphereGeometry(1,12,10),
          new THREE.MeshBasicMaterial({color:0xff6a4a, transparent:true, opacity:0.8, depthWrite:false}));
        ring.position.set(gp.x, gp.y+1, gp.z); scene.add(ring);
        effects.push({mesh:ring, t:0, dur:0.4, r0:0.5, r1:5});
        for(const t of mobs){
          if(t===m || t.dead || t.gone || t.team===m.team) continue;
          const dx=t.pos.x-gp.x, dz=t.pos.z-gp.z, d=Math.hypot(dx,dz);
          if(d < 5 && Math.abs(t.pos.y-gp.y) < 4){
            damageMob(t, Math.round(10*m.dmgMult*(1-d/5*0.5)), dx, dz, 1.2, m);
            t.staggerT = Math.max(t.staggerT, 0.8);
          }
        }
      }
    }
    // 被震落的飞行单位下沉
    if(m.cfg.fly && m.staggerT > 0){
      const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
      if(gp.y > gy) gp.y = Math.max(gy, gp.y - 10*dt);
    }

    m.retargetT -= dt;
    if(!m.target || m.target.dead || m.target.gone || m.retargetT <= 0){
      m.retargetT = 0.5 + Math.random()*0.4;
      let best=null, bd=1e9;
      for(const t of mobs){
        if(t===m || t.dead || t.gone || t.team===m.team) continue;
        // 距离 × 战术权重:个体偏好 + 目标粘性 + 收割残血 + 克制关系 + 可达性
        let w = 0.75 + hashRand(m.id*97 + t.id*13, t.id*29 + m.id*7)*0.5;
        if(t === m.target) w *= 0.75;                         // 目标粘性:不频繁切换
        if(t.hp < t.maxHp*0.3) w *= 0.55;                     // 优先收割残血
        if(COUNTER[m.type] === t.type) w *= 0.65;             // 优先进攻克制对象
        else if(COUNTER[t.type] === m.type) w *= 1.5;         // 回避克制自己的对手
        if(t.cfg.fly && !m.cfg.fly && !m.cfg.ranged) w *= 4;  // 地面近战摸不到飞行
        if(m.cfg.fly && !t.cfg.fly){
          if(!t.cfg.ranged) w *= 0.6;                         // 龙:优先收割无法还手的近战
          else w *= 1.3;                                      // 龙:优先清除远程威胁
        }
        const d = ((t.pos.x-gp.x)*(t.pos.x-gp.x) + (t.pos.z-gp.z)*(t.pos.z-gp.z)) * w;
        if(d<bd){ bd=d; best=t; }
      }
      m.target = best;
    }

    let speed = 0;
    const tg = m.target;

    if(m.air){
      // 跃起砸地:抛物线飞行,落地触发重击
      m.vy -= 24*dt;
      gp.y += m.vy*dt;
      stepMove(m, m.jumpVX*dt, 0);
      stepMove(m, 0, m.jumpVZ*dt);
      const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
      if(m.vy < 0 && gp.y <= gy){
        gp.y = gy; m.air = false; m.vy = 0;
        if(m.slamming) golemSlam(m);
      }
    } else if(m.staggerT <= 0 && tg){
      const dx = tg.pos.x-gp.x, dz = tg.pos.z-gp.z;
      const dist = Math.hypot(dx,dz);
      m.yaw = angleLerp(m.yaw, Math.atan2(dx,dz), dt*5);

      const fleeC = m.cfg.fly ? null : fusingCreeperNear(m);
      if(fleeC){
        // AI:逃离正在读条的敌方苦力怕(远程单位边退边射它)
        const fa = Math.atan2(gp.x-fleeC.pos.x, gp.z-fleeC.pos.z);
        const fs = mobSpeed(m)*1.05;
        stepMove(m, Math.sin(fa)*fs*dt, 0);
        stepMove(m, 0, Math.cos(fa)*fs*dt);
        speed = fs;
        if(m.cfg.ranged && m.attackCd <= 0
           && Math.hypot(fleeC.pos.x-gp.x, fleeC.pos.z-gp.z) <= 9){
          m.attackCd = m.cfg.cd; m.attackT = 0.35;
          m.shotCnt++;
          const pw = m.shotCnt % (m.level>=2?2:3) === 0;
          shootArrow(m, fleeC, pw);
          if(pw && m.level>=3){ shootArrow(m, fleeC, true, 0.16); shootArrow(m, fleeC, true, -0.16); }
        }
      } else if(m.cfg.fly){
        if(tg.cfg.fly){
          // 空中狗斗:3D 追击 + 撕咬
          const d3 = Math.hypot(dx, dz, tg.pos.y-gp.y);
          const spd = mobSpeed(m);
          gp.x += Math.sin(m.yaw)*spd*dt;
          gp.z += Math.cos(m.yaw)*spd*dt;
          gp.y += Math.max(-6, Math.min(6, tg.pos.y-gp.y))*dt*1.2;
          if(d3 < 4.5 && m.attackCd <= 0){
            m.attackCd = 1.6; m.attackT = 0.5;
            damageMob(tg, Math.round(12*m.dmgMult*(0.85+Math.random()*0.3)), dx, dz, 0.8, m);
            sfx('hit');
          }
        } else {
          // 对地:绕目标盘旋 + 喷吐龙息
          m.orbitA += dt*0.8;
          const px = tg.pos.x + Math.sin(m.orbitA)*9;
          const pz = tg.pos.z + Math.cos(m.orbitA)*9;
          const py = ARENA.floorY + ARENA.flyAlt;
          const mx = px-gp.x, mz = pz-gp.z;
          const ml = Math.hypot(mx,mz);
          m.yaw = angleLerp(m.yaw, Math.atan2(mx,mz), dt*2.5);
          if(ml > 0.05){
            const spd = mobSpeed(m);
            gp.x += mx/ml*spd*dt;
            gp.z += mz/ml*spd*dt;
          }
          gp.y += (py-gp.y)*Math.min(1, dt*1.5);
          if(m.attackCd <= 0 && dist < m.cfg.range){
            m.attackCd = (m.level>=2?3.5:4.5) + Math.random()*2;   // 精英:龙息更频繁
            m.attackT = 0.6;
            spawnBreath(m, tg);
          }
        }
        const cdx = gp.x-ARENA.cx, cdz = gp.z-ARENA.cz;
        const cd = Math.hypot(cdx,cdz);
        if(cd > ARENA.rIn-2.5){ const k=(ARENA.rIn-2.5)/cd; gp.x=ARENA.cx+cdx*k; gp.z=ARENA.cz+cdz*k; }
      } else if(m.cfg.boom){
        if(m.fuse >= 0 && m.fuse < 0.35 && dist > m.cfg.range*2.2 && !tg.cfg.fly){
          m.fuse = -1;                               // AI:目标跑了及时取消读条,不浪费
          m.group.scale.set(m.tierScale,m.tierScale,m.tierScale); setEmissive(m,0,0,0);
        }
        if(dist < m.cfg.range){
          if(m.fuse < 0) m.fuse = 0;
          // 平A: 吐舌头舔击(引爆读条期间也能舔)
          if(m.attackCd <= 0 && !tg.dead && Math.abs(tg.pos.y-gp.y) < 2.5){
            m.attackCd = 1.0; m.attackT = 0.4;
            damageMob(tg, Math.round(6*m.dmgMult*(0.85+Math.random()*0.3)),
                      tg.pos.x-gp.x, tg.pos.z-gp.z, 0.3, m);
            spawnTongue(m, tg);
            sfx('hit');
          }
        } else if(m.fuse < 0){
          if(!m.air && m.pounceCd <= 0 && dist > 3 && dist < 11){
            // 扑袭:向目标跃进扑脸再引爆
            m.pounceCd = 5.5 + Math.random()*3;
            m.air = true; m.vy = 7.2;
            const hl = Math.hypot(dx,dz) || 1;
            const hv = Math.min(10, dist*1.3);
            m.jumpVX = dx/hl*hv; m.jumpVZ = dz/hl*hv;
          } else {
            speed = mobSpeed(m);
          }
        }
      } else if(m.cfg.ranged){
        const shootDist = Math.min(m.cfg.range, 9);    // 有效射程:超过就压上,避免远距离干瞪眼
        if(dist > shootDist){
          speed = mobSpeed(m);
        } else if(dist < 4.5){
          speed = -mobSpeed(m)*0.65;
        } else {
          m.strafeT -= dt;                             // 保持距离时横向走位
          if(m.strafeT <= 0){
            m.strafeT = 1.2 + Math.random()*1.6;
            m.strafeDir = Math.random()<0.5 ? -1 : 1;
          }
          stepMove(m,  Math.cos(m.yaw)*m.strafeDir*0.9*dt, 0);
          stepMove(m, 0, -Math.sin(m.yaw)*m.strafeDir*0.9*dt);
        }
        if(dist <= shootDist && m.attackCd <= 0){
          m.attackCd = m.cfg.cd; m.attackT = 0.35;
          m.shotCnt++;
          const pw = m.shotCnt % (m.level>=2?2:3) === 0;   // 精英:每第2箭强力
          shootArrow(m, tg, pw);
          if(pw && m.level>=3){                             // 王者·箭雨三连
            shootArrow(m, tg, true, 0.16);
            shootArrow(m, tg, true, -0.16);
          }
        }
      } else {
        if(dist > m.cfg.range*0.85) speed = mobSpeed(m);
        if(m.type==='golem' && m.level>=3 && m.rockCd<=0 && dist>4.5 && dist<14){
          // 王者·巨石投掷
          m.rockCd = 4 + Math.random()*2;
          m.attackT = 0.6;
          throwRock(m, tg);
        }
        if(m.type==='golem' && m.slamCd <= 0 && dist > 2.2 && dist < 6.5){
          // 跃起砸地
          m.slamCd = (m.level>=2?4.5:6) + Math.random()*(m.level>=2?3:4);
          m.slamming = true; m.air = true; m.vy = 8;
          const hl = Math.hypot(dx,dz) || 1;
          const hv = Math.min(10, hl/0.66);
          m.jumpVX = dx/hl*hv; m.jumpVZ = dz/hl*hv;
          m.attackT = 1.0;
          speed = 0;
        }
        if(!m.air && dist <= m.cfg.range && Math.abs(tg.pos.y-gp.y) < 3 && m.attackCd <= 0){
          m.attackCd = m.cfg.cd * (m.raged ? 0.55 : 1); m.attackT = 0.45;   // 狂暴攻速
          damageMob(tg, Math.round(m.cfg.dmg*m.dmgMult*(0.85+Math.random()*0.3)),
                    tg.pos.x-gp.x, tg.pos.z-gp.z, 0.45, m);
          sfx('hit');
        }
      }

      if(m.fuse >= 0){
        m.fuse += dt;
        const ft = m.level>=2 ? 0.9 : 1.1;           // 精英:引信更短
        const p = Math.min(1, m.fuse/ft);
        const sp = m.tierScale*(1+p*0.3);
        m.group.scale.set(sp, sp, sp);
        const blink = Math.sin(m.fuse*25) > 0 ? 0.85 : 0;
        setEmissive(m, blink, blink, blink);
        if(m.fuse >= ft){
          m.gone = true;
          explode(gp.x, gp.y+0.8, gp.z, m.team, m);
          if(m.level>=3)                             // 王者·连环爆破(0.5秒后二段)
            pendingBooms.push({t:0.5, x:gp.x, y:gp.y+0.8, z:gp.z, team:m.team, owner:m});
          checkBattleEnd();
          continue;
        }
      }

      if(speed !== 0){
        // 侧向包抄角:远处直线逼近,近处按各自 flank 展开形成包围
        const ma = m.yaw + m.flank * Math.max(0, Math.min(1, (10-dist)/6));
        stepMove(m, Math.sin(ma)*speed*dt, 0);
        stepMove(m, 0, Math.cos(ma)*speed*dt);
      }
      if(!m.cfg.fly){
        const ty = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
        gp.y += (ty-gp.y)*Math.min(1, dt*10);
      }
    } else if(m.staggerT <= 0){
      if(m.fuse >= 0){
        m.fuse = -1; m.group.scale.set(m.tierScale,m.tierScale,m.tierScale); setEmissive(m,0,0,0);
      }
      if(m.cfg.fly){
        // 无目标:绕场地中心巡航
        m.orbitA += dt*0.5;
        const px = ARENA.cx + Math.sin(m.orbitA)*14;
        const pz = ARENA.cz + Math.cos(m.orbitA)*14;
        const mx = px-gp.x, mz = pz-gp.z, ml = Math.hypot(mx,mz);
        m.yaw = angleLerp(m.yaw, Math.atan2(mx,mz), dt*2);
        if(ml > 0.05){
          gp.x += mx/ml*m.cfg.speed*0.7*dt;
          gp.z += mz/ml*m.cfg.speed*0.7*dt;
        }
        gp.y += (ARENA.floorY+ARENA.flyAlt-gp.y)*Math.min(1, dt);
      } else {
        m.wanderT -= dt;
        if(m.wanderT <= 0){
          m.wanderT = 2 + Math.random()*3;
          m.yaw += (Math.random()-0.5)*2;
        }
        speed = 1.1;
        stepMove(m, Math.sin(m.yaw)*speed*dt, 0);
        stepMove(m, 0, Math.cos(m.yaw)*speed*dt);
        const ty = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
        gp.y += (ty-gp.y)*Math.min(1, dt*10);
      }
    }
    m.speedNow = Math.abs(speed);

    m.walkPhase += m.speedNow*dt*3.4;
    const sw = Math.sin(m.walkPhase)*0.5*Math.min(1, m.speedNow/2.2);
    const P = m.parts;
    if(P.legL){ P.legL.rotation.x =  sw; P.legR.rotation.x = -sw; }
    if(m.type==='zombie'){
      P.armL.rotation.x = -1.45;
      P.armR.rotation.x = m.attackT>0
        ? -1.45 - Math.sin((1-m.attackT/0.45)*Math.PI)*0.9 : -1.45;
    } else if(m.type==='skeleton'){
      P.armL.rotation.x = -0.15 + sw*0.3;
      P.armR.rotation.x = m.attackT>0 ? -1.3 : -sw*0.5;
    } else if(m.type==='dragon'){
      m.flyPhase += dt*6;
      const wf = Math.sin(m.flyPhase)*0.5;
      P.wingL.rotation.z =  wf + 0.15;
      P.wingR.rotation.z = -(wf + 0.15);
      P.head.rotation.x = m.attackT>0 ? -0.55 : Math.sin(m.flyPhase*0.35)*0.1;
    } else if(m.type==='creeper'){
      P.head.rotation.x = m.attackT>0 ? -0.55 : 0;      // 吐舌时头部前扑
    } else if(m.type==='golem'){
      P.armL.rotation.x = -sw*0.5;
      P.armR.rotation.x = m.attackT>0
        ? -Math.sin((1-m.attackT/0.45)*Math.PI)*2.1 : sw*0.5;
    }
    if(m.air && m.type==='golem'){
      P.armL.rotation.x = -2.4;                     // 跃起时双臂高举
      P.armR.rotation.x = -2.4;
    }
    const idt = dt > 0 ? dt : 1e-4;
    m.vx = (gp.x - prevX)/idt;
    m.vz = (gp.z - prevZ)/idt;
    m.group.position.set(gp.x, gp.y, gp.z);
    m.group.rotation.y = m.yaw;
  }

  // 大规模兵团:空间网格加速挤开检测(代替 O(n²) 两两枚举)
  sepGrid.clear();
  const live = [];
  for(const m of mobs){
    if(m.dead || m.gone) continue;
    live.push(m);
    const k = Math.floor(m.pos.x) + ',' + Math.floor(m.pos.z);
    let arr = sepGrid.get(k);
    if(!arr){ arr = []; sepGrid.set(k, arr); }
    arr.push(m);
  }
  const minSep = 0.85;
  for(const a of live){
    const gx = Math.floor(a.pos.x), gz = Math.floor(a.pos.z);
    for(let ox=-1;ox<=1;ox++){
      for(let oz=-1;oz<=1;oz++){
        const arr = sepGrid.get((gx+ox)+','+(gz+oz));
        if(!arr) continue;
        for(const b of arr){
          if(b.id <= a.id) continue;                   // 每对只处理一次
          if(Math.abs(b.pos.y-a.pos.y) > 2.5) continue; // 空中/地面不互相挤开
          const dx = b.pos.x-a.pos.x, dz = b.pos.z-a.pos.z;
          const d = Math.hypot(dx,dz);
          if(d > 0.001 && d < minSep){
            const push = (minSep-d)*0.5;
            const ux = dx/d, uz = dz/d;
            stepMove(a, -ux*push, 0); stepMove(a, 0, -uz*push);
            stepMove(b,  ux*push, 0); stepMove(b, 0,  uz*push);
          }
        }
      }
    }
  }

  for(let i=mobs.length-1;i>=0;i--){
    const m = mobs[i];
    if(m.gone || (m.dead && m.deadT > 2.4)){
      disposeMob(m);
      mobs.splice(i,1);
    }
  }
}

function updateArrows(dt){
  for(let i=arrows.length-1;i>=0;i--){
    const a = arrows[i];
    a.vel.y -= 9.5*dt;
    a.mesh.position.addScaledVector(a.vel, dt);
    const p = a.mesh.position;
    a.mesh.lookAt(p.x+a.vel.x, p.y+a.vel.y, p.z+a.vel.z);
    a.life -= dt;
    let hit = false;
    if(getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) !== 0) hit = true;
    if(!hit){
      for(const t of mobs){
        if(t.dead || t.gone || t.team===a.team) continue;
        const hr = t.cfg.hitR || 0.55;
        if(Math.abs(p.x-t.pos.x) < hr && Math.abs(p.z-t.pos.z) < hr
           && p.y > t.pos.y-0.3 && p.y < t.pos.y + t.cfg.h + 0.5){
          if(!a.aoe) damageMob(t, a.dmg, a.vel.x, a.vel.z, a.kpow||0.35, a.owner);
          sfx('hit');
          hit = true; break;
        }
      }
    }
    if(hit && a.aoe) rockBlast(a, p);                 // 巨石:命中/落地即AoE
    if(hit || a.life <= 0){
      scene.remove(a.mesh);
      arrows.splice(i,1);
    }
  }
}

/* ---------- 末影龙龙息 ---------- */
function spawnBreath(m, tg){
  sfx('breath');
  const hx = m.pos.x + Math.sin(m.yaw)*3.3;
  const hz = m.pos.z + Math.cos(m.yaw)*3.3;
  const hy = m.pos.y + 1.9;
  const tx = tg.pos.x + (tg.vx||0)*0.5;
  const tz = tg.pos.z + (tg.vz||0)*0.5;
  const targets = [{x:tx, z:tz}];
  if(m.level>=3){                                     // 王者·三重龙息
    const a = Math.random()*Math.PI*2;
    targets.push({x:tx+Math.cos(a)*2.4, z:tz+Math.sin(a)*2.4},
                 {x:tx-Math.cos(a)*2.4, z:tz-Math.sin(a)*2.4});
  }
  for(const tp of targets){
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45,10,8),
      new THREE.MeshBasicMaterial({color:0xb44bff, transparent:true, opacity:0.9, depthWrite:false}));
    mesh.position.set(hx,hy,hz);
    scene.add(mesh);
    breathBalls.push({mesh, t:0, dur:0.6, team:m.team, owner:m,
      from:new THREE.Vector3(hx,hy,hz),
      to:new THREE.Vector3(tp.x, groundTop(Math.floor(tp.x), Math.floor(tp.z))+1.2, tp.z)});
  }
}

function spawnCloud(team, x, z, owner){
  const gy = groundTop(Math.floor(x), Math.floor(z)) + 1;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3,24),
    new THREE.MeshBasicMaterial({color:0x9a3cd8, transparent:true, opacity:0.35, depthWrite:false}));
  disc.rotation.x = -Math.PI/2;
  disc.position.set(x, gy+0.08, z);
  scene.add(disc);
  const puffs = [];
  for(let i=0;i<6;i++){
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.35,8,6),
      new THREE.MeshBasicMaterial({color:0xc06bff, transparent:true, opacity:0.7, depthWrite:false}));
    p.userData.bx = x + (Math.random()-0.5)*4;
    p.userData.bz = z + (Math.random()-0.5)*4;
    p.userData.by = gy + 0.4 + Math.random()*1.2;
    p.userData.ph = Math.random()*Math.PI*2;
    scene.add(p);
    puffs.push(p);
  }
  clouds.push({team, x, z, r:3, t:0,
    dur: owner && owner.level>=2 ? 6 : 4.5,           // 精英:毒云更持久
    tick:0.3, dmg: Math.round(7*(owner?owner.dmgMult:1)), disc, puffs, gy, owner});
}

function updateBreath(dt){
  for(let i=breathBalls.length-1;i>=0;i--){
    const b = breathBalls[i];
    b.t += dt;
    const p = Math.min(1, b.t/b.dur);
    b.mesh.position.lerpVectors(b.from, b.to, p);
    b.mesh.position.y += Math.sin(p*Math.PI)*2.5;            // 抛物线
    const s = 1 + Math.sin(p*Math.PI*3)*0.25;
    b.mesh.scale.set(s,s,s);
    if(p >= 1){
      spawnCloud(b.team, b.to.x, b.to.z, b.owner);
      scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose();
      breathBalls.splice(i,1);
    }
  }
}

function updateClouds(dt){
  for(let i=clouds.length-1;i>=0;i--){
    const c = clouds[i];
    c.t += dt;
    const fade = 1 - c.t/c.dur;
    c.disc.material.opacity = 0.35*Math.max(0, fade);
    for(const p of c.puffs){
      p.position.y = p.userData.by + Math.sin(c.t*2.2 + p.userData.ph)*0.35;
      p.material.opacity = 0.7*Math.max(0, fade);
    }
    c.tick -= dt;
    if(c.tick <= 0){
      c.tick = 0.5;
      for(const t of mobs){
        if(t.dead || t.gone || t.team===c.team) continue;
        if(Math.abs(t.pos.y - c.gy) > 3) continue;           // 只伤地面单位
        if(Math.hypot(t.pos.x-c.x, t.pos.z-c.z) < c.r + 0.3){
          damageMob(t, c.dmg, t.pos.x-c.x, t.pos.z-c.z, 0.15, c.owner);
        }
      }
    }
    if(c.t >= c.dur){
      scene.remove(c.disc); c.disc.geometry.dispose(); c.disc.material.dispose();
      c.puffs.forEach(p=>{ scene.remove(p); p.geometry.dispose(); p.material.dispose(); });
      clouds.splice(i,1);
    }
  }
}

/* ---------- 对战管理 ---------- */
const cfgA = {type:'zombie',  count:8};
const cfgB = {type:'skeleton',count:8};
let autoBalance = true;      // 开启后两队总战力自动一致
let lastEdited = 'A';        // 最后编辑的一侧，另一侧随之配平
const MAX_MOBS = 1000;

function teamPower(cfg){ return cfg.count * MOB_TYPES[cfg.type].power; }
function balanceTeams(){
  const from = lastEdited==='A' ? cfgA : cfgB;
  const to   = lastEdited==='A' ? cfgB : cfgA;
  const n = Math.round(from.count * MOB_TYPES[from.type].power / MOB_TYPES[to.type].power);
  to.count = Math.min(MAX_MOBS, Math.max(1, n));
}

function spawnTeam(team, cfg){
  const ax = team==='A' ? ARENA.cx-19 : ARENA.cx+19;
  const az = ARENA.cz;
  const spread = Math.min(15, 1.2 + Math.sqrt(cfg.count)*0.6);
  for(let i=0;i<cfg.count;i++){
    const a = Math.random()*Math.PI*2, rr = 0.6+Math.random()*spread;
    const x = ax + Math.cos(a)*rr, z = az + Math.sin(a)*rr;
    const type = cfg.type==='mix'
      ? MIX_POOL[Math.floor(Math.random()*MIX_POOL.length)]
      : cfg.type;
    spawnMob(team, type, x, z);
  }
}

function startBattle(){
  clearTongues();
  for(const m of mobs) disposeMob(m);
  mobs.length = 0;
  for(const a of arrows) scene.remove(a.mesh);
  arrows.length = 0;
  spawnTeam('A', cfgA);
  spawnTeam('B', cfgB);
  teamInitHp = {A:0, B:0};
  pendingBooms.length = 0;
  for(const b of beams){ scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); }
  beams.length = 0;
  for(const m of mobs){                               // 升级阈值随敌方规模缩放
    const ec = m.team==='A' ? cfgB.count : cfgA.count;
    m.k2 = Math.max(1, Math.min(6, Math.ceil(ec*0.25)));
    m.k3 = Math.max(m.k2+1, Math.min(14, Math.ceil(ec*0.6)));
    teamInitHp[m.team] += m.maxHp;
  }
  battleState = 'fighting';
  battleResult = '';
  showToast('对战开始！红方 ' + cfgA.count + '×' + MOB_TYPES[cfgA.type].name + '（战力' + teamPower(cfgA)
    + '） VS 蓝方 ' + cfgB.count + '×' + MOB_TYPES[cfgB.type].name + '（战力' + teamPower(cfgB) + '）', 3200);
}

function clearBattle(){
  clearTongues();
  for(const m of mobs) disposeMob(m);
  mobs.length = 0;
  for(const a of arrows) scene.remove(a.mesh);
  arrows.length = 0;
  pendingBooms.length = 0;
  for(const b of beams){ scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); }
  beams.length = 0;
  battleState = 'idle';
  battleResult = '';
  showToast('已清场', 1800);
}

/* ---------- 竞技场 UI ---------- */
let selected = 0;
const hotbarEl = document.getElementById('hotbar');
const scoreEl = document.getElementById('score');
const hudEl = document.getElementById('hud');

function buildHotbar(){
  hotbarEl.innerHTML='';
  HOTBAR.forEach((id,i)=>{
    const b = BLOCKS[id];
    const col = (b.all||b.side);
    const div = document.createElement('div');
    div.className='slot';
    div.innerHTML = `<span class="num">${i+1}</span>
      <div class="cube" style="background:rgb(${col.map(c=>Math.round(c*255)).join(',')})"></div>
      <span class="lbl">${b.name}</span>`;
    div.addEventListener('pointerdown',(ev)=>{ ev.preventDefault(); selected=i; updateHotbar(); });
    hotbarEl.appendChild(div);
  });
  updateHotbar();
}
function updateHotbar(){
  [...hotbarEl.children].forEach((el,i)=> el.classList.toggle('active', i===selected));
}

/* ---------- 怪物像素头像 (16×16 手绘 → 64×64 dataURL, 与 3D 模型同配色) ---------- */
const mobFaceCache = {};
function mobFace(type){
  if(mobFaceCache[type]) return mobFaceCache[type];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x,y,w,h,col)=>{ g.fillStyle = col; g.fillRect(x,y,w,h); };
  const mottle = (col, pts)=>pts.forEach(([x,y])=>px(x,y,1,1,col));
  switch(type){
    case 'zombie': {
      px(0,0,16,16,'#5e9440');
      mottle('#4a7a33',[[2,1],[6,3],[11,2],[14,5],[3,9],[8,8],[12,12],[5,14],[1,12],[9,14],[13,8]]);
      px(3,5,3,3,'#14200f'); px(10,5,3,3,'#14200f');      // 黑眼窝
      px(7,8,2,2,'#3d6b2e');                               // 鼻影
      px(5,12,6,2,'#1c2b16');                              // 嘴
      break;
    }
    case 'skeleton': {
      px(0,0,16,16,'#d8d8d2');
      mottle('#b8b8b0',[[3,1],[9,2],[13,4],[1,7],[6,6],[11,9],[4,14],[13,12],[8,15]]);
      px(3,5,3,3,'#1a1a1a'); px(10,5,3,3,'#1a1a1a');      // 深眼窝
      px(7,8,2,2,'#8a8a84');                               // 鼻孔
      px(4,11,8,3,'#b8b8b0');                              // 牙床
      for(let x=5;x<=11;x+=2) px(x,11,1,3,'#1a1a1a');      // 牙缝
      break;
    }
    case 'creeper': {
      px(0,0,16,16,'#4fae4f');
      mottle('#3d8f3d',[[1,2],[5,1],[9,3],[13,2],[3,7],[11,6],[2,12],[7,14],[12,11],[14,14],[6,9]]);
      px(3,5,3,3,'#101510'); px(10,5,3,3,'#101510');       // 眼
      px(6,9,4,2,'#101510');                               // 嘴(上)
      px(5,11,2,3,'#101510'); px(9,11,2,3,'#101510');      // 嘴(垂腿)
      break;
    }
    case 'golem': {
      px(0,0,16,16,'#cdd0d8');
      mottle('#aab0bb',[[2,2],[7,1],[12,3],[1,9],[13,10],[4,13],[10,14],[14,2]]);
      px(2,1,2,2,'#3d8f3d'); px(3,1,1,1,'#5e9440');        // 蔓藤
      px(3,5,3,2,'#2a2e36'); px(10,5,3,2,'#2a2e36');       // 眼窝
      px(4,5,1,2,'#ff2a1a'); px(11,5,1,2,'#ff2a1a');       // 红瞳
      px(7,6,2,5,'#555a63');                               // 长鼻
      px(5,13,6,1,'#555a63');                              // 嘴
      break;
    }
    case 'dragon': {
      px(0,0,16,16,'#16161f');
      mottle('#262633',[[2,3],[6,2],[10,4],[13,7],[1,10],[5,12],[9,13],[14,11]]);
      px(2,0,2,3,'#3a2055'); px(12,0,2,3,'#3a2055');       // 双角
      px(7,0,2,2,'#3a2055');
      px(3,5,3,2,'#d06bff'); px(10,5,3,2,'#d06bff');       // 紫瞳
      px(4,5,1,2,'#e8a4ff'); px(11,5,1,2,'#e8a4ff');
      px(5,9,6,3,'#262633');                               // 吻部
      px(6,10,1,1,'#0a0a10'); px(9,10,1,1,'#0a0a10');      // 鼻孔
      px(5,12,6,1,'#0a0a10');                              // 颚线
      break;
    }
    case 'mix': {                                          // 四象限:僵尸/骷髅/苦力怕/铁傀儡
      px(0,0,8,8,'#5e9440');  px(1,3,2,2,'#14200f'); px(5,3,2,2,'#14200f');
      px(8,0,8,8,'#d8d8d2');  px(9,3,2,2,'#1a1a1a'); px(13,3,2,2,'#1a1a1a');
      px(0,8,8,8,'#4fae4f');  px(1,10,2,2,'#101510'); px(5,10,2,2,'#101510'); px(3,12,2,2,'#101510');
      px(8,8,8,8,'#cdd0d8');  px(9,11,2,1,'#ff2a1a'); px(13,11,2,1,'#ff2a1a'); px(11,12,1,2,'#555a63');
      break;
    }
  }
  const big = document.createElement('canvas');
  big.width = big.height = 64;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 64, 64);
  mobFaceCache[type] = big.toDataURL();
  return mobFaceCache[type];
}

const cntAEl = document.getElementById('cntA');
const cntBEl = document.getElementById('cntB');
const powAEl = document.getElementById('powA');
const powBEl = document.getElementById('powB');
const unitAEl = document.getElementById('unitA');
const unitBEl = document.getElementById('unitB');
const balBtn = document.getElementById('balBtn');
let panelBuilt = false;
function buildPanel(){
  if(panelBuilt){ updatePanel(); return; }
  panelBuilt = true;
  document.querySelectorAll('.mobBtns').forEach(el=>{
    for(const [k,v] of Object.entries(MOB_TYPES)){
      const b = document.createElement('button');
      b.innerHTML = `<img src="${mobFace(k)}" alt="">${v.name}`;
      b.title = '战力 ' + v.power;
      b.dataset.type = k;
      b.addEventListener('click', ()=>{
        const cfg = el.dataset.team==='A' ? cfgA : cfgB;
        cfg.type = k;
        lastEdited = el.dataset.team;
        if(autoBalance) balanceTeams();
        updatePanel();
      });
      el.appendChild(b);
    }
  });
  document.querySelectorAll('.countRow:not(.pw) button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const cfg = b.dataset.cnt==='A' ? cfgA : cfgB;
      lastEdited = b.dataset.cnt;
      cfg.count = Math.min(MAX_MOBS, Math.max(1, cfg.count + parseInt(b.dataset.d)));
      if(autoBalance) balanceTeams();
      updatePanel();
    });
  });
  document.getElementById('fightBtn').onclick = ()=>{ startBattle(); requestLock(); };
  document.getElementById('resumeBtn').onclick = requestLock;
  document.getElementById('clearBtn').onclick = clearBattle;
  balBtn.onclick = ()=>{
    autoBalance = !autoBalance;
    if(autoBalance) balanceTeams();
    updatePanel();
  };
}
function updatePanel(){
  document.querySelectorAll('.mobBtns').forEach(el=>{
    const cfg = el.dataset.team==='A' ? cfgA : cfgB;
    [...el.children].forEach(b=> b.classList.toggle('active', b.dataset.type===cfg.type));
  });
  cntAEl.textContent = cfgA.count;
  cntBEl.textContent = cfgB.count;
  unitAEl.textContent = MOB_TYPES[cfgA.type].power;
  unitBEl.textContent = MOB_TYPES[cfgB.type].power;
  const pA = teamPower(cfgA), pB = teamPower(cfgB);
  powAEl.textContent = pA;
  powBEl.textContent = pB;
  const warn = Math.abs(pA-pB) / Math.max(pA,pB) > 0.1;   // 超过上限无法配平时红字提示
  powAEl.className = warn ? 'warn' : 'ok';
  powBEl.className = warn ? 'warn' : 'ok';
  balBtn.textContent = '战力配平：' + (autoBalance ? '开' : '关');
}

const scoreAEl = document.getElementById('scoreA');
const scoreBEl = document.getElementById('scoreB');
const scoreMidEl = document.getElementById('scoreMid');
function updateScoreboard(){
  let a=0, b=0, pa=0, pb=0;
  for(const m of mobs){
    if(!m.dead && !m.gone){
      if(m.team==='A'){ a++; pa+=m.cfg.power; } else { b++; pb+=m.cfg.power; }
    }
  }
  scoreAEl.textContent = '红方 ' + a + ' · ' + pa;
  scoreBEl.textContent = '蓝方 ' + b + ' · ' + pb;
  scoreMidEl.textContent = battleState==='fighting' ? '战斗中'
    : (battleState==='over' ? battleResult : '备战中');
}

/* ---------- 模式对象 ---------- */
const ArenaMode = {
  id:'arena',
  init(){
    generate();
    rebuildAll();
    spawnPlayer();
    buildHotbar();
    buildPanel();
    if(autoBalance) balanceTeams();
    updatePanel();
    scoreEl.style.display = 'flex';
    hotbarEl.style.display = 'flex';
    setTouchActions([                                 // 平板动作按钮
      {label:'⬆️', hold:'Space'},
      {label:'⛏️', act:()=>doCenterClick(0)},
      {label:'🧱', act:()=>doCenterClick(2)}
    ]);
  },
  cleanup(){
    clearTongues();
    for(const m of mobs) disposeMob(m);
    mobs.length = 0;
    for(const a of arrows) scene.remove(a.mesh);
    arrows.length = 0;
    pendingBooms.length = 0;
    for(const b of beams){ scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); }
    beams.length = 0;
    battleState = 'idle';
    battleResult = '';
    scoreEl.style.display = 'none';
  },
  update(dt){
    updateMobs(dt);
    updateArrows(dt);
    updateBreath(dt);
    updateClouds(dt);
    updatePendingBooms(dt);
    updateBeams(dt);
  },
  onKey(code){
    if(code==='KeyR') startBattle();
    if(code==='KeyB') uiPause();
  },
  onDigit(n){
    if(n>=1 && n<=HOTBAR.length){ selected = n-1; updateHotbar(); }
  },
  onWheel(d){
    selected = (selected + d + HOTBAR.length) % HOTBAR.length;
    updateHotbar();
  },
  onMouse(button, hit){
    if(!hit) return;
    if(button === 0){
      editBlock(hit.x, hit.y, hit.z, 0);
    } else if(button === 2){
      const px=hit.x+hit.nx, py=hit.y+hit.ny, pz=hit.z+hit.nz;
      if(getBlock(px,py,pz)!==0) return;
      if(collidesAtPlayer(px,py,pz)) return;
      editBlock(px,py,pz, HOTBAR[selected]);
    }
  },
  updateHud(){
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const hit = raycastVoxel(camera.position, dir, 6);
    let target = '无';
    if(hit){ const id=getBlock(hit.x,hit.y,hit.z); target = BLOCKS[id]?BLOCKS[id].name:'?'; }
    hudEl.innerHTML =
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}<br>`+
      `FPS: ${fps}<br>`+
      `手持: ${BLOCKS[HOTBAR[selected]].name}<br>`+
      `注视: ${target}<br>`+
      `R 重新开战 · B 面板`;
    updateScoreboard();
  }
};
