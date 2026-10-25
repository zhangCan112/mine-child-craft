'use strict';
/* 竞技场核心 (js/arena-core.js) 单测 — node --test (零依赖)
   运行: node --test test/arena-core.test.js
   C3-T1 剥核后的同名单测(conventions §1.2 守门), 装载器走 adventure-core 档:
   C3-T2 起核心的地形段经全局名消费 voxel(hashRand/setBlockRaw)与
   scene-kit(SceneKit), vm 装齐 config+voxel+scene-kit 三件(adventure-core
   同款), 全局名桥到主域后 require 被测核心(经典 script 词法环境的
   Node 侧镜像); 几何派生断言用换桩重载(vm 新环境注入不同世界尺寸)证明
   「派生而非硬编码」。战斗编排/技能 tick/索敌权重的行为面由
   test/boot.test.js 全链冒烟守着, 两份互不重复。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 装载器(adventure-core 档): 真引擎件先载 vm, 全局名桥主域, 再 require 被测核心 ---------- */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const cfg = vm.runInContext('({WORLD_W, WORLD_D, MOB_TYPES, BLOCKS})', eng);
Object.assign(globalThis, vm.runInContext(
    '({WORLD_W, WORLD_D, hashRand, setBlockRaw, SceneKit})', eng));
const ArenaCore = require('../js/arena-core.js');

/* 换桩重载: 新 vm 环境注入不同世界尺寸, 证明 ARENA 中心是加载期派生 */
function loadWithSize(w, d) {
  const sandbox = {WORLD_W: w, WORLD_D: d, module: {exports: {}}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/arena-core.js'), 'utf8'),
      sandbox, {filename: 'js/arena-core.js'});
  return sandbox.module.exports;
}

/* 世界快照助手(对真 worldCells 断言, 与 adventure-core.test.js 同款) */
const cell = (x, y, z) => vm.runInContext('worldCells', eng)[(y * cfg.WORLD_D + z) * cfg.WORLD_W + x];
const snapshot = () => Buffer.from(vm.runInContext('worldCells', eng));

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

/* ============ 二期纯段: 配平 / 晋升 / 信用 / 占比 ============ */

test('配平三件套: unitPower/teamPower 算术照搬, balanceTeams 返回新 count 不改入参', () => {
  assert.strictEqual(ArenaCore.unitPower({type: 'zombie'}, 585), 170);
  assert.strictEqual(ArenaCore.unitPower({type: 'mix'}, 585), 585); // 混编吃池均值
  assert.strictEqual(ArenaCore.teamPower({type: 'zombie', count: 8}, 585), 1360);
  /* 配平: round(from 战力 / to 单体战力), 钳 1..MAX_MOBS; lastEdited 选边与
     写回 to.count 的状态语义在壳侧(薄委托), 此处只钉算术与钳位 */
  assert.strictEqual(ArenaCore.balanceTeams({type: 'zombie', count: 8}, {type: 'skeleton'}, 585), 8);
  assert.strictEqual(ArenaCore.balanceTeams({type: 'zombie', count: 8}, {type: 'warden'}, 585), 1,
      'round(1360/4800)=0 → 下钳 1');
  assert.strictEqual(ArenaCore.balanceTeams({type: 'warden', count: 480}, {type: 'zombie'}, 585),
      ArenaCore.MAX_MOBS, '海量弱旅顶上钳');
  const from = {type: 'zombie', count: 8}; const to = {type: 'skeleton', count: 3};
  ArenaCore.balanceTeams(from, to, 585);
  assert.deepStrictEqual([from.count, to.count], [8, 3], '纯函数不改入参(写回归壳)');
});

