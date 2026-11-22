// T-C13-R2 值表对撞: 方案 §4 建议值表 ↔ 测试 CF_PARTS_WANT 常量逐值 diff
// (照 tc13r1 verify-arts.js byPred 纪律: 不经会话转写, 直读两文件;
//  锚行自检: 锚行必须本身含部件关键词, 拒绝滑窗取块防锚漂移被掩盖成假 OK)
'use strict';
const fs = require('node:fs');
const doc = fs.readFileSync('.scratch/campfire/tc13r-arch/tc13r-arch.md', 'utf8').split(/\r?\n/);
const testSrc = fs.readFileSync('test/texture-atlas.test.js', 'utf8');
const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
/* 锚=方案 §4 表各部件行(行号+关键词双锚); AABB=格内局部坐标(心±半窗派生值
   允许=行内字面量两两和差/半和差, 派生自锚行字面量非会话转写) */
const spec = [
  {at: 164, kw: '原木·沿 X', bb: [0.125, 0.000, 0.215, 0.875, 0.150, 0.365]},
  {at: 164, kw: '原木·沿 X', bb: [0.125, 0.000, 0.635, 0.875, 0.150, 0.785]},
  {at: 165, kw: '原木·沿 Z', bb: [0.215, 0.075, 0.125, 0.365, 0.225, 0.875]},
  {at: 165, kw: '原木·沿 Z', bb: [0.635, 0.075, 0.125, 0.785, 0.225, 0.875]},
  {at: 166, kw: '炭堆主盒', bb: [0.300, 0.150, 0.300, 0.700, 0.300, 0.700]},
  {at: 167, kw: '炭堆小盒', bb: [0.460, 0.240, 0.460, 0.660, 0.340, 0.660]},
];
/* test 侧 CF_PARTS_WANT 常量抠出(六行数字) */
const m = testSrc.match(/const CF_PARTS_WANT = \[([\s\S]*?)\n\];/);
let bad = 0;
if (!m) {
  console.log('NG: 测试文件无 CF_PARTS_WANT 常量');
  process.exit(1);
}
const wantRows = [...m[1].matchAll(/\[([^\]]+)\]/g)]
    .map((x) => x[1].split(',').map((v) => parseFloat(v.trim())))
    .filter((r) => r.length === 6 && r.every((v) => !Number.isNaN(v)));
/* 派生闭包: 锚行字面量两两 a±b 与 a±b/2(心±半窗的合法派生域) */
const derived = (lits) => {
  const set = new Set(lits);
  for (const a of lits) {
    for (const b of lits) {
      set.add(a + b); set.add(a - b); set.add(a + b / 2); set.add(a - b / 2);
    }
  }
  return set;
};
const close = (a, b) => Math.abs(a - b) < 1e-9;
/* 1) 锚行自检+字面量/派生域核对 */
for (const sp of spec) {
  const line = doc[sp.at - 1];
  if (!line || !line.includes(sp.kw)) {
    console.log('NG 锚 L' + sp.at + ': 不含「' + sp.kw + '」(锚漂移, 拒绝滑窗取行)');
    bad++;
    continue;
  }
  const dom = derived(nums(line));
  const miss = sp.bb.filter((v) => ![...dom].some((d) => close(d, v)));
  if (miss.length) {
    console.log('NG L' + sp.at + ' ' + sp.kw + ': AABB 值 ' + miss.join(',') + ' 不在锚行字面量/派生域');
    bad++;
  } else {
    console.log('OK 锚 L' + sp.at + ' ' + sp.kw + ' AABB=[' + sp.bb.join(',') + '] 6 值在域');
  }
}
/* 2) SPEC ↔ CF_PARTS_WANT 逐行 diff(行数一致+逐行逐值) */
if (wantRows.length !== spec.length) {
  console.log('NG: 行数 spec=' + spec.length + ' test=' + wantRows.length);
  bad++;
} else {
  for (let i = 0; i < spec.length; i++) {
    const w = wantRows[i]; const s = spec[i].bb;
    if (!w.every((v, j) => close(v, s[j]))) {
      console.log('NG 行 ' + i + ' (' + spec[i].kw + '): spec=[' + s.join(',') + '] test=[' + w.join(',') + ']');
      bad++;
    }
  }
  if (!bad) console.log('对撞结论: 方案 §4 值表 ↔ CF_PARTS_WANT 六行逐值一致(6/6 OK)');
}
console.log(bad === 0 ? '对撞通过(零转写漂移)' : '对撞失败 ' + bad + ' 项, 禁止提交');
process.exit(bad === 0 ? 0 : 1);
