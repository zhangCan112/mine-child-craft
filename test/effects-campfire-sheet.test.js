'use strict';
/* 篝火焰片 sheet 渲染适配 (js/effects.js campfireField 场内共享 sheet) 守门测试
   运行: node --test test/effects-campfire-sheet.test.js
   票面: T-C13-R4(方案 .scratch/campfire/tc13r-arch §2.1/§3-a/d/i + ADR-0020 授权链:
   静态部件驻 chunk 批 + 焰片全场景共享单 mesh)。守门映射票面验收:
   ①50 火帧分布+错相 = 镜像断言(逐火 tile 与 fx.flameFrameAt 单源一致);
   ②open=false 格(浇熄/燃尽余韵/挖后)永不贡献 plane(h 类禁令);
   ③clear/removeField 连带清场 dispose 零残留;
   ④UV 翻页帧号与 fx-core 单源一致(tileUV(74+frame) 全幅帧窗);
   ⑤烟/火星粒子路径零改动 = 回执 git diff 走查面(非本文件)。
   装具口径: effects.js vm 单载(audio-registry.test.js 同款最小桩 + THREE 记录桩),
   fx 用真 CampfireFxCore(消费契约真源, R-3 面零触碰), 假 DOM 走
   test/helpers/fake-dom.js mkEl(conventions §7.2), 跨域断言先摊平(§7.1——
   THREE 桩类全在宿主域构造, 仅 Fx 句柄跨域, 只做属性读不做 deepStrictEqual)。
   sheet 语义契约(装具约定): 顶点世界系 = position 属性 + mesh.position
   (mesh 无旋转缩放——共享 sheet 顶点直写, 翻页脏检按顶点落, 票面范围 2);
   火 i 的 8 顶点(2 片×4)按格归属识别, 不假设场内火序。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {mkEl} = require('./helpers/fake-dom.js');

const ROOT = path.join(__dirname, '..');
/* 图集装载走 vm 共享词法(texture-atlas 顶层引用 config 全局块 id, CommonJS
   require 不可载 — texture-atlas.test.js loadAtlas 同惯例); fx-core 纯核心可直载 */
const TextureAtlas = (() => {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'texture-atlas.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, {filename: f});
  }
  return vm.runInContext('TextureAtlas', ctx);
})();
const CampfireFxCore = require('../js/campfire-fx-core.js');

const FIRE = {x: 10, y: 25, z: 10};
/* 焰帧 tile 接线表(UI 定稿 v1.10 §4.1: T_FLAME_F1~F3 = 74~76, 帧序 F1 中立/F2 左倾/F3 右倾);
   R-1 已把九格画师锁在这三个格号, R-4 消费面按 帧号 0/1/2 → tile 74+帧号 镜像 */
const CF_FLAME_TILES = [74, 75, 76];
const TOL = 1e-4;

/* ---------- THREE 记录桩: campfireField 现路径 + 焰片 sheet 应所需面 ---------- */
function mkThreeStub() {
  const disposed = [];
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
    /* r128 契约: setDrawRange(start, count) 只记录 {start, count}(渲染取
       index.count 与 count 较小者画前段) — 桩照抄不撒谎 */
    setDrawRange(start, count) {
      this.drawRange = {start, count}; return this;
    }
    setIndex(idx) {
      this.index = Array.isArray(idx) ?
        new Attribute(Uint32Array.from(idx), 1) : idx;
      return this;
    }
    dispose() {
      disposed.push({kind: 'geometry', obj: this});
    }
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
    dispose() {
      disposed.push({kind: 'material', obj: this});
    }
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
    disposed,
    BoxGeometry, SphereGeometry, CylinderGeometry,
    MeshLambertMaterial, MeshBasicMaterial, Mesh, Group,
    BufferGeometry, BufferAttribute: Attribute,
    Float32BufferAttribute: Attribute,
    Vector3: Vec3,
    DoubleSide: 2,
    DynamicDrawUsage: 'DYNAMIC',
  };
}

/* ---------- effects.js vm 单载(共享一份桩域, 测试内 Fx.clear() 复位) ---------- */
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
  THREE: stub,
  scene,
  atlasMat: atlas,
  TextureAtlas,
  document: {getElementById: (id) => (id === 'toast' ? mkEl('div') : mkEl('div'))},
  performance: {now: () => 0},
  IS_TOUCH: false,
  console: {log() {}, warn() {}, error() {}},
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'effects.js'), 'utf8'),
    ctx, {filename: 'js/effects.js'});
