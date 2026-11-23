'use strict';
/* T-C6 诊断: 列出生成页里的相对路径引用(验证子路径 404 假设) — 一次性装具 */
const fs = require('node:fs');
const html = fs.readFileSync(__dirname + '/tc6-bench.html', 'utf8');
const refs = [];
const re = /(?:src|href)="([^"#][^"]*)"/g;
let m;
while ((m = re.exec(html))) {
  const s = m[1];
  if (!s.startsWith('http') && !s.startsWith('/')) refs.push(s);
}
console.log('relative refs (' + refs.length + '):');
console.log(refs.join('\n'));
