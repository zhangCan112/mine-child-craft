'use strict';
/* 篝火性能基准 · 50 火负载构造与三面计数断言 (T-C6 基准票) — node --test (零依赖)
   运行: node --test test/campfire-bench.test.js
   票文挂靠点三面: js/campfire-fx-core.js(粒子负载面) · js/light-core.js(增量光
   BFS 成本面) · js/updraft-core.js(柱查询成本面)。本文件只做确定性负载构造+
   计数断言(禁随机摆位/禁真机帧率阈值——帧时分布归 .scratch/campfire/tc6-bench-*
   实测落盘, 阈值判定放基准报告不自断, 派令纪律); 50 火同屏的帧时实测与
   spec §3.9 侧账上限行收档结论见基准报告 .scratch/campfire/tc6-bench-report.md。
   命名偏差说明: 非单模块镜像的主题测试, world-integrity 先例(conventions §1.9,
   本头注释写明对应模块文件)。
   断言口径对照 spec §7 成本构成裁定:
   ①每火一次增量光 BFS(火把同款先例)——首置增量=无遮挡曼哈顿球精确计数
     (不变量式), 50 火连置增量次线性(重叠递减), 撤光净暗=独享球 ≤ 增光球;
   ②每帧 O(燃火数) 柱查询——50 源注册表查询语义(max/遮挡截断/柱界两端含);
   ③每火粒子数——三发射器稳态存活数逐档上限(参数×寿命上界的确定性数学,
     全额/降半/只留烟三档 + 低核分档减半复验) + 燃尽余韵 ≤2s 全清预算
     (T-C9 评审 SPEC-2 管辖复核, 50 火规模)。 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CampfireFxCore = require(path.join(ROOT, 'js', 'campfire-fx-core.js'));
const LightCore = require(path.join(ROOT, 'js', 'light-core.js'));
const UpdraftCore = require(path.join(ROOT, 'js', 'updraft-core.js'));

/* ---------- 公共装具: 确定性 50 火摆位(禁随机, 网格序) ---------- */
/* 7×7 网格去 4 角=45+5 中轴补 5=50 座; 间距 5, 原点 (0,0) 起摆——
   位置只依赖下标序, 与随机无关; fx-core 内部 rng 是 mulberry32 每源派生,
   同格同流, 全程可重放 */
function mkGrid50() {
  const out = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue; /* 去 4 角=45 */
      out.push({x: col * 5, y: 1, z: row * 5});
    }
  }
  out.push({x: 15, y: 1, z: 35}); /* 补 5 座: 中轴带 */
  out.push({x: 20, y: 1, z: 35});
  out.push({x: 25, y: 1, z: 35});
  out.push({x: 30, y: 1, z: 35});
  out.push({x: 35, y: 1, z: 35});
  assert.strictEqual(out.length, 50, '摆位装具自检: 50 座');
  return out;
}

function warmFx(fx, cells, seconds) {
  for (const c of cells) fx.open(c.x, c.y, c.z);
  const steps = Math.round(seconds / 0.05);
  for (let i = 0; i < steps; i++) fx.tick(0.05);
}

