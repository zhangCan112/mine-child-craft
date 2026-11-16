// T-G04 测试修复合入脚本(临时, 不入库): 诊断镜像 v9 内容移植回原测试文件
//   = 镜像全文 − 3 处诊断打印 − 镜像路径还原(../../ → ../)
//   移植后与镜像逐字一致性由 diff 复核(应只剩路径 + 打印差异)
const fs = require('fs');

const SRC = '.scratch/glider/tg04-diagnostic.test.js';
const DST = 'test/adventure-mode.test.js';
const BAK = '.scratch/glider/receipts/adventure-mode.test.js.pre-merge.bak';

const orig = fs.readFileSync(DST, 'utf8');
fs.writeFileSync(BAK, orig); /* 回写前备份现稿(防丢) */

let t = fs.readFileSync(SRC, 'utf8');
const before = t.length;

/* 1) 路径还原: 镜像因放在 .scratch/glider 多退一级 */
t = t.split("require('../../js/").join("require('../js/");
t = t.split("path.join(__dirname, '..', '..')").join("path.join(__dirname, '..')");

/* 2) 剔诊断打印一: test13 spoken 观察行 */
const c1 = "  console.log('[diag test13] spoken=' + JSON.stringify(spoken)); /* 诊断: 定位观察窗内 TTS 来源 */\n";
if (!t.includes(c1)) throw new Error('diag print 1 not found');
t = t.split(c1).join('');

/* 3) 剔诊断打印二: test14 每 10 帧状态行(保留 for 块结构) */
const c2 = "    if (i % 10 === 9) console.log('[diag test14] 帧' + (i + 1) + ' gliding=' + G.gliding +\n" +
    "        ' latch=' + G.glideLatch + ' equip=' + G.gliderEquipped +\n" +
    "        ' pos=(' + G.pos.x.toFixed(2) + ',' + G.pos.y.toFixed(2) + ',' + G.pos.z.toFixed(2) + ') onGround=' + G.onGround);\n";
if (!t.includes(c2)) throw new Error('diag print 2 not found');
t = t.split(c2).join('');

/* 4) 剔诊断打印三: test16 重进帧级打印, 循环还原为等价 glideFrame(3) */
const c3old = "  for (let i = 0; i < 3; i++) { /* 诊断 patch: 帧级打印定位重进展翼帧(原 glideFrame(3)) */\n" +
    "    glideFrame(1);\n" +
    "    console.log('[diag test16-re] 帧' + (i + 1) + ' gliding=' + G.gliding + ' equip=' + G.gliderEquipped +\n" +
    "        ' onGround=' + G.onGround + ' pos=(' + G.pos.x.toFixed(2) + ',' + G.pos.y.toFixed(2) + ',' + G.pos.z.toFixed(2) + ')' +\n" +
    "        ' ground25=' + glideTopAt(25, 25) + ' wingOpen=' + glideSfx('wing_open'));\n" +
    "  }\n";
const c3new = "  glideFrame(3); /* 进场对账落地态三帧稳定 */\n";
if (!t.includes(c3old)) throw new Error('diag print 3 not found');
t = t.split(c3old).join(c3new);

/* 自检: 无镜像路径/诊断打印残留 */
for (const bad of ["require('../../js/", "'..', '..'", "console.log('[diag"]) {
  if (t.includes(bad)) throw new Error('residual: ' + bad);
}
fs.writeFileSync(DST, t);
console.log('OK backup->', BAK, '| len', before, '->', t.length);
