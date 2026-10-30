'use strict';
/* 贴图图集 (js/texture-atlas.js) 单测 — node --test (零依赖)
   运行: node --test test/texture-atlas.test.js
   加载器与 mesh-core.test.js 同惯例: config.js + texture-atlas.js
   (+ mesh-core.js, 接线段) 依序共享词法环境。
   被测 seam: TextureAtlas.layout(布局唯一权威, MeshCore opts.atlas 载荷) /
   paintAll(确定性像素纯函数) / tileUV(格→UV 矩形) /
   makeCanvas(doc 桩注入 — mode-kit.test.js 先例)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAtlas() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'texture-atlas.js', 'mesh-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(
      'globalThis.__t = { TextureAtlas, MeshCore, BLOCKS,' +
      ' B_COAL_ORE, B_GRASS_TUFT, B_FURNACE, B_TORCH, B_SAPLING,' +
      ' B_BED, B_BED_FOOT, B_ICE, B_SNOWY_GRASS, B_DEAD_BUSH, B_ORCHID,' +
      ' B_OBSIDIAN, B_GLOWSTONE, B_PORTAL, B_PORTAL_DIM, B_LOOT_CHEST, B_LOOT_CHEST_SMALL };', ctx);
  return ctx.__t;
}

/* 布局条目 → 该方块引用的全部格号(number 简写=全格同图) */
function tileSet(t, id) {
  const e = t.TextureAtlas.layout.tiles[id];
  assert.ok(e, '方块 ' + id + '(' + (t.BLOCKS[id] ? t.BLOCKS[id].name : '?') + ') 应在图集布局中');
  return typeof e === 'number' ? [e] : [e.top, e.side, e.bottom];
}

/* 全部被引用的格号去重 */
function usedTiles(t) {
  const out = new Set();
  for (const id in t.TextureAtlas.layout.tiles) {
    if (!Object.prototype.hasOwnProperty.call(t.TextureAtlas.layout.tiles, id)) continue;
    for (const idx of tileSet(t, id)) out.add(idx);
  }
  return out;
}

/* 从整图像素里抠出某格的 16×16 像素(网格布局: idx 行优先) */
function tilePixels(t, all, idx) {
  const L = t.TextureAtlas.layout; const T = 16;
  const c = idx % L.cols; const r = Math.floor(idx / L.cols);
  const out = [];
  for (let y=0; y<T; y++) {
    for (let x=0; x<T; x++) {
      const o = (((r*T+y)*L.cols*T) + c*T + x) * 4;
      out.push([all.pixels[o], all.pixels[o+1], all.pixels[o+2], all.pixels[o+3]]);
    }
  }
  return out;
}

/* ============ 布局 · 覆盖面 ============ */

test('布局: 新方块 36~62 每个都有格子且格号合法(未入集方块走纯色兜底)', () => {
  const t = loadAtlas();
  const count = t.TextureAtlas.count;
  /* 51=B_CHEST(引导链 v2) · 52=B_WOOL(F4) · 53=B_BED(床观感票: 床顶/床侧两张) ·
   * 54~62=生态地图(冒险模式设计稿 §6) *
   * 不入集例外: 56=B_ICE(glass 透光透渲走纯色通道, 玻璃同款, 票据 T1 红线) */
  for (let id=36; id<=62; id++) {
    if (id === t.B_ICE) {
      assert.ok(!(id in t.TextureAtlas.layout.tiles),
          '方块 ' + id + '(' + t.BLOCKS[id].name + ') 不入图集 — 走纯色兜底通道');
      continue;
    }
    assert.ok(t.BLOCKS[id], 'id ' + id + ' 应在 BLOCKS 注册');
    for (const idx of tileSet(t, id)) {
      assert.ok(Number.isInteger(idx) && idx >= 0 && idx < count,
          '方块 ' + id + '(' + t.BLOCKS[id].name + ') 格号 ' + idx + ' 应在 [0,' + count + ')');
    }
  }
  assert.strictEqual(t.TextureAtlas.count, 52,
      '已绘制格数 = 52(PAINTERS 0~51 连续; 门面宏格已随贴图回退删除, 50/51=战利品宝箱)');
  const snowy = t.TextureAtlas.layout.tiles[t.B_SNOWY_GRASS];
  assert.notStrictEqual(snowy.top, snowy.side, '雪覆草顶(雪白)与侧(雪泥带)应分格');
  const bed = t.TextureAtlas.layout.tiles[t.B_BED];
  assert.notStrictEqual(bed.top, bed.side, '床头顶(枕+毯)与侧(毯沿+木框)应分格(床观感票)');
  const foot = t.TextureAtlas.layout.tiles[t.B_BED_FOOT];
  assert.notStrictEqual(foot.top, bed.top, '床尾顶(全毯)与床头顶(枕+毯)应分格(两格床改版)');
  assert.strictEqual(foot.side, bed.side, '床侧两半共用一张毯木框图');
});

