'use strict';
/* ============================================================
   造型档案 · 潜影贝 (shulker) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架(研究笔记 §5 海族): 底座 16×8×16 + 盖 16×12×16(head
   槽 — 攻击=开盖前扑) + 探头小头 6×6×6(盖沿下探出)。
   紫壳环纹+探头脸画进贴图。贴图 128 档(两个 16 宽十字
   各占一整行, 64 竖向放不下探头)。
   interface: declare('shulker', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('shulker', {
  debris: 0x8a5a9a,
  bones: {
    root: {pivot: [0, 0, 0], add: [{origin: [-8, 0, -8], size: [16, 8, 16], uv: [0, 0]}]},
    head: {pivot: [0, 8, 0], add: [
      {origin: [-8, 8, -8], size: [16, 12, 16], uv: [0, 26]}, /* 盖 */
      {origin: [-3, 5, -3], size: [6, 6, 6], uv: [0, 56]}, /* 探头(盖沿下) */
    ]},
  },
  tex: {size: 128, paint: (g, R) => {
    const SHELL = [138, 90, 154]; const SHELL2 = [106, 63, 122];
    const LIP = [216, 176, 255]; const DARK = [42, 26, 48];
    /* 底座: 紫壳噪底 · 顶环压暗 */
    g.noiseAll(R.root, SHELL, 0.06);
    g.fill([R.root.top[0], R.root.top[1], R.root.top[2], 2], SHELL2); /* 顶环 */
    g.mul(R.root.bottom, 0.7);
    /* 盖(head): 紫壳 · 口沿亮唇(底两行) · 螺旋纹(顶面) */
    g.noiseAll(R.head, SHELL, 0.06);
    for (const f of ['front', 'back', 'left', 'right']) {
      g.fill([R.head[f][0], R.head[f][1] + R.head[f][3] - 2, R.head[f][2], 2], LIP); /* 口沿 */
    }
    const T = R.head.top;
    for (let i = 0; i < 4; i++) {/* 顶面旋纹 */
      g.fill([T[0] + 2 + i * 2, T[1] + 2 + i * 2, T[2] - 4 - i * 4, 1], SHELL2);
    }
    /* 探头(head2): 亮紫+脸(眼+嘴) */
    g.noiseAll(R.head2, LIP, 0.05);
    const F = R.head2.front;
    g.fill([F[0] + 1, F[1] + 2, 1, 1], DARK); g.fill([F[0] + 4, F[1] + 2, 1, 1], DARK); /* 眼 */
    g.fill([F[0] + 2, F[1] + 4, 2, 1], DARK); /* 嘴 */
  }},
});
