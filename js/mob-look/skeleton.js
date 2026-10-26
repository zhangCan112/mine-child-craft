'use strict';
/* ============================================================
   造型档案 · 骷髅 (skeleton) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   细骨基座(四肢 2×12×2, 官方等比), 弓手步态(armStyle 'archer',
   持弓臂前伸 — gait 既有词汇)。弓 = armL 追加细木条(官方挂 rightItem
   的简化, 挂臂与旧 MOB_RIG 同侧 — weaponArm 'armL' 口径一致)。
   眼窝/鼻孔/牙缝从盒子改画进贴图。
   interface: declare('skeleton', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('skeleton', {
  base: ['skeleton'],
  armStyle: 'archer',
  weaponArm: 'armL',
  debris: 0xd8d8d2,
  bones: {armL: {add: [{origin: [4.5, 2, -0.5], size: [1, 11, 1], uv: [56, 0]}]}}, /* 弓 */
  tex: {size: 64, paint: (g, R) => {
    const BONE = [216, 216, 210]; const BONE2 = [184, 184, 176];
    const DARK = [26, 26, 26]; const WOOD = [107, 74, 42];
    /* 头: 骨白噪底 · 深眼窝 · 鼻孔 · 牙缝(交替竖线) */
    const F = R.head.front;
    g.noise(F, BONE, 0.04);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 3, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], BONE2); /* 鼻孔 */
    g.fill([F[0] + 2, F[1] + 6, 4, 2], BONE2); /* 牙床 */
    for (let i = 0; i < 4; i++) g.px(F[0] + 2 + i * 2 - (i === 3 ? 1 : 0), F[1] + 6, DARK);
    g.px(F[0] + 3, F[1] + 7, DARK); g.px(F[0] + 5, F[1] + 7, DARK); /* 牙缝竖线 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head[f], BONE, 0.04);
    }
    g.mul(R.head.bottom, 0.8);
    /* 躯干四肢: 骨白(细肢区域窄, 全骨色) · 肋骨阴影(身正面两道横线) */
    const B = R.root.front;
    g.noise(B, BONE, 0.04);
    g.fill([B[0] + 1, B[1] + 2, 6, 1], BONE2);
    g.fill([B[0] + 1, B[1] + 4, 6, 1], BONE2);
    g.fill([B[0] + 1, B[1] + 6, 6, 1], BONE2);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.root[f], BONE, 0.04);
    for (const part of [R.armR, R.armL, R.legR, R.legL]) {
      g.noiseAll(part, BONE, 0.04);
      g.mul(part.bottom, 0.8);
    }
    /* 弓(追加骨 armL2): 木色通体 */
    g.fillAll(R.armL2, WOOD);
  }},
});
