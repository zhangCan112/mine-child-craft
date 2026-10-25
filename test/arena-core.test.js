'use strict';
/* 竞技场核心 (js/arena-core.js) 单测 — node --test (零依赖)
   运行: node --test test/arena-core.test.js
   C3-T1 剥核后的同名单测(conventions §1.2 守门), 装载器走 adventure-core 档:
   本核心只在加载期读 config 的 WORLD_W/WORLD_D, 故 vm 只装真 config.js 一件,
   全局名桥到主域后 require 被测核心(经典 script 词法环境的 Node 侧镜像);
   几何派生断言用换桩重载(vm 新环境注入不同世界尺寸)证明「派生而非硬编码」。
   战斗编排/技能 tick/索敌权重的行为面由 test/boot.test.js 全链冒烟守着,
   两份互不重复。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 装载器(adventure-core 档): config 先载 vm, 全局名桥主域, 再 require 被测核心 ---------- */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8'), eng, {filename: 'js/config.js'});
const cfg = vm.runInContext('({WORLD_W, WORLD_D, MOB_TYPES, BLOCKS})', eng);
Object.assign(globalThis, {WORLD_W: cfg.WORLD_W, WORLD_D: cfg.WORLD_D});
const ArenaCore = require('../js/arena-core.js');

/* 换桩重载: 新 vm 环境注入不同世界尺寸, 证明 ARENA 中心是加载期派生 */
function loadWithSize(w, d) {
  const sandbox = {WORLD_W: w, WORLD_D: d, module: {exports: {}}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/arena-core.js'), 'utf8'),
      sandbox, {filename: 'js/arena-core.js'});
  return sandbox.module.exports;
}

/* ============ 常数表 ============ */

test('几何: ARENA 中心从 config 世界尺寸加载期派生, 场地档位为固定常量', () => {
  assert.strictEqual(ArenaCore.ARENA.cx, cfg.WORLD_W / 2);
  assert.strictEqual(ArenaCore.ARENA.cz, cfg.WORLD_D / 2);
  assert.strictEqual(ArenaCore.ARENA.floorY, 14); // 场地地面顶层方块 y
  assert.strictEqual(ArenaCore.ARENA.rIn, 36); // 内墙半径
  assert.strictEqual(ArenaCore.ARENA.rOut, 40); // 外墙半径
  assert.strictEqual(ArenaCore.ARENA.flyAlt, 7.8); // 飞行单位悬停高度
  assert.ok(ArenaCore.ARENA.rIn < ArenaCore.ARENA.rOut, '内外墙半径有序');
  const stub = loadWithSize(100, 60);
  assert.strictEqual(stub.ARENA.cx, 50, 'cx 随 WORLD_W 换算');
  assert.strictEqual(stub.ARENA.cz, 30, 'cz 随 WORLD_D 换算');
});

test('选块: HOTBAR 铁锹哨兵在第 1 格, 其余槽全是注册方块 id 且不重复', () => {
  const hb = ArenaCore.HOTBAR;
  assert.strictEqual(hb.length, 10);
  assert.strictEqual(hb[0], 'shovel'); // 挖掘入口哨兵(手持感知: 拿铲子=挖)
  const nums = hb.filter((id) => typeof id === 'number');
  assert.strictEqual(nums.length, 9);
  assert.strictEqual(new Set(nums).size, 9, '方块槽不重复');
  for (const id of nums) assert.ok(cfg.BLOCKS[id], '方块 id ' + id + ' 已在 config 注册');
});

test('战力: ARENA_POWER 键集都在 config MOB_TYPES(菜单文案直读 name), 数值为正', () => {
  const keys = Object.keys(ArenaCore.ARENA_POWER);
  assert.ok(keys.length >= 30, '全怪物配平表(非抽样)');
  for (const k of keys) {
    assert.ok(cfg.MOB_TYPES[k], k + ' 不在 MOB_TYPES');
    assert.ok(ArenaCore.ARENA_POWER[k] > 0, k + ' 战力为正');
  }
  assert.ok(ArenaCore.ARENA_POWER.warden > ArenaCore.ARENA_POWER.zombie, '配平序: 监守者远强于僵尸');
});

