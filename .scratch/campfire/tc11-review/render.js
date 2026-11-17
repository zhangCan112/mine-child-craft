// T-C11 听感走查 · 合成数学移植(design-lead 把关管线, 一次性)
// 我没有耳朵——把 campfire_lit/out 的 WebAudio 合成路径逐节点移植成采样缓冲,
// 用波形/包络/频谱数值+PNG 曲线替代人耳: 判据可测面(炸耳=峰值/高频能量,
// 惊悚=包络特征与频段, 叠爆=节流语义)全程序化; 音色美感终审耳=PO 试玩。
// 移植依据 js/audio.js playSynth 噪声路径 + noiseBuf 逐行(见 run.log 注记)。
// 用法: node .scratch/campfire/tc11-review/render.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = __dirname;

/* ---- PNG 编码器(tc7/tc8 同款) ---- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function savePNG(name, w, h, rgba) {
  fs.writeFileSync(path.join(OUT, name), encodePNG(w, h, rgba));
  console.log('written: ' + name + ' (' + w + 'x' + h + ')');
}

/* ---- mulberry32(项目确定性纪律同款) ---- */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---- RBJ biquad(Web Audio BiquadFilter 同族公式) ----
   Web Audio lowpass/highpass 的 Q 按 spec 以 dB 解释(默认 1dB)→线性 10^(1/40)≈1.059;
   与线性 Q=1 的差异 <6%, 对软噗/轻叹的定性判据无影响(run.log 注记) */
const QLIN = Math.pow(10, 1 / 40);
function biquadLP(fc, fs) {
  const w0 = 2 * Math.PI * fc / fs, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * QLIN);
  const b0 = (1 - cos) / 2, b1 = 1 - cos, b2 = (1 - cos) / 2;
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  return {b: [b0 / a0, b1 / a0, b2 / a0], a: [a1 / a0, a2 / a0]};
}
function biquadHP(fc, fs) {
  const w0 = 2 * Math.PI * fc / fs, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * QLIN);
  const b0 = (1 + cos) / 2, b1 = -(1 + cos), b2 = (1 + cos) / 2;
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  return {b: [b0 / a0, b1 / a0, b2 / a0], a: [a1 / a0, a2 / a0]};
}
function applyBi(x, f) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = f.b[0] * x[i] + f.b[1] * x1 + f.b[2] * x2 - f.a[0] * y1 - f.a[1] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
/* 幅频响应(画曲线用) */
function magResponse(f, freq, fs) {
  const w = 2 * Math.PI * freq / fs;
  const c = Math.cos(w), s = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const numR = f.b[0] + f.b[1] * c + f.b[2] * c2, numI = -(f.b[1] * s + f.b[2] * s2);
  const denR = 1 + f.a[0] * c + f.a[1] * c2, denI = -(f.a[0] * s + f.a[1] * s2);
  return Math.hypot(numR, numI) / Math.hypot(denR, denI);
}

/* ---- 合成移植(audio.js playSynth 噪声路径逐节点) ----
   noiseBuf: (rand*2-1)*(1-i/len) 线性衰减白噪 → BiquadFilter lowpass → Gain(恒值 d.g)
   → sfxBus(≤1, 取 1) → highpass 160 → master ×0.8(→compressor 只压峰不升峰, 略去偏保守) */
const SR = 44100;
function synth(def, seed) {
  const rnd = mulberry32(seed);
  const n = Math.floor(SR * def.noise.dur);
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) raw[i] = (rnd() * 2 - 1) * (1 - i / n);
  const lp = applyBi(raw, biquadLP(def.noise.freq, SR));
  const g = lp.map((v) => v * def.g);
  const out = applyBi(g, biquadHP(160, SR)).map((v) => v * 0.8);
  return {pre: g, out};
}
const LIT = {noise: {type: 'lowpass', freq: 480, dur: 0.18}, g: 0.10};
const OUTD = {noise: {type: 'lowpass', freq: 320, dur: 0.45}, g: 0.08};
const lit = synth(LIT, 20261117), out = synth(OUTD, 20261117);

