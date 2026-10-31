'use strict';
/* ============================================================
   造型档案 · 凋灵骷髅蜘蛛骑士 (wither_skeleton_spider_jockey) — 引擎层
   (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   图源官方蜘蛛骑士(2026-10-31 用户票): 凋灵骷髅骑手坐在蜘蛛背上 —
   骨架与 skeleton_spider_jockey 逐字同构(spider 基座 + 细骨骑手,
   坐姿烘焙进盒/sitLegL|R 静态坐腿/'head' 让位骑手, 手法注引见彼),
   整体 ×1.2 渲染(wither_skeleton 同口径 — 骑手与坐骑等比放大, 官方
   bedrock 几何与骷髅逐字同构)。碳灰骨白瞳; 石剑 = armL 追加石条
   (wither_skeleton 同款); 无 armStyle — 通用摆臂步态+挥砍(weaponArm)。
   interface: declare('wither_skeleton_spider_jockey', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载, spider 基座); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('wither_skeleton_spider_jockey', {
  base: ['spider', {headKey: 'spiderHead',
    headUV: [0, 16], bodyUVs: [[32, 16], [0, 32]], legUVs: [[0, 52], [0, 57]]}],
  scale: 1.2,
  weaponArm: 'armL',
  debris: 0x242424,
  bones: {
    /* —— 骑手(凋灵骷髅, 全身抬高 0.25px 坐上蜘蛛前体 y12 顶面) —— */
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
      /* 石剑: z 前移 0.25px 让背刃面藏进臂内(防与臂 ±z 面共面闪面) */
      {origin: [4.5, 2.25, -1.25], size: [1, 14, 2], uv: [56, 16]},
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
    const CHAR = [62, 62, 62]; const CHAR2 = [44, 44, 44];
    const EYE = [226, 226, 226]; const STONE = [138, 143, 152]; const STONE2 = [104, 110, 120];
    const BODY = [66, 52, 56]; const BODY2 = [46, 36, 40];
    const LEG = [44, 34, 38]; const LEG2 = [34, 26, 30];
    const TIP = [20, 16, 18]; const RED = [216, 58, 42]; const DARKR = [138, 30, 18];
    /* —— 骑手: 碳灰颅脸+白瞳(wither_skeleton 同源) —— */
    const F = R.head.front;
    g.noise(F, CHAR, 0.05);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], EYE); g.fill([F[0] + 5, F[1] + 3, 2, 2], EYE);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], CHAR2);
    g.fill([F[0] + 2, F[1] + 6, 4, 2], EYE);
    g.px(F[0] + 3, F[1] + 6, CHAR2); g.px(F[0] + 4, F[1] + 6, CHAR2);
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], CHAR, 0.05);
    g.mul(R.head.bottom, 0.8);
    for (const part of [R.riderBody, R.armR, R.armL,
      R.sitLegL, R.sitLegL2, R.sitLegR, R.sitLegR2]) {
      g.noiseAll(part, CHAR, 0.05);
      g.mul(part.bottom, 0.8);
    }
    const B = R.riderBody.front;
    g.fill([B[0] + 1, B[1] + 2, 6, 1], CHAR2); /* 肋纹 */
    g.fill([B[0] + 1, B[1] + 4, 6, 1], CHAR2);
    /* 石剑(追加骨 armL2): 石刃+深柄(wither_skeleton 同款) */
    g.fillAll(R.armL2, STONE);
    for (const f of ['front', 'left', 'right']) {
      g.fill([R.armL2[f][0], R.armL2[f][1] + 11, R.armL2[f][2], 3], STONE2); /* 柄段 */
    }
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
