'use strict';
/* 探险核心 (js/adventure-core.js) 单测 — node --test (零依赖)
   运行: node --test test/adventure-core.test.js
   S1 剥核后的同名单测(conventions §1.2 守门): 纯核心只装真引擎件
   (config/voxel/scene-kit/四纯核心/掉落库, 与 test/adventure-mode.test.js
   同一套 vm 惯例)直测——地形确定性必须对着真散布函数断言, 纯函数段
   逐条钉口径; 深交互链(TTS/toast/掉落实体)仍在 adventure-mode.test.js
   经壳行为断言, 两份互不重复。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 真引擎件: config + voxel + scene-kit + 四纯核心/库, 共享一个 vm 词法环境 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/items-core.js',
  'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, blockKey, SceneKit,
  BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT,
  ITEMS, isTool, toolOf, breakTime,
  mkInventory, add, count, remove, damageTool, serialize, deserialize, INV_SLOTS,
  rollBlockDrop, rollDrops, FUEL, fuelUnits, smeltOf,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */

const Core = require('../js/adventure-core.js');

/* ---------- 世界快照与统计助手(对真 worldCells 断言) ---------- */
const W = api.WORLD_W;
const D = api.WORLD_D;
const H = api.WORLD_H;
const cell = (x, y, z) => vm.runInContext('worldCells', eng)[(y * D + z) * W + x];
const snapshot = () => Buffer.from(vm.runInContext('worldCells', eng)); /* 逐字节复现比对 */
function countId(id, pred) {
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (cell(x, y, z) === id && (!pred || pred(x, y, z))) n++;
      }
    }
  }
  return n;
}

/* ============ 地形生成 ============ */

test('核心地形: advBuildWorld 全图确定性(两次生成逐字节一致) + 地层/小屋/湖形状', () => {
  Core.advBuildWorld();
  const a = snapshot();
  assert.strictEqual(cell(10, 24, 10), 1, '地表 y24 草地');
  assert.strictEqual(cell(10, 23, 10), 2, 'y20~23 泥土');
  assert.strictEqual(cell(10, 19, 10), 3, 'y19 及以下石头');
  const hut = Core.ADV_HUT;
  assert.strictEqual(cell(hut.x1, 25, hut.z1), 5, '小屋角柱原木');
  assert.strictEqual(cell(61, 25, hut.z1), 0, '北墙正中门洞');
  const lake = Core.ADV_LAKE;
  assert.ok(countId(api.B_CLAY, (x, y, z) => Math.hypot(x - lake.cx, z - lake.cz) <= lake.r) >= 150,
      '湖底黏土层(红砖链源头)');
  /* 清场重建: 逐字节复现(SceneKit.rand/hashRand 确定性, 零 Math.random) */
  vm.runInContext('worldCells.fill(0)', eng);
  Core.advBuildWorld();
  const b = snapshot();
  assert.deepStrictEqual(a, b, '两次建场 worldCells 逐块一致');
});

test('核心地形: 巢穴位点常量与矿带不越界(地图常量表是壳与单测的共同权威)', () => {
  assert.strictEqual(Core.ADV_NESTS.length, 3, '三巢穴');
  Core.ADV_NESTS.forEach((n, i) => {
    assert.ok(n.x >= 2 && n.x < W - 2 && n.z >= 2 && n.z < D - 2, '巢 ' + i + ' 在界内');
    assert.ok(Array.isArray(n.kinds) && n.kinds.length >= 2, '巢 ' + i + ' 刷怪池');
  });
  let ok = true;
  for (let y = 0; y < H && ok; y++) {
    for (let z = 0; z < D && ok; z++) {
      for (let x = 0; x < W && ok; x++) {
        const id = cell(x, y, z);
        if (id === api.B_COAL_ORE && (y < 12 || y > 20)) ok = false;
        if (id === api.B_DIAMOND_ORE && (y < 0 || y > 5)) ok = false;
      }
    }
  }
  assert.ok(ok, '矿种不越深度带(煤 y12~20 · 钻 y0~5)');
});

/* ============ 政策纯函数段(逐条钉口径) ============ */

test('核心政策: 死亡计划 — 满血+回出生点+背包保留(零惩罚)', () => {
  const plan = Core.advDeathPlan({hp: 2, maxHp: 30}, Core.ADV_SPAWN);
  assert.deepStrictEqual(plan,
      {hp: 30, x: Core.ADV_SPAWN.x, y: Core.ADV_SPAWN.y, z: Core.ADV_SPAWN.z, yaw: Core.ADV_SPAWN.yaw,
        keepInv: true});
});

