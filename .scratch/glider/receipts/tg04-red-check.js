// T-G04 红自证核查脚本(临时, 不入库): 按 UTF-8 解析盘上 tap/spec 日志, 输出 ASCII 状态行
const fs = require('fs');

const tapPath = '.scratch/glider/receipts/T-G04-red2.log';
const tap = fs.readFileSync(tapPath, 'utf8');
const notOk = tap.split(/\r?\n/).filter((x) => x.startsWith('not ok'));
console.log('=== red2.tap not-ok lines:', notOk.length);
for (const x of notOk) {
  const m = x.match(/^not ok (\d+)/);
  console.log((m ? m[1] : '?') + ' | ' + x.slice(9, 120));
}

const specPath = process.env.TEMP + '\\tg04detail.log';
const spec = fs.readFileSync(specPath, 'utf8');
const lines = spec.split(/\r?\n/).filter((x) => x.includes('T-G04'));
console.log('=== spec-detail T-G04 lines:', lines.length);
for (const x of lines) {
  const bad = x.includes('\u2716');
  const clean = x.replace(/[\u2714\u2716]/g, '').replace(/\u001b\[\d*m/g, '').trim();
  console.log((bad ? 'FAIL' : 'pass') + ' | ' + clean.slice(0, 110));
}