const Fx = vm.runInContext('Fx', ctx);

/* ---------- 断言助手 ---------- */
const mkFx = () => CampfireFxCore.mkCampfireFx({});
const key = (c) => c.x + ',' + c.y + ',' + c.z;
const sheetOf = () =>
  scene.children.filter((m) => m && m.material && m.material.map === atlas.map);
const fireCount = (mesh) => {
  assert.ok(mesh && mesh.geometry,
      '焰片 sheet 未在场(sheetOf() 空) — sheet 未实现或未挂场(与 R4-1 同因)');
  /* R5-c4 恒定属性案: 火数=绘段数/12(每火 12 索引)——满容量属性下
     position.count 是容量级, 活火数只读 drawRange */
  const dr = mesh.geometry.drawRange;
  const live = (dr && typeof dr.count === 'number') ? dr.count : Infinity;
  if (live === Infinity) return mesh.geometry.attributes.position.count / 8;
  return live / 12;
};

/* 顶点世界系 = 属性 + mesh.position(装具口径, 见文件头) */
function worldVert(mesh, i) {
  const a = mesh.geometry.attributes.position.array;
  return [a[i * 3] + mesh.position.x, a[i * 3 + 1] + mesh.position.y,
    a[i * 3 + 2] + mesh.position.z];
}

/* 顶点按格归属分桶(⊆ 自有格不变量, 方案 §3-b: 面片出格=邻格拾取语义污染)。
   守门版: 顶点落任何给定格外即抛(不变量断言面, R4-2/R4-6/R4-7 直测用);
   探针须用下方 matchVertsByCell(非抛错纯匹配) — R5-c3 裁决: find 谓词内
   不得抛错(R4-8 曾因此依赖实现倒序, 正序即红, 红证
   .scratch/campfire/tc13r5/red-c3-serial-order.log)。 */
function matchVertsByCell(mesh, cells) {
  const out = new Map(cells.map((c) => [key(c), []]));
  const unmatched = [];
  /* R5-c4 恒定属性案: 只读活顶点段(前 n 火×8)——满容量 buffer 的尾段是
     swap-remove 的 stale 块, 绘段数(drawRange)才是活火面 */
  const dr = mesh.geometry.drawRange;
  const liveIdx = (dr && typeof dr.count === 'number') ? dr.count : Infinity;
  const n = liveIdx === Infinity ?
    mesh.geometry.attributes.position.count : (liveIdx / 12) * 8;
  for (let i = 0; i < n; i++) {
    const [wx, wy, wz] = worldVert(mesh, i);
    const hit = cells.find((c) =>
      wx >= c.x && wx < c.x + 1 && wy >= c.y && wy < c.y + 1 && wz >= c.z && wz < c.z + 1);
    if (!hit) {
      unmatched.push([i, wx, wy, wz]);
      continue;
    }
    out.get(key(hit)).push(i);
  }
  return {byCell: out, unmatched};
}

function vertsByCell(mesh, cells) {
  assert.ok(mesh && mesh.geometry, '焰片 sheet 未在场 — 顶点按格分桶无处落');
  const {byCell, unmatched} = matchVertsByCell(mesh, cells);
  const bad = unmatched[0];
  if (bad !== undefined) {/* 先判后构造消息(bad 可能 undefined — 装具炸≠断言红, §7.4) */
    assert.fail('焰片顶点 ' + bad[0] + '(' + bad[1].toFixed(3) + ',' + bad[2].toFixed(3) + ',' +
      bad[3].toFixed(3) + ') 落在任何 open 格外 — 面片出格(⊆自有格不变量)');
  }
  return byCell;
}

function countNear(vals, v) {
  return vals.filter((x) => Math.abs(x - v) < TOL).length;
}

/* 每火 2 片 90° 交叉: 恰 4 顶点共 z(片 A 沿 X 展开)+恰 4 顶点共 x(片 B 沿 Z 展开),
   高 0.4~0.5×宽 0.35(UI 定稿 §4.4 不变量), 两片轴互相穿越(真交叉非并排) */
