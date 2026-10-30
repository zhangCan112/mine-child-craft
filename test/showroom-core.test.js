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
   ⑥ U3 篡改档派生(纯派生面): SHOWROOM 布局常量在位 · 世界/任务/宝箱 payload
      形状(decode 输入形状) · 背包供给重铸 · dev store 丢弃语义(世界仿真/
      重放同构类在 test/showroom-mode.test.js——那里有体素底座)。
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
  B_CRAFT, B_FURNACE, B_CHEST, B_BED, BLOCKS})`, eng);
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
  /* U5: 展台方块清单在派生层排除 need 旗标块(失依即落, P14 清扫每场收走) */
  const blocks = Core.showroomDisplayBlocks();
  assert.ok(blocks.length > 15 && blocks.length < ids.length,
      'need 排除后仍有展品成阵(排除至少 1 件): ' + blocks.length + '/' + ids.length);
  for (const b of blocks) {
    assert.ok(!(api.BLOCKS[b] && api.BLOCKS[b].need), 'need 旗标块不上展台: ' + b);
  }
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

/* ============ ⑥ U3 篡改档派生(纯派生面; 世界仿真类在 test/showroom-mode.test.js) ============
    环境补装: 冒险纯核心(ADV_QUESTS/ADV_CHEST_SLOTS/advChestPut/ADV_GROUND)与地图
    注册表(ADV_UNLOCK_KEYS)进 vm 同一词法环境; 世界改动日志工厂直装 Node 全局。 */

test('供给核心: 环境补装 — 冒险纯核心与地图注册表可加载(后续用例的派生依赖面)', () => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/adventure-spawn-core.js'), 'utf8'), eng,
      {filename: 'js/adventure-spawn-core.js'}); /* 刷怪三件(候选 2): 先于 adventure-core 进同一词法环境 */
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/adventure-core.js'), 'utf8'), eng,
      {filename: 'js/adventure-core.js'});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/adventure-maps-core.js'), 'utf8'), eng,
      {filename: 'js/adventure-maps-core.js'});
  Object.assign(globalThis, vm.runInContext(`({ADV_GROUND, ADV_QUESTS, ADV_QUEST_TITLE,
    ADV_CHEST_SLOTS, advChestPut, ADV_UNLOCK_KEYS})`, eng));
  Object.assign(globalThis, require('../js/world-journal-core.js'));
  assert.strictEqual(globalThis.ADV_GROUND, 24, '家营地平(冒险纯核心在位)');
  assert.ok(globalThis.ADV_QUESTS.length > 20, '任务表在位(含远征章)');
  assert.ok(globalThis.mkWorldJournal, '世界改动日志工厂在位');
});

test('供给核心: SHOWROOM 布局常量在位(v2 值原样迁入) · dev 布局=坐标不动只平移地平', () => {
  const L = Core.SHOWROOM;
  assert.ok(L && typeof L === 'object', '常量对象在位(供给核心为唯一语义源)');
  assert.strictEqual(L.groundY, 12, 'v2 地平 12 原样(模式行为不变红线)');
  assert.deepStrictEqual([L.house.x1, L.house.z1, L.house.x2, L.house.z2], [48, 44, 79, 75],
      '房子 footprint 原样');
  assert.strictEqual(L.door.x, 63, '南门 x');
  assert.strictEqual(L.spawn.x, 64.5, '房内出生点');
  assert.strictEqual(L.crateMax, 8, '仓库箱锚位上限');
  assert.deepStrictEqual(L.flatPad, {n: 2, w: 2, e: 2, s: 0},
      '整地圈 pad: 北西东 2 防半埋, 南 0 不铲屋南小径');
  const dev = Core.showroomDevLayout();
  assert.strictEqual(dev.groundY, globalThis.ADV_GROUND, 'dev 布局地平=家营地平');
  assert.strictEqual(dev.house, L.house, '坐标/房子同引用(两处语义源同参)');
  const R = Core.showroomFlatRegion(dev);
  assert.deepStrictEqual([R.x1, R.z1, R.x2, R.z2], [46, 42, 81, 75],
      '整地圈 = footprint 外扩(南缘=footprint 南缘)');
});

test('供给核心: 世界档 payload — 五桶 edits(home=注入条目) · 房内出生 · 满血清晨(decode 输入形状)', () => {
  const p = Core.showroomWorldPayload([['48,24,44', 6], ['50,25,50', 54]]); /* 注入条目: 纯形状面不跑世界仿真 */
  assert.deepStrictEqual(Object.keys(p.edits).sort(), ['den', 'desert', 'home', 'nether', 'snow', 'swamp'],
      'edits 六桶齐(键=场景键集, 桶集随 ADV_DIMS 对齐——dimension-registry)');
  assert.deepStrictEqual(p.edits.home, [['48,24,44', 6], ['50,25,50', 54]], 'home 桶=注入条目原样');
  for (const k of ['desert', 'snow', 'swamp', 'nether']) {
    assert.deepStrictEqual(p.edits[k], [], k + ' 空桶');
  }
  assert.strictEqual(p.map, 'home', 'map=home(重进即家营)');
  const h = Core.SHOWROOM.house;
  assert.ok(p.pos.x > h.x1 && p.pos.x < h.x2 && p.pos.z > h.z1 && p.pos.z < h.z2, 'pos=房内出生');
  assert.strictEqual(p.pos.y, globalThis.ADV_GROUND + 1, 'pos.y=地平+1(站立面)');
  assert.strictEqual(p.pos.yaw, Core.SHOWROOM.spawn.yaw, '朝向随常量');
  assert.strictEqual(p.hp, 30, '满血(冒险玩家 30/30 口径)');
  assert.deepStrictEqual(p.furnaces, [], '炉空');
  assert.deepStrictEqual(Object.keys(p.livestock).sort(), ['den', 'desert', 'home', 'nether', 'snow', 'swamp'],
      '死畜六桶空账(桶集随 ADV_DIMS 对齐)');
  assert.strictEqual(p.dayTime, 0, '清晨起步');
});

test('供给核心: 任务档 payload — 表外步=终章完成态 · 门解锁键全置 1 · 首夜已教 · 称号在档', () => {
  const q = Core.showroomQuestPayload();
  const KEYS = globalThis;
  assert.strictEqual(q.step, KEYS.ADV_QUESTS.length, 'step=表长(表外=终章+远征章全完成, 进门不引导)');
  const want = Object.values(KEYS.ADV_UNLOCK_KEYS);
  assert.deepStrictEqual(Object.keys(q.counts).sort(), want.slice().sort(),
      'counts 恰为门解锁键全集(从注册表派生, 不手抄)');
  for (const k of want) assert.strictEqual(q.counts[k], 1, k + ' 置 1(三扇门全亮)');
  assert.strictEqual(q.firstNight, true, '首夜教学已给(重进夜里不重教)');
  assert.strictEqual(q.title, KEYS.ADV_QUEST_TITLE, '终章称号在档(通关徽标)');
});

test('供给核心: 宝箱档 payload — 顶格 27 槽预填(全 id∈ITEMS · n 合法 · 装不下截断)', () => {
  const c = Core.showroomChestPayload();
  const KEYS = globalThis;
  assert.strictEqual(c.size, KEYS.ADV_CHEST_SLOTS, 'size=硬上限(顶格档)');
  assert.strictEqual(c.slots.length, KEYS.ADV_CHEST_SLOTS, '满长槽数组(壳 init 归一化输入形状)');
  let filled = 0;
  for (const s of c.slots) {
    if (!s) continue;
    filled++;
    assert.ok(Object.prototype.hasOwnProperty.call(api.ITEMS, s.id), 'id ∈ ITEMS: ' + s.id);
    assert.ok(Number.isInteger(s.n) && s.n >= 1 && s.n <= api.stackMax(s.id),
        'n ∈ [1, stackMax]: ' + s.id);
  }
  assert.ok(filled > 0, '预填非空(仓库箱派生物资在场)');
  assert.ok(filled <= KEYS.ADV_CHEST_SLOTS, '装不下的余量截断(不溢出槽界)');
  assert.deepStrictEqual(Core.showroomChestPayload(), c, '同参同结果(纯派生)');
});

test('供给核心: 背包供给 — load 原地重铸套餐(引用稳定) · save 丢弃零副作用', () => {
  const bag = Core.showroomDevBag();
  const inv = bag.inv;
  assert.strictEqual(bag.load(), inv, 'load 返回同一实例(原地重铸, 面板闭包不脱钩)');
  const p = Core.showroomPocket();
  assert.ok(p.rows.length <= api.INV_SLOTS, '套餐 ≤27 行(一行一槽零余量)');
  for (let i = 0; i < p.rows.length; i++) {
    assert.strictEqual(inv.slots[i] && inv.slots[i].id, p.rows[i].id, '槽 ' + i + ' = 套餐行');
    assert.strictEqual(inv.slots[i].n, p.rows[i].n, '槽 ' + i + ' 数量=堆叠上限');
  }
  inv.slots[0] = null; /* 破坏现场 */
  bag.load();
  assert.ok(inv.slots[0], '重铸恢复原装');
  bag.save(); /* 丢弃式: 调用不炸 */
  assert.ok(inv.slots[0], 'save 零副作用(账本只在内存)');
});

test('供给核心 U4: dev bag 可注入 inv — 包外部 inv 对象原地重铸(背包闭包绑定的解) · mkShowroomStore 可注入 bag', () => {
  /* U4 门面把冒险壳真档背包的 inv 对象注入: 壳的 kit/面板在加载期捕获该引用,
     dev bag 必须包同一对象——身份永不变、内容随 load 换(背包壳「原地换槽」同款) */
  const foreign = api.mkInventory(); /* 外部 inv(测试里=壳真档 inv 的替身) */
  foreign.slots[0] = {id: 'diamond', n: 7}; /* 预置他内容(真档残留) */
  const bag = Core.showroomDevBag(foreign);
  assert.strictEqual(bag.inv, foreign, '供给包外部 inv 对象(不自建第二实例)');
  bag.load();
  const p = Core.showroomPocket();
  assert.strictEqual(foreign.slots[0].id, p.rows[0].id, 'load 清槽后照套餐原地重铸进该 inv');
  assert.ok(foreign.slots.every((s, i) => !s || i < p.rows.length), '27 槽清空重铸(无真档残留)');
  const store = Core.mkShowroomStore(bag);
  assert.strictEqual(store.bag, bag, 'store 可注入 bag(整体换装时闭包面同一份)');
  assert.strictEqual(store.loadBag(), foreign, 'loadBag 返回注入的 inv(同一引用)');
});

test('供给核心: dev store — 槽供给五件齐 · mark 进内存账本 · 落盘面全 noop(脏标不清=未走真链路)', () => {
  const store = Core.mkShowroomStore();
  const KEYS = globalThis;
  assert.ok(store.worldSlot && store.questSlot && store.chestSlot && store.bag && store.journal,
      '供给五件齐(与冒险壳真档 adapter 同形, 可整体换装)');
  assert.strictEqual(store.loadQuest().step, KEYS.ADV_QUESTS.length, '任务档=篡改 payload');
  store.saveQuest({step: 0, counts: {}}); /* 丢弃 */
  assert.strictEqual(store.loadQuest().step, KEYS.ADV_QUESTS.length, 'saveQuest 丢弃: 再读仍篡改档');
  assert.strictEqual(store.loadChest().size, KEYS.ADV_CHEST_SLOTS, '宝箱档=篡改 payload');
  store.saveChest(); /* noop */
  assert.strictEqual(store.loadChest().size, KEYS.ADV_CHEST_SLOTS, 'saveChest 丢弃');
  const inv = store.loadBag();
  assert.strictEqual(store.bag.inv, inv, '背包引用稳定');
  store.saveBag(); /* noop */
  assert.ok(inv.slots[0], '背包重铸在位(save 后不动)');
  /* mark 正常: edits 活在内存 journal(切图换桶/重进重放的账本面) */
  store.mark('48,24,44', 6);
  assert.strictEqual(store.journal.edits.get('48,24,44'), 6, '记账进内存账本');
  assert.strictEqual(store.journal.dirty(), true, 'mark 后脏标在位');
  store.touch();
  store.flush();
  store.tick();
  store.pageHide();
  assert.strictEqual(store.journal.dirty(), true,
      '落盘面全 noop: 脏标不清(真档 flush 会清脏标)——丢弃式的可观察证据');
});
