'use strict';
/* ============================================================
   专注训练营模式 — 屏幕流 / 三星 / 每日锁定 / 家长面板
   会话: 进入→今日页→关卡→星级+过程表扬→自动下一关→每日 6 关或 20 分钟锁定;
   附每日体检(五维连跑→探险家火苗, 计时长不占额度)与魔鬼特训(单维轮换
   挑战档 5 分钟硬顶, 计 2 关额度; 鬼等级双阈进退零扣损) — 决策纯函数在
   js/focus-levels.js, 本文件只做流程装配与应用层文案
============================================================ */

/* ---------- 过程性表扬 / 中性安慰 (夸努力不夸聪明, Mueller & Dweck 1998) ----------
   话术属应用层文案: 范式引擎(focus-paradigms.js)只经全局名调用期取用 */
const FOCUS_PRAISE = [
  '你一直在认真看，真棒！', '你等到了对的时机，好有耐心！', '你刚才特别专注！',
  '你坚持做完啦，真了不起！', '你的小眼睛看得真仔细！', '你一直在努力，进步啦！',
];
const FOCUS_COMFORT = [
  '没关系，我们慢慢来。', '深呼吸，再看仔细一点。', '差一点点啦，再试一次！', '休息一下眼睛，我们继续。',
];
function praiseLine() {
  return FOCUS_PRAISE[Math.floor(Math.random()*FOCUS_PRAISE.length)];
}
function comfortLine() {
  return FOCUS_COMFORT[Math.floor(Math.random()*FOCUS_COMFORT.length)];
}

const FOCUS_SAVE_KEY = 'focus_camp_save';
const focusSlot = SyncDB.slot(FOCUS_SAVE_KEY, {
  defaults: {unlocked: 0, stars: {}, history: [],
    checks: {}, // 每日体检: {日期: {acc, flame}} 滚动 90 天(F8, 设计稿 §8 B3)
    devil: {levels: {}, days: {}}}, // 魔鬼特训: levels={维度: 鬼等级1~10}, days={日期: 当日训况} 滚动 90 天(§8 B8)
  migrate(s, from) { // v0 老形状可能仍带 daily(已迁 daily_budget_save) → 摘除, 与启动迁移幂等
    if (from === 0 && s && s.daily) delete s.daily;
    return s;
  },
});
function loadFocusSave() {
  return focusSlot.load();
}
function saveFocusSave(s) {
  focusSlot.save(s);
}
/* 每日预算(每日关数/时长)记在 js/daily-budget.js 的 focus 预算里(main.js setupBudgets 建立) */
function focusBudget() {
  return (typeof Budgets !== 'undefined' && Budgets) ? Budgets.focus : null;
}
function focusLocked() {
  const b = focusBudget(); return !!(b && b.blocked());
}
/* 通过门槛/三星的判定是纯函数, 已移居 js/focus-levels.js(与关卡数据同层, 可单测) */
const focusFailCount = {}; // 本关连续未通过次数 → 重试自动放宽

/* ---------- 根容器与屏幕 ---------- */
let focusRoot = null; let focusCtrl = null; let focusCurLevel = null;
let focusAutoTimer = 0; let focusTicker = 0; let focusTickT0 = 0;

/* 训练时长入账: 关卡进行中每秒 accrue 实际毫秒并落账 —
   崩溃/关页损失 ≤1 秒(原为关卡结束才入账, 丢整关 2~3 分钟); 菜单/说明页不计(口径不变) */
function startFocusTicker() {
  stopFocusTicker();
  focusTickT0 = Date.now();
  focusTicker = setInterval(()=>{
    const b = focusBudget(); if (!b) return;
    const nowT = Date.now();
    b.accrue(nowT - focusTickT0);
    focusTickT0 = nowT;
    b.flush();
  }, 1000);
}
function stopFocusTicker() {
  if (focusTicker) {
    clearInterval(focusTicker); focusTicker = 0;
  }
}

