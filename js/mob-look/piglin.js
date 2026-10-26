'use strict';
/* ============================================================
   造型档案 · 猪灵 (piglin) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   人形基座宽头变体(官方头 10×8×8 — headW:5 覆写) + 吻部 4×4×1
   前突 + 双耳 1×5×4(rz ±30° 外撇) + 外套 inflate 0.25(官方第二层
   语言, 研究笔记 §5 猪猪一家)。金剑 = armL 追加(weaponArm 同侧);
   金饰(胸扣/腰牌)画进贴图。
   interface: declare('piglin', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('piglin', {
  base: ['humanoid', {headW: 5}],
  weaponArm: 'armL',
  debris: 0xe8a08a,
  bones: {
    head: {add: [
      {origin: [-2, 24, -5], size: [4, 4, 1], uv: [40, 0]}, /* 吻部 */
      {origin: [4, 27, -2], size: [1, 5, 4], uv: [52, 0], rz: -0.52}, /* 左耳外撇(30°) */
      {origin: [-5, 27, -2], size: [1, 5, 4], uv: [52, 0], rz: 0.52}, /* 右耳外撇(共区) */
    ]},
    root: {add: [{origin: [-4, 12, -2], size: [8, 12, 4], inflate: 0.25, uv: [0, 32]}]}, /* 外套 */
    armL: {add: [{origin: [4.5, 2, -1], size: [1, 14, 2], uv: [56, 16]}]}, /* 金剑 */
  },
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [232, 160, 138]; const SKIN2 = [210, 134, 114];
    const DARK = [42, 26, 26]; const GOLD = [216, 176, 40]; const GOLD2 = [168, 132, 26];
    const PANTS = [58, 42, 42];
    /* 头(10 宽): 粉肤噪底 · 黑眼(白高光) · 鼻孔区 */
    const F = R.head.front;
    g.noise(F, SKIN, 0.05);
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 7, F[1] + 4, 2, 2], DARK);
    g.px(F[0] + 2, F[1] + 4, [235, 235, 245]); g.px(F[0] + 8, F[1] + 4, [235, 235, 245]);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], SKIN, 0.05);
    g.mul(R.head.bottom, 0.8);
    /* 吻部: 深粉 + 双鼻孔 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head2[f], SKIN2, 0.05);
    }
    const SN = R.head2.front;
    g.px(SN[0] + 1, SN[1] + 2, DARK); g.px(SN[0] + 2, SN[1] + 2, DARK);
    g.px(SN[0] + 1, SN[1] + 3, DARK); g.px(SN[0] + 2, SN[1] + 3, DARK);
    /* 双耳(共区 head3/head4): 粉肤+耳廓阴影 */
    const E = R.head3.front;
    for (const part of [R.head3, R.head4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], SKIN, 0.05);
      }
    }
    g.fill([E[0], E[1] + E[3] - 1, E[2], 1], SKIN2);
    /* 身: 裸上身(粉) + 外套 overlay(root2) 粉皮+金胸扣 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], SKIN, 0.05);
    }
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root2[f], SKIN2, 0.05);
    }
    const J = R.root2.front;
    g.fill([J[0] + 3, J[1] + 2, 2, 2], GOLD); /* 金胸扣 */
    g.fill([J[0] + 1, J[1] + 10, 6, 2], GOLD2); /* 腰带 */
    /* 臂: 粉肤(右手金护腕) · 腿: 深褲 */
    for (const arm of [R.armR, R.armL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(arm[f], SKIN, 0.05);
      }
      g.fill([arm.right[0], arm.right[1], arm.right[2], 2], GOLD2); /* 外侧金环 */
      g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], PANTS, 0.05);
      }
      g.mul(leg.bottom, 0.8);
    }
    /* 金剑(追加骨 armL2): 金刃 + 深柄 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.armL2[f], GOLD);
    }
    for (const f of ['front', 'left', 'right']) {
      g.fill([R.armL2[f][0], R.armL2[f][1] + 11, R.armL2[f][2], 3], GOLD2); /* 柄段 */
    }
  }},
});
