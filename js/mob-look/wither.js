'use strict';
/* ============================================================
   造型档案 · 凋灵 (wither) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架直填(bedrock wither_boss.geo 核对): 脊柱 3×10×3 +
   三对肋骨 11×2×2 + 脊横向 20×3×3 + 颈桩 3×6×3 + **三骷髅头**
   (中头 8×8×8 + 双肩头 6×6×6 — 肩头挂 armL/armR 槽, 攻击=肩头
   抡摆)。官方 geo 本体 28px, bedrock 渲染放大 — 本项目取
   scale 1.7(≈3.0 格, 对齐旧 rig 观感与 Boss 体量)。
   interface: declare('wither', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('wither', {
  scale: 1.7,
  debris: 0x1c1c1c,
  bones: {
    root: {pivot: [0, 17, 0], add: [
      {origin: [-10, 17.1, -0.5], size: [20, 3, 3], uv: [0, 16]}, /* 脊横向 */
      {origin: [-2, 7.1, -0.5], size: [3, 10, 3], uv: [0, 22]}, /* 脊柱 */
      {origin: [-6, 13.6, 0], size: [11, 2, 2], uv: [24, 22]}, /* 肋一 */
      {origin: [-6, 11.1, 0], size: [11, 2, 2], uv: [24, 22]}, /* 肋二(共区) */
      {origin: [-6, 8.6, 0], size: [11, 2, 2], uv: [24, 22]}, /* 肋三(共区) */
      {origin: [0, 18, 0], size: [3, 6, 3], uv: [12, 22]}, /* 颈桩 */
    ]},
    head: {pivot: [0, 20, 0], add: [{origin: [-4, 20, -4], size: [8, 8, 8], uv: [0, 0]}]},
    armL: {pivot: [9, 18, -1], add: [{origin: [6, 18, -4], size: [6, 6, 6], uv: [32, 0]}]},
    armR: {pivot: [-9, 18, -1], add: [{origin: [-12, 18, -4], size: [6, 6, 6], uv: [32, 0]}]},
  },
  tex: {size: 64, paint: (g, R) => {
    const DARKB = [28, 28, 28]; const DARK2 = [20, 20, 20];
    const BONE = [216, 216, 210]; const BONE2 = [168, 168, 160];
    /* 中头: 黑骨底 · 白瞳(两颗) · 白牙床咧嘴 */
    const F = R.head.front;
    g.noise(F, DARKB, 0.06);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], BONE); g.fill([F[0] + 5, F[1] + 3, 2, 2], BONE);
    g.fill([F[0] + 2, F[1] + 6, 4, 2], BONE2); /* 牙床 */
    g.px(F[0] + 2, F[1] + 6, DARK2); g.px(F[0] + 4, F[1] + 6, DARK2); /* 牙缝 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], DARKB, 0.06);
    g.mul(R.head.bottom, 0.8);
    /* 双肩头(共区 armL/armR): 黑骨 + 白瞳小脸 */
    for (const part of [R.armL, R.armR]) {
      g.noiseAll(part, DARKB, 0.06);
      const SF = part.front;
      g.fill([SF[0] + 1, SF[1] + 2, 1, 1], BONE); g.fill([SF[0] + 4, SF[1] + 2, 1, 1], BONE);
      g.fill([SF[0] + 1, SF[1] + 4, 4, 1], BONE2); /* 小牙床 */
    }
    /* 脊横向(root) · 脊柱(root2) · 颈桩(root6): 黑骨; 肋骨(root3~5): 骨白 */
    for (const part of [R.root, R.root2, R.root6]) {
      g.noiseAll(part, DARKB, 0.06);
    }
    for (const part of [R.root3, R.root4, R.root5]) {
      g.noiseAll(part, BONE, 0.05);
    }
  }},
});
