const fs = require('fs');
const md = fs.readFileSync('docs/design/glider-ui-spec.md', 'utf8');
const blocks = md.split('```');
// find the block whose lines are quoted strings
let found = null;
for (let i = 1; i < blocks.length; i += 2) {
  const rows = blocks[i].split('\n').filter((l) => l.trim().startsWith("'"));
  if (rows.length >= 10) { found = rows; break; }
}
if (!found) { console.log('ART BLOCK NOT FOUND'); process.exit(1); }
const arr = found.map((l) => l.trim().replace(/,$/, '').slice(1, -1));
let bad = [];
arr.forEach((r, i) => { if (r.length !== 16) bad.push((i + 1) + ':' + r.length); });
const sym = arr.every((r) => r === [...r].reverse().join(''));
console.log('rows:', arr.length, '| width errors:', bad.length ? bad : 'none', '| mirror:', sym);
console.log('chars:', JSON.stringify([...new Set(arr.join(''))].sort()));
console.log('first row:', JSON.stringify(arr[0]), '| last row:', JSON.stringify(arr[arr.length - 1]));
