'use strict';
/* ============================================================
   Robot Commander Core (怪物指挥官指令模拟器, 术语见 GLOSSARY.md) — 引擎无关纯核心
   ------------------------------------------------------------
   一句话职责: 棋盘谜题的确定性生成与指令模拟——mkBoard 种子出题(先生成
   可解路径再落障碍, 生成即可解: 直路盘走目标偏置游走、转向盘(turnsMin>0)
   走路点走廊, 收盘三闸=预算 parCap/教学 S 承重/形状 sol 转向数) ·
   stepSim 单卡纯步进(状态进/意图出) ·
   parSolution BFS 最短指令序列(演示模式与三星 par 同一权威); 回放的动画
   表现归 robot-world(T4), 本文件只算数、不碰 THREE/DOM。
   interface: DIRS · CELL · CARDS · SKILLS · mkBoard(seed, opts) ·
     mkSim(board) · stepSim(board, sim, card) · simulate(board, cards) ·
     parSolution(board) · parOf(board)
   依赖(均经全局名, 调用期解析): RandCore(js/rand-core.js, mkRand/seedAt/
     shuffle — 确定性出题; 浏览器加载序在前, Node 测试先挂 global)
   可测性: 零 THREE·零 DOM·零全局可变依赖, 有同名单测 test/robot-core.test.js
   ============================================================ */

/* 格类型(cells 数组元素; 越界判定用 OOB 哨兵, 不入 cells) */
const CELL = {GROUND: 0, SOFT: 1, HARD: 2, WATER: 3, GOAL: 4, LEDGE: 5, OOB: 9};
/* 朝向: 按东南西北顺时针(屏幕坐标 z 向南) —— E=0, 左转=(dir+3)%4 恰是北 */
const DIRS = [{dx: 1, dz: 0}, {dx: 0, dz: 1}, {dx: -1, dz: 0}, {dx: 0, dz: -1}];
/* 指令卡: F 前进 · L/R 转向 · S 怪物特技 · X 转圈(带2 陷阱卡——好看但白费一槽) */
const CARDS = ['F', 'L', 'R', 'S'];
/* 特技语义(board.skill): boom 炸开软障碍+打盹2回合 · smash 砸碎软障碍 ·
   climb 可上高台 · glide 可过水面 —— 特技卡统一语义见设计稿 §3.1/§3.2 */
const SKILLS = ['boom', 'smash', 'climb', 'glide'];

const idxIn = (board, x, z) =>
  (x < 0 || x >= board.w || z < 0 || z >= board.h) ? -1 : z * board.w + x;

/* 有效格型: 已被特技清除的软障碍视作地面(判定单份, F 与 BFS 共用) */
function effectiveType(board, x, z, cleared) {
  const idx = idxIn(board, x, z);
  if (idx < 0) return CELL.OOB;
  const t = board.cells[idx];
  return (t === CELL.SOFT && cleared.indexOf(idx) >= 0) ? CELL.GROUND : t;
}

/* ---------- 出题: 先生可解路径, 再落障碍(硬墙填充→刻路径→特征→装饰) ---------- */

/* 目标偏置随机游走: goalward 候选额外加权(池内重复 3 份 vs 邻域 1 份),
   步数封顶防绕环; 未达返回 null 由 mkBoard 换重试子种子(确定性重放红线:
   全程 RandCore, 零 Math.random) */
