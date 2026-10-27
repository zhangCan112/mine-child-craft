'use strict';
/* 冒险地图纯核心 (js/adventure-maps-core.js) 单测 — node --test (零依赖)
   运行: node --test test/adventure-maps-core.test.js
   S1 同名单测(conventions §1.2 守门): 镜像 test/adventure-core.test.js 的
   vm 惯例——先装真引擎件, 再把 adventure-core 的导出挂进 Node 全局
   (经典 script 共享词法环境的复刻: 本模块经全局名读 ADV_GROUND/
   ADV_HOME_ROW/advPortalExit 等), 后 require 本模块直测。四图建场确定性
   对真散布函数断言; 替换语义池/注册表完整性/政策纯函数逐条钉口径
   (票据 T4, docs/adventure-maps-tickets.md)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 真引擎件: 与 adventure-core.test.js 同一套 vm 惯例 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, SceneKit, Daylight, DAYLIGHT, BLOCKS, PLAYER,
  WORLD_W, WORLD_D, WORLD_H, MOB_TYPES,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT, B_BED,
  B_SNOW, B_SNOWY_GRASS, B_ICE, B_CACTUS, B_SANDSTONE, B_DEAD_BUSH, B_ORCHID,
  B_CHEST, B_PORTAL, B_OBSIDIAN, B_GLOWSTONE, B_NETHER_BRICK,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */
Object.assign(globalThis, require('../js/adventure-core.js')); /* 上一层共享词法: ADV_GROUND/ADV_SPAWN/ADV_PORTAL/ADV_HOME_ROW/advPortalExit/advBuildWorld */

const Maps = require('../js/adventure-maps-core.js');

/* ---------- 世界快照与统计助手(对真 worldCells 断言) ---------- */
const W = api.WORLD_W;
const D = api.WORLD_D;
const H = api.WORLD_H;
const cell = (x, y, z) => vm.runInContext('worldCells', eng)[(y * D + z) * W + x];
const snapshot = () => Buffer.from(vm.runInContext('worldCells', eng)); /* 逐字节复现比对 */
function countId(id, pred) {
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (cell(x, y, z) === id && (!pred || pred(x, y, z))) n++;
      }
    }
  }
  return n;
}
const colTop = (x, z) => { /* 列最高非空格 y(地表抽样用) */
  for (let y = H - 1; y >= 0; y--) if (cell(x, y, z) !== 0) return y;
  return -1;
};

/* ============ 注册表完整性(纯数据, 不建场) ============ */

test('注册表: 四行齐 · id 唯一 · 每行字段齐 · home 行引用 ADV_HOME_ROW(同一数据不复制)', () => {
  assert.ok(Array.isArray(Maps.ADV_MAPS), 'ADV_MAPS 是清单');
  assert.strictEqual(Maps.ADV_MAPS.length, 4, '一期四张图: home/desert/snow/swamp');
  const ids = Maps.ADV_MAPS.map((r) => r.id);
  assert.deepStrictEqual([...ids].sort(), ['desert', 'home', 'snow', 'swamp'], 'id 集合与拼写');
  assert.strictEqual(new Set(ids).size, 4, 'id 唯一');
  for (const r of Maps.ADV_MAPS) {
    assert.ok(r.id && r.name && r.hud, r.id + ' 名字三件套');
    assert.strictEqual(typeof r.build, 'function', r.id + ' 建场函数');
    assert.ok(Array.isArray(r.nests) && r.nests.length >= 2, r.id + ' 巢穴池 2+ 巢');
    assert.ok(Array.isArray(r.nightPool) && r.nightPool.length >= 2, r.id + ' 夜怪池非空');
    assert.ok(Array.isArray(r.gates) && r.gates.length >= 1, r.id + ' 门位非空');
    for (const g of r.gates) {
      assert.ok(g.to && Number.isInteger(g.px) && Number.isInteger(g.pz), r.id + ' 门位 {to,px,pz}');
      assert.ok(g.px >= 2 && g.px + ADV_PORTAL.w < W - 2 && g.pz >= 3 && g.pz < D - 3,
          r.id + '→' + g.to + ' 门框在界内(留塔楼/步道外沿)');
    }
    assert.ok(typeof r.livestock === 'string', r.id + ' 畜牧分布键');
    /* 调色板四元组: 每个 RGB 数组值域 [0,1] */
    for (const k of ['ground', 'flora', 'water', 'sky']) {
      const c = r.palette[k];
      assert.ok(Array.isArray(c) && c.length === 3 && c.every((v) => v >= 0 && v <= 1),
          r.id + ' 调色板 ' + k + ' 是 [0,1]×3');
    }
  }
  const home = Maps.ADV_MAPS[0];
  assert.strictEqual(home.id, 'home', 'home 是首行(缺省图)');
  assert.strictEqual(home.nests, ADV_HOME_ROW.nests, 'home 巢穴池=ADV_HOME_ROW 同一引用');
  assert.strictEqual(home.nightPool, ADV_HOME_ROW.nightPool, 'home 夜怪池=ADV_HOME_ROW 同一引用');
  assert.strictEqual(home.build, advBuildWorld, 'home 建场=advBuildWorld(T5 前不动 home)');
});