function ensureFocusRoot() {
  if (focusRoot) return;
  focusRoot = fEl('div');
  focusRoot.id = 'focusRoot';
  document.body.appendChild(focusRoot);
}
function focusScreen(html) {
  clearTimeout(focusAutoTimer);
  focusRoot.innerHTML = '<div class="f-top"><button class="f-back" id="fBackBtn">⬅️</button></div>' + html;
  document.getElementById('fBackBtn').onclick = focusExit;
  return focusRoot;
}
function focusExit() {
  stopFocusTicker();
  if (focusCtrl) {
    focusCtrl.stop(); focusCtrl = null;
  }
  SpeechKit.cancel();
  focusRoot.style.display = 'none';
  overlay.style.display = 'flex';
  showPage('main');
}

/* ---------- 今日页 ---------- */
function showFocusToday() {
  stopFocusTicker();
  const save = loadFocusSave();
  const locked = focusLocked();
  const played = focusBudget() ? focusBudget().spentCount() : 0;
  const total = Object.values(save.stars).reduce((s, x)=>s+x, 0);
  const cur = Math.min(save.unlocked, 99);
  const lv = FOCUS_LEVELS[cur];
  const meta = FOCUS_META[lv.dim];
  const dots = Array.from({length: FOCUS_DAILY_LEVELS}, (_, k)=>
    '<span class="dot '+(k < played?'done':'')+'"></span>').join('');

  let html = '';
  if (locked) {
    html = `
    <div class="f-screen">
      <div class="f-lock">🌙</div>
      <h1>今天的训练完成啦！</h1>
      <p class="f-sub">训练师要休息了，明天怪物们等你来 😊</p>
      <div class="f-dots">${dots}</div>
      <button class="f-btn" id="fHome2">🏠 回主页</button>
      <button class="f-parent-btn" id="fParentBtn">🔒 家长</button>
    </div>`;
    focusScreen(html);
    document.getElementById('fHome2').onclick = focusExit;
    document.getElementById('fParentBtn').onclick = showFocusParentGate;
    return;
  }
  html = `
  <div class="f-screen">
    <div class="f-progress-line">第 ${cur+1} 关 / 100 · ⭐${total}</div>
    <div class="f-dim-icon">${meta.icon}</div>
    <h1>${meta.game}</h1>
    <p class="f-sub">${meta.name}${lv.kind==='review' ? ' · 复习' :
        (lv.kind==='tutorial' ? ' · 教学' : (lv.kind==='master' ? ' · 大师考验' : ''))}</p>
    <button class="f-start" id="fStartBtn">▶ 开始训练</button>
    ${focusExtrasHtml(save)}
    <div class="f-dots">${dots}</div>
    <button class="f-parent-btn" id="fParentBtn">🔒 家长</button>
  </div>`;
  focusScreen(html);
  document.getElementById('fStartBtn').onclick = ()=> startFocusLevel(cur);
  wireFocusExtras();
  document.getElementById('fParentBtn').onclick = showFocusParentGate;
}

/* ---------- 本关说明(说明书归各范式自带, 这里只剩 kind 特判与查表) ---------- */
function focusTip(level) {
  if (level.kind==='master') return '五个小游戏连着玩：瞭望塔、挖矿、排队、闪闪光、听指挥。全部完成就是专注大师！';
  if (level.kind==='tutorial') return '新手教学：先看一遍演示，再跟着做，很轻松！';
  return FOCUS_META[level.dim].tip(level.params || {});
}

/* ---------- 关卡 ---------- */
function startFocusLevel(i) {
  const level = FOCUS_LEVELS[i];
  focusCurLevel = level;
  const meta = FOCUS_META[level.dim];
  const kindNote = level.kind==='tutorial' ? ' · 教学关' : level.kind==='review' ? ' · 复习关' :
                 level.kind==='master' ? ' · 大师考验' : '';
  focusScreen(`
    <div class="f-screen f-intro">
      <div class="f-progress-line">第 ${i+1} / 100 关${kindNote}</div>
      <div class="f-dim-icon">${meta.icon}</div>
      <h1>${meta.game}</h1>
      <p class="f-sub">${meta.name}</p>
      <div class="f-rulebox">🎯 ${meta.rule}</div>
      <div class="f-tipbox">💡 ${focusTip(level)}${level.kind!=='tutorial' ? ' 目标：正确 70% 以上通过！' : ''}</div>
      <button class="f-start" id="fGoBtn">▶ 开始</button>
    </div>`);
  SpeechKit.speak(meta.rule);
  document.getElementById('fGoBtn').onclick = ()=> beginFocusRun(level);
}

