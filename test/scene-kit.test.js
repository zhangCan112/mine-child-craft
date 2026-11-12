'use strict';
/* 引擎高度场单测(镜像 js/scene-kit.js, SceneKit.heightAt) — node --test(零依赖)
   运行: node --test test/scene-kit.test.js
   命名偏差登记(conventions §1.9): scene-kit 为 -kit 后缀, 本文件为其直测
   (world-rings 先例); heightAt 是纯函数(不碰 voxel 全局), vm 单文件加载、
   sandbox 只给内建对象 —— 加载器本身即引擎层红线(零 THREE·零 DOM·零玩法
   知识)的活证明。
   覆盖票据 T3(adventure-maps-tickets)验收: 确定性(同参同值+整格阶梯化) ·
   幅度界 ±3 · 压平区归基准 · 全图相邻高差 ≤1(坡度红线) · 每控制格幅度
   参数化(T5 圈层/T4 沙丘的消费者口径)。
   树家族(2026-11-12 六份散装树函数收编票): tree/pine/pineSnowy/scrub 的
   形状·干高域·守卫·确定性断言集中于此; 等价性红线用「旧实现 oracle」对照
   ——下方 oracle 函数逐字转写迁移前的 SceneKit.tree / advPineTree /
   advEdgeNorthSpruce 置换段 / advEdgeEastTree / advEdgeSouthScrub 几何段,
   家族终态必须与 oracle 终态逐字节一致(既有「两次建场逐字节一致」测试
   之外的第二张等价网); 装载前置照 adventure-maps-core.test.js vm 惯例
   (config→voxel→scene-kit, 家族写读体素模型)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSceneKit() {
  /* 只给内建对象: scene-kit.js 顶层声明零外部依赖, heightAt 纯函数
     连 voxel 全局(setBlockRaw/hashRand)都不碰 —— 引擎层分层的活证明 */
  const sandbox = {console: {warn() {}, log() {}, error() {}}, Math, Number};
  const ctx = vm.createContext(sandbox);
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'scene-kit.js'), 'utf8'),
      ctx, {filename: 'scene-kit.js'});
  /* 桥: 词法 const → 外部可访问(camp-kit.test 同款) */
  vm.runInContext('globalThis.__sk = SceneKit;', ctx);
  return {sk: sandbox.__sk};
}

test('幅度界 ±3: 全域 |h| ≤ 3, amp 越界(10)被钳制', () => {
  const {sk} = loadSceneKit();
  for (const opts of [undefined, {}, {salt: 9}, {amp: 10}, {amp: 10, salt: 3}]) {
    for (let x = -64; x <= 256; x += 3) {
      for (let z = -64; z <= 256; z += 3) {
        const h = sk.heightAt(x, z, opts);
        assert.ok(h >= -3 && h <= 3,
            '幅度界红线: (' + x + ',' + z + ') ' + JSON.stringify(opts) + ' → ' + h);
      }
    }
  }
  /* amp 函数返回越界也逐格钳(引擎红线对函数通道同样生效) */
  const big = () => 10;
  for (let x = 0; x < 128; x += 4) {
    for (let z = 0; z < 128; z += 4) {
      const h = sk.heightAt(x, z, {amp: big});
      assert.ok(h >= -3 && h <= 3, 'amp 函数越界钳制: (' + x + ',' + z + ') → ' + h);
    }
  }
  /* amp 可调小: amp=0 全图归零(核心圈平地, T5 消费口径);
     Math.round 可能产 -0, 消费者比较用 === 口径 */
  for (let x = 0; x < 128; x += 5) {
    for (let z = 0; z < 128; z += 5) {
      assert.ok(sk.heightAt(x, z, {amp: 0}) === 0,
          'amp=0 → 平地: (' + x + ',' + z + ')');
    }
  }
});

