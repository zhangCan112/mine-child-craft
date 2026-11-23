'use strict';
/* 热气流核心 (js/updraft-core.js) 同名单测 — node --test (零依赖)
   运行: node --test test/updraft-core.test.js
   篝火 T-C2(篝火票据, spec §3.5/§3.9, ADR 0017): 本文件收三段——
   ① 纯核心面: UpdraftCore.mkSim 注册表语义(add/remove/query/count/clear),
     柱几何(3×3=Chebyshev ≤r, top=火面y+柱高), 遮挡列扫(玩家列火面+1→脚部
     首个实体截断), 多柱 max(最强一柱非求和, 遮挡过滤先于 max), env 注入
     (read/solidOf 参数化, 零全局), 零墙钟零随机零 THREE 零 DOM(源码 grep)。
     —— 核心不知道翼: 「只认翼玩家」是消费端(voxel.js 滑翔分支)的属性,
     核心面只钉 query(px,py,pz) 纯几何判定(无实体参数位)。
   ② 乘流接线面(voxel.js 滑翔分支, vm 装 config+updraft-core+voxel 共享词法,
     voxel.test.js 装具形态镜像): 柱内托升(vel.y=+lift 替换缓降)/柱内跳跃
     展翼豁免(离地 0 一跳即展)/踩火起飞/出柱回落/进入即乘/无翼与静立零参与/
     闩锁咬合(闩锁优先, 柱内自由下坠)/摔落联动(ADR 0014 自收翼点重计)/
     遮挡联动/贴顶边界/空注册表零行为(回归金丝雀)。loadVoxelUp 的 sim 装配
     与 world.js 同一形态(mkSim({read: getBlock, solidOf: isSolid}))——两处
     同源防漂移(票面要求 1)。
   ③ 装配守门: index.html 装载序(updraft-core 先于 voxel.js/world.js 消费链,
     campfire-kit.test 序断言先例形态)/world.js 装配位与清场(UPDRAFT_SIM.clear
     防幽灵气柱)/adventure 接线(updraft 缝注入, kit 测试段配套)。
   红因纪律(conventions §7.4): 装具炸≠断言红——被测文件缺位一律转旗标,
   各测试收干净断言红(campfire-kit.test 容错装载先例)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 被测核心容错装载(红测期文件缺位=旗标, 不炸整文件) ---------- */
let UpdraftCore = null;
try {
  UpdraftCore = require('../js/updraft-core.js');
} catch {
  UpdraftCore = null;
}
const coreReady = () => {
  assert.ok(UpdraftCore && typeof UpdraftCore.mkSim === 'function',
      'js/updraft-core.js 在册且暴露 UpdraftCore.mkSim(新建文件, 票面要求 1)');
};

/* ---------- ① 纯核心面: env 注入 + 注册表语义 ---------- */

/* stub env: read=稀疏格地图, solidOf=1 号实体其余非实体(参数注入对面,
   生产 env=world.js 的 {read: getBlock, solidOf: isSolid}) */
function mkEnv(solidCells) {
  const cells = new Map();
  for (const [x, y, z, id] of (solidCells || [])) cells.set(x + ',' + y + ',' + z, id);
  return {
    read: (x, y, z) => cells.get(x + ',' + y + ',' + z) || 0,
    solidOf: (id) => id === 1,
  };
}
/* 标准源: 火面 y=11, 柱高 20(top=31), 半径 1, 升速 3 —— spec §3.9 初值形态 */
function srcA(over) {
  return Object.assign({x: 10, y: 11, z: 10, r: 1, h: 20, lift: 3}, over || {});
}

test('updraft mkSim: env 注入可建 sim(接口面: add/remove/query/count/clear 全在册)', () => {
  coreReady();
  const sim = UpdraftCore.mkSim(mkEnv());
  for (const k of ['add', 'remove', 'query', 'count', 'clear']) {
    assert.strictEqual(typeof sim[k], 'function', 'sim.' + k + ' 为函数(spec §3.5 interface 草案)');
  }
});

test('query 命中: 柱内点返回 {lift, top} 且 lift/top 同源, top=火面y+柱高', () => {
  coreReady();
  const sim = UpdraftCore.mkSim(mkEnv());
  sim.add(srcA());
  const hit = sim.query(10.5, 15, 10.5);
  assert.ok(hit, '柱内点命中');
  assert.strictEqual(hit.lift, 3, 'lift=注册值');
  assert.strictEqual(hit.top, 31, 'top=火面y+柱高=11+20(spec §3.5: top=火面 y+20)');
  assert.deepStrictEqual(Object.keys(hit).sort(), ['lift', 'top'],
      '命中面恰 {lift, top} 两键(消费方只读这两值)');
});

