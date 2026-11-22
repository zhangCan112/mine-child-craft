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
      ' B_OBSIDIAN, B_GLOWSTONE, B_PORTAL, B_PORTAL_DIM, B_LOOT_CHEST, B_LOOT_CHEST_SMALL,' +
      ' B_ANCIENT_DEBRIS, B_SNOWY_LEAVES, B_ROOF_TILE, B_GATE_SIGN,' +
       ' B_CAMPFIRE, B_CAMPFIRE_OUT };', ctx);
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
   * 56=B_ICE 原钉「不入集走纯色兜底」(票据 T1 零新贴图红线)——2026-11-07 G3
   * 走查拍板反转入集画冰裂纹(原 glass 纯色半透在雪原读作「脏渍」; 73/74 先例
   * 第二次用户授权突破), 随手摘 glass 旗标走标准通道 */
  for (let id=36; id<=62; id++) {
    assert.ok(t.BLOCKS[id], 'id ' + id + ' 应在 BLOCKS 注册');
    for (const idx of tileSet(t, id)) {
      assert.ok(Number.isInteger(idx) && idx >= 0 && idx < count,
          '方块 ' + id + '(' + t.BLOCKS[id].name + ') 格号 ' + idx + ' 应在 [0,' + count + ')');
    }
  }
  assert.strictEqual(t.TextureAtlas.count, 68,
      '已绘制格数 = 68(PAINTERS 0~67 连续; 50/51=宝箱, 52=残骸, 53=覆雪叶, 54=冰, 55~57=南瓜/刻脸, ' +
      '58=铁块, 59=粉羊毛·城镇重制公共件, 60=门额牌·东带 v2 S2, 61=门额牌木底·五面纯木色, ' +
      '62/63=篝火 v1.0 全脸同图作废存档格(T-C8 旧稿, T-C13 起只读不接线), ' +
      '64~67=篝火分面双 tile 燃灶/燃侧/熄灶/熄侧·视觉返工 T-C13)');
  const snowy = t.TextureAtlas.layout.tiles[t.B_SNOWY_GRASS];
  assert.notStrictEqual(snowy.top, snowy.side, '雪覆草顶(雪白)与侧(雪泥带)应分格');
  /* 覆雪树叶 74(世界边界 T12): 独立格位整格同图 — 与树叶 7(T_LEAVES)分格,
     与雪块(T_SNOW)也分格(三个观感各司其职) */
  const snowyLeaves = t.TextureAtlas.layout.tiles[t.B_SNOWY_LEAVES];
  assert.strictEqual(typeof snowyLeaves, 'number', '覆雪树叶整格同图(数值简写)');
  assert.notStrictEqual(snowyLeaves, t.TextureAtlas.layout.tiles[7], '覆雪树叶与树叶分格(白观感独立)');
  assert.notStrictEqual(snowyLeaves, t.TextureAtlas.layout.tiles[t.B_SNOW], '覆雪树叶与雪块分格(针叶底独立)');
  /* 冰 56(世界边界·T8 G3 走查拍板 2026-11-07): 整格同图入集 — 与雪块分格
     (淡蓝裂纹冰面观感独立, 原纯色半透在雪原读作「脏渍」的根治钉) */
  const ice = t.TextureAtlas.layout.tiles[t.B_ICE];
  assert.strictEqual(typeof ice, 'number', '冰整格同图入集(数值简写)');
  assert.notStrictEqual(ice, t.TextureAtlas.layout.tiles[t.B_SNOW], '冰与雪块分格(裂纹冰面独立)');
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
  assert.deepStrictEqual(sm, e, '72 与 71 同图集映射(top/side/bottom 全同, 零新增格位)');
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

/* ============ 远古残骸(73, 装备系统 T7): 正典上下螺旋纹 ============ */

test('布局+像素: 远古残骸(73)入集 — 整格同图同心方环螺旋纹, 全不透明(装备系统 T7)', () => {
  const t = loadAtlas();
  const idx = t.TextureAtlas.layout.tiles[t.B_ANCIENT_DEBRIS];
  assert.strictEqual(typeof idx, 'number', '残骸整格同图(上下同纹, 数值简写)');
  const all = t.TextureAtlas.paintAll();
  const px = tilePixels(t, all, idx);
  for (const p of px) assert.strictEqual(p[3], 255, '残骸像素全不透明(实心立方)');
  /* 螺旋纹判据: 主对角线上亮环带与暗底交替落点(对角线切比雪夫环序:
     i≤7 → 7−i, i≥8 → i−8; 亮环钉在半径 1/5 → 采样点 2/6/9/13;
     亮度以 R 通道 66 为界——环色带 rng 抖动但两带间有缝) */
  for (const i of [2, 6, 9, 13]) {
    assert.ok(px[i * 16 + i][0] > 66, '对角线 ' + i + ' 应落亮环带(螺旋纹), R=' + px[i * 16 + i][0]);
  }
  for (const i of [0, 4, 15]) {
    assert.ok(px[i * 16 + i][0] < 66, '对角线 ' + i + ' 应落暗底(螺旋间隙), R=' + px[i * 16 + i][0]);
  }
});

/* ============ 覆雪树叶(74, 世界边界 T12): 深绿针叶底+白雪覆盖大部 ============ */

test('布局+像素: 覆雪树叶(74)入集 — 整格同图雪盖针叶底, 全不透明, 雪层覆盖过半(世界边界 T12)', () => {
  const t = loadAtlas();
  const idx = t.TextureAtlas.layout.tiles[t.B_SNOWY_LEAVES];
  assert.strictEqual(typeof idx, 'number', '覆雪树叶整格同图(数值简写)');
  const all = t.TextureAtlas.paintAll();
  const px = tilePixels(t, all, idx);
  for (const p of px) assert.strictEqual(p[3], 255, '覆雪树叶像素全不透明(实心立方, 与树叶 7 的孔洞透隙不同)');
  /* 覆雪判据(画师: 逐列雪深 9~14, 确定性): y≤8 恒在雪层内(depth≥9)、y≥15
     恒露针叶底(depth≤14)——雪是冷白 R>200 且 B>R(微蓝), 露绿 G>R(绿主导) */
  const at = (x, y) => px[y * 16 + x];
  for (const [x, y] of [[0, 2], [8, 2], [15, 2], [8, 8]]) {
    assert.ok(at(x, y)[0] > 200 && at(x, y)[2] >= at(x, y)[0],
        '雪层 (' + x + ',' + y + ') 应冷雪白 R>200/B≥R, 实测 R=' + at(x, y)[0] + ' B=' + at(x, y)[2]);
  }
  for (const [x, y] of [[0, 15], [8, 15], [15, 15]]) {
    assert.ok(at(x, y)[1] > at(x, y)[0], '底层 (' + x + ',' + y + ') 应露针叶绿(G>R), 实测 G=' + at(x, y)[1]);
  }
  let snowN = 0;
  for (const p of px) if (p[0] > 200) snowN++; /* 针叶底 R≤58, R>200 只命中雪 */
  assert.ok(snowN > 128, '雪覆盖过半(实测 ' + snowN + '/256, MC 覆雪针叶语言)');
});

