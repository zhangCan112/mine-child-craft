'use strict';
/* 体素模型 (js/voxel.js) 单测 — node --test (零依赖)
   运行: node --test test/voxel.test.js
   加载器: 同一 vm context 依次执行 config.js + voxel.js — 精确镜像浏览器
   <script defer> 的共享词法环境; 源文件零改动即可在 Node 里测 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadVoxel() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'voxel.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  /* input.js 的占位(仅 physics 在调用期读取); var → context 全局属性, 严格模式下自由变量可解析 */
  vm.runInContext('var keys = {}; var touchMove = {x:0, y:0}; var touchSprint = false;', ctx);
  /* 桥接: context 内可见全局词法名, 外部经 __v 访问; let 基本类型用 getter/setter 保持同步 */
  vm.runInContext(`
    globalThis.__v = {
      world, getBlock, setBlockRaw, isSolid, isOpaque, groundTop, hashRand, blockKey,
      packChunkData,
      raycastVoxel, pos, vel, collides, physics, collidesAtPlayer, worldEvents,
      setFly,
      keys, touchMove, touchSprint,
      get onGround(){ return onGround; }, set onGround(v){ onGround = v; },
      get yaw(){ return yaw; }, set yaw(v){ yaw = v; },
      get pitch(){ return pitch; }, set pitch(v){ pitch = v; },
      get flyMode(){ return flyMode; }, set flyMode(v){ flyMode = v; },
      PLAYER, WORLD_W, WORLD_D, WORLD_H, BLOCKS, B_FUSE, B_WATER,
    };
  `, ctx);
  return ctx.__v;
}

function fill(v, x0, y0, z0, x1, y1, z1, id) {
  for (let x=x0; x<=x1; x++) for (let y=y0; y<=y1; y++) for (let z=z0; z<=z1; z++) v.setBlockRaw(x, y, z, id);
}
const DT = 1/60;
function settle(v, maxFrames) { // 跑物理直到稳定(落地)或超帧
  for (let i=0; i<maxFrames; i++) {
    v.physics(DT); if (v.onGround) return i;
  }
  return -1;
}

/* ============ 方块存取 ============ */

test('方块存取: 写读回程, 越界与未设置返回 0', () => {
  const v = loadVoxel();
  assert.strictEqual(v.blockKey(1, 2, 3), '1,2,3');
  v.setBlockRaw(10, 20, 30, 3);
  assert.strictEqual(v.getBlock(10, 20, 30), 3);
  assert.strictEqual(v.getBlock(10, 20, 31), 0); // 未设置
  assert.strictEqual(v.getBlock(-1, 20, 30), 0); // x 越界
  assert.strictEqual(v.getBlock(10, -1, 30), 0); // y<0
  assert.strictEqual(v.getBlock(10, v.WORLD_H, 30), 0); // y≥WORLD_H
});

test('isSolid: 引线/水非实心, 石头实心, 未知 id 按实心(现状)', () => {
  const v = loadVoxel();
  assert.strictEqual(v.isSolid(0), false);
  assert.strictEqual(v.isSolid(3), true); // 石头
  assert.strictEqual(v.isSolid(v.B_FUSE), false); // 引线 thin + solid:false
  assert.strictEqual(v.isSolid(v.B_WATER), false); // 水 solid:false
  assert.strictEqual(v.isSolid(99), true); // 未知 id 兜底为实心(记录现状)
});

test('isOpaque: 玻璃与水可透视(相机防穿墙不收拢), 石头不透明', () => {
  const v = loadVoxel();
  assert.strictEqual(v.isOpaque(3), true); // 石头 → 相机收拢
  assert.strictEqual(v.isOpaque(18), false); // 玻璃 → 相机隔着玻璃透视
  assert.strictEqual(v.isOpaque(v.B_WATER), false); // 水
  assert.strictEqual(v.isOpaque(0), false); // 空气
});

test('groundTop: 自上而下扫到首个非空气; 空柱返回 0', () => {
  const v = loadVoxel();
  v.setBlockRaw(50, 3, 50, 3);
  v.setBlockRaw(50, 7, 50, 4);
  assert.strictEqual(v.groundTop(50, 50), 7);
  assert.strictEqual(v.groundTop(60, 60), 0);
});

