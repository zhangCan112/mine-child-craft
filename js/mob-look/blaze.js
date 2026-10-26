'use strict';
/* ============================================================
   造型档案 · 烈焰人 (blaze) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架(研究笔记 §5 鬼一族): 黄金头 8×8×8 + **12 根 2×8×2
   烟杆**(官方四层×三杆绕头公转 — 静态骨架取四层环布, 杆分
   armL/armR 各 6 根, 攻击=杆云抡摆)。旧 rig 双臂槽 2 杆→
   官方 12 杆口径。烬点画进贴图。
   interface: declare('blaze', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('blaze', {
  debris: 0xe8c02a,
  bones: {
    head: {pivot: [0, 20, 0], add: [{origin: [-4, 16, -4], size: [8, 8, 8], uv: [0, 0]}]},
    armL: {pivot: [0, 10, 0], add: [ /* 一三层(共区) */
      {origin: [5.5, 4, -1], size: [2, 8, 2], uv: [32, 0]},
      {origin: [-4.25, 4, 4.63], size: [2, 8, 2], uv: [32, 0]},
      {origin: [-4.25, 4, -6.63], size: [2, 8, 2], uv: [32, 0]},
      {origin: [2.25, 12, 4.63], size: [2, 8, 2], uv: [32, 0]},
      {origin: [-7.5, 12, -1], size: [2, 8, 2], uv: [32, 0]},
      {origin: [2.25, 12, -6.63], size: [2, 8, 2], uv: [32, 0]},
    ]},
    armR: {pivot: [0, 14, 0], add: [ /* 二四层(共区) */
      {origin: [4.64, 8, 2.25], size: [2, 8, 2], uv: [32, 0]},
      {origin: [-5.64, 8, 2.25], size: [2, 8, 2], uv: [32, 0]},
      {origin: [-1, 8, -7.5], size: [2, 8, 2], uv: [32, 0]},
      {origin: [-1, 16, 5.5], size: [2, 8, 2], uv: [32, 0]},
      {origin: [-5.64, 16, -2.25], size: [2, 8, 2], uv: [32, 0]},
      {origin: [4.64, 16, -2.25], size: [2, 8, 2], uv: [32, 0]},
    ]},
  },
  tex: {size: 64, paint: (g, R) => {
    const GOLD = [232, 192, 42]; const GOLD2 = [196, 154, 26];
    const DARK = [58, 42, 16]; const SMOKE = [58, 52, 42]; const EMBER = [232, 100, 26];
    /* 头: 黄金噪底 · 深眼窝(两颗) · 怒嘴 */
    const F = R.head.front;
    g.noise(F, GOLD, 0.06);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 3, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 6, 2, 1], DARK); /* 嘴 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], GOLD, 0.06);
    g.noise(R.head.bottom, GOLD2, 0.06);
    /* 12 根烟杆(全部共区): 深烟色 + 烬点(种子化橙斑) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      const rod = R.armL[f];
      g.noise(rod, SMOKE, 0.15);
      for (let i = 0; i < 3; i++) {
        g.px(rod[0] + Math.floor(g.rng() * rod[2]), rod[1] + Math.floor(g.rng() * rod[3]), EMBER);
      }
    }
  }},
});