test('3×3 截面: Chebyshev ≤1 八邻全命中 · 一步之外(Chebyshev 2)零命中 · r 参数驱动不写死', () => {
  coreReady();
  const sim = UpdraftCore.mkSim(mkEnv());
  sim.add(srcA());
  const within = [[10, 10], [11, 10], [9, 10], [10, 11], [10, 9], [11, 11], [9, 9], [11, 9], [9, 11]];
  for (const [cx, cz] of within) {
    assert.ok(sim.query(cx + 0.5, 15, cz + 0.5),
        '列(' + cx + ',' + cz + ') Chebyshev≤1 应命中(3×3 含角格与火源格)');
  }
  assert.strictEqual(sim.query(12.5, 15, 10.5), null, 'Chebyshev 2 柱外零命中');
  assert.strictEqual(sim.query(10.5, 15, 12.5), null, 'Chebyshev 2 柱外零命中(z 向)');
  assert.strictEqual(sim.query(12.5, 15, 12.5), null, 'Chebyshev 2 对角柱外零命中');
  const sim2 = UpdraftCore.mkSim(mkEnv());
  sim2.add(srcA({x: 50, z: 50, r: 2, lift: 2})); // r=2: 判据跟着注册参数走(将来风柱可宽柱)
  assert.ok(sim2.query(52.5, 15, 50.5), 'r=2 时 Chebyshev 2 命中(半径参数生效)');
  assert.strictEqual(sim2.query(53.5, 15, 50.5), null, 'r=2 时 Chebyshev 3 零命中');
});

test('垂直界: 火面高度命中(站火旁同地面) · 火面以下零命中 · 柱顶恰命中 · 柱顶之上零命中', () => {
  coreReady();
  const sim = UpdraftCore.mkSim(mkEnv());
  sim.add(srcA()); // top=31
  assert.ok(sim.query(10.5, 11, 10.5), 'py=火面 y(11) 命中(站火旁同地面跳跃起飞的前提)');
  assert.ok(sim.query(11.5, 11.5, 10.5), '邻格半格高(踩薄块 py=11.5)命中');
  assert.strictEqual(sim.query(10.5, 10.999, 10.5), null, '火面以下(坑内)零命中');
  assert.ok(sim.query(10.5, 31, 10.5), 'py=柱顶(31) 恰命中(顶界含端点)');
  assert.strictEqual(sim.query(10.5, 31.0001, 10.5), null, '柱顶之上零命中(出柱回落)');
});

test('遮挡列扫: 玩家列火面+1→脚部首个实体即截断 · 实体以下矮段照常 · 部分遮挡按列 · 火源格不自遮挡 · 非实体不截', () => {
  coreReady();
  // 石头(id=1)在玩家列(=源列) y=15
  const sim = UpdraftCore.mkSim(mkEnv([[10, 15, 10, 1]]));
  sim.add(srcA());
  assert.strictEqual(sim.query(10.5, 20, 10.5), null, '石头以上(脚部 20>15)全柱无升力');
  assert.ok(sim.query(10.5, 13, 10.5), '石头与火面间矮段(脚部 13<15)照常命中');
  assert.ok(sim.query(11.5, 20, 10.5), '部分遮挡: 玩家在未挡列(11,10)照常命中(树冠口径)');
  assert.ok(sim.query(10.5, 20, 11.5), '部分遮挡按列: 相邻未挡列(10,11)照常命中(遮挡严格按玩家列上扫, 不跨列波及——石头在 z=10 列)');
  // 石头直接压火顶(y=12=火面+1): 该列整柱截断
  const sim2 = UpdraftCore.mkSim(mkEnv([[10, 12, 10, 1]]));
  sim2.add(srcA());
  assert.strictEqual(sim2.query(10.5, 14, 10.5), null, '火顶首格实体: 以上全截(柱内不再起飞)');
  // 火源格自身有实体(solidOf(火)=true 形态): 列扫自火面+1 起, 不得自遮挡
  const sim3 = UpdraftCore.mkSim(mkEnv([[10, 11, 10, 1]]));
  sim3.add(srcA());
  assert.ok(sim3.query(10.5, 15, 10.5), '火源格自身不自遮挡(列扫起点=火面+1)');
  // 非实体块(solidOf=false): 不构成遮挡
  const sim4 = UpdraftCore.mkSim(mkEnv([[10, 15, 10, 2]]));
  sim4.add(srcA());
  assert.ok(sim4.query(10.5, 20, 10.5), '非实体(solidOf=false)不截断(判据=solidOf 注入)');
});

