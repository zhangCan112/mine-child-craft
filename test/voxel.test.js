"use strict";
/* 体素模型 (js/voxel.js) 单测 — node --test (零依赖)
   运行: node --test test/voxel.test.js
   加载器: 同一 vm context 依次执行 config.js + voxel.js — 精确镜像浏览器
   <script defer> 的共享词法环境; 源文件零改动即可在 Node 里测 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadVoxel(){
  const ctx = vm.createContext({ console });
  for(const f of ['config.js', 'voxel.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  /* input.js 的占位(仅 physics 在调用期读取); var → context 全局属性, 严格模式下自由变量可解析 */
  vm.runInContext('var keys = {}; var touchMove = {x:0, y:0}; var touchSprint = false;', ctx);
  /* 桥接: context 内可见全局词法名, 外部经 __v 访问; let 基本类型用 getter/setter 保持同步 */
  vm.runInContext(`
    globalThis.__v = {
      world, getBlock, setBlockRaw, isSolid, groundTop, hashRand, blockKey,
      raycastVoxel, pos, vel, collides, physics, collidesAtPlayer, worldEvents,
      keys, touchMove, touchSprint,
      get onGround(){ return onGround; }, set onGround(v){ onGround = v; },
      get yaw(){ return yaw; }, set yaw(v){ yaw = v; },
      get pitch(){ return pitch; }, set pitch(v){ pitch = v; },
      get flyMode(){ return flyMode; }, set flyMode(v){ flyMode = v; },
      PLAYER, WORLD_W, WORLD_D, WORLD_H, BLOCKS, B_FUSE, B_WATER,
    };
  `, ctx);
  return ctx.__v;
}

function fill(v, x0, y0, z0, x1, y1, z1, id){
  for(let x=x0; x<=x1; x++) for(let y=y0; y<=y1; y++) for(let z=z0; z<=z1; z++) v.setBlockRaw(x, y, z, id);
}
const DT = 1/60;
function settle(v, maxFrames){                       // 跑物理直到稳定(落地)或超帧
  for(let i=0; i<maxFrames; i++){ v.physics(DT); if(v.onGround) return i; }
  return -1;
}

/* ============ 方块存取 ============ */

test('方块存取: 写读回程, 越界与未设置返回 0', () => {
  const v = loadVoxel();
  assert.strictEqual(v.blockKey(1, 2, 3), '1,2,3');
  v.setBlockRaw(10, 20, 30, 3);
  assert.strictEqual(v.getBlock(10, 20, 30), 3);
  assert.strictEqual(v.getBlock(10, 20, 31), 0);          // 未设置
  assert.strictEqual(v.getBlock(-1, 20, 30), 0);          // x 越界
  assert.strictEqual(v.getBlock(10, -1, 30), 0);          // y<0
  assert.strictEqual(v.getBlock(10, v.WORLD_H, 30), 0);   // y≥WORLD_H
});

test('isSolid: 引线/水非实心, 石头实心, 未知 id 按实心(现状)', () => {
  const v = loadVoxel();
  assert.strictEqual(v.isSolid(0), false);
  assert.strictEqual(v.isSolid(3), true);                 // 石头
  assert.strictEqual(v.isSolid(v.B_FUSE), false);         // 引线 thin + solid:false
  assert.strictEqual(v.isSolid(v.B_WATER), false);        // 水 solid:false
  assert.strictEqual(v.isSolid(99), true);                // 未知 id 兜底为实心(记录现状)
});

test('groundTop: 自上而下扫到首个非空气; 空柱返回 0', () => {
  const v = loadVoxel();
  v.setBlockRaw(50, 3, 50, 3);
  v.setBlockRaw(50, 7, 50, 4);
  assert.strictEqual(v.groundTop(50, 50), 7);
  assert.strictEqual(v.groundTop(60, 60), 0);
});

/* ============ 碰撞与物理 ============ */

test('collides: 站上方块之上为不碰撞(ε 收缩), 嵌入为碰撞', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);                     // y=10 一层地板
  assert.strictEqual(v.collides(42.5, 10.5, 42.5), true); // 脚嵌入方块
  assert.strictEqual(v.collides(42.5, 11.0, 42.5), false);// 恰好站在顶面
});

