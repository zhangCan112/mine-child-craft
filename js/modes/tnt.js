"use strict";
/* ============================================================
   TNT 密室逃生模式
   捡引线 → 铺引线 → F 点火 → 火花沿线烧 → TNT 爆炸 → 炸穿出口逃出密室
============================================================ */

const tntScoreEl = document.getElementById('score');

const TntMode = {
  id:'tnt',
  init(){
    /* ③ 阶段实现完整机制 */
    clearWorld();
    rebuildAll();
    pos.set(WORLD_W/2+0.5, 30, WORLD_D/2+0.5);
    vel.set(0,0,0); yaw = 0; pitch = 0;
    tntScoreEl.style.display = 'none';
    hudEl.innerHTML = 'TNT 密室逃生 · 开发中';
    showToast('🧨 TNT 模式开发中…', 2500);
  },
  cleanup(){
    tntScoreEl.style.display = 'flex';
  },
  update(dt){},
  onKey(code){},
  onWheel(d){},
  onDigit(n){},
  onMouse(button, hit){},
  onVoidFall(){},
  updateHud(){}
};
