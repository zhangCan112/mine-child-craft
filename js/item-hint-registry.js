'use strict';
/* ============================================================
   物品提示注册表 (ItemHintRegistry, 术语见 GLOSSARY.md「物品提示」) — 应用层·清单注册表
   ------------------------------------------------------------
   全游戏「这个物品是什么」儿童提示语清单的唯一权威: 点到什么读什么
   (语音+气泡) 的话术数据与解析纯函数。名字的唯一权威在物品核心(ITEMS)
   与方块表(BLOCKS)——本表只补一句儿童说明, 不复述名字; tts 拼装口径
   (有说明 = 名字+'，'+说明) 收在此处, 消费方不做第二份实现。
   空槽不报(item 型 cnt()≤0 = 没东西可介绍); icon 型槽名字即说明。
   interface: hintForItem(id) · hintForSlot(slot) · ITEM_HINTS · BLOCK_HINTS
   依赖(均经全局名, 调用期解析): items-core 的 ITEMS · config 的 BLOCKS
     (加载序在前; Node 单测同 vm 依序装载, 镜像 drops.test.js 惯例)
   可测性: 零 THREE·零 DOM·有单测(test/item-hint-registry.test.js)
   ============================================================ */

/* ------------------------------------------------------------
   ITEM_HINTS — 物品键 → 一句儿童说明(≤16 字, 只讲是什么/干什么用,
   不念数值; 话术口径见 docs/item-hint-design.md §4)。键集必须与
   ITEMS 全键一致(单测守门: 新增物品忘写提示即红)。
   ------------------------------------------------------------ */
const ITEM_HINTS = {
  /* —— 木材链 —— */
  log: '砍大树得到的木头，能烧火',
  planks: '原木锯成的板子，用处可多啦',
  stick: '细细的小棍子，做工具要用',
  sapling: '种在泥土上，会长成大树',

  /* —— 矿物链 —— */
  coal: '黑亮亮的，生火最棒',
  charcoal: '烧原木得到的，和煤一样棒',
  iron_ore: '放进熔炉烧一烧，变铁锭',
  iron_ingot: '结实的铁，能做好多工具',
  gold_ore: '金色的矿石，烧出金锭',
  gold_ingot: '黄澄澄的金子，能做金苹果',
  diamond: '亮晶晶的宝贝，能做最棒的工具',

  /* —— 怪物掉落材料 —— */
  rotten_flesh: '僵尸掉的小肉，饿了能吃',
  bone: '骷髅留下的白骨头',
  gunpowder: '做TNT的粉末，轰的一声',
  string: '蜘蛛吐的细丝线',
  slimeball: '软软弹弹的小球球',

  /* —— 农耕链 —— */
  wheat: '金黄的麦子，能做面包',
  wheat_seeds: '种在地里，长出小麦',
  bone_meal: '撒一撒，小苗长得快',

  /* —— 补给包件 —— */
  clay_ball: '河边挖的泥球，烧成红砖',
  brick: '烧好的小红砖，砌墙用',
  bricks: '红红的砖墙，真漂亮',
  stone_bricks: '切得整整齐齐的石砖',
  shears: '咔嚓咔嚓，剪树叶的剪刀',

  /* —— 食物 —— */
  apple: '香香甜甜，吃了能回血',
  bread: '小麦烤的面包，香喷喷',
  golden_apple: '金色的苹果，吃了血全满',

  /* —— 农场链 —— */
  raw_beef: '牛肉，烧熟了更好吃',
  cooked_beef: '香喷喷的牛排，快吃吧',
  raw_porkchop: '猪肉，烧熟了更好吃',
  cooked_porkchop: '烤熟的猪排，香香的',
  raw_chicken: '鸡肉，烧熟了更好吃',
  cooked_chicken: '烤得金黄的鸡肉，真香',
  raw_mutton: '羊肉，烧熟了更好吃',
  cooked_mutton: '烤好的羊肉，吃了回血',
  leather: '软软的皮子，做衣服用',
  feather: '轻轻的羽毛，飘啊飘',
  wool: '软软的羊毛，白白的',

  /* —— 放置型方块物品 —— */
  dirt: '松软的土，能种树苗',
  sand: '细细的，能烧成玻璃',
  cobble: '挖石头掉下来的碎石',
  stone: '烧圆石得到的平整石头',
  glass: '透明的，能看见外面',
  mossy_cobble: '长了绿苔的旧石头',
  leaves: '树上剪下来的，绿绿的',

  /* —— 站点件与功能件 —— */
  torch: '一点就亮，照亮黑黑的地方',
  craft_table: '站在旁边，能做更多东西',
  furnace: '轰隆隆，把矿石烧成锭',
  chest: '把宝贝存进大箱子',
  tnt: '轰！点着了快跑远一点',

  /* —— 昼夜件(昼夜 D6/D7 合入补写: 守门断言 ITEMS 全键覆盖) —— */
  bed: '夜里睡一觉，一下就天亮',
  lantern: '天黑提着它，照亮前面的路',

  /* —— 二期占位 —— */
  bow_item: '嗖嗖射箭的远程武器',

  /* —— 工具 16 条 = 4 阶 × 镐/斧/剑/锹(镐讲能挖到什么——挖矿门槛是任务链卡点) —— */
  pick_wood: '能挖石头的木头镐',
  pick_stone: '更硬啦，能挖铁矿石',
  pick_iron: '硬邦邦，能挖到钻石',
  pick_diamond: '最棒的镐子，什么都挖得动',
  axe_wood: '砍树更快的小斧头',
  axe_stone: '砍树更快的石斧头',
  axe_iron: '锋利的铁斧，砍树飞快',
  axe_diamond: '最棒的斧头，砍树超快',
  sword_wood: '打怪用的小木剑',
  sword_stone: '石头剑，更厉害一点',
  sword_iron: '锋利的铁剑，真厉害',
  sword_diamond: '最厉害的剑，闪闪发光',
  shovel_wood: '挖土和沙子的小铲子',
  shovel_stone: '挖土更快的石铲子',
  shovel_iron: '挖土飞快的铁铲子',
  shovel_diamond: '最棒的铲子，挖土超快',
};

