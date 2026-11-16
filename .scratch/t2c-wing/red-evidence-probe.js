'use strict';
/* T2c 红起步实证探针(票令 5 留痕): 翼墙/端头墩列当前世界逐格 dump +
   裙板笔独立态(mountain-skirt 单条目)在翼/墩列的列顶实测。
   结论预期(裁定前提 vs 实测的核对面):
   - 翼/墩列裙板顶=24(非 25)→ 施工案 wing/pier y25..26 的 y25 是
     「裙板顶上方新增块」, 非「与裙板顶块同格幂等」;
   - 回改 y26..27 后 y25 格=空气(露 1 格缝), 高台顶块(裙板顶 24)原貌从未被覆写。
   运行: node .scratch/t2c-wing/red-evidence-probe.js (仓库根) */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..', '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
for (const f of ['js/prefab-kit.js', 'js/town-assembly-core.js', 'js/town-map-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/adventure-dims-core.js'), 'utf8'),
    eng, {filename: 'js/adventure-dims-core.js'});

/* 1) 裙板笔独立态: mountain-skirt 单条目派生, 翼/墩列 z29..31 各行列顶 */
const skirtOps = vm.runInContext(`(() => {
  const steps = townBuildSteps().filter((b) => b.id === 'mountain-skirt');
  return townAssemblyOps(steps).filter((o) => o.op === 'fill');
})()`, eng);
console.log('== 裙板笔独立态(mountain-skirt 单条目 fill 笔) ==');
for (const x of [16, 20, 30, 31, 35, 80, 124, 129, 135, 143]) {
  const tops = {};
  for (const o of skirtOps) {
    if (o.x1 <= x && o.x2 >= x) {
      for (let z = Math.max(o.z1, 29); z <= Math.min(o.z2, 31); z++) {
        tops[z] = Math.max(tops[z] || 0, o.y2);
      }
    }
  }
  console.log('  x=' + x + ' 各行列顶(z29/z30/z31)= ' +
      [29, 30, 31].map((z) => tops[z]).join('/'));
}

/* 2) 当前世界(施工案 y25..26)翼/墩列逐格 dump y23..28 */
vm.runInContext('worldCells.fill(0)', eng);
vm.runInContext('var ModeKit = {spawn() {}}', eng); /* 出生收口桩(探针不查出生) */
vm.runInContext('ADV_DIMS.find((r) => r.id === "town").build()', eng);
const getBlock = vm.runInContext('getBlock', eng);
console.log('== 当前世界(施工案)翼/墩列逐格 y23..28(格值 0=空) ==');
const cols = [[20, 31, '西翼墙取样'], [135, 31, '东翼墙取样'],
  [16, 30, '西墩中行'], [16, 29, '西墩北行'], [16, 31, '西墩南行(与翼合角)'],
  [143, 31, '东墩南行(与翼合角)'], [143, 30, '东墩中行']];
for (const [x, z, tag] of cols) {
  const ys = [];
  for (let y = 23; y <= 28; y++) ys.push(y + ':' + getBlock(x, y, z));
  console.log('  (' + x + ',z' + z + ') ' + tag + ' → ' + ys.join(' '));
}
