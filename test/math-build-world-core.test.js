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

/* ============ plan/bridge 最省桥(★★ US20): 地形规格 + 可证最少块数 ============ */

/* 暴力对拍神谕(与实现的最短路 DP 不同构): 枚举每列步行高度的全部分配,
   取满足"相邻差 ≤1 · 两端各与岸顶差 ≤1 · 墩列步行面 ≥ 墩顶"的最小
   总块数(河床 0: 普通列块数=步行高, 墩列块数=步行高-墩顶, 不设为负);
   同时记下达到最小的桥面高数组(供端到端搭桥对账) */
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

test('bridgePlan: 教材口径手算对照 — 平岸 par=跨度, 抬岸加高差, 中间墩白走', () => {
  /* 平岸低桥: 河床 0, 两岸高 1, 跨 3 → 每列 1 块, par=3(桥面板数=跨度) */
  const flat = BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 1, piers: []});
  assert.strictEqual(flat.par, 3);
  /* 高岸平桥: 两岸高 3, 跨 4 → 桥面高 [2,1,1,2], par=4+2=6(面板+高差抬升) */
  const high = BuildWorldCore.bridgePlan({span: 4, yL: 3, yR: 3, piers: []});
  assert.strictEqual(high.par, 6);
  /* 岸有高差: 左 1 右 3, 跨 3 → 桥面 [1,1,2], par=4 */
  const slope = BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 3, piers: []});
  assert.strictEqual(slope.par, 4);
  /* 中间墩(顶高 1): 中列零块白走墩顶, par=1+0+1=2 */
  const pier = BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 1, piers: [{x: 2, top: 1}]});
  assert.strictEqual(pier.par, 2);
});

test('bridgePlan: 随机地形与暴力全枚举对拍 — par 是真最小值(可证性)', () => {
  for (let s = 0; s < 40; s++) {
    const plan = BuildWorldCore.bridgePlan({seed: 400 + s, max: 60});
    assert.ok(plan.span >= 3 && plan.span <= 8, '跨度有界 3..8');
    assert.ok(Math.abs(plan.yL - plan.yR) <= plan.span + 1, '两岸高差在可步行范围');
    assert.strictEqual(plan.x0, 1, '空隙列从 1 起(左岸柱 x=0)');
    assert.strictEqual(plan.x1, plan.span, 'x1=span(右岸柱 x=span+1)');
    assert.ok(plan.piers.every((p) => p.x >= plan.x0 && p.x <= plan.x1),
        '墩都在河面空隙列内');
    assert.strictEqual(new Set(plan.piers.map((p) => p.x)).size, plan.piers.length, '墩位互异');
    const capWant = Math.max(plan.yL, plan.yR, ...plan.piers.map((p) => p.top), 0) + 2;
    assert.strictEqual(plan.capY, capWant, '建造上限 = 最高地形 +2');
    assert.ok(plan.par >= plan.span - plan.piers.length, 'par ≥ 跨度-墩数(其余列至少 1 块)');
    assert.ok(plan.par >= 1 && plan.par <= 60, 'par 跟带 1..max');
    assert.strictEqual(brutePar(plan).par, plan.par, 'seed' + (400 + s) + ' 与暴力全枚举一致');
  }
});

test('bridgePlan: 同 seed 同输出 · 显式地形回显 · 两岸不可步行直接拒绝', () => {
  assert.deepStrictEqual(BuildWorldCore.bridgePlan({seed: 6, max: 100}),
      BuildWorldCore.bridgePlan({seed: 6, max: 100}));
  const echo = BuildWorldCore.bridgePlan({span: 5, yL: 2, yR: 2, piers: [{x: 3, top: 2}]});
  assert.strictEqual(echo.span, 5);
  assert.strictEqual(echo.yL, 2);
  assert.strictEqual(echo.yR, 2);
  assert.deepStrictEqual(echo.piers, [{x: 3, top: 2}]);
  assert.strictEqual(echo.par, brutePar(echo).par);
  /* 左右岸差 5 格, 跨 3 只有 4 步 — 每步升降 ≤1 永远走不通, 应抛错 */
  assert.throws(() => BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 6, piers: []}), /bridgePlan/);
});

/* ============ plan/bridge 判分: 连通 · 不越界 · 不悬空 · 块数对账 ============ */

/* 按桥面高数组造实心栈(cells): 列 x=x0+i 码 w[i] 块(z=zLane=0) */
function bridgeStacks(plan, w) {
  const out = [];
  for (let i = 0; i < w.length; i++) {
    for (let y = 0; y < w[i]; y++) out.push({x: plan.x0 + i, y, z: plan.zLane});
  }
  return out;
}

