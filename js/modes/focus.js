'use strict';
/* ============================================================
   专注训练营模式 — 屏幕流 / 三星 / 每日锁定 / 家长面板
   会话: 进入→今日页→关卡→星级+过程表扬→自动下一关→每日 6 关或 20 分钟锁定
   F6 增: 里程碑工具授予(存档 tools 字段记账 + 全屏仪式)与 🎒 宝物柜
   (工具组从 tools 字段渲染, 其余组从共享背包计数渲染, 点击 TTS 读物品名)
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
  defaults: {unlocked: 0, stars: {}, history: [], tools: []},
  migrate(s, from) { // v0 老形状可能仍带 daily(已迁 daily_budget_save) → 摘除, 与启动迁移幂等
    if (from === 0 && s && s.daily) delete s.daily;
    if (s && !Array.isArray(s.tools)) s.tools = []; // F6: 里程碑工具记账字段(spec 17) 幂等补缺/修形, 只补缺不碰其余字段
    return s;
  },
});
function loadFocusSave() {
  return focusSlot.load();
}
function saveFocusSave(s) {
  focusSlot.save(s);
}

/* ---------- 共享背包(F6 接入, ADR 0002 / F3 核定口径) ----------
   训练营是共享背包的第二个消费方: 进训练营 init() 时 load 一次(双消费方
   共用存档介质, 重进必重读, 探险同款); 训练营只产出不消耗。里程碑工具
   不进背包(选型 B: 容量核定见 docs/focus-revamp-tickets.md F3 备注)——
   记账进训练营存档 tools 字段, 宝物柜工具组从该字段渲染 */
const focusBag = Backpack.mkBackpack();

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
      <button class="f-btn" id="fBagBtn">🎒 宝物柜</button>
      <button class="f-btn" id="fHome2">🏠 回主页</button>
      <button class="f-parent-btn" id="fParentBtn">🔒 家长</button>
    </div>`;
    focusScreen(html);
    document.getElementById('fBagBtn').onclick = showFocusCabinet;
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
    <button class="f-btn" id="fBagBtn">🎒 宝物柜</button>
    <div class="f-dots">${dots}</div>
    <button class="f-parent-btn" id="fParentBtn">🔒 家长</button>
  </div>`;
  focusScreen(html);
  document.getElementById('fStartBtn').onclick = ()=> startFocusLevel(cur);
  document.getElementById('fBagBtn').onclick = showFocusCabinet;
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
  /* F6 里程碑: 越线即授予(历史已落账, focusProgress 可见刚通关的一关);
     记账进 tools 字段(选型 B 不进背包), 仪式排在星屏之后(见 proceed) */
  const award = passed ? focusGrantMilestones(save) : [];

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
  const proceed = () => (award.length ? showFocusAward(award, next) : next()); // 有新授先仪式再续程
  document.getElementById('fNextBtn').onclick = proceed;
  focusAutoTimer = setTimeout(()=>{
    if (document.getElementById('fNextBtn')) proceed();
  }, 4000);
}

/* ---------- 里程碑授予仪式(设计稿 §3 L4) ----------
   unlocked 首次越线 → 全屏一屏一件: iconOf 工具大图 + 喝彩村长 chiefFace('cheer')
   + level 琶音 + TTS 报名; 多件串播(点按/超时进下一屏), 播完回 after() */
function showFocusAward(ids, after) {
  const queue = ids.slice();
  const step = () => {
    const id = queue.shift();
    if (!id) { after(); return; }
    const name = ITEMS[id] ? ITEMS[id].name : '新工具';
    focusScreen(`
      <div class="f-screen f-award">
        <div class="f-award-chief"><img draggable="false" src="${chiefFace('cheer')}" alt="村长爷爷"></div>
        <div class="f-award-tool"><img draggable="false" src="${iconOf(id)}" alt="${name}"></div>
        <h1>你获得了${name}！</h1>
        <p class="f-sub">挖矿越来越厉害啦！</p>
        <button class="f-start" id="fAwardNext">继续 ▶</button>
      </div>`);
    document.getElementById('fBackBtn').onclick = step; // 返回=跳过剩余串播(授予已落账)
    document.getElementById('fAwardNext').onclick = step;
    focusAutoTimer = setTimeout(step, 4500); // TTS 报名+琶音留足时间
    sfx('level');
    SpeechKit.speak('你获得了' + name + '！挖矿越来越厉害啦！');
  };
  step();
}

/* 授予落账: 应授差集并入存档 tools 字段并保存, 返回本次新授(空=无新授)。
   幂等: 已授者被 milestoneDue 差集剔除, 再进训练营不会重授 */
function focusGrantMilestones(save) {
  const due = milestoneDue(focusProgress(save), save.tools);
  for (const id of due) save.tools.push(id);
  if (due.length) saveFocusSave(save);
  return due;
}

