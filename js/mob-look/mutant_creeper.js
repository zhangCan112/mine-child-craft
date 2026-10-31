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
   躯干改造三轮(2026-10-31 用户反馈): 一轮「身体太短」立柱 10→16px;
   二轮「你之前加的是身高」立柱回落 16→12px+髋板 12→16px 马身(腿对
   z ±4→±6 分开站); 三轮对照参考图补两处细节——①颈: 新增前倾颈盒
   (rx −0.6)从柱顶伸向前上方, 头随之前移(参考图「头向前伸出去」);
   ②两段弯折腿读出来: 胫节 9→13px 上端搭接股外端(旧胫上端
   (±14.1,8.8)与股端(±11.5,11.1)悬空 3.5px=断膝观感), 足端仍触地。
   interface: declare('mutant_creeper', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('mutant_creeper', {
  scale: 1.4, /* 调研口径: 模组高 ≈1.4 倍(h 2.8 随二轮体型修正)——比王(2.0)小一号 */
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
    /* 身四件(root=髋板, root2=立柱, root3=后驼峰, root4=颈): 同款迷彩
       (逐面调 camo); 立柱正面嘴下一道下颌暗纹(参考图喉部阴影) */
    for (const part of [R.root, R.root2, R.root3, R.root4]) {
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
  /* 自有骨架: 拱背四盒(髋板+立柱+后驼峰+颈) + 四条两节撇腿一腿一骨。
     2026-10-31 三轮拍板(对照参考图细节): ①颈盒前倾(rx −0.6)从柱顶
     伸向前上方, 头前移到 z−13(参考图头前伸; 头 pivot 在 own 后下角
     (0,27,−5) 供 gait 前扑绕颈顶转); ②胫节 9→13px: 上端(±12,11.5)
     搭接股外端(±11.5,11.1)——旧 9px 胫上端(±14.1,8.8)悬空 3.5px
     断膝, 现在两段弯折读得出; 足端(±19,0.5)仍触地。
     UV 布局(64 档重排): 头(0,0) · 颈(32,0) · 驼峰(32,14) ·
     立柱(0,16) · 股(0,35) · 胫(24,35) · 髋板(0,43)。
     腿几何(±x 镜像, 前对 z−/后对 z+): 股节 8×4×4 外撇 rz±0.5(外端
     (±11.5,11.1)), 胫节 13×4×4 陡折 rz±1.0(膝端接股节外端)——
     蜘蛛折线加粗款 */
  bones: {
    head: {add: [{origin: [-4, 27, -13], size: [8, 8, 8], uv: [0, 0]}], pivot: [0, 27, -5]},
    root: {add: [
      {origin: [-5, 9, -8], size: [10, 4, 16], uv: [0, 43]}, /* 髋板: 连四腿的横板(16px 马身) */
      {origin: [-4, 13, -5], size: [8, 12, 7], uv: [0, 16]}, /* 立柱: 前高(拱背前股, 12px) */
      {origin: [-4, 13, 0], size: [8, 11, 4], rx: 0.3, uv: [32, 14]}, /* 后驼峰: 长斜板柱顶起拱斜下接髋(rear 降) */
      {origin: [-4, 22, -9], size: [8, 8, 6], rx: -0.6, uv: [32, 0]}, /* 颈: 前倾伸向柱顶前上方 */
    ], pivot: [0, 11, 0]},
    legL1: {pivot: [-4, 13, -6], add: [
      {origin: [-12, 11, -8], size: [8, 4, 4], rz: 0.5, uv: [0, 35]},
      {origin: [-22, 4, -8], size: [13, 4, 4], rz: 1.0, uv: [24, 35]},
    ]},
    legL2: {pivot: [-4, 13, 6], add: [
      {origin: [-12, 11, 4], size: [8, 4, 4], rz: 0.5, uv: [0, 35]},
      {origin: [-22, 4, 4], size: [13, 4, 4], rz: 1.0, uv: [24, 35]},
    ]},
    legR1: {pivot: [4, 13, -6], add: [
      {origin: [4, 11, -8], size: [8, 4, 4], rz: -0.5, uv: [0, 35]},
      {origin: [9, 4, -8], size: [13, 4, 4], rz: -1.0, uv: [24, 35]},
    ]},
    legR2: {pivot: [4, 13, 6], add: [
      {origin: [4, 11, 4], size: [8, 4, 4], rz: -0.5, uv: [0, 35]},
      {origin: [9, 4, 4], size: [13, 4, 4], rz: -1.0, uv: [24, 35]},
    ]},
  },
});