test('布局+像素: 战利品宝箱(71)入集 — 顶/侧分格红金配色, 全不透明(den-nest §7.5 D16)', () => {
  const t = loadAtlas();
  const e = t.TextureAtlas.layout.tiles[t.B_LOOT_CHEST];
  assert.ok(e && typeof e === 'object' && e.top != null && e.side != null,
      '宝箱应分面(top/side)入图集');
  assert.notStrictEqual(e.top, e.side, '顶盖(金边框+扣横条)与侧(金箍带+锁扣)应分格');
  assert.strictEqual(e.bottom, e.side, '底面几乎不可见复用侧格(箱子 51 同款省格)');
  /* 低档奖励箱 72(D18): 单格低档款复用 71 红金同格——映射全同零新增格位 */
  const sm = t.TextureAtlas.layout.tiles[t.B_LOOT_CHEST_SMALL];
  assert.deepStrictEqual(sm, e, '72 与 71 同图集映射(top/side/bottom 全同, count 仍 52)');
  for (const idx of [e.top, e.side]) {
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx < t.TextureAtlas.count,
        '格号 ' + idx + ' 应在 [0,' + t.TextureAtlas.count + ')');
  }
  /* 红金经典配色: 实心立方体全不透明(与 bed 薄块镂空不同族); 侧格中部=锁座金,
     上下箍带金, 箱体红(R 分量显著高于 G/B); 顶格边框金 */
  const all = t.TextureAtlas.paintAll();
  const px = (idx) => tilePixels(t, all, idx);
  for (const idx of [e.top, e.side]) {
    for (const p of px(idx)) assert.strictEqual(p[3], 255, '宝箱像素应全不透明');
  }
  const side = px(e.side);
  const at = (x, y) => side[y * 16 + x];
  assert.ok(at(3, 8)[0] > 120 && at(3, 8)[1] < 100, '箱体红(canvas 行 8 列 3=R 主导)');
  assert.ok(at(3, 1)[0] > 190 && at(3, 1)[1] > 140, '上箍带金(canvas 行 1)');
  assert.ok(at(3, 13)[0] > 190 && at(3, 13)[1] > 140, '下箍带金(canvas 行 13)');
  assert.ok(at(6, 7)[0] > 170 && at(6, 7)[2] < 100, '中央锁座金(canvas 行 7 列 6)');
  assert.ok(at(7, 8)[0] > 240 && at(7, 8)[2] > 120, '锁眼高光(canvas 行 8 列 7)');
  const top = px(e.top);
  assert.ok(top[4 * 16 + 8][0] > 120 && top[4 * 16 + 8][1] < 100, '盖面红(行 4, 金框之外)');
  assert.ok(top[8 * 16 + 3][0] > 170 && top[8 * 16 + 3][2] < 100, '中央扣横条金(行 8 列 3)');
  assert.ok(top[8 * 16 + 0][0] > 190 && top[8 * 16 + 0][1] > 140, '盖沿金边框(canvas 行 0)');
  /* mesh 接线: 标准图集立方体通道(零特殊几何), 两格相邻共面剔除 10 面 */
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_LOOT_CHEST);
  p.set(9, 5, 8, t.B_LOOT_CHEST);
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.solid, null, '入集宝箱走图集通道');
  assert.strictEqual(quads(r.atlas), 10, '双格立方体邻面剔除(6+6-2)');
});

