'use strict';
/* 训练营轮换核心 (CampRotation) 单测 — node --test (零依赖)
   运行: node --test test/camp-rotation-core.test.js */
const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/camp-rotation-core.js');

const DAY = 86400000;

/* ============ 轮换 ============ */

test('轮换: 上线日 2026-10-28 = robot (用户拍板"第一天从机器人开始", 钉死)', () => {
  assert.strictEqual(C.dailyCamp('2026-10-28'), 'robot');
});

test('轮换: 按表循环且跨月正确', () => {
  assert.strictEqual(C.dailyCamp('2026-10-29'), 'focus');
  assert.strictEqual(C.dailyCamp('2026-10-30'), 'math');
  assert.strictEqual(C.dailyCamp('2026-10-31'), 'robot'); /* 10-31 跨回表首 */
  assert.strictEqual(C.dailyCamp('2026-11-1'), 'focus'); /* 跨月无前导零格式 */
  assert.strictEqual(C.dailyCamp('2027-10-26'), 'robot'); /* +363 天(363%3=0)回到同轮换位 */
});

test('轮换: 天序 = 纪元天数, 任意一天推进一天换下一营', () => {
  const d = C.dateIndex('2026-10-28');
  for (let k = 0; k < 9; k++) {
    const dateStr = new Date(Date.UTC(2026, 9, 28) + k * DAY);
    const want = ['robot', 'focus', 'math'][(d + k) % 3];
    const got = C.dailyCamp(dateStr.getUTCFullYear() + '-' + (dateStr.getUTCMonth() + 1) + '-' +
        dateStr.getUTCDate());
    assert.strictEqual(got, want, 'day+' + k);
  }
});

test('轮换: 损坏日期串回落 robot 不炸', () => {
  assert.strictEqual(C.dailyCamp(''), 'robot');
  assert.strictEqual(C.dailyCamp('garbage'), 'robot');
  assert.strictEqual(C.dailyCamp(undefined), 'robot');
});

test('奖励二选一候选: 除今日营外两营, 保持表序', () => {
  assert.deepStrictEqual(C.rewardChoices('2026-10-28'), ['focus', 'math']);
  assert.deepStrictEqual(C.rewardChoices('2026-10-29'), ['robot', 'math']);
});

/* ============ 表现奖励判定 ============ */

const PASS = {played: 6, capCount: 6, spentMs: 7 * 60000, accMean: 90};

test('判据: 全达标通过', () => {
  assert.deepStrictEqual(C.evalReward(PASS), {pass: true, fail: []});
});

test('判据: 边界含 — 恰 8 分钟与恰 80% 都算过', () => {
  assert.strictEqual(C.evalReward({played: 6, capCount: 6, spentMs: 8 * 60000, accMean: 80}).pass, true);
});

test('判据: 任一不满足即否, fail 注明原因', () => {
  assert.deepStrictEqual(
      C.evalReward({played: 5, capCount: 6, spentMs: 9 * 60000, accMean: 70}).fail.sort(),
      ['acc', 'played', 'time']);
  assert.deepStrictEqual(
      C.evalReward({played: 6, capCount: 6, spentMs: 8 * 60000 + 1, accMean: 80}).fail, ['time']);
  assert.deepStrictEqual(
      C.evalReward({played: 6, capCount: 6, spentMs: 8 * 60000, accMean: 79.9}).fail, ['acc']);
});

test('判据: 零输入全否(防御 undefined)', () => {
  const v = C.evalReward();
  assert.strictEqual(v.pass, false);
  assert.ok(v.fail.indexOf('played') >= 0);
});

/* ============ 账本状态迁移(无突变) ============ */

test('ensureDate: date 不符(跨午夜/损坏/缺档)即重置', () => {
  assert.deepStrictEqual(C.ensureDate(null, '2026-10-28'), C.freshState('2026-10-28'));
  const old = {date: '2026-10-27', reward: true, bonus: 'math', acc: {robot: {n: 3, sum: 270}}};
  const fresh = C.ensureDate(old, '2026-10-28');
  assert.strictEqual(fresh.reward, false); /* 昨天的奖励态不带到今天 */
  assert.deepStrictEqual(fresh.acc, {});
  assert.strictEqual(C.ensureDate({date: '2026-10-28'}, '2026-10-28').reward, false); /* 形状缺字段也重置 */
});

test('noteAcc: 逐关累计均值, 原状态不被突变', () => {
  const s0 = C.freshState('2026-10-28');
  const s1 = C.noteAcc(s0, '2026-10-28', 'robot', 100);
  const s2 = C.noteAcc(s1, '2026-10-28', 'robot', 60);
  assert.strictEqual(C.accMean(s2, 'robot'), 80); /* (100+60)/2 */
  assert.strictEqual(s0.acc.robot, undefined); /* 输入无突变 */
  assert.strictEqual(s1.acc.robot.n, 1);
  /* 越界钳制 0-100 */
  assert.strictEqual(C.accMean(C.noteAcc(s0, '2026-10-28', 'focus', 999), 'focus'), 100);
  assert.strictEqual(C.accMean(C.noteAcc(s0, '2026-10-28', 'focus', -5), 'focus'), 0);
});

test('earnReward: 置位且幂等', () => {
  const s = C.freshState('2026-10-28');
  const e1 = C.earnReward(s, '2026-10-28');
  assert.strictEqual(e1.reward, true);
  assert.strictEqual(C.earnReward(e1, '2026-10-28'), e1); /* 二次解锁不动账 */
  assert.strictEqual(s.reward, false); /* 原状态无突变 */
});

test('chooseBonus: 只收候选营, 选定后幂等', () => {
  const e = C.earnReward(C.freshState('2026-10-28'), '2026-10-28');
  assert.strictEqual(C.chooseBonus(e, '2026-10-28', 'robot'), e); /* 今日营不可选 */
  assert.strictEqual(C.chooseBonus(e, '2026-10-28', 'nope'), e); /* 非营不可选 */
  const picked = C.chooseBonus(e, '2026-10-28', 'math');
  assert.strictEqual(picked.bonus, 'math');
  assert.strictEqual(C.chooseBonus(picked, '2026-10-28', 'focus'), picked); /* 已选定幂等(改选无效) */
  assert.strictEqual(C.chooseBonus(C.freshState('2026-10-28'), '2026-10-28', 'math').bonus, null); /* 未解锁不可选 */
});

test('isRewardChoice: 待选态 = 已解锁×未选定×是候选', () => {
  const today = '2026-10-28';
  assert.strictEqual(C.isRewardChoice(null, today, 'focus'), false); /* 无账本(启动早期)不炸 */
  assert.strictEqual(C.isRewardChoice(C.freshState(today), today, 'focus'), false);
  const e = C.earnReward(C.freshState(today), today);
  assert.strictEqual(C.isRewardChoice(e, today, 'focus'), true);
  assert.strictEqual(C.isRewardChoice(e, today, 'robot'), false); /* 今日营不是候选 */
  assert.strictEqual(C.isRewardChoice(C.chooseBonus(e, today, 'focus'), today, 'math'), false); /* 已选定 */
});

test('bonusOf: null 安全', () => {
  assert.strictEqual(C.bonusOf(null), null);
  assert.strictEqual(C.bonusOf({bonus: 'focus'}), 'focus');
});
