'use strict';
/* 合成核心 (js/craft-core.js) 单测 — node --test (零依赖)
   运行: node --test test/craft-core.test.js
   加载器: 同一 vm context 依次执行 items-core.js + inventory-core.js +
   craft-core.js — 镜像浏览器 <script defer> 共享词法环境(craft-core 的
   背包操作经 inventory-core 的 count/take/add 接口)。craft-core 顶层从
   ITEMS 派生 FUEL 择优序, 加载序「items-core 之后」由此测试守护;
   不加载 config.js — breakTime 收 blockDef 纯数据, 交叉验证单列一节。
   九宫格改造(crafting-grid 设计稿): shape 图案数据防错网 + matchGrid
   匹配引擎(平移/镜像/候选/无序) + gridCraft/fillGrid 编排, 与旧
   cost 计费自动合成(craft 已退役)的对照语义全部翻到摆放口径。 */
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
      shapeCost: typeof shapeCost === 'undefined' ? undefined : shapeCost,
      canCraft: typeof canCraft === 'undefined' ? undefined : canCraft,
      matchGrid: typeof matchGrid === 'undefined' ? undefined : matchGrid,
      gridCraft: typeof gridCraft === 'undefined' ? undefined : gridCraft,
      fillGrid: typeof fillGrid === 'undefined' ? undefined : fillGrid,
      craft: typeof craft === 'undefined' ? undefined : craft,
      fuelUnits: typeof fuelUnits === 'undefined' ? undefined : fuelUnits,
      smeltOf: typeof smeltOf === 'undefined' ? undefined : smeltOf,
      SMELT_T: typeof SMELT_T === 'undefined' ? undefined : SMELT_T,
      smeltStep: typeof smeltStep === 'undefined' ? undefined : smeltStep,
      furnaceRefund: typeof furnaceRefund === 'undefined' ? undefined : furnaceRefund,
      breakTime: typeof breakTime === 'undefined' ? undefined : breakTime,
      ITEMS: typeof ITEMS === 'undefined' ? undefined : ITEMS,
      mkStack: typeof mkStack === 'undefined' ? undefined : mkStack,
      mkInventory: typeof mkInventory === 'undefined' ? undefined : mkInventory,
      add: typeof add === 'undefined' ? undefined : add,
      count: typeof count === 'undefined' ? undefined : count,
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

/* 造摆放: 9 格(3×3 台)槽堆数组, [[下标, id, n], ...] 占位 */
function cellsWith(entries) {
  const cells = new Array(9).fill(null);
  for (const [i, id, n] of entries) cells[i] = {id, n: n || 1};
  return cells;
}

/* 配方图案 → 顶格摆放在 3×3 台的槽堆(候选取首位 id); 两两不同构测试用 */
function cellsOfRecipe(r) {
  const cells = new Array(9).fill(null);
  const one = (spec) => ({id: Array.isArray(spec) ? spec[0] : spec, n: 1});
  if (r.shape.any) r.shape.any.forEach((spec, i) => (cells[i] = one(spec)));
  else {
    r.shape.rows.forEach((row, ri) => row.forEach((spec, ci) => {
      if (spec != null) cells[ri * 3 + ci] = one(spec);
    }));
  }
  return cells;
}

/* 图案最小包围盒 [宽, 高](无序按材料数粗判: >4 必然 3×3 才放得下) */
function bboxOf(r) {
  if (r.shape.any) return r.shape.any.length > 4 ? [3, 3] : [2, 2];
  const rows = r.shape.rows;
  return [Math.max(...rows.map((row) => row.length)), rows.length];
}

/* ============ 加载: 共享词法环境的顶层接口 ============ */

test('加载: 顶层暴露三张表 + 九宫格纯函数组(FUEL 从 ITEMS 派生), 旧 craft 已退役', () => {
  const h = loadCraft();
  assert.strictEqual(typeof h.RECIPES, 'object');
  assert.strictEqual(typeof h.SMELTS, 'object');
  assert.strictEqual(Array.isArray(h.FUEL), true);
  for (const f of ['shapeCost', 'canCraft', 'matchGrid', 'gridCraft', 'fillGrid']) {
    assert.strictEqual(typeof h[f], 'function', f + ' 应为顶层函数');
  }
  assert.strictEqual(h.craft, undefined, 'cost 计费自动合成 craft() 已随九宫格改造退役(gridCraft 接棒)');
});

/* ============ 配方表防错网: 以后加配方漏字段/漏注册当场红 ============ */

test('配方全量: 随身 13 + 工作台级 28 共 41 条, id 唯一(crafting-grid §3 + 下界 D3 + 雪球 T9 + 门/玻璃板 + 补链 D1 + 大背包)', () => {
  const {RECIPES} = loadCraft();
  const ids = RECIPES.map((r) => r.id);
  assert.strictEqual(new Set(ids).size, ids.length, '配方 id 应唯一');
  assert.strictEqual(RECIPES.length, 41,
      '全表 41 条(随身 13 + 工具 16 + 站点件 8 + 门/玻璃板 2 + 大背包 1 + 传送门 1), 实际 ' + RECIPES.length);
  // 随身级(拍板①②: Wiki 点名 4 例 + 迁回 4 条 + 铁粒 + 雪块 T9 + 补链 D1 砂岩/羊毛)
  for (const id of ['planks', 'stick', 'craft_table', 'torch', 'stone_bricks', 'bricks', 'shears',
    'bone_meal', 'iron_nuggets', 'snow', 'sandstone', 'wool']) {
    const r = RECIPES.find((x) => x.id === id);
    assert.ok(r, '随身配方 ' + id + ' 应存在');
    assert.strictEqual(r.station, 'hand', id + ' 应为 hand 级');
  }
  // 工作台级: 工具 16 + furnace/chest/bed/lantern/golden_apple/tnt/bow_item/bread + door/glass_pane + 铁粒回炉(9 格 D1) + 大背包
  const tableIds = ['pick_wood', 'pick_stone', 'pick_iron', 'pick_diamond',
    'axe_wood', 'axe_stone', 'axe_iron', 'axe_diamond',
    'sword_wood', 'sword_stone', 'sword_iron', 'sword_diamond',
    'shovel_wood', 'shovel_stone', 'shovel_iron', 'shovel_diamond',
    'furnace', 'chest', 'bed', 'lantern', 'golden_apple', 'tnt', 'bow_item', 'bread',
    'door', 'glass_pane', 'iron_ingot', 'bag_upgrade'];
  for (const id of tableIds) {
    const r = RECIPES.find((x) => x.id === id);
    assert.ok(r, '工作台级配方 ' + id + ' 应存在');
    assert.strictEqual(r.station, 'table', id + ' 应为 table 级');
  }
});