function carvePath(rnd, w, h, start, goal) {
  let x = start.x; let z = start.z;
  const path = [{x, z}];
  const seen = new Set([z * w + x]);
  /* 首步恒向东: 出生朝向派生自第二路径格(mkBoard 尾部), 钉死东 = 画面右,
     「F 往哪走」俯视角一眼读懂(真机反馈; mkBoard 保证 goal.x 恒 > start.x
     且 start.x 恒 0, 东邻恒在界内) */
  x += 1;
  seen.add(z * w + x);
  path.push({x, z});
  for (let i = 0; i < w * h * 8; i++) {
    if (x === goal.x && z === goal.z) return path;
    const cand = [];
    for (const d of DIRS) {
      const nx = x + d.dx; const nz = z + d.dz;
      if (nx < 0 || nx >= w || nz < 0 || nz >= h) continue;
      const goalward = (nx === x + Math.sign(goal.x - x) && d.dz === 0) ||
        (nz === z + Math.sign(goal.z - z) && d.dx === 0);
      const reps = goalward ? 3 : 1;
      for (let k = 0; k < reps; k++) cand.push({x: nx, z: nz});
    }
    const pick = cand[Math.floor(rnd() * cand.length)];
    x = pick.x; z = pick.z;
    const idx = z * w + x;
    if (!seen.has(idx)) {
      seen.add(idx); path.push({x, z});
    }
  }
  return null;
}

/* 路点式刻路(转向盘专用): 恰好 turns 个转向的单调走廊 —— L/Z/阶梯形,
   首段恒东(D10), 段序 H/V 交替(偶转向末段东进旗, 奇转向末段沿终点列纵走);
   全程 x 单调增、z 单调趋goal, 1 格宽走廊无 2×2 块 ⇒ BFS 最短解唯一=走廊
   本身(转向数不被近路吃掉, 形状闸③天然自证); 转向数=2·V段数(起西终东的
   几何必然), 切分用 stars-and-bars 逐段抽(确定性: 全程 rnd)。 */
function carveShapedPath(rnd, w, h, start, goal, turns) {
  const nH = Math.floor(turns / 2) + 1;
  const nV = Math.ceil(turns / 2);
  const dz = goal.z - start.z;
  const step = dz > 0 ? 1 : -1;
  /* span 切 n 段每段 ≥1: 逐段从剩余量抽, 给后面每段预留 1 */
  const parts = (span, n) => {
    const out = [];
    let left = span;
    for (let i = 0; i < n; i++) {
      const p = (i === n - 1) ? left : 1 + Math.floor(rnd() * (left - (n - i - 1)));
      out.push(p);
      left -= p;
    }
    return out;
  };
  const hParts = parts(w - 1, nH);
  const vParts = parts(Math.abs(dz), nV);
  const path = [{x: start.x, z: start.z}];
  let x = start.x;
  let z = start.z;
  for (let r = 0; r < nH + nV; r++) {
    if (r % 2 === 0) {
      for (let k = 0; k < hParts[r / 2]; k++) {
        x += 1;
        path.push({x, z});
      }
    } else {
      for (let k = 0; k < vParts[(r - 1) / 2]; k++) {
        z += step;
        path.push({x, z});
      }
    }
  }
  return path;
}

/* 最短解的转向卡计数(形状闸③用) */
function countTurns(sol) {
  let n = 0;
  for (const c of sol) {
    if (c === 'L' || c === 'R') n++;
  }
  return n;
}

/* 特征落位候选: 路径中段(去重, 非起终点), 不与起点/已落特征相邻 ——
   终点侧 2026-10-28 放开(@.sG 式「特技贴旗」是带1 boom 唯一可教形态:
   4 宽路径中段全与起终点相邻, 禁贴终点 = 特征无处落 = 教学静默蒸发);
   起点侧仍禁(第一步即陷阱的挫败设计) */
function featureCandidates(path, board0, taken) {
  const w = board0.w; const h = board0.h;
  const uniq = [];
  const seen = new Set();
  for (const c of path) {
    const idx = c.z * w + c.x;
    if (!seen.has(idx)) {
      seen.add(idx); uniq.push(idx);
    }
  }
  const edges = new Set();
  /* 只护起点侧(终点侧放开, 见函数头注释) */
  for (const e of [uniq[0]]) {
    edges.add(e);
    const ex = e % w; const ez = Math.floor(e / w);
    for (const d of DIRS) {
      const ni = idxIn({w, h}, ex + d.dx, ez + d.dz);
      if (ni >= 0) edges.add(ni);
    }
  }
  const near = (idx, list) => {
    const x = idx % w; const z = Math.floor(idx / w);
    return list.some((t) => {
      const tx = t % w; const tz = Math.floor(t / w);
      return Math.abs(tx - x) + Math.abs(tz - z) <= 1;
    });
  };
  return uniq.filter((idx, i) =>
    i > 0 && i < uniq.length - 1 && !edges.has(idx) && !near(idx, taken));
}

