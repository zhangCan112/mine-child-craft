'use strict';
/* 怪物注册表 (js/mob-registry.js) 单测 — node --test (零依赖)
   运行: node --test test/mob-registry.test.js
   沿革: 由 test/mob-taxonomy.test.js 随 mob-registry.js 落地(2026-10 候选 8 T1)
   git mv 改名收编 — 四表自 config.js 拆出后测试同名(-registry 契约, §1.9 偏差消名)。
   在共享 vm 词法环境里按浏览器顺序加载 mob-registry.js + mobs.js(镜像 boot.test 的
   加载方式与 mobs.test 的 THREE 桩), 对注册表数据做完整性/语义钉:
   · 完整性: 每个可部署怪 proto 合法 · family 键全注册 · 每怪必归种族(无兜底族)
   · 语义钉: 僵尸猪灵/僵尸疣猪兽主族=猪猪一家带僵尸血统(一身两族) · 草木族/守卫组归组
   · 分组查询: Mobs.families() 11 种族 · 37 怪各归一桶 · 顺序按 FAMILIES.order
   · 掉落表: MOB_DROPS 结构/逐格(随迁自 test/blocks-fields.test.js 的怪物段)
   · 恒等锚: Mobs.types === 注册表 MOB_TYPES(壳经共享词法环境直读, 无影子拷贝) */
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
  MobLookKit: require('../js/mob-look-kit.js'),
  groundTop: () => 11, getBlock: () => 0, isSolid: () => false,
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
const ROOT = path.join(__dirname, '..');
/* 造型档案声明(票③起 mobs.js 硬依赖): 先于 mobs.js 装载(镜像 index.html 序) */
const lookDir = path.join(ROOT, 'js', 'mob-look');
for (const f of fs.readdirSync(lookDir).filter((x) => x.endsWith('.js')).sort()) {
  vm.runInContext(fs.readFileSync(path.join(lookDir, f), 'utf8'), ctx, {filename: 'js/mob-look/' + f});
}
for (const f of ['js/mob-registry.js', 'js/mobs.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
}
const MOB_TYPES = vm.runInContext('MOB_TYPES', ctx);
const FAMILIES = vm.runInContext('FAMILIES', ctx);
const PROTOS = vm.runInContext('PROTOS', ctx);
const MOB_DROPS = vm.runInContext('MOB_DROPS', ctx);
const Mobs = vm.runInContext('Mobs', ctx);
const famKeys = Object.keys(FAMILIES); /* 全部注册键(无兜底伪族) */

test('恒等锚: Mobs.types 与注册表 MOB_TYPES 是同一对象(壳直读注册表, 无影子拷贝)', () => {
  assert.strictEqual(Mobs.types, MOB_TYPES, 'mobs.js 的 types 出口应恒等 mob-registry.js 的表');
});

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

/* ============ F4 农场一家(二期设计稿 §4.1/§4.2): 被动牧场动物入册口径 ============ */

test('F4 谱系入册: 农场四怪必归种族 farm_line + PROTOS 含 grazer + 数值表逐格', () => {
  /* 每怪必归种族: 全 MOB_TYPES 口径(含 passive——spawnable 收窄后它们不在可部署清单,
     谱系完整性仍要守住) */
  for (const k of Object.keys(MOB_TYPES)) {
    if (k === 'mix') continue;
    const def = MOB_TYPES[k];
    assert.ok(Array.isArray(def.family) && def.family.length > 0,
        k + ' 必须归种族(含被动动物, 每怪必归种族)');
    for (const f of def.family) assert.ok(famKeys.includes(f), k + ' 引用了未注册族 ' + f);
  }
  assert.ok(famKeys.includes('farm_line'), 'FAMILIES 应注册 farm_line');
  assert.deepEqual(MOB_TYPES.cow.family, ['farm_line']);
  assert.deepEqual(MOB_TYPES.pig.family, ['farm_line']);
  assert.deepEqual(MOB_TYPES.sheep.family, ['farm_line']);
  assert.deepEqual(MOB_TYPES.chicken.family, ['farm_line']);
  assert.ok(PROTOS.includes('grazer'), 'PROTOS 应含 grazer(无战斗原型占位)');
  for (const k of ['cow', 'pig', 'sheep', 'chicken']) {
    const d = MOB_TYPES[k];
    assert.strictEqual(d.proto, 'grazer', k + ' proto=grazer');
    assert.strictEqual(d.passive, true, k + ' passive 旗标');
    assert.strictEqual(d.dmg, 0, k + ' 不攻击(dmg 0)');
    assert.strictEqual(d.range, 0, k + ' range 0');
    assert.strictEqual(d.cd, 0, k + ' cd 0');
    assert.ok(!d.ranged && !d.fly && !d.boss && !d.boom, k + ' 无战斗旗标');
  }
  /* 数值表逐格(设计稿 §4.1: hp≈MC 生命×1.5 折算惯例) */
  assert.deepEqual(
      [MOB_TYPES.cow.hp, MOB_TYPES.cow.speed, MOB_TYPES.cow.h, MOB_TYPES.cow.hitR], [15, 1.4, 1.3, 0.7]);
  assert.deepEqual(
      [MOB_TYPES.pig.hp, MOB_TYPES.pig.speed, MOB_TYPES.pig.h, MOB_TYPES.pig.hitR], [15, 1.3, 0.9, 0.6]);
  assert.deepEqual(
      [MOB_TYPES.sheep.hp, MOB_TYPES.sheep.speed, MOB_TYPES.sheep.h, MOB_TYPES.sheep.hitR], [12, 1.2, 1.2, 0.65]);
  assert.deepEqual(
      [MOB_TYPES.chicken.hp, MOB_TYPES.chicken.speed, MOB_TYPES.chicken.h, MOB_TYPES.chicken.hitR],
      [6, 1.5, 0.7, 0.35]);
});

test('F4 spawnable 收窄: 可部署=可战斗部署 — 排除 passive 四键, 战斗怪清单不增不减', () => {
  const dep = Mobs.spawnable();
  for (const k of ['cow', 'pig', 'sheep', 'chicken']) {
    assert.ok(!dep.includes(k), '农场动物 ' + k + ' 不进可战斗部署清单');
  }
  /* 既有 37 战斗怪一只不少(竞技场 MIX_POOL/演习场 RANGE_MOB_KEYS 零改动的前提) */
  assert.strictEqual(dep.length, 37, '战斗部署清单仍为 37 怪');
  for (const k of ['zombie', 'skeleton', 'creeper', 'spider', 'slime', 'shulker', 'dragon']) {
    assert.ok(dep.includes(k), '战斗怪 ' + k + ' 仍在清单');
  }
  assert.ok(!dep.includes('mix'), 'mix 伪类型照旧排除');
});

test('F4 families 无农场桶: 被动动物不进展示分组(面板归组走 spawnable 同源)', () => {
  const groups = Mobs.families();
  assert.ok(!groups.find((g) => g.key === 'farm_line'), '农场一家无展示桶(不进竞技场/演习场面板)');
  const seen = groups.flatMap((g) => g.members);
  for (const k of ['cow', 'pig', 'sheep', 'chicken']) {
    assert.ok(!seen.includes(k), k + ' 不落任何展示桶');
  }
  assert.strictEqual(groups.length, 11, '展示分组仍是 11 个战斗种族');
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

/* ============ MOB_DROPS(设计稿 §3.3: 保底 1 + 50% 加成 1) — 随迁自 test/blocks-fields.test.js ============ */

test('MOB_DROPS: 一期怪物齐全且键都是 MOB_TYPES 里的真实怪', () => {
  for (const m of ['zombie', 'skeleton', 'creeper', 'spider', 'slime']) {
    assert.ok(MOB_DROPS[m], 'MOB_DROPS 缺 ' + m);
    assert.ok(MOB_TYPES[m], 'MOB_DROPS.' + m + ' 必须对应 MOB_TYPES 里的怪');
  }
});

test('MOB_DROPS F4 农场四条: 生肉+副产物逐条与设计稿 §4.5 一致(儿童配平「保底1+50%+1」沿用)', () => {
  const expectRolls = {
    cow: [['raw_beef', 1, 1], ['leather', 1, 1]],
    pig: [['raw_porkchop', 1, 1]],
    chicken: [['raw_chicken', 1, 1], ['feather', 1, 1]],
    sheep: [['wool', 1, 1], ['raw_mutton', 1, 1]],
  };
  for (const [m, rolls] of Object.entries(expectRolls)) {
    const d = MOB_DROPS[m];
    assert.ok(d, 'MOB_DROPS 缺农场怪 ' + m);
    assert.deepEqual(d.rolls, rolls, m + ' rolls 照设计稿 §4.5 表'); /* 宽松比较: vm 跨 realm */
    assert.ok(MOB_TYPES[m] && MOB_TYPES[m].passive, m + ' 应是 MOB_TYPES 里的被动牧场动物');
  }
});

test('MOB_DROPS 结构: rolls=[itemId,保底,加成次数], rare=[itemId,概率]; 僵尸 5% 稀有铁锭', () => {
  const expectRolls = {zombie: [['rotten_flesh', 1, 1]], skeleton: [['bone', 1, 1]],
    creeper: [['gunpowder', 1, 1]], spider: [['string', 1, 1]], slime: [['slimeball', 1, 1]]};
  for (const [m, rolls] of Object.entries(expectRolls)) {
    const d = MOB_DROPS[m];
    assert.deepEqual(d.rolls, rolls, m + ' rolls 应为保底 1 + 50% 加成 1'); /* 宽松比较: vm 跨 realm */
    assert.ok(Array.isArray(d.rolls) && d.rolls.length > 0, m + ' rolls 非空');
  }
  for (const d of Object.values(MOB_DROPS)) {
    for (const e of d.rolls) {
      assert.strictEqual(typeof e[0], 'string');
      assert.ok(e[0].length > 0, '掉落物 id 应非空');
      assert.ok(Number.isInteger(e[1]) && e[1] >= 1, '保底至少 1(儿童配平: 不空手)');
      assert.ok(Number.isInteger(e[2]) && e[2] >= 0, '加成掷骰次数应为非负整数');
    }
    if (d.rare) {
      for (const e of d.rare) {
        assert.strictEqual(typeof e[0], 'string');
        assert.ok(e[0].length > 0, '稀有掉落物 id 应非空');
        assert.ok(typeof e[1] === 'number' && e[1] > 0 && e[1] <= 1, '稀有概率应在 0~1');
      }
    }
  }
  assert.deepEqual(MOB_DROPS.zombie.rare, [['iron_ingot', 0.05]],
      '僵尸稀有铁锭: MC 0.83% → 5%(设计稿 §3.3)');
});
