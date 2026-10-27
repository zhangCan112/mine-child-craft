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
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'items-core.js'), 'utf8'),
      ctx, {filename: 'items-core.js'});
  vm.runInContext('globalThis.__i = { ITEMS, stackMax, mkStack, isTool, toolOf, durOf };', ctx);
  return ctx.__i;
}

/* ============ 加载: 共享词法环境的顶层接口 ============ */

test('加载: 顶层暴露 ITEMS + 五个纯函数(不加载 config.js 也能独立成立)', () => {
  const h = loadItems();
  assert.strictEqual(typeof h.ITEMS, 'object');
  ['stackMax', 'mkStack', 'isTool', 'toolOf', 'durOf'].forEach((f) => assert.strictEqual(typeof h[f], 'function', f));
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
    'clay_ball', 'brick', 'bricks', 'stone_bricks', 'mossy_cobble', 'leaves', 'shears',
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
      assert.ok(Number.isInteger(it.block) && it.block >= 1 && it.block <= 62,
          id + ' block 应为 1~62 整数(生态地图 B_FLOWER_W=62 顺延号段), 实际 ' + it.block);
    }
    if ('food' in it) assert.ok(typeof it.food === 'number' && it.food > 0, id + ' food 应为正数');
    if ('fuel' in it) assert.ok(typeof it.fuel === 'number' && it.fuel > 0, id + ' fuel 应为正数');
    if ('dur' in it) {
      assert.ok(Number.isInteger(it.dur) && it.dur > 0,
          id + ' dur 应为正整数(可耗损物满耐久, 昼夜 D7 灯笼口径)');
    }
    if ('tool' in it) {
      const t = it.tool;
      ['kind', 'tier', 'dmg', 'dur', 'speed'].forEach((k) => assert.ok(k in t, id + ' tool.' + k + ' 必备'));
      assert.strictEqual(typeof t.kind, 'string', id + ' tool.kind');
      assert.ok(Number.isInteger(t.tier) && t.tier >= 0, id + ' tool.tier 非负整数');
      ['dmg', 'dur', 'speed'].forEach((k) =>
        assert.ok(typeof t[k] === 'number' && t[k] > 0, id + ' tool.' + k + ' 正数'));
    }
  }
});

test('放置型 block 挂点: 与方块注册表既有 id / 附录 A 规划 id 逐条一致', () => {
  const {ITEMS} = loadItems();
  const pinned = {
    log: 5, planks: 6, dirt: 2, sand: 8, cobble: 4, stone: 3, glass: 18,
    torch: 48, craft_table: 46, furnace: 47, // 附录 A: B_TORCH/B_CRAFT/B_FURNACE
    tnt: 20, // 既有 B_TNT(config.js TNT 模式)
    leaves: 7, mossy_cobble: 14, stone_bricks: 13, bricks: 9, // 既有装饰方块的三分类归属(§3.5)
  };
  for (const [id, b] of Object.entries(pinned)) {
    assert.strictEqual(ITEMS[id] && ITEMS[id].block, b, id + ' block 应为 ' + b);
  }
  // 树苗: B_SAPLING=50(T2 落定, 号段 36~50 顺延)
  assert.strictEqual(ITEMS.sapling.block, 50, 'sapling block 应为 B_SAPLING=50');
  // 床(昼夜 D6 §7.1): B_BED=53 放置型 — 睡觉跳夜+设床边出生点(政策在模式层)
  assert.strictEqual(ITEMS.bed.name, '床');
  assert.strictEqual(ITEMS.bed.block, 53, 'bed block 应为 B_BED=53');
  // 生态地图(设计稿 §6): 雪原/沙漠/沼泽放置型 — 雪球是投掷物纯材料(无 block, T9 接线)
  const ecoBlocks = {snow: 54, ice: 56, cactus: 57, sandstone: 58,
    orchid: 60, flower_y: 61, flower_w: 62};
  for (const [id, b] of Object.entries(ecoBlocks)) {
    assert.strictEqual(ITEMS[id] && ITEMS[id].block, b, id + ' block 应为 ' + b);
  }
});

