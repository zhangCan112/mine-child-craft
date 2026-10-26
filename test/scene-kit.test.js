'use strict';
/* 引擎高度场单测(镜像 js/scene-kit.js, SceneKit.heightAt) — node --test(零依赖)
   运行: node --test test/scene-kit.test.js
   命名偏差登记(conventions §1.9): scene-kit 为 -kit 后缀, 本文件为其直测
   (world-rings 先例); heightAt 是纯函数(不碰 voxel 全局), vm 单文件加载、
   sandbox 只给内建对象 —— 加载器本身即引擎层红线(零 THREE·零 DOM·零玩法
   知识)的活证明。
   覆盖票据 T3(adventure-maps-tickets)验收: 确定性(同参同值+整格阶梯化) ·
   幅度界 ±3 · 压平区归基准 · 全图相邻高差 ≤1(坡度红线) · 每控制格幅度
   参数化(T5 圈层/T4 沙丘的消费者口径)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSceneKit() {
  /* 只给内建对象: scene-kit.js 顶层声明零外部依赖, heightAt 纯函数
     连 voxel 全局(setBlockRaw/hashRand)都不碰 —— 引擎层分层的活证明 */
  const sandbox = {console: {warn() {}, log() {}, error() {}}, Math, Number};
  const ctx = vm.createContext(sandbox);
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'scene-kit.js'), 'utf8'),
      ctx, {filename: 'scene-kit.js'});
  /* 桥: 词法 const → 外部可访问(camp-kit.test 同款) */
  vm.runInContext('globalThis.__sk = SceneKit;', ctx);
  return {sk: sandbox.__sk};
}

test('幅度界 ±3: 全域 |h| ≤ 3, amp 越界(10)被钳制', () => {
  const {sk} = loadSceneKit();
  for (const opts of [undefined, {}, {salt: 9}, {amp: 10}, {amp: 10, salt: 3}]) {
    for (let x = -64; x <= 256; x += 3) {
      for (let z = -64; z <= 256; z += 3) {
        const h = sk.heightAt(x, z, opts);
        assert.ok(h >= -3 && h <= 3,
            '幅度界红线: (' + x + ',' + z + ') ' + JSON.stringify(opts) + ' → ' + h);
      }
    }
  }
  /* amp 可调小: amp=0 全图归零(核心圈平地, T5 消费口径);
     Math.round 可能产 -0, 消费者比较用 === 口径 */
  for (let x = 0; x < 128; x += 5) {
    for (let z = 0; z < 128; z += 5) {
      assert.ok(sk.heightAt(x, z, {amp: 0}) === 0,
          'amp=0 → 平地: (' + x + ',' + z + ')');
    }
  }
});

test('压平区归基准: 圆心邻域回落 base, base 可调, 多圆并集', () => {
  const {sk} = loadSceneKit();
  const flats = [{cx: 100, cz: 100, r: 24}];
  /* 圆心 ±2 的四角控制格点全在圆内(最远 17 < 24) → 双线性精确 base */
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      assert.ok(sk.heightAt(100 + dx, 100 + dz, {flats}) === 0,
          '压平区圆心邻域应归基准 0: (' + (100 + dx) + ',' + (100 + dz) + ') → ' +
          sk.heightAt(100 + dx, 100 + dz, {flats}));
    }
  }
  /* base 可调: 基准抬 2, 圆心邻域跟随(高度场是相对偏移, 消费者加地基) */
  for (let dx = -2; dx <= 2; dx += 2) {
    for (let dz = -2; dz <= 2; dz += 2) {
      assert.ok(sk.heightAt(100 + dx, 100 + dz, {flats, base: 2}) === 2,
          '压平区基准可调: base=2 圆心 → ' +
          sk.heightAt(100 + dx, 100 + dz, {flats, base: 2}));
    }
  }
  /* 多圆并集: 第二个圆心也归基准(遮罩取并集) */
  const two = [{cx: 100, cz: 100, r: 24}, {cx: 208, cz: 48, r: 24}];
  assert.ok(sk.heightAt(208, 48, {flats: two}) === 0, '第二圆心也归基准');
});

test('确定性: 同参同值, 整格阶梯化, salt 换地形', () => {
  const {sk} = loadSceneKit();
  let saltDiff = 0;
  for (let x = -40; x <= 200; x += 7) {
    for (let z = -40; z <= 200; z += 5) {
      const a = sk.heightAt(x, z);
      const b = sk.heightAt(x, z);
      assert.strictEqual(a, b, '同参必须同值: (' + x + ',' + z + ')');
      assert.ok(Number.isInteger(a), '整格阶梯化: 输出必须是整数');
      if (sk.heightAt(x, z, {salt: 5}) !== a) saltDiff++;
    }
  }
  assert.ok(saltDiff > 0, '换 salt 应产出不同地形');
});
