'use strict';
/* T1b 红基线留痕: 跑 mesh-core.test.js, 摘出失败测名+红因(Error 类名), 工具直写 */
const cp = require('child_process');
const fs = require('fs');
let out;
try {
  out = cp.execSync('node --test test/mesh-core.test.js', {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']});
} catch (e) {
  out = (e.stdout || '') + (e.stderr || '');
}
const lines = out.split(/\r?\n/);
const keep = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^not ok/.test(l) || /^ok \d+ .*门额牌/.test(l) || /门额牌/.test(l) ||
      /^# (tests|pass|fail)/.test(l) || /Error:/.test(l) ||
      /assert\.|expected:|actual:|operator:|comparison/.test(l)) {
    keep.push(l);
  }
}
const report = keep.join('\n');
fs.writeFileSync('.scratch/t1b-red-baseline.log', report, 'utf8');
console.log(report);
