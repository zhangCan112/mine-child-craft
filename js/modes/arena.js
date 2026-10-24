'use strict';
/* ============================================================
   竞技场模式:环形竞技场 + 双阵营怪物 PVP 对战
============================================================ */

/* ---------- 竞技场几何参数(本模式唯一消费者, 归位自 config.js) ---------- */
const ARENA = {
  cx: WORLD_W/2, cz: WORLD_D/2, // 中心 (64,64)
  floorY: 14, // 场地地面顶层方块 y
  rIn: 36, // 内墙半径
  rOut: 40, // 外墙半径
  flyAlt: 7.8, // 飞行单位悬停高度(离地面)
};
/* 选块物品栏(本模式唯一消费者, 归位自 config.js); 第 1 格铁锹哨兵=挖掘入口
   (智能主动作手持感知, 用户拍板 2026-10-24: 选中方块→⛏️放置, 选中铲子→⛏️连挖) */
const HOTBAR = ['shovel', 3, 4, 13, 5, 6, 17, 16, 15, 18];

/* ---------- 竞技场配平战力(本模式唯一消费者, 归位自 config.js 的 MOB_TYPES.power) ----------
   综合命中/射程/技能的配平系数, 只喂给编队数量匹配; 其他模式(坦克演习场/
   下界冒险)不感知战力。菜单页的战力示例文案由本表派生(fillPowerNote)。 */
const ARENA_POWER = {
  zombie: 170, skeleton: 165, creeper: 195, golem: 1000, dragon: 2000, spider: 110,
  cave_spider: 85, silverfish: 40, endermite: 55, slime: 130, enderman: 480, witch: 300,
  husk: 160, drowned: 160, stray: 170, bogged: 150, phantom: 190, vex: 260, creaking: 200,
  zombified_piglin: 230, piglin: 200, piglin_brute: 950, hoglin: 420, zoglin: 430,
  wither_skeleton: 350, blaze: 280, ghast: 320, magma_cube: 190, guardian: 330,
  elder_guardian: 1000, shulker: 200, vindicator: 560, evoker: 300, pillager: 210,
  ravager: 1150, wither: 3000, warden: 4800,
};

/* ---------- 竞技场地形生成 ---------- */
/* 地形方块别名(config 的 BLOCKS id, 名字见注册表): 免魔法数字散在地形代码里 */
const ID_GRASS=1; const ID_STONE=3; const ID_COBBLE=4; const ID_BRICK=13; const ID_MOSS=14;
const ID_BLUEWOOL=15; const ID_REDWOOL=16; const ID_QUARTZ=17; const ID_GLASS=18; const ID_LAMP=19;
function floorBlock(x, z, dx, dz, r) {
  if (r < 8.6) return dx < 0 ? ID_REDWOOL : ID_BLUEWOOL; // 中央徽章 红西蓝东
  if (Math.abs(r-9.5) < 0.6 || Math.abs(r-30) < 0.6) return ID_QUARTZ; // 石英环
  if (Math.hypot(dx+19, dz) < 3.3) return ID_REDWOOL; // 红方出生垫
  if (Math.hypot(dx-19, dz) < 3.3) return ID_BLUEWOOL; // 蓝方出生垫
  const t = hashRand(x*5+z, z*7+x);
  return t < 0.8 ? ID_STONE : (t < 0.95 ? ID_COBBLE : ID_MOSS);
}
function wallBlock(x, y, z) {
  const t = hashRand(x*7+z*3, y*13+z);
  return t < 0.7 ? ID_BRICK : (t < 0.9 ? ID_COBBLE : ID_MOSS);
}
function generate() {
  const G = ARENA.floorY;
  for (let x=0; x<WORLD_W; x++) {
    for (let z=0; z<WORLD_D; z++) {
      const dx = x+0.5-ARENA.cx; const dz = z+0.5-ARENA.cz;
      const r = Math.hypot(dx, dz);
      for (let y=0; y<=G; y++) setBlockRaw(x, y, z, ID_STONE); // 地基
      if (r < ARENA.rIn-0.5) setBlockRaw(x, G, z, floorBlock(x, z, dx, dz, r));
      else if (r <= ARENA.rOut+0.5) setBlockRaw(x, G, z, wallBlock(x, G, z));
      else setBlockRaw(x, G, z, ID_GRASS); // 外部草原
      if (r >= ARENA.rIn-0.5 && r <= ARENA.rOut+0.5) { // 环形墙 + 看台
        for (let y=G+1; y<=G+7; y++) setBlockRaw(x, y, z, wallBlock(x, y, z));
        setBlockRaw(x, G+8, z, hashRand(x*3, z) < 0.88 ? ID_BRICK : ID_COBBLE);
      }
      if (r >= ARENA.rIn-0.6 && r <= ARENA.rIn+0.6) { // 内侧玻璃护栏(1格,不挡视线)
        setBlockRaw(x, G+9, z, ID_GLASS);
      }
      if (r >= ARENA.rOut-0.6 && r <= ARENA.rOut+0.6) { // 外侧玻璃护栏(2格)
        setBlockRaw(x, G+9, z, ID_GLASS);
        setBlockRaw(x, G+10, z, ID_GLASS);
      }
      if (r > ARENA.rOut+7 && x>2 && z>2 && x<WORLD_W-3 && z<WORLD_D-3 &&
         hashRand(x+31, z+17) > 0.988) SceneKit.tree(x, G+1, z);
    }
  }
  for (let i=0; i<12; i++) { // 看台立柱 + 灯
    const a = i*Math.PI/6 + Math.PI/12;
    const px = Math.round(ARENA.cx + Math.cos(a)*(ARENA.rOut-1.4));
    const pz = Math.round(ARENA.cz + Math.sin(a)*(ARENA.rOut-1.4));
    for (let y=G+9; y<=G+11; y++) setBlockRaw(px, y, pz, ID_BRICK);
    setBlockRaw(px, G+12, pz, ID_LAMP);
  }
}
function spawnPlayer() {
  const sx = ARENA.cx; // 南侧看台正中
  const sz = ARENA.cz + (ARENA.rIn + ARENA.rOut)/2; // 走道中心
  const sy = groundTop(sx, sz);
  ModeKit.spawn(sx+0.5, sy+1.0, sz+0.5, {pitch: -0.22}); // 面朝 -Z 俯瞰全场
}

/* ---------- 怪物类型 ----------
   数值表 MOB_TYPES 在 config.js(怪物库 js/mobs.js 与竞技场/演习场共用) */
/* 混合编队池: 全部常规怪(Boss 与飞行单位除外 — 混编要贴脸互殴才热闹);
   spawnable() 是怪物库的"可部署清单"(排除 mix 伪类型), 伪类型过滤归引擎 */
const MIX_POOL = Mobs.spawnable().filter((k) =>
  !MOB_TYPES[k].boss && !MOB_TYPES[k].fly);
const MIX_AVG_POWER = Math.round(MIX_POOL.reduce((s, k)=>s+ARENA_POWER[k], 0) / MIX_POOL.length);
/* 混编按族等权分桶(谱系第一期机制消费): 先均匀抽主族再族内均匀抽成员 —
   成员均匀会让大家族(僵尸一家 4 只)挤掉小家族(软软族 2 只)的出场名额 */
const MIX_BUCKETS = (()=>{
  const b = {lone: []};
  for (const k of MIX_POOL) {
    const fam = ((MOB_TYPES[k].family)||[])[0] || 'lone';
    (b[fam] = b[fam] || []).push(k);
  }
  return b;
})();
const MIX_FAMS = Object.keys(MIX_BUCKETS);
function pickMix() {
  const fam = MIX_BUCKETS[MIX_FAMS[Math.floor(Math.random()*MIX_FAMS.length)]];
  return fam[Math.floor(Math.random()*fam.length)];
}

/* ---------- 升级系统 ----------
   个人击杀累积信用(劣势方×加成), 达标晋升:
   2级精英=属性暴涨+现有技能强化  3级王者=解锁新技能
   阈值随敌方初始数量缩放(25%/60%), 封顶 6/14 杀 */
const TIER_MULT = {2: {hp: 1.6, dmg: 1.4, spd: 1.1}, 3: {hp: 2.5, dmg: 2.0, spd: 1.2}};
const TIER_NAME = {2: '精英', 3: '王者'};
/* 克制关系(索敌偏好: 优先进攻自己克制的对手, 回避克制自己的)。龙另行特判 */
const COUNTER = {
  zombie: 'skeleton', skeleton: 'creeper', creeper: 'golem', golem: 'zombie', // 经典环
  enderman: 'skeleton', // 末影人瞬移闪箭, 专猎弓手
  blaze: 'stray', stray: 'magma_cube', // 火克冰, 冰克熔岩
  warden: 'ravager', // 监守者的蛮力无视巨兽冲撞
};

/* ---------- 怪物谱系: 家传技能表 + 个体特化表(术语见 GLOSSARY「怪物谱系」) ----------
   种族=长相接近的血统组(守卫组是唯一职责组例外), 家传技能=族共享模板
   (FAMILY_SKILLS), 按主族(config 的 family 首位)发放; 无近亲的怪(独行侠)不领家传。
   个体特化=每怪至多一招(MOB_QUIRKS): 节拍型特化挂 tick(末影人颤栗瞬移),
   蓄力激光声明 laser:true(起手在 moveRanged, 放束在 tickLaserCharge);
   扑袭(苦力怕)/震地·巨石(铁傀儡)/龙息(末影龙)是移动一体型特化, 留在各自原型分支。
   家传技能手感数字全部集中在这两张表 + 各 tick 函数头, 试玩改数即改这里。 */
const MOB_QUIRKS = {
  guardian: {laser: true}, // 特化=蓄力激光(守卫者)
  elder_guardian: {laser: true}, // 特化=蓄力激光(远古守卫者, 威慑咆哮三期补)
  enderman: {tick: tickBlink}, // 特化=颤栗瞬移(鬼一族成员, 瞬移是末影人个性不是全族的)
};
/* 主族折算(家传发放单位); familySkill:false 可声明个体豁免("族给默认值、个体可覆盖") */
function familyMain(type) {
  const q = MOB_QUIRKS[type];
  if (q && q.familySkill === false) return null;
  return ((MOB_TYPES[type] || {}).family || [])[0] || null;
}
const FAMILY_SKILLS = {
  zombie_line: {name: '狂暴', tick: tickRage},
  skeleton_line: {name: '强力节奏', tick: null}, // 节拍型: 射击/挥击处直接读族(rangedVolley/moveMelee)
  arthropod: {name: '疾爬突进', tick: tickBurst},
  pig_line: {name: '蛮冲', tick: tickCharge},
  ghost: {name: '阴风', tick: null}, // 命中型: 打中的敌人短时减速(结算在 damageMob 的 src 判定)
  guard: {name: '磐石', tick: tickGuard},
  illager: {name: '袭击协同', tick: tickRaid},
  slime_line: {name: '分裂', tick: null, onDead: splitDeath},
};
/* 技能分发: 家传按主族一张表 + 个体特化按种类一张表(两处挂点, updateMobs 每怪一调) */
function familyTick(m, gp, dt) {
  const fs = FAMILY_SKILLS[m.mfam];
  if (fs && fs.tick) fs.tick(m, gp, dt);
  const q = MOB_QUIRKS[m.type];
  if (q) {
    if (q.tick) q.tick(m, gp, dt);
    if (q.laser) tickLaserCharge(m, gp, dt); // 蓄力激光: 起手(移动层)与放束(节拍层)分离
  }
}
function familyOnDead(m) {
  const fs = FAMILY_SKILLS[m.mfam];
  if (fs && fs.onDead) fs.onDead(m);
}