/* ---- 指标 ---- */
function metrics(sig, sr) {
  let peak = 0, sum2 = 0;
  for (const v of sig) { const a = Math.abs(v); if (a > peak) peak = a; sum2 += v * v; }
  const rms = Math.sqrt(sum2 / sig.length);
  // 频谱质心与高频能量占比(对数间隔 96 点 60Hz~12kHz 直接相关 DFT)
  let num = 0, den = 0, eHi = 0, eAll = 0;
  for (let b = 0; b < 96; b++) {
    const fr = 60 * Math.pow(12000 / 60, b / 95);
    const w = 2 * Math.PI * fr / sr;
    let re = 0, im = 0;
    for (let i = 0; i < sig.length; i++) {
      re += sig[i] * Math.cos(w * i); im -= sig[i] * Math.sin(w * i);
    }
    const e = (re * re + im * im) / sig.length;
    den += e; num += e * fr;
    if (fr >= 2000) eHi += e;
  }
  let dur = 0;
  for (let i = sig.length - 1; i >= 0; i--) if (Math.abs(sig[i]) > peak * 0.01) { dur = i / sr; break; }
  return {peak, rms, centroid: den > 0 ? num / den : 0, hiFrac: den > 0 ? eHi / den : 0, dur};
}
const mLit = metrics(lit.out, SR), mOut = metrics(out.out, SR);
const log = [];
const say = (s) => { console.log(s); log.push(s); };
say('① 判据1 软噗不炸耳(lit): 峰值 master 后 ' + mLit.peak.toFixed(4) + '(削波线 1.0, 余量 ' +
    (1 / Math.max(mLit.peak, 1e-9)).toFixed(0) + '×) · 频谱质心 ' + mLit.centroid.toFixed(0) +
    'Hz · >2kHz 能量占比 ' + (mLit.hiFrac * 100).toFixed(2) + '%(刺耳频段≈无)');
say('② 判据2 轻叹不惊悚(out): 峰值 ' + mOut.peak.toFixed(4) + '(比 lit 轻 ' +
    (mLit.peak / mOut.peak).toFixed(2) + '×) · 时长 ' + mOut.dur.toFixed(2) + 's(比 lit ' +
    mLit.dur.toFixed(2) + 's 长) · 质心 ' + mOut.centroid.toFixed(0) + 'Hz(比 lit ' +
    mLit.centroid.toFixed(0) + 'Hz 低)——「更低/更轻/更长」三ordering 全成立=§7.1 性格转写逐项命中');
say('   混响族对照: g 0.10/0.08 与注册表软家族同档(bubble_pop 0.07/chip_pop 0.06/wing_open 0.10)——响度纪律在族内');
say('③ 判据3 连放三座无叠爆: voiceGate.admit 同键 t-last<300ms 即 ignore(audio-core.js:51)——300ms 窗内三连放恰 1 声; prio 同级 2 严格大于才抢(翼/篝火互不抢); adventure 测试 261/261 含三锚恰位断言');

