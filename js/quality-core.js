'use strict';
/* ============================================================
   画质核心 (QualityCore, 术语见 GLOSSARY.md) — 引擎层纯核心(有单测)
   ------------------------------------------------------------
   触屏 DPR 自适应的纯决策核心: 主循环每半秒喂一次 fps 采样 (step 一次调用 = 一个采样):
   · 降档快: 持续低帧 3 秒即降, 不受冷却 — 卡了就降, 可玩性优先
   · 升档慢: 持续高帧 30 秒 且 降档冷却(60 秒)耗尽 才升 — 防抖
   · 45~55fps 死区不积累证据 — 临界帧率不来回抽动
   · 升档观察窗(30 秒)内又被迫降档 → 该档本场封顶, 不再重试
   LPM 守卫(mkLpmGuard): 低电量模式把 rAF 钉在 30fps 且无 API 可查 — 会被上面的
   降档逻辑误读为"带不动"一路降到底; 守卫吃每帧原始 rAF 间隔, 紧带特征判定后
   由调用方(main.js)冻结喂采样。
   纯核心不碰 renderer/DOM — setPixelRatio 的施加在 main.js。
   ============================================================ */
const QualityCore = {
  /* 档位台阶与下限 */
  STEP: 0.25, MIN: 1,
  /* 降档: 连续 6 个采样(3 秒) fps<45 → DPR -0.25 */
  DOWN_FPS: 45, DOWN_STREAK: 6,
  /* 升档: 连续 60 个采样(30 秒) fps≥55 → DPR +0.25 (还需冷却耗尽) */
  UP_FPS: 55, UP_STREAK: 60,
  /* 降档后的升档冷却: 120 个采样(60 秒)内不许升 */
  UP_CD: 120,
  /* 升档观察窗: 升后 60 个采样(30 秒)内又降档 → dprMax 封到当前档 */
  WATCH: 60,
  /* LPM 守卫: rAF 间隔紧带判定(毫秒) — 31.5~36 覆盖 33.3±抖动, 排除快帧与慢帧;
     锁存需连续 60 帧(30fps 下约 2 秒) — 早于降档所需的 3 秒连续低帧采样 */
  LPM_LO: 31.5, LPM_HI: 36, LPM_N: 60,

  /* mk(dprMax): 初始档 = 设备当前渲染 DPR 向下取整到台阶 (1.1 → 1) */
  mk(dprMax) {
    const max = Math.max(this.MIN, Math.floor(dprMax/this.STEP)*this.STEP);
    return {dpr: max, dprMax: max, low: 0, high: 0, cd: 0, watch: 0};
  },

  /* step(q, fps): 喂一个半秒采样, 返回新 DPR; 0 = 本采样不变 */
  step(q, fps) {
    if (fps <= 0) return 0; // 尚无有效采样(启动初期)
    if (q.cd > 0) q.cd--; // 冷却/观察窗按采样递减
    if (q.watch > 0) q.watch--;

    if (fps < this.DOWN_FPS) {
      q.high = 0;
      if (++q.low >= this.DOWN_STREAK && q.dpr > this.MIN) {
        q.dpr = Math.max(this.MIN, q.dpr - this.STEP);
        q.low = 0;
        if (q.watch > 0) { // 升档后没撑过观察窗: 该档不稳, 本场封顶
          q.dprMax = q.dpr;
          q.watch = 0;
        }
        q.cd = this.UP_CD;
        return q.dpr;
      }
    } else {
      q.low = 0;
      if (fps >= this.UP_FPS) {
        if (++q.high >= this.UP_STREAK && q.cd === 0 && q.dpr < q.dprMax) {
          q.dpr = Math.min(q.dprMax, q.dpr + this.STEP);
          q.high = 0;
          q.watch = this.WATCH;
          return q.dpr;
        }
      } else q.high = 0; // 死区: 证据清零
    }
    return 0;
  },

  /* ---------- LPM(低电量模式)守卫 ----------
     WebKit 在低电量模式把 rAF 钉在 30fps(调研 docs/ipad5-performance-research.md
     §2.4, 无查询 API) — 30 < DOWN_FPS 会让 step 把 DPR"合法地"降到下限且死区
     永不积累升档证据。守卫吃主循环每帧的原始 rAF 间隔(毫秒, 钳制前的值):
     · 锁存: 未锁存时连续 LPM_N 帧全部落在 [LPM_LO, LPM_HI] — LPM 的间隔是紧带
       33.3±2ms, 负载型 30fps 是快慢帧宽抖动, 连续 2 秒全落紧带实际不发生
       (用原始间隔而非半秒 fps 聚合值, 就是为了这点区分度);
     · 解锁: 锁存后任一帧 < LPM_LO(60fps 回来了); 单发 > LPM_HI 的卡顿帧不解锁
       (LPM 仍在, 只是调度 hiccup)。解锁后证据清零重攒。 */
  mkLpmGuard() {
    const g = {on: false, n: 0};
    g.feed = (ms) => {
      if (g.on) {
        if (ms < this.LPM_LO) {
          g.on = false; g.n = 0;
        }
      } else if (ms >= this.LPM_LO && ms <= this.LPM_HI) {
        if (++g.n >= this.LPM_N) g.on = true;
      } else {
        g.n = 0;
      }
      return g.on;
    };
    return g;
  },
};
