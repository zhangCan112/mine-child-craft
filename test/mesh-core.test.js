'use strict';
/* 网格化核心 (js/mesh-core.js) 单测 — node --test (零依赖)
   运行: node --test test/mesh-core.test.js
   加载器与 Worker 环境完全一致: config.js + mesh-core.js 依序共享词法环境
   (浏览器 <script defer> / Worker importScripts / Node vm 三者同构)。
   被测 seam: MeshCore.meshChunk(全细节三通道) / MeshCore.meshChunkLod(降采样)。
   输入 pack 由测试手工构造(与 voxel.js packChunkData 的输出同构),
   hashRand 由调用方注入(纯核心零全局依赖, 与 combat-core 同惯例)。
   D3 顶点光: 四通道每顶点 sky/block 属性(等级/15) — 普通面取面朝向邻格,
   十字片/薄块取自身格, LOD 仅天空二值 0/15; 无光照载荷的 pack 回落全亮
   (docs/mc-daylight-torch-design.md §4.1)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMeshCore() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'mesh-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__m = { MeshCore, BLOCKS, TNT_TILES, B_TNT, B_FUSE, B_TORCH, faceColor,\n' +
      '    B_DOOR, B_DOOR_TOP, B_DOOR_OPEN, B_DOOR_TOP_OPEN, B_GLASS_PANE };', ctx);
  return ctx.__m;
}

/* pack 构造: 16×16 内部 + 可选边界圈 (border=1 → 18×18), y 全高 */
function mkPack(border) {
  const w = 16 + 2*border; const d = 16 + 2*border;
  return {
    cells: new Uint8Array(w*d*48), w, d, h: 48, border,
    bx: 100 - border, bz: 100 - border, yMax: 0,
    set(lx, y, lz, id) {
      this.cells[(y*this.d + lz)*this.w + lx] = id;
      if (id !== 0 && y > this.yMax) this.yMax = y;
    },
  };
}

/* 带光照载荷的 pack(D3): sky/block 与 cells 同形同布局(voxel.js packChunkData
   的 D2 契约), 光值由测试逐格显式写入 — 断言不经生产代码派生 */
function mkPackL(border) {
  const p = mkPack(border);
  p.sky = new Uint8Array(p.w*p.d*48); // 缺省 0: 被遮蔽(取样格全由测试显式给值)
  p.block = new Uint8Array(p.w*p.d*48);
  p.setL = (lx, y, lz, s, b) => {
    p.sky[(y*p.d + lz)*p.w + lx] = s;
    p.block[(y*p.d + lz)*p.w + lx] = b;
  };
  return p;
}
/* 固定 hashRand → tint 恒定 0.92+hr*0.12, 断言可精确到常数 */
const HR_HALF = () => 0.5; const HR_ZERO = () => 0;
const OPT = {hashRand: HR_HALF, tntTiles: 4};
const quads = (ch) => ch ? ch.indices.length/6 : 0;

/* ============ meshChunk · 全细节三通道 ============ */

test('meshChunk: 单方块 → 6 面 24 顶点, 法线覆盖六向', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(1, 5, 1, 3); // 石头(内部左下角)
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.glass, null);
  assert.strictEqual(r.tnt, null);
  assert.strictEqual(quads(r.solid), 6);
  assert.strictEqual(r.solid.positions.length/3, 24);
  const dirs = new Set();
  for (let i=0; i<r.solid.normals.length; i+=3) {
    dirs.add(r.solid.normals[i]+','+r.solid.normals[i+1]+','+r.solid.normals[i+2]);
  }
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
  p.set(0, 5, 1, 3); // border 格(不参与行走)
  p.set(1, 5, 1, 3); // 内部块的 -X 邻居即 border 块
  assert.strictEqual(quads(m.MeshCore.meshChunk(p, OPT).solid), 5);
});

test('meshChunk: 玻璃走独立通道; 玻璃面对实心邻居剔面', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(1, 5, 1, 18); // 玻璃
  let r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.solid, null);
  assert.strictEqual(quads(r.glass), 6);
  p.set(2, 5, 1, 3); // 玻璃 +X 邻居为石头
  r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(quads(r.glass), 5); // 面对实心的玻璃面被剔
  assert.strictEqual(quads(r.solid), 6); // 实心面对玻璃不剔(现状语义)
});

/* ============ 流体通道(docs/liquid-design.md D7: 部分高度水面) ============ */

test('meshChunk: 水源(无 levels 通道)走玻璃通道, 顶面 8/9 高 — 存量调用方缺省源', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(1, 5, 1, 24); // 水(B_WATER)
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.solid, null, '水不进实心通道');
  assert.strictEqual(quads(r.glass), 6, '孤立方 6 面全画');
  let maxY = 0;
  for (let i = 1; i < r.glass.positions.length; i += 3) maxY = Math.max(maxY, r.glass.positions[i]);
  assert.ok(Math.abs(maxY - (5 + 8 / 9)) < 1e-9, '顶面高度 = 5 + 8/9, 实测 ' + maxY);
});