test('地形别名: ID_* 恒等 config 的 BLOCKS id(免魔法数字的口径没漂)', () => {
  const expect = {ID_GRASS: 1, ID_STONE: 3, ID_COBBLE: 4, ID_BRICK: 13, ID_MOSS: 14,
    ID_BLUEWOOL: 15, ID_REDWOOL: 16, ID_QUARTZ: 17, ID_GLASS: 18, ID_LAMP: 19};
  for (const [k, v] of Object.entries(expect)) {
    assert.strictEqual(ArenaCore[k], v);
    assert.ok(cfg.BLOCKS[v], k + ' 的 id ' + v + ' 已在 config 注册');
  }
});

test('晋升档位: TIER_MULT 恰有 2/3 两档且逐档增强, TIER_NAME 键同构', () => {
  assert.deepStrictEqual(Object.keys(ArenaCore.TIER_MULT).map(Number).sort(), [2, 3]);
  assert.deepStrictEqual(Object.keys(ArenaCore.TIER_NAME).map(Number).sort(), [2, 3]);
  for (const f of ['hp', 'dmg', 'spd']) {
    assert.ok(ArenaCore.TIER_MULT[3][f] > ArenaCore.TIER_MULT[2][f], f + ' 王者档强于精英档');
    assert.ok(ArenaCore.TIER_MULT[2][f] > 1, f + ' 精英档是加成不是削弱');
  }
  assert.strictEqual(ArenaCore.TIER_NAME[2], '精英');
  assert.strictEqual(ArenaCore.TIER_NAME[3], '王者');
});

test('克制表: 键与值都是 config 已注册怪种(索敌直查不兜底), 经典环闭环', () => {
  const C = ArenaCore.COUNTER;
  for (const [k, v] of Object.entries(C)) {
    assert.ok(cfg.MOB_TYPES[k], '键 ' + k + ' 未注册');
    assert.ok(cfg.MOB_TYPES[v], '值 ' + v + ' 未注册');
    assert.notStrictEqual(k, v, '不自克');
  }
  assert.strictEqual(C.zombie, 'skeleton');
  assert.strictEqual(C.skeleton, 'creeper');
  assert.strictEqual(C.creeper, 'golem');
  assert.strictEqual(C.golem, 'zombie', '经典四环闭环');
});

test('飞行边界与数量上限: 巡飞约束半径大于击退回调半径, MAX_MOBS 为正', () => {
  assert.strictEqual(ArenaCore.FLY_KNOCK_R, 2);
  assert.strictEqual(ArenaCore.FLY_ORBIT_R, 2.5);
  assert.ok(ArenaCore.FLY_ORBIT_R > ArenaCore.FLY_KNOCK_R, '巡飞约束档更宽松');
  assert.strictEqual(ArenaCore.MAX_MOBS, 1000);
  assert.ok(ArenaCore.MAX_MOBS > 0);
});

/* ============ 叶子纯函数 ============ */

test('angleLerp: 环形最短弧插值(跨 0/2π 走短边), t 超界钳到 1', () => {
  const TAU = Math.PI * 2;
  const norm = (a) => ((a % TAU) + TAU) % TAU;
  const near = (a, b) => {
    const d = Math.abs(norm(a) - norm(b));
    return d < 1e-9 || Math.abs(d - TAU) < 1e-9;
  };
  assert.strictEqual(ArenaCore.angleLerp(0, 1, 0.5), 0.5); // 区间内线性
  assert.strictEqual(ArenaCore.angleLerp(0, Math.PI, 0.5), Math.PI / 2);
  assert.ok(near(ArenaCore.angleLerp(1.75 * Math.PI, 0.25 * Math.PI, 1), 0.25 * Math.PI),
      '跨 2π 正向走 +90° 短弧');
  assert.ok(near(ArenaCore.angleLerp(0.25 * Math.PI, 1.75 * Math.PI, 1), 1.75 * Math.PI),
      '跨 0 反向走 -90° 短弧');
  assert.ok(near(ArenaCore.angleLerp(Math.PI, 0, 1), 0), '恰好对向取 -π 分支');
  assert.strictEqual(ArenaCore.angleLerp(0, 2, 5), 2); // t>1 钳到 1
  assert.strictEqual(ArenaCore.angleLerp(0, 2, 0), 0); // t=0 不动
});

