'use strict';
/* T-G04 红方剧本可达性复现: 「跳跃+单帧 W」能否进入滑翔(adventure-mode.test.js
   glideAirborne 同款剧本, voxel.test.js loadVoxel 同款装具) — 绿方诊断工件,
   不进任何测试面 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const ctx = vm.createContext({console});
for (const f of ['config.js', 'voxel.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, {filename: f});
}
vm.runInContext('var keys = {}; var touchMove = {x:0, y:0}; var touchSprint = false;', ctx);
vm.runInContext(`
  globalThis.__v = {
    getBlock, setBlockRaw, pos, vel, physics, worldEvents,
    get setGliderEquipped(){ return setGliderEquipped; },
    get isGliding(){ return isGliding; },
    keys,
    get onGround(){ return onGround; },
    get yaw(){ return yaw; }, set yaw(v){ yaw = v; },
    get gliding(){ return gliding; },
    get gliderEquipped(){ return gliderEquipped; },
    WORLD_H,
  };
`, ctx);
const G = ctx.__v;
const DT = 1 / 60;

/* adventure-mode.test.js glideTower/glidePlace/glideFrame 同款 */
function topAt(x, z) {
  for (let y = G.WORLD_H - 1; y >= 0; y--) if (G.getBlock(x, y, z)) return y;
  return 0;
}
function tower(x, z, h) {
  const gy = topAt(x, z);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let y = gy + 1; y <= gy + h + 10; y++) G.setBlockRaw(x + dx, y, z + dz, 0);
    }
  }
  for (let y = gy + 1; y <= gy + h; y++) G.setBlockRaw(x, y, z, 3);
  return gy + h;
}
function place(x, topY, z) {
  G.pos.set(x + 0.5, topY + 1, z + 0.5);
  G.vel.set(0, 0, 0);
  frame(2);
}
function frame(n) {
  for (let i = 0; i < n; i++) G.physics(DT);
}

G.setGliderEquipped(true);
const top = tower(20, 20, 6);
place(20, top, 20);
console.log('place 后: pos=(' + G.pos.x.toFixed(3) + ',' + G.pos.y.toFixed(3) + ',' + G.pos.z.toFixed(3) +
    ') onGround=' + G.onGround + ' 柱顶面 y=' + (top + 1));

/* 剧本 A: Space+W 单帧(adventure glideAirborne / test 2 同款) */
G.keys['Space'] = true; G.keys['KeyW'] = true;
frame(1);
G.keys['Space'] = false; G.keys['KeyW'] = false;
let maxOffGround = 0; let maxXz = 0;
const x0 = G.pos.x; const z0 = G.pos.z;
for (let i = 0; i < 40; i++) {
  frame(1);
  /* 离柱顶面高度(柱顶面 y=top+1) 与水平位移 */
  maxOffGround = Math.max(maxOffGround, G.pos.y - (top + 1));
  maxXz = Math.max(maxXz, Math.hypot(G.pos.x - x0, G.pos.z - z0));
  if (G.gliding) break;
}
console.log('剧本 A(跳+单帧 W): gliding=' + G.gliding + ' 离柱面峰值=' +
    maxOffGround.toFixed(3) + ' 格(阈值需>2) 水平总位移=' + maxXz.toFixed(3) +
    ' 格(跨出 1x1 柱心需 0.5)');

/* 剧本 B: 走崖(W 持续按, test 3 同款) 对照 */
G.setGliderEquipped(true);
const top2 = tower(40, 40, 6);
place(40, top2, 40);
G.keys['KeyW'] = true;
let walked = 0;
for (let i = 0; i < 60 && !G.gliding; i++) { frame(1); walked++; }
G.keys['KeyW'] = false;
console.log('剧本 B(走崖 W 持续): gliding=' + G.gliding + ' 走出帧数=' + walked);