function assertCross(mesh, slots, cell, tag) {
  const v = slots.map((i) => worldVert(mesh, i));
  let za = null; let xb = null;
  for (const cand of v.map((p) => p[2])) {
    if (countNear(v.map((p) => p[2]), cand) === 4) {
      za = cand; break;
    }
  }
  for (const cand of v.map((p) => p[0])) {
    if (countNear(v.map((p) => p[0]), cand) === 4) {
      xb = cand; break;
    }
  }
  assert.ok(za !== null, tag + ': 缺 ±Z 法线片(4 顶点共 z) — 2 片 90° 交叉不成立');
  assert.ok(xb !== null, tag + ': 缺 ±X 法线片(4 顶点共 x) — 2 片 90° 交叉不成立');
  const qa = v.filter((p) => Math.abs(p[2] - za) < TOL);
  const qb = v.filter((p) => Math.abs(p[0] - xb) < TOL);
  assert.strictEqual(qa.length, 4, tag + ': ±Z 片顶点数应恰 4, 实得 ' + qa.length);
  assert.strictEqual(qb.length, 4, tag + ': ±X 片顶点数应恰 4, 实得 ' + qb.length);
  for (const [q, spanAxis, tag2] of [[qa, 0, '±Z 片'], [qb, 2, '±X 片']]) {
    const lo = Math.min(...q.map((p) => p[spanAxis]));
    const hi = Math.max(...q.map((p) => p[spanAxis]));
    const yLo = Math.min(...q.map((p) => p[1]));
    const yHi = Math.max(...q.map((p) => p[1]));
    assert.ok(Math.abs(hi - lo - 0.35) < 1e-3,
        tag + ' ' + tag2 + ': 宽应 0.35(UI 定稿 §4.4), 实得 ' + (hi - lo).toFixed(4));
    assert.ok(yHi - yLo > 0.4 - 1e-3 && yHi - yLo < 0.5 + 1e-3,
        tag + ' ' + tag2 + ': 高应在 0.4~0.5(UI 定稿 §4.4), 实得 ' + (yHi - yLo).toFixed(4));
  }
  /* 交叉点在格内中缝(建议值 0.5, 容 ±0.2 实现微调), 且两片轴互相穿越 */
  const lz = za - cell.z; const lx = xb - cell.x;
  assert.ok(lz > 0.3 && lz < 0.7, tag + ': ±Z 片固定轴应在格内中缝(0.5±0.2), 实得 ' + lz.toFixed(3));
  assert.ok(lx > 0.3 && lx < 0.7, tag + ': ±X 片固定轴应在格内中缝(0.5±0.2), 实得 ' + lx.toFixed(3));
  const qaX = qa.map((p) => p[0]); const qbZ = qb.map((p) => p[2]);
  assert.ok(xb >= Math.min(...qaX) - TOL && xb <= Math.max(...qaX) + TOL,
      tag + ': ±X 片不在 ±Z 片的 X 展开范围内 — 并排非交叉');
  assert.ok(za >= Math.min(...qbZ) - TOL && za <= Math.max(...qbZ) + TOL,
      tag + ': ±Z 片不在 ±X 片的 Z 展开范围内 — 并排非交叉');
}

/* UV 帧窗镜像: 槽位 uv 全部落在 tileUV(tile) 四角内且四角全覆盖(全幅帧窗) */
function assertUvWindow(mesh, slots, tile, tag) {
  const uv = mesh.geometry.attributes.uv;
  assert.ok(uv, tag + ': sheet 缺 uv 属性(UV 翻页无处落)');
  const a = uv.array;
  const [u0, v0, u1, v1] = TextureAtlas.tileUV(tile);
  const corners = [[u0, v1], [u1, v1], [u0, v0], [u1, v0]];
  const at = (s) => [a[s * 2], a[s * 2 + 1]];
  for (const s of slots) {
    const [u, w] = at(s);
    assert.ok(corners.some(([cu, cv]) => Math.abs(u - cu) < TOL && Math.abs(w - cv) < TOL),
        tag + ': 顶点 uv(' + u.toFixed(4) + ',' + w.toFixed(4) + ') 不在 tile ' + tile +
      ' 帧窗四角(应全幅采样, 帧 tile=74+flameFrameAt)');
  }
  for (const [cu, cv] of corners) {
    assert.ok(slots.some((s) => Math.abs(at(s)[0] - cu) < TOL && Math.abs(at(s)[1] - cv) < TOL),
        tag + ': tile ' + tile + ' 帧窗角(' + cu.toFixed(4) + ',' + cv.toFixed(4) +
      ') 无顶点覆盖 — 非全幅帧');
  }
}

