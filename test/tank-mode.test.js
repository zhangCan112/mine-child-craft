"use strict";
/* 坦克演习场模式 (js/modes/tank-range.js) 单测 — node --test (零依赖)
   运行: node --test test/tank-mode.test.js
   引擎全局(Tank/SceneKit/SpeechKit…)以 fake 注入(replace-don't-layer),
   只测模式政策: 键鼠/触屏路由 · 提示文案与语音节流 · 保底下车 */
const test = require('node:test');
const assert = require('node:assert');

function fakeEl(){
  const el = {
    children: [], _cls: new Set(), style: {}, innerHTML: '', textContent: '',
    addEventListener(){}, appendChild(c){ this.children.push(c); return c; },
    querySelector(sel){ if(!this['q_' + sel]) this['q_' + sel] = fakeEl(); return this['q_' + sel]; },
  };
  Object.defineProperty(el, 'classList', { value: {
    add: c=>el._cls.add(c), remove: c=>el._cls.delete(c),
    toggle: (c, v)=>{ const on = (v === undefined) ? !el._cls.has(c) : v; if(on) el._cls.add(c); else el._cls.delete(c); },
    contains: c=>el._cls.has(c),
  }});
  return el;
}

/* mode-kit 在模块加载时捕获 document/MK — 必须先注入再 require;
   getElementById 按 id 记忆化, 测试才能拿到 MK.hud 捕获的同一元素;
   updateHud 有 100ms 节流, 注入可控时钟使其确定可测 */
let fakeClock = 0;
globalThis.performance = { now: () => fakeClock };
const elCache = {};
globalThis.document = {
  createElement: () => fakeEl(),
  getElementById: (id) => (elCache[id] = elCache[id] || fakeEl()),
};
const ModeKit = require('../js/mode-kit.js');
globalThis.mkMode = ModeKit.mkMode;      /* 浏览器经典脚本下 mkMode 是全局, Node 需桥接 */

/* ---------- fake 引擎层(调用期解析的全局名) ---------- */
const calls = [];
const tankState = { near: null, driving: false, toggleResult: 'far' };
const spoken = [];
let touchList = null;

globalThis.Tank = {
  place(){ calls.push(['place']); },
  toggle(){ calls.push(['toggle']); return tankState.toggleResult; },
  driving(){ return tankState.driving; },
  nearby(){ return tankState.near; },
  exitAll(){ calls.push(['exitAll']); },
  clear(){ calls.push(['clear']); },
  fire(){ calls.push(['fire']); return tankState.fireResult || 'fired'; },
  at(){ return { x: 56, y: 13, z: 94 }; },       /* 驾驶中车位(碾压判定用) */
  onExplode(cb){ explodeCb = cb; },          /* 模式注册爆炸回调(命中反馈) */
};
let explodeCb = null;
globalThis.SceneKit = { fill(){ calls.push(['fill']); }, tree(){}, rand: () => 0 };
globalThis.SpeechKit = { speak(s){ spoken.push(s); }, cancel(){} };
globalThis.showToast = (s) => calls.push(['toast', s]);
globalThis.setTouchActions = (l) => { touchList = l; };
globalThis.spawn = (x, y, z) => calls.push(['spawn', x, y, z]);
let rebuilt = 0;
globalThis.rebuildAll = () => { rebuilt++; };   /* 建场收尾: 方块数据 → 区块网格 */
globalThis.pos = { set(){} };
globalThis.vel = { set(){} };
globalThis.yaw = 0; globalThis.pitch = 0; globalThis.onGround = true;

const TankRangeMode = require('../js/modes/tank-range.js');

const DT = 1/60;
function has(ev){ return calls.some(c => c[0] === ev); }

/* ============ 模式装配 ============ */

test('模式装配: id=tank, init 建场放坦克并出生, cleanup 清场, 触屏按钮就位', () => {
  TankRangeMode.init();
  assert.ok(has('fill'), 'init 用 SceneKit 建场');
  assert.ok(rebuilt >= 1, 'init 收尾调 rebuildAll(方块数据 → 可见网格, 漏了就是一片天蓝)');
  assert.ok(has('place'), 'init 放置坦克');
  assert.ok(has('spawn'), 'init 出生玩家');
  assert.ok(Array.isArray(touchList) && touchList.length >= 1, '声明了触屏按钮');
  const btn = touchList[0];
  assert.ok(btn.label && typeof btn.act === 'function', '按钮可点(label+act)');
  TankRangeMode.cleanup();
  assert.ok(has('clear'), 'cleanup 清掉坦克');
});

/* ============ 上下车路由 ============ */

test('E 键与触屏按钮同走 Tank.toggle, 话术随结果', () => {
  calls.length = 0; spoken.length = 0;
  tankState.toggleResult = 'far';
  TankRangeMode.onKey('KeyE');
  assert.ok(has('toggle'), 'E 键路由到 toggle');
  assert.ok(!spoken.some(s => s.indexOf('坦克') >= 0 && s.indexOf('喽') >= 0), '距离太远不上车话术');

  calls.length = 0; spoken.length = 0;
  tankState.toggleResult = 'entered';
  TankRangeMode.onKey('KeyE');
  assert.ok(spoken.some(s => s.indexOf('开坦克') >= 0), '上车语音: ' + spoken.join('/'));

  calls.length = 0; spoken.length = 0;
  tankState.toggleResult = 'exited';
  touchList[0].act();                                   // 触屏按钮与 E 同一入口
  assert.ok(spoken.some(s => s.indexOf('下车') >= 0), '下车语音: ' + spoken.join('/'));
});

