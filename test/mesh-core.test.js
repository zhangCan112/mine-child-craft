"use strict";
/* 网格化核心 (js/mesh-core.js) 单测 — node --test (零依赖)
   运行: node --test test/mesh-core.test.js
   加载器与 Worker 环境完全一致: config.js + mesh-core.js 依序共享词法环境
   (浏览器 <script defer> / Worker importScripts / Node vm 三者同构)。
   被测 seam: MeshCore.meshChunk(全细节三通道) / MeshCore.meshChunkLod(降采样)。
   输入 pack 由测试手工构造(与 voxel.js packChunkData 的输出同构),
   hashRand 由调用方注入(纯核心零全局依赖, 与 combat-core 同惯例)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMeshCore(){
  const ctx = vm.createContext({ console });
  for(const f of ['config.js', 'mesh-core.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext('globalThis.__m = { MeshCore, BLOCKS, TNT_TILES, B_TNT, B_FUSE };', ctx);
  return ctx.__m;
}

/* pack 构造: 16×16 内部 + 可选边界圈 (border=1 → 18×18), y 全高 */
function mkPack(border){
  const w = 16 + 2*border, d = 16 + 2*border;
  return {
    cells: new Uint8Array(w*d*48), w, d, h: 48, border,
    bx: 100 - border, bz: 100 - border, yMax: 0,
    set(lx, y, lz, id){
      this.cells[(y*this.d + lz)*this.w + lx] = id;
      if(id !== 0 && y > this.yMax) this.yMax = y;
    }
  };
}
/* 固定 hashRand → tint 恒定 0.92+hr*0.12, 断言可精确到常数 */
const HR_HALF = () => 0.5, HR_ZERO = () => 0;
const OPT = { hashRand: HR_HALF, tntTiles: 4 };
const quads = ch => ch ? ch.indices.length/6 : 0;

/* ============ meshChunk · 全细节三通道 ============ */

test('meshChunk: 单方块 → 6 面 24 顶点, 法线覆盖六向', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(1, 5, 1, 3);                                  // 石头(内部左下角)
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.glass, null);
  assert.strictEqual(r.tnt, null);
  assert.strictEqual(quads(r.solid), 6);
  assert.strictEqual(r.solid.positions.length/3, 24);
  const dirs = new Set();
  for(let i=0;i<r.solid.normals.length;i+=3) dirs.add(r.solid.normals[i]+','+r.solid.normals[i+1]+','+r.solid.normals[i+2]);
  assert.strictEqual(dirs.size, 6);
});

test('meshChunk: 相邻两方块 → 共界面剔除, 10 面', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(1, 5, 1, 3); p.set(2, 5, 1, 3);
  assert.strictEqual(quads(m.MeshCore.meshChunk(p, OPT).solid), 10);
});

test('meshChunk: 边界圈参与剔面 — 邻块在 border 格, 内部块该向被剔', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(0, 5, 1, 3);                                  // border 格(不参与行走)
  p.set(1, 5, 1, 3);                                  // 内部块的 -X 邻居即 border 块
  assert.strictEqual(quads(m.MeshCore.meshChunk(p, OPT).solid), 5);
});

test('meshChunk: 玻璃走独立通道; 玻璃面对实心邻居剔面', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(1, 5, 1, 18);                                 // 玻璃
  let r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.solid, null);
  assert.strictEqual(quads(r.glass), 6);
  p.set(2, 5, 1, 3);                                  // 玻璃 +X 邻居为石头
  r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(quads(r.glass), 5);              // 面对实心的玻璃面被剔
  assert.strictEqual(quads(r.solid), 6);              // 实心面对玻璃不剔(现状语义)
});

test('meshChunk: TNT 走贴图通道, UV 行按 顶/底/侧 落格', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(8, 5, 8, m.B_TNT);
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.solid, null);
  assert.strictEqual(quads(r.tnt), 6);
  /* 每个面的 4 顶点 v 必须整体落在对应图集格 [row, row+1)/tiles 区间内
     (0 号格是 mipmap 缓冲垫: 顶=3 底=2 侧=1) — 与角点遍历顺序无关 */
  const rowOf = {};                                  // 面法线 y → 收集的 v
  for(let q=0;q<r.tnt.indices.length;q+=6){
    const ny = r.tnt.normals[r.tnt.indices[q]*3+1];
    const vs = [];
    for(let c=0;c<4;c++) vs.push(r.tnt.uvs[r.tnt.indices[q+c]*2+1]);
    rowOf[ny] = vs;
  }
  const inRow = (vs, row) => vs.every(v => v >= row/4 - 1e-12 && v <= (row+1)/4 + 1e-12);
  assert.ok(inRow(rowOf[1], 3),  '顶面 v ∈ [3/4, 4/4]: ' + rowOf[1]);
  assert.ok(inRow(rowOf[-1], 2), '底面 v ∈ [2/4, 3/4]: ' + rowOf[-1]);
  assert.ok(inRow(rowOf[0], 1),  '侧面 v ∈ [1/4, 2/4]: ' + rowOf[0]);
});

