'use strict';
/* S-1 次生面红因诊断: 柱外起跳→展翼时序 */
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
    getBlock, setBlockRaw, pos, vel, physics, keys,
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
v.pos.set(39.5, 11, 42.5);
for (let i = 0; i < 200; i++) { v.physics(DT); if (v.onGround) break; }
console.log('settle y=' + v.pos.y + ' og=' + v.onGround);
v.keys['Space'] = true;
for (let i = 0; i < 34; i++) {
  v.physics(DT);
  if (i < 6 || i % 4 === 0) console.log('f' + i + ' y=' + v.pos.y.toFixed(2) + ' vy=' + v.vel.y.toFixed(2) + ' glide=' + v.isGliding());
}
