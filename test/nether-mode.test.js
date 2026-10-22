"use strict";
/* 下界冒险模式 (js/modes/nether.js) 单测 — node --test (零依赖)
   运行: node --test test/nether-mode.test.js
   引擎全局(Mobs/Fx/SpeechKit/sfx/…)以 fake 注入(replace-don't-layer),
   只测模式政策: 上界建场 → 传送门进下界 → 挥击击杀 → 波次 → 玩家阵亡 → 回程传送门。
   状态断言全部走行为链(fake 调用记录), 不伸手进模块内部。 */
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

let fakeClock = 0;
globalThis.performance = { now: () => fakeClock };
const elCache = {};
globalThis.document = {
  createElement: () => fakeEl(),
  getElementById: (id) => (elCache[id] = elCache[id] || fakeEl()),
};
const ModeKit = require('../js/mode-kit.js');
globalThis.mkMode = ModeKit.mkMode;
globalThis.ModeKit = ModeKit;
const calls = [];
const spoken = [];
let touchList = null;
ModeKit.spawn = (x, y, z, o) => { calls.push(['spawn', x, y, z, o]); };

/* ---------- fake 引擎层(调用期解析的全局名) ---------- */
globalThis.clearWorld = () => { calls.push(['clearWorld']); };
globalThis.rebuildAll = () => { calls.push(['rebuild']); };
globalThis.loadScene = (fn) => { calls.push(['loadScene']); fn(); };   /* 场景装填 seam: 清场+建场+收尾重建 */
globalThis.buildBasementScene = () => { calls.push(['basement']); };
globalThis.setBlockRaw = (x, y, z, id) => { calls.push(['set', x, y, z, id]); };
globalThis.SceneKit = { fill(){}, tree(){}, rand: () => 0 };
globalThis.SpeechKit = { speak(s){ spoken.push(s); }, cancel(){} };
globalThis.showToast = (s) => calls.push(['toast', s]);
globalThis.setTouchActions = (l) => { touchList = l; };
globalThis.Fx = { debrisBurst(){ calls.push(['debris']); } };
globalThis.sfx = (n) => { calls.push(['sfx', n]); };
globalThis.getBlock = () => 0;
globalThis.isSolid = () => false;
globalThis.groundTop = () => 11;
globalThis.MobCore = { stepMove(){}, hitState(){} };
globalThis.CombatCore = require('../js/combat-core.js');   /* 战斗核心: 真模块(节拍/弹道/命中判定是纯函数) */
globalThis.hashRand = () => 0.13;
globalThis.WORLD_W = 8;
globalThis.WORLD_D = 8;
globalThis.B_NETHERRACK = 30;
globalThis.B_OBSIDIAN = 31;
globalThis.B_LAVA = 25;
globalThis.PLAYER = { height: 1.8, speed: 3, heldItem: 'hoe' };
globalThis.NETHER_GROUND = 20;

/* ---------- fake 怪物库 ---------- */
const mobsState = { spawned: [] };
const hitLog = [];
let listResult = [];
let nextHit = { hp: 10, dead: false, freshDead: false };
globalThis.Mobs = {
  types: { piglin:{name:'猪灵'}, zombified_piglin:{name:'僵尸猪灵'}, piglin_brute:{name:'蛮兵'}, hoglin:{name:'疣猪兽'},
           zoglin:{name:'凋灵骷髅'}, wither_skeleton:{name:'远古守卫者'}, blaze:{name:'烈焰人'}, ghast:{name:'恶魂'}, magma_cube:{name:'岩浆怪'} },
  spawn(type, x, z, opts){ mobsState.spawned.push({ type, x, z, opts }); return { type, pos:{ x, y: 12, z } }; },
  update(){}, render(){},
  hit(m, dmg){ hitLog.push({ m, dmg }); return nextHit; },
  near(){ return []; },
  clear(){ mobsState.spawned.length = 0; },
  list(){ return listResult; },
  face(){ return 'data:'; },
  hasSlot(){ return true; },
  /* 意图 API 桩: 行为与真库一致(位移/面向), 断言不依赖 */
  move(m, dx, dz){ m.pos.x += dx; m.pos.z += dz; },
  shift(m, dx, dz){ m.pos.x += dx; m.pos.z += dz; },
  steer(m, yaw){ m.yaw = yaw; },
  gait(m, dt, sp, atk){ calls.push(['gait', m, sp, atk]); return 0; },
  debrisColor(){ return 0x8a8f98; },
};
globalThis.pos = { x: 62.5, y: 25, z: 85.5, set(){} };
globalThis.vel = { set(){} };
globalThis.flyMode = false;

