'use strict';
/* ============================================================
   造型档案 · 远古守卫者 (elder_guardian) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   守卫者骨架逐字复用 + **scale 2.0**(wiki 口径 ×~2, 研究笔记 §5
   守卫组 — 旧 rig ×2.2 按研究笔记校 2.0)。灰紫配色+更多刺纹
   (配色锚延续旧 MOB_RIG)。贴图 128 档同布局。
   interface: declare('elder_guardian', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('elder_guardian', {
  scale: 2.0,
  debris: 0x8a8a9a,
  bones: {
    root: {pivot: [0, 8, 0], add: [
      {origin: [-6, 2, -8], size: [12, 12, 16], uv: [0, 0]}, /* 主盒 */
      {origin: [-6, 14, -6], size: [12, 2, 12], uv: [0, 32]}, /* 上鳍 */
      {origin: [-6, 0, -6], size: [12, 2, 12], uv: [0, 32]}, /* 下鳍(共区) */
      {origin: [6, 2, -6], size: [2, 12, 12], uv: [56, 0]}, /* 左侧鳍 */
      {origin: [-8, 2, -6], size: [2, 12, 12], uv: [56, 0]}, /* 右侧鳍(共区) */
      {origin: [-2, 6, 8], size: [4, 4, 8], uv: [56, 26]}, /* 尾一 */
      {origin: [-1.5, 6.5, 16], size: [3, 3, 6], uv: [56, 40]}, /* 尾二 */
      {origin: [-1, 7, 22], size: [2, 2, 6], uv: [56, 52]}, /* 尾三 */
    ]},
    head: {pivot: [0, 8, -8], add: [{origin: [-1, 7, -9], size: [2, 2, 1], uv: [0, 60]}]}, /* 独眼 */
    armL: {pivot: [0, 8, 0], add: [
      {origin: [6, 3, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [6, 7, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [6, 11, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [-1, 3, -17], size: [2, 2, 9], uv: [34, 60]},
      {origin: [-1, 7, -17], size: [2, 2, 9], uv: [34, 60]},
      {origin: [-1, 11, -17], size: [2, 2, 9], uv: [34, 60]},
    ]},
    armR: {pivot: [0, 8, 0], add: [
      {origin: [-15, 3, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [-15, 7, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [-15, 11, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [-1, 3, 8], size: [2, 2, 9], uv: [34, 60]},
      {origin: [-1, 7, 8], size: [2, 2, 9], uv: [34, 60]},
      {origin: [-1, 11, 8], size: [2, 2, 9], uv: [34, 60]},
    ]},
  },
  tex: {size: 128, paint: (g, R) => {
    const GREY = [138, 138, 154]; const GREY2 = [112, 112, 128];
    const DARK = [42, 42, 52]; const SPIKE = [106, 106, 122];
    const WHT = [216, 216, 208]; const RED = [216, 42, 42];
    /* 主盒: 灰紫噪底 · 老年斑(种子化深斑) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], GREY, 0.07);
    }
    for (const f of ['top', 'back']) {
      const r = R.root[f];
      for (let i = 0; i < r[2] * r[3] / 10; i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]), DARK);
      }
    }
    /* 四鳍(两两共区): 深灰紫 */
    for (const part of [R.root2, R.root4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], GREY2, 0.07);
      }
    }
    /* 尾三节: 逐节压暗 */
    [R.root6, R.root7, R.root8].forEach((seg, i) => {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(seg[f], GREY, 0.07);
        g.mul(seg[f], 1 - i * 0.12);
      }
    });
    /* 独眼: 白底红瞳 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.head[f], WHT);
    }
    g.fill([R.head.front[0], R.head.front[1], 1, 1], RED);
    /* 12 侧刺(两两共区): 深灰刺+刺尖亮 */
    for (const part of [R.armL, R.armL4, R.armR, R.armR4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], SPIKE, 0.08);
      }
      g.fill([part.front[0], part.front[1], part.front[2], 1], DARK);
    }
  }},
});
