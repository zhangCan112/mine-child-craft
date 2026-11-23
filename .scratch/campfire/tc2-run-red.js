'use strict';
/* T-C2 红基线自证脚本(conventions §7.4 机械面): 跑两张票内测试文件,
   输出落盘 + 尾段追加 [red-cause] 分类段(断言红/装具炸嫌疑的 Error 类名
   计数 + 失败测试清单)。日志工具直写(§7.3), 禁 Out-File。 */
const {execFile} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const files = [
  'test/updraft-core.test.js',
  'test/campfire-kit.test.js',
];
const LOG = path.join(__dirname, 'tc2-red-run.log');

execFile('node', ['--test', ...files], {cwd: ROOT, maxBuffer: 64 * 1024 * 1024},
    (err, stdout, stderr) => {
      const out = (stdout || '') + (stderr || '');
      const lines = out.split(/\r?\n/);
      const failed = [];
      const passed = [];
      const errClass = {};
      let cur = null;
      let footer = false;
      for (const ln of lines) {
        if (/^✖\s*failing tests:/.test(ln)) { cur = null; footer = true; continue; } // 报告器脚注标记, 不复读
        const mFail = /^✖\s+(.+?)(?:\s*\(\d+(?:\.\d+)?ms\))?\s*$/.exec(ln);
        if (mFail && !footer) {
          cur = mFail[1].replace(/\s+/g, ' ').trim();
          failed.push(cur);
          continue;
        }
        const mPass = /^✔\s+(.+?)(?:\s*\(\d+(?:\.\d+)?ms\))?\s*$/.exec(ln);
        if (mPass) passed.push(mPass[1].replace(/\s+/g, ' ').trim());
        const mErr = /^\s*(AssertionError|TypeError|ReferenceError|SyntaxError|RangeError)\b/.exec(ln);
        if (mErr) { // 无状态计数: 每个失败恰好一条错误头(报告器详情块在脚注之后, cur 归属不可靠)
          errClass[mErr[1]] = (errClass[mErr[1]] || 0) + 1;
          continue;
        }
        if (/^▶?\s*failing tests:/.test(ln)) cur = null; // 报告器脚注重复清单, 不复读
        const mSum = /^ℹ\s+(tests|pass|fail|skipped)\s+(\d+)/.exec(ln);
        if (mSum) errClass['__' + mSum[1]] = mSum[2];
      }
      const tail = [
        '',
        '===== [red-cause] 分类段(机械生成, 回执引用此段) =====',
        '失败测试数: ' + failed.length + ' / 通过: ' + (errClass.__pass || '?') +
          ' / 总数: ' + (errClass.__tests || '?'),
        'Error 类名计数(装具炸嫌疑=TypeError/ReferenceError/SyntaxError; 断言红=AssertionError):',
        ...Object.entries(errClass).filter(([k]) => !k.startsWith('__')).map(([k, n]) => '  ' + k + ': ' + n),
        '失败测试清单:',
        ...failed.map((f) => '  - ' + f),
        '通过测试清单(对账零误伤用):',
        ...passed.map((f) => '  + ' + f),
        '===== [red-cause] 段尾 =====',
        '',
      ];
      fs.writeFileSync(LOG, out.replace(/\r\n/g, '\n') + tail.join('\n'), 'utf8');
      console.log('log written: ' + LOG);
      console.log(tail.join('\n'));
    });
