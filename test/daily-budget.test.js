'use strict';
/* 每日预算 (DailyBudget) 单测 — node --test (零依赖)
   运行: node --test test/daily-budget.test.js */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/daily-budget.js');

/* ---- 测试替身: 假钟 + 内存存储 (seam 两侧的第二个 adapter) ---- */
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h || 0, mi || 0, 0).getTime(); // 本地时构造, 免 TZ 抖动
function mkClock(t) {
  return {now: () => t, set(x) {
    t = x;
  }, advance(ms) {
    t += ms;
  }};
}
function mkStorage(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => {
    m.set(k, v);
  }, remove: (k) => {
    m.delete(k);
  }, _m: m};
}
const DEFS = {
  play: {capMsFor: (d) => (d === '2030-5-20' ? 30 * 60000 : 10 * 60000), warnAtMs: 60000}, // 5-20 是临时限额日
  focus: {capMsFor: () => 20 * 60000, capCount: 6},
};
function mkBudgets(clk, storage) {
  return D.mkDailyBudgets({now: clk.now, storage, defs: DEFS});
}
const parse = (s) => JSON.parse(s);

/* ============ 账本 ============ */

test('日期串无前导零, 与历史存档格式一致', () => {
  assert.strictEqual(D.budgetDateStr(at(2030, 5, 9)), '2030-5-9');
  assert.strictEqual(D.budgetDateStr(at(2030, 12, 31)), '2030-12-31');
});

test('计时: accrue 累计, 到量 blocked, remaining 归零', () => {
  const clk = mkClock(at(2030, 5, 19, 10));
  const b = mkBudgets(clk, mkStorage());
  assert.strictEqual(b.play.blocked(), false);
  b.play.accrue(9 * 60000);
  assert.strictEqual(b.play.spentMs(), 9 * 60000);
  assert.strictEqual(b.play.blocked(), false);
  b.play.accrue(60000);
  assert.strictEqual(b.play.blocked(), true);
  assert.strictEqual(b.play.remainingMs(), 0);
});

test('关数上限: focus 到 6 关即 blocked (时长未到)', () => {
  const clk = mkClock(at(2030, 5, 19, 10));
  const b = mkBudgets(clk, mkStorage());
  for (let i = 0; i < 6; i++) b.focus.count(1);
  assert.strictEqual(b.focus.spentCount(), 6);
  assert.strictEqual(b.focus.spentMs(), 0);
  assert.strictEqual(b.focus.blocked(), true);
});

test('午夜翻转: 读写时惰性清账, 不靠定时器', () => {
  const clk = mkClock(at(2030, 5, 19, 23, 59));
  const b = mkBudgets(clk, mkStorage());
  b.play.accrue(9 * 60000);
  b.focus.count(3);
  clk.set(at(2030, 5, 20, 0)); // 跨到 5-20
  assert.strictEqual(b.play.spentMs(), 0);
  assert.strictEqual(b.focus.spentCount(), 0);
  assert.strictEqual(b.play.blocked(), false);
});

test('翻转后按新日期重读限额(临时限额跨午夜生效)', () => {
  const clk = mkClock(at(2030, 5, 19, 23, 59));
  const b = mkBudgets(clk, mkStorage());
  assert.strictEqual(b.play.capMs(), 10 * 60000);
  clk.set(at(2030, 5, 20, 0)); // 5-20 临时 30 分钟
  assert.strictEqual(b.play.capMs(), 30 * 60000);
});

test('onWarn: 进入最后 1 分钟触发一次, 不重复', () => {
  const clk = mkClock(at(2030, 5, 19, 10));
  const b = mkBudgets(clk, mkStorage());
  let n = 0; b.play.onWarn(() => n++);
  b.play.accrue(9 * 60000); // 剩 1 分钟整 → 触发
  assert.strictEqual(n, 1);
  b.play.accrue(20000); // 继续走 → 不再触发
  assert.strictEqual(n, 1);
});

