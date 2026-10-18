"use strict";
/* 坦克驾驶核心 (js/tank-core.js) 单测 — node --test (零依赖)
   运行: node --test test/tank-core.test.js
   加载器: vm context 依次执行 config.js + voxel.js + tank-core.js,
   镜像浏览器 <script defer> 共享词法环境(与 voxel.test.js 同法);
   纯核心不读键盘, 输入以 input 数据传入, 无需 input.js 占位 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadTank(){
  const ctx = vm.createContext({ console });
  for(const f of ['config.js', 'voxel.js', 'tank-core.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext(`
    globalThis.__t = { TankCore, TANK, getBlock, setBlockRaw, WORLD_W, WORLD_D, WORLD_H };
  `, ctx);
  return ctx.__t;
}

/* 石板平地: y 层铺 (x0,z0)~(x1,z1) */
function flatGround(t, y, x0, z0, x1, z1){
  for(let x=x0;x<=x1;x++) for(let z=z0;z<=z1;z++) t.setBlockRaw(x, y, z, 3);
}
const DT = 1/60;
const IDLE = { forward: 0, steer: 0, lookYaw: null };

function grounded(t, x, z, yaw){                     // 落地后的就绪坦克
  const T = t.TankCore.mkT(x, 11, z, yaw);
  for(let i=0; i<180 && !T.onGround; i++) t.TankCore.step(T, IDLE, DT);
  assert.ok(T.onGround, '应已落在平地上');
  return T;
}
function drive(t, T, input, sec){ for(let i=0; i<Math.round(sec/DT); i++) t.TankCore.step(T, input, DT); }

/* ============ 前进 ============ */

test('前进: 沿车头加速, 不超极速, 松手前持续前进', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  const T = t.TankCore.mkT(64, 11, 64, 0);
  for(let i=0; i<180 && !T.onGround; i++) t.TankCore.step(T, IDLE, DT);   // 先落地
  assert.ok(T.onGround, '应已落在平地上');
  const z0 = T.z;
  for(let i=0; i<90; i++) t.TankCore.step(T, {forward:1, steer:0, lookYaw:null}, DT);   // 1.5 秒全油门
  assert.ok(T.vel > 0, 'vel 应为正: ' + T.vel);
  assert.ok(T.vel <= t.TANK.speed + 1e-9, '不超过极速 speed=' + t.TANK.speed + ', 实测 ' + T.vel);
  assert.ok(T.z < z0 - 3, 'yaw=0 车头朝 -Z, z 应明显减小: ' + (T.z - z0));
  assert.ok(Math.abs(T.x - 64) < 0.5, 'x 基本不动: ' + T.x);
});

/* ============ 纵向: 倒车与滑行 ============ */

test('倒车: 极速受 reverse 限制, 方向为车尾(yaw=0 → +Z)', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  const T = grounded(t, 64, 64, 0);
  const z0 = T.z;
  drive(t, T, {forward:-1, steer:0, lookYaw:null}, 2);
  assert.ok(T.vel < 0, 'vel 应为负: ' + T.vel);
  assert.ok(T.vel >= -t.TANK.reverse - 1e-9, '倒车不超过 reverse=' + t.TANK.reverse + ', 实测 ' + T.vel);
  assert.ok(T.z > z0 + 2, 'yaw=0 倒车朝 +Z, z 应增大: ' + (T.z - z0));
});

test('滑行: 松油门后按摩擦衰减, 仍前进一小段(重量感)', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  const T = grounded(t, 64, 70, 0);
  drive(t, T, {forward:1, steer:0, lookYaw:null}, 2);          // 全速
  const vFull = T.vel;
  assert.ok(vFull > t.TANK.speed*0.9, '应已接近极速');
  drive(t, T, IDLE, 1);                                        // 松油门 1 秒
  assert.ok(T.vel < vFull*0.05, '1 秒后应接近停住: ' + T.vel);
  assert.ok(T.vel >= 0, '滑行不反转让(不倒车)');
});

/* ============ 转向: aimYaw 单一权威 ============ */

