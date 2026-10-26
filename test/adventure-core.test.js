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

/* ---------- 真引擎件: config + mob-registry + voxel + scene-kit + 四纯核心/库, 共享一个 vm 词法环境 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, blockKey, SceneKit, Daylight,
  BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT, B_BED, Daylight, DAYLIGHT,
  ITEMS, isTool, toolOf, breakTime, stackMax,
  mkInventory, add, count, remove, damageTool, serialize, deserialize, INV_SLOTS,
  rollBlockDrop, rollDrops, FUEL, fuelUnits, smeltOf, SMELT_T,
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

test('F3 金苹果食物政策: advEatPolicy full 旗标 — 半血吃直接回满, 满血不吃口径不回归(二期设计稿 §3)', () => {
  /* full 语义收进政策纯函数: 设计稿原写在模式层 advTryEat 解读, 收编后
     消费方只吃结果(seam 级偏差, 见 F3 报告; 食物回血政策已有本单测先例) */
  assert.deepStrictEqual(Core.advEatPolicy(12, 30, 30, true), {hp: 30, healed: 18, canEat: true},
      'full → hp 直接 maxHp(无饥饿系统: MC 饥饿+吸收+再生折算一次回满)');
  assert.deepStrictEqual(Core.advEatPolicy(10, 30, 4, true), {hp: 30, healed: 20, canEat: true},
      'food 名义值被 full 覆盖: 缺口 20>food 4 也回满(与不加旗标的 14 区分)');
  assert.strictEqual(Core.advEatPolicy(30, 30, 30, true).canEat, false, '满血不吃(旗标不破既有口径)');
  assert.strictEqual(Core.advEatPolicy(30, 30, 30, true).healed, 0, '满血 healed=0');
  /* 无旗标(缺省)走既有口径 — 三参调用方零改动 */
  assert.deepStrictEqual(Core.advEatPolicy(28, 30, 4), {hp: 30, healed: 2, canEat: true});
  assert.deepStrictEqual(Core.advEatPolicy(10, 30, 4), {hp: 14, healed: 4, canEat: true});
});

test('核心政策: 站点判定/TNT 掷骰与衰减', () => {
  const sts = [{x: 10, y: 25, z: 10, id: api.B_CRAFT}];
  assert.strictEqual(Core.advNearStation(sts, 14.5, 10.5, 4, api.B_CRAFT), true, '恰 4 格解锁(含等号)');
  assert.strictEqual(Core.advNearStation(sts, 14.6, 10.5, 4, api.B_CRAFT), false, '4.1 格不解锁');
  /* 烧炼单步 smeltStep/退炉 furnaceRefund 已迁 craft-core, 直测随迁
     test/craft-core.test.js(节拍常量 SMELT_T 同批迁入) */
  assert.strictEqual(Core.advTntRoll(3, () => 0.69).length, 1, '中签掉落');
  assert.strictEqual(Core.advTntRoll(3, () => 0.7).length, 0, '恰 0.7 不中签');
  assert.strictEqual(Core.advTntDmg(0), Core.ADV_TNT_DMG_HI, '爆心 30');
  assert.strictEqual(Core.advTntDmg(9), Core.ADV_TNT_DMG_LO, '越界钳边缘 12');
});

