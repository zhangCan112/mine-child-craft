'use strict';
/* 方块级联核心 (js/cascade-core.js) 单测 — node --test (零依赖)
   运行: node --test test/cascade-core.test.js
   手法: config/voxel/scene-kit 经 vm 装真件(树形=真 SceneKit.tree, 确定性),
   policy 用核心自己的 mkPolicy 派生(与 world.js 同一装配, 防两份漂移);
   网格读写直接桥 vm 的 getBlock/setBlockRaw。断言按设计稿速查表逐行:
   砍树底=整树倒 · 砍中段=整树倒(树桩连带 P15) · 挖树脚=整树倒 ·
   双柱桥断一柱仍立(砍桥面不牵柱) · 石头柱不级联(身份原则) · 邻树保护 ·
   手掰单叶不动装饰 · thin 脱落 · 世界底兜底 · 终止性;
   三期 P14 世界卫生清扫: 孤儿叶/悬浮树(互保叶存活)/浮沙/悬空 thin
   治愈 · 干净世界幂等 · 恶意大杂烩不动点终止。 */
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
  const place = (x, y, z, id) => {/* 放置并跑级联(镜像 world.js 放置触发装配, P9) */
    e.setBlockRaw(x, y, z, id);
    return CascadeCore.cascadePlace(e.getBlock, e.setBlockRaw, x, y, z, id, policy);
  };
  return {e, policy, fell, count, fill, place};
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
  assert.strictEqual(p.isFall(8), true, '沙子 = fall 重力方块(二期 D7)');
  assert.strictEqual(p.isFall(5), false, '原木无重力');
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