test('布局: 黑巢地上件入集(den-nest §2.1) — 苔石/黑曜石/发光岩各占一格; 门面/熄门回退玻璃通道不入集', () => {
  const t = loadAtlas();
  /* 苔石 14(存量装饰)与下界系 31/34 此前走 faceColor 纯色兜底——
     「黑巢读不出黑」的根因; 入集后黑巢丘体与门框贴图(巢穴观感票) */
  const ids = [14, t.B_OBSIDIAN, t.B_GLOWSTONE];
  const seen = new Set();
  for (const id of ids) {
    for (const idx of tileSet(t, id)) {
      assert.ok(Number.isInteger(idx) && idx >= 0 && idx < t.TextureAtlas.count,
          '方块 ' + id + '(' + t.BLOCKS[id].name + ') 格号合法');
      assert.ok(!seen.has(idx), '黑巢件格号不串格: ' + id);
      seen.add(idx);
    }
  }
  assert.strictEqual(seen.size, 3, '三件各占一格(不共图)');
  /* 门面/熄门不入集(贴图三试三否, 2026-10-30 拍板回退): glass 旗标走玻璃
     通道平紫半透明(贴图前观感, 2 格门/3 格门天然均匀)——回退守门断言 */
  assert.ok(!(t.B_PORTAL in t.TextureAtlas.layout.tiles), '门面不入图集');
  assert.ok(!(t.B_PORTAL_DIM in t.TextureAtlas.layout.tiles), '熄门不入图集');
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_PORTAL);
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.atlas, null, '门面走玻璃纯色通道');
  assert.strictEqual(quads(r.glass), 6, '门面 6 面玻璃渲染(平紫半透明)');
});

test('像素: 黑巢件不透明口径 — 苔石/黑曜石/发光岩全不透明(门面已回退玻璃通道不入集)', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const L = t.TextureAtlas.layout;
  for (const id of [14, t.B_OBSIDIAN, t.B_GLOWSTONE]) {
    const px = tilePixels(t, all, L.tiles[id]);
    for (let i=0; i<px.length; i++) {
      assert.strictEqual(px[i][3], 255,
          '方块 ' + id + '(' + t.BLOCKS[id].name + ') 像素 ' + i + ' 应全不透明');
    }
  }
  /* 门面/熄门不再有图集格(贴图回退): glass 通道纯色渲染, 无像素断言可写 */
  const obs = tilePixels(t, all, L.tiles[t.B_OBSIDIAN]);
  assert.ok(obs[8 * 16 + 8][2] > obs[8 * 16 + 8][0], '黑曜石蓝紫分量高于红(黑里透紫)');
});

test('布局: 存量升级款 1~8 入集; 草地与木头 top≠side(草顶/草侧 · 年轮/树皮分格)', () => {
  const t = loadAtlas();
  for (let id=1; id<=8; id++) tileSet(t, id); // 逐个断言在集
  const grass = t.TextureAtlas.layout.tiles[1];
  const log = t.TextureAtlas.layout.tiles[5];
  assert.notStrictEqual(grass.top, grass.side, '草地顶(绿斑)与侧(草沿泥壁)应分格');
  assert.notStrictEqual(log.top, log.side, '木头顶(年轮)与侧(树皮)应分格');
});

test('布局: 图集画布为正方形 2 的幂 — WebGL1 mipmap 约束(TNT 图集同款)', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  assert.strictEqual(all.w, all.h);
  assert.strictEqual(all.w & (all.w - 1), 0, all.w + ' 应为 2 的幂');
  assert.strictEqual(all.pixels.length, all.w * all.h * 4);
});