/* ============ 门额牌面(80, 东带 v2 野心版 S2): 镇徽钟塔图+纯木底第二格位 ============ */

test('布局+像素: 门额牌(80)入集 — 60 号格镇徽钟塔图(西面) + 61 号格纯木底(其余五面), 逐像素规格直译(v2 S2)', () => {
  const t = loadAtlas();
  const L = t.TextureAtlas.layout;
  const e = L.tiles[t.B_GATE_SIGN];
  assert.ok(e && typeof e === 'object', '门额牌分面入集(西面图案/其余木底)');
  assert.strictEqual(e.side, 60, '门额牌西面图案格=60(59 后第一顺位, pixel-spec §5)');
  assert.strictEqual(e.back, 61, '门额牌其余五面纯木底格=61(design-lead 预授权第二格位)');
  assert.strictEqual(e.top, 61, '顶面=木底格');
  assert.strictEqual(e.bottom, 61, '底面=木底格');
  /* 陶橙瓦 79(S1)纯色行不入集——零贴图成本(S1 优先纯色行) */
  assert.ok(!(t.B_ROOF_TILE in L.tiles), '陶橙瓦不入图集(纯色行 faceColor 兜底)');
  const all = t.TextureAtlas.paintAll();
  const px = tilePixels(t, all, 60);
  /* 色板(pixel-spec §1 锁): W 牌木底/D 深木缝线/B 塔身暖褐/R 瓦顶陶橙/G 顶钟暖金 */
  const W = [200, 152, 88]; const D = [146, 109, 60]; const B = [139, 90, 60];
  const R = [217, 122, 74]; const G = [227, 178, 60];
  const rgb = (p) => [p[0], p[1], p[2]];
  const at = (x, y) => px[y * 16 + x];
  /* 全不透明(实心漆牌)+色数恰 5(底 2+图形 3, ≤5 红线) */
  const seen = new Set();
  for (const p of px) {
    assert.strictEqual(p[3], 255, '门额牌像素全不透明(实心漆牌无透隙)');
    seen.add(p[0] + ',' + p[1] + ',' + p[2]);
  }
  assert.strictEqual(seen.size, 5, '色数恰 5(实测 ' + seen.size + ')');
  /* 图案锚点(§2 逐像素网格直译): 金点/瓦顶两笔/塔身/塔门透出 */
  assert.deepStrictEqual(rgb(at(7, 1)), G, '顶钟金点(7,1)');
  assert.deepStrictEqual(rgb(at(8, 1)), G, '顶钟金点(8,1, 2px 横对居 x=7.5)');
  assert.deepStrictEqual(rgb(at(5, 2)), R, '瓦顶上笔左端(5,2)');
  assert.deepStrictEqual(rgb(at(10, 3)), R, '瓦顶上笔右端(10,3)');
  assert.deepStrictEqual(rgb(at(7, 3)), R, '瓦顶上笔盖过横缝 y3(镇徽漆在木作线之上)');
  assert.deepStrictEqual(rgb(at(4, 4)), R, '瓦顶下笔左端(4,4, 8 宽阶梯收分)');
  assert.deepStrictEqual(rgb(at(11, 5)), R, '瓦顶下笔右端(11,5)');
  assert.deepStrictEqual(rgb(at(6, 6)), B, '塔身左上(6,6, 4 宽 8 行主剪影)');
  assert.deepStrictEqual(rgb(at(9, 10)), B, '塔身右中(9,10)');
  assert.deepStrictEqual(rgb(at(7, 12)), W, '塔门木底透出(7,12, 底色透出=零新增色)');
  assert.deepStrictEqual(rgb(at(8, 13)), W, '塔门木底透出(8,13)');
  /* 木作线(planksBase 族): 横缝 4 行一板 + 竖缝错位 + 钉点 */
  assert.deepStrictEqual(rgb(at(0, 3)), D, '横缝板末行(0,3)');
  assert.deepStrictEqual(rgb(at(0, 7)), D, '横缝(0,7)');
  assert.deepStrictEqual(rgb(at(15, 11)), D, '横缝(15,11)');
  assert.deepStrictEqual(rgb(at(0, 15)), D, '横缝(0,15)');
  assert.deepStrictEqual(rgb(at(2, 0)), D, '竖缝 x2 板带 1(2,0..2)');
  assert.deepStrictEqual(rgb(at(13, 4)), D, '竖缝 x13 板带 2(13,4..6)');
  assert.deepStrictEqual(rgb(at(14, 1)), D, '钉点(14,1)');
  assert.deepStrictEqual(rgb(at(1, 13)), D, '钉点(1,13)');
  assert.deepStrictEqual(rgb(at(0, 0)), W, '牌角木底(0,0)');
  /* 61 号格: 纯木底平涂(五面木底 #C89858, 零噪声确定性) */
  const wood = tilePixels(t, all, 61);
  for (const p of wood) {
    assert.deepStrictEqual(rgb(p), W, '木底格纯 #C89858 平涂');
    assert.strictEqual(p[3], 255, '木底格全不透明');
  }
});

test('meshChunk: 门额牌竖板路径 — 专用小盒贴西缘, 西面 UV 落图案格其余落木底格, 垫块上底面剔除(v2 S2 火把/床双先例)', () => {
  const t = loadAtlas();
  assert.strictEqual(t.B_GATE_SIGN, 80, '前置: 门额牌 id=80');
  const L = t.TextureAtlas.layout;
  const e = L.tiles[t.B_GATE_SIGN];
  const rect = (idx) => t.TextureAtlas.tileUV(idx);
  const inRect = (r, uvs) => uvs.every((q, i) => i % 2 === 0 ?
    q >= r[0] - 1e-12 && q <= r[2] + 1e-12 : q >= r[1] - 1e-12 && q <= r[3] + 1e-12);
  /* 悬空孤牌: 6 面全绘(西面图案+东/南北/顶/底木底), 薄板贴西缘 thin=0.15 */
  let p = mkPack(1);
  p.set(8, 5, 8, t.B_GATE_SIGN);
  let r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.solid, null, '入集门额牌不走纯色通道');
  assert.strictEqual(quads(r.atlas), 6, '悬空门额牌 6 面');
  const xs = new Set();
  const x0 = Math.floor(r.atlas.positions[0]);
  for (let i = 0; i < r.atlas.positions.length; i += 3) {
    xs.add(Math.round((r.atlas.positions[i] - x0) * 10000) / 10000);
  }
  assert.deepStrictEqual([...xs].sort(), [0, 0.15], '薄板贴西缘 x∈[0,0.15](竖立满格高/宽)');
  /* 分面 UV: 法线 -x 面(西面图案)落 60 号格; 其余面(东/南北/顶/底)落 61 号木底格 */
  const faces = new Map();
  for (let q = 0; q < r.atlas.indices.length; q += 6) {
    const vi = r.atlas.indices[q];
    const nx = r.atlas.normals[vi * 3]; const ny = r.atlas.normals[vi * 3 + 1];
    const nz = r.atlas.normals[vi * 3 + 2];
    const uvs = [];
    for (let c = 0; c < 4; c++) {
      const v = r.atlas.indices[q + c];
      uvs.push(r.atlas.uvs[v * 2], r.atlas.uvs[v * 2 + 1]);
    }
    faces.set(nx + ',' + ny + ',' + nz, uvs);
  }
  assert.ok(inRect(rect(e.side), faces.get('-1,0,0')), '西面 UV 落镇徽图案格(图案面朝西迎玩家)');
  for (const key of ['1,0,0', '0,0,-1', '0,0,1', '0,1,0', '0,-1,0']) {
    assert.ok(inRect(rect(e.back), faces.get(key)), '面 ' + key + ' UV 落纯木底格');
  }
  /* 西面 UV 满幅采样(整格图案, 非火把式采样窗): 四角恰贴格矩形四角 */
  const wr = rect(e.side);
  const wu = faces.get('-1,0,0');
  assert.ok(wu.some((q, i) => i % 2 === 0 && Math.abs(q - wr[0]) < 1e-9), '西面 U 贴格左缘');
  assert.ok(wu.some((q, i) => i % 2 === 0 && Math.abs(q - wr[2]) < 1e-9), '西面 U 贴格右缘');
  /* 垫块上(横梁语境): 底面贴实心剔除=5 面(火把 cullDown 同款, 防与梁顶 z-fight);
     垫块用 13 石砖(不入集走实心通道)——横梁同料, 若用 3 石头(在集)会混入图集通道 */
  p = mkPack(1);
  p.set(8, 5, 8, 13); /* 垫块=门洞横梁同位语境(石砖) */
  p.set(8, 6, 8, t.B_GATE_SIGN);
  r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(quads(r.atlas), 5, '垫块上门额牌 5 面(底面剔除)');
  assert.strictEqual(quads(r.solid), 6, '垫块本体照常实心通道(牌不遮梁)');
});

