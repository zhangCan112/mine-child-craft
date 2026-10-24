'use strict';
/* ============================================================
   Math Island Mode (数学冒险岛模式, 术语见 GLOSSARY.md) — 模式层
   ------------------------------------------------------------
   一句话职责: 装配数学冒险岛的屏幕流(今日页/关卡地图/关卡 runner/
   结算/boss 串联)与全部应用层文案; 玩法决策纯函数在 js/math-levels.js
   与 js/math-paradigms.js(屏流引擎), 本文件只做流程装配。
   interface: MathMode(mkMode 注册对象, id='math') ·
     纯流程函数(单测直测, test/math-paradigms.test.js 后半):
     mathVariantTrack(family, variant) · mathFrontier(save) ·
     mathLevelUnlocked(save, i) · mathFamChallengeDone(save, level) ·
     mathBossPlan(level) · mathAggStats(sts) · mathSettleSave(...)
   依赖(均经全局名, 调用期解析): mkMode(js/mode-kit.js) ·
     SpeechKit(js/speech.js) · showToast(js/effects.js) ·
     btnImg(js/button-icons.js) · Budgets/MATH_DAILY_*(js/daily-budget.js
     与 main.js setupBudgets 建立的 math 预算) · SyncDB(js/sync.js) ·
     MATH_*(js/math-levels.js) · PuzzleCore(js/math-puzzles-core.js) ·
     mathScreenDispatch/runMathScreen(js/math-paradigms.js) ·
     overlay/showPage(js/main.js 组合根, main.js 后加载, 调用期才解析 —
     与 FocusMode 同款)
   可测性: 纯 DOM 模式层; 流程纯函数经 vm 直测(见上), 本文件由
     boot.test.js 全链冒烟兜底
   ------------------------------------------------------------
   会话(设计稿 docs/math-mode-design.md §5): 主菜单卡进入 →
   init 全屏接管 → 今日页(进度概览/每日额度) → 关卡地图(四带分组/
   星显/锁定) → 规则语音 → 关卡 runner(屏流引擎) → 结算(星显/
   过程表扬/自动下一关); boss 关按 sections 连跑三小节聚合结算;
   挑战关通过写 challenge 表(第三星挂钩); 额度尽 → 今日页锁定文案;
   时长入账: 关卡进行中每秒 accrue(focus ticker 同款), 菜单/地图页不计。
   ★ 分发缝(T5/T6 挂载点): mathVariantTrack(family, variant) 返回
   'screen' | 'world' — T4 只认上表的 13 个屏流变体, 其余(跳一跳世界
   变体/摆一摆/搭一搭)返回 'world', 入关显示"该玩法建设中"占位并跳过;
   T5(跳一跳世界轨)/T6(摆与搭世界轨)合入后在 MATH_SCREEN_VARIANTS
   清单里摘除对应变体即接管, 流程层零改动。
   存档经 SyncDB.slot('math_camp_save')(focus 槽位惯例), defaults/
   migrate 用库层 MATH_SAVE_DEFAULTS/migrateMathSave; stars 表以
   "键存在"记通关(教学关 0 星入账=已通占位, 数学侧无 unlocked 字段的
   派生口径, 见 mathFrontier)。
   ============================================================ */

/* ---------- 过程性表扬 / 中性安慰 (数学向: 夸方法与努力, 不夸聪明) ----------
   话术属应用层文案(Mueller & Dweck 1998 过程性表扬口径);
   屏流引擎(math-paradigms.js)经全局名调用期取用, 引擎不内嵌话术 */
const MATH_PRAISE = [
  '你倒着也想出来了，真会动脑筋！', '你按顺序一个一个数，真仔细！',
  '你找到了规律，这个方法真好！', '你把答案找齐了，一个都不漏！',
  '你一步一步想清楚了，真棒！', '你换了个方法就做出来啦，爱试试真了不起！',
];
const MATH_COMFORT = [
  '没关系，我们慢慢想。', '再想一想，你可以的。', '差一点点啦，再试一次！', '换个方法试试看。',
];
function mathPraiseLine() {
  return MATH_PRAISE[Math.floor(Math.random() * MATH_PRAISE.length)];
}
function mathComfortLine() {
  return MATH_COMFORT[Math.floor(Math.random() * MATH_COMFORT.length)];
}

