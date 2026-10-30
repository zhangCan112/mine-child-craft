'use strict';
/* ============================================================
   刷怪核心 (AdventureSpawnCore) — 应用层·纯核心
   ------------------------------------------------------------
   探险模式刷怪节律的机制三件套: 节拍/取种/掷点(2026-10-30 架构评审
   候选 2「刷怪导演归一」——四个同构节拍器与三份加权取种、两份环带
   掷点的参数化收敛, 第五个刷怪副本起组装不再誊写)。机制不携政策:
   池/环带/节拍常量留在各政策核心(ADV_NIGHT/ADV_ERUPT/ADV_DEN),
   计时状态留在壳层逐通道各存一份(计时独立是结构保证); 三件零状态
   ·零全局读, rnd 全注入, 行为口径逐字节承自归一前源(行为等价红线:
   既有测试的注入 rnd 序列断言原样通过)。
   interface: advSpawnPulse(open, t, dt, interval)→{fire, t}(门关→
     计时归零 · 未满→只累计 · 到拍→发令并归零——「逐拍独立」「配额
     满归零」的语义单点) · advWeightedPick(pool, rnd)→type([[种,权重]]
     加权掷种, 浮点尽头兜底末段) · advRingSpot(cx, cz, lo, hi, rnd)→
     {x, z}(环带掷点, 角度/半径均匀, rnd 消费序先角度后半径)
   依赖(均经全局名, 调用期解析): 零依赖(纯三件不消费引擎件;
     index.html 加载序: 本文件 → adventure-core → adventure-maps-core
     → adventure-dims-core → 壳)
   可测性: 零 THREE·零 DOM·有单测(test/adventure-spawn-core.test.js)
   ============================================================ */

/* 通用节拍器: open=false(时间门/存活门/配额门, 政策门经布尔注入) → 不出令
   且计时归零; open 且未累计满 interval → 只累计; 满 → 发令并归零。
   「逐拍独立」「配额满归零」的语义单点——发令后掷点/光照/概率不过即
   整拍作废, 概率不结转下一拍; 返回 {fire, t}, 计时状态由调用方
   逐通道各存一份 */
function advSpawnPulse(open, t, dt, interval) {
  if (!open) return {fire: false, t: 0};
  const nt = t + dt;
  if (nt >= interval) return {fire: true, t: 0};
  return {fire: false, t: nt};
}

/* 加权取种: pool=[[种,权重],...] 按权重掷一种(夜怪/涌出/副本三份同构
   循环的归一); pick=rnd()*总权重逐段扣减, 浮点表示误差的尽头(pick 扣完
   各段仍不小于 0)兜底末段种——零权重段天然永不命中 */
function advWeightedPick(pool, rnd) {
  let total = 0;
  for (const p of pool) total += p[1];
  let pick = rnd() * total;
  let type = pool[pool.length - 1][0];
  for (const p of pool) {
    pick -= p[1];
    if (pick < 0) {
      type = p[0];
      break;
    }
  }
  return type;
}

/* 环带掷点: 环心 (cx,cz), 角度 [0,2π) 均匀 · 半径 [lo,hi) 均匀——夜怪
   玩家环/祭坛环/巢穴环三处同几何的归一; rnd 消费序固定先角度后半径 */
function advRingSpot(cx, cz, lo, hi, rnd) {
  const a = rnd() * Math.PI * 2;
  const r = lo + rnd() * (hi - lo);
  return {x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r};
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {advSpawnPulse, advWeightedPick, advRingSpot};
}
