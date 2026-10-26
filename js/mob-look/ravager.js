'use strict';
/* ============================================================
   造型档案 · 劫掠兽 (ravager) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   四足基座官方等比(bedrock ravager.geo 核对: 身 14×20×16 预躺平 ·
   腿 8×37×8 四条同规格 — quad 直用) + 胸 12×18×13(root 追加) +
   颈 10×10×18 + 嘴 16×3×16 + 鼻瘤 4×8×4 + 双角 2×14×4 rx60°
   (head 追加)。鞍压暗画进贴图。贴图 128 档。
   interface: declare('ravager', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('ravager', {
  base: ['quad', {
    w: 14, h: 20, len: 16, bodyCY: 13, bodyCZ: 3,
    legW: 8, legH: 37, legX: 8, legZF: -4, legZB: 21,
    headW: 16, headH: 20, headD: 16, headCY: 24, headCZ: -16, headPY: 28, headPZ: -10,
    bodyUV: [0, 59], headUV: [0, 0],
    legUVs: [[68, 50], [68, 50], [68, 50], [68, 50]], /* 四腿共区 */
  }],
  debris: 0x4a4a52,
  bones: {
    root: {add: [{origin: [-6, 5, -20], size: [12, 18, 13], uv: [0, 97]}]}, /* 胸 */
    head: {add: [
      {origin: [-5, 21, -10], size: [10, 10, 18], uv: [68, 0]}, /* 颈 */
      {origin: [-8, 13, -24], size: [16, 3, 16], uv: [0, 38]}, /* 嘴(下颚) */
      {origin: [-2, 12, -28], size: [4, 8, 4], uv: [68, 30]}, /* 鼻瘤 */
      {origin: [8, 27, -20], size: [2, 14, 4], uv: [88, 30], rx: 1.05}, /* 左角(60°) */
      {origin: [-10, 27, -20], size: [2, 14, 4], uv: [88, 30], rx: 1.05}, /* 右角(共区) */
    ]},
  },
  tex: {size: 128, paint: (g, R) => {
    const GREY = [74, 74, 82]; const GREY2 = [58, 58, 66];
    const DARK = [26, 26, 32]; const HORN = [240, 232, 216];
    const TEETH = [230, 226, 214]; const EYE = [216, 176, 40];
    const SADDLE = [44, 44, 51];
    /* 身: 灰皮噪底 · 背上鞍区(深色) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], GREY, 0.05);
    }
    const T = R.root.top;
    g.fill([T[0] + 1, T[1] + 1, T[2] - 2, T[3] - 2], SADDLE); /* 鞍 */
    g.mul(R.root.bottom, 0.88);
    /* 胸(root2): 深灰胸甲 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root2[f], GREY2, 0.05);
    }
    /* 头: 灰底 · 金眼 · 眉骨 */
    const F = R.head.front;
    g.noise(F, GREY, 0.05);
    g.fill([F[0] + 2, F[1] + 5, 3, 3], EYE); g.fill([F[0] + 11, F[1] + 5, 3, 3], EYE); /* 金眼 */
    g.fill([F[0] + 2, F[1] + 4, 12, 1], GREY2); /* 眉骨 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], GREY, 0.05);
    g.noise(R.head.bottom, GREY, 0.05); g.mul(R.head.bottom, 0.85);
    /* 颈(head2): 灰皮 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head2[f], GREY, 0.05);
    }
    /* 嘴(head3): 深口鼻 + 白牙列(上下缘) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head3[f], GREY2, 0.05);
    }
    const M = R.head3.front;
    g.fill([M[0], M[1], M[2], M[3]], DARK); /* 口鼻暗区 */
    for (let i = 0; i < 4; i++) {
      g.fill([M[0] + 1 + i * 4, M[1], 2, 2], TEETH); /* 牙 */
    }
    /* 鼻瘤(head4): 深灰 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head4[f], DARK, 0.15);
    }
    /* 双角(共区 head5/head6): 米白 */
    for (const part of [R.head5, R.head6]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.fill(part[f], HORN);
      }
    }
    /* 四腿(共区): 灰腿+深爪 */
    for (const leg of [R.legL, R.legL2, R.legR, R.legR2]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], GREY2, 0.05);
      }
      g.fill([leg.front[0], leg.front[1] + leg.front[3] - 3, leg.front[2], 3], DARK); /* 爪 */
    }
  }},
});
