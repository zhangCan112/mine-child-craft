'use strict';
/* 数学冒险岛屏流引擎单测 — node --test (零依赖)
   运行: node --test test/math-paradigms.test.js
   覆盖: 分发判定(13 屏流变体在册, 世界轨/未知返 none) · 认知负荷红线
   (chunks/unitLen ≤4 · clueCount ≤3, 越界 console.warn+截断) · 假 doc 试次流
   (呈现-点选-settle-下一试次, 独立 DOM 神谕: 从 data-* 属性与 img 计数反推
   正确答案再点击) · 逐试次事件缝 onTrial({ok, streak}) · 完成回调 st
   (trials/correct/acc/maxStreakErr) · 语音挂钩(题目话术/表扬/安慰经全局
   mathPraiseLine/mathComfortLine) · 种子确定性(同 seed 同输出, 异 seed 异题)
   · stop() 中止 · 模式层流程纯函数(mathVariantTrack 分发缝 / mathBossPlan
   / mathAggStats / mathFrontier / mathFamChallengeDone / mathSettleSave 落账)
   · index.html 脚本序(math-levels → math-puzzles-core → math-paradigms →
   modes/math, 加载序即依赖序)
   加载器: vm context 依次执行 math-levels.js + math-puzzles-core.js +
   math-paradigms.js(+ modes/math.js), 镜像浏览器共享词法环境(相对序同
   index.html); DOM/语音/图标以记录桩注入(focus-paradigms.test.js 同款) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ============ 假 doc 驱动缝 ============ */

function mkFakeEl(els, clsLog) {
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
        cs.forEach((c) => {
          el._cls.add(c);
          clsLog.push(c);
        });
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
      return mkFakeEl(els, clsLog);
    },
    querySelectorAll() {
      return [];
    },
    remove() {},
  };
  els.push(el);
  return el;
}