function placeFeatures(rnd, cand, count, taken) {
  const shuffled = RandCore.shuffle(rnd, cand);
  for (const idx of shuffled) {
    if (taken.length >= (taken.baseCount || 0) + count) break;
    const w = taken.w; const x = idx % w; const z = Math.floor(idx / w);
    const clash = taken.some((t) => {
      const tx = t % w; const tz = Math.floor(t / w);
      return Math.abs(tx - x) + Math.abs(tz - z) <= 1;
    });
    if (!clash) taken.push(idx);
  }
  return taken.slice(taken.baseCount || 0);
}

/* mkBoard(seed, opts): opts = {w, h, skill, softPath, waterPath, ledgePath,
   groundDecor, waterDecor, parCap, turnsMin} —— 特征量按包/带给(skill 约束在
   robot-levels 的关卡参数里把关, 这里对错配静默少放: softPath 仅 boom/smash
   生效等); parCap = BFS 最短解预算(0/缺省 = 不设闸, 单测手工盘用);
   turnsMin = 最短解必须包含的最少转向卡数(形状闸③, 0/缺省 = 目标偏置游走
   旧行为; 装不下时逐级静默降档) */
function mkBoard(seed, opts) {
  const o = opts || {};
  const w = o.w || 6; const h = o.h || 6;
  const skill = o.skill || null;
  /* 形状请求可行性预检(D15): 转向 t 的最小 par = (w-1) + ceil(t/2) + t +
     skillExtra(boom +3=打盹吞2 / smash +1 / climb·glide 0=S 算一步移动),
     且 |dz| ≥ ceil(t/2) —— 装不下逐级降档, 0 = 退回游走(旧行为, 单测手工
     盘与无请求调用零影响) */
  let turnsMin = Math.max(0, Math.floor(o.turnsMin || 0));
  const skillExtra = skill === 'boom' ? 3 : skill === 'smash' ? 1 : 0;
  /* 转向盘特征钳 1(静默少放): 走廊 1 格宽无旁路, 每块软障碍各吃一张 S 卡
     (boom 还各吞 2 打盹) —— 请求 2 块时 par = moves+转向+2×S代价必爆
     parCap, 80 attempt 全败落兜底(2026-10-29 带3 golem 实测 28/28 盘全兜
     底)。形状优先, 特征让位; 直路盘(游走)保留多特征——鼓包+装饰天然给
     第二块软障碍当旁路, 教学闸只要求 sol 含一次 S, 旧行为成立 */
  const featCap = turnsMin > 0 ? 1 : Infinity;
  const wantSoft = (skill === 'boom' || skill === 'smash') ?
    Math.min(o.softPath || 0, featCap) : 0;
  const wantWater = (skill === 'glide') ? Math.min(o.waterPath || 0, featCap) : 0;
  const wantLedge = (skill === 'climb') ? Math.min(o.ledgePath || 0, featCap) : 0;
  while (turnsMin > 0) {
    const needDz = Math.ceil(turnsMin / 2);
    const parMin = (w - 1) + needDz + turnsMin + skillExtra;
    if ((o.parCap || 0) > 0 && parMin > o.parCap) {
      turnsMin--;
      continue;
    }
    if (needDz > h - 1) {
      turnsMin--;
      continue;
    }
    break;
  }
  for (let attempt = 0; attempt < 80; attempt++) {
    const rnd = RandCore.mkRand(RandCore.seedAt(seed, attempt));
    let start;
    let goal;
    if (turnsMin > 0) {
      /* 转向盘: dz 在 [needDz, maxDz] 内确定性抽样(低段=贴预算, 高段=留
         装饰近路余量), 方向五五开; z0 取值域保证 zg 不越界 */
      const needDz = Math.ceil(turnsMin / 2);
      const maxDz = (o.parCap || 0) > 0 ?
        Math.min(h - 1, o.parCap - (w - 1) - turnsMin - skillExtra) : h - 1;
      const dzMag = needDz + Math.floor(rnd() * (maxDz - needDz + 1));
      const down = rnd() < 0.5;
      const z0Min = down ? 0 : dzMag;
      const z0Max = down ? h - 1 - dzMag : h - 1;
      start = {x: 0, z: z0Min + Math.floor(rnd() * (z0Max - z0Min + 1))};
      goal = {x: w - 1, z: down ? start.z + dzMag : start.z - dzMag};
    } else {
      start = {x: 0, z: Math.floor(rnd() * h)};
      goal = {x: w - 1, z: Math.floor(rnd() * h)};
    }
    const path = turnsMin > 0 ?
      carveShapedPath(rnd, w, h, start, goal, turnsMin) :
      carvePath(rnd, w, h, start, goal);
    if (!path) continue;
    const cells = new Array(w * h).fill(CELL.HARD); /* 全硬墙起底: 天然堵捷径 */
    for (const c of path) cells[c.z * w + c.x] = CELL.GROUND;
    cells[goal.z * w + goal.x] = CELL.GOAL;
    /* 特征三连: 软障碍(带1 特技教学) → 水面(滑翔) → 高台(攀爬), 互不相邻。
       taken 只护起点(终点侧放开 = @.sG 特技贴旗教学, 见 featureCandidates) */
    const taken = [];
    taken.baseCount = 0; taken.w = w;
    taken.push(start.z * w + start.x);
    taken.baseCount = taken.length; /* 起点只作邻接约束, 不算已落特征 */
    let features = [];
    if (wantSoft || wantWater || wantLedge) {
      const cand = featureCandidates(path, {w, h}, taken);
      const sink = [];
      sink.baseCount = 0; sink.w = w;
      const take = (n) => {
        const got = placeFeatures(rnd, cand, n, sink);
        sink.baseCount = sink.length;
        return got;
      };
      const soft = take(wantSoft);
      const water = take(wantWater);
      const ledge = take(wantLedge);
      features = [...soft, ...water, ...ledge];
      for (const idx of soft) cells[idx] = CELL.SOFT;
      for (const idx of water) cells[idx] = CELL.WATER;
      for (const idx of ledge) cells[idx] = CELL.LEDGE;
    }
    /* 装饰: 非路径非特征的硬墙里开洞(近路可能)与小水面(危险观感) */
    const free = [];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === CELL.HARD) free.push(i);
    }
    const decor = RandCore.shuffle(rnd, free);
    let di = 0;
    for (let k = 0; k < (o.groundDecor || 0) && di < decor.length; k++, di++) {
      cells[decor[di]] = CELL.GROUND;
    }
    for (let k = 0; k < (o.waterDecor || 0) && di < decor.length; k++, di++) {
      cells[decor[di]] = CELL.WATER;
    }
    /* 起始朝向 = 第二个路径格方向(路径长度恒 ≥2: 起终点不同列) */
    let dir = 0;
    if (path.length > 1) {
      const dx = path[1].x - path[0].x; const dz = path[1].z - path[0].z;
      dir = Math.max(0, DIRS.findIndex((d) => d.dx === dx && d.dz === dz));
    }
    const out = {seed, w, h, cells, softList: features, start: {...start, dir},
      goal, skill};
    /* 三闸(同一份 BFS 解上判, 不过闸换 attempt 子种子重出, 确定性不变):
       ① 预算闸 parCap: 最短解 ≤ 槽位预算 —— 设计稿 §4「程序长度主轴」的
          硬约束, par 超槽位 = 模式层一 program 内必不可能到旗(槽满静默拒
          落卡); 真机迭代探针实锤: 修前 236/300 非 tut 盘超预算, 81/100 关
          凑不齐 3/4 过盘线 = 根本过不了关;
       ② 教学闸: 特技关的棋盘最短解必须真用上特技卡(S 承重) —— 装饰近路
          或路径自贴旁路把特征格绕成选修 = 该关教学目标落空(探针: 61/268
          特技盘被绕过);
       ③ 形状闸(D15): turnsMin 请求下最短解转向卡数必须足额 —— 装饰近路把
          走廊弯道抄成直线 = 「排转弯」教学落空(2026-10-29 审计: 游走刻路
          时代带1~3 共 300 盘 100% 零转弯, L/R 卡整条课程线断供) */
    const sol = parSolution(out);
    if (!sol) continue; /* 防御: 生成器保证可解, 理论不可达 */
    if (o.parCap && sol.length > o.parCap) continue;
    if (skill && features.length && !sol.includes('S')) continue;
    if (turnsMin > 0 && countTurns(sol) < turnsMin) continue;
    return out;
  }
  /* 80 次全败兜底(理论上不可达; 80 = 三闸重试余量): 中线直路棋盘 — 罕见
     形态(无特征无装饰), 但可解(par = w-1 ≤ 各带槽位)且教学闸自然豁免
     (features 空)。曾漏设 GOAL 格(双闸加入后兜底首次可达, 随即炸出
     「必须可解」红灯的回归), 这里补上 */
  const mid = Math.floor(h / 2);
  const cells = new Array(w * h).fill(CELL.HARD);
  for (let x = 0; x < w; x++) cells[mid * w + x] = CELL.GROUND;
  cells[mid * w + (w - 1)] = CELL.GOAL;
  return {seed, w, h, cells, softList: [],
    start: {x: 0, z: mid, dir: 0}, goal: {x: w - 1, z: mid}, skill};
}

