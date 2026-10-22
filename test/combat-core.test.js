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
