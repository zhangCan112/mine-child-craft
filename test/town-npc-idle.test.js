'use strict';
/* 城镇 NPC 待机微动画 (js/town-npc.js idle 段 + js/town-ui-core.js IDLE 参数段) 单测
   — node --test
   运行: node --test test/town-npc-idle.test.js
   案卷③(PO 验收体验反馈「NPC 站得太死」) 红测。规格权威=派令票拍板: 方案 A 完整版
   (呼吸微浮+臂/腿小幅摆+头缓转朝玩家三件全做), 覆盖全员 14 实体(10 村民+G01+3 氛围
   动物), 动物按形态表差异微摆, dt 注入确定性(零墙钟零随机), 引擎共享面零触碰。

   【动物形态表(票面记录, 绿方线内裁量已拍板)】
   | id  | look     | kind     | 动的骨 | 恒零转的骨 |
   | V01-V10 | town_v* | humanoid | root.y 微浮 · armL/armR.rotation.x 反相摆 ·
     legL/legR.rotation.x 反相摆(半幅) · head.rotation.y 朝玩家 | 其余 |
   | G01 | town_g01 | humanoid | 同村民(铁傀儡同 humanoid 骨架) | flower(零触碰红线) · hip |
   | A01 | town_a01 | bird | head.rotation.x 啄地点头 · tail.rotation.y 尾羽摆 · root.y 微浮 | legR/legL(不写) |
   | A02 | town_a02 | cat | tail.rotation.y 尾慢摆 · head.rotation.x 头微点 | legR/legL · 无浮(floatY 恒 0) |
   | A03 | town_a03 | llama | neck.rotation.x 低头啃草 · head.rotation.x 头随颈小幅 | legR/legL · 无浮 |

   断言组(全走公共 seam, 纯函数化守门面):
   ① pose 确定性: 同参同输出 · t=0 全零 · 四分之一/半/四分之三周期工作例(参数表
     单源对账, closeTo 防浮点结合序) · 周期回绕 · 幅值有界 · 逐帧 dt 序列单调段 ·
     臂腿反相 · 未知 kind 域错 · 参数注入覆盖(禁硬编码字面)
   ② 头转纯面: headTarget 方位字面(前向向量 (-sin,·,-cos) 口径独立推导) · 注视距离
     门(≤GAZE_DIST engaged, 界外 yaw=0) · 角域钳(±HEAD_YAW_MAX) · headStep 速率
     限步+收敛+大步直达 · ±π 回绕最短方向(参数注入放大角域触达) · 回正
   ③ 全员覆盖: kindOf 14 look 对账 · phaseOffset 确定性+[0,1)+离散度 · apply 逐 id
     形态映射(真傀儡+rotation 桩, 恰按形态表) · 臂反相 · G01 flower 零触 · 骨 position
     孪生对账零改 · 幂等复位
   ④ 守门: TOWN_UI_PARAMS 追加 IDLE 段恰 19 键字面锁表(冻结保持) · 引擎共享面
     (js/mobs.js / js/mob-look-kit.js / js/mob-look/*)源零 idle 名渗入 · adventure
     源切片: tick 挂点在 advTownAnchorTick 后 + tick 体零 Mobs./零墙钟零随机 ·
     town-npc.js 源零墙钟零随机(源文本守门先例口径)
   ⑤ apply 容差: 缺骨傀儡零炸零写(空账安全在 test/adventure-mode.test.js 案卷③段)

   装具: vm 经典脚本共享词法环境(conventions §7.1 三铁律: 宿主域摊平/桥接查询/
   桩挂宿主 global 共享实例)。纯面沙盒(town-ui-core.js+town-npc.js, 零 THREE)与
   适配件沙盒(kit+look×14+上游冻结链+town-ui-core+town-npc, THREE 桩
   town-npc.test.js stubThree 同款裁剪+rotation 面)两档; 红期 idle 面缺席断言红
   (assertion 红, 非装具炸)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const LOOK_DIR = path.join(ROOT, 'js', 'mob-look');
const MobLookKit = require('../js/mob-look-kit.js');

/* closeTo 助手: node:assert 无 closeTo(Chai 专属 API, 2026-11-16 绿方争议
   裁定成律——本测原 35 处 + adventure-mode.test.js 案卷③段 8 处(合计 43)
   assert.closeTo 全数 TypeError, 红期被未落实现守卫早退掩盖;
   本地补 |actual-expected|<=delta 断言, 语义与 chai 同形) */
function closeTo(actual, expected, delta, msg) {
  assert.ok(Math.abs(actual - expected) <= delta,
      (msg || 'closeTo') + '(实际 ' + actual + ', 期望 ' + expected +
      ', 容差 ' + delta + ')');
}

/* ---------- 独立推导字面(票面拍板参数, 锁表即规格; 与实现零共享) ---------- */
const IDLE_KEYS = {
  IDLE_BREATH_AMP: 0.035, /* 呼吸微浮幅度(格) */
  IDLE_BREATH_S: 2.8, /* 呼吸周期(秒) */
  IDLE_SWING_AMP: 0.07, /* 臂摆幅度(rad) */
  IDLE_SWING_S: 3.2, /* 摆动周期(秒) */
  IDLE_LEG_RATIO: 0.5, /* 腿摆=臂摆×比例(反相) */
  IDLE_HEAD_RATE: 2.4, /* 头转最大角速度(rad/s) */
  IDLE_HEAD_YAW_MAX: 1.0, /* 头相对身体最大偏转(rad, 约 57°) */
  IDLE_GAZE_DIST: 9, /* 注视水平距离(格), 界外头回正 */
  IDLE_BIRD_PECK_AMP: 0.22, /* A01 啄地头俯幅度(rad) */
  IDLE_BIRD_PECK_S: 2.2,
  IDLE_BIRD_TAIL_AMP: 0.3, /* A01 尾摆幅度(rad) */
  IDLE_BIRD_TAIL_S: 1.6,
  IDLE_CAT_TAIL_AMP: 0.45, /* A02 尾慢摆幅度(rad) */
  IDLE_CAT_TAIL_S: 2.6,
  IDLE_CAT_NOD_AMP: 0.08, /* A02 头微点幅度(rad) */
  IDLE_CAT_NOD_S: 2.0,
  IDLE_LLAMA_GRAZE_AMP: 0.28, /* A03 颈俯啃草幅度(rad) */
  IDLE_LLAMA_GRAZE_S: 4.0,
  IDLE_LLAMA_HEAD_RATIO: 0.35, /* A03 头随颈俯比例 */
};
const IDLE_KEY_NAMES = Object.keys(IDLE_KEYS).sort();

