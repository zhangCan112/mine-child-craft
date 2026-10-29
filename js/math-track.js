'use strict';
/* ============================================================
   MathTrack(世界轨驱动器, 术语见 GLOSSARY.md「世界轨驱动器」)
   — 应用层·装配(modes/math.js 的关卡段运行 seam)
   一句话职责: 数学冒险岛关卡节的唯一驱动器 — 变体分发(screen|world)、
   单节生命周期(启动/离场/中止)、boss 小节串链与聚合、「清完再发 end」的
   统一时序(场景装填纪律由驱动器担保, 不再依赖各引擎自觉); 原两条命
   (mathCtrl 控制柄 + mathBossStop 链旗)在内部合一。三交互插件经统一
   注册表 MATH_TRACK_RUNNERS 入册(T5-b: 屏流并入, dispatch 反转纯查表):
   js/math-world.js(hop 混合宿主) · js/math-build-world.js(摆与搭指针锁
   宿主) · js/math-paradigms.js(屏流引擎, 键集加载期自引擎表派生);
   记分/节拍/boss 规划在 js/math-track-core.js(纯核心, 有单测)。
   interface: dispatch(family,variant)→'screen'|'world'|null(纯查表: 未册键
     返 null — 原「未知键归世界轨」语义随 T5-b 废除; run 侧未册键
     warn+空账收口, 防消费方空等 end 卡屏) ·
     run(section, areaEl, h)→{stop(),onMouse?}|null(单节; end 前先离场) ·
     runBoss(level, areaEl, h)(串链, h={progress?,onTrial(sec,t)?,end(agg)?,speak?}) ·
     leave()(单节离场: stop+交还指针+复明 DOM, 幂等) ·
     stop()(整链一刀: 当前节+boss 链) · active()→bool ·
     mouse(button,hit)(路由活动节 onMouse) ·
     runners(统一插件注册表 {kind:'screen'|'world', run} — 「变体清单单一权威」测试对着它断言)
   依赖(均经全局名, 调用期解析): MATH_SCREEN_ENGINES/runMathScreen
     (js/math-paradigms.js, 引擎表在加载期被本注册表派生消费 — index.html
     脚本序 math-paradigms 先于本文件) · runHopWorld(js/math-world.js) ·
     runBuildWorld(js/math-build-world.js) · MathTrackCore(js/math-track-core.js) ·
     MATH_META(js/math-levels.js) · uiPause/touchPlaying(js/input.js) ·
     RandCore(js/rand-core.js, boss 小节种子派生 seedAt) ·
     mathRoot(js/modes/math.js, 加载序在本文件之后)
   可测性: THREE/DOM 惰性消费(装场在插件); 分发/时序/串链/离场纪律由
     test/math-track.test.js vm 桩直测(world-integrity 先例)
   ============================================================ */

/* ---------- 统一插件注册(变体键 → {kind:'screen'|'world', run}; 增删变体只改这一张表) ---------- */

/* 世界宿主适配层(T5-b): 注册表统一 (section, areaEl, h) 三参形状, 世界宿主
   保持两参 (section, h) 签名零改动 — 每宿主一份适配函数, 同宿主键按 run
   身份可断言; 宿主经全局名调用期解析 */
const trackHopRun = (section, areaEl, h) => runHopWorld(section, h);
const trackBuildRun = (section, areaEl, h) => runBuildWorld(section, h);

const MATH_TRACK_RUNNERS = {
  'hop/dice': {kind: 'world', run: trackHopRun},
  'hop/jumps': {kind: 'world', run: trackHopRun},
  'hop/gaps': {kind: 'world', run: trackHopRun},
  'mirror/reflect': {kind: 'world', run: trackBuildRun}, // 摆与搭: 指针锁宿主插件(与 hop 混合宿主并列)
  'mirror/translate': {kind: 'world', run: trackBuildRun},
  'mirror/rotate': {kind: 'world', run: trackBuildRun},
  'mirror/tangram': {kind: 'world', run: trackBuildRun},
  'mirror/bridge': {kind: 'world', run: trackBuildRun}, // G4 最省桥: 两岸地形+河面桥线放置+发光石交卷
  'plan/build': {kind: 'world', run: trackBuildRun},
  'plan/pick': {kind: 'world', run: trackBuildRun},
  'plan/hidden': {kind: 'world', run: trackBuildRun},
  'plan/countall': {kind: 'world', run: trackBuildRun},
  'plan/dualview': {kind: 'world', run: trackBuildRun}, // G4 双视角: 候选建筑+立式投影牌点选
};
/* 屏流 16 键: 组合期接线 — 加载期从 math-paradigms 的清单唯一权威
   (MATH_SCREEN_ENGINES 引擎表)派生注册, 不在驱动器抄第二份清单;
   驱动器不再在 dispatch 时询问屏流引擎: 清单存在性权威=本表, 与引擎表
   的一致性由测试互锁断言(test/math-paradigms.test.js 单一权威) */
for (const k of Object.keys(MATH_SCREEN_ENGINES)) {
  MATH_TRACK_RUNNERS[k] = {kind: 'screen', run: runMathScreen};
}

/* ---------- 变体分发(纯查表): 在册键返 entry.kind, 未册键返 null ---------- */

function trackDispatch(family, variant) {
  const entry = MATH_TRACK_RUNNERS[family + '/' + variant];
  return entry ? entry.kind : null;
}

/* ---------- 活动节状态(控制柄与链旗合一的单一命, 引擎句柄不外泄) ---------- */