/* 从槽位 uv 反推帧 tile(走查用): u0 定列, v1 定行(tileUV 换算逆) */
function tileOfUv(mesh, slots) {
  const a = mesh.geometry.attributes.uv.array;
  const us = slots.map((s) => a[s * 2]);
  const vs = slots.map((s) => a[s * 2 + 1]);
  const c = Math.round(Math.min(...us) * 16);
  const r = 16 - Math.round(Math.max(...vs) * 16);
  return r * 16 + c;
}

/* 顶点色亮度(8 槽 rgb 均值, itemSize 3/4 兼容): 渐弱=亮度插值载体 */
function brightnessOf(mesh, slots) {
  const col = mesh.geometry.attributes.color;
  assert.ok(mesh && mesh.geometry, '焰片 sheet 未在场 — 顶点色亮度无处读');
  assert.ok(col, 'sheet 缺 color 顶点色属性(vertexColors 材质无色=渐弱无处落)');
  const a = col.array; const n = Math.min(3, col.itemSize);
  let sum = 0;
  for (const s of slots) {
    for (let k = 0; k < n; k++) sum += a[s * col.itemSize + k];
  }
  return sum / (slots.length * n);
}

/* ---------- 守门测试 ---------- */

test('R4-1 惰性建+材质面: 零在册格零 sheet; 首 open 恰一张共享 sheet, ' +
    'MeshBasic{map=atlasMat.map, alphaTest 0.5, DoubleSide, vertexColors, 不透明队列}, frustumCulled=false', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  Fx.update(0.05);
  assert.strictEqual(sheetOf().length, 0,
      '零在册格不得建 sheet(惰性建: 门=fx.cells() 非空才建; 成员=其中 open 格 — ' +
      '在册格必曾 open, R5-c2 裁决 ii 口径如实化)');
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  Fx.update(0.05);
  const sheets = sheetOf();
  assert.strictEqual(sheets.length, 1,
      '恰一张全场景共享 sheet(ADR-0020: 每场 1 mesh, dc 增量 ≈+1)');
  const s = sheets[0];
  const m = s.material;
  assert.strictEqual(s.frustumCulled, false,
      'frustumCulled=false(方案 §3-a: 单 mesh 恒绘, 200 三角可忽略, 免包围球维护)');
  assert.strictEqual(m.map, atlas.map, '材质贴图=共享图集 atlasMat.map(零新纹理零新产权)');
  assert.strictEqual(m.alphaTest, 0.5, 'alphaTest 0.5(65/67 alpha 真透管线先例)');
  assert.strictEqual(m.side, stub.DoubleSide, 'DoubleSide(交叉面片双侧可见, 免每面正反两绘)');
  assert.strictEqual(m.vertexColors, true, 'vertexColors=true(§5.8 渐弱顶点色亮度插值载体)');
  assert.notStrictEqual(m.transparent, true,
      'transparent 必须为假(方案 §3-d: 不透明队列序无关, 与烟 alpha blend 免排序互扰)');
  Fx.removeField(h);
});

test('R4-2 几何不变量: 单火恰 8 顶点 12 索引, 2 片 90° 交叉(4 共 z + 4 共 x), 高 0.4~0.5×宽 0.35, 全顶点 ⊆ 自有格 [x,x+1)³', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  Fx.update(0.05);
  const s = sheetOf()[0];
  assert.ok(s, '前置: sheet 在场(R4-1)');
  const geo = s.geometry;
  assert.strictEqual(geo.attributes.position.count, 8,
      '单火恰 8 顶点(2 片×4 顶点, 票面范围 2: 脏检写 8 顶点/火的落点)');
  assert.ok(geo.index, 'sheet 几何带索引(4 三角=2 片×2 三角)');
  assert.strictEqual(geo.index.count, 12, '单火恰 12 索引(2 片×2 三角×3)');
  for (const idx of geo.index.array) {
    assert.ok(idx >= 0 && idx < 8, '索引 ' + idx + ' 越出本火顶点槽 [0,8)');
  }
  const byCell = vertsByCell(s, [FIRE]);
  const slots = byCell.get(key(FIRE));
  assert.strictEqual(slots.length, 8, '本火 8 顶点应全部落在自有格内');
  assertCross(s, slots, FIRE, '单火');
  Fx.removeField(h);
});

