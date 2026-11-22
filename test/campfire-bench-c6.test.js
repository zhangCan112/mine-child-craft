'use strict';
/* 篝火基准 C6' 重跑 · 错相结构断言+装具自检 (T-C13-R6 基准票) — node --test (零依赖)
   运行: node --test test/campfire-bench-c6.test.js
   票面: T-C13-R6(方案 .scratch/campfire/tc13r-arch/tc13r-arch.md §3-f——C6' 重立基线,
   旧 T-C6 收档作历史参照不作门槛, docs/campfire-tickets.md T-C6 行注记)。
   campfire-bench.test.js 族主题测试(conventions §1.9 先例), 对应模块:
   js/campfire-fx-core.js(flamePhase/flameFrameAt 错相确定性单源) +
   js/effects.js(campfireField 焰片 sheet 段)。
   断言面(票文范围 3/7——只做结构断言; 基准数值面禁自断阈值, 帧时/dc 判定落
   基准报告 .scratch/campfire/tc13r-c6/):
   ①错相(跑批观察面兑现): 基准场景 A 密集(step5)/B 疏散(step18) 50 火布局,
     固定 tick 序采样时刻(0.05s×36 拍=1.8s≈4 个翻页周期, 零墙钟)逐时刻帧分布
     恒覆盖全部 3 帧+相位散布非同值(fx-core 单元面 R-3 已锁 50 格两两全异,
     此处为基准场景集成面复读);
   ②确定性: 同 seed 重跑逐拍一致(双实例重跑+单实例 clear 重放两读法, 零裸随机);
   ③装具自检: sheet 形态读数结构性正确(空景零 sheet/50 火恰 1 张可绘段 600/
     拆清零残绘/clear 归零/B 景同形)——dc 架构承诺(静态件驻 chunk 批 0 专属
     dc+焰片全场共享 sheet +1, ADR-0020)的 node 侧形态, Chrome 侧 renderer.info
     读数与两口径一致形态对账归基准报告。
   红先红适用边界(如实申报): 本票为基准票, 零产品改动(票面红线), 断言面守的
   错相/sheet 保证已随 R-3/R-4/R-5 在库——套件断言出生即绿(守门兑现非红转绿);
   红证=判别力直证: 三支判别力探针(.scratch/campfire/tc13r-c6/probe-red-*.js,
   退化装具喂同款断言逻辑必 AssertionError, [red-cause] 机械分类 §7.4)随票入库。
   装具纪律: 确定性摆位禁随机(网格序); 采样走 fx 内时钟 tick 序(零墙钟);
   帧号纯函数不消费预算档(§5.9 档位与错相无关), 故 fx 缺省档注入。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {mkEl} = require('./helpers/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const CampfireFxCore = require(path.join(ROOT, 'js', 'campfire-fx-core.js'));

/* ---------- 基准场景装具(tc6 双口径同布局): 7×7 网格去 4 角=45+中轴补 5=50 座 ---------- */
function mkGrid50(step) {
  const out = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue;
      out.push({x: col * step, y: 1, z: row * step});
    }
  }
  for (let k = 0; k < 5; k++) out.push({x: (3 + k) * step, y: 1, z: 7 * step});
  assert.strictEqual(out.length, 50, '摆位装具自检: 50 座');
  return out;
}

const TICK = 0.05; /* 20tps 计划刻(fx 内时钟推进, 零墙钟) */
const MOMENTS = 36; /* 采样时刻数: 1.8s≈4 个翻页周期(frames3×frameS0.15=0.45s) */

/* 跑批采样协议: 逐拍推进+逐时刻全场景帧号读数(单源 fx.flameFrameAt) */
function sampleTrajectory(fx, cells) {
  const traj = [];
  for (let t = 0; t < MOMENTS; t++) {
    fx.tick(TICK);
    traj.push(cells.map((c) => fx.flameFrameAt(c.x, c.y, c.z)));
  }
  return traj;
}

function distAt(frames) {
  const d = [0, 0, 0];
  for (const f of frames) d[f]++;
  return d;
}