test('meshChunk: 流动水按水位缩放(lv7 → 1/9 高), levels 通道驱动', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.levels = new Uint8Array(p.w * p.d * p.h); // 手工水位通道(与 packChunkData 输出同构)
  p.set(1, 5, 1, 24);
  p.levels[(5 * p.d + 1) * p.w + 1] = 7;
  const r = m.MeshCore.meshChunk(p, OPT);
  let maxY = 0;
  for (let i = 1; i < r.glass.positions.length; i += 3) maxY = Math.max(maxY, r.glass.positions[i]);
  assert.ok(Math.abs(maxY - (5 + 1 / 9)) < 1e-9, '最弱流动水位 1/9, 实测 ' + maxY);
});

test('meshChunk: 上方同流体 → 本格整格高且顶面剔除(下落柱整格观感)', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(1, 5, 1, 24);
  p.set(1, 6, 1, 24);
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(quads(r.glass), 10, '下格 4 侧+底(顶被剔), 上格 4 侧+顶(底被剔)');
  let maxY = 0;
  for (let i = 1; i < r.glass.positions.length; i += 3) maxY = Math.max(maxY, r.glass.positions[i]);
  assert.ok(Math.abs(maxY - (6 + 8 / 9)) < 1e-9, '上格顶面 8/9');
});

test('meshChunk: 岩浆走实心通道, 高度按水位(lv4 → 4/9)', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.levels = new Uint8Array(p.w * p.d * p.h);
  p.set(1, 5, 1, 25); // 岩浆(B_LAVA)
  p.levels[(5 * p.d + 1) * p.w + 1] = 4;
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.glass, null, '岩浆不透明');
  assert.strictEqual(quads(r.solid), 6);
  let maxY = 0;
  for (let i = 1; i < r.solid.positions.length; i += 3) maxY = Math.max(maxY, r.solid.positions[i]);
  assert.ok(Math.abs(maxY - (5 + 4 / 9)) < 1e-9, '岩浆水位 4/9, 实测 ' + maxY);
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
  const rowOf = {}; // 面法线 y → 收集的 v
  for (let q=0; q<r.tnt.indices.length; q+=6) {
    const ny = r.tnt.normals[r.tnt.indices[q]*3+1];
    const vs = [];
    for (let c=0; c<4; c++) vs.push(r.tnt.uvs[r.tnt.indices[q+c]*2+1]);
    rowOf[ny] = vs;
  }
  const inRow = (vs, row) => vs.every((v) => v >= row/4 - 1e-12 && v <= (row+1)/4 + 1e-12);
  assert.ok(inRow(rowOf[1], 3), '顶面 v ∈ [3/4, 4/4]: ' + rowOf[1]);
  assert.ok(inRow(rowOf[-1], 2), '底面 v ∈ [2/4, 3/4]: ' + rowOf[-1]);
  assert.ok(inRow(rowOf[0], 1), '侧面 v ∈ [1/4, 2/4]: ' + rowOf[0]);
});

test('meshChunk: 薄块(引线)进实心通道, 无底面, 高度按 thin 缩放', () => {
  const m = loadMeshCore();
  const p = mkPack(1);
  p.set(3, 5, 3, m.B_FUSE);
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(quads(r.solid), 5); // pushThin 跳过底面
  const ys = new Set();
  for (let i=1; i<r.solid.positions.length; i+=3) ys.add(r.solid.positions[i]);
  assert.ok(ys.has(5) && ys.has(5 + 0.14), 'y ∈ {y, y+thin}: ' + [...ys]);
});

test('meshChunk: tint 来自注入的 hashRand — 0.5→0.98, 0→0.92', () => {
  const m = loadMeshCore();
  const base = m.BLOCKS[3].all; // [0.50,0.50,0.53]
  const p1 = mkPack(1); p1.set(1, 5, 1, 3);
  const r1 = m.MeshCore.meshChunk(p1, {hashRand: HR_HALF, tntTiles: 4});
  assert.ok(Math.abs(r1.solid.colors[0] - base[0]*0.98) < 1e-9);
  const p2 = mkPack(1); p2.set(1, 5, 1, 3);
  const r2 = m.MeshCore.meshChunk(p2, {hashRand: HR_ZERO, tntTiles: 4});
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
  for (let lx=0; lx<16; lx++) for (let lz=0; lz<16; lz++) p.set(lx, 0, lz, 2); // 泥土地
  const r = m.MeshCore.meshChunkLod(p, {step: 2});
  const n = 16/2; // 8×8 格
  const perim = 4*n; // 四条边各 n 格的向外裙边(角格两条都计)
  assert.strictEqual(quads(r.solid), n*n + perim, '64 顶面 + 32 周界裙边(内部格高等 → 无裙边)');
  const c = m.BLOCKS[2].all;
  assert.ok(Math.abs(r.solid.colors[0] - c[0]) < 1e-9 && Math.abs(r.solid.colors[2] - c[2]) < 1e-9);
  let maxY = 0;
  for (let i=1; i<r.solid.positions.length; i+=3) maxY = Math.max(maxY, r.solid.positions[i]);
  assert.strictEqual(maxY, 1, '最高点 = 地面高+1');
});