test('R4-3 membership 全路径同步: open 挂/浇熄摘/重燃再挂/燃尽摘/挖掘摘 — 顶点数与 fx open 格集同拍且恒一张 sheet', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  const A = {x: 10, y: 25, z: 10};
  const B = {x: 20, y: 25, z: 10};
  fx.open(A.x, A.y, A.z);
  fx.open(B.x, B.y, B.z);
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 2, '双火=16 顶点(每火 8)');
  fx.quench(A.x, A.y, A.z);
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 1, '浇熄即摘: open=false 格退出 sheet(方案 §2.2)');
  fx.open(A.x, A.y, A.z);
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 2, '重燃重挂(摘后重开恢复, fx 句柄五纪律)');
  fx.burnout(B.x, B.y, B.z);
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 1, '燃尽即摘(渐熄粒子尾巴归 fx 既有, sheet 零残片)');
  fx.dig(A.x, A.y, A.z);
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 0, '挖掘即摘(非事件回收)');
  assert.strictEqual(sheetOf().length, 1,
      '全路径始终恰一张共享 sheet(成员增删走顶点槽, 不另立 mesh)');
  Fx.removeField(h);
});

test('R4-4 open=false 格永不贡献 plane(h 类禁令): 浇熄格/燃尽余韵格 cells() 在册但 sheet 零 plane; 燃尽余韵期满+存量清空后格回收', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  const A = {x: 10, y: 25, z: 10};
  fx.open(A.x, A.y, A.z);
  fx.quench(A.x, A.y, A.z);
  assert.ok(fx.cells().some((c) => key(c) === key(A) && c.open === false),
      '前置: 浇熄格仍在 cells() 在册(open=false) — 正是 h 类 bug 的诱发态');
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 0,
      '浇熄格 cells() 在册但必须零 plane(禁止扫任意 campfire 格建焰片, 方案 §3-e 红线)');
  const B = {x: 20, y: 25, z: 10};
  fx.open(B.x, B.y, B.z);
  fx.setLeft(B.x, B.y, B.z, 1);
  fx.tick(0.05);
  fx.burnout(B.x, B.y, B.z);
  assert.ok(fx.cells().some((c) => key(c) === key(B) && c.open === false),
      '前置: 燃尽余韵格仍在 cells() 在册(open=false, <0.4s 查询面未退场)');
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 0,
      '燃尽余韵格零 plane(「熄灭态重建成燃态」类零容忍)');
  Fx.removeField(h);
});

test('R4-5 UV 翻页镜像: 帧窗=tileUV(74+fx.flameFrameAt) 全幅, 帧推进换窗(74/75/76 依次), 与 fx-core 单源逐拍一致', () => {
  Fx.clear();
  const fx = mkFx();
  assert.strictEqual(fx.params.flamePlanes.frames, CF_FLAME_TILES.length,
      '前置: flamePlanes.frames 与焰帧接线表等长(R-3 参数行单源对账)');
  const h = Fx.campfireField(fx);
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  const seen = [];
  let guard = 0;
  const frame = fx.flameFrameAt(FIRE.x, FIRE.y, FIRE.z);
  seen.push(frame);
  while (seen.length < 3 && guard < 200) {
    fx.tick(0.01);
    Fx.update(0.016); /* 同步步进不动 fx 时钟(stepFields 只读), 双跑覆盖帧切换沿 */
    const f = fx.flameFrameAt(FIRE.x, FIRE.y, FIRE.z);
    if (f !== seen[seen.length - 1]) seen.push(f);
    guard++;
  }
  assert.strictEqual(seen.length, 3, '前置: 200 步内三帧全走(实测走了 ' + seen.length + ' 帧)');
  assert.ok(guard > 0, '前置: 确有翻页推进');
  const s = sheetOf()[0];
  assert.ok(s, 'sheet 在场(R4-1)');
  const slots = vertsByCell(s, [FIRE]).get(key(FIRE));
  const want = CF_FLAME_TILES[fx.flameFrameAt(FIRE.x, FIRE.y, FIRE.z)];
  assertUvWindow(s, slots, want, '翻页后');
  /* 换窗实证: 记录当前窗, 推进到下一帧, UV 必须换成新帧窗 */
  const uvA = Array.from(s.geometry.attributes.uv.array);
  let guard2 = 0;
  const prev = fx.flameFrameAt(FIRE.x, FIRE.y, FIRE.z);
  while (fx.flameFrameAt(FIRE.x, FIRE.y, FIRE.z) === prev && guard2 < 200) {
    fx.tick(0.01);
    guard2++;
  }
  Fx.update(0.016);
  const uvB = Array.from(s.geometry.attributes.uv.array);
  const next = fx.flameFrameAt(FIRE.x, FIRE.y, FIRE.z);
  assert.notStrictEqual(next, prev, '前置: 已推进到下一帧');
  assertUvWindow(s, slots, CF_FLAME_TILES[next], '换窗后');
  assert.notDeepStrictEqual(uvB, uvA, '帧切换后 UV 必须重写(翻页不是静止贴图)');
  Fx.removeField(h);
});