test('条目形状: out{n≥1}·shape 合法(rows/any 二选一, 规约=id|候选数组且全在 ITEMS)', () => {
  const {RECIPES, ITEMS} = loadCraft();
  for (const r of RECIPES) {
    assert.strictEqual(typeof r.id, 'string', 'id 应为字符串');
    assert.ok(r.out && typeof r.out.item === 'string', r.id + ' out.item');
    assert.ok(Number.isInteger(r.out.n) && r.out.n >= 1, r.id + ' out.n 应为 ≥1 整数');
    assert.ok(ITEMS[r.out.item], r.id + ' 产物 ' + r.out.item + ' 应在 ITEMS 注册(防改表漏注册)');
    assert.ok(r.shape, r.id + ' 应带 shape 图案(crafting-grid §3)');
    const specs = [];
    if (r.shape.rows) {
      assert.ok(Array.isArray(r.shape.rows) && r.shape.rows.length >= 1, r.id + ' rows 应为非空行数组');
      for (const row of r.shape.rows) {
        assert.ok(Array.isArray(row), r.id + ' rows 行应为数组');
        for (const spec of row) {
          if (spec != null) specs.push(spec);
        }
      }
    } else if (r.shape.any) {
      assert.ok(Array.isArray(r.shape.any) && r.shape.any.length >= 1, r.id + ' any 应为非空数组');
      r.shape.any.forEach((spec) => specs.push(spec));
    } else {
      assert.fail(r.id + ' shape 应为 {rows} 或 {any} 之一');
    }
    for (const spec of specs) {
      if (typeof spec === 'string') {
        assert.ok(ITEMS[spec], r.id + ' 材料 ' + spec + ' 应在 ITEMS 注册');
      } else {
        assert.ok(Array.isArray(spec) && spec.length >= 2, r.id + ' 候选规约应为 ≥2 的 id 数组');
        for (const c of spec) assert.ok(ITEMS[c], r.id + ' 候选 ' + c + ' 应在 ITEMS 注册');
      }
    }
  }
});

test('正典归属不变式: station hand ⇔ 图案 ≤2×2(随身格放得下), table ⇔ 越界(研究稿 §1)', () => {
  const {RECIPES} = loadCraft();
  for (const r of RECIPES) {
    const [w, hh] = bboxOf(r);
    if (r.station === 'hand') {
      assert.ok(w <= 2 && hh <= 2, r.id + ' hand 级图案应 ≤2×2, 实际 ' + w + '×' + hh);
    } else {
      assert.ok(w > 2 || hh > 2, r.id + ' table 级图案应 >2×2(否则随身可做, 迁 hand)');
    }
  }
});

test('两两不同构: 任一配方的顶格摆放不误中其它配方(同摆多配兜底的防错网, §2.6)', () => {
  const {RECIPES, matchGrid} = loadCraft();
  for (const a of RECIPES) {
    const cells = cellsOfRecipe(a);
    assert.strictEqual(matchGrid(cells, a), true, a.id + ' 自身图案应命中自身');
    for (const b of RECIPES) {
      if (b !== a) {
        assert.strictEqual(matchGrid(cells, b), false,
            a.id + ' 的摆放不应误中 ' + b.id + '(图案同构或包含, 需改图案或登记例外)');
      }
    }
  }
});

test('shapeCost 派生: 图案→计费表与正典材料量逐条一致(候选组=任选形状)', () => {
  const h = loadCraft();
  const {RECIPES, shapeCost} = h;
  const by = {};
  for (const r of RECIPES) by[r.id] = r;
  /* vm context 对象跨 realm 原型不同, deepStrictEqual 会误判(items-core.test.js 先例):
     cost 展开回宿主 realm 再比; 任选值嵌套数组一并展开 */
  const cost = (id) => {
    const o = {};
    for (const [k, v] of Object.entries(shapeCost(by[id]))) o[k] = Array.isArray(v) ? [[...v[0]], v[1]] : v;
    return o;
  };
  // 随身级(§3.2 + 拍板②迁移 + 拍板⑤铁粒)
  assert.deepStrictEqual(cost('planks'), {log: 1});
  assert.deepStrictEqual(cost('stick'), {planks: 2});
  assert.deepStrictEqual(cost('craft_table'), {planks: 4});
  assert.deepStrictEqual(cost('torch'), {'stick': 1, 'charcoal|coal': [['coal', 'charcoal'], 1]}); // 煤/木炭任选
  assert.deepStrictEqual(cost('stone_bricks'), {stone: 4});
  assert.deepStrictEqual(cost('bricks'), {brick: 4});
  assert.deepStrictEqual(cost('shears'), {iron_ingot: 2});
  assert.deepStrictEqual(cost('bone_meal'), {bone: 1}); // 无序单材料
  assert.deepStrictEqual(cost('iron_nuggets'), {iron_ingot: 1}); // 1 铁锭→9 铁粒
  assert.deepStrictEqual(cost('snow'), {snowball: 4}); // 4 雪球→雪块(挖雪块返 4 球的合成反向, T9)
  // 站点件(§3.5 口径不变 + 灯笼回正典)
  assert.deepStrictEqual(cost('furnace'), {cobble: 8});
  assert.deepStrictEqual(cost('chest'), {planks: 8});
  assert.deepStrictEqual(cost('bed'), {wool: 3, planks: 3});
  assert.deepStrictEqual(cost('lantern'), {iron_nugget: 8, torch: 1}); // 拍板⑤回正典(旧 2 铁锭折算闭环)
  assert.deepStrictEqual(cost('golden_apple'), {gold_ingot: 8, apple: 1});
  assert.deepStrictEqual(cost('tnt'), {gunpowder: 5, sand: 4});
  assert.deepStrictEqual(cost('bow_item'), {stick: 3, string: 3});
  assert.deepStrictEqual(cost('bread'), {wheat: 3});
});

