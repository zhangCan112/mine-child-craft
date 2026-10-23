'use strict';
/* 谜题纯核心 (js/math-puzzles-core.js) 单测 — node --test (零依赖)
   运行: node --test test/math-puzzles-core.test.js
   手法: 与 cascade-core 同惯例, 经 CommonJS 导出守卫直接 require
   (零 THREE · 零 DOM, 无需 vm 装配)。断言口径:
   · 每类谜题答案正确性用手算对照(独立真值, 不复算实现);
   · 出题全函数种子注入 — 同 seed 同输出, 跨 seed 扫描;
   · 数值范围跟带注入: 传 max 后任何读数越界即红(band0=20);
   · 认知负荷红线: 一次呈现 ≤4 组块、线索 ≤3 条(设计稿 §4.1);
   · 多解枚举不重不漏; 镜像/周期判分含平移/旋转轴。 */
const test = require('node:test');
const assert = require('node:assert');
const PuzzleCore = require('../js/math-puzzles-core.js');

/* 跨 seed 扫描用的种子组(覆盖小值/大值/边界) */
const SEEDS = [0, 1, 2, 7, 42, 99, 123, 500, 999, 2026];

/* 深递归收集结果对象里的全部数值(带越界断言的独立真值来源:
   结构性红线 = 谜题结果里出现的任何数字都不许超过注入的 max) */
function allNumbers(v, out) {
  if (typeof v === 'number') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allNumbers(x, out));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => allNumbers(v[k], out));
  return out;
}

const key = (c) => c.x + ',' + c.y + ',' + c.z;
const sameSet = (a, b) => {
  if (a.length !== b.length) return false;
  const s = new Set(b.map(key));
  return a.every((c) => s.has(key(c)));
};

/* ============ 图案变换: 镜像 / 旋转 / 平移 ============ */

test('mirrorPattern: 左右镜像 x\'=k-x, y/z/col 保留', () => {
  const cells = [{x: 0, y: 1, z: 2, col: 3}];
  const r = PuzzleCore.mirrorPattern(cells, 'x', 5);
  assert.deepStrictEqual(r, [{x: 5, y: 1, z: 2, col: 3}]);
});

test('mirrorPattern: 前后镜像 z\'=k-z; 二次镜像归位(对合)', () => {
  const cells = [{x: 1, y: 0, z: 0, col: 1}, {x: 0, y: 0, z: 2, col: 2}];
  const once = PuzzleCore.mirrorPattern(cells, 'z', 4);
  assert.deepStrictEqual(once, [{x: 1, y: 0, z: 4, col: 1}, {x: 0, y: 0, z: 2, col: 2}]);
  assert.ok(sameSet(PuzzleCore.mirrorPattern(once, 'z', 4), cells), '镜像的镜像=原集');
});

test('rot180Pattern: 中心对称 (x,z)→(kx-x, kz-z), y 不动', () => {
  const cells = [{x: 0, y: 2, z: 1, col: 1}];
  assert.deepStrictEqual(PuzzleCore.rot180Pattern(cells, 3, 5), [{x: 3, y: 2, z: 4, col: 1}]);
});

test('rotatePattern: 绕整数中心 90° 旋转 — 十字点集映射回自身', () => {
  const cx = 2; const cz = 2;
  const cross = [{x: 2, y: 0, z: 2}, {x: 1, y: 0, z: 2}, {x: 3, y: 0, z: 2},
    {x: 2, y: 0, z: 1}, {x: 2, y: 0, z: 3}];
  assert.ok(sameSet(PuzzleCore.rotatePattern(cross, 1, cx, cz), cross), '十字 90° 不变');
});

test('rotatePattern: 单点 90° 落点手算对照 + turns=2 ≡ rot180 + turns=4 归位', () => {
  // (x,z)=(1,2) 绕 (2,2) 顺时针 90°: x'=cx+(z-cz)=2, z'=cz-(x-cx)=3
  assert.deepStrictEqual(PuzzleCore.rotatePattern([{x: 1, y: 0, z: 2}], 1, 2, 2),
      [{x: 2, y: 0, z: 3}]);
  const cells = [{x: 0, y: 1, z: 3, col: 2}];
  const two = PuzzleCore.rotatePattern(cells, 2, 4, 6);
  assert.ok(sameSet(two, PuzzleCore.rot180Pattern(cells, 8, 12)), '2×90°=中心对称(k=2*中心)');
  assert.ok(sameSet(PuzzleCore.rotatePattern(cells, 4, 4, 6), cells), '4×90° 归位');
});

