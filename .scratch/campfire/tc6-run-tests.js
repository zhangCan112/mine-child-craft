'use strict';
/* T-C6 基准票 · 测试跑批落盘工具(conventions §7.3 日志纪律: 工具直写, 禁管道)
   用法: node .scratch/campfire/tc6-run-tests.js <logfile> <command...>
   把 command 的 stdout+stderr 原样写入 logfile(fs 直写, UTF-8), 尾段追加
   [red-cause] 风格的机械分类段(失败测试清单 + Error 类名计数)。 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = process.argv[2];
const cmd = process.argv.slice(3);
if (!logFile || cmd.length === 0) {
  console.error('usage: node tc6-run-tests.js <logfile> <command...>');
  process.exit(2);
}
const r = spawnSync(cmd[0], cmd.slice(1), { shell: true, encoding: 'utf8' });
const out = (r.stdout || '') + (r.stderr || '');

/* 机械分类: 失败测试行 + Error 类名计数(红因分类 §7.4 同款思路) */
const failLines = out.split('\n').filter((l) => /✖|not ok \d+/.test(l));
const errKinds = {};
const kindRe = /\b(AssertionError|TypeError|ReferenceError|SyntaxError|RangeError)\b/g;
let m;
while ((m = kindRe.exec(out)) !== null) errKinds[m[1]] = (errKinds[m[1]] || 0) + 1;
let tail = '\n[tc6-run-tests] exit=' + r.status + '\n';
if (failLines.length) tail += '[tc6-run-tests] fail-lines:\n' + failLines.join('\n') + '\n';
if (Object.keys(errKinds).length) {
  tail += '[tc6-run-tests] error-kind counts: ' + JSON.stringify(errKinds) + '\n';
}
/* node --test 汇总行原样摘出, 方便回执引用 */
const summary = out.split('\n').filter((l) => /tests \d+|pass \d+|fail \d+|skipped \d+/.test(l));
if (summary.length) tail += '[tc6-run-tests] summary:\n' + summary.join('\n') + '\n';

fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.writeFileSync(logFile, out + tail, 'utf8');
process.stdout.write(tail);
process.exit(r.status || 0);