test('图案抽查: 工具四模板 × 镐 3×3 十字 · 斧 2×3 缺角 · 剑/锹 1×3 竖排(研究稿 §3.2)', () => {
  const {RECIPES} = loadCraft();
  const by = {};
  for (const r of RECIPES) by[r.id] = r;
  const rows = (id) => JSON.parse(JSON.stringify(by[id].shape.rows)); // 跨 realm 深拷回宿主再比
  assert.deepStrictEqual(rows('pick_wood'),
      [['planks', 'planks', 'planks'], [null, 'stick', null], [null, 'stick', null]]);
  assert.deepStrictEqual(rows('axe_iron'), [['iron_ingot', 'iron_ingot'], ['iron_ingot', 'stick'], [null, 'stick']]);
  assert.deepStrictEqual(rows('sword_diamond'), [['diamond'], ['diamond'], ['stick']]);
  assert.deepStrictEqual(rows('shovel_stone'), [['cobble'], ['stick'], ['stick']]);
  // 站点件图案要点(研究稿 §3.3)
  assert.deepStrictEqual(rows('shears'), [[null, 'iron_ingot'], ['iron_ingot', null]], '剪刀=对角两铁锭');
  assert.deepStrictEqual(rows('bed'), [['wool', 'wool', 'wool'], ['planks', 'planks', 'planks']], '床=羊毛上排+木板下排');
  assert.deepStrictEqual(rows('lantern')[1], ['iron_nugget', 'torch', 'iron_nugget'], '灯笼=8 铁粒环形+中心火把');
  assert.deepStrictEqual(rows('bread'), [['wheat', 'wheat', 'wheat']], '面包=3 小麦一横排');
  assert.deepStrictEqual(rows('bow_item')[1], ['stick', null, 'string'], '弓=棍蛇形+线列');
});

test('雪球→雪块(T9): 4 雪球 2×2 → 1 雪块 — canCraft 预检 + 2×2 随身格 gridCraft', () => {
  const h = loadCraft();
  const {RECIPES, canCraft, matchGrid, gridCraft} = h;
  const r = RECIPES.find((x) => x.id === 'snow');
  assert.ok(r, '配方 id=snow 应入 RECIPES(4 雪球→雪块, 雪仗弹药↔建材的正反向)');
  assert.strictEqual(r.station, 'hand', '2×2 满格图案随身格放得下(MC 正典 shapeless 同档)');
  /* canCraft 预检: 3 球缺 1 → missing 报 {snowball, need 4, have 3}; 4 球 ok */
  const short = invWith(h, [['snowball', 3]]);
  const miss = normMissing(canCraft(short, r, false).missing);
  assert.deepStrictEqual(miss, [{id: 'snowball', need: 4, have: 3}], '缺 1 球报缺料');
  const full = invWith(h, [['snowball', 4]]);
  const ok = canCraft(full, r, false);
  assert.strictEqual(ok.ok, true, '4 球预检过(hand 级不吃站点门禁)');
  assert.deepStrictEqual(normMissing(ok.missing), [], '无缺料');
  /* 2×2 随身格(cells 长度 4 → gridNorm 按 2×2)摆放合成: 每格扣 1 产 1 雪块 */
  const cells4 = new Array(4).fill(null).map(() => ({id: 'snowball', n: 1}));
  assert.strictEqual(matchGrid(cells4, r), true, '2×2 满格四球匹配');
  const out = gridCraft(cells4, full, false);
  assert.strictEqual(out.ok, true, 'gridCraft ok');
  assert.strictEqual(out.out.item, 'snow', '产物=雪块');
  assert.strictEqual(out.out.n, 1, '产出 1 块');
  assert.strictEqual(out.leftover, 0, '无余量');
  assert.deepStrictEqual(cells4, [null, null, null, null], '每占用格扣 1 件(扣空清 null)');
  assert.strictEqual(h.count(full, 'snow'), 1, '雪块入包');
  assert.strictEqual(h.count(full, 'snowball'), 4, '背包另一摞不动(料从摆放格扣, MC 口径)');
});

test('工具 16 条: 4 模板 × 4 材质阶, 材料计费随阶替换(shapeCost 派生)', () => {
  const {RECIPES, shapeCost} = loadCraft();
  const by = {};
  for (const r of RECIPES) by[r.id] = r;
  const mats = {wood: 'planks', stone: 'cobble', iron: 'iron_ingot', diamond: 'diamond'};
  const cnt = {pick: [3, 2], axe: [3, 2], sword: [2, 1], shovel: [1, 2]}; // §5.4 材+棍
  for (const [mat, itemId] of Object.entries(mats)) {
    for (const [kind, [m, s]] of Object.entries(cnt)) {
      const r = by[kind + '_' + mat];
      assert.ok(r, kind + '_' + mat + ' 配方应存在');
      assert.deepStrictEqual({...r.out}, {item: kind + '_' + mat, n: 1}, '工具产物 1 件(不可堆叠)');
      const c = {};
      for (const [k, v] of Object.entries(shapeCost(r))) c[k] = v;
      assert.deepStrictEqual(c, {[itemId]: m, stick: s}, kind + '_' + mat + ' 材料计费');
    }
  }
});

test('烧炼表: 十条映射与任务合同逐条一致(铁/金粗矿·木炭·石→圆石循环·玻璃·红砖·F4 生→熟肉四条)', () => {
  const {SMELTS} = loadCraft();
  assert.deepStrictEqual({...SMELTS}, {
    iron_ore: 'iron_ingot',
    gold_ore: 'gold_ingot',
    log: 'charcoal',
    cobble: 'stone',
    sand: 'glass',
    clay_ball: 'brick',
    raw_beef: 'cooked_beef',
    raw_porkchop: 'cooked_porkchop',
    raw_chicken: 'cooked_chicken',
    raw_mutton: 'cooked_mutton',
  });
});

