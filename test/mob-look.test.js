'use strict';
/* 造型档案 (js/mob-look-kit.js + js/mob-look/*.js) 单测 — node --test
   运行: node --test test/mob-look.test.js
   纯逻辑面直测(界面即测试面): 注册表键集(文件名=声明键=白名单) ·
   基座→槽位换算(官方 px → 世界单位, z 镜像成 +Z) · UV 区域公式 ·
   贴图布局合法性(不出界/无部分重叠) · 贴图全覆盖(用到的区域必画) ·
   几何 UV 落点(逐顶点采样必涂, 模型黑缝回归) ·
   同 type 两次绘制逐字节一致 · 头像裁切。渲染段经 boot 冒烟
   (UV 落点以最小 THREE 桩在 Node 直测, 其余渲染行为不在此面)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const LOOK_DIR = path.join(ROOT, 'js', 'mob-look');
const MobLookKit = require('../js/mob-look-kit.js');
const {MOB_TYPES} = require('../js/mob-registry.js');

/* 经典脚本复刻: look 文件在共享词法环境里对 MobLookKit 声明(与浏览器同构) */
const lookFiles = fs.readdirSync(LOOK_DIR).filter((f) => f.endsWith('.js')).sort();
function declareAll(kit) {
  const ctx = vm.createContext({MobLookKit: kit});
  for (const f of lookFiles) {
    vm.runInContext(fs.readFileSync(path.join(LOOK_DIR, f), 'utf8'), ctx, {filename: f});
  }
}
declareAll(MobLookKit);

/* 票②收尾翻转: 白名单 = MOB_TYPES 全怪(除 mix 伪类型) + player —
   注册表新增怪而漏建档案文件时, 键集断言直接红(设计文档 §5) */
const MIGRATED = Object.keys(MOB_TYPES).filter((k) => k !== 'mix')
    .concat(['player']).sort();

/* ============ 测试 ============ */

test('造型档案: 注册表 — 文件名=声明键 · 键集=票①白名单 · 键 ∈ MOB_TYPES∪player', () => {
  for (const f of lookFiles) {
    const key = path.basename(f, '.js');
    assert.ok(MobLookKit.has(key), f + ' 应声明与文件名同键的造型');
  }
  assert.deepStrictEqual(MobLookKit.keys().sort(), MIGRATED.slice().sort(),
      '票①白名单之外多出的键要入册(或改白名单)');
  for (const k of MobLookKit.keys()) {
    assert.ok(k === 'player' || k in MOB_TYPES, '造型键 ' + k + ' 不在 MOB_TYPES(拼错/私生怪)');
    const look = MobLookKit.textureBuffer(k) && k; /* 顺带触发下面覆盖测试的入口 */
    assert.ok(look, k + ' 应可绘制');
  }
});

test('造型档案: 人形基座换算 — 官方 px → 世界单位(+Z 镜像), 官方等比尺寸', () => {
  const rig = MobLookKit.rig('zombie');
  assert.deepStrictEqual(rig.slots.head.joint, [0, 1.5, 0], '头枢轴 24px = 1.5 格');
  assert.deepStrictEqual(rig.slots.armR.joint, [-5/16, 22/16, 0], '右肩枢轴官方 [−5,22,0]px');
  const arm = rig.slots.armR.boxes[0];
  assert.ok(Math.abs(arm.w - 0.25) < 1e-9 && Math.abs(arm.h - 0.75) < 1e-9,
      '官方臂 4×12×4px = 0.25×0.75×0.25 格');
  const headBox = rig.slots.head.boxes[0];
  assert.ok(Math.abs(headBox.w - 0.5) < 1e-9 && Math.abs(headBox.h - 0.5) < 1e-9,
      '官方头 8×8×8px = 0.5 格(脸画在贴图正面, 不再拼眼嘴盒)');
  assert.strictEqual(rig.armStyle, 'zombie', 'armStyle 透传(gait 僵尸式双臂前伸)');
  assert.strictEqual(rig.slots.legL.cubes.length, 1, '人形基座每槽一盒');
});

