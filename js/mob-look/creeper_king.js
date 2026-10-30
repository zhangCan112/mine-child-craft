'use strict';
/* ============================================================
   造型档案 · 苦力怕王 (creeper_king) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   苦力怕的放大款(scale 1.6): 同一套官方独有骨架(无臂四足矮身)自声明副本 +
   头顶金冠四尖桩(2×2×2 金块, 共用金色 UV 区)——「王」的身份件全靠冠与体量,
   脸纹沿用苦力怕垂腿嘴(语义语言口径 D13)。斑底比常款更深(王住深处, 深绿)。
   interface: declare('creeper_king', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('creeper_king', {
  scale: 1.6, /* 体量即威慑(王座台上再垫 1 格, 关底剪影一眼可辨) */
  debris: 0x2f7a35,
  tex: {size: 64, paint: (g, R) => {
    const GREEN = [47, 122, 53]; const GREEN2 = [34, 92, 40]; const DARK = [10, 14, 10];
    const GOLD = [232, 190, 74]; const GOLD2 = [196, 152, 48];
    /* 深绿斑噪底: 王者更深一层(同 type 同图, 种子化) */
    const mottle = (r) => {
      g.noise(r, GREEN, 0.1);
      for (let i = 0; i < Math.max(2, r[2] * r[3] / 6); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]), GREEN2);
      }
    };
    /* 头: 深绿斑底 · 眼 2×2 · 垂腿嘴(苦力怕同款脸纹, 王不改脸——认脸是教学锚) */
    const F = R.head.front;
    mottle(F);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 3, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 2], DARK); /* 嘴心柱 */
    g.fill([F[0] + 2, F[1] + 6, 1, 2], DARK); g.fill([F[0] + 5, F[1] + 6, 1, 2], DARK); /* 垂腿 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) mottle(R.head[f]);
    /* 身与四腿: 同款深绿斑 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) mottle(R.root[f]);
    for (const leg of [R.legL, R.legL2, R.legR, R.legR2]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) mottle(leg[f]);
    }
    /* 金冠 UV 区(头骨之外的自有区, 四尖桩共用): 金底+暗金棱纹 */
    g.fill([40, 0, 8, 8], GOLD);
    for (let i = 0; i < 8; i++) g.px(40 + i, 0 + (i % 3), GOLD2);
    g.fill([40, 4, 8, 1], GOLD2);
  }},
  /* 自有骨架: 苦力怕骨(头 8³/身 8×12×4/四短腿对角成对) + 头顶四尖金冠桩 */
  bones: {
    head: {add: [{origin: [-4, 18, -4], size: [8, 8, 8], uv: [0, 0]},
      /* 金冠四尖桩: 头顶四角各一 2×2×2 金块(共用 [40,0] 金色 UV 区) */
      {origin: [-4, 26, -4], size: [2, 2, 2], uv: [40, 0]},
      {origin: [2, 26, -4], size: [2, 2, 2], uv: [40, 0]},
      {origin: [-4, 26, 2], size: [2, 2, 2], uv: [40, 0]},
      {origin: [2, 26, 2], size: [2, 2, 2], uv: [40, 0]}], pivot: [0, 18, 0]},
    root: {add: [{origin: [-4, 6, -2], size: [8, 12, 4], uv: [16, 16]}], pivot: [0, 12, 0]},
    legL: {add: [{origin: [-4, 0, 2], size: [4, 6, 4], uv: [0, 16]},
      {origin: [-4, 0, -6], size: [4, 6, 4], uv: [0, 28]}], pivot: [-2, 6, 0]},
    legR: {add: [{origin: [0, 0, 2], size: [4, 6, 4], uv: [0, 40]},
      {origin: [0, 0, -6], size: [4, 6, 4], uv: [0, 52]}], pivot: [2, 6, 0]},
  },
});
