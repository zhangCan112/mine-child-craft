'use strict';
/* ============================================================
   造型档案 · 羊 (sheep) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   四足基座(官方竖模预躺平: 身 8×6×16 心 y15 · 头 6×6×8 · 腿 4×12×4,
   推导自 docs/mc-mob-models-research.md §5 农场一家) + **羊毛 overlay**
   (身同盒 inflate 1.75 / 头同盒 inflate 0.6 — 官方第二层语言, 本票
   overlay 代表)。消费者: mobs.js(+Z 镜像合批)。
   interface: declare('sheep', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖/overlay 断言
   ============================================================ */
MobLookKit.declare('sheep', {
  base: ['quad', {
    w: 8, h: 6, len: 16, bodyCY: 15, bodyCZ: 0,
    legW: 4, legH: 12, legX: 3, legZF: -6, legZB: 6,
    headW: 6, headH: 6, headD: 8, headCY: 19, headCZ: -10, headPY: 18, headPZ: -8,
    wool: {inflate: 1.75, bodyUV: [0, 40], headInflate: 0.6, headUV: [36, 40]},
  }],
  debris: 0xebebeb,
  tex: {size: 64, paint: (g, R) => {
    const WOOL = [235, 235, 235]; const WOOL2 = [216, 212, 204];
    const SKIN = [232, 224, 208]; const DARK = [42, 26, 26]; const PINK = [228, 168, 158];
    /* 绒毛笔触: 白噪底 + 卷曲斑(种子化) */
    const fleece = (r) => {
      g.noise(r, WOOL, 0.05);
      for (let i = 0; i < Math.max(2, r[2] * r[3] / 5); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]), WOOL2);
      }
    };
    /* 羊毛 overlay(身 root2 / 头 head2): 绒毛通体 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      fleece(R.root2[f]);
      fleece(R.head2[f]);
    }
    /* 裸身/裸头(剪羊毛口径, overlay 之下透出的边角) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], SKIN, 0.05);
      g.noise(R.head[f], SKIN, 0.05);
    }
    /* 头正面(overlay 之下也有脸): 眼 + 粉吻 */
    const F = R.head.front;
    g.fill([F[0] + 1, F[1] + 2, 1, 2], DARK); g.fill([F[0] + 4, F[1] + 2, 1, 2], DARK);
    g.fill([F[0] + 2, F[1] + 4, 2, 2], PINK); /* 粉吻 */
    g.px(F[0] + 2, F[1] + 4, DARK); g.px(F[0] + 3, F[1] + 4, DARK); /* 鼻孔 */
    /* 羊毛头正面开脸洞(露眼与吻 — overlay 罩脸会闷) */
    const W = R.head2.front;
    g.fill([W[0] + 1, W[1] + 1, 4, 4], WOOL2); /* 脸洞框 */
    /* 腿: 上段绒白下段浅肤(膝下露肤) */
    for (const leg of [R.legL, R.legL2, R.legR, R.legR2]) {
      for (const f of ['front', 'back', 'left', 'right']) {
        g.noise(leg[f], WOOL, 0.05);
        g.fill([leg[f][0], leg[f][1] + 8, leg[f][2], 4], SKIN);
      }
      fleece(leg.top);
      g.fill(leg.bottom, SKIN); g.mul(leg.bottom, 0.8);
    }
  }},
});
