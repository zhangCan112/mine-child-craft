'use strict';
/* ============================================================
   造型档案 · 幻翼 (phantom) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方蝠鲼骨架直填(研究笔记 §5 鬼一族): 体 5×3×9 · 头 7×3×5
   (rx 仰 11.5° 官方 bind 姿态) · 翼 6×2×9 + 翼尖 13×1×9(rz 上反
   5.7°) · 尾 3×2×6 + 尾尖 1×1×6。双翼挂 wingL/wingR 槽 axis 'z'
   (引擎扇翅)。绿瞳画进贴图。
   interface: declare('phantom', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('phantom', {
  debris: 0x3a5a7a,
  bones: {
    head: {pivot: [0, 5, -4.5], add: [
      {origin: [-3.5, 3.5, -9.5], size: [7, 3, 5], uv: [32, 0], rx: 0.2},
    ]},
    root: {pivot: [0, 5, 0], add: [
      {origin: [-2.5, 3.5, -4.5], size: [5, 3, 9], uv: [0, 0]},
      {origin: [-1.5, 4, 4.5], size: [3, 2, 6], uv: [0, 14]}, /* 尾 */
      {origin: [-0.5, 4.5, 10.5], size: [1, 1, 6], uv: [20, 14]}, /* 尾尖 */
    ]},
    wingL: {pivot: [2.5, 6, 0], axis: 'z', add: [
      {origin: [2.5, 4, -4.5], size: [6, 2, 9], uv: [0, 26]},
      {origin: [8.5, 5, -4.5], size: [13, 1, 9], uv: [0, 40], rz: 0.1}, /* 翼尖上反 */
    ]},
    wingR: {pivot: [-2.5, 6, 0], axis: 'z', add: [
      {origin: [-8.5, 4, -4.5], size: [6, 2, 9], uv: [0, 26]}, /* 与左翼共区 */
      {origin: [-21.5, 5, -4.5], size: [13, 1, 9], uv: [0, 40], rz: -0.1}, /* 翼尖共区 */
    ]},
  },
  tex: {size: 64, paint: (g, R) => {
    const BLUE = [88, 122, 152]; const BLUE2 = [68, 94, 122];
    const DARK = [18, 28, 40]; const EYE = [154, 216, 60];
    /* 头: 蓝灰底 · 绿瞳(两颗) · 尖牙嘴 */
    const F = R.head.front;
    g.noise(F, BLUE, 0.06);
    g.fill([F[0] + 1, F[1] + 1, 1, 1], EYE); g.fill([F[0] + 5, F[1] + 1, 1, 1], EYE);
    g.fill([F[0] + 2, F[1] + 2, 3, 1], DARK); /* 嘴 */
    g.px(F[0] + 2, F[1] + 2, [230, 230, 230]); g.px(F[0] + 4, F[1] + 2, [230, 230, 230]); /* 尖牙 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], BLUE, 0.06);
    /* 体+尾+尾尖: 蓝灰底 · 背脊纹 */
    for (const part of [R.root, R.root2, R.root3]) {
      g.noiseAll(part, BLUE, 0.06);
    }
    g.fill([R.root.top[0] + 2, R.root.top[1], 1, R.root.top[3]], BLUE2); /* 背脊线 */
    g.mul(R.root3.front, 0.9); /* 尾尖压暗 */
    /* 双翼(共区)+翼尖(共区): 深蓝翼面 · 翼骨线 */
    for (const wing of [R.wingL, R.wingL2, R.wingR, R.wingR2]) {
      g.noiseAll(wing, BLUE2, 0.06);
      g.fill([wing.top[0], wing.top[1], wing.top[2], 1], BLUE); /* 翼骨 */
    }
  }},
});