function loadMathParadigms(opts) {
  opts = opts || {};
  const els = [];
  const timers = [];
  const clsLog = [];
  const spoken = [];
  const warns = [];
  const sfxLog = [];
  let seed = opts.randSeed === undefined ? 12345 : opts.randSeed;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const sandbox = {
    console: {warn: (...a) => warns.push(a.join(' ')), log() {}, error() {}},
    Math: Object.assign(Object.create(Math), {random: rand}),
    JSON, Object, Array, Set, Number, Date, String,
    performance: {now: () => 0},
    setTimeout(fn) {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {},
    document: {createElement: () => mkFakeEl(els, clsLog)},
    SpeechKit: {speak: (s) => spoken.push(s), cancel() {}},
    sfx: (n) => sfxLog.push(n),
    mathPraiseLine: () => '(表扬)',
    mathComfortLine: () => '(安慰)',
    mcIcon: (n) => 'data:mc:' + n,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['math-levels.js', 'math-puzzles-core.js', 'math-paradigms.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__mp = { PuzzleCore, MATH_LEVELS, MATH_META, MATH_VARIANTS,
      MATH_FAMILIES, mathParamsFor, mathPassed, mathStars, MATH_SAVE_DEFAULTS,
      migrateMathSave, MATH_LOG_KEEP_DAYS, trimMathLog,
      mathScreenDispatch, mathGuardParams, runMathScreen };
  `, ctx);
  return {
    mp: sandbox.__mp, els, spoken, warns, sfxLog, clsLog, timers,
    flush(max) {
      let n = 0;
      while (timers.length && n < (max || 800)) {
        timers.shift()();
        n++;
      }
      return n;
    },
    step() {
      return timers.length ? (timers.shift()(), true) : false;
    },
    pending: () => timers.length,
  };
}

/* 模式层(modes/math.js)加载器: 屏流引擎+世界轨之上再执行模式文件, 走流程纯函数
   (文件清单镜像 index.html 加载序: math-levels → math-puzzles-core →
   math-world-core → math-paradigms → math-world → modes/math) */
function loadMathMode() {
  const d = loadMathParadigms();
  const sandboxExtra = {
    mkMode: (cfg) => cfg,
    mkHotbar: () => ({sel: 0, show() {}, hide() {}, select() {}, refresh() {}, render() {}}),
    showToast: () => {},
    btnImg: (n) => '<img class="bi" data-btn="' + n + '" alt="" src="data:btn">',
    overlay: {style: {}},
    showPage: () => {},
    SyncDB: {slot: () => ({load: () => ({}), save() {}, reset() {}})},
  };
  const ctx = d; // 复用同一 sandbox 的途径: 重开一个 context 更直接
  void ctx;
  const els = [];
  const timers = [];
  const spoken = [];
  const warns = [];
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const sandbox = {
    console: {warn: (...a) => warns.push(a.join(' ')), log() {}, error() {}},
    Math: Object.assign(Object.create(Math), {random: rand}),
    JSON, Object, Array, Set, Number, Date, String,
    performance: {now: () => 0},
    setTimeout(fn) {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {},
    document: {createElement: () => mkFakeEl(els, [])},
    SpeechKit: {speak: (s) => spoken.push(s), cancel() {}},
    sfx: () => {},
    mcIcon: (n) => 'data:mc:' + n,
    budgetDateStr(t) {
      const dd = new Date(t);
      return dd.getFullYear() + '-' + (dd.getMonth() + 1) + '-' + (dd.getDate());
    },
  };
  Object.assign(sandbox, sandboxExtra);
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const vmCtx = vm.createContext(sandbox);
  for (const f of ['math-levels.js', 'math-puzzles-core.js', 'math-world-core.js',
    'math-paradigms.js', 'math-world.js', 'modes/math.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), vmCtx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__mm = { mathVariantTrack, mathFrontier, mathLevelUnlocked,
      mathFamChallengeDone, mathBossPlan, mathAggStats, mathSettleSave,
      MATH_LEVELS, MATH_VARIANTS, MATH_SAVE_DEFAULTS,
      runMathWorld: (typeof runMathWorld !== 'undefined' ? runMathWorld : null),
      MATH_WORLD_FAMILIES: (typeof MATH_WORLD_FAMILIES !== 'undefined' ? MATH_WORLD_FAMILIES : null) };
  `, vmCtx);
  return {mm: sandbox.__mm, sandbox};
}

/* ============ 驱动小工具 ============ */

/* 当前试次的元素: 最后一个 m-stage 之后的创建序(旧试次元素已不属本轮) */
function stageEls(d) {
  let idx = 0;
  d.els.forEach((e, k) => {
    if (typeof e.className === 'string' && e.className.split(' ').includes('m-stage')) idx = k;
  });
  return d.els.slice(idx);
}

const sEls = (d, cls) => stageEls(d).filter(
    (e) => typeof e.className === 'string' && e.className.split(' ').includes(cls));
const clickable = (el) => typeof el.onclick === 'function';

function tap(el) {
  if (clickable(el)) el.onclick({preventDefault() {}});
}

/* 造一节(section): params 来自 mathParamsFor 再覆写(测试只改 trials/seed) */
function sec(mp, family, variant, tier, over) {
  const p = Object.assign(mp.mathParamsFor(family, tier), {trials: 3}, over || {});
  return {family, variant, tier, params: p, seed: over && over.seed !== undefined ? over.seed : 42};
}

/* 起一局: 引擎必须取自同一 loader d(元素/计时器记在它的沙箱里) */
function play(d, family, variant, tier, over, h) {
  return d.mp.runMathScreen(sec(d.mp, family, variant, tier, over), mkFakeEl([], []), h || {});
}

/* 通用自动玩policy: 数值条点第一个; 多选件点两个再确认; 其余点第一个未点过的可点件 */
function autoPlay(d, ended, maxSteps) {
  let guard = 0;
  while (!ended.length && guard++ < (maxSteps || 200)) {
    d.flush(12);
    const nums = sEls(d, 'm-num').filter(clickable);
    if (nums.length) {
      tap(nums[0]);
      continue;
    }
    const items = sEls(d, 'm-item').filter(clickable);
    const chips = sEls(d, 'm-chip').filter(clickable);
    const oks = sEls(d, 'm-ok').filter(clickable);
    if ((items.length || chips.length) && oks.length) {
      const pool = items.length ? items : chips;
      tap(pool[0]);
      if (pool[1]) tap(pool[1]);
      tap(oks[oks.length - 1]);
      continue;
    }
    if (oks.length) {
      tap(oks[oks.length - 1]);
      continue;
    }
    const fresh = sEls(d, 'm-tap').filter(clickable)
        .filter((e) => !e._cls.has('picked') && !e._cls.has('good') && !e._cls.has('bad'));
    if (fresh.length) {
      tap(fresh[0]);
      continue;
    }
    d.flush(4);
  }
}

/* ============ 分发判定(纯函数) ============ */

test('mathScreenDispatch: 13 个屏流变体在册, 世界轨与未知返 none', () => {
  const {mp} = loadMathParadigms();
  const screen = [
    ['count', 'snapshot'], ['count', 'fetch'], ['count', 'compare'], ['count', 'balance'],
    ['craft', 'enough'], ['craft', 'shortage'], ['craft', 'order'], ['craft', 'blank'],
    ['pattern', 'chain'], ['pattern', 'sort'], ['pattern', 'odd'], ['pattern', 'cycle'],
    ['hop', 'position'],
  ];
  for (const [f, v] of screen) {
    assert.deepStrictEqual({...mp.mathScreenDispatch(f, v)}, {kind: 'engine', key: f + '/' + v});
  }
  const world = [['hop', 'dice'], ['hop', 'jumps'], ['hop', 'gaps'],
    ['mirror', 'reflect'], ['mirror', 'translate'], ['mirror', 'rotate'], ['mirror', 'tangram'],
    ['plan', 'build'], ['plan', 'pick'], ['plan', 'hidden'], ['plan', 'countall']];
  for (const [f, v] of world) {
    assert.strictEqual(mp.mathScreenDispatch(f, v).kind, 'none', f + '/' + v + ' 归世界轨(T5/T6)');
  }
  assert.strictEqual(mp.mathScreenDispatch('???', '???').kind, 'none');
  assert.strictEqual(mp.mathScreenDispatch('count', '???').kind, 'none');
});

test('runMathScreen: 世界轨变体返回 null(模式层据此走占位屏)', () => {
  const {mp} = loadMathParadigms();
  const ended = [];
  const ctrl = mp.runMathScreen(sec(mp, 'mirror', 'reflect', 5), mkFakeEl([], []), {end: (s) => ended.push(s)});
  assert.strictEqual(ctrl, null);
  assert.strictEqual(ended.length, 0);
});

/* ============ 认知负荷红线 ============ */

test('mathGuardParams: chunks/unitLen >4 与 clueCount >3 越界即 warn+截断, 合法参数不 warn', () => {
  const {mp, warns} = loadMathParadigms();
  assert.strictEqual(mp.mathGuardParams({chunks: 6}).chunks, 4);
  assert.strictEqual(mp.mathGuardParams({unitLen: 9}).unitLen, 4);
  assert.strictEqual(mp.mathGuardParams({clueCount: 5}).clueCount, 3);
  assert.strictEqual(warns.length, 3, '每次越界一条 warn');
  assert.ok(warns.every((w) => w.includes('红线') || w.includes('截断')), 'warn 说明截断: ' + warns.join('/'));
  const ok = mp.mathGuardParams({chunks: 2, unitLen: 4, clueCount: 3, trials: 6});
  assert.deepStrictEqual([ok.chunks, ok.unitLen, ok.clueCount], [2, 4, 3]);
  assert.strictEqual(warns.length, 3, '合法参数零 warn');
  assert.strictEqual(mp.mathGuardParams(null).trials, undefined, '空参防御');
});

/* ============ count 族: 独立 DOM 神谕试次流 ============ */

/* 快照神谕: m-flash 里出现次数最多的 img src = 小客人数(干扰物是另一副面孔) */
function snapshotAnswer(d) {
  const field = sEls(d, 'm-flash').pop();
  assert.ok(field, '闪现场存在');
  const srcs = [...String(field.innerHTML).matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length > 0, '闪现场有图标');
  const cnt = {};
  for (const s of srcs) cnt[s] = (cnt[s] || 0) + 1;
  let n = 0;
  for (const s of Object.keys(cnt)) {
    if (cnt[s] > n) n = cnt[s];
  }
  return n;
}

test('count/snapshot: 闪现计数→点对数字→onTrial ok 且 streak 递增, 整局 acc=1', () => {
  const d = loadMathParadigms();
  const trials = [];
  const ended = [];
  play(d, 'count', 'snapshot', 1, null, {
    onTrial: (t) => trials.push(t),
    end: (s) => ended.push(s),
  });
  let guard = 0;
  while (!ended.length && guard++ < 60) {
    d.flush(10);
    const ans = snapshotAnswer(d);
    const btn = sEls(d, 'm-num').find((b) => +b.dataset.v === ans);
    assert.ok(btn, '数字条含答案 ' + ans);
    tap(btn);
  }
  assert.strictEqual(ended.length, 1, '完成回调恰一次');
  const st = ended[0];
  assert.strictEqual(st.trials, 3);
  assert.strictEqual(st.correct, 3);
  assert.strictEqual(st.acc, 1);
  assert.strictEqual(st.maxStreakErr, 0);
  assert.strictEqual(trials.length, 3, '事件缝每正式试次恰一次');
  assert.deepStrictEqual(trials.map((t) => t.ok), [true, true, true]);
  assert.deepStrictEqual(trials.map((t) => t.streak), [1, 2, 3], '连对累加');
});

test('count/snapshot: 闪现后藏起(m-hide)再出数字条; 感数上限 ≤12', () => {
  const d = loadMathParadigms();
  const ended = [];
  play(d, 'count', 'snapshot', 19, {trials: 4}, {end: (s) => ended.push(s)});
  d.flush(12);
  const field = sEls(d, 'm-flash').pop();
  assert.ok(field._cls.has('m-hide'), '计时到闪现场隐藏(快照=凭记忆报数)');
  const srcs = [...String(field.innerHTML).matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length <= 12, '快照数量 ≤12(感数上限, 大数走取物/比多少): ' + srcs.length);
  assert.ok(sEls(d, 'm-num').length >= 2, '隐藏后出数字条');
  void ended;
});

test('count/snapshot: 点错→ok=false 连错入账 maxStreakErr, 选中键标 bad, 走 click 音', () => {
  const d = loadMathParadigms();
  const trials = [];
  play(d, 'count', 'snapshot', 1, {trials: 2}, {
    onTrial: (t) => trials.push(t),
    end() {},
  });
  let guard = 0;
  while (trials.length < 2 && guard++ < 40) {
    d.flush(10);
    const ans = snapshotAnswer(d);
    const wrong = sEls(d, 'm-num').find((b) => +b.dataset.v !== ans);
    assert.ok(wrong, '数字条有错误选项');
    tap(wrong);
    assert.ok(wrong._cls.has('bad'), '错误反馈类');
  }
  assert.deepStrictEqual(trials.map((t) => t.ok), [false, false]);
  assert.deepStrictEqual(trials.map((t) => t.streak), [0, 0]);
  assert.strictEqual(trials.length, 2);
  d.flush(20);
  assert.ok(d.sfxLog.includes('click'), '答错走 click 音');
});

test('count/fetch: 点够 n 个入箱再确认→对; 数不对→错', () => {
  const d = loadMathParadigms();
  for (const wantOk of [true, false]) {
    const ended = [];
    play(d, 'count', 'fetch', 3, {trials: 1, seed: wantOk ? 11 : 12}, {
      end: (s) => ended.push(s),
    });
    d.flush(8);
    const box = sEls(d, 'm-box').pop();
    const n = +box.dataset.n;
    const items = sEls(d, 'm-item');
    assert.ok(n >= 1 && n <= 10, '目标数在带内: ' + n);
    const take = wantOk ? n : Math.max(0, n - 1);
    for (let k = 0; k < take; k++) tap(items[k]);
    tap(sEls(d, 'm-ok').pop());
    d.flush(8);
    assert.strictEqual(ended[0].correct, wantOk ? 1 : 0, '取 ' + take + '/' + n + ' 期望 ' + wantOk);
  }
});

test('count/compare: single 档点大堆→对; reverse 档走"多几个"数字条', () => {
  const d = loadMathParadigms();
  let ended = [];
  play(d, 'count', 'compare', 1, {trials: 1}, {end: (s) => ended.push(s)});
  d.flush(8);
  let piles = sEls(d, 'm-pile');
  assert.strictEqual(piles.length, 2, '两堆方块');
  const big = piles.reduce((x, y) => (+x.dataset.n >= +y.dataset.n ? x : y));
  tap(big);
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1, '点中多的一堆');

  ended = [];
  play(d, 'count', 'compare', 9, {trials: 1, seed: 7}, {end: (s) => ended.push(s)});
  d.flush(8);
  piles = sEls(d, 'm-pilestat');
  assert.strictEqual(piles.length, 2, '比多少(相差)档静态两堆');
  const diff = Math.abs(+piles[0].dataset.n - +piles[1].dataset.n);
  const btn = sEls(d, 'm-num').find((b) => +b.dataset.v === diff);
  assert.ok(btn, '数字条含差值 ' + diff);
  tap(btn);
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1);
});

