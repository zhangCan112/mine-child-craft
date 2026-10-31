'use strict';
/* ============================================================
   造型档案 · 流浪者蜘蛛骑士 (stray_spider_jockey) — 引擎层
   (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   图源官方蜘蛛骑士(2026-10-31 用户票): 流浪者骑手坐在蜘蛛背上 —
   骨架与 skeleton_spider_jockey 逐字同构(spider 基座 + 细骨骑手,
   坐姿烘焙进盒/sitLegL|R 静态坐腿/'head' 让位骑手, 手法注引见彼),
   换皮: 雪原破袍(骨白脸+兜帽全包+青灰罩袍+袍摆锯齿, stray 同源)。
   弓手步态 armStyle 'archer'; 弓 = armL 追加细木条(skeleton 同款)。
   interface: declare('stray_spider_jockey', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载, spider 基座); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('stray_spider_jockey', {
  base: ['spider', {headKey: 'spiderHead',
    headUV: [0, 16], bodyUVs: [[32, 16], [0, 32]], legUVs: [[0, 52], [0, 57]]}],
  armStyle: 'archer',
  weaponArm: 'armL',
  debris: 0xd8dee4,
  bones: {
    /* —— 骑手(流浪者, 全身抬高 0.25px 坐上蜘蛛前体 y12 顶面) —— */
    head: {pivot: [0, 24.25, 0], add: [
      {origin: [-4, 24.25, -4], size: [8, 8, 8], uv: [0, 0]},
    ]},
    riderBody: {pivot: [0, 24.25, 0], add: [
      {origin: [-4, 12.25, -2], size: [8, 12, 4], uv: [32, 0]},
    ]},
    armR: {pivot: [-5, 22.25, 0], add: [
      {origin: [-6, 12.25, -1], size: [2, 12, 2], uv: [56, 0]},
    ]},
    armL: {pivot: [5, 22.25, 0], add: [
      {origin: [4, 12.25, -1], size: [2, 12, 2], uv: [56, 0]},
      {origin: [4.5, 2.25, -0.5], size: [1, 11, 1], uv: [56, 16]}, /* 弓 */
    ]},
    /* 坐姿腿(静态骨, 步态不摆): 大腿水平前伸+小腿垂直对接(盒间对齐防
       同面共面闪面), 左右共区两块 UV */
    sitLegL: {add: [
      {origin: [1.75, 10.25, -4], size: [2, 2, 6], uv: [44, 32]}, /* 大腿 */
      {origin: [1.75, 4.25, -4], size: [2, 6, 2], uv: [44, 40]}, /* 小腿 */
    ]},
    sitLegR: {add: [
      {origin: [-3.75, 10.25, -4], size: [2, 2, 6], uv: [44, 32]},
      {origin: [-3.75, 4.25, -4], size: [2, 6, 2], uv: [44, 40]},
    ]},
  },
  tex: {size: 64, paint: (g, R) => {
    const BONE = [216, 222, 228]; const BONE2 = [176, 186, 196];
    const DARK = [26, 42, 56]; const WOOD = [107, 74, 42];
    const ROBE = [122, 154, 176]; const ROBE2 = [92, 122, 146];
    const BODY = [66, 52, 56]; const BODY2 = [46, 36, 40];
    const LEG = [44, 34, 38]; const LEG2 = [34, 26, 30];
    const TIP = [20, 16, 18]; const RED = [216, 58, 42]; const DARKR = [138, 30, 18];
    /* —— 骑手: 骨白脸+兜帽全包(帽檐压眉/帽顶缝, 下巴露骨) —— */
    const F = R.head.front;
    g.noise(F, BONE, 0.04);
    g.fill([F[0], F[1], 8, 2], ROBE);
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], BONE2);
    g.fill([F[0] + 2, F[1] + 6, 4, 2], BONE2);
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], ROBE, 0.06);
    g.fill([R.head.top[0], R.head.top[1], 8, 2], ROBE2); /* 帽顶缝 */
    g.noise(R.head.bottom, BONE, 0.04);
    g.mul(R.head.bottom, 0.8);
    /* 罩袍通体+袍摆锯齿(stray 同源) */
    const robe = (part) => {
      g.noiseAll(part, ROBE, 0.05);
      for (const f of ['front', 'back', 'left', 'right']) {
        const r = part[f];
        for (let x = 0; x < r[2]; x += 2) {
          g.fill([r[0] + x, r[1] + r[3] - 1, 1, 1], ROBE2);
          g.px(r[0] + x + 1, r[1] + r[3] - 2, ROBE2);
        }
      }
    };
    robe(R.riderBody); robe(R.armR); robe(R.armL);
    robe(R.sitLegL); robe(R.sitLegL2); robe(R.sitLegR); robe(R.sitLegR2);
    const B = R.riderBody.front;
    g.fill([B[0] + 1, B[1] + 2, 6, 1], ROBE2); /* 肋纹透袍 */
    g.fill([B[0] + 1, B[1] + 4, 6, 1], ROBE2);
    g.fillAll(R.armL2, WOOD); /* 弓 */
    /* —— 坐骑(蜘蛛): 与 spider.js 贴图同源, 区号不同 —— */
    const SF = R.spiderHead.front;
    g.noise(SF, BODY, 0.08);
    g.fill([SF[0] + 1, SF[1] + 3, 2, 2], RED); g.fill([SF[0] + 5, SF[1] + 3, 2, 2], RED);
    g.px(SF[0] + 2, SF[1] + 1, DARKR); g.px(SF[0] + 5, SF[1] + 1, DARKR);
    g.px(SF[0], SF[1] + 5, DARKR); g.px(SF[0] + 2, SF[1] + 5, DARKR);
    g.px(SF[0] + 5, SF[1] + 5, DARKR); g.px(SF[0] + 7, SF[1] + 5, DARKR);
    g.fill([SF[0] + 3, SF[1] + 6, 1, 2], DARKR); g.fill([SF[0] + 4, SF[1] + 6, 1, 2], DARKR);
    g.px(SF[0] + 3, SF[1] + 7, RED); g.px(SF[0] + 4, SF[1] + 7, RED);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.spiderHead[f], BODY, 0.08);
    }
    g.fill([R.spiderHead.top[0] + 3, R.spiderHead.top[1], 2, R.spiderHead.top[3]], BODY2);
    g.noiseAll(R.root, BODY, 0.08);
    g.noiseAll(R.root2, BODY, 0.08);
    g.fill([R.root.top[0] + 2, R.root.top[1], 2, R.root.top[3]], BODY2);
    const BK = R.root2.back;
    for (const dy of [0, 3, 6]) {
      g.px(BK[0] + 4, BK[1] + dy, BODY2);
      g.px(BK[0] + 3, BK[1] + dy + 1, BODY2); g.px(BK[0] + 5, BK[1] + dy + 1, BODY2);
      g.px(BK[0] + 2, BK[1] + dy + 1, BODY2); g.px(BK[0] + 6, BK[1] + dy + 1, BODY2);
    }
    for (const f of ['left', 'right']) {
      const r = R.root2[f];
      for (let x = 2; x < r[2]; x += 3) g.fill([r[0] + x, r[1], 1, r[3]], BODY2);
    }
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
    g.fill(R.legL12.left, TIP); g.fill(R.legL12.right, TIP);
  }},
});