test('燃料择优序: 读 ITEMS fuel 字段按热值降序(煤→木炭→原木→木板→木棍→树苗, D8; 树苗半件 MC 正典补链 D1——注册表序在木棍后同值稳定排序)', () => {
  const {FUEL} = loadCraft();
  assert.deepStrictEqual([...FUEL], ['coal', 'charcoal', 'log', 'planks', 'stick', 'sapling']);
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

test('smeltOf: 十条烧炼映射逐条命中, 未登记原料返回 null', () => {
  const {smeltOf} = loadCraft();
  assert.strictEqual(smeltOf('iron_ore'), 'iron_ingot');
  assert.strictEqual(smeltOf('gold_ore'), 'gold_ingot');
  assert.strictEqual(smeltOf('log'), 'charcoal');
  assert.strictEqual(smeltOf('cobble'), 'stone');
  assert.strictEqual(smeltOf('sand'), 'glass');
  assert.strictEqual(smeltOf('clay_ball'), 'brick');
  /* F4 生→熟肉四条(二期设计稿 §4.6): 烧炼时长/燃料与矿物同套 */
  assert.strictEqual(smeltOf('raw_beef'), 'cooked_beef');
  assert.strictEqual(smeltOf('raw_porkchop'), 'cooked_porkchop');
  assert.strictEqual(smeltOf('raw_chicken'), 'cooked_chicken');
  assert.strictEqual(smeltOf('raw_mutton'), 'cooked_mutton');
  assert.strictEqual(smeltOf('cooked_beef'), null, '熟肉不可再烧');
  assert.strictEqual(smeltOf('bread'), null, '食物不可烧');
  assert.strictEqual(smeltOf('not_registered'), null);
});

/* ============ 烧炼步进与退炉政策(2026-10 自 adventure-core 迁入, 直测随迁) ============ */

test('smeltStep: 2.5s 产一件 · 煤热值 8 件烧 1 件余 7(政策与表同居)', () => {
  const h = loadCraft();
  assert.strictEqual(h.SMELT_T, 2.5, '每件烧炼秒数常量(D8: MC 10s → 儿童缩短)');
  const s = h.smeltStep({input: {id: 'iron_ore', n: 1}, fuel: {id: 'coal', n: 1},
    out: null, heat: 0, prog: 0}, 2.5);
  /* 产自 vm 语境的对象先展开进宿主再比对(数组/原型与宿主不同, gridCraft 同款) */
  assert.deepStrictEqual({...s.out}, {id: 'iron_ingot', n: 1}, '2.5s 产一件');
  assert.strictEqual(s.heat, 7, '煤热值 8 件, 烧 1 件余 7');
});

test('furnaceRefund: 炉内三笔全额退包(零惩罚口径)', () => {
  const h = loadCraft();
  const inv = h.mkInventory();
  assert.deepStrictEqual([...h.furnaceRefund(inv,
      {input: {id: 'iron_ore', n: 3}, fuel: null, out: null, heat: 0, prog: 0})], [], '三笔全退');
  assert.strictEqual(h.count(inv, 'iron_ore'), 3, '退包入账');
});

/* ============ matchGrid: 摆放→配方匹配(口径全正典, 研究稿 §2) ============ */

test('matchGrid 有序: 顶格命中 · 图案可在格内平移(Wiki 面包任意一行的例)', () => {
  const {RECIPES, matchGrid} = loadCraft();
  const by = (id) => RECIPES.find((r) => r.id === id);
  // 木镐顶格
  const pickTop = cellsWith([[0, 'planks'], [1, 'planks'], [2, 'planks'], [4, 'stick'], [7, 'stick']]);
  assert.strictEqual(matchGrid(pickTop, by('pick_wood')), true);
  // 面包 3×1: 上/中/下三行皆可(平移语义)
  const row = (r) => cellsWith([[r * 3, 'wheat'], [r * 3 + 1, 'wheat'], [r * 3 + 2, 'wheat']]);
  assert.strictEqual(matchGrid(row(0), by('bread')), true);
  assert.strictEqual(matchGrid(row(1), by('bread')), true);
  assert.strictEqual(matchGrid(row(2), by('bread')), true);
  // 木板 1×1: 任意一格
  assert.strictEqual(matchGrid(cellsWith([[8, 'log']]), by('planks')), true);
});

test('matchGrid 镜像: 水平翻转自动重试(斧/弓/剪刀左右手版), 垂直翻转不中', () => {
  const {RECIPES, matchGrid} = loadCraft();
  const by = (id) => RECIPES.find((r) => r.id === id);
  // 铁斧原向(M M / M S / · S)与镜像(每行逆序 = 左撇子版)
  const axeA = cellsWith([[0, 'iron_ingot'], [1, 'iron_ingot'], [3, 'iron_ingot'], [4, 'stick'], [7, 'stick']]);
  assert.strictEqual(matchGrid(axeA, by('axe_iron')), true);
  const axeM = cellsWith([[1, 'iron_ingot'], [2, 'iron_ingot'], [4, 'stick'], [5, 'iron_ingot'], [7, 'stick']]);
  assert.strictEqual(matchGrid(axeM, by('axe_iron')), true, '斧镜像(左撇子版, 平移到右两列)');
  // 剪刀对角两方向
  assert.strictEqual(matchGrid(cellsWith([[1, 'iron_ingot'], [3, 'iron_ingot']]), by('shears')), true);
  assert.strictEqual(matchGrid(cellsWith([[0, 'iron_ingot'], [2, 'iron_ingot']]), by('shears')), false, '上下对角≠水平镜像');
  const fourCorners = cellsWith([[0, 'iron_ingot'], [2, 'iron_ingot'], [6, 'iron_ingot'], [8, 'iron_ingot']]);
  assert.strictEqual(matchGrid(fourCorners, by('shears')), false, '四角更不中');
  // 剑倒摆 = 垂直翻转 → 不中
  assert.strictEqual(matchGrid(cellsWith([[0, 'stick'], [3, 'planks'], [6, 'planks']]), by('sword_wood')), false);
});

test('matchGrid 候选规约: 火把煤/木炭任一(MC tag 口径), 混摆亦中', () => {
  const {RECIPES, matchGrid} = loadCraft();
  const torch = RECIPES.find((r) => r.id === 'torch');
  assert.strictEqual(matchGrid(cellsWith([[0, 'coal'], [3, 'stick']]), torch), true);
  assert.strictEqual(matchGrid(cellsWith([[0, 'charcoal'], [3, 'stick']]), torch), true);
  assert.strictEqual(matchGrid(cellsWith([[2, 'charcoal'], [5, 'stick']]), torch), true, '右列竖排(平移+候选)');
  assert.strictEqual(matchGrid(cellsWith([[0, 'iron_ingot'], [3, 'stick']]), torch), false, '异种不中');
});

test('matchGrid 大背包: 线提手+皮革包身环形(原版 1.17 bundle 图案, 中格空)', () => {
  const {RECIPES, matchGrid, shapeCost} = loadCraft();
  const by = (id) => RECIPES.find((r) => r.id === id);
  // 正图案: 顶行两角线 + 两整行皮革(中格空)
  const bag = cellsWith([[0, 'string'], [2, 'string'], [3, 'leather'], [4, 'leather'], [5, 'leather'],
    [6, 'leather'], [7, 'leather'], [8, 'leather']]);
  assert.strictEqual(matchGrid(bag, by('bag_upgrade')), true);
  // 提手/包身颠倒(皮革角+线行)= 异图案不中
  assert.strictEqual(matchGrid(cellsWith([[0, 'leather'], [2, 'leather'], [3, 'string'], [4, 'string'],
    [5, 'string'], [6, 'string'], [7, 'string'], [8, 'string']]), by('bag_upgrade')), false, '上下颠倒不中');
  // 派生计费: 2 线 + 6 皮革(shapeCost 单一数据源; 跨 realm 产物用宽松 deepEqual,
  // drops.test.js 先例)
  assert.deepEqual(shapeCost(by('bag_upgrade')), {string: 2, leather: 6});
});

test('matchGrid 无序: 骨粉任意格, 多一件不中, 空格随意', () => {
  const {RECIPES, matchGrid} = loadCraft();
  const bone = RECIPES.find((r) => r.id === 'bone_meal');
  assert.strictEqual(matchGrid(cellsWith([[3, 'bone']]), bone), true, '2×2 随身格中任意格');
  assert.strictEqual(matchGrid(cellsWith([[8, 'bone']]), bone), true);
  assert.strictEqual(matchGrid(cellsWith([[0, 'bone'], [4, 'stone']]), bone), false, '多一件不中');
  assert.strictEqual(matchGrid(new Array(9).fill(null), bone), false, '全空不中');
});

test('matchGrid 负例: 图案外多余物 · 3 宽图案进 2×2 台 · 空格数组', () => {
  const {RECIPES, matchGrid} = loadCraft();
  const by = (id) => RECIPES.find((r) => r.id === id);
  assert.strictEqual(matchGrid(cellsWith([[0, 'coal'], [3, 'stick'], [6, 'stone']]), by('torch')), false, '图案外多余物品');
  const pickTop = cellsWith([[0, 'planks'], [1, 'planks'], [2, 'planks'], [4, 'stick'], [7, 'stick']]);
  assert.strictEqual(matchGrid(pickTop, by('pick_wood')), true);
  // 3×3 台图案进 2×2: 用 4 格数组摆不下镐(宽 3)
  const four = cellsWith([[0, 'planks'], [1, 'planks'], [2, 'planks'], [3, 'stick']]);
  assert.strictEqual(matchGrid(four, by('pick_wood')), false, '长 9 判 3×3, 4 格数组按 2×2 规格: 宽 3 放不下');
  assert.strictEqual(matchGrid(null, by('planks')), false, '防御: cells 空');
  assert.strictEqual(matchGrid(new Array(9).fill(null), null), false, '防御: recipe 空');
});

/* ============ gridCraft: 摆放台合成执行(每占用格扣 1 + 产栈入包) ============ */

test('gridCraft: 木镐一发 — 每占用格扣 1(扣空清格) + 产物带满耐久入包', () => {
  const h = loadCraft();
  const {gridCraft, count} = h;
  const inv = h.mkInventory();
  const cells = cellsWith([[0, 'planks', 2], [1, 'planks'], [2, 'planks'], [4, 'stick', 2], [7, 'stick']]);
  const res = gridCraft(cells, inv, true);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual({...res.out}, {item: 'pick_wood', n: 1});
  assert.strictEqual(res.leftover, 0);
  assert.strictEqual(cells[0].n, 1, '占用格各扣 1');
  assert.strictEqual(cells[1], null, '单件格扣空清位');
  assert.strictEqual(cells[4].n, 1);
  assert.strictEqual(count(inv, 'pick_wood'), 1);
  const made = inv.slots.find((s) => s && s.id === 'pick_wood');
  assert.strictEqual(made.dur, 120, '产物工具带满耐久(add 经 mkStack)');
});

test('gridCraft: 连做两发(格内备两套) → 第三发料尽 nomatch 不动包', () => {
  const h = loadCraft();
  const {gridCraft} = h;
  const inv = h.mkInventory();
  const cells = cellsWith([[0, 'planks', 2], [1, 'planks', 2], [2, 'planks', 2], [4, 'stick', 2], [7, 'stick', 2]]);
  assert.strictEqual(gridCraft(cells, inv, true).ok, true);
  assert.strictEqual(gridCraft(cells, inv, true).ok, true);
  const snap = inv.slots.map((s) => (s ? {...s} : null));
  const res = gridCraft(cells, inv, true);
  assert.deepStrictEqual([res.ok, res.reason], [false, 'nomatch']);
  inv.slots.forEach((s, i) => assert.deepStrictEqual(s ? {...s} : s, snap[i], '槽 ' + i + ' 不动'));
  assert.strictEqual(cells.filter(Boolean).length, 0, '两套扣完格全空');
});

test('gridCraft: 站点门禁 — table 级图案 stationOk=false 拒绝(面板侧由锁定格保证, 此为防线)', () => {
  const h = loadCraft();
  const {gridCraft} = h;
  const ring = [0, 1, 2, 3, 5, 6, 7, 8]; // 8 圆石环形(中心空)
  const cells = cellsWith(ring.map((i) => [i, 'cobble']));
  const res = gridCraft(cells, h.mkInventory(), false);
  assert.deepStrictEqual([res.ok, res.reason], [false, 'station']);
  assert.strictEqual(cells[0].n, 1, '拒绝时格内材料不动');
  assert.strictEqual(gridCraft(cells, h.mkInventory(), true).out.item, 'furnace');
});

test('gridCraft: 满背包余量 leftover 返回(零惩罚: 模式层掉地上)', () => {
  const h = loadCraft();
  const {gridCraft, mkStack} = h;
  const inv = h.mkInventory();
  for (let i = 0; i < 27; i++) inv.slots[i] = mkStack('planks', 64); // 全满
  const cells = cellsWith([[0, 'log']]);
  const res = gridCraft(cells, inv, true);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.leftover, 4, '产物 4 个全放不下');
  assert.strictEqual(cells[0], null, '材料照扣');
});

/* ============ fillGrid: BE 口径一键摆入(拍板③) ============ */

test('fillGrid: 一套装入(逐规约格取 1) · 重复调用=再备一套(连做备料)', () => {
  const h = loadCraft();
  const {fillGrid, RECIPES} = h;
  const pick = RECIPES.find((r) => r.id === 'pick_wood');
  const inv = invWith(h, [['planks', 6], ['stick', 4]]);
  const cells = new Array(9).fill(null);
  const f1 = fillGrid(inv, pick, cells);
  assert.deepStrictEqual([...f1.placed], ['planks', 'planks', 'planks', 'stick', 'stick']);
  assert.deepStrictEqual([...f1.missing], []);
  assert.strictEqual(cells[0].n, 1, '图案顶格摆入');
  assert.strictEqual(cells[4].id, 'stick');
  const f2 = fillGrid(inv, pick, cells); // 再点一张卡: 备第二套
  assert.strictEqual(cells[0].n, 2, '并堆+1');
  assert.strictEqual(cells[7].n, 2);
  assert.strictEqual(h.count(inv, 'planks'), 0, '6 板两套刚好用完');
  assert.strictEqual(h.count(inv, 'stick'), 0);
  assert.deepStrictEqual([...f2.missing], []);
});

test('fillGrid: 缺料留空(部分摆入) + missing 报缺什么(候选报首位)', () => {
  const h = loadCraft();
  const {fillGrid, RECIPES} = h;
  const torch = RECIPES.find((r) => r.id === 'torch');
  const inv = invWith(h, [['coal', 1]]); // 只有煤, 缺棍
  const cells = new Array(9).fill(null);
  const f = fillGrid(inv, torch, cells);
  assert.deepStrictEqual([...f.placed], ['coal']);
  assert.deepStrictEqual([...f.missing], ['stick']);
  assert.strictEqual(cells[0].id, 'coal');
  assert.strictEqual(cells[3], null, '缺料格留空');
});

test('fillGrid: 异物清扫 — 格内非本配方材料整摞退包(含图案空位上的), 再摆入', () => {
  const h = loadCraft();
  const {fillGrid, RECIPES} = h;
  const shears = RECIPES.find((r) => r.id === 'shears');
  const inv = invWith(h, [['iron_ingot', 2]]);
  const cells = cellsWith([[0, 'stone', 2], [1, 'wool']]); // 两格异物(含剪刀图案空位 0)
  const f = fillGrid(inv, shears, cells);
  assert.deepStrictEqual([...f.placed], ['iron_ingot', 'iron_ingot']);
  assert.strictEqual(cells[0], null, '图案空位(0,0)的石头被清走');
  assert.strictEqual(cells[1].id, 'iron_ingot', '对角位收铁锭');
  assert.strictEqual(cells[3].id, 'iron_ingot');
  assert.strictEqual(h.count(inv, 'stone'), 2, '石头退回背包');
  assert.strictEqual(h.count(inv, 'wool'), 1);
});

test('fillGrid: hand 配方在 2×2 站点摆位天然落在激活区(索引 r*3+c, 行列 <2)', () => {
  const h = loadCraft();
  const {fillGrid, RECIPES} = h;
  const torch = RECIPES.find((r) => r.id === 'torch');
  const inv = invWith(h, [['charcoal', 1], ['stick', 1]]);
  const cells = new Array(9).fill(null); // 面板恒 9 格, 2×2 站点锁外圈
  fillGrid(inv, torch, cells);
  assert.strictEqual(cells[0].id, 'charcoal', '火把竖排落在 (0,0)');
  assert.strictEqual(cells[3].id, 'stick', '木棍落在 (1,0) — 2×2 激活区(0/1/3/4)内');
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
  const {canCraft, canAfford, shapeCost} = h;
  // 手造图案: 无序 2 煤/炭候选 + 7 木棍(=9 格上限内)
  const recipe = {id: 'probe', out: {item: 'torch', n: 1}, station: 'hand',
    shape: {any: [['coal', 'charcoal'], ['coal', 'charcoal'],
      'stick', 'stick', 'stick', 'stick', 'stick', 'stick', 'stick']}};
  const cost = shapeCost(recipe);
  const inv = invWith(h, [['coal', 1], ['charcoal', 1], ['stick', 7]]);
  assert.strictEqual(canAfford(inv, cost), true, '背包核心: 候选合计 1+1 ≥ 2');
  assert.strictEqual(canCraft(inv, recipe, true).ok, true, '合成核心口径应与之一致');
  const invShort = invWith(h, [['coal', 1], ['stick', 7]]);
  assert.strictEqual(canAfford(invShort, cost), false);
  assert.strictEqual(canCraft(invShort, recipe, true).ok, false);
});

/* ============ breakTime: 破坏时间公式(挖掘硬度修正 D1, JE 正交口径) ============ */
/* 品类对(不看等级) → 速度乘数生效; canHarvest(tier 0, 或品类对且等级够) →
   ×1.5/×5 系数与掉落门禁。t = hard × (canHarvest ? 1.5 : 5) / 速度乘数,
   封顶 8s 下限 0.15s; tier 不足 → 可挖慢速但 drops:false(掉落不触发)。
   blockDef 手写, 字段形状对齐 config.js BLOCKS 的 hard/tool/tier/drop(T2 落地)。 */

const stone = {name: '石头', hard: 1.5, tool: 'pick', tier: 1, drop: [['cobble', 1, 0]]};
const ironOre = {name: '铁矿', hard: 3.0, tool: 'pick', tier: 2, drop: [['iron_ore', 1, 0]]};
const dirt = {name: '泥土', hard: 0.6, tool: 'shovel', tier: 0, drop: [['dirt', 1, 0]]};
const leaves = {name: '树叶', hard: 0.2, tool: null, tier: 0, drop: []};
const tuft = {name: '草丛', hard: 0, tool: null, tier: 0, drop: [['wheat_seeds', 0, 0.5]]};
/* 树叶桩用 tool:null 代表「无品类」方块(玻璃/草丛同族); 真树叶 BLOCKS[7] 已改
   'shears' 品类(D2), 其剪刀匹配在下方交叉测试 + blocks-fields/drops 单测覆盖 */

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

test('breakTime: tier 门槛 — 木镐挖铁矿慢速 7.5s 不掉, 石镐 1.125s 掉(需更硬的镐子)', () => {
  const {breakTime, mkStack} = loadCraft();
  const wood = breakTime(ironOre, mkStack('pick_wood'));
  assert.strictEqual(wood.time, 7.5, '品类对 tier 1 < 2 → 3×5/2 = 7.5(JE 保留工具速度, D1)');
  assert.strictEqual(wood.drops, false, '掉落不触发');
  const rock = breakTime(ironOre, mkStack('pick_stone'));
  assert.strictEqual(rock.time, 1.125, 'tier 2 ≥ 2 → 3.0 × 1.5/4');
  assert.strictEqual(rock.drops, true);
  const gold = {name: '金矿', hard: 3.0, tool: 'pick', tier: 3};
  const stoneOnGold = breakTime(gold, mkStack('pick_stone'));
  assert.strictEqual(stoneOnGold.time, 3.75, '品类对 tier 2 < 3 → 3×5/4 = 3.75(现状曾封顶 8)');
  assert.strictEqual(stoneOnGold.drops, false);
});

test('breakTime: 品类不匹配 = 无加成无惩罚 — 斧头砍石头 7.5s 不掉, 镐挖泥土 0.9s 仍掉(D1)', () => {
  const {breakTime, mkStack} = loadCraft();
  const axeOnStone = breakTime(stone, mkStack('axe_diamond'));
  assert.strictEqual(axeOnStone.time, 7.5, '非镐挖石: 速度 1 + 采集失败 → 1.5×5');
  assert.strictEqual(axeOnStone.drops, false, '石头只认镐');
  const pickOnDirt = breakTime(dirt, mkStack('pick_diamond'));
  assert.strictEqual(pickOnDirt.time, 0.9, '0.6 × 1.5/1(品类不符不吃速度, 无门槛不挨 ×5; 现状曾 3s)');
  assert.strictEqual(pickOnDirt.drops, true, '泥土 tier 0: 任何方式都掉');
  assert.strictEqual(breakTime(dirt, null).time, 0.9, '徒手挖泥土同 0.9s(MC 口径)');
  assert.strictEqual(breakTime(dirt, null).drops, true);
});

test('breakTime: 开局链回 MC 口径(D1 偏差 B) — 徒手原木 3s/工作台 3.75s, 木斧原木 1.5s', () => {
  const {breakTime, mkStack} = loadCraft();
  const log = {name: '原木', hard: 2.0, tool: 'axe', tier: 0, drop: [['log', 1, 0]]};
  const table = {name: '工作台', hard: 2.5, tool: 'axe', tier: 0, drop: []};
  assert.strictEqual(breakTime(log, null).time, 3, '2.0 × 1.5(无门槛徒手不挨 ×5, 现状曾 10s 封顶 8)');
  assert.strictEqual(breakTime(log, null).drops, true, '木头徒手也掉');
  assert.strictEqual(breakTime(table, null).time, 3.75, '2.5 × 1.5(现状曾 12.5s 封顶 8)');
  assert.strictEqual(breakTime(log, mkStack('axe_wood')).time, 1.5, '品类对: 2.0 × 1.5/2');
});

test('breakTime: 无工具要求(tool:null)吃 1.5 系数且任何工具无加成 — 树叶类徒手 0.3s; hard 0 触下限 0.15s', () => {
  const {breakTime, mkStack} = loadCraft();
  const r = breakTime(leaves, null);
  assert.strictEqual(r.time, 0.3, '0.2 × 1.5/1(徒手速度视为 1)');
  assert.strictEqual(r.drops, true);
  assert.strictEqual(breakTime(tuft, null).time, 0.15, 'hard 0 → 0 触发下限');
  assert.strictEqual(breakTime(leaves, mkStack('sword_diamond')).time, 0.3,
      'tool:null 任何工具不吃速度(D1 差异 C 修正: 现状曾除以剑速度 8 → 0.15s)');
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
  vm.runInContext('globalThis.__x = { BLOCKS, breakTime, mkStack };', ctx);
  return ctx.__x;
}

test('交叉: config.js BLOCKS 实表驱动 — 石头 7.5 · 铁矿封顶 8 · 树叶 0.3 · 剪刀树叶 0.15 · TNT 0.15', () => {
  const {BLOCKS, breakTime, mkStack} = loadCraftWithConfig();
  assert.strictEqual(breakTime(BLOCKS[3], null).time, 7.5, '存量方块: 石头(3)');
  assert.strictEqual(breakTime(BLOCKS[37], null).time, 8, '新方块: 铁矿 B_IRON_ORE(37) 封顶');
  assert.strictEqual(breakTime(BLOCKS[37], null).drops, false);
  assert.strictEqual(breakTime(BLOCKS[7], null).time, 0.3, '树叶(7) 徒手无加成 0.3s');
  assert.strictEqual(breakTime(BLOCKS[7], mkStack('shears')).time, 0.15, '剪刀品类匹配: 0.2×1.5/5 触下限(D2)');
  assert.strictEqual(breakTime(BLOCKS[7], mkStack('sword_diamond')).time, 0.3, '非剪刀持树叶不吃速度');
  assert.strictEqual(breakTime(BLOCKS[1], null).drops, true, '草地(1) tier 0 徒手掉泥土');
  assert.strictEqual(breakTime(BLOCKS[18], mkStack('sword_diamond')).time, 0.45, '玻璃 tool:null: 任何工具 0.45s');
  assert.strictEqual(breakTime(BLOCKS[20], null).time, 0.15, 'TNT hard 0 可挖走回收(D3)');
  assert.strictEqual(breakTime(BLOCKS[20], null).drops, true, 'TNT 掉自身');
});

/* ============ 下界传送门(下界并入探险设计稿 §3.1/D3/D5): 配方压轴 + 声明式不可破坏 ============ */

test('下界传送门配方: RECIPES 最末压轴 — station table · shapeCost 派生 8 金锭+1 钻石(D3)', () => {
  const h = loadCraft();
  const {RECIPES, shapeCost} = h;
  const r = RECIPES[RECIPES.length - 1];
  assert.strictEqual(r.id, 'nether_portal', '契约 §3.1: 追加在 RECIPES 最末(配方书压轴)');
  assert.strictEqual(r.station, 'table');
  assert.deepStrictEqual({...r.out}, {item: 'nether_portal', n: 1});
  /* cost 展开回宿主 realm 再比(shapeCost 测试同款, 无候选组全为纯数值) */
  const c = {};
  for (const [k, v] of Object.entries(shapeCost(r))) c[k] = v;
  assert.deepStrictEqual(c, {gold_ingot: 8, diamond: 1}, '全表最贵: 8 金锭环形 + 中心 1 钻石');
});

/* ============ 门与玻璃板(docs/door-window-design.md §2.4): 正典配方 ============ */

test('门配方: 6 木板 2 列×3 行 → 3 扇(MC 正典 oak_door.json) — 平移可摆 · 横摆不命中', () => {
  const {RECIPES, matchGrid, shapeCost} = loadCraft();
  const r = RECIPES.find((x) => x.id === 'door');
  assert.ok(r, '门配方应存在');
  assert.strictEqual(r.station, 'table', '需 3 行 → 台级');
  assert.deepStrictEqual({...r.out}, {item: 'door', n: 3}, '一次 3 扇');
  const c = {};
  for (const [k, v] of Object.entries(shapeCost(r))) c[k] = v;
  assert.deepStrictEqual(c, {planks: 6}, '6 木板(shapeCost 从图案派生)');
  assert.strictEqual(matchGrid(cellsWith([[0, 'planks'], [3, 'planks'], [6, 'planks'],
    [1, 'planks'], [4, 'planks'], [7, 'planks']]), r), true, '左两竖列命中');
  assert.strictEqual(matchGrid(cellsWith([[1, 'planks'], [4, 'planks'], [7, 'planks'],
    [2, 'planks'], [5, 'planks'], [8, 'planks']]), r), true, '右两竖列命中(平移)');
  assert.strictEqual(matchGrid(cellsWith([[0, 'planks'], [1, 'planks'], [2, 'planks'],
    [3, 'planks'], [4, 'planks'], [5, 'planks']]), r), false, '横两行不命中(转置≠镜像)');
});

test('玻璃板配方: 6 玻璃 3 列×2 行 → 16 块(MC 正典 glass_pane.json) — 上下平移皆可', () => {
  const {RECIPES, matchGrid, shapeCost} = loadCraft();
  const r = RECIPES.find((x) => x.id === 'glass_pane');
  assert.ok(r, '玻璃板配方应存在');
  assert.strictEqual(r.station, 'table', '需 3 列 → 台级');
  assert.deepStrictEqual({...r.out}, {item: 'glass_pane', n: 16}, '一次 16 块(窗比墙省料的教学点)');
  const c = {};
  for (const [k, v] of Object.entries(shapeCost(r))) c[k] = v;
  assert.deepStrictEqual(c, {glass: 6}, '6 玻璃(烧沙→玻璃链, SMELTS 现成)');
  assert.strictEqual(matchGrid(cellsWith([[0, 'glass'], [1, 'glass'], [2, 'glass'],
    [3, 'glass'], [4, 'glass'], [5, 'glass']]), r), true, '上两横行命中');
  assert.strictEqual(matchGrid(cellsWith([[3, 'glass'], [4, 'glass'], [5, 'glass'],
    [6, 'glass'], [7, 'glass'], [8, 'glass']]), r), true, '下两横行命中(平移)');
});

test('breakTime: 无 hard = 声明式不可破坏 — time Infinity · drops false(D5, 替代旧 NaN 意外)', () => {
  const {breakTime, mkStack} = loadCraft();
  /* 纯数据对齐 config.js BLOCKS[B_OBSIDIAN] 形状(name/all, 无 hard/tool/tier/drop);
     craft-core 不依赖 config(模块头契约), 测试手写同形 */
  const obsidian = {name: '黑曜石', all: [0.10, 0.08, 0.16]};
  assert.deepStrictEqual({...breakTime(obsidian, null)}, {time: Infinity, drops: false}, '徒手: 挖不动且不掉');
  assert.strictEqual(breakTime(obsidian, mkStack('pick_diamond')).time, Infinity, '钻镐同样挖不动(声明式, 与工具无关)');
  assert.strictEqual(breakTime(obsidian, mkStack('pick_diamond')).drops, false);
  assert.strictEqual(breakTime({name: '传送门面', portal: true}, null).time, Infinity, 'hard 字段缺失同判(== null)');
  assert.strictEqual(breakTime({name: '显式空', hard: null}, null).drops, false, 'hard:null 显式声明同口径');
});

test('breakTime: 有 hard 的可挖方块行为不变(声明式改造零回归)', () => {
  const {breakTime, mkStack} = loadCraft();
  assert.strictEqual(breakTime(stone, null).time, 7.5, '石头徒手 7.5s(既有口径)');
  assert.strictEqual(breakTime(stone, null).drops, false, 'tier 1 徒手不掉');
  assert.strictEqual(breakTime(stone, mkStack('pick_wood')).time, 1.125, '木镐石头加速');
  assert.strictEqual(breakTime(dirt, null).time, 0.9, '泥土徒手 0.9s');
  assert.strictEqual(breakTime(tuft, null).time, 0.15, 'hard 0 触下限');
  assert.strictEqual(breakTime(stone, mkStack('pick_diamond')).drops, true, '钻镐石头掉圆石');
});