/* 存量档一次性补授(F6): 进入训练营时按当前进度追授(仪式串播), 再进今日页 */
function focusBackfillMilestones(after) {
  const due = focusGrantMilestones(loadFocusSave());
  if (due.length) showFocusAward(due, after);
  else after();
}

/* ---------- 宝物柜(设计稿 §3 L5: 收集可见性, 零文字依赖) ----------
   材料/矿物/食物/方块四组从共享背包计数渲染(iconOf 像素图标+数量角标),
   工具组从存档 tools 字段渲染(选型 B: 里程碑工具不占背包槽); 空组不显示;
   点击 TTS 读 ITEMS[id].name; 村长导览(smile) */
const FOCUS_CABINET_GROUPS = [
  {name: '材料', ids: ['log', 'planks', 'stick', 'sapling', 'charcoal', 'bone', 'gunpowder',
    'string', 'slimeball', 'bone_meal', 'clay_ball', 'brick', 'wheat', 'wheat_seeds']},
  {name: '矿物', ids: ['coal', 'iron_ore', 'iron_ingot', 'gold_ore', 'gold_ingot', 'diamond']},
  {name: '食物', ids: ['apple', 'bread', 'rotten_flesh']},
  {name: '工具', tools: true},
  {name: '方块', ids: ['dirt', 'sand', 'cobble', 'stone', 'glass', 'mossy_cobble', 'leaves',
    'bricks', 'stone_bricks', 'torch', 'craft_table', 'furnace', 'tnt']},
];

function focusCabSlot(id, n) { // 柜面一格: 图标+角标(名只进 alt/tooltip 供 TTS 与读屏, 柜面零文字)
  const nm = ITEMS[id] ? ITEMS[id].name : id;
  return `<button class="f-cab-item" data-item="${id}" title="${nm}">
    <img draggable="false" src="${iconOf(id)}" alt="${nm}">${n > 1 ? '<span class="f-cab-badge">×' + n + '</span>' : ''}
  </button>`;
}

function showFocusCabinet() {
  const save = loadFocusSave();
  const sections = FOCUS_CABINET_GROUPS.map((g) => {
    if (g.tools) { // 工具组: 按里程碑表序从 tools 字段渲染(大格)
      const ids = Object.keys(FOCUS_MILESTONES).map(Number).sort((a, b) => a - b)
          .map((k) => FOCUS_MILESTONES[k]).filter((id) => save.tools.includes(id));
      if (!ids.length) return '';
      return `<div class="f-cab-group"><div class="f-cab-title">⛏ ${g.name}</div>
        <div class="f-cab-grid f-cab-tools">${ids.map((id) => focusCabSlot(id, 1)).join('')}</div></div>`;
    }
    const slots = g.ids.map((id) => ({id, n: count(focusBag.inv, id)}))
        .filter((x) => x.n > 0).map((x) => focusCabSlot(x.id, x.n));
    if (!slots.length) return '';
    return `<div class="f-cab-group"><div class="f-cab-title">${g.name}</div>
      <div class="f-cab-grid">${slots.join('')}</div></div>`;
  }).join('');
  focusScreen(`
    <div class="f-screen f-cabinet">
      <div class="f-cab-chief"><img draggable="false" src="${chiefFace('smile')}" alt="村长爷爷">
        <span class="f-cab-hint">点一点，我念给你听</span></div>
      <h1>🎒 宝物柜</h1>
      ${sections || '<p class="f-sub">还没有宝贝，训练赢宝物吧！</p>'}
      <button class="f-btn" id="fCabBack">返回</button>
    </div>`);
  document.getElementById('fCabBack').onclick = showFocusToday;
  document.querySelectorAll('#focusRoot .f-cab-item').forEach((btn)=>{
    btn.onclick = ()=>{
      const it = ITEMS[btn.dataset.item];
      if (it) SpeechKit.speak(it.name);
    };
  });
  SpeechKit.speak(count(focusBag.inv, 'diamond') > 0 ? '哇，这么多钻石！' : '哇，好多宝贝！点一点，我念给你听。');
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
    focusBag.load(); // 共享背包读档(F3 口径: 重进必重读, 探险同款)
    focusBackfillMilestones(showFocusToday); // F6: 存量档按进度一次性补授(仪式串播)后进今日页
  }, // 纯点选全屏 UI: chrome 全关由 kit 默认处理
  cleanup() {
    stopFocusTicker();
    if (focusCtrl) {
      focusCtrl.stop(); focusCtrl = null;
    }
    clearTimeout(focusAutoTimer);
    SpeechKit.cancel();
    if (focusRoot) focusRoot.style.display = 'none';
  },
});
