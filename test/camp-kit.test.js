'use strict';
/* 训练营壳 kit(js/camp-kit.js, CampKit)单测 — node --test(零依赖)
   运行: node --test test/camp-kit.test.js
   覆盖: C1-T1 战利品回路两工厂的非 DOM 契约 — mkCampTicker(每秒一拍
   入账实际毫秒 · 单拍钳制 2s(f3c1fee 修复语义: 后台挂机不灌入每日预算) ·
   缺预算拍不入账也不推 t0 · start 幂等 / stop 复位) · mkLootHud 的
   grantIntoBag(CampCore.grantLoot 入包 + 会话明细累计 + 入包即 save +
   满包节流 onFull 每关至多一次 + 非关卡会话防御)与 recapHtml 前缀契约;
   C1-T2 mkStampRites(kindOf 损坏回落家族缺省章 · awardHtml 喝彩图缝两
   分支与 picker 条件渲染 · calendarHtml 本月网格/今日高亮/badge 角标缝
   与金章阈值);
   DOM 观感件(fly/addSlot/runRecap/wirePicker/firework)不直测(仓库惯例),
   行为面由 boot 冒烟 + math-paradigms 流程断言兜底。
   加载器: vm context 执行 camp-core.js + camp-kit.js, 时钟(可拨今天的
   Date 桩)/定时器/入包/章图标以记录桩注入(combat-kit.test.js 同款分层口径) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCampKit() {
  const log = {accrued: [], flushed: 0, cleared: 0};
  let nowMs = 1000000;
  /* 可拨"今天"的 Date 桩: 无参构造落到受控 nowMs(calendarHtml 的
     new Date()/new Date(y,m,d) 与 ticker 的 Date.now() 同源可控) */
  class FixedNowDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [nowMs]));
    }
  }
  FixedNowDate.now = () => nowMs;
  let tickCb = null;
  let tickMs = 0;
  let addOverflow = 0; /* >0 时 add 返回余量(满包拒收), 0 = 全收 */
  const sandbox = {
    console: {warn() {}, log() {}, error() {}},
    Math, JSON, Object, Array, Set, Number, String,
    Date: FixedNowDate,
    stampIcon: (k) => 'data:stamp:' + k,
    setInterval(fn, ms) {
      tickCb = fn;
      tickMs = ms;
      return 42;
    },
    clearInterval() {
      log.cleared++;
      tickCb = null;
    },
    add: (inv, id, n) => (addOverflow ? (n || 1) : 0),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['camp-core.js', 'camp-kit.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__ck = CampKit;', ctx);
  return {
    ck: sandbox.__ck, log,
    tick: () => tickCb && tickCb(),
    tickMs: () => tickMs,
    armed: () => !!tickCb,
    advance: (ms) => {
      nowMs += ms;
    },
    setNow: (t) => {
      nowMs = t;
    },
    setOverflow: (v) => {
      addOverflow = v;
    },
  };
}

/* 预算记录桩: accrue 逐笔入账(断言钳制后的毫秒数), flush 计数 */
function mkBudget(log) {
  return {
    accrue: (ms) => log.accrued.push(ms),
    flush: () => log.flushed++,
  };
}

test('mkCampTicker: 每秒一拍入账实际毫秒, 单拍钳制 2000ms(f3c1fee 后台挂机防线)', () => {
  const d = loadCampKit();
  const b = mkBudget(d.log);
  const t = d.ck.mkCampTicker({budget: () => b});
  t.start();
  d.advance(1000);
  d.tick();
  assert.deepStrictEqual(d.log.accrued, [1000], '在场 1s 按实际毫秒入账');
  d.advance(40000); /* 后台挂机: 恢复后第一拍的墙钟差是整段挂机时长 */
  d.tick();
  assert.deepStrictEqual(d.log.accrued, [1000, 2000], '只入账钳制上限 2s, 挂机时长不灌爆预算');
  d.advance(500);
  d.tick();
  assert.deepStrictEqual(d.log.accrued, [1000, 2000, 500], '恢复连续在场后按实际毫秒');
  assert.strictEqual(d.log.flushed, 3, '每拍入账即落账');
});

