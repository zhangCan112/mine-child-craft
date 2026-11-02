'use strict';
/* 摆与搭世界引擎装配级单测 — node --test (零依赖)
   运行: node --test test/math-build-world.test.js
   对应模块: js/math-build-world.js(摆与搭世界引擎, 指针锁宿主)
   为什么存在: 纯核心单测(math-build-world-core.test.js)够不到「装场坐标
   缝」— 引擎把孩子的世界块换算回谜题局部系的 ax/ay/az 偏移(放置记录器
   onMouse 与各变体 build 返回值之间的约定)曾经错位, 最省桥任何摆法判分
   恒 false(27/27 与 30/30 全失败)而纯核心全绿 — 判分函数对、喂进去的
   坐标错。本文件以 vm 桩直载真引擎(math-track.test.js loadTrackHosts
   同款分层口径: 出题/判分走真件, 场景装配走桩), 经 onMouse 逼真重放
   「canPlace 许可的摆放」, 装配级钉住:
   · mirror/bridge: 按 canPlace 摆出 par 最优桥必判过(reverse 能过/
     multi-solve 最省, ≥3 个 span/推理档 × 多种子)
   · mirror/translate: 解必可摆 — 平移像逐格落在缺省摆放界内且判过
     (2026-10 归零修复回归, 多种子)
   · 教学关(kind='tutorial')首试次操作教学前置 — 摆一摆教瞄准/撤除/
     交卷, 搭一搭补换色; 常规关不插播
   加载器: vm context 依次执行 rand-core → camp-core → math-levels →
   math-puzzles-core → math-build-world-core → math-track-core →
   math-build-world(镜像 index.html 共享词法环境相对序); 谜题侧对照
   数据(plan/最优桥/平移像)在 Node 侧 require 同一批真件同 seed 复算。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* Node 侧真件: 谜题对照数据复算用(与 vm 里加载的是同一批文件) */
global.RandCore = require('../js/rand-core.js');
global.PuzzleCore = require('../js/math-puzzles-core.js');
const BuildWorldCore = require('../js/math-build-world-core.js');

/* ============ 装载器: 假 DOM / 桩 ============ */

const CTX_2D = {
  font: '', textAlign: '', textBaseline: '', lineWidth: 0,
  strokeStyle: '', fillStyle: '',
  strokeText() {}, fillText() {}, fillRect() {}, clearRect() {},
};
function mkFakeEl(els) {
  const el = {
    className: '', textContent: '', innerHTML: '', style: {}, dataset: {},
    children: [], onclick: null,
    classList: {
      add() {}, remove() {}, toggle() {}, contains() {
        return false;
      },
    },
    appendChild(c) {
      el.children.push(c);
      return c;
    },
    addEventListener() {}, removeEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    remove() {},
  };
  els.push(el);
  return el;
}
function mkFakeCanvas(els) {
  const cv = {width: 0, height: 0, style: {}, getContext: () => CTX_2D};
  els.push(cv);
  return cv;
}

