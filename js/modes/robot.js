'use strict';
/* ============================================================
   Robot Commander Mode (怪物指挥官模式, 术语见 GLOSSARY.md) — 模式层
   ------------------------------------------------------------
   一句话职责: 装配怪物指挥官的屏幕流(今日页/地图页/棋盘关卡屏(指令
   编辑器)/结算/图章/家长面板)与全部应用层文案; 指令模拟纯核心在
   js/robot-core.js, 关卡数值在 js/robot-levels.js, 3D 棋盘世界宿主在
   js/robot-world.js — 本文件只消费其 RobotWorld 契约, 不实现它。
   interface: RobotMode(mkMode 注册对象, id='robot')
     流程纯函数: robotFrontier(save)(前沿=首个无星关) ·
     robotSettleSave(save, level, stats, today)(星表/图章/家长日志
     单一写入点) · robotStampClaim(save)(集章达成线领取, 差集幂等);
     家族呈现件(薄委托 CampKit 实例): robotStampKindOf/TodayHtml/
     CalendarHtml/BlockHtml · wireRobotStampPicker · launchRobotFirework;
     关卡屏: startRobotLevel(i) → mountRobotBoard(托盘/槽位队列/出发锁
     /带0 tut 直接驱动/带2 演示复现/debug 坏程序回放) → onRobotLevelEnd
     (结算: 三星/战利品入包/图章/预算关数) → 自动续程回地图页;
     RobotWorld 消费单点 robotWorldApi()(T4 并行票落地前返回 null)
   依赖(均经全局名, 调用期解析): mkMode(js/mode-kit.js) ·
     CampKit(js/camp-kit.js — 壳骨架/战利品 HUD/结算件/图章仪式/家长门) ·
     CampCore(js/camp-core.js, 日志滚动裁剪/日期序数) ·
     Backpack(js/backpack.js, ADR 0002 共享背包 — 只产出的新消费方) ·
     SpeechKit(js/speech.js) · showToast(js/effects.js) · sfx(js/audio.js) ·
     btnImg(js/button-icons.js) · stampIcon(js/focus-icons.js) ·
     Mobs(js/mobs.js, face 出特技卡头像/地图带脸) ·
     RandCore(js/rand-core.js, 陷阱骰/战利品骰派生 — 禁 Math.random) ·
     ROBOT_*(js/robot-levels.js) · RobotCore(js/robot-core.js, parSolution) ·
     RobotWorld(js/robot-world.js, build/play/stepOnce/demo/rollback/stop/
     tick 契约 — T4 并行票落地, 经 robotWorldApi() typeof 守卫) ·
     Fx(js/effects.js, tick 泵喂 update 驱动引擎特效生命周期——本模式不经
     主循环门, 不喂则 win 爆彩冻结成永久大球) ·
     ROBOT_DAILY_*(js/daily-budget.js) · Budgets(js/main.js setupBudgets
     建立的 robot 预算) · SyncDB(js/sync.js) · overlay/showPage(js/main.js
     组合根, main.js 后加载, 调用期才解析 — 与 focus/math 同款)
   可测性: 纯 DOM 模式层; 存档落账/前沿/图章领取走库层纯函数(robot-levels
      有同名单测), 本文件由 boot.test.js 全链冒烟兜底 — RobotWorld 未落地
      期点关安全回地图不炸(robotWorldApi() null 守卫)
   ------------------------------------------------------------
   玩法与训练设计(docs/robot-program-design.md): D4 防挫败阶梯(带0 tut
   直接驱动「点一张走一步」→ 带1 整段排程+出发按钮锁「程序为空禁按」) ·
   带2 演示复现(怪物先走最短解+脚印淡出=视空记忆主载体)与陷阱卡(抑制:
   闪亮宝箱卡排进去白费一槽) · D7 失败倒放回滚零惩罚(卖萌+免费重试) ·
   D8 三星(⭐通关 ⭐⭐全对 ⭐⭐⭐par 预算) · D9 加关纪律。训练营壳家族
   第三员(prefix 'r', robot_camp_save), 战利品/图章/家长面板与 math 同构,
   家长侧只报过程指标(设计稿 §8 诚实口径)。
   ============================================================ */

/* ---------- 过程性表扬 / 中性安慰 (指挥官向: 夸方法与努力, 不夸聪明) ----------
   话术属应用层文案; 随机取行件住 CampKit.pickLine, 全局名是调用契约不改不删 */
const ROBOT_PRAISE = [
  '你想清楚了才下指令，真是冷静的指挥官！', '你一步一步排好程序，怪物走得又稳又准！',
  '改一个指令就成功了，你会调试啦！', '你绕开了障碍，这条路选得真聪明！',
  '程序写得整整齐齐，小怪物全都听懂啦！', '失败也没关系，你又试了一次，真勇敢！',
];
const ROBOT_COMFORT = [
  '没关系，怪物撞了一下不疼，我们改改指令。', '差一点点啦，再试一次！',
  '慢慢想，你想好了它就能走到啦。', '换一条路试试看！',
];
function robotPraiseLine() {
  return CampKit.pickLine(ROBOT_PRAISE);
}
function robotComfortLine() {
  return CampKit.pickLine(ROBOT_COMFORT);
}

/* ---------- 每日预算(每日关数/时长): 记在 js/daily-budget.js 的 robot 预算 ----------
   main.js setupBudgets 建立(ADR 0001 单键账本); 锁定体验同 focus/math:
   额度尽 → 锁定文案 + 明天再来; 访问器经壳骨架(budgetName 注入) */
function robotBudget() {
  return robotShell.budget();
}
function robotLocked() {
  return robotShell.locked();
}

/* ---------- RobotWorld 消费单点(T4 世界宿主) ----------
   js/robot-world.js 未落地期返回 null(点关安全回地图); typeof 守卫兼容
   精简装载(vm 单测只载部分文件时走 null 分支, 不炸) */
function robotWorldApi() {
  return typeof RobotWorld !== 'undefined' ? RobotWorld : null;
}

/* ---------- 共享背包(ADR 0002): 怪物指挥官是只产出的新消费方 ----------
   进模式 init() 时经壳骨架 load 一次(重进必重读); 只产出不消耗,
   不得自开存档键(背包壳唯一持有) */
const robotBag = Backpack.mkBackpack();

/* 矿袋战利品 HUD(家族件, CampKit.mkLootHud): prefix 'r' 拼 HUD 槽位/飞行件/
   回顾块的 id 与类名(css/robot.css 契约); 满包 toast 每关至多一次 */
