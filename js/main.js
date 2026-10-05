"use strict";
/* ============================================================
   主入口:模式注册 / 菜单页面 / 主循环
============================================================ */

const MODES = {
  arena: ArenaMode,
  tnt:   TntMode,
  focus: FocusMode,
  build: BuildMode
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
  win:   document.getElementById('menuWin'),
  playTime: document.getElementById('menuPlayTime')
};
let curPage = 'main';
function showPage(id){
  curPage = id;
  for(const k in pages) pages[k].classList.toggle('active', k===id);
  if(id === 'main') refreshPlayCards();
}

/* ---------- 儿童游玩时限: 竞技场+TNT 每天共 10 分钟 ----------
   只在实际游玩(锁定/触屏进行)时计时; 跨设备随 SyncDB 同步; 专注训练营不受影响 */
const PLAY_LIMIT_MS = 10*60*1000;
const PLAY_SAVE_KEY = 'play_time_save';
let playMs = (function(){
  try{
    const s = JSON.parse(SyncDB.get(PLAY_SAVE_KEY));
    if(s && s.date === todayStr()) return s.ms || 0;
  }catch(e){}
  return 0;
})();
let playSaveT = 0, playWarned = false, playDoneShown = false;
function playBlocked(){ return playMs >= PLAY_LIMIT_MS; }
function savePlayTime(){
  SyncDB.set(PLAY_SAVE_KEY, JSON.stringify({date: todayStr(), ms: Math.round(playMs)}));
}
const PLAY_LIMIT_MODES = ['arena', 'tnt', 'build'];   // 共享时限的模式
function refreshPlayCards(){
  const blocked = playBlocked();
  ['cardArena','cardTnt','cardBuild'].forEach(id=>{
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
  savePlayTime();
  if(!playDoneShown){
    playDoneShown = true;
    focusSpeak('今天的游玩时间到啦，怪物们要休息了，明天再来挑战吧！');
  }
  if(document.pointerLockElement) document.exitPointerLock();   // 事件异步, onLockChanged 尊重 playTime 页
  else { touchPlaying = false; overlay.style.display = 'flex'; }
  showPlayTimeoutPage();
}

/* ---------- 模式切换 ---------- */
function switchMode(id){
  if(PLAY_LIMIT_MODES.indexOf(curModeId) >= 0) savePlayTime();   // 离开计费模式先存
  if(MODES.cur && MODES.cur.cleanup) MODES.cur.cleanup();
  for(const e of effects){ scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); }
  effects.length = 0;
  for(const d of debris) scene.remove(d.mesh);
  debris.length = 0;
  clearWorld();
  curModeId = id;
  MODES.cur = MODES[id];
  MODES.cur.init();
}

/* ---------- 指针锁 / 遮罩 ---------- */
function onLockChanged(l){
  overlay.style.display = l ? 'none' : 'flex';
  if(!l){
    if(curPage === 'win' || curPage === 'playTime') return;   // 通关/时限页由各自逻辑控制
    if(curModeId === 'tnt' && MODES.cur && MODES.cur.onMenu) MODES.cur.onMenu();
    else showPage(curModeId || 'main');
  }
}

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
  document.getElementById('arenaBackBtn').onclick = ()=> showPage('main');
  document.getElementById('tntBackBtn').onclick   = ()=> showPage('main');
  document.getElementById('buildBackBtn').onclick = ()=> showPage('main');
  document.getElementById('playTimeHomeBtn').onclick = ()=> showPage('main');
}

/* ---------- 主循环 ---------- */
let last=performance.now(), fps=0, fpsAcc=0, fpsCnt=0;
function loop(now){
  requestAnimationFrame(loop);
  if(NET_DEAD) return;                             // 心跳失联: 冻结一切
  let dt = (now-last)/1000; last=now;
  if(dt>0.05) dt=0.05;

  if(locked || touchPlaying){
    physics(dt);
    if(MODES.cur && MODES.cur.update) MODES.cur.update(dt);
    updateEffects(dt);
    /* 儿童时限: 竞技场+TNT+建造 实际游玩时累计 */
    if(PLAY_LIMIT_MODES.indexOf(curModeId) >= 0){
      playMs += dt*1000;
      if(!playWarned && playMs >= PLAY_LIMIT_MS-60000 && playMs < PLAY_LIMIT_MS){
        playWarned = true;
        showToast('⏰ 还剩 1 分钟哦');
      }
      if(playMs >= PLAY_LIMIT_MS) playTimeUp();
      else if(now - playSaveT > 5000){ playSaveT = now; savePlayTime(); }
    }
  }

  camera.position.set(pos.x, pos.y+PLAYER.eye, pos.z);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  if(shake > 0){
    shake -= dt;
    const s = Math.max(0, shake)*0.4;
    camera.position.x += (Math.random()-0.5)*s;
    camera.position.y += (Math.random()-0.5)*s;
  }

  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const hit = raycastVoxel(camera.position, dir, 6);
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
  if(fpsAcc>=0.5){ fps=Math.round(fpsCnt/fpsAcc); fpsAcc=0; fpsCnt=0; }
  if(MODES.cur && MODES.cur.updateHud) MODES.cur.updateHud();
}

/* ---------- 启动 ---------- */
let NET_DEAD = false;                              // 心跳失联 → 冻结游戏
function netDead(){
  if(NET_DEAD) return;
  NET_DEAD = true;
  try{ speechSynthesis.cancel(); }catch(e){}
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
