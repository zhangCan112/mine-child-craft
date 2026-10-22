'use strict';
/* ============================================================
   画质核心 (QualityCore, 术语见 GLOSSARY.md) — 引擎层纯核心(有单测)
   ------------------------------------------------------------
   触屏 DPR 自适应的纯决策核心: 主循环每半秒喂一次 fps 采样 (step 一次调用 = 一个采样):
   · 降档快: 持续低帧 3 秒即降, 不受冷却 — 卡了就降, 可玩性优先
   · 升档慢: 持续高帧 30 秒 且 降档冷却(60 秒)耗尽 才升 — 防抖
   · 45~55fps 死区不积累证据 — 临界帧率不来回抽动
   · 升档观察窗(30 秒)内又被迫降档 → 该档本场封顶, 不再重试
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
};
