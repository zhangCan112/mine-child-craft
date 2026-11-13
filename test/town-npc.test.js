'use strict';
/* 城镇 NPC 渲染适配件 (js/town-npc.js) 单测 — node --test
   运行: node --test test/town-npc.test.js
   T-NPC-05 红测(规格权威: .scratch/town-design/tickets/T-NPC-05-render-adapter.md;
   conventions §1.2 无后缀 adapter 层: THREE/DOM 允许, 本测以桩替身直测)。
   断言面(全走公共 seam: mkTownNpcPuppet / placeTownNpc 两入口):
   ①装载零副作用: 裸沙盒(无 THREE/document/kit)可装载且入口在册——
     模块顶层不 new THREE 对象、不触场景(票文 §4.4)
   ②14 id 全部可建: 产物恰四键 root/bones/look/anchorHeight · look 键与
     注册表行 key 对账(回查注册表) · root 为 Group 且未摆放(原点) ·
     root 骨改名 body + bones.root=傀儡根惯例保留(MobLookKit.puppet 口径)
   ③anchorHeight 权威(票面口径, 勿「修正」两口径并存裁定): V 系 2.0 ·
     G01 2.7; 动物随几何=look 声明盒顶(独立推导字面: A01/A02 冠·耳顶
     14.75px, A03 耳顶 27.5px; 1px=1/16 格)
   ④bones 逐骨透传: 与 MobLookKit.puppet 直产键集一致 · G01 flower 花盒骨
     在册(显隐预留只透传, 不预造 API——产物恰四键即锁) · root 确为 kit
     傀儡产物(kit seam 测试替身打标回读)
   ⑤placeTownNpc 站位: root.position=(x, y+1, z)(站立面, townSpawnIntent
     先例) · 返回恰四键 {x,y,z,yaw} 且与 position 一致 · 返回零内部引用 ·
     入参 anchor 零突变(纯装配)
   ⑥face→yaw 五朝向域: 四正交三角断言(前向向量=(-sin yaw, -cos yaw) 与
     face 轴向互证——锁语义不锁实现; 南北相差 π · 东西互为相反数且幅度
     π/2); 词表第五值 'up' 抛拼写域错(语义与 townYawOfFace 一致: 域外炸)
   ⑦未知 id 抛拼写域错: 消息含该 id 与合法域提示(V99 / 小写 v01 两路)
   ⑧全链: anchorOf 产物 → placeTownNpc(注册表+锚点表+kit+适配件真装载,
     Node 桩下全链可测)
   装具: vm 经典脚本共享词法环境(registry/anchor 测试先例) — kit 真实例 +
   14 town look 真声明 + 上游冻结件(interact-core/anchor-core)真装载 +
   THREE 桩(mob-look.test.js stubThree 同款裁剪) + 假 document; vm 域产物
   经 JSON 往返摊平进宿主域再断言(跨域原型比对先例)。红期适配件缺席抛
   明确中文错。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const LOOK_DIR = path.join(ROOT, 'js', 'mob-look');
const ADP_REL = 'js/town-npc.js';
const MobLookKit = require('../js/mob-look-kit.js');

const ID_LITERALS = ['V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08',
  'V09', 'V10', 'G01', 'A01', 'A02', 'A03'];

/* anchorHeight 期望值(独立真源: 票面权威字面 + look 声明盒手推字面,
   非实现自算): 村民 2.0(含裙摆视觉口径)/G01 2.7 为票面权威; 动物随几何
   =max(origin.y+size.y)px ÷16(A01 冠 13.75+1 · A02 耳 12.75+2 ·
   A03 耳 26.5+1; 三只动物声明均无 inflate/旋转, 顶=盒顶)。 */
const ANCHOR_HEIGHT = {
  V01: 2.0, V02: 2.0, V03: 2.0, V04: 2.0, V05: 2.0,
  V06: 2.0, V07: 2.0, V08: 2.0, V09: 2.0, V10: 2.0,
  G01: 2.7,
  A01: 14.75 / 16, A02: 14.75 / 16, A03: 27.5 / 16,
};

/* ---------- THREE 桩(mob-look.test.js stubThree 同款裁剪): 只到
    kit puppet 几何/材质路径 + 适配件 position.set 需要的形状 ---------- */
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
  /* position 带 set/fromArray(真 Vector3 形状): 骨组 fromArray 入关节,
      傀儡根 position.set 落站位——适配件摆放可观察 */
  class Group {
    constructor() {
      this.children = [];
      this.position = {
        x: 0, y: 0, z: 0,
        set(x, y, z) {
          this.x = x; this.y = y; this.z = z;
        },
        fromArray(a) {
          this.x = a[0]; this.y = a[1]; this.z = a[2];
        },
      };
    }
    add(o) {
      this.children.push(o);
    }
  }
  class Mesh {
    constructor(geo) {
      this.geometry = geo;
    }
  }
  return {
    BoxGeometry, BufferGeometry, Float32BufferAttribute: Float32Array,
    Group, Mesh, CanvasTexture: class {}, MeshLambertMaterial: class {},
    NearestFilter: 1,
  };
}

