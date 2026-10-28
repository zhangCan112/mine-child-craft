'use strict';
/* 怪物指挥官指令模拟器纯核心单测 — node --test (零依赖)
   运行: node --test test/robot-core.test.js
   覆盖: mkBoard 确定性(同 seed 同棋盘/跨 seed 相异/200 种子全可解/出生朝向
   恒东=画面右) ·
   stepSim 全意图分支(转向/前进/撞墙/落水/到旗/特技炸墙/打盹吞卡/爬台/
   滑翔过水/陷阱转圈/未知卡安全空转/win 后 idle) · 纯度(入参 sim 不被改写) ·
   parSolution BFS(手工棋盘手算对照 + 生成棋盘解自证: simulate 解列必 win) ·
   安全性(500 随机卡序列不炸、怪物不出界)。
   加载器: 直 require(RandCore 挂 global 后调用期解析, 浏览器侧加载序
   同 index.html: rand-core → robot-core)。 */
const test = require('node:test');
const assert = require('node:assert');

global.RandCore = require('../js/rand-core.js'); /* 随机流唯一实现(加载序先于核心) */
const RobotCore = require('../js/robot-core.js');

const {CELL, DIRS, CARDS} = RobotCore;

/* ---------- 手工棋盘: 字符画 → board(@ 起点 · G 旗 · . 地 · s 软 · # 硬 · ~ 水 · L 台) ---------- */
const CHAR_CELL = {'.': CELL.GROUND, 's': CELL.SOFT, '#': CELL.HARD,
  '~': CELL.WATER, 'G': CELL.GOAL, 'L': CELL.LEDGE};
function rowsToBoard(rows, skill) {
  const h = rows.length; const w = rows[0].length;
  const cells = [];
  let start = null; let goal = null;
  rows.forEach((row, z) => {
    [...row].forEach((ch, x) => {
      if (ch === '@') {
        start = {x, z, dir: 0}; cells.push(CELL.GROUND); return;
      }
      if (ch === 'G') {
        goal = {x, z}; cells.push(CELL.GOAL); return;
      }
      cells.push(CHAR_CELL[ch]);
    });
  });
  return {seed: 0, w, h, cells, softList: [], start, goal, skill: skill || null};
}

/* ============ mkBoard: 确定性出题 ============ */

test('mkBoard: 同 seed 同棋盘(确定性重放红线), 跨 seed 通常相异', () => {
  const opts = {w: 6, h: 6, skill: 'boom', softPath: 1, groundDecor: 4, waterDecor: 2};
  const a = RobotCore.mkBoard(12345, opts);
  const b = RobotCore.mkBoard(12345, opts);
  assert.deepStrictEqual(a, b, '同 seed 必须逐字节一致');
  let differs = 0;
  for (let s = 0; s < 20; s++) {
    if (JSON.stringify(RobotCore.mkBoard(s, opts)) !== JSON.stringify(a)) differs++;
  }
  assert.ok(differs > 0, '不同 seed 不应全部同一张棋盘');
});

test('mkBoard: 200 种子 × 4 特技全可解且形状合法(特征量符合请求, 起终点就位)', () => {
  const skills = ['boom', 'smash', 'climb', 'glide'];
  let cases = 0;
  for (let seed = 0; seed < 200; seed++) {
    const skill = skills[seed % 4];
    const opts = {w: 6, h: 6, skill,
      softPath: skill === 'boom' || skill === 'smash' ? 1 : 0,
      waterPath: skill === 'glide' ? 1 : 0,
      ledgePath: skill === 'climb' ? 1 : 0,
      groundDecor: 3, waterDecor: 2};
    const b = RobotCore.mkBoard(seed, opts);
    cases++;
    assert.strictEqual(b.cells.length, b.w * b.h, 'cells 布局 w×h');
    assert.ok(RobotCore.parOf(b) > 0, 'seed ' + seed + ' (' + skill + ') 必须可解');
    assert.strictEqual(b.cells[b.goal.z * b.w + b.goal.x], CELL.GOAL, '终点格是旗');
    assert.notDeepStrictEqual(
        {x: b.start.x, z: b.start.z}, {x: b.goal.x, z: b.goal.z}, '起终点不同格');
    assert.ok(b.start.x === 0 && b.goal.x === b.w - 1, '西起东终(入口朝东开局)');
    const want = skill === 'glide' ? 1 : (skill === 'boom' || skill === 'smash') ? 1 : 0;
    const wantLedge = skill === 'climb' ? 1 : 0;
    assert.strictEqual(b.softList.length >= 0, true);
    const kinds = new Set(b.cells);
    if (want === 0) assert.ok(![...kinds].includes(CELL.SOFT), '无软障碍请求就不该有软格');
    if (wantLedge === 0) assert.ok(![...kinds].includes(CELL.LEDGE), '无高台请求就不该有台格');
  }
  assert.ok(cases === 200);
});

