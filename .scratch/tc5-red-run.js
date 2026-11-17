'use strict';
/* T-C5 红因直证跑批: 五个红测文件逐个 node --test, 汇总 not ok 清单+红因摘要 */
const {spawnSync} = require('child_process');
const files = [
  'test/adventure-core.test.js',
  'test/campfire-kit.test.js',
  'test/adventure-mode.test.js',
  'test/adventure-nether.test.js',
  'test/showroom-mode.test.js',
];
const out = [];
let tTests = 0, tPass = 0, tFail = 0;
for (const f of files) {
  const r = spawnSync('node', ['--test', '--test-reporter=tap', f], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  const t = (r.stdout || '') + (r.stderr || '');
  const pick = (re) => (t.match(re) || [])[1];
  const tests = +pick(/^# tests (\d+)/m) || 0;
  const pass = +pick(/^# pass (\d+)/m) || 0;
  const fail = +pick(/^# fail (\d+)/m) || 0;
  tTests += tests; tPass += pass; tFail += fail;
  out.push('=== ' + f + ' ===');
  out.push('tests=' + tests + ' pass=' + pass + ' fail=' + fail + ' exit=' + r.status);
  /* not ok 行 + 其后的红因第一行(error 消息或 assertion actual/expected) */
  const lines = t.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^not ok \d+ (.+)$/);
    if (!m) continue;
    out.push('NOT OK: ' + m[1].trim());
    for (let j = i + 1; j < Math.min(i + 16, lines.length); j++) {
      const s = lines[j].trim();
      if (/^(error:|AssertionError|actual:|expected:|operator:)/i.test(s)) out.push('  ' + s.slice(0, 170));
      if (/^\.\.\.|^# /i.test(s)) break;
    }
  }
}
out.push('=== TOTAL ===');
out.push('tests=' + tTests + ' pass=' + tPass + ' fail=' + tFail);
console.log(out.join('\n'));