let teamInitHp = {A: 1, B: 1}; // 劣势加成基准(开战时总HP)
const pendingBooms = []; // 王者苦力怕·连环爆破二段
const beams = []; // 升级光柱
const beamGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 10, 1, true); // 共享: 逐实例只有透明度(在材质)

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI*2);
  if (d > Math.PI) d -= Math.PI*2;
  if (d < -Math.PI) d += Math.PI*2;
  return a + d*Math.min(1, t);
}
/* 狂暴/群体冲锋/疾爬突进/蛮冲/阴风减速 速度系数 */
function mobSpeed(m) {
  let s = m.cfg.speed;
  if (m.raged) s *= 1.5;
  if (m.rageBuffT > 0) s *= 1.25;
  if (m.burstT > 0) s *= 1.8; // 虫虫族·疾爬突进(家传)
  if (m.chargeT > 0) s *= 2.2; // 猪猪一家·蛮冲(家传)
  if (m.slowT > 0) s *= 0.6; // 被鬼一族·阴风打中(减速)
  if (m.level===2) s *= 1.1;
  else if (m.level===3) s *= 1.2;
  return s;
}
/* ---------- 建模/合批渲染/名牌/受击/游荡 已归怪物库 js/mobs.js(Mobs) ---------- */

/* ---------- 怪物实例 / 战斗 ---------- */
const mobs = Mobs.list(); // 怪物库内部数组的只读视图(clear 原地清空, 引用稳定)
const fusingCreeps = []; // 每帧收集:正在读条的苦力怕(逃跑AI用,避免O(n²))
const sepGrid = new Map(); // 挤开检测用的空间网格(1×1 格)
let battleState = 'idle'; // idle | fighting | over
let battleResult = '';

const arrows = [];
const arrowGeo = new THREE.BoxGeometry(0.07, 0.07, 0.8);
const arrowMat = new THREE.MeshLambertMaterial({color: 0x3a2c1c});
const arrowPowerMat = new THREE.MeshBasicMaterial({color: 0xfff2b0}); // 强力箭(亮白)
const breathBalls = [];
const clouds = [];

/* 部署: 怪物库造身体, 竞技场挂战斗字段(阵营/索敌/技能/晋升); extra 透传 hpMult 等(分裂小只用) */
/* 晋升星级的名牌呈现(语义归模式层): 名牌渲染归怪物库(labelCfg.suffix/hot) */
const tierStars = (m) => m.level>1 ? '★'.repeat(m.level-1) : '';
const tierHot = (m) => m.level>1;
function spawnMob(team, type, x, z, extra) {
  const m = Mobs.spawn(type, x, z, {
    yaw: team==='A' ? Math.PI/2 : -Math.PI/2,
    flyY: ARENA.floorY + ARENA.flyAlt,
    label: team==='A' ?
      {prefix: '红方·', color: '#ff6055', suffix: tierStars, hot: tierHot} :
      {prefix: '蓝方·', color: '#5ab0ff', suffix: tierStars, hot: tierHot},
    clamp: arenaFlyClamp,
    ...(extra || {}),
  });
  m.team = team;
  Object.assign(m, {
    target: null, retargetT: Math.random()*0.5,
    attackT: 0, attackCd: 0.6+Math.random()*0.6,
    fuse: -1,
    vx: 0, vz: 0, strafeT: 0, strafeDir: 1,
    air: false, vy: 0, jumpVX: 0, jumpVZ: 0, slamming: false,
    slamCd: 2+Math.random()*3, pounceCd: 2+Math.random()*3,
    shotCnt: 0, raged: false, rageBuffT: 0,
    /* 家传/特化技能节拍字段(各族只消费自己的): burst 疾爬突进 · raid 协同重数 ·
       laser 蓄力(-1=空闲) · blink 瞬移 · charge 蛮冲 · stone 磐石 · slow 被阴风 · split 小只标记 */
    mfam: familyMain(type),
    burstCd: 2+Math.random()*3, burstT: 0,
    raidT: Math.random()*0.4,
    laserT: -1,
    tpCd: 2+Math.random()*3, meleeCnt: 0,
    chargeCd: 2+Math.random()*4, chargeT: 0, chargeYaw: 0,
    stoneT: 0, stoneCd: 4, slowT: 0,
    splitChild: false,
    /* k2/k3(晋升杀数阈值)不设默认值: 部署时按敌方规模定值(deploySpawnQueue),
       漏设会在 addKillCredit 里 NaN 比较永不晋升 — 宁可显式也不静默兜底 */
    level: 1, kills: 0, dmgMult: 1, invulnT: 0, rockCd: 2,
    baseMaxHp: m.maxHp, tierScale: 1,
    orbitA: Math.random()*Math.PI*2,
    flank: (Math.random()*2-1) * (m.cfg.ranged ? 0.35 : 0.85),
  });
  return m;
}

/* 飞行单位场地边界(圆形): 击退回调(半径 FLY_KNOCK_R)与巡飞约束(FLY_ORBIT_R)两档,
   均收在 clampToArena 一处 — 怪物库 hit 的 clamp 回调与战斗巡飞共用 */
const FLY_KNOCK_R = 2; const FLY_ORBIT_R = 2.5;
function clampToArena(m, margin) {
  const cdx = m.pos.x-ARENA.cx; const cdz = m.pos.z-ARENA.cz;
  const cd = Math.hypot(cdx, cdz);
  const rMax = ARENA.rIn - margin;
  if (cd > rMax) {
    const k=rMax/cd; Mobs.setPos(m, ARENA.cx+cdx*k, ARENA.cz+cdz*k);
  }
}
function arenaFlyClamp(m) {
  clampToArena(m, FLY_KNOCK_R);
}

/* 移动: 圆形边界约束 + 怪物核心的台阶规则 */
function stepMove(m, mx, mz) {
  const nx = m.pos.x+mx; const nz = m.pos.z+mz;
  const ddx = nx-ARENA.cx; const ddz = nz-ARENA.cz;
  if (Math.hypot(ddx, ddz) > ARENA.rIn-1.2) return;
  MobCore.stepMove(m, mx, mz, groundTop);
}

/* 受击: 通用部分(扣血/闪白/踉跄/击退/死亡)归怪物库; 金身/守卫减伤/鬼族阴风/击杀结算归玩法 */
function damageMob(m, dmg, kdx, kdz, kpow, src) {
  if (m.dead || m.gone) return;
  if (m.invulnT > 0) return; // 升级金身
  if (m.mfam === 'guard' && m.stoneT > 0) { // 守卫组·磐石(家传): 坚守中受伤减半
    dmg = Math.max(1, Math.ceil(dmg*0.5));
  }
  const r = Mobs.hit(m, dmg, kdx, kdz, kpow);
  if (!m.dead && !m.gone && src && src.mfam === 'ghost' && src !== m) {
    m.slowT = Math.max(m.slowT, 1.5); // 鬼一族·阴风(家传): 被鬼打中短时变慢
    Fx.pop(m.pos.x, m.pos.y+1, m.pos.z, {color: 0x8fd8e8, r0: 0.2, r1: 1.1, dur: 0.25, opacity: 0.6});
  }
  if (r.freshDead) {
    awardKill(src, m);
    familyOnDead(m); // 家传亡语(软软族·分裂)
    checkBattleEnd();
  }
}

/* ---------- 弹道与 AoE 助手(箭/巨石/火球三套近似弹道与三套伤害环归一) ---------- */
/* 预测弹道方向: 预测/提前量/重力补偿的数学在战斗核心(CombatCore.leadAim,
   与下界火球共用), 这里只做 THREE 包装 */
function aimDir(from, tg, v0, g, hFrac) {
  const d = CombatCore.leadAim({x: from.x, y: from.y, z: from.z},
      {x: tg.pos.x, y: tg.pos.y, z: tg.pos.z, vx: tg.vx||0, vz: tg.vz||0, h: tg.cfg.h}, v0, g, hFrac);
  return new THREE.Vector3(d.x, d.y, d.z);
}

/* AoE 伤害环: 过滤存活/敌队 → 距离线性衰减伤害+击退 → 硬直
   o: {team(跳过同队, undefined=炸双方), skip(跳过自身), owner, dmg,
       fallOff(边缘衰减比), kpow, stagger, use3D(距离含高度差), dyGate(高度差门槛)} */
function aoeDamage(x, y, z, r, o) {
  for (const t of mobs) {
    if (t.dead || t.gone) continue;
    if (o.skip && t === o.skip) continue;
    if (o.team !== undefined && t.team === o.team) continue;
    const dx = t.pos.x-x; const dz = t.pos.z-z;
    const d = o.use3D ? Math.hypot(dx, t.pos.y+1-y, dz) : Math.hypot(dx, dz);
    if (o.dyGate !== undefined && Math.abs(t.pos.y-y) > o.dyGate) continue;
    if (d < r) {
      damageMob(t, Math.round(o.dmg*(1-d/r*o.fallOff)), dx, dz, o.kpow, o.owner);
      Mobs.stagger(t, o.stagger);
    }
  }
}

/* 强力箭节奏 + 王者箭雨(全部远程怪共用: 精英每第2箭强力, 王者三连散射)
   骷髅一家·族版更密(D7): 基础即每 2 箭(其余族精英才加密) */
function rangedVolley(m, tg) {
  m.shotCnt++;
  const div = (m.mfam==='skeleton_line' || m.level>=2) ? 2 : 3;
  const pw = m.shotCnt % div === 0;
  shootArrow(m, tg, pw);
  if (pw && m.level>=3) {
    shootArrow(m, tg, true, 0.16); shootArrow(m, tg, true, -0.16);
  }
}

function shootArrow(m, tg, power, yawOff) {
  sfx('shoot');
  const v0 = power ? 34 : 26; const g = 9.5; // 强力箭更快更痛更重击退
  const from = new THREE.Vector3(m.pos.x, m.pos.y+1.45, m.pos.z);
  const dir = aimDir(from, tg, v0, g, 0.55);
  dir.x += (Math.random()-0.5)*(power?0.02:0.04); // 强力箭更精准
  dir.y += (Math.random()-0.5)*0.02;
  dir.z += (Math.random()-0.5)*(power?0.02:0.04);
  dir.normalize();
  if (yawOff) { // 箭雨散射偏转
    const c=Math.cos(yawOff); const s=Math.sin(yawOff);
    dir.set(dir.x*c - dir.z*s, dir.y, dir.x*s + dir.z*c).normalize();
  }
  const mesh = new THREE.Mesh(arrowGeo, power ? arrowPowerMat : arrowMat);
  if (power) mesh.scale.set(1.6, 1.6, 1.6);
  mesh.position.copy(from);
  mesh.lookAt(from.x+dir.x, from.y+dir.y, from.z+dir.z);
  scene.add(mesh);
  arrows.push({mesh, vel: dir.multiplyScalar(v0), life: 2.5, team: m.team,
    dmg: Math.round((power ? 10+Math.floor(Math.random()*3) : 6+Math.floor(Math.random()*3))*m.dmgMult),
    kpow: power ? 0.8 : 0.35, owner: m});
}