const robotLootHud = CampKit.mkLootHud({
  prefix: 'r',
  bag: robotBag,
  hud: () => document.getElementById('rBagHud'),
  defaultOrigin: () => ({x: innerWidth / 2, y: innerHeight / 2}),
  onFull: () => showToast('背包满啦', 2200),
});

/* 结算件(CampKit.mkSettleBits): 星显 + 自动续程(4500ms 家族现状, TTS 更长是刻意) */
const robotSettle = CampKit.mkSettleBits({prefix: 'r', autoMs: 4500});

/* 训练时长入账(CampKit.mkCampTicker, focus/math 同款): 只认连续在场的真实
   训练时长, 后台挂机不灌入每日预算 */
const robotCampTicker = CampKit.mkCampTicker({budget: robotBudget});
function startRobotTicker() {
  robotCampTicker.start();
}
function stopRobotTicker() {
  robotCampTicker.stop();
}

/* dev 预览开关(URL ?dev=1, PerfKit ?perf=1 同款惯例): 地图/关卡全程只读
   试玩——不写星表不推前沿不计每日预算, 家长不刷 5 天即可查看带1+ 内容。
   红线兼容: D9 跳关红线管的是「进度落盘」, 预览零落盘故不碰红线 */
const ROBOT_DEV_PREVIEW = (typeof location !== 'undefined') &&
    /[?&]dev=1/.test(location.search || '');

/* ---------- 图章一本(T5): 纯函数在 robot-levels.js, 呈现件住 robotStampRites 实例 ----------
   当日 ≥1 关盖普通章(图案 stampKind 三选一自选), 满 3 关大章; 达成线表
   二期再填(奖励领取仪式二期) — 表空时仪式块恒空、进度行不预告奖励 */
const ROBOT_STAMP_KIND_NAMES = {gem: '宝石图章', star: '星星图章', plus: '加号图章'};
const robotStampRites = CampKit.mkStampRites({
  prefix: 'r',
  kinds: ROBOT_STAMP_KINDS,
  kindNames: ROBOT_STAMP_KIND_NAMES,
  kindDefault: 'gem',
  daily: ROBOT_STAMP_DAILY,
  dayKey: robotTodayStr, // 日期键单点出口(库层)
  count: robotStampCount,
  rewardFor: robotStampRewardFor,
  rewardText: (rid) => ROBOT_STAMP_REWARD_TEXT[rid], // 文案表在库层(二期填表后生效)
  save: saveRobotSave, // 三选一选中即写存档
  root: () => robotRoot, // 烟花挂根容器
});

function robotStampKindOf(save) { // 损坏/缺省回落宝石章(与 migrateRobotSave 同一白名单)
  return robotStampRites.kindOf(save);
}

function robotStampCalendarHtml(save) { // 本月日历条(本月外不渲染)
  return robotStampRites.calendarHtml(save);
}

/* 集章进度口径文案(诚实口径): 达成线表二期前为空 → 不预告「有新奖励」 */
function robotStampGoalText(total) {
  if (!Object.keys(ROBOT_STAMP_REWARDS).length) return '';
  const next = robotStampNextLine(total);
  return next ? ' · 再集 ' + (next - total) + ' 枚有新奖励' : '';
}

/* 今日图章进度行(今日页/地图页共用露出): 今日盖章状态 + 集章总数 */
function robotStampTodayHtml(save) {
  const today = robotTodayStr();
  const n = (save.stamps && save.stamps[today]) || 0;
  const total = robotStampCount(save.stamps);
  const ico = n >= ROBOT_STAMP_DAILY.big ? stampIcon('big') :
      n >= ROBOT_STAMP_DAILY.min ? stampIcon(robotStampKindOf(save)) : '';
  const line = n >= ROBOT_STAMP_DAILY.big ? '今天的大图章盖好啦！' :
      n >= ROBOT_STAMP_DAILY.min ? '图章盖上啦，再玩 ' + (ROBOT_STAMP_DAILY.big - n) + ' 关换大章！' :
      '今天玩 1 关就能盖图章哦！';
  return '<div class="r-stamp-row">' + (ico ? '<img draggable="false" alt="" src="' + ico + '">' : '') +
      '<span>' + line + ' 已集 ' + total + ' 枚' + robotStampGoalText(total) + '</span></div>';
}

/* 结算屏图章块: 今日图章(新盖弹跳) + 集章总数 */
function robotStampBlockHtml(save, stampNew, stampBig) {
  const total = robotStampCount(save.stamps);
  const ico = stampBig ? stampIcon('big') : stampIcon(robotStampKindOf(save));
  const head = stampBig ? '今天集满 ' + ROBOT_STAMP_DAILY.big + ' 关，大图章！' :
      stampNew ? '今天的图章盖上啦！' : '今天的图章已经盖好啦';
  return '<div class="r-stamp-block' + ((stampNew || stampBig) ? ' pop' : '') + '">' +
      '<img draggable="false" alt="图章" src="' + ico + '">' +
      '<span>' + head + ' · 已集 ' + total + ' 枚' + robotStampGoalText(total) + '</span></div>';
}

function wireRobotStampPicker(save) { // 三选一图案(未达成时无节点, 自动 no-op)
  robotStampRites.wirePicker(save);
}

function launchRobotFirework() { // 一次性 CSS 粒子迸发(二期奖励线启用后登场)
  robotStampRites.firework();
}

/* ---------- 结算落账(单一写入点: 星表/图章/家长日志 + 滚动裁剪) ----------
   返回是否通过; 预算关数计数(b.count)由调用方先行, 图章取 spentCount;
   日志键 'b<带>': acc=盘正确率 / par=最短指令达成率(均记录内运行均值,
   家长面板聚合按 n 加权 — 只报过程指标, 设计稿 §8) */
function robotSettleSave(save, level, stats, today) {
  const solved = stats.filter((b) => b && b.solved).length;
  const passed = robotPassed(solved);
  if (passed) {
    save.stars[level.i] = Math.max(save.stars[level.i] || 0, robotStars(stats));
  }
  const fb = robotBudget();
  const n = fb ? fb.spentCount() : (save.stamps[today] || 0) + 1; // 无预算环境兜底(测试/离线)
  save.stamps = robotStampTrim(robotStampRecord(save.stamps || {}, today, n), today);
  save.log = CampCore.trimLog(save.log || {}, today, ROBOT_LOG_KEEP_DAYS);
  const day = save.log[today] = save.log[today] || {};
  const parHits = stats.filter((b) => b && b.solved && b.used <= b.par + 1).length;
  const row = day['b' + level.band] = day['b' + level.band] || {acc: 0, n: 0, par: 0};
  row.acc = (row.acc * row.n + solved / Math.max(1, stats.length)) / (row.n + 1);
  row.par = (row.par * row.n + (solved ? parHits / solved : 0)) / (row.n + 1);
  row.n++;
  return passed;
}

