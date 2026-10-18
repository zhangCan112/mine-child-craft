"use strict";
/* ============================================================
   专注训练营模式 — 屏幕流 / 三星 / 每日锁定 / 家长面板
   会话: 进入→今日页→关卡→星级+过程表扬→自动下一关→每日 6 关或 20 分钟锁定
============================================================ */

const FOCUS_SAVE_KEY = 'focus_camp_save';

function loadFocusSave(){
  try{
    const s = JSON.parse(SyncDB.get(FOCUS_SAVE_KEY));
    if(s && typeof s.unlocked==='number')
      return { unlocked:s.unlocked, stars:s.stars||{},
               history:Array.isArray(s.history)?s.history:[] };
  }catch(e){}
  return { unlocked:0, stars:{}, history:[] };
}
function saveFocusSave(s){
  try{ SyncDB.set(FOCUS_SAVE_KEY, JSON.stringify(s)); }catch(e){}
}
/* 每日预算(每日关数/时长)记在 js/daily-budget.js 的 focus 预算里(main.js setupBudgets 建立) */
function focusBudget(){ return (typeof Budgets !== 'undefined' && Budgets) ? Budgets.focus : null; }
function focusLocked(){ const b = focusBudget(); return !!(b && b.blocked()); }
/* 通过门槛(科学标准): 正确率≥70%(自适应训练区下界, EndeavorRx 同款目标带)
   警觉/抑制类另需命中率≥60% (防止不动手靠"正确拒斥"混过) */
function focusPassed(level, st){
  if(level.kind === 'tutorial') return true;
  if(st.acc < 0.70) return false;
  if((level.dim==='cpt' || level.dim==='gonogo') && st.hitRate !== undefined && st.hitRate < 0.6)
    return false;
  return true;
}
/* 三星:⭐通过 ⭐⭐优秀≥85% ⭐⭐⭐专注之星≥95%且无连续3错 (仅在通过时) */
function focusStars(level, st){
  if(level.kind === 'tutorial') return 0;
  let s = 1;
  if(st.acc >= 0.85) s++;
  if(st.acc >= 0.95 && st.maxStreakErr < 3) s++;
  return s;
}
const focusFailCount = {};                     // 本关连续未通过次数 → 重试自动放宽

/* ---------- 根容器与屏幕 ---------- */
let focusRoot = null, focusCtrl = null, focusCurLevel = null;
let focusAutoTimer = 0, focusTicker = 0, focusTickT0 = 0;

/* 训练时长入账: 关卡进行中每秒 accrue 实际毫秒并落账 —
   崩溃/关页损失 ≤1 秒(原为关卡结束才入账, 丢整关 2~3 分钟); 菜单/说明页不计(口径不变) */
function startFocusTicker(){
  stopFocusTicker();
  focusTickT0 = Date.now();
  focusTicker = setInterval(()=>{
    const b = focusBudget(); if(!b) return;
    const nowT = Date.now();
    b.accrue(nowT - focusTickT0);
    focusTickT0 = nowT;
    b.flush();
  }, 1000);
}
function stopFocusTicker(){
  if(focusTicker){ clearInterval(focusTicker); focusTicker = 0; }
}

function ensureFocusRoot(){
  if(focusRoot) return;
  focusRoot = fEl('div');
  focusRoot.id = 'focusRoot';
  document.body.appendChild(focusRoot);
}
function focusScreen(html){
  clearTimeout(focusAutoTimer);
  focusRoot.innerHTML = '<div class="f-top"><button class="f-back" id="fBackBtn">⬅️</button></div>' + html;
  document.getElementById('fBackBtn').onclick = focusExit;
  return focusRoot;
}
function focusExit(){
  stopFocusTicker();
  if(focusCtrl){ focusCtrl.stop(); focusCtrl = null; }
  try{ if(typeof speechSynthesis!=='undefined') speechSynthesis.cancel(); }catch(e){}
  focusRoot.style.display = 'none';
  overlay.style.display = 'flex';
  showPage('main');
}

