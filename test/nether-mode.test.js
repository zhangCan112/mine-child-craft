'use strict';
/* 下界冒险模式 (js/modes/nether.js) 单测 — node --test (零依赖)
   运行: node --test test/nether-mode.test.js
   引擎全局(Mobs/Fx/SpeechKit/sfx/…)以 fake 注入(replace-don't-layer),
   只测模式政策: 上界建场 → 传送门进下界 → 挥击击杀 → 波次 → 玩家阵亡 → 回程传送门。
   状态断言全部走行为链(fake 调用记录), 不伸手进模块内部。 */
const test = require('node:test');
const assert = require('node:assert');

function fakeEl() {
  const el = {
    children: [], _cls: new Set(), style: {}, innerHTML: '', textContent: '', dataset: {},
    addEventListener() {}, appendChild(c) {
      this.children.push(c); return c;
    },
    querySelector(sel) {
      if (!this['q_' + sel]) this['q_' + sel] = fakeEl(); return this['q_' + sel];
    },
  };
  Object.defineProperty(el, 'classList', {value: {
    add: (c)=>el._cls.add(c), remove: (c)=>el._cls.delete(c),
    toggle: (c, v)=>{
      const on = (v === undefined) ? !el._cls.has(c) : v; if (on) el._cls.add(c); else el._cls.delete(c);
    },
    contains: (c)=>el._cls.has(c),
  }});
  return el;
}

let fakeClock = 0;
globalThis.performance = {now: () => fakeClock};
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
ModeKit.spawn = (x, y, z, o) => {
  calls.push(['spawn', x, y, z, o]);
};

/* ---------- fake 引擎层(调用期解析的全局名) ---------- */
globalThis.clearWorld = () => {
  calls.push(['clearWorld']);
};
globalThis.rebuildAll = () => {
  calls.push(['rebuild']);
};
globalThis.loadScene = (fn) => {
  calls.push(['loadScene']); fn();
}; /* 场景装填 seam: 清场+建场+收尾重建 */
globalThis.buildBasementScene = () => {
  calls.push(['basement']);
};
globalThis.setBlockRaw = (x, y, z, id) => {
  calls.push(['set', x, y, z, id]);
};
globalThis.SceneKit = {fill() {}, tree() {}, rand: () => 0};
globalThis.SpeechKit = {speak(s) {
  spoken.push(s);
}, cancel() {}};
globalThis.showToast = (s) => calls.push(['toast', s]);
globalThis.setTouchActions = (l) => {
  touchList = l;
};
globalThis.Fx = {debrisBurst() {
  calls.push(['debris']);
}, kick() {
  calls.push(['kick']);
},
portalBeam(x, y, z, o) {
  calls.push(['beam', x, y, z, o]); return {id: calls.length};
},
removeBeam() {
  calls.push(['beamOff']);
}};
globalThis.sfx = (n) => {
  calls.push(['sfx', n]);
};
globalThis.getBlock = () => 0;
globalThis.isSolid = () => false;
globalThis.groundTop = () => 11;
globalThis.MobCore = {stepMove() {}, hitState() {}};
globalThis.CombatCore = require('../js/combat-core.js'); /* 战斗核心: 真模块(节拍/弹道/命中判定是纯函数) */
const RealMobCore = require('../js/mob-core.js'); /* 受击状态机真模块: fake Mobs.hit 对玩家实体套用它(不改血量 → 血量断言无从谈起) */
globalThis.hashRand = () => 0.13;
globalThis.WORLD_W = 8;
globalThis.WORLD_D = 8;
globalThis.B_NETHERRACK = 30;
globalThis.B_OBSIDIAN = 31;
globalThis.B_LAVA = 25;
globalThis.B_NETHER_BRICK = 33;
globalThis.B_GLOWSTONE = 34;
globalThis.B_PORTAL = 35;
globalThis.PLAYER = {height: 1.8, eye: 1.62, speed: 3, heldItem: 'hoe'};
globalThis.Avatar = {setItem(id) {
  calls.push(['setItem', id]);
}, swing() {
  calls.push(['swing']);
},
flash() {
  calls.push(['flash']);
}}; /* 受击闪红(观感, 只记录调用) */
globalThis.NETHER_GROUND = 20;