/* ============ UV · 不越界不重叠 ============ */

test('UV: 每个被引用的格 tileUV 落在 [0,1] 且两两不重叠', () => {
  const t = loadAtlas();
  const L = t.TextureAtlas.layout;
  const rects = new Map();
  for (const idx of usedTiles(t)) {
    const r = t.TextureAtlas.tileUV(idx);
    const [u0, v0, u1, v1] = r;
    assert.ok(u0 >= 0 && v0 >= 0 && u1 <= 1 && v1 <= 1 && u0 < u1 && v0 < v1,
        '格 ' + idx + ' 矩形应落在 [0,1]: ' + r);
    assert.ok(Math.abs((u1-u0) - 1/L.cols) < 1e-12 && Math.abs((v1-v0) - 1/L.rows) < 1e-12,
        '格 ' + idx + ' 应恰占一格(宽 1/cols 高 1/rows)');
    rects.set(idx, r);
  }
  for (const [a, ra] of rects) {
    for (const [b, rb] of rects) {
      if (a >= b) continue;
      const sep = ra[2] <= rb[0] || rb[2] <= ra[0] || ra[3] <= rb[1] || rb[3] <= ra[1];
      assert.ok(sep, '格 ' + a + ' 与 ' + b + ' 不应重叠');
    }
  }
});

/* ============ 确定性 · 逐像素一致 ============ */

test('确定性: 两次生成逐像素一致(噪点/斑点用种子化伪随机, 同 seed 同图)', () => {
  const t = loadAtlas();
  const a = t.TextureAtlas.paintAll();
  const b = t.TextureAtlas.paintAll();
  assert.strictEqual(a.pixels.length, b.pixels.length);
  for (let i=0; i<a.pixels.length; i++) {
    assert.strictEqual(a.pixels[i], b.pixels[i], '偏移 ' + i + ' 应逐像素一致');
  }
});

test('像素: 每个被引用格至少有一个非透明像素; 植物类有透明像素(alpha 裁切前提)', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const alphaStats = (idx)=>{
    let opaque = 0; let hole = 0;
    for (const p of tilePixels(t, all, idx)) {
      if (p[3] === 255) opaque++; else if (p[3] === 0) hole++;
    }
    return {opaque, hole};
  };
  for (const idx of usedTiles(t)) {
    const s = alphaStats(idx);
    assert.ok(s.opaque > 0, '格 ' + idx + ' 不该全透明(手滑空格子)');
  }
  /* 十字面片方块(草丛/火把/树苗/枯灌木/三花)与树叶孔洞: 贴图带 alpha=0 区域,
     alphaTest 裁切后才呈"镂空植物"观感 — 全不透明即退化成实心纸片 */
  for (const id of [t.B_GRASS_TUFT, t.B_TORCH, t.B_SAPLING, 7,
    t.B_DEAD_BUSH, t.B_ORCHID]) {
    const idx = tileSet(t, id)[0];
    assert.ok(alphaStats(idx).hole > 0, '方块 ' + id + ' 的贴图应有透明像素');
  }
});

/* ============ meshChunk 接线 · 图集通道(第 4 通道, TNT 贴图通道同款思路) ============ */
/* pack 构造与 mesh-core.test.js 同构: 16×16 内部 + 边界圈, hashRand 固定 */
function mkPack(border) {
  const w = 16 + 2*border; const d = 16 + 2*border;
  return {
    cells: new Uint8Array(w*d*48), w, d, h: 48, border,
    bx: 100 - border, bz: 100 - border, yMax: 0,
    set(lx, y, lz, id) {
      this.cells[(y*this.d + lz)*this.w + lx] = id;
      if (id !== 0 && y > this.yMax) this.yMax = y;
    },
  };
}
const HR = ()=>0.5;
const atlasOpt = (t)=>({hashRand: HR, tntTiles: 4, atlas: t.TextureAtlas.layout});
const quads = (ch) => ch ? ch.indices.length/6 : 0;

