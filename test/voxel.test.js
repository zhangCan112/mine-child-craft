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
      packChunkData, lightSky, lightBlock, lightSkyAt, lightBlockAt,
      raycastVoxel, pos, vel, collides, physics, collidesAtPlayer, worldEvents,
      setFly,
      /* T-G02 滑翔意图 API 用惰性 getter 桥接: 红阶段(引擎未实现)既有 29 条零波及,
         新测试访问即得干净的 API 缺失红(ReferenceError), 绿阶段返回真函数 */
      get setGliderEquipped(){ return setGliderEquipped; }, // 装备位意图注入(模式层唯一写面)
      get isGliding(){ return isGliding; }, // 滑翔态可读出口(T-G04 展/收翼驱动消费)
      keys, touchMove, touchSprint,
      get onGround(){ return onGround; }, set onGround(v){ onGround = v; },
      get yaw(){ return yaw; }, set yaw(v){ yaw = v; },
      get pitch(){ return pitch; }, set pitch(v){ pitch = v; },
      get flyMode(){ return flyMode; }, set flyMode(v){ flyMode = v; },
      get gliding(){ return gliding; }, // T-G02 滑翔旗标(内部态只读桥接; 写面仅 physics/setGliderEquipped)
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

/* ============ 双通道光场存储 (D2, docs/mc-daylight-torch-design.md §3.3/§3.4) ============ */

test('lightSkyAt/lightBlockAt: 界内默认 0, 越界口径 sky 15 / block 0', () => {
  const v = loadVoxel();
  assert.strictEqual(v.lightSkyAt(10, 20, 30), 0); // 界内未算光照 = 0
  assert.strictEqual(v.lightBlockAt(10, 20, 30), 0);
  assert.strictEqual(v.lightSkyAt(-1, 20, 30), 15); // x<0
  assert.strictEqual(v.lightSkyAt(v.WORLD_W, 20, 30), 15); // x≥W
  assert.strictEqual(v.lightSkyAt(10, 20, -1), 15); // z<0
  assert.strictEqual(v.lightSkyAt(10, 20, v.WORLD_D), 15); // z≥D
  assert.strictEqual(v.lightSkyAt(10, -1, 30), 15); // y<0(界外=天光全亮, 与空气口径一致)
  assert.strictEqual(v.lightSkyAt(10, v.WORLD_H, 30), 15); // y≥H
  assert.strictEqual(v.lightBlockAt(-1, 20, 30), 0); // block 越界一律 0
  assert.strictEqual(v.lightBlockAt(10, -1, 30), 0);
  assert.strictEqual(v.lightBlockAt(10, v.WORLD_H, 30), 0);
});

test('光场存取: lightSky/lightBlock 与 worldCells 同址编号(cellIdx)', () => {
  const v = loadVoxel();
  const i = (10 * v.WORLD_D + 30) * v.WORLD_W + 10; // cellIdx 同式
  v.lightSky[i] = 7;
  v.lightBlock[i] = 12;
  assert.strictEqual(v.lightSkyAt(10, 10, 30), 7);
  assert.strictEqual(v.lightBlockAt(10, 10, 30), 12);
});

test('packChunkData: 载荷含 sky/block 光照圈(与 cells 同形状同布局, 界外圈 sky 15/block 0)', () => {
  const v = loadVoxel();
  const i = (x, y, z) => (y * v.WORLD_D + z) * v.WORLD_W + x;
  v.lightSky[i(15, 5, 20)] = 9; // 边界圈格(x=15 是区块(1,1)左邻)
  v.lightBlock[i(15, 5, 20)] = 3;
  v.lightSky[i(16, 5, 20)] = 14; // 区块内部首列
  v.lightBlock[i(16, 5, 20)] = 6;
  const p = v.packChunkData(1, 1, 1);
  assert.strictEqual(p.sky[(5 * 18 + 5) * 18 + 0], 9); // lz=20-16+1=5, lx=0 → 边界圈
  assert.strictEqual(p.block[(5 * 18 + 5) * 18 + 0], 3);
  assert.strictEqual(p.sky[(5 * 18 + 5) * 18 + 1], 14); // lx=1 → 内部
  assert.strictEqual(p.block[(5 * 18 + 5) * 18 + 1], 6);
  assert.strictEqual(p.sky.length, 18 * 18 * v.WORLD_H); // 与 cells 同形状
  assert.strictEqual(p.block.length, 18 * 18 * v.WORLD_H);
  const p00 = v.packChunkData(0, 0, 1); // 区块(0,0) 的 -X/-Z 邻是界外
  assert.strictEqual(p00.sky[(5 * 18 + 5) * 18 + 0], 15); // 界外圈 = 天光全亮
  assert.strictEqual(p00.block[(5 * 18 + 5) * 18 + 0], 0); // 界外圈无方块光
  assert.strictEqual(p00.sky[(5 * 18 + 0) * 18 + 5], 15); // z 界外同理
  assert.strictEqual(p00.block[(5 * 18 + 0) * 18 + 5], 0);
});