test('onExhausted: 到量触发一次, 当天不重复', () => {
  const clk = mkClock(at(2030, 5, 19, 10));
  const b = mkBudgets(clk, mkStorage());
  let n = 0; b.play.onExhausted(() => n++);
  b.play.accrue(10 * 60000);
  assert.strictEqual(n, 1);
  b.play.accrue(5000); // 已超量再计 → 不再触发
  assert.strictEqual(n, 1);
});

test('flush 落账, 重开页面(新实例)从存储恢复当日账', () => {
  const clk = mkClock(at(2030, 5, 19, 10, 5));
  const st = mkStorage();
  const b1 = mkBudgets(clk, st);
  b1.play.accrue(123000); b1.focus.count(2); b1.focus.accrue(45000);
  b1.flush();
  const b2 = mkBudgets(clk, st); // "重启"
  assert.strictEqual(b2.play.spentMs(), 123000);
  assert.strictEqual(b2.focus.spentCount(), 2);
  assert.strictEqual(b2.focus.spentMs(), 45000);
});

/* ============ dev 预算全开 (config.js DEV → main.js 传 dev:true, docs/dev-mode-design.md D2) ============ */

test('dev: 时限/关数超量恒不 blocked(读侧旁路, 消费方零改动)', () => {
  const clk = mkClock(at(2030, 5, 19, 10));
  const b = D.mkDailyBudgets({dev: true, now: clk.now, storage: mkStorage(), defs: DEFS});
  b.play.accrue(60 * 60000); // 时长超限 6 倍
  for (let i = 0; i < 20; i++) b.focus.count(1); // 关数超限 3 倍多
  assert.strictEqual(b.play.blocked(), false, '时长超量不锁(dev 无限游玩)');
  assert.strictEqual(b.focus.blocked(), false, '关数超量不锁(dev 无限游玩)');
});

test('dev: warn/exhausted 回调不触发(不出"还剩 1 分钟"toast, 不到量踢出)', () => {
  const clk = mkClock(at(2030, 5, 19, 10));
  const b = D.mkDailyBudgets({dev: true, now: clk.now, storage: mkStorage(), defs: DEFS});
  let warns = 0; let exhausted = 0;
  b.play.onWarn(()=>{
    warns++;
  });
  b.play.onExhausted(()=>{
    exhausted++;
  });
  b.play.accrue(10 * 60000); // 恰到量(warnAtMs 窗口与 cap 双双踩中)
  assert.strictEqual(warns, 0, 'dev 下 warn 不触发');
  assert.strictEqual(exhausted, 0, 'dev 下 exhausted 不触发');
});

test('dev: accrue/count 照常记账(图章序号/家长面板数据源不断)', () => {
  const clk = mkClock(at(2030, 5, 19, 10));
  const st = mkStorage();
  const b = D.mkDailyBudgets({dev: true, now: clk.now, storage: st, defs: DEFS});
  b.play.accrue(5 * 60000);
  b.focus.count(1); b.focus.count(1);
  assert.strictEqual(b.play.spentMs(), 5 * 60000, '时长照记');
  assert.strictEqual(b.focus.spentCount(), 2, '关数照记');
  b.flush();
  const again = D.mkDailyBudgets({dev: true, now: clk.now, storage: st, defs: DEFS});
  assert.strictEqual(again.play.spentMs(), 5 * 60000, '落盘恢复照常(与无参数路径同一本账)');
});

/* ============ 家长加时 (play_extra_save, 单设备当日有效) ============ */

test('readExtraMs: 当日加时如实读出(字符串/对象), 过期·损坏·非正数记 0', () => {
  assert.strictEqual(D.readExtraMs(JSON.stringify({date: '2030-5-19', ms: 10*3600000}), '2030-5-19'), 10*3600000);
  assert.strictEqual(D.readExtraMs({date: '2030-5-19', ms: 10*3600000}, '2030-5-19'), 10*3600000); // 容错: 缓存里已是对象
  assert.strictEqual(D.readExtraMs(JSON.stringify({date: '2030-5-18', ms: 10*3600000}), '2030-5-19'), 0); // 昨日加时已失效
  assert.strictEqual(D.readExtraMs('not-json{{{', '2030-5-19'), 0);
  assert.strictEqual(D.readExtraMs(null, '2030-5-19'), 0);
  assert.strictEqual(D.readExtraMs(JSON.stringify({date: '2030-5-19', ms: -1}), '2030-5-19'), 0);
});

