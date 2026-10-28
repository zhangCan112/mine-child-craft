'use strict';
/* 手持物注册表 (js/held-item.js) 单测 — node --test (零依赖)
   运行: node --test test/held-item.test.js
   加载器: 同一 vm context 依次执行 config.js + items-core.js + held-item.js —
   精确镜像浏览器 <script defer> 的共享词法环境(held-item.js 顶层零 THREE;
   defFor 调用期才读 BLOCKS/ITEMS, 故两件表模块同境先载, 见其文件头) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHeld() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'items-core.js', 'held-item.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__h = { HeldItems, PLAYER, BLOCKS, ITEMS };', ctx);
  return ctx.__h;
}

/* ============ def 防错网: 以后加武器漏字段当场红 ============ */

test('默认手持物: PLAYER.heldItem 指向 defs 里的合法条目', () => {
  const {HeldItems, PLAYER} = loadHeld();
  assert.strictEqual(typeof PLAYER.heldItem, 'string');
  assert.ok(HeldItems.defs[PLAYER.heldItem], 'defs 里应有 ' + PLAYER.heldItem);
});

/* ============ 两层共享动画参数: equip 半程秒数收口一份 (design D6) ============ */

test('EQUIP_HALF 值锚: HeldItems.equipHalf === 0.14(Avatar/HandView 装备动画两层同拍, 防漂移)', () => {
  const {HeldItems} = loadHeld();
  assert.strictEqual(HeldItems.equipHalf, 0.14);
});

test('剑在注册表: 下界「进下界换剑」依赖它(Avatar.setItem 未知键会静默回落空手)', () => {
  const {HeldItems} = loadHeld();
  const sword = HeldItems.defs['sword'];
  assert.ok(sword, 'defs 里应有 sword');
  assert.strictEqual(sword.label, '剑');
});

test('弓在注册表: 键名与物品 id 逐字一致(bow_item)——Avatar.setItem 直用, 战斗政策在模式层', () => {
  const {HeldItems} = loadHeld();
  const bow = HeldItems.defs['bow_item'];
  assert.ok(bow, 'defs 里应有 bow_item(与 items-core 物品 id 一致)');
  assert.strictEqual(bow.label, '弓');
  /* 回归防线: 旧键 'bow' 与物品 id 不匹配——defFor('bow_item') 曾因此落到
     mkPlateDef 灰色薄片兜底, 手里拿的不是弓 */
  assert.strictEqual(HeldItems.defFor('bow_item'), bow,
      'defFor(bow_item) 应命中 defs 条目而非薄片兜底');
  assert.ok(bow.parts[0].art === 'bow_item',
      '弓部件带 art 字段(MC item/generated 像素挤出薄片正典)');
});

test('def 形状: 每个手持物具备 部件表/握持/挥击/待机 四组数据', () => {
  const {HeldItems} = loadHeld();
  const v3 = (a) => Array.isArray(a) && a.length === 3 && a.every((n) => typeof n === 'number');
  for (const [id, def] of Object.entries(HeldItems.defs)) {
    assert.strictEqual(typeof def.label, 'string', id + ' label');
    assert.ok(Array.isArray(def.parts) && def.parts.length > 0, id + ' parts 非空');
    for (const p of def.parts) {
      ['w', 'h', 'd'].forEach((k) => assert.strictEqual(typeof p[k], 'number', id + ' part.' + k));
      assert.ok(p.w > 0 && p.h > 0 && p.d > 0, id + ' part 尺寸为正');
      assert.ok(v3(p.pos), id + ' part.pos 三元数');
      assert.strictEqual(typeof p.color, 'number', id + ' part.color');
    }
    assert.ok(v3(def.grip.pos), id + ' grip.pos 三元数');
    assert.ok(v3(def.grip.rot), id + ' grip.rot 三元数');
    assert.ok(def.swing.dur > 0, id + ' swing.dur 为正');
    assert.ok(def.swing.amp > 0, id + ' swing.amp 为正');
    assert.strictEqual(typeof def.swing.curlZ, 'number', id + ' swing.curlZ');
    assert.ok(def.sway.idle >= 0, id + ' sway.idle 非负');
  }
});

