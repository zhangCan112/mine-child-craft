'use strict';
/* ============================================================
   昼夜核心 (Daylight · 术语见 GLOSSARY.md 的"昼夜核心") — 引擎层纯核心(有单测)
   ------------------------------------------------------------
   MC 同表的一日 24000 tick 时间轴(tick 0=06:00 · 6000=正午 ·
   12000=日落开始 · 18000=午夜)与全部派生量的纯函数: 时间推进回绕 ·
   天空暗度折线(skyDim) · 夜晚判定 · 内部天空光 · 渲染亮度(锚点拟合) ·
   天空染色与天色 · 睡觉窗口。数值权威 docs/mc-daylight-torch-design.md §2
   (MC 数值依据与差异登记: docs/mc-daylight-torch-research.md)。
   interface: DAYLIGHT(常量表) · Daylight.advance/skyDim/isNight/
     internalSky/renderBright/skyTint/skyColor/sleepWindow
   依赖(均经全局名, 调用期解析): 无 — 纯核心, 消费方为 world.js(场景驱动)/
     main.js(主循环推进)/modes/adventure.js(存档与 HUD)
   可测性: 零 THREE·零 DOM·有单测(test/daylight-core.test.js)
   ============================================================ */

/* 常量表: 一日节奏与折线关键点(设计稿 §2.1) + 渲染亮度多项式/夜色染色幅度
   (world.js 的 GLSL 镜像同源插值同一份 — 重调曲线只改这里, 两端零手抄漂移) */
const DAYLIGHT = {
  TICKS: 24000, // 一天 = 24000 tick = 20 分钟(20 tick/秒, dt 秒 × 20)
  NIGHT_A: 13000, // 夜晚开始(简化口径, MC 精确值 13188/22812——差异 #15)
  NIGHT_B: 23000, // 夜晚结束
  SLEEP_A: 12542, // 睡觉窗口起(research §1.6 裁决: internal≤11 的晴天精确界)
  SLEEP_B: 23460, // 睡觉窗口止(23460 起不可睡; 23459 是最后一刻可睡)
  /* skyDim 折线 = research §1.4 internal 表反推(dim = 15 − internal) */
  DIM_KEYS: [[0, 0], [12040, 0], [13670, 11], [22330, 11], [23961, 0]],
  /* 渲染亮度多项式(renderBright 消费): FLOOR=全暗底亮 · SPAN=跨度 · POW=拟合幂 */
  BRIGHT: {FLOOR: 0.05, SPAN: 0.93, POW: 1.6},
  /* 夜色天空光染色幅度(skyTint 消费): 白天 [1,1,1] 各通道减 DROP×(skyDim/11)
     → 夜 [0.60, 0.66, 1.00](月光偏蓝; 蓝通道不掉, 恒 1) */
  TINT_DROP: [0.40, 0.34],
};

/* 相位归一到 [0, 24000): 折线/窗口查询共用的第一步(越界/负值输入防御) */
const dlNorm = (t) => ((t % DAYLIGHT.TICKS) + DAYLIGHT.TICKS) % DAYLIGHT.TICKS;

const Daylight = {
  /* 时间推进: dt 秒 × 20 tick/秒, 一日回绕; 纯函数不改入参 */
  advance(dayTime, dt) {
    return dlNorm(dayTime + dt * 20);
  },

  /* 天空暗度 0..11: DIM_KEYS 分段线性插值(正午 0 → 夜 11 → 次日 0) */
  skyDim(dayTime) {
    const t = dlNorm(dayTime);
    const k = DAYLIGHT.DIM_KEYS;
    for (let i = 1; i < k.length; i++) {
      if (t <= k[i][0]) {
        return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      }
    }
    return k[k.length - 1][1]; // 23961 之后到次日 tick 0: dim 已归 0
  },

  /* 夜晚判定: dayTime ∈ [13000, 23000) */
  isNight(dayTime) {
    const t = dlNorm(dayTime);
    return t >= DAYLIGHT.NIGHT_A && t < DAYLIGHT.NIGHT_B;
  },

  /* 内部天空光(MC 语义): 遮挡列的天空等级 skyLevel 随时间再衰减, 负值钳 0 */
  internalSky(skyLevel, dayTime) {
    return Math.max(0, skyLevel - Daylight.skyDim(dayTime));
  },

  /* 渲染亮度 0..15 → 0.05..0.98: FLOOR + SPAN × (level/15)^POW(常数 = DAYLIGHT.BRIGHT, 与 world.js 的 GLSL 镜像单源)。
     wiki 无显式公式(补证翻史定案, research §2.4), 本曲线为三锚点拟合:
     0→5% · 4→17% · 15→98%(幂 1.6 过三锚的经验值, 差异 #14) */
  renderBright(level) {
    const b = DAYLIGHT.BRIGHT;
    return b.FLOOR + b.SPAN * Math.pow(Math.max(0, level) / 15, b.POW);
  },

  /* 天空光染色: 白天 [1,1,1] → 夜 [0.60,0.66,1.00](幅度 = DAYLIGHT.TINT_DROP, 与 world.js 的 GLSL 镜像单源) 按 skyDim/11 插值(月光偏蓝) */
  skyTint(dayTime) {
    const k = Daylight.skyDim(dayTime) / 11;
    return [1 - DAYLIGHT.TINT_DROP[0] * k, 1 - DAYLIGHT.TINT_DROP[1] * k, 1];
  },

  /* 天空/雾色: 白日 #8fc7ff(world.js 现状值) ↔ 夜 #0a1430 按 skyDim/11 插值
     (黄昏橙不做 — 差异 #16) */
  skyColor(dayTime) {
    const k = Daylight.skyDim(dayTime) / 11;
    const day = [143 / 255, 199 / 255, 255 / 255];
    const night = [10 / 255, 20 / 255, 48 / 255];
    return [day[0] + (night[0] - day[0]) * k, day[1] + (night[1] - day[1]) * k, day[2] + (night[2] - day[2]) * k];
  },

  /* 睡觉窗口 ⇔ 晴天 [12542, 23459](research §1.6 裁决口径, MC 语义 =
     internal sky light ≤ 11; 无天气维度故单晴天区间)。半开区间与 isNight 同款。
     注: 线性五点折线在此界不够精确(dim 在 12542 处 ≈3.39 取不到 4),
     故直接以裁决的精确 tick 界入库常量表, 不经 skyDim 派生 */
  sleepWindow(dayTime) {
    const t = dlNorm(dayTime);
    return t >= DAYLIGHT.SLEEP_A && t < DAYLIGHT.SLEEP_B;
  },
};
