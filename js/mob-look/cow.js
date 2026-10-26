'use strict';
/* ============================================================
   造型档案 · 牛 (cow) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   四足基座官方等比(身 12×10×18 预躺平 · 头 8×8×6 · 腿 4×12×4,
   研究笔记 §5 农场一家) + 双角 1×3×1 + 乳 4×6×1 追加骨。
   白斑(种子化)+粉吻+浅鼻镜画进贴图; 四腿共区(同色牛蹄)。
   interface: declare('cow', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('cow', {
  base: ['quad', {
    w: 12, h: 10, len: 18, bodyCY: 15, bodyCZ: 0,
    legW: 4, legH: 12, legX: 4, legZF: -6.5, legZB: 6.5,
    headW: 8, headH: 8, headD: 6, headCY: 19, headCZ: -11, headPY: 18, headPZ: -8,
    bodyUV: [0, 0], headUV: [0, 32],
    legUVs: [[0, 46], [0, 46], [0, 46], [0, 46]], /* 四腿共区 */
  }],
  debris: 0x8c664d,
  bones: {
    head: {add: [
      {origin: [3.5, 22, -12], size: [1, 3, 1], uv: [30, 32]}, /* 左角 */
      {origin: [-4.5, 22, -12], size: [1, 3, 1], uv: [30, 32]}, /* 右角(共区) */
    ]},
    root: {add: [{origin: [-2, 9, 2], size: [4, 1, 6], uv: [34, 32]}]}, /* 乳 */
  },
  tex: {size: 64, paint: (g, R) => {
    const BROWN = [140, 102, 77]; const BROWN2 = [112, 78, 57];
    const WHITE = [232, 228, 220]; const DARK = [28, 18, 14];
    const HORN = [240, 232, 216]; const PINK = [226, 168, 158];
    /* 白斑牛皮: 棕噪底 + 种子化白斑(同 type 同图) */
    const hide = (r) => {
      g.noise(r, BROWN, 0.06);
      for (let i = 0; i < Math.max(1, r[2] * r[3] / 14); i++) {
        const x = r[0] + Math.floor(g.rng() * (r[2] - 2));
        const y = r[1] + Math.floor(g.rng() * (r[3] - 2));
        g.fill([x, y, 2 + Math.floor(g.rng() * 2), 2], WHITE);
      }
    };
    /* 身(六面白斑牛皮) · 乳(root2): 粉 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) hide(R.root[f]);
    g.noiseAll(R.root2, PINK, 0.05);
    /* 头: 白斑底 · 白鼻梁 · 眼 · 浅鼻镜 */
    const F = R.head.front;
    hide(F);
    g.fill([F[0] + 3, F[1], 2, 8], WHITE); /* 白鼻梁 */
    g.fill([F[0] + 1, F[1] + 3, 1, 2], DARK); g.fill([F[0] + 6, F[1] + 3, 1, 2], DARK);
    g.fill([F[0] + 2, F[1] + 6, 4, 2], PINK); /* 鼻镜 */
    g.px(F[0] + 3, F[1] + 6, DARK); g.px(F[0] + 4, F[1] + 6, DARK); /* 鼻孔 */
    for (const f of ['back', 'left', 'right', 'top']) hide(R.head[f]);
    g.noise(R.head.bottom, PINK, 0.05); g.mul(R.head.bottom, 0.85);
    /* 双角(共区 head2): 米白 */
    for (const part of [R.head2, R.head3]) {
      g.noiseAll(part, HORN, 0.05);
    }
    /* 四腿(共区): 棕腿+深蹄 */
    for (const leg of [R.legL, R.legL2, R.legR, R.legR2]) {
      g.noiseAll(leg, BROWN2, 0.06);
      g.fill([leg.front[0], leg.front[1] + leg.front[3] - 2, leg.front[2], 2], DARK); /* 蹄 */
    }
  }},
});
