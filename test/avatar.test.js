'use strict';
/* Avatar 显隐状态机单测(T-G03 形象层, UI spec §6.4/§6.5) — node --test
   运行: node --test test/avatar.test.js
   vm 装载 js/avatar.js(载入即建 IIFE, 沙箱喂引擎全局桩); MobLookKit 用
   真件+spy 包装记录 puppet('player') 产物——显隐断言落在翼骨 Group 的
   visible/rotation(行为出口), 不 reach Avatar 内部状态。
   桩纪律: conventions §7.1(THREE/document 桩挂宿主 global 共享实例)
   + §7.2(假 DOM 走 test/helpers/fake-dom.js 的 mkEl)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---- THREE 桩: 几何段与 mob-look.test.js 的 stubThree 同形(§7.1 铁律 3) ---- */
function stubThree() {
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
  return {
    BoxGeometry, BufferGeometry, Float32BufferAttribute: Float32Array,
    Group: class extends Object {
      constructor() {
        super();
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
        this.color = {clone: () => ({copy() {}, lerp() {}}), copy() {}, lerp() {}};
      }
      dispose() {}
    },
    CanvasTexture: class {},
    Color: class {
      copy() {
        return this;
      }
      lerp() {
        return this;
      }
      clone() {
        return this;
      }
    },
  };
}

/* ---- 装载: 真 MobLookKit(声明 player 档) + spy puppet + avatar.js ---- */
function loadAvatar() {
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
  const ctx = vm.createContext({
    MobLookKit: spyKit,
    scene: {add() {}},
    THREE: global.THREE, document: global.document,
    PLAYER: {speed: 4, modelScale: 1},
    CAM: {hideDist: 0.2},
    HeldItems: {equipHalf: 0.14, defFor: () => null, swap: () => null,
      bare: {swing: {dur: 0.3}, sway: {idle: 0.05}},
      swingPose: () => ({x: 0, z: 0})},
    HandView: {setItem() {}, swing() {}},
    mkArmorOverlay: () => ({apply() {}, dispose() {}}),
    pos: {x: 0, y: 0, z: 0}, vel: {x: 0, y: 0, z: 0},
    yaw: 0, pitch: 0, onGround: true, flyMode: false,
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/avatar.js'), 'utf8'),
      ctx, {filename: 'js/avatar.js'});
  const Avatar = vm.runInContext('Avatar', ctx);
  return {Avatar, puppet: () => playerPuppet, calls};
}

/* 桩挂宿主 global(§7.1 铁律 3: 真 MobLookKit 闭包经宿主 global 解析) */
function withStubs(fn) {
  const prev = {THREE: global.THREE, document: global.document};
  global.THREE = stubThree();
  global.document = {createElement: () => ({width: 0, height: 0,
    getContext: () => ({createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}),
      putImageData() {}})})};
  try {
    fn();
  } finally {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete global[k]; else global[k] = prev[k];
    }
  }
}

/* 翼骨引用 + 存在性前置断言(缺骨=档案未加翼, 红在此不往深处走) */
function wingsOf(p) {
  assert.ok(p && p.bones.wingL && p.bones.wingR,
      '玩家傀儡应有 wingL/wingR 翼骨(MobLook 甲案, UI spec §6.1)');
  return [p.bones.wingL, p.bones.wingR];
}

const WORN_GLIDER = {helmet: null, chestplate: null, leggings: null, boots: null,
  glider: {id: 'glider', dur: 1}};
const WORN_NO_GLIDER = {helmet: {id: 'helmet_iron', dur: 300}, chestplate: null,
  leggings: null, boots: null, glider: null};

/* ============ 测试 ============ */

test('Avatar 翼显隐: 缺省 hidden — 未装备翼骨恒不可见(§6.4 红线: 未装备永不出现翼)', () => {
  withStubs(() => {
    const {Avatar, puppet} = loadAvatar();
    const [wl, wr] = wingsOf(puppet());
    Avatar.update(0.016, 5);
    assert.strictEqual(wl.visible, false, '缺省 hidden: 翼骨 visible=false');
    assert.strictEqual(wr.visible, false);
  });
});