test('translatePattern: 三轴平移, 颜色保留', () => {
  const r = PuzzleCore.translatePattern([{x: 1, y: 2, z: 3, col: 7}], 2, -1, 0);
  assert.deepStrictEqual(r, [{x: 3, y: 1, z: 3, col: 7}]);
});

/* ============ 对称补全: 出题(给半边)与判分(D 族) ============ */

test('mkSymmetryPuzzle: solution = 半边 ∪ 镜像半边, 三种轴全覆盖', () => {
  for (const axis of ['x', 'z', 'c']) {
    const p = PuzzleCore.mkSymmetryPuzzle({seed: 42, axis});
    assert.strictEqual(p.axis, axis);
    assert.ok(p.half.length >= 2, axis + ' 半边至少 2 块');
    assert.strictEqual(p.solution.length, p.half.length * 2, axis + ' 解=半边×2(无跨镜面块)');
    // 手算对照: 解集对镜面变换不变(对称性独立真值)
    const back = p.axis === 'x' ? PuzzleCore.mirrorPattern(p.solution, 'x', p.k) :
      p.axis === 'z' ? PuzzleCore.mirrorPattern(p.solution, 'z', p.kz) :
        PuzzleCore.rot180Pattern(p.solution, p.k, p.kz);
    assert.ok(sameSet(back, p.solution), axis + ' 解集变换后不变');
    // 半边严格在镜面一侧(coord < (k+1)/2 即 x<hw / z<hw), 不许跨面
    const halfSide = p.axis === 'z' ?
      p.half.every((c) => c.z < (p.kz + 1) / 2) :
      p.half.every((c) => c.x < (p.k + 1) / 2);
    assert.ok(halfSide, axis + ' 半边不得跨镜面');
  }
});

test('mkSymmetryPuzzle: 同 seed 同输出, 跨 seed 有差异', () => {
  const a = PuzzleCore.mkSymmetryPuzzle({seed: 7, axis: 'x'});
  const b = PuzzleCore.mkSymmetryPuzzle({seed: 7, axis: 'x'});
  assert.deepStrictEqual(a, b);
  const others = new Set(SEEDS.filter((s) => s !== 7)
      .map((s) => JSON.stringify(PuzzleCore.mkSymmetryPuzzle({seed: s, axis: 'x'}).half)));
  assert.ok(others.size >= 2, '不同 seed 应产出不同半边');
});

test('gradeSymmetry: 正确补全=真; 缺一块/多一对同色对称块=假', () => {
  const p = PuzzleCore.mkSymmetryPuzzle({seed: 5, axis: 'x'});
  const mirrorCells = p.solution.filter((c) => !p.half.some((h) => key(h) === key(c)));
  assert.strictEqual(PuzzleCore.gradeSymmetry(mirrorCells, p), true, '精确镜像补全应判对');
  assert.strictEqual(PuzzleCore.gradeSymmetry(mirrorCells.slice(1), p), false, '缺一块判错');
  const extra = mirrorCells.concat([Object.assign({}, mirrorCells[0],
      {x: mirrorCells[0].x + 1}), Object.assign({}, mirrorCells[0],
      {x: p.k - (mirrorCells[0].x + 1)})]);
  assert.strictEqual(PuzzleCore.gradeSymmetry(extra, p), false, '多摆一对(虽对称)判错');
  assert.strictEqual(PuzzleCore.gradeSymmetry([], p), false, '空白判错');
});

test('gradeSymmetry: z 轴(前后镜)与 c 轴(中心对称)判分同口径', () => {
  for (const axis of ['z', 'c']) {
    const p = PuzzleCore.mkSymmetryPuzzle({seed: 11, axis});
    const mirrorCells = p.solution.filter((c) => !p.half.some((h) => key(h) === key(c)));
    assert.strictEqual(PuzzleCore.gradeSymmetry(mirrorCells, p), true, axis + ' 精确补全判对');
    const shifted = mirrorCells.map((c) => Object.assign({}, c, {x: c.x + 1}));
    assert.strictEqual(PuzzleCore.gradeSymmetry(shifted, p), false, axis + ' 平移错位判错');
  }
});

/* ============ 俯视投影: 结构 → 图纸, 反向判分(E 族) ============ */