test('meshChunkLod: 高塔抬升所在格顶面, 对低邻格四面出裙边', () => {
  const m = loadMeshCore();
  const p = mkPack(0);
  for (let lx=0; lx<16; lx++) for (let lz=0; lz<16; lz++) p.set(lx, 0, lz, 2);
  for (let y=0; y<=2; y++) p.set(2, y, 2, 3); // 3 高石柱, 落 step=2 的格 (1,1)
  const r = m.MeshCore.meshChunkLod(p, {step: 2});
  const n = 16/2; const perim = 4*n;
  assert.strictEqual(quads(r.solid), n*n + 4 + perim, '64 顶面 + 塔格对低邻格 4 裙边 + 32 周界裙边');
  let maxY = 0;
  for (let i=1; i<r.solid.positions.length; i+=3) maxY = Math.max(maxY, r.solid.positions[i]);
  assert.strictEqual(maxY, 3, '塔格顶面 y = 2+1');
});

test('meshChunkLod: 薄块不算表面 — 引线塔不抬升格高', () => {
  const m = loadMeshCore();
  const p = mkPack(0);
  for (let lx=0; lx<16; lx++) for (let lz=0; lz<16; lz++) p.set(lx, 0, lz, 2);
  p.set(4, 1, 4, m.B_FUSE); // 贴地引线, 叠在泥土上
  const r = m.MeshCore.meshChunkLod(p, {step: 2});
  const n = 16/2; const perim = 4*n;
  assert.strictEqual(quads(r.solid), n*n + perim, '引线不产生裙边/抬升');
  const c = m.BLOCKS[2].all;
  assert.ok(Math.abs(r.solid.colors[0] - c[0]) < 1e-9, '表面色仍是泥土(引线被跳过)');
});

/* ============ 顶点光属性 (D3, 设计稿 §4.1) ============ */
/* 断言口径: 通道的 sky/block 数组与顶点等长, 值 = 等级/15;
   普通面取面朝向邻格光, 十字片/薄块取自身格, LOD 合并列天空二值 */

/* 按面法线收集四边形的 4 顶点序号(sky/block 是单标量属性, 下标=顶点序) */
function quadsByNormal(ch) {
  const map = new Map();
  for (let q=0; q<ch.indices.length; q+=6) {
    const v0 = ch.indices[q];
    const key = ch.normals[v0*3] + ',' + ch.normals[v0*3+1] + ',' + ch.normals[v0*3+2];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push([0, 1, 2, 3].map((i) => ch.indices[q+i]));
  }
  return map;
}
/* 同法线的全部四边形 × 全部顶点都必须等于期望值 */
const faceSkyEq = (ch, quads, want) => quads.every((qs) => qs.every((v) => Math.abs(ch.sky[v] - want) < 1e-9));
const faceBlkEq = (ch, quads, want) => quads.every((qs) => qs.every((v) => Math.abs(ch.block[v] - want) < 1e-9));
const s15 = (lvl) => lvl/15;

test('顶点光: 实心通道普通面取面朝向邻格光 — 六面各自取邻格的 sky/block', () => {
  const m = loadMeshCore();
  const p = mkPackL(1);
  p.set(1, 5, 1, 3); // 石头(内部左下角)
  /* 六个采样邻格给互异的光值(与剔面邻格同坐标): +Y 上 / −Y 下 / ±X / ±Z */
  p.setL(1, 6, 1, 10, 7); // 顶面邻格
  p.setL(1, 4, 1, 1, 2); // 底面邻格
  p.setL(0, 5, 1, 3, 4); // −X 邻格(border 圈内, 可读)
  p.setL(2, 5, 1, 5, 0); // +X 邻格
  p.setL(1, 5, 0, 6, 1); // −Z 邻格
  p.setL(1, 5, 2, 0, 9); // +Z 邻格(sky=0 = 深洞)
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.solid.sky.length, 24, '每顶点一份天空光');
  assert.strictEqual(r.solid.block.length, 24);
  const byN = quadsByNormal(r.solid);
  assert.ok(faceSkyEq(r.solid, byN.get('0,1,0'), s15(10)), '顶面取上邻格 sky=10');
  assert.ok(faceBlkEq(r.solid, byN.get('0,1,0'), s15(7)), '顶面取上邻格 block=7');
  assert.ok(faceSkyEq(r.solid, byN.get('0,-1,0'), s15(1)), '底面取下邻格 sky=1');
  assert.ok(faceBlkEq(r.solid, byN.get('0,-1,0'), s15(2)), '底面取下邻格 block=2');
  assert.ok(faceSkyEq(r.solid, byN.get('-1,0,0'), s15(3)), '−X 面取 border 圈邻格 sky=3');
  assert.ok(faceSkyEq(r.solid, byN.get('1,0,0'), s15(5)), '+X 面取邻格 sky=5');
  assert.ok(faceSkyEq(r.solid, byN.get('0,0,-1'), s15(6)), '−Z 面取邻格 sky=6');
  assert.ok(faceSkyEq(r.solid, byN.get('0,0,1'), s15(0)), '+Z 面取深洞邻格 sky=0');
  assert.ok(faceBlkEq(r.solid, byN.get('0,0,1'), s15(9)), '+Z 面取邻格 block=9');
});

