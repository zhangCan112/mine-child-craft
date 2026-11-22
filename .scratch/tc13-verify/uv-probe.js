// T-C13 绿方自证: 顶面 quad UV 实际值 vs tileUV(64) 矩形(只读探针)
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const eng = vm.createContext({console});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/mesh-core.js', 'js/texture-atlas.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const t = vm.runInContext(`({MeshCore, TextureAtlas, BLOCKS, B_CAMPFIRE, B_CAMPFIRE_OUT})`, eng);
const w = 17; const d = 17; const h = 12;
const cells = new Uint8Array(w * d * h);
const sky = new Uint8Array(w * d * h).fill(15);
const blk = new Uint8Array(w * d * h);
const set = (x, y, z, id) => { cells[(y * d + z) * w + x] = id; };
set(8, 6, 8, t.B_CAMPFIRE);
const pack = {cells, sky, block: blk, w, d, h, border: 1, bx: 0, bz: 0, yMax: h - 1};
const r = t.MeshCore.meshChunk(pack, {hashRand: () => 0, tntTiles: [], atlas: t.TextureAtlas.layout});
const tileUV = (idx) => {
  const c = idx % 16; const rr = Math.floor(idx / 16);
  return [c / 16, (16 - 1 - rr) / 16, (c + 1) / 16, (16 - rr) / 16];
};
console.log('tileUV(64)=', tileUV(64), ' tileUV(65)=', tileUV(65));
/* 找顶面 quad: normal [0,1,0] */
let n = 0;
for (let q = 0; q * 4 * 3 < r.atlas.positions.length; q++) {
  const nx = r.atlas.normals[q * 12]; const ny = r.atlas.normals[q * 12 + 1]; const nz = r.atlas.normals[q * 12 + 2];
  const uvs = [];
  for (let c = 0; c < 4; c++) uvs.push([r.atlas.uvs[q * 8 + c * 2], r.atlas.uvs[q * 8 + c * 2 + 1]]);
  console.log('quad ' + q + ' n=(' + nx + ',' + ny + ',' + nz + ') uv=' + JSON.stringify(uvs));
  if (++n > 6) break;
}