test('projectTop: 每列取最高块的占用与颜色 — 手算对照', () => {
  // 2×2 场地: (0,0)列两块顶是蓝色(2), (1,0)只一块红色(1), (0,1)空, (1,1)一块
  const cells = [
    {x: 0, y: 0, z: 0, col: 1}, {x: 0, y: 1, z: 0, col: 2},
    {x: 1, y: 0, z: 0, col: 1}, {x: 1, y: 0, z: 1, col: 3},
  ];
  const r = PuzzleCore.projectTop(cells);
  assert.strictEqual(r.w, 2);
  assert.strictEqual(r.d, 2);
  assert.deepStrictEqual(Array.from(r.top), [2, 1, 0, 3]); // 行主序 z 行 × x 列
});

test('projectTop: 缺省颜色记 1; 空结构 → 0×0 空图', () => {
  const r = PuzzleCore.projectTop([{x: 0, y: 0, z: 0}]);
  assert.deepStrictEqual(Array.from(r.top), [1]);
  const empty = PuzzleCore.projectTop([]);
  assert.strictEqual(empty.w, 0);
  assert.strictEqual(empty.top.length, 0);
});

test('gradeBlueprint: 同结构=真; 顶块颜色不同/缺一列/多一列=假', () => {
  const cells = [
    {x: 0, y: 0, z: 0, col: 1}, {x: 0, y: 1, z: 0, col: 2},
    {x: 1, y: 0, z: 0, col: 1},
  ];
  const bp = PuzzleCore.projectTop(cells);
  assert.strictEqual(PuzzleCore.gradeBlueprint(cells, bp), true);
  assert.strictEqual(PuzzleCore.gradeBlueprint(
      cells.filter((c) => !(c.x === 1 && c.y === 0)), bp), false, '缺列判错');
  assert.strictEqual(PuzzleCore.gradeBlueprint(
      cells.concat([{x: 0, y: 2, z: 0, col: 3}]), bp), false, '顶色被加高盖住判错');
  assert.strictEqual(PuzzleCore.gradeBlueprint(
      cells.concat([{x: 2, y: 0, z: 0, col: 1}]), bp), false, '多一列(越图纸界)判错');
  // 内部加高同色不露头: 俯视图纸口径下投影确实不变(隐藏块谜点的根基);
  // 异色加盖 → 顶色变 → 判错
  assert.strictEqual(PuzzleCore.gradeBlueprint(
      cells.concat([{x: 1, y: 1, z: 0, col: 1}]), bp), true, '同色加盖投影不变仍匹配');
  assert.strictEqual(PuzzleCore.gradeBlueprint(
      cells.concat([{x: 1, y: 1, z: 0, col: 3}]), bp), false, '异色加盖变顶色判错');
});

test('mkBlueprintPuzzle: 蓝图与结构互证, 同 seed 同输出, 组块红线 ≤4×4', () => {
  for (const seed of SEEDS) {
    const p = PuzzleCore.mkBlueprintPuzzle({seed});
    assert.ok(p.cells.length >= 2, '谜面至少 2 块');
    assert.ok(p.cells.length <= 32, '总块数上限(4×4×2 满铺)');
    assert.strictEqual(PuzzleCore.gradeBlueprint(p.cells, p.blueprint), true,
        '生成结构必匹配自己的蓝图');
    assert.ok(p.blueprint.w <= 4 && p.blueprint.d <= 4, '图纸网格 ≤4×4 组块红线');
  }
  assert.deepStrictEqual(PuzzleCore.mkBlueprintPuzzle({seed: 3}),
      PuzzleCore.mkBlueprintPuzzle({seed: 3}));
});

/* ============ 空间计数: 隐藏块与露在外面的面(E 族 ★★) ============ */

/* 手工造 3×3×3 实心立方(27 块) 与 2×2×2(8 块) 与 2×2×1 板(4 块) */
function box(w, h, d, y0) {
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < d; z++) {
      for (let x = 0; x < w; x++) {
        out.push({x, y: (y0 || 0) + y, z});
      }
    }
  }
  return out;
}

test('hiddenBlocks / exposedFaces: 单块与分离两块 — 6 面/12 面, 无隐藏', () => {
  assert.strictEqual(PuzzleCore.hiddenBlocks([{x: 0, y: 0, z: 0}]), 0);
  assert.strictEqual(PuzzleCore.exposedFaces([{x: 0, y: 0, z: 0}]), 6);
  const two = [{x: 0, y: 0, z: 0}, {x: 5, y: 0, z: 0}];
  assert.strictEqual(PuzzleCore.hiddenBlocks(two), 0);
  assert.strictEqual(PuzzleCore.exposedFaces(two), 12);
});

