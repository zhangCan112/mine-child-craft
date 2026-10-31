'use strict';
/* ============================================================
   造型档案 · 幻术师 (illusioner) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   灾厄村民基座官方等比(研究笔记 §5 灾厄帮; Java 版未实装怪,
   2026-10-31 用户票按官方图新增)。宝蓝兜帽袍: 帽罩头顶/后脑/两鬓
   (pillager 同手法, 只露脸), 袍缘浅蓝饰带+饰点; 弓 = armL 追加细木条
   (skeleton 同款, 官方幻术师以弓射击 — armStyle 'archer' 举弓瞄准)。
   interface: declare('illusioner', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('illusioner', {
  base: ['illager'],
  armStyle: 'archer',
  weaponArm: 'armL',
  debris: 0x2e5cbe,
  bones: {armL: {add: [{origin: [4.5, 2, -0.5], size: [1, 11, 1], uv: [60, 20]}]}}, /* 弓 */
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [176, 176, 154]; const SKIN2 = [150, 150, 128];
    const DARK = [30, 30, 24]; const EYE = [64, 92, 138];
    const ROBE = [46, 88, 190]; const ROBE2 = [34, 64, 150]; /* 宝蓝袍 */
    const TRIM = [148, 186, 240]; /* 浅蓝饰 */
    const WOOD = [107, 74, 42];
    /* 头(8×10): 灰肤脸 · 兜帽罩顶+后脑+两鬓(帽檐压眉, 帽缘浅蓝饰点) */
    const F = R.head.front;
    g.noise(F, SKIN, 0.05);
    g.fill([F[0], F[1], 8, 2], ROBE); /* 帽檐压眉 */
    g.px(F[0] + 1, F[1], TRIM); g.px(F[0] + 4, F[1], TRIM);
    g.px(F[0] + 6, F[1] + 1, TRIM); /* 帽缘饰点 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], EYE); g.fill([F[0] + 5, F[1] + 4, 2, 2], EYE);
    g.fill([F[0] + 3, F[1] + 8, 2, 1], DARK); /* 抿嘴 */
    for (const f of ['back', 'left', 'right', 'top']) {
      g.noise(R.head[f], ROBE, 0.06); /* 兜帽罩面 */
      g.fill([R.head[f][0], R.head[f][1] + R.head[f][3] - 3, R.head[f][2], 3], SKIN); /* 下缘露肤 */
    }
    g.px(R.head.back[0] + 2, R.head.back[1] + 1, TRIM);
    g.px(R.head.back[0] + 5, R.head.back[1] + 2, TRIM); /* 后脑饰点 */
    g.noise(R.head.bottom, SKIN, 0.05); g.mul(R.head.bottom, 0.8);
    /* 鼻: 灰肤 */
    g.noiseAll(R.head2, SKIN2, 0.05);
    g.mul(R.head2.bottom, 0.85);
    /* 身: 宝蓝袍双件 · 浅蓝下摆饰带 */
    g.noiseAll(R.root, ROBE, 0.05);
    g.noiseAll(R.root2, ROBE, 0.05);
    const B = R.root2.front;
    g.fill([B[0] + 1, B[1] + 10, 6, 2], TRIM); /* 下摆饰带 */
    g.px(B[0] + 2, B[1] + 2, TRIM); g.px(B[0] + 5, B[1] + 4, TRIM); /* 袍面饰点 */
    /* 臂(共区): 宝蓝袍袖+灰手(袖口浅蓝环) · 腿(共区): 深蓝靴 */
    for (const arm of [R.armR, R.armL]) {
      g.noiseAll(arm, ROBE, 0.05);
      for (const f of ['front', 'back', 'left', 'right']) {
        g.fill([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN); /* 前臂露手 */
        g.noise([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN, 0.05);
        g.fill([arm[f][0], arm[f][1] + 4, arm[f][2], 1], TRIM); /* 袖口饰环 */
      }
      g.noise(arm.bottom, SKIN, 0.05); g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      g.noiseAll(leg, ROBE2, 0.05);
      g.mul(leg.bottom, 0.8);
    }
    /* 弓(追加骨 armL2): 木色通体 */
    g.fillAll(R.armL2, WOOD);
  }},
});
