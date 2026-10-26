'use strict';
/* 浏览器引导链冒烟测试 — node --test (零依赖)
   运行: node --test test/boot.test.js
   为什么存在: 经典 <script> 共享同一个全局词法环境, 两个模式文件
   各自顶层 const 同名(如 mobs)会让后者解析即炸, 页面卡在加载页 —
   Node 单测按 CommonJS 模块作用域加载永远发现不了。
   本测试按 index.html 的真实顺序在共享 vm context 里执行全部脚本
   (lib/ 除外: 真 THREE 需要 WebGL, 以全放行桩代之), 任何解析/顶层
   执行错误在这里原样复现。
   覆盖面: ① 全脚本依序加载无错 ② MODES 影子清单上锁 — 键集与模式
   注册表等价 / 每键是对象且 init 可调 / 训练营(focus/math)预算契约 /
   switchMode 全 id 不抛且 MODES.cur 落位。注册表加行漏改 main.js 手写
   的 MODES, 在②当场红, 而不是等孩子点新卡炸 undefined.init()(boot 只
   默认进 arena, 探测不到其余六键)。源文本静态防线在
   test/mode-registry.test.js — 双道防线, 任一被误删另一道仍守。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ModeRegistry = require('../js/mode-registry.js'); /* 纯数据文件, Node 可直载 */

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

/* 引导一次, 全部 test 共享同一 vm context(经典脚本共享词法环境的忠实
   复刻; 同文件内 test 按声明序同步执行, 有状态探针放最后一个 test,
   重建战场后不再恢复现场 — test 进程即退出) */
let CACHED_CTX = null;
function boot() {
  if (CACHED_CTX) return CACHED_CTX;
  const ROOT = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)]
      .map((m) => m[1]).filter((s) => !s.startsWith('lib/'));

  /* localStorage 最小真件(内存): sync.js 双写与 daily-budget 迁移都走它;
     缺了这个全局, sync.js 里 try/catch 会把 ReferenceError 静默吞成
     "离线降级", 探针测不到真实链路 — 修桩不修断言 */
  const mem = new Map();
  const sandbox = {
    console: {log() {}, warn() {}, error() {}}, /* 静默桩噪声, 保留真错误 */
    performance: {now: () => 0},
    requestAnimationFrame() {}, fetch: () => Promise.resolve({ok: true, json: () => Promise.resolve({})}),
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    },
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
  CACHED_CTX = ctx;
  return ctx;
}

test('引导链: index.html 全部脚本在共享词法环境依序加载无错', () => {
  const ctx = boot();
  /* 引导完成探针: 组合根的 MODES 应已注册坦克模式(共享词法可跨脚本读取) */
  const probe = vm.runInContext('typeof MODES !== "undefined" && MODES.tank ? "ok" : "missing"', ctx);
  assert.strictEqual(probe, 'ok', 'main.js 组合根应注册 tank 模式');
  /* T1 接线骨架: 数学冒险岛(MathMode)与专注训练营同款走组合根注册 */
  const probeMath = vm.runInContext('typeof MODES !== "undefined" && MODES.math ? "ok" : "missing"', ctx);
  assert.strictEqual(probeMath, 'ok', 'main.js 组合根应注册 math 模式(数学冒险岛)');
});

test('MODES 影子清单: 键集与模式注册表等价, 每键是对象且 init 可调', () => {
  const ctx = boot();
  /* main.js 手写 const MODES 是注册表外仅存的影子清单(d6fa3c0 合一因
     技术限制保留: 模式对象是经典 script 顶层 const, 纯数据 registry
     反射不到)。漏一行动作链: 本探针之前无任何断言能红 → 用户点新卡 →
     main.js switchMode 里 undefined.init() TypeError — 这里把"漏行"从
     孩子点卡时提前到 CI */
  const vmKeys = vm.runInContext(
      'Object.keys(MODES).filter((k) => k !== "cur").sort()', ctx);
  const regIds = ModeRegistry.all.map((m) => m.id).sort();
  /* 跨 realm 数组先展开再 deepStrictEqual(vm 数组原型属 vm realm) */
  assert.deepStrictEqual([...vmKeys], [...regIds],
      'MODES 键集应与注册表 id 集一致(漏键=点卡 TypeError, 多键=影子滋生)');
  const broken = vm.runInContext(
      'Object.keys(MODES).filter((k) => k !== "cur")' +
      '.filter((k) => !(MODES[k] && typeof MODES[k] === "object" &&' +
      ' typeof MODES[k].init === "function"))', ctx);
  assert.deepStrictEqual([...broken], [],
      'MODES 每键须为对象且 init 可调(switchMode 对全 id 都会调 init)');
});

