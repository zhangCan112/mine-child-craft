'use strict';
/* ============================================================
   造型档案 · 沼骸 (bogged) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   细骨基座官方等比(骷髅族换皮, 研究笔记 §5 — 未逐字核对按同族
   复用推断)。沼泽苔藓骷髅: 骨面苔斑(种子化绿斑); 弓 = armL 追加
   细木条(skeleton 同款, weaponArm 'armL' 口径一致)。
   armStyle 'archer'(骷髅族弓手统一口径)。
   interface: declare('bogged', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('bogged', {
  base: ['skeleton'],
  armStyle: 'archer',
  weaponArm: 'armL',
  debris: 0xb8c0a0,
  bones: {armL: {add: [{origin: [4.5, 2, -0.5], size: [1, 11, 1], uv: [56, 0]}]}}, /* 弓 */
  tex: {size: 64, paint: (g, R) => {
    const BONE = [184, 192, 160]; const BONE2 = [148, 158, 126];
    const MOSS = [96, 138, 74]; const MOSS2 = [70, 108, 52];
    const DARK = [34, 42, 26]; const WOOD = [107, 74, 42];
    /* 苔藓笔触: 骨色噪底 + 绿苔斑(种子化, 同 type 同图) */
    const mossy = (r) => {
      g.noise(r, BONE, 0.05);
      for (let i = 0; i < Math.max(2, r[2] * r[3] / 7); i++) {
        g.px(r[0] + Math.floor(g.rng() * r[2]), r[1] + Math.floor(g.rng() * r[3]),
            g.rng() < 0.6 ? MOSS : MOSS2);
      }
    };
    /* 头: 苔骨底 · 深眼窝 · 鼻孔 · 牙缝 */
    const F = R.head.front;
    mossy(F);
    g.fill([F[0] + 1, F[1] + 3, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 3, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], BONE2); /* 鼻孔 */
    g.fill([F[0] + 2, F[1] + 6, 4, 2], BONE2); /* 牙床 */
    g.px(F[0] + 3, F[1] + 6, DARK); g.px(F[0] + 5, F[1] + 6, DARK); /* 牙缝 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) mossy(R.head[f]);
    g.mul(R.head.bottom, 0.8);
    /* 躯干四肢: 苔骨通体 · 肋纹(身正面两道) */
    for (const part of [R.root, R.armR, R.armL, R.legR, R.legL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        mossy(part[f]);
      }
      g.mul(part.bottom, 0.8);
    }
    const B = R.root.front;
    g.fill([B[0] + 1, B[1] + 2, 6, 1], BONE2);
    g.fill([B[0] + 1, B[1] + 4, 6, 1], BONE2);
    /* 弓(追加骨 armL2): 木色通体 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.armL2[f], WOOD);
    }
  }},
});