/* ============ 工具参数化 (mkToolDef): 镐/斧/剑/锹 × 四阶 ============ */
/* 期望值独立于实现: 命名与色板照工单 T4 / 设计稿 §3.1 抄录 */
const KIND_NAMES = {pick: '镐', axe: '斧', sword: '剑', shovel: '锹'};
const TIER_NAMES = {wood: '木', stone: '石', iron: '铁', diamond: '钻石'};
const TIER_HEAD_COLORS = {
  wood: 0x8a5a2b, stone: 0x8a8f98, iron: 0xd8dde4, diamond: 0x4ee1d2,
};

test('工具 def 注册: 4 种 × 4 阶共 16 键(kind_tier 命名, 键名与物品 id 一致)', () => {
  const {HeldItems} = loadHeld();
  for (const kind of Object.keys(KIND_NAMES)) {
    for (const tier of Object.keys(TIER_NAMES)) {
      const id = kind + '_' + tier;
      const def = HeldItems.defs[id];
      assert.ok(def, 'defs 里应有 ' + id);
      assert.strictEqual(def.label, TIER_NAMES[tier] + KIND_NAMES[kind], id + ' label');
    }
  }
});

test('四阶色板: 每个工具 def 至少一个部件色等于该阶材质色', () => {
  const {HeldItems} = loadHeld();
  for (const tier of Object.keys(TIER_HEAD_COLORS)) {
    for (const kind of Object.keys(KIND_NAMES)) {
      const def = HeldItems.defs[kind + '_' + tier];
      assert.ok(
          def.parts.some((p) => p.color === TIER_HEAD_COLORS[tier]),
          kind + '_' + tier + ' 应含 ' + tier + ' 阶色板部件');
    }
  }
});

test('mkToolDef 工厂: 越界 kind/tier 显式抛错, 不静默产出残缺 def', () => {
  const {HeldItems} = loadHeld();
  assert.throws(() => HeldItems.mkToolDef('hammer', 'wood'), /kind/);
  assert.throws(() => HeldItems.mkToolDef('pick', 'gold'), /tier/);
});

/* ============ swingPose: 挥击关节角的纯数学 ============ */

test('swingPose 端点归零: 加法叠加无跳变的前提', () => {
  const {HeldItems} = loadHeld();
  const def = HeldItems.defs['hoe'];
  for (const p of [0, 1]) {
    const s = HeldItems.swingPose(p, def);
    assert.ok(Math.abs(s.x) < 1e-9, 'p=' + p + ' x 应为 0');
    assert.ok(Math.abs(s.z) < 1e-9, 'p=' + p + ' z 应为 0');
  }
});

test('swingPose 中段达峰: p=0.5 时 x=amp, z=curlZ(规格的工作示例)', () => {
  const {HeldItems} = loadHeld();
  const def = HeldItems.defs['hoe'];
  const s = HeldItems.swingPose(0.5, def);
  assert.ok(Math.abs(s.x - def.swing.amp) < 1e-9);
  assert.ok(Math.abs(s.z - def.swing.curlZ) < 1e-9);
});

test('swingPose 上升段向前加深(0.1 → 0.25 更大)', () => {
  const {HeldItems} = loadHeld();
  const def = HeldItems.defs['hoe'];
  assert.ok(HeldItems.swingPose(0.25, def).x > HeldItems.swingPose(0.1, def).x);
});

/* ============ 惰性 def (defFor): 方块本体 / 薄片 / 棒 / 空手 ============
   MC 口径见 docs/mc-held-item-render-research.md: 方块=缩小的方块本体
   (block model 单 16³ element, 顶/侧可异色), 非方块物品=挤出薄片,
   木棍用工具握法(handheld, 按用途不按类目), 空槽=空手 */

test('defFor: 工具/武器直通 defs(同一引用, 不另建)', () => {
  const {HeldItems} = loadHeld();
  assert.strictEqual(HeldItems.defFor('hoe'), HeldItems.defs['hoe']);
  assert.strictEqual(HeldItems.defFor('sword_iron'), HeldItems.defs['sword_iron']);
});

