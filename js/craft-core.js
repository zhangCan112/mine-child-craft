'use strict';
/* ============================================================
   合成核心 (CraftCore, 术语见 GLOSSARY.md — 词条随 T16 收尾合入) — 引擎层·纯核心
   ------------------------------------------------------------
   合成系统的唯一数据源: RECIPES 全表(随身 12 + 工作台级 28, 九宫格
   改造 crafting-grid 设计稿 §3; 站点 'hand'=2×2 随身摆放格随时可摆 /
   'table'=3×3 摆放台需走近工作台 4 格, 拍板①④) · SMELTS 烧炼
   映射 · FUEL 燃料择优序(从 ITEMS fuel 字段按热值降序派生)。
   九宫格纯函数组(crafting-grid §4, 口径全正典 minecraft.wiki):
   shapeCost 图案→派生 cost(配方卡亮灰与摆入预检) · matchGrid
   摆放→配方匹配(裁剪外圈平移 + 每行逆序水平镜像重试 + 无序多重集
   恰好相等) · gridCraft 每占用格扣 1 件+产栈入包 · fillGrid BE 口径
   一键摆入(先退格再逐规约格取 1, 缺料留空, 重复调=再备一套)。
   外加烧炼步进/退炉/挖掘纯函数: fuelUnits 热值查询 · smeltOf 烧炼产物 ·
   smeltStep 烧炼单步(节拍常量 SMELT_T 与表同居, 2026-10 自 adventure-core
   迁入——步进政策与烧炼表同一权威) · furnaceRefund 退炉政策(同批迁入) ·
   breakTime 破坏时间(MC JE 正交口径: 品类对即吃速度乘数, canHarvest
   管 ×1.5/×5 与掉落; 封顶 8s 下限 0.15s, tier 不足可挖慢速但不掉落
   — 挖掘硬度修正 D1; 无 hard = 声明式不可破坏(含 TNT 免疫判据,
   下界并入探险 D5): time Infinity + drops false)。
   背包操作全部经背包核心接口(count/take/add, 扣料与任选判定的语义
   单一权威归 inventory-core, 本文件不做第二份实现); 旧 cost 计费
   自动合成 craft() 已随九宫格改造退役(gridCraft 接棒)。
   零 THREE 零 DOM; 不依赖 config.js(breakTime 收 blockDef 纯数据)。
   interface: RECIPES · SMELTS · FUEL · shapeCost(recipe) · canCraft(inv,recipe,stationOk)
              · matchGrid(cells,recipe) · gridCraft(cells,inv,stationOk,recipes=RECIPES)
              · fillGrid(inv,recipe,cells) · fuelUnits(itemId) · smeltOf(itemId)
              · SMELT_T · smeltStep(s,dt) · furnaceRefund(inv,f)
              · breakTime(blockDef,toolStack)
   依赖(均经全局名, 调用期解析): js/items-core.js 的 ITEMS(FUEL 在本文件顶层
     从 ITEMS 派生, 加载序必须在 items-core 之后) · js/inventory-core.js 的
     count/take/add(仅运行时调用, 与其加载先后皆可)。
   可测性: 零 THREE·零 DOM·有单测(test/craft-core.test.js, vm 直测)
   ============================================================ */

/* ------------------------------------------------------------
   RECIPES 配方表 — 41 条(crafting-grid 设计稿 §3 + 下界并入探险 D3 压轴 1 条 +
      雪球 T9 + 门/玻璃板 2 条 + 补链 3 条 + 大背包 1 条, 图案逐条查证自
      minecraft.wiki——大背包为原创件, docs/bag-and-drop-design.md §2),
      见 docs/mc-crafting-grid-research.md §3 与 docs/door-window-research.md)
   条目形状: id 配方卡键 · out {item, n} 产物 · station 'hand'|'table'
   · shape 图案(crafting-grid §3):
       {rows: [[格子规约|null, ...], ...]}  有序(行列=图案最小包围盒,
                                            存储不强制矩形, 匹配前补齐)
       {any: [格子规约, ...]}               无序(非空格多重集恰好相等)
   格子规约 = '物品id' 或 候选id数组(任选其一, 如火把煤/木炭)。
   材料 cost 由 shapeCost 从 shape 派生(单一数据源, 不另存计费表)。
   ------------------------------------------------------------ */
