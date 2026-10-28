'use strict';
/* ============================================================
   物品使用动作注册表 (ItemUseRegistry, 术语见 GLOSSARY.md「使用动作注册表」) — 应用层·清单注册表
   ------------------------------------------------------------
   「手持特殊物品时, 右键使用档/触屏专用键做什么」的稀疏清单唯一权威:
   只收有专属使用动作的物品(弓=射箭); 普通物品(工具/食物/放置型/材料)
   不进表——吃/放/挖的分派仍在模式使用链与 mkMainAct 手持感知。
   表只有数据(act 执行键/icon 按钮图标键/label 无障碍名), 行为不进
   注册表: act 键由模式层绑定执行器(「战斗政策在模式层」红线, 手持物
   注册表词条同款口径)。
   interface: itemUses(itemId) · ITEM_USES
   依赖(均经全局名, 调用期解析): items-core 的 ITEMS(加载序在前; Node 单测
     同 vm 依序装载, 镜像 item-hint-registry.test.js 惯例)
   可测性: 零 THREE·零 DOM·有单测(test/item-use-registry.test.js)
   ============================================================ */

/* ------------------------------------------------------------
   ITEM_USES — 物品键 → 使用动作条目数组 [{act, icon, label}]:
   · act   执行键(模式层执行器表绑定行为, 注册表不存函数)
   · icon  触屏按钮图标键(走 button-icons 委托表, bow → 弓物品图)
   · label 无障碍名(兼图标缺失时的文案回落)
   稀疏表: 键集 ⊆ ITEMS(单测守门防死键), 不做 ITEMS 全键奇偶校验——
   区别于 item-hint-registry 的全键覆盖(新增普通物品无需动本表)。
   ------------------------------------------------------------ */
const ITEM_USES = {
  bow_item: [{act: 'shoot', icon: 'bow', label: '射箭'}],
  /* 农田链使用档(farm-and-recipe 设计稿 D3): 种子点耕地播种 · 骨粉点麦苗催熟
     ——与弓同款「点击恒算使用 attempt 不落放置」口径 */
  wheat_seeds: [{act: 'plant', icon: 'plant', label: '播种'}],
  bone_meal: [{act: 'ripen', icon: 'ripen', label: '催熟'}],
  /* 大背包使用档(2026-10, docs/bag-and-drop-design.md §2): 手持使用扩容 +6
     主格(一次性; 已扩容时模式层执行器礼貌拒绝不消耗) */
  bag_upgrade: [{act: 'expand_bag', icon: 'bagup', label: '背包扩容'}],
  /* 剪羊毛使用档(2026-10-28): 手持剪刀对准羊使用 = 剪毛不伤羊(温和收获
     口径, F4 牧场延伸); 行为在模式层执行器 act 'shear', 剪毛账/长回政策同 */
  shears: [{act: 'shear', icon: 'shear', label: '剪羊毛'}],
};

/* 物品键 → 使用动作条目; 无专属使用动作返回 null(调用方回落常规使用链) */
function itemUses(itemId) {
  return ITEM_USES[itemId] || null;
}
