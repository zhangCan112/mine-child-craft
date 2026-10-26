'use strict';
/* 流体核心 (js/fluid-core.test.js 对 js/fluid-core.js) 单测 — node --test (零依赖)
   运行: node --test test/fluid-core.test.js
   手法: config/voxel 经 vm 装真件(真 BLOCKS/FLUIDS/真 getBlock/setBlockRaw/
   水位面), policy 与 sim 用核心自己的 mkPolicy/mkSim 派生(与 world.js 同一
   装配, 防两份漂移)。断言按设计稿 docs/liquid-design.md D4/D11 逐行:
   静态湖激活 no-op · 挖岸外流菱形 7 格 · 坡向收束 1 格宽 · 下落重置距离 ·
   断供消退 · 无限水两规则 · 混合三规则 · 冲毁 thin · 确定性(同编辑序同终态)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const FluidCore = require('../js/fluid-core.js');

function loadEng() {
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['config.js', 'voxel.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  return vm.runInContext(`globalThis.__e = {
    BLOCKS, FLUIDS, FLUID, getBlock, setBlockRaw, getFluidLv, setFluidLv,
    worldCells, fluidLv, WORLD_W, WORLD_H, WORLD_D,
  }; __e;`, ctx);
}

/* 每测试一世界: 模拟器装配镜像 world.js(write 同步写 id+水位, 非流体清水位) */
function mkH() {
  const e = loadEng();
  const policy = FluidCore.mkPolicy(e.BLOCKS);
  const write = (x, y, z, id, lv) => {
    e.setBlockRaw(x, y, z, id);
    e.setFluidLv(x, y, z, id !== 0 && policy.kindOf(id) ? lv : 0);
  };
  const sim = FluidCore.mkSim({
    read: e.getBlock, write, readLv: e.getFluidLv, policy, params: e.FLUIDS,
    ids: {water: 24, lava: 25}, mixIds: {obsidian: 31, cobble: 4, stone: 3},
    w: e.WORLD_W, h: e.WORLD_H, d: e.WORLD_D,
  });
  let tick = 0;
  const events = [];
  const settle = (maxTicks) => {/* 逐游戏刻推进到队列空(不动点) */
    for (let i = 0; i < maxTicks; i++) {
      tick++;
      for (const ev of sim.step(tick, 100000)) events.push(ev);
      if (sim.pending() === 0) return i + 1;
    }
    throw new Error('settle 超过 ' + maxTicks + ' 刻未到不动点');
  };
  const dig = (x, y, z) => {/* 破坏一格(镜像 world.js 编辑挂点) */
    e.setBlockRaw(x, y, z, 0);
    e.setFluidLv(x, y, z, 0);
    sim.notifyEdit(x, y, z);
    return settle(4000);
  };
  const placeSource = (x, y, z, id) => {/* 放一个源(建造调色板路径) */
    write(x, y, z, id, 0);
    sim.notifyEdit(x, y, z);
    settle(4000);
  };
  const floor = (x1, z1, x2, z2, y) => {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) e.setBlockRaw(x, y, z, 3);
    }
  };
  const count = (id) => {
    let n = 0;
    for (let i = 0; i < e.worldCells.length; i++) if (e.worldCells[i] === id) n++;
    return n;
  };
  return {e, policy, sim, write, settle, dig, placeSource, floor, count, events};
}

/* ============ mkPolicy / amountOf: 真件派生 ============ */

test('mkPolicy: 身份判定从 config 真件派生 — 流体/可流入/可冲毁', () => {
  const h = mkH();
  const p = h.policy;
  assert.strictEqual(p.kindOf(24), 'water', 'B_WATER = water 流体');
  assert.strictEqual(p.kindOf(25), 'lava', 'B_LAVA = lava 流体');
  assert.strictEqual(p.kindOf(0), null, '空气非流体');
  assert.strictEqual(p.kindOf(3), null, '石头非流体');
  assert.strictEqual(p.flowable(0), true, '空气可流入');
  assert.strictEqual(p.flowable(48), true, '火把(thin)可流入=被冲毁');
  assert.strictEqual(p.flowable(3), false, '实心不可流入');
  assert.strictEqual(p.flowable(18), false, '玻璃不可流入');
  assert.strictEqual(p.washable(48), true, '火把会被冲毁');
  assert.strictEqual(p.washable(0), false, '空气无冲毁事件');
});

