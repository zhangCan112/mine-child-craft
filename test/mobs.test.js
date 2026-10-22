"use strict";
/* 怪物库 (js/mobs.js) 壳层单测 — node --test (零依赖)
   运行: node --test test/mobs.test.js
   通过 interface 驱动(spawn/update/hit/near/clear — 界面即测试面):
   出厂契约(战斗节拍置零)/ 数值 / 受击死亡 / 圆域查询 / 尸体回收。
   THREE 以最小桩注入: 加载期只 new 矩阵临时量, 断言不依赖其语义。 */
const test = require('node:test');
const assert = require('node:assert');

/* ---- 最小 THREE 桩(链式 no-op: render 的临时量, 不参与断言) ---- */
function mk(){ return { set(){ return this; }, compose(){ return this; }, multiplyMatrices(){ return this; },
  setFromEuler(){ return this; }, setFromAxisAngle(){ return this; }, fromArray(){ return this; },
  setRGB(){}, setScalar(){ return this; } }; }
globalThis.THREE = {
  Matrix4: function(){ return mk(); }, Quaternion: function(){ return mk(); },
  Euler: function(){ return mk(); },
  Vector3: function(x, y, z){ this.x = x || 0; this.y = y || 0; this.z = z || 0; },
  Color: function(){ return mk(); },
  MeshLambertMaterial: function(){}, DynamicDrawUsage: 1,
  InstancedMesh: function(){
    this.instanceMatrix = { setUsage(){}, needsUpdate: false };
    this.instanceColor = null; this.count = 0; this.frustumCulled = true;
    this.setMatrixAt = () => {}; this.setColorAt = () => { this.instanceColor = { needsUpdate: false }; };
    this.dispose = () => {};
  },
};
globalThis.scene = { add(){}, remove(){} };
const sfxLog = [];
globalThis.sfx = (n) => { sfxLog.push(n); };
globalThis.MobCore = require('../js/mob-core.js');
globalThis.groundTop = () => 11;            /* 平地: 出生 y=12, 飞行巡航 y=17 */
globalThis.getBlock = () => 0;
globalThis.isSolid = () => false;
globalThis.MOB_TYPES = {
  zombie: {name:'僵尸',   hp:30, dmg:5, speed:2.3, range:2.1, cd:1.1, h:1.9, hitR:0.55},
  blaze:  {name:'烈焰人', hp:30, dmg:8, speed:2.3, range:15,  cd:2.4, h:1.8, fly:true, ranged:true, hitR:0.45},
  mix:    {name:'混合编队', hp:0, dmg:0, speed:0, range:0, cd:0, h:2},
};

const Mobs = require('../js/mobs.js');

/* ============ 测试 ============ */

test('怪物库: spawn 出厂即战斗就绪 — attackCd/attackT/target 已置零(下界永不攻击的回归钉)', () => {
  Mobs.clear();
  const m = Mobs.spawn('zombie', 10, 10, {});
  assert.strictEqual(m.attackCd, 0, 'attackCd 引擎置零(曾因模式漏初始化 → undefined<=0 恒 false, 怪物永不攻击)');
  assert.strictEqual(m.attackT, 0, 'attackT 引擎置零');
  assert.strictEqual(m.target, null, 'target 引擎置空');
  Mobs.clear();
});

test('怪物库: spawn 数值契约 — hp/maxHp 按表 · hpMult 生效 · 地面贴顶/飞行巡航', () => {
  Mobs.clear();
  const g = Mobs.spawn('zombie', 10, 10, {});
  assert.strictEqual(g.hp, 30); assert.strictEqual(g.maxHp, 30);
  assert.strictEqual(g.pos.y, 12, '地面怪出生在 groundTop+1');
  const b = Mobs.spawn('blaze', 12, 12, {});
  assert.strictEqual(b.pos.y, 18, '飞行怪缺省巡航 = 站立面(groundTop+1)+6');
  const b2 = Mobs.spawn('blaze', 14, 14, { flyY: 15 });
  assert.strictEqual(b2.pos.y, 15, 'flyY 覆盖巡航高度');
  const elite = Mobs.spawn('zombie', 16, 16, { hpMult: 2 });
  assert.strictEqual(elite.hp, 60); assert.strictEqual(elite.maxHp, 60);
  assert.strictEqual(Mobs.list().length, 4, '实例数组私有, list() 只读可见');
  Mobs.clear();
});

test('怪物库: hit 扣血 → 归零死亡只结算一次 + 死亡音; 尸体血量不再下降', () => {
  Mobs.clear(); sfxLog.length = 0;
  const m = Mobs.spawn('zombie', 10, 10, {});
  let r = Mobs.hit(m, 10, 1, 0, 0.5);
  assert.strictEqual(r.hp, 20); assert.strictEqual(r.freshDead, false);
  assert.strictEqual(sfxLog.length, 0, '未死不播死亡音');
  r = Mobs.hit(m, 25, 1, 0, 0.5);
  assert.strictEqual(r.hp, 0); assert.strictEqual(r.dead, true); assert.strictEqual(r.freshDead, true, '首次归零');
  assert.ok(sfxLog.indexOf('death') >= 0, '死亡音收在怪物库');
  r = Mobs.hit(m, 99, 1, 0, 0.5);
  assert.strictEqual(r.freshDead, false, '补刀不重复结算');
  assert.strictEqual(r.hp, 0, '尸体血量封底');
  Mobs.clear();
});

test('怪物库: near 圆域查询 — 半径 · 高度门 · 死亡/移除过滤', () => {
  Mobs.clear();
  const a = Mobs.spawn('zombie', 10, 10, {});
  const d = Mobs.spawn('zombie', 30, 30, {});
  Mobs.hit(d, 99, 0, 0, 0);                          /* 击杀 → dead */
  let out = Mobs.near(10, 10, 3, 12, 2);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0], a, '近处活怪命中');
  assert.strictEqual(Mobs.near(10, 10, 3, 40, 2).length, 0, '高度差超门控');
  assert.strictEqual(Mobs.near(10, 10, 1).length, 1, '不传高度门时只看半径');
  Mobs.clear();
});

test('怪物库: 死亡时序 — update 推进 deadT, 超时回收(实例数组原地收缩)', () => {
  Mobs.clear();
  const m = Mobs.spawn('zombie', 10, 10, {});
  Mobs.hit(m, 99, 0, 0, 0);
  const before = Mobs.list();
  for(let i=0; i<26; i++) Mobs.update(0.1);          /* 2.6s > 2.4s 回收线 */
  assert.strictEqual(Mobs.list().length, 0, '尸体超时回收');
  assert.strictEqual(before.length, 0, 'list() 返回内部引用, 回收立即可见');
  Mobs.clear();
});
