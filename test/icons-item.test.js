'use strict';
/* 像素图标工坊·物品图标 (js/icons.js 的 itemIcon/iconOf) 单测 — node --test (零依赖)
   运行: node --test test/icons-item.test.js
   加载器: 同一 vm context 先执行 items-core.js 再执行 icons.js(镜像 index.html
   238→258 行的共享词法环境顺序); document/canvas 桩注入(mode-kit.test.js 先例,
   Node 无 DOM)。绘制本体在桩上验证形状: 桩 canvas 记录 fillRect 的颜色与格数。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const STUB_URL = 'data:image/png;base64,STUB';

/* 造一个会记账的 2D 上下文: _fills 收 [颜色,x,y,w,h], _texts 记 fillText 次数 */
function stubCtx() {
  return {
    _fills: [], _texts: 0, fillStyle: '',
    font: '', textAlign: '', textBaseline: '', imageSmoothingEnabled: true,
    fillRect(x, y, w, h) {
      this._fills.push([this.fillStyle, x, y, w, h]);
    },
    drawImage() {},
    fillText() {
      this._texts++;
    },
  };
}

function loadIcons() {
  const canvases = []; // 每次 createElement('canvas') 的画布桩(缓存断言数创建次数)
  const fakeDoc = {
    createElement() {
      const c = {width: 0, height: 0, ctx: stubCtx(),
        getContext() {
          return this.ctx;
        },
        toDataURL() {
          return STUB_URL;
        }};
      canvases.push(c);
      return c;
    },
    querySelector() {
      return null; // icons.js 尾部入口卡装配 IIFE 安全跳过(无 #cardTank)
    },
  };
  const ctx = vm.createContext({console, document: fakeDoc});
  vm.runInContext(read('items-core.js'), ctx, {filename: 'items-core.js'});
  vm.runInContext(read('icons.js'), ctx, {filename: 'icons.js'});
  vm.runInContext('globalThis.__i = {itemIcon, iconOf, ITEM_PIX, ITEMS, tankIcon};', ctx);
  return {h: ctx.__i, canvases};
}

/* 最近一次绘制的 16×16 画布(桩序列: [0]=小图 [1]=64 大图) */
function lastSmall(canvases) {
  return canvases[canvases.length - 2];
}

/* ============ 加载: 顶层接口 ============ */

test('加载: 顶层暴露 itemIcon/iconOf/ITEM_PIX, tankIcon 既有函数不受影响', () => {
  const {h} = loadIcons();
  assert.strictEqual(typeof h.itemIcon, 'function');
  assert.strictEqual(typeof h.iconOf, 'function');
  assert.strictEqual(typeof h.ITEMS, 'object');
  assert.strictEqual(typeof h.ITEM_PIX, 'object');
  assert.strictEqual(typeof h.tankIcon, 'function'); // 范围纪律: T8 不动既有图标
});

/* ============ 一期全量替换: 54 键覆盖防错网 ============ */

test('全量覆盖: ITEM_PIX 键集与 ITEMS 完全一致(以后加物品漏画图标当场红)', () => {
  const {h} = loadIcons();
  assert.deepStrictEqual(
      Object.keys(h.ITEM_PIX).sort(), Object.keys(h.ITEMS).sort());
});

test('全量出口: 每个 ITEMS 键 iconOf 返回 dataURL、itemIcon 返回 64×64 dataURL', () => {
  const {h, canvases} = loadIcons();
  for (const id of Object.keys(h.ITEMS)) {
    assert.ok(h.iconOf(id).startsWith('data:image/png'), id + ' iconOf 应为 dataURL');
    assert.strictEqual(h.itemIcon(id), STUB_URL, id + ' itemIcon');
  }
  // 每个图标都实际画了像素(每对小图/大图序列中的 16×16 小画布至少 20 格填充)
  for (let i = 0; i < canvases.length; i += 2) {
    assert.ok(canvases[i].ctx._fills.length >= 20, '像素画应大量填格');
  }
});

/* ============ 字符画数据形状(纯数据段, 不碰 canvas) ============ */

