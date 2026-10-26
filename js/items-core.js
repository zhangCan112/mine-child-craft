'use strict';
/* ============================================================
   物品核心 (ItemsCore, 术语见 GLOSSARY.md — 词条随 T16 收尾合入) — 引擎层·纯核心
   ------------------------------------------------------------
   物品注册表 ITEMS 是全游戏物品的唯一数据源(材料/放置型/食物/工具四类
   条目, 加物品 = 加一行纯数据); 外加五个无状态纯函数: stackMax 堆叠
   上限 · mkStack 造一摞(工具带满耐久) · isTool 工具判定 · toolOf 工具
   参数查询 · durOf 可耗损物满耐久查询(工具/灯笼, 昼夜 D7 §8.1)。
   icon 为 emoji 占位(正式像素图标归 icons.js 的 itemIcon/T8)。
   零 THREE 零 DOM, 且不依赖 config.js — 放置型的 block 字段存方块 id
   数字, 号段断言在单测, 与方块表的交叉校验归 test/drops.test.js。
   interface: ITEMS · stackMax(id) · mkStack(id, n=1) · isTool(id) · toolOf(id) · durOf(id)
   依赖: 无(纯数据+纯函数; 数值出处 docs/item-crafting-design.md §3.1/§3.5/D9)
   可测性: 零 THREE·零 DOM·有单测(test/items-core.test.js, vm 直测)
   ============================================================ */

/* ------------------------------------------------------------
   ITEMS 物品注册表 — snake_case 键(与 mob-registry.js 的 MOB_TYPES/HeldItems 键同惯例, 设计稿 §2)
   条目形状(设计稿 §3.1 + 昼夜 D7 §8.1):
     name 中文名 · icon emoji 占位 · block 放置型=放置成的方块 id
     · fuel 燃料热值(能烧几件) · food 回血值
     · full 旗标=吃了直接回满血(F3 金苹果, 二期设计稿 §3)
     · dur 满耐久秒数=可耗损物(D7 灯笼: 不可堆叠+mkStack 满耐久, isTool 不动)
     · tool {kind, tier, dmg, dur, speed} 工具五元组(D9 数值表)
   ------------------------------------------------------------ */
