/* T-SEAM-03 回程时序探针: 复刻红测试端到端序列(去程→镇→回程踩线帧),
   实测回程踩线帧的 advPortalCd 实值——决定早退链「冷却闸」是否会吞掉
   0.467s 后的回程发令(红测试契约要求该帧必须发令)。harness 同 probe-east-anchor2。 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.join(__dirname, '..', '..');
const TEST_DIR = path.join(ROOT, 'test');
const src = fs.readFileSync(path.join(TEST_DIR, 'adventure-mode.test.js'), 'utf8');
const MARK = '/* ============ 测试 ============ */';
const boot = src.slice(0, src.indexOf(MARK));
const scopedRequire = Module.createRequire(path.join(TEST_DIR, 'probe-scoped.js'));
const capture = `
;globalThis.__probe = {
  freshInit, calls, spoken, api, AdventureMode, A,
  advHomeArriveGate, advMapArriveAt, ADV_HOME_EDGE_GATES, ADV_GATE_FACE,
  ADV_GROUND, getBlock, BLOCKS,
};`;
const fn = new Function('require', '__dirname', '__filename', 'module', 'exports',
  boot + capture);
fn(scopedRequire, TEST_DIR, path.join(TEST_DIR, 'probe-scoped.js'),
  {exports: {}}, undefined);

const P = globalThis.__probe;
const dt = 1 / 60;
const st = () => P.A.advNetherState();

P.freshInit();
console.log('--- 去程 ---');
P.globalThis_like = null;
globalThis.pos.x = 157.2; globalThis.pos.y = 25; globalThis.pos.z = 74.5;
P.AdventureMode.update(dt); /* 越线瞬间发令 */
console.log('发令帧 dim=%s cd=%s veil(经 calls 推断)', st().dim, st().portalCd.toFixed(4));
for (let i = 0; i < 27; i++) P.AdventureMode.update(dt);
console.log('满格后 dim=%s map=%s cd=%s pos=(%s,%s,%s) dayCycleOn=%s',
  st().dim, st().map, st().portalCd.toFixed(4),
  globalThis.pos.x, globalThis.pos.y, globalThis.pos.z, globalThis.dayCycleOn);
console.log('--- 回程踩线帧(28 帧后) ---');
globalThis.pos.z = 132.5;
P.AdventureMode.update(dt);
console.log('回程帧 dim=%s map=%s cd=%s', st().dim, st().map, st().portalCd.toFixed(4));
/* 继续走完 27 帧, 看当前实现(无回程分支)下 dim 走向 */
for (let i = 0; i < 27; i++) P.AdventureMode.update(dt);
console.log('+27 帧 dim=%s map=%s pos=(%s,%s,%s)', st().dim, st().map,
  globalThis.pos.x, globalThis.pos.y, globalThis.pos.z);
console.log('时序探针完毕。');