test('核心任务表: 16 条形状齐 + 谓词口径抽样(全量逐条在 adventure-mode.test.js)', () => {
  assert.strictEqual(Core.ADV_QUESTS.length, 16, '引导链 v2: 15 步 + 终章');
  assert.strictEqual(Core.ADV_QUESTS[15].finale, true, '第 16 条是终章');
  Core.ADV_QUESTS.forEach((q, i) => {
    assert.ok(q.id && q.icon && q.goal && q.hint && q.praise, '步 ' + i + ' 文案五件套');
    assert.strictEqual(typeof q.prog, 'function', '步 ' + i + ' prog 谓词');
    assert.strictEqual(typeof q.check, 'function', '步 ' + i + ' check 谓词');
  });
  assert.strictEqual(Core.ADV_QUESTS[0].check({collect_log: 5}), true, '步1 最低满足(v2 提到 5 根: 箱子步的原木预算)');
  assert.strictEqual(Core.ADV_QUESTS[0].check({collect_log: 4}), false, '步1 差一不满足');
  assert.strictEqual(Core.ADV_QUESTS[3].id, 'q4_chest', '步4 = 箱子步(工作台后, 用户拍板)');
  assert.strictEqual(Core.ADV_QUESTS[3].check({craft_chest: 1, place_chest: 1, open_chest: 1}), true,
      '箱子步三条件齐: 合成+放置+打开');
  assert.strictEqual(Core.ADV_QUESTS[3].check({craft_chest: 1, place_chest: 1}), false,
      '箱子步只合成放置没打开: 不满足(收纳闭环要教到交互)');
  assert.strictEqual(Core.ADV_QUESTS[4].id, 'q5_sapling', '步5 = 种树苗步(生态闭环)');
  assert.strictEqual(Core.ADV_QUESTS[13].id, 'q14_fight', '步14 = 战斗教学步(铁镐后钻石前)');
  assert.strictEqual(Core.ADV_MINE_TALLY[3], 'mine_cobble', '石头也计圆石(步7 口径)');
});

/* ============ 大宝箱政策(引导链 v2 纯函数段) ============ */

test('大宝箱阶梯: 9→18(8 圆石)→27(4 铁锭), 顶格 null, 材料取任务链产物', () => {
  assert.strictEqual(Core.ADV_CHEST_START, 9, '初始 9 格');
  assert.strictEqual(Core.ADV_CHEST_SLOTS, 27, '顶格 27 格(与背包同宽)');
  assert.deepStrictEqual(Core.advChestNext(9), {size: 18, cost: {cobble: 8}}, '第一档 8 圆石(第 7 步挖圆石即凑齐)');
  assert.deepStrictEqual(Core.advChestNext(18), {size: 27, cost: {iron_ingot: 4}}, '第二档 4 铁锭(第 12 步烧铁)');
  assert.strictEqual(Core.advChestNext(27), null, '顶格后无下一档');
  assert.strictEqual(Core.advChestNext(5).size, 18, '异常低档也指向第一档');
});

