'use strict';
/* ============================================================
   造型档案 · 女巫 (witch) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   灾厄村民基座(villager 血统: 头 8×10×8+鼻+长袍, 研究笔记 §5 灾厄帮)
   + 四级歪帽追加骨(10×2×10 檐 → 7×4×7 → 4×4×4 → 1×2×1, 逐级 rx
   前倾 — 官方逐级弯折的 rx 近似)。毒药瓶 = armL 追加(weaponArm
   同侧); 紫袍+尖鼻痣画进贴图。
   interface: declare('witch', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('witch', {
  base: ['illager'],
  weaponArm: 'armL',
  debris: 0x5a3a6a,
  bones: {
    head: {add: [
      {origin: [-5, 34, -5], size: [10, 2, 10], uv: [16, 40]}, /* 帽檐 */
      {origin: [-3.5, 36, -3.5], size: [7, 4, 7], uv: [16, 52], rx: 0.15}, /* 帽身一级 */
      {origin: [-2, 40, -2], size: [4, 4, 4], uv: [44, 52], rx: 0.32}, /* 帽身二级 */
      {origin: [-0.5, 44, -0.5], size: [1, 2, 1], uv: [60, 52], rx: 0.5}, /* 帽尖 */
    ]},
    armL: {add: [{origin: [3.5, 5, -1.5], size: [3, 4, 3], uv: [4, 56]}]}, /* 毒药瓶 */
  },
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [154, 138, 154]; const SKIN2 = [128, 112, 128];
    const DARK = [30, 24, 32]; const EYE = [64, 92, 138];
    const ROBE = [90, 58, 106]; const ROBE2 = [66, 42, 78];
    const HAT = [42, 28, 48]; const HAT2 = [28, 18, 32];
    const POTION = [138, 216, 74];
    /* 头(8×10): 灰紫肤 · 鹰钩鼻区 · 蓝瞳 · 鼻痣 */
    const F = R.head.front;
    g.noise(F, SKIN, 0.05);
    g.fill([F[0] + 1, F[1] + 4, 2, 2], EYE); g.fill([F[0] + 5, F[1] + 4, 2, 2], EYE);
    g.fill([F[0] + 3, F[1] + 8, 2, 1], DARK); /* 抿嘴 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], SKIN, 0.05);
    g.noise(R.head.bottom, SKIN, 0.05); g.mul(R.head.bottom, 0.8);
    /* 鼻(head2): 深肤+鼻头痣 */
    g.noiseAll(R.head2, SKIN2, 0.05);
    g.px(R.head2.front[0] + 1, R.head2.front[1] + 3, DARK); /* 鼻痣(女巫辨识件) */
    g.mul(R.head2.bottom, 0.85);
    /* 四级歪帽(head3~6): 深紫呢+帽褶阴影 */
    for (const part of [R.head3, R.head4, R.head5, R.head6]) {
      g.noiseAll(part, HAT, 0.06);
    }
    g.fill([R.head3.front[0], R.head3.front[1], R.head3.front[2], 1], HAT2); /* 檐口阴影 */
    g.fill([R.head4.front[0] + 2, R.head4.front[1] + 2, 3, 1], HAT2); /* 帽褶 */
    g.fill([R.head5.front[0] + 1, R.head5.front[1] + 1, 2, 1], HAT2); /* 帽褶 */
    /* 身: 紫袍双件 · 领口+下摆压暗 */
    g.noiseAll(R.root, ROBE, 0.05);
    g.noiseAll(R.root2, ROBE, 0.05);
    const B = R.root2.front;
    g.fill([B[0] + 2, B[1], 4, 1], ROBE2); /* 领口 */
    g.fill([B[0] + 1, B[1] + 11, 6, 1], ROBE2); /* 下摆纹 */
    /* 臂(共区): 紫袍宽袖+灰手 · 腿(共区): 深紫裙靴 */
    for (const arm of [R.armR, R.armL]) {
      g.noiseAll(arm, ROBE, 0.05);
      for (const f of ['front', 'back', 'left', 'right']) {
        g.fill([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN);
        g.noise([arm[f][0], arm[f][1] + 5, arm[f][2], 7], SKIN, 0.05);
      }
      g.noise(arm.bottom, SKIN, 0.05); g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      g.noiseAll(leg, ROBE2, 0.05);
      g.mul(leg.bottom, 0.8);
    }
    /* 毒药瓶(追加骨 armL2): 荧绿药水+深木塞 */
    g.fillAll(R.armL2, POTION);
    g.fill([R.armL2.top[0], R.armL2.top[1], R.armL2.top[2], R.armL2.top[3]], [74, 58, 40]); /* 木塞 */
  }},
});
