'use strict';
/* ============================================================
   合成核心 (CraftCore, 术语见 GLOSSARY.md — 词条随 T16 收尾合入) — 引擎层·纯核心
   ------------------------------------------------------------
   合成系统的唯一数据源: RECIPES 全表(手搓 4 + 工作台级 28, 站点
   'hand' 随时可做 / 'table' 需走近工作台 4 格, 拍板④) · SMELTS 烧炼
   映射 · FUEL 燃料择优序(从 ITEMS fuel 字段按热值降序派生)。外加五个
   无状态纯函数: canCraft 缺失清单(驱动配方卡亮灰) · craft 扣料+产栈 ·
   fuelUnits 热值查询 · smeltOf 烧炼产物 · breakTime 破坏时间(MC JE 正交
   口径: 品类对即吃速度乘数, canHarvest 管 ×1.5/×5 与掉落; 封顶 8s 下限
   0.15s, tier 不足可挖慢速但不掉落 — 挖掘硬度修正 D1)。
   cost 值为数组 [候选id数组, 数量] = 任选其一(如煤/木炭, 设计稿 §3.2);
   背包操作全部经背包核心接口(count/take/add/costEntry, 扣料与任选
   判定语义单一权威归 inventory-core, 本文件不做第二份实现)。
   零 THREE 零 DOM; 不依赖 config.js(breakTime 收 blockDef 纯数据)。
   interface: RECIPES · SMELTS · FUEL · canCraft(inv,recipe,stationOk) · craft(inv,recipe,stationOk)
              · fuelUnits(itemId) · smeltOf(itemId) · breakTime(blockDef,toolStack)
   依赖(均经全局名, 调用期解析): js/items-core.js 的 ITEMS(FUEL 在本文件顶层
     从 ITEMS 派生, 加载序必须在 items-core 之后) · js/inventory-core.js 的
     count/take/add/costEntry(仅运行时调用, 与其加载先后皆可)。
   可测性: 零 THREE·零 DOM·有单测(test/craft-core.test.js, vm 直测)
   ============================================================ */

/* ------------------------------------------------------------
   RECIPES 配方表 — 32 条(设计稿 §3.2 + §3.5) + 箱子(引导链 v2, story-quest-research)
   + 金苹果(F3, 二期设计稿 §3) + 床/灯笼(昼夜 D6/D7)
   条目形状: id 配方卡键 · out {item, n} 产物 · cost 材料计费
   (值=数量; 值=[候选id数组,数量]=任选其一, 键名仅占位) · station 'hand'|'table'
   ------------------------------------------------------------ */