test('生态地图 8 件(设计稿 §6): 名字逐条 · 雪球纯材料无 block · 全员可堆叠 64', () => {
  const {ITEMS, stackMax} = loadItems();
  const names = {snow: '雪块', snowball: '雪球', ice: '冰', cactus: '仙人掌',
    sandstone: '砂岩', orchid: '兰花', flower_y: '蒲公英', flower_w: '雏菊'};
  for (const [id, name] of Object.entries(names)) {
    assert.ok(ITEMS[id], id + ' 应注册(生态地图 T1)');
    assert.strictEqual(ITEMS[id].name, name, id + ' 中文名');
    assert.ok(!ITEMS[id].tool && !ITEMS[id].food, id + ' 纯放置/材料条目');
    assert.strictEqual(stackMax(id), 64, id + ' 可堆叠 64');
  }
  assert.ok(ITEMS.snowball.block == null, '雪球无 block(投掷物, 右键掷出归 T9 壳接线)');
  assert.strictEqual(ITEMS.ice.block, 56, '冰放置型(B_ICE 不入图集但物品照常入包)');
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

test('F3 金苹果: 形状 — food 名义值 30=maxHp 锚点 · full 旗标=吃了回满血(二期设计稿 §3)', () => {
  const {ITEMS, stackMax} = loadItems();
  const it = ITEMS.golden_apple;
  assert.ok(it, 'golden_apple 应注册(加物品=加一行纯数据)');
  assert.strictEqual(it.name, '金苹果');
  assert.strictEqual(typeof it.icon, 'string');
  assert.ok(it.icon.length > 0, 'icon 非空(emoji 占位)');
  assert.ok(it.food > 0, 'food 应为正数(既有形状守门同口径)');
  assert.strictEqual(it.food, 30, 'food 名义值 30(玩家 maxHp 锚点)');
  assert.strictEqual(it.full, true, 'full 旗标: 吃了直接回满(无饥饿系统的一次性折算)');
  assert.ok(!it.tool && it.block == null, '非工具非放置型: 纯食物条目');
  assert.strictEqual(stackMax('golden_apple'), 64, '可堆叠 64(材料档)');
});

test('F4 农场链 11 件: 名/food 数值表逐条 · 熟肉 6~8 档 · wool block=52(二期设计稿 §4.6)', () => {
  const {ITEMS, stackMax} = loadItems();
  /* 生熟肉 food 数值表逐条(镜像 MC 饥饿值, 研究稿 §5; 熟肉落在「比生肉好得多」档) */
  const foods = {
    raw_beef: ['生牛肉', 3], cooked_beef: ['牛排', 8],
    raw_porkchop: ['生猪排', 3], cooked_porkchop: ['熟猪排', 8],
    raw_chicken: ['生鸡肉', 2], cooked_chicken: ['熟鸡肉', 6],
    raw_mutton: ['生羊肉', 2], cooked_mutton: ['熟羊肉', 6],
  };
  for (const [id, [name, food]] of Object.entries(foods)) {
    const it = ITEMS[id];
    assert.ok(it, id + ' 应注册(F4 农场链)');
    assert.strictEqual(it.name, name, id + ' 中文名照设计稿 §4.6');
    assert.strictEqual(it.food, food, id + ' food=' + food);
    assert.ok(!it.full && !it.tool && it.block == null, id + ' 纯食物条目(普通口径, 不碰 full 政策)');
    assert.strictEqual(stackMax(id), 64, id + ' 可堆叠 64');
  }
  /* 收集品两件: 无 food 无 block(三期出口的占位材料) */
  assert.strictEqual(ITEMS.leather.name, '皮革');
  assert.strictEqual(ITEMS.feather.name, '羽毛');
  assert.ok(ITEMS.leather.food == null && ITEMS.leather.block == null && !ITEMS.leather.tool, '皮革纯材料');
  assert.ok(ITEMS.feather.food == null && ITEMS.feather.block == null && !ITEMS.feather.tool, '羽毛纯材料');
  /* 羊毛: 放置型 block=52(B_WOOL, F4 §4.7 羊掉毛转入采集) */
  assert.strictEqual(ITEMS.wool.name, '羊毛');
  assert.strictEqual(ITEMS.wool.block, 52, 'wool block 应为 B_WOOL=52');
});

test('昼夜 D7 灯笼: dur=300 可耗损物 — stackMax 1 不可堆叠 · mkStack 自带满耐久 · isTool 语义不动(设计稿 §8.1)', () => {
  const {ITEMS, stackMax, mkStack, isTool, durOf} = loadItems();
  const it = ITEMS.lantern;
  assert.ok(it, 'lantern 应注册(原创手持光源, 拍板⑤)');
  assert.strictEqual(it.name, '灯笼');
  assert.strictEqual(it.dur, 300, '耐久 300 秒 ≈ 5 分钟(一夜 8 分 20 秒, 省着用撑大半夜)');
  assert.ok(it.block == null && !it.tool, '非放置型非工具: 不挖不砍, 无工具五元组(§8.1)');
  assert.strictEqual(typeof it.icon, 'string', 'icon emoji 占位(像素图标归 icons.js)');
  assert.strictEqual(stackMax('lantern'), 1, '可耗损物不可堆叠(工具同款管线)');
  assert.deepStrictEqual({...mkStack('lantern')}, {id: 'lantern', n: 1, dur: 300}, '产栈自带满耐久');
  assert.deepStrictEqual({...mkStack('lantern', 9)}, {id: 'lantern', n: 1, dur: 300}, 'n 钳到上限 1');
  assert.strictEqual(isTool('lantern'), false, 'isTool 语义不动: 灯笼不是工具');
  /* durOf: 可耗损物满耐久查询的单一权威(工具取 tool.dur · 耗损物取 dur · 其余 0) */
  assert.strictEqual(durOf('lantern'), 300);
  assert.strictEqual(durOf('pick_wood'), 120, '工具取 tool.dur');
  assert.strictEqual(durOf('shears'), 500, '剪刀同口径');
  assert.strictEqual(durOf('log'), 0, '普通材料 0');
  assert.strictEqual(durOf('not_registered'), 0);
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
