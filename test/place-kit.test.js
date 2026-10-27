'use strict';
/* 放置链装配 kit (js/place-kit.js) 契约测试 — node --test (零依赖)
   运行: node --test test/place-kit.test.js
   守门线(docs/showroom-design.md §8, 只测编排不重测纯函数——合法性/结构/
   级联/掉落/蓄力步进纯函数各有 -core 单测):
   ① 单格放置: 落点在场+扣件+journal 序(含 fall 移动两格)+放置钩+观感;
   ② thin 规则(火把): 侧面拒/顶面收——规则在 advPlaceCheck, 这里验 kit 走通;
   ③ 门: 结构放置两格+开关成对换 id+门口站人拒关+门配对破坏(挖一半整扇回收
     +掉 1 扇经 cascade.drop);
   ④ 传送门: 结构长出(门面在场)+mesh touch/flush 收口+扣件;
   ⑤ 蓄力循环: 到点破坏(掉落+磨损+挖掘记账) · 松手态换目标熄火 ·
     无 hard 方块话术节流(tickTimers 递减复位);
   ⑥ 级联: 整树倒观感 onFelled(原木组件倒)。
   vm 装真引擎件(体素底座+级联+四核心+drops), Node 侧 require 被测 kit 与
   adventure-core(其自由标识符经 globalThis 解析到 vm 真件, showroom 同款)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/voxel.js', 'js/cascade-core.js',
  'js/scene-kit.js', 'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js',
  'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
/* adventure-core 的模块级表格(ADV_ORES 等)引用 config 的 B_ 前缀方块号常数:
   require 前先在上下文内按名单求值、铺到 Node globalThis(const 词法绑定不挂
   vm 全局对象, 只能在上下文内具名取; 名单从 adventure-core 源码动态收集防漏) */
const acSrc = fs.readFileSync(path.join(ROOT, 'js', 'adventure-core.js'), 'utf8');
const bNames = [...new Set(acSrc.match(/\bB_[A-Z0-9_]+\b/g) || [])];
for (const n of bNames) globalThis[n] = vm.runInContext(n, eng);
const api = vm.runInContext(`({ITEMS, stackMax, isTool, mkInventory, add, count, remove,
  damageTool, HOTBAR_SLOTS, INV_SLOTS, BLOCKS, PLAYER, WORLD_W, WORLD_D,
  B_CRAFT, B_FURNACE, B_CHEST, B_SAPLING, B_TORCH, B_DOOR, B_DOOR_TOP,
  B_DOOR_OPEN, B_DOOR_TOP_OPEN, B_PORTAL, B_LAVA,
  getBlock, setBlockRaw, blockKey, collidesAtPlayer, rollBlockDrop, SceneKit})`, eng);
Object.assign(globalThis, api);
/* 单块编辑 seam: world.js 太重——真级联核心镜像 world.js 的装配(adventure-mode.test
   同款): setBlockRaw + 破坏侧 cascadeRemove, 返回级联清单(与真 editBlock 契约一致) */
const engCascade = vm.runInContext('({core: CascadeCore, policy: CascadeCore.mkPolicy(BLOCKS)})', eng);
globalThis.editBlock = (x, y, z, id) => {
  const old = api.getBlock(x, y, z);
  api.setBlockRaw(x, y, z, id);
  return (id === 0 && old !== 0) ?
    engCascade.core.cascadeRemove(api.getBlock, api.setBlockRaw, x, y, z, old, engCascade.policy) : [];
};
const AdventureCore = require('../js/adventure-core.js');
Object.assign(globalThis, AdventureCore); /* advPlaceCheck/advDoorSiteOk/advMineStep 等纯函数 */
const CraftCore = require('../js/craft-core.js');
Object.assign(globalThis, {breakTime: CraftCore.breakTime});
globalThis.Fx = {debrisBurst() {}, kick() {}, boom() {}, arc() {}, pop() {}}; /* 碎屑观感桩 */
globalThis.Drops = {spawn() {}, update() {}, render() {}}; /* 掉落物实体桩(sink 直录) */

