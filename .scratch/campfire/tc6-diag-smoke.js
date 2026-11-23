'use strict';
/* T-C6 冒烟: 重新生成基准页 + headless Chrome 25s 抓驱动启动日志
   (验证 <base href="/"> 修复——产品脚本应能执行, lowcore 应为 boolean)
   用法: node .scratch/campfire/tc6-diag-smoke.js [port]
   前置: server.js 已在 [port](缺省 8808) 就绪 */
const { spawn } = require('node:child_process');
const { generatePage } = require('./tc6-bench-page.js');

const PORT = process.argv[2] || '8808';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const page = generatePage();
console.log('基准页已重生成: ' + page);
console.log('base 注入: ' + require('node:fs')
    .readFileSync(page, 'utf8').includes('<base href="/">'));

const args = [
  '--headless=new',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-logging=stderr',
  '--v=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\tc6-chrome-diag-profile',
  '--window-size=1280,800',
  'http://127.0.0.1:' + PORT + '/.scratch/campfire/tc6-bench.html?dev=1',
];
const child = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
let buf = '';
child.stderr.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (line.indexOf('TC6') >= 0) console.log(line.trim());
  }
});
setTimeout(() => {
  child.kill();
  console.log('冒烟结束(25s)');
  process.exit(0);
}, 25000);
