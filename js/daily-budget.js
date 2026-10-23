'use strict';
/* ============================================================
   每日预算 (DailyBudget) — 应用层政策 module, 术语见 GLOSSARY.md
   ------------------------------------------------------------
   一天一本账, 单一 key (daily_budget_save) 存全部预算:
     { date:'2026-10-18', budgets:{ play:{ms,played}, focus:{ms,played} } }
   · 儿童时限(游玩模式共享) = play 预算 (只按时长)
   · 专注训练营每日限额           = focus 预算 (时长 + 关数)
   · 午夜翻转: 读写时惰性检查, 不靠定时器
   · 限额读时求值 capMsFor(date) → 临时限额跨午夜自动重读当天配置
   · 时钟/存储经 seam 注入: 生产=Date.now+SyncDB, 测试=假钟+内存
   · 零 DOM / 零 THREE / 零语音: 到量只触发 onWarn / onExhausted 回调,
     何时强制(游戏中打断/关卡间锁定)由调用方决定
   ============================================================ */

const BUDGET_SAVE_KEY = 'daily_budget_save';
const BUDGET_BACKUP_KEY = 'daily_budget_migrate_backup';
const LEGACY_PLAY_KEY = 'play_time_save'; /* 旧机制A: {date, ms} */
const LEGACY_FOCUS_KEY = 'focus_camp_save'; /* 旧机制B: daily 字段 {date, played, ms} */
const PLAY_EXTRA_KEY = 'play_extra_save'; /* 家长加时: {date, ms} 单设备当日(见 readExtraMs) */

/* ---------- 政策限额常量(应用层; 曾住 config.js, 按分层口径移此) ----------
   儿童游玩时限(全部游玩模式共享) 与 专注训练营每日限额。
   历史上的"按日期临时调整表"(TEMP_PLAY_LIMIT_MIN)已随过期退役:
   临时调整请走存储(家长面板写 sync/localStorage), 不把日期写进源码
   — 会静默过期成无人删除的死数据。 */
const PLAY_LIMIT_DEFAULT_MIN = 10;
const FOCUS_DAILY_LEVELS = 6;
const FOCUS_DAILY_MIN = 20;

/* 本模块的存档键在加载期注册(sync.js 的回填依赖; Node 单测直载时 sync 未加载, 静默跳过) */
if (typeof registerSyncKeys === 'function') registerSyncKeys(BUDGET_SAVE_KEY, PLAY_EXTRA_KEY);

/* 日期串: 年-月-日 无前导零 — 与历史存档的键格式一致 */
function budgetDateStr(t) {
  const d = new Date(t);
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

/* ---------- 家长加时(单设备·当日): readExtraMs 纯函数, 读时求值 ----------
   存储值 {date:'2026-10-22', ms:36000000} — date 与当天日期串一致才生效,
   次日自动回落默认限额(不清存储, 日期不匹配即失效, 无死数据); 键随设备
   进度走(sync/localStorage), 给一台设备加时不影响其他设备。
   损坏/非对象/过期/非正数一律记 0。 */
function readExtraMs(raw, date) {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return 0;
    }
  }
  if (!v || typeof v !== 'object' || v.date !== date) return 0;
  return (typeof v.ms === 'number' && Number.isFinite(v.ms) && v.ms > 0) ? v.ms : 0;
}

