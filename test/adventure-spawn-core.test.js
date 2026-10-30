'use strict';
/* 刷怪核心 (js/adventure-spawn-core.js) 单测 — node --test (零依赖)
   运行: node --test test/adventure-spawn-core.test.js
   S1 同名单测(conventions §1.2 守门): 三件零依赖零状态, require 直测。
   「逐拍独立」「配额满归零」的语义单点断言在此承载(候选 2 归一的
   Wins 口径); 消费方(adventure-core/dims-core 的薄壳与组装)行为由
   各自既有测试的注入 rnd 断言继续锁, 此处不重复。 */
const test = require('node:test');
const assert = require('node:assert');
const Spawn = require('../js/adventure-spawn-core.js');

/* 顺序 rnd 注入器: 按序消费, 尽头重复末值(消费序断言的确定性口径) */
const seq = (arr) => {
  let i = 0;
  return () => arr[Math.min(i++, arr.length - 1)];
};

/* ============ advSpawnPulse: 通用节拍器 ============ */

test('advSpawnPulse: 门关→计时归零不出令(存活门/配额满/白天的共同骨架)', () => {
  assert.deepStrictEqual(Spawn.advSpawnPulse(false, 5, 1, 2), {fire: false, t: 0},
      '门关即归零——「配额满归零」语义单点');
});

test('advSpawnPulse: 门开未满→只累计; 恰到拍→发令并归零', () => {
  assert.deepStrictEqual(Spawn.advSpawnPulse(true, 1, 1, 3), {fire: false, t: 2}, '未满只累计');
  assert.deepStrictEqual(Spawn.advSpawnPulse(true, 1, 1, 2), {fire: true, t: 0},
      'nt=interval 恰到拍即发(≥ 口径)');
  assert.deepStrictEqual(Spawn.advSpawnPulse(true, 1.9, 0.2, 2), {fire: true, t: 0}, '越过拍值同样发令');
});

test('advSpawnPulse: 逐拍独立——发令即归零, 上一拍的拒绝不结转概率', () => {
  const a = Spawn.advSpawnPulse(true, 2, 0, 2); /* 到拍发令 */
  assert.deepStrictEqual(a, {fire: true, t: 0}, '发令后计时归零');
  assert.deepStrictEqual(Spawn.advSpawnPulse(true, a.t, 1, 2), {fire: false, t: 1},
      '下一拍从零累计——节拍器只认 (t, dt), 不记得上一拍掷过什么');
  /* 纯函数性: 同输入必同输出(拒绝后重掷与本拍首次掷无差异) */
  assert.deepStrictEqual(Spawn.advSpawnPulse(true, 1.9, 0.2, 2), Spawn.advSpawnPulse(true, 1.9, 0.2, 2),
      '零状态: 同输入同输出');
});

/* ============ advWeightedPick: 加权取种 ============ */

test('advWeightedPick: 权重分段掷种——首段/中段/末段按累计权重落位', () => {
  const pool = [['zombie', 2], ['creeper', 1], ['spider', 1]]; /* 总 4 */
  assert.strictEqual(Spawn.advWeightedPick(pool, seq([0])), 'zombie', 'pick=0 → 首段');
  assert.strictEqual(Spawn.advWeightedPick(pool, seq([0.5])), 'creeper', 'pick=2 → 恰落第二段边界内');
  assert.strictEqual(Spawn.advWeightedPick(pool, seq([0.99])), 'spider', 'pick=3.96 → 末段');
});

test('advWeightedPick: 浮点尽头兜底末段——pick 扣完各段仍 ≥0 回末段种', () => {
  const pool = [['zombie', 2], ['creeper', 1], ['spider', 1]];
  assert.strictEqual(Spawn.advWeightedPick(pool, seq([1])), 'spider',
      'rnd()=1 → pick=4, 逐段扣完皆不小于 0 → 兜底末段(与归一前源同式)');
});

test('advWeightedPick: 零权重段天然永不命中', () => {
  const pool = [['a', 0], ['b', 1]];
  assert.strictEqual(Spawn.advWeightedPick(pool, seq([0])), 'b', '零权重段 pick 不减负, 直接落 b');
  assert.strictEqual(Spawn.advWeightedPick(pool, seq([0.999])), 'b', '任意 rnd 都跳过零权重段');
});

/* ============ advRingSpot: 环带掷点 ============ */

test('advRingSpot: 角度/半径均匀掷点——rnd 消费序先角度后半径(确定性)', () => {
  /* a=0(cos=1, sin=0), r=lo+0.5*(hi-lo)=3 → x=cx+3, z=cz */
  const s = Spawn.advRingSpot(10, -3, 1.5, 4.5, seq([0, 0.5]));
  assert.deepStrictEqual(s, {x: 13, z: -3}, 'a=0/r=3 的直角落位');
  /* a=π/2(cos≈0, sin=1), r=lo → x≈cx, z=cz+lo(浮点 epsilon 内) */
  const q = Spawn.advRingSpot(10, -3, 1.5, 4.5, seq([0.25, 0]));
  assert.ok(Math.abs(q.x - 10) < 1e-9, 'cos(π/2)≈0 → x 回环心');
  assert.ok(Math.abs(q.z - (-3 + 1.5)) < 1e-9, 'sin(π/2)=1 → z=cz+lo');
});

test('advRingSpot: 落点恒在环带 [lo, hi) 内(500 次统计)', () => {
  for (let i = 0; i < 500; i++) {
    const s = Spawn.advRingSpot(64, 64, 24, 40, Math.random);
    const d = Math.hypot(s.x - 64, s.z - 64);
    assert.ok(d >= 24 - 1e-9 && d < 40 + 1e-9, '环心距在 [lo, hi) 内(实际 ' + d.toFixed(3) + ')');
  }
});