test('amountOf: 水位→水量(源/下落满, 流动递减)', () => {
  assert.strictEqual(FluidCore.amountOf(0), 8);
  assert.strictEqual(FluidCore.amountOf(1), 7);
  assert.strictEqual(FluidCore.amountOf(7), 1);
  assert.strictEqual(FluidCore.amountOf(8), 8);
});

/* ============ 激活与稳定性(共识 Q4a/Q15: 既有静态水面 no-op) ============ */

test('全场激活: 完好湖(源阵+实心底+同高岸沿)是不动点 — 零事件零改动', () => {
  const h = mkH();
  h.floor(20, 20, 26, 26, 9); // 湖底
  const ring = (x, z) => h.e.setBlockRaw(x, 10, z, 8); // 岸沿: 同高沙岸挡外流(探险湖同款)
  for (let x = 20; x <= 26; x++) {
    for (let z = 20; z <= 26; z++) {
      if (x === 20 || x === 26 || z === 20 || z === 26) ring(x, z);
      else h.write(x, 10, z, 24, 0); // 5×5 源阵, 岸沿围死
    }
  }
  const n0 = h.count(24);
  const activated = h.sim.activate(h.e.WORLD_W, h.e.WORLD_H, h.e.WORLD_D);
  h.settle(4000);
  assert.strictEqual(activated, 25, '激活登记全部 25 个源');
  assert.strictEqual(h.count(24), n0, '水量不变');
  assert.strictEqual(h.sim.pending(), 0, '队列空');
  assert.strictEqual(h.events.length, 0, '零事件(无流动无消退)');
});

test('全场激活: 完好湖逐格 lv=0(源语义), 非流体格 lv=0', () => {
  const h = mkH();
  h.floor(20, 20, 26, 26, 9);
  const ring = (x, z) => h.e.setBlockRaw(x, 10, z, 8);
  for (let x = 20; x <= 26; x++) {
    for (let z = 20; z <= 26; z++) {
      if (x === 20 || x === 26 || z === 20 || z === 26) ring(x, z);
      else h.write(x, 10, z, 24, 0);
    }
  }
  h.sim.activate(h.e.WORLD_W, h.e.WORLD_H, h.e.WORLD_D);
  h.settle(4000);
  for (let x = 21; x <= 25; x++) {
    for (let z = 21; z <= 25; z++) assert.strictEqual(h.e.getFluidLv(x, 10, z), 0, '源 lv=0');
  }
});

/* ============ 传播(研究稿 §3): 距离/菱形/坡向/下落 ============ */

test('挖岸外流: 水平传播 7 格菱形, 水位随距离递增(源 lv0 → 7 格 lv7)', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 9); // 大平地
  h.write(20, 10, 20, 24, 0); // 源
  h.sim.notifyEdit(20, 10, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(27, 10, 20), 24, '7 格处有水');
  assert.strictEqual(h.e.getFluidLv(27, 10, 20), 7, '水位 7');
  assert.strictEqual(h.e.getBlock(28, 10, 20), 0, '8 格处无水(停流线)');
  assert.strictEqual(h.e.getBlock(23, 10, 24), 24, '菱形: 对角 taxicab 7(3+4)有水');
  assert.strictEqual(h.e.getBlock(24, 10, 24), 0, 'taxicab 8 无水(菱形边界)');
  assert.strictEqual(h.e.getFluidLv(20, 10, 20), 0, '源恒 lv0');
});

