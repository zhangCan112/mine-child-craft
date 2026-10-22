"use strict";
/* 画质核心 (js/quality-core.js) 单测 — node --test (零依赖)
   运行: node --test test/quality-core.test.js
   加载器: vm context 执行 quality-core.js (纯决策核心, 零依赖);
   step 每次调用 = 主循环的一个半秒 fps 采样 (口径见文件头) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCore(){
  const ctx = vm.createContext({ console });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'quality-core.js'), 'utf8'),
    ctx, { filename: 'quality-core.js' });
  /* 顶层 const 在共享词法环境, 不挂 context 对象 — 以探针脚本取 (与 tank-core.test.js 同法) */
  return vm.runInContext('QualityCore', ctx);
}

/* ============ 降档 ============ */

test('低帧降档: 持续 <45fps 满 3 秒(6 采样)降 0.25, 再 3 秒再降', () => {
  const Q = loadCore();
  const q = Q.mk(2);
  let r = 0;
  for(let i=0; i<5; i++) r = Q.step(q, 30);          // 5 个采样还不够
  assert.strictEqual(r, 0, '第 5 个低帧采样不应降档');
  r = Q.step(q, 30);                                  // 第 6 个: 满 3 秒
  assert.strictEqual(r, 1.75, '2.0 → 1.75');
  for(let i=0; i<5; i++) Q.step(q, 44);               // 新一轮 3 秒
  assert.strictEqual(Q.step(q, 44), 1.5, '1.75 → 1.5');
});

test('降档有下限: 到 1.0 后继续低帧不再降', () => {
  const Q = loadCore();
  const q = Q.mk(1.5);
  for(let i=0; i<6; i++) Q.step(q, 10);
  assert.strictEqual(q.dpr, 1.25);
  for(let i=0; i<6; i++) Q.step(q, 10);
  assert.strictEqual(q.dpr, 1, '下限 1.0');
  let r = 0;
  for(let i=0; i<20; i++) r = Q.step(q, 10);
  assert.strictEqual(r, 0, '到底后 step 不再返回变化');
});

/* ============ 升档 ============ */

test('高帧升档: 降档后持续 ≥55fps 满 30 秒(60 采样)且冷却(60 秒)耗尽才回升', () => {
  const Q = loadCore();
  const q = Q.mk(2);
  for(let i=0; i<6; i++) Q.step(q, 30);               // 先降到 1.75
  assert.strictEqual(q.dpr, 1.75);
  let r = 0;
  for(let i=0; i<59; i++) r = Q.step(q, 58);          // 高帧证据还不够
  assert.strictEqual(r, 0, '第 59 个高帧采样不应升档');
  r = Q.step(q, 58);                                   // 高帧满 30 秒, 但降档冷却(60 秒)未过
  assert.strictEqual(r, 0, '冷却期内高帧也不升');
  for(let i=0; i<59; i++) Q.step(q, 58);              // 补满 120 个高帧采样(冷却耗尽)
  r = Q.step(q, 58);                                   // 第 120 个: 冷却到 + 证据够
  assert.strictEqual(r, 2, '1.75 → 2');
  assert.strictEqual(q.dpr, 2);
});

test('升档有顶: 回到初始档后继续高帧不再升', () => {
  const Q = loadCore();
  const q = Q.mk(2);
  for(let i=0; i<12; i++) Q.step(q, 30);               // 2 → 1.5
  assert.strictEqual(q.dpr, 1.5);
  let r = 0;
  for(let i=0; i<200; i++) r = Q.step(q, 60);
  assert.strictEqual(q.dpr, 2, '应升回 2');
  r = Q.step(q, 60);
  assert.strictEqual(r, 0, '到顶后不再升');
});

/* ============ 防抖: 观察窗封顶 · 死区 · 抖动 ============ */

test('升档观察窗内又降档: 回落且该档本场封顶, 之后高帧再久也不升', () => {
  const Q = loadCore();
  const q = Q.mk(2);
  for(let i=0; i<6; i++) Q.step(q, 30);               // → 1.75
  for(let i=0; i<120; i++) Q.step(q, 58);             // 冷却耗尽 → 升回 2
  assert.strictEqual(q.dpr, 2, '前置: 已升回 2');
  for(let i=0; i<6; i++) Q.step(q, 20);               // 观察窗(30 秒)内又低帧 → 降且封顶
  assert.strictEqual(q.dpr, 1.75, '回落 1.75');
  assert.strictEqual(q.dprMax, 1.75, '2.0 判不稳, 本场封顶 1.75');
  let r = 0;
  for(let i=0; i<400; i++) r = Q.step(q, 60);         // 之后高帧再久也不越封顶
  assert.strictEqual(r, 0, '封顶后不再升');
  assert.strictEqual(q.dpr, 1.75);
});

test('死区: 45~55fps 不积累升降证据, 交替抖动永不换档', () => {
  const Q = loadCore();
  const q = Q.mk(2);
  for(let i=0; i<5; i++) Q.step(q, 44);               // 5 个低帧采样
  Q.step(q, 50);                                       // 一个死区采样 → 低帧证据清零
  let r = 0;
  for(let i=0; i<5; i++) r = Q.step(q, 44);           // 再 5 个还不够 6
  assert.strictEqual(r, 0, '死区打断后的 5 个低帧不应降档');
  r = Q.step(q, 44);
  assert.strictEqual(r, 1.75, '第 6 个连续低帧才降');
  for(let i=0; i<100; i++) r = Q.step(q, i%2 ? 30 : 58);   // 低/高交替: 两边证据互相清零
  assert.strictEqual(r, 0, '交替抖动永不换档');
  assert.strictEqual(q.dpr, 1.75);
});

/* ============ 边界 ============ */

test('无效采样与台阶取整: fps≤0 不参与决策, mk 把非台阶 DPR 向下取整', () => {
  const Q = loadCore();
  const q = Q.mk(1.9);
  assert.strictEqual(q.dpr, 1.75, '1.9 → 台阶 1.75');
  assert.strictEqual(q.dprMax, 1.75);
  let r = 0;
  for(let i=0; i<30; i++) r = Q.step(q, i%2 ? 0 : 50);  // fps≤0 忽略, 50 落死区 → 永不换档
  assert.strictEqual(r, 0, '全程无换档');
  assert.strictEqual(q.dpr, 1.75, 'fps≤0 采样不触发任何换档');
});

