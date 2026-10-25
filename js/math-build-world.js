'use strict';
/* ============================================================
   Math Build World (摆与搭世界引擎, 术语见 GLOSSARY.md「摆与搭世界
   引擎」「世界轨驱动器」) — 应用层·库(DOM/THREE 惰性, 世界轨驱动器
   js/math-track.js 的 mirror/plan 交互插件 — 指针锁宿主; hop 混合宿主
   插件在 js/math-world.js, 分发/生命周期/boss 串链由驱动器统一持有)
   ------------------------------------------------------------   一句话职责: 摆一摆(mirror)/搭一搭(plan)两族 10 个世界变体(G4 起
   "装场-点选-反馈"流程 — 每试次按 BuildWorldCore/PuzzleCore 的谜题
   数据装一个 ≤32×32 小场景(石英画布+玻璃标记+样品/候选/数字牌),
   瞄准射线点选放置/撤除(build.js 形态的关卡内临时放置)或点选
   候选牌, 判分全部委托 PuzzleCore(最省桥例外: 地形语义判分
   BuildWorldCore.bridgeGrade + bridgeOk 推理档口径, G4); 出题形状与候选生成在
   js/math-build-world-core.js(纯核心, 有单测), 本文件不造第二套判分。
   interface: runBuildWorld(section, h) → {stop(), onMouse(b,hit)}|null
     section = {family 'mirror'|'plan', variant, tier?, kind?, params, seed?}
     h = {progress(k,n)?, onTrial({ok,streak})?, end(st)} — 与
       runMathScreen 同契约, st 供 mathPassed/mathStars(单关口径);
       非 mirror/plan 变体返回 null(模式层走占位屏)
     · MATH_WORLD_FAMILIES(接管族清单, modes/math.js 分发用)
     · mathWorldHb(三色材料热栏, MathMode 经 mkMode 挂 digit/wheel)
   交互(纯鼠标/触屏, 无键盘依赖): 放置类右键/轻点=对准画布放置,
     ⛏️/左键=撤除自己摆的块(样品与场地不可拆), 发光石=「好啦」
     交卷(摆对自动过关, 交卷判错计一次试次); 选答类点数字牌/图纸牌。
   世界轨纪律(design §3): 进场装场 · 退出清场(经 stop/模式切换),
     不写建造存档; 图纸由 blueprintPixels 纯投影画 2D 像素图
     (不用引擎相机远拍)。
   依赖(均经全局名, 调用期解析): PuzzleCore(js/math-puzzles-core.js) ·
     BuildWorldCore(js/math-build-world-core.js) · MATH_META(js/math-levels.js) ·
     loadScene/setBlockRaw/getBlock/editBlock/collidesAtPlayer(js/world.js
     与 voxel.js) · SceneKit(js/scene-kit.js) · mkHotbar/mode-kit.js ·
     ModeKit.spawn · requestLock/setTouchActions/aimClick/touchPlaying
     (js/input.js) · SpeechKit/sfx · showToast/Fx(js/effects.js) ·
     mathPraiseLine/mathComfortLine/mathRoot(js/modes/math.js, 加载序
     在后的运行期话术与 DOM 屏根, math-paradigms 同款分层口径)
   可测性: THREE/DOM 惰性创建(HUD/热栏运行期才建), 判分与候选纯逻辑
     已下沉 math-build-world-core(有单测); 本文件由 boot 冒烟兜底
   ============================================================ */

/* ---------- 场地与材料常数 ---------- */
const MATH_WORLD_FAMILIES = new Set(['mirror', 'plan']);
const MATH_WORLD = {
  x0: 48, z0: 48, x1: 79, z1: 79, // 32×32 平台(世界 128×128 居中)
  groundY: 20, // 平台顶层(画布嵌在这层, 站立面 y=21)
  colBlock: {1: 16, 2: 15, 3: 19}, // 颜色号→方块: 红羊毛/蓝羊毛/灯块
  canvasBlock: 17, // 画布底(石英)
  markerBlock: 18, // 镜面线/轮廓/角框标记(玻璃, 嵌地面)
  pedestalBlock: 17, // 「好啦」基座(石英)
  checkBlock: 34, // 「好啦」确认块(发光岩)
  digitBlock: 16, // 数字牌笔划(红羊毛)
  boardBlock: 17, // 候选牌底板(石英)
  askS: '摆好啦，就敲一下发光石！',
};
const MATH_WORLD_COLS = [1, 2, 3]; // 热栏序 = 颜色号序