const NetheMode = require('../js/modes/nether.js');
const DT = 1/60;
const has = (ev) => calls.some(c => c[0] === ev);
const spoke = (kw) => spoken.some(s => String(s).indexOf(kw) >= 0);

/* 走进上界传送门内口(px=61, by=24, pz=88) → 触发 enterNether */
function walkIntoPortal(){
  globalThis.pos.x = 62.5; globalThis.pos.y = 25; globalThis.pos.z = 87.2;
  NetheMode.update(DT);
}
function mkMob(type, x, y, z, extra){
  return Object.assign({
    type, pos: { x, y, z }, dead: false, gone: false, yaw: 0, attackCd: 0, attackT: 0, target: null,
    cfg: { range: 2, cd: 1, dmg: 8, h: 1.8, speed: 2, fly: false, ranged: false, hitR: 0.55 },
  }, extra || {});
}

/* ============ 测试 ============ */

test('下界冒险: init 上界建场(建造模式场景 + 地表黑曜石传送门)+ 玩家出生在家, 不放怪', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  assert.ok(has('basement'), 'init 复用建造模式「巨大地下室」场景(地形暂时一样)');
  assert.ok(calls.some(c => c[0] === 'set' && c[4] === 31), '地表放下界传送门(黑曜石框架 B_OBSIDIAN)');
  assert.ok(has('spawn'), '玩家出生在上界家');
  assert.ok(Array.isArray(touchList) && touchList.length >= 1, '声明了触屏按钮');

  globalThis.pos.x = 62.5; globalThis.pos.y = 25; globalThis.pos.z = 85.5;   /* 家门口站着 */
  NetheMode.update(DT);
  assert.strictEqual(mobsState.spawned.length, 0, '上界不放怪物(主人公平时在上界呆着)');
});

test('下界冒险: 踩进上界传送门 → 进下界(重建下界地形 + 回程传送门 + 释放首波怪物)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();                                       /* 回上界重来 */
  walkIntoPortal();
  assert.ok(spoke('进了下界'), '进下界语音');
  assert.ok(calls.filter(c => c[0] === 'loadScene').length >= 2, '阶段切换先清场(家的草坪/小屋不渗进下界, 反向亦然)');
  assert.ok(calls.some(c => c[0] === 'set' && c[4] === 30), '下界地形用下界岩(B_NETHERRACK)');
  assert.ok(calls.some(c => c[0] === 'set' && c[4] === 31 && c[2] === NETHER_GROUND), '下界建好回程传送门(黑曜石底边在平地上)');
  assert.ok(calls.some(c => c[0] === 'spawn' && c[2] === NETHER_GROUND + 1), '玩家落在回程门前(平地顶层+1)');
  assert.ok(mobsState.spawned.length > 0, '释放首波 hostile 怪物');
  assert.ok(mobsState.spawned.every(s => Object.keys(globalThis.Mobs.types).indexOf(s.type) >= 0), '都是下界怪物');
});

test('下界冒险: 手持锄头挥击 → 命中最近 hostile 怪(近战伤害) → 击杀给碎块和表扬', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();                                       /* 传送落地挥击锁归零 */

  globalThis.pos.x = 21.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;   /* 贴身 */
  listResult = [mkMob('piglin', 21.6, 12, 20.4)];
  nextHit = { hp: 10, dead: false, freshDead: true };
  NetheMode.onMouse(0);
  assert.strictEqual(hitLog.length, 1, '挥击命中了身边的怪');
  assert.strictEqual(hitLog[0].dmg, 10, '锄头近战伤害 10');
  assert.ok(has('debris'), '击杀 → 碎块特效');
  assert.ok(calls.some(c => c[0] === 'toast' && String(c[1]).indexOf('消灭') >= 0), '击杀 → 消灭提示');
});

