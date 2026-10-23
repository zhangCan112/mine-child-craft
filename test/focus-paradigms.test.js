'use strict';
/* 专注训练营纯逻辑单测 — node --test (零依赖)
   运行: node --test test/focus-paradigms.test.js
   覆盖: 分发判定(master 先于 dim — 死码 bug 的回归锁) · mkAdapt 阶梯自适应 ·
   通过门槛/三星(含大师考验命中率门槛) · 100 关编排不变量 · master 路径贯通 ·
   F1 关卡曲线渐进无断层族(qualitative 跳变必须混编) · 档位边界 · 掉落表/里程碑
   与物品注册表交叉合法性 · 体检/火苗/鬼等级纯函数边界
   F2 引擎行为驱动缝(loadFocusDrv, 手动时钟+记录桩+LCG): 伪装掷骰/noSet 扩充/
   iconOf 出口 · lenMix/antiChunk/gem · onTrial 事件契约(四引擎+master+不传零影响)
   · flanker len9/中立行/混生物 · switch choices5/bivalent/switchJitter
   加载器: vm context 依次执行 items-core.js + focus-levels.js + focus-paradigms.js,
   镜像浏览器 <script defer> 共享词法环境; DOM/语音/图标以 stub 注入 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fakeEl() {
  const el = {
    children: [], style: {}, dataset: {}, innerHTML: '', textContent: '',
    classList: {add() {}, remove() {}, toggle() {}, contains() {
      return false;
    }},
    appendChild(c) {
      return c;
    }, addEventListener() {}, remove() {},
    querySelector() {
      return fakeEl();
    }, onclick: null,
  };
  return el;
}

function loadFocus() {
  const spoken = [];
  const sandbox = {
    console, Math, JSON, Object, Array,
    performance: {now: () => 0},
    setTimeout: () => 0, clearTimeout: () => {}, // 计时器不触发: 只测同步路径
    document: {createElement: () => fakeEl()},
    /* 依赖注入: 话术已移居 modes/focus.js, 图标在 focus-icons.js — 调用期全局名给桩 */
    SpeechKit: {speak(s) {
      spoken.push(s);
    }, cancel() {}},
    sfx() {},
    praiseLine: () => '(表扬)', comfortLine: () => '(安慰)',
    mcIcon: () => 'data:icon', creeperFace: () => 'data:face',
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['items-core.js', 'focus-levels.js', 'focus-paradigms.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__fp = { focusDispatch, runFocusLevel, mkAdapt, FOCUS_LEVELS, FOCUS_DIMS,
                        focusPassed, focusStars, FOCUS_META, paramsFor,
                        FOCUS_LOOT, FOCUS_MILESTONES, FOCUS_CHECK_PARAMS,
                        focusFlame, devilStep, devilParams,
                        FOCUS_STAMP_DAILY, FOCUS_STAMP_REWARDS,
                        ITEMS, stackMax, isTool };
  `, ctx);
  return {fp: sandbox.__fp, spoken};
}

/* ============ 分发判定(纯函数) ============ */

test('focusDispatch: 第 100 关(master)必须走 master 路径 — dim 分发在后的死码回归锁', () => {
  const {fp} = loadFocus();
  const L99 = fp.FOCUS_LEVELS[99];
  assert.strictEqual(L99.kind, 'master');
  assert.strictEqual(L99.dim, 'switch', '大师关的哨兵 dim 恰是五维最后一个(最容易撞上 switch 分发)');
  assert.strictEqual(fp.focusDispatch(L99).kind, 'master', 'kind=master 优先于 dim 判定');
});

test('focusDispatch: 五维各归各的引擎, 未知维度返回 none', () => {
  const {fp} = loadFocus();
  const d = (dim, kind) => fp.focusDispatch({dim, kind: kind || 'normal'});
  /* 逐字段断言: 对象来自 vm context, deepStrictEqual 会因跨 realm 原型不同而误判 */
  assert.deepStrictEqual({...d('cpt')}, {kind: 'engine', engine: 'discrimination', framing: 'cpt'});
  assert.deepStrictEqual({...d('gonogo')}, {kind: 'engine', engine: 'discrimination', framing: 'gonogo'});
  assert.deepStrictEqual({...d('flanker')}, {kind: 'engine', engine: 'flanker'});
  assert.deepStrictEqual({...d('corsi')}, {kind: 'engine', engine: 'corsi'});
  assert.deepStrictEqual({...d('switch')}, {kind: 'engine', engine: 'switch'});
  assert.strictEqual(d('???').kind, 'none', '未知维度不进任何引擎');
  assert.strictEqual(d('cpt', 'tutorial').engine, 'discrimination', '教学关同引擎(demo 标记在 runFocusLevel 加)');
});

test('runFocusLevel: master 关真进五维连续小节(报幕"新游戏"且可 stop)', () => {
  const {fp, spoken} = loadFocus();
  const h = {progress() {}, showRule() {}, end() {}};
  const ctrl = fp.runFocusLevel(fp.FOCUS_LEVELS[99], fakeEl(), h, 0);
  assert.ok(spoken.some((s) => s.indexOf('新游戏：') >= 0), '第一节开跑即报幕: ' + spoken.join('/'));
  assert.ok(ctrl && typeof ctrl.stop === 'function', '返回可停止的控制柄');
  assert.doesNotThrow(()=> ctrl.stop(), 'stop 幂等安全');
});

/* ============ mkAdapt 阶梯自适应 ============ */

test('mkAdapt: 初始 calib=1, 失败次数放宽 12%/次, 封顶 +40%', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.mkAdapt(0).calib, 1);
  assert.ok(Math.abs(fp.mkAdapt(3).calib - 1.36) < 1e-9);
  assert.ok(Math.abs(fp.mkAdapt(10).calib - 1.4) < 1e-9, '放宽封顶 +40%');
});

test('mkAdapt: 连错 3 次开挫败阀(放宽+计数), 正常无阀', () => {
  const {fp} = loadFocus();
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
  const {fp} = loadFocus();
  const low = fp.mkAdapt(0);
  [false, true, false, true, false, true].forEach((ok) => low.record(ok)); // 50% < 60%, 无三连错
  assert.ok(Math.abs(low.calib - 1.12) < 1e-9, '低成功率放宽: ' + low.calib);
  const high = fp.mkAdapt(0);
  for (let i=0; i<6; i++) high.record(true); // 100% > 90%
  assert.ok(Math.abs(high.calib - 0.94) < 1e-9, '高成功率收紧: ' + high.calib);
  assert.strictEqual(fp.mkAdapt(0).t(1000), 1000, 't() 按当前 calib 缩放(calib=1 原样)');
});

/* ============ 通过门槛 / 三星(focus-levels.js 纯函数) ============ */

test('focusPassed: 正确率 70% 门槛(边界), 警觉/抑制另需命中率 60%', () => {
  const {fp} = loadFocus();
  const cpt = {kind: 'normal', dim: 'cpt'};
  assert.strictEqual(fp.focusPassed(cpt, {acc: 0.69}), false, '69% 不通过');
  assert.strictEqual(fp.focusPassed(cpt, {acc: 0.70, hitRate: 1}), true, '70% 边界通过');
  assert.strictEqual(fp.focusPassed(cpt, {acc: 0.9, hitRate: 0.59}), false, '命中率 59% 拦下(防挂机)');
  assert.strictEqual(fp.focusPassed(cpt, {acc: 0.9, hitRate: 0.60}), true, '命中率 60% 放行');
  assert.strictEqual(fp.focusPassed({kind: 'tutorial'}, {acc: 0}), true, '教学关直过');
});

test('focusPassed: 大师考验聚合的命中率同样受门槛(不再因 dim=switch 豁免)', () => {
  const {fp} = loadFocus();
  const master = {kind: 'master', dim: 'switch'};
  assert.strictEqual(fp.focusPassed(master, {acc: 0.9, hitRate: 0.5}), false, '大师关命中率不足不通过');
  assert.strictEqual(fp.focusPassed(master, {acc: 0.9, hitRate: 0.8}), true);
  assert.strictEqual(fp.focusPassed(master, {acc: 0.9}), true, '未聚合命中率(非警觉小节)不拦');
});

test('focusStars: ⭐通过 ⭐⭐≥85% ⭐⭐⭐≥95% 且无连续 3 错', () => {
  const {fp} = loadFocus();
  const lv = {kind: 'normal', dim: 'flanker'};
  assert.strictEqual(fp.focusStars(lv, {acc: 0.7}), 1);
  assert.strictEqual(fp.focusStars(lv, {acc: 0.85}), 2);
  assert.strictEqual(fp.focusStars(lv, {acc: 0.95, maxStreakErr: 2}), 3);
  assert.strictEqual(fp.focusStars(lv, {acc: 0.95, maxStreakErr: 3}), 2, '连续 3 错摘第三星');
  assert.strictEqual(fp.focusStars({kind: 'tutorial'}, {acc: 1}), 0, '教学关不计星');
});

/* ============ 100 关编排不变量 ============ */

test('FOCUS_LEVELS: 共 100 关, 前 5 关教学(tier1 按五维序), 第 100 关 master 五小节', () => {
  const {fp} = loadFocus();
  const L = fp.FOCUS_LEVELS;
  assert.strictEqual(L.length, 100);
  for (let i=0; i<5; i++) {
    assert.strictEqual(L[i].kind, 'tutorial', '第 ' + (i+1) + ' 关为教学');
    assert.strictEqual(L[i].tier, 1);
    assert.strictEqual(L[i].dim, fp.FOCUS_DIMS[i], '教学关按五维顺序');
  }
  const m = L[99];
  assert.strictEqual(m.kind, 'master');
  assert.strictEqual(m.tier, 19, '难度封顶');
  assert.strictEqual(m.sections.length, 5, '五维连续小节');
  assert.strictEqual(m.sections.length, 5, '五维连续小节');
  assert.strictEqual(m.sections.map((s) => s.dim).join(','), fp.FOCUS_DIMS.join(','), '小节覆盖全部五维');
});

test('FOCUS_LEVELS: 6~99 关五维轮换且 tier 随轮次递进(封顶 19)', () => {
  const {fp} = loadFocus();
  const L = fp.FOCUS_LEVELS;
  for (let i=5; i<99; i++) {
    const k = i - 5;
    assert.strictEqual(L[i].dim, fp.FOCUS_DIMS[k % 5], '第 ' + (i+1) + ' 关轮换维度');
    assert.strictEqual(L[i].tier, Math.min(19, 2 + Math.floor(k/5)), '第 ' + (i+1) + ' 关难度档');
  }
});

/* ============ F2 引擎行为驱动缝(vm 缝扩展) ============
   既有 loadFocus 只测同步路径; F2 的伪装掷骰/长度混编/逐试次事件缝
   都是关内行为, 需要手动时钟驱动整局 + 记录型 stub 观察刺激流:
   · FIFO 定时器队列 — flush 按注册序触发, 链式 after 可续驱动整局到 h.end
   · 元素工厂记录全部创建(els), className/innerHTML/src/classList.add 可回读
   · 确定性 LCG 替身 — 概率行为可断言不抖动(seed 固定则输出恒定) */
function mkFakeElDrv(els, clsLog) {
  const el = {
    children: [], _kids: [], style: {}, dataset: {},
    innerHTML: '', textContent: '', className: '', src: '', _cls: [],
    classList: {
      add(...xs) {
        xs.forEach((c) => clsLog.push({el, cls: c}));
        el._cls.push(...xs);
      },
      remove(...xs) {
        xs.forEach((c) => clsLog.push({el, cls: c, rm: true}));
      },
      toggle() {}, contains() {
        return false;
      },
    },
    appendChild(c) {
      el._kids.push(c);
      return c;
    },
    addEventListener() {}, removeEventListener() {},
    querySelector() {
      return mkFakeElDrv(els, clsLog);
    },
    onclick: null, remove() {},
  };
  els.push(el);
  return el;
}

function loadFocusDrv(opts) {
  opts = opts || {};
  const els = [];
  const timers = [];
  const clsLog = []; // 全局时序 classList 日志(亮灯顺序重建: add('lit') 按 seq 序入账)
  const log = {mc: [], creeper: [], iconOf: [], mobFace: [], sfx: []};
  const spoken = [];
  let seed = opts.seed === undefined ? 12345 : opts.seed;
  const rand = () => { // LCG: 确定性伪随机, 概率断言不抖动
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const sandbox = {
    console, Math: Object.assign(Object.create(Math), {random: rand}), JSON, Object, Array, Set,
    performance: {now: () => 0},
    setTimeout(fn) {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {}, // 测试自行控制取消语义(stop 后链条因 isStopped 断掉)
    document: {createElement: () => mkFakeElDrv(els, clsLog)},
    SpeechKit: {speak(s) {
      spoken.push(s);
    }, cancel() {}},
    sfx() {},
    praiseLine: () => '(表扬)', comfortLine: () => '(安慰)',
    /* 记录型图标桩: 前缀区分出口(mcIcon=训练营自有管线 / iconOf=物品系统) */
    mcIcon(n) {
      log.mc.push(n);
      return 'data:mc:' + n;
    },
    creeperFace(dir) {
      log.creeper.push(dir);
      return 'data:creeper:' + (dir < 0 ? 'L' : 'R');
    },
    iconOf(id) {
      log.iconOf.push(id);
      return (opts.noPix || []).includes(id) ? '' : 'data:icon:' + id;
    },
    Mobs: {face(t) {
      log.mobFace.push(t);
      return 'data:mob:' + t;
    }},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['items-core.js', 'focus-levels.js', 'focus-paradigms.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__fp = {focusDispatch, runFocusLevel, mkAdapt, paramsFor, FOCUS_LEVELS, FOCUS_DIMS};', ctx);
  return {
    fp: sandbox.__fp, spoken, els, log, clsLog,
    flush(max) { // 按注册序触发待决定时器(链式注册随触发入队, 续驱动到局末)
      let n = 0;
      while (timers.length && n < (max || 800)) {
        timers.shift()();
        n++;
      }
      return n;
    },
    step() { // 单步触发一个定时器(步进式驱动: 窗口超时链会把整局跑完, 不可整冲)
      return timers.length ? (timers.shift()(), true) : false;
    },
    pending: () => timers.length,
  };
}

/* 抓取某类名前缀的已创建元素(每次 trial 重建, 按创建序即渲染序) */
function drvEls(d, cls) {
  return d.els.filter((e) => typeof e.className === 'string' && e.className.split(' ').includes(cls));
}

/* ============ F2 判别引擎: 伪装掷骰 + noSet 扩充 + iconOf 出口 ============ */

test('gonogo disguiseRate=0: 整局无伪装(不出现绿宝石), noSet 扩 coal/iron_ore, 刺激走 iconOf', () => {
  const d = loadFocusDrv({seed: 42});
  const ended = [];
  const p = Object.assign(d.fp.paramsFor('gonogo', 7), {trials: 40, demo: false});
  assert.strictEqual(p.disguiseRate, 0, 'tier7 无伪装(tier<8 为 0)');
  const mcBase = d.log.mc.length; // FOCUS_META 构造期已调 mcIcon(卡面图标), 记基线
  d.fp.runFocusLevel({dim: 'gonogo', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  d.flush();
  assert.strictEqual(ended.length, 1, '整局驱动到 h.end');
  const stims = drvEls(d, 'f-stim');
  assert.strictEqual(stims.length, 40, '40 个正式刺激');
  const htmls = stims.map((e) => e.innerHTML);
  for (const h of htmls) {
    assert.ok(!h.includes('emerald'), 'disguiseRate=0 不得出现绿宝石伪装: ' + h);
  }
  /* noSet 扩充: 干扰集 = tnt/coal/iron_ore(40 试次 no-go 保底 8 个, 必见扩充矿) */
  const icons = htmls.map((h) => (h.match(/data:icon:(\w+)/) || [])[1]);
  assert.ok(icons.every((n) => ['diamond', 'tnt', 'coal', 'iron_ore'].includes(n)),
      '正式刺激不越出 go∪noSet: ' + icons.join(','));
  assert.ok(icons.includes('coal') || icons.includes('iron_ore'), 'noSet 扩充的矿确有出现: ' + icons.join(','));
  assert.ok(icons.includes('tnt'), '显性 TNT 仍在 noSet');
  /* iconOf 统一出口: 像素图全部经 iconOf(桩前缀 data:icon:), 运行期零回落 mcIcon */
  assert.strictEqual(d.log.mc.length, mcBase, '刺激渲染不落在训练营自有图标管线');
});

test('gonogo disguiseRate=1: 每个 No-Go 试次都掷中伪装(整局只有钻石+绿宝石)', () => {
  const d = loadFocusDrv({seed: 7});
  const ended = [];
  const p = Object.assign(d.fp.paramsFor('gonogo', 11), {trials: 30, demo: false});
  assert.strictEqual(p.disguiseRate, 1);
  d.fp.runFocusLevel({dim: 'gonogo', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  d.flush();
  assert.strictEqual(ended.length, 1);
  const icons = drvEls(d, 'f-stim').map((e) => (e.innerHTML.match(/data:icon:(\w+)/) || [])[1]);
  assert.ok(icons.length === 30, '30 个正式刺激');
  assert.ok(icons.includes('emerald'), '保底 no-go 掷中伪装出现绿宝石');
  for (const n of icons) {
    assert.ok(['diamond', 'emerald'].includes(n), '全量伪装下显性 TNT 消失: ' + n);
  }
});

test('gonogo 教学演示: 该点的=钻石, 不该点的固定显性 TNT(不被扩充集/伪装骰分心)', () => {
  const d = loadFocusDrv({seed: 99});
  const p = Object.assign(d.fp.paramsFor('gonogo', 8), {trials: 6, demo: true});
  d.fp.runFocusLevel({dim: 'gonogo', kind: 'tutorial', params: p}, fakeEl(),
      {progress() {}, end() {}});
  d.flush();
  const demo = d.els.filter((e) => e.className === 'f-stim hint');
  assert.strictEqual(demo.length, 2, '两个教学演示刺激');
  assert.ok(demo[0].innerHTML.includes('data:icon:diamond'), '演示1=该点的钻石');
  assert.ok(demo[1].innerHTML.includes('data:icon:tnt'), '演示2=不该点的 TNT(不掷伪装骰)');
});

test('cpt 干扰物: stone 之外 coal/iron_ore 走物品像素图, similar 档维持高相似干扰', () => {
  const d = loadFocusDrv({seed: 5});
  const ended = [];
  const p = Object.assign(d.fp.paramsFor('cpt', 5), {trials: 30, similar: false});
  d.fp.runFocusLevel({dim: 'cpt', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  d.flush();
  assert.strictEqual(ended.length, 1);
  const icons = drvEls(d, 'f-stim').map((e) => (e.innerHTML.match(/data:icon:(\w+)/) || [])[1]);
  assert.ok(icons.includes('iron_ore'), 'cpt noSet 扩 iron_ore(像素版口径): ' + icons.join(','));
  const sim = loadFocusDrv({seed: 5});
  const ps = Object.assign(sim.fp.paramsFor('cpt', 10), {trials: 20, similar: true});
  sim.fp.runFocusLevel({dim: 'cpt', kind: 'normal', params: ps}, fakeEl(), {progress() {}, end() {}});
  sim.flush();
  const icons2 = drvEls(sim, 'f-stim').map((e) => (e.innerHTML.match(/data:icon:(\w+)/) || [])[1]);
  assert.ok(icons2.every((n) => ['diamond', 'stone', 'emerald'].includes(n)),
      'similar 档 noSet 仍 stone+emerald: ' + icons2.join(','));
});

test('gonogo 伪装绿宝石: 物品系统未注册时回落训练营自有管线(不空白)', () => {
  const d = loadFocusDrv({seed: 7, noPix: ['emerald']}); // 模拟真实 iconOf: emerald→''
  const p = Object.assign(d.fp.paramsFor('gonogo', 11), {trials: 30, demo: false});
  const mcBase = d.log.mc.length;
  d.fp.runFocusLevel({dim: 'gonogo', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end() {}});
  d.flush();
  const htmls = drvEls(d, 'f-stim').map((e) => e.innerHTML);
  assert.ok(htmls.some((h) => h.includes('data:mc:emerald')), '绿宝石回落 mcIcon 像素画: ' + htmls[0]);
  assert.ok(d.log.mc.length > mcBase, '回落确经 mcIcon 出口');
});

/* ============ F2 Corsi: lenMix 长度混编 / antiChunk 反组块 / gem 宝石轮换 ============ */

/* 驱动一局 corsi: 逐序列 flush 到输入期(hint 文案翻转即输入期开, 消费后清空),
   按亮序全点对(或 clickMode='wrong' 首步点错), 返回每序列 {len, ok} 与终局统计 */
function driveCorsi(d, params, clickMode) {
  const ended = [];
  d.fp.runFocusLevel({dim: 'corsi', kind: 'normal', params}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  const hint = drvEls(d, 'f-corsi-hint')[0];
  const grid = drvEls(d, 'f-corsi-grid')[0];
  const tiles = drvEls(d, 'f-corsi-tile');
  const seqs = [];
  let mark = 0; // clsLog 切分起点(每序列一段)
  for (let guard = 0; guard < 60 && ended.length === 0; guard++) {
    d.flush();
    if (!hint.textContent.includes('按顺序')) break; // 无新输入期 = 局终
    const lit = d.clsLog.slice(mark)
        .filter((r) => !r.rm && r.cls === 'lit').map((r) => r.el);
    hint.textContent = ''; // 消费输入期信号(onclick 会跨序列残留, 不可作判据)
    if (clickMode === 'wrong') {
      tiles.find((t) => t !== lit[0]).onclick(); // 首步点错
      seqs.push({len: lit.length, ok: false});
    } else {
      lit.forEach((t) => t.onclick()); // 全点对
      seqs.push({len: lit.length, ok: true});
    }
    mark = d.clsLog.length; // 点击触发的 light('lit') 属本序列, 一并消费
  }
  d.flush();
  return {seqs, ended, grid, tiles};
}

test('corsi lenMix 过渡档: 同档混出 len 与 len-1 两种长度(台阶变坡道)', () => {
  const d = loadFocusDrv({seed: 11});
  const p = Object.assign(d.fp.paramsFor('corsi', 4), {demo: false});
  assert.strictEqual(p.len, 3);
  assert.strictEqual(p.lenMix, 0.5, 'tier4 是长度跳档的过渡档');
  const {seqs, ended} = driveCorsi(d, p);
  assert.strictEqual(ended.length, 1, '整局驱动到 h.end');
  assert.strictEqual(seqs.length, p.seqs, '全部序列被驱动');
  const lens = [...new Set(seqs.map((s) => s.len))].sort((a, b) => a - b);
  assert.deepStrictEqual(lens, [2, 3], '50% 混编产出两种长度: ' + seqs.map((s) => s.len).join(','));
  assert.strictEqual(ended[0].trials, p.seqs);
});

test('corsi lenMix=0 的档位: 整局恒单一长度(非过渡档不吃混编)', () => {
  const d = loadFocusDrv({seed: 11});
  const p = Object.assign(d.fp.paramsFor('corsi', 6), {demo: false});
  assert.strictEqual(p.lenMix, 0, 'tier6 非过渡档');
  const {seqs, ended} = driveCorsi(d, p);
  assert.strictEqual(ended.length, 1);
  assert.ok(seqs.every((s) => s.len === p.len), '恒为 len=' + p.len + ': ' + seqs.map((s) => s.len).join(','));
});

test('corsi antiChunk: 展示前打乱格位是置换(格位互异不丢格), 序列仍可解', () => {
  const d = loadFocusDrv({seed: 23});
  const p = Object.assign(d.fp.paramsFor('corsi', 19), {antiChunk: 1, demo: false}); // 顶格全打乱
  assert.strictEqual(p.grid, 16);
  const {seqs, ended, grid, tiles} = driveCorsi(d, p);
  assert.strictEqual(ended.length, 1, '整局驱动到 h.end');
  assert.strictEqual(seqs.length, p.seqs);
  /* 仍可解: 按亮序点击全对 — 打乱只动布局不动序列本身 */
  assert.strictEqual(ended[0].correct, p.seqs, '每序列都正确复现(可解性不破)');
  /* 置换不变量: 布局无重复格位(互异)且格子一个不丢 */
  assert.strictEqual(new Set(grid._kids).size, p.grid, '格位互异(无两格同位)');
  assert.ok(tiles.every((t) => grid._kids.includes(t)), '无格子丢失');
  assert.notDeepStrictEqual(grid._kids, tiles, '布局确被重排(非原序)');
});

test('corsi gem 轮换: 亮格宝石像素图走 iconOf 出口, 同局恒一种', () => {
  const d = loadFocusDrv({seed: 3});
  const p = Object.assign(d.fp.paramsFor('corsi', 5, 9), {demo: false}); // li=9 奇数关
  assert.strictEqual(p.gem, 'gold_ingot');
  const {ended} = driveCorsi(d, p);
  assert.strictEqual(ended.length, 1);
  assert.ok(d.log.iconOf.includes('gold_ingot'), '亮格宝石走 iconOf 像素出口');
  assert.ok(d.log.iconOf.every((n) => n === 'gold_ingot'), '同局恒一种宝石(Corsi 构念)');
});

/* ============ F2 逐试次事件缝 onTrial({ok, streak, dim}) ============
   契约(L2): 每正式试次恰一次 · 教学演示不计 · streak=连对数(含本次) ·
   dim 由调度层补注(引擎不知道自己叫什么) · 不传则零影响 */
/* 事件流一致性: streak 语义对任何序列都成立的独立校验(非同义反复) */
function checkTrialEvents(events, dim) {
  let want = 0;
  for (const t of events) {
    assert.strictEqual(t.dim, dim, '调度层补注维度名');
    assert.strictEqual(typeof t.ok, 'boolean');
    want = t.ok ? want + 1 : 0;
    assert.strictEqual(t.streak, want, 'streak=连对数(含本次), 错则归零');
  }
}

test('onTrial gonogo: 每正式试次恰一次, 教学演示不计, 超时试次也报', () => {
  const d = loadFocusDrv({seed: 13});
  const events = [];
  const p = Object.assign(d.fp.paramsFor('gonogo', 8), {trials: 15, demo: true});
  d.fp.runFocusLevel({dim: 'gonogo', kind: 'tutorial', params: p}, fakeEl(),
      {progress() {}, end() {}, onTrial: (t) => events.push(t)});
  d.flush();
  /* 引擎现状预算语义: demo 2 试次计入 trials, 正式 = trials-2 */
  assert.strictEqual(events.length, p.trials - 2, '恰=正式试次数(demo 2 演示不计)');
  checkTrialEvents(events, 'gonogo');
});

test('onTrial flanker: 点对方向 streak 连涨, demo 不计, 超时算错归零', () => {
  const d = loadFocusDrv({seed: 17});
  const events = [];
  /* 现状预算语义: demo 2 计入 trials → trials=10 时正式 8(5 对+1 错+2 超时) */
  const p = Object.assign(d.fp.paramsFor('flanker', 3), {trials: 10, demo: true, len: 3});
  d.fp.runFocusLevel({dim: 'flanker', kind: 'tutorial', params: p}, fakeEl(),
      {progress() {}, end() {}, onTrial: (t) => events.push(t)});
  const btns = drvEls(d, 'f-big-btn');
  /* 步进驱动: processed 计数保证「当前批未点击前不推进」(否则 FIFO 会把
     未点击试次的窗口超时先触发, 整局被超时链跑完) */
  let processed = 0;
  const nextRow = () => {
    let guard = 0;
    while (d.pending() && drvEls(d, 'f-creeper').length < processed + p.len && guard++ < 100) d.step();
    const row = drvEls(d, 'f-creeper').slice(processed, processed + p.len);
    processed += p.len;
    return row;
  };
  const clickRow = (row, wantOk) => {
    const center = row.find((e) => e.className.includes('center'));
    const centerIsL = center.src.endsWith('L');
    const btn = wantOk ? (centerIsL ? btns[0] : btns[1]) : (centerIsL ? btns[1] : btns[0]);
    btn.onclick();
  };
  clickRow(nextRow(), true); // demo×2 点对(不计事件)
  clickRow(nextRow(), true);
  for (let i = 0; i < 5; i++) clickRow(nextRow(), true); // 正式 1~5 全对
  clickRow(nextRow(), false); // 正式 6 点错
  d.flush(); // 正式 7~8: 不点, 窗口超时
  assert.strictEqual(events.length, p.trials - 2);
  checkTrialEvents(events, 'flanker');
  assert.deepStrictEqual(events.slice(0, 5).map((t) => t.ok), [true, true, true, true, true]);
  assert.strictEqual(events[4].streak, 5, '五连对');
  assert.strictEqual(events[5].ok, false, '第 6 试次点错');
  assert.strictEqual(events[5].streak, 0, '连对归零');
  assert.strictEqual(events[6].ok, false, '第 7 试次窗口超时算错');
});

test('onTrial corsi: 每序列恰一次(完成或点错), 教学序列不计', () => {
  const d = loadFocusDrv({seed: 19});
  const events = [];
  const p = Object.assign(d.fp.paramsFor('corsi', 2), {demo: true});
  const ended = [];
  d.fp.runFocusLevel({dim: 'corsi', kind: 'tutorial', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s), onTrial: (t) => events.push(t)});
  const hint = drvEls(d, 'f-corsi-hint')[0];
  const tiles = drvEls(d, 'f-corsi-tile');
  let mark = 0; let seqN = 0;
  for (let guard = 0; guard < 40 && ended.length === 0; guard++) {
    d.flush();
    if (!hint.textContent.includes('按顺序')) break;
    const lit = d.clsLog.slice(mark).filter((r) => !r.rm && r.cls === 'lit').map((r) => r.el);
    hint.textContent = '';
    if (seqN === 1) tiles.find((t) => t !== lit[0]).onclick(); // 第一正式序列点错
    else lit.forEach((t) => t.onclick());
    mark = d.clsLog.length;
    seqN++;
  }
  d.flush();
  assert.strictEqual(seqN, p.seqs, 'demo 1 + 正式 5 全部驱动');
  assert.strictEqual(events.length, p.seqs - 1, '恰=正式序列数(demo 序列不计)');
  checkTrialEvents(events, 'corsi');
  assert.strictEqual(events[0].ok, false, '点错序列报 false');
  assert.strictEqual(events[0].streak, 0);
});

test('onTrial switch: 每试次恰一次, demo 两试次不计; 不传 onTrial 零影响', () => {
  const d = loadFocusDrv({seed: 29});
  const events = [];
  const p = Object.assign(d.fp.paramsFor('switch', 3), {trials: 7, demo: true});
  const ended = [];
  d.fp.runFocusLevel({dim: 'switch', kind: 'tutorial', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s), onTrial: (t) => events.push(t)});
  let mark = 0;
  /* 现状预算语义: demo 2 计入 trials → 正式批 = trials-2 = 5, 总批 = trials */
  for (let i = 0; i < p.trials; i++) { // demo 2 批 + 正式批全点
    d.flush();
    const batch = drvEls(d, 'f-block').slice(mark, mark + p.choices);
    mark += p.choices;
    batch[0].onclick();
  }
  d.flush();
  assert.strictEqual(ended.length, 1);
  assert.strictEqual(events.length, p.trials - 2, '恰=正式试次(demo 2 不计)');
  checkTrialEvents(events, 'switch');
  /* 不传 onTrial: 同参数再跑一局零异常(h 无该键, 引擎不得炸) */
  const d2 = loadFocusDrv({seed: 29});
  const ended2 = [];
  d2.fp.runFocusLevel({dim: 'switch', kind: 'tutorial',
    params: Object.assign(d2.fp.paramsFor('switch', 3), {trials: 7, demo: true})},
  fakeEl(), {progress() {}, end: (s) => ended2.push(s)});
  d2.flush(); // switch 等点击, 未点也须停在等待而非抛错
  assert.ok(Array.isArray(ended2) && ended2.length === 0, '未点完=未终局, 但加载运行零异常');
});

test('onTrial master: 五小节事件全部上报, dim=各小节维度, 总数=聚合试次数', () => {
  const d = loadFocusDrv({seed: 31});
  const events = [];
  const ended = [];
  d.fp.runFocusLevel(d.fp.FOCUS_LEVELS[99], fakeEl(),
      {progress() {}, end: (s) => ended.push(s), onTrial: (t) => events.push(t)});
  let swMark = 0; let corsiMark = 0;
  for (let guard = 0; guard < 400 && ended.length === 0; guard++) {
    d.flush();
    const hint = drvEls(d, 'f-corsi-hint')[0]; // corsi 小节启动后才存在
    if (hint && hint.textContent.includes('按顺序')) { // corsi 小节输入期: 按亮序点
      const lit = d.clsLog.slice(corsiMark)
          .filter((r) => !r.rm && r.cls === 'lit').map((r) => r.el);
      hint.textContent = '';
      lit.forEach((t) => t.onclick());
      corsiMark = d.clsLog.length; // 点击触发的 light 属本序列, 一并消费
      continue;
    }
    const batch = drvEls(d, 'f-block').slice(swMark); // switch 小节待点批
    if (batch.length) {
      swMark += batch.length;
      batch[0].onclick();
    } /* 判别/flanker 小节靠超时链, flush 自推 */
  }
  d.flush();
  assert.strictEqual(ended.length, 1, '大师局驱动到 h.end');
  assert.strictEqual(events.length, ended[0].trials, '上报数=聚合试次数(每试次恰一次)');
  /* 注意: FOCUS_DIMS 来自 vm context, 展开成宿主数组再比(跨 realm 原型坑) */
  const dims = [...new Set(events.map((t) => t.dim))];
  assert.deepStrictEqual(dims, [...d.fp.FOCUS_DIMS], '五维小节各按自己 dim 上报');
  for (const dim of dims) checkTrialEvents(events.filter((t) => t.dim === dim), dim);
});

/* ============ F2 Flanker: len9 小尺寸 / neutralRate 中立行 / mobMix 混生物 ============ */

test('flanker len9: 全行贴图带小尺寸类 f-creeper--sm, len<9 不带', () => {
  const d = loadFocusDrv({seed: 8});
  const p = Object.assign(d.fp.paramsFor('flanker', 18), {trials: 3, demo: false});
  assert.strictEqual(p.len, 9);
  const ended = [];
  d.fp.runFocusLevel({dim: 'flanker', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  d.flush();
  assert.strictEqual(ended.length, 1);
  const imgs = drvEls(d, 'f-creeper');
  assert.strictEqual(imgs.length, 27, '3 试次 × 9 只');
  assert.ok(imgs.every((e) => e.className.includes('f-creeper--sm')), 'len9 全行小尺寸(760px 放得下)');
  const d2 = loadFocusDrv({seed: 8});
  const p2 = Object.assign(d2.fp.paramsFor('flanker', 10), {trials: 2, demo: false});
  assert.strictEqual(p2.len, 5);
  d2.fp.runFocusLevel({dim: 'flanker', kind: 'normal', params: p2}, fakeEl(), {progress() {}, end() {}});
  d2.flush();
  assert.ok(drvEls(d2, 'f-creeper').every((e) => !e.className.includes('f-creeper--sm')), 'len5 常规尺寸');
});

test('flanker neutralRate=1: 两侧全中立生物头像(无方向线索), 中间仍苦力怕; 教学行不掷中立', () => {
  const d = loadFocusDrv({seed: 12, noPix: []});
  const p = Object.assign(d.fp.paramsFor('flanker', 13), {trials: 3, demo: false, neutralRate: 1, mobMix: 0});
  const ended = [];
  d.fp.runFocusLevel({dim: 'flanker', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  d.flush();
  assert.strictEqual(ended.length, 1);
  const rows = [];
  const imgs = drvEls(d, 'f-creeper');
  for (let r = 0; r < imgs.length / p.len; r++) rows.push(imgs.slice(r * p.len, (r + 1) * p.len));
  assert.strictEqual(rows.length, 3);
  for (const row of rows) {
    const flankers = row.filter((e) => !e.className.includes('center'));
    assert.ok(flankers.every((e) => /^data:mob:(pig|sheep)$/.test(e.src)),
        '两侧全中立头像(猪/羊, 经怪物库单一取图出口): ' + flankers.map((e) => e.src).join(','));
    assert.ok(row.find((e) => e.className.includes('center')).src.startsWith('data:creeper:'),
        '中间仍是苦力怕(方向线索唯一来源)');
  }
  /* 教学演示行不被新参数分心: demo 两行全苦力怕 */
  const d2 = loadFocusDrv({seed: 12});
  const p2 = Object.assign(d2.fp.paramsFor('flanker', 13), {trials: 3, demo: true, neutralRate: 1, mobMix: 1});
  d2.fp.runFocusLevel({dim: 'flanker', kind: 'tutorial', params: p2}, fakeEl(), {progress() {}, end() {}});
  const btns = drvEls(d2, 'f-big-btn');
  let processed = 0;
  for (let i = 0; i < 2; i++) { // demo 两行点掉(点击才推进)
    let g = 0;
    while (d2.pending() && drvEls(d2, 'f-creeper').length < processed + p2.len && g++ < 100) d2.step();
    const row = drvEls(d2, 'f-creeper').slice(processed, processed + p2.len);
    processed += p2.len;
    const c = row.find((e) => e.className.includes('center'));
    (c.src.endsWith('L') ? btns[0] : btns[1]).onclick();
  }
  const demoImgs = drvEls(d2, 'f-creeper').slice(0, 2 * p2.len);
  assert.ok(demoImgs.every((e) => e.src.startsWith('data:creeper:')), '教学演示行不掷中立/混生物');
});

test('flanker mobMix=1: 行内恰混入 1~2 只非苦力怕生物(怪物种类), 中间不变', () => {
  const d = loadFocusDrv({seed: 14});
  const p = Object.assign(d.fp.paramsFor('flanker', 15), {trials: 5, demo: false, mobMix: 1, neutralRate: 0});
  const ended = [];
  d.fp.runFocusLevel({dim: 'flanker', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  d.flush();
  assert.strictEqual(ended.length, 1);
  const imgs = drvEls(d, 'f-creeper');
  const rows = [];
  for (let r = 0; r < imgs.length / p.len; r++) rows.push(imgs.slice(r * p.len, (r + 1) * p.len));
  assert.strictEqual(rows.length, 5);
  for (const row of rows) {
    const mixers = row.filter((e) => /^data:mob:(zombie|skeleton|spider|slime)$/.test(e.src));
    assert.ok(mixers.length >= 1 && mixers.length <= 2, '混入 1~2 只: ' + mixers.length);
    assert.ok(!row.find((e) => e.className.includes('center')).src.startsWith('data:mob:'),
        '中间不被换(构念不变: 只看中间)');
    assert.ok(row.some((e) => e.src.startsWith('data:creeper:')), '苦力怕仍在队伍里');
  }
});

/* ============ F2 Switch: choices 5 / bivalent 双价干扰 / switchJitter 切换抖动 ============ */

/* 驱动一局 switch: 每试次 flush 抓待点批(flag 快照)点掉, 返回逐试次记录 */
function driveSwitch(d, params, h, maxTrials) {
  const flag = drvEls(d, 'f-switch-flag')[0];
  let mark = 0;
  const trialsLog = [];
  for (let i = 0; i < maxTrials; i++) {
    d.flush();
    const batch = drvEls(d, 'f-block').slice(mark, mark + params.choices);
    if (!batch.length) break;
    mark += params.choices;
    trialsLog.push({blocks: batch, flag: flag.innerHTML, spokenAt: d.spoken.length});
    batch[0].onclick();
  }
  d.flush();
  return trialsLog;
}
/* 从 flag HTML 提取目标图 src(排除旗杆 flag) */
function flagTargetSrc(html) {
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  return srcs.find((s) => !s.includes(':flag'));
}

test('switch choices: tier10 起每试次 5 块(参数驱动), 干扰项图标不重复', () => {
  const d = loadFocusDrv({seed: 21, noPix: ['wool_red', 'wool_blue', 'wool_yellow']});
  const p = Object.assign(d.fp.paramsFor('switch', 10), {trials: 6, demo: false});
  assert.strictEqual(p.choices, 5);
  const ended = [];
  d.fp.runFocusLevel({dim: 'switch', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  const log = driveSwitch(d, p, {end() {}}, p.trials);
  assert.strictEqual(log.length, p.trials);
  for (const t of log) {
    assert.strictEqual(t.blocks.length, 5, '第 5 选项(tier10 扫视负载)');
    const icons = t.blocks.map((b) => b.innerHTML.match(/src="([^"]+)"/)[1]);
    const tgt = flagTargetSrc(t.flag);
    if (t.flag.includes('tgt-')) continue; // 大小规则的 flag 是 stone 图标, 不按 icon 断言
    assert.ok(icons.includes(tgt), '目标在板上');
    const uniq = new Set(icons.filter((s) => !s.includes(':flag')));
    /* 五件材质族下干扰项各不相同(choices5 不再两两重复); 羊毛三色封顶(二期补画) */
    if (!tgt.includes('wool_')) assert.strictEqual(uniq.size, 5, '材质族干扰不重复: ' + icons.join(','));
  }
});

test('switch bivalent=1: 颜色/材质规则下干扰项与目标同大小(大小线索失效)', () => {
  const d = loadFocusDrv({seed: 33, noPix: ['wool_red', 'wool_blue', 'wool_yellow']});
  const p = Object.assign(d2Params(d), {bivalent: 1});
  const ended = [];
  d.fp.runFocusLevel({dim: 'switch', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  const log = driveSwitch(d, p, {}, p.trials);
  let checked = 0;
  for (const t of log) {
    if (t.flag.includes('tgt-')) continue; // 只看颜色/材质规则(无关维度=大小)
    const tgt = flagTargetSrc(t.flag);
    const correct = t.blocks.find((b) => b.innerHTML.includes(tgt));
    assert.ok(correct, '目标块存在');
    const sizeOf = (b) => (b.className.includes('big') ? 'big' : 'small');
    for (const b of t.blocks) {
      if (b === correct) continue;
      assert.strictEqual(sizeOf(b), sizeOf(correct), '双价干扰与目标同大小: ' + b.className);
    }
    checked++;
  }
  assert.ok(checked >= 3, '至少三试次走了颜色/材质规则');
});

test('switch bivalent=1: 大小规则下干扰项用目标同族图标(材质线索失效)', () => {
  const d = loadFocusDrv({seed: 35, noPix: ['wool_red', 'wool_blue', 'wool_yellow']});
  /* rules=3 + 每试次切换, 保证大小规则必然出场 */
  const p = Object.assign(d.fp.paramsFor('switch', 14), {trials: 14, demo: false, switchEvery: 1, bivalent: 1});
  const ended = [];
  d.fp.runFocusLevel({dim: 'switch', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  const log = driveSwitch(d, p, {}, p.trials);
  let checked = 0;
  for (const t of log) {
    if (!t.flag.includes('tgt-')) continue; // 只看大小规则(无关维度=材质族)
    const icons = t.blocks.map((b) => b.innerHTML.match(/src="([^"]+)"/)[1]);
    assert.strictEqual(new Set(icons).size, 1, '双价干扰与目标同族图标(全板同 icon): ' + icons.join(','));
    const sizes = new Set(t.blocks.map((b) => (b.className.includes('big') ? 'big' : 'small')));
    assert.strictEqual(sizes.size, 2, '大小维度仍可分辨(唯一正确=目标大小)');
    checked++;
  }
  assert.ok(checked >= 2, '大小规则确有出场(每试次切换下)');
});

test('switch bivalent=0: 干扰项大小随机(不总是与目标匹配)', () => {
  const d = loadFocusDrv({seed: 37, noPix: ['wool_red', 'wool_blue', 'wool_yellow']});
  const p = Object.assign(d2Params(d), {bivalent: 0});
  const ended = [];
  d.fp.runFocusLevel({dim: 'switch', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  const log = driveSwitch(d, p, {}, p.trials);
  let mismatched = 0; let checked = 0;
  for (const t of log) {
    if (t.flag.includes('tgt-')) continue;
    const tgt = flagTargetSrc(t.flag);
    const correct = t.blocks.find((b) => b.innerHTML.includes(tgt));
    const sizeOf = (b) => (b.className.includes('big') ? 'big' : 'small');
    if (t.blocks.some((b) => b !== correct && sizeOf(b) !== sizeOf(correct))) mismatched++;
    checked++;
  }
  assert.ok(checked >= 3);
  assert.ok(mismatched >= 1, '无双价时干扰大小不总匹配: ' + mismatched + '/' + checked);
});

test('switch switchJitter=true: 切换间隔随机 1~3(不可预测); false 时围绕 switchEvery', () => {
  const mkCase = (seed, tier, wantLo, wantHi) => {
    const d = loadFocusDrv({seed, noPix: ['wool_red', 'wool_blue', 'wool_yellow']});
    const p = Object.assign(d.fp.paramsFor('switch', tier), {trials: 16, demo: false, switchEvery: 2});
    const ended = [];
    d.fp.runFocusLevel({dim: 'switch', kind: 'normal', params: p}, fakeEl(),
        {progress() {}, end: (s) => ended.push(s)});
    const flag = drvEls(d, 'f-switch-flag')[0];
    let mark = 0;
    const switchAt = [];
    for (let i = 0; i < p.trials; i++) {
      d.flush();
      const batch = drvEls(d, 'f-block').slice(mark, mark + p.choices);
      if (!batch.length) break;
      mark += p.choices;
      const cnt = d.spoken.filter((s) => s.includes('旗子变')).length;
      const seen = switchAt.length ? switchAt[switchAt.length - 1].cnt : 0;
      if (cnt > seen) switchAt.push({trial: i, cnt}); // 口径统一: 只数切换话
      batch[0].onclick();
    }
    d.flush();
    assert.ok(switchAt.length >= 2, '多次切换(种子固定): ' + switchAt.length);
    const gaps = [];
    for (let k = 1; k < switchAt.length; k++) gaps.push(switchAt[k].trial - switchAt[k - 1].trial);
    for (const g of gaps) assert.ok(g >= wantLo && g <= wantHi, '切换间隔试次差 ' + g + ' ∈ [' + wantLo + ',' + wantHi + ']');
    return gaps;
  };
  /* jitter=true(tier≥14): 阈值随机 1~3 → 相邻切换试次差 2~4 */
  const gapsJ = mkCase(41, 14, 2, 4);
  assert.ok(new Set(gapsJ).size >= 2, '间隔确有随机性(不是固定节拍): ' + gapsJ.join(','));
  /* jitter=false 低档对照: 阈值 switchEvery±1 → 试次差 2~3 */
  const gapsS = mkCase(43, 2, 2, 3);
  assert.ok(gapsS.length >= 1);
});

/* 供 bivalent 两例共用的基础参数(低档双规则+多试次) */
function d2Params(d) {
  return Object.assign(d.fp.paramsFor('switch', 2), {trials: 6, demo: false});
}

/* ============ F1 关卡曲线再平衡(设计稿 §2 D1~D5 为数值权威) ============ */

/* 浮点近似比较(曲线端点/档位概率来自设计稿字面值, 容 1e-9 舍入) */
function near(actual, want, msg) {
  assert.ok(Math.abs(actual - want) < 1e-9, (msg || '') + ' 期望 ' + want + ', 实为 ' + actual);
}
/* 某参数在 tier 1..19 上的整条曲线 */
function tierCurve(fp, dim, key) {
  return Array.from({length: 19}, (_, k) => fp.paramsFor(dim, k + 1)[key]);
}

test('paramsFor 渐进无断层: qualitative 概率参数引入档 0<值<1, 单调不降至封顶', () => {
  const {fp} = loadFocus();
  /* "qualitative 跳变必须混编"由此锁死: 新元素以概率 p 渐入, 不许一步全量 */
  const cases = [
    {dim: 'gonogo', key: 'disguiseRate', cap: 1},    // D2: 伪装 tier8 渐入 0.3→顶格 1.0
    {dim: 'flanker', key: 'neutralRate', cap: 0.25}, // D3: 中立行 tier13 引入即顶格
    {dim: 'flanker', key: 'mobMix', cap: 0.3},       // D3: 混生物 tier15 引入即顶格
    {dim: 'corsi', key: 'antiChunk', cap: 0.6},      // D4: 反组块 tier16 起 0.3→0.6
    {dim: 'switch', key: 'bivalent', cap: 1},        // D5: 双价 tier8 起 0.5→顶格 1.0
  ];
  for (const c of cases) {
    const vals = tierCurve(fp, c.dim, c.key);
    const first = vals.findIndex((v) => v > 0);
    assert.ok(first >= 1, c.key + ' 必须在某档引入(非 0 基)');
    for (let t = 0; t < first; t++) assert.strictEqual(vals[t], 0, c.key + ' 引入前(tier ' + (t+1) + ')必须为 0');
    assert.ok(vals[first] > 0 && vals[first] < 1, c.key + ' 引入档(tier ' + (first+1) + ')必须 0<值<1: ' + vals[first]);
    for (let t = first; t < 18; t++) {
      assert.ok(vals[t+1] >= vals[t], c.key + ' 单调不降(tier ' + (t+1) + '→' + (t+2) + '): ' + vals[t] + '→' + vals[t+1]);
    }
    near(vals[18], c.cap, c.key + ' 顶格封顶值');
  }
});

test('paramsFor 渐进无断层: corsi lenMix 过渡档 50%/-1 档 25%/其余 0(长度与 4×4 首见都吃减载)', () => {
  const {fp} = loadFocus();
  /* 期望曲线逐档抄自设计稿 D4: 长度跳档在 tier 4/8/12/16;
     4×4 首见 tier14~15 同时吃 lenMix 减载(D4 grid 行明文) */
  const wantLenMix = [0, 0, 0, 0.5, 0.25, 0, 0, 0.5, 0.25, 0, 0, 0.5, 0.25, 0.5, 0.25, 0.5, 0.25, 0, 0];
  const got = tierCurve(fp, 'corsi', 'lenMix');
  for (let t = 0; t < 19; t++) near(got[t], wantLenMix[t], 'corsi lenMix tier ' + (t+1));
});

test('paramsFor 档位边界: corsi len≤6 封顶, grid 4×4 仅 tier≥14(与 len5 脱钩)', () => {
  const {fp} = loadFocus();
  assert.deepStrictEqual([...tierCurve(fp, 'corsi', 'len')], [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
  assert.strictEqual(fp.paramsFor('corsi', 13).grid, 9, 'tier13 仍 3×3');
  assert.strictEqual(fp.paramsFor('corsi', 14).grid, 16, 'tier14 首见 4×4');
  assert.strictEqual(fp.paramsFor('corsi', 19).grid, 16);
});

test('paramsFor 档位边界: flanker len≤9 且 len9 仅 tier≥18, congruentRate≥0.35, window≥1500', () => {
  const {fp} = loadFocus();
  assert.deepStrictEqual([...tierCurve(fp, 'flanker', 'len')], [3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 7, 7, 7, 7, 7, 7, 9, 9]);
  for (let t = 1; t <= 19; t++) {
    const p = fp.paramsFor('flanker', t);
    assert.ok(p.congruentRate >= 0.35, 'tier ' + t + ' congruentRate 下界 0.35');
    assert.ok(p.window >= 1500, 'tier ' + t + ' window 下界 1500');
  }
  near(fp.paramsFor('flanker', 19).congruentRate, 0.35, '顶格不一致占 65%');
  assert.strictEqual(fp.paramsFor('flanker', 19).window, 1500);
});

test('paramsFor 档位边界: switch rules≤3 封顶, choices∈{4,5} 且 5 选项仅 tier≥10', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.paramsFor('switch', 5).rules, 2);
  assert.strictEqual(fp.paramsFor('switch', 6).rules, 3, '第三规则 tier6 引入');
  assert.strictEqual(fp.paramsFor('switch', 19).rules, 3, '6 岁文献上限, 不加第 4 条');
  assert.strictEqual(fp.paramsFor('switch', 9).choices, 4);
  assert.strictEqual(fp.paramsFor('switch', 10).choices, 5, '第 5 选项 tier10');
  for (let t = 1; t <= 19; t++) {
    assert.ok([4, 5].includes(fp.paramsFor('switch', t).choices), 'tier ' + t + ' choices 只许 4/5');
  }
});

test('paramsFor D1/D2 锚点: cpt 顶格 isi900/dur780/targetRate0.28, gonogo 伪装 0.3/0.6/0.9/1.0', () => {
  const {fp} = loadFocus();
  const top = fp.paramsFor('cpt', 19);
  assert.strictEqual(top.isi, 900, '顶格间隔再紧一档');
  assert.strictEqual(top.dur, 780);
  near(top.targetRate, 0.28, '顶格目标率微降');
  assert.strictEqual(fp.paramsFor('cpt', 9).similar, false);
  assert.strictEqual(fp.paramsFor('cpt', 10).similar, true, '高相似干扰 tier10 起不变');
  assert.strictEqual(fp.paramsFor('gonogo', 7).disguiseRate, 0, 'tier7 无伪装(引入前为 0)');
  near(fp.paramsFor('gonogo', 8).disguiseRate, 0.3, 'tier8 只见 30% 伪装——墙变坡');
  near(fp.paramsFor('gonogo', 9).disguiseRate, 0.6);
  near(fp.paramsFor('gonogo', 10).disguiseRate, 0.9);
  assert.strictEqual(fp.paramsFor('gonogo', 11).disguiseRate, 1, '≥11 全量伪装');
});

test('paramsFor 宝石轮换: corsi 关卡奇偶轮换 diamond/gold_ingot, 未给关卡号默认钻石', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.paramsFor('corsi', 5, 8).gem, 'diamond');
  assert.strictEqual(fp.paramsFor('corsi', 5, 9).gem, 'gold_ingot');
  assert.strictEqual(fp.paramsFor('corsi', 5).gem, 'diamond', '大师小节等无关卡号场景恒钻石');
  for (const lv of fp.FOCUS_LEVELS) {
    if (lv.dim !== 'corsi') continue;
    assert.strictEqual(lv.params.gem, lv.i % 2 === 0 ? 'diamond' : 'gold_ingot', '第 ' + (lv.i+1) + ' 关 corsi 宝石按关卡奇偶落位');
  }
});

test('FOCUS_META: gonogo 规则文案随伪装坡道更新, 各维 tip 全档位有文案且不引用不存在参数', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.FOCUS_META.gonogo.rule, '钻石快挖！别的矿和 TNT 都不要碰。');
  for (const dim of fp.FOCUS_DIMS) {
    for (let tier = 1; tier <= 19; tier++) {
      for (const li of [0, 1, 7, 8]) {
        const s = fp.FOCUS_META[dim].tip(fp.paramsFor(dim, tier, li));
        assert.ok(typeof s === 'string' && s.length > 0, dim + ' tier' + tier + ' tip 有文案');
        assert.ok(!s.includes('undefined') && !s.includes('NaN'), dim + ' tier' + tier + ' tip 疑似引用不存在的参数: ' + s);
      }
    }
  }
});

/* ============ F1 数据表与纯函数(掉落/里程碑/体检/火苗/鬼等级/图章) ============ */

test('FOCUS_LOOT: 五维掉落池与稀有池概率和=1, id 全在 ITEMS 注册且 stackMax>0', () => {
  const {fp} = loadFocus();
  for (const dim of fp.FOCUS_DIMS) {
    const loot = fp.FOCUS_LOOT[dim];
    assert.ok(loot && loot.pool && loot.rare, dim + ' 有掉落池与稀有池');
    for (const name of ['pool', 'rare']) {
      const entries = Object.keys(loot[name]);
      assert.ok(entries.length >= 2, dim + ' ' + name + ' 至少两件');
      let sum = 0;
      for (const id of entries) {
        sum += loot[name][id];
        assert.ok(fp.ITEMS[id], dim + ' ' + name + ' 的 ' + id + ' 必须在 ITEMS 注册');
        assert.ok(fp.stackMax(id) > 0, id + ' 可入包堆叠(stackMax>0)');
      }
      assert.ok(Math.abs(sum - 1) < 1e-9, dim + ' ' + name + ' 概率和=1, 实为 ' + sum);
    }
  }
  /* 锚点(设计稿 §3 L3): 稀有池五维共用 gold_ingot .6/diamond .4; flanker 池为怪物掉落物 */
  near(fp.FOCUS_LOOT.cpt.rare.gold_ingot, 0.6);
  near(fp.FOCUS_LOOT.flanker.rare.diamond, 0.4);
  near(fp.FOCUS_LOOT.flanker.pool.gunpowder, 0.45);
  near(fp.FOCUS_LOOT.corsi.pool.diamond, 0.4);
});

test('FOCUS_MILESTONES: 6 条里程碑(10/30/50/70/90/100)且全为工具(木镐→钻剑长线)', () => {
  const {fp} = loadFocus();
  const keys = Object.keys(fp.FOCUS_MILESTONES).map(Number).sort((a, b) => a - b);
  assert.strictEqual(keys.length, 6);
  assert.strictEqual(keys.join(','), '10,30,50,70,90,100');
  for (const k of keys) {
    assert.strictEqual(fp.isTool(fp.FOCUS_MILESTONES[k]), true, k + ' 关里程碑必须是工具');
  }
  assert.strictEqual(fp.FOCUS_MILESTONES[10], 'pick_wood');
  assert.strictEqual(fp.FOCUS_MILESTONES[50], 'pick_iron');
  assert.strictEqual(fp.FOCUS_MILESTONES[100], 'sword_diamond');
});

test('FOCUS_CHECK_PARAMS: 五维低档短参数, 参数驱动的时长有上界(约 90 秒口径)', () => {
  const {fp} = loadFocus();
  const cs = fp.FOCUS_CHECK_PARAMS;
  assert.strictEqual(cs.length, 5, '五维各一节');
  assert.strictEqual(cs.map((s) => s.dim).join(','), fp.FOCUS_DIMS.join(','), '小节覆盖全部五维');
  let total = 0;
  for (const s of cs) {
    const p = s.params;
    if (p.trials) assert.ok(p.trials <= 6, s.dim + ' 每节约 6 试次');
    if (p.seqs) assert.ok(p.seqs <= 6, 'corsi 序列数 ≤6');
    if (s.dim === 'cpt') total += p.trials * (p.dur + p.isi); // 判别: 呈现+间隔
    if (s.dim === 'gonogo') total += p.trials * (p.dur + 800); // 引擎无 isi 时默认 800
    if (s.dim === 'flanker') total += p.trials * (p.window + 360); // 窗口+反馈帧
    if (s.dim === 'corsi') total += p.seqs * (400 + p.len * p.pace + 200); // 展示期(输入期自步伐, 不由参数决定)
    /* switch 自步伐, 无参数驱动时长 */
  }
  assert.ok(total <= 90000, '参数驱动时长上界 90 秒, 实为 ' + total + 'ms');
  /* 低档锚点(设计稿 B3"各维度取低档短参数") */
  assert.strictEqual(fp.FOCUS_CHECK_PARAMS[2].params.len, 3, 'flanker 低档 3 只');
  assert.strictEqual(fp.FOCUS_CHECK_PARAMS[3].params.grid, 9, 'corsi 低档 3×3');
  assert.strictEqual(fp.FOCUS_CHECK_PARAMS[1].params.disguiseRate, 0, 'gonogo 低档无伪装');
  assert.strictEqual(fp.FOCUS_CHECK_PARAMS[4].params.rules, 2, 'switch 低档双规则');
});

test('focusFlame: 火苗三档 85/70 边界, brighter 只与自己近 7 天均值比且只显变亮', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.focusFlame(0.85).flame, 3, '85% 边界=大火苗');
  assert.strictEqual(fp.focusFlame(0.849).flame, 2);
  assert.strictEqual(fp.focusFlame(0.70).flame, 2, '70% 边界=中火苗');
  assert.strictEqual(fp.focusFlame(0.699).flame, 1, '其余=小火苗');
  assert.strictEqual(fp.focusFlame(0.9).brighter, false, '无近 7 天基线不作对比');
  assert.strictEqual(fp.focusFlame(0.9, 0.8).brighter, true, '超过自己均值→变亮喝彩');
  assert.strictEqual(fp.focusFlame(0.8, 0.8).brighter, false, '持平不变亮');
  assert.strictEqual(fp.focusFlame(0.7, 0.8).brighter, false, '回落不显示(零惩罚口径)');
});

test('devilStep: 鬼等级 85↑/66 保持/65↓ 双阈进退, 等级 1 不下探·10 不上溢', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.devilStep(5, 0.85), 6, '85% 边界升级');
  assert.strictEqual(fp.devilStep(5, 0.849), 5, '未到 85 保持');
  assert.strictEqual(fp.devilStep(5, 0.66), 5, '66% 边界保持');
  assert.strictEqual(fp.devilStep(5, 0.65), 4, '65% 边界降级');
  assert.strictEqual(fp.devilStep(1, 0.1), 1, '等级 1 不下探');
  assert.strictEqual(fp.devilStep(10, 1), 10, '等级 10 不上溢');
});

test('devilParams: 魔鬼特训挑战档=当前档+2, 封顶 19 不上溢', () => {
  const {fp} = loadFocus();
  near(fp.devilParams('gonogo', 7).disguiseRate, 0.6, '7+2=9 档的伪装率');
  assert.strictEqual(fp.devilParams('flanker', 18).len, 9, '18+2 封顶 19→len9');
  assert.strictEqual(fp.devilParams('flanker', 19).len, 9, '19+2 仍封顶 19, 不上溢');
  assert.strictEqual(fp.devilParams('switch', 19).choices, 5, '顶格挑战档五选项');
});

test('图章/集章数据: 大章门槛 3 关, 集章里程碑 3/7/14/30 全有观感奖励', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.FOCUS_STAMP_DAILY.min, 1, '当日 ≥1 关得章');
  assert.strictEqual(fp.FOCUS_STAMP_DAILY.big, 3, '满 3 关(日限 6 的一半)得大章');
  assert.ok(fp.FOCUS_STAMP_DAILY.big <= 6, '大章门槛不超日限');
  for (const k of [3, 7, 14, 30]) {
    assert.ok(typeof fp.FOCUS_STAMP_REWARDS[k] === 'string' && fp.FOCUS_STAMP_REWARDS[k].length > 0, k + ' 章有奖励');
  }
});
