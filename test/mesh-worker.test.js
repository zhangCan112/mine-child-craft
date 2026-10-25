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
  const sandbox = {
    console,
    postMessage: (msg) => out.push(msg), // Worker 出站信箱
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
  return {onmessage: sandbox.onmessage, out};
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

test('mesh-worker: levels 水位通道随消息转移, 流动水顶面按水位缩放(liquid D7 协议)', () => {
  const w = loadWorker();
  const msg = mkMsg('full');
  const border = 1;
  const wCells = new Uint8Array(msg.cells);
  const levels = new Uint8Array(wCells.length);
  const ww = msg.w; const dd = msg.d;
  const at = (lx, y, lz)=> (y*dd+lz)*ww+lx;
  wCells[at(border+3, 5, border+3)] = 24; // 水 lv7(最弱流动)
  levels[at(border+3, 5, border+3)] = 7;
  wCells[at(border+8, 5, border+8)] = 24; // 水 lv0(源, levels 缺 0)
  msg.cells = wCells.buffer;
  msg.levels = levels.buffer;
  w.onmessage({data: msg});
  const r = w.out[0];
  assert.ok(r.res.glass, '水走玻璃通道');
  let maxY = 0;
  for (let i = 1; i < r.res.glass.positions.length; i += 3) maxY = Math.max(maxY, r.res.glass.positions[i]);
  assert.ok(Math.abs(maxY - (5 + 8 / 9)) < 1e-6, '源顶面 8/9(上格), lv7 那格只到 1/9, 实测 ' + maxY);
});
