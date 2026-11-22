'use strict';
/* T-C13-R6 动笔前经验复证(非测试, 断言铸造前置侦察): A/B 两景 50 火
   在固定 tick 序采样时刻的帧分布覆盖实测——若存在塌缩时刻, 红面改判。
   用法: node .scratch/campfire/tc13r-c6/coverage-scan.js */
const CampfireFxCore = require('../../../js/campfire-fx-core.js');

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

function scan(step) {
  const cells = mkGrid50(step);
  const fx = CampfireFxCore.mkCampfireFx({});
  for (const c of cells) fx.open(c.x, c.y, c.z);
  let worst = 3;
  const rows = [];
  for (let t = 1; t <= 36; t++) {
    fx.tick(0.05);
    const d = [0, 0, 0];
    for (const c of cells) d[fx.flameFrameAt(c.x, c.y, c.z)]++;
    const cov = d.filter((n) => n > 0).length;
    if (cov < worst) worst = cov;
    if (cov < 3) rows.push('t=' + (t * 0.05).toFixed(2) + ' 分布=[' + d.join(',') + '] covered=' + cov);
  }
  return {cells: cells.length, worst, collapsed: rows};
}

const A = scan(5);
const B = scan(18);
console.log('A 密集(step5): 50=' + A.cells + ' 最差覆盖=' + A.worst + '/3 塌缩时刻=' + A.collapsed.length);
A.collapsed.forEach((r) => console.log('  ' + r));
console.log('B 疏散(step18): 50=' + B.cells + ' 最差覆盖=' + B.worst + '/3 塌缩时刻=' + B.collapsed.length);
B.collapsed.forEach((r) => console.log('  ' + r));

/* 相位散布侦察: 两景 50 格相位 distinct 数与 [0,1) 三分桶铺满 */
for (const [tag, step] of [['A', 5], ['B', 18]]) {
  const fx = CampfireFxCore.mkCampfireFx({});
  const cells = mkGrid50(step);
  const ph = cells.map((c) => fx.flamePhase(c.x, c.y, c.z));
  const distinct = new Set(ph).size;
  const buckets = [0, 0, 0];
  ph.forEach((p) => buckets[Math.min(2, Math.floor(p * 3))]++);
  console.log(tag + ' 相位: distinct=' + distinct + '/50 三分桶=[' + buckets.join(',') + ']');
}

/* 确定性侦察: 同 seed 双实例 36 拍帧向量逐位同 */
{
  const cells = mkGrid50(5);
  const f1 = CampfireFxCore.mkCampfireFx({});
  const f2 = CampfireFxCore.mkCampfireFx({});
  for (const c of cells) { f1.open(c.x, c.y, c.z); f2.open(c.x, c.y, c.z); }
  let drift = 0;
  for (let t = 0; t < 36; t++) {
    f1.tick(0.05); f2.tick(0.05);
    for (const c of cells) {
      if (f1.flameFrameAt(c.x, c.y, c.z) !== f2.flameFrameAt(c.x, c.y, c.z)) drift++;
    }
  }
  let em1 = 0; let em2 = 0;
  for (const c of cells) {
    em1 += f1.emitters(c.x, c.y, c.z).flame.emitted + f1.emitters(c.x, c.y, c.z).smoke.emitted;
    em2 += f2.emitters(c.x, c.y, c.z).flame.emitted + f2.emitters(c.x, c.y, c.z).smoke.emitted;
  }
  console.log('确定性: 36 拍帧向量漂移=' + drift + ' 发射计数 ' + em1 + ' vs ' + em2);
}
