"use strict";
/* 专注训练营纯逻辑单测 — node --test (零依赖)
   运行: node --test test/focus-paradigms.test.js
   覆盖: 分发判定(master 先于 dim — 死码 bug 的回归锁) · mkAdapt 阶梯自适应 ·
   通过门槛/三星(含大师考验命中率门槛) · 100 关编排不变量 · master 路径贯通
   加载器: vm context 依次执行 focus-levels.js + focus-paradigms.js,
   镜像浏览器 <script defer> 共享词法环境; DOM/语音/图标以 stub 注入 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fakeEl(){
  const el = {
    children: [], style: {}, dataset: {}, innerHTML: '', textContent: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(c){ return c; }, addEventListener(){}, remove(){},
    querySelector(){ return fakeEl(); }, onclick: null,
  };
  return el;
}

function loadFocus(){
  const spoken = [];
  const sandbox = {
    console, Math, JSON, Object, Array,
    performance: { now: () => 0 },
    setTimeout: () => 0, clearTimeout: () => {},   // 计时器不触发: 只测同步路径
    document: { createElement: () => fakeEl() },
    /* 依赖注入: 话术已移居 modes/focus.js, 图标在 focus-icons.js — 调用期全局名给桩 */
    SpeechKit: { speak(s){ spoken.push(s); }, cancel(){} },
    sfx(){},
    praiseLine: () => '(表扬)', comfortLine: () => '(安慰)',
    mcIcon: () => 'data:icon', creeperFace: () => 'data:face',
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for(const f of ['focus-levels.js', 'focus-paradigms.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext(`
    globalThis.__fp = { focusDispatch, runFocusLevel, mkAdapt, FOCUS_LEVELS, FOCUS_DIMS,
                        focusPassed, focusStars, FOCUS_META };
  `, ctx);
  return { fp: sandbox.__fp, spoken };
}

/* ============ 分发判定(纯函数) ============ */

test('focusDispatch: 第 100 关(master)必须走 master 路径 — dim 分发在后的死码回归锁', () => {
  const { fp } = loadFocus();
  const L99 = fp.FOCUS_LEVELS[99];
  assert.strictEqual(L99.kind, 'master');
  assert.strictEqual(L99.dim, 'switch', '大师关的哨兵 dim 恰是五维最后一个(最容易撞上 switch 分发)');
  assert.strictEqual(fp.focusDispatch(L99).kind, 'master', 'kind=master 优先于 dim 判定');
});

test('focusDispatch: 五维各归各的引擎, 未知维度返回 none', () => {
  const { fp } = loadFocus();
  const d = (dim, kind) => fp.focusDispatch({ dim, kind: kind || 'normal' });
  /* 逐字段断言: 对象来自 vm context, deepStrictEqual 会因跨 realm 原型不同而误判 */
  assert.deepStrictEqual({...d('cpt')},      { kind:'engine', engine:'discrimination', framing:'cpt' });
  assert.deepStrictEqual({...d('gonogo')},   { kind:'engine', engine:'discrimination', framing:'gonogo' });
  assert.deepStrictEqual({...d('flanker')},  { kind:'engine', engine:'flanker' });
  assert.deepStrictEqual({...d('corsi')},    { kind:'engine', engine:'corsi' });
  assert.deepStrictEqual({...d('switch')},   { kind:'engine', engine:'switch' });
  assert.strictEqual(d('???').kind, 'none', '未知维度不进任何引擎');
  assert.strictEqual(d('cpt', 'tutorial').engine, 'discrimination', '教学关同引擎(demo 标记在 runFocusLevel 加)');
});

test('runFocusLevel: master 关真进五维连续小节(报幕"新游戏"且可 stop)', () => {
  const { fp, spoken } = loadFocus();
  const h = { progress(){}, showRule(){}, end(){} };
  const ctrl = fp.runFocusLevel(fp.FOCUS_LEVELS[99], fakeEl(), h, 0);
  assert.ok(spoken.some(s => s.indexOf('新游戏：') >= 0), '第一节开跑即报幕: ' + spoken.join('/'));
  assert.ok(ctrl && typeof ctrl.stop === 'function', '返回可停止的控制柄');
  assert.doesNotThrow(()=> ctrl.stop(), 'stop 幂等安全');
});

/* ============ mkAdapt 阶梯自适应 ============ */

test('mkAdapt: 初始 calib=1, 失败次数放宽 12%/次, 封顶 +40%', () => {
  const { fp } = loadFocus();
  assert.strictEqual(fp.mkAdapt(0).calib, 1);
  assert.ok(Math.abs(fp.mkAdapt(3).calib - 1.36) < 1e-9);
  assert.ok(Math.abs(fp.mkAdapt(10).calib - 1.4) < 1e-9, '放宽封顶 +40%');
});

test('mkAdapt: 连错 3 次开挫败阀(放宽+计数), 正常无阀', () => {
  const { fp } = loadFocus();
  const a = fp.mkAdapt(0);
  assert.strictEqual(a.record(false), null, '第 1 错不开阀');
  assert.strictEqual(a.record(false), null, '第 2 错不开阀');
  assert.strictEqual(a.record(false), 'valve', '连错第 3 次开阀');
  assert.strictEqual(a.valveCount, 1);
  assert.ok(Math.abs(a.calib - 1.15) < 1e-9, '开阀即放宽 ×1.15: ' + a.calib);
  assert.strictEqual(a.record(true), null, '答对不开阀');
  assert.strictEqual(a.streak, 0, '开阀后连错计数清零');
});

test('mkAdapt: 近 6 次成功率 <60% 放宽 ×1.12, >90% 收紧 ×0.94(夹取 0.75~1.6)', () => {
  const { fp } = loadFocus();
  const low = fp.mkAdapt(0);
  [false, true, false, true, false, true].forEach(ok => low.record(ok));   // 50% < 60%, 无三连错
  assert.ok(Math.abs(low.calib - 1.12) < 1e-9, '低成功率放宽: ' + low.calib);
  const high = fp.mkAdapt(0);
  for(let i=0; i<6; i++) high.record(true);                               // 100% > 90%
  assert.ok(Math.abs(high.calib - 0.94) < 1e-9, '高成功率收紧: ' + high.calib);
  assert.strictEqual(fp.mkAdapt(0).t(1000), 1000, 't() 按当前 calib 缩放(calib=1 原样)');
});

/* ============ 通过门槛 / 三星(focus-levels.js 纯函数) ============ */

test('focusPassed: 正确率 70% 门槛(边界), 警觉/抑制另需命中率 60%', () => {
  const { fp } = loadFocus();
  const cpt = { kind:'normal', dim:'cpt' };
  assert.strictEqual(fp.focusPassed(cpt, { acc:0.69 }), false, '69% 不通过');
  assert.strictEqual(fp.focusPassed(cpt, { acc:0.70, hitRate:1 }), true, '70% 边界通过');
  assert.strictEqual(fp.focusPassed(cpt, { acc:0.9, hitRate:0.59 }), false, '命中率 59% 拦下(防挂机)');
  assert.strictEqual(fp.focusPassed(cpt, { acc:0.9, hitRate:0.60 }), true, '命中率 60% 放行');
  assert.strictEqual(fp.focusPassed({kind:'tutorial'}, { acc:0 }), true, '教学关直过');
});

test('focusPassed: 大师考验聚合的命中率同样受门槛(不再因 dim=switch 豁免)', () => {
  const { fp } = loadFocus();
  const master = { kind:'master', dim:'switch' };
  assert.strictEqual(fp.focusPassed(master, { acc:0.9, hitRate:0.5 }), false, '大师关命中率不足不通过');
  assert.strictEqual(fp.focusPassed(master, { acc:0.9, hitRate:0.8 }), true);
  assert.strictEqual(fp.focusPassed(master, { acc:0.9 }), true, '未聚合命中率(非警觉小节)不拦');
});

test('focusStars: ⭐通过 ⭐⭐≥85% ⭐⭐⭐≥95% 且无连续 3 错', () => {
  const { fp } = loadFocus();
  const lv = { kind:'normal', dim:'flanker' };
  assert.strictEqual(fp.focusStars(lv, { acc:0.7 }), 1);
  assert.strictEqual(fp.focusStars(lv, { acc:0.85 }), 2);
  assert.strictEqual(fp.focusStars(lv, { acc:0.95, maxStreakErr:2 }), 3);
  assert.strictEqual(fp.focusStars(lv, { acc:0.95, maxStreakErr:3 }), 2, '连续 3 错摘第三星');
  assert.strictEqual(fp.focusStars({kind:'tutorial'}, { acc:1 }), 0, '教学关不计星');
});

/* ============ 100 关编排不变量 ============ */

test('FOCUS_LEVELS: 共 100 关, 前 5 关教学(tier1 按五维序), 第 100 关 master 五小节', () => {
  const { fp } = loadFocus();
  const L = fp.FOCUS_LEVELS;
  assert.strictEqual(L.length, 100);
  for(let i=0; i<5; i++){
    assert.strictEqual(L[i].kind, 'tutorial', '第 ' + (i+1) + ' 关为教学');
    assert.strictEqual(L[i].tier, 1);
    assert.strictEqual(L[i].dim, fp.FOCUS_DIMS[i], '教学关按五维顺序');
  }
  const m = L[99];
  assert.strictEqual(m.kind, 'master');
  assert.strictEqual(m.tier, 19, '难度封顶');
  assert.strictEqual(m.sections.length, 5, '五维连续小节');
  assert.strictEqual(m.sections.length, 5, '五维连续小节');
  assert.strictEqual(m.sections.map(s => s.dim).join(','), fp.FOCUS_DIMS.join(','), '小节覆盖全部五维');
});

test('FOCUS_LEVELS: 6~99 关五维轮换且 tier 随轮次递进(封顶 19)', () => {
  const { fp } = loadFocus();
  const L = fp.FOCUS_LEVELS;
  for(let i=5; i<99; i++){
    const k = i - 5;
    assert.strictEqual(L[i].dim, fp.FOCUS_DIMS[k % 5], '第 ' + (i+1) + ' 关轮换维度');
    assert.strictEqual(L[i].tier, Math.min(19, 2 + Math.floor(k/5)), '第 ' + (i+1) + ' 关难度档');
  }
});
