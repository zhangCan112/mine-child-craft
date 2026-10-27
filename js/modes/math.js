'use strict';
/* ============================================================
   Math Island Mode (数学冒险岛模式, 术语见 GLOSSARY.md) — 模式层
   ------------------------------------------------------------
   一句话职责: 装配数学冒险岛的屏幕流(今日页/关卡地图/关卡 runner/
   结算/boss 串联)与全部应用层文案; 玩法决策纯函数在 js/math-levels.js
   与 js/math-paradigms.js(屏流引擎), 本文件只做流程装配。
   interface: MathMode(mkMode 注册对象, id='math') ·
     纯流程函数(单测直测, test/math-paradigms.test.js 后半):
     mathFrontier(save) · mathLevelUnlocked(save, i) ·
     mathSettleSave(...) ·
     mathStampClaim(save)(T8 集章达成线领取) ·
     mathLevelMeta(level)(情境关话术覆盖, T7);
     分发/boss 规划/聚合已迁世界轨驱动器侧(T4): MathTrack.dispatch ·
     MathTrackCore.bossPlan/aggStats(js/math-track-core.js 与 js/math-track.js);
     mathFamChallengeDone/mathLevelStars(第三星挂钩判据与三星回溯星显)住
     库层 math-levels.js, 本文件只调用(判据与星表同源, 配单测)
   依赖(均经全局名, 调用期解析): mkMode(js/mode-kit.js) ·
     SpeechKit(js/speech.js) · showToast(js/effects.js) ·
     btnImg(js/button-icons.js) · Budgets/MATH_DAILY_*(js/daily-budget.js
     与 main.js setupBudgets 建立的 math 预算) · SyncDB(js/sync.js) ·
     DEV(js/config.js, ?dev=1 关卡全开 — mathLevelUnlocked 读侧旁路,
     docs/dev-mode-design.md D3; typeof 守卫兼容 vm 精简装载) ·
     Backpack(js/backpack.js, ADR 0002 共享背包 — 数学岛是只产出的新消费方,
     T8) · ITEMS(js/items-core.js) · iconOf(js/icons.js, 调用期解析) ·
     CampKit(js/camp-kit.js — 战利品回路五件套(C1-T1)与图章仪式四件套
     (C1-T2)收编, 加载序在本文件之前) ·
     stampIcon(js/focus-icons.js, T8 数学自选章图案) ·
     MATH_*(js/math-levels.js) · PuzzleCore(js/math-puzzles-core.js) ·
     RandCore(js/rand-core.js, 关卡种子派生 seedAt) ·
     MathTrack(js/math-track.js, 世界轨驱动器 — 分发/单节生命周期/boss
     串链, T4 起关卡 runner 一律经它启动; 本文件不再直调 runMathScreen/
     runHopWorld/runBuildWorld, 也不持 mathCtrl/mathBossStop 两条命) ·
     mathWorldHb(js/math-build-world.js, mkMode 挂 digit/wheel) ·
     mClockFace/mClockSay(js/math-paradigms.js, G1 常驻钟面复用
     谜题钟部件渲染形态与报时口径纯函数) ·
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
   F5 纪律; 授予/飞行/落袋/回顾观感件自 C1-T1 起住 CampKit 的
   mathLootHud 实例, 飞行起点经 noteTap 自记点击坐标 — 引擎事件缝
   不带 DOM 信息)→ 结算屏战利品列队回顾; 满包每关至多一次「背包满啦」
   toast; 图章一本独立于专注训练营(日历/自选章图案/集章达成线
   领奖, 纯函数在 math-levels.js, 奖励纯观感不解锁玩法)。
   ★ 分发与生命周期(T4 起收进世界轨驱动器 js/math-track.js):
   MathTrack.dispatch(family, variant) 返回 'screen' | 'world' | null
   (T5-b 纯查表: 未册键 null), 关卡节
   一律经 MathTrack.run/runBoss 启动 — 驱动器担保「清完再发 end」的统一
   时序与离场收口(leave/stop), boss 串链/聚合在 MathTrackCore; 三交互
   插件经统一注册表 MATH_TRACK_RUNNERS 入册(T5-b): hop 三变体=
   js/math-world.js 混合宿主 · mirror/plan 十变体=js/math-build-world.js
   指针锁宿主 · 屏流 16 变体=js/math-paradigms.js 屏流引擎; 29 变体已
   全部在册("建设中"占位屏已随全册退役; 未登记变体属清单漂移, 由 test
   单一权威断言拦截)。
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
function mathPraiseLine() { // 随机取行件自 C1-T4 起住 CampKit; 全局名是三引擎 typeof 守卫调用契约, 不改不删
  return CampKit.pickLine(MATH_PRAISE);
}
function mathComfortLine() {
  return CampKit.pickLine(MATH_COMFORT);
}

/* ---------- 每日预算(每日关数/时长): 记在 js/daily-budget.js 的 math 预算 ----------
   main.js setupBudgets 建立(并入 ADR 0001 单一存档键账本);
   锁定体验同 focus: 额度尽 → 今日页锁定文案 + 明天再来;
   访问器自 C1-T4 起经壳骨架(budgetName 注入) */