/* ============ 门额牌竖板顶点光(T4 返工): 面朝向邻格采样 ============ */
/* 带光照载荷的 pack(D3): mesh-core.test.js mkPackL 同构先例 — sky/block 与
   cells 同形同布局, 光值由测试逐格显式写入(断言不经生产代码派生) */
function mkPackL(border) {
  const p = mkPack(border);
  p.sky = new Uint8Array(p.w * p.d * 48); /* 缺省 0: 被遮蔽(取样格全由测试显式给值) */
  p.block = new Uint8Array(p.w * p.d * 48);
  p.setL = (lx, y, lz, s, b) => {
    p.sky[(y*p.d + lz)*p.w + lx] = s;
    p.block[(y*p.d + lz)*p.w + lx] = b;
  };
  return p;
}
/* 按面法线收集四边形顶点序号(mesh-core.test.js 同构先例; sky/block 单标量属性) */
function quadsByNormal(ch) {
  const map = new Map();
  for (let q = 0; q < ch.indices.length; q += 6) {
    const v0 = ch.indices[q];
    const key = ch.normals[v0*3] + ',' + ch.normals[v0*3+1] + ',' + ch.normals[v0*3+2];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push([0, 1, 2, 3].map((i) => ch.indices[q+i]));
  }
  return map;
}
const s15 = (lvl) => lvl / 15;
const faceSkyEq = (ch, qs, want) => qs.every((qd) => qd.every((v) => Math.abs(ch.sky[v] - want) < 1e-9));
const faceBlkEq = (ch, qs, want) => qs.every((qd) => qd.every((v) => Math.abs(ch.block[v] - want) < 1e-9));

test('meshChunk: 门额牌竖板顶点光取面朝向邻格 — 西面(图案面)不取自身格(自身被遮蔽恒 0, pane/实心普通面同口径, T4 返工)', () => {
  const t = loadAtlas();
  /* 白天口径: 牌格 (8,5,8) solid:true → LightCore opaque 判挡光, sky/block 双通道
     不入光恒 0; 西邻格 (7,5,8) 露天天光 13。西面顶点若取自身格=全黑牌
     (voxBright(0)=0.05 昼夜刺眼), 取面朝向邻格=13/15 全亮(架构师 §1.4a 裁定,
     pushPane 同口径先例) */
  const p = mkPackL(1);
  p.set(8, 5, 8, t.B_GATE_SIGN);
  p.setL(7, 5, 8, 13, 0); /* 西邻格: 白天天光(牌面朝西迎玩家) */
  p.setL(8, 5, 8, 0, 0); /* 自身格: 被遮蔽恒 0(旧径黑牌病灶) */
  let r = t.MeshCore.meshChunk(p, atlasOpt(t));
  const west = quadsByNormal(r.atlas).get('-1,0,0');
  assert.ok(west && west.length === 1, '悬空牌西面单四边形在场');
  assert.ok(faceSkyEq(r.atlas, west, s15(13)), '西面顶点 sky 取西邻格 13(白天全亮), 不取自身格 0');
  /* 壁灯照牌语义: 西邻格 block=14(壁灯 light15 经空气链照上牌面) → 西面顶点 block 跟随 */
  p.setL(7, 5, 8, 13, 14);
  r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.ok(faceBlkEq(r.atlas, quadsByNormal(r.atlas).get('-1,0,0'), s15(14)),
      '西面顶点 block 跟随西邻格 14(夜间壁灯光照上牌面)');
});

/* ============ 篝火两态贴图(篝火 T-C8 原落/视觉返工 T-C13, UI 定稿 docs/design/campfire-visual-spec.md §4 v1.9) ============ */
/* 观感唯一权威=UI 定稿 §4.2(燃烧态分面双 tile: 64 灶面/65 侧脸)/§4.3(熄灭态:
   66 灶面/67 侧脸) char art 逐字符照抄 + §4.4 可辨性 + §4.5 五项判据。
   色板=§3.1 九色 + §4.2 暗炭底 C(#231a12) + §4.3 灰烬灰 a(#b9b4a8), hex→RGB
   逐值换算; 画笔纪律内嵌: 灶面 C 底 noiseFill amp 0.06(±6% 值噪)、侧脸透明区
   alpha=0 真透明(world.js atlasMat alphaTest 0.5 管线已证, T-C13 申报拍板:
   不用 C 暗底回退)、65 原木木纹 d 短划 2~3 道(rng 撒, r12 起 1px 宽 2px 高)、
   66/67 a 散斑补撒 per-tile 4~8 粒(rng, 1px 粒)、焰团/火舌/灰烬斑/木框像素零 rng
   (「结构像素固定+纹理 rng」=雪块/羊毛画师先例不变)。 */
