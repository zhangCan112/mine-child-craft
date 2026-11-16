// 提取 test 15/16 全量失败详情(临时)
const fs = require('fs');
const t = fs.readFileSync('.scratch/glider/receipts/tg04-full-test.log', 'utf8');
const L = t.split(/\r?\n/);
for (const key of ['\u76f8\u673a\u8def\u5f84 B', '\u5207\u6a21\u5f0f\u6e05\u573a']) {
  const idx = [];
  for (let i = 0; i < L.length; i++) {
    if (L[i].includes('\u2716') && L[i].includes(key)) idx.push(i);
  }
  console.log('=== key hits:', key, idx.length);
  for (const i of idx.slice(0, 1)) {
    console.log(L.slice(i, i + 14).join('\n'));
    console.log('...');
  }
}