test('hiddenBlocks / exposedFaces: 2×2×2 与 2×2×1 手算对照(24 面/16 面)', () => {
  assert.strictEqual(PuzzleCore.hiddenBlocks(box(2, 2, 2)), 0, '2×2×2 无全包块');
  assert.strictEqual(PuzzleCore.exposedFaces(box(2, 2, 2)), 24);
  assert.strictEqual(PuzzleCore.hiddenBlocks(box(2, 1, 2)), 0);
  assert.strictEqual(PuzzleCore.exposedFaces(box(2, 1, 2)), 16);
});

test('hiddenBlocks: 3×3×3 实心塔藏 1 块(总-可见口径); 露面 54', () => {
  const tower = box(3, 3, 3);
  assert.strictEqual(tower.length, 27);
  assert.strictEqual(PuzzleCore.hiddenBlocks(tower), 1, '只有正中心 1 块六面被包');
  assert.strictEqual(PuzzleCore.exposedFaces(tower), 54);
  // 可见块数 = 总块数 - 隐藏块数(工单口径: hiddenBlocks 即"总-可见"的答案)
  assert.strictEqual(tower.length - PuzzleCore.hiddenBlocks(tower), 26);
});

test('hiddenBlocks: 三层夹心 — 底板+十字+顶板, 藏的恰是十字中心 1 块', () => {
  // y0 底板 3×3 + y1 十字(中心+四边中点) + y2 顶板 3×3:
  // 十字中心六面皆被包(上顶板/下底板/四侧十字臂) → 藏 1; 其余全部露面
  const cells = box(3, 1, 3, 0).concat(box(3, 1, 3, 2));
  cells.push({x: 1, y: 1, z: 1}, {x: 0, y: 1, z: 1}, {x: 2, y: 1, z: 1},
      {x: 1, y: 1, z: 0}, {x: 1, y: 1, z: 2});
  assert.strictEqual(cells.length, 23);
  assert.strictEqual(PuzzleCore.hiddenBlocks(cells), 1);
});

/* ============ 数列规律: 等差 / 交替型(C·规律跳 与 F·数列) ============ */

/* 规则键 → 独立重推序列(测试侧真值: 不调实现, 只解析键) */
function replaySeq(rule, first, shown) {
  const m = rule.match(/^(arith|alt)([+-]\d+)([+-]\d+)?$/);
  const terms = [first];
  if (m[1] === 'arith') {
    const d = Number(m[2]);
    for (let i = 1; i <= shown; i++) terms.push(terms[i - 1] + d);
  } else {
    const p = Number(m[2]); const q = Number(m[3]);
    for (let i = 1; i <= shown; i++) terms.push(terms[i - 1] + (i % 2 === 1 ? p : q));
  }
  return terms;
}

test('mkSeqPuzzle: 规则键独立重推 — 展示项与下一项都按规则走, 全部 ≥1', () => {
  for (const seed of SEEDS) {
    for (const max of [20, 100]) {
      const p = PuzzleCore.mkSeqPuzzle({seed, max});
      assert.ok(p.seq.length >= 3 && p.seq.length <= PuzzleCore.LIMITS.chunks,
          '展示项 3~4(≤4 组块红线)');
      const replay = replaySeq(p.rule, p.seq[0], p.seq.length); // 展示项+下一项
      assert.strictEqual(replay[p.seq.length], p.next, '下一项=规则外推');
      replay.slice(0, p.seq.length).forEach((v, i) =>
        assert.strictEqual(v, p.seq[i], '展示项与规则一致'));
      const nums = p.seq.concat([p.next]);
      assert.ok(nums.every((v) => v >= 1 && v <= max), '全部落在 1..max(不超前)');
    }
  }
});