test('菜单保底: Esc(onMenu) 强制下车', () => {
  calls.length = 0;
  TankRangeMode.onMenu();
  assert.ok(has('exitAll'), 'onMenu → Tank.exitAll');
});

/* ============ 提示: HUD 与语音节流 ============ */

test('HUD: 靠近显示上车提示, 驾驶中切换为下车提示, 远离清空', () => {
  const hudEl = elCache['hud'];                              /* 与 MK.hud 同一元素 */
  tankState.driving = false; tankState.near = 1.2;
  fakeClock += 200; TankRangeMode.updateHud(null);
  assert.ok(hudEl.innerHTML.indexOf('按 E 开坦克') >= 0, '靠近提示: ' + hudEl.innerHTML);
  tankState.driving = true;
  fakeClock += 200; TankRangeMode.updateHud(null);
  assert.ok(hudEl.innerHTML.indexOf('下车') >= 0, '驾驶中提示: ' + hudEl.innerHTML);
  tankState.driving = false; tankState.near = null;
  fakeClock += 200; TankRangeMode.updateHud(null);
  assert.strictEqual(hudEl.innerHTML, '', '远离清空');
});

test('靠近语音: 10 秒节流, 只在未驾驶且有车在近旁时说', () => {
  spoken.length = 0;
  tankState.driving = false; tankState.near = 1.5;
  for(let i=0; i<Math.round(0.5/DT); i++) TankRangeMode.update(DT);    // 靠近半秒
  const n1 = spoken.filter(s => s.indexOf('要开坦克') >= 0).length;
  assert.strictEqual(n1, 1, '首次靠近说一次: ' + spoken.join('/'));
  for(let i=0; i<Math.round(5/DT); i++) TankRangeMode.update(DT);      // 持续靠近 5 秒
  const n2 = spoken.filter(s => s.indexOf('要开坦克') >= 0).length;
  assert.strictEqual(n2, 1, '10 秒内不重复');
  for(let i=0; i<Math.round(6/DT); i++) TankRangeMode.update(DT);      // 再过 6 秒(累计 >10s)
  const n3 = spoken.filter(s => s.indexOf('要开坦克') >= 0).length;
  assert.strictEqual(n3, 2, '超过 10 秒再说一次');
});

test('驾驶中/远离时不说上车邀请', () => {
  spoken.length = 0;
  tankState.driving = true; tankState.near = 0.5;
  for(let i=0; i<Math.round(2/DT); i++) TankRangeMode.update(DT);
  tankState.driving = false; tankState.near = null;
  for(let i=0; i<Math.round(2/DT); i++) TankRangeMode.update(DT);
  assert.ok(!spoken.some(s => s.indexOf('要开坦克') >= 0), '不应发出邀请');
});

/* ============ 二期: 开炮路由与命中反馈 ============ */

test('左键开炮: 驾驶中路由 Tank.fire, 步行时左键不开炮', () => {
  calls.length = 0;
  tankState.driving = true; tankState.fireResult = 'fired';
  TankRangeMode.onMouse(0, null);
  assert.ok(has('fire'), '驾驶中左键 → fire');
  calls.length = 0;
  tankState.driving = false;
  TankRangeMode.onMouse(0, null);
  assert.ok(!has('fire'), '步行时左键不开炮');
});

test('触屏开炮按钮: 💥 与桌面左键同入口, 装填中提示', () => {
  assert.ok(touchList.length >= 2, '上下车 + 开炮两个按钮');
  const fireBtn = touchList.find(b => b.label.indexOf('💥') >= 0);
  assert.ok(fireBtn, '有 💥 开炮按钮');
  calls.length = 0;
  tankState.driving = true; tankState.fireResult = 'fired';
  fireBtn.act();
  assert.ok(has('fire'), '按钮 → fire');
  calls.length = 0;
  tankState.fireResult = 'cooldown';
  fireBtn.act();
  assert.ok(has('toast'), '装填中 toast 提示');
});

test('命中反馈: 爆炸炸到靶才表扬, 计数进 HUD', () => {
  spoken.length = 0;
  TankRangeMode.init();                       /* 注册 onExplode */
  assert.strictEqual(typeof explodeCb, 'function', '模式在 init 注册爆炸回调');
  tankState.driving = true; tankState.near = 0.4;
  fakeClock += 200; TankRangeMode.updateHud(null);
  explodeCb(64, 12, 54, { removed: 9, counts: { 16: 3 } });   /* 一炮炸掉 3 块靶(带爆点坐标) */
  assert.ok(spoken.some(s => s.indexOf('打中') >= 0), '命中表扬: ' + spoken.join('/'));
  fakeClock += 200; TankRangeMode.updateHud(null);
  const hudEl = elCache['hud'];
  assert.ok(hudEl.innerHTML.indexOf('命中 1') >= 0, 'HUD 计数: ' + hudEl.innerHTML);
  spoken.length = 0;
  explodeCb(64, 12, 54, { removed: 20, counts: {} });          /* 只炸地板不炸靶 → 不表扬 */
  assert.ok(!spoken.some(s => s.indexOf('打中') >= 0), '没打到靶不表扬');
});
