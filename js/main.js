"use strict";
/* ============================================================
   主入口:模式注册 / 菜单页面 / 主循环
============================================================ */

const MODES = {
  arena: ArenaMode,
  tnt:   TntMode
};
MODES.cur = null;
let curModeId = null;

/* ---------- 菜单页面切换 ---------- */
const overlay = document.getElementById('overlay');
const pages = {
  main:  document.getElementById('menuMain'),
  arena: document.getElementById('menuArena'),
  tnt:   document.getElementById('menuTnt'),
  win:   document.getElementById('menuWin')
};
let curPage = 'main';
function showPage(id){
  curPage = id;
  for(const k in pages) pages[k].classList.toggle('active', k===id);
}

/* ---------- 模式切换 ---------- */
function switchMode(id){
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
    if(curPage === 'win') return;                    // 通关结算页由 TNT 模式控制
    if(curModeId === 'tnt' && MODES.cur && MODES.cur.onMenu) MODES.cur.onMenu();
    else showPage(curModeId || 'main');
  }
}

/* ---------- 主菜单与按钮 ---------- */
function buildMenu(){
  document.getElementById('cardArena').onclick = ()=>{
    if(curModeId !== 'arena') switchMode('arena');
    showPage('arena');
  };
  document.getElementById('cardTnt').onclick = ()=>{
    if(curModeId !== 'tnt') switchMode('tnt');
    showPage('tnt');
    if(MODES.cur.buildMenu) MODES.cur.buildMenu();
  };
  document.getElementById('arenaBackBtn').onclick = ()=> showPage('main');
  document.getElementById('tntBackBtn').onclick   = ()=> showPage('main');
}

/* ---------- 主循环 ---------- */
let last=performance.now(), fps=0, fpsAcc=0, fpsCnt=0;
function loop(now){
  requestAnimationFrame(loop);
  let dt = (now-last)/1000; last=now;
  if(dt>0.05) dt=0.05;

  if(locked){
    physics(dt);
    if(MODES.cur && MODES.cur.update) MODES.cur.update(dt);
    updateEffects(dt);
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
function init(){
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
