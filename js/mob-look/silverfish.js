'use strict';
/* ============================================================
   造型档案 · 蠹虫 (silverfish) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方分节链直填(bedrock silverfish.geo 核对): 7 节体(6×4×3 主节
   向头尾递减到 1×1×2) + 3 片刚毛层(10×8×3/6×4×3/6×5×2)。
   前两节+前刚毛归 head 槽(攻击前扑), 其余归 root; 官方无腿骨
   (蠕动动画在 bodyPart 摆动 — 静态骨架不迁)。石灰色小虫。
   interface: declare('silverfish', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('silverfish', {
  debris: 0x9a9a8a,
  bones: {
    head: {pivot: [0, 2, -2], add: [
      {origin: [-1.5, 0, -4.5], size: [3, 2, 2], uv: [0, 22]}, /* 头节 */
      {origin: [-2, 0, -2.5], size: [4, 3, 2], uv: [12, 22]}, /* 次节 */
      {origin: [-3, 0, -3], size: [6, 5, 2], uv: [0, 13]}, /* 前刚毛层 */
    ]},
    root: {pivot: [0, 4, 1], add: [
      {origin: [-3, 0, -0.5], size: [6, 4, 3], uv: [18, 13]}, /* 主节 */
      {origin: [-1.5, 0, 2.5], size: [3, 3, 3], uv: [38, 13]},
      {origin: [-1, 0, 5.5], size: [2, 2, 3], uv: [26, 22]},
      {origin: [-1, 0, 8.5], size: [2, 1, 2], uv: [42, 22]},
      {origin: [-0.5, 0, 10.5], size: [1, 1, 2], uv: [52, 22]},
      {origin: [-5, 0, -0.5], size: [10, 8, 3], uv: [0, 0]}, /* 大刚毛裙 */
      {origin: [-3, 0, 5.5], size: [6, 4, 3], uv: [28, 0]}, /* 后刚毛层 */
    ]},
  },
  tex: {size: 64, paint: (g, R) => {
    const STONE = [154, 154, 138]; const STONE2 = [128, 128, 112];
    const BRIS = [106, 106, 90]; const DARK = [30, 30, 24];
    /* 头节: 石灰底 · 黑眼(两颗) */
    const F = R.head.front;
    g.noise(F, STONE, 0.06);
    g.px(F[0], F[1], DARK); g.px(F[0] + 2, F[1], DARK);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], STONE, 0.06);
    /* 次节: 石灰压暗 */
    g.noiseAll(R.head2, STONE2, 0.06);
    /* 前刚毛层(head3): 深刚毛 */
    g.noiseAll(R.head3, BRIS, 0.15);
    /* 主节(root): 石灰 · 其余尾节逐节压暗 */
    g.noiseAll(R.root, STONE, 0.06);
    const shades = [0.92, 0.85, 0.78, 0.7];
    [R.root2, R.root3, R.root4, R.root5].forEach((seg, i) => {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(seg[f], STONE2, 0.06);
        g.mul(seg[f], shades[i]);
      }
    });
    /* 大刚毛裙(root6) · 后刚毛层(root7): 深刚毛 */
    for (const part of [R.root6, R.root7]) {
      g.noiseAll(part, BRIS, 0.15);
    }
  }},
});
