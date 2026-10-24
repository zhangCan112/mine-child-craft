'use strict';
/* 玩家战斗 kit(js/combat-kit.js, CombatKit)单测 — node --test(零依赖)
   运行: node --test test/combat-kit.test.js
   覆盖: 六件套契约 — mkFighter(字段面+政策注入) · mkHurtAlarm(五要素
   +3s 话术节流) · mkMelee(准星锥门槛/冷却自持/swingOnMiss 口径/磨损与
   击杀回调) · mkArrows(发射→leadAim→stepShot 步进→命中政策回调,
   无 THREE 时无 mesh 纯数据跑) · killBurst(碎块+计数 toast+尾回调) ·
   resetFighter(复活五字段不变量); mkHpBar 断言随 C6-T3 迁件后入册。
   行为面由 test/nether-mode/adventure-mode 既有断言兜底(interface 即
   测试面, C6-T3 切换后零改动即安全网); 判定/步进在 combat-core(另有单测)。
   加载器: vm context 执行 combat-core.js + combat-kit.js, 战斗观感以
   记录桩注入(math-paradigms.test.js 同款分层口径) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCombatKit() {
  const log = {sfx: [], spoken: [], flashes: 0, swings: 0, kicks: 0, debris: 0,
    toasts: [], hits: []};
  let mobs = [];
  let mobHitRes = {freshDead: false};
  const sandbox = {
    console: {warn() {}, log() {}, error() {}},
    Math, JSON, Object, Array, Set, Number, Date, String,
    PLAYER: {height: 1.8, speed: 5.2, heldItem: null},
    pos: {x: 0, y: 10, z: 0, set() {}},
    vel: {x: 0, y: 0, z: 0, set() {}},
    yaw: 0, /* 面朝 -z(fx=0, fz=-1) — 准星锥判定的口径锚 */
    Mobs: {
      list: () => mobs,
      hit: (t, dmg, dx, dz, kpow) => {
        log.hits.push({t, dmg, kpow});
        return mobHitRes;
      },
      debrisColor: () => [1, 0, 0],
    },
    Avatar: {
      flash() {
        log.flashes++;
      },
      swing() {
        log.swings++;
      },
      setItem() {},
    },
    Fx: {
      kick() {
        log.kicks++;
      },
      debrisBurst() {
        log.debris++;
      },
    },
    SpeechKit: {speak: (s) => log.spoken.push(s), cancel() {}},
    sfx: (n) => log.sfx.push(n),
    showToast: (s) => log.toasts.push(s),
    getBlock: () => 0,
    CameraRig: {aim: () => ({origin: {x: 0, y: 2, z: 0}, dir: {x: 0, y: 0, z: -1}})},
    camera: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['combat-core.js', 'combat-kit.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__ck = CombatKit;', ctx);
  return {ck: sandbox.__ck, log,
    setMobs: (list) => {
      mobs = list;
    },
    setMobHitRes: (r) => {
      mobHitRes = r;
    }};
}

const mobAt = (x, z, o) => Object.assign({type: 'zombie', dead: false, gone: false,
  pos: {x, y: 10, z}, cfg: {h: 1.8, hitR: 0.55}}, o || {});
/* 玩家弹专用: 出生高度跟准星(y≈2) */
const mobAtEye = (x, z) => mobAt(x, z, {pos: {x, y: 2, z}});

/* ============ mkFighter ============ */

test('mkFighter: MobCore 字段面齐全, 政策数值注入', () => {
  const d = loadCombatKit();
  const e = d.ck.mkFighter({hp: 30, maxHp: 30, dmg: 16, range: 3.0});
  assert.strictEqual(e.hp, 30);
  assert.strictEqual(e.cfg.dmg, 16, 'cfg.dmg 政策注入(下界剑 16)');
  assert.strictEqual(e.cfg.range, 3.0);
  assert.strictEqual(e.cfg.hitR, 0.55, '盒判定半径与两模式现行同款');
  assert.strictEqual(e.cfg.speed, 5.2, 'PLAYER.speed 基座');
  assert.deepStrictEqual([...e.tintBase], [1, 1, 1]);
  assert.strictEqual(e.dead, false);
  const def = d.ck.mkFighter();
  assert.strictEqual(def.cfg.dmg, 3, '缺省伤害 3(探险空手口径)');
});

/* ============ mkHurtAlarm ============ */

