'use strict';
/* 世界轨宿主纪律守门 — node --test (零依赖)
   运行: node --test test/math-track.test.js
   对应模块: 现阶段守两个世界宿主(js/math-world.js · js/math-build-world.js)
   的退出纪律; T4 世界轨驱动器(js/math-track.js, 术语见 GLOSSARY「世界轨
   驱动器」)落地后, 本文件扩充为驱动器的装配纪律测试(装场/清场/单节离场
   vs 整链中止/boss 串序/onTrial 契约/变体分发单一权威) — 命名偏差按
   conventions §1.9 存量惯例在此登记。
   覆盖(T1): 场景装填纪律「进场装场 · 退出清场」在两宿主上的守门 —
   · 摆与搭(指针锁宿主) stop() 必须触发 clearWorld(T1 缺陷修复: 原实现
     只 display='none', 3D 残场挂到下一次装场), 重复 stop 幂等不再二次清场;
     收尾同时缴触屏键 setTouchActions(null) + 收材料热栏 + 不触发 end
   · hop(混合宿主) stop()=teardown 既有清场行为上锁(防回归)
   加载器: vm context 依次执行 math-levels → math-puzzles-core →
   math-build-world-core → hop-world-core → math-paradigms → math-world →
   math-build-world(镜像 index.html 共享词法环境相对序); 世界/渲染依赖以
   记录桩注入(loadScene 直跑 buildFn/clearWorld 计数/SceneKit·setBlockRaw
   置空/THREE 贴片最小桩/mkHotbar·ModeKit 桩 — math-paradigms.test.js 同款
   分层口径: 判分与出题走真件, 观感与场景装配走桩) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ============ 假 DOM / 桩 ============ */

function mkFakeEl(els) {
  const el = {
    _cls: new Set(),
    className: '',
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    children: [],
    onclick: null,
    classList: {
      add(...cs) {
        cs.forEach((c) => el._cls.add(c));
      },
      remove(...cs) {
        cs.forEach((c) => el._cls.delete(c));
      },
      toggle(c, f) {
        if (f === undefined) {
          if (el._cls.has(c)) el._cls.delete(c);
          else el._cls.add(c);
        } else if (f) el._cls.add(c);
        else el._cls.delete(c);
      },
      contains(c) {
        return el._cls.has(c);
      },
    },
    appendChild(c) {
      el.children.push(c);
      return c;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return mkFakeEl(els);
    },
    querySelectorAll() {
      return [];
    },
    remove() {},
  };
  els.push(el);
  return el;
}

/* 数字贴片(mWNumSprite)与图纸画布(canvas.getContext('2d'))的最小 2D 桩 */
const CTX_2D = {
  font: '', textAlign: '', textBaseline: '', lineWidth: 0,
  strokeStyle: '', fillStyle: '',
  strokeText() {}, fillText() {}, fillRect() {}, clearRect() {},
};
function mkFakeCanvas(els) {
  const cv = {width: 0, height: 0, style: {}, getContext: () => CTX_2D};
  els.push(cv);
  return cv;
}

/* THREE 贴片最小桩: canvas → CanvasTexture → Sprite 管线(mkHpBar 头注释
   同款惰性观感, Node 无渲染环境只求不断链) */
const THREE_STUB = {
  CanvasTexture: function(cv) {
    this.image = cv;
    this.dispose = () => {};
  },
  SpriteMaterial: function(o) {
    this.map = o.map;
    this.dispose = () => {};
  },
  Sprite: function(mat) {
    this.material = mat;
    this.scale = {set() {}};
    this.position = {set() {}};
  },
};

