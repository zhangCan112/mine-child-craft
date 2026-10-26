'use strict';
/* 造型档案 (js/mob-look-kit.js + js/mob-look/*.js) 单测 — node --test
   运行: node --test test/mob-look.test.js
   纯逻辑面直测(界面即测试面): 注册表键集(文件名=声明键=白名单) ·
   基座→槽位换算(官方 px → 世界单位, z 镜像成 +Z) · UV 区域公式 ·
   贴图布局合法性(不出界/无部分重叠) · 贴图全覆盖(用到的区域必画) ·
   同 type 两次绘制逐字节一致 · 头像裁切。THREE/傀儡段经 boot 冒烟。 */
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

test('造型档案: 自有骨架 — 苦力怕无臂四腿 · 蜘蛛八杆腿与前置头', () => {
  const cr = MobLookKit.rig('creeper');
  assert.ok(!cr.slots.armL && !cr.slots.armR, '苦力怕无臂(官方)');
  assert.strictEqual(cr.slots.legL.cubes.length, 2, '对角腿成对进 legL');
  const leg = cr.slots.legL.boxes[0];
  assert.ok(Math.abs(leg.h - 6/16) < 1e-9, '官方短腿 6px');
  const sp = MobLookKit.rig('spider');
  assert.strictEqual(sp.slots.legL.cubes.length, 4, '蜘蛛左四杆');
  assert.strictEqual(sp.slots.legR.cubes.length, 4, '蜘蛛右四杆');
  const bar = sp.slots.legL.boxes[0];
  assert.ok(Math.abs(bar.w - 1) < 1e-9 && Math.abs(bar.h - 2/16) < 1e-9,
      '官方腿 = 16×2×2px 水平长杆');
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
  assert.ok(Math.abs(cs.slots.legL.boxes[0].w - 0.7) < 1e-9, '洞穴蜘蛛 scale 0.7(蜘蛛骨×0.7)');
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
        if (same) continue; /* 整份共区(蜘蛛左右腿)是声明过的共享, 合法 */
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

test('造型档案: 碎块色声明 — 优先于 mobs.js MOB_DEBRIS', () => {
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