/* 集章达成线领取(须在 robotSettleSave 之后、saveRobotSave 之前调用):
   返回本次新达成的达成线(差集幂等); 二期前恒空数组 */
function robotStampClaim(save) {
  const due = robotStampRewardsDue(robotStampCount(save.stamps || {}), save.stampClaimed || []);
  if (due.length) save.stampClaimed = (save.stampClaimed || []).concat(due);
  return due;
}

/* ---------- 壳骨架实例(CampKit.mkCampShell): 一实例一家族 ----------
   bindRoot 回写 robotRoot(图章烟花挂根容器 + r-world 类挂点); 根级
   pointerdown 记战利品飞行起点; initPost 进今日页 */
let robotRoot = null;
const robotShell = CampKit.mkCampShell({
  prefix: 'r',
  rootId: 'robotRoot',
  bindRoot: (el) => {
    robotRoot = el;
  },
  ticker: robotCampTicker,
  loot: robotLootHud,
  settle: robotSettle,
  bag: robotBag,
  saveKey: 'robot_camp_save',
  saveDefaults: ROBOT_SAVE_DEFAULTS,
  saveMigrate: migrateRobotSave,
  budgetName: 'robot',
  onRootPointerDown: (e) => robotLootHud.noteTap(e.clientX, e.clientY),
  initPost: showRobotToday,
});
/* 退出收口权(退出与 cleanup 都跑, 幂等): 先收本关(倒放句柄/beat 定时器/
   tick 泵) → 世界宿主模块收口 → 续程收口 */
robotShell.onStop(stopRobotRun);
robotShell.onStop(() => {
  const rw = robotWorldApi();
  if (rw) rw.stop();
});
robotShell.onStop(robotSettle.clear);

/* 存档槽三件套(经壳骨架收编): 家族键名/defaults/migrate 经 opts 注入 */
const robotSlot = robotShell.slot;
function loadRobotSave() {
  return robotSlot.load();
}
function saveRobotSave(s) {
  robotSlot.save(s);
}

function robotScreen(html) {
  return robotShell.screen(html); // 换屏清自动续程 + 屏头返回钮在壳骨架
}
/* 普通屏(今日/地图/结算/家长): 摘掉 r-world 恢复天空底色 — 棋盘关卡屏
   (mountRobotBoard)负责挂上 */
function robotPlainScreen(html) {
  if (robotRoot) robotRoot.classList.remove('r-world');
  return robotScreen(html);
}
function robotExit() {
  robotShell.exit(); // 停止钩子(本关/世界宿主/续程) → ticker → 静音 → 藏根 → 回主菜单
}

/* ---------- tick 泵(模式层自持 rAF → RobotWorld.tick + Fx.update) ----------
   main.js 的 update 钩子只在指针锁/触屏进行态喂(robot 是纯 DOM 模式吃不到),
   故照 math-world 先例由模式自管 rAF: 棋盘关卡屏在场即泵, 离场/退模式即停。
   引擎特效生命周期(Fx.update)同吃本泵——win 爆彩球/boom 碎屑只认这一处,
   不喂则每颗都冻结成永久大球(真机实锤: 每胜一盘多一颗, L2 见俩) */
let robotRaf = 0;
let robotLastT = 0;
function startRobotPump() {
  stopRobotPump();
  robotLastT = 0;
  const ch = document.getElementById('crosshair');
  if (ch) ch.style.display = 'none'; // 看盘镜头无需准星(棋盘屏期间挡视线中心)
  const frame = (now) => {
    robotRaf = requestAnimationFrame(frame);
    const rw = robotWorldApi();
    if (!rw) return;
    const dt = robotLastT ? Math.min(0.05, (now - robotLastT) / 1000) : 0.016;
    robotLastT = now;
    rw.tick(dt);
    Fx.update(dt); /* 引擎特效泵: 主循环那侧的门在本模式恒关(纯点选不锁指针),
       不在这里喂 = 爆彩球永驻(本模式内仅 robot 自产特效, 单驱无双喂) */
  };
  robotRaf = requestAnimationFrame(frame);
}
function stopRobotPump() {
  if (robotRaf) {
    cancelAnimationFrame(robotRaf);
    robotRaf = 0;
  }
  const ch = document.getElementById('crosshair');
  if (ch) ch.style.display = ''; // 泵停即离盘: 准星必恢复(本函数是棋盘屏唯一停收口)
}

/* ---------- 关卡屏运行上下文(一盘一 handle, 一关一 stats) ---------- */
let robotRunCtx = null; // {level, boardIdx, stats, handle, prog, trace, hi, editing, busy, tutUsed}
let robotBeat = 0; // 过盘间歇定时器(退场收口)
let robotPreviewing = false; // dev 预览态(startRobotLevel 第二参): 只读试玩零写盘

/* 收当前关(回地图/退模式/结算前): 倒放句柄 + beat 定时器 + tick 泵 */
function stopRobotRun() {
  if (robotBeat) {
    clearTimeout(robotBeat);
    robotBeat = 0;
  }
  if (robotRunCtx && robotRunCtx.handle) {
    robotRunCtx.handle.stop();
    robotRunCtx.handle = null;
  }
  stopRobotPump();
}

function packOf(level) {
  return ROBOT_PACKS.find((p) => p.key === level.pack) || {};
}

/* 木偶脸(关卡屏盘头/地图前沿钮/带分区): relay 包无双主角 —— 世界宿主
   A 段固定铁傀儡(robot-world build 同款口径), 脸谱同源不画问号 */
function puppetMobOf(level) {
  return packOf(level).mob || 'golem';
}

/* ---------- 家长门(CampKit.mkParentGate): 算术门一实例一家族 ----------
   答对开家长面板, 答错静默回今日页(零羞辱) */
const robotParentGate = CampKit.mkParentGate({
  prefix: 'r',
  scope: '#robotRoot',
  screen: robotPlainScreen,
  onPass: showRobotParent,
  onFail: showRobotToday,
});
function showRobotParentGate() {
  robotParentGate.open();
}

