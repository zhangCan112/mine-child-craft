'use strict';
/* 训练营机制核心单测 — node --test (零依赖)
   运行: node --test test/camp-core.test.js
   覆盖: mkStampBook 八件(record 钳位/同日 max/0负 NaN 不落账/不突变 ·
   trim 窗口 · count 防御 · milestones 表内+递进 · rewardsDue 差集幂等 ·
   rewardFor 递进线回落 gold · rewardClaimed · nextLine 表内/过表) ·
   日期三件套(dayIndex 相邻一天差 1/损坏串 NaN · trimLog 窗口/未来日期
   保留/非法键丢弃/today 非法原样返回/null 入参 → {}) ·
   todayStr 委托桩断言(经全局名调用期解析 budgetDateStr, now 直传与
   缺省 Date.now) · pickWeighted 边界与浮点尾差兜底 ·
   grantLoot 真件语义(空包全 granted/满包 full 标记且 granted 不含
   溢出件/空清单)
   装配: camp-core 经尾部 CommonJS 守卫直连 require — grantLoot 的 add 与
   todayStr 的 budgetDateStr 均经全局名调用期解析; inventory-core 无
   CommonJS 导出, 真件 add 经 vm 缝接入(items-core + inventory-core +
   camp-core 同 context, 相对序同 index.html — math-levels.test.js 既有
   做法; 跨 realm 对象不用 deepStrictEqual 整比, 数组经展开转宿主 realm) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CampCore = require('../js/camp-core.js');

/* 真件 vm 缝: camp-core 与 items/inventory 同 context, grantLoot 调用期
   解析本 context 顶层 add(真背包规则: 并堆/余量返回) */
function loadRealAdd() {
  const sandbox = {console, Math, JSON, Object, Array, Date, Number, Set};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['items-core.js', 'inventory-core.js', 'camp-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__cc = {CampCore, add, count, mkInventory};', ctx);
  return sandbox.__cc;
}

/* 小假表: 表内 3/7/30(30 线给 gold)+ 递进 60/90/…; keepDays 90 同两家族 */
const book = CampCore.mkStampBook({rewards: {3: 'a', 7: 'b', 30: 'gold'}, keepDays: 90, dailyCap: 6});

/* ============ mkStampBook 八件 ============ */

test('mkStampBook.record: 日限钳位与小数取整, 同日取 max 不叠章', () => {
  const r1 = book.record({}, '2026-10-25', 9);
  assert.strictEqual(r1['2026-10-25'], 6, '超日限钳到 6');
  assert.strictEqual(book.record({}, '2026-10-25', 2.6)['2026-10-25'], 3, '小数四舍五入');
  assert.strictEqual(book.record({}, '2026-10-25', 0.4)['2026-10-25'], 1, '不足 1 钳到 1(得章下限)');
  const up = book.record({'2026-10-25': 2}, '2026-10-25', 4);
  assert.strictEqual(up['2026-10-25'], 4, '同日取 max 上升');
  const keep = book.record({'2026-10-25': 4}, '2026-10-25', 2);
  assert.strictEqual(keep['2026-10-25'], 4, '同日回落不降(重玩同日不叠章)');
});

test('mkStampBook.record: 0/负/NaN 关不落账(原样返回), 不突变入参', () => {
  const s0 = {'2026-10-24': 3};
  assert.strictEqual(book.record(s0, '2026-10-25', 0), s0, '0 关原样返回');
  assert.strictEqual(book.record(s0, '2026-10-25', -2), s0, '负关原样返回');
  assert.strictEqual(book.record(s0, '2026-10-25', NaN), s0, 'NaN 关原样返回');
  assert.strictEqual(book.record(s0, '2026-10-25', undefined), s0, 'undefined 原样返回');
  const after = book.record(s0, '2026-10-25', 5);
  assert.deepStrictEqual(s0, {'2026-10-24': 3}, '入参不被突变');
  assert.deepStrictEqual(after, {'2026-10-24': 3, '2026-10-25': 5}, '拷贝落账');
});

test('mkStampBook.trim: 只保留窗口内与未来的键, 非法键丢弃', () => {
  const short = CampCore.mkStampBook({rewards: {3: 'a'}, keepDays: 3, dailyCap: 6});
  const out = short.trim({'2026-10-25': 1, '2026-10-23': 1, '2026-10-22': 1, '2026-11-01': 1, 'oops': 1},
      '2026-10-25');
  assert.deepStrictEqual(Object.keys(out).sort(), ['2026-10-23', '2026-10-25', '2026-11-01'],
      'diff<keepDays 保留(边界 10-22 diff=3 不留), 未来日期保留, 非法键丢弃');
});