test('鼠标方向: 车体以 turnRate 上限追踪 lookYaw, 最终对齐', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  const T = grounded(t, 64, 64, 0);
  const aim = Math.PI;                                         // 掉头
  let prevYaw = T.yaw;
  for(let i=0; i<240; i++){
    t.TankCore.step(T, {forward:0, steer:0, lookYaw:aim}, DT);
    const d = t.TankCore.wrapAngle(T.yaw - prevYaw);
    assert.ok(Math.abs(d) <= t.TANK.turnRate*DT + 1e-9, '每帧转向不超过 turnRate·dt');
    prevYaw = T.yaw;
  }
  assert.ok(Math.abs(t.TankCore.wrapAngle(T.aimYaw - aim)) < 1e-9, 'aimYaw 采纳鼠标值');
  assert.ok(Math.abs(t.TankCore.wrapAngle(T.yaw - aim)) < 0.05, '4 秒后车体对齐目标方向');
});

test('追踪取最短方向: 目标 -π/2 时车体向负角旋转(原地差速转向)', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  const T = grounded(t, 64, 64, 0);
  drive(t, T, {forward:0, steer:0, lookYaw:-Math.PI/2}, 0.5);
  assert.ok(T.yaw < 0, '应向负方向转: ' + T.yaw);
  assert.ok(T.vel === 0, '原地转向不产生车速');
});

test('A·D 集成: steer 以转向速率改写 aimYaw, 车体跟随(无鼠标也可转)', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  const T = grounded(t, 64, 64, 0);
  drive(t, T, {forward:0, steer:1, lookYaw:null}, 1);          // 按住 D 一秒
  assert.ok(T.aimYaw > 1.2, 'aimYaw 应累积约 turnRate·1s=1.6: ' + T.aimYaw);
  assert.ok(Math.abs(t.TankCore.wrapAngle(T.yaw - T.aimYaw)) < 0.1, '车体跟上 aimYaw');
});

/* ============ 碰撞: 撞墙 · 爬台阶 · 边缘 · 挤压 ============ */

test('撞墙刹停: 2 格高墙挡路, 车停墙前且车速归零', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  for(let x=50; x<=80; x++){ t.setBlockRaw(x, 11, 58, 3); t.setBlockRaw(x, 12, 58, 3); }   // z=58 两格高墙
  const T = grounded(t, 64, 64, 0);                            // 朝 -Z 开向墙
  drive(t, T, {forward:1, steer:0, lookYaw:null}, 3);
  assert.ok(T.z > 59 && T.z < 60.5, '应停在墙前(z≈59.95): ' + T.z);
  assert.ok(Math.abs(T.vel) < 0.6, '撞墙后车速应接近 0: ' + T.vel);
});

test('履带爬台阶: 1 格高平台直接爬上, 在平台上继续前进', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 20, 80, 80);                           // 低层地板 z=20..80
  for(let z=40; z<=58; z++) for(let x=50; x<=80; x++) t.setBlockRaw(x, 11, z, 3);   // z=40..58 一格高平台
  const T = grounded(t, 64, 64, 0);
  drive(t, T, {forward:1, steer:0, lookYaw:null}, 3);
  assert.ok(Math.abs(T.y - 12) < 0.2, '应爬上平台(y=12): y=' + T.y);
  assert.ok(T.z < 57 && T.z > 40, '应在平台上前进: z=' + T.z);
  assert.ok(T.vel > 3, '爬平台不刹停: vel=' + T.vel);
});

test('世界边缘: 隐形墙拦住, 不越出世界边界', () => {
  const t = loadTank();
  flatGround(t, 10, 30, 30, 120, 120);
  const T = grounded(t, 64, 64, 0);
  drive(t, T, {forward:1, steer:0, lookYaw:-Math.PI/2}, 12);   // 朝 +X 全速开 12 秒
  assert.ok(T.x <= t.WORLD_W - t.TANK.hw + 0.01, 'x 不越界: ' + T.x + ' ≤ ' + (t.WORLD_W - t.TANK.hw));
  assert.ok(T.x > t.WORLD_W - 3, '确实开到了边缘');
});

/* ============ 最近车距门控(提示/上车共用) ============ */

test('nearest: 半径内返回最近的车, 半径外与空列表返回 null', () => {
  const t = loadTank();
  const a = t.TankCore.mkT(60, 11, 60, 0);
  const b = t.TankCore.mkT(63, 11, 63, 0);
  assert.strictEqual(t.TankCore.nearest([a, b], 64, 64, t.TANK.promptR), b, '返回最近的一辆');
  assert.strictEqual(t.TankCore.nearest([a], 64, 64, t.TANK.promptR), null, '超出 promptR → null(不提示)');
  assert.strictEqual(t.TankCore.nearest([a, b], 64, 64, t.TANK.enterR), b, 'enterR 内可上车');
  assert.strictEqual(t.TankCore.nearest([], 64, 64, 5), null, '无车 → null');
});