/* ---------- 今日页: 进度概览 + 图章日历 + 进入地图 ---------- */
function showRobotToday() {
  stopRobotTicker();
  const save = loadRobotSave();
  const locked = robotLocked() && !ROBOT_DEV_PREVIEW;
  const played = robotBudget() ? robotBudget().spentCount() : 0;
  const total = Object.values(save.stars).reduce((s, x) => s + x, 0);
  const dots = Array.from({length: ROBOT_DAILY_LEVELS}, (_, k) =>
    '<span class="dot ' + (k < played ? 'done' : '') + '"></span>').join('');
  if (locked) {
    robotPlainScreen(`
      <div class="r-screen r-today">
        <h1>今天的指挥任务完成啦！</h1>
        <p class="r-sub">小怪物们要休息了，明天再来吧 · ⭐${total}</p>
        <div class="r-dots">${dots}</div>
        ${robotStampTodayHtml(save)}
        ${robotStampCalendarHtml(save)}
        <button class="r-parent-btn r-btn" id="rParentBtn">${btnImg('lock')} 家长</button>
        <button class="r-btn" id="rHome2">${btnImg('house')} 回主页</button>
      </div>`);
    document.getElementById('rHome2').onclick = robotExit;
    document.getElementById('rParentBtn').onclick = showRobotParentGate;
    return;
  }
  robotPlainScreen(`
    <div class="r-screen r-today">
      <h1>怪物指挥官</h1>
      <p class="r-sub">⭐${total} · 每天 ${ROBOT_DAILY_LEVELS} 关 / ${ROBOT_DAILY_MIN} 分钟</p>
      <button class="r-start" id="rStartBtn">${btnImg('playGo')} 开始指挥</button>
      <div class="r-dots">${dots}</div>
      ${robotStampTodayHtml(save)}
      ${robotStampCalendarHtml(save)}
      <button class="r-parent-btn r-btn" id="rParentBtn">${btnImg('lock')} 家长</button>
    </div>`);
  SpeechKit.speak('欢迎来到怪物指挥官！给小怪物排好指令，带它回家吧。');
  document.getElementById('rStartBtn').onclick = showRobotMap;
  document.getElementById('rParentBtn').onclick = showRobotParentGate;
}

/* ---------- 地图页: 四带分区(story TTS) + 前沿关大按钮 ----------
   前沿 = 首个无星关(星表无关号语义外的字段; moveOn 类 0 星占位也算已玩);
   锁定体验 = 额度尽显示「明天再来」; 零文字依赖: 带分区用怪物脸, 按钮全图标 */
function robotFrontier(save) {
  let i = 0;
  while (i < ROBOT_LEVELS.length && save.stars[i] !== undefined) i++;
  return Math.min(i, ROBOT_LEVELS.length - 1);
}

function showRobotMap() {
  stopRobotTicker();
  const save = loadRobotSave();
  if (robotLocked() && !ROBOT_DEV_PREVIEW) {
    robotPlainScreen(`
      <div class="r-screen r-map">
        <h1>小怪物们要休息啦</h1>
        <p class="r-sub">今天的指挥任务完成了，明天再来吧！</p>
        <div class="r-dim-icon">${btnImg('lock')}</div>
        ${robotStampTodayHtml(save)}
        <button class="r-parent-btn r-btn" id="rParentBtn">${btnImg('lock')} 家长</button>
        <button class="r-btn" id="rHome2">${btnImg('house')} 回主页</button>
      </div>`);
    document.getElementById('rHome2').onclick = robotExit;
    document.getElementById('rParentBtn').onclick = showRobotParentGate;
    SpeechKit.speak('今天的指挥任务完成了，明天再来吧！');
    return;
  }
  const frontier = robotFrontier(save);
  const lv = ROBOT_LEVELS[frontier];
  let html = '<div class="r-screen r-map"><h1>指挥官地图' +
      (ROBOT_DEV_PREVIEW ? '<span class="r-sub">（dev 预览）</span>' : '') + '</h1>' +
      robotStampTodayHtml(save);
  for (let band = 0; band < ROBOT_BANDS.length; band++) {
    const lvls = ROBOT_LEVELS.filter((l) => l.band === band);
    const stars = lvls.reduce((s, l) => s + (save.stars[l.i] || 0), 0);
    const mobs = [...new Set(lvls.map((l) => puppetMobOf(l)))];
    const faces = mobs.map((m) => '<img draggable="false" alt="" src="' + Mobs.face(m) + '">').join('');
    html += '<button class="r-band" data-band="' + band + '">' +
        '<span class="r-band-name">' + ROBOT_BANDS[band].name + '</span>' +
        '<span class="r-band-faces">' + faces + '</span>' +
        '<span class="r-band-stars">⭐' + stars + '</span></button>';
  }
  /* 前沿关大按钮: 怪物脸 + 关号 + 出发键(点带分区听剧情, 点大按钮直接开打) */
  html += '<button class="r-frontier" id="rFrontierBtn">' +
      '<span class="r-frontier-mob"><img draggable="false" alt="" src="' + Mobs.face(puppetMobOf(lv)) + '"></span>' +
      '<span class="r-frontier-num">' + (frontier + 1) + '</span>' +
      btnImg('playGo', 'r-frontier-go') + '</button>';
  html += '<button class="r-parent-btn r-btn" id="rParentBtn">' + btnImg('lock') + ' 家长</button>';
  html += '</div>';
  robotPlainScreen(html);
  document.querySelectorAll('#robotRoot .r-band').forEach((btn) => {
    btn.onclick = () => {
      const band = +btn.dataset.band;
      if (ROBOT_DEV_PREVIEW) { // dev 预览: 带分区=该带首关入口(只读试玩)
        SpeechKit.speak(ROBOT_BANDS[band].story);
        startRobotLevel(band * 25, true); // 带首关 = i band*25(4 带 × 25 关)
        return;
      }
      SpeechKit.speak(ROBOT_BANDS[band].story);
    };
  });
  document.getElementById('rFrontierBtn').onclick = () =>
    startRobotLevel(frontier, ROBOT_DEV_PREVIEW);
  document.getElementById('rParentBtn').onclick = showRobotParentGate;
  SpeechKit.speak(ROBOT_BANDS[lv.band].story);
}

/* ---------- 棋盘关卡屏: 指令编辑器(托盘 + 槽位队列 + 出发锁) ----------
   robotRoot 挂 r-world 类露 3D 棋盘; 编辑器是底部浮层: #rSlots 程序条
   (槽位数=paramsFor.slots, 已放卡高亮/空槽虚框/点卡即移除), #rTray 指令卡
   托盘(F/L/R/S=怪物头像, 带2 起概率 trapX 陷阱卡 — RandCore 派生骰),
   #rRun 出发键(程序为空置灰 = D 抑制控制的按钮锁); 带0 tut 关不出程序条,
   改单卡大按钮排(点一张 stepOnce 走一步) */