test('groundTop 缓存一致性: 写入/移除按列失效重算, world.clear 连带清缓存', () => {
  const v = loadVoxel();
  fill(v, 5, 0, 5, 5, 2, 5, 3); // 一根 3 高石柱
  assert.strictEqual(v.groundTop(5, 5), 2); // 首查建立缓存
  v.setBlockRaw(5, 7, 5, 3); // 更高处放块 → 列失效
  assert.strictEqual(v.groundTop(5, 5), 7);
  v.setBlockRaw(5, 7, 5, 0); // 移除 → 回落
  assert.strictEqual(v.groundTop(5, 5), 2);
  for (let y=0; y<=2; y++) v.setBlockRaw(5, y, 5, 0); // 整柱挖空 → 0
  assert.strictEqual(v.groundTop(5, 5), 0);
  fill(v, 8, 0, 8, 8, 5, 8, 3);
  assert.strictEqual(v.groundTop(8, 8), 5);
  v.world.clear(); // 直清数据(测试/清场共用入口)
  assert.strictEqual(v.groundTop(8, 8), 0); // 不得返回清场前的旧缓存
});

/* ============ 区块数据打包 (packChunkData) ============ */
/* pack 是体素模型 → 网格化核心(主线程兜底 / Worker 消息)的数据边界:
   cells 布局约定 (y*d+lz)*w+lx 是跨线程传递的契约, 变更即破坏兼容 */

test('packChunkData: 尺寸/原点/索引布局 — border=1 时 18×18, 边界圈可读', () => {
  const v = loadVoxel();
  const p = v.packChunkData(1, 1, 1); // 区块(1,1): 世界 x/z 16..31
  assert.strictEqual(p.w, 18);
  assert.strictEqual(p.d, 18);
  assert.strictEqual(p.bx, 15); // 原点 = 区块原点 - border
  assert.strictEqual(p.bz, 15);
  v.setBlockRaw(15, 5, 20, 3); // 边界圈格(x=15 是区块左邻)
  v.setBlockRaw(16, 5, 20, 4); // 区块内部首列
  const p2 = v.packChunkData(1, 1, 1);
  assert.strictEqual(p2.cells[(5*18 + 5)*18 + 0], 3); // lz=20-16+1=5, lx=0 → 边界块
  assert.strictEqual(p2.cells[(5*18 + 5)*18 + 1], 4); // lx=1 → 内部块
});

test('packChunkData: 地图外边界圈读 0(区块 0,0 的 -X/-Z 邻是界外)', () => {
  const v = loadVoxel();
  const p = v.packChunkData(0, 0, 1);
  assert.strictEqual(p.cells[(5*18 + 5)*18 + 0], 0); // lx=0 ↔ x=-1 界外
  assert.strictEqual(p.cells[(5*18 + 0)*18 + 5], 0); // lz=0 ↔ z=-1 界外
});

test('packChunkData: yMax = 内部列最高实心(高塔), 空区块 yMax=0', () => {
  const v = loadVoxel();
  fill(v, 20, 0, 30, 20, 20, 30, 3); // 内部 21 高石柱
  assert.strictEqual(v.packChunkData(1, 1, 1).yMax, 20);
  assert.strictEqual(v.packChunkData(6, 6, 1).yMax, 0); // 空区块
});

test('packChunkData: border=0 时 16×16(LOD 用), 顶点行走不带边界圈', () => {
  const v = loadVoxel();
  const p = v.packChunkData(1, 1, 0);
  assert.strictEqual(p.w, 16);
  assert.strictEqual(p.bx, 16);
});

/* ============ 碰撞与物理 ============ */

test('collides: 站上方块之上为不碰撞(ε 收缩), 嵌入为碰撞', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3); // y=10 一层地板
  assert.strictEqual(v.collides(42.5, 10.5, 42.5), true); // 脚嵌入方块
  assert.strictEqual(v.collides(42.5, 11.0, 42.5), false);// 恰好站在顶面
});

test('physics: 重力下落到地板并落地(贴齐方块顶面)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.pos.set(42.5, 30, 42.5);
  const frames = settle(v, 2000);
  assert.ok(frames > 0, '应落地');
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.pos.y, 11); // 顶面吸附: 块顶 y=10 → 脚 y=11
  assert.strictEqual(v.vel.y, 0);
});

