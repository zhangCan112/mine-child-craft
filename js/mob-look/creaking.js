'use strict';
/* ============================================================
   造型档案 · 嘎枝 (creaking) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方非对称骨架直填(研究笔记 §5 草木族): 头 6×10×6 + 冠 6×3×6 +
   脸平面盒 9×14×0 + 身 6×13×5 + **双臂异长 3×21×3 / 3×16×3** +
   腿 3×16×3 + 根脚平面盒 5×0×9。橙光眼画在脸平面(官方夜光瞳)。
   interface: declare('creaking', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('creaking', {
  debris: 0x54402e,
  bones: {
    root: {pivot: [0, 16, 0], add: [
      {origin: [-3, 13, -2.5], size: [6, 13, 5], uv: [0, 0]}, /* 身 */
      {origin: [-4.5, 12, -3], size: [9, 14, 0], uv: [24, 0]}, /* 脸(平面盒) */
      {origin: [-2.5, 0, -4.5], size: [5, 0, 9], uv: [26, 38]}, /* 根脚(平面盒) */
    ]},
    head: {pivot: [0, 26, -4], add: [
      {origin: [-4, 26, -7], size: [6, 10, 6], uv: [0, 20]},
      {origin: [-4, 36, -7], size: [6, 3, 6], uv: [26, 20]}, /* 冠 */
    ]},
    armL: {pivot: [4.5, 24, 0], add: [{origin: [3, 3, -1.5], size: [3, 21, 3], uv: [0, 38]}]},
    armR: {pivot: [-4.5, 24, 0], add: [{origin: [-6, 8, -1.5], size: [3, 16, 3], uv: [14, 38]}]},
    legL: {pivot: [1.5, 13, 0], add: [{origin: [0, 0, -1.5], size: [3, 16, 3], uv: [14, 38]}]},
    legR: {pivot: [-1.5, 13, 0], add: [{origin: [-3, 0, -1.5], size: [3, 16, 3], uv: [14, 38]}]},
  },
  tex: {size: 64, paint: (g, R) => {
    const BARK = [84, 64, 46]; const BARK2 = [64, 48, 34];
    const DARK = [30, 22, 14]; const GLOW = [255, 138, 42];
    /* 树皮笔触: 棕噪底 + 竖纹理 */
    const bark = (r) => {
      g.noise(r, BARK, 0.08);
      for (let x = 0; x < r[2]; x += 3) {
        if (g.rng() < 0.6) g.fill([r[0] + x, r[1], 1, r[3]], BARK2);
      }
    };
    /* 身: 树皮 · 脸平面(root2): 深木底+橙光眼(两颗大瞳) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) bark(R.root[f]);
    const F = R.root2.front;
    g.fill(F, DARK);
    g.fill([F[0] + 1, F[1] + 3, 2, 3], GLOW); g.fill([F[0] + 6, F[1] + 3, 2, 3], GLOW); /* 光瞳 */
    g.fill([F[0] + 2, F[1] + 10, 5, 2], BARK2); /* 歪嘴 */
    const FB = R.root2.back;
    g.fill(FB, BARK2);
    /* 根脚(root3, 平面盒): 深木根须(两面) */
    for (const f of ['top', 'bottom']) {
      const p = R.root3[f];
      g.noise(p, BARK2, 0.1);
      for (let x = 1; x < p[2]; x += 2) g.fill([p[0] + x, p[1], 1, p[3]], DARK); /* 根须 */
    }
    /* 头+冠: 树皮 · 冠压暗 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) bark(R.head[f]);
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head2[f], BARK2, 0.08);
    }
    /* 长臂/短臂+双腿(臂腿同形共区): 树皮+节疤 */
    for (const part of [R.armL, R.armR, R.legL, R.legR]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        bark(part[f]);
      }
      g.px(part.front[0] + 1, part.front[1] + 4, DARK); /* 节疤 */
      g.mul(part.bottom, 0.8);
    }
  }},
});