test('造型档案: 细骨基座 — 四肢 2×12×2 · 追加骨(骷髅弓)进 armL 第二盒', () => {
  const rig = MobLookKit.rig('skeleton');
  const arm = rig.slots.armR.boxes[0];
  assert.ok(Math.abs(arm.w - 2/16) < 1e-9, '细骨臂宽 2px');
  assert.strictEqual(rig.slots.armL.cubes.length, 2, 'armL = 基座臂 + 追加弓');
  assert.strictEqual(rig.weaponArm, 'armL', '挥击手=持械手(弓在左臂)');
  assert.strictEqual(rig.armStyle, 'archer', '弓手步态');
});

test('造型档案: 自有骨架 — 苦力怕无臂四腿 · 蜘蛛八腿独立骨两段折线与前置头', () => {
  const cr = MobLookKit.rig('creeper');
  assert.ok(!cr.slots.armL && !cr.slots.armR, '苦力怕无臂(官方)');
  assert.strictEqual(cr.slots.legL.cubes.length, 2, '对角腿成对进 legL');
  const leg = cr.slots.legL.boxes[0];
  assert.ok(Math.abs(leg.h - 6/16) < 1e-9, '官方短腿 6px');
  const sp = MobLookKit.rig('spider');
  for (const i of [1, 2, 3, 4]) {
    assert.strictEqual(sp.slots['legL' + i].cubes.length, 2, '蜘蛛左' + i + '腿两段(股+胫)');
    assert.strictEqual(sp.slots['legR' + i].cubes.length, 2, '蜘蛛右' + i + '腿两段');
  }
  const femur = sp.slots.legL1.boxes[0];
  assert.ok(Math.abs(femur.w - 8/16) < 1e-9 && Math.abs(femur.h - 2/16) < 1e-9,
      '官方腿截面 2px, 段长 8px(16 长杆拆两段折线)');
  assert.ok(femur.rz > 0 && sp.slots.legR1.boxes[0].rz < 0,
      '左腿 rz 下斜 · 右腿反号(折线左右镜像)');
  const zs = [1, 2, 3, 4].map((i) => sp.slots['legL' + i].joint[2]);
  assert.strictEqual(new Set(zs).size, 4, '四腿 pivot z 扇形交错(官方 2/1/0/−1)');
  assert.ok(sp.slots.head.boxes[0].z > 0, '头在 +Z 前侧(官方 −11px 前置镜像)');
});

test('造型档案: 票②基座扩展 — 灾厄基座 · 宽头参数 · 翼槽 axis · scale 变体', () => {
  const vd = MobLookKit.rig('vindicator');
  const head = vd.slots.head.boxes[0];
  assert.ok(Math.abs(head.h - 10/16) < 1e-9, '灾厄头高官方 10px');
  assert.strictEqual(vd.slots.head.cubes.length, 2, '头+鼻追加骨(官方立体鼻)');
  assert.strictEqual(vd.slots.root.cubes.length, 2, '身+长袍 overlay(inflate 0.5)');
  const pg = MobLookKit.rig('piglin');
  assert.ok(Math.abs(pg.slots.head.boxes[0].w - 10/16) < 1e-9, '猪灵宽头 10px(headW 参数)');
  const ch = MobLookKit.rig('chicken');
  assert.strictEqual(ch.slots.wingL.axis, 'z', '自有翼骨 axis 透传(扇翅)');
  assert.strictEqual(ch.slots.wingL.cubes.length, 1, '翼骨一盒');
  const ws = MobLookKit.rig('wither_skeleton');
  const wsArm = ws.slots.armR.boxes[0];
  assert.ok(Math.abs(wsArm.h - 12*1.2/16) < 1e-9, '凋灵骷髅 scale 1.2(官方 2×12×2×1.2)');
  const cs = MobLookKit.rig('cave_spider');
  assert.ok(Math.abs(cs.slots.legL1.boxes[0].w - 8*0.7/16) < 1e-9, '洞穴蜘蛛 scale 0.7(蜘蛛骨×0.7)');
});

