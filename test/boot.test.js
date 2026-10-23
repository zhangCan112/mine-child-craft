'use strict';
/* 浏览器引导链冒烟测试 — node --test (零依赖)
   运行: node --test test/boot.test.js
   为什么存在: 经典 <script> 共享同一个全局词法环境, 两个模式文件
   各自顶层 const 同名(如 mobs)会让后者解析即炸, 页面卡在加载页 —
   Node 单测按 CommonJS 模块作用域加载永远发现不了。
   本测试按 index.html 的真实顺序在共享 vm context 里执行全部脚本
   (lib/ 除外: 真 THREE 需要 WebGL, 以全放行桩代之), 任何解析/顶层
   执行错误在这里原样复现。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* 全放行桩: 任意属性/调用/构造都返回自身, 只让"真错误"(重名/未声明/
   逻辑抛错)浮出来, 不被缺 DOM/THREE 噪声淹没 */
function mkAny() {
  const f = function() {
    return any;
  };
  const any = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '{}';
      if (k === Symbol.iterator) {
        return function() {
          return {next: () => ({done: true, value: any})};
        };
      }
      return any;
    },
    set() {
      return true;
    },
    apply() {
      return any;
    },
    construct() {
      return any;
    },
    has() {
      return true;
    },
  });
  return any;
}

test('引导链: index.html 全部脚本在共享词法环境依序加载无错', () => {
  const ROOT = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)]
      .map((m) => m[1]).filter((s) => !s.startsWith('lib/'));

  const sandbox = {
    console: {log() {}, warn() {}, error() {}}, /* 静默桩噪声, 保留真错误 */
    performance: {now: () => 0},
    requestAnimationFrame() {}, fetch: () => Promise.resolve({ok: true, json: () => Promise.resolve({})}),
    setTimeout, clearTimeout, setInterval, clearInterval,
    THREE: mkAny(), document: mkAny(), navigator: {maxTouchPoints: 0},
    location: {protocol: 'file:'}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {},
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);

  assert.ok(srcs.length >= 20, '脚本清单解析正常: ' + srcs.length + ' 个');
  for (const src of srcs) {
    const full = path.join(ROOT, src);
    const code = fs.readFileSync(full, 'utf8');
    assert.doesNotThrow(()=>{
      vm.runInContext(code, ctx, {filename: src});
    }, '脚本应可加载: ' + src + '(顶层重名/未声明引用都会在此暴露)');
  }

  /* 引导完成探针: 组合根的 MODES 应已注册坦克模式(共享词法可跨脚本读取) */
  const probe = vm.runInContext('typeof MODES !== "undefined" && MODES.tank ? "ok" : "missing"', ctx);
  assert.strictEqual(probe, 'ok', 'main.js 组合根应注册 tank 模式');
  /* T1 接线骨架: 数学冒险岛(MathMode)与专注训练营同款走组合根注册 */
  const probeMath = vm.runInContext('typeof MODES !== "undefined" && MODES.math ? "ok" : "missing"', ctx);
  assert.strictEqual(probeMath, 'ok', 'main.js 组合根应注册 math 模式(数学冒险岛)');
});
