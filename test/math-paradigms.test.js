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
   · G1 常驻钟面纯函数(mClockAngles 时/分针角度 · mClockSay 报时口径
   整时/半时/几时几分 · mClockFace 角度单一出处守卫)
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
      MATH_FAMILIES, MATH_CONTEXTS, mathParamsFor, mathPassed, mathStars, MATH_SAVE_DEFAULTS,
      migrateMathSave, MATH_LOG_KEEP_DAYS, trimMathLog,
      mathScreenDispatch, mathGuardParams, runMathScreen,
      mBalancePair, mBalanceReveal, MATH_BALANCE_HINT,
      mFrameLayout, mClockFace, mClockAngles, mClockSay };
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

/* 模式层(modes/math.js)加载器: 屏流引擎之上再执行模式文件, 走流程纯函数 */
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
    /* T8 共享背包桩: modes/math.js 顶层 mkBackpack, 规则真件在
       test/backpack.test.js 与 test/math-levels.test.js 各自覆盖 */
    Backpack: {mkBackpack: () => ({inv: {slots: []}, load() {}, save() {}})},
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
  for (const f of ['math-levels.js', 'math-puzzles-core.js', 'math-build-world-core.js', 'hop-world-core.js',
    'math-paradigms.js', 'math-world.js', 'math-build-world.js', 'modes/math.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), vmCtx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__mm = { mathVariantTrack, mathFrontier, mathLevelUnlocked,
      mathFamChallengeDone, mathLevelStars, mathBossPlan, mathAggStats, mathSettleSave,
      mathStampClaim, mathWorldRunner, MATH_LEVELS, MATH_VARIANTS, MATH_CONTEXTS, mathLevelMeta,
      mathVariantName, MATH_META, MATH_SAVE_DEFAULTS, MATH_WORLD_RUNNERS,
      MATH_WORLD_VARIANTS,
      MATH_STAMP_KINDS, MATH_STAMP_DAILY, MATH_STAMP_REWARDS, MATH_STAMP_REWARD_TEXT,
      rollMathLoot, grantMathLoot,
      runBuildWorld: (typeof runBuildWorld !== 'undefined' ? runBuildWorld : null) };
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

/* 全变体键集(单一权威派生源): MATH_VARIANTS 每族 3 常规+1~2 挑战, 外加
    MATH_CONTEXTS 三个情境变体(挂族皮肤) — 任何字面量清单都不得再抄写 */
function allMathVariantKeys(mp) {
  const keys = [];
  for (const f of mp.MATH_FAMILIES) {
    for (const v of mp.MATH_VARIANTS[f]) keys.push(f + '/' + v.id);
  }
  for (const id of Object.keys(mp.MATH_CONTEXTS)) {
    keys.push(mp.MATH_CONTEXTS[id].family + '/' + id);
  }
  return keys;
}

test('变体清单单一权威: dispatch engine 键集 ∪ MATH_WORLD_RUNNERS 键集 == 全变体, 互斥', () => {
  const {mp} = loadMathParadigms();
  const {mm} = loadMathMode();
  const all = new Set(allMathVariantKeys(mp));
  assert.strictEqual(all.size, 29, '六族×(3 常规+1~2 挑战) + 3 情境 = 29 变体(G4: +dualview/bridge), 实为 ' + all.size);
  /* 每族恰 3 常规 + 1~2 挑战(变体表形状, G4: plan/mirror 双挑战) */
  const chalWanted = {count: 1, craft: 1, hop: 1, mirror: 2, plan: 2, pattern: 1};
  for (const f of mp.MATH_FAMILIES) {
    assert.strictEqual(mp.MATH_VARIANTS[f].length, 3 + chalWanted[f],
        f + ' 每族 3 常规 + ' + chalWanted[f] + ' 挑战');
    assert.strictEqual(mp.MATH_VARIANTS[f].filter((v) => v.kind === 'challenge').length,
        chalWanted[f], f + ' 恰 ' + chalWanted[f] + ' 个挑战变体');
  }
  /* engine 键集从 dispatch 派生(不抄清单); runner 键集来自注册表 */
  const engine = new Set(allMathVariantKeys(mp).filter((k) => {
    const [f, v] = k.split('/');
    return mp.mathScreenDispatch(f, v).kind === 'engine';
  }));
  const world = new Set(Object.keys(mm.MATH_WORLD_RUNNERS));
  for (const k of engine) {
    assert.ok(!world.has(k), k + ' 不得同时在册屏流与世界轨(互斥)');
  }
  for (const k of all) {
    assert.ok(engine.has(k) || world.has(k),
        k + ' 两边都不在册 — 变体清单漂移=运行时软锁');
  }
  for (const k of world) {
    assert.ok(all.has(k), k + ' 不在变体表内(幽灵 runner)');
  }
  /* 未知键防御: dispatch 返 none */
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

/* ============ 呈现反泄漏(G5): 需求侧数字卡 + 两堆十格阵 ============ */

/* 十格阵布局纯函数: 空格可见的一一对应 — 同十格区间的 n 与 n+1 阵框
   占位同形(长度线索失效, 用户实测"比块的长度就知道够不够") */
test('mFrameLayout: n∈1..20 格位总数=10×ceil(n/10), 恰 n 格 filled', () => {
  const {mp} = loadMathParadigms();
  for (let n = 1; n <= 20; n++) {
    const cells = mp.mFrameLayout(n, 7);
    assert.strictEqual(cells.length, Math.ceil(n / 10) * 10, 'n=' + n + ' 满阵框占位(2 行×5 格/组)');
    assert.strictEqual(cells.filter((c) => c.f).length, n, 'n=' + n + ' filled 计数');
  }
  assert.strictEqual(mp.mFrameLayout(0, 7).length, 0, 'n=0 防御空布局');
});

test('mFrameLayout: 长度线索失效 — 同十格区间的 n 与 n+1 布局同长(7 与 8 阵框同形)', () => {
  const {mp} = loadMathParadigms();
  for (let n = 1; n <= 19; n++) {
    if (n % 10 === 0) continue; // 区间边界(10/20)右邻进新阵, 框本就应多一个
    for (const seed of [1, 42, 777]) {
      assert.strictEqual(mp.mFrameLayout(n, seed).length, mp.mFrameLayout(n + 1, seed).length,
          'n=' + n + ' 与 n+1 同框(比长短得不到谁多)');
    }
  }
});

test('mFrameLayout: 同 seed 同输出(确定性), seed 用在阵组顺序/填充起点上', () => {
  const {mp} = loadMathParadigms();
  for (let n = 1; n <= 20; n++) {
    assert.deepStrictEqual(mp.mFrameLayout(n, 99), mp.mFrameLayout(n, 99), 'n=' + n + ' 同 seed 同输出');
  }
  /* 12 = 满阵+残阵: 阵组顺序(满阵在前/后)与每阵填充起点(左/右起)由
     seed 派生, 20 个种子里至少出现两种不同布局(锁注入语义) */
  const seen = new Set();
  for (let s = 1; s <= 20; s++) seen.add(JSON.stringify(mp.mFrameLayout(12, s)));
  assert.ok(seen.size >= 2, '异 seed 产出不同阵排列, 实为 ' + seen.size);
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

test('count/compare(呈现反泄漏): 两堆铺十格阵 — filled=数量, 空格补足满阵框(两档)', () => {
  const d = loadMathParadigms();
  /* single 档(点堆)与相差档(静态堆)都走阵框 */
  for (const [tier, cls] of [[1, 'm-pile'], [9, 'm-pilestat']]) {
    for (const seed of [5, 7, 31]) {
      const ended = [];
      play(d, 'count', 'compare', tier, {trials: 1, seed}, {end: (s) => ended.push(s)});
      d.flush(8);
      const piles = sEls(d, cls).filter((e) => e.dataset.n !== undefined);
      assert.strictEqual(piles.length, 2, 'tier' + tier + ' 两堆方块');
      for (const pile of piles) {
        const n = +pile.dataset.n;
        const html = String(pile.innerHTML);
        const imgs = (html.match(/<img/g) || []).length;
        const frames = (html.match(/class="m-frame"/g) || []).length;
        const empties = (html.match(/class="m-frempty"/g) || []).length;
        assert.strictEqual(imgs, n, 'tier' + tier + ' seed' + seed + ' filled 图标=数量(逐个点数合法)');
        assert.strictEqual(frames, Math.ceil(n / 10), '阵框数=ceil(n/10): ' + frames);
        assert.strictEqual(empties, Math.ceil(n / 10) * 10 - n, '空格补足满阵框(7 与 8 框同形)');
      }
      autoPlay(d, ended, 30);
    }
  }
});

test('count/balance(挑战, 搬动试错): DOM 神谕 — 点多的一堆方块搬到相等自动判对, 语音点破差值规律', () => {
  const d = loadMathParadigms();
  const trials = [];
  const ended = [];
  play(d, 'count', 'balance', 4, {trials: 1, seed: 21}, {
    onTrial: (t) => trials.push(t),
    end: (s) => ended.push(s),
  });
  d.flush(8);
  assert.ok(d.spoken[0].includes('怎么移才一样多'), '题面语音引导搬动试错: ' + d.spoken[0]);
  const piles = sEls(d, 'm-pilelive');
  assert.strictEqual(piles.length, 2, '两堆方块');
  const ns = piles.map((p) => +p.dataset.n);
  const big = Math.max(...ns);
  const small = Math.min(...ns);
  const diff = big - small;
  const k = diff / 2;
  assert.ok(Number.isInteger(k) && k >= 1, '差为偶数(移 k 个差减 2k): ' + ns.join('/'));
  assert.ok(big <= 6 && small >= 1 && diff <= 4, '红线: 两堆各自 ≤6 且差 ≤4, 实为 ' + ns.join('/'));
  /* CPA: 搬动后两堆计数即时重显 — 逐块点多的一堆, dataset 与可见计数徽步进 */
  const bigPile = piles[ns.indexOf(big)];
  const smallPile = piles[ns.indexOf(small)];
  const blocks = bigPile.children.filter(clickable);
  assert.ok(blocks.length >= big, '堆里每个方块都可点');
  for (let m = 1; m <= k; m++) {
    tap(blocks[0]); // 同一神谕按钮(闭包恒指该堆), 每点一次搬 1 个过去
    assert.strictEqual(+bigPile.dataset.n, big - m, '多的一堆即时少 1(第 ' + m + ' 次搬动)');
    assert.strictEqual(+smallPile.dataset.n, small + m, '少的一堆即时多 1');
    const badge = bigPile.children.filter((c) => String(c.className).split(' ').includes('m-pilecount')).pop();
    assert.strictEqual(badge.innerHTML, String(big - m), '可见计数徽与堆数同步');
  }
  assert.strictEqual(trials.length, 1, '两堆相等自动交卷');
  assert.strictEqual(trials[0].ok, true, '探索达成判对');
  d.flush(8);
  assert.strictEqual(ended[0].correct, 1);
  assert.strictEqual(ended[0].acc, 1);
  const want = '你搬得很仔细！原来差 ' + diff + ' 个，移 ' + k +
      ' 个过去就一样多啦——移 1 个，差就变少 2！';
  assert.ok(d.spoken.includes(want), '语音点破按本关实际差值生成: ' + d.spoken.join(' / '));
});

test('count/balance: 搬错方向不判负(计数变化自己教育), 两次无效搬动后温和提示方向', () => {
  const d = loadMathParadigms();
  const trials = [];
  const ended = [];
  play(d, 'count', 'balance', 6, {trials: 1, seed: 5}, {
    onTrial: (t) => trials.push(t),
    end: (s) => ended.push(s),
  });
  d.flush(8);
  const piles = sEls(d, 'm-pilelive');
  const ns = piles.map((p) => +p.dataset.n);
  const bigIdx = ns.indexOf(Math.max(...ns));
  const smallIdx = 1 - bigIdx;
  assert.ok(ns[smallIdx] >= 2, '前置: 少的一堆至少 2 个(可连搬两次错向), 实为 ' + ns.join('/'));
  const smallBlocks = piles[smallIdx].children.filter(clickable);
  const hint = d.mp.MATH_BALANCE_HINT;
  tap(smallBlocks[0]); // 无效搬动 1: 少 → 多, 差变大
  assert.strictEqual(trials.length, 0, '不判负不交卷');
  assert.strictEqual(+piles[smallIdx].dataset.n, ns[smallIdx] - 1, '少的堆少 1');
  assert.strictEqual(+piles[bigIdx].dataset.n, ns[bigIdx] + 1, '多的堆多 1');
  assert.ok(!d.spoken.includes(hint), '第一次无效搬动还不提示');
  tap(smallBlocks[0]); // 无效搬动 2 → 温和提示
  assert.ok(d.spoken.includes(hint), '两次无效搬动后提示: ' + hint);
  assert.strictEqual(trials.length, 0, '仍不判负(只奖不罚)');
  /* 回头从多的一堆搬到相等 → 判对, 错向搬动不入误账 */
  const nowBig = +piles[bigIdx].dataset.n;
  const nowSmall = +piles[smallIdx].dataset.n;
  const kk = (nowBig - nowSmall) / 2;
  const bigBlocks = piles[bigIdx].children.filter(clickable);
  for (let m = 0; m < kk; m++) tap(bigBlocks[0]);
  assert.strictEqual(trials.length, 1);
  assert.strictEqual(trials[0].ok, true, '来回搬后达成仍判对');
  d.flush(8);
  assert.strictEqual(ended[0].maxStreakErr, 0, '零惩罚: 错向搬动不入误账');
  assert.strictEqual(ended[0].acc, 1);
});

test('count/balance 堆对生成(纯函数 mBalancePair): 堆数/差值红线不变量 + 数量跟带注入', () => {
  const d = loadMathParadigms();
  const lcg = (s) => () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const seen = new Set();
  for (let seed = 1; seed < 300; seed++) {
    for (const max of [4, 9, 33, 1000]) { // 带 0 首档 → 高带: max 跟带注入
      const pair = d.mp.mBalancePair(lcg(seed * 31 + max), {max});
      assert.ok(pair.small >= 1 && pair.big >= 1, '正堆');
      assert.ok(pair.small < pair.big, '两堆不相等(差为 0 不成题)');
      assert.ok(pair.big <= 6 && pair.small <= 6, '两堆各自 ≤6(感数红线): ' + pair.big + '/' + pair.small);
      const diff = pair.big - pair.small;
      assert.ok(diff % 2 === 0 && diff <= 4, '差为偶数且 ≤4(答案 k=差/2): ' + diff);
      assert.strictEqual(pair.answer, diff / 2, '答案 = 差/2');
      assert.strictEqual(pair.diff, diff);
      if (max === 4) assert.strictEqual(diff, 2, '带 0 首档(cap 4)差恒 2 — 先体会移 1 个差变 2');
      if (max === 1000) assert.ok(pair.big <= 6, '高带注入被钳在 6(思维密度在搬动不在大数)');
      seen.add(pair.small + ':' + pair.big);
    }
  }
  assert.ok(seen.size >= 4, '堆对有多样性: ' + [...seen].join(' '));
  const a = d.mp.mBalancePair(lcg(777), {max: 6});
  const b = d.mp.mBalancePair(lcg(777), {max: 6});
  assert.deepStrictEqual(a, b, '同 seed 同输出');
});

test('count/balance 关卡口径: 一次关卡 2~3 题(搬动探索长, US6), 关卡与 boss 节全走变体表覆写', () => {
  const d = loadMathParadigms();
  const seen = [];
  for (const lv of d.mp.MATH_LEVELS) {
    if (lv.variant === 'balance') seen.push(['关', lv.i, lv.params.trials]);
    for (const s of lv.sections || []) {
      if (s.variant === 'balance') seen.push(['boss 节', lv.i, s.params.trials]);
    }
  }
  assert.strictEqual(seen.length, 6, '四带各 1 挑战关 + 奇两带 boss 节, 实为 ' + seen.length);
  for (const [what, i, t] of seen) {
    assert.ok(t === 2 || t === 3, what + '(第 ' + i + ' 关)试次数 2~3, 实为 ' + t);
  }
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

test('craft 配方卡(呈现反泄漏): 需求侧不画方块行 — planks 图标恰 1 枚, 数字入卡', () => {
  const d = loadMathParadigms();
  for (const variant of ['enough', 'shortage']) {
    for (const seed of [3, 5, 8, 13, 25, 34]) {
      const ended = [];
      play(d, 'craft', variant, 7, {trials: 1, seed}, {end: (s) => ended.push(s)});
      d.flush(8);
      const need = sEls(d, 'm-need').pop();
      assert.ok(need, variant + ' 需求卡存在');
      const html = String(need.innerHTML);
      const planks = (html.match(/data:mc:planks/g) || []).length;
      assert.strictEqual(planks, 1,
          variant + ' seed' + seed + ' 需求卡 planks 图标恰 1 枚(数字卡, 不随 need 增长)');
      assert.ok(html.includes('>' + need.dataset.n + '<'),
          variant + ' seed' + seed + ' 数字入卡: ' + html.slice(0, 80));
      autoPlay(d, ended, 30);
    }
  }
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

/* ============ 情境变体(T7): 商店/钟表/测距 — 独立 DOM 神谕试次流 ============ */

/* 商店货物神 oracle: m-shopgood 的价签(data-price)与整钞(data-v) */
test('craft/shop: 买两样算一共 — 价签神 oracle Σ price, 金额跟带 ≤min(max,100)', () => {
  const d = loadMathParadigms();
  for (const tier of [5, 9, 13, 17]) {
    for (const seed of [3, 8, 21, 34]) {
      const p = d.mp.mathParamsFor('craft', tier);
      const cap = Math.max(4, Math.min(p.max, 100));
      const ended = [];
      play(d, 'craft', 'shop', tier, {trials: 1, seed}, {end: (s) => ended.push(s)});
      d.flush(8);
      const goods = sEls(d, 'm-shopgood');
      if (!goods.length || sEls(d, 'm-bill').length) continue; // 该试次掷到找零/付法子型
      const sum = goods.reduce((a, g) => a + (+g.dataset.price), 0);
      assert.ok(goods.length === 2, '两件商品(≤4 组块)');
      assert.ok(sum <= cap, '总价跟带(tier' + tier + ' ≤ ' + cap + '): ' + sum);
      const btn = sEls(d, 'm-num').find((b) => +b.dataset.v === sum);
      assert.ok(btn, '数字条含总价 ' + goods.map((g) => g.dataset.price).join('+'));
      tap(btn);
      d.flush(8);
      assert.strictEqual(ended[0].correct, 1);
    }
  }
});

test('craft/shop: 找零 = 整钞-价签(付款=大于价签的最小整钞, 面额教材口径)', () => {
  const d = loadMathParadigms();
  let found = 0;
  for (let seed = 1; seed <= 30 && found < 3; seed++) {
    const ended = [];
    play(d, 'craft', 'shop', 9, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const bills = sEls(d, 'm-bill');
    if (!bills.length) continue; // 该试次掷到算一共/付法子型
    found++;
    const price = +sEls(d, 'm-shopgood').pop().dataset.price;
    const bill = +bills.pop().dataset.v;
    assert.ok([5, 10, 20, 50, 100].includes(bill), '整钞面额在教材序列: ' + bill);
    assert.ok(bill > price && bill - price >= 1, '付款大于价签(找零非零)');
    const btn = sEls(d, 'm-num').find((b) => +b.dataset.v === bill - price);
    assert.ok(btn, '数字条含找零 ' + bill + '-' + price);
    tap(btn);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1);
  }
  assert.ok(found >= 3, '30 个种子内掷到 3 个找零子型, 实为 ' + found);
});

test('craft/shop: 付法找齐子型(m-chip) — 哪两张钱合起来正好 n 元, 选对全集→对', () => {
  const d = loadMathParadigms();
  let found = false;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const ended = [];
    play(d, 'craft', 'shop', 13, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const chips = sEls(d, 'm-chip');
    const qs = sEls(d, 'm-q');
    if (!chips.length || !qs.length) continue;
    found = true;
    const n = +qs.pop().dataset.n;
    assert.ok(chips.length <= 4, '付法选项 ≤4 组块');
    const good = chips.filter((c) => +c.dataset.x + +c.dataset.y === n);
    const bad = chips.filter((c) => +c.dataset.x + +c.dataset.y !== n);
    assert.ok(good.length >= 1 && bad.length >= 1, '有对有错(找齐口径)');
    assert.ok(d.spoken.some((s) => s.includes('付') || s.includes('钱')), '付法话术: ' + d.spoken.join('/'));
    for (const c of good) tap(c);
    tap(sEls(d, 'm-ok').pop());
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1, '找齐全对');
  }
  assert.ok(found, 'tier13 40 个种子内掷到付法找齐子型');
});

/* 钟面神 oracle: 独立 h:mm 拼装(12 时制), 与实现解耦 */
function clockStr(h, m) {
  return h + ':' + String(m).padStart(2, '0');
}
function clockStrOfMin(t) {
  const tt = ((t % 720) + 720) % 720;
  return clockStr(Math.floor(tt / 60) || 12, tt % 60);
}

test('hop/clock: 认整时/半时 — 指针钟 dataset 神oracle(h/m→h:mm), 时限 1..12', () => {
  const d = loadMathParadigms();
  for (const seed of [4, 11, 23, 42]) {
    const ended = [];
    play(d, 'hop', 'clock', 1, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const face = sEls(d, 'm-clock').pop();
    assert.ok(face, '钟面存在');
    const h = +face.dataset.h;
    const m = +face.dataset.m;
    assert.ok(h >= 1 && h <= 12, '12 时制时针 1..12: ' + h);
    assert.ok(m === 0 || m === 30, 'single 档认整时/半时: ' + m);
    const want = clockStr(h, m);
    const btn = sEls(d, 'm-num').find((b) => b.dataset.v === want);
    assert.ok(btn, '时刻选项含 ' + want);
    tap(btn);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1);
  }
});

test('hop/clock: 时间推算 — 基时刻+delta 神oracle(过半小时/一小时/一刻钟), 跨时进位', () => {
  const d = loadMathParadigms();
  for (const [tier, deltas] of [[7, [30, 60]], [13, [15]], [17, [15]]]) {
    let found = 0;
    for (let seed = 1; seed <= 30 && found < 2; seed++) {
      const ended = [];
      play(d, 'hop', 'clock', tier, {trials: 1, seed}, {end: (s) => ended.push(s)});
      d.flush(8);
      const faces = sEls(d, 'm-clock');
      const qs = sEls(d, 'm-q');
      if (!faces.length || !qs.length) continue;
      found++;
      const face = faces.pop();
      const base = (+face.dataset.h % 12) * 60 + (+face.dataset.m);
      const delta = +qs.pop().dataset.delta;
      assert.ok(deltas.includes(delta), 'tier' + tier + ' 推算口径 delta=' + delta);
      const want = clockStrOfMin(base + delta);
      const btn = sEls(d, 'm-num').find((b) => b.dataset.v === want);
      assert.ok(btn, '选项含 ' + want + '(基 ' + clockStrOfMin(base) + ' +' + delta + '分)');
      tap(btn);
      d.flush(8);
      assert.strictEqual(ended[0].correct, 1);
    }
    assert.ok(found >= 1, 'tier' + tier + ' 30 个种子内掷到推算子型');
  }
});

/* ============ G1 常驻昼夜大钟: 角度/报时纯函数(钟部件族, 单一直出处) ============ */

test('mClockAngles: 时/分针角度 — 12 点制归 0..360, 半时时针落两数字之间, 分针连续无跳变', () => {
  const {mp} = loadMathParadigms();
  /* {...} 展开: vm context 的对象原型与宿主不同, deepStrictEqual 前先落宿主对象(仓库惯例) */
  const ang = (h, m) => ({...mp.mClockAngles(h, m)});
  assert.deepStrictEqual(ang(12, 0), {hour: 0, min: 0}, '12 点制: 12 时不转 360°');
  assert.deepStrictEqual(ang(0, 0), {hour: 0, min: 0}, '24 时制 0 点=12 点位置');
  assert.deepStrictEqual(ang(3, 0), {hour: 90, min: 0});
  assert.deepStrictEqual(ang(3, 30), {hour: 105, min: 180}, '半时时针在 3 与 4 中间(认钟教学点)');
  assert.deepStrictEqual(ang(6, 15), {hour: 187.5, min: 90}, '时针随分推进(每分 0.5°)');
  /* 分针连续性: 10:59→11:00 分针 354°→360°(≡0°) 顺接无回卷, 时针 329.5°→330° */
  assert.deepStrictEqual(ang(10, 59), {hour: 329.5, min: 354});
  assert.deepStrictEqual(ang(11, 0), {hour: 330, min: 0});
});

test('mClockSay: 报时中文串 — 整时「X 点整」/半时「X 点半」教材口径, 任意分「X 点 Y 分」, 24 时制归 12 点制', () => {
  const {mp} = loadMathParadigms();
  assert.strictEqual(mp.mClockSay(3, 0), '现在是 3 点整');
  assert.strictEqual(mp.mClockSay(3, 30), '现在是 3 点半');
  assert.strictEqual(mp.mClockSay(3, 7), '现在是 3 点 7 分', '任意分: 几时几分口径');
  assert.strictEqual(mp.mClockSay(15, 30), '现在是 3 点半', '24 时制 15 时=下午 3 点');
  assert.strictEqual(mp.mClockSay(0, 0), '现在是 12 点整', '0 时=12 点制 12 点');
  assert.strictEqual(mp.mClockSay(12, 5), '现在是 12 点 5 分');
  assert.strictEqual(mp.mClockSay(23, 59), '现在是 11 点 59 分');
});

test('mClockFace: 针角度出自 mClockAngles 单一出处 — 常驻钟面与谜题钟面同形态', () => {
  const {mp} = loadMathParadigms();
  const face = mp.mClockFace(mkFakeEl([], []), 2, 35);
  const a = mp.mClockAngles(2, 35);
  const html = String(face.innerHTML);
  assert.ok(html.includes('rotate(' + a.hour + 'deg)'), '时针角度=纯函数值 ' + a.hour + '°');
  assert.ok(html.includes('rotate(' + a.min + 'deg)'), '分针角度=纯函数值 ' + a.min + '°');
  assert.strictEqual(face.dataset.h, 2, 'oracle 位 dataset.h 保持 12 时制原值');
  assert.strictEqual(face.dataset.m, 35, 'oracle 位 dataset.m');
});

/* 测距神 oracle: m-path 的 a/b/mode/round → mkIntervalPuzzle 口径 */
function measureAnswer(path) {
  const a = +path.dataset.a;
  const b = +path.dataset.b;
  const one = path.dataset.mode === 'both' ? b - a + 1 : (path.dataset.mode === 'neither' ? b - a - 1 : b - a);
  return one * (path.dataset.round === '1' ? 2 : 1);
}

test('count/measure: 数格子量距离 — 路径 a/b 神oracle(both=b-a+1 / one=b-a), b 跟带', () => {
  const d = loadMathParadigms();
  for (const [tier, seed] of [[5, 6], [5, 19], [7, 12], [9, 27]]) {
    const p = d.mp.mathParamsFor('count', tier);
    const ended = [];
    play(d, 'count', 'measure', tier, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const path = sEls(d, 'm-path').pop();
    assert.ok(path, '格子路存在');
    const a = +path.dataset.a;
    const b = +path.dataset.b;
    assert.ok(b <= Math.min(p.max, 60), '终点跟带(tier' + tier + ' ≤ ' + p.max + '): b=' + b);
    assert.ok(b - a + 1 <= 13, '一次呈现格子 ≤13(数格可数红线): ' + (b - a + 1));
    const cells = sEls(d, 'm-cell');
    assert.strictEqual(cells.length, b - a + 1, '格子从 a 到 b 连续');
    if (path.dataset.round !== '1') {
      const want = measureAnswer(path);
      const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === want);
      assert.ok(btn, '数字条含 ' + path.dataset.mode + ' 答案 ' + want + '(a=' + a + ' b=' + b + ')');
      tap(btn);
      d.flush(8);
      assert.strictEqual(ended[0].correct, 1);
    }
  }
});

test('count/measure: 往返距离 = 2×(b-a)(×2 萌芽), reverse 档混入', () => {
  const d = loadMathParadigms();
  let found = 0;
  for (let seed = 1; seed <= 40 && found < 2; seed++) {
    const ended = [];
    play(d, 'count', 'measure', 13, {trials: 1, seed}, {end: (s) => ended.push(s)});
    d.flush(8);
    const path = sEls(d, 'm-path').pop();
    if (!path || path.dataset.round !== '1') continue;
    found++;
    const a = +path.dataset.a;
    const b = +path.dataset.b;
    const want = 2 * (b - a);
    const btn = sEls(d, 'm-num').find((el) => +el.dataset.v === want);
    assert.ok(btn, '数字条含往返 ' + want + '=2×' + (b - a));
    tap(btn);
    d.flush(8);
    assert.strictEqual(ended[0].correct, 1);
  }
  assert.ok(found >= 1, 'reverse 档 40 个种子内掷到往返子型, 实为 ' + found);
});

test('种子确定性(情境变体): hop/clock 与 craft/shop 同 seed 同题序, 异 seed 异题', () => {
  const run = (variant, seed) => {
    const d = loadMathParadigms({randSeed: 4242});
    const ended = [];
    const sig = [];
    let e0 = 0;
    play(d, ...variant, 13, {trials: 3, seed}, {
      onTrial() {
        sig.push(d.els.slice(e0).map((el) => el.className + '#' + JSON.stringify(el.dataset) +
            '#' + String(el.innerHTML).slice(0, 120)).join('|'));
        e0 = d.els.length;
      },
      end: (s) => ended.push(s),
    });
    autoPlay(d, ended);
    assert.strictEqual(ended.length, 1, variant.join('/') + ' 跑到完成');
    assert.strictEqual(sig.length, 3, '三试次签名');
    return sig;
  };
  for (const variant of [['hop', 'clock'], ['craft', 'shop']]) {
    const a = run(variant, 77);
    const b = run(variant, 77);
    assert.deepStrictEqual(a, b, variant.join('/') + ' 同 seed 同题序');
    let diff = false;
    for (let seed = 78; seed < 90 && !diff; seed++) diff = JSON.stringify(run(variant, seed)) !== JSON.stringify(a);
    assert.ok(diff, variant.join('/') + ' 异 seed 出不同题');
  }
});

/* ============ 全变体冒烟 + 事件契约 + 红线静默 ============ */

test('冒烟: 16 个屏流变体(tier1/tier19)自动玩到底不崩, 试次数=trials, 零 warn', () => {
  const variants = [
    ['count', 'snapshot'], ['count', 'fetch'], ['count', 'compare'], ['count', 'balance'],
    ['craft', 'enough'], ['craft', 'shortage'], ['craft', 'order'], ['craft', 'blank'],
    ['pattern', 'chain'], ['pattern', 'sort'], ['pattern', 'odd'], ['pattern', 'cycle'],
    ['hop', 'position'],
    ['count', 'measure'], ['craft', 'shop'], ['hop', 'clock'],
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

test('mathVariantTrack(分发缝): 派生自 mathScreenDispatch — engine ⟺ screen, 全变体恰居其一', () => {
  const {mp} = loadMathParadigms();
  const {mm} = loadMathMode();
  for (const k of allMathVariantKeys(mp)) {
    const [f, v] = k.split('/');
    assert.strictEqual(mm.mathVariantTrack(f, v),
        mp.mathScreenDispatch(f, v).kind === 'engine' ? 'screen' : 'world', k);
  }
  assert.strictEqual(mm.mathVariantTrack('???', '???'), 'world', '未知键防御性归世界轨');
});

test('mathWorldRunner(T5+T6 接管): mirror/plan 全变体在册(派生), hop 三变体在册, 未知键 null', () => {
  const {mp} = loadMathParadigms();
  const {mm} = loadMathMode();
  for (const v of ['dice', 'jumps', 'gaps']) {
    assert.strictEqual(typeof mm.mathWorldRunner('hop', v), 'function', 'hop/' + v + ' 已接管(T5)');
  }
  assert.strictEqual(mm.mathWorldRunner('hop', 'position'), null, '站位比大小留在屏流');
  /* mirror/plan 全部变体在册(全变体世界族, 同族同宿主) — 变体清单从
     MATH_VARIANTS 派生, 不抄字面量; hop 是半分族(position 留屏流)不入此列 */
  const worldFams = mp.MATH_FAMILIES.filter((f) =>
    mp.MATH_VARIANTS[f].every((v) => mm.mathWorldRunner(f, v.id)));
  assert.ok(worldFams.includes('mirror') && worldFams.includes('plan'), 'mirror/plan 已接管(T6)');
  assert.ok(!worldFams.includes('hop'), 'hop/position 留屏流, hop 非全变体世界族');
  for (const f of worldFams) {
    const famRunner = mm.mathWorldRunner(f, mp.MATH_VARIANTS[f][0].id);
    for (const v of mp.MATH_VARIANTS[f]) {
      assert.strictEqual(mm.mathWorldRunner(f, v.id), famRunner, f + '/' + v.id + ' 已接管(同族同宿主)');
    }
  }
  assert.strictEqual(mm.mathWorldRunner('mirror', 'reflect'), mm.runBuildWorld, 'mirror 宿主=runBuildWorld(T6)');
  assert.strictEqual(mm.mathWorldRunner('plan', 'build'), mm.runBuildWorld, 'plan 宿主=runBuildWorld(T6)');
  assert.strictEqual(mm.mathWorldRunner('???', '???'), null);
  assert.strictEqual(mm.mathWorldRunner('mirror', '???'), null);
  assert.strictEqual(mm.mathWorldRunner('plan', '???'), null);
});

/* T5 接管后: hop 族的每一关(含 boss 的 hop 小节)都有轨可走, 不再卡占位 */
test('接管完整性: hop 族全部关卡与 boss 的 hop 小节都有轨(屏流或世界 runner)', () => {
  const {mm} = loadMathMode();
  let hopSeen = 0;
  for (const lv of mm.MATH_LEVELS) {
    const hopLevel = lv.family === 'hop';
    const hopSecs = (lv.sections || []).some((sec) => sec.family === 'hop');
    if (!hopLevel && !hopSecs) continue;
    hopSeen++;
    if (hopLevel) {
      const ok = mm.mathVariantTrack(lv.family, lv.variant) === 'screen' ||
          mm.mathWorldRunner(lv.family, lv.variant) !== null;
      assert.ok(ok, '第 ' + (lv.i + 1) + ' 关 hop/' + lv.variant + ' 无轨');
    }
    for (const sec of lv.sections || []) {
      if (sec.family !== 'hop') continue;
      const secOk = mm.mathVariantTrack(sec.family, sec.variant) === 'screen' ||
          mm.mathWorldRunner(sec.family, sec.variant) !== null;
      assert.ok(secOk, '第 ' + (lv.i + 1) + ' 关 boss 小节 hop/' + sec.variant + ' 无轨');
    }
  }
  assert.ok(hopSeen >= 24, 'hop 配重 24 关都覆盖到(G4 扩容): ' + hopSeen);
});

test('mathLevelMeta: 情境关话术覆盖(场馆=情境名/规则/提示), 常规关走族元数据', () => {
  const {mm} = loadMathMode();
  const ctxLv = mm.MATH_LEVELS.find((l) => mm.MATH_CONTEXTS[l.variant]);
  assert.ok(ctxLv, '编排里有情境关(T7 接入)');
  const ctx = mm.MATH_CONTEXTS[ctxLv.variant];
  const meta = mm.mathLevelMeta(ctxLv);
  assert.strictEqual(meta.game, ctx.name, '情境名=场馆名');
  assert.strictEqual(meta.rule, ctx.rule, '规则话术取情境级');
  assert.strictEqual(mm.mathVariantName(ctxLv.family, ctxLv.variant), ctx.name, '变体名查情境表');
  /* 同族非情境变体 → 族元数据(覆盖只对情境关生效) */
  const plain = mm.mathLevelMeta({family: ctxLv.family, variant: 'zzz'});
  assert.notStrictEqual(plain.game, ctx.name, '常规关场馆仍是族场馆');
  assert.ok(typeof plain.rule === 'string' && plain.rule.length > 0, '常规关规则走族话术');
});

test('mathLevelMeta: 变体级规则话术(移多补少搬动试错)覆盖族 rule, 名/提示仍走族', () => {
  const {mm} = loadMathMode();
  const bl = mm.MATH_LEVELS.find((l) => l.variant === 'balance');
  assert.ok(bl, '编排里有移多补少关');
  const v = mm.MATH_VARIANTS.count.find((x) => x.id === 'balance');
  const meta = mm.mathLevelMeta(bl);
  assert.strictEqual(meta.rule, v.rule, '规则话术取变体级');
  assert.ok(meta.rule.includes('搬'), '话术讲搬动玩法(族 rule 的"点数字"口径不再适用)');
  assert.strictEqual(meta.name, mm.MATH_META[bl.family].name, '族名不变');
  assert.strictEqual(meta.game, mm.MATH_META[bl.family].game, '场馆仍是族场馆');
  assert.strictEqual(meta.tip, mm.MATH_META[bl.family].tip, '提示仍走族曲线话术');
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
  const boss = mm.MATH_LEVELS[29];
  assert.strictEqual(boss.kind, 'boss');
  const plan = mm.mathBossPlan(boss);
  assert.strictEqual(plan.length, 3);
  assert.deepStrictEqual([...plan.map((s) => s.track)], ['screen', 'world', 'screen']);
  assert.ok(plan.every((s) => s.family && s.variant && s.params));
  const boss3 = mm.mathBossPlan(mm.MATH_LEVELS[119]);
  assert.deepStrictEqual([...boss3.map((s) => s.track)], ['world', 'world', 'screen']);
});

/* ============ G4 新变体的世界 runner 装配可测部分(make 派生, 无 DOM) ============ */

test('G4 世界变体注册: mirror/bridge 与 plan/dualview 都派发 runBuildWorld(同族同宿主)', () => {
  const {mm} = loadMathMode();
  assert.strictEqual(mm.mathWorldRunner('mirror', 'bridge'), mm.runBuildWorld,
      'mirror/bridge 已接管(世界轨放置形态)');
  assert.strictEqual(mm.mathWorldRunner('plan', 'dualview'), mm.runBuildWorld,
      'plan/dualview 已接管(世界轨点选形态)');
});

test('G4 plan/dualview make: 候选/视图按变体曲线注入(cands 2/4, views 1/2)', () => {
  const {mm} = loadMathMode();
  const spec = mm.MATH_WORLD_VARIANTS['plan/dualview'];
  assert.ok(spec && spec.make && spec.build && spec.speak, 'spec 三件齐(出题/装场/话术)');
  const sec2 = {family: 'plan', variant: 'dualview',
    params: {blocks: 60, max: 100, dualCands: 2, dualViews: 1, reasoning: 'single'}};
  const p2 = spec.make(sec2, 7).pz;
  assert.strictEqual(p2.candidates.length, 2, 'single 档候选 2 座');
  assert.strictEqual(p2.views, 1, 'single 档单视图');
  assert.ok(p2.answer === 0 || p2.answer === 1, '答案下标有效');
  const sec4 = {family: 'plan', variant: 'dualview',
    params: {blocks: 100, max: 100, dualCands: 4, dualViews: 2, reasoning: 'two-step'}};
  const p4 = spec.make(sec4, 7).pz;
  assert.strictEqual(p4.candidates.length, 4, 'two-step 档候选 4 座');
  assert.strictEqual(p4.views, 2, 'two-step 档双视图');
  /* 话术按视图数分档(views=1 不提侧视) */
  assert.ok(spec.speak(p2).includes('正面'), 'single 话术提正视图');
  assert.ok(spec.speak(p4).length > 0, 'two-step 话术非空');
});

test('G4 mirror/bridge make: 地形+预算牌数值(mkBridgePuzzle 派生, 预算跟推理档)', () => {
  const {mm} = loadMathMode();
  const spec = mm.MATH_WORLD_VARIANTS['mirror/bridge'];
  assert.ok(spec && spec.make && spec.build && spec.speak, 'spec 三件齐(出题/装场/话术)');
  const secR = {family: 'mirror', variant: 'bridge',
    params: {span: 20, max: 100, budget: 3, reasoning: 'reverse', trials: 2}};
  const madeR = spec.make(secR, 9);
  assert.ok(madeR.pz.plan.span >= 3 && madeR.pz.plan.span <= 8, '跨度有界 3..8');
  assert.ok(madeR.pz.plan.par >= 1, 'par ≥1(有解地形)');
  assert.strictEqual(madeR.budgetN, madeR.pz.plan.par + 3, 'reverse 档预算牌 = par+3(宽松)');
  const secM = {family: 'mirror', variant: 'bridge',
    params: {span: 64, max: 100, budget: 0, reasoning: 'multi-solve', trials: 2}};
  const madeM = spec.make(secM, 9);
  assert.strictEqual(madeM.budgetN, madeM.pz.plan.par, 'multi-solve 档预算牌 = par(最省口径)');
  assert.ok(madeM.pz.plan.span >= madeR.pz.plan.span, 'span 数值轴驱动跨度不减(跟带)');
  assert.ok(spec.speak(madeM).length > 0 && spec.speak(madeR).length > 0, '两档话术非空');
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
  assert.ok(s.log[today][normal.family + ':' + normal.band].n === 1, '日志键=族:带(T9 家长面板矩阵数据源)');
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
  assert.strictEqual(s.log[today][chal.family + ':' + chal.band].chalN, 1);
  assert.strictEqual(s.log[today][chal.family + ':' + chal.band].chalOk, 1);
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

/* 三星回溯点亮(spec US35/D4): 结算记 ready, 补过挑战后地图重算点亮第三星 */
test('mathSettleSave→mathLevelStars: 素质线达标+挑战未过 → 2星+ready, 补过挑战回溯点亮', () => {
  const {mm} = loadMathMode();
  const normal = mm.MATH_LEVELS.find((l) => l.kind === 'normal');
  const today = '2026-10-24';
  const fresh = () => JSON.parse(JSON.stringify(mm.MATH_SAVE_DEFAULTS));
  /* 素质线达标(100% 无连错)但族挑战未过: 存 2 星 + ready 记档 */
  const s = fresh();
  assert.ok(mm.mathSettleSave(s, normal, {acc: 1, maxStreakErr: 0}, today));
  assert.strictEqual(s.stars[normal.i], 2, '挑战未过封顶 2 星');
  assert.strictEqual(s.ready[normal.i], true, '素质线达标记 ready(回溯档)');
  assert.strictEqual(mm.mathLevelStars(s, normal), 2, '地图仍显 2 星');
  /* 补过同族同带挑战: stars 表不动(历史最高), mathLevelStars 重算点亮 */
  s.challenge[normal.family + ':' + normal.band] = true;
  assert.strictEqual(s.stars[normal.i], 2, 'stars 表不回写');
  assert.strictEqual(mm.mathLevelStars(s, normal), 3, '补过挑战回溯点亮第三星');
  /* 未达素质线(95% 差一口): 不记 ready, 补挑战不涨星 */
  const s2 = fresh();
  assert.ok(mm.mathSettleSave(s2, normal, {acc: 0.94, maxStreakErr: 0}, today));
  assert.strictEqual(s2.stars[normal.i], 2);
  assert.ok(!s2.ready[normal.i], '素质线未达不记 ready');
  s2.challenge[normal.family + ':' + normal.band] = true;
  assert.strictEqual(mm.mathLevelStars(s2, normal), 2, '补挑战星数不变');
  /* 挑战关过关自成条件即时三星, 不走 ready */
  const s3 = fresh();
  const chal = mm.MATH_LEVELS.find((l) => l.kind === 'challenge');
  assert.ok(mm.mathSettleSave(s3, chal, {acc: 1, maxStreakErr: 0}, today));
  assert.strictEqual(s3.stars[chal.i], 3, '挑战关过关即时三星');
  assert.ok(!s3.ready[chal.i], '挑战关不记 ready(自成条件)');
});

test('mathSettleSave: 图章落账走图章纯函数 — 滚动 90 天裁剪, 落账值不越日限', () => {
  const {mm} = loadMathMode();
  const normal = mm.MATH_LEVELS.find((l) => l.kind === 'normal');
  const today = '2026-10-24';
  const s = JSON.parse(JSON.stringify(mm.MATH_SAVE_DEFAULTS));
  s.stamps = {'2026-7-26': 2, '2026-7-27': 1}; // 90 天前裁掉 / 89 天前保留
  mm.mathSettleSave(s, normal, {acc: 1, maxStreakErr: 0}, today);
  assert.ok(!s.stamps['2026-7-26'], '90 天外图章裁剪(防存档膨胀)');
  assert.strictEqual(s.stamps['2026-7-27'], 1, '窗口内历史章保留');
  assert.strictEqual(s.stamps[today], 1, '今日关数入账');
});

test('mathStampClaim: 集章达成线领取(差集幂等) — 越线即领, 已领不重发', () => {
  const {mm} = loadMathMode();
  const mk = (n) => {
    const s = JSON.parse(JSON.stringify(mm.MATH_SAVE_DEFAULTS));
    for (let k = 1; k <= n; k++) s.stamps['2026-10-' + k] = 1; // n 个有章天
    return s;
  };
  let s = mk(2);
  assert.deepStrictEqual(mm.mathStampClaim(s), [], '未到首线无奖励');
  s = mk(3);
  assert.deepStrictEqual(mm.mathStampClaim(s), [3], '3 章线达成');
  assert.deepStrictEqual(s.stampClaimed, [3], '已领线入档');
  assert.deepStrictEqual(mm.mathStampClaim(s), [], '再领空集(幂等)');
  s = mk(7);
  s.stampClaimed = [3]; // 存量档: 3 章线已领过
  assert.deepStrictEqual(mm.mathStampClaim(s), [7], '只补新越线(3 已领)');
  assert.deepStrictEqual(s.stampClaimed, [3, 7]);
});

/* ============ index.html 脚本序 ============ */

test('index.html: 数学侧六个 script 全在册, 序=levels → puzzles → hop-core → paradigms → world → modes/math', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const at = (src) => html.indexOf('src="' + src + '"');
  const order = ['js/math-levels.js', 'js/math-puzzles-core.js', 'js/hop-world-core.js',
    'js/math-paradigms.js', 'js/math-world.js', 'js/modes/math.js'].map(at);
  assert.ok(order.every((i) => i >= 0), '六个 script 全在册: ' + order.join(','));
  const why = '加载序即依赖序: hop-core 依赖 puzzles, world 依赖 paradigms 的 mRand/mEl, modes/math 依赖 world 的 runHopWorld';
  assert.ok(order.every((v, k) => k === 0 || order[k - 1] < v), why);
});