test('meshChunk: 薄块(引线)进实心通道, 无底面, 高度按 thin 缩放', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(3, 5, 3, m.B_FUSE);
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(quads(r.solid), 5);              // pushThin 跳过底面
  const ys = new Set();
  for(let i=1;i<r.solid.positions.length;i+=3) ys.add(r.solid.positions[i]);
  assert.ok(ys.has(5) && ys.has(5 + 0.14), 'y ∈ {y, y+thin}: ' + [...ys]);
});

test('meshChunk: tint 来自注入的 hashRand — 0.5→0.98, 0→0.92', () => {
  const m = loadMeshCore();
  const base = m.BLOCKS[3].all;                       // [0.50,0.50,0.53]
  const p1 = mkPack(1); p1.set(1, 5, 1, 3);
  const r1 = m.MeshCore.meshChunk(p1, { hashRand: HR_HALF, tntTiles: 4 });
  assert.ok(Math.abs(r1.solid.colors[0] - base[0]*0.98) < 1e-9);
  const p2 = mkPack(1); p2.set(1, 5, 1, 3);
  const r2 = m.MeshCore.meshChunk(p2, { hashRand: HR_ZERO, tntTiles: 4 });
  assert.ok(Math.abs(r2.solid.colors[0] - base[0]*0.92) < 1e-9);
});

test('meshChunk: 空区块三通道全空(null)', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.solid, null);
  assert.strictEqual(r.glass, null);
  assert.strictEqual(r.tnt, null);
});

/* ============ meshChunkLod · 降采样粗网格 ============ */

test('meshChunkLod: 平地 → (16/step)² 顶面 + 周界裙边(与全细节网格的地图边缘行为一致), 顶面色取自方块注册表', () => {
  const m = loadMeshCore();
  const p = mkPack(0);
  for(let lx=0;lx<16;lx++) for(let lz=0;lz<16;lz++) p.set(lx, 0, lz, 2);   // 泥土地
  const r = m.MeshCore.meshChunkLod(p, { step: 2 });
  const n = 16/2;                                     // 8×8 格
  const perim = 4*n;                                  // 四条边各 n 格的向外裙边(角格两条都计)
  assert.strictEqual(quads(r.solid), n*n + perim, '64 顶面 + 32 周界裙边(内部格高等 → 无裙边)');
  const c = m.BLOCKS[2].all;
  assert.ok(Math.abs(r.solid.colors[0] - c[0]) < 1e-9 && Math.abs(r.solid.colors[2] - c[2]) < 1e-9);
  let maxY = 0;
  for(let i=1;i<r.solid.positions.length;i+=3) maxY = Math.max(maxY, r.solid.positions[i]);
  assert.strictEqual(maxY, 1, '最高点 = 地面高+1');
});

test('meshChunkLod: 高塔抬升所在格顶面, 对低邻格四面出裙边', () => {
  const m = loadMeshCore();
  const p = mkPack(0);
  for(let lx=0;lx<16;lx++) for(let lz=0;lz<16;lz++) p.set(lx, 0, lz, 2);
  for(let y=0;y<=2;y++) p.set(2, y, 2, 3);            // 3 高石柱, 落 step=2 的格 (1,1)
  const r = m.MeshCore.meshChunkLod(p, { step: 2 });
  const n = 16/2, perim = 4*n;
  assert.strictEqual(quads(r.solid), n*n + 4 + perim, '64 顶面 + 塔格对低邻格 4 裙边 + 32 周界裙边');
  let maxY = 0;
  for(let i=1;i<r.solid.positions.length;i+=3) maxY = Math.max(maxY, r.solid.positions[i]);
  assert.strictEqual(maxY, 3, '塔格顶面 y = 2+1');
});

test('meshChunkLod: 薄块不算表面 — 引线塔不抬升格高', () => {
  const m = loadMeshCore();
  const p = mkPack(0);
  for(let lx=0;lx<16;lx++) for(let lz=0;lz<16;lz++) p.set(lx, 0, lz, 2);
  p.set(4, 1, 4, m.B_FUSE);                           // 贴地引线, 叠在泥土上
  const r = m.MeshCore.meshChunkLod(p, { step: 2 });
  const n = 16/2, perim = 4*n;
  assert.strictEqual(quads(r.solid), n*n + perim, '引线不产生裙边/抬升');
  const c = m.BLOCKS[2].all;
  assert.ok(Math.abs(r.solid.colors[0] - c[0]) < 1e-9, '表面色仍是泥土(引线被跳过)');
});
