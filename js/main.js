"use strict";
/* ============================================================
   主入口:模式注册 / 菜单页面 / 主循环
============================================================ */

const MODES = {
  arena: ArenaMode,
  tnt:   TntMode,
  focus: FocusMode,
  build: BuildMode,
  tank:  TankRangeMode
};
MODES.cur = null;
let curModeId = null;

/* ---------- 菜单页面切换 ---------- */
const overlay = document.getElementById('overlay');
const pages = {
  main:  document.getElementById('menuMain'),
  arena: document.getElementById('menuArena'),
  tnt:   document.getElementById('menuTnt'),
  build: document.getElementById('menuBuild'),
  tank:  document.getElementById('menuTank'),
  win:   document.getElementById('menuWin'),
  playTime: document.getElementById('menuPlayTime')
};
let curPage = 'main';
function showPage(id){
  curPage = id;
  for(const k in pages) pages[k].classList.toggle('active', k===id);
  if(id === 'main') refreshPlayCards();
}

/* ---------- 每日预算 (DailyBudget) — 儿童时限的唯一账本 ----------
    竞技场+TNT+建造 的儿童时限与 专注训练营的每日限额 都记在
    js/daily-budget.js 的同一本预算里; 计时/午夜翻转/按日限额/迁移全部在那边 */
const PLAY_LIMIT_MODES = ['arena', 'tnt', 'build', 'tank'];   // 共享儿童时限的模式
let Budgets = null;                                   // SyncDB.ready 后填充(镜像完成, 防"第二台设备读到旧本地值")
let playSaveT = 0;

function setupBudgets(){
  Budgets = mkDailyBudgets({
    storage: { get:k=>SyncDB.get(k), set:(k,v)=>SyncDB.set(k,v), remove:k=>SyncDB.remove(k) },
    defs: {
      play:  { capMsFor: d => (TEMP_PLAY_LIMIT_MIN[d] || PLAY_LIMIT_DEFAULT_MIN) * 60 * 1000,   // 读时求值: 跨午夜自动重读当日临时限额
               warnAtMs: 60*1000 },
      focus: { capMsFor: () => FOCUS_DAILY_MIN * 60 * 1000, capCount: FOCUS_DAILY_LEVELS }
    }
  });
  Budgets.migrate();                                  // 旧 play_time_save / focus_camp_save.daily → daily_budget_save
  Budgets.play.onWarn(()=> showToast('⏰ 还剩 1 分钟哦'));
  Budgets.play.onExhausted(playTimeUp);               // 每天至多触发一次(语音也只说一次)
  updateLimitText();                                  // 规则文案始终由限额生成(单一来源)
  refreshPlayCards();
}
function playBlocked(){ return !!(Budgets && Budgets.play.blocked()); }
function updateLimitText(){
  if(!Budgets) return;
  const m = Math.round(Budgets.play.capMs()/60000);
  const t = document.getElementById('playTimeRule');
  if(t) t.textContent = '竞技场 + TNT 密室 + 建造 + 坦克演习场每天共 ' + m + ' 分钟 · 专注训练营不受影响（每天 ' + FOCUS_DAILY_LEVELS + ' 关 / ' + FOCUS_DAILY_MIN + ' 分钟）';
  const b = document.getElementById('buildTimeRule');
  if(b) b.textContent = '你的建造会自动保存，换设备也能继续！和竞技场、TNT 共享每天 ' + m + ' 分钟游玩时间';
}
function refreshPlayCards(){
  const blocked = playBlocked();
  ['cardArena','cardTnt','cardBuild','cardTank'].forEach(id=>{
    const c = document.getElementById(id);
    if(!c) return;
    c.classList.toggle('timedout', blocked);
    let b = c.querySelector('.timeoutBadge');
    if(blocked && !b){ b = document.createElement('div'); b.className='timeoutBadge'; b.textContent='🌙 今天玩完啦'; c.appendChild(b); }
    if(!blocked && b) b.remove();
  });
}
function showPlayTimeoutPage(){
  overlay.style.display = 'flex';
  showPage('playTime');
}
function playTimeUp(){
  if(Budgets) Budgets.play.flush();
  SpeechKit.speak('今天的游玩时间到啦，怪物们要休息了，明天再来挑战吧！');
  if(document.pointerLockElement) document.exitPointerLock();   // 事件异步, onLockChanged 尊重 playTime 页
  else { touchPlaying = false; overlay.style.display = 'flex'; }
  showPlayTimeoutPage();
}

/* ---------- 模式切换 ---------- */
function switchMode(id){
  if(Budgets && PLAY_LIMIT_MODES.indexOf(curModeId) >= 0) Budgets.play.flush();   // 离开计费模式先落账
  if(MODES.cur && MODES.cur.cleanup) MODES.cur.cleanup();
  Fx.clear();                                // 特效清场收口在 Fx, 不再亲手 dispose 私有数组
  clearWorld();
  curModeId = MODES[id].id || id;
  MODES.cur = MODES[id];
  MODES.cur.init();
}

