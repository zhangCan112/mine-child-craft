'use strict';
/* 方块注册表采集字段 (js/config.js) 单测 — node --test (零依赖)
   运行: node --test test/blocks-fields.test.js
   加载器: vm context 单独执行 config.js — 精确镜像浏览器 <script defer> 的
   共享词法环境(config.js 顶层零依赖, IS_TOUCH 的 window 探测自带 try/catch 兜底)。
   防错网: hard/tool/tier/drop 四字段是挖掘规则(craft-core.breakTime)与方块
   掉落(Drops.rollBlockDrop)的单一数据源 — 改表漏字段/抄错数值当场红。
   (怪物掉落表 MOB_DROPS 段已随 mob-registry.js 拆分随迁 test/mob-registry.test.js,
   2026-10 候选 8 — 本文件只剩方块段。)
   数值口径(独立来源, 非从实现抄回): MC 硬度原值(研究稿 §1.5/§2.3 与 Wiki) ·
   树叶/草丛概率与矿 tier 门槛(设计稿 §3.4/D5) · 方块掉落结构(设计稿 §3.3) ·
   光源等级(昼夜设计稿 §5.1: 火把 14 半径 13 菱形 · 灯块/发光岩/岩浆 15,
   MC 数值依据 mc-daylight-torch-research TL;DR #7)。 */
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
    BLOCKS,
    B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_GRASS_TUFT, B_FARMLAND,
    B_WHEAT_0, B_WHEAT_1, B_WHEAT_2, B_WHEAT_3, B_CRAFT, B_FURNACE, B_TORCH,
    B_SAPLING, B_CLAY, B_CHEST, B_WOOL, B_BED, B_BED_FOOT,
    B_SNOW, B_SNOWY_GRASS, B_ICE, B_CACTUS, B_SANDSTONE,
    B_DEAD_BUSH, B_ORCHID, B_FLOWER_Y, B_FLOWER_W,
    B_LAVA, B_GLOWSTONE, B_PORTAL, B_PORTAL_DIM,
    B_DOOR, B_DOOR_TOP, B_DOOR_OPEN, B_DOOR_TOP_OPEN, B_GLASS_PANE,
    B_SPAWNER, B_LOOT_CHEST,
  };`, ctx);
  return ctx.__c;
}

/* 存量方块中「探险地形会出现/可采集」的 13 个(设计稿 §3.5 三分类:
   直接采集 + 合成/烧炼; TNT(20) 挖掘硬度修正 D3 起可挖走回收);
   创造专属 10/11/12/15/16/17/19 不加采集字段 */
const GATHER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 18, 20];
const CREATIVE_ONLY_IDS = [10, 11, 12, 15, 16, 17, 19];

/* ============ 新方块 id 段(附录 A) ============ */

test('新方块常量与 id 一一对应: 36~49 按附录 A, B_SAPLING 顺延 50, B_CHEST 引导链 v2 顺延 51, B_WOOL F4 顺延 52, B_BED 昼夜 D6 顺延 53', () => {
  const c = loadCfg();
  const expect = {B_COAL_ORE: 36, B_IRON_ORE: 37, B_GOLD_ORE: 38, B_DIAMOND_ORE: 39,
    B_GRASS_TUFT: 40, B_FARMLAND: 41, B_WHEAT_0: 42, B_WHEAT_1: 43, B_WHEAT_2: 44,
    B_WHEAT_3: 45, B_CRAFT: 46, B_FURNACE: 47, B_TORCH: 48, B_CLAY: 49, B_SAPLING: 50,
    B_CHEST: 51, B_WOOL: 52, B_BED: 53};
  for (const [k, id] of Object.entries(expect)) {
    assert.strictEqual(c[k], id, k + ' 应为 ' + id);
    assert.ok(c.BLOCKS[id], 'BLOCKS[' + id + '] 应有定义');
    assert.strictEqual(typeof c.BLOCKS[id].name, 'string');
  }
  /* 附录 A 里 36~49 已被 14 个编号方块占满, 树苗行 id 栏是「—」;
     存档按数字 id 记, 顺延 50/51/52/53 不与任何号段(1-19/20-29/30-35/36-49)冲突 */
});

/* ============ 两格床 id 段(69, 2026-10-29 两格床改版: 床头 53 + 床尾 69 成对) ============ */

test('两格床常量与 id 一一对应: B_BED_FOOT 顺延 69(门段 64~68 后); 床尾无 drop 防双掉(门 B_DOOR_TOP 同款)', () => {
  const c = loadCfg();
  assert.strictEqual(c.B_BED_FOOT, 69, 'B_BED_FOOT 应为 69');
  assert.ok(c.BLOCKS[69], 'BLOCKS[69] 应有定义');
  assert.strictEqual(c.BLOCKS[69].name, '床尾');
  assert.strictEqual(c.BLOCKS[69].thin, 0.55, '床尾=半高薄块(与床头同形)');
  assert.strictEqual(c.BLOCKS[69].solid, false, '床尾不挡人(床头同款)');
  assert.strictEqual(c.BLOCKS[69].bed, true, '床尾带 bed 身份旗标(mesh/held 路由)');
  assert.strictEqual(c.BLOCKS[69].drop, undefined, '床尾无 drop(挖床尾由 advBedBreakPlan 补发 1 张, 防双掉)');
  assert.strictEqual(c.BLOCKS[c.B_BED].bedHead, true, '床头带 bedHead 旗标(mesh 枕向旋转扫描)');
});

/* ============ 生态地图新方块 id 段(54~62, 冒险模式生态地图设计稿 §6) ============ */

test('生态地图常量与 id 一一对应: 54~62 顺延(雪原/沙漠/沼泽三图资源)', () => {
  const c = loadCfg();
  const expect = {B_SNOW: 54, B_SNOWY_GRASS: 55, B_ICE: 56, B_CACTUS: 57,
    B_SANDSTONE: 58, B_DEAD_BUSH: 59, B_ORCHID: 60, B_FLOWER_Y: 61, B_FLOWER_W: 62};
  for (const [k, id] of Object.entries(expect)) {
    assert.strictEqual(c[k], id, k + ' 应为 ' + id);
    assert.ok(c.BLOCKS[id], 'BLOCKS[' + id + '] 应有定义');
    assert.strictEqual(typeof c.BLOCKS[id].name, 'string');
  }
});

/* ============ 门与玻璃板 id 段(64~68, docs/door-window-design.md §2) ============ */

test('门/玻璃板常量与 id 一一对应: 64~68 顺延(63 已被熄门 B_PORTAL_DIM 先占); 号段红线外推 — BLOCKS 不占 72+(69=床尾 · 70=巢穴之心 · 71=战利品宝箱)', () => {
  const c = loadCfg();
  const expect = {B_DOOR: 64, B_DOOR_TOP: 65, B_DOOR_OPEN: 66, B_DOOR_TOP_OPEN: 67, B_GLASS_PANE: 68};
  for (const [k, id] of Object.entries(expect)) {
    assert.strictEqual(c[k], id, k + ' 应为 ' + id);
    assert.ok(c.BLOCKS[id], 'BLOCKS[' + id + '] 应有定义');
    assert.strictEqual(typeof c.BLOCKS[id].name, 'string');
  }
  /* 红线: 存档按数字 id 记, 72+ 是后续号段预留
     (69=两格床改版床尾 B_BED_FOOT 2026-10-29 · 70=怪物巢穴之心 B_SPAWNER, den-nest D9 ·
     71=战利品宝箱 B_LOOT_CHEST, den-nest §7.5 D16) */
  assert.strictEqual(c.B_SPAWNER, 70, '巢穴之心占 70(den-nest-design 号段顺延)');
  assert.strictEqual(c.B_LOOT_CHEST, 71, '战利品宝箱占 71(den-nest §7.5 号段顺延)');
  assert.ok(c.BLOCKS[70] && c.BLOCKS[71], 'BLOCKS[70]/[71] 应有定义');
  for (const id of Object.keys(c.BLOCKS)) {
    assert.ok(Number(id) <= 71, 'BLOCKS 出现 72+ 方块 id: ' + id + '(号段红线)');
  }
});

test('门四态字段(设计稿 §2.2): 全带 pane 旗标 · 关门实心/开门 solid:false · 下半有 drop 上半无(防双掉) · 硬度 3 斧头(MC 同值)', () => {
  const c = loadCfg();
  const d = c.BLOCKS[c.B_DOOR]; const dt = c.BLOCKS[c.B_DOOR_TOP];
  const o = c.BLOCKS[c.B_DOOR_OPEN]; const ot = c.BLOCKS[c.B_DOOR_TOP_OPEN];
  for (const b of [d, dt, o, ot]) {
    assert.strictEqual(b.pane, true, b.name + ' 应带 pane 竖直薄板旗标(mesh 路由)');
    assert.ok(!b.thin, b.name + ' 不得挂 thin(thin=贴地板渲染+级联失撑误判, 设计稿 §2.2)');
    assert.strictEqual(b.hard, 3.0, b.name + ' MC 硬度 3');
    assert.strictEqual(b.tool, 'axe', b.name + ' 斧头加速(MC 口径)');
  }
  assert.strictEqual(d.solid, undefined, '关门(下)实心: 挡人挡光挡怪');
  assert.strictEqual(dt.solid, undefined, '关门(上)实心');
  assert.strictEqual(o.solid, false, '开门(下)可穿行, 非 solid 即透光');
  assert.strictEqual(ot.solid, false, '开门(上)可穿行');
  assert.deepStrictEqual([...d.drop[0]].slice(0, 2), ['door', 1], '下半掉门 ×1');
  assert.strictEqual(o.drop[0][0], 'door', '开门态挖掉同样掉门');
  assert.ok(!dt.drop && !ot.drop, '上半无 drop: 整扇回收走配对政策, 防双掉');
});

test('玻璃板字段(设计稿 §2.2): pane 旗标 + glass 透光 + 硬度 0.3 徒手 + 掉自身(零惩罚)', () => {
  const c = loadCfg();
  const p = c.BLOCKS[c.B_GLASS_PANE];
  assert.strictEqual(p.pane, true, 'pane 竖直薄板旗标(mesh 路由)');
  assert.strictEqual(p.glass, true, 'glass 旗标 = LightCore 透光(窗户采光)');
  assert.ok(!p.thin, '不得挂 thin(浮空恰是 MC 口径, 设计稿 §2.2)');
  assert.strictEqual(p.hard, 0.3, 'MC 硬度 0.3');
  assert.strictEqual(p.tool, null, '无指定工具, 徒手同速');
  assert.strictEqual(p.drop[0][0], 'glass_pane', '掉自身(零惩罚哲学, 玻璃块同款; 偏离 MC 无精准采集不掉, 拍板②)');
});

test('熄灭门面 B_PORTAL_DIM=63: 门族形状 — glass 透渲/solid:false 可穿/无 portal 旗标(不可触发)/无 hard(声明式不可破坏)/色暗于亮门面', () => {
  const c = loadCfg();
  assert.strictEqual(c.B_PORTAL_DIM, 63, 'id 63(生态段后首位, 号段登记见上题红线)');
  const b = c.BLOCKS[63];
  assert.strictEqual(b.name, '熄灭门面');
  assert.strictEqual(b.glass, true, '与门面同走 glass 透渲通道');
  assert.strictEqual(b.solid, false, '可穿入(与 B_PORTAL 同口径)');
  assert.ok(!b.portal, '无 portal 旗标——advInPortal 认 B_PORTAL id, 熄门天然不可触发');
  assert.ok(!('hard' in b), '无 hard = 声明式不可破坏(门框同款, 挖不动给儿童话术)');
  const lit = c.BLOCKS[c.B_PORTAL];
  assert.ok(b.all[0] < lit.all[0] && b.all[2] < lit.all[2],
      '暗紫微光: 色值显著暗于亮门面(读得出「是门只是没开」)');
});

test('生态地图薄块: 枯灌木/三花 thin 十字片一律 solid:false; 雪块/雪覆草/冰/仙人掌/砂岩是整块', () => {
  const c = loadCfg();
  for (const k of ['B_DEAD_BUSH', 'B_ORCHID', 'B_FLOWER_Y', 'B_FLOWER_W']) {
    const b = c.BLOCKS[c[k]];
    assert.ok(typeof b.thin === 'number' && b.thin > 0, c[k] + ' 应有 thin 高度');
    assert.strictEqual(b.solid, false, c[k] + '(' + b.name + ') thin 块必须 solid:false');
  }
  for (const k of ['B_SNOW', 'B_SNOWY_GRASS', 'B_ICE', 'B_CACTUS', 'B_SANDSTONE']) {
    assert.ok(!c.BLOCKS[c[k]].thin, c[k] + ' 是整块, 不应有 thin');
  }
  assert.strictEqual(c.BLOCKS[c.B_ICE].glass, true, '冰 glass 透光透渲(与玻璃同通道, 不入图集)');
});


test('薄块(thin)一律 solid:false — 草丛/麦四阶段/火把/树苗/床(床头+床尾)/B_FUSE 同款口径', () => {
  const c = loadCfg();
  const thinIds = [c.B_GRASS_TUFT, c.B_WHEAT_0, c.B_WHEAT_1, c.B_WHEAT_2,
    c.B_WHEAT_3, c.B_TORCH, c.B_SAPLING, c.B_BED, c.B_BED_FOOT];
  for (const id of thinIds) {
    const b = c.BLOCKS[id];
    assert.ok(typeof b.thin === 'number' && b.thin > 0, id + ' 应有 thin 高度');
    assert.strictEqual(b.solid, false, id + '(' + b.name + ') thin 块必须 solid:false');
  }
  /* 36~49 里的整块(四矿/耕地/工作台/熔炉/黏土)不该误标 thin; F4 羊毛(52)同为整块 */
  for (const id of [36, 37, 38, 39, 41, 46, 47, 49, 52]) {
    assert.ok(!c.BLOCKS[id].thin, id + ' 是整块, 不应有 thin');
  }
});

test('replaceable 放置覆盖旗标(用户拍板 2026-10-28): 花草火把族七件; 麦/床/引线不带(庄稼家具防误盖)', () => {
  const c = loadCfg();
  const repIds = [c.B_GRASS_TUFT, c.B_TORCH, c.B_SAPLING,
    c.B_DEAD_BUSH, c.B_ORCHID, c.B_FLOWER_Y, c.B_FLOWER_W];
  for (const id of repIds) {
    assert.strictEqual(c.BLOCKS[id].replaceable, true,
        c.BLOCKS[id].name + ' 应带 replaceable(命中放置=覆盖)');
  }
  /* 反白名单: 其余方块带 replaceable 即手滑——麦是庄稼、床/引线是家具电路,
     静默无掉落地盖掉都有损(改动即有意) */
  for (const [id, b] of Object.entries(c.BLOCKS)) {
    if (repIds.includes(Number(id))) continue;
    assert.ok(!b.replaceable, id + '(' + b.name + ') 不在覆盖白名单, 不应带 replaceable');
  }
});

/* ============ 采集字段防错网(hard/tool/tier/drop) ============ */

test('存量探险方块 13 个补齐四字段(TNT 可回收 D3); 创造专属 7 个保持无采集字段', () => {
  const c = loadCfg();
  const newIds = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 52, 53,
    54, 55, 56, 57, 58, 59, 60, 61, 62];
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
    40: 0, 42: 0, 43: 0, 44: 0, 45: 0, 48: 0, 50: 0, /* 草丛/麦/火把/树苗 = 秒碎 */
    52: 0.8, /* F4 羊毛(MC 硬度 0.8, 二期设计稿 §4.7) */
    53: 0, /* 床(昼夜 D6 §7.1: hard 0 徒手秒碎回收, MC 硬度 0.2 观感等价) */
    54: 0.2, 55: 0.6, 56: 0.5, 57: 0.4, 58: 0.8, /* 生态地图: 雪块/雪覆草/冰/仙人掌/砂岩 = MC 硬度原值 */
    59: 0, 60: 0, 61: 0, 62: 0}; /* 枯灌木/三花 = 秒碎 */
  for (const [id, hard] of Object.entries(expect)) {
    assert.strictEqual(c.BLOCKS[id].hard, hard,
        'BLOCKS[' + id + '](' + c.BLOCKS[id].name + ') hard 应为 ' + hard);
  }
});

test('tool 取值只许 pick/axe/shovel/shears/null(树叶=剪刀品类 D2; 玻璃等徒手方块用 null)', () => {
  const c = loadCfg();
  const legal = ['pick', 'axe', 'shovel', 'shears', null];
  const checked = [...GATHER_IDS, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 52, 53,
    54, 55, 56, 57, 58, 59, 60, 61, 62];
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
  /* 地形采集方块不得携带任何级联旗标——身份即白名单: 在哪挖都不塌
     (生态地图整块 54~58 同口径: 雪块/雪覆草/冰/仙人掌/砂岩都是地形采集件) */
  for (const id of [1, 2, 3, 4, 6, 9, 13, 14, 18, 36, 37, 38, 39, 41, 46, 47, 49,
    54, 55, 56, 57, 58]) {
    const b = c.BLOCKS[id];
    assert.ok(!b.fell && !b.need && !b.fall, id + '(' + b.name + ') 地形方块不得带级联旗标');
  }
});

test('drop 条目结构: [itemId 非空字符串, 保底≥0 整数, 概率 0~1 数值]', () => {
  const c = loadCfg();
  const checked = [...GATHER_IDS, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 52, 53,
    54, 55, 56, 57, 58, 59, 60, 61, 62];
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
  /* 嵌套数组来自 vm context, 用宽松 deepEqual(跨 realm 原型不同, mob-registry 先例) */
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
  /* F4 羊毛: 徒手可挖掉自身(零惩罚, tier 0; 二期设计稿 §4.7) */
  assert.deepEqual(c.BLOCKS[c.B_WOOL].drop, [['wool', 1, 0]], '羊毛掉自身');
  assert.strictEqual(c.BLOCKS[c.B_WOOL].tool, null, '羊毛无品类(徒手同速)');
  assert.strictEqual(c.BLOCKS[c.B_WOOL].tier, 0, '羊毛无镐门槛');
  /* 床(昼夜 D6 §7.1): 徒手秒碎掉自身(回收再放置), thin 旗标白送顶面限定+失撑脱落 */
  assert.deepEqual(c.BLOCKS[c.B_BED].drop, [['bed', 1, 0]], '床掉自身(整床回收)');
  assert.strictEqual(c.BLOCKS[c.B_BED].tool, null, '床无品类(徒手同速)');
  assert.strictEqual(c.BLOCKS[c.B_BED].tier, 0, '床无门槛');
  assert.strictEqual(c.BLOCKS[c.B_BED].thin, 0.55, '床=半高薄块 0.55(差异 #1: 1 格简化)');
  /* 生态地图(设计稿 §6): 雪块掉 4 雪球(黏土 4 球同款, 雪仗弹药归 T9) · 雪覆草掉泥土(MC 口径)
     冰/仙人掌/砂岩/三花掉自身(零惩罚哲学, 玻璃同款) · 枯灌木掉木棍 1~2(MC 0~2 → 儿童保底 1) */
  assert.deepEqual(c.BLOCKS[c.B_SNOW].drop, [['snowball', 4, 0]], '雪块挖掉得 4 雪球');
  assert.strictEqual(c.BLOCKS[c.B_SNOW].tool, 'shovel', '雪块铲系');
  assert.deepEqual(c.BLOCKS[c.B_SNOWY_GRASS].drop, [['dirt', 1, 0]], '雪覆草掉泥土(草地同款)');
  assert.deepEqual(c.BLOCKS[c.B_ICE].drop, [['ice', 1, 0]], '冰掉自身(MC 掉无 → 零惩罚哲学)');
  assert.strictEqual(c.BLOCKS[c.B_ICE].tool, null, '冰无品类(徒手同速)');
  assert.deepEqual(c.BLOCKS[c.B_CACTUS].drop, [['cactus', 1, 0]], '仙人掌掉自身(儿童版无触碰伤害)');
  assert.deepEqual(c.BLOCKS[c.B_SANDSTONE].drop, [['sandstone', 1, 0]], '砂岩掉自身');
  assert.strictEqual(c.BLOCKS[c.B_SANDSTONE].tool, 'pick', '砂岩镐系');
  assert.strictEqual(c.BLOCKS[c.B_SANDSTONE].tier, 1, '砂岩需木镐+(票据 T1: pick tier1)');
  assert.deepEqual(c.BLOCKS[c.B_DEAD_BUSH].drop, [['stick', 1, 0.5]], '枯灌木: 保底 1 木棍 + 50% 再得 1');
  assert.deepEqual(c.BLOCKS[c.B_ORCHID].drop, [['orchid', 1, 0]], '兰花掉自身');
  assert.deepEqual(c.BLOCKS[c.B_FLOWER_Y].drop, [['flower_y', 1, 0]], '蒲公英掉自身');
  assert.deepEqual(c.BLOCKS[c.B_FLOWER_W].drop, [['flower_w', 1, 0]], '雏菊掉自身');
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
});

/* ============ 光源字段 light(昼夜设计稿 §5.1, D4) ============ */

test('光源方块 light 五条(昼夜设计稿 §5.1 + den-nest D9): 火把 14 · 灯块/发光岩/岩浆 15 · 巢穴之心 5; 光源面反白名单', () => {
  const c = loadCfg();
  assert.strictEqual(c.BLOCKS[c.B_TORCH].light, 14, '火把 14: 照亮半径 13 菱形(research TL;DR #7)');
  assert.strictEqual(c.BLOCKS[19].light, 15, '灯块 15: 同级光源(MC 灯笼/萤石口径)');
  assert.strictEqual(c.BLOCKS[c.B_GLOWSTONE].light, 15, '发光岩 15(MC 萤石)');
  assert.strictEqual(c.BLOCKS[c.B_LAVA].light, 15, '岩浆 15(MC 岩浆)');
  assert.strictEqual(c.BLOCKS[c.B_SPAWNER].light, 5, '巢穴之心 5: 微红光(den-nest D9 黑暗巢厅里「看得见心脏在跳」)');
  /* 反白名单: 光源清单 = 恰好这五条, 别的方块带 light 即手滑(改动即有意) */
  const litIds = [String(c.B_TORCH), '19', String(c.B_GLOWSTONE), String(c.B_LAVA), String(c.B_SPAWNER)];
  for (const [id, b] of Object.entries(c.BLOCKS)) {
    assert.ok(!b.light || litIds.includes(id),
        id + '(' + b.name + ') 不在光源表(设计稿 §5.1 + den-nest D9), 不得带 light 字段');
  }
});

test('光源四条只增不改: 火把全字段原样 · 灯块仍创造专属 · 发光岩/岩浆颜色旗标原样', () => {
  const c = loadCfg();
  /* 火把既有字段逐一钉死: thin 依附身份 + solid:false + 采集四字段 + 掉落自身 */
  const t = c.BLOCKS[c.B_TORCH];
  assert.strictEqual(t.name, '火把');
  assert.deepEqual(t.all, [1.00, 0.70, 0.25], '火把颜色不变(嵌套数组跨 realm 用宽松比较)');
  assert.strictEqual(t.thin, 0.5);
  assert.strictEqual(t.solid, false);
  assert.strictEqual(t.wall, true, 'wall 贴墙旗标(2026-10-28 贴墙票): 放置/依附/渲染共用');
  assert.strictEqual(t.hard, 0);
  assert.strictEqual(t.tool, null);
  assert.strictEqual(t.tier, 0);
  assert.deepEqual(t.drop, [['torch', 1, 0]], '火把掉落自身');
  /* 灯块(19): 创造专属政策不变 —— 加 light 不加采集字段(探险不可得口径不动) */
  assert.strictEqual(c.BLOCKS[19].name, '灯块');
  assert.deepEqual(c.BLOCKS[19].all, [1.00, 0.92, 0.55]);
  for (const f of ['hard', 'tool', 'tier', 'drop']) {
    assert.ok(!(f in c.BLOCKS[19]), '灯块仍为创造专属, 不应加 ' + f);
  }
  /* 发光岩/岩浆: 名字/颜色/旗标原样(岩浆 lava 旗标 + solid:false 不可碰撞) */
  assert.strictEqual(c.BLOCKS[c.B_GLOWSTONE].name, '发光岩');
  assert.deepEqual(c.BLOCKS[c.B_GLOWSTONE].all, [1.00, 0.85, 0.45]);
  assert.strictEqual(c.BLOCKS[c.B_LAVA].name, '岩浆');
  assert.deepEqual(c.BLOCKS[c.B_LAVA].all, [1.00, 0.42, 0.08]);
  assert.strictEqual(c.BLOCKS[c.B_LAVA].lava, true, '岩浆 lava 旗标保留');
  assert.strictEqual(c.BLOCKS[c.B_LAVA].solid, false, '岩浆不可碰撞保留');
});