test('R4-6 错相镜像+容量: 50 火同拍逐火 tile 与 fx.flameFrameAt 单源一致, 帧分布覆盖全部 3 帧(R5-c1 升锁, 零齐翻), 容量翻倍后仍恰一张 sheet 全员在绘', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  /* 50 火固定场(方案 §3-f 口径: 7×7 去四角 45 + 5), 全确定性零随机 */
  const cells50 = [];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      if ((i === 0 || i === 6) && (j === 0 || j === 6)) continue;
      cells50.push({x: 100 + i * 7, y: 25, z: 100 + j * 7});
    }
  }
  for (let k = 0; k < 5; k++) cells50.push({x: 200 + k * 9, y: 25, z: 100});
  assert.strictEqual(cells50.length, 50, '前置: 50 火场成形');
  for (const c of cells50) fx.open(c.x, c.y, c.z);
  fx.tick(0.07); /* 固定采样时刻(确定性, 任意时刻镜像均须成立) */
  Fx.update(0.05);
  const sheets = sheetOf();
  assert.strictEqual(sheets.length, 1,
      '50 火仍恰一张共享 sheet(容量翻倍 mobs 惯例: 扩容量不扩 mesh 数)');
  const s = sheets[0];
  assert.strictEqual(s.geometry.drawRange.count, 600,
      '50 火×12 索引=600 全员在绘(扩容不丢早挂火; R5-c4 恒定属性案活火数读 drawRange)');
  const byCell = vertsByCell(s, cells50);
  const frames = new Set();
  for (const c of cells50) {
    const slots = byCell.get(key(c));
    assert.strictEqual(slots.length, 8, '火(' + key(c) + ') 恰 8 顶点');
    assertCross(s, slots, c, '火(' + key(c) + ')');
    const want = CF_FLAME_TILES[fx.flameFrameAt(c.x, c.y, c.z)];
    assert.strictEqual(tileOfUv(s, slots), want,
        '火(' + key(c) + ') 渲染帧 tile 必须=74+flameFrameAt(单源镜像)');
    frames.add(fx.flameFrameAt(c.x, c.y, c.z));
  }
  assert.ok(frames.size >= 3,
      '采样时刻 50 火帧分布应覆盖全部 3 帧(R5-c1 锁强化: 评审确定性场景实测 15/18/17 全覆盖, ' +
      '零 flake——frame-coverage-proof.js 六采样时刻最差覆盖 3/3; 旧锁 >=2 对 2/3 帧不可分, ' +
      '实得 ' + frames.size + ' 帧)');
  Fx.removeField(h);
});