/* ---------- 每日预算(每日关数/时长): 记在 js/daily-budget.js 的 math 预算 ----------
   main.js setupBudgets 建立(并入 ADR 0001 单一存档键账本);
   锁定体验同 focus: 额度尽 → 今日页锁定文案 + 明天再来 */
function mathBudget() {
  return (typeof Budgets !== 'undefined' && Budgets) ? Budgets.math : null;
}
function mathLocked() {
  const b = mathBudget();
  return !!(b && b.blocked());
}

/* ---------- 分发缝(★ T5/T6 的挂载点, 见头注释) ----------
   屏流变体清单一处权威: T4 交付 13 个(count/craft/pattern 全变体 +
   hop 站位比大小); T5/T6 合入世界轨时从此清单摘除对应键, mathVariantTrack
   返回 'world' 的关卡改走世界轨装配(本文件的占位屏同时退役)。 */
const MATH_SCREEN_VARIANTS = new Set([
  'count/snapshot', 'count/fetch', 'count/compare', 'count/balance',
  'craft/enough', 'craft/shortage', 'craft/order', 'craft/blank',
  'pattern/chain', 'pattern/sort', 'pattern/odd', 'pattern/cycle',
  'hop/position',
]);

function mathVariantTrack(family, variant) {
  return MATH_SCREEN_VARIANTS.has(family + '/' + variant) ? 'screen' : 'world';
}

/* ---------- 存档槽(focus 槽位惯例): defaults/migrate 住库层可单测 ---------- */
const mathSlot = SyncDB.slot('math_camp_save', {
  defaults: MATH_SAVE_DEFAULTS,
  migrate(s, from) {
    return migrateMathSave(s, from);
  },
});
function loadMathSave() {
  return mathSlot.load();
}
function saveMathSave(s) {
  mathSlot.save(s);
}

/* ---------- 进度派生纯函数(存档无 unlocked 字段的口径) ---------- */

/* 当前前沿 = 最高已通关 + 1: 世界轨关卡未建时可"跳过"(0 星占位),
   前沿照常推进 — 存档形状不动, 派生规则单一出口 */
function mathFrontier(save) {
  let hi = -1;
  for (const k of Object.keys((save && save.stars) || {})) {
    const i = +k;
    if (Number.isInteger(i) && i >= 0 && i <= 99 && i > hi) hi = i;
  }
  return Math.min(99, hi + 1);
}

function mathLevelUnlocked(save, i) {
  return i <= mathFrontier(save);
}

/* 第三星挂钩: 挑战/boss 关过关自成条件; 常规关查族:带挑战表(补过回溯) */
function mathFamChallengeDone(save, level) {
  if (level.kind === 'challenge' || level.kind === 'boss') return true;
  return !!(save && save.challenge && save.challenge[level.family + ':' + level.band]);
}

/* ---------- boss 串联与聚合(纯函数) ---------- */

/* boss 各小节附轨道标注: world 小节 T4 显示"建设中"跳过, T5/T6 接管 */
function mathBossPlan(level) {
  return (level.sections || []).map((s) => Object.assign({}, s, {track: mathVariantTrack(s.family, s.variant)}));
}

/* 三段聚合按单关口径: 试次/正确求和, acc 重算, maxStreakErr 取最大 */
function mathAggStats(list) {
  const agg = {trials: 0, correct: 0, acc: 0, maxStreakErr: 0};
  for (const st of list || []) {
    agg.trials += st.trials || 0;
    agg.correct += st.correct || 0;
    agg.maxStreakErr = Math.max(agg.maxStreakErr, (st && st.maxStreakErr) || 0);
  }
  agg.acc = agg.trials ? agg.correct / agg.trials : 0;
  return agg;
}

/* ---------- 结算落账(单一写入点: 星表/挑战表/图章/家长日志 + 滚动裁剪) ----------
   返回是否通过; 预算关数计数(b.count)由调用方先行, 图章取 spentCount */