test('meshChunk: 图集方块走 atlas 通道 — 煤矿立方体 6 面, UV 全落在煤矿格内', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_COAL_ORE);
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.solid, null, '入集方块不再走纯色通道');
  assert.strictEqual(r.tnt, null);
  assert.strictEqual(quads(r.atlas), 6);
  const rect = t.TextureAtlas.tileUV(t.TextureAtlas.layout.tiles[t.B_COAL_ORE]);
  for (let i=0; i<r.atlas.uvs.length; i+=2) {
    const u = r.atlas.uvs[i]; const v = r.atlas.uvs[i+1];
    assert.ok(u >= rect[0]-1e-12 && u <= rect[2]+1e-12 && v >= rect[1]-1e-12 && v <= rect[3]+1e-12,
        'UV(' + u + ',' + v + ') 应落在煤矿格 ' + rect);
  }
});

test('meshChunk: 顶/侧/底分格 — 草地三面各归各格(草顶/草侧/泥土底)', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, 1); // 草地
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(quads(r.atlas), 6);
  const e = t.TextureAtlas.layout.tiles[1];
  const inRect = (rect, uvs)=>uvs.every((q, i)=> i%2===0 ?
    q >= rect[0]-1e-12 && q <= rect[2]+1e-12 :
    q >= rect[1]-1e-12 && q <= rect[3]+1e-12);
  for (let q=0; q<r.atlas.indices.length; q+=6) {
    const ny = r.atlas.normals[r.atlas.indices[q]*3+1];
    const uvs = [];
    for (let c=0; c<4; c++) {
      const vi = r.atlas.indices[q+c];
      uvs.push(r.atlas.uvs[vi*2], r.atlas.uvs[vi*2+1]);
    }
    if (ny === 1) assert.ok(inRect(t.TextureAtlas.tileUV(e.top), uvs), '顶面应落草顶格');
    else if (ny === -1) assert.ok(inRect(t.TextureAtlas.tileUV(e.bottom), uvs), '底面应落泥土格');
    else assert.ok(inRect(t.TextureAtlas.tileUV(e.side), uvs), '侧面应落草侧格');
  }
});

test('meshChunk: opts 不带 atlas → 入集方块回落纯色通道(存量调用方零侵入)', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_COAL_ORE);
  const r = t.MeshCore.meshChunk(p, {hashRand: HR, tntTiles: 4});
  assert.strictEqual(r.atlas, null);
  assert.strictEqual(quads(r.solid), 6, '无图集载荷时行为与存量一致');
});

test('meshChunk: 薄块图集走十字面片 — 草丛 2 面×正反共 4 面, 几何全高(UV 全落格)', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_GRASS_TUFT); // thin 0.35 的草丛
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.solid, null, '图集薄块不再走实心通道的扁盒子');
  assert.strictEqual(quads(r.atlas), 4, '两个对角面各正反两绘(FrontSide 材质双面可见)');
  const ys = new Set();
  for (let i=1; i<r.atlas.positions.length; i+=3) ys.add(r.atlas.positions[i]);
  assert.ok(ys.has(5) && ys.has(6) && ys.size === 2, '面片占满格高, 视觉高度由贴图 alpha 裁切: ' + [...ys]);
  const rect = t.TextureAtlas.tileUV(t.TextureAtlas.layout.tiles[t.B_GRASS_TUFT]);
  for (let i=0; i<r.atlas.uvs.length; i+=2) {
    const u = r.atlas.uvs[i]; const v = r.atlas.uvs[i+1];
    assert.ok(u >= rect[0]-1e-12 && u <= rect[2]+1e-12 && v >= rect[1]-1e-12 && v <= rect[3]+1e-12,
        'UV(' + u + ',' + v + ') 应落在草丛格 ' + rect);
  }
});

