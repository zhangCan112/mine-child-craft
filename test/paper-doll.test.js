'use strict';
/* 纸娃娃翼单测(T-G03 形象层, UI spec §4.2/§4.3) — node --test
   运行: node --test test/paper-doll.test.js
   js/paper-doll.js 宿主 require 装载(闭包自由变量 MobLookKit/
   mkArmorOverlay/EQUIP_SLOTS 经宿主 global 解析, conventions §7.1
   铁律 3): MobLookKit 真件+spy 记录 puppet('player') 产物; THREE 桩
   覆盖 build 期 WebGLRenderer/Scene/PerspectiveCamera + 几何段, 桩侧
   构造登记相机/渲染器(armor-overlay.test 的 texLog 同款观测手法)。
   paint 期断言: 翼静帧(装备=展平静帧/未装备=hidden 无残影)与相机
   z 往返(3.55↔4.3, lookAt 不动)——观感出口, 不 reach 实现内部。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const {mkEl} = require('./helpers/fake-dom.js');

/* ---- THREE 桩: 几何段同 mob-look.test 形状 + 渲染器/相机/灯(构造登记) ---- */
function stubThree(log) {
  const rotX = (x, y, z, a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  const rotY = (x, y, z, a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
  const rotZ = (x, y, z, a) => [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a), z];
  class BoxGeometry {
    constructor(w, h, d) {
      const pos = []; const nor = []; const idx = [];
      const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      let n = 0;
      for (const [fnx, fny, fnz] of faces) {
        const t1 = fnx !== 0 ? [0, 1, 0] : [1, 0, 0];
        const t2 = [fny * t1[2] - fnz * t1[1], fnz * t1[0] - fnx * t1[2], fnx * t1[1] - fny * t1[0]];
        const g1 = [t1[0] * w / 2, t1[1] * h / 2, t1[2] * d / 2];
        const g2 = [t2[0] * w / 2, t2[1] * h / 2, t2[2] * d / 2];
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          pos.push(fnx * w / 2 + a * g1[0] + b * g2[0],
              fny * h / 2 + a * g1[1] + b * g2[1],
              fnz * d / 2 + a * g1[2] + b * g2[2]);
          nor.push(fnx, fny, fnz);
        }
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
        n += 4;
      }
      this._pos = pos; this._nor = nor;
      this.index = {count: idx.length, getX: (i) => idx[i]};
      this._bind();
    }
    _bind() {
      const pos = this._pos; const nor = this._nor;
      this.attributes = {
        position: {count: pos.length / 3, getX: (i) => pos[i * 3],
          getY: (i) => pos[i * 3 + 1], getZ: (i) => pos[i * 3 + 2]},
        normal: {count: nor.length / 3, getX: (i) => nor[i * 3],
          getY: (i) => nor[i * 3 + 1], getZ: (i) => nor[i * 3 + 2]},
      };
    }
    rotateX(a) {
      this._map((x, y, z) => rotX(x, y, z, a)); return this;
    }
    rotateY(a) {
      this._map((x, y, z) => rotY(x, y, z, a)); return this;
    }
    rotateZ(a) {
      this._map((x, y, z) => rotZ(x, y, z, a)); return this;
    }
    translate(tx, ty, tz) {
      this._map((x, y, z) => [x + tx, y + ty, z + tz]); return this;
    }
    _map(fn) {
      const p = []; const q = [];
      for (let i = 0; i < this._pos.length / 3; i++) {
        const r = fn(this._pos[i * 3], this._pos[i * 3 + 1], this._pos[i * 3 + 2]);
        p.push(r[0], r[1], r[2]); q.push(this._nor[i * 3], this._nor[i * 3 + 1], this._nor[i * 3 + 2]);
      }
      this._pos = p; this._nor = q; this._bind();
    }
    dispose() {}
  }
  class BufferGeometry {
    setAttribute(k, v) {
      this[k] = v;
    }
    setIndex(i) {
      this.index = i;
    }
  }
  const mkNode = () => ({
    children: [], visible: true, rotation: {x: 0, y: 0, z: 0},
    position: {x: 0, y: 0, z: 0, fromArray() {}, set() {}},
    scale: {setScalar() {}},
    add(o) {
      this.children.push(o);
    },
  });
  class WebGLRenderer {
    constructor() {
      this.domElement = mkEl();
      this.renderCount = 0;
      log.renderers.push(this);
    }
    setPixelRatio() {}
    setSize() {}
    render() {
      this.renderCount++;
    }
    dispose() {}
    forceContextLoss() {}
  }
  class PerspectiveCamera {
    constructor() {
      this.position = {x: 0, y: 0, z: 0,
        set(x, y, z) {
          this.x = x; this.y = y; this.z = z;
        }};
      this.lookAtLog = [];
      log.cameras.push(this);
    }
    lookAt(...a) {
      this.lookAtLog.push(a);
    }
  }
  return {
    BoxGeometry, BufferGeometry, Float32BufferAttribute: Float32Array,
    WebGLRenderer, PerspectiveCamera,
    Group: class {
      constructor() {
        Object.assign(this, mkNode());
      }
    },
    Mesh: class {
      constructor(geo, mat) {
        this.geometry = geo; this.material = mat;
        Object.assign(this, mkNode());
      }
    },
    MeshLambertMaterial: class {
      constructor(o) {
        this.o = o || {};
      }
      dispose() {}
    },
    CanvasTexture: class {},
    Scene: class {
      constructor() {
        Object.assign(this, mkNode());
      }
      traverse() {}
    },
    AmbientLight: class {},
    DirectionalLight: class {
      constructor() {
        this.position = {set() {}};
      }
    },
  };
}