/* ---------- ① 错相·跑批观察面: 两景 36 采样时刻帧分布恒覆盖 3 帧 ---------- */
test('基准C6·错相面(跑批观察面): A 密集 50 火——固定 tick 序 36 采样时刻帧分布恒覆盖 3 帧', () => {
  const fx = CampfireFxCore.mkCampfireFx({});
  const cells = mkGrid50(5);
  for (const c of cells) fx.open(c.x, c.y, c.z);
  assert.strictEqual(fx.activeCount(), 50, '50 座全开');
  const traj = sampleTrajectory(fx, cells);
  assert.strictEqual(traj.length, MOMENTS, '采样读数恰 36 时刻');
  for (let t = 0; t < MOMENTS; t++) {
    const d = distAt(traj[t]);
    const covered = d.filter((n) => n > 0).length;
    assert.strictEqual(covered, 3,
        'A 密集 t=' + ((t + 1) * TICK).toFixed(2) + 's 帧分布覆盖 3 帧 (实测 [' + d.join(',') + '])');
  }
});

test('基准C6·错相面: B 疏散 50 火(远火混入)——同协议 36 采样时刻恒覆盖 3 帧(错相不因疏散塌缩)', () => {
  const fx = CampfireFxCore.mkCampfireFx({});
  const cells = mkGrid50(18);
  for (const c of cells) fx.open(c.x, c.y, c.z);
  assert.strictEqual(fx.activeCount(), 50, '50 座全开');
  const traj = sampleTrajectory(fx, cells);
  for (let t = 0; t < MOMENTS; t++) {
    const d = distAt(traj[t]);
    const covered = d.filter((n) => n > 0).length;
    assert.strictEqual(covered, 3,
        'B 疏散 t=' + ((t + 1) * TICK).toFixed(2) + 's 帧分布覆盖 3 帧 (实测 [' + d.join(',') + '])');
  }
});

/* ---------- ① 相位散布非同值: 两景 50 格两两全异+三分桶铺满 ---------- */
test('基准C6·错相面: 相位散布非同值——两景 50 格相位两两全异且 [0,1) 三分桶全覆盖', () => {
  for (const step of [5, 18]) {
    const fx = CampfireFxCore.mkCampfireFx({});
    const cells = mkGrid50(step);
    const ph = cells.map((c) => fx.flamePhase(c.x, c.y, c.z));
    assert.strictEqual(new Set(ph).size, 50,
        'step' + step + ': 50 格相位两两全异(非同值, 零齐相同相)');
    for (const p of ph) {
      assert.ok(p >= 0 && p < 1, '相位域 [0,1) (实测 ' + p + ')');
    }
    const buckets = [0, 0, 0];
    ph.forEach((p) => buckets[Math.min(2, Math.floor(p * 3))]++);
    assert.ok(buckets.every((n) => n > 0),
        'step' + step + ': 相位散布铺满三分桶 (实测 [' + buckets.join(',') + '])');
  }
});

/* ---------- ② 确定性: 同 seed 重跑逐拍一致(零裸随机) ---------- */
test('基准C6·确定性面: 同 seed 重跑逐拍一致——相位向量/帧轨迹/发射计数三面逐位同(零裸随机)', () => {
  const cells = mkGrid50(5);
  const run = () => {
    const fx = CampfireFxCore.mkCampfireFx({seed: 20261117});
    for (const c of cells) fx.open(c.x, c.y, c.z);
    const traj = sampleTrajectory(fx, cells);
    const phases = cells.map((c) => fx.flamePhase(c.x, c.y, c.z));
    const emitted = cells.map((c) => {
      const em = fx.emitters(c.x, c.y, c.z);
      return [em.flame.emitted, em.smoke.emitted];
    });
    return {fx, traj, phases, emitted};
  };
  const a = run();
  const b = run(); /* 读法一: 双实例同 seed 重跑 */
  assert.deepStrictEqual(b.phases, a.phases, '重跑相位向量逐位同');
  assert.deepStrictEqual(b.traj, a.traj, '重跑帧轨迹逐拍逐位同');
  assert.deepStrictEqual(b.emitted, a.emitted, '重跑发射计数逐火同');
  /* 读法二: 同实例 clear 重放(摘后重开同流) */
  a.fx.clear();
  for (const c of cells) a.fx.open(c.x, c.y, c.z);
  const traj2 = sampleTrajectory(a.fx, cells);
  const emitted2 = cells.map((c) => {
    const em = a.fx.emitters(c.x, c.y, c.z);
    return [em.flame.emitted, em.smoke.emitted];
  });
  assert.deepStrictEqual(traj2, a.traj, 'clear 重放帧轨迹逐拍逐位同');
  assert.deepStrictEqual(emitted2, a.emitted, 'clear 重放发射计数逐火同');
  /* 采样读数域自检(装具正确性前提) */
  for (const frames of a.traj) {
    for (const f of frames) {
      assert.ok(f === 0 || f === 1 || f === 2, '帧读数域 {0,1,2} (实测 ' + f + ')');
    }
  }
});

