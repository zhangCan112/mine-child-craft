// T-C13 绿方自证: 我的画师画稿 vs 红测基准画稿逐字符 diff(只读, 不改生产代码)
'use strict';
const fs = require('node:fs');
function art(src, name) {
  const m = src.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
  return m[1].match(/'[^']+'/g).map((s) => s.slice(1, -1));
}
const T = fs.readFileSync('test/texture-atlas.test.js', 'utf8');
const J = fs.readFileSync('js/texture-atlas.js', 'utf8');
let bad = 0;
for (const [tn, jn] of [
  ['CF_LIT_TOP_ART', 'CF_TOP64_ART'],
  ['CF_LIT_SIDE_ART', 'CF_SIDE65_ART'],
  ['CF_OUT_TOP_ART', 'CF_OUT_TOP66_ART'],
  ['CF_OUT_SIDE_ART', 'CF_OUT_SIDE67_ART'],
]) {
  const a = art(T, tn); const b = art(J, jn);
  console.log('== ' + tn + ' vs ' + jn + ' rows=' + a.length + '/' + b.length);
  a.forEach((r, i) => {
    if (r !== b[i]) { bad++; console.log('  r' + i + ' 测=' + JSON.stringify(r) + ' 我=' + JSON.stringify(b[i])); }
  });
}
console.log(bad === 0 ? '四画稿逐字一致' : '共 ' + bad + ' 行不一致');