test('advChestPut: 并堆优先→空位→余量; 只认前 size 格; 工具连耐久整槽搬', () => {
  const mk = (size, slots) => ({size, slots: slots.slice()});
  /* 并堆: 已有 60 圆石, 再进 10 → 并满 64, 余 6 落空位 */
  let ch = mk(9, [{id: 'cobble', n: 60}, null, null]);
  let left = Core.advChestPut(ch, {id: 'cobble', n: 10});
  assert.strictEqual(left, 0, '全部收下');
  assert.strictEqual(ch.slots[0].n, 64, '并堆到 64 上限');
  assert.strictEqual(ch.slots[1].n, 6, '溢出 6 落首个空位');
  /* 档位上限: size=9 时第 10 格(下标 9)不可见也不可入 */
  ch = mk(9, Array(27).fill(null));
  ch.slots[9] = {id: 'cobble', n: 64}; /* 异常档直塞(防 expand 前可见) */
  left = Core.advChestPut(ch, {id: 'cobble', n: 70});
  assert.strictEqual(ch.slots[9].n, 64, '越档格(≥size)不被并堆');
  /* 满箱: 9 格各 64 圆石, 再进一件余量=1 */
  ch = mk(9, Array(9).fill({id: 'cobble', n: 64}));
  left = Core.advChestPut(ch, {id: 'cobble', n: 1});
  assert.strictEqual(left, 1, '满箱整批拒收返回余量(只拒不惩罚)');
  /* 工具: n=1 连 dur 原样搬, 不重铸满耐久 */
  ch = mk(9, Array(27).fill(null));
  left = Core.advChestPut(ch, {id: 'pick_iron', n: 1, dur: 200});
  assert.strictEqual(left, 0, '工具入箱成功');
  assert.deepStrictEqual(ch.slots[0], {id: 'pick_iron', n: 1, dur: 200}, '耐久 200 原样保留');
  /* 未注册物品整批拒收(stackMax=0 → mv=0, 余量原数) */
  left = Core.advChestPut(mk(9, []), {id: 'not_a_thing', n: 3});
  assert.strictEqual(left, 3, '未注册整批拒收');
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

/* ============ F1 每炉独立 + 持久化(furnace-plan 拍板①) ============ */

test('F1 炉状态纯函数: advFurnaceValid — 五元组形状校验, 非法整条拒收(decode 防错)', () => {
  assert.strictEqual(Core.advFurnaceValid(null), false, 'null 拒收');
  assert.strictEqual(Core.advFurnaceValid({}), false, '缺字段拒收');
  assert.strictEqual(Core.advFurnaceValid({input: null, fuel: null, out: null, heat: 0, prog: 0}),
      true, '空炉合法');
  assert.strictEqual(Core.advFurnaceValid(
      {input: {id: 'iron_ore', n: 3}, fuel: {id: 'coal', n: 1}, out: {id: 'iron_ingot', n: 2}, heat: 5, prog: 1.2}),
  true, '满炉合法');
  assert.strictEqual(Core.advFurnaceValid(
      {input: {id: 'nope_item', n: 1}, fuel: null, out: null, heat: 0, prog: 0}),
  false, '未注册物品拒收(交叉校验归 ITEMS)');
  assert.strictEqual(Core.advFurnaceValid(
      {input: {id: 'iron_ore', n: 0}, fuel: null, out: null, heat: 0, prog: 0}),
  false, '零数量槽拒收');
  assert.strictEqual(Core.advFurnaceValid({input: null, fuel: null, out: null, heat: -1, prog: 0}),
      false, '负热值拒收');
  assert.strictEqual(Core.advFurnaceValid({input: null, fuel: null, out: null, heat: 0, prog: 3}),
      false, '进度越界拒收(钳制界 SMELT_T——常量在 craft-core, 经全局名消费)');
  assert.strictEqual(Core.advFurnaceValid({input: 'iron_ore', fuel: null, out: null, heat: 0, prog: 0}),
      false, '槽形状必须是对象拒收');
});

test('F1 炉状态纯函数: advFurnaceClean — 空炉条目清扫(三槽全空且无余热), 有料条目保留', () => {
  const m = new Map([
    ['1,25,1', {input: null, fuel: null, out: null, heat: 0, prog: 0}], /* 空炉 → 清 */
    ['2,25,2', {input: {id: 'iron_ore', n: 2}, fuel: null, out: null, heat: 0, prog: 0}], /* 有料 → 留 */
    ['3,25,3', {input: null, fuel: {id: 'coal', n: 1}, out: null, heat: 0, prog: 0}], /* 有燃料 → 留 */
    ['4,25,4', {input: null, fuel: null, out: null, heat: 3, prog: 0}], /* 有余热 → 留(下批料免烧) */
    ['5,25,5', {input: null, fuel: null, out: {id: 'glass', n: 1}, heat: 0, prog: 0}], /* 有产物 → 留 */
  ]);
  const kept = Core.advFurnaceClean(m);
  assert.deepStrictEqual(kept.map(([k]) => k), ['2,25,2', '3,25,3', '4,25,4', '5,25,5'],
      '只清空炉, 存档不膨胀');
  assert.strictEqual(Core.advFurnaceClean(new Map()).length, 0, '空 Map 照跑');
});

/* ============ F4 牧场(二期设计稿 §4.4/§4.3): 散布清单 + 恐惧游荡决策 ============ */

test('F4 advLivestockPlan: 确定性 — 同种子同清单, 玩家改动不漂移(零世界读)', () => {
  Core.advBuildWorld();
  const a = Core.advLivestockPlan();
  assert.strictEqual(a.length, 10, '2 群共 10 只');
  assert.deepStrictEqual(Core.advLivestockPlan(), a, '两次生成逐字段一致(SceneKit.rand 同种子口径)');
  /* 挖掉群位草皮/放块: 清单不变(重进完全复现的前提——清单不读世界现状) */
  api.setBlockRaw(Math.floor(a[0].x), Core.ADV_GROUND, Math.floor(a[0].z), 0);
  api.setBlockRaw(Math.floor(a[5].x), Core.ADV_GROUND, Math.floor(a[5].z), 3);
  assert.deepStrictEqual(Core.advLivestockPlan(), a, '世界被玩家改动后清单原样');
});

test('F4 advLivestockSpots/Plan: 群位约束成立 — 离出生 ≥15 · 避湖/避坑/避巢 · 平地草地 · 两群 ≥10 · 10 只构成', () => {
  Core.advBuildWorld(); /* 对真生成世界断言(清单本身不读世界) */
  const spots = Core.advLivestockSpots();
  assert.strictEqual(spots.length, 2, '两个群位');
  const spawn = Core.ADV_SPAWN;
  const lake = Core.ADV_LAKE;
  for (const s of spots) {
    assert.ok(Math.hypot(s.x - spawn.x, s.z - spawn.z) >= Core.ADV_LIVESTOCK_SPAWN_R,
        '群位离出生点 ≥15: ' + Math.hypot(s.x - spawn.x, s.z - spawn.z).toFixed(1));
    assert.ok(Math.hypot(s.x - lake.cx, s.z - lake.cz) > lake.r + 4, '避湖(含外扩裕量)');
    for (const p of Core.ADV_PITS) {
      assert.ok(Math.hypot(s.x - p.cx, s.z - p.cz) > p.r + 4, '避矿坑漏斗');
    }
    for (const n of Core.ADV_NESTS) {
      assert.ok(Math.hypot(s.x - n.x, s.z - n.z) >= 6, '避巢穴(怪物窝边不放牧场)');
    }
    /* 平地贴地: 群位脚下是整块草地且上方净空(基础草原面在禁区外天然平坦) */
    assert.strictEqual(api.getBlock(s.x, Core.ADV_GROUND, s.z), 1, '脚下是草地');
    assert.strictEqual(api.getBlock(s.x, Core.ADV_GROUND + 1, s.z), 0, '上方净空(不撞树干)');
  }
  assert.ok(Math.hypot(spots[0].x - spots[1].x, spots[0].z - spots[1].z) >= Core.ADV_LIVESTOCK_HERD_R,
      '两群彼此 ≥10 格(不叠群)');
  /* 清单构成: idx 0..9 稳定 · 群 A 牛2羊2 + 群 B 猪3鸡3 · 条目在群位环带内贴地 */
  const plan = Core.advLivestockPlan();
  assert.deepStrictEqual(plan.map((e) => e.idx), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], '索引稳定(死畜账的对账键)');
  const byType = {};
  for (const e of plan) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    const near = spots.find((s) => Math.hypot(e.x - s.x - 0.5, e.z - s.z - 0.5) <= Core.ADV_LIVESTOCK_RING_HI + 1e-9);
    assert.ok(near, '条目落在某群位环带内: ' + e.type);
    assert.strictEqual(e.y, Core.ADV_GROUND + 1, '贴地锚点 y=地表+1');
    assert.strictEqual(api.getBlock(Math.floor(e.x), Core.ADV_GROUND, Math.floor(e.z)), 1,
        '条目脚下是草地(平地贴地)');
    assert.strictEqual(api.getBlock(Math.floor(e.x), Core.ADV_GROUND + 1, Math.floor(e.z)), 0,
        '条目落位上方净空');
  }
  assert.deepStrictEqual(byType, {cow: 2, sheep: 2, pig: 3, chicken: 3}, '群 A 牛×2+羊×2 / 群 B 猪×3+鸡×3');
});