test('Avatar 翼显隐: setArmor 装备对账 — worn 有 glider → folded 收拢翼鞘(静态无微动)', () => {
  withStubs(() => {
    const {Avatar, puppet} = loadAvatar();
    const [wl, wr] = wingsOf(puppet());
    Avatar.setArmor(WORN_GLIDER);
    Avatar.update(0.016, 5);
    assert.strictEqual(wl.visible, true, '装备即 folded(翼鞘可见)');
    assert.strictEqual(wr.visible, true);
    /* folded=烘焙收拢(骨旋转 0 基准), 静态无微动(§6.4: 装备未滑翔=静态) */
    for (let i = 0; i < 60; i++) Avatar.update(1 / 60, 5);
    assert.ok(Math.abs(wl.rotation.z) < 0.02 && Math.abs(wr.rotation.z) < 0.02,
        'folded 静态: 收拢位旋转 ≈ 0(§6.2 烘焙=收拢), 1s 静置无微动');
  });
});

test('Avatar 动效: setWings(spread) — 0.25s 线性匀速展开, 端点水平带, 双翼反号(§6.5)', () => {
  withStubs(() => {
    const {Avatar, puppet} = loadAvatar();
    const [wl, wr] = wingsOf(puppet());
    assert.strictEqual(typeof Avatar.setWings, 'function',
        '应有意图接口 setWings(\'folded\'|\'spread\')(命名归实现线, 语义照 §6.4)');
    Avatar.setArmor(WORN_GLIDER);
    Avatar.update(0.016, 5);
    Avatar.setWings('spread');
    /* 四步 0.0625s 采样推进(共 0.25s): 匀速=进度比例 */
    const rs = [];
    for (let i = 0; i < 4; i++) {
      Avatar.update(0.0625, 5);
      rs.push(Math.abs(wl.rotation.z));
    }
    const end = rs[3];
    assert.ok(end >= Math.PI / 3 && end <= 2 * Math.PI / 3,
        '端点=收拢→水平展平(带 60°~120°, UI spec §6.5 单轴旋转), 实得 ' +
        (end * 180 / Math.PI).toFixed(1) + '°');
    const bands = [[0.18, 0.32], [0.43, 0.57], [0.68, 0.82]];
    for (let i = 0; i < 3; i++) {
      const q = rs[i] / end;
      assert.ok(q >= bands[i][0] && q <= bands[i][1],
          '匀速: ' + (0.0625 * (i + 1)).toFixed(3) + 's 进度 ' + q.toFixed(2) +
          ' 应 ≈ ' + (i + 1) / 4 + '(线性匀速无回弹)');
    }
    assert.ok(Math.sign(wl.rotation.z) !== Math.sign(wr.rotation.z) &&
        Math.abs(Math.abs(wl.rotation.z) - Math.abs(wr.rotation.z)) < 0.05,
    '双翼反号对称展开(镜像)');
  });
});

test('Avatar 动效: setWings(folded) — 反向同参数 0.25s 收回收拢位·端点即停(§6.5)', () => {
  withStubs(() => {
    const {Avatar, puppet} = loadAvatar();
    const [wl] = wingsOf(puppet());
    Avatar.setArmor(WORN_GLIDER);
    Avatar.update(0.016, 5);
    Avatar.setWings('spread');
    Avatar.update(0.25, 5);
    const end = Math.abs(wl.rotation.z);
    assert.ok(end >= Math.PI / 3, '前置: spread 已到位');
    Avatar.setWings('folded');
    Avatar.update(0.125, 5);
    const half = Math.abs(wl.rotation.z);
    assert.ok(Math.abs(half - end / 2) < end * 0.12,
        '收起半程 ≈ 端点一半(反向同参数 0.25s): ' + half.toFixed(3) + ' vs ' + (end / 2).toFixed(3));
    Avatar.update(0.125, 5);
    assert.ok(Math.abs(wl.rotation.z) <= 0.02, '收起端点=收拢位 ≈ 0');
    for (let i = 0; i < 30; i++) Avatar.update(1 / 60, 5); /* 再静置 0.5s */
    assert.ok(Math.abs(wl.rotation.z) <= 0.02,
        '端点即停无过冲无回弹; folded 态无微动(微动只属 spread)');
  });
});