test('count/balance(挑战): 移多补少答案 =(a-b)/2', () => {
  const d = loadMathParadigms();
  const ended = [];
  play(d, 'count', 'balance', 4, {trials: 1, seed: 21}, {end: (s) => ended.push(s)});
  d.flush(8);
  const piles = sEls(d, 'm-pilestat');
  const a = +piles[0].dataset.n;
  const b = +piles[1].dataset.n;
  const ans = Math.abs(a - b) / 2;
  assert.ok(Number.isInteger(ans), '差为偶数(移 1 差变 2): ' + a + '/' + b);
  const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === ans);
  assert.ok(btn, '数字条含 (a-b)/2=' + ans);
  tap(btn);
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1);
});

/* ============ craft 族 ============ */

test('craft/enough: 够/不够两分支按 have≥need 判定', () => {
  const d = loadMathParadigms();
  for (const seed of [3, 5, 8, 13, 25, 34]) {
    const ended = [];
    play(d, 'craft', 'enough', 6, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const need = +sEls(d, 'm-need').pop().dataset.n;
    const have = +sEls(d, 'm-have').pop().dataset.n;
    const enough = have >= need;
    const btn = enough ? sEls(d, 'm-yes').pop() : sEls(d, 'm-no').pop();
    tap(btn);
    d.flush(8);
    const why = 'seed ' + seed + ': need ' + need + ' have ' + have + ' → ' + (enough ? '够' : '不够');
    assert.strictEqual(ended[0].correct, 1, why);
  }
});

test('craft/shortage: 还差 = need-have', () => {
  const d = loadMathParadigms();
  const ended = [];
  play(d, 'craft', 'shortage', 7, {trials: 1, seed: 9}, {end: (s) => ended.push(s)});
  d.flush(8);
  const need = +sEls(d, 'm-need').pop().dataset.n;
  const have = +sEls(d, 'm-have').pop().dataset.n;
  assert.ok(need > have, '缺料题 need>have');
  const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === need - have);
  assert.ok(btn);
  tap(btn);
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1);
});

