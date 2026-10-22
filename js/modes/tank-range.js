"use strict";
/* ============================================================
   坦克演习场 (TankRangeMode, 术语见 GLOSSARY.md) — 应用层
   ------------------------------------------------------------
   载具能力的第一个投放场: 96×96 多地形场(丘陵·峡谷·乱石阵·瞭望台)
   + 五类可破坏靶(靶排·环靶·靶墙·靶屋红心·远距靶塔)。
   进场先在出发配置页选好坦克与怪物(主菜单坦克卡 → #menuTank: 坦克一行 +
   怪物一行): 六款坦克样子/颜色/炮弹/性能各异, 卡片按 order 排序; 点"出发"
   才重建演习场(没变直回战场保进度), Esc 随时回来换; 张廷彧号自带四联追踪
   导弹(索敌政策 nearestFoe 经 Tank.targeter 注入引擎)。怪物走共享怪物库
   (js/mobs.js, 竞技场同款五怪): 出发配置页与游戏内浮动面板(#mobPicker,
   👾 按钮/M 键)共用同一份 mobCfg, 一次性部署无波次, 清场后按 R 再来一批。
   炮弹被怪物身体阻挡即引爆(真直击)。伤害走 config.js TANK_VS_MOBS 表
   (各型号同伤, 对孩子公平)。
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
/* 坦克打怪伤害直查 config 的 TANK_VS_MOBS(直击/波及/碾压) */

let selModel = 'classic';                 // 当前坦克型号(TANK_MODELS 键; 出发配置页点卡切换)
let placedModel = null, placedMob = null; // 场上实际部署的型号/怪种(出发时比对, 变了才重建)

let speakArmed = 10;                      // 邀请语音计时: 初始即"到点"(首靠近就说)
let praiseT = 0;                          // 命中表扬节流计时(pad 实测: iOS TTS 频繁
                                          // cancel+speak 是连环炮掉帧源之一, 3 秒最多一句)
let hitCount = 0;                         // 已命中炮数(爆炸炸到靶才算)
let killCount = 0;                        // 已消灭怪物数(跨批累计, 过程性表扬)
let deployed = false, clearPraised = false;

/* ---------- 选怪: 游戏内浮动面板(👾 按钮 / M 键开关) ----------
   训练场是单边选靶, 不做竞技场那种"赛前双方配置页";
   面板选种类和数量 → 一次性部署; R 随时按当前配置再来一批
   种类清单动态遍历 MOB_TYPES(排除 mix 伪类型): 以后加怪自动出现 */
const RANGE_MOB_KEYS = Object.keys(Mobs.types).filter(k => k !== 'mix');
const mobCfg = { type: 'zombie', count: 6 };
const RANGE_MOBS_MAX = 30;
let pickerBuilt = false, pickerOpen = false;
const pkTypeBtns = [];
let pkCntEl = null, pkEl = null;

function buildPicker(){
  if(pickerBuilt){ updatePicker(); return; }
  pickerBuilt = true;
  pkEl = document.getElementById('mobPicker');
  const btns = document.getElementById('pkMobBtns');
  btns.innerHTML = '';                               // 幂等: 先清空(类名撞车的历史教训, 双保险)
  for(const k of RANGE_MOB_KEYS){
    const b = document.createElement('button');
    b.innerHTML = `<img src="${Mobs.face(k)}" alt="">${Mobs.types[k].name}`;
    b.dataset.type = k;
    b.onclick = ()=>{ mobCfg.type = k; updatePicker(); };
    btns.appendChild(b);
    pkTypeBtns.push(b);
  }
  pkCntEl = document.getElementById('pkCnt');
  document.getElementById('pkCntM').onclick = ()=>{ mobCfg.count = Math.max(1, mobCfg.count - 1); updatePicker(); };
  document.getElementById('pkCntP').onclick = ()=>{ mobCfg.count = Math.min(RANGE_MOBS_MAX, mobCfg.count + 1); updatePicker(); };
  document.getElementById('pkGo').onclick = ()=> deployMobs();     // 部署即关面板
  document.getElementById('pkClose').onclick = ()=> togglePicker(false);
  updatePicker();
}
function updatePicker(){
  if(!pickerBuilt) return;
  pkTypeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === mobCfg.type));
  if(pkCntEl) pkCntEl.textContent = mobCfg.count;
}
function togglePicker(open){
  pickerOpen = (open !== undefined) ? open : !pickerOpen;
  if(pkEl) pkEl.classList.toggle('open', pickerOpen);
  if(pickerOpen) updatePicker();
}