test('mkStampBook.count: 有章天数, null/undefined 防御为 0', () => {
  assert.strictEqual(book.count(null), 0, 'null → 0(防御版, 空账本按无章处理)');
  assert.strictEqual(book.count(undefined), 0);
  assert.strictEqual(book.count({}), 0);
  assert.strictEqual(book.count({'2026-10-25': 1, '2026-10-24': 6}), 2, '按天计, 与当日关数无关');
});

test('mkStampBook.milestones: 表内线 filter + 30 步长递进, 升序', () => {
  assert.deepStrictEqual(book.milestones(2), []);
  assert.deepStrictEqual(book.milestones(30), [3, 7, 30]);
  assert.deepStrictEqual(book.milestones(60), [3, 7, 30, 60]);
  assert.deepStrictEqual(book.milestones(90), [3, 7, 30, 60, 90]);
  assert.deepStrictEqual(book.milestones(100), [3, 7, 30, 60, 90], '递进线只到 ≤count 的 30 倍数');
});

test('mkStampBook.rewardsDue: 已越线 − 已领差集, 幂等', () => {
  assert.deepStrictEqual(book.rewardsDue(5, []), [3]);
  assert.deepStrictEqual(book.rewardsDue(5), [3], 'claimed 缺省按空');
  assert.deepStrictEqual(book.rewardsDue(5, [3]), [], '已领不再重发(幂等)');
  assert.deepStrictEqual(book.rewardsDue(61, [3, 7]), [30, 60]);
});

test('mkStampBook.rewardFor: 表内直查, 递进线与表外线回落 30 的 gold', () => {
  assert.strictEqual(book.rewardFor(3), 'a');
  assert.strictEqual(book.rewardFor(7), 'b');
  assert.strictEqual(book.rewardFor(30), 'gold');
  assert.strictEqual(book.rewardFor(60), 'gold', '递进线(60/90/…)沿用 30 的金图章');
  assert.strictEqual(book.rewardFor(90), 'gold');
  assert.strictEqual(book.rewardFor(5), 'gold', '表外线回落 30');
});

test('mkStampBook.rewardClaimed: claimed 线集合按 rewardFor 口径判定', () => {
  assert.strictEqual(book.rewardClaimed([3], 'a'), true);
  assert.strictEqual(book.rewardClaimed([3], 'b'), false);
  assert.strictEqual(book.rewardClaimed([7, 30], 'gold'), true);
  assert.strictEqual(book.rewardClaimed([], 'a'), false);
  assert.strictEqual(book.rewardClaimed(undefined, 'a'), false, 'claimed 缺省按空');
});

test('mkStampBook.nextLine: 表内线优先, 过表后为 30 的倍数', () => {
  assert.strictEqual(book.nextLine(0), 3);
  assert.strictEqual(book.nextLine(2), 3);
  assert.strictEqual(book.nextLine(3), 7);
  assert.strictEqual(book.nextLine(5), 7);
  assert.strictEqual(book.nextLine(10), 30);
  assert.strictEqual(book.nextLine(30), 60, '恰在表末线上 → 下一递进线');
  assert.strictEqual(book.nextLine(31), 60);
  assert.strictEqual(book.nextLine(59), 60);
  assert.strictEqual(book.nextLine(60), 90);
  assert.strictEqual(book.nextLine(90), 120, '过表: ceil((90+1)/30)*30');
});

/* ============ 日期三件套 ============ */

test('dayIndex: 合法串相邻一天差 1(含跨月), 损坏串 NaN', () => {
  assert.strictEqual(CampCore.dayIndex('2026-10-25') - CampCore.dayIndex('2026-10-24'), 1);
  assert.strictEqual(CampCore.dayIndex('2026-10-01') - CampCore.dayIndex('2026-09-30'), 1, '跨月也差 1');
  assert.ok(Number.isNaN(CampCore.dayIndex('2026/10/25')), '分隔符不符 → NaN');
  assert.ok(Number.isNaN(CampCore.dayIndex('oops')));
  assert.ok(Number.isNaN(CampCore.dayIndex('')));
  assert.ok(Number.isNaN(CampCore.dayIndex(undefined)));
});

test('trimLog: 滚动窗口裁剪, 未来日期保留, 非法键丢弃, 不改原', () => {
  const log = {'2026-10-25': 1, '2026-10-24': 2, '2026-10-23': 3, '2026-10-22': 4, '2026-11-01': 5, 'oops': 6};
  const out = CampCore.trimLog(log, '2026-10-25', 3);
  assert.deepStrictEqual(Object.keys(out).sort(), ['2026-10-23', '2026-10-24', '2026-10-25', '2026-11-01'],
      'diff<keepDays 保留, 未来日期(时钟回拨产物)保留, 非法键 NaN 比较为 false 丢弃');
  assert.deepStrictEqual(log, {'2026-10-25': 1, '2026-10-24': 2, '2026-10-23': 3, '2026-10-22': 4,
    '2026-11-01': 5, 'oops': 6}, '入参不被突变');
});