function mathBudget() {
  return mathShell.budget();
}
function mathLocked() {
  return mathShell.locked();
}

/* 分发与生命周期已收进世界轨驱动器 js/math-track.js(T4): MathTrack.dispatch
   (family, variant)→'screen'|'world'|null(T5-b 纯查表, 未册键 null), 关卡节
   一律经 MathTrack.run/runBoss 启动, 退出走 MathTrack.leave/stop — 本文件
   不再持 mathCtrl/mathBossStop 两条命; 插件注册表(T5-b 起为统一注册表
   MATH_TRACK_RUNNERS, 历史名 MATH_WORLD_RUNNERS 已废止)与单一权威断言
   随之迁至驱动器侧 */

/* ---------- 共享背包(T8, ADR 0002 / 设计稿 §5) ----------
    数学岛是共享背包的新「只产出」消费方: 进岛 init() 时 load 一次
    (双消费方共用存档介质, 重进必重读, 探险/专注同款); 只产出不消耗,
    掉落以基础材料为主(池与掷骰政策在 math-levels.js 的 MATH_LOOT/
    rollMathLoot, 可单测), 不得自开存档键(背包壳唯一持有)。 */
const mathBag = Backpack.mkBackpack();

/* 矿袋战利品回路(T8 → C1-T1 收编 CampKit): 会话明细/满包节流旗/飞行起点
    的状态与观感件住在 mathLootHud 实例(每关 begin() 重置); prefix 'm' 拼
    HUD 槽位/飞行件/回顾块的 id 与类名(css/math.css 契约不变); 缺省飞行
    起点=屏心(摆与搭指针锁宿主无点击位可记, 现状口径参数化保真); 满包
    toast 每关至多一次(onFull 注入, 授予基座在 CampCore.grantLoot,
    家族掷骰在 math-levels 的 rollMathLoot 纯函数) */
const mathLootHud = CampKit.mkLootHud({
  prefix: 'm',
  bag: mathBag,
  hud: () => document.getElementById('mBagHud'),
  defaultOrigin: () => ({x: innerWidth / 2, y: innerHeight / 2}),
  onFull: () => showToast('背包满啦', 2200),
});

/* ---------- 进度派生纯函数(存档无 unlocked 字段的口径) ---------- */

/* 当前前沿 = 最高已通关 + 1: 世界轨关卡未建时可"跳过"(0 星占位),
   前沿照常推进 — 存档形状不动, 派生规则单一出口(G4 起上界跟
   MATH_LEVELS.length 求值, 不留硬编码 — 扩容只动库层编排表) */
function mathFrontier(save) {
  const last = MATH_LEVELS.length - 1;
  let hi = -1;
  for (const k of Object.keys((save && save.stars) || {})) {
    const i = +k;
    if (Number.isInteger(i) && i >= 0 && i <= last && i > hi) hi = i;
  }
  return Math.min(last, hi + 1);
}

function mathLevelUnlocked(save, i) {
  /* dev=1 关卡全开: 120 关任意点验收(frontier 高亮照旧, docs/dev-mode-design.md D3);
     typeof 守卫=vm 精简装载落非 dev 分支, camp-kit budget() 同款 */
  if (typeof DEV !== 'undefined' && DEV) return true;
  return i <= mathFrontier(save);
}

/* mathFamChallengeDone(第三星挂钩判据)与 mathLevelStars(三星回溯星显
   单一出口)住库层 math-levels.js(判据与星表同源, 配单测) */

