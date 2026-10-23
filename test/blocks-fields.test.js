'use strict';
/* 方块注册表采集字段与怪物掉落表 (js/config.js) 单测 — node --test (零依赖)
   运行: node --test test/blocks-fields.test.js
   加载器: vm context 单独执行 config.js — 精确镜像浏览器 <script defer> 的
   共享词法环境(config.js 顶层零依赖, IS_TOUCH 的 window 探测自带 try/catch 兜底)。
   防错网: hard/tool/tier/drop 四字段是挖掘规则(craft-core.breakTime)与方块
   掉落(Drops.rollBlockDrop)的单一数据源; MOB_DROPS 是击杀掉落(Drops.rollDrops)
   的单一数据源 — 改表漏字段/抄错数值当场红。
   数值口径(独立来源, 非从实现抄回): MC 硬度原值(研究稿 §1.5/§2.3 与 Wiki) ·
   树叶/草丛概率与矿 tier 门槛(设计稿 §3.4/D5) · 掉落表结构(设计稿 §3.3)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCfg() {
  const ctx = vm.createContext({console});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8'),
      ctx, {filename: 'config.js'});
  vm.runInContext(`globalThis.__c = {
    BLOCKS, MOB_DROPS, MOB_TYPES,
    B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_GRASS_TUFT, B_FARMLAND,
    B_WHEAT_0, B_WHEAT_1, B_WHEAT_2, B_WHEAT_3, B_CRAFT, B_FURNACE, B_TORCH,
    B_SAPLING, B_CLAY, B_CHEST,
  };`, ctx);
  return ctx.__c;
}

/* 存量方块中「探险地形会出现/可采集」的 13 个(设计稿 §3.5 三分类:
   直接采集 + 合成/烧炼; TNT(20) 挖掘硬度修正 D3 起可挖走回收);
   创造专属 10/11/12/15/16/17/19 不加采集字段 */
const GATHER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 18, 20];
const CREATIVE_ONLY_IDS = [10, 11, 12, 15, 16, 17, 19];

/* ============ 新方块 id 段(附录 A) ============ */

test('新方块常量与 id 一一对应: 36~49 按附录 A, B_SAPLING 顺延 50, B_CHEST 引导链 v2 顺延 51', () => {
  const c = loadCfg();
  const expect = {B_COAL_ORE: 36, B_IRON_ORE: 37, B_GOLD_ORE: 38, B_DIAMOND_ORE: 39,
    B_GRASS_TUFT: 40, B_FARMLAND: 41, B_WHEAT_0: 42, B_WHEAT_1: 43, B_WHEAT_2: 44,
    B_WHEAT_3: 45, B_CRAFT: 46, B_FURNACE: 47, B_TORCH: 48, B_CLAY: 49, B_SAPLING: 50,
    B_CHEST: 51};
  for (const [k, id] of Object.entries(expect)) {
    assert.strictEqual(c[k], id, k + ' 应为 ' + id);
    assert.ok(c.BLOCKS[id], 'BLOCKS[' + id + '] 应有定义');
    assert.strictEqual(typeof c.BLOCKS[id].name, 'string');
  }
  /* 附录 A 里 36~49 已被 14 个编号方块占满, 树苗行 id 栏是「—」;
     存档按数字 id 记, 顺延 50/51 不与任何号段(1-19/20-29/30-35/36-49)冲突 */
});

test('薄块(thin)一律 solid:false — 草丛/麦四阶段/火把/树苗(B_FUSE 同款口径)', () => {
  const c = loadCfg();
  const thinIds = [c.B_GRASS_TUFT, c.B_WHEAT_0, c.B_WHEAT_1, c.B_WHEAT_2,
    c.B_WHEAT_3, c.B_TORCH, c.B_SAPLING];
  for (const id of thinIds) {
    const b = c.BLOCKS[id];
    assert.ok(typeof b.thin === 'number' && b.thin > 0, id + ' 应有 thin 高度');
    assert.strictEqual(b.solid, false, id + '(' + b.name + ') thin 块必须 solid:false');
  }
  /* 36~49 里的整块(四矿/耕地/工作台/熔炉/黏土)不该误标 thin */
  for (const id of [36, 37, 38, 39, 41, 46, 47, 49]) {
    assert.ok(!c.BLOCKS[id].thin, id + ' 是整块, 不应有 thin');
  }
});