/* ---------- ③ 装具自检: effects vm 单载 sheet 形态读数(R-4 同款桩域) ---------- */
const TextureAtlas = (() => {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'texture-atlas.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, {filename: f});
  }
  return vm.runInContext('TextureAtlas', ctx);
})();

function mkThreeStub() {
  class Vec3 {
    constructor(x, y, z) {
      this.x = x || 0; this.y = y || 0; this.z = z || 0;
    }
    set(x, y, z) {
      this.x = x; this.y = y; this.z = z; return this;
    }
  }
  class Attribute {
    constructor(array, itemSize) {
      this.array = array; this.itemSize = itemSize;
      this.count = Math.ceil(array.length / itemSize);
      this.needsUpdate = false;
    }
    setUsage() {
      return this;
    }
  }
  class BufferGeometry {
    constructor() {
      this.attributes = {}; this.index = null;
      this.drawRange = {start: 0, count: Infinity};
    }
    setAttribute(name, attr) {
      this.attributes[name] = attr; return this;
    }
    setDrawRange(start, count) {
      this.drawRange = {start, count}; return this;
    }
    setIndex(idx) {
      this.index = Array.isArray(idx) ?
        new Attribute(Uint32Array.from(idx), 1) : idx;
      return this;
    }
    dispose() {}
  }
  function mkColor(c) {
    return {value: c === undefined ? null : c, set(v) {
      this.value = v; return this;
    }};
  }
  class MeshBasicMaterial {
    constructor(o) {
      o = o || {};
      this.color = mkColor(o.color);
      this.transparent = o.transparent === true;
      this.opacity = o.opacity === undefined ? 1 : o.opacity;
      this.depthWrite = o.depthWrite !== false;
      this.side = o.side;
      this.alphaTest = o.alphaTest === undefined ? 0 : o.alphaTest;
      this.vertexColors = o.vertexColors === true;
      this.map = o.map === undefined ? null : o.map;
    }
    dispose() {}
  }
  class MeshLambertMaterial extends MeshBasicMaterial {}
  class Mesh {
    constructor(geo, mat) {
      this.geometry = geo; this.material = mat;
      this.visible = true; this.frustumCulled = true;
      this.position = new Vec3(); this.rotation = new Vec3();
      this.scale = {
        x: 1, y: 1, z: 1,
        set(x, y, z) {
          this.x = x; this.y = y; this.z = z; return this;
        },
        setScalar(s) {
          this.x = s; this.y = s; this.z = s; return this;
        },
      };
    }
  }
  class Group {
    constructor() {
      this.children = [];
    }
    add(c) {
      this.children.push(c);
    }
    remove(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
    }
  }
  class BoxGeometry {
    constructor() {}
  }
  class SphereGeometry {
    constructor() {}
  }
  class CylinderGeometry {
    constructor() {}
  }
  return {
    BoxGeometry, SphereGeometry, CylinderGeometry,
    MeshLambertMaterial, MeshBasicMaterial, Mesh, Group,
    BufferGeometry, BufferAttribute: Attribute,
    Float32BufferAttribute: Attribute,
    Vector3: Vec3,
    DoubleSide: 2,
    DynamicDrawUsage: 'DYNAMIC',
  };
}

