'use strict';
/* ============================================================
   造型档案 · 凋灵骷髅 (wither_skeleton) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   细骨基座逐字同 skeleton, 渲染整体 ×1.2(wiki 口径, 研究笔记 §5
   骷髅一家 — 官方 bedrock 几何与骷髅逐字相同)。黑骨白瞳;
   石剑 = armL 追加石条(官方挂 rightItem 的简化, 挂臂与旧 MOB_RIG
   同侧 — weaponArm 'armL' 口径一致)。
   interface: declare('wither_skeleton', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('wither_skeleton', {
  base: ['skeleton'],
  scale: 1.2,
  weaponArm: 'armL',
  debris: 0x242424,
  bones: {armL: {add: [{origin: [4.5, 2, -1], size: [1, 14, 2], uv: [56, 16]}]}}, /* 石剑 */
  tex: {size: 64, paint: (g, R) => {
    const CHAR = [36, 36, 36]; const CHAR2 = [24, 24, 24];
    const EYE = [168, 168, 168]; const STONE = [138, 143, 152]; const STONE2 = [104, 110, 120];
    /* 头: 黑骨底 · 灰白眼窝(灼瞳) · 牙缝 */
    const F = R.head.front;
    g.noise(F, CHAR, 0.05);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], EYE); g.fill([F[0] + 5, F[1] + 3, 2, 2], EYE);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], CHAR2); /* 鼻孔 */
    g.fill([F[0] + 2, F[1] + 6, 4, 2], CHAR2); /* 牙床 */
    g.px(F[0] + 3, F[1] + 6, EYE); g.px(F[0] + 5, F[1] + 6, EYE); /* 牙缝 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], CHAR, 0.05);
    g.mul(R.head.bottom, 0.8);
    /* 躯干四肢: 黑骨通体 · 肋纹(身正面两道) */
    for (const part of [R.root, R.armR, R.armL, R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], CHAR, 0.05);
      }
      g.mul(part.bottom, 0.8);
    }
    const B = R.root.front;
    g.fill([B[0] + 1, B[1] + 2, 6, 1], CHAR2);
    g.fill([B[0] + 1, B[1] + 4, 6, 1], CHAR2);
    /* 石剑(追加骨 armL2): 石刃+深柄 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.armL2[f], STONE);
    }
    for (const f of ['front', 'left', 'right']) {
      g.fill([R.armL2[f][0], R.armL2[f][1] + 11, R.armL2[f][2], 3], STONE2); /* 柄段 */
    }
  }},
});
