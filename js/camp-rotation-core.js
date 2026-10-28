'use strict';
/* ============================================================
   训练营轮换核心 (CampRotation, 术语见 GLOSSARY.md「训练营轮换」) — 应用层
   ------------------------------------------------------------
   三训练营每日轮换与表现奖励的纯决策: 轮换表按日期天序定"今日营", 表现
   奖励判据(6 关全做完 × 关卡内总用时 ≤8 分钟 × 平均正确率 ≥80%)的纯判定,
   与轮换账本(camp_rotation_save)的无突变状态迁移。何时记账/解锁/卡片显隐
   是政策收在 main.js; 各营模式只在上报当关正确率(noteCampResult)。
   interface: CAMP_ROTATION_ORDER · CAMP_ROTATION_SAVE_KEY · REWARD_MAX_MS ·
     REWARD_MIN_ACC · dateIndex · dailyCamp · rewardChoices · evalReward ·
     freshState · ensureDate · noteAcc · earnReward · chooseBonus ·
     isRewardChoice · accMean · bonusOf
   依赖(均经全局名, 调用期解析): 无 — 零 THREE · 零 DOM · 零全局可变依赖;
     日期串格式沿用 daily-budget.js 的 budgetDateStr('Y-M-D' 无前导零),
     由调用方派生, 本核心只解析。
   可测性声明: 纯核心, Node 直测 (test/camp-rotation-core.test.js)。
   ============================================================ */

/* 轮换顺序: 上线日 2026-10-28=robot — 用户拍板"第一天从机器人开始", 测试钉住 */
const CAMP_ROTATION_ORDER = ['robot', 'focus', 'math'];
const CAMP_ROTATION_SAVE_KEY = 'camp_rotation_save'; /* 轮换账本单键(SyncDB), 加载期经 registerSyncKeys 登记 */
const REWARD_MAX_MS = 8 * 60 * 1000; /* 表现奖励: 当日关卡内总用时上限(边界含) */
const REWARD_MIN_ACC = 80; /* 表现奖励: 当日平均正确率下限(百分比, 边界含) */

if (typeof registerSyncKeys === 'function') {
  registerSyncKeys(CAMP_ROTATION_SAVE_KEY); /* 与 daily-budget 同款: Node 直载时静默跳过 */
}

/* ---------- 轮换: 日期天序 → 今日营 ---------- */

/* 'Y-M-D'(无前导零) → 纪元天数; 损坏串回落 0(robot) — 只会吃到 budgetDateStr 的产物 */
function dateIndex(dateStr) {
  const p = String(dateStr || '').split('-').map(Number);
  if (p.length !== 3 || p.some((x) => !Number.isFinite(x))) return 0;
  return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
}

function dailyCamp(dateStr) {
  const n = CAMP_ROTATION_ORDER.length;
  return CAMP_ROTATION_ORDER[((dateIndex(dateStr) % n) + n) % n];
}

/* 奖励二选一的候选: 除今日营外的两营(保持轮换表序) */
function rewardChoices(dateStr) {
  const daily = dailyCamp(dateStr);
  return CAMP_ROTATION_ORDER.filter((id) => id !== daily);
}

/* ---------- 表现奖励判定: 全做完 × 够快 × 够准(任一不满足即否) ---------- */

function evalReward(input) {
  const o = input || {};
  const fail = [];
  if (!((o.played || 0) >= (o.capCount === undefined ? Infinity : o.capCount))) fail.push('played');
  if (!((o.spentMs || 0) <= REWARD_MAX_MS)) fail.push('time');
  if (!((o.accMean || 0) >= REWARD_MIN_ACC)) fail.push('acc');
  return {pass: fail.length === 0, fail};
}

/* ---------- 账本状态迁移(全部无突变: 拷贝后写, 原状态不动) ----------
   形状 {date:'Y-M-D', reward:bool, bonus:id|null, acc:{<camp>:{n,sum}}} */

function freshState(date) {
  return {date: date, reward: false, bonus: null, acc: {}};
}

/* 午夜翻转: date 不符(含损坏/缺档)即整本重置 — 奖励态与正确率累计都是当日的 */
function ensureDate(state, date) {
  return (state && typeof state === 'object' && state.date === date && state.acc &&
          typeof state.acc === 'object') ? state : freshState(date);
}

/* 结算上报当关正确率(0-100, 越界钳制); 调用方保证在预算 count(1) 之前 */
function noteAcc(state, date, camp, accPct) {
  const s = ensureDate(state, date);
  const cur = s.acc[camp] || {n: 0, sum: 0};
  const pct = Math.max(0, Math.min(100, accPct));
  return Object.assign({}, s, {acc: Object.assign({}, s.acc,
      {[camp]: {n: cur.n + 1, sum: cur.sum + pct}})});
}

function accMean(state, camp) {
  const a = state && state.acc && state.acc[camp];
  return (a && a.n > 0) ? a.sum / a.n : 0;
}

function earnReward(state, date) {
  const s = ensureDate(state, date);
  return s.reward ? s : Object.assign({}, s, {reward: true}); /* 已解锁幂等: 一天至多一次 */
}

function chooseBonus(state, date, camp) {
  const s = ensureDate(state, date);
  if (!s.reward || s.bonus) return s; /* 未解锁/已选定: 幂等 */
  if (CAMP_ROTATION_ORDER.indexOf(camp) < 0 || camp === dailyCamp(date)) return s; /* 非营/今日营不可选 */
  return Object.assign({}, s, {bonus: camp});
}

/* 二选一待选态: 已解锁、未选定、且是候选营之一(主菜单亮 ✨ 徽章的判据) */
function isRewardChoice(state, date, camp) {
  return !!(state && state.reward && !state.bonus && rewardChoices(date).indexOf(camp) >= 0);
}

function bonusOf(state) {
  return (state && state.bonus) || null;
}

const CampRotation = {CAMP_ROTATION_ORDER, CAMP_ROTATION_SAVE_KEY, REWARD_MAX_MS, REWARD_MIN_ACC,
  dateIndex, dailyCamp, rewardChoices, evalReward, freshState, ensureDate,
  noteAcc, accMean, earnReward, chooseBonus, isRewardChoice, bonusOf};
if (typeof module !== 'undefined' && module.exports) module.exports = CampRotation;