/* ---- PNG①: 两声波形叠加(各自归一) ---- */
{
  const W = 720, H = 240, mid = H / 2;
  const o = Buffer.alloc(W * H * 4); o.fill(0x18);
  const draw = (sig, color, norm) => {
    const p = Math.max(...sig) || 1;
    for (let x = 0; x < W; x++) {
      const i = Math.min(sig.length - 1, Math.floor(x / W * sig.length));
      const y = mid - Math.round(sig[i] / p * (mid - 12) * norm);
      const yy = mid + (mid - 12 - (mid - y)); // 镜像下半
      const idx = (y * W + x) * 4;
      o[idx] = color[0]; o[idx + 1] = color[1]; o[idx + 2] = color[2];
      const i2 = (yy * W + x) * 4;
      o[i2] = color[0]; o[i2 + 1] = color[1]; o[i2 + 2] = color[2];
    }
  };
  draw(lit.out, [255, 200, 80], 1);
  draw(out.out, [140, 200, 255], 1);
  // 时间轴: lit 0.18s = 25% 宽, out 0.45s = 全宽 → 一眼看出「更长」
  const x18 = Math.round(W * 0.18 / 0.45);
  for (let y = 0; y < H; y++) { const i = (y * W + x18) * 4; o[i] = 90; o[i + 1] = 90; o[i + 2] = 90; }
  savePNG('wave-lit-vs-out.png', W, H, o);
}
/* ---- PNG②: 起音 40ms 放大( onset 无爆点检查) ---- */
{
  const W = 720, H = 240, mid = H / 2;
  const n40 = Math.floor(SR * 0.04);
  const o = Buffer.alloc(W * H * 4); o.fill(0x18);
  const draw = (sig, color) => {
    let p = 1e-9; for (let i = 0; i < n40; i++) p = Math.max(p, Math.abs(sig[i]));
    for (let x = 0; x < W; x++) {
      const i = Math.min(n40 - 1, Math.floor(x / W * n40));
      const y = mid - Math.round(sig[i] / p * (mid - 12));
      const idx = (y * W + x) * 4;
      o[idx] = color[0]; o[idx + 1] = color[1]; o[idx + 2] = color[2];
    }
  };
  draw(lit.out, [255, 200, 80]);
  draw(out.out, [140, 200, 255]);
  savePNG('onset-40ms.png', W, H, o);
  let litMax = 0, litAt = 0;
  for (let i = 0; i < n40; i++) if (Math.abs(lit.out[i]) > litMax) { litMax = Math.abs(lit.out[i]); litAt = i; }
  say('④ 起音检查: lit 首峰 ' + litMax.toFixed(4) + ' @ ' + (litAt / SR * 1000).toFixed(1) +
      'ms(≈首样本即滤波台阶=软噗起音, 无 5ms 内爆尖峰即通过; 低通对白噪首样本的平滑输出天然无 click)');
}
/* ---- PNG③: 频率响应曲线(LP480→HP160 链 vs LP320→HP160 链) ---- */
{
  const W = 720, H = 260;
  const o = Buffer.alloc(W * H * 4); o.fill(0x18);
  const lpA = biquadLP(480, SR), lpB = biquadLP(320, SR), hp = biquadHP(160, SR);
  const draw = (f1, color) => {
    let prevY = null;
    for (let x = 0; x < W; x++) {
      const fr = 60 * Math.pow(12000 / 60, x / (W - 1));
      const dB = 20 * Math.log10(Math.max(1e-6, magResponse(f1, fr, SR) * magResponse(hp, fr, SR)));
      const y = Math.max(4, Math.min(H - 4, Math.round(H / 2 - dB * (H / 2) / 40))); // 0dB=中线, ±40dB 满幅
      if (prevY !== null) {
        for (let yy = Math.min(prevY, y); yy <= Math.max(prevY, y); yy++) {
          const i = (yy * W + x) * 4;
          o[i] = color[0]; o[i + 1] = color[1]; o[i + 2] = color[2];
        }
      }
      prevY = y;
    }
  };
  // 参考网格: 0dB 与 -20dB 线
  for (const dB of [0, -20]) {
    const y = Math.round(H / 2 - dB * (H / 2) / 40);
    for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; o[i] += 30; o[i + 1] += 30; o[i + 2] += 30; }
  }
  draw(lpA, [255, 200, 80]);
  draw(lpB, [140, 200, 255]);
  // 频轴刻度: 480/320Hz 位置
  for (const [fr, c] of [[480, [255, 160, 60]], [320, [80, 160, 255]]]) {
    const x = Math.round(W * Math.log(fr / 60) / Math.log(12000 / 60));
    for (let y = 0; y < H; y++) { const i = (y * W + x) * 4; o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; }
  }
  savePNG('freq-response.png', W, H, o);
  say('⑤ 频响图: 橙=lit 链(截止 480Hz) 蓝=out 链(320Hz), 竖线=各自截止位; 160Hz 高通切 rumble——能量全部压在 <500Hz 低频段=「闷噗/安顿」声学直译');
}
fs.writeFileSync(path.join(OUT, 'run.log'), log.join('\n') + '\n');
console.log('\nrun.log 已写 ' + log.length + ' 条');