/* 形态表(测试独立真源): id→kind 与逐 kind 通道开合 */
const KIND_OF = {
  V01: 'humanoid', V02: 'humanoid', V03: 'humanoid', V04: 'humanoid',
  V05: 'humanoid', V06: 'humanoid', V07: 'humanoid', V08: 'humanoid',
  V09: 'humanoid', V10: 'humanoid', G01: 'humanoid',
  A01: 'bird', A02: 'cat', A03: 'llama',
};
const LOOK_OF = {
  V01: 'town_v01', V02: 'town_v02', V03: 'town_v03', V04: 'town_v04',
  V05: 'town_v05', V06: 'town_v06', V07: 'town_v07', V08: 'town_v08',
  V09: 'town_v09', V10: 'town_v10', G01: 'town_g01',
  A01: 'town_a01', A02: 'town_a02', A03: 'town_a03',
};
const ALL_IDS = Object.keys(KIND_OF);
const POSE_KEYS = ['armSwing', 'floatY', 'headPitch', 'legSwing', 'neckPitch', 'tailYaw'];

/* ---------- 纯面沙盒: town-ui-core.js(参数表)+town-npc.js(idle 纯函数) ---------- */
let pureCtxCache = null;
function pureCtx() {
  if (pureCtxCache) return pureCtxCache;
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['js/town-ui-core.js', 'js/town-npc.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  pureCtxCache = ctx;
  return ctx;
}
/* 桥接: 表达式求值 JSON 往返摊平(§7.1 铁律 1/2) */
function pureJson(expr) {
  return JSON.parse(vm.runInContext('JSON.stringify(' + expr + ')', pureCtx()));
}
function idleFns() {
  return pureJson('({kindOf: typeof townNpcIdleKindOf, pose: typeof townNpcIdlePose,' +
    ' off: typeof townNpcIdlePhaseOffset, target: typeof townNpcIdleHeadTarget,' +
    ' step: typeof townNpcIdleHeadStep, apply: typeof townNpcIdleApply})');
}
/* 红因守卫(T-NPC-05 先例口径): idle 面缺席时抛明确中文错, 红=实现缺席可归因,
 * 不留裸 ReferenceError 装具炸嫌疑 */
function fnGuard(name) {
  const t = vm.runInContext('typeof ' + name, pureCtx());
  if (t !== 'function') {
    throw new Error('案卷③ 红期: ' + name +
      ' 未落实现(js/town-npc.js idle 段缺席, 红因=实现缺席非装具炸)');
  }
}
function pose(t, kind, params) {
  fnGuard('townNpcIdlePose');
  return pureJson('townNpcIdlePose(' + JSON.stringify(t) + ',' + JSON.stringify(kind) +
    (params ? ',' + JSON.stringify(params) : '') + ')');
}
function headTarget(bodyYaw, x, z, px, pz, params) {
  fnGuard('townNpcIdleHeadTarget');
  return pureJson('townNpcIdleHeadTarget(' + JSON.stringify(bodyYaw) + ',' +
    JSON.stringify(x) + ',' + JSON.stringify(z) + ',' + JSON.stringify(px) + ',' +
    JSON.stringify(pz) + (params ? ',' + JSON.stringify(params) : '') + ')');
}
function headStep(cur, target, dt, params) {
  fnGuard('townNpcIdleHeadStep');
  return pureJson('townNpcIdleHeadStep(' + JSON.stringify(cur) + ',' +
    JSON.stringify(target) + ',' + JSON.stringify(dt) +
    (params ? ',' + JSON.stringify(params) : '') + ')');
}
function kindOf(look) {
  fnGuard('townNpcIdleKindOf');
  return pureJson('townNpcIdleKindOf(' + JSON.stringify(look) + ')');
}
function phaseOffset(id) {
  fnGuard('townNpcIdlePhaseOffset');
  return pureJson('townNpcIdlePhaseOffset(' + JSON.stringify(id) + ')');
}
function tableParams() {
  return pureJson('TOWN_UI_PARAMS');
}

/* ---------- 适配件沙盒: 真傀儡链(town-npc.test.js 同款+rotation 面) ---------- */
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
  /* position 带 set/fromArray + rotation 欧拉三轴(案卷③ idle 消费面): 骨组旋转
     与傀儡根浮动都可观察 */
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
      this.rotation = {x: 0, y: 0, z: 0};
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

let adpCtxCache = null;
let restoreHostStub = null;
function adapterCtx() {
  if (adpCtxCache) return adpCtxCache;
  const three = stubThree();
  const prevThree = global.THREE; const prevDoc = global.document;
  global.THREE = three;
  global.document = stubDocument;
  restoreHostStub = () => {
    global.THREE = prevThree;
    global.document = prevDoc;
  };
  process.on('exit', restoreHostStub);
  const ctx = vm.createContext({
    console: {log() {}, warn() {}, error() {}},
    MobLookKit, THREE: three, document: stubDocument,
  });
  const looks = fs.readdirSync(LOOK_DIR)
      .filter((f) => f.startsWith('town_') && f.endsWith('.js')).sort()
      .map((f) => 'js/mob-look/' + f);
  const files = ['js/town-ui-core.js'].concat(looks, ['js/town-map-core.js',
    'js/town-interact-core.js', 'js/town-npc-anchor-core.js',
    'js/adventure-dims-core.js', 'js/town-npc-registry.js', 'js/town-npc.js']);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
  }
  adpCtxCache = ctx;
  return ctx;
}