const RECIPES = [
  /* —— 手搓级: 随时可做(§3.2) —— */
  {id: 'planks', out: {item: 'planks', n: 4}, cost: {log: 1}, station: 'hand'}, // 1 原木→4 木板(§4.2)
  {id: 'stick', out: {item: 'stick', n: 4}, cost: {planks: 2}, station: 'hand'}, // 2 板→4 棍(§4.2)
  {id: 'craft_table', out: {item: 'craft_table', n: 1}, cost: {planks: 4}, station: 'hand'}, // 4 板(§5.5)
  // 火把: 煤/木炭任选其一(§5.2)
  {id: 'torch', out: {item: 'torch', n: 4}, cost: {fuel: [['coal', 'charcoal'], 1], stick: 1}, station: 'hand'},

  /* —— 工具 16 条: 4 阶 × 镐斧剑锹, 镐斧 3材+2棍 · 剑 2材+1棍 · 锹 1材+2棍(§5.4 同构) ——
     材质按阶: 木=planks · 石=cobble · 铁=iron_ingot · 钻=diamond; 产物均 1 件(不可堆叠) */
  {id: 'pick_wood', out: {item: 'pick_wood', n: 1}, cost: {planks: 3, stick: 2}, station: 'table'},
  {id: 'pick_stone', out: {item: 'pick_stone', n: 1}, cost: {cobble: 3, stick: 2}, station: 'table'},
  {id: 'pick_iron', out: {item: 'pick_iron', n: 1}, cost: {iron_ingot: 3, stick: 2}, station: 'table'},
  {id: 'pick_diamond', out: {item: 'pick_diamond', n: 1}, cost: {diamond: 3, stick: 2}, station: 'table'},
  {id: 'axe_wood', out: {item: 'axe_wood', n: 1}, cost: {planks: 3, stick: 2}, station: 'table'},
  {id: 'axe_stone', out: {item: 'axe_stone', n: 1}, cost: {cobble: 3, stick: 2}, station: 'table'},
  {id: 'axe_iron', out: {item: 'axe_iron', n: 1}, cost: {iron_ingot: 3, stick: 2}, station: 'table'},
  {id: 'axe_diamond', out: {item: 'axe_diamond', n: 1}, cost: {diamond: 3, stick: 2}, station: 'table'},
  {id: 'sword_wood', out: {item: 'sword_wood', n: 1}, cost: {planks: 2, stick: 1}, station: 'table'},
  {id: 'sword_stone', out: {item: 'sword_stone', n: 1}, cost: {cobble: 2, stick: 1}, station: 'table'},
  {id: 'sword_iron', out: {item: 'sword_iron', n: 1}, cost: {iron_ingot: 2, stick: 1}, station: 'table'},
  {id: 'sword_diamond', out: {item: 'sword_diamond', n: 1}, cost: {diamond: 2, stick: 1}, station: 'table'},
  {id: 'shovel_wood', out: {item: 'shovel_wood', n: 1}, cost: {planks: 1, stick: 2}, station: 'table'},
  {id: 'shovel_stone', out: {item: 'shovel_stone', n: 1}, cost: {cobble: 1, stick: 2}, station: 'table'},
  {id: 'shovel_iron', out: {item: 'shovel_iron', n: 1}, cost: {iron_ingot: 1, stick: 2}, station: 'table'},
  {id: 'shovel_diamond', out: {item: 'shovel_diamond', n: 1}, cost: {diamond: 1, stick: 2}, station: 'table'},

  /* —— 站点件与补给包(§3.5 + §3.2) —— */
  {id: 'furnace', out: {item: 'furnace', n: 1}, cost: {cobble: 8}, station: 'table'}, // 8 圆石, 无需煤(§5.5)
  {id: 'chest', out: {item: 'chest', n: 1}, cost: {planks: 8}, station: 'table'}, // 8 木板(MC 正典); 只储物非站点
  // 床(昼夜 D6 §7.1): 3 羊毛+3 木板(MC 正典); 羊毛来源 F4 牧场, 原料闭环; 夜里点击睡觉跳夜
  {id: 'bed', out: {item: 'bed', n: 1}, cost: {wool: 3, planks: 3}, station: 'table'},
  // 灯笼(昼夜 D7 §8.1): 原创手持光源 — MC 灯笼 8 铁粒+火把, 铁粒本游戏不存在折算 2 铁锭(差异 #6);
  // dur 300 秒天黑才亮才耗, 耐久政策在模式层(§8.2)
  {id: 'lantern', out: {item: 'lantern', n: 1}, cost: {iron_ingot: 2, torch: 1}, station: 'table'},
  {id: 'stone_bricks', out: {item: 'stone_bricks', n: 4}, cost: {stone: 4}, station: 'table'}, // 4 石→4 石砖(MC 口径, §3.5)
  {id: 'bricks', out: {item: 'bricks', n: 1}, cost: {brick: 4}, station: 'table'}, // 4 红砖→1 红砖块(黏土-红砖链, §3.5)
  {id: 'shears', out: {item: 'shears', n: 1}, cost: {iron_ingot: 2}, station: 'table'}, // 剪树叶得树叶方块(§3.5)
  // 金苹果: 8 金锭+1 苹果(MC 正典, 金锭出口——二期设计稿 §3/F3)
  {id: 'golden_apple', out: {item: 'golden_apple', n: 1}, cost: {gold_ingot: 8, apple: 1}, station: 'table'},
  {id: 'tnt', out: {item: 'tnt', n: 1}, cost: {gunpowder: 5, sand: 4}, station: 'table'}, // MC 口径(§3.2); 火药→炸矿出口(D4)
  {id: 'bow_item', out: {item: 'bow_item', n: 1}, cost: {stick: 3, string: 3}, station: 'table'}, // 二期弓物品化启用, 一期不点亮
  {id: 'bread', out: {item: 'bread', n: 1}, cost: {wheat: 3}, station: 'table'}, // 原料二期(农田链): 一期卡片不点亮
  {id: 'bone_meal', out: {item: 'bone_meal', n: 3}, cost: {bone: 1}, station: 'table'}, // 用途二期催熟: 一期卡片不点亮
];

/* ------------------------------------------------------------
   SMELTS 烧炼表 — 原料→产物映射(研究稿 §5.3 + 任务合同)
   铁/金为粗矿口径(挖出矿石物品, 需熔炼); 圆石烧回石头成建材循环;
   生→熟肉四条(F4 二期设计稿 §4.6): 烧炼时长/燃料与矿物同套(MC 全配方同速)
   ------------------------------------------------------------ */
const SMELTS = {
  iron_ore: 'iron_ingot', // 粗矿→锭(D5)
  gold_ore: 'gold_ingot', // 粗矿→锭(D5)
  log: 'charcoal', // 烧原木得木炭(与煤等效的任选燃料/材料)
  cobble: 'stone', // 圆石↔石头建材循环(§3.5)
  sand: 'glass', // 烧沙得玻璃
  clay_ball: 'brick', // 黏土球→红砖(§3.5 红砖链)
  raw_beef: 'cooked_beef', // F4: 生牛肉→牛排
  raw_porkchop: 'cooked_porkchop', // F4: 生猪排→熟猪排
  raw_chicken: 'cooked_chicken', // F4: 生鸡肉→熟鸡肉
  raw_mutton: 'cooked_mutton', // F4: 生羊肉→熟羊肉
};

