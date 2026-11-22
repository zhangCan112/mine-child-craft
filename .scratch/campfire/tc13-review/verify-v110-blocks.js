// v1.10 核盘 · 连通块计数 + 三帧焰形 diff (§4.4 判据静态值精确核对)
// 【2026-11-22 特征锚定改造】byAt 硬编码行号三度被文档修订漂移击穿（b.rows undefined 落空），
// 本版起改 byPred 像素特征谓词取块——行号漂移免疫；谓词唯一性脚本自断言（命中数不符即红退出）。
// 谓词锚定实数（2026-11-22 实测修正，v1.10 核盘全块特征跑出的唯一组合）：
// 燃顶 f=4粒∧e=1粒∧k计数≥40 / 燃侧 e=3粒∧k计数≥150 /
// 熄顶 焰色=0∧e=0(双零签名)∧a>150∧k计数>30 / 熄侧 双零∧a>150∧k计数<30 /
// 焰帧=焰四档 w/W/f/F 合计≥80 恰命中 3 块。
// （原拟「熄侧 k<10」系计数/连通块口径混用：熄侧 k 计数=29、连通块=4；「a>150∧k>30」
// 须加双零签名排除燃顶 L410——其 a=201/k=50 同样撞阈值。）
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

/* 字符像素计数 */
const countOf = (b, ch) => (b.rows.join('').match(new RegExp(ch, 'g')) || []).length;

/* 特征提取：连通块数（xxc）+ 字符计数（xxc 计数用 kc/ac）+ 焰四档合计 */
const feats = (b) => ({
  at: b.at,
  k斑: components(b, 'k'), f粒: components(b, 'f'), F: components(b, 'F'), e粒: components(b, 'e'),
  k: countOf(b, 'k'), a: countOf(b, 'a'),
  焰: countOf(b, 'w') + countOf(b, 'W') + countOf(b, 'f') + countOf(b, 'F'),
});

/* 特征锚定取块：谓词命中恰 1 才放行，否则打印全部块特征并红退 */
const byPred = (label, pred) => {
  const hits = blocks.filter((b) => pred(feats(b)));
  if (hits.length !== 1) {
    console.error('!! 特征锚定失败 [' + label + '] 命中 ' + hits.length + ' 块（须恰 1）· 全块特征:');
    for (const b of blocks) console.error('   L' + b.at + ' ' + JSON.stringify(feats(b)));
    process.exit(1);
  }
  return hits[0];
};

const b70 = byPred('70 燃顶', (t) => t.f粒 === 4 && t.e粒 === 1 && t.k >= 40);
const b71 = byPred('71 燃侧', (t) => t.e粒 === 3 && t.k >= 150);
const b72 = byPred('72 熄顶', (t) => t.焰 === 0 && t.e粒 === 0 && t.a > 150 && t.k > 30);
const b73 = byPred('73 熄侧', (t) => t.焰 === 0 && t.e粒 === 0 && t.a > 150 && t.k < 30);
console.log('锚定行号: 70→L' + b70.at + ' · 71→L' + b71.at + ' · 72→L' + b72.at + ' · 73→L' + b73.at);
console.log('70 燃顶: k 连通块=' + components(b70, 'k') + '(§4.4 静态 3=判据≥3 / §4.2 说 3 群——v1.10 核盘修正) · f=' + components(b70, 'f') + '粒 · e=' + components(b70, 'e') + '粒');
console.log('71 燃侧: f 连通块=' + components(b71, 'f') + ' F=' + components(b71, 'F') + ' · e=' + components(b71, 'e') + '粒(§4.2 静态 3)');
console.log('72 熄顶: k 露头斑=' + components(b72, 'k') + '块(§4.3 判据 ≤4) · a=' + countOf(b72, 'a'));
console.log('73 熄侧: k=' + components(b73, 'k') + ' · a=' + countOf(b73, 'a'));

/* 三帧焰形：焰四档 w/W/f/F 合计≥80 恰命中 3 块（存档区历史稿不得混入） */
const frames = blocks.filter((b) => feats(b).焰 >= 80);
if (frames.length !== 3) {
  console.error('!! 焰帧锚定失败：焰四档合计≥80 命中 ' + frames.length + ' 块（须恰 3）· 全块特征:');
  for (const b of blocks) console.error('   L' + b.at + ' ' + JSON.stringify(feats(b)));
  process.exit(1);
}
console.log('\n三帧焰形 diff (L' + frames.map((f) => f.at).join('/L') + '):');
for (const [ai, a] of frames.entries()) for (let bi = ai + 1; bi < frames.length; bi++) {
  const b = frames[bi];
  let diff = 0;
  const cells = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (a.rows[y][x] !== b.rows[y][x]) { diff++; if (cells.length < 5) cells.push('r' + y + 'c' + x + ':' + a.rows[y][x] + '→' + b.rows[y][x]); }
  }
  console.log('F' + (ai + 1) + ' vs F' + (bi + 1) + ': 差异像素 ' + diff + (diff ? ' (如 ' + cells.join(' ') + ')' : ' !! 逐像素相同=假三帧'));
}
console.log('\nEXIT=0 全部锚定与断言通过');
