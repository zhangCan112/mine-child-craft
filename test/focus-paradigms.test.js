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
   加载器: vm context 依次执行 rand-core.js + items-core.js + inventory-core.js +
   camp-core.js + focus-levels.js + focus-paradigms.js, 镜像浏览器 <script defer> 共享词法
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
    // 按钮像素图标(button-icons.js, Flanker 左右大按钮) — 只测同步路径给桩
    btnImg: () => '<img class="bi" alt="" src="data:btn">',
    // focusTodayStr 委托的日期串唯一拼装点(daily-budget.js, 加载序在前)
    budgetDateStr(t) {
      const d = new Date(t);
      return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  /* rand-core(种子 LCG)与 inventory-core(F5 授予流语义)排在 focus-levels 之前 — 与 index.html 相对序一致;
     camp-core(图章/日期/loot 机制基座)排在 focus-levels 之前 — FocusStampBook 构造期即用 */
  for (const f of ['rand-core.js', 'items-core.js', 'inventory-core.js', 'camp-core.js',
    'focus-levels.js', 'focus-paradigms.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__fp = { focusDispatch, runFocusLevel, mkAdapt, FOCUS_LEVELS, FOCUS_DIMS,
                        focusPassed, focusStars, FOCUS_META, paramsFor,
                        FOCUS_REWARD_STAGES, rewardStageFor, rewardTrialCount,
                        FOCUS_REWARD_TRIAL_REF, FOCUS_REWARD_DRY,
                        FOCUS_CHECK_PARAMS,
                        focusFlame, devilStep, devilParams,
                        FOCUS_STAMP_DAILY, FOCUS_STAMP_REWARDS,
                        focusDayIndex, trimFocusLog, FOCUS_LOG_KEEP_DAYS,
                        devilDimFor, focusCheckEntry, checkBaseline,
                        devilEntry, devilTierFor, FOCUS_DEVIL_TIME_MS,
                        stampRecord, stampTrim, stampCount,
                        stampMilestones, stampRewardsDue, stampRewardFor,
                        FOCUS_STAMP_KINDS, stampRewardClaimed,
                        focusTodayStr, focusTodayDims, focusDimStars, focusLastBreakthrough,
                        FOCUS_SAVE_DEFAULTS, migrateFocusSave,
                        FOCUS_MILESTONES, milestoneLevels, milestoneDue, focusProgress,
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
  assert.strictEqual(L99.dim, 'search', '大师关的哨兵 dim 恰是六维最后一个(最容易撞上 search 分发)');
  assert.strictEqual(fp.focusDispatch(L99).kind, 'master', 'kind=master 优先于 dim 判定');
});

test('focusDispatch: 六维各归各的引擎, 未知维度返回 none', () => {
  const {fp} = loadFocus();
  const d = (dim, kind) => fp.focusDispatch({dim, kind: kind || 'normal'});
  /* 逐字段断言: 对象来自 vm context, deepStrictEqual 会因跨 realm 原型不同而误判 */
  assert.deepStrictEqual({...d('cpt')}, {kind: 'engine', engine: 'discrimination', framing: 'cpt'});
  assert.deepStrictEqual({...d('gonogo')}, {kind: 'engine', engine: 'discrimination', framing: 'gonogo'});
  assert.deepStrictEqual({...d('flanker')}, {kind: 'engine', engine: 'flanker'});
  assert.deepStrictEqual({...d('corsi')}, {kind: 'engine', engine: 'corsi'});
  assert.deepStrictEqual({...d('switch')}, {kind: 'engine', engine: 'switch'});
  assert.deepStrictEqual({...d('search')}, {kind: 'engine', engine: 'search'});
  assert.strictEqual(d('???').kind, 'none', '未知维度不进任何引擎');
  assert.strictEqual(d('cpt', 'tutorial').engine, 'discrimination', '教学关同引擎(demo 标记在 runFocusLevel 加)');
});

test('runFocusLevel: master 关真进六维连续小节(报幕"新游戏"且可 stop)', () => {
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

test('FOCUS_LEVELS: 共 100 关, 前 6 关教学(tier1 按六维序), 第 100 关 master 六小节', () => {
  const {fp} = loadFocus();
  const L = fp.FOCUS_LEVELS;
  assert.strictEqual(L.length, 100);
  for (let i=0; i<6; i++) {
    assert.strictEqual(L[i].kind, 'tutorial', '第 ' + (i+1) + ' 关为教学');
    assert.strictEqual(L[i].tier, 1);
    assert.strictEqual(L[i].dim, fp.FOCUS_DIMS[i], '教学关按六维顺序');
  }
  const m = L[99];
  assert.strictEqual(m.kind, 'master');
  assert.strictEqual(m.tier, 19, '难度封顶');
  assert.strictEqual(m.sections.length, 6, '六维连续小节');
  assert.strictEqual(m.sections.map((s) => s.dim).join(','), fp.FOCUS_DIMS.join(','), '小节覆盖全部六维');
});

test('FOCUS_LEVELS: 7~99 关六维轮换且 tier 随轮次递进(封顶 19)', () => {
  const {fp} = loadFocus();
  const L = fp.FOCUS_LEVELS;
  for (let i=6; i<99; i++) {
    const k = i - 6;
    assert.strictEqual(L[i].dim, fp.FOCUS_DIMS[k % 6], '第 ' + (i+1) + ' 关轮换维度');
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
    btnImg: (n) => '<img class="bi" data-btn="' + n + '" alt="" src="data:btn">', // 按钮像素图标桩
    Mobs: {face(t) {
      log.mobFace.push(t);
      return 'data:mob:' + t;
    }},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['rand-core.js', 'items-core.js', 'camp-core.js', 'focus-levels.js', 'focus-paradigms.js']) {
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
  d.fp.runFocusLevel({dim: 'corsi', kind: 'normal', params: p}, fakeEl(),
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

test('corsi 教学脚手架: 点错原序列重演(不推进), 正式关无此行为', () => {
  const d = loadFocusDrv({seed: 19});
  const ended = [];
  const p = Object.assign(d.fp.paramsFor('corsi', 2), {demo: true, scaffold: true});
  d.fp.runFocusLevel({dim: 'corsi', kind: 'tutorial', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  const hint = drvEls(d, 'f-corsi-hint')[0];
  const tiles = drvEls(d, 'f-corsi-tile');
  let mark = 0; let seqN = 0; let replayed = 0;
  for (let guard = 0; guard < 60 && ended.length === 0; guard++) {
    d.flush();
    if (!hint.textContent.includes('按顺序')) break;
    const lit = d.clsLog.slice(mark).filter((r) => !r.rm && r.cls === 'lit').map((r) => r.el);
    hint.textContent = '';
    if (seqN === 1 && replayed === 0) {
      tiles.find((t) => t !== lit[0]).onclick(); // 第一正式序列点错 → 触发重演
      replayed++;
    } else lit.forEach((t) => t.onclick());
    mark = d.clsLog.length;
    seqN++;
  }
  d.flush();
  assert.strictEqual(replayed, 1, '点错触发过一次重演');
  assert.strictEqual(seqN, p.seqs + 1, '重演多驱一序列(demo 1 + 正式 5 + 重演 1)');
  assert.strictEqual(ended.length, 1, '重演后照常到局末');
  assert.ok(d.spoken.some((s) => s.indexOf('再看一遍这一串') >= 0), '重演配一句口播引导');
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
    /* search 小节(第六维): 点全部未找钻石, 回合间 flush 驱动重建 */
    const sDiamonds = drvEls(d, 'f-search-cell')
        .filter((e) => e.innerHTML.includes('data:icon:diamond') && !e.dataset.found);
    if (sDiamonds.length) {
      sDiamonds.forEach((e) => e.onmousedown());
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
  assert.deepStrictEqual(dims, [...d.fp.FOCUS_DIMS], '六维小节各按自己 dim 上报');
  for (const dim of dims) checkTrialEvents(events.filter((t) => t.dim === dim), dim);
});

/* ============ D6 视觉搜索(矿洞大扫除, 2026-10 第六维) ============ */

test('search 曲线(D6): 回合/目标常量带, 网格 6→8 列, similarMix 渐进混编, density 单调有界', () => {
  const {fp} = loadFocus();
  const MIX_STEPS = [0, 0.3, 0.6, 0.9, 1];
  for (let tier=1; tier<=19; tier++) {
    const p = fp.paramsFor('search', tier);
    assert.strictEqual(p.rounds, 3, '恒 3 回合(Balloon Hunt 结构)');
    assert.strictEqual(p.targets, 6, '每回合 6 目标');
    assert.strictEqual(p.trials, 18, '试次归一口径 = 3×6');
    assert.strictEqual(p.rows, 4);
    assert.ok(p.cols >= 6 && p.cols <= 8, '网格 6~8 列: tier' + tier + '=' + p.cols);
    assert.ok(p.density.length === 2, '回合 1/2 两档干扰率(回合 0 恒 0 在引擎内)');
    assert.ok(p.density[0] > 0 && p.density[1] > p.density[0], '回合 2 干扰率高于回合 1(回合内递增)');
    assert.ok(p.density[1] <= 0.8, '干扰率顶格 0.8');
    const expectMix = tier < 8 ? 0 : Math.min(1, 0.3*(tier-7));
    assert.ok(Math.abs(p.similarMix - expectMix) < 1e-9, 'similarMix 渐进公式: tier' + tier);
    assert.ok(MIX_STEPS.some((v) => Math.abs(p.similarMix - v) < 1e-9),
        'similarMix 只落渐进档(0/0.3/0.6/0.9/1): tier' + tier + '=' + p.similarMix);
  }
  assert.strictEqual(fp.paramsFor('search', 1).cols, 6, '起步 6 列');
  assert.strictEqual(fp.paramsFor('search', 10).cols, 7, '中段 7 列');
  assert.strictEqual(fp.paramsFor('search', 19).cols, 8, '顶格 8 列');
  assert.strictEqual(fp.paramsFor('search', 7).similarMix, 0, 'tier7 无绿宝石');
  assert.strictEqual(fp.paramsFor('search', 8).similarMix, 0.3, 'tier8 首见 30% 混入');
  assert.ok(Math.abs(fp.paramsFor('search', 10).similarMix - 0.9) < 1e-9, 'tier10 混入 90%(与 gonogo 伪装同式)');
  assert.strictEqual(fp.paramsFor('search', 11).similarMix, 1, 'tier11 全量');
});

test('FOCUS_META.search: 六维元数据齐全, tip 档位感知(绿宝石混入才提醒)', () => {
  const {fp} = loadFocus();
  const m = fp.FOCUS_META.search;
  assert.strictEqual(m.name, '视觉搜索');
  assert.strictEqual(m.game, '矿洞大扫除');
  assert.ok(m.rule.indexOf('钻石') >= 0 && m.rule.indexOf('找') >= 0, '规则含目标与动作');
  const low = m.tip(fp.paramsFor('search', 3));
  const high = m.tip(fp.paramsFor('search', 12));
  assert.ok(low.indexOf('绿宝石') < 0, '低档 tip 不提绿宝石');
  assert.ok(high.indexOf('绿宝石') >= 0, '高档 tip 提醒绿宝石相似干扰');
  assert.ok(low.indexOf('18') >= 0, 'tip 含目标总数(3×6=18)');
});

test('runSearch: 首回合纯目标+中性填料, 三轮找齐驱动到局末, acc/correct/falseTaps 口径', () => {
  const d = loadFocusDrv({seed: 7});
  const ended = [];
  const p = Object.assign(d.fp.paramsFor('search', 12), {demo: false});
  d.fp.runFocusLevel({dim: 'search', kind: 'normal', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  const round0 = drvEls(d, 'f-search-cell');
  assert.strictEqual(round0.length, p.cols*4, '首回合格数 = cols×rows');
  const icons0 = round0.map((e) => (e.innerHTML.match(/data:icon:(\w+)/) || [])[1]);
  assert.ok(icons0.every((n) => n === 'diamond' || n === 'stone'),
      '首回合纯目标+中性填料(无干扰矿): ' + icons0.join(','));
  assert.strictEqual(icons0.filter((n) => n === 'diamond').length, 6, '首回合 6 目标');
  /* 逐回合点掉全部钻石(mousedown 即判定通道), 误点每回合一块非目标格 */
  for (let guard = 0; guard < 12 && ended.length === 0; guard++) {
    const cells = drvEls(d, 'f-search-cell');
    const stone = cells.find((e) => !e.innerHTML.includes('data:icon:diamond') && !e.dataset.tapped);
    if (stone) {
      stone.dataset.tapped = '1';
      stone.onmousedown();
    }
    const diamonds = cells.filter((e) => e.innerHTML.includes('data:icon:diamond') && !e.dataset.found);
    diamonds.forEach((e) => e.onmousedown());
    d.flush(60);
  }
  d.flush(60);
  assert.strictEqual(ended.length, 1, '三轮找齐驱动到 h.end');
  const st = ended[0];
  assert.strictEqual(st.trials, 18, '分母=目标总数(自定步调无漏测试次)');
  assert.strictEqual(st.correct, 18, '全部找齐');
  assert.strictEqual(st.falseTaps, 3, '每回合一次误点(3 回合)');
  assert.ok(Math.abs(st.acc - 15/18) < 1e-9, 'acc=(找到−误点)/总数: ' + st.acc);
  assert.ok(st.rts.length === 18 && st.mrt >= 0, '每颗钻石一条反应时(只进家长面板)');
  /* 高档(tier12, similarMix=1)的干扰矿石全为绿宝石 — iconOf 出口可见 */
  assert.ok(d.log.iconOf.includes('emerald'), 'similarMix=1 时绿宝石混入');
});

test('runSearch: 低档(tier<8)整局无绿宝石; 教学关首回合目标带 hint 脉动', () => {
  const d = loadFocusDrv({seed: 11});
  const ended = [];
  const p = Object.assign(d.fp.paramsFor('search', 3), {demo: true});
  d.fp.runFocusLevel({dim: 'search', kind: 'tutorial', params: p}, fakeEl(),
      {progress() {}, end: (s) => ended.push(s)});
  const round0 = drvEls(d, 'f-search-cell');
  const hinted = round0.filter((e) => e.className.split(' ').includes('hint'));
  assert.strictEqual(hinted.length, 6, '教学首回合 6 目标全部 hint 脉动');
  assert.ok(hinted.every((e) => e.innerHTML.includes('data:icon:diamond')), 'hint 只挂在目标上');
  for (let guard = 0; guard < 12 && ended.length === 0; guard++) {
    const cells = drvEls(d, 'f-search-cell');
    cells.filter((e) => e.innerHTML.includes('data:icon:diamond') && !e.dataset.found)
        .forEach((e) => e.onmousedown());
    d.flush(60);
  }
  d.flush(60);
  assert.strictEqual(ended.length, 1, '教学局可整局驱动');
  assert.strictEqual(d.log.iconOf.includes('emerald'), false, 'tier3 similarMix=0 整局无绿宝石');
  assert.strictEqual(ended[0].acc, 1, '无误点 acc=1');
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

test('FOCUS_REWARD_STAGES: 四段递增掉落表 — 概率和=1, id 全在 ITEMS 注册且 stackMax>0', () => {
  const {fp} = loadFocus();
  const stages = fp.FOCUS_REWARD_STAGES;
  assert.strictEqual(stages.length, 4, '四段(奖励调优: 品质镜像探险深度带)');
  let lastTier = 0;
  let lastP = 0;
  for (const st of stages) {
    assert.ok(st.tier > lastTier, '段位 tier 门槛升序无重叠');
    lastTier = st.tier;
    assert.ok(st.p > lastP && st.p <= 1, '变率 p 随段严格递增(幅度随进度递增)');
    lastP = st.p;
    const entries = Object.keys(st.pool);
    assert.ok(entries.length >= 3, '段池至少三件');
    let sum = 0;
    for (const id of entries) {
      sum += st.pool[id];
      assert.ok(fp.ITEMS[id], '段池的 ' + id + ' 必须在 ITEMS 注册');
      assert.ok(fp.stackMax(id) > 0, id + ' 可入包堆叠(stackMax>0)');
    }
    assert.ok(Math.abs(sum - 1) < 1e-9, '段池概率和=1, 实为 ' + sum);
    for (const key of ['bonus', 'star3']) {
      assert.ok(st[key].length >= 1, key + ' 至少一组');
      for (const one of st[key]) {
        assert.ok(Array.isArray(one) && one.length >= 1, key + ' 内层为非空数组(单元素=固定, 多元素=掷骰选一)');
        for (const id of one) {
          assert.ok(fp.ITEMS[id], key + ' 的 ' + id + ' 必须在 ITEMS 注册');
        }
      }
    }
  }
  /* 品质红线锚点(奖励调优设计文档): 钻石只在段4出现、金段3 首见、铁锭全程
     不发(烧炼教学归探险, ADR 0002 只产不耗的语义收窄) */
  const idsOf = (st) => [...Object.keys(st.pool), ...st.bonus.flat(), ...st.star3.flat()];
  for (let s = 0; s < 3; s++) {
    assert.ok(!idsOf(stages[s]).includes('diamond'), '段' + (s+1) + ' 无钻石(高价值=晚出现)');
    assert.ok(!idsOf(stages[s]).includes('iron_ingot'), '段' + (s+1) + ' 无铁锭');
  }
  for (let s = 0; s < 2; s++) {
    assert.ok(!idsOf(stages[s]).includes('gold_ingot'), '段' + (s+1) + ' 无金锭(段3 首见)');
  }
  assert.ok(stages[3].pool.diamond > 0, '段4 钻带级含钻石');
});

test('rewardStageFor/rewardTrialCount: tier→段映射与试次归一的取数口径', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.rewardStageFor(1), null, '教学 tier1 无奖励段');
  assert.strictEqual(fp.rewardStageFor(2), fp.FOCUS_REWARD_STAGES[0]);
  assert.strictEqual(fp.rewardStageFor(5), fp.FOCUS_REWARD_STAGES[0]);
  assert.strictEqual(fp.rewardStageFor(6), fp.FOCUS_REWARD_STAGES[1]);
  assert.strictEqual(fp.rewardStageFor(11), fp.FOCUS_REWARD_STAGES[2]);
  assert.strictEqual(fp.rewardStageFor(16), fp.FOCUS_REWARD_STAGES[3]);
  assert.strictEqual(fp.rewardStageFor(19), fp.FOCUS_REWARD_STAGES[3]);
  assert.strictEqual(fp.rewardStageFor(99), fp.FOCUS_REWARD_STAGES[3], '越界回落末段(防御不白给)');
  /* 试次取数: 普通关读 params(cpt trials / corsi seqs), 大师关 sections 各节各归各 */
  const L54 = fp.FOCUS_LEVELS[54]; /* i=54: k=48 → cpt(FOCUS_DIMS[0]), tier11 */
  assert.strictEqual(L54.dim, 'cpt');
  assert.strictEqual(fp.rewardTrialCount(L54), L54.params.trials, 'cpt 关读 params.trials');
  const L51 = fp.FOCUS_LEVELS[51]; /* i=51: k=45 → corsi(FOCUS_DIMS[3]), tier11 */
  assert.strictEqual(L51.dim, 'corsi');
  assert.strictEqual(fp.rewardTrialCount(L51), L51.params.seqs, 'corsi 关读 params.seqs');
  const M = fp.FOCUS_LEVELS[99];
  const mCpt = M.sections.find((s)=>s.dim==='cpt');
  assert.strictEqual(fp.rewardTrialCount(M, 'cpt'), mCpt.params.trials, '大师关按 dim 补注查 sections');
  assert.strictEqual(fp.rewardTrialCount(M, 'search'),
      M.sections.find((s)=>s.dim==='search').params.trials, 'search 小节读 params.trials(3×6=18 归一口径)');
  const mSelf = M.sections.find((s)=>s.dim===M.dim);
  assert.strictEqual(fp.rewardTrialCount(M), mSelf.params.trials, '大师关缺省 dim 落本体 dim 的 sections 节(哨兵 dim=search 也在节内)');
  assert.strictEqual(fp.rewardTrialCount({dim: 'cpt'}, '???'), fp.FOCUS_REWARD_TRIAL_REF, '未知 dim 回落基准=归一 1.0(防御)');
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

test('FOCUS_CHECK_PARAMS: 六维低档短参数, 参数驱动的时长有上界(约 90 秒口径)', () => {
  const {fp} = loadFocus();
  const cs = fp.FOCUS_CHECK_PARAMS;
  assert.strictEqual(cs.length, 6, '六维各一节');
  assert.strictEqual(cs.map((s) => s.dim).join(','), fp.FOCUS_DIMS.join(','), '小节覆盖全部六维');
  let total = 0;
  for (const s of cs) {
    const p = s.params;
    if (s.dim === 'search') { // 搜索自定步调无试次轴: 减回合/目标/列控时长
      assert.strictEqual(p.rounds, 2, 'search 体检减到 2 回合');
      assert.strictEqual(p.targets, 4, 'search 体检每回合 4 目标');
      assert.strictEqual(p.cols, 5, 'search 体检 5 列小阵');
      assert.strictEqual(p.trials, 8, 'search 归一口径同步缩');
      continue;
    }
    if (p.trials) assert.ok(p.trials <= 6, s.dim + ' 每节约 6 试次');
    if (p.seqs) assert.ok(p.seqs <= 6, 'corsi 序列数 ≤6');
    if (s.dim === 'cpt') total += p.trials * (p.dur + p.isi); // 判别: 呈现+间隔
    if (s.dim === 'gonogo') total += p.trials * (p.dur + 800); // 引擎无 isi 时默认 800
    if (s.dim === 'flanker') total += p.trials * (p.window + 360); // 窗口+反馈帧
    if (s.dim === 'corsi') total += p.seqs * (400 + p.len * p.pace + 200); // 展示期(输入期自步伐, 不由参数决定)
    /* switch/search 自步伐, 无参数驱动时长 */
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

test('devilDimFor: 严格按日序数 %6 轮换 — 连续 6 天六维全覆盖, 相邻两天必不同维', () => {
  const {fp} = loadFocus();
  const dstr = (d) => d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  const days = Array.from({length: 10}, (_, k)=>dstr(new Date(2026, 9, 20 + k))); // 10-20 起跨月进位
  const dims = days.map((day)=>fp.devilDimFor(day));
  assert.strictEqual(dims.slice(0, 6).sort().join(','), [...fp.FOCUS_DIMS].sort().join(','),
      '连续 6 天恰好六维各一次: ' + dims.slice(0, 6).join(','));
  assert.strictEqual(dims[6], dims[0], '第 7 天回到第 1 天的维度(6 天一轮)');
  for (let k = 0; k < days.length - 1; k++) { // 相邻两天必不同维(严格轮换, 非哈希)
    assert.strictEqual(fp.focusDayIndex(days[k+1]) - fp.focusDayIndex(days[k]), 1,
        '日期构造相邻: ' + days[k] + ' → ' + days[k+1]);
    assert.notStrictEqual(dims[k+1], dims[k], '相邻两天维度必须不同: ' + days[k] + '/' + days[k+1]);
  }
  assert.strictEqual(fp.devilDimFor(days[0]), dims[0], '同一天恒定同维(纯函数稳定)');
  assert.ok(fp.FOCUS_DIMS.includes(fp.devilDimFor('bad-day')), '损坏日期回落合法维度(不炸)');
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
  /* 编排事实(六维): 第 52 关(i=51)是 corsi tier11, i=48 cpt tier11;
     flanker 在 tier11 带(k=45~49)恰好缺席, 最近是 i=50 的 tier10 —
     6 维轮换 × tier 每 5 关进 1 档, 每个档带必有一个维度缺席(预期行为) */
  assert.strictEqual(fp.FOCUS_LEVELS[51].dim, 'corsi');
  assert.strictEqual(fp.devilTierFor('corsi', 51), 11, '待打关恰是该维 → 直接取');
  assert.strictEqual(fp.devilTierFor('flanker', 51), 10, 'flanker 缺席 tier11 带 → 往下找到 i=50 tier10');
  assert.strictEqual(fp.devilTierFor('cpt', 51), 10, 'cpt 同缺席 tier11 带 → 往下找到 i=48 tier10');
  assert.strictEqual(fp.devilTierFor('cpt', 54), 11, '待打关 i=54 恰是 cpt tier11 → 直接取');
  assert.strictEqual(fp.devilTierFor('switch', 99), 19, 'switch 最近在 i=92(k=88) → tier19');
  assert.strictEqual(fp.devilTierFor('search', 99), 19, 'search 最近在 i=95(k=89) → tier19');
  assert.strictEqual(fp.devilTierFor('corsi', 99), 19, 'corsi 最近在 i=93(k=87) → tier19');
  assert.strictEqual(fp.devilTierFor('switch', 0), 1, '开局只解锁 cpt 教学 → 扫不到回落兜底 tier1');
  assert.strictEqual(fp.devilTierFor('cpt', 0), 1, '教学关也是合法当前档');
});

test('FOCUS_DEVIL_TIME_MS: 魔鬼特训 5 分钟硬顶(到点当前小节打完强制结束)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.FOCUS_DEVIL_TIME_MS, 5*60*1000, '5 分钟 = 300000ms(设计稿 B8)');
});

test('focusDispatch: kind=check(每日体检)与 master 同走六维连跑路径', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.focusDispatch({kind: 'check', dim: 'switch'}).kind, 'master', '体检走 sections 分发');
  assert.strictEqual(fp.focusDispatch({kind: 'devil', dim: 'corsi'}).kind, 'engine', '魔鬼特训是单维小节, 走普通引擎分发');
});

test('runFocusLevel: 体检 level(FOCUS_CHECK_PARAMS)真进六维连跑且报幕可停', () => {
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

/* ============ F5 矿袋段位奖励政策(奖励调优 2026-10): 掷骰/结算/授予纯函数 ============
   rollFocusLoot(level,{ok,dry,dim,seed}): 教学关/错误试次零掉落; 正确试次按
   段位变率 p×试次归一掷段位池(品质随段递增, LCG 首骰独立预言锁边界);
   dry 达 FOCUS_REWARD_DRY 跳过掷骰必得(防空关挫败的干燥兜底; 连对保底已
   退役 — 预期的实物工资形态, docs/reward-model-research.md §4)。
   levelBonusLoot(passed,stars,level,{seed}): 按段位表展开 bonus(单元素固定,
   多元素掷骰选一) + 三星追加 star3(钻石只在段4)。
   grantFocusLoot: F3 核定授予流 — 余量>0 静默忽略并标 full; DOM 不直测。 */

/* LCG 首骰预言: 只复现第一个骰值(非兜底路径首骰即 p 骰), 不复现选择逻辑 */
function lootFirstRoll(seed) {
  return ((seed * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/* 段位造档: 直接取真实关卡表(段1 L5=tier2 · 段2 L25=tier6 · 段3 L50=tier11
   · 段4 L75=tier16), 与运行时同源不手搓 */
function stageLevel(fp, s) {
  /* 六维编排(2026-10)的段代表关: k=i-6 与旧五维 k=i-5 同值取参 —
     [6,26,51,76] 的 k=[0,20,45,70] 与旧 [5,25,50,75] 完全一致(dim/tier/params 等价) */
  return fp.FOCUS_LEVELS[[6, 26, 51, 76][s - 1]];
}

test('rollFocusLoot: 教学关豁免 + 错误试次只奖不罚 — 恒无掉落', () => {
  const {fp} = loadFocus();
  const L0 = fp.FOCUS_LEVELS[0];
  for (const seed of [1, 7, 42, 99, 12345]) {
    assert.strictEqual(fp.rollFocusLoot(L0, {ok: true, dry: 99, seed}),
        null, '教学关干燥兜底也不掉(零压力), seed=' + seed);
    assert.strictEqual(fp.rollFocusLoot(stageLevel(fp, 4), {ok: false, dry: 99, seed}),
        null, '错误试次永不掉(只奖不罚), seed=' + seed);
    assert.strictEqual(fp.rollFocusLoot(stageLevel(fp, 4), {dry: 0, seed}),
        null, '缺 ok 不掷(防御: 调用方必传布尔)');
  }
});

test('rollFocusLoot: seed 缺省回落 Math.random — 有掉有不掉且产物不恒定(NaN 回归)', () => {
  const {fp} = loadFocus();
  const L = stageLevel(fp, 2); /* 段2(L26 flanker tier6, 16 试次) p_eff=0.09×18/16≈0.101: 200 掷两分支都充分 */
  const poolIds = Object.keys(fp.rewardStageFor(L.tier).pool);
  let sawDrop = 0; let sawNull = 0;
  const distinct = new Set();
  for (let i = 0; i < 200; i++) {
    // 不传 seed = 运行时真实路径(modes/focus.js 调用点); 曾因缺省不回落
    // 致 LCG 产 NaN: 掉率虚涨 100% 且 CampCore.pickWeighted 恒掉池末一键
    const got = fp.rollFocusLoot(L, {ok: true, dry: 0});
    if (got === null) sawNull++;
    else {
      sawDrop++;
      assert.ok(poolIds.includes(got), '缺省 seed 产物∈段2 池: got=' + got);
      distinct.add(got);
    }
  }
  assert.ok(sawNull > 100, '200 掷必有大量未中(NaN 时 100% 掉): 不掉 ' + sawNull);
  assert.ok(sawDrop > 5, '200 掷必有命中: 掉 ' + sawDrop);
  assert.ok(distinct.size >= 2, '产物不恒为池末一键: ' + [...distinct].join(','));
});

test('rollFocusLoot: 段位变率边界种子锁定 — 首骰对 p_eff 边界, 产物在段池内', () => {
  const {fp} = loadFocus();
  /* 每段一个代表关, p_eff = 段位 p × REF/该关期望试次; 首骰<p_eff 必掉∈段池,
     首骰≥p_eff 不掉 — LCG 首骰值由 lootFirstRoll 独立预言, 断言掉/不掉与产物归属 */
  for (const s of [1, 2, 3, 4]) {
    const L = stageLevel(fp, s);
    const st = fp.rewardStageFor(L.tier);
    const poolIds = Object.keys(st.pool);
    const pEff = st.p * fp.FOCUS_REWARD_TRIAL_REF / fp.rewardTrialCount(L);
    let sawDrop = 0; let sawNull = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const wantDrop = lootFirstRoll(seed) < pEff;
      const got = fp.rollFocusLoot(L, {ok: true, dry: 0, seed});
      if (wantDrop) {
        sawDrop++;
        assert.ok(poolIds.includes(got), '段' + s + ' 首骰<p_eff 必掉且产物∈段池: seed=' + seed + ' got=' + got);
      } else {
        sawNull++;
        assert.strictEqual(got, null, '段' + s + ' 首骰≥p_eff 不掉: seed=' + seed);
      }
    }
    assert.ok(sawDrop >= 3 && sawNull >= 3, '段' + s + ' 两分支都有覆盖(掉 ' + sawDrop + ' / 不掉 ' + sawNull + ')');
  }
  /* 递增性: 四段 p 单调递增 — 变率幅度随进度逐级增加(奖励调优核心诉求) */
  let prev = 0;
  for (const st of fp.FOCUS_REWARD_STAGES) {
    assert.ok(st.p > prev, '段位 p 递增: ' + st.p + ' > ' + prev);
    prev = st.p;
  }
});

test('rollFocusLoot: 试次归一 — corsi(6 序列)与 cpt(约 20 试次)每关期望产次趋同', () => {
  const {fp} = loadFocus();
  const L75 = stageLevel(fp, 4);
  const st = fp.rewardStageFor(L75.tier);
  const poolIds = Object.keys(st.pool);
  const roll = (dim) => {
    let hits = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const got = fp.rollFocusLoot(L75, {ok: true, dry: 0, dim, seed});
      if (got !== null) {
        hits++;
        assert.ok(poolIds.includes(got), '产物∈段4 池: ' + got);
      }
    }
    return hits;
  };
  const cptHits = roll('cpt');
  const corsiHits = roll('corsi');
  /* 未归一时 corsi 与 cpt 的 p_eff 相同(命中≈1/3); 归一后 corsi 命中显著更高 */
  assert.ok(corsiHits > cptHits * 1.5,
      'corsi 归一命中(' + corsiHits + ')显著高于 cpt(' + cptHits + ') — 记忆维度关不恒穷');
});

test('rollFocusLoot: 干燥兜底 — 关内连续答对未掉满阈值, 下一答对必得(不掷 p)', () => {
  const {fp} = loadFocus();
  const L = stageLevel(fp, 1); /* 段1 p_eff≈0.064 最低: 兜底在此最有价值 */
  const st = fp.rewardStageFor(L.tier);
  const poolIds = Object.keys(st.pool);
  for (const seed of [1, 7, 42, 99, 12345, 99991]) {
    const got = fp.rollFocusLoot(L, {ok: true, dry: fp.FOCUS_REWARD_DRY, seed});
    assert.ok(poolIds.includes(got), 'dry 达阈值跳过掷骰必得且∈段池: seed=' + seed + ' got=' + got);
    const near = fp.rollFocusLoot(L, {ok: true, dry: fp.FOCUS_REWARD_DRY - 1, seed});
    if (near !== null) assert.ok(poolIds.includes(near), '阈值前一档产物∈段池(防御)');
  }
  let sawNullNear = 0;
  for (let seed = 1; seed <= 60; seed++) {
    if (fp.rollFocusLoot(L, {ok: true, dry: fp.FOCUS_REWARD_DRY - 1, seed}) === null) sawNullNear++;
  }
  assert.ok(sawNullNear > 40, '阈值前一档走普通掷骰(段1 大多不掉): ' + sawNullNear);
});

test('rollFocusLoot: 未知维度补注不炸 — 归一回落基准, 产物仍在段池', () => {
  const {fp} = loadFocus();
  const L = stageLevel(fp, 3);
  const poolIds = Object.keys(fp.rewardStageFor(L.tier).pool);
  for (const seed of [1, 42, 999]) {
    const got = fp.rollFocusLoot(L, {ok: true, dry: 0, dim: '???', seed});
    assert.ok(got === null || poolIds.includes(got), '未知 dim 不炸, 产物∈段池或 null');
  }
});

test('levelBonusLoot: 未通过/教学关不发; 各段通关按表展开, 三星追加段位升档', () => {
  const {fp} = loadFocus();
  /* 返回数组克隆回本 realm 再断言(先例: focusDispatch 测试的跨 realm 注) */
  assert.deepStrictEqual([...fp.levelBonusLoot(false, 0, stageLevel(fp, 1))], [], '未通过不发');
  assert.deepStrictEqual([...fp.levelBonusLoot(false, 3, stageLevel(fp, 4))], [], '未通过即使三星口径也不发');
  assert.deepStrictEqual([...fp.levelBonusLoot(true, 0, fp.FOCUS_LEVELS[0])], [], '教学关通关也不发(零压力)');
  /* 段1: 固定 torch 单件; 三星追加固定 coal */
  for (const seed of [1, 7, 42, 99]) {
    assert.deepStrictEqual([...fp.levelBonusLoot(true, 1, stageLevel(fp, 1), {seed})], ['torch'], '段1 通关固定 torch');
    assert.deepStrictEqual([...fp.levelBonusLoot(true, 3, stageLevel(fp, 1), {seed})],
        ['torch', 'coal'], '段1 三星 +coal');
  }
  /* 段2: torch|apple 二选一; 三星 +coal */
  let sawTorch = false; let sawApple = false;
  for (let seed = 1; seed <= 40; seed++) {
    const one = [...fp.levelBonusLoot(true, 1, stageLevel(fp, 2), {seed})];
    assert.strictEqual(one.length, 1, '段2 通关恰 1 件');
    assert.ok(one[0] === 'torch' || one[0] === 'apple', '段2 二选一: ' + one[0]);
    if (one[0] === 'torch') sawTorch = true; else sawApple = true;
    const three = [...fp.levelBonusLoot(true, 3, stageLevel(fp, 2), {seed})];
    assert.deepStrictEqual(three[1], 'coal', '段2 三星追加固定 coal');
  }
  assert.ok(sawTorch && sawApple, '40 种子覆盖段2 二选一两个分支');
  /* 段3: apple|bread 二选一; 三星 +gold_ingot(金带级首见) */
  for (let seed = 1; seed <= 40; seed++) {
    const one = [...fp.levelBonusLoot(true, 1, stageLevel(fp, 3), {seed})];
    assert.strictEqual(one.length, 1, '段3 通关恰 1 件');
    assert.ok(one[0] === 'apple' || one[0] === 'bread', '段3 二选一: ' + one[0]);
    const three = [...fp.levelBonusLoot(true, 3, stageLevel(fp, 3), {seed})];
    assert.deepStrictEqual(three[1], 'gold_ingot', '段3 三星追加金锭(金带级首见)');
  }
  /* 段4: (bread|apple)+固定 iron_ore 两件; 三星 +diamond(钻石唯一入口) */
  for (let seed = 1; seed <= 40; seed++) {
    const one = [...fp.levelBonusLoot(true, 1, stageLevel(fp, 4), {seed})];
    assert.strictEqual(one.length, 2, '段4 通关两件(幅度顶格)');
    assert.ok(one[0] === 'bread' || one[0] === 'apple', '段4 首件二选一: ' + one[0]);
    assert.deepStrictEqual(one[1], 'iron_ore', '段4 第二件固定铁矿(钻带级)');
    const three = [...fp.levelBonusLoot(true, 3, stageLevel(fp, 4), {seed})];
    assert.deepStrictEqual(three[2], 'diamond', '段4 三星追加钻石 — 全表唯一钻石入口');
  }
  /* 品质红线: 段1-2 任何口径(含三星)不产金/钻; 段1-3 不产钻 */
  for (let seed = 1; seed <= 60; seed++) {
    for (const stars of [1, 3]) {
      for (const s of [1, 2]) {
        const got = [...fp.levelBonusLoot(true, stars, stageLevel(fp, s), {seed})];
        assert.ok(!got.includes('gold_ingot') && !got.includes('diamond'), '段' + s + ' 无金无钻');
      }
      for (const s of [1, 2, 3]) {
        const got = [...fp.levelBonusLoot(true, stars, stageLevel(fp, s), {seed})];
        assert.ok(!got.includes('diamond'), '段' + s + ' 无钻石');
      }
    }
  }
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

/* ============ B2/B5 派生纯函数 + B6 奖励判定 + 日期单点出口 ============ */

test('focusTodayStr: 委托唯一日期拼装点, 时间戳注入且无前导零', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.focusTodayStr(new Date(2026, 9, 5).getTime()), '2026-10-5');
  assert.strictEqual(fp.focusTodayStr(new Date(2030, 11, 31).getTime()), '2030-12-31');
});

test('milestoneLevels: 门槛升序唯一派生出口, 与 FOCUS_MILESTONES 表一致', () => {
  const {fp} = loadFocus();
  const rows = [...fp.milestoneLevels()];
  assert.deepStrictEqual(rows.map((e)=>e.line), [10, 30, 50, 70, 90, 100], '门槛升序');
  assert.deepStrictEqual(rows.map((e)=>e.id),
      ['pick_wood', 'pick_stone', 'pick_iron', 'sword_iron', 'pick_diamond', 'sword_diamond']);
});

test('focusTodayDims: 从待打关取今日额度内将轮到的维度, 去重至多 2 个', () => {
  const {fp} = loadFocus();
  assert.deepStrictEqual([...fp.focusTodayDims(0, 2)], ['cpt', 'gonogo'], '教学关前两关');
  assert.deepStrictEqual([...fp.focusTodayDims(5, 2)], ['search', 'cpt'], '第 6 关(教学末关)起进螺旋: search→cpt');
  assert.deepStrictEqual([...fp.focusTodayDims(5, 1)], ['search'], '额度 1 只取 1 个');
  assert.deepStrictEqual([...fp.focusTodayDims(99, 6)], ['search'], '第 100 关大师 dim=search');
  assert.deepStrictEqual([...fp.focusTodayDims(0, 0)], [], '今日额度耗尽返回空');
  assert.deepStrictEqual([...fp.focusTodayDims(-3, 2)], ['cpt', 'gonogo'], '负 unlocked 钳到 0');
});

test('focusDimStars: 六维齐全, 按关卡号归维求和, 重玩取历史最高不稀释', () => {
  const {fp} = loadFocus();
  const left = fp.focusDimStars({stars: {'0': 3, '1': 2, '5': 1, '99': 3}});
  assert.deepStrictEqual({...left}, {cpt: 3, gonogo: 2, flanker: 0, corsi: 0, switch: 0, search: 4},
      'i=5 教学末关=search(1 星), i=99 master dim=search(3 星)');
  assert.deepStrictEqual({...fp.focusDimStars({})}, {cpt: 0, gonogo: 0, flanker: 0, corsi: 0, switch: 0, search: 0},
      '空档六维占位');
  assert.deepStrictEqual({...fp.focusDimStars(null)}, {cpt: 0, gonogo: 0, flanker: 0, corsi: 0, switch: 0, search: 0},
      '空档安全');
});

test('focusLastBreakthrough: history 最近一条通过记录的维度, 无记录/坏索引返回 null', () => {
  const {fp} = loadFocus();
  const save = {history: [{i: 0, passed: true}, {i: 1, passed: false}, {i: 2, passed: true}]};
  assert.strictEqual(fp.focusLastBreakthrough(save), 'flanker', '跳过未通过, 取最近通过关');
  assert.strictEqual(fp.focusLastBreakthrough({history: []}), null, '无记录 null');
  assert.strictEqual(fp.focusLastBreakthrough({history: [{i: 999, passed: true}]}), null, '坏索引跳过');
  assert.strictEqual(fp.focusLastBreakthrough(null), null, '空档安全');
});

test('stampRewardClaimed: 已领线集合里按奖励 id 判定(皮肤/烟花恢复与触发同口径)', () => {
  const {fp} = loadFocus();
  assert.strictEqual(fp.stampRewardClaimed([3, 7], 'bag_skin'), true, '7 章线已领皮肤');
  assert.strictEqual(fp.stampRewardClaimed([3], 'bag_skin'), false, '只领 3 章线未领皮肤');
  assert.strictEqual(fp.stampRewardClaimed([14], 'firework'), true, '14 章线烟花');
  assert.strictEqual(fp.stampRewardClaimed([30, 60], 'gold_stamp'), true, '30/60 都归金图章');
  assert.strictEqual(fp.stampRewardClaimed(null, 'bag_skin'), false, '空集合安全');
});

/* ============ 存档迁移幂等(F11: modes/focus slot 与库层共用) ============ */

test('migrateFocusSave: 摘 v0 daily / 补 tools·stampKind / 坏 stampKind 回落 / 连跑幂等', () => {
  const {fp} = loadFocus();
  for (const k of ['unlocked', 'stars', 'history', 'tools', 'stamps', 'stampClaimed',
    'stampKind', 'checks', 'devil']) {
    assert.ok(hasOwn(fp.FOCUS_SAVE_DEFAULTS, k), 'defaults 形状含 ' + k);
  }
  assert.strictEqual(fp.FOCUS_SAVE_DEFAULTS.stampKind, 'pick', '缺省镐章');
  const old = {_v: 0, daily: {date: '2026-10-22', played: 2}, unlocked: 53,
    stars: {'0': 3}, stampKind: 'ruby'};
  const once = fp.migrateFocusSave(old, 0);
  assert.strictEqual(hasOwn(once, 'daily'), false, 'v0 老形状的 daily 字段被摘除');
  assert.deepStrictEqual([...once.tools], [], '缺 tools 补空数组');
  assert.strictEqual(once.stampKind, 'pick', '损坏 stampKind 回落 pick');
  assert.strictEqual(once.unlocked, 53, '存量进度原样保留');
  assert.strictEqual(once.stars['0'], 3, '星级原样保留');
  const twice = fp.migrateFocusSave(once, 0);
  assert.strictEqual(twice, once, '原地迁移返回同一对象');
  assert.strictEqual(hasOwn(twice, 'daily'), false, '第二次仍无 daily');
  assert.deepStrictEqual([...twice.tools], [], '第二次不重复追加 tools');
  assert.strictEqual(twice.stampKind, 'pick', '第二次保持回落值(幂等)');
  const missing = fp.migrateFocusSave({unlocked: 0}, 0);
  assert.deepStrictEqual([...missing.tools], [], '缺 tools 补齐');
  assert.strictEqual(missing.stampKind, 'pick', '缺 stampKind 补齐');
  const legal = fp.migrateFocusSave({tools: ['pick_wood'], stampKind: 'gem'}, 1);
  assert.strictEqual(legal.stampKind, 'gem', '合法三选一图案保留');
  assert.deepStrictEqual([...legal.tools], ['pick_wood'], '已有 tools 不重置');
  assert.strictEqual(fp.migrateFocusSave({stampKind: 'bad'}, 1).stampKind, 'pick',
      '从 v1 起跑同样修形(旧档损坏字段兜底)');
});