const ITEMS = {
  /* —— 木材链(砍树起步) —— */
  log: {name: '原木', icon: '🪵', block: 5, fuel: 1.5}, // 木头(5); 也可烧成木炭
  planks: {name: '木板', icon: '🟫', block: 6, fuel: 1.5}, // 木板(6)
  stick: {name: '木棍', icon: '🥢', fuel: 0.5},
  sapling: {name: '树苗', icon: '🌿', block: 50}, // B_SAPLING=50(T2 落定号段顺延); 放草地/泥土 20s 长成树

  /* —— 矿物链(煤直接用 · 铁/金粗矿需熔炼 · 钻直接得, 设计稿 D5) —— */
  coal: {name: '煤炭', icon: '⚫', fuel: 8},
  charcoal: {name: '木炭', icon: '🌑', fuel: 8}, // 烧原木得; 与煤等效(任选材料)
  iron_ore: {name: '铁矿石', icon: '🟠'}, // 粗矿口径: 需熔炼(研究稿 §2.2)
  iron_ingot: {name: '铁锭', icon: '⬜'},
  iron_nugget: {name: '铁粒', icon: '🔩'}, // 铁锭 1/9 小件(九宫格设计稿 §2 拍板⑤): 灯笼正典材料; 1 铁锭→9 铁粒(hand 1×1)
  gold_ore: {name: '金矿石', icon: '🟡'}, // 粗矿口径: 需熔炼
  gold_ingot: {name: '金锭', icon: '🟨'},
  diamond: {name: '钻石', icon: '💎'},

  /* —— 怪物掉落材料(MOB_DROPS 掷骰产物, 设计稿 §3.3) —— */
  rotten_flesh: {name: '腐肉', icon: '🥓', food: 2}, // 僵尸; 儿童版无饥饿debuff, 回 2 血
  bone: {name: '骨头', icon: '🦴'}, // 骷髅; 磨骨粉
  gunpowder: {name: '火药', icon: '⚪'}, // 苦力怕 → TNT
  string: {name: '线', icon: '🧵'}, // 蜘蛛
  slimeball: {name: '粘液球', icon: '🟢'}, // 岩浆怪(一期备用, 掉落表二期下界)

  /* —— 农耕链(二期开放; 一期先注册, 配方书引用不炸) —— */
  wheat: {name: '小麦', icon: '🌾'},
  wheat_seeds: {name: '小麦种子', icon: '🌱'}, // 一期来源: 打草丛 50%(D7)
  bone_meal: {name: '骨粉', icon: '✨'}, // 催熟二期; 一期配方先注册不点亮

  /* —— 补给包一期件(§3.5): 黏土-红砖链 / 石砖链 / 剪刀 —— */
  clay_ball: {name: '黏土球', icon: '🟤'}, // 黏土方块(49)挖掉得 4 个
  brick: {name: '红砖', icon: '🧱'}, // 烧黏土球得
  bricks: {name: '红砖块', icon: '🏘️', block: 9}, // 4 红砖合成; 既有装饰方块红砖(9)转入合成可得
  stone_bricks: {name: '石砖', icon: '🔲', block: 13}, // 4 石头合成; 既有装饰方块石砖(13)
  shears: {name: '剪刀', icon: '✂️', tool: {kind: 'shears', tier: 0, dmg: 2, dur: 500, speed: 5}}, // 2 铁锭合成; 剪树叶得树叶方块; 数值工程推定(MC 耐久 238×2)

  /* —— 食物(点击吃回血, 政策在模式层) —— */
  apple: {name: '苹果', icon: '🍎', food: 4}, // 树叶 4% 掉(D7)
  bread: {name: '面包', icon: '🍞', food: 8}, // 3 小麦合成(二期农田)
  golden_apple: {name: '金苹果', icon: '🍎', food: 30, full: true}, // 8 金锭+1 苹果合成(金锭出口, 二期设计稿 §3/F3); food 名义值 30=maxHp 锚点, full 旗标=吃了回满血(本游戏无饥饿系统, MC 饥饿+吸收+再生折算成一次回满)

  /* —— 农场链(F4, 二期设计稿 §4.6): 生肉可直接吃(软引导), 熟肉 6~8 落「比生肉好得多」档 —— */
  raw_beef: {name: '生牛肉', icon: '🥩', food: 3}, // 牛; 烧成牛排(镜像 MC 饥饿值, 研究稿 §5)
  cooked_beef: {name: '牛排', icon: '🍖', food: 8},
  raw_porkchop: {name: '生猪排', icon: '🥓', food: 3}, // 猪; 烧成熟猪排
  cooked_porkchop: {name: '熟猪排', icon: '🍖', food: 8},
  raw_chicken: {name: '生鸡肉', icon: '🍗', food: 2}, // 鸡; MC 生鸡中毒 debuff → 儿童版无(回 2 血)
  cooked_chicken: {name: '熟鸡肉', icon: '🍗', food: 6},
  raw_mutton: {name: '生羊肉', icon: '🍖', food: 2}, // 羊; 烧成熟羊肉
  cooked_mutton: {name: '熟羊肉', icon: '🍖', food: 6},
  leather: {name: '皮革', icon: '🟤'}, // 收集品(出口三期护甲, Out of Scope)
  feather: {name: '羽毛', icon: '🪶'}, // 收集品(出口三期箭, Out of Scope)
  wool: {name: '羊毛', icon: '☁️', block: 52}, // B_WOOL=52(F4 §4.7); 羊掉毛转入采集, 只开白羊毛(染料 Out of Scope)

  /* —— 放置型方块物品(挖掘获得, 可放回世界) —— */
  dirt: {name: '泥土', icon: '🟫', block: 2},
  sand: {name: '沙子', icon: '🟨', block: 8}, // 湖边/矿坑; 烧成玻璃
  cobble: {name: '圆石', icon: '🪨', block: 4}, // 挖石头得; 烧回石头
  stone: {name: '石头', icon: '⬜', block: 3}, // 烧圆石得(研究稿 §5.3)
  glass: {name: '玻璃', icon: '🔷', block: 18}, // 烧沙子得
  mossy_cobble: {name: '苔石', icon: '🟩', block: 14}, // 矿洞/遗迹自然生成(§3.5 由装饰转直接采集); 键名与 config 掉落表一致
  leaves: {name: '树叶', icon: '🍃', block: 7}, // 剪刀剪树叶得(MC 口径, §3.5)

  /* —— 站点件与功能件(放置后走近 4 格解锁, 拍板④) —— */
  torch: {name: '火把', icon: '🔥', block: 48}, // 附录 A: B_TORCH(48)
  craft_table: {name: '工作台', icon: '🛠️', block: 46}, // 附录 A: B_CRAFT(46); 解锁 table 级配方
  furnace: {name: '熔炉', icon: '♨️', block: 47}, // 附录 A: B_FURNACE(47); 烧炼站点
  chest: {name: '箱子', icon: '📦', block: 51}, // B_CHEST(51); 只储物不解锁配方(合成仍要工作台); 8 木板合成(引导链 v2)
  bed: {name: '床', icon: '🛏️', block: 53}, // B_BED(53, 昼夜 D6 §7.1); 夜里点击睡觉跳夜+设床边出生点(政策在模式层)
  lantern: {name: '灯笼', icon: '🏮', dur: 300}, // 原创手持光源(昼夜 D7 §8.1, 拍板⑤): dur=可耗损物满耐久 300 秒; 天黑手持才亮才耗(政策在模式层)
  tnt: {name: 'TNT', icon: '🧨', block: 20}, // 既有 B_TNT(config.js); 5 火药+4 沙合成

  /* —— 二期占位(§3.2 配方书全表引用 bow_item, 一期卡片不点亮) —— */
  bow_item: {name: '弓', icon: '🏹'},

  /* —— 工具 16 条 = 4 阶(木/石/铁/钻) × 镐/斧/剑/锹(D9 数值表, 逐格有单测断言) ——
     键名与手持物注册表 defs 同名(T4 mkToolDef 生成观感), Avatar.setItem 直用;
     耐久 ≈ MC×2(拍板③) · 速度照搬 MC · dmg 对齐「hp≈原版×1.5」折算惯例 · tier=挖掘等级 */
  pick_wood: {name: '木镐', icon: '⛏️', tool: {kind: 'pick', tier: 1, dmg: 3, dur: 120, speed: 2}},
  pick_stone: {name: '石镐', icon: '⛏️', tool: {kind: 'pick', tier: 2, dmg: 4, dur: 260, speed: 4}},
  pick_iron: {name: '铁镐', icon: '⛏️', tool: {kind: 'pick', tier: 3, dmg: 6, dur: 500, speed: 6}},
  pick_diamond: {name: '钻石镐', icon: '⛏️', tool: {kind: 'pick', tier: 4, dmg: 8, dur: 1500, speed: 8}},
  axe_wood: {name: '木斧', icon: '🪓', tool: {kind: 'axe', tier: 1, dmg: 5, dur: 120, speed: 2}},
  axe_stone: {name: '石斧', icon: '🪓', tool: {kind: 'axe', tier: 2, dmg: 6, dur: 260, speed: 4}},
  axe_iron: {name: '铁斧', icon: '🪓', tool: {kind: 'axe', tier: 3, dmg: 8, dur: 500, speed: 6}},
  axe_diamond: {name: '钻石斧', icon: '🪓', tool: {kind: 'axe', tier: 4, dmg: 10, dur: 1500, speed: 8}},
  sword_wood: {name: '木剑', icon: '🗡️', tool: {kind: 'sword', tier: 1, dmg: 7, dur: 120, speed: 2}},
  sword_stone: {name: '石剑', icon: '🗡️', tool: {kind: 'sword', tier: 2, dmg: 9, dur: 260, speed: 4}},
  sword_iron: {name: '铁剑', icon: '🗡️', tool: {kind: 'sword', tier: 3, dmg: 11, dur: 500, speed: 6}},
  sword_diamond: {name: '钻石剑', icon: '🗡️', tool: {kind: 'sword', tier: 4, dmg: 13, dur: 1500, speed: 8}},
  shovel_wood: {name: '木锹', icon: '🥄', tool: {kind: 'shovel', tier: 1, dmg: 2, dur: 120, speed: 2}},
  shovel_stone: {name: '石锹', icon: '🥄', tool: {kind: 'shovel', tier: 2, dmg: 3, dur: 260, speed: 4}},
  shovel_iron: {name: '铁锹', icon: '🥄', tool: {kind: 'shovel', tier: 3, dmg: 4, dur: 500, speed: 6}},
  shovel_diamond: {name: '钻石锹', icon: '🥄', tool: {kind: 'shovel', tier: 4, dmg: 5, dur: 1500, speed: 8}},
};