/* 王者铁傀儡·巨石投掷(抛物线 + 落点AoE) */
const rockGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
const rockMat = new THREE.MeshLambertMaterial({color: 0x8a8f98});
function throwRock(m, tg) {
  sfx('shoot');
  const v0 = 20;
  const from = new THREE.Vector3(m.pos.x, m.pos.y+3.0, m.pos.z);
  const dir = aimDir(from, tg, v0, 9.5, 0.5);
  const mesh = new THREE.Mesh(rockGeo, rockMat);
  mesh.position.copy(from);
  mesh.rotation.set(Math.random()*3, Math.random()*3, 0);
  scene.add(mesh);
  arrows.push({mesh, vel: dir.multiplyScalar(v0), life: 2.5, team: m.team,
    dmg: Math.round(22*m.dmgMult), kpow: 1.4, aoe: 2.6, owner: m});
}
function rockBlast(a, p) {
  Fx.boom(p.x, p.y, p.z, {r1: a.aoe, n: 6});
  if (a.fire) { // 火球爆心加橙红闪光
    Fx.pop(p.x, p.y+0.4, p.z, {color: 0xff8a3c, r0: 0.5, r1: a.aoe+1.2, dur: 0.3, opacity: 0.85});
  }
  Fx.kick(0.3);
  aoeDamage(p.x, p.y, p.z, a.aoe, {team: a.team, owner: a.owner, dmg: a.dmg,
    fallOff: 0.6, kpow: 1.2, stagger: 0.4, use3D: true});
}

/* 飞行炮台通用·爆裂火球(恶魂/凋灵/烈焰人/旋风人): 抛物线 + 落点AoE(走 arrows 管线) */
const fireballGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
const fireballMat = new THREE.MeshBasicMaterial({color: 0xff9a3c});
function throwFireball(m, tg) {
  sfx('shoot');
  const v0 = 17;
  const from = new THREE.Vector3(m.pos.x, m.pos.y + m.cfg.h*0.55, m.pos.z);
  const dir = aimDir(from, tg, v0, 6, 0.5); // 火球重力更轻, 弹道更飘
  const mesh = new THREE.Mesh(fireballGeo, fireballMat);
  mesh.position.copy(from);
  scene.add(mesh);
  arrows.push({mesh, vel: dir.multiplyScalar(v0), life: 2.5, team: m.team,
    dmg: Math.round(m.cfg.dmg*m.dmgMult), kpow: 1.0, aoe: 2.2, fire: true, g: 6, owner: m});
}

function golemSlam(m) {
  m.slamming = false;
  Mobs.stagger(m, 0.5); // 落地后短暂硬直
  Fx.kick(0.45);
  sfx('boom');
  Fx.pop(m.pos.x, m.pos.y+0.3, m.pos.z,
      {color: 0xd8c9a8, r0: 0.5, r1: m.level>=2 ? 5.2 : 4.2, dur: 0.35, opacity: 0.8});
  Fx.debrisBurst(m.pos.x, m.pos.y+0.2, m.pos.z, 8, {ring: true, life: 0.7});
  const R = m.level>=2 ? 5 : 4; // 精英:震地范围更大
  /* 双分支刻意不成环: 近处受击致硬直 1s, 否则低空单位被冲击波震落 1.2s(不伤害) */
  for (const t of mobs) {
    if (t===m || t.dead || t.gone || t.team===m.team) continue;
    const dx = t.pos.x-m.pos.x; const dz = t.pos.z-m.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < R && Math.abs(t.pos.y-m.pos.y) < 3.5) {
      damageMob(t, Math.round(18*m.dmgMult*(1-d/R*0.6)), dx, dz, 2.2, m);
      Mobs.stagger(t, 1.0); // 震地:震慑 1 秒
    } else if (t.cfg.fly && d < R+0.5 && (t.pos.y-m.pos.y) < 8) {
      Mobs.stagger(t, 1.2); // 冲击波:震落低空单位
    }
  }
}

function explode(x, y, z, team, owner, ratio) {
  ratio = ratio || 1;
  const lv = owner ? owner.level : 1;
  const r = 5.5*ratio*(1+0.15*(lv-1));
  Fx.boom(x, y, z, {r1: r, n: Math.round(11*ratio)});
  aoeDamage(x, y, z, r, {team, owner,
    dmg: 33*ratio*(owner?owner.dmgMult:1), fallOff: 0.75, kpow: 2.0, stagger: 0.5, use3D: true});
}

/* ---------- 升级系统逻辑 ---------- */
function teamHpFrac(team) {
  const init = teamInitHp[team];
  if (!init) return 1;
  let hp = 0;
  for (const t of mobs) if (t.team===team && !t.dead && !t.gone) hp += t.hp;
  return Math.min(1, hp/init);
}
function comebackMult(team) { // 劣势方击杀信用加成(1~2)
  const mine = teamHpFrac(team); const theirs = teamHpFrac(team==='A'?'B':'A');
  return Math.min(2, Math.max(1, 1 + 0.8*(theirs - mine)));
}
function awardKill(killer, victim) {
  if (battleState !== 'fighting') return;
  const mult = comebackMult(victim.team==='A' ? 'B' : 'A');
  if (killer && killer.team!==victim.team && !killer.dead && !killer.gone) {
    addKillCredit(killer, mult);
  }
  // 苦力怕特权:每击杀随机挑一只存活苦力怕分得经验(避免全群同步晋升)
  const creeps = [];
  for (const c of mobs) {
    if (c!==killer && c.type==='creeper' && c.team!==victim.team && !c.dead && !c.gone) creeps.push(c);
  }
  if (creeps.length) {
    addKillCredit(creeps[Math.floor(Math.random()*creeps.length)], 0.5*mult);
  }
}
function addKillCredit(m, credit) {
  m.kills += credit;
  while (m.level < 3 && !m.dead && !m.gone && m.kills >= (m.level===1 ? m.k2 : m.k3)) {
    levelUp(m);
  } // 同帧多杀可连跳级
}
function levelUp(m) {
  m.level++;
  const tm = TIER_MULT[m.level];
  Mobs.setMaxHp(m, Math.round(m.baseMaxHp*tm.hp)); // 晋升改上限(意图 API, 怪物库截断现血)
  Mobs.heal(m, Math.round(m.maxHp*0.2)); // 升级回复20%最大生命
  m.dmgMult = tm.dmg;
  m.invulnT = 0.5; // 金身免死(名牌随 hp 变化由怪物库节流重绘)
  applyTierVisual(m);
  levelUpFx(m);
  showToast((m.team==='A'?'红方 ':'蓝方 ')+TIER_NAME[m.level]+m.cfg.name+' 晋升！', 2000);
}
/* 外形:体型放大 + 脚下光环(精英蓝/王者金) + 标志性附件
   挂件是独立普通 mesh(稀有物), 怪物库 render 每帧对齐实例位姿 */
function applyTierVisual(m) {
  m.tierScale = m.level===2 ? 1.3 : (m.level===3 ? 1.6 : 1); // 体型明显变大(体积≈2.2×/4×)
  Mobs.scaleTo(m, m.tierScale); // 原 group.scale → 位姿数值(怪物库 render 组矩阵)
  if (m.tierNode) {
    scene.remove(m.tierNode);
    m.tierGeos.forEach((g)=>g.dispose()); // 光环圆面是专属几何; 挂件盒子走共享缓存不 dispose
    m.tierGeos = [];
    m.tierMats.forEach((mt)=>mt.dispose());
    m.tierMats = [];
  }
  m.tierNode = null;
  if (m.level < 2) return;
  m.labelScale = m.level===3 ? 1.5 : 1.25; // 升级后名牌放大(怪物库 update 每帧套用)
  const fx = new THREE.Group();
  const mat = (col) => {
    const mt = new THREE.MeshBasicMaterial({color: col}); m.tierMats.push(mt); return mt;
  };
  const add = (w, h, d, x, y, z, col)=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col)); b.position.set(x, y, z); fx.add(b);
  }; // 挂件稀有, 不走共享缓存
  const aura = new THREE.Mesh(
      new THREE.CircleGeometry(m.cfg.fly?1.5:0.85, 24),
      new THREE.MeshBasicMaterial({color: m.level===3?0xffd44d:0x6cd8ff, transparent: true,
        opacity: 0.5, depthWrite: false}));
  m.tierMats.push(aura.material);
  m.tierGeos.push(aura.geometry);
  aura.rotation.x = -Math.PI/2; aura.position.y = 0.07;
  fx.add(aura); fx.userData.aura = aura;
  switch (m.type) {
    case 'zombie': // 肩甲 → 金盔
      if (m.level>=2) {
        add(0.3, 0.16, 0.5, -0.42, 1.42, 0, 0x2a2a30); add(0.3, 0.16, 0.5, 0.42, 1.42, 0, 0x2a2a30);
      }
      if (m.level>=3) {
        add(0.56, 0.22, 0.56, 0, 1.98, 0, 0xd8b028); add(0.24, 0.12, 0.12, 0, 1.98, 0.32, 0xd8b028);
      }
      break;
    case 'skeleton': // 铁盔 → 金冠金甲
      if (m.level>=2) {
        add(0.54, 0.2, 0.54, 0, 1.86, 0, 0x3a3a44);
      }
      if (m.level>=3) {
        add(0.48, 0.16, 0.48, 0, 2.04, 0, 0xd8b028);
        add(0.3, 0.14, 0.46, -0.4, 1.44, 0, 0xd8b028); add(0.3, 0.14, 0.46, 0.4, 1.44, 0, 0xd8b028);
      }
      break;
    case 'creeper': // 充能电光 → 红裂纹+金环
      if (m.level>=2) {
        add(0.16, 0.16, 0.16, 0, 1.86, 0, 0x9fe8ff);
      }
      if (m.level>=3) {
        add(0.5, 0.14, 0.5, 0, 1.86, 0, 0xd8b028);
        add(0.06, 0.42, 0.03, -0.09, 0.9, 0.17, 0xff5a30); add(0.06, 0.42, 0.03, 0.09, 0.9, 0.17, 0xff5a30);
        add(0.06, 0.3, 0.03, -0.1, 1.28, 0.27, 0xff5a30); add(0.06, 0.3, 0.03, 0.1, 1.28, 0.27, 0xff5a30);
      }
      break;
    case 'golem': // 肩刺 → 金冠
      if (m.level>=2) {
        add(0.3, 0.44, 0.3, -0.87, 3.1, 0, 0x8a8f98); add(0.3, 0.44, 0.3, 0.87, 3.1, 0, 0x8a8f98);
      }
      if (m.level>=3) {
        add(0.8, 0.2, 0.8, 0, 3.12, 0, 0xd8b028);
      }
      break;
    case 'dragon': // 金角尖 → 背脊金刺
      if (m.level>=2) {
        add(0.2, 0.34, 0.2, -0.3, 2.62, 2.95, 0xd8b028); add(0.2, 0.34, 0.2, 0.3, 2.62, 2.95, 0xd8b028);
      }
      if (m.level>=3) {
        add(0.16, 0.4, 0.16, 0, 2.1, 0.6, 0xd8b028);
        add(0.16, 0.4, 0.16, 0, 2.15, -0.6, 0xd8b028); add(0.16, 0.4, 0.16, 0, 2.1, -1.7, 0xd8b028);
      }
      break;
  }
  m.tierNode = fx;
  scene.add(fx); // 独立节点: 不再挂在怪实例上
}
function levelUpFx(m) {
  sfx('level');
  Fx.pop(m.pos.x, m.pos.y+1, m.pos.z, {color: 0xffe27a, r0: 0.5, r1: 2.6, dur: 0.5});
  const beam = new THREE.Mesh(beamGeo,
      new THREE.MeshBasicMaterial({color: 0xffe27a, transparent: true, opacity: 0.55, depthWrite: false}));
  beam.position.set(m.pos.x, m.pos.y+3, m.pos.z);
  scene.add(beam);
  beams.push({mesh: beam, t: 0, dur: 0.7});
}
function updateBeams(dt) {
  for (let i=beams.length-1; i>=0; i--) {
    const b = beams[i]; b.t += dt;
    const p = b.t/b.dur;
    if (p >= 1) {
      scene.remove(b.mesh); b.mesh.material.dispose(); beams.splice(i, 1); continue;
    }
    b.mesh.material.opacity = 0.55*(1-p);
    b.mesh.scale.set(1+p*0.6, 1, 1+p*0.6);
  }
}
function updatePendingBooms(dt) {
  for (let i=pendingBooms.length-1; i>=0; i--) {
    const b = pendingBooms[i]; b.t -= dt;
    if (b.t <= 0) {
      explode(b.x, b.y, b.z, b.team, b.owner, 0.65); pendingBooms.splice(i, 1);
    }
  }
}

