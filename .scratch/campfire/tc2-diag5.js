'use strict';
/* T-C2 验收诊断: 5 红逐条数值实证(只读诊断, 不改测试不改实现) */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..', '..');
const DT = 1 / 60;
const LIFT = 3;

function loadVoxelUp(opts) {
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
      getBlock, setBlockRaw, isSolid,
      pos, vel, physics, worldEvents,
      keys, get onGround(){ return onGround; }, set onGround(v){ onGround = v; },
      get yaw(){ return yaw; }, set yaw(v){ yaw = v; },
      setFly, setGliderEquipped, isGliding,
      PLAYER, GLIDE, B_CAMPFIRE,
      get UPDRAFT_SIM(){ return UPDRAFT_SIM; },
    };
  `, ctx);
  return ctx.__v;
}

function fill(v, x0, y0, z0, x1, y1, z1, id) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) v.setBlockRaw(x, y, z, id);
}

function mkScene() {
  const v = loadVoxelUp();
  fill(v, 38, 10, 38, 46, 10, 46, 3);
  v.UPDRAFT_SIM.add({x: 42, y: 11, z: 42, r: 1, h: 20, lift: LIFT});
  return v;
}
function settle(v, maxFrames) {
  for (let i = 0; i < maxFrames; i++) {
    v.physics(DT);
    if (v.onGround) return i;
  }
  return -1;
}

console.log('GLIDE =', JSON.stringify(v0()));
function v0() {
  const v = loadVoxelUp();
  return {sink: v.GLIDE.sink, player: v.PLAYER && {jump: v.PLAYER.jump, g: v.PLAYER.gravity, h: v.PLAYER.height}};
}

/* 红 #2: 踩火 */
{
  const v = mkScene();
  v.setBlockRaw(42, 11, 42, v.B_CAMPFIRE);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 12, 42.5);
  const s = settle(v, 200);
  console.log('[红2 踩火] settle=' + s + ' y=' + v.pos.y + ' onGround=' + v.onGround);
  /* 对照: thin 站立判定 — getBlock(42,12,42)/isSolid */
  console.log('[红2] block(42,12,42)=' + v.getBlock(42, 12, 42) + ' campfire=' + v.B_CAMPFIRE);
}

/* 红 #3: 步行穿柱 */
{
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  settle(v, 200);
  let glide = -1;
  for (let i = 0; i < 60; i++) {
    v.physics(DT);
    if (glide < 0 && v.isGliding()) glide = i;
  }
  console.log('[红3 静立] 展翼帧=' + glide + ' y=' + v.pos.y);
  v.yaw = 0;
  v.keys['KeyD'] = true;
  let wglide = -1;
  let trace = [];
  for (let i = 0; i < 120; i++) {
    v.physics(DT);
    if (v.isGliding() && wglide < 0) wglide = i;
    if (i % 10 === 0) trace.push('f' + i + ':x=' + v.pos.x.toFixed(2) + ',y=' + v.pos.y.toFixed(2) + ',og=' + v.onGround);
  }
  console.log('[红3 步行] 首展翼帧=' + wglide);
  console.log('[红3 trace] ' + trace.join(' | '));
}

/* 红 #4: 闩锁 */
{
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  settle(v, 200);
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  for (let i = 0; i < 120; i++) v.physics(DT);
  console.log('[红4] 120帧乘流后 y=' + v.pos.y.toFixed(2) + ' vel.y=' + v.vel.y.toFixed(2) + ' gliding=' + v.isGliding());
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  let landed = -1;
  for (let i = 0; i < 20; i++) {
    v.physics(DT);
    if (landed < 0 && v.worldEvents.land) landed = i;
  }
  console.log('[红4] 取消后 y=' + v.pos.y.toFixed(2) + ' land@' + landed + ' vel.y=' + v.vel.y.toFixed(2));
}

/* 红 #5: 全程安全 */
{
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  settle(v, 200);
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  for (let i = 0; i < 180; i++) v.physics(DT);
  console.log('[红5] 180帧后 y=' + v.pos.y.toFixed(2) + ' gliding=' + v.isGliding());
  v.pos.set(39.5, v.pos.y, 39.5);
  let i = 0;
  for (; i < 600 && !v.onGround; i++) v.physics(DT);
  console.log('[红5] 600帧末 onGround=' + v.onGround + ' y=' + v.pos.y.toFixed(3) + ' landFall=' + (v.worldEvents.landFall || 0).toFixed(2) + ' vel.y=' + v.vel.y.toFixed(3));
}