const PlaceKit = require('../js/place-kit.js');

/* ---------- 测试世界: 平地草场 + 记录型政策缝 ---------- */
const SceneKit = api.SceneKit;
SceneKit.fill(0, 10, 0, 40, 11, 40, 2);
SceneKit.fill(0, 12, 0, 40, 12, 40, 1); /* 地面 y12(站立面 13), 测试区 0..40 */

const journal = [];
const placed = [];
const drops = [];
const mined = [];
const says = [];
const speaks = [];
const sfxs = [];
const rings = [];
const touches = [];
let flushes = 0;
let wearCalls = 0;
let felled = 0;
let sel = 0;
let playerPos = {x: 20.5, y: 13, z: 20.5};

const inv = api.mkInventory();
for (const row of [['planks', 10], ['torch', 5], ['door', 3], ['nether_portal', 1], ['log', 5]]) {
  api.add(inv, row[0], row[1]);
}
function slotOf(id) {
  return inv.slots.findIndex((s) => s && s.id === id);
}
const ed = PlaceKit.mkEditor({
  inv,
  sel: () => sel,
  pos: () => playerPos,
  onEdit: (x, y, z, id) => journal.push([x, y, z, id]),
  onPlaced: (blockId, x, y, z) => placed.push([blockId, x, y, z]),
  cascade: {
    mark: () => {},
    sapling: () => {},
    drop: (id, n) => drops.push([id, n]),
    questMine: (id) => mined.push(id),
  },
  onFelled: () => felled++,
  wear: () => wearCalls++,
  say: (m) => says.push(m),
  speak: (t) => speaks.push(t),
  sfx: (n) => sfxs.push(n),
  ring: (p) => rings.push(p),
  swing: () => {},
  mesh: {touch: (x, z) => touches.push([x, z]), flush: () => flushes++},
  hardText: () => '这块挖不动',
});
function reset() {
  journal.length = 0; placed.length = 0; drops.length = 0; mined.length = 0;
  says.length = 0; speaks.length = 0; sfxs.length = 0; rings.length = 0; touches.length = 0;
  flushes = 0; wearCalls = 0; felled = 0;
}

/* ============ ① 单格放置 ============ */

test('place-kit: 单格放置 — 落点在场+扣件+journal 序(含放置与 fall 移动)+放置钩+观感', () => {
  reset();
  sel = slotOf('planks');
  const hit = {x: 10, y: 12, z: 20, nx: 0, ny: 1, nz: 0}; /* 草地顶面, 落点 (10,13,20) */
  assert.strictEqual(ed.tryPlace(hit), true, '放置成功');
  assert.strictEqual(api.getBlock(10, 13, 20), 6, '木板方块在场');
  assert.strictEqual(api.count(inv, 'planks'), 9, '扣 1 件');
  assert.ok(journal.some((j) => j[0] === 10 && j[1] === 13 && j[2] === 20 && j[3] === 6),
      'journal 记账含放置格');
  assert.deepStrictEqual(placed, [[6, 10, 13, 20]], '放置钩(blockId,x,y,z)');
  assert.ok(sfxs.includes('click'), '放置音');
  assert.ok(says.some((m) => String(m).includes('放下')), '放置话术');
});

test('place-kit: thin 规则(火把) — 侧面拒/顶面收(规则在纯函数, kit 走通不扣错件)', () => {
  reset();
  sel = slotOf('torch');
  const side = {x: 10, y: 13, z: 20, nx: 1, ny: 0, nz: 0}; /* 木板块侧面 */
  assert.strictEqual(ed.tryPlace(side), false, '侧面放火把拒');
  assert.strictEqual(api.count(inv, 'torch'), 5, '拒绝不扣件');
  assert.ok(says.some((m) => String(m).includes('放不了')), '给指路话术');
  const top = {x: 10, y: 13, z: 20, nx: 0, ny: 1, nz: 0}; /* 木板块顶面 */
  assert.strictEqual(ed.tryPlace(top), true, '顶面放火把收');
  assert.strictEqual(api.getBlock(10, 14, 20), api.B_TORCH, '火把在顶');
  assert.strictEqual(api.count(inv, 'torch'), 4, '扣 1 支');
});

