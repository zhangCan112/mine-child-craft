'use strict';
/* ============================================================
   造型档案 · 流浪者 (stray) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   细骨基座官方等比(与 skeleton 几何逐字相同, 换皮 — 研究笔记 §5
   骷髅一家)。雪原破袍: 骨白脸+青灰罩袍, 袍摆磨损横纹; 弓 = armL
   追加细木条(skeleton 同款, weaponArm 'armL' 口径一致)。
   armStyle 'archer'(旧 rig 漏配, 骷髅族弓手统一补上)。
   interface: declare('stray', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('stray', {
  base: ['skeleton'],
  armStyle: 'archer',
  weaponArm: 'armL',
  debris: 0xd8dee4,
  bones: {armL: {add: [{origin: [4.5, 2, -0.5], size: [1, 11, 1], uv: [56, 0]}]}}, /* 弓 */
  tex: {size: 64, paint: (g, R) => {
    const BONE = [216, 222, 228]; const BONE2 = [176, 186, 196];
    const DARK = [26, 42, 56]; const WOOD = [107, 74, 42];
    const ROBE = [122, 154, 176]; const ROBE2 = [92, 122, 146];
    /* 头: 骨白脸 · 深眼窝 · 兜帽檐(顶两行青灰) */
    const F = R.head.front;
    g.noise(F, BONE, 0.04);
    g.fill([F[0], F[1], 8, 2], ROBE); /* 兜帽檐压眉 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], BONE2); /* 鼻孔 */
    g.fill([F[0] + 2, F[1] + 6, 4, 2], BONE2); /* 牙床 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.head[f], BONE, 0.04);
    }
    g.noise(R.head.top, ROBE, 0.05); /* 兜帽顶 */
    g.mul(R.head.bottom, 0.8);
    /* 躯干四肢: 青灰罩袍通体 · 磨损横纹(袍摆压暗两道) */
    const robe = (part) => {
      g.noiseAll(part, ROBE, 0.05);
      for (const f of ['front', 'back', 'left', 'right']) {
        g.fill([part[f][0], part[f][1] + part[f][3] - 2, part[f][2], 1], ROBE2);
      }
    };
    robe(R.root); robe(R.armR); robe(R.armL); robe(R.legR); robe(R.legL);
    /* 肋骨阴影透袍(身正面两道浅骨纹) */
    const B = R.root.front;
    g.fill([B[0] + 1, B[1] + 2, 6, 1], ROBE2);
    g.fill([B[0] + 1, B[1] + 4, 6, 1], ROBE2);
    /* 弓(追加骨 armL2): 木色通体 */
    g.fillAll(R.armL2, WOOD);
  }},
});
