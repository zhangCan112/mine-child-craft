'use strict';
/* ============================================================
   T-C6 基准 · node 侧计时面(真实钟采样, 非断言) — 一次性基准装具
   ------------------------------------------------------------
   票文要求「可脚本化断言」的计时面补充: 确定性负载构造(50 火同口径)
   + 真实钟(process.hrtime)帧时/单操作耗时分布采样。阈值判定不在本
   脚本(不自断, 派令纪律)——数字落盘 .scratch/campfire/tc6-bench-*.log,
   判定归基准报告(引用 spec §7 成本构成)。
   四个采样面(全 node 侧, 无 GPU):
   ① fx-core tick: 50 火稳态每 tick(1/20s) 推进耗时(纯逻辑 CPU 面);
   ② effects.js stepFields: 渲染适配器逐帧同步耗时(THREE 桩, vm 笼装载,
      tc8b render.js 先例形态)——50 格×51 mesh 摆位面;
   ③ light-core updateEdit: 50 火逐个放置的增量光 BFS 耗时(重叠球场景);
   ④ updraft-core query: 50 源注册表单次查询耗时(引擎滑翔帧缝同签名)。
   用法: node .scratch/campfire/tc6-bench-node.js
   ============================================================ */
const { hrtime } = require('node:process');
const vm = require('node:vm');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const CampfireFxCore = require(path.join(ROOT, 'js', 'campfire-fx-core.js'));
const LightCore = require(path.join(ROOT, 'js', 'light-core.js'));
const UpdraftCore = require(path.join(ROOT, 'js', 'updraft-core.js'));

const DT_TICK = 0.05; /* 20tps 计划刻 */
const DT_FRAME = 1 / 60; /* 60fps 帧步 */

/* ---------- 计时装具 ---------- */
function nowUs() { return Number(hrtime.bigint() / 1000n) / 1000; } /* μs */
function sample(run, n) {
  const xs = [];
  for (let i = 0; i < n; i++) {
    const t0 = nowUs();
    run(i);
    xs.push(nowUs() - t0);
  }
  xs.sort((a, b) => a - b);
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const pct = (p) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
  return {n: xs.length, mean, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: xs[xs.length - 1]};
}
/* 50 火确定性摆位(与 test/campfire-bench.test.js 同口径装具) */
function mkGrid50() {
  const out = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue;
      out.push({x: col * 5, y: 1, z: row * 5});
    }
  }
  out.push({x: 15, y: 1, z: 35}, {x: 20, y: 1, z: 35}, {x: 25, y: 1, z: 35},
      {x: 30, y: 1, z: 35}, {x: 35, y: 1, z: 35});
  return out;
}

const report = {faces: {}};

/* ---------- ① fx-core tick: 50 火稳态推进 ---------- */
{
  const fx = CampfireFxCore.mkCampfireFx({distOf: () => 10}); /* 同屏 50 座≤40 格: 3 full+47 near */
  const cells = mkGrid50();
  for (const c of cells) fx.open(c.x, c.y, c.z);
  for (let i = 0; i < 240; i++) fx.tick(DT_TICK); /* 12s 稳态 */
  let alive = 0;
  for (const c of cells) {
    const ps = fx.particles(c.x, c.y, c.z);
    alive += ps.flame.length + ps.smoke.length + ps.vortex.length;
  }
  report.faces.fxTick = {
    sample: sample(() => fx.tick(DT_TICK), 400),
    unit: 'ms/tick(20tps)',
    particlesAlive: alive,
    particlesPerFire: alive / 50,
  };
  /* 低核档对照 */
  const lo = CampfireFxCore.mkCampfireFx({lowcore: true, distOf: () => 10});
  for (const c of cells) lo.open(c.x, c.y, c.z);
  for (let i = 0; i < 240; i++) lo.tick(DT_TICK);
  let aliveLo = 0;
  for (const c of cells) {
    const ps = lo.particles(c.x, c.y, c.z);
    aliveLo += ps.flame.length + ps.smoke.length + ps.vortex.length;
  }
  report.faces.fxTickLowcore = {
    sample: sample(() => lo.tick(DT_TICK), 400),
    unit: 'ms/tick(20tps)',
    particlesAlive: aliveLo,
    particlesPerFire: aliveLo / 50,
  };
}