/* ---------- 指针锁 / 遮罩 ---------- */
function onLockChanged(l){
  overlay.style.display = l ? 'none' : 'flex';
  if(!l){
    if(curPage === 'win' || curPage === 'playTime') return;   // 通关/时限页由各自逻辑控制
    if(MODES.cur && MODES.cur.onMenu) MODES.cur.onMenu();     // 定义了菜单钩子的模式自行接管
    else showPage(curModeId || 'main');
  }
}

/* ---------- 坦克模式卡入口图标 ----------
   16×16 手绘 → 64×64 dataURL(与怪物头像 Mobs.face 同法):
   emoji 🚙 各平台渲染不可控(有的像救护车), 换成与游戏内同配色的像素坦克 */
function tankIcon(){
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x,y,w,h,col)=>{ g.fillStyle = col; g.fillRect(x,y,w,h); };
  const GREEN='#5a6b4a', GREEN2='#6d7f58', DARK='#333a2e', TRACK='#22261e', WHEEL='#454d3e', METAL='#8a9184';
  px(0,4,7,2,DARK);                                    // 炮管(朝左)
  px(0,3,2,4,METAL);                                   // 炮口制退器
  px(6,2,5,1,GREEN2);                                  // 炮塔顶
  px(5,3,7,4,GREEN);                                   // 炮塔
  px(3,7,12,3,GREEN);                                  // 车体
  px(3,7,2,1,GREEN2);                                  // 斜甲高光
  px(2,10,13,4,TRACK);                                 // 履带
  for(const x of [3,5,7,9,11,13]) px(x,11,1,2,WHEEL);  // 负重轮
  const big = document.createElement('canvas');
  big.width = big.height = 64;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 64, 64);
  return big.toDataURL();
}
(function(){                                           // 入口卡换标
  const big = document.querySelector('#cardTank .big');
  if(big) big.innerHTML = '<img alt="坦克演习场" src="' + tankIcon() + '">';
})();

/* ---------- 主菜单与按钮 ---------- */
function buildMenu(){
  document.getElementById('cardArena').onclick = ()=>{
    if(playBlocked()){ showPlayTimeoutPage(); return; }
    if(curModeId !== 'arena') switchMode('arena');
    showPage('arena');
  };
  document.getElementById('cardTnt').onclick = ()=>{
    if(playBlocked()){ showPlayTimeoutPage(); return; }
    if(curModeId !== 'tnt') switchMode('tnt');
    showPage('tnt');
    if(MODES.cur.buildMenu) MODES.cur.buildMenu();
  };
  document.getElementById('cardFocus').onclick = ()=>{
    if(curModeId !== 'focus') switchMode('focus');   // 专注训练营接管全屏 UI
  };
  document.getElementById('cardBuild').onclick = ()=>{
    if(playBlocked()){ showPlayTimeoutPage(); return; }
    if(curModeId !== 'build') switchMode('build');
    showPage('build');
    if(MODES.cur.buildMenu) MODES.cur.buildMenu();
  };
  document.getElementById('cardTank').onclick = ()=>{    // 坦克演习场: 先挑型号再进场(五款酷炫坦克)
    if(playBlocked()){ showPlayTimeoutPage(); return; }
    if(curModeId !== 'tank') switchMode('tank');
    showPage('tank');
    if(MODES.cur.buildMenu) MODES.cur.buildMenu();
  };
  document.getElementById('arenaBackBtn').onclick = ()=> showPage('main');
  document.getElementById('tntBackBtn').onclick   = ()=> showPage('main');
  document.getElementById('buildBackBtn').onclick = ()=> showPage('main');
  document.getElementById('tankBackBtn').onclick  = ()=> showPage('main');
  document.getElementById('playTimeHomeBtn').onclick = ()=> showPage('main');
}

/* ---------- 主循环 ---------- */
let last=performance.now(), fps=0, fpsAcc=0, fpsCnt=0;
/* 帧率上限 60: ProMotion(pad Pro 等 120Hz)设备 rAF 翻倍 → JS/渲染成本全翻,
   GPU 撑不住时帧率在 60~120 抖动, 锁 60 帧 pacing 反而稳; 60Hz 屏不受影响
   (阈值 16.4ms < 16.7ms 常规帧全部放行) */
const FRAME_MIN = 16.4;
/* 触屏自适应分辨率: 持续低帧(连续 6 个半秒采样 <45fps, 即 3 秒)降一档
   DPR(1.5 → 1.25 → 1), 只降不升防来回抖 — 填充率受限的老 pad 兜底,
   瞬时爆炸掉帧不会误触发 */
