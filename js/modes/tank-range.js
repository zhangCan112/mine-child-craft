"use strict";
/* ============================================================
   坦克演习场 (TankRangeMode, 术语见 GLOSSARY.md) — 应用层
   ------------------------------------------------------------
   载具能力的第一个投放场: 96×96 多地形场(丘陵·峡谷·乱石阵·瞭望台)
   + 五类可破坏靶(靶排·环靶·靶墙·靶屋红心·远距靶塔)。
   政策全在此层(引擎不知道"提示"与"语音"):
   · E 键与触屏 🚙 按钮同走 Tank.toggle(单一入口)
   · 靠近邀请语音 10 秒节流; 上下车话术随 toggle 结果
   · Esc/菜单保底下车; 不挖不放, 隐藏方块高亮
   场景每次进入重建(switchMode 已 clearWorld), 天然"退出还原"。
   ============================================================ */
const TANK_RANGE = {
  x0: 16, z0: 16, x1: 112, z1: 112,      // 围栏内场地 96×96(世界 128×128 居中)
  groundY: 12,                            // 草地顶层(y=12, 站立面 y=13)
  tank:  { x: 56, z: 94, yaw: 0 },        // 坦克初始位(南区, 朝 -Z 正对全场)
  spawn: { x: 59.5, z: 98, yaw: 0 },      // 玩家出生在坦克侧后方, 抬眼即见坦克
  targetId: 16                            // 靶方块 id(红羊毛): 建靶与命中判定, 演习场专属玩法
};

let speakArmed = 10;                      // 邀请语音计时: 初始即"到点"(首靠近就说)
let hitCount = 0;                         // 已命中炮数(爆炸炸到靶才算)

function speakForToggle(r){
  if(r === 'entered'){ SpeechKit.speak('开坦克喽！'); showToast('🚙 上车！W 前进 · S 倒车 · A D 转向 · 左键开炮 · E 下车'); }
  else if(r === 'exited'){ SpeechKit.speak('下车喽，再见！'); showToast('🚙 下车'); }
  else if(r === 'far'){ showToast('🚙 先走近坦克一点'); }
}

/* 开炮单一入口: 桌面左键与触屏 💥 按钮共用, 装填中给提示 */
function fireOnce(){
  if(!Tank.driving()) return;
  const r = Tank.fire();
  if(r === 'cooldown') showToast('⏳ 装填中…');
}

/* 爆炸保护: 只护平坦草海(全图 y≤groundY 的草/泥基层) —
   丘陵草帽在 y≥13、峡谷石壁/乱石/围栏都不是草海, 照炸 */
function keepGround(id, bx, by){
  return by <= TANK_RANGE.groundY && (id === 1 || id === 2);
}

/* 爆炸回调(引擎在命中点回调, 带爆点坐标): 炸到靶才表扬 — 过程性表扬, 不罚脱靶 */
function onBoom(x, y, z, res){
  const hits = (res.counts && res.counts[TANK_RANGE.targetId]) || 0;
  if(hits > 0){
    hitCount++;
    SpeechKit.speak('打中啦！好厉害！');
    showToast('🎯 命中 ' + hitCount);
  }
  for(let i=mobs.length-1; i>=0; i--){            /* 爆炸波及怪物 */
    const m = mobs[i];
    if(Math.hypot(m.x - x, m.z - z) < TANK.shellR + 0.9 && Math.abs(m.y + 1 - y) < 4) killMob(i);
  }
}

/* ---------- 游荡怪波: 僵尸风小车怪, 可炸可碾, 清完 3 秒刷新一波 ---------- */
const mobs = [];
let killCount = 0, waveN = 0, waveT = 0;

