'use strict';
/* 输入模块 (js/input.js) 单测 — node --test (零依赖)
   运行: node --test test/input.test.js
   形态镜像 test/adventure-mode.test.js: fake document/renderer 注入
   (replace-don't-layer), 触控手势核心用真件(vm 共享词法环境)。
   只测输入账本的生命周期兜底: keydown 记账 / keyup 清账 /
   窗口失焦全清(Alt+Tab 丢 keyup 的卡走修复) / 切后台全清 /
   指针锁丢失同拍全清 / 失焦收按住场(onHold(false) 无条件路由,
   探险连挖·建造连挖·下界连击的失焦自愈)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- fake 事件目标: 真收集监听器, 可回放事件 ---------- */
function mkTarget() {
  const ls = new Map();
  return {
    addEventListener(type, fn) {
      if (!ls.has(type)) ls.set(type, []);
      ls.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const a = ls.get(type);
      if (a) {
        const i = a.indexOf(fn);
        if (i >= 0) a.splice(i, 1);
      }
    },
    fire(type, ev) {
      for (const fn of [...(ls.get(type) || [])]) fn(ev || {});
    },
  };
}
const doc = mkTarget();
doc.pointerLockElement = null;
doc.hidden = false;
doc.getElementById = () => null;
doc.createElement = () => mkTarget();
const canvas = mkTarget();
const win = mkTarget();

const sandbox = {
  console: {log() {}, warn() {}, error() {}},
  performance: {now: () => 0},
  document: doc,
  renderer: {domElement: canvas},
  addEventListener: (t, f) => win.addEventListener(t, f), /* window 级监听(测试注入) */
  innerWidth: 1280, innerHeight: 720,
  IS_TOUCH: false,
  yaw: 0, pitch: 0, flyMode: false, /* voxel.js 顶层 let 占位(测试注入, input.js 调用期读写) */
  CameraRig: {holdAim() {}},
  showToast() {},
  Avatar: {swing() {}},
  raycastVoxel: () => null,
  PLAYER: {reach: 5},
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
const ROOT = path.join(__dirname, '..');
for (const f of ['js/touch-core.js', 'js/input.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
}
/* input.js 顶层 const/函数 → 同 context 再求值取引用(共享词法环境) */
const api = vm.runInContext('({keys, touchMove, Input})', ctx);

test('键盘账本: keydown 记账 / keyup 清账', () => {
  doc.fire('keydown', {code: 'KeyW'});
  assert.strictEqual(api.keys.KeyW, true, 'keydown 记账');
  doc.fire('keyup', {code: 'KeyW'});
  assert.strictEqual(api.keys.KeyW, false, 'keyup 清账');
});

test('失焦全清: blur 即清按键账本(Alt+Tab 丢 keyup 不再卡走)', () => {
  doc.fire('keydown', {code: 'KeyW'});
  doc.fire('keydown', {code: 'Space'});
  win.fire('blur');
  assert.strictEqual(api.keys.KeyW, false, 'W 卡键被清');
  assert.strictEqual(api.keys.Space, false, 'Space 卡键被清');
});

test('切后台全清: visibilitychange hidden 同拍清账', () => {
  doc.fire('keydown', {code: 'KeyA'});
  doc.hidden = true;
  doc.fire('visibilitychange');
  assert.strictEqual(api.keys.KeyA, false, '切后台清按键');
  doc.hidden = false;
});

test('指针锁丢失同拍全清: Esc/失焦解锁后按键与摇杆不残留', () => {
  doc.fire('keydown', {code: 'KeyD'});
  api.touchMove.x = 0.7; api.touchMove.y = -0.5; /* 模拟摇杆推着中丢事件 */
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  assert.strictEqual(api.keys.KeyD, false, '解锁清按键');
  assert.strictEqual(api.touchMove.x, 0, '解锁清摇杆 x');
  assert.strictEqual(api.touchMove.y, 0, '解锁清摇杆 y');
});

test('失焦收按住场: onHold(false) 无条件路由(模式连挖/连击自愈)', () => {
  const got = [];
  api.Input.route = {cur: {onHold: (a) => got.push(a)}};
  win.fire('blur');
  assert.deepStrictEqual(got, [false], '失焦通知当前模式收按住场');
  api.Input.route = null;
});

/* ============ Input 命名空间收口(评审候选 6): 键集与过渡别名 ============ */

test('Input 命名空间: 按钮声明与观感刷新三件挂进键集(正式名)', () => {
  assert.deepStrictEqual(Object.keys(api.Input).sort(),
      ['holdPt', 'icon', 'onLockChange', 'refreshMain', 'refreshUI', 'route', 'setActions'],
      '七件套: 原 seam 四件 + setActions/refreshUI/refreshMain');
  for (const k of ['setActions', 'refreshUI', 'refreshMain']) {
    assert.strictEqual(typeof api.Input[k], 'function', k + ' 应为函数成员');
  }
});

test('Input 命名空间: 旧散全局名仅剩 setTouchActions 过渡薄别名(refreshTouch* 已收口撤销)', () => {
  const alias = vm.runInContext(
      '({setTouchActions, hasUI: typeof refreshTouchUI, hasMain: typeof refreshTouchMain})', ctx);
  assert.strictEqual(typeof alias.setTouchActions, 'function',
      '过渡别名 setTouchActions 在位(math-build-world 仍经散全局名调用)');
  assert.strictEqual(alias.hasUI, 'undefined',
      'refreshTouchUI 已随消费方收口撤销(build.js 走 Input.refreshUI)');
  assert.strictEqual(alias.hasMain, 'undefined',
      'refreshTouchMain 已随消费方收口撤销(adventure.js 走 Input.refreshMain)');
});