/* ---------- 今日页 ---------- */
function showFocusToday(){
  stopFocusTicker();
  const save = loadFocusSave();
  const locked = focusLocked();
  const played = focusBudget() ? focusBudget().spentCount() : 0;
  const total = Object.values(save.stars).reduce((s,x)=>s+x,0);
  const cur = Math.min(save.unlocked, 99);
  const lv = FOCUS_LEVELS[cur];
  const meta = FOCUS_META[lv.dim];
  const dots = Array.from({length:FOCUS_DAILY_LEVELS}, (_,k)=>
    '<span class="dot '+(k < played?'done':'')+'"></span>').join('');

  let html = '';
  if(locked){
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
    <p class="f-sub">${meta.name}${lv.kind==='review'?' · 复习':(lv.kind==='tutorial'?' · 教学':(lv.kind==='master'?' · 大师考验':''))}</p>
    <button class="f-start" id="fStartBtn">▶ 开始训练</button>
    <div class="f-dots">${dots}</div>
    <button class="f-parent-btn" id="fParentBtn">🔒 家长</button>
  </div>`;
  focusScreen(html);
  document.getElementById('fStartBtn').onclick = ()=> startFocusLevel(cur);
  document.getElementById('fParentBtn').onclick = showFocusParentGate;
}

/* ---------- 本关说明(按参数自动生成) ---------- */
function focusTip(level){
  const p = level.params || {};
  if(level.kind==='master') return '五个小游戏连着玩：瞭望塔、挖矿、排队、闪闪光、听指挥。全部完成就是专注大师！';
  if(level.kind==='tutorial') return '新手教学：先看一遍演示，再跟着做，很轻松！';
  switch(level.dim){
    case 'cpt':
      if(p.similar) return '小心！绿宝石长得像钻石，看清楚了再点！';
      return '矿灯闪得' + (p.isi < 1150 ? '很快' : '比较快') + '，钻石出现得不多，眼睛要一直盯着。';
    case 'gonogo':
      if(p.disguised) return 'TNT 会变成绿宝石的样子混进来！手别太快，看清楚再挖。';
      return '钻石变少、TNT 变多了，忍住不碰 TNT 才能拿星星。';
    case 'flanker':
      return '队伍变成 ' + p.len + ' 只，两边捣乱的苦力怕' + (p.congruentRate < 0.6 ? '很多' : '不少') + '。记住：只看中间那只！';
    case 'corsi':
      return '要记住 ' + p.len + ' 个钻石亮的顺序' + (p.grid===16 ? '，格子也变成 4×4 了' : '') + '。';
    case 'switch':
      return (p.rules===3 ? '现在有三种旗子：颜色、材质、大小。' : '两种旗子：颜色和材质。')
        + '旗子大约每 ' + p.switchEvery + ' 次换一次，盯紧旗子！';
  }
  return '';
}

/* ---------- 关卡 ---------- */
function startFocusLevel(i){
  const level = FOCUS_LEVELS[i];
  focusCurLevel = level;
  const meta = FOCUS_META[level.dim];
  const kindNote = level.kind==='tutorial' ? ' · 教学关' : level.kind==='review' ? ' · 复习关'
                 : level.kind==='master' ? ' · 大师考验' : '';
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
  focusSpeak(meta.rule);
  document.getElementById('fGoBtn').onclick = ()=> beginFocusRun(level);
}

function beginFocusRun(level){
  startFocusTicker();
  const meta = FOCUS_META[level.dim];
  const kindTag = level.kind==='tutorial' ? '· 教学' : level.kind==='review' ? '· 复习' : level.kind==='master' ? '· 大师考验' : '';
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
    progress(k, n){
      const bar = document.getElementById('fProg');
      if(bar) bar.style.width = Math.round(k/Math.max(1,n)*100) + '%';
    },
    showRule(dim){ focusSpeak(FOCUS_META[dim || level.dim].rule); },
    end(st){ onFocusLevelEnd(level, st); }
  }, 1 + Math.min(0.4, 0.12 * (focusFailCount[level.i] || 0)));   // 重试自动放宽 12%/次
}

function onFocusLevelEnd(level, st){
  focusCtrl = null;
  stopFocusTicker();
  const passed = focusPassed(level, st);
  const stars = passed ? focusStars(level, st) : 0;
  const save = loadFocusSave();
  if(passed){
    save.unlocked = Math.max(save.unlocked, Math.min(level.i+1, 99));
    if(level.kind !== 'tutorial')
      save.stars[level.i] = Math.max(save.stars[level.i]||0, stars);
    delete focusFailCount[level.i];
  } else {
    focusFailCount[level.i] = (focusFailCount[level.i]||0) + 1;
  }
  const fb = focusBudget();
  if(fb){ fb.count(1); fb.flush(); }              // 无论通过与否都计入每日额度(防疲劳刷)
  save.history.push({ d: budgetDateStr(Date.now()), i: level.i, dim: level.dim, kind: level.kind,
    acc: Math.round(st.acc*100), mrt: Math.round(st.mrt), trials: st.trials, stars, passed });
  if(save.history.length > 400) save.history.splice(0, save.history.length-400);
  saveFocusSave(save);

  if(passed){
    focusScreen(`
      <div class="f-screen">
        <div class="f-stars" id="fStars">
          ${[1,2,3].map(n=>'<span class="st '+(n<=stars?'on':'')+'" data-n="'+n+'">⭐</span>').join('')}
        </div>
        <h1>${level.kind==='tutorial' ? '学会啦！' : '通过！'}</h1>
        <p class="f-sub">正确 ${Math.round(st.acc*100)}%</p>
        <button class="f-start" id="fNextBtn">继续 ▶</button>
      </div>`);
    focusSpeak(level.kind==='tutorial' ? '你学会新游戏啦！' : praiseLine());
    [1,2,3].forEach(n=>{
      if(n<=stars) setTimeout(()=>{
        const el = document.querySelector('#fStars .st[data-n="'+n+'"]');
        if(el){ el.classList.add('pop'); sfx('pick'); }
      }, 350*n);
    });
  } else {
    const moveOn = (focusFailCount[level.i]||0) >= 2;      // 连败 2 次后换下一个游戏, 避免整段时间卡死在同一关
    focusScreen(`
      <div class="f-screen">
        <div class="f-stars"></div>
        <h1>很努力了！</h1>
        <p class="f-sub">正确 ${Math.round(st.acc*100)}% · 目标 70%</p>
        <p class="f-sub">${moveOn ? '这关先记住感觉，我们去玩别的游戏，以后再来挑战！' : '我们再试一次，这次会简单一点点 😊'}</p>
        <button class="f-start" id="fNextBtn">${moveOn ? '下一个游戏 ▶' : '再来一次 ↺'}</button>
      </div>`);
    focusSpeak(moveOn ? '你已经很努力了！我们先去玩别的游戏，以后再来挑战这一关。' : '你刚才很努力！我们再来一次，这次会简单一点点。');
  }
  const next = ()=>{
    if(focusLocked()) showFocusToday();
    else if(!passed && (focusFailCount[level.i]||0) < 2) startFocusLevel(level.i);
    else if(level.i >= 99) showFocusToday();
    else startFocusLevel(level.i+1);
  };
  document.getElementById('fNextBtn').onclick = next;
  focusAutoTimer = setTimeout(()=>{ if(document.getElementById('fNextBtn')) next(); }, 4000);
}

/* ---------- 家长面板 ---------- */
function showFocusParentGate(){
  const a = 5 + Math.floor(Math.random()*5), b = 5 + Math.floor(Math.random()*5);
  const ans = a + b;
  const opts = [ans, ans + 1 + Math.floor(Math.random()*3), Math.max(2, ans - 1 - Math.floor(Math.random()*3))]
    .sort(()=>Math.random()-0.5);
  focusScreen(`
    <div class="f-screen">
      <h1>家长入口</h1>
      <p class="f-sub">请回答：${a} + ${b} = ?</p>
      <div class="f-gate-row">${opts.map(o=>'<button class="f-btn" data-a="'+o+'">'+o+'</button>').join('')}</div>
    </div>`);
  document.querySelectorAll('#focusRoot .f-gate-row button').forEach(btn=>{
    btn.onclick = ()=>{ parseInt(btn.dataset.a,10)===ans ? showFocusParent() : showFocusToday(); };
  });
}

function showFocusParent(){
  const save = loadFocusSave();
  const fb = focusBudget();
  const total = Object.values(save.stars).reduce((s,x)=>s+x,0);
  const mins = Math.round((fb ? fb.spentMs() : 0)/60000);
  const played = fb ? fb.spentCount() : 0;
  const dims = FOCUS_DIMS;
  const perDim = dims.map(d=>{
    const h = save.history.filter(x=>x.dim===d).slice(-20);
    const acc = h.length ? Math.round(h.reduce((s,x)=>s+x.acc,0)/h.length) : null;
    const mrt = h.length ? Math.round(h.reduce((s,x)=>s+x.mrt,0)/h.length) : null;
    return { d, n:h.length, acc, mrt, h };
  });
  function spark(h){                                  // 迷你正确率折线(SVG)
    if(h.length < 2) return '<span class="f-nodata">数据不足</span>';
    const W=120, H=36, pts = h.map((x,k)=>(k*(W/(h.length-1))).toFixed(1)+','+(H-2-(H-6)*x.acc/100).toFixed(1)).join(' ');
    return `<svg width="${W}" height="${H}" class="f-spark"><polyline points="${pts}" fill="none" stroke="#7cfc00" stroke-width="2"/></svg>`;
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
        ${perDim.map(p=>`<tr><td>${FOCUS_META[p.d].icon} ${FOCUS_META[p.d].name}</td>
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
    const rows = [['日期','关卡','轮次','游戏','类型','通过','正确率%','反应中位数ms','试次数','星级']];
    for(const h of save.history){
      const lv = FOCUS_LEVELS[h.i] || {stage:0};
      rows.push([h.d, h.i+1, lv.stage, FOCUS_META[h.dim] ? FOCUS_META[h.dim].name : h.dim,
        h.kind, h.passed===false ? '否' : '是', h.acc, h.mrt, h.trials, h.stars]);
    }
    const csv = '\uFEFF' + rows.map(r=>r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = '专注训练营记录.csv';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  };
  ModeKit.confirmBtn(document.getElementById('fResetBtn'), {
    label: '↺ 重置进度', confirm: '⚠ 再点一次确认',
    onConfirm(){
      SyncDB.remove(FOCUS_SAVE_KEY);
      const fb2 = focusBudget();
      if(fb2) fb2.reset();                        // 旧行为保持: 重置进度同时清当日额度
      showToast('训练进度已重置', 1800);
      showFocusParent();
    }
  });
}

/* ---------- 模式对象 ---------- */
const FocusMode = mkMode({
  id: 'focus',
  init(){
    ensureFocusRoot();
    focusRoot.style.display = 'block';
    overlay.style.display = 'none';
    showFocusToday();                              // 纯点选全屏 UI: chrome 全关由 kit 默认处理
  },
  cleanup(){
    stopFocusTicker();
    if(focusCtrl){ focusCtrl.stop(); focusCtrl = null; }
    clearTimeout(focusAutoTimer);
    try{ if(typeof speechSynthesis!=='undefined') speechSynthesis.cancel(); }catch(e){}
    if(focusRoot) focusRoot.style.display = 'none';
  }
});
