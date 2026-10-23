'use strict';
/* ============================================================
   手持物注册表 (HeldItems, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   手持物(工具/武器)的唯一数据源: 部件表 + 握持姿态 + 挥击/待机
   参数(个性武器 = 在 defs 里加一份纯数据; 镐/斧/剑/锹四阶工具 =
   mkToolDef 加载期批量生成 16 条 def 的工厂, 单测直调——非运行时
   按需入口); 外加两个无状态入口:
   swingPose 挥击关节角纯函数 · mount 按 def 装配网格。
   肢体动画与握持施加收在 Avatar。顶层零 THREE → Node vm 可直接
   加载单测; mount() 调用期才触碰 THREE(仅浏览器)。
   依赖: 无(挥击曲线纯数学; 颜色/尺寸为字面量)。
   ============================================================ */

/* 空手等价 def: 未持物时 Avatar 的挥击/待机缺省(形状与 defs 条目一致) */
const HELD_BARE = {
  label: '空手',
  swing: {dur: 0.24, amp: 1.1, curlZ: 0},
  sway: {idle: 0.03},
};

/* ---------- 工具 def 工厂 (mkToolDef): 镐/斧/剑/锹 × 木/石/铁/钻 ----------
   部件同构 = 木柄 + 工具头(形状按 kind 分四套), 头色按 tier 换材质色板;
   grip/swing 按 kind 分档(剑快阔 · 镐中 · 斧锹沉)。每次调用产出全新对象,
   16 个生成条目与 hoe/sword/bow 手工条目同住 defs(键名与物品 id 一致,
   供 Avatar.setItem 直用, 见设计稿 §3.1/D2)。 */

/* 材质四阶色板: 工具头颜色(工单 T4 / 设计稿 §3.1 抄录) */
const TOOL_HEAD_COLORS = {
  wood: 0x8a5a2b,
  stone: 0x8a8f98,
  iron: 0xd8dde4,
  diamond: 0x4ee1d2,
};

/* 标签用字: 阶名(钻石不带「石」字, 同设计稿 §3.1 name 口径) × 种名 */
const KIND_LABELS = {pick: '镐', axe: '斧', sword: '剑', shovel: '锹'};
const TIER_LABELS = {wood: '木', stone: '石', iron: '铁', diamond: '钻石'};

/* 工具头部件表: 每种一套(c 为该阶材质色; 部件坐标系以握点为原点, -Z 为前) */
const TOOL_HEAD_PARTS = {
  /* 镐: 柄顶横梁 + 左右两端前倾尖 */
  pick: (c) => [
    {w: 0.30, h: 0.06, d: 0.06, color: c, pos: [0, 0.44, 0]},
    {w: 0.08, h: 0.05, d: 0.05, color: c, pos: [-0.16, 0.39, -0.03]},
    {w: 0.08, h: 0.05, d: 0.05, color: c, pos: [0.16, 0.39, -0.03]},
  ],
  /* 斧: 柄顶装颈 + 单侧宽刃(+X 侧, 微前伸) */
  axe: (c) => [
    {w: 0.09, h: 0.15, d: 0.075, color: c, pos: [0, 0.43, 0]},
    {w: 0.06, h: 0.19, d: 0.11, color: c, pos: [0.075, 0.43, -0.02]},
  ],
  /* 剑: 剑柄/柄尾/护手照手工 sword 条目, 仅剑身换材质色 */
  sword: (c) => [
    {w: 0.05, h: 0.24, d: 0.05, color: 0x3a2a1c, pos: [0, 0.06, 0]},
    {w: 0.065, h: 0.05, d: 0.065, color: 0xd9b23c, pos: [0, -0.09, 0]},
    {w: 0.17, h: 0.05, d: 0.06, color: 0x6a6f78, pos: [0, 0.20, 0]},
    {w: 0.055, h: 0.50, d: 0.028, color: c, pos: [0, 0.47, 0]},
  ],
  /* 锹: 柄顶装颈 + 前伸薄铲头 */
  shovel: (c) => [
    {w: 0.075, h: 0.07, d: 0.075, color: c, pos: [0, 0.42, 0]},
    {w: 0.14, h: 0.17, d: 0.05, color: c, pos: [0, 0.44, -0.06]},
  ],
};