function mkMob(x, z){
  const box = (w, h, d, c)=> new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({color: c}));
  const grp = new THREE.Group();
  const legL = box(0.20, 0.50, 0.22, 0x2e7d32); legL.position.set(-0.12, 0.25, 0);
  const legR = box(0.20, 0.50, 0.22, 0x2e7d32); legR.position.set( 0.12, 0.25, 0);
  const body = box(0.52, 0.62, 0.30, 0x43a047); body.position.y = 0.81;
  const armL = box(0.15, 0.15, 0.48, 0x388e3c); armL.position.set(-0.33, 1.00, -0.24);  /* 僵尸前伸手 */
  const armR = box(0.15, 0.15, 0.48, 0x388e3c); armR.position.set( 0.33, 1.00, -0.24);
  const head = box(0.44, 0.44, 0.44, 0x66bb6a); head.position.y = 1.35;
  const eL = box(0.08, 0.09, 0.03, 0x1b1b1b); eL.position.set(-0.10, 1.38, -0.225);
  const eR = box(0.08, 0.09, 0.03, 0x1b1b1b); eR.position.set( 0.10, 1.38, -0.225);
  grp.add(legL, legR, body, armL, armR, head, eL, eR);
  scene.add(grp);
  const dispose = ()=> grp.traverse(o=>{ if(o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
  return { grp, x, z, y: groundTop(Math.floor(x), Math.floor(z)) + 1,
           dir: SceneKit.rand(Math.floor(x), Math.floor(z), 5)*Math.PI*2, t: 0, hop: 0, dispose };
}

function spawnWave(){
  if(typeof THREE === 'undefined') return;         /* Node 单测无渲染, 只跳过视觉 */
  const n = 6 + waveN;                             /* 一波比一波多一只 */
  const tk = TANK_RANGE.tank;
  let placed = 0, salt = waveN*97 + 1;
  while(placed < n && salt < 4000){
    const x = 24 + Math.floor(SceneKit.rand(salt, 11, 1)*80);
    const z = 24 + Math.floor(SceneKit.rand(salt, 13, 2)*80);
    salt += 7;
    if(Math.hypot(x - tk.x, z - tk.z) < 12) continue;          /* 别刷在坦克脸上 */
    if(isSolid(getBlock(x, groundTop(x, z) + 1, z))) continue; /* 头顶要有净空 */
    mobs.push(mkMob(x + 0.5, z + 0.5));
    placed++;
  }
  waveN++;
}

function killMob(i){
  const m = mobs[i];
  sfx('death');
  Fx.debrisBurst(m.x, m.y + 0.8, m.z, 6, { color: 0x43a047, life: 0.6 });
  scene.remove(m.grp); m.dispose();
  mobs.splice(i, 1);
  killCount++;
  showToast('👾 消灭 ' + killCount);
  if(mobs.length === 0) waveT = 3;                 /* 清场 → 3 秒后新一波 */
}

function updateMobs(dt){
  for(let i=mobs.length-1; i>=0; i--){
    const m = mobs[i];
    m.t -= dt;
    if(m.t <= 0){                                  /* 换个方向溜达 */
      m.dir = SceneKit.rand(Math.floor(m.x)*13 + i, Math.floor(m.z)*7, 3)*Math.PI*2;
      m.t = 1 + SceneKit.rand(Math.floor(m.x), i, 4)*2;
    }
    const nx = m.x + Math.cos(m.dir)*1.1*dt, nz = m.z + Math.sin(m.dir)*1.1*dt;
    if(nx < 18 || nx > 110 || nz < 18 || nz > 110 ||
       isSolid(getBlock(Math.floor(nx), Math.floor(m.y + 1), Math.floor(nz)))){
      m.t = 0;                                     /* 撞墙/到边 → 原地换向 */
      continue;
    }
    m.x = nx; m.z = nz;
    m.y = groundTop(Math.floor(m.x), Math.floor(m.z)) + 1;     /* 爬坡下坎自然贴地 */
    m.hop += dt*9;
    m.grp.position.set(m.x, m.y + Math.abs(Math.sin(m.hop))*0.06, m.z);
    m.grp.rotation.y = -m.dir - Math.PI/2;         /* 模型面朝 -Z, 转到行进方向 */
  }
  /* 坦克碾压: 驾驶中贴身即压扁(孩子的最爱) */
  const tp = Tank.driving() ? Tank.at() : null;
  if(tp){
    for(let i=mobs.length-1; i>=0; i--){
      const m = mobs[i];
      if(Math.hypot(m.x - tp.x, m.z - tp.z) < 1.8 && Math.abs(m.y - tp.y) < 2.5) killMob(i);
    }
  }
  /* 波次刷新 */
  if(waveT > 0){
    waveT -= dt;
    if(waveT <= 0){
      spawnWave();
      SpeechKit.speak('新一波怪物来啦！冲呀！');
    }
  }
}

/* ---------- 建场: 全图草海为底, 围栏内布设多地形与多类靶 ----------
   布局(俯视, x→东 z→南): 西北丘陵 · 西侧峡谷 | 中部环靶 · 中东乱石阵 |
   东侧爬坡+瞭望台 | 南区靶屋/靶排(近) → 中距靶墙 → 北端远距靶塔 */
function buildRange(){
  const R = TANK_RANGE, G = R.groundY, T = R.targetId;

  /* 草海打底(全图铺到边界, 围栏外也有地平线, 不见虚空) */
  SceneKit.fill(0, G-2, 0, 127, G-1, 127, 2);
  SceneKit.fill(0, G,   0, 127, G,   127, 1);

  /* 石围栏(高 3): 演习场一圈, 坦克宽 1.9 格不设窄口 */
  SceneKit.fill(R.x0-1, G+1, R.z0-1, R.x1+1, G+3, R.z0-1, 3);
  SceneKit.fill(R.x0-1, G+1, R.z1+1, R.x1+1, G+3, R.z1+1, 3);
  SceneKit.fill(R.x0-1, G+1, R.z0,   R.x0-1, G+3, R.z1,   3);
  SceneKit.fill(R.x1+1, G+1, R.z0,   R.x1+1, G+3, R.z1,   3);

  /* 西北丘陵 ×2(双层草帽, 可炸出弹坑) */
  SceneKit.fill(20, G+1, 18, 32, G+2, 30, 2);
  SceneKit.fill(20, G+3, 18, 32, G+3, 30, 1);
  SceneKit.fill(34, G+1, 20, 46, G+3, 34, 2);
  SceneKit.fill(34, G+4, 20, 46, G+4, 34, 1);

  /* 西侧南北峡谷: 双石壁(高 4)夹 6 宽通道, 穿行与掩体射击 */
  SceneKit.fill(24, G+1, 44, 24, G+4, 104, 3);
  SceneKit.fill(31, G+1, 44, 31, G+4, 104, 3);

  /* 中东乱石阵: 石/圆石确定性散布(掩体, 可被炸毁) */
  for(let i=0; i<26; i++){
    const x = 88 + Math.floor(SceneKit.rand(i, 7, 1)*18);
    const z = 44 + Math.floor(SceneKit.rand(i, 9, 2)*24);
    SceneKit.fill(x, G+1, z, x, G+1 + (i % 2), z, (i % 3 === 0) ? 3 : 4);
  }

  /* 东侧履带爬坡(六级台阶) → 瞭望台(全场制高点, 顶上旗杆蓝旗) */
  for(let i=0; i<6; i++)
    SceneKit.fill(96-i, G+1, 88, 96-i, G+1+i, 100, 3);
  SceneKit.fill(78, G+1, 88, 90, G+6, 100, 3);
  SceneKit.fill(84, G+7, 94, 84, G+11, 94, 5);       /* 旗杆(木头) */
  SceneKit.fill(85, G+10, 93, 86, G+11, 93, 15);     /* 蓝旗 */

  /* 近距靶排 ×7(双柱, 新手直线练习) */
  for(let x=44; x<=68; x+=4)
    SceneKit.fill(x, G+1, 80, x, G+2, 80, T);

  /* 环心散靶 ×8(绕中心两格一圈, 练绕场机动射击) */
  for(let i=0; i<8; i++){
    const a = i/8*Math.PI*2;
    const x = Math.round(64 + Math.cos(a)*10), z = Math.round(64 + Math.sin(a)*10);
    SceneKit.fill(x, G+1, z, x, G+1, z, T);
  }

  /* 中距靶墙 ×3(5 宽 3 高) */
  for(const wx of [36, 60, 84])
    SceneKit.fill(wx, G+1, 58, wx+4, G+3, 58, T);

  /* 靶屋 ×2(木壳红心: 炸开外壳露出靶心) */
  for(const hx of [36, 90]){
    const hz = (hx === 36) ? 86 : 74;
    SceneKit.fill(hx, G+1, hz, hx+6, G+3, hz+4, 6);      /* 木壳 */
    SceneKit.fill(hx+2, G+1, hz+1, hx+4, G+2, hz+3, T);  /* 红心 */
  }

  /* 远距靶塔 ×2(3×3 底 · 8 高, 远程射击的显眼目标) */
  for(const tx of [33, 87])
    SceneKit.fill(tx, G+1, 28, tx+2, G+8, 30, T);
}

const TankRangeMode = mkMode({
  id: 'tank',

  init(){
    buildRange();
    rebuildAll();                         // 建场收尾: 方块数据 → 区块网格(各模式惯例, 漏了整场不可见)
    Tank.place(TANK_RANGE.tank.x, TANK_RANGE.groundY+1, TANK_RANGE.tank.z, { yaw: TANK_RANGE.tank.yaw });
    spawn(TANK_RANGE.spawn.x, TANK_RANGE.groundY+1, TANK_RANGE.spawn.z, { yaw: TANK_RANGE.spawn.yaw });
    Tank.onExplode(onBoom);              /* 命中反馈: 炸到靶才表扬 */
    Tank.protect(keepGround);            /* 爆炸保护: 平坦草海永固(丘陵/峡谷/乱石仍可炸) */
    speakArmed = 10;                     // 重进模式即可再次邀请
    hitCount = 0;
    killCount = 0; waveN = 0; waveT = 0;
    spawnWave();                         // 第一波怪物
  },

  cleanup(){
    Tank.clear();
    for(const m of mobs){ scene.remove(m.grp); m.dispose(); }
    mobs.length = 0;
  },

  onKey(code){
    if(code === 'KeyE') speakForToggle(Tank.toggle());
  },

  onMouse(button){                       /* 左键开炮(准星方向 = 车头目标 + 视角俯仰) */
    if(button === 0) fireOnce();
  },

  /* 靠近邀请: 未驾驶 + 近旁有车 + 距上次满 10 秒 → 语音一次; 怪物游荡/碾压/波次同帧推进 */
  update(dt){
    speakArmed += dt;
    if(!Tank.driving() && Tank.nearby() !== null && speakArmed >= 10){
      speakArmed = 0;
      SpeechKit.speak('要开坦克吗？按 E！');
    }
    updateMobs(dt);
  },

  hud(){
    if(Tank.driving()){
      const lines = ['🚙 驾驶中 · 左键/💥 开炮 · E 下车'];
      if(mobs.length > 0) lines.push('👾 怪物 ' + mobs.length + ' · 冲上去压！');
      if(killCount > 0) lines.push('☠️ 已消灭 ' + killCount);
      if(hitCount > 0) lines.push('🎯 已命中 ' + hitCount);
      return lines;
    }
    if(Tank.nearby() !== null) return ['🚙 按 E 开坦克 · 平板点 🚙 按钮'];
    return [];
  },

  touch: [
    { label: '🚙', act(){ speakForToggle(Tank.toggle()); } },
    { label: '💥', act: fireOnce },
  ],

  onMenu(){ Tank.exitAll(); },            // Esc/暂停保底: 人在车里也要安全落地
  onHighlight(){ return false; }          // 本模式不挖不放, 隐藏方块高亮
});

if(typeof module !== 'undefined' && module.exports) module.exports = TankRangeMode;