/* ---------- ① 粒子负载面: 50 火稳态存活数逐档上限(参数×寿命的确定性数学) ---------- */
test('基准·粒子面: 50 火全额档稳态——旋涡恰 16/火, 火苗烟存活数不破参数上界', () => {
  const fx = CampfireFxCore.mkCampfireFx({distOf: () => 10}); /* 全部 ≤40 格 */
  const cells = mkGrid50();
  warmFx(fx, cells, 12); /* 12s: 越过渐起 0.5s+最长寿命 4.5s, 稳态 */

  assert.strictEqual(fx.activeCount(), 50, '50 座全开');
  let full = 0; let near = 0; let totalAlive = 0;
  for (const c of cells) {
    const em = fx.emitters(c.x, c.y, c.z);
    const ps = fx.particles(c.x, c.y, c.z);
    assert.ok(em, '稳态格发射器快照可达');
    if (em.budget === 'full') full++; else if (em.budget === 'near') near++;
    /* 同距排序 tie-break 按键序: 恰 3 座全额、余 47 座降半(§5.9 NEAR_N=3) */
    assert.strictEqual(ps.vortex.length, em.budget === 'full' ? 16 : 8,
        '旋涡激活数=档位数(全额 16/降半 8, 渐起期满)');
    /* 火苗: v1.10 §5.2 转性降档——全额 2/s×寿命上界 0.7s=1.4 → 存活 ≤2; 降半 1/s×0.7=0.7 → ≤1 */
    assert.ok(ps.flame.length <= (em.budget === 'full' ? 2 : 1),
        '火苗存活数不破 rate×lifeMax 上界 (v1.10 降档 2/1 粒/s, ' + em.budget + ' 档实测 ' + ps.flame.length + ')');
    /* 烟: 恒 2/s(预算不降档/渐弱不衰减)×寿命上界 4.5s=9 → ≤10 */
    assert.ok(ps.smoke.length <= 10,
        '烟存活数不破 2/s×4.5s 上界 (实测 ' + ps.smoke.length + ')');
    totalAlive += ps.flame.length + ps.smoke.length + ps.vortex.length;
  }
  assert.strictEqual(full, 3, '全额档恰 3 座');
  assert.strictEqual(near, 47, '降半档恰 47 座');
  /* 稳态总存活宽松结构上界(50×(2+10+16)=1400, v1.10 降档重算; 实测量级见基准报告,
     此处只防翻倍级漂移) */
  assert.ok(totalAlive <= 1400, '50 火稳态总存活 ≤ 结构上界 (实测 ' + totalAlive + ')');
});

test('基准·粒子面: 远火档(>40 格)只留烟——火苗清零/旋涡归零/柔柱透明度乘子 0', () => {
  /* 摆 10 座: 前 5 座距 10(降半档), 后 5 座距 100(远火档);
     排序后距 10 的前 3 座吃全额席, 第 4/5 座 near, 距 100 的全 far(§5.9: >40 只留烟,
     且全额席只认距排序不豁免远火——i<NEAR_N 判在 far 判之前, 远火 3 座同裁) */
  const cells = [];
  for (let i = 0; i < 5; i++) cells.push({x: i, y: 1, z: 0});
  for (let i = 0; i < 5; i++) cells.push({x: i, y: 1, z: 100});
  const fx = CampfireFxCore.mkCampfireFx({
    distOf: (x, y, z) => (z >= 100 ? 100 : 10),
  });
  warmFx(fx, cells, 12);
  for (const c of cells) {
    const em = fx.emitters(c.x, c.y, c.z);
    const ps = fx.particles(c.x, c.y, c.z);
    if (c.z >= 100) {
      assert.strictEqual(em.budget, 'far', '距 100 座判 far');
      assert.strictEqual(em.flame.rate, 0, 'far 火苗速率 0');
      assert.strictEqual(ps.flame.length, 0, 'far 火苗存量清零(寿命 ≤0.7s 已老光)');
      assert.strictEqual(em.vortex.count, 0, 'far 旋涡档位数 0');
      assert.strictEqual(ps.vortex.length, 0, 'far 旋涡存量 0');
      assert.strictEqual(em.column.opacityScale, 0, 'far 柔柱透明度乘子 0');
      assert.strictEqual(em.smoke.rate, 2, 'far 烟恒满额(§5.9 只留烟柱)');
    } else {
      assert.ok(em.budget === 'full' || em.budget === 'near', '距 10 座全 near/full');
      assert.strictEqual(em.smoke.rate, 2, 'near 烟恒满额');
    }
  }
});