/* 苦力怕平A: 吐舌头舔击(短伸缩特效) — 几何/材质全共享(动画只有缩放, 无逐实例材质状态) */
const tongueFx = [];
const tongueGeo = new THREE.BoxGeometry(0.34, 0.1, 0.7);
const tongueMat = new THREE.MeshBasicMaterial({color: 0xff8fb0});
function spawnTongue(m, tg) {
  const mesh = new THREE.Mesh(tongueGeo, tongueMat);
  const a = Math.atan2(tg.pos.x-m.pos.x, tg.pos.z-m.pos.z);
  mesh.position.set(m.pos.x + Math.sin(a)*0.95, m.pos.y + 1.32, m.pos.z + Math.cos(a)*0.95);
  mesh.rotation.y = a;
  scene.add(mesh);
  tongueFx.push({mesh, t: 0});
}
function updateTongues(dt) {
  for (let i=tongueFx.length-1; i>=0; i--) {
    const f = tongueFx[i];
    f.t += dt;
    f.mesh.scale.z = 1 + Math.sin(Math.min(1, f.t/0.28)*Math.PI)*0.7; // 伸缩
    if (f.t > 0.3) {
      scene.remove(f.mesh); // 几何/材质共享常驻
      tongueFx.splice(i, 1);
    }
  }
}
function clearTongues() {
  for (const f of tongueFx) {
    scene.remove(f.mesh);
  }
  tongueFx.length = 0;
}

function checkBattleEnd() {
  if (battleState !== 'fighting') return;
  if (spawnQueue.length) return; // 部署未完: 不判负(未到场≠全灭)
  const a = mobs.some((m)=>m.team==='A' && !m.dead && !m.gone);
  const b = mobs.some((m)=>m.team==='B' && !m.dead && !m.gone);
  if (a && b) return;
  battleState = 'over';
  battleResult = a ? '红方获胜！' : (b ? '蓝方获胜！' : '两败俱伤！');
  showToast(battleResult + '  按 R 再来一场', 4000);
  sfx('win');
}

/* 附近有正在读条的敌方苦力怕则返回之(自己读条中,或贴脸两击能反杀时除外) */
function fusingCreeperNear(m) {
  if (m.type==='creeper' && m.fuse >= 0) return null;
  for (const t of fusingCreeps) {
    if (t.team===m.team) continue;
    const fd = Math.hypot(t.pos.x-m.pos.x, t.pos.z-m.pos.z);
    if (fd < 5.5) {
      if (!m.cfg.ranged && fd < m.cfg.range && m.cfg.dmg*m.dmgMult*2 >= t.hp) return null;
      return t;
    }
  }
  return null;
}

/* ---------- 战斗 AI: 按职责拆分, updateMobs 只留编排(与旧版逐字等价的机械抽取) ---------- */

/* 每帧收集: 正在读条的苦力怕(逃跑AI用,避免O(n²)) */
function collectFusing() {
  fusingCreeps.length = 0;
  for (const t of mobs) {
    if (t.type==='creeper' && t.fuse>=0 && !t.dead && !t.gone) fusingCreeps.push(t);
  }
}

/* 冷却/计时器递减 + 阶级光环呼吸(攻击节拍递减在战斗核心, 与下界共用) */
function tickTimers(m, dt) {
  CombatCore.tickCadence(m, dt);
  if (m.slamCd > 0) m.slamCd -= dt;
  if (m.pounceCd > 0) m.pounceCd -= dt;
  if (m.rageBuffT > 0) m.rageBuffT -= dt;
  if (m.burstCd > 0) m.burstCd -= dt; // 虫虫族·疾爬突进冷却
  if (m.burstT > 0) m.burstT -= dt;
  if (m.chargeCd > 0) m.chargeCd -= dt; // 猪猪一家·蛮冲冷却/冲刺计时
  if (m.chargeT > 0) m.chargeT -= dt;
  if (m.tpCd > 0) m.tpCd -= dt; // 末影人·颤栗瞬移冷却(个体特化)
  if (m.stoneT > 0) m.stoneT -= dt; // 守卫组·磐石坚守计时
  if (m.stoneCd > 0) m.stoneCd -= dt;
  if (m.slowT > 0) m.slowT -= dt; // 被鬼一族·阴风打中的减速计时
  if (m.invulnT > 0) m.invulnT -= dt;
  if (m.rockCd > 0) m.rockCd -= dt;
  if (m.tierNode && m.tierNode.userData.aura) {
    const as = 1 + Math.sin(performance.now()*0.004 + m.id)*0.12;
    m.tierNode.userData.aura.scale.set(as, as, as);
  }
}

/* 僵尸一家·狂暴(家传): 血量触发(精英70%/基础50%), 自身加速+攻速, 附近同族群体冲锋; 王者附冲击波
   (原僵尸专属技, 谱系化推广到僵尸/尸壳/溺尸/僵尸疣猪兽 — 僵尸猪灵主族=猪灵系领战吼, D6) */
function tickRage(m, gp) {
  if (m.raged || m.hp >= m.maxHp*(m.level>=2?0.7:0.5)) return;
  m.raged = true;
  m.tintBase = [1.4, 0.5, 0.5]; // 狂暴红晕(持久色, 怪物库着色)
  sfx('roar');
  const rr = m.level>=2 ? 9 : 6;
  for (const t of mobs) {
    if (t!==m && t.mfam==='zombie_line' && !t.dead && !t.gone &&
       Math.hypot(t.pos.x-gp.x, t.pos.z-gp.z) < rr) t.rageBuffT = m.level>=3?5:4;
  }
  if (m.level>=3) { // 王者·狂暴冲击波
    Fx.pop(gp.x, gp.y+1, gp.z, {color: 0xff6a4a, r0: 0.5, r1: 5, dur: 0.4, opacity: 0.8});
    aoeDamage(gp.x, gp.y, gp.z, 5, {skip: m, team: m.team, owner: m,
      dmg: 10*m.dmgMult, fallOff: 0.5, kpow: 1.2, stagger: 0.8, dyGate: 4});
  }
}

/* 虫虫族·疾爬突进(家传): 距目标 3~10 格短促加速贴脸(1.1s ×1.8), 冷却 6s/精英 4.5s */
function tickBurst(m, gp) {
  if (m.burstCd > 0 || m.burstT > 0) return;
  const tg = m.target;
  if (!tg || tg.dead || tg.gone) return;
  const d = Math.hypot(tg.pos.x-gp.x, tg.pos.z-gp.z);
  if (d < 3 || d > 10) return;
  m.burstCd = m.level>=2 ? 4.5 : 6;
  m.burstT = 1.1;
  Fx.pop(gp.x, gp.y+0.2, gp.z, {color: 0x9fbf6a, r0: 0.3, r1: 1.6, dur: 0.3, opacity: 0.7});
}

/* 猪猪一家·蛮冲(家传): 距目标 3~9 格发起直线冲刺(0.8s ×2.2), 撞到第一个敌人
   重击+大击退+硬直; 冲刺位移在 moveMelee 的蛮冲分支(方向锁定起手瞬间) */
function tickCharge(m, gp) {
  if (m.chargeT > 0 || m.chargeCd > 0) return;
  const tg = m.target;
  if (!tg || tg.dead || tg.gone) return;
  const d = Math.hypot(tg.pos.x-gp.x, tg.pos.z-gp.z);
  if (d < 3 || d > 9) return;
  m.chargeCd = m.level>=2 ? 5 : 7;
  m.chargeT = 0.8;
  m.chargeYaw = Math.atan2(tg.pos.x-gp.x, tg.pos.z-gp.z);
  sfx('roar');
  Fx.pop(gp.x, gp.y+0.3, gp.z, {color: 0xff8856, r0: 0.3, r1: 1.8, dur: 0.3, opacity: 0.7});
}

/* 守卫组·磐石(家传): 血量跌破 40% 进入坚守 3s(受伤减半, 结算在 damageMob), 冷却 12s/精英 9s */
function tickGuard(m, gp) {
  if (m.stoneCd > 0 || m.stoneT > 0 || m.hp >= m.maxHp*0.4) return;
  m.stoneT = 3;
  m.stoneCd = m.level>=2 ? 9 : 12;
  sfx('roar');
  Fx.pop(gp.x, gp.y+1, gp.z, {color: 0x9fb6c8, r0: 0.6, r1: 3.2, dur: 0.5, opacity: 0.85});
}

/* 灾厄帮·袭击协同(家传): 每 0.4s 重数 10 格内同族同阵营, 每多一只 +6% 伤害(至多 4 只);
   dmgMult 每拍重算 = 晋升系数 × 协同加成(levelUp 直写下一拍自愈, 语义一致) */
function tickRaid(m, gp, dt) {
  m.raidT -= dt;
  if (m.raidT > 0) return;
  m.raidT = 0.4;
  let n = 0;
  for (const t of mobs) {
    if (t.mfam==='illager' && t.team===m.team && !t.dead && !t.gone &&
       Math.hypot(t.pos.x-gp.x, t.pos.z-gp.z) < 10) n++;
  }
  m.dmgMult = TIER_MULT[m.level].dmg * (1 + 0.06*Math.min(4, n-1));
}

/* 守卫者系·蓄力激光(个体特化): 起手在 moveRanged(m.laserT=0), 此处推进蓄力(白闪渐强+锁定转向)
   → 蓄满放束(Fx.beam 直线, cfg.dmg×1.5); 被硬直打断即取消 */