let dprCap = 0, lowFpsStreak = 0;
function adaptDpr(){
  if(!_coarse) return;
  if(!dprCap) dprCap = renderer.getPixelRatio();
  if(dprCap <= 1.01) return;
  if(fps > 0 && fps < 45){
    if(++lowFpsStreak >= 6){
      lowFpsStreak = 0;
      dprCap = Math.max(1, dprCap - 0.25);
      renderer.setPixelRatio(dprCap);
    }
  } else lowFpsStreak = 0;
}
function loop(now){
  requestAnimationFrame(loop);
  if(NET_DEAD) return;                             // 心跳失联: 冻结一切
  if(now - last < FRAME_MIN) return;               // 未满一帧预算: 等下个 rAF
  let dt = (now-last)/1000; last=now;
  if(dt>0.05) dt=0.05;

  if(locked || touchPlaying){
    if(!Tank.driving()) physics(dt);
    Tank.update(dt);                     // 载具: 驾驶步进 · 在飞炮弹 · 履带动画, 每帧推进
    if(worldEvents.voidFall){                       // 引擎事件 → 分发给当前模式的 onVoidFall
      worldEvents.voidFall = false;
      if(MODES.cur && MODES.cur.onVoidFall) MODES.cur.onVoidFall();
    }
    if(MODES.cur && MODES.cur.update) MODES.cur.update(dt);
    Fx.update(dt);
    /* 儿童时限: 游玩模式实际游玩时累计入每日预算 */
    if(Budgets && PLAY_LIMIT_MODES.indexOf(curModeId) >= 0){
      Budgets.play.accrue(dt*1000);
      if(now - playSaveT > 5000){ playSaveT = now; Budgets.play.flush(); }
    }
  }
  pumpRemesh(2);         // 编辑管线收尾: 每帧最多重建 2 个区块(暂停时也要追平)

  const camDist = CameraRig.apply(camera, dt);   // 相机装置: 视角模式/轨道/防穿墙
  Avatar.update(dt, camDist);                    // 玩家形象同步+动画(近距自动隐藏)
  Fx.wobble(dt, camera);   // 震屏消费(衰减+抖动)收在 Fx, 须在相机位姿设定之后

  const aim = CameraRig.aim();                   // 瞄准射线统一从眼睛出发(不因第三人称瞄到身后)
  const hit = raycastVoxel(aim.origin, aim.dir, 6);
  let hlShow = !!hit;
  if(hit && MODES.cur && MODES.cur.onHighlight){
    if(MODES.cur.onHighlight(hit) === false) hlShow = false;
  }
  highlight.visible = hlShow;
  if(hlShow) highlight.position.set(hit.x+0.5, hit.y+0.5, hit.z+0.5);

  const tNow = now/1000;
  for(const s of sunSprites){
    const k = 1 + Math.sin(tNow*1.5 + s.userData.phase)*0.08;
    s.scale.set(s.userData.base*k, s.userData.base*k, 1);
  }

  renderer.render(scene, camera);

  fpsAcc+=dt; fpsCnt++;
  if(fpsAcc>=0.5){ fps=Math.round(fpsCnt/fpsAcc); fpsAcc=0; fpsCnt=0; adaptDpr(); }
  if(MODES.cur && MODES.cur.updateHud) MODES.cur.updateHud(hit);   // hit 复用本帧唯一一次 raycast
}

/* ---------- 启动 ---------- */
let NET_DEAD = false;                              // 心跳失联 → 冻结游戏
function netDead(){
  if(NET_DEAD) return;
  NET_DEAD = true;
  SpeechKit.cancel();
  const d = document.createElement('div');
  d.id = 'netDead';
  d.innerHTML = '<div><h1>📡 与服务器的连接已断开</h1>' +
    '<p>训练师与方块世界的通道关闭了。</p>' +
    '<p class="tip">请确认电脑上的服务已启动（node server.js），<br>然后刷新本页面继续游玩。</p></div>';
  document.body.appendChild(d);
}
(function startHeartbeat(){
  if(typeof location === 'undefined' || location.protocol.indexOf('http') !== 0) return;  // file:// 不检测
  let fails = 0;
  setInterval(()=>{
    if(NET_DEAD) return;
    const ctl = new AbortController();
    const to = setTimeout(()=>ctl.abort(), 5000);
    fetch('/ping', {cache:'no-store', signal:ctl.signal})
      .then(()=>{ clearTimeout(to); fails = 0; })
      .catch(()=>{ clearTimeout(to); if(++fails >= 5) netDead(); });   // 5×10s ≈ 50s < 60s
  }, 10000);
})();

function init(){
  const sp = document.getElementById('splash');
  if(sp) sp.remove();
  buildMenu();
  Avatar.setItem(PLAYER.heldItem);   // 组合根装配默认手持物(参数表驱动, 见 config.js)
  SyncDB.ready.then(setupBudgets);      // 服务器镜像完成后再建账本/迁移(进度零丢失的时序保证)
  switchMode('arena');       // 默认后台加载竞技场作为主菜单背景
  showPage('main');
  addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  requestAnimationFrame(loop);
}
init();
