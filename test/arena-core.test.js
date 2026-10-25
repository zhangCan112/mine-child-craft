'use strict';
/* 竞技场核心 (js/arena-core.js) 单测 — node --test (零依赖)
   运行: node --test test/arena-core.test.js
   C3-T1 剥核后的同名单测(conventions §1.2 守门), 装载器走 adventure-core 档:
   C3-T2 起核心的地形段经全局名消费 voxel(hashRand/setBlockRaw)与
   scene-kit(SceneKit), vm 装齐 config+mob-registry+voxel+scene-kit 四件
   (adventure-core 档 + mob-registry: MOB 四表自 config 拆出, 2026-10 候选 8,
   ARENA_POWER 键集与编队池折算读 MOB_TYPES), 全局名桥到主域后 require 被测核心(经典 script 词法环境的
   Node 侧镜像); 几何派生断言用换桩重载(vm 新环境注入不同世界尺寸)证明
   「派生而非硬编码」。C3-T3/C3-T4 的快照→意图段用小假 roster/候选快照直测,
   索敌权重的距离用与 core 同源的 hashRand 个体偏好自适应构造(把被测
   权重放进「无加成必输、有加成必赢」区间)。战斗编排/技能 tick 观感半的
   行为面由 test/boot.test.js 全链冒烟守着, 两份互不重复。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 装载器(adventure-core 档): 真引擎件先载 vm, 全局名桥主域, 再 require 被测核心 ---------- */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/voxel.js', 'js/scene-kit.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const cfg = vm.runInContext('({WORLD_W, WORLD_D, MOB_TYPES, BLOCKS})', eng);
Object.assign(globalThis, vm.runInContext(
    '({WORLD_W, WORLD_D, MOB_TYPES, hashRand, setBlockRaw, SceneKit})', eng));
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

