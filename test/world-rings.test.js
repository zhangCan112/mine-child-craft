'use strict';
/* 距离环 + 编辑管线集成测试 (js/world.js) — node --test (零依赖)
   运行: node --test test/world-rings.test.js
   手法与 boot.test.js 相同: THREE/DOM 以全放行桩代之, 驱动真实的
   pumpRemesh 管线(Worker 构造在桩环境抛错 → 正好覆盖同步兜底路径),
   断言距离环的公开可观察行为: 近块进全细节表 · 远块进 LOD 表 ·
   玩家移动后环切换(升级/降级) · 编辑优先消费。 */
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
  /* 桥: 距离环的公开可观察状态(词法名 → 外部访问) */
  vm.runInContext(`
    globalThis.__w = {
      clearWorld, rebuildAll, pumpRemesh, pos, setBlockRaw, markDirty, flushDirty,
      get full(){ return chunkMeshes; }, get lod(){ return lodMeshes; },
      get ringQueueLen(){ return ringQueue.length; },
      VIEW, NCX, NCZ,
    };
  `, ctx);
  return ctx.__w;
}

/* 排空队列: pump 每帧预算 8, 跑到两队列皆空(渐进构建的"数帧内铺满") */
function drain(w, frames) {
  for (let i=0; i<frames; i++) w.pumpRemesh(8);
}

test('距离环: 建场渐进铺满 — 近块全细节, 远块降采样 LOD', () => {
  const w = loadWorld();
  w.clearWorld();
  w.pos.set(8, 10, 8); // 玩家在区块(0,0)中心附近
  w.setBlockRaw(8, 5, 8, 3); // 近处: 区块(0,0)
  w.setBlockRaw(120, 5, 120, 3); // 远处: 区块(7,7), 距环心 ~10.6 区块 > fullChunks(8)
  w.rebuildAll();
  drain(w, 20);
  assert.ok(w.full.has('0,0'), '近块应进全细节表');
  assert.ok(w.lod.has('7,7'), '远块应进 LOD 表');
  assert.ok(!w.full.has('7,7'), '远块不该有全细节网格');
  assert.strictEqual(w.ringQueueLen, 0, '队列应排空');
});

test('距离环: 玩家走远后环切换 — 远块升级全细节, 原近块降级 LOD', () => {
  const w = loadWorld();
  w.clearWorld();
  w.pos.set(8, 10, 8);
  w.setBlockRaw(8, 5, 8, 3);
  w.setBlockRaw(120, 5, 120, 3);
  w.rebuildAll();
  drain(w, 20);
  w.pos.set(120, 10, 120); // 走到对角
  drain(w, 20);
  assert.ok(w.full.has('7,7'), '新位置附近应升级为全细节');
  assert.ok(w.lod.has('0,0'), '原位置应降级为 LOD');
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

test('距离环·低核档收紧: 触屏+≤2核 → full 6/lod 10, 环外区块不驻留(桌面档不变)', () => {
  const desk = loadWorld(); // 缺省沙盒: 桌面
  assert.strictEqual(desk.VIEW.fullChunks, 8, '桌面档全细节半径不动');
  assert.strictEqual(desk.VIEW.lodChunks, 15, '桌面档 LOD 半径不动');
  const w = loadWorld({navigator: {maxTouchPoints: 5, hardwareConcurrency: 2}}); // 低核触屏
  assert.strictEqual(w.VIEW.fullChunks, 6);
  assert.strictEqual(w.VIEW.lodChunks, 10);
  w.clearWorld();
  w.pos.set(8, 10, 8);
  w.setBlockRaw(8, 5, 8, 3); // 近块: 区块(0,0), d=0 → 全细节
  w.setBlockRaw(88, 5, 88, 3); // 中距: 区块(5,5), d≈7.07 → 低核档落 LOD(桌面档会是 full)
  w.setBlockRaw(152, 5, 152, 3); // 对角远块: 区块(9,9), d≈12.7 > lodChunks(10) → 不驻留
  w.rebuildAll();
  drain(w, 20);
  assert.ok(w.full.has('0,0'), '近块仍全细节');
  assert.ok(w.lod.has('5,5') && !w.full.has('5,5'), '低核档中距块提前进 LOD');
  assert.ok(!w.full.has('9,9') && !w.lod.has('9,9'), '低核档环外区块不驻留');
  assert.strictEqual(w.ringQueueLen, 0, '队列应排空');
});