function startRobotLevel(i, preview) {
  robotSettle.clear();
  const level = ROBOT_LEVELS[i];
  const rw = robotWorldApi();
  if (!level || !rw) {
    showRobotMap(); // world 宿主未落地/关号越界: 安静回地图(不炸)
    return;
  }
  robotPreviewing = !!preview && ROBOT_DEV_PREVIEW; // 预览仅 dev 开关下生效
  robotRunCtx = {level, boardIdx: 0, stats: [], handle: null,
    prog: [], trace: [], hi: -1, editing: false, busy: false, tutUsed: 0};
  if (!robotPreviewing) startRobotTicker(); // 预览不计训练时长/关数预算
  robotLootHud.begin(); // 矿袋会话状态: 每关一份新明细/满包节流复位
  mountRobotBoard();
}

function boardDotsHtml(cur, n) {
  let s = '';
  for (let k = 0; k < n; k++) {
    s += '<span class="r-dot' + (k < cur ? ' done' : '') + (k === cur ? ' cur' : '') + '"></span>';
  }
  return s;
}

/* 卡面(全图标零文字): F/L/R/X=像素指令卡, S=本包怪物头像(Mobs.face) */
function cardFaceHtml(card, level) {
  if (card === 'F') return btnImg('arrowF', 'r-ci');
  if (card === 'L') return btnImg('turnL', 'r-ci');
  if (card === 'R') return btnImg('turnR', 'r-ci');
  if (card === 'X') return btnImg('trapX', 'r-ci');
  if (card === 'S') {
    return '<img class="r-ci" draggable="false" alt="" src="' + Mobs.face(puppetMobOf(level)) + '">';
  }
  return '';
}

/* 点卡 TTS 念动作名(三编码之三) */
function cardName(card, level) {
  if (card === 'F') return '前进！';
  if (card === 'L') return '左转！';
  if (card === 'R') return '右转！';
  if (card === 'X') return '闪闪发光的转圈卡！';
  const meta = packOf(level);
  return meta.skillName ? meta.skillName + '！' : '特技！';
}

/* 陷阱卡掷骰(禁 Math.random): 每盘一枚确定性骰, 从棋盘种子派生独立流 —
   同 seed 同托盘, 重打同关陷阱卡的出现与位置恒定 */
function rollTrapCard(level, boardIdx) {
  const p = paramsFor(level);
  if (p.trapRate <= 0) return false;
  const rnd = RandCore.mkRand(RandCore.seedAt(boardSeed(level.i, boardIdx), 7, 7));
  return rnd() < p.trapRate;
}

function mountRobotBoard() {
  const st = robotRunCtx;
  const level = st.level;
  const p = paramsFor(level);
  const rw = robotWorldApi();
  if (!rw) {
    showRobotMap();
    return;
  }
  if (st.handle) st.handle.stop(); // 换盘收上一盘场景
  st.handle = rw.build(level, st.boardIdx);
  st.prog = [];
  st.trace = [];
  st.hi = -1;
  st.tutUsed = 0;
  st.editing = false; // 序列(坏程序回放/演示)演完才亮托盘
  if (robotRoot) robotRoot.classList.add('r-world');
  startRobotPump();
  const tut = level.kind === 'tut'; // D4: 直接驱动关不出程序条/出发键
  robotScreen(`
    <div class="r-board-head">
      <img class="r-board-mob" draggable="false" alt="" src="${Mobs.face(puppetMobOf(level))}">
      <span class="r-board-dots" id="rBoardDots">${boardDotsHtml(st.boardIdx, p.boards)}</span>
    </div>
    ${tut ? '' : '<div class="r-bag" id="rBagHud" aria-hidden="true"></div>'}
    <div class="r-editor${tut ? ' r-editor-tut' : ''}" id="rEditor">
      ${tut ? '' : '<div class="r-slots" id="rSlots"></div>'}
      <div class="r-tray-row">
        <div class="r-tray" id="rTray"></div>
        ${tut ? '' : '<button class="r-run" id="rRun" aria-label="出发" disabled>' + btnImg('playGo') + '</button>'}
      </div>
    </div>`);
  document.getElementById('rBackBtn').onclick = () => {
    stopRobotRun();
    showRobotMap();
  };
  const runBtn = document.getElementById('rRun');
  if (runBtn) runBtn.onclick = pressRun;
  renderTray();
  renderSlots();
  syncEditorLock();
  updateRunBtn();
  beginBoardPrelude();
}

function renderTray() {
  const box = document.getElementById('rTray');
  if (!box) return;
  const st = robotRunCtx;
  const p = paramsFor(st.level);
  const cards = ['F', 'L', 'R'];
  if (p.skill) cards.push('S'); // 特技卡随包解锁(每包只教一个新语义)
  if (rollTrapCard(st.level, st.boardIdx)) cards.push('X'); // 陷阱卡(带2 起, 概率=paramsFor.trapRate)
  const big = st.level.kind === 'tut' ? ' r-card-big' : '';
  box.innerHTML = cards.map((c) =>
    '<button class="r-card' + big + '" data-card="' + c + '" aria-label="指令卡">' +
    cardFaceHtml(c, st.level) + '</button>').join('');
  box.querySelectorAll('.r-card').forEach((btn) => {
    btn.onclick = () => tapTrayCard(btn.dataset.card);
  });
}

function renderSlots() {
  const box = document.getElementById('rSlots');
  if (!box) return;
  const st = robotRunCtx;
  const p = paramsFor(st.level);
  let html = '';
  for (let k = 0; k < p.slots; k++) {
    const card = st.prog[k];
    html += '<button class="r-slot' + (card ? ' filled' : '') + (st.hi === k ? ' on' : '') +
        '" data-k="' + k + '" aria-label="程序槽">' + (card ? cardFaceHtml(card, st.level) : '') + '</button>';
  }
  box.innerHTML = html;
  box.querySelectorAll('.r-slot').forEach((btn) => {
    btn.onclick = () => {
      if (!st.editing) return;
      const k = +btn.dataset.k;
      if (!st.prog[k]) return; // 空槽虚框只是占位
      st.prog.splice(k, 1); // 编辑即调试: 点槽位上的卡 = 移除(Turtles 无限撤销)
      sfx('click');
      renderSlots();
      updateRunBtn();
    };
  });
}