test('战力: ARENA_POWER 键集都在 mob-registry MOB_TYPES(菜单文案直读 name), 数值为正', () => {
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

test('晋升档位: TIER_MULT 恰有 1/2/3 三档且逐档增强(1=基础档无加成), TIER_NAME 键为 2/3', () => {
  assert.deepStrictEqual(Object.keys(ArenaCore.TIER_MULT).map(Number).sort(), [1, 2, 3]);
  assert.deepStrictEqual(Object.keys(ArenaCore.TIER_NAME).map(Number).sort(), [2, 3]);
  assert.deepStrictEqual(ArenaCore.TIER_MULT[1], {hp: 1, dmg: 1, spd: 1}, '基础档系数全 1');
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

/* ============ 三期: 快照→意图段(索敌/协同/分裂/计时/判负/节奏/阴风) ============ */

test('索敌权重: 窗口内不换目标; 克制/残血/可达/粘性权重序确定, rand 抖动可注入', () => {
  const w = (mid, cid) => 0.75 + hashRand(mid*97 + cid*13, cid*29 + mid*7)*0.5; // 与 core 同源的确定性个体偏好
  const snap = (o) => Object.assign({retargetT: 0, target: null, targetId: null,
    id: 1, team: 'A', type: 'zombie', fly: false, ranged: false, x: 0, z: 0}, o);
  const cand = (o) => Object.assign({id: 0, team: 'B', type: 'creeper', mfam: null,
    dead: false, gone: false, hp: 100, maxHp: 100, fly: false, ranged: false, x: 0, z: 0}, o);
  /* 窗口内(目标活着且计时>0): 只递减 retargetT, 不出 targetId */
  assert.deepStrictEqual(
      ArenaCore.retarget(snap({retargetT: 1, target: {dead: false, gone: false}, targetId: 7}),
          [], 0.25),
      {retargetT: 0.75});
  /* 目标死亡/计时到窗都立即重索敌 */
  const one = [cand({id: 2, x: 5, z: 0})];
  assert.strictEqual(ArenaCore.retarget(snap({retargetT: 5, target: {dead: true, gone: false}}),
      one, 0.25).targetId, 2, '目标阵亡立即重索敌');
  assert.strictEqual(ArenaCore.retarget(snap({retargetT: 0.1, target: {dead: false, gone: false}}),
      one, 0.25).targetId, 2, '计时到窗重索敌');
  /* 过滤: 自身/同阵营/死者/逃逸者不进候选; 全滤空 → 清空目标 */
  const junk = [cand({id: 1}), cand({team: 'A', id: 3}), cand({id: 4, dead: true}),
    cand({id: 5, gone: true})];
  assert.strictEqual(ArenaCore.retarget(snap({}), junk, 0.25).targetId, null);
  /* 克制(COUNTER.zombie→skeleton ×0.65): 把克制对象放远到「无加成必输、有加成必赢」区间 */
  const dCounter = (10*Math.sqrt(0.65*w(1, 2)/w(1, 3)) + 10*Math.sqrt(w(1, 2)/w(1, 3))) / 2;
  const pair = [cand({id: 2, type: 'skeleton', x: 10}), cand({id: 3, x: dCounter})];
  assert.strictEqual(ArenaCore.retarget(snap({type: 'zombie'}), pair, 0.25).targetId, 2, '克制对象胜');
  assert.strictEqual(ArenaCore.retarget(snap({type: 'witch'}), pair, 0.25).targetId, 3, '无克制关系近者胜');
  /* 收割残血(×0.55): 把残血者放远到「无加成必输、有加成必赢」区间 */
  const dWound = (10*Math.sqrt(w(1, 4)/w(1, 5)) + 10*Math.sqrt(w(1, 4)/(0.55*w(1, 5)))) / 2;
  const wounded = [cand({id: 4, x: 10}), cand({id: 5, x: dWound, hp: 10, maxHp: 100})];
  assert.strictEqual(ArenaCore.retarget(snap({}), wounded, 0.25).targetId, 5, '残血优先');
  wounded[1].hp = 100; // 对照: 不残血时近者胜
  assert.strictEqual(ArenaCore.retarget(snap({}), wounded, 0.25).targetId, 4);
  /* 可达性(地面近战对飞行 ×4) */
  /* 可达性(地面近战对飞行 ×4): 地面目标放在「近战必选它、远程必选更近飞行」区间 */
  const dReach = 7.5*Math.sqrt(w(1, 6)/w(1, 7));
  const flyPair = [cand({id: 6, fly: true, x: 5}), cand({id: 7, x: dReach})];
  assert.strictEqual(ArenaCore.retarget(snap({}), flyPair, 0.25).targetId, 7, '地面近战弃近处飞行选地面');
  assert.strictEqual(ArenaCore.retarget(snap({ranged: true}), flyPair, 0.25).targetId, 6, '远程无 ×4 惩罚选更近的飞行');
  /* 目标粘性(×0.75): 现任目标在「无粘性必输、有粘性必赢」区间留任 */
  const dSticky = (8*Math.sqrt(0.75*w(1, 8)/w(1, 9)) + 8*Math.sqrt(w(1, 8)/w(1, 9))) / 2;
  const sticky = [cand({id: 8, x: 8}), cand({id: 9, x: dSticky})];
  assert.strictEqual(ArenaCore.retarget(snap({targetId: 8, target: {dead: true, gone: false}}),
      sticky, 0.25).targetId, 8, '粘性留任');
  assert.strictEqual(ArenaCore.retarget(snap({}), sticky, 0.25).targetId, 9, '无粘性近者胜');
  /* rand 抖动: 重索敌节拍 0.5+rand*0.4 可注入 */
  assert.strictEqual(ArenaCore.retarget(snap({}), one, 0.25, () => 0).retargetT, 0.5);
  assert.strictEqual(ArenaCore.retarget(snap({}), one, 0.25, () => 1).retargetT, 0.9);
});

test('袭击协同: 未到拍只递减; 到拍按 10 格内同族同阵营计数出 dmgMult(至多 +24%)', () => {
  assert.deepStrictEqual(ArenaCore.raidTick({raidT: 1, team: 'A', level: 2, x: 0, z: 0}, [], 0.25),
      {raidT: 0.75}, '未到拍不出 dmgMult');
  const roster = [
    {mfam: 'illager', team: 'A', dead: false, gone: false, x: 0, z: 0}, // 自己口径(计入 n)
    {mfam: 'illager', team: 'A', dead: false, gone: false, x: 5, z: 0}, // 队友 +1
    {mfam: 'illager', team: 'A', dead: true, gone: false, x: 1, z: 0}, // 死者不计
    {mfam: 'illager', team: 'B', dead: false, gone: false, x: 1, z: 0}, // 敌队不计
    {mfam: 'zombie_line', team: 'A', dead: false, gone: false, x: 1, z: 0}, // 异族不计
    {mfam: 'illager', team: 'A', dead: false, gone: false, x: 50, z: 0}, // 超距不计
  ]; // n=2
  const due = ArenaCore.raidTick({raidT: 0.1, team: 'A', level: 2, x: 0, z: 0}, roster, 0.25);
  assert.strictEqual(due.raidT, 0.4);
  assert.ok(Math.abs(due.dmgMult - 1.4*1.06) < 1e-9, 'TIER_MULT[2].dmg × (1+0.06×1)');
  assert.ok(Math.abs(ArenaCore.raidTick({raidT: -1, team: 'A', level: 3, x: 0, z: 0},
      roster.slice(0, 1), 0.25).dmgMult - 2.0) < 1e-9, '独狼无加成');
  const pack = roster.slice(0, 1).concat([1, 2, 3, 4, 5, 6].map((i) =>
    ({mfam: 'illager', team: 'A', dead: false, gone: false, x: i, z: 0}))); // n=7
  assert.ok(Math.abs(ArenaCore.raidTick({raidT: 0, team: 'A', level: 2, x: 0, z: 0},
      pack, 0.25).dmgMult - 1.4*1.24) < 1e-9, '协同封顶 +24%(min(4, n-1))');
});

test('袭击协同·缺陷修复: level=1 到拍不再 TypeError, 基础档 dmgMult=1×协同加成', () => {
  // e160d46 起 TIER_MULT 缺 1 档, 灾厄帮 level=1 到拍必炸(raidT 初值 0~0.4s);
  // 2026-10-25 补基础档 {1,1,1} 后: 独狼 1.0, 双人组 1.06 — 与 dmgMult 初值对齐
  const solo = [{mfam: 'illager', team: 'A', dead: false, gone: false, x: 0, z: 0}];
  assert.ok(Math.abs(ArenaCore.raidTick({raidT: 0, team: 'A', level: 1, x: 0, z: 0},
      solo, 0.25).dmgMult - 1.0) < 1e-9, '独狼基础档无加成');
  const duo = solo.concat([{mfam: 'illager', team: 'A', dead: false, gone: false, x: 5, z: 0}]);
  assert.ok(Math.abs(ArenaCore.raidTick({raidT: 0, team: 'A', level: 1, x: 0, z: 0},
      duo, 0.25).dmgMult - 1.06) < 1e-9, '双人组 +6%');
});

test('分裂决策: 开战且未超限才出延迟队列条目; 小只/未开战/存活超 600 停(防爆仓)', () => {
  const snap = {splitChild: false, fighting: true, team: 'A', type: 'slime',
    x: 3.5, z: -2, k2: 2, k3: 5};
  assert.deepStrictEqual(ArenaCore.splitReq(snap, 600),
      {team: 'A', type: 'slime', x: 3.5, z: -2, k2: 2, k3: 5});
  assert.strictEqual(ArenaCore.splitReq(snap, 601), null, '存活超 600 停');
  assert.strictEqual(ArenaCore.splitReq(Object.assign({}, snap, {splitChild: true}), 10), null, '小只不再分裂');
  assert.strictEqual(ArenaCore.splitReq(Object.assign({}, snap, {fighting: false}), 10), null, '未开战不分裂');
});

test('计时递减: 13 字段各减 dt、已≤0 不动(可过零负), 攻节拍字段不在册且入参只读', () => {
  const s = {slamCd: 1, pounceCd: 0.5, rageBuffT: 2, burstCd: 0.25, burstT: 0,
    chargeCd: -1, chargeT: 0.75, tpCd: 5, stoneT: 0.25, stoneCd: 12, slowT: 1.5,
    invulnT: 0.5, rockCd: 4, attackCd: 9, attackT: 1};
  const o = ArenaCore.decayTimers(s, 0.25);
  assert.deepStrictEqual(o, {slamCd: 0.75, pounceCd: 0.25, rageBuffT: 1.75, burstCd: 0,
    burstT: 0, chargeCd: -1, chargeT: 0.5, tpCd: 4.75, stoneT: 0, stoneCd: 11.75,
    slowT: 1.25, invulnT: 0.25, rockCd: 3.75});
  assert.strictEqual(o.attackCd, undefined, '攻节拍归 CombatCore.tickCadence');
  assert.strictEqual(o.attackT, undefined);
  assert.strictEqual(s.slamCd, 1, '入参只读(落回归壳)');
});

test('判负判定: 部署中/双方存活=继续打; 单侧存活=胜方; 双灭=平', () => {
  assert.strictEqual(ArenaCore.battleEnd(true, true, 0), null);
  assert.strictEqual(ArenaCore.battleEnd(true, false, 0), 'A');
  assert.strictEqual(ArenaCore.battleEnd(false, true, 0), 'B');
  assert.strictEqual(ArenaCore.battleEnd(false, false, 0), 'draw');
  assert.strictEqual(ArenaCore.battleEnd(false, false, 3), null, '部署未完不判负(未到场≠全灭)');
  assert.strictEqual(ArenaCore.battleEnd(false, true, 1), null);
});

test('骷髅节奏: 强力箭除数(族版基础 2/其余基础 3·精英起 2) 与 节奏重斩拍(基础每 3 击·精英每 2 击)', () => {
  assert.strictEqual(ArenaCore.volleyDiv(true, 1), 2, '骷髅一家基础即密(D7)');
  assert.strictEqual(ArenaCore.volleyDiv(false, 1), 3, '其余族基础每 3 箭');
  assert.strictEqual(ArenaCore.volleyDiv(false, 2), 2, '精英起加密');
  assert.strictEqual(ArenaCore.volleyDiv(false, 3), 2);
  assert.strictEqual(ArenaCore.volleyDiv(true, 3), 2);
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map((n) => ArenaCore.skeletonHeavySwing(n, 1)),
      [false, false, true, false, false, true], '基础每 3 击重斩');
  assert.deepStrictEqual([1, 2, 3, 4].map((n) => ArenaCore.skeletonHeavySwing(n, 2)),
      [false, true, false, true], '精英每 2 击重斩');
});

test('阴风判定: 攻击方主族是鬼返回 1.5 秒减速时长, 其余 0', () => {
  assert.strictEqual(ArenaCore.ghostChill('ghost'), 1.5);
  assert.strictEqual(ArenaCore.ghostChill('zombie_line'), 0);
  assert.strictEqual(ArenaCore.ghostChill(null), 0);
});

/* ============ 四期: 家传技能 tick 族(信封意图) + 晋升/击杀结算 + 技能表/分发 ============ */

test('狂暴: 血线阈值按档位(基础 50%/精英 70%), 群体冲锋跨阵营照搬, 王者冲击波参数', () => {
  const snap = (o) => Object.assign({id: 1, raged: false, hp: 100, maxHp: 100, level: 1,
    dmgMult: 1, x: 0, y: 0, z: 0}, o);
  const roster = [
    {id: 1, mfam: 'zombie_line', dead: false, gone: false, x: 1, z: 0}, // 自己(排除)
    {id: 2, mfam: 'zombie_line', team: 'B', dead: false, gone: false, x: 5, z: 0}, // 敌队同族也吃(原口径)
    {id: 3, mfam: 'skeleton_line', dead: false, gone: false, x: 1, z: 0}, // 异族
    {id: 4, mfam: 'zombie_line', dead: true, gone: false, x: 1, z: 0}, // 死者
    {id: 5, mfam: 'zombie_line', dead: false, gone: true, x: 1, z: 0}, // 逃逸者
    {id: 6, mfam: 'zombie_line', dead: false, gone: false, x: 7, z: 0}, // 环外(基础 rr=6)
  ];
  assert.strictEqual(ArenaCore.rageTick(snap({hp: 60}), roster), null, '基础档血线 50% 未到');
  assert.strictEqual(ArenaCore.rageTick(snap({level: 2, hp: 75}), roster), null, '精英档血线 70% 未到');
  assert.strictEqual(ArenaCore.rageTick(snap({raged: true, hp: 10}), roster), null, '已狂暴不重入');
  const it = ArenaCore.rageTick(snap({hp: 49}), roster);
  assert.strictEqual(it.writes.raged, true);
  assert.deepStrictEqual(it.tint, [1.4, 0.5, 0.5]);
  assert.deepStrictEqual(it.buff, [2], '环内同族(敌队照吃), 排除自己/死者/逃逸/异族/环外');
  assert.strictEqual(it.buffT, 4); // 基础冲锋 4s
  assert.strictEqual(it.fx, undefined, '非王者无冲击波观感');
  assert.strictEqual(it.shock, undefined);
  assert.strictEqual(it.sfx, 'roar');
  const elite = ArenaCore.rageTick(snap({level: 2, hp: 49}), roster);
  assert.deepStrictEqual(elite.buff, [2, 6], '精英 rr=9 收编环外同族');
  const king = ArenaCore.rageTick(snap({level: 3, hp: 49, dmgMult: 2}), roster);
  assert.strictEqual(king.buffT, 5); // 王者冲锋 5s
  assert.strictEqual(king.fx, 'rage');
  assert.deepStrictEqual(king.shock, {x: 0, y: 0, z: 0, r: 5, dmg: 20, fallOff: 0.5,
    kpow: 1.2, stagger: 0.8, dyGate: 4}, '冲击波参数 dmg=10×dmgMult');
});

test('疾爬突进/蛮冲: 距离门(3~10 / 3~9)与档位冷却, 起手字段', () => {
  const bs = (o) => Object.assign({id: 1, burstCd: 0, burstT: 0, chargeCd: 0, chargeT: 0,
    level: 1, x: 0, z: 0, target: {dead: false, gone: false, x: 5, z: 0}}, o);
  assert.deepStrictEqual(ArenaCore.burstTick(bs()),
      {writes: {burstCd: 6, burstT: 1.1}, fx: 'burst'});
  assert.strictEqual(ArenaCore.burstTick(bs({level: 2})).writes.burstCd, 4.5, '精英冷却减档');
  assert.strictEqual(ArenaCore.burstTick(bs({target: {dead: false, gone: false, x: 2.9, z: 0}})), null, '贴脸不用突进');
  assert.strictEqual(ArenaCore.burstTick(bs({target: {dead: false, gone: false, x: 10.1, z: 0}})), null, '超距够不着');
  assert.strictEqual(ArenaCore.burstTick(bs({burstCd: 1})), null, '冷却中');
  assert.strictEqual(ArenaCore.burstTick(bs({burstT: 1})), null, '突进中');
  assert.strictEqual(ArenaCore.burstTick(bs({target: null})), null);
  assert.strictEqual(ArenaCore.burstTick(bs({target: {dead: true, gone: false, x: 5, z: 0}})), null);
  const cs = bs();
  assert.deepStrictEqual(ArenaCore.chargeTick(cs),
      {writes: {chargeCd: 7, chargeT: 0.8, chargeYaw: Math.PI/2}, fx: 'charge', sfx: 'roar'},
      'chargeYaw 锁定目标方向(东=π/2)');
  assert.strictEqual(ArenaCore.chargeTick(bs({level: 2})).writes.chargeCd, 5);
  assert.strictEqual(ArenaCore.chargeTick(bs({target: {dead: false, gone: false, x: 9.1, z: 0}})), null, '蛮冲门 3~9');
});

test('磐石: 血量跌破 40% 才坚守 3s, 档位冷却', () => {
  const gs = (o) => Object.assign({id: 1, stoneCd: 0, stoneT: 0, hp: 100, maxHp: 100,
    level: 1, x: 0, z: 0}, o);
  assert.strictEqual(ArenaCore.guardTick(gs({hp: 40})), null, '恰好 40% 不触发(跌破口径)');
  assert.deepStrictEqual(ArenaCore.guardTick(gs({hp: 39.9})),
      {writes: {stoneT: 3, stoneCd: 12}, fx: 'guard', sfx: 'roar'});
  assert.strictEqual(ArenaCore.guardTick(gs({level: 2, hp: 39.9})).writes.stoneCd, 9, '精英冷却减档');
  assert.strictEqual(ArenaCore.guardTick(gs({hp: 39.9, stoneCd: 1})), null, '冷却中');
  assert.strictEqual(ArenaCore.guardTick(gs({hp: 39.9, stoneT: 1})), null, '坚守中');
});

test('颤栗瞬移: 距离门与档位冷却, rand 注入确定性与场内圆钳制(rIn-1.5)', () => {
  const AR = ArenaCore.ARENA;
  const bs = (o) => Object.assign({id: 1, tpCd: 0, level: 1, x: AR.cx, z: AR.cz,
    target: {dead: false, gone: false, x: AR.cx+20, z: AR.cz}}, o);
  assert.strictEqual(ArenaCore.blinkTick(bs({tpCd: 1})), null, '冷却中');
  assert.strictEqual(ArenaCore.blinkTick(bs({target: null})), null);
  assert.strictEqual(ArenaCore.blinkTick(bs({target: {dead: false, gone: false,
    x: AR.cx+7, z: AR.cz}})), null, '8 格内不闪');
  const it = ArenaCore.blinkTick(bs(), null, 0.1, () => 0); // a=0, rr=2.5: 正北落点
  assert.strictEqual(it.writes.tpCd, 5);
  assert.ok(Math.abs(it.tp.x - (AR.cx+20)) < 1e-9);
  assert.ok(Math.abs(it.tp.z - (AR.cz+2.5)) < 1e-9);
  assert.ok(Math.abs(it.steerYaw - Math.atan2(0, -2.5)) < 1e-9, '落点回望目标');
  assert.strictEqual(it.sfx, 'hit');
  assert.strictEqual(ArenaCore.blinkTick(bs({level: 2}), null, 0.1, () => 0).writes.tpCd, 3.5, '精英冷却减档');
  const wall = ArenaCore.blinkTick(bs({target: {dead: false, gone: false, x: AR.cx+40, z: AR.cz}}),
      null, 0.1, () => 0.5); // a=π, rr=3: 落点越墙 → 圆钳制
  const cd = Math.hypot(wall.tp.x-AR.cx, wall.tp.z-AR.cz);
  assert.ok(Math.abs(cd - (AR.rIn-1.5)) < 1e-9, '钳到内墙内沿');
});

test('晋升数值半: levelUpIntent 两跳(1→2 / 2→3)的档位公式与体型/名牌放大', () => {
  assert.deepStrictEqual(ArenaCore.levelUpIntent(1),
      {level: 2, hpMult: 1.6, dmgMult: 1.4, invulnT: 0.5, tierScale: 1.3, labelScale: 1.25});
  assert.deepStrictEqual(ArenaCore.levelUpIntent(2),
      {level: 3, hpMult: 2.5, dmgMult: 2, invulnT: 0.5, tierScale: 1.6, labelScale: 1.5});
});

test('击杀结算决策半: 翻盘信用/敌对口径/苦力怕特权 rand 注入', () => {
  const roster = [
    {id: 1, type: 'zombie', team: 'A', dead: false, gone: false}, // 击杀者本人
    {id: 2, type: 'creeper', team: 'A', dead: false, gone: false}, // 敌队苦力怕(victim=B)
    {id: 3, type: 'creeper', team: 'B', dead: false, gone: false}, // 同队苦力怕(排除)
    {id: 4, type: 'creeper', team: 'A', dead: true, gone: false}, // 死者(排除)
    {id: 5, type: 'skeleton', team: 'A', dead: false, gone: false}, // 非苦力怕
    {id: 6, type: 'creeper', team: 'A', dead: false, gone: false}, // 第二只候选
  ];
  const fracs = {killer: 0.5, other: 1}; // mult = 1+0.8×0.5 = 1.4
  const k = {id: 1, team: 'A', dead: false, gone: false};
  const p0 = ArenaCore.awardKillPlan(k, 'B', roster, fracs, () => 0);
  assert.strictEqual(p0.mult, 1.4);
  assert.strictEqual(p0.credit, 1.4, '敌对击杀全额信用');
  assert.strictEqual(p0.creeperPickId, 2, 'rand=0 选清单首只(排除击杀者/同队/死者/非苦力怕)');
  assert.strictEqual(ArenaCore.awardKillPlan(k, 'B', roster, fracs, () => 0.999999).creeperPickId,
      6, 'rand→1 选清单末只');
  assert.strictEqual(
      ArenaCore.awardKillPlan({id: 9, team: 'B', dead: false, gone: false}, 'B', roster, fracs, () => 0).credit,
      0, '击杀者与受害者同队不给信用');
  assert.strictEqual(ArenaCore.awardKillPlan(null, 'B', roster, fracs, () => 0).credit, 0, '无击杀者(环境杀)');
  assert.strictEqual(
      ArenaCore.awardKillPlan({id: 1, team: 'A', dead: true, gone: false}, 'B', roster, fracs, () => 0).credit,
      0, '阵亡击杀者不给');
  assert.strictEqual(ArenaCore.awardKillPlan(k, 'A', [roster[0]], fracs, () => 0).creeperPickId,
      undefined, '无候选苦力怕不出转投键');
});

test('技能表与分发: 表完整性(tick 直引 core 函数/laser 旗标/豁免形) + familyTick 路由 + familyMain 折算', () => {
  assert.strictEqual(ArenaCore.FAMILY_SKILLS.zombie_line.tick, ArenaCore.rageTick);
  assert.strictEqual(ArenaCore.FAMILY_SKILLS.arthropod.tick, ArenaCore.burstTick);
  assert.strictEqual(ArenaCore.FAMILY_SKILLS.pig_line.tick, ArenaCore.chargeTick);
  assert.strictEqual(ArenaCore.FAMILY_SKILLS.guard.tick, ArenaCore.guardTick);
  assert.strictEqual(ArenaCore.FAMILY_SKILLS.illager.tick, ArenaCore.raidTick);
  assert.strictEqual(ArenaCore.FAMILY_SKILLS.slime_line.onDead, ArenaCore.splitReq);
  assert.strictEqual(ArenaCore.FAMILY_SKILLS.skeleton_line.tick, null, '节拍型: 节奏两件在发射/挥击处');
  assert.strictEqual(ArenaCore.FAMILY_SKILLS.ghost.tick, null, '命中型: damageMob 的 src 判定');
  assert.strictEqual(ArenaCore.MOB_QUIRKS.guardian.laser, true, '蓄力激光旗标型(施放留壳)');
  assert.strictEqual(ArenaCore.MOB_QUIRKS.elder_guardian.laser, true);
  assert.strictEqual(typeof ArenaCore.MOB_QUIRKS.enderman.tick, 'function');
  for (const [k, q] of Object.entries(ArenaCore.MOB_QUIRKS)) { // 豁免形保留: 条目键集只许这三类
    for (const f of Object.keys(q)) assert.ok(['laser', 'tick', 'familySkill'].includes(f), k + ' 出现未约定键 ' + f);
  }
  /* familyTick 路由: 真 entry 走对应 tick, tick:null 与空 entry 短路 */
  const rageSnap = {id: 1, raged: true, hp: 10, maxHp: 100, level: 1, x: 0, y: 0, z: 0};
  assert.strictEqual(ArenaCore.familyTick(ArenaCore.FAMILY_SKILLS.zombie_line, rageSnap, [], 0.1), null);
  const burstSnap = {id: 1, burstCd: 0, burstT: 0, level: 1, x: 0, z: 0,
    target: {dead: false, gone: false, x: 5, z: 0}};
  assert.deepStrictEqual(ArenaCore.familyTick(ArenaCore.FAMILY_SKILLS.arthropod, burstSnap, [], 0.1),
      {writes: {burstCd: 6, burstT: 1.1}, fx: 'burst'});
  assert.strictEqual(ArenaCore.familyTick(ArenaCore.FAMILY_SKILLS.skeleton_line, burstSnap, [], 0.1), null);
  assert.strictEqual(ArenaCore.familyTick(null, burstSnap, [], 0.1), null);
  /* familyOnDead: 软软族出分裂条目(分发进 core), 其余族 null */
  const dSnap = {splitChild: false, fighting: true, team: 'A', type: 'slime', x: 1, z: 2, k2: 2, k3: 5};
  assert.deepStrictEqual(ArenaCore.familyOnDead('slime_line', dSnap, 10),
      {team: 'A', type: 'slime', x: 1, z: 2, k2: 2, k3: 5});
  assert.strictEqual(ArenaCore.familyOnDead('zombie_line', dSnap, 10), null);
  /* familyMain: 主族折算经全局 MOB_TYPES, 未注册回落 null */
  assert.strictEqual(ArenaCore.familyMain('zombie'), 'zombie_line');
  assert.strictEqual(ArenaCore.familyMain('no_such_type'), null);
});
