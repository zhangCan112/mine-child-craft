'use strict';
/* 合成核心 (js/craft-core.js) 单测 — node --test (零依赖)
   运行: node --test test/craft-core.test.js
   加载器: 同一 vm context 依次执行 items-core.js + inventory-core.js +
   craft-core.js — 镜像浏览器 <script defer> 共享词法环境(craft-core 的
   背包操作经 inventory-core 的 count/take/add 接口)。craft-core 顶层从
   ITEMS 派生 FUEL 择优序, 加载序「items-core 之后」由此测试守护;
   不加载 config.js — breakTime 收 blockDef 纯数据, 交叉验证单列一节。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCraft() {
  const ctx = vm.createContext({console});
  for (const f of ['items-core.js', 'inventory-core.js', 'craft-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__c = {
      RECIPES: typeof RECIPES === 'undefined' ? undefined : RECIPES,
      SMELTS: typeof SMELTS === 'undefined' ? undefined : SMELTS,
      FUEL: typeof FUEL === 'undefined' ? undefined : FUEL,
      canCraft: typeof canCraft === 'undefined' ? undefined : canCraft,
      craft: typeof craft === 'undefined' ? undefined : craft,
      fuelUnits: typeof fuelUnits === 'undefined' ? undefined : fuelUnits,
      smeltOf: typeof smeltOf === 'undefined' ? undefined : smeltOf,
      breakTime: typeof breakTime === 'undefined' ? undefined : breakTime,
      ITEMS: typeof ITEMS === 'undefined' ? undefined : ITEMS,
      mkStack: typeof mkStack === 'undefined' ? undefined : mkStack,
      mkInventory: typeof mkInventory === 'undefined' ? undefined : mkInventory,
      add: typeof add === 'undefined' ? undefined : add,
      canAfford: typeof canAfford === 'undefined' ? undefined : canAfford,
    };`, ctx);
  return ctx.__c;
}

/* 造背包并填料: mkInventory + add(背包核心真实入包路径, add 并堆优先) */
function invWith(h, fills) {
  const inv = h.mkInventory();
  for (const [id, n] of fills) h.add(inv, id, n);
  return inv;
}

/* ============ 加载: 共享词法环境的顶层接口 ============ */

test('加载: 顶层暴露三张表(FUEL 从 ITEMS 派生, 加载序在 items-core 之后)', () => {
  const h = loadCraft();
  assert.strictEqual(typeof h.RECIPES, 'object');
  assert.strictEqual(typeof h.SMELTS, 'object');
  assert.strictEqual(Array.isArray(h.FUEL), true);
});

/* ============ 配方表防错网: 以后加配方漏字段/漏注册当场红 ============ */

test('配方全量: 手搓 4 条 + 工作台级(工具16/站点件/补给包)共 28 条, id 唯一', () => {
  const {RECIPES} = loadCraft();
  const ids = RECIPES.map((r) => r.id);
  assert.strictEqual(new Set(ids).size, ids.length, '配方 id 应唯一');
  assert.strictEqual(RECIPES.length, 28, '一期全表 4+16+8 条, 实际 ' + RECIPES.length);
  // 手搓级(设计稿 §3.2): 随时可做
  for (const id of ['planks', 'stick', 'craft_table', 'torch']) {
    const r = RECIPES.find((x) => x.id === id);
    assert.ok(r, '手搓配方 ' + id + ' 应存在');
    assert.strictEqual(r.station, 'hand', id + ' 应为 hand 级');
  }
  // 工作台级: 工具 16 + furnace/stone_bricks/bricks/shears/tnt/bow_item/bread/bone_meal
  const tableIds = ['pick_wood', 'pick_stone', 'pick_iron', 'pick_diamond',
    'axe_wood', 'axe_stone', 'axe_iron', 'axe_diamond',
    'sword_wood', 'sword_stone', 'sword_iron', 'sword_diamond',
    'shovel_wood', 'shovel_stone', 'shovel_iron', 'shovel_diamond',
    'furnace', 'stone_bricks', 'bricks', 'shears', 'tnt', 'bow_item', 'bread', 'bone_meal'];
  for (const id of tableIds) {
    const r = RECIPES.find((x) => x.id === id);
    assert.ok(r, '工作台级配方 ' + id + ' 应存在');
    assert.strictEqual(r.station, 'table', id + ' 应为 table 级');
  }
});