/* 适配件桥接: mk+apply 产物骨骼读数摊平进宿主域 */
function mkPuppet(id) {
  return adapterCtx() && JSON.parse(vm.runInContext('JSON.stringify((function() {' +
    ' const p = mkTownNpcPuppet(' + JSON.stringify(id) + ');' +
    ' const out = {look: p.look, boneKeys: Object.keys(p.bones).sort(), bones: {}};' +
    ' for (const k of Object.keys(p.bones)) out.bones[k] = {' +
    '   rx: p.bones[k].rotation.x, ry: p.bones[k].rotation.y, rz: p.bones[k].rotation.z,' +
    '   px: p.bones[k].position.x, py: p.bones[k].position.y, pz: p.bones[k].position.z};' +
    ' out.rootY = p.root.position.y;' +
    ' return out; })())', adapterCtx()));
}
/* 摆放后 apply: 手工姿势(直接映射规格, 免公式再推导)+baseY+headYaw → 骨骼读数 */
function applyPose(id, poseObj, baseY, headYaw) {
  const ctx = adapterCtx();
  const t = vm.runInContext('typeof townNpcIdleApply + "/" + typeof townNpcIdleKindOf', ctx);
  if (t !== 'function/function') {
    throw new Error('案卷③ 红期: townNpcIdleApply/townNpcIdleKindOf 未落实现' +
      '(js/town-npc.js idle 段缺席, 红因=实现缺席非装具炸)');
  }
  return JSON.parse(vm.runInContext('JSON.stringify((function() {' +
    ' const p = mkTownNpcPuppet(' + JSON.stringify(id) + ');' +
    ' placeTownNpc(p, {x: 79, y: 24, z: 94, face: "south"});' +
    ' const kind = townNpcIdleKindOf(p.look);' +
    ' const pre = {};' +
    ' for (const k of Object.keys(p.bones)) pre[k] = {' +
    '   px: p.bones[k].position.x, py: p.bones[k].position.y,' +
    '   pz: p.bones[k].position.z};' +
    ' townNpcIdleApply(p, kind, ' + JSON.stringify(poseObj) + ',' +
    ' ' + JSON.stringify(baseY) + ', ' + JSON.stringify(headYaw) + ');' +
    ' const out = {kind: kind, rootY: p.root.position.y, pre: pre, bones: {}};' +
    ' for (const k of Object.keys(p.bones)) out.bones[k] = {' +
    '   rx: p.bones[k].rotation.x, ry: p.bones[k].rotation.y, rz: p.bones[k].rotation.z,' +
    '   px: p.bones[k].position.x, py: p.bones[k].position.y, pz: p.bones[k].position.z};' +
    ' return out; })())', ctx));
}

/* ============ 红本体: idle 六面在册 ============ */

test('案卷③ 红本体: 适配件 idle 纯面六函数在册(缺席即红)', () => {
  const f = idleFns();
  assert.strictEqual(f.kindOf, 'function',
      'townNpcIdleKindOf 未落实现(案卷③: look→形态 kind 映射)');
  assert.strictEqual(f.pose, 'function',
      'townNpcIdlePose 未落实现(案卷③: 呼吸/摆动纯函数面)');
  assert.strictEqual(f.off, 'function',
      'townNpcIdlePhaseOffset 未落实现(案卷③: 逐 id 确定性相位错峰)');
  assert.strictEqual(f.target, 'function',
      'townNpcIdleHeadTarget 未落实现(案卷③: 头转目标+注视距离门)');
  assert.strictEqual(f.step, 'function',
      'townNpcIdleHeadStep 未落实现(案卷③: 头转 lerp 限步+回绕+钳制)');
  assert.strictEqual(f.apply, 'function',
      'townNpcIdleApply 未落实现(案卷③: 姿势→骨骼消费面)');
});

/* ============ ① 呼吸/摆动确定性(dt 注入, 零墙钟零随机) ============ */

test('案卷③ ① pose 形状与零点: 恰六键 · 同参同输出 · t=0 全零(四 kind)', () => {
  for (const kind of ['humanoid', 'bird', 'cat', 'llama']) {
    const p0 = pose(0, kind);
    assert.deepStrictEqual(Object.keys(p0).sort(), POSE_KEYS,
        kind + ' 姿势恰六键 {floatY,armSwing,legSwing,headPitch,tailYaw,neckPitch}');
    for (const k of POSE_KEYS) {
      assert.strictEqual(p0[k], 0, kind + ' t=0 时 ' + k + '=0(sin 零点, 零残留)');
    }
    /* 同参同输出: 两次调用逐通道 deepEqual(零随机零隐藏态) */
    const t = 1.234;
    assert.deepStrictEqual(pose(t, kind), pose(t, kind),
        kind + ' 同参同输出(纯函数, 无墙钟/随机渗入)');
  }
});

