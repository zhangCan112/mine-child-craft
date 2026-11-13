'use strict';
/* ============================================================
   城镇 NPC 渲染适配件 (TownNpc) — 应用层·无后缀 adapter(THREE/DOM 允许,
   conventions §1.2)
   ------------------------------------------------------------
   一句话职责: 把注册表条目与造型档案装配成可摆放的渲染傀儡——
   mkTownNpcPuppet(id) 出傀儡加头顶锚高度, placeTownNpc(puppet, anchor)
   出站位快照; 藏住「注册表→kit 傀儡→站位」装配链, 调用方只给 id 与锚点。
   face→yaw 双源登记: 本文件自带 face→yaw 纯映射(语义与 js/modes/town.js
   townYawOfFace 一致但不引用), 双源, 待宿主会师后改为消费迁移后的权威
   函数消名(T-NPC-10)。
   interface: mkTownNpcPuppet(id, opts?) → 恰四键 {root, bones, look,
     anchorHeight}(root/bones 系 MobLookKit.puppet(key) 产物透传不改名,
     look=注册表 key, anchorHeight 格: V 系 2.0/G01 2.7 票面权威字面,
     动物随几何=声明盒顶字面登记; 显隐预留只透传 bones 不预造 API) ·
     placeTownNpc(puppet, anchor) → 恰四键纯快照 {x, y, z, yaw}(站立面
     y+1, townSpawnIntent 先例), root.position 置 (x, y+1, z), 入参零
     突变, 不触场景/模式态。
   依赖(均经全局名, 调用期解析): MobLookKit(js/mob-look-kit.js 引擎层,
     puppet(key) 既有傀儡路径) · TOWN_NPCS(js/town-npc-registry.js
     id→key 唯一权威) · THREE/document 惰性(只经 kit 傀儡期触达, 本文件
     顶层零触); 加载序 mob-look-kit → mob-look/town_* →
     town-interact-core → town-npc-anchor-core → town-npc-registry →
     本文件; index.html 挂载归波次二(T-NPC-10)。
   可测性声明: THREE/DOM 惰性创建, Node 测试可安全加载(装载零副作用,
     裸沙盒可装载); 有同名单测(test/town-npc.test.js, THREE 桩直测)。
   ============================================================ */

/* ---------- 头顶锚高度(格, 话 UI World Bubble 挂点): V 系 2.0(含裙摆
    视觉口径)/G01 2.7 为票面权威(与几何推导口径并存是既定裁定, 勿
    「修正」); 动物随几何=look 声明盒顶字面登记(A01 冠 13.75+1 ·
    A02 耳 12.75+2 · A03 耳 26.5+1 px, 1px=1/16 格; 三只动物声明盒无
    inflate/旋转, 顶=盒顶)。字面系等价途径登记(测试以独立推导字面
    对账), 声明几何改动时须同步本表。 ---------- */
const TOWN_NPC_ANCHOR_HEIGHTS = {
  V01: 2.0, V02: 2.0, V03: 2.0, V04: 2.0, V05: 2.0,
  V06: 2.0, V07: 2.0, V08: 2.0, V09: 2.0, V10: 2.0,
  G01: 2.7,
  A01: 14.75 / 16, A02: 14.75 / 16, A03: 27.5 / 16,
};

/* ---------- face→yaw 纯映射(双源登记见头注释): 前向向量=(-sin yaw,
    -cos yaw)(引擎 camera-rig lookDir 同式)——north=0(−Z)/south=π(+Z)/
    west=π/2(−X)/east=−π/2(+X); 词表第五值 up 与未知 face 抛拼写域错
    (townYawOfFace 同语义, 但不引用该禁触文件)。 ---------- */
function townNpcYawOfFace(face) {
  switch (face) {
    case 'north': return 0;
    case 'south': return Math.PI;
    case 'west': return Math.PI / 2;
    case 'east': return -Math.PI / 2;
    default:
      throw new Error('townNpcYawOfFace: 未知 face「' + face +
        '」(合法域 north|south|east|west)');
  }
}

/* ---------- 傀儡工厂: id→key 按注册表行查(未知 id 抛拼写域错, 消息含
    该 id 与合法域提示), 走 MobLookKit.puppet 既有傀儡路径(逐骨
    Group+Mesh, −Z 原生, 材质 NearestFilter), 产物恰四键——root/bones
    透传(显隐预留只给 bones, G01 flower 花盒骨已在册, 不预造
    show/hide), look=key 供回查注册表, anchorHeight 见上(锚高表与
    注册表 id 域对齐, 漏登记即炸防静默); opts 本票无语义(签名预留,
    供后续票注入式扩展)。 ---------- */
function mkTownNpcPuppet(id, opts) {
  const row = TOWN_NPCS.find((e) => e.id === id);
  if (!row) {
    throw new Error('mkTownNpcPuppet: 未知 id「' + id +
      '」(合法域 V01~V10|G01|A01~A03, 见 TOWN_NPCS 注册表)');
  }
  const puppet = MobLookKit.puppet(row.key);
  const anchorHeight = TOWN_NPC_ANCHOR_HEIGHTS[id];
  if (anchorHeight === undefined) {
    throw new Error('mkTownNpcPuppet: id「' + id +
      '」无锚高登记(须在 TOWN_NPC_ANCHOR_HEIGHTS 表内)');
  }
  return {root: puppet.root, bones: puppet.bones, look: row.key, anchorHeight};
}

/* ---------- 站位纯装配: 返回恰四键快照(站立面 y+1, townSpawnIntent
    先例), root.position 同步置 (x, y+1, z); 入参 anchor 只读零突变,
    不触场景/模式态。 ---------- */
function placeTownNpc(puppet, anchor) {
  const x = anchor.x;
  const y = anchor.y + 1;
  const z = anchor.z;
  puppet.root.position.set(x, y, z);
  return {x, y, z, yaw: townNpcYawOfFace(anchor.face)};
}

/* ---------- CommonJS 导出守卫(town-npc-registry.js 同款): 浏览器经典
    脚本共享词法环境, 顶层声明即全局, 供消费方直接引用; Node 下仅测试
    消费, 挂 module.exports。 ---------- */
const TownNpc = {mkTownNpcPuppet, placeTownNpc};
if (typeof module !== 'undefined' && module.exports) module.exports = TownNpc;
