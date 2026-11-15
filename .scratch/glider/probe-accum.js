'use strict';
/* T-G02 回执探针: 证伪/证实 assertAccumCleared 助手的两个测试侧缺陷
   用法: node .scratch/glider/probe-accum.js  (只读 js/, 不碰测试) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const DT = 1/60;

function makeCtx() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'voxel.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('var keys = {}; var touchMove = {x:0, y:0}; var touchSprint = false;', ctx);
  return ctx;
}
const g = (ctx, e) => vm.runInContext(e, ctx);

function scenario(equipped, dropZ) {
  const ctx = makeCtx();
  vm.runInContext(`
    function fill(x0,y0,z0,x1,y1,z1,id){for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)setBlockRaw(x,y,z,id);}
    fill(40,8,40,43,8,44,3); for(let y=9;y<=10;y++)fill(40,y,40,43,y,44,B_WATER); // 池
    fill(48,10,40,54,10,44,3); // 干地板 z∈[40,44]
  `, ctx);
  g(ctx, `setGliderEquipped(${equipped})`);
  g(ctx, `pos.set(42, ${equipped ? 25 : 20}, 42)`); // T11 滑翔入水 / T10 无翼坠水
  for (let i = 0; i < 600 && !g(ctx, 'worldEvents.splash'); i++) g(ctx, 'physics')(DT);
  for (let i = 0; i < 600 && !g(ctx, 'onGround'); i++) g(ctx, 'physics')(DT);
  console.log(`[equipped=${equipped} dropZ=${dropZ}] 池底: onGround=${g(ctx,'onGround')} splash=${g(ctx,'worldEvents.splash')} pos.y=${g(ctx,'pos.y')}`);
  // 缺陷1 复现: 原样照抄助手(循环被 stale onGround 预空)
  g(ctx, `pos.set(51.5, 15, ${dropZ})`);
  let frames = 0;
  while (!g(ctx, 'onGround') && frames < 600) { g(ctx, 'physics')(DT); frames++; }
  console.log(`  缺陷1(照抄助手): 循环实际跑帧=${frames} land=${g(ctx,'worldEvents.land')} landFall=${g(ctx,'worldEvents.landFall')}`);
  // 缺陷2 检验: 强制 onGround=false 让下落真跑(等价红方修 stale)
  g(ctx, `pos.set(51.5, 15, ${dropZ}); onGround = false;`);
  vm.runInContext('worldEvents.land = false; worldEvents.landFall = 0;', ctx);
  frames = 0;
  while (!g(ctx, 'onGround') && frames < 600) { g(ctx, 'physics')(DT); frames++; }
  console.log(`  缺陷2(强置 onGround=false): 落地=${g(ctx,'onGround')} 帧数=${frames} 终点y=${g(ctx,'pos.y').toFixed(2)} voidFall=${g(ctx,'worldEvents.voidFall')} gliding=${g(ctx,'isGliding()')} land=${g(ctx,'worldEvents.land')} landFall=${g(ctx,'worldEvents.landFall').toFixed(3)}`);
}

scenario(false, 51.5); // T10 链路原坐标
scenario(true, 51.5);  // T11 链路原坐标
scenario(false, 42.5); // T10 链路换到地板上方 z(缺陷1 消除后的对照)
scenario(true, 42.5);  // T11 链路换到地板上方 z(装备位再展翼的对照)
