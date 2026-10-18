"use strict";
/* ============================================================
   坦克演习场 (TankRangeMode, 术语见 GLOSSARY.md) — 应用层
   ------------------------------------------------------------
   载具能力的第一个投放场: 96×96 多地形场(丘陵·峡谷·乱石阵·瞭望台)
   + 五类可破坏靶(靶排·环靶·靶墙·靶屋红心·远距靶塔)。
   怪物走共享怪物库(js/mobs.js, 竞技场同款五怪): 选怪面板
   (#menuTank)选种类和数量 → 一次性部署, 无波次; 清场后按 R
   再来一批或 Esc 回面板换怪。伤害走 config.js TANK_VS_MOBS 表。
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
const VS = TANK_VS_MOBS;                  // 坦克打怪伤害表(config.js)

let speakArmed = 10;                      // 邀请语音计时: 初始即"到点"(首靠近就说)
let hitCount = 0;                         // 已命中炮数(爆炸炸到靶才算)
let killCount = 0;                        // 已消灭怪物数(跨批累计, 过程性表扬)
let deployed = false, clearPraised = false;

/* 选怪配置: 菜单页 #menuTank 面板读写(竞技场同款交互, 单边训练配置) */
const mobCfg = { type: 'zombie', count: 6 };
const RANGE_MOBS_MAX = 30;
let rgPanelBuilt = false;                 // 避撞: arena.js 顶层也有 panelBuilt(经典 script 共享词法环境)
const typeBtns = [];
let cntEl = null;

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

/* 爆炸回调(引擎在命中点回调, 带爆点坐标): 炸到靶表扬 + 波及怪物 —
   直击(近爆心)满伤, 边缘按距离线性衰减 */
function onBoom(x, y, z, res){
  const hits = (res.counts && res.counts[TANK_RANGE.targetId]) || 0;
  if(hits > 0){
    hitCount++;
    SpeechKit.speak('打中啦！好厉害！');
    showToast('🎯 命中 ' + hitCount);
  }
  for(const m of Mobs.near(x, z, VS.blastR, y, VS.blastDy)){
    const d = Math.hypot(m.pos.x - x, m.pos.z - z);
    const dmg = d < 1.2 ? VS.direct
      : Math.round(VS.splash - (VS.splash - VS.edge) * Math.min(1, d / VS.blastR));
    const r = Mobs.hit(m, dmg, m.pos.x - x, m.pos.z - z, 0.8);
    if(r.freshDead) onKill(m);
  }
}

/* 击杀反馈: 碎块 + 计数(死亡音效怪物库已播, 话术是模式政策) */
const MOB_DEBRIS = { zombie:0x5e9440, skeleton:0xd8d8d2, creeper:0x4fae4f, golem:0xcdd0d8, dragon:0x3a2055 };
function onKill(m){
  killCount++;
  Fx.debrisBurst(m.pos.x, m.pos.y + 0.8, m.pos.z, 6, { color: MOB_DEBRIS[m.type] || 0x8a8f98, life: 0.6 });
  showToast('👾 消灭 ' + killCount);
  checkCleared();
}

function aliveCount(){ return Mobs.list().filter(m => !m.dead && !m.gone).length; }

/* 清场播报: 一批全灭 → 表扬一次(不罚失误, R 再来) */
function checkCleared(){
  if(deployed && !clearPraised && aliveCount() === 0){
    clearPraised = true;
    SpeechKit.speak('全部消灭！你好棒！按 R 再来一批吧！');
    showToast('🎉 全部消灭！R 再来 · Esc 换怪物');
  }
}

/* ---------- 部署: 面板配置一次性撒进场(围栏内, 避开坦克与头顶障碍) ---------- */
function deployMobs(){
  Mobs.clear();                            // 先清当前批(击杀计数跨批累计, 不清零)
  deployed = true;
  clearPraised = false;
  const tk = TANK_RANGE.tank;
  let placed = 0, salt = 7;
  while(placed < mobCfg.count && salt < 4000){
    const x = 24 + Math.floor(SceneKit.rand(salt, 11, 1)*80);
    const z = 24 + Math.floor(SceneKit.rand(salt, 13, 2)*80);
    salt += 7;
    if(Math.hypot(x - tk.x, z - tk.z) < 12) continue;          /* 别刷在坦克脸上 */
    if(isSolid(getBlock(x, groundTop(x, z) + 1, z))) continue; /* 头顶要有净空 */
    Mobs.spawn(mobCfg.type, x + 0.5, z + 0.5, {
      label: { prefix: '', color: '#ffd44d' },                 /* 名牌: 名字+血条, 无阵营前缀 */
      wander: { x0: 18, x1: 110, z0: 18, z1: 110 },            /* 游荡栅栏(怪物库本能, 可关) */
      flyY: TANK_RANGE.groundY + 10                            /* 飞行怪(末影龙)巡航高度 */
    });
    placed++;
  }
  const nm = (Mobs.types[mobCfg.type] || {}).name || '';
  SpeechKit.speak(mobCfg.count + '只' + nm + '来啦！开炮！');
  showToast('👾 ' + nm + ' × ' + mobCfg.count);
}

