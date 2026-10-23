'use strict';
/* ============================================================
   Math Island Mode (数学冒险岛模式, 术语见 GLOSSARY.md) — 模式层
   ------------------------------------------------------------
   一句话职责: 装配数学冒险岛的入口/今日页/每日额度/锁定态骨架
   与应用层文案, 玩法装配(关卡地图/屏流/世界族场景/结算/图章/
   家长面板)由 T2~T9 各票在此骨架上续建 — 本票不含任何玩法。
   interface: MathMode(mkMode 注册对象, id='math')
   依赖(均经全局名, 调用期解析): mkMode(js/mode-kit.js) ·
     SpeechKit(js/speech.js) · showToast(js/effects.js) ·
     btnImg(js/button-icons.js) · Budgets/MATH_DAILY_*(js/daily-budget.js
     与 main.js setupBudgets 建立的 math 预算) ·
     overlay/showPage(js/main.js 组合根, main.js 后加载, 调用期才解析 —
     与 FocusMode 同款)
   可测性: 纯 DOM 模式层; 玩法决策纯函数将在 js/math-levels.js
     (T2)与 js/math-puzzles-core.js(T3)配单测, 本文件由
     boot.test.js 全链冒烟兜底
   ------------------------------------------------------------
   会话(设计稿 docs/math-mode-design.md §5): 主菜单卡进入 →
   init 全屏接管 → 今日页(每日 6 关 / 20 分钟额度展示) →
   [T4+ 票接线后: 关卡地图 → 关卡 → 结算/图章]; 额度尽 →
   今日页锁定文案 + 明天再来; 时长入账: 关卡进行中每秒 accrue
   (focus ticker 同款), 菜单/地图页不计; 话术走 SpeechKit,
   零文字依赖(数字符号是学习对象, 允许出现)
============================================================ */

/* ---------- 过程性表扬 / 中性安慰 (数学向: 夸方法与努力, 不夸聪明) ----------
   话术属应用层文案(Mueller & Dweck 1998 过程性表扬口径);
   T8 激励回路经全局名调用期取用, 屏流引擎不内嵌话术 */
const MATH_PRAISE = [
  '你倒着也想出来了，真会动脑筋！', '你按顺序一个一个数，真仔细！',
  '你找到了规律，这个方法真好！', '你把答案找齐了，一个都不漏！',
  '你一步一步想清楚了，真棒！', '你换了个方法就做出来啦，爱试试真了不起！',
];
const MATH_COMFORT = [
  '没关系，我们慢慢想。', '再想一想，你可以的。', '差一点点啦，再试一次！', '换个方法试试看。',
];
function mathPraiseLine() {
  return MATH_PRAISE[Math.floor(Math.random()*MATH_PRAISE.length)];
}
function mathComfortLine() {
  return MATH_COMFORT[Math.floor(Math.random()*MATH_COMFORT.length)];
}

/* ---------- 每日预算(每日关数/时长): 记在 js/daily-budget.js 的 math 预算 ----------
   main.js setupBudgets 建立(并入 ADR 0001 单一存档键账本);
   锁定体验同 focus: 额度尽 → 今日页锁定文案 + 明天再来 */
function mathBudget() {
  return (typeof Budgets !== 'undefined' && Budgets) ? Budgets.math : null;
}
function mathLocked() {
  const b = mathBudget(); return !!(b && b.blocked());
}

/* ---------- 根容器与屏幕 ---------- */
let mathRoot = null; let mathTicker = 0; let mathTickT0 = 0;

/* 训练时长入账: 关卡进行中每秒 accrue 实际毫秒并落账(focus ticker 同款) —
   崩溃/关页损失 ≤1 秒; 今日页/地图页不计(口径与专注训练营一致);
   T1 骨架先立好 ticker, 关卡起停由玩法票(T4+)接线 */
function startMathTicker() {
  stopMathTicker();
  mathTickT0 = Date.now();
  mathTicker = setInterval(()=>{
    const b = mathBudget(); if (!b) return;
    const nowT = Date.now();
    b.accrue(nowT - mathTickT0);
    mathTickT0 = nowT;
    b.flush();
  }, 1000);
}
function stopMathTicker() {
  if (mathTicker) {
    clearInterval(mathTicker); mathTicker = 0;
  }
}

function ensureMathRoot() {
  if (mathRoot) return;
  mathRoot = document.createElement('div');
  mathRoot.id = 'mathRoot';
  document.body.appendChild(mathRoot);
}

function mathScreen(html) {
  mathRoot.innerHTML = '<div class="m-top"><button class="m-back" id="mBackBtn" aria-label="返回">' +
      btnImg('left') + '</button></div>' + html;
  document.getElementById('mBackBtn').onclick = mathExit;
  return mathRoot;
}
function mathExit() {
  stopMathTicker();
  SpeechKit.cancel();
  mathRoot.style.display = 'none';
  overlay.style.display = 'flex';
  showPage('main');
}

/* ---------- 今日页(T1 空壳: 标题 + 进入按钮 + 每日额度展示 + 锁定态) ----------
   关卡地图与村长/图章/家长面板入口由后续票在此页续建 */
function showMathToday() {
  stopMathTicker();
  const locked = mathLocked();
  const played = mathBudget() ? mathBudget().spentCount() : 0;
  const dots = Array.from({length: MATH_DAILY_LEVELS}, (_, k)=>
    '<span class="dot '+(k < played?'done':'')+'"></span>').join('');
  if (locked) {
    mathScreen(`
      <div class="m-screen m-today">
        <h1>今天的数学冒险完成啦！</h1>
        <p class="m-sub">小岛要休息了，明天再来吧</p>
        <div class="m-dots">${dots}</div>
        <button class="m-btn" id="mHome2">${btnImg('house')} 回主页</button>
      </div>`);
    document.getElementById('mHome2').onclick = mathExit;
    return;
  }
  mathScreen(`
    <div class="m-screen m-today">
      <h1>数学冒险岛</h1>
      <p class="m-sub">在方块世界里玩数学 · 每天 ${MATH_DAILY_LEVELS} 关 / ${MATH_DAILY_MIN} 分钟</p>
      <button class="m-start" id="mStartBtn">▶ 开始冒险</button>
      <div class="m-dots">${dots}</div>
    </div>`);
  SpeechKit.speak('欢迎来到数学冒险岛！');
  /* 关卡地图属 T4+ 票, 骨架先占位 */
  document.getElementById('mStartBtn').onclick = ()=>{
    showToast('关卡地图马上开放，敬请期待', 2200);
    SpeechKit.speak('冒险岛还在建设中，马上就来！');
  };
}

/* ---------- 模式对象 ---------- */
const MathMode = mkMode({
  id: 'math',
  init() {
    ensureMathRoot();
    mathRoot.style.display = 'block';
    overlay.style.display = 'none';
    showMathToday();
  }, // 纯点选全屏 UI: chrome 全关由 kit 默认处理(focus 同款)
  cleanup() {
    stopMathTicker();
    SpeechKit.cancel();
    if (mathRoot) mathRoot.style.display = 'none';
  },
});
