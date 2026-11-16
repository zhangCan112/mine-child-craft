/* 诊断探针: 按段名 pattern 跑 adventure-mode.test.js, 报 pass/fail 与失败名
   用法A: node merge-bug-probe.js "pattern"(ASCII 可靠)
   用法B: node merge-bug-probe.js --file patterns.txt(UTF-8 每行一 pattern, 绕开 argv 编码) */
'use strict';
const {execFileSync} = require('child_process');
const fs = require('fs');
const args = process.argv.slice(2);
let patterns = [];
if (args[0] === '--file') {
  patterns = fs.readFileSync(args[1], 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
} else {
  patterns = [args[0]];
}
for (const pattern of patterns) {
  const outFile = '.scratch/glider/receipts/merge-bug-probe-last.log';
  let out = '';
  try {
    out = execFileSync(process.execPath,
        ['--test', '--test-name-pattern=' + pattern, 'test/adventure-mode.test.js'],
        {encoding: 'utf8', maxBuffer: 1e9, env: Object.assign({}, process.env, {FORCE_COLOR: '0', NO_COLOR: '1'})});
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  fs.writeFileSync(outFile, out);
  const summary = out.split('\n').filter((l) => / (tests|pass|fail|skipped|cancelled) \d+/.test(l))
      .map((l) => l.trim().replace(/[^\x20-\x7e]/g, '')).join(' | ');
  const red = / fail [1-9]/.test(summary.replace(/pass \d+ /, '')) || /fail [1-9]/.test(summary);
  console.log((red ? 'RED  ' : 'green') + ' [' + pattern + '] ' + summary);
  for (const l of out.split('\n')) {
    if (/按住漂移/.test(l)) {
      console.log('    PO2-LINE> ' + l.trim().replace(/[^\x20-\x7e\u4e00-\u9fff④]/g, '').slice(0, 60));
    }
  }
}