test('world.clear: 连带清空双通道光场(直清数据必须整体)', () => {
  const v = loadVoxel();
  const i = (x, y, z) => (y * v.WORLD_D + z) * v.WORLD_W + x;
  v.setBlockRaw(8, 8, 8, 3);
  v.lightSky[i(8, 8, 8)] = 15;
  v.lightBlock[i(8, 8, 8)] = 14;
  v.world.clear();
  assert.strictEqual(v.lightSkyAt(8, 8, 8), 0); // 不得残留清场前的光值
  assert.strictEqual(v.lightBlockAt(8, 8, 8), 0);
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

/* ============ 滑翔物理 (T-G02: spec §3.4 五态/§3.5 落差计量/§3.9 初值 + ADR 0016) ============
   引擎层滑翔状态机契约: 装备位意图注入 setGliderEquipped(模式层唯一写面, 语义=玩家
   背着滑翔翼) · 滑翔态出口 isGliding()(T-G04 展/收翼驱动消费) · land 事件缝
   worldEvents.land + landFall(本次落差格数) + landGliding(触地时滑翔态, T-G05 零
   伤害旗标)。参数断言取 PO 实机调参值: 展翼阈值 2 / 缓降 −1.2(2026-11-16 二次调参,
   实飞「非常好」再压; spec §3.9 初值 −3.0 已由调参令取代) / 水平操控 5.0。 */
const GLIDE_SINK = -1.2; // PO 二次实飞调参值 2026-11-16(config GLIDE.sink 镜像); spec §3.9 初值 −3.0 已由调参令取代(T-G07/T-G08)
const GLIDE_SPEED = 5.0; // spec §3.9 滑翔水平操控初值(格/秒, 不享受疾跑)

function fillPool(v) { // 两格深水池: 池底 y=8(顶面 9), 水方块 y=9..10(水面顶 11)
  fill(v, 40, 8, 40, 43, 8, 44, 3);
  for (let y=9; y<=10; y++) fill(v, 40, y, 40, 43, y, 44, v.B_WATER);
}
function assertAccumCleared(v) { // 落差累计清零自证: 入水后换干地低坠只算新段(残留峰值会报≈9)
  fill(v, 48, 10, 40, 54, 10, 44, 3); // 干地板(顶面 y=11; x 48..54 · z 40..44)
  v.pos.set(51.5, 15, 42.5); // 离地 4 — 故意低于入水前下落峰值, 清零与否可分辨
  v.onGround = false; // 池底贴地残留会短路下落循环(零帧), 显式腾空(装具 setter, 夹具操作)
  for (let i=0; i<600 && !v.onGround; i++) v.physics(DT);
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.worldEvents.land, true);
  assert.ok(Math.abs(v.worldEvents.landFall - 4) < 0.6,
      '落差累计应已入水清零(新段≈4; 残留入水前峰值会报≈9), 实测 ' + v.worldEvents.landFall);
}

test('滑翔: 装备位 on + 离地>2 自动展翼(vel.y=缓降恒值); 恰 2 格不展(整格比较锚)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 15, 42.5); // 离地 4 格 — 走落情境(未按跳跃, ADR 0016 不分起因)
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true, '离地>2 应自动展翼');
  assert.ok(Math.abs(v.vel.y - GLIDE_SINK) < 1e-9, '展翼即缓降恒值, 实测 ' + v.vel.y);
  for (let i=0; i<20; i++) {
    v.physics(DT);
    assert.ok(Math.abs(v.vel.y - GLIDE_SINK) < 1e-9, '缓降恒值不随帧漂移: ' + v.vel.y);
  }
  const v2 = loadVoxel(); // 边界: 恰好离地 2 格(阈值 >2 整格比较)不展翼
  fill(v2, 40, 10, 40, 44, 10, 44, 3);
  v2.setGliderEquipped(true);
  v2.pos.set(42.5, 13, 42.5); // 地板顶 11 → 恰 2 格
  for (let i=0; i<10; i++) v2.physics(DT);
  assert.strictEqual(v2.isGliding(), false, '离地恰 2 格不得展翼(阈值 >2)');
});

