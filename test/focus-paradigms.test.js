'use strict';
/* 专注训练营纯逻辑单测 — node --test (零依赖)
   运行: node --test test/focus-paradigms.test.js
   覆盖: 分发判定(master 先于 dim — 死码 bug 的回归锁) · mkAdapt 阶梯自适应 ·
   通过门槛/三星(含大师考验命中率门槛) · 100 关编排不变量 · master 路径贯通 ·
   F1 关卡曲线渐进无断层族(qualitative 跳变必须混编) · 档位边界 · 掉落表/里程碑
   与物品注册表交叉合法性 · 体检/火苗/鬼等级纯函数边界 ·
   里程碑补授差集/幂等/进度口径(F6, 设计稿 §3 L4 / spec 实现决策 9·17)
   F2 引擎行为驱动缝(loadFocusDrv, 手动时钟+记录桩+LCG): 伪装掷骰/noSet 扩充/
   iconOf 出口 · lenMix/antiChunk/gem · onTrial 事件契约(四引擎+master+不传零影响)
   · flanker len9/中立行/混生物 · switch choices5/bivalent/switchJitter
   F5 矿袋战利品政策(设计稿 §3 L3): rollFocusLoot 概率边界(种子锁定)/保底
   触发/教学豁免 · levelBonusLoot 通关二选一+三星钻石 · grantFocusLoot 满包
   余量语义(inventory-core 一并入 vm 缝, 相对序同 index.html)
   加载器: vm context 依次执行 items-core.js + inventory-core.js +
   focus-levels.js + focus-paradigms.js, 镜像浏览器 <script defer> 共享词法
   环境(相对序同 index.html); DOM/语音/图标以 stub 注入 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

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
    console, Math, JSON, Object, Array, Date, Number,
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
  /* inventory-core(F5 授予流语义)排在 focus-levels 之前 — 与 index.html 相对序一致 */
  for (const f of ['items-core.js', 'inventory-core.js', 'focus-levels.js', 'focus-paradigms.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__fp = { focusDispatch, runFocusLevel, mkAdapt, FOCUS_LEVELS, FOCUS_DIMS,
                        focusPassed, focusStars, FOCUS_META, paramsFor,
                        FOCUS_LOOT, FOCUS_CHECK_PARAMS,
                        focusFlame, devilStep, devilParams,
                        FOCUS_STAMP_DAILY, FOCUS_STAMP_REWARDS,
                        focusDayIndex, trimFocusLog, FOCUS_LOG_KEEP_DAYS,
                        devilDimFor, focusCheckEntry, checkBaseline,
                        devilEntry, devilTierFor, FOCUS_DEVIL_TIME_MS,
                        stampRecord, stampTrim, stampCount,
                        stampMilestones, stampRewardsDue, stampRewardFor,
                        FOCUS_MILESTONES, milestoneDue, focusProgress,
                        rollFocusLoot, levelBonusLoot, grantFocusLoot,
                        add, count, mkInventory, INV_SLOTS,
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
  const log = {mc: [], creeper: [], iconOf: [], mobFace: [], pigFace: [], sheepFace: [], sfx: []};
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
    /* F4b 中立头像桩: mobFace 对 pig/sheep 路由到训练营像素库(非怪物库) */
    pigFace() {
      log.pigFace.push(1);
      return 'data:pig';
    },
    sheepFace() {
      log.sheepFace.push(1);
      return 'data:sheep';
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
  vm.runInContext('globalThis.__fp = {focusDispatch, runFocusLevel, mkAdapt, paramsFor, ' +
      'FOCUS_LEVELS, FOCUS_DIMS};', ctx);
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

test('flanker len9: 全行贴图带小尺寸类 f-creeper-sm, len<9 不带', () => {
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
  assert.ok(imgs.every((e) => e.className.includes('f-creeper-sm')), 'len9 全行小尺寸(760px 放得下)');
  const d2 = loadFocusDrv({seed: 8});
  const p2 = Object.assign(d2.fp.paramsFor('flanker', 10), {trials: 2, demo: false});
  assert.strictEqual(p2.len, 5);
  d2.fp.runFocusLevel({dim: 'flanker', kind: 'normal', params: p2}, fakeEl(), {progress() {}, end() {}});
  d2.flush();
  assert.ok(drvEls(d2, 'f-creeper').every((e) => !e.className.includes('f-creeper-sm')), 'len5 常规尺寸');
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
    assert.ok(flankers.every((e) => /^data:(pig|sheep)$/.test(e.src)),
        '两侧全中立头像(猪/羊, 经 mobFace 路由到训练营像素库 pigFace/sheepFace): ' + flankers.map((e) => e.src).join(','));
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
    {dim: 'gonogo', key: 'disguiseRate', cap: 1}, // D2: 伪装 tier8 渐入 0.3→顶格 1.0
    {dim: 'flanker', key: 'neutralRate', cap: 0.25}, // D3: 中立行 tier13 引入即顶格
    {dim: 'flanker', key: 'mobMix', cap: 0.3}, // D3: 混生物 tier15 引入即顶格
    {dim: 'corsi', key: 'antiChunk', cap: 0.6}, // D4: 反组块 tier16 起 0.3→0.6
    {dim: 'switch', key: 'bivalent', cap: 1}, // D5: 双价 tier8 起 0.5→顶格 1.0
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
  assert.deepStrictEqual([...tierCurve(fp, 'flanker', 'len')],
      [3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 7, 7, 7, 7, 7, 7, 9, 9]);
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
    assert.strictEqual(lv.params.gem, lv.i % 2 === 0 ? 'diamond' : 'gold_ingot',
        '第 ' + (lv.i + 1) + ' 关 corsi 宝石按关卡奇偶落位');
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

/* ============ F8 每日体检 + 魔鬼特训(设计稿 §8 B3/B8) ============ */

test('focusDayIndex: 日期串→本地日序数, 跨月/跨年连续, 损坏串 NaN', () => {
  const {fp} = loadFocus();
  const dayIdx = fp.focusDayIndex;
  assert.strictEqual(dayIdx('2026-10-23') - dayIdx('2026-10-22'), 1, '相邻一天差 1');
  assert.strictEqual(dayIdx('2026-10-1') - dayIdx('2026-9-30'), 1, '跨月连续(无前导零格式)');
  assert.strictEqual(dayIdx('2027-1-1') - dayIdx('2026-12-31'), 1, '跨年连续');
  assert.strictEqual(dayIdx('2026-12-31') - dayIdx('2026-1-1'), 364, '2026 平年 364 天');
  assert.ok(Number.isNaN(dayIdx('不是个日期')), '损坏串返回 NaN');
  assert.ok(Number.isNaN(dayIdx(undefined)), 'undefined 返回 NaN');
});

test('trimFocusLog: 按日记录滚动 90 天裁剪(含今天), 返回新对象不改原', () => {
  const {fp} = loadFocus();
  const today = '2026-10-23';
  const log = {
    '2026-10-23': {v: 1}, // 今天 diff=0, 保留
    '2026-7-26': {v: 1}, // diff=89, 90 天窗口边界, 保留
    '2026-7-25': {v: 1}, // diff=90, 出窗, 剔除
    '2026-10-24': {v: 1}, // 未来日期(时钟回拨产物), 保留(零惩罚)
  };
  const out = fp.trimFocusLog(log, today, 90);
  assert.ok(hasOwn(out, '2026-10-23') && hasOwn(out, '2026-7-26') && hasOwn(out, '2026-10-24'), '窗口内与未来日期保留');
  assert.ok(!hasOwn(out, '2026-7-25'), '90 天前的记录剔除');
  assert.notStrictEqual(out, log, '返回新对象(纯函数不改原)');
  assert.ok(hasOwn(log, '2026-7-25'), '原始对象原样保留');
  assert.strictEqual(Object.keys(fp.trimFocusLog(null, today, 90)).length, 0, '空记录返回空对象');
});

test('滚动保留天数常量: 90 天(存档防膨胀口径)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.FOCUS_LOG_KEEP_DAYS, 90);
});

test('devilDimFor: 日期字符串哈希轮换五维, 纯函数稳定且五维都有轮到', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.devilDimFor('2026-10-23'), fp.devilDimFor('2026-10-23'), '同一天恒定同维度');
  assert.ok(fp.FOCUS_DIMS.includes(fp.devilDimFor('2026-10-23')), '返回值必在五维内');
  /* 连续 40 天的轮换分布: 五维都被轮到(哈希均匀性抽查) */
  const seen = new Set();
  for (let k = 0; k < 40; k++) seen.add(fp.devilDimFor('2026-9-' + (1 + k)));
  assert.strictEqual(seen.size, 5, '40 天窗口五维都有轮到: ' + [...seen].join(','));
});

test('focusCheckEntry: 当日未做过才显示入口(做过即消失)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.focusCheckEntry({}, '2026-10-23'), true, '没做过 → 入口可见');
  assert.strictEqual(fp.focusCheckEntry(null, '2026-10-23'), true, '无记录 → 入口可见');
  assert.strictEqual(fp.focusCheckEntry({'2026-10-23': {acc: 0.8, flame: 2}}, '2026-10-23'), false, '当天做过 → 入口消失');
  assert.strictEqual(fp.focusCheckEntry({'2026-10-22': {acc: 0.8, flame: 2}}, '2026-10-23'), true, '昨天做过 → 今天入口回来');
});

test('checkBaseline: 近 7 天(不含今天)体检均值, 窗外/无记录不算', () => {
  const {fp} = loadFocus();
  const today = '2026-10-23';
  assert.strictEqual(fp.checkBaseline({}, today), undefined, '无记录无基线(不作对比)');
  assert.strictEqual(fp.checkBaseline(null, today), undefined);
  assert.strictEqual(fp.checkBaseline({[today]: {acc: 0.9}}, today), undefined, '今天自己不算进基线');
  assert.ok(Math.abs(fp.checkBaseline({'2026-10-22': {acc: 0.8}}, today) - 0.8) < 1e-9, '昨天一次');
  const c1 = {'2026-10-22': {acc: 0.8}, '2026-10-17': {acc: 0.6}};
  const c2 = {'2026-10-22': {acc: 0.8}, '2026-10-16': {acc: 0.4}};
  const c3 = {'2026-10-22': {acc: 0.8}, '2026-10-15': {acc: 0.4}};
  assert.ok(Math.abs(fp.checkBaseline(c1, today) - 0.7) < 1e-9, '近 7 天两次取均值');
  assert.ok(Math.abs(fp.checkBaseline(c2, today) - 0.6) < 1e-9, '第 7 天前(10-16 diff=7)仍在窗内');
  assert.ok(Math.abs(fp.checkBaseline(c3, today) - 0.8) < 1e-9, '第 8 天前(10-15 diff=8)出窗不计');
  assert.strictEqual(fp.checkBaseline({'2026-10-22': {flame: 2}}, today), undefined, '记录缺 acc 不算');
});

test('devilEntry: 当日已训→done, 关数余额<2→quota(禁用态), 否则 ok', () => {
  const {fp} = loadFocus();
  const today = '2026-10-23';
  const clean = {levels: {}, days: {}};
  assert.deepStrictEqual({...fp.devilEntry(clean, today, 0, 6)}, {open: true, reason: 'ok'}, '全新一天可开训');
  assert.deepStrictEqual({...fp.devilEntry(clean, today, 4, 6)}, {open: true, reason: 'ok'}, '余额恰 2 关(已玩 4/6)仍可开训');
  assert.deepStrictEqual({...fp.devilEntry(clean, today, 5, 6)}, {open: false, reason: 'quota'}, '余额 1 关不足 2 → 禁用态');
  assert.deepStrictEqual({...fp.devilEntry(clean, today, 6, 6)}, {open: false, reason: 'quota'}, '额度耗尽 → 禁用态');
  const done = {levels: {}, days: {[today]: {dim: 'corsi', acc: 72, lv: 3}}};
  const yesterday = {levels: {}, days: {'2026-10-22': {dim: 'corsi'}}};
  assert.deepStrictEqual({...fp.devilEntry(done, today, 0, 6)}, {open: false, reason: 'done'}, '当日已训 → 入口消失(优先于额度判定)');
  assert.deepStrictEqual({...fp.devilEntry(yesterday, today, 0, 6)}, {open: true, reason: 'ok'}, '昨天训过 → 今天入口回来');
  assert.deepStrictEqual({...fp.devilEntry(null, today, 0, 6)}, {open: true, reason: 'ok'}, '无 devil 字段的存量档视作可开训');
});

test('devilTierFor: 从待打关向下找该维最近一关的 tier(教学关兜底)', () => {
  const {fp} = loadFocus();
  /* 编排事实: 第 54 关(i=53)是 corsi tier11, i=52 flanker tier11, i=51 gonogo tier11 */
  assert.strictEqual(fp.FOCUS_LEVELS[53].dim, 'corsi');
  assert.strictEqual(fp.devilTierFor('corsi', 53), 11, '待打关恰是该维 → 直接取');
  assert.strictEqual(fp.devilTierFor('flanker', 53), 11, '该维在 52 关 → 往下找到');
  assert.strictEqual(fp.devilTierFor('cpt', 53), 11, 'cpt 在 i=50(k=45) → 往下扫最近一关同为 tier11');
  assert.strictEqual(fp.devilTierFor('switch', 99), 19, '第 100 关 master 的 dim 恰是 switch → 直接取 19');
  assert.strictEqual(fp.devilTierFor('switch', 0), 1, '开局只解锁 cpt 教学 → switch 兜到 i=4 教学 tier1');
  assert.strictEqual(fp.devilTierFor('cpt', 0), 1, '教学关也是合法当前档');
  assert.strictEqual(fp.devilTierFor('corsi', 99), 19, '封顶: 第 100 关 master 的 dim=switch, corsi 最近在 i=98 tier19');
});

test('FOCUS_DEVIL_TIME_MS: 魔鬼特训 5 分钟硬顶(到点当前小节打完强制结束)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.FOCUS_DEVIL_TIME_MS, 5*60*1000, '5 分钟 = 300000ms(设计稿 B8)');
});

