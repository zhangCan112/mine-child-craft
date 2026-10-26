'use strict';
/* ============================================================
   造型档案 · 猪灵蛮兵 (piglin_brute) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   piglin 同骨架官方等比(换皮+体格, 研究笔记 §5 猪猪一家), 整体
   ×1.1(旧 rig tall 系数保留)。金斧(宽刃) = armL 追加; 皮甲
   (胸甲块/护腕)画进贴图 — 蛮兵辨识件。
   interface: declare('piglin_brute', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('piglin_brute', {
  base: ['humanoid', {headW: 5}],
  scale: 1.1,
  weaponArm: 'armL',
  debris: 0xe8a08a,
  bones: {
    head: {add: [
      {origin: [-2, 24, -5], size: [4, 4, 1], uv: [40, 0]}, /* 吻部 */
      {origin: [4, 27, -2], size: [1, 5, 4], uv: [52, 0], rz: -0.52}, /* 左耳外撇(30°) */
      {origin: [-5, 27, -2], size: [1, 5, 4], uv: [52, 0], rz: 0.52}, /* 右耳外撇(共区) */
    ]},
    root: {add: [{origin: [-4, 12, -2], size: [8, 12, 4], inflate: 0.25, uv: [0, 32]}]}, /* 外套 */
    armL: {add: [{origin: [4.5, 2, -2], size: [1, 14, 4], uv: [50, 40]}]}, /* 金斧(宽刃) */
  },
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [226, 148, 124]; const SKIN2 = [202, 124, 102];
    const DARK = [42, 26, 26]; const GOLD = [216, 176, 40]; const GOLD2 = [168, 132, 26];
    const LEATHER = [92, 62, 42]; const LEATHER2 = [70, 46, 30];
    /* 头(10 宽): 粗粝粉肤 · 黑眼 · 眉骨横杠(蛮兵凶相) */
    const F = R.head.front;
    g.noise(F, SKIN, 0.06);
    g.fill([F[0] + 1, F[1] + 3, 8, 1], SKIN2); /* 眉骨 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 7, F[1] + 4, 2, 2], DARK);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], SKIN, 0.06);
    g.mul(R.head.bottom, 0.8);
    /* 吻部: 深粉 + 鼻孔 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head2[f], SKIN2, 0.05);
    }
    const SN = R.head2.front;
    g.px(SN[0] + 1, SN[1] + 2, DARK); g.px(SN[0] + 2, SN[1] + 2, DARK);
    /* 双耳: 粉肤 */
    for (const part of [R.head3, R.head4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], SKIN, 0.06);
      }
    }
    /* 身: 裸肤 + 外套(root2) 皮甲胸(皮革+金扣) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], SKIN, 0.06);
    }
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root2[f], LEATHER, 0.06);
    }
    const J = R.root2.front;
    g.fill([J[0] + 2, J[1] + 2, 4, 2], LEATHER2); /* 胸甲缝 */
    g.fill([J[0] + 3, J[1] + 1, 2, 2], GOLD); /* 金扣 */
    /* 臂: 肤+皮护腕 · 腿: 皮裤 */
    for (const arm of [R.armR, R.armL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(arm[f], SKIN, 0.06);
      }
      g.fill([arm.right[0], arm.right[1], arm.right[2], 3], LEATHER); /* 皮护腕 */
      g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], LEATHER, 0.06);
      }
      g.mul(leg.bottom, 0.8);
    }
    /* 金斧(追加骨 armL2): 上段金刃 下段木柄 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.armL2[f], GOLD);
    }
    for (const f of ['front', 'left', 'right']) {
      g.fill([R.armL2[f][0], R.armL2[f][1] + 8, R.armL2[f][2], 6], LEATHER2); /* 柄段 */
    }
  }},
});