test('physics: 重力下落到地板并落地(贴齐方块顶面)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.pos.set(42.5, 30, 42.5);
  const frames = settle(v, 2000);
  assert.ok(frames > 0, '应落地');
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.pos.y, 11);                        // 顶面吸附: 块顶 y=10 → 脚 y=11
  assert.strictEqual(v.vel.y, 0);
});

test('physics: 高速坠落不穿透单层薄板(轴向子步进 ≤0.25 格)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);                     // 仅一层
  v.pos.set(42.5, 40, 42.5);
  const frames = settle(v, 3000);                         // 坠至限速 -30, 每帧位移 0.5 > 0.25
  assert.ok(frames > 0, '限速坠落必须被单层地板接住');
  assert.strictEqual(v.pos.y, 11);
});

test('physics: 世界边缘隐形墙夹取(双向)', () => {
  const v = loadVoxel();
  v.flyMode = true;                                       // 飞行恒速, 避开地形干扰
  v.pos.set(120, 20, 64.5);
  v.keys['KeyD'] = true;                                  // yaw=0 → +x 方向
  for(let i=0; i<400; i++) v.physics(DT);
  assert.ok(v.pos.x <= v.WORLD_W - v.PLAYER.hx + 1e-9, '东边界不得越出: ' + v.pos.x);
  v.keys['KeyD'] = false;
  v.keys['KeyA'] = true;
  for(let i=0; i<4000; i++) v.physics(DT);
  assert.ok(v.pos.x >= v.PLAYER.hx - 1e-9, '西边界不得越出: ' + v.pos.x);
});

test('physics: 坠出世界置 worldEvents.voidFall(引擎只报事件)', () => {
  const v = loadVoxel();
  v.pos.set(64.5, -5, 64.5);
  assert.strictEqual(v.worldEvents.voidFall, false);
  for(let i=0; i<600 && !v.worldEvents.voidFall; i++) v.physics(DT);
  assert.strictEqual(v.worldEvents.voidFall, true);
});

test('physics: flyMode 无重力, 空格升/Shift 降', () => {
  const v = loadVoxel();
  v.flyMode = true;
  v.keys['Space'] = true;
  v.physics(DT);
  assert.strictEqual(v.vel.y, 7);
  v.keys['Space'] = false;
  v.keys['ShiftLeft'] = true;
  v.physics(DT);
  assert.strictEqual(v.vel.y, -7);
});

test('physics: 落地状态下跳跃获得向上速度', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.pos.set(42.5, 11, 42.5);
  v.onGround = true;
  v.keys['Space'] = true;
  v.physics(DT);
  assert.strictEqual(v.vel.y, v.PLAYER.jump);
  assert.strictEqual(v.onGround, false);
});

/* ============ 射线 ============ */

test('raycastVoxel: 向下命中地板并给出顶面法线', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  const hit = v.raycastVoxel({x:42.5, y:15.5, z:42.5}, {x:0, y:-1, z:0}, 6);
  assert.ok(hit);
  assert.strictEqual(hit.y, 10);
  assert.strictEqual(hit.ny, 1);                          // 自上方进入 → 顶面法线
  assert.strictEqual(v.raycastVoxel({x:42.5, y:15.5, z:42.5}, {x:0, y:1, z:0}, 6), null);    // 向上射空
  assert.strictEqual(v.raycastVoxel({x:42.5, y:15.5, z:42.5}, {x:0, y:-1, z:0}, 2), null);   // 距离不够
});

test('raycastVoxel: 侧向命中给出反向法线', () => {
  const v = loadVoxel();
  v.setBlockRaw(45, 15, 42, 3);
  const hit = v.raycastVoxel({x:42.5, y:15.5, z:42.5}, {x:1, y:0, z:0}, 6);
  assert.ok(hit);
  assert.strictEqual(hit.x, 45);
  assert.strictEqual(hit.nx, -1);                         // 自西侧进入 → 法线朝 -x
});

test('hashRand: 确定性且落在 [0,1)', () => {
  const v = loadVoxel();
  const a = v.hashRand(123, 456);
  assert.strictEqual(a, v.hashRand(123, 456));
  assert.ok(a >= 0 && a < 1);
  assert.notStrictEqual(a, v.hashRand(124, 456));
});
