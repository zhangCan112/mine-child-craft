'use strict';
/* T-C13-R4 绿方调试脚本二(临时, 不入库): 复演 R4-6 在 assertCross :246 修正
   (hi-lo → yHi-yLo)后的全部剩余断言面, 证明实现侧无后续坑 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {mkEl} = require('../test/helpers/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const TextureAtlas = (() => {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'texture-atlas.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, {filename: f});
  }
  return vm.runInContext('TextureAtlas', ctx);
})();
const CampfireFxCore = require('../js/campfire-fx-core.js');

const CF_FLAME_TILES = [74, 75, 76];
const TOL = 1e-4;

function mkThreeStub() {
  const disposed = [];
  class Vec3 {
    constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Attribute {
    constructor(array, itemSize) {
      this.array = array; this.itemSize = itemSize;
      this.count = Math.ceil(array.length / itemSize);
      this.needsUpdate = false;
    }
    setUsage() { return this; }
  }
  class BufferGeometry {
    constructor() { this.attributes = {}; this.index = null; }
    setAttribute(name, attr) { this.attributes[name] = attr; return this; }
    setIndex(idx) {
      this.index = Array.isArray(idx) ? new Attribute(Uint32Array.from(idx), 1) : idx;
      return this;
    }
    dispose() { disposed.push({kind: 'geometry', obj: this}); }
  }
  function mkColor(c) {
    return {value: c === undefined ? null : c, set(v) { this.value = v; return this; }};
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
    dispose() { disposed.push({kind: 'material', obj: this}); }
  }
  class MeshLambertMaterial extends MeshBasicMaterial {}
  class Mesh {
    constructor(geo, mat) {
      this.geometry = geo; this.material = mat;
      this.visible = true; this.frustumCulled = true;
      this.position = new Vec3(); this.rotation = new Vec3();
      this.scale = {x: 1, y: 1, z: 1, set() { return this; }, setScalar() { return this; }};
    }
  }
  class Group {
    constructor() { this.children = []; }
    add(c) { this.children.push(c); }
    remove(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
    }
  }
  class BoxGeometry { constructor() {} }
  class SphereGeometry { constructor() {} }
  class CylinderGeometry { constructor() {} }
  return {
    disposed, BoxGeometry, SphereGeometry, CylinderGeometry,
    MeshLambertMaterial, MeshBasicMaterial, Mesh, Group,
    BufferGeometry, BufferAttribute: Attribute, Float32BufferAttribute: Attribute,
    Vector3: Vec3, DoubleSide: 2, DynamicDrawUsage: 'DYNAMIC',
  };
}

const stub = mkThreeStub();
const atlas = {map: {isAtlasMap: true}};
const scene = {
  children: [],
  add(o) { this.children.push(o); },
  remove(o) {
    const i = this.children.indexOf(o);
    if (i >= 0) this.children.splice(i, 1);
  },
};
const sandbox = {
  THREE: stub, scene, atlasMat: atlas, TextureAtlas,
  document: {getElementById: () => mkEl('div')},
  performance: {now: () => 0}, IS_TOUCH: false,
  console: {log() {}, warn() {}, error() {}},
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'effects.js'), 'utf8'),
    ctx, {filename: 'js/effects.js'});
const Fx = vm.runInContext('Fx', ctx);

const mkFx = () => CampfireFxCore.mkCampfireFx({});
const key = (c) => c.x + ',' + c.y + ',' + c.z;
const sheetOf = () =>
  scene.children.filter((m) => m && m.material && m.material.map === atlas.map);
const worldVert = (mesh, i) => {
  const a = mesh.geometry.attributes.position.array;
  return [a[i * 3] + mesh.position.x, a[i * 3 + 1] + mesh.position.y,
    a[i * 3 + 2] + mesh.position.z];
};
/* assertCross 的修正版(:246 用 yHi-yLo)——复演几何断言 */
function countNear(vals, v) {
  return vals.filter((x) => Math.abs(x - v) < TOL).length;
}
function assertCrossFixed(mesh, slots, cell, tag) {
  const v = slots.map((i) => worldVert(mesh, i));
  let za = null; let xb = null;
  for (const cand of v.map((p) => p[2])) {
    if (countNear(v.map((p) => p[2]), cand) === 4) { za = cand; break; }
  }
  for (const cand of v.map((p) => p[0])) {
    if (countNear(v.map((p) => p[0]), cand) === 4) { xb = cand; break; }
  }
  assert.ok(za !== null, tag + ': 缺 ±Z 法线片');
  assert.ok(xb !== null, tag + ': 缺 ±X 法线片');
  const qa = v.filter((p) => Math.abs(p[2] - za) < TOL);
  const qb = v.filter((p) => Math.abs(p[0] - xb) < TOL);
  assert.strictEqual(qa.length, 4, tag + ': ±Z 片顶点数应恰 4');
  assert.strictEqual(qb.length, 4, tag + ': ±X 片顶点数应恰 4');
  for (const [q, spanAxis, tag2] of [[qa, 0, '±Z 片'], [qb, 2, '±X 片']]) {
    const lo = Math.min(...q.map((p) => p[spanAxis]));
    const hi = Math.max(...q.map((p) => p[spanAxis]));
    const yLo = Math.min(...q.map((p) => p[1]));
    const yHi = Math.max(...q.map((p) => p[1]));
    assert.ok(Math.abs(hi - lo - 0.35) < 1e-3, tag + ' ' + tag2 + ': 宽应 0.35');
    assert.ok(yHi - yLo > 0.4 - 1e-3 && yHi - yLo < 0.5 + 1e-3,
        tag + ' ' + tag2 + ': 高应在 0.4~0.5(修正版 yHi-yLo), 实得 ' + (yHi - yLo).toFixed(4));
  }
  const lz = za - cell.z; const lx = xb - cell.x;
  assert.ok(lz > 0.3 && lz < 0.7, tag + ': ±Z 片固定轴应在格内中缝');
  assert.ok(lx > 0.3 && lx < 0.7, tag + ': ±X 片固定轴应在格内中缝');
  const qaX = qa.map((p) => p[0]); const qbZ = qb.map((p) => p[2]);
  assert.ok(xb >= Math.min(...qaX) - TOL && xb <= Math.max(...qaX) + TOL,
      tag + ': ±X 片不在 ±Z 片的 X 展开范围内');
  assert.ok(za >= Math.min(...qbZ) - TOL && za <= Math.max(...qbZ) + TOL,
      tag + ': ±Z 片不在 ±X 片的 Z 展开范围内');
}
function vertsByCell(mesh, cells) {
  const out = new Map(cells.map((c) => [key(c), []]));
  const n = mesh.geometry.attributes.position.count;
  for (let i = 0; i < n; i++) {
    const [wx, wy, wz] = worldVert(mesh, i);
    const hit = cells.find((c) =>
      wx >= c.x && wx < c.x + 1 && wy >= c.y && wy < c.y + 1 && wz >= c.z && wz < c.z + 1);
    assert.ok(hit, '焰片顶点 ' + i + ' 落在任何 open 格外');
    out.get(key(hit)).push(i);
  }
  return out;
}
function tileOfUv(mesh, slots) {
  const a = mesh.geometry.attributes.uv.array;
  const us = slots.map((s) => a[s * 2]);
  const vs = slots.map((s) => a[s * 2 + 1]);
  const c = Math.round(Math.min(...us) * 16);
  const r = 16 - Math.round(Math.max(...vs) * 16);
  return r * 16 + c;
}