/* ---------- 模拟: 状态进/意图出, 纯函数(入参 sim 不被改写) ----------
   意图: move/turn/skill/win/bonk/splash/nap/spin/nothing/idle —— 回放表现
   (走路/撞头/晃圈/睡觉)由 robot-world 按意图演, 本文件只产意图 */

function mkSim(board) {
  return {x: board.start.x, z: board.start.z, dir: board.start.dir,
    asleep: 0, cleared: [], won: false};
}

function stepForward(board, s, skill) {
  const d = DIRS[s.dir];
  const nx = s.x + d.dx; const nz = s.z + d.dz;
  const t = effectiveType(board, nx, nz, s.cleared);
  const ok = skill === 'climb' ?
    (t === CELL.GROUND || t === CELL.GOAL || t === CELL.LEDGE) :
    skill === 'glide' ?
      (t === CELL.GROUND || t === CELL.GOAL || t === CELL.WATER) :
      (t === CELL.GROUND || t === CELL.GOAL);
  if (!ok) return {sim: s, intent: t === CELL.WATER ? 'splash' : 'bonk'};
  s.x = nx; s.z = nz;
  if (t === CELL.GOAL) {
    s.won = true; return {sim: s, intent: 'win'};
  }
  return {sim: s, intent: 'move'};
}