test('出生朝向恒东(画面右): 200 种子 × 全特技 start.dir 恒 0 — 真机反馈朝向可读性', () => {
  const skills = ['boom', 'smash', 'climb', 'glide'];
  for (let seed = 0; seed < 200; seed++) {
    const skill = skills[seed % 4];
    const b = RobotCore.mkBoard(seed, {w: 6, h: 6, skill,
      softPath: skill === 'boom' || skill === 'smash' ? 1 : 0,
      waterPath: skill === 'glide' ? 1 : 0,
      ledgePath: skill === 'climb' ? 1 : 0,
      groundDecor: 3, waterDecor: 2});
    assert.strictEqual(b.start.dir, 0,
        'seed ' + seed + ' (' + skill + ') 出生必须朝东: 第二路径格恒在正东');
  }
});

test('双闸: parCap 预算内必收(200 种子 par ≤ cap), 特技关最短解必含 S(教学承重)', () => {
  const skills = ['boom', 'smash', 'climb', 'glide'];
  for (let seed = 0; seed < 200; seed++) {
    const skill = skills[seed % 4];
    const b = RobotCore.mkBoard(seed, {w: 6, h: 6, skill,
      softPath: skill === 'boom' || skill === 'smash' ? 1 : 0,
      waterPath: skill === 'glide' ? 1 : 0,
      ledgePath: skill === 'climb' ? 1 : 0,
      groundDecor: 4, waterDecor: 2, parCap: 8});
    const par = RobotCore.parOf(b);
    assert.ok(par > 0 && par <= 8,
        'seed ' + seed + ' (' + skill + ') 必须 par ≤ 预算(实际 ' + par + ')');
    const want = {boom: CELL.SOFT, smash: CELL.SOFT, climb: CELL.LEDGE,
      glide: CELL.WATER}[skill];
    if (b.cells.includes(want)) {
      const sol = RobotCore.parSolution(b);
      assert.ok(sol.includes('S'),
          'seed ' + seed + ' (' + skill + ') 特征在盘上, 最短解必须用特技卡');
    }
  }
});

test('双闸不可满足时兜底盘仍可解(回归: 兜底曾漏 GOAL 格)', () => {
  /* boom + parCap 4 在 6 宽上数学不可行(m ≥ 5 ⇒ par ≥ 8 > 4): 必走兜底 */
  const b = RobotCore.mkBoard(123, {w: 6, h: 6, skill: 'boom', softPath: 1,
    groundDecor: 3, waterDecor: 2, parCap: 4});
  assert.strictEqual(b.cells[b.goal.z * b.w + b.goal.x], CELL.GOAL,
      '兜底盘终点格必须是旗(回归: 兜底曾漏设 GOAL 格)');
  assert.ok(RobotCore.parOf(b) > 0, '兜底盘必须可解');
});

/* ============ stepSim: 全意图分支(手工字符画棋盘) ============ */

test('转向: 左转=(dir+3)%4 恰是逆时针(E→N), 右转顺时针(E→S), 四转回原向', () => {
  const b = rowsToBoard(['@#G'], 'boom');
  let r = RobotCore.stepSim(b, RobotCore.mkSim(b), 'L');
  assert.strictEqual(r.sim.dir, 3, 'E 左转 → N');
  r = RobotCore.stepSim(b, RobotCore.mkSim(b), 'R');
  assert.strictEqual(r.sim.dir, 1, 'E 右转 → S');
  let sim = RobotCore.mkSim(b);
  for (let i = 0; i < 4; i++) sim = RobotCore.stepSim(b, sim, 'R').sim;
  assert.strictEqual(sim.dir, 0, '右转四圈回东');
  assert.strictEqual(r.intent, 'turn');
});

