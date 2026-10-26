'use strict';
/* ============================================================
   造型档案 · 苦力怕 (creeper) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方独有骨架(无臂四足矮身, docs/mc-mob-models-research.md §5 草木族):
   头 8³(枢轴 y18) · 身 8×12×4(低位 y6..18) · 四条 4×6×4 短腿(对角成对
   进 legL/legR 槽, 与旧 MOB_RIG 同构)。脸纹(垂腿嘴)自绘画进贴图 —
   语义语言口径 D13(只取结构语义, 像素自绘)。
   interface: declare('creeper', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('creeper', {
  debris: 0x4fae4f,
  tex: {size: 64, paint: (g, R) => {
    const GREEN = [79, 174, 79]; const GREEN2 = [61, 143, 61]; const DARK = [16, 21, 16];
    /* 苔斑噪底: 全区域绿底+深斑(种子化, 同 type 同图) */
    const mottle = (r) => {
      g.noise(r, GREEN, 0.1);
      for (let i = 0; i < Math.max(2, r[2] * r[3] / 6); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]), GREEN2);
      }
    };
    /* 头: 绿斑底 · 眼 2×2 · 垂腿嘴(自绘款, 官方嘴形语义) */
    const F = R.head.front;
    mottle(F);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 3, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 2], DARK); /* 嘴心柱 */
    g.fill([F[0] + 2, F[1] + 6, 1, 2], DARK); g.fill([F[0] + 5, F[1] + 6, 1, 2], DARK); /* 垂腿 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) mottle(R.head[f]);
    /* 身与四腿: 同款苔斑 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) mottle(R.root[f]);
    for (const leg of [R.legL, R.legL2, R.legR, R.legR2]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) mottle(leg[f]);
    }
  }},
  /* 自有骨架: 不引基座(无基座可用) — bones 对未存在的骨名新建槽(带 pivot) */
  bones: {
    head: {add: [{origin: [-4, 18, -4], size: [8, 8, 8], uv: [0, 0]}], pivot: [0, 18, 0]},
    root: {add: [{origin: [-4, 6, -2], size: [8, 12, 4], uv: [16, 16]}], pivot: [0, 12, 0]},
    legL: {add: [{origin: [-4, 0, 2], size: [4, 6, 4], uv: [0, 16]},
      {origin: [-4, 0, -6], size: [4, 6, 4], uv: [0, 28]}], pivot: [-2, 6, 0]},
    legR: {add: [{origin: [0, 0, 2], size: [4, 6, 4], uv: [0, 40]},
      {origin: [0, 0, -6], size: [4, 6, 4], uv: [0, 52]}], pivot: [2, 6, 0]},
  },
});