/* ============ 采集字段防错网(hard/tool/tier/drop) ============ */

test('存量探险方块 13 个补齐四字段(TNT 可回收 D3); 创造专属 7 个保持无采集字段', () => {
  const c = loadCfg();
  const newIds = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50];
  for (const id of [...GATHER_IDS, ...newIds]) {
    const b = c.BLOCKS[id];
    for (const f of ['hard', 'tool', 'tier', 'drop']) {
      assert.ok(f in b, 'BLOCKS[' + id + '](' + b.name + ') 缺 ' + f);
    }
    assert.ok(typeof b.hard === 'number' && b.hard >= 0, id + ' hard 应为非负数');
    assert.ok(Number.isInteger(b.tier) && b.tier >= 0, id + ' tier 应为非负整数');
    assert.ok(Array.isArray(b.drop) && b.drop.length > 0, id + ' drop 应为非空数组');
  }
  for (const id of CREATIVE_ONLY_IDS) {
    for (const f of ['hard', 'tool', 'tier', 'drop']) {
      assert.ok(!(f in c.BLOCKS[id]), '创造专属 ' + id + ' 不该加 ' + f + '(探险不可得, 建造政策不变)');
    }
  }
});

test('hard 数值 = MC 硬度原值(徒手石头 7.5s 的口径来源, 研究稿 §1.5)', () => {
  const c = loadCfg();
  const expect = {1: 0.6, 2: 0.5, 3: 1.5, 4: 2.0, 5: 2.0, 6: 2.0, 7: 0.2, 8: 0.5,
    9: 2.0, 13: 1.5, 14: 2.0, 18: 0.3, 20: 0, /* 以上存量(20 TNT 可回收 D3, MC 硬度 0); 以下新方块 */
    36: 3.0, 37: 3.0, 38: 3.0, 39: 3.0, /* 四矿 MC 硬度 3 */
    41: 0.6, 46: 2.5, 47: 3.5, 49: 0.6, /* 耕地/工作台/熔炉/黏土 */
    40: 0, 42: 0, 43: 0, 44: 0, 45: 0, 48: 0, 50: 0}; /* 草丛/麦/火把/树苗 = 秒碎 */
  for (const [id, hard] of Object.entries(expect)) {
    assert.strictEqual(c.BLOCKS[id].hard, hard,
        'BLOCKS[' + id + '](' + c.BLOCKS[id].name + ') hard 应为 ' + hard);
  }
});

test('tool 取值只许 pick/axe/shovel/shears/null(树叶=剪刀品类 D2; 玻璃等徒手方块用 null)', () => {
  const c = loadCfg();
  const legal = ['pick', 'axe', 'shovel', 'shears', null];
  const checked = [...GATHER_IDS, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50];
  for (const id of checked) {
    assert.ok(legal.includes(c.BLOCKS[id].tool),
        'BLOCKS[' + id + '].tool 取值非法: ' + String(c.BLOCKS[id].tool));
  }
});

test('tier 门槛: 石头系需镐(tier1), 四矿煤1/铁2/金3/钻3(设计稿 D5, MC 标签口径平移)', () => {
  const c = loadCfg();
  assert.strictEqual(c.BLOCKS[3].tier, 1, '石头需木镐(徒手挖不动→教做镐)');
  assert.strictEqual(c.BLOCKS[4].tier, 1);
  assert.strictEqual(c.BLOCKS[c.B_COAL_ORE].tier, 1, '煤矿: 木镐+');
  assert.strictEqual(c.BLOCKS[c.B_IRON_ORE].tier, 2, '铁矿: 石镐+');
  assert.strictEqual(c.BLOCKS[c.B_GOLD_ORE].tier, 3, '金矿: 铁镐+');
  assert.strictEqual(c.BLOCKS[c.B_DIAMOND_ORE].tier, 3, '钻石矿: 铁镐+');
  assert.strictEqual(c.BLOCKS[1].tier, 0, '土系无镐门槛');
  assert.strictEqual(c.BLOCKS[5].tier, 0, '木头无镐门槛');
});

