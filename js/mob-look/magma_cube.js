'use strict';
/* ============================================================
   造型档案 · 岩浆怪 (magma_cube) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   软软族官方简化: 外壳 8×8×8 单盒(head 单槽 — 攻击=整体前扑)。
   官方 8 层 8×1×8 薄片是跳动动画语言, 静态骨架取整盒+贴图横缝
   表达层理(研究笔记 §5 软软族); 岩浆核透过深壳裂缝发光(橙色
   裂纹画进贴图 — 配色锚延续旧 MOB_RIG 壳+岩浆核+炽眼, 深壳提亮对齐官方)。
   interface: declare('magma_cube', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('magma_cube', {
  debris: 0xe8641a,
  bones: {head: {pivot: [0, 4, 0], add: [
    {origin: [-4, 0, -4], size: [8, 8, 8], uv: [0, 0]},
  ]}},
  tex: {size: 64, paint: (g, R) => {
    const CRUST = [88, 66, 54]; const LAVA = [232, 100, 26];
    const LAVA2 = [255, 210, 60];
    /* 六面: 深壳噪底 + 岩浆裂纹(层缝横线 + 种子化竖裂) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      const r = R.head[f];
      g.noise(r, CRUST, 0.12);
      for (let y = 1; y < r[3]; y += 2) {/* 层缝 */
        g.fill([r[0], r[1] + y, r[2], 1], LAVA);
      }
      for (let i = 0; i < Math.max(4, r[2]); i++) {/* 竖裂(两节) */
        const x = r[0] + Math.floor(g.rng() * r[2]);
        const y = r[1] + 1 + Math.floor(g.rng() * (r[3] - 3));
        g.fill([x, y, 1, 2], LAVA2);
      }
    }
    /* 脸: 炽眼(炽黄) + 怒嘴 */
    const F = R.head.front;
    g.fill([F[0] + 1, F[1] + 2, 2, 2], LAVA2); g.fill([F[0] + 5, F[1] + 2, 2, 2], LAVA2);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], LAVA2); /* 嘴 */
    g.px(F[0] + 2, F[1] + 5, LAVA2); g.px(F[0] + 5, F[1] + 5, LAVA2); /* 嘴角 */
  }},
});
