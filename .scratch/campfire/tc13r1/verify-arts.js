// T-C13-R1 红面转录对撞: 从定稿实文(campfire-visual-spec.md)按行域取九张画稿,
// 与测试文件 art 常量逐字符 diff(照 v19-review verify-verbatim.js 纪律: 不经会话转写, 直读两文件)
// 行域=定稿 v1.10 各画稿码块首行(verify-v110 双脚本同款 ^'(.{16})'$ 解析)
'use strict';
const fs = require('node:fs');
const doc = fs.readFileSync('docs/design/campfire-visual-spec.md', 'utf8').split(/\r?\n/);
const testSrc = fs.readFileSync('test/texture-atlas.test.js', 'utf8');
const blockAt = (start, name) => {
  // 锚行自检: 锚必须精确落在画稿码块首行(本身即画稿行), 防锚漂移被滑窗掩盖成假 OK
  if (!/^'(.{16})'$/.test(doc[start - 1])) {
    console.log('NG ' + name + ': 锚 L' + start + ' 不是画稿行(锚漂移, 拒绝滑窗取块)');
    return null;
  }
  const rows = [];
  for (let i = start - 1; i < doc.length && rows.length < 16; i++) {
    const m = doc[i].match(/^'(.{16})'$/);
    if (m) rows.push(m[1]); else if (rows.length) break;
  }
  return rows;
};
const spec = {
  // 锚=各画稿码块首行; 793c237 散文对齐在画稿段前净增 7 行, 旧锚 356/379/403/429/453/472/491/524/548 统一 +7
  CF_LOG_END68_ART: 363, CF_LOG_SIDE69_ART: 386, CF_TOP_LIT70_ART: 410,
  CF_SIDE_LIT71_ART: 436, CF_FLAME74_ART: 460, CF_FLAME75_ART: 479, CF_FLAME76_ART: 498,
  CF_TOP_OUT72_ART: 531, CF_SIDE_OUT73_ART: 555,
};
let bad = 0;
for (const [name, at] of Object.entries(spec)) {
  const want = blockAt(at, name);
  if (!want) { bad++; continue; }
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