test('条目形状: out{n≥1}·cost 值合法(数字|[候选数组,数字])·引用物品全在 ITEMS 注册', () => {
  const {RECIPES, ITEMS} = loadCraft();
  for (const r of RECIPES) {
    assert.strictEqual(typeof r.id, 'string', 'id 应为字符串');
    assert.ok(r.out && typeof r.out.item === 'string', r.id + ' out.item');
    assert.ok(Number.isInteger(r.out.n) && r.out.n >= 1, r.id + ' out.n 应为 ≥1 整数');
    assert.ok(ITEMS[r.out.item], r.id + ' 产物 ' + r.out.item + ' 应在 ITEMS 注册(防改表漏注册)');
    for (const [key, val] of Object.entries(r.cost)) {
      if (Array.isArray(val)) {
        // 任选材料: [候选 id 数组, 数量] — 设计稿 §3.2 cost 值为数组 = 任选其一
        assert.ok(Array.isArray(val[0]) && val[0].length >= 2, r.id + '·' + key + ' 候选数组应 ≥2 个');
        for (const c of val[0]) assert.ok(ITEMS[c], r.id + '·' + key + ' 候选 ' + c + ' 应在 ITEMS 注册');
        assert.ok(Number.isInteger(val[1]) && val[1] >= 1, r.id + '·' + key + ' 任选数量应 ≥1');
      } else {
        assert.ok(Number.isInteger(val) && val >= 1, r.id + '·' + key + ' 数量应 ≥1 整数');
        assert.ok(ITEMS[key], r.id + ' 材料 ' + key + ' 应在 ITEMS 注册(防改表漏注册)');
      }
    }
  }
});

test('配方数值抽查: 与设计稿 §3.2/§3.5 逐条一致(研究稿 MC 口径)', () => {
  const {RECIPES} = loadCraft();
  const by = {};
  for (const r of RECIPES) by[r.id] = r;
  /* vm context 对象跨 realm 原型不同, deepStrictEqual 会误判(items-core.test.js 先例):
     cost/out 展开回宿主 realm 再比; 任选值嵌套数组一并展开 */
  const cost = (id) => {
    const o = {};
    for (const [k, v] of Object.entries(by[id].cost)) o[k] = Array.isArray(v) ? [[...v[0]], v[1]] : v;
    return o;
  };
  const out = (id) => ({...by[id].out});
  // 手搓 4 条(§3.2)
  assert.deepStrictEqual(cost('planks'), {log: 1});
  assert.deepStrictEqual(out('planks'), {item: 'planks', n: 4});
  assert.deepStrictEqual(cost('stick'), {planks: 2});
  assert.deepStrictEqual(out('stick'), {item: 'stick', n: 4});
  assert.deepStrictEqual(cost('craft_table'), {planks: 4}); // §5.5 工作台 4 板
  assert.deepStrictEqual(cost('torch'), {fuel: [['coal', 'charcoal'], 1], stick: 1}); // §5.2 煤/木炭任选
  assert.deepStrictEqual(out('torch'), {item: 'torch', n: 4});
  // 站点件与补给包(§3.5 + §3.2)
  assert.deepStrictEqual(cost('furnace'), {cobble: 8}); // §5.5 8 圆石无需煤
  assert.deepStrictEqual(cost('stone_bricks'), {stone: 4}); // 4 石→4 石砖(MC 口径)
  assert.deepStrictEqual(out('stone_bricks'), {item: 'stone_bricks', n: 4});
  assert.deepStrictEqual(cost('bricks'), {brick: 4}); // 4 红砖→1 红砖块(黏土链)
  assert.deepStrictEqual(cost('shears'), {iron_ingot: 2}); // 2 铁锭(§3.5)
  assert.deepStrictEqual(cost('tnt'), {gunpowder: 5, sand: 4}); // MC 口径(§3.2)
  assert.deepStrictEqual(cost('bow_item'), {stick: 3, string: 3}); // 二期启用占位(§5.4)
  assert.deepStrictEqual(cost('bread'), {wheat: 3}); // 原料二期, 卡片不点亮
  assert.deepStrictEqual(cost('bone_meal'), {bone: 1}); // 用途二期催熟
  assert.deepStrictEqual(out('bone_meal'), {item: 'bone_meal', n: 3});
});

