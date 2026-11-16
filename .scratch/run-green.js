'use strict';
/* 红绿跑具(T-C11): node .scratch/run-green.js --label <tag> <test-file...>
   捕获 node --test 输出落盘 .scratch/<tag>.log(UTF-8 工具直写, 禁管道,
   conventions §7.3); 失败时尾段追加 [red-cause] 分类段(conventions §7.4):
   Error 类名计数 + 失败测试清单——断言红(AssertionError)与装具炸
   (TypeError/ReferenceError)分开表述, 回执引用该段不手写红因。 */
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const li = args.indexOf('--label');
const label = li >= 0 ? (args[li + 1] || 'run') : 'run';
/* --label <tag> 之后全部视为测试文件参数(缺省=node --test 跑全 test/) */
const files = li >= 0 ? args.slice(li + 2).filter(Boolean) : args.filter((a) => !a.startsWith('--'));

const ROOT = path.join(__dirname, '..');
const r = spawnSync('node', ['--test', ...files], {cwd: ROOT, encoding: 'buffer'});
const out = Buffer.concat([r.stdout || Buffer.alloc(0), r.stderr || Buffer.alloc(0)]).toString('utf8');

let tail = '';
if ((r.status || 0) !== 0) {
  const counts = {};
  for (const m of out.matchAll(/\b(AssertionError|TypeError|ReferenceError|SyntaxError|RangeError)\b/g)) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  const fails = [...out.matchAll(/^✖ (.+)$/gm)].map((m) => m[1].trim());
  tail = '\n\n[red-cause] 自动分类段(conventions §7.4, 机械生成非手写)\n'
      + 'exit_code: ' + r.status + '\n'
      + 'error_class_counts: ' + JSON.stringify(counts) + '\n'
      + 'verdict: ' + (counts.AssertionError ? '断言红(AssertionError=' + counts.AssertionError + ')'
        : (counts.TypeError || counts.ReferenceError) ? '装具炸嫌疑(TypeError/ReferenceError)'
        : '非断言红(见失败清单)') + '\n'
      + 'failed_tests:\n' + (fails.length ? fails.map((f) => '  - ' + f).join('\n') : '  (spec reporter 未捕获✖行, 见上方正文)');
}

const logPath = path.join(__dirname, label + '.log');
fs.writeFileSync(logPath, out + tail, 'utf8');
console.log('[run-green] label=' + label + ' exit=' + r.status + ' log=' + logPath);
if (tail) console.log(tail.trim());
process.exit(r.status || 0);
