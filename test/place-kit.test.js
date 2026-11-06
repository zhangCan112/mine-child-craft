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
Object.assign(globalThis, require('../js/paired-block-core.js')); /* advPairedBlockRows(配对方块
    行注册表, 2026-11-04 候选①——place-kit 调用期经全局名消费) */
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
const chestBreaks = []; /* 奖励箱破坏后钩录(D19: [x,y,z,id,quest]) */
let flushes = 0;
let wearCalls = 0;
let felled = 0;
let sel = 0;
let playerPos = {x: 20.5, y: 13, z: 20.5};
let stubEdge = null; /* T7: 模拟边界屏障判据命中格((x,y,z)=>bool, null=未命中)——
    ADV 形 stub 的屏障分支(advMineHardText 同构: 判据命中给占位文案) */

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
  onLootChestBreak: (x, y, z, id, quest) => chestBreaks.push([x, y, z, id, quest]),
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
  /* 硬块话术 stub(T7 扩签名 (id,x,y,z) 后的 ADV 形): 屏障格命中给占位文案;
     无 hard 方块给话术(既有口径); 有 hard 方块返空串(真实政策=advMineHardText
     对可挖件静默)——PK mineTick 起手统一问询后, 恒非空老 stub 会把一切挖掘
     变拒绝, 故按消费方真实政策塑形 */
  hardText: (id, x, y, z) => {
    if (stubEdge && stubEdge(x, y, z)) return '屏障格挖不动(占位, 终稿归 T8)';
    return (BLOCKS[id] && BLOCKS[id].hard == null) ? '这块挖不动' : '';
  },
});
function reset() {
  journal.length = 0; placed.length = 0; drops.length = 0; mined.length = 0;
  says.length = 0; speaks.length = 0; sfxs.length = 0; rings.length = 0; touches.length = 0;
  sapCleared.length = 0; cropCleared.length = 0; chestBreaks.length = 0;
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

test('place-kit: 门配对破坏 — 挖任一半整扇回收+恰掉 1 扇(2026-11-04 双掉修复: 下半自带表, 计划不双发)', () => {
  reset();
  api.setBlockRaw(16, 13, 20, api.B_DOOR); api.setBlockRaw(16, 14, 20, api.B_DOOR_TOP);
  ed.breakBlock(16, 13, 20, api.B_DOOR, {time: 1, drops: true});
  assert.strictEqual(api.getBlock(16, 13, 20), 0, '下扇清');
  assert.strictEqual(api.getBlock(16, 14, 20), 0, '上扇配对清(整扇回收)');
  assert.strictEqual(drops.filter((d) => d[0] === 'door').reduce((s, d) => s + d[1], 0), 1,
      '挖下半恰掉 1 扇(drop 表常规掷得+计划不补发, 此前双掉)');
  assert.strictEqual(wearCalls, 1, '破坏成功磨损钩');
  /* 挖上半: 上半无 drop 表, 由计划补发 1(合计仍恰 1) */
  reset();
  api.setBlockRaw(16, 13, 20, api.B_DOOR); api.setBlockRaw(16, 14, 20, api.B_DOOR_TOP);
  ed.breakBlock(16, 14, 20, api.B_DOOR_TOP, {time: 1, drops: true});
  assert.strictEqual(api.getBlock(16, 13, 20), 0, '下扇配对清');
  assert.strictEqual(drops.filter((d) => d[0] === 'door').reduce((s, d) => s + d[1], 0), 1,
      '挖上半恰掉 1 扇(计划补发, 上半无表)');
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

/* ============ ②c+ tier 不足: 挖不动就是真挖不动 (2026-11-04 用户票) ============ */

test('place-kit: tier 不足破坏拒绝 — 方块原地不动+零掉落+不磨损+节流提醒(直调兜底同守蓄力门)', () => {
  reset();
  api.setBlockRaw(20, 13, 20, 3); /* 石头(tier1: 徒手 drops:false) */
  ed.breakBlock(20, 13, 20, 3, {time: 7.5, drops: false});
  assert.strictEqual(api.getBlock(20, 13, 20), 3, '方块原地不动(真挖不动, 原「只碎不掉」废止)');
  assert.strictEqual(journal.length, 0, '世界未改动不记账');
  assert.strictEqual(drops.length, 0, '零掉落');
  assert.strictEqual(wearCalls, 0, '没破坏成功不磨损');
  assert.ok(says.some((m) => String(m).indexOf('更硬') >= 0), '节流提醒换更硬的镐子');
  ed.breakBlock(20, 13, 20, 3, {time: 7.5, drops: false}); /* 节流窗内再调 */
  assert.strictEqual(api.getBlock(20, 13, 20), 3, '仍然原地不动');
  assert.strictEqual(says.filter((m) => String(m).indexOf('更硬') >= 0).length, 1, '节流窗内不重发');
});

/* ============ ②d 低档奖励箱: 单格整箱 id 认主 (den-nest §7.5 D18/D19) ============ */

test('place-kit: 低档奖励箱单格破坏 — id 认主恰掉补给表+破坏后钩(挨着大箱不误吃配对)', () => {
  reset();
  api.setBlockRaw(35, 13, 36, api.B_LOOT_CHEST_SMALL);
  ed.breakBlock(35, 13, 36, api.B_LOOT_CHEST_SMALL, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(35, 13, 36), 0, '单格整箱清');
  assert.deepStrictEqual(drops.map((d) => [d[0], d[1]]),
      [['sword_iron', 1], ['apple', 10]],
      '补给表恰一次(全保底零掷骰——任意 rnd 同一结果, D19 拍板)');
  assert.deepStrictEqual(chestBreaks, [[35, 13, 36, api.B_LOOT_CHEST_SMALL, true]],
      '破坏后钩恰一发(坐标+id+quest 全参, 探宝 tally 缝 D19)');
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
      [['sword_iron', 1], ['apple', 10]], '只掉小箱的补给表');
  /* 大箱链不回归: 配对计划仍走(挖任一半整箱消失+钻石恒得锚), 后钩照样发 */
  reset();
  api.setBlockRaw(30, 13, 36, api.B_LOOT_CHEST);
  api.setBlockRaw(31, 13, 36, api.B_LOOT_CHEST);
  ed.breakBlock(30, 13, 36, api.B_LOOT_CHEST, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(31, 13, 36), 0, '大箱配对破坏照旧');
  assert.ok(drops.some((d) => d[0] === 'diamond' && d[1] === 1), '大箱钻石恒得锚(rare p=1)');
  assert.deepStrictEqual(chestBreaks, [[30, 13, 36, api.B_LOOT_CHEST, true]],
      '大箱破坏后钩也发(家族同缝; 壳层按键名坐标判定, 无键即 no-op)');
  /* 普通方块不触奖励箱后钩 */
  reset();
  api.setBlockRaw(36, 13, 36, 3);
  ed.breakBlock(36, 13, 36, 3, {time: 2, drops: true});
  assert.deepStrictEqual(chestBreaks, [], '非奖励箱破坏不发后钩');
});

test('place-kit: 配对方块触发格身份门(2026-11-04 候选①) — 挖邻格不误收床/宝箱(编排层全行表走一遍)', () => {
  /* 床头(36)床尾(37)沿 x, 挖床尾正后方石头(37,13,37)——旧床计划正典形校验
     对垂直方向邻格失效会误收床头; 身份门(bed 旗标)在编排层钉死 */
  reset();
  api.setBlockRaw(36, 13, 36, api.B_BED); api.setBlockRaw(37, 13, 36, api.B_BED_FOOT);
  api.setBlockRaw(37, 13, 37, 3);
  ed.breakBlock(37, 13, 37, 3, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(36, 13, 36), api.B_BED, '床头不动');
  assert.strictEqual(api.getBlock(37, 13, 36), api.B_BED_FOOT, '床尾不动');
  assert.strictEqual(drops.filter((d) => d[0] === 'bed').length, 0,
      '零床掉落(触发格身份门拦住; 石头自身常规表掉落不计)');
  /* 大箱贴墙(30/31), 挖贴墙石头(32,13,36)——旧四邻认亲无触发格门会整箱误收 */
  reset();
  api.setBlockRaw(30, 13, 36, api.B_LOOT_CHEST); api.setBlockRaw(31, 13, 36, api.B_LOOT_CHEST);
  api.setBlockRaw(32, 13, 36, 3);
  ed.breakBlock(32, 13, 36, 3, {time: 2, drops: true});
  assert.strictEqual(api.getBlock(30, 13, 36), api.B_LOOT_CHEST, '大箱左半不动');
  assert.strictEqual(api.getBlock(31, 13, 36), api.B_LOOT_CHEST, '大箱右半不动');
  assert.strictEqual(drops.filter((d) => d[0] === 'diamond' || d[0] === 'gunpowder').length, 0,
      '零战利品掉落(身份门拦住; 石头自身常规表掉落不计)');
  assert.deepStrictEqual(chestBreaks, [], '非宝箱触发不发探宝后钩');
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

/* ============ ⑥ T7 边界守卫(方案 P2/P3): hardText 扩签名 + placeGuard 缝 ============ */

/* 守卫对照 editor(独立背包防扣件串扰): placeGuard 模拟「x≤9 列=三向禁放柱足迹」,
   调用坐标全录(edgeGuardCalls)——验证目标格与结构 cell 都判的挂点面 */
function mkEdgeInv() {
  const iv = api.mkInventory();
  for (const row of [['planks', 10], ['door', 3], ['bed', 3], ['nether_portal', 1]]) api.add(iv, row[0], row[1]);
  return iv;
}
const edEdgeInv = mkEdgeInv();
const edgeSays = [];
const edgeGuardCalls = [];
let edgeSel = 0;
let edgeYaw = 0;
let edgeGuardFn = (x) => x <= 9; /* 模拟禁放柱判据(x≤9 列), 用例可切换形态 */
const edEdge = PlaceKit.mkEditor({
  inv: edEdgeInv,
  sel: () => edgeSel,
  pos: () => ({x: 20.5, y: 13, z: 20.5}),
  yaw: () => edgeYaw, /* 床放置轴向(床头异列 cell 用例需朝西) */
  onEdit: () => {},
  cascade: {},
  say: (m) => edgeSays.push(m),
  mesh: {touch: () => {}, flush: () => {}},
  hardText: () => '',
  placeGuard: (x, y, z) => {
    edgeGuardCalls.push([x, y, z]);
    return edgeGuardFn(x, y, z);
  },
});

test('T7 边界守卫(P3): placeGuard 命中 — 单格放置拒绝+话术+不扣件(守卫收目标格坐标)', () => {
  edgeSays.length = 0; edgeGuardCalls.length = 0;
  edgeSel = 0; /* planks */
  const hit = {x: 4, y: 12, z: 20, nx: 0, ny: 1, nz: 0}; /* 目标格 (4,13,20) 落禁放列 */
  assert.strictEqual(edEdge.tryPlace(hit), false, '禁放列放置拒绝');
  assert.strictEqual(api.getBlock(4, 13, 20), 0, '方块未落');
  assert.strictEqual(api.count(edEdgeInv, 'planks'), 10, '不扣物品');
  assert.ok(edgeSays.some((m) => String(m).includes('放不了')), '拒绝话术(占位)');
  assert.deepStrictEqual(edgeGuardCalls, [[4, 13, 20]], '守卫恰收目标格 (tx,ty,tz)');
});

test('T7 边界守卫(P3): placeGuard 命中 — 门结构拒绝(两 cell 同列, 判到首格命中即拒)', () => {
  edgeSays.length = 0; edgeGuardCalls.length = 0;
  edgeSel = 1; /* door */
  const hit = {x: 3, y: 12, z: 24, nx: 0, ny: 1, nz: 0}; /* 门基 (3,13,24) 禁放列; 上格 (3,14,24) 同列 */
  assert.strictEqual(edEdge.tryPlace(hit), false, '门基在禁放列 → 拒');
  assert.strictEqual(api.count(edEdgeInv, 'door'), 3, '不扣扇');
  assert.deepStrictEqual(edgeGuardCalls, [[3, 13, 24]],
      '守卫恰收门 cell 坐标(两格同列, 首格命中短路——同列故上格必同判据)');
});

test('T7 边界守卫(P3): placeGuard — 床床头/床尾异列两 cell 都在守卫看管下', () => {
  edgeSel = 2; /* bed */
  edgeYaw = Math.PI / 2; /* 朝西: 床头=床尾 x−1(主导轴), 与床尾异列 */
  /* a) 床头格 (9,13,26) 在 x≤9 禁区(cells 正典形=床头在前), 命中即拒。
     z=26 空走廊(不与既有测试落格走廊 20/30/32/36 撞) */
  edgeSays.length = 0; edgeGuardCalls.length = 0;
  assert.strictEqual(edEdge.tryPlace({x: 10, y: 12, z: 26, nx: 0, ny: 1, nz: 0}), false,
      '床头 cell 落禁放列 → 整床拒');
  assert.strictEqual(api.count(edEdgeInv, 'bed'), 3, '不扣床');
  assert.deepStrictEqual(edgeGuardCalls, [[9, 13, 26]], '床头 cell 判过(异列也拦)');
  /* b) 换判据 x≥10(床尾禁区): 床头 (9) 放行判过 → 床尾 (10,13,26) 判过命中——
     第二格(结构 cell)确实也在守卫看管下, 仅判目标格的挂点漏不了它 */
  edgeSays.length = 0; edgeGuardCalls.length = 0;
  edgeGuardFn = (x) => x >= 10;
  assert.strictEqual(edEdge.tryPlace({x: 10, y: 12, z: 26, nx: 0, ny: 1, nz: 0}), false,
      '床尾 cell 落禁放列 → 整床拒');
  assert.deepStrictEqual(edgeGuardCalls, [[9, 13, 26], [10, 13, 26]],
      '两 cell 顺序判过(床头放行后床尾仍被守卫拦住)');
  edgeGuardFn = (x) => x <= 9;
  edgeYaw = 0;
});

test('T7 边界守卫(P3): placeGuard — 传送门结构列整判(门基不在禁区, 边柱列在也拒)', () => {
  edgeSays.length = 0; edgeGuardCalls.length = 0;
  edgeSel = 3; /* nether_portal */
  const hit = {x: 10, y: 12, z: 30, nx: 0, ny: 1, nz: 0}; /* 门基 (10,13,30) x=10 不在 x≤9;
      结构包围盒 x 9..16(w6)——边柱/塔楼列 x=9 命中(z 循环首个 tz−1=29) */
  assert.strictEqual(edEdge.tryPlace(hit), false, '结构边列落禁放柱 → 整座拒');
  assert.strictEqual(api.count(edEdgeInv, 'nether_portal'), 1, '不扣座');
  assert.deepStrictEqual(edgeGuardCalls, [[9, 13, 29]],
      '守卫收结构包围盒列坐标(超出目标格的 x=9 列也被判)');
  /* 全列覆盖段: 判据永不命中 → 门立起, 断言盒列 x 9..16 每列都被守卫看过、
     盒外 (x=8/17) 没判——包围盒与 advPortalSiteOk 同源不放大 */
  edgeSays.length = 0; edgeGuardCalls.length = 0;
  edgeGuardFn = () => false;
  assert.strictEqual(edEdge.tryPlace(hit), true, '判据不命中 → 结构放行成功');
  assert.strictEqual(api.count(edEdgeInv, 'nether_portal'), 0, '正常扣 1 座');
  const xs = [...new Set(edgeGuardCalls.map((c) => c[0]))].sort((a, b) => a - b);
  assert.deepStrictEqual(xs, [9, 10, 11, 12, 13, 14, 15, 16],
      '结构列 x 9..16 逐列判(门框+塔楼+步道整面)');
});

test('T7 边界守卫(R9): placeGuard 未注入(体验馆形态) — 同禁区坐标照常放置零影响', () => {
  reset();
  sel = slotOf('planks');
  const hit = {x: 4, y: 12, z: 36, nx: 0, ny: 1, nz: 0}; /* (4,13,36)=edEdge 的禁区坐标 */
  assert.strictEqual(ed.tryPlace(hit), true, '未注入守卫 → 放行(现有 ed 全部既有断言同证)');
  assert.strictEqual(api.getBlock(4, 13, 36), 6, '方块落格');
  assert.strictEqual(api.count(inv, 'planks'), 6, '扣件正常(此前库存 7; 行为与现状一致)');
});

test('T7 屏障格挖掘拒绝(P2): 有 hard 方块坐标命中判据 — 不起蓄力+原地不动+话术节流', () => {
  reset();
  stubEdge = (x, y, z) => (x === 4 && z === 2); /* 模拟 advEdgeProtectedAt 命中格 */
  sel = slotOf('pick_wood');
  api.setBlockRaw(4, 13, 2, 3); /* 石头(hard 1.5——屏障件与带内可挖件同 id, 靠坐标判据分) */
  const mine = {down: true, t: 0, key: '', need: 0, drops: true, swingT: 0};
  ed.mineTick(mine, {x: 4, y: 13, z: 2}, 3, {held: true, panelOpen: false}); /* 3s 一步远超蓄力时长 */
  assert.strictEqual(api.getBlock(4, 13, 2), 3, '方块原地不动(真挖不动)');
  assert.strictEqual(mine.down, false, '不起蓄力(mineStop)');
  assert.strictEqual(mine.t, 0, '零蓄力进度');
  assert.ok(says.some((m) => String(m).includes('挖不动')), '屏障拒绝话术出现');
  const n = says.length;
  mine.down = true;
  ed.mineTick(mine, {x: 4, y: 13, z: 2}, 3, {held: true, panelOpen: false});
  assert.strictEqual(says.length, n, '3s 节流窗内不重发(继承「挖不动」节流链)');
  ed.resetTimers();
  stubEdge = null;
});

test('T7 hardText 扩签名回归: 老签名 (id) 注入不炸+新签名起手收到目标格坐标', () => {
  /* 老形态: 单参 stub(消费方既有写法)——PK 多收三参不炸, 无 hard 拒绝行为同现状。
     手持非工具(planks→徒手口径, 同既有测试惯例——真工具栈走 items-core 的
     toolOf, 该链既有测试未铺, 不在本测范围) */
  const legacyInv = api.mkInventory();
  api.add(legacyInv, 'planks', 1);
  const legacy = PlaceKit.mkEditor({
    inv: legacyInv,
    sel: () => 0,
    pos: () => ({x: 20.5, y: 13, z: 20.5}),
    onEdit: () => {},
    cascade: {},
    say: () => {}, speak: () => {},
    hardText: (id) => (BLOCKS[id] && BLOCKS[id].hard == null) ? '老签名话术' : '',
  });
  api.setBlockRaw(26, 13, 26, api.B_PORTAL); /* 传送门面(hard==null=声明式不可破坏族) */
  const mine = {down: true, t: 0, key: '', need: 0, drops: true, swingT: 0};
  assert.doesNotThrow(() => legacy.mineTick(mine, {x: 26, y: 13, z: 26}, 0.1, {held: true, panelOpen: false}),
      '老签名 (id) 注入多收参不炸');
  assert.strictEqual(mine.down, false, '无 hard 拒绝链行为同现状');
  /* 新签名: 有 hard 方块(石头)起手问询也发生, 坐标=准星格 */
  const seen = [];
  const modernInv = api.mkInventory();
  api.add(modernInv, 'planks', 1);
  const modern = PlaceKit.mkEditor({
    inv: modernInv,
    sel: () => 0,
    pos: () => ({x: 20.5, y: 13, z: 20.5}),
    onEdit: () => {},
    cascade: {},
    hardText: (id, x, y, z) => {
      seen.push([id, x, y, z]);
      return ''; /* 空串=放行 */
    },
  });
  api.setBlockRaw(28, 13, 28, 3); /* 石头(hard 1.5) */
  const m2 = {down: true, t: 0, key: '', need: 0, drops: true, swingT: 0};
  modern.mineTick(m2, {x: 28, y: 13, z: 28}, 0.1, {held: true, panelOpen: false});
  assert.deepStrictEqual(seen, [[3, 28, 13, 28]], '有 hard 方块起手问询恰一次, 收到 (id,x,y,z)');
});

/* ============ ⑦ T7 边界守卫(R10 补口·波次二): cascadeGuard 缝 ============ */

test('T7 边界守卫(R10 补口): cascadeGuard — 受保护格剔除(账本/掉落/felled 不出), 未注入恒等', () => {
  /* 守卫 kit: 模拟「x===10 格=屏障格」——契约=guard 返回的清单才进账本
     (复原直写由消费方在 guard 内做, 壳测试以剔除代) */
  const marks = [];
  const drops = [];
  let felledSeen = 0;
  const edG = PlaceKit.mkEditor({
    inv: mkEdgeInv(),
    sel: () => 0,
    pos: () => ({x: 20.5, y: 13, z: 20.5}),
    yaw: () => 0,
    onEdit: () => {},
    cascade: {
      mark: (x, y, z, id) => marks.push([x, y, z, id]),
      drop: (id, n, x, y, z) => drops.push([Math.floor(x), Math.floor(y), Math.floor(z)]),
    },
    onFelled: () => felledSeen++,
    say: () => {},
    mesh: {touch: () => {}, flush: () => {}},
    hardText: () => '',
    cascadeGuard: (removed) => removed.filter((r) => r.x !== 10),
  });
  /* 桩脚土格(11)合法 + 屏障原木格(10, fell=true)被级联放倒——guard 剔除后
     账本只剩土格(移除项恒记 0, advCascadeLedger 口径): 屏障格零记账/零掉落/
     felled 不喊(纯桩倒不算整树倒) */
  edG.applyCascade([{x: 10, y: 20, z: 10, id: 5}, {x: 11, y: 20, z: 10, id: 2}], false);
  assert.deepStrictEqual(marks, [[11, 20, 10, 0]], '账本只收未剔除格(屏障格不记账)');
  assert.strictEqual(drops.filter((d) => d[0] === 10).length, 0, '屏障格零掉落(掷骰不出)');
  assert.strictEqual(felledSeen, 0, '纯屏障格被剔除 → felled 不喊(整树倒观感不误触)');
  /* 对照: 不注 guard → 同形清单原样进账本+fell 上旗(未注入=恒等, R9 形态) */
  const marks2 = [];
  let felled2 = 0;
  const edP = PlaceKit.mkEditor({
    inv: mkEdgeInv(),
    sel: () => 0,
    pos: () => ({x: 20.5, y: 13, z: 20.5}),
    yaw: () => 0,
    onEdit: () => {},
    cascade: {mark: (x, y, z, id) => marks2.push([x, y, z, id]), drop: () => {}},
    onFelled: () => felled2++,
    say: () => {},
    mesh: {touch: () => {}, flush: () => {}},
    hardText: () => '',
  });
  edP.applyCascade([{x: 10, y: 20, z: 10, id: 5}], false);
  assert.deepStrictEqual(marks2, [[10, 20, 10, 0]], '未注入恒等: 清单原样进账本(移除项记 0)');
  assert.strictEqual(felled2, 1, '未注入恒等: fell 原样上旗(onFelled 在册)');
});