/* boss 规划/聚合已迁纯核心(T4): MathTrackCore.bossPlan(level, dispatch) ·
   MathTrackCore.aggStats(list)(js/math-track-core.js, 有单测) */

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

/* 授予流(C1-T1 起住 CampKit 实例): 入包成功即 save(频率低, 不批量);
    余量>0 静默忽略 + 每关至多一次 toast「背包满啦」(零惩罚, 授予基座在
    CampCore.grantLoot, 家族薄委托 grantMathLoot 同源) */
function grantMathLootIntoBag(ids) {
  return mathLootHud.grantIntoBag(ids);
}

/* 逐试次事件({ok, streak}, 引擎契约): streak 由引擎维护(答错清零),
    连对每满 3 保底稀有在纯函数内; boss 世界节传各节族的小节对象 */
function onMathTrialLoot(level, t) {
  const e = t || {};
  const id = rollMathLoot(level, {ok: e.ok, streak: e.streak});
  if (!id) return;
  /* 飞行起点=最近点击(kit 实例 noteTap 记录, 挂点在 ensureMathRoot)
     再缺省 defaultOrigin(屏心) */
  if (grantMathLootIntoBag([id]).granted.length) flyMathLoot(id);
}

/* 战利品飞行(C1-T1 起住 CampKit 实例): 贝塞尔弧线观感与 HUD 宽度守卫
    (隐藏即放弃观感, 入包已完成)在 kit 单份; 位移经 CSS 变量 --dx/--dy
    传给 keyframes(样式在 css/math.css, 对齐 focus.css 纪律); 元素挂
    document.body(#mathRoot 的动画全关降级块管不到, 飞行在
    prefers-reduced-motion 下自退化为淡入) */
function flyMathLoot(id, from) {
  mathLootHud.fly(id, from);
}

/* 矿袋 HUD 落袋(C1-T1 起住 CampKit 实例): 同 id 并槽计数, 新物品开槽
    (槽满自动滚到最新), 槽位弹跳 + 叮咚 sfx('pick')(与引擎答对音叠成
    双声部, 观感对齐 drops 真空吸附) */
function addMathBagSlot(id) {
  mathLootHud.addSlot(id);
}

/* 结算屏战利品回顾(C1-T1 起住 CampKit 实例, 设计稿 §5 D8): 本关获得
    列队 + 计数 — 级联进场逐件 pop(星星爆开之后), 无获得不渲染区块 */
function mathLootRecapHtml() {
  return mathLootHud.recapHtml();
}
function runMathLootRecap() {
  mathLootHud.runRecap();
}

/* ---------- 图章一本(T8 → C1-T2 收编 CampKit): 纯函数在 math-levels.js,
    呈现件(日历条/仪式块/三选一/烟花)住 mathStampRites 实例 ----------
    当日 ≥1 关盖普通章(图案 stampKind 三选一自选, 缺省宝石章), 满 3 关盖
    大章; 漏签空白无负面标记; 集章达成线只发观感奖励(图案/烟花/金章),
    永不解锁关卡/难度(红线); 日历条挂在今日页, 今日进度行今日页/地图页共用 */
const MATH_STAMP_KIND_NAMES = {gem: '宝石图章', star: '星星图章', plus: '加号图章'};
const mathStampRites = CampKit.mkStampRites({
  prefix: 'm',
  kinds: MATH_STAMP_KINDS,
  kindNames: MATH_STAMP_KIND_NAMES,
  kindDefault: 'gem',
  daily: MATH_STAMP_DAILY,
  dayKey: mathTodayStr, // 日期键单点出口(库层)
  count: mathStampCount,
  rewardFor: mathStampRewardFor,
  rewardText: (rid) => MATH_STAMP_REWARD_TEXT[rid], // 文案表在库层 math-levels(位置漂移不治理, 各自传参)
  save: saveMathSave, // 三选一选中即写存档
  root: () => mathRoot, // 烟花挂根容器
});

function mathStampKindOf(save) { // 损坏/缺省回落宝石章(与 migrateMathSave 同一白名单; 今日行/图章块共用)
  return mathStampRites.kindOf(save);
}

