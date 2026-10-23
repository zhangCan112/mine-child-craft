'use strict';
/* 方块级联核心 (js/cascade-core.js) 单测 — node --test (零依赖)
   运行: node --test test/cascade-core.test.js
   手法: config/voxel/scene-kit 经 vm 装真件(树形=真 SceneKit.tree, 确定性),
   policy 用核心自己的 mkPolicy 派生(与 world.js 同一装配, 防两份漂移);
   网格读写直接桥 vm 的 getBlock/setBlockRaw。断言按设计稿速查表逐行:
   砍树底=整树倒 · 砍中段=上倒下留 · 挖树脚=整树倒 · 双柱桥断一柱仍立 ·
   石头柱不级联(身份原则) · 邻树保护 · 手掰单叶不动装饰 · thin 脱落 ·
   世界底兜底 · 终止性。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CascadeCore = require('../js/cascade-core.js');

function loadEng() {
  const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['config.js', 'voxel.js', 'scene-kit.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  return vm.runInContext(`globalThis.__e = {
    BLOCKS, getBlock, setBlockRaw, SceneKit, WORLD_W, WORLD_H, WORLD_D,
  }; __e;`, ctx);
}

/* 每测试一世界: 级联只在破坏后触发, fresh vm 天然隔离(无跨测试残留) */
function mkH() {
  const e = loadEng();
  const policy = CascadeCore.mkPolicy(e.BLOCKS);
  const fell = (x, y, z) => {/* 破坏一格并跑级联(镜像 world.js applyCascade 装配) */
    const old = e.getBlock(x, y, z);
    if (old === 0) return [];
    e.setBlockRaw(x, y, z, 0);
    return CascadeCore.cascadeRemove(e.getBlock, e.setBlockRaw, x, y, z, old, policy);
  };
  const count = (id, x1, x2, y1, y2, z1, z2) => {
    let n = 0;
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) {
        for (let x = x1; x <= x2; x++) if (e.getBlock(x, y, z) === id) n++;
      }
    }
    return n;
  };
  const fill = (x1, y1, z1, x2, y2, z2, id) => {
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) {
        for (let x = x1; x <= x2; x++) e.setBlockRaw(x, y, z, id);
      }
    }
  };
  return {e, policy, fell, count, fill};
}

/* 每片残余树叶 4 格内必有原木(need 存活不变量, 世界完整性扫描的同款判据) */
function leavesAllSupported(h, x1, x2, y1, y2, z1, z2) {
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        if (h.e.getBlock(x, y, z) !== 7) continue;
        let ok = false;
        for (let dy = -4; dy <= 4 && !ok; dy++) {
          for (let dz = -4; dz <= 4 && !ok; dz++) {
            for (let dx = -4; dx <= 4; dx++) {
              if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 4) continue;
              if (h.e.getBlock(x + dx, y + dy, z + dz) === 5) {
                ok = true; break;
              }
            }
          }
        }
        if (!ok) return false;
      }
    }
  }
  return true;
}

/* ============ mkPolicy: 真实 BLOCKS 派生(旗标即白名单) ============ */

test('mkPolicy: 身份判定从 config 真件派生 — fell/need/thin/support 逐项', () => {
  const h = mkH();
  const p = h.policy;
  assert.strictEqual(p.isFell(5), true, '原木 = fell 结构成员');
  assert.strictEqual(p.isFell(6), false, '木板不参与(原木房子承重墙不受牵连, 设计稿 D1)');
  assert.strictEqual(p.isFell(3), false, '石头无旗标');
  assert.strictEqual(p.isThin(48), true, '火把 = thin 依附块');
  assert.strictEqual(p.isThin(7), false, '树叶是整块');
  assert.strictEqual(p.needOf(7).id, 5, '树叶依赖原木');
  assert.strictEqual(p.needOf(7).dist, 4, 'taxicab 4(BE 口径, 设计稿 P4)');
  assert.strictEqual(p.needOf(5), null, '原木无 need 规则');
  assert.strictEqual(p.isSupport(48), false, 'thin 族不承重');
  assert.strictEqual(p.isSupport(7), true, '树叶实心可承重(MC 口径)');
  assert.strictEqual(p.isSupport(24), false, '水面不承重');
  assert.strictEqual(p.isSupport(1), true, '草地承重');
  assert.strictEqual(p.needRules.length, 1, 'need 规则表恰一条(树叶)');
});