const CF_LIT_TOP_ART = [ /* UI 定稿 §4.2 燃灶面 64(木框 L 环+d 内缘+焰团+e 双弧+a 斑, C 地 noiseFill) */
  'LLLLLLLLLLLLLLLL',
  'LddddddddddddddL',
  'LdCCCCCCCCCCCCdL',
  'LdCCCaCCCCCaCCdL',
  'LdCCCeeCCCeeCCdL',
  'LdCffWWWWffCCCdL',
  'LdfFWwwwwWFfCCdL',
  'LdFWwwwwwwWFCCdL',
  'LdfFWwwwwWFfCCdL',
  'LdCffWWffCCCCCdL',
  'LdCCCCeeeeCCCCdL',
  'LdCCCaCCCCCaCCdL',
  'LdCCCCCCCCCCCCdL',
  'LdCCCCCCCCCCCCdL',
  'LddddddddddddddL',
  'LLLLLLLLLLLLLLLL',
];
const CF_LIT_SIDE_ART = [ /* UI 定稿 §4.2 燃侧脸 65(上半透明+中心火舌+原木横梁, '.'=不绘制) */
  '................',
  '................',
  '.......f........',
  '......fFf.......',
  '.....fFWFf......',
  '.....FWwWF......',
  '....fFWwwWFf....',
  '....FFWwwWFF....',
  '...fFFWwwWFFf...',
  '...FFFWwwWFFF...',
  '..dddddddddddd..',
  '..dLLLLLLLLLLd..',
  '..dLLdLLLLdLLd..',
  '..dLLLLLLLLLLd..',
  '..dddddddddddd..',
  '..dddddddddddd..',
];
const CF_OUT_TOP_ART = [ /* UI 定稿 §4.3 熄灶面 66(同构木框+灰烬坑 a+中央炭心 k, 全域零焰色) */
  'LLLLLLLLLLLLLLLL',
  'LddddddddddddddL',
  'LdCCCCCCCCCCCCdL',
  'LdCCCaCCCCCaCCdL',
  'LdCCCaaCCCCaaCdL',
  'LdCaaaaaaaaaaCdL',
  'LdCaaakkkaaaaCdL',
  'LdCaakkkkkkaaCdL',
  'LdCaakkkkkkaaCdL',
  'LdCaaakkkaaaaCdL',
  'LdCaaaaaaaaaaCdL',
  'LdCCCaCCCCCaCCdL',
  'LdCCCCCCCCCCCCdL',
  'LdCCCCCCCCCCCCdL',
  'LddddddddddddddL',
  'LLLLLLLLLLLLLLLL',
];
const CF_OUT_SIDE_ART = [ /* UI 定稿 §4.3 熄侧脸 67(r0~r6 全透明+中心暗炭缝+原木同 65, 同位形去焰) */
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......aa.......',
  '......akka......',
  '.....aakkaa.....',
  '..dddddddddddd..',
  '..dLLLLLLLLLLd..',
  '..dLLdLLLLdLLd..',
  '..dLLLLLLLLLLd..',
  '..dddddddddddd..',
  '..dddddddddddd..',
];
const CAMPFIRE_LIT_ART = [ /* 【v1.9 作废存档基准】v1.0 全脸同图单 tile 62(T-C8 旧稿) — 仅 62 号存档测消费, 不得照抄进新画师 */
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCfFCCCCCCC',
  'CCCCCCfFFfCCCCCC',
  'CCCCCfFWWFfCCCCC',
  'CCCCCFWwwWFCCCCC',
  'CCCCfFWwwWFfCCCC',
  'CCCCFWwwwwWFCCCC',
  'CCCfFFWwwWFFfCCC',
  'CCCFFFWWWWFFFCCC',
  'CCeFFFWWWWFFFeCC',
  'CCekeFFeeFFekeCC',
  'kllllllllllllllk',
  'dLLLLLLLLLLLLLLd',
  'dddddddddddddddd',
  'dLLLLLLLLLLLLLLd',
  'dddddddddddddddd',
];
const CAMPFIRE_OUT_ART = [ /* 【v1.9 作废存档基准】v1.0 全脸同图单 tile 63(T-C8 旧稿) — 仅 63 号存档测消费 */
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'CCaCCCaCCaCCaCCC',
  'CCCCaCCCCCaCCCCC',
  'kLLLLLLLLLLLLLLk',
  'dLLLLLLLLLLLLLLd',
  'dddddddddddddddd',
  'dLLLLLLLLLLLLLLd',
  'dddddddddddddddd',
];
const CF_PAL = {/* UI 定稿 §3.1 九色 + §4.2 C + §4.3 a(hex 逐值换算) */
  w: [255, 255, 255], /* 焰心白 #ffffff */
  W: [255, 255, 151], /* 焰芯亮黄 #ffff97 */
  f: [255, 216, 0], /* 焰亮黄 #ffd800 */
  F: [255, 143, 0], /* 焰橙 #ff8f00 */
  e: [224, 90, 26], /* 余烬红 #e05a1a */
  k: [47, 42, 38], /* 炭黑 #2f2a26 */
  L: [138, 90, 43], /* 原木主 #8a5a2b */
  l: [168, 116, 61], /* 原木受光 #a8743d */
  d: [107, 69, 31], /* 原木背光 #6b451f */
  C: [35, 26, 18], /* 暗炭底 #231a12(noiseFill amp 0.06 铺噪) */
  a: [185, 180, 168], /* 灰烬灰 #b9b4a8 */
};
const cfEq = (p, c) => p[3] === 255 && p[0] === c[0] && p[1] === c[1] && p[2] === c[2];
/* C 底噪声窗: noiseFill amp 0.06 → 每通道 ×[0.94,1.06](Uint8Clamped 取整, 窗口放宽到 floor/ceil) */
const cfCNoise = (p) => {
  const c = CF_PAL.C;
  return p[3] === 255 && [0, 1, 2].every((i) =>
    p[i] >= Math.floor(c[i] * 0.94) && p[i] <= Math.ceil(c[i] * 1.06));
};

test('篝火施工期断言: 四张 B 区 char art 行宽全=16(UI 定稿 §4.5-5 v1.9 分面回归四张; 燃灶/燃侧/熄灶/熄侧)', () => {
  for (const [name, art] of [
    ['燃灶面 §4.2', CF_LIT_TOP_ART], ['燃侧脸 §4.2', CF_LIT_SIDE_ART],
    ['熄灶面 §4.3', CF_OUT_TOP_ART], ['熄侧脸 §4.3', CF_OUT_SIDE_ART],
  ]) {
    assert.strictEqual(art.length, 16, name + ' 应为 16 行');
    art.forEach((row, y) => assert.strictEqual(row.length, 16, name + ' 行 ' + y + ' 行宽应=16'));
  }
});