function tickLaserCharge(m, gp, dt) {
  if (m.laserT < 0) return;
  if (m.staggerT > 0) {
    m.laserT = -1; return;
  } // 蓄力被打断
  m.laserT += dt;
  const charge = m.level>=2 ? 0.55 : 0.7;
  const v = 1 + Math.min(1, m.laserT/charge); // 白闪渐强(脉冲着色, 不动持久色)
  Mobs.pulseTint(m, v, v, v);
  const tg = m.target;
  if (tg && !tg.dead && !tg.gone) {
    Mobs.steer(m, angleLerp(m.yaw, Math.atan2(tg.pos.x-gp.x, tg.pos.z-gp.z), dt*6));
  }
  if (m.laserT < charge) return;
  m.laserT = -1;
  m.attackCd = m.cfg.cd + Math.random()*0.5;
  m.attackT = 0.4;
  let tx; let ty; let tz; let hit = null;
  if (tg && !tg.dead && !tg.gone &&
     Math.hypot(tg.pos.x-gp.x, tg.pos.z-gp.z) <= m.cfg.range*1.15) {
    hit = tg; tx = tg.pos.x; ty = tg.pos.y+0.9; tz = tg.pos.z;
  } else { // 目标已失: 朝锁定方向放空一束(观感完整)
    tx = gp.x + Math.sin(m.yaw)*10; ty = gp.y+0.9; tz = gp.z + Math.cos(m.yaw)*10;
  }
  Fx.beam(gp.x, gp.y+0.9, gp.z, tx, ty, tz, {color: 0xffa040});
  sfx('shoot');
  if (hit) damageMob(hit, Math.round(m.cfg.dmg*1.5*m.dmgMult), tx-gp.x, tz-gp.z, 0.6, m);
}

/* 末影人·颤栗瞬移(个体特化): 距目标 8 格外闪现贴身(目标旁 2.5~3.5 格), 冷却 5s/精英 3.5s */
function tickBlink(m, gp) {
  if (m.tpCd > 0) return;
  const tg = m.target;
  if (!tg || tg.dead || tg.gone) return;
  if (Math.hypot(tg.pos.x-gp.x, tg.pos.z-gp.z) < 8) return;
  m.tpCd = m.level>=2 ? 3.5 : 5;
  Fx.pop(gp.x, gp.y+1, gp.z, {color: 0xd06bff, r0: 0.4, r1: 2.2, dur: 0.35, opacity: 0.85});
  const a = Math.random()*Math.PI*2; const r = 2.5 + Math.random();
  let nx = tg.pos.x + Math.sin(a)*r; let nz = tg.pos.z + Math.cos(a)*r;
  const cdx = nx-ARENA.cx; const cdz = nz-ARENA.cz; const cd = Math.hypot(cdx, cdz);
  if (cd > ARENA.rIn-1.5) {
    const k=(ARENA.rIn-1.5)/cd; nx = ARENA.cx+cdx*k; nz = ARENA.cz+cdz*k;
  }
  Mobs.setPos(m, nx, nz);
  Mobs.settle(m); // 贴地回站
  Mobs.steer(m, Math.atan2(tg.pos.x-nx, tg.pos.z-nz));
  Fx.pop(nx, gp.y+1, nz, {color: 0xd06bff, r0: 0.4, r1: 2.2, dur: 0.35, opacity: 0.85});
  sfx('hit');
}

/* 软软族·分裂(家传): 死亡生 2 只小只(血量 30% · 体型 0.6, 小只不再分裂); 团战 600 只后停(防爆仓)。
   走延迟队列: damageMob 的调用方可能正迭代 mobs(aoeDamage 爆炸环), 同帧落地会
   边迭代边追加 + 同一爆炸立刻打死新生儿 — 下一帧 flush 干净落场 */
const pendingSplits = [];
function splitDeath(m) {
  if (m.splitChild || battleState !== 'fighting') return;
  let alive = 0;
  for (const t of mobs) if (!t.dead && !t.gone) alive++;
  if (alive > 600) return;
  pendingSplits.push({team: m.team, type: m.type, x: m.pos.x, z: m.pos.z,
    k2: m.k2, k3: m.k3});
}
function flushSplits() {
  while (pendingSplits.length) {
    const s = pendingSplits.shift();
    for (let i=0; i<2; i++) {
      const c = spawnMob(s.team, s.type,
          s.x + (i ? 0.6 : -0.6), s.z + (Math.random()-0.5)*1.2, {hpMult: 0.3});
      c.splitChild = true;
      c.k2 = s.k2; c.k3 = s.k3; // 继承晋升门槛(击杀信用照走)
      Mobs.scaleTo(c, 0.6);
    }
  }
}

/* 索敌: 距离 × 战术权重 — 个体偏好 + 目标粘性 + 收割残血 + 克制关系 + 可达性 */
function retarget(m, gp, dt) {
  m.retargetT -= dt;
  if (!m.target || m.target.dead || m.target.gone || m.retargetT <= 0) {
    m.retargetT = 0.5 + Math.random()*0.4;
    let best=null; let bd=1e9;
    for (const t of mobs) {
      if (t===m || t.dead || t.gone || t.team===m.team) continue;
      let w = 0.75 + hashRand(m.id*97 + t.id*13, t.id*29 + m.id*7)*0.5;
      if (t === m.target) w *= 0.75; // 目标粘性:不频繁切换
      if (t.hp < t.maxHp*0.3) w *= 0.55; // 优先收割残血
      if (COUNTER[m.type] === t.type) w *= 0.65; // 优先进攻克制对象
      else if (COUNTER[t.type] === m.type) w *= 1.5; // 回避克制自己的对手
      if (t.cfg.fly && !m.cfg.fly && !m.cfg.ranged) w *= 4; // 地面近战摸不到飞行
      if (m.cfg.fly && !t.cfg.fly) {
        if (!t.cfg.ranged) w *= 0.6; // 龙:优先收割无法还手的近战
        else w *= 1.3; // 龙:优先清除远程威胁
      }
      const d = ((t.pos.x-gp.x)*(t.pos.x-gp.x) + (t.pos.z-gp.z)*(t.pos.z-gp.z)) * w;
      if (d<bd) {
        bd=d; best=t;
      }
    }
    m.target = best;
  }
}

/* AI:逃离正在读条的敌方苦力怕(远程单位边退边射它) */
function fleeCreeper(m, dt, gp, fleeC) {
  const fa = Math.atan2(gp.x-fleeC.pos.x, gp.z-fleeC.pos.z);
  const fs = mobSpeed(m)*1.05;
  stepMove(m, Math.sin(fa)*fs*dt, 0);
  stepMove(m, 0, Math.cos(fa)*fs*dt);
  if (m.cfg.ranged && m.attackCd <= 0 &&
     Math.hypot(fleeC.pos.x-gp.x, fleeC.pos.z-gp.z) <= 9) {
    m.attackCd = m.cfg.cd; m.attackT = 0.35;
    rangedVolley(m, fleeC);
  }
  return fs;
}

/* 跃起砸地/扑袭: 抛物线飞行, 落地触发重击 */
function moveAir(m, dt, gp) {
  m.vy -= 24*dt;
  gp.y += m.vy*dt;
  stepMove(m, m.jumpVX*dt, 0);
  stepMove(m, 0, m.jumpVZ*dt);
  const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
  if (m.vy < 0 && gp.y <= gy) {
    gp.y = gy; m.air = false; m.vy = 0;
    if (m.slamming) golemSlam(m);
  }
  return 0;
}

/* 飞行单位: 空中狗斗(3D追击撕咬) / 对地盘旋(炮台远环·掠食者贴地近环), 出手按旗标 */
function moveFly(m, dt, gp, tg, dist) {
  const dx = tg.pos.x-gp.x; const dz = tg.pos.z-gp.z;
  if (tg.cfg.fly) {
    const d3 = Math.hypot(dx, dz, tg.pos.y-gp.y);
    const spd = mobSpeed(m);
    Mobs.shift(m, Math.sin(m.yaw)*spd*dt, Math.cos(m.yaw)*spd*dt);
    gp.y += Math.max(-6, Math.min(6, tg.pos.y-gp.y))*dt*1.2;
    if (d3 < 4.5 && m.attackCd <= 0) {
      m.attackCd = 1.6; m.attackT = 0.5;
      damageMob(tg, Math.round(12*m.dmgMult*(0.85+Math.random()*0.3)), dx, dz, 0.8, m);
      sfx('hit');
    }
  } else {
    m.orbitA += dt*0.8;
    const orbR = m.cfg.ranged ? 9 : 2.4; // 炮台远环 · 掠食者贴脸
    const px = tg.pos.x + Math.sin(m.orbitA)*orbR;
    const pz = tg.pos.z + Math.cos(m.orbitA)*orbR;
    const py = ARENA.floorY + (m.cfg.ranged ? ARENA.flyAlt : 2.2); // 掠食者低飞掠袭
    const mx = px-gp.x; const mz = pz-gp.z;
    const ml = Math.hypot(mx, mz);
    Mobs.steer(m, angleLerp(m.yaw, Math.atan2(mx, mz), dt*2.5));
    if (ml > 0.05) {
      const spd = mobSpeed(m);
      Mobs.shift(m, mx/ml*spd*dt, mz/ml*spd*dt);
    }
    gp.y += (py-gp.y)*Math.min(1, dt*1.5);
    if (m.attackCd <= 0 && dist < m.cfg.range) {
      if (m.type==='dragon') { // 末影龙:龙息毒云
        m.attackCd = (m.level>=2?3.5:4.5) + Math.random()*2; // 精英:龙息更频繁
        m.attackT = 0.6;
        spawnBreath(m, tg);
      } else if (m.cfg.ranged) { // 飞行炮台:爆裂火球
        m.attackCd = m.cfg.cd + Math.random()*1.2;
        m.attackT = 0.5;
        throwFireball(m, tg);
      } else { // 掠食者(幻翼/恼鬼):俯冲撕咬
        m.attackCd = m.cfg.cd;
        m.attackT = 0.4;
        damageMob(tg, Math.round(m.cfg.dmg*m.dmgMult*(0.85+Math.random()*0.3)),
            tg.pos.x-gp.x, tg.pos.z-gp.z, 0.6, m);
        sfx('hit');
      }
    }
  }
  clampToArena(m, FLY_ORBIT_R);
  return 0;
}

/* 自爆怪: 读条取消判断 + 扑袭跃进 + 吐舌平A */
function moveBoom(m, dt, gp, tg, dist, dx, dz) {
  let speed = 0;
  if (m.fuse >= 0 && m.fuse < 0.35 && dist > m.cfg.range*2.2 && !tg.cfg.fly) {
    m.fuse = -1; // AI:目标跑了及时取消读条,不浪费
    Mobs.scaleTo(m, m.tierScale);
  }
  if (dist < m.cfg.range) {
    if (m.fuse < 0) m.fuse = 0;
    // 平A: 吐舌头舔击(引爆读条期间也能舔)
    if (m.attackCd <= 0 && !tg.dead && Math.abs(tg.pos.y-gp.y) < 2.5) {
      m.attackCd = 1.0; m.attackT = 0.4;
      damageMob(tg, Math.round(6*m.dmgMult*(0.85+Math.random()*0.3)),
          tg.pos.x-gp.x, tg.pos.z-gp.z, 0.3, m);
      spawnTongue(m, tg);
      sfx('hit');
    }
  } else if (m.fuse < 0) {
    if (!m.air && m.pounceCd <= 0 && dist > 3 && dist < 11) {
      // 扑袭:向目标跃进扑脸再引爆
      m.pounceCd = 5.5 + Math.random()*3;
      m.air = true; m.vy = 7.2;
      const hl = Math.hypot(dx, dz) || 1;
      const hv = Math.min(10, dist*1.3);
      m.jumpVX = dx/hl*hv; m.jumpVZ = dz/hl*hv;
    } else {
      speed = mobSpeed(m);
    }
  }
  return speed;
}

