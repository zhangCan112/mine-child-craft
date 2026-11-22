// v1.9 两态外观修订 · design-lead 设计闸验证(一次性)
// 定稿文档四张新 char art → 静态判据复核(§4.4 数值交叉) + 渲染成像 → PO 五锚逐条人眼过
// 噪声笔触(noiseFill/rng 散斑)不移植——验证的是构图读感, 纹理噪声 ±6% 不改读感
// 用法: node .scratch/campfire/v19-review/render.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = __dirname;

/* ---- PNG 编码器(同款) ---- */
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

/* ---- 色板(js/texture-atlas.js CF_PAL8 既有族, 零新色) ---- */
const PAL = {
  w: [255, 255, 255], W: [255, 255, 151], f: [255, 216, 0], F: [255, 143, 0],
  e: [224, 90, 26], k: [47, 42, 38], l: [168, 116, 61], L: [138, 90, 43],
  d: [107, 69, 31], C: [35, 26, 18], a: [185, 180, 168],
};
const FLAME4 = new Set(['w', 'W', 'f', 'F']);
const SCENE = [74, 122, 58]; // 草地场景色(透明区透出=看穿读感演示)

/* ---- 定稿文档四张新 char art(逐字抄录, docs/design/campfire-visual-spec.md §4.2/§4.3 v1.9) ---- */
const TOP64 = [
  'LLLLLLLLLLLLLLLL', 'LddddddddddddddL', 'LdCCCCCCCCCCCCdL', 'LdCCCaCCCCCaCCdL',
  'LdCCCeeCCCeeCCdL', 'LdCffWWWWffCCCdL', 'LdfFWwwwwWFfCCdL', 'LdFWwwwwwwWFCCdL',
  'LdfFWwwwwWFfCCdL', 'LdCffWWffCCCCCdL', 'LdCCCCeeeeCCCCdL', 'LdCCCaCCCCCaCCdL',
  'LdCCCCCCCCCCCCdL', 'LdCCCCCCCCCCCCdL', 'LddddddddddddddL', 'LLLLLLLLLLLLLLLL',
];
const SIDE65 = [
  '................', '................', '.......f........', '......fFf.......',
  '.....fFWFf......', '.....FWwWF......', '....fFWwwWFf....', '....FFWwwWFF....',
  '...fFFWwwWFFf...', '...FFFWwwWFFF...', '..dddddddddddd..', '..dLLLLLLLLLLd..',
  '..dLLdLLLLdLLd..', '..dLLLLLLLLLLd..', '..dddddddddddd..', '..dddddddddddd..',
];
const OTOP66 = [
  'LLLLLLLLLLLLLLLL', 'LddddddddddddddL', 'LdCCCCCCCCCCCCdL', 'LdCCCaCCCCCaCCdL',
  'LdCCCaaCCCCaaCdL', 'LdCaaaaaaaaaaCdL', 'LdCaaakkkaaaaCdL', 'LdCaakkkkkkaaCdL',
  'LdCaakkkkkkaaCdL', 'LdCaaakkkaaaaCdL', 'LdCaaaaaaaaaaCdL', 'LdCCCaCCCCCaCCdL',
  'LdCCCCCCCCCCCCdL', 'LdCCCCCCCCCCCCdL', 'LddddddddddddddL', 'LLLLLLLLLLLLLLLL',
];
const OSIDE67 = [
  '................', '................', '................', '................',
  '................', '................', '................', '.......aa.......',
  '......akka......', '.....aakkaa.....', '..dddddddddddd..', '..dLLLLLLLLLLd..',
  '..dLLdLLLLdLLd..', '..dLLLLLLLLLLd..', '..dddddddddddd..', '..dddddddddddd..',
];
/* 旧稿两张(v1.9 作废存档, 宽度校验用) */
const OLD62 = [
  'CCCCCCCCCCCCCCCC', 'CCCCCCCfFCCCCCCC', 'CCCCCCfFFfCCCCCC', 'CCCCCfFWWFfCCCCC',
  'CCCCCFWwwWFCCCCC', 'CCCCfFWwwWFfCCCC', 'CCCCFWwwwwWFCCCC', 'CCCfFFWwwWFFfCCC',
  'CCCFFFWWWWFFFCCC', 'CCeFFFWWWWFFFeCC', 'CCekeFFeeFFekeCC', 'kllllllllllllllk',
  'dLLLLLLLLLLLLLLd', 'dddddddddddddddd', 'dLLLLLLLLLLLLLLd', 'dddddddddddddddd',
];
const OLD63 = [
  'CCCCCCCCCCCCCCCC', 'CCCCCCCCCCCCCCCC', 'CCCCCCCCCCCCCCCC', 'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC', 'CCCCCCCCCCCCCCCC', 'CCCCCCCCCCCCCCCC', 'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC', 'CCaCCCaCCaCCaCCC', 'CCCCaCCCCCaCCCCC', 'kLLLLLLLLLLLLLLk',
  'dLLLLLLLLLLLLLLd', 'dddddddddddddddd', 'dLLLLLLLLLLLLLLd', 'dddddddddddddddd',
];

