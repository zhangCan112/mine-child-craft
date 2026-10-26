'use strict';
/* ============================================================
   造型档案 · 掠夺者 (pillager) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   灾厄村民基座官方等比(研究笔记 §5 灾厄帮 — 逐字核对同卫道士)。
   弩 = armL 追加横臂条(官方挂 rightItem 的简化, weaponArm 同侧);
   兜帽画进贴图(旧 rig 的三叠尖帽按官方口径改为头顶/后脑布兜)。
   interface: declare('pillager', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('pillager', {
  base: ['illager'],
  weaponArm: 'armL',
  debris: 0x5a5a4a,
  bones: {armL: {add: [{origin: [1, 7, -2], size: [7, 2, 2], uv: [26, 40]}]}}, /* 弩(横臂) */
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [176, 176, 154]; const SKIN2 = [150, 150, 128];
    const DARK = [30, 30, 24]; const EYE = [64, 92, 138];
    const HOOD = [58, 58, 48]; const HOOD2 = [42, 42, 34];
    const ROBE = [90, 90, 74]; const ROBE2 = [70, 70, 56];
    const WOOD = [74, 58, 40];
    /* 头(8×10): 灰肤 · 兜帽罩顶+后脑+两鬓(只露脸) · 蓝瞳 */
    const F = R.head.front;
    g.noise(F, SKIN, 0.05);
    g.fill([F[0], F[1], 8, 2], HOOD); /* 帽檐压眉 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], EYE); g.fill([F[0] + 5, F[1] + 4, 2, 2], EYE);
    g.fill([F[0] + 3, F[1] + 8, 2, 1], DARK); /* 抿嘴 */
    for (const f of ['back', 'left', 'right', 'top']) {
      g.noise(R.head[f], HOOD, 0.06); /* 兜帽罩面 */
      g.fill([R.head[f][0], R.head[f][1] + R.head[f][3] - 3, R.head[f][2], 3], SKIN); /* 下缘露肤 */
    }
    g.noise(R.head.bottom, SKIN, 0.05); g.mul(R.head.bottom, 0.8);
    /* 鼻: 灰肤 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head2[f], SKIN2, 0.05);
    }
    g.mul(R.head2.bottom, 0.85);
    /* 身: 土褐袍双件 · 肩带(弩药袋) */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], ROBE, 0.05);
    }
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root2[f], ROBE, 0.05);
    }
    const B = R.root2.front;
    g.fill([B[0] + 2, B[1] + 2, 1, 8], HOOD2); /* 肩带 */
    g.fill([B[0] + 5, B[1] + 2, 2, 3], HOOD2); /* 药袋 */
    /* 臂(共区): 袍袖+灰手 · 腿(共区): 深靴 */
    for (const arm of [R.armR, R.armL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(arm[f], ROBE, 0.05);
      }
      for (const f of ['front', 'back', 'left', 'right']) {
        g.fill([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN);
        g.noise([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN, 0.05);
      }
      g.noise(arm.bottom, SKIN, 0.05); g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], HOOD2, 0.05);
      }
      g.mul(leg.bottom, 0.8);
    }
    /* 弩(追加骨 armL2): 木色横臂 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.armL2[f], WOOD, 0.06);
    }
  }},
});