/* ---------- fake 怪物库 ---------- */
const mobsState = {spawned: []};
const hitLog = [];
let listResult = [];
let nextHit = {hp: 10, dead: false, freshDead: false};
globalThis.Mobs = {
  types: {piglin: {name: '猪灵'}, zombified_piglin: {name: '僵尸猪灵'}, piglin_brute: {name: '蛮兵'}, hoglin: {name: '疣猪兽'},
    zoglin: {name: '凋灵骷髅'}, wither_skeleton: {name: '远古守卫者'}, blaze: {name: '烈焰人'}, ghast: {name: '恶魂'}, magma_cube: {name: '岩浆怪'}},
  spawn(type, x, z, opts) {
    mobsState.spawned.push({type, x, z, opts}); return {type, pos: {x, y: 12, z}};
  },
  update() {}, render() {},
  hit(m, dmg) {
    hitLog.push({m, dmg});
    if (m.pos === globalThis.pos) RealMobCore.hitState(m, dmg); /* 玩家实体走真实受击状态机(分支结果仍由 nextHit 脚本控制) */
    return nextHit;
  },
  near() {
    return [];
  },
  clear() {
    mobsState.spawned.length = 0;
  },
  list() {
    return listResult;
  },
  face() {
    return 'data:';
  },
  hasSlot() {
    return true;
  },
  /* 意图 API 桩: 行为与真库一致(位移/面向), 断言不依赖 */
  move(m, dx, dz) {
    m.pos.x += dx; m.pos.z += dz;
  },
  shift(m, dx, dz) {
    m.pos.x += dx; m.pos.z += dz;
  },
  steer(m, yaw) {
    m.yaw = yaw;
  },
  gait(m, dt, sp, atk) {
    calls.push(['gait', m, sp, atk]); return 0;
  },
  debrisColor() {
    return 0x8a8f98;
  },
};
globalThis.pos = {x: 62.5, y: 25, z: 85.5, set() {}};
globalThis.vel = {set() {}};
globalThis.flyMode = false;

/* 真 CameraRig(独立 vm 桥接挂全局): 射箭曾用富 fake(自造 lookDir)藏住
   "真模块没导出该方法"的接口谎言 → 实机一点就抛异常箭没射出。改挂真模块:
   nether 再调不存在的方法, 单测当场红 — fake 接口不得比真模块富。 */
{
  const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
  const v3 = function(x, y, z) {
    this.x = x || 0; this.y = y || 0; this.z = z || 0;
    this.set = (a, b, c)=>{
      this.x = a; this.y = b; this.z = c; return this;
    };
    this.applyQuaternion = ()=> this; this.length = ()=> 1;
  };
  const bridge = {
    THREE: {Vector3: v3},
    pos: globalThis.pos, PLAYER: globalThis.PLAYER, camera: {position: {x: 0, y: 0, z: 0}},
    get yaw() {
      return globalThis.yaw;
    }, set yaw(v) {
      globalThis.yaw = v;
    },
    get pitch() {
      return globalThis.pitch;
    }, set pitch(v) {
      globalThis.pitch = v;
    },
  };
  vm.createContext(bridge);
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'camera-rig.js'), 'utf8') +
      '\n;this.CameraRig = CameraRig;', bridge, {filename: 'camera-rig.js'});
  globalThis.CameraRig = bridge.CameraRig;
  globalThis.yaw = 0; globalThis.pitch = 0; /* 准星朝正北(射箭用例的弹道方向) */
  globalThis.camera = bridge.camera; /* 相机全局(world.js 在浏览器提供) */
}

const NetheMode = require('../js/modes/nether.js');
const DT = 1/60;
const has = (ev) => calls.some((c) => c[0] === ev);
const spoke = (kw) => spoken.some((s) => String(s).indexOf(kw) >= 0);

/* 走进上界传送门内口(px=61, by=24, pz=90) → 触发 enterNether */
function walkIntoPortal() {
  globalThis.pos.x = 62.5; globalThis.pos.y = 25; globalThis.pos.z = 89.2;
  NetheMode.update(DT);
}
/* 烧完传送冷却(0.8s ≈ 60 帧): 传送后立刻踩另一座门的用例, 先等"时空眩晕"过去 */
function burnCd() {
  listResult = []; for (let i = 0; i < 70; i++) NetheMode.update(DT);
}
function mkMob(type, x, y, z, extra) {
  return Object.assign({
    type, pos: {x, y, z}, dead: false, gone: false, yaw: 0, attackCd: 0, attackT: 0, target: null,
    cfg: {range: 2, cd: 1, dmg: 8, h: 1.8, speed: 2, fly: false, ranged: false, hitR: 0.55},
  }, extra || {});
}

