'use strict';
/* 旋转核心单测(test/spinner-core.test.js):
   钳域/注册/tick 步进/绕回/排空 —— mesh 按哑对象约定 {rotation:{}} 注入,
   零 THREE·零 DOM(conventions §7 纯核心同名单测纪律)。
   契约面 = SpinnerCore.clampPeriod/register/tickSpinners/drain
   (ADR-0011 增补①: 单 mesh tick 口径, ≥1s 周期下限, 非通用动画系统)。 */
const test = require('node:test');
const assert = require('node:assert');
const {SpinnerCore, clampPeriod} = require('../js/spinner-core.js');

/* 哑 mesh: 只暴露 rotation 三轴可写属性(THREE Object3D 的消费面投影) */
const mkMesh = () => ({rotation: {x: 0, y: 0, z: 0}});

test('clampPeriod: 非有限数回落 5(设计带中点) · 低于 1s 钳到 1(ADR 下限) · 带内原值 · 无上限', () => {
  assert.strictEqual(clampPeriod(undefined), 5, '缺省回落 5(4-6s 设计带中点)');
  assert.strictEqual(clampPeriod(null), 5);
  assert.strictEqual(clampPeriod(NaN), 5);
  assert.strictEqual(clampPeriod('x'), 5, '非数回落(拼写域钳)');
  assert.strictEqual(clampPeriod(0), 1, '0 周期=停摆歧义, 钳到下限');
  assert.strictEqual(clampPeriod(0.5), 1, '快旋破「祥和无威胁」口径, 钳 1');
  assert.strictEqual(clampPeriod(1), 1, '下限值原样');
  assert.strictEqual(clampPeriod(4.5), 4.5, '带内原值');
  assert.strictEqual(clampPeriod(99), 99, '无上限(数据钩自担)');
});

test('register: period 过钳域 · axis 白名单 x|z(其余落 z) · phase 缺省 0 · 返回表长', () => {
  SpinnerCore.drain(); /* 表态隔离 */
  const n = SpinnerCore.register({mesh: mkMesh(), axis: 'z', period: 0.2});
  assert.strictEqual(n, 1, '返回注册表长度');
  SpinnerCore.register({mesh: mkMesh(), axis: 'x', period: 4});
  SpinnerCore.register({mesh: mkMesh(), axis: 'q', period: 6});
  SpinnerCore.register({mesh: mkMesh(), axis: undefined});
  const all = SpinnerCore.drain();
  assert.strictEqual(all.length, 4);
  assert.strictEqual(all[0].period, 1, '0.2 → 钳 1');
  assert.strictEqual(all[1].period, 4, '带内原值');
  assert.strictEqual(all[3].period, 5, '缺省 period → 5');
  assert.strictEqual(all[0].axis, 'z');
  assert.strictEqual(all[1].axis, 'x', 'x 白名单原样');
  assert.strictEqual(all[2].axis, 'z', '非法 axis 落 z(轮面竖直缺省轴)');
  assert.strictEqual(all[3].axis, 'z');
  assert.strictEqual(all[0].phase, 0, 'phase 缺省 0');
});

test('tickSpinners: dt 折算圈数写 rotation[axis]=phase·2π · 跨步累加 · 绕回 0..1', () => {
  SpinnerCore.drain();
  const mesh = mkMesh();
  SpinnerCore.register({mesh, axis: 'z', period: 5});
  SpinnerCore.tickSpinners(2.5); /* 半圈 */
  assert.ok(Math.abs(mesh.rotation.z - Math.PI) < 1e-9, 'dt2.5/period5 → 半圈 π, 实测 ' + mesh.rotation.z);
  assert.strictEqual(mesh.rotation.x, 0, '未注册轴不动');
  SpinnerCore.tickSpinners(2.5); /* 累加满圈 → 绕回 0 */
  assert.strictEqual(mesh.rotation.z, 0, 'phase 满 1 绕回(rotation=0)');
  SpinnerCore.tickSpinners(1.25); /* 四分之一圈 */
  assert.ok(Math.abs(mesh.rotation.z - Math.PI / 2) < 1e-9, '绕回后续走: π/2');
});

test('tickSpinners: axis=x 写 x 轴 · 空表零炸 · dt=0 不动', () => {
  SpinnerCore.drain();
  SpinnerCore.tickSpinners(1); /* 空表零炸 */
  const mx = mkMesh();
  SpinnerCore.register({mesh: mx, axis: 'x', period: 4});
  SpinnerCore.tickSpinners(0);
  assert.strictEqual(mx.rotation.x, 0, 'dt=0 相位不动');
  SpinnerCore.tickSpinners(1);
  assert.ok(Math.abs(mx.rotation.x - Math.PI / 2) < 1e-9, 'x 轴步进 π/2');
});

test('drain: 返回全部条目并清空(scene.remove/dispose 归调用方, 纯核只交引用)', () => {
  SpinnerCore.drain();
  const a = mkMesh(); const b = mkMesh();
  SpinnerCore.register({mesh: a, axis: 'z'});
  SpinnerCore.register({mesh: b, axis: 'x', period: 2});
  const out = SpinnerCore.drain();
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].mesh, a, 'mesh 引用原样交出');
  assert.strictEqual(out[1].period, 2);
  assert.deepStrictEqual(SpinnerCore.drain(), [], '再排空=空表(清场幂等)');
});

test('表态隔离: 每例起步前 drain(drain 幂等, 上例已清) · register 空表从零计', () => {
  const n = SpinnerCore.register({mesh: mkMesh(), axis: 'z'});
  assert.strictEqual(n, 1, '上例排空后从 1 起计(无跨例累积)');
  SpinnerCore.drain();
});
