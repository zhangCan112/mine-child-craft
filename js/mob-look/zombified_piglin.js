'use strict';
/* ============================================================
   造型档案 · 僵尸猪灵 (zombified_piglin) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   人形基座官方等比(zombie_pigman.geo 与 zombie 逐字相同 — 研究笔记
   §5: 僵尸猪灵无耳骨/吻骨, 官方就是普通人形头, 耳朵画在贴图;
   旧 rig 的耳朵盒本票按官方口径撤掉)。腐肉粉+绿斑(种子化);
   金剑 = armL 追加(weaponArm 同侧)。
   interface: declare('zombified_piglin', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('zombified_piglin', {
  base: ['humanoid'],
  armStyle: 'zombie',
  weaponArm: 'armL',
  debris: 0xd88a8a,
  bones: {armL: {add: [{origin: [4.5, 2, -1], size: [1, 14, 2], uv: [56, 16]}]}}, /* 金剑 */
  tex: {size: 64, paint: (g, R) => {
    const SKIN = [216, 138, 138]; const SKIN2 = [190, 112, 112];
    const ROT = [106, 148, 74]; const ROT2 = [78, 116, 52];
    const DARK = [42, 26, 26]; const GOLD = [216, 176, 40]; const GOLD2 = [168, 132, 26];
    /* 腐肉笔触: 粉肤噪底 + 绿腐斑(种子化, 同 type 同图) */
    const rotten = (r) => {
      g.noise(r, SKIN, 0.06);
      for (let i = 0; i < Math.max(2, r[2] * r[3] / 8); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]),
            g.rng() < 0.6 ? ROT : ROT2);
      }
    };
    /* 头: 腐肉底 · 黑眼 · 歪嘴 · 贴图耳朵(头顶两角小耳廓) */
    const F = R.head.front;
    rotten(F);
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.fill([F[0] + 2, F[1] + 7, 3, 1], DARK); /* 歪嘴 */
    for (const f of ['back', 'left', 'right', 'top']) rotten(R.head[f]);
    rotten(R.head.bottom); g.mul(R.head.bottom, 0.8);
    for (const side of [R.head.left, R.head.right]) {/* 侧脸小耳(贴图耳, 官方口径) */
      g.fill([side[0] + 1, side[1] + 3, 2, 3], SKIN2);
      g.px(side[0] + 1, side[1] + 4, ROT2);
    }
    /* 身: 腐肉裸上身穿破布 · 臂: 腐肉 · 腿: 土金破裤 */
    rotten(R.root.front); rotten(R.root.back);
    rotten(R.root.left); rotten(R.root.right);
    rotten(R.root.top); rotten(R.root.bottom); g.mul(R.root.bottom, 0.85);
    const B = R.root.front;
    g.fill([B[0] + 2, B[1] + 9, 4, 3], ROT2); /* 破布补丁 */
    for (const arm of [R.armR, R.armL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        rotten(arm[f]);
      }
      g.mul(arm.bottom, 0.85);
    }
    for (const leg of [R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(leg[f], [138, 106, 58], 0.06);
      }
      g.fill([leg.front[0] + 1, leg.front[1] + 5, 2, 2], ROT2); /* 裤洞露绿 */
      g.mul(leg.bottom, 0.8);
    }
    /* 金剑(追加骨 armL2): 金刃 + 深柄 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.armL2[f], GOLD);
    }
    for (const f of ['front', 'left', 'right']) {
      g.fill([R.armL2[f][0], R.armL2[f][1] + 11, R.armL2[f][2], 3], GOLD2); /* 柄段 */
    }
  }},
});