function beginFocusRun(level) {
  startFocusTicker();
  const meta = FOCUS_META[level.dim];
  const kindTag = level.kind==='tutorial' ? '· 教学' :
      level.kind==='review' ? '· 复习' :
      level.kind==='master' ? '· 大师考验' : '';
  focusScreen(`
    <div class="f-level-head">
      <div class="f-rule"><span class="f-rule-icon">${meta.icon}</span>
        <span class="f-rule-text">${meta.game} ${kindTag}</span></div>
      <div class="f-rule-small">${meta.rule}</div>
      <div class="f-progress"><div class="f-progress-bar" id="fProg"></div></div>
    </div>
    <div class="f-area" id="fArea"></div>`);
  document.getElementById('fBackBtn').onclick = showFocusToday;
  focusCtrl = runFocusLevel(level, document.getElementById('fArea'), {
    progress(k, n) {
      const bar = document.getElementById('fProg');
      if (bar) bar.style.width = Math.round(k/Math.max(1, n)*100) + '%';
    },
    showRule(dim) {
      SpeechKit.speak(FOCUS_META[dim || level.dim].rule);
    },
    end(st) {
      onFocusLevelEnd(level, st);
    },
  }, focusFailCount[level.i] || 0); // 只报失败次数, 重试放宽政策在引擎(mkAdapt)一处
}

function onFocusLevelEnd(level, st) {
  focusCtrl = null;
  stopFocusTicker();
  const passed = focusPassed(level, st);
  const stars = passed ? focusStars(level, st) : 0;
  const save = loadFocusSave();
  if (passed) {
    save.unlocked = Math.max(save.unlocked, Math.min(level.i+1, 99));
    if (level.kind !== 'tutorial') {
      save.stars[level.i] = Math.max(save.stars[level.i]||0, stars);
    }
    delete focusFailCount[level.i];
  } else {
    focusFailCount[level.i] = (focusFailCount[level.i]||0) + 1;
  }
  const fb = focusBudget();
  if (fb) {
    fb.count(1); fb.flush();
  } // 无论通过与否都计入每日额度(防疲劳刷)
  save.history.push({d: budgetDateStr(Date.now()), i: level.i, dim: level.dim, kind: level.kind,
    acc: Math.round(st.acc*100), mrt: Math.round(st.mrt), trials: st.trials, stars, passed});
  if (save.history.length > 400) save.history.splice(0, save.history.length-400);
  saveFocusSave(save);

  if (passed) {
    focusScreen(`
      <div class="f-screen">
        <div class="f-stars" id="fStars">
          ${[1, 2, 3].map((n)=>'<span class="st '+(n<=stars?'on':'')+'" data-n="'+n+'">⭐</span>').join('')}
        </div>
        <h1>${level.kind==='tutorial' ? '学会啦！' : '通过！'}</h1>
        <p class="f-sub">正确 ${Math.round(st.acc*100)}%</p>
        <button class="f-start" id="fNextBtn">继续 ▶</button>
      </div>`);
    SpeechKit.speak(level.kind==='tutorial' ? '你学会新游戏啦！' : praiseLine());
    [1, 2, 3].forEach((n)=>{
      if (n<=stars) {
        setTimeout(()=>{
          const el = document.querySelector('#fStars .st[data-n="'+n+'"]');
          if (el) {
            el.classList.add('pop'); sfx('pick');
          }
        }, 350*n);
      }
    });
  } else {
    const moveOn = (focusFailCount[level.i]||0) >= 2; // 连败 2 次后换下一个游戏, 避免整段时间卡死在同一关
    focusScreen(`
      <div class="f-screen">
        <div class="f-stars"></div>
        <h1>很努力了！</h1>
        <p class="f-sub">正确 ${Math.round(st.acc*100)}% · 目标 70%</p>
        <p class="f-sub">${moveOn ? '这关先记住感觉，我们去玩别的游戏，以后再来挑战！' : '我们再试一次，这次会简单一点点 😊'}</p>
        <button class="f-start" id="fNextBtn">${moveOn ? '下一个游戏 ▶' : '再来一次 ↺'}</button>
      </div>`);
    SpeechKit.speak(moveOn ? '你已经很努力了！我们先去玩别的游戏，以后再来挑战这一关。' : '你刚才很努力！我们再来一次，这次会简单一点点。');
  }
  const next = ()=>{
    if (focusLocked()) showFocusToday();
    else if (!passed && (focusFailCount[level.i]||0) < 2) startFocusLevel(level.i);
    else if (level.i >= 99) showFocusToday();
    else startFocusLevel(level.i+1);
  };
  document.getElementById('fNextBtn').onclick = next;
  focusAutoTimer = setTimeout(()=>{
    if (document.getElementById('fNextBtn')) next();
  }, 4000);
}

