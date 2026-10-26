'use strict';
/* 顶点光材质注入与昼夜 uniform 节拍 (js/world.js) — node --test (零依赖)
   运行: node --test test/world-vertexlight.test.js
   对应模块文件 js/world.js(命名沿 world-rings/world-integrity 的专题惯例,
   conventions §1.9 存量偏差)。与 world-rings 的全放行 Proxy 桩不同: 本测试
   要读回材质/几何/uniform 的真实值, 故用手写迷你 THREE 桩(只实现 world.js
   触碰的表面); GLSL 断言在 onBeforeCompile 的字符串产物层 — 无 GPU 也锁
   替换点与公式要素, 数值口径(bright 曲线/顶点光取样)由 daylight-core 与
   mesh-core 单测分头把守。
   被测 seam(设计稿 mc-daylight-torch §4.2/§4.4/§8.3):
   · 四材质 onBeforeCompile 注入(顶点属性/共享 uniforms/光照替换/回退)
   · applyDaylight 的 uDim·uSkyFloor 节拍(dayCycle 两态 + 幂等复位)
   · makeGeo/makeTexGeo 的 aSky/aBlock 逐顶点装配
   · setPlayerGlow 机制缝(uGlowR 两态 · PointLight · uGlowPos 跟随)
   · serveChunkKey 的 Worker 消息携带光照圈(跨线程契约主线程侧) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 迷你 THREE 桩: 只实现 world.js 触碰的表面, 读回真实值 ---------- */