/* ============ 测试 ============ */

test('下界冒险: init 上界建场(建造模式场景 + 地表霸气传送门)+ 玩家出生在家, 不放怪', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  assert.ok(has('basement'), 'init 复用建造模式「巨大地下室」场景(地形暂时一样)');
  assert.ok(calls.some((c) => c[0] === 'set' && c[4] === 31), '地表放下界传送门(黑曜石框架 B_OBSIDIAN)');
  assert.ok(calls.some((c) => c[0] === 'set' && c[4] === 35), '内口填传送门面(B_PORTAL 紫色可穿入门面)');
  assert.ok(calls.some((c) => c[0] === 'set' && c[4] === 34), '发光岩点缀(塔楼压顶/门楣顶心/开口四角)');
  assert.ok(calls.some((c) => c[0] === 'set' && c[4] === 33), '门前下界砖步道');
  assert.ok(has('beam'), '门中紫色光束锚定(Fx.portalBeam, 特效唯一入口)');
  assert.ok(calls.some((c) => c[0] === 'beam' && c[1] === 61 + 3 && c[2] === 25 && c[3] === 90.5),
      '光束锚在开口中心(px=61 门 6 宽 → 中心 x=64, 底高 by+1, 门面 z+0.5)');
  assert.ok(calls.some((c) => c[0] === 'spawn' && c[3] === 85.5 && c[4] && c[4].yaw === 0),
      '上界落点面朝房子背对门(yaw 0) — 落地推前进只会走离门口, 不会一头弹回下界');
  assert.ok(has('spawn'), '玩家出生在上界家');
  assert.ok(Array.isArray(touchList) && touchList.length >= 1, '声明了触屏按钮');

  globalThis.pos.x = 62.5; globalThis.pos.y = 25; globalThis.pos.z = 85.5; /* 家门口站着 */
  NetheMode.update(DT);
  assert.strictEqual(mobsState.spawned.length, 0, '上界不放怪物(主人公平时在上界呆着)');
});

test('下界冒险: 踩进上界传送门 → 进下界(重建下界地形 + 回程传送门 + 释放首波怪物)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init(); /* 回上界重来 */
  walkIntoPortal();
  assert.ok(spoke('进了下界'), '进下界语音');
  assert.ok(calls.filter((c) => c[0] === 'loadScene').length >= 2, '阶段切换先清场(家的草坪/小屋不渗进下界, 反向亦然)');
  assert.ok(calls.some((c) => c[0] === 'set' && c[4] === 30), '下界地形用下界岩(B_NETHERRACK)');
  assert.ok(calls.some((c) => c[0] === 'set' && c[4] === 31 && c[2] === NETHER_GROUND), '下界建好回程传送门(黑曜石底边在平地上)');
  assert.ok(calls.some((c) => c[0] === 'set' && c[4] === 35 && c[2] === NETHER_GROUND + 1), '回程门内口也有紫色门面(底边上一层起填到顶)');
  assert.ok(calls.filter((c) => c[0] === 'beam').length >= 2 &&
      calls.some((c) => c[0] === 'beam' && c[1] === 24 + 3 && c[3] === 24.5),
  '光束随阶段重锚到回程门开口中心(px=24 → x=27, pz=24 → z=24.5)');
  assert.ok(calls.some((c) => c[0] === 'spawn' && c[2] === NETHER_GROUND + 1), '玩家落在回程门前(平地顶层+1)');
  assert.ok(mobsState.spawned.length > 0, '释放首波 hostile 怪物');
  assert.ok(mobsState.spawned.every((s) => Object.keys(globalThis.Mobs.types).indexOf(s.type) >= 0), '都是下界怪物');
});

test('下界冒险: 霸气外观升级不破坏传送判定 — 判定只认内口区间(塔楼旁/门后/门楣顶都不传送)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  const noTp = (x, y, z) => {
    spoken.length = 0;
    globalThis.pos.x = x; globalThis.pos.y = y; globalThis.pos.z = z;
    NetheMode.update(DT);
    return !spoke('进了下界');
  };
  assert.ok(noTp(60.4, 25, 89.4), '塔楼旁(框架左外侧, x 未过 px)不传送');
  assert.ok(noTp(67.5, 25, 89.4), '框架右外侧(过内口 x 上界)不传送');
  assert.ok(noTp(63.5, 25, 92.6), '门后绕行(z 距门面超 1.5 格)不传送');
  assert.ok(noTp(63.5, 34, 89.5), '站上门楣顶(高出内口 y 区间)不传送');
  spoken.length = 0;
  walkIntoPortal(); /* 踏进内口 → 传送(对照面) */
  assert.ok(spoke('进了下界'), '踏进内口即传送(判定与外观件解耦, 语义不回归)');
});