test('mobSpeed: 各旗标乘子按现状叠加(狂暴/群体冲锋/突进/蛮冲/减速/晋升档)', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);
  const mk = (o) => Object.assign({cfg: {speed: 2}, raged: false, rageBuffT: 0,
    burstT: 0, chargeT: 0, slowT: 0, level: 1}, o);
  close(ArenaCore.mobSpeed(mk({})), 2); // 基线
  close(ArenaCore.mobSpeed(mk({raged: true})), 3); // 狂暴 ×1.5
  close(ArenaCore.mobSpeed(mk({rageBuffT: 1})), 2.5); // 群体冲锋 buff ×1.25
  close(ArenaCore.mobSpeed(mk({burstT: 1})), 3.6); // 疾爬突进 ×1.8
  close(ArenaCore.mobSpeed(mk({chargeT: 1})), 4.4); // 蛮冲 ×2.2
  close(ArenaCore.mobSpeed(mk({slowT: 1})), 1.2); // 阴风减速 ×0.6
  close(ArenaCore.mobSpeed(mk({level: 2})), 2.2); // 精英 ×1.1
  close(ArenaCore.mobSpeed(mk({level: 3})), 2.4); // 王者 ×1.2
  close(ArenaCore.mobSpeed(mk({raged: true, slowT: 1})), 1.8); // 叠加 ×1.5×0.6
  close(ArenaCore.mobSpeed(mk({raged: true, level: 3})), 3.6); // 叠加 ×1.5×1.2
});

test('星级: tierStars/tierHot 在 level 阈值边界(1 无星 · 2 一星 · 3 两星)', () => {
  assert.strictEqual(ArenaCore.tierStars({level: 1}), '');
  assert.strictEqual(ArenaCore.tierHot({level: 1}), false);
  assert.strictEqual(ArenaCore.tierStars({level: 2}), '★');
  assert.strictEqual(ArenaCore.tierHot({level: 2}), true);
  assert.strictEqual(ArenaCore.tierStars({level: 3}), '★★');
  assert.strictEqual(ArenaCore.tierHot({level: 3}), true);
});

test('翻盘系数: comebackMult 随敌我血量差单调, 均势/领先封底 1', () => {
  const m = ArenaCore.comebackMult;
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);
  close(m(1, 1), 1); // 均势不加成
  close(m(1, 0), 1); // 领先方封底 1
  close(m(0.5, 0.5), 1);
  close(m(0, 1), 1.8); // 打到底的落后加成 1+0.8
  close(m(0.2, 1), 1.64);
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      const mine = i / 4; const theirs = j / 4;
      if (j < 4) assert.ok(m(mine, theirs + 0.25) >= m(mine, theirs) - 1e-12, '敌方占比升 → 加成不降');
      if (i < 4) assert.ok(m(mine + 0.25, theirs) <= m(mine, theirs) + 1e-12, '己方占比升 → 加成不增');
    }
  }
});

test('合体探测: fusingCreeperNear 距离边界与例外口径(清单参数化, 不读全局)', () => {
  const m = {type: 'zombie', fuse: -1, team: 'A', pos: {x: 0, z: 0},
    cfg: {ranged: false, range: 2, dmg: 5}, dmgMult: 1};
  const creep = (x, hp) => ({type: 'creeper', fuse: 1, team: 'B', pos: {x, z: 0}, hp});
  assert.strictEqual(ArenaCore.fusingCreeperNear(m, []), null); // 空清单
  assert.strictEqual(ArenaCore.fusingCreeperNear(m, [creep(5.4, 10)]).pos.x, 5.4); // <5.5 命中
  assert.strictEqual(ArenaCore.fusingCreeperNear(m, [creep(5.6, 10)]), null); // ≥5.5 不构成威胁
  assert.strictEqual(ArenaCore.fusingCreeperNear(m, [creep(1, 3)]), null); // 贴脸两击(5×1×2≥3)能反杀
  assert.strictEqual(ArenaCore.fusingCreeperNear(m, [creep(4.9, 10)]).pos.x, 4.9); // 远程位(超出 range): 逃
  assert.strictEqual(ArenaCore.fusingCreeperNear(m, [creep(1, 999)]).pos.x, 1); // 两击打不死: 逃
  assert.strictEqual(ArenaCore.fusingCreeperNear(m, [Object.assign(creep(1, 3), {team: 'A'})]),
      null, '同阵营跳过');
  const self = Object.assign({}, m, {type: 'creeper', fuse: 2});
  assert.strictEqual(ArenaCore.fusingCreeperNear(self, [creep(1, 3)]), null, '自己读条中不逃');
  const archer = Object.assign({}, m, {cfg: {ranged: true, range: 14, dmg: 6}});
  assert.strictEqual(ArenaCore.fusingCreeperNear(archer, [creep(1, 3)]).pos.x, 1, '远程不吃两击例外');
});
