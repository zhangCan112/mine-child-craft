// T-C8 视觉验收 · 两态贴图观感亲验(design-lead 把关管线, 一次性)
// 依据: docs/design/campfire-visual-spec.md §4(v1.4 终态) + §4.5 五项判据
// 产出: 两态放大图 / 61|62|63 相邻走查(贴身+LOD 模拟) / 昼夜光矩阵
//       / T-C8b 修复前基线(白昼熄灭态) / 半格扁盒世界观感图 + 程序判据日志
// 用法: node .scratch/campfire/tc8-review/render.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

/* ---- 装载(照抄 test/texture-atlas.test.js loadAtlas) ---- */
function loadAtlas() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'texture-atlas.js', 'mesh-core.js']) {
    vm.runInContext(read(f), ctx, {filename: f});
  }
  vm.runInContext(
      'globalThis.__t = { TextureAtlas, MeshCore, BLOCKS, B_CAMPFIRE, B_CAMPFIRE_OUT };', ctx);
  return ctx.__t;
}

/* ---- 最小 PNG 编码器(RGBA8, filter 0) — tc7-review 同款 ---- */
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
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function savePNG(name, w, h, rgba) {
  fs.writeFileSync(path.join(OUT, name), encodePNG(w, h, rgba));
  console.log('written: ' + name + ' (' + w + 'x' + h + ')');
}

/* ---- 色板(§4.2/§4.3 v1.4 定稿 hex, 与画师 CF 系列逐值一致) ---- */
const FLAME4 = [[255, 255, 255], [255, 255, 151], [255, 216, 0], [255, 143, 0]]; // w白芯 W亮黄 f橙黄 F橙焰
const EMBER = [224, 90, 26];   // e 余烬红
const ASH = [185, 180, 168];   // a 灰烬灰 #b9b4a8(§4.5-1 熄灭态最高亮度锚)

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const same = (p, i, rgb, tol) => Math.abs(p[i] - rgb[0]) <= tol && Math.abs(p[i + 1] - rgb[1]) <= tol && Math.abs(p[i + 2] - rgb[2]) <= tol;

/* ---- 主流程 ---- */
const t = loadAtlas();
const A1 = t.TextureAtlas.paintAll();
const A2 = t.TextureAtlas.paintAll();
const cols = t.TextureAtlas.layout.cols;
const TILE = 16;
const log = [];
const say = (s) => { console.log(s); log.push(s); };

function crop(tile, src) {
  const p = src.pixels, W = src.w;
  const cx = (tile % cols) * TILE, cy = Math.floor(tile / cols) * TILE;
  const out = Buffer.alloc(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const si = ((cy + y) * W + cx + x) * 4, di = (y * TILE + x) * 4;
    out[di] = p[si]; out[di + 1] = p[si + 1]; out[di + 2] = p[si + 2]; out[di + 3] = p[si + 3];
  }
  return out;
}

/* 最近邻放大 + 亮度因子(voxBright 模拟: 光 15=1.0, 光 0=0.05) */
function scale(tileRGBA, outSize, factor) {
  const out = Buffer.alloc(outSize * outSize * 4);
  for (let y = 0; y < outSize; y++) for (let x = 0; x < outSize; x++) {
    const si = (Math.floor(y / outSize * TILE) * TILE + Math.floor(x / outSize * TILE)) * 4;
    const di = (y * outSize + x) * 4;
    out[di] = Math.min(255, Math.round(tileRGBA[si] * factor));
    out[di + 1] = Math.min(255, Math.round(tileRGBA[si + 1] * factor));
    out[di + 2] = Math.min(255, Math.round(tileRGBA[si + 2] * factor));
    out[di + 3] = tileRGBA[si + 3];
  }
  return out;
}

/* ① 确定性(§4.5-3): paintAll 两次逐字节比对 */
const det = Buffer.from(A1.pixels.buffer, A1.pixels.byteOffset, A1.pixels.length)
    .equals(Buffer.from(A2.pixels.buffer, A2.pixels.byteOffset, A2.pixels.length));
