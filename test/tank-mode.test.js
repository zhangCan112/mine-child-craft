"use strict";
/* 坦克演习场模式 (js/modes/tank-range.js) 单测 — node --test (零依赖)
   运行: node --test test/tank-mode.test.js
   引擎全局(Tank/SceneKit/SpeechKit…)以 fake 注入(replace-don't-layer),
   只测模式政策: 键鼠/触屏路由 · 提示文案与语音节流 · 保底下车 */
const test = require('node:test');
const assert = require('node:assert');

function fakeEl(){
  const el = {
    children: [], _cls: new Set(), style: {}, innerHTML: '', textContent: '', dataset: {},
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
globalThis.ModeKit = ModeKit;            /* 同上: tank-range 经 ModeKit.spawn 出生(不走裸全局名) */
ModeKit.spawn = (x, y, z, o) => { calls.push(['spawn', x, y, z, o]); };   /* 出生桩: 不碰 pos/vel 全局 */

/* ---------- fake 引擎层(调用期解析的全局名) ---------- */
const calls = [];
const tankState = { near: null, driving: false, toggleResult: 'far' };
const spoken = [];
let touchList = null;

globalThis.Tank = {
  place(x, y, z, o){ calls.push(['place', x, y, z, o]); },
  toggle(){ calls.push(['toggle']); return tankState.toggleResult; },
  driving(){ return tankState.driving; },
  nearby(){ return tankState.near === null ? null : { d: tankState.near, name: '迷彩战车' }; },
  exitAll(){ calls.push(['exitAll']); },
  clear(){ calls.push(['clear']); },
  fire(){ calls.push(['fire']); return tankState.fireResult || 'fired'; },
  at(){ return { x: 56, y: 13, z: 94 }; },       /* 驾驶中车位(碾压判定用) */
  onExplode(cb){ explodeCb = cb; },          /* 模式注册爆炸回调(命中反馈) */
  protect(fn){ protectFn = fn; },            /* 模式注册爆炸保护谓词(地面政策) */
  obstacle(fn){ obstacleFn = fn; },          /* 模式注册炮弹障碍谓词(怪物身体挡炮弹) */
  targeter(fn){ targeterFn = fn; },          /* 模式注册索敌钩子(追踪导弹的"敌人是谁") */
  icon(){ return 'data:tank'; },             /* 型号像素图标(选坦克页卡片) */
  model(k){ return TANK_MODELS[k] || TANK_MODELS.classic; },   /* 型号查询单一回落(config 的 TANK_MODELS) */
};
let targeterFn = null;
/* 坦克型号注册表替身(config 的 TANK_MODELS): 两款足够测选车与切换 */
globalThis.TANK_MODELS = {
  classic: { key: 'classic', name: '迷彩战车', desc: '老兵', perf: { speed: 7 }, muzzle: { f: 1.9, y: 1.32 }, shell: {} },
  thunder: { key: 'thunder', name: '雷霆战神', desc: '电光', perf: { speed: 7.6 }, muzzle: { f: 2.25, y: 1.36 }, shell: {} },
};
globalThis.clearWorld = () => { calls.push(['clearWorld']); };   /* 换车型重建兜底 */
let explodeCb = null, protectFn = null, obstacleFn = null;
globalThis.SceneKit = { fill(){ calls.push(['fill']); }, tree(){}, rand: () => 0 };
globalThis.SpeechKit = { speak(s){ spoken.push(s); }, cancel(){} };
globalThis.showToast = (s) => calls.push(['toast', s]);
globalThis.setTouchActions = (l) => { touchList = l; };
globalThis.spawn = (x, y, z) => calls.push(['spawn', x, y, z]);
globalThis.fps = 60;                                /* HUD 的 FPS 行读主循环全局(浏览器=main.js) */
let rebuilt = 0;
globalThis.rebuildAll = () => { rebuilt++; };   /* 建场收尾: 方块数据 → 区块网格 */

/* ---------- fake 怪物库(共享怪物: js/mobs.js 的调用期全局) ---------- */
const mobsState = { spawned: [], cleared: 0 };
let nearResult = [];
let listResult = [];
let nextHit = { hp: 10, dead: false, freshDead: false };
const hitLog = [];
globalThis.Mobs = {
  types: { zombie:{name:'僵尸'}, skeleton:{name:'骷髅'}, creeper:{name:'苦力怕'}, golem:{name:'铁傀儡'}, dragon:{name:'末影龙'}, husk:{name:'尸壳'}, mix:{name:'混合编队'} },
  /* ↑ fake 注册表多放一种新怪 + mix 伪类型: 选怪清单应动态全取并排除 mix */
  spawn(type, x, z, opts){ mobsState.spawned.push({ type, x, z, opts }); return { type, pos:{ x, y: 13, z } }; },
  update(){}, render(){},
  hit(m, dmg){ hitLog.push({ m, dmg }); return nextHit; },
  near(){ return nearResult; },
  clear(){ mobsState.cleared++; },
  list(){ return listResult; },
  face(){ return 'data:'; },
  hasSlot(){ return true; },
  spawnable(){ return Object.keys(this.types).filter(k => k !== 'mix'); },
  debrisColor(){ return 0x8a8f98; },     /* 击杀碎块配色(真实表在怪物库) */
};
globalThis.Fx = { debrisBurst(){ calls.push(['debris']); } };
globalThis.showPage = (id) => calls.push(['page', id]);
globalThis.requestLock = () => calls.push(['lock']);
globalThis.getBlock = () => 0;                /* 部署寻位的头顶净空查询 */
globalThis.isSolid = () => false;
globalThis.groundTop = () => 11;
globalThis.TANK_VS_MOBS = { direct: 40, splash: 42, edge: 12, crush: 40, blastR: 3.1, blastDy: 7 };   /* config 数值表替身 */
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
  assert.strictEqual(typeof protectFn, 'function', '模式在 init 注册爆炸保护谓词');
  /* 保护判定: 平坦草海(y≤12 草/泥)永固; 丘陵层(y≥13)与石质照炸 */
  assert.strictEqual(protectFn(1, 64, 12, 64), true, '草海顶层受保护');
  assert.strictEqual(protectFn(2, 64, 10, 64), true, '泥底基层受保护');
  assert.strictEqual(protectFn(1, 30, 15, 24), false, '丘陵草帽(y≥13)可炸');
  assert.strictEqual(protectFn(3, 64, 14, 58), false, '石质结构可炸');
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

/* ============ 共享怪物: 部署 · 爆炸 · 碾压 · 清场 ============ */

test('共享怪物: init 按默认配置一次性部署(僵尸×6, 带游荡栅栏), cleanup 清场', () => {
  mobsState.spawned.length = 0; mobsState.cleared = 0;
  TankRangeMode.init();
  assert.strictEqual(mobsState.spawned.length, 6, '默认 6 只: ' + mobsState.spawned.length);
  assert.ok(mobsState.spawned.every(s => s.type === 'zombie'), '默认僵尸');
  assert.ok(mobsState.spawned.every(s => s.opts && s.opts.wander && s.opts.wander.x0 === 18), '带游荡栅栏(怪物库游荡本能)');
  assert.ok(mobsState.spawned.every(s => Math.hypot(s.x - 56, s.z - 94) >= 12), '不刷在坦克脸上');
  assert.strictEqual(elCache['pkMobBtns'].children.length, 6, '选怪面板动态生成全部怪种按钮(fake 6 种, mix 伪类型排除; 自有 pk* 类, 不复用竞技场 .mobBtns → 不会被竞技场 buildPanel 注入翻倍)');
  const before = mobsState.cleared;
  TankRangeMode.cleanup();
  assert.ok(mobsState.cleared > before, 'cleanup 清掉怪物');
  TankRangeMode.init();                                       /* 重复进场 */
  assert.strictEqual(elCache['pkMobBtns'].children.length, 6, '重复进场不重复放按钮(幂等)');
});

test('R 键重部署: 清掉当前批, 按当前配置再来一批(无波次自动刷新)', () => {
  mobsState.spawned.length = 0; mobsState.cleared = 0;
  TankRangeMode.onKey('KeyR');
  assert.ok(mobsState.cleared >= 1, '先清场');
  assert.strictEqual(mobsState.spawned.length, 6, '再部署一批');
});

test('爆炸打怪: 近爆心按直击满伤, 边缘按距离衰减; 击杀给碎块与计数', () => {
  TankRangeMode.init();                       /* 注册 onExplode/onBoom 与炮弹障碍 */
  hitLog.length = 0; calls.length = 0; spoken.length = 0;
  assert.strictEqual(typeof obstacleFn, 'function', '模式在 init 注册炮弹障碍谓词(怪物身体挡炮弹)');
  const mA = { type:'zombie', pos:{ x:64.5, y:12, z:54.5 } };   /* 爆心旁 → 直击 */
  const mB = { type:'zombie', pos:{ x:66.0, y:12, z:55.5 } };   /* 边缘 → 衰减 */
  nearResult = [mA, mB];
  nextHit = { hp: 0, dead: false, freshDead: false };
  explodeCb(64, 12, 54, { removed: 5, counts: {} });
  assert.strictEqual(hitLog.length, 2, '波及范围内两只都挨打');
  assert.strictEqual(hitLog[0].dmg, 40, '爆心旁按直击伤 40');
  /* 固定期望值而非镜像公式: d≈2.5 → round(42 - 30×2.5/3.1) = 18; d≥3.1 → 12 */
  assert.strictEqual(hitLog[1].dmg, 18, '边缘按距离线性衰减(42→12): ' + hitLog[1].dmg);
  nearResult = [mA];
  nextHit = { hp: 0, dead: true, freshDead: true };
  explodeCb(64, 12, 54, { removed: 5, counts: {} });
  assert.ok(has('debris'), '击杀有碎块特效');
  assert.ok(calls.some(c => c[0] === 'toast' && String(c[1]).indexOf('消灭') >= 0), '击杀计数 toast');
  nearResult = [];
});

test('炮弹障碍: 怪物身体挡炮弹(水平半径 hitR+0.35, 竖向身体区间)', () => {
  TankRangeMode.init();
  listResult = [{ type:'zombie', pos:{ x:64.5, y:12, z:54.5 }, cfg:{ hitR:0.55, h:1.9 } }];
  assert.strictEqual(obstacleFn(64.6, 13.0, 54.4), true, '身体区间内 → 挡炮弹');
  assert.strictEqual(obstacleFn(64.9, 13.0, 54.4), true, '半径放宽 0.35 仍算命中');
  assert.strictEqual(obstacleFn(66.5, 13.0, 54.5), false, '横向太远不挡');
  assert.strictEqual(obstacleFn(64.6, 15.0, 54.4), false, '头顶上方不挡');
  assert.strictEqual(obstacleFn(64.6, 11.0, 54.4), false, '脚下不挡');
  listResult = [];
});

test('坦克碾压: 驾驶中贴身怪物挨碾压伤(孩子的最爱)', () => {
  hitLog.length = 0;
  const m = { type:'zombie', pos:{ x:56.8, y:13, z:94.3 } };   /* 坦克(56,94)贴身 */
  nearResult = [m];
  nextHit = { hp: 0, dead: true, freshDead: true };
  tankState.driving = true;
  calls.length = 0;
  TankRangeMode.update(1/60);
  assert.strictEqual(hitLog.length, 1, '贴身怪物挨碾压');
  assert.strictEqual(hitLog[0].dmg, 40, '碾压伤 40(脆怪一发压扁)');
  assert.ok(has('debris'), '碾压击杀也有碎块');
  nearResult = [];
  tankState.driving = false;
});

test('清场播报: 一批全灭时语音表扬一次(过程性表扬, 不罚失误)', () => {
  TankRangeMode.onKey('KeyR');                /* 显式部署一批, 不依赖跨测试状态 */
  spoken.length = 0;
  tankState.driving = false;
  listResult = [];                            /* 场上一只不剩 */
  TankRangeMode.update(1/60);
  assert.ok(spoken.some(s => s.indexOf('全部消灭') >= 0), '清场表扬: ' + spoken.join('/'));
  spoken.length = 0;
  TankRangeMode.update(1/60);
  assert.ok(!spoken.some(s => s.indexOf('全部消灭') >= 0), '只说一次');
});

test('选怪面板: 🐛 触屏按钮与 M 键开关游戏内浮动面板(不复用竞技场菜单页)', () => {
  const picker = elCache['mobPicker'];
  assert.ok(picker, 'index.html 有 #mobPicker');
  const bugBtn = touchList.find(b => b.label.indexOf('👾') >= 0);
  assert.ok(bugBtn, '触屏有 👾 换怪按钮');
  bugBtn.act();
  assert.ok(picker._cls.has('open'), '👾 开面板');
  bugBtn.act();
  assert.ok(!picker._cls.has('open'), '再点关闭');
  TankRangeMode.onKey('KeyM');
  assert.ok(picker._cls.has('open'), 'M 键同入口开关');
  TankRangeMode.onKey('KeyM');
  assert.ok(!picker._cls.has('open'), 'M 键再关');
});

test('选怪面板: 数量 +/- 生效, 面板内部署按钮按当前选择撒怪并关面板', () => {
  mobsState.spawned.length = 0;
  TankRangeMode.onKey('KeyM');                 /* 开面板 */
  elCache['pkCntP'].onclick();                /* 6 → 7 */
  elCache['pkCntP'].onclick();                /* 7 → 8 */
  assert.strictEqual(elCache['pkCnt'].textContent, 8, '数量显示 8');
  elCache['pkCntM'].onclick();                /* 8 → 7 */
  assert.strictEqual(elCache['pkCnt'].textContent, 7, '减一回到 7');
  elCache['pkGo'].onclick();                  /* 部署 */
  assert.strictEqual(mobsState.spawned.length, 7, '按面板数量撒 7 只');
  assert.ok(!elCache['mobPicker']._cls.has('open'), '部署即关面板');
});

test('HUD: 驾驶中报剩余怪物数(怪物库 list 只读视图)', () => {
  const hudEl = elCache['hud'];
  listResult = [{}, {}, {}];                  /* 三只存活 */
  tankState.driving = true; tankState.near = 0.4;
  fakeClock += 200; TankRangeMode.updateHud(null);
  assert.ok(hudEl.innerHTML.indexOf('剩 3') >= 0, 'HUD 剩余数: ' + hudEl.innerHTML);
  listResult = [];
});

/* ============ 三期: 进场前选坦克型号(TANK_MODELS 注册表) ============ */

test('进场放当前型号: init 以 selModel(默认迷彩战车)放置, 重建走 clearWorld 兜底', () => {
  calls.length = 0;
  TankRangeMode.init();
  const p = calls.find(c => c[0] === 'place');
  assert.ok(p, 'init 放置坦克');
  assert.strictEqual(p[4] && p[4].model, 'classic', '默认型号 classic: ' + JSON.stringify(p[4]));
  assert.ok(has('clearWorld'), '进场重建幂等兜底 clearWorld');
});

test('出发配置页: 坦克卡按 order 排序, 点卡只改选择不重建, 出发才进场', () => {
  const grid = elCache['tankPick'];
  grid.children.length = 0;
  TankRangeMode.buildMenu();                    /* 与 main.js 同入口(main 的 buildMenu 钩子) */
  assert.strictEqual(grid.children.length, 2, '每个型号一张卡: ' + grid.children.length);
  assert.ok(grid.children.every(c => c.dataset.model), '卡片带 data-model');
  const card = grid.children.find(c => c.dataset.model === 'thunder');
  assert.ok(card && !card._cls.has('active'), '当前是迷彩战车, 雷霆卡未高亮');
  calls.length = 0; spoken.length = 0;
  card.onclick();                               /* 点卡 = 只选不进场 */
  assert.ok(!has('clearWorld'), '点卡不重建');
  assert.ok(!has('place'), '点卡不放置');
  assert.ok(!has('lock'), '点卡不进战场');
  assert.ok(calls.some(c => c[0] === 'toast' && String(c[1]).indexOf('雷霆战神') >= 0), '选中有提示: ' + JSON.stringify(calls));
  const last = [...grid.children].reverse().find(c => c.dataset.model === 'thunder');
  assert.ok(last._cls.has('active'), '选后雷霆战神卡高亮(重绘取最后一张)');
  /* 出发: 换了型号 → 重建演习场放置雷霆战神 + 回战场 */
  elCache['tankGoBtn'].onclick();
  assert.ok(has('lock'), '出发回战场');
  const p = calls.filter(c => c[0] === 'place').pop();
  assert.strictEqual(p[4].model, 'thunder', '换型号后放置雷霆战神');
  assert.ok(has('clearWorld'), '换车重建演习场');
});

test('出发配置页: 怪物一行 6 卡(fake 7 种, mix 排除)与 👾 面板共用 mobCfg, 选完出发部署该怪', () => {
  const mrow = elCache['tankMobPick'];
  mrow.children.length = 0;
  TankRangeMode.buildMenu();
  assert.strictEqual(mrow.children.length, 5 + 1, '怪物一行动态生成全部怪种卡(fake 6 种, mix 排除)');
  const sk = mrow.children.find(c => c.dataset.mob === 'skeleton');
  assert.ok(sk && !sk._cls.has('active'), '默认僵尸, 骷髅卡未高亮');
  mobsState.spawned.length = 0;
  sk.onclick();                                 /* 选骷髅 */
  const sk2 = [...mrow.children].reverse().find(c => c.dataset.mob === 'skeleton');
  assert.ok(sk2._cls.has('active'), '选后骷髅卡高亮');
  calls.length = 0;
  elCache['tankGoBtn'].onclick();               /* 出发: 怪种变了 → 重建并部署骷髅 */
  assert.ok(has('clearWorld'), '怪种变化也重建');
  assert.ok(mobsState.spawned.length > 0 && mobsState.spawned.every(s => s.type === 'skeleton'),
    '出发部署的是骷髅: ' + mobsState.spawned.map(s => s.type).join(','));
  assert.ok(has('lock'), '出发回战场');
});

test('出发不折腾: 选择没变直接回战场, 不重建(进度不丢)', () => {
  elCache['tankGoBtn'].onclick();               /* 先决: 以当前选择同步 placedModel/placedMob */
  calls.length = 0;
  elCache['tankGoBtn'].onclick();               /* selModel/怪种与场上一致 */
  assert.ok(!has('clearWorld'), '没变不重建');
  assert.ok(!has('place'), '没变不放置');
  assert.ok(has('lock'), '仍直接回战场');
});

/* 选车测试的独立前置: 先归位迷彩战车再选目标型号(不依赖前序测试的选择残留) */
function selectTankViaUI(key){
  TankRangeMode.buildMenu();
  const grid = elCache['tankPick'];
  const card = [...grid.children].reverse().find(c => c.dataset.model === key);
  card.onclick();
}

test('HUD/话术带型号名: 驾驶中显示当前型号, 上车语音报名字', () => {
  selectTankViaUI('classic');                   /* 归位(幂等), 保证下面的切换真实发生 */
  selectTankViaUI('thunder');
  const hudEl = elCache['hud'];
  tankState.driving = true; tankState.near = 0.4;
  fakeClock += 200; TankRangeMode.updateHud(null);
  assert.ok(hudEl.innerHTML.indexOf('雷霆战神') >= 0, 'HUD 带型号名: ' + hudEl.innerHTML);
  tankState.driving = false;
  spoken.length = 0;
  tankState.toggleResult = 'entered';
  TankRangeMode.onKey('KeyE');
  assert.ok(spoken.some(s => s.indexOf('雷霆战神') >= 0 && s.indexOf('开坦克') >= 0),
    '上车语音报型号名: ' + spoken.join('/'));
  selectTankViaUI('classic');                   /* 收尾归位, 后续测试不依赖雷霆 */
});

/* ============ 四期: 张廷彧号追踪导弹(索敌政策归模式层) ============ */

test('导弹索敌: 模块加载即注册 Tank.targeter(钩子常驻, clear/init 不重挂), 最近活怪身体中心, 跳过死怪, 无敌直飞', () => {
  assert.strictEqual(typeof targeterFn, 'function', '模式加载时注册索敌钩子(会话级接线)');
  const registered = targeterFn;
  targeterFn = null;                          /* 模拟钩子被解绑: init/clear 都不再重挂(引擎侧也不解除) */
  TankRangeMode.init();
  assert.strictEqual(targeterFn, null, '注册只发生在模块加载 — 重进模式无需重挂');
  targeterFn = registered;                    /* 还原后继续测索敌政策 */
  listResult = [
    { type: 'zombie', dead: true,  gone: false, pos: { x: 64, y: 13, z: 55 }, cfg: { h: 1.9 } },   /* 死怪不算 */
    { type: 'zombie', dead: false, gone: false, pos: { x: 64, y: 13, z: 64 }, cfg: { h: 1.9 } },   /* 稍远 */
    { type: 'golem',  dead: false, gone: false, pos: { x: 64, y: 13, z: 54 }, cfg: { h: 2.8 } },   /* 最近 */
  ];
  const t = targeterFn(64, 13, 56);
  assert.ok(t, '有目标');
  assert.strictEqual(t.z, 54, '取最近的活怪(铁傀儡)');
  assert.ok(t.y > 13 && t.y < 14.5, '瞄准身体中部(脚底 y+身高一半): ' + t.y);
  listResult = [];
  assert.strictEqual(targeterFn(64, 13, 56), null, '场上无敌 → null(导弹直飞不拐弯)');
});