test('工具 16 条配方: 镐斧 3材+2棍 · 剑 2材+1棍 · 锹 1材+2棍, 材质按阶替换', () => {
  const {RECIPES} = loadCraft();
  const by = {};
  for (const r of RECIPES) by[r.id] = r;
  const mats = {wood: 'planks', stone: 'cobble', iron: 'iron_ingot', diamond: 'diamond'};
  const shape = {pick: [3, 2], axe: [3, 2], sword: [2, 1], shovel: [1, 2]}; // §5.4 镐=3材+2棍, 同构余三类
  for (const [mat, itemId] of Object.entries(mats)) {
    for (const [kind, [m, s]] of Object.entries(shape)) {
      const r = by[kind + '_' + mat];
      assert.ok(r, kind + '_' + mat + ' 配方应存在');
      assert.deepStrictEqual({...r.out}, {item: kind + '_' + mat, n: 1}, '工具产物 1 件(不可堆叠)');
      const c = {}; // 工具配方无任选材料, 展开回宿主 realm 即可
      for (const [k, v] of Object.entries(r.cost)) c[k] = v;
      assert.deepStrictEqual(c, {[itemId]: m, stick: s}, kind + '_' + mat + ' 材料计费');
    }
  }
});

test('烧炼表: 六条映射与任务合同逐条一致(铁/金粗矿·木炭·石→圆石循环·玻璃·红砖)', () => {
  const {SMELTS} = loadCraft();
  assert.deepStrictEqual({...SMELTS}, {
    iron_ore: 'iron_ingot',
    gold_ore: 'gold_ingot',
    log: 'charcoal',
    cobble: 'stone',
    sand: 'glass',
    clay_ball: 'brick',
  });
});

test('燃料择优序: 读 ITEMS fuel 字段按热值降序(煤→木炭→原木→木板→木棍, D8)', () => {
  const {FUEL} = loadCraft();
  assert.deepStrictEqual([...FUEL], ['coal', 'charcoal', 'log', 'planks', 'stick']);
});

/* ============ 热值与烧炼查询 ============ */

test('fuelUnits: 煤/木炭 8 件 · 木质 1.5 · 木棍 0.5 · 非燃料与未注册 0', () => {
  const {fuelUnits} = loadCraft();
  assert.strictEqual(fuelUnits('coal'), 8);
  assert.strictEqual(fuelUnits('charcoal'), 8);
  assert.strictEqual(fuelUnits('log'), 1.5);
  assert.strictEqual(fuelUnits('planks'), 1.5);
  assert.strictEqual(fuelUnits('stick'), 0.5);
  assert.strictEqual(fuelUnits('iron_ingot'), 0, '非燃料应为 0');
  assert.strictEqual(fuelUnits('not_registered'), 0, '未注册不炸, 返回 0');
});

test('smeltOf: 六条烧炼映射逐条命中, 未登记原料返回 null', () => {
  const {smeltOf} = loadCraft();
  assert.strictEqual(smeltOf('iron_ore'), 'iron_ingot');
  assert.strictEqual(smeltOf('gold_ore'), 'gold_ingot');
  assert.strictEqual(smeltOf('log'), 'charcoal');
  assert.strictEqual(smeltOf('cobble'), 'stone');
  assert.strictEqual(smeltOf('sand'), 'glass');
  assert.strictEqual(smeltOf('clay_ball'), 'brick');
  assert.strictEqual(smeltOf('bread'), null, '食物不可烧');
  assert.strictEqual(smeltOf('not_registered'), null);
});

/* missing 数组规范化: Array.from 收口跨 realm 数组(map 沿 receiver 的 realm
   构造, 直接 deepStrictEqual 会因原型不同误判 — items-core.test.js 同坑) */
const normMissing = (arr) => Array.from(arr, (m) => {
  const o = {...m};
  if (o.any) o.any = [...o.any];
  return o;
});

/* ============ canCraft: 缺失清单驱动配方卡亮灰(D8) ============ */

