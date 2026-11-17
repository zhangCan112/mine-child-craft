'use strict';
/* T-C5 诊断探针: 复算 C 装具两界地形——下界 ns 落点与上界同坐标 y21 的自然块
   (判定红测 adventure-nether.test.js:1708 「===0」是否物理可达; 只读不改) */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/config.js', 'js/scene-kit.js', 'js/prefab-kit.js',
  'js/town-assembly-core.js', 'js/town-map-core.js',
  'js/town-interact-core.js', 'js/town-npc-anchor-core.js',
  'js/adventure-core.js', 'js/adventure-maps-core.js',
  'js/adventure-dims-core.js', 'js/items-core.js', 'js/craft-core.js',
  'js/inventory-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  WORLD_W, WORLD_H, WORLD_D, B_NETHERRACK,
  ADV_DIMS, advDimRow, ADV_MAPS, ADV_HOME_ROW, advBuildWorld, advHeightAt,
})`, eng);

const W = api.WORLD_W, H = api.WORLD_H, D = api.WORLD_D;
const mkCells = () => new (globalThis.Uint8Array || Uint8Array)(W * H * D);
const cellsN = mkCells();
const idx = (x, y, z) => (y * D + z) * W + x;
const setRaw = (x, y, z, id) => { cellsN[idx(x, y, z)] = id; };
const getRaw = (x, y, z) => cellsN[idx(x, y, z)];

/* 下界建场(dims-core 行 build; 装具同款直写; build 闭包经全局名调 setBlockRaw) */
eng.hashRand = (a, b, c) => 0.5; /* 确定性垫片: 只看地下分层, 地表装饰随机不参与判读 */
vm.runInContext('var setBlockRaw = null;', eng); /* 先占位再注入(闭包自由名走 eng 全局) */
const engApi = vm.runInContext('({set setBlockRawFn(fn) { this._setRaw = fn; }})', eng);
eng._setRaw = null;
const nrow = api.ADV_DIMS.find((r) => r.id === 'nether') || api.advDimRow('nether');
if (!nrow || typeof nrow.build !== 'function') {
  console.log('NO NETHER ROW BUILD: keys=' + JSON.stringify(api.ADV_DIMS && api.ADV_DIMS.map((r) => r.id)));
  process.exit(0);
}
vm.runInContext('globalThis.setBlockRaw = ' + '(function (x, y, z, id) { __probeSet(x, y, z, id); })', eng, {filename: 'probe-bridge.js'});
eng.__probeSet = setRaw;
nrow.build();
let ns = null;
for (let x = 46; x < 110 && !ns; x++) {
  for (let z = 46; z < 110; z++) {
    if (getRaw(x, 20, z) === api.B_NETHERRACK && getRaw(x, 21, z) === 0) { ns = {x, z}; break; }
  }
}
console.log('nether ns =', JSON.stringify(ns));

/* 上界 home 建场(maps-core 行 build 经 advBuildWorld; 装具同款) */
const hrow = api.ADV_HOME_ROW;
const row = api.ADV_MAPS.find((r) => r.id === 'home') || hrow;
if (typeof api.advBuildWorld !== 'function') {
  console.log('NO advBuildWorld');
  process.exit(0);
}
const cellsH = mkCells();
const setH = (x, y, z, id) => { cellsH[idx(x, y, z)] = id; };
const getH = (x, y, z) => cellsH[idx(x, y, z)];
vm.runInContext('globalThis.setBlockRaw = ' + '(function (x, y, z, id) { __probeSetH(x, y, z, id); })', eng, {filename: 'probe-bridge-h.js'});
eng.__probeSetH = setH;
vm.runInContext('globalThis.getBlock = ' + '(function (x, y, z) { return __probeGetH(x, y, z); })', eng, {filename: 'probe-bridge-geth.js'});
eng.__probeGetH = getH;
api.advBuildWorld();
if (ns) {
  console.log('overworld (ns.x,21,ns.z) =', getH(ns.x, 21, ns.z),
      ' heightAt =', api.advHeightAt ? api.advHeightAt(ns.x, ns.z) : 'n/a',
      ' y20..y25 =', [20, 21, 22, 23, 24, 25].map((y) => getH(ns.x, y, ns.z)).join(','));
}