test('F4 advHerdStep: 逃窜优先(3s 递减 ×2.2) · 贴近让开(≤2.5 ×0.8) · 平静不动(设计稿 §4.3)', () => {
  assert.deepStrictEqual(Core.advHerdStep(1.0, 1.4, 3, 0.1), {fleeT: 2.9, speed: 1.4 * 2.2},
      '逃窜中: 计时递减, 速度 ×2.2');
  assert.deepStrictEqual(Core.advHerdStep(1.0, 1.4, 0.05, 0.1), {fleeT: 0, speed: 1.4 * 2.2},
      '到期帧仍按逃窜(下一帧回落)');
  assert.deepStrictEqual(Core.advHerdStep(5, 1.4, 0, 0.1), {fleeT: 0, speed: 0}, '逃窜结束且玩家不在圈内: 停');
  assert.deepStrictEqual(Core.advHerdStep(2.5, 1.4, 0, 1 / 60), {fleeT: 0, speed: 1.4 * 0.8},
      '恰 2.5 格让开(含等号, ×0.8 缓步)');
  assert.deepStrictEqual(Core.advHerdStep(2.51, 1.4, 0, 1 / 60), {fleeT: 0, speed: 0}, '2.51 格不动');
  assert.deepStrictEqual(Core.advHerdStep(8, 1.2, 0, 1), {fleeT: 0, speed: 0}, '远距平静(闲逛归壳层)');
  /* 逃窜优先于让开: 受击计时未到期时距离不影响速度档 */
  assert.strictEqual(Core.advHerdStep(8, 1.4, 2, 0.1).speed, 1.4 * 2.2, '逃窜中距离再远也是 ×2.2');
});