/* 远程怪: 压上/拉开/横向走位 + 强力箭齐射; 守卫者系蓄力中定桩(个体特化·蓄力激光) */
function moveRanged(m, dt, tg, dist) {
  let speed = 0;
  if (m.laserT >= 0) return 0; // 守卫者系: 蓄力中站桩(放束在 tickLaserCharge)
  const shootDist = Math.min(m.cfg.range, 9); // 有效射程:超过就压上,避免远距离干瞪眼
  if (dist > shootDist) {
    speed = mobSpeed(m);
  } else if (dist < 4.5) {
    speed = -mobSpeed(m)*0.65;
  } else {
    m.strafeT -= dt; // 保持距离时横向走位
    if (m.strafeT <= 0) {
      m.strafeT = 1.2 + Math.random()*1.6;
      m.strafeDir = Math.random()<0.5 ? -1 : 1;
    }
    stepMove(m, Math.cos(m.yaw)*m.strafeDir*0.9*dt, 0);
    stepMove(m, 0, -Math.sin(m.yaw)*m.strafeDir*0.9*dt);
  }
  if (dist <= shootDist && m.attackCd <= 0 && m.laserT < 0) {
    if ((MOB_QUIRKS[m.type] || {}).laser) {
      m.laserT = 0; // 守卫者系: 蓄激光起手(个体特化, 替代箭矢)
    } else {
      m.attackCd = m.cfg.cd; m.attackT = 0.35;
      rangedVolley(m, tg);
    }
  }
  return speed;
}

/* 近战怪: 压上 + 铁傀儡技能(王者巨石投掷/跃起震地) + 挥击; 猪猪一家蛮冲期间直线冲刺 */
function moveMelee(m, dt, gp, tg, dist, dx, dz) {
  let speed = 0;
  if (m.chargeT > 0) { // 猪猪一家·蛮冲(家传): 方向锁定的直线冲刺
    Mobs.steer(m, m.chargeYaw);
    const cs = mobSpeed(m)*dt;
    stepMove(m, Math.sin(m.chargeYaw)*cs, 0);
    stepMove(m, 0, Math.cos(m.chargeYaw)*cs);
    for (const t of Mobs.near(gp.x, gp.z, m.cfg.hitR+1.1, gp.y, 2.5)) { // 撞到第一个敌人
      if (t === m || t.team === m.team || t.dead || t.gone) continue;
      m.chargeT = 0;
      damageMob(t, Math.round(m.cfg.dmg*1.5*m.dmgMult), t.pos.x-gp.x, t.pos.z-gp.z, 2.2, m);
      Mobs.stagger(t, 0.6);
      sfx('hit');
      break;
    }
    return 0;
  }
  if (dist > m.cfg.range*0.85) speed = mobSpeed(m);
  if (m.type==='golem' && m.level>=3 && m.rockCd<=0 && dist>4.5 && dist<14) {
    // 王者·巨石投掷
    m.rockCd = 4 + Math.random()*2;
    m.attackT = 0.6;
    throwRock(m, tg);
  }
  if (m.type==='golem' && m.slamCd <= 0 && dist > 2.2 && dist < 6.5) {
    // 跃起砸地
    m.slamCd = (m.level>=2?4.5:6) + Math.random()*(m.level>=2?3:4);
    m.slamming = true; m.air = true; m.vy = 8;
    const hl = Math.hypot(dx, dz) || 1;
    const hv = Math.min(10, hl/0.66);
    m.jumpVX = dx/hl*hv; m.jumpVZ = dz/hl*hv;
    m.attackT = 1.0;
    speed = 0;
  }
  if (!m.air && dist <= m.cfg.range && Math.abs(tg.pos.y-gp.y) < 3 && m.attackCd <= 0) {
    m.attackCd = m.cfg.cd * (m.raged ? 0.55 : 1); m.attackT = 0.45; // 狂暴攻速
    let dmg = m.cfg.dmg; let kpow = 0.45;
    if (m.mfam === 'skeleton_line') { // 凋灵骷髅·节奏重斩(骷髅一家家传的近战表达)
      m.meleeCnt++;
      if (m.meleeCnt % (m.level>=2?2:3) === 0) {
        dmg *= 1.6; kpow = 1.0;
      }
    }
    damageMob(tg, Math.round(dmg*m.dmgMult*(0.85+Math.random()*0.3)),
        tg.pos.x-gp.x, tg.pos.z-gp.z, kpow, m);
    sfx('hit');
  }
  return speed;
}

/* 引信读条: 膨胀 + 白闪 + 起爆(返回 true=已爆, 编排层跳过本怪后续) */
function updateFuse(m, dt, gp) {
  if (m.fuse < 0) return false;
  m.fuse += dt;
  const ft = m.level>=2 ? 0.9 : 1.1; // 精英:引信更短
  const p = Math.min(1, m.fuse/ft);
  Mobs.scaleTo(m, m.tierScale*(1+p*0.3)); // 引信膨胀(原 group.scale)
  const v = Math.sin(m.fuse*25) > 0 ? 1.9 : 1;
  Mobs.pulseTint(m, v, v, v); // 引信白闪(instanceColor 增亮)
  if (m.fuse >= ft) {
    Mobs.remove(m); // 自爆残躯立即移除(走引擎回收管线)
    explode(gp.x, gp.y+0.8, gp.z, m.team, m);
    if (m.level>=3) { // 王者·连环爆破(0.5秒后二段)
      pendingBooms.push({t: 0.5, x: gp.x, y: gp.y+0.8, z: gp.z, team: m.team, owner: m});
    }
    checkBattleEnd();
    return true;
  }
  return false;
}

/* 无目标游荡: 飞行绕场地中心巡航 / 地面随机换向(返回步态速度) */
function wanderTick(m, dt, gp) {
  if (m.fuse >= 0) {
    m.fuse = -1; Mobs.scaleTo(m, m.tierScale);
  }
  if (m.cfg.fly) {
    m.orbitA += dt*0.5;
    const px = ARENA.cx + Math.sin(m.orbitA)*14;
    const pz = ARENA.cz + Math.cos(m.orbitA)*14;
    const mx = px-gp.x; const mz = pz-gp.z; const ml = Math.hypot(mx, mz);
    Mobs.steer(m, angleLerp(m.yaw, Math.atan2(mx, mz), dt*2));
    if (ml > 0.05) {
      Mobs.shift(m, mx/ml*m.cfg.speed*0.7*dt, mz/ml*m.cfg.speed*0.7*dt);
    }
    gp.y += (ARENA.floorY+ARENA.flyAlt-gp.y)*Math.min(1, dt);
    return 0;
  }
  m.wanderT -= dt;
  if (m.wanderT <= 0) {
    m.wanderT = 2 + Math.random()*3;
    m.yaw += (Math.random()-0.5)*2;
  }
  const speed = 1.1;
  stepMove(m, Math.sin(m.yaw)*speed*dt, 0);
  stepMove(m, 0, Math.cos(m.yaw)*speed*dt);
  const ty = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
  gp.y += (ty-gp.y)*Math.min(1, dt*10);
  return speed;
}

/* 大规模兵团:空间网格加速挤开检测(代替 O(n²) 两两枚举);
   整数键 gx*512+gz 免每帧字符串拼接(世界 128×128 内无碰撞) */
function separateMobs(dt) {
  sepGrid.clear();
  const live = [];
  for (const m of mobs) {
    if (m.dead || m.gone) continue;
    live.push(m);
    const k = Math.floor(m.pos.x)*512 + Math.floor(m.pos.z);
    let arr = sepGrid.get(k);
    if (!arr) {
      arr = []; sepGrid.set(k, arr);
    }
    arr.push(m);
  }
  const minSep = 0.85;
  for (const a of live) {
    const gx = Math.floor(a.pos.x); const gz = Math.floor(a.pos.z);
    for (let ox=-1; ox<=1; ox++) {
      for (let oz=-1; oz<=1; oz++) {
        const arr = sepGrid.get((gx+ox)*512 + (gz+oz));
        if (!arr) continue;
        for (const b of arr) {
          if (b.id <= a.id) continue; // 每对只处理一次
          if (Math.abs(b.pos.y-a.pos.y) > 2.5) continue; // 空中/地面不互相挤开
          const dx = b.pos.x-a.pos.x; const dz = b.pos.z-a.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.001 && d < minSep) {
            const push = (minSep-d)*0.5;
            const ux = dx/d; const uz = dz/d;
            stepMove(a, -ux*push, 0); stepMove(a, 0, -uz*push);
            stepMove(b, ux*push, 0); stepMove(b, 0, uz*push);
          }
        }
      }
    }
  }
}

function updateMobs(dt) {
  updateTongues(dt);
  collectFusing();
  flushSplits(); // 家传亡语落场(软软族·分裂, 上一帧排队的)
  for (const m of mobs) {
    if (m.gone || m.dead) continue; // 名牌/计时/死亡动画/尸体回收归怪物库 Mobs.update
    const gp = m.pos;
    const prevX = gp.x; const prevZ = gp.z;

    tickTimers(m, dt);
    familyTick(m, gp, dt);
    retarget(m, gp, dt);

    let speed = 0;
    const tg = m.target;

    if (m.air) {
      speed = moveAir(m, dt, gp);
    } else if (m.staggerT <= 0 && tg) {
      const dx = tg.pos.x-gp.x; const dz = tg.pos.z-gp.z;
      const dist = Math.hypot(dx, dz);
      Mobs.steer(m, angleLerp(m.yaw, Math.atan2(dx, dz), dt*5));

      const fleeC = m.cfg.fly ? null : fusingCreeperNear(m);
      if (fleeC) {
        speed = fleeCreeper(m, dt, gp, fleeC);
      } else if (m.cfg.fly) {
        speed = moveFly(m, dt, gp, tg, dist);
      } else if (m.cfg.boom) {
        speed = moveBoom(m, dt, gp, tg, dist, dx, dz);
      } else if (m.cfg.ranged) {
        speed = moveRanged(m, dt, tg, dist);
      } else {
        speed = moveMelee(m, dt, gp, tg, dist, dx, dz);
      }

      if (updateFuse(m, dt, gp)) continue;

      if (speed !== 0) {
        // 侧向包抄角:远处直线逼近,近处按各自 flank 展开形成包围
        const ma = m.yaw + m.flank * Math.max(0, Math.min(1, (10-dist)/6));
        stepMove(m, Math.sin(ma)*speed*dt, 0);
        stepMove(m, 0, Math.cos(ma)*speed*dt);
      }
      if (!m.cfg.fly) Mobs.settle(m, dt); // 贴地收尾(与游荡本能同一条式)
    } else if (m.staggerT <= 0) {
      speed = wanderTick(m, dt, gp);
    }
    const speedNow = Math.abs(speed);

    /* 步态+战斗姿态归怪物库 gait(第 4 参=攻击姿态窗口 0.45s, 与下方专有公式的
       /0.45 同值): 通用挥臂(挥击手=持械手, 骨架表 weaponArm)/无臂头前扑已在
       引擎收口 — 卫道士/女巫/掠夺者等持械怪与下界同一条挥击公式;
       以下仅保留本模式专有公式(僵尸下劈/骷髅瞄准/龙·苦力怕头扑/傀儡双臂) */
    const sw = Mobs.gait(m, dt, speedNow, 0.45);
    const J = m.pose;
    if (m.type==='zombie') {
      J.armR = m.attackT>0 ?
        -1.45 - Math.sin((1-m.attackT/0.45)*Math.PI)*0.9 : -1.45;
    } else if (m.type==='skeleton') {
      J.armR = m.attackT>0 ? -1.3 : -sw*0.5;
    } else if (m.type==='dragon') {
      J.head = m.attackT>0 ? -0.55 : Math.sin(m.flyPhase*0.35)*0.1;
    } else if (m.type==='creeper') {
      J.head = m.attackT>0 ? -0.55 : 0; // 吐舌时头部前扑
    } else if (m.type==='golem') {
      J.armL = -sw*0.5;
      J.armR = m.attackT>0 ?
        -Math.sin((1-m.attackT/0.45)*Math.PI)*2.1 : sw*0.5;
    }
    if (m.air && m.type==='golem') {
      J.armL = -2.4; // 跃起时双臂高举
      J.armR = -2.4;
    }
    const idt = dt > 0 ? dt : 1e-4;
    m.vx = (gp.x - prevX)/idt;
    m.vz = (gp.z - prevZ)/idt;
  }

  separateMobs(dt);
  // 尸体回收与 gone 清理归怪物库 Mobs.update(每帧先于战斗逻辑执行)
}