test('案卷③ ① 工作例字面: 四分之一/半/四分之三周期与参数表单源对账(closeTo 防结合序)', () => {
  const P = tableParams();
  /* humanoid 呼吸: 浮动通道按呼吸周期取工作例 */
  let p = pose(P.IDLE_BREATH_S / 4, 'humanoid');
  closeTo(p.floatY, P.IDLE_BREATH_AMP, 1e-12, '呼吸四分之一周期=幅度上限');
  p = pose(P.IDLE_BREATH_S / 2, 'humanoid');
  closeTo(p.floatY, 0, 1e-12, '呼吸半周期回零');
  p = pose(3 * P.IDLE_BREATH_S / 4, 'humanoid');
  closeTo(p.floatY, -P.IDLE_BREATH_AMP, 1e-12, '呼吸四分之三周期=-幅度');
  /* humanoid 摆动: 臂/腿按各自的摆动周期取工作例(与呼吸周期不同频,
     采样点须分开取——原版混用 0.7s 采样点是本测缺陷已裁定修正) */
  p = pose(P.IDLE_SWING_S / 4, 'humanoid');
  closeTo(p.armSwing, P.IDLE_SWING_AMP, 1e-12, '臂摆四分之一周期=幅度');
  closeTo(p.legSwing, -P.IDLE_SWING_AMP * P.IDLE_LEG_RATIO, 1e-12,
      '腿摆反相且按比例(四分之一周期=-比例×幅度)');
  p = pose(3 * P.IDLE_SWING_S / 4, 'humanoid');
  closeTo(p.armSwing, -P.IDLE_SWING_AMP, 1e-12, '臂摆四分之三周期=-幅度');
  closeTo(p.legSwing, P.IDLE_SWING_AMP * P.IDLE_LEG_RATIO, 1e-12, '腿随臂反相');
  /* bird: 啄地+尾摆各按各的周期 */
  p = pose(P.IDLE_BIRD_PECK_S / 4, 'bird');
  closeTo(p.headPitch, P.IDLE_BIRD_PECK_AMP, 1e-12, 'A01 啄地四分之一周期=幅度');
  assert.strictEqual(p.armSwing, 0, 'A01 无臂摆(形态表: 鸟无臂通道)');
  p = pose(P.IDLE_BIRD_TAIL_S / 4, 'bird');
  closeTo(p.tailYaw, P.IDLE_BIRD_TAIL_AMP, 1e-12, 'A01 尾摆四分之一周期=幅度');
  /* cat: 尾摆+点头, 零浮零臂 */
  p = pose(P.IDLE_CAT_TAIL_S / 4, 'cat');
  closeTo(p.tailYaw, P.IDLE_CAT_TAIL_AMP, 1e-12, 'A02 尾摆四分之一周期=幅度');
  assert.strictEqual(p.floatY, 0, 'A02 坐姿零浮(形态表)');
  p = pose(P.IDLE_CAT_NOD_S / 4, 'cat');
  closeTo(p.headPitch, P.IDLE_CAT_NOD_AMP, 1e-12, 'A02 点头四分之一周期=幅度');
  /* llama: 颈俯+头随比例 */
  p = pose(P.IDLE_LLAMA_GRAZE_S / 4, 'llama');
  closeTo(p.neckPitch, P.IDLE_LLAMA_GRAZE_AMP, 1e-12, 'A03 颈俯四分之一周期=幅度');
  closeTo(p.headPitch, P.IDLE_LLAMA_GRAZE_AMP * P.IDLE_LLAMA_HEAD_RATIO, 1e-12,
      'A03 头随颈俯按比例');
  assert.strictEqual(p.floatY, 0, 'A03 零浮(形态表)');
  assert.strictEqual(p.tailYaw, 0, 'A03 无尾通道(形态表)');
});

test('案卷③ ① 周期回绕与幅值有界: 逐 kind 公倍周期复现(closeTo 1e-9) · 全通道 |值|≤幅度', () => {
  const P = tableParams();
  /* 逐 kind 的回绕偏移=全部本征周期的公倍数(每通道都整数倍回绕;
     原版「(i+2)×周期求和」非公倍是本测缺陷已裁定修正):
     humanoid 22.4=8×2.8=7×3.2 · bird 123.2=44×2.8=56×2.2=77×1.6 ·
     cat 26=10×2.6=13×2.0 · llama 8=2×4.0 */
  const WRAP_OFFSET = {
    humanoid: 8 * P.IDLE_BREATH_S,
    bird: 44 * P.IDLE_BREATH_S,
    cat: 10 * P.IDLE_CAT_TAIL_S,
    llama: 2 * P.IDLE_LLAMA_GRAZE_S,
  };
  for (const kind of Object.keys(WRAP_OFFSET)) {
    const t = 0.918;
    const a = pose(t, kind);
    const b = pose(t + WRAP_OFFSET[kind], kind);
    for (const k of POSE_KEYS) {
      closeTo(b[k], a[k], 1e-9,
          kind + '.' + k + ' 公倍周期回绕复现(相位累计不发散)');
    }
  }
  /* 有界: 200 个采样点全通道不越幅度上限 */
  for (let i = 0; i < 200; i++) {
    const t = i * 0.137;
    const h = pose(t, 'humanoid');
    assert.ok(Math.abs(h.floatY) <= P.IDLE_BREATH_AMP + 1e-12, 'humanoid 浮动有界');
    assert.ok(Math.abs(h.armSwing) <= P.IDLE_SWING_AMP + 1e-12, '臂摆有界');
    assert.ok(Math.abs(h.legSwing) <= P.IDLE_SWING_AMP * P.IDLE_LEG_RATIO + 1e-12, '腿摆有界');
    const c = pose(t, 'cat');
    assert.ok(Math.abs(c.tailYaw) <= P.IDLE_CAT_TAIL_AMP + 1e-12, '猫尾有界');
    const l = pose(t, 'llama');
    assert.ok(Math.abs(l.neckPitch) <= P.IDLE_LLAMA_GRAZE_AMP + 1e-12, '羊驼颈俯有界');
    const bd = pose(t, 'bird');
    assert.ok(Math.abs(bd.headPitch) <= P.IDLE_BIRD_PECK_AMP + 1e-12, '啄地有界');
  }
});