test('核心政策: 巢穴节拍/刷怪数/挥击伤害/怪物伤害封顶/掉落清单/播报文案', () => {
  assert.strictEqual(Core.advNestCount(() => 0), Core.ADV_NEST_MIN, '数量下限');
  assert.strictEqual(Core.advNestCount(() => 0.999), Core.ADV_NEST_MAX, '数量上限');
  assert.strictEqual(Core.advNestStep(1, 59, 1).t, 0, '有活怪计时归零');
  assert.strictEqual(Core.advNestStep(0, 59.9, 0.05).spawn, false, '60s 内不刷');
  assert.strictEqual(Core.advNestStep(0, 59.9, 0.2).spawn, true, '到 60s 发刷怪令');
  assert.strictEqual(Core.advSwingDmg('sword_wood'), 7, '木剑 7(D9)');
  assert.strictEqual(Core.advSwingDmg(''), Core.ADV_FIST_DMG, '空手 3');
  assert.strictEqual(Core.advMobDmg({cfg: {dmg: 33}}), Core.ADV_DMG_CAP, '苦力怕 33 封顶 10');
  const drops = Core.advDeathDrops({type: 'zombie', pos: {x: 1, y: 25, z: 2}}, () => 0.5);
  assert.deepStrictEqual(drops, [{id: 'rotten_flesh', n: 1, x: 1, y: 25.8, z: 2}], '保底腐肉, 落点 y+0.8');
  assert.strictEqual(Core.advPickupText(new Map([['coal', 2], ['bone', 1]])),
      '捡到 2 个煤炭、1 个骨头！', '合并播报(进账序)');
});

test('核心政策: 蓄力步进/放置合法性/食物/树苗计时', () => {
  const bt = {time: 1, drops: true};
  let m = Core.advMineStep({t: 0, key: '', need: 0, drops: true}, '5,24,5', bt, 0.4);
  assert.strictEqual(m.t, 0.4, '首帧累计');
  m = Core.advMineStep(m, '5,24,5', bt, 0.7);
  assert.strictEqual(m.done, true, '累计到点');
  assert.strictEqual(m.t, 1, 't 钳在 need');
  assert.strictEqual(Core.advMineStep(m, '9,24,9', {time: 2, drops: false}, 0.3).t, 0.3, '换目标清零');
  assert.strictEqual(Core.advMineStep(m, '', bt, 0.3).t, 0, '指空清零');
  assert.strictEqual(Core.advPlaceCheck({x: 5, y: 24, z: 5, nx: 0, ny: 1, nz: 0}, 2, 1, 0).ok, true,
      '实心块贴顶面 ok');
  assert.strictEqual(Core.advPlaceCheck({x: 5, y: 24, z: 5, nx: 1, ny: 0, nz: 0}, api.B_TORCH, 1, 0).ok,
      false, 'thin 块贴侧面拒');
  assert.deepStrictEqual(Core.advEatPolicy(28, 30, 4), {hp: 30, healed: 2, canEat: true}, '回复钳制');
  assert.strictEqual(Core.advEatPolicy(30, 30, 4).canEat, false, '满血不吃');
  const map = new Map([['1,25,1', {x: 1, y: 25, z: 1, left: 0.5}], ['2,25,2', {x: 2, y: 25, z: 2, left: 3}]]);
  assert.strictEqual(Core.advSapDue(map, 1).length, 1, '到期出清单');
  assert.ok(!map.has('1,25,1') && map.has('2,25,2'), '到期移出, 未到期留队');
});