test('加时只抬当日 capMs, 跨午夜自动回落默认限额', () => {
  const clk = mkClock(at(2030, 5, 19, 23, 59));
  const st = mkStorage({play_extra_save: JSON.stringify({date: '2030-5-19', ms: 10*3600000})});
  const b = D.mkDailyBudgets({now: clk.now, storage: st, defs: {
    play: {capMsFor: (d) => 10*60000 + D.readExtraMs(st.get('play_extra_save'), d)}, // 与 main.js setupBudgets 同款接线
  }});
  assert.strictEqual(b.play.capMs(), 10*60000 + 10*3600000); // 当日: 默认 10 分钟 + 加时 10 小时
  assert.strictEqual(b.play.blocked(), false);
  clk.set(at(2030, 5, 20, 0));
  assert.strictEqual(b.play.capMs(), 10*60000); // 次日: 加时失效, 回落默认
});

/* ============ 迁移 (用户进度零丢失) ============ */

test('迁移-当日: 旧机制A/B 的当日账搬入新 key, 旧 key 退役, focus 存档仅摘除 daily', () => {
  const clk = mkClock(at(2030, 5, 19, 15));
  const st = mkStorage({
    play_time_save: JSON.stringify({date: '2030-5-19', ms: 82489}),
    focus_camp_save: JSON.stringify({unlocked: 7, stars: {'0': 2, '1': 3},
      daily: {date: '2030-5-19', played: 2, ms: 300000}, history: [{d: '2030-5-19', i: 0}]}),
  });
  mkBudgets(clk, st).migrate();

  const bud = parse(st.get('daily_budget_save'));
  assert.strictEqual(bud.date, '2030-5-19');
  assert.strictEqual(bud.budgets.play.ms, 82489);
  assert.strictEqual(bud.budgets.focus.ms, 300000);
  assert.strictEqual(bud.budgets.focus.played, 2);

  assert.strictEqual(st.get('play_time_save'), null); // 旧 key 已退役
  const fc = parse(st.get('focus_camp_save'));
  assert.strictEqual(fc.unlocked, 7); // 其余进度原样保留
  assert.deepStrictEqual(fc.stars, {'0': 2, '1': 3});
  assert.strictEqual(fc.history.length, 1);
  assert.strictEqual(fc.daily, undefined); // daily 已摘除

  const bak = parse(st.get('daily_budget_migrate_backup')); // 备份先于删除
  assert.ok(bak.play_time_save.includes('82489'));
});

test('迁移-非当日: 旧账次日本来失效, 记零且照样退役', () => {
  const clk = mkClock(at(2030, 5, 19, 15));
  const st = mkStorage({
    play_time_save: JSON.stringify({date: '2030-5-18', ms: 500000}),
    focus_camp_save: JSON.stringify({unlocked: 3, stars: {},
      daily: {date: '2030-5-18', played: 6, ms: 1200000}, history: []}),
  });
  mkBudgets(clk, st).migrate();
  const bud = parse(st.get('daily_budget_save'));
  assert.strictEqual(bud.budgets.play.ms, 0);
  assert.strictEqual(bud.budgets.focus.played, 0);
  assert.strictEqual(st.get('play_time_save'), null);
  assert.strictEqual(parse(st.get('focus_camp_save')).unlocked, 3);
});

test('迁移-损坏旧值: 跳过该来源, 旧 key 原样保留, 不抛错', () => {
  const clk = mkClock(at(2030, 5, 19, 15));
  const st = mkStorage({
    play_time_save: 'not-json{{{',
    focus_camp_save: JSON.stringify({unlocked: 1, stars: {},
      daily: {date: '2030-5-19', played: 1, ms: 60000}, history: []}),
  });
  mkBudgets(clk, st).migrate();
  assert.strictEqual(st.get('play_time_save'), 'not-json{{{'); // 读不懂 → 不删
  assert.ok(parse(st.get('daily_budget_save')).budgets.focus); // focus 侧正常搬入
});