test('下界冒险: 持剑挥击 → 命中最近 hostile 怪(近战伤害) → 击杀给碎块和表扬', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal(); /* 传送落地挥击锁归零(已换剑) */

  globalThis.pos.x = 21.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5; /* 贴身 */
  listResult = [mkMob('piglin', 21.6, 12, 20.4)];
  nextHit = {hp: 10, dead: false, freshDead: true};
  NetheMode.onMouse(0);
  assert.strictEqual(hitLog.length, 1, '挥击命中了身边的怪');
  assert.strictEqual(hitLog[0].dmg, 16, '剑近战伤害 16(锄头 10 → 换剑变强)');
  assert.ok(has('swing'), '出手带挥臂观感(触屏 👾 按钮同样有)');
  assert.ok(has('debris'), '击杀 → 碎块特效');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('消灭') >= 0), '击杀 → 消灭提示');
});

test('下界冒险: 怪不在挥击距离 → 不出手(不打空)', () => {
  calls.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();

  globalThis.pos.x = 60; globalThis.pos.y = 12; globalThis.pos.z = 60; /* 远离怪物 */
  listResult = [mkMob('hoglin', 20.5, 12, 20.5)];
  NetheMode.onMouse(0);
  assert.strictEqual(hitLog.length, 0, '距离不够不挥击');
});

test('下界冒险: 剑的触及 3.0 格 — 2.5 格外的怪也够得着(此前 meleeR 1.8 反被近战怪先手)', () => {
  calls.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  hitLog.length = 0;

  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;
  listResult = [mkMob('hoglin', 23, 12, 20.5)]; /* 距离 2.5: 旧 1.8 够不着, 剑触及 3.0 内 */
  nextHit = {hp: 40, dead: false, freshDead: false};
  NetheMode.onMouse(0);
  assert.strictEqual(hitLog.length, 1, '2.5 格外的怪在剑触及内(原版玩家攻击距离口径 3.0)');
});

test('下界冒险: 进下界换剑, 回上界/退出模式换回锄头(默认手持物)', () => {
  calls.length = 0; listResult = [];
  NetheMode.init();
  assert.ok(calls.some((c) => c[0] === 'setItem' && c[1] === 'hoe'), 'init 进上界: 装配默认手持物(锄头)');
  walkIntoPortal();
  assert.ok(calls.some((c) => c[0] === 'setItem' && c[1] === 'sword'), '进下界: 换剑');
  burnCd(); /* 传送冷却 0.8s: 立刻踩回程门要等眩晕过去 */
  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 24.5; /* 回程门内口 */
  NetheMode.update(DT);
  assert.ok(spoke('回到上界'), '回程传送门 → 回上界');
  const last = calls.filter((c) => c[0] === 'setItem').pop();
  assert.ok(last && last[1] === 'hoe', '回上界: 换回默认手持物(锄头)');
  calls.length = 0;
  NetheMode.cleanup();
  assert.ok(calls.some((c) => c[0] === 'setItem' && c[1] === 'hoe'), '退出模式复位(Avatar 跨模式存活, 剑不渗进其他模式)');
});

