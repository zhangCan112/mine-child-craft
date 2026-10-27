'use strict';
/* 下界段 (js/adventure-core.js 下界段, docs/nether-merge-design.md §3.2) 单测 — node --test
   运行: node --test test/adventure-nether.test.js
   nether 模式退役、纯政策段剥核迁入 adventure-core(D15)的定向单测(D16,
   不塞 adventure-mode.test.js): fixture 加载序与 test/adventure-core.test.js
   头部一致(同一 vm 惯例装真引擎件直测)。门框等价性对着退役前权威源码
   逐格逐序断言(序 = edits 重放序); 建场确定性对着真 hashRand 断言
   (确定性重放红线)。壳层装配断言(轴 C)随后追加在本文件。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---------- 真引擎件: 与 adventure-core.test.js 同一加载序, 共享一个 vm 词法环境 ---------- */
const ROOT = path.join(__dirname, '..');
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js', 'js/scene-kit.js',
  'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({
  getBlock, setBlockRaw, hashRand, SceneKit,
  WORLD_W, WORLD_D, WORLD_H,
  B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
  B_SAPLING, B_TORCH, B_TNT, B_GRASS_TUFT, B_BED,
  B_NETHERRACK, B_LAVA, B_OBSIDIAN, B_GLOWSTONE, B_PORTAL, B_NETHER_BRICK,
})`, eng);
Object.assign(globalThis, api); /* 纯核心经全局名消费真件(经典 script 词法环境) */

const Core = require('../js/adventure-core.js');

/* ---------- 世界快照助手(对真 worldCells 断言, 与 adventure-core.test.js 同款) ---------- */
const W = api.WORLD_W;
const D = api.WORLD_D;
const H = api.WORLD_H;
const cell = (x, y, z) => vm.runInContext('worldCells', eng)[(y * D + z) * W + x];
const snapshot = () => Buffer.from(vm.runInContext('worldCells', eng)); /* 逐字节复现比对 */

/* ============ 下界段 ============ */

test('下界常量: ADV_PORTAL/ADV_NETHER 形状钉死(施工契约 §3.2 固定名)', () => {
  assert.deepStrictEqual(Core.ADV_PORTAL, {w: 6, h: 7, cd: 0.8}, '门框宽 6 高 7(内口 4×5)+冷却 0.8s');
  assert.deepStrictEqual(Core.ADV_NETHER, {ground: 20, portal: {px: 24, pz: 24}, base: {x: 25.5, z: 30.5}},
      '下界平地顶层/回程门位/下界落点');
});

test('下界门框: advPortalFrame 与退役前原版逐格一致(收集器 sink) + 关键构件抽点', () => {
  const by = Core.ADV_NETHER.ground; const px = Core.ADV_NETHER.portal.px; const pz = Core.ADV_NETHER.portal.pz;
  const key = (x, y, z) => x + ',' + y + ',' + z;
  const cells = new Map();
  Core.advPortalFrame((x, y, z, id) => cells.set(key(x, y, z), id), by, px, pz);
  /* 原版逐字重演(nether.js 退役前的权威源码, setBlockRaw 换成同一收集器口径):
     断言逐格且逐序一致 — 序即 edits 重放序, 互锁红线 */
  const ref = new Map();
  const put = (x, y, z, id) => ref.set(key(x, y, z), id);
  {
    const W0 = 6; const H0 = 7; /* 原版 NETHER_PORTAL_W/NETHER_PORTAL_H */
    for (let x = px; x <= px + W0 - 1; x++) put(x, by, pz, B_OBSIDIAN); // 底边
    for (let x = px; x <= px + W0 - 1; x++) put(x, by + H0 - 1, pz, B_OBSIDIAN); // 顶边
    for (let y = by + 1; y <= by + H0 - 2; y++) {
      put(px, y, pz, B_OBSIDIAN); // 侧柱
      put(px + W0 - 1, y, pz, B_OBSIDIAN);
      for (let x = px + 1; x <= px + W0 - 2; x++) put(x, y, pz, B_PORTAL); // 内口 = 紫色门面
    }
    for (const gx of [px, px + W0 - 1]) { // 开口四角发光岩
      for (const gy of [by + 1, by + H0 - 2]) put(gx, gy, pz, B_GLOWSTONE);
    }
    for (const tx of [px - 1, px + W0]) { // 两侧塔楼 + 发光岩压顶
      for (let y = by; y <= by + H0; y++) put(tx, y, pz, B_OBSIDIAN);
      put(tx, by + H0 + 1, pz, B_GLOWSTONE);
    }
    for (let x = px; x <= px + W0 - 1; x++) put(x, by + H0, pz, B_OBSIDIAN); // 门楣: 逐层收窄
    for (let x = px + 1; x <= px + W0 - 2; x++) put(x, by + H0 + 1, pz, B_OBSIDIAN);
    for (let x = px + 2; x <= px + W0 - 3; x++) put(x, by + H0 + 2, pz, B_GLOWSTONE); // 顶心发光岩
    for (const dz of [-1, 1]) { // 前后步道(与地表齐平)
      for (let x = px - 1; x <= px + W0; x++) put(x, by, pz + dz, B_NETHER_BRICK);
    }
  }
  assert.deepStrictEqual([...cells.entries()], [...ref.entries()], '与原版逐格且逐序一致');
  const g = (x, y, z) => cells.get(key(x, y, z));
  for (let x = px; x <= px + 5; x++) {/* 底边/顶边黑曜石 */
    assert.strictEqual(g(x, by, pz), B_OBSIDIAN, '底边黑曜石');
    assert.strictEqual(g(x, by + 6, pz), B_OBSIDIAN, '顶边黑曜石');
  }
  for (let y = by + 2; y <= by + 4; y++) {/* 侧柱中段(端点被四角发光岩盖) */
    assert.strictEqual(g(px, y, pz), B_OBSIDIAN, '左柱');
    assert.strictEqual(g(px + 5, y, pz), B_OBSIDIAN, '右柱');
  }
  let faces = 0; /* 内口 4×5 紫色门面(= advInPortal 的脚/头格判定区) */
  for (let x = px + 1; x <= px + 4; x++) {
    for (let y = by + 1; y <= by + 5; y++) {
      assert.strictEqual(g(x, y, pz), B_PORTAL, '内口门面');
      faces++;
    }
  }
  assert.strictEqual(faces, 20, '内口恰 4×5=20 格');
  for (const gx of [px, px + 5]) {/* 开口四角发光岩 */
    for (const gy of [by + 1, by + 5]) assert.strictEqual(g(gx, gy, pz), B_GLOWSTONE, '四角发光岩');
  }
  for (const tx of [px - 1, px + 6]) {/* 塔楼 + 发光岩压顶 */
    for (let y = by; y <= by + 7; y++) assert.strictEqual(g(tx, y, pz), B_OBSIDIAN, '塔楼黑曜石');
    assert.strictEqual(g(tx, by + 8, pz), B_GLOWSTONE, '塔顶发光岩');
  }
  for (let x = px; x <= px + 5; x++) assert.strictEqual(g(x, by + 7, pz), B_OBSIDIAN, '门楣一层');
  for (let x = px + 1; x <= px + 4; x++) assert.strictEqual(g(x, by + 8, pz), B_OBSIDIAN, '门楣二层');
  for (let x = px + 2; x <= px + 3; x++) assert.strictEqual(g(x, by + 9, pz), B_GLOWSTONE, '门楣顶心发光岩');
  for (const dz of [-1, 1]) {/* 前后步道 */
    for (let x = px - 1; x <= px + 6; x++) assert.strictEqual(g(x, by, pz + dz), B_NETHER_BRICK, '步道下界砖');
  }
  for (let x = px + 1; x <= px + 4; x++) {/* 站在门里的玩家: 脚格 by+1 / 头格 by+2 恰为门面 */
    assert.strictEqual(g(x, by + 1, pz), B_PORTAL, '内口判定区脚格=门面');
    assert.strictEqual(g(x, by + 2, pz), B_PORTAL, '内口判定区头格=门面');
  }
});

test('下界建场: advNetherBuild 确定性重放(两遍逐字节一致) + 地层全下界岩 + 出生区无熔岩', () => {
  const G = Core.ADV_NETHER.ground;
  vm.runInContext('worldCells.fill(0)', eng);
  Core.advNetherBuild();
  const a = snapshot();
  let bad = 0; /* 违规格计数: 熔岩只许在顶层且不进出生区 · 其余按层全下界岩/空气 */
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const id = cell(x, y, z);
        if (id === api.B_LAVA) {
          if (y !== G || (x < 44 && z < 44)) bad++; /* 熔岩只在顶层, 且不进出生区 */
          continue;
        }
        if (y < G && id !== api.B_NETHERRACK) bad++;
        else if (y === G && id !== api.B_NETHERRACK) bad++;
        else if (y > G && id !== 0) bad++;
      }
    }
  }
  assert.strictEqual(bad, 0, 'y<G 全下界岩 · y=G 下界岩或熔岩 · y>G 空气');
  /* 熔岩真的长出来了(2026-10-27 修活): 原版 hashRand(...) > 0.93 恒假
     (hashRand 输出域截断 [0,0.5), scene-kit.js 头注释登记的已知特性,
     散布应走 SceneKit.rand)——退役前的 nether 地形一块熔岩都不生成,
     与「平地上的可见障碍」原意/合并共识「唯一危险=岩浆」相悖, 已改
     SceneKit.rand 全域散布; 此处断言熔岩既非零也非泛滥(观感在) */
  let lava = 0;
  for (let z = 44; z < D; z++) {
    for (let x = 44; x < W; x++) {
      if (cell(x, G, z) === api.B_LAVA) lava++;
    }
  }
  assert.ok(lava > 0, '下界应有熔岩池(修活后 SceneKit.rand 全域)');
  assert.ok(lava < (W - 44) * (D - 44) / 3, '熔岩不成海(阈值 0.93 的成片点缀)');
  /* 清场重建: 逐字节复现(SceneKit.rand 种子化, 零 Math.random — 确定性重放红线) */
  vm.runInContext('worldCells.fill(0)', eng);
  Core.advNetherBuild();
  assert.deepStrictEqual(snapshot(), a, '两次建场 worldCells 逐块一致');
});

test('下界内口判定: advInPortal 门面内 true(脚/头各一例), 门外/框柱旁/门楣 false', () => {
  vm.runInContext('worldCells.fill(0)', eng);
  const by = Core.ADV_NETHER.ground; const px = Core.ADV_NETHER.portal.px; const pz = Core.ADV_NETHER.portal.pz;
  Core.advPortalFrame(api.setBlockRaw, by, px, pz); /* 场景基座同款接线: set 直传 setBlockRaw */
  const inP = (x, y, z) => Core.advInPortal(api.getBlock, x, y, z);
  assert.strictEqual(inP(px + 2.5, by + 1, pz + 0.5), true, '脚格在门面内');
  assert.strictEqual(inP(px + 2.5, by + 0.5, pz + 0.5), true, '头格在门面内(脚格是底边黑曜石)');
  assert.strictEqual(inP(px + 2.5, by + 1, pz + 1.5), false, '门外一步(步道上方空气)');
  assert.strictEqual(inP(px + 0.5, by + 2.5, pz + 0.5), false, '框柱旁(黑曜石柱)');
  assert.strictEqual(inP(px + 3.5, by + 8.5, pz + 0.5), false, '门楣后(门楣层与顶心)');
});

test('下界放置校验: advPortalSiteOk 空地 ok · 盒内有方块 blocked · 玩家入盒 inside', () => {
  vm.runInContext('worldCells.fill(0)', eng);
  const by = 20; const px = 60; const pz = 60;
  const w = Core.ADV_PORTAL.w; const h = Core.ADV_PORTAL.h;
  const far = () => Core.advPortalSiteOk(api.getBlock, {x: 30.5, y: 25, z: 30.5}, by, px, pz);
  assert.deepStrictEqual(far(), {ok: true}, '空地可放');
  /* 盒外五点不挡: 钉包围盒边界(x: px-1..px+w · y: by..by+h+2 · z: pz-1..pz+1) */
  api.setBlockRaw(px - 2, by, pz, 3);
  api.setBlockRaw(px + w + 1, by, pz, 3);
  api.setBlockRaw(px, by - 1, pz, 3);
  api.setBlockRaw(px, by + h + 3, pz, 3);
  api.setBlockRaw(px, by, pz + 2, 3);
  assert.deepStrictEqual(far(), {ok: true}, '盒外一格起就不挡(边界内外恰差一格)');
  /* 盒内单格石头 → blocked(取塔楼与步道的交角格) */
  api.setBlockRaw(px - 1, by, pz + 1, 3);
  assert.deepStrictEqual(far(), {ok: false, reason: 'blocked'}, '盒内有石 blocked');
  api.setBlockRaw(px - 1, by, pz + 1, 0);
  /* 玩家入盒(按脚格判, 边界含等号) → inside */
  const stand = (z) => Core.advPortalSiteOk(api.getBlock, {x: px + 2.5, y: by + 1, z}, by, px, pz);
  assert.deepStrictEqual(stand(pz + 0.5), {ok: false, reason: 'inside'}, '玩家站在盒里');
  assert.deepStrictEqual(stand(pz + 1.5), {ok: false, reason: 'inside'}, 'z=pz+1 恰在盒内沿(含等号)');
  assert.deepStrictEqual(stand(pz + 2.5), {ok: true}, 'z=pz+2 已出盒');
});

test('下界传送出口: advPortalExit yaw 约定钉死(来向退 2.5 格, yaw 反向)', () => {
  /* yaw=0: forward=(sin0, cos0)=(0,1) 即 +z — 出口 z-2.5, yaw 翻 π
     (落地朝向来路反侧, 推前进=离开门) */
  assert.deepStrictEqual(Core.advPortalExit(25.5, 21, 30.5, 0),
      {x: 25.5, y: 21, z: 28, yaw: Math.PI}, 'yaw=0 轴向出口');
  /* 非轴对称角 π/4: forward=(√2/2, √2/2) — 斜退 2.5 格, yaw=1.25π */
  const e = Core.advPortalExit(25.5, 21, 30.5, Math.PI / 4);
  const d = 2.5 * Math.SQRT1_2; /* ≈1.767767 */
  assert.ok(Math.abs(e.x - (25.5 - d)) < 1e-12, 'x 斜退 2.5·sin(π/4)');
  assert.ok(Math.abs(e.z - (30.5 - d)) < 1e-12, 'z 斜退 2.5·cos(π/4)');
  assert.strictEqual(e.y, 21, 'y 原样(来向地面已知安全)');
  assert.ok(Math.abs(e.yaw - Math.PI * 1.25) < 1e-12, 'yaw 反向(+π)');
});

/* ============ 下界相位·模式壳装配(轴 C, docs/nether-merge-design.md §3.3) ============
   装载序镜像 test/adventure-mode.test.js 的壳 fixture(vm 真件 + 假应用层)。
   惰性启动: 上面 B 轴核心级测试按 node:test 注册序先跑完, 本段首个测试进入时
   才接管 globalThis 的引擎绑定(B 段 api 指向自己的 vm 上下文, 两套 fixture
   互不干扰——这正是「追加不动前段」的组织方式)。断言清单见施工契约 §3.3。 */

let AM = null; /* AdventureMode(轴 C 装载后) */
let AN = null; /* AdventureMode.adv 挂点 */
let apiC = null; /* 轴 C vm 真件面板 */
const callsC = []; /* 行为断言调用记录(toast/sfx/spawn/loadScene...) */
const spokenC = []; /* TTS 断言 */
const memC = new Map(); /* 存储介质(SyncDB 槽底层) */
const fxBeams = []; /* Fx.portalBeam 锚定记录(轴 C fixture 提供真入口) */
const fxRemoved = []; /* Fx.removeBeam 摘除记录 */
const dropsSpawnedC = []; /* Drops.spawn 掉落记录(退料落点断言) */
const mobsSpawnedC = []; /* Mobs.spawn 记录(切界清场断言) */
let listResultC = []; /* Mobs.list() 可注入结果 */

function loadModeFixture() {/* 幂等装载: 只在首个模式级测试进入时执行一次 */
  if (AM) return;
  /* ---------- 假 DOM(mode-kit 惰性渲染用, 与 adventure-mode.test.js 同款) ---------- */
  function fakeEl() {
    const el = {
      children: [], _cls: new Set(), style: {}, dataset: {}, textContent: '',
      addEventListener() {},
      appendChild(c) {
        c.parentNode = this;
        this.children.push(c);
        return c;
      },
      removeChild(c) {
        c.parentNode = null;
        const i = this.children.indexOf(c);
        if (i >= 0) this.children.splice(i, 1);
        return c;
      },
      querySelector(sel) {
        if (!this['q_' + sel]) this['q_' + sel] = fakeEl();
        return this['q_' + sel];
      },
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => {
        html = String(v);
        el.children.length = 0;
      },
    });
    Object.defineProperty(el, 'className', {
      get: () => [...el._cls].join(' '),
      set: (v) => {
        el._cls.clear();
        String(v).split(/\s+/).filter(Boolean).forEach((c) => el._cls.add(c));
      },
    });
    Object.defineProperty(el, 'classList', {value: {
      add: (c)=>el._cls.add(c), remove: (c)=>el._cls.delete(c),
      toggle: (c, v)=>{
        const on = (v === undefined) ? !el._cls.has(c) : v;
        if (on) el._cls.add(c); else el._cls.delete(c);
      },
      contains: (c)=>el._cls.has(c),
    }});
    return el;
  }
  globalThis.performance = {now: () => 0};
  const elCache = {};
  globalThis.document = {
    createElement: () => fakeEl(),
    getElementById: (id) => (elCache[id] = elCache[id] || fakeEl()),
    body: fakeEl(),
  };
  /* ---------- 真引擎件: 与 adventure-mode.test.js 同一装载序 + cascade-core ---------- */
  const engC = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
  for (const f of ['js/config.js', 'js/mob-registry.js', 'js/daylight-core.js', 'js/voxel.js',
    'js/cascade-core.js', 'js/scene-kit.js', 'js/items-core.js',
    'js/inventory-core.js', 'js/craft-core.js', 'js/drops.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), engC, {filename: f});
  }
  apiC = vm.runInContext(`({
    getBlock, setBlockRaw, getFluidLv, setFluidLv, worldEvents, hashRand, blockKey, world, worldCells, SceneKit,
    groundTop, lightSkyAt, lightBlockAt,
    BLOCKS, PLAYER, WORLD_W, WORLD_D, WORLD_H, IS_TOUCH, DAYLIGHT, Daylight, FLUID,
    B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER, B_CRAFT, B_FURNACE,
    B_GRASS_TUFT, B_SAPLING, B_TORCH, B_CHEST, B_BED, B_TNT,
    B_NETHERRACK, B_LAVA, B_OBSIDIAN, B_GLOWSTONE, B_PORTAL, B_NETHER_BRICK,
    ITEMS, isTool, toolOf, stackMax, mkStack, durOf, breakTime,
    mkInventory, add, count, remove, moveSlot, damageTool, serialize, deserialize, HOTBAR_SLOTS, INV_SLOTS,
    raycastVoxel, collidesAtPlayer, rollBlockDrop, rollDrops, MOB_DROPS, Drops,
    RECIPES, canCraft, shapeCost, matchGrid, gridCraft, fillGrid, take, costEntry, FUEL, fuelUnits, smeltOf,
  })`, engC);
  Object.assign(globalThis, apiC); /* 接管 B 段同名绑定(指向本段上下文; B 段测试已跑完) */
  /* 掉落物实体库代理: vm 真件 + spawn/clear 记账 */
  const RealDropsC = apiC.Drops;
  globalThis.Drops = {
    spawn(id, n, x, y, z) {
      dropsSpawnedC.push({id, n, x, y, z});
      return RealDropsC.spawn(id, n, x, y, z);
    },
    update: (...a) => RealDropsC.update(...a),
    render: () => RealDropsC.render(),
    onCollect: (cb) => RealDropsC.onCollect(cb),
    list: () => RealDropsC.list(),
    clear() {
      callsC.push(['dropsClear']);
      RealDropsC.clear();
    },
  };
  /* 单块编辑 seam: 真级联核心镜像 world.js 装配(adventure-mode.test.js 同款桥) */
  const engCascadeC = vm.runInContext('({core: CascadeCore, policy: CascadeCore.mkPolicy(BLOCKS)})', engC);
  globalThis.editBlock = (x, y, z, id) => {
    const old = apiC.getBlock(x, y, z);
    apiC.setBlockRaw(x, y, z, id);
    callsC.push(['edit', x, y, z, id]);
    return (id === 0 && old !== 0) ?
      engCascadeC.core.cascadeRemove(apiC.getBlock, apiC.setBlockRaw, x, y, z, old, engCascadeC.policy) : [];
  };
  /* applySweep 快照桥(Node 侧跑同一份 cascade-core, 差异格回写真 setBlockRaw) */
  const CascadeLib = require('../js/cascade-core.js');
  const localBlocksC = {};
  for (const k of Object.keys(apiC.BLOCKS)) {
    const b = apiC.BLOCKS[k];
    const nb = {};
    if (b.fell) nb.fell = true;
    if (b.thin != null) nb.thin = b.thin;
    if (b.fall) nb.fall = true;
    if (b.solid === false) nb.solid = false;
    if (b.need) nb.need = {id: b.need.id, dist: b.need.dist};
    localBlocksC[+k] = nb;
  }
  const localPolicyC = CascadeLib.mkPolicy(localBlocksC);
  globalThis.applySweep = () => {
    const W = apiC.WORLD_W; const H = apiC.WORLD_H; const D = apiC.WORLD_D;
    const snap = new Uint8Array(apiC.worldCells);
    const read = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) ?
      0 : snap[(y * D + z) * W + x];
    const write = (x, y, z, id) => {
      snap[(y * D + z) * W + x] = id;
    };
    const removed = CascadeLib.cascadeSweep(read, write, localPolicyC, W, H, D);
    const orig = apiC.worldCells;
    for (let i = 0; i < snap.length; i++) {
      if (snap[i] === orig[i]) continue;
      const x = i % W;
      const t = (i - x) / W;
      const z = t % D;
      const y = (t - z) / D;
      apiC.setBlockRaw(x, y, z, snap[i]);
    }
    return removed;
  };
  /* ---------- 假应用层 ---------- */
  globalThis.sfx = (k) => callsC.push(['sfx', k]);
  globalThis.Fx = {
    debrisBurst() {
      callsC.push(['debris']);
    },
    kick() {
      callsC.push(['kick']);
    },
    boom() {
      callsC.push(['boom']);
    },
    arc() {
      callsC.push(['arc']);
    },
    pop() {
      callsC.push(['pop']);
    },
    portalBeam(x, y, z, o) {/* 轴 C: 常驻光束入口(观感记账, 返回可摘句柄) */
      const h = {x, y, z, w: o && o.w, h: o && o.h};
      fxBeams.push(h);
      return h;
    },
    removeBeam(h) {
      fxRemoved.push(h);
    },
  };
  globalThis.SyncDB = {
    ready: Promise.resolve(),
    slot(key, schema) {
      return require('../js/save-slot.js').mkSaveSlot({
        get: (k)=> (memC.has(k) ? memC.get(k) : null),
        set: (k, v)=> {
          memC.set(k, v);
        },
        remove: (k)=> {
          memC.delete(k);
        },
      }, key, schema);
    },
  };
  globalThis.loadScene = (fn) => {
    callsC.push(['loadScene']);
    apiC.world.clear();
    fn();
  };
  globalThis.dayTime = 0;
  globalThis.dayCycleOn = false;
  globalThis.applyDaylight = () => callsC.push(['applyDaylight']);
  globalThis.setPlayerGlow = (on) => callsC.push(['glow', on]);
  globalThis.setFluidEditSink = () => {};
  globalThis.playerAirS = 15;
  globalThis.SpeechKit = {speak(s) {
    spokenC.push(s);
  }, cancel() {}};
  globalThis.showToast = (s) => callsC.push(['toast', s]);
  globalThis.AudioMixer = {setMood(m) {
    callsC.push(['mood', m]); /* 场景曲情绪(advSyncMood): 探险按维度/昼夜上报 */
  }};
  globalThis.setTouchActions = () => {};
  globalThis.aimClick = (b) => callsC.push(['aimClick', b]);
  globalThis.Input = {refreshMain(icon, label) {
    callsC.push(['touchMain', icon, label]);
  }};
  globalThis.showPage = (id) => callsC.push(['showPage', id]);
  globalThis.uiPause = () => callsC.push(['uiPause']);
  globalThis.iconOf = () => '';
  globalThis.btnImg = () => '';
  globalThis.Avatar = {setItem(id) {
    callsC.push(['setItem', id]);
  }, swing() {
    callsC.push(['swing']);
  }, flash() {
    callsC.push(['flash']);
  }};
  /* fake 怪物库(窄面形状对齐真库; 行为断言走记录) */
  const MOB_CFG_C = {
    zombie: {name: '僵尸', hp: 30, dmg: 5, speed: 2.3, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55},
    skeleton: {name: '骷髅', hp: 26, dmg: 6, speed: 2.6, range: 14, cd: 2.6, h: 1.9, ranged: true, hitR: 0.55},
    spider: {name: '蜘蛛', hp: 24, dmg: 3, speed: 3.0, range: 2.2, cd: 1.2, h: 0.9, hitR: 0.65},
    creeper: {name: '苦力怕', hp: 28, dmg: 33, speed: 3.1, range: 2.0, cd: 9, h: 1.7, hitR: 0.5},
    cow: {name: '牛', hp: 15, dmg: 0, speed: 1.4, range: 0, cd: 0, h: 1.3, hitR: 0.7, passive: true},
    pig: {name: '猪', hp: 15, dmg: 0, speed: 1.3, range: 0, cd: 0, h: 0.9, hitR: 0.6, passive: true},
    sheep: {name: '羊', hp: 12, dmg: 0, speed: 1.2, range: 0, cd: 0, h: 1.2, hitR: 0.65, passive: true},
    chicken: {name: '鸡', hp: 6, dmg: 0, speed: 1.5, range: 0, cd: 0, h: 0.7, hitR: 0.35, passive: true},
  };
  globalThis.Mobs = {
    spawn(type, x, z, opts) {
      const m = {type, pos: {x, y: 25, z}, dead: false, gone: false, yaw: 0, attackCd: 0, attackT: 0,
        target: null, nest: -1,
        cfg: MOB_CFG_C[type] || {hp: 20, dmg: 3, speed: 2, range: 2, cd: 1, h: 1.8, hitR: 0.55}};
      mobsSpawnedC.push(m);
      return m;
    },
    update() {}, render() {},
    hit() {
      return {hp: 10, dead: false, freshDead: false};
    },
    onDeath() {},
    clear() {
      callsC.push(['mobsClear']);
      mobsSpawnedC.length = 0;
    },
    remove(m) {
      m.gone = true;
    },
    list() {
      return listResultC;
    },
    steer() {}, move() {}, gait() {},
    debrisColor() {
      return 0x1a2b3c;
    },
  };
  globalThis.CombatCore = require('../js/combat-core.js');
  globalThis.CombatKit = require('../js/combat-kit.js');
  globalThis.pos = {x: 61.5, y: 25, z: 76.5, set() {}};
  globalThis.vel = {set() {}};
  globalThis.yaw = 0;
  globalThis.pitch = 0;
  globalThis.onGround = false;
  globalThis.flyMode = false;
  globalThis.setFly = (v)=> {
    globalThis.flyMode = v;
    globalThis.vel.y = 0;
  };
  const ModeKitC = require('../js/mode-kit.js');
  globalThis.mkMode = ModeKitC.mkMode;
  globalThis.mkMainAct = ModeKitC.mkMainAct;
  globalThis.mkBubbleBar = ModeKitC.mkBubbleBar;
  globalThis.ModeKit = ModeKitC;
  ModeKitC.spawn = (x, y, z, o) => {/* 镜像真 kitSpawn 写 pos/yaw */
    callsC.push(['spawn', x, y, z, o]);
    globalThis.pos.x = x; globalThis.pos.y = y; globalThis.pos.z = z;
    globalThis.yaw = (o && o.yaw) || 0;
  };
  /* 探险核心(复用 B 段的 require 实例) + 烧炼三件 + 三个壳级 kit 铺全局 */
  Object.assign(globalThis, Core);
  const CraftCoreC = require('../js/craft-core.js');
  Object.assign(globalThis, {SMELT_T: CraftCoreC.SMELT_T, smeltStep: CraftCoreC.smeltStep,
    furnaceRefund: CraftCoreC.furnaceRefund});
  globalThis.FurnaceKit = require('../js/furnace-kit.js');
  globalThis.Backpack = require('../js/backpack.js');
  globalThis.WorldJournal = require('../js/world-journal-core.js');
  globalThis.mkWorldJournal = WorldJournal.mkWorldJournal;
  globalThis.fluidCell = WorldJournal.fluidCell;
  AM = require('../js/modes/adventure.js');
  AN = AM.adv;
}

/* ---------- 轴 C 共用助手 ---------- */
function freshC(pre) {/* 干净进场(可选 pre 桩先铺存档介质) */
  loadModeFixture();
  memC.clear();
  if (pre) pre(memC);
  callsC.length = 0;
  spokenC.length = 0;
  fxBeams.length = 0;
  fxRemoved.length = 0;
  dropsSpawnedC.length = 0;
  mobsSpawnedC.length = 0;
  listResultC = [];
  AM.init();
}
function holdOnlyC(id, n, dur) {/* 背包清空后只在快捷栏 0 槽放一件并选中 */
  const inv = AN.advGetInv();
  inv.slots = new Array(apiC.INV_SLOTS).fill(null);
  if (id) inv.slots[0] = dur != null ? {id, n: 1, dur} : {id, n};
  AM.hotbar.select(0);
}
function grassSpotC() {/* 一格草地净空(方块放置用) */
  for (let x = 3; x < 110; x++) {
    for (let z = 3; z < 110; z++) {
      if (apiC.getBlock(x, 24, z) === 1 && apiC.getBlock(x, 25, z) === 0) return {x, z};
    }
  }
  throw new Error('找不到草地净空');
}
function findClearC(xLo, xHi) {/* 能放下整座门的干净草地(结构包围盒全空气) */
  for (let x = xLo; x < xHi; x++) {
    for (let z = 3; z < 100; z++) {
      if (apiC.getBlock(x, 24, z) !== 1) continue;
      let ok = true;
      for (let dx = -1; dx <= 6 && ok; dx++) {
        for (let dy = 0; dy <= 9 && ok; dy++) {
          for (let dz = -1; dz <= 1 && ok; dz++) {
            if (apiC.getBlock(x + dx, 25 + dy, z + dz) !== 0) ok = false;
          }
        }
      }
      if (ok) return {x, z};
    }
  }
  throw new Error('找不到可放门的空地');
}
function netherSpotC() {/* 下界岩顶面净空(非熔岩池, 出生区外) */
  for (let x = 46; x < 110; x++) {
    for (let z = 46; z < 110; z++) {
      if (apiC.getBlock(x, 20, z) === apiC.B_NETHERRACK && apiC.getBlock(x, 21, z) === 0) return {x, z};
    }
  }
  throw new Error('找不到下界空地');
}
function placePortalAt(spot) {/* 站远处朝草地顶面放一座门(onMouse(2) 全链) */
  globalThis.pos.x = spot.x + 2.5;
  globalThis.pos.y = 25;
  globalThis.pos.z = spot.z - 4.5; /* 盒外(z-1..z+1 之南两格) */
  AM.onMouse(2, {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0});
}
function stepIntoPortal(x, y, z, yawIn) {/* 摆位进门面跑一帧(传送触发) */
  globalThis.pos.x = x;
  globalThis.pos.y = y;
  globalThis.pos.z = z;
  globalThis.yaw = yawIn;
  AM.update(0.05);
}
const toastsC = () => callsC.filter((c) => c[0] === 'toast').map((c) => c[1]);
const lastSpawnC = () => [...callsC].reverse().find((c) => c[0] === 'spawn');

/* ============ 轴 C 断言 ============ */

test('C1 切界: advSetDim 下界基座(下界岩+回程门内口) + dayCycleOn 关 + 怪清场, 回上界草原复原', () => {
  freshC();
  AN.advSetDim('nether');
  assert.strictEqual(AN.advNetherState().dim, 'nether', '维度账本翻到 nether');
  assert.strictEqual(apiC.getBlock(10, 10, 10), apiC.B_NETHERRACK, '地层全下界岩');
  assert.strictEqual(globalThis.dayCycleOn, false, 'D10: 昼夜循环关(dayTime 暂停)');
  const px = Core.ADV_NETHER.portal.px; const pz = Core.ADV_NETHER.portal.pz;
  const by = Core.ADV_NETHER.ground;
  assert.strictEqual(apiC.getBlock(px + 2, by + 1, pz), apiC.B_PORTAL, '回程门内口底行是门面');
  assert.strictEqual(apiC.getBlock(px + 3, by + 5, pz), apiC.B_PORTAL, '回程门内口顶行是门面');
  assert.strictEqual(mobsSpawnedC.length, 0, '切界清怪(下界无怪, 上界巢穴怪不渗入)');
  assert.strictEqual(fxBeams.length - fxRemoved.length, 1, '回程门光束锚一束(基座门, 不在 edits)');
  /* 回上界: 草原确定性复原 + 昼夜循环复位 */
  AN.advSetDim('overworld');
  assert.strictEqual(apiC.getBlock(10, 24, 10), 1, '回上界草地复原');
  assert.strictEqual(globalThis.dayCycleOn, true, '昼夜循环复位');
});

test('C2 传送触发: 站进玩家门的门面 → 切下界 + 冷却期再站回程门被吞 + 冷却尽回上界落 advExitSpot', () => {
  freshC();
  const spot = findClearC(3, 60);
  holdOnlyC('nether_portal', 2);
  placePortalAt(spot);
  assert.strictEqual(apiC.count(AN.advGetInv(), 'nether_portal'), 1, '放置扣 1(前提)');
  /* 走进自家门的门面: 脚格是底边黑曜石, 头格(by+1)是门面 → advInPortal 命中 */
  stepIntoPortal(spot.x + 2.5, 25, spot.z + 0.5, 0);
  const st = AN.advNetherState();
  assert.strictEqual(st.dim, 'nether', '踏入门面即切下界');
  assert.strictEqual(st.portalCd, Core.ADV_PORTAL.cd, '落地空眩晕冷却 0.8s');
  assert.strictEqual(globalThis.dayCycleOn, false, '下界恒夜门');
  const ex = st.exitSpot;
  assert.ok(ex, '回程落点已记录(advPortalExit)');
  assert.ok(Math.abs(ex.x - (spot.x + 2.5)) < 1e-9, '出口 x=来向退 2.5(yaw=0 前向 +z)');
  assert.ok(Math.abs(ex.z - (spot.z + 0.5 - 2.5)) < 1e-9, '出口 z 沿来向后退 2.5');
  /* 冷却期内站进下界回程门门面: 被吞(不回弹) */
  stepIntoPortal(Core.ADV_NETHER.portal.px + 2.5, Core.ADV_NETHER.ground + 1,
      Core.ADV_NETHER.portal.pz + 0.5, Math.PI);
  assert.strictEqual(AN.advNetherState().dim, 'nether', '冷却期内再触发被吞');
  /* 冷却耗尽仍站在回程门面 → 回上界, 落在自家门旁的 advExitSpot */
  AM.update(0.9);
  assert.strictEqual(AN.advNetherState().dim, 'overworld', '冷却尽后回上界');
  assert.ok(Math.abs(globalThis.pos.x - (spot.x + 2.5)) < 1e-9, '落点=进门时刻记录的出口 x');
  assert.ok(Math.abs(globalThis.pos.z - (spot.z - 2)) < 1e-9, '落点=出口 z(门旁两格)');
  assert.ok(toastsC().some((t) => t.indexOf('进了下界') >= 0), '进下界话术');
  assert.ok(toastsC().some((t) => t.indexOf('回到上界') >= 0), '回上界话术');
});

test('C3 两界分桶: 下界放置记 nether 桶不串 overworld 桶, 回界重放原样重建', () => {
  freshC();
  AN.advSetDim('nether');
  const ns = netherSpotC();
  holdOnlyC('planks', 5);
  AM.onMouse(2, {x: ns.x, y: 20, z: ns.z, nx: 0, ny: 1, nz: 0}); /* 走真实放置链(advMarkEdit 记账) */
  const k = ns.x + ',21,' + ns.z;
  assert.strictEqual(apiC.getBlock(ns.x, 21, ns.z), 6, '木板已放下(前提)');
  assert.ok(AN.advSceneEdits.nether.has(k), '记进 nether 桶');
  assert.ok(!AN.advSceneEdits.overworld.has(k), 'overworld 桶没有这格(不串桶)');
  /* 回上界再回来: 桶重放原样重建 */
  AN.advSetDim('overworld');
  AN.advSetDim('nether');
  assert.strictEqual(apiC.getBlock(ns.x, 21, ns.z), 6, '下界改动经桶重放复原(D8 记账落盘口径)');
});

test('C4 payload: 下界期间 flush 的档 pos=null + netherEdits 随档 + 旧形状档(无 netherEdits)照常载入', () => {
  freshC();
  AN.advSetDim('nether');
  const ns = netherSpotC();
  holdOnlyC('planks', 5);
  AM.onMouse(2, {x: ns.x, y: 20, z: ns.z, nx: 0, ny: 1, nz: 0});
  const k = ns.x + ',21,' + ns.z;
  AN.advJournal.flush();
  const sv = JSON.parse(memC.get('adventure_world_save'));
  assert.strictEqual(sv.pos, null, 'D9: 维度不进档(下界退出重进回上界小屋)');
  assert.ok(Array.isArray(sv.netherEdits) && sv.netherEdits.some((e) => e[0] === k), 'netherEdits 随档');
  assert.ok(!sv.edits.some((e) => e[0] === k), 'edits 字段恒为上界桶(下界期间不串桶)');
  /* 旧形状档(无 netherEdits): init 照常, 下界桶缺省空 */
  freshC((m)=>m.set('adventure_world_save', JSON.stringify({_v: 1, edits: [['70,25,80', 3]]})));
  assert.strictEqual(AN.advNetherState().dim, 'overworld', '旧档进场恒上界');
  assert.strictEqual(AN.advSceneEdits.nether.size, 0, '旧档缺省空下界桶(零迁移)');
  assert.strictEqual(apiC.getBlock(70, 25, 80), 3, '上界 edits 重放照旧');
});

test('C5 下界死亡: 切回上界 + 小屋出生 + 满血 + 回程记录作废(D11)', () => {
  freshC();
  AN.advSetDim('nether');
  AN.advGetPEnt().hp = 1;
  AM.onVoidFall(); /* 坠虚与致命一击同一死亡计划出口 */
  assert.strictEqual(AN.advNetherState().dim, 'overworld', '下界死亡顺带切回上界');
  assert.strictEqual(AN.advNetherState().exitSpot, null, '回程记录作废(人已死)');
  const sp = lastSpawnC();
  const home = AN.ADV.spawn;
  assert.ok(sp && sp[1] === home.x && sp[3] === home.z, '出生=小屋门口(死亡计划, 不用门的出口)');
  assert.strictEqual(AN.ADV.player.hp, AN.ADV.player.maxHp, '满血复活(零惩罚哲学)');
});

test('C6 门放置: 空地成功(结构逐格记账+扣物品+光束) · 盒内有石话术不扣 · 玩家站盒内话术不扣', () => {
  freshC();
  const spot = findClearC(3, 60);
  const hit = {x: spot.x, y: 24, z: spot.z, nx: 0, ny: 1, nz: 0};
  holdOnlyC('nether_portal', 3);
  assert.ok(callsC.some((c) => c[0] === 'touchMain' && c[1] === 'brick' && c[2] === '放置'),
      '触屏主动作键把门识别为可放置(放置=砖块图标)');
  /* 盒内有石头 → blocked 话术, 不扣物品 */
  apiC.setBlockRaw(spot.x + 3, 27, spot.z, 3);
  globalThis.pos.x = spot.x + 2.5; globalThis.pos.y = 25; globalThis.pos.z = spot.z - 4.5;
  AM.onMouse(2, hit);
  assert.strictEqual(apiC.count(AN.advGetInv(), 'nether_portal'), 3, '失败不扣物品');
  assert.ok(toastsC().some((t) => t.indexOf('太挤') >= 0), 'blocked 话术');
  assert.strictEqual(apiC.getBlock(spot.x, 25, spot.z), 0, '门没立起来');
  apiC.setBlockRaw(spot.x + 3, 27, spot.z, 0); /* 清掉石头 */
  /* 玩家站盒内 → inside 话术, 不扣物品 */
  globalThis.pos.x = spot.x + 2.5; globalThis.pos.y = 26; globalThis.pos.z = spot.z + 0.5;
  AM.onMouse(2, hit);
  assert.strictEqual(apiC.count(AN.advGetInv(), 'nether_portal'), 3, '站盒内同样不扣');
  assert.ok(toastsC().some((t) => t.indexOf('站远一点') >= 0), 'inside 话术');
  /* 空地成功: 结构落场 + 逐格记账 + 扣 1 + 光束 */
  placePortalAt(spot);
  assert.strictEqual(apiC.count(AN.advGetInv(), 'nether_portal'), 2, '成功扣 1');
  assert.strictEqual(apiC.getBlock(spot.x, 25, spot.z), apiC.B_OBSIDIAN, '底边黑曜石');
  assert.strictEqual(apiC.getBlock(spot.x + 2, 26, spot.z), apiC.B_PORTAL, '内口门面');
  assert.strictEqual(AN.advSceneEdits.overworld.get((spot.x + 2) + ',26,' + spot.z), apiC.B_PORTAL,
      '结构格逐格记账(重放即重建)');
  assert.strictEqual(fxBeams.length, 1, '这扇门的光束顺路锚上');
  assert.ok(toastsC().some((t) => t.indexOf('立起来') >= 0), '成功话术');
});

test('C7 多门回程: 最后进入的门优先——门A记录被门B按次序替换, 回程落门B旁', () => {
  freshC();
  const spotA = findClearC(3, 55);
  const spotB = findClearC(60, 118);
  holdOnlyC('nether_portal', 4);
  placePortalAt(spotA);
  placePortalAt(spotB);
  assert.strictEqual(apiC.count(AN.advGetInv(), 'nether_portal'), 2, '两座门都立起(前提)');
  /* 进门 A(yaw=0): 记录出口 A */
  stepIntoPortal(spotA.x + 2.5, 25, spotA.z + 0.5, 0);
  const e1 = AN.advNetherState().exitSpot;
  assert.ok(Math.abs(e1.z - (spotA.z - 2)) < 1e-9, '门A的出口记录');
  /* 回上界 → 进门 B(yaw=π/2): 出口记录换成门B的(最后进入者优先, 不残留门A) */
  globalThis.pos.x = Core.ADV_NETHER.portal.px + 2.5;
  globalThis.pos.y = Core.ADV_NETHER.ground + 1;
  globalThis.pos.z = Core.ADV_NETHER.portal.pz + 0.5;
  AM.update(0.9); /* 冷却尽 + 站在回程门面 → 回上界 */
  assert.strictEqual(AN.advNetherState().dim, 'overworld', '回上界(前提)');
  stepIntoPortal(spotB.x + 2.5, 25, spotB.z + 0.5, Math.PI / 2); /* 摆位门B(回程冷却窗内, 本帧被吞) */
  AM.update(0.9); /* 冷却尽 + 仍站门B门面 → 进门 B 记录出口 B */
  const e2 = AN.advNetherState().exitSpot;
  assert.ok(Math.abs(e2.x - spotB.x) < 1e-9 && Math.abs(e2.z - (spotB.z + 0.5)) < 1e-9,
      '门B的出口记录(yaw=π/2 前向 +x, 退 2.5)');
  assert.ok(Math.abs(e1.x - e2.x) > 1 || Math.abs(e1.z - e2.z) > 1, '两门出口不同(记录确已换人)');
  /* 再回上界: 落门B旁, 不是门A旁 */
  globalThis.pos.x = Core.ADV_NETHER.portal.px + 2.5;
  globalThis.pos.y = Core.ADV_NETHER.ground + 1;
  globalThis.pos.z = Core.ADV_NETHER.portal.pz + 0.5;
  AM.update(0.9);
  assert.ok(Math.abs(globalThis.pos.x - spotB.x) < 1e-9, '回程落门B旁(最后进入者优先)');
});

test('C8 炉界键(D14): 下界炉键带 n| 前缀 · 与上界同坐标炉互不串 · 异界键不挂火焰 · 退料落点解析剥前缀', () => {
  freshC();
  /* 上界炉: 放置+开炉+自动放料(无前缀键) */
  const ow = grassSpotC();
  holdOnlyC('furnace', 1);
  AM.onMouse(2, {x: ow.x, y: 24, z: ow.z, nx: 0, ny: 1, nz: 0});
  const fk = ow.x + ',25,' + ow.z;
  apiC.add(AN.advGetInv(), 'iron_ore', 3);
  apiC.add(AN.advGetInv(), 'coal', 1);
  globalThis.pos.x = ow.x + 0.5; globalThis.pos.y = 25; globalThis.pos.z = ow.z + 0.5;
  AM.onMouse(0, {x: ow.x, y: 25, z: ow.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(AN.advFurnace.at(), fk, '上界炉键无前缀');
  AN.advFurnace.autoFill();
  /* 进下界放第二座炉(有前缀键) */
  AN.advSetDim('nether');
  const ns = netherSpotC();
  holdOnlyC('furnace', 1);
  AM.onMouse(2, {x: ns.x, y: 20, z: ns.z, nx: 0, ny: 1, nz: 0});
  const nk = 'n|' + ns.x + ',21,' + ns.z;
  apiC.add(AN.advGetInv(), 'iron_ore', 2);
  apiC.add(AN.advGetInv(), 'coal', 1);
  globalThis.pos.x = ns.x + 0.5; globalThis.pos.y = 21; globalThis.pos.z = ns.z + 0.5;
  AM.onMouse(0, {x: ns.x, y: 21, z: ns.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(AN.advFurnace.at(), nk, '下界炉键带 n| 前缀');
  AN.advFurnace.autoFill();
  const keys = [...AN.advFurnace.map.keys()];
  assert.ok(keys.includes(fk) && keys.includes(nk), '两界炉态同图共存(键分界不串档)');
  /* 两炉都在烧(热值>0): 人在下界, 只有本界键挂上火焰观感 */
  AM.update(1.0);
  assert.ok(AN.advFurnace.state(fk).heat > 0, '上界炉照烧(MC 口径, 炉 tick 不门禁)');
  assert.ok(AN.advFurnace.state(nk).heat > 0, '下界炉在烧(前提)');
  assert.strictEqual(AN.advFlameCount(), 1, '异界键不挂 Sprite(只本界一束火焰)');
  /* 挖炉满包退料: 余量掉在炉位上方(坐标解析剥 n| 前缀) */
  const inv = AN.advGetInv();
  for (let i = 0; i < apiC.INV_SLOTS; i++) inv.slots[i] = {id: 'cobble', n: 1}; /* 塞满包 */
  AN.advFurnace.drop(nk);
  assert.ok(dropsSpawnedC.some((d) => Math.abs(d.x - (ns.x + 0.5)) < 1e-9 &&
      d.y === 21.5 && Math.abs(d.z - (ns.z + 0.5)) < 1e-9), '退料落点=剥前缀后的炉位上方');
  /* 回上界: 观感清零后本界炉火焰重挂(上界炉没被下界键挤掉) */
  AN.advSetDim('overworld');
  assert.strictEqual(AN.advFlameCount(), 0, '切界清火焰观感');
  AM.update(0.1);
  assert.strictEqual(AN.advFlameCount(), 1, '上界炉火焰重挂(键核销后幸存)');
});

test('C9 树苗界门禁: 下界树苗计时冻结不长树(不串桶), 上界照常 20s 长成', () => {
  freshC();
  AN.advSetDim('nether');
  const entry = {x: 50, y: 21, z: 50, left: 0.01}; /* 差一步到期: 门禁若失效立刻长树 */
  AN.advSaplings.set('50,21,50', entry);
  AM.update(10); /* 远超 20s 计时口径 */
  assert.strictEqual(AN.advSaplings.size, 1, '下界树苗计时冻结(条目不出队)');
  assert.ok(Math.abs(entry.left - 0.01) < 1e-12, '倒计时没推进');
  assert.strictEqual(apiC.getBlock(50, 21, 50), 0, '没长树(否则原木+记账会进 nether 桶——串档事故)');
  /* 对照组: 上界同款条目正常长树(证明冻结来自维度门禁而非其他) */
  AN.advSetDim('overworld');
  const gs = grassSpotC();
  AN.advSaplings.set(gs.x + ',25,' + gs.z, {x: gs.x, y: 25, z: gs.z, left: 0.01});
  AM.update(0.1);
  assert.strictEqual(AN.advSaplings.size, 0, '上界到期出队长树');
  assert.strictEqual(apiC.getBlock(gs.x, 25, gs.z), 5, '树干占位(原木)');
});

test('C10 HUD 下界态: 首行下界横幅, 不显白日/夜历; 上界照旧有时段行', () => {
  freshC();
  AN.advSetDim('nether');
  const lines = AN.advHudLines(null);
  assert.strictEqual(lines[0], '🌌 下界 · 黑漆漆亮晶晶', '下界首行横幅');
  assert.ok(!lines.some((l) => l.indexOf('白天') >= 0 || l.indexOf('夜晚') >= 0), '不显时段(恒夜无日历)');
  assert.ok(!lines.some((l) => l.indexOf('怪物') >= 0), '下界隐怪物行(无怪世界恒 0 徒增困惑)');
  AN.advSetDim('overworld');
  assert.ok(AN.advHudLines(null).some((l) => l.indexOf('白天') >= 0), '上界照旧有时段行');
});

test('C11 KeyH 在下界: 回上界小屋 + 满血(与死亡同语义, 不走门)', () => {
  freshC();
  AN.advSetDim('nether');
  AN.advGetPEnt().hp = 5;
  AM.onKey('KeyH');
  assert.strictEqual(AN.advNetherState().dim, 'overworld', '下界回家先切回上界');
  const sp = lastSpawnC();
  const home = AN.ADV.spawn;
  assert.ok(sp && sp[1] === home.x && sp[3] === home.z, '落小屋出生点');
  assert.strictEqual(AN.ADV.player.hp, AN.ADV.player.maxHp, '回家顺带回满血');
  assert.ok(spokenC.some((s) => s.indexOf('回家') >= 0), '回家话术');
});

test('C12 挖不动话术(微默认3): 门框/门面=魔法做的, 下界岩系=太硬, 其他无 hard 方块静默', () => {
  loadModeFixture();
  assert.strictEqual(AN.advMineHardText(apiC.B_PORTAL), '传送门是魔法做的，挖不动哦');
  assert.strictEqual(AN.advMineHardText(apiC.B_OBSIDIAN), '传送门是魔法做的，挖不动哦');
  assert.strictEqual(AN.advMineHardText(apiC.B_NETHERRACK), '这块石头太硬啦，挖不动哦');
  assert.strictEqual(AN.advMineHardText(apiC.B_GLOWSTONE), '这块石头太硬啦，挖不动哦');
  assert.strictEqual(AN.advMineHardText(apiC.B_NETHER_BRICK), '这块石头太硬啦，挖不动哦');
  assert.strictEqual(AN.advMineHardText(apiC.B_WATER), '', '水等其余无 hard 方块保持静默');
});
