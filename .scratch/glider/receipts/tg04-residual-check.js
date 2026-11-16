// 残余 diff 核查(临时): 非路径差异行清单 —— 应恰为 3 处诊断打印剔除
const fs = require('fs');
const d = fs.readFileSync('C:/Users/user/AppData/Local/Temp/tg04-diag-residual.diff', 'utf8');
const L = d.split(/\r?\n/).filter((l) => l.startsWith('+') || l.startsWith('-'));
const non = L.filter((l) => !l.includes('../../js/') && !l.includes("path.join(__dirname, '..', '..')"));
console.log('non-path diff lines:', non.length);
console.log(non.join('\n'));