/* ---- 装载: 宿主 global 桩 + spy MobLookKit + require paper-doll ---- */
function loadDoll() {
  const log = {renderers: [], cameras: []};
  const realKit = require('../js/mob-look-kit.js');
  const ctxLook = vm.createContext({MobLookKit: realKit});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/mob-look/player.js'), 'utf8'),
      ctxLook, {filename: 'player.js'});
  let playerPuppet = null; const calls = [];
  const spyKit = {...realKit, puppet: (t) => {
    const p = realKit.puppet(t);
    calls.push(t);
    if (t === 'player') playerPuppet = p;
    return p;
  }};
  const saves = {};
  for (const k of ['THREE', 'document', 'MobLookKit', 'mkArmorOverlay', 'EQUIP_SLOTS']) {
    saves[k] = global[k];
  }
  global.THREE = stubThree(log);
  global.document = {createElement: () => ({width: 0, height: 0,
    getContext: () => ({createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}),
      putImageData() {}})})};
  global.MobLookKit = spyKit;
  global.mkArmorOverlay = () => ({apply() {}, dispose() {}});
  global.EQUIP_SLOTS = require('../js/equipment-core.js').EQUIP_SLOTS;
  const dollPath = require.resolve('../js/paper-doll.js');
  delete require.cache[dollPath];
  const {mkPaperDoll} = require('../js/paper-doll.js');
  return {
    mkPaperDoll, log, puppet: () => playerPuppet, calls,
    camera: () => log.cameras[log.cameras.length - 1],
    renderer: () => log.renderers[log.renderers.length - 1],
    restore() {
      for (const k of Object.keys(saves)) {
        if (saves[k] === undefined) delete global[k]; else global[k] = saves[k];
      }
      delete require.cache[dollPath];
    },
  };
}

function wingsOf(p) {
  assert.ok(p && p.bones.wingL && p.bones.wingR,
      '玩家傀儡应有 wingL/wingR 翼骨(MobLook 甲案, 与 Avatar 几何零双份)');
  return [p.bones.wingL, p.bones.wingR];
}

const WORN_GLIDER = {helmet: null, chestplate: null, leggings: null, boots: null,
  glider: {id: 'glider', dur: 1}};
const WORN_NONE = {helmet: null, chestplate: null, leggings: null, boots: null, glider: null};

/* ============ 测试 ============ */

test('纸娃娃翼: paint 未装备 — 翼 hidden 无残影·相机原构图 z=3.55(UI spec §4.2/§4.3)', () => {
  const d = loadDoll();
  try {
    const doll = d.mkPaperDoll({doc: {createElement: () => mkEl()}});
    doll.paint(WORN_NONE);
    const [wl, wr] = wingsOf(d.puppet());
    assert.strictEqual(wl.visible && wr.visible, false,
        '未装备 → 翼骨 hidden(与现状逐像素一致, 无残影)');
    assert.ok(d.calls.includes('player'), '纸娃娃消费 puppet(\'player\')(档案共享, 几何零双份)');
    const cam = d.camera();
    assert.ok(cam, 'paint 触发 build(惰性首建)应已建相机');
    assert.ok(Math.abs(cam.position.z - 3.55) < 0.01, '未装备维持原构图 z=3.55');
  } finally {
    d.restore();
  }
});

test('纸娃娃翼: paint 装备 — 展平静帧(不经意图接口)·相机后移 z≈4.3·lookAt 仍 (0,0.9,0)(UI spec §4.2/§4.3)', () => {
  const d = loadDoll();
  try {
    const doll = d.mkPaperDoll({doc: {createElement: () => mkEl()}});
    doll.paint(WORN_GLIDER);
    const [wl, wr] = wingsOf(d.puppet());
    assert.strictEqual(wl.visible && wr.visible, true, '装备 → 翼展平静帧(试穿预览)');
    assert.ok(Math.abs(wl.rotation.z) >= Math.PI / 3 && Math.abs(wl.rotation.z) <= 2 * Math.PI / 3,
        '翼置展平姿态(§6 展平姿态渲染一帧, 60°~120° 带)');
    assert.ok(Math.sign(wl.rotation.z) !== Math.sign(wr.rotation.z), '双翼镜像反号');
    const cam = d.camera();
    assert.ok(Math.abs(cam.position.z - 4.3) < 0.1,
        '装备时相机后移 z 3.55→≈4.3(双翼尖完整入框), 实得 ' + cam.position.z.toFixed(2));
    const last = cam.lookAtLog[cam.lookAtLog.length - 1];
    assert.ok(last && last.length === 3 && Math.abs(last[0]) < 1e-9 &&
        Math.abs(last[1] - 0.9) < 1e-9 && Math.abs(last[2]) < 1e-9,
    'lookAt 仍 (0,0.9,0)(其余参数不动)');
  } finally {
    d.restore();
  }
});

test('纸娃娃翼: 卸下构图复原 + 同 worn 幂等不重画(§4.3 构图复原/预览按需一帧)', () => {
  const d = loadDoll();
  try {
    const doll = d.mkPaperDoll({doc: {createElement: () => mkEl()}});
    doll.paint(WORN_GLIDER);
    const [wl] = wingsOf(d.puppet());
    const r = d.renderer();
    const n1 = r.renderCount;
    doll.paint(WORN_GLIDER);
    assert.strictEqual(r.renderCount, n1, '同 worn 复 paint 不重画(五槽 id 签名幂等)');
    doll.paint(WORN_NONE);
    assert.strictEqual(wl.visible, false, '卸下翼消失');
    const cam = d.camera();
    assert.ok(Math.abs(cam.position.z - 3.55) < 0.01, '卸下构图复原 z=3.55(人物更大更亲切)');
  } finally {
    d.restore();
  }
});
