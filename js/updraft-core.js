'use strict';
/* ============================================================
   热气流核心 (UpdraftCore, 术语见 GLOSSARY.md「热气流」) — 引擎层纯核心
   ------------------------------------------------------------
   篝火特性 T-C2(campfire-spec §3.5, ADR 0017)的气流源注册表+柱查询:
   引擎只知「气流源」不知源是什么(篝火是第一个注册源, 将来风柱/喷泉
   复用同一注册面, 不写死篝火)。纯注册+查询零状态步进——比 fluid-core
   更纯: 零时钟推进零随机零渲染(确定性重放红线, spec §6-1/6-8)。
   判定语义(spec §3.5 技术裁定):
   · 水平截面=玩家格与源格 Chebyshev 距离 ≤r(3×3=半径 1, 整数格列离散);
   · 垂直界=py ≥ 源 y 且 py ≤ top=源 y+柱高 h(两端含, 站火旁同地面可乘);
   · 遮挡截断=query 时对玩家所在 (x,z) 列自源 y+1 上扫至 floor(py),
     遇首个实体方块即截断(该列此高程无升力; ≤柱高格列扫零预计算);
   · 多柱重叠=max 语义(取 lift 最强一柱非求和; 遮挡过滤先于 max)。
   interface: mkSim(env) → sim, env = {read(x,y,z)→id, solidOf(id)→bool}
    (导出面=函数工厂: UpdraftCore(env)≡UpdraftCore.mkSim(env) 同形便捷入口;
     依赖全参数注入, world.js 与单测共用同一装配防两份漂移)
     · sim.add({x,y,z,r,h,lift})  注册气流源: 源格心+水平半径/柱高/升速;
       键=源格心 x,y,z(同位重注册=整组覆盖, 放置覆盖/重燃形态)
     · sim.remove(x,y,z)          注销(燃尽/浇熄/挖走时由装配层调);
       未知格零炸零副作用
     · sim.query(px,py,pz)        → {lift, top} | null 最强命中柱
     · sim.count() / sim.clear()  观察口 / 清场(切模式/换图/读档无幽灵气柱)
   依赖(零全局, 全部经 env 注入): read(x,y,z)→方块 id · solidOf(id)→是否实体
   可测性: 零渲染·零装具·有同名单测(test/updraft-core.test.js)
   ============================================================ */
const UpdraftCore = (() => {
  function mkSim(env) {
    const read = env.read;
    const solidOf = env.solidOf;
    const srcs = new Map(); /* "x,y,z" → 源条目 {x,y,z,r,h,lift}; 键=源格心 */

    /* 注册/覆盖: 同位重注册整组生效(放置覆盖/重燃形态) */
    function add(src) {
      srcs.set(src.x + ',' + src.y + ',' + src.z,
          {x: src.x, y: src.y, z: src.z, r: src.r, h: src.h, lift: src.lift});
    }

    /* 注销: 未知格零炸零副作用(presence 口径, 与 campfire-kit drop 同纪律) */
    function remove(x, y, z) {
      srcs.delete(x + ',' + y + ',' + z);
    }

    /* 最强命中柱: 水平 Chebyshev ≤r · 垂直 [源y, 源y+h] 两端含 ·
       遮挡列扫(玩家所在列, 自源y+1 上扫至脚部)过滤先于 max(spec §3.5) */
    function query(px, py, pz) {
      const cx = Math.floor(px);
      const cz = Math.floor(pz);
      const foot = Math.floor(py);
      let best = null;
      for (const s of srcs.values()) {
        const cheb = Math.max(Math.abs(cx - s.x), Math.abs(cz - s.z));
        if (cheb > s.r) continue;
        if (py < s.y || py > s.y + s.h) continue;
        let blocked = false;
        for (let y = s.y + 1; y <= foot; y++) {
          if (solidOf(read(cx, y, cz))) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        if (!best || s.lift > best.lift) best = s;
      }
      return best ? {lift: best.lift, top: best.y + best.h} : null;
    }

    function count() {
      return srcs.size;
    }

    /* 清场: 切模式/换图/读档(世界数据已清, 残留气柱作废, 重建归模式层 init) */
    function clear() {
      srcs.clear();
    }

    return {add, remove, query, count, clear};
  }

  /* 导出面=函数工厂(同名单测「孤立装载」合同 typeof UpdraftCore==='function'):
     函数本体即 mkSim 同形便捷入口(UpdraftCore(env)≡UpdraftCore.mkSim(env)),
     mkSim 挂静态主入口——两形态同一实现零分叉 */
  function updraftCore(env) {
    return mkSim(env);
  }
  updraftCore.mkSim = mkSim;
  return updraftCore;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = UpdraftCore;