function stepSkill(board, s) {
  if (board.skill === 'boom' || board.skill === 'smash') {
    const d = DIRS[s.dir];
    const idx = idxIn(board, s.x + d.dx, s.z + d.dz);
    if (idx >= 0 && board.cells[idx] === CELL.SOFT && s.cleared.indexOf(idx) < 0) {
      s.cleared.push(idx);
      if (board.skill === 'boom') s.asleep = 2; /* 苦力怕炸完打盹(设计稿 §3.2) */
      return {sim: s, intent: 'skill'};
    }
    return {sim: s, intent: 'nothing'}; /* 没得炸: 耸肩不罚(零惩罚) */
  }
  return stepForward(board, s, board.skill); /* climb/glide 特殊移动 */
}

function stepSim(board, sim, card) {
  const s = {x: sim.x, z: sim.z, dir: sim.dir, asleep: sim.asleep,
    cleared: sim.cleared.slice(), won: sim.won};
  if (s.won) return {sim: s, intent: 'idle'}; /* 已到旗: 后续卡全空转 */
  if (s.asleep > 0) {
    s.asleep--; return {sim: s, intent: 'nap'};
  } /* 打盹吞掉任何卡 */
  if (card === 'X') return {sim: s, intent: 'spin'};
  if (card === 'L') {
    s.dir = (s.dir + 3) % 4; return {sim: s, intent: 'turn'};
  }
  if (card === 'R') {
    s.dir = (s.dir + 1) % 4; return {sim: s, intent: 'turn'};
  }
  if (card === 'F') return stepForward(board, s, null);
  if (card === 'S') return stepSkill(board, s);
  return {sim: s, intent: 'idle'}; /* 未知卡: 安全空转 */
}

