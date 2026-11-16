'use strict';
/* 金标 JSON → 测试文件可嵌入的字面量片段(机械格式化, 防手工转写误差) */
const fs = require('fs');
const g = JSON.parse(fs.readFileSync('.scratch/t1b-golden.json', 'utf8'));
const row = (a, n) => {
  let s = '';
  for (let i = 0; i < a.length; i += n) {
    s += '    ' + a.slice(i, i + n).join(', ') + ',\n';
  }
  return s;
};
let out = '/* T1b 恒等分支金标(独立真值源): 改动前现码(0e253b5)对 fixture 的逐字节输出,\n' +
    '   由 .scratch/t1b-golden-capture.js 机械捕获生成 — 手改即废证 */\n';
/* 一面一行: positions/normals 12(=4 顶点×3) · uvs 8 · indices 6 · sky/block 4 */
const WIDTH = {positions: 12, uvs: 8, normals: 12, indices: 6, sky: 4, block: 4};
for (const k of Object.keys(WIDTH)) {
  out += 'const GOLD_' + k.toUpperCase() + ' = [\n' + row(g[k], WIDTH[k]) + '  ];\n';
}
fs.writeFileSync('.scratch/t1b-golden-literal.txt', out, 'utf8');
console.log('written, chars:', out.length);