test('mkSeqPuzzle: kind 指定生效 — arith 必等差键, alt 必交替键(含负步)', () => {
  for (const seed of SEEDS) {
    assert.ok(PuzzleCore.mkSeqPuzzle({seed, max: 20, kind: 'arith'}).rule.startsWith('arith+'));
    const alt = PuzzleCore.mkSeqPuzzle({seed, max: 100, kind: 'alt'});
    assert.ok(alt.rule.startsWith('alt'), 'alt 键形如 alt+p±q');
    const m = alt.rule.match(/^alt([+-]\d+)([+-]\d+)$/);
    assert.ok(Number(m[1]) !== Number(m[2]), '两步不等才是交替');
    // 负步交替项也全部 ≥1(第一学段无负数)
    alt.seq.concat([alt.next]).forEach((v) => assert.ok(v >= 1));
  }
  // 跨 seed 至少出现过一次负步交替(进阶形态确实会出)
  assert.ok(SEEDS.map((s) => PuzzleCore.mkSeqPuzzle({seed: s, max: 100, kind: 'alt'}).rule)
      .some((r) => r.includes('-')), '负步交替可见');
});

test('mkSeqPuzzle: 同 seed 同输出; max 过小直接拒绝(防御)', () => {
  assert.deepStrictEqual(PuzzleCore.mkSeqPuzzle({seed: 42, max: 20}),
      PuzzleCore.mkSeqPuzzle({seed: 42, max: 20}));
  assert.throws(() => PuzzleCore.mkSeqPuzzle({seed: 1, max: 6}), /max/,
      'max=6 连 1,3,5,7 都摆不下, 应抛错');
});

/* ============ 周期问题: periodAt 取模求解(F ★★ "不许摆完") ============ */

test('periodAt: 红红蓝(单元[1,1,2]) 第15个手算对照 — (n-1)%周期长', () => {
  const unit = [1, 1, 2]; // 红红蓝 → 颜色号
  // 逐个摆: 1..3 红红蓝 · 4..6 红红蓝 · … · 13,14,15 = 红,红,蓝 → 第15个是蓝(单元第3位)
  assert.deepStrictEqual(PuzzleCore.periodAt(unit, 15), {index: 2, item: 2},
      '(15-1)%3=2 → 蓝(单元第3个)');
  assert.deepStrictEqual(PuzzleCore.periodAt(unit, 3), {index: 2, item: 2});
  assert.deepStrictEqual(PuzzleCore.periodAt(unit, 4), {index: 0, item: 1});
  assert.deepStrictEqual(PuzzleCore.periodAt(unit, 1), {index: 0, item: 1});
});

test('mkPeriodPuzzle: n 超单元长(必须靠规律推)、单元 2..4 且 ≥2 种符号', () => {
  for (const seed of SEEDS) {
    const p = PuzzleCore.mkPeriodPuzzle({seed, max: 20});
    assert.ok(p.unit.length >= 2 && p.unit.length <= PuzzleCore.LIMITS.chunks, '单元长 2..4');
    assert.ok(new Set(p.unit).size >= 2, '全同单元不成周期');
    assert.ok(p.n > p.unit.length, 'n 必须超出单元长(摆不完才要推)');
    assert.ok(p.n <= 20, 'n 跟带 ≤20');
    assert.deepStrictEqual(p.answer, PuzzleCore.periodAt(p.unit, p.n), '答案=取模求解');
    assert.strictEqual(p.groups, Math.floor(p.n / p.unit.length), '整周期数口径');
  }
  assert.deepStrictEqual(PuzzleCore.mkPeriodPuzzle({seed: 9, max: 20}),
      PuzzleCore.mkPeriodPuzzle({seed: 9, max: 20}));
});

/* ============ 多解枚举: partitionsOf 不重不漏(B ★★ 有序思考) ============ */

/* 测试侧独立真值: 暴力全搜(与实现的"首元素递增"生成法不同构) */
function brute(n, parts, min) {
  const out = [];
  if (parts === 2) {
    for (let a = min; a <= n; a++) for (let b = a; b <= n; b++) if (a + b === n) out.push([a, b]);
  } else {
    for (let a = min; a <= n; a++) {
      for (let b = a; b <= n; b++) {
        for (let c = b; c <= n; c++) {
          if (a + b + c === n) out.push([a, b, c]);
        }
      }
    }
  }
  return out;
}

test('partitionsOf: 合成 10 的数对手算对照 — 恰 5 对, 首元素升序', () => {
  assert.deepStrictEqual(PuzzleCore.partitionsOf(10, {parts: 2}),
      [[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]]);
  assert.deepStrictEqual(PuzzleCore.partitionsOf(9, {parts: 2}),
      [[1, 8], [2, 7], [3, 6], [4, 5]]);
  assert.deepStrictEqual(PuzzleCore.partitionsOf(10, {parts: 2, min: 3}),
      [[3, 7], [4, 6], [5, 5]], 'min 抬下限');
});

