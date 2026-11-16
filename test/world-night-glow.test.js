'use strict';
/* 夜灯自发光面片广播缝 (js/world.js) — node --test (零依赖)
   运行: node --test test/world-night-glow.test.js
   对应票: T-NPC-15a 夜间氛围·门控机制(定稿 docs/town-night-ambiance-design.md
   §3.b/§5-E3; ADR-0017 决策 4)。命名沿 world-rings/world-integrity/
   world-vertexlight 的专题惯例(conventions §1.9 存量偏差); 装具同
   world-vertexlight 的手写迷你 THREE 桩形态(要读回材质 color 真实值),
   Color 构造器补 hex 解析(注册基色快照需构造即有 r/g/b — 真实 THREE
   Color 面如此)。
   被测 seam(机制不绑点位, 面片落位=15b 消费方):
   · registerNightGlow 注册缝(Basic 材质注册, 注册时 color=基色快照)
   · applyDaylight 广播段: 夜灯亮度 = 基色 × Daylight.nightGlow 因子,
     同一 50 tick 比较键节拍(world.js:178 先例), 窗外稳态恒值
   · 门控行为: dusk 渐亮/dawn 渐熄 50 tick 阶进、窗端点无跳变、
     窗内相邻键差有界(禁瞬亮瞬灭 §A.6)
   · 烘焙类零门控红线: 零逐帧 PointLight、setPlayerGlow 既有缝共存零触碰 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 迷你 THREE 桩: 只实现 world.js 触碰的表面(world-vertexlight 同款) ---------- */
function mkThree() {
  const T = {};
  T.Color = class {
    constructor(c) {
      if (typeof c === 'number') {
        this.r = ((c >> 16) & 0xff) / 255;
        this.g = ((c >> 8) & 0xff) / 255;
        this.b = (c & 0xff) / 255;
      }
    }
    setRGB(r, g, b) {
      this.r = r; this.g = g; this.b = b; return this;
    }
    setScalar(s) {
      this.r = s; this.g = s; this.b = s; return this;
    }
  };
  T.Vector3 = class {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x; this.y = y; this.z = z;
    }
    set(x, y, z) {
      this.x = x; this.y = y; this.z = z; return this;
    }
  };
  T.WebGLRenderer = class {
    constructor() {
      this.domElement = {}; this.capabilities = {getMaxAnisotropy: () => 8};
    }
    setPixelRatio() {}
    setSize() {}
  };
  T.Scene = class {
    constructor() {
      this.background = new T.Color(0); this.children = [];
    }
    add(o) {
      this.children.push(o);
    }
    remove(o) {
      const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1);
    }
  };
  T.Fog = class {
    constructor(c, n, f) {
      this.color = c; this.near = n; this.far = f;
    }
  };
  T.PerspectiveCamera = class {};
  T.AmbientLight = class {
    constructor(c, i) {
      this.intensity = i;
    }
  };
  T.DirectionalLight = class {
    constructor(c, i) {
      this.intensity = i; this.position = new T.Vector3();
    }
  };
  T.PointLight = class {
    constructor(c, i, d) {
      this.intensity = i; this.distance = d; this.visible = true; this.position = new T.Vector3();
    }
  };
  T.SpriteMaterial = class {
    constructor(o) {
      Object.assign(this, o);
    }
  };
  T.Sprite = class {
    constructor(m) {
      this.material = m; this.position = new T.Vector3(); this.scale = new T.Vector3();
      this.visible = true; this.userData = {};
    }
  };
  T.CanvasTexture = class {
    constructor(c) {
      this.canvas = c;
    }
  };
  T.NearestFilter = {}; T.NearestMipmapLinearFilter = {}; T.FrontSide = {}; T.DoubleSide = {};
  T.MeshLambertMaterial = class {
    constructor(o) {
      Object.assign(this, o); this.onBeforeCompile = null;
    }
  };
  T.MeshBasicMaterial = class {
    constructor(o) {
      Object.assign(this, o); this.color = this.color || new T.Color(0xffffff);
    }
  };
  T.BufferGeometry = class {
    constructor() {
      this.attrs = {};
    }
    setAttribute(n, a) {
      this.attrs[n] = a; return this;
    }
    setIndex(a) {
      this.attrs.index = a; return this;
    }
    dispose() {}
  };
  T.BufferAttribute = class {
    constructor(d, s) {
      this.src = d; this.itemSize = s; this.values = Array.from(d);
    }
  };
  T.Float32BufferAttribute = T.BufferAttribute;
  T.Uint32BufferAttribute = T.BufferAttribute;
  T.Mesh = class {
    constructor(g, m) {
      this.geometry = g; this.material = m;
      this.position = new T.Vector3(); this.rotation = {x: 0, y: 0, z: 0};
      this.scale = new T.Vector3();
    }
  };
  T.BoxGeometry = class {}; T.EdgesGeometry = class {}; T.PlaneGeometry = class {};
  T.Group = class {
    constructor() {
      this.children = []; this.visible = true;
    }
    add(o) {
      this.children.push(o);
    }
  };
  T.LineBasicMaterial = class {
    constructor(o) {
      Object.assign(this, o);
    }
  };
  T.LineSegments = class {
    constructor(g, m) {
      this.geometry = g; this.material = m; this.visible = true;
    }
  };
  return T;
}

