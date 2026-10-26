'use strict';
/* ============================================================
   造型档案 · 铁傀儡 (golem) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架直填(bedrock iron_golem.geo 核对, UV 锚沿用官方布局):
   身 18×12×11 + 胸甲 9×5×6 inflate 0.5 + 头 8×10×8 + 鼻 2×4×2 +
   **双臂 4×30×6**(垂到 y3.5 无腿长臂是辨识件) + 腿 6×16×5。
   苔痕(种子化)+红瞳画进贴图。贴图 128 档。
   interface: declare('golem', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('golem', {
  debris: 0xcdd0d8,
  bones: {
    root: {pivot: [0, 31, 0], add: [
      {origin: [-9, 21, -6], size: [18, 12, 11], uv: [0, 40]},
      {origin: [-4.5, 16, -3], size: [9, 5, 6], uv: [0, 70], inflate: 0.5}, /* 胸甲 */
    ]},
    head: {pivot: [0, 31, -2], add: [
      {origin: [-4, 33, -7.5], size: [8, 10, 8], uv: [0, 0]},
      {origin: [-1, 32, -9.5], size: [2, 4, 2], uv: [24, 0]}, /* 鼻 */
    ]},
    armL: {pivot: [0, 31, 0], add: [{origin: [9, 3.5, -3], size: [4, 30, 6], uv: [60, 58]}]},
    armR: {pivot: [0, 31, 0], add: [{origin: [-13, 3.5, -3], size: [4, 30, 6], uv: [60, 21]}]},
    legL: {pivot: [5, 13, 0], add: [{origin: [1.5, 0, -3], size: [6, 16, 5], uv: [60, 0]}]},
    legR: {pivot: [-4, 13, 0], add: [{origin: [-7.5, 0, -3], size: [6, 16, 5], uv: [37, 0]}]},
  },
  tex: {size: 128, paint: (g, R) => {
    const IRON = [205, 208, 216]; const IRON2 = [170, 176, 187];
    const DARK = [85, 90, 99]; const VINE = [74, 122, 58];
    const EYE = [255, 42, 26];
    /* 铁皮笔触: 铁白噪底 + 种子化苔痕(肩/背/腿根, 同 type 同图) */
    const iron = (r) => {
      g.noise(r, IRON, 0.05);
      for (let i = 0; i < Math.max(1, r[2] * r[3] / 40); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]),
            g.rng() < 0.7 ? VINE : IRON2);
      }
    };
    /* 身+胸甲: 铁皮 · 胸甲压暗 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) iron(R.root[f]);
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) iron(R.root2[f]);
    g.mul(R.root2.front, 0.85);
    /* 头: 铁皮 · 一字眉(深) · 红瞳(两颗) · 下颌压暗 */
    const F = R.head.front;
    iron(F);
    g.fill([F[0], F[1] + 3, 8, 1], DARK); /* 一字眉 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], EYE); g.fill([F[0] + 5, F[1] + 4, 2, 2], EYE);
    g.fill([F[0] + 2, F[1] + 9, 4, 1], DARK); /* 下颌缝 */
    for (const f of ['back', 'left', 'right', 'top']) iron(R.head[f]);
    iron(R.head.bottom); g.mul(R.head.bottom, 0.8);
    /* 鼻: 深铁 */
    g.noiseAll(R.head2, DARK, 0.08);
    /* 长臂+双腿: 铁皮 · 指节压暗 */
    for (const arm of [R.armL, R.armR]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) iron(arm[f]);
      g.fill([arm.front[0], arm.front[1] + arm.front[3] - 3, arm.front[2], 1], DARK); /* 指节 */
    }
    for (const leg of [R.legL, R.legR]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) iron(leg[f]);
      g.mul(leg.bottom, 0.8);
    }
  }},
});