/* ---------- 每日体检 · 魔鬼特训 (F8, 设计稿 §8 B3/B8) ----------
   体检: FOCUS_CHECK_PARAMS 五维连跑约 90 秒 → 探险家火苗三档; 计入时长、
   不占关数额度; 当日一次, 做完入口消失; 只与自己近 7 天均值比且只显变亮。
   魔鬼特训: 单维按日轮换的挑战档(当前档+2)连续小节, 5 分钟硬顶到点当前
   小节打完即强制结束; 计 2 关额度 + 计入时长; 当日一次; 鬼等级 1~10 双阈
   进退, 失败零扣损/零重置(红线); 记录滚动 90 天。决策纯函数在
   js/focus-levels.js(可单测), 这里只做流程装配与文案(应用层话术同 FOCUS_PRAISE) */
const FOCUS_FLAME_NAME = {1: '小火苗', 2: '中火苗', 3: '大火苗'};
const FOCUS_FLAME_TEXT = {
  1: '今天慢慢来，火苗明天会长大的', // 小火苗配中性温暖文案(不与任何标准比较)
  2: '火苗亮亮的，精神不错！',
  3: '哇，大火苗亮堂堂！',
};

/* 今日页附加入口行: 体检(当日未做才显示) + 魔鬼特训(当日未训: 可用或禁用态) */
function focusExtrasHtml(save) {
  const today = budgetDateStr(Date.now());
  const parts = [];
  if (focusCheckEntry(save.checks, today)) {
    parts.push('<button class="f-extra-btn f-check-btn" id="fCheckBtn">🔥 今日体检</button>');
  }
  const fb = focusBudget();
  const de = devilEntry(save.devil, today, fb ? fb.spentCount() : 0, fb ? fb.capCount() : FOCUS_DAILY_LEVELS);
  if (de.reason !== 'done') {
    parts.push('<button class="f-extra-btn f-devil-btn" id="fDevilBtn"' +
        (de.open ? '' : ' disabled title="今天的关卡额度不够啦，明天再来！"') + '>👹 魔鬼特训</button>');
  }
  return parts.length ? '<div class="f-extra-row">' + parts.join('') + '</div>' : '';
}
function wireFocusExtras() {
  const cb = document.getElementById('fCheckBtn');
  if (cb) cb.onclick = startFocusCheck;
  const db = document.getElementById('fDevilBtn');
  if (db && !db.disabled) db.onclick = startFocusDevil; // 禁用态不挂点击(余额<2)
}

/* ----- 每日体检流程 ----- */
function startFocusCheck() {
  focusScreen(`
    <div class="f-screen f-intro">
      <div class="f-chief"><img src="${chiefFace('smile')}" draggable="false" alt="村长"></div>
      <h1>🔥 今日体检</h1>
      <p class="f-sub">五个小游戏各玩一小会儿，看看今天的探险家火苗有多亮！</p>
      <div class="f-rulebox">约 90 秒 · 不计关卡次数，放轻松就好</div>
      <button class="f-start" id="fCheckGo">▶ 开始体检</button>
    </div>`);
  SpeechKit.speak('今日体检！五个小游戏各玩一小会儿，看看你的火苗有多亮！');
  document.getElementById('fCheckGo').onclick = beginFocusCheck;
}

