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
     mathLevelUnlocked(save, i) · mathBossPlan(level) · mathAggStats(sts) ·
     mathSettleSave(...) ·
     mathStampClaim(save)(T8 集章达成线领取) ·
     mathWorldRunner(family, variant)(世界轨 runner 查表) ·
     mathLevelMeta(level)(情境关话术覆盖, T7);
     mathFamChallengeDone/mathLevelStars(第三星挂钩判据与三星回溯星显)住
     库层 math-levels.js, 本文件只调用(判据与星表同源, 配单测)
   依赖(均经全局名, 调用期解析): mkMode(js/mode-kit.js) ·
     SpeechKit(js/speech.js) · showToast(js/effects.js) ·
     btnImg(js/button-icons.js) · Budgets/MATH_DAILY_*(js/daily-budget.js
     与 main.js setupBudgets 建立的 math 预算) · SyncDB(js/sync.js) ·
     Backpack(js/backpack.js, ADR 0002 共享背包 — 数学岛是只产出的新消费方,
     T8) · ITEMS(js/items-core.js) · iconOf(js/icons.js, 调用期解析) ·
     stampIcon(js/focus-icons.js, T8 数学自选章图案) ·
     MATH_*(js/math-levels.js) · PuzzleCore(js/math-puzzles-core.js) ·
     mathScreenDispatch/runMathScreen(js/math-paradigms.js) ·
     mClockFace/mClockSay(js/math-paradigms.js, G1 常驻钟面复用
     谜题钟部件渲染形态与报时口径纯函数) ·
     runHopWorld(js/math-world.js, 加载序在本文件之前 — hop 世界轨装场) ·
      runBuildWorld/mathWorldHb(js/math-build-world.js, 加载序在本文件
      之前 — T6 摆与搭世界轨装场, 指针锁宿主) ·
      uiPause/touchPlaying(js/input.js, mathWorldLeave 交还指针用) ·
     overlay/showPage(js/main.js 组合根, main.js 后加载, 调用期才解析 —
     与 FocusMode 同款)
   可测性: 纯 DOM 模式层; 流程纯函数经 vm 直测(见上), 本文件由
     boot.test.js 全链冒烟兜底
   ------------------------------------------------------------
   会话(设计稿 docs/math-mode-design.md §5): 主菜单卡进入 →
   init 全屏接管(共享背包 load 一次, focus 同款双消费方惯例, T8) →
   今日页(进度概览/每日额度/图章日历) → 关卡地图(四带分组/
   星显/锁定) → 规则语音 → 关卡 runner(屏流引擎) → 结算(星显/
   过程表扬/战利品回顾/图章进度/自动下一关); boss 关按 sections
   连跑三小节聚合单关口径; 挑战关通过写 challenge 表(第三星挂钩);
   额度尽 → 今日页锁定文案; 时长入账: 关卡进行中每秒 accrue
   (focus ticker 同款), 菜单/地图页不计。
   T8 激励回路(设计稿 §5·ADR 0002): onTrial 逐试次掷骰
   (rollMathLoot, 教学豁免/只奖不罚在纯函数)→ grantMathLoot 入共享
   背包 → HUD 矿袋槽位飞入(贝塞尔观感归 css/math.css, 对齐 focus
   F5 纪律; 飞行起点 mathLastTap 自记点击坐标 — 引擎事件缝不带
   DOM 信息)→ 结算屏战利品列队回顾; 满包每关至多一次「背包满啦」
   toast; 图章一本独立于专注训练营(日历/自选章图案/集章达成线
   领奖, 纯函数在 math-levels.js, 奖励纯观感不解锁玩法)。
   ★ 分发缝(T5 已接管 hop 世界轨, T6 已接管 mirror/plan 世界轨):
   mathVariantTrack(family, variant) 返回 'screen' | 'world' — 屏流变体
   走 runMathScreen; 世界轨再查 MATH_WORLD_RUNNERS, 有 runner 的变体
    3D 场景关卡(hop 三变体=js/math-world.js 混合宿主 · mirror/plan 八变体=
    js/math-build-world.js 指针锁宿主, 两宿主并列统一留待后续票),
    六族世界变体已全部在册("建设中"占位屏已随全册退役; 未登记变体属
    清单漂移, 由 test 单一权威断言拦截)。
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

/* ---------- 分发缝(★ 世界轨接管点, 见头注释) ----------
   变体轨别单一权威派生: mathVariantTrack = mathScreenDispatch(family,
   variant).kind === 'engine' ? 'screen' : 'world'(屏流键集在
   math-paradigms.js 的 MATH_SCREEN_KEYS 一处维护, 本文件不再抄清单 —
   两处漂移=运行时软锁, 由 test/math-paradigms.test.js 的单一权威
   一致性断言守门); 世界轨变体注册在 MATH_WORLD_RUNNERS — T5 交付 hop
   三变体, T6 续入 mirror/plan; math-paradigms.js 加载序在本文件之前
   (见 index.html), 调用期解析安全。 */
function mathVariantTrack(family, variant) {
  return mathScreenDispatch(family, variant).kind === 'engine' ? 'screen' : 'world';
}

/* 世界轨 runner 清单: 变体键 → 装配入口(js/math-world.js, 加载序在
   本文件之前); boss 串联的"该节可跑吗"也查这里 */
const MATH_WORLD_RUNNERS = {
  'hop/dice': runHopWorld,
  'hop/jumps': runHopWorld,
  'hop/gaps': runHopWorld,
  'mirror/reflect': runBuildWorld, // T6 摆与搭: 指针锁宿主(与 hop 的混合
  'mirror/translate': runBuildWorld, // 宿主并列, 经本注册表分发; 宿主统一
  'mirror/rotate': runBuildWorld, // 留待后续票)
  'mirror/tangram': runBuildWorld,
  'plan/build': runBuildWorld,
  'plan/pick': runBuildWorld,
  'plan/hidden': runBuildWorld,
  'plan/countall': runBuildWorld,
};