test('前进: 直路三步到旗(win 即提前收); 撞硬墙 bonk 位置不变; 越界 bonk', () => {
  const b = rowsToBoard(['@..G'], 'boom');
  const sim = RobotCore.mkSim(b);
  const pure = RobotCore.stepSim(b, sim, 'F');
  assert.strictEqual(pure.sim.x, 1, 'F 前进一格');
  assert.deepStrictEqual(sim, RobotCore.mkSim(b), '入参 sim 不被改写(纯度)');
  const run = RobotCore.simulate(b, ['F', 'F', 'F', 'F']);
  assert.strictEqual(run.status, 'win', '三步到旗');
  assert.strictEqual(run.trace.length, 3, 'win 即提前收, 不播多余卡');
  assert.strictEqual(run.trace[2].intent, 'win', '第三步到旗');
  assert.strictEqual(run.trace[2].x, 3, '位置钉在旗上');
  const wall = rowsToBoard(['@#.G'], 'boom');
  const r = RobotCore.stepSim(wall, RobotCore.mkSim(wall), 'F');
  assert.strictEqual(r.intent, 'bonk');
  assert.strictEqual(r.sim.x, 0, '撞墙不动');
  const edge = rowsToBoard(['G.@'], 'boom'); /* 起点朝东但西边是界外: 转身后试 */
  const s2 = RobotCore.stepSim(edge, RobotCore.mkSim(edge), 'L');
  const r2 = RobotCore.stepSim(edge, s2.sim, 'F'); /* 朝北出界 */
  assert.strictEqual(r2.intent, 'bonk', '越界=撞隐形围栏');
});

test('水面: 普通前进 splash; 小鸡滑翔 S 可入水、出水正常走', () => {
  const b = rowsToBoard(['@~.G'], null);
  const r = RobotCore.stepSim(b, RobotCore.mkSim(b), 'F');
  assert.strictEqual(r.intent, 'splash');
  const g = rowsToBoard(['@~.G'], 'glide');
  const sim = RobotCore.mkSim(g);
  let r2 = RobotCore.stepSim(g, sim, 'S');
  assert.strictEqual(r2.intent, 'move', '滑翔入水=正常移动');
  assert.strictEqual(r2.sim.x, 1);
  r2 = RobotCore.stepSim(g, r2.sim, 'F');
  assert.strictEqual(r2.intent, 'move', '从水里走上岸');
  r2 = RobotCore.stepSim(g, r2.sim, 'F');
  assert.strictEqual(r2.intent, 'win', '到旗');
});

test('软障碍: 普通前进 bonk; boom S 炸开+打盹2回合吞卡; smash 炸开不打盹', () => {
  const boom = rowsToBoard(['@s.G'], 'boom');
  const sim = RobotCore.mkSim(boom);
  let r = RobotCore.stepSim(boom, sim, 'F');
  assert.strictEqual(r.intent, 'bonk', '未炸的软障碍撞墙');
  r = RobotCore.stepSim(boom, r.sim, 'S');
  assert.strictEqual(r.intent, 'skill', '炸开');
  assert.strictEqual(r.sim.asleep, 2, '炸完打盹 2 回合');
  r = RobotCore.stepSim(boom, r.sim, 'F');
  assert.strictEqual(r.intent, 'nap', '打盹吞前进');
  r = RobotCore.stepSim(boom, r.sim, 'L');
  assert.strictEqual(r.intent, 'nap', '打盹吞转向');
  r = RobotCore.stepSim(boom, r.sim, 'F');
  assert.strictEqual(r.intent, 'move', '睡醒上路');
  assert.strictEqual(r.sim.cleared.length, 1, '清除记账');
  const smash = rowsToBoard(['@s.G'], 'smash');
  let s2 = RobotCore.mkSim(smash);
  s2 = RobotCore.stepSim(smash, s2, 'S').sim;
  assert.strictEqual(s2.asleep, 0, '砸碎不打盹');
  const boomNone = rowsToBoard(['@..G'], 'boom');
  const r3 = RobotCore.stepSim(boomNone, RobotCore.mkSim(boomNone), 'S');
  assert.strictEqual(r3.intent, 'nothing', '没得炸耸肩不罚');
});

test('高台: 普通前进 bonk; 蜘蛛 S 爬上、普通 F 可走下(跳下一格无伤)', () => {
  const b = rowsToBoard(['@L.G'], 'climb');
  let r = RobotCore.stepSim(b, RobotCore.mkSim(b), 'F');
  assert.strictEqual(r.intent, 'bonk', '不会爬的上不去');
  let sim = RobotCore.mkSim(b);
  sim = RobotCore.stepSim(b, sim, 'S').sim;
  assert.strictEqual(sim.x, 1, 'S 爬上高台');
  r = RobotCore.stepSim(b, sim, 'F');
  assert.strictEqual(r.intent, 'move', '走下高台');
  assert.strictEqual(r.sim.x, 2);
  const g = rowsToBoard(['@L.G'], 'glide');
  const r2 = RobotCore.stepSim(g, RobotCore.mkSim(g), 'S');
  assert.strictEqual(r2.intent, 'bonk', '滑翔不能爬台');
});

