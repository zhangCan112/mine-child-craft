// flame-flicker.js 生成器: 从 R-5 探针 node 侧 patch(零 PowerShell 编码转换)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const OUT = __dirname;
let s = fs.readFileSync(path.join(OUT, '..', 'tc13r5', 'probe-close.js'), 'utf8');
s = s.replace('const SERVER_PORT = 8093;', 'const SERVER_PORT = 8094;')
    .replace('const CDP_PORT = 9225;', 'const CDP_PORT = 9226;')
    .replace('tc13r5-chrome-profile', 'tc13r-review-chrome-profile');
const shotAnchor = "    const shotLitSide = closeShot(x, y, z, 'side');\n"
    + "    const shotLitTop = closeShot(x, y, z, 'top');";
if (!s.includes(shotAnchor)) throw new Error('shot anchor 未命中');
s = s.replace(shotAnchor, shotAnchor + "\n"
    + "    /* flicker 三连拍(tc13r-review 复验): 间隔 0.22s 约 1.47 帧步(frameS=0.15), 焰形两两不同=翻页在动 */\n"
    + "    const flicker = [shotLitSide];\n"
    + "    await sleep(220);\n"
    + "    flicker.push(closeShot(x, y, z, 'side'));\n"
    + "    await sleep(220);\n"
    + "    flicker.push(closeShot(x, y, z, 'side'));");
const shotsAnchor = 'outSide: shotOutSide, outTop: shotOutTop}};';
if (!s.includes(shotsAnchor)) throw new Error('shots anchor 未命中');
s = s.replace(shotsAnchor, 'outSide: shotOutSide, outTop: shotOutTop,\n'
    + '        flick0: flicker[0], flick1: flicker[1], flick2: flicker[2]}};');
fs.writeFileSync(path.join(OUT, 'flame-flicker.js'), s);
const d = s.match(/const DRIVER = `([\s\S]*?)`;/)[1];
try {
  new Function(d);
  console.log('patch 完成 + driver 语法 OK');
} catch (e) {
  console.log('patch 完成, 但 driver 语法错:', e.message);
  process.exitCode = 1;
}
