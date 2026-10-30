'use strict';
/* 放置链装配 kit (js/place-kit.js) 契约测试 — node --test (零依赖)
   运行: node --test test/place-kit.test.js
   守门线(docs/showroom-design.md §8, 只测编排不重测纯函数——合法性/结构/
   级联/掉落/蓄力步进纯函数各有 -core 单测):
   ① 单格放置: 落点在场+扣件+journal 序(含 fall 移动两格)+放置钩+观感;
   ② thin 规则(火把): 侧面收(墙火把)/顶面收/叠放拒——规则在 advPlaceCheck, 这里验 kit 走通;
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
globalThis.B_LOOT_CHEST = vm.runInContext('B_LOOT_CHEST', eng); /* 宝箱在 dims-core 消费(core 源码外) */
globalThis.B_LOOT_CHEST_SMALL = vm.runInContext('B_LOOT_CHEST_SMALL', eng); /* 低档箱同款(D18) */
const api = vm.runInContext(`({ITEMS, stackMax, isTool, mkInventory, add, count, remove,
  damageTool, HOTBAR_SLOTS, INV_SLOTS, BLOCKS, PLAYER, WORLD_W, WORLD_D,
  B_CRAFT, B_FURNACE, B_CHEST, B_SAPLING, B_TORCH, B_DOOR, B_DOOR_TOP,
  B_DOOR_OPEN, B_DOOR_TOP_OPEN, B_PORTAL, B_LAVA, B_GRASS_TUFT, B_BED, B_BED_FOOT,
  B_LOOT_CHEST, B_LOOT_CHEST_SMALL,
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
Object.assign(globalThis, require('../js/adventure-dims-core.js')); /* advLootChestPlan(宝箱配对计划,
    place-kit 调用期经全局名消费; dims-core 加载期自包含, 直 require 安全) */
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
const sapCleared = []; /* 盖掉/挖掉树苗的撤计时 sink 录 */
const cropCleared = []; /* 挖掉/掀掉麦苗的撤计时 sink 录(farm-and-recipe D3) */
let flushes = 0;
let wearCalls = 0;
let felled = 0;
let sel = 0;
let playerPos = {x: 20.5, y: 13, z: 20.5};

const inv = api.mkInventory();
for (const row of [['planks', 10], ['torch', 5], ['door', 3], ['nether_portal', 1], ['log', 5], ['bed', 3]]) {
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
    sapling: (x, y, z) => sapCleared.push([x, y, z]),
    crop: (x, y, z) => cropCleared.push([x, y, z]),
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
  sapCleared.length = 0; cropCleared.length = 0;
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

test('place-kit: thin 规则(火把贴墙) — 侧面收(墙火把)/顶面收/叠放拒(规则在纯函数, kit 走通不扣错件)', () => {
  reset();
  sel = slotOf('torch');
  const side = {x: 10, y: 13, z: 20, nx: 1, ny: 0, nz: 0}; /* 木板块侧面 */
  assert.strictEqual(ed.tryPlace(side), true, '侧面放火把收(墙火把, wall 旗标)');
  assert.strictEqual(api.getBlock(11, 13, 20), api.B_TORCH, '火把贴在侧面');
  assert.strictEqual(api.count(inv, 'torch'), 4, '扣 1 支');
  const top = {x: 10, y: 13, z: 20, nx: 0, ny: 1, nz: 0}; /* 木板块顶面 */
  assert.strictEqual(ed.tryPlace(top), true, '顶面放火把收');
  assert.strictEqual(api.getBlock(10, 14, 20), api.B_TORCH, '火把在顶');
  assert.strictEqual(api.count(inv, 'torch'), 3, '再扣 1 支');
  const dup = {x: 10, y: 13, z: 20, nx: 1, ny: 0, nz: 0}; /* 侧面格已有火把 */
  assert.strictEqual(ed.tryPlace(dup), false, '落点非空气拒(叠放)');
  assert.strictEqual(api.count(inv, 'torch'), 3, '拒绝不扣件');
  assert.ok(says.some((m) => String(m).includes('放不了')), '给指路话术');
});

test('place-kit: 覆盖放置(用户拍板 2026-10-28) — 命中花草/火把 → 新块落被点格盖掉+扣件+记账; 树苗连带撤计时', () => {
  reset();
  sel = slotOf('planks');
  api.setBlockRaw(12, 13, 32, B_GRASS_TUFT); /* 草地面上摆一株草丛(z=32 走廊, 不与他测撞格) */
  const hit = {x: 12, y: 13, z: 32, nx: 0, ny: 1, nz: 0}; /* 指草丛(顶面视角) */
  assert.strictEqual(ed.tryPlace(hit), true, '覆盖放置成功');
  assert.strictEqual(api.getBlock(12, 13, 32), 6, '木板落在草丛原格(不架半空)');
  assert.strictEqual(api.getBlock(12, 14, 32), 0, '法线侧仍是空气(旧行为不复返)');
  assert.strictEqual(api.count(inv, 'planks'), 8, '扣 1 件(此前 9)');
  assert.ok(journal.some((j) => j[0] === 12 && j[1] === 13 && j[2] === 32 && j[3] === 6),
      'journal 记账=覆盖格');
  assert.deepStrictEqual(placed, [[6, 12, 13, 32]], '放置钩坐标=被点格');
  /* 盖掉树苗: 撤计时(挖树苗同款, 防 20s 后树在新块里长出来) */
  api.setBlockRaw(14, 13, 32, B_SAPLING);
  sel = slotOf('torch');
  assert.strictEqual(ed.tryPlace({x: 14, y: 13, z: 32, nx: 0, ny: 1, nz: 0}), true,
      '火把覆盖树苗成功(正下方草地实心)');
  assert.strictEqual(api.getBlock(14, 13, 32), api.B_TORCH, '火把落在树苗原格');
  assert.deepStrictEqual(sapCleared, [[14, 13, 32]], '树苗计时已撤');
  assert.strictEqual(api.count(inv, 'torch'), 2, '火把扣 1(此前 3)');
  /* 床不带 replaceable: 走原路径——法线侧(床顶)可放, 床本体不被覆盖 */
  api.setBlockRaw(22, 13, 32, B_BED);
  reset();
  sel = slotOf('planks');
  assert.strictEqual(ed.tryPlace({x: 22, y: 13, z: 32, nx: 0, ny: 1, nz: 0}), true,
      '床走原路径: 法线侧(床顶)可放');
  assert.strictEqual(api.getBlock(22, 13, 32), B_BED, '床本体原样(不覆盖)');
  assert.strictEqual(api.getBlock(22, 14, 32), 6, '木板在床顶(旧行为不回归)');
  assert.strictEqual(api.count(inv, 'planks'), 7, '再扣 1 件(8→7)');
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

/* ============ ②b 床: 两格放置/配对破坏 (两格床改版, 门同款缝) ============ */

test('place-kit: 床 — 两格结构放置(床头=正典形较小坐标端)+扣 1 张', () => {
  reset();
  sel = slotOf('bed');
  const hit = {x: 16, y: 12, z: 20, nx: 0, ny: 1, nz: 0}; /* 目标 (16,13,20); yaw 缺省 0=朝北(−z) */
  assert.strictEqual(ed.tryPlace(hit), true, '床放置成功');
  assert.strictEqual(api.getBlock(16, 13, 20), api.B_BED_FOOT, '床尾在点击格');
  assert.strictEqual(api.getBlock(16, 13, 19), api.B_BED, '床头在 z−1(正典形=床头在轴向较小坐标端)');
  assert.strictEqual(api.count(inv, 'bed'), 2, '扣 1 张床(3→2)');
  /* 床头格被占 → 拒放不扣件(reset 不回滚背包, 库存应保持 2) */
  reset();
  assert.strictEqual(ed.tryPlace(hit), false, '床头候选格(z−1)已被床占 → 拒');
  assert.strictEqual(api.count(inv, 'bed'), 2, '拒放不扣件');
});

test('place-kit: 床配对破坏 — 挖任一半整床回收+恰掉 1 张(挖床头走常规掷/挖床尾计划补发)', () => {
  reset();
  sel = slotOf('bed');
  ed.tryPlace({x: 16, y: 12, z: 20, nx: 0, ny: 1, nz: 0});
  drops.length = 0;
  ed.breakBlock(16, 13, 19, api.B_BED, {time: 1, drops: true}); /* 挖床头 */
  assert.strictEqual(api.getBlock(16, 13, 19), 0, '床头清');
  assert.strictEqual(api.getBlock(16, 13, 20), 0, '床尾配对清(整床回收)');
  assert.strictEqual(drops.filter((d) => d[0] === 'bed').length, 1, '恰 1 张(床头常规掷, 计划不双发)');
  /* 挖床尾: 床尾无 drop 表 → 计划补发 1 */
  reset();
  sel = slotOf('bed');
  ed.tryPlace({x: 16, y: 12, z: 20, nx: 0, ny: 1, nz: 0});
  drops.length = 0;
  ed.breakBlock(16, 13, 20, api.B_BED_FOOT, {time: 1, drops: true});
  assert.strictEqual(api.getBlock(16, 13, 19), 0, '床头配对清');
  assert.strictEqual(drops.filter((d) => d[0] === 'bed').length, 1, '恰 1 张(床尾由计划补发)');
});

/* ============ ②c 战利品宝箱: 配对破坏+战利品恰一次 (den-nest §7.5 D16) ============ */

test('place-kit: 宝箱配对破坏 — 挖任一半整箱消失+掉落表恰掷一次(diamond 恒得作确定性锚)', () => {
  reset();
  api.setBlockRaw(30, 13, 36, api.B_LOOT_CHEST);
  api.setBlockRaw(31, 13, 36, api.B_LOOT_CHEST);
  ed.breakBlock(30, 13, 36, api.B_LOOT_CHEST, {time: 2, drops: true}); /* 挖左半 */
  assert.strictEqual(api.getBlock(30, 13, 36), 0, '触发格清');
  assert.strictEqual(api.getBlock(31, 13, 36), 0, '右半配对清(整箱消失)');
  assert.ok(journal.some((j) => j[0] === 31 && j[1] === 13 && j[2] === 36 && j[3] === 0),
      '配对格也记账(重进不复活——edits 单格 0 即可, 逐格清)');
  assert.ok(drops.some((d) => d[0] === 'diamond' && d[1] === 1), '钻石恒得(rare p=1, 确定性锚)');
  assert.ok(drops.some((d) => d[0] === 'gunpowder' && d[1] >= 3), '火药保底 ≥3(掉落表)');
  assert.strictEqual(drops.filter((d) => d[0] === 'diamond').length, 1, '掉落恰一次(双格不双掉)');
  assert.strictEqual(wearCalls, 1, '破坏磨损钩');
  /* 挖右半: 左半配对清(四邻认亲对称) */
  reset();
  api.setBlockRaw(30, 13, 36, api.B_LOOT_CHEST);
  api.setBlockRaw(31, 13, 36, api.B_LOOT_CHEST);
  ed.breakBlock(31, 13, 36, api.B_LOOT_CHEST, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(30, 13, 36), 0, '左半配对清');
  /* 孤儿格(无相邻宝箱): 清格不掉战利品(计划返 null——防双掷) */
  reset();
  api.setBlockRaw(33, 13, 36, api.B_LOOT_CHEST);
  ed.breakBlock(33, 13, 36, api.B_LOOT_CHEST, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(33, 13, 36), 0, '孤儿格清');
  assert.strictEqual(drops.length, 0, '无配对不掉战利品');
});

/* ============ ②d 低档奖励箱: 单格整箱 id 认主 (den-nest §7.5 D18) ============ */

test('place-kit: 低档奖励箱单格破坏 — id 认主恰掉简化表(挨着大箱不误吃配对)', () => {
  reset();
  api.setBlockRaw(35, 13, 36, api.B_LOOT_CHEST_SMALL);
  ed.breakBlock(35, 13, 36, api.B_LOOT_CHEST_SMALL, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(35, 13, 36), 0, '单格整箱清');
  assert.deepStrictEqual(drops.map((d) => [d[0], d[1]]),
      [['gunpowder', 2], ['iron_ingot', 1], ['apple', 1]],
      '简化减量表恰一次(全保底零掷骰——任意 rnd 同一结果)');
  assert.strictEqual(wearCalls, 1, '破坏磨损钩');
  /* 挨着大箱: 先认小箱(id 精确匹配)不回退大箱配对——72 邻 71 不误吃 */
  reset();
  api.setBlockRaw(30, 13, 36, api.B_LOOT_CHEST);
  api.setBlockRaw(31, 13, 36, api.B_LOOT_CHEST);
  api.setBlockRaw(32, 13, 36, api.B_LOOT_CHEST_SMALL);
  ed.breakBlock(32, 13, 36, api.B_LOOT_CHEST_SMALL, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(32, 13, 36), 0, '小箱格清');
  assert.strictEqual(api.getBlock(30, 13, 36), api.B_LOOT_CHEST, '大箱左半不动');
  assert.strictEqual(api.getBlock(31, 13, 36), api.B_LOOT_CHEST, '大箱右半不动(不误吃配对)');
  assert.deepStrictEqual(drops.map((d) => [d[0], d[1]]),
      [['gunpowder', 2], ['iron_ingot', 1], ['apple', 1]], '只掉小箱的减量表');
  /* 大箱链不回归: 配对计划仍走(挖任一半整箱消失+钻石恒得锚) */
  reset();
  api.setBlockRaw(30, 13, 36, api.B_LOOT_CHEST);
  api.setBlockRaw(31, 13, 36, api.B_LOOT_CHEST);
  ed.breakBlock(30, 13, 36, api.B_LOOT_CHEST, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(31, 13, 36), 0, '大箱配对破坏照旧');
  assert.ok(drops.some((d) => d[0] === 'diamond' && d[1] === 1), '大箱钻石恒得锚(rare p=1)');
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

test('农田撤表(farm-and-recipe D3): 直接挖麦与级联脱落(挖耕地)都走 sink.crop', () => {
  /* 直接挖: 立在草地上的麦苗, breakBlock 经 crop 身份旗标撤计时 */
  reset();
  api.setBlockRaw(20, 13, 30, B_WHEAT_1);
  ed.breakBlock(20, 13, 30, B_WHEAT_1, {time: 1, drops: true});
  assert.deepStrictEqual(cropCleared, [[20, 13, 30]], '挖麦苗撤生长计时(crop 旗标判据)');
  /* 级联脱落: 耕地上的麦苗, 挖耕地 → 麦苗 thin 失撑进级联清单 → 同一 sink 撤表 */
  reset();
  api.setBlockRaw(22, 13, 30, B_FARMLAND);
  api.setBlockRaw(22, 14, 30, B_WHEAT_2);
  ed.breakBlock(22, 13, 30, B_FARMLAND, {time: 1, drops: true});
  assert.strictEqual(api.getBlock(22, 14, 30), 0, '麦苗随耕地失撑脱落');
  assert.ok(cropCleared.some((c) => c[0] === 22 && c[1] === 14 && c[2] === 30),
      '级联脱落的麦苗同样撤计时(重进不复活半截麦)');
});