test('physics: 高速坠落不穿透单层薄板(轴向子步进 ≤0.25 格)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3); // 仅一层
  v.pos.set(42.5, 40, 42.5);
  const frames = settle(v, 3000); // 坠至限速 -30, 每帧位移 0.5 > 0.25
  assert.ok(frames > 0, '限速坠落必须被单层地板接住');
  assert.strictEqual(v.pos.y, 11);
});

test('physics: 世界边缘隐形墙夹取(双向)', () => {
  const v = loadVoxel();
  v.flyMode = true; // 飞行恒速, 避开地形干扰
  v.pos.set(120, 20, 64.5);
  v.keys['KeyD'] = true; // yaw=0 → +x 方向
  for (let i=0; i<400; i++) v.physics(DT);
  assert.ok(v.pos.x <= v.WORLD_W - v.PLAYER.hx + 1e-9, '东边界不得越出: ' + v.pos.x);
  v.keys['KeyD'] = false;
  v.keys['KeyA'] = true;
  for (let i=0; i<4000; i++) v.physics(DT);
  assert.ok(v.pos.x >= v.PLAYER.hx - 1e-9, '西边界不得越出: ' + v.pos.x);
});

test('physics: 坠出世界置 worldEvents.voidFall(引擎只报事件)', () => {
  const v = loadVoxel();
  v.pos.set(64.5, -5, 64.5);
  assert.strictEqual(v.worldEvents.voidFall, false);
  for (let i=0; i<600 && !v.worldEvents.voidFall; i++) v.physics(DT);
  assert.strictEqual(v.worldEvents.voidFall, true);
});

test('physics: flyMode 无重力, 空格升/Shift 降', () => {
  const v = loadVoxel();
  v.flyMode = true;
  v.keys['Space'] = true;
  v.physics(DT);
  assert.strictEqual(v.vel.y, 7);
  v.keys['Space'] = false;
  v.keys['ShiftLeft'] = true;
  v.physics(DT);
  assert.strictEqual(v.vel.y, -7);
});

test('setFly: 飞行态意图入口 — 置位并清垂直速度(切档不带残留升/坠速)', () => {
  const v = loadVoxel();
  v.vel.y = -12.5; // 预置残留坠速
  v.setFly(true);
  assert.strictEqual(v.flyMode, true);
  assert.strictEqual(v.vel.y, 0); // 清垂直速度是 setFly 的语义(照 build F 键既有行为)
  v.setFly(false); // 复位场景 vel.y 本就近 0, 清之无害
  assert.strictEqual(v.flyMode, false);
  assert.strictEqual(v.vel.y, 0);
});

test('physics: 落地状态下跳跃获得向上速度', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.pos.set(42.5, 11, 42.5);
  v.onGround = true;
  v.keys['Space'] = true;
  v.physics(DT);
  assert.strictEqual(v.vel.y, v.PLAYER.jump);
  assert.strictEqual(v.onGround, false);
});

/* ============ 自动跳 (MC 基岩版触屏默认, PLAYER.autoJump) ============ */

test('physics: autoJump 默认关(桌面口径), 开启标志由触屏环境派生', () => {
  const v = loadVoxel();
  assert.strictEqual(v.PLAYER.autoJump, false, 'Node 测试环境非触屏, 默认应关闭');
});

test('physics: autoJump 开启 → 贴地走向 1 格台阶自动攀上(不按跳跃键)', () => {
  const v = loadVoxel();
  v.PLAYER.autoJump = true;
  fill(v, 40, 10, 40, 50, 10, 44, 3); // 连续地板(y=10, 顶面 11)
  fill(v, 46, 11, 40, 50, 11, 44, 3); // 东侧 1 格台阶(y=11, 顶面 12)
  v.pos.set(42.5, 11, 42.5);
  settle(v, 200); // 先落地
  v.keys['KeyD'] = true; // yaw=0 → +x 走向台阶
  let stepped = false;
  for (let i = 0; i < 600; i++) {
    v.physics(DT);
    if (v.pos.y >= 12 - 1e-6 && v.pos.x > 45) {
      stepped = true; break; // 已站上台阶顶
    }
  }
  v.keys['KeyD'] = false;
  assert.ok(stepped, '应自动跳上台阶: pos=' + v.pos.x.toFixed(2) + ',' + v.pos.y.toFixed(2));
});

