'use strict';
/* 网格化 Worker (js/mesh-worker.js) 胶水单测 — node --test (零依赖)
   运行: node --test test/mesh-worker.test.js
   Worker 薄胶水只做三件事: importScripts 加载纯核心 / 消息重组 pack /
   回传结果。本测试以 importScripts+self+postMessage 桩精确复刻
   DedicatedWorker 全局, 校验消息协议(跨线程契约)与纯核心接线。
   消息协议(与 world.js serveChunkKey 对应):
   请求 {gen,cx,cz,token,kind,cells:ArrayBuffer,w,d,h,border,bx,bz,yMax}
   响应 {gen,cx,cz,token,kind,res} — res 为 MeshCore 四通道(solid/glass/
   tnt/atlas)/LOD 裸数组 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadWorker() {
  const out = [];
  const transfers = [];
  const sandbox = {
    console,
    postMessage: (msg, transfer) => {
      out.push(msg);
      transfers.push(transfer || []);
    }, // Worker 出站信箱(含 transfer 清单)
  };
  sandbox.self = sandbox; // DedicatedWorkerGlobalScope.self
  sandbox.importScripts = function(...files) { // 同目录经典脚本, 共享词法环境
    for (const f of files) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
    }
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'mesh-worker.js'), 'utf8'),
      ctx, {filename: 'mesh-worker.js'});
  return {onmessage: sandbox.onmessage, out, transfers};
}

/* 请求消息构造: 与 voxel.js packChunkData 输出同构(cells 随消息转移) */
function mkMsg(kind) {
  const border = kind === 'full' ? 1 : 0;
  const w = 16 + 2*border; const d = 16 + 2*border;
  const cells = new Uint8Array(w*d*48);
  const set = (lx, y, lz, id)=>{
    cells[(y*d+lz)*w+lx] = id;
  };
  if (kind === 'full') {
    set(border+1, 5, border+1, 3); // 内部一块石头
  } else {
    for (let lx=0; lx<16; lx++) for (let lz=0; lz<16; lz++) set(lx, 0, lz, 2); // 平地
  }
  return {gen: 7, cx: 2, cz: 3, token: 1, kind, cells: cells.buffer,
    w, d, h: 48, border, bx: 32-border, bz: 48-border, yMax: 5};
}

test('mesh-worker: full 请求 → 纯核心四通道 + 协议字段原样回程', () => {
  const w = loadWorker();
  w.onmessage({data: mkMsg('full')});
  assert.strictEqual(w.out.length, 1);
  const r = w.out[0];
  assert.strictEqual(r.gen, 7);
  assert.strictEqual(r.cx, 2);
  assert.strictEqual(r.cz, 3);
  assert.strictEqual(r.token, 1);
  assert.strictEqual(r.kind, 'full');
  /* 石头(T9 起入方块图集): 走 atlas 通道, UV 经 TypedArray 转移回传 */
  assert.strictEqual(r.res.solid, null);
  assert.strictEqual(r.res.glass, null);
  assert.strictEqual(r.res.tnt, null);
  assert.strictEqual(r.res.atlas.indices.length/6, 6); // 单方块 6 面
  /* UV 走 Float32Array transfer(vm 沙箱跨 realm, instanceof 不可用, 用 toString 判型) */
  assert.strictEqual(Object.prototype.toString.call(r.res.atlas.uvs), '[object Float32Array]');
  assert.strictEqual(r.res.atlas.uvs.length, 24*2); // 24 顶点 UV
});

test('mesh-worker: lod 请求 → 降采样粗网格(step 取 config 的 VIEW.lodStep)', () => {
  const w = loadWorker();
  w.onmessage({data: mkMsg('lod')});
  const r = w.out[0];
  assert.strictEqual(r.kind, 'lod');
  assert.ok(r.res.solid, '平地必有粗网格');
  const n = 16/2; const perim = 4*n;
  assert.strictEqual(r.res.solid.indices.length/6, n*n + perim); // 64 顶面+32 周界裙边
});

/* ============ 光照圈协议 (D3, 设计稿 §3.4/§4.1) ============ */

test('mesh-worker: 请求携 sky/block 光照圈 → 顶点光随网格回传(火把自身格 block=14)', () => {
  const w = loadWorker();
  const m = mkMsg('full');
  /* 火把(48, thin)入图集十字通道 — 自身格光照 sky=6 · block=14(§4.1 取自身格) */
  const w18 = 18; const d18 = 18;
  const sky = new Uint8Array(w18*d18*48);
  const blk = new Uint8Array(w18*d18*48);
  const base = (5*d18 + (1+1))*w18 + (1+1);
  sky[base] = 6; blk[base] = 14;
  m.cells = new Uint8Array(m.cells); // mkMsg 的 buffer → 视图后重写该格
  m.cells[base] = 48;
  m.sky = sky.buffer; m.block = blk.buffer;
  w.onmessage({data: m});
  const r = w.out[0];
  assert.ok(r.res.atlas, '火把走图集十字面片通道');
  const isF32 = (a) => Object.prototype.toString.call(a) === '[object Float32Array]';
  assert.ok(isF32(r.res.atlas.sky) && isF32(r.res.atlas.block), '顶点光是 Float32Array(transfer 回传)');
  assert.strictEqual(r.res.atlas.sky.length, 16, '十字片 4 面 × 4 顶点');
  /* Float32Array 传输量化(6/15 → 0.400000006): 容差 1e-6, 与精度无关的口径断言 */
  for (const v of r.res.atlas.sky) assert.ok(Math.abs(v - 6/15) < 1e-6, '十字片全部顶点取自身格 sky=6');
  for (const v of r.res.atlas.block) assert.ok(Math.abs(v - 14/15) < 1e-6, '十字片全部顶点取自身格 block=14(夜间自亮)');
  /* transfer 清单含顶点光缓冲(回传网格 sky/block 的 backing buffer, 与 positions 同款零拷贝口径) */
  const bufs = w.transfers[0];
  assert.ok(bufs.includes(r.res.atlas.sky.buffer) && bufs.includes(r.res.atlas.block.buffer),
      'sky/block 缓冲随 transfer 清单零拷贝回传');
});

test('mesh-worker: 旧协议消息(无 sky/block) → 回落全亮, 不炸', () => {
  const w = loadWorker();
  w.onmessage({data: mkMsg('full')}); // 不带 sky/block 字段
  const r = w.out[0];
  assert.ok(r.res.atlas, '网格照常产出');
  for (const v of r.res.atlas.sky) assert.ok(Math.abs(v - 1) < 1e-9, '无载荷回落 sky 全亮=1');
  for (const v of r.res.atlas.block) assert.strictEqual(v, 0, '无载荷回落 block=0');
});
