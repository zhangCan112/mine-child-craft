'use strict';
/* ============================================================
   战斗核心 (CombatCore) — 引擎层纯逻辑, 零全局依赖(术语见 GLOSSARY.md)
   ------------------------------------------------------------
   两个怪物战斗模式(竞技场/下界冒险)曾各自再推导的通用战斗数学:
   · leadAim      预测弹道方向(目标移动提前量 + 重力补偿抬枪)
   · tickCadence  攻击节拍递减(attackCd/attackT — 节拍字段由 Mobs.spawn 置零)
   · hitBody      投射物对实体身体的盒判定(水平半径 + 垂直身高段)
   · stepShot     弹道步进(重力/寿命/欧拉积分/撞块, 非变更式 — C6-T1
                  把竞技场/下界/探险三份手写步进并一于此)
   弹道观感(网格/特效)与伤害政策(阵营/衰减/话术)留在模式层。
   Node 可直接加载; 有单测(test/combat-core.test.js)。
   ============================================================ */
const CombatCore = (() => {
  /* 预测弹道方向: 飞行时间预估 → 目标移动提前量 → 重力补偿抬枪。
     from {x,y,z}; tgt {x,y,z, vx,vz, h} — hFrac 为瞄点高度系数(身高×比例)。
     返回归一化方向 {x,y,z}(纯数据, 调用方自行乘初速/建 mesh)。 */
  function leadAim(from, tgt, v0, g, hFrac) {
    const dist3 = Math.hypot(tgt.x-from.x, tgt.y-from.y, tgt.z-from.z);
    let t = dist3/v0; // 飞行时间预估(3D, 兼容空中目标)
    const tx = tgt.x + (tgt.vx||0)*t; const tz = tgt.z + (tgt.vz||0)*t; // 目标移动提前量
    t = Math.hypot(tx-from.x, tz-from.z)/v0;
    const lift = 0.5*g*t*t; // 重力下坠补偿(抬高瞄准点)
    const dx = tx-from.x; const dy = (tgt.y + (tgt.h||1.8)*hFrac + lift) - from.y; const dz = tz-from.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    return {x: dx/l, y: dy/l, z: dz/l};
  }

  /* 攻击节拍递减(冷却/挥击动画计时 — 与 Mobs.spawn 的置零配套,
     下界曾自抄两行, 竞技场 tickTimers 也有一份) */
  function tickCadence(m, dt) {
    if (m.attackCd > 0) m.attackCd -= dt;
    if (m.attackT > 0) m.attackT -= dt;
  }

  /* 投射物命中身体判定: 水平按碰撞半径(hitR, 缺省 0.55), 垂直按
     身高段(脚下 0.3 容忍 ~ 头顶 0.5 余量); p {x,y,z} 为弹着点。
     inflate 追加判定余量(如爆炸直击要求更贴身)。 */
  function hitBody(p, t, inflate) {
    const hr = ((t.cfg && t.cfg.hitR) || 0.55) + (inflate || 0);
    const h = (t.cfg && t.cfg.h) || 1.8;
    return Math.abs(p.x - t.pos.x) < hr && Math.abs(p.z - t.pos.z) < hr &&
      p.y > t.pos.y - 0.3 && p.y < t.pos.y + h + 0.5;
  }

  /* 弹道步进(非变更式): 重力 → 寿命 → 欧拉积分一步, 顺带撞块判定。
     s = {from {x,y,z} · vel {x,y,z} · life · g?}(g 缺省 6); getBlock 为
     注入的整数坐标方块查询(纯核心零全局依赖), 缺省不做撞块判定。
     返回 {vel, life, x, y, z, hitBlock, dead} — dead = 寿命尽或撞块
     (竞技场巨石要区分: 撞块触发 AoE, 寿命尽只移除); 调用方自决存储
     载体(CombatKit 箭矢管线存 from, 竞技场 mesh.position 即源)。
     竞技场/下界/探险三份手写步进并一于此(C6-T1)。 */
  function stepShot(s, dt, getBlock) {
    const g = s.g !== undefined ? s.g : 6;
    const vel = {x: s.vel.x, y: s.vel.y - g * dt, z: s.vel.z};
    const life = s.life - dt;
    const x = s.from.x + vel.x * dt;
    const y = s.from.y + vel.y * dt;
    const z = s.from.z + vel.z * dt;
    const hitBlock = getBlock ?
      getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0 : false;
    return {vel, life, x, y, z, hitBlock, dead: life <= 0 || hitBlock};
  }

  return {leadAim, tickCadence, hitBody, stepShot};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CombatCore;