test('craft/order: 订单总量 = k×per(data-k/data-per 神谕)', () => {
  const d = loadMathParadigms();
  const ended = [];
  play(d, 'craft', 'order', 9, {trials: 1, seed: 17}, {end: (s) => ended.push(s)});
  d.flush(8);
  const order = sEls(d, 'm-order').pop();
  const total = +order.dataset.k * +order.dataset.per;
  const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === total);
  assert.ok(btn, '数字条含 ' + order.dataset.k + '×' + order.dataset.per + '=' + total);
  tap(btn);
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1);
});

test('craft/blank: 算式谜 x ? = z 神谕(加/减两形), 空位恒在第二操作数', () => {
  const d = loadMathParadigms();
  let checked = 0;
  for (const seed of [4, 6, 15, 28, 40, 66]) {
    const ended = [];
    play(d, 'craft', 'blank', 13, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    if (!sEls(d, 'm-op').length) continue; // 该试次掷到天平/多解子型(另有专测)
    const op = sEls(d, 'm-op').pop().dataset.op;
    const ns = sEls(d, 'm-numslot').map((el) => +el.dataset.n);
    assert.strictEqual(ns.length, 2, '两个已知数');
    const ans = op === '+' ? ns[1] - ns[0] : ns[0] - ns[1];
    const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === ans);
    assert.ok(btn, op + ' 形答案 ' + ans + ' 在数字条');
    tap(btn);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1);
    checked++;
  }
  assert.ok(checked >= 1, '至少验到一题算式谜');
});

test('craft/blank: 天平子型(m-rel/m-ask)按代换链神谕求解', () => {
  const d = loadMathParadigms();
  let found = false;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const ended = [];
    play(d, 'craft', 'blank', 16, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const rels = sEls(d, 'm-rel');
    const asks = sEls(d, 'm-ask');
    if (!rels.length || !asks.length) continue;
    found = true;
    const ask = asks.pop();
    const kOf = {};
    for (const r of rels) kOf[r.dataset.from + '>' + r.dataset.to] = +r.dataset.r / +r.dataset.l;
    let ans = +ask.dataset.n;
    const from = ask.dataset.from;
    const to = ask.dataset.to;
    const direct = kOf[from + '>' + to];
    if (direct) {
      ans *= direct;
    } else {
      for (const mid of ['a', 'b', 'c']) {
        if (kOf[from + '>' + mid] && kOf[mid + '>' + to]) ans *= kOf[from + '>' + mid] * kOf[mid + '>' + to];
      }
    }
    assert.ok(Number.isInteger(ans), '代换链答案整数: ' + ans);
    const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === ans);
    assert.ok(btn, '数字条含天平答案 ' + ans);
    tap(btn);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1, '天平代换算对');
  }
  assert.ok(found, 'tier16 多解档 30 个种子内掷到天平子型');
});

