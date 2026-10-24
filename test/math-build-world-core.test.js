'use strict';
/* 摆与搭世界轨纯核心单测 — node --test (零依赖)
   运行: node --test test/math-build-world-core.test.js
   覆盖: mirror/plan 世界轨的谜题形状与候选生成(T6, 判分复用 PuzzleCore)——
   对称参数派生(span→hw/fw/layers 有界单调) · 平移复制(解=样本∪平移像,
   gradeSymmetry 判分) · 拼组目标(轮廓连通·恰填判分) · 看图施工(图纸尺寸
   有界·gradeBlueprint 判分) · 反向选图(候选 ≤4·恰一真·干扰互异) ·
   隐藏块/数方块(答案=纯函数重算·永不越带 ≤max·候选恰 4 含答案) ·
   图纸像素投影(纯数据行列表) · 数字点阵(0~9 全覆盖互异) · 数值候选条。
   加载器: 直 require(PuzzleCore 挂 global 后调用期解析, 浏览器侧加载序
   同 index.html: math-puzzles-core → math-build-world-core)。 */
const test = require('node:test');
const assert = require('node:assert');

global.PuzzleCore = require('../js/math-puzzles-core.js');
const BuildWorldCore = require('../js/math-build-world-core.js');

const key = (c) => c.x + ',' + c.y + ',' + c.z;
const keySet = (cells) => new Set(cells.map(key));

