// v1.10 核盘 · 文档画稿程序面交叉: 直接从定稿实文数像素, 验证 §4.4 静态判据值
// (照 v19-review 纪律: 不经会话转写, 直读文档)
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
console.log('画稿块: ' + blocks.length + ' (行数 ' + blocks.map((b) => b.rows.length).join(',') + ')');

/* 色板字符 → 像素语义 */
const FLAME = ['w', 'W', 'f', 'F'];
const stats = (rows) => {
  const c = {};
  for (const r of rows) for (const ch of r) c[ch] = (c[ch] || 0) + 1;
  return c;
};
blocks.forEach((b, bi) => {
  const c = stats(b.rows);
  const flame4 = FLAME.reduce((s, k) => s + (c[k] || 0), 0);
  const ww = (c.w || 0) + (c.W || 0);
  const head = '块' + bi + '(L' + b.at + ')';
  if (flame4 >= 80) console.log(head + ' 焰帧: 焰四档 ' + flame4 + '(判据≥80 静态90) 白芯W ' + ww + '(≥20 静态29) f=' + (c.f || 0) + ' F=' + (c.F || 0));
  else if (flame4 > 0) console.log(head + ' 燃顶/侧: 焰色 ' + flame4 + ' k斑像素=' + (c.k || 0) + ' f橙芯=' + (c.f || 0) + ' e灼点=' + (c.e || 0) + ' a=' + (c.a || 0));
  else if ((c.k || 0) > 0 || (c.a || 0) > 0) console.log(head + ' 熄顶/侧: k=' + (c.k || 0) + ' a=' + (c.a || 0) + ' L=' + (c.L || 0) + ' l=' + (c.l || 0) + ' d=' + (c.d || 0) + ' 焰色=0 e=0 ' + ((c.f || c.F || c.W || c.w || c.e) ? '!! 残焰' : '(双零✓)'));
  else console.log(head + ' 其他(图标/原木?): L=' + (c.L || 0) + ' l=' + (c.l || 0) + ' d=' + (c.d || 0) + ' 焰=' + flame4);
});
