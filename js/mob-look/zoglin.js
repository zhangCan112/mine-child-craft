'use strict';
/* ============================================================
   造型档案 · 僵尸疣猪兽 (zoglin) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   疣猪兽骨架逐字复用(官方换皮 — 研究笔记 §5 猪猪一家), 腐肉绿
   配色(配色锚延续旧 MOB_RIG)。贴图 128 档同布局。
   interface: declare('zoglin', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('zoglin', {
  debris: 0x7a8a5a,
  bones: {
    head: {pivot: [0, 22, -5], add: [
      {origin: [-7, 21, -24], size: [14, 6, 19], uv: [0, 44]},
      {origin: [6, 22, -19], size: [2, 11, 2], uv: [70, 44]}, /* 左獠牙 */
      {origin: [-8, 22, -19], size: [2, 11, 2], uv: [70, 44]}, /* 右獠牙(共区) */
      {origin: [7, 26, -10], size: [6, 1, 4], uv: [82, 44], rz: 0.87}, /* 左耳(50°) */
      {origin: [-13, 26, -10], size: [6, 1, 4], uv: [82, 44], rz: -0.87}, /* 右耳(共区) */
    ]},
    root: {pivot: [0, 18, 6], add: [
      {origin: [-8, 11, -7], size: [16, 14, 26], uv: [0, 0]},
      {origin: [0, 22, -10], size: [0, 10, 19], uv: [88, 0]}, /* 鬃毛中平面 */
    ]},
    legL: {pivot: [5, 11, 0], add: [
      {origin: [2, 0, -6], size: [6, 14, 6], uv: [0, 72]}, /* 前左 */
      {origin: [3, 0, 13], size: [5, 11, 5], uv: [28, 72]}, /* 后左 */
    ]},
    legR: {pivot: [-5, 11, 0], add: [
      {origin: [-8, 0, -6], size: [6, 14, 6], uv: [0, 72]}, /* 前右(与前左共区) */
      {origin: [-8, 0, 13], size: [5, 11, 5], uv: [28, 72]}, /* 后右(共区) */
    ]},
  },
  tex: {size: 128, paint: (g, R) => {
    const ROTT = [122, 138, 90]; const ROTT2 = [96, 110, 68];
    const MANE = [66, 80, 48]; const DARK = [28, 34, 20];
    const TUSK = [224, 220, 200]; const PINK = [158, 128, 108];
    /* 身: 腐肉绿噪底 · 背脊压暗 · 肚下肉粉 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], ROTT, 0.07);
    }
    g.mul([R.root.top[0], R.root.top[1], R.root.top[2], R.root.top[3]], 0.9);
    g.mul(R.root.bottom, 0.9);
    /* 鬃毛(root2): 暗绿硬毛 */
    for (const f of ['left', 'right']) {
      g.noise(R.root2[f], MANE, 0.12);
    }
    for (const f of ['front', 'back', 'top', 'bottom']) g.fill(R.root2[f], MANE);
    /* 头: 腐肉底 · 红眼(僵尸血统) · 吻端 */
    const F = R.head.front;
    g.noise(F, ROTT, 0.07);
    g.fill([F[0] + 2, F[1] + 1, 2, 2], [158, 44, 36]); g.fill([F[0] + 10, F[1] + 1, 2, 2], [158, 44, 36]);
    g.fill([F[0] + 4, F[1] + 4, 6, 2], PINK); /* 鼻盘 */
    g.px(F[0] + 5, F[1] + 4, DARK); g.px(F[0] + 8, F[1] + 4, DARK); /* 鼻孔 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], ROTT, 0.07);
    g.mul(R.head.bottom, 0.85);
    /* 獠牙(共区): 暗米白 */
    for (const part of [R.head2, R.head3]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.fill(part[f], TUSK);
      }
    }
    /* 双耳(共区): 腐绿 */
    for (const part of [R.head4, R.head5]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], ROTT2, 0.07);
      }
    }
    /* 前后腿: 深绿+黑蹄 */
    for (const leg of [R.legL, R.legR, R.legL2, R.legR2]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], ROTT2, 0.07);
      }
      g.fill([leg.front[0], leg.front[1] + leg.front[3] - 2, leg.front[2], 2], DARK); /* 蹄 */
    }
  }},
});
