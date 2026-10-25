'use strict';
/* ============================================================
   确定性随机核心 (RandCore, 术语见 GLOSSARY.md「确定性随机核心」) — 引擎层纯核心
   ------------------------------------------------------------
   一句话职责: 全仓种子确定随机的唯一实现 — 同常数 LCG 随机流、非突变
   洗牌、关卡/小节种子派生、父流派生子种子; 消费方(focus/math 两训练营
   的掷骰与出题)不再自持本地副本, 同 seed 同输出只此一份语义。
   interface: mkRand(seed?) → rnd()∈[0,1)(LCG 闭包) ·
     shuffle(rnd, arr) → 洗好的新数组(入参不动) ·
     seedAt(base, i, j?) → base*7919 + i*101 + (j||0) + 13(关卡/小节种子) ·
     childSeed(rnd) → [0, 2147483646] 整数(从父随机流派生子种子)
   依赖(零全局, 全部经参数注入): 无 — 加载零副作用, 浏览器 <script defer>
     与 Node require 同构。
   可测性: 零 THREE · 零 DOM · 有单测 test/rand-core.test.js
   ============================================================ */
const RandCore = (() => {
  /* 同常数 LCG(2026-10 归一全仓五份逐字同语义副本: focus-levels 的
     mkLootRand · math-levels 的 mathLootRand · math-paradigms 的 mRand ·
     math-puzzles-core 与 math-build-world-core IIFE 内的 mkRand)。
     seed 缺省回落 Math.random 是既定口径: 不回落则首步得 NaN,
     NaN>=p 恒假=掉率虚涨 100%, 池内比较全假=恒掉最后一键(曾有回归,
     test/math-levels.test.js 的 NaN 回归锁)。 */
  function mkRand(seed) {
    let s = seed === undefined ? Math.floor(Math.random() * 2147483648) : seed;
    return function() {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  /* 非突变拷贝式 Fisher–Yates(准形: math-paradigms 原 mShuffle) —
     入参不动, 返回洗好的新数组; rnd 注入, 同流同序 */
  function shuffle(rnd, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 关卡/小节种子统一派生: base*7919 + i*101 + (j||0) + 13, j 缺省 0 —
     2026-10 归一三套历史公式(math.js 的 i*7919+13 · math-track.js 的
     i*7919+si*101 · math-build-world.js 的 seed*31+idx*101+7), 恒等/
     换题逐点拍板见各消费点注释 */
  function seedAt(base, i, j) {
    return base * 7919 + i * 101 + (j || 0) + 13;
  }

  /* 从父随机流派生子种子: 喂给以 seed 为入参的生成器(PuzzleCore/
     BuildWorldCore 等), 原各处内联 Math.floor(rnd()*2147483647) */
  function childSeed(rnd) {
    return Math.floor(rnd() * 2147483647);
  }

  return {mkRand, shuffle, seedAt, childSeed};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RandCore;
