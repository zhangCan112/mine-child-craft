// T-C13-R1 绿面自证: test 与 js 两侧九个 art 常量逐字符机械 diff(不经会话转写判断)
'use strict';
const fs = require('node:fs');
const NAMES = [
  'CF_LOG_END68_ART', 'CF_LOG_SIDE69_ART', 'CF_TOP_LIT70_ART', 'CF_SIDE_LIT71_ART',
  'CF_TOP_OUT72_ART', 'CF_SIDE_OUT73_ART', 'CF_FLAME74_ART', 'CF_FLAME75_ART', 'CF_FLAME76_ART',
];
const rowsOf = (src, name) => {
  const m = src.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
  if (!m) return null;
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
};
const testSrc = fs.readFileSync('test/texture-atlas.test.js', 'utf8');
const jsSrc = fs.readFileSync('js/texture-atlas.js', 'utf8');
let bad = 0;
for (const name of NAMES) {
  const a = rowsOf(testSrc, name);
  const b = rowsOf(jsSrc, name);
  if (!a || !b || a.length !== 16 || b.length !== 16) {
    console.log('NG ' + name + ': 提取失败或行数非 16 (test=' + (a && a.length) + ' js=' + (b && b.length) + ')');
    bad++; continue;
  }
  const diff = [];
  for (let y = 0; y < 16; y++) if (a[y] !== b[y]) diff.push('r' + y + ': test=' + a[y] + ' js=' + b[y]);
  if (diff.length) { console.log('NG ' + name + '\n' + diff.join('\n')); bad++; }
  else console.log('OK ' + name);
}
console.log(bad === 0 ? '9/9 OK' : bad + ' NG');
process.exit(bad === 0 ? 0 : 1);