function mathWorldRunner(family, variant) {
  return MATH_WORLD_RUNNERS[family + '/' + variant] || null;
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

/* ---------- 共享背包(T8, ADR 0002 / 设计稿 §5) ----------
    数学岛是共享背包的新「只产出」消费方: 进岛 init() 时 load 一次
    (双消费方共用存档介质, 重进必重读, 探险/专注同款); 只产出不消耗,
    掉落以基础材料为主(池与掷骰政策在 math-levels.js 的 MATH_LOOT/
    rollMathLoot, 可单测), 不得自开存档键(背包壳唯一持有)。 */
const mathBag = Backpack.mkBackpack();

/* 矿袋战利品会话状态(每关重置, focus F5 同款):
    mathLootSession: 本关入包明细 {id: n}(结算回顾与 HUD 计数的唯一数据源);
    mathBagFullSaid: 满包 toast 每关至多一次(政策在 grantMathLoot 纯函数,
    toast 节流在此); mathLastTap: 最近一次点击坐标 — 战利品飞行起点
    (引擎事件缝不带 DOM 信息, 模式层在 mathRoot 捕获期自记) */
let mathLootSession = null;
let mathBagFullSaid = false;
let mathLastTap = null;

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

/* mathFamChallengeDone(第三星挂钩判据)与 mathLevelStars(三星回溯星显
   单一出口)住库层 math-levels.js(判据与星表同源, 配单测) */

/* ---------- boss 串联与聚合(纯函数) ---------- */

/* boss 各小节附轨道标注: world 小节查 runner 决定跑(T5 hop)或跳(T6 前) */
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
   返回是否通过; 预算关数计数(b.count)由调用方先行, 图章取 spentCount;
   图章落账走库层纯函数(钳日限/同日 max/滚动 90 天, T8) */
function mathSettleSave(save, level, st, today) {
  const passed = mathPassed(level, st);
  if (passed) {
    save.stars[level.i] = Math.max(save.stars[level.i] || 0,
        mathStars(level, st, mathFamChallengeDone(save, level))); // 教学关 0 星入账=已通占位
    /* 三星回溯档(spec US35/D4): 素质线达标而族挑战未过 → stars 封顶 2 星,
       同时记 ready — 补过挑战后地图经 mathLevelStars 重算点亮第三星
       (stars 表不回写, 继续作历史最高; 挑战/boss 关自成条件不走 ready) */
    if (mathThreeStarReady(level, st) && !mathFamChallengeDone(save, level)) {
      save.ready[level.i] = true;
    }
    if (level.kind === 'challenge') save.challenge[level.family + ':' + level.band] = true;
    if (level.kind === 'boss') {
      for (const sec of level.sections || []) save.challenge[sec.family + ':' + level.band] = true;
    }
  }
  const fb = mathBudget();
  const n = fb ? fb.spentCount() : (save.stamps[today] || 0) + 1; // 无预算环境兜底(测试/离线)
  save.stamps = mathStampTrim(mathStampRecord(save.stamps || {}, today, n), today);
  save.log = trimMathLog(save.log || {}, today, MATH_LOG_KEEP_DAYS);
  const day = save.log[today] = save.log[today] || {};
  /* T9: 键升级 '族:带' — 家长面板六族×四带矩阵的数据源; 无冒号旧键
     (开发期形状)由 mathPanelMatrix 兼容读取(只入族合计), 不需要迁移 */
  const fk = level.family + ':' + level.band;
  const fam = day[fk] = day[fk] || {acc: 0, n: 0, chalN: 0, chalOk: 0};
  fam.acc = (fam.acc * fam.n + (st.acc || 0)) / (fam.n + 1);
  fam.n++;
  if (level.kind === 'challenge' || level.kind === 'boss') {
    fam.chalN++;
    if (passed) fam.chalOk++;
  }
  return passed;
}

/* 集章达成线领取(须在 mathSettleSave 之后、saveMathSave 之前调用, 就近写回
   save): 返回本次新达成的集章达成线(差集幂等, 已领不重发), 供结算屏仪式;
   奖励纯观感(图案三选一/烟花/金章), 永不解锁玩法(红线) */
function mathStampClaim(save) {
  const due = mathStampRewardsDue(mathStampCount(save.stamps || {}), save.stampClaimed || []);
  if (due.length) save.stampClaimed = (save.stampClaimed || []).concat(due);
  return due;
}

/* ---------- 战利品回路(T8): 政策纯函数在 math-levels.js, 此处只做装配与观感 ----------
    onTrial → rollMathLoot(内拦教学关/错误试次) → grantMathLoot 入共享背包
    + save → 飞入 HUD 矿袋槽位; 结算屏列队回顾; 满包每关至多一次 toast */

/* 授予流: 入包成功即 save(频率低, 不批量); 余量>0 静默忽略 + 每关至多一次
    toast「背包满啦」(零惩罚, 政策在 grantMathLoot 纯函数) */
function grantMathLootIntoBag(ids) {
  if (!mathLootSession) return {granted: [], full: false}; // 非关卡会话(防御)
  const res = grantMathLoot(mathBag.inv, ids);
  for (const id of res.granted) {
    mathLootSession[id] = (mathLootSession[id] || 0) + 1;
  }
  if (res.granted.length) mathBag.save();
  if (res.full && !mathBagFullSaid) {
    mathBagFullSaid = true;
    showToast('背包满啦', 2200);
  }
  return res;
}

/* 逐试次事件({ok, streak}, 引擎契约): streak 由引擎维护(答错清零),
    连对每满 3 保底稀有在纯函数内; boss 世界节传各节族的小节对象 */
function onMathTrialLoot(level, t) {
  const e = t || {};
  const id = rollMathLoot(level, {ok: e.ok, streak: e.streak});
  if (!id) return;
  if (grantMathLootIntoBag([id]).granted.length) flyMathLoot(id, mathLastTap);
}

/* 战利品飞行: iconOf 像素图标从点击位(缺省屏心 — 摆与搭指针锁宿主无
    点击位可记)沿贝塞尔弧线飞入矿袋槽位 — 位移经 CSS 变量 --dx/--dy 传给
    keyframes(样式在 css/math.css, 对齐 focus.css 纪律); 元素挂
    document.body(#mathRoot 的动画全关降级块管不到, 飞行在
    prefers-reduced-motion 下自退化为淡入); 落袋后更新 HUD 槽位 */
function flyMathLoot(id, from) {
  const hud = document.getElementById('mBagHud');
  if (!hud) return; // 无 HUD(教学关/已切屏): 静默放弃观感, 入包已完成
  const to0 = hud.getBoundingClientRect();
  if (!to0.width) return; // HUD 隐藏(摆与搭指针锁宿主隐了 DOM 屏): 放弃观感
  const fromPos = from || {x: innerWidth / 2, y: innerHeight / 2};
  const slot = hud.querySelector('.m-bag-slot[data-item="' + id + '"]');
  const r = (slot || hud).getBoundingClientRect(); // 已有槽飞向该槽, 新物品飞向收集条末端
  const to = {x: r.left + r.width / 2, y: r.top + r.height / 2};
  const el = document.createElement('img');
  el.src = iconOf(id);
  el.alt = '';
  el.className = 'm-loot-fly';
  el.style.left = (fromPos.x - 22) + 'px'; /* 中心点对齐(44px 图标) */
  el.style.top = (fromPos.y - 22) + 'px';
  el.style.setProperty('--dx', (to.x - fromPos.x) + 'px');
  el.style.setProperty('--dy', (to.y - fromPos.y) + 'px');
  document.body.appendChild(el);
  setTimeout(() => {
    el.remove();
    addMathBagSlot(id); // 落袋: 计数 + 弹跳 + 叮咚
  }, 620); // 与 keyframes 时长对齐(0.6s 弧线)
}

/* 矿袋 HUD 落袋: 同 id 并槽计数, 新物品开槽(槽满自动滚到最新), 槽位弹跳 +
    叮咚 sfx('pick')(与引擎答对音叠成双声部, 观感对齐 drops 真空吸附) */
function addMathBagSlot(id) {
  const hud = document.getElementById('mBagHud');
  if (!hud) return;
  let slot = hud.querySelector('.m-bag-slot[data-item="' + id + '"]');
  if (!slot) {
    slot = document.createElement('div');
    slot.className = 'm-bag-slot';
    slot.dataset.item = id;
    slot.title = ITEMS[id] ? ITEMS[id].name : id;
    slot.innerHTML = '<img draggable="false" alt="" src="' + iconOf(id) + '"><span class="m-bag-n"></span>';
    hud.appendChild(slot);
  }
  const n = mathLootSession ? (mathLootSession[id] || 1) : 1;
  slot.querySelector('.m-bag-n').textContent = n > 1 ? '×' + n : '';
  hud.scrollLeft = hud.scrollWidth; // 槽满滚动: 最新拾取始终可见
  slot.classList.remove('bump');
  void slot.offsetWidth;
  slot.classList.add('bump');
  sfx('pick');
}

/* 结算屏战利品回顾(设计稿 §5 D8): 本关获得列队 + 计数 — 级联进场逐件
    pop(星星爆开之后), 无获得不渲染区块 */
function mathLootRecapHtml() {
  const n = Object.keys(mathLootSession || {}).length;
  return n ? '<div class="m-loot-recap" id="mLootRecap"><span class="m-loot-title">🎒 本关收获</span></div>' : '';
}
function runMathLootRecap() {
  const box = document.getElementById('mLootRecap');
  if (!box) return;
  Object.entries(mathLootSession || {}).forEach(([id, n], k) => {
    setTimeout(() => {
      if (!document.getElementById('mLootRecap')) return; // 已切屏: 中止列队
      const nm = ITEMS[id] ? ITEMS[id].name : id;
      const item = document.createElement('span');
      item.className = 'm-loot-item';
      item.title = nm;
      item.innerHTML = '<img draggable="false" alt="' + nm + '" src="' + iconOf(id) + '">' +
          (n > 1 ? '<b>×' + n + '</b>' : '');
      box.appendChild(item);
      if (k < 3) sfx('pick'); // 声音节流: 只前 3 件
    }, 220 * k + 250);
  });
}

/* ---------- 图章一本(T8): 纯函数在 math-levels.js, 此处只做呈现 ----------
    当日 ≥1 关盖普通章(图案 stampKind 三选一自选, 缺省宝石章), 满 3 关盖
    大章; 漏签空白无负面标记; 集章达成线只发观感奖励(图案/烟花/金章),
    永不解锁关卡/难度(红线); 日历条挂在今日页, 今日进度行今日页/地图页共用 */
const MATH_STAMP_KIND_NAMES = {gem: '宝石图章', star: '星星图章', plus: '加号图章'};

function mathStampKindOf(save) { // 损坏/缺省回落宝石章(与 migrateMathSave 同一白名单)
  return save && MATH_STAMP_KINDS.includes(save.stampKind) ? save.stampKind : 'gem';
}

/* 本月日历条(本月外不渲染) */
function mathStampCalendarHtml(save) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const days = new Date(year, month + 1, 0).getDate(); // 本月总天数
  const todayStr = mathTodayStr(now.getTime());
  const kind = mathStampKindOf(save);
  const total = mathStampCount(save.stamps);
  let cells = '';
  for (let d = 1; d <= days; d++) {
    const key = mathTodayStr(new Date(year, month, d).getTime()); // 日期键单点出口
    const n = save.stamps[key] || 0;
    const ico = n >= MATH_STAMP_DAILY.big ? stampIcon('big') :
        n >= MATH_STAMP_DAILY.min ? stampIcon(kind) : '';
    cells += '<div class="m-stamp-cell' + (key === todayStr ? ' m-stamp-today' : '') + '">' +
      (ico ? '<img draggable="false" alt="" src="' + ico + '">' : '') +
      '<span>' + d + '</span></div>';
  }
  // 金图章: 30 章起日历头部常驻(纯观感, 不占章位)
  const gold = total >= 30 ?
      '<img class="m-stamp-gold" draggable="false" alt="" src="' + stampIcon('gold') + '">' : '';
  return '<div class="m-stamp-cal"><div class="m-stamp-title">📅 ' + (month + 1) + ' 月的图章 · 已集 ' +
      total + ' 枚' + gold + '</div><div class="m-stamp-grid">' + cells + '</div></div>';
}

