'use strict';
/* ============================================================
   训练营机制核心 (CampCore, 术语见 GLOSSARY.md「训练营机制核心」) — 应用层纯核心
   ------------------------------------------------------------
   一句话职责: focus/math 两训练营家族逐字镜像机制(图章一本纯函数 +
   日期三件套 + loot 基座)的唯一实现 — 机制单份, 家族函数名
   (stampRecord/mathStampRecord 等)只是各 levels 的薄委托 interface;
   掷骰政策(段位变率 vs 族池)两家族不对称, 留在各自 levels, 不进本核心。
   interface: todayStr(now) → 'Y-M-D'(委托 budgetDateStr) ·
     dayIndex(dateStr) → 本地日序数(损坏串 NaN) ·
     trimLog(log, today, keepDays) → 滚动窗口裁剪(不改原) ·
     pickWeighted(pool, r) → 骰值落累积区间取件 ·
     grantLoot(inv, ids) → {granted, full}(余量>0 静默+full 标记) ·
     mkStampBook({rewards, keepDays, dailyCap}) → 图章一本八件
     {record · trim · count · milestones · rewardsDue · rewardFor ·
      rewardClaimed · nextLine}
   依赖(均经全局名, 调用期解析): budgetDateStr(daily-budget.js)与
     add(inventory-core.js)经全局名调用期解析, 加载序均在 camp-core
     之后亦安全(调用期才解析)
   可测性: 零 THREE · 零 DOM · 有单测 test/camp-core.test.js
   ============================================================ */
const CampCore = (() => {
  /* 今日日期串: 委托 budgetDateStr('Y-M-D' 拼装全库只留那唯一一处),
     now 可注入(毫秒时间戳)供日历单元格与单测复用 */
  function todayStr(now) {
    return budgetDateStr(now === undefined ? Date.now() : now);
  }

  /* 日期串(年-月-日 无前导零, budgetDateStr 同款)→本地日序数:
     滚动窗口与按日轮换的日差全部基于它; 损坏串返回 NaN
     (调用方按"无记录"处理) */
  function dayIndex(dateStr) {
    const m = /^(\d+)-(\d+)-(\d+)$/.exec(String(dateStr));
    if (!m) return NaN;
    const d = new Date(+m[1], +m[2]-1, +m[3]);
    return Math.round((d.getTime() - new Date(1970, 0, 1).getTime())/86400000);
  }

  /* 按日记录滚动裁剪(共享工具, 日志与图章同一实现): 返回只保留最近
     keepDays 天(含今天)的新对象, 不改原; 未来日期(时钟回拨产物)保留 —
     零惩罚哲学不因设备时钟惩罚孩子; 非法键丢弃(防死数据); today 本身
     非法时原样返回(防御: 不清档) */
  function trimLog(log, today, keepDays) {
    const t0 = dayIndex(today);
    if (!Number.isFinite(t0)) return log || {};
    const out = {};
    if (!log) return out;
    for (const k of Object.keys(log)) {
      const diff = t0 - dayIndex(k);
      if (diff < keepDays) out[k] = log[k]; // NaN(非法键)比较为 false 自然丢弃, 未来日期 diff<0 保留
    }
    return out;
  }

  /* 骰值落累积区间取件(池概率和=1 由既有测试锁死); 浮点尾差兜底最后一键 */
  function pickWeighted(pool, r) {
    let acc = 0;
    for (const id of Object.keys(pool)) {
      acc += pool[id];
      if (r < acc) return id;
    }
    return Object.keys(pool).pop();
  }

  /* 战利品入包授予流: 逐件 add 进背包本体, 余量>0 静默忽略(不入 granted
     清单, 无容量预检)并标 full — 每关至多一次「背包满啦」toast 与 save
     时机归模式层 */
  function grantLoot(inv, ids) {
    const granted = []; let full = false;
    for (const id of ids || []) {
      if (add(inv, id, 1) > 0) full = true;
      else granted.push(id);
    }
    return {granted, full};
  }

  /* 递进金图章步长: 两家族同款「30 章起每 30 章递进」(60/90/…由
     milestones 按 STEP 倍数派生, rewardFor 的递进线回落键也是它) */
  const STEP = 30;

  /* 图章一本工厂: 家族差异只注入三参 — rewards 达成线表 · keepDays 滚动
     窗口天数 · dailyCap 日限钳(两家族均按值 6, 各自 levels 头注释登记);
     返回八件, 全部无突变(返回新对象/新数组)。stamps 形状 {日期: 当日关数}
     (键与 budgetDateStr 同款 'Y-M-D' 无前导零) */
  function mkStampBook(cfg) {
    const rewards = cfg.rewards;
    const keepDays = cfg.keepDays;
    const dailyCap = cfg.dailyCap;
    /* 落账: 当日计数钳 1~dailyCap, 当日取 max 不重复累加(重玩同日不
       叠章); 0/负/NaN 关不落账 */
    function record(stamps, day, count) {
      if (!(count > 0)) return stamps;
      const n = Math.max(1, Math.min(dailyCap, Math.round(count)));
      const next = {...stamps};
      next[day] = Math.max(next[day] || 0, n);
      return next;
    }
    /* 裁剪: 只保留今天起 keepDays 天窗口内的键(含今天), 更老与非法键丢弃;
       today 非法时原样返回(防御: 不清档) — 机制与 trimLog 同一实现 */
    function trim(stamps, today) {
      return trimLog(stamps, today, keepDays);
    }
    /* 集章总数 = 有章天数(每天至多 1 章; 普通/大章是同一枚章的两种大小,
       不双计)。防御版 null/undefined 入参返回 0(focus 侧原实现无此防御,
       统一后语义从抛错变为 0 — 空账本按无章处理, 不炸渲染) */
    function count(stamps) {
      return Object.keys(stamps || {}).length;
    }
    /* 达成线: 表内线 filter(count>=k) + STEP*2 起每 STEP 递进
       (60/90/…, 30 已在两家族表内), 升序 */
    function milestones(cnt) {
      const lines = Object.keys(rewards).map(Number).filter((k) => cnt >= k);
      for (let m = STEP * 2; m <= cnt; m += STEP) lines.push(m);
      return lines.sort((a, b) => a - b);
    }
    /* 待领 = 已越线 − 已领(差集): 幂等, 领取方把线记进存档后不再重发 */
    function rewardsDue(cnt, claimed) {
      const got = new Set(claimed || []);
      return milestones(cnt).filter((line) => !got.has(line));
    }
    /* 达成线 → 奖励 id: 递进线(60/90/…)不在表内, 沿用 STEP 的金图章 */
    function rewardFor(line) {
      return rewards[line] || rewards[STEP];
    }
    /* 已领奖励判定: claimed 线集合里是否领过某奖励 id — 持久观感奖励的
       "进场恢复"与"触发迸发"共用同一口径 */
    function rewardClaimed(claimed, rid) {
      return (claimed || []).some((line) => rewardFor(line) === rid);
    }
    /* 下一目标线(结算屏/日历的集章进度口径): 表内线优先, 过表后为
       STEP 的倍数 */
    function nextLine(cnt) {
      for (const k of Object.keys(rewards).map(Number).sort((a, b) => a - b)) {
        if (cnt < k) return k;
      }
      return Math.ceil((cnt + 1) / STEP) * STEP;
    }
    return {record, trim, count, milestones, rewardsDue, rewardFor, rewardClaimed, nextLine};
  }

  return {todayStr, dayIndex, trimLog, pickWeighted, grantLoot, mkStampBook};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CampCore;