test('mkHurtAlarm: 账本同步+音+闪红+震屏, 话术 3 秒节流', () => {
  const d = loadCombatKit();
  const hpLedger = {hp: 30};
  const alarm = d.ck.mkHurtAlarm({setHp: (v) => {
    hpLedger.hp = v;
  }});
  alarm.hit({hp: 22});
  assert.strictEqual(hpLedger.hp, 22, '账本同步回调');
  assert.strictEqual(d.log.sfx[d.log.sfx.length - 1], 'hurt', '受击专属音');
  assert.strictEqual(d.log.flashes, 1, '身体闪红(主提醒)');
  assert.strictEqual(d.log.kicks, 1, '轻震屏');
  assert.strictEqual(d.log.spoken.length, 1, '受击话术开口');
  alarm.hit({hp: 15});
  assert.strictEqual(d.log.spoken.length, 1, '同窗口第二击只播一句(3s 节流)');
  alarm.tick(3);
  alarm.hit({hp: 8});
  assert.strictEqual(d.log.spoken.length, 2, '窗口过后再开口');
});

/* ============ mkMelee ============ */

test('mkMelee: 准星锥门槛只打面前的怪, 身后不选', () => {
  const d = loadCombatKit();
  d.setMobs([mobAt(0, -2), mobAt(0, 2)]); /* 面前 -z 与身后 +z 各一只 */
  const m = d.ck.mkMelee({aimCos: 0.5, dmg: 7, cooldown: 0.38});
  const p = {pos: {x: 0, y: 10, z: 0}};
  const front = m.aim(p);
  assert.ok(front && front.pos.z === -2, '锥判定选面前的怪(yaw=0 面朝 -z)');
  d.setMobs([mobAt(0, 2)]);
  assert.strictEqual(m.aim(p), null, '只有身后的怪 → 锥内无目标');
});

test('mkMelee: 命中链(伤害函数/磨损/击杀)与冷却自持; swingOnMiss 口径二分', () => {
  const d = loadCombatKit();
  d.setMobs([mobAt(0, -1.5)]);
  d.setMobHitRes({freshDead: true});
  const worn = [];
  const kills = [];
  const m = d.ck.mkMelee({dmg: () => 11, cooldown: 0.38,
    onWear: () => worn.push(1), onKill: (t) => kills.push(t)});
  const p = {pos: {x: 0, y: 10, z: 0}};
  assert.strictEqual(m.swing(p), true, '命中出手');
  assert.strictEqual(d.log.hits[0].dmg, 11, '伤害函数注入(D9 工具表口径)');
  assert.strictEqual(d.log.sfx[d.log.sfx.length - 1], 'hit');
  assert.strictEqual(worn.length, 1, '命中才扣耐久');
  assert.strictEqual(kills.length, 1, 'freshDead → 击杀回调');
  assert.strictEqual(m.swing(p), false, '冷却内不出手');
  m.tick(0.38);
  d.setMobs([]);
  assert.strictEqual(m.swing(p), false, '无目标(探险口径): 不出手不占冷却');
  assert.strictEqual(d.log.swings, 1, '无目标不播挥臂');
  const nether = d.ck.mkMelee({dmg: 16, cooldown: 0.38, swingOnMiss: true});
  nether.swing(p);
  assert.strictEqual(d.log.swings, 2, '下界口径: 无目标也出手观感');
  nether.tick(0.38);
  assert.strictEqual(nether.swing(p), false, '且已占冷却');
});

/* ============ mkArrows ============ */

test('mkArrows: 怪弹发射→步进→命中玩家回调; clear 收场; 无 THREE 纯数据跑', () => {
  const d = loadCombatKit();
  const playerResults = [];
  const arr = d.ck.mkArrows({player: () => ({pos: {x: 0, y: 10, z: -6}, cfg: {h: 1.8, hitR: 0.55},
    dead: false}), onHitPlayer: (res) => playerResults.push(res)});
  const shooter = {pos: {x: 0, y: 10, z: 0}, vel: {x: 0, z: 0}, cfg: {h: 1.8}};
  arr.shootFromMob(shooter, {pos: {x: 0, y: 10, z: -6}, vel: {x: 0, z: 0}, cfg: {h: 1.8}},
      {speed: 20, dmg: 6, kpow: 0.6, g: 0, life: 5});
  assert.strictEqual(arr.count(), 1, '发射入列(无 THREE 无 mesh, 纯数据)');
  assert.strictEqual(d.log.sfx[d.log.sfx.length - 1], 'shoot');
  for (let i = 0; i < 40 && arr.count() && !playerResults.length; i++) arr.update(0.05);
  assert.strictEqual(playerResults.length, 1, '飞到玩家触发命中回调(leadAim 直指)');
  assert.strictEqual(playerResults[0].freshDead, false, 'Mobs.hit 结果透传给政策回调');
  arr.shootFromMob(shooter, {pos: {x: 0, y: 10, z: -6}, vel: {x: 0, z: 0}, cfg: {h: 1.8}},
      {speed: 20, g: 0, life: 0.2});
  for (let i = 0; i < 40 && arr.count(); i++) arr.update(0.05);
  assert.strictEqual(arr.count(), 0, '寿命尽自动移除(不触发政策)');
  arr.shootFromMob(shooter, {pos: {x: 0, y: 10, z: -6}, vel: {x: 0, z: 0}, cfg: {h: 1.8}},
      {speed: 20, g: 0});
  arr.clear();
  assert.strictEqual(arr.count(), 0, 'clear 收全部在场弹(进场/清场纪律)');
});

