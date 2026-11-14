/* T-SEAM-03 验收探针(红方): 垫墩局地地形形状——主径 x151~157 × z73~77
   顶面高度与方块 id, 评估 (154,74)/(154,75) 垫墩对去程动线的扰动面。 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.join(__dirname, '..', '..');
const TEST_DIR = path.join(ROOT, 'test');
const src = fs.readFileSync(path.join(TEST_DIR, 'adventure-mode.test.js'), 'utf8');
const MARK = '/* ============ 测试 ============ */';
const boot = src.slice(0, src.indexOf(MARK));
const scopedRequire = Module.createRequire(path.join(TEST_DIR, 'probe-scoped.js'));
const capture = `
;globalThis.__probe = {
  freshInit, AdventureMode, A, advHeightAt, getBlock, ADV_GROUND,
};`;
const fn = new Function('require', '__dirname', '__filename', 'module', 'exports',
  boot + capture);
fn(scopedRequire, TEST_DIR, path.join(TEST_DIR, 'probe-scoped.js'),
  {exports: {}}, undefined);

const P = globalThis.__probe;
P.freshInit(); /* 建 home 真实世界(含垫墩) */
const G = P.ADV_GROUND;
console.log('z\\x  ' + [151, 152, 153, 154, 155, 156, 157].map((x) => String(x).padStart(4)).join(''));
for (const z of [73, 74, 75, 76]) {
  const row = [151, 152, 153, 154, 155, 156, 157].map((x) => {
    const h = P.advHeightAt(x, z);
    const top = P.getBlock(x, G + h, z);
    return 'h' + h + '/' + top;
  });
  console.log(String(z).padStart(3) + '  ' + row.join(' '));
}
/* east 锚落点脚箱复验(验收锚独立复核) */
const g = P.A ? null : null;
console.log('--- 落点 (154.5,75.0) 脚箱覆盖格 ---');
for (const bz of [74, 75]) {
  for (const y of [23, 24, 25, 26]) {
    console.log('(154,' + bz + ') y' + y + '=' + P.getBlock(154, y, bz));
  }
}
console.log('探针完毕。');
