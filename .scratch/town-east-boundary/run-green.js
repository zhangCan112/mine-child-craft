'use strict';
/* run-green.js — 红因分类留痕跑器(conventions §7.4 机械面, 随票建·不入库)
   用法: node .scratch/run-green.js [命令...] (缺省: node --test)
   行为: 跑给定命令, 全量输出工具直写落盘 .scratch/run-green.log(§7.3 禁
   Out-File 管道); 失败时在日志尾段追加 [red-cause] 分类段——断言红
   (AssertionError)与装具炸嫌疑(TypeError/ReferenceError/SyntaxError/
   RangeError)按 Error 类名计数 + 失败测试清单(node:test `not ok` 行)。
   回执引用该段, 不手写红因(装具炸≠断言红, 以日志实读为准)。 */
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const argv = process.argv.slice(2);
const cmd = argv.length ? argv : ['node', '--test'];
const logPath = path.join(__dirname, 'run-green.log');

const res = spawnSync(cmd[0], cmd.slice(1), {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
const out = ((res.stdout || '') + (res.stderr || '')).replace(/\r\n/g, '\n');
const lines = out.split('\n');

const sections = ['$ ' + cmd.join(' '), out.trimEnd()];

if (res.status !== 0) {
  const classCounts = {};
  for (const m of out.matchAll(
      /\b(AssertionError|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError)\b/g)) {
    classCounts[m[1]] = (classCounts[m[1]] || 0) + 1;
  }
  const failed = lines.filter((l) => /^not ok /.test(l.trim()) ||
          /^✖\s/.test(l.trim()) && !/failing tests:/.test(l))
      .map((l) => l.trim());
  const rigSuspects = Object.entries(classCounts).filter(([k]) => k !== 'AssertionError');
  const rigTotal = rigSuspects.reduce((s, [, v]) => s + v, 0);
  sections.push('');
  sections.push('[red-cause] (conventions §7.4 机械分类, 以日志实读为准)');
  sections.push('断言红 AssertionError 计数: ' + (classCounts.AssertionError || 0));
  sections.push('装具炸嫌疑计数: ' + rigTotal +
      rigSuspects.map(([k, v]) => ' [' + k + ' x' + v + ']').join(''));
  sections.push('失败测试清单(not ok):');
  if (failed.length) {
    for (const f of failed) sections.push('  ' + f);
  } else {
    sections.push('  (无 `not ok` 行——非 node:test 输出或装具级失败, 人工读日志全文)');
  }
}

fs.writeFileSync(logPath, sections.join('\n') + '\n', 'utf8');

/* 控制台只回显尾段+分类段(全文在日志) */
const tailN = 25;
const show = sections[0] === sections[1] ? sections : sections;
const tailLines = sections[1].split('\n').slice(-tailN);
console.log('--- 日志尾段(全文: ' + logPath + ') ---');
for (const l of tailLines) console.log(l);
if (sections.length > 2) {
  console.log('--- [red-cause] ---');
  for (const l of sections.slice(2)) console.log(l);
}
process.exit(res.status === null ? 1 : res.status);