test('压平区归基准: 圆心邻域回落 base, base 可调, 多圆并集', () => {
  const {sk} = loadSceneKit();
  const flats = [{cx: 100, cz: 100, r: 24}];
  /* 圆心 ±2 的四角控制格点全在圆内(最远 17 < 24) → 双线性精确 base */
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      assert.ok(sk.heightAt(100 + dx, 100 + dz, {flats}) === 0,
          '压平区圆心邻域应归基准 0: (' + (100 + dx) + ',' + (100 + dz) + ') → ' +
          sk.heightAt(100 + dx, 100 + dz, {flats}));
    }
  }
  /* base 可调: 基准抬 2, 圆心邻域跟随(高度场是相对偏移, 消费者加地基) */
  for (let dx = -2; dx <= 2; dx += 2) {
    for (let dz = -2; dz <= 2; dz += 2) {
      assert.ok(sk.heightAt(100 + dx, 100 + dz, {flats, base: 2}) === 2,
          '压平区基准可调: base=2 圆心 → ' +
          sk.heightAt(100 + dx, 100 + dz, {flats, base: 2}));
    }
  }
  /* 多圆并集: 第二个圆心也归基准(遮罩取并集) */
  const two = [{cx: 100, cz: 100, r: 24}, {cx: 208, cz: 48, r: 24}];
  assert.ok(sk.heightAt(208, 48, {flats: two}) === 0, '第二圆心也归基准');
});

test('坡度红线: 全图任意相邻格高差 ≤1(含压平区边缘与负象限)', () => {
  const {sk} = loadSceneKit();
  /* 三场景: 裸场 / 压平圆(边缘斜坡) / 大半径压平(圆内全场为基准) */
  const scenes = [
    {name: '裸场', opts: undefined},
    {name: '压平圆', opts: {flats: [{cx: 130, cz: 130, r: 24}]}},
    {name: '双圆+盐', opts: {salt: 7, flats: [
      {cx: 64, cz: 64, r: 32}, {cx: 200, cz: 40, r: 20},
    ]}},
  ];
  for (const sc of scenes) {
    for (let x = -64; x < 256; x++) {
      for (let z = -64; z < 256; z++) {
        const h = sk.heightAt(x, z, sc.opts);
        const hx = sk.heightAt(x + 1, z, sc.opts);
        const hz = sk.heightAt(x, z + 1, sc.opts);
        assert.ok(Math.abs(hx - h) <= 1,
            sc.name + ' 水平相邻 ≤1: (' + x + ',' + z + ') ' + h + '→' + hx);
        assert.ok(Math.abs(hz - h) <= 1,
            sc.name + ' 垂直相邻 ≤1: (' + x + ',' + z + ') ' + h + '→' + hz);
      }
    }
  }
});

test('每控制格幅度: amp 支持函数 (i,j)=>幅度 — 西平东起伏 + 坡度仍 ≤1', () => {
  const {sk} = loadSceneKit();
  /* 控制格 i<8 幅度 0, i≥8 幅度 3(T5 圈层「核心圈 0 → 深险圈 ±3」口径) */
  const amp = (i) => i >= 8 ? 3 : 0;
  /* 西半场插值只碰控制点 i≤7 → 全平 */
  for (let x = 0; x <= 110; x += 3) {
    for (let z = 0; z < 128; z += 5) {
      assert.ok(sk.heightAt(x, z, {amp}) === 0,
          '西半场幅度 0 应平地: (' + x + ',' + z + ') → ' + sk.heightAt(x, z, {amp}));
    }
  }
  let rugged = 0;
  /* 东半场确有起伏(幅度生效) */
  for (let x = 140; x <= 200; x += 3) {
    for (let z = 0; z < 128; z += 5) {
      if (sk.heightAt(x, z, {amp}) !== 0) rugged++;
    }
  }
  assert.ok(rugged > 0, '东半场幅度 3 应有起伏');
  /* 幅度跳变发生在控制值层面, 插值摊平 → 坡度红线仍立 */
  for (let x = 100; x < 150; x++) {
    for (let z = 0; z < 64; z++) {
      const h = sk.heightAt(x, z, {amp});
      assert.ok(Math.abs(sk.heightAt(x + 1, z, {amp}) - h) <= 1,
          '幅度过渡带相邻 ≤1: (' + x + ',' + z + ')');
    }
  }
});