test('mkCampTicker: 缺预算的拍不入账也不推 t0; start 幂等(已走先停), stop 后收口', () => {
  const d = loadCampKit();
  let b = null; /* 预算未建立(Budgets 缺席防御路径) */
  const t = d.ck.mkCampTicker({budget: () => b});
  t.start();
  assert.strictEqual(d.tickMs(), 1000, '每秒一拍');
  d.advance(30000);
  d.tick();
  assert.deepStrictEqual(d.log.accrued, [], '缺预算不入账');
  b = mkBudget(d.log);
  d.advance(1000);
  d.tick(); /* 预算到位: 缺预算期间的墙钟差仍受钳制保护 */
  assert.deepStrictEqual(d.log.accrued, [2000], '缺预算拍未推 t0, 首拍被钳到 2s');
  t.start(); /* 幂等: 重复 start 先停旧轨道 */
  assert.strictEqual(d.log.cleared, 1, '重复 start 先清理旧 interval');
  assert.ok(d.armed(), '新轨道在走');
  t.stop();
  assert.strictEqual(d.log.cleared, 2);
  assert.ok(!d.armed(), 'stop 后无活动轨道');
  d.advance(1000);
  d.tick();
  assert.strictEqual(d.log.accrued.length, 1, 'stop 后不再入账(状态复位)');
});

test('mkLootHud.grantIntoBag: CampCore.grantLoot 入包 + 明细累计 + 入包即 save + 满包节流 onFull', () => {
  const d = loadCampKit();
  let saved = 0;
  const bag = {inv: {slots: []}, save: () => saved++};
  let fulls = 0;
  const hud = d.ck.mkLootHud({prefix: 'f', bag, hud: () => null,
    defaultOrigin: () => ({x: 0, y: 0}), onFull: () => fulls++});
  const r0 = hud.grantIntoBag(['coal']);
  assert.strictEqual(r0.granted.length, 0, '非关卡会话(未 begin)防御: 不入包');
  assert.ok(!r0.full);
  assert.strictEqual(saved, 0, '不入包不 save');
  assert.strictEqual(hud.recapHtml(), '', '无会话零渲染');
  hud.begin();
  const r1 = hud.grantIntoBag(['coal', 'coal', 'torch']);
  assert.deepStrictEqual([...r1.granted], ['coal', 'coal', 'torch']);
  assert.ok(!r1.full);
  assert.strictEqual(saved, 1, '入包成功即 save(ADR 0002, 频率低不批量)');
  assert.ok(hud.recapHtml().includes('"f-loot-recap" id="fLootRecap"'), '前缀拼回顾块 id/类名(f- 契约)');
  d.setOverflow(1); /* 满包: 余量>0 静默忽略并标 full */
  const r2 = hud.grantIntoBag(['diamond']);
  assert.strictEqual(r2.granted.length, 0, '满包余量静默忽略');
  assert.ok(r2.full, '满包标记 full');
  assert.strictEqual(fulls, 1, '满包 onFull 每关至多一次(节流旗自持)');
  hud.grantIntoBag(['diamond']);
  assert.strictEqual(fulls, 1, '同关第二次满包静默');
  hud.begin(); /* 下一关会话开张: 节流旗复位 */
  hud.grantIntoBag(['diamond']);
  assert.strictEqual(fulls, 2, '每关重置后可再提示一次');
});