test('案卷③ ① 逐帧 dt 注入: 1/60 序列相位累计单调上升段+顶点+下降段(确定性轨迹)', () => {
  const P = tableParams();
  const dt = 1 / 60;
  let t = 0;
  let prev = -1;
  /* 0→四分之一周期(≈0.7s): floatY 严格上升(sin 单调段); 逐帧断言=注入轨迹
     逐点核验; 41 帧≈0.683s 逼近顶点 */
  for (let i = 0; i < 41; i++) {
    const v = pose(t, 'humanoid').floatY;
    assert.ok(v > prev, '第 ' + i + ' 帧 floatY 严格上升(单调段, t=' + t.toFixed(4) + ')');
    prev = v;
    t += dt;
  }
  closeTo(prev, P.IDLE_BREATH_AMP, 5e-3, '顶点帧逼近幅度上限');
  /* 越过顶点后回落 */
  t += 4 * dt;
  assert.ok(pose(t, 'humanoid').floatY < prev, '越过四分之一周期后回落');
});

test('案卷③ ① 域错与参数化: 未知 kind 抛中文域错 · 注入覆盖表改幅度/周期输出随参(禁硬编码)', () => {
  assert.throws(() => pose(1, 'dragon'), /townNpcIdlePose|形态/,
      '未知 kind 抛拼写域错(消息含面名与域提示)');
  const P = tableParams();
  const alt = Object.assign({}, P, {IDLE_SWING_AMP: 0.5, IDLE_SWING_S: 4.4});
  const t = alt.IDLE_SWING_S / 4;
  closeTo(pose(t, 'humanoid', alt).armSwing, 0.5, 1e-12,
      '臂幅随注入参数变(0.07→0.5, 禁硬编码字面)');
  closeTo(pose(alt.IDLE_SWING_S / 2, 'humanoid', alt).armSwing, 0, 1e-12,
      '新周期半周处回零(周期参数同样被消费)');
});

/* ============ ② 头转 lerp(目标注入, ±π 回绕, 角域钳, 注视距离门) ============ */

test('案卷③ ② headTarget 方位字面: 东/西/北独立推导(前向向量口径) · 角域钳到边界', () => {
  const P = tableParams();
  /* 界内斜向(独立推导, 不触钳): yaw_t=∓0.7 → 方向 (±sin0.7, -cos0.7) 取 5 格 */
  const ex = 5 * Math.sin(0.7);
  const ez = 5 * Math.cos(0.7);
  let r = headTarget(0, 0, 0, ex, -ez); /* yaw_t=-0.7(东北偏北) */
  assert.strictEqual(r.engaged, true, '5 格在注视距离内');
  closeTo(r.yaw, -0.7, 1e-12, '斜向目标=-0.7(角域内不钳, 方位字面)');
  r = headTarget(0, 0, 0, -ex, -ez); /* 镜像 yaw_t=+0.7(方向 (-sin0.7,-cos0.7);
     原版 (-ex,+ez) 是 π-0.7 越域点的笔误, 本测缺陷已裁定修正) */
  closeTo(r.yaw, 0.7, 1e-12, '斜向目标=+0.7(角域内不钳)');
  /* V01 站 (79,·,94) 面南: 面南 yaw=π(前向 (-sinπ,-cosπ)=(0,1) 即 +Z);
     正东/正西=±90° 侧向, 越 ±HEAD_YAW_MAX(约 57°)角域, 钳到边界(原版期望
     ±π/2 与本文件角域钳断言自相矛盾, 本测缺陷已裁定修正) */
  r = headTarget(Math.PI, 79, 94, 83, 94); /* 玩家正东 4 格: rel=+π/2 越域 */
  assert.strictEqual(r.engaged, true, '4 格在注视距离内');
  closeTo(r.yaw, P.IDLE_HEAD_YAW_MAX, 1e-12, '东向 90° 侧向钳到 +HEAD_YAW_MAX');
  r = headTarget(Math.PI, 79, 94, 75, 94); /* 正西: rel=-π/2 越域 */
  closeTo(r.yaw, -P.IDLE_HEAD_YAW_MAX, 1e-12, '西向 90° 侧向钳到 -HEAD_YAW_MAX');
  r = headTarget(Math.PI, 79, 94, 79, 90); /* 正北(面南的身后): rel=±π 越域 */
  closeTo(r.yaw, -P.IDLE_HEAD_YAW_MAX, 1e-12, '身后目标钳到 -HEAD_YAW_MAX(角域钳)');
  r = headTarget(Math.PI, 79, 94, 79, 98); /* 正南(正前): rel=0 */
  closeTo(r.yaw, 0, 1e-12, '正前目标=0(不转头)');
  /* 斜后 2.5 rad 越域钳正界(独立推导: 目标方向 yaw_t=2.5 相对身体) */
  const dx = -5 * Math.sin(2.5); /* yaw_t=2.5 → 方向 (-sin2.5,-cos2.5) */
  const dz = -5 * Math.cos(2.5);
  r = headTarget(0, 0, 0, dx, dz);
  closeTo(r.yaw, P.IDLE_HEAD_YAW_MAX, 1e-12, '越 +MAX 钳到 +HEAD_YAW_MAX');
  r = headTarget(0, 0, 0, -dx, dz); /* 镜像 -2.5(yaw→-yaw=方向 x 分量取反;
     原版 (-dx,-dz) 点对称是 π-2.5=-0.64 界内点, 本测缺陷已裁定修正) */
  closeTo(r.yaw, -P.IDLE_HEAD_YAW_MAX, 1e-12, '越 -MAX 钳到 -HEAD_YAW_MAX');
});