/* simulate: 整段程序回放账本(world host 逐条演 trace; win 提前收) */
function simulate(board, cards) {
  let sim = mkSim(board);
  const trace = [];
  let lastIntent = 'idle';
  for (const card of cards) {
    const r = stepSim(board, sim, card);
    sim = r.sim;
    lastIntent = r.intent;
    trace.push({card, intent: r.intent, x: sim.x, z: sim.z, dir: sim.dir,
      asleep: sim.asleep});
    if (r.intent === 'win') break;
  }
  const status = sim.won ? 'win' :
    (lastIntent === 'bonk' ? 'bonk' :
      lastIntent === 'splash' ? 'splash' : 'out');
  return {trace, status, sim};
}

/* ---------- par: BFS 最短指令序列(演示路径与三星预算同一权威) ---------- */

function stateKey(board, s) {
  /* asleep 必须入键: 打盹过渡若与炸后状态同键, BFS 会把它当已访问丢弃,
     炸过的怪永远醒不来(回归: 手工 '@sG' boom 棋盘 par 误判不可解) */
  return s.x + ',' + s.z + ',' + s.dir + ',' + s.asleep + ',' +
    s.cleared.slice().sort((a, b) => a - b).join('.');
}

/* parSolution: 层序 BFS(父指针回溯卡列), 不可解返回 null(生成器保证可解,
   手工棋盘不保证); 探索深度封顶 400 层防病态棋盘 */
function parSolution(board) {
  const start = mkSim(board);
  const startKey = stateKey(board, start);
  const seen = new Set([startKey]);
  const parent = new Map();
  let frontier = [start];
  for (let depth = 0; frontier.length && depth < 400; depth++) {
    const next = [];
    for (const sim of frontier) {
      if (sim.won) {/* 回溯卡列 */
        const cards = [];
        let k = stateKey(board, sim);
        while (k !== startKey) {
          const p = parent.get(k);
          cards.push(p.card);
          k = p.prev;
        }
        return cards.reverse();
      }
      for (const card of CARDS) {
        const r = stepSim(board, sim, card);
        const k = stateKey(board, r.sim);
        if (seen.has(k)) continue;
        seen.add(k);
        parent.set(k, {prev: stateKey(board, sim), card});
        next.push(r.sim);
      }
    }
    frontier = next;
  }
  return null;
}

function parOf(board) {
  const sol = parSolution(board);
  return sol ? sol.length : -1;
}

const RobotCore = {CELL, DIRS, CARDS, SKILLS,
  mkBoard, mkSim, stepSim, simulate, parSolution, parOf};
if (typeof module !== 'undefined' && module.exports) module.exports = RobotCore;
