'use strict';
/* 全图常驻 + 编辑管线集成测试 (js/world.js) — node --test (零依赖)
   运行: node --test test/world-rings.test.js
   手法与 boot.test.js 相同: THREE/DOM 以全放行桩代之, 驱动真实的
   pumpRemesh 管线(Worker 构造在桩环境抛错 → 正好覆盖同步兜底路径)。
   距离环 LOD 层 2026-11-07 退役(T14 用户拍板), 本文件从「距离环形态机」
   语义改写为「全图全细节常驻」语义: 建场渐进铺满(近块/远块全进全细节
   表) · 玩家移动不触发卸载/降级 · 编辑优先消费 · 环参数退役防复活钉。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mkAny() {
  const f = function() {
    return any;
  };
  const any = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '{}';
      if (k === Symbol.iterator) {
        return function() {
          return {next: () => ({done: true, value: any})};
        };
      }
      return any;
    },
    set() {
      return true;
    },
    apply() {
      return any;
    },
    construct() {
      return any;
    },
    has() {
      return true;
    },
  });
  return any;
}

function loadWorld(env) { // env: 沙盒键覆盖(低核档用例注入触屏+2核 navigator)
  const sandbox = {
    console: {log() {}, warn() {}, error() {}},
    performance: {now: () => 0},
    requestAnimationFrame() {},
    THREE: mkAny(), document: mkAny(), navigator: {maxTouchPoints: 0},
    location: {protocol: 'file:'}, // file:// → Worker 兜底路径(本测试的被测对象)
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {},
  };
  Object.assign(sandbox, env || {});
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['config.js', 'daylight-core.js', 'light-core.js', 'voxel.js', 'cascade-core.js', 'fluid-core.js',
    'mesh-core.js', 'texture-atlas.js', 'world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  /* 桥: 全图常驻的公开可观察状态(词法名 → 外部访问) */
  vm.runInContext(`
    globalThis.__w = {
      clearWorld, rebuildAll, pumpRemesh, pos, setBlockRaw, markDirty, flushDirty,
      get full(){ return chunkMeshes; },
      get fillQueueLen(){ return fillQueue.length; },
      VIEW, NCX, NCZ,
    };
  `, ctx);
  return ctx.__w;
}

/* 排空队列: pump 每帧预算 8, 跑到铺满队列空(渐进构建的"数帧内铺满") */
function drain(w, frames) {
  for (let i=0; i<frames; i++) w.pumpRemesh(8);
}

test('全图常驻: 建场渐进铺满 — 近块远块全细节, 全图 100 区块驻留(含空气区块空记账)', () => {
  const w = loadWorld();
  w.clearWorld();
  w.pos.set(8, 10, 8); // 玩家在区块(0,0)中心附近
  w.setBlockRaw(8, 5, 8, 3); // 近处: 区块(0,0)
  w.setBlockRaw(120, 5, 120, 3); // 远处: 区块(7,7) — 旧距离环语义会降 LOD, 现在全细节
  w.rebuildAll();
  drain(w, 20);
  assert.ok(w.full.has('0,0'), '近块进全细节表');
  assert.ok(w.full.has('7,7'), '远块也进全细节表(不再降 LOD)');
  assert.strictEqual(w.full.size, w.NCX * w.NCZ, '全图区块全驻留(空气区块记空数组)');
  assert.strictEqual(w.fillQueueLen, 0, '铺满队列应排空');
});

test('全图常驻: 玩家走远 — 不卸载不降级, 零形态翻转', () => {
  const w = loadWorld();
  w.clearWorld();
  w.pos.set(8, 10, 8);
  w.setBlockRaw(8, 5, 8, 3);
  w.setBlockRaw(120, 5, 120, 3);
  w.rebuildAll();
  drain(w, 20);
  const sizeBefore = w.full.size;
  w.pos.set(120, 10, 120); // 走到对角
  drain(w, 20);
  assert.ok(w.full.has('0,0') && w.full.has('7,7'), '两地区块都保持全细节驻留');
  assert.strictEqual(w.full.size, sizeBefore, '驻留数不变(无卸载)');
  assert.strictEqual(w.fillQueueLen, 0, '移动不产生新缺口(无形态切换队列)');
});

test('编辑管线: markDirty 的区块下帧被消费(同步兜底路径)', () => {
  const w = loadWorld();
  w.clearWorld();
  w.pos.set(8, 10, 8);
  w.setBlockRaw(8, 5, 8, 3);
  w.rebuildAll();
  drain(w, 20);
  assert.ok(w.full.has('0,0'));
  w.setBlockRaw(9, 6, 9, 4); // 编辑近块
  w.markDirty(9, 9);
  w.pumpRemesh(2); // 一帧内消费(编辑优先)
  assert.ok(w.full.has('0,0'), '重建后仍在全细节表');
});

test('全图常驻·退役钉: VIEW 不再有距离环参数, 低核档不再分档环半径', () => {
  const desk = loadWorld(); // 缺省沙盒: 桌面
  assert.strictEqual(desk.VIEW.fullChunks, undefined, 'fullChunks 已退役');
  assert.strictEqual(desk.VIEW.lodChunks, undefined, 'lodChunks 已退役');
  assert.strictEqual(desk.VIEW.lodStep, undefined, 'lodStep 已退役');
  const low = loadWorld({navigator: {maxTouchPoints: 5, hardwareConcurrency: 2}}); // 低核触屏
  assert.deepStrictEqual(Object.keys(low.VIEW), Object.keys(desk.VIEW), '低核档与桌面档 VIEW 键集一致(环半径分档退役)');
  assert.strictEqual(low.VIEW.fogNear, desk.VIEW.fogNear, '雾观感边界不受档位影响');
});