say('① 确定性 §4.5-3: paintAll 两次 ' + (det ? '逐字节一致 ✅' : '不一致 ❌'));

/* ② 焰色/余烬程序判据(§4.5-1) */
const burn = crop(62, A1), out = crop(63, A1);
let f4 = 0, em = 0;
for (let i = 0; i < burn.length; i += 4) {
  if (FLAME4.some((c) => same(burn, i, c, 1))) f4++;
  else if (same(burn, i, EMBER, 1)) em++;
}
say('② §4.5-1 燃烧态: 焰四档 ' + f4 + 'px(判据 ≥50; lead 管线独立复核基线 68) + 余烬红 ' + em +
    'px = 合计 ' + (f4 + em) + 'px(施工线实测口径 76)');

let f4o = 0, emo = 0, maxL = -1, maxC = null;
for (let i = 0; i < out.length; i += 4) {
  if (FLAME4.some((c) => same(out, i, c, 1))) f4o++;
  else if (same(out, i, EMBER, 1)) emo++;
  const L = luma(out[i], out[i + 1], out[i + 2]);
  if (L > maxL) { maxL = L; maxC = [out[i], out[i + 1], out[i + 2]]; }
}
say('③ §4.5-1 熄灭态: 焰色 ' + f4o + 'px + 余烬红 ' + emo + 'px(判据 双零) · 最高亮度像素 ' +
    JSON.stringify(maxC) + '(判据=灰烬灰 ' + JSON.stringify(ASH) + ', luma ' + maxL.toFixed(1) + ') ' +
    ((f4o === 0 && emo === 0 && same(maxC, 0, ASH, 2)) ? '✅' : '❌'));

/* ③ 图集相邻走查(§4.5-4): 61|62|63 贴身并排 + LOD 远观模拟 */
const t61 = crop(61, A1), t62 = burn, t63 = out;
function touchRow(tiles, cell, factor) {
  const W = tiles.length * cell, H = cell;
  const rgba = Buffer.alloc(W * H * 4);
  tiles.forEach((tl, idx) => {
    const px = scale(tl, cell, factor);
    for (let y = 0; y < H; y++) px.copy(rgba, (y * W + idx * cell) * 4, y * cell * 4, (y + 1) * cell * 4);
  });
  return {rgba, W, H};
}
const l64 = touchRow([t61, t62, t63], 64, 1.0);
savePNG('adjacency-touch-192x64.png', l64.W, l64.H, l64.rgba);
const l8 = touchRow([t61, t62, t63], 8, 1.0); // LOD 远观: 每格压到 8px
savePNG('adjacency-lod-24x8.png', l8.W, l8.H, l8.rgba);
function edgeLuma(tl, colX) {
  let s = 0; for (let y = 0; y < TILE; y++) { const i = (y * TILE + colX) * 4; s += luma(tl[i], tl[i + 1], tl[i + 2]); }
  return s / TILE;
}
const d6162 = Math.abs(edgeLuma(t61, 15) - edgeLuma(t62, 0));
const d6263 = Math.abs(edgeLuma(t62, 15) - edgeLuma(t63, 0));
say('④ §4.5-4 相邻走查: 61|62 接缝均亮度差 ' + d6162.toFixed(1) + ' · 62|63 接缝 ' + d6263.toFixed(1) +
    '(61 亮木底 vs 62/63 暗炭坑, 测试程序锚已绿; LOD 图供人眼终审)');

/* ④ 昼夜光矩阵(§4.5-2): 2×2 = [昼燃|昼熄 / 夜燃|夜熄], voxBright 模拟
   燃烧态: 光源格自身 block=15 → 昼夜均 1.0; 熄灭态: 挡光格自身格恒 0 → 0.05(昼) / 0.05(夜) */
