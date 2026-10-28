'use strict';
/* ============================================================
   造型档案 · 洞穴蜘蛛 (cave_spider) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   蜘蛛骨架逐字复用 + **scale 0.7**(wiki 口径, 研究笔记 §5 虫虫族):
   legL1..4/legR1..4 一腿一骨两段折线 + ry 放射(前/后腿 ±45° 扇形),
   步态相位交错与蜘蛛同款。
   蓝黑配色(配色锚延续旧 MOB_RIG); 八眼簇/螯肢/腹背人字纹画进贴图。
   interface: declare('cave_spider', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('cave_spider', {
  scale: 0.7,
  debris: 0x1a3a4a,
  bones: {
    head: {add: [{origin: [-4, 5, -11], size: [8, 8, 8], uv: [32, 0]}], pivot: [0, 9, -3]},
    root: {add: [
      {origin: [-3, 6, -3], size: [6, 6, 6], uv: [0, 0]}, /* 前体 */
      {origin: [-5, 5, 3], size: [10, 8, 12], uv: [0, 20]}, /* 腹 */
    ], pivot: [0, 9, 0]},
    /* 八腿一腿一骨(pivot 挤前体 + ry 放射, 官方 Java 版手法): 前腿朝前外
       45° · 后腿朝后外 45°(ry), 扇形罩住全身; 两段折线下垂(rz, 前后腿
       加大补偿放射后的垂距损失)触地, 左右 ry/rz 反号。
       八腿段全共区两块 UV(通体深色, 共区无感) */
    legL1: {pivot: [-4, 9, 2], add: [
      {origin: [-12, 8, 1], size: [8, 2, 2], ry: 0.785, rz: 0.5, uv: [0, 44]},
      {origin: [-19, 4, 1], size: [8, 2, 2], ry: 0.785, rz: 1.0, uv: [0, 48]},
    ]},
    legL2: {pivot: [-4, 9, 1], add: [
      {origin: [-12, 8, 0], size: [8, 2, 2], ry: 0.26, rz: 0.35, uv: [0, 44]},
      {origin: [-19, 4, 0], size: [8, 2, 2], ry: 0.26, rz: 0.7, uv: [0, 48]},
    ]},
    legL3: {pivot: [-4, 9, 0], add: [
      {origin: [-12, 8, -1], size: [8, 2, 2], ry: -0.26, rz: 0.35, uv: [0, 44]},
      {origin: [-19, 4, -1], size: [8, 2, 2], ry: -0.26, rz: 0.7, uv: [0, 48]},
    ]},
    legL4: {pivot: [-4, 9, -1], add: [
      {origin: [-12, 8, -2], size: [8, 2, 2], ry: -0.785, rz: 0.5, uv: [0, 44]},
      {origin: [-19, 4, -2], size: [8, 2, 2], ry: -0.785, rz: 1.0, uv: [0, 48]},
    ]},
    legR1: {pivot: [4, 9, 2], add: [
      {origin: [4, 8, 1], size: [8, 2, 2], ry: -0.785, rz: -0.5, uv: [0, 44]},
      {origin: [11, 4, 1], size: [8, 2, 2], ry: -0.785, rz: -1.0, uv: [0, 48]},
    ]},
    legR2: {pivot: [4, 9, 1], add: [
      {origin: [4, 8, 0], size: [8, 2, 2], ry: -0.26, rz: -0.35, uv: [0, 44]},
      {origin: [11, 4, 0], size: [8, 2, 2], ry: -0.26, rz: -0.7, uv: [0, 48]},
    ]},
    legR3: {pivot: [4, 9, 0], add: [
      {origin: [4, 8, -1], size: [8, 2, 2], ry: 0.26, rz: -0.35, uv: [0, 44]},
      {origin: [11, 4, -1], size: [8, 2, 2], ry: 0.26, rz: -0.7, uv: [0, 48]},
    ]},
    legR4: {pivot: [4, 9, -1], add: [
      {origin: [4, 8, -2], size: [8, 2, 2], ry: 0.785, rz: -0.5, uv: [0, 44]},
      {origin: [11, 4, -2], size: [8, 2, 2], ry: 0.785, rz: -1.0, uv: [0, 48]},
    ]},
  },
  tex: {size: 64, paint: (g, R) => {
    const BODY = [40, 82, 100]; const BODY2 = [30, 60, 73];
    const LEG = [30, 60, 73]; const LEG2 = [24, 48, 58]; /* 胫节比股节暗(体积感) */
    const TIP = [12, 24, 30]; const RED = [216, 58, 42]; const DARKR = [128, 26, 16];
    /* 头: 蓝黑噪底 · 八眼簇(大红对 + 暗红六小) · 螯肢红尖 */
    const F = R.head.front;
    g.noise(F, BODY, 0.08);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], RED); g.fill([F[0] + 5, F[1] + 3, 2, 2], RED);
    g.px(F[0] + 2, F[1] + 1, DARKR); g.px(F[0] + 5, F[1] + 1, DARKR); /* 上对小眼 */
    g.px(F[0], F[1] + 5, DARKR); g.px(F[0] + 2, F[1] + 5, DARKR);
    g.px(F[0] + 5, F[1] + 5, DARKR); g.px(F[0] + 7, F[1] + 5, DARKR); /* 下排弧形四小 */
    g.fill([F[0] + 3, F[1] + 6, 1, 2], DARKR); g.fill([F[0] + 4, F[1] + 6, 1, 2], DARKR);
    g.px(F[0] + 3, F[1] + 7, RED); g.px(F[0] + 4, F[1] + 7, RED); /* 螯肢尖 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head[f], BODY, 0.08);
    }
    g.fill([R.head.top[0] + 3, R.head.top[1], 2, R.head.top[3]], BODY2); /* 头背中纹 */
    /* 体两节(root=前体, root2=腹): 蓝黑底 + 背中纹 */
    g.noiseAll(R.root, BODY, 0.08);
    g.noiseAll(R.root2, BODY, 0.08);
    g.fill([R.root.top[0] + 2, R.root.top[1], 2, R.root.top[3]], BODY2); /* 前体背中纹 */
    /* 腹背人字纹 ×3(V 尖朝尾, 官方腹部锯齿纹语义) */
    const B = R.root2.back;
    for (const dy of [0, 3, 6]) {
      g.px(B[0] + 4, B[1] + dy, BODY2);
      g.px(B[0] + 3, B[1] + dy + 1, BODY2); g.px(B[0] + 5, B[1] + dy + 1, BODY2);
      g.px(B[0] + 2, B[1] + dy + 1, BODY2); g.px(B[0] + 6, B[1] + dy + 1, BODY2);
    }
    for (const f of ['left', 'right']) {/* 腹侧分节竖纹 */
      const r = R.root2[f];
      for (let x = 2; x < r[2]; x += 3) g.fill([r[0] + x, r[1], 1, r[3]], BODY2);
    }
    /* 八腿段(全共区): 股亮 · 胫暗 · 两端关节环 · 端面黑尖 · 上亮下暗 */
    g.noiseAll(R.legL1, LEG, 0.06);
    g.noiseAll(R.legL12, LEG2, 0.06);
    for (const seg of [R.legL1, R.legL12]) {
      for (const f of ['front', 'back']) {
        const r = seg[f];
        g.px(r[0], r[1], BODY2); g.px(r[0], r[1] + 1, BODY2);
        g.px(r[0] + r[2] - 1, r[1], BODY2); g.px(r[0] + r[2] - 1, r[1] + 1, BODY2);
      }
      g.fill(seg.left, BODY2); g.fill(seg.right, BODY2);
      g.mul(seg.top, 1.1); g.mul(seg.bottom, 0.8);
    }
    g.fill(R.legL12.left, TIP); g.fill(R.legL12.right, TIP); /* 胫节端面黑尖 */
  }},
});