test('多柱 max: 重叠区取最强一柱(lift 与 top 同源非求和) · 最强柱被遮挡时取次强命中柱', () => {
  coreReady();
  const sim = UpdraftCore.mkSim(mkEnv());
  sim.add(srcA()); // {10,11,10} lift 3 top 31
  sim.add(srcA({y: 12, lift: 5})); // {10,12,10} lift 5 top 32 — 同列重叠
  const hit = sim.query(10.5, 20, 10.5);
  assert.strictEqual(hit.lift, 5, 'max 语义: 重叠区恒为单柱值(最强 5, 非求和 8)');
  assert.strictEqual(hit.top, 32, 'lift 与 top 同源(都来自最强柱)');
  // 最强柱被遮挡: 石头只截弱…按列扫起点差——低火(y=11, lift 5)被 y=12 石截, 高火(y=13, lift 2)列扫起点 14 越过石头
  const sim2 = UpdraftCore.mkSim(mkEnv([[10, 12, 10, 1]]));
  sim2.add(srcA({lift: 5})); // 低火 lift 5: 列扫 12..脚部 → 石在 12 → 截
  sim2.add(srcA({y: 13, lift: 2})); // 高火 lift 2: 列扫 14..脚部 → 石不在段内 → 命中
  const hit2 = sim2.query(10.5, 16, 10.5);
  assert.ok(hit2, '遮挡过滤后仍有命中柱');
  assert.strictEqual(hit2.lift, 2, '最强柱(5)被截 → 取次强命中柱(2): 遮挡过滤先于 max');
  assert.strictEqual(hit2.top, 33, 'top 同源次强柱(13+20)');
});

test('count/clear/remove: 注册计数 · 注销单柱 · 未知格 remove 零炸 · clear 清场(切模式/换图口径)', () => {
  coreReady();
  const sim = UpdraftCore.mkSim(mkEnv());
  assert.strictEqual(sim.count(), 0, '空注册表 count=0');
  sim.add(srcA());
  sim.add(srcA({x: 20, z: 20}));
  assert.strictEqual(sim.count(), 2, '两柱 count=2');
  sim.remove(10, 11, 10); // 注销 A(坐标全参, 与 add 同键)
  assert.strictEqual(sim.count(), 1, '注销后 count=1');
  assert.strictEqual(sim.query(10.5, 15, 10.5), null, 'A 柱 query 零命中');
  assert.ok(sim.query(20.5, 15, 20.5), '其余柱不受牵连');
  assert.doesNotThrow(() => sim.remove(99, 98, 97), '未知格 remove 零炸');
  assert.strictEqual(sim.count(), 1, '未知格 remove 零副作用');
  sim.clear();
  assert.strictEqual(sim.count(), 0, 'clear 清场(切模式/换图/读档无幽灵气柱)');
  assert.strictEqual(sim.query(20.5, 15, 20.5), null, 'clear 后 query 零命中');
});

test('add 幂等: 同位重复注册覆盖不叠加(count 恒 1, 新参数整组生效)', () => {
  coreReady();
  const sim = UpdraftCore.mkSim(mkEnv());
  sim.add(srcA());
  sim.add(srcA({lift: 7, h: 5})); // 同 (x,y,z) 重注册(放置覆盖/重燃形态)
  assert.strictEqual(sim.count(), 1, '同键覆盖: count 恒 1(键=源格心)');
  const hit = sim.query(10.5, 14, 10.5);
  assert.strictEqual(hit.lift, 7, '新 lift 生效');
  assert.strictEqual(hit.top, 16, '新 h 生效(top=11+5)');
});

test('env 注入隔离: 两个 sim 各自 env 互不串扰(零全局, read/solidOf 全参数化)', () => {
  coreReady();
  const sim1 = UpdraftCore.mkSim(mkEnv([[10, 15, 10, 1]])); // 有石
  const sim2 = UpdraftCore.mkSim(mkEnv([])); // 无石
  sim1.add(srcA());
  sim2.add(srcA());
  assert.strictEqual(sim1.query(10.5, 20, 10.5), null, 'sim1 按自己的 env 截断');
  assert.ok(sim2.query(10.5, 20, 10.5), 'sim2 按自己的 env 放行——零全局无串扰');
});

test('孤立装载: 仅 updraft-core.js 单文件 vm 装载零炸(加载零副作用, 零全局可解析)', () => {
  const p = path.join(ROOT, 'js', 'updraft-core.js');
  assert.ok(fs.existsSync(p), 'js/updraft-core.js 在册(新建文件)');
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  assert.doesNotThrow(() => {
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, {filename: 'updraft-core.js'});
  }, '孤立装载零炸(不引用任何其他模块的全局——引擎纯核心)');
  assert.strictEqual(vm.runInContext('typeof UpdraftCore', ctx), 'object',
      'UpdraftCore 在孤立词法环境可用(FluidCore 同形: 对象面单入口 mkSim)');
});

test('零墙钟零随机零 THREE 零 DOM: updraft-core.js 源码 grep(确定性重放红线, spec §6-1/6-8)', () => {
  const p = path.join(ROOT, 'js', 'updraft-core.js');
  assert.ok(fs.existsSync(p), 'js/updraft-core.js 在册');
  const src = fs.readFileSync(p, 'utf8');
  for (const [tag, re] of [
    ['零 Date.now', /Date\.now/], ['零 performance.now', /performance\.now/],
    ['零 Math.random', /Math\.random/], ['零 THREE', /THREE\./],
    ['零 document', /document\./], ['零 window', /window\./],
  ]) {
    assert.ok(!re.test(src), tag + '(纯注册+查询, 核心内零时钟推进零随机零渲染零装具)');
  }
});

