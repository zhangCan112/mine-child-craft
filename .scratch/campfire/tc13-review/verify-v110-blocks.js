// v1.10 核盘 · 连通块计数 + 三帧焰形 diff (§4.4 判据静态值精确核对)
'use strict';
const fs = require('node:fs');
const doc = fs.readFileSync('docs/design/campfire-visual-spec.md', 'utf8');
const lines = doc.split(/\r?\n/);
const blocks = [];
let cur = [];
let curStart = 0;
for (const [i, l] of lines.entries()) {
  const m = l.match(/^'(.{16})'$/);
  if (m) { if (!cur.length) curStart = i + 1; cur.push(m[1]); }
  else if (cur.length) { blocks.push({ rows: cur, at: curStart }); cur = []; }
}
if (cur.length) blocks.push({ rows: cur, at: curStart });
const byAt = (n) => blocks.find((b) => b.at === n);

/* 4 连通块计数 */
function components(b, ch) {
  const g = b.rows.map((r) => r.split(''));
  const seen = g.map((r) => r.map(() => false));
  let n = 0;
  const flood = (y, x) => {
    if (y < 0 || y > 15 || x < 0 || x > 15 || seen[y][x] || g[y][x] !== ch) return;
    seen[y][x] = true;
    flood(y + 1, x); flood(y - 1, x); flood(y, x + 1); flood(y, x - 1);
  };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!seen[y][x] && g[y][x] === ch) { flood(y, x); n++; }
  }
  return n;
}

const b70 = byAt(403), b71 = byAt(429), b72 = byAt(524), b73 = byAt(548);
console.log('70 燃顶: k 连通块=' + components(b70, 'k') + '(§4.4 静态 3=判据≥3 / §4.2 说 3 群——v1.10 核盘修正) · f=' + components(b70, 'f') + '粒 · e=' + components(b70, 'e') + '粒');
console.log('71 燃侧: f 连通块=' + components(b71, 'f') + ' F=' + components(b71, 'F') + ' · e=' + components(b71, 'e') + '粒(§4.2 静态 3)');
console.log('72 熄顶: k 露头斑=' + components(b72, 'k') + '块(§4.3 判据 ≤4) · a=' + (b72.rows.join('').match(/a/g) || []).length);
console.log('73 熄侧: k=' + components(b73, 'k') + ' · a=' + (b73.rows.join('').match(/a/g) || []).length);

/* 三帧焰形逐像素 diff */
const frames = [byAt(453), byAt(472), byAt(491)];
console.log('\n三帧焰形 diff:');
for (const [ai, a] of frames.entries()) for (let bi = ai + 1; bi < frames.length; bi++) {
  const b = frames[bi];
  let diff = 0;
  const cells = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (a.rows[y][x] !== b.rows[y][x]) { diff++; if (cells.length < 5) cells.push('r' + y + 'c' + x + ':' + a.rows[y][x] + '→' + b.rows[y][x]); }
  }
  console.log('F' + (ai + 1) + ' vs F' + (bi + 1) + ': 差异像素 ' + diff + (diff ? ' (如 ' + cells.join(' ') + ')' : ' !! 逐像素相同=假三帧'));
}