test('案卷③ ② 注视距离门: ≤GAZE_DIST engaged · 界外 {yaw:0, engaged:false}(太远不扭头)', () => {
  const P = tableParams();
  /* 沿角域内斜向(-0.7)推进到门界采字面(原版正东 -π/2 未过钳域, 本测缺陷
     已裁定修正): 单位方向 (sin0.7, -cos0.7), 距离=GAZE_DIST 恰含界 */
  const ux = Math.sin(0.7);
  const uz = -Math.cos(0.7);
  let r = headTarget(0, 0, 0, P.IDLE_GAZE_DIST * ux, P.IDLE_GAZE_DIST * uz);
  assert.strictEqual(r.engaged, true, '恰在 GAZE_DIST 内(含界)');
  closeTo(r.yaw, -0.7, 1e-12, '界内照常给目标(角域内不钳)');
  r = headTarget(0, 0, 0, (P.IDLE_GAZE_DIST + 0.001) * ux,
      (P.IDLE_GAZE_DIST + 0.001) * uz);
  assert.strictEqual(r.engaged, false, '出界 1 毫格即不注视');
  assert.strictEqual(r.yaw, 0, '界外 yaw=0(头回正语义)');
  assert.deepStrictEqual(Object.keys(r).sort(), ['engaged', 'yaw'],
      'headTarget 恰二键(锁形状)');
});

test('案卷③ ② headStep 速率限步+收敛+大步直达 · 回正', () => {
  const P = tableParams();
  /* 限步: |Δ|>rate·dt 时单步只走 rate·dt */
  let y = headStep(0, 1.0, 0.1);
  closeTo(y, P.IDLE_HEAD_RATE * 0.1, 1e-12, '单步上限=HEAD_RATE×dt');
  /* 收敛: 反复小步单调逼近并最终贴合目标 */
  let cur = 0;
  let last = -1;
  for (let i = 0; i < 200; i++) {
    cur = headStep(cur, 1.0, 0.05);
    assert.ok(cur >= last - 1e-15, '单调不减(目标在正侧)');
    last = cur;
  }
  closeTo(cur, 1.0, 1e-12, '200 步内贴合目标');
  /* 大步直达: rate·dt ≥ |Δ| 时一步到位 */
  y = headStep(0.3, -0.3, 10);
  closeTo(y, -0.3, 1e-12, '大 dt 一步直达目标');
  /* 回正: 目标 0 */
  y = headStep(0.8, 0, 10);
  closeTo(y, 0, 1e-12, '目标 0 一步回正(界外玩家→头回正)');
});

test('案卷③ ② ±π 回绕最短方向(参数注入放大角域触达)+对称 · 步内角域钳', () => {
  const P = tableParams();
  const wide = Object.assign({}, P,
      {IDLE_HEAD_YAW_MAX: 2.5, IDLE_HEAD_RATE: 3}); /* 角域放大后 |cur-target| 可越 π */
  /* cur=1.9, target=-1.9: 原始差 -3.8, 最短方向=+2.483(穿 +π 侧) */
  let y = headStep(1.9, -1.9, 0.1, wide);
  closeTo(y, 1.9 + 3 * 0.1, 1e-12,
      '回绕取最短方向: 向 +2.48 走而非向 -3.8 走(限步 +0.3)');
  y = headStep(-1.9, 1.9, 0.1, wide); /* 镜像 */
  closeTo(y, -1.9 - 3 * 0.1, 1e-12, '对称: 向 -2.48 方向走');
  /* 步内钳: 沿最短方向推进, 越过角域即钳回边界 */
  y = headStep(2.4, 2.5, 10, wide);
  closeTo(y, 2.5, 1e-12, '界内目标直达');
  y = headStep(2.4, -2.5, 10, wide); /* 原始差 -4.9 → 回绕 +1.383(穿 +π 侧) → 推进后越界钳 +2.5 */
  closeTo(y, 2.5, 1e-12, '沿最短方向推进并钳在 +HEAD_YAW_MAX 边界');
});

/* ============ ③ 全员覆盖: 14 实体逐 id 形态表差异 ============ */

test('案卷③ ③ kindOf 全员对账: 14 look→形态表 kind · 未知 look 域错', () => {
  for (const id of ALL_IDS) {
    assert.strictEqual(kindOf(LOOK_OF[id]), KIND_OF[id],
        LOOK_OF[id] + ' → ' + KIND_OF[id] + '(形态表对账)');
  }
  assert.throws(() => kindOf('zombie'), /townNpcIdleKindOf|形态/,
      '未知 look 抛拼写域错(消息含面名与合法域提示)');
});

test('案卷③ ③ phaseOffset: 14 id 确定性 · [0,1) · 离散度(≥6 distinct, 错峰不齐步)', () => {
  const seen = new Set();
  for (const id of ALL_IDS) {
    const a = phaseOffset(id);
    const b = phaseOffset(id);
    assert.strictEqual(a, b, id + ' 同 id 同值(确定性, 零随机)');
    assert.ok(a >= 0 && a < 1, id + ' 相位错峰落 [0,1)');
    seen.add(a);
  }
  assert.ok(seen.size >= 6, '14 id 至少 6 个不同相位(错峰, 不齐步走)');
});