test('focusDispatch: kind=check(每日体检)与 master 同走五维连跑路径', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.focusDispatch({kind: 'check', dim: 'switch'}).kind, 'master', '体检走 sections 分发');
  assert.strictEqual(fp.focusDispatch({kind: 'devil', dim: 'corsi'}).kind, 'engine', '魔鬼特训是单维小节, 走普通引擎分发');
});

test('runFocusLevel: 体检 level(FOCUS_CHECK_PARAMS)真进五维连跑且报幕可停', () => {
  const {fp, spoken} = loadFocus();
  const h = {progress() {}, showRule() {}, end() {}};
  const ctrl = fp.runFocusLevel({kind: 'check', dim: 'switch', sections: fp.FOCUS_CHECK_PARAMS}, fakeEl(), h, 0);
  assert.ok(spoken.some((s) => s.indexOf('新游戏：') >= 0), '第一节开跑即报幕: ' + spoken.join('/'));
  assert.ok(ctrl && typeof ctrl.stop === 'function', '返回可停止的控制柄');
  assert.doesNotThrow(()=> ctrl.stop(), 'stop 幂等安全');
});

/* ============ F7 图章纯函数(落账/裁剪/集章计数/里程碑判定) ============ */
/* 日期键与 budgetDateStr 同款 'Y-M-D' 无前导零; 构造日期一律走 new Date(y, m, d)
   进位(不用毫秒减法), 免 DST 边界抖动 */