test('篝火布局: 两态入集分面双 tile — 81={顶64/侧65/底65}·82={顶66/侧67/底67}(UI 定稿 §4.1 v1.9 分面接线, T-C13), count=68', () => {
  const t = loadAtlas();
  assert.strictEqual(t.B_CAMPFIRE, 81, '前置: 燃烧态 id=81(T-C1 已落)');
  assert.strictEqual(t.B_CAMPFIRE_OUT, 82, '前置: 熄灭态 id=82(T-C1 已落)');
  const lit = t.TextureAtlas.layout.tiles[t.B_CAMPFIRE];
  const out = t.TextureAtlas.layout.tiles[t.B_CAMPFIRE_OUT];
  /* 分面条目三键齐(bottom=side 兜底抄床/宝箱先例): 否则 usedTiles 覆盖面循环
     拿 undefined 格号即崩——这是保护既有守门机器, 非过度约束 */
  assert.ok(lit && typeof lit === 'object', '燃烧态应分面条目(object, v1.9 废全脸同图数值简写)');
  assert.ok(out && typeof out === 'object', '熄灭态应分面条目(object)');
  assert.strictEqual(lit.top, 64, '燃烧态顶面=64 燃灶面(俯视, §4.1 接线表)');
  assert.strictEqual(lit.side, 65, '燃烧态四侧=65 燃侧脸(正视)');
  assert.strictEqual(lit.bottom, 65, '燃烧态底面=side 兜底(贴地不绘, 条目三键齐防守门循环拿 undefined)');
  assert.strictEqual(out.top, 66, '熄灭态顶面=66 熄灶面');
  assert.strictEqual(out.side, 67, '熄灭态四侧=67 熄侧脸');
  assert.strictEqual(out.bottom, 67, '熄灭态底面=side 兜底(同上)');
  assert.strictEqual(t.TextureAtlas.count, 68, 'count=68(PAINTERS 0~67 连续: 62/63 存档+64~67 新增)');
  /* config 消费锚: 贴图格指向以 config 两态 id 为键(B_CAMPFIRE 行 T-C1 已落) */
  assert.strictEqual(t.BLOCKS[t.B_CAMPFIRE].campfire, 'lit', '燃烧态旗标 lit(T-C1 行)');
  assert.strictEqual(t.BLOCKS[t.B_CAMPFIRE_OUT].campfire, 'out', '熄灭态旗标 out(T-C1 行)');
});

test('篝火像素(作废存档): 62 号格逐字符=v1.0 旧稿(T-C8)固定像素精确, C 底噪±6%, 木纹 d 短划 4~5 道 — T-C13 起仅存档不接线, 画师不得删除', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const idx = 62; /* 固定索引: layout.tiles[81] 已改分面 object(T-C13), 62 是作废存档格 */
  const px = tilePixels(t, all, idx);
  const art = CAMPFIRE_LIT_ART;
  const at = (x, y) => px[y * 16 + x];
  let dashPx = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = art[y][x]; const p = at(x, y);
      if (ch === 'C') {
        assert.ok(cfCNoise(p), 'C 底噪声像素 (' + x + ',' + y + ') 实测 ' + p);
      } else if (ch === 'L' && (y === 12 || y === 14)) {
        /* 原木床 L 行: 本色或被 rng 木纹 d 短划覆盖(§4.2 画笔纪律) */
        if (cfEq(p, CF_PAL.d)) {
          dashPx++; continue;
        }
        assert.ok(cfEq(p, CF_PAL.L), '原木主 L (' + x + ',' + y + ') 实测 ' + p);
      } else {
        assert.ok(cfEq(p, CF_PAL[ch]), '固定像素 ' + ch + ' (' + x + ',' + y + ') 实测 ' + p);
      }
    }
  }
  assert.ok(dashPx >= 4 && dashPx <= 10,
      '木纹 d 短划(4~5 道×1px 宽, 落 r12/r14)应盖中 ≥4 且 ≤10 个 L 行像素, 实测 ' + dashPx);
  /* 木纹不得越出原木床(r12/r14 锚定): r0~r11 出现 d 色像素即红 */
  for (let y = 0; y <= 11; y++) {
    for (let x = 0; x < 16; x++) {
      assert.ok(!cfEq(at(x, y), CF_PAL.d), 'd 色像素不得出现在原木床锚行之上 (' + x + ',' + y + ')');
    }
  }
  for (const p of px) assert.strictEqual(p[3], 255, '燃烧态像素全不透明(实心半格块)');
});

test('篝火像素(作废存档): 63 号格逐字符=v1.0 旧稿(T-C8)同位形去焰固定像素精确, C 底噪±6%, 灰烬散斑 6~10 粒(y∈[2,8]) — T-C13 起仅存档不接线', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const idx = 63; /* 固定索引: layout.tiles[82] 已改分面 object(T-C13), 63 是作废存档格 */
  const px = tilePixels(t, all, idx);
  const art = CAMPFIRE_OUT_ART;
  const at = (x, y) => px[y * 16 + x];
  const specks = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = art[y][x]; const p = at(x, y);
      if (ch === 'C') {
        /* r0~r8 C 区可被 rng 灰烬散斑覆盖; r9+ 固定像素零 rng(散斑域 y∈[2,8]) */
        if (y <= 8 && cfEq(p, CF_PAL.a)) {
          specks.push([x, y]); continue;
        }
        assert.ok(cfCNoise(p), 'C 底噪声像素 (' + x + ',' + y + ') 实测 ' + p);
      } else {
        assert.ok(cfEq(p, CF_PAL[ch]), '固定像素 ' + ch + ' (' + x + ',' + y + ') 实测 ' + p);
      }
    }
  }
  assert.ok(specks.length >= 6 && specks.length <= 10,
      '灰烬散斑 6~10 粒(§4.3 画笔纪律), 实测 ' + specks.length);
  for (const [x, y] of specks) {
    assert.ok(y >= 2 && y <= 8, '散斑域 y∈[2,8], 实测 (' + x + ',' + y + ')');
  }
  for (const p of px) assert.strictEqual(p[3], 255, '熄灭态存档像素全不透明(旧稿实心口径)');
});

/* ---- T-C13 v1.9 分面双 tile 四格逐像素(§4.2/§4.3 定稿画稿逐字符) ---- */

test('篝火像素 v1.9: 燃灶面 64 号格逐字符=UI 定稿 §4.2 — 木框 L 环/d 内缘/焰团/e 双弧/a 斑固定, C 地 noiseFill ±6%, 全格不透明(灶面俯视)', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const px = tilePixels(t, all, 64); /* 固定索引=T_CAMPFIRE_TOP(§4.1 v1.9) */
  const art = CF_LIT_TOP_ART;
  const at = (x, y) => px[y * 16 + x];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = art[y][x]; const p = at(x, y);
      if (ch === 'C') {
        assert.ok(cfCNoise(p), 'C 地噪声像素 (' + x + ',' + y + ') 实测 ' + p);
      } else {
        assert.ok(cfEq(p, CF_PAL[ch]), '固定像素 ' + ch + ' (' + x + ',' + y + ') 实测 ' + p);
      }
    }
  }
  for (const p of px) assert.strictEqual(p[3], 255, '燃灶面像素全不透明(俯视灶面无镂空)');
});