const stubDocument = {createElement: () => ({getContext: () => ({
  createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), putImageData() {},
})})};

/* ---------- 装具: 裸沙盒(①零副作用用)与全链沙盒(kit+look×14+
    interact-core+anchor-core+注册表+适配件; 红期适配件缺席抛明确中文错) */
function bareCtx() {
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  const src = fs.readFileSync(path.join(ROOT, ADP_REL), 'utf8');
  vm.runInContext(src, ctx, {filename: ADP_REL});
  return ctx;
}

let ctxCache = null;
function adapterCtx() {
  if (ctxCache) return ctxCache;
  const adpPath = path.join(ROOT, ADP_REL);
  if (!fs.existsSync(adpPath)) {
    throw new Error('装载链缺少 ' + ADP_REL + '(T-NPC-05 红期: 渲染适配件未落实现)');
  }
  const ctx = vm.createContext({
    console: {log() {}, warn() {}, error() {}},
    MobLookKit, THREE: stubThree(), document: stubDocument,
  });
  const files = fs.readdirSync(LOOK_DIR)
      .filter((f) => f.startsWith('town_') && f.endsWith('.js')).sort()
      .map((f) => 'js/mob-look/' + f)
      .concat(['js/town-interact-core.js', 'js/town-npc-anchor-core.js',
        'js/town-npc-registry.js', ADP_REL]);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  ctxCache = ctx;
  return ctx;
}

/* ---------- 桥接: vm 域产物 JSON 往返摊平进宿主域(跨域原型比对先例),
    断言面语义不变, 只换 harness 载体 ---------- */
function bridge(ctx) {
  return {
    /* 注册表 id→key 对账用(真源=注册表行, 非适配件自说自话) */
    registryIdKey() {
      const raw = vm.runInContext(
          'TOWN_NPCS.map((e) => ({id: e.id, key: e.key}))', ctx);
      const map = {};
      for (const row of JSON.parse(JSON.stringify(raw))) map[row.id] = row.key;
      return map;
    },
    /* mkTownNpcPuppet 产物形状快照(THREE 对象只读标量投影) */
    mk(id) {
      const expr = '(() => { const p = mkTownNpcPuppet(' + JSON.stringify(id) + ');\n' +
        'return {keySet: Object.keys(p).sort(), look: p.look,\n' +
        'anchorHeight: p.anchorHeight,\n' +
        'rootIsGroup: p.root instanceof THREE.Group,\n' +
        'rootPos: [p.root.position.x, p.root.position.y, p.root.position.z],\n' +
        'boneKeys: Object.keys(p.bones).sort(),\n' +
        'bonesRootIsRoot: p.bones.root === p.root,\n' +
        'bodyPresent: \'body\' in p.bones,\n' +
        'flowerIsGroup: p.bones.flower instanceof THREE.Group,\n' +
        'flowerIsMesh: p.bones.flower instanceof THREE.Mesh};\n' +
        '})()';
      return JSON.parse(JSON.stringify(vm.runInContext(expr, ctx)));
    },
    /* kit seam 直产键集对照(同一 THREE 桩域, join 字符串跨域安全) */
    kitBoneKeys(key) {
      const expr = 'Object.keys(MobLookKit.puppet(' + JSON.stringify(key) +
          ').bones).sort().join(\',\')';
      return vm.runInContext(expr, ctx);
    },
    /* kit seam 测试替身: 打标 root 后恢复——产物 root 确为 kit 傀儡产物 */
    kitTaggedRoot(id) {
      const expr = '(() => { const orig = MobLookKit.puppet;\n' +
        'MobLookKit.puppet = (k) => { const p = orig(k); p.root.__kitPuppet = true; return p; };\n' +
        'try { return mkTownNpcPuppet(' + JSON.stringify(id) +
        ').root.__kitPuppet === true; }\n' +
        'finally { MobLookKit.puppet = orig; }\n' +
        '})()';
      return vm.runInContext(expr, ctx);
    },
    /* placeTownNpc 装配快照: 返回值 + root.position + 入参回读(零突变) */
    place(id, anchor) {
      const expr = '(() => { const p = mkTownNpcPuppet(' + JSON.stringify(id) + ');\n' +
        'const a = ' + JSON.stringify(anchor) + ';\n' +
        'const r = placeTownNpc(p, a);\n' +
        'return {ret: r,\n' +
        'retKeys: Object.keys(r).sort(),\n' +
        'pos: [p.root.position.x, p.root.position.y, p.root.position.z],\n' +
        'anchorAfter: {x: a.x, y: a.y, z: a.z, face: a.face}};\n' +
        '})()';
      return JSON.parse(JSON.stringify(vm.runInContext(expr, ctx)));
    },
    /* 全链: anchorOf(锚点表真源) 产物原样喂 placeTownNpc */
    placeViaAnchorOf(id, anchorId, legIndex) {
      const expr = '(() => { const a = anchorOf(' + JSON.stringify(anchorId) +
        ', ' + JSON.stringify(legIndex) + ');\n' +
        'const r = placeTownNpc(mkTownNpcPuppet(' + JSON.stringify(id) + '), a);\n' +
        'return {anchor: a, ret: r};\n})()';
      return JSON.parse(JSON.stringify(vm.runInContext(expr, ctx)));
    },
  };
}