/* 三色材料热栏(放置类试次亮出; MathMode 经 mkMode 挂 digit/wheel/点选) */
const mathWorldHb = mkHotbar({items: MATH_WORLD_COLS.map((c) => ({block: MATH_WORLD.colBlock[c]}))});

/* ---------- 小工具(ww 前缀避开共享词法环境的既有全局) ---------- */

function wwSfx(name) {
  if (typeof sfx === 'function') sfx(name);
}
function wwSpeak(s) {
  if (typeof SpeechKit !== 'undefined' && SpeechKit) SpeechKit.speak(s);
}
function wwPraise(ok) {
  if (ok && typeof mathPraiseLine === 'function') wwSpeak(mathPraiseLine());
  if (!ok && typeof mathComfortLine === 'function') wwSpeak(mathComfortLine());
}
/* 计时器收口: stop 一次清空(mTimers 同构的独立副本) */
function wwTimers() {
  const ts = [];
  return {
    after(ms, fn) {
      const id = setTimeout(() => {
        const k = ts.indexOf(id);
        if (k >= 0) ts.splice(k, 1);
        fn();
      }, ms);
      ts.push(id);
      return id;
    },
    stop() {
      ts.forEach((id) => clearTimeout(id));
      ts.length = 0;
    },
  };
}
const wwKey = (x, y, z) => x + ',' + y + ',' + z;

/* ---------- 世界 HUD(任务卡 + 图纸覆层, pointer-events:none) ---------- */

let wwHud = null; let wwTitleEl = null; let wwSubEl = null;
let wwProgEl = null; let wwCanvas = null;
function wwEnsureHud() {
  if (wwHud) return;
  wwHud = document.createElement('div');
  wwHud.id = 'mathWorldHud';
  const card = document.createElement('div');
  card.className = 'mw-card';
  wwTitleEl = document.createElement('div');
  wwTitleEl.className = 'mw-title';
  wwSubEl = document.createElement('div');
  wwSubEl.className = 'mw-sub';
  wwProgEl = document.createElement('div');
  wwProgEl.className = 'mw-progress';
  const fill = document.createElement('i');
  wwProgEl.appendChild(fill);
  wwCanvas = document.createElement('canvas');
  wwCanvas.className = 'mw-blueprint';
  card.appendChild(wwTitleEl);
  card.appendChild(wwSubEl);
  card.appendChild(wwProgEl);
  card.appendChild(wwCanvas);
  wwHud.appendChild(card);
  document.body.appendChild(wwHud);
}
function wwHudShow(title, sub, withBlueprint) {
  wwEnsureHud();
  wwTitleEl.innerHTML = title;
  wwSubEl.textContent = sub || '';
  wwCanvas.style.display = withBlueprint ? 'block' : 'none';
  wwHud.style.display = 'block';
}
function wwHudProgress(k, n) {
  if (wwProgEl && wwProgEl.firstChild) {
    wwProgEl.firstChild.style.width = Math.round(k / Math.max(1, n) * 100) + '%';
  }
}
/* 图纸 = blueprintPixels 纯投影的 2D 像素图(design §3 不拍照) */
function wwPaintBlueprint(bp) {
  if (!wwCanvas) return;
  const px = BuildWorldCore.blueprintPixels(bp);
  const s = 26;
  wwCanvas.width = bp.w * s;
  wwCanvas.height = bp.d * s;
  const ctx = wwCanvas.getContext('2d');
  for (let z = 0; z < px.length; z++) {
    for (let x = 0; x < px[z].length; x++) {
      ctx.fillStyle = px[z][x] || '#2f353d';
      ctx.fillRect(x * s, z * s, s - 2, s - 2);
    }
  }
}

/* ---------- 装场地基(平台 + 居中石英画布) ---------- */

