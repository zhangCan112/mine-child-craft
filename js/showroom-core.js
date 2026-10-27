'use strict';
/* ============================================================
   体验馆供给核心 (ShowroomCore, 术语见 GLOSSARY.md「体验馆」) — 应用层·纯核心
   ------------------------------------------------------------
   冒险全开实验室(showroom v2)的三份供给派生器: 背包套餐/仓库箱/展台展品。
   单一设计约束=「派生不复制」(docs/showroom-design.md §7 D3): 一切内容
   从权威注册表(ITEMS/RECIPES/SMELTS/FUEL)按字段规则派生, 冒险模式新增
   物品/配方时体验馆零改动自动同步——手抄清单是同步漂移的根源, 本文件
   存在的意义就是让手抄清单消失。
   · showroomPocket(): 背包套餐 = RECIPES 全配方 shapeCost 材料并集
     (候选展开), 每 id 一行 n=stackMax; 超 INV_SLOTS 预算的尾部行溢出
     进 overflow(由消费方并入「套餐补箱」)。同步不变量: 从套餐出发每条
     配方 canCraft(inv, r, true) 全绿(test/showroom-core.test.js 守门)。
   · showroomCrateRows(): 仓库箱 = ITEMS 字段驱动五桶的首中归桶划分:
     工具·耗损(tool‖dur) → 食物(food) → 烧炼·燃料(SMELTS∪fuel) →
     方块·功能(block) → 材料杂物(兜底); 桶内按注册序, 桶满 INV_SLOTS 行
     自动「·续」箱, 空桶不建; 套餐溢出行(若有)并入为首只「套餐补箱」。
   · showroomDisplays(excludeBlockIds): 展台展品 = 有 block 字段的物品
     (注册序), 排除站点件(消费方传入站点方块 id 清单——「哪些方块是
     可交互站点」是模式层政策, 不在核心硬编码)。
   全部输出为纯数据(rows 形状 {id, n} 与 SHOWROOM_STOCK 旧表同形, 箱
   {title, rows}), 无任何状态; 同参同结果(表是静态注册表)。
   interface: showroomPocket · showroomCrateRows · showroomDisplays
   依赖(均经全局名, 调用期解析): js/items-core.js 的 ITEMS/stackMax/
     durOf · js/craft-core.js 的 RECIPES/SMELTS/FUEL/shapeCost ·
     js/inventory-core.js 的 INV_SLOTS(加载序: 三核心在本文件之前)
   可测性: 零 THREE·零 DOM·有单测(test/showroom-core.test.js, vm 直测)
   ============================================================ */

/* ---------- 背包套餐: RECIPES 全配方材料并集 ----------
   「所有条件都满足」的最小充分集: 揣着这包, 冒险里任何配方都能当场合成
   (站点门禁在体验馆面板恒开, 不需材料以外的条件)。遍历按配方登记序
   (稳定且与配方书同序), 候选数组(煤/木炭任选等)逐个展开; 每 id 一行
   n=stackMax(材料 64/可耗损 1, 一行一槽与旧表同形)。 */
function showroomPocket() {
  const seen = new Set();
  const ids = [];
  for (const recipe of RECIPES) {
    for (const [key, val] of Object.entries(shapeCost(recipe))) {
      const e = costEntry(key, val); /* 候选数组+数量(inventory-core 统一形状, canCraft 同款解读) */
      if (!e) continue;
      for (const id of e.cands) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
  }
  const rows = ids.map((id) => ({id, n: stackMax(id)}));
  return {rows: rows.slice(0, INV_SLOTS), overflow: rows.slice(INV_SLOTS)};
}

/* ---------- 仓库箱: ITEMS 字段驱动五桶 ----------
   归桶判据只读注册字段, 不抄物品 id 清单——新物品按它注册时声明的字段
   自动落箱(全无字段落兜底杂物箱), 冒险加物品本函数零改动。桶序即优先级
   (两性物按首个命中桶归单, 保证五桶是全集划分): 原木可烧可放 → 烧炼·燃料
   箱(烧炼对照样摆一起正是它的展陈语义); 生肉可吃可烧 → 食物箱。 */
function showroomCrateRows(pocketOverflow) {
  const isSmeltSide = (id) => typeof SMELTS[id] === 'string' ||
    Object.values(SMELTS).indexOf(id) >= 0;
  const buckets = [
    {title: '工具·耗损箱', match: (it, id) => isTool(id) || durOf(id) > 0},
    {title: '食物箱', match: (it) => typeof it.food === 'number'},
    {title: '烧炼·燃料箱', match: (it, id) => isSmeltSide(id) || typeof it.fuel === 'number'},
    {title: '方块·功能箱', match: (it) => typeof it.block === 'number'},
    {title: '材料杂物箱', match: () => true}, /* 兜底桶恒命中: 划分的封闭性由它保证 */
  ];
  const hits = buckets.map(() => []);
  for (const id of Object.keys(ITEMS)) {
    const it = ITEMS[id];
    for (let b = 0; b < buckets.length; b++) {
      if (buckets[b].match(it, id)) {
        hits[b].push({id, n: stackMax(id)});
        break; /* 首中归单: 一物一箱(划分不变量) */
      }
    }
  }
  const crates = [];
  if (pocketOverflow && pocketOverflow.length) {
    crates.push({title: '套餐补箱', rows: pocketOverflow});
  }
  for (let b = 0; b < buckets.length; b++) {
    for (let i = 0; i < hits[b].length; i += INV_SLOTS) {
      const more = i + INV_SLOTS < hits[b].length || i > 0; /* 续箱(或被续)挂后缀 */
      crates.push({title: buckets[b].title + (more ? '·续' : ''), rows: hits[b].slice(i, i + INV_SLOTS)});
    }
  }
  return crates;
}

/* ---------- 展台展品: 可放置方块各摆一份 ----------
   excludeBlockIds = 站点方块 id 清单(工作台/熔炉/箱子/床——它们作为真
   站点装在场内, 不上展台重复陈列); 返回物品 id 数组(注册序, 消费方经
   ITEMS[id].block 取放置方块号)。 */
function showroomDisplays(excludeBlockIds) {
  const skip = excludeBlockIds || [];
  return Object.keys(ITEMS).filter((id) => {
    const b = ITEMS[id].block;
    return typeof b === 'number' && skip.indexOf(b) < 0;
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {showroomPocket, showroomCrateRows, showroomDisplays};
}