test('stampRecord: 当日取 max 不重复累加, 计数钳 1~6, 0/负/NaN 不落账, 不突变入参', () => {
  const {fp} = loadFocus();
  const day = '2026-10-23';
  const s1 = fp.stampRecord({}, day, 3);
  assert.strictEqual(s1[day], 3, '当日 3 关落 3');
  const s2 = fp.stampRecord(s1, day, 2); // 同日重玩 2 关(取 max, 不累加成 5)
  assert.strictEqual(s2[day], 3, '同日再落取 max');
  const s3 = fp.stampRecord(s2, day, 5); // 同日冲高 → 5
  assert.strictEqual(s3[day], 5);
  assert.strictEqual(fp.stampRecord(s3, day, 99)[day], 6, '钳日限 6 关');
  assert.strictEqual(fp.stampRecord(s3, day, 1)[day], 5, '回落不降(取 max)');
  assert.strictEqual(Object.keys(fp.stampRecord(s3, day, 0)).length, 1, '0 关不新增键');
  assert.strictEqual(fp.stampRecord(s3, '2026-10-24', 0)['2026-10-24'], undefined, '0 关该日无章');
  assert.strictEqual(fp.stampRecord(s3, '2026-10-24', -2)['2026-10-24'], undefined, '负数不落账');
  assert.strictEqual(fp.stampRecord(s3, '2026-10-24', NaN)['2026-10-24'], undefined, 'NaN 不落账');
  assert.strictEqual(s3['2026-10-22'], undefined, '别日不受影响');
  assert.strictEqual(s1[day], 3, '纯函数: 前序对象未被突变');
});