test('physics: autoJump 对 2 格高墙无效(头顶无净空不跳)', () => {
  const v = loadVoxel();
  v.PLAYER.autoJump = true;
  fill(v, 40, 10, 40, 50, 10, 44, 3);
  fill(v, 46, 11, 40, 50, 12, 44, 3); // 2 格高墙(y=11~12)
  v.pos.set(42.5, 11, 42.5);
  settle(v, 200);
  v.keys['KeyD'] = true;
  for (let i = 0; i < 120; i++) v.physics(DT); // 走到墙前贴住
  const yBefore = v.pos.y;
  for (let i = 0; i < 120; i++) v.physics(DT); // 贴墙久站不应反复跳
  v.keys['KeyD'] = false;
  assert.strictEqual(yBefore, 11, '墙前仍站在地面');
  assert.ok(v.pos.y <= 11.001, '2 格墙不可自动跳越: ' + v.pos.y);
  assert.ok(v.pos.x < 46 - v.PLAYER.hx + 1e-6, '不可穿墙: ' + v.pos.x);
});

test('physics: autoJump 关闭 → 贴台阶不跳(桌面行走口径不变)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 50, 10, 44, 3);
  fill(v, 46, 11, 40, 50, 11, 44, 3);
  v.pos.set(42.5, 11, 42.5);
  settle(v, 200);
  v.keys['KeyD'] = true;
  for (let i = 0; i < 300; i++) v.physics(DT);
  v.keys['KeyD'] = false;
  assert.ok(v.pos.x < 46 - v.PLAYER.hx + 1e-6, '台阶挡住去路: ' + v.pos.x);
  assert.strictEqual(v.pos.y, 11);
});

/* ============ 射线 ============ */

test('raycastVoxel: 向下命中地板并给出顶面法线', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  const hit = v.raycastVoxel({x: 42.5, y: 15.5, z: 42.5}, {x: 0, y: -1, z: 0}, 6);
  assert.ok(hit);
  assert.strictEqual(hit.y, 10);
  assert.strictEqual(hit.ny, 1); // 自上方进入 → 顶面法线
  assert.strictEqual(v.raycastVoxel({x: 42.5, y: 15.5, z: 42.5}, {x: 0, y: 1, z: 0}, 6), null); // 向上射空
  assert.strictEqual(v.raycastVoxel({x: 42.5, y: 15.5, z: 42.5}, {x: 0, y: -1, z: 0}, 2), null); // 距离不够
});

test('raycastVoxel: 侧向命中给出反向法线', () => {
  const v = loadVoxel();
  v.setBlockRaw(45, 15, 42, 3);
  const hit = v.raycastVoxel({x: 42.5, y: 15.5, z: 42.5}, {x: 1, y: 0, z: 0}, 6);
  assert.ok(hit);
  assert.strictEqual(hit.x, 45);
  assert.strictEqual(hit.nx, -1); // 自西侧进入 → 法线朝 -x
});

test('raycastVoxel: 命中距离 t 与实心过滤 filter (相机防穿墙用)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3); // y=10 石地板
  v.setBlockRaw(42, 14, 42, v.B_WATER); // 脚下隔一层水
  const eye = {x: 42.5, y: 15.5, z: 42.5}; const down = {x: 0, y: -1, z: 0};
  const anyHit = v.raycastVoxel(eye, down, 6);
  assert.ok(anyHit && anyHit.y === 14); // 默认: 水也算命中
  assert.ok(Math.abs(anyHit.t - 0.5) < 1e-9); // y15.5 → 水顶 15: 距离 0.5
  const solidHit = v.raycastVoxel(eye, down, 6, v.isSolid);
  assert.ok(solidHit && solidHit.y === 10); // 实心过滤: 穿过水命中地板
  assert.ok(Math.abs(solidHit.t - 4.5) < 1e-9); // y15.5 → 地板顶 11: 距离 4.5
});

test('hashRand: 确定性且落在 [0,1)', () => {
  const v = loadVoxel();
  const a = v.hashRand(123, 456);
  assert.strictEqual(a, v.hashRand(123, 456));
  assert.ok(a >= 0 && a < 1);
  assert.notStrictEqual(a, v.hashRand(124, 456));
});
