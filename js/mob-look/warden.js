'use strict';
/* ============================================================
   造型档案 · 监守者 (warden) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架直填(研究笔记 §5 守卫组): 桶胸 18×21×11 + 头 16×16×10
   (无眼 — 盲者, 触角平面盒 2×5×0 上探) + 双臂 8×28×8 + 腿
   6×13×6 + 胸口 sculk 光纹平面盒 16×16×0(root 追加)。胸口
   幽蓝符纹画进贴图。贴图 128 档。
   interface: declare('warden', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('warden', {
  debris: 0x182a3a,
  bones: {
    root: {pivot: [0, 24, 0], add: [
      {origin: [-9, 13, -5.5], size: [18, 21, 11], uv: [0, 0]}, /* 桶胸 */
      {origin: [-8, 17, -6], size: [16, 16, 0], uv: [60, 40]}, /* 胸口光纹板 */
    ]},
    head: {pivot: [0, 34, 0], add: [
      {origin: [-8, 34, -5], size: [16, 16, 10], uv: [0, 36]},
      {origin: [-4, 50, -1], size: [2, 5, 0], uv: [96, 22]}, /* 左触角(平面) */
      {origin: [2, 50, -1], size: [2, 5, 0], uv: [96, 22]}, /* 右触角(共区) */
    ]},
    armL: {pivot: [11, 32, 0], add: [{origin: [7, 4, -4], size: [8, 28, 8], uv: [60, 0]}]},
    armR: {pivot: [-11, 32, 0], add: [{origin: [-15, 4, -4], size: [8, 28, 8], uv: [60, 0]}]},
    legL: {pivot: [4, 13, 0], add: [{origin: [1, 0, -3], size: [6, 13, 6], uv: [96, 0]}]},
    legR: {pivot: [-4, 13, 0], add: [{origin: [-7, 0, -3], size: [6, 13, 6], uv: [96, 0]}]},
  },
  tex: {size: 128, paint: (g, R) => {
    const DARKT = [46, 76, 100]; const DARK2 = [32, 56, 74];
    const GLOW = [74, 224, 200]; const GLOW2 = [46, 152, 138];
    /* 桶胸: 深青噪底 · 鳞纹 */
    g.noiseAll(R.root, DARKT, 0.07);
    const B = R.root.front;
    for (let y = 2; y < B[3] - 1; y += 4) {
      for (let x = 1 + (y % 8 === 2 ? 0 : 2); x < B[2] - 1; x += 4) {
        g.px(B[0] + x, B[1] + y, DARK2); /* 鳞孔 */
      }
    }
    /* 胸口光纹板(root2, 平面盒): sculk 符纹(幽蓝纹路+亮核) — 两面同绘 */
    const P = R.root2.front;
    g.fill(P, DARK2);
    for (let i = 0; i < 3; i++) {/* 三道符纹(双行加粗) */
      g.fill([P[0] + 3, P[1] + 4 + i * 4, P[2] - 6, 2], GLOW2);
    }
    g.fill([P[0] + 6, P[1] + 5, 4, 4], GLOW); /* 亮核(魂心) */
    g.fill([P[0] + 7, P[1] + 3, 2, 2], GLOW);
    const PB = R.root2.back;
    g.fill(PB, DARK2);
    /* 头: 深青 · 无眼(盲者) · 额纹四道 · 触角发亮梢 */
    const F = R.head.front;
    g.noise(F, DARKT, 0.07);
    for (let i = 0; i < 4; i++) {/* 额纹 */
      g.fill([F[0] + 3 + i * 3, F[1] + 2, 1, 4], GLOW2);
    }
    g.fill([F[0] + 5, F[1] + 9, 6, 1], DARK2); /* 鼻缝 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], DARKT, 0.07);
    g.mul(R.head.bottom, 0.8);
    for (const part of [R.head2, R.head3]) {/* 双触角(共区) */
      for (const f of ['front', 'back']) {
        g.fill(part[f], DARK2);
        g.fill([part[f][0], part[f][1], part[f][2], 1], GLOW); /* 亮梢 */
      }
    }
    /* 双臂(共区): 深青 · 臂纹三道 · 巨拳压暗; 双腿(共区): 深青 */
    for (const arm of [R.armL, R.armR]) {
      g.noiseAll(arm, [42, 72, 96], 0.07);
      g.fill([arm.front[0] + 1, arm.front[1] + 6, arm.front[2] - 2, 1], GLOW2); /* 臂纹 */
      g.fill([arm.front[0] + 1, arm.front[1] + 10, arm.front[2] - 2, 1], GLOW2);
      g.fill([arm.front[0] + 1, arm.front[1] + 14, arm.front[2] - 2, 1], GLOW2);
      g.fill([arm.front[0], arm.front[1] + arm.front[3] - 4, arm.front[2], 4], DARK2); /* 巨拳 */
    }
    for (const leg of [R.legL, R.legR]) {
      g.noiseAll(leg, DARK2, 0.07);
      g.mul(leg.bottom, 0.8);
    }
  }},
});