test('mkArrows: 玩家弹沿准星发射, 打怪分支回调 onHitMob', () => {
  const d = loadCombatKit();
  const mobHits = [];
  d.setMobs([mobAtEye(0, -3)]);
  const arr = d.ck.mkArrows({onHitMob: (m, res) => mobHits.push({m, res})});
  arr.shootFromAim({speed: 20, dmg: 10, kpow: 0.35, g: 0, life: 5});
  assert.strictEqual(arr.count(), 1, '沿 CameraRig.aim 方向入列(fromPlayer)');
  for (let i = 0; i < 40 && arr.count() && !mobHits.length; i++) arr.update(0.05);
  assert.strictEqual(mobHits.length, 1, '玩家弹命中怪 → onHitMob');
  assert.strictEqual(d.log.sfx[d.log.sfx.length - 1], 'hit', '命中音(政策回调前后同拍)');
});

/* ============ killBurst / resetFighter / mkHpBar ============ */

test('killBurst: 碎块 + 计数 toast(动词可注入) + 尾回调', () => {
  const d = loadCombatKit();
  let after = 0;
  d.ck.killBurst(mobAt(3, 4), 5, {verb: '击杀', after: () => {
    after++;
  }});
  assert.strictEqual(d.log.debris, 1, '碎块观感');
  assert.strictEqual(d.log.toasts[d.log.toasts.length - 1], '👾 击杀 5', '计数 toast(探险动词)');
  d.ck.killBurst(mobAt(3, 4), 2);
  assert.strictEqual(d.log.toasts[d.log.toasts.length - 1], '👾 消灭 2', '缺省动词「消灭」(下界/演习场)');
  assert.strictEqual(after, 1, '尾回调挂模式政策(波次/任务/清场)');
});

test('resetFighter: 复活五字段不变量(阵亡去向政策留模式)', () => {
  const d = loadCombatKit();
  const e = d.ck.mkFighter({hp: 30, maxHp: 30});
  e.dead = true; e.deadT = 0.4; e.flashT = 0.3; e.staggerT = 0.2; e.tintBase = [1, 0.2, 0.2];
  d.ck.resetFighter(e);
  assert.strictEqual(e.dead, false);
  assert.strictEqual(e.deadT, 0);
  assert.strictEqual(e.flashT, 0);
  assert.strictEqual(e.staggerT, 0);
  assert.deepStrictEqual([...e.tintBase], [1, 1, 1]);
});

test('mkHpBar: 头顶血条深接口 — 形状齐全 + 无 THREE/DOM 渲染环境静默待命(S2, 自 mode-kit 迁入)', () => {
  const d = loadCombatKit();
  assert.strictEqual(typeof d.ck.mkHpBar, 'function', '挂在 CombatKit 导出');
  const bar = d.ck.mkHpBar();
  assert.strictEqual(typeof bar.update, 'function', 'update 入口');
  assert.strictEqual(typeof bar.dispose, 'function', 'dispose 入口');
  /* Node 单测无 THREE/scene: 惰性创建不炸、不参与行为断言(观感归浏览器) */
  assert.doesNotThrow(() => bar.update(30, 30, 1.5, 27.2, 3.5), '无渲染环境 update 安全');
  assert.doesNotThrow(() => bar.dispose(), '无渲染环境 dispose 安全');
  const vis = d.ck.mkHpBar({visible: () => false});
  assert.doesNotThrow(() => vis.update(10, 30, 0, 0, 0), 'visible 回调口径同安全');
  assert.doesNotThrow(() => vis.dispose());
});
