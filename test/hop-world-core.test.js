'use strict';
/* 跳一跳世界轨纯核心单测 — node --test (零依赖)
   运行: node --test test/hop-world-core.test.js
   覆盖: 路径布局(线性红线: 逐格曼哈顿相邻/坐标不重复/数序单调 · 直路与
   蛇行的形态判据 · 每 10 格一档 · 大数带 unit=10 · 幅面 ≤32×32) ·
   骰步(骰值 1..6/落格钳界/临终点回起点) · 跳格子试次(前跳/倒推/往回跳
   的步长与答案算术) · 间隔问题(答案与两端点模式算术独立对照 · 跨度可走
   · 平移后答案不变) · 规律跳(等差/交替步长结构外推) · 数值选项(恰 4 项
   不重复/含答案/在界内) · 种子确定性(同 seed 同输出)。
   加载器: vm context 依次执行 rand-core.js + math-puzzles-core.js + math-levels.js +
   hop-world-core.js, 镜像浏览器共享词法环境(相对序同 index.html);
   真实难度曲线经 mathParamsFor('hop', tier) 注入(测的是带内真实参数,
   不是合成参数); 图标以 stub 注入(math-levels.test.js 同款) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHopCore() {
  const sandbox = {
    console, Math, JSON, Object, Array, Date, Number, Set,
    mcIcon: (n) => 'data:icon:' + n, // math-levels 构造期图标 stub
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['rand-core.js', 'math-puzzles-core.js', 'math-levels.js', 'hop-world-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__hw = { HopWorld, PuzzleCore, mathParamsFor, MATH_VARIANTS };
  `, ctx);
  return sandbox.__hw;
}

/* 种子 LCG(与被测实现同常数, 只作确定性驱动器 — 断言值全部独立手算) */
function mkRnd(seed) {
  let s = seed;
  return function() {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const hopParams = (hw, tier) => hw.mathParamsFor('hop', tier);

/* ============ 路径布局: 线性数路的结构不变量 ============ */

test('hopPathPlan: 全 tier 曲线的路都线性 — 逐格曼哈顿相邻且坐标不重复', () => {
  const hw = loadHopCore();
  for (let tier = 1; tier <= 19; tier++) {
    const plan = hw.HopWorld.hopPathPlan(hopParams(hw, tier));
    assert.ok(plan.last >= 10, 'tier' + tier + ' 路长 ≥10');
    const seen = new Set();
    for (let i = 0; i <= plan.last; i++) {
      const a = plan.at(i);
      assert.ok(a && Number.isInteger(a.x) && Number.isInteger(a.z), 'tier' + tier + ' 格 ' + i + ' 有坐标');
      const k = a.x + ',' + a.z;
      assert.ok(!seen.has(k), 'tier' + tier + ' 格 ' + i + ' 坐标不与前面重复(无环)');
      seen.add(k);
    }
    const route = hw.HopWorld.hopRoute(plan, 0, plan.last);
    assert.ok(route.length >= plan.last + 1, 'tier' + tier + ' 全路展开含全部格');
    for (let k = 1; k < route.length; k++) {
      const d = Math.abs(route[k].x - route[k - 1].x) + Math.abs(route[k].z - route[k - 1].z);
      assert.strictEqual(d, 1, 'tier' + tier + ' 第 ' + k + ' 步相邻(线性可走)');
    }
    assert.deepStrictEqual(route[0], plan.at(0));
    assert.deepStrictEqual(route[route.length - 1], plan.at(plan.last));
  }
});

test('hopPathPlan: 直路/蛇行形态 — band0 单行, 长路 10 格一行蛇行折两行以上', () => {
  const hw = loadHopCore();
  const p10 = hw.HopWorld.hopPathPlan({max: 10});
  assert.strictEqual(p10.line, true);
  assert.strictEqual(p10.last, 10);
  const zs = new Set(Array.from({length: 11}, (_, i) => p10.at(i).z));
  assert.strictEqual(zs.size, 1, '0-10 路单行直线');
  const p20 = hw.HopWorld.hopPathPlan({max: 20});
  assert.strictEqual(p20.line, true, '0-20 路仍直线(21 格)');
  const p30 = hw.HopWorld.hopPathPlan({max: 30});
  assert.strictEqual(p30.line, false, '0-30 路转蛇行');
  assert.strictEqual(p30.rows, 4, '0-30 路 4 行(末行 1 格)');
  assert.strictEqual(p30.at(10).x, p30.at(9).x, '行尾与下行行首同列(折返相邻)');
  assert.strictEqual(p30.at(10).z, p30.at(9).z - 2, '下一行北移 2 格');
  assert.strictEqual(p30.at(30).x, p30.at(29).x, '末行首格贴上一行行尾同列');
  const p100 = hw.HopWorld.hopPathPlan({max: 100});
  assert.strictEqual(p100.rows, 11, '0-100 路 11 行(末行 1 格)');
});

test('hopPathPlan: 大数带 unit=10 — 格值 = 下标×10, 终点值 ≤ max 且同带', () => {
  const hw = loadHopCore();
  const p = hw.HopWorld.hopPathPlan({max: 1000});
  assert.strictEqual(p.unit, 10);
  assert.strictEqual(p.value(0), 0);
  assert.strictEqual(p.value(1), 10);
  assert.ok(p.value(p.last) <= 1000, '终点值不越带');
  assert.strictEqual(p.last, 100, '0-1000 路 = 100 格(每格 10)');
  const p200 = hw.HopWorld.hopPathPlan({max: 200});
  assert.strictEqual(p200.unit, 10);
  assert.strictEqual(p200.line, true, '0-200 路 21 格仍直线');
  const small = hw.HopWorld.hopPathPlan({max: 100});
  assert.strictEqual(small.unit, 1, 'max ≤100 一格一数');
});

test('hopPathPlan: 整十一档 — 恰在下标 %10==0 的格上(位值旗的档距)', () => {
  const hw = loadHopCore();
  const plan = hw.HopWorld.hopPathPlan({max: 100});
  const decades = [];
  for (let i = 0; i <= plan.last; i++) if (plan.isDecade(i)) decades.push(i);
  assert.deepStrictEqual(decades, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
});

test('hopPathPlan: 幅面 ≤32×32(含 4 格草岛边距) — 小场景红线', () => {
  const hw = loadHopCore();
  const m = hw.HopWorld.HOP_MARGIN;
  for (let tier = 1; tier <= 19; tier++) {
    const plan = hw.HopWorld.hopPathPlan(hopParams(hw, tier));
    const w = plan.bounds.x2 - plan.bounds.x1 + 1 + 2 * m;
    const d = plan.bounds.z2 - plan.bounds.z1 + 1 + 2 * m;
    assert.ok(w <= 32 && d <= 32, 'tier' + tier + ' 幅面 ' + w + '×' + d + ' 超限');
  }
});

/* ============ 掷骰前进 ============ */

test('hopDiceStep: 骰值 1..6, 落格 = min(from+骰, last), 临终点(余<3)先回起点', () => {
  const hw = loadHopCore();
  const plan = hw.HopWorld.hopPathPlan({max: 20});
  for (let seed = 1; seed <= 60; seed++) {
    const st = hw.HopWorld.hopDiceStep(plan, mkRnd(seed), 0);
    assert.ok(st.roll >= 1 && st.roll <= 6);
    assert.ok(st.to >= st.from && st.to <= plan.last);
    assert.strictEqual(st.to, Math.min(st.from + st.roll, plan.last));
    assert.strictEqual(st.wrap, false);
  }
  const near = hw.HopWorld.hopDiceStep(plan, mkRnd(7), plan.last - 2); // 余 2 格
  assert.strictEqual(near.wrap, true);
  assert.strictEqual(near.from, 0);
  const atEnd = hw.HopWorld.hopDiceStep(plan, mkRnd(9), plan.last);
  assert.strictEqual(atEnd.wrap, true, '在终点必回起点');
  const clamped = hw.HopWorld.hopDiceStep(hw.HopWorld.hopPathPlan({max: 10}), mkRnd(11), 7); // 0-10 路 7 位(余 3 不回)
  if (clamped.roll > 3) assert.strictEqual(clamped.to, 10, '掷越过终点钳在终点格');
});

/* ============ 跳格子任务 ============ */

test('hopJumpTrial: 前跳步长 2..8 落格不越界, 倒推答案 = 两端差, 往回跳不退过 0', () => {
  const hw = loadHopCore();
  const plan = hw.HopWorld.hopPathPlan({max: 100});
  const forms = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const t = hw.HopWorld.hopJumpTrial(plan, {reasoning: 'multi-solve', zigRate: 0.5}, mkRnd(seed), 20);
    forms.add(t.form);
    if (t.form === 'fwd') {
      assert.ok(t.n >= 2 && t.n <= 8, '前跳步长 2..8: ' + t.n);
      assert.strictEqual(t.to, t.from + t.n);
      assert.ok(t.to <= plan.last);
    } else if (t.form === 'rev') {
      assert.ok(t.to >= t.from + 2 && t.to <= Math.min(t.from + 9, plan.last));
      assert.strictEqual(t.answer, t.to - t.from, '倒推答案 = 步数差(独立口径)');
    } else {
      assert.strictEqual(t.form, 'back');
      assert.ok(t.n >= 2 && t.to === t.from - t.n && t.to >= 0, '往回跳落格 ≥0');
    }
  }
  assert.ok(forms.has('fwd') && forms.has('rev') && forms.has('back'), '三形态都掷得到: ' + [...forms]);
});

test('hopJumpTrial: single 档无倒推、zigRate=0 无往回跳(曲线定性渐进不超前)', () => {
  const hw = loadHopCore();
  const plan = hw.HopWorld.hopPathPlan({max: 20});
  for (let seed = 1; seed <= 80; seed++) {
    const t = hw.HopWorld.hopJumpTrial(plan, {reasoning: 'single', zigRate: 0}, mkRnd(seed), 5);
    assert.strictEqual(t.form, 'fwd', 'band0 只有前跳');
  }
  for (let seed = 1; seed <= 80; seed++) {
    const t = hw.HopWorld.hopJumpTrial(plan, {reasoning: 'reverse', zigRate: 0}, mkRnd(seed), 5);
    assert.ok(t.form !== 'back', 'zigRate=0 不出往回跳');
  }
});

/* ============ 间隔问题(挑战) ============ */

test('hopGapTrial 间隔: 答案按两端模式独立对照算术, 跨度走得完, 平移不越界', () => {
  const hw = loadHopCore();
  const oracle = {both: (a, b) => b - a + 1, neither: (a, b) => b - a - 1, one: (a, b) => b - a};
  let checked = 0;
  for (const tier of [8, 12, 16, 19]) {
    const plan = hw.HopWorld.hopPathPlan(hopParams(hw, tier));
    for (let seed = 1; seed <= 60 && checked < 200; seed++) {
      const t = hw.HopWorld.hopGapTrial(plan, {}, mkRnd(seed));
      if (t.sub !== 'interval') continue;
      checked++;
      assert.ok(t.bIdx > t.aIdx && t.aIdx >= 0 && t.bIdx <= plan.last, '两端在路内');
      assert.ok(t.bIdx - t.aIdx <= 11, '跨度 ≤11 格(数得完)');
      assert.strictEqual(t.answer, oracle[t.mode](t.aIdx, t.bIdx),
          tier + ' 档 ' + t.mode + ' 答案对得上(植树口径独立验算)');
      assert.strictEqual(plan.value(t.aIdx), t.aIdx * plan.unit, '端点数值随带换算');
    }
  }
  assert.ok(checked >= 100, '间隔子型覆盖到: ' + checked);
});

test('hopGapTrial 间隔: 大数带两端值是整十数(读数 ×10), 中间格数=答案与读数无关', () => {
  const hw = loadHopCore();
  const plan = hw.HopWorld.hopPathPlan({max: 1000});
  let found = 0;
  for (let seed = 1; seed <= 80 && found < 12; seed++) {
    const t = hw.HopWorld.hopGapTrial(plan, {}, mkRnd(seed));
    if (t.sub !== 'interval') continue;
    found++;
    assert.strictEqual(plan.value(t.aIdx) % 10, 0, '端点值整十');
    assert.strictEqual(plan.value(t.bIdx) % 10, 0);
    assert.ok(t.answer <= 11, '大数带问的是格数, 不是数值差');
  }
  assert.ok(found >= 1, '掷到间隔子型');
});

/* ============ 规律跳(挑战) ============ */

test('hopGapTrial 规律跳: 等差/交替步长结构外推 next, 展示项与答案都在路内', () => {
  const hw = loadHopCore();
  let arith = 0;
  let alt = 0;
  for (const tier of [8, 16]) {
    const plan = hw.HopWorld.hopPathPlan(hopParams(hw, tier));
    for (let seed = 1; seed <= 120; seed++) {
      const t = hw.HopWorld.hopGapTrial(plan, {}, mkRnd(seed));
      if (t.sub !== 'seq') continue;
      const s = t.seq;
      assert.ok(s.length === 3 || s.length === 4, '展示 3 或 4 项(≤4 组块红线)');
      assert.ok(Math.min(...s, t.next) >= 1 && Math.max(...s, t.next) <= plan.last, '落格都在路内');
      if (s.length === 3) {
        arith++;
        const d = s[1] - s[0];
        assert.strictEqual(s[2] - s[1], d, '等差步长一致');
        assert.strictEqual(t.next, s[2] + d, 'next 顺延等差(独立外推)');
      } else {
        alt++;
        const p = s[1] - s[0];
        const q = s[2] - s[1];
        assert.strictEqual(s[3] - s[2], p, '交替: 第 4 步回到 p 步');
        assert.strictEqual(t.next, s[3] + q, 'next 接 q 步(独立外推)');
      }
    }
  }
  assert.ok(arith >= 1 && alt >= 1, '等差与交替都覆盖到: ' + arith + '/' + alt);
});

/* ============ 数值选项条 ============ */

test('hopChoices: 恰 4 项不重复含答案, 干扰在界内且是近邻', () => {
  const hw = loadHopCore();
  for (const [ans, hi] of [[7, 20], [0, 12], [18, 20], [130, 200], [990, 1000]]) {
    const cs = hw.HopWorld.hopChoices(mkRnd(ans * 31 + hi), ans, hi);
    assert.strictEqual(cs.length, 4);
    assert.strictEqual(new Set(cs).size, 4, '不重复');
    assert.ok(cs.includes(ans), '含答案');
    assert.ok(cs.every((v) => v >= 0), '不为负');
    if (hi - 0 >= 4 && ans + 3 <= hi) {
      assert.ok(cs.every((v) => v <= hi), '区间足够宽时干扰不越上界');
      const near = cs.filter((v) => v !== ans && Math.abs(v - ans) <= 3).length;
      assert.strictEqual(near, 3, '干扰是 ±1..±3 近邻: ' + cs.join(','));
    }
  }
  const narrow = hw.HopWorld.hopChoices(mkRnd(5), 0, 2); // 区间宽度 3 < 4: 兜底远离值
  assert.strictEqual(new Set(narrow).size, 4, '窄区间兜底仍不重复');
});

/* ============ 种子确定性 ============ */

test('种子确定性: 同 seed 同骰序同题序, 异 seed 异题', () => {
  const hw = loadHopCore();
  const run = (seed) => {
    const rnd = mkRnd(seed);
    const plan = hw.HopWorld.hopPathPlan({max: 100});
    const out = {dice: [], jump: [], gap: []};
    for (let k = 0; k < 12; k++) out.dice.push(hw.HopWorld.hopDiceStep(plan, rnd, k % 40));
    for (let k = 0; k < 12; k++) {
      out.jump.push(hw.HopWorld.hopJumpTrial(plan, {reasoning: 'reverse', zigRate: 0.3}, rnd, k * 5));
    }
    for (let k = 0; k < 12; k++) out.gap.push(hw.HopWorld.hopGapTrial(plan, {}, rnd));
    return out;
  };
  assert.deepStrictEqual(run(777), run(777), '同 seed 全同');
  assert.notDeepStrictEqual(run(777).gap, run(778).gap, '异 seed 异题');
});