test('Avatar 动效: spread 滑翔微动 — ±2.5~3° 正弦·双翼反相·主周期 ≈1.4s(§6.5)', () => {
  withStubs(() => {
    const {Avatar, puppet} = loadAvatar();
    const [wl, wr] = wingsOf(puppet());
    Avatar.setArmor(WORN_GLIDER);
    Avatar.update(0.016, 5);
    Avatar.setWings('spread');
    Avatar.update(0.25, 5); /* 动效到位, 微动开始 */
    const DT = 0.025; const N = 140; /* 3.5s 采样窗 */
    const zl = []; const zr = [];
    for (let i = 0; i < N; i++) {
      Avatar.update(DT, 5);
      zl.push(wl.rotation.z); zr.push(wr.rotation.z);
    }
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const baseL = mean(zl); const baseR = mean(zr);
    const dl = zl.map((v) => v - baseL); const dr = zr.map((v) => v - baseR);
    const amp = Math.max(...dl.map(Math.abs));
    assert.ok(amp >= 0.035 && amp <= 0.062,
        '微动幅度 2°~3.55°(±2.5°~3° 正弦+容差), 实得 ' + (amp * 180 / Math.PI).toFixed(2) + '°');
    let anti = 0;
    for (let i = 0; i < N; i++) {
      if (Math.abs(dl[i] + dr[i]) <= 0.015) anti++;
    }
    assert.ok(anti >= N * 0.95, '双翼反相(一侧上摆一侧下摆): ' + anti + '/' + N + ' 采样点 δL≈−δR');
    let cross = 0;
    for (let i = 1; i < N; i++) {
      if ((dl[i - 1] >= 0) !== (dl[i] >= 0)) cross++;
    }
    assert.ok(cross >= 4 && cross <= 6,
        '主周期 ≈1.4s: 3.5s 窗过零 ~5 次(1.17~1.75s 带), 实得 ' + cross);
  });
});

test('Avatar 翼显隐: 未装备红线 — 意图不越权·卸翼即隐·重穿对账复位 folded(§6.4 验收红线)', () => {
  withStubs(() => {
    const {Avatar, puppet} = loadAvatar();
    const [wl, wr] = wingsOf(puppet());
    /* ① 未装备时意图接口不越权 */
    Avatar.setWings('spread');
    for (let i = 0; i < 30; i++) Avatar.update(1 / 60, 5);
    assert.strictEqual(wl.visible && wr.visible, false,
        '未装备时 setWings(spread) 翼仍 hidden(装备判据优先于意图)');
    /* ② spread 态卸翼=翼立即消失(滑翔中卸翼观感归 T-G04 接线, 形象层先保证消失) */
    Avatar.setArmor(WORN_GLIDER);
    Avatar.update(0.016, 5);
    Avatar.setWings('spread');
    Avatar.update(0.25, 5);
    assert.strictEqual(wl.visible, true, '前置: spread 可见');
    Avatar.setArmor(WORN_NO_GLIDER);
    Avatar.update(0.016, 5);
    assert.strictEqual(wl.visible, false, '卸下(含四甲在场)翼即 hidden');
    /* ③ 重穿 → 对账复位 folded(非 spread 残留) */
    Avatar.setArmor(WORN_GLIDER);
    Avatar.update(0.016, 5);
    assert.strictEqual(wl.visible, true, '重穿可见');
    assert.ok(Math.abs(wl.rotation.z) < 0.05 && Math.abs(wr.rotation.z) < 0.05,
        '重穿对账复位 folded(收拢位), 不残留 spread 大翼');
    /* ④ setArmor(null) 兜底 */
    Avatar.setArmor(null);
    Avatar.update(0.016, 5);
    assert.strictEqual(wl.visible, false, 'setArmor(null) → hidden');
    /* ⑤ 顺序反转: 先意图后装备, 仍按装备对账给 folded */
    Avatar.setWings('spread');
    Avatar.setArmor(WORN_GLIDER);
    Avatar.update(0.016, 5);
    assert.strictEqual(wl.visible, true);
    assert.ok(Math.abs(wl.rotation.z) < 0.05, '先意图后装备: 仍 folded(对账单一入口)');
  });
});
