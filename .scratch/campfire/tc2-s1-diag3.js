'use strict';
/* S-1 401 用例末段红因诊断: 解闩升顶→出柱→落地→再跳 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..', '..');
const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/config.js', 'js/updraft-core.js', 'js/voxel.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
}
vm.runInContext('var keys = {}; var touchMove = {x: 0, y: 0}; var touchSprint = false;', ctx);
vm.runInContext(`
  if (typeof UpdraftCore !== 'undefined' && typeof getBlock === 'function') {
    globalThis.UPDRAFT_SIM = UpdraftCore.mkSim({read: getBlock, solidOf: isSolid});
  }
`, ctx);
vm.runInContext(`
  globalThis.__v = {
    getBlock, setBlockRaw, pos, vel, physics, keys, worldEvents,
    get onGround(){ return onGround; }, set onGround(v){ onGround = v; },
    get yaw(){ return yaw; }, set yaw(v){ yaw = v; },
    setFly, setGliderEquipped, isGliding, GLIDE,
    get UPDRAFT_SIM(){ return UPDRAFT_SIM; },
  };
`, ctx);
const v = ctx.__v;
const DT = 1 / 60;
for (let x = 38; x <= 46; x++) for (let z = 38; z <= 46; z++) v.setBlockRaw(x, 10, z, 3);
v.UPDRAFT_SIM.add({x: 42, y: 11, z: 42, r: 1, h: 20, lift: 3});
v.setGliderEquipped(true);
v.pos.set(41.5, 11, 42.5);
for (let i = 0; i < 200; i++) { v.physics(DT); if (v.onGround) break; }
v.keys['Space'] = true; v.physics(DT); v.keys['Space'] = false;
for (let i = 0; i < 120; i++) v.physics(DT);
console.log('乘流120: y=' + v.pos.y.toFixed(2) + ' glide=' + v.isGliding());
v.keys['Space'] = true; v.physics(DT); v.keys['Space'] = false; // 取消→闩锁
console.log('取消: glide=' + v.isGliding() + ' vy=' + v.vel.y.toFixed(2));
for (let i = 0; i < 20; i++) v.physics(DT);
console.log('闩锁20帧: y=' + v.pos.y.toFixed(2) + ' glide=' + v.isGliding());
v.keys['Space'] = true; v.physics(DT); v.keys['Space'] = false; // 解闩+展翼
console.log('解闩: glide=' + v.isGliding() + ' vy=' + v.vel.y.toFixed(2));
for (let i = 0; i < 30; i++) v.physics(DT);
console.log('持续30: y=' + v.pos.y.toFixed(2) + ' vy=' + v.vel.y.toFixed(3) + ' glide=' + v.isGliding());
let topped = false;
for (let i = 0; i < 400; i++) { v.physics(DT); if (v.pos.y >= 30) { topped = true; console.log('top@f' + i + ' y=' + v.pos.y.toFixed(2) + ' glide=' + v.isGliding()); break; } }
console.log('topped=' + topped + ' y=' + v.pos.y.toFixed(2));
v.pos.set(39.5, v.pos.y, 39.5);
v.physics(DT);
console.log('出柱: vy=' + v.vel.y.toFixed(3) + ' glide=' + v.isGliding());
v.worldEvents.land = false;
let fr = 0;
for (; fr < 1900 && !v.onGround; fr++) v.physics(DT);
console.log('落地循环: fr=' + fr + ' og=' + v.onGround + ' y=' + v.pos.y.toFixed(3) + ' glide=' + v.isGliding() + ' land=' + v.worldEvents.land);
v.keys['Space'] = true; v.physics(DT); v.keys['Space'] = false;
console.log('再跳: glide=' + v.isGliding() + ' vy=' + v.vel.y.toFixed(3) + ' og=' + v.onGround);