/* ---------- ② 乘流接线面(voxel.js 滑翔分支消费) ---------- */

const DT = 1 / 60;
const LIFT = 3; // spec §3.9 初值(与核心面 srcA 同值; 实现期调参只动 config, 规则形状钉死)

/* 乘流装具: config + updraft-core + voxel 三文件共享一个 vm 词法环境
   (voxel.test.js loadVoxel 形态镜像), UPDRAFT_SIM 与 world.js 同一装配形态:
   UpdraftCore.mkSim({read: getBlock, solidOf: isSolid}) —— 两处同源防漂移。
   红测期 updraft-core.js 缺位→missing 旗标, 各测试收干净断言红。 */
function loadVoxelUp() {
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  const missing = [];
  for (const f of ['js/config.js', 'js/updraft-core.js', 'js/voxel.js']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) {
      missing.push(f);
      continue;
    }
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('var keys = {}; var touchMove = {x: 0, y: 0}; var touchSprint = false;', ctx);
  /* 装配镜像(world.js 流体同位形态): 消费链上线即得真 sim; 红测期核心缺位
     → UPDRAFT_SIM undefined → 桥接 getter 返回 undefined(不炸装载) */
  vm.runInContext(`
    if (typeof UpdraftCore !== 'undefined' && typeof getBlock === 'function') {
      globalThis.UPDRAFT_SIM = UpdraftCore.mkSim({read: getBlock, solidOf: isSolid});
    }
  `, ctx);
  vm.runInContext(`
    globalThis.__v = {
      getBlock, setBlockRaw, isSolid, collides,
      pos, vel, physics, worldEvents,
      keys, touchMove, touchSprint,
      get onGround(){ return onGround; }, set onGround(v){ onGround = v; },
      get yaw(){ return yaw; }, set yaw(v){ yaw = v; },
      setFly, setGliderEquipped, isGliding,
      PLAYER, GLIDE,
      B_CAMPFIRE: typeof B_CAMPFIRE !== 'undefined' ? B_CAMPFIRE : null,
      get UPDRAFT_SIM(){ return typeof UPDRAFT_SIM !== 'undefined' ? UPDRAFT_SIM : undefined; },
    };
  `, ctx);
  return {v: ctx.__v, missing};
}

function fill(v, x0, y0, z0, x1, y1, z1, id) {
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        v.setBlockRaw(x, y, z, id);
      }
    }
  }
}

/* 标准场: 地板 y≤10(顶面 11) · 火源(42,11,42) r1 h20 lift3 —— 柱区列 x/z 41..43 */
function mkScene(opts) {
  const {v, missing} = loadVoxelUp();
  assert.deepStrictEqual(missing, [], '被测 js 文件在册(config/updraft-core/voxel), 缺: ' + missing);
  fill(v, 38, 10, 38, 46, 10, 46, 3); // 地板(顶面 11)
  v.UPDRAFT_SIM.add({x: 42, y: 11, z: 42, r: 1, h: 20, lift: LIFT});
  if (opts && opts.stone) {
    fill(v, opts.stone[0], opts.stone[1], opts.stone[2],
        opts.stone[3], opts.stone[4], opts.stone[5], 3); // 遮挡石头(实体)
  }
  return v;
}

function settle(v, maxFrames) {
  for (let i = 0; i < maxFrames; i++) {
    v.physics(DT);
    if (v.onGround) return i;
  }
  return -1;
}

test('乘流·柱内托升: 火旁(3×3 内)平地跳跃立即展翼, 升力替换缓降(vel.y=+lift), 持续上升', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5); // 邻格地面(列(41,42) Chebyshev 1), 站火旁同地面
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), true, '柱内跳跃立即展翼(ADR 0017 门槛豁免: 离地 0 一跳即展)');
  assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9,
      '跳跃初速被升力即刻接管: vel.y=+3(非缓降 -0.7 非跳跃抛物线), 实测 ' + v.vel.y);
  let prevY = v.pos.y;
  for (let i = 0; i < 120; i++) { // 2s ≈ 6 格 — 稳在柱内(顶 31 远)
    v.physics(DT);
    assert.strictEqual(v.isGliding(), true, '乘流全程展翼持有');
    assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9, '柱内托升恒值 vel.y=+3, 实测 ' + v.vel.y);
    assert.ok(v.pos.y > prevY, '持续上升(高度在柱内可增——ADR 0016 例外仅此)');
    prevY = v.pos.y;
  }
  assert.ok(v.pos.y > 15, '2 秒净升 >4 格(升力可感), 实测 ' + (v.pos.y - 11).toFixed(2));
});

