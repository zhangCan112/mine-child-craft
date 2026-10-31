'use strict';
/* ============================================================
   造型档案 · 末影龙 (dragon) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方骨架直填(研究笔记 §5 龙族): 身 24×24×64 + 颈 10×10×10 +
   尾三节(10→8→5 递减) + 头(颚盒 16×16×16 + 吻 12×5×16 + 双角
   3×8×3) + **双翼 = 骨杆 56×8×8 + 膜平面 56×0×56 + 翼尖 56×4×4**
   (wingL/wingR 槽 axis 'z' — 引擎扇翅; 膜用平面盒即官方手法) +
   后腿两节(root 静态, 与旧 rig 同构)。
   观感对官方截图(2026-10-31 造型改版, 像素自绘): 近黑鳞身 + 亮灰
   翼骨/双角/尾尖 + 背脊刺排(颈→尾一段段亮灰刺块) + 黑膜上自翼根
   前缘角扇开的七根亮灰辐条(五根奔后缘+两根奔翼尖, 白骨黑膜) +
   紫瞳 — 旧深紫灰身+亮紫膜观感退役。
   贴图 256 档(身十字宽 176 — 128 数学上不可行, 用户拍板)。
   interface: declare('dragon', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('dragon', {
  debris: 0x221d30,
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
    const BODY = [30, 27, 38]; const BODY2 = [46, 40, 60];
    const DARK = [13, 11, 20]; const EYE = [240, 130, 255];
    const BONE = [190, 190, 200]; const MEMB = [21, 18, 29];
    const RIB = [160, 160, 172];
    /* 鳞底笔触: 噪底 + 微亮斑(近黑正典口径) */
    const scale = (r) => {
      g.noise(r, BODY, 0.07);
      for (let i = 0; i < Math.max(2, r[2] * r[3] / 30); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]), BODY2);
      }
    };
    const all = (part, fn) => {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        fn(part[f]);
      }
    };
    /* 身/颈/尾/后腿/头: 近黑鳞 */
    for (const part of [R.root, R.root2, R.root3, R.root4, R.root5,
      R.root6, R.root7, R.root8, R.root9, R.head, R.head2]) {
      all(part, (r) => scale(r));
    }
    g.mul(R.root.bottom, 0.7); /* 腹板压暗 */
    /* 背脊刺排: 各段顶面中线一排亮灰刺块, 刺身尾段压暗立起立体感
       (对图 2/4 的背尾灰刺; 画布上侧 = 尾远端, 刺尖朝远端) */
    const spikes = (t, ox, first, step, len) => {
      for (let y = first; y + len <= t[3]; y += step) {
        g.fill([t[0] + ox, t[1] + y, 2, len], BONE);
        g.mul([t[0] + ox, t[1] + y + (len >> 1), 2, len >> 1], 0.78);
      }
    };
    spikes(R.root.top, 11, 3, 7, 4); /* 身 24×64: 九刺 */
    spikes(R.root2.top, 4, 3, 7, 4); /* 颈 10×10: 一刺 */
    spikes(R.root3.top, 4, 2, 7, 4); /* 尾一 10×16: 两刺 */
    spikes(R.root4.top, 3, 2, 7, 3); /* 尾二 8×14: 两刺 */
    spikes(R.root5.top, 1, 2, 6, 3); /* 尾三 5×14: 两刺 */
    g.fill([R.root5.top[0], R.root5.top[1], 5, 2], BONE); /* 亮灰尾尖帽 */
    g.mul([R.root5.top[0], R.root5.top[1] + 2, 5, 1], 0.7);
    /* 头: 紫瞳 · 鼻孔嘴缝 · 双角亮灰(head4 共区) */
    const F = R.head.front;
    g.fill([F[0] + 2, F[1] + 4, 2, 2], EYE); g.fill([F[0] + 12, F[1] + 4, 2, 2], EYE);
    const SN = R.head2.front;
    g.px(SN[0] + 2, SN[1] + 3, DARK); g.px(SN[0] + 9, SN[1] + 3, DARK);
    g.fill([SN[0], SN[1] + SN[3] - 1, SN[2], 1], DARK);
    all(R.head3, (r) => g.noise(r, BONE, 0.08));
    /* 双翼(左右共区): 骨杆/翼尖亮灰 · 膜近黑 + 自翼根前缘角扇开的
       七根亮灰辐条 + 后缘亮线 + 前缘骨下阴影(白骨黑膜, 对图 1/2,
       官方膜纹同款: 辐条向肩部聚拢)。膜顶/底面 UV 朝向(kit asSeen):
       前缘骨侧 = 画布底行, 后缘 = 画布顶行;
       顶面翼根在画布右, 底面 u 镜像在画布左 */
    all(R.wingL, (r) => g.noise(r, BONE, 0.08)); /* 骨杆 */
    all(R.wingL3, (r) => g.noise(r, BONE, 0.08)); /* 翼尖 */
    const rib = (m, tx, ty, rootRight) => {
      const x0 = rootRight ? m[0] + m[2] - 1 : m[0];
      const y0 = m[1] + m[3] - 1;
      const x1 = rootRight ? x0 - tx : m[0] + tx;
      const y1 = m[1] + m[3] - 1 - ty;
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(x0 + (x1 - x0) * t);
        const y = Math.round(y0 + (y1 - y0) * t);
        g.px(x, y, RIB);
        g.px(Math.min(m[0] + m[2] - 1, Math.max(m[0],
            x + (rootRight ? -1 : 1))), y, RIB); /* 2px 厚, 夹回矩形内 */
      }
    };
    for (const f of ['top', 'bottom']) {
      const m = R.wingL2[f]; /* 平面盒可见面只有顶/底(56×56) */
      const rootRight = f === 'top';
      g.noise(m, MEMB, 0.06);
      g.mul([m[0], m[1] + m[3] - 5, m[2], 5], 0.7); /* 前缘骨下阴影 */
      g.fill([m[0], m[1], m[2], 1], RIB); /* 后缘亮线 */
      for (const tx of [10, 20, 30, 40, 50]) {
        rib(m, tx, m[3] - 2, rootRight); /* 五根奔后缘 */
      }
      for (const ty of [20, 40]) {
        rib(m, m[2] - 1, ty, rootRight); /* 两根奔翼尖 */
      }
    }
  }},
});