function syncEditorLock() {
  const ed = document.getElementById('rEditor');
  if (ed) ed.classList.toggle('locked', !(robotRunCtx && robotRunCtx.editing));
}

function updateRunBtn() {
  const btn = document.getElementById('rRun');
  if (!btn) return;
  const st = robotRunCtx;
  btn.disabled = !(st && st.editing && st.prog.length); // 出发锁: 程序为空禁按(D 抑制控制)
}

function setEditing(on) {
  const st = robotRunCtx;
  if (!st) return;
  st.editing = on;
  syncEditorLock();
  updateRunBtn();
}

function tapTrayCard(card) {
  const st = robotRunCtx;
  if (!st || !st.editing || st.busy) return;
  sfx('click');
  SpeechKit.speak(cardName(card, st.level));
  if (st.level.kind === 'tut') {
    tutStep(card); // D4: 直接驱动 — 点一张走一步
    return;
  }
  if (st.prog.length >= paramsFor(st.level).slots) return; // 槽满: 静默不落
  st.prog.push(card);
  renderSlots();
  updateRunBtn();
}

/* ---------- 序列预演: decode 预置 / debug 坏程序 / 带2 演示复现 ---------- */
function speakBoardRule(level, p) {
  const line = level.kind === 'tut' ? '点一张卡片，小怪物就走一步，送它到小旗子！' :
      level.kind === 'decode' ? '程序少了一张！想一想补哪张，再按出发。' :
      level.kind === 'debug' ? '哎呀，这个程序有问题！看它跑一遍，找出坏指令修好它。' :
      p.previewSec > 0 ? '先看小怪物走一遍，记住路线，再排出指令！' :
      '排好指令，按绿色的出发键，送小怪物回家！';
  SpeechKit.speak(line);
}

function beginBoardPrelude() {
  const st = robotRunCtx;
  const level = st.level;
  const p = paramsFor(level);
  speakBoardRule(level, p);
  /* decode 关: 预置程序(最短解去尾卡)先入槽, 孩子补最后一张 */
  const preset = presetFor(level, st.boardIdx);
  if (level.kind === 'decode') {
    if (!preset) { // 解过短不出题: 该盘按 par 记跳过(不占孩子预算, T5 换下一盘)
      st.stats.push({solved: true, used: st.handle.par, par: st.handle.par});
      advanceBoard();
      return;
    }
    st.prog = preset.slice();
    renderSlots();
    updateRunBtn();
  }
  /* debug 关: 进屏先看坏程序跑失败(整段回放+倒放回滚), 然后亮托盘让孩子修 —
     坏程序直接摆在程序条上(卡拉OK高亮照常点亮), 「找出修好」看得见摸得着 */
  const broken = level.kind === 'debug' ? debugPresetFor(level, st.boardIdx) : null;
  if (broken) {
    st.prog = broken.slice();
    renderSlots();
    runProgram(broken);
    return;
  }
  /* 带2 起演示复现(视空记忆主载体): 怪物亲自走最短解, 脚印 previewSec 秒淡出,
     demo 完才亮托盘 — 「先看演示再编程」 */
  if (p.previewSec > 0 && typeof RobotCore !== 'undefined') {
    const sol = RobotCore.parSolution(st.handle.board);
    if (sol && sol.length) {
      st.handle.demo(sol, p.previewSec, () => {
        if (robotRunCtx === st) setEditing(true);
      });
      return;
    }
  }
  setEditing(true);
}

/* ---------- 回放: 整段 play(卡拉OK高亮 + trace 累计) → 失败倒放回滚 ---------- */
function runProgram(cards) {
  const st = robotRunCtx;
  st.editing = false;
  st.busy = true;
  syncEditorLock();
  st.trace = [];
  st.hi = -1;
  st.handle.play(cards, {
    onStep: (i, intent) => {
      if (robotRunCtx !== st) return;
      st.hi = i; // 程序条 LED 式高亮当前卡(Cubetto 槽位范式)
      renderSlots();
      st.trace.push({card: cards[i], intent, x: st.handle.sim.x, z: st.handle.sim.z});
    },
    onDone: (status) => onProgramDone(status, cards),
  });
}

function onProgramDone(status, cards) {
  const st = robotRunCtx;
  if (!st || robotRunCtx !== st) return;
  st.busy = false;
  st.hi = -1;
  renderSlots();
  if (status === 'win') {
    st.stats.push({solved: true, used: cards.length, par: st.handle.par});
    onBoardWon();
    return;
  }
  /* 零惩罚: 卖萌安慰 + 倒着走回起点(失败回滚也是表演), 免费重新编辑 */
  SpeechKit.speak(robotComfortLine());
  st.handle.rollback(st.trace, () => {
    if (robotRunCtx === st) setEditing(true);
  });
}

/* ---------- 带0 直接驱动: 点一张 stepOnce 一步 ---------- */
function tutStep(card) {
  const st = robotRunCtx;
  st.busy = true;
  st.tutUsed++;
  st.handle.stepOnce(card, (intent) => {
    if (!robotRunCtx || robotRunCtx !== st) return;
    st.trace.push({card, intent, x: st.handle.sim.x, z: st.handle.sim.z});
    if (intent === 'win') {
      st.busy = false;
      st.stats.push({solved: true, used: st.tutUsed, par: st.handle.par});
      onBoardWon();
      return;
    }
    if (intent === 'bonk' || intent === 'splash') { // 撞墙/落水: 倒放回起点继续点
      SpeechKit.speak(robotComfortLine());
      st.handle.rollback(st.trace, () => {
        if (robotRunCtx !== st) return;
        st.trace = [];
        st.busy = false;
      });
      return;
    }
    st.busy = false; // move/turn/skill/nap: 继续点下一张
  });
}

/* ---------- 过盘与结算 ---------- */
function onBoardWon() { // 到旗仪式音(world 侧 act('win') 已奏 win+烟花, 模式层不重奏)
  SpeechKit.speak(robotPraiseLine());
  advanceBoard();
}

function advanceBoard() { // 过盘间歇(让 win 时刻落地) → 下一盘 / 结算
  const st = robotRunCtx;
  if (robotBeat) clearTimeout(robotBeat);
  robotBeat = setTimeout(() => {
    robotBeat = 0;
    if (robotRunCtx !== st) return;
    st.boardIdx++;
    if (st.boardIdx >= paramsFor(st.level).boards) endRobotLevel();
    else mountRobotBoard();
  }, 1100);
}