test('滑翔: 平地跳跃不误展(阈值 2 > 跳高 1.42 自洽锚); 落地 land 落差≈1.42(恒无伤锚)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.pos.set(42.5, 11, 42.5);
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.setGliderEquipped(true); // 已装备 — 平地跳仍不得展翼
  v.keys['Space'] = true; v.physics(DT); v.keys['Space'] = false;
  let maxY = v.pos.y; let glidingSeen = false;
  for (let i=0; i<200 && !v.onGround; i++) {
    v.physics(DT);
    maxY = Math.max(maxY, v.pos.y);
    if (v.isGliding()) glidingSeen = true;
  }
  assert.strictEqual(glidingSeen, false, '平地跳跃全程零展翼');
  assert.ok(maxY - 11 < 2, '自洽锚: 平地跳高应 < 阈值 2, 实测 ' + (maxY - 11).toFixed(3));
  assert.strictEqual(v.worldEvents.land, true, '平地跳跃落地也报 land');
  assert.ok(Math.abs(v.worldEvents.landFall - 1.42) < 0.2,
      '落差≈跳高 1.42(spec §3.5 平地跳恒无伤锚), 实测 ' + v.worldEvents.landFall);
  assert.strictEqual(v.worldEvents.landGliding, false);
});

test('滑翔: 高度单调不增; 滑翔触地 land 携带滑翔态=true(T-G05 零伤害旗标)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 20, 42.5);
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true);
  let prev = v.pos.y; let monotonic = true;
  for (let i=0; i<720 && !v.onGround; i++) { // T-G07 调参窗口放宽: 滞空翻倍(9 格 @−1.5/s 需 360 帧, 原 300 不够)
    v.physics(DT);
    if (v.pos.y > prev + 1e-9) monotonic = false;
    prev = v.pos.y;
  }
  assert.strictEqual(monotonic, true, '滑翔全程高度只减不增');
  assert.strictEqual(v.onGround, true, '一路滑到地面应落地');
  assert.strictEqual(v.worldEvents.land, true, '滑翔触地也报 land');
  assert.strictEqual(v.worldEvents.landGliding, true, '触地时滑翔态=true');
});

test('滑翔: yaw 同源水平操控 5.0 格/秒, 不享受疾跑, 方向随 yaw 旋转', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 20, 42.5);
  v.keys['KeyD'] = true;
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true);
  assert.ok(Math.abs(v.vel.x - GLIDE_SPEED) < 1e-9, '水平操控速度=5.0, 实测 ' + v.vel.x);
  v.keys['ShiftLeft'] = true; // 疾跑键 — 滑翔不享受(spec §3.9)
  v.physics(DT);
  assert.ok(Math.abs(v.vel.x - GLIDE_SPEED) < 1e-9, '疾跑不得生效: ' + v.vel.x);
  v.keys['ShiftLeft'] = false;
  v.yaw = Math.PI / 2; // 转向 — 操控方向与步行分支同一 yaw 同源旋转
  v.physics(DT);
  assert.ok(Math.abs(v.vel.z + GLIDE_SPEED) < 1e-9,
      'yaw=π/2 时 KeyD 应指向 -z, 实测 vel.z=' + v.vel.z);
});

test('滑翔: 滑翔中按 Space 主动取消 — 立即收翼+闩锁(高处经过不重展, 按住不振荡)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 20, 42.5);
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true);
  v.keys['Space'] = true; // 一次按下并按住 — 取消/再展不得振荡(ADR 0016 闩锁语义)
  v.physics(DT);
  assert.strictEqual(v.isGliding(), false, '滑翔中按 Space 立即收翼');
  for (let i=0; i<30; i++) {
    v.physics(DT);
    assert.strictEqual(v.isGliding(), false,
        '按住 Space 期间零振荡; 离地 ' + (v.pos.y - 11).toFixed(2) + ' 不得自动重展(闩锁)');
  }
  v.keys['Space'] = false;
  assert.ok(v.vel.y < GLIDE_SINK - 1, '收翼后转无翼自由坠落(重力回复), vel.y=' + v.vel.y.toFixed(2));
});