test('defFor 方块: 木板 → 单 box 方块本体, 正方体且色取 BLOCKS.all', () => {
  const {HeldItems, BLOCKS} = loadHeld();
  const def = HeldItems.defFor('planks');
  assert.ok(def, 'planks 应有 def');
  assert.strictEqual(def.label, BLOCKS[6].name);
  assert.strictEqual(def.parts.length, 1);
  assert.strictEqual(def.parts[0].w, def.parts[0].h);
  assert.strictEqual(def.parts[0].h, def.parts[0].d); /* 正方体 */
  const c = BLOCKS[6].all;
  assert.strictEqual(def.parts[0].color,
      (Math.round(c[0]*255) << 16) | (Math.round(c[1]*255) << 8) | Math.round(c[2]*255));
});

test('defFor 方块双色: 原木(top≠side) → 侧面主体 + 顶/底端面盖三件', () => {
  const {HeldItems, BLOCKS} = loadHeld();
  const hex = (c) => (Math.round(c[0]*255) << 16) | (Math.round(c[1]*255) << 8) | Math.round(c[2]*255);
  const def = HeldItems.defFor('log');
  assert.strictEqual(def.parts.length, 3, '主体 + 顶盖 + 底盖');
  assert.strictEqual(def.parts[0].color, hex(BLOCKS[5].side)); /* 主体=侧面色 */
  assert.strictEqual(def.parts[1].color, hex(BLOCKS[5].top)); /* 顶盖=端面色 */
  assert.strictEqual(def.parts[2].color, hex(BLOCKS[5].bottom)); /* 底盖=端面色 */
});

test('defFor 数字方块 id 直认: 建造调色板的创造专属方块(无物品条目)也能拿', () => {
  const {HeldItems} = loadHeld();
  const def = HeldItems.defFor(17); /* 石英(BUILD_PALETTE 在册, 无 ITEMS 条目) */
  assert.ok(def, '数字方块 id 应有 def');
  assert.strictEqual(def.label, '石英');
});

test('defFor 薄片: 苹果/煤/铁锭 → 单色薄板(厚远小于宽), label 取 ITEMS.name', () => {
  const {HeldItems} = loadHeld();
  for (const id of ['apple', 'coal', 'iron_ingot']) {
    const def = HeldItems.defFor(id);
    assert.ok(def, id + ' 应有 def');
    assert.strictEqual(def.parts.length, 1);
    assert.ok(def.parts[0].d < def.parts[0].w * 0.5, id + ' 应是薄片');
  }
  assert.strictEqual(HeldItems.defFor('apple').label, '苹果');
});

test('defFor 棒状: 木棍 → 细长棒(工具握法; vanilla 木棍用 handheld, 按用途不按类目)', () => {
  const {HeldItems} = loadHeld();
  const def = HeldItems.defFor('stick');
  assert.ok(def, 'stick 应有 def');
  assert.ok(def.parts[0].h > def.parts[0].w * 4, '细长棒');
});

/* ============ 火把: 贴墙薄块(wall 全表唯一) → 细棒+炭头, 不落方块本体 ============
   MC 口径: 手持火把与世界内 pushTorch 共用同一 2×10×2px 专用小盒模型
   (mc-torch-model-research §1.2), 既不是方块本体小立方也不是十字片 */

test('defFor 火把: 物品 id 与数字方块 id 均为细棒+炭头两件(断面 2px, 总长 10px), 不再是 0.38 小立方', () => {
  const {HeldItems} = loadHeld();
  for (const id of ['torch', 48]) {
    const def = HeldItems.defFor(id);
    assert.ok(def, id + ' 应有 def');
    assert.strictEqual(def.label, '火把');
    assert.strictEqual(def.parts.length, 2, id + ' 棍身+炭头两件');
    const total = def.parts.reduce((s, p) => s + p.h, 0);
    assert.ok(Math.abs(total - 0.625) < 1e-9, id + ' 总长 0.625 格(MC 专用小盒 10px 正典)');
    for (const p of def.parts) {
      assert.strictEqual(p.w, 0.125, id + ' 断面宽 2px');
      assert.strictEqual(p.d, 0.125, id + ' 断面厚 2px');
    }
    assert.ok(total > def.parts[0].w * 4, id + ' 细长观感(整体长细比 5:1, 与木棍同族)');
  }
});

