// T-G04 终局红名单解析(临时, 不入库): 从字节级 tap 提取 red/grn 名单与汇总
const fs = require('fs');
const t = fs.readFileSync('.scratch/glider/receipts/T-G04-red-final.tap', 'utf8');
const lines = t.split(/\r?\n/);
const cases = lines.filter((x) => /^(not )?ok \d+/.test(x));
for (const x of cases) {
  const m = x.match(/^(not )?ok (\d+) - (.*)$/);
  console.log((m[1] ? 'RED ' : 'grn ') + m[2] + ' | ' + m[3].slice(0, 90));
}
const sum = lines.filter((x) => /^# (tests|pass|fail|skipped)/.test(x)).map((x) => x.trim());
console.log(sum.join(' | '));