function pressRun() {
  const st = robotRunCtx;
  if (!st || !st.editing || !st.prog.length) return; // 出发锁(双保险, 键已 disabled)
  sfx('click');
  runProgram(st.prog.slice());
}

function endRobotLevel() {
  const st = robotRunCtx;
  const level = st.level;
  const stats = st.stats.slice();
  stopRobotRun();
  robotRunCtx = null;
  onRobotLevelEnd(level, stats);
}

/* ---------- 结算: 判定/星显/战利品入包/图章/自动续程回地图 ----------
   预算关数+1 无论通过与否(防疲劳刷, focus/math 同款); 战利品骰=关号派生
   确定性流(禁 Math.random, 与棋盘种子不同流); loot HUD 不在场 → 飞行观感
   由结算列队回顾兜住, 入包照常 */
function onRobotLevelEnd(level, stats) {
  if (robotPreviewing) { // dev 预览结算: 零写盘(星表/图章/战利品/预算全跳过)
    const solvedN = stats.filter((b) => b && b.solved).length;
    const stars = robotStars(stats);
    const nextI = Math.min(level.i + 1, ROBOT_LEVELS.length - 1);
    robotPlainScreen(`
      <div class="r-screen r-result">
        <h1>预览 · 第 ${level.i + 1} 关</h1>
        <p class="r-sub">通过 ${solvedN}/${stats.length} 盘 · 预览不计进度</p>
        <div class="r-stars">${robotSettle.starSpans(stars)}</div>
        <button class="r-btn" id="rPrevNext">${btnImg('playGo')} 下一关</button>
        <button class="r-btn" id="rPrevMap">${btnImg('house')} 回地图</button>
      </div>`);
    document.getElementById('rPrevNext').onclick = () => startRobotLevel(nextI, true);
    document.getElementById('rPrevMap').onclick = showRobotMap;
    return;
  }
  robotSettle.clear();
  stopRobotTicker();
  const save = loadRobotSave();
  const today = robotTodayStr();
  /* 轮换奖励上报(必须在 count 前: onExhausted 同步评估含本关); 盘正确率=答对盘/总盘(家长日志同式) */
  noteCampResult('robot',
      Math.round(100 * stats.filter((b) => b && b.solved).length / Math.max(1, stats.length)));
  const fb = robotBudget();
  if (fb) {
    fb.count(1);
    fb.flush();
  }
  const prevStamp = save.stamps[today] || 0; // 结算前的今日关数(判新章/大章)
  const passed = robotSettleSave(save, level, stats, today);
  const stampDue = robotStampClaim(save); // 集章达成线领取(就近写回, 差集幂等)
  saveRobotSave(save);
  const nowStamp = save.stamps[today] || 0;
  const stampNew = prevStamp < ROBOT_STAMP_DAILY.min && nowStamp >= ROBOT_STAMP_DAILY.min;
  const stampBig = prevStamp < ROBOT_STAMP_DAILY.big && nowStamp >= ROBOT_STAMP_DAILY.big;
  const stars = passed ? robotStars(stats) : 0;
  const rnd = RandCore.mkRand(RandCore.seedAt(ROBOT_SEED_BASE, level.i, 901));
  robotLootHud.grantIntoBag(rollRobotLoot(rnd, level, stats.filter((b) => b.solved).length));
  const solvedN = stats.filter((b) => b.solved).length;
  const teach = level.kind === 'tut' || level.kind === 'decode';
  const praise = teach ? '你学会新玩法啦！' : (passed ? robotPraiseLine() : robotComfortLine());
  const stampNames = stampDue.map((line) => ROBOT_STAMP_REWARD_TEXT[robotStampRewardFor(line)] || '').join('、');
  /* TTS 优先级: 集章仪式 > (通过=表扬+新章 / 未过=安慰) — 结算屏只有一次开口 */
  const spoken = stampDue.length ? '集齐图章啦！获得' + stampNames + '！' :
      praise + (stampNew ? ' 今天的图章盖上啦！' : '');
  if (passed) {
    robotPlainScreen(`
      <div class="r-screen r-result">
        <div class="r-stars" id="rStars">${robotSettle.starSpans(stars)}</div>
        <h1>${teach ? '学会啦！' : '通过！'}</h1>
        <p class="r-sub">拼图完成 ${solvedN}/${stats.length} 盘</p>
        <div class="r-result-bubble"><span class="r-bubble">${praise}</span></div>
        ${robotLootHud.recapHtml()}
        ${robotStampBlockHtml(save, stampNew, stampBig)}
        ${robotStampRites.awardHtml(stampDue, save)}
        <button class="r-start" id="rNextBtn">${btnImg('playGo')} 继续</button>
      </div>`);
    robotSettle.popStars(stars); // 350ms*n 逐星 pop + 叮咚(kit 实例)
  } else {
    robotPlainScreen(`
      <div class="r-screen r-result">
        <div class="r-stars"></div>
        <h1>很努力了！</h1>
        <p class="r-sub">拼图完成 ${solvedN}/${stats.length} 盘 · 通过要答对 3 盘</p>
        <div class="r-result-bubble"><span class="r-bubble">${praise}</span></div>
        ${robotLootHud.recapHtml()}
        ${robotStampBlockHtml(save, stampNew, stampBig)}
        <button class="r-start" id="rNextBtn">再来一次 ↺</button>
        <button class="r-btn" id="rBackMap">${btnImg('grid')} 回地图</button>
      </div>`);
  }
  SpeechKit.speak(spoken);
  wireRobotStampPicker(save); // 三选一图案(二期前无节点, 自动 no-op)
  robotLootHud.runRecap(); // 本关收获列队进场(星星之后, 无获得零渲染)
  if (stampDue.length) { // 集章仪式: 奖励声明 toast + 晋升琶音(观感奖励, 与关卡解锁无关)
    showToast('🎖️ 集章奖励：' + stampNames + '！', 2600);
    sfx('level');
  }
  const next = () => {
    if (robotLocked()) {
      showRobotToday();
      return;
    }
    showRobotMap(); // 自动续程回地图页(前沿大按钮自然指向下一关)
  };
  const retry = !passed; // 未过: 继续按钮=免费重试本关(零惩罚); 已过: 继续钮=回地图
  document.getElementById('rNextBtn').onclick = () => {
    robotSettle.clear();
    if (retry) startRobotLevel(level.i);
    else next();
  };
  const backMap = document.getElementById('rBackMap');
  if (backMap) backMap.onclick = showRobotMap;
  robotSettle.armAuto(() => { // 自动续程 4500ms(math 家族现状); 继续按钮在场自检留回调
    if (document.getElementById('rNextBtn')) next();
  });
}

