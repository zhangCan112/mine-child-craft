'use strict';
/* T1b 恒等分支金标捕获(改动前现码真值) — tdd-engineer 2026-11-16
   fixture = 门额牌(80) @(3,5,3) + 横梁石(3) @(3,4,3), 东西邻空(home 双牌形态:
   牌贴横梁·cullDown 生效); 注入 atlas 形状仿 texture-atlas.js:851 真条目
   {side/back/top/bottom}(格号合成: side=26 镇徽/back=27 木底/bottom=28/top=29)。
   跑在未改动的 mesh-core.js 上, 逐数组 Array.from 摊平进宿主域(§7.1),
   输出 JSON 字面量供测试文件嵌入。 */
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({console});
for (const f of ['config.js', 'mesh-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
}
vm.runInContext('globalThis.__m = {MeshCore, B_GATE_SIGN};', ctx);
const m = ctx.__m;

const w = 18; const d = 18; const h = 48;
const p = {
  cells: new Uint8Array(w * d * h), w, d, h, border: 1,
  bx: 99, bz: 99, yMax: 5,
};
const set = (lx, y, lz, id) => { p.cells[(y * d + lz) * w + lx] = id; };
set(3, 5, 3, m.B_GATE_SIGN); // 牌
set(3, 4, 3, 3); // 横梁(脚下 solid → 底面剔除, home 形态)

const ATLAS = {hashRand: () => 0.5, tntTiles: 4, atlas: {cols: 16, rows: 16, tiles: {
  [m.B_GATE_SIGN]: {side: 26, back: 27, bottom: 28, top: 29}}}};
const r = m.MeshCore.meshChunk(p, ATLAS);

const flat = (a) => Array.from(a);
console.log(JSON.stringify({
  n: r.atlas.n,
  positions: flat(r.atlas.positions),
  uvs: flat(r.atlas.uvs),
  normals: flat(r.atlas.normals),
  indices: flat(r.atlas.indices),
  sky: flat(r.atlas.sky),
  block: flat(r.atlas.block),
}, null, 1));
