'use strict';
/* ============================================================
   MathTrackCore(世界轨试次循环核心, 术语见 GLOSSARY.md「世界轨驱动器」)
   — 应用层·纯核心
   一句话职责: 训练营三引擎(屏流 math-paradigms / hop 世界轨 math-world /
   摆与搭 math-build-world)共用的试次循环纯骨架 — 记分账本(trials/
   correct/acc/maxStreakErr)与节拍决策(settle 返回事件描述符: 连对 %3
   表扬 / 连错 ≥3 安慰并清零), 话术/音效/观感/计时由引擎按事件施加;
   T3 起三处逐字同构副本并一于此(一份形状, 一处演化)。
   interface: mkTrialLoop() → {stats · settle(ok)→{ok,streak,praise,comfort}
     · end()→stats(回填 acc)} · clampTrials(n)→1..30(缺省 6) ·
     bossPlan(level, dispatch)→sections 附 track · aggStats(list)→单关口径聚合
   依赖(均经全局名, 调用期解析): 无(零 THREE · 零 DOM · 零全局可变依赖)
   可测性: 纯函数, 有同名单测(test/math-track-core.test.js)
   ============================================================ */

/* 试次钳制: 1~30, 缺省 6 — 原三引擎 + modes/math.js boss 聚合四处手写
   同款并一; 调用方传 undefined/null/0 均回落 6 */
function trackClampTrials(n) {
  return Math.max(1, Math.min(30, n || 6));
}

/* 试次循环状态机: stats 是唯一对外账本(引用稳定, end() 回填 acc);
   settle 只做记分与节拍决策 — 不碰音效/话术/观感/计时(引擎按 ev 施加),
   「已结算/已中止」闸也不在此(各引擎的 settled/stopped 语义留在引擎) */
function trackMkTrialLoop() {
  const stats = {trials: 0, correct: 0, acc: 0, maxStreakErr: 0};
  let streak = 0;
  let errRun = 0;
  return {
    stats,
    settle(ok) {
      stats.trials++;
      if (ok) {
        stats.correct++;
        streak++;
        errRun = 0;
      } else {
        streak = 0;
        errRun++;
        stats.maxStreakErr = Math.max(stats.maxStreakErr, errRun);
      }
      const comfort = !ok && errRun >= 3;
      if (comfort) errRun = 0; /* 安慰即清零(三引擎同口径: 连错计数从安慰后重攒) */
      return {ok, streak, praise: ok && streak % 3 === 0, comfort};
    },
    end() {
      stats.acc = stats.trials ? stats.correct / stats.trials : 0;
      return stats;
    },
  };
}

const MathTrackCore = {clampTrials: trackClampTrials, mkTrialLoop: trackMkTrialLoop,
  bossPlan: trackBossPlan, aggStats: trackAggStats};

/* boss 小节附轨道标注('screen'|'world'): 分发缝经参数注入 — 纯核心不依赖
   驱动器/引擎清单(T4 从 modes/math.js 迁入, 判据与断言不变) */
function trackBossPlan(level, dispatch) {
  return (level.sections || []).map((s) => Object.assign({}, s,
      {track: dispatch(s.family, s.variant)}));
}

/* boss 聚合按单关口径: 试次/正确求和, acc 重算, maxStreakErr 取最大
   (T4 从 modes/math.js 的 mathAggStats 迁入) */
function trackAggStats(list) {
  const agg = {trials: 0, correct: 0, acc: 0, maxStreakErr: 0};
  for (const st of list || []) {
    agg.trials += st.trials || 0;
    agg.correct += st.correct || 0;
    agg.maxStreakErr = Math.max(agg.maxStreakErr, (st && st.maxStreakErr) || 0);
  }
  agg.acc = agg.trials ? agg.correct / agg.trials : 0;
  return agg;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {MathTrackCore, trackClampTrials, trackMkTrialLoop,
    trackBossPlan, trackAggStats};
}