function mathSettleSave(save, level, st, today) {
  const passed = mathPassed(level, st);
  if (passed) {
    save.stars[level.i] = Math.max(save.stars[level.i] || 0,
        mathStars(level, st, mathFamChallengeDone(save, level))); // 教学关 0 星入账=已通占位
    if (level.kind === 'challenge') save.challenge[level.family + ':' + level.band] = true;
    if (level.kind === 'boss') {
      for (const sec of level.sections || []) save.challenge[sec.family + ':' + level.band] = true;
    }
  }
  const fb = mathBudget();
  save.stamps[today] = fb ? fb.spentCount() : (save.stamps[today] || 0) + 1;
  save.log = trimMathLog(save.log || {}, today, MATH_LOG_KEEP_DAYS);
  const day = save.log[today] = save.log[today] || {};
  const fam = day[level.family] = day[level.family] || {acc: 0, n: 0, chalN: 0, chalOk: 0};
  fam.acc = (fam.acc * fam.n + (st.acc || 0)) / (fam.n + 1);
  fam.n++;
  if (level.kind === 'challenge' || level.kind === 'boss') {
    fam.chalN++;
    if (passed) fam.chalOk++;
  }
  return passed;
}

/* ---------- 根容器与屏幕 ---------- */
let mathRoot = null;
let mathTicker = 0;
let mathTickT0 = 0;
let mathCtrl = null; // 进行中关卡的控制柄(引擎 {stop()})
let mathAutoTimer = 0; // 结算屏自动续程计时
const mathFailCount = {}; // 本关连续未通过次数 → 重试话术与"先玩别的"

/* 训练时长入账: 关卡进行中每秒 accrue 实际毫秒并落账(focus ticker 同款) —
   崩溃/关页损失 ≤1 秒; 今日页/地图页不计(口径与专注训练营一致) */
function startMathTicker() {
  stopMathTicker();
  mathTickT0 = Date.now();
  mathTicker = setInterval(() => {
    const b = mathBudget();
    if (!b) return;
    const nowT = Date.now();
    b.accrue(nowT - mathTickT0);
    mathTickT0 = nowT;
    b.flush();
  }, 1000);
}
function stopMathTicker() {
  if (mathTicker) {
    clearInterval(mathTicker);
    mathTicker = 0;
  }
}

function ensureMathRoot() {
  if (mathRoot) return;
  mathRoot = document.createElement('div');
  mathRoot.id = 'mathRoot';
  document.body.appendChild(mathRoot);
}

function mathScreen(html) {
  clearTimeout(mathAutoTimer);
  mathRoot.innerHTML = '<div class="m-top"><button class="m-back" id="mBackBtn" aria-label="返回">' +
      btnImg('left') + '</button></div>' + html;
  document.getElementById('mBackBtn').onclick = mathExit;
  return mathRoot;
}
function mathStopRun() {
  if (mathCtrl) {
    mathCtrl.stop();
    mathCtrl = null;
  }
  if (mathBossStop) {
    mathBossStop();
    mathBossStop = null;
  }
}
let mathBossStop = null; /* boss 链的中止旗(与引擎控制柄并行的另一条命) */
function mathExit() {
  clearTimeout(mathAutoTimer);
  mathStopRun();
  stopMathTicker();
  SpeechKit.cancel();
  mathRoot.style.display = 'none';
  overlay.style.display = 'flex';
  showPage('main');
}

/* ---------- 今日页: 进度概览 + 进入地图 ----------
   村长/图章/家长面板入口由 T8/T9 票在此页续建 */
function showMathToday() {
  stopMathTicker();
  const save = loadMathSave();
  const locked = mathLocked();
  const played = mathBudget() ? mathBudget().spentCount() : 0;
  const total = Object.values(save.stars).reduce((s, x) => s + x, 0);
  const cur = mathFrontier(save);
  const curLv = MATH_LEVELS[cur];
  const dots = Array.from({length: MATH_DAILY_LEVELS}, (_, k) =>
    '<span class="dot ' + (k < played ? 'done' : '') + '"></span>').join('');
  if (locked) {
    mathScreen(`
      <div class="m-screen m-today">
        <h1>今天的数学冒险完成啦！</h1>
        <p class="m-sub">小岛要休息了，明天再来吧 · ⭐${total}</p>
        <div class="m-dots">${dots}</div>
        <button class="m-btn" id="mHome2">${btnImg('house')} 回主页</button>
      </div>`);
    document.getElementById('mHome2').onclick = mathExit;
    return;
  }
  mathScreen(`
    <div class="m-screen m-today">
      <h1>数学冒险岛</h1>
      <p class="m-sub">第 ${cur + 1} 关 / 100 · ⭐${total} · 每天 ${MATH_DAILY_LEVELS} 关 / ${MATH_DAILY_MIN} 分钟</p>
      <div class="m-dim-icon">${MATH_META[curLv.family].icon}</div>
      <p class="m-sub">${MATH_META[curLv.family].game} · ${mathVariantName(curLv.family, curLv.variant)}</p>
      <button class="m-start" id="mStartBtn">▶ 开始冒险</button>
      <div class="m-dots">${dots}</div>
    </div>`);
  SpeechKit.speak('欢迎来到数学冒险岛！今天我们来玩' + MATH_META[curLv.family].game + '。');
  document.getElementById('mStartBtn').onclick = showMathMap;
}