test('迁移-幂等: 二次运行不改变新 key, 备份不二次覆盖', () => {
  const clk = mkClock(at(2030, 5, 19, 15));
  const st = mkStorage({
    play_time_save: JSON.stringify({date: '2030-5-19', ms: 1000}),
    focus_camp_save: JSON.stringify({unlocked: 0, stars: {},
      daily: {date: '2030-5-19', played: 0, ms: 0}, history: []}),
  });
  mkBudgets(clk, st).migrate();
  const first = st.get('daily_budget_save');
  st.set('daily_budget_migrate_backup', 'TAMPERED');
  mkBudgets(clk, st).migrate(); // 再跑一次
  assert.strictEqual(st.get('daily_budget_save'), first);
  assert.strictEqual(st.get('daily_budget_migrate_backup'), 'TAMPERED'); // 备份只写一次
});

test('迁移-断点续跑: 新 key 已在而旧 key 残留 → 只退役旧 key, 不动账本', () => {
  const clk = mkClock(at(2030, 5, 19, 15));
  const st = mkStorage({
    daily_budget_save: JSON.stringify({date: '2030-5-19',
      budgets: {play: {ms: 42, played: 0}, focus: {ms: 7, played: 1}}}),
    play_time_save: JSON.stringify({date: '2030-5-19', ms: 999999}), // 旧页面回写的复活值 → 不进账本
    focus_camp_save: JSON.stringify({unlocked: 5, stars: {},
      daily: {date: '2030-5-19', played: 9, ms: 9}, history: []}),
  });
  mkBudgets(clk, st).migrate();
  const bud = parse(st.get('daily_budget_save'));
  assert.strictEqual(bud.budgets.play.ms, 42); // 账本未被旧值污染
  assert.strictEqual(st.get('play_time_save'), null);
  assert.strictEqual(parse(st.get('focus_camp_save')).unlocked, 5);
});

/* ============ 真实用户数据夹具 (data/ 两台设备的实际 blob, 脱敏拷贝) ============ */

for (const f of ['progress-device-a.json', 'progress-device-b.json']) {
  test(`真实夹具 ${f}: 迁移零丢失`, () => {
    const blob = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));
    const origPlay = parse(blob.play_time_save);
    const origFocus = parse(blob.focus_camp_save);

    /* 场景1: 夹具日期已过期(真实情况) → 记零退役 */
    const clk = mkClock(at(2030, 5, 19, 9));
    const st = mkStorage(blob);
    mkBudgets(clk, st).migrate();
    assert.strictEqual(st.get('play_time_save'), null);
    const bud = parse(st.get('daily_budget_save'));
    assert.strictEqual(bud.budgets.play.ms, 0);
    const fc = parse(st.get('focus_camp_save'));
    assert.strictEqual(fc.unlocked, origFocus.unlocked);
    assert.deepStrictEqual(fc.stars, origFocus.stars || {});
    assert.strictEqual(fc.history.length, (origFocus.history || []).length);
    assert.strictEqual(fc.daily, undefined);

    /* 场景2: 同一份真实数据改写为"当天" → 毫秒/关数如实搬入 */
    const st2 = mkStorage(blob);
    const play2 = Object.assign({}, origPlay, {date: '2030-5-19'});
    const focus2 = JSON.parse(JSON.stringify(origFocus));
    focus2.daily.date = '2030-5-19';
    st2.set('play_time_save', JSON.stringify(play2));
    st2.set('focus_camp_save', JSON.stringify(focus2));
    mkBudgets(clk, st2).migrate();
    const bud2 = parse(st2.get('daily_budget_save'));
    assert.strictEqual(bud2.budgets.play.ms, origPlay.ms || 0);
    assert.strictEqual(bud2.budgets.focus.ms, (focus2.daily && origFocus.daily.ms) || 0);
    assert.strictEqual(bud2.budgets.focus.played, (focus2.daily && origFocus.daily.played) || 0);
  });
}
