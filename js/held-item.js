"use strict";
/* ============================================================
   手持物注册表 (HeldItems, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   手持物(工具/武器)的唯一数据源: 部件表 + 握持姿态 + 挥击/待机
   参数(加武器 = 在 defs 里加一份纯数据); 外加两个无状态入口:
   swingPose 挥击关节角纯函数 · mount 按 def 装配网格。
   肢体动画与握持施加收在 Avatar。顶层零 THREE → Node vm 可直接
   加载单测; mount() 调用期才触碰 THREE(仅浏览器)。
   依赖: 无(挥击曲线纯数学; 颜色/尺寸为字面量)。
   ============================================================ */

/* 空手等价 def: 未持物时 Avatar 的挥击/待机缺省(形状与 defs 条目一致) */
const HELD_BARE = {
  label: '空手',
  swing: { dur: 0.24, amp: 1.1, curlZ: 0 },
  sway:  { idle: 0.03 },
};

const HELD_DEFS = {
  /* 锄头: 木柄 + 铁箍 + 前伸锄刃, 部件坐标系以握点为原点, -Z 为前 */
  hoe: {
    label: '锄头',
    parts: [
      { w: 0.055, h: 0.55,  d: 0.055, color: 0x8a5a2b, pos: [0, 0.16,  0    ] },  // 木柄
      { w: 0.075, h: 0.07,  d: 0.075, color: 0x4a4d52, pos: [0, 0.42,  0    ] },  // 铁箍
      { w: 0.20,  h: 0.045, d: 0.07,  color: 0x6a6f78, pos: [0, 0.435, -0.115] }, // 锄刃(前伸)
    ],
    /* 挂在右臂手部枢轴: 手心略前, 柄顶微前倾 */
    grip: { pos: [0, -0.50, -0.07], rot: [-0.25, 0, 0] },
    /* 挥击: 0.24 秒内前挥 1.3 rad, 带轻微内收 */
    swing: { dur: 0.24, amp: 1.3, curlZ: 0.12 },
    /* 待机呼吸浮动幅度(可调 0 关闭) */
    sway: { idle: 0.03 },
  },
  /* 剑: 剑柄 + 金柄尾 + 十字护手 + 上指剑身, 部件坐标系以握点为原点, -Z 为前
     (下界冒险「进下界换剑」用; 伤害/触及等战斗政策在模式层, 不进 def) */
  sword: {
    label: '剑',
    parts: [
      { w: 0.05,  h: 0.24, d: 0.05,  color: 0x3a2a1c, pos: [0, 0.06, 0    ] },  // 剑柄
      { w: 0.065, h: 0.05, d: 0.065, color: 0xd9b23c, pos: [0, -0.09, 0   ] },  // 柄尾圆头
      { w: 0.17,  h: 0.05, d: 0.06,  color: 0x6a6f78, pos: [0, 0.20, 0    ] },  // 十字护手
      { w: 0.055, h: 0.50, d: 0.028, color: 0xd8dde4, pos: [0, 0.47, 0    ] },  // 剑身
    ],
    /* 挂在右臂手部枢轴(与锄头同位): 剑尖朝前上, 戒备式微前倾 */
    grip: { pos: [0, -0.50, -0.06], rot: [-0.35, 0, 0] },
    /* 挥击: 比锄头更快更阔(剑感) */
    swing: { dur: 0.2, amp: 1.6, curlZ: 0.05 },
    /* 待机呼吸浮动幅度 */
    sway: { idle: 0.03 },
  },
};

const HeldItems = {
  defs: HELD_DEFS,
  bare: HELD_BARE,

  /* 挥击关节角(纯函数): p 为 0..1 的挥击进度。
     sin(p·π) 包络 → 端点严格归零, Avatar 以加法式叠加在
     走/跳/飞姿态上, 边界自动连续, 无需混合状态机。 */
  swingPose(p, def){
    const s = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
    return { x: s * def.swing.amp, z: s * def.swing.curlZ };
  },

  /* 按 def 装配手持物网格(仅浏览器: 调用期才触碰 THREE)。
     返回以握点为原点的 Group; 握持姿态(grip)由 Avatar 施加,
     因为那是手臂坐标系的知识。def 为空 → null(空手)。 */
  mount(def){
    if(!def) return null;
    const g = new THREE.Group();
    for(const p of def.parts){
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, p.h, p.d),
        new THREE.MeshLambertMaterial({ color: p.color }));
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      g.add(m);
    }
    return g;
  },
};
if(typeof module !== 'undefined' && module.exports) module.exports = HeldItems;