/* 握持分档: 剑照手工剑(尖朝前上戒备式), 其余三种与锄头同位 */
const TOOL_GRIPS = {
  pick: {pos: [0, -0.50, -0.07], rot: [-0.25, 0, 0]},
  axe: {pos: [0, -0.50, -0.07], rot: [-0.25, 0, 0]},
  sword: {pos: [0, -0.50, -0.06], rot: [-0.35, 0, 0]},
  shovel: {pos: [0, -0.50, -0.07], rot: [-0.25, 0, 0]},
};

/* 挥击分档: 剑快而阔(照手工剑) · 镐中(照锄头) · 斧锹更沉(dur 长 amp 收) */
const TOOL_SWINGS = {
  pick: {dur: 0.24, amp: 1.3, curlZ: 0.12},
  axe: {dur: 0.30, amp: 1.1, curlZ: 0.15},
  sword: {dur: 0.20, amp: 1.6, curlZ: 0.05},
  shovel: {dur: 0.28, amp: 1.2, curlZ: 0.10},
};

/* 工具 def 工厂(纯数据): 越界 kind/tier 直接抛错, 不静默产出残缺 def */
const mkToolDef = (kind, tier) => {
  const heads = TOOL_HEAD_PARTS[kind];
  if (!heads || TOOL_HEAD_COLORS[tier] === undefined) {
    throw new Error('mkToolDef: 未知 kind/tier → ' + kind + '/' + tier);
  }
  const grip = TOOL_GRIPS[kind];
  const swing = TOOL_SWINGS[kind];
  return {
    label: TIER_LABELS[tier] + KIND_LABELS[kind],
    parts: [
      {w: 0.055, h: 0.55, d: 0.055, color: 0x8a5a2b, pos: [0, 0.16, 0]}, // 木柄(同锄头)
      ...heads(TOOL_HEAD_COLORS[tier]),
    ],
    grip: {pos: [...grip.pos], rot: [...grip.rot]},
    swing: {...swing},
    sway: {idle: 0.03},
  };
};

/* 16 个工具 def 一次生成: 键名 kind_tier, 与 items-core 物品 id 逐字一致 */
const TOOL_DEFS = {};
for (const kind of Object.keys(TOOL_HEAD_PARTS)) {
  for (const tier of Object.keys(TOOL_HEAD_COLORS)) {
    TOOL_DEFS[kind + '_' + tier] = mkToolDef(kind, tier);
  }
}

