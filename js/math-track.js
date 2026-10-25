'use strict';
/* ============================================================
   MathTrack(世界轨驱动器, 术语见 GLOSSARY.md「世界轨驱动器」)
   — 应用层·装配(modes/math.js 的关卡段运行 seam)
   一句话职责: 数学冒险岛关卡节的唯一驱动器 — 变体分发(screen|world)、
   单节生命周期(启动/离场/中止)、boss 小节串链与聚合、「清完再发 end」的
   统一时序(场景装填纪律由驱动器担保, 不再依赖各引擎自觉); 原两条命
   (mathCtrl 控制柄 + mathBossStop 链旗)在内部合一。交互插件实现:
   js/math-world.js(hop 混合宿主) · js/math-build-world.js(摆与搭指针锁
   宿主) · js/math-paradigms.js(屏流引擎, 迁入驱动器留待后续票);
   记分/节拍/boss 规划在 js/math-track-core.js(纯核心, 有单测)。
   interface: dispatch(family,variant)→'screen'|'world' ·
     run(section, areaEl, h)→{stop(),onMouse?}|null(单节; end 前先离场) ·
     runBoss(level, areaEl, h)(串链, h={progress?,onTrial(sec,t)?,end(agg)?,speak?}) ·
     leave()(单节离场: stop+交还指针+复明 DOM, 幂等) ·
     stop()(整链一刀: 当前节+boss 链) · active()→bool ·
     mouse(button,hit)(路由活动节 onMouse) ·
     worldRunners(世界插件注册表 — 「变体清单单一权威」测试对着它断言)
   依赖(均经全局名, 调用期解析): mathScreenDispatch/runMathScreen
     (js/math-paradigms.js) · runHopWorld(js/math-world.js) ·
     runBuildWorld(js/math-build-world.js) · MathTrackCore(js/math-track-core.js) ·
     MATH_META(js/math-levels.js) · uiPause/touchPlaying(js/input.js) ·
     RandCore(js/rand-core.js, boss 小节种子派生 seedAt) ·
     mathRoot(js/modes/math.js, 加载序在本文件之后)
   可测性: THREE/DOM 惰性消费(装场在插件); 分发/时序/串链/离场纪律由
     test/math-track.test.js vm 桩直测(world-integrity 先例)
   ============================================================ */

/* ---------- 变体分发(唯一缝): 屏流键在 math-paradigms 的引擎表, 其余=世界 ---------- */

function trackDispatch(family, variant) {
  return mathScreenDispatch(family, variant).kind === 'engine' ? 'screen' : 'world';
}

/* ---------- 世界插件注册(变体键 → 装配入口; 增删世界变体只改这一张表) ---------- */

const MATH_WORLD_RUNNERS = {
  'hop/dice': runHopWorld,
  'hop/jumps': runHopWorld,
  'hop/gaps': runHopWorld,
  'mirror/reflect': runBuildWorld, // 摆与搭: 指针锁宿主插件(与 hop 混合宿主并列)
  'mirror/translate': runBuildWorld,
  'mirror/rotate': runBuildWorld,
  'mirror/tangram': runBuildWorld,
  'mirror/bridge': runBuildWorld, // G4 最省桥: 两岸地形+河面桥线放置+发光石交卷
  'plan/build': runBuildWorld,
  'plan/pick': runBuildWorld,
  'plan/hidden': runBuildWorld,
  'plan/countall': runBuildWorld,
  'plan/dualview': runBuildWorld, // G4 双视角: 候选建筑+立式投影牌点选
};

function trackWorldRunner(family, variant) {
  return MATH_WORLD_RUNNERS[family + '/' + variant] || null;
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
  let handle = null;
  if (trackDispatch(section.family, section.variant) === 'world') {
    const runner = trackWorldRunner(section.family, section.variant);
    if (runner) handle = runner(section, hh); /* 未注册变体: 保持 null 契约(防御) */
  } else {
    handle = runMathScreen(section, areaEl, hh);
  }
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
    trackRun({family: s.family, variant: s.variant, tier: s.tier, kind: 'challenge',
      params: s.params, seed: RandCore.seedAt(level.i, si)}, areaEl, {
      progress(k, n) {
        if (hh.progress) hh.progress(doneTrials + k, totalTrials);
      },
      onTrial(t) {
        if (hh.onTrial) hh.onTrial(s, t); /* 按小节掷骰: 消费方拿 {family, kind} */
      },
      end: secEnd,
    });
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
  worldRunners: MATH_WORLD_RUNNERS,
};

if (typeof module !== 'undefined' && module.exports) module.exports = {MathTrack};
