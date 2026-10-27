'use strict';
/* ============================================================
   跳一跳世界轨纯核心 (HopWorld, 术语见 GLOSSARY.md「跳一跳世界轨」) — 应用层纯核心
   ------------------------------------------------------------
   一句话职责: hop 族世界变体(掷骰前进/跳格子任务/间隔问题+规律跳)的
   路径布局、骰步、试次与选项的种子注入纯函数——出题与判分决策全部
   在这里, 世界装配(js/math-world.js)只把它们演成方块路、走子与语音。
   线性数路口径(Ramani & Siegler 2008 形态级 RCT: 线性数板有效、环形
   无效): 格子下标 0..last 严格单调, at(i)→at(i+1) 一步可达(hopRoute
   展开后逐格曼哈顿相邻), 蛇行只是视觉折行、数序沿路不变; 每 10 格
   一档(下标 %10==0)插旗标位值(plan §6 族 C「十格一档」)。
   大数带换算: max>100 时 unit=10, 每格代表 10、格上数字=下标×10 ——
   跳/数/答全部以"格"为单位(整十数加减), 读数变大、路程不变。
   interface: hopPathPlan(params) → plan{unit,last,line,at,value,
     isDecade,bounds} · hopRoute(plan, from, to) → 逐格坐标(含蛇行折返
     连接格) · hopDiceStep(plan, rnd, cur) · hopJumpTrial(plan, params,
     rnd, cur) · hopGapTrial(plan, params, rnd) · hopChoices(rnd,
     answer, hi, lo) · HOP_ROW/HOP_LINE_MAX/HOP_MARGIN(布局常数)
   依赖(均经全局名, 调用期解析): PuzzleCore(js/math-puzzles-core.js,
   加载序在本文件之前 — mkIntervalPuzzle/mkSeqPuzzle 是间隔/规律跳的
   出题神谕, 本核心只做"格空间"包装: 间隔题跨度钳到可走范围后整体
   平移到大数位置, 答案与两端点同增减、计数不变);
   RandCore(js/rand-core.js, 加载序在本文件之前) — childSeed 从注入
   rnd 派生子种子(同 rnd 序列决定同题)。
   可测性: 零 THREE · 零 DOM · 有单测 test/hop-world-core.test.js
   ============================================================ */
