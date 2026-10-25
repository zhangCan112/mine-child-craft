'use strict';
/* ============================================================
   Focus Camp Mode (专注训练营模式) — 模式层
   ------------------------------------------------------------
   一句话职责: 装配训练营屏幕流(今日页→关卡→结算→宝物柜/家长面板)
   与所有应用层文案/观感, 纯决策全部下沉 focus-levels.js。
   interface: FocusMode(mkMode 注册对象, id='focus')
   依赖(均经全局名, 调用期解析): Focus 库层(focus-levels.js: 关卡/图章/
     体检/特训纯函数) · runFocusLevel(focus-paradigms.js) ·
     chiefFace/stampIcon/flameIcon(mcIcon 族, focus-icons.js) ·
     SpeechKit(js/speech.js) · sfx(js/audio.js) · Backpack/ITEMS/iconOf ·
     Budgets(js/daily-budget.js) · SyncDB(js/sync.js) · ModeKit(js/mode-kit.js) ·
     CampKit(js/camp-kit.js — 战利品回路五件套(C1-T1)与图章仪式四件套
     (C1-T2)收编, 加载序在本文件之前)
   可测性: 纯 DOM 模式层; 决策纯函数在 focus-levels.js 有单测,
     本文件由 boot.test.js 全链冒烟兜底
   ------------------------------------------------------------
   会话: 进入→今日页→关卡→星级+过程表扬→自动下一关→每日 6 关或 20 分钟锁定;
   F6 增: 里程碑工具授予(存档 tools 字段记账 + 全屏仪式)与 🎒 宝物柜
   (工具组从 tools 字段渲染, 其余组从共享背包计数渲染, 点击 TTS 读物品名);
   F8 增: 每日体检(五维连跑→探险家火苗, 计时长不占额度)与魔鬼特训(单维轮换
   挑战档 5 分钟硬顶, 计 2 关额度; 鬼等级双阈进退零扣损) — 决策纯函数在
   js/focus-levels.js, 本文件只做流程装配与应用层文案;
   F5 增·奖励调优(2026-10): 矿袋战利品回路 — onTrial 逐试次段位掷骰入共享
   背包(教学关豁免, 体检/魔鬼特训不挂回调天然免; 幅度/品质随关卡 tier 分四
   段递增, 见 docs/focus-reward-tuning-design.md), 矿袋 HUD 槽位飞入(贝塞尔
   弧线观感归 css/focus.css; 授予/飞行/落袋/回顾观感件自 C1-T1 起住
   CampKit 的 focusLootHud 实例), 结算屏战利品列队回顾, 满包每关至多一次
   「背包满啦」toast; 掉落政策纯函数(rollFocusLoot/levelBonusLoot/
   grantFocusLoot)在 js/focus-levels.js(可单测), 本文件只做流程装配与观感
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
  /* 存档形状唯一权威在 focus-levels.js 的 FOCUS_SAVE_DEFAULTS/migrateFocusSave
     (库层可单测): stamps={日期:当日关数}(图章日历, 滚动 90 天)、
     stampClaimed=[已领集章达成线](F7)、stampKind=自选章图案(B6)、
     tools=[已授里程碑工具 id](F6)、checks={日期:{acc,flame}}(F8 每日体检)、
     devil={levels:{维度:鬼等级}, days:{日期:训况}}(F8, 均滚动 90 天);
     缺字段由 save-slot 的 defaults 浅并入幂等补默认, 存量进度字段原样保留 */
  defaults: FOCUS_SAVE_DEFAULTS,
  migrate(s, from) { // 迁移链与单测共用库层实现(摘 v0 daily / 补 tools / 修 stampKind)
    return migrateFocusSave(s, from);
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

/* ---------- 矿袋战利品回路(F5 → C1-T1 收编 CampKit): 会话明细/满包节流旗/
   飞行起点的状态与观感件住在 focusLootHud 实例(每关 begin() 重置);
   此处只留 focus 奖励调优专属的两份计数 —
   focusStreakChimes: 连对琶音每关至多 3 次防轰炸;
   focusLootDry: 关内连续答对未掉计数(奖励调优干燥兜底, 答错/掉落即清零,
   达阈值由纯函数必得, 防整关空手挫败) */
let focusStreakChimes = 0;
let focusLootDry = 0;
/* 战利品回路 kit 实例: prefix 'f' 拼 HUD 槽位/飞行件/回顾块的 id 与类名
   (css/focus.css 契约不变); 缺省飞行起点=训练区 #fArea 矩心(引擎缺席时
   兜底常量, F5 现状口径参数化保真); 满包 toast 每关至多一次(onFull 注入,
   授予基座在 CampCore.grantLoot, 家族掷骰在 focus-levels 纯函数) */
const focusLootHud = CampKit.mkLootHud({
  prefix: 'f',
  bag: focusBag,
  hud: () => document.getElementById('fBagHud'),
  defaultOrigin() {
    const area = document.getElementById('fArea');
    const ar = area ? area.getBoundingClientRect() : {left: 0, top: 0, width: 640, height: 380};
    return {x: ar.left + ar.width / 2, y: ar.top + ar.height / 2};
  },
  onFull: () => showToast('背包满啦', 2200),
});

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
let focusAutoTimer = 0;

/* 训练时长入账(F5 → C1-T1 收编 CampKit.mkCampTicker): 关卡进行中每秒
   accrue 实际毫秒并落账 — 崩溃/关页损失 ≤1 秒(原为关卡结束才入账, 丢整关
   2~3 分钟); 菜单/说明页不计(口径不变); 单拍钳制 2s(f3c1fee 修复语义,
   只认连续在场的真实训练时长)在 kit 单份保真 */
const focusCampTicker = CampKit.mkCampTicker({budget: focusBudget});
function startFocusTicker() {
  focusCampTicker.start();
}
function stopFocusTicker() {
  focusCampTicker.stop();
}

function ensureFocusRoot() {
  if (focusRoot) return;
  focusRoot = fEl('div');
  focusRoot.id = 'focusRoot';
  document.body.appendChild(focusRoot);
}

/* ---------- 矿洞皮肤(F9): TextureAtlas 单格雪碧 → #focusRoot 的 CSS 变量 ----------
   进训练营惰性生成一次(focusCaveSkinned 模块级缓存, 勿每帧生成):
   --f-atlas = 整图 256×256 dataURL, 火把层用它 + background-position 取格;
   --f-tile-* = 抠出的单格 16×16 dataURL, 石头/泥土/圆石带要 repeat,
   整图 repeat 会把 256 格全铺出来, 故单格单存(同一 makeCanvas 的切片) */
let focusCaveSkinned = false;
function ensureFocusCaveSkin() {
  if (focusCaveSkinned) return;
  focusCaveSkinned = true; // 先落记: 即使引擎缺席也不再重试(保留纯色兜底)
  if (typeof TextureAtlas === 'undefined') return;
  const atlas = TextureAtlas.makeCanvas(document);
  const tileIdx = (blockId)=>TextureAtlas.layout.tiles[blockId]; // 方块 id → 格号(与引擎 UV 同表)
  const tileURL = (idx)=>{
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    c.getContext('2d').drawImage(atlas, (idx%16)*16, Math.floor(idx/16)*16, 16, 16, 0, 0, 16, 16);
    return 'url(' + c.toDataURL() + ')';
  };
  const s = focusRoot.style; // 基础方块 id: 泥土 2 / 石头 3 / 圆石 4(config.js 方块表同号)
  s.setProperty('--f-atlas', 'url(' + atlas.toDataURL() + ')');
  s.setProperty('--f-tile-stone', tileURL(tileIdx(3)));
  s.setProperty('--f-tile-cobble', tileURL(tileIdx(4)));
  s.setProperty('--f-tile-dirt', tileURL(tileIdx(2)));
}
function focusScreen(html) {
  clearTimeout(focusAutoTimer);
  focusRoot.innerHTML = '<div class="f-top"><button class="f-back" id="fBackBtn" aria-label="返回">' +
      btnImg('left') + '</button></div>' + html;
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

/* ---------- 图章日历条 + 集章仪式(F7/B6 → C1-T2 收编 CampKit): 纯函数在
    focus-levels.js, 呈现件(日历条/仪式块/三选一/烟花)住 focusStampRites 实例 ----------
    当日 ≥1 关盖普通章(图案由 save.stampKind 三选自选, 缺省镐), 满 3 关盖大章;
    魔鬼特训日另有鬼图章角标(B8, 与普通章并存、不改 stamps 计数口径 — 经 kit
    的 badge 缝注入); 漏签空白无任何负面标记; 集章里程碑(3/7/14/30…章)达成时
    村长喝彩授予观感奖励(喝彩图经 awardIcon 缝注入) —— 永不解锁关卡/范式/
    难度(红线); 皮肤/烟花等持久观感钩子在仪式或今日页恢复时应用,
    落账函数 settleFocusStamps 保持无 DOM 副作用 */
const FOCUS_STAMP_KIND_NAMES = {pick: '镐图章', gem: '宝石图章', tnt: '炸药图章'};
const FOCUS_STAMP_REWARD_TEXT = { // 结算屏集章 toast(onFocusLevelEnd)也查此表, kit 侧经 rewardText 注入
  stamp_pattern: '自选图章图案', bag_skin: '矿袋新皮肤', firework: '宝物柜烟花', gold_stamp: '金图章',
};
const focusStampRites = CampKit.mkStampRites({
  prefix: 'f',
  kinds: FOCUS_STAMP_KINDS,
  kindNames: FOCUS_STAMP_KIND_NAMES,
  kindDefault: 'pick',
  daily: FOCUS_STAMP_DAILY,
  dayKey: focusTodayStr, // 日期键单点出口(库层)
  count: stampCount,
  rewardFor: stampRewardFor,
  rewardText: (rid) => FOCUS_STAMP_REWARD_TEXT[rid],
  save: saveFocusSave, // 三选一选中即写存档
  root: () => focusRoot, // 烟花挂根容器
  badge(key, save) { // B8: 当日有魔鬼特训记录 → 角标鬼图章(与普通章并存, 集章数不另计)
    const devil = !!(save.devil && save.devil.days && save.devil.days[key]);
    return devil ? '<img class="f-stamp-devil" draggable="false" alt="" src="' + stampIcon('devil') + '">' : '';
  },
  awardIcon: () => '<img class="f-award-chief" draggable="false" alt="村长" src="' + chiefFace('cheer') + '">',
});

function focusStampKind(save) { // 损坏/缺省回落镐章(与 migrateFocusSave 同一白名单)
  return focusStampRites.kindOf(save);
}

function focusStampCalendarHtml(save) { // 本月日历条(本月外不渲染)
  return focusStampRites.calendarHtml(save);
}

/* 结算落账(须在 saveFocusSave 之前调用, 就近写回 save): 当日计数与预算 dots 同口径;
   返回本次新达成的集章达成线(差集幂等, 已领不重发)。本函数无 DOM 副作用 —
   皮肤 body 类/烟花等观感由调用方在仪式或今日页恢复路径统一应用 */
function settleFocusStamps(save, day, played) {
  save.stamps = stampTrim(stampRecord(save.stamps || {}, day, played), day);
  const due = stampRewardsDue(stampCount(save.stamps), save.stampClaimed || []);
  if (due.length) save.stampClaimed = (save.stampClaimed || []).concat(due);
  return due;
}

/* 持久观感钩子的应用点(与纯落账分离): 矿袋皮肤按已领奖励恢复/清除 */
function applyFocusBagSkin(claimed) {
  document.body.classList.toggle('f-bag-iron', stampRewardClaimed(claimed, 'bag_skin'));
}

/* 一次性 CSS 粒子迸发(B6 烟花, C1-T2 起住 CampKit 实例): 元素沿用 F9
    box-shadow 粒子手法; 样式在 css/focus.css, prefers-reduced-motion 下
    动画全关且基础 opacity=0 */
function launchFocusFirework() {
  focusStampRites.firework();
}

/* 集章奖励的观感应用(落账后调用): 皮肤恢复 + 首次领到烟花奖励时迸发一次 */
function celebrateFocusStampAwards(save, due) {
  applyFocusBagSkin(save.stampClaimed || []);
  if (due.some((line) => stampRewardFor(line) === 'firework')) launchFocusFirework();
}

function focusStampAwardHtml(lines, save) { // 集章授予仪式块(kit 实例): 村长喝彩(awardIcon 缝) + 观感奖励声明
  return focusStampRites.awardHtml(lines, save);
}

/* 三选一图案选择器接线(C1-T2 起住 CampKit 实例): 选中即写存档并高亮,
    日历下次渲染即用新图案 */
function wireFocusStampPicker(save) {
  focusStampRites.wirePicker(save);
}

/* ---------- 今日页 ---------- */
function showFocusToday() {
  stopFocusTicker();
  const save = loadFocusSave();
  applyFocusBagSkin(save.stampClaimed); // B6 皮肤恢复路径(落账函数无 DOM 副作用)
  const locked = focusLocked();
  const played = focusBudget() ? focusBudget().spentCount() : 0;
  const total = Object.values(save.stars).reduce((s, x)=>s+x, 0);
  const cur = Math.min(save.unlocked, 99);
  const lv = FOCUS_LEVELS[cur];
  const meta = FOCUS_META[lv.dim];
  const today = focusTodayStr();
  const dots = Array.from({length: FOCUS_DAILY_LEVELS}, (_, k)=>
    '<span class="dot '+(k < played?'done':'')+'"></span>').join('');

  let html = '';
  if (locked) {
    const checkDue = focusCheckEntry(save.checks, today); // B3: 体检不占关数额度, 锁定日仍可做
    html = `
    <div class="f-screen f-today">
      <div class="f-lock"><img class="f-lock-chief" draggable="false" alt="打盹的村长"
        src="${chiefFace('sleepy')}"><span class="f-lock-moon" aria-hidden="true">🌙</span></div>
      <h1>今天的训练完成啦！</h1>
      <p class="f-sub">训练师要休息了，明天怪物们等你来 😊</p>
      <div class="f-dots">${dots}</div>
      ${checkDue ? '<div class="f-extra-row">' +
        '<button class="f-extra-btn f-check-btn" id="fCheckBtn">' + btnImg('flame') + '今日体检</button></div>' : ''}
      ${focusStampCalendarHtml(save)}
      <button class="f-btn" id="fBagBtn">${btnImg('chest')} 宝物柜</button>
      <button class="f-btn" id="fHome2">${btnImg('house')} 回主页</button>
      <button class="f-parent-btn" id="fParentBtn">${btnImg('lock')} 家长</button>
    </div>`;
    focusScreen(html);
    if (checkDue) document.getElementById('fCheckBtn').onclick = startFocusCheck;
    document.getElementById('fBagBtn').onclick = showFocusCabinet;
    document.getElementById('fHome2').onclick = focusExit;
    document.getElementById('fParentBtn').onclick = showFocusParentGate;
    return;
  }
  // B2 今日任务单: 按待打关与今日剩余额度取 1~2 个维度图标(零文字, 点击 TTS 读维度名)
  const fb0 = focusBudget();
  const remaining = fb0 ? Math.max(0, fb0.capCount() - played) : FOCUS_DAILY_LEVELS;
  const tasks = focusTodayDims(save.unlocked, remaining).map((dim)=>
    '<button class="f-task-chip" data-dim="' + dim + '" title="' + FOCUS_META[dim].name +
    '" aria-label="' + FOCUS_META[dim].name + '">' + FOCUS_META[dim].icon + '</button>').join('');
  html = `
  <div class="f-screen f-today">
    <div class="f-progress-line">第 ${cur+1} 关 / 100 · ⭐${total}</div>
    <div class="f-chief-bubble f-greeting" id="fGreeting" role="button" tabindex="0">
      <img draggable="false" alt="村长爷爷" src="${chiefFace('smile')}">
      <span class="f-bubble">今天我们来玩${meta.game}，准备好了吗？</span>
    </div>
    <div class="f-dim-icon">${meta.icon}</div>
    <h1>${meta.game}</h1>
    <p class="f-sub">${meta.name}${lv.kind==='review' ? ' · 复习' :
        (lv.kind==='tutorial' ? ' · 教学' : (lv.kind==='master' ? ' · 大师考验' : ''))}</p>
    ${tasks ? '<div class="f-task-row" id="fTaskRow">' + tasks + '</div>' : ''}
    <button class="f-start" id="fStartBtn">▶ 开始训练</button>
    ${focusExtrasHtml(save)}
    <button class="f-btn" id="fBagBtn">${btnImg('chest')} 宝物柜</button>
    <button class="f-btn" id="fProgressBtn">${btnImg('chart')} 我的进步</button>
    <div class="f-dots">${dots}</div>
    ${focusStampCalendarHtml(save)}
    <button class="f-parent-btn" id="fParentBtn">${btnImg('lock')} 家长</button>
  </div>`;
  focusScreen(html);
  // B4 今日页开场白: 每次进页问候一次, 点按跳过(停 TTS 并收起气泡)
  const greet = document.getElementById('fGreeting');
  if (greet) {
    const skip = ()=>{
      SpeechKit.cancel();
      greet.remove();
    };
    greet.onclick = skip;
    greet.onkeydown = (e)=>{
      if (e.key === 'Enter' || e.key === ' ') skip();
    };
    SpeechKit.speak('你好呀！今天我们来玩' + meta.game + '，准备好了吗？');
  }
  document.querySelectorAll('#focusRoot .f-task-chip').forEach((btn)=>{
    btn.onclick = ()=> SpeechKit.speak(FOCUS_META[btn.dataset.dim].name);
  });
  document.getElementById('fStartBtn').onclick = ()=> startFocusLevel(cur);
  wireFocusExtras();
  document.getElementById('fBagBtn').onclick = showFocusCabinet;
  document.getElementById('fProgressBtn').onclick = showFocusProgress;
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
      <div class="f-chief-bubble f-rule-bubble">
        <img draggable="false" alt="村长爷爷" src="${chiefFace('smile')}">
        <div class="f-bubble"><b>${meta.rule}</b></div>
      </div>
      <div class="f-tipbox">💡 ${focusTip(level)}${level.kind!=='tutorial' ? ' 目标：正确 70% 以上通过！' : ''}</div>
      <button class="f-start" id="fGoBtn">▶ 开始</button>
    </div>`);
  SpeechKit.speak(meta.rule);
  document.getElementById('fGoBtn').onclick = ()=> beginFocusRun(level);
}

/* ---------- 矿袋战利品回路(F5 起源 → 奖励调优 2026-10): 政策纯函数的流程装配 ----------
   onTrial → 连对显示(教学关照常, 零压力正反馈) + 段位掷骰(rollFocusLoot
   内拦教学关/错误试次; 掉率与品质查 FOCUS_REWARD_STAGES, dry 达阈值必得)
   → grantFocusLoot 入包 + save → 飞入 HUD 槽位; 结算奖励(levelBonusLoot
   按段位展开)在 onFocusLevelEnd 发放并入回顾列队 */

/* 连对显示: ⛏️×N 挂 .f-streak(F9 备好样式与 .bump 弹跳), streak≥2 才显示;
   琶音 sfx('level') 每关至多 3 次防轰炸 */
function updateFocusStreak(streak) {
  const el = document.getElementById('fStreak');
  if (!el) return;
  if (!(streak >= 2)) {
    el.textContent = '';
    return;
  }
  const txt = '⛏️×' + streak;
  if (el.textContent === txt) return; // 同值不重复弹跳
  el.textContent = txt;
  el.classList.remove('bump');
  void el.offsetWidth; // 重触发动画
  el.classList.add('bump');
  if (focusStreakChimes < 3) {
    focusStreakChimes++;
    sfx('level');
  }
}

/* 授予流(F3 核定口径, C1-T1 起住 CampKit 实例): 入包成功即 save(频率低,
   不批量); 余量>0 静默忽略 + 每关至多一次 toast「背包满啦」(零惩罚,
   授予基座在 CampCore.grantLoot, 家族薄委托 grantFocusLoot 同源) */
function grantFocusLootIntoBag(ids) {
  return focusLootHud.grantIntoBag(ids);
}

/* 逐试次事件(F2 契约 {ok, streak, dim}): dim 取事件补注值(master 关每小节
   各归各的试次归一), kind 由 rollFocusLoot 读 level 拦教学关豁免;
   dry 计数: 答对未掉 +1, 掉落/答错清零(干燥兜底政策在纯函数) */
function onFocusTrialLoot(level, t) {
  updateFocusStreak(t.streak);
  const id = rollFocusLoot(level, {ok: t.ok, dry: focusLootDry, dim: t.dim});
  focusLootDry = id ? 0 : (t.ok ? focusLootDry + 1 : 0);
  if (!id) return;
  /* 飞行起点=最近点击(kit 实例 noteTap 记录, 挂点在下方 areaEl)再缺省
     defaultOrigin(训练区矩心) */
  if (grantFocusLootIntoBag([id]).granted.length) flyFocusLoot(id);
}

/* 战利品飞行(C1-T1 起住 CampKit 实例): 贝塞尔弧线观感与 HUD 宽度守卫
   (隐藏即放弃观感, 入包已完成)在 kit 单份; 位移经 CSS 变量 --dx/--dy 传给
   keyframes(样式在 css/focus.css); 元素挂 document.body(#focusRoot 的
   动画全关降级块管不到, 飞行在 prefers-reduced-motion 下自退化为淡入) */
function flyFocusLoot(id, from) {
  focusLootHud.fly(id, from);
}

/* 矿袋 HUD 落袋(C1-T1 起住 CampKit 实例): 同 id 并槽计数, 新物品开槽
   (槽满自动滚到最新), 槽位弹跳 + 叮咚 sfx('pick')(与引擎答对音叠成
   双声部, 观感对齐 drops 真空吸附) */
function addFocusBagSlot(id) {
  focusLootHud.addSlot(id);
}

/* 结算屏战利品回顾(C1-T1 起住 CampKit 实例, 设计稿 §3 L5): 本关获得
   从矿袋飞出列队 + 计数 — 级联进场逐件 pop(星星爆开之后), 无获得
   不渲染区块 */
function focusLootRecapHtml() {
  return focusLootHud.recapHtml();
}
function runFocusLootRecap() {
  focusLootHud.runRecap();
}

function beginFocusRun(level) {
  startFocusTicker();
  /* F5 矿袋会话状态: 每关一份新明细 / 满包 toast 节流旗 / 飞行起点(kit
     实例自持, begin 一并复位) + 琶音节流与干燥计数(奖励调优, 模式层自持) */
  focusLootHud.begin();
  focusStreakChimes = 0;
  focusLootDry = 0;
  const meta = FOCUS_META[level.dim];
  const kindTag = level.kind==='tutorial' ? '· 教学' :
      level.kind==='review' ? '· 复习' :
      level.kind==='master' ? '· 大师考验' : '';
  focusScreen(`
    <div class="f-level-head">
      <div class="f-rule"><span class="f-rule-icon">${meta.icon}</span>
        <span class="f-rule-text">${meta.game} ${kindTag}</span></div>
      <div class="f-rule-small">${meta.rule}</div>
      <div class="f-progress-wrap">
        <div class="f-progress">
          <div class="f-progress-bar" id="fProg"></div>
          <i class="f-progress-ticks" aria-hidden="true"></i>
        </div>
        <i class="f-progress-cursor" id="fProgCursor" aria-hidden="true"><img src="${mcIcon('pickaxe')}" alt=""></i>
      </div>
    </div>
    <div class="f-area" id="fArea">
      <div class="f-cave" aria-hidden="true">
        <i class="f-torch f-torch-top-left"></i><i class="f-torch f-torch-top-right"></i>
        <i class="f-torch f-torch-bottom-left"></i><i class="f-torch f-torch-bottom-right"></i>
      </div>
      <div class="f-streak" id="fStreak" aria-hidden="true"></div>
    </div>
    ${level.kind === 'tutorial' ? '' :
      '<div class="f-bag" id="fBagHud" aria-hidden="true"></div>'}`);
  document.getElementById('fBackBtn').onclick = showFocusToday;
  const areaEl = document.getElementById('fArea');
  areaEl.addEventListener('pointerdown', (e)=>{
    focusLootHud.noteTap(e.clientX, e.clientY); // 战利品飞行起点(刺激位置代理; 挂点 T4 再收)
  }, true);
  focusCtrl = runFocusLevel(level, areaEl, {
    progress(k, n) {
      const pct = Math.round(k/Math.max(1, n)*100);
      const bar = document.getElementById('fProg');
      if (bar) bar.style.width = pct + '%';
      const cursor = document.getElementById('fProgCursor'); // F9: ⛏️ 游标随进度推进
      if (cursor) cursor.style.left = pct + '%';
    },
    showRule(dim) {
      SpeechKit.speak(FOCUS_META[dim || level.dim].rule);
    },
    onTrial(t) {
      onFocusTrialLoot(level, t); // F5: 逐试次掷骰入矿袋(教学关在纯函数内豁免)
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
  save.history.push({d: focusTodayStr(), i: level.i, dim: level.dim, kind: level.kind,
    acc: Math.round(st.acc*100), mrt: Math.round(st.mrt), trials: st.trials, stars, passed});
  if (save.history.length > 400) save.history.splice(0, save.history.length-400);
  const stampDue = settleFocusStamps(save, focusTodayStr(), fb ? fb.spentCount() : 1); // 图章落账(F7)
  const stampNames = stampDue.map((line)=>FOCUS_STAMP_REWARD_TEXT[stampRewardFor(line)]).join('、');
  saveFocusSave(save);
  /* F6 里程碑: 越线即授予(历史已落账, focusProgress 可见刚通关的一关);
     记账进 tools 字段(选型 B 不进背包), 仪式排在星屏之后(见 proceed) */
  const award = passed ? focusGrantMilestones(save) : [];
  /* F5 结算奖励(庆祝层): 按段位表展开 bonus + 三星追加(levelBonusLoot 内
   拦教学关/未通过); 入包后进本关明细, 与关内掉落一起列队回顾 */
  const bonus = passed ? levelBonusLoot(passed, stars, level) : [];
  if (bonus.length) grantFocusLootIntoBag(bonus);
  const praise = level.kind==='tutorial' ? '你学会新游戏啦！' : praiseLine();

  if (passed) {
    focusScreen(`
      <div class="f-screen f-result">
        <div class="f-stars" id="fStars">
          ${[1, 2, 3].map((n)=>'<span class="st '+(n<=stars?'on':'')+'" data-n="'+n+'">⭐</span>').join('')}
        </div>
        <h1>${level.kind==='tutorial' ? '学会啦！' : '通过！'}</h1>
        <p class="f-sub">正确 ${Math.round(st.acc*100)}%</p>
        <div class="f-result-chief"><img draggable="false" alt="村长爷爷" src="${chiefFace('cheer')}">
          <span class="f-bubble">${praise}</span></div>
        ${focusLootRecapHtml()}
        ${focusStampAwardHtml(stampDue, save)}
        <button class="f-start" id="fNextBtn">继续 ▶</button>
      </div>`);
    SpeechKit.speak(stampDue.length ? '集齐图章啦！获得' + stampNames + '！' : praise);
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
      <div class="f-screen f-result">
        <div class="f-stars"></div>
        <h1>很努力了！</h1>
        <p class="f-sub">正确 ${Math.round(st.acc*100)}% · 目标 70%</p>
        <p class="f-sub">${moveOn ? '这关先记住感觉，我们去玩别的游戏，以后再来挑战！' : '我们再试一次，这次会简单一点点 😊'}</p>
        ${focusLootRecapHtml()}
        ${focusStampAwardHtml(stampDue, save)}
        <button class="f-start" id="fNextBtn">${moveOn ? '下一个游戏 ▶' : '再来一次 ↺'}</button>
      </div>`);
    SpeechKit.speak(stampDue.length ? '集齐图章啦！获得' + stampNames + '！' :
        (moveOn ? '你已经很努力了！我们先去玩别的游戏，以后再来挑战这一关。' : '你刚才很努力！我们再来一次，这次会简单一点点。'));
  }
  wireFocusStampPicker(save); // B6 三选一图案(未达成时无节点, 自动 no-op)
  celebrateFocusStampAwards(save, stampDue); // 皮肤恢复 + 首次烟花迸发(落账后观感)
  runFocusLootRecap(); // F5: 本关收获从矿袋列队进场(星星之后, 无获得零渲染)
  if (stampDue.length) { // 集章仪式: 奖励声明 toast + 晋升琶音(观感奖励, 与关卡解锁无关)
    showToast('🎖️ 集章奖励：' + stampNames + '！', 2600);
    sfx('level');
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
    if (!id) {
      after(); return;
    }
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
    if (g.tools) { // 工具组: 按里程碑唯一派生出口(升序)从 tools 字段渲染(大格)
      const ids = milestoneLevels()
          .map((e) => e.id).filter((id) => save.tools.includes(id));
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
  // B6 烟花彩蛋: 集章 14 章后每次打开宝物柜迸发一次(reduced-motion 由 CSS 降级)
  if (stampRewardClaimed(save.stampClaimed, 'firework')) launchFocusFirework();
}

/* ---------- 我的进步(B5, 儿童版成绩曲线): 零文字星柱 + 最新突破高亮 ----------
   数据来自 focusDimStars/focusLastBreakthrough 纯函数(重玩取历史最高, 天然防刷);
   只呈现累计与突破, 不呈现下滑; 点击列 TTS 读维度名 */
function showFocusProgress() {
  const save = loadFocusSave();
  const stars = focusDimStars(save);
  const latest = focusLastBreakthrough(save);
  const cols = FOCUS_DIMS.map((dim)=>{
    const n = stars[dim];
    const chips = n ? Array.from({length: Math.min(n, 12)}, ()=>'<i>⭐</i>').join('') :
      '<i class="f-star-empty">☆</i>';
    return `<button class="f-dim-col${dim === latest ? ' f-latest' : ''}" data-dim="${dim}"
      title="${FOCUS_META[dim].name}：${n} 颗星" aria-label="${FOCUS_META[dim].name}">
      <span class="f-star-stack">${chips}</span>
      <span class="f-dim-badge">${FOCUS_META[dim].icon}</span>
      ${dim === latest ? '<span class="f-break" aria-hidden="true">✨</span>' : ''}
    </button>`;
  }).join('');
  focusScreen(`
    <div class="f-screen f-progress-page">
      <div class="f-chief"><img draggable="false" alt="村长爷爷" src="${chiefFace('smile')}"></div>
      <h1>📈 我的进步</h1>
      <div class="f-progress-cols">${cols}</div>
      <button class="f-btn" id="fProgressHome">返回今天</button>
    </div>`);
  document.getElementById('fBackBtn').onclick = showFocusToday;
  document.getElementById('fProgressHome').onclick = showFocusToday;
  document.querySelectorAll('#focusRoot .f-dim-col').forEach((btn)=>{
    btn.onclick = ()=> SpeechKit.speak(FOCUS_META[btn.dataset.dim].name);
  });
  SpeechKit.speak(latest ? '你最近突破了' + FOCUS_META[latest].name + '！' : '看看你的星星吧！');
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
  const today = focusTodayStr();
  const parts = [];
  if (focusCheckEntry(save.checks, today)) {
    parts.push('<button class="f-extra-btn f-check-btn" id="fCheckBtn">' + btnImg('flame') + '今日体检</button>');
  }
  const fb = focusBudget();
  const de = devilEntry(save.devil, today, fb ? fb.spentCount() : 0, fb ? fb.capCount() : FOCUS_DAILY_LEVELS);
  if (de.reason !== 'done') {
    parts.push('<button class="f-extra-btn f-devil-btn" id="fDevilBtn"' +
        (de.open ? '' : ' disabled title="今天的关卡额度不够啦，明天再来！"') + '>' + btnImg('devil') + '魔鬼特训</button>');
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
  const today = focusTodayStr();
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
  const dim = devilDimFor(focusTodayStr()); // 维度按日轮换(纯函数, 同一天恒定)
  const meta = FOCUS_META[dim];
  const tier = devilTierFor(dim, save.unlocked); // 该维当前档 → 挑战档 = +2 封顶 19
  focusScreen(`
    <div class="f-screen f-intro f-devil-zone">
      <div class="f-chief"><img src="${chiefFace('devil')}" draggable="false" alt="鬼村长"></div>
      <h1>👹 魔鬼特训</h1>
      <p class="f-sub">今天轮到：${meta.icon} ${meta.game} · ${meta.name}</p>
      <div class="f-rulebox">魔鬼特训，5 分钟，准备好了吗！</div>
      <div class="f-tipbox">比平时难一点点，要用 2 关的额度。输了也不扣任何东西，鬼等级永远不会归零！</div>
      <button class="f-start" id="fDevilGo">${btnImg('flame')} 我准备好了！</button>
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
  run.deadlineId = setTimeout(()=>{
    run.deadlineHit = true;
  }, FOCUS_DEVIL_TIME_MS);
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
  const today = focusTodayStr();
  const cur = save.devil.levels[run.dim] || 1;
  const acc = run.agg.trials ? run.agg.correct/run.agg.trials : 0;
  const next = run.agg.trials ? devilStep(cur, acc) : cur; // 零试次兜底: 等级不动
  save.devil.levels[run.dim] = next;
  save.devil.days = trimFocusLog(save.devil.days, today, FOCUS_LOG_KEEP_DAYS);
  save.devil.days[today] = {dim: run.dim, acc: Math.round(acc*100), lv: next};
  const fb = focusBudget();
  if (fb) {
    fb.count(2); fb.flush(); // 先计 2 关额度(时长已由 ticker 每秒入账), 再按含特训的当日有效关数落章
  }
  // B1 大图章不漏判: 传 count(2) 后的 spentCount(含普通关+特训), stampRecord 再与既有值取 max
  const stampDue = settleFocusStamps(save, today, fb ? fb.spentCount() : 2);
  saveFocusSave(save);
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
  wireFocusStampPicker(save); // 若特训恰好跨过 3 章线, 同样给三选一
  celebrateFocusStampAwards(save, stampDue); // 皮肤/烟花观感(与结算屏共存)
  /* 通关鬼图章: 观感在此渲染, 落账经上方 settleFocusStamps 并入 F7 图章日历
     (每天至多 1 章的并集口径); 结算屏的鬼图章是该日的特殊章标记 */
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
        <button class="f-btn" id="fCsvBtn">${btnImg('doc')} 导出记录 CSV</button>
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
      document.body.classList.remove('f-bag-iron'); // 皮肤钩子是 body 类, 重置进度须一并清除(恢复路径在今日页)
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
    ensureFocusCaveSkin(); // F9: 矿洞贴图雪碧进训练营只生成一次
    focusRoot.style.display = 'block';
    overlay.style.display = 'none';
    focusBag.load(); // 共享背包读档(F3 口径: 重进必重读, 探险同款)
    focusBackfillMilestones(showFocusToday); // F6: 存量档按进度一次性补授(仪式串播)后进今日页
  }, // 纯点选全屏 UI: chrome 全关由 kit 默认处理
  cleanup() {
    stopFocusTicker();
    focusLootHud.clear(); // 战利品回路清场: 飞行件/HUD 槽位/会话状态(C1-T1)
    abortDevilRun(); // 魔鬼特训静默终止(不弹结算屏, 见函数注释)
    if (focusCtrl) {
      focusCtrl.stop(); focusCtrl = null;
    }
    clearTimeout(focusAutoTimer);
    SpeechKit.cancel();
    if (focusRoot) focusRoot.style.display = 'none';
  },
});