const RECIPES = [
  /* —— 随身级 2×2 摆放格(拍板①: 木板/木棍/工作台/火把为 Wiki 点名的
     2×2 例; 石砖/红砖块/剪刀/骨粉 4 条按正典迁回 hand, 拍板②;
     砂岩/线羊毛/铁粒回炉 3 条补链, farm-and-recipe 设计稿 D1) —— */
  {id: 'planks', out: {item: 'planks', n: 4}, station: 'hand', // 1 原木→4 木板
    shape: {rows: [['log']]}},
  {id: 'stick', out: {item: 'stick', n: 4}, station: 'hand', // 2 板竖排→4 棍
    shape: {rows: [['planks'], ['planks']]}},
  {id: 'craft_table', out: {item: 'craft_table', n: 1}, station: 'hand', // 4 板填满 2×2
    shape: {rows: [['planks', 'planks'], ['planks', 'planks']]}},
  // 火把: 煤/木炭任选其一在上、木棍在下 → 4 支(候选数组 = MC tag 口径)
  {id: 'torch', out: {item: 'torch', n: 4}, station: 'hand',
    shape: {rows: [[['coal', 'charcoal']], ['stick']]}},
  // 石砖: 4 石头 2×2 → 4(正典随身可做, 拍板②迁 hand)
  {id: 'stone_bricks', out: {item: 'stone_bricks', n: 4}, station: 'hand',
    shape: {rows: [['stone', 'stone'], ['stone', 'stone']]}},
  // 红砖块: 4 红砖 2×2 → 1(正典随身可做, 拍板②迁 hand)
  {id: 'bricks', out: {item: 'bricks', n: 1}, station: 'hand',
    shape: {rows: [['brick', 'brick'], ['brick', 'brick']]}},
  // 剪刀: 两铁锭对角(镜像可摆; 正典随身可做, 拍板②迁 hand)
  {id: 'shears', out: {item: 'shears', n: 1}, station: 'hand',
    shape: {rows: [[null, 'iron_ingot'], ['iron_ingot', null]]}},
  // 骨粉: 1 骨头 → 3(单材料无序; 二期配方不点亮, 拍板②先迁 hand 对齐数据)
  {id: 'bone_meal', out: {item: 'bone_meal', n: 3}, station: 'hand',
    shape: {any: ['bone']}},
  // 铁粒: 1 铁锭 → 9(MC 正典单格配方, 拍板⑤; 灯笼材料的来路闭环)
  {id: 'iron_nuggets', out: {item: 'iron_nugget', n: 9}, station: 'hand',
    shape: {rows: [['iron_ingot']]}},
  // 雪块: 4 雪球 2×2 → 1(雪仗弹药↔建材互兑; 挖雪块掉 4 球的合成反向, T9;
  // MC 正典 shapeless 同档, 存储用满格 rows 跟 craft_table/stone_bricks 同款)
  {id: 'snow', out: {item: 'snow', n: 1}, station: 'hand',
    shape: {rows: [['snowball', 'snowball'], ['snowball', 'snowball']]}},
  // 砂岩: 4 沙子 2×2 → 1(MC 正典 sandstone.json; 沙子建材化——沙漠地下层从
  // 「只能挖」转「可合成」, farm-and-recipe 设计稿 D1)
  {id: 'sandstone', out: {item: 'sandstone', n: 1}, station: 'hand',
    shape: {rows: [['sand', 'sand'], ['sand', 'sand']]}},
  // 羊毛: 4 线无序 → 1 白羊毛(MC 正典 white_wool shapeless; 线的第二出口,
  // 没羊也能做床; 只开白羊毛天然对齐——线没有颜色)
  {id: 'wool', out: {item: 'wool', n: 1}, station: 'hand',
    shape: {any: ['string', 'string', 'string', 'string']}},
  // 铁粒回炉: 9 铁粒无序 → 1 铁锭(MC 正典 shapeless, 3×3 台级——9 格摆不下随身格;
  // 闭合铁粒单向死路: 灯笼用 8 粒的余料可回锭, farm-and-recipe 设计稿 D1)
  {id: 'iron_ingot', out: {item: 'iron_ingot', n: 1}, station: 'table',
    shape: {any: ['iron_nugget', 'iron_nugget', 'iron_nugget', 'iron_nugget',
      'iron_nugget', 'iron_nugget', 'iron_nugget', 'iron_nugget', 'iron_nugget']}},

  /* —— 工具 16 条: 4 阶 × 镐斧剑锹 = 4 个形状模板 × 4 材质阶
     (材质: 木=planks · 石=cobble · 铁=iron_ingot · 钻=diamond;
     图案全 3×3 台专属, 斧/弓/剪刀靠镜像左右手版皆可摆) —— */
  {id: 'pick_wood', out: {item: 'pick_wood', n: 1}, station: 'table',
    shape: {rows: [['planks', 'planks', 'planks'], [null, 'stick', null], [null, 'stick', null]]}},
  {id: 'pick_stone', out: {item: 'pick_stone', n: 1}, station: 'table',
    shape: {rows: [['cobble', 'cobble', 'cobble'], [null, 'stick', null], [null, 'stick', null]]}},
  {id: 'pick_iron', out: {item: 'pick_iron', n: 1}, station: 'table',
    shape: {rows: [['iron_ingot', 'iron_ingot', 'iron_ingot'], [null, 'stick', null], [null, 'stick', null]]}},
  {id: 'pick_diamond', out: {item: 'pick_diamond', n: 1}, station: 'table',
    shape: {rows: [['diamond', 'diamond', 'diamond'], [null, 'stick', null], [null, 'stick', null]]}},
  {id: 'axe_wood', out: {item: 'axe_wood', n: 1}, station: 'table',
    shape: {rows: [['planks', 'planks'], ['planks', 'stick'], [null, 'stick']]}},
  {id: 'axe_stone', out: {item: 'axe_stone', n: 1}, station: 'table',
    shape: {rows: [['cobble', 'cobble'], ['cobble', 'stick'], [null, 'stick']]}},
  {id: 'axe_iron', out: {item: 'axe_iron', n: 1}, station: 'table',
    shape: {rows: [['iron_ingot', 'iron_ingot'], ['iron_ingot', 'stick'], [null, 'stick']]}},
  {id: 'axe_diamond', out: {item: 'axe_diamond', n: 1}, station: 'table',
    shape: {rows: [['diamond', 'diamond'], ['diamond', 'stick'], [null, 'stick']]}},
  {id: 'sword_wood', out: {item: 'sword_wood', n: 1}, station: 'table',
    shape: {rows: [['planks'], ['planks'], ['stick']]}},
  {id: 'sword_stone', out: {item: 'sword_stone', n: 1}, station: 'table',
    shape: {rows: [['cobble'], ['cobble'], ['stick']]}},
  {id: 'sword_iron', out: {item: 'sword_iron', n: 1}, station: 'table',
    shape: {rows: [['iron_ingot'], ['iron_ingot'], ['stick']]}},
  {id: 'sword_diamond', out: {item: 'sword_diamond', n: 1}, station: 'table',
    shape: {rows: [['diamond'], ['diamond'], ['stick']]}},
  {id: 'shovel_wood', out: {item: 'shovel_wood', n: 1}, station: 'table',
    shape: {rows: [['planks'], ['stick'], ['stick']]}},
  {id: 'shovel_stone', out: {item: 'shovel_stone', n: 1}, station: 'table',
    shape: {rows: [['cobble'], ['stick'], ['stick']]}},
  {id: 'shovel_iron', out: {item: 'shovel_iron', n: 1}, station: 'table',
    shape: {rows: [['iron_ingot'], ['stick'], ['stick']]}},
  {id: 'shovel_diamond', out: {item: 'shovel_diamond', n: 1}, station: 'table',
    shape: {rows: [['diamond'], ['stick'], ['stick']]}},

  /* —— 站点件与补给包(crafting-grid §3 站点件图案: 环形/棋盘/横排) —— */
  {id: 'furnace', out: {item: 'furnace', n: 1}, station: 'table', // 8 圆石环形围一圈, 无需煤
    shape: {rows: [['cobble', 'cobble', 'cobble'], ['cobble', null, 'cobble'], ['cobble', 'cobble', 'cobble']]}},
  {id: 'chest', out: {item: 'chest', n: 1}, station: 'table', // 8 木板环形(MC 正典); 只储物非站点
    shape: {rows: [['planks', 'planks', 'planks'], ['planks', null, 'planks'], ['planks', 'planks', 'planks']]}},
  // 床(昼夜 D6 §7.1): 3 羊毛上排+3 木板下排(MC 正典; 三羊毛同色——我们只开白羊毛天然满足)
  {id: 'bed', out: {item: 'bed', n: 1}, station: 'table',
    shape: {rows: [['wool', 'wool', 'wool'], ['planks', 'planks', 'planks']]}},
  // 灯笼(昼夜 D7 §8.1): MC 正典 8 铁粒环形+中心火把(拍板⑤回正典, 旧「2 铁锭折算差异 #6」闭环)
  {id: 'lantern', out: {item: 'lantern', n: 1}, station: 'table',
    shape: {rows: [['iron_nugget', 'iron_nugget', 'iron_nugget'], ['iron_nugget', 'torch', 'iron_nugget'], ['iron_nugget', 'iron_nugget', 'iron_nugget']]}},
  // 金苹果: 8 金锭环形+中心苹果(MC 正典, 金锭出口——二期设计稿 §3/F3)
  {id: 'golden_apple', out: {item: 'golden_apple', n: 1}, station: 'table',
    shape: {rows: [['gold_ingot', 'gold_ingot', 'gold_ingot'], ['gold_ingot', 'apple', 'gold_ingot'], ['gold_ingot', 'gold_ingot', 'gold_ingot']]}},
  // TNT: 火药沙子棋盘格交错(MC 口径; 火药→炸矿出口 D4)
  {id: 'tnt', out: {item: 'tnt', n: 1}, station: 'table',
    shape: {rows: [['gunpowder', 'sand', 'gunpowder'], ['sand', 'gunpowder', 'sand'], ['gunpowder', 'sand', 'gunpowder']]}},
  // 弓: 木棍蛇形左列+线右列, 弦可左可右(镜像, Wiki 点名例); 二期物品化启用, 一期不点亮
  {id: 'bow_item', out: {item: 'bow_item', n: 1}, station: 'table',
    shape: {rows: [[null, 'stick', 'string'], ['stick', null, 'string'], [null, 'stick', 'string']]}},
  // 面包: 3 小麦一横排(当前版本仍是有序, Wiki 平移例); 原料二期(农田链), 一期不点亮
  {id: 'bread', out: {item: 'bread', n: 1}, station: 'table',
    shape: {rows: [['wheat', 'wheat', 'wheat']]}},
  // 门(MC 正典 oak_door.json, docs/door-window-design.md §2.4): 6 木板 2 列×3 行 → 3 扇; 需 3 行 → 台级
  {id: 'door', out: {item: 'door', n: 3}, station: 'table',
    shape: {rows: [['planks', 'planks'], ['planks', 'planks'], ['planks', 'planks']]}},
  // 玻璃板(MC 正典 glass_pane.json): 6 玻璃 3 列×2 行 → 16 块; 需 3 列 → 台级; 烧沙→玻璃链现成(SMELTS)
  {id: 'glass_pane', out: {item: 'glass_pane', n: 16}, station: 'table',
    shape: {rows: [['glass', 'glass', 'glass'], ['glass', 'glass', 'glass']]}},
  // 大背包(2026-10, docs/bag-and-drop-design.md §2): 2 线提手 + 6 皮革包身
  //   (图案借原版 1.17 bundle 环形——兔皮换本游戏已开放的皮革; 皮革首个合成出口,
  //   farm-and-recipe D4 挂账清偿); 手持使用扩容 +6 主格, 一次性(已扩容配方卡隐藏)
  {id: 'bag_upgrade', out: {item: 'bag_upgrade', n: 1}, station: 'table',
    shape: {rows: [['string', null, 'string'], ['leather', 'leather', 'leather'], ['leather', 'leather', 'leather']]}},
  // 下界传送门(下界并入探险 D3): 8 金锭环形+中心钻石, 全表最贵合成压轴; 放下长出整座门(结构放置, 探险壳拦截)
  {id: 'nether_portal', out: {item: 'nether_portal', n: 1}, station: 'table',
    shape: {rows: [['gold_ingot', 'gold_ingot', 'gold_ingot'], ['gold_ingot', 'diamond', 'gold_ingot'], ['gold_ingot', 'gold_ingot', 'gold_ingot']]}},
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

const SMELT_T = 2.5; /* 每件烧炼秒数(D8: MC 10s → 儿童缩短; 附录 B 差异清单)。
  2026-10 自 adventure-core 迁入(原 ADV_SMELT_T)——步进政策与烧炼表同居,
  炉态存档校验的进度钳制界(adventure-core advFurnaceValid)也读这里 */

/* ------------------------------------------------------------
   FUEL 燃料择优序 — 从 ITEMS 的 fuel 字段(热值=能烧几件)按值降序派生,
   同值保持注册表原序; 熔炉「自动放料」按此序挑最省的(D8: 煤→木炭→原木→
   木板→木棍→树苗, 树苗半件=farm-and-recipe D1 补链)
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
   烧炼步进与退炉政策(2026-10 自 adventure-core 迁入, 原
   advSmeltStep/advFurnaceRefund——政策与表同居; 函数体逐字搬运)
   ------------------------------------------------------------ */

/* 烧炼单步: s 为炉状态 {input, fuel, out, heat, prog}, heat 单位=件(1 件=
   SMELT_T 秒, 燃料热值经 fuelUnits 折算), prog 为当前这件已烧秒数。
   无料停炉; 无热且无燃料暂停(进度与热值保留——关面板/断档都不清零不白烧);
   有热折算可烧秒数推进, 满 2.5s 产一件(产物槽同 id 叠加, 异 id 占满则停炉
   待取——MC 阻塞口径), 余时结转下一件, 料尽 prog 归零。返回新状态不改入参。 */
function smeltStep(s, dt) {
  const n = {input: s.input, fuel: s.fuel, out: s.out, heat: s.heat, prog: s.prog};
  if (!n.input) return n;
  if (n.heat <= 0) {
    if (!n.fuel) return n; /* 暂停: 等燃料(自动放料)或玩家回来 */
    n.heat += fuelUnits(n.fuel.id); /* 自动燃料: 热值烧尽才耗下一件燃料 */
    n.fuel = n.fuel.n > 1 ? {id: n.fuel.id, n: n.fuel.n - 1} : null;
  }
  const burn = Math.min(dt, n.heat * SMELT_T); /* 热值折秒, 本步不白烧 */
  n.heat = Math.max(0, n.heat - burn / SMELT_T);
  n.prog += burn;
  while (n.prog >= SMELT_T && n.input) {
    const pid = smeltOf(n.input.id);
    if (!pid || (n.out && n.out.id !== pid)) break; /* 非法料/产物槽被占: 停炉待取 */
    n.out = n.out ? {id: pid, n: n.out.n + 1} : {id: pid, n: 1};
    n.input = n.input.n > 1 ? {id: n.input.id, n: n.input.n - 1} : null;
    n.prog -= SMELT_T;
  }
  if (!n.input) n.prog = 0; /* 料尽: 半件进度清零, 下一炉从头烧 */
  n.prog = Math.min(n.prog, SMELT_T); /* 进度钳制(显示层 setProgress 再钳一次) */
  return n;
}

/* 退炉政策(D8): 炉内三笔(待烧料/燃料/产物)全额入包, 返回满包容纳不下的
   余量清单——调用方 Drops.spawn 脚下(零惩罚口径); 不动炉状态(清炉归调用方) */
function furnaceRefund(inv, f) {
  const leftover = [];
  for (const st of [f.input, f.fuel, f.out]) {
    if (!st) continue;
    const left = add(inv, st.id, st.n);
    if (left > 0) leftover.push({id: st.id, n: left});
  }
  return leftover;
}

/* ------------------------------------------------------------
   九宫格纯函数组(crafting-grid §4) — 图案数据与摆放台的共用底座,
   背包操作经背包核心接口(inv = mkInventory() 背包, 扣料/入包/任选
   判定的语义单一权威在 inventory-core, 本文件只做配方层编排)
   ------------------------------------------------------------ */

/* shapeCost — 图案→派生 cost 表(单一数据源): 配方卡亮灰(canCraft)与
   一键摆入预检共用。值 = 数量 或 [候选id数组, 数量](任选形状,
   inventory-core costEntry 统一形状; 候选组键名仅占位, 同集合多格
   合并计数)。 */
function shapeCost(recipe) {
  const cost = {};
  const groups = {}; // 候选组桶: 键 = 候选排序拼接 → {cands, n}
  const bump = (spec) => {
    if (spec == null) return;
    if (typeof spec === 'string') {
      cost[spec] = (cost[spec] || 0) + 1;
      return;
    }
    const key = spec.slice().sort().join('|');
    const g = groups[key] || (groups[key] = {cands: spec.slice(), n: 0});
    g.n += 1;
  };
  const shape = recipe.shape;
  if (shape.any) shape.any.forEach(bump);
  else shape.rows.forEach((row) => row.forEach(bump));
  for (const key of Object.keys(groups)) cost[key] = [groups[key].cands, groups[key].n];
  return cost;
}

/* canCraft — 背包合成预检(配方卡亮灰驱动), 返回 {ok, missing}。
   missing 三形状契约不变: 材料条目 {id, need, have} · 任选材料全缺
   条目 {any:[候选], need}(候选合计口径, 与 canAfford 一致) · 站点
   条目 {station:'table'}。计费表从 shape 派生(不再读 recipe.cost)。 */
function canCraft(inv, recipe, stationOk) {
  const missing = [];
  if (recipe.station === 'table' && !stationOk) missing.push({station: 'table'});
  for (const [key, val] of Object.entries(shapeCost(recipe))) {
    const e = costEntry(key, val); // 候选数组 + 需求数(inventory-core 统一形状)
    const have = e.cands.reduce((sum, c) => sum + count(inv, c), 0);
    if (have < e.n) {
      missing.push(e.cands.length === 1 ? {id: e.cands[0], need: e.n, have} : {any: [...e.cands], need: e.n});
    }
  }
  return {ok: missing.length === 0, missing};
}

/* matchGrid — 摆放→配方匹配(口径全正典, 研究稿 §2):
   cells = 长度 9(3×3 台)或 4(2×2 随身格)的槽堆数组({id,n}|null)。
   无序(any): 非空格构成的多重集与材料表恰好相等(多一件不行,
   空格位置随意)。有序(rows): 双方裁剪全空外圈(= 图案可在格内任意
   平移, 不必顶格左上角)后形状与逐格规约全对(id 相同 或 ∈候选数组);
   不中则图案每行逆序(水平镜像)再试一次——斧/弓/剪刀的左右手版靠
   这条, 垂直翻转不匹配。图案外的多余物品使包围盒对不上, 自然不中。 */
function matchGrid(cells, recipe) {
  if (!cells || !recipe || !recipe.shape) return false;
  const shape = recipe.shape;
  if (shape.any) { // 无序: 逐非空格消耗一个满足的规约, 消不动/用不完即不中
    const specs = shape.any.slice();
    for (const s of cells) {
      if (!s) continue;
      const i = specs.findIndex((sp) => (Array.isArray(sp) ? sp.includes(s.id) : sp === s.id));
      if (i < 0) return false;
      specs.splice(i, 1);
    }
    return specs.length === 0;
  }
  const rows = shape.rows;
  const patW = Math.max(...rows.map((row) => row.length)); // 存储允许不等宽, 补齐成矩形
  const pat = rows.map((row) => {
    const line = row.slice();
    while (line.length < patW) line.push(null);
    return line;
  });
  const grid = gridNorm(cells);
  return gridFits(gridTrim(grid), gridTrim(pat)) ||
      gridFits(gridTrim(grid), gridTrim(pat.map((line) => line.slice().reverse())));
}

/* cells → 规格 2D 矩阵(存槽堆 id 或 null); 9 格=3×3, 其余按 2×2 */
function gridNorm(cells) {
  const w = cells.length >= 9 ? 3 : 2;
  const grid = [];
  for (let r = 0; r < w; r++) grid.push(cells.slice(r * w, r * w + w).map((s) => (s ? s.id : null)));
  return grid;
}

/* 裁剪全空外圈(平移语义的实现: 只比最小包围盒); 全空返回 [] */
function gridTrim(mat) {
  let r0 = mat.length; let r1 = -1; let c0 = -1; let c1 = -1;
  for (let r = 0; r < mat.length; r++) {
    for (let c = 0; c < mat[r].length; c++) {
      if (mat[r][c] != null) {
        if (r < r0) r0 = r;
        if (r > r1) r1 = r;
        if (c0 < 0 || c < c0) c0 = c;
        if (c > c1) c1 = c;
      }
    }
  }
  if (r1 < 0) return [];
  const out = [];
  for (let r = r0; r <= r1; r++) out.push(mat[r].slice(c0, c1 + 1));
  return out;
}

/* 逐格比较: 行列数相等 + 空位对空位 + 每个非空位槽堆 id 满足规约 */
function gridFits(g, p) {
  if (g.length !== p.length || g.length === 0) return false;
  for (let r = 0; r < g.length; r++) {
    if (g[r].length !== p[r].length) return false;
    for (let c = 0; c < g[r].length; c++) {
      const spec = p[r][c];
      const id = g[r][c];
      if (spec == null && id != null) return false; // 图案外多余物品
      if (spec != null) {
        if (id == null) return false; // 图案位缺材料
        if (Array.isArray(spec) ? !spec.includes(id) : spec !== id) return false;
      }
    }
  }
  return true;
}

/* gridCraft — 摆放台合成执行: 按 recipes 数组序找首个 matchGrid 命中
   (同摆多配的确定性兜底, 研究稿 §2.6 悬置项) → 站点门禁 → 每个占用格
   n-1(扣空清 null; MC 每次合成每占用格扣 1 件口径) → add 产栈入包。
   背包放不下的余量以 leftover 返回(模式层转掉落物, 零惩罚口径)。
   recipes 缺省 RECIPES 全表(面板/测试可注入子表)。 */
function gridCraft(cells, inv, stationOk, recipes) {
  const list = recipes || RECIPES;
  for (const r of list) {
    if (!matchGrid(cells, r)) continue;
    if (r.station === 'table' && !stationOk) return {ok: false, reason: 'station'};
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      if (s) {
        s.n -= 1;
        if (s.n <= 0) cells[i] = null;
      }
    }
    const leftover = add(inv, r.out.item, r.out.n);
    return {ok: true, out: {item: r.out.item, n: r.out.n}, leftover};
  }
  return {ok: false, reason: 'nomatch'};
}