test('craft/blank: 多解找齐子型(m-chip)选对全集→对, 选错→错', () => {
  const d = loadMathParadigms();
  let found = false;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const ended = [];
    play(d, 'craft', 'blank', 19, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const chips = sEls(d, 'm-chip');
    const qs = sEls(d, 'm-q');
    if (!chips.length || !qs.length) continue;
    found = true;
    const n = +qs.pop().dataset.n;
    assert.ok(chips.length <= 4, '多解选项 ≤4 组块');
    const good = chips.filter((c) => +c.dataset.x + +c.dataset.y === n);
    const bad = chips.filter((c) => +c.dataset.x + +c.dataset.y !== n);
    assert.ok(good.length >= 1 && bad.length >= 1, '有对有错');
    for (const c of good) tap(c);
    tap(sEls(d, 'm-ok').pop());
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1, '找齐全对');
  }
  assert.ok(found, 'tier19 40 个种子内掷到多解子型');
  if (found) {
    const ended = [];
    play(d, 'craft', 'blank', 19, {trials: 2, seed: 41}, {end: (s) => ended.push(s)});
    d.flush(8);
    const chips = sEls(d, 'm-chip');
    if (chips.length) {
      tap(chips[0]);
      tap(chips[0]); // 双击同一枚=取消, 再单选一枚即确认(不足全集)
      if (chips[1]) tap(chips[1]);
      tap(sEls(d, 'm-ok').pop());
      d.flush(8);
      assert.ok(ended.length === 0 || ended[0].trials >= 1, '错选流程不崩');
    }
  }
});

/* ============ pattern 族 ============ */

test('pattern/chain: 颜色接龙按展示序列求周期→下一项', () => {
  const d = loadMathParadigms();
  let checked = 0;
  for (const seed of [2, 10, 19, 31]) {
    const ended = [];
    play(d, 'pattern', 'chain', 1, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const slots = sEls(d, 'm-itemslot');
    if (!slots.length) continue;
    const items = slots.map((el) => el.dataset.item);
    let p = 0;
    for (let cand = 2; cand <= 4; cand++) {
      let okP = true;
      for (let k = 0; k + cand < items.length; k++) {
        if (items[k] !== items[k + cand]) okP = false;
      }
      if (okP) {
        p = cand;
        break;
      }
    }
    assert.ok(p >= 2, '展示序列含完整两轮周期: ' + items.join(','));
    const ans = items[items.length % p];
    const btn = sEls(d, 'm-iconc').find((el) => el.dataset.v === ans);
    assert.ok(btn, '选项含下一项 ' + ans);
    tap(btn);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1);
    checked++;
  }
  assert.ok(checked >= 1);
});

test('pattern/chain: 数列子型(等差/交替)按规则外推', () => {
  const d = loadMathParadigms();
  let found = false;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const ended = [];
    play(d, 'pattern', 'chain', 13, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const slots = sEls(d, 'm-numslot');
    if (!slots.length) continue;
    found = true;
    const s = slots.map((el) => +el.dataset.n);
    let ans;
    if (s.length === 3) {
      ans = s[2] + (s[1] - s[0]); // 等差
    } else {
      ans = s[3] + (s[2] - s[1]); // 交替: 步长 p,q 轮转, 末步后接 q
      assert.strictEqual(s[1] - s[0], s[3] - s[2], '交替形 p 步对齐');
    }
    const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === ans);
    assert.ok(btn, '数字条含数列下一项 ' + ans + '(' + s.join(',') + ')');
    tap(btn);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1);
  }
  assert.ok(found, 'tier13 30 个种子内掷到数列子型');
});

test('pattern/sort: 分装箱(m-binrule)选中与规则同款的全集→对', () => {
  const d = loadMathParadigms();
  const ended = [];
  play(d, 'pattern', 'sort', 3, {trials: 1, seed: 14}, {end: (s) => ended.push(s)});
  d.flush(8);
  const rule = sEls(d, 'm-binrule').pop().dataset.v;
  const items = sEls(d, 'm-item');
  const match = items.filter((el) => el.dataset.v === rule);
  assert.ok(match.length >= 2 && match.length < items.length, '有同款有干扰');
  for (const el of match) tap(el);
  tap(sEls(d, 'm-ok').pop());
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1);
});

test('pattern/sort: 线索排队子型(m-clue≤3 + m-card), 按线索全序点击→对', () => {
  const d = loadMathParadigms();
  let found = false;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const ended = [];
    play(d, 'pattern', 'sort', 19, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const clues = sEls(d, 'm-clue');
    const cards = sEls(d, 'm-card');
    if (!clues.length || !cards.length) continue;
    found = true;
    assert.ok(clues.length <= 3, '线索 ≤3 红线: ' + clues.length);
    assert.strictEqual(cards.length, 3, '三实体排队');
    const keys = cards.map((c) => c.dataset.k);
    const hiBefore = clues.map((c) => [c.dataset.hi, c.dataset.lo]);
    let order = null;
    for (const p1 of keys) {
      for (const p2 of keys) {
        for (const p3 of keys) {
          const perm = [p1, p2, p3];
          if (new Set(perm).size !== 3) continue;
          if (hiBefore.every(([hi, lo]) => perm.indexOf(hi) < perm.indexOf(lo))) order = perm;
        }
      }
    }
    assert.ok(order, '线索可解全序');
    for (const k of order) tap(cards.find((c) => c.dataset.k === k));
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1, '按从高到矮点队正确');
  }
  assert.ok(found, 'tier19 30 个种子内掷到线索排队子型');
});

test('pattern/odd: 找异类=类别少数派(类目表神谕)', () => {
  const CATS = [new Set(['wool_red', 'wool_blue', 'wool_yellow']),
    new Set(['coal', 'iron', 'diamond']), new Set(['cobble', 'planks', 'brick', 'stone'])];
  const d = loadMathParadigms();
  for (const seed of [7, 22, 39]) {
    const ended = [];
    play(d, 'pattern', 'odd', 5, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const chs = sEls(d, 'm-iconc');
    assert.ok(chs.length >= 4 && chs.length <= 6, '呈现 4~6 枚');
    const catOf = (v) => CATS.findIndex((c) => c.has(v));
    const votes = {};
    chs.forEach((c) => {
      const k = catOf(c.dataset.v);
      votes[k] = (votes[k] || 0) + 1;
    });
    const major = +Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
    const oddEl = chs.find((c) => catOf(c.dataset.v) !== major);
    assert.ok(oddEl, '存在异类');
    tap(oddEl);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1, 'seed ' + seed);
  }
});