test('下界冒险: 武器栏(⚔️剑/🏹弓) — 数字键切弓, 点击射箭按弹道命中前方怪', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  globalThis.yaw = 0; globalThis.pitch = 0; /* 准星朝正北(真 CameraRig 消费) */
  NetheMode.init();
  walkIntoPortal();
  calls.length = 0; hitLog.length = 0;

  assert.ok(NetheMode.hotbar && NetheMode.hotbar.items.length === 2, '武器栏两槽: 剑/弓(mkHotbar, 数字键/滚轮/点选)');
  NetheMode.onDigit(2); /* 数字键 2 → 弓槽 */
  assert.ok(calls.some((c) => c[0] === 'setItem' && c[1] === 'bow'), '切弓: Avatar 装配弓(手持物注册表)');

  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;
  listResult = [mkMob('piglin', 20.5, 12, 14.5)]; /* 正北 6 格, 站在准星线上 */
  nextHit = {hp: 14, dead: false, freshDead: false};
  NetheMode.onMouse(0); /* 点击 = 射箭(远程) */
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'shoot'), '射箭音');
  assert.strictEqual(hitLog.length, 0, '点击瞬间不结算 — 箭要飞过去(近战才是即时判定)');
  NetheMode.onMouse(0); /* 冷却内连点 */
  assert.strictEqual(calls.filter((c) => c[0] === 'sfx' && c[1] === 'shoot').length, 1, '弓冷却内连点只射一箭');
  for (let i = 0; i < 40 && hitLog.length === 0; i++) NetheMode.update(DT); /* 箭飞 ~0.3 秒 */
  assert.ok(hitLog.some((h) => h.dmg === 10), '箭按重力弹道命中 6 格外的怪(远程伤害 10)');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'hit'), '箭命中音(与怪受击同款)');

  calls.length = 0;
  NetheMode.onDigit(1); /* 数字键 1 → 剑槽 */
  const last = calls.filter((c) => c[0] === 'setItem').pop();
  assert.ok(last && last[1] === 'sword', '切回剑(近战位)');
});

test('下界冒险: 一波全灭 → 语音表扬 + 新一波来袭', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  spoken.length = 0; mobsState.spawned.length = 0;

  listResult = [mkMob('hoglin', 20.5, 12, 20.5, {dead: true})]; /* 整波已死 */
  NetheMode.update(DT);
  assert.ok(spoke('新怪物'), '波清空 → 新一波语音');
  assert.ok(mobsState.spawned.length > 0, '新一波怪物释放');
});

test('下界冒险: 怪物近战攻击玩家 → 玩家阵亡 → 回家(地下室)满血重来', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  calls.length = 0; spoken.length = 0;

  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5; /* 怪物就在身边 */
  listResult = [mkMob('zombified_piglin', 20.6, 12, 20.4)];
  nextHit = {hp: 0, dead: true, freshDead: true};
  NetheMode.update(DT);
  assert.ok(has('spawn'), '阵亡 → 重生');
  assert.ok(spoke('回到上界'), '阵亡 → 切地图回上界(地下室)');
  assert.ok(calls.some((c) => c[0] === 'spawn' && c[1] === 62.5 && c[2] === 25 && c[3] === 85.5), '重生点=上界家门口(被送回家)');
  assert.ok(spoke('回家休息'), '阵亡语音(回家休整, 不在下界原地被围殴)');
  assert.ok(hitLog.some((h) => h.dmg === 8), '怪物按自身 dmg 攻击玩家');
  assert.ok(!calls.some((c) => c[0] === 'sfx' && c[1] === 'hurt'), '致命一击不播受击音(死亡路径已有引擎 death 音)');
  assert.ok(!calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('被打中') >= 0), '致命一击走死亡文案, 受击提醒不抢戏');
});

test('下界冒险: 被怪物打中(非致命) → 受击音+震屏+剩血提醒, 语音 3 秒节流', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  calls.length = 0; spoken.length = 0; hitLog.length = 0;

  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5; /* 两只近战怪贴身 */
  nextHit = {hp: 22, dead: false, freshDead: false};
  listResult = [mkMob('piglin', 20.6, 12, 20.4), mkMob('zombified_piglin', 20.4, 12, 20.6)];
  NetheMode.update(DT); /* 同帧各打一下 */
  assert.strictEqual(hitLog.length, 2, '两只怪都命中玩家');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'hurt'), '受击音 hurt(与主人公打怪的 hit 区分)');
  assert.ok(has('kick'), '受击震屏');
  assert.ok(has('flash'), '受击主提醒: 主人公身体变红(Avatar.flash)');
  assert.ok(!calls.some((c) => c[0] === 'toast' && String(c[1]).indexOf('剩') >= 0), '剩血 toast 退役: 头顶血条常驻可见');
  assert.strictEqual(spoken.filter((s) => String(s).indexOf('快躲开') >= 0).length, 1, '语音 3 秒节流: 同帧两击只播一句');
});

