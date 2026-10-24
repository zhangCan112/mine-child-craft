'use strict';
/* 战斗核心 (js/combat-core.js) 单测 — node --test (零依赖)
   运行: node --test test/combat-core.test.js
   三个纯入口: 预测弹道 / 攻击节拍 / 身体命中判定
   (竞技场箭矢与下界火球共用 — 抽取前下界是直线弹道, 对移动目标常打空)。 */
const test = require('node:test');
const assert = require('node:assert');
const CombatCore = require('../js/combat-core.js');

test('leadAim: 静止目标 — 方向指向身体瞄点且归一化', () => {
  const d = CombatCore.leadAim({x: 0, y: 2, z: 0}, {x: 10, y: 0, z: 0, vx: 0, vz: 0, h: 2}, 20, 10, 0.5);
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9, '归一化方向');
  assert.ok(d.x > 0.99, '正东目标 → x 主导');
  assert.ok(d.y > 0, '瞄点(脚上 1.0 + 重力补偿 1.25 = 2.25)高于枪口 2.0 → 略微向上(重力补偿生效)');
});

test('leadAim: 移动目标 — 提前量朝运动方向偏移(g=0 隔离提前量, 不掺重力抬升)', () => {
  const still = CombatCore.leadAim({x: 0, y: 1, z: 0}, {x: 10, y: 1, z: 0, vx: 0, vz: 0, h: 1.8}, 10, 0, 0.5);
  const east = CombatCore.leadAim({x: 0, y: 1, z: 0}, {x: 10, y: 1, z: 0, vx: 5, vz: 0, h: 1.8}, 10, 0, 0.5);
  assert.ok(east.x > still.x, '目标向东跑 → 瞄点更靠东');
  assert.strictEqual(east.z, still.z, '无侧向速度 → z 不偏');
});

test('leadAim: 重力补偿 — 有重力时瞄点高于无重力', () => {
  const flat = CombatCore.leadAim({x: 0, y: 1, z: 0}, {x: 20, y: 1, z: 0, vx: 0, vz: 0, h: 1.8}, 10, 0, 0.5);
  const grav = CombatCore.leadAim({x: 0, y: 1, z: 0}, {x: 20, y: 1, z: 0, vx: 0, vz: 0, h: 1.8}, 10, 9.5, 0.5);
  assert.ok(grav.y > flat.y, '重力补偿抬枪');
});

test('tickCadence: 节拍递减, 零与负值不再下降', () => {
  const m = {attackCd: 0.5, attackT: 0.2};
  CombatCore.tickCadence(m, 0.3);
  assert.ok(Math.abs(m.attackCd - 0.2) < 1e-9);
  assert.ok(Math.abs(m.attackT - (-0.1)) < 1e-9, '小于零后本拍不再递减(下一轮 if 守卫)');
  CombatCore.tickCadence(m, 0.3);
  assert.ok(Math.abs(m.attackCd - (-0.1)) < 1e-9, '到零以下即停');
  const zero = {attackCd: 0, attackT: 0};
  CombatCore.tickCadence(zero, 1);
  assert.strictEqual(zero.attackCd, 0, '零保持(就绪态不被 dt 推走)');
});

test('hitBody: 水平半径 × 垂直身高段的盒判定', () => {
  const t = {pos: {x: 10, y: 5, z: 10}, cfg: {hitR: 0.6, h: 1.9}};
  assert.ok(CombatCore.hitBody({x: 10.5, y: 6, z: 10.4}, t), '身体内命中');
  assert.ok(!CombatCore.hitBody({x: 10.7, y: 6, z: 10}, t), '水平出半径');
  assert.ok(!CombatCore.hitBody({x: 10, y: 4.6, z: 10}, t), '脚下 0.3 以下不判中');
  assert.ok(!CombatCore.hitBody({x: 10, y: 7.5, z: 10}, t), '头顶 0.5 以上不判中');
  assert.ok(CombatCore.hitBody({x: 10, y: 7.3, z: 10}, t), '头顶余量内仍中');
  assert.ok(CombatCore.hitBody({x: 10.8, y: 6, z: 10}, t, 0.3), 'inflate 扩大判定(爆炸直击的贴身要求)');
  const bare = {pos: {x: 0, y: 0, z: 0}};
  assert.ok(CombatCore.hitBody({x: 0.5, y: 1, z: 0}, bare), '缺省 hitR 0.55 / h 1.8');
});

test('stepShot: 重力→寿命→欧拉积分一步(先扣重力再位移, 三份手写同序)', () => {
  const s = {from: {x: 0, y: 10, z: 0}, vel: {x: 20, y: 0, z: 0}, life: 3, g: 10};
  const r = CombatCore.stepShot(s, 0.5);
  assert.strictEqual(r.vel.y, -5, '速度先扣重力(g·dt)');
  assert.strictEqual(r.life, 2.5, '寿命递减');
  assert.strictEqual(r.x, 10, '水平等速积分');
  assert.strictEqual(r.y, 10 - 5 * 0.5, '垂直用扣完重力的速度积分(7.5)');
  assert.ok(!r.dead, '寿命未尽且未撞块');
  assert.strictEqual(s.from.y, 10, '非变更式: 原状态不被改写(调用方自决存储载体)');
});

test('stepShot: 撞块与寿命尽判死; g 缺省 6; getBlock 缺省不查块', () => {
  const solid = () => CombatCore.stepShot(
      {from: {x: 0, y: 0.5, z: 0}, vel: {x: 1, y: 0, z: 0}, life: 9, g: 0}, 1,
      (x, y, z) => (y === 0 ? 1 : 0));
  assert.ok(solid().dead, '落进实心块(y=0)判死');
  assert.ok(solid().hitBlock, 'hitBlock 单列(竞技场巨石: 撞块触发 AoE, 寿命尽只移除)');
  const through = CombatCore.stepShot(
      {from: {x: 0, y: 5, z: 0}, vel: {x: 1, y: 0, z: 0}, life: 9, g: 0}, 1,
      () => 0);
  assert.ok(!through.dead, '空气与长寿命不判死');
  const expired = CombatCore.stepShot(
      {from: {x: 0, y: 5, z: 0}, vel: {x: 0, y: 0, z: 0}, life: 0.2, g: 0}, 1);
  assert.ok(expired.dead && !expired.hitBlock, '寿命尽判死但不记撞块');
  const noBlock = CombatCore.stepShot(
      {from: {x: 0, y: 0, z: 0}, vel: {x: 0, y: 0, z: 0}, life: 9, g: 0}, 1);
  assert.ok(!noBlock.dead, '未注入 getBlock 时不做撞块判定(纯核心零全局依赖)');
  const gDefault = CombatCore.stepShot(
      {from: {x: 0, y: 0, z: 0}, vel: {x: 0, y: 0, z: 0}, life: 9}, 0.1);
  assert.ok(Math.abs(gDefault.vel.y - (-0.6)) < 1e-9, 'g 缺省 6(下界/探险火球口径)');
});
