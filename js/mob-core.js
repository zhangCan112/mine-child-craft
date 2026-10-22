"use strict";
/* ============================================================
   怪物核心 (MobCore) — 引擎层纯逻辑, 零全局依赖(术语见 GLOSSARY.md)
   ------------------------------------------------------------
   怪物"身体本能"里可纯计算的部分: 受击状态机 / 台阶移动 / 闪白着色。
   壳层 js/mobs.js 负责渲染与编排, groundTop 等世界查询由调用方注入。
   ============================================================ */
const MobCore = (() => {

  /* 受击: 扣血 + 闪白/踉跄置位; 首次血量归零进入死亡态。
     返回 { hp, dead, freshDead } — freshDead 供调用方只结算一次死亡。 */
  function hitState(m, dmg){
    const wasDead = m.dead;
    m.hp -= dmg;
    m.flashT = 0.25;
    m.staggerT = 0.22;
    let freshDead = false;
    if(m.hp <= 0 && !wasDead){
      m.hp = 0; m.dead = true; m.deadT = 0;
      freshDead = true;
    }
    if(m.dead) m.hp = 0;                             /* 尸体血量不再下降 */
    return { hp: m.hp, dead: m.dead, freshDead };
  }

  /* 台阶移动: 前后地面高差 ≤ 1.05 格放行(脚/履带能爬一级),
     更高拦截(世界查询 groundTop 由调用方注入, 边界约束归调用方) */
  function stepMove(m, mx, mz, groundTop){
    const nx = m.pos.x + mx, nz = m.pos.z + mz;
    const curTop = groundTop(Math.floor(m.pos.x), Math.floor(m.pos.z));
    const newTop = groundTop(Math.floor(nx), Math.floor(nz));
    if(newTop - curTop <= 1.05){ m.pos.x = nx; m.pos.z = nz; }
  }

  /* 着色: 受击闪白(随剩余时间插值) > 持久色(狂暴红晕等, 模式写入 m.tintBase) */
  function tintFlash(m){
    if(m.flashT > 0){
      const f = m.flashT / 0.25;                        /* 外层已保证 > 0 */
      return [1 + f*0.9, 1 - f*0.9, 1 - f*0.9];
    }
    return m.tintBase;
  }

  return { hitState, stepMove, tintFlash };
})();
if(typeof module !== 'undefined' && module.exports) module.exports = MobCore;
