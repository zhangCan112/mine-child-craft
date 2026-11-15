'use strict';
/* check-s2-tile.js — S2 直译 diff 对照(F1 票第四步 design-lead 补充验收项取证)
   成品 tile(gate-sign-tile.png) vs PAINTERS[T_GATE_SIGN] 输出逐像素 RGBA diff。
   期望: diff=0(pixel-exact)。随票对照装具, 已入库(be9f79a, 同 run-green.js 入库惯例)。
   用法: node .scratch/town-east-boundary/check-s2-tile.js
   日志工具直写 stdout(§7.3 禁 Out-File 管道)。 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const pngPath = path.join(__dirname, 'assets', 'gate-sign', 'gate-sign-tile.png');

/* ---- 1. PAINTERS[T_GATE_SIGN] 输出: vm 装载提取 60 号格 ---- */
const ctx = vm.createContext({console});
for (const f of ['config.js', 'texture-atlas.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, {filename: f});
}
const atlas = vm.runInContext('TextureAtlas.paintAll()', ctx, {filename: 'check'});
const TILE = 16; const COLS = 16;
const c = 60 % COLS; const r = Math.floor(60 / COLS); // idx 行优先: 60 号格
const painterPx = [];
for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
  const o = (((r * TILE + y) * COLS * TILE) + c * TILE + x) * 4;
  painterPx.push(atlas.pixels[o], atlas.pixels[o + 1], atlas.pixels[o + 2], atlas.pixels[o + 3]);
}

/* ---- 2. PNG 解码(16×16 RGBA, bitdepth 8, colortype 6, 单 IDAT 假设) ---- */
const buf = fs.readFileSync(pngPath);
let off = 8; const idat = []; let w = 0; let h = 0; let depth = 0; let ctype = 0;
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.subarray(off + 8, off + 8 + len);
  if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; }
  if (type === 'IDAT') idat.push(data);
  off += 12 + len;
}
if (w !== 16 || h !== 16) throw new Error('尺寸非 16x16: ' + w + 'x' + h);
if (depth !== 8 || ctype !== 6) throw new Error('非 RGBA8: depth=' + depth + ' colortype=' + ctype);
const raw = zlib.inflateSync(Buffer.concat(idat));
const bpp = 4; const stride = w * bpp;
const px = Buffer.alloc(h * stride);
for (let y = 0; y < h; y++) {
  const ft = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
  const cur = px.subarray(y * stride, (y + 1) * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
  };
  for (let i = 0; i < stride; i++) {
    const a = i >= bpp ? cur[i - bpp] : 0;
    const b = prev ? prev[i] : 0;
    const c = prev && i >= bpp ? prev[i - bpp] : 0;
    let v = line[i];
    if (ft === 1) v += a;
    else if (ft === 2) v += b;
    else if (ft === 3) v += (a + b) >> 1;
    else if (ft === 4) v += paeth(a, b, c);
    else if (ft !== 0) throw new Error('未知 filter ' + ft);
    cur[i] = v & 255;
  }
}

/* ---- 3. 逐像素 diff(行优先: PNG y=0 = 缓冲 y=0 行, 同系) ---- */
let diff = 0; const diffAt = [];
for (let i = 0; i < 16 * 16 * 4; i++) {
  if (px[i] !== painterPx[i]) { diff++; if (diffAt.length < 8) diffAt.push('byte#' + i + '(x' + (i / 4 | 0) % 16 + ',y' + ((i / 64) | 0) + ') png=' + px[i] + ' painter=' + painterPx[i]); }
}
console.log('png 16x16 RGBA 解码 OK, filter 处理完毕');
console.log('PAINTERS[60] vs gate-sign-tile.png 逐字节 diff = ' + diff + ' / ' + (16 * 16 * 4));
if (diffAt.length) console.log(diffAt.join('\n'));
console.log(diff === 0 ? 'S2 直译对照: PASS (diff=0, pixel-exact)' : 'S2 直译对照: FAIL');
process.exit(diff === 0 ? 0 : 1);
