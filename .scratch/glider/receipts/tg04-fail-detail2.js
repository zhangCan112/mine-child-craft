// 提取 ✖ 后紧跟的 AssertionError 详情(临时)
const fs = require('fs');
const t = fs.readFileSync('.scratch/glider/receipts/tg04-full-test.log', 'utf8');
const L = t.split(/\r?\n/);
for (let i = 0; i < L.length; i++) {
  if (L[i].includes('\u2716') && L[i].includes('T-G04')) {
    const title = L[i].replace(/[\u2716]/g, '').trim().slice(0, 60);
    const err = L.slice(i + 1, i + 30).filter((x) => x.includes('AssertionError') || x.includes('Error [') ||
      x.includes('actual:') || x.includes('expected:') || x.includes('operator:') ||
      /test\\adventure-mode\.test\.js:\d+/.test(x));
    console.log('=== ' + title);
    console.log(err.join('\n'));
  }
}