test('stampTrim: 滚动保留 90 天(含今天), 90 天前裁掉/89 天前保留, 非法键丢弃', () => {
  const {fp} = loadFocus();
  /* 日期构造走 new Date(y, m, d-n) 自动进位, 不用毫秒减法(免 DST 边界抖动) */
  const dstr = (d) => d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  const today = new Date(2026, 9, 23); // 10-23
  const ago = (n) => new Date(2026, 9, 23 - n);
  const stamps = {};
  stamps[dstr(today)] = 3;
  stamps[dstr(ago(89))] = 6; // 窗口最老一天(7-26): 保留
  stamps[dstr(ago(90))] = 2; // 恰出窗(7-25): 裁掉
  stamps[dstr(ago(120))] = 1; // 深埋旧账: 裁掉
  stamps['bad-key'] = 5; // 非法键(无法判龄): 丢弃, 防死数据
  const next = fp.stampTrim(stamps, dstr(today));
  assert.strictEqual(next[dstr(today)], 3, '今天保留');
  assert.strictEqual(next[dstr(ago(89))], 6, '89 天前保留(90 天窗口含今天)');
  assert.strictEqual(next[dstr(ago(90))], undefined, '90 天前裁掉');
  assert.strictEqual(next[dstr(ago(120))], undefined, '更早的裁掉');
  assert.strictEqual(next['bad-key'], undefined, '非法键丢弃');
  assert.strictEqual(Object.keys(stamps).length, 5, '纯函数: 入参未突变');
  assert.strictEqual(fp.stampTrim(stamps, 'bad-today') === stamps, true, 'today 非法时不清档(防御: 原样返回)');
  const fresh = fp.stampTrim({}, dstr(today));
  assert.strictEqual(Object.keys(fresh).length, 0, '空档裁剪仍安全');
});

