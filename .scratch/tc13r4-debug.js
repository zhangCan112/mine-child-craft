'use strict';
/* T-C13-R4 绿方调试脚本(临时, 不入库): 复现 R4-2/R4-4/R4-6/R4-8 红因 */
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

const FIRE = {x: 10, y: 25, z: 10};
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

/* ---------- D1: R4-6 场景 50 火, 看每火 position ---------- */
test('D1: 50 火 attach 后 position 走查', () => {
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
  for (const c of cells50) fx.open(c.x, c.y, c.z);
  fx.tick(0.07);
  Fx.update(0.05);
  const s = sheetOf()[0];
  assert.ok(s, 'sheet 在场');
  const pos = s.geometry.attributes.position;
  console.log('[D1] position.count =', pos.count, 'array.len =', pos.array.length);
  const n = pos.count;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const [wx, wy, wz] = worldVert(s, i);
    const hit = cells50.find((c) =>
      wx >= c.x && wx < c.x + 1 && wy >= c.y && wy < c.y + 1 && wz >= c.z && wz < c.z + 1);
    if (!hit) {
      bad++;
      if (bad <= 4) console.log('[D1] 坏顶点', i, '=', wx, wy, wz);
    }
  }
  console.log('[D1] 坏顶点总数 =', bad, '/', n);
  Fx.removeField(h);
});

/* ---------- D2: R4-8 场景, 看 sheetOf 序与各 sheet n ---------- */
test('D2: 两场 sheet 的 children 序与火数', () => {
  Fx.clear();
  const fx2 = mkFx();
  const fx3 = mkFx();
  const h2 = Fx.campfireField(fx2);
  const h3 = Fx.campfireField(fx3);
  fx2.open(FIRE.x, FIRE.y, FIRE.z);
  fx3.open(30, 25, 10);
  Fx.update(0.05);
  const sheets = sheetOf();
  console.log('[D2] sheetOf().length =', sheets.length);
  sheets.forEach((m, idx) => {
    console.log('[D2] sheet[' + idx + '] fireCount =',
      m.geometry.attributes.position.count / 8);
  });
  Fx.removeField(h2);
  Fx.removeField(h3);
});

/* ---------- D3: R4-4 场景, quench 后零 open 格 sheet 在场性 ---------- */
test('D3: quench 后 cells 在册 sheet 空属性面', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.quench(FIRE.x, FIRE.y, FIRE.z);
  assert.ok(fx.cells().some((c) => key(c) === key(FIRE) && c.open === false));
  Fx.update(0.05);
  const s = sheetOf()[0];
  console.log('[D3] sheet 在场 =', !!s,
    ' attributes.position =', s ? (s.geometry.attributes.position && '有') : '-');
  console.log('[D3] fireCount =', s && s.geometry.attributes.position ?
    s.geometry.attributes.position.count / 8 : '(属性缺)');
  Fx.removeField(h);
});

/* ---------- D4: assertCross 矛盾复现(不改测试, 只数学复演) ---------- */
test('D4: assertCross :244 与 :246 对同一 hi-lo 的双约束', () => {
  const hi = 0.675; const lo = 0.325; const yHi = 0.71; const yLo = 0.26;
  const c244 = Math.abs(hi - lo - 0.35) < 1e-3;
  const c246 = hi - lo > 0.4 - 1e-3 && hi - lo < 0.5 + 1e-3;
  console.log('[D4] span=hi-lo =', hi - lo, ' 宽断言(:244)=', c244,
    ' 高断言条件用 hi-lo(:246)=', c246, ' 高断言若用 yHi-yLo =', yHi - yLo,
    ' →', yHi - yLo > 0.4 - 1e-3 && yHi - yLo < 0.5 + 1e-3);
  assert.ok(true);
});
