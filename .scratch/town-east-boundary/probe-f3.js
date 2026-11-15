'use strict';
/* probe-f3.js — F3 红测前地形勘察(一次性探针, 不入库不进测试面):
   1) 前街各关键列 top(158/159,z) 高度场——塔最高原则的地形前提;
   2) 全建场后 (158/159, top, 74/75) 表面 id——确认 E1 件 D 的土面现状
      (= skyline 内 advEdgeRewrite 草皮→土面那笔确实命中=表面在建场序里曾是草皮,
      F3 改 pick [13,0] 即适用 helper, 无需退直写)。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..', '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/prefab-kit.js', 'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js',
  'js/cascade-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, blockKey, isOpaque, SceneKit, PrefabKit, Daylight, groundTop,
  BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT, B_BED, B_BED_FOOT,
  B_FARMLAND, B_WHEAT_3, B_FLOWER_Y, B_FLOWER_W, B_CACTUS,
  B_WHEAT_0, B_WHEAT_1, B_WHEAT_2,
  B_SNOW, B_ICE, B_SANDSTONE, B_GLOWSTONE, B_CHEST,
  B_SNOWY_GRASS, B_DEAD_BUSH, B_ORCHID,
  B_SNOWY_LEAVES, B_IRON_BLOCK, B_PUMPKIN, B_CARVED_PUMPKIN,
  B_DOOR, B_DOOR_TOP, B_DOOR_OPEN, B_DOOR_TOP_OPEN, B_GLASS_PANE,
  B_SPAWNER, B_OBSIDIAN, B_PORTAL, B_NETHER_BRICK,
})`, eng);
Object.assign(globalThis, api);
Object.assign(globalThis, require(path.join(ROOT, 'js/adventure-spawn-core.js')));
const Core = require(path.join(ROOT, 'js/adventure-core.js'));
Object.assign(globalThis, Core);
const Maps8 = require(path.join(ROOT, 'js/adventure-maps-core.js'));
Object.assign(globalThis, Maps8);

Core.advBuildWorld();
const cell = (x, y, z) => vm.runInContext('worldCells', eng)[(y * api.WORLD_D + z) * api.WORLD_W + x];
const top = (x, z) => Core.ADV_GROUND + Core.advHeightAt(x, z);
console.log('ADV_GROUND=' + Core.ADV_GROUND);
for (const z of [24, 40, 56, 72, 73, 74, 75, 76, 77, 88, 108, 120]) {
  console.log('top(158,' + z + ')=' + top(158, z) + ' (h=' + Core.advHeightAt(158, z) + ')' +
      '  top(159,' + z + ')=' + top(159, z) + ' (h=' + Core.advHeightAt(159, z) + ')');
}
console.log('surface(158,74)=' + cell(158, top(158, 74), 74) + ' surface(159,75)=' + cell(159, top(159, 75), 75));
const towerTop = top(158, 74);
console.log('tower yb+11=' + (towerTop + 11) + '; 房 z56 h5 火把顶=' + (top(158, 56) + 5 + 2));
/* 两次采样 x158 列最高非空块(树 8402 在 z40/108, 看圆冠树实际到多高, 塔最高口径核实) */
for (const z of [40, 108]) {
  let hi = -1;
  for (let y = 0; y < api.WORLD_H; y++) if (cell(158, y, z) !== 0) hi = y;
  console.log('x158 z' + z + ' 最高非空块 y=' + hi + ' (塔尖 yb+11=' + (towerTop + 11) + ')');
}

/* ---- F3 红测逐条核值(现 HEAD 应全数与期望不符=红得有据; 印证测试坐标无笔误) ---- */
console.log('---- F3 断言逐条现值(期望 => 现值) ----');
const tt2 = top(158, 74);
const hTop = top(158, 56);
const rows = [
  ['塔身 z73 (158,yb+1,73)', 13, cell(158, tt2 + 1, 73)],
  ['塔身龛后壁 (159,yb+1,74)', 13, cell(159, tt2 + 1, 74)],
  ['塔身顶 (158,yb+8,73)', 13, cell(158, tt2 + 8, 73)],
  ['龛灯 (158,yb+1,74)', api.B_TORCH, cell(158, tt2 + 1, 74)],
  ['龛净空 (158,yb+2,74)', 0, cell(158, tt2 + 2, 74)],
  ['钟面下 (158,yb+6,74)', 17, cell(158, tt2 + 6, 74)],
  ['钟面上 (158,yb+7,74)', 17, cell(158, tt2 + 7, 74)],
  ['塔檐 z73 (158,yb+9,73)', 17, cell(158, tt2 + 9, 73)],
  ['塔檐远角 (159,yb+9,76)', 17, cell(159, tt2 + 9, 76)],
  ['檐灯 (158,yb+9,74)', 19, cell(158, tt2 + 9, 74)],
  ['瓦顶一级 (158,yb+10,74)', 79, cell(158, tt2 + 10, 74)],
  ['瓦顶二级 (158,yb+11,74)', 79, cell(158, tt2 + 11, 74)],
  ['瓦顶二级 x159', 79, cell(159, tt2 + 11, 74)],
  ['塔尖上方净空', 0, cell(158, tt2 + 12, 74)],
  ['首屋门 (158,top+1,24)', 6, cell(158, top(158, 24) + 1, 24)],
  ['房门 (158,hTop+1,56)', 6, cell(158, hTop + 1, 56)],
  ['房窗 (158,hTop+2,56)', 18, cell(158, hTop + 2, 56)],
  ['房墙 (158,hTop+4,56)', 5, cell(158, hTop + 4, 56)],
  ['房墙顶 x159', 5, cell(159, hTop + 5, 56)],
  ['房瓦顶 (158,hTop+6,56)', 79, cell(158, hTop + 6, 56)],
  ['石板 (158,74)', 13, cell(158, tt2, 74)],
  ['石板 (159,75)', 13, cell(159, top(159, 75), 75)],
  ['石板 (159,74)', 13, cell(159, top(159, 74), 74)],
  ['石板 (158,75)', 13, cell(158, top(158, 75), 75)],
];
for (const [label, want, got] of rows) console.log(label + ': ' + want + ' => ' + got);
for (const [hz, hh] of [[24, 3], [56, 5], [88, 4], [120, 3]]) {
  console.log('窗灯 z' + hz + ' (158,top+' + (hh + 2) + '): ' + api.B_TORCH + ' => ' + cell(158, top(158, hz) + hh + 2, hz));
}
for (const wz of [72, 77]) {
  const wt = top(158, wz);
  console.log('迎宾柱 z' + wz + ' 下/上/顶: 17/17/19 => ' + cell(158, wt + 1, wz) + '/' + cell(158, wt + 2, wz) + '/' + cell(158, wt + 3, wz));
}
let strip79 = 0;
for (let y = 0; y < api.WORLD_H; y++) {
  for (let z = 0; z < api.WORLD_D; z++) {
    for (let x = 158; x <= 159; x++) if (cell(x, y, z) === 79) strip79++;
  }
}
console.log('条带 79 计数: 24 => ' + strip79);