test('meshChunk: 生态地图薄块(兰花)同走十字面片 — 4 面 UV 全落兰花格', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_ORCHID); // thin 0.65 的兰花
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.solid, null, '新薄块与草丛同通道');
  assert.strictEqual(quads(r.atlas), 4);
  const rect = t.TextureAtlas.tileUV(t.TextureAtlas.layout.tiles[t.B_ORCHID]);
  for (let i=0; i<r.atlas.uvs.length; i+=2) {
    const u = r.atlas.uvs[i]; const v = r.atlas.uvs[i+1];
    assert.ok(u >= rect[0]-1e-12 && u <= rect[2]+1e-12 && v >= rect[1]-1e-12 && v <= rect[3]+1e-12,
        'UV(' + u + ',' + v + ') 应落在兰花格 ' + rect);
  }
});

test('meshChunk: 床(bed 旗标)走薄块扁盒图集通道 — 5 面盒(无底面), 高度 0.55, 顶/侧分格', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_BED);
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.solid, null, '入集床不再走实心通道的纯色扁盒(床观感票)');
  assert.strictEqual(quads(r.atlas), 5, '扁盒跳底面(pushThin 同款): 顶 1 + 侧 4');
  const ys = new Set();
  for (let i=1; i<r.atlas.positions.length; i+=3) ys.add(r.atlas.positions[i]);
  assert.ok(ys.has(5) && ys.has(5.55) && ys.size === 2, '扁盒高度=thin 0.55, 实际 ' + [...ys]);
  const e = t.TextureAtlas.layout.tiles[t.B_BED];
  const topRect = t.TextureAtlas.tileUV(e.top);
  const sideRect = t.TextureAtlas.tileUV(e.side);
  for (let q=0; q<r.atlas.indices.length; q+=6) {
    const ny = r.atlas.normals[r.atlas.indices[q]*3+1];
    for (let c=0; c<4; c++) {
      const vi = r.atlas.indices[q+c];
      const u = r.atlas.uvs[vi*2]; const v = r.atlas.uvs[vi*2+1];
      if (ny === 1) {
        assert.ok(u >= topRect[0]-1e-12 && u <= topRect[2]+1e-12 &&
            v >= topRect[1]-1e-12 && v <= topRect[3]+1e-12, '顶面应落床顶格(枕+毯)');
      } else {
        assert.ok(u >= sideRect[0]-1e-12 && u <= sideRect[2]+1e-12, '侧面 u 应落床侧格');
        /* 比例窗: 侧面只采 tile 顶部 h=0.55 段(v ∈ [v0+0.45dv, v0+dv], MC 床侧
           [0,0,16,9] 比例窗同口径) — 断言既不越格也不采到 tile 下半木框段 */
        assert.ok(v >= sideRect[1] + 0.44/16 - 1e-12 && v <= sideRect[3] + 1e-12,
            '侧面 v 应采格顶 0.55 段, 实际 ' + v + ' 窗底 ' + (sideRect[1] + 0.45/16));
      }
    }
  }
});

test('meshChunk: 床头枕向按床尾方位旋转 — 床尾在东则枕贴西缘(取向不存档, 世界状态派生)', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_BED); /* 床头 */
  p.set(9, 5, 8, t.B_BED_FOOT); /* 床尾在东 → 枕应朝西(rot3) */
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  const e = t.TextureAtlas.layout.tiles[t.B_BED];
  const rect = t.TextureAtlas.tileUV(e.top);
  for (let q=0; q<r.atlas.indices.length; q+=6) {
    if (r.atlas.normals[r.atlas.indices[q]*3+1] !== 1) continue; /* 只看顶面 */
    const u0 = r.atlas.uvs[r.atlas.indices[q]*2];
    if (u0 < rect[0] - 1e-9 || u0 > rect[2] + 1e-9) continue; /* 床尾顶面(另一张格)跳过, 只量床头顶 */
    for (let c=0; c<4; c++) {
      const vi = r.atlas.indices[q+c];
      const vx = r.atlas.positions[vi*3] - p.bx; /* 局部 lx(世界坐标含 bx=99 偏移) */
      const tileV = (r.atlas.uvs[vi*2+1] - rect[1]) * 16; /* tile 内 v: 枕带=行0-3 → v∈[12/16,1] */
      if (vx < 8.5) { // 西缘角点(cor0=0): rot3 采样 emitted v = 1 − faceUVu = 1 → 枕带
        assert.ok(tileV >= 12/16 - 1e-9, '西缘应采枕带(枕背对东床尾), 实际 ' + tileV);
      } else { // 东缘角点(cor0=1): emitted v = 0 → 毯身
        assert.ok(tileV <= 4/16 + 1e-9, '东缘应采毯身(朝床尾), 实际 ' + tileV);
      }
    }
  }
});