/* ------------------------------------------------------------
   纯函数 — 无状态; 背包核心/合成核心/掉落物实体库与模式层共用
   ------------------------------------------------------------ */

/* 堆叠上限(设计稿 §2: 64/1 两档, 不设 16 档): 可耗损物(工具含剪刀/
   D7 灯笼, durOf>0) 1 · 已注册材料 64 · 未注册 0(=拒收, 入包门禁供背包核心判断) */
function stackMax(id) {
  const it = ITEMS[id];
  return it ? (durOf(id) > 0 ? 1 : 64) : 0;
}

/* 造一摞: 未注册返回 null; n 钳制进 [1, 上限]; 可耗损物(工具/D7 灯笼)
   附带满耐久 dur(槽形状 {id, n, dur} 见设计稿 D10; 耐久扣减与归零消失
   的政策在模式层) */
function mkStack(id, n) {
  const max = stackMax(id);
  if (!max) return null;
  const stack = {id, n: Math.max(1, Math.min(n || 1, max))};
  const dur = durOf(id);
  if (dur > 0) stack.dur = dur;
  return stack;
}

/* 工具判定: 注册条目带 tool 字段即工具(镐斧剑锹四阶 + 剪刀) */
function isTool(id) {
  return !!(ITEMS[id] && ITEMS[id].tool);
}

/* 工具参数查询: 返回 {kind, tier, dmg, dur, speed}; 非工具/未注册返回 null */
function toolOf(id) {
  return (ITEMS[id] && ITEMS[id].tool) || null;
}

/* 可耗损物满耐久查询(昼夜 D7 §8.1): 工具取 tool.dur, 带 dur 字段的
   耗损物(灯笼)取 dur, 其余/未注册返回 0 — 「可扣耐久」与「不可堆叠」
   两判定的单一权威; isTool 语义不动(灯笼不挖不砍, 无工具五元组) */
function durOf(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  if (it.tool) return it.tool.dur;
  return typeof it.dur === 'number' ? it.dur : 0;
}