function loadTrackHosts() {
  const els = [];
  const byId = new Map();
  const clearCalls = [];
  const touchLog = [];
  const hbLog = [];
  const spoken = [];
  const timers = [];
  const rafQueue = [];
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const sandbox = {
    console: {warn() {}, log() {}, error() {}},
    Math: Object.assign(Object.create(Math), {random: rand}),
    JSON, Object, Array, Set, Map, Number, Date, String, RegExp,
    performance: {now: () => 0},
    setTimeout(fn) {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {},
    requestAnimationFrame(fn) {
      rafQueue.push(fn); // 只记不跑: 走子 rAF 循环由浏览器驱动
      return rafQueue.length;
    },
    cancelAnimationFrame() {},
    document: {
      createElement: (tag) => (tag === 'canvas' ? mkFakeCanvas(els) : mkFakeEl(els)),
      getElementById(id) {
        if (!byId.has(id)) byId.set(id, mkFakeEl(els));
        return byId.get(id);
      },
      body: {appendChild() {}},
    },
    SpeechKit: {speak: (s) => spoken.push(s), cancel() {}},
    sfx() {},
    showToast() {},
    mcIcon: (n) => 'data:mc:' + n,
    /* 热栏桩: 记 show/hide 供收尾断言 */
    mkHotbar: () => ({sel: 0,
      show() {
        hbLog.push('show');
      },
      hide() {
        hbLog.push('hide');
      },
      select() {}, refresh() {}, render() {}}),
    ModeKit: {spawn() {}},
    SceneKit: {fill() {}, tree() {}, scatter() {}},
    /* 装场 seam 桩: loadScene 直跑 buildFn(装场记账走 setBlockRaw 计数即可) */
    loadScene(fn) {
      if (fn) fn();
    },
    clearWorld() {
      clearCalls.push(clearCalls.length + 1);
    },
    setBlockRaw() {},
    getBlock: () => 0,
    editBlock() {},
    collidesAtPlayer: () => false,
    requestLock() {},
    setTouchActions: (l) => touchLog.push(l),
    aimClick() {},
    scene: {add() {}, remove() {}},
    camera: {},
    /* voxel.js 玩家状态(调用期解析的全局, 桩成可写绑定) */
    pos: {set() {}, x: 64, y: 30, z: 64},
    vel: {set() {}, x: 0, y: 0, z: 0},
    yaw: 0, pitch: 0, onGround: true, flyMode: false,
    innerWidth: 800, innerHeight: 600,
    THREE: THREE_STUB,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['math-levels.js', 'math-puzzles-core.js', 'math-build-world-core.js',
    'hop-world-core.js', 'math-paradigms.js', 'math-world.js', 'math-build-world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__t = { runHopWorld, runBuildWorld, mathParamsFor };
  `, ctx);
  return {t: sandbox.__t, clearCalls, touchLog, hbLog, spoken, timers, rafQueue};
}

/* 造一节(section): params 来自 mathParamsFor 再覆写 trials(与屏流测试同款) */
function sec(t, family, variant, tier, over) {
  const p = Object.assign(t.mathParamsFor(family, tier), {trials: 2}, over || {});
  return {family, variant, tier, params: p, seed: 42};
}

/* ============ T1 守门: 退出清场纪律 ============ */

test('摆与搭世界轨: stop() 触发 clearWorld 退出清场, 重复 stop 幂等(T1 缺陷修复)', () => {
  const d = loadTrackHosts();
  const ends = [];
  const h = d.t.runBuildWorld(sec(d.t, 'mirror', 'reflect', 1),
      {onTrial() {}, end: (st) => ends.push(st)});
  assert.ok(h && typeof h.stop === 'function' && typeof h.onMouse === 'function',
      '返回 {stop(), onMouse} 控制柄');
  assert.strictEqual(d.clearCalls.length, 0, '进场装场后、退出前不得清场');
  assert.ok(d.hbLog.includes('show'), 'place 试次装场亮出材料热栏(前置确认装场已发生)');
  h.stop();
  assert.strictEqual(d.clearCalls.length, 1, 'stop() 退出清场恰一次(场景装填纪律)');
  assert.strictEqual(d.touchLog[d.touchLog.length - 1], null, '收尾缴械触屏键 setTouchActions(null)');
  assert.ok(d.hbLog.includes('hide'), '收尾收起材料热栏');
  assert.strictEqual(ends.length, 0, 'stop() 是中止不是结算: 不得触发 end');
  h.stop();
  assert.strictEqual(d.clearCalls.length, 1, '重复 stop 幂等: 不二次清场(hop teardown 同款)');
});

test('hop 世界轨: stop()=teardown 触发 clearWorld 退出清场(既有纪律上锁)', () => {
  const d = loadTrackHosts();
  const ends = [];
  const h = d.t.runHopWorld(sec(d.t, 'hop', 'dice', 1),
      {onTrial() {}, end: (st) => ends.push(st)});
  assert.ok(h && typeof h.stop === 'function', '返回 {stop} 控制柄');
  assert.strictEqual(d.clearCalls.length, 0, '进场装场后、退出前不得清场');
  assert.ok(d.rafQueue.length >= 1, '混合宿主起场挂自持 rAF(前置确认起场已发生)');
  h.stop();
  assert.strictEqual(d.clearCalls.length, 1, 'teardown 退出清场恰一次(场景装填纪律)');
  assert.strictEqual(ends.length, 0, 'stop() 是中止不是结算: 不得触发 end');
  h.stop();
  assert.strictEqual(d.clearCalls.length, 1, '重复 stop 幂等');
});
