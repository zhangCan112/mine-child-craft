'use strict';
/* ============================================================
   造型档案 · 史莱姆 (slime) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   软软族官方简化: 外壳 8×8×8 单盒(head 单槽 — 攻击=整体前扑,
   官方内核 6×6×6+立体眼嘴是不透明材质下的隐藏件, 改画进贴图;
   外壳半透明材质是官方语言, 引擎单材质不透明 — 中心暗核用
   贴图内衬方表达, 研究笔记 §5 软软族口径)。绿凝胶+傻笑脸。
   interface: declare('slime', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('slime', {
  debris: 0x5ac85a,
  bones: {head: {pivot: [0, 4, 0], add: [
    {origin: [-4, 0, -4], size: [8, 8, 8], uv: [0, 0]},
  ]}},
  tex: {size: 64, paint: (g, R) => {
    const GEL = [90, 200, 90]; const GEL2 = [58, 138, 58];
    const DARK = [20, 58, 20];
    /* 六面: 凝胶底 + 内衬暗方(半透明的贴图等价 — 边缘亮芯暗) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head[f], GEL, 0.05);
      const r = R.head[f];
      g.fill([r[0] + 1, r[1] + 1, r[2] - 2, r[3] - 2], GEL2);
      g.noise([r[0] + 1, r[1] + 1, r[2] - 2, r[3] - 2], GEL2, 0.08);
    }
    /* 脸: 眯眼(两道) + 傻笑嘴 */
    const F = R.head.front;
    g.fill([F[0] + 1, F[1] + 3, 2, 1], DARK); g.fill([F[0] + 5, F[1] + 3, 2, 1], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], DARK); /* 嘴 */
    g.px(F[0] + 2, F[1] + 6, DARK); g.px(F[0] + 5, F[1] + 6, DARK); /* 嘴角 */
    g.mul(R.head.bottom, 0.85);
  }},
});
