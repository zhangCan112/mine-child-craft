'use strict';
/* ============================================================
   造型档案 · 僵尸 (zombie) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   人形基座官方等比(头 8³/身 8×12×4/四肢 4×12×4, docs/mc-mob-models-
   research.md §5 僵尸一家), 步态僵尸式双臂前伸(armStyle 透传 gait)。
   配色锚延续旧 MOB_RIG(肤绿/青衫/紫裤); 眼嘴从盒子改画进贴图。
   interface: declare('zombie', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('zombie', {
  base: ['humanoid'],
  armStyle: 'zombie',
  debris: 0x5e9440,
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [94, 148, 64]; const SHIRT = [46, 122, 112]; const PANTS = [74, 63, 112];
    const DARK = [28, 43, 22]; const NOS = [61, 107, 46];
    /* 头: 绿肤噪底 · 深眼窝 2×2 · 鼻影 · 宽嘴 */
    const F = R.head.front;
    g.noise(F, SKIN, 0.06);
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 2], NOS); /* 鼻影 */
    g.fill([F[0] + 2, F[1] + 7, 4, 1], DARK); /* 宽嘴 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], SKIN, 0.06);
    g.noise(R.head.bottom, SKIN, 0.06); g.mul(R.head.bottom, 0.8);
    /* 身: 青衫(顶底随裤色压暗) · 臂: 裸绿肤 · 腿: 紫裤 */
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
