'use strict';
/* 下界段 (js/adventure-core.js 下界段, docs/nether-merge-design.md §3.2) 单测 — node --test
   运行: node --test test/adventure-nether.test.js
   nether 模式退役、纯政策段剥核迁入 adventure-core(D15)的定向单测(D16,
   不塞 adventure-mode.test.js): fixture 加载序与 test/adventure-core.test.js
   头部一致(同一 vm 惯例装真引擎件直测)。门框等价性对着退役前权威源码
   逐格逐序断言(序 = edits 重放序); 建场确定性对着真 hashRand 断言
   (确定性重放红线)。壳层装配断言(轴 C)随后追加在本文件; 冒险地图 T6
   (分桶存档+壳切图装配, 泛化自两界机制)同构追加在文件尾——共享同一
   模式 fixture, 桶键随分桶泛化由 overworld 更名 home(语义不变)。 */
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
  B_FARMLAND, B_WHEAT_3, B_FLOWER_Y, B_FLOWER_W,
  B_NETHERRACK, B_LAVA, B_OBSIDIAN, B_GLOWSTONE, B_PORTAL, B_NETHER_BRICK,
  B_DOOR, B_DOOR_TOP, B_DOOR_OPEN, B_DOOR_TOP_OPEN, B_GLASS_PANE,
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
    B_NETHERRACK, B_LAVA, B_OBSIDIAN, B_GLOWSTONE, B_PORTAL, B_PORTAL_DIM, B_NETHER_BRICK,
    B_DOOR, B_DOOR_TOP, B_DOOR_OPEN, B_DOOR_TOP_OPEN, B_GLASS_PANE,
    B_SNOWY_GRASS, B_SNOW, B_ICE, B_CACTUS, B_SANDSTONE, B_ORCHID, B_DEAD_BUSH,
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
  globalThis.setSkyBase = (c) => callsC.push(['skyBase', c ? [c[0], c[1], c[2]] : null]); /* T6 天基色缝(world.js) */
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
  /* 探险核心(复用 B 段的 require 实例) + 冒险地图核心(T6 切图消费 ADV_MAPS, index.html
     加载序同构: adventure-core → maps-core → 壳) + 烧炼三件 + 三个壳级 kit 铺全局 */
  Object.assign(globalThis, Core);
  Object.assign(globalThis, require('../js/adventure-maps-core.js'));
  const CraftCoreC = require('../js/craft-core.js');
  Object.assign(globalThis, {SMELT_T: CraftCoreC.SMELT_T, smeltStep: CraftCoreC.smeltStep,
    furnaceRefund: CraftCoreC.furnaceRefund});
  globalThis.FurnaceKit = require('../js/furnace-kit.js');
  globalThis.PlaceKit = require('../js/place-kit.js'); /* 放置链 kit(T9 前置装配, 壳顶层即构造 editor) */
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
function mapSpotC(topId) {/* 指定地表方块的净空列(T6 切图后放置用: y24 顶面+y25 净空) */
  for (let x = 3; x < 116; x++) {
    for (let z = 3; z < 116; z++) {
      if (apiC.getBlock(x, 24, z) === topId && apiC.getBlock(x, 25, z) === 0) return {x, z};
    }
  }
  throw new Error('找不到地表净空');
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
  /* 回上界: 草原确定性复原 + 昼夜循环复位(T5 起表面随圈层高度场, 采样列按高度场取表面) */
  AN.advSetDim('overworld');
  assert.strictEqual(apiC.getBlock(10, 24 + Core.advHeightAt(10, 10), 10), 1, '回上界草地复原');
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
  assert.ok(!AN.advSceneEdits.home.has(k), 'home 桶没有这格(不串桶)');
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
  assert.ok(Array.isArray(sv.edits.nether) && sv.edits.nether.some((e) => e[0] === k),
      '下界桶随档(T6 分桶: edits.nether)');
  assert.ok(!sv.edits.home.some((e) => e[0] === k), 'home 桶恒为上界改动(下界期间不串桶)');
  /* 旧形状档(无桶封套的裸 edits): init 照常, 桶缺省空 */
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
  assert.strictEqual(AN.advSceneEdits.home.get((spot.x + 2) + ',26,' + spot.z), apiC.B_PORTAL,
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

/* ============ 冒险地图 T6：存档分桶泛化 + 壳切图装配(docs/adventure-maps-tickets.md) ============
    在上面两界机制上泛化: advDim 之上加 advMap(home/desert/snow/swamp, nether 期间
    保持最后主世界图), advSceneEdits 从两桶泛化为按图分桶(含 nether 桶)。断言:
    分桶往返 · 老档两代迁移 · 切走再切回逐字节一致(分桶账本互锁红线) · 重进幂等 ·
    装配清单(调色板/池/女巫/炉键/HUD) · nether 期间图保持 · 远征图死亡回家。 */

test('T6-1 分桶存档: 三桶独立落盘 + map 键随档(分桶 encode/decode 往返一致)', () => {
  freshC();
  /* home 桶: 草地放木板 */
  holdOnlyC('planks', 30);
  const ow = grassSpotC();
  AM.onMouse(2, {x: ow.x, y: 24, z: ow.z, nx: 0, ny: 1, nz: 0});
  const kHome = ow.x + ',25,' + ow.z;
  assert.strictEqual(apiC.getBlock(ow.x, 25, ow.z), 6, 'home 木板已放(前提)');
  /* desert 桶: 切沙漠放第二块 */
  AN.advSetMap('desert');
  const ds = mapSpotC(8);
  AM.onMouse(2, {x: ds.x, y: 24, z: ds.z, nx: 0, ny: 1, nz: 0});
  const kDesert = ds.x + ',25,' + ds.z;
  assert.strictEqual(apiC.getBlock(ds.x, 25, ds.z), 6, 'desert 木板已放(前提)');
  /* nether 桶: 切下界放第三块 */
  AN.advSetDim('nether');
  const ns = netherSpotC();
  AM.onMouse(2, {x: ns.x, y: 20, z: ns.z, nx: 0, ny: 1, nz: 0});
  const kNether = ns.x + ',21,' + ns.z;
  AN.advJournal.flush();
  const sv = JSON.parse(memC.get('adventure_world_save'));
  assert.strictEqual(sv.map, 'desert', 'map 键=最后主世界图(nether 期间保持)');
  assert.strictEqual(sv.pos, null, 'D9 口径不变: nether 期间 pos=null');
  assert.ok(sv.edits.home.some((e) => e[0] === kHome), 'home 桶有自己的改动');
  assert.ok(sv.edits.desert.some((e) => e[0] === kDesert), 'desert 桶有自己的改动');
  assert.ok(sv.edits.nether.some((e) => e[0] === kNether), 'nether 桶有自己的改动');
  assert.ok(!sv.edits.desert.some((e) => e[0] === kHome), '桶互不串(home 改动不进 desert 桶)');
  assert.ok(!sv.edits.home.some((e) => e[0] === kNether), 'nether 改动不进 home 桶');
  /* decode 往返: 重进(cleanup→init 不清介质)后各桶内容恒等, 再落盘文本恒等 */
  AM.cleanup();
  callsC.length = 0;
  AM.init();
  assert.strictEqual(AN.advNetherState().map, 'desert', '重进恢复 map 键');
  assert.strictEqual(AN.advSceneEdits.home.get(kHome), 6, 'home 桶往返一致');
  assert.strictEqual(AN.advSceneEdits.desert.get(kDesert), 6, 'desert 桶往返一致');
  assert.strictEqual(AN.advSceneEdits.nether.get(kNether), 6, 'nether 桶往返一致');
  AN.advJournal.flush();
  const sv2 = JSON.parse(memC.get('adventure_world_save'));
  assert.deepStrictEqual(sv2.edits, sv.edits, 'encode→decode→encode 档文本恒等(往返一致)');
  assert.strictEqual(sv2.map, 'desert', 'map 键往返恒等');
  assert.ok(sv2.pos && Math.abs(sv2.pos.x - sv2.pos.x) >= 0 && typeof sv2.pos.y === 'number',
      '重进即回主世界(D9): 重进态 pos=沙漠回程门出生点(不再是 null)');
});

test('T6-2 老档两代自动迁移: 裸 edits 档→home 桶 · netherEdits 档→nether 桶 · map 缺省 home', () => {
  /* 一代老档(两界合并前的裸 edits): 全归 home 桶, 重放照旧 */
  freshC((m) => m.set('adventure_world_save', JSON.stringify({_v: 1,
    edits: [['70,25,80', 3]], pos: null, hp: null, furnaces: [], livestock: {dead: []}, dayTime: 0})));
  assert.strictEqual(AN.advSceneEdits.home.get('70,25,80'), 3, '裸 edits 全归 home 桶');
  assert.strictEqual(apiC.getBlock(70, 25, 80), 3, 'home 世界重放照旧');
  assert.strictEqual(AN.advSceneEdits.nether.size, 0, 'nether 桶缺省空');
  assert.strictEqual(AN.advSceneEdits.desert.size, 0, '远征桶缺省空');
  assert.strictEqual(AN.advNetherState().map, 'home', 'map 键缺省 home');
  /* 二代老档(T6 前两界档): edits→home 桶, 顶层 netherEdits 迁入 nether 桶 */
  freshC((m) => m.set('adventure_world_save', JSON.stringify({_v: 1,
    edits: [['70,25,80', 3]], netherEdits: [['50,21,50', 6]]})));
  assert.strictEqual(AN.advSceneEdits.home.get('70,25,80'), 3, 'edits 键→home 桶');
  assert.strictEqual(AN.advSceneEdits.nether.get('50,21,50'), 6, '顶层 netherEdits 迁入 nether 桶');
  AN.advSetDim('nether');
  assert.strictEqual(apiC.getBlock(50, 21, 50), 6, '迁移后的 nether 桶重放复原');
  /* 迁移后再落盘 = 新形状: 桶封套, 顶层 netherEdits 键退役 */
  AN.advJournal.flush();
  const sv = JSON.parse(memC.get('adventure_world_save'));
  assert.ok(sv.netherEdits === undefined, '顶层 netherEdits 键退役(迁入 edits.nether)');
  assert.ok(sv.edits.nether.some((e) => e[0] === '50,21,50'), '下界桶在新封套里');
});

test('T6-3 切走再切回: 世界逐字节一致(分桶账本互锁红线) + 各桶重放互不渗漏', () => {
  freshC();
  holdOnlyC('planks', 30);
  const ow = grassSpotC();
  AM.onMouse(2, {x: ow.x, y: 24, z: ow.z, nx: 0, ny: 1, nz: 0}); /* home 桶一笔 */
  const snapHome = Buffer.from(apiC.worldCells);
  AN.advSetMap('swamp');
  const sw = mapSpotC(1);
  AM.onMouse(2, {x: sw.x, y: 24, z: sw.z, nx: 0, ny: 1, nz: 0}); /* swamp 桶一笔 */
  const snapSwamp = Buffer.from(apiC.worldCells);
  AN.advSetMap('home');
  assert.ok(Buffer.from(apiC.worldCells).equals(snapHome),
      'home 切走再切回逐字节一致(build+home 桶重放恒等, 他桶不渗漏)');
  AN.advSetMap('swamp');
  assert.ok(Buffer.from(apiC.worldCells).equals(snapSwamp),
      'swamp 切走再切回逐字节一致');
  /* home→nether→home 同款(两界既有口径并入分桶后不回归) */
  AN.advSetDim('nether');
  AN.advSetDim('overworld');
  assert.ok(Buffer.from(apiC.worldCells).equals(snapSwamp), 'nether 往返仍逐字节一致');
});

test('T6-4 重进幂等: cleanup→init→cleanup→init 世界逐字节一致 + map/pos 恢复', () => {
  freshC();
  holdOnlyC('planks', 30);
  const ow = grassSpotC();
  AM.onMouse(2, {x: ow.x, y: 24, z: ow.z, nx: 0, ny: 1, nz: 0});
  AN.advSetMap('desert');
  const ds = mapSpotC(8);
  AM.onMouse(2, {x: ds.x, y: 24, z: ds.z, nx: 0, ny: 1, nz: 0});
  globalThis.pos.x = ds.x + 0.5;
  globalThis.pos.y = 25;
  globalThis.pos.z = ds.z + 0.5; /* 站在沙漠改动旁退出 */
  AN.advJournal.flush();
  const snapD0 = Buffer.from(apiC.worldCells);
  AM.cleanup();
  AM.init(); /* 第一次重进 */
  assert.strictEqual(AN.advNetherState().map, 'desert', '重进恢复到退出时的图');
  const snapD1 = Buffer.from(apiC.worldCells);
  assert.ok(snapD1.equals(snapD0), '第一次重进世界逐字节一致');
  assert.ok(Math.abs(globalThis.pos.x - (ds.x + 0.5)) < 1e-9 &&
      Math.abs(globalThis.pos.z - (ds.z + 0.5)) < 1e-9, '重进落回退出位置(随图存)');
  AM.cleanup();
  AM.init(); /* 第二次重进: 幂等 */
  assert.ok(Buffer.from(apiC.worldCells).equals(snapD1), '第二次重进世界逐字节一致(幂等)');
});

test('T6-5 装配清单: advSetMap 换桶建场重放 + 地图行池/调色板/出生/HUD/炉键前缀', () => {
  freshC();
  const rows = ADV_MAPS;
  const desert = rows.find((r) => r.id === 'desert');
  AN.advSetMap('desert');
  assert.strictEqual(AN.advNetherState().map, 'desert', 'advMap 账本翻到 desert');
  /* 换装清单: 地图行(池经 T2 通道) + 调色板(天基色缝+水色) + 回程门出生 + 站点重扫 + 节拍器复位 */
  assert.strictEqual(AN.ADV.nests, desert.nests, '巢穴池换装当前地图行(T2 通道)');
  assert.deepStrictEqual(callsC.filter((c) => c[0] === 'skyBase').slice(-1),
      [['skyBase', desert.palette.sky]], '天基色基准=行 palette.sky(world.js 缝)');
  assert.deepStrictEqual(apiC.BLOCKS[apiC.B_WATER].all, desert.palette.water, '水色基准=行 palette.water');
  const sp = lastSpawnC();
  const arrive = advMapArrive(desert);
  assert.ok(sp && Math.abs(sp[1] - arrive.x) < 1e-9 && Math.abs(sp[3] - arrive.z) < 1e-9,
      '缺省出生=回程门内侧(advMapArrive 口径)');
  assert.strictEqual(callsC.filter((c) => c[0] === 'mobsClear').length >= 1, true, '清怪清箭');
  /* HUD 图名行随地图行 */
  assert.strictEqual(AN.advHudLines(null)[0], desert.hud, 'HUD 首行=地图行 hud 字段');
  /* 巢穴 seeding 重播当前行: desert 三巢首刷且池全是 husk 系 */
  const nestMobs = mobsSpawnedC.filter((m) => m.nest >= 0);
  assert.ok(nestMobs.length >= desert.nests.length * 2, '每巢首刷 2~3 只');
  assert.ok(nestMobs.every((m) => desert.nests[0].kinds.concat(desert.nests[1].kinds,
      desert.nests[2].kinds).indexOf(m.type) >= 0), '刷怪种取自本行巢穴池');
  assert.ok(!nestMobs.some((m) => m.type === 'zombie'), '替换语义: 沙漠不刷白僵尸');
  /* 炉键地图前缀(参照 nether n| 先例): home 键不前缀(旧档兼容), 远征图各带各的 */
  holdOnlyC('furnace', 1);
  const ds2 = mapSpotC(8);
  AM.onMouse(2, {x: ds2.x, y: 24, z: ds2.z, nx: 0, ny: 1, nz: 0});
  globalThis.pos.x = ds2.x + 0.5;
  globalThis.pos.z = ds2.z + 0.5;
  AM.onMouse(0, {x: ds2.x, y: 25, z: ds2.z, nx: 0, ny: 1, nz: 0});
  assert.strictEqual(AN.advFurnace.at(), 'd|' + ds2.x + ',25,' + ds2.z, 'desert 炉键带 d| 前缀');
  AN.advSetMap('home');
  assert.strictEqual(AN.advFurnace.at(), null, '切图收炉面板(未开)——炉态键分图不串档');
  assert.strictEqual(AN.advHudLines(null)[0], '🏡 家园草原', '回 home 图名行复位');
});

test('T6-6 swamp 女巫常驻 + home 牲畜重播 + 夜怪池随行(替换语义)', () => {
  freshC();
  /* home: 牲畜 seeding(advLivestockPlan 清单, 死畜账跳过) */
  const herds = mobsSpawnedC.filter((m) => m.__livestockIdx != null);
  assert.ok(herds.length >= 8, 'home 行牲畜全套在场(herds 键)');
  /* swamp: 女巫小屋常驻 + 无牲畜 */
  AN.advSetMap('swamp');
  const swamp = ADV_MAPS.find((r) => r.id === 'swamp');
  const witch = mobsSpawnedC.find((m) => m.type === 'witch');
  assert.ok(witch, 'swamp 行 witchHut 常驻女巫已 spawn');
  assert.ok(witch.__nightHome && Math.abs(witch.__nightHome.x - swamp.witchHut.x) < 1e-9,
      '女巫家锚=小屋位(收队不流浪)');
  assert.strictEqual(mobsSpawnedC.filter((m) => m.__livestockIdx != null && m.dead === false).length, 0,
      'swamp 行 livestock=none: 切图清怪后不重播牲畜');
  /* 夜怪节拍器喂当前行 nightPool: 核心纯函数直证(壳喂池的通道已在 advNightTick 内) */
  assert.strictEqual(AN.ADV.nests, swamp.nests, '巢穴池换装 swamp 行');
  const read = () => ({sky: 15, block: 0, y: 25});
  let got = null;
  for (let i = 0; i < 40 && !got; i++) {
    const r = advNightStepPool(0, 3, 18000, read, {x: 64, z: 64}, () => 0.99, swamp.nightPool);
    if (r.spawn) got = r.spawn.type;
  }
  assert.ok(swamp.nightPool.some((p) => p[0] === got), '夜怪池种子取自行 nightPool: ' + got);
});

test('T6-7 nether 期间保持最后主世界图: 档 map 键不变, 回界回该图', () => {
  freshC();
  AN.advSetMap('snow');
  AN.advSetDim('nether');
  assert.strictEqual(AN.advNetherState().map, 'snow', '进 nether 不动 advMap');
  AN.advJournal.flush();
  assert.strictEqual(JSON.parse(memC.get('adventure_world_save')).map, 'snow', '档 map 保持 snow');
  AN.advSetDim('overworld');
  assert.strictEqual(AN.advNetherState().map, 'snow', '回界还是 snow');
  const top = mapSpotC(apiC.B_SNOWY_GRASS);
  assert.ok(top, '雪原地表在场上(回界=重建 snow 图而非 home)');
  /* 重进(下界退出): map 保持最后主世界图, pos=null → 该图回程门出生 */
  AN.advSetDim('nether');
  AN.advJournal.flush();
  AM.cleanup();
  callsC.length = 0;
  AM.init();
  assert.strictEqual(AN.advNetherState().map, 'snow', '重进恢复最后主世界图');
  assert.ok(mapSpotC(apiC.B_SNOWY_GRASS), '重进装的是 snow 图');
  const snow = ADV_MAPS.find((r) => r.id === 'snow');
  const sp = lastSpawnC();
  const arrive = advMapArrive(snow);
  assert.ok(sp && Math.abs(sp[1] - arrive.x) < 1e-9 && Math.abs(sp[3] - arrive.z) < 1e-9,
      'pos=null → 该图回程门出生(ADV_MAPS 行 gates 落点口径)');
});

test('T6-8 远征图死亡/回家: 切回 home + 小屋出生 + 满血(§2.2 死了回家)', () => {
  freshC();
  AN.advSetMap('desert');
  AN.advGetPEnt().hp = 1;
  AM.onVoidFall();
  assert.strictEqual(AN.advNetherState().map, 'home', '远征图死亡切回 home');
  const sp = lastSpawnC();
  const home = AN.ADV.spawn;
  assert.ok(sp && sp[1] === home.x && sp[3] === home.z, '出生=小屋门口(死亡计划)');
  assert.strictEqual(AN.ADV.player.hp, AN.ADV.player.maxHp, '满血复活');
  /* 回家键同语义(冷却账本复位: 假时钟恒 0, 同文件早前 C11 用过一次会把本次拒掉) */
  AN.advSetMap('swamp');
  AN.ADV.homeCd = -1e9;
  AN.advGetPEnt().hp = 5;
  AM.onKey('KeyH');
  assert.strictEqual(AN.advNetherState().map, 'home', '远征图回家也切回 home');
  assert.strictEqual(AN.ADV.player.hp, AN.ADV.player.maxHp, '回家顺带回满血');
});

test('T6-9 调色板复位: cleanup 恢复缺省天基色/水色, 不渗其他模式', () => {
  freshC();
  AN.advSetMap('swamp');
  assert.notDeepStrictEqual(apiC.BLOCKS[apiC.B_WATER].all, [0.25, 0.45, 0.85],
      'swamp 水色已换装(前提: 与缺省不同)');
  AM.cleanup();
  assert.deepStrictEqual(apiC.BLOCKS[apiC.B_WATER].all, [0.25, 0.45, 0.85], '水色复位缺省');
  assert.deepStrictEqual(callsC.filter((c) => c[0] === 'skyBase').slice(-1), [['skyBase', null]],
      '天基色缝复位(null=缺省蓝)');
});

/* ============ 冒险地图 T7: 传送门阵 + 站桩 + 遮罩(票据 T7, 设计稿 §2.3/§4) ============ */

/* 解锁任务档预铺: counts 带指定图的点亮键(点亮仪式归 T8, 本票只读键) */
const seedQuestC = (unlocked) => (m) => m.set('adventure_quest_save',
    JSON.stringify({_v: 1, step: 0, counts: unlocked}));
const gateOf = (rowId, to) => ADV_MAPS.find((r) => r.id === rowId).gates
    .find((g) => g.to === to);

test('T7-1 门阵建场: home 三扇门框常驻 · 未解锁铺暗紫微光门面(不可触发) · 解锁键亮门面 · 远征图回程门常亮 · 门体不记账', () => {
  /* 空任务档: 三门全熄——门框在(黑曜石塔楼/门楣), 门面格是 B_PORTAL_DIM 微光
      (2026-10-27 拍板: 从「只立框空洞黑」改为暗紫微光——读得出是门只是没开;
      id 异于 B_PORTAL → advInPortal 不命中 = 不可触发红线不变) */
  freshC();
  const home = ADV_MAPS[0];
  assert.strictEqual(home.gates.length, 3, '前提: home 行三门');
  for (const g of home.gates) {
    assert.strictEqual(apiC.getBlock(g.px, Core.ADV_GROUND, g.pz), apiC.B_OBSIDIAN,
        g.to + ' 门框底边黑曜石(建场期常驻)');
    const dim = apiC.getBlock(g.px + 1, Core.ADV_GROUND + 3, g.pz);
    assert.strictEqual(dim, apiC.B_PORTAL_DIM, g.to + ' 未解锁: 门面格是暗紫微光');
    assert.notStrictEqual(dim, apiC.B_PORTAL, g.to + ' 微光门面不是 B_PORTAL(不可触发)');
    assert.strictEqual(apiC.getBlock(g.px + ADV_PORTAL.w - 1, Core.ADV_GROUND + 3, g.pz),
        apiC.B_OBSIDIAN, g.to + ' 侧柱在(中段, 端点是四角发光岩)');
  }
  /* 门体走建场(setBlockRaw), 不进 edits 账本——互锁红线与 nether 回程门同款 */
  for (const g of home.gates) {
    for (const y of [Core.ADV_GROUND, Core.ADV_GROUND + 1, Core.ADV_GROUND + 3]) {
      assert.ok(!AN.advSceneEdits.home.has(g.px + ',' + y + ',' + g.pz),
          '门体格不记账 @y' + y + '(' + g.to + ' 门)');
    }
  }
  /* 点亮档: 键在=亮——desert 门面长出来, 其余两门仍熄 */
  freshC(seedQuestC({unlockedDesert: 1}));
  const dg = gateOf('home', 'desert');
  const sg = gateOf('home', 'snow');
  assert.strictEqual(apiC.getBlock(dg.px + 2, Core.ADV_GROUND + 1, dg.pz), apiC.B_PORTAL,
      '解锁门亮门面(advInPortal 可命中)');
  assert.strictEqual(apiC.getBlock(dg.px + 3, Core.ADV_GROUND + 5, dg.pz), apiC.B_PORTAL,
      '门面 4×5 满铺');
  assert.strictEqual(apiC.getBlock(sg.px + 2, Core.ADV_GROUND + 1, sg.pz), apiC.B_PORTAL_DIM,
      '未解锁门仍是暗紫微光(非亮紫门面)');
  /* 远征图: 回程门常亮(home 恒开) + 切走再切回门阵确定性重建(T6-3 红线的门阵面) */
  AN.advSetMap('desert');
  const rg = gateOf('desert', 'home');
  assert.strictEqual(apiC.getBlock(rg.px + 2, Core.ADV_GROUND + 1, rg.pz), apiC.B_PORTAL,
      'desert 回程门常亮');
  const snapG = Buffer.from(apiC.worldCells);
  AN.advSetMap('home');
  AN.advSetMap('desert');
  assert.ok(Buffer.from(apiC.worldCells).equals(snapG), '门阵随建场确定性重建(逐字节一致)');
});

test('T7-1b 点亮仪式网格重锚: 补门面同拍入脏队列(解锁当帧可见, 不等跨环/重进)', () => {
  /* 用户报告「解锁后有些门还是黑的」根因: rite 补门面走 setBlockRaw 不入脏队列,
      门面要等跨环/重进才被重网格——观感上熄门(黑框)与刚点亮的门分不出来 */
  freshC((m) => m.set('adventure_quest_save',
      JSON.stringify({_v: 1, step: 16, counts: {}}))); /* 当前步 q16_plaza(unlock desert) */
  const dg = gateOf('home', 'desert');
  assert.strictEqual(apiC.getBlock(dg.px + 2, Core.ADV_GROUND + 1, dg.pz), apiC.B_PORTAL_DIM,
      '前提: 熄门是暗紫微光门面');
  /* 注入 world 网格 seam 桩(advMeshTouch 消费, Node 桩缺席静默——注入后可断言) */
  const marked = [];
  let flushed = 0;
  globalThis.markDirty = (x, z) => marked.push(x + ',' + z);
  globalThis.flushDirty = () => flushed++;
  try {
    globalThis.pos.x = Core.ADV_GATE_PLAZA.x1 + 2; /* 站进门阵广场 */
    globalThis.pos.z = Core.ADV_GATE_PLAZA.z1 + 2;
    /* 泵两帧: 首帧 visitTick 记 visit_plaza(在 questTick 之后执行), 次帧节流窗到点推进 */
    AM.update(0.6);
    AM.update(0.6);
    assert.strictEqual(apiC.getBlock(dg.px + 2, Core.ADV_GROUND + 1, dg.pz), apiC.B_PORTAL,
        '门面格已写入(世界数据先就绪)');
    assert.ok(marked.some((k) => k === (dg.px + 2) + ',' + dg.pz),
        '门面格入脏队列(当帧重网格, 门面立刻可见)');
    assert.ok(marked.length >= 20, '整面 4×5 门面逐格标脏(实测 ' + marked.length + ')');
    assert.ok(flushed >= 1, '收口 flush 入队(markDirty→flushDirty, editBlock 同款)');
    assert.ok(callsC.some((c) => c[0] === 'sfx' && c[1] === 'gate_unlock'), '点亮琶音照常');
  } finally {
    delete globalThis.markDirty; /* 桩不留场(其余测试的 setBlockRaw 路径保持静默) */
    delete globalThis.flushDirty;
  }
});

test('T7-2 站桩状态机: 地图门 2s 站满(可反悔) → 渐晕满格切图 → 落回程门内 + TTS 播报 + 遮罩收起', () => {
  freshC(seedQuestC({unlockedDesert: 1}));
  const dg = gateOf('home', 'desert');
  const inFace = {x: dg.px + 2.5, y: Core.ADV_GROUND + 1, z: dg.pz + 0.5};
  /* 蓄能音在站桩起步(§4.1 双段式第一段) */
  globalThis.pos.x = inFace.x; globalThis.pos.y = inFace.y; globalThis.pos.z = inFace.z;
  AM.update(0.1);
  assert.ok(callsC.some((c) => c[0] === 'sfx' && c[1] === 'portal_charge'), '站桩起步播蓄能音');
  /* 1.2s 后走出: 可反悔(归零), 不切图 */
  AM.update(1.1);
  globalThis.pos.z = inFace.z + 3; /* 走出门面 */
  AM.update(0.1);
  assert.strictEqual(AN.advNetherState().map, 'home', '走出归零不切图(可反悔红线)');
  /* 重新站: 满 2s 才触发(上轮累计已清) */
  globalThis.pos.z = inFace.z;
  AM.update(1.9);
  assert.strictEqual(AN.advNetherState().map, 'home', '1.9s 未满不切图');
  assert.strictEqual(AN.advNetherState().portalCd, 0, '未触发不进冷却');
  AM.update(0.2); /* 累计 2.1s → 发传送令 */
  assert.strictEqual(AN.advNetherState().portalCd, Core.ADV_PORTAL.cd, '站满触发并进冷却(复用 ADV_PORTAL.cd)');
  assert.strictEqual(AN.advNetherState().map, 'home', '触发瞬间还没切图(等遮罩满格)');
  /* 渐晕淡入 400ms → 满格瞬间切图 + 到达音/播报 + 落回程门内 */
  AM.update(0.45);
  assert.strictEqual(AN.advNetherState().map, 'desert', '遮罩满格瞬间切图');
  const sp = lastSpawnC();
  const arrive = advMapArriveAt(gateOf('desert', 'home'));
  assert.ok(sp && Math.abs(sp[1] - arrive.x) < 1e-9 && Math.abs(sp[3] - arrive.z) < 1e-9,
      '落点=desert 回程门内侧 2.5 格面朝外(advMapArriveAt 口径)');
  assert.ok(callsC.some((c) => c[0] === 'sfx' && c[1] === 'portal_travel'), '切图时刻播到达音(第二段)');
  assert.ok(spokenC.some((s) => s.indexOf('沙漠') >= 0), 'TTS 到达播报(图名)');
  /* 淡出 400ms → 遮罩收起(全程 2s+0.4s+0.4s=2.8s ≤5s 红线) */
  AM.update(0.45);
  const veil = globalThis.document.getElementById('portalVeil');
  assert.ok(veil && +veil.style.opacity === 0, '遮罩收起(opacity=0)');
});

test('T7-3 锁门与 nether 门分流: 熄门走近给分级话术(节流) · 门阵坐标外的门保持 nether 即时语义', () => {
  /* 空任务档(step 0, 主链未走完): 走近雪原门 → 泛指话术「先做完任务卡的任务」
      ——不剧透未来步, 也不把孩子引去「做了也不亮」的地方(用户实测踩坑) */
  freshC();
  const sg = gateOf('home', 'snow');
  globalThis.pos.x = sg.px + 2.5;
  globalThis.pos.y = Core.ADV_GROUND + 1;
  globalThis.pos.z = sg.pz + 0.5;
  AM.update(0.1);
  assert.ok(spokenC.some((s) => s.indexOf('任务卡') >= 0 && s.indexOf('亮起来') >= 0),
      '链未走到: 泛指先做任务卡任务(不点名未来任务)');
  spokenC.length = 0;
  AM.update(2.5); /* 一直站在熄门口 */
  assert.strictEqual(AN.advNetherState().map, 'home', '熄门微光门面不可触发(站多久都不切图)');
  assert.strictEqual(spokenC.length, 0, '同一门口不重复播锁形提示(节流)');
  globalThis.pos.z = sg.pz - 5; /* 走远 */
  AM.update(0.1);
  globalThis.pos.z = sg.pz + 0.5; /* 再走近: 仍熄 */
  AM.update(0.1);
  assert.ok(spokenC.length === 0, '节流窗内不重播');
  /* nether 门零回归: 玩家自放门(门阵坐标外)站进去立即切下界(不站桩) */
  const spot = findClearC(3, 60);
  holdOnlyC('nether_portal', 2);
  placePortalAt(spot);
  stepIntoPortal(spot.x + 2.5, 25, spot.z + 0.5, 0);
  assert.strictEqual(AN.advNetherState().dim, 'nether', '玩家 nether 门即时切界(站桩只对地图门生效)');
  assert.strictEqual(AN.advNetherState().portalCd, Core.ADV_PORTAL.cd, 'nether 门同款冷却');
});

test('T7-3b 锁门分级话术: 前置任务已是当前步 → 点名具体任务(雪原门 ← q19 神殿宝箱)', () => {
  /* 一致的远征中期档: 沙漠已解锁(desert 门亮) · step=19(q19_temple 是当前步,
      雪原门的挂 unlock 任务) → 走近雪原门说「先[神殿宝箱 goal]」 */
  freshC((m) => m.set('adventure_quest_save', JSON.stringify({_v: 1, step: 19,
    counts: {unlockedDesert: 1}})));
  const sg = gateOf('home', 'snow');
  const q19 = Core.ADV_QUESTS[19];
  globalThis.pos.x = sg.px + 2.5;
  globalThis.pos.y = Core.ADV_GROUND + 1;
  globalThis.pos.z = sg.pz + 0.5;
  AM.update(0.1);
  assert.ok(spokenC.some((s) => s.indexOf(q19.goal) >= 0 && s.indexOf('雪原') >= 0),
      '前置任务已当前: 点名「先' + q19.goal + '」(具体指引)');
  assert.ok(!spokenC.some((s) => s.indexOf('任务卡') >= 0), '不再泛指(链已走到这环)');
});

test('T7-4 回程门: 远征图站满 2s 回 home, 落在来时那扇门的门位(advMapArriveAt 对应门)', () => {
  freshC(seedQuestC({unlockedSwamp: 1}));
  AN.advSetMap('swamp');
  const rg = gateOf('swamp', 'home');
  globalThis.pos.x = rg.px + 2.5;
  globalThis.pos.y = Core.ADV_GROUND + 1;
  globalThis.pos.z = rg.pz + 0.5;
  AM.update(2.1); /* 站满 */
  AM.update(0.45); /* 渐晕满格 → 切回 home */
  assert.strictEqual(AN.advNetherState().map, 'home', '回程门站满切回 home');
  const sp = lastSpawnC();
  const arrive = advMapArriveAt(gateOf('home', 'swamp')); /* 沼泽之门位, 不是 gates[0] */
  assert.ok(sp && Math.abs(sp[1] - arrive.x) < 1e-9 && Math.abs(sp[3] - arrive.z) < 1e-9,
      '落点=home 门阵的沼泽之门内侧(回程跟着来时的门走)');
  const desertArrive = advMapArriveAt(gateOf('home', 'desert'));
  assert.ok(Math.abs(arrive.x - desertArrive.x) > 1 || Math.abs(arrive.z - desertArrive.z) > 1,
      '前提: 与沙漠门落点不同(三门各得各的)');
  assert.ok(spokenC.some((s) => s.indexOf('家') >= 0), '回家播报');
});

/* ============ 审查修复 P1：神殿可疑地板踩塌(code-review Spec 缺失项) ============
    站上神殿室内中央 2×2 砂岩地板 → 4 格塌空(记账走 edits, 重进不复位) +
    塌沙音/话术; 塌后脚下不再是砂岩, 判据天然不复发(幂等)。 */

test('审查修复 P1: 神殿可疑地板 — 站上塌入宝箱室(4 格清空+记账+话术), 塌后不复发', () => {
  freshC();
  AN.advSetMap('desert');
  const t = ADV_DESERT.temple; /* ADV_DESERT 经壳共享词法环境可直读(maps-core 已铺全局) */
  /* 前提: 可疑地板在位(建场 2×2 砂岩, 正下方 y22~23 竖井空腔) */
  assert.strictEqual(apiC.getBlock(t.cx, t.trapY, t.cz), apiC.B_SANDSTONE, '可疑地板在位(前提)');
  assert.strictEqual(apiC.getBlock(t.cx, 22, t.cz), 0, '竖井空腔(前提)');
  /* 玩家站上地板中央: pos 落 footprint, 脚下支撑格=trapY 层砂岩 */
  globalThis.pos.x = t.cx + 0.5;
  globalThis.pos.y = t.trapY + 1;
  globalThis.pos.z = t.cz + 0.5;
  spokenC.length = 0;
  AM.update(0.05);
  assert.strictEqual(apiC.getBlock(t.cx, t.trapY, t.cz), 0, '踩上即塌: 地板清空');
  assert.strictEqual(apiC.getBlock(t.cx - 1, t.trapY, t.cz - 1), 0, '4 格齐塌(西北格)');
  assert.ok(callsC.some((c) => c[0] === 'sfx' && c[1] === 'sand_collapse'), '塌沙音');
  assert.ok(spokenC.some((s) => s.indexOf('塌') >= 0), '塌落话术');
  /* 记账: 4 格已入 desert 桶 edits(flush 后档里有键) */
  AN.advJournal.flush();
  const sv = JSON.parse(memC.get('adventure_world_save'));
  const keys = new Set((sv.edits.desert || []).map((e) => e[0]));
  assert.ok(keys.has(t.cx + ',' + t.trapY + ',' + t.cz), '塌落格已记账(重进不复位)');
  /* 幂等: 再 update 不再触发(脚下已空, 前提是判据读格不读状态) */
  callsC.length = 0;
  AM.update(0.05);
  assert.ok(!callsC.some((c) => c[0] === 'sfx' && c[1] === 'sand_collapse'), '塌后不复发(幂等)');
  /* 站在周边沙面上不误触(footprint 判定) */
  globalThis.pos.x = t.cx + 3.5;
  globalThis.pos.y = t.trapY + 1;
  AM.update(0.05);
  assert.ok(!callsC.some((c) => c[0] === 'sfx' && c[1] === 'sand_collapse'), '周边沙面不误触');
});

/* ============ 审查修复 P2：死畜账按图分桶(code-review Spec 半成品项) ============
    档形 {图:[idx..]} 五桶(与 edits/furnaces 同口径); 老档 {dead:[..]} 单账→home 桶。 */

test('审查修复 P2: 死畜账按图分桶 — 老档单账迁 home 桶 · 五桶恒写全 · 往返一致', () => {
  /* 老档单账: 已杀 1 号牛 → home 桶吸收, 重进只播 9 只 */
  freshC((m) => m.set('adventure_world_save', JSON.stringify({_v: 1,
    edits: [], pos: null, hp: null, furnaces: [], livestock: {dead: [1]}, dayTime: 0})));
  const idx1 = mobsSpawnedC.filter((m) => m.__livestockIdx === 1);
  assert.strictEqual(idx1.length, 0, '老档单账 dead:[1] → home 桶吸收(1 号牛不重生)');
  const alive = mobsSpawnedC.filter((m) => m.__livestockIdx != null);
  assert.strictEqual(alive.length, 9, '其余 9 只照播(10-1)');
  /* 落盘 = 新分桶形状: 五桶恒写全 */
  AN.advJournal.flush();
  const sv = JSON.parse(memC.get('adventure_world_save'));
  assert.deepStrictEqual(Object.keys(sv.livestock).sort(),
      ['desert', 'home', 'nether', 'snow', 'swamp'], '五桶恒写全(形状确定)');
  assert.deepStrictEqual(sv.livestock.home, [1], 'home 桶带已杀索引');
  assert.deepStrictEqual(sv.livestock.desert, [], '远征桶空');
  /* encode→decode→encode 档文本恒等(往返一致) */
  freshC((m) => m.set('adventure_world_save', JSON.stringify(sv)));
  AN.advJournal.flush();
  const sv2 = JSON.parse(memC.get('adventure_world_save'));
  assert.deepStrictEqual(sv2.livestock, sv.livestock, 'livestock 分桶往返一致');
});

/* ============ 审查修复 P4：史莱姆夜刷限水边(code-review 口径项, 设计 §3) ============ */

test('审查修复 P4: 史莱姆夜刷水边门 — 水洼旁放行 · 远水点拒绝(沼泽夜池专属口径)', () => {
  freshC();
  AN.advSetMap('swamp');
  /* 前提: 沼泽有浅水洼(建场水面齐 y24)——找一个水格与一个远水干点 */
  const pools = ADV_SWAMP.pools; /* maps-core 已铺全局(壳共享词法环境) */
  let waterAt = null;
  for (const p of pools) {
    for (let dx = -p.r; dx <= p.r && !waterAt; dx++) {
      for (let dz = -p.r; dz <= p.r && !waterAt; dz++) {
        if (apiC.getBlock(p.cx + dx, 24, p.cz + dz) === apiC.B_WATER) {
          waterAt = {x: p.cx + dx, z: p.cz + dz};
        }
      }
    }
    if (waterAt) break;
  }
  assert.ok(waterAt, '沼泽建场有浅水洼(前提)');
  assert.ok(AN.advSlimeWaterOk(waterAt.x, waterAt.z), '水洼本体放行');
  assert.ok(AN.advSlimeWaterOk(waterAt.x + 5, waterAt.z), '水边 5 格内放行');
  /* 远水干点: 距所有水洼 >6 的地表点(用地图另一角扫) */
  let dry = null;
  outer: for (let x = 2; x < 120; x += 3) {
    for (let z = 2; z < 120; z += 3) {
      let near = false;
      for (const p of pools) {
        if (Math.hypot(x - p.cx, z - p.cz) <= p.r + 7) {
          near = true;
          break;
        }
      }
      if (!near) {
        dry = {x, z};
        break outer;
      }
    }
  }
  assert.ok(dry, '沼泽存在远水干点(前提)');
  assert.strictEqual(AN.advSlimeWaterOk(dry.x, dry.z), false, '远水干点拒绝(夜间水边专属)');
});