test('基准·粒子面: 低核分档复验(IS_LOWCORE_TOUCH 口径)——参数减半, 稳态总存活严格更少', () => {
  const cells = mkGrid50();
  const hi = CampfireFxCore.mkCampfireFx({distOf: () => 10});
  const lo = CampfireFxCore.mkCampfireFx({lowcore: true, distOf: () => 10});
  assert.strictEqual(hi.params.flame.rate, 2, '桌面火苗 2/s(v1.10 §5.2 转性降档)');
  assert.strictEqual(lo.params.flame.rate, 1, '低核火苗 1/s(v1.10 降档 3→1 后 §5.9 减半档)');
  assert.strictEqual(lo.params.smoke.rate, 1, '低核烟 1/s');
  assert.strictEqual(lo.params.vortex.count, 8, '低核旋涡 8');
  warmFx(hi, cells, 12);
  warmFx(lo, cells, 12);
  let hiTotal = 0; let loTotal = 0;
  for (const c of cells) {
    const hp = hi.particles(c.x, c.y, c.z);
    const lp = lo.particles(c.x, c.y, c.z);
    const lem = lo.emitters(c.x, c.y, c.z);
    assert.strictEqual(lp.vortex.length, lem.budget === 'full' ? 8 : 4,
        '低核旋涡激活=档位数(全额 8/降半 4, 档位数×§5.9 两级减半)');
    hiTotal += hp.flame.length + hp.smoke.length + hp.vortex.length;
    loTotal += lp.flame.length + lp.smoke.length + lp.vortex.length;
  }
  assert.ok(loTotal < hiTotal, '低核稳态总存活严格更少 (' + loTotal + ' < ' + hiTotal + ')');
});

/* ---------- ② 燃尽余韵 ≤2s 全清预算(T-C9 评审 SPEC-2 管辖, 50 火规模复核) ---------- */
test('基准·余韵面: 50 火齐燃尽——余韵 0.4s 后发射器退场, ≤2s 全格回收(存量尾巴散尽)', () => {
  const fx = CampfireFxCore.mkCampfireFx({distOf: () => 10});
  const cells = mkGrid50();
  warmFx(fx, cells, 2);
  for (const c of cells) fx.burnout(c.x, c.y, c.z);
  fx.tick(0.05); /* 喂一刻: 余韵 dAge=0.05s, 衰减起步(0.4s 线性降 0) */
  const em0 = fx.emitters(cells[0].x, cells[0].y, cells[0].z);
  assert.ok(em0 && em0.flame.rateScale < 1 && em0.flame.rateScale > 0,
      '燃尽即刻余韵可达且衰减已启(0<乘子<1)');
  for (let i = 0; i < 8; i++) fx.tick(0.05); /* 0.4s: 火苗发射窗关 */
  for (const c of cells) {
    assert.strictEqual(fx.emitters(c.x, c.y, c.z), null, '余韵期满发射器退场');
  }
  for (let i = 0; i < 32; i++) fx.tick(0.05); /* 再 1.6s: 累计 2.0s 全清 */
  assert.strictEqual(fx.cells().length, 0, '≤2s 全清预算: 50 格全部回收');
  assert.strictEqual(fx.activeCount(), 0, '活跃数归零');
});

/* ---------- ③ 光 BFS 成本面: 增量=无遮挡曼哈顿球精确计数 + 50 火连置次线性 ---------- */
/* 平地世界装具: W×D×H, 地面 y=0(不透光 id 1), 其上全空气; 光场布局
   idx=(y*D+z)*W+x(LightCore 契约)。篝火=id 81(光 15/不透光, config 同值)。 */
