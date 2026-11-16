// 终局全量汇总(临时): ℹ 汇总 + 失败清单
const fs = require('fs');
const t = fs.readFileSync('.scratch/glider/receipts/tg04-full-test-final.log', 'utf8');
const L = t.split(/\r?\n/);
const sums = L.filter((x) => /^\u2139 (tests|suites|pass|fail|cancelled|skipped|todo)/.test(x));
console.log(sums.join(' | '));
const fails = L.filter((x) => x.includes('\u2716'));
console.log('fail-mark lines:', fails.length);
for (const f of fails.slice(0, 10)) console.log('  ' + f.replace(/[\u2716]/g, '').trim().slice(0, 100));
