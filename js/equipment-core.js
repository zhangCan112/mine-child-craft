'use strict';
/* ============================================================
   装备核心 (EquipmentCore, 术语见 GLOSSARY.md「装备核心」) — 引擎层·纯核心
   ------------------------------------------------------------
   穿戴槽模型与减伤公式的纯函数唯一权威: EQUIP_SLOTS 四槽表 · mkWorn 空
   穿戴 · wornPut 换装(旧件带耐久原样换出, 非盔甲/槽不符拒收) ·
   armorPoints 穿戴合计盔甲点 · armorReduce 正典减伤公式(D7, 逐字照搬
   minecraft.wiki Armor#Damage_reduction, 权威 docs/equipment-design.md
   §3 与 mc-equipment-research.md) · kbResist 穿戴合计击退抗性(封顶 0.8)
   · wornWear 命中磨损(归零件入 broke 清单) · wornNormalize 存档归一
   (老档/坏档/半形状幂等兜底)。worn 形状 {helmet: {id, dur}|null, ...}:
   穿戴件不可堆叠, 槽对象省 n 字段(与背包槽形 {id,n,dur} 兼容)。
   零 THREE 零 DOM; armor 判据单份在 items-core(armorOf), 本文件只读
   不复制。数值表 docs/equipment-design.md §3(正典 → 儿童折算)。
   interface: EQUIP_SLOTS · mkWorn() · wornPut(worn, slot, stack) → {worn, out}
            · armorPoints(worn) · armorReduce(dmg, pts, tough)
            · kbResist(worn) · wornWear(worn, n=1) → {worn, broke:[slot...]}
            · wornNormalize(raw)
   依赖(均经全局名, 调用期解析): js/items-core.js 的 ITEMS/armorOf
     (加载序必须在 items-core 之后)
   可测性: 零 THREE·零 DOM·有单测(test/equipment-core.test.js, vm 直测)
   ============================================================ */

/* 四槽表: 键名照 MC Equipmentslot 口径(snake_case 与 ITEMS 键同惯例);
   顺序即装备条 UI 展示序(头/胸/腿/靴) */
const EQUIP_SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'];

/* 空穿戴模型: 四槽全 null(老档缺键的归一起点; encode 侧原样四键全出) */
function mkWorn() {
  return {helmet: null, chestplate: null, leggings: null, boots: null};
}

/* 合计遍历(armorPoints/toughPoints/kbResist 三函数共用): 逐槽经 armorOf
   读盔甲五元组(判据单份在 items-core, 本文件只读不复制), 空槽/坏件(id
   未注册)跳过记 0——全量校验归 wornNormalize, 合计只管数。key=求和字段;
   cap 非空时对合计封顶(kbResist 专用, pts/tough 不封)。合计圆整 1e-5
   (armorReduce 同款数值卫生——0.1×3 的浮点尾差不外漏)。 */
function sumArmor(worn, key, cap) {
  let sum = 0;
  for (const s of EQUIP_SLOTS) {
    const piece = worn && worn[s];
    const a = piece && armorOf(piece.id);
    if (a) sum += a[key] || 0;
  }
  sum = Math.round(sum * 1e5) / 1e5;
  return cap == null ? sum : Math.min(cap, sum);
}

/* 穿戴合计盔甲点(0~20): armorReduce 的 armor 入参取数口(设计稿 §6),
   供 hurtPlayer 等战斗路径组装 — 模式层不手搓第二遍遍历 */
function armorPoints(worn) {
  return sumArmor(worn, 'pts');
}

/* 穿戴合计韧性: armorReduce 的 tough 入参取数口(与 armorPoints 同口径,
   仅钻 2/件·下界 3/件) */
function toughPoints(worn) {
  return sumArmor(worn, 'tough');
}

/* 穿戴合计击退抗性: 返回 min(0.8, Σkb) 的抗性值 r, 调用方做
   kpow × (1 − r)。kb 仅下界合金 0.1/件 → 真装备上限 0.4(下界全套);
   0.8 cap 是防御性不变量(真数据到不了, 超额假数据/未来扩展兜底)。 */
function kbResist(worn) {
  return sumArmor(worn, 'kb', 0.8);
}