test('篝火像素 v1.9: 燃侧脸 65 号格逐字符=UI 定稿 §4.2 — 透明区 alpha=0 真透(钉 alphaTest 管线, 不用 C 暗底回退), ' +
    '火舌/原木固定, 木纹 d 短划 2~3 道 r12 起 1px 宽 2px 高', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const px = tilePixels(t, all, 65); /* 固定索引=T_CAMPFIRE_SIDE(§4.1 v1.9) */
  const art = CF_LIT_SIDE_ART;
  const at = (x, y) => px[y * 16 + x];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = art[y][x]; const p = at(x, y);
      if (ch === '.') {
        assert.strictEqual(p[3], 0, '透明区 (' + x + ',' + y + ') alpha 应=0(真透明, 见背后世界)');
      } else if (ch === 'L' && y >= 11 && y <= 13 && x >= 3 && x <= 12) {
        /* 原木 L 亮面区: 本色或被 rng 木纹 d 短划覆盖(§4.2 画笔纪律, 62 存档测同款放行先例) */
        if (!cfEq(p, CF_PAL.d)) {
          assert.ok(cfEq(p, CF_PAL.L), '原木主 L (' + x + ',' + y + ') 实测 ' + p);
        }
      } else {
        assert.ok(cfEq(p, CF_PAL[ch]), '固定像素 ' + ch + ' (' + x + ',' + y + ') 实测 ' + p);
      }
    }
  }
  /* 木纹 d 短划窗: r12 行内起 1px 宽 2px 高(r12-r13 同列双 d), 2~3 道(§4.2 画笔纪律);
     列域 col3..12(端头 col2/13 是结构 d 不算木纹) */
  let dashCols = 0;
  for (let x = 3; x <= 12; x++) {
    if (cfEq(at(x, 12), CF_PAL.d) && cfEq(at(x, 13), CF_PAL.d)) dashCols++;
  }
  assert.ok(dashCols >= 2 && dashCols <= 3,
      '木纹 d 短划 2~3 道(r12 起 1px 宽 2px 高: r12-r13 同列双 d), 实测 ' + dashCols + ' 道');
  /* 木纹不得越出原木区: r10 上缘及以上出现 d 色像素即红 */
  for (let y = 0; y <= 10; y++) {
    for (let x = 0; x < 16; x++) {
      assert.ok(!cfEq(at(x, y), CF_PAL.d), 'd 色像素不得出现在原木上缘之上 (' + x + ',' + y + ')');
    }
  }
});

test('篝火像素 v1.9: 熄灶面 66 号格逐字符=UI 定稿 §4.3 — 木框/灰烬坑 a/炭心 k 固定, C 地 noiseFill ±6%, ' +
    'a 散斑补撒 per-tile 4~8 粒, 全格不透明, 零焰色', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const px = tilePixels(t, all, 66); /* 固定索引=T_CAMPFIRE_OUT_TOP(§4.1 v1.9) */
  const art = CF_OUT_TOP_ART;
  const at = (x, y) => px[y * 16 + x];
  const specks = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = art[y][x]; const p = at(x, y);
      if (ch === 'C') {
        /* C 内区允许被 rng a 散斑覆盖(per-tile 补撒 4~8 粒, 1px 粒) */
        if (cfEq(p, CF_PAL.a)) {
          specks.push([x, y]); continue;
        }
        assert.ok(cfCNoise(p), 'C 地噪声像素 (' + x + ',' + y + ') 实测 ' + p);
      } else {
        assert.ok(cfEq(p, CF_PAL[ch]), '固定像素 ' + ch + ' (' + x + ',' + y + ') 实测 ' + p);
      }
    }
  }
  assert.ok(specks.length >= 4 && specks.length <= 8,
      'a 散斑补撒 per-tile 4~8 粒(§4.3 画笔纪律, per-tile 口径), 实测 ' + specks.length);
  for (const p of px) assert.strictEqual(p[3], 255, '熄灶面像素全不透明(俯视灶面无镂空)');
});

test('篝火像素 v1.9: 熄侧脸 67 号格逐字符=UI 定稿 §4.3 — r0~r6 全透明(零火舌), 炭缝 a 缘 k 心固定, 原木同 65, a 散斑补撒 per-tile 4~8 粒(炭缝外围)', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const px = tilePixels(t, all, 67); /* 固定索引=T_CAMPFIRE_OUT_SIDE(§4.1 v1.9) */
  const art = CF_OUT_SIDE_ART;
  const at = (x, y) => px[y * 16 + x];
  const specks = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = art[y][x]; const p = at(x, y);
      if (ch === '.') {
        /* 透明区: 除 rng a 散斑粒(1px, 炭缝外围)外必须真透明 */
        if (cfEq(p, CF_PAL.a)) {
          specks.push([x, y]); continue;
        }
        assert.strictEqual(p[3], 0, '透明区 (' + x + ',' + y + ') alpha 应=0(真透明)');
      } else if (ch === 'L' && y >= 11 && y <= 13 && x >= 3 && x <= 12) {
        /* 原木 L 亮面区: 本色或被 rng 木纹 d 短划覆盖(与 65 同构) */
        if (!cfEq(p, CF_PAL.d)) {
          assert.ok(cfEq(p, CF_PAL.L), '原木主 L (' + x + ',' + y + ') 实测 ' + p);
        }
      } else {
        assert.ok(cfEq(p, CF_PAL[ch]), '固定像素 ' + ch + ' (' + x + ',' + y + ') 实测 ' + p);
      }
    }
  }
  assert.ok(specks.length >= 4 && specks.length <= 8,
      'a 散斑补撒 per-tile 4~8 粒(§4.3 画笔纪律, 炭缝外围 1px 粒, per-tile 口径), 实测 ' + specks.length);
  /* 木纹短划窗与 65 同构: r12-r13 同列双 d 2~3 道 */
  let dashCols = 0;
  for (let x = 3; x <= 12; x++) {
    if (cfEq(at(x, 12), CF_PAL.d) && cfEq(at(x, 13), CF_PAL.d)) dashCols++;
  }
  assert.ok(dashCols >= 2 && dashCols <= 3,
      '原木木纹 d 短划 2~3 道(与 65 同位形), 实测 ' + dashCols + ' 道');
});

test('篝火可辨性 v1.9: 燃烧态两 tile 焰四档合计 ≥80px(静态 94)且白芯亮黄 ≥36px(静态 46)/余烬红=8px/' +
    '熄灭态两 tile 零焰色零余烬红·最高亮像素=灰烬灰(UI 定稿 §4.4/§4.5-1)', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  /* v1.9 分面合计口径(§4.4): 燃烧态=64 灶面+65 侧脸; 熄灭态=66+67 */
  const lit = [...tilePixels(t, all, 64), ...tilePixels(t, all, 65)];
  const out = [...tilePixels(t, all, 66), ...tilePixels(t, all, 67)];
  const key = (p) => p[0] + ',' + p[1] + ',' + p[2];
  const FLAME = new Set([CF_PAL.w, CF_PAL.W, CF_PAL.f, CF_PAL.F].map(key));
  let flameN = 0; let coreN = 0; let emberN = 0;
  for (const p of lit) {
    if (FLAME.has(key(p))) {
      flameN++;
      if (key(p) === key(CF_PAL.w) || key(p) === key(CF_PAL.W)) coreN++;
    }
    if (cfEq(p, CF_PAL.e)) emberN++;
  }
  assert.ok(flameN >= 80, '焰四档两 tile 合计 ≥80px(§4.4 v1.9, 设计稿静态 94=灶面 44+侧脸 50), 实测 ' + flameN);
  assert.ok(coreN >= 36, '白芯/亮黄两 tile 合计 ≥36px(§4.4 v1.9, 静态 46=灶面 26+侧脸 20), 实测 ' + coreN);
  assert.strictEqual(emberN, 8, '余烬红=8px(§4.4 灶面双弧 r4/r10 固定, 侧脸零 e)');
  for (const p of out) {
    assert.ok(!FLAME.has(key(p)) && !cfEq(p, CF_PAL.e),
        '熄灭态两 tile 零焰色零余烬红(§4.4 v1.9), 实测 ' + key(p));
  }
  let best = out[0]; let bestLum = -1;
  for (const p of out) {
    const lum = p[0] + p[1] + p[2];
    if (lum > bestLum) {
      bestLum = lum; best = p;
    }
  }
  assert.ok(cfEq(best, CF_PAL.a), '熄灭态最高亮像素=灰烬灰 #b9b4a8(§4.4 亮部上限, luma 180.2), 实测 ' + key(best));
});