test('树叶 shears 品类 + shearDrop 专属表(D2: 剪树叶得树叶方块, MC 口径)', () => {
  const c = loadCfg();
  assert.strictEqual(c.BLOCKS[7].tool, 'shears', '树叶品类=剪刀(剪刀加速+专属掉落, 徒手/其它工具无加成)');
  assert.ok(Array.isArray(c.BLOCKS[7].shearDrop) && c.BLOCKS[7].shearDrop.length > 0,
      'shearDrop 应为非空数组');
  for (const e of c.BLOCKS[7].shearDrop) {
    assert.ok(Array.isArray(e) && e.length >= 2, 'shearDrop 条目形状与 drop 同形');
    assert.strictEqual(typeof e[0], 'string', '掉落物 id 应为字符串');
  }
});

test('方块级联身份旗标(设计稿 D1/D7): fell/need/fall 形状 + 地形采集方块反白名单(身份原则)', () => {
  const c = loadCfg();
  assert.strictEqual(c.BLOCKS[5].fell, true, '原木 = fell 结构成员');
  assert.strictEqual(c.BLOCKS[7].need.id, 5, '树叶依赖原木');
  assert.strictEqual(c.BLOCKS[7].need.dist, 4, 'taxicab 4(BE 口径 P4)');
  assert.strictEqual(c.BLOCKS[8].fall, true, '沙子 = fall 重力方块(二期 D7)');
  /* 地形采集方块不得携带任何级联旗标——身份即白名单: 在哪挖都不塌 */
  for (const id of [1, 2, 3, 4, 6, 9, 13, 14, 18, 36, 37, 38, 39, 41, 46, 47, 49]) {
    const b = c.BLOCKS[id];
    assert.ok(!b.fell && !b.need && !b.fall, id + '(' + b.name + ') 地形方块不得带级联旗标');
  }
});

test('drop 条目结构: [itemId 非空字符串, 保底≥0 整数, 概率 0~1 数值]', () => {
  const c = loadCfg();
  const checked = [...GATHER_IDS, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50];
  for (const id of checked) {
    for (const e of c.BLOCKS[id].drop) {
      assert.ok(Array.isArray(e), 'BLOCKS[' + id + '] drop 条目应为数组');
      assert.strictEqual(typeof e[0], 'string', 'BLOCKS[' + id + '] 掉落物 id 应为字符串');
      assert.ok(e[0].length > 0, 'BLOCKS[' + id + '] 掉落物 id 应非空');
      assert.ok(Number.isInteger(e[1]) && e[1] >= 0, 'BLOCKS[' + id + '] 保底数应为非负整数');
      assert.strictEqual(typeof e[2], 'number', 'BLOCKS[' + id + '] 概率应为数值');
      assert.ok(e[2] >= 0 && e[2] <= 1, 'BLOCKS[' + id + '] 概率应在 0~1(树叶 0.12 一类)');
    }
  }
});

test('关键掉落口径: 石掉圆石/草掉泥土/树叶三概率 12%-4%-8%/黏土掉 4 球/麦熟掉麦(设计稿 §3.4/§3.5/D7)', () => {
  const c = loadCfg();
  /* 嵌套数组来自 vm context, 用宽松 deepEqual(跨 realm 原型不同, mob-taxonomy 先例) */
  assert.deepEqual(c.BLOCKS[3].drop, [['cobble', 1, 0]], '石头掉圆石');
  assert.deepEqual(c.BLOCKS[1].drop, [['dirt', 1, 0]], '草地掉泥土(MC 口径)');
  assert.deepEqual(c.BLOCKS[7].drop,
      [['sapling', 0, 0.12], ['apple', 0, 0.04], ['stick', 0, 0.08]],
      '树叶概率掉落无保底: 树苗 12%/苹果 4%/木棍 8%(设计稿 D7, MC 儿童加倍)');
  assert.deepEqual(c.BLOCKS[c.B_CLAY].drop, [['clay_ball', 4, 0]], '黏土块掉 4 黏土球(红砖链源头)');
  assert.deepEqual(c.BLOCKS[c.B_GRASS_TUFT].drop, [['wheat_seeds', 0, 0.5]], '草丛: 无保底, 50% 掉种子');
  assert.deepEqual(c.BLOCKS[c.B_WHEAT_3].drop,
      [['wheat', 1, 0], ['wheat_seeds', 1, 0.5]], '熟麦: 小麦×1 + 种子 1-2');
  assert.deepEqual(c.BLOCKS[c.B_WHEAT_0].drop, [['wheat_seeds', 1, 0]], '未熟麦苗: 保底 1 种子');
  /* 矿物: 铁金掉矿石物品(粗矿口径需熔炼), 煤钻掉成品(设计稿 D5) */
  assert.deepEqual(c.BLOCKS[c.B_COAL_ORE].drop, [['coal', 1, 0]]);
  assert.deepEqual(c.BLOCKS[c.B_IRON_ORE].drop, [['iron_ore', 1, 0]]);
  assert.deepEqual(c.BLOCKS[c.B_GOLD_ORE].drop, [['gold_ore', 1, 0]]);
  assert.deepEqual(c.BLOCKS[c.B_DIAMOND_ORE].drop, [['diamond', 1, 0]]);
});

