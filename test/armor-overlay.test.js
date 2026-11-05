'use strict';
/* ArmorOverlay 单测 — node --test (零依赖)
   运行: node --test test/armor-overlay.test.js
   document+THREE 双桩走浏览器路径(boot 冒烟只覆盖 Node 回落路径, 测不到
   贴图缓存命中分支): 核心是换件炸点回归——首穿建纹理缓存, 换件复调命中
   已缓存 CanvasTexture(2026-11-05 二次取误当画笔组调 .paint 炸) */
const test = require('node:test');
const assert = require('node:assert');
const armorOverlayPath = require.resolve('../js/armor-overlay.js');

/* 贴图管线桩: canvas 2d 只需空操作(画笔仅 fillRect/clearRect+fillStyle) */
function stubBrowser() {
  const texLog = []; // 每次 new CanvasTexture 的实例(缓存命中=不新增)
  const document = {createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({fillRect() {}, clearRect() {}}),
  })};
  const THREE = {
    CanvasTexture: class {
      constructor(img) {
        texLog.push(this);
        this.image = img;
      }
    },
    BoxGeometry: class {
      dispose() {}
    },
    MeshLambertMaterial: class {
      constructor(o) {
        this.o = o || {};
      }
      dispose() {}
    },
    Mesh: class {
      constructor(geo, mat) {
        this.geometry = geo;
        this.material = mat;
        this.position = {set() {}};
      }
    },
  };
  const HeldItems = {ARMOR_TIER_COLORS: {iron: 0xb8b8b8, gold: 0xf6d33a}};
  const armorOf = (id) => ({tier: (id.indexOf('gold') === 0) ? 'gold' : 'iron'});
  const EQUIP_SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'];
  const mkBone = () => ({
    children: [],
    add(c) {
      this.children.push(c);
    },
    remove(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
    },
  });
  const puppet = {scale: 1, bones: {head: mkBone(), body: mkBone(),
    legR: mkBone(), legL: mkBone(), armR: mkBone(), armL: mkBone()}};
  return {texLog, document, THREE, HeldItems, armorOf, EQUIP_SLOTS, puppet};
}

/* 装环境全局 → 重载模块(重置贴图缓存) → 跑 body → 还原全局 */
function withBrowserStubs(fn) {
  const prev = {};
  const stubs = stubBrowser();
  for (const k of ['THREE', 'document', 'HeldItems', 'armorOf', 'EQUIP_SLOTS']) {
    prev[k] = global[k];
    global[k] = stubs[k];
  }
  delete require.cache[armorOverlayPath];
  const {mkArmorOverlay} = require('../js/armor-overlay.js');
  try {
    fn(stubs, mkArmorOverlay);
  } finally {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete global[k]; else global[k] = prev[k];
    }
    delete require.cache[armorOverlayPath];
  }
}

test('贴图缓存: 换件复调命中已缓存纹理不炸且同实例复用(2026-11-05 回归)', () => {
  withBrowserStubs((s, mkArmorOverlay) => {
    const ov = mkArmorOverlay(s.puppet);
    /* 首穿: 建 iron 盒身+front 两张纹理 */
    ov.apply({helmet: {id: 'iron_helmet', dur: 1}});
    assert.strictEqual(s.texLog.length, 2, '首穿应新建两张贴图(盒身+前脸)');
    /* 头盔前脸口径: 材质数组 -z=index 5 挂 frontTex, 其余面挂盒身图 */
    const helm = s.puppet.bones.head.children[0];
    assert.ok(Array.isArray(helm.material), '头盔应为六材质数组');
    assert.strictEqual(helm.material.length, 6, '六面材质');
    const bodyTex = helm.material[0].o.map;
    const frontTex = helm.material[5].o.map;
    assert.ok(bodyTex && frontTex, '实甲面与前脸都应挂纹理');
    assert.notStrictEqual(frontTex, bodyTex, '前脸与盒身是两张图');
    assert.ok(s.texLog.indexOf(frontTex) >= 0 && s.texLog.indexOf(bodyTex) >= 0,
        '两图均入模块缓存');
    /* 换件复调(修复前此处二次取命中缓存被误调 .paint 炸): 加 gold 胸甲
       ——同一轮既命中 iron 两张缓存又新建 gold 盒身一张 */
    ov.apply({helmet: {id: 'iron_helmet', dur: 2},
      chestplate: {id: 'gold_chest', dur: 1}});
    assert.strictEqual(s.texLog.length, 3, '换件只新建 gold 一张, iron 两张命中复用');
    const helm2 = s.puppet.bones.head.children[0];
    assert.strictEqual(helm2.material[5].o.map, frontTex, 'iron front 同实例复用');
    assert.strictEqual(helm2.material[0].o.map, bodyTex, 'iron 盒身同实例复用');
    /* 甲袖口径: 挂臂骨(非身骨), 同 tier 盒身纹理 */
    const armMesh = s.puppet.bones.armR.children[0];
    assert.ok(armMesh, 'armR 应挂甲袖');
    assert.strictEqual(armMesh.material.o.map, s.texLog[2], '甲袖用 gold 盒身纹理');
    assert.strictEqual(s.puppet.bones.armL.children.length, 1, 'armL 同挂甲袖');
    /* 幂等: 同 id 集复调零重建 */
    const before = s.puppet.bones.armR.children.length;
    ov.apply({helmet: {id: 'iron_helmet', dur: 3},
      chestplate: {id: 'gold_chest', dur: 2}});
    assert.strictEqual(s.texLog.length, 3, '同签名不新建纹理');
    assert.strictEqual(s.puppet.bones.armR.children.length, before, '同签名不动网格');
  });
});

test('回落: 无 document(Node 冒烟口径)纯色材质建网不炸', () => {
  const prev = {};
  const stubs = stubBrowser();
  for (const k of ['THREE', 'HeldItems', 'armorOf', 'EQUIP_SLOTS']) { // document 不装
    prev[k] = global[k];
    global[k] = stubs[k];
  }
  delete require.cache[armorOverlayPath];
  const {mkArmorOverlay} = require('../js/armor-overlay.js');
  try {
    const ov = mkArmorOverlay(stubs.puppet);
    ov.apply({helmet: {id: 'iron_helmet', dur: 1},
      chestplate: {id: 'iron_chest', dur: 1}});
    const helm = stubs.puppet.bones.head.children[0];
    assert.ok(!Array.isArray(helm.material), '回落路径单材质(无前脸纹理可抠)');
    assert.strictEqual(stubs.puppet.bones.armR.children.length, 1, '甲袖照挂');
    ov.dispose();
    assert.strictEqual(stubs.puppet.bones.head.children.length, 0, '卸甲清网格');
  } finally {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete global[k]; else global[k] = prev[k];
    }
    delete require.cache[armorOverlayPath];
  }
});
