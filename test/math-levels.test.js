'use strict';
/* 数学冒险岛关卡库纯逻辑单测 — node --test (零依赖)
   运行: node --test test/math-levels.test.js
   覆盖: 六族元数据/变体表(3 常规+1 挑战) · mathParamsFor 双轨曲线
   (数值轨带内微升永不越带 · 推理轨分段单调 · 定性跳变概率坡道 ·
   认知负荷红线 组块≤4/线索≤3/每关只动一个维度) · 100 关编排不变量
   (四带×25 · 配重 15/20 · 带内末次=挑战 · 带末 boss · 带首复习) ·
   通过门槛/三星(挑战挂钩与回溯) · 战利品池合法性/掷骰概率边界
   (池概率和=1 · 教学豁免 · 连对保底 · 同 seed 同输出) · 存档迁移幂等
   加载器: vm context 依次执行 items-core.js + inventory-core.js +
   math-levels.js, 镜像浏览器 <script defer> 共享词法环境(相对序同
   index.html); 图标/日期串以 stub 注入(focus-paradigms.test.js 同款) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function loadMathLevels() {
  const sandbox = {
    console, Math, JSON, Object, Array, Date, Number,
    /* 依赖注入: MATH_META 图标构造期解析 mcIcon(focus-icons.js, 加载序在前);
       mathTodayStr 调用期解析 budgetDateStr(daily-budget.js 的唯一拼装点) */
    mcIcon: (n) => 'data:icon:' + n,
    budgetDateStr(t) {
      const d = new Date(t);
      return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  /* inventory-core(授予流语义)排在 math-levels 之前 — 与 index.html 相对序一致 */
  for (const f of ['items-core.js', 'inventory-core.js', 'math-levels.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__ml = { MATH_FAMILIES, MATH_META, MATH_VARIANTS, MATH_RANGES,
      MATH_CONTEXTS, mathParamsFor, MATH_LEVELS, mathPassed, mathStars, MATH_LOOT,
      rollMathLoot, grantMathLoot, MATH_LOG_KEEP_DAYS,
      mathTodayStr, mathDayIndex, trimMathLog,
      MATH_STAMP_KINDS, MATH_STAMP_DAILY, MATH_STAMP_REWARDS, MATH_STAMP_REWARD_TEXT,
      MATH_STAMP_KEEP_DAYS, mathStampRecord, mathStampTrim, mathStampCount,
      mathStampMilestones, mathStampRewardsDue, mathStampRewardFor, mathStampNextLine,
      MATH_SAVE_DEFAULTS, migrateMathSave,
      add, mkInventory, count, INV_SLOTS, ITEMS, stackMax };
  `, ctx);
  return sandbox.__ml;
}

/* 浮点近似比较(曲线端点/档位概率来自设计稿字面值, 容 1e-9 舍入) */
function near(actual, want, msg) {
  assert.ok(Math.abs(actual - want) < 1e-9, (msg || '') + ' 期望 ' + want + ', 实为 ' + actual);
}
/* 某参数在 tier 1..19 上的整条曲线 */
function tierCurve(ml, family, key) {
  return Array.from({length: 19}, (_, k) => ml.mathParamsFor(family, k + 1)[key]);
}

/* ============ 100 关螺旋编排不变量(design §4.1 / plan §7) ============ */

test('MATH_LEVELS: 共 100 关 = 四带×25, 带 0 前六关教学(六族序), 带末 boss', () => {
  const ml = loadMathLevels();
  const L = ml.MATH_LEVELS;
  assert.strictEqual(L.length, 100);
  for (let i = 0; i < 100; i++) {
    const band = Math.floor(i/25);
    assert.strictEqual(L[i].i, i, '关卡号连续');
    assert.strictEqual(L[i].band, band, '第 ' + (i+1) + ' 关属带 ' + band);
    assert.ok(ml.MATH_FAMILIES.includes(L[i].family), '每关归属六族之一');
    assert.ok(typeof L[i].variant === 'string', '每关带变体 id');
    assert.ok(L[i].params && typeof L[i].params === 'object', '每关带参数');
    assert.ok(L[i].tier >= 1 && L[i].tier <= 19, 'tier 顶格 19 截断');
  }
  for (let j = 0; j < 6; j++) {
    const lv = L[j];
    assert.strictEqual(lv.kind, 'tutorial', '带 0 第 ' + (j+1) + ' 关为教学');
    assert.strictEqual(lv.tier, 1);
    assert.strictEqual(lv.family, ml.MATH_FAMILIES[j], '教学关按六族顺序');
  }
  for (let b = 0; b < 4; b++) {
    const boss = L[b*25 + 24];
    assert.strictEqual(boss.kind, 'boss', '带 ' + b + ' 末关为 boss');
    assert.strictEqual(boss.band, b);
  }
});

test('MATH_LEVELS: 带 1~3 带首两关复习(kind=review, tier=上一带顶档), 带 0 无复习', () => {
  const ml = loadMathLevels();
  const L = ml.MATH_LEVELS;
  for (let j = 0; j < 2; j++) {
    assert.strictEqual(L[j].kind, 'tutorial', '带 0 无复习(教学开局)');
  }
  for (let b = 1; b < 4; b++) {
    for (let j = 0; j < 2; j++) {
      const rv = L[b*25 + j];
      assert.strictEqual(rv.kind, 'review', '带 ' + b + ' 第 ' + (j+1) + ' 关为复习');
      assert.strictEqual(rv.tier, b*4, '复习回访上一带顶档(tier=' + b*4 + ')');
      assert.ok(['craft', 'hop'].includes(rv.family), '复习落在数与运算主线族');
    }
  }
  /* 全表 review 恰 6 关(带 1~3 各 2), 其余 kind 分布锁定 */
  const kinds = {};
  for (const lv of L) kinds[lv.kind] = (kinds[lv.kind] || 0) + 1;
  assert.strictEqual(kinds.review, 6);
  assert.strictEqual(kinds.tutorial, 6);
  assert.strictEqual(kinds.boss, 4);
  assert.strictEqual(kinds.challenge, 24, '六族×四带各一挑战关');
  assert.strictEqual(kinds.normal, 60);
});

test('MATH_LEVELS: 六族配重 count/mirror/plan/pattern=15, craft/hop=20(主线略高)', () => {
  const ml = loadMathLevels();
  const want = {count: 15, craft: 20, hop: 20, mirror: 15, plan: 15, pattern: 15};
  const got = {};
  for (const f of ml.MATH_FAMILIES) got[f] = 0;
  for (const lv of ml.MATH_LEVELS) got[lv.family]++;
  assert.deepStrictEqual(got, want, '配重口径: 教学/复习/挑战/boss 都计入族账(boss 记 sections 首族)');
});

test('MATH_LEVELS: 每族每带末次轮转出现=挑战关(★★), tier=band*4+带内第几次出现', () => {
  const ml = loadMathLevels();
  const L = ml.MATH_LEVELS;
  const challengeVariant = (f) => ml.MATH_VARIANTS[f].find((v) => v.kind === 'challenge').id;
  for (let b = 0; b < 4; b++) {
    for (const f of ml.MATH_FAMILIES) {
      /* 轮转流 = 教学关+normal+challenge(复习/boss 是带外加固, 不占轮转) */
      const occ = [];
      for (let j = 0; j < 25; j++) {
        const lv = L[b*25 + j];
        if (lv.family === f && lv.kind !== 'review' && lv.kind !== 'boss') occ.push(lv);
      }
      assert.ok(occ.length >= 3 && occ.length <= 4,
          f + ' 带 ' + b + ' 轮转出现 3~4 次, 实为 ' + occ.length);
      const last = occ[occ.length - 1];
      assert.strictEqual(last.kind, 'challenge', f + ' 带 ' + b + ' 末次出现=挑战');
      assert.strictEqual(last.variant, challengeVariant(f), '挑战关用该族 ★★ 变体');
      for (let n = 0; n < occ.length; n++) {
        assert.strictEqual(occ[n].tier, Math.min(19, b*4 + n + 1),
            f + ' 带 ' + b + ' 第 ' + (n+1) + ' 次出现 tier=band*4+k');
      }
    }
  }
  /* 挑战关自身 24 关全部 kind=challenge 且变体正确(上面已顺带断言变体) */
});

test('MATH_LEVELS: 常规关变体轮换 — 每族三个常规范型全部出场', () => {
  const ml = loadMathLevels();
  for (const f of ml.MATH_FAMILIES) {
    const regular = ml.MATH_VARIANTS[f].filter((v) => v.kind !== 'challenge').map((v) => v.id);
    const seen = new Set();
    for (const lv of ml.MATH_LEVELS) {
      if (lv.family === f && (lv.kind === 'normal' || lv.kind === 'review')) seen.add(lv.variant);
    }
    for (const id of regular) {
      assert.ok(seen.has(id), f + ' 常规变体 ' + id + ' 有出场');
    }
    assert.ok(!seen.has(ml.MATH_VARIANTS[f].find((v) => v.kind === 'challenge').id),
        f + ' 挑战变体只出现在挑战关');
  }
});

test('MATH_LEVELS: boss 三族★★串联 sections(对齐 focus 大师关先例), 名义族=首节族', () => {
  const ml = loadMathLevels();
  const challengeVariant = (f) => ml.MATH_VARIANTS[f].find((v) => v.kind === 'challenge').id;
  for (let b = 0; b < 4; b++) {
    const boss = ml.MATH_LEVELS[b*25 + 24];
    assert.ok(Array.isArray(boss.sections) && boss.sections.length === 3,
        '带 ' + b + ' boss 三段串联');
    const fams = boss.sections.map((s) => s.family);
    assert.strictEqual(new Set(fams).size, 3, '三节三族不重');
    assert.strictEqual(boss.family, fams[0], 'boss 记账在 sections 首族(配重口径)');
    assert.ok(['craft', 'hop'].includes(boss.family), 'boss 名义族在主线族(配重 20 的两个)');
    for (const sec of boss.sections) {
      assert.strictEqual(sec.variant, challengeVariant(sec.family), '各节=该族 ★★ 变体');
      assert.ok(sec.params && typeof sec.params === 'object', '各节带参数');
      /* 节 tier = 该族该带挑战关的 tier(同带同难度口径) */
      const chal = ml.MATH_LEVELS.find((lv) =>
        lv.band === b && lv.family === sec.family && lv.kind === 'challenge');
      assert.ok(chal, sec.family + ' 带 ' + b + ' 有挑战关(节参数取同档)');
      assert.strictEqual(sec.tier, chal.tier);
    }
    /* 偶带/奇带轮换覆盖全部六族(两带一轮) */
  }
  const evenFams = ml.MATH_LEVELS[24].sections.map((s) => s.family).sort();
  const oddFams = ml.MATH_LEVELS[49].sections.map((s) => s.family).sort();
  assert.deepStrictEqual([...evenFams, ...oddFams].sort(), [...ml.MATH_FAMILIES].sort(),
      '带 0/带 1 的 boss 六族全覆盖(后续两带重复该组合)');
});

test('MATH_LEVELS: 每关 params 由该族该 tier 曲线生成(与 mathParamsFor 同源)', () => {
  const ml = loadMathLevels();
  for (const lv of ml.MATH_LEVELS) {
    const p = ml.mathParamsFor(lv.family, lv.tier, lv.i);
    assert.deepStrictEqual({...lv.params}, {...p},
        '第 ' + (lv.i+1) + ' 关参数与曲线一致');
  }
});

/* ============ 通过门槛 / 三星(design §4.2, 挑战挂钩 plan D4) ============ */

test('mathPassed: 教学关恒过, 常规/复习 70% 门槛, 挑战 80%, boss 聚合按单关口径', () => {
  const ml = loadMathLevels();
  const tut = ml.MATH_LEVELS[0];
  assert.strictEqual(tut.kind, 'tutorial');
  assert.strictEqual(ml.mathPassed(tut, {acc: 0}), true, '教学关零分也过(零压力)');
  const norm = ml.MATH_LEVELS.find((lv) => lv.kind === 'normal');
  assert.strictEqual(ml.mathPassed(norm, {acc: 0.69}), false, '常规 69% 不通过');
  assert.strictEqual(ml.mathPassed(norm, {acc: 0.70}), true, '常规 70% 边界通过');
  const rev = ml.MATH_LEVELS.find((lv) => lv.kind === 'review');
  assert.strictEqual(ml.mathPassed(rev, {acc: 0.70}), true, '复习关同常规口径');
  const chal = ml.MATH_LEVELS.find((lv) => lv.kind === 'challenge');
  assert.strictEqual(ml.mathPassed(chal, {acc: 0.79}), false, '挑战 79% 不通过(附加题水平)');
  assert.strictEqual(ml.mathPassed(chal, {acc: 0.80}), true, '挑战 80% 边界通过');
  const boss = ml.MATH_LEVELS.find((lv) => lv.kind === 'boss');
  assert.strictEqual(ml.mathPassed(boss, {acc: 0.69}), false);
  assert.strictEqual(ml.mathPassed(boss, {acc: 0.70}), true, 'boss 聚合三段按单关 70% 口径');
});

test('mathStars: 1星通过 / 2星 85% / 3星 95%且无连续3错且该族当带挑战已过(注入)', () => {
  const ml = loadMathLevels();
  const norm = ml.MATH_LEVELS.find((lv) => lv.kind === 'normal');
  const good = {acc: 0.96, maxStreakErr: 1};
  assert.strictEqual(ml.mathStars(norm, {acc: 0.69}, true), 0, '未通过=0 星(1星=通过)');
  assert.strictEqual(ml.mathStars(norm, {acc: 0.70}, false), 1);
  assert.strictEqual(ml.mathStars(norm, {acc: 0.85}, false), 2, '2星不看挑战挂钩');
  assert.strictEqual(ml.mathStars(norm, good, false), 2, '未过挑战封顶 2 星');
  assert.strictEqual(ml.mathStars(norm, good, true), 3, '挑战已过点亮第三星(回溯点亮)');
  assert.strictEqual(ml.mathStars(norm, {acc: 0.95, maxStreakErr: 3}, true), 2, '连续 3 错摘第三星');
  assert.strictEqual(ml.mathStars(norm, {acc: 0.94, maxStreakErr: 0}, true), 2, '95% 边界差一口');
  assert.strictEqual(ml.mathStars(ml.MATH_LEVELS[0], {acc: 1}, true), 0, '教学关不计星');
  /* 挑战/boss 关自身不受挂钩注入约束(过关即自成条件) */
  const chal = ml.MATH_LEVELS.find((lv) => lv.kind === 'challenge');
  assert.strictEqual(ml.mathStars(chal, {acc: 0.96, maxStreakErr: 0}, false), 3,
      '挑战关三星不要求 famChallengeDone(它就是那个条件)');
  const boss = ml.MATH_LEVELS.find((lv) => lv.kind === 'boss');
  assert.strictEqual(ml.mathStars(boss, {acc: 0.96, maxStreakErr: 0}, false), 3, 'boss 同');
});

/* ============ 战利品表与掷骰(design §5, ADR 0002 经济口径) ============ */

test('MATH_LOOT: 六族主题池概率和=1, id 全在 ITEMS 注册可入包, 稀有权重低', () => {
  const ml = loadMathLevels();
  assert.strictEqual(Object.keys(ml.MATH_LOOT).length, 6, '六族各一池');
  for (const f of ml.MATH_FAMILIES) {
    const loot = ml.MATH_LOOT[f];
    let sum = 0;
    for (const id of Object.keys(loot.pool)) {
      sum += loot.pool[id];
      assert.ok(ml.ITEMS[id], f + ' 池的 ' + id + ' 必须在 ITEMS 注册');
      assert.ok(ml.stackMax(id) > 0, id + ' 可入包堆叠');
    }
    assert.ok(Math.abs(sum - 1) < 1e-9, f + ' 池概率和=1, 实为 ' + sum);
    assert.ok(Object.keys(loot.pool).length >= 3, f + ' 池至少三件');
    assert.ok(loot.rare.length >= 1, f + ' 有稀有保底清单');
    for (const rid of loot.rare) {
      assert.ok(hasOwn(loot.pool, rid), f + ' 稀有件 ' + rid + ' 来自本族池');
      assert.ok(loot.pool[rid] <= 0.2, rid + ' 稀有权重低(≤0.2)');
    }
  }
});

/* LCG 首骰独立预言(与实现同常数 — 同 seed 同输出的对照源) */
function lootFirstRoll(seed) {
  let s = seed;
  s = (s*1103515245 + 12345) % 2147483648;
  return s/2147483648;
}

test('rollMathLoot: 教学关豁免 + 答错只奖不罚 — 恒无掉落', () => {
  const ml = loadMathLevels();
  const tut = ml.MATH_LEVELS[0];
  for (const seed of [1, 7, 42, 99, 12345]) {
    assert.strictEqual(ml.rollMathLoot(tut, {ok: true, streak: 99, seed}),
        null, '教学关连对保底也不掉(零压力), seed=' + seed);
    const norm = ml.MATH_LEVELS.find((lv) => lv.kind === 'normal');
    assert.strictEqual(ml.rollMathLoot(norm, {ok: false, streak: 99, seed}),
        null, '答错永不掉(只奖不罚), seed=' + seed);
  }
});

test('rollMathLoot: 正确试次 p=0.45 掷骰 — 首骰边界种子锁定, 产物在本族池', () => {
  const ml = loadMathLevels();
  const norm = ml.MATH_LEVELS.find((lv) => lv.kind === 'normal');
  const poolIds = Object.keys(ml.MATH_LOOT[norm.family].pool);
  let sawDrop = 0; let sawNull = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const got = ml.rollMathLoot(norm, {ok: true, streak: 1, seed}); // 非 3 倍走 p 掷骰
    if (lootFirstRoll(seed) < 0.45) {
      sawDrop++;
      assert.ok(poolIds.includes(got), '首骰<0.45 必掉且∈本族池: seed=' + seed + ' got=' + got);
    } else {
      sawNull++;
      assert.strictEqual(got, null, '首骰≥0.45 不掉: seed=' + seed);
    }
  }
  assert.ok(sawDrop >= 3 && sawNull >= 3, '两分支都有覆盖(掉 ' + sawDrop + ' / 不掉 ' + sawNull + ')');
});

test('rollMathLoot: 连对每满 3 保底稀有 — 跳过 p 掷骰必得稀有件, 同 seed 同输出', () => {
  const ml = loadMathLevels();
  const norm = ml.MATH_LEVELS.find((lv) => lv.kind === 'normal');
  const rare = ml.MATH_LOOT[norm.family].rare;
  for (const seed of [1, 7, 42, 99, 12345, 99991]) {
    for (const streak of [3, 6, 9]) {
      const got = ml.rollMathLoot(norm, {ok: true, streak, seed});
      assert.ok(rare.includes(got), 'streak=' + streak + ' 保底稀有: got=' + got);
      assert.strictEqual(got, ml.rollMathLoot(norm, {ok: true, streak, seed}),
          '同 seed 同输出: seed=' + seed);
    }
    /* 3 倍前一档走普通掷骰(不白给) */
    const near = ml.rollMathLoot(norm, {ok: true, streak: 2, seed});
    assert.ok(near === null || Object.keys(ml.MATH_LOOT[norm.family].pool).includes(near),
        'streak=2 无保底(掷骰口径)');
  }
});

test('rollMathLoot: seed 缺省回落 Math.random — 有掉有不掉且产物不恒定(NaN 回归)', () => {
  const ml = loadMathLevels();
  const norm = ml.MATH_LEVELS.find((lv) => lv.kind === 'normal');
  const poolIds = Object.keys(ml.MATH_LOOT[norm.family].pool);
  let sawDrop = 0; let sawNull = 0;
  const distinct = new Set();
  for (let i = 0; i < 200; i++) {
    // 不传 seed = 运行时真实路径(modes 层调用点); 缺省不回落则 LCG 产 NaN:
    // 掉率虚涨 100% 且取件恒掉池末一键(focus mkLootRand 同款回归)
    const got = ml.rollMathLoot(norm, {ok: true, streak: 1});
    if (got === null) sawNull++;
    else {
      sawDrop++;
      assert.ok(poolIds.includes(got), '缺省 seed 产物∈本族池: got=' + got);
      distinct.add(got);
    }
  }
  assert.ok(sawNull > 50, '200 掷必有大量未中(NaN 时 100% 掉): 不掉 ' + sawNull);
  assert.ok(sawDrop > 10, '200 掷必有命中(p=0.45): 掉 ' + sawDrop);
  assert.ok(distinct.size >= 2, '产物不恒为池末一键: ' + [...distinct].join(','));
});

test('grantMathLoot: 空包逐件入包(granted 全记); 满包余量>0 静默忽略并标 full', () => {
  const ml = loadMathLevels();
  const inv = ml.mkInventory();
  const r1 = ml.grantMathLoot(inv, ['coal', 'planks']);
  assert.deepStrictEqual({...r1, granted: [...r1.granted]}, {granted: ['coal', 'planks'], full: false});
  assert.strictEqual(ml.count(inv, 'coal'), 1, 'coal 已入包');
  assert.strictEqual(ml.count(inv, 'planks'), 1, 'planks 已入包');
  /* 塞满背包再授: 余量>0 的件静默忽略(不入 granted), 每关至多一次满包提示归模式层 */
  const full = ml.mkInventory();
  for (let s = 0; s < ml.INV_SLOTS; s++) ml.add(full, 'stone', 64);
  const r2 = ml.grantMathLoot(full, ['coal', 'dirt']);
  assert.deepStrictEqual({...r2, granted: [...r2.granted]}, {granted: [], full: true});
  assert.strictEqual(ml.count(full, 'coal'), 0, '满包件确实没进');
});

test('rollMathLoot: boss 小节最小 {family, kind} 对象照常掷骰(按小节族取池); null 关防御', () => {
  const ml = loadMathLevels();
  /* runMathBoss 的调用形状(T8 接线): 小节族各自主题化掉落 */
  const sec = {family: 'craft', kind: 'challenge'};
  const pool = Object.keys(ml.MATH_LOOT.craft.pool);
  let sawDrop = false;
  for (let seed = 1; seed < 60; seed++) {
    const got = ml.rollMathLoot(sec, {ok: true, streak: 0, seed});
    if (got) {
      sawDrop = true;
      assert.ok(pool.includes(got), 'boss 小节产物∈小节族池: got=' + got);
    }
  }
  assert.ok(sawDrop, '60 掷必有命中(p=0.45)');
  const mir = ml.rollMathLoot({family: 'mirror', kind: 'challenge'}, {ok: true, streak: 3, seed: 7});
  assert.strictEqual(mir, ml.MATH_LOOT.mirror.rare[0], '小节连对保底走小节族稀有件');
  assert.strictEqual(ml.rollMathLoot(null, {ok: true, streak: 3, seed: 1}), null, 'null 关防御性无掉落');
});

/* ============ 存档形状与迁移(design §4.3) ============ */

test('MATH_SAVE_DEFAULTS/migrateMathSave: 形状齐全, 修形幂等, 存量进度保留', () => {
  const ml = loadMathLevels();
  for (const k of ['stars', 'challenge', 'stamps', 'stampClaimed', 'stampKind', 'log']) {
    assert.ok(hasOwn(ml.MATH_SAVE_DEFAULTS, k), 'defaults 形状含 ' + k);
  }
  const dflt = ml.MATH_SAVE_DEFAULTS;
  assert.deepStrictEqual(Object.keys(dflt).sort(),
      ['challenge', 'log', 'stampClaimed', 'stampKind', 'stamps', 'stars']);
  for (const k of ['stars', 'challenge', 'stamps', 'log']) {
    assert.ok(dflt[k] && typeof dflt[k] === 'object', 'defaults.' + k + ' 为对象');
  }
  assert.ok(Array.isArray(dflt.stampClaimed), 'defaults.stampClaimed 为数组(集章已领线)');
  assert.strictEqual(dflt.stampKind, 'gem', '缺省宝石章');
  const old = {unlocked: 42, stars: {'3': 2}, challenge: {'craft:1': true},
    stampKind: 7, log: 'broken'};
  const once = ml.migrateMathSave(old, 1);
  assert.strictEqual(once.unlocked, 42, '存量进度原样保留');
  assert.strictEqual(once.stars['3'], 2, '星级原样保留');
  assert.strictEqual(once.challenge['craft:1'], true, '挑战完成表原样保留');
  assert.strictEqual(typeof once.stampKind, 'string', '损坏 stampKind 修形为字符串');
  assert.ok(Array.isArray(once.stampClaimed), 'T8 老档缺 stampClaimed 幂等补 []');
  assert.deepStrictEqual({...once.log}, {}, '损坏 log 修形为空对象');
  const twice = ml.migrateMathSave(once, 1);
  assert.deepStrictEqual(twice, once, '连跑幂等(已是好形状再跑原样)');
  const null1 = ml.migrateMathSave(null, 1);
  assert.ok(null1 && typeof null1 === 'object', '空档安全');
});

test('存档日志滚动 90 天: mathDayIndex/trimMathLog 裁剪窗口与非法键', () => {
  const ml = loadMathLevels();
  assert.strictEqual(ml.MATH_LOG_KEEP_DAYS, 90);
  const idx = (y, m, d) => ml.mathDayIndex(y + '-' + m + '-' + d);
  assert.strictEqual(idx(2026, 10, 24) - idx(2026, 10, 1), 23, '同月日差');
  assert.strictEqual(idx(2026, 10, 1) - idx(2026, 9, 30), 1, '跨月连续');
  assert.strictEqual(idx(2027, 1, 1) - idx(2026, 12, 31), 1, '跨年连续');
  assert.ok(Number.isNaN(ml.mathDayIndex('broken')), '损坏串 NaN');
  const log = {};
  log['2026-10-24'] = {a: 1}; // 今天
  log['2026-10-1'] = {b: 2}; // 23 天前 — 保留
  log['2026-7-26'] = {c: 3}; // 90 天前 — 裁掉
  log['2026-7-27'] = {d: 4}; // 89 天前 — 保留
  log['not-a-date'] = {e: 5}; // 非法键 — 丢弃
  log['2026-12-1'] = {f: 6}; // 未来(时钟回拨) — 保留(零惩罚)
  const out = ml.trimMathLog(log, '2026-10-24', 90);
  assert.deepStrictEqual([...Object.keys(out)].sort(),
      ['2026-10-1', '2026-10-24', '2026-12-1', '2026-7-27']);
  assert.deepStrictEqual(log['2026-7-26'], {c: 3}, '不突变入参');
  assert.deepStrictEqual([...Object.keys(ml.trimMathLog(null, '2026-10-24', 90))], [], '空档安全');
  assert.strictEqual(ml.trimMathLog(log, 'broken', 90), log, 'today 非法原样返回(不清档)');
});

test('mathTodayStr: 委托 budgetDateStr 唯一拼装点, 注入时间戳且无前导零', () => {
  const ml = loadMathLevels();
  assert.strictEqual(ml.mathTodayStr(new Date(2026, 9, 5).getTime()), '2026-10-5');
  assert.strictEqual(ml.mathTodayStr(new Date(2030, 11, 31).getTime()), '2030-12-31');
});

/* ============ 图章一本(T8, 形态对齐 focus F7 但数据独立) ============ */

test('MATH_STAMP_*: 自选章图案三选一含缺省 gem, 达成线升序且奖励文案齐(观感奖励, 不解锁玩法)', () => {
  const ml = loadMathLevels();
  assert.ok(Array.isArray(ml.MATH_STAMP_KINDS) && ml.MATH_STAMP_KINDS.length === 3,
      '自选章图案三选一(与专注训练营的图章本独立)');
  assert.ok(ml.MATH_STAMP_KINDS.includes(ml.MATH_SAVE_DEFAULTS.stampKind),
      '缺省章图案在白名单内: ' + ml.MATH_SAVE_DEFAULTS.stampKind);
  assert.ok(ml.MATH_STAMP_DAILY.min === 1 && ml.MATH_STAMP_DAILY.big === 3,
      '当日 ≥1 关盖普通章, 满 3 关盖大章(与日限 6 关同量纲)');
  const lines = Object.keys(ml.MATH_STAMP_REWARDS).map(Number);
  assert.deepStrictEqual(lines, [...lines].sort((a, b) => a - b), '达成线升序');
  assert.strictEqual(Math.min(...lines), 3, '首条达成线 = 3 章(三选一图案奖励)');
  for (const rid of Object.values(ml.MATH_STAMP_REWARDS)) {
    assert.ok(typeof ml.MATH_STAMP_REWARD_TEXT[rid] === 'string' && ml.MATH_STAMP_REWARD_TEXT[rid],
        '奖励有人话文案: ' + rid);
    assert.ok(!/关卡|解锁|难度/.test(ml.MATH_STAMP_REWARD_TEXT[rid]),
        '奖励纯观感, 永不解锁关卡/难度(红线): ' + rid);
  }
});

test('mathStampRecord: 当日计数钳 1~6, 同日取 max 不叠章, 0/负/NaN 不落账, 不突变', () => {
  const ml = loadMathLevels();
  const s0 = {};
  const s1 = ml.mathStampRecord(s0, '2026-10-24', 2);
  assert.strictEqual(s1['2026-10-24'], 2, '当日 2 关落账');
  assert.deepStrictEqual(s0, {}, '不突变入参');
  assert.strictEqual(ml.mathStampRecord(s1, '2026-10-24', 1)['2026-10-24'], 2,
      '重放同日取 max(不回退不叠章)');
  assert.strictEqual(ml.mathStampRecord(s1, '2026-10-24', 9)['2026-10-24'], 6,
      '钳上限 = 日限 6 关');
  assert.strictEqual(ml.mathStampRecord(s1, '2026-10-25', 3)['2026-10-24'], 2,
      '别的日记账不动今天');
  for (const bad of [0, -1, NaN, undefined]) {
    assert.strictEqual(ml.mathStampRecord(s1, '2026-10-26', bad)['2026-10-26'], undefined,
        '无效关数不落账: ' + bad);
  }
});

test('mathStampTrim/mathStampCount: 90 天滚动窗口防膨胀, 集章数 = 有章天数(每天至多 1 枚)', () => {
  const ml = loadMathLevels();
  assert.strictEqual(ml.MATH_STAMP_KEEP_DAYS, 90, '与日志窗口同宽(防存档膨胀)');
  const stamps = {};
  stamps['2026-10-24'] = 3; // 今天
  stamps['2026-7-27'] = 1; // 89 天前 — 保留
  stamps['2026-7-26'] = 2; // 90 天前 — 裁掉
  stamps['bad'] = 1; // 非法键 — 丢弃
  const out = ml.mathStampTrim(stamps, '2026-10-24');
  assert.deepStrictEqual([...Object.keys(out)].sort(), ['2026-10-24', '2026-7-27'], '窗口内外分界');
  assert.strictEqual(ml.mathStampTrim(stamps, 'broken'), stamps, 'today 非法原样返回(不清档)');
  assert.strictEqual(ml.mathStampCount(out), 2, '按天计数(值是关数不是章数)');
  assert.strictEqual(ml.mathStampCount(null), 0, '空档安全');
});

test('mathStampMilestones/RewardsDue/RewardFor: 达成线差集幂等, 60/90…递进线沿用金图章', () => {
  const ml = loadMathLevels();
  assert.deepStrictEqual(ml.mathStampMilestones(2), [], '未到首线无达成');
  assert.deepStrictEqual(ml.mathStampMilestones(7), [3, 7], '表内线升序');
  assert.deepStrictEqual(ml.mathStampMilestones(65), [3, 7, 30, 60], '递进线 60/90…每 30 章');
  assert.deepStrictEqual(ml.mathStampRewardsDue(7, [3]), [7], '已领差集');
  assert.deepStrictEqual(ml.mathStampRewardsDue(7, [3, 7]), [], '全领后空集(幂等)');
  assert.strictEqual(ml.mathStampRewardFor(3), 'stamp_pattern', '3 章 = 三选一图案');
  assert.strictEqual(ml.mathStampRewardFor(60), 'gold_stamp', '递进线沿用金图章');
});

test('mathStampNextLine: 集章进度的下一目标(结算屏/日历头共用口径)', () => {
  const ml = loadMathLevels();
  assert.strictEqual(ml.mathStampNextLine(0), 3);
  assert.strictEqual(ml.mathStampNextLine(3), 7);
  assert.strictEqual(ml.mathStampNextLine(29), 30);
  assert.strictEqual(ml.mathStampNextLine(30), 60, '过 30 后下一目标 = 递进线');
  assert.strictEqual(ml.mathStampNextLine(61), 90);
});

/* ============ mathParamsFor 双轨曲线(design §4.1) ============ */

test('数值轨红线: 带内微升且永不越带 — 每族每个数值字段 ≤ MATH_RANGES[band]', () => {
  const ml = loadMathLevels();
  /* 各族的数值字段清单(数值轨): max=题内最大数, 其余为族的规模轴 */
  const numKeys = {count: ['max'], craft: ['max'], hop: ['max'], mirror: ['span'],
    plan: ['blocks'], pattern: ['max']};
  for (const f of ml.MATH_FAMILIES) {
    for (let t = 1; t <= 19; t++) {
      const band = Math.min(3, Math.floor((t-1)/4));
      for (const key of numKeys[f]) {
        const v = ml.mathParamsFor(f, t)[key];
        assert.ok(typeof v === 'number' && v > 0, f + ' tier' + t + ' ' + key + ' 为正数');
        assert.ok(v <= ml.MATH_RANGES[band],
            f + ' tier' + t + ' ' + key + '=' + v + ' 越带(上限 ' + ml.MATH_RANGES[band] + ')');
      }
    }
    /* 带内微升 + 跨带不回退: 数值轴全程单调不降(ramp 微升, 不许断崖) */
    for (let t = 1; t < 19; t++) {
      const a = ml.mathParamsFor(f, t)[numKeys[f][0]];
      const b = ml.mathParamsFor(f, t+1)[numKeys[f][0]];
      assert.ok(b >= a, f + ' ' + numKeys[f][0] + ' 单调不降(tier ' + t + '→' + (t+1) + '): ' + a + '→' + b);
    }
  }
  /* 带 0 专项锚点: 一上永不出现 >20 的数(plan D3 数值严格跟带) */
  assert.strictEqual(ml.MATH_RANGES[0], 20);
  for (const f of ml.MATH_FAMILIES) {
    for (let t = 1; t <= 4; t++) {
      assert.ok(ml.mathParamsFor(f, t).max <= 20, f + ' 带 0(tier' + t + ') max ≤ 20');
    }
  }
});

test('推理轨: single→two-step→reverse→multi-solve 随 tier 分段, 全族一致且单调', () => {
  const ml = loadMathLevels();
  const STAGES = ['single', 'two-step', 'reverse', 'multi-solve'];
  const seg = (t) => Math.min(3, Math.floor((t-1)/4)); // 1-4/5-8/9-12/13-19
  for (const f of ml.MATH_FAMILIES) {
    const curve = tierCurve(ml, f, 'reasoning');
    for (let t = 1; t <= 19; t++) {
      assert.strictEqual(curve[t-1], STAGES[seg(t)],
          f + ' tier' + t + ' 推理档=' + STAGES[seg(t)]);
    }
  }
});

test('概率坡道: 定性跳变引入档 0<值<1, 单调不降至封顶(台阶变坡道, focus 先例)', () => {
  const ml = loadMathLevels();
  const cases = [
    {family: 'count', key: 'mixRate', cap: 0.6}, // 相似干扰物混入
    {family: 'count', key: 'groupRate', cap: 1}, // 按群计数(2/5 个一数)
    {family: 'craft', key: 'bundleRate', cap: 1}, // 位值捆扎(10 根=1 捆)
    {family: 'hop', key: 'zigRate', cap: 0.5}, // 往返/非整十跳
    {family: 'mirror', key: 'layerRate', cap: 1}, // 多层立体图案
    {family: 'plan', key: 'hiddenRate', cap: 1}, // 隐藏块
    {family: 'pattern', key: 'dualRate', cap: 1}, // 双属性规律
  ];
  for (const c of cases) {
    const vals = tierCurve(ml, c.family, c.key);
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

test('认知负荷红线: 一次呈现 ≤4 组块, 线索 ≤3 条(research §2.6 / plan §4)', () => {
  const ml = loadMathLevels();
  for (const f of ml.MATH_FAMILIES) {
    for (let t = 1; t <= 19; t++) {
      const p = ml.mathParamsFor(f, t);
      assert.ok(p.chunks >= 1 && p.chunks <= 4, f + ' tier' + t + ' 组块 ≤4: ' + p.chunks);
      if (p.clueCount !== undefined) {
        assert.ok(p.clueCount >= 1 && p.clueCount <= 3, f + ' tier' + t + ' 线索 ≤3');
      }
      if (p.unitLen !== undefined) {
        assert.ok(p.unitLen >= 2 && p.unitLen <= 4, 'pattern tier' + t + ' 单元长度 2→4(既是规律轴也是组块)');
      }
    }
  }
});

test('每关只动一个维度: 任一 tier 相邻档至多一个定性新事件(Davidson 2006)', () => {
  const ml = loadMathLevels();
  /* 定性事件 = 推理档变化 / 某概率参数首次>0 / 离散结构参数变值;
     数值轴连续微升不算事件(那是坡道本体)。逐族审计全曲线。 */
  const ramps = {count: ['mixRate', 'groupRate'], craft: ['bundleRate'],
    hop: ['zigRate'], mirror: ['layerRate'], plan: ['hiddenRate'],
    pattern: ['dualRate']};
  const discretes = {count: [], craft: [], hop: ['landmark'],
    mirror: [], plan: [], pattern: ['unitLen', 'clueCount']};
  for (const f of ml.MATH_FAMILIES) {
    for (let t = 2; t <= 19; t++) {
      const prev = ml.mathParamsFor(f, t-1);
      const cur = ml.mathParamsFor(f, t);
      const events = [];
      if (prev.reasoning !== cur.reasoning) events.push('reasoning');
      for (const key of ramps[f]) {
        if (!(prev[key] > 0) && cur[key] > 0) events.push(key);
      }
      for (const key of discretes[f]) {
        if (prev[key] !== cur[key]) events.push(key);
      }
      assert.ok(events.length <= 1,
          f + ' tier' + t + ' 同档引入多个定性变化: ' + events.join('+') + '(每关只动一个维度)');
    }
  }
});

/* ============ 六族元数据与变体表 ============ */

test('MATH_FAMILIES/MATH_META: 六族轮转序 A→F, 元数据齐全且话术可 TTS', () => {
  const ml = loadMathLevels();
  assert.deepStrictEqual([...ml.MATH_FAMILIES], ['count', 'craft', 'hop', 'mirror', 'plan', 'pattern'],
      '六族轮转序: 数一数/算一算/跳一跳/摆一摆/搭一搭/找一找');
  for (const f of ml.MATH_FAMILIES) {
    const m = ml.MATH_META[f];
    assert.ok(m && m.name && m.game, f + ' 有名称与游戏名');
    assert.ok(typeof m.icon === 'string' && m.icon.includes('data:icon'),
        f + ' 图标为 mcIcon 惰性字符串拼接(零 DOM)');
    assert.ok(typeof m.rule === 'string' && m.rule.length > 0, f + ' 规则话术非空');
    assert.ok(typeof m.tip === 'function', f + ' 提示话术为函数');
  }
});

test('MATH_META: 各族 tip 全档位有文案且不引用不存在参数', () => {
  const ml = loadMathLevels();
  for (const f of ml.MATH_FAMILIES) {
    for (let tier = 1; tier <= 19; tier++) {
      for (const li of [0, 1, 7, 8]) {
        const s = ml.MATH_META[f].tip(ml.mathParamsFor(f, tier, li));
        assert.ok(typeof s === 'string' && s.length > 0, f + ' tier' + tier + ' tip 有文案');
        assert.ok(!s.includes('undefined') && !s.includes('NaN'),
            f + ' tier' + tier + ' tip 疑似引用不存在的参数: ' + s);
      }
    }
  }
});

test('MATH_VARIANTS: 每族 3 常规 + 1 挑战(kind=challenge), 名称非空', () => {
  const ml = loadMathLevels();
  for (const f of ml.MATH_FAMILIES) {
    const vs = ml.MATH_VARIANTS[f];
    assert.strictEqual(vs.length, 4, f + ' 四个变体');
    const regular = vs.filter((v) => v.kind !== 'challenge');
    const chal = vs.filter((v) => v.kind === 'challenge');
    assert.strictEqual(regular.length, 3, f + ' 三个常规范型');
    assert.strictEqual(chal.length, 1, f + ' 一个思维挑战变体(★★)');
    assert.strictEqual(chal[0].kind, 'challenge');
    for (const v of vs) {
      assert.ok(v.id && v.name, f + ' 变体有 id 与中文名');
    }
  }
});

/* ============ 情境挂载(T7): 商店/钟表/测距 — 挂族不独立成族 ============ */

test('MATH_CONTEXTS: 商店/钟表/测距三情境在册, 挂族/名称/话术齐全可 TTS', () => {
  const ml = loadMathLevels();
  const ctx = ml.MATH_CONTEXTS;
  const want = {shop: 'craft', clock: 'hop', measure: 'count'};
  assert.deepStrictEqual([...Object.keys(ctx)].sort(), ['clock', 'measure', 'shop'],
      '三情境恰在册(多余/缺失都算漂移)');
  for (const id of Object.keys(want)) {
    assert.ok(ctx[id], '情境 ' + id + ' 在册');
    assert.strictEqual(ctx[id].family, want[id], id + ' 挂在 ' + want[id] + ' 族(不独立成族)');
    assert.ok(ctx[id].name, id + ' 有中文名');
    assert.ok(typeof ctx[id].rule === 'string' && ctx[id].rule.length > 0, id + ' 规则话术非空');
    assert.ok(typeof ctx[id].tip === 'function', id + ' 提示话术为函数');
  }
  /* tip 全档位有文案且不引用不存在参数(与族 tip 同口径) */
  for (const id of Object.keys(want)) {
    for (let tier = 1; tier <= 19; tier++) {
      const s = ctx[id].tip(ml.mathParamsFor(want[id], tier));
      assert.ok(typeof s === 'string' && s.length > 0, id + ' tier' + tier + ' tip 有文案');
      assert.ok(!s.includes('undefined') && !s.includes('NaN'), id + ' tier' + tier + ' tip 疑似引用坏参数: ' + s);
    }
  }
});

test('MATH_LEVELS: 情境关 = 每情境族带内首个轮转位 ×4 带(带 0 落第 2 位), kind=normal', () => {
  const ml = loadMathLevels();
  const ctxOf = {};
  for (const id of Object.keys(ml.MATH_CONTEXTS)) ctxOf[ml.MATH_CONTEXTS[id].family] = id;
  const seen = {shop: [], clock: [], measure: []};
  for (const lv of ml.MATH_LEVELS) {
    const id = lv.variant;
    if (!ml.MATH_CONTEXTS[id]) continue;
    assert.strictEqual(ctxOf[lv.family], id, '情境变体挂在登记族上(配重/战利品/日志随族)');
    assert.strictEqual(lv.kind, 'normal', '情境关为常规关(不占挑战/boss/复习/教学位)');
    seen[id].push(lv);
  }
  for (const id of Object.keys(seen)) {
    assert.strictEqual(seen[id].length, 4, id + ' 四关(每带各一), 实为 ' + seen[id].length);
    assert.deepStrictEqual(seen[id].map((lv) => lv.band), [0, 1, 2, 3], id + ' 每带一关');
    for (const lv of seen[id]) {
      const firstK = lv.band === 0 ? 2 : 1; // 带 0 教学关占掉第 1 次出现
      assert.strictEqual(lv.tier, lv.band * 4 + firstK,
          id + ' 带 ' + lv.band + ' 首个轮转位(tier=' + (lv.band * 4 + firstK) + ')');
      assert.deepStrictEqual({...lv.params}, {...ml.mathParamsFor(lv.family, lv.tier, lv.i)},
          '情境关参数与族曲线同源(情境只换皮肤不动难度轴)');
    }
  }
  /* 带 0 的情境关排在六族教学关之后(教学期先见基础玩法) */
  for (const lv of seen.clock.concat(seen.shop, seen.measure)) {
    if (lv.band === 0) assert.ok(lv.i >= 6, '带 0 情境关在教学关之后: i=' + lv.i);
  }
});