function updateArrows(dt) {
  for (let i=arrows.length-1; i>=0; i--) {
    const a = arrows[i];
    /* 弹道步进收战斗核心(C6-T1): 状态载体仍是 mesh.position, shim 适配
       stepShot 的非变更式返回; 巨石口径保留 — 撞块触发 AoE, 寿命尽只移除 */
    const p0 = a.mesh.position;
    const r = CombatCore.stepShot({from: {x: p0.x, y: p0.y, z: p0.z},
      vel: a.vel, life: a.life, g: a.g !== undefined ? a.g : 9.5}, dt, getBlock);
    a.vel = r.vel;
    a.life = r.life;
    p0.set(r.x, r.y, r.z);
    a.mesh.lookAt(r.x + r.vel.x, r.y + r.vel.y, r.z + r.vel.z);
    let hit = r.hitBlock;
    if (!hit) {
      for (const t of mobs) {
        if (t.dead || t.gone || t.team===a.team) continue;
        if (CombatCore.hitBody(r, t)) {
          if (!a.aoe) damageMob(t, a.dmg, r.vel.x, r.vel.z, a.kpow||0.35, a.owner);
          sfx('hit');
          hit = true; break;
        }
      }
    }
    if (hit && a.aoe) rockBlast(a, r); // 巨石:命中/落地即AoE
    if (hit || r.life <= 0) {
      scene.remove(a.mesh);
      arrows.splice(i, 1);
    }
  }
}

/* ---------- 末影龙龙息 ---------- */
/* 龙息球: 几何/材质共享(动画只有位置与缩放, 无逐实例材质状态) */
const breathGeo = new THREE.SphereGeometry(0.45, 10, 8);
const breathMat = new THREE.MeshBasicMaterial({color: 0xb44bff, transparent: true, opacity: 0.9, depthWrite: false});
function spawnBreath(m, tg) {
  sfx('breath');
  const hx = m.pos.x + Math.sin(m.yaw)*3.3;
  const hz = m.pos.z + Math.cos(m.yaw)*3.3;
  const hy = m.pos.y + 1.9;
  const tx = tg.pos.x + (tg.vx||0)*0.5;
  const tz = tg.pos.z + (tg.vz||0)*0.5;
  const targets = [{x: tx, z: tz}];
  if (m.level>=3) { // 王者·三重龙息
    const a = Math.random()*Math.PI*2;
    targets.push({x: tx+Math.cos(a)*2.4, z: tz+Math.sin(a)*2.4},
        {x: tx-Math.cos(a)*2.4, z: tz-Math.sin(a)*2.4});
  }
  for (const tp of targets) {
    const mesh = new THREE.Mesh(breathGeo, breathMat);
    mesh.position.set(hx, hy, hz);
    scene.add(mesh);
    breathBalls.push({mesh, t: 0, dur: 0.6, team: m.team, owner: m,
      from: new THREE.Vector3(hx, hy, hz),
      to: new THREE.Vector3(tp.x, groundTop(Math.floor(tp.x), Math.floor(tp.z))+1.2, tp.z)});
  }
}

/* 毒云: 圆盘/云朵几何共享; 材质逐云一份(透明度随存活衰减, 六朵云 puff 共享同一份) */
const cloudDiscGeo = new THREE.CircleGeometry(3, 24);
const cloudPuffGeo = new THREE.SphereGeometry(0.35, 8, 6);
function spawnCloud(team, x, z, owner) {
  const gy = groundTop(Math.floor(x), Math.floor(z)) + 1;
  const disc = new THREE.Mesh(cloudDiscGeo,
      new THREE.MeshBasicMaterial({color: 0x9a3cd8, transparent: true, opacity: 0.35, depthWrite: false}));
  disc.rotation.x = -Math.PI/2;
  disc.position.set(x, gy+0.08, z);
  scene.add(disc);
  const puffMat = new THREE.MeshBasicMaterial({color: 0xc06bff, transparent: true, opacity: 0.7, depthWrite: false});
  const puffs = [];
  for (let i=0; i<6; i++) {
    const p = new THREE.Mesh(cloudPuffGeo, puffMat);
    p.userData.bx = x + (Math.random()-0.5)*4;
    p.userData.bz = z + (Math.random()-0.5)*4;
    p.userData.by = gy + 0.4 + Math.random()*1.2;
    p.userData.ph = Math.random()*Math.PI*2;
    scene.add(p);
    puffs.push(p);
  }
  clouds.push({team, x, z, r: 3, t: 0,
    dur: owner && owner.level>=2 ? 6 : 4.5, // 精英:毒云更持久
    tick: 0.3, dmg: Math.round(7*(owner?owner.dmgMult:1)), disc, puffs, puffMat, gy, owner});
}

function updateBreath(dt) {
  for (let i=breathBalls.length-1; i>=0; i--) {
    const b = breathBalls[i];
    b.t += dt;
    const p = Math.min(1, b.t/b.dur);
    b.mesh.position.lerpVectors(b.from, b.to, p);
    b.mesh.position.y += Math.sin(p*Math.PI)*2.5; // 抛物线
    const s = 1 + Math.sin(p*Math.PI*3)*0.25;
    b.mesh.scale.set(s, s, s);
    if (p >= 1) {
      spawnCloud(b.team, b.to.x, b.to.z, b.owner);
      scene.remove(b.mesh); // 几何/材质共享常驻
      breathBalls.splice(i, 1);
    }
  }
}

function updateClouds(dt) {
  for (let i=clouds.length-1; i>=0; i--) {
    const c = clouds[i];
    c.t += dt;
    const fade = 1 - c.t/c.dur;
    c.disc.material.opacity = 0.35*Math.max(0, fade);
    c.puffMat.opacity = 0.7*Math.max(0, fade); // 六朵 puff 共享一份材质, 设一次
    for (const p of c.puffs) {
      p.position.y = p.userData.by + Math.sin(c.t*2.2 + p.userData.ph)*0.35;
    }
    c.tick -= dt;
    if (c.tick <= 0) {
      c.tick = 0.5;
      for (const t of mobs) {
        if (t.dead || t.gone || t.team===c.team) continue;
        if (Math.abs(t.pos.y - c.gy) > 3) continue; // 只伤地面单位
        if (Math.hypot(t.pos.x-c.x, t.pos.z-c.z) < c.r + 0.3) {
          damageMob(t, c.dmg, t.pos.x-c.x, t.pos.z-c.z, 0.15, c.owner);
        }
      }
    }
    if (c.t >= c.dur) {
      scene.remove(c.disc); c.disc.material.dispose();
      c.puffs.forEach((p)=> scene.remove(p)); // 几何共享常驻
      c.puffMat.dispose();
      clouds.splice(i, 1);
    }
  }
}

/* ---------- 对战管理 ---------- */
const cfgA = {type: 'zombie', count: 8};
const cfgB = {type: 'skeleton', count: 8};
let autoBalance = true; // 开启后两队总战力自动一致
let lastEdited = 'A'; // 最后编辑的一侧，另一侧随之配平
const MAX_MOBS = 1000;

/* 单只战力: 混编按池内平均值(伪类型不落盘到共享表, 见文件头 MIX_AVG_POWER) */
function unitPower(cfg) {
  return cfg.type==='mix' ? MIX_AVG_POWER : ARENA_POWER[cfg.type];
}
function teamPower(cfg) {
  return cfg.count * unitPower(cfg);
}
function balanceTeams() {
  const from = lastEdited==='A' ? cfgA : cfgB;
  const to = lastEdited==='A' ? cfgB : cfgA;
  const n = Math.round(from.count * unitPower(from) / unitPower(to));
  to.count = Math.min(MAX_MOBS, Math.max(1, n));
}

/* ---------- 部署队列: 大兵团分帧生成 ----------
   千怪同步生成(建模+名牌画布+纹理上传)会冻结数秒; 改为队列分帧部署,
   每帧限时 ~6ms, 双方交替入场(后到的一方不抢跑)。已入场怪立即参战;
   胜负判定等队列清空才生效(防误判未到场一方全灭)。 */
const spawnQueue = [];
let spawnCursor = 0;
function queueTeam(team, cfg) {
  const ax = team==='A' ? ARENA.cx-19 : ARENA.cx+19;
  const az = ARENA.cz;
  const spread = Math.min(15, 1.2 + Math.sqrt(cfg.count)*0.6);
  const out = [];
  for (let i=0; i<cfg.count; i++) {
    const a = Math.random()*Math.PI*2; const rr = 0.6+Math.random()*spread;
    const x = ax + Math.cos(a)*rr; const z = az + Math.sin(a)*rr;
    const type = cfg.type==='mix' ? pickMix() : cfg.type;
    out.push({team, type, x, z});
  }
  return out;
}
function deploySpawnQueue() {
  if (spawnCursor >= spawnQueue.length) return;
  const t0 = performance.now();
  do {
    const s = spawnQueue[spawnCursor++];
    const m = spawnMob(s.team, s.type, s.x, s.z);
    const ec = s.team==='A' ? cfgB.count : cfgA.count; // 升级阈值随敌方规模缩放
    m.k2 = Math.max(1, Math.min(6, Math.ceil(ec*0.25)));
    m.k3 = Math.max(m.k2+1, Math.min(14, Math.ceil(ec*0.6)));
    teamInitHp[m.team] += m.maxHp;
  } while (spawnCursor < spawnQueue.length && performance.now() - t0 < 6);
  if (spawnCursor >= spawnQueue.length) {
    spawnQueue.length = 0; spawnCursor = 0;
  }
}