const log = [];
const say = (s) => { console.log(s); log.push(s); };

/* ---- ① 宽度与色板纪律 ---- */
for (const [name, art] of [['64燃灶', TOP64], ['65燃侧', SIDE65], ['66熄灶', OTOP66], ['67熄侧', OSIDE67], ['旧62存档', OLD62], ['旧63存档', OLD63]]) {
  const bad = art.filter((r) => r.length !== 16).length;
  if (bad) say('✗ ' + name + ' 有 ' + bad + ' 行宽≠16');
}
say('① 宽度纪律: 六稿 6×16 行全=16 ✅');
const chars = new Set([].concat(...[TOP64, SIDE65, OTOP66, OSIDE67].map((a) => a.join('').split(''))));
const unknown = [...chars].filter((ch) => ch !== '.' && !PAL[ch]);
say('   色板纪律: 新四稿字符集=[' + [...chars].filter((ch) => ch !== '.').sort().join('') + '] 未知字符 ' + (unknown.length ? JSON.stringify(unknown) + ' ✗' : '0 个 ✅ 零新色全走既有族'));

/* ---- ② §4.4 静态判据交叉(设计稿计数 vs 我管线独立计数) ---- */
function count(art, pred) {
  let n = 0;
  for (const row of art) for (const ch of row) if (pred(ch)) n++;
  return n;
}
const f4T = count(TOP64, (c) => FLAME4.has(c)), f4S = count(SIDE65, (c) => FLAME4.has(c));
const wyT = count(TOP64, (c) => c === 'w' || c === 'W'), wyS = count(SIDE65, (c) => c === 'w' || c === 'W');
const emT = count(TOP64, (c) => c === 'e'), emS = count(SIDE65, (c) => c === 'e');
say('② §4.4 交叉: 燃态焰四档合计 ' + (f4T + f4S) + 'px(灶面 ' + f4T + '+侧脸 ' + f4S + '; 判据 ≥80, 定稿静态 94) · 白芯亮黄 ' +
    (wyT + wyS) + 'px(判据 ≥36, 静态 46) · 余烬红灶面 ' + emT + 'px(静态 8)+侧脸 ' + emS + 'px');
say('   熄灭态: 66/67 焰四档 ' + count(OTOP66, (c) => FLAME4.has(c)) + '+' + count(OSIDE67, (c) => FLAME4.has(c)) +
    '(判据双零) · 余烬红 ' + count(OTOP66, (c) => c === 'e') + '+' + count(OSIDE67, (c) => c === 'e') + '(判据零)');