function beginFocusCheck() {
  startFocusTicker(); // 计入时长预算(每秒 accrue); 不调 count — 体检不占关数额度(B3)
  focusScreen(`
    <div class="f-level-head">
      <div class="f-rule"><span class="f-rule-icon">🔥</span><span class="f-rule-text">今日体检</span></div>
      <div class="f-rule-small">放轻松，做你自己就好</div>
      <div class="f-progress"><div class="f-progress-bar" id="fProg"></div></div>
    </div>
    <div class="f-area" id="fArea"></div>`);
  document.getElementById('fBackBtn').onclick = ()=>{ // 中途退出: 不落账, 入口保留可重做(体检零压力)
    if (focusCtrl) {
      focusCtrl.stop(); focusCtrl = null;
    }
    showFocusToday();
  };
  focusCtrl = runFocusLevel({kind: 'check', dim: 'switch', sections: FOCUS_CHECK_PARAMS},
      document.getElementById('fArea'), {
    progress(k, n) {
      const bar = document.getElementById('fProg');
      if (bar) bar.style.width = Math.round(k/Math.max(1, n)*100) + '%';
    },
    showRule(dim) {
      SpeechKit.speak(FOCUS_META[dim].rule);
    },
    end(st) {
      onCheckEnd(st);
    },
  }, 0);
}

function onCheckEnd(st) {
  focusCtrl = null;
  stopFocusTicker();
  const save = loadFocusSave();
  const today = budgetDateStr(Date.now());
  const base = checkBaseline(save.checks, today); // 只与自己近 7 天均值比
  const res = focusFlame(st.acc, base);
  save.checks = trimFocusLog(save.checks, today, FOCUS_LOG_KEEP_DAYS);
  save.checks[today] = {acc: Math.round(st.acc*100)/100, flame: res.flame};
  saveFocusSave(save);
  const line = res.brighter ? '比上次更亮啦！' : FOCUS_FLAME_TEXT[res.flame]; // 不显示回落(诚实口径)
  focusScreen(`
    <div class="f-screen">
      <div class="f-chief"><img src="${chiefFace(res.brighter ? 'cheer' : 'smile')}" draggable="false" alt="村长"></div>
      <div class="f-flame"><img class="f-flame-sway" src="${flameIcon(res.flame)}"
          draggable="false" alt="${FOCUS_FLAME_NAME[res.flame]}"></div>
      <h1>${FOCUS_FLAME_NAME[res.flame]}</h1>
      <p class="f-sub">${line}</p>
      <button class="f-start" id="fCheckHome">回到今天</button>
    </div>`);
  SpeechKit.speak(line);
  if (res.brighter) sfx('level'); // 喝彩只在变亮时(村长喝彩脸同上), 回落静默
  document.getElementById('fCheckHome').onclick = showFocusToday;
}

/* ----- 魔鬼特训流程 ----- */
let devilRun = null; // 进行中的特训会话(⬅️ 结算与模式清理互斥用)

function startFocusDevil() {
  const save = loadFocusSave();
  const dim = devilDimFor(budgetDateStr(Date.now())); // 维度按日轮换(纯函数, 同一天恒定)
  const meta = FOCUS_META[dim];
  const tier = devilTierFor(dim, save.unlocked); // 该维当前档 → 挑战档 = +2 封顶 19
  focusScreen(`
    <div class="f-screen f-intro f-devil-zone">
      <div class="f-chief"><img src="${chiefFace('devil')}" draggable="false" alt="鬼村长"></div>
      <h1>👹 魔鬼特训</h1>
      <p class="f-sub">今天轮到：${meta.icon} ${meta.game} · ${meta.name}</p>
      <div class="f-rulebox">魔鬼特训，5 分钟，准备好了吗！</div>
      <div class="f-tipbox">比平时难一点点，要用 2 关的额度。输了也不扣任何东西，鬼等级永远不会归零！</div>
      <button class="f-start" id="fDevilGo">🔥 我准备好了！</button>
    </div>`);
  SpeechKit.speak('魔鬼特训，5 分钟，准备好了吗！今天轮到' + meta.game + '！');
  document.getElementById('fDevilGo').onclick = ()=> beginDevilRun(dim, tier);
}

