// T-C13 复验 · 运行时形状核实(真 vm 装载)
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = vm.createContext({console});
for (const f of ['config.js', 'texture-atlas.js', 'mesh-core.js']) {
  vm.runInContext(fs.readFileSync(path.join('js', f), 'utf8'), ctx, {filename: f});
}
vm.runInContext('globalThis.__t = { TextureAtlas, BLOCKS, MeshCore, B_CAMPFIRE, B_CAMPFIRE_OUT };', ctx);
const t = ctx.__t;
console.log('count:', t.TextureAtlas.count, '(判据: 68)');
console.log('layout cols:', t.TextureAtlas.layout.cols, 'tiles:', t.TextureAtlas.layout.tiles);
console.log('BLOCKS[81].atlas:', JSON.stringify(t.BLOCKS[81].atlas || t.BLOCKS[81].tile || t.BLOCKS[81]));
console.log('BLOCKS[82].atlas:', JSON.stringify(t.BLOCKS[82].atlas || t.BLOCKS[82].tile || t.BLOCKS[82]));
/* atlasTileOf 分面消费在模块闭包内——语义由 texture-atlas.test.js 的 mesh 消费端断言覆盖,
   本脚本只核数据面形状 */
/* paintAll 跑两遍确定性 */
const A1 = t.TextureAtlas.paintAll(), A2 = t.TextureAtlas.paintAll();
const same = Buffer.from(A1.pixels.buffer, A1.pixels.byteOffset, A1.pixels.length)
    .equals(Buffer.from(A2.pixels.buffer, A2.pixels.byteOffset, A2.pixels.length));
console.log('paintAll 确定性:', same ? '两次逐字节一致 OK' : '不一致 !!');
console.log('A 尺寸:', A1.w + 'x' + A1.h);
