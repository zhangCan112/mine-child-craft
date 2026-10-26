'use strict';
/* ============================================================
   造型档案 · 疣猪兽 (hoglin) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架直填(研究笔记 §5 猪猪一家, bedrock hoglin.geo 核对 —
   身体本就水平建模无需预躺平): 身 16×14×26 · 鬃毛中平面 0×10×19 ·
   头 14×6×19(扁长吻) · 獠牙 2×11×2 上挑 · 双耳 6×1×4 rz±50° ·
   前腿 6×14×6 后腿 5×11×5(异规格 — quad 基座均质腿放不下,
   按蜘蛛/苦力怕先例自有骨架)。头骨官方 bind 旋 50° 属姿态语言,
   静态骨架取平直(动画票再议)。贴图 128 档。
   interface: declare('hoglin', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('hoglin', {
  debris: 0xa86a4a,
  bones: {
    head: {pivot: [0, 22, -5], add: [
      {origin: [-7, 21, -24], size: [14, 6, 19], uv: [0, 44]},
      {origin: [6, 22, -19], size: [2, 11, 2], uv: [70, 44]}, /* 左獠牙 */
      {origin: [-8, 22, -19], size: [2, 11, 2], uv: [70, 44]}, /* 右獠牙(共区) */
      {origin: [7, 26, -10], size: [6, 1, 4], uv: [82, 44], rz: 0.87}, /* 左耳(50°) */
      {origin: [-13, 26, -10], size: [6, 1, 4], uv: [82, 44], rz: -0.87}, /* 右耳(共区) */
    ]},
    root: {pivot: [0, 18, 6], add: [
      {origin: [-8, 11, -7], size: [16, 14, 26], uv: [0, 0]},
      {origin: [0, 22, -10], size: [0, 10, 19], uv: [88, 0]}, /* 鬃毛中平面 */
    ]},
    legL: {pivot: [5, 11, 0], add: [
      {origin: [2, 0, -6], size: [6, 14, 6], uv: [0, 72]}, /* 前左 */
      {origin: [3, 0, 13], size: [5, 11, 5], uv: [28, 72]}, /* 后左 */
    ]},
    legR: {pivot: [-5, 11, 0], add: [
      {origin: [-8, 0, -6], size: [6, 14, 6], uv: [0, 72]}, /* 前右(与前左共区) */
      {origin: [-8, 0, 13], size: [5, 11, 5], uv: [28, 72]}, /* 后右(共区) */
    ]},
  },
  tex: {size: 128, paint: (g, R) => {
    const BROWN = [168, 106, 74]; const BROWN2 = [140, 84, 58];
    const MANE = [96, 56, 36]; const DARK = [36, 22, 14];
    const TUSK = [240, 232, 216]; const PINK = [196, 128, 112];
    /* 身: 棕皮噪底 · 背脊深棕 · 肚浅 */
    g.noiseAll(R.root, BROWN, 0.06);
    g.mul([R.root.top[0], R.root.top[1], R.root.top[2], R.root.top[3]], 0.92);
    g.mul(R.root.bottom, 0.88);
    /* 鬃毛(root2): 深棕硬毛噪点 */
    for (const f of ['left', 'right']) {
      g.noise(R.root2[f], MANE, 0.12);
    }
    for (const f of ['front', 'back', 'top', 'bottom']) g.fill(R.root2[f], MANE);
    /* 头: 棕底 · 眼(两颗) · 吻端粉鼻 */
    const F = R.head.front;
    g.noise(F, BROWN, 0.06);
    g.fill([F[0] + 2, F[1] + 1, 2, 2], DARK); g.fill([F[0] + 10, F[1] + 1, 2, 2], DARK);
    g.fill([F[0] + 4, F[1] + 4, 6, 2], PINK); /* 鼻盘 */
    g.px(F[0] + 5, F[1] + 4, DARK); g.px(F[0] + 8, F[1] + 4, DARK); /* 鼻孔 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], BROWN, 0.06);
    g.mul(R.head.bottom, 0.85);
    /* 獠牙(共区 head2/head3): 米白 */
    for (const part of [R.head2, R.head3]) {
      g.fillAll(part, TUSK);
    }
    /* 双耳(共区 head4/head5): 棕皮+耳廓影 */
    for (const part of [R.head4, R.head5]) {
      g.noiseAll(part, BROWN2, 0.06);
    }
    /* 前腿(共区 legL/legR 首盒) · 后腿(次盒): 深棕+黑蹄 */
    for (const leg of [R.legL, R.legR, R.legL2, R.legR2]) {
      g.noiseAll(leg, BROWN2, 0.06);
      g.fill([leg.front[0], leg.front[1] + leg.front[3] - 2, leg.front[2], 2], DARK); /* 蹄 */
    }
  }},
});
