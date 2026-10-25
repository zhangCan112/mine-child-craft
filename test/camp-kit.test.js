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
   与金章阈值); C1-T3 mkParentGate(题面两数∈[5,9]/三键含正解与 ±1..3
   干扰/答对答错接线) · sparkSvg(数值域 max=100↔1 与空态) · mkSettleBits
   (三星 spans 行/armAuto 时长参数化与重挂先清);
   DOM 观感件(fly/addSlot/runRecap/wirePicker/firework/popStars 落点/
   downloadCsv)不直测(仓库惯例),
   行为面由 boot 冒烟 + math-paradigms 流程断言兜底。
   加载器: vm context 执行 rand-core.js + camp-core.js + camp-kit.js,
   时钟(可拨今天的 Date 桩)/定时器/入包/章图标/按钮查询以记录桩注入
   (combat-kit.test.js 同款分层口径) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCampKit() {
  const log = {accrued: [], flushed: 0, cleared: 0, tocleared: 0};
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
  const timeouts = []; /* setTimeout 桩队列(自动续程/逐星 pop 的到点驱动) */
  let qsaImpl = () => []; /* 家长门按钮查询桩(测试里从渲染 html 捞按钮面) */
  const sandbox = {
    console: {warn() {}, log() {}, error() {}},
    Math, JSON, Object, Array, Set, Number, String,
    Date: FixedNowDate,
    stampIcon: (k) => 'data:stamp:' + k,
    setTimeout(fn, ms) {
      timeouts.push({fn, ms});
      return timeouts.length;
    },
    clearTimeout() {
      log.tocleared++;
    },
    document: {
      querySelectorAll: (sel) => qsaImpl(sel),
      querySelector: () => null,
    },
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
  for (const f of ['rand-core.js', 'camp-core.js', 'camp-kit.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__ck = CampKit;', ctx);
  return {
    ck: sandbox.__ck, log, timeouts,
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
    setQSA: (fn) => {
      qsaImpl = fn;
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

test('mkSettleBits: 三星 spans 行; armAuto 时长参数化(缺省 autoMs/逐次覆盖) + 重挂先清', () => {
  const d = loadCampKit();
  const s = d.ck.mkSettleBits({prefix: 'f', autoMs: 4000});
  assert.strictEqual(s.starSpans(2),
      '<span class="st on" data-n="1">⭐</span><span class="st on" data-n="2">⭐</span>' +
      '<span class="st " data-n="3">⭐</span>', 'on 类只到已得星');
  let fired = 0;
  s.armAuto(() => fired++);
  assert.strictEqual(d.timeouts[0].ms, 4000, '缺省 autoMs(focus 家族现状)');
  s.armAuto(() => fired++, 4500); /* focus 里程碑串播复用同一轨道(现状 4500) */
  assert.strictEqual(d.timeouts[1].ms, 4500, 'ms 逐次覆盖');
  assert.strictEqual(d.log.tocleared, 1, '重挂先清旧轨道');
  d.timeouts[1].fn();
  assert.strictEqual(fired, 1, '到点触发回调(按钮在场自检在回调侧, 不在件内)');
  s.clear();
  assert.strictEqual(d.log.tocleared, 2, 'clear 收口');
});

test('sparkSvg: 数值域参数化(focus acc∈0–100 ÷ max=100 ↔ math acc∈0..1 ÷ max=1)与空态文案', () => {
  const d = loadCampKit();
  const noData = '<span class="f-nodata">数据不足</span>';
  const fh = d.ck.sparkSvg([{acc: 50}, {acc: 100}], {cls: 'f-spark', max: 100, noData});
  const svgOk = fh.includes('class="f-spark"') && fh.includes('stroke="#7cfc00"') &&
      fh.includes('stroke-width="2"') && fh.includes('width="120"') && fh.includes('height="36"');
  assert.ok(svgOk, 'W120×H36/#7cfc00/2px 两侧现状同参');
  const mh = d.ck.sparkSvg([{acc: 0.5}, {acc: 1}], {cls: 'm-spark', max: 1, noData: '—'});
  assert.ok(mh.includes('class="m-spark"'));
  assert.ok(fh.includes('19.0') && mh.includes('19.0') && fh.includes('4.0') && mh.includes('4.0'),
      '换算恒等: focus 50/100 与 math 0.5/1 落同一点位');
  assert.strictEqual(d.ck.sparkSvg([{acc: 1}], {max: 1, noData: '—'}), '—', '<2 点空态');
  assert.strictEqual(d.ck.sparkSvg([], {max: 100, noData}), noData);
});

test('mkParentGate: 题面两数∈[5,9] 加法, 三键含正解与 ±1..3 干扰; 答对 onPass/答错 onFail', () => {
  const d = loadCampKit();
  let html = '';
  let passed = 0;
  let failed = 0;
  let btns = [];
  /* screen 缝先渲染, 按钮面从 html 捞出(data-a 值) */
  d.setQSA(() => {
    btns = [...html.matchAll(/data-a="(\d+)"/g)].map((m) => ({dataset: {a: m[1]}}));
    return btns;
  });
  const gate = d.ck.mkParentGate({prefix: 'f', scope: '#focusRoot',
    screen: (h) => {
      html = h;
    }, onPass: () => passed++, onFail: () => failed++});
  gate.open();
  const m = /请回答：(\d+) \+ (\d+) = \?/.exec(html);
  assert.ok(m, '题面渲染');
  const a = +m[1];
  const b = +m[2];
  assert.ok(a >= 5 && a <= 9 && b >= 5 && b <= 9, '两随机数 ∈[5,9]');
  const ans = a + b;
  const vals = btns.map((x) => +x.dataset.a);
  assert.strictEqual(vals.length, 3, '三键');
  assert.ok(vals.includes(ans), '含正解');
  assert.ok(vals.filter((v) => v !== ans).every((v) => Math.abs(v - ans) >= 1 && Math.abs(v - ans) <= 3 && v >= 2),
      '干扰项 ans±1..3 且下限钳 2(与正解恒不撞)');
  assert.ok(html.includes('f-gate-row') && html.includes('家长入口'), '前缀拼门行类名');
  for (const btn of btns) btn.onclick(); /* 点遍三键: 正解恰好 onPass 一次 */
  assert.strictEqual(passed, 1);
  assert.strictEqual(failed, 2);
});