test('canCraft: 材料齐的手搓配方 ok, 缺什么 missing 报什么(含已有量)', () => {
  const h = loadCraft();
  const {canCraft, RECIPES} = h;
  const planks = RECIPES.find((r) => r.id === 'planks');
  let r = canCraft(invWith(h, [['log', 3]]), planks, false);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual([...r.missing], []);
  r = canCraft(h.mkInventory(), planks, false); // 空背包
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(normMissing(r.missing), [{id: 'log', need: 1, have: 0}]);
  // 木镐需 planks3+stick2, 只缺 planks(有 1): missing 单条且不误报 stick
  const pick = RECIPES.find((x) => x.id === 'pick_wood');
  r = canCraft(invWith(h, [['planks', 1], ['stick', 2]]), pick, true);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(normMissing(r.missing), [{id: 'planks', need: 3, have: 1}]);
  // 双缺 → missing 两条齐报
  r = canCraft(invWith(h, [['planks', 1]]), pick, true);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.missing.length, 2, 'planks 与 stick 都缺, 应各报一条');
});

test('canCraft: table 级配方受站点开关约束, hand 级不受(D8 放置解锁)', () => {
  const h = loadCraft();
  const {canCraft, RECIPES} = h;
  const pick = RECIPES.find((r) => r.id === 'pick_wood');
  const mats = invWith(h, [['planks', 3], ['stick', 2]]);
  let r = canCraft(mats, pick, true);
  assert.strictEqual(r.ok, true, '材料齐 + 工作台解锁 → ok');
  r = canCraft(mats, pick, false);
  assert.strictEqual(r.ok, false, '没走近工作台 → 不 ok');
  assert.deepStrictEqual(normMissing(r.missing), [{station: 'table'}]);
  // 站点与材料双缺: 两者都进 missing
  r = canCraft(h.mkInventory(), pick, false);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.missing.length, 3, 'station + planks + stick');
  assert.ok(r.missing.some((m) => m.station === 'table'), 'missing 应含站点条目');
  // hand 级配方与站点无关
  const table = RECIPES.find((x) => x.id === 'craft_table');
  r = canCraft(invWith(h, [['planks', 4]]), table, false);
  assert.strictEqual(r.ok, true, '手搓级配方 stationOk=false 也能做');
});

test('canCraft: 任选材料煤/木炭两键可互换, 全缺报 any 候选组', () => {
  const h = loadCraft();
  const {canCraft, RECIPES} = h;
  const torch = RECIPES.find((r) => r.id === 'torch');
  // 只有木炭 → 可做(与煤等效, §3.1)
  let r = canCraft(invWith(h, [['charcoal', 1], ['stick', 1]]), torch, false);
  assert.strictEqual(r.ok, true, '任选材料: 有木炭无煤也算齐');
  // 只有煤 1 个, 刚好够
  r = canCraft(invWith(h, [['coal', 1], ['stick', 1]]), torch, false);
  assert.strictEqual(r.ok, true);
  // 两键都没有 → missing 一条 any 组
  r = canCraft(invWith(h, [['stick', 1]]), torch, false);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(normMissing(r.missing), [{any: ['coal', 'charcoal'], need: 1}]);
  // 两键都有当然也行
  r = canCraft(invWith(h, [['coal', 1], ['charcoal', 1], ['stick', 1]]), torch, false);
  assert.strictEqual(r.ok, true);
});

test('canCraft: 任选判定与 canAfford 同口径(候选合计), 不留语义裂缝', () => {
  const h = loadCraft();
  const {canCraft, canAfford} = h;
  // 手造 cost: 任选需求 2(表内一期均为 1, 此处专测口径对齐)
  const recipe = {id: 'probe', out: {item: 'torch', n: 1},
    cost: {fuel: [['coal', 'charcoal'], 2], stick: 9}, station: 'hand'};
  const inv = invWith(h, [['coal', 1], ['charcoal', 1], ['stick', 9]]);
  assert.strictEqual(canAfford(inv, recipe.cost), true, '背包核心: 候选合计 1+1 ≥ 2');
  assert.strictEqual(canCraft(inv, recipe, true).ok, true, '合成核心口径应与之一致');
  const invShort = invWith(h, [['coal', 1], ['stick', 9]]);
  assert.strictEqual(canAfford(invShort, recipe.cost), false);
  assert.strictEqual(canCraft(invShort, recipe, true).ok, false);
});