test('确定性: 同参同值, 整格阶梯化, salt 换地形', () => {
  const {sk} = loadSceneKit();
  let saltDiff = 0;
  for (let x = -40; x <= 200; x += 7) {
    for (let z = -40; z <= 200; z += 5) {
      const a = sk.heightAt(x, z);
      const b = sk.heightAt(x, z);
      assert.strictEqual(a, b, '同参必须同值: (' + x + ',' + z + ')');
      assert.ok(Number.isInteger(a), '整格阶梯化: 输出必须是整数');
      if (sk.heightAt(x, z, {salt: 5}) !== a) saltDiff++;
    }
  }
  assert.ok(saltDiff > 0, '换 salt 应产出不同地形');
});

/* ============ 树家族(2026-11-12 收编票): 装载前置 + 旧实现 oracle ============ */

function loadKitWorld() {/* 家族成员写读体素模型, 照 maps-core 测试的 vm 惯例
    装真引擎件; worldCells 经上下文活引用读快照 */
  const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), eng, {filename: f});
  }
  const api = vm.runInContext(
      '({SceneKit, hashRand, getBlock, setBlockRaw, worldCells, WORLD_W, WORLD_D, WORLD_H})', eng);
  const W = api.WORLD_W; const D = api.WORLD_D;
  return {
    sk: api.SceneKit, hashRand: api.hashRand, getBlock: api.getBlock, setBlockRaw: api.setBlockRaw,
    W, D, H: api.WORLD_H,
    cell: (x, y, z) => api.worldCells[(y * D + z) * W + x],
    snap: () => Buffer.from(api.worldCells),
    clear: () => api.worldCells.fill(0),
  };
}

/* 旧实现 oracle: 逐字转写迁移前源码(2026-11-12 工作区), 只作等价对照基准。
   均无全向守卫(仅东树带单向)——贴缘行为差异归守卫专项测试, 等价位形取界内 */

function oracleTree(h, x, baseY, z) {/* 旧 js/scene-kit.js tree(缺省 hashRand 口径) */
  const th = 4 + Math.floor(h.hashRand(x + 7, z + 3) * 3);
  for (let i = 0; i < th; i++) h.setBlockRaw(x, baseY + i, z, 5);
  const top = baseY + th;
  for (let dy = -1; dy <= 1; dy++) {
    const rad = dy === 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dz = -rad; dz <= rad; dz++) {
        if (dx === 0 && dz === 0 && dy < 1) continue;
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad === 2) continue;
        const lx = x + dx; const ly = top + dy - 1; const lz = z + dz;
        if (h.getBlock(lx, ly, lz) === 0) h.setBlockRaw(lx, ly, lz, 7);
      }
    }
  }
  h.setBlockRaw(x, top, z, 7);
}

function oracleEastTree(h, x, baseY, z, salt) {/* 旧 adventure-core.js advEdgeEastTree
    (盐参数化: 源码写死 8402, 公式同款) */
  const th = 4 + Math.floor(h.sk.rand(x + 7, z + 3, salt) * 3);
  for (let i = 0; i < th; i++) h.setBlockRaw(x, baseY + i, z, 5);
  const top = baseY + th;
  for (let dy = -1; dy <= 1; dy++) {
    const rad = dy === 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dz = -rad; dz <= rad; dz++) {
        if (dx === 0 && dz === 0 && dy < 1) continue;
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad === 2) continue;
        const lx = x + dx; const ly = top + dy - 1; const lz = z + dz;
        if (lx >= h.W) continue; /* 贴边裁冠(界外不写) */
        if (h.getBlock(lx, ly, lz) === 0) h.setBlockRaw(lx, ly, lz, 7);
      }
    }
  }
  h.setBlockRaw(x, top, z, 7);
}

