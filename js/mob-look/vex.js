'use strict';
/* ============================================================
   造型档案 · 恼鬼 (vex) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   官方迷你人形直填(研究笔记 §5 鬼一族, 官方贴图 32×32 本项目
   最低档): 体 3×4×2 · 头 5×5×5 · 臂 2×4×2 · 双翼 8×5×0 平面
   (wingL/wingR 槽 axis 'z' — 引擎扇翅)。铁剑 = armL 追加
   (weaponArm 同侧, 旧 rig 金剑按官方铁剑口径改色)。
   interface: declare('vex', {...}) — 单一声明
   依赖: js/mob-look-kit.js(先载); 键 ∈ mob-registry.js MOB_TYPES
   可测性声明: 纯声明数据, 由 test/mob-look.test.js 键集/覆盖断言
   ============================================================ */
MobLookKit.declare('vex', {
  weaponArm: 'armL',
  debris: 0x9ab8d8,
  bones: {
    head: {pivot: [0, 6, 0], add: [{origin: [-2.5, 6, -2.5], size: [5, 5, 5], uv: [12, 0]}]},
    root: {pivot: [0, 2, 0], add: [{origin: [-1.5, 2, -1], size: [3, 4, 2], uv: [0, 0]}]},
    armL: {pivot: [2, 5, 0], add: [
      {origin: [1, 1, -1], size: [2, 4, 2], uv: [0, 12]},
      {origin: [1.5, -3, -0.5], size: [1, 8, 1], uv: [10, 12]}, /* 铁剑 */
    ]},
    armR: {pivot: [-2, 5, 0], add: [{origin: [-3, 1, -1], size: [2, 4, 2], uv: [0, 12]}]},
    wingL: {pivot: [1.5, 5, 0], axis: 'z', add: [{origin: [1.5, 0, 0], size: [8, 5, 0], uv: [0, 22]}]},
    wingR: {pivot: [-1.5, 5, 0], axis: 'z', add: [{origin: [-9.5, 0, 0], size: [8, 5, 0], uv: [0, 22]}]},
  },
  tex: {size: 32, paint: (g, R) => {
    const BODY = [154, 184, 216]; const HEAD = [184, 207, 232];
    const DARK = [26, 34, 46]; const RED = [216, 58, 42];
    const IRON = [168, 174, 184]; const WING = [232, 242, 255];
    /* 头: 淡蓝底 · 红眼(两颗) · 咧嘴 */
    const F = R.head.front;
    g.noise(F, HEAD, 0.04);
    g.fill([F[0] + 1, F[1] + 2, 1, 1], RED); g.fill([F[0] + 3, F[1] + 2, 1, 1], RED);
    g.fill([F[0] + 1, F[1] + 4, 3, 1], DARK); /* 咧嘴 */
    for (const f of ['back', 'left', 'right', 'top', 'bottom']) g.noise(R.head[f], HEAD, 0.04);
    g.mul(R.head.bottom, 0.85);
    /* 体: 淡蓝 */
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.noise(R.root[f], BODY, 0.04);
    }
    /* 双臂(共区): 淡蓝 · 铁剑(armL2) */
    for (const arm of [R.armR, R.armL]) {
      for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
        g.noise(arm[f], BODY, 0.04);
      }
    }
    for (const f of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      g.fill(R.armL2[f], IRON);
    }
    /* 双翼(共区, 平面盒): 半透白观感(实色浅白) */
    for (const wing of [R.wingL, R.wingR]) {
      for (const f of ['front', 'back']) g.fill(wing[f], WING);
    }
  }},
});