test('bridgeGrade 正例: 平岸/高岸/带墩的 par 桥都 pass+best(可达性对账)', () => {
  /* 平岸低桥: 桥面 [1,1,1] = 3 块 = par */
  const flat = BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 1, piers: []});
  const g1 = BuildWorldCore.bridgeGrade(bridgeStacks(flat, [1, 1, 1]), flat);
  assert.deepStrictEqual(
      {walk: g1.walk, inZone: g1.inZone, supported: g1.supported, count: g1.count},
      {walk: true, inZone: true, supported: true, count: 3});
  assert.strictEqual(g1.par, flat.par);
  assert.strictEqual(g1.pass, true, '通行');
  assert.strictEqual(g1.best, true, '3 块恰达 par=最省');
  /* 高岸桥: 桥面 [2,1,1,2] = 6 块 = par(DP 声称的最小值确实可搭) */
  const high = BuildWorldCore.bridgePlan({span: 4, yL: 3, yR: 3, piers: []});
  const g2 = BuildWorldCore.bridgeGrade(bridgeStacks(high, [2, 1, 1, 2]), high);
  assert.strictEqual(g2.pass, true);
  assert.strictEqual(g2.best, true, '6 块恰达 par');
  /* 中间墩白走: 桥面 [1,墩顶,1], 中列 0 块 → 2 块 = par */
  const pier = BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 1, piers: [{x: 2, top: 1}]});
  const g3 = BuildWorldCore.bridgeGrade(bridgeStacks(pier, [1, 0, 1]), pier);
  assert.strictEqual(g3.count, 2);
  assert.strictEqual(g3.pass, true, '墩顶是地形, 直接踩过');
  assert.strictEqual(g3.best, true);
});

test('bridgeGrade 中间判定: 能过但不最省(三星区分) — 多花 1 块仍通行', () => {
  const plan = BuildWorldCore.bridgePlan({span: 4, yL: 3, yR: 3, piers: []});
  const fat = BuildWorldCore.bridgeGrade(bridgeStacks(plan, [2, 2, 1, 2]), plan);
  assert.strictEqual(fat.count, 7, '比 par(6) 多 1 块');
  assert.strictEqual(fat.walk, true, '桥面 [2,2,1,2] 逐格可走');
  assert.strictEqual(fat.pass, true, '能过');
  assert.strictEqual(fat.best, false, '但不最省');
});

test('bridgeGrade 反例: 台阶差 2 / 断桥(缺列) — walk 必须为假', () => {
  const plan = BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 1, piers: []});
  /* 中列码 3 块: 相邻步行面差 |3-1|=2 > 1, 一步跨不上 */
  const step = BuildWorldCore.bridgeGrade(bridgeStacks(plan, [1, 3, 1]), plan);
  assert.strictEqual(step.walk, false, '台阶差 2 不可走');
  assert.strictEqual(step.pass, false);
  /* 缺中列: 没有站立面 */
  const broken = BuildWorldCore.bridgeGrade(
      [{x: 1, y: 0, z: 0}, {x: 3, y: 0, z: 0}], plan);
  assert.strictEqual(broken.walk, false, '断桥不可走');
});

test('bridgeGrade 反例: 悬空桥 — 步行面齐但脚下没支撑, supported 为假', () => {
  /* 两岸高 2, 桥面 [2,1,2]: 首末列只放 y=1 的浮板(下方 y=0 空) */
  const plan = BuildWorldCore.bridgePlan({span: 3, yL: 2, yR: 2, piers: []});
  const floating = [{x: 1, y: 1, z: 0}, {x: 2, y: 0, z: 0}, {x: 3, y: 1, z: 0}];
  const g = BuildWorldCore.bridgeGrade(floating, plan);
  assert.strictEqual(g.walk, true, '步行面高度齐(浮板也构成站立面)');
  assert.strictEqual(g.supported, false, '但浮空块不算合规桥');
  assert.strictEqual(g.pass, false);
  assert.strictEqual(g.best, false);
});

test('bridgeGrade 反例: 越界 — 岸柱上放块 / 偏出桥线(z) / 超建造上限都算违建', () => {
  const plan = BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 1, piers: []});
  const good = bridgeStacks(plan, [1, 1, 1]);
  const onBank = BuildWorldCore.bridgeGrade(good.concat([{x: 0, y: 1, z: 0}]), plan);
  assert.strictEqual(onBank.inZone, false, '岸柱(x=0)不在建造区');
  assert.strictEqual(onBank.pass, false);
  const offLane = BuildWorldCore.bridgeGrade(good.concat([{x: 2, y: 1, z: 1}]), plan);
  assert.strictEqual(offLane.inZone, false, 'z≠zLane 偏出桥线');
  const tooHigh = BuildWorldCore.bridgeGrade(
      good.concat([{x: 2, y: plan.capY + 1, z: 0}]), plan);
  assert.strictEqual(tooHigh.inZone, false, '超过建造上限 capY');
});

