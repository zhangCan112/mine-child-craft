'use strict';
/* ============================================================
   配对方块核心 (PairedBlock, 术语见 GLOSSARY.md) — 应用层纯核心
   ------------------------------------------------------------
   「多格共享一命」方块家族（门/床/战利品宝箱）配对破坏的唯一权威：
   任一格被清 → 余格整结构回收、掉落恰一次。行注册表 advPairedBlockRows
   是家族清单唯一权威（conventions §1.10：清单 ≥3 处 + 手滑必炸已发生
   ——TNT 链曾漏接床），破坏编排（place-kit）与每个移除点（蓄力/TNT/
   右键拆）只认一张行表，新配对方块 = 加一行，不再逐移除点接线。
   行契约：plan(read, x, y, z, ctx) → null | {cells, drops}；ctx =
   {id 触发格破坏前方块号, rnd 注入掷骰}。触发格身份门读 config 旗标
   （door/doorLower/bed/lchest，config.js:410 哲学）。
   interface: advPairedBlockRows（行表 {name, plan, hook?}，行序=小箱先
     于大箱 D18）· advDoorBreakPlan/advBedBreakPlan（门/床计划；宝箱
     计划留 adventure-dims-core——副本词汇归家，行表按契约引用）
   依赖(均经全局名, 调用期解析): js/config.js 的 BLOCKS ·
     js/adventure-core.js 的 advIsDoor/advIsDoorLower（门身份旗标判据）·
     js/adventure-dims-core.js 的 advLootChestPlan/advLootChestSmallPlan
     （加载序在本文件之前——行表常量初始化引用）
   可测性: 零 THREE · 零 DOM · 有同名单测（test/paired-block-core.test.js）
   ============================================================ */

/* ---------- 门配对破坏计划（自 adventure-core 迁入, 口径逐字保持） ----------
   MC 口径: 挖任一半=整扇消失、掉 1 扇; 挖门正下方支撑=整扇弹出。壳在世界
   已清格后调用(read 反映挖后状态)。补发口径(2026-11-04 双掉修复): 下半
   自带 drop 表——挖到下半常规掷已掉 1, 计划不补发; 上半无表, 挖到上半才
   由计划补发 1; 挖支撑两半都没掷过表, 计划补发 1。drops=[{id:'door',n}] */
function advDoorBreakPlan(read, x, y, z, ctx) {
  const up = read(x, y + 1, z); const dn = read(x, y - 1, z);
  /* 挖掉门下方块: 下方整扇弹出 */
  if (advIsDoorLower(up)) {
    const cells = [{x, y: y + 1, z}];
    if (read(x, y + 2, z) !== 0) cells.push({x, y: y + 2, z});
    return {cells, drops: [{id: 'door', n: 1}]};
  }
  /* 挖掉的是下半(自带表已常规掷掉): 收上半, 不补发 */
  if (advIsDoor(up) && !advIsDoorLower(up)) {
    return {cells: [{x, y: y + 1, z}], drops: []};
  }
  /* 挖掉的是上半(无表): 连下半整扇回收, 计划补发 1 */
  if (advIsDoorLower(dn)) {
    return {cells: [{x, y: y - 1, z}], drops: [{id: 'door', n: 1}]};
  }
  return null; /* 无门牵连(统一契约: 无匹配= null) */
}

/* ---------- 床配对破坏计划（自 adventure-core 迁入 + 触发格身份门） ----------
   正典形「床头恒在轴向较小坐标端」从世界状态唯一重建, 两床并排同轴相接
   也拆不错邻床。补发口径: 伙伴=床头 → 被挖的是床尾(无 drop 半), 计划补发
   1; 伙伴=床尾 → 被挖的是床头(自带表常规掷), 不双发。
   触发格身份门(2026-11-04 架构评审候选①登记): 正典形校验只挡「沿床轴向」
   的误配——床头/床尾端垂直方向的邻格(如床头板正后方的石头)坐标比较仍会
   假命中; 触发格必须自身是床半(ctx.id 读 bed 旗标), 与 lchest 同哲学。 */
function advBedBreakPlan(read, x, y, z, ctx) {
  const tb = BLOCKS[ctx.id];
  if (!tb || !tb.bed) return null;
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const px = x + d[0]; const pz = z + d[1];
    const nid = read(px, y, pz);
    const nb = BLOCKS[nid];
    if (!nb || !nb.bed) continue;
    const onX = d[0] !== 0; /* 轴向坐标: 床头须严格小于床尾(正典形) */
    const partnerHead = !!nb.bedHead;
    const headAxis = partnerHead ? (onX ? px : pz) : (onX ? x : z);
    const footAxis = partnerHead ? (onX ? x : z) : (onX ? px : pz);
    if (headAxis >= footAxis) continue;
    return {cells: [{x: px, y, z: pz}],
      drops: partnerHead ? [{id: 'bed', n: 1}] : []};
  }
  return null;
}

/* ---------- 家族行注册表（清单唯一权威） ----------
   行序: 小箱先于大箱(id 认主优先于四邻认亲——72 挨着 71 也不误吃大箱,
   D18); 门/床/箱互相几何互斥, 破坏编排逐行全跑安全。hook=行钩名(命中行
   且消费方提供才发; 宝箱探宝 tally 缝 D19, 门/床无钩)。 */
const advPairedBlockRows = [
  {name: 'lootChestSmall', hook: 'onLootChestBreak',
    plan: (read, x, y, z, ctx) => advLootChestSmallPlan(ctx.id, ctx.rnd)},
  {name: 'lootChest', hook: 'onLootChestBreak', plan: advLootChestPlan},
  {name: 'door', plan: advDoorBreakPlan},
  {name: 'bed', plan: advBedBreakPlan},
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {advPairedBlockRows, advDoorBreakPlan, advBedBreakPlan};
}