/* ============ 设计稿速查表逐行 ============ */

test('砍树底一节 = 整树倒: 干+叶全清, 地面完好(本次 bug 的直接修复)', () => {
  const h = mkH();
  h.fill(18, 1, 18, 22, 1, 22, 2); /* 泥土地板 y=1 */
  h.e.SceneKit.tree(20, 2, 20);
  const logs = h.count(5, 14, 26, 1, 12, 14, 26);
  const leaves = h.count(7, 14, 26, 1, 12, 14, 26);
  assert.ok(logs >= 4 && logs <= 6, '树干 4~6 节, 实际 ' + logs);
  assert.ok(leaves >= 40, '树冠 ~49 叶, 实际 ' + leaves);
  const removed = h.fell(20, 2, 20);
  assert.strictEqual(h.count(5, 14, 26, 1, 12, 14, 26), 0, '树干全清(无树桩)');
  assert.strictEqual(h.count(7, 14, 26, 1, 12, 14, 26), 0, '树冠全清');
  assert.strictEqual(removed.length, logs + leaves - 1, '级联清单 = 整树 - 触发块');
  assert.strictEqual(h.count(2, 18, 22, 1, 1, 18, 22), 25, '泥土地板完好');
});

test('砍树干中段 = 上段倒, 树桩留(接地判定, 非位置启发式)', () => {
  const h = mkH();
  h.fill(18, 1, 18, 22, 1, 22, 2);
  h.e.SceneKit.tree(20, 2, 20);
  h.fell(20, 3, 20); /* 第二节 */
  assert.strictEqual(h.e.getBlock(20, 2, 20), 5, '树桩接地留下');
  for (let y = 4; y <= 9; y++) {
    assert.notStrictEqual(h.e.getBlock(20, y, 20), 5, 'y=' + y + ' 上方原木已倒');
  }
  /* 残余树叶只可能是树桩 4 格内的(MC 口径: 叶离原木 ≤4 存活) */
  assert.ok(leavesAllSupported(h, 14, 26, 1, 12, 14, 26), '残余叶全部有原木支撑(不变量)');
});

test('挖掉树脚下的泥土 = 整树倒(身份原则: 结构失去接地, 设计稿 P5)', () => {
  const h = mkH();
  h.fill(18, 1, 18, 22, 1, 22, 2);
  h.e.SceneKit.tree(20, 2, 20);
  const removed = h.fell(20, 1, 20); /* 挖的是树脚的泥土, 不是原木 */
  assert.strictEqual(h.count(5, 14, 26, 1, 12, 14, 26), 0, '整树倒');
  assert.ok(removed.length >= 40, '级联含干+叶, 实际 ' + removed.length);
});

test('双柱桥: 断一柱仍立(他柱接地), 两柱全断整体倒', () => {
  const h = mkH();
  h.fill(10, 1, 20, 24, 1, 24, 2);
  for (let y = 2; y <= 5; y++) {
    h.e.setBlockRaw(12, y, 22, 5);
    h.e.setBlockRaw(20, y, 22, 5);
  }
  for (let x = 13; x <= 19; x++) h.e.setBlockRaw(x, 5, 22, 5); /* 桥面连双柱 */
  const total = h.count(5, 10, 24, 1, 8, 20, 24);
  assert.strictEqual(total, 15, '布景: 双柱 4+4 + 桥面 7 = 15 根原木');
  assert.strictEqual(h.fell(12, 2, 22).length, 0, '断柱1基: 柱2 仍接地, 整桥不倒');
  assert.strictEqual(h.count(5, 10, 24, 1, 8, 20, 24), total - 1, '只少了触发块');
  h.fell(20, 2, 22); /* 再断柱2基 */
  assert.strictEqual(h.count(5, 10, 24, 1, 8, 20, 24), 0, '两柱全断: 整体倒');
});