test('stampCount: 集章总数 = 有章天数(每天至多 1 章, 普通章/大章同日都算那天的一枚)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.stampCount({}), 0, '空档零章');
  assert.strictEqual(fp.stampCount({'2026-10-1': 1}), 1, '1 关日 = 1 章');
  assert.strictEqual(fp.stampCount({'2026-10-1': 3, '2026-10-2': 6}), 2, '大章日与练满日仍各 1 章');
  assert.strictEqual(fp.stampCount({'2026-9-30': 2, '2026-10-1': 1, '2026-10-2': 5}), 3);
});

test('stampMilestones: 达成线 3/7/14/30, 30 章起每 30 章递进金图章(60/90/…)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.stampMilestones(0).join(','), '', '0 章无线');
  assert.strictEqual(fp.stampMilestones(2).join(','), '', '2 章未到首线');
  assert.strictEqual(fp.stampMilestones(3).join(','), '3', '3 章首线');
  assert.strictEqual(fp.stampMilestones(7).join(','), '3,7');
  assert.strictEqual(fp.stampMilestones(14).join(','), '3,7,14');
  assert.strictEqual(fp.stampMilestones(29).join(','), '3,7,14', '29 章未到 30');
  assert.strictEqual(fp.stampMilestones(30).join(','), '3,7,14,30');
  assert.strictEqual(fp.stampMilestones(45).join(','), '3,7,14,30', '45 章无新线(60 未到)');
  assert.strictEqual(fp.stampMilestones(60).join(','), '3,7,14,30,60', '60 章递进金图章');
  assert.strictEqual(fp.stampMilestones(95).join(','), '3,7,14,30,60,90', '长线 90 章仍在递进');
});