test('案卷③ ③ apply 全员逐 id 形态映射(真傀儡): 形态表骨动 · 恒零骨不写 · 臂反相', () => {
  const HAND = {floatY: 0.02, armSwing: 0.05, legSwing: -0.025,
    headPitch: 0.1, tailYaw: 0.2, neckPitch: 0.15};
  const BASE_Y = 25;
  for (const id of ALL_IDS) {
    const r = applyPose(id, HAND, BASE_Y, 0.3);
    assert.strictEqual(r.kind, KIND_OF[id], id + ' kind 对账(前置)');
    const b = r.bones;
    if (KIND_OF[id] === 'humanoid') {
      assert.strictEqual(r.rootY, BASE_Y + HAND.floatY, id + ' 呼吸微浮=baseY+floatY');
      assert.strictEqual(b.armL.rx, HAND.armSwing, id + ' 左臂=+armSwing');
      assert.strictEqual(b.armR.rx, -HAND.armSwing, id + ' 右臂=-armSwing(反相)');
      assert.strictEqual(b.legL.rx, HAND.legSwing, id + ' 左腿=+legSwing');
      assert.strictEqual(b.legR.rx, -HAND.legSwing, id + ' 右腿=-legSwing(反相)');
      assert.strictEqual(b.head.ry, 0.3, id + ' 头转=headYaw 注入值');
      assert.strictEqual(b.head.rx, 0, id + ' 人形头不俯仰(headPitch 不消费)');
      if (id === 'G01') {
        assert.strictEqual(b.flower.rx, 0, 'G01 flower 骨零触碰(红线)');
        assert.strictEqual(b.flower.ry, 0, 'G01 flower 骨零触碰(红线)');
        assert.strictEqual(b.flower.rz, 0, 'G01 flower 骨零触碰(红线)');
        assert.strictEqual(b.hip.rx, 0, 'G01 hip 骨不写(形态表)');
      }
    } else if (KIND_OF[id] === 'bird') {
      assert.strictEqual(b.head.rx, HAND.headPitch, 'A01 啄地=headPitch');
      assert.strictEqual(b.tail.ry, HAND.tailYaw, 'A01 尾摆=tailYaw');
      assert.strictEqual(b.head.ry, 0, 'A01 头不追踪玩家(形态表: 动物不朝玩家)');
      assert.strictEqual(b.legR.rx, 0, 'A01 腿恒零转(形态表)');
      assert.strictEqual(b.legL.rx, 0, 'A01 腿恒零转(形态表)');
      assert.strictEqual(r.rootY, BASE_Y + HAND.floatY, 'A01 微浮=baseY+floatY');
    } else if (KIND_OF[id] === 'cat') {
      assert.strictEqual(b.tail.ry, HAND.tailYaw, 'A02 尾慢摆=tailYaw');
      assert.strictEqual(b.head.rx, HAND.headPitch, 'A02 头微点=headPitch');
      assert.strictEqual(b.head.ry, 0, 'A02 头不追踪玩家');
      assert.strictEqual(r.rootY, BASE_Y + HAND.floatY,
          'A02 root.y=baseY+floatY(零浮由 pose 出 0, apply 恒映射)');
    } else {
      /* llama — 形态表末行 */
      assert.strictEqual(b.neck.rx, HAND.neckPitch, 'A03 低头啃草=neckPitch');
      assert.strictEqual(b.head.rx, HAND.headPitch, 'A03 头随=headPitch');
      assert.strictEqual(b.head.ry, 0, 'A03 头不追踪玩家');
      assert.strictEqual(r.rootY, BASE_Y + HAND.floatY,
          'A03 root.y=baseY+floatY(零浮由 pose 出 0, apply 恒映射)');
    }
  }
});

test('案卷③ ③ 骨 position 孪生对账(键集孪生+apply 前后快照: 只写旋转+根浮) · 幂等复位(零姿势回零)', () => {
  const HAND = {floatY: 0.02, armSwing: 0.05, legSwing: -0.025,
    headPitch: 0.1, tailYaw: 0.2, neckPitch: 0.15};
  for (const id of ALL_IDS) {
    const fresh = mkPuppet(id); /* 孪生: 未 apply 的直产傀儡(骨账键集基准) */
    const r = applyPose(id, HAND, 25, 0.3);
    assert.deepStrictEqual(Object.keys(r.bones).sort(), fresh.boneKeys,
        id + ' 骨账零增删(apply 不造骨不删骨)');
    /* 关节对账=同傀儡 apply 前后快照: 跨孪生比 position 是摆放差非 apply 差
       (bones.root 即 root 载体, placeTownNpc 写其 x/z=锚位——原版与未摆放
       孪生直比是本测缺陷已裁定修正); root.position.y 是根浮设计通道单列 */
    for (const k of Object.keys(r.bones)) {
      closeTo(r.bones[k].px, r.pre[k].px, 1e-12,
          id + '.' + k + ' 骨关节 position.x 零改(apply 只写旋转)');
      closeTo(r.bones[k].pz, r.pre[k].pz, 1e-12,
          id + '.' + k + ' 骨关节 position.z 零改');
      if (k !== 'root') {
        closeTo(r.bones[k].py, r.pre[k].py, 1e-12,
            id + '.' + k + ' 骨关节 position.y 零改');
      }
    }
    closeTo(r.bones.root.py, 25 + HAND.floatY, 1e-12,
        id + '.root position.y=baseY+floatY(根浮唯一位置通道, 骨槽 root 即载体)');
  }
  /* 幂等复位: 零姿势+headYaw=0 → 全形态骨回零 */
  const ZERO = {floatY: 0, armSwing: 0, legSwing: 0, headPitch: 0,
    tailYaw: 0, neckPitch: 0};
  for (const id of ALL_IDS) {
    const r = applyPose(id, ZERO, 24, 0);
    for (const k of Object.keys(r.bones)) {
      assert.strictEqual(r.bones[k].rx, 0, id + '.' + k + ' 零姿势回零(rx)');
      assert.strictEqual(r.bones[k].ry, 0, id + '.' + k + ' 零姿势回零(ry)');
      assert.strictEqual(r.bones[k].rz, 0, id + '.' + k + ' 零姿势回零(rz)');
    }
    assert.strictEqual(r.rootY, 24, id + ' 零姿势 root.y 复位 baseY');
  }
});

/* ============ ④ 守门面: 参数表 + 引擎共享面零触碰 + 挂点/零墙钟源切片 ============ */