test('身份原则: 石头柱挖底不级联(无旗标, 在哪挖都不塌——地下隧道安全的根)', () => {
  const h = mkH();
  h.fill(18, 1, 18, 22, 1, 22, 2);
  for (let y = 2; y <= 6; y++) h.e.setBlockRaw(20, y, 20, 3); /* 石头柱 */
  assert.strictEqual(h.fell(20, 2, 20).length, 0, '石头无 fell 旗标, 零级联');
  for (let y = 3; y <= 6; y++) assert.strictEqual(h.e.getBlock(20, y, 20), 3, '石柱悬空但不动');
});

test('邻树保护: 砍倒一棵, 邻树干/叶一根不少(4 格内有自己的原木)', () => {
  const h = mkH();
  h.fill(10, 1, 10, 40, 1, 30, 2);
  h.e.SceneKit.tree(15, 2, 20);
  h.e.SceneKit.tree(30, 2, 20); /* 相距 15, 冠不交叠 */
  const keepLogs = h.count(5, 27, 33, 1, 12, 17, 23);
  const keepLeaves = h.count(7, 27, 33, 1, 12, 17, 23);
  assert.ok(keepLogs >= 4 && keepLeaves >= 40, '布景: 邻树立在');
  h.fell(15, 2, 20);
  assert.strictEqual(h.count(5, 9, 21, 1, 12, 17, 23), 0, '近树全倒');
  assert.strictEqual(h.count(5, 27, 33, 1, 12, 17, 23), keepLogs, '邻树原木一根不少');
  assert.strictEqual(h.count(7, 27, 33, 1, 12, 17, 23), keepLeaves, '邻树叶一片不少');
});

test('手掰单叶不动装饰叶团(need 只认原木距离, 叶落不链发)', () => {
  const h = mkH();
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 2; dx++) h.e.setBlockRaw(50 + dx, 30 + dy, 50, 7); /* 浮空装饰叶团 */
  }
  const removed = h.fell(50, 30, 50); /* 掰最底那片 */
  assert.strictEqual(removed.length, 0, '零级联');
  assert.strictEqual(h.e.getBlock(51, 30, 50), 7, '其余装饰叶原样');
});

test('thin 依附块随底座脱落: 火把/树苗(草丛/麦同款旗标)', () => {
  const h = mkH();
  h.e.setBlockRaw(20, 1, 20, 1); /* 草地 */
  h.e.setBlockRaw(20, 2, 20, 48); /* 火把 */
  h.e.setBlockRaw(22, 1, 22, 2); /* 泥土 */
  h.e.setBlockRaw(22, 2, 22, 50); /* 树苗 */
  const removed = h.fell(20, 1, 20);
  assert.strictEqual(removed.length, 1, '只有火把脱落');
  assert.strictEqual(removed[0].id, 48);
  assert.strictEqual(h.e.getBlock(22, 2, 22), 50, '树苗底座没动, 树苗还在');
  const removed2 = h.fell(22, 1, 22);
  assert.strictEqual(removed2.length, 1, '树苗随泥土底座脱落');
  assert.strictEqual(removed2[0].id, 50);
});

test('世界底兜底: y=0 的原木视为接地(防挖穿世界底雪崩)', () => {
  const h = mkH();
  for (let y = 0; y <= 3; y++) h.e.setBlockRaw(20, y, 20, 5); /* 直抵世界底, 下方无地板 */
  h.fell(20, 2, 20);
  assert.strictEqual(h.e.getBlock(20, 0, 20), 5, 'y0 接地留下');
  assert.strictEqual(h.e.getBlock(20, 1, 20), 5, 'y1 连着 y0 留下');
  assert.strictEqual(h.e.getBlock(20, 3, 20), 0, 'y3 失接地倒了');
});

test('终止性: 浮空原木墙挖一中格整墙倒(定点迭代必终止, 数量精确)', () => {
  const h = mkH();
  for (let y = 10; y <= 17; y++) {
    for (let x = 10; x <= 30; x++) h.e.setBlockRaw(x, y, 12, 5); /* 21×8 浮空墙 */
  }
  const removed = h.fell(20, 13, 12);
  assert.strictEqual(removed.length, 21 * 8 - 1, '整墙 - 触发块全倒');
  assert.strictEqual(h.count(5, 10, 30, 1, 20, 12, 12), 0, '无残留');
});
