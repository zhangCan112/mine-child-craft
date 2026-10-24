'use strict';
/* ============================================================
   数学世界轨纯核心 (MathWorldCore, 术语见 GLOSSARY.md「谜题纯核心」
   「数学世界轨引擎」) — 应用层纯核心
   ------------------------------------------------------------
   一句话职责: 摆一摆/搭一搭两族世界变体的谜题形状与候选生成——
   把 mathParamsFor 的曲线参数(span/blocks/layerRate/hiddenRate/
   reasoning)翻译成 PuzzleCore 生成器入参与世界轨专属谜题(平移
   复制/拼组恰填/反向选图/隐藏块/数方块与露面/图纸像素/数字点阵/
   数值候选条), 判分一律复用 PuzzleCore(gradeSymmetry/gradeBlueprint/
   hiddenBlocks/exposedFaces), 本文件不造第二套判分。
   数值轨红线: 一切答案(块数/隐藏数/露面数)结构性 ≤ params.max,
   结构体积 ≤ params.blocks — 带内微升、永不越带(math-levels 口径)。
   认知负荷红线: 选答候选恰 4 个(≤ PuzzleCore.LIMITS.chunks)。
   图案细胞 = {x, y, z, col?}(col 1..3 颜色号), 坐标系为谜题局部
   坐标, 世界装配层负责平移到装场基面。
   interface: MATH_CELL_COLORS · mathWorldSymParams · mkWorldTranslate ·
     mkWorldTangram · mkWorldBuild · mkWorldPick · mkWorldHidden ·
     mkWorldCount · blueprintPixels · digitCells · worldNumChoices
   依赖(经全局名, 调用期解析): PuzzleCore(js/math-puzzles-core.js,
   加载序在本文件之前, 见 index.html) — 生成与判分全部委托;
   随机种子注入: 同常数 LCG(同 seed 同输出, seed 缺省走 Math.random)。
   可测性: 零 THREE · 零 DOM · 有单测 test/math-world-core.test.js
   (Node 直测, PuzzleCore 挂 global 后调用期解析)
   ============================================================ */
