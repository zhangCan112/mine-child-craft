'use strict';
/* 世界轨试次循环核心单测(MathTrackCore, js/math-track-core.js) — node --test
   运行: node --test test/math-track-core.test.js
   覆盖: clampTrials 钳制(1~30, 缺省/0/undefined 回落 6) · settle 记分账本
   (trials/correct/maxStreakErr, streak 连对延续/答错清零) · 节拍决策
   (连对 %3===0 表扬恰在 3/6/9, 连错 ≥3 安慰并清零重攒) · end 回填 acc
   (零试次 0 不除零, 幂等) · stats 引用稳定(消费方持有的账本跨 end 不换)。
   行为契约对齐三引擎既有单测(math-paradigms.test.js 的 onTrial/表扬/安慰
   用例与 math-track.test.js 的宿主纪律 — 那两处经真件消费本核心) */
const test = require('node:test');
const assert = require('node:assert');
const {MathTrackCore} = require('../js/math-track-core.js');

/* ============ clampTrials ============ */

test('clampTrials: 1~30 钳制, 缺省回落 6(四处手写同款并一)', () => {
  assert.strictEqual(MathTrackCore.clampTrials(undefined), 6, 'undefined 回落 6');
  assert.strictEqual(MathTrackCore.clampTrials(0), 6, '0 回落 6(|| 语义)');
  assert.strictEqual(MathTrackCore.clampTrials(null), 6, 'null 回落 6');
  assert.strictEqual(MathTrackCore.clampTrials(3), 3, '界内原样');
  assert.strictEqual(MathTrackCore.clampTrials(30), 30, '上界原样');
  assert.strictEqual(MathTrackCore.clampTrials(31), 30, '超上界钳 30');
  assert.strictEqual(MathTrackCore.clampTrials(-2), 1, '负值钳 1');
  assert.strictEqual(MathTrackCore.clampTrials(0.5), 1, '不足 1 钳 1');
});

/* ============ settle 记分与节拍 ============ */

test('settle: 记分账本 — 对计 correct 连对延续, 错清零并计 maxStreakErr', () => {
  const loop = MathTrackCore.mkTrialLoop();
  assert.deepStrictEqual(loop.settle(true), {ok: true, streak: 1, praise: false, comfort: false});
  assert.deepStrictEqual(loop.settle(true), {ok: true, streak: 2, praise: false, comfort: false});
  assert.deepStrictEqual(loop.settle(false), {ok: false, streak: 0, praise: false, comfort: false});
  assert.deepStrictEqual(loop.settle(true), {ok: true, streak: 1, praise: false, comfort: false});
  assert.strictEqual(loop.stats.trials, 4);
  assert.strictEqual(loop.stats.correct, 3);
  assert.strictEqual(loop.stats.maxStreakErr, 1, '单次连错记 1');
});

test('settle: 表扬节拍 — 连对 %3===0 恰在 3/6/9 触发, 4/5 不触发', () => {
  const loop = MathTrackCore.mkTrialLoop();
  const praiseAt = [];
  for (let i = 1; i <= 9; i++) {
    const ev = loop.settle(true);
    if (ev.praise) praiseAt.push(ev.streak);
  }
  assert.deepStrictEqual(praiseAt, [3, 6, 9], '表扬恰在连对 3/6/9');
});

test('settle: 安慰节拍 — 连错 ≥3 触发并清零重攒(第 6 错再触发, maxStreakErr 仍 3)', () => {
  const loop = MathTrackCore.mkTrialLoop();
  const comfortAt = [];
  for (let i = 1; i <= 7; i++) {
    const ev = loop.settle(false);
    if (ev.comfort) comfortAt.push(i);
  }
  assert.deepStrictEqual(comfortAt, [3, 6], '连错 3 与清零后再连错 3(第 6 错)触发安慰');
  assert.strictEqual(loop.stats.maxStreakErr, 3, 'maxStreakErr 取最长连错(安慰清零不抹账)');
});

test('settle: 连错被答对打断 — 不触发安慰, errRun 归零重攒', () => {
  const loop = MathTrackCore.mkTrialLoop();
  loop.settle(false);
  loop.settle(false);
  assert.strictEqual(loop.settle(true).comfort, false, '两错后被对打断');
  const ev = loop.settle(false);
  assert.strictEqual(ev.comfort, false, '重攒第 1 错不安慰(原实现同口径: errRun 已清零)');
  loop.settle(false);
  assert.strictEqual(loop.settle(false).comfort, true, '重攒满 3 再安慰');
});

/* ============ end ============ */

test('end: 回填 acc(零试次不除零)且幂等; stats 引用跨 end 稳定', () => {
  const loop = MathTrackCore.mkTrialLoop();
  loop.settle(true);
  loop.settle(false);
  const before = loop.stats;
  const st = loop.end();
  assert.strictEqual(st, loop.stats, 'end 返回的就是账本本体(不另造对象)');
  assert.strictEqual(before, loop.stats, '消费方持有的引用不换');
  assert.strictEqual(st.trials, 2);
  assert.strictEqual(st.correct, 1);
  assert.strictEqual(st.acc, 0.5);
  loop.end();
  assert.strictEqual(loop.stats.acc, 0.5, 'end 幂等');
  const empty = MathTrackCore.mkTrialLoop();
  assert.strictEqual(empty.end().acc, 0, '零试次 acc=0 不除零');
});