test('下界冒险: 飞行炮台(烈焰人/恶魂)投火球 → 火球命中主人公(不是打怪)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  calls.length = 0; spoken.length = 0; hitLog.length = 0;

  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;
  nextHit = {hp: 10, dead: false, freshDead: false};
  listResult = [mkMob('blaze', 20.5, 13, 20.78, {
    cfg: {range: 15, cd: 2.4, dmg: 8, h: 1.8, speed: 2.3, fly: true, ranged: true, hitR: 0.45},
  })];
  NetheMode.update(DT); /* AI 开火 + 火球飞行一步即命中 */
  assert.ok(hitLog.some((h) => h.dmg === 8 && h.m.pos === globalThis.pos), '火球按烈焰人 dmg 命中主人公(受击者=玩家实体)');
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'hurt'), '火球命中 → 受击音(与打怪 hit 区分)');
  assert.ok(has('flash'), '火球命中 → 身体变红(受击主提醒)');
  assert.ok(spoke('快躲开'), '受击语音');
});

test('下界冒险: 每帧给活怪喂步态+战斗姿态窗口 — 此前下界怪连走路都不摆腿', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  const live = mkMob('piglin', 40, 12, 40, {});
  const dead = mkMob('hoglin', 41, 12, 41, {dead: true});
  listResult = [live, dead];
  calls.length = 0;
  NetheMode.update(DT);
  const gs = calls.filter((c) => c[0] === 'gait');
  assert.strictEqual(gs.filter((c) => c[1] === live).length, 1, '活怪每帧喂一次步态(与竞技场同一入口)');
  assert.strictEqual(gs.filter((c) => c[1] === dead).length, 0, '死怪不喂');
  assert.ok(gs.every((c) => c[3] === 0.5), '带攻击姿态窗口(attackT 满时长 0.5 → 挥臂/头前扑)');
});

test('下界冒险: 下界回程传送门 → 切回上界家', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal(); /* 已在下界 */
  burnCd(); /* 传送冷却 0.8s: 立刻踩回程门要等眩晕过去 */
  spoken.length = 0;

  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 24.5; /* 回程传送门内口(by=20, px=24, pz=24) */
  NetheMode.update(DT);
  assert.ok(spoke('回到上界'), '回程传送门 → 回上界');
  assert.strictEqual(mobsState.spawned.length, 0, '回上界清掉下界怪物');
});

test('下界冒险: 传送落点离门 ≥5 格 + 阵亡送回家 — 门前混战被击退两步不会弹回门里', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal(); /* 进下界: 落点 = 下界基地 */
  const landing = calls.filter((c) => c[0] === 'spawn' && c[2] === NETHER_GROUND + 1).pop();
  assert.ok(landing && landing[3] - 24 >= 5, '下界落点离门面 ≥5 格(判定缘 z<25.5, 落点 z=30.5)');
  /* 阵亡 → 自动回地下室(上界家门口), 不在下界原地重生 */
  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;
  listResult = [mkMob('zombified_piglin', 20.6, 12, 20.4)];
  nextHit = {hp: 0, dead: true, freshDead: true};
  calls.length = 0; spoken.length = 0;
  NetheMode.update(DT);
  const rebirth = calls.filter((c) => c[0] === 'spawn').pop();
  assert.ok(rebirth && rebirth[1] === 62.5 && rebirth[3] === 85.5, '阵亡重生点 = 上界家门口(自动回地下室)');
  assert.ok(!spoke('进了下界'), '回家落地不会顺带弹进家门');
});

test('下界冒险: 传送跨维度清掉飞行中的投射物 — 残留火球不追进门把人打死在上界(地下室复活根因)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();
  burnCd(); /* 传送冷却 0.8s 先烧掉 */
  calls.length = 0; spoken.length = 0;

  /* 烈焰人朝下界基地的玩家直射一发火球(弹道直指玩家身体) */
  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 30.5;
  listResult = [mkMob('blaze', 25.5, 23, 23.5, {
    cfg: {range: 15, cd: 2.4, dmg: 8, h: 1.8, speed: 2.3, fly: true, ranged: true, hitR: 0.45},
  })];
  NetheMode.update(DT);
  assert.ok(calls.some((c) => c[0] === 'sfx' && c[1] === 'shoot'), '烈焰人射出火球');

  /* 玩家此刻踏进回程门 → 回上界(火球还在半路) */
  listResult = [];
  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 24.5;
  NetheMode.update(DT);
  assert.ok(spoke('回到上界'), '回程传送门 → 回上界');

  /* 回到火球弹道上的老位置站 1.5 秒 — 火球若跨了维度, ~0.4 秒内必命中 */
  calls.length = 0; spoken.length = 0; hitLog.length = 0;
  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 30.5;
  for (let i = 0; i < 90; i++) NetheMode.update(DT);
  assert.ok(!calls.some((c) => c[0] === 'sfx' && c[1] === 'hurt'), '残留火球没跨维度追击(传送即清)');
  assert.ok(!spoke('回出生点'), '上界不会被残留火球打死 → 不会"重生在地下室土里"');
});