/* ---------- ① 装载零副作用(票文 §4.4: 不 new THREE 顶层对象) ---------- */
test('装载零副作用: 裸沙盒无 THREE/document/kit 可装载, 两入口在册', () => {
  const ctx = bareCtx();
  const kind = vm.runInContext(
      '({mk: typeof mkTownNpcPuppet, place: typeof placeTownNpc})', ctx);
  assert.strictEqual(kind.mk, 'function', 'mkTownNpcPuppet 入口在册');
  assert.strictEqual(kind.place, 'function', 'placeTownNpc 入口在册');
});

/* ---------- ② 14 id 全部可建 + 形状恰四键 + look 回查注册表(§4.1) ---------- */
test('14 id 全部可建: 产物恰四键 · look 键与注册表行对账 · root 未摆放', () => {
  const b = bridge(adapterCtx());
  const idKey = b.registryIdKey();
  for (const id of ID_LITERALS) {
    const p = b.mk(id);
    assert.deepStrictEqual(p.keySet, ['anchorHeight', 'bones', 'look', 'root'],
        id + ' 产物恰四键 root/bones/look/anchorHeight(零预造 API 面)');
    assert.strictEqual(p.look, idKey[id],
        id + ' look 键=' + idKey[id] + '(按注册表查 key, 回查在册)');
    assert.strictEqual(p.rootIsGroup, true, id + ' root 为 THREE.Group');
    assert.deepStrictEqual(p.rootPos, [0, 0, 0], id + ' root 未摆放(原点)');
    assert.strictEqual(p.bonesRootIsRoot, true,
        id + ' bones.root 即傀儡根(kit 惯例保留)');
    assert.strictEqual(p.bodyPresent, true,
        id + ' root 骨改名 body(kit 口径保留)');
  }
});

/* ---------- ③ anchorHeight 权威值(§4.1; 票面口径勿修正) ---------- */
test('anchorHeight: V 系 2.0 · G01 2.7 · 动物随几何(声明盒顶独立推导)', () => {
  const b = bridge(adapterCtx());
  for (const id of ID_LITERALS) {
    const h = b.mk(id).anchorHeight;
    if (id[0] === 'A') {
      assert.ok(Math.abs(h - ANCHOR_HEIGHT[id]) < 1e-9,
          id + ' anchorHeight=' + h + ' ≈' + ANCHOR_HEIGHT[id] +
          '(随几何: 声明盒顶 px÷16)');
    } else {
      assert.strictEqual(h, ANCHOR_HEIGHT[id],
          id + ' anchorHeight=' + ANCHOR_HEIGHT[id] + '(票面权威值)');
    }
  }
});

/* ---------- ④ bones 逐骨透传 + G01 花盒骨在册 + kit 产物打标(§3 显隐预留) ---------- */
test('bones 逐骨透传: 与 kit 直产键集一致 · G01 flower 骨在册 · root 系 kit 产物', () => {
  const b = bridge(adapterCtx());
  for (const id of ID_LITERALS) {
    const p = b.mk(id);
    assert.strictEqual(p.boneKeys.join(','), b.kitBoneKeys(p.look),
        id + ' bones 键集与 MobLookKit.puppet(' + p.look + ') 直产一致(透传不改名)');
  }
  const g01 = b.mk('G01');
  assert.ok(g01.boneKeys.includes('flower'),
      'G01 flower 花盒骨随 bones 透传在册(显隐预留, 逻辑归动画层票)');
  assert.strictEqual(g01.flowerIsGroup, true, 'G01 flower 骨为 Group');
  assert.strictEqual(g01.flowerIsMesh, false, 'G01 flower 骨非 Mesh(花盒骨组)');
  assert.strictEqual(b.kitTaggedRoot('V01'), true,
      'V01 root 确为 MobLookKit.puppet 产物(kit seam 打标回读)');
});

