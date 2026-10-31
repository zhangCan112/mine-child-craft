'use strict';
/* ============================================================
   造型档案 · 突变巨型苦力怕 (mutant_creeper) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   按模组实机观感重建(用户 2026-10-31 拍板, 参考图+调研 §3 模型规格):
   拱背身躯 = 立柱(前高)+后驼峰(rx 斜下)+髋板——模组四段弓身链
   (骨盆→身体→颈→头)的 Q 版三盒简化; 四条两节撇腿一腿一骨(legL1/2 +
   legR1/2, 复用 mobs.js gait 蜘蛛式相位分支)——股节外撇(rz ±0.5)+
   胫节陡折触地(rz ±1.0, 端面黑足尖), 蜘蛛折线同手法加粗。
   脸=苦力怕垂腿嘴加开口(嘴心柱多一行)+怒眉+红瞳(Mutant 招牌),
   配色=浅豆绿底+中绿迷彩斑+亮绿碎斑+深绿暗斑(调研 §3.4 PNG 采样,
   像素自绘 D13; 调研底座 docs/mc-mutant-creeper-research.md)。
   interface: declare('mutant_creeper', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('mutant_creeper', {
  scale: 1.4, /* 调研口径: 模组高 ≈1.4 倍(2.4 格碰撞箱)——比王(1.6)小一号 */
  debris: 0x80c070, /* 击杀碎块=主底色浅豆绿(调研 §3.4 主底色采样) */
  tex: {size: 64, paint: (g, R) => {
    const BASE = [128, 192, 112]; const MID = [88, 152, 80];
    const VIVID = [64, 184, 32]; const DARKG = [52, 96, 48];
    const SOCKET = [24, 32, 24]; const MOUTH = [14, 18, 14]; const RED = [224, 48, 40];
    /* 迷彩噪底: 浅豆绿底+中绿大斑+亮绿碎斑+深绿暗斑(参考图迷彩肌理,
       调研 §3.4 三件套扩一档中绿; 种子化, 同 type 同图) */
    const camo = (r) => {
      g.noise(r, BASE, 0.08);
      for (let i = 0; i < Math.max(2, Math.floor(r[2] * r[3] / 9)); i++) {
        g.fill([r[0] + Math.floor(g.rng() * (r[2] - 1)), r[1] + Math.floor(g.rng() * (r[3] - 1)),
          2, 2], MID);
      }
      for (let i = 0; i < Math.max(3, Math.floor(r[2] * r[3] / 12)); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]), VIVID);
      }
      for (let i = 0; i < Math.max(1, Math.floor(r[2] * r[3] / 22)); i++) {
        g.fill([r[0] + Math.floor(g.rng() * (r[2] - 1)), r[1] + Math.floor(g.rng() * (r[3] - 1)),
          2, 2], DARKG);
      }
    };
    /* 头: 迷彩底 · 怒眉+黑眶红瞳(突变招牌, 参考图正面) · 垂腿嘴加开口一行
       (嘴心柱比常款深一行=大张嘴, 认脸锚仍是苦力怕嘴形) */
    const F = R.head.front;
    camo(F);
    g.fill([F[0] + 1, F[1] + 2, 2, 1], SOCKET); g.fill([F[0] + 5, F[1] + 2, 2, 1], SOCKET); /* 怒眉 */
    g.fill([F[0] + 1, F[1] + 3, 2, 2], SOCKET); g.fill([F[0] + 5, F[1] + 3, 2, 2], SOCKET); /* 黑眶 */
    g.px(F[0] + 2, F[1] + 3, SOCKET); g.px(F[0] + 5, F[1] + 3, SOCKET); /* 眉眶斜连(怒相) */
    g.px(F[0] + 2, F[1] + 4, RED); g.px(F[0] + 5, F[1] + 4, RED); /* 红瞳(眶内下侧) */
    g.fill([F[0] + 3, F[1] + 5, 2, 3], MOUTH); /* 嘴心柱(rows 5~7, 比常款深一行) */
    g.fill([F[0] + 2, F[1] + 6, 1, 2], MOUTH); g.fill([F[0] + 5, F[1] + 6, 1, 2], MOUTH); /* 垂腿 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) camo(R.head[f]);
    /* 身三件(root=髋板, root2=立柱, root3=后驼峰): 同款迷彩(逐面调 camo);
       立柱正面嘴下一道下颌暗纹(参考图喉部阴影) */
    for (const part of [R.root, R.root2, R.root3]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) camo(part[f]);
    }
    g.fill([R.root2.front[0] + 3, R.root2.front[1], 2, 2], DARKG);
    /* 八腿段全共区两块 UV(股亮/胫暗/黑足尖, 蜘蛛同手法): 关节环+端面足尖 */
    g.noiseAll(R.legL1, MID, 0.08);
    g.noiseAll(R.legL12, DARKG, 0.08);
    for (const seg of [R.legL1, R.legL12]) {
      for (const f of ['front', 'back']) {
        const r = seg[f];
        g.px(r[0], r[1], DARKG); g.px(r[0], r[1] + 1, DARKG);
        g.px(r[0] + r[2] - 1, r[1], DARKG); g.px(r[0] + r[2] - 1, r[1] + 1, DARKG);
      }
      g.mul(seg.top, 1.12); g.mul(seg.bottom, 0.8);
    }
    g.fill(R.legL12.bottom, MOUTH); g.fill(R.legL12.left, MOUTH); g.fill(R.legL12.right, MOUTH);
    g.fill([R.legL12.front[0], R.legL12.front[1] + R.legL12.front[3] - 1, R.legL12.front[2], 1], MOUTH);
    g.fill([R.legL12.back[0], R.legL12.back[1] + R.legL12.back[3] - 1, R.legL12.back[2], 1], MOUTH);
  }},
  /* 自有骨架: 拱背三盒(髋板+立柱+后驼峰) + 四条两节撇腿一腿一骨。
     腿几何(±x 镜像, 前对 z−/后对 z+): 股节 8×4×4 外撇 rz±0.5(外端
     (±11.5,11.1)), 胫节 9×4×4 陡折 rz±1.0(膝端接股节外端, 足端
     (±19.2,0.8) 触地)——蜘蛛折线加粗款; UV 全共区两块(32,16 股/32,24 胫) */
  bones: {
    head: {add: [{origin: [-4, 23, -6], size: [8, 8, 8], uv: [0, 0]}], pivot: [0, 23, -2]},
    root: {add: [
      {origin: [-5, 9, -6], size: [10, 4, 12], uv: [0, 34]}, /* 髋板: 连四腿的横板 */
      {origin: [-4, 13, -5], size: [8, 10, 7], uv: [0, 16]}, /* 立柱: 前高(拱背前股) */
      {origin: [-4, 14, 2], size: [8, 5, 5], rx: 0.55, uv: [36, 0]}, /* 后驼峰: 斜下接髋(rear 降) */
    ], pivot: [0, 11, 0]},
    legL1: {pivot: [-4, 13, -4], add: [
      {origin: [-12, 11, -6], size: [8, 4, 4], rz: 0.5, uv: [32, 16]},
      {origin: [-21, 3, -6], size: [9, 4, 4], rz: 1.0, uv: [32, 24]},
    ]},
    legL2: {pivot: [-4, 13, 4], add: [
      {origin: [-12, 11, 2], size: [8, 4, 4], rz: 0.5, uv: [32, 16]},
      {origin: [-21, 3, 2], size: [9, 4, 4], rz: 1.0, uv: [32, 24]},
    ]},
    legR1: {pivot: [4, 13, -4], add: [
      {origin: [4, 11, -6], size: [8, 4, 4], rz: -0.5, uv: [32, 16]},
      {origin: [12, 3, -6], size: [9, 4, 4], rz: -1.0, uv: [32, 24]},
    ]},
    legR2: {pivot: [4, 13, 4], add: [
      {origin: [4, 11, 2], size: [8, 4, 4], rz: -0.5, uv: [32, 16]},
      {origin: [12, 3, 2], size: [9, 4, 4], rz: -1.0, uv: [32, 24]},
    ]},
  },
});
