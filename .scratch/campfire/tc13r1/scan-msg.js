// 提交消息字符扫描(conventions §7.3: 禁 ~ # em-dash)
'use strict';
const fs = require('node:fs');
const msg = process.argv.slice(2).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const bad = [...msg.matchAll(/[~#—]/g)];
console.log('scanned_chars=' + msg.length + ' forbidden_chars=' + bad.length +
    (bad.length ? ' hit=' + bad.map((m) => JSON.stringify(m[0])).join(',') : ' (clean)'));
process.exit(bad.length ? 1 : 0);