/* ============ 昼夜 D5 夜怪政策(mc-daylight-torch §6.1) ============ */

test('昼夜 D5 夜怪常数表: ADV_NIGHT 上限/环带/节拍/池(设计稿 §6.1 拍板④)', () => {
  assert.strictEqual(Core.ADV_NIGHT.CAP, 12, '夜怪上限 12(MC 70/200 → 儿童, 差异 #9)');
  assert.strictEqual(Core.ADV_NIGHT.RING_LO, 24, '出生环带内沿 24 格(MC 24 格内不刷)');
  assert.strictEqual(Core.ADV_NIGHT.RING_HI, 40, '出生环带外沿 40 格');
  assert.strictEqual(Core.ADV_NIGHT.TRY_MS, 2000, '每 2 秒一次刷怪尝试(夜间才跑)');
  assert.deepStrictEqual(Core.ADV_NIGHT.POOL, [['zombie', 2], ['creeper', 1], ['spider', 1]],
      '池 2:1:1, 无骷髅(夜间无远程, 差异 #8)');
});

test('昼夜 D5 advNightCanSpawn: 单表达式 = 方块光 0 且 internalSky≤7(MC 1.18+ 语义)', () => {
  const N = 18000; /* 午夜(skyDim 11) */
  assert.strictEqual(Core.advNightCanSpawn(15, 0, N), true, '夜地表: internal 15-11=4 ≤7 → 可刷');
  assert.strictEqual(Core.advNightCanSpawn(15, 1, N), false, '火把圈(方块光 ≥1)拒绝——防刷怪圈');
  assert.strictEqual(Core.advNightCanSpawn(15, 14, N), false, '火把本格(光 14)拒绝');
  assert.strictEqual(Core.advNightCanSpawn(15, 0, 6000), false, '白天地表: internal 15 >7 拒绝');
  assert.strictEqual(Core.advNightCanSpawn(0, 0, 6000), true, '白天洞穴(sky 0): 暗处可刷(MC 语义, 时间门在节拍器)');
  assert.strictEqual(Core.advNightCanSpawn(18, 0, N), true, '边界: internal 18-11=7 恰 ≤7 通过');
  assert.strictEqual(Core.advNightCanSpawn(19, 0, N), false, 'internal 8 >7 拒绝');
});