test('篝火确定性: 六格(62/63 存档+64~67 分面)同 seed 两次绘制逐像素一致(mulberry32 纪律, UI 定稿 §4.5-3 v1.9 四 tile 全走)', () => {
  const t = loadAtlas();
  const a = t.TextureAtlas.paintAll();
  const b = t.TextureAtlas.paintAll();
  for (const idx of [62, 63, 64, 65, 66, 67]) {
    const pa = tilePixels(t, a, idx); const pb = tilePixels(t, b, idx);
    for (let i = 0; i < pa.length; i++) {
      assert.deepStrictEqual(pb[i], pa[i], '格 ' + idx + ' 像素 ' + i + ' 两次绘制应一致');
    }
  }
});

test('篝火图集相邻: 62/63 暗炭底 vs 61 门额牌亮木底(#C89858)灰度差大 — LOD 串色程序面锚(UI 定稿 §4.1/§4.5-4; 人眼走查归 T-C12)', () => {
  const t = loadAtlas();
  const all = t.TextureAtlas.paintAll();
  const meanLum = (idx) => {
    const px = tilePixels(t, all, idx);
    return px.reduce((s, p) => s + p[0] + p[1] + p[2], 0) / px.length / 3;
  };
  /* 暗底程序面锚(§4.1「62/63 暗炭底」): 熄灭态全格平均灰度显著低于中灰 */
  const outMean = meanLum(63);
  assert.ok(outMean < 70, '熄灭态暗炭底: 全格平均灰度 <70, 实测 ' + outMean.toFixed(1));
  const wood = meanLum(61);
  const gapLit = Math.abs(meanLum(62) - wood);
  const gapOut = Math.abs(outMean - wood);
  assert.ok(gapLit >= 30, '燃烧态与木底格平均灰度差 ≥30(§4.1 灰度差大), 实测 ' + gapLit.toFixed(1));
  assert.ok(gapOut >= 60, '熄灭态与木底格平均灰度差 ≥60(§4.1 灰度差大), 实测 ' + gapOut.toFixed(1));
});

test('篝火 meshChunk v1.9: 两态走矮半格扁盒图集通道 — 5 面/高 0.4375(thin 7/16)/分面 UV 顶灶面·四侧侧脸·无底面' +
    '(UI 定稿 §4.1 v1.9 分面接线消费端, T-C13)', () => {
  const t = loadAtlas();
  const inRect = (rect, uvs) => uvs.every((q, i) => i % 2 === 0 ?
    q >= rect[0] - 1e-12 && q <= rect[2] + 1e-12 :
    q >= rect[1] - 1e-12 && q <= rect[3] + 1e-12);
  const quadUVs = (ch, vs) => vs.map((vi) => [ch.uvs[vi * 2], ch.uvs[vi * 2 + 1]]);
  /* 燃烧态: 篝火独置 → 图集通道矮半格扁盒(thin=BLOCKS 驱动, §4.1 v1.9 倾向 7/16;
      不得走十字面片)。布景纪律(红方裁决): 不垫块——id 3 石头自身在图集 layout,
      会以 6 面污染通道面计数(mesh-core.test.js 火把最小场景同款纪律); 扁盒无底面,
      面数/薄高/分面 UV 均与下方方块无关, 独置即钉住全部票面断言 */
  let p = mkPack(1);
  p.set(8, 6, 8, t.B_CAMPFIRE);
  let r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.solid, null, '入集篝火不走纯色兜底通道');
  assert.strictEqual(quads(r.atlas), 5, '半格扁盒 5 面(top+4 侧, 跳底面 pushBedBox 同款)');
  const ys = new Set();
  for (let i = 1; i < r.atlas.positions.length; i += 3) ys.add(r.atlas.positions[i]);
  assert.ok(ys.has(6) && ys.has(6.4375) && ys.size === 2,
      '扁盒高度=thin 0.4375(§4.1 v1.9 矮半格 7/16, spec §3.4 thin 0.5 行随本票变陈旧), 实际 ' + [...ys]);
  const litFaces = quadsByNormal(r.atlas);
  assert.strictEqual(litFaces.get('0,1,0').length, 1, '顶面单四边形在场');
  assert.strictEqual(litFaces.get('-1,0,0').length + litFaces.get('1,0,0').length +
      litFaces.get('0,0,-1').length + litFaces.get('0,0,1').length, 4, '四侧面各单四边形');
  assert.ok(!litFaces.get('0,-1,0'), '底面不绘(§4.1: 贴地不可见)');
  for (const vs of litFaces.get('0,1,0')) {
    assert.ok(inRect(t.TextureAtlas.tileUV(64), quadUVs(r.atlas, vs)),
        '顶面 UV 应落 64 燃灶面格(分面: 顶=俯视灶面)');
  }
  for (const nk of ['-1,0,0', '1,0,0', '0,0,-1', '0,0,1']) {
    for (const vs of litFaces.get(nk)) {
      assert.ok(inRect(t.TextureAtlas.tileUV(65), quadUVs(r.atlas, vs)),
          '侧面 ' + nk + ' UV 应落 65 燃侧脸格(分面: 侧=正视木框火舌)');
    }
  }
  /* 熄灭态: 同通道分面落 66/67 */
  p = mkPack(1);
  p.set(8, 5, 8, t.B_CAMPFIRE_OUT);
  r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(r.solid, null, '熄灭态入集不走纯色兜底通道');
  assert.strictEqual(quads(r.atlas), 5, '熄灭态同款半格扁盒 5 面');
  const ys2 = new Set();
  for (let i = 1; i < r.atlas.positions.length; i += 3) ys2.add(r.atlas.positions[i]);
  assert.ok(ys2.has(5) && ys2.has(5.4375) && ys2.size === 2,
      '熄灭态扁盒高度=thin 0.4375, 实际 ' + [...ys2]);
  const outFaces = quadsByNormal(r.atlas);
  assert.ok(!outFaces.get('0,-1,0'), '熄灭态底面同样不绘');
  for (const vs of outFaces.get('0,1,0')) {
    assert.ok(inRect(t.TextureAtlas.tileUV(66), quadUVs(r.atlas, vs)),
        '熄灭态顶面 UV 应落 66 熄灶面格');
  }
  for (const nk of ['-1,0,0', '1,0,0', '0,0,-1', '0,0,1']) {
    for (const vs of outFaces.get(nk)) {
      assert.ok(inRect(t.TextureAtlas.tileUV(67), quadUVs(r.atlas, vs)),
          '熄灭态侧面 ' + nk + ' UV 应落 67 熄侧脸格');
    }
  }
});