test('造型档案: UV 区域公式 — 玩家布局(官方 64×64) · overlay 第二盒', () => {
  const R = MobLookKit.regions('player');
  assert.deepStrictEqual(R.head.front, [8, 8, 8, 8], '头正面 [8,8](官方布局可直填)');
  assert.deepStrictEqual(R.armL.front, [36, 52, 4, 12], '左臂独立区 [32,48] 布局');
  const S = MobLookKit.regions('sheep');
  assert.ok(S.root2 && S.head2, '羊毛 overlay = 身/头第二盒(inflate)');
  assert.deepStrictEqual(S.root2.front, [16, 56, 8, 6], '羊毛身区(自配布局)');
});

test('造型档案: 贴图布局合法性 — 六面矩形不出界 · 不同盒无部分重叠(共区合法)', () => {
  for (const type of MobLookKit.keys()) {
    const tex = MobLookKit.textureBuffer(type);
    const R = MobLookKit.regions(type);
    const rects = [];
    for (const part of Object.keys(R)) {
      for (const face of Object.keys(R[part])) rects.push([type, part, face, R[part][face]]);
    }
    for (const [type2, part, face, r] of rects) {
      assert.ok(r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= tex.size && r[1] + r[3] <= tex.size,
          type2 + ' ' + part + '.' + face + ' 出界: ' + JSON.stringify(r));
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i][3]; const b = rects[j][3];
        const same = a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
        if (same) continue; /* 整份共区(蜘蛛八腿段)是声明过的共享, 合法 */
        const ox = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
        const oy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
        assert.ok(ox === 0 || oy === 0,
            rects[i][0] + ' ' + rects[i][1] + '.' + rects[i][2] +
            ' 与 ' + rects[j][1] + '.' + rects[j][2] + ' 部分重叠');
      }
    }
  }
});

test('造型档案: 贴图全覆盖 — 用到的六面区域逐像素必画(alpha=255)', () => {
  for (const type of MobLookKit.keys()) {
    const tex = MobLookKit.textureBuffer(type);
    const R = MobLookKit.regions(type);
    for (const part of Object.keys(R)) {
      for (const face of Object.keys(R[part])) {
        const r = R[part][face];
        for (let y = 0; y < r[3]; y++) {
          for (let x = 0; x < r[2]; x++) {
            const o = ((r[1] + y) * tex.size + (r[0] + x)) * 4;
            assert.strictEqual(tex.buf[o + 3], 255,
                type + ' ' + part + '.' + face + ' 有未画像素(贴图缺角=模型黑洞)');
          }
        }
      }
    }
  }
});

test('造型档案: 头像裁切 — 16×16 网居中 · 中心像素非空且对色', () => {
  const z = MobLookKit.facePixels('zombie');
  assert.strictEqual(z.length, 256, '16×16 网');
  const c = z[8 * 16 + 8];
  assert.ok(c && c[1] > c[0] && c[1] > c[2], '僵尸脸中心应为绿系(g 通道最大)');
  const s = MobLookKit.facePixels('sheep');
  const sc = s[8 * 16 + 8];
  assert.ok(sc, '羊脸中心非空(6×6 头区居中放置)');
  assert.strictEqual(MobLookKit.facePixels('mix'), null, 'mix 伪类型无档案返 null(face 走手绘兜底)');
});

test('造型档案: 碎块色声明 — mobs.js debrisColor 的唯一权威', () => {
  assert.strictEqual(MobLookKit.debrisOf('zombie'), 0x5e9440, '僵尸碎块色(配色锚延续)');
  assert.strictEqual(MobLookKit.debrisOf('golem'), 0xcdd0d8, '铁傀儡碎块色(配色锚延续)');
  assert.strictEqual(MobLookKit.debrisOf('mix'), null, 'mix 伪类型无声明返 null(回落内联表)');
});

test('造型档案: 确定性 — 同 type 两次声明+绘制逐字节一致(种子化)', () => {
  const first = MobLookKit.textureBuffer('creeper').buf.slice();
  delete require.cache[require.resolve('../js/mob-look-kit.js')];
  const kit2 = require('../js/mob-look-kit.js');
  const ctx2 = vm.createContext({MobLookKit: kit2});
  for (const f of lookFiles) {
    vm.runInContext(fs.readFileSync(path.join(LOOK_DIR, f), 'utf8'), ctx2, {filename: f});
  }
  assert.deepStrictEqual(Array.from(kit2.textureBuffer('creeper').buf), Array.from(first),
      '重进世界观感逐像素一致(程序生成存档口径)');
});

