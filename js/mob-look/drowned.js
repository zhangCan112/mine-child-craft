'use strict';
/* ============================================================
   造型档案 · 溺尸 (drowned) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   人形基座官方等比 + **三层 inflate 0.5 外套**(jacket/sleeve/pants,
   官方溺尸外壳语言, 研究笔记 §5 僵尸一家) + hat 层 inflate 1.0
   (湿发藻壳 — 脸画在帽层上, 帽层才是可见面)。三叉戟 = armL
   追加(weaponArm 同侧, 与旧 MOB_RIG held 等价)。泡水青绿配色。
   interface: declare('drowned', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('drowned', {
  base: ['humanoid'],
  armStyle: 'zombie',
  weaponArm: 'armL',
  debris: 0x4a8a7a,
  bones: {
    head: {add: [{origin: [-4, 24, -4], size: [8, 8, 8], inflate: 1, uv: [0, 32]}]}, /* 帽层 */
    root: {add: [{origin: [-4, 12, -2], size: [8, 12, 4], inflate: 0.5, uv: [40, 32]}]}, /* 外套 */
    armL: {add: [
      {origin: [4, 12, -2], size: [4, 12, 4], inflate: 0.5, uv: [48, 48]}, /* 袖(与裤共区) */
      {origin: [4.5, 0, -0.5], size: [1, 12, 1], uv: [0, 50]}, /* 三叉戟 */
    ]},
    armR: {add: [{origin: [-8, 12, -2], size: [4, 12, 4], inflate: 0.5, uv: [48, 48]}]},
    legL: {add: [{origin: [0, 0, -2], size: [4, 12, 4], inflate: 0.5, uv: [48, 48]}]}, /* 裤 */
    legR: {add: [{origin: [-4, 0, -2], size: [4, 12, 4], inflate: 0.5, uv: [48, 48]}]},
  },
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [74, 138, 122]; const SKIN2 = [56, 110, 98];
    const CLOTH = [42, 90, 90]; const CLOTH2 = [32, 70, 72];
    const DARK = [10, 42, 40]; const ALG = [88, 142, 74];
    const TRI = [58, 106, 138];
    /* 内层(头/身/四肢基座盒): 泡水肤 — 大半被 overlay 罩住, 只露边角 */
    for (const part of [R.head, R.root, R.armR, R.armL, R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], SKIN, 0.06);
      }
    }
    /* 帽层(head2, 可见脸): 深青肤 + 藻斑 + 黑眼窝 + 凹嘴 */
    const H = R.head2;
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(H[f], SKIN2, 0.07);
    }
    for (const f of ['top', 'back']) {
      const r = H[f];
      for (let i = 0; i < r[2] * r[3] / 6; i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]), ALG); /* 藻斑 */
      }
    }
    const F = H.front;
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 2], [40, 84, 76]); /* 鼻影 */
    g.fill([F[0] + 2, F[1] + 7, 4, 1], DARK); /* 凹嘴 */
    /* 外套(root2): 破烂青布 · 下摆破口 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root2[f], CLOTH, 0.07);
    }
    for (const f of ['front', 'left', 'right']) {
      const r = R.root2[f];
      g.fill([r[0], r[1] + r[3] - 2, r[2], 2], CLOTH2); /* 破口下摆 */
    }
    /* 袖/裤(共区): 破布色 */
    for (const part of [R.armR2, R.armL2, R.legR2, R.legL2]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], CLOTH, 0.07);
      }
    }
    /* 三叉戟(armL3): 青蓝杆 + 亮尖 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.armL3[f], TRI);
    }
    g.fill([R.armL3.top[0], R.armL3.top[1], R.armL3.top[2], R.armL3.top[3]], [120, 190, 224]); /* 亮尖 */
  }},
});
