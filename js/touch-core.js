'use strict';
/* ============================================================
   触控手势核心 (TouchCore) — 引擎层纯核心
   ------------------------------------------------------------
   触屏指针流 → 手势分类状态机: 每根手指的结局必居其一 ——
     · tap   轻点(holdMs 内抬起且位移 ≤ moveTolPx) → 放置/交互
     · hold  长按(静止 ≥ holdMs) → 挖掘; 触发后允许移动, 目标点跟手
     · drag  拖动(位移 > moveTolPx 先于 hold 发生) → 视角旋转
   定时是调用方的责任(纯核心不持定时器): down 记时刻, 到点用
   due(id, t) 问"该指针是否应升级为 hold"。
   Minecraft 基岩版触控口径(调研见 docs/mc-touch-controls-research.md):
   轻点=放置/使用, 长按=挖掘, 拖动=转视角; holdMs 对齐探险模式
   TNT 短按窗口 0.25s(ADV_TNT_TAP_T), 两套判定同节拍。
   interface: mkTouchGestures({holdMs, moveTolPx}) →
     {down, move, up, due, has} — 前四者返回事件数组
     [{type:'tap'|'holdstart'|'holdmove'|'holdend'|'dragmove'|'dragend', ...}],
     move/up 事件按调用序增量产出(dragmove 带 dx/dy 增量)。
   依赖: 无(零 THREE · 零 DOM · 零全局可变依赖, 有单测 test/touch-core.test.js)
============================================================ */
function mkTouchGestures(opts) {
  const holdMs = (opts && opts.holdMs != null) ? opts.holdMs : 250;
  const tol = (opts && opts.moveTolPx != null) ? opts.moveTolPx : 12;
  /* id → {x0, y0, x, y, t0, role} ; role: 'pending' 待判 | 'hold' | 'drag'
     (tap 不是常驻角色 — pending 中按时长/位移在 up/due 一次性判出) */
  const ptrs = new Map();

  function down(id, x, y, t) {
    ptrs.set(id, {x0: x, y0: y, x, y, t0: t, role: 'pending'});
    return [];
  }

  function move(id, x, y) {
    const p = ptrs.get(id);
    if (!p) return [];
    const out = [];
    if (p.role === 'pending' && Math.hypot(x - p.x0, y - p.y0) > tol) {
      p.role = 'drag'; /* 阈值外位移先于 hold 发生 → 判为拖动 */
    }
    if (p.role === 'drag') {
      /* 增量视角: 与上一事件位置差(含判型那一小步, 不跳变) */
      out.push({type: 'dragmove', dx: x - p.x, dy: y - p.y});
    } else if (p.role === 'hold') {
      out.push({type: 'holdmove', x, y}); /* 挖掘目标点跟手 */
    }
    p.x = x; p.y = y;
    return out;
  }

  function up(id, x, y, t) {
    const p = ptrs.get(id);
    if (!p) return [];
    ptrs.delete(id);
    if (p.role === 'pending') {
      /* 静止中松手: 时长内=轻点; 已超时=due 未及升级的 hold, 同按收尾(不判 drag) */
      if (t - p.t0 < holdMs) return [{type: 'tap', x, y}];
      return [{type: 'holdend', x, y}];
    }
    return [{type: p.role === 'hold' ? 'holdend' : 'dragend', x, y}];
  }

  /* 调用方定时到点询问: pending 且静止满 holdMs → 升级 hold */
  function due(id, t) {
    const p = ptrs.get(id);
    if (!p || p.role !== 'pending' || t - p.t0 < holdMs) return [];
    p.role = 'hold';
    return [{type: 'holdstart', x: p.x, y: p.y}];
  }

  function has(id) {
    return ptrs.has(id);
  }

  return {down, move, up, due, has};
}

if (typeof module !== 'undefined' && module.exports) module.exports = {mkTouchGestures};