test('TANK 参数表: promptR/enterR 齐备且 enterR ≥ promptR(方案 §3 距离门控)', () => {
  const t = loadTank();
  assert.ok(t.TANK.promptR > 0, 'promptR 存在且为正');
  assert.ok(t.TANK.enterR >= t.TANK.promptR, '上车半径不小于提示半径');
  assert.ok(t.TANK.reload <= 1.25, '装填 ≤ 1.25 秒(用户要求较初版 2.5 缩短一半)');
});

test('挤压兜底: 嵌入方块时向上弹出', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  t.setBlockRaw(64, 11, 64, 3);                                // 落脚点正中一块石头
  const T = t.TankCore.mkT(64, 11, 64, 0);                     // 与之重叠
  drive(t, T, IDLE, 1);
  assert.ok(!t.TankCore.boxCollides(T.x, T.y, T.z), '一秒内应弹出嵌入方块: y=' + T.y);
});

/* ============ 二期: 装填 · 炮弹 · 爆炸 ============ */

test('装填冷却: 开炮后 cool>0 随帧递减, 归零前不能再开', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  const T = grounded(t, 64, 64, 0);
  T.cool = t.TANK.reload;                          // 模拟刚开过一炮
  drive(t, T, IDLE, t.TANK.reload - 0.05);
  assert.ok(T.cool > 0, '还差 0.05 秒, 仍在装填: ' + T.cool);
  drive(t, T, IDLE, 0.1);
  assert.strictEqual(T.cool, 0, '装填完毕归零');
});

test('炮弹: 受轻度重力, 命中方块即停(S.hit); 无阻挡则超程自毁', () => {
  const t = loadTank();
  flatGround(t, 10, 50, 50, 80, 80);
  for(let x=60; x<=68; x++) for(let y=11; y<=14; y++) t.setBlockRaw(x, y, 55, 3);   // 9 格外靶墙
  const S = t.TankCore.mkShell(64, 13, 64, 0, 0, -t.TANK.shellSpeed);
  for(let i=0; i<Math.round(1.5/DT) && !S.dead; i++) t.TankCore.shellStep(S, DT);
  assert.ok(S.dead, '应已终止');
  assert.ok(S.hit && S.hit.z === 55, '命中靶墙所在格: ' + JSON.stringify(S.hit));
  assert.ok(S.y < 13, '飞行中受重力下坠: ' + S.y);

  const S2 = t.TankCore.mkShell(10, 20, 10, 0, 10, 0);         // 空旷处垂直上抛, 无遮挡
  for(let i=0; i<Math.round(t.TANK.shellLife/DT)+10 && !S2.dead; i++) t.TankCore.shellStep(S2, DT);
  assert.ok(S2.dead && !S2.hit, '超程(life 耗尽)自毁, 无命中');
});

test('爆炸: 球形破坏随距离衰减, 按方块 id 分桶计数, 半径外完好, 结果确定', () => {
  const t = loadTank();
  const TARGET = 16;                                            // 靶=红羊毛(什么算靶由调用方判定)
  function build(){
    for(let x=50; x<=80; x++) for(let z=50; z<=80; z++) t.setBlockRaw(x, 10, z, 3);   // 地板
    for(let x=58; x<=72; x++) for(let y=11; y<=13; y++) t.setBlockRaw(x, y, 55, TARGET);   // 靶墙
  }
  build();
  let edits = 0;
  const edit = (x, y, z, id) => { edits++; t.setBlockRaw(x, y, z, id); };
  const r1 = t.TankCore.explode(64, 12, 54, edit);
  assert.ok(r1.removed >= 10, '爆心成片破坏(含地板弹坑): ' + r1.removed);
  assert.ok(r1.counts[TARGET] >= 5, '靶方块按 id 计入 counts: ' + r1.counts[TARGET]);
  assert.ok(edits === r1.removed, '全部破坏经注入的 edit 管线(浏览器侧=markDirty)');
  assert.notStrictEqual(t.getBlock(72, 11, 55), 0, '半径外的靶列完好');
  build();                                                       // 重建同布局
  const r2 = t.TankCore.explode(64, 12, 54, t.setBlockRaw);
  assert.deepStrictEqual(r2, r1, '同输入两次爆炸结果一致(衰减用确定性哈希)');
});

