'use strict';
/* 体验馆供给核心 (js/showroom-core.js) 单测 — node --test (零依赖)
   运行: node --test test/showroom-core.test.js
   守门线(docs/showroom-design.md §7 D3 派生不复制):
   ① 套餐形状: 行 {id,n} ≤27 行 · 全 id ∈ ITEMS · n=stackMax · 无重复;
   ② 同步不变量(核心): 从套餐背包出发, RECIPES 每条配方 canCraft 全绿
     ——「所有条件都满足」的可执行表达; 溢出行(若有)由套餐+补箱全覆盖;
   ③ 仓库箱: 五桶 = ITEMS 全集的划分(不漏不重) · 每箱 ≤27 行 · 首中归桶
     抽样(log→烧炼·燃料 / 生肉→食物 / 工具→工具·耗损 / 火把→方块·功能 /
     门→材料杂物) · 溢出行并入首只「套餐补箱」, 无溢出则无补箱;
   ④ 展品: = 可放置方块物品 − 站点件(独立重算对拍) · 注册序确定。
   vm 装真三核心(items/inventory/craft)+config(展品排除要 B_* 常数),
   Node 侧 require 被测核心, 其自由标识符经 globalThis 解析到 vm 真件
   (showroom-mode.test 同款手法)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/config.js', 'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({ITEMS, stackMax, isTool, durOf, mkInventory, add, count,
  canCraft, shapeCost, costEntry, RECIPES, SMELTS, FUEL, INV_SLOTS,
  B_CRAFT, B_FURNACE, B_CHEST, B_BED})`, eng);
Object.assign(globalThis, api); /* 被测核心经全局名消费 vm 真件 */

const Core = require('../js/showroom-core.js');
const coreSrc = fs.readFileSync(path.join(ROOT, 'js', 'showroom-core.js'), 'utf8');

/* ============ ① 套餐形状 ============ */

test('供给核心: 套餐形状 — 行 {id,n} · ≤27 行 · 全 id ∈ ITEMS · n=stackMax · 无重复', () => {
  const p = Core.showroomPocket();
  assert.ok(Array.isArray(p.rows) && p.rows.length > 0, '套餐非空');
  assert.ok(p.rows.length <= api.INV_SLOTS,
      '套餐行数 ≤ ' + api.INV_SLOTS + '(一行一槽装包预算): ' + p.rows.length);
  const ids = new Set();
  for (const row of p.rows) {
    assert.ok(row && typeof row.id === 'string' && Number.isInteger(row.n) && row.n >= 1,
        '行形状 {id, n}: ' + JSON.stringify(row));
    assert.ok(Object.prototype.hasOwnProperty.call(api.ITEMS, row.id),
        '套餐 id ∈ ITEMS: ' + row.id);
    assert.strictEqual(row.n, api.stackMax(row.id), 'n=堆叠上限(一行一槽装满): ' + row.id);
    assert.ok(!ids.has(row.id), '无重复: ' + row.id);
    ids.add(row.id);
  }
});

/* ============ ② 同步不变量: 全配方可合成 ============ */

test('供给核心: 同步不变量 — 套餐背包出发, RECIPES 每条配方 canCraft 全绿(站点门禁放开)', () => {
  const p = Core.showroomPocket();
  const inv = api.mkInventory();
  for (const row of p.rows) {
    assert.strictEqual(api.add(inv, row.id, row.n), 0,
        '套餐一行一槽装满 ⇒ 零余量入包: ' + row.id);
  }
  for (const r of api.RECIPES) {
    const check = api.canCraft(inv, r, true);
    assert.ok(check.ok, '配方可合成: ' + r.id + ' 缺 ' + JSON.stringify(check.missing));
  }
});

test('供给核心: 套餐+溢出 = 全配方材料并集(预算溢出不丢材料, 进补箱)', () => {
  const p = Core.showroomPocket();
  const have = new Set();
  for (const row of p.rows) have.add(row.id);
  for (const row of p.overflow) have.add(row.id);
  const need = new Set();
  for (const r of api.RECIPES) {
    for (const [key, val] of Object.entries(api.shapeCost(r))) {
      const e = api.costEntry(key, val);
      if (e) for (const c of e.cands) need.add(c);
    }
  }
  for (const id of need) assert.ok(have.has(id), '材料漏备: ' + id);
});

