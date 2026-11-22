// T-C13-R1 红面转录对撞: 从定稿实文(campfire-visual-spec.md)按行域取九张画稿,
// 与测试文件 art 常量逐字符 diff(照 v19-review verify-verbatim.js 纪律: 不经会话转写, 直读两文件)
// 行域=定稿 v1.10 各画稿码块首行(verify-v110 双脚本同款 ^'(.{16})'$ 解析)
'use strict';
const fs = require('node:fs');
const doc = fs.readFileSync('docs/design/campfire-visual-spec.md', 'utf8').split(/\r?\n/);
const testSrc = fs.readFileSync('test/texture-atlas.test.js', 'utf8');
const blockAt = (start) => {
  const rows = [];
  for (let i = start - 1; i < doc.length && rows.length < 16; i++) {
    const m = doc[i].match(/^'(.{16})'$/);
    if (m) rows.push(m[1]); else if (rows.length) break;
  }
  return rows;
};
const spec = {
  CF_LOG_END68_ART: 356, CF_LOG_SIDE69_ART: 379, CF_TOP_LIT70_ART: 403,
  CF_SIDE_LIT71_ART: 429, CF_FLAME74_ART: 453, CF_FLAME75_ART: 472, CF_FLAME76_ART: 491,
  CF_TOP_OUT72_ART: 524, CF_SIDE_OUT73_ART: 548,
};
let bad = 0;
for (const [name, at] of Object.entries(spec)) {
  const want = blockAt(at);
  const m = testSrc.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
  const got = m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : [];
  if (want.length !== 16 || got.length !== 16) {
    console.log('NG ' + name + ': 行数 spec=' + want.length + ' test=' + got.length);
    bad++;
    continue;
  }
  let diff = 0;
  for (let y = 0; y < 16; y++) {
    if (want[y] !== got[y]) {
      diff++;
      if (diff <= 2) console.log('NG ' + name + ' 行 ' + y + ': spec=' + want[y] + ' test=' + got[y]);
    }
  }
  if (diff) { console.log('NG ' + name + ': ' + diff + ' 行不一致'); bad++; }
  else console.log('OK ' + name + ' (L' + at + ') 16 行逐字符一致');
}
console.log(bad === 0 ? '对撞结论: 九张画稿零转写漂移(9/9 OK)' : '对撞结论: ' + bad + ' 张漂移, 禁止红提交');
process.exit(bad === 0 ? 0 : 1);
