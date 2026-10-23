'use strict';
/* 物品核心 (js/items-core.js) 单测 — node --test (零依赖)
   运行: node --test test/items-core.test.js
   加载器: 同一 vm context 只执行 items-core.js — 精确镜像浏览器 <script defer>
   的共享词法环境。刻意不先加载 config.js: 物品核心按工单合同不依赖它
   (放置型 block 字段存数字, 只做号段断言; 与方块表的交叉校验归
   test/drops.test.js 的交叉断言, 见设计稿测试计划)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadItems() {
  const ctx = vm.createContext({console});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'items-core.js'), 'utf8'), ctx, {filename: 'items-core.js'});
  vm.runInContext('globalThis.__i = { ITEMS, stackMax, mkStack, isTool, toolOf };', ctx);
  return ctx.__i;
}

/* ============ 加载: 共享词法环境的顶层接口 ============ */

test('加载: 顶层暴露 ITEMS + 四个纯函数(不加载 config.js 也能独立成立)', () => {
  const h = loadItems();
  assert.strictEqual(typeof h.ITEMS, 'object');
  ['stackMax', 'mkStack', 'isTool', 'toolOf'].forEach((f) => assert.strictEqual(typeof h[f], 'function', f));
});

/* ============ 注册表防错网: 以后加物品漏字段/漏注册当场红 ============ */

test('注册表全量: 设计稿 §3.1 + §3.5 一期补给包条目全部注册(防改表漏注册)', () => {
  const {ITEMS} = loadItems();
  const required = [
    // §3.1 材料: 木材/矿物/怪物掉落/农耕(二期开放, 一期先注册)
    'log', 'planks', 'stick', 'coal', 'charcoal',
    'iron_ore', 'iron_ingot', 'gold_ore', 'gold_ingot', 'diamond',
    'gunpowder', 'bone', 'bone_meal', 'string', 'slimeball',
    'wheat', 'wheat_seeds',
    // §3.5 一期补给包: 黏土-红砖链 / 石砖链 / 剪刀 / 苔石 / 树叶
    'clay_ball', 'brick', 'bricks', 'stone_bricks', 'mossy', 'leaves', 'shears',
    // 食物
    'apple', 'bread', 'rotten_flesh',
    // 放置型方块物品与站点件
    'dirt', 'sand', 'cobble', 'stone', 'glass', 'torch', 'craft_table', 'furnace', 'tnt', 'sapling',
    // 二期占位(§3.2 配方书全表引用 bow_item, 一期卡片不点亮)
    'bow_item',
    // 工具 16 条 = 4 阶 × 镐斧剑锹(键名与手持物注册表 defs 同名, T4 直用)
    'pick_wood', 'pick_stone', 'pick_iron', 'pick_diamond',
    'axe_wood', 'axe_stone', 'axe_iron', 'axe_diamond',
    'sword_wood', 'sword_stone', 'sword_iron', 'sword_diamond',
    'shovel_wood', 'shovel_stone', 'shovel_iron', 'shovel_diamond',
  ];
  for (const id of required) assert.ok(ITEMS[id], 'ITEMS 应注册 ' + id);
});

test('条目形状: 每个物品必备 name/icon, 类别字段(block/food/fuel/tool)类型合法', () => {
  const {ITEMS} = loadItems();
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.strictEqual(typeof it.name, 'string', id + ' name');
    assert.ok(it.name.length > 0, id + ' name 非空');
    assert.strictEqual(typeof it.icon, 'string', id + ' icon');
    assert.ok(it.icon.length > 0, id + ' icon 非空(emoji 占位, 正式图标归 icons.js/T8)');
    if ('block' in it) {
      assert.ok(Number.isInteger(it.block) && it.block >= 1 && it.block <= 49,
          id + ' block 应为 1~49 整数(附录 A 新方块表上限), 实际 ' + it.block);
    }
    if ('food' in it) assert.ok(typeof it.food === 'number' && it.food > 0, id + ' food 应为正数');
    if ('fuel' in it) assert.ok(typeof it.fuel === 'number' && it.fuel > 0, id + ' fuel 应为正数');
    if ('tool' in it) {
      const t = it.tool;
      ['kind', 'tier', 'dmg', 'dur', 'speed'].forEach((k) => assert.ok(k in t, id + ' tool.' + k + ' 必备'));
      assert.strictEqual(typeof t.kind, 'string', id + ' tool.kind');
      assert.ok(Number.isInteger(t.tier) && t.tier >= 0, id + ' tool.tier 非负整数');
      ['dmg', 'dur', 'speed'].forEach((k) => assert.ok(typeof t[k] === 'number' && t[k] > 0, id + ' tool.' + k + ' 正数'));
    }
  }
});

