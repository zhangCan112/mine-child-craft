'use strict';
/* 触控手势核心 (js/touch-core.js) 单测 — node --test (零依赖)
   运行: node --test test/touch-core.test.js
   手势三分类: tap(轻点=放置/交互) · hold(长按=挖掘) · drag(拖动=视角),
   判据=按时长 × 位移阈值; 纯状态机, 定时由调用方驱动(due)。 */
const test = require('node:test');
const assert = require('node:assert');
const {mkTouchGestures} = require('../js/touch-core.js');

const TOL = 12; /* 与缺省一致, 测试里显式传以防缺省漂移 */
function mk() {
  return mkTouchGestures({holdMs: 250, moveTolPx: TOL});
}
const evTypes = (evs) => evs.map((e) => e.type);

/* ============ tap ============ */

test('tap: holdMs 内按下-抬起且位移在阈值内 → tap(取松手位置)', () => {
  const g = mk();
  assert.deepStrictEqual(evTypes(g.down(1, 100, 200, 0)), []);
  g.move(1, 105, 208); // 阈值内微动仍算轻点
  const evs = g.up(1, 106, 209, 120);
  assert.deepStrictEqual(evTypes(evs), ['tap']);
  assert.strictEqual(evs[0].x, 106);
  assert.strictEqual(evs[0].y, 209);
});

test('tap: 按满 holdMs 才抬起不判 tap(由 due 决定是否已成 hold)', () => {
  const g = mk();
  g.down(1, 50, 50, 0);
  const evs = g.up(1, 50, 50, 300); // 未调 due 先松手: 超时轻点不成立
  assert.deepStrictEqual(evTypes(evs), ['holdend']); // 但也不该判 drag
});

/* ============ hold ============ */

test('hold: 静止满 holdMs 由 due 升级, 后续 move 跟手, up 收尾', () => {
  const g = mk();
  g.down(7, 300, 400, 0);
  assert.deepStrictEqual(evTypes(g.due(7, 100)), [], '未满时长不升级');
  const start = g.due(7, 260);
  assert.deepStrictEqual(evTypes(start), ['holdstart']);
  assert.strictEqual(start[0].x, 300);
  assert.strictEqual(start[0].y, 400);
  assert.deepStrictEqual(evTypes(g.move(7, 340, 430)), ['holdmove'], 'hold 后移动=目标跟手(不受位移阈值限制)');
  assert.strictEqual(g.move(7, 380, 460)[0].x, 380);
  assert.deepStrictEqual(evTypes(g.up(7, 380, 460, 900)), ['holdend']);
});

test('hold: 同一指针 due 只生效一次, 二次询问无事', () => {
  const g = mk();
  g.down(1, 0, 0, 0);
  g.due(1, 250);
  assert.deepStrictEqual(evTypes(g.due(1, 300)), []);
});

/* ============ drag ============ */

test('drag: 阈值外位移先于 hold → 判拖动, 增量自上一事件位置起算(不跳变)', () => {
  const g = mk();
  g.down(2, 100, 100, 0);
  g.move(2, 104, 100); // 阈值内: 无事件
  g.move(2, 104, 116); // 累计位移 16 > 12 → 判型, 增量=与上一事件差(16)
  const evs = g.move(2, 110, 130);
  assert.deepStrictEqual(evTypes(evs), ['dragmove']);
  assert.strictEqual(evs[0].dx, 6);
  assert.strictEqual(evs[0].dy, 14);
  assert.deepStrictEqual(evTypes(g.due(2, 999)), [], '已判 drag 不再升级 hold');
  assert.deepStrictEqual(evTypes(g.up(2, 110, 130, 1000)), ['dragend']);
});

test('drag 判型那一小步也有增量输出(视角从按下起连续)', () => {
  const g = mk();
  g.down(3, 200, 200, 0);
  const evs = g.move(3, 200, 214); // 累计 14 > 12 → 判型即产出首个增量
  assert.deepStrictEqual(evTypes(evs), ['dragmove']);
  assert.strictEqual(evs[0].dy, 14);
});

/* ============ 多指互不干扰 ============ */

test('多指: 各指针独立分类, 互不串扰', () => {
  const g = mk();
  g.down(1, 100, 100, 0); // 将成为 hold
  g.down(2, 500, 400, 0); // 将成为 drag
  g.due(1, 250);
  g.move(2, 600, 400); // 位移 100 → drag
  assert.deepStrictEqual(evTypes(g.move(1, 120, 110)), ['holdmove']); // 指 1 仍 hold 跟手
  assert.deepStrictEqual(evTypes(g.move(2, 610, 400)), ['dragmove']); // 指 2 仍 drag 视角
  assert.deepStrictEqual(evTypes(g.up(1, 120, 110, 300)), ['holdend']);
  assert.deepStrictEqual(evTypes(g.up(2, 610, 400, 300)), ['dragend']);
});

test('未知指针的 move/up/due 静默(漏 down 或已 up 不炸不产事件)', () => {
  const g = mk();
  assert.deepStrictEqual(g.move(99, 1, 1), []);
  assert.deepStrictEqual(g.up(99, 1, 1, 0), []);
  assert.deepStrictEqual(g.due(99, 0), []);
  g.down(1, 0, 0, 0);
  g.up(1, 0, 0, 1);
  assert.strictEqual(g.has(1), false); // up 后指针已清
});

test('同 id 指针抬起后可复用(下一次 down 是新手势)', () => {
  const g = mk();
  g.down(1, 10, 10, 0);
  assert.deepStrictEqual(evTypes(g.up(1, 10, 10, 50)), ['tap']);
  g.down(1, 20, 20, 100);
  assert.deepStrictEqual(evTypes(g.due(1, 400)), ['holdstart']);
});