test('顶点光: 玻璃/TNT/图集立方体面同样取邻格光(四通道同口径)', () => {
  const m = loadMeshCore();
  /* 玻璃 */
  let p = mkPackL(1);
  p.set(1, 5, 1, 18);
  p.setL(1, 6, 1, 12, 0); // 顶面邻格
  let r = m.MeshCore.meshChunk(p, OPT);
  assert.ok(faceSkyEq(r.glass, quadsByNormal(r.glass).get('0,1,0'), s15(12)), '玻璃顶面取邻格 sky=12');
  /* TNT */
  p = mkPackL(1);
  p.set(1, 5, 1, m.B_TNT);
  p.setL(1, 6, 1, 0, 13); // 顶面邻格: 火把级方块光
  r = m.MeshCore.meshChunk(p, OPT);
  assert.ok(faceBlkEq(r.tnt, quadsByNormal(r.tnt).get('0,1,0'), s15(13)), 'TNT 顶面取邻格 block=13');
  /* 图集立方体(石头入图集, 同 mesh-worker 口径) */
  p = mkPackL(1);
  p.set(1, 5, 1, 3);
  p.setL(1, 6, 1, 8, 6);
  r = m.MeshCore.meshChunk(p, {hashRand: HR_HALF, tntTiles: 4, atlas: {cols: 16, rows: 16, tiles: {3: 5}}});
  assert.ok(faceSkyEq(r.atlas, quadsByNormal(r.atlas).get('0,1,0'), s15(8)), '图集面取邻格 sky=8');
  assert.ok(faceBlkEq(r.atlas, quadsByNormal(r.atlas).get('0,1,0'), s15(6)), '图集面取邻格 block=6');
});

test('顶点光: 小盒与薄块取自身格 — 火把自身格 block=14 夜间自亮', () => {
  const m = loadMeshCore();
  /* 火把小盒: 火把(48, thin+wall)走图集专用小盒通道(悬空立式, 底面可见) */
  let p = mkPackL(1);
  p.set(1, 5, 1, m.B_TORCH);
  p.setL(1, 5, 1, 6, 14); // 自身格: 洞内 sky=6 · 火把自亮 block=14
  let r = m.MeshCore.meshChunk(p, {hashRand: HR_HALF, tntTiles: 4, atlas: {cols: 16, rows: 16, tiles: {48: 26}}});
  assert.ok(r.atlas && quads(r.atlas) === 6, '火把小盒 6 面(悬空底面可见)');
  assert.strictEqual(r.atlas.sky.length, 24);
  for (const v of r.atlas.sky) assert.ok(Math.abs(v - s15(6)) < 1e-9, '小盒全部顶点取自身格 sky=6');
  for (const v of r.atlas.block) assert.ok(Math.abs(v - s15(14)) < 1e-9, '小盒全部顶点取自身格 block=14');
  /* 薄块: 引线走实心通道 pushThin */
  p = mkPackL(1);
  p.set(3, 5, 3, m.B_FUSE);
  p.setL(3, 5, 3, 4, 11); // 自身格
  r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.solid.sky.length, 20); // 5 面 × 4 顶点
  for (const v of r.solid.sky) assert.ok(Math.abs(v - s15(4)) < 1e-9, '薄块全部顶点取自身格 sky=4');
  for (const v of r.solid.block) assert.ok(Math.abs(v - s15(11)) < 1e-9, '薄块全部顶点取自身格 block=11');
});