function mkThree() {
  const T = {};
  T.Color = class {
    constructor(c) {
      this.c = c;
    }
    setRGB(r, g, b) {
      this.r = r; this.g = g; this.b = b; return this;
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
    }
  };
  T.BoxGeometry = class {}; T.EdgesGeometry = class {};
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

/* 画布 2d 桩: 太阳光斑/TNT 图集/天体贴图的绘制表面(产物无人读, 记形不记色) */
function mkCanvas() {
  const grad = {addColorStop() {}};
  return {
    width: 0, height: 0,
    getContext: () => ({fillStyle: null, font: '', textAlign: '', textBaseline: '',
      fillRect() {}, fillText() {}, createRadialGradient: () => grad}),
  };
}

function loadWorld(opts) {
  opts = opts || {};
  const sandbox = {
    console: {log() {}, warn() {}, error() {}},
    THREE: mkThree(),
    document: {createElement: () => mkCanvas(), getElementById: () => ({appendChild() {}})},
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    location: {protocol: 'file:'},
    addEventListener() {},
  };
  sandbox.window = sandbox;
  if (opts.worker) {
    const sent = [];
    sandbox.Worker = class { // 捕获派发消息(协议断言用), 不回网格(环测试另有桩)
      postMessage(m, t) {
        sent.push({m, t: t || []});
      }
    };
    sandbox.__sent = sent;
  }
  const ctx = vm.createContext(sandbox);
  /* 不含 texture-atlas.js: 走 world.js 的 typeof 守卫分支(ATLAS_LAYOUT=null),
     该路径顺带被测; 图集布局对材质注入无影响 */
  for (const f of ['config.js', 'daylight-core.js', 'light-core.js', 'voxel.js',
    'cascade-core.js', 'mesh-core.js', 'world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__w = {
      blockMat, glassMat, tntMat, atlasMat,
      applyDaylight, setPlayerGlow, makeGeo, makeTexGeo, scene, pos,
      rebuildAll, pumpRemesh,
      get dayCycleOn() { return dayCycleOn; }, set dayCycleOn(v) { dayCycleOn = v; },
      get dayTime() { return dayTime; }, set dayTime(v) { dayTime = v; },
    };
  `, ctx);
  return Object.assign(ctx.__w, {sent: sandbox.__sent || null, THREE: sandbox.THREE});
}

/* r128 meshlambert_vert 的最小同构: 断言只盯替换点, 不复刻全文件 */
const R128_VERT = [
  'varying vec3 vLightFront;',
  'varying vec3 vIndirectFront;',
  'void main() {',
  '\t#include <project_vertex>',
  '\t#include <worldpos_vertex>',
  '\t#include <lights_lambert_vertex>',
  '\t#include <fog_vertex>',
  '}',
].join('\n');
const mkShader = () => ({uniforms: {diffuse: {value: [1, 1, 1]}},
  vertexShader: R128_VERT, fragmentShader: 'void main() {}'});

/* 材质的注入后 uniforms(每材质共用同一份对象 — 由此取值即引擎真值) */
const voxUniforms = (w, mat) => {
  const sh = mkShader();
  (mat || w.blockMat).onBeforeCompile(sh, null);
  return sh.uniforms;
};

/* ============ 材质注入 (§4.2) ============ */

test('材质注入: 四材质 onBeforeCompile 替换 lights_lambert_vertex — 属性/公式要素齐全', () => {
  const w = loadWorld();
  for (const mat of [w.blockMat, w.glassMat, w.tntMat, w.atlasMat]) {
    assert.strictEqual(typeof mat.onBeforeCompile, 'function', '四材质统一注入');
    const sh = mkShader();
    mat.onBeforeCompile(sh, null);
    assert.ok(!sh.vertexShader.includes('#include <lights_lambert_vertex>'), '原 chunk 被替换掉');
    assert.ok(sh.vertexShader.includes('attribute float aSky;'), '顶点属性 aSky 前置声明');
    assert.ok(sh.vertexShader.includes('attribute float aBlock;'), '顶点属性 aBlock 前置声明');
    for (const u of ['uniform float uDim;', 'uniform vec3 uTorch;', 'uniform float uSkyFloor;',
      'uniform vec3 uGlowPos;', 'uniform float uGlowR;']) {
      assert.ok(sh.vertexShader.includes(u), 'uniform 声明: ' + u);
      assert.ok(sh.uniforms[u.replace(/^uniform \w+ /, '').replace(/;$/, '')], 'uniforms 表挂接: ' + u);
    }
    /* 两通道叠加公式要素(§4.2): 天空染色×时间衰减×下限 + 火把暖色叠加 +
       bright 多项式内联 + 顶点衰减灯笼项 + Gouraud 出口 */
    assert.ok(sh.vertexShader.includes('uSkyFloor'), '天空下限(§4.4 向后兼容)');
    assert.ok(sh.vertexShader.includes('uTorch'), '火把暖色通道');
    assert.ok(sh.vertexShader.includes('0.93') && sh.vertexShader.includes('1.6'),
        'bright(x)=0.05+0.93·pow(x/15,1.6) 内联(renderBright 的 GLSL 镜像)');
    assert.ok(sh.vertexShader.includes('uDim'), '天空通道随 skyDim 衰减');
    assert.ok(sh.vertexShader.includes('uGlowPos') && sh.vertexShader.includes('uGlowR'),
        '灯笼顶点衰减项(§8.3 机制缝)');
    assert.ok(sh.vertexShader.includes('vLightFront'), '写 Lambert 出口 varying');
    assert.ok(sh.vertexShader.includes('#ifdef DOUBLE_SIDED'), '玻璃 DoubleSide 背面同亮');
  }
});

test('材质注入: 四材质共享同一份 uniform 对象 — 每帧只写 value 即全材质生效', () => {
  const w = loadWorld();
  const a = voxUniforms(w, w.blockMat);
  const b = voxUniforms(w, w.tntMat);
  const c = voxUniforms(w, w.glassMat);
  const d = voxUniforms(w, w.atlasMat);
  for (const u of ['uDim', 'uTorch', 'uSkyFloor', 'uGlowPos', 'uGlowR']) {
    assert.strictEqual(a[u], b[u], u + ' 同一对象引用(block/tnt)');
    assert.strictEqual(a[u], c[u], u + ' 同一对象引用(block/glass)');
    assert.strictEqual(a[u], d[u], u + ' 同一对象引用(block/atlas)');
  }
});

test('材质注入: 回退 — 替换点缺失(未来 three 版本 chunk 改名)不炸, 保持 stock 着色器', () => {
  const w = loadWorld();
  const sh = {uniforms: {}, vertexShader: 'void main() { gl_Position = vec4(0.0); }',
    fragmentShader: 'void main() {}'};
  w.blockMat.onBeforeCompile(sh, null); // 不应抛错
  assert.strictEqual(sh.vertexShader, 'void main() { gl_Position = vec4(0.0); }',
      '回退=不改写着色器(全局夜暗由 applyDaylight 的场景灯衰减兜底, 见 world.js 注释)');
});

/* ============ applyDaylight 的 uniform 节拍 (§4.2/§4.4) ============ */

test('applyDaylight 节拍: uDim=skyDim · uSkyFloor 两态(探险 0 / 非 dayCycle 15), 幂等复位', () => {
  const w = loadWorld();
  w.dayCycleOn = true;
  w.dayTime = 18000; // 午夜, skyDim=11
  w.applyDaylight();
  assert.strictEqual(voxUniforms(w).uDim.value, 11, '午夜 uDim=11');
  assert.strictEqual(voxUniforms(w).uSkyFloor.value, 0, '探险(=dayCycleOn)天空下限 0: 真实洞穴/夜');
  w.dayTime = 6000; // 正午, skyDim=0
  w.applyDaylight();
  assert.strictEqual(voxUniforms(w).uDim.value, 0, '正午 uDim=0');
  /* 关循环复位: 非 dayCycle 模式向后兼容(§4.4) — 天空通道恒 ~98% 亮度 ≈ 现状观感 */
  w.dayCycleOn = false;
  w.applyDaylight();
  assert.strictEqual(voxUniforms(w).uDim.value, 0, '复位白天口径');
  assert.strictEqual(voxUniforms(w).uSkyFloor.value, 15, '非 dayCycle: uSkyFloor=15');
  w.applyDaylight(); // 幂等: 再调不反复改写
  assert.strictEqual(voxUniforms(w).uSkyFloor.value, 15);
});

/* ============ 几何装配 (§4.1 → world.js) ============ */

test('makeGeo/makeTexGeo: aSky/aBlock 逐顶点装配(itemSize=1), 主线程数组与 Float32 同构', () => {
  const w = loadWorld();
  const ch = {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    colors: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], sky: [0.4, 0.4, 0.4, 0.4],
    block: [0.9, 0, 0, 0], indices: [0, 1, 2, 2, 1, 3],
  };
  const g = w.makeGeo(ch);
  assert.deepStrictEqual(g.attrs.aSky.values, [0.4, 0.4, 0.4, 0.4], 'aSky 逐顶点');
  assert.deepStrictEqual(g.attrs.aBlock.values, [0.9, 0, 0, 0], 'aBlock 逐顶点');
  assert.strictEqual(g.attrs.aSky.itemSize, 1);
  assert.strictEqual(g.attrs.aBlock.itemSize, 1);
  const tex = {
    positions: ch.positions, normals: ch.normals, uvs: [0, 0, 1, 0, 0, 1, 1, 1],
    sky: new Float32Array([1, 1, 1, 1]), block: new Float32Array([0, 0, 0, 0]),
    indices: ch.indices,
  };
  const g2 = w.makeTexGeo(tex);
  assert.deepStrictEqual(g2.attrs.aSky.values, [1, 1, 1, 1], 'Worker 回传 Float32Array 同样可装配');
});

/* ============ setPlayerGlow 机制缝 (§8.3, 政策归 D7) ============ */

test('setPlayerGlow: uGlowR 两态 · PointLight 惰性创建/隐藏 · uGlowPos 每帧跟随玩家', () => {
  const w = loadWorld();
  w.setPlayerGlow(true);
  assert.strictEqual(voxUniforms(w).uGlowR.value, 6, '开: 半径 6(等效 9 级)');
  const lights = w.scene.children.filter((o) => o instanceof w.THREE.PointLight);
  assert.strictEqual(lights.length, 1, '实体侧 PointLight 惰性创建(§8.3)');
  assert.strictEqual(lights[0].visible, true);
  assert.strictEqual(lights[0].intensity, 1.1);
  /* 每帧节拍跟随: applyDaylight 驱动(dayCycle 开着 — 灯笼消费方=探险) */
  w.pos.set(10, 20, 30);
  w.dayCycleOn = true;
  w.dayTime = 18000;
  w.applyDaylight();
  const gp = voxUniforms(w).uGlowPos.value;
  assert.strictEqual(gp.x, 10);
  assert.strictEqual(gp.z, 30);
  assert.ok(gp.y > 20 && gp.y < 21.5, '挂点取玩家胸口高度: ' + gp.y);
  w.setPlayerGlow(false);
  assert.strictEqual(voxUniforms(w).uGlowR.value, 0, '关: 光项归零(shader 项为 0)');
  assert.strictEqual(lights[0].visible, false, '实体灯隐藏');
});

/* ============ Worker 协议主线程侧 (§3.4) ============ */

test('serveChunkKey: Worker 消息携带 sky/block 光照圈 + 三缓冲零拷贝转移', () => {
  const w = loadWorld({worker: true});
  w.pos.set(64, 30, 64); // 环心居中: 全部区块 ≤ fullChunks → kind 全 'full'(border=1)
  w.rebuildAll();
  for (let i = 0; i < 10; i++) w.pumpRemesh(64);
  assert.ok(w.sent.length >= 64, '全部区块经 Worker 派发: ' + w.sent.length);
  const first = w.sent[0];
  assert.ok(first.m.sky && first.m.block, '消息携光照圈(D2 pack 契约跨线程延伸)');
  assert.strictEqual(first.m.sky.byteLength, 18*18*48, 'sky 与 cells 同形(18×18×48)');
  assert.strictEqual(first.m.block.byteLength, 18*18*48);
  assert.ok(first.t.includes(first.m.cells) && first.t.includes(first.m.sky) && first.t.includes(first.m.block),
      'cells/sky/block 三缓冲随 transfer 清单零拷贝转移');
});