test('stampRewardsDue: 差集幂等(已领线不重发), 存量档一次性补授; 奖励 id 全为观感类(红线)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.stampRewardsDue(5, []).join(','), '3', '5 章应领 3 章线');
  assert.strictEqual(fp.stampRewardsDue(5, [3]).join(','), '', '已领后幂等为空');
  assert.strictEqual(fp.stampRewardsDue(45, []).join(','), '3,7,14,30', '存量档首次落账一次性补授全部已越线');
  assert.strictEqual(fp.stampRewardsDue(45, [3, 7, 14, 30]).join(','), '', '补授后不重发');
  assert.strictEqual(fp.stampRewardsDue(60, [3, 7, 14, 30]).join(','), '60', '60 章新线单独发');
  assert.strictEqual(fp.stampRewardsDue(60).join(','), '3,7,14,30,60', 'claimed 缺省按空处理(全部待领)');
  /* 红线合同: 集章只发观感/收集奖励, 永不解锁关卡/范式/难度 — 奖励白名单锁死 */
  const COSMETIC = ['stamp_pattern', 'bag_skin', 'firework', 'gold_stamp'];
  for (const k of Object.keys(fp.FOCUS_STAMP_REWARDS)) {
    assert.ok(COSMETIC.includes(fp.FOCUS_STAMP_REWARDS[k]), k + ' 章奖励必须在观感白名单内');
  }
  assert.strictEqual(fp.stampRewardFor(3), 'stamp_pattern');
  assert.strictEqual(fp.stampRewardFor(7), 'bag_skin');
  assert.strictEqual(fp.stampRewardFor(14), 'firework');
  assert.strictEqual(fp.stampRewardFor(30), 'gold_stamp');
  assert.strictEqual(fp.stampRewardFor(60), 'gold_stamp', '60/90/…递进线都是金图章');
  assert.strictEqual(fp.stampRewardFor(90), 'gold_stamp');
});

/* ============ 里程碑补授(F6: 设计稿 §3 L4 · spec 实现决策 9/17) ============ */
/* 表形状(6 条/门槛/isTool)已由上节 F1 的 FOCUS_MILESTONES 测试锁定,
   此处只测 F6 的补授语义: 差集 / 幂等 / 进度口径 */

test('milestoneDue: 差集应授 = 越线且未授, 按门槛升序', () => {
  const {fp} = loadFocus();
  assert.deepStrictEqual([...fp.milestoneDue(9, [])], [], '未越线不授(9 < 10)');
  assert.deepStrictEqual([...fp.milestoneDue(10, [])], ['pick_wood'], '恰好越线授首阶');
  assert.deepStrictEqual([...fp.milestoneDue(50, [])], ['pick_wood', 'pick_stone', 'pick_iron'], '越线授全部未得阶(升序)');
  assert.deepStrictEqual([...fp.milestoneDue(50, ['pick_wood'])], ['pick_stone', 'pick_iron'], '已授者差集剔除');
  assert.deepStrictEqual([...fp.milestoneDue(50, ['pick_stone', 'pick_wood'])], ['pick_iron'], '已授乱序同样剔除');
});

test('milestoneDue: 幂等 — 授予结果并回 tools 后再算得空集(不重授)', () => {
  const {fp} = loadFocus();
  let tools = [];
  for (let round = 0; round < 2; round++) { // 模拟存量档两次进入训练营
    tools = tools.concat(fp.milestoneDue(100, tools));
  }
  assert.deepStrictEqual(tools,
      ['pick_wood', 'pick_stone', 'pick_iron', 'sword_iron', 'pick_diamond', 'sword_diamond'],
      '两轮合计恰授 6 件, 无重复');
  assert.deepStrictEqual([...fp.milestoneDue(100, tools)], [], '全授后再算为空');
});

test('focusProgress: unlocked 被 99 封顶, 大师关通关经 history 兜底到 100', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.focusProgress({unlocked: 53}), 53, '普通档直接取 unlocked');
  assert.strictEqual(fp.focusProgress({unlocked: 99, history: []}), 99, '无 history 不虚抬');
  assert.strictEqual(fp.focusProgress({unlocked: 99, history: [{i: 98, passed: true}]}), 99, 'history 不高于 unlocked 不抬');
  assert.strictEqual(fp.focusProgress({unlocked: 99, history: [{i: 99, passed: true}]}),
      100, '大师关(i=99)通关 → 100 门槛可达(钻剑不因封顶漏发)');
  assert.strictEqual(fp.focusProgress({unlocked: 30, history: [{i: 40, passed: false}]}),
      30, '未通过关卡不计入进度');
  assert.strictEqual(fp.focusProgress(null), 0, '空档安全回落 0');
});

test('milestoneDue × focusProgress: 大师通关存档一次补授全 6 件', () => {
  const {fp} = loadFocus();
  const save = {unlocked: 99, history: [{i: 99, passed: true}], tools: []};
  const due = fp.milestoneDue(fp.focusProgress(save), save.tools);
  assert.strictEqual(due.length, 6, '进度 100 → 6 阶全授');
});