test('meshChunk: 床无图集注入回落实心通道纯色扁盒(存量行为零变化)', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_BED);
  const r = t.MeshCore.meshChunk(p, {hashRand: HR, tntTiles: 4});
  assert.strictEqual(r.atlas, null);
  assert.strictEqual(quads(r.solid), 5, 'pushThin 扁盒跳底面: 顶 1 + 侧 4(存量口径)');
});

test('床贴图像素(床观感票): 床顶白枕在 canvas 顶行(=世界 −Z 北端)+毯身红; 床侧上毯下木框', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const L = t.TextureAtlas.layout;
  const at = (px, x, y) => px[y * 16 + x];
  const top = tilePixels(t, all, L.tiles[t.B_BED].top);
  assert.strictEqual(at(top, 8, 1)[3], 255, '枕身像素不透明');
  assert.ok(at(top, 8, 1)[0] > 240 && at(top, 8, 1)[1] > 240, '枕身近白(canvas 行 0-2=北端)');
  assert.ok(at(top, 8, 10)[0] > 190 && at(top, 8, 10)[1] < 120, '毯身红(canvas 行 6-14)');
  const side = tilePixels(t, all, L.tiles[t.B_BED].side);
  assert.ok(at(side, 8, 1)[0] > 190 && at(side, 8, 1)[1] < 120, '侧上段毯沿红(几何采窗可见段)');
  assert.ok(at(side, 8, 6)[0] > 140 && at(side, 8, 6)[2] < 110, '侧下段木框棕(几何采窗可见段)');
});

test('meshChunk: 图集立方体邻面剔除同实心规则 — 相邻两煤矿共界面剔成 10 面', () => {
  const t = loadAtlas();
  const p = mkPack(1);
  p.set(8, 5, 8, t.B_COAL_ORE); p.set(9, 5, 8, t.B_COAL_ORE);
  assert.strictEqual(quads(t.MeshCore.meshChunk(p, atlasOpt(t)).atlas), 10);
});

/* ============ 画布壳 · doc 桩注入 ============ */

test('makeCanvas: doc 桩注入 — 尺寸按图集, putImageData 像素与 paintAll 一致', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  let captured = null; let created = 0;
  const ctxStub = {
    createImageData: (w, h)=>({width: w, height: h, data: new Uint8ClampedArray(w*h*4)}),
    putImageData: (img, x, y)=>{
      captured = {img, x, y};
    },
  };
  const canvasStub = {width: 0, height: 0, getContext: ()=>ctxStub};
  const docStub = {createElement: ()=>{
    created++; return canvasStub;
  }};
  const c = t.TextureAtlas.makeCanvas(docStub);
  assert.strictEqual(created, 1, '只创建一次画布');
  assert.strictEqual(c, canvasStub);
  assert.strictEqual(canvasStub.width, all.w);
  assert.strictEqual(canvasStub.height, all.h);
  assert.ok(captured, '应 putImageData 一次');
  for (let i=0; i<all.pixels.length; i++) {
    assert.strictEqual(captured.img.data[i], all.pixels[i], '画布像素应与 paintAll 一致(偏移 ' + i + ')');
  }
});