function loadBuildWorld() {
  const els = [];
  const clearCalls = [];
  const touchLog = [];
  const hbLog = [];
  const spoken = [];
  const hints = [];
  const edits = []; // {x, y, z, id} — 放置记录器落块的实际世界坐标
  const blocks = new Map(); // "x,y,z" → id — 装场 setBlockRaw/SceneKit.fill 记录器
  const timers = [];
  let nowT = 0; // 提示节流时钟: 每次读取推进 1300ms(> 1200 节流窗), 提示全量记录
  const sandbox = {
    console: {warn() {}, log() {}, error() {}},
    performance: {now: () => (nowT += 1300)},
    setTimeout(fn) {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {},
    document: {
      createElement: (tag) => (tag === 'canvas' ? mkFakeCanvas(els) : mkFakeEl(els)),
      getElementById: () => null,
      body: {appendChild() {}},
    },
    SpeechKit: {speak: (s) => spoken.push(String(s)), cancel() {}},
    sfx() {},
    mcIcon: (n) => 'data:mc:' + n,
    showToast: (m) => hints.push(String(m)),
    mkHotbar: () => ({sel: 0,
      show() {
        hbLog.push('show');
      },
      hide() {
        hbLog.push('hide');
      },
      select() {}, refresh() {}, render() {}}),
    ModeKit: {spawn() {}},
    SceneKit: {fill(x1, y1, z1, x2, y2, z2, id) {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          for (let z = z1; z <= z2; z++) blocks.set(x + ',' + y + ',' + z, id);
        }
      }
    }, tree() {}, scatter() {}},
    loadScene(fn) {
      if (fn) fn(); // 装场 seam: 同步直跑(与 math-track.test.js 同口径)
    },
    clearWorld() {
      clearCalls.push(clearCalls.length + 1);
      blocks.clear();
    },
    setBlockRaw(x, y, z, id) {
      blocks.set(x + ',' + y + ',' + z, id);
    },
    getBlock: () => 0, // 画布恒空: 放置不因占位被拒
    editBlock(x, y, z, id) {
      edits.push({x, y, z, id});
    },
    collidesAtPlayer: () => false,
    requestLock() {},
    setTouchActions: (l) => touchLog.push(l),
    aimClick() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['rand-core.js', 'camp-core.js', 'math-levels.js', 'math-puzzles-core.js',
    'math-build-world-core.js', 'math-track-core.js', 'math-build-world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx,
        {filename: f});
  }
  vm.runInContext('globalThis.__t = { runBuildWorld, MATH_WORLD, MATH_WORLD_VARIANTS };', ctx);
  return {
    t: sandbox.__t, run: sandbox.__t.runBuildWorld, MATH_WORLD: sandbox.__t.MATH_WORLD,
    spoken, hints, edits, clearCalls, timers, blocks,
    flush(max) {
      let n = 0;
      while (timers.length && n < (max || 200)) {
        timers.shift()();
        n++;
      }
      return n;
    },
  };
}

/* 瞄准命中(hit)合成: 在世界格 (tx,ty,tz) 的顶面放置 = hit 在其正下方
   一格、法线朝上 — 与引擎 aimClick 射线命中同构 */
const hitTopOf = (tx, ty, tz) => ({x: tx, y: ty - 1, z: tz, nx: 0, ny: 1, nz: 0});

/* ============ mirror/bridge: 装配级判分坐标回归(P0) ============ */

/* 暴力对拍神谕(与 math-build-world-core.test.js 同款): 枚举每列步行高度,
   取满足步行约束的最小总块数, 并回传最优桥面高数组(供实搭对账) */
function brutePar(plan) {
  const {span, yL, yR, piers, capY} = plan;
  const pierTop = {};
  for (const p of piers) pierTop[p.x] = p.top;
  let best = Infinity;
  let bestW = null;
  const w = new Array(span).fill(0);
  const rec = (i) => {
    if (i === span) {
      if (Math.abs(w[0] - yL) > 1 || Math.abs(w[span - 1] - yR) > 1) return;
      let cost = 0;
      for (let x = 0; x < span; x++) {
        const px = x + 1;
        cost += pierTop[px] !== undefined ? Math.max(0, w[x] - pierTop[px]) : w[x];
      }
      if (cost < best) {
        best = cost;
        bestW = w.slice();
      }
      return;
    }
    for (let hh = 1; hh <= capY; hh++) {
      const px = i + 1;
      if (pierTop[px] !== undefined && hh < pierTop[px]) continue;
      if (i > 0 && Math.abs(hh - w[i - 1]) > 1) continue;
      w[i] = hh;
      rec(i + 1);
    }
  };
  rec(0);
  return {par: best, w: bestW};
}

/* 最优桥的世界放置坐标序列: 桥轴原点/河床行的换算公式与引擎 build 同源
   (xB0 = 64-⌊(span+2)/2⌋ · zW=64 · 河床行 y=groundY) */
function parBridgeWorldCells(plan, groundY) {
  const opt = brutePar(plan);
  assert.strictEqual(opt.par, plan.par, '暴力神谕与 plan.par 一致(前置)');
  const xB0 = 64 - Math.floor((plan.span + 2) / 2);
  const pierTop = {};
  for (const p of plan.piers) pierTop[p.x] = p.top;
  const out = [];
  for (let i = 0; i < opt.w.length; i++) {
    const x = plan.x0 + i; // 桥轴局部 x(1..span)
    const from = pierTop[x] || 0; // 墩列从墩顶码起
    for (let y = from; y < opt.w[i]; y++) {
      out.push({tx: xB0 + x, ty: groundY + y, tz: 64});
    }
  }
  return out;
}