function mkFlatWorld() {
  const W = 96; const D = 96; const H = 48;
  const cellsB = new Uint8Array(W * D * H);
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) cellsB[(0 * D + z) * W + x] = 1; /* 地面 */
  }
  const sky = new Uint8Array(W * D * H);
  const block = new Uint8Array(W * D * H);
  const read = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return 0;
    return cellsB[(y * D + z) * W + x];
  };
  const write = (x, y, z, id) => {
    cellsB[(y * D + z) * W + x] = id;
  };
  const policy = {
    lightOf: (id) => (id === 81 ? 15 : 0),
    opaque: (id) => id !== 0,
  };
  return {W, D, H, sky, block, read, write, policy};
}
/* 无遮挡曼哈顿球空气格数(半空间 y≥1): 与六邻 BFS 逐格 −1 的传播级精确一致 */
function ballAirCount(W, D, sx, sy, sz) {
  let n = 0;
  for (let dx = -14; dx <= 14; dx++) {
    for (let dy = -14; dy <= 14; dy++) {
      for (let dz = -14; dz <= 14; dz++) {
        const x = sx + dx; const y = sy + dy; const z = sz + dz;
        if (x < 0 || y < 1 || z < 0 || x >= W || z >= D) continue;
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 14) n++;
      }
    }
  }
  return n;
}
function diffCount(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

test('基准·光 BFS 面: 首置增量=曼哈顿球精确计数(方块通道), 天空通道恰本格 1 格', () => {
  const w = mkFlatWorld();
  LightCore.computeAll(w.read, w.W, w.D, w.H, w.policy, w.sky, w.block);
  const sx = 48; const sy = 1; const sz = 48;
  const skyBefore = Uint8Array.from(w.sky);
  const blockBefore = Uint8Array.from(w.block);
  w.write(sx, sy, sz, 81); /* 放置: 空气→篝火(旧 id 0) */
  const box = LightCore.updateEdit(w.read, w.W, w.D, w.H, w.policy, sx, sy, sz, 0,
      w.sky, w.block);
  assert.ok(box, '首置有脏盒');
  const blockDiff = diffCount(blockBefore, w.block);
  const skyDiff = diffCount(skyBefore, w.sky);
  /* 方块通道: 自亮格 + 空气球内格(15−曼哈顿距离 > 0 ⇔ 距离 ≤14)——
     球计数含距离 0 的自亮格本体, 故恰等于球空气格数 */
  assert.strictEqual(blockDiff, ballAirCount(w.W, w.D, sx, sy, sz),
      '首置增量=自亮+无遮挡曼哈顿球精确计数 (实测 ' + blockDiff + ')');
  assert.strictEqual(skyDiff, 1, '天空通道增量恰本格(15→0)——平地列带重算零外溢');
  /* 脏盒受 15 级衰减半径约束(±14 传播 + 光源格) */
  assert.ok(box.x1 - box.x0 <= 29 && box.z1 - box.z0 <= 29, '脏盒半径不越 15 级衰减界');
});

test('基准·光 BFS 面: 50 火连置增量次线性(重叠递减), 撤光与增光对称', () => {
  const w = mkFlatWorld();
  LightCore.computeAll(w.read, w.W, w.D, w.H, w.policy, w.sky, w.block);
  /* 10×5 网格间距 8: 50 座, 球半径 14 相邻两两重叠 */
  const spots = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) spots.push({x: 6 + col * 8, y: 1, z: 6 + row * 8});
  }
  let total = 0; let first = 0;
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const before = Uint8Array.from(w.block);
    w.write(s.x, s.y, s.z, 81);
    LightCore.updateEdit(w.read, w.W, w.D, w.H, w.policy, s.x, s.y, s.z, 0,
        w.sky, w.block);
    const d = diffCount(before, w.block);
    if (i === 0) first = d;
    total += d;
  }
  assert.strictEqual(first, ballAirCount(w.W, w.D, spots[0].x, 1, spots[0].z),
      '首置精确计数复验');
  assert.ok(total < 50 * first,
      '50 火连置增量次线性(重叠递减): 总 ' + total + ' < 50×首置 ' + (50 * first));
  /* 撤光增量 ≤ 增光增量(50 火重叠下: 邻火光覆盖的格不净暗, 由重照种子保值——
     净暗格数=本源独享球, 对称性只在不重叠孤立场成立; 净暗 ≤ 球即不变量) */
  const s0 = spots[0];
  const before = Uint8Array.from(w.block);
  w.write(s0.x, s0.y, s0.z, 0);
  LightCore.updateEdit(w.read, w.W, w.D, w.H, w.policy, s0.x, s0.y, s0.z, 81,
      w.sky, w.block);
  const dark = diffCount(before, w.block);
  assert.ok(dark > 0 && dark <= first,
      '撤光净暗格数=本源独享球 ≤ 增光球 (实测 ' + dark + ' ≤ ' + first + ')');
});