test('乘流·出柱回落: 漂出柱(Chebyshev ≥2)vel.y 即回落缓降, 柱外高度只减不增恢复', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), true);
  for (let i = 0; i < 60; i++) v.physics(DT); // 柱内升至 ~14
  assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9, '柱内仍在托升');
  v.pos.set(39.5, v.pos.y, 39.5); // 搬运出柱(列(39,39) Chebyshev 3, 装具操作先例)
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true, '出柱≠收翼(仍滑翔)');
  assert.ok(Math.abs(v.vel.y - v.GLIDE.sink) < 1e-9,
      '出柱瞬间回落缓降 vel.y=' + v.GLIDE.sink + '(出柱推力即止), 实测 ' + v.vel.y);
  let prev = v.pos.y;
  for (let i = 0; i < 30; i++) {
    v.physics(DT);
    assert.ok(v.pos.y <= prev + 1e-9, '柱外高度只减不增(ADR 0016 契约恢复)');
    prev = v.pos.y;
  }
});

test('乘流·进入即乘: 柱外展翼滑翔飘入柱内 = 开始上升(BotW 官方口径移植)', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(36.5, 15, 42.5); // 柱外 6 格, 离地 4(正常展翼规则)
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true, '柱外照常按 >2 阈值展翼');
  assert.ok(Math.abs(v.vel.y - v.GLIDE.sink) < 1e-9, '柱外缓降');
  v.pos.set(42.5, 15, 42.5); // 漂入柱内(装具搬运=飘入的帧级等价)
  v.physics(DT);
  assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9, '进入柱内即乘(开始上升), 实测 ' + v.vel.y);
});

test('乘流·踩火起飞: 踩着篝火方块本身起跳同此(3×3 含篝火格, thin 半格可站)', () => {
  const v = mkScene();
  v.setBlockRaw(42, 11, 42, v.B_CAMPFIRE); // 真篝火方块(81: thin 0.5 · solid true)
  assert.strictEqual(v.B_CAMPFIRE, 81, '两态篝火 id 在册(T-C1 数据行)');
  v.setGliderEquipped(true);
  v.pos.set(42.5, 12, 42.5); // 火格上方落下半格
  assert.ok(settle(v, 200) >= 0, '站上篝火(可站立前提, spec §3.4)');
  assert.ok(v.pos.y >= 11.5 && v.pos.y <= 12 + 1e-6,
      '站上篝火顶(碰撞面整格贴齐=12, thin 半格站立非本票面), 实测 ' + v.pos.y);
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), true, '踩火起跳立即展翼');
  assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9, '升力即刻接管, 实测 ' + v.vel.y);
});

test('乘流·无翼零参与: 未装备玩家柱内跳跃零展翼零升力(重力弧线照旧, 风托的是翼)', () => {
  const v = mkScene();
  v.setGliderEquipped(false);
  v.pos.set(41.5, 11, 42.5);
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  let glidingSeen = false;
  let maxUp = 0;
  for (let i = 0; i < 200 && !v.onGround; i++) {
    v.physics(DT);
    if (v.isGliding()) glidingSeen = true;
    maxUp = Math.max(maxUp, v.pos.y);
  }
  assert.strictEqual(glidingSeen, false, '无翼柱内零展翼');
  assert.strictEqual(v.onGround, true, '落回地面');
  assert.ok(maxUp - 11 < 2, '普通跳高弧线(<2 格自洽锚, 零气流托升), 实测 ' + (maxUp - 11).toFixed(2));
});

test('乘流·静立/步行零被动升空: 装备翼静立柱内与步行穿柱不按跳零展翼(路过篝火不上天, ADR 0017 D 案否决面)', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5); // 静立柱内
  assert.ok(settle(v, 200) >= 0, '预落地');
  for (let i = 0; i < 60; i++) {
    v.physics(DT);
    assert.strictEqual(v.isGliding(), false, '静立柱内零被动展翼(帧 ' + i + ')');
    assert.strictEqual(v.pos.y, 11, '零垂直位移(不被吸升)');
  }
  v.yaw = 0;
  v.keys['KeyD'] = true; // 步行穿柱(+x 方向穿越 41..43; 40 帧止步≈x44.8 仍在地板 38..46 内, 不掉边)
  for (let i = 0; i < 40; i++) {
    v.physics(DT);
    assert.strictEqual(v.isGliding(), false, '步行穿柱零展翼(帧 ' + i + ', x=' + v.pos.x.toFixed(1) + ')');
  }
  v.keys['KeyD'] = false;
});

