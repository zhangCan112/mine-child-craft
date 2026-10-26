'use strict';
/* ============================================================
   造型档案 · 末影龙 (dragon) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架直填(研究笔记 §5 龙族): 身 24×24×64 + 颈 10×10×10 +
   尾三节(10→8→5 递减) + 头(颚盒 16×16×16 + 吻 12×5×16 + 双角
   3×8×3) + **双翼 = 骨杆 56×8×8 + 膜平面 56×0×56 + 翼尖 56×4×4**
   (wingL/wingR 槽 axis 'z' — 引擎扇翅; 膜用平面盒即官方手法) +
   后腿两节(root 静态, 与旧 rig 同构)。紫瞳画进贴图。
   贴图 256 档(身十字宽 176 — 128 数学上不可行, 用户拍板)。
   interface: declare('dragon', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('dragon', {
  debris: 0x3a2055,
  bones: {
    root: {pivot: [0, 20, 0], add: [
      {origin: [-12, 8, -32], size: [24, 24, 64], uv: [0, 0]}, /* 身 */
      {origin: [-5, 22, -42], size: [10, 10, 10], uv: [0, 128]}, /* 颈 */
      {origin: [-5, 12, 32], size: [10, 10, 16], uv: [44, 128]}, /* 尾一 */
      {origin: [-4, 13, 48], size: [8, 8, 14], uv: [100, 128]}, /* 尾二 */
      {origin: [-2.5, 15, 62], size: [5, 5, 14], uv: [148, 128]}, /* 尾三 */
      {origin: [4, 18, 10], size: [5, 14, 6], uv: [0, 156]}, /* 左后腿上节 */
      {origin: [4, 4, 10], size: [4, 14, 6], uv: [24, 156]}, /* 左后腿下节 */
      {origin: [-9, 18, 10], size: [5, 14, 6], uv: [0, 156]}, /* 右后腿上节(共区) */
      {origin: [-8, 4, 10], size: [4, 14, 6], uv: [24, 156]}, /* 右后腿下节(共区) */
    ]},
    head: {pivot: [0, 24, -40], add: [
      {origin: [-8, 16, -56], size: [16, 16, 16], uv: [0, 92]}, /* 颚盒 */
      {origin: [-6, 21, -72], size: [12, 5, 16], uv: [68, 92]}, /* 吻 */
      {origin: [3, 32, -44], size: [3, 8, 3], uv: [128, 92]}, /* 左角 */
      {origin: [-6, 32, -44], size: [3, 8, 3], uv: [128, 92]}, /* 右角(共区) */
    ]},
    wingL: {pivot: [-13, 30, -6], axis: 'z', add: [
      {origin: [-69, 26, -10], size: [56, 8, 8], uv: [0, 178]}, /* 骨杆 */
      {origin: [-69, 26, -2], size: [56, 0, 56], uv: [0, 196]}, /* 膜(平面盒) */
      {origin: [-125, 28, -8], size: [56, 4, 4], uv: [132, 178]}, /* 翼尖 */
    ]},
    wingR: {pivot: [13, 30, -6], axis: 'z', add: [
      {origin: [13, 26, -10], size: [56, 8, 8], uv: [0, 178]}, /* 与左翼共区 */
      {origin: [13, 26, -2], size: [56, 0, 56], uv: [0, 196]}, /* 膜(共区) */
      {origin: [69, 28, -8], size: [56, 4, 4], uv: [132, 178]}, /* 翼尖(共区) */
    ]},
  },
  tex: {size: 256, paint: (g, R) => {
    const BODY = [22, 22, 31]; const BODY2 = [38, 32, 85];
    const DARK = [10, 10, 16]; const EYE = [208, 107, 255];
    const MEMB = [58, 32, 85]; const MEMB2 = [44, 24, 66];
    /* 漆黑鳞底笔触: 深噪 + 紫斑(末影血统) */
    const scale = (r) => {
      g.noise(r, BODY, 0.07);
      for (let i = 0; i < Math.max(2, r[2] * r[3] / 30); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]), BODY2);
      }
    };
    /* 身颈尾: 漆黑鳞 + 背脊亮线 · 腹板压暗 */
    for (const part of [R.root, R.root2, R.root3, R.root4, R.root5]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        scale(part[f]);
      }
    }
    g.fill([R.root.top[0] + 11, R.root.top[1], 2, R.root.top[3]], BODY2); /* 背脊线 */
    g.mul(R.root.bottom, 0.75); /* 腹板 */
    g.mul(R.root5.back, 0.85); /* 尾尖 */
    /* 后腿(两两共区): 漆黑 */
    for (const part of [R.root6, R.root7, R.root8, R.root9]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        scale(part[f]);
      }
    }
    /* 头: 颚盒+吻+双角(共区) · 紫瞳(两颗) · 鼻孔 */
    for (const part of [R.head, R.head2, R.head3, R.head4]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        scale(part[f]);
      }
    }
    const F = R.head.front;
    g.fill([F[0] + 2, F[1] + 4, 2, 2], EYE); g.fill([F[0] + 12, F[1] + 4, 2, 2], EYE); /* 紫瞳 */
    const SN = R.head2.front;
    g.px(SN[0] + 2, SN[1] + 3, DARK); g.px(SN[0] + 9, SN[1] + 3, DARK); /* 鼻孔 */
    g.fill([SN[0], SN[1] + SN[3] - 1, SN[2], 1], DARK); /* 嘴缝 */
    /* 双翼(左右共区): 骨杆漆黑 · 膜深紫(血管纹) · 翼尖漆黑 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      scale(R.wingL[f]); /* 骨杆 */
      scale(R.wingL3[f]); /* 翼尖 */
    }
    for (const f of ['top', 'bottom']) {
      const m = R.wingL2[f];
      g.noise(m, MEMB, 0.06);
      for (let i = 0; i < 5; i++) {/* 血管辐纹 */
        g.fill([m[0] + i * 11, m[1], 1, m[3]], MEMB2);
      }
      g.mul([m[0], m[1], m[2], 4], 0.8); /* 翼根压暗 */
    }
  }},
});