const HELD_DEFS = {
  /* 锄头: 木柄 + 铁箍 + 前伸锄刃, 部件坐标系以握点为原点, -Z 为前 */
  hoe: {
    label: '锄头',
    parts: [
      {w: 0.055, h: 0.55, d: 0.055, color: 0x8a5a2b, pos: [0, 0.16, 0]}, // 木柄
      {w: 0.075, h: 0.07, d: 0.075, color: 0x4a4d52, pos: [0, 0.42, 0]}, // 铁箍
      {w: 0.20, h: 0.045, d: 0.07, color: 0x6a6f78, pos: [0, 0.435, -0.115]}, // 锄刃(前伸)
    ],
    /* 挂在右臂手部枢轴: 手心略前, 柄顶微前倾 */
    grip: {pos: [0, -0.50, -0.07], rot: [-0.25, 0, 0]},
    /* 挥击: 0.24 秒内前挥 1.3 rad, 带轻微内收 */
    swing: {dur: 0.24, amp: 1.3, curlZ: 0.12},
    /* 待机呼吸浮动幅度(可调 0 关闭) */
    sway: {idle: 0.03},
  },
  /* 剑: 剑柄 + 金柄尾 + 十字护手 + 上指剑身, 部件坐标系以握点为原点, -Z 为前
     (下界冒险「进下界换剑」用; 伤害/触及等战斗政策在模式层, 不进 def) */
  sword: {
    label: '剑',
    parts: [
      {w: 0.05, h: 0.24, d: 0.05, color: 0x3a2a1c, pos: [0, 0.06, 0]}, // 剑柄
      {w: 0.065, h: 0.05, d: 0.065, color: 0xd9b23c, pos: [0, -0.09, 0]}, // 柄尾圆头
      {w: 0.17, h: 0.05, d: 0.06, color: 0x6a6f78, pos: [0, 0.20, 0]}, // 十字护手
      {w: 0.055, h: 0.50, d: 0.028, color: 0xd8dde4, pos: [0, 0.47, 0]}, // 剑身
    ],
    /* 挂在右臂手部枢轴(与锄头同位): 剑尖朝前上, 戒备式微前倾 */
    grip: {pos: [0, -0.50, -0.06], rot: [-0.35, 0, 0]},
    /* 挥击: 比锄头更快更阔(剑感) */
    swing: {dur: 0.2, amp: 1.6, curlZ: 0.05},
    /* 待机呼吸浮动幅度 */
    sway: {idle: 0.03},
  },
  /* 弓: 竖直木弓臂 + 弓弦 + 两端梢块, 部件坐标系以握点为原点, -Z 为前
     (下界冒险武器栏远程位; 箭矢伤害/弹道等战斗政策在模式层, 不进 def) */
  bow: {
    label: '弓',
    parts: [
      {w: 0.05, h: 0.62, d: 0.05, color: 0x8a5a2b, pos: [0, 0.10, -0.10]}, // 弓臂(竖)
      {w: 0.015, h: 0.56, d: 0.015, color: 0xd8d8d4, pos: [0, 0.10, -0.03]}, // 弓弦
      {w: 0.075, h: 0.05, d: 0.075, color: 0x6a4a22, pos: [0, 0.44, -0.11]}, // 上梢
      {w: 0.075, h: 0.05, d: 0.075, color: 0x6a4a22, pos: [0, -0.24, -0.11]}, // 下梢
    ],
    /* 挂在右臂手部枢轴: 弓竖持于手前, 微前倾(弦贴手心, 臂在身前) */
    grip: {pos: [0, -0.48, -0.10], rot: [0.18, 0, 0]},
    /* 挥击=放箭的蓄力前送(幅度接近剑的挥砍, 放箭动作要看得见): 挥臂观感随 def 走 */
    swing: {dur: 0.3, amp: 1.1, curlZ: 0},
    /* 待机呼吸浮动幅度 */
    sway: {idle: 0.03},
  },

  /* 镐/斧/剑/锹 × 木/石/铁/钻 共 16 条: mkToolDef 批量生成(见上方工厂段) */
  ...TOOL_DEFS,
};

const HeldItems = {
  defs: HELD_DEFS,
  bare: HELD_BARE,
  /* 工具 def 工厂: kind×tier → 全新 def。加载期已批量生成 16 条进 defs
     (本入口即那段装配代码的单测直调面), 非运行时按需入口——运行时
     消费方一律读 defs, 不经此现做 */
  mkToolDef,

  /* 挥击关节角(纯函数): p 为 0..1 的挥击进度。
     sin(p·π) 包络 → 端点严格归零, Avatar 以加法式叠加在
     走/跳/飞姿态上, 边界自动连续, 无需混合状态机。 */
  swingPose(p, def) {
    const s = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
    return {x: s * def.swing.amp, z: s * def.swing.curlZ};
  },

  /* 按 def 装配手持物网格(仅浏览器: 调用期才触碰 THREE)。
     返回以握点为原点的 Group; 握持姿态(grip)由 Avatar 施加,
     因为那是手臂坐标系的知识。def 为空 → null(空手)。 */
  mount(def) {
    if (!def) return null;
    const g = new THREE.Group();
    for (const p of def.parts) {
      const m = new THREE.Mesh(
          new THREE.BoxGeometry(p.w, p.h, p.d),
          new THREE.MeshLambertMaterial({color: p.color}));
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      g.add(m);
    }
    return g;
  },
};
if (typeof module !== 'undefined' && module.exports) module.exports = HeldItems;