test('mirror/bridge 装配级: canPlace 许可的 par 桥摆完判过 — 3 档 span/推理 × 3 种子', () => {
  for (const [span, max, reasoning, budget] of [
    [8, 20, 'reverse', 3], // 小预算起步: 跨 3 桥(带 1 首遇宽松档)
    [20, 100, 'reverse', 3], // 中跨桥
    [40, 100, 'multi-solve', 0], // 长跨桥 + 最省口径(0 预算冗余)
  ]) {
    for (const s of [0, 1, 2]) {
      const d = loadBuildWorld();
      const trials = [];
      const ended = [];
      const sec = {family: 'mirror', variant: 'bridge', tier: 1, kind: 'normal',
        params: {span, max, budget, reasoning, trials: 1}, seed: 40 + s};
      const h = d.run(sec, {onTrial: (t) => trials.push(t), end: (st) => ended.push(st)});
      assert.ok(h && typeof h.onMouse === 'function' && typeof h.stop === 'function',
          '返回 {stop, onMouse} 控制柄');
      /* 同 seed 复算地形与最优桥(Node 侧真件, 引擎内同 seed 同输出) */
      const seed = RandCore.seedAt(sec.seed, 0);
      const plan = BuildWorldCore.mkBridgePuzzle(
          {seed, blocks: span, max}).plan;
      const cells = parBridgeWorldCells(plan, d.MATH_WORLD.groundY);
      assert.strictEqual(d.hints.length, 0, '摆前无提示(前置确认装场已发生)');
      for (const c of cells) {
        h.onMouse(2, hitTopOf(c.tx, c.ty, c.tz));
      }
      /* 修复前: 放置记录器缺 ax/az(/ay), 每块记成 plan 坐标 +3/+4/y 差 1,
         bridgeGrade 三判据恒 false — 此断言即 P0 回归钉 */
      assert.strictEqual(trials.length, 1, 'span=' + span + ' seed=' + s +
        ' 摆完自动判分恰一次');
      assert.strictEqual(trials[0].ok, true, 'span=' + span + ' seed=' + s +
        ' ' + reasoning + ' 档: canPlace 许可的 par 桥判过');
      assert.strictEqual(d.hints.length, 0, '全程无「放不进」提示(每块都在建造区)');
      assert.strictEqual(d.edits.length, cells.length,
          '每块都真落场(无因判分提前 settle 丢块)');
      d.flush();
      assert.strictEqual(ended.length, 1, '试次收口 end 恰一次');
      h.stop();
    }
  }
});

test('mirror/bridge 装配级(反例): 断桥(缺列)不判过 — 坐标修复不放大误判', () => {
  const d = loadBuildWorld();
  const trials = [];
  const sec = {family: 'mirror', variant: 'bridge', tier: 1, kind: 'normal',
    params: {span: 20, max: 100, budget: 3, reasoning: 'reverse', trials: 1}, seed: 40};
  const h = d.run(sec, {onTrial: (t) => trials.push(t), end() {}});
  const seed = RandCore.seedAt(sec.seed, 0);
  const plan = BuildWorldCore.mkBridgePuzzle({seed, blocks: 20, max: 100}).plan;
  const cells = parBridgeWorldCells(plan, d.MATH_WORLD.groundY);
  for (let i = 0; i < cells.length - 1; i++) { // 少摆最后一块 = 缺列断桥
    h.onMouse(2, hitTopOf(cells[i].tx, cells[i].ty, cells[i].tz));
  }
  assert.strictEqual(trials.length, 0, '断桥不自动判过(修复不把错误摆法放大成对)');
  h.onMouse(2, {x: cells[0].tx, y: d.MATH_WORLD.groundY + plan.capY + 1, z: cells[0].tz,
    nx: 0, ny: 1, nz: 0}); // 超建造上限的一块 → canPlace 拒
  assert.ok(d.hints.length > 0, '越界放置给出 placeHint');
  h.stop();
});