test('篝火 meshChunk: 顶点光取自身格 — 燃烧态 light 15 夜面自亮/熄灭态暗块(UI 定稿 §4.5-2 程序面; 人眼夜辨归 T-C12)', () => {
  const t = loadAtlas();
  const p = mkPackL(1);
  p.set(8, 5, 8, t.B_CAMPFIRE);
  p.setL(8, 5, 8, 0, 15); /* 夜: sky 0; 光源格自身 block=15(light-core 光源格例外口径, T-C1 light 行) */
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(quads(r.atlas), 5, '燃烧态在图集通道(半格扁盒)');
  for (let i = 0; i < r.atlas.block.length; i++) {
    assert.strictEqual(r.atlas.block[i], 1, '燃烧态面顶点 block 光=15/15(夜间读作发光体)');
  }
  const q = mkPackL(1);
  q.set(8, 5, 8, t.B_CAMPFIRE_OUT);
  q.setL(8, 5, 8, 13, 0); /* 熄灭态零光(§4.5-2: 夜间读作暗块) */
  const r2 = t.MeshCore.meshChunk(q, atlasOpt(t));
  for (let i = 0; i < r2.atlas.block.length; i++) {
    assert.strictEqual(r2.atlas.block[i], 0, '熄灭态面顶点 block 光=0');
  }
});

/* ============ 篝火熄灭态顶点光(T-C8b 补丁): 面朝向邻格采样, ADR 0012 T4 同构 ============ */
/* SPEC-1 评审实证: 熄灭态 solid+opaque → mkPolicy 挡光格, 自身格 sky/block 恒 0,
   pushCampfireBox 旧径取自身格=五面全 0, 白昼近黑(灰烬斑/原木床不可见, 读作黑团)
   ——「认得出熄灭篝火→可重燃」可供性依赖白昼可见(design-lead 裁定 2026-11-16, 裁「修」)。
   取自身格对透光格(pushThin/pushBedBox 消费者)正确、对挡光格是语义错配;
   修法=T4 口径: 每面取面朝向邻格光(pushGateSign/ADR 0012 同构)。燃烧态零改动:
   光源格 mkPolicy 例外自身格 block=15, 取自身格语义正确(既有断言不回退)。 */
test('meshChunk: 篝火熄灭态顶点光取面朝向邻格 — 五面逐面各取朝向格(白昼上邻 sky 15 顶面高亮, T-C8b T4 同构)', () => {
  const t = loadAtlas();
  /* 白昼口径: 熄灭篝火 (8,5,8) 挡光格自身恒 0; 上邻露天天光 15(评审 SPEC-1 实测可用);
     四水平邻异值(13/6/0/5)——异值才能钉死「逐面各取朝向格」(同值分辨不出采样源) */
  const p = mkPackL(1);
  p.set(8, 5, 8, t.B_CAMPFIRE_OUT);
  p.setL(8, 5, 8, 0, 0); /* 自身格: 挡光格恒 0(旧径白昼近黑病灶) */
  p.setL(8, 6, 8, 15, 0); /* 上邻: 白昼露天天光 */
  p.setL(7, 5, 8, 13, 0); /* 西邻: 天光 13(T4 白天口径同款值) */
  p.setL(9, 5, 8, 6, 0); /* 东邻 */
  p.setL(8, 5, 7, 0, 0); /* 北邻: 无天光 */
  p.setL(8, 5, 9, 5, 0); /* 南邻 */
  const r = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.strictEqual(quads(r.atlas), 5, '熄灭态仍半格扁盒 5 面(几何零改动)');
  const byN = quadsByNormal(r.atlas);
  assert.ok(faceSkyEq(r.atlas, byN.get('0,1,0'), s15(15)),
      '顶面 sky=上邻格 15(白昼灰烬斑/原木床三档可辨), 不取自身格 0');
  assert.ok(faceSkyEq(r.atlas, byN.get('-1,0,0'), s15(13)), '西面 sky=西邻格 13');
  assert.ok(faceSkyEq(r.atlas, byN.get('1,0,0'), s15(6)), '东面 sky=东邻格 6');
  assert.ok(faceSkyEq(r.atlas, byN.get('0,0,-1'), s15(0)), '北面 sky=北邻格 0');
  assert.ok(faceSkyEq(r.atlas, byN.get('0,0,1'), s15(5)), '南面 sky=南邻格 5');
  /* block 通道同口径(T4 壁灯照牌同构): 邻格光源照熄灭篝火 → 对应面顶点跟随 */
  p.setL(7, 5, 8, 13, 14);
  const r3 = t.MeshCore.meshChunk(p, atlasOpt(t));
  assert.ok(faceBlkEq(r3.atlas, quadsByNormal(r3.atlas).get('-1,0,0'), s15(14)),
      '熄灭态西面 block=西邻格 14(邻光照灰烬, T4 口径双通道)');
});

test('meshChunk: 篝火两态取光口径不回退 — 熄灭态夜间全邻无光仍读暗块(§4.5-2), 燃烧态自亮仍取自身格(T-C8b 零改动锚)', () => {
  const t = loadAtlas();
  /* 夜间熄灭态: 五邻全 0 → 全面 0(design-lead 判据「夜间仍读暗块」程序面) */
  const p = mkPackL(1);
  p.set(8, 5, 8, t.B_CAMPFIRE_OUT);
  p.setL(8, 5, 8, 0, 0);
  let r = t.MeshCore.meshChunk(p, atlasOpt(t));
  for (let i = 0; i < r.atlas.sky.length; i++) {
    assert.strictEqual(r.atlas.sky[i], 0, '夜间熄灭态面顶点 sky=0(暗块不回退)');
  }
  for (let i = 0; i < r.atlas.block.length; i++) {
    assert.strictEqual(r.atlas.block[i], 0, '夜间熄灭态面顶点 block=0(暗块不回退)');
  }
  /* 燃烧态零改动锚: 取光分支只属熄灭态——自身格仍取自身(夜 sky 0/block 15),
     上邻白昼天光 15 不得渗入燃烧态任一通道 */
  const q = mkPackL(1);
  q.set(8, 5, 8, t.B_CAMPFIRE);
  q.setL(8, 5, 8, 0, 15); /* 光源格例外: block=15 自亮(T-C1 light 行) */
  q.setL(8, 6, 8, 15, 0); /* 上邻白昼天光(误改燃烧态=邻格采样即渗入, 此锚红) */
  r = t.MeshCore.meshChunk(q, atlasOpt(t));
  assert.strictEqual(quads(r.atlas), 5, '燃烧态仍半格扁盒 5 面');
  for (let i = 0; i < r.atlas.block.length; i++) {
    assert.strictEqual(r.atlas.block[i], 1, '燃烧态面顶点 block=15/15 自亮(既有锚原样)');
  }
  for (let i = 0; i < r.atlas.sky.length; i++) {
    assert.strictEqual(r.atlas.sky[i], 0, '燃烧态面顶点 sky=自身格 0(零改动: 邻格天光不渗入)');
  }
});