/* fillGrid — BE 口径一键摆入(拍板③, 研究稿 §5.2): 点配方卡把背包材料
   摆进摆放台。两步走: ① 全格清扫——格内物品若不是本配方的材料
   (图案任何位置都用不上), 先 add 退回背包(放不下留格, 下方不强摆);
   ② 逐规约格并堆 +1(空格造新摞, 候选按序取有货的, 格内异种即退)
   ——重复调用 = 再备一套(产出槽长按连做的备料口径)。缺料格留空
   (部分摆入让孩子看见图案成形)。返回 {placed, missing}: 放入件数
   与缺料展示 id 列表。 */
function fillGrid(inv, recipe, cells) {
  const shape = recipe.shape;
  const w = cells.length >= 9 ? 3 : 2;
  const mats = new Set(); // 本配方全部材料 id(含候选展开)
  const each = (spec) => {
    if (spec == null) return;
    (Array.isArray(spec) ? spec : [spec]).forEach((id) => mats.add(id));
  };
  if (shape.any) shape.any.forEach(each);
  else shape.rows.forEach((row) => row.forEach(each));
  for (let i = 0; i < cells.length; i++) { // ① 清扫异物(图案用不上的整摞退包)
    const s = cells[i];
    if (s && !mats.has(s.id)) {
      const left = add(inv, s.id, s.n);
      if (left > 0) s.n = left;
      else cells[i] = null;
    }
  }
  const placed = [];
  const missing = [];
  const put = (idx, spec) => { // ② 逐格铺一件
    if (idx >= cells.length) return; // 图案越出小台(防御): 不铺
    const cands = Array.isArray(spec) ? spec : [spec];
    let cur = cells[idx];
    if (cur && !cands.includes(cur.id)) { // 材料放错格: 先退回背包, 退不动的让位失败
      const left = add(inv, cur.id, cur.n);
      cur = left > 0 ? ((cur.n = left), cur) : ((cells[idx] = null), null);
    }
    if (cur && cur.n >= 64) return; // 已满: 这格备够了
    const id = cur ? cur.id : cands.find((c) => count(inv, c) > 0);
    if (!id) {
      missing.push(cands[0]); // 缺料: 留空, 报展示 id(候选首位)
      return;
    }
    take(inv, {[id]: 1});
    if (cur) cur.n += 1;
    else cells[idx] = {id, n: 1};
    placed.push(id);
  };
  if (shape.any) { // 无序: 从左上角起顺次铺(位置无关)
    shape.any.forEach((spec, i) => put(i, spec));
  } else {
    shape.rows.forEach((row, r) => row.forEach((spec, c) => {
      if (spec != null) put(r * w + c, spec);
    }));
  }
  return {placed, missing};
}