test('下界冒险: 怪不在挥击距离 → 不出手(不打空)', () => {
  calls.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();

  globalThis.pos.x = 60; globalThis.pos.y = 12; globalThis.pos.z = 60;       /* 远离怪物 */
  listResult = [mkMob('hoglin', 20.5, 12, 20.5)];
  NetheMode.onMouse(0);
  assert.strictEqual(hitLog.length, 0, '距离不够不挥击');
});

test('下界冒险: 一波全灭 → 语音表扬 + 新一波来袭', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  spoken.length = 0; mobsState.spawned.length = 0;

  listResult = [mkMob('hoglin', 20.5, 12, 20.5, { dead: true })];            /* 整波已死 */
  NetheMode.update(DT);
  assert.ok(spoke('新怪物'), '波清空 → 新一波语音');
  assert.ok(mobsState.spawned.length > 0, '新一波怪物释放');
});

test('下界冒险: 怪物近战攻击玩家 → 玩家阵亡 → 回下界出生点重来', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  calls.length = 0; spoken.length = 0;

  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;   /* 怪物就在身边 */
  listResult = [mkMob('zombified_piglin', 20.6, 12, 20.4)];
  nextHit = { hp: 0, dead: true, freshDead: true };
  NetheMode.update(DT);
  assert.ok(has('spawn'), '阵亡 → 重生(回下界出生点)');
  assert.ok(calls.some(c => c[0] === 'spawn' && c[1] === 25.5 && c[2] === NETHER_GROUND + 1 && c[3] === 27.5), '重生点=回程门前');
  assert.ok(spoke('回出生点'), '阵亡语音(零惩罚: 回出生点重来)');
  assert.ok(hitLog.some(h => h.dmg === 8), '怪物按自身 dmg 攻击玩家');
});

test('下界冒险: 飞行炮台(烈焰人/恶魂)投火球 → 火球命中主人公(不是打怪)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  calls.length = 0; spoken.length = 0; hitLog.length = 0;

  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;
  nextHit = { hp: 10, dead: false, freshDead: false };
  listResult = [mkMob('blaze', 20.5, 13, 20.78, {
    cfg: { range: 15, cd: 2.4, dmg: 8, h: 1.8, speed: 2.3, fly: true, ranged: true, hitR: 0.45 },
  })];
  NetheMode.update(DT);                                 /* AI 开火 + 火球飞行一步即命中 */
  assert.ok(hitLog.some(h => h.dmg === 8 && h.m.pos === globalThis.pos), '火球按烈焰人 dmg 命中主人公(受击者=玩家实体)');
});

test('下界冒险: 每帧给活怪喂步态+战斗姿态窗口 — 此前下界怪连走路都不摆腿', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  const live = mkMob('piglin', 40, 12, 40, {});
  const dead = mkMob('hoglin', 41, 12, 41, { dead: true });
  listResult = [live, dead];
  calls.length = 0;
  NetheMode.update(DT);
  const gs = calls.filter(c => c[0] === 'gait');
  assert.strictEqual(gs.filter(c => c[1] === live).length, 1, '活怪每帧喂一次步态(与竞技场同一入口)');
  assert.strictEqual(gs.filter(c => c[1] === dead).length, 0, '死怪不喂');
  assert.ok(gs.every(c => c[3] === 0.5), '带攻击姿态窗口(attackT 满时长 0.5 → 挥臂/头前扑)');
});

test('下界冒险: 下界回程传送门 → 切回上界家', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();                                       /* 已在下界 */
  spoken.length = 0;

  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 24.5;  /* 回程传送门内口(by=20, px=24, pz=24) */
  NetheMode.update(DT);
  assert.ok(spoke('回到上界'), '回程传送门 → 回上界');
  assert.strictEqual(mobsState.spawned.length, 0, '回上界清掉下界怪物');
});