function oraclePine(h, x, baseY, z, salt) {/* 旧 adventure-core.js advPineTree */
  const th = 4 + Math.floor(h.sk.rand(x + 7, z + 3, salt) * 3);
  for (let i = 0; i < th; i++) h.setBlockRaw(x, baseY + i, z, 5);
  const top = baseY + th;
  for (let ly = baseY + 2; ly <= top; ly++) {
    const rad = ly >= top - 1 ? 1 : 2;
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dz = -rad; dz <= rad; dz++) {
        if (dx === 0 && dz === 0 && ly < top) continue; /* 让位树干 */
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad === 2) continue; /* 削角 */
        if (h.getBlock(x + dx, ly, z + dz) === 0) h.setBlockRaw(x + dx, ly, z + dz, 7);
      }
    }
  }
  h.setBlockRaw(x, top + 1, z, 7); /* 顶帽 */
}

function oracleSpruce(h, x, baseY, z, salt, snowLeafId) {/* 旧 adventure-core.js
    advEdgeNorthSpruce 几何段(advPineTree 调用+同式复算 crown+两遍式置换) */
  oraclePine(h, x, baseY, z, salt);
  const crown = baseY + (4 + Math.floor(h.sk.rand(x + 7, z + 3, salt) * 3));
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (h.getBlock(x + dx, crown, z + dz) === 7) h.setBlockRaw(x + dx, crown, z + dz, snowLeafId);
    if (h.getBlock(x + dx, crown - 1, z + dz) === 7) h.setBlockRaw(x + dx, crown - 1, z + dz, snowLeafId);
  }
  h.setBlockRaw(x, crown + 1, z, snowLeafId);
}

function oracleScrub(h, x, top, z, salt) {/* 旧 adventure-core.js advEdgeSouthScrub 几何段 */
  const th = 1 + (h.sk.rand(x, z, salt) > 0.5 ? 1 : 0);
  for (let i = 1; i <= th; i++) h.setBlockRaw(x, top + i, z, 5);
  const cy = top + th + 1; /* 冠心层 */
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && h.sk.rand(x + dx, z + dz, salt + 1) > 0.5) continue;
      if (h.getBlock(x + dx, cy, z + dz) === 0) h.setBlockRaw(x + dx, cy, z + dz, 7);
    }
  }
  if (h.getBlock(x, cy + 1, z) === 0) h.setBlockRaw(x, cy + 1, z, 7); /* 顶心 */
}

test('树家族·圆冠 tree 缺省: 干高域 {4,5}(hashRand 截断)+形状抽样+顶帽; 终态=旧 SceneKit.tree', () => {
  const h = loadKitWorld();
  /* 干高域: hashRand(x+7,z+3) 输出全域截断 <0.5 → th 恒 {4,5}
     (误接 SceneKit.rand 会扩成 {4,5,6}, 多张图建场字节漂移) */
  for (let x = 2; x < h.W - 2; x += 3) {
    for (let z = 2; z < h.D - 2; z += 3) {
      const th = 4 + Math.floor(h.hashRand(x + 7, z + 3) * 3);
      assert.ok(th === 4 || th === 5, '缺省干高恒 {4,5}: (' + x + ',' + z + ') → ' + th);
    }
  }
  /* 终态等价: 多位形逐字节对照旧实现 */
  for (const [x, z] of [[10, 12], [64, 77], [122, 31], [145, 140]]) {
    h.clear(); h.sk.tree(x, 24, z);
    const a = h.snap();
    h.clear(); oracleTree(h, x, 24, z);
    assert.ok(a.equals(h.snap()), '缺省 tree 终态逐字节一致: (' + x + ',' + z + ')');
  }
  /* 形状抽样: 干柱 5 · rad2 冠层削角+让位树干 · rad1 顶冠满 3×3 · 顶帽 7 */
  const x = 64; const z = 77; const baseY = 24;
  const th = 4 + Math.floor(h.hashRand(x + 7, z + 3) * 3);
  h.clear(); h.sk.tree(x, baseY, z);
  for (let i = 0; i < th; i++) assert.strictEqual(h.cell(x, baseY + i, z), 5, '干柱原木');
  assert.strictEqual(h.cell(x, baseY + th, z), 7, '顶帽存在');
  assert.strictEqual(h.cell(x + 2, baseY + th - 2, z + 2), 0, 'rad2 层四角跳过(空场留空)');
  assert.strictEqual(h.cell(x + 2, baseY + th - 2, z), 7, 'rad2 层边中有叶');
  assert.strictEqual(h.cell(x, baseY + th - 2, z), 5, '冠层让位树干(dy<1 中心不写)');
  assert.strictEqual(h.cell(x + 1, baseY + th, z + 1), 7, 'rad1 顶冠角上有叶(不削角)');
});