/* 正典减伤公式(docs/mc-equipment-research.md Armor §Damage reduction 逐字):
   dmg × (1 − min(20, max(armor/5, armor − dmg/(2+tough/4))) / 25)
   armor=穿戴合计盔甲点(封顶 20 口径由 min 项承载), tough=穿戴合计韧性。
   返回圆整到 1e-5 的伤害值(breakTime 10μs 圆整同款数值卫生——
   0.23×3 的浮点尾差不外漏给消费方); 空穿 armor=0 → 原样返回。 */
function armorReduce(dmg, armor, tough) {
  const inner = armor - dmg / (2 + (tough || 0) / 4);
  const cut = Math.min(20, Math.max(armor / 5, inner)) / 25;
  return Math.round((dmg * (1 - cut)) * 1e5) / 1e5;
}

/* 命中磨损: 每件在穿盔甲 dur − n(缺省 1, 战斗命中一次磨一件), 扣到 ≤0
   即破碎——槽清空且 slot 入 broke 清单(模式层据此做破碎仪式: 音/toast/
   手持同步; 归零消失=工具同款口径)。纯函数: 不改入参, 缺槽跳过,
   不读注册表(id 只是随件数据——注册校验归 wornNormalize)。 */
function wornWear(worn, n) {
  const step = n || 1;
  const out = {};
  const broke = [];
  for (const s of EQUIP_SLOTS) {
    const piece = worn[s];
    if (!piece) {
      out[s] = null;
      continue;
    }
    const dur = piece.dur - step;
    if (dur > 0) out[s] = {id: piece.id, dur};
    else {
      out[s] = null;
      broke.push(s);
    }
  }
  return {worn: out, broke};
}

/* 换装(wornPut): 栈形 {id, n, dur} 穿入 slot — 穿戴件不可堆叠, 存槽形
   {id, dur}(n 剥弃), dur 缺省=满耐久(durOf 兜底手工栈形)。被换下旧件
   原样从 out 交还(模式层回包入背包, 满包拒绝是模式政策, 本函数只管换)。
   槽不符/非盔甲/坏槽名 → {worn 原样, out: null}(防手滑不抛——存档侧另有
   wornNormalize 全量兜底)。纯函数: 入参不动, 返回全新 worn。
   判据经全局名读 items-core 的 armorOf/durOf(加载序在前)。 */
function wornPut(worn, slot, stack) {
  const a = armorOf(stack && stack.id);
  const ok = EQUIP_SLOTS.includes(slot) && !!a && a.slot === slot;
  const wornOut = {};
  let swapped = null;
  for (const s of EQUIP_SLOTS) {
    if (ok && s === slot) {
      swapped = worn[s] || null;
      const dur = (typeof stack.dur === 'number' && stack.dur > 0) ?
        stack.dur : durOf(stack.id);
      wornOut[s] = {id: stack.id, dur};
    } else {
      wornOut[s] = worn[s] || null;
    }
  }
  return {worn: wornOut, out: swapped};
}

/* 存档归一(wornNormalize): 存档读取侧的全量兜底 — 缺键补 null(老档半形状
   归全), 坏件逐条丢弃(未注册/非盔甲/槽不符/dur 非正数), 多余键不带走,
   输出恒为 mkWorn 形状(四键全在, 消费方零判空)。与 wornPut 的交互路径
   政策不同勿混: 这里不修复 dur——存档里 dur 缺失=档案坏件, 宁丢弃不脑补
   (满耐久兜底只在穿入侧 wornPut 做)。幂等: normalize 两次=一次(存档往返
   安全)。垃圾入参(null/标量)防炸返回空穿——存档容错的最后一道。
   纯函数: 入参不动。 */
function wornNormalize(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const out = {};
  for (const s of EQUIP_SLOTS) {
    const piece = src[s];
    const a = (piece && typeof piece === 'object') ? armorOf(piece.id) : null;
    const ok = !!a && a.slot === s &&
      typeof piece.dur === 'number' && Number.isFinite(piece.dur) && piece.dur > 0;
    out[s] = ok ? {id: piece.id, dur: piece.dur} : null;
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EQUIP_SLOTS, mkWorn, armorPoints, toughPoints, armorReduce, kbResist,
    wornWear, wornPut, wornNormalize};
}