/* ---------- ② effects.js stepFields: 渲染适配器同步面(THREE 桩 vm 笼) ---------- */
{
  /* 最小 THREE 桩: 只保 effects.js 路径触到的面(Mesh/Group/材质/几何/Vector3) */
  const V3 = class {
    constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new V3(this.x, this.y, this.z); }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this; }
    divideScalar(k) { this.x /= k; this.y /= k; this.z /= k; return this; }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    normalize() { const l = this.length() || 1; return this.divideScalar(l); }
  };
  let meshCount = 0; /* 逐 mesh 计数(scene.add 只见 Group, 真实 draw-call 面在 mesh) */
  const RealMesh = class {
    constructor(geo, mat) {
      this.geometry = geo; this.material = mat; this.visible = true;
      this.position = new V3(); this.scale = {
        set: (x, y, z) => { this.scale.x = x; this.scale.y = y; this.scale.z = z; },
        setScalar: (s) => { this.scale.x = s; this.scale.y = s; this.scale.z = s; },
        x: 1, y: 1, z: 1,
      };
      this.quaternion = {setFromUnitVectors() {}};
      this.rotation = {x: 0, y: 0, z: 0};
      meshCount++; /* 逐 mesh 计数(scene.add 只见 Group, 真实 draw-call 面在 mesh) */
    }
  };
  const stubTHREE = {
    Vector3: V3,
    Color: class { constructor() {} set() { return this; } },
    BoxGeometry: class { constructor() {} },
    SphereGeometry: class { constructor() {} },
    CylinderGeometry: class { constructor() {} },
    BufferGeometry: class { setFromPoints() { return this; } },
    MeshBasicMaterial: class {
      constructor(o) { o = o || {}; this.color = new stubTHREE.Color(); this.opacity = 1; Object.assign(this, o); this.color = new stubTHREE.Color(); }
      dispose() {}
    },
    MeshLambertMaterial: class {
      constructor(o) { o = o || {}; this.color = new stubTHREE.Color(); this.opacity = 1; Object.assign(this, o); this.color = new stubTHREE.Color(); }
      dispose() {}
    },
    LineBasicMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
    DoubleSide: 2,
    Mesh: RealMesh,
    Line: class {
      constructor(geo, mat) { this.geometry = geo; this.material = mat; }
    },
    Group: class { constructor() { this.children = []; } add(...ms) { this.children.push(...ms); } },
  };
  const stubScene = {add() {}, remove() {}};
  const src = fs.readFileSync(path.join(ROOT, 'js', 'effects.js'), 'utf8') + '\nFx';
  const ctx = vm.createContext({
    THREE: stubTHREE, scene: stubScene, sfx: () => {}, console,
    setTimeout, clearTimeout,
    document: {getElementById: () => ({style: {}, textContent: ''})},
  });
  const Fx = vm.runInContext(src, ctx, {filename: 'effects.js'});
  const fx = CampfireFxCore.mkCampfireFx({distOf: () => 10});
  const cells = mkGrid50();
  for (const c of cells) fx.open(c.x, c.y, c.z);
  for (let i = 0; i < 240; i++) fx.tick(DT_FRAME);
  Fx.campfireField(fx);
  Fx.update(DT_FRAME); /* 首帧建池(50 格×51 mesh) */
  report.faces.fxFieldsSync = {
    sample: sample(() => Fx.update(DT_FRAME), 200),
    unit: 'ms/frame(60fps 口径)',
    fieldMeshes: meshCount,
  };
  Fx.clear();
}

/* ---------- ③ light-core updateEdit: 50 火连置增量光 BFS ---------- */
{
  const W = 96; const D = 96; const H = 48;
  const cellsB = new Uint8Array(W * D * H);
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) cellsB[(0 * D + z) * W + x] = 1;
  }
  const sky = new Uint8Array(W * D * H);
  const block = new Uint8Array(W * D * H);
  const read = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return 0;
    return cellsB[(y * D + z) * W + x];
  };
  const policy = {lightOf: (id) => (id === 81 ? 15 : 0), opaque: (id) => id !== 0};
  LightCore.computeAll(read, W, D, H, policy, sky, block);
  const spots = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) spots.push({x: 6 + col * 8, y: 1, z: 6 + row * 8});
  }
  const perPlace = [];
  for (const s of spots) {
    const t0 = nowUs();
    /* 照 setBlockLit 缝: 写格+增量(生产路径 editBlock→setBlockLit 同参序) */
    cellsB[(s.y * D + s.z) * W + s.x] = 81;
    LightCore.updateEdit(read, W, D, H, policy, s.x, s.y, s.z, 0, sky, block);
    perPlace.push(nowUs() - t0);
  }
  perPlace.sort((a, b) => a - b);
  const pct = (p) => perPlace[Math.min(perPlace.length - 1, Math.floor(p * perPlace.length))];
  report.faces.lightBfsPlace = {
    unit: 'ms/place(含写格, 不含网格重建)',
    n: perPlace.length, mean: perPlace.reduce((s, v) => s + v, 0) / perPlace.length,
    p50: pct(0.5), p95: pct(0.95), max: perPlace[perPlace.length - 1],
  };
}

/* ---------- ④ updraft-core query: 50 源注册表单查 ---------- */
{
  const sim = UpdraftCore.mkSim({read: (x, y, z) => (y === 0 ? 1 : 0), solidOf: (id) => id !== 0});
  const spots = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const s = {x: 6 + col * 8, y: 1, z: 6 + row * 8, r: 1, h: 20, lift: 3.0};
      spots.push(s);
      sim.add(s);
    }
  }
  const inside = spots[0]; /* 玩家站火旁: 命中路径(含遮挡列扫 ≤20 格) */
  let calls = 0;
  report.faces.updraftQuery = {
    inside: sample(() => { sim.query(inside.x + 0.5, 5, inside.z + 0.5); calls++; }, 20000),
    outside: sample(() => { sim.query(90, 5, 90); calls++; }, 20000),
    unit: 'μs/query',
    sources: sim.count(),
  };
}

const line = 'TC6NODEJSON:' + JSON.stringify(report);
console.log(line);
const fsOut = path.join(__dirname, 'tc6-bench-node.log');
fs.writeFileSync(fsOut, line + '\n', 'utf8');
console.log('written: ' + fsOut);