/* 今日图章进度行(今日页/地图页共用露出): 今日盖章状态 + 集章进度 */
function mathStampTodayHtml(save) {
  const today = mathTodayStr();
  const n = (save.stamps && save.stamps[today]) || 0;
  const total = mathStampCount(save.stamps);
  const next = mathStampNextLine(total);
  const ico = n >= MATH_STAMP_DAILY.big ? stampIcon('big') :
      n >= MATH_STAMP_DAILY.min ? stampIcon(mathStampKindOf(save)) : '';
  const line = n >= MATH_STAMP_DAILY.big ? '今天的大图章盖好啦！' :
      n >= MATH_STAMP_DAILY.min ? '图章盖上啦，再玩 ' + (MATH_STAMP_DAILY.big - n) + ' 关换大章！' :
      '今天玩 1 关就能盖图章哦！';
  const goal = next ? ' · 再集 ' + (next - total) + ' 枚有新奖励' : '';
  return '<div class="m-stamp-row">' + (ico ? '<img draggable="false" alt="" src="' + ico + '">' : '') +
      '<span>' + line + ' 已集 ' + total + ' 枚' + goal + '</span></div>';
}

/* 结算屏图章块: 今日图章(新盖弹跳) + 集章进度(下一达成线) */
function mathStampBlockHtml(save, stampNew, stampBig) {
  const total = mathStampCount(save.stamps);
  const next = mathStampNextLine(total);
  const ico = stampBig ? stampIcon('big') : stampIcon(mathStampKindOf(save));
  const head = stampBig ? '今天集满 ' + MATH_STAMP_DAILY.big + ' 关，大图章！' :
      stampNew ? '今天的图章盖上啦！' : '今天的图章已经盖好啦';
  const goal = next ? ' · 再集 ' + (next - total) + ' 枚有新奖励' : '';
  return '<div class="m-stamp-block' + ((stampNew || stampBig) ? ' pop' : '') + '">' +
      '<img draggable="false" alt="图章" src="' + ico + '">' +
      '<span>' + head + ' · 已集 ' + total + ' 枚' + goal + '</span></div>';
}