/* 平台(泥土+草地) + w×d 石英画布(外扩一圈), 返回画布原点 */
function wwStage(w, d) {
  const W = MATH_WORLD;
  SceneKit.fill(W.x0, W.groundY - 3, W.z0, W.x1, W.groundY - 1, W.z1, 2);
  SceneKit.fill(W.x0, W.groundY, W.z0, W.x1, W.groundY, W.z1, 1);
  const x0 = 64 - Math.floor(w / 2);
  const z0 = 64 - Math.floor(d / 2);
  SceneKit.fill(x0 - 1, W.groundY, z0 - 1, x0 + w, W.groundY, z0 + d, W.canvasBlock);
  return {x0, z0};
}
/* 细胞(局部坐标) → 世界方块(y 基面 = groundY+1) */
function wwCellsToWorld(cells, x0, z0, y0) {
  for (const c of cells) {
    setBlockRaw(x0 + c.x, y0 + c.y, z0 + c.z, MATH_WORLD.colBlock[c.col || 1]);
  }
}
/* 「好啦」确认块: 画布南缘外的石英基座 + 发光岩(点击交卷) */
function wwCheckBlock(x0, z0, w, d) {
  const W = MATH_WORLD;
  const cx = x0 + Math.floor(w / 2);
  const cz = z0 + d + 2;
  setBlockRaw(cx, W.groundY + 1, cz, W.pedestalBlock);
  setBlockRaw(cx, W.groundY + 2, cz, W.checkBlock);
  return {x: cx, y: W.groundY + 2, z: cz};
}
/* 候选牌(图纸牌/数字牌共用): 宽度超 28(平台一行放不下)自动折两行;
   slots = [{w, d, value?, draw(bx,bz)}] — value = 数字牌的数值(判分
   比较值), 图纸牌缺省按下标判分 */
function wwBoardRow(slots, zLine) {
  const W = MATH_WORLD;
  const gap = 2;
  const rowMax = 28;
  const rows = [[]];
  let rowW = 0;
  for (const s of slots) {
    const wSlot = s.w + 2;
    if (rows[rows.length - 1].length && rowW + gap + wSlot > rowMax) {
      rows.push([]);
      rowW = 0;
    }
    if (rowW) rowW += gap;
    rows[rows.length - 1].push(s);
    rowW += wSlot;
  }
  const boards = [];
  rows.forEach((row, r) => {
    const line = zLine + (rows.length > 1 ? (r === 0 ? -4 : 4) : 0);
    const total = row.reduce((a, s) => a + s.w + 2, 0) + gap * (row.length - 1);
    let bx = 64 - Math.floor(total / 2);
    for (const s of row) {
      const i = boards.length;
      const x0 = bx; const z0 = line - Math.floor(s.d / 2);
      SceneKit.fill(x0 - 1, W.groundY + 1, z0 - 1, x0 + s.w, W.groundY + 1, z0 + s.d, W.boardBlock);
      s.draw(x0, z0);
      boards.push({x0: x0 - 1, z0: z0 - 1, x1: x0 + s.w, z1: z0 + s.d, idx: i, value: s.value});
      bx += s.w + 2 + gap;
    }
  });
  return boards;
}

/* ---------- 变体表: 出题 · 装场 · 话术 ---------- */