/* ============ craft: 扣料 + 产栈(经 inventory-core 的 take/add) ============ */

test('craft: 手搓木板 — 扣 1 原木, 产物 4 木板并入背包', () => {
  const h = loadCraft();
  const {craft, RECIPES} = h;
  const planks = RECIPES.find((r) => r.id === 'planks');
  const inv = invWith(h, [['log', 3]]);
  const res = craft(inv, planks, false);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.out.item, 'planks');
  assert.strictEqual(res.out.n, 4);
  assert.strictEqual(res.leftover, 0);
  assert.deepStrictEqual({...inv.slots[0]}, {id: 'log', n: 2}, '原木 3→2');
  assert.deepStrictEqual({...inv.slots[1]}, {id: 'planks', n: 4}, '木板开新堆');
});

test('craft: 木镐 — 跨槽扣料(planks 拆两堆)+ 产物带满耐久', () => {
  const h = loadCraft();
  const {craft, RECIPES, mkStack} = h;
  const pick = RECIPES.find((r) => r.id === 'pick_wood');
  const inv = h.mkInventory(); // 手造多堆: add 会并堆, 跨槽场景绕过它
  inv.slots[0] = mkStack('planks', 2);
  inv.slots[1] = mkStack('planks', 2);
  inv.slots[2] = mkStack('stick', 5);
  const res = craft(inv, pick, true);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.out.item, 'pick_wood');
  assert.strictEqual(res.leftover, 0);
  assert.ok(inv.slots[0] && inv.slots[0].id === 'pick_wood', '产物落进扣空的首个空位(并堆→首空位语义)');
  assert.strictEqual(inv.slots[1].n, 1, 'planks 跨槽扣: 第二堆 2→1(第一堆 2 已扣空)');
  assert.strictEqual(inv.slots[2].n, 3, 'stick 5→3');
  assert.strictEqual(inv.slots[0].dur, 120, '产物工具带满耐久(add 经 mkStack)');
});

test('craft: 扣空的槽清位(材料堆 2/2 全扣, 产物并堆不占新位)', () => {
  const h = loadCraft();
  const {craft, RECIPES, mkStack} = h;
  const stick = RECIPES.find((r) => r.id === 'stick');
  const inv = h.mkInventory();
  inv.slots[0] = mkStack('planks', 2); // 恰好够扣且扣空
  inv.slots[1] = mkStack('stick', 1);
  const res = craft(inv, stick, false);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(inv.slots[0], null, 'planks 堆扣空 → 槽清位为 null');
  assert.deepStrictEqual({...inv.slots[1]}, {id: 'stick', n: 5}, '产物并堆 1+4(不占扣空槽)');
});

test('craft: 材料不足不动背包, 返回与 canCraft 一致的 missing', () => {
  const h = loadCraft();
  const {craft, RECIPES} = h;
  const tnt = RECIPES.find((r) => r.id === 'tnt');
  const inv = invWith(h, [['gunpowder', 2], ['sand', 4]]);
  const snapshot = inv.slots.map((s) => (s ? {...s} : null));
  const res = craft(inv, tnt, true);
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(normMissing(res.missing), [{id: 'gunpowder', need: 5, have: 2}]);
  inv.slots.forEach((s, i) => assert.deepStrictEqual(s ? {...s} : s, snapshot[i], '槽位 ' + i + ' 不应被动'));
});