/* ============ F5 矿袋战利品政策(设计稿 §3 L3): 掷骰/结算/授予纯函数 ============
   rollFocusLoot: 正确试次 p=0.45 掷维度池 · 连对每满 3 次的那一试次保底掷
   稀有池(概率和=1 必得) · 教学关/错误试次零掉落; seed 注入锁定概率边界
   (首骰值以同常数 LCG 独立预言 — 常数是本文件 loadFocusDrv 已有的公开
   惯例, 选择逻辑不重实现, 只断言掉/不掉与产物归属)。
   levelBonusLoot: 通关 torch|apple 二选一 + 三星追加 1 钻石(教学关不发)。
   grantFocusLoot: F3 核定授予流 — 余量>0 静默忽略并标 full(每关至多一次
   toast 归模式层); DOM 飞入/HUD 不直测, boot 冒烟兜底。 */

/* LCG 首骰预言: 只复现第一个骰值(非保底路径首骰即 p 骰), 不复现选择逻辑 */
function lootFirstRoll(seed) {
  return ((seed * 1103515245 + 12345) % 2147483648) / 2147483648;
}

test('rollFocusLoot: 教学关豁免 + 错误试次只奖不罚 — 恒无掉落', () => {
  const {fp} = loadFocus();
  for (const seed of [1, 7, 42, 99, 12345]) {
    assert.strictEqual(fp.rollFocusLoot('cpt', {ok: true, streak: 3, kind: 'tutorial', seed}),
        null, '教学关 3 连对也不掉(US12 零压力), seed=' + seed);
    assert.strictEqual(fp.rollFocusLoot('cpt', {ok: false, streak: 0, seed}),
        null, '错误试次永不掉(只奖不罚), seed=' + seed);
    assert.strictEqual(fp.rollFocusLoot('cpt', {streak: 0, seed}),
        null, '缺 ok 不掷(防御: 调用方必传布尔)');
  }
});

test('rollFocusLoot: p=0.45 边界种子锁定 — 首骰未中→null, 中→产物在维度池内', () => {
  const {fp} = loadFocus();
  const poolIds = Object.keys(fp.FOCUS_LOOT.cpt.pool);
  let sawDrop = 0; let sawNull = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const wantDrop = lootFirstRoll(seed) < 0.45; // streak=0 非保底: 首骰即 p 骰
    const got = fp.rollFocusLoot('cpt', {ok: true, streak: 0, seed});
    if (wantDrop) {
      sawDrop++;
      assert.ok(poolIds.includes(got), '首骰<0.45 必掉且产物∈cpt 池: seed=' + seed + ' got=' + got);
    } else {
      sawNull++;
      assert.strictEqual(got, null, '首骰≥0.45 不掉: seed=' + seed);
    }
  }
  assert.ok(sawDrop > 15 && sawNull > 15, '60 种子两个分支都充分覆盖(掉 ' + sawDrop + ' / 不掉 ' + sawNull + ')');
});

test('rollFocusLoot: 池产物服从权重(1200 种子: 每类频率≈权重, 全部在池内)', () => {
  const {fp} = loadFocus();
  const pool = fp.FOCUS_LOOT.cpt.pool; // coal .40 / iron_ore .25 / torch .20 / iron_ingot .12 / gold_ingot .03
  const freq = {};
  let total = 0;
  for (let seed = 1; seed <= 1200; seed++) {
    const id = fp.rollFocusLoot('cpt', {ok: true, streak: 0, seed});
    if (id) {
      freq[id] = (freq[id] || 0) + 1;
      total++;
    }
  }
  assert.ok(total > 400, '掉落样本足够(约 0.45×1200): ' + total);
  for (const id of Object.keys(pool)) {
    assert.ok((freq[id] || 0) > 0, '池内每类都有样本: ' + id);
    const rel = (freq[id] || 0) / total;
    assert.ok(Math.abs(rel - pool[id]) < 0.06,
        id + ' 相对频率 ' + rel.toFixed(3) + ' ≈ 权重 ' + pool[id] + '(±0.06)');
  }
});