const MATH_WORLD_VARIANTS = {
  /* ---- D 摆一摆 ---- */
  'mirror/reflect': {
    make(sec, seed) {
      const q = BuildWorldCore.mathWorldSymParams({seed, span: sec.params.span,
        layerRate: sec.params.layerRate});
      const axis = ['x', 'z'][seed % 2];
      return {pz: PuzzleCore.mkSymmetryPuzzle(Object.assign({seed, axis}, q)),
        axisLine: axis};
    },
    build(t) {
      const p = t.pz; const W = MATH_WORLD;
      /* 镜面独占画布正中一列(mirrorStage): 样品与摆放区紧贴镜子两侧
         严格对称 — 镜子不占镜像区的格子, 孩子直觉摆位与判分一致 */
      const st = BuildWorldCore.mirrorStage(p, t.axisLine);
      const {x0, z0} = wwStage(st.w, st.d);
      wwCellsToWorld(p.half, x0, z0, W.groundY + 1);
      const Y = W.groundY;
      const laneX = st.laneX === null ? null : x0 + st.laneX;
      const laneZ = st.laneZ === null ? null : z0 + st.laneZ;
      if (laneX !== null) { // 镜面线: 专属空列嵌地面
        SceneKit.fill(laneX, Y, z0 - 1, laneX, Y, z0 + st.d, W.markerBlock);
      }
      if (laneZ !== null) {
        SceneKit.fill(x0 - 1, Y, laneZ, x0 + st.w, Y, laneZ, W.markerBlock);
      }
      return {mode: 'place', pz: p, x0, z0, w: st.w, d: st.d, h: p.box.h,
        ax: st.ax, az: st.az, // 判分偏移: 孩子摆的世界块平移回谜题局部系
        canPlace(tx, ty, tz) { // 建造区 = 画布内且不在镜面列(canPlace 替代默认边界)
          if (tx < x0 || tx >= x0 + st.w || tz < z0 || tz >= z0 + st.d ||
              ty <= W.groundY || ty > W.groundY + p.box.h) return false;
          return tx !== laneX && tz !== laneZ;
        },
        placeHint: '要摆在魔法镜的另一边哦'};
    },
    speak() {
      return '魔法镜照一照，把另一边摆得一模一样！' + MATH_WORLD.askS;
    },
  },
  'mirror/rotate': {
    make(sec, seed) {
      const q = BuildWorldCore.mathWorldSymParams({seed, span: sec.params.span,
        layerRate: sec.params.layerRate});
      return {pz: PuzzleCore.mkSymmetryPuzzle(Object.assign({seed, axis: 'c'}, q))};
    },
    build(t) {
      const p = t.pz; const {x0, z0} = wwStage(p.box.w, p.box.d);
      wwCellsToWorld(p.half, x0, z0, MATH_WORLD.groundY + 1);
      const cx = x0 + (p.k + 1) / 2 - 1; const cz = z0 + (p.kz + 1) / 2 - 1; // 中心 2×2 标记
      SceneKit.fill(cx, MATH_WORLD.groundY, cz, cx + 1, MATH_WORLD.groundY, cz + 1, MATH_WORLD.markerBlock);
      return {mode: 'place', pz: p, x0, z0, w: p.box.w, d: p.box.d, h: p.box.h};
    },
    speak() {
      return '小图案围着中心转半圈，把对角也摆出来！' + MATH_WORLD.askS;
    },
  },
  'mirror/translate': {
    make(sec, seed) {
      return {pz: BuildWorldCore.mkWorldTranslate({seed, span: sec.params.span,
        layerRate: sec.params.layerRate})};
    },
    build(t) {
      const p = t.pz; const {x0, z0} = wwStage(p.box.w, p.box.d);
      wwCellsToWorld(p.sample, x0, z0, MATH_WORLD.groundY + 1);
      /* 目标区四角玻璃角框(定区域不给逐格答案) */
      const Y = MATH_WORLD.groundY;
      const tgt = p.solution.filter((c) => !p.sample.some((s) =>
        wwKey(s.x, s.y, s.z) === wwKey(c.x, c.y, c.z)));
      const tb = BuildWorldCore.boundsOf(tgt);
      for (const [gx, gz] of [[tb.x0 - 1, tb.z0 - 1], [tb.x0 + tb.w, tb.z0 - 1],
        [tb.x0 - 1, tb.z0 + tb.d], [tb.x0 + tb.w, tb.z0 + tb.d]]) {
        setBlockRaw(x0 + gx, Y, z0 + gz, MATH_WORLD.markerBlock);
      }
      return {mode: 'place', pz: p, x0, z0, w: p.box.w, d: p.box.d, h: p.box.h};
    },
    speak(p) {
      return '照着图案的样子，往右搬一份，摆进玻璃角框里！' + MATH_WORLD.askS;
    },
  },
  'mirror/tangram': {
    make(sec, seed) {
      return {pz: BuildWorldCore.mkWorldTangram({seed, span: sec.params.span})};
    },
    build(t) {
      const p = t.pz; const {x0, z0} = wwStage(p.box.w, p.box.d);
      for (const c of p.target) { // 玻璃格 = 要盖住的目标(画布内缩 1 格锚定)
        setBlockRaw(x0 + 1 + c.x, MATH_WORLD.groundY, z0 + 1 + c.z, MATH_WORLD.markerBlock);
      }
      /* 判分锚点 = 标记原点(画布内缩 1), 摆放界 = 整张画布(白格多摆
         即错 — "恰好拼出"的纪律), 两套坐标经 ax/az 解耦 */
      return {mode: 'place', pz: p, x0, z0, w: p.box.w, d: p.box.d, h: p.box.h,
        ax: 1, az: 1};
    },
    speak() {
      return '用积木把玻璃格子全部盖住，不多也不少！' + MATH_WORLD.askS;
    },
  },
  /* ---- E 搭一搭 ---- */
  'plan/build': {
    make(sec, seed) {
      return {pz: BuildWorldCore.mkWorldBuild({seed, blocks: sec.params.blocks})};
    },
    build(t) {
      const p = t.pz; const {x0, z0} = wwStage(p.box.w, p.box.d);
      return {mode: 'place', pz: p, x0, z0, w: p.box.w, d: p.box.d, h: p.box.h,
        blueprint: true, gradeBlueprint: true};
    },
    speak() {
      return '看着上面的图纸，把一样颜色的房顶摆出来！' + MATH_WORLD.askS;
    },
  },
  'plan/pick': {
    make(sec, seed) {
      return {pz: BuildWorldCore.mkWorldPick({seed, blocks: sec.params.blocks})};
    },
    build(t) {
      const p = t.pz;
      const {x0, z0} = wwStage(24, 20);
      const sb = BuildWorldCore.boundsOf(p.cells);
      wwCellsToWorld(p.cells, x0 + 12 - Math.floor(sb.w / 2) - sb.x0,
          z0 + 4 - sb.z0, MATH_WORLD.groundY + 1);
      const boards = wwBoardRow(p.candidates.map((c) => ({
        w: c.w, d: c.d,
        draw(bx, bz) {
          for (let i = 0; i < c.top.length; i++) {
            if (c.top[i] > 0) {
              setBlockRaw(bx + i % c.w, MATH_WORLD.groundY + 2, bz + Math.floor(i / c.w),
                  MATH_WORLD.colBlock[c.top[i]]);
            }
          }
        },
      })), z0 + 16);
      return {mode: 'choice', pz: p, x0, z0, w: 24, d: 20, boards};
    },
    speak() {
      return '看一看这座建筑，从下面的图纸里，点出从上往下看的样子！';
    },
  },
  'plan/hidden': {
    make(sec, seed) {
      return {pz: BuildWorldCore.mkWorldHidden({seed, blocks: sec.params.blocks,
        max: sec.params.max})};
    },
    build: wwBuildCountScene,
    speak() {
      return '这座建筑藏着几块看不见的方块？露在外面的能数，藏着的要靠想！点出数字！';
    },
  },
  'plan/countall': {
    make(sec, seed) {
      return {pz: BuildWorldCore.mkWorldCount({seed, blocks: sec.params.blocks,
        max: sec.params.max, reasoning: sec.params.reasoning})};
    },
    build: wwBuildCountScene,
    speak(p) {
      return p.mode === 'faces' ?
        '这座建筑露在外面几个面？点出数字！' :
        '这座建筑一共有几块方块？藏起来的也要数进去！点出数字！';
    },
  },
  /* ---- G4 新变体: 双视角推理(点选) / 最省桥(放置) ---- */
  'plan/dualview': {
    make(sec, seed) {
      return {pz: BuildWorldCore.mkWorldDualView({seed, blocks: sec.params.blocks,
        cands: sec.params.dualCands, views: sec.params.dualViews})};
    },
    build(t) {
      const p = t.pz; const W = MATH_WORLD;
      const {x0, z0} = wwStage(26, 22);
      /* 候选建筑北侧一排(间隔 2, 各坐石英底板=点选判定区):
         底板嵌地面层, 点建筑本体任意块即选中该座 */
      const boxes = p.candidates.map((c) => BuildWorldCore.boundsOf(c.cells));
      const totalW = boxes.reduce((a, b) => a + b.w, 0) + 2 * (p.candidates.length - 1);
      let bx = 64 - Math.floor(totalW / 2);
      const boards = [];
      p.candidates.forEach((c, k) => {
        const b = boxes[k];
        wwCellsToWorld(c.cells, bx - b.x0, z0 + 3 - b.z0, W.groundY + 1);
        SceneKit.fill(bx - 1, W.groundY, z0 + 2, bx + b.w, W.groundY, z0 + 3 + b.d,
            W.boardBlock);
        boards.push({x0: bx - 1, z0: z0 + 2, x1: bx + b.w, z1: z0 + 3 + b.d, idx: k});
        bx += b.w + 2;
      });
      /* 投影牌: 立式像素图(行 0 在底, blueprintPixels 同色表), 正/侧并排
         立在南侧 — 牌与建筑同侧同视角, 谜面列序与建筑 x 序一致 */
      const cards = [{w: p.front.w, h: p.front.h, top: p.front.front}];
      if (p.views === 2) cards.push({w: p.side.d, h: p.side.h, top: p.side.side});
      const tw = cards.reduce((a, c) => a + c.w, 0) + 4 * (cards.length - 1);
      let cx = 64 - Math.floor(tw / 2);
      for (const cd of cards) {
        for (let r = 0; r < cd.h; r++) {
          for (let col = 0; col < cd.w; col++) {
            const v = cd.top[r * cd.w + col] || 0;
            if (v) setBlockRaw(cx + col, W.groundY + 1 + r, z0 + 14, W.colBlock[v]);
          }
        }
        cx += cd.w + 4;
      }
      return {mode: 'choice', pz: p, x0, z0, w: 26, d: 22, boards};
    },
    speak(p) {
      return p.views === 2 ?
        '正面看是山，侧面看是墙！两块图纸都一样的只有一座，点那座房子！' :
        '看一看图纸，再看看每座房子——正面和图纸一样的就是它，点出来！';
    },
  },
  'mirror/bridge': {
    make(sec, seed) {
      /* span(mirror 数值轴)驱动跨度; 预算牌 N = par + budget(变体曲线:
         reverse 档宽松 +3, multi-solve 档收紧到 par) */
      const pz = BuildWorldCore.mkBridgePuzzle({seed, blocks: sec.params.span,
        max: sec.params.max});
      return {pz, budgetN: pz.plan.par + (sec.params.budget || 0),
        reasoning: sec.params.reasoning};
    },
    build(t) {
      const p = t.pz; const W = MATH_WORLD;
      const plan = p.plan;
      const {x0, z0} = wwStage(plan.span + 8, 9);
      /* 桥轴局部坐标 → 世界: 局部 x 0..span+1(两岸柱列), y 0=河床面,
         z=zLane(0) — placed 坐标直接喂 bridgeGrade(同平面) */
      const xB0 = 64 - Math.floor((plan.span + 2) / 2);
      const zW = 64; // 桥线世界列(画布 9 深, 64 为中线)
      const Y = W.groundY;
      /* 河面: 空隙列(局部 1..span)×z ±1 挖去草皮露泥土(3 格宽的河) */
      for (let x = 1; x <= plan.span; x++) {
        for (let dz = -1; dz <= 1; dz++) {
          setBlockRaw(xB0 + x, Y, zW + dz, 0);
        }
      }
      /* 两岸柱+墩 = 地形(石英, 不可拆): 块占局部 y 0..顶-1, 站面=顶 */
      const col = (wx, h) => {
        for (let y = 0; y < h; y++) setBlockRaw(wx, Y + y, zW, W.canvasBlock);
      };
      col(xB0, plan.yL);
      col(xB0 + plan.span + 1, plan.yR);
      for (const pi of plan.piers) col(xB0 + pi.x, pi.top);
      /* 预算牌: 「只用 N 块」数字点阵(多位逐位, 判定无关的展示牌) */
      const ds = String(t.budgetN).split('').map(Number);
      let nbx = 64 - Math.floor((ds.length * 3 + (ds.length - 1)) / 2);
      for (let i = 0; i < ds.length; i++) {
        for (const [dx, dy] of BuildWorldCore.digitCells(ds[i])) {
          setBlockRaw(nbx + i * 4 + dx, Y + 1 + dy, zW + 6, W.digitBlock);
        }
      }
      return {mode: 'place', pz: p, x0, z0, w: plan.span + 8, d: 9,
        h: plan.capY + 1, budgetN: t.budgetN, reasoning: t.reasoning,
        /* 建造区 = 河面桥线(局部 x 1..span · z=zLane · y 0..capY) */
        canPlace(tx, ty, tz) {
          return tx >= xB0 + 1 && tx <= xB0 + plan.span && tz === zW &&
              ty >= Y && ty <= Y + plan.capY;
        },
        placeHint: '要搭在河面的桥线上哦',
        /* 判分 = bridgeGrade 三判据 + bridgeOk 推理档口径(先能过后最省) */
        gradeCells(cells) {
          return BuildWorldCore.bridgeOk(
              BuildWorldCore.bridgeGrade(cells, plan), t.reasoning);
        }};
    },
    speak(p, t) {
      return t && t.reasoning === 'multi-solve' ?
        '用最少的积木搭一座能走通的桥！最多' + (t.budgetN || 0) + '块，搭好敲发光石！' :
        '小河挡住路啦！搭一座桥，从这边走到那边！搭好就敲发光石！';
    },
  },
};

