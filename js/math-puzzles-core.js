'use strict';
/* ============================================================
   谜题纯核心 (PuzzleCore, 术语见 GLOSSARY.md「谜题纯核心」) — 应用层纯核心
   ------------------------------------------------------------
   数学冒险岛全部谜题的出题与判分纯变换(是生成器, 不是题库): 图案
   镜像/平移/旋转与对称补全 · 俯视图纸投影与反向判分 · 正视/侧视
   投影与双视角推理 · 隐藏块与露面
   计数 · 数列规律与周期取模 · 合成多解不重不漏枚举 · 天平代换链 ·
   线索排队 · 间隔问答。数值范围由调用方注入 max(四带数值轴,
   生成器结构性永不越界 — band0 传 20 后孩子读到的任何数 >20 都是 bug);
   认知负荷红线写成常数 LIMITS(一次呈现 ≤4 组块 · 线索 ≤3 条);
   随机种子注入: 随机流经全局 RandCore.mkRand(同常数 LCG, 同 seed 同输出,
   seed 缺省走 Math.random 的既定口径), 谜题纯变换本身仍零全局。
   图案细胞 = {x, y, z, col?} 对象数组(col 1..N 颜色号, 可缺省);
   镜像/旋转用整数常数 k 表达镜面/中心(x'=k-x 型, 允许落在两格之间)。
   interface: mirrorPattern · rot180Pattern · rotatePattern ·
     translatePattern(图案变换)
     · mkSymmetryPuzzle · gradeSymmetry(对称补全出题/判分)
     · projectTop · gradeBlueprint · mkBlueprintPuzzle(俯视图纸)
     · projectFront · projectSide · mkDualViewPuzzle(正视/侧视投影与双视角
     推理, US24"正面看是山、侧面看是墙是哪座建筑")
     · hiddenBlocks · exposedFaces(空间计数)
     · mkSeqPuzzle(数列) · periodAt · mkPeriodPuzzle(周期)
     · partitionsOf · mkPartitionPuzzle(多解枚举)
     · mkScalePuzzle(天平代换链) · mkClueOrderPuzzle(可选 want: 意图
     线索条数, 缺省旧行为) · solveClueOrder
     (线索排队) · mkIntervalPuzzle(间隔问答) · LIMITS(呈现红线常数)
   依赖(经全局名, 调用期解析): RandCore(js/rand-core.js, 加载序在本文件
     之前) — mkRand 随机流与 shuffle 洗牌的全仓唯一实现; 谜题纯变换
     零全局(seed/max/pattern 均为入参), 加载零副作用, 浏览器
     <script defer> 与 Node require 同构。
   可测性: 零 THREE · 零 DOM · 有单测 test/math-puzzles-core.test.js
   ============================================================ */