/* 画布 2d 桩: 云朵/天体贴图绘制表面(world-vertexlight 同款, 产物无人读) */
function mkCanvas() {
  return {
    width: 0, height: 0,
    getContext: () => ({fillStyle: null, font: '', textAlign: '', textBaseline: '',
      fillRect() {}, fillText() {}}),
  };
}

function loadWorld() {
  const sandbox = {
    console: {log() {}, warn() {}, error() {}},
    THREE: mkThree(),
    document: {createElement: () => mkCanvas(), getElementById: () => ({appendChild() {}})},
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    location: {protocol: 'file:'},
    addEventListener() {},
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['config.js', 'daylight-core.js', 'light-core.js', 'voxel.js',
    'cascade-core.js', 'fluid-core.js', 'mesh-core.js', 'world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__w = {
      applyDaylight, setPlayerGlow, scene,
      /* 防御式探针: 缝缺位时取 null(红相=断言红, 非装具 ReferenceError — §7.4) */
      registerNightGlow: typeof registerNightGlow !== 'undefined' ? registerNightGlow : null,
      get dayCycleOn() { return dayCycleOn; }, set dayCycleOn(v) { dayCycleOn = v; },
      get dayTime() { return dayTime; }, set dayTime(v) { dayTime = v; },
    };
  `, ctx);
  return Object.assign(ctx.__w, {THREE: sandbox.THREE});
}

/* 载体 B 基色 #FFD89A(定稿 §2.2)桩材质: Basic 观感面 */
function mkGlowMat(T) {
  return new T.MeshBasicMaterial({color: new T.Color(0xFFD89A)});
}
const BASE_R = 0xff / 255;
const BASE_G = 0xd8 / 255;
const BASE_B = 0x9a / 255;

/* ============ 注册缝与夜稳写值 ============ */

test('registerNightGlow: 注册缝在位 · 夜稳(午夜)写基色满亮 · 零注册时 applyDaylight 不炸', () => {
  const w = loadWorld();
  assert.strictEqual(typeof w.registerNightGlow, 'function', '夜灯注册缝导出面在位');
  /* 零注册(15b 落位前的现状): 广播段空集零成本, 全窗驱动不炸 */
  w.dayCycleOn = true;
  w.dayTime = 18000;
  w.applyDaylight();
  /* 注册 #FFD89A 材质后, 夜稳段基色满亮(因子=1 → color=基色) */
  const mat = mkGlowMat(w.THREE);
  w.registerNightGlow(mat);
  w.applyDaylight();
  assert.ok(Math.abs(mat.color.r - BASE_R) < 1e-9 &&
      Math.abs(mat.color.g - BASE_G) < 1e-9 && Math.abs(mat.color.b - BASE_B) < 1e-9,
      '午夜(18000)夜灯因子=1: color=基色 #FFD89A 原值');
});

test('registerNightGlow: 窗端点与窗外稳态(白天 0 · 夜稳满 · 端点连续)· 关循环复位熄灯幂等', () => {
  const w = loadWorld();
  assert.strictEqual(typeof w.registerNightGlow, 'function', '夜灯注册缝导出面在位');
  const mat = mkGlowMat(w.THREE);
  w.registerNightGlow(mat);
  w.dayCycleOn = true;
  const glowAt = (t) => {
    w.dayTime = t;
    w.applyDaylight();
    return mat.color.g / BASE_G; /* 归一亮度(绿通道比) */
  };
  assert.strictEqual(glowAt(6000), 0, '正午熄稳');
  assert.strictEqual(glowAt(12039), 0, 'dusk 前一 tick 熄稳');
  assert.strictEqual(glowAt(12040), 0, 'dusk 窗起=0(端点连续)');
  assert.strictEqual(glowAt(13670), 1, 'dusk 窗止=满亮(端点连续)');
  assert.strictEqual(glowAt(18000), 1, '午夜亮稳');
  assert.strictEqual(glowAt(22330), 1, 'dawn 窗起=满亮(端点连续)');
  assert.strictEqual(glowAt(23961), 0, 'dawn 窗止=0(端点连续)');
  assert.strictEqual(glowAt(23962), 0, 'dawn 止后一 tick 熄稳');
  /* 关循环复位(dayCycleOn=false 以 tick 0 口径复位): 夜灯随白天口径熄灭, 幂等 */
  w.dayCycleOn = false;
  w.applyDaylight();
  assert.strictEqual(mat.color.g / BASE_G, 0, '复位白天口径: 夜灯熄');
  w.applyDaylight();
  assert.strictEqual(mat.color.g / BASE_G, 0, '复位幂等');
});

/* ============ 门控行为: 50 tick 阶进渐变(禁瞬亮瞬灭) ============ */

test('门控行为: dusk 窗 50 tick 阶进单调渐亮 · dawn 窗单调渐熄 · 相邻键差有界(禁瞬亮瞬灭)', () => {
  const w = loadWorld();
  assert.strictEqual(typeof w.registerNightGlow, 'function', '夜灯注册缝导出面在位');
  const mat = mkGlowMat(w.THREE);
  w.registerNightGlow(mat);
  w.dayCycleOn = true;
  const stepGlow = (start, n) => {
    const seq = [];
    for (let i = 0; i <= n; i++) {
      w.dayTime = start + i * 50; /* 50 tick 比较键节拍(world.js 同款) */
      w.applyDaylight();
      seq.push(mat.color.g / BASE_G);
    }
    return seq;
  };
  /* 界值留痕(票面 §4.2「值界施工定并留痕」): 窗内 50 tick 一阶 = 50/1630
     ≈ 0.0307, 键界断言 0.035(理论一阶+14% 浮点余量); 瞬跳禁令 0.1
     (≈3.3 阶理论一阶 — 任何瞬亮瞬灭至少跳 0.5 量级, 0.1 界下零假绿) */
  const STEP_BOUND = 0.035;
  const FLASH_BOUND = 0.1;
  const duskSeq = stepGlow(12040, 8); /* 12040 → 12440, 窗内前段 */
  assert.strictEqual(duskSeq[0], 0, 'dusk 窗起=0');
  for (let i = 0; i < 8; i++) {
    const d = duskSeq[i + 1] - duskSeq[i];
    assert.ok(d > 0, 'dusk 阶进第 ' + i + ' 步渐亮: ' + duskSeq[i].toFixed(4) + ' → ' + duskSeq[i + 1].toFixed(4));
    assert.ok(d <= STEP_BOUND, 'dusk 第 ' + i + ' 步键差 ' + d.toFixed(4) + ' ≤ ' + STEP_BOUND);
    assert.ok(d <= FLASH_BOUND, '禁瞬亮: 第 ' + i + ' 步无瞬跳');
  }
  const dawnSeq = stepGlow(22330, 8); /* 22330 → 22730, 窗内前段 */
  assert.strictEqual(dawnSeq[0], 1, 'dawn 窗起=满亮');
  for (let i = 0; i < 8; i++) {
    const d = dawnSeq[i] - dawnSeq[i + 1];
    assert.ok(d > 0, 'dawn 阶进第 ' + i + ' 步渐熄: ' + dawnSeq[i].toFixed(4) + ' → ' + dawnSeq[i + 1].toFixed(4));
    assert.ok(d <= STEP_BOUND, 'dawn 第 ' + i + ' 步键差 ' + d.toFixed(4) + ' ≤ ' + STEP_BOUND);
    assert.ok(d <= FLASH_BOUND, '禁瞬灭: 第 ' + i + ' 步无瞬跳');
  }
});

/* ============ 性能护栏: 零逐帧 PointLight · setPlayerGlow 共存零触碰 ============ */

test('性能护栏: 全窗驱动零逐帧 PointLight · setPlayerGlow 既有缝共存(单通道不扩)零触碰', () => {
  const w = loadWorld();
  assert.strictEqual(typeof w.registerNightGlow, 'function', '夜灯注册缝导出面在位');
  const mat = mkGlowMat(w.THREE);
  w.registerNightGlow(mat);
  w.dayCycleOn = true;
  const countLights = () => w.scene.children.filter((o) => o instanceof w.THREE.PointLight).length;
  /* 全窗驱动(dusk 起点前 → dawn 止点后, 50 tick 步进): 夜灯广播段零光源对象 */
  for (let t = 12000; t <= 24100; t += 50) {
    w.dayTime = t;
    w.applyDaylight();
  }
  assert.strictEqual(countLights(), 0, '全窗驱动后 PointLight 计数恒 0(零逐帧动态灯, 定稿 §3.c)');
  /* setPlayerGlow 既有机制缝共存零触碰: 灯笼单通道照旧, 夜灯不加第二盏 */
  w.setPlayerGlow(true);
  assert.strictEqual(countLights(), 1, '随身光单通道(既有 §8.3 缝)未被夜灯机制扩充');
  for (let t = 12000; t <= 24100; t += 50) {
    w.dayTime = t;
    w.applyDaylight();
  }
  assert.strictEqual(countLights(), 1, '随身光开启下全窗驱动仍恰 1 盏(零新增)');
  w.setPlayerGlow(false);
  assert.strictEqual(countLights(), 0, '关回隐藏');
});
