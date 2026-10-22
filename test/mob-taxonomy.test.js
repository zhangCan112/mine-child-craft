'use strict';
/* 怪物谱系数据完整性 — node --test (零依赖)
   运行: node --test test/mob-taxonomy.test.js
   在共享 vm 词法环境里按浏览器顺序加载 config.js + mobs.js(镜像 boot.test 的
   加载方式与 mobs.test 的 THREE 桩), 对谱系数据做完整性/语义钉:
   · 完整性: 每个可部署怪 proto 合法 · family 键全注册 · 每怪必归种族(无兜底族)
   · 语义钉: 僵尸猪灵/僵尸疣猪兽主族=猪猪一家带僵尸血统(一身两族) · 草木族/守卫组归组
   · 分组查询: Mobs.families() 11 种族 · 37 怪各归一桶 · 顺序按 FAMILIES.order */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---- 最小 THREE 桩(加载期不触发, 保守提供 — 镜像 mobs.test) ---- */
function mk() {
  return {set() {
    return this;
  }, compose() {
    return this;
  }, multiplyMatrices() {
    return this;
  },
  setFromEuler() {
    return this;
  }, setFromAxisAngle() {
    return this;
  }, fromArray() {
    return this;
  },
  setRGB() {}, setScalar() {
    return this;
  }};
}
const sandbox = {
  console: {log() {}, warn() {}, error() {}},
  THREE: {
    Matrix4: function() {
      return mk();
    }, Quaternion: function() {
      return mk();
    },
    Euler: function() {
      return mk();
    },
    Vector3: function(x, y, z) {
      this.x = x || 0; this.y = y || 0; this.z = z || 0;
    },
    Color: function() {
      return mk();
    },
    MeshLambertMaterial: function() {}, DynamicDrawUsage: 1,
    InstancedMesh: function() {
      this.instanceMatrix = {setUsage() {}, needsUpdate: false};
      this.instanceColor = null; this.count = 0; this.frustumCulled = true;
      this.setMatrixAt = () => {}; this.setColorAt = () => {
        this.instanceColor = {needsUpdate: false};
      };
      this.dispose = () => {};
    },
  },
  scene: {add() {}, remove() {}},
  sfx() {}, performance: {now: () => 0},
  MobCore: require('../js/mob-core.js'),
  groundTop: () => 11, getBlock: () => 0, isSolid: () => false,
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
const ROOT = path.join(__dirname, '..');
for (const f of ['js/config.js', 'js/mobs.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
}
const MOB_TYPES = vm.runInContext('MOB_TYPES', ctx);
const FAMILIES = vm.runInContext('FAMILIES', ctx);
const PROTOS = vm.runInContext('PROTOS', ctx);
const Mobs = vm.runInContext('Mobs', ctx);
const famKeys = Object.keys(FAMILIES); /* 全部注册键(无兜底伪族) */

test('谱系完整性: 每个可部署怪 proto 合法 · family 键全注册 · 每怪必归种族(无兜底族)', () => {
  for (const k of Mobs.spawnable()) {
    const def = MOB_TYPES[k];
    assert.ok(PROTOS.includes(def.proto), k + ' 的 proto 应是合法模板, 实为 ' + def.proto);
    assert.ok(Array.isArray(def.family) && def.family.length > 0,
        k + ' 必须归种族(独行侠已撤, 单员族合法)');
    for (const f of def.family) {
      assert.ok(famKeys.includes(f), k + ' 引用了未注册族 ' + f);
    }
  }
});

test('谱系完整性: mix 伪类型不带谱系(它只是编队按钮, 不是怪)', () => {
  const m = MOB_TYPES.mix;
  assert.ok(!m.family || m.family.length === 0, 'mix 不应带 family');
  assert.ok(!m.proto, 'mix 不应带 proto');
});

test('谱系语义钉: 僵尸猪灵/僵尸疣猪兽主族=猪猪一家且带僵尸血统(一身两族 — 物种×物种)', () => {
  const zp = MOB_TYPES.zombified_piglin.family;
  assert.equal(zp[0], 'pig_line');
  assert.ok(zp.includes('zombie_line'), '僵尸猪灵应带僵尸血统副族');
  const zog = MOB_TYPES.zoglin.family;
  assert.equal(zog[0], 'pig_line', '僵尸疣猪兽主族=猪猪一家(疣猪归猪族)');
  assert.ok(zog.includes('zombie_line'), '僵尸疣猪兽应带僵尸血统副族');
});

test('谱系语义钉: 苦力怕/嘎枝归草木族; 铁傀儡归守卫组(职责组)', () => {
  assert.deepEqual(MOB_TYPES.creeper.family, ['plant'], '苦力怕=草木族(植物身子)');
  assert.deepEqual(MOB_TYPES.creaking.family, ['plant'], '嘎枝=草木族(木头身子)');
  assert.deepEqual(MOB_TYPES.golem.family, ['guard'], '铁傀儡=守卫组(与监守者同守卫)');
});

test('families(): 11 种族各归一桶 · 37 怪全覆盖 · 无兜底桶 · 顺序按 FAMILIES.order', () => {
  const groups = Mobs.families();
  assert.equal(groups.length, 11, '展示分组 = 11 个种族, 实为 ' + groups.length);
  const seen = [];
  for (const g of groups) {
    assert.ok(g.members.length > 0, '空族应跳过: ' + g.key);
    assert.ok(FAMILIES[g.key], '分桶应已注册: ' + g.key);
    for (const k of g.members) seen.push(k);
  }
  assert.equal(seen.length, 37);
  assert.equal(new Set(seen).size, 37, '每怪只归一桶(主族归组)');
  assert.deepEqual([...new Set(seen)].sort(), [...Mobs.spawnable()].sort());
  assert.ok(!groups.find((g) => g.key === 'lone' || g.key === 'other'), '独行侠兜底桶已撤');
  const pig = groups.find((g) => g.key === 'pig_line');
  assert.deepEqual([...pig.members].sort(),
      ['hoglin', 'piglin', 'piglin_brute', 'zoglin', 'zombified_piglin'],
      '猪猪一家 = 人形猪+野兽猪共 5 只');
  const ghost = groups.find((g) => g.key === 'ghost');
  assert.deepEqual([...ghost.members].sort(),
      ['blaze', 'enderman', 'ghast', 'phantom', 'vex', 'wither'],
      '鬼一族 = 恶魂/幻翼/烈焰人/凋灵/末影人/恼鬼');
  const guard = groups.find((g) => g.key === 'guard');
  assert.deepEqual([...guard.members].sort(),
      ['elder_guardian', 'golem', 'guardian', 'warden'],
      '守卫组(职责组) = 铁傀儡/监守者/守卫者/远古守卫者');
  assert.deepEqual(groups.find((g) => g.key === 'plant').members.sort(), ['creaking', 'creeper'],
      '草木族 = 苦力怕+嘎枝');
  assert.deepEqual(groups.find((g) => g.key === 'dragon').members, ['dragon'], '龙族 = 末影龙(单员族)');
  assert.deepEqual(groups.find((g) => g.key === 'sea').members, ['shulker'], '海族 = 潜影贝(单员族)');
  const orders = groups.map((g) => FAMILIES[g.key].order);
  for (let i = 1; i < orders.length; i++) {
    assert.ok(orders[i] > orders[i-1], '分组顺序应按 FAMILIES.order 递增');
  }
});