test('案卷③ ④ TOWN_UI_PARAMS 追加 IDLE 段: 恰 19 键字面锁表 · 冻结保持 · 既有键零漂移', () => {
  const ctx = pureCtx();
  const frozen = vm.runInContext('Object.isFrozen(TOWN_UI_PARAMS)', ctx);
  assert.strictEqual(frozen, true, '参数表冻结保持(追加键不破冻结体例)');
  const P = tableParams();
  const idleKeys = Object.keys(P).filter((k) => k.startsWith('IDLE_')).sort();
  assert.deepStrictEqual(idleKeys, IDLE_KEY_NAMES,
      'IDLE 前缀键恰 19 个(零杂散零遗漏)');
  for (const k of IDLE_KEY_NAMES) {
    assert.strictEqual(P[k], IDLE_KEYS[k], k + ' 字面锁表(改值须连测试过评审)');
    assert.strictEqual(typeof P[k], 'number', k + ' 为数值');
    assert.ok(P[k] > 0, k + ' 为正(幅度/周期/速率/距离物理量)');
  }
  /* 既有键零漂移(抽查体例锚) */
  assert.strictEqual(P.P_D1_NEARBY, 12, '既有 P_D1_NEARBY 零漂移');
  assert.strictEqual(P.HL_AIM_MAX_DIST, 24, '既有 HL_AIM_MAX_DIST 零漂移');
  assert.deepStrictEqual(P.PRAISE_MS, [1200, 2000], '既有 PRAISE_MS 零漂移');
});

test('案卷③ ④ 引擎共享面零触碰: mobs/mob-look-kit/mob-look/* 源零 idle 名渗入', () => {
  const engineFiles = ['js/mobs.js', 'js/mob-look-kit.js']
      .concat(fs.readdirSync(LOOK_DIR)
          .map((f) => path.join('js', 'mob-look', f)));
  for (const rel of engineFiles) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.indexOf('townNpcIdle') < 0 && src.indexOf('advTownNpcIdle') < 0,
        rel + ' 零 idle 名渗入(引擎层不认识镇民微动画, 49 既有怪+波次一资产零漂移)');
  }
});

test('案卷③ ④ adventure 源切片: idle tick 挂点在锚点消费机后 + tick 体零 Mobs/零墙钟零随机', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'modes', 'adventure.js'), 'utf8');
  const atAnchor = src.indexOf('advTownAnchorTick();');
  const atIdle = src.indexOf('advTownNpcIdleTick(dt);');
  assert.ok(atAnchor >= 0, 'advTownAnchorTick 挂点在位(基线)');
  assert.ok(atIdle > atAnchor,
      'advTownNpcIdleTick(dt) 挂 update 链且在锚点消费机后(同位同节拍, 案卷③红本体)');
  /* tick 函数体切片: 顶格 '}' 收界(K&R+2 空格缩进, 内层闭界必缩进) */
  const start = src.indexOf('function advTownNpcIdleTick');
  assert.ok(start >= 0, 'advTownNpcIdleTick 函数在册(案卷③红本体)');
  const end = src.indexOf('\n}', start);
  const body = src.slice(start, end + 2);
  for (const banned of ['Mobs.', 'Date.now', 'performance.now', 'Math.random', 'setTimeout']) {
    assert.ok(body.indexOf(banned) < 0,
        'tick 体内零 ' + banned + '(镇傀儡 tick 独立于 Mobs.update 路径+零墙钟零随机)');
  }
  /* 摆放/清场双端清 idle 账(空账幂等的数据基础) */
  const placeStart = src.indexOf('function advTownPuppetsPlace');
  const placeEnd = src.indexOf('\n}', placeStart);
  assert.ok(src.slice(placeStart, placeEnd).indexOf('advTownIdleParts') >= 0,
      'advTownPuppetsPlace 建/清 idle 账(消费面接线)');
  const leaveStart = src.indexOf('function advTownPuppetsLeave');
  const leaveEnd = src.indexOf('\n}', leaveStart);
  assert.ok(src.slice(leaveStart, leaveEnd).indexOf('advTownIdleParts') >= 0,
      'advTownPuppetsLeave 清 idle 账(离镇同节拍, 空账零炸)');
});

test('案卷③ ④ town-npc.js 源零墙钟零随机(源文本守门先例口径)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'town-npc.js'), 'utf8');
  for (const banned of ['Date.now', 'performance.now', 'Math.random']) {
    assert.ok(src.indexOf(banned) < 0,
        'town-npc.js 零 ' + banned + '(适配件保持确定性: 同参同输出)');
  }
});

/* ============ ⑤ apply 容差(空账安全的适配面) ============ */

test('案卷③ ⑤ apply 容差: 缺骨傀儡零炸零写(骨缺席跳过, 不静默错骨)', () => {
  const ctx = adapterCtx();
  assert.strictEqual(
      vm.runInContext('typeof townNpcIdleApply', ctx), 'function',
      'townNpcIdleApply 未落实现(案卷③红本体, 前置)');
  const out = vm.runInContext('JSON.stringify((function() {' +
    ' const puppet = {root: {position: {y: 7}}, bones: {}};' + /* 裸骨账: 仅 root */
    ' townNpcIdleApply(puppet, "humanoid",' +
    '   {floatY: 0.02, armSwing: 0.05, legSwing: -0.025, headPitch: 0.1,' +
    '    tailYaw: 0.2, neckPitch: 0.15}, 7, 0.4);' +
    ' return {y: puppet.root.position.y, n: Object.keys(puppet.bones).length}; })())', ctx);
  const r = JSON.parse(out);
  assert.strictEqual(r.y, 7.02, 'root 浮动照写(baseY+floatY)');
  assert.strictEqual(r.n, 0, '骨账零增删(缺骨跳过, 不造骨不炸)');
});