test('基准C6·装具自检: sheet 形态读数结构性正确——空景零 sheet/50 火恰 1 张可绘段 600/拆清零残绘/clear 归零(B 景同形)', () => {
  const stub = mkThreeStub();
  const atlas = {map: {isAtlasMap: true}}; /* atlasMat 桩: 只认 .map 身份(生产=world.js 共享图集材质) */
  const scene = {
    children: [],
    add(o) {
      this.children.push(o);
    },
    remove(o) {
      const i = this.children.indexOf(o);
      if (i >= 0) this.children.splice(i, 1);
    },
  };
  const sandbox = {
    THREE: stub, scene, atlasMat: atlas, TextureAtlas,
    document: {getElementById: () => mkEl('div')},
    performance: {now: () => 0},
    IS_TOUCH: false,
    console: {log() {}, warn() {}, error() {}},
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'effects.js'), 'utf8'),
      ctx, {filename: 'js/effects.js'});
  const Fx = vm.runInContext('Fx', ctx);
  const sheets = () => scene.children.filter((m) => m && m.material && m.material.map === atlas.map);
  const drawableOf = (mesh) => mesh.geometry.drawRange.count;

  /* 空景: 挂场零在册格——惰性零 sheet(dc 形态 0) */
  const fx = CampfireFxCore.mkCampfireFx({});
  Fx.campfireField(fx);
  Fx.update(1 / 60);
  assert.strictEqual(sheets().length, 0, '空景读数: 零在册格零 sheet(惰性建)');

  /* A 密集 50 火: 恰 1 张共享 sheet, 可绘段=50×12 索引(calls>0 的 node 侧形态) */
  const cellsA = mkGrid50(5);
  for (const c of cellsA) fx.open(c.x, c.y, c.z);
  Fx.update(1 / 60);
  const sh = sheets();
  assert.strictEqual(sh.length, 1, '50 火读数: 恰 1 张共享 sheet(焰片面 dc 形态 +1)');
  assert.strictEqual(drawableOf(sh[0]), 50 * 12,
      '可绘段读数=50 火×12 索引=600(>0 且与在册格数同拍)');
  assert.strictEqual(fx.activeCount(), 50, 'fx 侧在册 50 与 sheet 读数对账');

  /* 跑批形态: 固定 tick 序 36 拍逐拍 update——可绘段恒定, 帧读数在域 */
  for (let t = 0; t < MOMENTS; t++) {
    fx.tick(TICK);
    Fx.update(TICK);
    assert.strictEqual(drawableOf(sh[0]), 50 * 12,
        '拍 ' + t + ' 可绘段恒定(稳态零 GL 缓冲替换形态)');
    for (const c of cellsA) {
      const f = fx.flameFrameAt(c.x, c.y, c.z);
      assert.ok(f === 0 || f === 1 || f === 2, '帧读数域 {0,1,2} (实测 ' + f + ')');
    }
  }

  /* 拆清: 全 dig——sheet 残壳在场但可绘段 0(0 dc 形态), fx 格清零 */
  for (const c of cellsA) fx.dig(c.x, c.y, c.z);
  Fx.update(1 / 60);
  assert.strictEqual(sheets().length, 1, '拆清读数: sheet 残壳仍在场(摘除产权归 removeField/clear)');
  assert.strictEqual(drawableOf(sh[0]), 0, '拆清读数: 可绘段 0(零 dc 形态)');
  assert.strictEqual(fx.cells().length, 0, '拆清零残留: fx 在册格清零');

  /* clear 归零 + B 疏散同形复验 */
  Fx.clear();
  assert.strictEqual(sheets().length, 0, 'clear 读数: sheet 归零(dispose 产权随场)');
  const fx2 = CampfireFxCore.mkCampfireFx({});
  Fx.campfireField(fx2);
  const cellsB = mkGrid50(18);
  for (const c of cellsB) fx2.open(c.x, c.y, c.z);
  Fx.update(1 / 60);
  const sh2 = sheets();
  assert.strictEqual(sh2.length, 1, 'B 疏散 50 火同形: 恰 1 张 sheet');
  assert.strictEqual(drawableOf(sh2[0]), 50 * 12,
      'B 景可绘段读数=600(两景同形——两口径一致形态的 node 侧)');
});