function beginDevilRun(dim, tier) {
  startFocusTicker(); // 时长入账照常(每秒 accrue)
  const t0 = Date.now();
  focusScreen(`
    <div class="f-level-head f-devil-head">
      <div class="f-rule"><span class="f-rule-icon f-devil-ico"><img src="${chiefFace('devil')}"
          draggable="false" alt="鬼村长"></span>
        <span class="f-rule-text">👹 魔鬼特训 · ${FOCUS_META[dim].game}</span></div>
      <div class="f-rule-small">${FOCUS_META[dim].rule}</div>
      <div class="f-devil-timer" id="fDevilTimer">⏱ 5:00</div>
      <div class="f-progress"><div class="f-progress-bar f-devil-bar" id="fProg"></div></div>
    </div>
    <div class="f-area f-devil-area" id="fArea"></div>`);
  document.getElementById('fBackBtn').onclick = ()=> settleDevilRun(true); // 中途退出: 打过即结算(中断不划算但零扣损)
  const run = {
    dim, tier,
    agg: {trials: 0, correct: 0, rts: [], maxStreakErr: 0, valveCount: 0, goTrials: 0, hits: 0, rounds: 0},
    stopped: false, deadlineHit: false, deadlineId: 0, tickId: 0,
  };
  devilRun = run;
  /* 5 分钟硬顶: 到点只立标志, 不打断 — 当前小节打完(end 回调)才强制结束(B8) */
  run.deadlineId = setTimeout(()=>{ run.deadlineHit = true; }, FOCUS_DEVIL_TIME_MS);
  run.tickId = setInterval(()=>{ // 倒计时显示 + 时间进度条; 结算屏切走后自愈退出
    const el = document.getElementById('fDevilTimer');
    if (!el) {
      clearInterval(run.tickId); return;
    }
    const left = Math.max(0, FOCUS_DEVIL_TIME_MS - (Date.now() - t0));
    el.textContent = left > 0 ?
        '⏱ ' + Math.floor(left/60000) + ':' + String(Math.floor(left%60000/1000)).padStart(2, '0') : '⏱ 时间到！';
    const bar = document.getElementById('fProg');
    if (bar) bar.style.width = Math.min(100, (Date.now() - t0)/FOCUS_DEVIL_TIME_MS*100) + '%';
  }, 500);
  devilRound(run, t0);
}

/* 一轮 = 该维度挑战档的一整小节(引擎自带 mkAdapt 阶梯与挫败阀, 失败零扣损);
   时间未到就连续开下一轮 — 鬼训练同款 5 分钟连续训练块 */
function devilRound(run, t0) {
  if (run.stopped) return;
  const params = devilParams(run.dim, run.tier);
  focusCtrl = runFocusLevel({kind: 'normal', dim: run.dim, params},
      document.getElementById('fArea'), {
    progress() {}, // 进度条由 5 分钟时间驱动, 不按试次
    showRule() {
      SpeechKit.speak(FOCUS_META[run.dim].rule);
    },
    end(st) {
      run.agg.trials += st.trials; run.agg.correct += st.correct;
      run.agg.rts.push(...st.rts);
      run.agg.goTrials += st.goTrials||0; run.agg.hits += st.hits||0;
      run.agg.maxStreakErr = Math.max(run.agg.maxStreakErr, st.maxStreakErr);
      run.agg.valveCount += st.valveCount;
      run.agg.rounds++;
      if (run.stopped) return;
      if (run.deadlineHit || Date.now() - t0 >= FOCUS_DEVIL_TIME_MS) settleDevilRun(false); // 到点: 小节打完即止
      else devilRound(run, t0);
    },
  }, 0);
}

/* 结算/中断统一入口: manual=孩子按 ⬅️ 中途退出。打过 ≥1 小节即算当日已训
   (计 2 关额度 + 当日锁定); 一节没打完就退出: 不计费不落账(入口保留) */