function speakForToggle(r){
  const def = Tank.model(selModel);
  if(r === 'entered'){ SpeechKit.speak('开坦克喽！你开的是' + def.name + '！'); showToast('🚙 ' + def.name + ' 出动！W 前进 · S 倒车 · A D 转向 · 左键开炮 · E 下车'); }
  else if(r === 'exited'){ SpeechKit.speak('下车喽，再见！'); showToast('🚙 下车'); }
  else if(r === 'far'){ showToast('🚙 先走近坦克一点'); }
}

/* ---------- 出发配置页: 坦克一行(按 order 排序) + 怪物一行 ----------
   主菜单坦克卡 → 本页(buildMenu 刷新高亮); 卡片只改选择, 重建演习场
   收在"出发"(launchField) — 浏览几款再出发只重建一次, 没变则直回战场保进度 */
function buildTankMenu(){
  const grid = document.getElementById('tankPick');
  if(grid){
    grid.innerHTML = '';                                // 幂等: 每次重绘(高亮随 selModel 走)
    const keys = Object.keys(TANK_MODELS)
      .sort((a, b) => (TANK_MODELS[a].order || 99) - (TANK_MODELS[b].order || 99));
    for(const key of keys){
      const def = TANK_MODELS[key];
      const div = document.createElement('div');
      div.className = 'sceneCard';
      div.classList.toggle('active', key === selModel);   // 高亮当前型号(与选怪面板同法)
      div.dataset.model = key;
      div.innerHTML = '<div class="big"><img alt="' + def.name + '" src="' + Tank.icon(key) + '"></div>'
        + '<h2>' + def.name + '</h2><small>' + def.desc + '</small>';
      div.onclick = ()=>{ selectTank(key); };
      grid.appendChild(div);
    }
  }
  /* 怪物行: 与游戏内 👾 面板同一份 mobCfg(选的种类即出发部署的第一批) */
  const mrow = document.getElementById('tankMobPick');
  if(mrow){
    mrow.innerHTML = '';
    for(const k of RANGE_MOB_KEYS){
      const b = document.createElement('div');
      b.className = 'sceneCard';
      b.classList.toggle('active', k === mobCfg.type);
      b.dataset.mob = k;
      b.innerHTML = '<div class="big"><img alt="" src="' + Mobs.face(k) + '"></div>'
        + '<h2>' + Mobs.types[k].name + '</h2>';
      b.onclick = ()=>{ mobCfg.type = k; buildTankMenu(); };
      mrow.appendChild(b);
    }
  }
  const go = document.getElementById('tankGoBtn');
  if(go) go.onclick = ()=> launchField();
}

/* 选车页点卡: 只改选择并刷新高亮(换车重建收在"出发") */
function selectTank(key){
  if(!TANK_MODELS[key] || key === selModel) return;
  selModel = key;
  buildTankMenu();
  showToast('🚙 ' + TANK_MODELS[key].name + ' 就绪！');
}

/* 出发: 型号或怪种变了才重建演习场(没变直接回战场, 进度不丢) */
function launchField(){
  if(selModel !== placedModel || mobCfg.type !== placedMob) enterField();
  requestLock();
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
    if(praiseT <= 0){                       // 表扬 3 秒节流(计数照常累计, 语音不刷屏)
      praiseT = 3;
      SpeechKit.speak('打中啦！好厉害！');
    }
    showToast('🎯 命中 ' + hitCount);
  }
  for(const m of Mobs.near(x, z, TANK_VS_MOBS.blastR, y, TANK_VS_MOBS.blastDy)){
    const d = Math.hypot(m.pos.x - x, m.pos.z - z);
    const dmg = d < 1.2 ? TANK_VS_MOBS.direct
      : Math.round(TANK_VS_MOBS.splash - (TANK_VS_MOBS.splash - TANK_VS_MOBS.edge) * Math.min(1, d / TANK_VS_MOBS.blastR));
    const r = Mobs.hit(m, dmg, m.pos.x - x, m.pos.z - z, 0.8);
    if(r.freshDead) onKill(m);
  }
}

