'use strict';
/* 按钮像素图标工坊 (js/button-icons.js) 单测 — node --test (零依赖)
   运行: node --test test/button-icons.test.js
   加载器: 同一 vm context 依次执行 items-core.js → icons.js →
   button-icons.js(镜像 index.html script 序的共享词法环境顺序);
   document/canvas 桩注入(icons-item.test.js 先例)。
   防错网: 扫 js/** 全部 icon:'…' / btnImg('…') / btnGlyph('…','…')
   字面量 ⊆ 工坊键集(漏登记即红) — audio-registry.test.js 同款口径。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const STUB_URL = 'data:image/png;base64,STUB';

/* 会记账的 2D 上下文桩(icons-item.test.js 同款) */
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

function loadButtonIcons() {
  const canvases = [];
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
      return null; /* 静态注入 IIFE 安全跳过(无 index.html DOM) */
    },
    querySelectorAll() {
      return [];
    },
  };
  const ctx = vm.createContext({console, document: fakeDoc});
  vm.runInContext(read('items-core.js'), ctx, {filename: 'items-core.js'});
  vm.runInContext(read('icons.js'), ctx, {filename: 'icons.js'});
  vm.runInContext(read('button-icons.js'), ctx, {filename: 'button-icons.js'});
  vm.runInContext('globalThis.__b = {btnIcon, btnImg, BTN_PIX, BTN_DELEGATE,' +
      ' BTN_CARD_ICON, itemIcon, tankIcon, ITEM_PIX};', ctx);
  return {h: ctx.__b, canvases};
}

/* ============ 加载: 顶层接口 ============ */

test('加载: 顶层暴露 btnIcon/btnImg/BTN_PIX/BTN_DELEGATE/BTN_CARD_ICON', () => {
  const {h} = loadButtonIcons();
  assert.strictEqual(typeof h.btnIcon, 'function');
  assert.strictEqual(typeof h.btnImg, 'function');
  assert.strictEqual(typeof h.BTN_PIX, 'object');
  assert.strictEqual(typeof h.BTN_DELEGATE, 'object');
  assert.strictEqual(typeof h.BTN_CARD_ICON, 'object');
});

/* ============ 字符画数据形状(手写行长防错网, 含几何派生四向) ============ */

test('字符画形状: 每条 16 行×16 列, 非点字符都在色表内(派生箭头一并受检)', () => {
  const {h} = loadButtonIcons();
  assert.ok(Object.keys(h.BTN_PIX).length >= 20, '键集规模 sanity');
  for (const [name, def] of Object.entries(h.BTN_PIX)) {
    assert.strictEqual(def.art.length, 16, name + ' 行数');
    for (let y = 0; y < 16; y++) {
      const row = def.art[y];
      assert.strictEqual(row.length, 16, name + ' 第' + y + '行列数');
      for (const ch of row) {
        assert.ok(ch === '.' || def.map[ch], name + ' 字符 ' + ch + ' 未映射颜色');
      }
    }
  }
});

test('派生箭头: left/right 是基画的几何变换(与基画像素数一致, 方向互为镜像)', () => {
  const {h} = loadButtonIcons();
  const count = (art) => art.join('').split('').filter((c) => c !== '.').length;
  const left = h.BTN_PIX.left.art;
  const right = h.BTN_PIX.right.art;
  assert.strictEqual(count(left), count(right), '左右箭头像素数一致');
  assert.deepStrictEqual(left, right.map((row) => [...row].reverse().join('')),
      'left = mirrorX(right)');
});

/* ============ 出口: dataURL / 缓存 / 未知安全 ============ */

test('全量出口: 每个键 btnIcon 返回 dataURL 且实际画了像素', () => {
  const {h, canvases} = loadButtonIcons();
  for (const name of Object.keys(h.BTN_PIX)) {
    assert.strictEqual(h.btnIcon(name), STUB_URL, name + ' 应出 dataURL');
  }
  // 每个手绘键至少画了 20 格(委托键不建画布)
  const hand = Object.keys(h.BTN_PIX).length;
  assert.strictEqual(canvases.length, hand * 2, '手绘键各建 16/64 两块画布');
  for (let i = 0; i < canvases.length; i += 2) {
    assert.ok(canvases[i].ctx._fills.length >= 20, '像素画应大量填格');
  }
});

