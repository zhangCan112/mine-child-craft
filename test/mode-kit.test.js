'use strict';
/* ModeKit 单测 — node --test (零依赖)
   运行: node --test test/mode-kit.test.js
   mkHotbar 经 doc/mount 注入假 DOM; 引擎全局(pos/vel/yaw…)以属性占位注入 */
const test = require('node:test');
const assert = require('node:assert');
const ModeKit = require('../js/mode-kit.js');
const {mkMode, mkHotbar, confirmBtn, spawn} = ModeKit;

function fakeEl() {
  const el = {
    children: [], _cls: new Set(), style: {}, innerHTML: '', textContent: '',
    addEventListener() {}, appendChild(c) {
      this.children.push(c); return c;
    },
    querySelector(sel) {
      if (!this['q_' + sel]) this['q_' + sel] = fakeEl(); return this['q_' + sel];
    },
  };
  Object.defineProperty(el, 'classList', {value: {
    add: (c)=>el._cls.add(c), remove: (c)=>el._cls.delete(c),
    toggle: (c, v)=>{
      const on = (v === undefined) ? !el._cls.has(c) : v; if (on) el._cls.add(c); else el._cls.delete(c);
    },
    contains: (c)=>el._cls.has(c),
  }});
  return el;
}
const fakeDoc = {createElement: () => fakeEl()};

/* mode-kit 引用的自由变量 → 测试注入全局属性 (浏览器里来自 world.js/input.js) */
globalThis.pos = {set(x, y, z) {
  this.v = [x, y, z];
}};
globalThis.vel = {set(x, y, z) {
  this.v = [x, y, z];
}};
globalThis.yaw = 0; globalThis.pitch = 0; globalThis.onGround = true;
let pausedN = 0;
globalThis.uiPause = ()=>{
  pausedN++;
};
let touchList = 'unset';
globalThis.setTouchActions = (l)=>{
  touchList = l;
};

/* ============ hotbar 选块状态机 ============ */

test('hotbar: 数字键选块(1-based), 越界忽略', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}, {icon: 'b'}, {icon: 'c'}]});
  hb.show();
  assert.strictEqual(mount.children.length, 3);
  const mode = mkMode({id: 'x', hotbar: hb});
  mode.onDigit(2);
  assert.strictEqual(hb.sel, 1);
  mode.onDigit(9); // 越界 → 忽略
  assert.strictEqual(hb.sel, 1);
});

test('hotbar: 滚轮双向环绕', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}, {icon: 'b'}, {icon: 'c'}]});
  const mode = mkMode({id: 'x', hotbar: hb});
  mode.onWheel(1); mode.onWheel(1);
  assert.strictEqual(hb.sel, 2);
  mode.onWheel(1); // 2→0 环绕
  assert.strictEqual(hb.sel, 0);
  mode.onWheel(-1); // 0→2 反向环绕
  assert.strictEqual(hb.sel, 2);
});

test('hotbar: cnt 实时重读与 empty 态', () => {
  const mount = fakeEl();
  let n = 0;
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: '🧵', lbl: '引线', cnt: ()=>n}]});
  hb.show();
  const slot = mount.children[0];
  assert.ok(slot._cls.has('empty')); // 0 库存 → empty
  n = 5;
  hb.refresh();
  assert.strictEqual(slot['q_.cnt'].textContent, 5);
  assert.ok(!slot._cls.has('empty'));
});

/* ============ mkMode 默认行为 ============ */

test('KeyB 默认暂停(不转发), 其余键转发给模式', () => {
  const got = [];
  const mode = mkMode({id: 'x', onKey(code) {
    got.push(code);
  }});
  mode.onKey('KeyB');
  assert.strictEqual(pausedN, 1);
  assert.strictEqual(got.length, 0);
  mode.onKey('KeyR');
  assert.deepStrictEqual(got, ['KeyR']);
});

test('init: chrome 施加 + hotbar 现身 + touch 声明', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}]});
  const mode = mkMode({id: 'x', hotbar: hb, chrome: {hotbar: 'flex'}, touch: [{label: '⬆️'}], init() {}});
  mode.init();
  assert.strictEqual(mount.style.display, 'flex');
  assert.deepStrictEqual(touchList, [{label: '⬆️'}]);
});

test('init: 无声明的模式安全通过(Node 无 DOM, MK.* 为 null)', () => {
  const mode = mkMode({id: 'x', init() {}});
  mode.init();
  assert.strictEqual(touchList, null); // touch 缺省 → null 隐藏
});

/* ============ 出生点与 onVoidFall ============ */

test('spawn 记住出生点, 默认 onVoidFall 回到出生点', () => {
  spawn(11, 22, 33, {pitch: -0.22});
  assert.deepStrictEqual(pos.v, [11, 22, 33]);
  assert.deepStrictEqual(vel.v, [0, 0, 0]);
  assert.strictEqual(yaw, 0);
  assert.strictEqual(pitch, -0.22);
  assert.strictEqual(onGround, false);
  pos.v = [0, -99, 0]; // 模拟坠出世界
  mkMode({id: 'x'}).onVoidFall();
  assert.deepStrictEqual(pos.v, [11, 22, 33]);
});

test('自定义 onVoidFall 优先 (tnt 昏迷语义)', () => {
  let fell = false;
  mkMode({id: 'x', onVoidFall() {
    fell = true;
  }}).onVoidFall();
  assert.ok(fell);
});

/* ============ 二次确认按钮 ============ */

test('confirmBtn: 首点武装, 再点执行, 超时还原', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const btn = fakeEl();
  let done = 0;
  confirmBtn(btn, {label: '重置 ↺', confirm: '⚠ 确认', onConfirm() {
    done++;
  }});
  btn.onclick(); // 武装
  assert.strictEqual(btn.textContent, '⚠ 确认');
  assert.strictEqual(done, 0);
  btn.onclick(); // 执行
  assert.strictEqual(done, 1);
  assert.strictEqual(btn.textContent, '重置 ↺');
  btn.onclick(); // 再武装…
  t.mock.timers.tick(3000); // …超时还原
  assert.strictEqual(btn.textContent, '重置 ↺');
  btn.onclick(); btn.onclick(); // 超时后需重新武装两步
  assert.strictEqual(done, 2);
});