/* ============ 只增不改(存量键的既有字段原样) ============ */

test('只增不改: 存量方块 name 与颜色三元组保持原值', () => {
  const c = loadCfg();
  const names = {1: '草地', 2: '泥土', 3: '石头', 4: '圆石', 5: '木头', 6: '木板',
    7: '树叶', 8: '沙子', 9: '红砖', 13: '石砖', 14: '苔石', 18: '玻璃'};
  const colorKeys = ['all', 'top', 'side', 'bottom'];
  for (const [id, name] of Object.entries(names)) {
    const b = c.BLOCKS[id];
    assert.strictEqual(b.name, name, 'BLOCKS[' + id + '] name 被改动');
    for (const k of colorKeys) {
      if (!b[k]) continue;
      assert.strictEqual(b[k].length, 3, id + '.' + k + ' 应保持 RGB 三元组');
      for (const v of b[k]) assert.ok(v >= 0 && v <= 1, id + '.' + k + ' 分量应在 0~1');
    }
  }
  assert.strictEqual(c.BLOCKS[18].glass, true, '玻璃 glass 旗标保留');
  assert.strictEqual(c.BLOCKS[5].soft, true, 'soft 旗标保留(爆炸破坏口径的创意资产)');
});

/* ============ MOB_DROPS(设计稿 §3.3: 保底 1 + 50% 加成 1) ============ */

test('MOB_DROPS: 一期怪物齐全且键都是 MOB_TYPES 里的真实怪', () => {
  const c = loadCfg();
  for (const m of ['zombie', 'skeleton', 'creeper', 'spider', 'slime']) {
    assert.ok(c.MOB_DROPS[m], 'MOB_DROPS 缺 ' + m);
    assert.ok(c.MOB_TYPES[m], 'MOB_DROPS.' + m + ' 必须对应 MOB_TYPES 里的怪');
  }
});

test('MOB_DROPS 结构: rolls=[itemId,保底,加成次数], rare=[itemId,概率]; 僵尸 5% 稀有铁锭', () => {
  const c = loadCfg();
  const expectRolls = {zombie: [['rotten_flesh', 1, 1]], skeleton: [['bone', 1, 1]],
    creeper: [['gunpowder', 1, 1]], spider: [['string', 1, 1]], slime: [['slimeball', 1, 1]]};
  for (const [m, rolls] of Object.entries(expectRolls)) {
    const d = c.MOB_DROPS[m];
    assert.deepEqual(d.rolls, rolls, m + ' rolls 应为保底 1 + 50% 加成 1'); /* 宽松比较: vm 跨 realm */
    assert.ok(Array.isArray(d.rolls) && d.rolls.length > 0, m + ' rolls 非空');
  }
  for (const d of Object.values(c.MOB_DROPS)) {
    for (const e of d.rolls) {
      assert.strictEqual(typeof e[0], 'string');
      assert.ok(e[0].length > 0, '掉落物 id 应非空');
      assert.ok(Number.isInteger(e[1]) && e[1] >= 1, '保底至少 1(儿童配平: 不空手)');
      assert.ok(Number.isInteger(e[2]) && e[2] >= 0, '加成掷骰次数应为非负整数');
    }
    if (d.rare) {
      for (const e of d.rare) {
        assert.strictEqual(typeof e[0], 'string');
        assert.ok(e[0].length > 0, '稀有掉落物 id 应非空');
        assert.ok(typeof e[1] === 'number' && e[1] > 0 && e[1] <= 1, '稀有概率应在 0~1');
      }
    }
  }
  assert.deepEqual(c.MOB_DROPS.zombie.rare, [['iron_ingot', 0.05]],
      '僵尸稀有铁锭: MC 0.83% → 5%(设计稿 §3.3)');
});