/* 与 PuzzleCore 同常数的种子 LCG(候选条测试注入用) */
function mkRnd(seed) {
  let s = seed;
  return function() {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/* ============ mirror 族: 对称参数派生 + 端到端谜题 ============ */

test('mathWorldSymParams: hw/fw∈[2,4] · layers∈[1,2] · span 越大画布越大(体积单调有界)', () => {
  const vols = [];
  for (const span of [6, 12, 16, 36, 64, 144]) {
    const q = BuildWorldCore.mathWorldSymParams({span, layerRate: 0});
    assert.ok(q.hw >= 2 && q.hw <= 4, 'hw 有界: ' + q.hw);
    assert.ok(q.fw >= 2 && q.fw <= 4, 'fw 有界: ' + q.fw);
    assert.ok(q.layers >= 1 && q.layers <= 2, 'layers 有界: ' + q.layers);
    vols.push(q.hw * q.fw * q.layers);
  }
  for (let i = 1; i < vols.length; i++) {
    assert.ok(vols[i] >= vols[i - 1], '画布体积随 span 不减: ' + vols.join(','));
  }
});

test('mathWorldSymParams: layerRate=1 或 span≥40 → 双层(多层立体渐入与数值轴双通道)', () => {
  assert.strictEqual(BuildWorldCore.mathWorldSymParams({span: 12, layerRate: 1}).layers, 2);
  assert.strictEqual(BuildWorldCore.mathWorldSymParams({span: 64, layerRate: 0}).layers, 2);
  assert.strictEqual(BuildWorldCore.mathWorldSymParams({span: 12, layerRate: 0}).layers, 1);
});

test('mathWorldSymParams → mkSymmetryPuzzle 端到端: 解有界(≤40 块) · 半边 ≥2 · 同 seed 同输出', () => {
  for (const span of [6, 16, 64, 144]) {
    for (const axis of ['x', 'z', 'c']) {
      const q = BuildWorldCore.mathWorldSymParams({span, layerRate: 0.5});
      const p = PuzzleCore.mkSymmetryPuzzle({seed: 33, axis, ...q});
      assert.ok(p.half.length >= 2, axis + ' 半边 ≥2');
      assert.ok(p.solution.length <= 40, axis + ' 解 ≤40 块(儿童可摆): ' + p.solution.length);
      const b = p.box;
      assert.ok(b.w <= 8 && b.d <= 8 && b.h <= 2, axis + ' 装场定界 ≤8×8×2');
    }
  }
  const q = BuildWorldCore.mathWorldSymParams({span: 16, layerRate: 0});
  const a = PuzzleCore.mkSymmetryPuzzle({seed: 9, axis: 'x', ...q});
  const b = PuzzleCore.mkSymmetryPuzzle({seed: 9, axis: 'x', ...q});
  assert.deepStrictEqual(a, b, '同 seed 同输出');
});

/* ============ mirror/translate: 平移复制 ============ */

test('mkWorldTranslate: 解=样本∪平移像 · 照解摆判对(gradeSymmetry) · 多摆/挪位判错', () => {
  const pz = BuildWorldCore.mkWorldTranslate({seed: 21, span: 12, layerRate: 0});
  assert.ok(pz.offset.dx >= 3, '平移距离 ≥3 格: ' + JSON.stringify(pz.offset));
  const moved = pz.solution.filter((c) => !pz.half.some((h) => key(h) === key(c)));
  assert.ok(moved.length >= 2, '要摆的平移像 ≥2 块');
  assert.strictEqual(PuzzleCore.gradeSymmetry(moved, pz), true, '照平移像摆=对');
  assert.strictEqual(PuzzleCore.gradeSymmetry(moved.slice(1), pz), false, '缺一块=错');
  const shifted = moved.map((c) => ({...c, x: c.x + 1}));
  assert.strictEqual(PuzzleCore.gradeSymmetry(shifted, pz), false, '挪位=错');
  const extra = moved.concat([{x: moved[0].x, y: moved[0].y + 3, z: moved[0].z, col: 1}]);
  assert.strictEqual(PuzzleCore.gradeSymmetry(extra, pz), false, '多摆=错');
  assert.ok(pz.box.w >= 4 && pz.box.d >= 2, '画布容纳两份图案');
});

/* ============ mirror/tangram: 拼组恰填 ============ */

test('mkWorldTangram: 目标轮廓 4..12 格 · 连通 · 解=轮廓抬一层 · 恰填判分', () => {
  for (let s = 0; s < 8; s++) {
    const pz = BuildWorldCore.mkWorldTangram({seed: 100 + s, span: 12});
    const t = pz.target;
    assert.ok(t.length >= 4 && t.length <= 12, '轮廓 4..12 格: ' + t.length);
    /* 连通性: BFS 泛洪应一次走完全部目标格 */
    const set = keySet(t);
    const q = [t[0]]; const seen = new Set([key(t[0])]);
    while (q.length) {
      const c = q.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (c.x + dx) + ',0,' + (c.z + dz);
        if (set.has(k) && !seen.has(k)) {
          seen.add(k);
          q.push(t.find((cc) => key(cc) === k));
        }
      }
    }
    assert.strictEqual(seen.size, t.length, '轮廓四连通(一笔走完)');
    /* 解与轮廓同层(放置平面局部 y=0): 玻璃标记在地面, 块摆在标记正上方,
       判分坐标系=放置坐标系 */
    assert.ok(pz.solution.every((c) => c.y === 0), '解在放置平面');
    assert.strictEqual(pz.solution.length, t.length);
    assert.strictEqual(PuzzleCore.gradeSymmetry(pz.solution, pz), true, '恰填=对');
    assert.strictEqual(PuzzleCore.gradeSymmetry(pz.solution.slice(1), pz), false, '缺格=错');
    assert.strictEqual(PuzzleCore.gradeSymmetry(
        pz.solution.concat([{x: pz.solution[0].x + 50, y: 1, z: pz.solution[0].z}]), pz), false, '多摆=错');
  }
});

/* ============ plan/build: 看图施工 ============ */

test('mkWorldBuild: 图纸尺寸 ≤4×4 · 照图纸平铺一层即判对(投影判分) · 换色判错', () => {
  const pz = BuildWorldCore.mkWorldBuild({seed: 5, blocks: 12});
  const bp = pz.blueprint;
  assert.ok(bp.w >= 2 && bp.w <= 4 && bp.d >= 2 && bp.d <= 4, '图纸 2..4 见方');
  assert.ok(bp.top.some((v) => v > 0), '图纸非全空');
  assert.strictEqual(pz.box.w, bp.w);
  assert.strictEqual(pz.box.d, bp.d);
  /* 手工平铺: 每个非空图纸格放一块同色 → 投影必等 */
  const flat = [];
  for (let i = 0; i < bp.top.length; i++) {
    if (bp.top[i] > 0) {
      flat.push({x: i % bp.w, y: 0, z: Math.floor(i / bp.w), col: bp.top[i]});
    }
  }
  assert.strictEqual(PuzzleCore.gradeBlueprint(flat, bp), true, '照图纸平铺=对(高度自由)');
  const recolored = flat.map((c, i) => (i === 0 ? {...c, col: c.col === 1 ? 2 : 1} : c));
  assert.strictEqual(PuzzleCore.gradeBlueprint(recolored, bp), false, '颜色不符=错');
  assert.strictEqual(PuzzleCore.gradeBlueprint(flat.slice(1), bp), false, '缺列=错');
});

/* ============ plan/pick: 反向选图 ============ */

test('mkWorldPick: 候选 ≤4 · 恰一真 · answer 指向真图 · 干扰图互不同于真图', () => {
  for (let s = 0; s < 8; s++) {
    const pz = BuildWorldCore.mkWorldPick({seed: 200 + s, blocks: 12});
    assert.ok(pz.cells.length >= 2, '建筑 ≥2 块');
    assert.ok(pz.candidates.length >= 2 && pz.candidates.length <= PuzzleCore.LIMITS.chunks,
        '候选 2..4(认知负荷红线)');
    const trues = pz.candidates.filter((c) => c.ok);
    assert.strictEqual(trues.length, 1, '恰一真图');
    assert.ok(pz.answer >= 0 && pz.answer < pz.candidates.length, 'answer 在界');
    assert.strictEqual(pz.candidates[pz.answer].ok, true, 'answer 指向真图');
    /* 真图 = 建筑的俯视投影(判分真值来自 PuzzleCore.projectTop) */
    const proj = PuzzleCore.projectTop(pz.cells);
    assert.strictEqual(trues[0].w, proj.w);
    assert.strictEqual(trues[0].d, proj.d);
    assert.deepStrictEqual(trues[0].top, proj.top);
    /* 干扰图与真图逐格互异, 彼此也互异(不会两张同图) */
    const sig = (c) => JSON.stringify(c.top);
    const sigs = new Set(pz.candidates.map(sig));
    assert.strictEqual(sigs.size, pz.candidates.length, '候选互异');
    for (const c of pz.candidates) {
      if (!c.ok) {
        assert.notStrictEqual(sig(c), sig(trues[0]), '干扰图 ≠ 真图');
        assert.strictEqual(c.w, proj.w, '干扰图同尺寸(只差内容)');
      }
    }
  }
});

/* ============ plan/hidden: 隐藏块推理 ============ */

test('mkWorldHidden: 答案=hiddenBlocks 重算且 ≥1 · 结构不越带(≤blocks) · 候选恰 4 含答案', () => {
  for (let s = 0; s < 8; s++) {
    const pz = BuildWorldCore.mkWorldHidden({seed: 300 + s, blocks: 20, max: 20});
    assert.strictEqual(pz.answer, PuzzleCore.hiddenBlocks(pz.cells), '答案由纯函数重算');
    assert.ok(pz.answer >= 1, '至少藏 1 块(否则不成谜面)');
    assert.ok(pz.cells.length <= 20, '结构 ≤ blocks 预算');
    assert.ok(pz.answer <= 20, '答案 ≤ max(永不越带)');
    assert.strictEqual(pz.cands.length, 4);
    assert.ok(pz.cands.includes(pz.answer), '候选含答案');
    assert.strictEqual(new Set(pz.cands).size, 4, '候选互异');
    assert.ok(pz.cands.every((v) => v >= 0), '候选非负');
  }
});

test('mkWorldHidden: 大预算走厚墙族(3×3×3 以上), 小预算走十字簇(7 块 1 藏)', () => {
  const big = BuildWorldCore.mkWorldHidden({seed: 7, blocks: 60, max: 100});
  assert.ok(PuzzleCore.hiddenBlocks(big.cells) >= 1 && big.cells.length >= 27, '大预算结构更大');
  const small = BuildWorldCore.mkWorldHidden({seed: 7, blocks: 10, max: 20});
  assert.ok(small.cells.length <= 10, '小预算 ≤ blocks');
  assert.strictEqual(PuzzleCore.hiddenBlocks(small.cells), 1, '十字簇恰藏 1 块');
});

/* ============ plan/countall: 数方块与露面计数 ============ */

test('mkWorldCount: 推理档决定问法 — single/two-step=总数 · reverse/multi-solve=露面', () => {
  const total = BuildWorldCore.mkWorldCount({seed: 41, blocks: 16, max: 20, reasoning: 'single'});
  assert.strictEqual(total.mode, 'total');
  assert.strictEqual(total.answer, total.cells.length, '总数答案=块数(含藏块)');
  const faces = BuildWorldCore.mkWorldCount({seed: 41, blocks: 60, max: 100, reasoning: 'reverse'});
  assert.strictEqual(faces.mode, 'faces');
  assert.strictEqual(faces.answer, PuzzleCore.exposedFaces(faces.cells), '露面答案由纯函数重算');
});

test('mkWorldCount: 答案永不越带(≤ max) · 候选恰 4 含答案 · 结构有界', () => {
  for (const [blocks, max] of [[8, 20], [20, 20], [60, 100], [100, 100]]) {
    for (const reasoning of ['single', 'two-step', 'reverse', 'multi-solve']) {
      const pz = BuildWorldCore.mkWorldCount({seed: 77, blocks, max, reasoning});
      assert.ok(pz.answer >= 1, '答案 ≥1');
      assert.ok(pz.answer <= max, '答案 ≤ max(数值轨红线): ' + pz.answer + '>' + max);
      assert.ok(pz.cells.length <= blocks, '结构 ≤ blocks 预算');
      assert.strictEqual(pz.cands.length, 4);
      assert.ok(pz.cands.includes(pz.answer));
      assert.strictEqual(new Set(pz.cands).size, 4);
    }
  }
});

/* ============ 图纸像素投影 + 数字点阵 + 数值候选 ============ */

test('blueprintPixels: 行列表尺寸=图纸 · 颜色查表 · 空格透明', () => {
  const bp = {w: 3, d: 2, top: [1, 0, 2, 0, 3, 0]};
  const px = BuildWorldCore.blueprintPixels(bp);
  assert.strictEqual(px.length, 2, '行数=d');
  assert.strictEqual(px[0].length, 3, '列数=w');
  assert.strictEqual(px[0][0], BuildWorldCore.MATH_CELL_COLORS[1].css);
  assert.strictEqual(px[0][2], BuildWorldCore.MATH_CELL_COLORS[2].css);
  assert.strictEqual(px[1][1], BuildWorldCore.MATH_CELL_COLORS[3].css);
  assert.strictEqual(px[0][1], '', '空格透明');
  assert.strictEqual(px[1][0], '');
});

test('digitCells: 0~9 全覆盖 · 都在 3×5 内 · 互异(1≠7, 6≠9)', () => {
  const sigs = new Set();
  for (let n = 0; n <= 9; n++) {
    const cells = BuildWorldCore.digitCells(n);
    assert.ok(cells.length >= 5, '数字 ' + n + ' 有笔划');
    for (const [x, y] of cells) {
      assert.ok(x >= 0 && x < 3 && y >= 0 && y < 5, '数字 ' + n + ' 在 3×5 点阵内');
    }
    sigs.add(JSON.stringify(cells.slice().sort()));
  }
  assert.strictEqual(sigs.size, 10, '十个数字互异');
});

test('worldNumChoices: 恰 4 个 · 含答案 · 互异 · 非负', () => {
  const c = BuildWorldCore.worldNumChoices(5, mkRnd(3));
  assert.strictEqual(c.length, 4);
  assert.ok(c.includes(5));
  assert.strictEqual(new Set(c).size, 4);
  assert.ok(c.every((v) => v >= 0));
  const z = BuildWorldCore.worldNumChoices(0, mkRnd(4));
  assert.ok(z.includes(0) && z.every((v) => v >= 0), '答案 0 也不出负数');
});

/* ============ 确定性 ============ */

test('同 seed 同输出: 选图/隐藏/数方块/平移/拼组 全族', () => {
  const t = (fn, arg) => JSON.stringify(fn(arg));
  assert.strictEqual(t(BuildWorldCore.mkWorldPick, {seed: 9, blocks: 12}),
      t(BuildWorldCore.mkWorldPick, {seed: 9, blocks: 12}));
  assert.strictEqual(t(BuildWorldCore.mkWorldHidden, {seed: 9, blocks: 20, max: 20}),
      t(BuildWorldCore.mkWorldHidden, {seed: 9, blocks: 20, max: 20}));
  assert.strictEqual(t(BuildWorldCore.mkWorldCount, {seed: 9, blocks: 20, max: 20, reasoning: 'reverse'}),
      t(BuildWorldCore.mkWorldCount, {seed: 9, blocks: 20, max: 20, reasoning: 'reverse'}));
  assert.strictEqual(t(BuildWorldCore.mkWorldTranslate, {seed: 9, span: 12}),
      t(BuildWorldCore.mkWorldTranslate, {seed: 9, span: 12}));
  assert.strictEqual(t(BuildWorldCore.mkWorldTangram, {seed: 9, span: 12}),
      t(BuildWorldCore.mkWorldTangram, {seed: 9, span: 12}));
});