test('火把小盒几何: 插地立式居中贴地(2×10×2px) · 墙式整盒满贴墙面直立(用户拍板不外倾) · 双侧墙优先序', () => {
  const m = loadMeshCore();
  const ATLAS = {hashRand: HR_HALF, tntTiles: 4, atlas: {cols: 16, rows: 16, tiles: {48: 26}}};
  /* atlas 通道只含火把 → 全顶点统计(相对格原点取整) */
  const stat = (r)=>{
    const x0 = Math.floor(r.atlas.positions[0]); const z0 = Math.floor(r.atlas.positions[2]);
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    let minZ = Infinity; let maxZ = -Infinity;
    for (let i = 0; i < r.atlas.positions.length; i += 3) {
      const vx = r.atlas.positions[i] - x0; const vy = r.atlas.positions[i + 1];
      const vz = r.atlas.positions[i + 2] - z0;
      minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
      minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
      minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
    }
    return {minX, maxX, minY, maxY, minZ, maxZ};
  };
  /* 立式(MC §1.1 from[7,0,7]→to[9,10,9]): x/z∈[0.4375,0.5625] 居中 · y∈[5,5.625] 贴地 */
  let p = mkPackL(1);
  p.set(1, 5, 1, m.B_TORCH);
  p.set(1, 4, 1, 2); // 底座
  let r = m.MeshCore.meshChunk(p, ATLAS);
  assert.ok(quads(r.atlas) === 5, '立式 5 面(底面贴垫块剔除, MC cullface:down)');
  let s = stat(r);
  assert.ok(Math.abs(s.minX - 0.4375) < 1e-9 && Math.abs(s.maxX - 0.5625) < 1e-9, '立式 x∈[7,9]px 居中');
  assert.ok(Math.abs(s.minZ - 0.4375) < 1e-9 && Math.abs(s.maxZ - 0.5625) < 1e-9, '立式 z∈[7,9]px 居中');
  assert.ok(Math.abs(s.minY - 5) < 1e-9 && Math.abs(s.maxY - 5.625) < 1e-9, '立式 y∈[0,10]px 贴地');
  /* 墙火把(+x 墙, 用户拍板: 不外倾直接贴墙): 整盒满贴墙面 x∈[0.875,1] · 底抬 3.5px · 直立 */
  p = mkPackL(1);
  p.set(1, 5, 1, m.B_TORCH);
  p.set(2, 5, 1, 3); // +x 实心墙
  r = m.MeshCore.meshChunk(p, ATLAS);
  assert.ok(quads(r.atlas) === 5, '墙式 5 面(贴墙侧面与墙面共面剔除防 z-fight; 悬空底面可见)');
  s = stat(r);
  assert.ok(Math.abs(s.maxX - 1) < 1e-9 && Math.abs(s.minX - 0.875) < 1e-9, '整盒满贴墙面(2px 宽 x∈[0.875,1])');
  assert.ok(Math.abs(s.minY - 5.21875) < 1e-9 && Math.abs(s.maxY - 5.84375) < 1e-9,
      '底抬 3.5px · 直立不外倾(y 恰 10px 高, 顶底同界)');
  assert.ok(Math.abs(s.minZ - 0.4375) < 1e-9 && Math.abs(s.maxZ - 0.5625) < 1e-9, '墙式 z 向居中不变');
  /* 双侧墙 → 固定优先级取 +x(确定性, 与 cascade 同序) */
  p = mkPackL(1);
  p.set(1, 5, 1, m.B_TORCH);
  p.set(2, 5, 1, 3); // +x 墙
  p.set(0, 5, 1, 3); // -x 墙
  r = m.MeshCore.meshChunk(p, ATLAS);
  assert.ok(Math.abs(stat(r).maxX - 1) < 1e-9, '双侧墙取 +x(优先序首位)');
});

test('顶点光: 无光照载荷的 pack 回落全亮(sky=15/block=0) — 既有调用缺省兼容', () => {
  const m = loadMeshCore();
  const p = mkPack(1); // 不带 sky/block 字段
  p.set(1, 5, 1, 3);
  p.set(2, 5, 2, 18);
  p.set(3, 5, 3, m.B_TNT);
  const r = m.MeshCore.meshChunk(p, {hashRand: HR_HALF, tntTiles: 4, atlas: {cols: 16, rows: 16, tiles: {3: 5}}});
  for (const ch of [r.solid, r.glass, r.tnt, r.atlas]) {
    if (!ch) continue;
    assert.strictEqual(ch.sky.length, ch.positions.length/3, '每顶点一份');
    assert.strictEqual(ch.block.length, ch.positions.length/3);
    for (const v of ch.sky) assert.ok(Math.abs(v - 1) < 1e-9, '回落 sky 全亮=1');
    for (const v of ch.block) assert.strictEqual(v, 0, '回落 block=0');
  }
});