/* 清场序列(开战/清场/切模式三处共用): 舌头/怪物/箭矢/部署队列/连环爆破/光柱一把清
   — 以前三份拷贝, 未来加新特效数组漏改一处就泄漏资源 */
function resetBattleFx() {
  clearTongues();
  Mobs.clear(); // 回收怪物(含名牌/挂件)并冲刷批次
  for (const a of arrows) scene.remove(a.mesh);
  arrows.length = 0;
  spawnQueue.length = 0; spawnCursor = 0;
  pendingBooms.length = 0;
  pendingSplits.length = 0; // 分裂队列连带清(清场不留尾巴)
  for (const b of beams) {
    scene.remove(b.mesh); b.mesh.material.dispose();
  }
  beams.length = 0;
}

function startBattle() {
  resetBattleFx();
  const qa = queueTeam('A', cfgA); const qb = queueTeam('B', cfgB);
  let ia = 0; let ib = 0;
  while (ia < qa.length || ib < qb.length) { // 双方交替入队, 分帧入场不抢跑
    if (ia < qa.length) spawnQueue.push(qa[ia++]);
    if (ib < qb.length) spawnQueue.push(qb[ib++]);
  }
  teamInitHp = {A: 0, B: 0};
  battleState = 'fighting';
  battleResult = '';
  showToast('对战开始！红方 ' + cfgA.count + '×' + MOB_TYPES[cfgA.type].name + '（战力' + teamPower(cfgA) +
    '） VS 蓝方 ' + cfgB.count + '×' + MOB_TYPES[cfgB.type].name + '（战力' + teamPower(cfgB) + '）', 3200);
}

function clearBattle() {
  resetBattleFx();
  battleState = 'idle';
  battleResult = '';
  showToast('已清场', 1800);
}

/* ---------- 竞技场 UI ---------- */
const arenaHb = mkHotbar({/* 选块由 kit 接管(digit/wheel/点选); 'shovel' 哨兵槽渲染铁锹物品图标 */
  items: HOTBAR.map((id)=> (typeof id === 'number' ? {block: id} : {item: 'shovel_iron'})),
  onPick: () => arenaHeldSync()});
function arenaHeldIsBlock() {/* 手持感知判定(纯 seam): 选中数字方块槽才可放置, 'shovel' 槽 = 挖掘入口 */
  return typeof HOTBAR[arenaHb.sel] === 'number';
}
function arenaHeldItemId() {/* 选中槽的手持物 id(纯 seam): 方块槽 → 方块数字 id
  (HeldItems.defFor 直认), 铁锹哨兵槽 → shovel_iron(工具 def 现成) */
  const id = HOTBAR[arenaHb.sel];
  return typeof id === 'number' ? id : 'shovel_iron';
}
function arenaHeldSync() {/* 手持观感与选中槽一致 + 主动作键观感随手持 */
  Avatar.setItem(arenaHeldItemId());
  arenaTouchMainSync();
}
function arenaTouchMainSync() {/* 主动作键观感随手持: 方块=砖(放置)/铲=铲(连挖) */
  if (typeof refreshTouchMain === 'function') {
    refreshTouchMain(arenaHeldIsBlock() ? 'brick' : 'shovel', arenaHeldIsBlock() ? '放置' : '挖掘');
  }
}

const cntAEl = document.getElementById('cntA');
const cntBEl = document.getElementById('cntB');
const powAEl = document.getElementById('powA');
const powBEl = document.getElementById('powB');
const unitAEl = document.getElementById('unitA');
const unitBEl = document.getElementById('unitB');
const balBtn = document.getElementById('balBtn');
let panelBuilt = false;
/* 战力示例文案由 ARENA_POWER 派生(配平改数值, 菜单说明自动跟上 —
   这段数字曾第三次手抄在 index.html, 必然漂移) */
function fillPowerNote() {
  const el = document.getElementById('arenaPowerNote');
  if (!el) return;
  const byPower = {};
  for (const k of Object.keys(ARENA_POWER)) {
    const p = ARENA_POWER[k];
    (byPower[p] = byPower[p] || []).push(MOB_TYPES[k].name);
  }
  el.textContent = Object.keys(byPower).map(Number).sort((a, b)=>b-a)
      .slice(0, 5)
      .map((p) => byPower[p].join('/') + ' ' + p)
      .join(' · ') + ' …';
}

function buildPanel() {
  if (panelBuilt) {
    updatePanel(); return;
  }
  panelBuilt = true;
  fillPowerNote();
  document.querySelectorAll('.mob-btns').forEach((el)=>{
    const mkBtn = (parent, k, v)=>{
      const b = document.createElement('button');
      b.innerHTML = `<img src="${Mobs.face(k)}" alt="">${v.name}`;
      const fam = ((v.family)||[])[0];
      b.title = '战力 ' + unitPower({type: k}) + (v.boss ? ' · Boss' : '') +
        (fam ? ' · ' + (FAMILIES[fam] ? FAMILIES[fam].name : fam) : ' · 独行侠');
      b.dataset.type = k;
      b.addEventListener('click', ()=>{
        const cfg = el.dataset.team==='A' ? cfgA : cfgB;
        cfg.type = k;
        lastEdited = el.dataset.team;
        if (autoBalance) balanceTeams();
        updatePanel();
      });
      parent.appendChild(b);
    };
    mkBtn(el, 'mix', MOB_TYPES.mix); // 混合编队: 功能位排最前(不归族)
    for (const g of Mobs.families()) { // 谱系分组: 内联簇(组头+组员成簇, 簇随行流动 — 不整行断组)
      const grp = document.createElement('div');
      grp.className = 'fam-group';
      const head = document.createElement('span');
      head.className = 'fam-head';
      head.textContent = g.name;
      grp.appendChild(head);
      for (const k of g.members) mkBtn(grp, k, MOB_TYPES[k]);
      el.appendChild(grp);
    }
  });
  document.querySelectorAll('.count-row:not(.pw) button').forEach((b)=>{
    b.addEventListener('click', ()=>{
      const cfg = b.dataset.cnt==='A' ? cfgA : cfgB;
      lastEdited = b.dataset.cnt;
      cfg.count = Math.min(MAX_MOBS, Math.max(1, cfg.count + parseInt(b.dataset.d)));
      if (autoBalance) balanceTeams();
      updatePanel();
    });
  });
  document.getElementById('fightBtn').onclick = ()=>{
    startBattle(); requestLock();
  };
  document.getElementById('resumeBtn').onclick = requestLock;
  document.getElementById('clearBtn').onclick = clearBattle;
  balBtn.onclick = ()=>{
    autoBalance = !autoBalance;
    if (autoBalance) balanceTeams();
    updatePanel();
  };
}
function updatePanel() {
  document.querySelectorAll('.mob-btns').forEach((el)=>{
    const cfg = el.dataset.team==='A' ? cfgA : cfgB;
    [...el.children].forEach((b)=> b.classList.toggle('active', b.dataset.type===cfg.type));
  });
  cntAEl.textContent = cfgA.count;
  cntBEl.textContent = cfgB.count;
  unitAEl.textContent = unitPower(cfgA);
  unitBEl.textContent = unitPower(cfgB);
  const pA = teamPower(cfgA); const pB = teamPower(cfgB);
  powAEl.textContent = pA;
  powBEl.textContent = pB;
  const warn = Math.abs(pA-pB) / Math.max(pA, pB) > 0.1; // 超过上限无法配平时红字提示
  powAEl.className = warn ? 'warn' : 'ok';
  powBEl.className = warn ? 'warn' : 'ok';
  balBtn.textContent = '战力配平：' + (autoBalance ? '开' : '关');
}

const scoreAEl = document.getElementById('scoreA');
const scoreBEl = document.getElementById('scoreB');
const scoreMidEl = document.getElementById('scoreMid');
function updateScoreboard() {
  let a=0; let b=0; let pa=0; let pb=0;
  for (const m of mobs) {
    if (!m.dead && !m.gone) {
      if (m.team==='A') {
        a++; pa+=unitPower(m.cfg);
      } else {
        b++; pb+=unitPower(m.cfg);
      }
    }
  }
  scoreAEl.textContent = '红方 ' + a + ' · ' + pa;
  scoreBEl.textContent = '蓝方 ' + b + ' · ' + pb;
  scoreMidEl.textContent = battleState==='fighting' ? '战斗中' :
    (battleState==='over' ? battleResult : '备战中');
}

/* ---------- 模式对象 ---------- */
const ArenaMode = mkMode({
  id: 'arena',
  chrome: {score: 'flex', hotbar: 'flex'},
  hotbar: arenaHb,
  touch: [ /* ⛏️ 智能主动作键(手持感知, 用户拍板 2026-10-24): 选中方块→放置一次
     (不连发 — 儿童向刻意偏离, MC 按住实为连放, 见 docs/mc-held-item-action-
     research.md Q3), 铲子槽→挖起步+按住连挖; 画布轻点仍是放置 */
    {icon: 'shovel', label: '挖/放', holdAct: mkMainAct(arenaHeldIsBlock)},
  ],
  init() {
    loadScene(generate); // 场景装填 seam: 建 + 收尾重建一步到位
    spawnPlayer();
    buildPanel();
    if (autoBalance) balanceTeams();
    updatePanel();
    arenaHb.select(1); /* 默认选中第 2 格方块: 第 1 格铁锹是显式挖掘入口, 拿方块进场即放置态 */
    arenaHeldSync(); /* 手持观感对齐选中槽(select 同格不触发 onPick, 显式兜底) */
  },
  cleanup() {
    resetBattleFx();
    battleState = 'idle';
    battleResult = '';
    Avatar.setItem(PLAYER.heldItem); /* 手持物复位(Avatar 跨模式存活, 照下界先例) */
  },
  update(dt) {
    deploySpawnQueue(); // 分帧部署先于一切战斗逻辑
    Mobs.update(dt); // 怪物本能: 名牌/计时/死亡动画/回收
    updateMobs(dt); // 战斗 AI(索敌/技能/晋升)
    Mobs.render(); // 存活怪位姿写入实例批次(合批绘制)
    updateArrows(dt);
    updateBreath(dt);
    updateClouds(dt);
    updatePendingBooms(dt);
    updateBeams(dt);
  },
  onKey(code) {
    if (code==='KeyR') startBattle();
  },
  onMouse(button, hit) {
    if (!hit) return;
    if (button === 0) {
      editBlock(hit.x, hit.y, hit.z, 0);
    } else if (button === 2) {
      if (typeof HOTBAR[arenaHb.sel] !== 'number') return; // 铲子槽不放置(手持感知: 拿铲子=挖)
      const px=hit.x+hit.nx; const py=hit.y+hit.ny; const pz=hit.z+hit.nz;
      if (getBlock(px, py, pz)!==0) return;
      if (collidesAtPlayer(px, py, pz)) return;
      editBlock(px, py, pz, HOTBAR[arenaHb.sel]);
    }
  },
  hud(hit) {
    updateScoreboard();
    return [
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      `FPS: ${fps}`,
      `手持: ${typeof HOTBAR[arenaHb.sel] === 'number' ? BLOCKS[HOTBAR[arenaHb.sel]].name : '铁锹'}`,
      `注视: ${ModeKit.lookName(hit)}`,
      `R 重新开战 · B 面板`,
    ];
  },
});