function settleDevilRun(manual) {
  const run = devilRun;
  if (!run || run.stopped) return;
  run.stopped = true;
  clearTimeout(run.deadlineId);
  clearInterval(run.tickId);
  devilRun = null;
  if (focusCtrl) {
    focusCtrl.stop(); focusCtrl = null; // 丢弃进行中的小节(其 end 不再触发)
  }
  if (run.agg.rounds < 1) {
    showFocusToday(); return; // 一节都没打完: 不计费不落账
  }
  stopFocusTicker();
  const save = loadFocusSave();
  const today = budgetDateStr(Date.now());
  const cur = save.devil.levels[run.dim] || 1;
  const acc = run.agg.trials ? run.agg.correct/run.agg.trials : 0;
  const next = run.agg.trials ? devilStep(cur, acc) : cur; // 零试次兜底: 等级不动
  save.devil.levels[run.dim] = next;
  save.devil.days = trimFocusLog(save.devil.days, today, FOCUS_LOG_KEEP_DAYS);
  save.devil.days[today] = {dim: run.dim, acc: Math.round(acc*100), lv: next};
  saveFocusSave(save);
  const fb = focusBudget();
  if (fb) {
    fb.count(2); fb.flush(); // 计 2 关额度(时长已由 ticker 每秒入账)
  }
  const meta = FOCUS_META[run.dim];
  const up = next > cur;
  const down = next < cur;
  const line = up ? '鬼村长瞪大眼睛：好厉害！升到 ' + next + ' 级啦！' :
      down ? '鬼村长坏笑：下次再来！' : // 降级文案中性(不渲染失败感)
      '鬼村长点点头：稳稳的 ' + next + ' 级，下次再来！';
  focusScreen(`
    <div class="f-screen f-devil-zone">
      <div class="f-chief"><img src="${chiefFace('devil')}" draggable="false" alt="鬼村长"></div>
      <h1>魔鬼特训完成！</h1>
      <p class="f-sub">${meta.icon} ${meta.game} · 鬼等级 Lv.${next}</p>
      <p class="f-sub">${line}</p>
      <div class="f-devil-stamp"><img src="${stampIcon('devil')}" draggable="false" alt="鬼图章"></div>
      <button class="f-start" id="fDevilHome">回到今天</button>
    </div>`);
  SpeechKit.speak(up ? '好厉害！鬼等级升到' + next + '级啦！' : '鬼村长说，下次再来！');
  if (up) sfx('level');
  /* 通关鬼图章此处仅渲染观感; 落账进 stamps 日历由 F7 图章工单接管(其未并入
     feature/focus-revamp, 集成时从 devil.days 派生当日特殊章即可) */
  document.getElementById('fDevilHome').onclick = showFocusToday;
}

/* 模式清理用的静默终止: 不弹结算屏不计费(cleanup 路径与可见结算区分);
   静默放弃 = 未落账未计费, 无额度套利空间 */
function abortDevilRun() {
  const run = devilRun;
  if (!run) return;
  run.stopped = true;
  clearTimeout(run.deadlineId);
  clearInterval(run.tickId);
  devilRun = null;
}

/* ---------- 家长面板 ---------- */
function showFocusParentGate() {
  const a = 5 + Math.floor(Math.random()*5); const b = 5 + Math.floor(Math.random()*5);
  const ans = a + b;
  const opts = [ans, ans + 1 + Math.floor(Math.random()*3), Math.max(2, ans - 1 - Math.floor(Math.random()*3))]
      .sort(()=>Math.random()-0.5);
  focusScreen(`
    <div class="f-screen">
      <h1>家长入口</h1>
      <p class="f-sub">请回答：${a} + ${b} = ?</p>
      <div class="f-gate-row">${opts.map((o)=>'<button class="f-btn" data-a="'+o+'">'+o+'</button>').join('')}</div>
    </div>`);
  document.querySelectorAll('#focusRoot .f-gate-row button').forEach((btn)=>{
    btn.onclick = ()=>{
 parseInt(btn.dataset.a, 10)===ans ? showFocusParent() : showFocusToday();
    };
  });
}