/* ============ ② 门: 放置/开关/配对破坏 ============ */

test('place-kit: 门 — 结构放置两格+开关成对换 id+门口站人拒关', () => {
  reset();
  sel = slotOf('door');
  const hit = {x: 16, y: 12, z: 20, nx: 0, ny: 1, nz: 0}; /* 落点 (16,13,20) */
  assert.strictEqual(ed.tryPlace(hit), true, '门放置成功');
  assert.strictEqual(api.getBlock(16, 13, 20), api.B_DOOR, '门下扇');
  assert.strictEqual(api.getBlock(16, 14, 20), api.B_DOOR_TOP, '门上扇');
  assert.strictEqual(api.count(inv, 'door'), 2, '扣 1 扇');
  /* 开: 点下扇 */
  assert.strictEqual(ed.tryDoorToggle({x: 16, y: 13, z: 20}, api.B_DOOR), true, '开关消费点击');
  assert.strictEqual(api.getBlock(16, 13, 20), api.B_DOOR_OPEN, '下扇换开态 id');
  assert.strictEqual(api.getBlock(16, 14, 20), api.B_DOOR_TOP_OPEN, '上扇换开态 id');
  /* 关: 门口站人 → 拒关吞点击 */
  playerPos = {x: 16.5, y: 13, z: 20.5};
  reset();
  assert.strictEqual(ed.tryDoorToggle({x: 16, y: 13, z: 20}, api.B_DOOR_OPEN), true);
  assert.strictEqual(api.getBlock(16, 13, 20), api.B_DOOR_OPEN, '站人拒关(保持开)');
  assert.ok(says.some((m) => String(m).includes('关不上')), '拒关话术');
  playerPos = {x: 20.5, y: 13, z: 20.5};
  /* 关: 人走开再点 */
  assert.strictEqual(ed.tryDoorToggle({x: 16, y: 13, z: 20}, api.B_DOOR_OPEN), true);
  assert.strictEqual(api.getBlock(16, 13, 20), api.B_DOOR, '关回实心');
});

test('place-kit: 门配对破坏 — 挖任一半整扇回收+掉 1 扇(经 cascade.drop)', () => {
  reset();
  ed.breakBlock(16, 13, 20, api.B_DOOR, {time: 1, drops: true});
  assert.strictEqual(api.getBlock(16, 13, 20), 0, '下扇清');
  assert.strictEqual(api.getBlock(16, 14, 20), 0, '上扇配对清(整扇回收)');
  assert.ok(drops.some((d) => d[0] === 'door' && d[1] === 1), '掉 1 扇(不双掉)');
  assert.strictEqual(wearCalls, 1, '破坏成功磨损钩');
});

/* ============ ③ 传送门: 结构长出+网格收口 ============ */

test('place-kit: 传送门 — 结构长出(门面在场)+mesh touch/flush+扣件', () => {
  reset();
  sel = slotOf('nether_portal');
  const hit = {x: 30, y: 12, z: 30, nx: 0, ny: 1, nz: 0}; /* 空旷处门基 (30,13,30) */
  assert.strictEqual(ed.tryPlace(hit), true, '传送门放置成功');
  assert.strictEqual(api.getBlock(32, 16, 30), api.B_PORTAL, '门面在场(内口中段, w6×h7)');
  assert.strictEqual(api.getBlock(30, 13, 30), globalThis.B_OBSIDIAN, '底边黑曜石');
  assert.strictEqual(api.count(inv, 'nether_portal'), 0, '扣 1 座');
  assert.ok(touches.length > 0, '直写逐格 mesh touch');
  assert.ok(flushes > 0, '批量 flush 收口');
});

/* ============ ④ 蓄力循环 ============ */