test('defFor 火把炭头取块色: 顶部部件色 = BLOCKS[48].all(亮端火色; 单一数据源, 改块色手持跟随)', () => {
  const {HeldItems, BLOCKS} = loadHeld();
  const c = BLOCKS[48].all;
  const def = HeldItems.defFor('torch');
  assert.strictEqual(def.parts[def.parts.length - 1].color,
      (Math.round(c[0]*255) << 16) | (Math.round(c[1]*255) << 8) | Math.round(c[2]*255));
});

test('mkTorchDef 工厂: 非 wall 方块与越界 id → null(defFor 落回方块本体路径, 不误伤实心块)', () => {
  const {HeldItems} = loadHeld();
  assert.strictEqual(HeldItems.mkTorchDef(6), null, '木板是实心方块, 不归火把工厂');
  assert.strictEqual(HeldItems.mkTorchDef(999), null);
});

test('defFor 空手: null/未注册 → null(MC 口径: 空槽=裸手)', () => {
  const {HeldItems} = loadHeld();
  assert.strictEqual(HeldItems.defFor(null), null);
  assert.strictEqual(HeldItems.defFor('nope'), null);
});

test('惰性 def 形状: 工厂产物同样 parts/grip/swing/sway 四组齐全', () => {
  const {HeldItems} = loadHeld();
  const v3 = (a) => Array.isArray(a) && a.length === 3 && a.every((n) => typeof n === 'number');
  for (const id of ['planks', 'log', 17, 'apple', 'stick', 'coal', 'torch']) {
    const def = HeldItems.defFor(id);
    assert.ok(Array.isArray(def.parts) && def.parts.length > 0, id + ' parts 非空');
    for (const p of def.parts) {
      ['w', 'h', 'd'].forEach((k) => assert.ok(typeof p[k] === 'number' && p[k] > 0, id + ' part.' + k));
      assert.ok(v3(p.pos), id + ' part.pos 三元数');
      assert.strictEqual(typeof p.color, 'number', id + ' part.color');
    }
    assert.ok(v3(def.grip.pos) && v3(def.grip.rot), id + ' grip 三元数');
    assert.ok(def.swing.dur > 0 && def.swing.amp > 0, id + ' swing 为正');
    assert.ok(def.sway.idle >= 0, id + ' sway 非负');
  }
});

/* ============ T1: 第一人称 fp 姿态两族 + swingView + swap ============
   正典数值(docs/mc-first-person-hand-research.md Q4/Q3)与折算口径
   (design D3/D6)见 js/held-item.js 的 fp 常量块注释; 期望值独立于实现抄录 */

test('fp 形状: defFor 全路径产物含 fp 且 pos/rot/scale 三键齐(工具/锄/剑/弓/方块两形/薄片/棒)', () => {
  const {HeldItems} = loadHeld();
  const v3 = (a) => Array.isArray(a) && a.length === 3 && a.every((n) => typeof n === 'number');
  const ids = [
    ...Object.keys(HeldItems.defs), /* 16 工具 + hoe/sword/bow_item 手工条目 */
    'planks', 'log', 17, /* 方块两形: 单色盒(木板/石英) + top/side 三件盒(原木) */
    'apple', 'stick', 'torch', /* 薄片/棒/火把(惰性工厂路径) */
  ];
  for (const id of ids) {
    const def = HeldItems.defFor(id);
    assert.ok(def, id + ' 应有 def');
    assert.ok(def.fp, id + ' 缺 fp');
    assert.ok(v3(def.fp.pos), id + ' fp.pos 三元数');
    assert.ok(v3(def.fp.rot), id + ' fp.rot 三元数');
    assert.ok(typeof def.fp.scale === 'number' && def.fp.scale > 0, id + ' fp.scale 为正');
  }
});

