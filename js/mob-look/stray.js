'use strict';
/* ============================================================
   造型档案 · 流浪者 (stray) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   细骨基座官方等比(与 skeleton 几何逐字相同, 换皮 — 研究笔记 §5
   骷髅一家)。雪原破袍: 骨白脸+青灰罩袍, 兜帽全包头顶/后/侧(帽檐
   压眉, 下巴露骨), 袍摆破烂锯齿(2026-10-31 对齐官方图观感); 弓 =
   armL 追加细木条(skeleton 同款, weaponArm 'armL' 口径一致)。
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
    /* 头: 骨白脸 · 深眼窝 · 兜帽全包(顶/后/侧青灰, 帽檐压眉, 帽顶缝加深) */
    const F = R.head.front;
    g.noise(F, BONE, 0.04);
    g.fill([F[0], F[1], 8, 2], ROBE); /* 兜帽檐压眉 */
    g.fill([F[0] + 1, F[1] + 4, 2, 2], DARK); g.fill([F[0] + 5, F[1] + 4, 2, 2], DARK);
    g.fill([F[0] + 3, F[1] + 5, 2, 1], BONE2); /* 鼻孔 */
    g.fill([F[0] + 2, F[1] + 6, 4, 2], BONE2); /* 牙床 */
    for (const f of ['back', 'left', 'right', 'top']) g.noise(R.head[f], ROBE, 0.06);
    g.fill([R.head.top[0], R.head.top[1], 8, 2], ROBE2); /* 帽顶缝 */
    g.noise(R.head.bottom, BONE, 0.04);
    g.mul(R.head.bottom, 0.8); /* 下巴露骨 */
    /* 躯干四肢: 青灰罩袍通体 · 破烂下摆(隔列锯齿缺口, 图中破袍观感) */
    const robe = (part) => {
      g.noiseAll(part, ROBE, 0.05);
      for (const f of ['front', 'back', 'left', 'right']) {
        const r = part[f];
        for (let x = 0; x < r[2]; x += 2) {
          g.fill([r[0] + x, r[1] + r[3] - 1, 1, 1], ROBE2);
          g.px(r[0] + x + 1, r[1] + r[3] - 2, ROBE2);
        }
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