/* 本月日历条(本月外不渲染) */
function mathStampCalendarHtml(save) {
  return mathStampRites.calendarHtml(save);
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

/* 集章授予仪式块(kit 实例): 奖励声明(math 无喝彩图, awardIcon 缺省裸文本)
    + 三选一图案选择器(达成 stamp_pattern 线时) */
function mathStampAwardHtml(lines, save) {
  return mathStampRites.awardHtml(lines, save);
}

/* 三选一图案选择器接线(C1-T2 起住 CampKit 实例): 选中即写存档并高亮,
    日历下次渲染即用新图案 */
function wireMathStampPicker(save) {
  mathStampRites.wirePicker(save);
}

/* 一次性 CSS 粒子迸发(firework 奖励, C1-T2 起住 CampKit 实例; focus F9
    box-shadow 粒子同款手法); 样式在 css/math.css, prefers-reduced-motion
    下动画全关且基础 opacity=0 */
function launchMathFirework() {
  mathStampRites.firework();
}

/* 已领奖励判定(观感恢复用): 数学侧只查 firework — 今日页进场迸发一次 */
function mathStampRewardOn(claimed, rid) {
  return (claimed || []).some((line) => mathStampRewardFor(line) === rid);
}

/* ---------- 根容器与屏幕 ---------- */
let mathRoot = null;
const mathSettle = CampKit.mkSettleBits({prefix: 'm', autoMs: 4500}); // 结算件(C1-T3): 星显 + 自动续程(4500ms 家族现状, TTS 更长是刻意)
let mathClockTimer = 0; // 常驻昼夜大钟走针计时(G1)
const mathFailCount = {}; // 本关连续未通过次数 → 重试话术与"先玩别的"

/* 常驻昼夜大钟(G1, spec US30 前半): 今日页/地图页右上一枚小钟面, 真实
   本地时间驱动, 每分钟走针(mathSettle 同款清理纪律 — mathScreen 统一
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

/* 训练时长入账(→ C1-T1 收编 CampKit.mkCampTicker, focus 同款): 关卡进行中
   每秒 accrue 实际毫秒并落账 — 崩溃/关页损失 ≤1 秒; 今日页/地图页不计
   (口径与专注训练营一致); 单拍钳制 2s(f3c1fee 修复语义, 数学侧曾一夜
   灌爆 — 后台时间不入账)在 kit 单份保真 */
const mathCampTicker = CampKit.mkCampTicker({budget: mathBudget});
function startMathTicker() {
  mathCampTicker.start();
}
function stopMathTicker() {
  mathCampTicker.stop();
}

/* 壳骨架实例(C1-T4, 候选 1 收官): ensureRoot/screen/exit/init/cleanup +
   停止钩子注册表(退出收口权); math 的根级 pointerdown 捕获期自记点击
   (战利品飞行起点 — 屏流训练区与世界轨接球层都在根内, 一处监听两轨
   通用; 指针锁宿主的点击不经过 DOM, 无记录 → 飞行回落屏心); 挂屏期
   停常驻钟(onScreen — 常驻钟只在今日页/地图页挂, mountMathClock 重挂)
   与屏头钟面容器(headerExtra)是 math 家族件; bindRoot 回写 mathRoot
   (跨文件契约: math-world/track/build-world 三处 typeof 守卫直读) */
const mathShell = CampKit.mkCampShell({
  prefix: 'm',
  rootId: 'mathRoot',
  bindRoot: (el) => {
    mathRoot = el;
  },
  ticker: mathCampTicker,
  loot: mathLootHud,
  settle: mathSettle,
  bag: mathBag,
  saveKey: 'math_camp_save',
  saveDefaults: MATH_SAVE_DEFAULTS,
  saveMigrate: migrateMathSave,
  budgetName: 'math',
  onRootPointerDown: (e) => mathLootHud.noteTap(e.clientX, e.clientY),
  onScreen: stopMathClock,
  headerExtra: () => '<div class="m-clockbox" id="mClockBox"></div>',
  initPost: showMathToday,
});
mathShell.onStop(() => mathSettle.clear()); // math 退出现状清续程(exit 面; cleanup 面骨架也有, 幂等)
mathShell.onStop(() => MathTrack.stop()); // 世界轨驱动器收口(进行中节离场, 幂等)
mathShell.onStop(stopMathClock);

/* 存档槽三件套(C1-T4 起经壳骨架收编): 家族键名/defaults/migrate 经 opts
   注入(SyncDB.slot 同构件), defaults/migrate 住库层可单测 */
const mathSlot = mathShell.slot;
function loadMathSave() {
  return mathSlot.load();
}
function saveMathSave(s) {
  mathSlot.save(s);
}

function ensureMathRoot() {
  mathShell.ensureRoot();
}

function mathScreen(html) {
  return mathShell.screen(html); // 换屏清续程/停常驻钟/屏头返回钮+钟面容器在壳骨架
}
function mathExit() {
  mathShell.exit(); // 停止钩子(续程/世界轨/常驻钟) → 停 ticker → 静音 → 藏根 → 收 overlay 回主菜单
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
  const lvTotal = MATH_LEVELS.length; // G4: 总关数跟库层求值, 不留硬编码
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
      <p class="m-sub">第 ${cur + 1} 关 / ${lvTotal} · ⭐${total} · 每天 ${MATH_DAILY_LEVELS} 关 / ${MATH_DAILY_MIN} 分钟</p>
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
    不提成绩/智力提升; 形态对齐 focus 家长面板(门/表/CSV/免责);
    算术门(C1-T3)住 CampKit 的 mathParentGate 实例 — 题面生成/干扰项
    洗牌/比对在 kit 单份, 面板本体是家族面留在此处 */
const mathParentGate = CampKit.mkParentGate({
  prefix: 'm',
  scope: '#mathRoot',
  screen: mathScreen,
  onPass: showMathParent, // 答对开家长面板
  onFail: showMathToday, // 答错静默回今日页(不重试不提示, 零羞辱)
});
function showMathParentGate() {
  mathParentGate.open();
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
  /* 近 7 日正确率迷你折线(US42, focus 家长面板 spark 同形态; C1-T3 起住
     CampKit): 数据源 mathPanelTrend(最近 7 个有记录日按 n 加权的族 acc
     序列, 域 acc∈0..1 → max=1); <2 点显示 —(数值域与空态经 cfg 保真) */
  function mathSpark(series) {
    return CampKit.sparkSvg(series, {cls: 'm-spark', max: 1, noData: '—'});
  }
  mathScreen(`
    <div class="m-screen m-parent">
      <h1>家长面板</h1>
      <div class="m-stat-row">
        <div class="m-stat">今日 <b>${played}</b>/${MATH_DAILY_LEVELS} 关 · <b>${mins}</b> 分钟</div>
        <div class="m-stat">累计 <b>${cur + 1}</b>/${MATH_LEVELS.length} 关 · ⭐${total}</div>
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
    CampKit.downloadCsv('数学冒险岛记录.csv', rows); // BOM+Blob+click+5s revoke 仪式件(C1-T3), 行构造走库层 mathPanelCsv
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
  const perBand = MATH_LEVELS.length / 4; // G4 扩容: 30 关/带(跟库层求值)
  for (let band = 0; band < 4; band++) {
    html += '<div class="m-band"><div class="m-band-title">' + MATH_BAND_NAMES[band] +
        '</div><div class="m-band-grid">';
    for (let k = 0; k < perBand; k++) {
      const i = band * perBand + k;
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
  mathSettle.clear(); // 自动续程收口(C1-T3)
  MathTrack.stop();
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
      <div class="m-progress-line">第 ${i + 1} / ${MATH_LEVELS.length} 关${mathKindTag(level.kind)}</div>
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


/* 离场收口已迁世界轨驱动器(T4): MathTrack.leave()(stop 当前节 + 交还
   指针 + 复明 DOM, 幂等) — boss 世界节的离场由 run() 的 end 包装自动
   先行(清完再发 end), 本文件不再手调 */

function beginMathRun(level) {
  startMathTicker();
  /* T8 矿袋会话状态: 每关一份新明细 / 满包 toast 节流旗 / 飞行起点
     (kit 实例自持, begin 一并复位) */
  mathLootHud.begin();
  const meta = mathLevelMeta(level); // 情境关话术覆盖(T7)
  const kindTag = mathKindTag(level.kind);
  const world = level.kind !== 'boss' && MathTrack.dispatch(level.family, level.variant) === 'world';
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
    MathTrack.stop();
    SpeechKit.cancel();
    showMathMap();
  };
  const setProg = (k, n) => {
    const bar = document.getElementById('mProg');
    if (bar) bar.style.width = Math.round(k / Math.max(1, n) * 100) + '%';
  };
  const areaEl = document.getElementById('mArea');
  /* 关卡节一律经世界轨驱动器(T4): 屏流/世界同一入口, 「清完再发 end」与
     离场收口由 MathTrack 担保 — 本文件只管话术与结算 */
  if (level.kind === 'boss') {
    MathTrack.runBoss(level, areaEl, {
      progress: setProg,
      onTrial(sec, t) {
        onMathTrialLoot({family: sec.family, kind: 'challenge'}, t); /* 按小节族掷骰 */
      },
      end(st) {
        onMathLevelEnd(level, st);
      },
      speak(l) {
        SpeechKit.speak(l); /* 新挑战话术 */
      },
    });
    return;
  }
  MathTrack.run({family: level.family, variant: level.variant, tier: level.tier,
    kind: level.kind, params: level.params, seed: RandCore.seedAt(level.i, 0)}, areaEl, {
    progress: setProg,
    onTrial(t) {
      onMathTrialLoot(level, t); /* T8: 逐试次掷骰入矿袋(教学豁免在纯函数) */
    },
    end(st) {
      onMathLevelEnd(level, st);
    },
  });
}

/* boss 串联已迁世界轨驱动器(T4): MathTrack.runBoss — 规划/聚合在
   MathTrackCore(js/math-track-core.js, 有单测), 400ms 小节接力与整链
   中止(alive 旗)在驱动器; 原 mathCtrl/mathBossStop 两条命合一 */

/* ---------- 结算: 判定/星显/过程表扬/战利品回顾/图章进度/自动续程 ---------- */
function onMathLevelEnd(level, st) {
  /* 进行中节已在驱动器的 end 包装里离场(T4 清完再发), 此处不再收 runner */
  mathSettle.clear(); // 自动续程收口(C1-T3)
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
    const starSpans = mathSettle.starSpans(stars); // 三星 span 行(C1-T3 kit 实例)
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
    mathSettle.popStars(stars); // 350ms*n 逐星 pop + 叮咚(C1-T3 kit 实例)
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
      if (level.i >= MATH_LEVELS.length - 1) showMathMap();
      else startMathLevel(level.i + 1);
      return;
    }
    if (moveOn) {
      /* 跳过关按 0 星入账(可回来补星), 前沿照常推进 — 不留死档 */
      const s2 = loadMathSave();
      s2.stars[level.i] = s2.stars[level.i] || 0;
      saveMathSave(s2);
      startMathLevel(Math.min(level.i + 1, MATH_LEVELS.length - 1));
      return;
    }
    startMathLevel(level.i);
  };
  document.getElementById('mNextBtn').onclick = next;
  const backMap = document.getElementById('mBackMap');
  if (backMap) backMap.onclick = showMathMap;
  mathSettle.armAuto(() => { // 自动续程 4500ms(math 家族现状 — 结算屏 TTS 更长); 继续按钮在场自检留回调
    if (document.getElementById('mNextBtn')) next();
  });
}

/* ---------- 模式对象 ---------- */
const MathMode = mkMode({
  id: 'math',
  hotbar: mathWorldHb, /* T6 摆与搭三色材料栏: 屏流页 chrome 全关时隐藏,
     世界试次由引擎自行 show/hide; digit/wheel/点选经 mkMode 全自动 */
  /* T6 摆与搭点选路由: 瞄准射线的 hit 由输入层算好喂入(准星/指尖即所操作) */
  onMouse(button, hit) {
    MathTrack.mouse(button, hit); /* 驱动器路由活动节(T4) */
  },
  /* 指针解锁(Esc/暂停/时限)只在摆与搭世界轨发生: 有进行中关卡=中止回
     地图(该引擎隐了 DOM 屏, 回图要复明), 无=纯收 overlay(结算屏即将
     接管, 不露主菜单) */
  onMenu() {
    if (MathTrack.active()) {
      MathTrack.stop();
      SpeechKit.cancel();
      mathRoot.style.display = 'block';
      showMathMap();
    }
    overlay.style.display = 'none';
  },
  init() {
    mathShell.init(); // 壳骨架: 建根→显示→收 overlay→背包读档→今日页
  }, // 纯点选全屏 UI: chrome 全关由 kit 默认处理(focus 同款)
  cleanup() {
    mathShell.cleanup(); // 壳骨架: 停止钩子(世界轨/常驻钟)→ticker→战利品清场→续程收口→静音→藏根
  },
});