/* 隐藏块/数方块共用装场: 北侧建筑 + 南侧 4 张数字牌 */
function wwBuildCountScene(t) {
  const p = t.pz;
  const {x0, z0} = wwStage(24, 20);
  const sb = BuildWorldCore.boundsOf(p.cells);
  wwCellsToWorld(p.cells, x0 + 12 - Math.floor(sb.w / 2) - sb.x0,
      z0 + 4 - sb.z0, MATH_WORLD.groundY + 1);
  const boards = wwBoardRow(p.cands.map((v) => {
    const ds = String(v).split('').map(Number); // 多位数 = 逐位拼牌(个十百, 位间 1 格)
    return {
      w: ds.length * 3 + (ds.length - 1), d: 5, value: v,
      draw(bx, bz) {
        ds.forEach((d, i) => {
          for (const [dx, dy] of BuildWorldCore.digitCells(d)) {
            setBlockRaw(bx + i * 4 + dx, MATH_WORLD.groundY + 2, bz + dy, MATH_WORLD.digitBlock);
          }
        });
      },
    };
  }), z0 + 16);
  return {mode: 'choice', pz: p, x0, z0, w: 24, d: 20, boards};
}

/* ---------- 主入口: 世界轨试次驱动器 ---------- */

function runBuildWorld(section, h) {
  if (!section || !MATH_WORLD_FAMILIES.has(section.family)) return null;
  const spec = MATH_WORLD_VARIANTS[section.family + '/' + section.variant];
  if (!spec) return null;
  const p = section.params || {};
  const n = MathTrackCore.clampTrials(p.trials);
  const hh = h || {};
  const T = wwTimers();
  const loop = MathTrackCore.mkTrialLoop(); /* 试次循环骨架(T3 并一): 记分与节拍决策在纯核心 */
  const stats = loop.stats;
  let idx = 0;
  let settled = false;
  let stopped = false;
  let trial = null; // 当前试次现场(build 返回值)
  let hintT = 0; // 拆不动/放不进提示节流

  const titleHtml = '<span class="mw-ico">' + (MATH_META[section.family] ?
      MATH_META[section.family].icon : '') + '</span>' +
      (typeof mathVariantName === 'function' ?
          mathVariantName(section.family, section.variant) : section.variant);

  function hint(msg) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - hintT < 1200) return;
    hintT = now;
    showToast(msg);
  }

  function settle(ok) {
    if (settled || stopped) return;
    settled = true;
    const ev = loop.settle(ok); /* 记分+节拍决策(表扬/安慰口径唯一在核心) */
    wwSfx(ev.ok ? 'pick' : 'click');
    if (trial) { // 世界内视觉反馈: 对=画布绿环, 错=红闪
      const W = MATH_WORLD;
      if (typeof Fx !== 'undefined' && Fx && Fx.pop) {
        Fx.pop(trial.x0 + trial.w / 2 + 0.5, W.groundY + 2, trial.z0 + trial.d / 2 + 0.5,
            {color: ev.ok ? 0x7cfc00 : 0xd1483a, r0: 0.8, r1: 4.5, dur: 0.5});
      }
    }
    if (hh.onTrial) hh.onTrial({ok: ev.ok, streak: ev.streak});
    if (ev.praise) wwPraise(true); /* 过程性表扬(同屏流口径) */
    if (ev.comfort) wwPraise(false);
    T.after(1000, next);
  }

  /* 放置类判分: 交卷或每次增删后自动对答案(摆对即时过关)。
     gradeCells = build 返回的自定义判分器(最省桥: bridgeGrade+bridgeOk,
     G4) — 缺省走图纸/对称判分(PuzzleCore 单一出口) */
  function gradeWith(cells) {
    if (trial.gradeCells) return trial.gradeCells(cells);
    return trial.gradeBlueprint ?
      PuzzleCore.gradeBlueprint(cells, trial.pz.blueprint) :
      PuzzleCore.gradeSymmetry(cells, trial.pz);
  }
  function gradeNow(cells) {
    settle(gradeWith(cells));
  }
  function childCells() {
    const out = [];
    trial.placed.forEach((c) => out.push(c));
    return out;
  }

  function next() {
    if (stopped) return;
    if (idx >= n) {
      loop.end();
      if (hh.end) hh.end(stats);
      return;
    }
    if (hh.progress) hh.progress(idx, n);
    settled = false;
    const seed = (section.seed === undefined ? 0 : section.seed) * 31 + idx * 101 + 7;
    const made = spec.make(section, seed);
    /* 装场 seam: 清场 → 建场 → 收尾入队一步到位(退出/换关清场幂等,
       不写建造存档 — 世界轨纪律 design §3) */
    let built = null;
    loadScene(() => {
      built = spec.build(made);
    });
    trial = built;
    trial.placed = new Map();
    trial.check = null;
    /* 出生: 画布南缘后撤, 正对谜面(准星即所操作, 无键盘也能全场点到) */
    if (trial.mode === 'place') {
      ModeKit.spawn(64.5, MATH_WORLD.groundY + 1, trial.z0 + trial.d + 5,
          {yaw: 0, pitch: -0.55});
      trial.check = wwCheckBlock(trial.x0, trial.z0, trial.w, trial.d);
      mathWorldHb.show();
      if (typeof setTouchActions === 'function') {
        setTouchActions([{icon: 'pick', label: '撤除', holdAct() {
          if (typeof aimClick === 'function') aimClick(0);
        }}]);
      }
    } else {
      /* 出生在牌阵正南(贴最近一张牌, 远排走两步即到; 判分点击无键盘依赖) */
      let zSpawn = trial.z0 + trial.d + 2;
      for (const b of trial.boards || []) zSpawn = Math.max(zSpawn, b.z1 + 2);
      ModeKit.spawn(64.5, MATH_WORLD.groundY + 1, zSpawn, {yaw: 0, pitch: -0.4});
      mathWorldHb.hide();
      if (typeof setTouchActions === 'function') setTouchActions([]);
    }
    if (typeof mathRoot !== 'undefined' && mathRoot) mathRoot.style.display = 'none'; // 本引擎自带 HUD
    wwHudShow(titleHtml, (idx + 1) + ' / ' + n, !!trial.blueprint);
    wwHudProgress(idx, n);
    if (trial.blueprint) wwPaintBlueprint(trial.pz.blueprint);
    wwSpeak(spec.speak(trial.pz, trial));
    idx++;
  }

  /* ---------- 点选路由(瞄准射线 hit 由模式层喂入) ---------- */

  function onMouse(button, hit) {
    if (!trial || settled || stopped || !hit) return;
    if (trial.mode === 'choice') {
      for (const b of trial.boards) {
        if (hit.x >= b.x0 && hit.x <= b.x1 && hit.z >= b.z0 && hit.z <= b.z1 &&
            hit.y > MATH_WORLD.groundY && hit.y <= MATH_WORLD.groundY + 2) {
          /* 数字牌判值(answer 是数值), 图纸牌判下标(answer 是下标) */
          settle(b.value !== undefined ? b.value === trial.pz.answer : b.idx === trial.pz.answer);
          return;
        }
      }
      hint('点下面的牌子回答哦');
      return;
    }
    /* 放置类: 发光石=交卷 */
    if (trial.check && hit.x === trial.check.x && hit.y === trial.check.y &&
        hit.z === trial.check.z) {
      gradeNow(childCells());
      return;
    }
    const W = MATH_WORLD;
    if (button === 0) { // 撤除(只拆自己摆的; 样品/场地/基座不动)
      const k = wwKey(hit.x, hit.y, hit.z);
      if (trial.placed.has(k)) {
        trial.placed.delete(k);
        editBlock(hit.x, hit.y, hit.z, 0);
        autoGrade();
      } else {
        hint('这块不能拿走哦');
      }
      return;
    }
    if (button === 2) { // 放置(画布内空格, 不与玩家重叠)
      const tx = hit.x + hit.nx; const ty = hit.y + hit.ny; const tz = hit.z + hit.nz;
      if (trial.canPlace) { // 自定义建造区(最省桥: 河面桥线, G4)
        if (!trial.canPlace(tx, ty, tz)) {
          hint(trial.placeHint || '这里不能放哦');
          return;
        }
      } else if (tx < trial.x0 || tx >= trial.x0 + trial.w || tz < trial.z0 ||
          tz >= trial.z0 + trial.d || ty <= W.groundY || ty > W.groundY + trial.h) {
        hint('要摆在白色画布里哦');
        return;
      }
      if (getBlock(tx, ty, tz) !== 0) return;
      if (collidesAtPlayer(tx, ty, tz)) return;
      const col = MATH_WORLD_COLS[Math.min(MATH_WORLD_COLS.length - 1, mathWorldHb.sel)];
      trial.placed.set(wwKey(tx, ty, tz), {
        x: tx - trial.x0 - (trial.ax || 0),
        y: ty - (W.groundY + 1),
        z: tz - trial.z0 - (trial.az || 0),
        col});
      editBlock(tx, ty, tz, W.colBlock[col]);
      autoGrade();
    }
  }

  /* 摆对即时过关(少一步交卷, 儿童正反馈前置); 最省桥同理 — 放完最后
     一块即达标的桥自动过关(reverse 档=能走通, multi-solve 档=最省) */
  function autoGrade() {
    if (settled || stopped) return;
    if (gradeWith(childCells())) settle(true);
  }

  next();
  if (typeof requestLock === 'function') requestLock(); // 进场即锁指针/触屏进行态
  return {
    stop() {
      if (stopped) return; // 幂等(hop teardown 同款): 重复 stop 不再收尾
      stopped = true;
      T.stop();
      trial = null;
      mathWorldHb.hide();
      if (typeof setTouchActions === 'function') setTouchActions(null);
      if (wwHud) wwHud.style.display = 'none';
      if (typeof mathRoot !== 'undefined' && mathRoot) mathRoot.style.display = 'block'; // 复明 DOM 屏
      clearWorld(); // 场景装填纪律: 退出清场(幂等, 不写建造存档) — T1 缺陷修复, hop teardown 同款
    },
    onMouse,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {runBuildWorld, MATH_WORLD_FAMILIES};
}
