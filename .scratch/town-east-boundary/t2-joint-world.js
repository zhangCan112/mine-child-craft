'use strict';
/* T2-joint 世界层双态实拼对账 v3(联验票核心证据):
   经 dims 执行器全语义(SceneKit fill/tree/scrub/recolor + place=PrefabKit kernel)
   建场, 逐格 dump 南缘联验区 + 计数域/开口带/缓冲带实测。
   用法: node .scratch/t2-joint-world.js old|new <outFile>
   old = .scratch/old9ba 提取件(9ba1821), new = 工作树(b4cd21d)。
   CJS 侧(spawn-core/adventure-core/dims-core)两态间零差(diffstat 只 4 文件,
   均为 vm 侧), 恒指工作树。输出 ASCII 直写文件(7.3 纪律)。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const OLD = path.join(__dirname, 'old9ba');
const state = process.argv[2];
const outPath = process.argv[3];
if ((state !== 'old' && state !== 'new') || !outPath) {
  console.error('usage: node t2-joint-world.js old|new <outFile>');
  process.exit(2);
}
const VM_FILES = ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js',
  'js/voxel.js', 'js/scene-kit.js', 'js/items-core.js', 'js/inventory-core.js',
  'js/craft-core.js', 'js/drops.js', 'js/prefab-kit.js',
  'js/town-assembly-core.js', 'js/town-map-core.js'];

const eng = vm.createContext({console: {log() {}, warn() {}, error() {}},
  groundTop: () => 24});
for (const f of VM_FILES) {
  const p = state === 'old' ? path.join(OLD, f.slice(3)) : path.join(ROOT, f);
  vm.runInContext(fs.readFileSync(p, 'utf8'), eng, {filename: f});
}
Object.assign(globalThis,
    vm.runInContext('({TOWN_MAP, townBuildSteps, townAssemblyOps, PrefabKit})', eng));
Object.assign(globalThis, vm.runInContext(`({
  getBlock, setBlockRaw, SceneKit, Daylight, BLOCKS,
  WORLD_W, WORLD_D, WORLD_H,
  B_NETHERRACK, B_LAVA, B_GLOWSTONE, B_SPAWNER, B_OBSIDIAN, B_CHEST, B_TORCH,
  B_ANCIENT_DEBRIS, B_LOOT_CHEST_SMALL, B_PORTAL, B_NETHER_BRICK,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE,
})`, eng));
Object.assign(globalThis, require(path.join(ROOT, 'js', 'adventure-spawn-core.js')));
Object.assign(globalThis, require(path.join(ROOT, 'js', 'adventure-core.js')));
globalThis.ModeKit = {spawn: (x, y, z, o) => { /* 桩: 出生与本票无关 */ }};
const Dims = require(path.join(ROOT, 'js', 'adventure-dims-core.js'));

vm.runInContext('worldCells.fill(0)', eng);
Dims.townBuild();

const lines = [];
const dump = (x1, x2, y1, y2, z1, z2, tag) => {
  const rows = vm.runInContext(
      '(() => { const r = [];' +
      ' for (let x = ' + x1 + '; x <= ' + x2 + '; x++)' +
      ' for (let y = ' + y1 + '; y <= ' + y2 + '; y++)' +
      ' for (let z = ' + z1 + '; z <= ' + z2 + '; z++) {' +
      ' const v = getBlock(x, y, z); if (v !== 0) r.push(x + "," + y + "," + z + " " + v); }' +
      ' return r.join("\\n"); })()', eng);
  lines.push('## ' + tag + ' nonair=' + (rows ? rows.split('\n').length : 0));
  if (rows) lines.push(...rows.split('\n').sort());
};
const count = (x1, x2, y1, y2, z1, z2, tag) => {
  const zeros = vm.runInContext(
      '(() => { let n = 0;' +
      ' for (let x = ' + x1 + '; x <= ' + x2 + '; x++)' +
      ' for (let y = ' + y1 + '; y <= ' + y2 + '; y++)' +
      ' for (let z = ' + z1 + '; z <= ' + z2 + '; z++)' +
      ' if (getBlock(x, y, z) === 0) n++; return n; })()', eng);
  const vol = (x2 - x1 + 1) * (y2 - y1 + 1) * (z2 - z1 + 1);
  const line = tag + ' nonair=' + (vol - zeros) + '/' + vol;
  lines.push(line);
  console.log(line);
};

console.log('state=' + state);
count(32, 127, 24, 27, 128, 128, 'D south-edge count-domain x32..127 y24..27 z128');
count(76, 80, 25, 27, 128, 128, 'OPENING x76..80 y25..27 z128');
count(0, 159, 0, 47, 129, 131, 'BUFFER z129..131 x0..159 y0..47');
count(0, 159, 0, 47, 132, 159, 'TRIGGER-SOUTH z132..159 (expect 0)');
dump(60, 95, 18, 36, 125, 132, 'JOINT-REGION x60..95 y18..36 z125..132');
dump(0, 159, 0, 47, 129, 131, 'BUFFER-FULL z129..131 x0..159 y0..47');
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log('written ' + outPath);