/* ---- 几何 UV 桩: 只到 slotGeo/puppet 需要的形状(真渲染由 boot 冒烟) ----
   黑缝回归背景: UV 曾用枢轴系坐标且端点压矩形外缘, 顶点采到未涂间隙
   → 模型部件整片纯黑(玩家胳膊/头/左脚案); 覆盖测试只保证矩形涂满,
   本测试保证几何 UV 真的落在涂过的纹素上 */
function stubThree() {
  const rotX = (x, y, z, a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
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
  return {
    BoxGeometry, BufferGeometry, Float32BufferAttribute: Float32Array,
    Group: class {
      constructor() {
        this.children = []; this.position = {fromArray() {}};
      } add(o) {
        this.children.push(o);
      }
    },
    Mesh: class {
      constructor(geo) {
        this.geometry = geo;
      }
    },
    CanvasTexture: class {}, MeshLambertMaterial: class {},
  };
}

test('造型档案: 几何 UV 落点 — 逐顶点采样已涂纹素(模型黑缝回归)', () => {
  const prevThree = global.THREE; const prevDoc = global.document;
  global.THREE = stubThree();
  global.document = {createElement: () => ({getContext: () => ({
    createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), putImageData() {},
  })})};
  try {
    const check = (label, geo, tex, cubes) => {
      const uvs = geo.uv;
      assert.ok(uvs && uvs.length, label + ' 应产 UV');
      /* 退化面豁免: 平面装饰件(d/w/h=0)的零面积面从不栅格化, 贴图侧
         本就无纹素可采; 只查会真正上屏的面。面序 = 桩的 +X,-X,+Y,-Y,+Z,-Z */
      for (let i = 0; i < uvs.length / 2; i++) {
        const c = cubes[Math.floor(i / 24)]; const face = Math.floor((i % 24) / 4);
        const degFace = (face < 2 && (c.size[2] === 0 || c.size[1] === 0)) ||
            (face >= 2 && face < 4 && (c.size[0] === 0 || c.size[2] === 0)) ||
            (face >= 4 && (c.size[0] === 0 || c.size[1] === 0));
        if (degFace) continue;
        /* NearestFilter 语义: texel = floor(uv * size), 两轴各自越界即黑缝 */
        const x = Math.floor(uvs[i * 2] * tex.size);
        const y = Math.floor((1 - uvs[i * 2 + 1]) * tex.size);
        assert.ok(x >= 0 && y >= 0 && x < tex.size && y < tex.size,
            label + ' UV 出贴图: (' + uvs[i * 2] + ',' + uvs[i * 2 + 1] + ')');
        assert.strictEqual(tex.buf[(y * tex.size + x) * 4 + 3], 255,
            label + ' 顶点#' + i + ' 采到未涂纹素(' + x + ',' + y + ') = 模型黑缝');
      }
    };
    for (const type of MobLookKit.keys()) {
      const tex = MobLookKit.textureBuffer(type);
      if (type === 'player') continue; /* 玩家走下方傀儡路径(−Z) */
      const rig = MobLookKit.rig(type);
      for (const name of Object.keys(rig.slots)) {
        check(type + '.' + name, MobLookKit.slotGeoOf(type, rig.slots[name]), tex,
            rig.slots[name].cubes);
      }
    }
    const p = MobLookKit.puppet('player'); /* 傀儡 −Z 原生路径 */
    const ptex = MobLookKit.textureBuffer('player');
    for (const [name, g] of Object.entries(p.bones)) {
      if (name === 'root') continue; /* 傀儡根组非网格 */
      if (g.geometry) {
        check('player.' + name, g.geometry, ptex,
            MobLookKit.rig('player').slots[name === 'body' ? 'root' : name].cubes);
      }
    }
  } finally {
    global.THREE = prevThree; global.document = prevDoc;
  }
});
