"use strict";
/* 怪物核心 (js/mob-core.js) 单测 — node --test (零依赖)
   运行: node --test test/mob-core.test.js
   纯核心零全局依赖(groundTop 由调用方注入), 直接 vm 加载单文件;
   镜像 test/tank-core.test.js 的惯例, 但无需 voxel.js */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCore(){
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'mob-core.js'), 'utf8'), ctx, { filename: 'mob-core.js' });
  return vm.runInContext('MobCore', ctx);      /* const 绑定不挂 context 属性, 以表达式取值 */
}

/* 平地 groundTop 替身: 指定格为抬高地面, 其余为 y=10 */
function fakeGround(hills){
  return (x, z) => (hills[x + ',' + z] !== undefined ? hills[x + ',' + z] : 10);
}

function mkMob(hp){
  return { pos: { x: 64.5, y: 11, z: 64.5 }, hp, maxHp: hp || 30,
           dead: false, deadT: 0, gone: false, flashT: 0, staggerT: 0, tintBase: [1, 1, 1] };
}

/* ============ 受击状态机 ============ */

test('受击: 扣血并进入闪白与踉跄, 未死返回 dead=false', () => {
  const MobCore = loadCore();
  const m = mkMob(30);
  const r = MobCore.hitState(m, 12);
  assert.strictEqual(m.hp, 18, '扣血');
  assert.strictEqual(r.hp, 18, '返回血量');
  assert.strictEqual(r.dead, false, '未死');
  assert.strictEqual(r.freshDead, false, '不是新死亡');
  assert.strictEqual(m.flashT, 0.25, '闪白计时置位');
  assert.strictEqual(m.staggerT, 0.22, '踉跄计时置位');
  assert.ok(!m.dead, '存活');
});

test('死亡: 血量归零首次进入死亡态, freshDead 只报一次', () => {
  const MobCore = loadCore();
  const m = mkMob(30);
  const r1 = MobCore.hitState(m, 40);
  assert.strictEqual(m.hp, 0, '血量夹到 0 不为负');
  assert.strictEqual(r1.dead, true, '死亡');
  assert.strictEqual(r1.freshDead, true, '首次死亡');
  assert.strictEqual(m.deadT, 0, '死亡动画计时归零起步');
  const r2 = MobCore.hitState(m, 5);                 /* 尸体再挨一下 */
  assert.strictEqual(r2.freshDead, false, '不重复报死(调用方据此只结算一次)');
  assert.strictEqual(m.hp, 0, '尸体血量不再下降');
});

test('受击状态机不碰位移: 击退由壳层用 stepMove 施加', () => {
  const MobCore = loadCore();
  const m = mkMob(30);
  MobCore.hitState(m, 5);
  assert.strictEqual(m.pos.x, 64.5, '纯核心不移动位置');
});

/* ============ 台阶移动 ============ */

test('stepMove: 平地与上 1 格台阶放行, 2 格台阶拦截', () => {
  const MobCore = loadCore();
  const g = fakeGround({ '66,64': 11 });             /* 前方一格高台 */
  const walk = mkMob(30);
  MobCore.stepMove(walk, 1, 0, g);
  assert.strictEqual(walk.pos.x, 65.5, '平地放行');
  const climb = mkMob(30); climb.pos.x = 65.5;
  MobCore.stepMove(climb, 1, 0, g);
  assert.strictEqual(climb.pos.x, 66.5, '上 1 格台阶放行(履带/脚能爬)');
  const wall = mkMob(30); wall.pos.x = 66.5;
  const g2 = fakeGround({ '66,64': 11, '67,64': 13 });
  MobCore.stepMove(wall, 1, 0, g2);
  assert.strictEqual(wall.pos.x, 66.5, '2 格高差拦截');
});

test('stepMove: 下坡随意走(高差为负不拦)', () => {
  const MobCore = loadCore();
  const m = mkMob(30); m.pos.x = 66.5;
  const g = fakeGround({ '66,64': 12, '67,64': 10 });
  MobCore.stepMove(m, 1, 0, g);
  assert.strictEqual(m.pos.x, 67.5, '下坡放行');
});

/* ============ 着色 ============ */

test('tintFlash: 闪白期由剩余时间插值, 闪白结束回落到持久色', () => {
  const MobCore = loadCore();
  const m = mkMob(30);
  m.flashT = 0.25;
  let t = MobCore.tintFlash(m);
  assert.ok(t[0] > 1.8 && t[1] < 0.2, '满闪白: 亮红白 ' + t);
  m.flashT = 0.01;
  t = MobCore.tintFlash(m);
  assert.ok(Math.abs(t[0] - 1) < 0.15, '临消退接近常态: ' + t);
  m.flashT = 0;
  m.tintBase = [1.4, 0.5, 0.5];                      /* 狂暴常驻红晕(模式写入) */
  t = MobCore.tintFlash(m);
  assert.deepStrictEqual(t, [1.4, 0.5, 0.5], '无闪白用持久色');
});