let trackCur = null; /* {handle} — 当前节控制柄({stop(), onMouse?}) */
let trackBoss = null; /* {alive} — boss 链条生命(整链中止旗) */

/* 单节离场: stop 当前节(世界插件含 clearWorld/HUD/热栏/触屏键)+交还指针+
   复明 DOM 屏。幂等; 先清柄再收尾 — 收尾的 uiPause 会触发 onMenu, 彼时
   必须已无活动节(否则 onMenu 的整链中止会二次进入) */
function trackLeave() {
  if (trackCur) {
    const t = trackCur;
    trackCur = null;
    if (t.handle && t.handle.stop) t.handle.stop();
  }
  if ((typeof document !== 'undefined' && document.pointerLockElement) ||
      (typeof touchPlaying !== 'undefined' && touchPlaying)) {
    uiPause(); /* 交还指针(只有摆与搭锁过; 屏流/hop 天然不触发) */
  }
  if (typeof mathRoot !== 'undefined' && mathRoot) mathRoot.style.display = 'block';
}

/* 整链一刀: 当前节 + boss 链(原 mathStopRun = mathCtrl.stop + mathBossStop) */
function trackStop() {
  trackLeave();
  if (trackBoss) {
    const boss = trackBoss;
    trackBoss = null;
    boss.alive = false;
  }
}

/* 路由到活动节的点选(摆与搭放置/撤除/交卷; 屏流/hop 无 onMouse 天然空转) */
function trackMouse(button, hit) {
  if (trackCur && trackCur.handle && trackCur.handle.onMouse) {
    trackCur.handle.onMouse(button, hit);
  }
}

/* ---------- 单节启动(屏流/世界同一入口) ---------- */

function trackRun(section, areaEl, h) {
  if (!section) return null;
  if (trackCur) trackLeave(); /* 防御性离场: 上一节未收即开新节(幂等) */
  const hh = Object.assign({}, h || {});
  const userEnd = hh.end;
  /* 清完再发 end(T4 时序归一): 离场(世界清场/HUD/指针/DOM)先于消费方结算 —
     旧路径 build 的 end 在场上直接触发, 残场与 HUD 靠调用方补刀 */
  hh.end = (st) => {
    trackLeave();
    if (userEnd) userEnd(st);
  };
  const entry = MATH_TRACK_RUNNERS[section.family + '/' + section.variant];
  if (!entry) {
    /* 未册变体(清单漂移防御, 单一权威测试下不可达): warn 后按空账收口 —
       静默返 null 会让消费方空等 end 卡屏 */
    console.warn('[math-track] 未册变体: ' + section.family + '/' + section.variant);
    hh.end(MathTrackCore.aggStats([]));
    return null;
  }
  const handle = entry.run(section, areaEl, hh);
  if (!handle) return null;
  trackCur = {handle};
  return handle;
}

/* ---------- boss 串链: 规划/聚合在纯核心, 400ms 小节接力在此 ---------- */

function trackRunBoss(level, areaEl, h) {
  const hh = h || {};
  const plan = MathTrackCore.bossPlan(level, trackDispatch);
  const statsList = [];
  const totalTrials = plan
      .reduce((a, s) => a + MathTrackCore.clampTrials(s.params && s.params.trials), 0);
  const boss = {alive: true};
  trackBoss = boss;
  let si = 0;
  let doneTrials = 0;
  function step() {
    if (!boss.alive) return;
    if (si >= plan.length) {
      trackBoss = null;
      if (hh.end) hh.end(MathTrackCore.aggStats(statsList));
      return; /* 链尾: 聚合按单关口径交消费方结算 */
    }
    const s = plan[si];
    if (hh.speak) {
      hh.speak('新挑战：' + (MATH_META[s.family] ? MATH_META[s.family].game : '') + '！');
    }
    const secEnd = (st) => {
      if (!boss.alive) return; /* 链已被 stop(): 晚到的 end 不再续链 */
      statsList.push(st);
      doneTrials += st.trials || 0;
      si++;
      /* 世界的清场离场已在 run() 的 end 包装里先于此发生(时序归一),
         这里只剩纯记账与接力 */
      setTimeout(() => {
        if (boss.alive) step();
      }, 400);
    };
    const before = statsList.length; /* 账目观察: trackRun 空账收口会 +1 */
    const handle = trackRun({family: s.family, variant: s.variant, tier: s.tier, kind: 'challenge',
      params: s.params, seed: RandCore.seedAt(level.i, si)}, areaEl, {
      progress(k, n) {
        if (hh.progress) hh.progress(doneTrials + k, totalTrials);
      },
      onTrial(t) {
        if (hh.onTrial) hh.onTrial(s, t); /* 按小节掷骰: 消费方拿 {family, kind} */
      },
      end: secEnd,
    });
    if (!handle && boss.alive && statsList.length === before) {
      /* 未册变体/在册 runner 拒单(清单漂移防御): 未册键的空账 end 已在
         trackRun 内触发(账目+1, 此处不再重复); 这里只兜"没有 end 会来"
         的残路 — 空账直接过, 链不在空等里卡死 */
      console.warn('[math-track] 未册变体: ' + s.family + '/' + s.variant);
      secEnd({trials: 0, correct: 0, acc: 0, maxStreakErr: 0});
    }
  }
  step();
}

const MathTrack = {
  dispatch: trackDispatch,
  run: trackRun,
  runBoss: trackRunBoss,
  leave: trackLeave,
  stop: trackStop,
  active: () => !!trackCur,
  mouse: trackMouse,
  runners: MATH_TRACK_RUNNERS,
};

if (typeof module !== 'undefined' && module.exports) module.exports = {MathTrack};