/* ---------- ④ 柱查询成本面: 50 源注册表查询语义(O(燃火数) 的正确性面) ---------- */
function mkSim50() {
  const sim = UpdraftCore.mkSim({
    read: (x, y, z) => (y === 0 ? 1 : 0), /* 平地: y=0 实体 */
    solidOf: (id) => id !== 0,
  });
  const spots = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const s = {x: 6 + col * 8, y: 1, z: 6 + row * 8, r: 1, h: 20, lift: 3.0};
      spots.push(s);
      sim.add(s);
    }
  }
  return {sim, spots};
}

test('基准·柱查询面: 50 源注册表——邻柱命中/柱外空/重叠 max/遮挡截断/柱界两端含', () => {
  const {sim, spots} = mkSim50();
  assert.strictEqual(sim.count(), 50, '50 源在册');

  const s0 = spots[0]; /* (6,1,6) */
  /* 站火旁同地面可乘(柱界两端含: py=源 y) */
  const hit = sim.query(s0.x + 0.5, s0.y, s0.z + 0.5);
  assert.ok(hit, '邻柱命中');
  assert.strictEqual(hit.lift, 3.0, '升速=注册值');
  assert.strictEqual(hit.top, s0.y + 20, '柱顶=源 y+20');

  assert.strictEqual(sim.query(70, 5, 90), null, '柱外查询空(50 源下不误命中)');

  /* 重叠 max: 两源相距 2( Chebyshev 重叠带中点距两源各 1 )——同参源任一命中即托升(手工双源) */
  const sim2 = UpdraftCore.mkSim({read: (x, y, z) => (y === 0 ? 1 : 0), solidOf: (id) => id !== 0});
  sim2.add({x: 50, y: 1, z: 50, r: 1, h: 20, lift: 2});
  sim2.add({x: 52, y: 1, z: 50, r: 1, h: 20, lift: 5});
  const both = sim2.query(51, 3, 50); /* 距两源 Chebyshev 各 1 */
  assert.ok(both, '重叠带命中');
  assert.strictEqual(both.lift, 5, 'max 语义取最强柱');
  assert.strictEqual(both.top, 21, 'top 取命中柱值');

  /* 遮挡截断: 柱内立实体, 该列此高程无升力(50 源注册表在册不误命中他柱) */
  const blk = mkSim50();
  const t = blk.spots[3];
  const simRead = (x, y, z) => (y === 5 && x === t.x && z === t.z ? 1 : (y === 0 ? 1 : 0));
  const sim3 = UpdraftCore.mkSim({read: simRead, solidOf: (id) => id !== 0});
  for (const s of blk.spots) sim3.add(s);
  assert.strictEqual(sim3.query(t.x + 0.5, 8, t.z + 0.5), null, '遮挡列截断(脚上实体)');
  const near = sim3.query(t.x + 2.5, 8, t.z + 0.5); /* 同格列外 2 格: 距 t 柱 Chebyshev 2 不命中, 邻柱不受牵连 */
  const hitOther = sim3.query(spots[4].x + 0.5, 8, spots[4].z + 0.5);
  assert.strictEqual(near, null, '柱外 2 格不误命中');
  assert.ok(hitOther, '他柱不受遮挡牵连(50 源面查询语义不串)');

  /* 柱顶之外无升力(两端含的上界外) */
  assert.strictEqual(sim.query(s0.x + 0.5, s0.y + 21, s0.z + 0.5), null, '柱顶+1 空返回');
});

/* ---------- ⑤ 摆位装具形状防错(守门自检: 摆位与世界尺寸不越界) ---------- */
test('基准·装具自检: 50 火摆位确定性(同序重放同形)且落在合理域', () => {
  const a = mkGrid50();
  const b = mkGrid50();
  assert.deepStrictEqual(a, b, '摆位纯函数: 两次调用同形(禁随机)');
  for (const c of a) {
    assert.ok(c.x >= 0 && c.x <= 40 && c.z >= 0 && c.z <= 40, '摆位域 (网格 40×40 内)');
    assert.ok(c.y === 1, '摆位站地面');
  }
});
