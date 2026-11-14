/* T-SEAM-03 east 锚施工探针(绿方施工工具, 不进 test/):
   复用 test/adventure-mode.test.js 的 harness boot 段(逐字节同款建场), 建出
   home 真世界后对候选锚做落点探针——口径=红测试 :4940 同款(脚箱半宽 0.2,
   覆盖格 {floor(x±0.2)}×{floor(z±0.2)}, y24 实垫可站立+y25/26 净空),
   并打印候选窗邻域 y25/y26 障碍 ASCII 图(路灯光照件现形用)。 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.join(__dirname, '..', '..'); /* .scratch/town-seam-change → 仓库根 */
const TEST_DIR = path.join(ROOT, 'test');
const src = fs.readFileSync(path.join(TEST_DIR, 'adventure-mode.test.js'), 'utf8');
const MARK = '/* ============ 测试 ============ */';
const boot = src.slice(0, src.indexOf(MARK));

/* 包装 require 到 test/ 目录(boot 内 require('../js/...') 按测试同构解析),
   __dirname/__filename 影射到 test/, 其余全局读写走真 globalThis(与测试同) */
const scopedRequire = Module.createRequire(path.join(TEST_DIR, 'probe-scoped.js'));
const capture = `
;globalThis.__probe = {
  freshInit, calls, spoken, api, AdventureMode, A,
  advHomeArriveGate, advMapArriveAt, ADV_HOME_EDGE_GATES, ADV_GATE_FACE,
  ADV_GROUND, getBlock, BLOCKS, MODES_DONE: true,
};`;
const fn = new Function('require', '__dirname', '__filename', 'module', 'exports',
  boot + capture);
fn(scopedRequire, TEST_DIR, path.join(TEST_DIR, 'probe-scoped.js'),
  {exports: {}}, undefined);

const P = globalThis.__probe;
P.freshInit(); /* 建场 home 真世界(loadScene 桩同步跑 fn, worldCells 真) */

const G = P.ADV_GATE_FACE.east;
const arrive = (px, pz) => ({
  x: px + G.cx + G.inx * 2.5, y: P.ADV_GROUND + 1,
  z: pz + G.cz + G.inz * 2.5, yaw: G.yawIn % (Math.PI * 2),
});
const idName = (id) => (id === 0 ? '空气(0)' : (P.BLOCKS[id] ? id + ':' + P.BLOCKS[id].name : String(id)));
const solid = (id) => id !== 0 && P.BLOCKS[id] && P.BLOCKS[id].solid !== false;

/* 候选锚(px, pz) → 落点(px-2, pz+2.5); 含窗口上下沿与邻格, 供比对 */
const candidates = [
  [156.5, 72.5], /* → 落点 (154.5, 75.0) = 票面「约 (154.5,75)」精确值 */
  [156.5, 72],   /* → 落点 (154.5, 74.5) */
  [156.5, 73],   /* → 落点 (154.5, 75.5) */
  [156, 72.5],   /* → 落点 (154, 75.0) */
  [157, 72.5],   /* → 落点 (155, 75.0) */
  [156, 72],     /* → 落点 (154, 74.5) */
  [157, 72],     /* → 落点 (155, 74.5) */
  [156, 73],     /* → 落点 (154, 75.5) */
  [157, 73],     /* → 落点 (155, 75.5) */
];

console.log('=== yaw 逐字节检查 ===');
console.log('Math.PI/2 + Math.PI === Math.PI*1.5 :', Math.PI / 2 + Math.PI === Math.PI * 1.5);

console.log('\n=== 候选锚落点探针(覆盖格 y24/25/26) ===');
for (const [px, pz] of candidates) {
  const a = arrive(px, pz);
  const xs = [...new Set([Math.floor(a.x - 0.2), Math.floor(a.x + 0.2)])];
  const zs = [...new Set([Math.floor(a.z - 0.2), Math.floor(a.z + 0.2)])];
  const cells = [];
  let ok = true;
  for (const bx of xs) {
    for (const bz of zs) {
      const y24 = P.getBlock(bx, 24, bz);
      const y25 = P.getBlock(bx, 25, bz);
      const y26 = P.getBlock(bx, 26, bz);
      const pass = solid(y24) && y25 === 0 && y26 === 0;
      ok = ok && pass;
      cells.push(`(${bx},${bz}) y24=${y24}(${idName(y24)}) y25=${y25} y26=${y26} ${pass ? 'OK' : 'FAIL'}`);
    }
  }
  console.log(`anchor(${px},${pz}) → 落点(${a.x},${a.z}) yaw=${a.yaw} ${ok ? '【可站立✓】' : '【不达标✗】'}`);
  for (const c of cells) console.log('   ' + c);
}

/* 邻域图: x150..156, z71..79, y24 地表 id / y25/y26 障碍(≠0 标 ●) */
console.log('\n=== 邻域 y24 地表 id 图(x150..156, z71..79) ===');
for (let z = 71; z <= 79; z++) {
  const ids = [];
  for (let x = 150; x <= 156; x++) ids.push(P.getBlock(x, 24, z));
  console.log('z=' + String(z).padStart(2, ' ') + '  ' + ids.join(' '));
}
console.log('\n=== 邻域 y25 障碍图(≠0 标 ●) x150..156 ===');
for (let z = 71; z <= 79; z++) {
  let row = 'z=' + String(z).padStart(2, ' ') + '  ';
  for (let x = 150; x <= 156; x++) {
    const id = P.getBlock(x, 25, z);
    row += (id === 0 ? '·' : '●');
  }
  console.log(row);
}
console.log('\n=== 邻域 y26 障碍图(≠0 标 ●) x150..156 ===');
for (let z = 71; z <= 79; z++) {
  let row = 'z=' + String(z).padStart(2, ' ') + '  ';
  for (let x = 150; x <= 156; x++) {
    const id = P.getBlock(x, 26, z);
    row += (id === 0 ? '·' : '●');
  }
  console.log(row);
}
console.log('\n=== 邻域 y24 上非草件明细(≠草与≠空气即列明细) ===');
for (let z = 71; z <= 79; z++) {
  for (let x = 150; x <= 156; x++) {
    const id = P.getBlock(x, 24, z);
    if (id !== 0) console.log(`(${x},${z}) y24=${idName(id)}`);
  }
}
console.log('\n探针完毕。');