test('顶点光: LOD 通道仅天空二值 0/15 + block 恒 0 — 远处夜色统一变暗', () => {
  const m = loadMeshCore();
  /* 平地: 顶面之上的格 sky=15 → 二值 15 */
  const p = mkPack(0);
  p.sky = new Uint8Array(p.w*p.d*48);
  for (let lx=0; lx<16; lx++) {
    for (let lz=0; lz<16; lz++) {
      p.set(lx, 0, lz, 2);
      p.sky[(1*p.d + lz)*p.w + lx] = 15; // 地表之上
    }
  }
  /* 模拟一格被顶棚罩住(浮空顶棚的阴影落在地表之上): 该合并格的采样列
     (合并格首列 (4,4), §4.1 一格一值)地表之上格 sky=3 → 二值 0 */
  p.set(5, 0, 5, 3);
  p.sky[(1*p.d + 4)*p.w + 4] = 3;
  const r = m.MeshCore.meshChunkLod(p, {step: 2});
  assert.strictEqual(r.solid.block.length, r.solid.positions.length/3);
  for (const v of r.solid.block) assert.strictEqual(v, 0, 'LOD aBlock 恒 0(火把点光不进 LOD)');
  /* 按四边形断言(顶点坐标在格边界与邻格裙边共点, 不能按位置归属): 每面
     内部四顶点同值(一格一值), 被罩合并格的顶面恰一面全暗, 其余全亮 */
  let dark = 0; let lit = 0;
  for (let q=0; q<r.solid.indices.length; q+=6) {
    const vs = [0, 1, 2, 3].map((i) => r.solid.sky[r.solid.indices[q+i]]);
    assert.ok(vs.every((v) => Math.abs(v - vs[0]) < 1e-9), '同一四边形顶点必须同值(合并列一格一值)');
    if (vs[0] < 1e-9) dark++; else if (Math.abs(vs[0] - 1) < 1e-9) lit++;
    else assert.fail('LOD 天空光必须二值 0/15, 实得 ' + vs[0]);
  }
  assert.strictEqual(dark, 1, '被罩格顶面恰一面全暗(该格无裙边: 邻格同高)');
  assert.ok(lit >= 90, '其余面全亮: ' + lit);
  /* 无载荷 LOD 同样回落全亮 */
  const p2 = mkPack(0);
  for (let lx=0; lx<16; lx++) for (let lz=0; lz<16; lz++) p2.set(lx, 0, lz, 2);
  const r2 = m.MeshCore.meshChunkLod(p2, {step: 2});
  for (const v of r2.solid.sky) assert.ok(Math.abs(v - 1) < 1e-9, 'LOD 无载荷回落全亮');
});

/* ============ 薄块分色 (D3 兑现 D6 惰性 top 字段, 设计稿 §7.1) ============ */

test('faceColor: 顶面优先取显式 top(覆盖 all), 其余面仍取 all — 床红毯/床架分色的单一权威', () => {
  const m = loadMeshCore();
  /* 合成"床形"数据(D6 的 B_BED 同构: top=亮红毯 / all=深红床架), 测试自带
     不依赖集成分支的方块表; 既有方块(如引线)只有 all → 行为零变化 */
  m.BLOCKS[99] = {name: '试床', top: [0.90, 0.30, 0.30], all: [0.75, 0.22, 0.22], thin: 0.55, solid: false};
  assert.strictEqual(m.faceColor(99, [0, 1, 0]), m.BLOCKS[99].top, '顶面 → top(红毯)');
  assert.strictEqual(m.faceColor(99, [0, 0, 1]), m.BLOCKS[99].all, '侧面 → all(床架)');
  assert.strictEqual(m.faceColor(99, [0, -1, 0]), m.BLOCKS[99].all, '底面 → all(薄块无底面, 数据口径统一)');
  assert.strictEqual(m.faceColor(m.B_FUSE, [0, 1, 0]), m.BLOCKS[m.B_FUSE].all, '无 top 的方块顶面仍取 all(存量零变化)');
});

test('薄块分色: pushThin 顶面画 top(红毯) · 侧面画 all(床架), tint 照乘', () => {
  const m = loadMeshCore();
  m.BLOCKS[99] = {name: '试床', top: [0.90, 0.30, 0.30], all: [0.75, 0.22, 0.22], thin: 0.55, solid: false};
  const p = mkPack(1);
  p.set(1, 5, 1, 99);
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(quads(r.solid), 5, '扁盒 5 面(跳底)');
  const tint = 0.98; // HR_HALF → 0.92 + 0.5*0.12
  const cEq = (v, c) => Math.abs(v - c*tint) < 1e-9;
  for (const [key, want] of [['0,1,0', m.BLOCKS[99].top], ['1,0,0', m.BLOCKS[99].all],
    ['-1,0,0', m.BLOCKS[99].all], ['0,0,1', m.BLOCKS[99].all], ['0,0,-1', m.BLOCKS[99].all]]) {
    const qs = quadsByNormal(r.solid).get(key);
    assert.ok(qs && qs.length === 1, '该向恰一面: ' + key);
    for (const q of qs) {
      for (const v of q) {
        const label = key + ' 面色 = ' + (want === m.BLOCKS[99].top ? 'top' : 'all') + '×tint';
        assert.ok(cEq(r.solid.colors[v*3], want[0]) && cEq(r.solid.colors[v*3+1], want[1]) &&
            cEq(r.solid.colors[v*3+2], want[2]), label);
      }
    }
  }
});

