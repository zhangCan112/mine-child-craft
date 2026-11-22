'use strict';
/* T-C13-R6 判别力探针 1/3(红证, 永红——非套件成员, 命名无 .test.js 后缀防 npm test 误收)
   ------------------------------------------------------------
   缺陷类: 错相相位源塌缩(齐翻/同相——flamePhase 退化成常值, 帧号全场同步)。
   本探针把套件 test/campfire-bench-c6.test.js ①错相面的同款断言逻辑喂给
   退化 fx 桩(恒 0 帧/恒 0.42 相位), 证明错相断言对该缺陷类必 AssertionError
   (§7.4 断言红, 非装具炸)——套件断言出生即绿(守门兑现), 红证=判别力直证。
   跑法: node .scratch/run-green.js --label tc13r6-red-probe-phase <本文件> */
const test = require('node:test');
const assert = require('node:assert');

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

/* 退化 fx 桩: 相位源塌缩(与真 fx-core 同缝——flamePhase/flameFrameAt 查询面) */
function mkDegenerateFx() {
  return {
    flamePhase: () => 0.42,
    flameFrameAt: () => 0,
  };
}

test('判别力探针(永红)·错相面: 相位源塌缩喂帧分布断言——恒红(覆盖 1 非 3)', () => {
  const fx = mkDegenerateFx();
  const cells = mkGrid50(5);
  for (let t = 0; t < 36; t++) {
    const d = [0, 0, 0];
    for (const c of cells) d[fx.flameFrameAt(c.x, c.y, c.z)]++;
    const covered = d.filter((n) => n > 0).length;
    assert.strictEqual(covered, 3,
        '塌缩源 t=' + ((t + 1) * 0.05).toFixed(2) + 's 帧分布应覆盖 3 帧 (实测 [' + d.join(',') + '])');
  }
});

test('判别力探针(永红)·错相面: 相位源塌缩喂散布断言——恒红(distinct 1 非 50)', () => {
  const fx = mkDegenerateFx();
  const ph = mkGrid50(18).map((c) => fx.flamePhase(c.x, c.y, c.z));
  assert.strictEqual(new Set(ph).size, 50, '塌缩源 50 格相位应两两全异 (实测全同值)');
});