/* ---------- ⑤ placeTownNpc 站位: (x, y+1, z) · 返回零内部引用 · 零突变(§4.2) ---------- */
test('placeTownNpc: 站位=(x, y+1, z) · 返回恰四键与 position 一致 · 入参零突变', () => {
  const b = bridge(adapterCtx());
  const r = b.place('V01', {x: 3, y: 10, z: 7, face: 'north'});
  assert.deepStrictEqual(r.retKeys, ['x', 'yaw', 'y', 'z'],
      '返回恰四键 {x,y,z,yaw}(零内部引用: 不携带 puppet/root/bones)');
  assert.deepStrictEqual(r.ret, {x: 3, y: 11, z: 7, yaw: 0},
      '返回值=站位面 (x, y+1, z) + yaw(townSpawnIntent 先例)');
  assert.deepStrictEqual(r.pos, [3, 11, 7],
      'root.position 置 (x, y+1, z) 与返回值一致');
  assert.deepStrictEqual(r.anchorAfter, {x: 3, y: 10, z: 7, face: 'north'},
      '入参 anchor 零突变(纯装配)');
});

/* ---------- ⑥ face→yaw 五朝向域: 三角断言锁语义 + up 域外炸(§4.2/§3) ---------- */
test('face→yaw: 四正交前向向量三角互证 · 南北差 π 东西互反 ±π/2 · up 抛拼写域错', () => {
  const b = bridge(adapterCtx());
  /* 前向向量协议(-sin yaw, -cos yaw, 引擎 camera-rig lookDir 同式):
     north=-Z / south=+Z / east=+X / west=-X —— 由 face 语义独立给出,
     与实现产 yaw 做三角互证(锁语义不锁实现) */
  const AXIS = {north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0]};
  const yawOf = {};
  for (const face of Object.keys(AXIS)) {
    const r = b.place('V01', {x: 0, y: 0, z: 0, face});
    const yaw = r.ret.yaw;
    const fx = -Math.sin(yaw); const fz = -Math.cos(yaw);
    const msg = face + ' yaw=' + yaw + ' 前向 (' + fx + ',' + fz + ') ≈ ' +
        AXIS[face] + '(三角互证)';
    assert.ok(Math.abs(fx - AXIS[face][0]) < 1e-9 &&
        Math.abs(fz - AXIS[face][1]) < 1e-9, msg);
    yawOf[face] = yaw;
  }
  const mod2pi = (d) => Math.abs(Math.round(d / Math.PI) * Math.PI - d);
  assert.ok(mod2pi(yawOf.south - yawOf.north) < 1e-9,
      '南北相差 π(互为反向)');
  assert.ok(Math.abs(yawOf.east + yawOf.west) < 1e-9,
      '东西互为相反数');
  assert.ok(Math.abs(Math.abs(yawOf.east) - Math.PI / 2) < 1e-9 &&
      Math.abs(Math.abs(yawOf.west) - Math.PI / 2) < 1e-9,
  '东西幅度各 ±π/2');
  /* 词表第五值 up: 不可 yaw 化, 域外炸(townYawOfFace 同语义) */
  assert.throws(() => b.place('V01', {x: 0, y: 0, z: 0, face: 'up'}),
      (e) => e.message.includes('up') && e.message.includes('域'),
      'face=\'up\' 抛拼写域错(消息含值与合法域提示)');
});

/* ---------- ⑦ 未知 id 抛拼写域错(§4.3) ---------- */
test('未知 id 抛拼写域错: 消息含该 id 与合法域提示(V99/小写 v01 两路)', () => {
  const ctx = adapterCtx();
  for (const bad of ['V99', 'v01']) {
    assert.throws(() => vm.runInContext('mkTownNpcPuppet(' + JSON.stringify(bad) + ')', ctx),
        (e) => e.message.includes(bad) && e.message.includes('域'),
        '未知 id「' + bad + '」抛错且消息含 id 与合法域提示');
  }
});

/* ---------- ⑧ 全链: anchorOf 产物 → placeTownNpc(§4.4 Node 桩下全链可测) ---------- */
test('全链: anchorOf(npc:v01) 产物 → placeTownNpc 落 (79, 25, 94) 面南', () => {
  const b = bridge(adapterCtx());
  const r = b.placeViaAnchorOf('V01', 'npc:v01');
  assert.deepStrictEqual(r.anchor, {x: 79, y: 24, z: 94, face: 'south'},
      'anchorOf 真源产物形状 {x,y,z,face}');
  assert.deepStrictEqual(r.ret, {x: 79, y: 25, z: 94, yaw: Math.PI},
      'V01 站位=(79, 25, 94)(站立面 y+1) · 面南 yaw=π');
});
