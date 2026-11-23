// T-C13 复验 · 真图集管线 §4.4 判据独立复核(design-lead 管线, 一次性)
// 与 v19-review/render.js(画稿直抄静态面)的本质区别: 本脚本从真 paintAll()
// (含 rng 木纹短划/a 散斑/噪声笔触+alpha 位)裁 64~67 四 tile 逐像素点数——
// 验证命题=「施工实现=定稿」在真管线口径下成立。
// 用法: node .scratch/campfire/tc13-review/verify-atlas.js
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

function loadAtlas() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'texture-atlas.js', 'mesh-core.js']) {
    vm.runInContext(read(f), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__t = { TextureAtlas };', ctx);
  return ctx.__t;
}

/* PNG 编码器(tc 系列同款) */
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
const tiles = {};
for (const idx of [61, 62, 63, 64, 65, 66, 67]) tiles[idx] = crop(idx);

/* ---- §4.4 判据(色板逐值 tol=2, 与 tc8 管线同口径) ---- */
const PAL = {
  w: [255, 255, 255], W: [255, 255, 151], f: [255, 216, 0], F: [255, 143, 0],
  e: [224, 90, 26], k: [47, 42, 38], l: [168, 116, 61], L: [138, 90, 43],
  d: [107, 69, 31], C: [35, 26, 18], a: [185, 180, 168],
};
const FLAME4 = [PAL.w, PAL.W, PAL.f, PAL.F];
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const same = (p, i, rgb, tol) => Math.abs(p[i] - rgb[0]) <= tol && Math.abs(p[i + 1] - rgb[1]) <= tol && Math.abs(p[i + 2] - rgb[2]) <= tol;
function countIn(px, pred) {
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (pred(px, i)) n++;
  return n;
}
const isFlame = (px, i) => FLAME4.some((c) => same(px, i, c, 2));
const isWW = (px, i) => same(px, i, PAL.w, 2) || same(px, i, PAL.W, 2);
const isE = (px, i) => same(px, i, PAL.e, 2);
const isA = (px, i) => same(px, i, PAL.a, 2);

const f4 = {64: countIn(tiles[64], isFlame), 65: countIn(tiles[65], isFlame), 66: countIn(tiles[66], isFlame), 67: countIn(tiles[67], isFlame)};
const ww = {64: countIn(tiles[64], isWW), 65: countIn(tiles[65], isWW)};
const ee = {64: countIn(tiles[64], isE), 65: countIn(tiles[65], isE), 66: countIn(tiles[66], isE), 67: countIn(tiles[67], isE)};
const litF4 = f4[64] + f4[65], litWW = ww[64] + ww[65];
say('① §4.4 燃态: 焰四档合计 ' + litF4 + 'px(判据 ≥80; 静态 94; 灶 ' + f4[64] + '+侧 ' + f4[65] + ') ' +
  (litF4 >= 80 ? '✅' : '✗') + ' · 白芯亮黄 ' + litWW + 'px(判据 ≥36; 静态 46) ' + (litWW >= 36 ? '✅' : '✗') +
  ' · 余烬红 灶 ' + ee[64] + '+侧 ' + ee[65] + '(判据 8) ' + (ee[64] === 8 ? '✅' : '✗'));
say('② §4.4 熄态: 焰四档 ' + f4[66] + '+' + f4[67] + '(判据双零) · 余烬红 ' + ee[66] + '+' + ee[67] + '(判据零) ' +
  ((f4[66] + f4[67] + ee[66] + ee[67] === 0) ? '✅' : '✗'));
let maxL = -1, maxC = null, maxTile = 0;
for (const idx of [66, 67]) {
  const px = tiles[idx];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue; // alphaTest 0.5 不可见不参与
    const L = luma(px[i], px[i + 1], px[i + 2]);
    if (L > maxL) { maxL = L; maxC = [px[i], px[i + 1], px[i + 2]]; maxTile = idx; }
  }
}
say('③ §4.4 熄态最高亮度: tile' + maxTile + ' ' + JSON.stringify(maxC) + '(判据=灰烬灰 a [185,180,168]) ' +
  (same(maxC, 0, PAL.a, 2) ? '✅' : '✗'));