/* ============ mirror/translate: 解必可摆(装配侧, 2026-10 归零修复回归) ============ */

test('mirror/translate 装配级: 平移像逐格摆进缺省摆放界判过 — 12 种子连续试次', () => {
  const d = loadBuildWorld();
  const trials = [];
  const ended = [];
  const N = 12;
  const sec = {family: 'mirror', variant: 'translate', tier: 1, kind: 'normal',
    params: {span: 12, layerRate: 0.2, trials: N}, seed: 7};
  const h = d.run(sec, {onTrial: (t) => trials.push(t), end: (st) => ended.push(st)});
  const Y = d.MATH_WORLD.groundY;
  for (let idx = 0; idx < N; idx++) {
    const seed = RandCore.seedAt(sec.seed, idx);
    const pz = BuildWorldCore.mkWorldTranslate({seed, span: 12, layerRate: 0.2});
    /* 孩子要摆的 = 解减样品(平移像); 装场把样品画在居中画布原点 */
    const moved = pz.solution.filter((c) => !pz.sample.some((s) =>
      s.x === c.x && s.y === c.y && s.z === c.z));
    const x0 = 64 - Math.floor(pz.box.w / 2);
    const z0 = 64 - Math.floor(pz.box.d / 2);
    for (const c of moved) {
      h.onMouse(2, hitTopOf(x0 + c.x, Y + 1 + c.y, z0 + c.z));
    }
    assert.strictEqual(trials.length, idx + 1, '试次 ' + idx + ' 摆完自动判分');
    assert.strictEqual(trials[idx].ok, true, 'seed' + seed +
      ' 平移像摆得进画布且判过(修复前 ~2 成种子物理摆不进)');
    assert.strictEqual(d.hints.length, 0, '试次 ' + idx + ' 无「要摆在白色画布里」提示');
    d.flush(); // 结算计时器 → 下一试次(或 end)
  }
  assert.strictEqual(ended.length, 1, '全试次收口 end 恰一次');
  assert.strictEqual(ended[0].correct, N, '试次全对');
  h.stop();
});

/* ============ mirror/translate: 交卷近似纠偏话术(2026-11 摆位迷惑票) ============ */

test('mirror/translate 交卷近似: 形状全对整座差一格 → 纠偏话术且判本试次不过', () => {
  const movedOf = (pz) => pz.solution.filter((c) => !pz.sample.some((s) =>
    s.x === c.x && s.y === c.y && s.z === c.z));
  const sec = {family: 'mirror', variant: 'translate', tier: 1, kind: 'normal',
    params: {span: 12, layerRate: 0.2, trials: 1}, seed: 9};
  const setup = (d) => {
    const trials = [];
    const h = d.run(sec, {onTrial: (t) => trials.push(t), end() {}});
    const pz = BuildWorldCore.mkWorldTranslate(
        {seed: RandCore.seedAt(sec.seed, 0), span: 12, layerRate: 0.2});
    return {trials, h, pz,
      x0: 64 - Math.floor(pz.box.w / 2), z0: 64 - Math.floor(pz.box.d / 2),
      Y: d.MATH_WORLD.groundY};
  };
  /* 交卷 = 敲发光石(wwCheckBlock: 画布中线上, 南缘外 2 格, 基座顶) */
  const submit = (t) => {
    t.h.onMouse(2, {x: t.x0 + Math.floor(t.pz.box.w / 2), y: t.Y + 2,
      z: t.z0 + t.pz.box.d + 2, nx: 0, ny: 1, nz: 0});
  };
  /* 正例: 照平移像摆但整座右偏 1 格 → 不自动判过; 交卷判不过 + 纠偏话术 */
  let d = loadBuildWorld();
  let t = setup(d);
  for (const c of movedOf(t.pz)) {
    t.h.onMouse(2, hitTopOf(t.x0 + c.x + 1, t.Y + 1 + c.y, t.z0 + c.z));
  }
  assert.strictEqual(t.trials.length, 0, '错位摆放不自动判过');
  submit(t);
  assert.strictEqual(t.trials.length, 1, '交卷才结算');
  assert.strictEqual(t.trials[0].ok, false, '交卷判本试次不过(判分语义不变)');
  assert.ok(d.hints.some((m) => m.includes('往左挪1格')),
      '纠偏话术给反向平移: ' + JSON.stringify(d.hints));
  t.h.stop();
  /* 反例: 缺一块(形状不全对) → 交卷判不过但不给纠偏话术 */
  d = loadBuildWorld();
  t = setup(d);
  const mv = movedOf(t.pz);
  for (const c of mv.slice(1)) {
    t.h.onMouse(2, hitTopOf(t.x0 + c.x + 1, t.Y + 1 + c.y, t.z0 + c.z));
  }
  submit(t);
  assert.strictEqual(t.trials[0].ok, false, '缺块交卷判不过');
  assert.ok(!d.hints.some((m) => m.includes('形状全对')),
      '形状不全对不给纠偏话术(拒收 toast 除外): ' + JSON.stringify(d.hints));
  t.h.stop();
});

