"use strict";
/* ============================================================
   输入:指针锁 / 键鼠事件 → 路由到当前模式
============================================================ */
const keys = {};
let locked = false;

function requestLock(){ renderer.domElement.requestPointerLock(); }

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

document.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  if(!locked) return;
  if(e.code.startsWith('Digit')){
    const n = parseInt(e.code.slice(5),10);
    if(MODES.cur && MODES.cur.onDigit) MODES.cur.onDigit(n);
  }
  if(MODES.cur && MODES.cur.onKey) MODES.cur.onKey(e.code);
});
document.addEventListener('keyup', (e)=>{ keys[e.code] = false; });

document.addEventListener('wheel', (e)=>{
  if(!locked) return;
  if(MODES.cur && MODES.cur.onWheel) MODES.cur.onWheel(e.deltaY>0 ? 1 : -1);
});

document.addEventListener('contextmenu', (e)=> e.preventDefault());
renderer.domElement.addEventListener('click', ()=>{ if(!locked) requestLock(); });
renderer.domElement.addEventListener('mousedown', (e)=>{
  if(!locked) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const hit = raycastVoxel(camera.position, dir, 6);
  if(MODES.cur && MODES.cur.onMouse) MODES.cur.onMouse(e.button, hit);
});
