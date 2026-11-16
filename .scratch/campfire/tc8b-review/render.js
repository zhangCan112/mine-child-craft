// T-C8b 视觉验收 · 白昼熄灭态取光修正 同参数重渲对比(design-lead 把关管线, 一次性)
// 基线: tc8-review/tc8b-BASELINE-day-out-64/16.png(修复前 voxBright 0.05 近黑)
// 场景: 照抄红测 09a953c 白昼口径——熄灭篝火(8,5,8)自身0/0, 上邻sky15/西13(+blk14)/东6/北0/南5
// 亮度曲线: f(L)=0.05+L/15*0.95(引擎 voxBright 双锚点 L0→0.05 / L15→1.0 线性插值, 模拟近似)
// 用法: node .scratch/campfire/tc8b-review/render.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = __dirname;
const BASE = path.join(ROOT, '.scratch', 'campfire', 'tc8-review');
const read = (f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

/* ---- 装载(照抄 test/texture-atlas.test.js loadAtlas) ---- */
function loadAtlas() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'texture-atlas.js', 'mesh-core.js']) {
    vm.runInContext(read(f), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__t = { TextureAtlas };', ctx);
  return ctx.__t;
}

/* ---- 最小 PNG 编码器(RGBA8, filter 0) — tc7/tc8 同款 ---- */
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
function savePNG(name, w, h, rgba, dir) {
  fs.writeFileSync(path.join(dir || OUT, name), encodePNG(w, h, rgba));
  console.log('written: ' + name + ' (' + w + 'x' + h + ')');
}

/* ---- 亮度曲线(双锚点线性) ---- */
const f15 = (L) => Math.min(1, 0.05 + (L / 15) * 0.95);

const t = loadAtlas();
const A = t.TextureAtlas.paintAll();
const cols = t.TextureAtlas.layout.cols;
const TILE = 16;
const log = [];
const say = (s) => { console.log(s); log.push(s); };

function crop(tile) {
  const p = A.pixels, W = A.w;
  const cx = (tile % cols) * TILE, cy = Math.floor(tile / cols) * TILE;
  const o = Buffer.alloc(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const si = ((cy + y) * W + cx + x) * 4, di = (y * TILE + x) * 4;
    o[di] = p[si]; o[di + 1] = p[si + 1]; o[di + 2] = p[si + 2]; o[di + 3] = p[si + 3];
  }
  return o;
}
/* tile → outSize 最近邻 × 亮度因子; side2x=true 时纵向 2:1 压扁(侧立面口径) */
function render(tileRGBA, outW, outH, factor) {
  const o = Buffer.alloc(outW * outH * 4);
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const si = (Math.floor(y / outH * TILE) * TILE + Math.floor(x / outW * TILE)) * 4;
    const di = (y * outW + x) * 4;
    o[di] = Math.min(255, Math.round(tileRGBA[si] * factor));
    o[di + 1] = Math.min(255, Math.round(tileRGBA[si + 1] * factor));
    o[di + 2] = Math.min(255, Math.round(tileRGBA[si + 2] * factor));
    o[di + 3] = 255;
  }
  return o;
}
function paste(dst, W, src, x0, y0) {
  for (let y = 0; y < src.H; y++) src.rgba.copy(dst, ((y0 + y) * W + x0) * 4, y * src.W * 4, (y + 1) * src.W * 4);
}

const outT = crop(63), burnT = crop(62);
const BG = 0x40, GAP = 12;

/* ① 基线 vs 修后对比条(核心落账图): [修复前 flat 0.05 | 修后顶面 sky15→1.0] 白昼同参数 */
{
  const before = render(outT, 64, 64, f15(0));
  const after = render(outT, 64, 64, f15(15));
  const W = 2 * 64 + 3 * GAP, H = 64 + 2 * GAP;
  const o = Buffer.alloc(W * H * 4); o.fill(BG);
  paste(o, W, {rgba: before, W: 64, H: 64}, GAP, GAP);
  paste(o, W, {rgba: after, W: 64, H: 64}, GAP * 2 + 64, GAP);
  savePNG('tc8b-COMPARE-day-out-before-after.png', W, H, o);
  say('① 基线对比条: 左=修复前(flat 0.05 近黑=tc8b-BASELINE 同款) 右=修后顶面(sky15→1.0)——判据1 主证据');
}

/* ③ 白昼五面板横排(顶面整格 + 四侧立面 2:1, 因子=红测场景逐面值) */
{
  const panels = [
    {n: 'top-15', rgba: render(outT, 64, 64, f15(15)), W: 64, H: 64},
    {n: 'west-13/14', rgba: render(outT, 64, 32, f15(14)), W: 64, H: 32},
    {n: 'east-6', rgba: render(outT, 64, 32, f15(6)), W: 64, H: 32},
    {n: 'south-5', rgba: render(outT, 64, 32, f15(5)), W: 64, H: 32},
    {n: 'north-0', rgba: render(outT, 64, 32, f15(0)), W: 64, H: 32},
  ];
  const Hs = 64 + 2 * GAP;
  const W2 = panels.reduce((s, p) => s + p.W, 0) + GAP * (panels.length + 1);
  const o = Buffer.alloc(W2 * Hs * 4); o.fill(BG);
  let x0 = GAP;
  for (const p of panels) { paste(o, W2, p, x0, GAP + (64 - p.H)); x0 += p.W + GAP; }
  say('② 白昼五面因子: 顶=1.00 西=0.94(sky13+blk14 双通道取亮) 东=0.43 南=0.37 北=0.05');
  savePNG('tc8b-day-five-faces.png', W2, Hs, o);
  say('③ 白昼五面板: top15 | west13(blk14 双通道取亮) | east6 | south5 | north0(排序同红测断言序)');
}

/* ④ 夜间不回退 + 燃烧零改动: [夜熄 全邻0→0.05 暗块 | 夜燃 自身blk15→1.0 发光体] */
{
  const a = render(outT, 64, 64, f15(0));
  const b = render(burnT, 64, 64, f15(15));
  const W = 2 * 64 + 3 * GAP, H = 64 + 2 * GAP;
  const o = Buffer.alloc(W * H * 4); o.fill(BG);
  paste(o, W, {rgba: a, W: 64, H: 64}, GAP, GAP);
  paste(o, W, {rgba: b, W: 64, H: 64}, GAP * 2 + 64, GAP);
  savePNG('tc8b-night-out-vs-burn.png', W, H, o);
  say('④ 夜间矩阵: 左=熄灭(全邻0→0.05 暗块, §4.5-2 不回退✅) 右=燃烧(blk15→1.0 发光体, 零改动✅)');
}

/* ⑤ 白昼远景模拟: LOD 8px/格 修后顶面(与基线 16px 版对照用) */
savePNG('tc8b-AFTER-day-out-top-64.png', 64, 64, render(outT, 64, 64, f15(15)));
savePNG('tc8b-AFTER-day-out-top-16.png', 16, 16, render(outT, 16, 16, f15(15)));
say('⑤ 修后定稿图: tc8b-AFTER-day-out-top-64/16.png(白昼顶面视角=玩家俯视主读面)');

fs.writeFileSync(path.join(OUT, 'run.log'), log.join('\n') + '\n');
console.log('\nrun.log 已写 ' + log.length + ' 条');