/* ============ 竖直薄板 pushPane(门/玻璃板, docs/door-window-design.md §5) ============ */

/* pane 测试用注入 atlas: tiles 63~66 → 门板两格图, 67 → 玻璃板图 */
const paneOpt = () => ({hashRand: HR_HALF, tntTiles: 4,
  atlas: {cols: 16, rows: 16, tiles: {
    [loadMeshCoreOnce().B_DOOR]: 40, [loadMeshCoreOnce().B_DOOR_TOP]: 41,
    [loadMeshCoreOnce().B_DOOR_OPEN]: 40, [loadMeshCoreOnce().B_DOOR_TOP_OPEN]: 41,
    [loadMeshCoreOnce().B_GLASS_PANE]: 42}}});
let M_ONCE = null;
function loadMeshCoreOnce() {
  if (!M_ONCE) M_ONCE = loadMeshCore();
  return M_ONCE;
}

test('门·降级路径: 无 atlas 注入时 pane 分支跳过, 门回落实心立方通道(存量行为)', () => {
  const m = loadMeshCoreOnce();
  const p = mkPack(1);
  p.set(3, 5, 3, m.B_DOOR);
  const r = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(r.atlas, null, '无 atlas 注入 → 无图集通道(降级)');
  assert.strictEqual(quads(r.solid), 6, '门回落为实心立方 6 面(LOD 同口径)');
});

test('门·关/开: 图集通道几何 — 闭=板格内居中(2026-10-28 反转修复) · 开=板贴西缘(绕北端 90°)', () => {
  const m = loadMeshCoreOnce();
  const opt = paneOpt();
  const pC = mkPack(1);
  pC.set(3, 5, 3, m.B_DOOR);
  const rc = m.MeshCore.meshChunk(pC, opt);
  assert.strictEqual(quads(rc.atlas), 6, '关门 6 面(2 大面+4 边条)');
  assert.strictEqual(rc.solid, null, '门不进实心通道');
  const zs = new Set();
  for (let i=0; i<rc.atlas.positions.length; i+=3) zs.add(rc.atlas.positions[i+2].toFixed(4));
  /* bx=99(border=1), lx=3 → wx=102; 居中 z ∈ {102+13/32, 102+19/32} */
  const half = 0.1875 / 2;
  assert.deepStrictEqual([...zs].sort(),
      [(102 + 0.5 - half).toFixed(4), (102 + 0.5 + half).toFixed(4)], '关门板体居中(格心 ±3/32)');
  const pO = mkPack(1);
  pO.set(3, 5, 3, m.B_DOOR_OPEN);
  const ro = m.MeshCore.meshChunk(pO, opt);
  assert.strictEqual(quads(ro.atlas), 6, '开门 6 面');
  const xs = new Set();
  for (let i=0; i<ro.atlas.positions.length; i+=3) xs.add(ro.atlas.positions[i].toFixed(4));
  assert.deepStrictEqual([...xs].sort(), ['102.0000', '102.1875'], '开门板转到西缘(x 0..3/16)');
});

test('门·开铰链现算(2026-10-28): 东邻实心 → 板贴东缘(贴墙站) · 西邻实心 → 贴西缘', () => {
  const m = loadMeshCoreOnce();
  const opt = paneOpt();
  /* 东邻石头: 开门板贴东缘 x ∈ {102+13/16, 103} —— 贴墙站不悬在通道正中 */
  const pE = mkPack(1);
  pE.set(3, 5, 3, m.B_DOOR_OPEN);
  pE.set(4, 5, 3, 3);
  const re = m.MeshCore.meshChunk(pE, opt);
  const xe = new Set();
  for (let i = 0; i < re.atlas.positions.length; i += 3) xe.add(re.atlas.positions[i].toFixed(4));
  assert.deepStrictEqual([...xe].sort(),
      [(102 + 1 - 0.1875).toFixed(4), (102 + 1).toFixed(4)], '东邻实心 → 板贴东缘');
  /* 西邻石头: 维持贴西缘 x ∈ {102, 102.1875} */
  const pW = mkPack(1);
  pW.set(3, 5, 3, m.B_DOOR_OPEN);
  pW.set(2, 5, 3, 3);
  const rw = m.MeshCore.meshChunk(pW, opt);
  const xw = new Set();
  for (let i = 0; i < rw.atlas.positions.length; i += 3) xw.add(rw.atlas.positions[i].toFixed(4));
  assert.deepStrictEqual([...xw].sort(),
      ['102.0000', '102.1875'], '西邻实心 → 板贴西缘(默认铰链不变)');
});

