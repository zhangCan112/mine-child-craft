'use strict';
/* T-C13-R6 判别力探针 3/3(红证, 永红——非套件成员, 命名无 .test.js 后缀防 npm test 误收)
   ------------------------------------------------------------
   缺陷类: 每火独占面片(ADR-0020 前世界——50 火=50 张 mesh, dc 随火数线性涨,
   架构承诺「静态件驻 chunk 批 0 专属 dc+焰片全场共享 sheet +1」被破坏)。
   本探针把套件 test/campfire-bench-c6.test.js ③装具自检的同款形态断言
   (恰 1 张 sheet/可绘段 600)喂给退化装具(每火一 mesh), 证明形态断言对该
   缺陷类必 AssertionError(§7.4 断言红)——dc 架构承诺的守门读数有牙。
   跑法: node .scratch/run-green.js --label tc13r6-red-probe-planes <本文件> */
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

/* 退化装具: 每火独占一张 12 索引面片 mesh(共享 sheet 退化前的世界形态) */
function mkPerFirePlaneField(cells) {
  return cells.map(() => ({geometry: {drawRange: {count: 12}}}));
}

test('判别力探针(永红)·装具自检: 每火一 mesh 喂恰一张断言——恒红(50 张非 1)', () => {
  const field = mkPerFirePlaneField(mkGrid50(5));
  assert.strictEqual(field.length, 1, '50 火应恰 1 张共享 sheet (实测每火独占 ' + field.length + ' 张)');
});

test('判别力探针(永红)·装具自检: 每火一 mesh 喂可绘段断言——恒红(单张 12 非 600)', () => {
  const field = mkPerFirePlaneField(mkGrid50(5));
  assert.strictEqual(field[0].geometry.drawRange.count, 50 * 12,
      '共享 sheet 可绘段应=50 火×12 索引=600 (实测单张独占 ' + field[0].geometry.drawRange.count + ')');
});