test('乘流·闩锁咬合: 柱内取消→闩锁态自由下坠(lift 不作用) · 空中再点跳=解闩+展翼持续升力直至柱顶 · 出柱回落落地 · 落地清闩再跳恢复豁免', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  for (let i = 0; i < 120; i++) v.physics(DT); // 乘流至 ~17
  v.keys['Space'] = true;
  v.physics(DT); // 柱内主动取消 → 闩锁
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), false, '柱内取消立即收翼');
  v.worldEvents.land = false; // 事件袋消费契约(voxel.js「消费方读完置回 false」): 清 settle 残留再验「仍在空中」
  for (let i = 0; i < 20; i++) {
    v.physics(DT);
    assert.strictEqual(v.isGliding(), false, '闩锁态柱内不重展');
    assert.ok(v.vel.y < 0, '闩锁优先: 柱内自由下坠(lift 只作用于滑翔态), vel.y=' + v.vel.y.toFixed(2));
  }
  assert.strictEqual(v.worldEvents.land, false, '仍在空中');
  const cancelY = v.pos.y;
  v.keys['Space'] = true;
  v.physics(DT); // 柱内空中再点跳=解闩+主动展翼(既有语义, 零特判)
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), true, '解闩+主动展翼(既有语义)');
  assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9, '再获升力(两契约自然咬合), 实测 ' + v.vel.y);
  for (let i = 0; i < 30; i++) { // 解闩再展=完整未闩滑翔态: 持续升力非单帧爆发(spec §3.5「再获升力」自然咬合)
    v.physics(DT);
    assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9,
        '解闩后持续升力(第 ' + i + ' 帧, vel.y=' + v.vel.y.toFixed(3) + ', 非爆发单帧)');
    assert.ok(v.pos.y > cancelY - 1, '闩锁已解: 不再自由下坠');
  }
  let prevY = v.pos.y;
  let topped = false;
  for (let i = 0; i < 400; i++) { // 持续乘流升至柱顶(top=31, 露天贴顶区 y 稳在 31±抖动)
    v.physics(DT);
    if (v.pos.y >= 30) {
      topped = true;
      break;
    }
    assert.ok(v.pos.y > prevY, '乘流持续上升(帧 ' + i + ')');
    prevY = v.pos.y;
  }
  assert.ok(topped, '解闩再展升至柱顶区(实测 y=' + v.pos.y.toFixed(2) + ', 自 ' +
      cancelY.toFixed(1) + ' 续升≈' + (v.pos.y - cancelY).toFixed(1) + ' 格——爆发单帧实现升不到顶)');
  v.pos.set(39.5, v.pos.y, 39.5); // 搬运出柱(装具先例): 出柱即回落缓降
  v.physics(DT);
  assert.ok(Math.abs(v.vel.y - v.GLIDE.sink) < 1e-9, '出柱回落缓降, 实测 ' + v.vel.y.toFixed(3));
  v.worldEvents.land = false;
  for (let i = 0; i < 1900 && !v.onGround; i++) v.physics(DT); // 缓降落地(≈31→11 需 28.6s≈1717 帧, 1900 留富余)
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.isGliding(), false);
  v.pos.set(41.5, v.pos.y, 42.5); // 搬回柱内(落地清闩后验「恢复豁免」: 豁免=柱内展翼豁免, 判定面在柱内)
  v.keys['Space'] = true;
  v.physics(DT); // 落地后再跳
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), true, '落地闩锁清零后再跳恢复豁免起飞');
  assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9, '豁免恢复, 实测 ' + v.vel.y);
});

test('乘流·柱外取消→解闩再展→飘入柱内=开始上升(次生面: 解闩回完整未闩滑翔态, 进入即乘零特判)', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(39.5, 15, 42.5); // 柱外空中起步(离地 4>2 阈值; 平地跳峰值≈1.4 格本就不展=spec 不外溢回归面)
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true, '柱外正常展翼(>2 阈值)');
  assert.ok(Math.abs(v.vel.y - v.GLIDE.sink) < 1e-9, '柱外滑翔缓降');
  v.keys['Space'] = true;
  v.physics(DT); // 柱外滑翔中再点跳=主动取消 → 收翼+闩锁
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), false, '柱外取消立即收翼');
  v.physics(DT); // 沿间隔帧(keys 松开复位 prevSpace): 闩锁态延续自由下坠
  assert.ok(v.vel.y < 0, '闩锁态自由下坠');
  v.keys['Space'] = true;
  v.physics(DT); // 空中再点跳=解闩+展翼(gHeight>2 既有阈值, 既有语义)
  v.keys['Space'] = false;
  assert.strictEqual(v.isGliding(), true, '解闩+主动展翼');
  assert.ok(Math.abs(v.vel.y - v.GLIDE.sink) < 1e-9, '柱外缓降(未闩滑翔态, 无气流无升力)');
  v.pos.set(41.5, v.pos.y, 42.5); // 飘入柱内(装具搬运=飘入的帧级等价, 进入即乘先例同款)
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true, '滑翔态持有');
  assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9,
      '入柱即获升力(解闩态零残留: 无闩锁门无爆发门, 单一判据「处于柱内」), 实测 ' + v.vel.y);
  let prevY = v.pos.y;
  for (let i = 0; i < 20; i++) {
    v.physics(DT);
    assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9, '柱内持续升力(帧 ' + i + ')');
    assert.ok(v.pos.y > prevY, '开始上升');
    prevY = v.pos.y;
  }
});

