// v1.9 双源对撞: 定稿文档 char art vs render.js 内抄录数组, 逐字比对
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const OUT = __dirname;
const doc = fs.readFileSync(path.join(OUT, '..', '..', '..', 'docs', 'design', 'campfire-visual-spec.md'), 'utf8');
const script = fs.readFileSync(path.join(OUT, 'render.js'), 'utf8');

/* 按行扫文档, 收集连续的 16 字符单引号行序列 */
const lines = doc.split(/\r?\n/);
const blocks = [];
let cur = [];
for (const l of lines) {
  const m = l.match(/^'(.{16})'$/);
  if (m) cur.push(m[1]);
  else if (cur.length) { blocks.push(cur); cur = []; }
}
if (cur.length) blocks.push(cur);
console.log('文档中画稿块数: ' + blocks.length + '(行数: ' + blocks.map((b) => b.length).join(',') + ')');

/* 从脚本提取六个数组 */
function arr(name) {
  const m = script.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
  return m[1].match(/'[^']+'/g).map((s) => s.slice(1, -1));
}
const mine = {
  TOP64: arr('TOP64'), SIDE65: arr('SIDE65'), OTOP66: arr('OTOP66'),
  OSIDE67: arr('OSIDE67'), OLD62: arr('OLD62'), OLD63: arr('OLD63'),
};
let ok = 0;
for (const [name, rows] of Object.entries(mine)) {
  const hit = blocks.find((b) => b.length === rows.length && b.every((r, i) => r === rows[i]));
  console.log(name + ': ' + (hit ? '与文档逐字一致 OK' : '!! 未逐字匹配——明细:'));
  if (!hit) {
    for (const [bi, b] of blocks.entries()) {
      if (b.length !== rows.length) { console.log('  块' + bi + ' 行数 ' + b.length + ' vs 脚本 ' + rows.length); continue; }
      let diff = 0;
      b.forEach((r, i) => { if (r !== rows[i]) { diff++; console.log('  块' + bi + ' r' + i + ' 文档=' + JSON.stringify(r) + ' 脚本=' + JSON.stringify(rows[i])); } });
      if (!diff) console.log('  块' + bi + ' 内容一致但未命中?');
    }
  } else ok++;
}
console.log('比对结果: ' + ok + '/6 逐字一致');