test('树家族·圆冠 tree 带盐: 干高域 {4,5,6} 且确有 6; 东带锚点(158,·,8402)终态=旧 advEdgeEastTree', () => {
  const h = loadKitWorld();
  let saw6 = false;
  for (let x = 2; x < h.W - 2; x += 5) {
    for (let z = 2; z < h.D - 2; z += 7) {
      const th = 4 + Math.floor(h.sk.rand(x + 7, z + 3, 8402) * 3);
      assert.ok(th >= 4 && th <= 6, '带盐干高域 {4,5,6}: (' + x + ',' + z + ') → ' + th);
      if (th === 6) saw6 = true;
    }
  }
  assert.ok(saw6, '带盐干高确有 6(rand 口径可达, 与缺省截断域区分)');
  /* 东带两株锚点: x=158 贴缘, 冠层 lx=160 界外(旧单向守卫吃掉的位形) */
  for (const z of [40, 108]) {
    h.clear(); h.sk.tree(158, 24, z, 8402);
    const a = h.snap();
    h.clear(); oracleEastTree(h, 158, 24, z, 8402);
    assert.ok(a.equals(h.snap()), '东带锚点终态逐字节一致: (158,' + z + ')');
  }
  /* 界内多位形带盐等价(换盐换位形) */
  for (const [x, z, s] of [[12, 90, 3517], [95, 8, 77], [140, 120, 0]]) {
    h.clear(); h.sk.tree(x, 30, z, s);
    const a = h.snap();
    h.clear(); oracleEastTree(h, x, 30, z, s);
    assert.ok(a.equals(h.snap()), '带盐 tree 终态逐字节一致: (' + x + ',' + z + ',' + s + ')');
  }
});

test('树家族·锥冠 pine: 下宽上尖+顶帽 top+1+空气格才写; 终态=旧 advPineTree', () => {
  const h = loadKitWorld();
  for (const [x, z, s] of [[50, 60, 8122], [21, 33, 0], [130, 90, 77], [8, 140, 8134]]) {
    h.clear(); h.sk.pine(x, 24, z, s);
    const a = h.snap();
    h.clear(); oraclePine(h, x, 24, z, s);
    assert.ok(a.equals(h.snap()), 'pine 终态逐字节一致: (' + x + ',' + z + ',' + s + ')');
  }
  /* 结构: 干柱 · baseY+2 层 rad2 削角+让位 · 顶帽 top+1 */
  const x = 50; const z = 60; const s = 8122; const baseY = 24;
  const th = 4 + Math.floor(h.sk.rand(x + 7, z + 3, s) * 3);
  h.clear(); h.sk.pine(x, baseY, z, s);
  for (let i = 0; i < th; i++) assert.strictEqual(h.cell(x, baseY + i, z), 5, '干柱原木');
  assert.strictEqual(h.cell(x, baseY + th + 1, z), 7, '顶帽在 top+1');
  assert.strictEqual(h.cell(x + 2, baseY + 2, z + 2), 0, '锥底 rad2 削角');
  assert.strictEqual(h.cell(x + 2, baseY + 2, z + 1), 7, '锥底边中有叶');
  assert.strictEqual(h.cell(x, baseY + 2, z), 5, '锥底让位树干');
  /* 空气格才写: 预置占位格不被覆写 */
  h.clear(); h.setBlockRaw(x + 1, baseY + 2, z, 3);
  h.sk.pine(x, baseY, z, s);
  assert.strictEqual(h.cell(x + 1, baseY + 2, z), 3, '占位格保命(空气判据)');
});