test('昼夜 D5 advNightStep: 节拍 2s 一拍 · 白天归零 · 环带落位 · 池权重 · 光照/界外拒绝', () => {
  const N = 18000; /* 午夜 */
  const P = {x: 61.5, z: 76.5};
  const dark = () => ({sky: 15, block: 0}); /* 夜地表可刷口径 */
  const seq = (arr) => {/* 脚本 rnd: 按序耗尽(角度/半径/池各吃一次) */
    let i = 0;
    return () => arr[i++];
  };
  /* 白天: 不刷且计时归零(advNestStep 同构——前置不满足即复位) */
  let r = Core.advNightStep(1.5, 0.6, 6000, dark, P, Math.random);
  assert.strictEqual(r.spawn, null, '白天不出单');
  assert.strictEqual(r.t, 0, '白天节拍器归零');
  /* 未到拍: 只累计不出单 */
  r = Core.advNightStep(1.5, 0.4, N, dark, P, Math.random);
  assert.strictEqual(r.spawn, null, '累计 1.9s 未到 2s 拍');
  assert.ok(Math.abs(r.t - 1.9) < 1e-9, '计时累计(秒)');
  /* 到拍: 出单 + 计时归零; rnd=[0, 0.5, 0] → 角度 0 · 半径 24+8=32 · 池首 zombie */
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0, 0.5, 0]));
  assert.strictEqual(r.t, 0, '到拍后计时归零(逐拍独立)');
  assert.ok(r.spawn, '到拍出刷怪令');
  assert.strictEqual(r.spawn.type, 'zombie', '池权重 2/4 首段: 掷 0 → zombie');
  const d = Math.hypot(r.spawn.x - P.x, r.spawn.z - P.z);
  assert.ok(Math.abs(d - (24 + 0.5 * 16)) < 1e-9, '落点恰在环带上(半径 32 ∈ [24,40]): ' + d.toFixed(2));
  /* 环带两端: rnd 半径 0 → 恰 24 · →1 → 恰 40(角度 90°) */
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0.25, 0, 0]));
  assert.ok(Math.abs(Math.hypot(r.spawn.x - P.x, r.spawn.z - P.z) - 24) < 1e-9, '内沿 24');
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0.25, 1 - 1e-12, 0]));
  assert.ok(Math.hypot(r.spawn.x - P.x, r.spawn.z - P.z) <= 40 + 1e-6, '外沿不越 40');
  /* 池权重: 第三掷 0.5(总 4) → creeper · 0.99 → spider */
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0, 0, 0.5]));
  assert.strictEqual(r.spawn.type, 'creeper', '掷 2/4 落 creeper(权重 1)');
  r = Core.advNightStep(1.9, 0.2, N, dark, P, seq([0, 0, 0.99]));
  assert.strictEqual(r.spawn.type, 'spider', '掷 3.96/4 落 spider(权重 1)');
  /* 光照拒绝: read 报火把格 → 本拍作废不出单(节拍照归零, 下一拍再掷) */
  r = Core.advNightStep(1.9, 0.2, N, () => ({sky: 15, block: 3}), P, Math.random);
  assert.strictEqual(r.spawn, null, '方块光 ≥1 的落点拒绝(防刷怪圈)');
  assert.strictEqual(r.t, 0, '被拒的拍也归零(2s 后再试)');
  /* 界外: read 返 null(壳层界外口径) → 不出单 */
  r = Core.advNightStep(1.9, 0.2, N, () => null, P, Math.random);
  assert.strictEqual(r.spawn, null, '界外/无效落点不出单');
});

test('昼夜 D5 advDawnSweep: internalSky(15)≥12(= skyDim≤3) 黎明谓词(跨沿归壳层账本)', () => {
  assert.strictEqual(Core.advDawnSweep(0), true, '清晨: dim 0 → 天已亮');
  assert.strictEqual(Core.advDawnSweep(18000), false, '午夜: dim 11 → 夜怪还在');
  assert.strictEqual(Core.advDawnSweep(23000), false, 'isNight 出界(23000)但 dim≈6.5>3: 清场未到点');
  assert.strictEqual(Core.advDawnSweep(23400), false, 'dim≈3.8 仍 >3');
  assert.strictEqual(Core.advDawnSweep(23600), true, '日出折线下穿 3(≈23517): 清场时刻');
  assert.strictEqual(Core.advDawnSweep(12400), true, '黄昏早期 dim≤3 也为 true——跨沿取上升沿归壳层, 此处只给谓词');
});

/* ============ 昼夜 D6: 床·睡觉政策纯函数(设计稿 §7.2) ============ */