/* ------------------------------------------------------------
   BLOCK_HINTS — 方块 id → 一句儿童说明(建造/竞技场调色板全号段
   1~19, 单测对消费端断言; 名字唯一权威在 BLOCKS, 未收录回落名字-only)
   ------------------------------------------------------------ */
const BLOCK_HINTS = {
  1: '长着绿草的泥土', // 草地
  2: '松软的土，能种树苗', // 泥土
  3: '结结实实的灰石头', // 石头
  4: '挖石头掉下来的碎石', // 圆石
  5: '大树的主干，能盖房子', // 木头
  6: '原木锯成的板子', // 木板
  7: '绿绿的树叶', // 树叶
  8: '松松软软的细沙', // 沙子
  9: '红红的砖头', // 红砖
  10: '坦克身上硬硬的壳', // 装甲
  11: '坦克用来走路的带子', // 履带
  12: '亮亮的金属块', // 金属
  13: '切得整整齐齐的石砖', // 石砖
  14: '长了绿苔的旧石头', // 苔石
  15: '蓝蓝的软羊毛', // 蓝羊毛
  16: '红红的软羊毛', // 红羊毛
  17: '白白的石英石', // 石英
  18: '透明的，能看见外面', // 玻璃
  19: '亮亮的，一放就发光', // 灯块
};

/* ------------------------------------------------------------
   解析纯函数 — mode-kit 五个触发点共用(点到什么读什么)
   返回形状: {name, desc, tts} | null(null = 静默: 空槽/未注册)
   ------------------------------------------------------------ */

/* 物品键 → 提示; 未注册/空键返回 null */
function hintForItem(id) {
  const it = ITEMS[id];
  if (!it) return null;
  const desc = ITEM_HINTS[id] || '';
  return {name: it.name, desc, tts: desc ? it.name + '，' + desc : it.name};
}

/* 方块 id → 提示(名字取方块表, 说明缺省回落名字-only) */
function hintForBlock(id) {
  const b = (typeof BLOCKS !== 'undefined') ? BLOCKS[id] : null;
  if (!b) return null;
  const desc = BLOCK_HINTS[id] || '';
  return {name: b.name, desc, tts: desc ? b.name + '，' + desc : b.name};
}

/* mkHotbar 槽描述符三分支: {item} | {block} | {icon,lbl} —— 空槽静默 */
function hintForSlot(it) {
  if (!it) return null;
  if (it.item !== undefined) {
    if (!it.item) return null; /* 空槽位(探险初始 '') */
    if (it.cnt && it.cnt() <= 0) return null; /* 数量归零: 没东西可介绍 */
    return hintForItem(it.item);
  }
  if (it.block !== undefined) return hintForBlock(it.block);
  return it.lbl ? {name: it.lbl, desc: '', tts: it.lbl} : null; /* icon 型: 名字即说明 */
}