test('字符画形状: 每条 16 行×16 列, 非点字符都在色表内(手写行长防错网)', () => {
  const {h} = loadIcons();
  for (const [id, def] of Object.entries(h.ITEM_PIX)) {
    assert.strictEqual(def.art.length, 16, id + ' 行数');
    for (let y = 0; y < 16; y++) {
      const row = def.art[y];
      assert.strictEqual(row.length, 16, id + ' 第' + y + '行列数');
      for (const ch of row) {
        assert.ok(ch === '.' || def.map[ch], id + ' 字符 ' + ch + ' 未映射颜色');
      }
    }
  }
});

/* ============ 缓存: 同 id 只画一次 ============ */

test('缓存: 同 id 二次调用不再新建画布', () => {
  const {h, canvases} = loadIcons();
  h.itemIcon('coal');
  const n = canvases.length;
  h.itemIcon('coal');
  h.iconOf('coal'); // iconOf 有像素图时走同一缓存
  assert.strictEqual(canvases.length, n);
});

/* ============ 回落与未注册安全 ============ */

test('emoji 回落: 删掉像素图键后 iconOf 返 emoji 文本、itemIcon 转 emoji 渲染仍出图', () => {
  const {h, canvases} = loadIcons();
  delete h.ITEM_PIX.bow_item; // 模拟「未画像素图的已注册物品」
  assert.strictEqual(h.iconOf('bow_item'), h.ITEMS.bow_item.icon);
  assert.strictEqual(h.itemIcon('bow_item'), STUB_URL);
  const small = lastSmall(canvases);
  assert.strictEqual(small.ctx._texts, 1, 'emoji 应走 fillText 渲染');
  assert.strictEqual(small.ctx._fills.length, 0, 'emoji 渲染不应画像素格');
});

test('未注册 id: iconOf 返回空串、itemIcon 以 ? 兜底渲染不抛异常(永不空白)', () => {
  const {h, canvases} = loadIcons();
  assert.strictEqual(h.iconOf('no_such_item'), '');
  assert.strictEqual(h.itemIcon('no_such_item'), STUB_URL);
  assert.strictEqual(lastSmall(canvases).ctx._texts, 1, '? 兜底走文字渲染');
});

/* ============ 工具四阶色板: 与 held-item.js mkToolDef 同源 ============ */

test('工具色板: 木/石/铁/钻四阶基色出现在对应工具绘制(held-item 同源色)', () => {
  const {h, canvases} = loadIcons();
  const cases = {
    pick_wood: '#8a5a2b', pick_stone: '#8a8f98',
    pick_iron: '#d8dde4', pick_diamond: '#4ee1d2',
    axe_diamond: '#4ee1d2', sword_diamond: '#4ee1d2', shovel_diamond: '#4ee1d2',
  };
  for (const [id, want] of Object.entries(cases)) {
    h.itemIcon(id);
    const colors = lastSmall(canvases).ctx._fills.map((f) => f[0]);
    assert.ok(colors.includes(want), id + ' 应含基色 ' + want);
  }
});

/* ============ 生态地图件(冒险模式生态地图 T1): 共用形换色板 ============ */

test('生态地图件: 三花共用一张 FLOWER_ART 换三套色板; 雪球/冰复用 BALL/GLASS 既有形', () => {
  const {h} = loadIcons();
  assert.strictEqual(h.ITEM_PIX.orchid.art, h.ITEM_PIX.flower_y.art, '兰花与蒲公英共用字符画');
  assert.strictEqual(h.ITEM_PIX.flower_y.art, h.ITEM_PIX.flower_w.art, '蒲公英与雏菊共用字符画(FLOWER_ART)');
  assert.notStrictEqual(h.ITEM_PIX.orchid.map, h.ITEM_PIX.flower_y.map, '三花色板各异');
  assert.notStrictEqual(h.ITEM_PIX.flower_y.map, h.ITEM_PIX.flower_w.map);
  assert.strictEqual(h.ITEM_PIX.snowball.art, h.ITEM_PIX.clay_ball.art, '雪球复用 BALL_ART(黏土球同形)');
  assert.strictEqual(h.ITEM_PIX.ice.art, h.ITEM_PIX.glass.art, '冰复用 GLASS_ART(玻璃同形)');
  /* 色板走色: 雪球白 / 冰青蓝 — 三者主色互不相同(换板不是换键) */
  assert.strictEqual(h.ITEM_PIX.snowball.map.m, '#eceff2', '雪球白色板');
  assert.strictEqual(h.ITEM_PIX.ice.map.f, '#a8cbe8', '冰冰色板');
});
