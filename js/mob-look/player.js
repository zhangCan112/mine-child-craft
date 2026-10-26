'use strict';
/* ============================================================
   造型档案 · 玩家 (player) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   小探险家: 官方 8/12/12px 等比人形(基座 humanoid), 身份件全部画进
   64×64 皮肤(橙帽/背包/蓝衫/棕色头发, 换自旧 avatar.js 盒子建模的
   配色锚 — docs/mob-look-design.md D4)。消费者: avatar.js 傀儡(−Z)。
   基座: humanoid(玩家版 UV 布局) · 步态无(玩家动画在 Avatar) · 无 debris
   interface: declare('player', {...}) — 单一声明, 零其它语句
   依赖: js/mob-look-kit.js(先载)
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('player', {
  base: ['humanoid'],
  tex: {size: 64, paint: (g, R) => {
    /* 配色锚(旧 avatar.js 延续): 肤/发/帽/衫/裤/鞋/背包/五官 */
    const SKIN = [240, 194, 151]; const HAIR = [90, 58, 34];
    const CAP = [232, 100, 44]; const CAPD = [196, 79, 31];
    const SHIRT = [79, 143, 221]; const PANTS = [46, 74, 143];
    const SHOE = [47, 50, 56]; const BAG = [217, 79, 79]; const STRAP = [138, 50, 50];
    const DARK = [42, 42, 51]; const CHEEK = [245, 160, 140];
    /* 头: 帽两行+檐 · 刘海两行 · 大眼/微笑/红晕(儿童亲和脸) */
    const F = R.head.front;
    g.noise(F, SKIN, 0.04);
    g.fill([F[0], F[1], 8, 1], CAP);
    g.fill([F[0], F[1] + 1, 8, 1], CAPD); /* 帽檐(正面深一档) */
    g.fill([F[0], F[1] + 2, 8, 2], HAIR); /* 刘海 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.px(F[0] + 2, F[1] + 4, [235, 235, 245]); g.px(F[0] + 6, F[1] + 4, [235, 235, 245]); /* 眼高光 */
    g.fill([F[0] + 3, F[1] + 6, 2, 1], DARK); /* 微笑 */
    g.px(F[0], F[1] + 5, CHEEK); g.px(F[0] + 7, F[1] + 5, CHEEK); /* 红晕 */
    g.noise(R.head.top, CAP, 0.05);
    g.noise(R.head.bottom, SKIN, 0.04); g.mul(R.head.bottom, 0.8);
    for (const side of [R.head.left, R.head.right, R.head.back]) {
      g.noise(side, SKIN, 0.04);
      g.fill([side[0], side[1], 8, 2], CAP);
      g.fill([side[0], side[1] + 2, 8, 3], HAIR);
    }
    /* 身: 蓝衫+背带 · 背面红背包+背带横条 */
    const B = R.root.front;
    g.noise(B, SHIRT, 0.05);
    g.fill([B[0] + 3, B[1], 2, 1], SKIN); /* 领口露肤 */
    g.fill([B[0] + 1, B[1], 1, 7], STRAP); g.fill([B[0] + 6, B[1], 1, 7], STRAP);
    const BK = R.root.back;
    g.noise(BK, SHIRT, 0.05);
    g.fill([BK[0], BK[1] + 1, 8, 1], STRAP); /* 背带横条 */
    g.fill([BK[0] + 1, BK[1] + 3, 6, 8], BAG); /* 背包 */
    g.mul([BK[0] + 1, BK[1] + 3, 6, 8], 0.96);
    g.noise(R.root.top, SHIRT, 0.05);
    g.noise(R.root.bottom, PANTS, 0.05); g.mul(R.root.bottom, 0.85);
    for (const side of [R.root.left, R.root.right]) g.noise(side, SHIRT, 0.05);
    /* 臂: 蓝袖五行 + 肤色手七行(顶=袖口, 底=手心) */
    for (const arm of [R.armR, R.armL]) {
      for (const f of ['front', 'back', 'left', 'right']) {
        const r = arm[f];
        g.noise(r, SHIRT, 0.05);
        g.fill([r[0], r[1] + 5, r[2], 7], SKIN);
        g.noise([r[0], r[1] + 5, r[2], 7], SKIN, 0.04);
      }
      g.noise(arm.top, SHIRT, 0.05);
      g.noise(arm.bottom, SKIN, 0.04); g.mul(arm.bottom, 0.85);
    }
    /* 腿: 藏蓝裤八行 + 深灰鞋三行 */
    for (const leg of [R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right']) {
        const r = leg[f];
        g.noise(r, PANTS, 0.05);
        g.fill([r[0], r[1] + 9, r[2], 3], SHOE);
      }
      g.noise(leg.top, PANTS, 0.05);
      g.fill(leg.bottom, SHOE);
    }
  }},
});