test('下界冒险: 阵亡 → 被送回家 — 那波怪清掉、切地图回地下室(不在下界原地重生被围殴)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();

  /* 两只怪贴身(模拟追杀现场)把玩家打死 */
  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 30.5;
  listResult = [mkMob('piglin', 25.6, 21, 30.4), mkMob('hoglin', 25.4, 21, 30.6)];
  nextHit = {hp: 0, dead: true, freshDead: true};
  calls.length = 0; spoken.length = 0;
  NetheMode.update(DT);
  assert.ok(spoke('回到上界'), '阵亡 → 切地图回上界(地下室)');
  assert.ok(spoke('回家休息'), '阵亡语音(回家休整)');
  assert.strictEqual(mobsState.spawned.length, 0, '那波怪随回家清场(下界不残留)');
  const rebirth = calls.filter((c) => c[0] === 'spawn').pop();
  assert.ok(rebirth && rebirth[1] === 62.5 && rebirth[3] === 85.5, '重生点 = 上界家门口');
  assert.ok(!spoke('打得漂亮'), '阵亡不算"波清空表扬"');
});

test('下界冒险: 回上界家休整 — 生命回满(空血进下界的"落地即死"循环断根)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0; hitLog.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal();

  /* 自足复位: 阵亡一次(死亡=回家并回满血, 不依赖此前测试的血量残留) */
  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;
  listResult = [mkMob('piglin', 20.6, 12, 20.4)];
  nextHit = {hp: 0, dead: true, freshDead: true};
  NetheMode.update(DT); /* → 回上界家中, 满血 */
  assert.ok(spoke('回家休息'), '阵亡回家(顺带验证)');

  /* 再进下界(cd 先烧掉) → 非致命受击 → 22/30(HUD 读玩家实体血量, 经 updateHud
     落进 fake hud 元素) */
  burnCd();
  globalThis.pos.x = 62.5; globalThis.pos.y = 25; globalThis.pos.z = 89.2;
  listResult = [];
  NetheMode.update(DT); /* 家门 → 再进下界 */
  burnCd();
  nextHit = {hp: 22, dead: false, freshDead: false};
  globalThis.pos.x = 20.5; globalThis.pos.y = 12; globalThis.pos.z = 20.5;
  listResult = [mkMob('hoglin', 20.4, 12, 20.6)];
  NetheMode.update(DT);
  fakeClock += 200; NetheMode.updateHud(null); /* 拨快假时钟绕过 10Hz 节流 */
  assert.ok(String(elCache['hud'].innerHTML).indexOf('生命: 22') >= 0, '受伤后 22/30');

  /* 走回程门回家 → 休整回满 */
  listResult = [];
  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 24.5;
  NetheMode.update(DT);
  assert.ok(spoke('回到上界'), '回了家');
  fakeClock += 200; NetheMode.updateHud(null);
  assert.ok(String(elCache['hud'].innerHTML).indexOf('生命: 30') >= 0, '回家休整: 生命回满(家是安全的)');
});

test('下界冒险: 传送冷却 0.8 秒 — 落地瞬间推着摇杆撞进另一座门不会弹回(实测"回不到地下室"根因)', () => {
  calls.length = 0; spoken.length = 0; mobsState.spawned.length = 0;
  listResult = [];
  NetheMode.init();
  walkIntoPortal(); /* 进下界, 落地即"时空眩晕" 0.8s */
  spoken.length = 0;

  /* 眩晕中立刻踩进回程门 → 不触发(此前: 落地推前进 3 格即撞家门, 秒弹回下界) */
  globalThis.pos.x = 25.5; globalThis.pos.y = 21; globalThis.pos.z = 24.5;
  NetheMode.update(DT);
  assert.ok(!spoke('回到上界'), '眩晕中踩门不弹回');

  /* 眩晕过去后人还在门口 → 正常触发 */
  for (let i = 0; i < 70; i++) NetheMode.update(DT);
  assert.ok(spoke('回到上界'), '眩晕结束仍在门口 → 正常回上界');
});
