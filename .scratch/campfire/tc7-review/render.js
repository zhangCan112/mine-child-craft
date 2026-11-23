// T-C7 视觉验收 · 观感亲验渲染脚本（design-lead 把关用, 一次性）
// 从 js/icons.js vm 装载定稿数据面, 真渲染 PNG 供人眼终审
// 用法: node .scratch/campfire/tc7-review/render.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');

/* ---- 装载(照抄 test/icons-item.test.js loadIcons 惯例) ---- */
function stubCtx() {
  const noop = () => {};
  return new Proxy({}, {get: (t, k) => (k === 'canvas' ? {width: 0, height: 0} : noop)});
}
function loadIcons() {
  const fakeDoc = {
    createElement() {
      return {width: 0, height: 0, getContext() { return stubCtx(); }, toDataURL() { return 'data:image/png,'; }};
    },
    querySelector() { return null; },
  };
  const ctx = vm.createContext({console, document: fakeDoc});
  vm.runInContext(read('items-core.js'), ctx, {filename: 'items-core.js'});
  vm.runInContext(read('icons.js'), ctx, {filename: 'icons.js'});
  vm.runInContext('globalThis.__i = {ITEM_PIX, ITEMS};', ctx);
  return ctx.__i;
}

/* ---- 最小 PNG 编码器(RGBA8, filter 0) ---- */
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

/* ---- hex → [r,g,b] ---- */
function hex2rgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/* ---- 字符画 → RGBA 像素(16×16, nearest 任意倍率, 底色 bg) ---- */
function renderIcon(art, map, outW, outH, bg) {
  const rgba = Buffer.alloc(outW * outH * 4);
  const [br, bgc, bb] = hex2rgb(bg);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const sx = Math.min(15, Math.floor(x / outW * 16));
      const sy = Math.min(15, Math.floor(y / outH * 16));
      const ch = art[sy][sx];
      const i = (y * outW + x) * 4;
      if (ch === '.' || !map[ch]) {
        rgba[i] = br; rgba[i + 1] = bgc; rgba[i + 2] = bb; rgba[i + 3] = 255;
      } else {
        const [r, g, b] = hex2rgb(map[ch]);
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}
function savePNG(name, w, h, rgba) {
  fs.writeFileSync(path.join(OUT, name), encodePNG(w, h, rgba));
  console.log('written: ' + name + ' (' + w + 'x' + h + ')');
}

/* ---- 并排拼接(各 outSize, gap 间隔, 同底色) ---- */
function lineup(icons, outSize, gap, bg) {
  const n = icons.length;
  const W = n * outSize + (n + 1) * gap;
  const rgba = Buffer.alloc(W * outSize * 4);
  const [br, bgc, bb] = hex2rgb(bg);
  for (let i = 0; i < W * outSize; i++) { rgba[i * 4] = br; rgba[i * 4 + 1] = bgc; rgba[i * 4 + 2] = bb; rgba[i * 4 + 3] = 255; }
  icons.forEach((ic, idx) => {
    const pix = renderIcon(ic.art, ic.map, outSize, outSize, bg);
    const x0 = gap + idx * (outSize + gap);
    for (let y = 0; y < outSize; y++) {
      pix.copy(rgba, (y * W + x0) * 4, y * outSize * 4, (y + 1) * outSize * 4);
    }
  });
  return {rgba, W, H: outSize};
}

/* ---- 主流程 ---- */
const {ITEM_PIX} = loadIcons();
const DARK = '#141414'; // 配方卡/快捷栏暗底观感(黑底 30% 家族取更暗代表值)
const checks = [];
const cf = ITEM_PIX.campfire;
if (!cf) { console.error('FAIL: ITEM_PIX.campfire 未登记'); process.exit(1); }

// 渲染自检: 未映射字符守门(定稿九字符+. 之外不许出现)
const legal = new Set(['.', ...Object.keys(cf.map)]);
for (const row of cf.art) for (const ch of row) {
  if (!legal.has(ch)) checks.push('未映射字符: ' + JSON.stringify(ch));
}
console.log('字符守门: ' + (checks.length ? checks.join('; ') : '全部字符在九色+.映射内 ✅'));

// ① 64px 放大(§3.6-1 3 秒可读判据主证据)
savePNG('campfire-64.png', 64, 64, renderIcon(cf.art, cf.map, 64, 64, DARK));
// ② 40px 快捷栏级(§3.6-2 判据主证据, 2.5x 非整数倍=真实渲染条件)
savePNG('campfire-40.png', 40, 40, renderIcon(cf.art, cf.map, 40, 40, DARK));
// ③ 16px 原生极限
savePNG('campfire-16.png', 16, 16, renderIcon(cf.art, cf.map, 16, 16, DARK));
// ④ 密度协调并排(§3.6-4): campfire/glider/sword_iron/pick_iron/apple/torch 六格 64px
const names = ['campfire', 'glider', 'sword_iron', 'pick_iron', 'apple', 'torch'];
const icons = names.map((k) => {
  const d = ITEM_PIX[k];
  if (!d) { console.error('FAIL: ' + k + ' 未登记'); process.exit(1); }
  return d;
});
const lu = lineup(icons, 64, 12, DARK);
savePNG('lineup-64.png', lu.W, lu.H, lu.rgba);
console.log('并排顺序: ' + names.join(' → '));