test('mkStampRites: kindOf 损坏回落家族缺省章; awardHtml 喝彩图缝(focus 包装/math 裸文本)与 picker 条件渲染', () => {
  const d = loadCampKit();
  const base = {prefix: 'f', kinds: ['pick', 'gem', 'tnt'],
    kindNames: {pick: '镐图章', gem: '宝石图章', tnt: '炸药图章'}, kindDefault: 'pick',
    daily: {min: 1, big: 3}, dayKey: () => 'k', count: () => 0,
    rewardFor: () => 'stamp_pattern', rewardText: (rid) => ({stamp_pattern: '自选图章图案'})[rid],
    save: () => {}, root: () => null};
  const focusRites = d.ck.mkStampRites(Object.assign({}, base,
      {awardIcon: () => '<img class="f-award-chief" src="cheer">'}));
  assert.strictEqual(focusRites.kindOf(null), 'pick', '缺省回落家族缺省章');
  assert.strictEqual(focusRites.kindOf({stampKind: 'gem'}), 'gem');
  assert.strictEqual(focusRites.kindOf({stampKind: 'bad'}), 'pick', '白名单外回落');
  const fh = focusRites.awardHtml([30], {stampKind: 'gem'});
  assert.ok(fh.includes('f-award-chief') && fh.includes('f-award-text'), '有喝彩图: 奖励文本包进 award-text(focus 现状)');
  assert.ok(fh.includes('id="fStampPick"') && fh.includes('镐图章'), 'stamp_pattern 线渲染三选一 picker');
  assert.ok(/data-kind="gem" class="on"/.test(fh), '当前章按钮高亮');
  const mathRites = d.ck.mkStampRites(Object.assign({}, base, {prefix: 'm', kinds: ['gem'],
    kindNames: {gem: '宝石图章'}, kindDefault: 'gem',
    rewardFor: () => 'gold_stamp', rewardText: () => '金图章'}));
  const mh = mathRites.awardHtml([60], {});
  assert.ok(!mh.includes('award-chief') && !mh.includes('m-award-text'), '无喝彩图: 裸文本(math 现状)');
  assert.ok(!mh.includes('mStampPick'), '非 stamp_pattern 线无 picker');
  assert.strictEqual(mathRites.awardHtml([], {}), '', '空达成线零渲染');
});

test('mkStampRites.calendarHtml: 本月网格与今日高亮; 魔鬼角标经 badge 缝(缺省零角标); 30 章金章阈值', () => {
  const d = loadCampKit();
  d.setNow(new Date(2026, 2, 15, 12, 0, 0).getTime()); /* "今天"=2026-03-15 本地正午 */
  const dayKey = (t) => {
    const dt = new Date(t);
    return dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate();
  };
  const stamps = {};
  stamps[dayKey(new Date(2026, 2, 15).getTime())] = 2; /* 今天盖普通章 */
  const devilDay = dayKey(new Date(2026, 2, 10).getTime());
  stamps[devilDay] = 1;
  const mk = (badge) => d.ck.mkStampRites({prefix: 'f', kinds: ['pick'], kindNames: {pick: '镐图章'},
    kindDefault: 'pick', daily: {min: 1, big: 3}, dayKey,
    count: (s) => Object.keys(s).length, rewardFor: () => '', rewardText: () => '',
    save: () => {}, root: () => null, badge});
  const html = mk((key, save) => key === devilDay && save.devil ?
      '<img class="f-stamp-devil" src="devil">' : '').calendarHtml({stamps, devil: {days: {}}});
  assert.ok(html.includes('📅 3 月的图章 · 已集 2 枚'), '月名与集章数(计数经注入派生)');
  assert.ok(html.includes('f-stamp-today'), '今日单元格高亮');
  assert.ok(html.includes('f-stamp-devil'), '角标经 badge 缝注入(focus 魔鬼章口径)');
  assert.ok(!html.includes('f-stamp-gold'), '未达 30 章无金章');
  const plain = mk().calendarHtml({stamps}); /* math 侧缺省无 badge */
  assert.ok(!plain.includes('f-stamp-devil'), '缺省零角标(math 现状)');
});