test('D5: R4-6 全剩余断言面复演(修正版 assertCross)', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  const cells50 = [];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      if ((i === 0 || i === 6) && (j === 0 || j === 6)) continue;
      cells50.push({x: 100 + i * 7, y: 25, z: 100 + j * 7});
    }
  }
  for (let k = 0; k < 5; k++) cells50.push({x: 200 + k * 9, y: 25, z: 100});
  assert.strictEqual(cells50.length, 50);
  for (const c of cells50) fx.open(c.x, c.y, c.z);
  fx.tick(0.07);
  Fx.update(0.05);
  const sheets = sheetOf();
  assert.strictEqual(sheets.length, 1, '恰一张共享 sheet');
  const s = sheets[0];
  assert.strictEqual(s.geometry.attributes.position.count, 400, '50 火×8=400');
  const byCell = vertsByCell(s, cells50);
  const frames = new Set();
  for (const c of cells50) {
    const slots = byCell.get(key(c));
    assert.strictEqual(slots.length, 8, '火(' + key(c) + ') 恰 8 顶点');
    assertCrossFixed(s, slots, c, '火(' + key(c) + ')');
    const want = CF_FLAME_TILES[fx.flameFrameAt(c.x, c.y, c.z)];
    assert.strictEqual(tileOfUv(s, slots), want,
        '火(' + key(c) + ') 渲染帧 tile 必须=74+flameFrameAt(单源镜像)');
    frames.add(fx.flameFrameAt(c.x, c.y, c.z));
  }
  console.log('[D5] 帧分布 size =', frames.size, [...frames].sort().join(','));
  assert.ok(frames.size >= 2, '帧分布应 ≥2 帧, 实得 ' + frames.size);
  Fx.removeField(h);
});

test('D6: R4-2 全剩余断言面复演(修正版 assertCross)', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  const FIRE = {x: 10, y: 25, z: 10};
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  Fx.update(0.05);
  const s = sheetOf()[0];
  assert.ok(s);
  const geo = s.geometry;
  assert.strictEqual(geo.attributes.position.count, 8, '单火恰 8 顶点');
  assert.ok(geo.index);
  assert.strictEqual(geo.index.count, 12, '单火恰 12 索引');
  for (const idx of geo.index.array) {
    assert.ok(idx >= 0 && idx < 8, '索引越界');
  }
  const slots = vertsByCell(s, [FIRE]).get(key(FIRE));
  assert.strictEqual(slots.length, 8);
  assertCrossFixed(s, slots, FIRE, '单火');
  Fx.removeField(h);
});