test('坡向寻路: 平台源 4 格内有崖 → 收成 1 格宽直奔崖边跌落, 其余方向不流', () => {
  const h = mkH();
  h.floor(16, 14, 30, 26, 10); // 平台(x=16 是边缘, x=15 起悬空)
  h.write(19, 11, 20, 24, 0);
  h.sim.notifyEdit(19, 11, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(18, 11, 20), 24, '朝崖方向有水');
  assert.strictEqual(h.e.getBlock(16, 11, 20), 24, '流到平台边缘');
  assert.strictEqual(h.e.getBlock(21, 11, 20), 0, '背离崖方向不流');
  assert.strictEqual(h.e.getBlock(19, 11, 22), 0, '侧向不流(1 格宽)');
  assert.strictEqual(h.e.getBlock(15, 10, 20), 24, '越过边缘下落');
  assert.strictEqual(h.e.getFluidLv(15, 10, 20), 8, '下落柱 lv8');
});

test('下落重置距离: 高处源落底后, 落点重铺满 7 格(lv8 柱不耗水平距离)', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 4);
  h.write(20, 12, 20, 24, 0); // 悬空源, 下方空气直到 y5
  h.sim.notifyEdit(20, 12, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getFluidLv(20, 11, 20), 8, '空中下落柱满水位');
  assert.strictEqual(h.e.getBlock(20, 5, 20), 24, '落底');
  assert.strictEqual(h.e.getBlock(27, 5, 20), 24, '落点铺满 7 格');
  assert.strictEqual(h.e.getFluidLv(27, 5, 20), 7, '7 格处水位 7');
  assert.strictEqual(h.e.getBlock(28, 5, 20), 0, '8 格处无水');
});

test('岩浆参数(dropOff 2 · 停在 3 格): 只铺 lv2/4/6, 刻率 30 ticks', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 9);
  h.write(20, 10, 20, 25, 0);
  h.sim.notifyEdit(20, 10, 20);
  /* 水的口径对照: 10 刻内水已外流, 岩浆(30 ticks)一步未动 */
  for (let i = 0; i < 10; i++) h.sim.step(i + 1, 100000);
  assert.strictEqual(h.e.getBlock(21, 10, 20), 0, '10 刻(0.5s)岩浆未流');
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(23, 10, 20), 25, '3 格处有岩浆');
  assert.strictEqual(h.e.getFluidLv(23, 10, 20), 6, '岩浆水位 6(2/4/6 三档)');
  assert.strictEqual(h.e.getBlock(24, 10, 20), 0, '4 格处无岩浆');
});

/* ============ 断供消退(研究稿 §6 伴生 #6) ============ */

test('断供消退: 舀走源(置空+notifyEdit)后流动水逐刻退净', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 9);
  h.write(20, 10, 20, 24, 0);
  h.sim.notifyEdit(20, 10, 20);
  h.settle(4000);
  assert.ok(h.count(24) > 1, '已外流成片');
  h.dig(20, 10, 20);
  assert.strictEqual(h.count(24), 0, '源没了 → 全部退净');
  assert.ok(h.events.some((ev) => ev.type === 'dry'), '有 dry 事件(观感/记账)');
});

/* ============ 源再生(研究稿 §4 两规则, 共识 Q7) ============ */

test('无限水规则①: 水平 ≥2 源邻居 + 实心下托 → 缺口成源', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 9);
  h.write(10, 10, 20, 24, 0);
  h.write(12, 10, 20, 24, 0);
  h.sim.notifyEdit(10, 10, 20);
  h.sim.notifyEdit(12, 10, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(11, 10, 20), 24, '缺口被灌');
  assert.strictEqual(h.e.getFluidLv(11, 10, 20), 0, '且成源(2×2 无限井)');
});

test('无限水规则②: 水平 1 源 + 正上方源 → 成源', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 4);
  h.write(10, 5, 20, 24, 0); // 水平源
  h.write(11, 6, 20, 24, 0); // 正上方源(悬空)
  h.sim.notifyEdit(10, 5, 20);
  h.sim.notifyEdit(11, 6, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(11, 5, 20), 24, '目标格被灌');
  assert.strictEqual(h.e.getFluidLv(11, 5, 20), 0, '垂直规则成源');
});