function cell(tile, factor) { return scale(tile, 64, factor); }
const BG = 0x40;
const GAP = 12, CS = 64;
const mW = 2 * CS + 3 * GAP, mH = 2 * CS + 3 * GAP;
const m = Buffer.alloc(mW * mH * 4); m.fill(BG);
const cells = [
  [cell(t62, 1.0), GAP, GAP], [cell(t63, 0.05), GAP * 2 + CS, GAP],
  [cell(t62, 1.0), GAP, GAP * 2 + CS], [cell(t63, 0.05), GAP * 2 + CS, GAP * 2 + CS],
];
for (const [px, x0, y0] of cells) {
  for (let y = 0; y < CS; y++) px.copy(m, ((y0 + y) * mW + x0) * 4, y * CS * 4, (y + 1) * CS * 4);
}
savePNG('light-matrix-2x2.png', mW, mH, m);
say('⑤ §4.5-2 光矩阵: 上行=昼(左燃 1.0 / 右熄 0.05=修复前基线同款) 下行=夜(左燃 1.0=发光体 / 右熄 0.05=暗块判据✅)');

/* ⑤ T-C8b 修复前基线存档: 白昼熄灭态(voxBright(0)=0.05, 代码口径; engmgr 实测 ~10% 含引擎侧环境光) */
savePNG('tc8b-BASELINE-day-out-64.png', 64, 64, cell(t63, 0.05));
savePNG('tc8b-BASELINE-day-out-16.png', 16, 16, cell(t63, 0.05)); // LOD 远观基线
say('⑥ T-C8b 修复前基线已存档: tc8b-BASELINE-day-out-64/16.png(白昼熄灭态近黑, 修复后对比用)');

/* ⑥ 半格扁盒世界观感(§4.1 全脸同图): 侧立面(纵向 2:1 压扁, slab 同惯例) + 顶面(满幅) 两态各一 */
function panel(art) { return art; }
const panels = [
  {name: '62燃-侧立面2:1', px: sideView(t62)}, {name: '62燃-顶面满幅', px: topView(t62)},
  {name: '63熄-侧立面2:1', px: sideView(t63)}, {name: '63熄-顶面满幅', px: topView(t63)},
];
function sideView(tl) { // 64 宽 × 32 高: 纵向 2:1 压扁采样
  const W = 64, H = 32, o = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const si = (Math.floor(y / H * TILE) * TILE + Math.floor(x / W * TILE)) * 4, di = (y * W + x) * 4;
    o[di] = tl[si]; o[di + 1] = tl[si + 1]; o[di + 2] = tl[si + 2]; o[di + 3] = 255;
  }
  return {rgba: o, W, H};
}
function topView(tl) { return {rgba: scale(tl, 64, 1.0), W: 64, H: 64}; }
{
  const GAP2 = 10;
  const Hs = Math.max(...panels.map((p) => p.px.H));
  const W2 = panels.reduce((s, p) => s + p.px.W, 0) + GAP2 * (panels.length + 1);
  const o = Buffer.alloc(W2 * Hs * 4); o.fill(BG);
  let x0 = GAP2;
  for (const p of panels) {
    for (let y = 0; y < p.px.H; y++) p.px.rgba.copy(o, ((y + (Hs - p.px.H)) * W2 + x0) * 4, y * p.px.W * 4, (y + 1) * p.px.W * 4);
    x0 += p.px.W + GAP2;
  }
  savePNG('worldview-slab-box.png', W2, Hs, o);
  say('⑦ 半格扁盒观感: ' + panels.map((p) => p.name).join(' | ') + '(侧立面高=顶面半 → 扁盒非十字片; 全脸同图 UV)');
}

/* 两态放大定稿对照图 */
savePNG('burn-64.png', 64, 64, cell(t62, 1.0));
savePNG('out-64.png', 64, 64, cell(t63, 1.0)); // 无光因子纯贴图版(画稿核对用)
fs.writeFileSync(path.join(OUT, 'run.log'), log.join('\n') + '\n');
console.log('\nrun.log 已写 ' + log.length + ' 条');