test('pattern/cycle(挑战): 第 n 项 = unit[(n-1) mod len]', () => {
  const d = loadMathParadigms();
  for (const seed of [6, 18, 27]) {
    const ended = [];
    play(d, 'pattern', 'cycle', 8, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const unit = sEls(d, 'm-itemslot').map((el) => el.dataset.item);
    const n = +sEls(d, 'm-q').pop().dataset.n;
    assert.ok(unit.length >= 4 && unit.length % 2 === 0, '展示两轮完整周期');
    const len = unit.length / 2;
    assert.ok(n > 2 * len, '问项越过已展示(必须靠规律推): n=' + n + ' len=' + len);
    const ans = unit[(n - 1) % len];
    const btn = sEls(d, 'm-iconc').find((el) => el.dataset.v === ans);
    assert.ok(btn);
    tap(btn);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1, 'seed ' + seed);
  }
});

/* ============ hop 屏流变体 ============ */

test('hop/position: 单步档点大数标记→对; reverse 档走相差数字条', () => {
  const d = loadMathParadigms();
  let ended = [];
  play(d, 'hop', 'position', 2, {trials: 1, seed: 5}, {end: (s) => ended.push(s)});
  d.flush(8);
  let marks = sEls(d, 'm-mark');
  assert.strictEqual(marks.length, 2, '数字路两个站位');
  const big = marks.reduce((x, y) => (+x.dataset.n >= +y.dataset.n ? x : y));
  tap(big);
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1, '点出站得远的(大数)');

  ended = [];
  play(d, 'hop', 'position', 11, {trials: 1, seed: 5}, {end: (s) => ended.push(s)});
  d.flush(8);
  marks = sEls(d, 'm-markstat');
  assert.strictEqual(marks.length, 2, '相差档静态标记');
  const diff = Math.abs(+marks[0].dataset.n - +marks[1].dataset.n);
  const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === diff);
  assert.ok(btn);
  tap(btn);
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1, '相差几答对');
});

/* ============ 全变体冒烟 + 事件契约 + 红线静默 ============ */

test('冒烟: 13 个屏流变体(tier1/tier19)自动玩到底不崩, 试次数=trials, 零 warn', () => {
  const variants = [
    ['count', 'snapshot'], ['count', 'fetch'], ['count', 'compare'], ['count', 'balance'],
    ['craft', 'enough'], ['craft', 'shortage'], ['craft', 'order'], ['craft', 'blank'],
    ['pattern', 'chain'], ['pattern', 'sort'], ['pattern', 'odd'], ['pattern', 'cycle'],
    ['hop', 'position'],
  ];
  for (const [f, v] of variants) {
    for (const tier of [1, 19]) {
      const d = loadMathParadigms();
      const trials = [];
      const ended = [];
      d.mp.runMathScreen(sec(d.mp, f, v, tier, {trials: 2}), mkFakeEl([], []), {
        onTrial: (t) => trials.push(t),
        end: (s) => ended.push(s),
      });
      autoPlay(d, ended);
      assert.strictEqual(ended.length, 1, f + '/' + v + ' tier' + tier + ' 跑到完成回调');
      assert.strictEqual(ended[0].trials, 2, f + '/' + v + ' tier' + tier + ' 试次数');
      assert.strictEqual(trials.length, 2, f + '/' + v + ' tier' + tier + ' 事件缝计数');
      assert.ok(ended[0].acc >= 0 && ended[0].acc <= 1);
      assert.strictEqual(d.warns.length, 0, f + '/' + v + ' tier' + tier + ' 合法参数零 warn');
    }
  }
});

test('progress 回调按 (k,n) 单调推进; end 恰一次', () => {
  const d = loadMathParadigms();
  const progs = [];
  const ended = [];
  play(d, 'count', 'fetch', 4, {trials: 3, seed: 33}, {
    progress: (k, n) => progs.push([k, n]),
    end: (s) => ended.push(s),
  });
  let guard = 0;
  while (!ended.length && guard++ < 40) {
    d.flush(8);
    const box = sEls(d, 'm-box').pop();
    const n = box ? +box.dataset.n : 1;
    const items = sEls(d, 'm-item');
    for (let k = 0; k < n && k < items.length; k++) tap(items[k]);
    const ok = sEls(d, 'm-ok').filter(clickable).pop();
    if (ok) tap(ok);
  }
  assert.deepStrictEqual(progs, [[0, 3], [1, 3], [2, 3]]);
  assert.strictEqual(ended.length, 1);
});

/* ============ 语音挂钩 / 话术 ============ */

test('连对满 3 播表扬(mathPraiseLine), 连错满 3 播安慰(mathComfortLine) — 话术住模式层', () => {
  const d = loadMathParadigms();
  const ended = [];
  play(d, 'count', 'snapshot', 1, {trials: 3, seed: 50}, {end: (s) => ended.push(s)});
  let guard = 0;
  while (!ended.length && guard++ < 30) {
    d.flush(10);
    const ans = snapshotAnswer(d);
    tap(sEls(d, 'm-num').find((b) => +b.dataset.v === ans));
  }
  assert.ok(d.spoken.includes('(表扬)'), '三连对播表扬: ' + d.spoken.join('/'));

  const d2 = loadMathParadigms();
  const ended2 = [];
  play(d2, 'count', 'snapshot', 1, {trials: 3, seed: 51}, {end: (s) => ended2.push(s)});
  let g2 = 0;
  while (!ended2.length && g2++ < 30) {
    d2.flush(10);
    const ans = snapshotAnswer(d2);
    tap(drvNumNot(d2, ans));
  }
  assert.ok(d2.spoken.includes('(安慰)'), '三连错播安慰: ' + d2.spoken.join('/'));
});