test('滑翔: 闩锁态空中再点 Space = 解除闩锁+主动再展翼', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 20, 42.5);
  v.physics(DT);
  v.keys['Space'] = true; v.physics(DT); v.keys['Space'] = false; // 取消 → 闩锁
  assert.strictEqual(v.isGliding(), false);
  for (let i=0; i<10; i++) v.physics(DT); // 无翼坠一段(仍离地 >2)
  assert.strictEqual(v.isGliding(), false, '闩锁期间高度条件不重展');
  v.keys['Space'] = true; // 空中再点 = 再展
  v.physics(DT);
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), true, '闩锁中空中再点 Space 应再展翼');
  assert.ok(Math.abs(v.vel.y - GLIDE_SINK) < 1e-9, '再展即入缓降, 实测 ' + v.vel.y);
});

test('滑翔: 落地闩锁无条件清除 — 再从高处腾空恢复自动展翼; 落差自收翼点重计', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 18, 42.5); // 离地 7
  v.physics(DT);
  for (let i=0; i<200 && v.isGliding() && v.pos.y > 14.1; i++) v.physics(DT); // 滑到离地≈3
  v.keys['Space'] = true; v.physics(DT); v.keys['Space'] = false; // 取消 → 闩锁
  for (let i=0; i<600 && !v.onGround; i++) v.physics(DT); // 落地(闩锁清除)
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.worldEvents.land, true);
  assert.ok(v.worldEvents.landFall < 5,
      '落差自收翼点重计(≈3, 非展翼起点 7), 实测 ' + v.worldEvents.landFall);
  v.pos.set(42.5, 18, 42.5); // 再上高处 — 闩锁已清, 自动展翼恢复
  let redeployed = false;
  for (let i=0; i<20; i++) {
    v.physics(DT);
    if (v.isGliding()) {
      redeployed = true;
      break;
    }
  }
  assert.strictEqual(redeployed, true, '落地后闩锁清除, 恢复自动展翼');
});

test('滑翔: land 事件 — 10 格无翼坠落落差≈10、触地滑翔态=false', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(false); // 无翼(缺省即 false, 显式声明语义)
  v.pos.set(42.5, 21, 42.5);
  assert.strictEqual(v.worldEvents.land, false);
  for (let i=0; i<600 && !v.onGround; i++) v.physics(DT);
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.worldEvents.land, true, '触地置位 land(引擎只报事实)');
  assert.ok(Math.abs(v.worldEvents.landFall - 10) < 0.6,
      '落差≈10, 实测 ' + v.worldEvents.landFall);
  assert.strictEqual(v.worldEvents.landGliding, false, '无翼触地滑翔态=false');
});

test('滑翔: 滑翔段不计落差 — 滑到离地约 2 格取消再坠 2 格落地, land 落差≈2', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 18, 42.5); // 离地 7
  v.physics(DT); // 展翼瞬间落差累计重置(峰值=当前高度)
  assert.strictEqual(v.isGliding(), true);
  // T-G07 调参窗口放宽: 滞空翻倍(@−1.5/s 需 196 帧, 原 200 余量过紧)
  for (let i=0; i<400 && v.isGliding() && v.pos.y > 13.1; i++) v.physics(DT); // 滑降 5 格(不计账)
  assert.strictEqual(v.isGliding(), true, '到离地≈2 仍应滑翔中');
  v.keys['Space'] = true; v.physics(DT); v.keys['Space'] = false; // 主动取消(自收翼点重计)
  assert.strictEqual(v.isGliding(), false);
  for (let i=0; i<600 && !v.onGround; i++) {
    v.physics(DT);
    if (v.pos.y > 13) {
      assert.strictEqual(v.isGliding(), false, '取消后经过 >2 格高度不自动重展(闩锁)');
    }
  }
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.worldEvents.land, true);
  assert.ok(Math.abs(v.worldEvents.landFall - 2) < 0.7,
      '落差≈2(滑翔段不计入), 实测 ' + v.worldEvents.landFall);
  assert.strictEqual(v.worldEvents.landGliding, false, '取消后触地为无翼态');
});