test('委托单一来源: pick/shovel/table 等委托 itemIcon 同一物品图, tank 委托 tankIcon', () => {
  const {h} = loadButtonIcons();
  assert.strictEqual(h.btnIcon('pick'), h.itemIcon('pick_iron'));
  assert.strictEqual(h.btnIcon('shovel'), h.itemIcon('shovel_iron'));
  assert.strictEqual(h.btnIcon('bow'), h.itemIcon('bow_item'), 'bow 委托弓物品图(射箭专用键)');
  assert.strictEqual(h.btnIcon('table'), h.itemIcon('craft_table'));
  assert.strictEqual(h.btnIcon('chest'), h.itemIcon('chest'));
  assert.strictEqual(h.btnIcon('tank'), h.tankIcon());
  assert.strictEqual(Object.keys(h.BTN_DELEGATE).length, 11, '委托清单规模 sanity');
});

test('跨库委托防御: Mobs/chiefFace 未加载时 creeper/devil 返空串不抛异常', () => {
  const {h} = loadButtonIcons();
  assert.strictEqual(h.btnIcon('creeper'), '');
  assert.strictEqual(h.btnIcon('devil'), '');
});

test('未知名: btnIcon 返空串、btnImg 返空串(调用方自决兜底)', () => {
  const {h} = loadButtonIcons();
  assert.strictEqual(h.btnIcon('no_such_icon'), '');
  assert.strictEqual(h.btnImg('no_such_icon'), '');
});

test('缓存: 同名二次调用不再新建画布', () => {
  const {h, canvases} = loadButtonIcons();
  h.btnIcon('close');
  const n = canvases.length;
  h.btnIcon('close');
  h.btnImg('close');
  assert.strictEqual(canvases.length, n);
});

test('btnImg: img HTML 形状(class 可指定, draggable 关闭)', () => {
  const {h} = loadButtonIcons();
  const html = h.btnImg('close');
  assert.ok(html.startsWith('<img class="bi"'), '默认 class=bi');
  assert.ok(html.includes('src="' + STUB_URL + '"'), 'src 是 dataURL');
  assert.ok(html.includes('draggable="false"'));
  assert.ok(h.btnImg('flame', 'pic').startsWith('<img class="pic"'), '自定义 class');
});

test('模式卡键表: BTN_CARD_ICON 每个值都能出图(漏配键当场红)', () => {
  const {h} = loadButtonIcons();
  for (const [modeId, key] of Object.entries(h.BTN_CARD_ICON)) {
    assert.notStrictEqual(h.btnIcon(key), '', modeId + ' 卡图标键 ' + key + ' 应可出图');
  }
});

/* ============ 消费端防错网: 字面量键 ⊆ 工坊键集 ============ */

test('消费端防错网: js/** 的 icon:/btnImg/btnGlyph 字面量都在工坊键集内', () => {
  const {h} = loadButtonIcons();
  const names = new Set([...Object.keys(h.BTN_PIX), ...Object.keys(h.BTN_DELEGATE)]);
  const ROOT = path.join(__dirname, '..');
  const walk = (d) => {
    const out = [];
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) out.push(...walk(p));
      else if (p.endsWith('.js')) out.push(p);
    }
    return out;
  };
  const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
  /* 收网口径: 触屏动作表/KIT_TABS/BUILD_SCENES 的 icon:'键'、面板 btnImg('键')、
     input.js btnGlyph('元素id','键')、静态注入数组 ['sel','键'] — 全部字面量 */
  const patterns = [
    /\bicon:\s*'([a-z][a-z0-9_-]*)'/g,
    /\bbtnImg\(\s*'([a-z][a-z0-9_-]*)'/g,
    /\bbtnGlyph\(\s*'[a-zA-Z]+',\s*'([a-z][a-z0-9_-]*)'/g,
    /\[\s*'#[A-Za-z.\-]+',\s*'([a-z][a-z0-9_-]*)'\s*\]/g,
  ];
  const found = [];
  for (const p of walk(path.join(ROOT, 'js'))) {
    const src = fs.readFileSync(p, 'utf8');
    for (const re of patterns) {
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(src)) !== null) {
        found.push({where: rel(p) + ':' + src.slice(0, m.index).split('\n').length, name: m[1]});
      }
    }
  }
  assert.ok(found.length >= 25, '扫描应命中足量字面量(当前 ' + found.length + '), 正则失效即红');
  const bad = found.filter((f) => !names.has(f.name));
  assert.deepStrictEqual(bad.map((f) => f.where + ' → ' + f.name), [],
      '未登记的按钮图标键(在 button-icons.js 的 BTN_PIX/BTN_DELEGATE 补登记)');
});
