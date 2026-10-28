'use strict';
/* ============================================================
   Robot Commander Mode (怪物指挥官模式, 术语见 GLOSSARY.md) — 模式层
   ------------------------------------------------------------
   一句话职责: 装配怪物指挥官的训练营壳(今日页/地图页/家长门)与全部
   应用层文案; 指令模拟纯核心(js/robot-core.js)与棋盘世界宿主
   (js/robot-world.js)随 T2/T4 票落地, 关卡 runner 与结算(T5)在本文件续建。
   interface: RobotMode(mkMode 注册对象, id='robot')
   依赖(均经全局名, 调用期解析): mkMode(js/mode-kit.js) ·
     CampKit(js/camp-kit.js — 壳骨架/战利品 HUD/结算件/话术件/家长门,
     加载序在本文件之前) · Backpack(js/backpack.js, ADR 0002 共享背包 —
     只产出的新消费方) · SpeechKit(js/speech.js) ·
     showToast(js/effects.js) · btnImg(js/button-icons.js) ·
     ROBOT_*(js/robot-levels.js) · ROBOT_DAILY_*(js/daily-budget.js) ·
     Budgets(js/main.js setupBudgets 建立的 robot 预算) ·
     SyncDB(js/sync.js) · overlay/showPage(js/main.js 组合根, main.js 后
     加载, 调用期才解析 — 与 focus/math 同款)
   可测性: 纯 DOM 模式层, 由 boot.test.js 全链冒烟兜底
   ------------------------------------------------------------
   玩法与训练设计(docs/robot-program-design.md): 编程解谜训练营——孩子
   提前编排指令序列(槽位队列点选, 无拖拽/无循环), 回放看怪物从起点走到
   终点旗; 五维嵌入与防挫败阶梯(D4: 带0 直接驱动起步)见设计稿 §2/§5。
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
   额度尽 → 今日页锁定文案 + 明天再来; 访问器经壳骨架(budgetName 注入) */
function robotBudget() {
  return robotShell.budget();
}
function robotLocked() {
  return robotShell.locked();
}

/* ---------- 共享背包(ADR 0002): 怪物指挥官是只产出的新消费方 ----------
   进模式 init() 时经壳骨架 load 一次(重进必重读); 只产出不消耗,
   不得自开存档键(背包壳唯一持有); 战利品表与掷骰随 T3 票落 robot-levels */
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

/* ---------- 训练营壳骨架(CampKit.mkCampShell): 一实例一家族 ----------
   存档槽三件套(家族键名/defaults/migrate 经 opts 注入); onRootPointerDown
   记战利品飞行起点; initPost 进今日页 */
const robotShell = CampKit.mkCampShell({
  prefix: 'r',
  rootId: 'robotRoot',
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
function robotExit() {
  robotShell.exit(); // 停止钩子 → ticker → 静音 → 藏根 → 收 overlay 回主菜单
}

/* ---------- 家长门(CampKit.mkParentGate): 算术门一实例一家族 ----------
   答对开家长面板(T5 续建完整面板), 答错静默回今日页(零羞辱) */
const robotParentGate = CampKit.mkParentGate({
  prefix: 'r',
  scope: '#robotRoot',
  screen: robotScreen,
  onPass: showRobotParent, // T5: 家长面板(分带正确率/par 达成率/CSV)
  onFail: showRobotToday,
});
function showRobotParentGate() {
  robotParentGate.open();
}
function showRobotParent() {
  // T5 票续建: 分带正确率矩阵 / par 达成率 / 近 7 日趋势 / CSV 导出 / 诚实口径说明
  robotScreen(`
    <div class="r-screen">
      <h1>家长面板</h1>
      <p class="r-sub">施工中（T5）：只报过程指标，不做能力诊断</p>
      <button class="r-btn" id="rParentBack">${btnImg('house')} 回今天</button>
    </div>`);
  document.getElementById('rParentBack').onclick = showRobotToday;
}

/* ---------- 今日页: 进度概览 + 进入地图 ----------
   锁定体验同 focus/math: 额度尽 → 锁定文案 + 明天再来(零惩罚) */
function showRobotToday() {
  stopRobotTicker();
  const save = loadRobotSave();
  const locked = robotLocked();
  const played = robotBudget() ? robotBudget().spentCount() : 0;
  const total = Object.values(save.stars).reduce((s, x) => s + x, 0);
  const dots = Array.from({length: ROBOT_DAILY_LEVELS}, (_, k) =>
    '<span class="dot ' + (k < played ? 'done' : '') + '"></span>').join('');
  if (locked) {
    robotScreen(`
      <div class="r-screen r-today">
        <h1>今天的指挥任务完成啦！</h1>
        <p class="r-sub">小怪物们要休息了，明天再来吧 · ⭐${total}</p>
        <div class="r-dots">${dots}</div>
        <button class="r-parent-btn" id="rParentBtn">${btnImg('lock')} 家长</button>
        <button class="r-btn" id="rHome2">${btnImg('house')} 回主页</button>
      </div>`);
    document.getElementById('rHome2').onclick = robotExit;
    document.getElementById('rParentBtn').onclick = showRobotParentGate;
    return;
  }
  robotScreen(`
    <div class="r-screen r-today">
      <h1>怪物指挥官</h1>
      <p class="r-sub">⭐${total} · 每天 ${ROBOT_DAILY_LEVELS} 关 / ${ROBOT_DAILY_MIN} 分钟</p>
      <button class="r-start" id="rStartBtn">▶ 开始指挥</button>
      <div class="r-dots">${dots}</div>
      <button class="r-parent-btn" id="rParentBtn">${btnImg('lock')} 家长</button>
    </div>`);
  SpeechKit.speak('欢迎来到怪物指挥官！给小怪物排好指令，带它回家吧。');
  document.getElementById('rStartBtn').onclick = showRobotMap;
  document.getElementById('rParentBtn').onclick = showRobotParentGate;
}

/* ---------- 地图页(骨架): 关卡地图随 T3/T4 票续建 ---------- */
function showRobotMap() {
  robotScreen(`
    <div class="r-screen">
      <h1>关卡地图</h1>
      <p class="r-sub">100 关施工中（T3 关卡库 + T4 棋盘世界）</p>
      <button class="r-btn" id="rMapBack">${btnImg('house')} 回今天</button>
    </div>`);
  document.getElementById('rMapBack').onclick = showRobotToday;
}

/* ---------- 模式对象 ---------- */
const RobotMode = mkMode({
  id: 'robot',
  init() {
    robotShell.init(); // 壳骨架: 建根→显示→收 overlay→背包读档→今日页
  }, // 纯点选全屏 UI: chrome 全关由 kit 默认处理(focus/math 同款)
  cleanup() {
    robotShell.cleanup(); // 停止钩子→ticker→战利品清场→续程收口→静音→藏根
  },
});