test('bridgeGrade: 空手 = 不可通行 · count 按坐标集合去重', () => {
  const plan = BuildWorldCore.bridgePlan({span: 3, yL: 1, yR: 1, piers: []});
  const empty = BuildWorldCore.bridgeGrade([], plan);
  assert.strictEqual(empty.walk, false, '没放块自然不通');
  assert.strictEqual(empty.count, 0);
  const dup = BuildWorldCore.bridgeGrade(
      [{x: 1, y: 0, z: 0}, {x: 1, y: 0, z: 0}, {x: 2, y: 0, z: 0}, {x: 3, y: 0, z: 0}], plan);
  assert.strictEqual(dup.count, 3, '重复坐标按一份计');
  assert.strictEqual(dup.best, true);
});

/* ============ plan/bridge 出题包装: 跨度跟带 + 预算提示 ============ */

test('mkBridgePuzzle: 预算提示=par · 跨度跟 blocks 预算单调 · par 永不越带', () => {
  assert.deepStrictEqual(BuildWorldCore.mkBridgePuzzle({seed: 9, blocks: 20, max: 100}),
      BuildWorldCore.mkBridgePuzzle({seed: 9, blocks: 20, max: 100}), '同 seed 同输出');
  /* 跨度单调: 预算越大桥越长(同 seed 同 max 下) */
  const spans = [8, 20, 40, 100, 600].map((b) => {
    return BuildWorldCore.mkBridgePuzzle({seed: 3, blocks: b, max: 1000}).plan.span;
  });
  for (let i = 1; i < spans.length; i++) {
    assert.ok(spans[i] >= spans[i - 1], '跨度随 blocks 不减: ' + spans.join(','));
  }
  assert.strictEqual(spans[0], 3, 'band0 小预算 = 最短桥');
  /* 四带红线路径(plan 族 MATH_NUM_TRACK 口径): par ≤ max · 跨度有界 */
  for (const [blocks, max] of [[8, 20], [20, 20], [60, 100], [100, 600], [600, 1000]]) {
    for (let s = 0; s < 10; s++) {
      const pz = BuildWorldCore.mkBridgePuzzle({seed: 600 + s, blocks, max});
      assert.strictEqual(pz.budget, pz.plan.par, '预算提示就是 par');
      assert.ok(pz.plan.par >= 1 && pz.plan.par <= max,
          'blocks=' + blocks + ' max=' + max + ' par=' + pz.plan.par + ' 越带');
      assert.ok(pz.plan.span >= 3 && pz.plan.span <= 8, '跨度有界 3..8');
    }
  }
});

test('bridgeOk(G4 判分口径): reverse 档能过即对, multi-solve 档要最省', () => {
  const mk = (over) => Object.assign({walk: true, inZone: true, supported: true,
    count: 5, par: 5, pass: true, best: true}, over);
  const gBest = mk({});
  const gFat = mk({count: 7, best: false}); // 能过但不最省
  const gFail = mk({walk: false, pass: false, best: false}); // 断桥
  /* 先「能过」: 带 1 首遇(reverse)预算宽松, 判定=三判据全过 */
  assert.strictEqual(BuildWorldCore.bridgeOk(gBest, 'reverse'), true, 'reverse: 最省必对');
  assert.strictEqual(BuildWorldCore.bridgeOk(gFat, 'reverse'), true, 'reverse: 能过即对');
  assert.strictEqual(BuildWorldCore.bridgeOk(gFail, 'reverse'), false, 'reverse: 断桥不对');
  /* 后「最省」: 带 2+(multi-solve)预算收紧到 par, 判定=pass 且 ≤par */
  assert.strictEqual(BuildWorldCore.bridgeOk(gBest, 'multi-solve'), true, 'multi-solve: 最省对');
  assert.strictEqual(BuildWorldCore.bridgeOk(gFat, 'multi-solve'), false,
      'multi-solve: 能过不最省不算对(二星口径由关卡 acc 映射)');
  assert.strictEqual(BuildWorldCore.bridgeOk(gFail, 'multi-solve'), false, 'multi-solve: 断桥不对');
});