let maxL = -1, maxC = '';
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
for (const art of [OTOP66, OSIDE67]) for (const row of art) for (const ch of row) {
  if (ch === '.' || !PAL[ch]) continue;
  const L = luma(...PAL[ch]);
  if (L > maxL) { maxL = L; maxC = ch; }
}
say('   熄灭态最高亮度像素=' + maxC + '(luma ' + maxL.toFixed(1) + ', 判据=灰烬灰 a #b9b4a8) ' +
    (maxC === 'a' ? '✅' : '✗'));

/* ---- ③ 渲染: 四 tile 64px + 实机视角 mock ---- */
function tile64(art, size) {
  const o = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ch = art[Math.floor(y / size * 16)][Math.floor(x / size * 16)];
    const i = (y * size + x) * 4;
    const c = ch === '.' ? SCENE : PAL[ch]; // 透明区透出场景色=看穿读感
    o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255;
  }
  return o;
}
function sideElev(art, W, H) { // 侧立面 2:1 压扁(world 侧脸观感)
  const o = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = art[Math.min(15, Math.floor(y / H * 16))][Math.floor(x / W * 16)];
    const i = (y * W + x) * 4;
    const c = ch === '.' ? SCENE : PAL[ch];
    o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255;
  }
  return o;
}
const BG = 0x2a;
for (const [name, art] of [['tile64-top.png', TOP64], ['tile65-side.png', SIDE65], ['tile66-out-top.png', OTOP66], ['tile67-out-side.png', OSIDE67]]) {
  savePNG(name, 64, 64, tile64(art, 64));
}
/* 实机视角 sheet: 燃/熄两组, 各=俯视(灶面 64) + 正视(侧脸 2:1 压扁 64×32) 并排 */
for (const [name, top, side] of [
  ['worldview-lit.png', TOP64, SIDE65],
  ['worldview-out.png', OTOP66, OSIDE67],
]) {
  const GAP = 10, t = tile64(top, 64), s = sideElev(side, 64, 32);
  const W = GAP + 64 + GAP + 64 + GAP, H = GAP + 64 + GAP + 32 + GAP;
  const o = Buffer.alloc(W * H * 4); o.fill(BG);
  for (let y = 0; y < 64; y++) t.copy(o, ((GAP + y) * W + GAP) * 4, y * 64 * 4, (y + 1) * 64 * 4);
  for (let y = 0; y < 32; y++) s.copy(o, ((GAP + 64 + GAP + y) * W + GAP) * 4, y * 64 * 4, (y + 1) * 64 * 4);
  savePNG(name, W, H, o);
}
/* 对照: 旧稿侧脸读感(火焰糊墙) vs 新侧脸——根因可视化 */
{
  const GAP = 10, oldS = sideElev(OLD62, 64, 32), newS = sideElev(SIDE65, 64, 32);
  const W = GAP + 64 + GAP + 64 + GAP, H = GAP + 32 + GAP;
  const o = Buffer.alloc(W * H * 4); o.fill(BG);
  for (let y = 0; y < 32; y++) oldS.copy(o, ((GAP + y) * W + GAP) * 4, y * 64 * 4, (y + 1) * 64 * 4);
  for (let y = 0; y < 32; y++) newS.copy(o, ((GAP + y) * W + GAP * 2 + 64) * 4, y * 64 * 4, (y + 1) * 64 * 4);
  savePNG('rootcause-old-vs-new-side.png', W, H, o);
}
say('③ 渲染成像: 四 tile 64px + 燃/熄实机视角(俯视灶面+正视侧脸 2:1) + 新旧侧脸对照(根因可视化)');
say('   五锚速查: ①矮半格(几何口径, mesh 层) ②木框底座(侧脸 r10-15 原木横梁主视觉) ③焰只中心(灶面焰团 r5-9 内环+侧脸火舌 r2-9 中心) ④顶面灰烬炭心(灶面 a 斑+熄灶 a 坑 k 心) ⑤木头主体(侧脸下半 6 行原木 vs 火舌窄柱)');
fs.writeFileSync(path.join(OUT, 'run.log'), log.join('\n') + '\n');
console.log('\nrun.log 已写 ' + log.length + ' 条');