test('注册表: 替换语义红线 — desert 双池无 zombie 有 husk; snow 无 skeleton 有 stray; swamp 无 skeleton 有 bogged(+女巫小屋常驻+夜池 slime)', () => {
  const row = (id) => Maps.ADV_MAPS.find((r) => r.id === id);
  const kindsOf = (nests) => [].concat(...nests.map((n) => n.kinds));
  const poolOf = (pool) => pool.map((p) => p[0]);

  const desert = row('desert');
  assert.ok(!kindsOf(desert.nests).includes('zombie') && !poolOf(desert.nightPool).includes('zombie'),
      'desert 巢穴池+夜怪池均无 zombie');
  assert.ok(kindsOf(desert.nests).includes('husk') && poolOf(desert.nightPool).includes('husk'),
      'desert 巢穴池+夜怪池均有 husk(布尔替换, 非混刷)');

  const snow = row('snow');
  assert.ok(!kindsOf(snow.nests).includes('skeleton') && !poolOf(snow.nightPool).includes('skeleton'),
      'snow 巢穴池+夜怪池均无 skeleton');
  assert.ok(kindsOf(snow.nests).includes('stray') && poolOf(snow.nightPool).includes('stray'),
      'snow 巢穴池+夜怪池均有 stray');

  const swamp = row('swamp');
  assert.ok(!kindsOf(swamp.nests).includes('skeleton') && !poolOf(swamp.nightPool).includes('skeleton'),
      'swamp 巢穴池+夜怪池均无 skeleton');
  assert.ok(kindsOf(swamp.nests).includes('bogged') && poolOf(swamp.nightPool).includes('bogged'),
      'swamp 巢穴池+夜怪池均有 bogged');
  assert.ok(poolOf(swamp.nightPool).includes('slime'), 'swamp 夜怪池有 slime(夜间水池)');
  assert.ok(!poolOf(swamp.nightPool).includes('witch'), 'witch 不进通用夜池(小屋常驻)');
  assert.ok(swamp.witchHut && Number.isInteger(swamp.witchHut.x) && Number.isInteger(swamp.witchHut.z),
      'swamp 行有女巫小屋常驻标记 witchHut{x,z}(T6 壳消费)');
  const others = Maps.ADV_MAPS.filter((r) => r.id !== 'swamp');
  assert.ok(others.every((r) => !r.witchHut), 'witchHut 标记仅 swamp 行有');
  /* 池里怪种都在册(mob-registry 防拼错) */
  for (const r of Maps.ADV_MAPS) {
    for (const k of [...kindsOf(r.nests), ...poolOf(r.nightPool)]) {
      assert.ok(api.MOB_TYPES[k], r.id + ' 池怪 ' + k + ' 已在 mob-registry 注册');
    }
  }
});

test('注册表: 门位网 — home 三扇门阵互不重叠且各指一张远征图; 远征图各一门回 home; to 双向成环', () => {
  const home = Maps.ADV_MAPS[0];
  const exped = Maps.ADV_MAPS.filter((r) => r.id !== 'home');
  assert.strictEqual(home.gates.length, 3, 'home 门阵三扇(desert/snow/swamp 各一)');
  assert.deepStrictEqual(home.gates.map((g) => g.to).sort(), ['desert', 'snow', 'swamp']);
  const box = (g) => [g.px - 1, g.px + ADV_PORTAL.w, g.pz - 1, g.pz + 1]; /* 含塔楼/步道的包围盒 */
  for (let i = 0; i < home.gates.length; i++) {
    for (let j = i + 1; j < home.gates.length; j++) {
      const a = box(home.gates[i]); const b = box(home.gates[j]);
      const overlap = a[0] <= b[1] && b[0] <= a[1] && a[2] <= b[3] && b[2] <= a[3];
      assert.ok(!overlap, 'home 门 ' + home.gates[i].to + ' 与 ' + home.gates[j].to + ' 不重叠');
    }
  }
  for (const r of exped) {
    assert.strictEqual(r.gates.length, 1, r.id + ' 单门回 home');
    assert.strictEqual(r.gates[0].to, 'home', r.id + ' 回程门指向 home');
  }
});
