'use strict';
/* ============================================================
   造型档案 · 洞穴蜘蛛 (cave_spider) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   蜘蛛骨架逐字复用 + **scale 0.7**(wiki 口径, 研究笔记 §5 虫虫族)。
   蓝黑配色(配色锚延续旧 MOB_RIG); 多眼簇/螯肢画进贴图。
   interface: declare('cave_spider', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('cave_spider', {
  scale: 0.7,
  debris: 0x1a3a4a,
  bones: {
    head: {add: [{origin: [-4, 5, -11], size: [8, 8, 8], uv: [32, 0]}], pivot: [0, 9, -3]},
    root: {add: [
      {origin: [-3, 6, -3], size: [6, 6, 6], uv: [0, 0]}, /* 前体 */
      {origin: [-5, 5, 3], size: [10, 8, 12], uv: [0, 20]}, /* 腹 */
    ], pivot: [0, 9, 0]},
    legL: {add: [ /* 左四杆(官方 z 交错 2/1/0/-1, 微扇形) */
      {origin: [-19, 8, 1], size: [16, 2, 2], uv: [0, 44]},
      {origin: [-19, 8, 0], size: [16, 2, 2], uv: [0, 48]},
      {origin: [-19, 8, -1], size: [16, 2, 2], uv: [0, 52]},
      {origin: [-19, 8, -2], size: [16, 2, 2], uv: [0, 56]},
    ], pivot: [-4, 9, 0]},
    legR: {add: [ /* 右四杆(x 镜像; UV 与左共用 — 腿通体深色, 共区无感) */
      {origin: [3, 8, 1], size: [16, 2, 2], uv: [0, 44]},
      {origin: [3, 8, 0], size: [16, 2, 2], uv: [0, 48]},
      {origin: [3, 8, -1], size: [16, 2, 2], uv: [0, 52]},
      {origin: [3, 8, -2], size: [16, 2, 2], uv: [0, 56]},
    ], pivot: [4, 9, 0]},
  },
  tex: {size: 64, paint: (g, R) => {
    const BODY = [26, 58, 74]; const BODY2 = [18, 40, 51];
    const LEG = [18, 40, 51]; const RED = [216, 58, 42]; const DARKR = [128, 26, 16];
    /* 头: 蓝黑噪底 · 多眼簇(大红对 + 暗红小对) · 螯肢 */
    const F = R.head.front;
    g.noise(F, BODY, 0.08);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], RED); g.fill([F[0] + 5, F[1] + 3, 2, 2], RED);
    g.px(F[0], F[1] + 4, DARKR); g.px(F[0] + 7, F[1] + 4, DARKR);
    g.px(F[0] + 3, F[1] + 2, DARKR); g.px(F[0] + 4, F[1] + 2, DARKR);
    g.fill([F[0] + 3, F[1] + 6, 1, 2], DARKR); g.fill([F[0] + 4, F[1] + 6, 1, 2], DARKR);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head[f], BODY, 0.08);
    }
    /* 体两节(root=前体, root2=腹): 蓝黑底 + 腹背纹 */
    for (const part of [R.root, R.root2]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], BODY, 0.08);
      }
    }
    g.fill([R.root2.back[0] + 4, R.root2.back[1], 2, R.root2.back[3]], BODY2); /* 腹尾纹 */
    /* 八腿杆(左右共区): 通体深蓝 */
    for (const leg of [R.legL, R.legL2, R.legL3, R.legL4, R.legR, R.legR2, R.legR3, R.legR4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], LEG, 0.06);
      }
    }
  }},
});