test('放置型 block 挂点: 与方块注册表既有 id / 附录 A 规划 id 逐条一致', () => {
  const {ITEMS} = loadItems();
  const pinned = {
    log: 5, planks: 6, dirt: 2, sand: 8, cobble: 4, stone: 3, glass: 18,
    torch: 48, craft_table: 46, furnace: 47,               // 附录 A: B_TORCH/B_CRAFT/B_FURNACE
    tnt: 20,                                                // 既有 B_TNT(config.js TNT 模式)
    leaves: 7, mossy: 14, stone_bricks: 13, bricks: 9,     // 既有装饰方块的三分类归属(§3.5)
  };
  for (const [id, b] of Object.entries(pinned)) {
    assert.strictEqual(ITEMS[id] && ITEMS[id].block, b, id + ' block 应为 ' + b);
  }
  // 树苗: 附录 A 表 15 项挤 36~49 的 14 格, 设计稿未定其 id — 暂占 41(耕地/麦为二期件),
  // T2 落定终表后回改 items-core.js 该行即可; 此处只断言新区号段, 不钉死数值。
  assert.ok(ITEMS.sapling.block >= 36 && ITEMS.sapling.block <= 49, 'sapling block 应落在 36~49');
});

test('工具 16 条数值表: 4 阶 × 镐斧剑锹 与设计稿 D9 逐格一致', () => {
  const {ITEMS} = loadItems();
  const tiers = [
    ['wood', 1, 120, 2],
    ['stone', 2, 260, 4],
    ['iron', 3, 500, 6],
    ['diamond', 4, 1500, 8],
  ];
  const dmg = {pick: [3, 4, 6, 8], axe: [5, 6, 8, 10], sword: [7, 9, 11, 13], shovel: [2, 3, 4, 5]};
  for (const [mat, tier, dur, speed] of tiers) {
    for (const kind of ['pick', 'axe', 'sword', 'shovel']) {
      const id = kind + '_' + mat;
      const t = ITEMS[id] && ITEMS[id].tool;
      assert.ok(t, id + ' 应注册为工具');
      assert.strictEqual(t.kind, kind, id + ' kind');
      assert.strictEqual(t.tier, tier, id + ' tier');
      assert.strictEqual(t.dur, dur, id + ' dur(耐久 ≈ MC×2, 拍板③)');
      assert.strictEqual(t.speed, speed, id + ' speed(MC 挖掘效率)');
      assert.strictEqual(t.dmg, dmg[kind][tier - 1], id + ' dmg(hp≈原版×1.5 折算惯例)');
    }
  }
});

test('剪刀注册: §3.5 一期件(2 铁锭合成, 剪树叶得树叶方块); 数值为工程推定', () => {
  const {ITEMS} = loadItems();
  const t = ITEMS.shears && ITEMS.shears.tool;
  assert.ok(t, 'shears 应注册为工具(耐久口径 MC 238×2≈500)');
  assert.strictEqual(t.kind, 'shears');
  assert.strictEqual(t.dur, 500);
});