/* 炮弹障碍: 怪物身体挡炮弹, 碰上即停在接触点引爆(真·直击)。
   注册进 Tank.obstacle(物理缝), "什么挡炮弹"的判定归模式层 */
function mobSolid(x, y, z){
  for(const m of Mobs.list()){
    if(m.dead || m.gone) continue;
    if(Math.hypot(m.pos.x - x, m.pos.z - z) > m.cfg.hitR + 0.35) continue;
    if(y < m.pos.y - 0.3 || y > m.pos.y + m.cfg.h) continue;
    return true;
  }
  return false;
}

/* 导弹索敌: 64 格内最近活怪的身体中心(张廷彧号追踪导弹用)。
   与 mobSolid 同族的 seam: 注册进 Tank.targeter, "谁是敌人"归模式层,
   引擎只拿坐标做转向(飞行怪按 3D 距离一起算, 低飞的龙也追得到) */
function nearestFoe(x, y, z){
  let best = null, bestD = 64;
  for(const m of Mobs.list()){
    if(m.dead || m.gone) continue;
    const cy = m.pos.y + (m.cfg.h || 1.9)*0.5;
    const d = Math.hypot(m.pos.x - x, cy - y, m.pos.z - z);
    if(d < bestD){ bestD = d; best = m; }
  }
  if(!best) return null;
  return { x: best.pos.x, y: best.pos.y + (best.cfg.h || 1.9)*0.5, z: best.pos.z };
}

/* 击杀反馈: 碎块 + 计数(死亡音效怪物库已播, 话术是模式政策) —
   逐怪碎块色收在怪物库(Mobs.debrisColor, 与竞技场共用), 缺省灰 */
function onKill(m){
  killCount++;
  Fx.debrisBurst(m.pos.x, m.pos.y + 0.8, m.pos.z, 6, { color: Mobs.debrisColor(m.type), life: 0.6 });
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
  togglePicker(false);
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
      flyY: TANK_RANGE.groundY + 6                            /* 飞行怪(末影龙)巡航高度: 低飞才够得着(平地炮波及) */
    });
    placed++;
  }
  /* 报实际部署数: 场地极端拥挤时 while 可能提前放弃, 说 8 只实际 5 只
     对 6 岁用户是"听到的和看到的不一样" */
  const nm = (Mobs.types[mobCfg.type] || {}).name || '';
  SpeechKit.speak(placed + '只' + nm + '来啦！开炮！');
  showToast('👾 ' + nm + ' × ' + placed);
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

/* 模式钩子一次注册(Tank.clear 只清实体不解除钩子): 命中反馈/爆炸保护/
   炮弹障碍/导弹索敌 — "什么该炸/谁挡炮弹/谁是敌"归模式层, 引擎只回调 */
Tank.onExplode(onBoom);
Tank.protect(keepGround);
Tank.obstacle(mobSolid);
Tank.targeter(nearestFoe);

/* 进场/换车同一条路: 清场 → 建场 → 放当前型号的坦克 → 出生。
   switchMode 进来时 world 已清, 这里的 clearWorld 再兜一次"换车型重建"(幂等) */