test('晋升阈值: promoThresholds 在 ec=1/4/7/10/100 的缩放与钳位, k3 恒大于 k2', () => {
  assert.deepStrictEqual(ArenaCore.promoThresholds(1), {k2: 1, k3: 2}); // ceil(0.25)=1, ceil(0.6)=1→k2+1 兜底
  assert.deepStrictEqual(ArenaCore.promoThresholds(4), {k2: 1, k3: 3}); // ceil(1)/ceil(2.4)
  assert.deepStrictEqual(ArenaCore.promoThresholds(7), {k2: 2, k3: 5}); // ceil(1.75)/ceil(4.2)
  assert.deepStrictEqual(ArenaCore.promoThresholds(10), {k2: 3, k3: 6}); // ceil(2.5)/ceil(6)
  assert.deepStrictEqual(ArenaCore.promoThresholds(100), {k2: 6, k3: 14}); // 封顶 6/14 杀
  for (let ec = 1; ec <= 40; ec++) {
    const th = ArenaCore.promoThresholds(ec);
    assert.ok(th.k2 >= 1 && th.k2 <= 6, 'ec=' + ec + ' k2 钳 1..6');
    assert.ok(th.k3 > th.k2 && th.k3 <= 14, 'ec=' + ec + ' k3 钳 k2+1..14');
  }
});

test('击杀信用: killCredit 累计信用并数连跳档数(存活口径留壳, 判定纯算术)', () => {
  assert.deepStrictEqual(ArenaCore.killCredit(0, 1, 1, 2, 5), {kills: 1, ups: 0}); // 未到 k2
  assert.deepStrictEqual(ArenaCore.killCredit(1.75, 0.25, 1, 2, 5), {kills: 2, ups: 1}); // 过 k2 停在 k3 前
  assert.deepStrictEqual(ArenaCore.killCredit(5.5, 0.5, 1, 2, 5), {kills: 6, ups: 2}, '同帧多杀连跳两级');
  assert.deepStrictEqual(ArenaCore.killCredit(10, 5, 3, 2, 5), {kills: 15, ups: 0}, '满级不再升');
  assert.deepStrictEqual(ArenaCore.killCredit(4.75, 0.25, 2, 2, 5), {kills: 5, ups: 1}, '精英位过 k3 升王者');
});

test('队伍血量占比: teamHpFrac 排除死/走, 无基准=1, 超基准钳 1', () => {
  assert.strictEqual(ArenaCore.teamHpFrac([], 'A', 100), 0, '空 roster(全灭)');
  const alive = {team: 'A', hp: 60, dead: false, gone: false};
  const dead = {team: 'A', hp: 40, dead: true, gone: false};
  const gone = {team: 'A', hp: 50, dead: false, gone: true};
  const other = {team: 'B', hp: 30, dead: false, gone: false};
  assert.strictEqual(ArenaCore.teamHpFrac([alive, dead, gone, other], 'A', 100), 0.6);
  assert.strictEqual(ArenaCore.teamHpFrac([{team: 'A', hp: 100, dead: false, gone: false}], 'A', 100), 1, '满血');
  assert.strictEqual(ArenaCore.teamHpFrac([{team: 'A', hp: 120, dead: false, gone: false}], 'A', 100), 1,
      '回血超基准钳 1');
  assert.strictEqual(ArenaCore.teamHpFrac([alive], 'A', 0), 1, '开战前无基准');
});

/* ============ 二期纯段: 编队池 ============ */

test('编队池: mixPool 滤掉 Boss/飞行, mixBuckets 按主族分桶(无族落 lone)', () => {
  const spawnable = ['zombie', 'stray', 'golem', 'warden', 'phantom'];
  const fakeTypes = {
    zombie: {family: ['zombie_line']},
    stray: {family: ['skeleton_line']},
    golem: {}, // 无族标签 → lone(独行侠桶天然存在)
    warden: {boss: true},
    phantom: {fly: true},
  };
  const pool = ArenaCore.mixPool(spawnable, fakeTypes);
  assert.deepStrictEqual(pool, ['zombie', 'stray', 'golem']);
  const buckets = ArenaCore.mixBuckets(pool, fakeTypes);
  assert.deepStrictEqual(buckets.zombie_line, ['zombie']);
  assert.deepStrictEqual(buckets.skeleton_line, ['stray']);
  assert.deepStrictEqual(buckets.lone, ['golem']);
  assert.deepStrictEqual(Object.keys(buckets).sort(), ['lone', 'skeleton_line', 'zombie_line']);
});

test('混编均值: mixAvgPower 按 ARENA_POWER 池内平均(四舍五入)', () => {
  assert.strictEqual(ArenaCore.mixAvgPower(['zombie', 'golem']), 585); // (170+1000)/2
  assert.strictEqual(ArenaCore.mixAvgPower(['zombie']), 170);
});