/* ============ 教学关操作教学(kind='tutorial' 首试次, P1) ============ */

test('教学关首试次: 玩法口播前先插操作教学 — 摆一摆教瞄准/撤除/交卷, 搭一搭补换色', () => {
  /* 摆一摆(mirror/reflect, 全场第 4 关) */
  let d = loadBuildWorld();
  d.run({family: 'mirror', variant: 'reflect', tier: 1, kind: 'tutorial',
    params: {span: 12, layerRate: 0, trials: 1}, seed: 5}, {onTrial() {}, end() {}});
  assert.ok(d.spoken[0].includes('用鼠标瞄准') && d.spoken[0].includes('发光石'),
      '首句是操作教学(含瞄准与交卷指引): ' + JSON.stringify(d.spoken[0]));
  assert.strictEqual(d.spoken.length, 2, '教学句在前, 玩法口播在后');
  d.flush();
  d.flush();
  /* 搭一搭(plan/build, 全场第 5 关): 再补一句热栏换色 */
  d = loadBuildWorld();
  d.run({family: 'plan', variant: 'build', tier: 1, kind: 'tutorial',
    params: {blocks: 12, trials: 1}, seed: 5}, {onTrial() {}, end() {}});
  assert.ok(d.spoken[0].includes('用鼠标瞄准') && d.spoken[0].includes('换颜色'),
      '搭一搭教学句含换色指引: ' + JSON.stringify(d.spoken[0]));
  d.flush();
  d.flush();
});

test('常规关不插播操作教学 — 首试次直接玩法口播', () => {
  const d = loadBuildWorld();
  d.run({family: 'mirror', variant: 'reflect', tier: 1, kind: 'normal',
    params: {span: 12, layerRate: 0, trials: 2}, seed: 5}, {onTrial() {}, end() {}});
  assert.strictEqual(d.spoken.length, 1, '常规关首试次只有玩法口播');
  assert.ok(!d.spoken.some((s) => s.includes('用鼠标瞄准')), '无操作教学句');
  assert.ok(d.spoken[0].includes('魔法镜'), '玩法口播照常');
  d.flush();
});

/* ============ 选答牌立式化(2026-11「只见摆放不见图纸」票) ============ */

/* 平铺台顶的牌面(y=22..23)恒在眼高(脚 y=21 + PLAYER.eye 1.62 = 22.62)之上,
   顶面从地面看是背面不可见 — 孩子只看得到最南一排侧脸色条, 候选图/数字
   等于不存在。立式墙牌后整张牌面正面朝南可读; 本组测试钉: ①候选图纸/
   数字整格恰立在牌盒中线的墙线上(自下而上, 南缘贴地); ②墙线之外牌盒内
   无平铺残迹; ③点击墙牌顶行判分(ymax 放宽到墙顶, 旧 y≤22 界必红)。
   判分口径(图纸牌下标/数字牌数值)零变化。 */