test('craft: 任选材料扣「够量的那键」— 有木炭无煤不碰煤, 两键都有先扣煤', () => {
  const h = loadCraft();
  const {craft, RECIPES, mkStack} = h;
  const torch = RECIPES.find((r) => r.id === 'torch');
  // 只有木炭: 扣木炭(inventory-core take 候选序 coal → charcoal, coal 无货走炭)
  const invA = h.mkInventory();
  invA.slots[0] = mkStack('charcoal', 2);
  invA.slots[1] = mkStack('stick', 1);
  const resA = craft(invA, torch, false);
  assert.strictEqual(resA.ok, true);
  assert.strictEqual(invA.slots[0].n, 1, '木炭 2→1');
  assert.strictEqual(invA.slots[1] && invA.slots[1].id, 'torch', 'stick 扣空清位后成为首个空位, 火把落此');
  assert.strictEqual(invA.slots[1].n, 4, '火把×4');
  assert.strictEqual(invA.slots[2], null);
  // 两键都有且都够: take 候选序优先扣煤(coal 在前)
  const invB = h.mkInventory();
  invB.slots[0] = mkStack('coal', 2);
  invB.slots[1] = mkStack('charcoal', 2);
  invB.slots[2] = mkStack('stick', 1);
  craft(invB, torch, false);
  assert.strictEqual(invB.slots[0].n, 1, '扣煤');
  assert.strictEqual(invB.slots[1].n, 2, '木炭不动');
});

test('craft: 产物优先并堆, 背包满则余量 leftover 返回(零惩罚: 模式层掉地上)', () => {
  const h = loadCraft();
  const {craft, RECIPES, mkStack} = h;
  const planks = RECIPES.find((r) => r.id === 'planks');
  // 已有 60 木板: 产物并堆至上限, 不开新堆
  const invA = h.mkInventory();
  invA.slots[0] = mkStack('log', 1);
  invA.slots[1] = mkStack('planks', 60);
  const resA = craft(invA, planks, false);
  assert.strictEqual(resA.ok, true);
  assert.strictEqual(resA.leftover, 0);
  assert.deepStrictEqual({...invA.slots[1]}, {id: 'planks', n: 64}, '60+4 并到 64');
  assert.strictEqual(invA.slots[2], null, '有空位时不新开堆');
  // 27 槽全满: 产物 4 个全放不下 → leftover 4, 材料照扣(合成已成功)
  const invB = h.mkInventory();
  invB.slots[0] = mkStack('log', 64);
  for (let i = 1; i < 27; i++) invB.slots[i] = mkStack('planks', 64);
  const resB = craft(invB, planks, false);
  assert.strictEqual(resB.ok, true);
  assert.strictEqual(resB.leftover, 4, '满背包余量 4');
  assert.strictEqual(invB.slots[0].n, 63, '原木照扣');
});

/* ============ breakTime: 破坏时间公式(§3.4) ============ */
/* t = hard × (无工具要求或工具匹配 ? 1.5 / 工具速度 : 5), 封顶 8s 下限 0.15s;
   tier 不足 → 可挖慢速但 drops:false(掉落不触发)。blockDef 手写, 字段形状
   对齐 config.js BLOCKS 的 hard/tool/tier/drop(T2 落地)。 */

const stone = {name: '石头', hard: 1.5, tool: 'pick', tier: 1, drop: [['cobble', 1, 0]]};
const ironOre = {name: '铁矿', hard: 3.0, tool: 'pick', tier: 2, drop: [['iron_ore', 1, 0]]};
const dirt = {name: '泥土', hard: 0.6, tool: 'shovel', tier: 0, drop: [['dirt', 1, 0]]};
const leaves = {name: '树叶', hard: 0.2, tool: null, tier: 0, drop: []};
const tuft = {name: '草丛', hard: 0, tool: null, tier: 0, drop: [['wheat_seeds', 0, 0.5]]};

test('breakTime: 徒手石头 7.5s 且不掉落(MC 口径: 教做镐, 研究稿)', () => {
  const {breakTime} = loadCraft();
  const r = breakTime(stone, null);
  assert.strictEqual(r.time, 7.5, '1.5 × 5 = 7.5');
  assert.strictEqual(r.drops, false, 'tier 1 需镐: 徒手可挖慢速但不掉落');
});

test('breakTime: 徒手矿石 15s 封顶 8s(儿童封顶去绝望感, 附录 B)', () => {
  const {breakTime} = loadCraft();
  assert.strictEqual(breakTime(ironOre, null).time, 8, '3.0 × 5 = 15 → 封顶 8');
  const diamondOre = {name: '钻石矿', hard: 3.0, tool: 'pick', tier: 3};
  assert.strictEqual(breakTime(diamondOre, null).time, 8);
  assert.strictEqual(breakTime(diamondOre, null).drops, false);
});