test('混编抽取: pickMix 两段随机(先族后成员), rand 注入确定性 + 缺省落在池内', () => {
  const buckets = {lone: ['golem'], zombie_line: ['zombie'], skeleton_line: ['stray']};
  const fams = Object.keys(buckets);
  assert.strictEqual(ArenaCore.pickMix(buckets, fams, () => 0), 'golem'); // 首族首员
  assert.strictEqual(ArenaCore.pickMix(buckets, fams, () => 0.99), 'stray'); // 末族首员
  assert.strictEqual(ArenaCore.pickMix(buckets, fams, () => 0.5), buckets[fams[1]][0], '中段族');
  for (let i = 0; i < 20; i++) { // 缺省 rand: 结果必在桶成员并集内
    assert.ok([].concat(...Object.values(buckets)).includes(ArenaCore.pickMix(buckets, fams)));
  }
});

/* ============ 二期纯段: 地形段(对真 worldCells 断言) ============ */

test('选块纯函数: floorBlock 分区/出生垫与 wallBlock 拌料都确定性', () => {
  assert.strictEqual(ArenaCore.floorBlock(0, 0, -1, 0, 1), ArenaCore.ID_REDWOOL, '中央徽章红侧');
  assert.strictEqual(ArenaCore.floorBlock(0, 0, 1, 0, 1), ArenaCore.ID_BLUEWOOL, '中央徽章蓝侧');
  assert.strictEqual(ArenaCore.floorBlock(0, 0, 9.5, 0, 9.5), ArenaCore.ID_QUARTZ, '石英环 r≈9.5');
  assert.strictEqual(ArenaCore.floorBlock(0, 0, -19, 0, 19), ArenaCore.ID_REDWOOL, '红方出生垫');
  assert.strictEqual(ArenaCore.floorBlock(0, 0, 19, 0, 19), ArenaCore.ID_BLUEWOOL, '蓝方出生垫');
  const fillers = [ArenaCore.ID_STONE, ArenaCore.ID_COBBLE, ArenaCore.ID_MOSS];
  for (let x = 12; x < 64; x += 7) { // 环内拌料区: 只出三种石且逐点可复现
    const r = 15; const v1 = ArenaCore.floorBlock(x, 40, 0, 0, r);
    assert.ok(fillers.includes(v1));
    assert.strictEqual(ArenaCore.floorBlock(x, 40, 0, 0, r), v1, '同参同值');
  }
  const wallFillers = [ArenaCore.ID_BRICK, ArenaCore.ID_COBBLE, ArenaCore.ID_MOSS];
  for (let y = 15; y < 40; y += 5) {
    const v1 = ArenaCore.wallBlock(10, y, 30);
    assert.ok(wallFillers.includes(v1));
    assert.strictEqual(ArenaCore.wallBlock(10, y, 30), v1, '同参同值');
  }
});

test('建场: generate 全图确定性(两次生成逐字节一致) + 地基/徽章/石英环/外圈草原落位', () => {
  ArenaCore.generate();
  const a = snapshot();
  ArenaCore.generate(); // 二次建场(重进复现口径)
  const b = snapshot();
  assert.ok(a.equals(b), '两次生成 worldCells 逐字节一致');
  const G = ArenaCore.ARENA.floorY;
  const cx = ArenaCore.ARENA.cx; const cz = ArenaCore.ARENA.cz;
  assert.strictEqual(cell(cx - 1, G, cz - 1), ArenaCore.ID_REDWOOL, '中心偏西一格红徽章');
  assert.strictEqual(cell(cx, G, cz), ArenaCore.ID_BLUEWOOL, '中心偏东一格蓝徽章');
  assert.strictEqual(cell(cx + 9, G, cz - 1), ArenaCore.ID_QUARTZ, '石英环 r≈9.5');
  assert.strictEqual(cell(0, G, 0), ArenaCore.ID_GRASS, '外圈草原(远角)');
  assert.strictEqual(cell(0, 0, 0), ArenaCore.ID_STONE, 'y0 地基');
  assert.strictEqual(cell(cx, G + 12, cz), 0, '场地中央无看台灯(立柱在 rOut 圈上)');
});