test('fp 族正确: 方块两形=方块族(rotY 45°/scale1), 工具/锄/剑/弓/薄片/棒=手持物族(rot[-90,25]°)', () => {
  const {HeldItems} = loadHeld();
  /* 期望值独立于实现: 正典折算(mc-first-person-hand-research Q4)照常量注释抄录
     —— 方块 [0,45,0]/scale0.40(本体 0.38 已内建 → 1.0);
        手持物 [0,-90,25]+[1.13,3.2,1.13]/16+0.68(工具全长 ~0.85 → 0.68/0.85≈0.8) */
  const BLOCK = {pos: [0, 0, 0], rot: [0, 0.785, 0], scale: 1.0};
  const HAND = {pos: [1.13 / 16, 3.2 / 16, 1.13 / 16], rot: [0, -1.5708, 0.4363], scale: 0.8};
  const eq3 = (actual, want, tag) => {
    assert.ok(Array.isArray(actual) && actual.length === 3, tag + ' 三元数');
    actual.forEach((n, i) => assert.ok(Math.abs(n - want[i]) < 1e-9, tag + ' 第' + i + '分量'));
  };
  const same = (def, F, tag) => {
    eq3(def.fp.pos, F.pos, tag + ' fp.pos');
    eq3(def.fp.rot, F.rot, tag + ' fp.rot');
    assert.strictEqual(def.fp.scale, F.scale, tag + ' fp.scale');
  };
  /* 方块族: 单色盒(木板) + top/side 三件盒(原木) + 数字方块 id(石英) + 工厂直调 */
  for (const id of ['planks', 'log', 17]) same(HeldItems.defFor(id), BLOCK, '方块 ' + id);
  /* 手持物族: defs 全部 20 条(弓/剪刀正典 display 与 handheld 同值=继承)逐一 + 薄片 + 棒 */
  for (const [id, def] of Object.entries(HeldItems.defs)) same(def, HAND, '手持物 ' + id);
  same(HeldItems.defFor('apple'), HAND, '薄片 apple');
  same(HeldItems.defFor('stick'), HAND, '棒 stick');
  same(HeldItems.defFor('torch'), HAND, '火把 torch(手持态正典 handheld 族)');
  same(HeldItems.mkToolDef('pick', 'iron'), HAND, '工具工厂直调');
});

test('defFor 兜底: 手滑产物缺 fp → 回落手持物族(不炸、观感可用), 正常路径引用恒等不受影响', () => {
  const {HeldItems} = loadHeld();
  HeldItems.defs['__future'] = {label: '未来手滑', parts: [], swing: {dur: 0.24, amp: 1.3, curlZ: 0}, sway: {idle: 0.03}};
  const def = HeldItems.defFor('__future');
  assert.ok(def.fp, '兜底应有 fp');
  assert.strictEqual(def.fp.scale, 0.8, '回落手持物族 scale');
  assert.strictEqual(HeldItems.defFor('hoe'), HeldItems.defs['hoe'], '有 fp 条目仍原引用');
});

test('swingView 端点归零 + 越界钳制: p=0/1 与越界值全零(与 swingPose 同纪律)', () => {
  const {HeldItems} = loadHeld();
  const def = HeldItems.defs['hoe'];
  for (const p of [0, 1, -0.3, 1.7]) {
    const s = HeldItems.swingView(p, def);
    for (const k of ['px', 'py', 'pz', 'rx', 'ry']) {
      assert.ok(Math.abs(s[k]) < 1e-9, 'p=' + p + ' ' + k + ' 应为 0');
    }
  }
});

