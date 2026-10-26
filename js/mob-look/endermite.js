'use strict';
/* ============================================================
   造型档案 · 末影螨 (endermite) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方四节分节链(研究笔记 §5 虫虫族: 6×4×5 / 4×3×2 / 3×3×1 /
   1×2×1)。头节归 head 槽(攻击前扑), 尾三节归 root; 紫壳+品红
   眼(配色锚延续旧 MOB_RIG)。
   interface: declare('endermite', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('endermite', {
  debris: 0x8a5ab8,
  bones: {
    head: {pivot: [0, 2, -4], add: [
      {origin: [-3, 0, -5], size: [6, 4, 5], uv: [0, 0]}, /* 头节 */
    ]},
    root: {pivot: [0, 2, 1], add: [
      {origin: [-2, 0, 0], size: [4, 3, 2], uv: [24, 0]},
      {origin: [-1.5, 0, 2], size: [3, 3, 1], uv: [38, 0]},
      {origin: [-0.5, 0, 3], size: [1, 2, 1], uv: [48, 0]},
    ]},
  },
  tex: {size: 64, paint: (g, R) => {
    const PURP = [138, 90, 184]; const PURP2 = [112, 70, 152];
    const MAG = [208, 107, 255]; const DARK = [42, 26, 58];
    /* 头节: 紫壳噪底 · 品红眼(两颗) · 蠕动纹 */
    const F = R.head.front;
    g.noise(F, PURP, 0.07);
    g.fill([F[0] + 1, F[1] + 1, 1, 2], MAG); g.fill([F[0] + 4, F[1] + 1, 1, 2], MAG);
    g.fill([F[0] + 2, F[1] + 3, 2, 1], DARK); /* 口 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], PURP, 0.07);
    g.mul(R.head.bottom, 0.85);
    /* 尾三节: 逐节压暗的紫壳 */
    const shades = [0.92, 0.84, 0.76];
    [R.root, R.root2, R.root3].forEach((seg, i) => {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(seg[f], PURP2, 0.07);
        g.mul(seg[f], shades[i]);
      }
    });
  }},
});