test('mkBridgePuzzle + bridgeGrade 端到端: 暴力最优桥搭出来必 pass+best(随机地形)', () => {
  for (let s = 0; s < 20; s++) {
    const pz = BuildWorldCore.mkBridgePuzzle({seed: 500 + s, blocks: 30, max: 60});
    const opt = brutePar(pz.plan);
    assert.strictEqual(opt.par, pz.plan.par, 'seed' + (500 + s) + ' par 对拍');
    /* 按最优桥面高实搭: 墩列从墩顶码起, 普通列从河床码起 */
    const cells = [];
    const pierTop = {};
    for (const p of pz.plan.piers) pierTop[p.x] = p.top;
    for (let i = 0; i < opt.w.length; i++) {
      const x = pz.plan.x0 + i;
      const from = pierTop[x] || 0;
      for (let y = from; y < opt.w[i]; y++) cells.push({x, y, z: pz.plan.zLane});
    }
    const g = BuildWorldCore.bridgeGrade(cells, pz.plan);
    assert.strictEqual(g.count, pz.plan.par, '最优桥块数=par');
    assert.strictEqual(g.walk, true, 'seed' + (500 + s) + ' 最优桥逐格可走');
    assert.strictEqual(g.pass, true);
    assert.strictEqual(g.best, true, '搭出 par 桥判最省');
  }
});

/* ============ plan/dualview 世界装配裁剪(G4): 候选/视图跟变体曲线 ============ */

/* 视图匹配数: 候选投影与谜面逐格相等(occupancy-only 对照, 判分用同口径) */
function frontMatches(cells, front) {
  const f = PuzzleCore.projectFront(cells);
  return f.w === front.w && f.h === front.h &&
      f.front.every((v, i) => v === front.front[i]);
}
function sideMatches(cells, side) {
  const sd = PuzzleCore.projectSide(cells);
  return sd.d === side.d && sd.h === side.h &&
      sd.side.every((v, i) => v === side.side[i]);
}

test('mkWorldDualView: cands=2 单正视图即唯一解(目标+正视互异干扰), views=1', () => {
  for (let s = 0; s < 30; s++) {
    const pz = BuildWorldCore.mkWorldDualView({seed: 700 + s, blocks: 60,
      cands: 2, views: 1});
    assert.strictEqual(pz.views, 1, 'views 回显');
    assert.strictEqual(pz.candidates.length, 2, '候选恰 2(≤4 组块红线)');
    assert.strictEqual(pz.candidates.filter((c) => c.ok).length, 1, '恰一真');
    assert.ok(pz.answer >= 0 && pz.answer < 2, '答案下标有效');
    /* single 档核心性质: 单看正视图匹配数恰 1 — 干扰必与目标正视互异
       (取「侧视孪生」型), 孩子一步对照就能锁定(单步匹配) */
    const n = pz.candidates.filter((c) => frontMatches(c.cells, pz.front)).length;
    assert.strictEqual(n, 1, 'seed' + (700 + s) + ' 正视图匹配数=1(唯一解)');
  }
});

test('mkWorldDualView: cands=4 双视图联合唯一解(单视图匹配数>1), views=2', () => {
  for (let s = 0; s < 30; s++) {
    const pz = BuildWorldCore.mkWorldDualView({seed: 800 + s, blocks: 60,
      cands: 4, views: 2});
    assert.strictEqual(pz.views, 2, 'views 回显');
    assert.strictEqual(pz.candidates.length, 4, '候选恰 4');
    assert.strictEqual(pz.candidates.filter((c) => c.ok).length, 1, '恰一真');
    /* two-step 档核心性质(mkDualViewPuzzle 原构造): 每个干扰恰与目标
       共享一个视图 — 单看任一视图匹配数 >1, 双视图联合恰 1 */
    const nf = pz.candidates.filter((c) => frontMatches(c.cells, pz.front)).length;
    const ns = pz.candidates.filter((c) => sideMatches(c.cells, pz.side)).length;
    const both = pz.candidates.filter((c) =>
      frontMatches(c.cells, pz.front) && sideMatches(c.cells, pz.side)).length;
    assert.ok(nf > 1 && ns > 1, 'seed' + (800 + s) + ' 单视图匹配数>1(须两步)');
    assert.strictEqual(both, 1, '双视图联合匹配恰 1(目标)');
  }
});

test('mkWorldDualView: 同 seed 同输出 · 装场 box 罩住全部候选 · blocks 预算有界', () => {
  assert.deepStrictEqual(
      BuildWorldCore.mkWorldDualView({seed: 42, blocks: 60, cands: 4, views: 2}),
      BuildWorldCore.mkWorldDualView({seed: 42, blocks: 60, cands: 4, views: 2}));
  for (let s = 0; s < 15; s++) {
    const pz = BuildWorldCore.mkWorldDualView({seed: 900 + s, blocks: 100,
      cands: 4, views: 2});
    let maxX = 0; let maxZ = 0; let maxY = 0;
    for (const c of pz.candidates) {
      for (const b of c.cells) {
        if (b.x > maxX) maxX = b.x;
        if (b.z > maxZ) maxZ = b.z;
        if (b.y > maxY) maxY = b.y;
      }
    }
    assert.ok(pz.box.w >= maxX + 1 && pz.box.d >= maxZ + 1 && pz.box.h >= maxY + 1,
        'seed' + (900 + s) + ' box 罩住全部候选(装场定界)');
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