test('乘流·摔落联动·柱内取消: 乘流至高处取消收翼, 落差自收翼点重计(20 格取消≈重伤的账)', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  for (let i = 0; i < 200; i++) v.physics(DT); // 乘流至 ~20
  const cancelY = v.pos.y;
  assert.ok(cancelY > 18, '已乘流至高处(实测 ' + cancelY.toFixed(1) + ')');
  v.keys['Space'] = true;
  v.physics(DT); // 柱内取消(自收翼点重计)
  v.keys['Space'] = false;
  for (let i = 0; i < 600 && !v.onGround; i++) v.physics(DT);
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.worldEvents.land, true);
  const expect = cancelY - 11;
  assert.ok(Math.abs(v.worldEvents.landFall - expect) < 1.0,
      '落差≈取消点高度(自收翼点重计≈' + expect.toFixed(1) + '), 实测 ' + v.worldEvents.landFall.toFixed(2));
  assert.strictEqual(v.worldEvents.landGliding, false, '取消后触地为无翼态');
});

test('乘流·摔落联动·全程安全: 乘流升高后漂出柱滑翔落地, landGliding=true 且落差≈0(展翼段不计账)', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  for (let i = 0; i < 180; i++) v.physics(DT); // 乘流至 ~20
  assert.ok(v.pos.y > 17, '已升高(实测 ' + v.pos.y.toFixed(1) + ')');
  v.pos.set(39.5, v.pos.y, 39.5); // 漂出柱(不取消, 保持滑翔)
  v.worldEvents.land = false; // 事件袋消费契约: 清 settle 残留, 落地事件须为本段触地
  for (let i = 0; i < 900; i++) { // 缓降 sink 0.7 格/s, 20→11 需 ≈13s≈780 帧, 900 帧留富余
    v.physics(DT);
    if (v.onGround) break; // 触地帧即收翼(voxel 既有语义), 滑翔持有断言只验空中段
    assert.strictEqual(v.isGliding(), true, '滑翔段持有至落地');
  }
  assert.strictEqual(v.onGround, true);
  assert.strictEqual(v.worldEvents.land, true);
  assert.strictEqual(v.worldEvents.landGliding, true, '滑翔触地(零伤害旗标, ADR 0014)');
  assert.ok(v.worldEvents.landFall < 2,
      '展翼段不计落差(峰值随滑翔帧锚定→落差≈0), 实测 ' + v.worldEvents.landFall.toFixed(2));
});

test('乘流·滑翔中卸翼(柱内): 立即收翼按无翼坠落, 升力不再接管(卸翼语义优先于气流)', () => {
  const v = mkScene();
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  for (let i = 0; i < 60; i++) v.physics(DT); // 乘流段
  assert.strictEqual(v.isGliding(), true);
  v.setGliderEquipped(false); // 滑翔中卸翼(ADR 0014 有意设计)
  v.physics(DT);
  assert.strictEqual(v.isGliding(), false, '立即收翼');
  for (let i = 0; i < 10; i++) {
    v.physics(DT);
    assert.strictEqual(v.isGliding(), false, '卸翼后柱内不重展(无翼不参与)');
    assert.ok(v.vel.y < 0, '按无翼重力坠落(非升力), vel.y=' + v.vel.y.toFixed(2));
  }
});

test('乘流·遮挡联动: 玩家列火面上方实体→该高度无升力(缓降), 实体下方矮段照常升力', () => {
  const v = mkScene({stone: [42, 20, 42, 42, 20, 42]}); // 石头压柱心 y=20
  v.setGliderEquipped(true);
  v.pos.set(42.5, 15, 42.5); // 石下矮段
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true, '矮段展翼(阈值或豁免任一达成)');
  assert.ok(Math.abs(v.vel.y - LIFT) < 1e-9, '石头与火面间矮段照常升力, 实测 ' + v.vel.y);
  v.pos.set(42.5, 25, 42.5); // 石上(列扫 12..25 命中石头)
  v.physics(DT);
  assert.ok(Math.abs(v.vel.y - v.GLIDE.sink) < 1e-9,
      '石头以上全柱无升力(缓降), 实测 ' + v.vel.y);
});