function mkDailyBudgets(opts) {
  const o = Object.assign({key: BUDGET_SAVE_KEY, now: ()=>Date.now(), storage: null, defs: {}}, opts);
  const views = {};
  let state = null; /* 惰性加载的账本 */
  const firedWarn = {}; const firedExhausted = {}; /* name → 已触发的日期串(每天至多一次) */
  const cbs = {warn: {}, exhausted: {}};

  function today() {
    return budgetDateStr(o.now());
  }

  function load() {
    if (state === null) {
      let s = null;
      try {
        s = JSON.parse(o.storage.get(o.key) || 'null');
      } catch (e) {}
      state = (s && typeof s === 'object' && s.budgets && typeof s.budgets === 'object') ?
            s : {date: '', budgets: {}};
    }
    const t = today();
    if (state.date !== t) {/* 午夜翻转: 整本换新(标记也随之失效) */
      state = {date: t, budgets: {}};
    }
    return state;
  }
  function slot(name) {
    const s = load();
    if (!s.budgets[name] || typeof s.budgets[name].ms !== 'number') {
      s.budgets[name] = {ms: 0, played: 0};
    }
    return s.budgets[name];
  }
  function flush() {
    o.storage.set(o.key, JSON.stringify(load()));
  }

  function checkEvents(name) {
    const def = o.defs[name] || {};
    const t = load().date; const v = views[name];
    if (def.warnAtMs && firedWarn[name] !== t && !v.blocked() && v.remainingMs() <= def.warnAtMs) {
      firedWarn[name] = t;
      (cbs.warn[name]||[]).forEach((cb)=>{
        try {
          cb();
        } catch (e) {}
      });
    }
    if (firedExhausted[name] !== t && v.blocked()) {
      firedExhausted[name] = t;
      (cbs.exhausted[name]||[]).forEach((cb)=>{
        try {
          cb();
        } catch (e) {}
      });
    }
  }

  function mkView(name) {
    const def = o.defs[name] || {};
    function capMs() {
      return def.capMsFor ? def.capMsFor(load().date) :
                        (def.capMs !== undefined ? def.capMs : Infinity);
    }
    function capCount() {
      return def.capCount !== undefined ? def.capCount : Infinity;
    }
    return {
      accrue(ms) {
        const s = slot(name); s.ms += ms; checkEvents(name);
      },
      count(n) {
        const s = slot(name); s.played += (n || 1); checkEvents(name);
      },
      spentMs() {
        return slot(name).ms;
      },
      spentCount() {
        return slot(name).played;
      },
      capMs, capCount,
      remainingMs() {
        return Math.max(0, capMs() - slot(name).ms);
      },
      blocked() {
        const s = slot(name); return s.ms >= capMs() || s.played >= capCount();
      },
      reset() {
        load().budgets[name] = {ms: 0, played: 0}; flush();
      },
      flush,
      onWarn(cb) {
        (cbs.warn[name] = cbs.warn[name]||[]).push(cb);
      },
      onExhausted(cb) {
        (cbs.exhausted[name] = cbs.exhausted[name]||[]).push(cb);
      },
    };
  }

  function parseObj(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') return raw; /* 容错: 极端情况下缓存里已是对象 */
    try {
      const v = JSON.parse(raw); return (v && typeof v === 'object') ? v : null;
    } catch (e) {
      return null;
    }
  }

  /* 旧机制迁移(用户进度零丢失, 幂等, 可断点续跑):
     阶段1  新 key 缺失 → 搬运"当日"旧账(非当日次日本来就失效, 记零)
     阶段2  旧 key 退役 → 校验新 key → 备份(只写一次) → 删旧(focus 存档仅摘除 daily, 其余原样)
     任一步不成立 → 旧 key 原样保留, 下次启动重试 */
  function migrate() {
    const t = today();
    const rawPlay = o.storage.get(LEGACY_PLAY_KEY);
    const rawFocus = o.storage.get(LEGACY_FOCUS_KEY);
    const playObj = parseObj(rawPlay);
    const focusObj = parseObj(rawFocus);

    if (o.storage.get(o.key) === null || o.storage.get(o.key) === undefined) {
      const st = {date: t, budgets: {}};
      for (const name of Object.keys(o.defs)) st.budgets[name] = {ms: 0, played: 0};
      if (st.budgets.play && playObj && playObj.date === t && typeof playObj.ms === 'number') {
        st.budgets.play.ms = playObj.ms;
      }
      if (st.budgets.focus && focusObj && focusObj.daily && focusObj.daily.date === t) {
        if (typeof focusObj.daily.ms === 'number') st.budgets.focus.ms = focusObj.daily.ms;
        if (typeof focusObj.daily.played === 'number') st.budgets.focus.played = focusObj.daily.played;
      }
      o.storage.set(o.key, JSON.stringify(st));
      state = null; /* 下次 load 重读新 key */
    }

    const needStripPlay = playObj !== null; /* 只退役"读得懂"的旧值; 损坏的原样保留, 下次启动重试 */
    const needStripFocus = !!(focusObj && focusObj.daily);
    if (!(needStripPlay || needStripFocus)) return;
    const verified = (function() {
      const back = parseObj(o.storage.get(o.key));
      return !!(back && back.budgets && back.date);
    })();
    if (!verified) return; /* 新 key 未坐实 → 旧 key 不动 */
    if (o.storage.get(BUDGET_BACKUP_KEY) === null || o.storage.get(BUDGET_BACKUP_KEY) === undefined) {
      const bak = {date: t};
      if (needStripPlay) bak[LEGACY_PLAY_KEY] = rawPlay;
      if (needStripFocus) bak[LEGACY_FOCUS_KEY] = rawFocus;
      o.storage.set(BUDGET_BACKUP_KEY, JSON.stringify(bak));
    }
    if (needStripPlay) o.storage.remove(LEGACY_PLAY_KEY);
    if (needStripFocus) {
      delete focusObj.daily;
      o.storage.set(LEGACY_FOCUS_KEY, JSON.stringify(focusObj)); /* 解锁/星级/历史原样保留 */
    }
  }

  for (const name of Object.keys(o.defs)) views[name] = mkView(name);
  return Object.assign({}, views, {migrate, flush, todayStr: ()=>today()});
}

const DailyBudget = {mkDailyBudgets, budgetDateStr, readExtraMs, BUDGET_SAVE_KEY, BUDGET_BACKUP_KEY, PLAY_EXTRA_KEY};
if (typeof module !== 'undefined' && module.exports) module.exports = DailyBudget;