test('breakTime: 匹配工具加速 — 木镐石头 1.125s · 钻镐 0.28125s', () => {
  const {breakTime, mkStack} = loadCraft();
  const r = breakTime(stone, mkStack('pick_wood'));
  assert.strictEqual(r.time, 1.125, '1.5 × 1.5/2');
  assert.strictEqual(r.drops, true, 'tier 1 ≥ 1: 掉圆石');
  assert.strictEqual(breakTime(stone, mkStack('pick_diamond')).time, 0.28125, '1.5 × 1.5/8');
  assert.strictEqual(breakTime(stone, mkStack('pick_diamond')).drops, true);
});

test('breakTime: tier 门槛 — 木镐挖铁矿慢速 8s 不掉, 石镐 1.125s 掉(需更硬的镐子)', () => {
  const {breakTime, mkStack} = loadCraft();
  const wood = breakTime(ironOre, mkStack('pick_wood'));
  assert.strictEqual(wood.time, 8, '类型匹配但 tier 1 < 2 → 慢速 15 封顶 8');
  assert.strictEqual(wood.drops, false, '掉落不触发');
  const rock = breakTime(ironOre, mkStack('pick_stone'));
  assert.strictEqual(rock.time, 1.125, 'tier 2 ≥ 2 → 3.0 × 1.5/4');
  assert.strictEqual(rock.drops, true);
});

test('breakTime: 工具类型不匹配按徒手算 — 斧头砍石头 7.5s 不掉, 镐挖泥土 3s 仍掉', () => {
  const {breakTime, mkStack} = loadCraft();
  const axeOnStone = breakTime(stone, mkStack('axe_diamond'));
  assert.strictEqual(axeOnStone.time, 7.5, '非镐挖石 = 5 倍惩罚');
  assert.strictEqual(axeOnStone.drops, false, '石头只认镐');
  const pickOnDirt = breakTime(dirt, mkStack('pick_diamond'));
  assert.strictEqual(pickOnDirt.time, 3, '0.6 × 5(不匹配不吃工具速度)');
  assert.strictEqual(pickOnDirt.drops, true, '泥土 tier 0: 任何方式都掉');
  assert.strictEqual(breakTime(dirt, null).drops, true, '徒手挖泥土也掉(MC 口径)');
});

test('breakTime: 无工具要求吃 1.5 系数 — 树叶徒手 0.3s; hard 0 触下限 0.15s', () => {
  const {breakTime} = loadCraft();
  const r = breakTime(leaves, null);
  assert.strictEqual(r.time, 0.3, '0.2 × 1.5/1(徒手速度视为 1)');
  assert.strictEqual(r.drops, true);
  assert.strictEqual(breakTime(tuft, null).time, 0.15, 'hard 0 → 0 触发下限');
  assert.strictEqual(breakTime(leaves, null).time >= 0.15, true);
});

test('breakTime: 手持非工具物品视为徒手(null 同口径)', () => {
  const {breakTime, mkStack} = loadCraft();
  const r = breakTime(stone, mkStack('log')); // 手里拿原木
  assert.strictEqual(r.time, 7.5);
  assert.strictEqual(r.drops, false);
});

/* ============ 交叉验证: 与 config.js 真实方块表对表(防字段改名炸公式) ============ */

function loadCraftWithConfig() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'items-core.js', 'craft-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__x = { BLOCKS, breakTime };', ctx);
  return ctx.__x;
}

test('交叉: config.js BLOCKS 实表驱动 — 石头 7.5 · 铁矿封顶 8 · 树叶 0.3', () => {
  const {BLOCKS, breakTime} = loadCraftWithConfig();
  assert.strictEqual(breakTime(BLOCKS[3], null).time, 7.5, '存量方块: 石头(3)');
  assert.strictEqual(breakTime(BLOCKS[37], null).time, 8, '新方块: 铁矿 B_IRON_ORE(37) 封顶');
  assert.strictEqual(breakTime(BLOCKS[37], null).drops, false);
  assert.strictEqual(breakTime(BLOCKS[7], null).time, 0.3, '树叶(7) 徒手秒破');
  assert.strictEqual(breakTime(BLOCKS[1], null).drops, true, '草地(1) tier 0 徒手掉泥土');
});