test('燃料热值: 煤/木炭 8 件 · 木质 1.5 件 · 木棍 0.5 件(MC 口径, 研究稿 §1.6)', () => {
  const {ITEMS} = loadItems();
  assert.strictEqual(ITEMS.coal.fuel, 8);
  assert.strictEqual(ITEMS.charcoal.fuel, 8);
  assert.strictEqual(ITEMS.log.fuel, 1.5);
  assert.strictEqual(ITEMS.planks.fuel, 1.5);
  assert.strictEqual(ITEMS.stick.fuel, 0.5);
});

test('食物回血: apple 4 / bread 8 / rotten_flesh 2(设计稿 §3.1, 儿童版无饥饿debuff)', () => {
  const {ITEMS} = loadItems();
  assert.strictEqual(ITEMS.apple.food, 4);
  assert.strictEqual(ITEMS.bread.food, 8);
  assert.strictEqual(ITEMS.rotten_flesh.food, 2);
});

test('名字抽查: TTS 播报与任务链引用的键名/中文名稳定', () => {
  const {ITEMS} = loadItems();
  assert.strictEqual(ITEMS.pick_wood.name, '木镐');
  assert.strictEqual(ITEMS.sword_diamond.name, '钻石剑');
  assert.strictEqual(ITEMS.axe_stone.name, '石斧');
  assert.strictEqual(ITEMS.shovel_iron.name, '铁锹');
  assert.strictEqual(ITEMS.craft_table.name, '工作台');
  assert.strictEqual(ITEMS.diamond.name, '钻石');
});

/* ============ 纯函数行为: 堆叠与工具判定 ============ */

test('stackMax: 材料 64 · 工具 1 · 未注册 0(=拒收, 入包门禁供背包核心)', () => {
  const {stackMax} = loadItems();
  assert.strictEqual(stackMax('log'), 64);
  assert.strictEqual(stackMax('coal'), 64);
  assert.strictEqual(stackMax('apple'), 64);
  assert.strictEqual(stackMax('pick_wood'), 1);
  assert.strictEqual(stackMax('sword_diamond'), 1);
  assert.strictEqual(stackMax('shears'), 1);
  assert.strictEqual(stackMax('not_registered'), 0);
});

test('mkStack: 默认 1 个 · 超上限钳到上限 · 工具附带满耐久 dur(槽形状 {id,n,dur}, D10)', () => {
  const {mkStack} = loadItems();
  /* 展开回裹: 对象来自 vm context, deepStrictEqual 会因跨 realm 原型不同而误判
     (focus-paradigms.test.js 先例); 展开同时验证材料堆不带 dur 字段 */
  assert.deepStrictEqual({...mkStack('coal')}, {id: 'coal', n: 1});
  assert.deepStrictEqual({...mkStack('coal', 10)}, {id: 'coal', n: 10});
  assert.deepStrictEqual({...mkStack('coal', 999)}, {id: 'coal', n: 64});
  assert.deepStrictEqual({...mkStack('pick_wood')}, {id: 'pick_wood', n: 1, dur: 120});
  assert.deepStrictEqual({...mkStack('pick_diamond', 5)}, {id: 'pick_diamond', n: 1, dur: 1500});
  assert.strictEqual(mkStack('not_registered', 3), null, '未注册物品拒收');
});

test('isTool/toolOf: 带 tool 字段即工具, 非工具与未注册返回假/空', () => {
  const {isTool, toolOf} = loadItems();
  assert.strictEqual(isTool('pick_stone'), true);
  assert.strictEqual(isTool('axe_wood'), true);
  assert.strictEqual(isTool('shears'), true);
  assert.strictEqual(isTool('log'), false);
  assert.strictEqual(isTool('apple'), false);
  assert.strictEqual(isTool('not_registered'), false);
  assert.deepStrictEqual({...toolOf('pick_stone')}, {kind: 'pick', tier: 2, dmg: 4, dur: 260, speed: 4});
  assert.strictEqual(toolOf('log'), null);
  assert.strictEqual(toolOf('not_registered'), null);
});