test('D6 睡觉政策: advSleepCheck — 夜窗(sleepWindow)优先 + 床 8 格内无活怪(passive 不算怪)', () => {
  /* 夜窗判定直连 Daylight.sleepWindow(skyDim≥4 ⇔ [12542,23460)); 边界细节归 daylight-core 单测 */
  assert.deepStrictEqual(Core.advSleepCheck(6000, [], 10.5, 20.5), {ok: false, why: 'night'},
      '正午不可睡(why=night → toast「晚上才能睡哦」)');
  assert.deepStrictEqual(Core.advSleepCheck(12541, [], 10.5, 20.5), {ok: false, why: 'night'},
      '窗口起 12542 前一 tick 仍不可睡');
  assert.deepStrictEqual(Core.advSleepCheck(20000, [], 10.5, 20.5), {ok: true, why: ''},
      '深夜无怪可睡');
  /* 床边无怪: 水平 8 格(MC 口径 research §1.6); 床坐标取格心 */
  const nightMobs = (mobs) => Core.advSleepCheck(20000, mobs, 10.5, 20.5);
  assert.deepStrictEqual(nightMobs([{x: 13, z: 23}]), {ok: false, why: 'mob'},
      '3 格内有活怪(why=mob → toast「附近有怪物，睡不着」)');
  assert.deepStrictEqual(nightMobs([{x: 18.5, z: 20.5}]), {ok: false, why: 'mob'},
      '恰 8 格整也算「8 格内」(advNearStation 同含等号口径)');
  assert.deepStrictEqual(nightMobs([{x: 19.2, z: 20.5}]), {ok: true, why: ''},
      '8.7 格外的怪不拦');
  /* 尸体/已移除/牧场动物(passive)不拦(F4 口径: 动物不算怪) */
  assert.deepStrictEqual(nightMobs([{x: 11, z: 21, dead: true}]), {ok: true, why: ''}, '尸体不拦');
  assert.deepStrictEqual(nightMobs([{x: 11, z: 21, gone: true}]), {ok: true, why: ''}, '已移除不拦');
  assert.deepStrictEqual(nightMobs([{x: 11, z: 21, passive: true}]), {ok: true, why: ''},
      '牧场动物贴床也不拦(MC 口径: 动物不妨碍睡觉)');
  /* 夜窗不过时连怪都不看(先决条件次序 = toast 优先级) */
  assert.deepStrictEqual(Core.advSleepCheck(6000, [{x: 11, z: 21}], 10.5, 20.5),
      {ok: false, why: 'night'}, '白天有怪也先报「晚上才能睡哦」');
  assert.strictEqual(Core.ADV_BED_MOB_R, 8, '床边无怪半径 = 8 格(常量表)');
});

test('D6 睡觉转场: advSleepStep — 渐黑 1.5s → 停 2s(唤醒沿) → 渐亮 1.5s ≈ 5s(MC 101 tick 观感)', () => {
  const S = Core;
  /* 渐黑段: opacity 线性升, phase='out' */
  let s = S.advSleepStep(0, 0.75);
  assert.strictEqual(s.phase, 'out');
  assert.strictEqual(Math.round(s.opacity * 100) / 100, 0.5, '半程半黑');
  assert.strictEqual(s.wake, false);
  assert.strictEqual(s.t, 0.75);
  /* 停段: opacity=1, phase='hold' */
  s = S.advSleepStep(1.5, 1.0);
  assert.strictEqual(s.phase, 'hold');
  assert.strictEqual(s.opacity, 1, '全黑停留');
  assert.strictEqual(s.wake, false, '停段未到唤醒沿');
  /* 唤醒沿: 跨过 3.5s(1.5+2)恰一帧 wake=true — 渐亮起点 = 跳清晨+清场+设出生点 */
  s = S.advSleepStep(3.4, 0.2);
  assert.strictEqual(s.phase, 'in');
  assert.strictEqual(s.wake, true, '跨 3.5s 的这一步恰一次唤醒沿');
  assert.strictEqual(Math.round(s.opacity * 100) / 100, 0.93, '渐亮起点近全黑(3.6s → (5-3.6)/1.5)');
  s = S.advSleepStep(3.6, 0.1);
  assert.strictEqual(s.wake, false, '沿只发一次(后续帧不重发)');
  /* 大步跨沿也只发一次(后台标签页回来 dt 被主循环钳 0.05, 但状态机自身鲁棒) */
  s = S.advSleepStep(2.0, 2.0);
  assert.strictEqual(s.wake, true, '一步跨过 3.5s 也发沿');
  assert.strictEqual(s.phase, 'in');
  /* 收尾: 5s 到点 done, opacity 归 0 */
  s = S.advSleepStep(4.9, 0.2);
  assert.strictEqual(s.phase, 'done');
  assert.strictEqual(s.opacity, 0);
  assert.strictEqual(s.t, 5, 't 钳在总时长');
  /* 渐亮中点透明度对称 */
  s = S.advSleepStep(4.25, 0);
  assert.strictEqual(Math.round(s.opacity * 100) / 100, 0.5, '4.25s(渐亮中点)半透明');
  assert.strictEqual(S.ADV_SLEEP_TOTAL, 5, '总时长常量 ≈ MC 101 tick=5.05s(差异 #2 观感等价)');
});