/* 集章授予仪式块: 奖励声明 + 三选一图案选择器(达成 stamp_pattern 线时) */
function mathStampAwardHtml(lines, save) {
  if (!lines || !lines.length) return '';
  const items = lines.map((line) => '<div>🎖️ ' + MATH_STAMP_REWARD_TEXT[mathStampRewardFor(line)] + '</div>').join('');
  const pattern = lines.some((line) => mathStampRewardFor(line) === 'stamp_pattern');
  const picker = pattern ? '<div class="m-stamp-pick" id="mStampPick">' +
      '<div class="m-stamp-pick-label">选一个你喜欢的图章</div>' +
      MATH_STAMP_KINDS.map((kind) => '<button type="button" data-kind="' + kind + '"' +
          (kind === mathStampKindOf(save) ? ' class="on"' : '') + ' title="' +
          MATH_STAMP_KIND_NAMES[kind] + '" aria-label="' + MATH_STAMP_KIND_NAMES[kind] + '">' +
          '<img draggable="false" alt="" src="' + stampIcon(kind) + '"></button>').join('') +
      '</div>' : '';
  return '<div class="m-award"><b>集齐 ' + lines[lines.length - 1] + ' 枚图章啦！</b>' + items + '</div>' + picker;
}

/* 三选一图案选择器接线: 选中即写存档并高亮, 日历下次渲染即用新图案 */
function wireMathStampPicker(save) {
  const box = document.getElementById('mStampPick');
  if (!box) return;
  const buttons = [...box.querySelectorAll('button')];
  const mark = () => buttons.forEach((b) => b.classList.toggle('on', b.dataset.kind === mathStampKindOf(save)));
  mark();
  buttons.forEach((btn) => {
    btn.onclick = () => {
      save.stampKind = btn.dataset.kind;
      saveMathSave(save);
      mark();
      sfx('pick');
      SpeechKit.speak(MATH_STAMP_KIND_NAMES[btn.dataset.kind]);
    };
  });
}

/* 一次性 CSS 粒子迸发(firework 奖励, focus F9 box-shadow 粒子同款手法);
    样式在 css/math.css, prefers-reduced-motion 下动画全关且基础 opacity=0 */
function launchMathFirework() {
  if (!mathRoot) return;
  const el = document.createElement('div');
  el.className = 'm-firework';
  el.setAttribute('aria-hidden', 'true');
  mathRoot.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

/* 已领奖励判定(观感恢复用): 数学侧只查 firework — 今日页进场迸发一次 */
function mathStampRewardOn(claimed, rid) {
  return (claimed || []).some((line) => mathStampRewardFor(line) === rid);
}

/* ---------- 根容器与屏幕 ---------- */
let mathRoot = null;
let mathTicker = 0;
let mathTickT0 = 0;
let mathCtrl = null; // 进行中关卡的控制柄(引擎 {stop()})
let mathAutoTimer = 0; // 结算屏自动续程计时
let mathClockTimer = 0; // 常驻昼夜大钟走针计时(G1)
const mathFailCount = {}; // 本关连续未通过次数 → 重试话术与"先玩别的"

/* 常驻昼夜大钟(G1, spec US30 前半): 今日页/地图页右上一枚小钟面, 真实
   本地时间驱动, 每分钟走针(mathAutoTimer 同款清理纪律 — mathScreen 统一
   收口 + 出模式清理); 点击钟面 → SpeechKit 报时, 口径出自 mClockSay 纯
   函数(整时「X 点整」/半时「X 点半」/其余「X 点 Y 分」, 一年级教材);
   钟面渲染复用屏流引擎的谜题钟部件 mClockFace(12/3/6/9 刻度同形态) */
function stopMathClock() {
  if (mathClockTimer) {
    clearInterval(mathClockTimer);
    mathClockTimer = 0;
  }
}

function mountMathClock() {
  stopMathClock();
  const box = document.getElementById('mClockBox');
  if (!box) return;
  const tick = () => {
    const now = new Date();
    box.innerHTML = ''; // 整面重画: 走针即换角度, 不留旧针
    const face = mClockFace(box, (now.getHours() % 12) || 12, now.getMinutes());
    face.classList.add('m-clock-live');
    face.onclick = () => {
      const t = new Date();
      SpeechKit.speak(mClockSay(t.getHours(), t.getMinutes())); // 报点击当下时刻
    };
  };
  tick();
  mathClockTimer = setInterval(tick, 60000); // 每分钟走针(分针 6°/分)
}

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
  /* 战利品飞行起点自记(T8): 捕获期挂在 mathRoot 上 — 屏流训练区与
     世界轨接球层都在它内部, 一处监听两轨通用(focusLastTap 同款:
     引擎事件缝不带 DOM 信息, 模式层自记); 指针锁宿主的点击不经过
     DOM, mathLastTap 保持 null → 飞行回落屏心 */
  mathRoot.addEventListener('pointerdown', (e) => {
    mathLastTap = {x: e.clientX, y: e.clientY};
  }, true);
  document.body.appendChild(mathRoot);
}

