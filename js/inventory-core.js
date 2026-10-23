'use strict';
/* ============================================================
   Inventory Core (背包核心, 术语见 GLOSSARY.md — 词条随 T16 收尾合入) — 引擎层·纯核心
   ------------------------------------------------------------
   27 槽背包模型(9 快捷 + 18 主格, 设计稿 D10)与全部背包规则:
   入包并堆/拒收、跨槽计数、按 cost 扣料(含任选材料)、槽级移除、
   工具耐久扣减、存档往返。模式层只拿这里的函数拼玩法(吃/放/合成/
   掉落拾取), 耐久归零后的「消失+安抚」政策在模式层(D4/D9)。
   零 THREE 零 DOM, 只依赖 items-core 的注册表门禁(stackMax=0 即拒收)。
   interface: mkInventory · add · count · canAfford · take · remove ·
              damageTool · serialize · deserialize ·
              常量 HOTBAR_SLOTS/MAIN_SLOTS/INV_SLOTS
   依赖(均经全局名, 调用期解析): js/items-core.js 的 stackMax/mkStack/
     ITEMS(加载序: items-core 先于本文件)
   可测性: 零 THREE·零 DOM·有单测(test/inventory-core.test.js, vm 直测)
   ============================================================ */

/* 槽位划分(设计稿 D10): 槽 0~8 快捷栏(hotbar 直显) · 槽 9~26 主格(背包面板 3×6) */
const HOTBAR_SLOTS = 9;
const MAIN_SLOTS = 18;
const INV_SLOTS = HOTBAR_SLOTS + MAIN_SLOTS;

/* 造空背包: 27 个空槽(null); 槽形状 {id, n, dur} 与 mkStack 产出的标准形状一致 */
function mkInventory() {
  return {slots: new Array(INV_SLOTS).fill(null)};
}

/* ------------------------------------------------------------
   入包: 并堆优先 → 首个空位 → 满则拒收
   返回放不下的余量(0 = 全部收下); 未注册物品(stackMax=0)整批拒收。
   工具上限 1 天然不并堆, 直接各占空位并携带满耐久(mkStack)。
   ------------------------------------------------------------ */
function add(inv, id, n) {
  const want = n || 1;
  const max = stackMax(id);
  if (!max) return want; // 未注册 = 拒收门禁(items-core)
  let left = want;
  if (max > 1) { // 并堆阶段: 只往同 id 的未满堆里补
    for (const s of inv.slots) {
      if (left <= 0) break;
      if (s && s.id === id && s.n < max) {
        const put = Math.min(left, max - s.n);
        s.n += put;
        left -= put;
      }
    }
  }
  for (let i = 0; i < INV_SLOTS && left > 0; i++) { // 空位阶段: 每格一整堆
    if (!inv.slots[i]) {
      const st = mkStack(id, left); // n 钳制进 [1, max]; 工具附满耐久
      inv.slots[i] = st;
      left -= st.n;
    }
  }
  return left; // 余量(满包/未注册时 = 放不下的数量)
}

/* ------------------------------------------------------------
   计数与计费(设计稿 §3.2): cost 的值有两种形态, 判定逻辑统一为
   「候选数组 + 数量」——
     {log: 1}                          → 单候选 [log] × 1
     {fuel: [['coal','charcoal'], 1]}  → 任选其一, 候选合计 ≥ 1(键名仅占位)
   ------------------------------------------------------------ */

/* cost 值 → {cands: 候选 id 数组, n: 需求数}; 形状不合法返回 null */
function costEntry(key, val) {
  if (typeof val === 'number') return {cands: [key], n: val};
  if (Array.isArray(val) && Array.isArray(val[0])) return {cands: val[0], n: val[1] || 0};
  return null;
}

/* 跨槽合计某物品的持有数 */
function count(inv, id) {
  let sum = 0;
  for (const s of inv.slots) if (s && s.id === id) sum += s.n;
  return sum;
}

/* 计费判定: 每个 cost 项的候选合计都 ≥ 需求才 true; 只查不扣 */
function canAfford(inv, cost) {
  for (const key of Object.keys(cost)) {
    const e = costEntry(key, cost[key]);
    if (!e || e.n < 0) return false;
    let sum = 0;
    for (const c of e.cands) sum += count(inv, c);
    if (sum < e.n) return false;
  }
  return true;
}

