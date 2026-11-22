'use strict';
/* T-C13-R6 判别力探针 2/3(红证, 永红——非套件成员, 命名无 .test.js 后缀防 npm test 误收)
   ------------------------------------------------------------
   缺陷类: 重放漂移(同 seed 重跑时钟序不一致——多喂一拍的漂移重放)。
   本探针把套件 test/campfire-bench-c6.test.js ②确定性面的同款断言逻辑
   喂给漂移重放(真 fx-core, 同 seed, B 轨迹多喂一拍), 证明确定性断言对该
   缺陷类必 AssertionError(§7.4 断言红)——零裸随机/确定性重放守门有牙。
   跑法: node .scratch/run-green.js --label tc13r6-red-probe-drift <本文件> */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const CampfireFxCore = require(path.join(__dirname, '..', '..', '..', 'js', 'campfire-fx-core.js'));

function mkGrid50(step) {
  const out = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue;
      out.push({x: col * step, y: 1, z: row * step});
    }
  }
  for (let k = 0; k < 5; k++) out.push({x: (3 + k) * step, y: 1, z: 7 * step});
  return out;
}

function runTrajectory(extraTick) {
  const cells = mkGrid50(5);
  const fx = CampfireFxCore.mkCampfireFx({seed: 20261117});
  for (const c of cells) fx.open(c.x, c.y, c.z);
  if (extraTick) fx.tick(0.05); /* 缺陷注入: 时钟漂移(重放多喂一拍) */
  const traj = [];
  for (let t = 0; t < 36; t++) {
    fx.tick(0.05);
    traj.push(cells.map((c) => fx.flameFrameAt(c.x, c.y, c.z)));
  }
  return traj;
}

test('判别力探针(永红)·确定性面: 漂移重放喂逐拍一致断言——恒红(轨迹逐位异)', () => {
  const a = runTrajectory(false);
  const b = runTrajectory(true);
  assert.deepStrictEqual(b, a, '漂移重放轨迹应与基准轨迹逐位同 (实测多喂一拍即漂移)');
});
