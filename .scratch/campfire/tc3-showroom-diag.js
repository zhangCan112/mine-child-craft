'use strict';
/* T-C3 诊断: showroom eng 域 cfKitResolve 三分支走向(一次性, 非交付件) */
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/voxel.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const r = vm.runInContext(`({
  hasCampfireKit: typeof CampfireKit !== 'undefined',
  hasRequire: typeof require === 'function',
  hasQuenchPure: typeof advCampfireQuenchHit === 'function',
  hasGetBlock: typeof getBlock === 'function',
})`, eng);
console.log('eng 域解析面:', JSON.stringify(r));
test('diag', () => { });
