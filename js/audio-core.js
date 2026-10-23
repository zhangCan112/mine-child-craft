'use strict';
/* ============================================================
   音频核心 (AudioCore, 术语见 GLOSSARY.md) — 引擎层纯核心(有单测)
   ------------------------------------------------------------
   音频系统里可纯计算的全部决策, 藏住"何时允许一声 / 何时起停音乐":
   · mkVoiceGate      SFX 发声准入 — 上限内放行, 满员按优先级抢占最老, 同类冷却
   · mkMusicDirector  BGM 稀疏调度状态机 — tick 吐 start/stop/gain 纯数据事件
   · AUDIO_MIX        儿童保守响度常数表(总线增益 / duck 深度 / 各淡变时长)
   WebAudio 节点的真实启停在引擎层 adapter(js/audio.js), 本核心不碰。
   interface: AUDIO_MIX / mkVoiceGate({max,now}) / mkMusicDirector({rand,tracks,gain})
   依赖(均经全局名, 调用期解析): 无 — 时间与随机均由调用方注入, 加载零副作用
   可测性: 零 THREE·零 DOM·零全局可变依赖, 有同名单测 test/audio-core.test.js
   ============================================================ */

/* 响度常数表 — 儿童保守下沿(spec「音频图」「TTS 让路」; 调度区间出处 plan §3.3) */
const AUDIO_MIX = Object.freeze({
  /* 总线增益(桌面/触屏两档)与总增益: 触屏整体降一档防破音 */
  music: 0.30, musicTouch: 0.25,
  sfx: 0.9, sfxTouch: 0.8,
  master: 0.8,
  /* duck: TTS 说话时音乐让路 — 压到 0.08(0.25s), 说完 0.8s 缓升回 */
  duck: 0.08, duckRampMs: 250, duckReleaseMs: 800,
  /* 换曲淡变: 淡出 1.2s(spec 钉死), 淡入取对称同值(spec 未单列) */
  fadeOutMs: 1200, fadeInMs: 1200,
});

/* BGM 随机延迟区间(ms) — Minecraft 稀疏触发模型按儿童短局缩放(plan §3.3) */
const SCHED = Object.freeze({
  menuDelay: [5000, 30000], /* 解锁后首曲(menu 口径) */
  afterTrack: [60000, 180000], /* 曲毕静默 */
  afterMood: [15000, 45000], /* 换情绪后 */
});

/* 发声准入 — max 由适配层按 IS_TOUCH 给 8/12; now 注入伪时钟可测 */
function mkVoiceGate({max = 12, now = Date.now} = {}) {
  const active = new Map(); /* kind → {t: 进入时刻, prio} */
  const lastOk = new Map(); /* kind → 上次放行时刻(同类冷却计时, 独立于活跃) */
  return {
    /* admit(kind, prio, coolMs) → {act, victim}:
       冷却窗内 ignore; 名额未满(或同 kind 重触发) play;
       满员时新声 prio 严格大于最老活跃声才 steal(victim=被抢 kind, 供停声), 否则 ignore */
    admit(kind, prio, coolMs) {
      const t = now();
      const last = lastOk.get(kind);
      if (last !== undefined && t - last < coolMs) return {act: 'ignore', victim: null};
      if (active.has(kind) || active.size < max) {
        active.set(kind, {t, prio});
        lastOk.set(kind, t);
        return {act: 'play', victim: null};
      }
      let oldestK = null;
      let oldest = null;
      for (const [k, v] of active) {
        if (!oldest || v.t < oldest.t) {
          oldestK = k;
          oldest = v;
        }
      }
      if (prio > oldest.prio) {
        active.delete(oldestK);
        active.set(kind, {t, prio});
        lastOk.set(kind, t);
        return {act: 'steal', victim: oldestK};
      }
      return {act: 'ignore', victim: null};
    },
    /* release(kind): 音源播完归还名额(冷却窗独立继续走) */
    release(kind) {
      active.delete(kind);
    },
    /* activeN(): 当前活跃声数 */
    activeN() {
      return active.size;
    },
  };
}

/* BGM 稀疏调度状态机 idle → waiting(随机延迟) → playing → (曲毕) → waiting …
   曲目条目契约: {file, mood, g, durMs} — durMs(毫秒时长)是判曲毕的唯一依据;
   rand 与 tracks 注入, 时间经 tick(dtMs) 增量注入, 事件纯数据可确定性断言。 */
