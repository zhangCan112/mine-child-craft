'use strict';
/* ============================================================
   造型档案 · 唤魔者 (evoker) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   灾厄村民基座官方等比(研究笔记 §5 灾厄帮 — 未逐字核对按基座复用
   推断)。旧 rig 的三叠尖帽按官方口径撤掉(尖帽是女巫的辨识件,
   唤魔者光头灰肤)。2026-10-31 对齐官方图: 黑袍+金滚边(领口/衣襟/
   腰带/下摆, 旧版白袍撤销)。
   interface: declare('evoker', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('evoker', {
  base: ['illager'],
  debris: 0x3a3a42,
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [176, 176, 154]; const SKIN2 = [150, 150, 128];
    const DARK = [30, 30, 24]; const EYE = [64, 92, 138];
    const ROBE = [46, 46, 52]; const ROBE2 = [34, 34, 40]; /* 黑袍 */
    const GOLD = [222, 180, 48]; /* 金滚边 */
    /* 头(8×10): 灰肤 · 高颧眉 · 蓝瞳 · 长者纹 */
    const F = R.head.front;
    g.noise(F, SKIN, 0.05);
    g.fill([F[0] + 1, F[1] + 3, 2, 1], DARK); g.fill([F[0] + 5, F[1] + 3, 2, 1], DARK); /* 眉 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], EYE); g.fill([F[0] + 5, F[1] + 4, 2, 2], EYE);
    g.fill([F[0] + 3, F[1] + 8, 2, 1], DARK); /* 抿嘴 */
    g.px(F[0] + 1, F[1] + 6, SKIN2); g.px(F[0] + 6, F[1] + 6, SKIN2); /* 法令纹 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], SKIN, 0.05);
    g.noise(R.head.bottom, SKIN, 0.05); g.mul(R.head.bottom, 0.8);
    /* 鼻: 灰肤 */
    g.noiseAll(R.head2, SKIN2, 0.05);
    g.mul(R.head2.bottom, 0.85);
    /* 身: 黑袍双件 · 金滚边(领口/衣襟竖线/腰带/下摆) */
    g.noiseAll(R.root, ROBE, 0.04);
    g.noiseAll(R.root2, ROBE, 0.04);
    const B = R.root2.front;
    g.fill([B[0] + 2, B[1], 4, 1], GOLD); /* 领口金边 */
    g.fill([B[0] + 3, B[1] + 1, 2, 7], GOLD); /* 衣襟竖线 */
    g.fill([B[0] + 1, B[1] + 8, 6, 1], GOLD); /* 金腰带 */
    g.fill([B[0] + 1, B[1] + 11, 6, 1], GOLD); /* 下摆金边 */
    /* 臂(共区): 黑袍宽袖+灰手(袖口金环) · 腿(共区): 黑袍长靴 */
    for (const arm of [R.armR, R.armL]) {
      g.noiseAll(arm, ROBE, 0.04);
      for (const f of ['front', 'back', 'left', 'right']) {
        g.fill([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN); /* 前臂露手(施法手势) */
        g.noise([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN, 0.05);
        g.fill([arm[f][0], arm[f][1] + 4, arm[f][2], 1], GOLD); /* 袖口金环 */
      }
      g.noise(arm.bottom, SKIN, 0.05); g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      g.noiseAll(leg, ROBE2, 0.04);
      g.mul(leg.bottom, 0.8);
    }
  }},
});
