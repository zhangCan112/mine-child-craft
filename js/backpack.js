'use strict';
/* ============================================================
   背包壳 (Backpack) — 应用层
   ------------------------------------------------------------
   全游戏唯一背包存档 inventory_save 的持有者(ADR 0002: 专注训练营
   接入物品系统后, 该键从「探险模式私有」升格为跨模式共享背包, 未来
   消费方——探险/建造生存开关等——必须经本壳, 不得自开存档键)。
   薄壳: 只做 mkSaveSlot+SyncDB 装配与 load/save 生命周期; 背包规则
   (堆叠/扣料/耐久/序列化形状)全部归背包核心 inventory-core, 本壳
   不复制任何一条。
   interface: mkBackpack() → {inv(27 槽本体, 引用跨 load 稳定) ·
     load(原地换槽, 消费方闭包不脱钩) · save}
   依赖(均经全局名, 调用期解析): inventory-core 的 mkInventory/
     serialize/deserialize/INV_SLOTS · sync.js 的 SyncDB.slot
     (加载序: 两文件在 index.html 均先于本文件)
   可测性: 零 THREE·零 DOM, Node 单测注入假 SyncDB(test/backpack.test.js)
   ============================================================ */

/* 存档键: 全游戏唯一, 字面量只允许出现在本文件(ADR 0002「唯一持有」的守门判据) */
const BACKPACK_KEY = 'inventory_save';

function mkBackpack() {
  const inv = mkInventory();
  const slot = SyncDB.slot(BACKPACK_KEY, {
    defaults: {slots: new Array(INV_SLOTS).fill(null)},
    encode: (i) => serialize(i), /* T5 形状 {_v:1, slots} 直产 */
    decode: (sv) => deserialize(sv), /* 损坏回落空包(inventory-core 口径) */
  });
  return {
    inv, /* 背包本体: 消费方经 inventory-core 接口读写, 规则不在本壳 */
    load() {
      inv.slots = slot.load().slots; /* 原地换槽(空档回落 defaults 的 27 空槽数组) */
      return inv;
    },
    save() {
      slot.save(inv);
    },
  };
}

const Backpack = {mkBackpack};
if (typeof module !== 'undefined' && module.exports) module.exports = Backpack;
