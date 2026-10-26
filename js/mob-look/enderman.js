'use strict';
/* ============================================================
   造型档案 · 末影人 (enderman) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方等比细长骨架(研究笔记 §5 鬼一族): 头 8×8×8 · 身 8×12×4 ·
   **四肢 2×30×2**(总高 46px 悬浮身高 — 腿上移 4px 贴地, 模型高
   于碰撞箱是 MC 口径)。横紫瞳画进贴图(旧 rig 的眼条盒撤销)。
   四肢同形同色 — 共区。
   interface: declare('enderman', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('enderman', {
  debris: 0x101018,
  bones: {
    head: {pivot: [0, 42, 0], add: [{origin: [-4, 42, -4], size: [8, 8, 8], uv: [0, 0]}]},
    root: {pivot: [0, 30, 0], add: [{origin: [-4, 30, -2], size: [8, 12, 4], uv: [16, 16]}]},
    armL: {pivot: [3, 40, 0], add: [{origin: [2, 10, -1], size: [2, 30, 2], uv: [40, 0]}]},
    armR: {pivot: [-3, 40, 0], add: [{origin: [-4, 10, -1], size: [2, 30, 2], uv: [40, 0]}]},
    legL: {pivot: [2, 30, 0], add: [{origin: [1, 0, -1], size: [2, 30, 2], uv: [40, 0]}]},
    legR: {pivot: [-2, 30, 0], add: [{origin: [-3, 0, -1], size: [2, 30, 2], uv: [40, 0]}]},
  },
  tex: {size: 64, paint: (g, R) => {
    const BLACK = [42, 42, 56]; const BLACK2 = [30, 30, 44];
    const PURP = [208, 107, 255]; const WHT = [235, 220, 245];
    /* 头: 深黑影底 · 横紫瞳(官方长目, 上行提亮) + 白高光 */
    const F = R.head.front;
    g.noise(F, BLACK, 0.12);
    g.fill([F[0], F[1] + 3, 8, 2], PURP);
    g.fill([F[0] + 1, F[1] + 3, 6, 1], [232, 150, 255]);
    g.px(F[0] + 1, F[1] + 3, WHT); g.px(F[0] + 6, F[1] + 4, WHT);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], BLACK, 0.12);
    g.mul(R.head.bottom, 0.7);
    /* 身: 深黑影 · 微紫斑(虚空粒子感) */
    g.noiseAll(R.root, BLACK2, 0.12);
    for (let i = 0; i < 8; i++) {
      g.px(R.root.front[0] + Math.floor(g.rng() * R.root.front[2]),
          R.root.front[1] + Math.floor(g.rng() * R.root.front[3]), PURP);
    }
    /* 四肢(共区): 深黑长肢 */
    for (const part of [R.armR, R.armL, R.legR, R.legL]) {
      g.noiseAll(part, BLACK, 0.12);
      g.mul(part.bottom, 0.7);
    }
  }},
});