const HopWorld = (() => {
  /* 蛇行每行格数 = 整十一档(位值标旗的档距, band1+ 的 0-100 路折成 10 格一行) */
  const HOP_ROW = 10;
  /* 直路上限(含 0 号格): band0 的 0-10/0-20 路走直线, 更长的路转蛇行 */
  const HOP_LINE_MAX = 21;
  /* 场景草岛外扩边距(格): 路界外再铺一圈草, 幅面仍 ≤32×32 由测试锁定 */
  const HOP_MARGIN = 4;

  /* ---------- 路径布局: params.max → 线性方块路的格坐标 ---------- */

  /* plan.at(i): 第 i 号格的方块坐标(格左下角整数坐标, i∈[0,last]);
     line=单行直线(沿 +X), 否则 10 格一行蛇行(行距 2, 奇数行反向 —
     行尾与下一行行首同列相邻, 连接格由 hopRoute 补上) */
  function hopPathPlan(p) {
    const o = p || {};
    const max = Math.max(10, Math.round(o.max || 10)); // 曲线侧 hop 最小带 10
    const unit = max > 100 ? 10 : 1; // 大数带: 一格代表 10(整十数加减)
    const last = Math.floor(max / unit); // 终点格下标(值 last*unit ≤ max)
    const line = last + 1 <= HOP_LINE_MAX;
    const x0 = line ? 64 - Math.floor(last / 2) : 60; // 一期 128 区居中(2026-10 世界扩容后坐标不动)
    const z0 = line ? 64 : 66;
    const rows = line ? 1 : Math.ceil((last + 1) / HOP_ROW);
    function at(i) {
      if (!Number.isInteger(i) || i < 0 || i > last) return null;
      if (line) return {x: x0 + i, z: z0};
      const r = Math.floor(i / HOP_ROW);
      const k = i - r * HOP_ROW; // 行内第 k 格
      /* 蛇行方向交替: 偶数行从 x0 向东, 奇数行从东端向西折回 —— 行尾与
         下一行行首恒同列(折返连接格由 hopRoute 补), 末行不足 10 格也
         从上一行行尾那列起步, 数序始终相邻连续 */
      const x = (r % 2 === 0) ? x0 + k : x0 + (HOP_ROW - 1 - k);
      return {x, z: z0 - 2 * r};
    }
    return {
      unit, last, line, x0, z0, rows, at,
      value: (i) => i * unit, // 格上写的数字(0/10/20… 或 0/1/2…)
      isDecade: (i) => i % HOP_ROW === 0, // 整十一档(每 10 格): 插旗标位值
      bounds: line ?
        {x1: x0, z1: z0, x2: x0 + last, z2: z0} :
        {x1: x0, z1: z0 - 2 * (rows - 1), x2: x0 + HOP_ROW - 1, z2: z0},
    };
  }

  /* 逐格走线: from→to 沿数序展开成连续坐标串(含蛇行折返的连接格),
     相邻两项曼哈顿距离恒 1 —— 线性红线的可走形式, 走子/建路共用 */
  function hopRoute(plan, from, to) {
    if (!plan || !plan.at(from) || !plan.at(to)) return [];
    const step = from <= to ? 1 : -1;
    const out = [plan.at(from)];
    let prev = out[0];
    for (let i = from + step; ; i += step) {
      const cur = plan.at(i);
      if (cur.x === prev.x && Math.abs(cur.z - prev.z) === 2) {
        out.push({x: prev.x, z: (prev.z + cur.z) / 2}); // 蛇行折返连接格
      }
      out.push(cur);
      prev = cur;
      if (i === to) break;
    }
    return out;
  }

  /* ---------- 掷骰前进(dice): 骰值 + 终格(走完读数) ---------- */

  /* 临近终点(剩余 <3 格)先回起点: 一条路的数序反复走满, 不截断;
     骰值 1..6, 落格 = min(from+骰值, last) —— 纯函数, 走子与读数归装配层 */
  function hopDiceStep(plan, rnd, cur) {
    let from = Math.max(0, Math.min(plan.last, Math.round(cur || 0)));
    let wrap = false;
    if (plan.last - from < 3) {
      from = 0;
      wrap = true;
    }
    const roll = 1 + Math.floor(rnd() * 6);
    const to = Math.min(from + roll, plan.last);
    return {from, to, roll, wrap, d: to - from};
  }

  /* ---------- 跳格子任务(jumps): 前跳点落格 / 倒推答步数 ---------- */

  /* 形态随推理档与往返率: fwd 前跳点落格(数数起点+步数→目标, 点击答) ·
     rev 倒推步数(两端都亮旗, 点数字答 a→b 跳几格, reverse/multi-solve 混入) ·
     back 往回跳点落格(zigRate 渐入, "看清方向")。步长 2..8 保证可点可数。 */
  function hopJumpTrial(plan, p, rnd, cur) {
    const o = p || {};
    let from = Math.max(0, Math.min(plan.last, Math.round(cur || 0)));
    if (plan.last - from < 2) from = 0; // 无前跳空间: 回起点
    const hi = plan.last - from;
    const zigOk = (o.zigRate || 0) > 0 && rnd() < o.zigRate && from >= 3;
    if (zigOk) {
      const n = 2 + Math.floor(rnd() * Math.min(4, from - 2)); // 2..min(5, from-1)
      return {form: 'back', from, n, to: from - n};
    }
    const revOk = (o.reasoning === 'reverse' || o.reasoning === 'multi-solve') && rnd() < 0.5;
    if (revOk && hi >= 2) {
      const to = from + 2 + Math.floor(rnd() * Math.min(8, hi - 1)); // from+2..min(from+9,last)
      return {form: 'rev', from, to, answer: to - from};
    }
    const n = 2 + Math.floor(rnd() * Math.min(7, hi - 1)); // 2..min(8, 剩余)
    return {form: 'fwd', from, n, to: from + n};
  }

  /* ---------- 间隔问题+规律跳(gaps ★★): PuzzleCore 神谕的格空间包装 ---------- */

  /* 间隔: mkIntervalPuzzle 先在小尺度(≤12 格, 走得完数得清)上定模式与
     答案, 再整体平移到路内随机位置 —— 两端点数值变大(大数带按格 ×10),
     中间格数 = 答案, 与原题严格一致(植树/爬楼问题的具身口径)。 */
  function hopGapInterval(plan, rnd) {
    const cap = Math.min(12, plan.last);
    const pz = PuzzleCore.mkIntervalPuzzle({seed: RandCore.childSeed(rnd), max: cap});
    const off = Math.floor(rnd() * (plan.last - pz.b));
    return {sub: 'interval', mode: pz.mode, aIdx: pz.a + off, bIdx: pz.b + off, answer: pz.answer};
  }

  /* 规律跳: mkSeqPuzzle 直接在下标空间出题(等差/交替), 展示项即落格点,
     问下一落格(点击答); 大数带显示值 ×unit(整十数序列) */
  function hopGapSeq(plan, rnd) {
    const pz = PuzzleCore.mkSeqPuzzle({seed: RandCore.childSeed(rnd), max: plan.last});
    return {sub: 'seq', seq: pz.seq.slice(), next: pz.next, rule: pz.rule};
  }

  function hopGapTrial(plan, p, rnd) {
    void p; // 间隔/规律的混入概率不随 params 变(挑战关内五五开附近), tier 已由曲线管数值
    return (rnd() < 0.45) ? hopGapSeq(plan, rnd) : hopGapInterval(plan, rnd);
  }

  /* ---------- 数值选项条: 答案 + 3 个邻近干扰, 恰 4 项(≤4 组块红线) ---------- */

  /* 干扰优先 ±1..±3 再 ±5/±10(数感近邻), 全部落在 [lo,hi]; 区间宽度不足
     4 时以远离值兜底(仍不重复)。返回已洗牌数组。 */
  function hopChoices(rnd, answer, hi, lo) {
    const min = lo || 0;
    const vals = [answer];
    const tries = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10];
    for (const t of tries) {
      if (vals.length >= 4) break;
      const v = answer + t;
      if (v >= min && v <= hi && !vals.includes(v)) vals.push(v);
    }
    let far = 1;
    while (vals.length < 4) {
      const v = answer + 11 + far++;
      if (!vals.includes(v)) vals.push(v);
    }
    const out = vals.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  return {HOP_ROW, HOP_LINE_MAX, HOP_MARGIN, hopPathPlan, hopRoute,
    hopDiceStep, hopJumpTrial, hopGapTrial, hopChoices};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HopWorld;
