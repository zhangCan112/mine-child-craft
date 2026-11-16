'use strict';
/* T-C2 打回证据复现(绿方自证, 非测试): 逐条钉打回理由的事实面 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const DT = 1 / 60;

function loadScene() {
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['js/config.js', 'js/updraft-core.js', 'js/voxel.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('var keys = {}; var touchMove = {x: 0, y: 0}; var touchSprint = false;', ctx);
  vm.runInContext('globalThis.UPDRAFT_SIM = UpdraftCore.mkSim({read: getBlock, solidOf: isSolid});', ctx);
  vm.runInContext(`
    globalThis.__v = {
      getBlock, setBlockRaw, pos, vel, physics, keys,
      get onGround(){ return onGround; },
      get UPDRAFT_SIM(){ return typeof UPDRAFT_SIM !== 'undefined' ? UPDRAFT_SIM : undefined; },
      worldEvents, setGliderEquipped, isGliding, yaw,
    };
  `, ctx);
  const v = ctx.__v;
  for (let x = 38; x <= 46; x++) for (let z = 38; z <= 46; z++) v.setBlockRaw(x, 10, z, 3);
  v.UPDRAFT_SIM.add({x: 42, y: 11, z: 42, r: 1, h: 20, lift: 3});
  return v;
}

/* 证据A(#35): settle 预落地必置 worldEvents.land=true, 且无清零点 → 418 行
   断言 land===false 与旗标「置位同帧写入, 消费方自清」语义恒矛盾 */
{
  const v = loadScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  let settleLand = null;
  for (let i = 0; i < 200; i++) {
    v.physics(DT);
    if (v.onGround) { settleLand = v.worldEvents.land; break; }
  }
  console.log('证据A settle 首次贴地帧 worldEvents.land =', settleLand, '(断言418期望 false)');
}

/* 证据B(#34): 步行穿柱(柱区 x41..43)全程零展翼; 展翼首帧出现在走出装具地板
   (fill 至 x=46)后——raycast 向下落空 → gHeight=Infinity → 既有「走落展翼」 */
{
  const v = loadScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  for (let i = 0; i < 200; i++) { v.physics(DT); if (v.onGround) break; }
  v.yaw = 0;
  v.keys['KeyD'] = true;
  let firstGlide = -1;
  let firstOutside = -1;
  for (let i = 0; i < 120; i++) {
    v.physics(DT);
    if (firstGlide < 0 && v.isGliding()) firstGlide = i;
    if (firstOutside < 0 && v.pos.x > 46.99) firstOutside = i;
  }
  console.log('证据B 走出地板边缘帧(x>46.99) =', firstOutside,
    '· 首次展翼帧 =', firstGlide, '· 该帧 x =', firstGlide >= 0 ? '-(见下)' : '');
}

/* 证据C(#32): 站火格 collides 整格判定 → settle 贴整格顶 12(非半格 11.5);
   同场景从 12 起跳 spaceEdge → 展翼+升力(T-C2 起飞行为面在整格站面下成立) */
{
  const v = loadScene();
  v.setBlockRaw(42, 11, 42, 81); // 篝火块(thin 0.5)
  v.setGliderEquipped(true);
  v.pos.set(42.5, 12, 42.5);
  let stood = -1;
  for (let i = 0; i < 200; i++) { v.physics(DT); if (v.onGround) { stood = v.pos.y; break; } }
  console.log('证据C 站火格 settle 贴地 pos.y =', stood, '(红测钉 11.5=thin 半格面)');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  console.log('证据C 踩火起跳 isGliding =', v.isGliding(), '· vel.y =', v.vel.y.toFixed(3), '(T-C2 起飞行为面)');
}