test('place-kit: 蓄力 — 到点破坏(掉落+磨损+挖掘记账) · 松手态换目标熄火', () => {
  reset();
  sel = slotOf('log'); /* 原木也放得出(有 block 字段) */
  ed.tryPlace({x: 22, y: 12, z: 20, nx: 0, ny: 1, nz: 0}); /* 原木块在 (22,13,20) */
  reset();
  sel = slotOf('pick_wood'); /* 手持木镐: 破坏速度与磨损走真 breakTime */
  const mine = {down: true, t: 0, key: '', need: 0, drops: true, swingT: 0};
  const hit = {x: 22, y: 13, z: 20, nx: 0, ny: 0, nz: 0};
  const view = {held: true, panelOpen: false};
  ed.mineTick(mine, hit, 3, view); /* 原木 hard2×1.5/速度2 = 1.5s, 3s 一步到位 */
  assert.strictEqual(api.getBlock(22, 13, 20), 0, '到点破坏');
  assert.ok(drops.some((d) => d[0] === 'log'), '掉落经 cascade.drop');
  assert.ok(mined.includes(5), '挖掘记账经 sink.questMine(方块号口径, 探险同款)');
  assert.strictEqual(wearCalls, 1, '磨损钩');
  assert.ok(rings[rings.length - 1] === -1, '环归零收尾');
  /* 松手态(held:false)换目标 → 熄火不挖 */
  reset();
  sel = slotOf('log');
  ed.tryPlace({x: 24, y: 12, z: 20, nx: 0, ny: 1, nz: 0}); /* 再放一块原木 (24,13,20) */
  reset();
  const m2 = {down: true, t: 1.4, key: api.blockKey(22, 13, 20), need: 1.5, drops: true, swingT: 0};
  ed.mineTick(m2, {x: 24, y: 13, z: 20}, 0.1, {held: false, panelOpen: false});
  assert.strictEqual(m2.down, false, '松手态换目标: 熄火');
  assert.strictEqual(api.getBlock(24, 13, 20), 5, '未破坏');
});

test('place-kit: 无 hard 方块 — 话术节流(tickTimers 递减, 复位后可再提)', () => {
  reset();
  const mine = {down: true, t: 0, key: '', need: 0, drops: true, swingT: 0};
  const portalHit = {x: 32, y: 16, z: 30, nx: 0, ny: 0, nz: 0}; /* 传送门面(无 hard) */
  const view = {held: true, panelOpen: false};
  ed.mineTick(mine, portalHit, 0.1, view);
  assert.strictEqual(mine.down, false, '不起蓄力(吃掉点击)');
  assert.ok(speaks.includes('这块挖不动'), '节流话术出现');
  const n = speaks.length;
  mine.down = true; /* 每次点击重新起手(左键 mousedown 语义) */
  ed.mineTick(mine, portalHit, 0.1, view);
  mine.down = true;
  ed.mineTick(mine, portalHit, 0.1, view);
  assert.strictEqual(speaks.length, n, '3s 内不重复(节流)');
  ed.tickTimers(3.1); /* 节流窗滑过 */
  mine.down = true;
  ed.mineTick(mine, portalHit, 0.1, view);
  assert.ok(speaks.length > n, '节流复位后可再提');
  ed.resetTimers();
});

/* ============ ⑤ 级联: 整树倒观感 ============ */

test('place-kit: 级联 — 原木组件失撑整倒(onFelled 观感+掉落)', () => {
  reset();
  /* 竖两格原木(原木 fell 旗标=结构成员), 挖下格 → 整组件倒 */
  api.setBlockRaw(34, 13, 20, 5);
  api.setBlockRaw(34, 14, 20, 5);
  sel = slotOf('pick_wood');
  ed.breakBlock(34, 13, 20, 5, {time: 1, drops: true});
  assert.strictEqual(api.getBlock(34, 14, 20), 0, '上方原木随组件倒');
  assert.strictEqual(felled, 1, '整树倒观感钩');
  assert.ok(drops.some((d) => d[0] === 'log'), '倒塌原木落为掉落物');
});