function showFocusParent() {
  const save = loadFocusSave();
  const fb = focusBudget();
  const total = Object.values(save.stars).reduce((s, x)=>s+x, 0);
  const mins = Math.round((fb ? fb.spentMs() : 0)/60000);
  const played = fb ? fb.spentCount() : 0;
  const dims = FOCUS_DIMS;
  const perDim = dims.map((d)=>{
    const h = save.history.filter((x)=>x.dim===d).slice(-20);
    const acc = h.length ? Math.round(h.reduce((s, x)=>s+x.acc, 0)/h.length) : null;
    const mrt = h.length ? Math.round(h.reduce((s, x)=>s+x.mrt, 0)/h.length) : null;
    return {d, n: h.length, acc, mrt, h};
  });
  function spark(h) { // 迷你正确率折线(SVG)
    if (h.length < 2) return '<span class="f-nodata">数据不足</span>';
    const W=120; const H=36;
    const pts = h.map((x, k)=>(k*(W/(h.length-1))).toFixed(1)+','+(H-2-(H-6)*x.acc/100).toFixed(1)).join(' ');
    return `<svg width="${W}" height="${H}" class="f-spark">
        <polyline points="${pts}" fill="none" stroke="#7cfc00" stroke-width="2"/></svg>`;
  }
  focusScreen(`
    <div class="f-screen f-parent">
      <h1>家长面板</h1>
      <div class="f-stat-row">
        <div class="f-stat">今日 <b>${played}</b>/${FOCUS_DAILY_LEVELS} 关 · <b>${mins}</b> 分钟</div>
        <div class="f-stat">累计 <b>${save.unlocked+1}</b>/100 关 · ⭐${total}</div>
      </div>
      <table class="f-table">
        <tr><th>维度</th><th>练习次数</th><th>平均正确率</th><th>平均反应</th><th>近期趋势</th></tr>
        ${perDim.map((p)=>`<tr><td>${FOCUS_META[p.d].icon} ${FOCUS_META[p.d].name}</td>
          <td>${p.n}</td><td>${p.acc===null?'—':p.acc+'%'}</td>
          <td>${p.mrt===null?'—':(p.mrt/1000).toFixed(1)+'s'}</td><td>${spark(p.h)}</td></tr>`).join('')}
      </table>
      <div class="f-note">
        本模式是注意力技能的<b>结构化练习</b>(持续警觉/抑制控制/干扰控制/视空记忆/规则切换),
        不用于诊断或治疗,不宣称提升智力或成绩(远迁移证据不足, Melby-Lervåg 2016)。
        6 岁儿童的注意力本身随年龄快速发育,偶尔分心是正常的;
        如在<b>家庭和学校等多个场景</b>持续存在困难并影响生活,请咨询儿科医生(NIMH 指引)。
      </div>
      <div class="f-btn-row">
        <button class="f-btn" id="fCsvBtn">📄 导出记录 CSV</button>
        <button class="f-btn danger" id="fResetBtn">↺ 重置进度</button>
        <button class="f-btn" id="fBackToday">返回</button>
      </div>
    </div>`);
  document.getElementById('fBackToday').onclick = showFocusToday;
  document.getElementById('fCsvBtn').onclick = ()=>{
    const rows = [['日期', '关卡', '轮次', '游戏', '类型', '通过', '正确率%', '反应中位数ms', '试次数', '星级']];
    for (const h of save.history) {
      const lv = FOCUS_LEVELS[h.i] || {stage: 0};
      rows.push([h.d, h.i+1, lv.stage, FOCUS_META[h.dim] ? FOCUS_META[h.dim].name : h.dim,
        h.kind, h.passed===false ? '否' : '是', h.acc, h.mrt, h.trials, h.stars]);
    }
    const csv = '\uFEFF' + rows.map((r)=>r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
    a.download = '专注训练营记录.csv';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  };
  ModeKit.confirmBtn(document.getElementById('fResetBtn'), {
    label: '↺ 重置进度', confirm: '⚠ 再点一次确认',
    onConfirm() {
      focusSlot.reset();
      const fb2 = focusBudget();
      if (fb2) fb2.reset(); // 旧行为保持: 重置进度同时清当日额度
      showToast('训练进度已重置', 1800);
      showFocusParent();
    },
  });
}

/* ---------- 模式对象 ---------- */
const FocusMode = mkMode({
  id: 'focus',
  init() {
    ensureFocusRoot();
    focusRoot.style.display = 'block';
    overlay.style.display = 'none';
    showFocusToday(); // 纯点选全屏 UI: chrome 全关由 kit 默认处理
  },
  cleanup() {
    stopFocusTicker();
    abortDevilRun(); // 魔鬼特训静默终止(不弹结算屏, 见函数注释)
    if (focusCtrl) {
      focusCtrl.stop(); focusCtrl = null;
    }
    clearTimeout(focusAutoTimer);
    SpeechKit.cancel();
    if (focusRoot) focusRoot.style.display = 'none';
  },
});