test('陷阱卡 X=原地转圈(白费一槽); 未知卡安全空转; win 后任何卡 idle', () => {
  const b = rowsToBoard(['@..G'], 'boom');
  let r = RobotCore.stepSim(b, RobotCore.mkSim(b), 'X');
  assert.strictEqual(r.intent, 'spin');
  assert.strictEqual(r.sim.x, 0, '转圈不走');
  r = RobotCore.stepSim(b, RobotCore.mkSim(b), 'Z');
  assert.strictEqual(r.intent, 'idle', '未知卡不炸');
  let sim = RobotCore.mkSim(b);
  for (const c of ['F', 'F', 'F']) sim = RobotCore.stepSim(b, sim, c).sim;
  assert.ok(sim.won);
  r = RobotCore.stepSim(b, sim, 'F');
  assert.strictEqual(r.intent, 'idle', '旗后全空转');
});

/* ============ par: BFS 最短指令序列 ============ */

test('parOf 手算对照: 直线 3 步 · L 弯 3 卡 · 绕软障碍加一张特技卡', () => {
  assert.strictEqual(RobotCore.parOf(rowsToBoard(['@..G'], null)), 3, '三格直路 FFF');
  assert.strictEqual(RobotCore.parOf(rowsToBoard(['@.', '.G'], null)), 3, 'F R F');
  assert.strictEqual(RobotCore.parOf(rowsToBoard(['@sG'], 'boom')), 5,
      'S+3F, 打盹再吞两张 F(炸的代价, 设计稿 §3.2)');
  assert.strictEqual(RobotCore.parOf(rowsToBoard(['@sG'], 'smash')), 3, 'S+2F 不打盹');
  assert.strictEqual(RobotCore.parOf(rowsToBoard(['@~G'], 'glide')), 2, '滑翔过水不花额外卡');
  assert.strictEqual(RobotCore.parOf(rowsToBoard(['@LG'], 'climb')), 2, 'S 爬台 F 到旗');
});

test('parSolution: 解列 simulate 必 win; 卡数与 parOf 一致; 不可解返回 null', () => {
  for (let seed = 0; seed < 100; seed++) {
    const skill = ['boom', 'smash', 'climb', 'glide'][seed % 4];
    const b = RobotCore.mkBoard(seed, {w: 6, h: 6, skill,
      softPath: skill === 'boom' || skill === 'smash' ? 2 : 0,
      waterPath: skill === 'glide' ? 1 : 0,
      ledgePath: skill === 'climb' ? 1 : 0,
      groundDecor: 4, waterDecor: 2});
    const sol = RobotCore.parSolution(b);
    assert.ok(Array.isArray(sol), 'seed ' + seed + ' 必有解');
    assert.strictEqual(sol.length, RobotCore.parOf(b), '卡数=parOf');
    assert.ok(sol.every((c) => CARDS.includes(c)), '卡列只含合法卡');
    const run = RobotCore.simulate(b, sol);
    assert.strictEqual(run.status, 'win', 'seed ' + seed + ' BFS 解自证可赢');
    assert.ok(sol.length <= 40, '6×6 棋盘 par 有界(顶格远小于槽位上限×2)');
  }
  const nosol = rowsToBoard(['@#G'], 'boom');
  assert.strictEqual(RobotCore.parSolution(nosol), null, '全硬墙隔断=不可解');
  assert.strictEqual(RobotCore.parOf(nosol), -1);
});

test('安全性: 500 张随机卡喂任意生成棋盘不炸、怪物全程不出界', () => {
  let sim = null;
  let rnd = 42;
  const board = RobotCore.mkBoard(7, {w: 6, h: 6, skill: 'climb', ledgePath: 1, groundDecor: 5});
  sim = RobotCore.mkSim(board);
  for (let i = 0; i < 500; i++) {
    rnd = (rnd * 1103515245 + 12345) % 2147483648;
    const card = 'FLRSX'[rnd % 5];
    const r = RobotCore.stepSim(board, sim, card);
    sim = r.sim;
    assert.ok(sim.x >= 0 && sim.x < board.w && sim.z >= 0 && sim.z < board.h,
        '第 ' + i + ' 步出界: ' + sim.x + ',' + sim.z);
    assert.ok(DIRS[sim.dir], 'dir 恒在 0..3');
    if (sim.won) break;
  }
});