test('partitionsOf: 三元组 n=6/7 手算对照', () => {
  assert.deepStrictEqual(PuzzleCore.partitionsOf(6, {parts: 3}),
      [[1, 1, 4], [1, 2, 3], [2, 2, 2]]);
  assert.deepStrictEqual(PuzzleCore.partitionsOf(7, {parts: 3}),
      [[1, 1, 5], [1, 2, 4], [1, 3, 3], [2, 2, 3]]);
});

test('partitionsOf: n=2..14 双份对拍暴力全搜 — 不重不漏, 组内升序', () => {
  for (const parts of [2, 3]) {
    for (let n = 2; n <= 14; n++) {
      const got = PuzzleCore.partitionsOf(n, {parts, min: 1});
      assert.deepStrictEqual(got, brute(n, parts, 1),
          'n=' + n + ' parts=' + parts + ' 与暴力全搜一致');
      got.forEach((tup) => {
        assert.strictEqual(tup.reduce((s, v) => s + v, 0), n, '每组和恰为 n');
        for (let i = 1; i < tup.length; i++) assert.ok(tup[i - 1] <= tup[i], '组内升序');
      });
    }
  }
  assert.deepStrictEqual(PuzzleCore.partitionsOf(3, {parts: 2, min: 2}), [],
      '2+2>3 无解时空表(不是 null)');
});

test('mkPartitionPuzzle: 数对/三元组出题 — n 跟带、解 ≥2、答案表即枚举', () => {
  for (const seed of SEEDS) {
    const pq = PuzzleCore.mkPartitionPuzzle({seed, max: 20, parts: 2});
    assert.ok(pq.n >= 4 && pq.n <= 20, 'n 跟带 4..20');
    assert.ok(pq.solutions.length >= 2, '至少 2 组解(多解才有"找齐"可言)');
    assert.deepStrictEqual(pq.solutions, PuzzleCore.partitionsOf(pq.n, {parts: 2}));
    const pt = PuzzleCore.mkPartitionPuzzle({seed, max: 100, parts: 3});
    assert.ok(pt.n >= 6 && pt.n <= 12, '三元组 n 限 6..12(解个数可控)');
    assert.deepStrictEqual(pt.solutions, PuzzleCore.partitionsOf(pt.n, {parts: 3}));
  }
  assert.deepStrictEqual(PuzzleCore.mkPartitionPuzzle({seed: 21, max: 20}),
      PuzzleCore.mkPartitionPuzzle({seed: 21, max: 20}));
});

/* ============ 天平代换链(B ★★ 等量代换) ============ */

test('mkScalePuzzle: 天平语义验证 — 关系两侧配重相等, 答案是唯一整数配重', () => {
  for (const seed of SEEDS) {
    const p = PuzzleCore.mkScalePuzzle({seed, max: 20});
    assert.ok(p.names.length === 2 || p.names.length === 3, '2 实体(单步)或 3 实体(链)');
    assert.strictEqual(p.relations.length, p.names.length - 1, '关系数=实体数-1(链不断)');
    // 形状: 关系按实体序首尾相连 a→b(→c)
    p.relations.forEach((rel, i) => {
      assert.strictEqual(rel.from, p.names[i]);
      assert.strictEqual(rel.to, p.names[i + 1]);
      assert.ok(rel.right % rel.left === 0, 'r 必须被 l 整除(1 只换算得整数)');
    });
    // 质量口径(独立真值): 从链尾反推每实体质量, 再前向验证每条天平两侧平衡
    const mass = {};
    mass[p.names[p.names.length - 1]] = 1;
    for (let i = p.relations.length - 1; i >= 0; i--) {
      const rel = p.relations[i];
      mass[rel.from] = mass[rel.to] * rel.right / rel.left;
    }
    for (const rel of p.relations) {
      assert.strictEqual(rel.left * mass[rel.from], rel.right * mass[rel.to],
          '关系两侧配重相等(天平平衡)');
    }
    // 问句 "ask.n 只 ask.from = ? 只 ask.to": 唯一整数解 X 使天平平衡
    const x = p.ask.n * mass[p.ask.from] / mass[p.ask.to];
    assert.ok(Number.isInteger(x), '换算链终点必须是整数(第一学段无分数)');
    assert.strictEqual(p.answer, x, '答案=天平平衡的唯一整数配重');
    const nums = [p.answer, p.ask.n];
    p.relations.forEach((r) => nums.push(r.left, r.right));
    assert.ok(nums.every((v) => v >= 1 && v <= 20), '天平全部读数跟带 1..20');
  }
});