function mkMusicDirector({rand = Math.random, tracks = [], gain = AUDIO_MIX.music} = {}) {
  let state = 'idle';
  let mood = null; /* 当前情绪; 'none' = 恒静默(专注训练营) */
  let unlocked = false;
  let ducked = false;
  let waitMs = 0; /* waiting: 距起曲剩余 */
  let playMs = 0; /* playing: 已播 */
  let fadeMs = 0; /* playing: >0 = 换情绪淡出剩余 */
  let track = null; /* playing 中曲目条目 */
  let lastTrack = null; /* 上一首(同 mood 选曲避重复) */
  const pending = []; /* 命令(duck/setMood)产生的事件, 下次 tick 先吐 */

  const range = (r) => r[0] + rand() * (r[1] - r[0]);
  const poolOf = (m) => tracks.filter((t) => t.mood === m);
  const playable = (m) => !!m && m !== 'none' && poolOf(m).length > 0;
  /* 当前音乐总线应有增益: 曲中未淡出=基线(duck 时压低), 其余(淡出/无曲)=0 */
  const busTarget = () => (track && fadeMs <= 0 ? (ducked ? AUDIO_MIX.duck : gain) : 0);
  const enterWaiting = (delay) => {
    state = 'waiting';
    waitMs = range(delay);
  };

  return {
    /* tick(dtMs) → events[]: 推进状态机, 返回本拍事件(可能为空) */
    tick(dtMs) {
      const events = pending.splice(0, pending.length);
      if (state === 'playing' && fadeMs > 0) {/* 换情绪淡出中 */
        fadeMs -= dtMs;
        if (fadeMs <= 0) {
          events.push({type: 'stop'});
          lastTrack = track;
          track = null;
          playMs = 0;
          if (playable(mood)) enterWaiting(SCHED.afterMood);
          else state = 'idle';
        }
      } else if (state === 'waiting') {
        waitMs -= dtMs;
        if (waitMs <= 0) {/* 到点起曲: 同 mood 池内避开上一首(池只有一首时允许重复) */
          const full = poolOf(mood);
          const pool = full.length > 1 ? full.filter((t) => t !== lastTrack) : full;
          const pick = pool[Math.floor(rand() * pool.length)];
          track = pick;
          lastTrack = pick;
          playMs = 0;
          state = 'playing';
          const startGain = ducked ? AUDIO_MIX.duck : gain;
          events.push({type: 'start', track: pick, gain: startGain, fadeInMs: AUDIO_MIX.fadeInMs});
        }
      } else if (state === 'playing') {/* 曲中计时, 曲毕入静默 */
        playMs += dtMs;
        if (track && playMs >= track.durMs) {
          events.push({type: 'stop'});
          lastTrack = track;
          track = null;
          playMs = 0;
          enterWaiting(SCHED.afterTrack);
        }
      }
      return events;
    },
    /* setMood(m): 同 mood 续播不打断; 换 mood 曲中 1.2s 淡出后 15~45s 新曲 */
    setMood(m) {
      if (m === mood) return;
      mood = m;
      if (state === 'playing') {
        if (fadeMs <= 0) {
          fadeMs = AUDIO_MIX.fadeOutMs;
          pending.push({type: 'gain', target: 0, rampMs: AUDIO_MIX.fadeOutMs});
        }
      } else if (state === 'waiting') {
        if (playable(mood)) enterWaiting(SCHED.afterMood);
        else state = 'idle';
      } else if (unlocked && playable(mood)) {
        enterWaiting(SCHED.afterMood);
      }
    },
    /* unlock(): 用户手势解锁, menu 口径 5~30s 后首曲 */
    unlock() {
      unlocked = true;
      if (state === 'idle' && playable(mood)) enterWaiting(SCHED.menuDelay);
    },
    /* duck(on): TTS 让路 — 压到 0.08(0.25s) / 回当前基线(0.8s), 幂等 */
    duck(on) {
      if (!!on === ducked) return;
      ducked = !!on;
      pending.push(ducked ?
          {type: 'gain', target: AUDIO_MIX.duck, rampMs: AUDIO_MIX.duckRampMs} :
          {type: 'gain', target: busTarget(), rampMs: AUDIO_MIX.duckReleaseMs});
    },
    /* snapshot(): 状态快照(纯数据, 调试与测试用) */
    snapshot() {
      return {state, mood, ducked, unlocked};
    },
  };
}

const AudioCore = {AUDIO_MIX, mkVoiceGate, mkMusicDirector};
if (typeof module !== 'undefined' && module.exports) module.exports = AudioCore;
