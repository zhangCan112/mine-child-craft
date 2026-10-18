"use strict";
/* ============================================================
   输入:指针锁(桌面) / 触屏(平板) 双路径 + 模式路由
   触屏: 左摇杆移动 · 画布拖动视角 · 右下动作按钮 · 右上暂停
============================================================ */
const keys = {};
let locked = false;

/* 触屏状态 */
const isTouch = (()=>{ try{ return ('ontouchstart' in window) || (navigator.maxTouchPoints>0); }catch(e){ return false; } })();
let touchPlaying = false;                       // 触屏下的"进行中"等价于 locked
const touchMove = {x:0, y:0};                   // 摇杆向量 (-1..1)
let touchSprint = false;
let lastTouchT = 0;                             // 抑制触屏合成的鼠标事件

function requestLock(){
  if(isTouch){
    touchPlaying = true;
    document.getElementById('overlay').style.display = 'none';
    return;
  }
  renderer.domElement.requestPointerLock();
}
/* 暂停/回菜单 (Esc 等价, 触屏可用) */
function uiPause(){
  if(document.pointerLockElement){ document.exitPointerLock(); }
  else {
    touchPlaying = false;
    if(typeof onLockChanged === 'function') onLockChanged(false);
  }
}

document.addEventListener('pointerlockchange', ()=>{
  locked = (document.pointerLockElement === renderer.domElement);
  if(typeof onLockChanged === 'function') onLockChanged(locked);
});

document.addEventListener('mousemove', (e)=>{
  if(!locked) return;
  const s = 0.0022;
  yaw   -= e.movementX * s;
  pitch -= e.movementY * s;
  pitch = Math.max(-1.55, Math.min(1.55, pitch));
});

/* ---------- 触屏视角拖动 (画布) ---------- */
let lookId = null, lookX = 0, lookY = 0;
renderer.domElement.addEventListener('pointerdown', (e)=>{
  if(e.pointerType === 'mouse') return;         // 鼠标走原路径
  lastTouchT = performance.now();
  if(lookId === null){ lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY; }
});
addEventListener('pointermove', (e)=>{
  if(e.pointerId !== lookId) return;
  const s = 0.0045;
  yaw   -= (e.clientX - lookX) * s;
  pitch -= (e.clientY - lookY) * s;
  pitch = Math.max(-1.55, Math.min(1.55, pitch));
  lookX = e.clientX; lookY = e.clientY;
});
addEventListener('pointerup', (e)=>{ if(e.pointerId === lookId) lookId = null; });
addEventListener('pointercancel', (e)=>{ if(e.pointerId === lookId) lookId = null; });

/* ---------- 键盘 ---------- */
document.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  if(!locked && !touchPlaying) return;
  if(e.code==='KeyV' || e.code==='KeyC'){            // 视角切换(不用 F5: 留给浏览器刷新)
    showToast('📷 视角：' + CameraRig.cycle());
    return;
  }
  if(e.code.startsWith('Digit')){
    const n = parseInt(e.code.slice(5),10);
    if(MODES.cur && MODES.cur.onDigit) MODES.cur.onDigit(n);
  }
  if(MODES.cur && MODES.cur.onKey) MODES.cur.onKey(e.code);
});
document.addEventListener('keyup', (e)=>{ keys[e.code] = false; });

document.addEventListener('wheel', (e)=>{
  if(!locked && !touchPlaying) return;
  if(MODES.cur && MODES.cur.onWheel) MODES.cur.onWheel(e.deltaY>0 ? 1 : -1);
});

/* ---------- 鼠标 (触屏合成事件会被抑制) ---------- */
document.addEventListener('contextmenu', (e)=> e.preventDefault());
renderer.domElement.addEventListener('click', ()=>{
  if(isTouch || locked) return;
  requestLock();
});
/* 准星点击统一入口(桌面 mousedown 与触屏动作按钮共用):
   aim → raycast → 手持物挥击 → 分发模式。挥臂是纯手部反馈,
   不含命中判定(挖/放/对空一致 — 按共识收在输入层一处, 全模式统一)。 */
function aimClick(button){
  const aim = CameraRig.aim();
  const hit = raycastVoxel(aim.origin, aim.dir, 6);
  if(button === 0 || button === 2) Avatar.swing();
  if(MODES.cur && MODES.cur.onMouse) MODES.cur.onMouse(button, hit);
}

renderer.domElement.addEventListener('mousedown', (e)=>{
  if(performance.now() - lastTouchT < 600) return;    // 触屏合成鼠标事件, 忽略
  if(!locked) return;
  aimClick(e.button);
});

/* 准星中心点击 (触屏动作按钮用) */
function doCenterClick(button){
  aimClick(button);
}

/* ---------- 虚拟摇杆 + 动作按钮 ---------- */
let touchBuilt = false;
function buildTouchUI(){
  if(touchBuilt) return;
  touchBuilt = true;
  const root = document.createElement('div');
  root.id = 'touchUI';
  root.innerHTML = '<div id="joy"><div id="joyKnob"></div></div>'
    + '<div id="touchBtns"></div>'
    + '<button id="touchCam">📷</button>'
    + '<button id="touchPause">⏸</button>';
  document.body.appendChild(root);
  document.getElementById('touchPause').onpointerdown = (e)=>{ e.preventDefault(); uiPause(); };
  document.getElementById('touchCam').onpointerdown = (e)=>{ e.preventDefault(); showToast('📷 视角：' + CameraRig.cycle()); };

  const joy = document.getElementById('joy');
  const knob = document.getElementById('joyKnob');
  let joyId = null;
  function joyMove(e){
    const r = joy.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width/2)) / (r.width/2);
    let dy = (e.clientY - (r.top + r.height/2)) / (r.height/2);
    const m = Math.hypot(dx, dy);
    if(m > 1){ dx /= m; dy /= m; }
    touchMove.x = dx; touchMove.y = dy;
    touchSprint = (m > 0.92 && dy < -0.6);      // 摇杆推满向前 = 疾跑
    knob.style.transform = 'translate(calc(-50% + ' + (dx*38) + 'px), calc(-50% + ' + (dy*38) + 'px))';
  }
  joy.onpointerdown = (e)=>{ e.preventDefault(); joyId = e.pointerId;
    try{ joy.setPointerCapture(joyId); }catch(_){ } joyMove(e); };
  joy.onpointermove = (e)=>{ if(e.pointerId === joyId) joyMove(e); };
  const joyEnd = (e)=>{ if(e.pointerId !== joyId) return;
    joyId = null; touchMove.x = touchMove.y = 0; touchSprint = false;
    knob.style.transform = 'translate(-50%,-50%)'; };
  joy.onpointerup = joyEnd; joy.onpointercancel = joyEnd;
}
/* 模式设置动作按钮: [{label, hold:'键码'} | {label, act:fn}] ; null=全部隐藏 */
function setTouchActions(list){
  buildTouchUI();
  const root = document.getElementById('touchUI');
  if(!list || !isTouch){ root.style.display = 'none'; return; }
  root.style.display = 'block';
  const box = document.getElementById('touchBtns');
  box.innerHTML = '';
  for(const a of list){
    const b = document.createElement('button');
    b.textContent = a.label;
    if(a.hold){
      b.onpointerdown = (e)=>{ e.preventDefault(); keys[a.hold] = true; };
      b.onpointerup = b.onpointercancel = b.onpointerleave = ()=>{ keys[a.hold] = false; };
    } else {
      b.onpointerdown = (e)=>{ e.preventDefault(); lastTouchT = performance.now(); a.act(); };
    }
    box.appendChild(b);
  }
}