test('乘流·贴顶边界: 柱顶上方天花板压停(不穿墙), 碰撞清 vel.y 下一帧再给 lift 的抖动可接受', () => {
  const v = mkScene();
  fill(v, 40, 18, 40, 44, 18, 44, 3); // 室内天花板(底面 18, 柱高穿顶)
  v.setGliderEquipped(true);
  v.pos.set(41.5, 11, 42.5);
  assert.ok(settle(v, 200) >= 0, '预落地');
  v.keys['Space'] = true;
  v.physics(DT);
  v.keys['Space'] = false;
  let inside = true;
  for (let i = 0; i < 400; i++) {
    v.physics(DT);
    if (v.pos.y >= 18) inside = false; // 顶面 y=18: 任何时刻身体不得入顶
  }
  assert.strictEqual(inside, true, '贴顶不穿墙(pos.y 恒 <18, 实测峰值 ' + v.pos.y.toFixed(2) + ')');
  assert.ok(Math.abs(v.pos.y + v.PLAYER.height - 18) < 0.3,
      '稳定贴在天花板下(18-身高≈16.2), 实测 ' + v.pos.y.toFixed(2));
  assert.strictEqual(v.isGliding(), true, 'lift 逐帧再给(贴顶抖动=已知接受边界, spec §3.5)');
  assert.strictEqual(v.collides(v.pos.x, v.pos.y, v.pos.z), false, '贴顶位不嵌块');
});

test('乘流·空注册表零行为: sim 在册无源时既有滑翔语义零变化(非篝火模式零增量回归金丝雀)', () => {
  const {v, missing} = loadVoxelUp();
  assert.deepStrictEqual(missing, [], '被测 js 文件在册');
  fill(v, 38, 10, 38, 46, 10, 46, 3);
  assert.strictEqual(v.UPDRAFT_SIM.count(), 0, '注册表空(其他模式常态)');
  v.setGliderEquipped(true);
  // 高处展翼照旧缓降(离地 4 > 2)
  v.pos.set(42.5, 15, 42.5); // 柱区位置但无源
  v.physics(DT);
  assert.strictEqual(v.isGliding(), true, '离地>2 展翼照旧');
  assert.ok(Math.abs(v.vel.y - v.GLIDE.sink) < 1e-9, '缓降照旧(零升力), 实测 ' + v.vel.y);
  // 平地跳跃零误展(glider-spec §3.4 回归锚)
  const v2 = loadVoxelUp().v;
  fill(v2, 38, 10, 38, 46, 10, 46, 3);
  v2.setGliderEquipped(true);
  v2.pos.set(42.5, 11, 42.5);
  assert.ok(settle(v2, 200) >= 0, '预落地');
  v2.keys['Space'] = true;
  v2.physics(DT);
  v2.keys['Space'] = false;
  for (let i = 0; i < 200 && !v2.onGround; i++) {
    v2.physics(DT);
    assert.strictEqual(v2.isGliding(), false, '空注册表平地跳零误展(帧 ' + i + ')');
  }
});

/* ---------- ③ 装配守门(T-C1 序断言先例形态) ---------- */

test('装配守门·装载序: index.html updraft-core 行在册且先于 voxel.js 与 world.js(消费链硬依赖边)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
  const iUp = srcs.indexOf('js/updraft-core.js');
  const iVox = srcs.indexOf('js/voxel.js');
  const iWld = srcs.indexOf('js/world.js');
  assert.ok(iUp >= 0, 'script 行在册(updraft-core.js)');
  assert.ok(iVox >= 0 && iWld >= 0, '消费方哨兵在册(voxel.js/world.js)');
  assert.ok(iUp < iVox, 'updraft-core.js 先于 voxel.js(引擎物理调用期读 UPDRAFT_SIM, 加载序即依赖序)');
  assert.ok(iUp < iWld, 'updraft-core.js 先于 world.js(装配面顶层求值 UpdraftCore.mkSim)');
});

test('装配守门·world.js 装配位: UpdraftCore.mkSim 与 fluid sim 同位(read/solidOf 注入 getBlock/isSolid) · clearWorld 清场', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'world.js'), 'utf8');
  assert.ok(/UpdraftCore\.mkSim\(\{/.test(src), 'world.js 装配 UPDRAFT_SIM(与 FLUID_SIM 同装配位, 票面要求 4)');
  assert.ok(/read:\s*getBlock/.test(src) && /solidOf:\s*isSolid/.test(src),
      'env 注入 getBlock/isSolid(world.js 与单测共用同一装配形态, 防两份漂移)');
  assert.ok(/UPDRAFT_SIM\.clear\(\)/.test(src),
      'clearWorld 清场 UPDRAFT_SIM.clear(切模式/换图无幽灵气柱, spec §3.5 验收)');
});

test('装配守门·模式层接线: adventure.js 经 updraft 缝注入(注册/注销经状态迁移点, spec §3.5)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'modes', 'adventure.js'), 'utf8');
  assert.ok(/UPDRAFT_SIM/.test(src), 'adventure.js 引用 UPDRAFT_SIM(引擎装配实例)');
  assert.ok(/mkCampfireLedger\(\{[\s\S]{0,400}?updraft\s*:/.test(src),
      'mkCampfireLedger 构造注入 updraft 缝(账本状态迁移点 add/remove 的单源装配)');
});