function enterField(){
  Tank.clear();
  clearWorld();
  buildRange();
  rebuildAll();                         // 建场收尾: 方块数据 → 区块网格(各模式惯例, 漏了整场不可见)
  Tank.place(TANK_RANGE.tank.x, TANK_RANGE.groundY+1, TANK_RANGE.tank.z,
    { yaw: TANK_RANGE.tank.yaw, model: selModel });
  ModeKit.spawn(TANK_RANGE.spawn.x, TANK_RANGE.groundY+1, TANK_RANGE.spawn.z, { yaw: TANK_RANGE.spawn.yaw });
  buildPicker();                       /* 游戏内选怪面板(只绑一次) */
  buildTankMenu();                     /* 出发配置页刷新(高亮随 selModel/mobCfg) */
  placedModel = selModel;              /* 记住场上部署, 出发时没变就不重建(保进度) */
  placedMob = mobCfg.type;
  speakArmed = 10;                     // 重进模式即可再次邀请
  praiseT = 0;
  hitCount = 0; killCount = 0;
  deployed = false; clearPraised = false;
  deployMobs();                        // 第一批: 默认僵尸×6, 挑完坦克进场即有得玩
}

const TankRangeMode = mkMode({
  id: 'tank',

  init(){ enterField(); },

  buildMenu(){ buildTankMenu(); },       // Esc/主菜单进选坦克页时刷新高亮(与建造模式同钩子)

  cleanup(){
    Tank.clear();
    Mobs.clear();                        // 共享怪物: 回收名牌/挂件并冲刷批次
  },

  onKey(code){
    if(code === 'KeyE') speakForToggle(Tank.toggle());
    else if(code === 'KeyR') deployMobs();   // 清场/想换批: 按当前配置再来一批
    else if(code === 'KeyM') togglePicker(); // 换怪物面板(游戏内, 与触屏 👾 同入口)
  },

  onMouse(button){                       /* 左键开炮(准星方向 = 车头目标 + 视角俯仰) */
    if(button === 0) fireOnce();
  },

  /* 靠近邀请: 未驾驶 + 近旁有车 + 距上次满 10 秒 → 语音一次;
     怪物本能(游荡/受击/死亡/名牌)在 Mobs.update, 碾压与清场播报在此 */
  update(dt){
    speakArmed += dt;
    praiseT = Math.max(0, praiseT - dt);
    if(!Tank.driving() && Tank.nearby() !== null && speakArmed >= 10){
      speakArmed = 0;
      const def = Tank.model(selModel);
      SpeechKit.speak('要开坦克吗？' + def.name + '在等你哦！按 E！');
    }
    Mobs.update(dt);
    /* 坦克碾压: 驾驶中贴身即压(脆怪一发, 硬怪要补炮——孩子的最爱) */
    const tp = Tank.driving() ? Tank.at() : null;
    if(tp){
      for(const m of Mobs.near(tp.x, tp.z, 1.8, tp.y, 2.5)){
        const r = Mobs.hit(m, TANK_VS_MOBS.crush, m.pos.x - tp.x, m.pos.z - tp.z, 0.5);
        if(r.freshDead) onKill(m);
      }
    }
    Mobs.render();
    checkCleared();
  },

  hud(){
    let lines;
    const def = Tank.model(selModel);
    if(Tank.driving()){
      const n = aliveCount();
      lines = ['🚙 ' + def.name + ' · 左键/💥 开炮 · E 下车'];
      if(n > 0) lines.push('👾 剩 ' + n + ' 只 · 冲上去压！');
      else if(deployed) lines.push('🎉 全消灭！R 再来 · M 换怪物');
      if(killCount > 0) lines.push('☠️ 已消灭 ' + killCount);
      if(hitCount > 0) lines.push('🎯 已命中 ' + hitCount);
      lines.push('Esc 换坦克');
    }
    else if(Tank.nearby() !== null) lines = ['🚙 按 E 开坦克 · ' + def.name + ' · M 换怪物'];
    else return [];
    lines.push('FPS ' + fps);           // 与竞技场/建造同款帧率显示(pad 排查刚需)
    return lines;
  },

  touch: [
    { label: '🚙', act(){ speakForToggle(Tank.toggle()); } },
    { label: '💥', act: fireOnce },
    { label: '👾', act(){ togglePicker(); } },        // 换怪物面板(部署在面板里, 与 M 键同入口)
  ],

  onMenu(){ Tank.exitAll(); },           // Esc/暂停保底: 人在车里也要安全落地
  onHighlight(){ return false; }          // 本模式不挖不放, 隐藏方块高亮
});

if(typeof module !== 'undefined' && module.exports) module.exports = TankRangeMode;