test('树家族·覆雪锥冠 pineSnowy: 两遍式置换(四叶×2+顶帽=雪叶恰 9 格, 余叶 7); 终态=旧 spruce 几何段', () => {
  const h = loadKitWorld();
  const SNOW = 63; /* 任意注入 id(引擎不知雪叶常量, 调用方注入缝) */
  for (const [x, z, s] of [[30, 30, 8134], [80, 5, 8122], [150, 150, 42]]) {
    h.clear(); h.sk.pineSnowy(x, 24, z, s, SNOW);
    const a = h.snap();
    h.clear(); oracleSpruce(h, x, 24, z, s, SNOW);
    assert.ok(a.equals(h.snap()), 'pineSnowy 终态逐字节一致: (' + x + ',' + z + ',' + s + ')');
  }
  /* 覆雪位=冠顶 crown 正交四叶+冠肩 crown-1 正交四叶+顶帽, 空场恰 9 格;
     其余叶保持 7(两遍式置换只动读到 7 的正交位+顶帽) */
  const x = 80; const z = 5; const s = 8122; const baseY = 24;
  h.clear(); h.sk.pineSnowy(x, baseY, z, s, SNOW);
  let snowN = 0; let leaf7 = 0;
  for (let y = 0; y < h.H; y++) {
    for (let zz = 0; zz < h.D; zz++) {
      for (let xx = 0; xx < h.W; xx++) {
        const v = h.cell(xx, y, zz);
        if (v === SNOW) snowN++;
        else if (v === 7) leaf7++;
      }
    }
  }
  assert.strictEqual(snowN, 9, '覆雪格恰 9(冠顶四叶+冠肩四叶+顶帽)');
  assert.ok(leaf7 > 0, '余叶保持 7(角叶留绿)');
  /* 同盐同位冠形一致: 雪叶映射回 7 后与 pine 终态逐字节一致 */
  h.clear(); h.sk.pineSnowy(x, baseY, z, s, SNOW);
  const snowy = h.snap();
  for (let i = 0; i < snowy.length; i++) if (snowy[i] === SNOW) snowy[i] = 7;
  h.clear(); h.sk.pine(x, baseY, z, s);
  assert.ok(snowy.equals(h.snap()), '覆雪冠=同盐 pine 冠换 9 格雪叶');
});

test('树家族·矮丛 scrub: 干 1~2+3×3 冠+顶心+角缺省判据; 终态=旧 advEdgeSouthScrub 几何段', () => {
  const h = loadKitWorld();
  for (const [x, z, s] of [[30, 140, 8218], [70, 152, 8221], [120, 135, 5]]) {
    h.clear(); h.sk.scrub(x, 24, z, s);
    const a = h.snap();
    h.clear(); oracleScrub(h, x, 24, z, s);
    assert.ok(a.equals(h.snap()), 'scrub 终态逐字节一致: (' + x + ',' + z + ',' + s + ')');
  }
  /* 结构: 干从 top+1 起 · 冠心 3×3 + 顶心 */
  const x = 44; const z = 148; const s = 8218; const top = 24;
  const th = 1 + (h.sk.rand(x, z, s) > 0.5 ? 1 : 0);
  h.clear(); h.sk.scrub(x, top, z, s);
  for (let i = 1; i <= th; i++) assert.strictEqual(h.cell(x, top + i, z), 5, '矮干原木');
  assert.strictEqual(h.cell(x, top + th + 1, z), 7, '冠心层中心有叶');
  assert.strictEqual(h.cell(x, top + th + 2, z), 7, '顶心存在');
  /* 干高域 {1,2} 两态 + 角缺省两态(角格自身坐标判据)都出现 */
  let t1 = 0; let t2 = 0; let skipped = 0; let kept = 0;
  for (let xx = 2; xx < h.W - 2; xx += 3) {
    for (let zz = 2; zz < h.D - 2; zz += 3) {
      if (h.sk.rand(xx, zz, s) > 0.5) t2++; else t1++;
      for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        if (h.sk.rand(xx + dx, zz + dz, s + 1) > 0.5) skipped++; else kept++;
      }
    }
  }
  assert.ok(t1 > 0 && t2 > 0, '干高 {1,2} 两态都出现');
  assert.ok(skipped > 0 && kept > 0, '角缺省两态都出现(角格坐标 rand 判据)');
  /* 确定性: 同参两次终态一致 */
  h.clear(); h.sk.scrub(x, top, z, s);
  const a = h.snap();
  h.clear(); h.sk.scrub(x, top, z, s);
  assert.ok(a.equals(h.snap()), 'scrub 同参同形');
});