const MathWorldCore = (() => {
  /* 颜色号 1..3 → 图纸像素色与话术名(世界装配层的方块映射在
     math-world.js, 两处同表意: 红/蓝/黄) */
  const MATH_CELL_COLORS = {
    1: {css: '#e2564f', name: '红色'},
    2: {css: '#5071d8', name: '蓝色'},
    3: {css: '#e8c547', name: '黄色'},
  };

  /* 种子随机: 与 PuzzleCore.mkRand 同常数的独立 LCG(共享词法环境
     不互抄内部状态, math-levels mathLootRand 同款口径) */
  function mkRand(seed) {
    let s = seed === undefined ? Math.floor(Math.random() * 2147483648) : seed;
    return function() {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }
  function ri(rnd, lo, hi) {
    if (hi < lo) hi = lo;
    return lo + Math.floor(rnd() * (hi - lo + 1));
  }
  const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function shuffle(rnd, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const keyOf = (b) => b.x + ',' + b.y + ',' + b.z;

  /* 细胞集包围盒(装场定界): 返回 {x0, y0, z0, w, d, h} */
  function boundsOf(cells) {
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    let z0 = Infinity; let z1 = -Infinity;
    for (const c of cells) {
      if (c.x < x0) x0 = c.x;
      if (c.x > x1) x1 = c.x;
      if (c.y < y0) y0 = c.y;
      if (c.y > y1) y1 = c.y;
      if (c.z < z0) z0 = c.z;
      if (c.z > z1) z1 = c.z;
    }
    return {x0, y0, z0, w: x1 - x0 + 1, d: z1 - z0 + 1, h: y1 - y0 + 1};
  }

  /* ---------- mirror 族: 曲线参数 → 对称生成器入参 ---------- */

  /* span(图案格数) → {hw, fw, layers, density}: 画布体积随 span 单调
     不减且封顶——单层画布 ≤4×4, 双层 ≤3×3(儿童一次试次的摆放量
     结构性 ≤36 块); layerRate>0 掷骰升双层, span≥40 数值轴到位强制
     双层; density 随 span 微升(0.5→0.62)补数值轴余量。 */
  function mathWorldSymParams(p) {
    const o = p || {};
    const span = o.span || 12;
    const rnd = mkRand(o.seed);
    let layers = 1;
    if (span >= 40) layers = 2;
    else if ((o.layerRate || 0) > 0 && rnd() < o.layerRate) layers = 2;
    const capArea = layers === 2 ? 9 : 16;
    const area = clamp(Math.round(span / 1.1), 4, capArea);
    const hw = clamp(Math.ceil(Math.sqrt(area)), 2, 4);
    const fw = clamp(Math.round(area / hw), 2, 4);
    const density = Math.min(0.62, 0.5 + span / 300);
    return {hw, fw, layers, density};
  }

  /* ---------- mirror/translate 平移复制 ---------- */

  /* 样本 = mkSymmetryPuzzle 的半边(自带随机形状与颜色); 目标 = 样本
     整体向右平移 dx(画布外留 ≥1 格走道), dz 0..1 微错位。解 = 样本 ∪
     平移像, 判分复用 gradeSymmetry(位置精确: 缺一块/挪位/多摆全错)。 */
  function mkWorldTranslate(t) {
    const o = t || {};
    const q = mathWorldSymParams({seed: o.seed, span: o.span, layerRate: o.layerRate});
    const base = PuzzleCore.mkSymmetryPuzzle(Object.assign({seed: o.seed, axis: 'x'}, q));
    const rnd = mkRand(o.seed === undefined ? undefined : o.seed + 7777);
    const sample = base.half;
    const dx = base.box.w + 1 + ri(rnd, 0, 2);
    const dz = ri(rnd, 0, 1);
    const moved = PuzzleCore.translatePattern(sample, dx, 0, dz);
    const solution = sample.concat(moved);
    const b = boundsOf(solution);
    return {offset: {dx, dz}, sample, half: sample, solution,
      box: {w: b.w, d: b.d, h: b.h}};
  }

  /* ---------- mirror/tangram 拼组恰填(★★) ---------- */

  /* 目标轮廓 = 6×6 板上 1~3 个互相搭接的矩形并集(四连通, 4..12 格),
     在板上用玻璃格标记; 解 = 轮廓抬一层(装配层再加世界基面), 判分
     复用 gradeSymmetry(恰填=对, 缺格/多摆全错 — "恰好拼出"的纪律)。 */
  function mkWorldTangram(t) {
    const o = t || {};
    const rnd = mkRand(o.seed);
    const want = clamp(Math.round((o.span || 12) / 2), 4, 12);
    const cells = new Map(); // "x,z" → {x, y:0, z}
    const addRect = (x0, z0, w, h) => {
      for (let z = z0; z < z0 + h; z++) {
        for (let x = x0; x < x0 + w; x++) {
          if (x >= 0 && x < 6 && z >= 0 && z < 6) cells.set(x + ',' + z, {x, y: 0, z});
        }
      }
    };
    const fw = ri(rnd, 2, 3); const fh = ri(rnd, 2, 3);
    addRect(ri(rnd, 0, 6 - fw), ri(rnd, 0, 6 - fh), fw, fh);
    let guard = 0;
    while (cells.size < want && guard++ < 6) { // 沿已有轮廓搭接小矩形(连通由搭接保证)
      const anchor = pick(rnd, [...cells.values()]);
      const w = ri(rnd, 1, 2); const h = ri(rnd, 1, 2);
      addRect(clamp(anchor.x - ri(rnd, 0, w - 1), 0, 6 - w),
          clamp(anchor.z - ri(rnd, 0, h - 1), 0, 6 - h), w, h);
    }
    const target = [...cells.values()].map((c) => ({x: c.x, y: 0, z: c.z}));
    const b = boundsOf(target);
    const norm = target.map((c) => ({x: c.x - b.x0, y: 0, z: c.z - b.z0})); // 归零锚点(装配侧画布 = 轮廓外一圈)
    /* 解与轮廓同在放置平面(局部 y=0): 装配侧玻璃标记嵌地面(y-1),
       孩子往标记正上方摆块 — 判分坐标系与放置坐标系同层 */
    const solution = norm.map((c) => ({x: c.x, y: 0, z: c.z}));
    return {target: norm, half: [], solution,
      box: {w: b.w + 2, d: b.d + 2, h: 1}}; // 画布 = 轮廓四周各留 1 格(多摆空间)
  }

  /* ---------- plan/build 看图施工 ---------- */

  /* blocks(块数预算) → 图纸尺寸 2..4 见方, 判分复用 gradeBlueprint
     (俯视投影逐格相等: 平铺一层同色即对, 高度自由, 换色/缺列即错)。 */
  function mkWorldBuild(t) {
    const o = t || {};
    const rnd = mkRand(o.seed);
    const blocks = o.blocks || 12;
    const hi = clamp(2 + Math.floor(blocks / 15), 2, 4);
    const w = ri(rnd, 2, hi);
    const d = ri(rnd, 2, hi);
    const h = ri(rnd, 1, 2);
    const colors = ri(rnd, 1, 3);
    const p = PuzzleCore.mkBlueprintPuzzle({seed: o.seed, w, d, h, colors});
    return {blueprint: p.blueprint, box: {w: p.blueprint.w, d: p.blueprint.d, h: 2}};
  }

  /* ---------- plan/pick 反向选图 ---------- */

  /* 建筑照 mkBlueprintPuzzle 生成(有高度差才值得看), 真图 = 其俯视
     投影; 干扰图 = 改 1~2 格(填空/挖掉/换色)且互不相同。候选 ≤4
     (认知负荷红线), 恰一真, answer = 真图下标。 */
  function mkWorldPick(t) {
    const o = t || {};
    const rnd = mkRand(o.seed);
    const blocks = o.blocks || 12;
    const hi = clamp(2 + Math.floor(blocks / 15), 2, 4);
    const w = ri(rnd, 2, hi);
    const d = ri(rnd, 2, hi);
    const h = ri(rnd, 1, 2);
    const colors = ri(rnd, 1, 3);
    const p = PuzzleCore.mkBlueprintPuzzle({seed: o.seed, w, d, h, colors});
    const truth = PuzzleCore.projectTop(p.cells);
    const cands = [{w: truth.w, d: truth.d, top: truth.top.slice(), ok: true}];
    let guard = 0;
    while (cands.length < 4 && guard++ < 60) {
      const top = truth.top.slice();
      const nMut = ri(rnd, 1, 2);
      for (let i = 0; i < nMut; i++) {
        const idx = ri(rnd, 0, top.length - 1);
        top[idx] = top[idx] === 0 ? ri(rnd, 1, 3) :
          (rnd() < 0.5 ? 0 : (top[idx] % 3) + 1);
      }
      if (!cands.some((c) => JSON.stringify(c.top) === JSON.stringify(top))) {
        cands.push({w: truth.w, d: truth.d, top, ok: false});
      }
    }
    const shuffled = shuffle(rnd, cands);
    return {cells: p.cells, candidates: shuffled,
      answer: shuffled.findIndex((c) => c.ok)};
  }

  /* ---------- plan/hidden 隐藏块推理 · plan/countall 数方块(★★) ---------- */

  /* 长方体细胞集(w×d×h, y 自 0 起) */
  function boxCells(w, d, h) {
    const out = [];
    for (let y = 0; y < h; y++) {
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) out.push({x, y, z, col: 1});
      }
    }
    return out;
  }

  /* 隐藏块结构两族: 预算 ≥27 走厚墙族(3^3 以上实心长方体, 体积 ≤
     blocks, 可削 1~2 角变化轮廓 — 内部隐藏块不受影响); 小预算走
     十字簇(中心+六邻 = 7 块恰藏 1, 臂上随机外延不产生新隐藏块)。
     answer 由 PuzzleCore.hiddenBlocks 重算(真值单一出口)。 */
  function mkWorldHidden(t) {
    const o = t || {};
    const rnd = mkRand(o.seed);
    const blocks = o.blocks || 20;
    const max = o.max || blocks;
    let cells;
    if (blocks >= 27) {
      let w = 3; let d = 3; let h = 3;
      for (let tries = 0; tries < 8; tries++) {
        w = ri(rnd, 3, 4); d = ri(rnd, 3, 4); h = ri(rnd, 3, 4);
        if (w * d * h <= blocks) break;
        w = 3; d = 3; h = 3; // 兜底最小厚墙 27 块
      }
      cells = boxCells(w, d, h);
      const nCarve = ri(rnd, 0, 2); // 削角(轮廓变化, 内部不动)
      for (let i = 0; i < nCarve; i++) {
        const cx = rnd() < 0.5 ? 0 : w - 1;
        const cz = rnd() < 0.5 ? 0 : d - 1;
        const cy = rnd() < 0.5 ? 0 : h - 1;
        cells = cells.filter((c) => !(c.x === cx && c.z === cz && c.y === cy));
      }
    } else {
      cells = [{x: 0, y: 0, z: 0, col: 1},
        {x: 1, y: 0, z: 0, col: 1}, {x: -1, y: 0, z: 0, col: 1},
        {x: 0, y: 1, z: 0, col: 1}, {x: 0, y: -1, z: 0, col: 1},
        {x: 0, y: 0, z: 1, col: 1}, {x: 0, y: 0, z: -1, col: 1}];
      let extra = Math.max(0, Math.min(blocks - 7, ri(rnd, 0, 3)));
      const arms = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      while (extra-- > 0) { // 臂向外延一块(新块全露面, 不添隐藏)
        const a = pick(rnd, arms);
        cells.push({x: a[0] * 2, y: a[1] * 2, z: a[2] * 2, col: 1});
      }
    }
    const answer = PuzzleCore.hiddenBlocks(cells);
    return {cells, answer: Math.min(answer, max), cands: worldNumChoices(Math.min(answer, max), rnd)};
  }

  /* 数方块(★★): 推理档决定问法 — single/two-step 问总块数(含藏块),
     reverse/multi-solve 问露在外面的面数(涂色外表面积); 露面答案若
     超出数值带(最小 2×2×2 已 24 面)自动回落总块数问法。答案/体积
     结构性 ≤ max/blocks。 */
  function mkWorldCount(t) {
    const o = t || {};
    const rnd = mkRand(o.seed);
    const blocks = o.blocks || 12;
    const max = o.max || blocks;
    const deep = o.reasoning === 'reverse' || o.reasoning === 'multi-solve';
    let mode = deep ? 'faces' : 'total';
    if (mode === 'faces' && max < 24) mode = 'total'; // 带内容不下露面题
    let w; let d; let h;
    if (mode === 'faces') {
      let ok = false;
      for (let tries = 0; tries < 10; tries++) {
        w = ri(rnd, 2, 3); d = ri(rnd, 2, 3); h = ri(rnd, 2, 3);
        const faces = 2 * (w * d + w * h + d * h);
        if (faces <= max && w * d * h <= blocks) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        w = 2; d = 2; h = 2; // 兜底: 24 面已在 max ≥24 的档内
      }
    } else {
      let ok = false;
      for (let tries = 0; tries < 10; tries++) {
        w = ri(rnd, 2, 4); d = ri(rnd, 2, 4); h = ri(rnd, 2, 3);
        if (w * d * h <= blocks) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        w = 2; d = 2; h = 2;
      }
    }
    const cells = boxCells(w, d, h);
    const raw = mode === 'faces' ? PuzzleCore.exposedFaces(cells) : cells.length;
    const answer = Math.min(raw, max);
    return {cells, mode, answer, cands: worldNumChoices(answer, rnd)};
  }

  /* ---------- 呈现件: 图纸像素 · 数字点阵 · 数值候选 ---------- */

  /* 图纸 → 像素色行列表(行主序 z 行 × x 列): 0=空(透明), 其余查
     MATH_CELL_COLORS — 消费方拿行列表直接画 2D 像素图(canvas),
     不用引擎相机远拍(design §3)。 */
  function blueprintPixels(bp) {
    const rows = [];
    for (let z = 0; z < bp.d; z++) {
      const row = [];
      for (let x = 0; x < bp.w; x++) {
        const v = bp.top[z * bp.w + x] || 0;
        row.push(v ? MATH_CELL_COLORS[v].css : '');
      }
      rows.push(row);
    }
    return rows;
  }

  /* 3×5 数字点阵(0~9): 世界内候选板用红羊毛拼数字(无字体渲染);
     返回 [[x, y], ...], 行 0 在上(装配层落在远端=画面上方)。 */
  const DIGITS = [
    '111101101101111', // 0
    '010110010010111', // 1
    '111001111100111', // 2
    '111001111001111', // 3
    '101101111001001', // 4
    '111100111001111', // 5
    '111100111101111', // 6
    '111001010010010', // 7
    '111101111101111', // 8
    '111101111001111', // 9
  ];
  function digitCells(n) {
    const g = DIGITS[n] || DIGITS[0];
    const out = [];
    for (let i = 0; i < 15; i++) {
      if (g[i] === '1') out.push([i % 3, Math.floor(i / 3)]);
    }
    return out;
  }

  /* 数值候选条(世界版 mNumChoices): 答案 + 邻近干扰恰 4 个, 互异
     非负, 洗牌注入 rnd — 同 seed 同输出。 */
  function worldNumChoices(answer, rnd) {
    const vals = [answer];
    let guard = 0;
    while (vals.length < 4 && guard++ < 80) {
      const v = answer + ri(rnd, 1, 4) * (rnd() < 0.5 ? -1 : 1);
      if (v >= 0 && !vals.includes(v)) vals.push(v);
    }
    let extra = 1;
    while (vals.length < 4) vals.push(answer + 10 + extra++); // 干扰兜底(远离答案)
    return shuffle(rnd, vals);
  }

  return {MATH_CELL_COLORS, mathWorldSymParams, mkWorldTranslate, mkWorldTangram,
    mkWorldBuild, mkWorldPick, mkWorldHidden, mkWorldCount, blueprintPixels,
    digitCells, worldNumChoices, boundsOf, keyOf};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MathWorldCore;
