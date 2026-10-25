'use strict';
/* 数学世界轨走子行为单测 — node --test (零依赖)
   运行: node --test test/math-world.test.js
   为什么存在: 装配层走子 stepWalk 曾有跨帧死锁 —— 段内进度不记账,
   每帧从段起点重算插值; 而 frame() 把 dt 钳到 ≤0.05s, 单帧预算
   speed×dt 永远凑不足一格(len=1), walk.i 卡 0、读数/交卷永不触发,
   phase 停在 'walking' 整关卡死(掷骰后不前进)。hop-world-core 判分
   单测与 boot 加载冒烟都够不到这条链, 本测试以行为级驱动兜底:
   vm 桩 DOM/THREE + 虚拟 rAF/时钟, 镜像 index.html 相对加载序, 把
   runHopWorld 掷骰变体从点骰子一路开到关卡 end。
   覆盖: 掷骰全链(点骰→走子逐格读数→落格问题卡→作答→结算→
   下一试次→end) · 走子跨帧推进(修复回归, 直线/蛇行两布局) ·
   落格坐标与逐格读数恰为骰值步数 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ============ 桩 DOM: id 注册表 + innerHTML 解析 + .m-choice 查询 ============ */

function mkFakeEl(tag, byId) {
  const el = {
    tag, id: '', className: '', textContent: '', style: {}, dataset: {},
    children: [], parentNode: null, listeners: {}, onclick: null, _html: '',
    classList: {add() {}, remove() {}, contains() {
      return false;
    }},
    set innerHTML(v) {
      el._html = String(v);
      /* id 解析进注册表: setCard 之后 getElementById 能拿到骰子钮/骰面 */
      for (const m of el._html.matchAll(/id="([^"]+)"/g)) {
        if (!byId.has(m[1])) byId.set(m[1], mkFakeEl('div', byId));
      }
    },
    get innerHTML() {
      return el._html;
    },
    appendChild(c) {
      c.parentNode = el; el.children.push(c); return c;
    },
    removeChild(c) {
      const k = el.children.indexOf(c);
      if (k >= 0) el.children.splice(k, 1);
      c.parentNode = null;
      return c;
    },
    addEventListener(k, fn) {
      (el.listeners[k] = el.listeners[k] || []).push(fn);
    },
    removeEventListener(k, fn) {
      const l = el.listeners[k] || [];
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    },
    /* 骰面骰点(i 元素)与数字贴片(canvas)各取所需 */
    getContext() {
      return {font: '', textAlign: '', textBaseline: '', lineWidth: 0,
        strokeStyle: '', fillStyle: '', strokeText() {}, fillText() {}};
    },
    /* 数字选项条: 从任务卡 html 反解选项钮(同浏览器查 DOM 的口径) */
    querySelectorAll(sel) {
      if (sel !== '.m-choice') return [];
      const out = [];
      for (const m of el._html.matchAll(/<button[^>]*class="([^"]*)"[^>]*data-v="([^"]*)"[^>]*>/g)) {
        if (!m[1].includes('m-choice')) continue;
        const key = 'choice-' + m[2];
        if (!byId.has(key)) byId.set(key, mkFakeEl('button', byId));
        const b = byId.get(key);
        b.dataset.v = m[2];
        out.push(b);
      }
      return out;
    },
  };
  if (tag === 'canvas') return el;
  return el;
}

/* ============ 装载器: 虚拟时钟 + rAF 队列 + 引擎 seam 桩 + vm 直载 ============ */