test('rollFocusLoot: 连对每满 3 次保底必得稀有池一件, 未满节拍走普通掷骰', () => {
  const {fp} = loadFocus();
  const rareIds = Object.keys(fp.FOCUS_LOOT.cpt.rare); // gold_ingot .6 / diamond .4
  for (const seed of [1, 7, 42, 99, 12345]) {
    for (const streak of [3, 6]) {
      const got = fp.rollFocusLoot('cpt', {ok: true, streak, seed});
      assert.ok(rareIds.includes(got),
          streak + ' 连对保底必得稀有池(不受 0.45 门槛): seed=' + seed + ' got=' + got);
    }
  }
  /* 未满节拍(2/4/5)不触发保底: 有种子产 null(首骰未中), 有种子产普通池独有物品 */
  let sawNull = false; let sawCoal = false;
  for (let seed = 1; seed <= 80; seed++) {
    const got = fp.rollFocusLoot('cpt', {ok: true, streak: 2, seed});
    if (got === null) sawNull = true;
    if (got === 'coal') sawCoal = true; // coal 只在普通池(稀有池没有)
  }
  assert.ok(sawNull && sawCoal, 'streak=2 走普通掷骰(有掉有不掉, 保底不触发)');
});

test('rollFocusLoot: 未知维度兜底 null(防御, 不掷不炸)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.rollFocusLoot('???', {ok: true, streak: 0, seed: 1}), null);
  assert.strictEqual(fp.rollFocusLoot(undefined, {ok: true, streak: 3, seed: 1}), null);
});

test('levelBonusLoot: 未通过/教学关不发; 通关 torch|apple 二选一; 三星 +1 钻石', () => {
  const {fp} = loadFocus();
  /* 返回数组克隆回本 realm 再 deepStrictEqual(先例: focusDispatch 测试的跨 realm 注) */
  assert.deepStrictEqual([...fp.levelBonusLoot(false, 0)], [], '未通过不发');
  assert.deepStrictEqual([...fp.levelBonusLoot(false, 3)], [], '未通过即使三星口径也不发');
  assert.deepStrictEqual([...fp.levelBonusLoot(true, 0, {kind: 'tutorial'})], [], '教学关通关也不发(零压力)');
  let sawTorch = false; let sawApple = false;
  for (let seed = 1; seed <= 40; seed++) {
    const one = [...fp.levelBonusLoot(true, 1, {seed})];
    assert.strictEqual(one.length, 1, '通关恰 1 件结算物');
    assert.ok(one[0] === 'torch' || one[0] === 'apple', '结算物∈{torch,apple}: ' + one[0]);
    if (one[0] === 'torch') sawTorch = true; else sawApple = true;
    const three = [...fp.levelBonusLoot(true, 3, {seed})];
    assert.strictEqual(three.length, 2, '三星恰 2 件');
    assert.ok(three.includes('diamond'), '三星追加 1 钻石');
    assert.ok(three.includes('torch') || three.includes('apple'), '另一件仍是 torch|apple');
  }
  assert.ok(sawTorch && sawApple, '40 种子覆盖二选一两个分支');
});

test('grantFocusLoot: 空包逐件入包(granted 全记); 满包余量>0 静默忽略并标 full', () => {
  const {fp} = loadFocus();
  const clone = (r) => ({granted: [...r.granted], full: r.full}); // 克隆回本 realm(跨 realm 原型先例)
  const inv = fp.mkInventory();
  const r1 = fp.grantFocusLoot(inv, ['coal', 'torch', 'coal']);
  assert.deepStrictEqual(clone(r1), {granted: ['coal', 'torch', 'coal'], full: false}, '空包全收');
  assert.strictEqual(fp.count(inv, 'coal'), 2, '两件 coal 已落包(并堆)');
  assert.strictEqual(fp.count(inv, 'torch'), 1);

  const full = fp.mkInventory();
  for (let i = 0; i < fp.INV_SLOTS; i++) fp.add(full, 'dirt', 64); // 27 堆全满(既有测试惯例)
  const before = JSON.stringify(full.slots);
  const r2 = fp.grantFocusLoot(full, ['diamond', 'coal']);
  assert.deepStrictEqual(clone(r2), {granted: [], full: true}, '满包静默忽略(零惩罚)且标 full 供模式层 toast');
  assert.strictEqual(JSON.stringify(full.slots), before, '满包语义: 包内容不变(无部分入包残留)');
  assert.deepStrictEqual(clone(fp.grantFocusLoot(inv, [])), {granted: [], full: false}, '空清单安全');
});