/* ------------------------------------------------------------
   breakTime — 破坏时间(挖掘规则的纯计算段, 挖掘硬度修正设计稿 D1)
   速度与掉落是两个正交判定(MC JE 口径, 研究稿 §8 源码 DiggerItem 双判定):
   · 品类对(不看等级) → 工具速度乘数生效 — 哪怕 tier 不够也生效;
   · canHarvest(tier 0, 或品类对且等级够) → ×1.5/×5 系数与掉落门禁。
   t = hard × (canHarvest ? 1.5 : 5) / 速度乘数
   封顶 8s(儿童去绝望感) · 下限 0.15s · tier 不足 → 可挖慢速但 drops:false
   (掉落不触发, 模式层负责提示与图标闪烁)。
   无 hard(null/undefined)= 声明式不可破坏(含 TNT 免疫判据, 下界并入探险
   D5): 直接返回 {time: Infinity, drops: false}, 与工具无关; 消费侧语义
   !isFinite(bt.time) = 不可破坏(替代旧 NaN 意外——NaN 比较恒假只是碰巧
   挖不动, Infinity 是白纸黑字的声明)。
   blockDef 形状对齐 config.js BLOCKS(hard/tool/tier/drop);
   toolStack 为槽形状 {id,n,dur} 或 null=徒手; 手持非工具物品视为徒手。
   ------------------------------------------------------------ */
function breakTime(blockDef, toolStack) {
  if (blockDef.hard == null) return {time: Infinity, drops: false}; // 无 hard = 声明式不可破坏(含 TNT 免疫判据)
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {RECIPES, SMELTS, FUEL, SMELT_T, shapeCost, canCraft, matchGrid,
    gridCraft, fillGrid, fuelUnits, smeltOf, smeltStep, furnaceRefund, breakTime};
}