/* ------------------------------------------------------------
   FUEL 燃料择优序 — 从 ITEMS 的 fuel 字段(热值=能烧几件)按值降序派生,
   同值保持注册表原序; 熔炉「自动放料」按此序挑最省的(D8: 煤→木炭→原木→木板→木棍)
   ------------------------------------------------------------ */
const FUEL = Object.keys(ITEMS)
    .filter((id) => typeof ITEMS[id].fuel === 'number')
    .sort((a, b) => ITEMS[b].fuel - ITEMS[a].fuel);

/* ------------------------------------------------------------
   纯函数 — 无状态; 配方书面板(T10)与合成/烧炼接线(T13)的共用底座
   ------------------------------------------------------------ */

/* 燃料热值查询: 返回该物品能烧几件(D8 自动燃料); 非燃料/未注册返回 0 */
function fuelUnits(itemId) {
  const it = ITEMS[itemId];
  return (it && typeof it.fuel === 'number') ? it.fuel : 0;
}

/* 烧炼产物查询: 未登记原料返回 null(熔炉面板据此不放料) */
function smeltOf(itemId) {
  return SMELTS[itemId] || null;
}

/* ------------------------------------------------------------
   canCraft/craft — 合成预检与执行, 背包操作经背包核心接口
   (inv = mkInventory() 产出的背包对象 {slots}, 扣料/入包/任选判定的
   语义单一权威在 inventory-core, 本文件只做配方层编排)
   ------------------------------------------------------------ */

/* canCraft — 合成预检, 返回 {ok, missing}。
   missing 驱动配方卡灰显(D8: 缺什么灰什么): 材料条目 {id, need, have} ·
   任选材料全缺条目 {any:[候选], need}(候选合计口径, 与 canAfford 一致) ·
   站点条目 {station:'table'} */
function canCraft(inv, recipe, stationOk) {
  const missing = [];
  if (recipe.station === 'table' && !stationOk) missing.push({station: 'table'});
  for (const [key, val] of Object.entries(recipe.cost)) {
    const e = costEntry(key, val); // 候选数组 + 需求数(inventory-core 统一形状)
    const have = e.cands.reduce((sum, c) => sum + count(inv, c), 0);
    if (have < e.n) {
      missing.push(e.cands.length === 1 ? {id: e.cands[0], need: e.n, have} : {any: [...e.cands], need: e.n});
    }
  }
  return {ok: missing.length === 0, missing};
}

/* craft — 扣料 + 产栈: 先预检(不过不动背包), 再 take 整单扣料(任选按
   候选序优先, inventory-core 口径), 最后 add 产栈入包; 背包放不下的
   余量以 leftover 返回(模式层转掉落物, 零惩罚口径) */
function craft(inv, recipe, stationOk) {
  const check = canCraft(inv, recipe, stationOk);
  if (!check.ok) return check;
  take(inv, recipe.cost);
  const leftover = add(inv, recipe.out.item, recipe.out.n);
  return {ok: true, out: {item: recipe.out.item, n: recipe.out.n}, leftover};
}

/* ------------------------------------------------------------
   breakTime — 破坏时间(挖掘规则的纯计算段, 挖掘硬度修正设计稿 D1)
   速度与掉落是两个正交判定(MC JE 口径, 研究稿 §8 源码 DiggerItem 双判定):
   · 品类对(不看等级) → 工具速度乘数生效 — 哪怕 tier 不够也生效;
   · canHarvest(tier 0, 或品类对且等级够) → ×1.5/×5 系数与掉落门禁。
   t = hard × (canHarvest ? 1.5 : 5) / 速度乘数
   封顶 8s(儿童去绝望感) · 下限 0.15s · tier 不足 → 可挖慢速但 drops:false
   (掉落不触发, 模式层负责提示与图标闪烁)。
   blockDef 形状对齐 config.js BLOCKS(hard/tool/tier/drop);
   toolStack 为槽形状 {id,n,dur} 或 null=徒手; 手持非工具物品视为徒手。
   ------------------------------------------------------------ */
function breakTime(blockDef, toolStack) {
  const tool = toolStack ? toolOf(toolStack.id) : null; // 非工具物品 → null → 徒手口径
  const kindMatch = !!(tool && blockDef.tool && tool.kind === blockDef.tool); // 品类匹配, 等级不看
  const speedMult = kindMatch ? tool.speed : 1; // 品类对 → 速度生效(JE: 等级不够也生效)
  const harvest = blockDef.tier === 0 || (kindMatch && tool.tier >= blockDef.tier); // 采集门禁
  const raw = blockDef.hard * (harvest ? 1.5 : 5) / speedMult;
  const time = Math.min(8, Math.max(0.15, raw));
  return {
    // 10μs 圆整数值卫生(公式值至多 5 位小数; 0.2×1.5 的浮点尾差不外漏给消费方)
    time: Math.round(time * 1e5) / 1e5,
    drops: harvest, // tier 0 = 无门槛恒掉; 否则要品类对且等级够
  };
}
