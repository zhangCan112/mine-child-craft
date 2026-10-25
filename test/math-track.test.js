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
   覆盖(T4): 世界轨驱动器(js/math-track.js, MathTrack)的装配纪律 —
   · run 单节「清完再发 end」: 离场(stop)先于消费方结算(end), 单一时间线断言
   · leave/stop: 收当前节+复明 DOM+幂等; mouse 路由活动节; 中止不结算
   · runBoss: 小节顺序接力(400ms) + 聚合按单关口径 + 整链中止(alive 旗)
     不复活 — 假世界 runner 注入注册表(只发生在测试沙箱)
   加载器: vm context 依次执行 rand-core → math-levels → math-puzzles-core →
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
    mathRoot: {style: {display: 'none'}}, /* 驱动器离场复明 DOM 屏(math-track.js) */
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
  for (const f of ['rand-core.js', 'math-levels.js', 'math-puzzles-core.js', 'math-build-world-core.js',
    'hop-world-core.js', 'math-track-core.js', 'math-paradigms.js', 'math-world.js',
    'math-build-world.js', 'math-track.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__t = { runHopWorld, runBuildWorld, mathParamsFor, MathTrack };
  `, ctx);
  return {t: sandbox.__t, sandbox, clearCalls, touchLog, hbLog, spoken, timers, rafQueue,
    flush(max) {
      let n = 0;
      while (timers.length && n < (max || 400)) {
        timers.shift()();
        n++;
      }
      return n;
    }};
}

/* 假世界 runner 注入(驱动器纪律测试用): 记录启停/事件序, 首计时器即结算 —
   注册表对象可变(const 绑定不改), 注入只发生在测试沙箱内 */
function injectFakeRunner(d, key, stats) {
  vm.runInContext(`
    globalThis.__fake = globalThis.__fake || {runs: [], stops: [], mice: []};
    MATH_WORLD_RUNNERS[${JSON.stringify(key)}] = function (section, h) {
      globalThis.__fake.runs.push({family: section.family, variant: section.variant,
        seed: section.seed, kind: section.kind});
      if (h.progress) h.progress(1, 1);
      let stopped = false; /* 忠实契约: stop() 是中止, 残留计时器不得再结算(真引擎 T.stop 同款) */
      setTimeout(() => {
        if (!stopped) h.end(${JSON.stringify(stats)});
      }, 0);
      return {
        stop() {
          stopped = true;
          globalThis.__fake.stops.push(${JSON.stringify(key)});
          if (globalThis.__tl) globalThis.__tl.push('stop');
        },
        onMouse(b) {
          globalThis.__fake.mice.push(b);
        },
      };
    };
  `, d.sandbox);
  return d.sandbox.__fake;
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

/* ============ T4 驱动器纪律: 时序 / 生命周期 / boss 串链 ============ */

test('驱动器 run: 清完再发 end — 世界节的离场(stop)先于消费方结算(end)', () => {
  const d = loadTrackHosts();
  const fake = injectFakeRunner(d, 'hop/dice', {trials: 2, correct: 2, acc: 1, maxStreakErr: 0});
  const tl = []; /* 单一时间线: stop(驱动器离场)与 end(消费方结算)的先后 */
  d.sandbox.__tl = tl;
  const ends = [];
  const h = d.t.MathTrack.run({family: 'hop', variant: 'dice', tier: 1,
    params: {trials: 2}, seed: 42}, null, {
    end(st) {
      tl.push('end');
      ends.push(st);
    },
  });
  assert.ok(h && typeof h.stop === 'function', '单节返回控制柄');
  assert.strictEqual(d.t.MathTrack.active(), true, '节进行中 active()=true');
  assert.strictEqual(fake.runs.length, 1, '世界 runner 已启动');
  d.flush(); /* 驱动假 runner 的结算计时器 */
  assert.deepStrictEqual(tl, ['stop', 'end'], '清完再发: 驱动器离场(stop)先于结算(end)');
  assert.strictEqual(fake.stops.length, 1, 'stop 恰一次(离场收口不再依赖调用方补刀)');
  assert.strictEqual(d.t.MathTrack.active(), false, '结算后 active()=false');
  assert.strictEqual(ends.length, 1, '结算参数原样透传');
  d.t.MathTrack.leave();
  assert.strictEqual(fake.stops.length, 1, '结算后再 leave 幂等(不二次 stop)');
});

test('驱动器 leave/stop: 收当前节并复明 DOM; mouse 路由到活动节; 中止不结算', () => {
  const d = loadTrackHosts();
  const fake = injectFakeRunner(d, 'mirror/reflect', {trials: 1, correct: 1, acc: 1, maxStreakErr: 0});
  const ends = [];
  d.t.MathTrack.run({family: 'mirror', variant: 'reflect', tier: 1,
    params: {trials: 1}, seed: 42}, null, {end: (st) => ends.push(st)});
  d.t.MathTrack.mouse(0, {x: 1, y: 2, z: 3});
  assert.deepStrictEqual([...fake.mice], [0], '活动节的 onMouse 被路由');
  d.t.MathTrack.leave();
  assert.deepStrictEqual([...fake.stops], ['mirror/reflect'], 'leave 收当前节');
  assert.strictEqual(d.t.MathTrack.active(), false, 'leave 后无活动节');
  assert.strictEqual(d.sandbox.mathRoot.style.display, 'block', '离场复明 DOM 屏');
  d.t.MathTrack.mouse(0, null);
  assert.strictEqual(fake.mice.length, 1, '无活动节时点选空转');
  d.t.MathTrack.leave();
  assert.strictEqual(fake.stops.length, 1, '重复 leave 幂等');
  /* stop 路线: 再开一节, stop 整链一刀且不结算 */
  d.t.MathTrack.run({family: 'mirror', variant: 'reflect', tier: 1,
    params: {trials: 1}, seed: 43}, null, {end: (st) => ends.push(st)});
  d.t.MathTrack.stop();
  assert.strictEqual(fake.stops.length, 2, 'stop 收当前节');
  assert.strictEqual(ends.length, 0, 'stop 是中止: 不触发 end(与屏流引擎同口径)');
  d.flush();
  assert.strictEqual(ends.length, 0, '中止后残留计时器不复活结算');
});

test('驱动器 runBoss: 小节顺序接力 + 聚合按单关口径 + 整链中止不复活', () => {
  const d = loadTrackHosts();
  const fake = injectFakeRunner(d, 'mirror/reflect', {trials: 2, correct: 2, acc: 1, maxStreakErr: 1});
  injectFakeRunner(d, 'hop/dice', {trials: 3, correct: 1, acc: 1 / 3, maxStreakErr: 2});
  const ends = [];
  const spoken = [];
  const prog = [];
  const level = {i: 7, sections: [
    {family: 'mirror', variant: 'reflect', tier: 1, params: {trials: 2}},
    {family: 'hop', variant: 'dice', tier: 1, params: {trials: 3}},
    {family: 'mirror', variant: 'reflect', tier: 1, params: {trials: 2}},
  ]};
  d.t.MathTrack.runBoss(level, null, {
    progress(k, n) {
      prog.push(k + '/' + n);
    },
    end(st) {
      ends.push(st);
    },
    speak(l) {
      spoken.push(l);
    },
  });
  assert.strictEqual(fake.runs.length, 1, '首小节立即启动(链头同步)');
  d.flush();
  assert.strictEqual(fake.runs.length, 3, '400ms 接力三小节全跑');
  assert.deepStrictEqual([...fake.runs.map((r) => r.family + '/' + r.variant)],
      ['mirror/reflect', 'hop/dice', 'mirror/reflect'], '按 plan 顺序');
  assert.ok(fake.runs.every((r) => r.kind === 'challenge' && typeof r.seed === 'number'),
      '小节带 challenge 标记与派生 seed');
  assert.strictEqual(spoken.length, 3, '每小节一句新挑战话术');
  assert.strictEqual(fake.stops.length, 3, '每小节 end 前驱动器各离场一次(清完再发)');
  assert.strictEqual(ends.length, 1, '链尾聚合结算恰一次');
  assert.deepStrictEqual({...ends[0]}, {trials: 7, correct: 5, acc: 5 / 7, maxStreakErr: 2},
      '聚合按单关口径: 求和/重算 acc/取最大连错');
  assert.deepStrictEqual(prog, ['1/7', '3/7', '6/7'], '进度按累计试次(前节结余+节内 k)');
  /* 整链中止: 首节结算后 stop, 余下小节不复活 */
  const fake2 = injectFakeRunner2(d, 'plan/pick', {trials: 1, correct: 1, acc: 1, maxStreakErr: 0});
  const ends2 = [];
  d.t.MathTrack.runBoss({i: 8, sections: [
    {family: 'plan', variant: 'pick', tier: 1, params: {trials: 1}},
    {family: 'plan', variant: 'pick', tier: 1, params: {trials: 1}},
  ]}, null, {end: (st) => ends2.push(st)});
  d.flush(1); /* 只放首节的结算计时器: 小节已 end、接力计时器刚入队 */
  d.t.MathTrack.stop();
  d.flush();
  assert.strictEqual(fake2.runs.length, 1, '中止后第二节不再启动(alive 旗掐死接力)');
  assert.strictEqual(ends2.length, 0, '整链中止不触发聚合结算');
});

/* 同款注入的第二注册表键(独立记录器, 供中止用例分辨小节数) */
function injectFakeRunner2(d, key, stats) {
  vm.runInContext(`
    globalThis.__fake2 = globalThis.__fake2 || {runs: []};
    MATH_WORLD_RUNNERS[${JSON.stringify(key)}] = function (section, h) {
      globalThis.__fake2.runs.push(1);
      setTimeout(() => h.end(${JSON.stringify(stats)}), 0);
      return {stop() {}};
    };
  `, d.sandbox);
  return d.sandbox.__fake2;
}