test('R4-7 渐弱(§5.8 扩含面片): tint=0 顶点色恒白不暗化; tint 增大亮度单调下降(亮度插值随 fx 渐弱窗)', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  Fx.update(0.05);
  const s = sheetOf()[0];
  const slots = vertsByCell(s, [FIRE]).get(key(FIRE));
  assert.strictEqual(brightnessOf(s, slots), 1,
      'tint=0(无渐弱)顶点色必须恒白(1,1,1) — 插值 k=0 锚=原色');
  fx.setLeft(FIRE.x, FIRE.y, FIRE.z, 400); /* ≤10% 窗内(600 刻阈, 方案 §5.8) */
  fx.tick(0.05);
  const tint1 = fx.emitters(FIRE.x, FIRE.y, FIRE.z).flame.tint;
  assert.ok(tint1 > 0 && tint1 < 1, '前置: 渐弱窗已开启(tint=' + tint1.toFixed(3) + ')');
  Fx.update(0.05);
  const b1 = brightnessOf(s, slots);
  assert.ok(b1 < 1, '渐弱开启后顶点色必须变暗(§5.8 面片亮度插值), 实得 ' + b1.toFixed(4));
  fx.setLeft(FIRE.x, FIRE.y, FIRE.z, 200);
  fx.tick(0.05);
  const tint2 = fx.emitters(FIRE.x, FIRE.y, FIRE.z).flame.tint;
  assert.ok(tint2 > tint1, '前置: tint 单调加深(' + tint1.toFixed(3) + '→' + tint2.toFixed(3) + ')');
  Fx.update(0.05);
  const b2 = brightnessOf(s, slots);
  assert.ok(b2 < b1, 'tint 加深亮度须继续下降(亮度插值单调), 实得 ' + b1.toFixed(4) + '→' + b2.toFixed(4));
  Fx.removeField(h);
});

test('R5-A 挂场幂等: 同 fx 重复 campfireField 仍恰一场一 sheet(单例句柄 — switchMode 的 Fx.clear 摘场后 init 重挂同一管理器, 防双绘双 sheet)', () => {
  Fx.clear();
  const fx = mkFx();
  Fx.campfireField(fx);
  const h2 = Fx.campfireField(fx); /* init 重挂场景: 同管理器再挂 */
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  Fx.update(0.05);
  assert.strictEqual(sheetOf().length, 1,
      '同 fx 重挂后仍恰一张 sheet(幂等: campfireField 返回既有场句柄, 渲染单例) — ' +
      '重复挂=两场双绘(粒子画两遍)+双 sheet(dc 翻倍)');
  Fx.removeField(h2);
  assert.strictEqual(sheetOf().length, 0,
      '摘幂等句柄=整场摘除(句柄唯一, removeField 语义不变)');
});

test('R5-B 结构禁令锁(ADR-0020): effects.js 零 chunk 重建/体素权威符号引用 — 焰片建/摘只吃 fx 句柄缝, 禁扫 campfire id、禁挂区块重建钩子(h 类歧路两条)', () => {
  /* 红线依据: 方案 §3-e/ADR-0020 禁令①禁止扫任意 campfire id(81∪82)建焰片
     (会把熄态点着)、禁令②禁止挂区块重建事件建焰片(渲染恢复跟错权威源)。
     共享词法环境下 lint 的 no-undef 抓不到跨文件引用(符号全在全局名单),
     源码卫生断言是此禁令的唯一机械执法面(R5 补锁, 现实现零命中=守门锁新增)。
     「js/world.js」字样(头注 atlasMat 来源)是合法依赖, 不在禁令清单。 */
  const src = fs.readFileSync(path.join(ROOT, 'js', 'effects.js'), 'utf8');
  const banned = ['remeshQueue', 'markChunkDirty', 'editBlockDirty',
    'mountChunk', 'unloadChunk', 'packChunkData', 'getBlock', 'B_CAMPFIRE'];
  const hit = banned.filter((s) => src.includes(s));
  assert.deepStrictEqual(hit, [],
      'effects.js 不得引用 chunk 重建/体素权威符号(引用即 h 类歧路在场): 命中 ' + hit.join(','));
});

