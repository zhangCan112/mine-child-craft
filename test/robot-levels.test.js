'use strict';
/* 怪物指挥官关卡库单测 — node --test (零依赖)
   运行: node --test test/robot-levels.test.js
   覆盖: 100 关编排(4 带×25/kind 分布逐带断言/boss 恒带末/包轮换合法/
   tier 1..19) · paramsFor 边界(槽位主轴 1..10/尺寸 4..7/previewSec 带语义/
   trapRate 渐进有界/decoy 仅带3/skill 带感知: 带0 封印特技卡(特征量全 0),
   带1~3 与包一致) · presetFor=解去尾卡可续赢 ·
   debugPresetFor 必坏(≠win) · 三星与通过门槛边界 · 战利品(教学豁免/池键 ⊆
   ITEMS[vm 装载]/确定性/boss 保底) · 存档迁移幂等 · 跨层可出盘(抽样关参数
   喂 robot-core 全可解)。
   加载器: RandCore/RobotCore 挂 global 后直 require levels(调用期解析,
   浏览器侧加载序同 index.html: rand-core → robot-core → robot-levels);
   ITEMS 走 vm 共享词法环境镜像(items-core 无导出守卫, test/items-core 同款)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.RandCore = require('../js/rand-core.js');
global.CampCore = require('../js/camp-core.js'); // 图章一本构造期即用(镜像 index.html 相对序: camp-core 先于 robot-levels)
global.RobotCore = require('../js/robot-core.js');
const Levels = require('../js/robot-levels.js');
const {ROBOT_LEVELS, ROBOT_PACKS, ROBOT_KIND_TEMPLATES} = Levels;

function loadItems() {
  const ctx = vm.createContext({console});
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'items-core.js'), 'utf8'),
      ctx, {filename: 'items-core.js'});
  vm.runInContext('globalThis.__i = ITEMS;', ctx);
  return ctx.__i;
}

/* 确定性 rnd 桩(掷骰测试注入) */
function mkStubRnd(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/* ============ 编排: 100 关结构 ============ */

test('编排: 100 关 · 4 带×25 · kind 分布逐带符合模板 · boss 恒带末', () => {
  assert.strictEqual(ROBOT_LEVELS.length, 100);
  for (let band = 0; band < 4; band++) {
    const lv = ROBOT_LEVELS.filter((l) => l.band === band);
    assert.strictEqual(lv.length, 25, '带 ' + band + ' 25 关');
    lv.forEach((l, k) => {
      assert.strictEqual(l.k, k);
      assert.strictEqual(l.kind, ROBOT_KIND_TEMPLATES[band][k], 'i=' + l.i);
      assert.strictEqual(l.i, band * 25 + k);
    });
    assert.strictEqual(lv[24].kind, 'boss', '带末 = boss');
    const kinds = new Set(lv.map((l) => l.kind));
    if (band === 0) {
      assert.ok(kinds.has('tut') && kinds.has('decode'), '带0 有直接驱动与解码关');
    } else {
      assert.ok(!kinds.has('tut') && !kinds.has('decode'), '直接驱动/解码关只在带0');
    }
    if (band !== 2) assert.ok(!kinds.has('debug'), '找错关只在带2');
    if (band !== 3) assert.ok(!kinds.has('relay'), '接力关只在带3');
    assert.strictEqual(lv.filter((l) => l.kind === 'boss').length, 1, '每带恰 1 boss');
  }
});

test('编排: 包键全注册 · tier 1..19 带内不减 · 解锁关恰在包首现', () => {
  const keys = new Set(ROBOT_PACKS.map((p) => p.key));
  for (let band = 0; band < 4; band++) {
    let lastTier = 0;
    for (const l of ROBOT_LEVELS.filter((x) => x.band === band)) {
      assert.ok(keys.has(l.pack), '包键注册: ' + l.pack);
      assert.ok(l.tier >= 1 && l.tier <= 19, 'tier 有界');
      assert.ok(l.tier >= lastTier, '带内 tier 不减');
      lastTier = l.tier;
    }
  }
  /* 带1 铁傀儡第 9 关(k=8)解锁——「每包只教一个新语义」的编排钉; k8 起
     全铁傀儡(D15 v2: 交替制会让 boom 关在非教学段批量出直线盘) */
  assert.strictEqual(ROBOT_LEVELS[25 + 8].pack, 'golem');
  assert.strictEqual(ROBOT_LEVELS[25 + 7].pack, 'creeper');
  for (let k = 8; k < 25; k++) {
    assert.strictEqual(ROBOT_LEVELS[25 + k].pack, 'golem',
        '带1 k' + k + ' 应为铁傀儡(k8 起全 golem)');
  }
});

/* ============ paramsFor: 曲线边界 ============ */

test('paramsFor: 槽位主轴(带0 1/3/4 → 带1~3 6/8/10) · 尺寸 4..7 · 演示消退带语义', () => {
  for (const l of ROBOT_LEVELS) {
    const p = Levels.paramsFor(l);
    assert.ok(p.w >= 4 && p.w <= 7 && p.h === p.w, 'i=' + l.i + ' 尺寸有界');
    if (l.band === 0) {
      assert.strictEqual(p.slots, l.kind === 'tut' ? 1 : l.kind === 'decode' ? 3 : 4);
      assert.strictEqual(p.previewSec, 0, '带0 无消退');
    } else {
      assert.strictEqual(p.slots, [0, 6, 8, 10][l.band]);
    }
    if (l.band >= 2) assert.ok(p.previewSec >= 3 && p.previewSec <= 8, '消退秒数 3..8');
    else assert.strictEqual(p.trapRate, 0, '陷阱卡带2 起才有');
    if (p.trapRate) assert.ok(p.trapRate > 0 && p.trapRate <= 0.3, '陷阱率有界');
    if (l.band !== 3) assert.strictEqual(p.decoy, 0, '假旗仅带3');
    else assert.ok(p.decoy >= 0 && p.decoy <= 2, '假旗 ≤2(无害档)');
    const meta = ROBOT_PACKS.find((x) => x.key === l.pack);
    if (l.band === 0) {
      assert.strictEqual(p.skill, null, 'i=' + l.i + ' 带0 封印特技卡(D4: 先学会走和转)');
      assert.strictEqual(p.softPath, 0, '带0 无软障碍(特征量随 skill 归零)');
      assert.strictEqual(p.waterPath, 0, '带0 无水面路');
      assert.strictEqual(p.ledgePath, 0, '带0 无高台路');
    } else {
      assert.strictEqual(p.skill, meta.skill || null, 'i=' + l.i + ' skill 与包一致');
    }
    assert.strictEqual(p.boards, 4, '每关 4 盘');
    /* 转弯爬坡曲线(D15 v2): 带0 tut 后段 1 转直驱首秀 · 带1 smash 1 转
       (boom 教学期直路=D13 数学) · 带2 k10 起 2 转 · 带3 1→2→3 转带末
       俯冲, boom 天花板 1 转 —— 带内不减(台阶不变陡) */
    if (l.band === 0) {
      assert.strictEqual(p.turnsMin, l.kind === 'tut' && l.k >= 3 ? 1 : 0,
          'i=' + l.i + ' 带0 只有 tut k3+ 开 1 转');
    } else if (l.band === 1) {
      assert.strictEqual(p.turnsMin, meta.skill === 'smash' ? 1 : 0,
          'i=' + l.i + ' 带1 smash 1 转 / boom 教学期直路');
    } else if (l.band === 2) {
      assert.strictEqual(p.turnsMin, l.k < 10 ? 1 : 2,
          'i=' + l.i + ' 带2 k10 起 2 转');
    } else {
      assert.strictEqual(p.turnsMin,
          meta.skill === 'boom' ? 1 : (l.k < 5 ? 1 : l.k < 18 ? 2 : 3),
          'i=' + l.i + ' 带3 1→2→3 转(boom 天花板 1 转)');
    }
    if (!meta.skill || meta.skill === 'boom' || meta.skill === 'smash') {
      assert.strictEqual(p.waterPath, 0, '非滑翔包不出水面路');
      assert.strictEqual(p.ledgePath, 0, '非攀爬包不出高台路');
    }
  }
});

/* ============ presetFor / debugPresetFor: 预置程序派生 ============ */

test('presetFor: 解码关预置=最短解去尾卡, 补一张即赢; debugPresetFor 必坏', () => {
  const decodes = ROBOT_LEVELS.filter((l) => l.kind === 'decode');
  assert.ok(decodes.length === 4);
  for (const l of decodes) {
    const preset = Levels.presetFor(l, 0);
    assert.ok(Array.isArray(preset) && preset.length >= 1, 'i=' + l.i + ' 有预置');
    const board = global.RobotCore.mkBoard(Levels.boardSeed(l.i, 0), Levels.boardOpts(l));
    const sol = global.RobotCore.parSolution(board);
    assert.deepStrictEqual(preset, sol.slice(0, -1), '预置=解去尾卡');
    /* 孩子补尾卡后应可赢: 预置 + BFS 解尾卡 === 完整解 */
    assert.strictEqual(global.RobotCore.simulate(board, preset.concat(sol[sol.length - 1])).status,
        'win');
  }
  const debugs = ROBOT_LEVELS.filter((l) => l.kind === 'debug');
  assert.ok(debugs.length === 7);
  for (const l of debugs) {
    const broken = Levels.debugPresetFor(l, 0);
    assert.ok(Array.isArray(broken), 'i=' + l.i + ' 有坏程序');
    const board = global.RobotCore.mkBoard(Levels.boardSeed(l.i, 0), Levels.boardOpts(l));
    assert.notStrictEqual(global.RobotCore.simulate(board, broken).status, 'win',
        '预置坏程序必须跑不赢(找错关成立)');
  }
});

/* ============ 三星与门槛 ============ */

test('robotPassed/robotStars: 3/4 门槛 · ⭐⭐全对 · ⭐⭐⭐par 预算 ≥3 块', () => {
  assert.strictEqual(Levels.robotPassed(2), false);
  assert.strictEqual(Levels.robotPassed(3), true);
  const st = (solved, parHits) => {
    const arr = [];
    for (let k = 0; k < 4; k++) {
      if (k >= solved) arr.push({solved: false, used: 0, par: 4});
      else if (k < parHits) arr.push({solved: true, used: 5, par: 4}); /* 5 ≤ 4+1 打到预算 */
      else arr.push({solved: true, used: 9, par: 3}); /* 9 > 3+1 超预算 */
    }
    return arr;
  };
  assert.strictEqual(Levels.robotStars(st(2, 0)), 0, '2/4 零星');
  assert.strictEqual(Levels.robotStars(st(3, 0)), 1, '3/4 一星');
  assert.strictEqual(Levels.robotStars(st(4, 1)), 2, '全对但预算只 1 块=两星');
  assert.strictEqual(Levels.robotStars(st(4, 3)), 3, '全对+3 块进预算=三星');
  assert.strictEqual(Levels.robotStars(st(4, 4)), 3, '全预算封顶三星');
});

/* ============ 战利品 ============ */

test('rollRobotLoot: 教学关豁免 · 同 rnd 同结果 · 池键 ⊆ ITEMS · boss 保底', () => {
  const ITEMS = loadItems();
  const tut = ROBOT_LEVELS[0];
  assert.deepStrictEqual(Levels.rollRobotLoot(mkStubRnd(1), tut, 4), [], '教学关不掷');
  const normal = ROBOT_LEVELS[10];
  const a = Levels.rollRobotLoot(mkStubRnd(42), normal, 4);
  const b = Levels.rollRobotLoot(mkStubRnd(42), normal, 4);
  assert.deepStrictEqual(a, b, '同 rnd 同结果(确定性红线)');
  for (const item of a) {
    assert.ok(item in ITEMS, '池键必须在 ITEMS 注册: ' + item);
  }
  assert.ok(a.length <= 4, '4 盘至多 4 件');
  assert.strictEqual(Levels.rollRobotLoot(mkStubRnd(7), normal, 0).length, 0, '全错不掷');
  const boss = ROBOT_LEVELS.find((l) => l.kind === 'boss' && l.band === 0);
  const got = Levels.rollRobotLoot(mkStubRnd(3), boss, 4);
  assert.ok(got.includes('gunpowder'), 'boss 通关追加稀有保底');
});

/* ============ 存档迁移 ============ */

test('migrateRobotSave: 空档回默认 · 坏字段修形 · 幂等 · 当前版进度保留 · 升版清星表(D9)', () => {
  assert.deepStrictEqual(Levels.migrateRobotSave(null), Levels.ROBOT_SAVE_DEFAULTS);
  const junk = {v: 99, stars: 'x', stamps: null, log: 3, stampClaimed: 'y', stampKind: 7,
    stars2: {}}; // 未知字段原样保留
  const fixed = Levels.migrateRobotSave(junk);
  assert.deepStrictEqual(fixed.stars, {});
  assert.deepStrictEqual(fixed.stamps, {});
  assert.deepStrictEqual(fixed.log, {});
  assert.deepStrictEqual(fixed.stampClaimed, []);
  assert.strictEqual(fixed.stampKind, 'gem');
  assert.deepStrictEqual(Levels.migrateRobotSave(fixed), fixed, '幂等');
  const keep = {v: 1, stars: {0: 3}, stamps: {'2026-10-28': 2}, log: {}, stampClaimed: [3],
    stampKind: 'gem'};
  const kept = Levels.migrateRobotSave({...keep});
  assert.deepStrictEqual(kept.stars, {0: 3}, '存量进度原样保留');
  /* D9 升版清星表: 版本位不匹配 = 编排已变(插关/重排) → 从头玩, 不许跳关;
     日期记账(图章/日志/已领线)与关号无关, 保留——重玩不是惩罚 */
  const old = {v: 0, stars: {0: 3, 1: 2, 2: 1}, stamps: {'2026-10-28': 2},
    log: {'2026-10-28': {band: 0}}, stampClaimed: [3], stampKind: 'gem'};
  const reborn = Levels.migrateRobotSave(old);
  assert.strictEqual(Levels.ROBOT_SAVE_VERSION, 1, '当前版=1(升版示例语义锚)');
  assert.deepStrictEqual(reborn.stars, {}, '升版清星表——新关卡从头玩');
  assert.deepStrictEqual(reborn.stamps, {'2026-10-28': 2}, '图章保留');
  assert.deepStrictEqual(reborn.log, {'2026-10-28': {band: 0}}, '家长日志保留');
  assert.deepStrictEqual(reborn.stampClaimed, [3], '已领达成线保留');
});

/* ============ 跨层可出盘: 关卡参数喂 robot-core 全可解 ============ */

test('boardSeed/boardOpts: 抽样 14 关 × 4 盘全部可解(参数→棋盘闭环), 出生朝向恒东', () => {
  const sample = [0, 6, 13, 25, 26, 33, 50, 57, 58, 63, 75, 80, 99, 30];
  for (const i of sample) {
    const l = ROBOT_LEVELS[i];
    for (let bd = 0; bd < 4; bd++) {
      const board = global.RobotCore.mkBoard(Levels.boardSeed(i, bd), Levels.boardOpts(l));
      const par = global.RobotCore.parOf(board);
      assert.ok(par > 0, 'i=' + i + ' 盘' + bd + ' (' + l.pack + ') 必须可解');
      assert.ok(par <= 40, 'par 有界(顶格远小于程序上限)');
      assert.strictEqual(board.start.dir, 0,
          'i=' + i + ' 盘' + bd + ' 出生必须朝东(画面右, 真机反馈朝向可读性)');
    }
  }
});

/* ============ 可通关闭环(全量): 三闸落地的产品级回归网 ============ */

test('全量 100 关 × 4 盘: 非 tut 盘 par ≤ 槽位(超预算=不可通关), 特技盘最短解必含 S, 转向请求必足额', () => {
  for (const l of ROBOT_LEVELS) {
    const p = Levels.paramsFor(l);
    for (let bd = 0; bd < 4; bd++) {
      const board = global.RobotCore.mkBoard(Levels.boardSeed(l.i, bd), Levels.boardOpts(l));
      const par = global.RobotCore.parOf(board);
      assert.ok(par > 0, 'i=' + l.i + ' 盘' + bd + ' (' + l.pack + ') 必须可解');
      if (l.kind !== 'tut') { // tut 直接驱动不受槽位限
        assert.ok(par <= p.slots,
            'i=' + l.i + ' 盘' + bd + ' par ' + par + ' > 槽位 ' + p.slots +
            ' = 一 program 内不可能到旗');
      }
      if (p.skill) {
        const want = {boom: global.RobotCore.CELL.SOFT,
          smash: global.RobotCore.CELL.SOFT, climb: global.RobotCore.CELL.LEDGE,
          glide: global.RobotCore.CELL.WATER}[p.skill];
        if (board.cells.includes(want)) {
          const sol = global.RobotCore.parSolution(board);
          assert.ok(sol.includes('S'),
              'i=' + l.i + ' 盘' + bd + ' 特征在盘上, 最短解必须用特技卡(教学承重)');
        }
      }
      /* 形状闸(D15): 请求转弯的关, 最短解转向卡必须足额(否则 L/R 课程线
         断供——2026-10-29 审计: 修前带1~3 共 300 盘 100% 零转弯) */
      if (p.turnsMin > 0) {
        const sol = global.RobotCore.parSolution(board);
        const tc = sol.filter((c) => c === 'L' || c === 'R').length;
        assert.ok(tc >= p.turnsMin,
            'i=' + l.i + ' 盘' + bd + ' 转向数 ' + tc + ' < 请求 ' + p.turnsMin +
            '(转弯教学落空)');
      }
    }
  }
});
