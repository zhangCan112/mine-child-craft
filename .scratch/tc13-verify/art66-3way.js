// T-C13 绿方自证: spec §4.3 的 66 画稿 vs 红测 CF_OUT_TOP_ART vs v19-review/render.js OTOP66
// 三方逐行比对(只读), 判定 r9 归属
'use strict';
const fs = require('node:fs');
function rows(src) {
  return src.match(/'[^']+'/g).map((s) => s.slice(1, -1));
}
const spec = fs.readFileSync('docs/design/campfire-visual-spec.md', 'utf8');
const test = fs.readFileSync('test/texture-atlas.test.js', 'utf8');
const render = fs.readFileSync('.scratch/campfire/v19-review/render.js', 'utf8');

/* spec: 抓 66 号 char art 代码块(§4.3 内、含 aaaakk 行簇的 16 行块) */
const specBlocks = [];
let cur = [];
for (const l of spec.split(/\r?\n/)) {
  const m = l.match(/^'(.{16})'$/);
  if (m) cur.push(m[1]);
  else if (cur.length) { specBlocks.push(cur); cur = []; }
}
console.log('spec 画稿块数: ' + specBlocks.length + ' 行数: ' + specBlocks.map((b) => b.length).join(','));
/* 找含 'LdCaaakk' 开头簇的块 = 66 */
const spec66 = specBlocks.find((b) => b.length === 16 && b.some((r) => r.startsWith('LdCaaakk')));
const spec62 = specBlocks.find((b) => b.length === 16 && b[0] === 'CCCCCCCCCCCCCCCC');

function arr(name) {
  const m = render.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
  return m[1].match(/'[^']+'/g).map((s) => s.slice(1, -1)).filter((r) => r.length === 16);
}
const r66 = arr('OTOP66');
const m66 = test.match(new RegExp('const CF_OUT_TOP_ART = \\[([\\s\\S]*?)\\];'));
const t66 = m66[1].match(/'[.A-Za-z]{16}'/g).map((s) => s.slice(1, -1));

console.log('\n-- spec 66 --      -- test 66 --      -- render OTOP66 --');
for (let i = 0; i < 16; i++) {
  const s = spec66[i]; const t = t66[i]; const r = r66[i];
  const flag = (s === t && t === r) ? '' : (s === t ? ' (render异)' : (t === r ? ' (spec异!)' : ' (三方各异)'));
  console.log(String(i).padStart(2) + ' ' + s + '  ' + t + '  ' + r + flag);
}
console.log('\nspec62==test62存档? ' + (JSON.stringify(spec62) === JSON.stringify(rows(test.match(new RegExp('const CAMPFIRE_LIT_ART = \\[([\\s\\S]*?)\\];'))[1].match(/'[.A-Za-z]{16}'/g).map((s) => s.slice(1, -1))))));