/* ---------- 关卡地图页: 四带分组 · 星显 · 锁定/解锁 · 当前关高亮 ---------- */
const MATH_BAND_NAMES = ['一年级上', '一年级下', '二年级上', '二年级下'];

function mathVariantName(family, variant) {
  const v = (MATH_VARIANTS[family] || []).find((x) => x.id === variant);
  return v ? v.name : variant;
}

function showMathMap() {
  stopMathTicker();
  const save = loadMathSave();
  const frontier = mathFrontier(save);
  let html = '<div class="m-screen m-map"><h1>关卡地图</h1>';
  for (let band = 0; band < 4; band++) {
    html += '<div class="m-band"><div class="m-band-title">' + MATH_BAND_NAMES[band] +
        '</div><div class="m-band-grid">';
    for (let k = 0; k < 25; k++) {
      const i = band * 25 + k;
      const lv = MATH_LEVELS[i];
      const unlocked = mathLevelUnlocked(save, i);
      const stars = save.stars[i] === undefined ? 0 : save.stars[i];
      const cls = 'm-node ' + lv.kind + (unlocked ? ' open' : ' locked') + (i === frontier ? ' cur' : '');
      const starHtml = stars > 0 ? '<span class="m-nstars">' + '⭐'.repeat(stars) + '</span>' : '';
      const badge = lv.kind === 'boss' ? '<span class="m-nbadge">🏰</span>' :
          (lv.kind === 'challenge' ? '<span class="m-nbadge">★★</span>' : '');
      html += '<button class="' + cls + '" data-i="' + i + '"' + (unlocked ? '' : ' disabled') + '>' +
          '<span class="m-nnum">' + (i + 1) + '</span>' + badge + starHtml +
          '<span class="m-nicon">' + MATH_META[lv.family].icon + '</span></button>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  mathScreen(html);
  document.querySelectorAll('#mathRoot .m-node.open').forEach((btn) => {
    btn.onclick = () => startMathLevel(+btn.dataset.i);
  });
  SpeechKit.speak('选一个关卡开始吧！');
}

/* ---------- 世界轨占位屏(T5/T6 合入后退役) ---------- */
function showMathWip(level) {
  mathScreen(`
    <div class="m-screen m-wip">
      <div class="m-wip-sign">🚧</div>
      <h1>该玩法建设中</h1>
      <p class="m-sub">${MATH_META[level.family].name}·${mathVariantName(level.family, level.variant)} 很快就开放啦</p>
      <button class="m-btn" id="mWipNext">先玩下一关 ▶</button>
      <button class="m-btn" id="mWipMap">${btnImg('grid')} 回地图</button>
    </div>`);
  SpeechKit.speak('这个场馆还在建设中，先去玩别的吧！');
  document.getElementById('mWipNext').onclick = () => startMathLevel(Math.min(level.i + 1, 99));
  document.getElementById('mWipMap').onclick = showMathMap;
}

/* ---------- 关卡流程: 规则语音 → runner → 结算 ---------- */
function mathKindTag(kind) {
  return kind === 'tutorial' ? ' · 教学关' : kind === 'review' ? ' · 复习' :
      kind === 'challenge' ? ' · 思维挑战' : kind === 'boss' ? ' · 小镇集市' : '';
}

function startMathLevel(i) {
  clearTimeout(mathAutoTimer);
  mathStopRun();
  const level = MATH_LEVELS[i];
  if (!level) {
    showMathMap();
    return;
  }
  if (mathVariantTrack(level.family, level.variant) !== 'screen') {
    showMathWip(level);
    return;
  }
  const meta = MATH_META[level.family];
  const target = level.kind === 'tutorial' ? '随便玩，学会就好！' :
      '目标：正确 ' + (level.kind === 'challenge' ? '80' : '70') + '% 以上通过！';
  mathScreen(`
    <div class="m-screen m-intro">
      <div class="m-progress-line">第 ${i + 1} / 100 关${mathKindTag(level.kind)}</div>
      <div class="m-dim-icon">${meta.icon}</div>
      <h1>${meta.game}</h1>
      <p class="m-sub">${meta.name} · ${mathVariantName(level.family, level.variant)}</p>
      <div class="m-rule-bubble"><div class="m-bubble"><b>${meta.rule}</b></div></div>
      <div class="m-tipbox">💡 ${meta.tip(level.params || {})}</div>
      <div class="m-tipbox">${target}</div>
      <button class="m-start" id="mGoBtn">▶ 开始</button>
    </div>`);
  SpeechKit.speak(meta.rule);
  document.getElementById('mBackBtn').onclick = showMathMap;
  document.getElementById('mGoBtn').onclick = () => beginMathRun(level);
}

function beginMathRun(level) {
  startMathTicker();
  const meta = MATH_META[level.family];
  const kindTag = mathKindTag(level.kind);
  mathScreen(`
    <div class="m-level-head">
      <div class="m-lrule"><span class="m-rule-icon">${meta.icon}</span>
        <span class="m-rule-text">${meta.game} · ${mathVariantName(level.family, level.variant)}${kindTag}</span></div>
      <div class="m-rule-small">${meta.rule}</div>
      <div class="m-progress"><div class="m-progress-bar" id="mProg"></div></div>
    </div>
    <div class="m-area" id="mArea"></div>`);
  document.getElementById('mBackBtn').onclick = () => {
    mathStopRun();
    SpeechKit.cancel();
    showMathMap();
  };
  const areaEl = document.getElementById('mArea');
  const setProg = (k, n) => {
    const bar = document.getElementById('mProg');
    if (bar) bar.style.width = Math.round(k / Math.max(1, n) * 100) + '%';
  };
  if (level.kind === 'boss') {
    runMathBoss(level, areaEl, setProg);
    return;
  }
  mathCtrl = runMathScreen({family: level.family, variant: level.variant, tier: level.tier,
    kind: level.kind, params: level.params, seed: level.i * 7919 + 13}, areaEl, {
    progress: setProg,
    onTrial(t) {
      void t; /* T8 战利品回路挂点(rollMathLoot 逐试次掷骰), 本票不接 */
    },
    end(st) {
      onMathLevelEnd(level, st);
    },
  });
}

/* boss 串联: 按 sections 顺序连跑三小节, world 小节占位跳过(T5/T6 接管);
   聚合 st 按单关口径结算(mathAggStats) */
function runMathBoss(level, areaEl, setProg) {
  const plan = mathBossPlan(level);
  const statsList = [];
  const totalTrials = plan.filter((s) => s.track === 'screen')
      .reduce((a, s) => a + Math.max(1, Math.min(30, (s.params && s.params.trials) || 6)), 0);
  let si = 0;
  let doneTrials = 0;
  let stopped = false;
  function step() {
    if (stopped) return;
    while (si < plan.length && plan[si].track !== 'screen') {
      showToast('该玩法建设中，先跳过这一小节');
      SpeechKit.speak('这个场馆还在建设中，我们去下一个！');
      si++;
    }
    if (si >= plan.length) {
      mathCtrl = null;
      onMathLevelEnd(level, mathAggStats(statsList));
      return;
    }
    const s = plan[si];
    SpeechKit.speak('新挑战：' + MATH_META[s.family].game + '！');
    mathCtrl = runMathScreen({family: s.family, variant: s.variant, tier: s.tier,
      kind: 'challenge', params: s.params, seed: level.i * 7919 + si * 101}, areaEl, {
      progress(k, n) {
        setProg(doneTrials + k, totalTrials);
      },
      onTrial(t) {
        void t; /* T8 挂点(同上) */
      },
      end(st) {
        statsList.push(st);
        doneTrials += st.trials || 0;
        si++;
        mathCtrl = null;
        setTimeout(() => {
          if (!stopped) step();
        }, 400);
      },
    });
  }
  mathBossStop = () => {
    stopped = true;
  };
  step();
}

/* ---------- 结算: 判定/星显/过程表扬/自动续程 ---------- */
function onMathLevelEnd(level, st) {
  mathCtrl = null;
  clearTimeout(mathAutoTimer);
  stopMathTicker();
  const save = loadMathSave();
  const fb = mathBudget();
  if (fb) {
    fb.count(1);
    fb.flush();
  } // 无论通过与否都计入每日额度(防疲劳刷, focus 同款)
  const passed = mathSettleSave(save, level, st, mathTodayStr());
  saveMathSave(save);
  const stars = passed ? mathStars(level, st, mathFamChallengeDone(save, level)) : 0;
  if (passed) {
    delete mathFailCount[level.i];
  } else {
    mathFailCount[level.i] = (mathFailCount[level.i] || 0) + 1;
  }
  const praise = level.kind === 'tutorial' ? '你学会新玩法啦！' :
      (passed ? mathPraiseLine() : mathComfortLine());
  const accPct = Math.round((st.acc || 0) * 100);
  const targetPct = level.kind === 'challenge' ? 80 : 70;
  const moveOn = !passed && (mathFailCount[level.i] || 0) >= 2; // 连败 2 次换路, 防卡死(focus 同款)

  if (passed) {
    const starSpans = [1, 2, 3].map((n) =>
      '<span class="st ' + (n <= stars ? 'on' : '') + '" data-n="' + n + '">⭐</span>').join('');
    mathScreen(`
      <div class="m-screen m-result">
        <div class="m-stars" id="mStars">${starSpans}</div>
        <h1>${level.kind === 'tutorial' ? '学会啦！' : '通过！'}</h1>
        <p class="m-sub">正确 ${accPct}%</p>
        <div class="m-result-bubble"><span class="m-bubble">${praise}</span></div>
        <button class="m-start" id="mNextBtn">继续 ▶</button>
      </div>`);
    SpeechKit.speak(praise);
    [1, 2, 3].forEach((n) => {
      if (n <= stars) {
        setTimeout(() => {
          const el = document.querySelector('#mStars .st[data-n="' + n + '"]');
          if (el) {
            el.classList.add('pop');
            sfx('pick');
          }
        }, 350 * n);
      }
    });
  } else {
    mathScreen(`
      <div class="m-screen m-result">
        <div class="m-stars"></div>
        <h1>很努力了！</h1>
        <p class="m-sub">正确 ${accPct}% · 目标 ${targetPct}%</p>
        <p class="m-sub">${moveOn ? '这关先记住感觉，我们去玩别的，以后再来挑战！' : '我们再试一次，慢慢想 😊'}</p>
        <div class="m-result-bubble"><span class="m-bubble">${praise}</span></div>
        <button class="m-start" id="mNextBtn">${moveOn ? '先玩下一关 ▶' : '再来一次 ↺'}</button>
        <button class="m-btn" id="mBackMap">${btnImg('grid')} 回地图</button>
      </div>`);
    SpeechKit.speak(moveOn ? '你已经很努力了！我们先去玩别的，以后再来挑战这一关。' : '没关系，我们再试一次，慢慢想。');
  }
  const next = () => {
    if (mathLocked()) {
      showMathToday();
      return;
    }
    if (passed) {
      if (level.i >= 99) showMathMap();
      else startMathLevel(level.i + 1);
      return;
    }
    if (moveOn) {
      /* 跳过关按 0 星入账(可回来补星), 前沿照常推进 — 不留死档 */
      const s2 = loadMathSave();
      s2.stars[level.i] = s2.stars[level.i] || 0;
      saveMathSave(s2);
      startMathLevel(Math.min(level.i + 1, 99));
      return;
    }
    startMathLevel(level.i);
  };
  document.getElementById('mNextBtn').onclick = next;
  const backMap = document.getElementById('mBackMap');
  if (backMap) backMap.onclick = showMathMap;
  mathAutoTimer = setTimeout(() => {
    if (document.getElementById('mNextBtn')) next();
  }, 4500);
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
    clearTimeout(mathAutoTimer);
    mathStopRun();
    stopMathTicker();
    SpeechKit.cancel();
    if (mathRoot) mathRoot.style.display = 'none';
  },
});