test('mkScalePuzzle: 链式两跳(2A=4B, 3B=6C 型) + 同 seed 同输出', () => {
  let sawChain = false;
  for (const seed of SEEDS.concat([31, 32, 33, 34])) {
    const p = PuzzleCore.mkScalePuzzle({seed, max: 100, chain: true});
    if (p.relations.length === 2) sawChain = true;
  }
  assert.ok(sawChain, 'chain:true 可产两跳代换链');
  assert.deepStrictEqual(PuzzleCore.mkScalePuzzle({seed: 8, max: 20}),
      PuzzleCore.mkScalePuzzle({seed: 8, max: 20}));
});

/* ============ 线索排队(F ★★ 逻辑推理): 3 实体 × 2~3 线索唯一全序 ============ */

test('solveClueOrder: 链式两线索定全序; 线索乱序不影响', () => {
  const keys = ['a', 'b', 'c'];
  assert.deepStrictEqual(PuzzleCore.solveClueOrder(keys,
      [{hi: 'a', lo: 'b'}, {hi: 'b', lo: 'c'}]), ['a', 'b', 'c']);
  assert.deepStrictEqual(PuzzleCore.solveClueOrder(keys,
      [{hi: 'b', lo: 'c'}, {hi: 'a', lo: 'b'}]), ['a', 'b', 'c'], '线索次序无关');
});

test('solveClueOrder: 不唯一(少一条可比线索)与矛盾(成环)都返回 null', () => {
  assert.strictEqual(PuzzleCore.solveClueOrder(['a', 'b', 'c'],
      [{hi: 'a', lo: 'b'}, {hi: 'a', lo: 'c'}]), null, 'b 与 c 不可比 → 不唯一');
  assert.strictEqual(PuzzleCore.solveClueOrder(['a', 'b', 'c'],
      [{hi: 'a', lo: 'b'}, {hi: 'b', lo: 'a'}]), null, 'a>b 且 b>a → 矛盾');
  assert.strictEqual(PuzzleCore.solveClueOrder(['a', 'b', 'c'], []), null, '无线索');
});

test('mkClueOrderPuzzle: 三实体值互异跟带, 线索 2~3 条, 解唯一且与值降序一致', () => {
  for (const seed of SEEDS) {
    const p = PuzzleCore.mkClueOrderPuzzle({seed, max: 20});
    assert.strictEqual(p.entities.length, 3, '恰好 3 实体(组块红线)');
    const vals = p.entities.map((e) => e.value);
    assert.strictEqual(new Set(vals).size, 3, '属性值互异(全序才有意义)');
    assert.ok(vals.every((v) => v >= 1 && v <= 20), '读数跟带');
    assert.ok(p.clues.length >= 2 && p.clues.length <= PuzzleCore.LIMITS.clues,
        '线索 2~3 条(红线 ≤3)');
    // 独立真值: 按属性值直接降序排
    const byVal = p.entities.slice().sort((x, y) => y.value - x.value).map((e) => e.key);
    assert.deepStrictEqual(p.solution, byVal, '标准解=值降序');
    // 解链可由 solveClueOrder 从线索推出(唯一性生成器内部保证)
    assert.deepStrictEqual(PuzzleCore.solveClueOrder(p.entities.map((e) => e.key), p.clues),
        byVal, '线索推得的唯一全序与标准解一致');
  }
  assert.deepStrictEqual(PuzzleCore.mkClueOrderPuzzle({seed: 4, max: 20}),
      PuzzleCore.mkClueOrderPuzzle({seed: 4, max: 20}));
});

/* ============ 间隔问答(C ★★ 植树问题具身版) ============ */

test('mkIntervalPuzzle: 教材口径手算对照 — 第3格到第9格 三种数法', () => {
  // 两端都算: 3,4,5,6,7,8,9 → 7 格; 都不算: 4..8 → 5 格; 只算一端: 6 格
  assert.deepStrictEqual(PuzzleCore.mkIntervalPuzzle({seed: 1, max: 20, a: 3, b: 9, mode: 'both'}),
      {a: 3, b: 9, mode: 'both', answer: 7});
  assert.deepStrictEqual(PuzzleCore.mkIntervalPuzzle({seed: 1, max: 20, a: 3, b: 9, mode: 'neither'}),
      {a: 3, b: 9, mode: 'neither', answer: 5});
  assert.deepStrictEqual(PuzzleCore.mkIntervalPuzzle({seed: 1, max: 20, a: 3, b: 9, mode: 'one'}),
      {a: 3, b: 9, mode: 'one', answer: 6});
});

