'use strict';
/* ============================================================
   造型档案 · 鸡 (chicken) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   四足基座小体型官方等比(身 6×6×8 预躺平 · 头 4×6×3 · 短腿 3×5×3,
   研究笔记 §5 农场一家) + 冠 2×2×2 + 喙 4×2×2 + 颌下肉髯 2×2×1
   追加骨 + **双翼 1×4×6 挂 wingL/wingR 槽 axis:'z'**(引擎扇翅
   动画就位 — quad 基座外的自有翼骨)。
   interface: declare('chicken', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('chicken', {
  base: ['quad', {
    w: 6, h: 6, len: 8, bodyCY: 7, bodyCZ: 0,
    legW: 3, legH: 5, legX: 2, legZF: -2, legZB: 2,
    headW: 4, headH: 6, headD: 3, headCY: 12, headCZ: -5.5, headPY: 11, headPZ: -4,
    bodyUV: [0, 0], headUV: [0, 18],
    legUVs: [[0, 32], [0, 32], [0, 32], [0, 32]], /* 双腿共区 */
  }],
  debris: 0xf2e5bf,
  bones: {
    head: {add: [
      {origin: [-1, 15, -6], size: [2, 2, 2], uv: [32, 0]}, /* 肉冠 */
      {origin: [-2, 10, -9], size: [4, 2, 2], uv: [32, 8]}, /* 喙 */
      {origin: [-1, 8, -8], size: [2, 2, 1], uv: [32, 16]}, /* 颌下肉髯 */
    ]},
    wingL: {pivot: [3.5, 10, 0], axis: 'z',
      add: [{origin: [3, 6, -3], size: [1, 4, 6], uv: [16, 32]}]},
    wingR: {pivot: [-3.5, 10, 0], axis: 'z',
      add: [{origin: [-4, 6, -3], size: [1, 4, 6], uv: [16, 32]}]}, /* 与左翼共区 */
  },
  tex: {size: 64, paint: (g, R) => {
    const CREAM = [242, 229, 191]; const CREAM2 = [220, 204, 160];
    const DARK = [32, 22, 18]; const RED = [216, 42, 42];
    const BEAK = [216, 160, 74];
    /* 身: 米白羽噪底 · 尾羽压暗(后端) */
    g.noiseAll(R.root, CREAM, 0.05);
    g.mul([R.root.back[0], R.root.back[1], R.root.back[2], 4], 0.9); /* 尾羽 */
    g.mul(R.root.bottom, 0.85);
    /* 头: 米白 · 眼(两颗侧位) */
    const F = R.head.front;
    g.noise(F, CREAM, 0.05);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], CREAM, 0.05);
    g.mul(R.head.bottom, 0.8);
    for (const side of [R.head.left, R.head.right]) {
      g.fill([side[0], side[1] + 2, 1, 2], DARK); /* 侧脸眼 */
    }
    /* 冠/肉髯(head2/head4): 正红 */
    for (const part of [R.head2, R.head4]) {
      g.fillAll(part, RED);
    }
    /* 喙(head3): 橙黄 */
    g.fillAll(R.head3, BEAK);
    /* 双腿(共区): 橙腿+深爪 */
    for (const leg of [R.legL, R.legR]) {
      g.noiseAll(leg, BEAK, 0.05);
      g.fill([leg.front[0], leg.front[1] + leg.front[3] - 1, leg.front[2], 1], DARK); /* 爪 */
    }
    /* 双翼(共区 wingL/wingR): 米白+羽尖压暗 */
    for (const wing of [R.wingL, R.wingR]) {
      g.noiseAll(wing, CREAM2, 0.05);
      g.mul([wing.front[0], wing.front[1], wing.front[2], 2], 0.88); /* 翼尖羽 */
    }
  }},
});
