'use strict';
/* T-C13-R5 c1 锁强化预证: 50 火确定性场景的帧分布实测
   ------------------------------------------------------------
   评审收敛窗 c1: R4-6 断言 frames.size>=2 升 >=3。评审确定性场景实测
   15/18/17 三帧全覆盖(固定场景零 flake)——本脚本在改断言前机械复证该实测,
   落盘 stdout 作「旧锁对新断言弱证」的补强证据(锁强化非红转绿, 红轨迹
   =旧锁 >=2 无法区分 2 帧与 3 帧分布)。
   场景=R4-6 同款: 7×7 去四角 45 + 5 = 50 火, fx.tick(0.07) 固定采样时刻,
   全确定性零随机零墙钟(node 直跑纯核心, 无装具)。
   用法: node frame-coverage-proof.js  (输出直读, 非测试) */
const CampfireFxCore = require('../../../js/campfire-fx-core.js');

const fx = CampfireFxCore.mkCampfireFx({});
const cells50 = [];
for (let i = 0; i < 7; i++) {
  for (let j = 0; j < 7; j++) {
    if ((i === 0 || i === 6) && (j === 0 || j === 6)) continue;
    cells50.push({x: 100 + i * 7, y: 25, z: 100 + j * 7});
  }
}
for (let k = 0; k < 5; k++) cells50.push({x: 200 + k * 9, y: 25, z: 100});
if (cells50.length !== 50) throw new Error('前置: 50 火场成形, 实得 ' + cells50.length);
for (const c of cells50) fx.open(c.x, c.y, c.z);
fx.tick(0.07); /* 固定采样时刻(R4-6 同款, 确定性) */

const dist = [0, 0, 0];
for (const c of cells50) dist[fx.flameFrameAt(c.x, c.y, c.z)]++;
const covered = dist.filter((n) => n > 0).length;
console.log('50 火 @t=0.07 帧分布: F1(74)=' + dist[0] + ' F2(75)=' + dist[1] + ' F3(76)=' + dist[2]);
console.log('covered frames = ' + covered + ' / 3');
console.log('旧锁 >=2 判定: ' + (covered >= 2 ? 'PASS(弱证: 2 与 3 不可分)' : 'FAIL'));
console.log('新锁 >=3 判定: ' + (covered >= 3 ? 'PASS' : 'FAIL'));
/* 多采样时刻对照(零 flake: 任意时刻均须覆盖 3 帧才算稳) */
let worst = 3;
for (const t of [0.01, 0.07, 0.1, 0.23, 0.5, 1.0]) {
  const fx2 = CampfireFxCore.mkCampfireFx({});
  for (const c of cells50) fx2.open(c.x, c.y, c.z);
  fx2.tick(t);
  const d = [0, 0, 0];
  for (const c of cells50) d[fx2.flameFrameAt(c.x, c.y, c.z)]++;
  const cov = d.filter((n) => n > 0).length;
  if (cov < worst) worst = cov;
  console.log('t=' + t + ' 分布=[' + d.join(',') + '] covered=' + cov);
}
console.log('六采样时刻最差覆盖 = ' + worst + ' / 3' + (worst >= 3 ? ' (零 flake)' : ' (有 flake!)'));
