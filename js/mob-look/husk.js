'use strict';
/* ============================================================
   造型档案 · 尸壳 (husk) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   人形基座官方等比(与 zombie 几何逐字相同, 换皮 — 研究笔记 §5
   僵尸一家)。干瘪沙色系(配色锚延续旧 MOB_RIG); 步态僵尸式双臂
   前伸(armStyle 'zombie' — 尸壳是僵尸沙漠变体, 官方同款走姿,
   旧 rig 漏配本票补上)。眼嘴画进贴图。
   interface: declare('husk', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('husk', {
  base: ['humanoid'],
  armStyle: 'zombie',
  debris: 0xb0a068,
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [176, 160, 104]; const SHIRT = [138, 122, 74]; const PANTS = [106, 90, 58];
    const DARK = [58, 50, 32]; const NOS = [140, 124, 78];
    /* 头: 沙肤噪底 · 深眼窝 · 鼻影 · 抿嘴 */
    const F = R.head.front;
    g.noise(F, SKIN, 0.06);
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 2], NOS); /* 鼻影 */
    g.fill([F[0] + 3, F[1] + 7, 2, 1], DARK); /* 抿嘴 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], SKIN, 0.06);
    g.noise(R.head.bottom, SKIN, 0.06); g.mul(R.head.bottom, 0.8);
    /* 身: 破衫(底边压暗) · 臂: 裸沙肤 · 腿: 沙裤 */
    for (const f of ['front', 'back', 'left', 'right']) {
      g.noise(R.root[f], SHIRT, 0.05);
    }
    g.noise(R.root.top, SHIRT, 0.05);
    g.noise(R.root.bottom, PANTS, 0.05); g.mul(R.root.bottom, 0.85);
    for (const arm of [R.armR, R.armL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(arm[f], SKIN, 0.06);
      }
      g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], PANTS, 0.05);
      }
      g.mul(leg.bottom, 0.8);
    }
  }},
});