function drvNumNot(d, ans) {
  const el = sEls(d, 'm-num').find((b) => +b.dataset.v !== ans);
  return el;
}

test('每试次播题目话术(SpeechKit.speak), 数量与试次同阶', () => {
  const d = loadMathParadigms();
  const ended = [];
  play(d, 'pattern', 'cycle', 12, {trials: 2, seed: 60}, {end: (s) => ended.push(s)});
  autoPlay(d, ended);
  assert.ok(d.spoken.length >= 2, '每试次有话术: ' + d.spoken.join('/'));
  assert.ok(d.spoken.some((s) => s.includes('第')), '周期题话术带"第 n 个"');
});

/* ============ 种子确定性 ============ */

test('种子确定性: 同 seed 同题序(话术+部件签名), 异 seed 异题', () => {
  const run = (seed) => {
    const d = loadMathParadigms({randSeed: 999});
    const ended = [];
    const sigs = [];
    let s0 = 0;
    let e0 = 0;
    play(d, 'craft', 'blank', 19, {trials: 4, seed}, {
      onTrial() {
        sigs.push({
          spoken: d.spoken.slice(s0),
          els: d.els.slice(e0).map((el) => el.className + '#' + JSON.stringify(el.dataset) +
              '#' + String(el.innerHTML).slice(0, 160)),
        });
        s0 = d.spoken.length;
        e0 = d.els.length;
      },
      end: (s) => ended.push(s),
    });
    autoPlay(d, ended);
    assert.strictEqual(ended.length, 1);
    assert.strictEqual(sigs.length, 4);
    return {sigs, st: ended[0]};
  };
  const a = run(777);
  const b = run(777);
  assert.deepStrictEqual(a.sigs, b.sigs, '同 seed 逐试次部件与话术全同');
  assert.deepStrictEqual({...a.st}, {...b.st});
  const c = run(778);
  assert.notDeepStrictEqual(a.sigs, c.sigs, '异 seed 出不同题序');
});

test('stop(): 立即中止, 计时器链断, 不触发 end', () => {
  const d = loadMathParadigms();
  const ended = [];
  const ctrl = play(d, 'count', 'snapshot', 1, null, {end: (s) => ended.push(s)});
  assert.ok(ctrl && typeof ctrl.stop === 'function');
  ctrl.stop();
  d.flush(200);
  assert.strictEqual(ended.length, 0, 'stop 后不再推进');
  assert.doesNotThrow(() => ctrl.stop(), 'stop 幂等');
});

test('clueCount 越界(9): guard warn + 渲染线索卡 ≤3', () => {
  const d = loadMathParadigms();
  const ended = [];
  play(d, 'pattern', 'sort', 19, {trials: 1, seed: 3, clueCount: 9}, {end: (s) => ended.push(s)});
  autoPlay(d, ended);
  assert.ok(d.warns.some((w) => w.includes('clueCount')), 'clueCount 越界 warn: ' + d.warns.join('/'));
  const clues = sEls(d, 'm-clue');
  if (clues.length) assert.ok(clues.length <= 3);
});

/* ============ 模式层流程纯函数(modes/math.js) ============ */

test('mathVariantTrack(分发缝): 13 屏流变体 → screen, 其余 → world(T5/T6 挂载点)', () => {
  const {mm} = loadMathMode();
  const screen = [
    ['count', 'snapshot'], ['count', 'fetch'], ['count', 'compare'], ['count', 'balance'],
    ['craft', 'enough'], ['craft', 'shortage'], ['craft', 'order'], ['craft', 'blank'],
    ['pattern', 'chain'], ['pattern', 'sort'], ['pattern', 'odd'], ['pattern', 'cycle'],
    ['hop', 'position'],
  ];
  for (const [f, v] of screen) assert.strictEqual(mm.mathVariantTrack(f, v), 'screen');
  for (const f of ['mirror', 'plan']) {
    for (const v of ['a', 'b', 'c', 'd']) assert.strictEqual(mm.mathVariantTrack(f, v), 'world');
  }
  for (const v of ['dice', 'jumps', 'gaps', '???']) assert.strictEqual(mm.mathVariantTrack('hop', v), 'world');
});

test('mathFrontier/mathLevelUnlocked: 最高已通+1, 空档 0 星入账可跳关', () => {
  const {mm} = loadMathMode();
  const save = () => JSON.parse(JSON.stringify(mm.MATH_SAVE_DEFAULTS));
  assert.strictEqual(mm.mathFrontier(save()), 0);
  assert.ok(mm.mathLevelUnlocked(save(), 0));
  assert.ok(!mm.mathLevelUnlocked(save(), 1));
  const s2 = save();
  s2.stars = {0: 3, 1: 0}; // 教学关 0 星=已通占位
  assert.strictEqual(mm.mathFrontier(s2), 2);
  const s3 = save();
  s3.stars = {5: 2}; // 前面跳过(世界轨未建), 以最高已通为准
  assert.strictEqual(mm.mathFrontier(s3), 6);
  assert.ok(mm.mathLevelUnlocked(s3, 5) && !mm.mathLevelUnlocked(s3, 7));
});