test('trimLog: today 非法原样返回(不清档), null/undefined 入参 → {}', () => {
  const log = {'2026-10-25': 1};
  assert.strictEqual(CampCore.trimLog(log, 'oops', 3), log, 'today 非法原样返回同一对象');
  assert.deepStrictEqual(CampCore.trimLog(null, 'oops', 3), {}, 'today 非法 + null 入参 → {}');
  assert.deepStrictEqual(CampCore.trimLog(null, '2026-10-25', 3), {}, 'null 入参 → 新空对象');
  assert.deepStrictEqual(CampCore.trimLog(undefined, '2026-10-25', 3), {});
});

/* ============ todayStr / pickWeighted ============ */

test('todayStr: 经全局名调用期解析 budgetDateStr, now 直传与缺省 Date.now', () => {
  const seen = [];
  const orig = global.budgetDateStr;
  global.budgetDateStr = (t) => {
    seen.push(t);
    return 'stub:' + t;
  };
  try {
    assert.strictEqual(CampCore.todayStr(12345), 'stub:12345', 'now 直传原样转发');
    const before = Date.now();
    const got = CampCore.todayStr();
    const after = Date.now();
    assert.strictEqual(seen.length, 2);
    assert.ok(seen[1] >= before && seen[1] <= after, '缺省转发当前时间戳');
    assert.strictEqual(got, 'stub:' + seen[1]);
  } finally {
    if (orig === undefined) delete global.budgetDateStr;
    else global.budgetDateStr = orig;
  }
});

test('pickWeighted: r=0 取首键, 累积边界与尾段取后键, 浮点尾差兜底最后一键', () => {
  const pool = {coal: 0.5, iron: 0.3, gold: 0.2};
  assert.strictEqual(CampCore.pickWeighted(pool, 0), 'coal');
  assert.strictEqual(CampCore.pickWeighted(pool, 0.5), 'iron', '恰落累积边界取后键(r < acc 严格小于)');
  assert.strictEqual(CampCore.pickWeighted(pool, 0.79), 'iron');
  assert.strictEqual(CampCore.pickWeighted(pool, 0.99), 'gold');
  assert.strictEqual(CampCore.pickWeighted(pool, 1), 'gold', '骰值浮点尾差越出总概率 → 兜底最后一键');
});

/* ============ grantLoot(真 add) ============ */

test('grantLoot: 空包逐件全 granted, 满包 full 标记且 granted 不含溢出件, 空清单', () => {
  const cc = loadRealAdd();
  const inv = cc.mkInventory();
  const r1 = cc.CampCore.grantLoot(inv, ['coal', 'apple']);
  assert.deepStrictEqual([...r1.granted], ['coal', 'apple'], '空包余量为 0, 全入 granted');
  assert.strictEqual(r1.full, false);
  assert.strictEqual(cc.count(inv, 'coal'), 1);
  assert.strictEqual(cc.count(inv, 'apple'), 1);
  /* 满包: 27 槽全为满堆 coal(64/64), 任何授予都溢出 — 余量>0 静默+full */
  const full = cc.mkInventory();
  full.slots = full.slots.map(() => ({id: 'coal', n: 64}));
  const r2 = cc.CampCore.grantLoot(full, ['coal', 'apple']);
  assert.deepStrictEqual([...r2.granted], [], '溢出件不入 granted 清单');
  assert.strictEqual(r2.full, true);
  /* 半满: 末槽 coal 63/64, 第一件并堆入账, 第二件溢出 */
  const half = cc.mkInventory();
  half.slots = half.slots.map(() => ({id: 'coal', n: 64}));
  half.slots[26] = {id: 'coal', n: 63};
  const r3 = cc.CampCore.grantLoot(half, ['coal', 'coal']);
  assert.deepStrictEqual([...r3.granted], ['coal'], '放得下的件入 granted');
  assert.strictEqual(r3.full, true);
  assert.strictEqual(half.slots[26].n, 64, '末槽并堆到满');
  /* 空清单/缺省: 无授予无 full */
  const r4 = cc.CampCore.grantLoot(cc.mkInventory(), []);
  assert.deepStrictEqual([...r4.granted], []);
  assert.strictEqual(r4.full, false);
  const r5 = cc.CampCore.grantLoot(cc.mkInventory());
  assert.deepStrictEqual([...r5.granted], []);
  assert.strictEqual(r5.full, false);
});
