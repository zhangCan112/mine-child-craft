// 全量日志汇总(临时): ✖ 清单 + spec 汇总行
const fs = require('fs');
const t = fs.readFileSync('.scratch/glider/receipts/tg04-full-test.log', 'utf8');
const L = t.split(/\r?\n/);
const fails = L.filter((x) => x.includes('\u2716'));
console.log('fail-mark lines:', fails.length);
for (const f of fails) console.log('  ' + f.replace(/[\u2716]/g, '').trim().slice(0, 110));
const sums = L.filter((x) => /\b(tests|suites|pass|fail|cancelled|skipped)\b\s+\d+/.test(x) && !x.includes('at '));
console.log('--- summary lines ---');
for (const s of sums.slice(-8)) console.log('  ' + s.trim().slice(0, 110));
