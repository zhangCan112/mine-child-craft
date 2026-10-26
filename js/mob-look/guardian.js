'use strict';
/* ============================================================
   造型档案 · 守卫者 (guardian) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架(研究笔记 §5 守卫组): 主盒 12×12×16 + 上下鳍 12×2×12 +
   侧鳍 2×12×12 + 独眼 2×2×1(head 槽 — 攻击=独眼前突, 激光语义) +
   尾三节 4×4×8→2×2→2×6 + **12 根侧刺 2×9×2**(四向×三高,
   armL/armR 各 6 — 旧 rig 双刺→官方 12 刺; 攻击=刺簇抡摆)。
   贴图 128 档(四组鳍+尾+刺布局 64 放不下)。
   interface: declare('guardian', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('guardian', {
  debris: 0x5a8a6a,
  bones: {
    root: {pivot: [0, 8, 0], add: [
      {origin: [-6, 2, -8], size: [12, 12, 16], uv: [0, 0]}, /* 主盒 */
      {origin: [-6, 14, -6], size: [12, 2, 12], uv: [0, 32]}, /* 上鳍 */
      {origin: [-6, 0, -6], size: [12, 2, 12], uv: [0, 32]}, /* 下鳍(与上鳍共区) */
      {origin: [6, 2, -6], size: [2, 12, 12], uv: [56, 0]}, /* 左侧鳍 */
      {origin: [-8, 2, -6], size: [2, 12, 12], uv: [56, 0]}, /* 右侧鳍(共区) */
      {origin: [-2, 6, 8], size: [4, 4, 8], uv: [56, 26]}, /* 尾一 */
      {origin: [-1.5, 6.5, 16], size: [3, 3, 6], uv: [56, 40]}, /* 尾二 */
      {origin: [-1, 7, 22], size: [2, 2, 6], uv: [56, 52]}, /* 尾三 */
    ]},
    head: {pivot: [0, 8, -8], add: [{origin: [-1, 7, -9], size: [2, 2, 1], uv: [0, 60]}]}, /* 独眼 */
    armL: {pivot: [0, 8, 0], add: [ /* 左三横刺 + 前三纵刺(各共区) */
      {origin: [6, 3, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [6, 7, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [6, 11, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [-1, 3, -17], size: [2, 2, 9], uv: [34, 60]},
      {origin: [-1, 7, -17], size: [2, 2, 9], uv: [34, 60]},
      {origin: [-1, 11, -17], size: [2, 2, 9], uv: [34, 60]},
    ]},
    armR: {pivot: [0, 8, 0], add: [ /* 右三横刺 + 后三纵刺(共区) */
      {origin: [-15, 3, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [-15, 7, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [-15, 11, -1], size: [9, 2, 2], uv: [8, 60]},
      {origin: [-1, 3, 8], size: [2, 2, 9], uv: [34, 60]},
      {origin: [-1, 7, 8], size: [2, 2, 9], uv: [34, 60]},
      {origin: [-1, 11, 8], size: [2, 2, 9], uv: [34, 60]},
    ]},
  },
  tex: {size: 128, paint: (g, R) => {
    const SEA = [90, 138, 106]; const SEA2 = [74, 122, 90];
    const DARK = [30, 46, 36]; const SPIKE = [138, 106, 74];
    const WHT = [216, 216, 208]; const RED = [216, 42, 42];
    /* 主盒: 海绿噪底 · 背纹菱格 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], SEA, 0.06);
    }
    const T = R.root.top;
    for (let y = 2; y < T[3] - 1; y += 4) {
      for (let x = 2; x < T[2] - 1; x += 4) g.px(T[0] + x, T[1] + y, SEA2);
    }
    /* 四鳍(root2~5, 两两共区): 深海绿 */
    for (const part of [R.root2, R.root4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], SEA2, 0.06);
      }
    }
    /* 尾三节(root6~8): 逐节压暗 */
    [R.root6, R.root7, R.root8].forEach((seg, i) => {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(seg[f], SEA, 0.06);
        g.mul(seg[f], 1 - i * 0.12);
      }
    });
    /* 独眼(head): 白底红瞳 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.head[f], WHT);
    }
    g.fill([R.head.front[0], R.head.front[1], 1, 1], RED); /* 红瞳 */
    /* 12 侧刺(两两共区): 木刺色 */
    for (const part of [R.armL, R.armL4, R.armR, R.armR4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], SPIKE, 0.08);
      }
      g.fill([part.front[0], part.front[1], part.front[2], 1], DARK); /* 刺根影 */
    }
  }},
});