test('砍树干中段 = 整树倒(树桩连带, P15): 干全清+树冠全清, 与砍底节同形', () => {
  const h = mkH();
  h.fill(18, 1, 18, 22, 1, 22, 2);
  h.e.SceneKit.tree(20, 2, 20);
  const logs = h.count(5, 14, 26, 1, 12, 14, 26);
  const leaves = h.count(7, 14, 26, 1, 12, 14, 26);
  const removed = h.fell(20, 3, 20); /* 第二节 */
  assert.strictEqual(h.count(5, 14, 26, 1, 12, 14, 26), 0,
      '树桩连带倒: 干全清(旧口径留树桩撑起 15~49 片浮空叶——2026-10-24 实测定案)');
  assert.strictEqual(h.count(7, 14, 26, 1, 12, 14, 26), 0, '树冠全清(失去全部支撑)');
  assert.strictEqual(removed.length, logs + leaves - 1, '级联清单 = 整树 - 触发块');
  assert.strictEqual(h.count(2, 18, 22, 1, 1, 18, 22), 25, '泥土地板完好');
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

test('树桩连带(P15)边界: 砍桥面中格不牵柱(脚下非同柱 fell), 桥完好', () => {
  const h = mkH();
  h.fill(10, 1, 20, 24, 1, 24, 2);
  for (let y = 2; y <= 5; y++) {
    h.e.setBlockRaw(12, y, 22, 5);
    h.e.setBlockRaw(20, y, 22, 5);
  }
  for (let x = 13; x <= 19; x++) h.e.setBlockRaw(x, 5, 22, 5); /* 桥面连双柱 */
  const removed = h.fell(16, 5, 22); /* 砍桥面中格: 脚下是空气, 非同柱残段 */
  assert.strictEqual(removed.length, 0, '两半各自经柱接地, 零级联(连带只认同柱, 不横向蔓延)');
  assert.strictEqual(h.count(5, 10, 24, 1, 8, 20, 24), 14, '15-1=14 根全在');
});

test('树桩连带(P15): 独立原木柱砍顶节 = 同柱下方全倒(材料零损失)', () => {
  const h = mkH();
  h.fill(18, 1, 18, 22, 1, 22, 2);
  for (let y = 2; y <= 6; y++) h.e.setBlockRaw(20, y, 20, 5); /* 5 节原木柱 */
  const removed = h.fell(20, 6, 20); /* 砍顶节: 上方无组件, 只有下方同柱连带 */
  assert.strictEqual(removed.length, 4, '同柱 4 节连带(整柱 - 触发块)');
  assert.strictEqual(h.count(5, 14, 26, 1, 12, 14, 26), 0, '柱全清');
  assert.ok(removed.every((r) => r.id === 5 && !r.to), '全部进移除清单(掉落照常, 零损失)');
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
  h.e.setBlockRaw(19, 1, 20, 2); /* 紧邻泥土(触发块非 fell: 树桩连带不触发, 隔离测 y0 接地) */
  const removed = h.fell(19, 1, 20); /* 挖泥土, 触发对邻柱组件的接地重查 */
  assert.strictEqual(removed.length, 0, '柱组件经 y0 接地, 零级联');
  for (let y = 0; y <= 3; y++) assert.strictEqual(h.e.getBlock(20, y, 20), 5, 'y=' + y + ' 原木全留');
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

/* ============ 二期 D7: 沙子重力(fall 旗标 · 移动语义 · 放置触发) ============ */

test('沙柱挖底: 整段下沉一格, moved 条目带 to(原格空+落格得沙)', () => {
  const h = mkH();
  h.fill(18, 0, 18, 22, 1, 22, 2); /* 泥土 y0~y1 */
  for (let y = 2; y <= 4; y++) h.e.setBlockRaw(20, y, 20, 8); /* 沙柱 y2~y4 */
  const removed = h.fell(20, 1, 20); /* 挖掉沙脚下的泥土 */
  assert.strictEqual(h.e.getBlock(20, 4, 20), 0, '段顶 y4 空出');
  for (let y = 1; y <= 3; y++) assert.strictEqual(h.e.getBlock(20, y, 20), 8, '沙柱整体下沉一格 y=' + y);
  assert.strictEqual(removed.length, 3, '三条移动条目');
  assert.ok(removed.every((r) => r.to && r.id === 8), '全部带 to(移动语义, 方块存活)');
  assert.strictEqual(removed[0].to.y, 1, '首条落点=触发格(挖开的洞)');
});

test('落沙砸碎沿途依附块(P10): 沙坠穿火把, 火把进移除清单', () => {
  const h = mkH();
  h.e.setBlockRaw(20, 0, 20, 2); /* 泥土 */
  h.e.setBlockRaw(20, 1, 20, 48); /* 火把(底下是泥土, 布景合法) */
  h.e.setBlockRaw(20, 2, 20, 3); /* 石头 */
  h.e.setBlockRaw(20, 3, 20, 8); /* 沙 */
  const removed = h.fell(20, 2, 20); /* 挖石头 */
  assert.strictEqual(h.e.getBlock(20, 1, 20), 8, '沙落到火把位');
  assert.strictEqual(h.e.getBlock(20, 2, 20), 0);
  assert.ok(removed.some((r) => r.id === 48 && !r.to), '火把被砸碎(移除条目)');
  assert.ok(removed.some((r) => r.id === 8 && r.to), '沙的移动条目');
});

test('落沙穿水(P11): 非支撑可穿, 沉到湖底(落点水格被替换, 静水不回填)', () => {
  const h = mkH();
  h.e.setBlockRaw(20, 0, 20, 2); /* 湖底 */
  for (let y = 1; y <= 3; y++) h.e.setBlockRaw(20, y, 20, 24); /* 水 y1~y3 */
  h.e.setBlockRaw(20, 4, 20, 3); /* 石 */
  h.e.setBlockRaw(20, 5, 20, 8); /* 沙 */
  h.fell(20, 4, 20); /* 挖石头 */
  assert.strictEqual(h.e.getBlock(20, 1, 20), 8, '沙沉到湖底');
  assert.strictEqual(h.e.getBlock(20, 2, 20), 24, '途经水格保留');
  assert.strictEqual(h.e.getBlock(20, 3, 20), 24, '途经水格保留');
  assert.strictEqual(h.e.getBlock(20, 5, 20), 0, '原位空出');
});

test('放置触发(P9): 半空沙即落地; 脚下实心不动; 原木放置零触发(装饰保护)', () => {
  const h = mkH();
  h.e.setBlockRaw(20, 0, 20, 2);
  const moved = h.place(20, 5, 20, 8); /* 半空放沙 */
  assert.strictEqual(moved.length, 1, '一段一条移动');
  assert.strictEqual(h.e.getBlock(20, 1, 20), 8, '落到实地');
  assert.strictEqual(h.e.getBlock(20, 5, 20), 0, '原位空');
  const stay = h.place(20, 2, 20, 8); /* 脚下是沙(实心支撑) */
  assert.strictEqual(stay.length, 0, '叠沙不落');
  assert.strictEqual(h.e.getBlock(20, 2, 20), 8);
  const log = h.place(30, 5, 30, 5); /* 原木放置: 零触发 */
  assert.strictEqual(log.length, 0);
  assert.strictEqual(h.e.getBlock(30, 5, 30), 5, '浮空原木放置即悬空(一期口径不变)');
});

test('沙落牵动上方原木结构(规则④→②连锁): 沙塌后原木失接地整组倒', () => {
  const h = mkH();
  h.e.setBlockRaw(20, 0, 20, 2);
  for (let y = 1; y <= 3; y++) h.e.setBlockRaw(20, y, 20, 8); /* 沙柱 */
  h.e.setBlockRaw(20, 4, 20, 5); /* 原木骑在沙柱上 */
  h.e.setBlockRaw(21, 4, 20, 5); /* 横臂 */
  const removed = h.fell(20, 0, 20); /* 挖掉沙脚下的泥土 */
  assert.ok(removed.some((r) => r.id === 8 && r.to), '沙段下移');
  assert.ok(removed.some((r) => r.id === 5 && !r.to), '原木组件倒(移除条目)');
  assert.strictEqual(h.e.getBlock(20, 4, 20), 0, '原木没了');
  assert.strictEqual(h.e.getBlock(20, 2, 20), 8, '沙落位');
});

test('大沙柱终止性 + 隔空沙段不追认(既有浮空只在扰动时结算)', () => {
  const h = mkH();
  h.e.setBlockRaw(20, 0, 20, 2);
  for (let y = 1; y <= 30; y++) h.e.setBlockRaw(20, y, 20, 8); /* 30 高沙柱 */
  h.e.setBlockRaw(20, 35, 20, 8); /* 隔空浮沙(既有浮空, 与浮空原木同口径) */
  h.fell(20, 0, 20); /* 挖底 */
  for (let y = 0; y <= 29; y++) assert.strictEqual(h.e.getBlock(20, y, 20), 8, '整柱落底 y=' + y);
  for (let y = 30; y <= 34; y++) assert.strictEqual(h.e.getBlock(20, y, 20), 0, '柱顶空 y=' + y);
  assert.strictEqual(h.e.getBlock(20, 35, 20), 8, '隔空浮沙不被追认');
});

/* ============ 三期 D9/P14: 世界卫生清扫(cascadeSweep) — 旧档浮空一次性治愈 ============
 * 级联只由编辑触发(既有浮空不追认)——级联合并前的存档里, 已失撑的浮空块
 * (孤儿冠/悬浮树/浮沙/悬空依附块)永无触发时机, P14 拍板在探险 init 全图治愈。 */

/* 清扫装配(镜像 world.js applySweep: 同一核心 + 同一 policy 派生 + 世界尺寸) */
function sweepWorld(h) {
  return CascadeCore.cascadeSweep(h.e.getBlock, h.e.setBlockRaw, h.policy,
      h.e.WORLD_W, h.e.WORLD_H, h.e.WORLD_D);
}

test('清扫: 孤儿叶团全清(旧档整树砍干) — 清单含全叶, 地面完好', () => {
  const h = mkH();
  h.fill(18, 1, 18, 22, 1, 22, 2);
  h.e.SceneKit.tree(20, 2, 20);
  for (let y = 2; h.e.getBlock(20, y, 20) === 5; y++) h.e.setBlockRaw(20, y, 20, 0); /* 裸写=级联前旧档口径 */
  const leaves = h.count(7, 14, 26, 1, 12, 14, 26);
  assert.ok(leaves >= 40, '布景: 浮空树冠在场, 实际 ' + leaves);
  const removed = sweepWorld(h);
  assert.strictEqual(h.count(7, 14, 26, 1, 12, 14, 26), 0, '孤儿叶全清(依赖早已不在, 永无触发时机)');
  assert.strictEqual(removed.length, leaves, '清单 = 全部孤儿叶');
  assert.ok(removed.every((r) => r.id === 7 && !r.to), '全部是叶的移除条目');
  assert.strictEqual(h.count(2, 18, 22, 1, 1, 18, 22), 25, '泥土地板完好');
});

test('清扫: 悬浮树整棵倒 — 干全移除, 冠重查(邻树互保叶存活, P4 口径不变)', () => {
  const h = mkH();
  h.fill(14, 1, 18, 30, 1, 24, 2);
  h.e.SceneKit.tree(20, 2, 20); /* 接地树 */
  h.e.SceneKit.tree(23, 5, 20); /* 悬浮树: 干基无接地, 冠缘伸进接地树的支撑域 */
  const gLogs = h.count(5, 19, 21, 1, 9, 19, 21); /* 接地树干列 */
  const removed = sweepWorld(h);
  assert.strictEqual(h.count(5, 22, 24, 1, 12, 18, 22), 0, '悬浮树干全移除');
  assert.ok(removed.some((r) => r.id === 5 && !r.to), '悬浮干入移除清单');
  assert.strictEqual(h.count(5, 19, 21, 1, 9, 19, 21), gLogs, '接地树干一根不少');
  assert.ok(h.count(7, 21, 26, 1, 12, 18, 22) > 0, '互保叶残留(悬浮冠靠接地树存活的叶, MC 口径)');
  assert.ok(leavesAllSupported(h, 14, 30, 1, 12, 14, 26), '残余叶全部有原木支撑(不变量)');
});

test('清扫: 悬浮沙下沉(移动语义带 to) + 穿水沉底(P11 口径)', () => {
  const h = mkH();
  h.e.setBlockRaw(20, 0, 20, 2); /* 湖底泥 */
  h.e.setBlockRaw(20, 1, 20, 24); /* 水 */
  h.e.setBlockRaw(20, 5, 20, 8); /* 浮沙(隔空, 下方 y2~4 空气) */
  h.e.setBlockRaw(21, 0, 21, 2);
  for (let y = 3; y <= 4; y++) h.e.setBlockRaw(21, y, 21, 8); /* 浮沙段 y3~4 */
  const removed = sweepWorld(h);
  assert.strictEqual(h.e.getBlock(20, 1, 20), 8, '单沙穿水沉到湖底(替换水格)');
  assert.strictEqual(h.e.getBlock(20, 5, 20), 0, '原位空出');
  assert.strictEqual(h.e.getBlock(21, 1, 21), 8, '沙段落到实地(底)');
  assert.strictEqual(h.e.getBlock(21, 2, 21), 8, '沙段落到实地(顶)');
  assert.strictEqual(h.e.getBlock(21, 3, 21), 0, '段顶空出');
  assert.ok(removed.length === 3 && removed.every((r) => r.id === 8 && r.to), '全部移动条目(带 to)');
});

test('清扫: 悬空 thin 脱落 + 孤儿叶上的火把连锁脱落', () => {
  const h = mkH();
  h.e.setBlockRaw(20, 5, 20, 48); /* 悬空火把(下方空气) */
  h.e.setBlockRaw(30, 6, 30, 7); /* 孤儿叶 */
  h.e.setBlockRaw(30, 7, 30, 48); /* 叶上的火把(叶落它也落) */
  const removed = sweepWorld(h);
  assert.ok(removed.some((r) => r.id === 48 && r.x === 20 && r.y === 5), '悬空火把脱落');
  assert.ok(removed.some((r) => r.id === 7), '孤儿叶清除');
  assert.ok(removed.some((r) => r.id === 48 && r.y === 7), '叶上的火把随叶连锁脱落(规则①)');
  assert.strictEqual(h.count(7, 26, 34, 1, 12, 26, 34), 0, '区域无残留');
});

test('清扫: 干净世界零动作(幂等) — 接地树/地面火把/实地沙全不动', () => {
  const h = mkH();
  h.fill(14, 1, 18, 30, 1, 24, 2);
  h.e.SceneKit.tree(20, 2, 20); /* 接地树 */
  h.e.setBlockRaw(22, 2, 22, 48); /* 地面火把 */
  h.e.setBlockRaw(24, 2, 22, 8); /* 实地沙 */
  const removed = sweepWorld(h);
  assert.deepStrictEqual(removed, [], '零违例 → 零写入(第二次清扫同此, 幂等)');
  assert.deepStrictEqual(sweepWorld(h), [], '二次清扫仍为空');
  assert.strictEqual(h.e.getBlock(22, 2, 22), 48, '火把不动');
  assert.strictEqual(h.e.getBlock(24, 2, 22), 8, '实地沙不下沉');
});

test('清扫: 恶意大杂烩不动点治愈 — 浮树上叠沙/骑沙树连锁, 终止且区域清空', () => {
  const h = mkH();
  h.fill(10, 1, 10, 40, 1, 40, 2); /* 地板 y1 */
  h.e.SceneKit.tree(15, 6, 15); /* 悬浮树A(脚下空气) */
  for (let y = 9; y <= 11; y++) h.e.setBlockRaw(15, y, 15, 8); /* A 树干顶上再叠浮沙(树倒后穿冠落底) */
  h.e.setBlockRaw(35, 8, 35, 8); /* 浮沙 */
  h.e.setBlockRaw(35, 9, 35, 5); /* 骑在浮沙上的原木(沙沉后失接地连锁倒, ④→②) */
  h.e.setBlockRaw(36, 9, 35, 5); /* 与骑沙原木横连的同组件成员 */
  h.e.setBlockRaw(30, 6, 30, 7); /* 孤儿叶 */
  h.e.setBlockRaw(25, 6, 25, 48); /* 悬空火把 */
  const removed = sweepWorld(h); /* 完成本身即终止性证明 */
  assert.ok(removed.length >= 20, '治愈清单非空(原木+叶+移动条目), 实际 ' + removed.length);
  assert.strictEqual(h.count(5, 10, 40, 2, 12, 10, 40), 0, '原木全清(悬浮树+骑沙组件连锁倒)');
  assert.strictEqual(h.count(7, 10, 40, 2, 14, 10, 40), 0, '叶全清(A 树冠+孤儿叶)');
  assert.strictEqual(h.count(8, 10, 40, 2, 12, 10, 40), 4, '4 块沙全部落底(3 叠沙+1 骑位沙)');
  assert.strictEqual(h.e.getBlock(15, 2, 15), 8, '叠沙落底(底节)');
  assert.strictEqual(h.e.getBlock(15, 4, 15), 8, '叠沙落底(顶节)');
  assert.strictEqual(h.e.getBlock(35, 2, 35), 8, '骑位沙落底');
  assert.strictEqual(h.e.getBlock(25, 6, 25), 0, '悬空火把脱落');
  assert.ok(leavesAllSupported(h, 10, 40, 1, 14, 10, 40), '区域叶不变量成立');
});