function loadMathWorld() {
  const byId = new Map([['mathRoot', mkFakeEl('div', new Map())],
    ['mArea', mkFakeEl('div', new Map())], ['crosshair', mkFakeEl('div', new Map())]]);
  const root = byId.get('mathRoot');
  const spoke = [];
  const errors = [];
  let vNow = 0;
  let timerSeq = 1;
  const timers = new Map(); // id → {at, fn}
  const rafQ = [];
  function runDue() {
    for (const [id, t] of [...timers.entries()].filter(([, t]) => t.at <= vNow)
        .sort((a, b) => a[1].at - b[1].at)) {
      timers.delete(id);
      try {
        t.fn();
      } catch (e) {
        errors.push('timer: ' + e.stack.split('\n')[0]);
      }
    }
  }
  function runRafs() {
    for (const cb of rafQ.splice(0)) {
      try {
        cb(vNow);
      } catch (e) {
        errors.push('rAF: ' + e.stack.split('\n')[0]);
      }
    }
  }
  /* 泵虚拟时间: 16ms 一帧, 到点定时器与 rAF 同步推进 */
  function pump(ms) {
    for (let e = 0; e < ms; e += 16) {
      vNow += 16;
      runDue();
      runRafs();
    }
  }
  const sandbox = {
    console: {log() {}, warn() {}, error() {}},
    Math: Math, /* 走子/布局只用 Math 静态件, 随机全部走种子 RandCore.mkRand */
    performance: {now: () => vNow},
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    requestAnimationFrame(cb) {
      rafQ.push(cb); return rafQ.length;
    },
    cancelAnimationFrame() {},
    setTimeout(fn, ms) {
      const id = timerSeq++; timers.set(id, {at: vNow + (ms || 0), fn}); return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval() {
      return 0;
    }, clearInterval() {},
    addEventListener() {},
    document: {
      getElementById: (id) => byId.get(id) || null,
      createElement: (tag) => mkFakeEl(tag, byId),
    },
    /* THREE 桩: 数字贴片/悬停盒只需构造与 dispose, 不参与判定 */
    THREE: {
      CanvasTexture: class {
        dispose() {}
      },
      SpriteMaterial: class {
        constructor(o) {
          this.map = o.map; this.color = {setHex() {}};
        }
        dispose() {}
      },
      Sprite: class {
        constructor(m) {
          this.material = m; this.scale = {set() {}}; this.position = {set() {}};
        }
      },
      BoxGeometry: class {},
      MeshBasicMaterial: class {
        constructor() {
          this.color = {setHex() {}};
        }
        dispose() {}
      },
      Mesh: class {
        constructor() {
          this.material = {color: {setHex() {}}}; this.position = {set() {}};
        }
      },
    },
    /* 引擎 seam 桩: loadScene 同步建场, 其余掷骰链不触达的占位保加载 */
    loadScene(fn) {
      fn();
    },
    clearWorld() {}, scene: {add() {}, remove() {}}, camera: {},
    setBlockRaw() {}, getBlock: () => 0, raycastVoxel: () => null,
    SceneKit: {fill() {}, tree() {}},
    ModeKit: {spawn() {}},
    CameraRig: {holdAim() {}, aim: () => ({origin: {}, dir: {}})},
    sfx: () => {},
    mathPraiseLine: () => '(表扬)', mathComfortLine: () => '(安慰)',
    SpeechKit: {speak: (s) => spoke.push(String(s)), cancel() {}},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  /* 共享词法预声明(浏览器里是 voxel.js/input.js 的顶层 let, 走子直写) */
  vm.runInContext(`
    let pos = {x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }};
    let vel = {x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }};
    let yaw = 0; let pitch = 0; let onGround = false;
  `, ctx, {filename: 'prelude.js'});
  for (const f of ['rand-core.js', 'math-puzzles-core.js', 'hop-world-core.js', 'math-track-core.js',
    'math-paradigms.js', 'math-world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  const pos = () => vm.runInContext('pos', ctx);
  return {
    run: (section, h) => vm.runInContext('runHopWorld', ctx)(section, h),
    pos, spoke, errors, pump, byId, root,
    /* 任务卡 = mathRoot 下 class 为 m-w-card 的子元素(buildDom 固定次序) */
    card: () => root.children.find((c) => c.className === 'm-w-card') || null,
  };
}

/* ============ 驱动小工具 ============ */

/* 纯数字播报 = 逐格读数(plan.value 落格数字, 区别于「掷出了 N！」话术) */
const digitReads = (spoke) => spoke.filter((s) => /^\d+$/.test(s));
/* 从「掷出了 N！」解析骰值 */
const rollOf = (spoke) => {
  const m = spoke.join('|').match(/掷出了 (\d+)/);
  return m ? +m[1] : null;
};

/* 起一局掷骰关并点一次骰子, 泵走子; 返回驱动句柄 */
function rollAndWalk(d, params) {
  const trials = [];
  let ended = null;
  d.run({family: 'hop', variant: 'dice', tier: 1, kind: 'normal',
    params: Object.assign({reasoning: 'single', chunks: 2, trials: 3,
      landmark: false, zigRate: 0}, params), seed: 42},
  {onTrial: (t) => trials.push(t), end: (st) => {
    ended = st;
  }});
  d.pump(400); // 装场 + 首试次卡片
  const die = d.byId.get('mWDie');
  assert.ok(die && typeof die.onclick === 'function', '骰子钮应已挂 onclick');
  const start = {x: d.pos().x, z: d.pos().z};
  die.onclick(); // 点骰子
  d.pump(12000); // 12 虚拟秒: 走子逐格读数 + 落格问题卡
  return {trials, getEnded: () => ended, start, roll: rollOf(d.spoke)};
}

/* ============ 走子跨帧推进(修复回归) ============ */

test('掷骰走子(直线布局): 点骰后逐格前进读数, 落格停在该格坐标', () => {
  const d = loadMathWorld();
  const r = rollAndWalk(d, {max: 10});
  assert.strictEqual(r.roll > 0, true, '应播报骰值: ' + JSON.stringify(d.spoke));
  /* 直线 0-10 路: 0 号格在世界 (59,64), 走子停在骰值格 59.5+roll, z 恒 64.5 */
  const p = d.pos();
  assert.ok(Math.abs(p.z - 64.5) < 1e-9, '直线布局 z 不变, 实际 z=' + p.z);
  assert.ok(Math.abs(p.x - (59.5 + r.roll)) < 1e-9,
      '应停在骰值格中心, 期望 x=' + (59.5 + r.roll) + ' 实际 x=' + p.x);
  assert.strictEqual(digitReads(d.spoke).length, r.roll,
      '逐格读数恰为骰值步数: ' + JSON.stringify(digitReads(d.spoke)));
  assert.ok(Math.abs(p.x - r.start.x) >= 1, '走子应离开起点至少一格');
  assert.deepStrictEqual(d.errors, [], '链路无异常');
});

test('掷骰走子(蛇行布局): 段内进度跨帧累积, 不再卡在首段 2%', () => {
  const d = loadMathWorld();
  const r = rollAndWalk(d, {max: 30});
  assert.strictEqual(r.roll > 0, true, '应播报骰值');
  /* 蛇行 0-30 路: 首行 0 号格在 (60,66), 骰值 ≤6 仍在首行(x 递增) */
  const p = d.pos();
  assert.ok(Math.abs(p.x - (60.5 + r.roll)) < 1e-9,
      '应停在骰值格中心, 期望 x=' + (60.5 + r.roll) + ' 实际 x=' + p.x);
  assert.strictEqual(digitReads(d.spoke).length, r.roll, '逐格读数恰为骰值步数');
  assert.deepStrictEqual(d.errors, [], '链路无异常');
});

/* ============ 掷骰全链: 走子 → 问题卡 → 作答 → 结算 → end ============ */

test('掷骰全链: 三试次点对答案逐次推进, 关卡 end 收口', () => {
  const d = loadMathWorld();
  const r = rollAndWalk(d, {max: 10});
  let guard = 0;
  while (!r.getEnded() && guard++ < 12) {
    const die = d.byId.get('mWDie'); // 新试次: 先掷骰(phase 守卫令旧钮空点无害)
    if (die && typeof die.onclick === 'function') {
      die.onclick();
      d.pump(12000); // 走子(含临近终点先回起点的 wrap 分支) + 落格问题卡
    }
    const card = d.card();
    const choices = card ? card.querySelectorAll('.m-choice') : [];
    assert.ok(choices.length === 4, '问题卡应给出恰 4 个数字选项');
    const last = digitReads(d.spoke).pop(); // 落格读数 = 正确答案
    const hit = choices.find((b) => +b.dataset.v === +last) || choices[0];
    hit.onclick(); // 作答(点对)
    d.pump(3000); // 结算闪条 + 下一试次
  }
  const st = r.getEnded();
  assert.ok(st, '关卡应正常 end(死锁修复前永远到不了这里)');
  assert.strictEqual(st.trials, 3, '三试次全部结算');
  assert.strictEqual(st.correct, 3, '落格读数即答案, 全部点对');
  assert.deepStrictEqual(d.errors, [], '全链无异常');
});
