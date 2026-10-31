'use strict';
/* ============================================================
   造型档案 · 劫掠兽 (ravager) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   四足基座官方等比(bedrock ravager.geo 核对: 身 14×20×16 预躺平 ·
   腿 8×37×8 四条同规格 — quad 直用) + 胸 12×18×13(root 追加) +
   颈 10×10×18 + 嘴 16×3×16 + 鼻瘤 4×8×4 + 双角 2×14×4 rx60°
   (head 追加)。2026-10-31 对齐官方图: 橙红鞍毯(旧版深灰鞍撤销)+
   青绿护甲块 ×6(头顶/颈上/背后各一对, 追加盒共区一块 UV)+头色加深,
   腿加青绿绑带。贴图 128 档。
   interface: declare('ravager', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('ravager', {
  base: ['quad', {
    w: 14, h: 20, len: 16, bodyCY: 13, bodyCZ: 3,
    legW: 8, legH: 37, legX: 8, legZF: -4, legZB: 21,
    headW: 16, headH: 20, headD: 16, headCY: 24, headCZ: -16, headPY: 28, headPZ: -10,
    bodyUV: [0, 59], headUV: [0, 0],
    legUVs: [[68, 50], [68, 50], [68, 50], [68, 50]], /* 四腿共区 */
  }],
  debris: 0x4a4a52,
  bones: {
    root: {add: [
      {origin: [-6, 5, -20], size: [12, 18, 13], uv: [0, 97]}, /* 胸 */
      {origin: [-6, 23, 8], size: [4, 3, 3], uv: [104, 40]}, /* 背甲后左 */
      {origin: [2, 23, 8], size: [4, 3, 3], uv: [104, 40]}, /* 背甲后右(共区) */
    ]},
    head: {add: [
      {origin: [-5, 21, -10], size: [10, 10, 18], uv: [68, 0]}, /* 颈 */
      {origin: [-7.5, 13, -23.5], size: [15, 3, 15], uv: [0, 38]}, /* 嘴(下颚, 四向缩 0.5px 防与头侧壁共面闪面) */
      {origin: [-2, 12, -28], size: [4, 8, 4], uv: [68, 30]}, /* 鼻瘤 */
      {origin: [8, 27, -20], size: [2, 14, 4], uv: [88, 30], rx: 1.05}, /* 左角(60°) */
      {origin: [-10, 27, -20], size: [2, 14, 4], uv: [88, 30], rx: 1.05}, /* 右角(共区) */
      {origin: [-7, 34, -23], size: [4, 2, 4], uv: [104, 30]}, /* 头顶甲左 */
      {origin: [3, 34, -23], size: [4, 2, 4], uv: [104, 30]}, /* 头顶甲右(共区) */
      {origin: [-4, 31, 0], size: [4, 2, 4], uv: [104, 30]}, /* 颈甲左 */
      {origin: [0, 31, 0], size: [4, 2, 4], uv: [104, 30]}, /* 颈甲右(共区) */
    ]},
  },
  tex: {size: 128, paint: (g, R) => {
    const GREY = [106, 100, 96]; const GREY2 = [88, 82, 78];
    const HEAD = [84, 76, 70]; /* 头/颈深棕灰(图中头部明显深一档) */
    const DARK = [46, 46, 52]; const HORN = [240, 232, 216];
    const TEETH = [230, 226, 214]; const EYE = [216, 176, 40];
    const CLOTH = [196, 84, 28]; const CLOTH2 = [160, 64, 20]; /* 橙红鞍毯 */
    const TEAL = [96, 176, 168]; /* 青绿护甲 */
    /* 身: 灰皮噪底 · 背上橙红鞍毯(中段, 前后留灰 + 两侧垂沿) */
    g.noiseAll(R.root, GREY, 0.05);
    const T = R.root.top;
    g.fill([T[0] + 1, T[1] + 3, T[2] - 2, 9], CLOTH); /* 毯(背中段) */
    g.fill([T[0] + 1, T[1] + 3, T[2] - 2, 1], CLOTH2); /* 毯后缘压暗 */
    for (const f of ['left', 'right']) {
      g.fill([R.root[f][0] + 5, R.root[f][1], 8, 3], CLOTH); /* 侧垂沿 */
    }
    g.mul(R.root.bottom, 0.88);
    /* 胸(root2): 深灰胸甲 */
    g.noiseAll(R.root2, GREY2, 0.05);
    /* 头: 深棕灰底 · 金眼 · 眉骨 */
    const F = R.head.front;
    g.noise(F, HEAD, 0.05);
    g.fill([F[0] + 2, F[1] + 5, 3, 3], EYE); g.fill([F[0] + 11, F[1] + 5, 3, 3], EYE); /* 金眼 */
    g.fill([F[0] + 2, F[1] + 4, 12, 1], GREY2); /* 眉骨 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], HEAD, 0.05);
    g.noise(R.head.bottom, HEAD, 0.05); g.mul(R.head.bottom, 0.85);
    /* 颈(head2): 深棕灰 */
    g.noiseAll(R.head2, HEAD, 0.05);
    /* 嘴(head3): 深口鼻 + 白牙列(上下缘) */
    g.noiseAll(R.head3, GREY2, 0.05);
    const M = R.head3.front;
    g.fill([M[0], M[1], M[2], M[3]], DARK); /* 口鼻暗区 */
    for (let i = 0; i < 4; i++) {
      g.fill([M[0] + 1 + i * 4, M[1], 2, 2], TEETH); /* 上牙 */
      g.px(M[0] + 2 + i * 4, M[1] + M[3] - 1, TEETH); /* 下牙 */
    }
    /* 鼻瘤(head4): 深灰 */
    g.noiseAll(R.head4, DARK, 0.15);
    /* 双角(共区 head5/head6): 米白 */
    for (const part of [R.head5, R.head6]) {
      g.fillAll(part, HORN);
    }
    /* 青绿护甲块 ×6(共区: 头顶甲 head7/head8 · 颈甲 head9/head10 ·
       背甲 root3): 顶面提亮+底面压暗(体积感) */
    for (const part of [R.head7, R.head8, R.head9, R.head10, R.root3]) {
      g.fillAll(part, TEAL);
      g.mul(part.top, 1.18); g.mul(part.bottom, 0.85);
    }
    /* 四腿(共区): 灰腿+青绿绑带+深爪 */
    for (const leg of [R.legL, R.legL2, R.legR, R.legR2]) {
      g.noiseAll(leg, GREY2, 0.05);
      for (const f of ['front', 'back', 'left', 'right']) {
        g.fill([leg[f][0], leg[f][1] + 24, leg[f][2], 3], TEAL); /* 绑带 */
      }
      g.fill([leg.front[0], leg.front[1] + leg.front[3] - 3, leg.front[2], 3], DARK); /* 爪 */
    }
  }},
});