test('门·面光取面朝向邻格(2026-10-27 修): 关门自身格光恒 0 — 两大面各吃邻格光(整扇黑病根)', () => {
  const m = loadMeshCoreOnce();
  const p = mkPackL(1);
  p.set(3, 5, 3, m.B_DOOR);
  p.setL(3, 5, 3, 0, 0); /* 自身格: 关门 opaque 挡光 → 两通道恒 0(取自身格=整扇黑的病根) */
  p.setL(2, 5, 3, 15, 0); /* 西邻空气格: 天空满光 */
  p.setL(4, 5, 3, 7, 3); /* 东邻空气格: 天空 7 / 块光 3 */
  const r = m.MeshCore.meshChunk(p, {hashRand: HR_HALF, tntTiles: 4, atlas: paneOpt().atlas});
  const byFace = {};
  for (let v = 0; v < r.atlas.sky.length; v++) {
    const key = r.atlas.normals[v*3] + ',' + r.atlas.normals[v*3+1] + ',' + r.atlas.normals[v*3+2];
    byFace[key] = byFace[key] || new Set();
    byFace[key].add(Math.round(r.atlas.sky[v]*15) + '/' + Math.round(r.atlas.block[v]*15));
  }
  assert.deepStrictEqual([...byFace['-1,0,0']], ['15/0'], '西大面吃西邻格光(非自身格 0)');
  assert.deepStrictEqual([...byFace['1,0,0']], ['7/3'], '东大面吃东邻格光(每面独立取样)');
});

test('玻璃板: 孤板=2px 中柱 4 面 · 东西有邻=大面横跨全格 · 邻实心也连接', () => {
  const m = loadMeshCoreOnce();
  const opt = paneOpt();
  /* 孤板 */
  const p0 = mkPack(1);
  p0.set(3, 5, 3, m.B_GLASS_PANE);
  const r0 = m.MeshCore.meshChunk(p0, opt);
  assert.strictEqual(quads(r0.atlas), 4, '孤板 4 面(±z/±x 各一)');
  const rng = (ch) => {
    const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
    for (let i=0; i<ch.positions.length; i+=3) {
      for (let a=0; a<3; a++) {
        lo[a] = Math.min(lo[a], ch.positions[i+a]);
        hi[a] = Math.max(hi[a], ch.positions[i+a]);
      }
    }
    return {lo, hi};
  };
  const g0 = rng(r0.atlas);
  assert.ok(Math.abs(g0.lo[0] - 102.4375) < 1e-9 && Math.abs(g0.hi[0] - 102.5625) < 1e-9,
      '孤板 x 跨度 = 2px 中柱(7/16..9/16)');
  assert.ok(Math.abs(g0.lo[2] - 102.4375) < 1e-9 && Math.abs(g0.hi[2] - 102.5625) < 1e-9,
      '孤板 z 跨度 = 2px 中柱');
  /* 东邻玻璃板: 本板大面延伸到格缘(x=103), 邻板中柱东缘 103.5625 */
  const p1 = mkPack(1);
  p1.set(3, 5, 3, m.B_GLASS_PANE);
  p1.set(4, 5, 3, m.B_GLASS_PANE);
  const g1 = rng(m.MeshCore.meshChunk(p1, opt).atlas);
  assert.ok(Math.abs(g1.hi[0] - 103.5625) < 1e-9, '东连玻璃板 → 大面延伸到格缘(邻板中柱 103.5625)');
  assert.strictEqual(quads(m.MeshCore.meshChunk(p1, opt).atlas), 8, '两块板各 4 面');
  /* 邻实心(石头)同样连接 */
  const p2 = mkPack(1);
  p2.set(3, 5, 3, m.B_GLASS_PANE);
  p2.set(4, 5, 3, 3); // 石头
  const g2 = rng(m.MeshCore.meshChunk(p2, opt).atlas);
  assert.ok(Math.abs(g2.hi[0] - 103) < 1e-9, '东邻实心方块也连接(MC 口径)');
  /* 南北无邻: z 仍是中柱 */
  assert.ok(Math.abs(g2.lo[2] - 102.4375) < 1e-9, '未连方向保持中柱');
});

test('剔面规则: 实心方块贴门格的面不剔除(门是薄板, 面被剔会漏出墙洞)', () => {
  const m = loadMeshCoreOnce();
  const p = mkPack(1);
  p.set(1, 5, 1, 3); // 石头
  const alone = m.MeshCore.meshChunk(p, OPT);
  assert.strictEqual(quads(alone.solid), 6, '孤立石头 6 面');
  p.set(2, 5, 1, m.B_DOOR); // 东侧放门(关门态 solid)
  const withDoor = m.MeshCore.meshChunk(p, {hashRand: HR_HALF, tntTiles: 4,
    atlas: paneOpt().atlas});
  assert.strictEqual(quads(withDoor.solid), 6, '邻格是门 → 石头面保留(pane 不算遮挡体)');
  assert.strictEqual(quads(withDoor.atlas), 6, '门本体照常出图集通道');
});
