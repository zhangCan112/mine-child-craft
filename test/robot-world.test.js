'use strict';
/* 怪物指挥官世界宿主单测 — node --test (零依赖)
   运行: node --test test/robot-world.test.js
   覆盖: 演示/回放炸格的「地形复原」契约 —— skillBoom 把软障碍从 3D 世界
   炸掉(editBlock→0)后, 棋盘数据(RobotCore board.cells)永不改变、sim 的
   cleared 随 mkSim 重开即复原, 世界侧必须同拍复原, 否则演示/回放结束
   后编程阶段看到的是 changed 地形(真机 bug: 自动演示炸掉木板箱不还原)。
   断言两条复原路径: ① demo 走完(带2+ 自动演示先看后编程) ② play 失败
   倒放回滚归位(rollback 终点=重新编辑)。
   加载器: robot-world 是「THREE/DOM 全惰性」库, require 直载 + 桩全局
   (loadScene/setBlockRaw/getBlock/editBlock/markDirty 同步内存世界 Map,
   Mobs/ModeKit/CameraRig/sfx 全 noop) —— 桩面即世界缝, 断言直读世界态。
   棋盘与卡列全走 RandCore 种子链(真关 i=76 带3 boom 关), 零 Math.random,
   确定性红线不受影响。 */
const test = require('node:test');
const assert = require('node:assert');

/* 桩世界: 键 'x,y,z' → 方块 id(与 setBlockRaw 同面) */
const world = new Map();
const key = (x, y, z) => x + ',' + y + ',' + z;
global.loadScene = (fn) => fn(); // 同步执行建场闭包
global.setBlockRaw = (x, y, z, id) => world.set(key(x, y, z), id);
global.getBlock = (x, y, z) => (world.has(key(x, y, z)) ? world.get(key(x, y, z)) : 0);
global.editBlock = (x, y, z, id) => world.set(key(x, y, z), id);
global.markDirty = () => {};
global.SceneKit = {fill: (x0, y0, z0, x1, y1, z1, id) => {
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) world.set(key(x, y, z), id);
    }
  }
}};
/* 木偶/出生/镜头/声音全 noop — 本文件只验世界数据面。
   木偶桩例外: setPos/steer 真记(归位断言要读木偶位置), spawned 收集实例 */
const spawned = [];
const mkPuppet = () => ({pos: {x: 0, y: 0, z: 0}, yaw: 0, pose: {}});
global.Mobs = {spawn: () => {
  const p = mkPuppet();
  spawned.push(p);
  return p;
}, scaleTo() {}, setPos(m, x, z) {
  m.pos.x = x;
  m.pos.z = z;
}, steer(m, yaw) {
  m.yaw = yaw;
}, settle() {}, stagger() {}, gait() {}, update() {}, render() {}, clear() {}};
global.ModeKit = {spawn() {}};
global.CameraRig = {mount() {}};
global.sfx = () => {};
global.pitch = 0;
global.scene = {add() {}, remove() {}}; // clearFx 摘挂件用(真挂件已因无 THREE 不建)
global.clearWorld = () => {}; // RobotWorld.stop 退场清场收口

global.RandCore = require('../js/rand-core.js');
global.CampCore = require('../js/camp-core.js'); // robot-levels 顶层图章一本即用
global.RobotCore = require('../js/robot-core.js');
const Levels = require('../js/robot-levels.js');
global.paramsFor = Levels.paramsFor;
global.boardSeed = Levels.boardSeed;
global.boardOpts = Levels.boardOpts;
global.ROBOT_PACKS = Levels.ROBOT_PACKS;
const RobotWorld = require('../js/robot-world.js');

const SOFT_ID = 6; // robot-world ROBOT_BLOCKS.soft(木板箱)
const GROUND_Y = 12; // ROBOT_GROUND

/* 找一块「自动演示会炸格」的真盘: 带3 normal 关(previewSec>0 才有自动
   演示; 带3 非 relay 包轮换出 golem(smash)/creeper(boom)), 解里含 S 卡、
   且 S 步真炸(intents 'skill'), par 最短优先(测试提速) */
function pickBoomBoard() {
  let best = null;
  for (const level of Levels.ROBOT_LEVELS) {
    if (level.kind !== 'normal' || Levels.paramsFor(level).skill !== 'boom') continue;
    for (let boardIdx = 0; boardIdx < 4; boardIdx++) {
      const board = RobotCore.mkBoard(Levels.boardSeed(level.i, boardIdx),
          Levels.boardOpts(level));
      const sol = RobotCore.parSolution(board);
      if (!sol || !sol.includes('S')) continue;
      const sim = RobotCore.mkSim(board);
      let skillAt = -1;
      for (let i = 0; i < sol.length; i++) {
        const r = RobotCore.stepSim(board, sim, sol[i]);
        if (r.intent === 'skill') {
          skillAt = i;
          break;
        }
        Object.assign(sim, r.sim);
      }
      if (skillAt < 0) continue;
      if (!best || sol.length < best.sol.length) {
        best = {level, boardIdx, board, sol, skillAt};
      }
    }
  }
  assert.ok(best, '关卡库里必须存在演示炸格盘(教学闸保证)');
  return best;
}