function mathScreen(html) {
  clearTimeout(mathAutoTimer);
  stopMathClock(); // 常驻钟面只在今日页/地图页挂(mathAutoTimer 同款收口)
  mathRoot.innerHTML = '<div class="m-top"><button class="m-back" id="mBackBtn" aria-label="返回">' +
      btnImg('left') + '</button><div class="m-clockbox" id="mClockBox"></div></div>' + html;
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
  stopMathClock();
  SpeechKit.cancel();
  mathRoot.style.display = 'none';
  overlay.style.display = 'flex';
  showPage('main');
}

/* ---------- 今日页: 进度概览 + 图章日历(T8) + 进入地图 ----------
    家长面板入口由 T9 票在此页续建 */
function showMathToday() {
  stopMathTicker();
  const save = loadMathSave();
  const locked = mathLocked();
  const played = mathBudget() ? mathBudget().spentCount() : 0;
  const total = Object.values(save.stars).reduce((s, x) => s + x, 0);
  const cur = mathFrontier(save);
  const curLv = MATH_LEVELS[cur];
  const curMeta = mathLevelMeta(curLv); // 情境关以情境名为场馆(T7)
  const dots = Array.from({length: MATH_DAILY_LEVELS}, (_, k) =>
    '<span class="dot ' + (k < played ? 'done' : '') + '"></span>').join('');
  if (locked) {
    mathScreen(`
      <div class="m-screen m-today">
        <h1>今天的数学冒险完成啦！</h1>
        <p class="m-sub">小岛要休息了，明天再来吧 · ⭐${total}</p>
        <div class="m-dots">${dots}</div>
        ${mathStampTodayHtml(save)}
        ${mathStampCalendarHtml(save)}
        <button class="m-parent-btn" id="mParentBtn">${btnImg('lock')} 家长</button>
        <button class="m-btn" id="mHome2">${btnImg('house')} 回主页</button>
      </div>`);
    document.getElementById('mHome2').onclick = mathExit;
    document.getElementById('mParentBtn').onclick = showMathParentGate;
    mountMathClock(); // G1 常驻钟面: 锁定日也看钟
    if (mathStampRewardOn(save.stampClaimed, 'firework')) launchMathFirework(); // 集章烟花(观感恢复)
    return;
  }
  mathScreen(`
    <div class="m-screen m-today">
      <h1>数学冒险岛</h1>
      <p class="m-sub">第 ${cur + 1} 关 / 100 · ⭐${total} · 每天 ${MATH_DAILY_LEVELS} 关 / ${MATH_DAILY_MIN} 分钟</p>
      <div class="m-dim-icon">${curMeta.icon}</div>
      <p class="m-sub">${curMeta.game} · ${mathVariantName(curLv.family, curLv.variant)}</p>
      <button class="m-start" id="mStartBtn">▶ 开始冒险</button>
      <div class="m-dots">${dots}</div>
      ${mathStampTodayHtml(save)}
      ${mathStampCalendarHtml(save)}
      <button class="m-parent-btn" id="mParentBtn">${btnImg('lock')} 家长</button>
    </div>`);
  SpeechKit.speak('欢迎来到数学冒险岛！今天我们来玩' + curMeta.game + '。');
  document.getElementById('mStartBtn').onclick = showMathMap;
  document.getElementById('mParentBtn').onclick = showMathParentGate;
  mountMathClock(); // G1 常驻钟面: 看岛上的昼夜大钟(US30 前半)
}

/* ---------- 家长面板(T9): 算术门 → 六族×四带矩阵 + 思维挑战通过率 + CSV ----------
    口径纪律(spec 宣称边界): 只报过程指标(正确率/次数), 不做能力诊断,
    不提成绩/智力提升; 形态对齐 focus 家长面板(门/表/CSV/免责) */
function showMathParentGate() {
  const a = 5 + Math.floor(Math.random() * 5); const b = 5 + Math.floor(Math.random() * 5);
  const ans = a + b;
  const opts = [ans, ans + 1 + Math.floor(Math.random() * 3),
    Math.max(2, ans - 1 - Math.floor(Math.random() * 3))].sort(() => Math.random() - 0.5);
  mathScreen(`
    <div class="m-screen">
      <h1>家长入口</h1>
      <p class="m-sub">请回答：${a} + ${b} = ?</p>
      <div class="m-gate-row">${opts.map((o) => '<button class="m-btn" data-a="' + o + '">' +
          o + '</button>').join('')}</div>
    </div>`);
  document.querySelectorAll('#mathRoot .m-gate-row button').forEach((btn) => {
    btn.onclick = () => {
      if (parseInt(btn.dataset.a, 10) === ans) {
        showMathParent();
      } else {
        showMathToday();
      }
    };
  });
}

