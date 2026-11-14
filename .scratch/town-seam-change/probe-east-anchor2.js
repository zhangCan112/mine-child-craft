/* T-SEAM-03 east 锚施工探针·补充版: 候选窗垂直柱剖面(y18..28)——
   圈层高度场下坡现形后, 需要知道 x145..159 × z72..78 各列表面高度与表层 id,
   才能选出「落点脚箱覆盖格 y24 实垫+y25/26 净空」的达标窗。harness 同 probe-east-anchor.js。 */
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
  freshInit, api, A, AdventureMode,
  advHomeArriveGate, advMapArriveAt, ADV_HOME_EDGE_GATES, ADV_GATE_FACE,
  ADV_GROUND, getBlock, BLOCKS, advHeightAt, ADV_EDGE_DIR_MAP,
};`;
const fn = new Function('require', '__dirname', '__filename', 'module', 'exports',
  boot + capture);
fn(scopedRequire, TEST_DIR, path.join(TEST_DIR, 'probe-scoped.js'),
  {exports: {}}, undefined);

const P = globalThis.__probe;
P.freshInit();

const idName = (id) => (id === 0 ? '·0' : String(id) + (P.BLOCKS[id] ? ':' + P.BLOCKS[id].name : ''));

/* 高度场对照: advHeightAt 的表面 y(24+heightAt 顶面) */
console.log('=== advHeightAt 表(x145..159) ===');
for (const z of [72, 73, 74, 75, 76, 77]) {
  const hs = [];
  for (let x = 145; x <= 159; x++) hs.push(P.advHeightAt(x, z));
  console.log('z=' + z + '  ' + hs.join(' '));
}

/* 垂直柱剖面: 每列自 y28 向下首个非空气=表面(含 id), 连同 y23/24/25/26/27 明细 */
console.log('\n=== 垂直柱剖面 x145..159 × z73..77(表面=自 y28 向下首个非空气) ===');
for (let z = 73; z <= 77; z++) {
  const row = [];
  for (let x = 145; x <= 159; x++) {
    let surf = '(全空)';
    for (let y = 28; y >= 18; y--) {
      const id = P.getBlock(x, y, z);
      if (id !== 0) { surf = 'y' + y + '=' + id; break; }
    }
    row.push(x + ':' + surf);
  }
  console.log('z=' + z + '  ' + row.join(' | '));
}

/* 开间带 z74/75 全柱明细(x150..159): y18..28 逐格 id(0 略作 ·) */
for (const z of [74, 75]) {
  console.log('\n=== z=' + z + ' 全柱明细 x150..159 ===');
  for (let x = 150; x <= 159; x++) {
    const col = [];
    for (let y = 18; y <= 28; y++) col.push(y + (P.getBlock(x, y, z) === 0 ? '·' : '(' + P.getBlock(x, y, z) + ')'));
    console.log('x=' + x + '  ' + col.join(' '));
  }
}

/* 现锚对照: 三向现锚落点覆盖格(确认探针口径能复现已锚达标) */
console.log('\n=== 三向现锚落点对照(同口径) ===');
const gates = P.ADV_HOME_EDGE_GATES;
for (const dir of Object.keys(gates)) {
  const g = gates[dir];
  const a = P.advMapArriveAt(g);
  const xs = [...new Set([Math.floor(a.x - 0.2), Math.floor(a.x + 0.2)])];
  const zs = [...new Set([Math.floor(a.z - 0.2), Math.floor(a.z + 0.2)])];
  for (const bx of xs) for (const bz of zs) {
    const y24 = P.getBlock(bx, 24, bz);
    const y25 = P.getBlock(bx, 25, bz);
    const y26 = P.getBlock(bx, 26, bz);
    console.log(`${dir} 锚(${g.px},${g.pz}) → 落点(${a.x},${a.z}) 格(${bx},${bz}) y24=${y24} y25=${y25} y26=${y26}`);
  }
}
console.log('\n补充探针完毕。');