test('滑翔: 无翼落入深水 — splash 置位、水下触底零 land 参与、落差累计清零', () => {
  const v = loadVoxel();
  fillPool(v);
  v.pos.set(42, 20, 42); // 池心上空(入水前落差 ≈9)
  for (let i=0; i<600 && !v.worldEvents.splash; i++) v.physics(DT);
  assert.strictEqual(v.worldEvents.splash, true, '高速入水 splash(既有语义)');
  v.worldEvents.splash = false;
  for (let i=0; i<300 && !v.onGround; i++) {
    v.physics(DT);
    assert.strictEqual(v.worldEvents.land, false, '水下触底零伤害参与 — 不得报 land');
  }
  assert.strictEqual(v.onGround, true, '应沉到池底');
  assertAccumCleared(v); // 入水清零(此后无论潜多深上浮都不摔的引擎侧前提)
});

test('滑翔: 触水面软着陆 — 收翼+溅水+入水转游泳, 零 land 参与, 落差清零', () => {
  const v = loadVoxel();
  fillPool(v);
  v.setGliderEquipped(true);
  v.pos.set(42, 25, 42); // 池心上空, 离水面 14 > 2
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true, '水面上空照常按展翼规则判定');
  let sawSplash = false; let minVel = 0;
  for (let i=0; i<1200 && !v.onGround; i++) { // T-G07 调参窗口放宽: 滞空翻倍(14 格滑降 @−1.5/s 需 560 帧+沉底, 原 600 不够)
    v.physics(DT);
    if (v.worldEvents.splash) sawSplash = true;
    if (sawSplash && !v.onGround) minVel = Math.min(minVel, v.vel.y);
    assert.strictEqual(v.worldEvents.land, false, '滑翔入水零 land 参与(软着陆非触地)');
  }
  assert.strictEqual(v.onGround, true, '沉入池底(游泳物理接管)');
  assert.strictEqual(sawSplash, true, '软着陆溅水(spec §3.4: 收翼+溅水+入水转游泳)');
  assert.strictEqual(v.isGliding(), false, '触水即收翼');
  assert.ok(minVel > -2.5, '入水后游泳物理缓沉(非自由坠落), 最深 vel.y=' + minVel.toFixed(2));
  v.setGliderEquipped(false); // 卸翼后量无翼新段(装备位 on 会按 T1 合同自动再展, 落差≈0)
  assertAccumCleared(v); // 水面=安全: 落差累计同点清零
});

test('滑翔: 滑翔中装备位置 off — 立即收翼按无翼坠落, 落差自收翼点重计', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 18, 42.5); // 离地 7
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true);
  for (let i=0; i<200 && v.isGliding() && v.pos.y > 14.1; i++) v.physics(DT); // 滑到离地≈3
  v.setGliderEquipped(false); // 滑翔中卸翼(spec §3.4 A6 有意设计: 立刻收翼按无翼坠落)
  v.physics(DT);
  assert.strictEqual(v.isGliding(), false, '卸翼立即收翼');
  for (let i=0; i<600 && !v.onGround; i++) v.physics(DT);
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.worldEvents.land, true);
  assert.ok(Math.abs(v.worldEvents.landFall - 3) < 0.8,
      '落差自收翼点重计(≈3, 非展翼起点 7), 实测 ' + v.worldEvents.landFall);
  assert.strictEqual(v.worldEvents.landGliding, false, '卸翼后触地为无翼态');
});

test('滑翔: flyMode 优先 — 飞行中装备位 on 不判滑翔(引擎分支边界)', () => {
  const v = loadVoxel();
  fill(v, 40, 10, 40, 44, 10, 44, 3);
  v.setFly(true);
  v.setGliderEquipped(true);
  v.pos.set(42.5, 20, 42.5); // 离地 9 > 2, 但飞行分支优先
  v.keys['Space'] = true;
  v.physics(DT);
  assert.strictEqual(v.isGliding(), false, '飞行中零滑翔参与');
  assert.ok(Math.abs(v.vel.y - v.PLAYER.flyVert) < 1e-9, '飞行 Space 上升语义不变');
  v.keys['Space'] = false;
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