test('训练营预算契约: 注册表 !gated 的每个 id 在 Budgets 有可入账/落账/判满的预算', () => {
  const ctx = boot();
  /* focus/math 的每日预算靠 main.js setupBudgets 手写 defs, 漏写一条
     不会报错: camp-kit 的 ticker 拿到 null 静默不入账、入口锁永假
     (不限量) — 静默降级。按真实消费面(camp-kit 壳的 accrue/flush/
     blocked)断言最小充分集。vm 里 SyncDB.ready 的 then 挂在微任务,
     同步探针不等它, 自己建账(幂等, 之后微任务再建一次无害)。
     dev 行(体验馆)不入此契约: 调试不吃孩子的账(spec 用户故事 15),
     不建预算账本 — 组合口径 gated:false + dev:true = 只借「不进儿童
     时限」的调试模式(区别于训练营类, 见 mode-registry.js 头注释),
     训练营清单以 !m.dev 剔除 dev 行 */
  assert.doesNotThrow(() => vm.runInContext('setupBudgets()', ctx),
      'setupBudgets 应可在桩环境完整建账');
  const camps = ModeRegistry.all.filter((m) => !m.gated && !m.dev).map((m) => m.id);
  assert.ok(camps.length > 0, '注册表应含训练营类模式(!gated)');
  const bad = vm.runInContext(
      '(' + JSON.stringify(camps) + ').filter((id) => {' +
      ' const b = Budgets && Budgets[id];' +
      ' return !b || ["accrue", "flush", "blocked"]' +
      '   .some((f) => typeof b[f] !== "function");' +
      '})', ctx);
  assert.deepStrictEqual([...bad], [],
      '训练营预算漏写只会静默降级(不入账+不限量), 这里必须红');
});

test('关页兜底存档接线: main.js pagehide 分发 + mkMode 白名单透传可达', () => {
  const ctx = boot();
  /* 2026-10 探险树苗丢档修复的接线防线: 世界档 5s 节流窗口内直接关页,
     最后几秒的世界改动(树苗/挖掘/水位)靠 pagehide 同步落盘兜底。
     双道断言: 源文本静态(main.js 真挂了监听且分发给当前模式——addEventListener
     是空桩收不到事件, 只能静态扫) + 行为(mkMode 白名单透传后 adventure/build
     两模式的钩子在组合根真实可达——漏登记 mode-kit 白名单时此处红) */
  const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
  assert.ok(/addEventListener\('pagehide'/.test(mainSrc), 'main.js 应挂 pagehide 兜底监听');
  assert.ok(mainSrc.indexOf('MODES.cur.onPageHide') >= 0, 'pagehide 应分发给 MODES.cur.onPageHide');
  assert.strictEqual(vm.runInContext('typeof MODES.adventure.onPageHide', ctx), 'function',
      'adventure 的 onPageHide 经 mkMode 白名单透传可达');
  assert.strictEqual(vm.runInContext('typeof MODES.build.onPageHide', ctx), 'function',
      'build 的 onPageHide 经 mkMode 白名单透传可达(build 同为 5s 节流世界档)');
});

test('switchMode 全 id 不抛: 注册表每个模式可切换且 MODES.cur 落位(尾探针, 不恢复现场)', () => {
  const ctx = boot();
  /* 全链: 离场落账(Budgets.play.flush, 上一个 test 已建账) →
     cur.cleanup() → Fx.clear() → clearWorld() → 新模式 init() →
     AudioMixer.setMood()。boot 顶层只自然跑过 switchMode('arena'),
     其余六模式的 init 与 arena 的 cleanup 全链只有这里走到; 桩环境若
     缺囗, 修桩(本文件 sandbox)不修断言。放最后一个 test: init 会重建
     战场/重挂 UI, 之后 test 进程即退出, 不必恢复现场 */
  for (const id of ModeRegistry.all.map((m) => m.id)) {
    assert.doesNotThrow(
        () => vm.runInContext('switchMode(' + JSON.stringify(id) + ')', ctx),
        'switchMode(' + id + ') 全链应不抛');
    assert.strictEqual(vm.runInContext('MODES.cur && MODES.cur.id', ctx), id,
        id + ' 切换后 MODES.cur 应落位');
  }
});
