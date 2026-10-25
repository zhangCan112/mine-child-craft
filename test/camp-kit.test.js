'use strict';
/* 训练营壳 kit(js/camp-kit.js, CampKit)单测 — node --test(零依赖)
   运行: node --test test/camp-kit.test.js
   覆盖: C1-T1 战利品回路两工厂的非 DOM 契约 — mkCampTicker(每秒一拍
   入账实际毫秒 · 单拍钳制 2s(f3c1fee 修复语义: 后台挂机不灌入每日预算) ·
   缺预算拍不入账也不推 t0 · start 幂等 / stop 复位) · mkLootHud 的
   grantIntoBag(CampCore.grantLoot 入包 + 会话明细累计 + 入包即 save +
   满包节流 onFull 每关至多一次 + 非关卡会话防御)与 recapHtml 前缀契约;
   DOM 观感件(fly/addSlot/runRecap)不直测(仓库惯例), 行为面由 boot 冒烟 +
   math-paradigms 流程断言兜底。
   加载器: vm context 执行 camp-core.js + camp-kit.js, 时钟/定时器/入包
   以记录桩注入(combat-kit.test.js 同款分层口径) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCampKit() {
  const log = {accrued: [], flushed: 0, cleared: 0};
  let nowMs = 1000000;
  let tickCb = null;
  let tickMs = 0;
  let addOverflow = 0; /* >0 时 add 返回余量(满包拒收), 0 = 全收 */
  const sandbox = {
    console: {warn() {}, log() {}, error() {}},
    Math, JSON, Object, Array, Set, Number, String,
    Date: Object.assign(Object.create(Date), {now: () => nowMs}),
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