/* ---------- 选怪面板(菜单页 #menuTank): 竞技场同款交互, 单边训练配置 ---------- */
function buildTankPanel(){
  if(rgPanelBuilt){ updateTankPanel(); return; }
  rgPanelBuilt = true;
  const btns = document.getElementById('tankMobBtns');
  for(const k of ['zombie','skeleton','creeper','golem','dragon']){
    const b = document.createElement('button');
    b.innerHTML = `<img src="${Mobs.face(k)}" alt="">${Mobs.types[k].name}`;
    b.dataset.type = k;
    b.addEventListener('click', ()=>{ mobCfg.type = k; updateTankPanel(); });
    btns.appendChild(b);
    typeBtns.push(b);
  }
  cntEl = document.getElementById('tankCnt');
  for(const [id, d] of [['tankCntM5',-5], ['tankCntM1',-1], ['tankCntP1',1], ['tankCntP5',5]]){
    document.getElementById(id).addEventListener('click', ()=>{
      mobCfg.count = Math.min(RANGE_MOBS_MAX, Math.max(1, mobCfg.count + d));
      updateTankPanel();
    });
  }
  document.getElementById('tankGoBtn').onclick = ()=>{ deployMobs(); requestLock(); };
}
function updateTankPanel(){
  if(!rgPanelBuilt) return;
  typeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === mobCfg.type));
  if(cntEl) cntEl.textContent = mobCfg.count;
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
    Tank.onExplode(onBoom);              /* 命中反馈: 炸靶表扬 + 波及怪物 */
    Tank.protect(keepGround);            /* 爆炸保护: 平坦草海永固(丘陵/峡谷/乱石仍可炸) */
    buildTankPanel();                    /* 选怪面板(菜单页, 只绑一次) */
    speakArmed = 10;                     // 重进模式即可再次邀请
    hitCount = 0; killCount = 0;
    deployed = false; clearPraised = false;
    deployMobs();                        // 第一批: 默认僵尸×6, 点卡直进即有得玩
  },

  cleanup(){
    Tank.clear();
    Mobs.clear();                        // 共享怪物: 回收名牌/挂件并冲刷批次
  },

  onKey(code){
    if(code === 'KeyE') speakForToggle(Tank.toggle());
    else if(code === 'KeyR') deployMobs();   // 清场/想换批: 按当前配置再来一批
  },

  onMouse(button){                       /* 左键开炮(准星方向 = 车头目标 + 视角俯仰) */
    if(button === 0) fireOnce();
  },

  /* 靠近邀请: 未驾驶 + 近旁有车 + 距上次满 10 秒 → 语音一次;
     怪物本能(游荡/受击/死亡/名牌)在 Mobs.update, 碾压与清场播报在此 */
  update(dt){
    speakArmed += dt;
    if(!Tank.driving() && Tank.nearby() !== null && speakArmed >= 10){
      speakArmed = 0;
      SpeechKit.speak('要开坦克吗？按 E！');
    }
    Mobs.update(dt);
    /* 坦克碾压: 驾驶中贴身即压(脆怪一发, 硬怪要补炮——孩子的最爱) */
    const tp = Tank.driving() ? Tank.at() : null;
    if(tp){
      for(const m of Mobs.near(tp.x, tp.z, 1.8, tp.y, 2.5)){
        const r = Mobs.hit(m, VS.crush, m.pos.x - tp.x, m.pos.z - tp.z, 0.5);
        if(r.freshDead) onKill(m);
      }
    }
    Mobs.render();
    checkCleared();
  },

  hud(){
    if(Tank.driving()){
      const n = aliveCount();
      const lines = ['🚙 驾驶中 · 左键/💥 开炮 · E 下车'];
      if(n > 0) lines.push('👾 剩 ' + n + ' 只 · 冲上去压！');
      else if(deployed) lines.push('🎉 全消灭！R 再来 · Esc 换怪物');
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
    { label: '👾', act(){ deployMobs(); } },        // 平板再来一批(与 R 同入口)
  ],

  onMenu(){                               // Esc/暂停保底: 下车 + 打开选怪面板(回面板再选再来)
    Tank.exitAll();
    showPage('tank');
    updateTankPanel();
  },
  onHighlight(){ return false; }          // 本模式不挖不放, 隐藏方块高亮
});

if(typeof module !== 'undefined' && module.exports) module.exports = TankRangeMode;