/* ============ 昼夜 D7: 灯笼耗秒政策纯函数(设计稿 §8.2) ============ */

test('D7 灯笼常数表: ADV_LANTERN 物品 id 与耗秒节拍(设计稿 §8.2 拍板)', () => {
  assert.strictEqual(Core.ADV_LANTERN.ID, 'lantern', '物品键 = items-core 注册的 lantern');
  assert.strictEqual(Core.ADV_LANTERN.DRAIN_S, 1, '每持满 1 秒扣 1 耐久(dt 累计器)');
});

test('D7 advLanternStep: 三前置(选中灯笼·耐久>0·skyDim>0)才亮才耗 · 前置不满足累计器归零', () => {
  const L = Core;
  /* 白天(skyDim 0): 不亮不耗, 且累计器归零(advNightStep 白天同构) */
  let r = L.advLanternStep(0.9, 0.2, 'lantern', 300, 0);
  assert.strictEqual(r.glow, false, '白天不亮');
  assert.strictEqual(r.drain, false, '白天不耗(孩子不会白浪费)');
  assert.strictEqual(r.t, 0, '白天累计器归零');
  /* 手持别物/空手: 不亮不耗归零 */
  r = L.advLanternStep(0.9, 0.2, 'torch', 300, 11);
  assert.strictEqual(r.glow, false, '非灯笼不亮');
  assert.strictEqual(r.t, 0, '换下手累计器归零(半秒进度不白送也不白扣)');
  r = L.advLanternStep(0.9, 0.2, '', 300, 11);
  assert.strictEqual(r.glow, false, '空手不亮');
  /* 耐久归零: 不亮不耗(燃尽灯笼静默, 消失政策在壳层) */
  r = L.advLanternStep(0.9, 0.2, 'lantern', 0, 11);
  assert.strictEqual(r.glow, false, '燃尽不亮');
  assert.strictEqual(r.drain, false, '燃尽不耗');
  /* 黄昏沿(skyDim 恰 >0)即亮: 判据是 skyDim 而非 isNight(§8.2 字面口径) */
  r = L.advLanternStep(0, 0.2, 'lantern', 300, 0.5);
  assert.strictEqual(r.glow, true, '天微暗(skyDim 0.5>0)灯笼已亮');
});

test('D7 advLanternStep: 持满 1 秒出扣单 · 余时结转下一秒 · 未满只累计', () => {
  const L = Core;
  /* 未满 1 秒: 只累计不出扣单 */
  let r = L.advLanternStep(0, 0.6, 'lantern', 300, 11);
  assert.strictEqual(r.drain, false, '0.6s 未持满');
  assert.ok(Math.abs(r.t - 0.6) < 1e-9, '累计器推进');
  assert.strictEqual(r.glow, true, '点亮中');
  /* 跨过 1 秒: 出扣单, 余时结转(不整段清零) */
  r = L.advLanternStep(0.9, 0.3, 'lantern', 300, 11);
  assert.strictEqual(r.drain, true, '1.2s 持满出扣单(damageTool 扣 1)');
  assert.ok(Math.abs(r.t - 0.2) < 1e-9, '余时 0.2s 结转下一秒');
  /* 恰满 1 秒整: 出扣单 */
  r = L.advLanternStep(0.5, 0.5, 'lantern', 300, 11);
  assert.strictEqual(r.drain, true, '恰 1.0s 也算持满');
  assert.strictEqual(r.t, 0, '无余时');
  /* 低帧率大步: 钳 0.05 的 dt 单步最多跨一拍, 状态机自身仍按余时结转 */
  r = L.advLanternStep(0.99, 0.05, 'lantern', 300, 11);
  assert.strictEqual(r.drain, true, '大步跨沿也恰一扣单');
});