/* S 步炸的是「面前一格」: 从 sim 态取朝向邻格(同 skillBoom 取格式) */
function boomCellOf(picked) {
  const sim = RobotCore.mkSim(picked.board);
  for (let i = 0; i < picked.skillAt; i++) {
    Object.assign(sim, RobotCore.stepSim(picked.board, sim, picked.sol[i]).sim);
  }
  const d = RobotCore.DIRS[sim.dir];
  const x0 = 64 - Math.floor(picked.board.w / 2);
  const z0 = 64 - Math.floor(picked.board.h / 2);
  return {
    board: {x: sim.x + d.dx, z: sim.z + d.dz},
    world: {x: x0 + sim.x + d.dx, y: GROUND_Y, z: z0 + sim.z + d.dz},
  };
}

/* 前缀 = 解里走到「踩上炸坑格」那一步为止(S 炸 → 打盹×2 吞卡 → 穿坑的 F)
   ——保证脚印会落在坑格上, 复原互锁(pitPrevAt)被真实覆盖 */
function prefixToBoomCell(picked) {
  const cell = boomCellOf(picked).board;
  const sim = RobotCore.mkSim(picked.board);
  for (let i = 0; i < picked.sol.length; i++) {
    const r = RobotCore.stepSim(picked.board, sim, picked.sol[i]);
    Object.assign(sim, r.sim);
    if (r.intent === 'move' && sim.x === cell.x && sim.z === cell.z) {
      return picked.sol.slice(0, i + 1);
    }
  }
  return picked.sol.slice(); // 兜底: 全解(必然踩过坑格)
}

/* 出生格世界坐标(镜像 build 的 wx/wz + 0.5 格心) */
function startCellOf(picked) {
  const x0 = 64 - Math.floor(picked.board.w / 2);
  const z0 = 64 - Math.floor(picked.board.h / 2);
  return {x: x0 + picked.board.start.x + 0.5, z: z0 + picked.board.start.z + 0.5};
}

/* 驱动演示到走完: demo 链的动画靠 RobotWorld.tick 每帧推进(浏览器主循环喂,
   测试用 interval 泵代打), 否则木偶从未挪窝、归位断言空洞 */
async function runDemo(handle, cards) {
  const done = new Promise((res) => handle.demo(cards, 0, res));
  const pump = setInterval(() => RobotWorld.tick(0.05), 5);
  try {
    await done;
  } finally {
    clearInterval(pump);
  }
}

test('demo: 演示炸格走完后地形复原(木板箱回原位)', async () => {
  const picked = pickBoomBoard();
  const cell = boomCellOf(picked).world;
  const handle = RobotWorld.build(picked.level, picked.boardIdx);
  const mob = spawned[spawned.length - 1]; // 本盘 mobA(非 relay 盘仅一只)
  assert.strictEqual(global.getBlock(cell.x, cell.y, cell.z), SOFT_ID,
      '建场后炸点必须是木板箱(缝自检)');
  await runDemo(handle, prefixToBoomCell(picked));
  assert.strictEqual(global.getBlock(cell.x, cell.y, cell.z), SOFT_ID,
      '演示结束编程阶段: 炸掉的软障碍必须复原(棋盘数据从未变过)');
  const home = startCellOf(picked);
  assert.strictEqual(mob.pos.x, home.x, '演示结束木偶归位 x(与地形复原同拍)');
  assert.strictEqual(mob.pos.z, home.z, '演示结束木偶归位 z(不能停在半路等编程)');
  handle.play([], {onDone: () => {}}); // 空程序触发 resetToStart: 脚印账清完仍应是原块
  assert.strictEqual(global.getBlock(cell.x, cell.y, cell.z), SOFT_ID,
      '踩坑脚印清账后不得把复原块重新挖成坑(账本互锁)');
  RobotWorld.stop();
});

test('play 失败 → rollback 归位后地形复原(重新编辑看原盘)', async () => {
  const picked = pickBoomBoard();
  const cell = boomCellOf(picked).world;
  const handle = RobotWorld.build(picked.level, picked.boardIdx);
  const prefix = prefixToBoomCell(picked);
  /* 炸完接「必撞墙」尾巴: 1~3 卡全空间确定性搜 status='bonk'
     (写死 L,F 会撞进装饰开的洞, status 变 out) */
  const tails = [[]].concat(RobotCore.CARDS.map((c) => [c]),
      RobotCore.CARDS.flatMap((a) => RobotCore.CARDS.map((b) => [a, b])),
      RobotCore.CARDS.flatMap((a) => RobotCore.CARDS.flatMap((b) =>
        RobotCore.CARDS.map((c) => [a, b, c]))));
  const tail = tails.find((t) =>
    RobotCore.simulate(picked.board, prefix.concat(t)).status === 'bonk');
  assert.ok(tail, '必须存在三卡内的撞墙尾巴(棋盘四面有硬墙)');
  const trace = [];
  const status = await new Promise((res) => {
    handle.play(prefix.concat(tail), {
      onStep: (i, intent) => trace.push({intent, x: handle.sim.x, z: handle.sim.z}),
      onDone: (st) => res(st),
    });
  });
  assert.strictEqual(status, 'bonk', '测试程序必须以撞墙收场(进倒放)');
  assert.strictEqual(global.getBlock(cell.x, cell.y, cell.z), 0,
      '回放进行中炸坑保持(演的是这一炸)');
  await new Promise((res) => handle.rollback(trace, res));
  assert.strictEqual(global.getBlock(cell.x, cell.y, cell.z), SOFT_ID,
      '倒放归位=重新编辑: 地形必须与棋盘数据一致(复原)');
  RobotWorld.stop();
});