test('swingView 中段: px<0(横扫前送) pz<0(前伸) rx/ry<0(劈砍), 幅度随 swing.amp 归一(基线 1.3)', () => {
  const {HeldItems} = loadHeld();
  for (const id of ['hoe', 'sword', 'bow_item', 'pick_diamond']) {
    const def = HeldItems.defs[id];
    for (const p of [0.15, 0.35, 0.5, 0.7, 0.9]) {
      const s = HeldItems.swingView(p, def);
      assert.ok(s.px < 0, id + ' p=' + p + ' px 应为负(前送)');
      assert.ok(s.pz < 0, id + ' p=' + p + ' pz 应为负(前伸)');
      assert.ok(s.rx < 0 && s.ry < 0, id + ' p=' + p + ' rx/ry 应为负(劈砍/摆头)');
    }
  }
  /* 归一: 偏移 ∝ swing.amp/1.3(锄 1.3=正典全额, 剑 1.6 更阔) */
  const hoe = HeldItems.defs['hoe'];
  const sword = HeldItems.defs['sword'];
  const ratio = HeldItems.swingView(0.5, sword).px / HeldItems.swingView(0.5, hoe).px;
  assert.ok(Math.abs(ratio - sword.swing.amp / hoe.swing.amp) < 1e-9, '幅度按 amp/1.3 归一');
});

/* swap 直测需最小 THREE 桩: 只盖 mount 用到的 Group/Mesh/BoxGeometry/
   MeshLambertMaterial(traverse 递归, geometry/material 记 dispose 次数)。
   独立加载器而非改 loadHeld——不给「顶层零 THREE」回归留活口 */
function loadHeldWithThreeStub() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'items-core.js', 'held-item.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    class Node3 {
      constructor() { this.children = []; this.position = {set() {}}; }
      add(c) { this.children.push(c); }
      traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
    }
    class Disposable {
      constructor() { this.disposeCalls = 0; }
      dispose() { this.disposeCalls++; }
    }
    globalThis.THREE = {
      Group: class extends Node3 {},
      Mesh: class extends Node3 {
        constructor(g, m) { super(); this.isMesh = true; this.geometry = g; this.material = m; }
      },
      BoxGeometry: class extends Disposable {},
      MeshLambertMaterial: class extends Disposable {},
    };
    globalThis.__h = {HeldItems, THREE};
  `, ctx);
  return ctx.__h;
}

test('swap: 旧组逐 Mesh dispose(geometry+材质, spy 计数恰一次) + 新组部件数=def.parts', () => {
  const {HeldItems} = loadHeldWithThreeStub();
  const def = HeldItems.defFor('hoe');
  const old = HeldItems.mount(def);
  assert.strictEqual(old.children.length, def.parts.length);
  const next = HeldItems.swap(old, def);
  for (const m of old.children) {
    assert.strictEqual(m.geometry.disposeCalls, 1, '旧 geometry dispose 恰一次');
    assert.strictEqual(m.material.disposeCalls, 1, '旧 material dispose 恰一次');
  }
  assert.strictEqual(next.children.length, def.parts.length, '新组部件数=def.parts');
  assert.notStrictEqual(next, old, '返回的是新组');
  for (const m of next.children) assert.strictEqual(m.geometry.disposeCalls, 0, '新组几何未释放');
});

test('swap 空手: def=null → 旧组照常释放, 返回 null', () => {
  const {HeldItems} = loadHeldWithThreeStub();
  const old = HeldItems.mount(HeldItems.defFor('sword_iron'));
  assert.strictEqual(HeldItems.swap(old, null), null);
  for (const m of old.children) {
    assert.strictEqual(m.geometry.disposeCalls, 1);
    assert.strictEqual(m.material.disposeCalls, 1);
  }
});

test('swap 材质数组: mkArtMats 式多材质(弓 art 部件浏览器态)逐枚 dispose', () => {
  const {HeldItems, THREE} = loadHeldWithThreeStub();
  const old = HeldItems.mount(HeldItems.defFor('bow_item'));
  /* Node 下 mkArtMats 回落单材质; 数组分支用手工多材质 Mesh 桩直测 traverse 收口 */
  old.add(new THREE.Mesh(new THREE.BoxGeometry(),
      [new THREE.MeshLambertMaterial(), new THREE.MeshLambertMaterial()]));
  HeldItems.swap(old, null);
  const multi = old.children[old.children.length - 1];
  assert.strictEqual(multi.geometry.disposeCalls, 1);
  assert.strictEqual(multi.material[0].disposeCalls, 1, '数组材质[0] dispose');
  assert.strictEqual(multi.material[1].disposeCalls, 1, '数组材质[1] dispose');
});
