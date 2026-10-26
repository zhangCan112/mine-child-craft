'use strict';
/* ============================================================
   造型档案 · 卫道士 (vindicator) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   灾厄村民基座官方等比(头 8×10×8+鼻 2×4×2+身 8×12×6+长袍 overlay
   inflate 0.5, 研究笔记 §4/§5 灾厄帮 — 本票新增 illager 基座)。
   铁斧 = armL 追加(官方挂 rightItem 的简化, weaponArm 同侧);
   一字眉+绿瞳画进贴图(官方凶相辨识件)。
   interface: declare('vindicator', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('vindicator', {
  base: ['illager'],
  weaponArm: 'armL',
  debris: 0x3a5a3a,
  bones: {armL: {add: [{origin: [4.5, 2, -2], size: [1, 14, 4], uv: [48, 40]}]}}, /* 铁斧 */
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [176, 176, 154]; const SKIN2 = [150, 150, 128];
    const DARK = [30, 30, 24]; const EYE = [86, 122, 72];
    const ROBE = [58, 90, 58]; const ROBE2 = [42, 68, 42];
    const IRON = [138, 143, 152]; const IRON2 = [104, 110, 120];
    /* 头(8×10): 灰肤噪底 · 一字眉 · 绿瞳 · 大鼻(立体件下的鼻影) */
    const F = R.head.front;
    g.noise(F, SKIN, 0.05);
    g.fill([F[0], F[1] + 3, 8, 1], DARK); /* 一字眉(官方凶相) */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], EYE); g.fill([F[0] + 5, F[1] + 4, 2, 2], EYE);
    g.fill([F[0] + 3, F[1] + 8, 2, 1], DARK); /* 抿嘴 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], SKIN, 0.05);
    g.noise(R.head.bottom, SKIN, 0.05); g.mul(R.head.bottom, 0.8);
    /* 鼻(追加立方体 head2): 灰肤+鼻头影 */
    g.noiseAll(R.head2, SKIN2, 0.05);
    g.mul(R.head2.bottom, 0.85);
    /* 身: 深绿袍(root=衬衣, root2=长袍 overlay) · 腰带 */
    g.noiseAll(R.root, ROBE, 0.05);
    g.noiseAll(R.root2, ROBE, 0.05);
    const B = R.root2.front;
    g.fill([B[0] + 1, B[1] + 8, 6, 2], ROBE2); /* 腰带 */
    g.fill([B[0] + 3, B[1] + 8, 2, 2], IRON); /* 铁扣 */
    /* 臂(共区): 袍色短袖+灰手 · 腿(共区): 袍色长靴 */
    for (const arm of [R.armR, R.armL]) {
      g.noiseAll(arm, ROBE, 0.05);
      for (const f of ['front', 'back', 'left', 'right']) {
        g.fill([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN); /* 前臂露手 */
        g.noise([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN, 0.05);
      }
      g.noise(arm.bottom, SKIN, 0.05); g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      g.noiseAll(leg, ROBE2, 0.05);
      g.mul(leg.bottom, 0.8);
    }
    /* 铁斧(追加骨 armL2): 铁刃+深柄 */
    g.fillAll(R.armL2, IRON);
    for (const f of ['front', 'left', 'right']) {
      g.fill([R.armL2[f][0], R.armL2[f][1] + 8, R.armL2[f][2], 6], IRON2); /* 柄段 */
    }
  }},
});
