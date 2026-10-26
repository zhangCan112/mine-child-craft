'use strict';
/* ============================================================
   造型档案 · 猪 (pig) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   四足基座官方等比(身 10×8×16 预躺平 · 头 8×8×8 · **短腿 4×6×4**,
   研究笔记 §5 农场一家) + 鼻 4×3×1 追加骨(猪的立体辨识件)。
   粉肤+鼻孔画进贴图; 四腿共区(同色蹄)。
   interface: declare('pig', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('pig', {
  base: ['quad', {
    w: 10, h: 8, len: 16, bodyCY: 9, bodyCZ: 0,
    legW: 4, legH: 6, legX: 3, legZF: -5.5, legZB: 5.5,
    headW: 8, headH: 8, headD: 8, headCY: 11, headCZ: -10, headPY: 10, headPZ: -6,
    bodyUV: [0, 0], headUV: [0, 28],
    legUVs: [[0, 46], [0, 46], [0, 46], [0, 46]], /* 四腿共区 */
  }],
  debris: 0xe69ea8,
  bones: {head: {add: [{origin: [-2, 8, -15], size: [4, 3, 1], uv: [36, 28]}]}}, /* 鼻 */
  tex: {size: 64, paint: (g, R) => {
    const PINK = [230, 158, 168]; const PINK2 = [204, 130, 142];
    const DARK = [42, 26, 26];
    /* 身: 粉肤噪底(六面) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], PINK, 0.05);
    }
    g.mul(R.root.bottom, 0.85);
    /* 头: 粉肤 · 眼(两颗) · 大鼻盘区 */
    const F = R.head.front;
    g.noise(F, PINK, 0.05);
    g.fill([F[0] + 1, F[1] + 3, 1, 2], DARK); g.fill([F[0] + 6, F[1] + 3, 1, 2], DARK);
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], PINK, 0.05);
    g.noise(R.head.bottom, PINK, 0.05); g.mul(R.head.bottom, 0.8);
    /* 鼻(head2): 深粉盘 + 双鼻孔 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head2[f], PINK2, 0.05);
    }
    const SN = R.head2.front;
    g.px(SN[0] + 1, SN[1] + 1, DARK); g.px(SN[0] + 2, SN[1] + 1, DARK); /* 鼻孔 */
    /* 四腿(共区): 粉腿+深蹄 */
    for (const leg of [R.legL, R.legL2, R.legR, R.legR2]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], PINK2, 0.05);
      }
      g.fill([leg.front[0], leg.front[1] + leg.front[3] - 1, leg.front[2], 1], DARK); /* 蹄 */
    }
  }},
});