test('树家族·越界守卫: 贴缘种植不回卷(界外格不写, 对侧缘零污染)', () => {
  const h = loadKitWorld();
  /* 非零格必须落在种植位 ±2(矮丛 ±1)邻域内——旧 setBlockRaw 无界检查,
     贴缘冠层的平面数组下标回卷会污染对侧缘(北带 z=1 事故在案) */
  const outsideWrites = (x0, x1, z0, z1) => {
    let n = 0;
    for (let y = 0; y < h.H; y++) {
      for (let z = 0; z < h.D; z++) {
        if (z >= z0 && z <= z1) continue;
        for (let x = 0; x < h.W; x++) {
          if (x >= x0 && x <= x1) continue;
          if (h.cell(x, y, z) !== 0) n++;
        }
      }
    }
    return n;
  };
  const cases = [
    ['tree 缺省', (x, z) => h.sk.tree(x, 24, z), 2],
    ['tree 带盐', (x, z) => h.sk.tree(x, 24, z, 8402), 2],
    ['pine', (x, z) => h.sk.pine(x, 24, z, 11), 2],
    ['pineSnowy', (x, z) => h.sk.pineSnowy(x, 24, z, 11, 63), 2],
    ['scrub', (x, z) => h.sk.scrub(x, 24, z, 8218), 1],
  ];
  for (const [name, plant, r] of cases) {
    for (const [x, z] of [[0, 80], [h.W - 1, 80], [80, 0], [80, h.D - 1]]) {
      h.clear();
      plant(x, z);
      assert.strictEqual(outsideWrites(x - r, x + r, z - r, z + r), 0,
          name + ' 贴缘 (' + x + ',' + z + ') 界外零写入');
    }
  }
  /* 工单口径直证: 贴东缘(x=W-1)种 pine → x=0 列零写入 */
  h.clear(); h.sk.pine(h.W - 1, 24, 80, 11);
  let westCol = 0;
  for (let y = 0; y < h.H; y++) {
    for (let z = 0; z < h.D; z++) {
      if (h.cell(0, y, z) !== 0) westCol++;
    }
  }
  assert.strictEqual(westCol, 0, '贴东缘种 pine: x=0 列零写入(旧实现回卷事故位)');
});

test('树家族·确定性: 同参两次独立建场, 全图逐字节一致', () => {
  const h = loadKitWorld();
  const plantForest = () => {
    h.clear();
    h.sk.tree(20, 24, 20); h.sk.tree(60, 24, 90); h.sk.tree(120, 24, 30, 8402);
    h.sk.pine(40, 24, 40, 8122); h.sk.pine(100, 24, 130, 8134);
    h.sk.pineSnowy(70, 24, 70, 8135, 63);
    h.sk.scrub(30, 24, 140, 8218); h.sk.scrub(140, 24, 60, 8221);
  };
  plantForest();
  const a = h.snap();
  plantForest();
  assert.ok(a.equals(h.snap()), '同参两次建场终态逐字节一致');
  assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
});
