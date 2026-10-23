'use strict';
/* 手持物注册表 (js/held-item.js) 单测 — node --test (零依赖)
   运行: node --test test/held-item.test.js
   加载器: 同一 vm context 依次执行 config.js + held-item.js — 精确镜像浏览器
   <script defer> 的共享词法环境(held-item.js 顶层零 THREE, 见其文件头) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHeld() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'held-item.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__h = { HeldItems, PLAYER };', ctx);
  return ctx.__h;
}

/* ============ def 防错网: 以后加武器漏字段当场红 ============ */

test('默认手持物: PLAYER.heldItem 指向 defs 里的合法条目', () => {
  const {HeldItems, PLAYER} = loadHeld();
  assert.strictEqual(typeof PLAYER.heldItem, 'string');
  assert.ok(HeldItems.defs[PLAYER.heldItem], 'defs 里应有 ' + PLAYER.heldItem);
});

test('剑在注册表: 下界「进下界换剑」依赖它(Avatar.setItem 未知键会静默回落空手)', () => {
  const {HeldItems} = loadHeld();
  const sword = HeldItems.defs['sword'];
  assert.ok(sword, 'defs 里应有 sword');
  assert.strictEqual(sword.label, '剑');
});

test('弓在注册表: 下界武器栏的远程位依赖它(与剑同为纯数据 def, 战斗政策在模式层)', () => {
  const {HeldItems} = loadHeld();
  const bow = HeldItems.defs['bow'];
  assert.ok(bow, 'defs 里应有 bow');
  assert.strictEqual(bow.label, '弓');
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