function showMathParent() {
  const save = loadMathSave();
  const mb = mathBudget();
  const played = mb ? mb.spentCount() : 0;
  const mins = Math.round((mb ? mb.spentMs() : 0) / 60000);
  const total = Object.values(save.stars).reduce((s, x) => s + x, 0);
  const cur = mathFrontier(save);
  const mx = mathPanelMatrix(save.log);
  let chalN = 0; let chalOk = 0;
  for (const r of mx.rows) {
    chalN += r.chalN; chalOk += r.chalOk;
  }
  const cell = (c) => c.n ? Math.round(c.acc * 100) + '% (' + c.n + ')' : '—';
  /* 近 7 日正确率迷你折线(US42, focus 家长面板 spark 同形态): 数据源
     mathPanelTrend(最近 7 个有记录日按 n 加权的族 acc 序列); <2 点显示 — */
  function mathSpark(series) {
    if (series.length < 2) return '—';
    const W = 120; const H = 36;
    const pts = series.map((x, k) =>
      (k * (W / (series.length - 1))).toFixed(1) + ',' +
      (H - 2 - (H - 6) * x.acc).toFixed(1)).join(' ');
    return `<svg width="${W}" height="${H}" class="m-spark">` +
        `<polyline points="${pts}" fill="none" stroke="#7cfc00" stroke-width="2"/></svg>`;
  }
  mathScreen(`
    <div class="m-screen m-parent">
      <h1>家长面板</h1>
      <div class="m-stat-row">
        <div class="m-stat">今日 <b>${played}</b>/${MATH_DAILY_LEVELS} 关 · <b>${mins}</b> 分钟</div>
        <div class="m-stat">累计 <b>${cur + 1}</b>/100 关 · ⭐${total}</div>
        <div class="m-stat">思维挑战 <b>${chalN ? Math.round(chalOk / chalN * 100) : 0}%</b>（${chalOk}/${chalN}）</div>
      </div>
      <table class="m-table">
        <tr><th>玩法</th>${MATH_BAND_NAMES.map((n) => '<th>' + n + '</th>').join('')}
            <th>合计</th><th>思维挑战</th><th>趋势</th></tr>
        ${mx.rows.map((r) => '<tr><td>' + MATH_META[r.family].icon + ' ' + MATH_META[r.family].name + '</td>' +
            r.cells.map((c) => '<td>' + cell(c) + '</td>').join('') +
            '<td>' + cell(r) + '</td><td>' + (r.chalN ? r.chalOk + '/' + r.chalN : '—') + '</td>' +
            '<td>' + mathSpark(mathPanelTrend(save.log, r.family)) + '</td></tr>').join('')}
      </table>
      <div class="m-note">
        本模式是<b>数数、加减、找规律、推理与空间构造的结构化练习</b>（难度对齐教材扩展题/附加题水平）。
        面板只展示过程指标（正确率与练习次数），<b>不是能力测评</b>；
        不宣称提升数学成绩或智力（游戏化学习的整体效应小且证据不一）。
        低年级孩子的数学表现随发育波动很大，偶尔出错完全正常；
        如在<b>家庭和学校等多个场景</b>持续存在困难并影响生活，请与老师或儿科医生沟通。
      </div>
      <div class="m-btn-row">
        <button class="m-btn" id="mCsvBtn">${btnImg('doc')} 导出记录 CSV</button>
        <button class="m-btn" id="mParentBack">${btnImg('house')} 返回</button>
      </div>
    </div>`);
  document.getElementById('mParentBack').onclick = showMathToday;
  document.getElementById('mCsvBtn').onclick = () => {
    const rows = mathPanelCsv(save);
    const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
    a.download = '数学冒险岛记录.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
}

/* ---------- 关卡地图页: 四带分组 · 星显 · 锁定/解锁 · 当前关高亮 ---------- */
const MATH_BAND_NAMES = ['一年级上', '一年级下', '二年级上', '二年级下'];

function mathVariantName(family, variant) {
  const ctx = MATH_CONTEXTS[variant];
  if (ctx && ctx.family === family) return ctx.name; // 情境变体名住 MATH_CONTEXTS(T7)
  const v = (MATH_VARIANTS[family] || []).find((x) => x.id === variant);
  return v ? v.name : variant;
}

/* 关卡话术元数据(T7+G2): 情境关(shop/clock/measure)以情境名为场馆名,
   规则/提示换情境级话术(MATH_CONTEXTS), 图标沿用承载族 — 情境只换
   皮肤, 配重/战利品/日志全随族; 变体表带 rule 的变体(移多补少搬动
   试错)只覆盖规则话术, 名/场馆/提示仍走族元数据; 常规关原样返回族元数据 */
function mathLevelMeta(level) {
  const fam = MATH_META[level.family];
  const ctx = MATH_CONTEXTS[level.variant];
  if (ctx && ctx.family === level.family) {
    return {name: fam.name, game: ctx.name, icon: fam.icon, rule: ctx.rule, tip: (p) => ctx.tip(p)};
  }
  const v = (MATH_VARIANTS[level.family] || []).find((x) => x.id === level.variant);
  if (v && v.rule) {
    return {name: fam.name, game: fam.game, icon: fam.icon, rule: v.rule, tip: fam.tip};
  }
  return fam;
}

function showMathMap() {
  stopMathTicker();
  const save = loadMathSave();
  const frontier = mathFrontier(save);
  let html = '<div class="m-screen m-map"><h1>关卡地图</h1>' +
      mathStampTodayHtml(save); /* T8: 地图页露出今日图章进度(与今日页同款) */
  for (let band = 0; band < 4; band++) {
    html += '<div class="m-band"><div class="m-band-title">' + MATH_BAND_NAMES[band] +
        '</div><div class="m-band-grid">';
    for (let k = 0; k < 25; k++) {
      const i = band * 25 + k;
      const lv = MATH_LEVELS[i];
      const unlocked = mathLevelUnlocked(save, i);
      /* 三星回溯: 应显星数经 mathLevelStars 重算(补过挑战点亮旧关第三星),
         stars 表本身仍是历史最高口径 */
      const stars = mathLevelStars(save, lv);
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
  mountMathClock(); // G1 常驻钟面: 选关时也能看钟报时
  SpeechKit.speak('选一个关卡开始吧！');
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
  /* 六族变体已全部在册(屏流或世界轨, test 单一权威断言守门) — 不再有
     "建设中"占位分支; 未登记变体属清单漂移, 由测试拦截而非运行时兜底 */
  const meta = mathLevelMeta(level); // 情境关话术覆盖(T7)
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


/* 摆与搭世界轨(T6)离场收口: 只收当前 runner(清 HUD/热栏/触屏键) ·
   交还指针(uiPause → onLockChanged → MathMode.onMenu, 彼时已无进行中
   关卡, 只收 overlay) · 复明 DOM 屏。不调 mathStopRun — 那会顺手掐死
   boss 链的 mathBossStop 旗(世界小节收尾时链条必须活着走下一节;
   Esc/退出的整链中止归 onMenu)。hop 轨不锁指针不走 uiPause, 幂等无害 */
function mathWorldLeave() {
  if (mathCtrl) {
    mathCtrl.stop();
    mathCtrl = null;
  }
  if (document.pointerLockElement || (typeof touchPlaying !== 'undefined' && touchPlaying)) {
    uiPause();
  }
  mathRoot.style.display = 'block';
}

function beginMathRun(level) {
  startMathTicker();
  /* T8 矿袋会话状态: 每关一份新明细 / 满包 toast 节流计数 / 飞行起点 */
  mathLootSession = {};
  mathBagFullSaid = false;
  mathLastTap = null;
  const meta = mathLevelMeta(level); // 情境关话术覆盖(T7)
  const kindTag = mathKindTag(level.kind);
  const world = level.kind !== 'boss' && mathVariantTrack(level.family, level.variant) === 'world';
  /* 世界轨关卡: 同一条头部(规则+进度), 训练区让给 3D 场景(装场与任务卡
     覆层由 js/math-world.js 自管, mathRoot 切透明背景); 屏流关卡照旧;
     矿袋 HUD 教学关不渲染(教学豁免在纯函数, 观感上也零预期, focus 同款) */
  mathScreen(`
    <div class="m-level-head">
      <div class="m-lrule"><span class="m-rule-icon">${meta.icon}</span>
        <span class="m-rule-text">${meta.game} · ${mathVariantName(level.family, level.variant)}${kindTag}</span></div>
      <div class="m-rule-small">${meta.rule}</div>
      <div class="m-progress"><div class="m-progress-bar" id="mProg"></div></div>
    </div>
    ${world ? '' : '<div class="m-area" id="mArea"></div>'}
    ${level.kind === 'tutorial' ? '' : '<div class="m-bag" id="mBagHud" aria-hidden="true"></div>'}`);
  document.getElementById('mBackBtn').onclick = () => {
    mathStopRun();
    SpeechKit.cancel();
    showMathMap();
  };
  const setProg = (k, n) => {
    const bar = document.getElementById('mProg');
    if (bar) bar.style.width = Math.round(k / Math.max(1, n) * 100) + '%';
  };
  const areaEl = document.getElementById('mArea');
  if (level.kind === 'boss') {
    runMathBoss(level, areaEl, setProg);
    return;
  }
  if (world) {
    mathCtrl = mathWorldRunner(level.family, level.variant)({family: level.family,
      variant: level.variant, tier: level.tier, kind: level.kind, params: level.params,
      seed: level.i * 7919 + 13}, {
      progress: setProg,
      onTrial(t) {
        onMathTrialLoot(level, t); /* T8: 逐试次掷骰入矿袋(教学豁免在纯函数) */
      },
      end(st) {
        mathWorldLeave(); /* T6 摆与搭指针锁宿主离场(hop 幂等无害) */
        onMathLevelEnd(level, st);
      },
    });
    return;
  }
  mathCtrl = runMathScreen({family: level.family, variant: level.variant, tier: level.tier,
    kind: level.kind, params: level.params, seed: level.i * 7919 + 13}, areaEl, {
    progress: setProg,
    onTrial(t) {
      onMathTrialLoot(level, t); /* T8: 逐试次掷骰入矿袋(教学豁免在纯函数) */
    },
    end(st) {
      onMathLevelEnd(level, st);
    },
  });
}

/* boss 串联: 按 sections 顺序连跑三小节, world 小节进 3D 场景(track 派生,
   六族变体全在册无跳过分支); 聚合 st 按单关口径结算(mathAggStats) */
function runMathBoss(level, areaEl, setProg) {
  const plan = mathBossPlan(level);
  const statsList = [];
  const totalTrials = plan
      .reduce((a, s) => a + Math.max(1, Math.min(30, (s.params && s.params.trials) || 6)), 0);
  let si = 0;
  let doneTrials = 0;
  let stopped = false;
  function step() {
    if (stopped) return;
    if (si >= plan.length) {
      mathCtrl = null;
      onMathLevelEnd(level, mathAggStats(statsList));
      return;
    }
    const s = plan[si];
    SpeechKit.speak('新挑战：' + MATH_META[s.family].game + '！');
    const secEnd = (st) => {
      statsList.push(st);
      doneTrials += st.trials || 0;
      si++;
      mathCtrl = null;
      if (s.track === 'world') mathWorldLeave(); /* T6 指针锁宿主离场(hop 幂等无害) */
      setTimeout(() => {
        if (!stopped) step();
      }, 400);
    };
    if (s.track === 'world') { // 世界节: 3D 场景跑(自带任务卡覆层, 屏流区让位)
      mathCtrl = mathWorldRunner(s.family, s.variant)({family: s.family,
        variant: s.variant, tier: s.tier, kind: 'challenge', params: s.params,
        seed: level.i * 7919 + si * 101}, {
        progress(k, n) {
          setProg(doneTrials + k, totalTrials);
        },
        onTrial(t) {
          onMathTrialLoot({family: s.family, kind: 'challenge'}, t); /* T8: 按小节族掷骰 */
        },
        end: secEnd,
      });
      return;
    }
    mathCtrl = runMathScreen({family: s.family, variant: s.variant, tier: s.tier,
      kind: 'challenge', params: s.params, seed: level.i * 7919 + si * 101}, areaEl, {
      progress(k, n) {
        setProg(doneTrials + k, totalTrials);
      },
      onTrial(t) {
        onMathTrialLoot({family: s.family, kind: 'challenge'}, t); /* T8: 按小节族掷骰 */
      },
      end: secEnd,
    });
  }
  mathBossStop = () => {
    stopped = true;
  };
  step();
}

/* ---------- 结算: 判定/星显/过程表扬/战利品回顾/图章进度/自动续程 ---------- */
function onMathLevelEnd(level, st) {
  mathCtrl = null;
  clearTimeout(mathAutoTimer);
  stopMathTicker();
  const save = loadMathSave();
  const today = mathTodayStr();
  const fb = mathBudget();
  if (fb) {
    fb.count(1);
    fb.flush();
  } // 无论通过与否都计入每日额度(防疲劳刷, focus 同款)
  const prevStamp = save.stamps[today] || 0; // 结算前的今日关数(判新章/大章)
  const passed = mathSettleSave(save, level, st, today);
  const stampDue = mathStampClaim(save); // T8: 集章达成线领取(就近写回, 差集幂等)
  saveMathSave(save);
  const nowStamp = (save.stamps[today] || 0);
  const stampNew = prevStamp < MATH_STAMP_DAILY.min && nowStamp >= MATH_STAMP_DAILY.min;
  const stampBig = prevStamp < MATH_STAMP_DAILY.big && nowStamp >= MATH_STAMP_DAILY.big;
  /* 星显走 mathLevelStars(三星回溯单一出口): stars 表已在 mathSettleSave
     写过(历史最高), 此处按当前挑战状态重算展示(补过挑战=3 星即时可见) */
  const stars = passed ? mathLevelStars(save, level) : 0;
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
  /* TTS 优先级: 集章仪式 > (通过=表扬+新章 / 未过=换路提示或安慰) — 结算屏只有一次开口 */
  const stampNames = stampDue.map((line) => MATH_STAMP_REWARD_TEXT[mathStampRewardFor(line)]).join('、');
  const spoken = stampDue.length ? '集齐图章啦！获得' + stampNames + '！' :
      !passed && moveOn ? '你已经很努力了！我们先去玩别的，以后再来挑战这一关。' :
      praise + (stampNew ? ' 今天的图章盖上啦！' : '');

  if (passed) {
    const starSpans = [1, 2, 3].map((n) =>
      '<span class="st ' + (n <= stars ? 'on' : '') + '" data-n="' + n + '">⭐</span>').join('');
    mathScreen(`
      <div class="m-screen m-result">
        <div class="m-stars" id="mStars">${starSpans}</div>
        <h1>${level.kind === 'tutorial' ? '学会啦！' : '通过！'}</h1>
        <p class="m-sub">正确 ${accPct}%</p>
        <div class="m-result-bubble"><span class="m-bubble">${praise}</span></div>
        ${mathLootRecapHtml()}
        ${mathStampBlockHtml(save, stampNew, stampBig)}
        ${mathStampAwardHtml(stampDue, save)}
        <button class="m-start" id="mNextBtn">继续 ▶</button>
      </div>`);
    SpeechKit.speak(spoken);
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
        ${mathLootRecapHtml()}
        ${mathStampBlockHtml(save, stampNew, stampBig)}
        ${mathStampAwardHtml(stampDue, save)}
        <button class="m-start" id="mNextBtn">${moveOn ? '先玩下一关 ▶' : '再来一次 ↺'}</button>
        <button class="m-btn" id="mBackMap">${btnImg('grid')} 回地图</button>
      </div>`);
    SpeechKit.speak(spoken);
  }
  wireMathStampPicker(save); // 三选一图案(未达成时无节点, 自动 no-op)
  if (stampDue.some((line) => mathStampRewardFor(line) === 'firework')) launchMathFirework();
  runMathLootRecap(); // T8: 本关收获列队进场(星星之后, 无获得零渲染)
  if (stampDue.length) { // 集章仪式: 奖励声明 toast + 晋升琶音(观感奖励, 与关卡解锁无关)
    showToast('🎖️ 集章奖励：' + stampNames + '！', 2600);
    sfx('level');
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
  hotbar: mathWorldHb, /* T6 摆与搭三色材料栏: 屏流页 chrome 全关时隐藏,
     世界试次由引擎自行 show/hide; digit/wheel/点选经 mkMode 全自动 */
  /* T6 摆与搭点选路由: 瞄准射线的 hit 由输入层算好喂入(准星/指尖即所操作) */
  onMouse(button, hit) {
    if (mathCtrl && mathCtrl.onMouse) mathCtrl.onMouse(button, hit);
  },
  /* 指针解锁(Esc/暂停/时限)只在摆与搭世界轨发生: 有进行中关卡=中止回
     地图(该引擎隐了 DOM 屏, 回图要复明), 无=纯收 overlay(结算屏即将
     接管, 不露主菜单) */
  onMenu() {
    if (mathCtrl) {
      mathStopRun();
      SpeechKit.cancel();
      mathRoot.style.display = 'block';
      showMathMap();
    }
    overlay.style.display = 'none';
  },
  init() {
    ensureMathRoot();
    mathRoot.style.display = 'block';
    overlay.style.display = 'none';
    mathBag.load(); // 共享背包读档(T8, ADR 0002: 重进必重读, focus/探险同款)
    showMathToday();
  }, // 纯点选全屏 UI: chrome 全关由 kit 默认处理(focus 同款)
  cleanup() {
    clearTimeout(mathAutoTimer);
    mathStopRun();
    stopMathTicker();
    stopMathClock();
    SpeechKit.cancel();
    if (mathRoot) mathRoot.style.display = 'none';
  },
});
