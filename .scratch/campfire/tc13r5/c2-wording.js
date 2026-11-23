'use strict';
/* T-C13-R5 c2 措辞如实化(裁决 ii, 零产品面): 两处注释口径修正 */
const fs = require('fs');
const p = 'js/effects.js';
let s = fs.readFileSync(p, 'utf8');
const edits = [
  ['惰性建(场内首格在册才建, 零 open 格零 mesh); 容量按需翻倍(mobs growMobBatch',
   '惰性建(场内首格在册才建, 零在册格零 mesh; 在册格必曾 open(见下方门注释), 容量按需翻倍(mobs growMobBatch'],
  ['if (cellsAll.length === 0) return; // 惰性: 场内首格在册才建(零 open 格零 sheet)',
   'if (cellsAll.length === 0) return; // 惰性: 场内首格在册才建(零在册格零 sheet — 在册格必曾 open: quench/dig 悬空无害, R5-c2 口径)'],
];
for (const [a, b] of edits) {
  const hit = s.includes(a);
  console.log('hit:', hit, '|', a.slice(0, 24));
  if (!hit) process.exit(1);
  s = s.replace(a, b);
}
fs.writeFileSync(p, s, 'utf8');
console.log('done');