const PuzzleCore = (() => {
  /* 认知负荷红线(设计稿 §4.1): 一次呈现 ≤4 组块 · 线索 ≤3 条
     (组块=孩子一眼要持有的单元: 序列已展示项/周期单元长/线索条数) */
  const LIMITS = {chunks: 4, clues: 3};

  /* [lo, hi] 闭区间整数(hi<lo 时钳回 lo, 生成器结构保证不触发) */
  function ri(rnd, lo, hi) {
    if (hi < lo) hi = lo;
    return lo + Math.floor(rnd() * (hi - lo + 1));
  }
  const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
  /* 细胞坐标键(判分集合比较用) */
  const keyOf = (b) => b.x + ',' + b.y + ',' + b.z;

  /* ---------- 图案变换(D 族): 细胞 {x,y,z,col?} 的纯坐标变换 ---------- */

  /* 镜像: axis 'x' → x'=k-x(左右镜, 镜面 x=k/2) · 'z' → z'=k-z(前后镜) */
  function mirrorPattern(cells, axis, k) {
    return cells.map((b) => (axis === 'z') ?
        Object.assign({}, b, {z: k - b.z}) :
        Object.assign({}, b, {x: k - b.x}));
  }

  /* 中心对称(180°): (x,z) → (kx-x, kz-z), y 不动 — 中心 (kx/2, kz/2) */
  function rot180Pattern(cells, kx, kz) {
    return cells.map((b) => Object.assign({}, b, {x: kx - b.x, z: kz - b.z}));
  }

  /* 水平 90°×turns(绕竖直轴过块心整数点 (cx,cz)): x'=cx+(z-cz), z'=cz-(x-cx) */
  function rotatePattern(cells, turns, cx, cz) {
    const n = ((turns % 4) + 4) % 4;
    let cur = cells.map((b) => Object.assign({}, b));
    for (let t = 0; t < n; t++) {
      cur = cur.map((b) => Object.assign({}, b, {x: cx + (b.z - cz), z: cz - (b.x - cx)}));
    }
    return cur;
  }

  /* 平移复制(重摆 N 格): 三轴同加 */
  function translatePattern(cells, dx, dy, dz) {
    return cells.map((b) => Object.assign({}, b,
        {x: b.x + dx, y: b.y + dy, z: b.z + dz}));
  }

  /* ---------- 对称补全(D 族): 出题给半边, 判分对整集 ---------- */

  /* 出题: t = {seed, axis 'x'|'z'|'c'(缺省掷骰), hw 半边宽 2..4, fw 全宽
     2..4, layers 层数 1..2, density 填充率}。半边只生成在镜面一侧
     (x<hw / z<hw), k=2*hw-1 使镜像落在另一侧且格格对应; 'c' 轴为
     中心对称(二年级旋转对称), 半边取 x 一侧、整深翻转。
     返回 {axis, k, kz, half, solution, box{w,d,h}} — solution 即标准答案
     (半边 ∪ 变换半边), box 供世界轨装场定界。 */
  function mkSymmetryPuzzle(t) {
    const o = t || {};
    const rnd = RandCore.mkRand(o.seed);
    const hw = o.hw || ri(rnd, 2, 4);
    const fw = o.fw || ri(rnd, 2, 4);
    const layers = o.layers || (rnd() < 0.3 ? 2 : 1);
    const axis = o.axis || pick(rnd, ['x', 'z', 'c']);
    const density = o.density || 0.55;
    let half = [];
    for (let tries = 0; tries < 8; tries++) {
      half = [];
      for (let y = 0; y < layers; y++) {
        for (let z = 0; z < fw; z++) {
          for (let x = 0; x < hw; x++) {
            if (rnd() < density) half.push({x, y, z, col: ri(rnd, 1, 3)});
          }
        }
      }
      if (half.length >= 2) break; // 至少 2 块才成谜面(太稀再掷一轮)
    }
    if (half.length < 2) { // 密度极端兜底: 固定两块
      half = [{x: 0, y: 0, z: 0, col: 1}, {x: hw - 1, y: 0, z: fw - 1, col: 1}];
    }
    const k = 2 * hw - 1; const kz = 2 * fw - 1;
    const twin = axis === 'x' ? mirrorPattern(half, 'x', k) :
      axis === 'z' ? mirrorPattern(half, 'z', kz) :
        rot180Pattern(half, k, kz);
    const box = axis === 'z' ? {w: hw, d: 2 * fw, h: layers} :
      axis === 'c' ? {w: 2 * hw, d: 2 * fw, h: layers} :
        {w: 2 * hw, d: fw, h: layers};
    return {axis, k, kz, half, solution: half.concat(twin), box};
  }

  /* 判分: 孩子摆的 cells + 谜面半边 取并后与标准解逐格精确相等
     (对称不变 + 半边保留 + 不多摆 — 多摆一对虽然对称也非所问) */
  function gradeSymmetry(cells, p) {
    const want = new Set(p.solution.map(keyOf));
    const got = new Set(p.half.concat(cells || []).map(keyOf));
    if (got.size !== want.size) return false;
    for (const k of got) if (!want.has(k)) return false;
    return true;
  }

  /* ---------- 俯视投影(E 族): 结构 → 图纸, 图纸 → 判分 ---------- */

  /* 投影: 每列 (x,z) 只记最高块的占用与颜色(顶层可见, 下层被盖住)。
     返回 {w, d, top} — top 行主序(z 行 × x 列), 0=空, 其余=颜色号。
     图纸"不拍照"(设计稿 §3): 消费方拿 top 直接画 2D 像素图。 */
  function projectTop(cells) {
    if (!cells.length) return {w: 0, d: 0, top: []};
    let minX = Infinity; let maxX = -Infinity;
    let minZ = Infinity; let maxZ = -Infinity;
    const best = new Map(); // "x,z" → 该列最高块
    for (const b of cells) {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
      if (b.z < minZ) minZ = b.z;
      if (b.z > maxZ) maxZ = b.z;
      const k = b.x + ',' + b.z;
      const cur = best.get(k);
      if (!cur || b.y > cur.y) best.set(k, {x: b.x, z: b.z, y: b.y, col: b.col || 1});
    }
    const w = maxX - minX + 1;
    const d = maxZ - minZ + 1;
    const top = new Array(w * d).fill(0);
    for (const v of best.values()) top[(v.z - minZ) * w + (v.x - minX)] = v.col;
    return {w, d, top};
  }

  /* 反向判分: 结构的俯视投影与图纸逐格相等(占用+颜色)。
     加高盖顶/缺列/越界多列都投影不等 → 假。 */
  function gradeBlueprint(cells, blueprint) {
    const p = projectTop(cells);
    if (p.w !== blueprint.w || p.d !== blueprint.d) return false;
    for (let i = 0; i < blueprint.top.length; i++) {
      if ((p.top[i] || 0) !== (blueprint.top[i] || 0)) return false;
    }
    return true;
  }

  /* 出题: t = {seed, w 2..4, d 2..4, h 1..2, colors 1..3} — 随机结构
     (列高 0..h, 约 30% 空列制造图纸留白)与它的蓝图。
     看图施工的孩子只要搭出同投影即判对(内部藏块不露头则投影不变)。 */
  function mkBlueprintPuzzle(t) {
    const o = t || {};
    const rnd = RandCore.mkRand(o.seed);
    const w = o.w || ri(rnd, 2, 4);
    const d = o.d || ri(rnd, 2, 4);
    const h = o.h || ri(rnd, 1, 2);
    const colors = o.colors || ri(rnd, 1, 3);
    let cells = [];
    for (let tries = 0; tries < 8; tries++) {
      cells = [];
      let usedCols = 0;
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) {
          const hz = rnd() < 0.3 ? 0 : ri(rnd, 1, h);
          if (hz > 0) usedCols++;
          const col = ri(rnd, 1, colors);
          for (let y = 0; y < hz; y++) cells.push({x, y, z, col});
        }
      }
      if (usedCols >= 2) break; // 至少两列非空, 单柱图纸太退化
    }
    if (cells.length < 2) { // 密度极端兜底: 对角两根单柱
      cells = [{x: 0, y: 0, z: 0, col: 1}, {x: w - 1, y: 0, z: d - 1, col: 1}];
    }
    return {cells, blueprint: projectTop(cells)};
  }

  /* ---------- 正视/侧视投影(US24 视角推理): 与俯视同族的正交投影 ---------- */

  /* 正视投影: 观察者在 -z 侧迎面看(x 向右 · y 向上), 每条 (x,y) 视线
      取最前(z 最小)可见块。返回 {w, h, front} — 行主序 y 行 × x 列
      (y 升序, 装配层画图时上下翻转), 0=空, 其余=颜色号;
      坐标归零到包围盒 → 视图是形状不是位置(与 projectTop 同口径)。 */
  function projectFront(cells) {
    if (!cells.length) return {w: 0, h: 0, front: []};
    let minX = Infinity; let maxX = -Infinity;
    let minY = Infinity; let maxY = -Infinity;
    const best = new Map(); // "x,y" → 该视线最前(z 最小)块
    for (const b of cells) {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.y > maxY) maxY = b.y;
      const k = b.x + ',' + b.y;
      const cur = best.get(k);
      if (!cur || b.z < cur.z) best.set(k, {x: b.x, y: b.y, z: b.z, col: b.col || 1});
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const front = new Array(w * h).fill(0);
    for (const v of best.values()) front[(v.y - minY) * w + (v.x - minX)] = v.col;
    return {w, h, front};
  }

  /* 侧视投影: 观察者在 -x 侧看(z 向右 · y 向上), 每条 (z,y) 视线取
      最前(x 最小)可见块。返回 {d, h, side} — 行主序 y 行 × z 列。 */
  function projectSide(cells) {
    if (!cells.length) return {d: 0, h: 0, side: []};
    let minZ = Infinity; let maxZ = -Infinity;
    let minY = Infinity; let maxY = -Infinity;
    const best = new Map(); // "z,y" → 该视线最前(x 最小)块
    for (const b of cells) {
      if (b.z < minZ) minZ = b.z;
      if (b.z > maxZ) maxZ = b.z;
      if (b.y < minY) minY = b.y;
      if (b.y > maxY) maxY = b.y;
      const k = b.z + ',' + b.y;
      const cur = best.get(k);
      if (!cur || b.x < cur.x) best.set(k, {x: b.x, y: b.y, z: b.z, col: b.col || 1});
    }
    const d = maxZ - minZ + 1;
    const h = maxY - minY + 1;
    const side = new Array(d * h).fill(0);
    for (const v of best.values()) side[(v.y - minY) * d + (v.z - minZ)] = v.col;
    return {d, h, side};
  }

  /* ---------- 双视角推理出题(US24 ★★): 正面看是山、侧面看是墙 ---------- */

  /* 出题: t = {seed, blocks, w, d, h, colors} — 生成 1 个目标结构(实心柱,
     与 mkBlueprintPuzzle 同口味, 尺寸随 blocks 预算封顶) + 3 个干扰候选
     (总数恰 4, LIMITS.chunks)。干扰的两个可证孪生构造:
     · 正视孪生 = 目标在最后方(z=maxZ+slot)加"尾巴"块 — 正视图必不变
       (尾巴 z 最大, 不是任何 (x,y) 视线的最前块, 全程被遮), 侧视图必变
       (深度 +slot 且新增占用列);
     · 侧视孪生 = 目标在最右方(x=maxX+slot)加"外伸"块 — 侧视图必不变
       (外伸块 x 最大, 不是任何 (z,y) 视线的最前块), 正视图必变(宽 +slot)。
     于是每个干扰恰与目标共享一个视图、必异于另一个 — 单看任一视图
     匹配数 >1(目标总与干扰共享视图), 双视图综合恰锁定目标(推理核心)。
     返回 {target, front, side, candidates, answer, box} — front/side 即
     谜面两视图(消费方直接画 2D 像素图, 同 blueprintPixels 口径),
     box 罩住全部候选(世界轨装场定界, 干扰比目标至多外扩 1 格)。 */
  function mkDualViewPuzzle(t) {
    const o = t || {};
    const rnd = RandCore.mkRand(o.seed);
    const blocks = o.blocks || 12;
    const hi = Math.min(4, Math.max(2, 2 + Math.floor(blocks / 15))); // 同 mkWorldBuild 口径
    const w = o.w || ri(rnd, 2, hi);
    const d = o.d || ri(rnd, 2, hi);
    const h = o.h || ri(rnd, 1, blocks >= 20 ? 2 : 1);
    const colors = o.colors || ri(rnd, 1, 3);
    let cells = [];
    for (let tries = 0; tries < 8; tries++) {
      cells = [];
      let used = 0;
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < w; x++) {
          const hz = rnd() < 0.3 ? 0 : ri(rnd, 1, h);
          if (hz > 0) used++;
          const col = ri(rnd, 1, colors);
          for (let y = 0; y < hz; y++) cells.push({x, y, z, col});
        }
      }
      if (used >= 2 && cells.length >= 4) break; // 谜面成图: ≥2 列且 ≥4 块
    }
    if (cells.length < 4) { // 密度极端兜底: 2×2 满铺一层
      cells = [{x: 0, y: 0, z: 0, col: 1}, {x: 1, y: 0, z: 0, col: 1},
        {x: 0, y: 0, z: 1, col: 1}, {x: 1, y: 0, z: 1, col: 1}];
    }
    const front = projectFront(cells);
    const side = projectSide(cells);
    let maxX = 0; let maxZ = 0;
    for (const c of cells) {
      if (c.x > maxX) maxX = c.x;
      if (c.z > maxZ) maxZ = c.z;
    }
    const groundXs = [...new Set(cells.filter((c) => c.y === 0).map((c) => c.x))];
    const groundZs = [...new Set(cells.filter((c) => c.y === 0).map((c) => c.z))];
    const cands = [{cells: cells.map((c) => Object.assign({}, c)), ok: true}];
    const seen = new Set([cells.map(keyOf).sort().join(';')]);
    /* 正视孪生: 尾巴加在 z=maxZ+slot(slot≥2 为互异兜底位), 偶尔两层尾 —
       第二层只在目标该 (x, ·) 线已有 y=1 块时加(否则会撑出新的视图行) */
    const frontTwin = (slot) => {
      const x = pick(rnd, groundXs);
      const tail = [{x, y: 0, z: maxZ + slot, col: ri(rnd, 1, colors)}];
      if (rnd() < 0.5 && cells.some((c) => c.x === x && c.y === 1)) {
        tail.push({x, y: 1, z: maxZ + slot, col: ri(rnd, 1, colors)});
      }
      return cells.concat(tail);
    };
    /* 侧视孪生: 外伸块加在 x=maxX+slot(第二层同理需目标已有 y=1 块) */
    const sideTwin = (slot) => {
      const z = pick(rnd, groundZs);
      const ext = [{x: maxX + slot, y: 0, z, col: ri(rnd, 1, colors)}];
      if (rnd() < 0.5 && cells.some((c) => c.z === z && c.y === 1)) {
        ext.push({x: maxX + slot, y: 1, z, col: ri(rnd, 1, colors)});
      }
      return cells.concat(ext);
    };
    const addTwin = (maker) => {
      for (let slot = 1; slot <= 2; slot++) {
        for (let tries = 0; tries < 8; tries++) {
          const twin = maker(slot);
          const sig = twin.map(keyOf).sort().join(';');
          if (seen.has(sig)) continue;
          seen.add(sig);
          cands.push({cells: twin, ok: false});
          return;
        }
      }
      // 兜底位仍撞形(理论上仅单列结构可达): 再退一格必互异
      const twin = maker(3);
      seen.add(twin.map(keyOf).sort().join(';'));
      cands.push({cells: twin, ok: false});
    };
    addTwin(frontTwin);
    addTwin(sideTwin);
    addTwin(rnd() < 0.5 ? frontTwin : sideTwin);
    const shuffled = RandCore.shuffle(rnd, cands);
    let bx0 = 0; let bx1 = maxX; let bz0 = 0; let bz1 = maxZ; let by1 = 0;
    for (const c of cands) {
      for (const b of c.cells) {
        if (b.x < bx0) bx0 = b.x;
        if (b.x > bx1) bx1 = b.x;
        if (b.z < bz0) bz0 = b.z;
        if (b.z > bz1) bz1 = b.z;
        if (b.y > by1) by1 = b.y;
      }
    }
    return {target: cells, front, side, candidates: shuffled,
      answer: shuffled.findIndex((c) => c.ok),
      box: {w: bx1 - bx0 + 1, d: bz1 - bz0 + 1, h: by1 + 1}};
  }

  /* ---------- 空间计数(E 族 ★★): 隐藏块与露面 — 纯邻接查询 ---------- */

  /* 隐藏块数 = 总块数 - 可见块数(工单口径): 六面全被别的块包住的块。
     "这座塔一共几块, 含藏起来的" — 答案的孩子侧拆解: 露出的能数,
     藏着的要靠推。cells 视为坐标集合(重复坐标按一份计)。 */
  const NEIGH6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  function hiddenBlocks(cells) {
    const s = new Set(cells.map(keyOf));
    let n = 0;
    for (const b of cells) {
      let sealed = true;
      for (const dxy of NEIGH6) {
        if (!s.has((b.x + dxy[0]) + ',' + (b.y + dxy[1]) + ',' + (b.z + dxy[2]))) {
          sealed = false;
          break;
        }
      }
      if (sealed) n++;
    }
    return n;
  }

  /* 露在外面(接触空气)的面数: 每块六邻缺一计一面 — 涂色外表面积题 */
  function exposedFaces(cells) {
    const s = new Set(cells.map(keyOf));
    let n = 0;
    for (const b of cells) {
      for (const dxy of NEIGH6) {
        if (!s.has((b.x + dxy[0]) + ',' + (b.y + dxy[1]) + ',' + (b.z + dxy[2]))) n++;
      }
    }
    return n;
  }

  /* ---------- 数列规律(C 族规律跳 / F 族): 等差与交替 ---------- */

  /* 出题: t = {seed, max, kind 'arith'|'alt'(缺省掷骰)}。
     等差展示 3 项 · 交替展示 4 项(≤4 组块红线), 各附下一项与规则描述键:
     'arith+d' 等差 · 'alt+p±q' 交替步(先 p 后 q 轮转, 负步即"加减交替")。
     步长对先行枚举再掷(结构性保证全部项落在 1..max, 第一学段无负数)。 */
  function mkSeqPuzzle(t) {
    const o = t || {};
    const max = o.max || 20;
    const rnd = RandCore.mkRand(o.seed);
    const dMax = Math.min(4, Math.floor((max - 1) / 3));
    if (dMax < 2) throw new Error('mkSeqPuzzle: max 至少 7(摆不下 3 项等差)');
    const kind = o.kind || (rnd() < 0.55 ? 'arith' : 'alt');
    if (kind === 'arith') {
      const d = ri(rnd, 2, dMax);
      const a = ri(rnd, 1, max - 3 * d);
      return {seq: [a, a + d, a + 2 * d], next: a + 3 * d, rule: 'arith+' + d};
    }
    /* 交替: 双正步(1,2,4,5 式爬坡)与负步(2,7,3,8 式锯齿)都合法。
       峰值偏移 = 全序列(含下一项)离首项的最大距离: 正步在末项 2(p+q),
       负步在中间第 4 项 2p+q(锯齿的峰不在末项!) — 首项上限按峰值算,
       结构性保证每一项都落在 1..max(第一学段无负数)。 */
    const pairs = [];
    for (let p = 1; p <= 4; p++) {
      for (let q = 1; q <= 4; q++) {
        if (p !== q && 2 * (p + q) <= max - 1) pairs.push([p, q, 2 * (p + q)]);
      }
    }
    for (let p = 3; p <= 5; p++) {
      for (let q = -(p - 1); q <= -1; q++) {
        if (p + q >= 1 && 2 * p + q <= max - 1) pairs.push([p, q, 2 * p + q]);
      }
    }
    const step = pick(rnd, pairs);
    const p = step[0]; const q = step[1];
    const a = ri(rnd, 1, max - step[2]);
    const seq = [a, a + p, a + p + q, a + 2 * p + q];
    return {seq, next: a + 2 * p + 2 * q, rule: 'alt+' + p + (q < 0 ? q : '+' + q)};
  }

  /* ---------- 周期问题(F ★★): 取模求解, 不许摆完靠规律推 ---------- */

  /* 纯查询: 单元序列无限循环的第 n 项(1 基) — index=(n-1)%周期长 */
  function periodAt(unit, n) {
    if (!Array.isArray(unit) || !unit.length) throw new Error('periodAt: unit 非空');
    if (!Number.isInteger(n) || n < 1) throw new Error('periodAt: n 从 1 起');
    const index = (n - 1) % unit.length;
    return {index, item: unit[index]};
  }

  /* 出题: t = {seed, max, unitLen 2..4}。单元用颜色号 1..3 且至少两种
     (全同不成周期); n 从 2*len+1 起到 max(先摆满整周期再问, 必须靠规律推)。
     answer = periodAt 结果, groups = 完整周期个数(话术"摆了 X 组还多 Y 个"用)。 */
  function mkPeriodPuzzle(t) {
    const o = t || {};
    const max = o.max || 20;
    const rnd = RandCore.mkRand(o.seed);
    const len = o.unitLen || ri(rnd, 2, 4);
    const nLo = 2 * len + 1;
    if (nLo > max) throw new Error('mkPeriodPuzzle: max 至少 ' + nLo);
    let unit = [];
    for (let tries = 0; tries < 8; tries++) {
      unit = [];
      for (let i = 0; i < len; i++) unit.push(ri(rnd, 1, 3));
      if (new Set(unit).size >= 2) break;
    }
    if (new Set(unit).size < 2) { // 全同兜底: 翻转末位颜色
      unit[len - 1] = unit[len - 1] === 1 ? 2 : 1;
    }
    const n = ri(rnd, nLo, max);
    return {unit, n, groups: Math.floor(n / len), answer: periodAt(unit, n)};
  }

  /* ---------- 多解枚举(B ★★ 有序思考): 合成 n 的不重不漏全枚举 ---------- */

  /* parts=2 → 数对 [a,b] a≤b · parts=3 → 三元组 [a,b,c] a≤b≤c。
     生成法: 首元素从小到大、次元素接着推 — 输出天然字典序升序,
     这本身就是"按顺序找、不漏不重"的示范(话术素材)。 */
  function partitionsOf(n, t) {
    const o = t || {};
    const parts = o.parts || 2;
    const min = o.min || 1;
    const out = [];
    if (parts === 2) {
      for (let a = min; a <= Math.floor(n / 2); a++) out.push([a, n - a]);
    } else if (parts === 3) {
      for (let a = min; a <= Math.floor(n / 3); a++) {
        for (let b = a; b <= Math.floor((n - a) / 2); b++) out.push([a, b, n - a - b]);
      }
    } else {
      throw new Error('partitionsOf: 只支持 parts 2 或 3');
    }
    return out;
  }

  /* 出题: t = {seed, max, parts}。数对 n 4..max(≥2 组解);
     三元组 n 6..min(max,12)(解个数上限可控 — 全找齐的认知负荷)。 */
  function mkPartitionPuzzle(t) {
    const o = t || {};
    const max = o.max || 20;
    const parts = o.parts || 2;
    const rnd = RandCore.mkRand(o.seed);
    const n = parts === 3 ? ri(rnd, 6, Math.min(max, 12)) : ri(rnd, 4, max);
    return {n, parts, solutions: partitionsOf(n, {parts})};
  }

  /* ---------- 天平代换链(B ★★ 等量代换): 2A=4B 型关系生成与求解 ---------- */

  /* t = {seed, max, chain}(chain 缺省 auto: 约 1/3 概率两跳链)。
     单步: "l 只 A = r 只 B"(r=l*k), 问 1 只或 m 只 A 换几只 B;
     两跳链: A→B→C, 问 1 只 A 换几只 C(连乘)。全程结构性保证
     r ≤ max 且答案整数(k 与连乘积都在带内取)。names 为抽象实体键,
     怪物皮肤由模式层按 key 映射。 */
  function mkScalePuzzle(t) {
    const o = t || {};
    const max = o.max || 20;
    const rnd = RandCore.mkRand(o.seed);
    const chain = o.chain === true || (o.chain !== false && rnd() < 0.35);
    const names = RandCore.shuffle(rnd, ['a', 'b', 'c']).slice(0, chain ? 3 : 2);
    const relations = [];
    let answer;
    let ask;
    if (chain) {
      const k1 = ri(rnd, 2, Math.min(4, Math.floor(Math.sqrt(max))));
      const k2 = ri(rnd, 2, Math.min(4, Math.floor(max / k1))); // k1*k2 ≤ max
      const l1 = ri(rnd, 2, 3); const l2 = ri(rnd, 2, 3);
      relations.push({from: names[0], to: names[1], left: l1, right: l1 * k1});
      relations.push({from: names[1], to: names[2], left: l2, right: l2 * k2});
      ask = {from: names[0], to: names[2], n: 1};
      answer = k1 * k2;
    } else {
      const k = ri(rnd, 2, Math.min(5, Math.floor(max / 3))); // l=3 时 r≤max
      const l = ri(rnd, 2, 3);
      relations.push({from: names[0], to: names[1], left: l, right: l * k});
      const n = ri(rnd, 1, Math.min(4, Math.floor(max / k)));
      ask = {from: names[0], to: names[1], n};
      answer = n * k;
    }
    return {names, relations, ask, answer, steps: relations.length};
  }

  /* ---------- 线索排队(F ★★): 3 实体 × 2~3 线索 → 唯一全序 ---------- */

  /* 求解器(也供判分复用): 线索做"大压小"关系图, 求传递闭包;
     每对实体恰一个方向可比才算唯一全序(都不可比=条件不足,
     都可比=矛盾), 返回键降序数组或 null。 */
  function solveClueOrder(keys, clues) {
    const beat = new Map(keys.map((k) => [k, new Set()]));
    for (const c of clues || []) {
      if (!beat.has(c.hi) || !beat.has(c.lo)) return null; // 未知实体(防御)
      beat.get(c.hi).add(c.lo);
    }
    for (let round = 0; round < keys.length; round++) {
      for (const k of keys) {
        const mine = beat.get(k);
        for (const lo of Array.from(mine)) {
          for (const deeper of beat.get(lo)) mine.add(deeper);
        }
      }
    }
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const ab = beat.get(keys[i]).has(keys[j]);
        const ba = beat.get(keys[j]).has(keys[i]);
        if (ab === ba) return null; // 不可比=不唯一; 双向=成环矛盾
      }
    }
    return keys.slice().sort((x, y) => beat.get(y).size - beat.get(x).size);
  }

  /* 出题: t = {seed, max, want?(意图线索条数)}。属性值取 1..min(max,10)
     中互异三值(高矮/轻重皮肤由模式层); 标准解=值降序; 线索取链式两条
     (唯一全序的最小组)。want=2 只出两条链线索(不出冗余); want≥3 补冗余
     跨位线索到 3 条; 缺省保持旧行为(约 1/3 概率加一条冗余, 难度微调)。
     want 条恒可解: 呈现任意子集/顺序都唯一全序(2026-10-29 P1 — 引擎按
     want 取线索, 不再洗牌后截断误伤链线索); 呈现序打乱。 */
  function mkClueOrderPuzzle(t) {
    const o = t || {};
    const max = o.max || 20;
    const rnd = RandCore.mkRand(o.seed);
    const hi = Math.min(max, 10);
    if (hi < 3) throw new Error('mkClueOrderPuzzle: max 至少 3');
    const vals = RandCore.shuffle(rnd, Array.from({length: hi}, (v, i) => i + 1)).slice(0, 3);
    const entities = ['a', 'b', 'c'].map((k, i) => ({key: k, value: vals[i]}));
    const order = entities.slice().sort((x, y) => y.value - x.value).map((e) => e.key);
    let clues = [{hi: order[0], lo: order[1]}, {hi: order[1], lo: order[2]}];
    /* 冗余线索按 want 出(2026-10-29 P1): 缺省保持旧行为(35% 概率加一条,
       整体任意子集仍可解); want=2 不出(want 条恒可解, 引擎截断不再误伤);
       want≥3 补齐到 3(链+冗余, 红线 ≤3) */
    if (o.want === undefined) {
      if (rnd() < 0.35) clues.push({hi: order[0], lo: order[2]});
    } else if (o.want >= 3) {
      clues.push({hi: order[0], lo: order[2]});
    }
    return {entities, clues: RandCore.shuffle(rnd, clues), solution: order};
  }

  /* ---------- 间隔问答(C ★★ 植树/爬楼问题的具身版) ---------- */

  /* t = {seed, max, mode 'both'|'neither'|'one'(缺省掷骰), a, b(教学关可显式)}。
     mode 口径: both 两端都算 b-a+1 · neither 两端都不算 b-a-1(中间经过)
     · one 只算一端 b-a。生成保证 b ≥ a+2("中间至少 1 格"),
     显式传参则尊重调用方(可出 0 格教学例)。 */
  function mkIntervalPuzzle(t) {
    const o = t || {};
    const max = o.max || 20;
    const rnd = RandCore.mkRand(o.seed);
    const mode = o.mode || pick(rnd, ['both', 'neither', 'one']);
    let a = o.a;
    let b = o.b;
    if (a === undefined || b === undefined) {
      a = ri(rnd, 1, max - 3);
      b = ri(rnd, a + 2, max);
    }
    if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b > a && b <= max)) {
      throw new Error('mkIntervalPuzzle: 需 1 ≤ a < b ≤ max');
    }
    const answer = mode === 'both' ? b - a + 1 : (mode === 'neither' ? b - a - 1 : b - a);
    return {a, b, mode, answer};
  }

  return {LIMITS, mirrorPattern, rot180Pattern, rotatePattern, translatePattern,
    mkSymmetryPuzzle, gradeSymmetry, projectTop, gradeBlueprint, mkBlueprintPuzzle,
    projectFront, projectSide, mkDualViewPuzzle,
    hiddenBlocks, exposedFaces, mkSeqPuzzle, periodAt, mkPeriodPuzzle,
    partitionsOf, mkPartitionPuzzle, mkScalePuzzle, mkClueOrderPuzzle, solveClueOrder,
    mkIntervalPuzzle};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PuzzleCore;
