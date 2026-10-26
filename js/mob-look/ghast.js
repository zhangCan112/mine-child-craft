'use strict';
/* ============================================================
   造型档案 · 恶魂 (ghast) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方等比(研究笔记 §5 鬼一族): 主立方 **72×72×72**(≈4.5 格,
   head 单槽 — 攻击=整体前扑) + **9 根触手** 9×(36..58)×9 长短
   交错(3×3 网格垂布, legL/legR 槽 — 旧 rig 6 根→官方 9 根)。
   垂泪眼+咧嘴画进贴图(72px 大脸)。贴图 512 档(官方 72³ 的 UV
   十字宽 288 — 256 装不下, 用户拍板官方尺寸)。
   interface: declare('ghast', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('ghast', {
  debris: 0xe8e8e8,
  bones: {
    head: {pivot: [0, 36, 0], add: [{origin: [-36, 0, -36], size: [72, 72, 72], uv: [0, 0]}]},
    legL: {pivot: [0, 0, 0], add: [ /* 左列五根(3×3 网格取左半+中前) */
      {origin: [-24.5, -54, -24.5], size: [9, 54, 9], uv: [0, 150]},
      {origin: [-4.5, -44, -24.5], size: [9, 44, 9], uv: [40, 150]},
      {origin: [15.5, -58, -24.5], size: [9, 58, 9], uv: [80, 150]},
      {origin: [-24.5, -36, -4.5], size: [9, 36, 9], uv: [120, 150]},
      {origin: [-4.5, -50, -4.5], size: [9, 50, 9], uv: [160, 150]},
    ]},
    legR: {pivot: [0, 0, 0], add: [ /* 右四根 */
      {origin: [15.5, -40, -4.5], size: [9, 40, 9], uv: [200, 150]},
      {origin: [-24.5, -56, 15.5], size: [9, 56, 9], uv: [240, 150]},
      {origin: [-4.5, -46, 15.5], size: [9, 46, 9], uv: [280, 150]},
      {origin: [15.5, -52, 15.5], size: [9, 52, 9], uv: [320, 150]},
    ]},
  },
  tex: {size: 512, paint: (g, R) => {
    const WHT = [232, 232, 232]; const WHT2 = [216, 216, 212];
    const DARK = [26, 26, 26]; const GREY = [178, 178, 174];
    /* 主立方: 白噪底 + 泪痕垂纹(底缘灰) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head[f], WHT, 0.04);
      const r = R.head[f];
      g.mul([r[0], r[1] + r[3] - 6, r[2], 6], 0.92); /* 底缘阴影 */
    }
    /* 脸(front): 垂泪眼(两道黑泪) + 咧嘴 */
    const F = R.head.front;
    g.fill([F[0] + 14, F[1] + 20, 10, 22], DARK); /* 左眼泪线 */
    g.fill([F[0] + 48, F[1] + 20, 10, 22], DARK); /* 右眼泪线 */
    g.fill([F[0] + 14, F[1] + 18, 10, 2], DARK); g.fill([F[0] + 48, F[1] + 18, 10, 2], DARK); /* 眼框 */
    g.fill([F[0] + 22, F[1] + 50, 28, 12], DARK); /* 咧嘴 */
    g.fill([F[0] + 26, F[1] + 52, 4, 8], GREY); g.fill([F[0] + 42, F[1] + 52, 4, 8], GREY); /* 腭影 */
    /* 9 触手: 米白+环纹 */
    for (const part of [R.legL, R.legL2, R.legL3, R.legL4, R.legL5,
      R.legR, R.legR2, R.legR3, R.legR4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(part[f], WHT2, 0.05);
      }
      const r = part.front;
      for (let y = 6; y < r[3]; y += 8) {/* 环纹 */
        g.mul([r[0], r[1] + y, r[2], 1], 0.85);
      }
    }
  }},
});