test('核心政策: 站点判定/烧炼单步/退炉/TNT 掷骰与衰减', () => {
  const sts = [{x: 10, y: 25, z: 10, id: api.B_CRAFT}];
  assert.strictEqual(Core.advNearStation(sts, 14.5, 10.5, 4, api.B_CRAFT), true, '恰 4 格解锁(含等号)');
  assert.strictEqual(Core.advNearStation(sts, 14.6, 10.5, 4, api.B_CRAFT), false, '4.1 格不解锁');
  const s = Core.advSmeltStep({input: {id: 'iron_ore', n: 1}, fuel: {id: 'coal', n: 1},
    out: null, heat: 0, prog: 0}, 2.5);
  assert.deepStrictEqual(s.out, {id: 'iron_ingot', n: 1}, '2.5s 产一件');
  assert.strictEqual(s.heat, 7, '煤热值 8 件, 烧 1 件余 7');
  const inv = api.mkInventory();
  assert.deepStrictEqual(Core.advFurnaceRefund(inv,
      {input: {id: 'iron_ore', n: 3}, fuel: null, out: null, heat: 0, prog: 0}), [], '三笔全退');
  assert.strictEqual(api.count(inv, 'iron_ore'), 3, '退包入账');
  assert.strictEqual(Core.advTntRoll(3, () => 0.69).length, 1, '中签掉落');
  assert.strictEqual(Core.advTntRoll(3, () => 0.7).length, 0, '恰 0.7 不中签');
  assert.strictEqual(Core.advTntDmg(0), Core.ADV_TNT_DMG_HI, '爆心 30');
  assert.strictEqual(Core.advTntDmg(9), Core.ADV_TNT_DMG_LO, '越界钳边缘 12');
});

test('核心任务表: 13 条形状齐 + 谓词口径抽样(全量逐条在 adventure-mode.test.js)', () => {
  assert.strictEqual(Core.ADV_QUESTS.length, 13, '12 步 + 终章');
  assert.strictEqual(Core.ADV_QUESTS[12].finale, true, '第 13 条是终章');
  Core.ADV_QUESTS.forEach((q, i) => {
    assert.ok(q.id && q.icon && q.goal && q.hint && q.praise, '步 ' + i + ' 文案五件套');
    assert.strictEqual(typeof q.prog, 'function', '步 ' + i + ' prog 谓词');
    assert.strictEqual(typeof q.check, 'function', '步 ' + i + ' check 谓词');
  });
  assert.strictEqual(Core.ADV_QUESTS[0].check({collect_log: 3}), true, '步1 最低满足');
  assert.strictEqual(Core.ADV_QUESTS[0].check({collect_log: 2}), false, '步1 差一不满足');
  assert.strictEqual(Core.ADV_MINE_TALLY[3], 'mine_cobble', '石头也计圆石(步5 口径)');
});

/* ============ 提醒政策(S4 纯函数段) ============ */

test('S4① 低耐久预警纯函数: 首次 <0.25 提醒一次, 同命不重复, 重置后再提醒', () => {
  const warned = new Set();
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 1), false, '满耐久不提醒');
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 0.25), false, '恰 0.25 不提醒(严小于)');
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 0.249), true, '首次跌破 0.25 提醒');
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 0.1), false, '同命第二次不唠叨');
  assert.strictEqual(Core.advWearWarn(warned, 'axe_stone', 0.1), true, '别的工具各管各账');
  warned.delete('pick_wood'); /* 破板/消失重置(壳在破板分支 delete) */
  assert.strictEqual(Core.advWearWarn(warned, 'pick_wood', 0.2), true, '重置后(再做一把)再预警');
});

test('S4② 背包快满纯函数: ≥24/27 触发一次, 回落重新武装, 持续满格不重复', () => {
  let r = Core.advBagFullStep(23, true);
  assert.deepStrictEqual(r, {armed: true, fire: false}, '23 格未到线: 保持武装');
  r = Core.advBagFullStep(24, true);
  assert.deepStrictEqual(r, {armed: false, fire: true}, '到 24/27: 开火并缴械');
  r = Core.advBagFullStep(27, r.armed);
  assert.deepStrictEqual(r, {armed: false, fire: false}, '持续满格不重复轰炸');
  r = Core.advBagFullStep(20, r.armed);
  assert.deepStrictEqual(r, {armed: true, fire: false}, '回落(整理/合成腾格子): 重新武装');
  r = Core.advBagFullStep(24, r.armed);
  assert.deepStrictEqual(r, {armed: false, fire: true}, '再满再提醒(回落再满的上升沿口径)');
});

test('S4③ 工具坏话术纯函数: 安抚句 + 任务步 hint 并句(无 hint 不拼)', () => {
  const txt = Core.advBreakToolText('木镐', '打开背包，用原木合成木板吧！');
  assert.ok(txt.indexOf('不哭') >= 0 && txt.indexOf('木镐') >= 0, '安抚句含工具名');
  assert.ok(txt.indexOf('接下来：打开背包') >= 0, '并句当前任务步 hint');
  const done = Core.advBreakToolText('木镐', null);
  assert.ok(done.indexOf('接下来') < 0, '任务全部完成(hint 空)不拼引导');
});