/* ---------- 家长面板: 四带过程指标矩阵 + 趋势 + CSV + 诚实口径 ----------
   log 形状 {日期: {'b<带>': {acc, n, par}}}(写入点 robotSettleSave), 聚合
   按 n 加权; 只报过程指标(完成率/最短指令达成率/次数), 不做能力诊断 */
function robotPanelAgg(log) {
  const rows = [0, 1, 2, 3].map(() => ({acc: 0, par: 0, n: 0}));
  for (const day of Object.keys(log || {})) {
    const d = log[day] || {};
    for (let band = 0; band < 4; band++) {
      const r = d['b' + band];
      if (!r || typeof r !== 'object' || !r.n) continue; // 损坏记录防御
      rows[band].acc += (r.acc || 0) * r.n;
      rows[band].par += (r.par || 0) * r.n;
      rows[band].n += r.n;
    }
  }
  return rows.map((r) => ({acc: r.n ? r.acc / r.n : 0, par: r.n ? r.par / r.n : 0, n: r.n}));
}

/* 近 7 个有记录日的带 acc 序列(升序, 非法日期键过滤) */
function robotPanelTrend(log, band) {
  const recs = [];
  for (const day of Object.keys(log || {})) {
    if (!Number.isFinite(CampCore.dayIndex(day))) continue;
    const r = (log[day] || {})['b' + band];
    if (r && r.n) recs.push({day, acc: r.acc || 0, n: r.n});
  }
  recs.sort((a, b) => CampCore.dayIndex(a.day) - CampCore.dayIndex(b.day));
  return recs.slice(-7);
}

/* CSV 行集(BOM 与下载走 CampKit.downloadCsv): 日期 + 四带×{正确率%, par%, 次数} + 图章 */
function robotPanelCsv(save) {
  const log = (save && save.log) || {};
  const stamps = (save && save.stamps) || {};
  const days = Object.keys(log).filter((k) => Number.isFinite(CampCore.dayIndex(k)))
      .sort((a, b) => CampCore.dayIndex(a) - CampCore.dayIndex(b));
  const head = ['日期'];
  for (const b of ROBOT_BANDS) head.push(b.name + '正确率%', b.name + '最短指令达成率%', b.name + '次数');
  head.push('图章');
  const rows = [head];
  for (const day of days) {
    const d = log[day] || {};
    const line = [day];
    for (let band = 0; band < 4; band++) {
      const r = d['b' + band] || {};
      line.push(r.n ? Math.round((r.acc || 0) * 100) : '',
          r.n ? Math.round((r.par || 0) * 100) : '', r.n || 0);
    }
    line.push(stamps[day] || 0);
    rows.push(line);
  }
  return rows;
}

function showRobotParent() {
  const save = loadRobotSave();
  const mb = robotBudget();
  const played = mb ? mb.spentCount() : 0;
  const mins = Math.round((mb ? mb.spentMs() : 0) / 60000);
  const total = Object.values(save.stars).reduce((s, x) => s + x, 0);
  const cur = robotFrontier(save);
  const rows = robotPanelAgg(save.log);
  const cell = (v, n) => n ? Math.round(v * 100) + '% (' + n + ')' : '—';
  let body = '';
  for (let band = 0; band < 4; band++) {
    body += '<tr><td>' + ROBOT_BANDS[band].name + '</td><td>' + cell(rows[band].acc, rows[band].n) +
        '</td><td>' + cell(rows[band].par, rows[band].n) + '</td><td>' + rows[band].n + '</td><td>' +
        CampKit.sparkSvg(robotPanelTrend(save.log, band), {cls: 'r-spark', max: 1, noData: '—'}) + '</td></tr>';
  }
  const tot = rows.reduce((a, r) => ({acc: a.acc + r.acc * r.n, par: a.par + r.par * r.n, n: a.n + r.n}),
      {acc: 0, par: 0, n: 0});
  robotPlainScreen(`
    <div class="r-screen r-parent">
      <h1>家长面板</h1>
      <div class="r-stat-row">
        <div class="r-stat">今日 <b>${played}</b>/${ROBOT_DAILY_LEVELS} 关 · <b>${mins}</b> 分钟</div>
        <div class="r-stat">累计 <b>${cur + 1}</b>/${ROBOT_LEVELS.length} 关 · ⭐${total}</div>
      </div>
      <table class="r-table">
        <tr><th>关卡带</th><th>拼图完成率</th><th>最短指令达成率</th><th>次数</th><th>趋势</th></tr>
        ${body}
        <tr><th>合计</th><th>${tot.n ? Math.round(tot.acc / tot.n * 100) + '%' : '—'}</th>
            <th>${tot.n ? Math.round(tot.par / tot.n * 100) + '%' : '—'}</th><th>${tot.n}</th><th></th></tr>
      </table>
      <div class="r-note">
        本模式是<b>练习规划顺序、路径记忆与按规则行动</b>的结构化编程游戏
        （序列化思维可练；「最短指令达成率」指用接近 BFS 最短解的指令数过关）。
        面板只展示<b>过程指标</b>（完成率/达成率/次数），<b>不是能力测评</b>；
        不宣称提升智商，也不宣称「编程游戏提升执行功能」的强因果
        （相关随机对照试验证据不一）。孩子的表现随发育波动很大，偶尔完不成完全正常。
      </div>
      <div class="r-btn-row">
        <button class="r-btn" id="rCsvBtn">${btnImg('doc')} 导出记录 CSV</button>
        <button class="r-btn" id="rParentBack">${btnImg('house')} 返回</button>
      </div>
    </div>`);
  document.getElementById('rParentBack').onclick = showRobotToday;
  document.getElementById('rCsvBtn').onclick = () => {
    CampKit.downloadCsv('怪物指挥官记录.csv', robotPanelCsv(save)); // BOM+Blob+click 仪式件(kit)
  };
}

/* ---------- 模式对象 ---------- */
const RobotMode = mkMode({
  id: 'robot',
  init() {
    robotShell.init(); // 壳骨架: 建根→显示→收 overlay→背包读档→今日页
  }, // 纯点选全屏 UI: chrome 全关由 kit 默认处理(focus/math 同款)
  cleanup() {
    robotShell.cleanup(); // 停止钩子(本关/世界宿主/续程)→ticker→战利品清场→静音→藏根
  },
});