/* ------------------------------------------------------------
   扣料: 先整单验费(canAfford), 不足则整体不动返回 false;
   足则逐项扣——同物品多堆从前向后拆(打满 64 的堆先清), 任选
   材料按候选数组顺序优先扣(先扣光 coal 再动 charcoal)。
   ------------------------------------------------------------ */
function take(inv, cost) {
  if (!canAfford(inv, cost)) return false;
  for (const key of Object.keys(cost)) {
    const e = costEntry(key, cost[key]);
    let left = e.n;
    for (const cand of e.cands) { // 候选顺序 = 扣料优先级
      for (let i = 0; i < INV_SLOTS && left > 0; i++) {
        const s = inv.slots[i];
        if (s && s.id === cand && s.n > 0) {
          const got = Math.min(left, s.n);
          s.n -= got;
          left -= got;
          if (s.n <= 0) inv.slots[i] = null; // 扣空 → 清槽
        }
      }
      if (left <= 0) break;
    }
  }
  return true;
}

/* ------------------------------------------------------------
   槽级移除: UI 拖拽/丢弃/吃一口/耐久归零清槽的公共底座。
   n 省略 = 整槽; 请求超量按整槽钳制; 返回被移除堆的拷贝(与
   背包内对象脱钩, 调用方可直接喂 add 挪位); 空槽返回 null。
   ------------------------------------------------------------ */
function remove(inv, slot, n) {
  const s = inv.slots[slot];
  if (!s) return null;
  const got = (n == null) ? s.n : Math.min(n, s.n);
  const out = {id: s.id, n: got};
  if (s.dur != null) out.dur = s.dur; // 工具堆连带耐久
  s.n -= got;
  if (s.n <= 0) inv.slots[slot] = null;
  return out;
}

/* ------------------------------------------------------------
   工具耐久扣减(耐久政策在本层, D10): 槽内工具 dur-1, 返回剩余
   耐久;返回 0 = 破板信号——「归零消失 + 安抚话术」归模式层(D4/D9),
   本函数不清槽; 非工具槽/空槽返回 null 且不动包。已归零的工具
   重复敲不产生负耐久(钳在 0, 信号持续为 0)。
   ------------------------------------------------------------ */
function damageTool(inv, slot) {
  const s = inv.slots[slot];
  if (!s || !isTool(s.id)) return null;
  s.dur = Math.max(0, (s.dur || 0) - 1);
  return s.dur;
}

/* ------------------------------------------------------------
   存档往返(设计稿 D12: inventory_save 形状 {slots:[{id,n,dur}|
   null ×27], _v:1})。serialize 产深拷贝(存档与背包不共享引用);
   deserialize 损坏回落——整包结构非法回落空包, 单槽非法(未注册/
   缺 id/数量越界)只殃及该槽置 null, 合法槽数量钳回堆叠上限。
   版本断言/写盘归 T11 的 mkSaveSlot 接线, 本层只管形状。
   ------------------------------------------------------------ */
function serialize(inv) {
  const slots = inv.slots.map((s) => (s ? {...s} : null)); // 逐槽深拷贝(槽形状一层)
  return {_v: 1, slots};
}

function deserialize(save) {
  const inv = mkInventory();
  if (!save || typeof save !== 'object' || !Array.isArray(save.slots) ||
      save.slots.length !== INV_SLOTS) return inv; // 整包损坏 → 空包
  for (let i = 0; i < INV_SLOTS; i++) {
    const s = save.slots[i];
    const max = s && typeof s === 'object' && typeof s.id === 'string' ? stackMax(s.id) : 0;
    if (!max || typeof s.n !== 'number' || s.n < 1) continue; // 单槽非法 → 留 null
    const st = {id: s.id, n: Math.min(Math.floor(s.n), max)}; // 数量钳回堆叠上限
    if (isTool(s.id) && typeof s.dur === 'number') st.dur = Math.max(0, s.dur);
    inv.slots[i] = st;
  }
  return inv;
}