test('R5-C4 恒定属性锁: 成员增摘(attach/detach)后 position/uv/color/index 属性对象身份不变 — ' +
    '稳态零 GL 缓冲替换(r128 setAttribute 换新后旧 attr 的 GL 缓冲无释放口, 每换必滞留)', () => {
  Fx.clear();
  const fx = mkFx();
  const h = Fx.campfireField(fx);
  const A = {x: 10, y: 25, z: 10};
  const B = {x: 20, y: 25, z: 10};
  fx.open(A.x, A.y, A.z);
  fx.open(B.x, B.y, B.z);
  Fx.update(0.05);
  const s = sheetOf()[0];
  assert.ok(s, '前置: sheet 在场(R4-1)');
  const names = ['position', 'uv', 'color', 'index'];
  const ids = () => [s.geometry.attributes.position, s.geometry.attributes.uv,
    s.geometry.attributes.color, s.geometry.index];
  const before = ids();
  fx.quench(A.x, A.y, A.z); /* detach: 成员集变(dirty 路径) */
  Fx.update(0.05);
  let after = ids();
  for (let i = 0; i < names.length; i++) {
    assert.strictEqual(after[i], before[i],
        names[i] + ' 属性对象在 detach 后必须身份不变(恒定复用) — ' +
        '成员变化走 drawRange+needsUpdate, 不换 BufferAttribute(r128 语义: ' +
        'setAttribute 替换后旧 GL 缓冲仅 geometry.dispose 时按当前 attributes 清理, ' +
        '被替换者无释放口)');
  }
  fx.open(A.x, A.y, A.z); /* attach 再挂(不扩容: cap 已够) */
  Fx.update(0.05);
  after = ids();
  for (let i = 0; i < names.length; i++) {
    assert.strictEqual(after[i], before[i],
        names[i] + ' 属性对象在 attach 后必须身份不变(恒定复用, 同上)');
  }
  assert.strictEqual(fireCount(s), 2, '前置自检: 恒定属性下两火仍全在绘');
  Fx.removeField(h);
});

test('R4-8 释放纪律: Fx.clear 摘 sheet+geometry/material dispose 零残留; removeField 只摘本场(他场 sheet 无恙); 清后再建不受污染', () => {
  Fx.clear();
  const fx1 = mkFx();
  Fx.campfireField(fx1); /* h1 不需要句柄: 本段走 Fx.clear() 全清口径 */
  fx1.open(FIRE.x, FIRE.y, FIRE.z);
  Fx.update(0.05);
  const s1 = sheetOf()[0];
  assert.ok(s1, '前置: 本场 sheet 在场');
  const geo1 = s1.geometry;
  const mat1 = s1.material;
  Fx.clear();
  assert.strictEqual(sheetOf().length, 0, 'clear 连带清场: sheet 零残留(票面验收 ②探针)');
  assert.ok(stub.disposed.some((d) => d.obj === geo1),
      'clear 须 dispose sheet geometry(专用几何可释放, effects.js clear 注记口径)');
  assert.ok(stub.disposed.some((d) => d.obj === mat1),
      'clear 须 dispose sheet material');
  /* removeField 只摘本场 */
  const fx2 = mkFx();
  const fx3 = mkFx();
  const h2 = Fx.campfireField(fx2);
  const h3 = Fx.campfireField(fx3);
  fx2.open(FIRE.x, FIRE.y, FIRE.z);
  fx3.open(30, 25, 10);
  Fx.update(0.05);
  assert.strictEqual(sheetOf().length, 2, '前置: 两场各一张 sheet');
  /* 探针=非抛错纯匹配(R5-c3): find 谓词内只做真值判断, 格匹配不合即 false —
     谓词内抛错曾迫使实现倒序迎合(R4-8 原装具), 现探针火序自由, 实现正序 */
  const keep = sheetOf().find((m) => m !== s1 && fireCount(m) === 1 &&
    matchVertsByCell(m, [{x: 30, y: 25, z: 10}]).byCell.get('30,25,10').length === 8);
  assert.ok(keep, '前置: 识别出 h3 的 sheet');
  const keepGeo = keep.geometry;
  Fx.removeField(h2);
  assert.strictEqual(sheetOf().length, 1, 'removeField 只摘本场 sheet');
  assert.ok(sheetOf()[0] === keep, '留下的必须是 h3 的 sheet(他场无恙)');
  assert.ok(!stub.disposed.some((d) => d.obj === keepGeo),
      '他场 sheet 几何不得被连带 dispose(释放只沿句柄)');
  /* 清后再建: 新场新 sheet 正常成形(零孤儿零污染) */
  fx3.clear();
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 0, 'fx.clear 后本场 sheet 空(成员=cells 同步)');
  fx3.open(40, 25, 10);
  Fx.update(0.05);
  assert.strictEqual(fireCount(sheetOf()[0]), 1, '清后再建新火正常挂片(句柄复用无污染)');
  Fx.removeField(h3);
});