test('plan/pick 装配级: 候选图纸立式墙牌整格可读 · 点击墙牌判分', () => {
  const d = loadBuildWorld();
  const sec = {family: 'plan', variant: 'pick', tier: 1, kind: 'normal',
    params: {blocks: 12, max: 20, trials: 1}, seed: 11};
  const seed = RandCore.seedAt(sec.seed, 0);
  const made = d.t.MATH_WORLD_VARIANTS['plan/pick'].make(sec, seed);
  const built = d.t.MATH_WORLD_VARIANTS['plan/pick'].build(made);
  const pz = made.pz;
  const W = d.MATH_WORLD;
  assert.strictEqual(built.boards.length, pz.candidates.length, '一候选一牌');
  built.boards.forEach((b, i) => {
    const c = pz.candidates[i];
    const zW = b.z0 + 1; // d=1 底座: 墙线 = 牌盒 z 中线
    for (let row = 0; row < c.d; row++) { // 图纸行主序(北→南)
      for (let x = 0; x < c.w; x++) {
        const want = c.top[row * c.w + x] || 0;
        const r = c.d - 1 - row; // 墙行自下而上, 南缘贴地
        const got = d.blocks.get((b.x0 + 1 + x) + ',' + (W.groundY + 2 + r) + ',' + zW) || 0;
        assert.strictEqual(got, want ? W.colBlock[want] : 0,
            '牌' + i + ' 格(' + x + ',' + row + ')立在墙线 ' + zW);
      }
    }
    for (let z = b.z0; z <= b.z1; z++) { // 旧平铺残迹防线: 墙线外无牌面像素
      if (z === zW) continue;
      for (let y = W.groundY + 2; y <= b.ymax; y++) {
        for (let x = b.x0 + 1; x <= b.x1 - 1; x++) {
          assert.strictEqual(d.blocks.get(x + ',' + y + ',' + z) || 0, 0,
              '牌' + i + ' 墙线外无像素(' + x + ',' + y + ',' + z + ')');
        }
      }
    }
    assert.strictEqual(b.ymax, W.groundY + 1 + c.d, '牌' + i + ' 点击上限=墙顶');
  });
  /* 点击判分: run() 同 seed 重建同一场, 点真图墙牌顶行 → 判对 */
  const trials = [];
  const h = d.run(sec, {onTrial: (t) => trials.push(t), end() {}});
  const bTrue = built.boards[pz.answer];
  h.onMouse(0, {x: bTrue.x0 + 1, y: W.groundY + 2 + pz.candidates[pz.answer].d - 1,
    z: bTrue.z0 + 1});
  assert.strictEqual(trials.length, 1, '点墙牌顶行判分(ymax 放宽生效)');
  assert.strictEqual(trials[0].ok, true, '点真图墙牌判对');
  h.stop();
});

test('plan/hidden 装配级: 数字牌立式墙牌整列可读 · 点击墙牌判分', () => {
  const d = loadBuildWorld();
  const trials = [];
  const sec = {family: 'plan', variant: 'hidden', tier: 1, kind: 'normal',
    params: {blocks: 30, max: 30, trials: 1}, seed: 13};
  const seed = RandCore.seedAt(sec.seed, 0);
  const made = d.t.MATH_WORLD_VARIANTS['plan/hidden'].make(sec, seed);
  const built = d.t.MATH_WORLD_VARIANTS['plan/hidden'].build(made);
  const W = d.MATH_WORLD;
  const bA = built.boards.find((b) => b.value === made.pz.answer);
  assert.ok(bA, '答案数字牌在牌阵');
  assert.strictEqual(bA.ymax, W.groundY + 1 + 5, '数字牌点击上限=墙顶(5 行)');
  String(made.pz.answer).split('').map(Number).forEach((dg, i) => {
    for (const [dx, dy] of BuildWorldCore.digitCells(dg)) {
      const got = d.blocks.get((bA.x0 + 1 + i * 4 + dx) + ',' +
          (W.groundY + 2 + (4 - dy)) + ',' + (bA.z0 + 1)) || 0;
      assert.strictEqual(got, W.digitBlock,
          '答案数字 ' + dg + ' 笔划(' + dx + ',' + dy + ')立在墙线');
    }
  });
  const h = d.run(sec, {onTrial: (t) => trials.push(t), end() {}});
  h.onMouse(0, {x: bA.x0 + 1, y: W.groundY + 6, z: bA.z0 + 1}); // 墙顶行(旧界 y≤22 必红)
  assert.strictEqual(trials.length, 1, '点数字牌墙顶行判分(ymax 放宽生效)');
  assert.strictEqual(trials[0].ok, true, '点答案数字牌判对');
  h.stop();
});
