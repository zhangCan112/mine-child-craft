'use strict';
/* T-C13-R3 红测设计前置数学预演(临时脚本, 不入测试):
   ① 50 格 phase 两两全异性; ② 渐弱节奏断言的格存在性(m'∈[0.005,0.155));
   ③ 三帧覆盖性(任意 now, 50 格帧号集={0,1,2})。公式=fx-core cellSeed(只读预演)。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function cellSeed(root, x, y, z) {
  let h = (root ^ 0x5EEDC9) >>> 0;
  h = Math.imul(h ^ x, 2654435761) >>> 0;
  h = Math.imul(h ^ y, 2654435761) >>> 0;
  h = Math.imul(h ^ z, 2654435761) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}
const phase = (x, y, z, root) => cellSeed((root >>> 0) || 20261117, x, y, z) / 4294967296;

/* ① bench grid50 摆位: 两两全异? */
function mkGrid50() {
  const out = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue;
      out.push({x: col * 5, y: 1, z: row * 5});
    }
  }
  out.push({x: 15, y: 1, z: 35}, {x: 20, y: 1, z: 35}, {x: 25, y: 1, z: 35},
    {x: 30, y: 1, z: 35}, {x: 35, y: 1, z: 35});
  return out;
}
const g50 = mkGrid50();
const phases = g50.map((c) => phase(c.x, c.y, c.z));
const uniq = new Set(phases).size;
console.log('[1] grid50 phase 唯一值数:', uniq, '/ 50', uniq === 50 ? '(全异 OK)' : '(有碰撞!)');
console.log('    极差:', (Math.max(...phases) - Math.min(...phases)).toFixed(4));

/* ② 渐弱节奏格存在性: 找 m'=(now0+p*T) mod 0.30 ∈ [0.005,0.155) 的格(T=0.45) */
const FS = 0.15; const T = 3 * FS;
const NOW0 = 10; const DELTA = 0.145;
let found = null;
for (let x = 100; x < 400 && !found; x++) {
  const p = phase(x, 25, 10);
  const m = (NOW0 + p * T) % (2 * FS);
  if (m >= 0.005 && m < 0.155) found = {x, p, m};
}
console.log('[2] 节奏断言格:', found ? 'x=' + found.x + ' p=' + found.p.toFixed(6) + ' m\'=' + found.m.toFixed(6) : '未找到!');
if (found) {
  const fAt = (now, fsEff) => Math.floor((now + found.p * T) / fsEff) % 3;
  const full0 = fAt(NOW0, FS); const full1 = fAt(NOW0 + DELTA, FS);
  const fade0 = fAt(NOW0, 2 * FS); const fade1 = fAt(NOW0 + DELTA, 2 * FS);
  console.log('    full: ' + full0 + '->' + full1 + ' (期望翻 1 帧: ' + ((full1 - full0 + 3) % 3 === 1) + ')');
  console.log('    fade(0.30): ' + fade0 + '->' + fade1 + ' (期望不翻: ' + (fade1 === fade0) + ')');
  /* 渐弱窗尾 tint=1 桌面=0.30 与低核恒档 0.30 同帧距: 行为一致性预演 */
  console.log('    fade 封顶帧距 0.15*(1+1*1)=', FS * (1 + 1), ' 低核 0.15*2=', FS * 2);
}

/* ③ 三帧覆盖: 任意 now, 50 格帧号集={0,1,2}(fs_eff=0.15 全额) */
for (const now of [0, 0.07, 0.5, 3.3]) {
  const set = new Set(phases.map((p) => Math.floor((now + p * T) / FS) % 3));
  console.log('[3] now=' + now + ' 帧号覆盖:', [...set].sort().join(','), set.size === 3 ? 'OK' : '不足 3 帧!');
}
/* ④ 积分重算核对(rate=2): 渐起窗 0.5s ∫=0.5; 1s ∫=1.5; 低核 1s ∫=0.75 */
console.log('[4] ∫₀^0.5 2·ramp =', 2 * 0.25, ' | ∫₀¹ 2·ramp =', 2 * 0.75, ' | ∫₀¹ 1·ramp =', 0.75);
/* ⑤ 1s 后在飞火苗数下界(rate=2): 发射于 t>1-0.7=0.3 者存活 ∫_0.3^1 2·ramp */
const inFlight = 2 * ((1 - 0.3 >= 0.5 ? 0.5 : (0.5 - 0) + (1 - 0.3 - 0.5)) + 0);
const intRamp = (t) => (t <= 0.5 ? t * t : 0.25 + (t - 0.5));
console.log('[5] 1s 后在飞下界 ∫_0.3^1 2·ramp =', (2 * (intRamp(1) - intRamp(0.3))).toFixed(4));