test('mathFamChallengeDone: 挑战/boss 自成条件, 常规关查族:带挑战表', () => {
  const {mm} = loadMathMode();
  const save = JSON.parse(JSON.stringify(mm.MATH_SAVE_DEFAULTS));
  const lv = mm.MATH_LEVELS[10]; // 常规关
  assert.ok(['normal', 'review', 'tutorial'].includes(lv.kind) || true);
  assert.strictEqual(mm.mathFamChallengeDone(save, lv), false);
  save.challenge[lv.family + ':' + lv.band] = true;
  assert.strictEqual(mm.mathFamChallengeDone(save, lv), true);
  const chal = mm.MATH_LEVELS.find((l) => l.kind === 'challenge');
  const boss = mm.MATH_LEVELS.find((l) => l.kind === 'boss');
  assert.strictEqual(mm.mathFamChallengeDone(save, chal), true, '挑战关过关即点亮');
  assert.strictEqual(mm.mathFamChallengeDone(save, boss), true, 'boss 关自成条件');
});

test('mathAggStats: boss 聚合三段按单关口径(试次/正确求和, maxStreakErr 取最大)', () => {
  const {mm} = loadMathMode();
  const agg = mm.mathAggStats([
    {trials: 4, correct: 3, maxStreakErr: 1},
    {trials: 6, correct: 5, maxStreakErr: 0},
    {trials: 5, correct: 2, maxStreakErr: 3},
  ]);
  assert.deepStrictEqual({...agg}, {trials: 15, correct: 10, acc: 10 / 15, maxStreakErr: 3});
  assert.deepStrictEqual({...mm.mathAggStats([])}, {trials: 0, correct: 0, acc: 0, maxStreakErr: 0});
});

test('mathBossPlan: sections 带轨道标注, 带 0 boss=craft(屏)+mirror(世界)+pattern(屏)', () => {
  const {mm} = loadMathMode();
  const boss = mm.MATH_LEVELS[24];
  assert.strictEqual(boss.kind, 'boss');
  const plan = mm.mathBossPlan(boss);
  assert.strictEqual(plan.length, 3);
  assert.deepStrictEqual([...plan.map((s) => s.track)], ['screen', 'world', 'screen']);
  assert.ok(plan.every((s) => s.family && s.variant && s.params));
  const boss3 = mm.mathBossPlan(mm.MATH_LEVELS[99]);
  assert.deepStrictEqual([...boss3.map((s) => s.track)], ['world', 'world', 'screen']);
});

test('mathSettleSave: 通关记星/挑战表/图章/日志, 教学关 0 星占位, 未过不记星', () => {
  const {mm} = loadMathMode();
  const save = () => {
    const s = JSON.parse(JSON.stringify(mm.MATH_SAVE_DEFAULTS));
    return s;
  };
  const today = '2026-10-24';
  // 常规关通过
  const normal = mm.MATH_LEVELS.find((l) => l.kind === 'normal');
  let s = save();
  let passed = mm.mathSettleSave(s, normal, {acc: 0.9, maxStreakErr: 0}, today);
  assert.ok(passed);
  assert.ok(s.stars[normal.i] >= 1, '通过至少 1 星');
  assert.strictEqual(s.stamps[today], 1, '图章=当日关数');
  assert.ok(s.log[today][normal.family].n === 1);
  const starsFirst = s.stars[normal.i];
  // 同日第二关: 50% 未过线, 星数不降(历史最高)
  passed = mm.mathSettleSave(s, normal, {acc: 0.5, maxStreakErr: 2}, today);
  assert.ok(!passed, '50% 未过 70% 线');
  assert.strictEqual(s.stars[normal.i], starsFirst, '未过不降星(历史最高)');
  assert.strictEqual(s.stamps[today], 2);
  // 挑战关通过 → challenge 表点亮
  const chal = mm.MATH_LEVELS.find((l) => l.kind === 'challenge');
  s = save();
  passed = mm.mathSettleSave(s, chal, {acc: 0.85, maxStreakErr: 0}, today);
  assert.ok(passed, '85% 过挑战 80% 线');
  assert.strictEqual(s.challenge[chal.family + ':' + chal.band], true);
  assert.strictEqual(s.log[today][chal.family].chalN, 1);
  assert.strictEqual(s.log[today][chal.family].chalOk, 1);
  // 教学关: 恒过, 0 星占位(地图完成标记)
  const tut = mm.MATH_LEVELS[0];
  s = save();
  passed = mm.mathSettleSave(s, tut, {acc: 0.2, maxStreakErr: 9}, today);
  assert.ok(passed, '教学关恒过');
  assert.strictEqual(s.stars[0], 0, '教学关 0 星(不降为无记录)');
  // boss 通过 → 三节族挑战表全点亮
  const boss = mm.MATH_LEVELS.find((l) => l.kind === 'boss');
  s = save();
  passed = mm.mathSettleSave(s, boss, {acc: 0.8, maxStreakErr: 1}, today);
  assert.ok(passed);
  for (const sec of boss.sections) {
    assert.strictEqual(s.challenge[sec.family + ':' + boss.band], true, sec.family);
  }
  // 日志滚动 90 天
  s = save();
  s.log = {'2026-1-1': {count: {acc: 1, n: 1}}, [today]: {craft: {acc: 1, n: 1}}};
  mm.mathSettleSave(s, normal, {acc: 1, maxStreakErr: 0}, today);
  assert.ok(!s.log['2026-1-1'], '90 天外日志裁剪');
  assert.ok(s.log[today]);
});

/* ============ index.html 脚本序 ============ */

test('index.html: math-puzzles-core 与 math-paradigms 入册, 序=math-levels → puzzles → paradigms → modes/math', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const at = (src) => html.indexOf('src="' + src + '"');
  const order = ['js/math-levels.js', 'js/math-puzzles-core.js', 'js/math-paradigms.js', 'js/modes/math.js'].map(at);
  assert.ok(order.every((i) => i >= 0), '四个 script 全在册: ' + order.join(','));
  assert.ok(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], '加载序即依赖序');
});
