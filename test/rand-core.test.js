'use strict';
/* 确定性随机核心 (js/rand-core.js) 单测 — node --test (零依赖)
   运行: node --test test/rand-core.test.js
   覆盖: mkRand 同 seed 同序列/首步与手算公式一致/异 seed 异序列/缺省 seed
   不炸(NaN 回归防线) · shuffle 非突变/多重集不变/确定性 rnd 注入出确定
   结果/不同 rnd 可出不同序 · seedAt 派生公式(base*7919+i*101+j+13,
   j 缺省 0)与旧式 b*7919+13 的恒等锚(迁移安全) · childSeed 值域与同流
   确定性。 */
const test = require('node:test');
const assert = require('node:assert');
const RandCore = require('../js/rand-core.js');

const take = (rnd, n) => Array.from({length: n}, () => rnd());
const sorted = (a) => a.slice().sort((x, y) => x - y);

/* ============ mkRand: 同常数 LCG ============ */

test('mkRand: 同 seed 同序列(同 seed 同输出的归一语义)', () => {
  assert.deepStrictEqual(take(RandCore.mkRand(42), 8), take(RandCore.mkRand(42), 8));
});

test('mkRand: 首步与手算公式一致 — seed=1 → (1*1103515245+12345)%2147483648/2147483648', () => {
  const rnd = RandCore.mkRand(1);
  const expect = ((1 * 1103515245 + 12345) % 2147483648) / 2147483648;
  assert.strictEqual(rnd(), expect);
});

test('mkRand: 输出落在 [0,1) 且为有限数(NaN 回归防线)', () => {
  for (const s of [0, 1, 7, 12345, 2147483647]) {
    for (const v of take(RandCore.mkRand(s), 50)) {
      assert.ok(Number.isFinite(v) && v >= 0 && v < 1, 'seed=' + s + ' 出界值: ' + v);
    }
  }
});

test('mkRand: 不同 seed 序列不同', () => {
  const a = take(RandCore.mkRand(1), 8);
  const b = take(RandCore.mkRand(2), 8);
  assert.notDeepStrictEqual(a, b);
});

test('mkRand: 缺省 seed 返回函数且调用不炸(回落 Math.random 既定口径)', () => {
  const rnd = RandCore.mkRand();
  assert.strictEqual(typeof rnd, 'function');
  for (const v of take(rnd, 20)) {
    assert.ok(Number.isFinite(v) && v >= 0 && v < 1, '缺省 seed 出界值: ' + v);
  }
});

/* ============ shuffle: 非突变拷贝式 Fisher–Yates ============ */

test('shuffle: 入参不被突变(拷贝式契约)', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const before = src.join(',');
  RandCore.shuffle(RandCore.mkRand(9), src);
  assert.strictEqual(src.join(','), before);
});

test('shuffle: 元素多重集不变(不丢不重)', () => {
  const src = Array.from({length: 12}, (_, k) => k + 1);
  for (const s of [0, 1, 2, 3, 999]) {
    const out = RandCore.shuffle(RandCore.mkRand(s), src);
    assert.deepStrictEqual(sorted(out), src, 'seed=' + s + ' 多重集漂移');
  }
});

test('shuffle: 注入确定性 rnd → 结果确定(同流同序)', () => {
  const src = Array.from({length: 10}, (_, k) => k);
  assert.deepStrictEqual(
      RandCore.shuffle(RandCore.mkRand(7), src), RandCore.shuffle(RandCore.mkRand(7), src));
});

test('shuffle: 注入不同 rnd → 结果可以不同(真的在洗)', () => {
  const src = Array.from({length: 10}, (_, k) => k);
  const orders = new Set([0, 1, 2, 3, 4, 5].map((s) => RandCore.shuffle(RandCore.mkRand(s), src).join(',')));
  assert.ok(orders.size > 1, '六条流全部同序: ' + [...orders].join(' | '));
});

test('shuffle: 空数组与单元素安全', () => {
  assert.deepStrictEqual(RandCore.shuffle(RandCore.mkRand(1), []), []);
  assert.deepStrictEqual(RandCore.shuffle(RandCore.mkRand(1), ['x']), ['x']);
});

/* ============ seedAt: 关卡/小节种子统一派生 ============ */

test('seedAt: 公式 = base*7919 + i*101 + j + 13, j 缺省 0', () => {
  assert.strictEqual(RandCore.seedAt(3, 5), 3 * 7919 + 5 * 101 + 0 + 13);
  assert.strictEqual(RandCore.seedAt(3, 5, 2), 3 * 7919 + 5 * 101 + 2 + 13);
  assert.strictEqual(RandCore.seedAt(0, 0), 13);
  assert.strictEqual(RandCore.seedAt(2, 7, 1), 2 * 7919 + 7 * 101 + 1 + 13);
});

test('seedAt: seedAt(b, 0) === 旧式 b*7919+13 恒等(迁移安全锚)', () => {
  for (const b of [0, 1, 4, 17, 60, 119]) {
    assert.strictEqual(RandCore.seedAt(b, 0), b * 7919 + 13, 'base=' + b);
  }
});

/* ============ childSeed: 父流派生子种子 ============ */

test('childSeed: 值域 [0, 2147483646] 整数', () => {
  const rnd = RandCore.mkRand(2026);
  for (let k = 0; k < 200; k++) {
    const v = RandCore.childSeed(rnd);
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 2147483646, '出界值: ' + v);
  }
});

test('childSeed: 同 rnd 流确定(序列一致)', () => {
  const drain = (seed) => Array.from({length: 5}, () => RandCore.childSeed(RandCore.mkRand(seed)));
  assert.deepStrictEqual(drain(11), drain(11));
  assert.notDeepStrictEqual(drain(11), drain(12));
});