/* alpha 计数(与 probe.json 对撞) */
const vis = (px) => countIn(px, (p, i) => p[i + 3] >= 128);
const tra = (px) => countIn(px, (p, i) => p[i + 3] === 0);
say('④ alpha 六格: 62=' + vis(tiles[62]) + '/256 63=' + vis(tiles[63]) + '/256(存档满格) · 64=' + vis(tiles[64]) + '/256 66=' + vis(tiles[66]) + '/256(灶面无镂空) · 65=' + vis(tiles[65]) + '/256 67=' + vis(tiles[67]) + '/256(真透)——与 probe.json 对撞');
say('   alpha=0 真透: 65=' + tra(tiles[65]) + ' 67=' + tra(tiles[67]) + '(画稿点透明位 135/172, 散斑补撒补足可逆差)');

/* ---- §4.5-4 LOD 相邻走查(真管线含噪声): 61|62|63|64|65|66|67 ---- */
function row8(tilesArr, cell) {
  const W = tilesArr.length * cell, H = cell;
  const o = Buffer.alloc(W * H * 4);
  tilesArr.forEach((tl, idx) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < cell; x++) {
      const si = (Math.floor(y / H * TILE) * TILE + Math.floor(x / cell * TILE)) * 4;
      const di = (y * W + idx * cell + x) * 4;
      o[di] = tl[si]; o[di + 1] = tl[si + 1]; o[di + 2] = tl[si + 2]; o[di + 3] = tl[si + 3] < 128 ? 255 : 255;
    }
  });
  return {rgba: o, W, H};
}
const lod = row8([tiles[61], tiles[62], tiles[63], tiles[64], tiles[65], tiles[66], tiles[67]], 8);
savePNG('adjacency-lod-56x8.png', lod.W, lod.H, lod.rgba);
const touch = row8([tiles[61], tiles[62], tiles[63], tiles[64], tiles[65], tiles[66], tiles[67]], 64);
savePNG('adjacency-touch-448x64.png', touch.W, touch.H, touch.rgba);
/* 接缝亮度差(透明像素跳过) */
function edgeLuma(px, colX) {
  let s = 0, n = 0;
  for (let y = 0; y < TILE; y++) {
    const i = (y * TILE + colX) * 4;
    if (px[i + 3] < 128) continue;
    s += luma(px[i], px[i + 1], px[i + 2]); n++;
  }
  return n ? s / n : null;
}
function seam(a, b) {
  const ea = edgeLuma(tiles[a], 15), eb = edgeLuma(tiles[b], 0);
  if (ea === null || eb === null) return 'N/A(透明边)';
  return Math.abs(ea - eb).toFixed(1);
}
say('⑤ §4.5-4 接缝亮度差: 62|63=' + seam(62, 63) + ' · 64|65=' + seam(64, 65) + ' · 66|67=' + seam(66, 67) + ' · 65|66=' + seam(65, 66) + '(LOD 8px/格 图人眼终审; 61 门额牌亮木 vs 暗灶面族)');

/* 真管线四 tile 放大图(含噪声笔触, 与 v1.9 静态成像对照用) */
for (const idx of [64, 65, 66, 67]) {
  const o = Buffer.alloc(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const si = (Math.floor(y / 64 * TILE) * TILE + Math.floor(x / 64 * TILE)) * 4;
    const di = (y * 64 + x) * 4;
    const aPx = tiles[idx][si + 3];
    o[di] = tiles[idx][si]; o[di + 1] = tiles[idx][si + 1]; o[di + 2] = tiles[idx][si + 2];
    o[di + 3] = aPx;
  }
  savePNG('atlas-tile' + idx + '-64.png', 64, 64, o);
}
fs.writeFileSync(path.join(OUT, 'verify-atlas.log'), log.join('\n') + '\n');
console.log('\nverify-atlas.log 已写 ' + log.length + ' 条');