/* ============ ③ 仓库箱: 全集划分 ============ */

test('供给核心: 仓库箱 — 五桶划分 ITEMS 全集(不漏不重) · 每箱 ≤27 行', () => {
  const crates = Core.showroomCrateRows([]);
  const seen = new Map(); // id → 箱题
  for (const crate of crates) {
    assert.ok(crate.rows.length > 0, '空箱不建: ' + crate.title);
    assert.ok(crate.rows.length <= api.INV_SLOTS, '箱 ≤27 行: ' + crate.title);
    for (const row of crate.rows) {
      assert.ok(!seen.has(row.id), '一物一箱(划分不重): ' + row.id);
      seen.set(row.id, crate.title);
      assert.strictEqual(row.n, api.stackMax(row.id), '数量=堆叠上限: ' + row.id);
    }
  }
  for (const id of Object.keys(api.ITEMS)) {
    assert.ok(seen.has(id), '划分不漏: ' + id + ' (' + (seen.get(id) || '未归箱') + ')');
  }
  assert.ok(crates.length >= 5, '五个字段桶齐备(当前表五桶全非空): ' + crates.length);
});

test('供给核心: 首中归桶抽样 — 字段优先级决定两性物归属', () => {
  const crates = Core.showroomCrateRows([]);
  const of = (id) => crates.find((c) => c.rows.some((r) => r.id === id)).title;
  assert.match(of('pick_wood'), /工具/, '工具 → 工具·耗损箱');
  assert.match(of('lantern'), /工具/, '可耗损物(灯笼 dur) → 工具·耗损箱');
  assert.match(of('raw_beef'), /食物/, '生肉可吃可烧 → 食物箱(food 先于烧炼)');
  assert.match(of('log'), /烧炼/, '原木可烧可放 → 烧炼·燃料箱(SMELTS 先于 block)');
  assert.match(of('torch'), /方块/, '火把 → 方块·功能箱');
  assert.match(of('door'), /杂物/, '结构物品(无 block 字段) → 材料杂物箱兜底');
  assert.match(of('string'), /杂物/, '材料 → 材料杂物箱');
});

test('供给核心: 套餐溢出并入首只「套餐补箱」, 无溢出则无补箱', () => {
  const p = Core.showroomPocket();
  const withOverflow = Core.showroomCrateRows(p.overflow);
  if (p.overflow.length) {
    assert.strictEqual(withOverflow[0].title, '套餐补箱', '溢出行进首箱');
    assert.deepStrictEqual(withOverflow[0].rows, p.overflow, '补箱内容=溢出行');
  } else {
    assert.notStrictEqual(withOverflow[0].title, '套餐补箱', '无溢出无补箱');
  }
  assert.deepStrictEqual(Core.showroomCrateRows([]), Core.showroomCrateRows([]),
      '同参同结果(纯函数, 表静态)');
});

/* ============ ④ 展品清单 ============ */

test('供给核心: 展品 = 可放置方块物品 − 站点件(独立重算对拍, 注册序)', () => {
  const exclude = [api.B_CRAFT, api.B_FURNACE, api.B_CHEST, api.B_BED];
  const ids = Core.showroomDisplays(exclude);
  const want = Object.keys(api.ITEMS).filter((id) =>
    typeof api.ITEMS[id].block === 'number' && exclude.indexOf(api.ITEMS[id].block) < 0);
  assert.deepStrictEqual(ids, want, '展品清单=独立重算(注册序确定)');
  for (const id of ids) {
    assert.ok(exclude.indexOf(api.ITEMS[id].block) < 0, '站点件不上展台: ' + id);
  }
  assert.ok(ids.length > 15, '展品成阵(当前表 20+ 件): ' + ids.length);
});

/* ============ ⑤ 红线: 供给核心同守数据隔离 ============ */

test('供给核心: 数据隔离 — 源文本零存储 API 名/零存档键字面量(与模式同红线)', () => {
  for (const bad of ['localStorage', 'sessionStorage', 'SyncDB']) {
    assert.ok(!coreSrc.includes(bad), '不得出现存储 API 名: ' + bad);
  }
  const re = /'([a-z0-9]+(?:_[a-z0-9]+)*_(?:save|backup))'/g;
  let m;
  while ((m = re.exec(coreSrc)) !== null) {
    assert.fail('不得出现存档键字面量: ' + m[1]);
  }
});