test('岩浆不再生: 两源夹缺口只成流动岩浆(lv2), 不成源', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 9);
  h.write(10, 10, 20, 25, 0);
  h.write(12, 10, 20, 25, 0);
  h.sim.notifyEdit(10, 10, 20);
  h.sim.notifyEdit(12, 10, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getFluidLv(11, 10, 20), 2, '缺口只是流动岩浆(dropOff 2)');
});

/* ============ 水岩混合(设计稿 D4.4 三规则) ============ */

test('混合①: 水触岩浆源 → 黑曜石(31)', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 9);
  h.write(20, 10, 20, 24, 0); // 水(地板中央, 坡向无洞 → 四向平铺)
  h.write(22, 10, 20, 25, 0);
  h.sim.notifyEdit(20, 10, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(22, 10, 20), 31, '岩浆源变黑曜石');
  assert.ok(h.events.some((ev) => ev.type === 'mix' && ev.to === 31), 'mix 事件');
});

test('混合②: 岩浆自上落入水 → 石头(3)', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 4);
  h.write(15, 5, 20, 24, 0); // 水面
  h.write(15, 8, 20, 25, 0); // 高处岩浆源
  h.sim.notifyEdit(15, 8, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(15, 5, 20), 3, '水格变石头');
  assert.ok(h.events.some((ev) => ev.type === 'mix' && ev.to === 3), 'mix 事件');
});

test('混合③: 流动岩浆遇水 → 圆石(4)——分段构造: 先让岩浆淌出流动前端, 再放水', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 9);
  h.write(24, 10, 20, 25, 0); // 岩浆源独自淌开(3 格: 23/22/21 流动前端)
  h.sim.notifyEdit(24, 10, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(21, 10, 20), 25, '岩浆已淌到 21(流动 lv6)');
  h.write(19, 10, 20, 24, 0); // 水源从另一侧来(地板中央, 四向平铺)
  h.sim.notifyEdit(19, 10, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(21, 10, 20), 4, '水触流动岩浆 → 圆石');
  assert.ok(h.events.some((ev) => ev.type === 'mix' && ev.to === 4), 'mix 事件');
});

/* ============ 冲毁 thin(共识 Q8) ============ */

test('冲毁: 水流入火把格 → 火把被冲走(wash 事件), 水占据该格', () => {
  const h = mkH();
  h.floor(10, 10, 40, 40, 9);
  h.e.setBlockRaw(22, 10, 20, 48); // 火把(thin)
  h.write(20, 10, 20, 24, 0);
  h.sim.notifyEdit(20, 10, 20);
  h.settle(4000);
  assert.strictEqual(h.e.getBlock(22, 10, 20), 24, '火把格被水占据');
  const wash = h.events.find((ev) => ev.type === 'wash');
  assert.ok(wash && wash.id === 48, 'wash 事件携带火把 id(掉落归装配层)');
});

/* ============ 确定性(共识 Q15: 同编辑序必同终态) ============ */

test('确定性: 同一编辑序列跑两遍 → 方块与水位平面逐字节一致', () => {
  const run = () => {
    const h = mkH();
    h.floor(10, 10, 40, 40, 9);
    h.floor(10, 10, 40, 40, 5); // 双层地板留 1 格夹层, 制造下落+侧铺+再生混合场景
    h.write(20, 10, 20, 24, 0);
    h.write(30, 10, 30, 25, 0);
    h.sim.notifyEdit(20, 10, 20);
    h.sim.notifyEdit(30, 10, 30);
    h.settle(4000);
    h.dig(24, 9, 24); // 中途破坏, 触发再排程
    h.settle(4000);
    return {cells: Buffer.from(h.e.worldCells), lv: Buffer.from(h.e.fluidLv)};
  };
  const a = run();
  const b = run();
  assert.ok(a.cells.equals(b.cells), '方块平面逐字节一致');
  assert.ok(a.lv.equals(b.lv), '水位平面逐字节一致');
});