test('mkIntervalPuzzle: 跨 seed 扫描 — 三种模式都会出, 读数与答案全跟带', () => {
  const modes = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const p = PuzzleCore.mkIntervalPuzzle({seed, max: 20});
    modes.add(p.mode);
    assert.ok(p.a >= 1 && p.a < p.b && p.b <= 20, '1 ≤ a < b ≤ max');
    // 口径公式(独立真值): both=b-a+1 · neither=b-a-1 · one=b-a
    const byMode = {both: p.b - p.a + 1, neither: p.b - p.a - 1, one: p.b - p.a};
    assert.strictEqual(p.answer, byMode[p.mode], p.mode + ' 口径公式');
    assert.ok(p.answer >= 1 && p.answer <= 20, '答案跟带');
    if (p.mode === 'neither') assert.ok(p.b - p.a >= 2, '都不算时保证中间至少 1 格');
  }
  assert.deepStrictEqual(Array.from(modes).sort(), ['both', 'neither', 'one'], '三模式齐备');
  assert.deepStrictEqual(PuzzleCore.mkIntervalPuzzle({seed: 77, max: 20}),
      PuzzleCore.mkIntervalPuzzle({seed: 77, max: 20}));
});

/* ============ 全局红线: 数值跟带 · 同 seed 同输出 · 呈现上限 ============ */

test('全局红线: max=20 时任何出题结果深部数值都不越 20 也不为负(band0 口径)', () => {
  const GENS = [
    (seed) => PuzzleCore.mkSymmetryPuzzle({seed}),
    (seed) => PuzzleCore.mkBlueprintPuzzle({seed}),
    (seed) => PuzzleCore.mkSeqPuzzle({seed, max: 20}),
    (seed) => PuzzleCore.mkPeriodPuzzle({seed, max: 20}),
    (seed) => PuzzleCore.mkPartitionPuzzle({seed, max: 20}),
    (seed) => PuzzleCore.mkPartitionPuzzle({seed, max: 20, parts: 3}),
    (seed) => PuzzleCore.mkScalePuzzle({seed, max: 20}),
    (seed) => PuzzleCore.mkScalePuzzle({seed, max: 20, chain: true}),
    (seed) => PuzzleCore.mkClueOrderPuzzle({seed, max: 20}),
    (seed) => PuzzleCore.mkIntervalPuzzle({seed, max: 20}),
  ];
  for (let seed = 0; seed < 60; seed++) {
    GENS.forEach((gen, gi) => {
      const nums = allNumbers(gen(seed), []);
      nums.forEach((v) => {
        assert.ok(Number.isInteger(v) && v >= 0 && v <= 20,
            '生成器#' + gi + ' seed=' + seed + ' 出现越带数 ' + v);
      });
    });
  }
});

test('全局红线: 全部出题函数同 seed 同输出; LIMITS 常数与设计稿一致', () => {
  const CASES = [
    () => PuzzleCore.mkSymmetryPuzzle({seed: 5}),
    () => PuzzleCore.mkBlueprintPuzzle({seed: 5}),
    () => PuzzleCore.mkSeqPuzzle({seed: 5, max: 20}),
    () => PuzzleCore.mkPeriodPuzzle({seed: 5, max: 20}),
    () => PuzzleCore.mkPartitionPuzzle({seed: 5, max: 20}),
    () => PuzzleCore.mkScalePuzzle({seed: 5, max: 20}),
    () => PuzzleCore.mkClueOrderPuzzle({seed: 5, max: 20}),
    () => PuzzleCore.mkIntervalPuzzle({seed: 5, max: 20}),
  ];
  CASES.forEach((mk, i) =>
    assert.deepStrictEqual(mk(), mk(), '生成器#' + i + ' 同 seed 必须逐字段一致'));
  assert.deepStrictEqual(PuzzleCore.LIMITS, {chunks: 4, clues: 3},
      '认知负荷红线: 一次呈现 ≤4 组块 · 线索 ≤3 条');
});
