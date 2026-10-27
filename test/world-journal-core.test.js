'use strict';
/* 世界改动日志 (js/world-journal-core.js) 单测 — node --test (零依赖)
   运行: node --test test/world-journal-core.test.js
   三层断言:
   ① 单元: fluidCell 编码判据 / mark·touch·flush 脏标与联写次序 / 超限守卫 /
      节流泵(注入时钟) / 关页兜底 / load 收养 / replay 双通道;
   ② 互锁(本次核心交付): 同一份 edits(含流体格)经「探险形状(T6 起按图分桶
       封套, journal 只认当前桶)」与
      「建造形状(按场景分桶档)」两个 journal 适配器重放 → 两个世界逐格一致
      (含水位通道), 且各自落盘往返后重放仍互锁——评审指出的「流体格编码
      两处各写、无互锁测试」的对症测试;
   ③ 旧档兼容(红线): 2026-10 既有存档字面量原样可读; 落盘文本形状逐键等价。
   档形状(schema)是消费方政策: 探险/建造的真实 encode/decode 留在各自模式
   文件一字未动(encode 逐字段对照 git HEAD), 本测试按同形状最小复刻 edits 键;
   探险全五键档的真实链路(真 decode+真重放进 worldCells)断言在
   test/adventure-mode.test.js。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const WorldJournal = require('../js/world-journal-core.js');
const SaveSlot = require('../js/save-slot.js');

/* 真方块表(config.js 纯数据, vm 装载): fluidCell 判据对真 fluid 旗标断言 */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}, groundTop: () => 24});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8'), eng, {filename: 'js/config.js'});
const {BLOCKS, B_WATER, B_LAVA} = vm.runInContext('({BLOCKS, B_WATER, B_LAVA})', eng);

/* 假存储 + 真 mkSaveSlot: 与 SyncDB.slot 同一底层(save-slot.js 纯函数可直测) */
function mkMemSlot(mem, key, schema) {
  return SaveSlot.mkSaveSlot({
    get: (k) => (mem.has(k) ? mem.get(k) : null),
    set: (k, v) => {
      mem.set(k, v);
    },
    remove: (k) => {
      mem.delete(k);
    },
  }, key, schema);
}
/* 两种档形状(edits 键编解码与模式文件逐字段同形, 其余键与重放无关):
    单 Map 形状载具(收养语义测试用; 探险 T6 前的形状); 建造: edits 按场景分桶 {sceneId: entries} */
const ADV_SCHEMA = {
  defaults: {edits: []},
  encode: (st) => ({edits: [...st.edits.entries()]}),
  decode: (sv) => ({edits: new Map(sv.edits || [])}),
};
/* 探险 T6 形状(edits 按图分桶封套 {mapId: entries}, 同 js/modes/adventure.js 接线):
    encode 透传 payload 装好的封套, decode 兼容老档裸数组(→home 桶) */
const ADV_T6_SCHEMA = {
  defaults: {edits: [], map: 'home'},
  encode: (st) => ({map: st.map, edits: st.edits}),
  decode: (sv) => ({map: sv.map || 'home',
    edits: Array.isArray(sv.edits) ? {home: new Map(sv.edits)} :
        Object.fromEntries(Object.keys(sv.edits || {}).map((k) => [k, new Map(sv.edits[k])]))}),
};
const BUILD_SCHEMA = {
  defaults: {scene: null, edits: {}},
  encode: (st) => ({scene: st.scene,
    edits: Object.fromEntries(Object.keys(st.edits).map((id) => [id, [...st.edits[id].entries()]]))}),
  decode: (sv) => ({scene: sv.scene,
    edits: Object.fromEntries(Object.keys(sv.edits || {}).map((id) => [id, new Map(sv.edits[id])]))}),
};
/* 世界记录器: 记 block/fluid 两通道写入, Map 直接 deepStrictEqual 比对 */
function mkWorld() {
  const cells = new Map();
  const fluid = new Map();
  return {cells, fluid, set: {
    block: (x, y, z, id) => cells.set(x + ',' + y + ',' + z, id),
    fluid: (x, y, z, lv) => fluid.set(x + ',' + y + ',' + z, lv),
  }};
}

/* ============ ① 单元 ============ */

test('fluidCell: 流体方块→{id,lv}(lv 缺省回落 0=源), 非流体→裸 id(判据单份)', () => {
  assert.deepStrictEqual(WorldJournal.fluidCell(B_WATER, 3, BLOCKS), {id: B_WATER, lv: 3}, '流动水格');
  assert.deepStrictEqual(WorldJournal.fluidCell(B_LAVA, 0, BLOCKS), {id: B_LAVA, lv: 0}, '源格(放置 lv0)');
  assert.deepStrictEqual(WorldJournal.fluidCell(B_WATER, undefined, BLOCKS), {id: B_WATER, lv: 0},
      'lv 缺省回落 0(流体缝 sink 的 lv||0 口径)');
  assert.strictEqual(WorldJournal.fluidCell(4, 0, BLOCKS), 4, '圆石裸 id(旧档零迁移)');
  assert.strictEqual(WorldJournal.fluidCell(0, 0, BLOCKS), 0, '挖除裸 0');
  assert.strictEqual(WorldJournal.fluidCell(B_WATER, 3, null), B_WATER, '无表注入退化为裸 id(不炸)');
});

test('mark/touch/flush: mark=记账+置脏, flush 清脏且主档先行、伴随联写在后', () => {
  const mem = new Map();
  const order = [];
  const savedPayloads = []; /* 记录型槽: 断言 payload 钩子产物原样到达 slot.save */
  const slot = {load: () => ({}), save: (p) => savedPayloads.push(p)};
  const j = WorldJournal.mkWorldJournal(slot, {
    payload: (edits) => ({edits, extra: 1}),
    onFlush: () => order.push(savedPayloads.length ? 'after-save' : 'before-save'),
  });
  assert.strictEqual(j.dirty(), false, '出生是干净的');
  j.touch();
  assert.strictEqual(j.dirty(), true, 'touch 只置脏不记账');
  assert.strictEqual(j.edits.size, 0, '账本没动');
  j.mark('1,2,3', 4);
  assert.strictEqual(j.edits.get('1,2,3'), 4, 'mark 记账');
  j.mark('1,2,3', 0);
  assert.strictEqual(j.edits.get('1,2,3'), 0, '同格覆写(最后写赢)');
  assert.strictEqual(j.flush(), true, '落盘成功');
  assert.deepStrictEqual(order, ['after-save'], 'onFlush 在主档之后(探险三档联写次序: 世界档→背包→任务)');
  assert.strictEqual(j.dirty(), false, '落盘后清脏');
  assert.strictEqual(savedPayloads.length, 1, 'slot.save 恰被调一次');
  assert.ok(savedPayloads[0].edits === j.edits, 'payload 带的是当前账本本体');
  assert.strictEqual(savedPayloads[0].extra, 1, 'payload 钩子的附加字段原样随档');
  assert.strictEqual(mem.size, 0, '记录型槽不落介质(其余用例走真 mkSaveSlot)');
});

test('超限守卫(建造 200KB 政策形状): 拦下则不落盘不清脏, 账本变小后下次可存', () => {
  const mem = new Map();
  let toasts = 0;
  /* 守卫量的是 encode 之前的原始 payload(build.js 既有口径原样保真——Map 在
     JSON.stringify 里序列化成 {}, 这里用普通字段撑大体积驱动守卫分支) */
  let pad = 'x'.repeat(80);
  const j = WorldJournal.mkWorldJournal(mkMemSlot(mem, 'k', BUILD_SCHEMA), {
    payload: () => ({scene: 'house', edits: new Map(), pad}),
    overSize: (p) => {
      if (JSON.stringify(p).length > 100) {
        toasts++;
        return true;
      }
      return false;
    },
  });
  j.touch();
  assert.strictEqual(j.flush(), false, '超限: flush 返 false(存档太大了 toast 已在守卫里)');
  assert.ok(!mem.has('k'), '没落盘(存前拦下, 免得"看起来存了其实没存")');
  assert.strictEqual(j.dirty(), true, '脏标不清(下个 5s 节流窗重试再提示)');
  assert.strictEqual(toasts, 1, '每次尝试提示一次');
  pad = ''; /* 按提示重置后体积变小 */
  assert.strictEqual(j.flush(), true, '变小后可存');
  assert.ok(mem.has('k'), '已落盘');
  assert.strictEqual(j.dirty(), false, '清脏');
  assert.strictEqual(toasts, 1, '成功路径不再提示');
});

test('节流泵 tick(注入时钟): 脏且距上次落盘超 5s 才 flush — 墙钟口径与既有实现逐字一致', () => {
  const mem = new Map();
  let t = 10000; /* 假墙钟(ms) */
  const j = WorldJournal.mkWorldJournal(mkMemSlot(mem, 'k', ADV_SCHEMA), {now: () => t});
  j.mark('1,2,3', 4);
  assert.strictEqual(j.tick(), true, '首笔脏改动: t - 0 > 5000 → 到点即存(0 起始语义不变)');
  assert.ok(mem.has('k'), '已落盘');
  j.mark('2,3,4', 5);
  assert.strictEqual(j.tick(), false, '窗内不存');
  t += 4999;
  assert.strictEqual(j.tick(), false, '差 1ms 仍不存');
  t += 2;
  assert.strictEqual(j.tick(), true, '跨过 5s 到点(严格大于)');
  t += 6000;
  assert.strictEqual(j.tick(), false, '干净时永不落盘(flush 已清脏)');
});

test('pageHide 关页兜底: 脏则同步落盘, 干净幂等无档', () => {
  const mem = new Map();
  const j = WorldJournal.mkWorldJournal(mkMemSlot(mem, 'k', ADV_SCHEMA));
  j.pageHide();
  assert.ok(!mem.has('k'), '干净时关页不写档');
  j.mark('3,4,5', 6);
  j.pageHide();
  assert.strictEqual(j.dirty(), false, '关页兜底已落盘');
  assert.deepStrictEqual(JSON.parse(mem.get('k')).edits, [['3,4,5', 6]], '改动进档');
});

test('load 收养: Map/数组/null 形状 edits 归一化成 Map, 桶形状(建造/探险 T6)透传不收养', () => {
  /* decode 后的 Map → 收养(单 Map 形状的归一化语义收在 journal; 载具见上方
     ADV_SCHEMA——探险 T6 起改桶封套, journal 依旧不懂桶, 见下一分支) */
  const memA = new Map();
  memA.set('k', JSON.stringify({_v: 1, edits: [['1,2,3', 4], ['4,5,6', {id: B_WATER, lv: 2}]]}));
  const j1 = WorldJournal.mkWorldJournal(mkMemSlot(memA, 'k', ADV_SCHEMA));
  const st1 = j1.load();
  assert.ok(j1.edits instanceof Map && j1.edits === st1.edits, 'Map 被收养');
  assert.deepStrictEqual(j1.edits.get('4,5,6'), {id: B_WATER, lv: 2}, '流体格原样');
  /* 空档: defaults 深拷贝不经 decode → edits 是数组 → 归一化空 Map */
  const j2 = WorldJournal.mkWorldJournal(mkMemSlot(new Map(), 'k', ADV_SCHEMA));
  j2.load();
  assert.ok(j2.edits instanceof Map && j2.edits.size === 0, 'defaults 数组形状归一化');
  /* 建造桶形状: edits 是普通对象 → journal 不收养, 消费方合并各桶后自装当前桶 */
  const memB = new Map();
  memB.set('k', JSON.stringify({_v: 1, scene: 'house', edits: {house: [['1,2,3', 4]], basement: []}}));
  const j3 = WorldJournal.mkWorldJournal(mkMemSlot(memB, 'k', BUILD_SCHEMA));
  const st3 = j3.load();
  assert.strictEqual(j3.edits.size, 0, '桶形状不收养(journal 不懂分桶政策)');
  assert.ok(st3.edits.house instanceof Map, '桶内容 decode 透传(消费方合并)');
  j3.edits = st3.edits.house; /* 换装当前桶(build.js 的 buildLoadScene 同款) */
  j3.mark('9,9,9', 1);
  assert.strictEqual(st3.edits.house.get('9,9,9'), 1, 'mark 写进当前桶');
});

test('replay 双通道: 流体格→方块+水位两笔, 裸值→方块一笔; 插入序=确定序', () => {
  const calls = [];
  const j = WorldJournal.mkWorldJournal({}, {});
  j.edits = new Map([['1,2,3', 4], ['4,5,6', {id: B_WATER, lv: 7}], ['7,8,9', {id: B_LAVA, lv: 0}]]);
  j.replay({
    block: (...a) => calls.push(['b', ...a]),
    fluid: (...a) => calls.push(['f', ...a]),
  });
  assert.deepStrictEqual(calls, [
    ['b', 1, 2, 3, 4],
    ['b', 4, 5, 6, B_WATER], ['f', 4, 5, 6, 7],
    ['b', 7, 8, 9, B_LAVA], ['f', 7, 8, 9, 0],
  ], '通道与次序确定(源格 lv0 也走水位通道, 坐标从账本键解析)');
});

/* ============ ② 互锁(核心交付) + ③ 旧档兼容(红线) ============ */

test('互锁(红线): 同一份 edits(含流体格)经两模式形状适配器重放 → 世界状态一致', () => {
  /* 典型账本: 裸值放置/挖除/同格覆写(最后写赢) + 流动水/岩浆源(liquid D8 双通道) */
  const canonical = [
    ['10,25,10', 4],
    ['11,25,11', 0],
    ['12,25,12', {id: B_WATER, lv: 3}],
    ['13,25,13', {id: B_LAVA, lv: 0}],
    ['10,25,10', 6],
  ];
  /* 探险形状适配器(T6 分桶: 同 js/modes/adventure.js 接线——journal 只认当前桶,
     payload 把当前桶装进 {mapId: entries} 封套; 此处单 home 桶即够互锁) */
  const memA = new Map();
  const bucketsA = {home: new Map(canonical)};
  const adv = WorldJournal.mkWorldJournal(mkMemSlot(memA, 'adventure_world_save', ADV_T6_SCHEMA), {
    payload: () => ({map: 'home', edits: {home: [...bucketsA.home.entries()]}}),
  });
  adv.edits = bucketsA.home;
  const worldA = mkWorld();
  adv.replay(worldA.set);
  /* 建造形状适配器(同 js/modes/build.js 接线: 按场景分桶, 桶是建造私有) */
  const memB = new Map();
  const buckets = {house: new Map(canonical), basement: new Map([['1,1,1', 2]])};
  const bld = WorldJournal.mkWorldJournal(mkMemSlot(memB, 'build_world_save', BUILD_SCHEMA), {
    payload: () => ({scene: 'house', edits: buckets}),
  });
  bld.edits = buckets.house;
  const worldB = mkWorld();
  bld.replay(worldB.set);
  assert.deepStrictEqual(worldA.cells, worldB.cells, '方块通道逐格一致(含同格覆写最后写赢)');
  assert.deepStrictEqual(worldA.fluid, worldB.fluid, '水位通道逐格一致(无互锁风险对症断言)');
  assert.strictEqual(worldA.fluid.get('13,25,13'), 0, '源格水位 0 也在通道里(不是 undefined)');
  /* 落盘往返后再重放: 各自 encode→JSON→decode→replay 是恒等变换, 且两侧互锁 */
  adv.flush();
  bld.flush();
  const adv2 = WorldJournal.mkWorldJournal(mkMemSlot(memA, 'adventure_world_save', ADV_T6_SCHEMA));
  const stA = adv2.load();
  adv2.edits = stA.edits.home; /* 换装当前桶(探险 init 同款) */
  const worldA2 = mkWorld();
  adv2.replay(worldA2.set);
  const bld2 = WorldJournal.mkWorldJournal(mkMemSlot(memB, 'build_world_save', BUILD_SCHEMA), {
    payload: () => ({scene: 'house', edits: buckets}),
  });
  const stB = bld2.load();
  bld2.edits = stB.edits.house; /* 重进换装当前桶 */
  const worldB2 = mkWorld();
  bld2.replay(worldB2.set);
  assert.deepStrictEqual(worldA2.cells, worldA.cells, '探险形状落盘往返重放恒等');
  assert.deepStrictEqual(worldB2.cells, worldA.cells, '建造形状落盘往返重放与探险侧一致(互锁)');
  assert.deepStrictEqual(worldB2.fluid, worldA.fluid, '水位通道往返互锁');
  /* 落盘文本形状(旧档兼容红线): 桶内 entries 数组 + 流体格 {id,lv} 逐键(对照 git HEAD encode) */
  assert.deepStrictEqual(JSON.parse(memA.get('adventure_world_save')).edits.home,
      [['10,25,10', 6], ['11,25,11', 0], ['12,25,12', {id: B_WATER, lv: 3}], ['13,25,13', {id: B_LAVA, lv: 0}]],
      '探险档桶内形状: 数组序=插入序, 覆写保位, 流体格 {id,lv}');
  assert.deepStrictEqual(JSON.parse(memB.get('build_world_save')).edits.house,
      [['10,25,10', 6], ['11,25,11', 0], ['12,25,12', {id: B_WATER, lv: 3}], ['13,25,13', {id: B_LAVA, lv: 0}]],
      '建造档桶内形状与探险档同源(同一份账本两种封装, 互锁)');
  assert.strictEqual(JSON.parse(memB.get('build_world_save')).scene, 'house', '建造档当前场景随档');
});

test('旧档可读(红线): 2026-10 既有存档字面量原样 decode — 流体格形状一字不差', () => {
  /* 探险档字面量(五键全量, 与 git HEAD js/modes/adventure.js encode 逐字段对照;
     本测试 schema 只复刻 edits 键, 其余四键的 decode 政策在模式文件, 真链路
     断言见 test/adventure-mode.test.js) */
  const memA = new Map();
  memA.set('adventure_world_save', JSON.stringify({_v: 1,
    edits: [['61,24,80', 0], ['70,25,80', 4], ['80,25,80', {id: 24, lv: 5}], ['81,25,81', {id: 25, lv: 0}]],
    pos: {x: 90.5, y: 26, z: 91.5, yaw: 2.5}, hp: 7, furnaces: [], livestock: {dead: [2]}, dayTime: 21000}));
  const j = WorldJournal.mkWorldJournal(mkMemSlot(memA, 'adventure_world_save', ADV_SCHEMA));
  const st = j.load();
  assert.strictEqual(st.edits.size, 4, '老档 edits 全量可读');
  assert.strictEqual(j.edits, st.edits, '收养的是 decode 产物');
  assert.deepStrictEqual(j.edits.get('80,25,80'), {id: 24, lv: 5}, '流体格(水 lv5)形状原样');
  assert.deepStrictEqual(j.edits.get('81,25,81'), {id: 25, lv: 0}, '岩浆源格形状原样');
  /* 建造档字面量(分桶) */
  const memB = new Map();
  memB.set('build_world_save', JSON.stringify({_v: 1, scene: 'basement',
    edits: {basement: [['5,18,10', 6]], house: [['7,20,3', {id: 24, lv: 1}]]}}));
  const st2 = WorldJournal.mkWorldJournal(mkMemSlot(memB, 'build_world_save', BUILD_SCHEMA)).load();
  assert.strictEqual(st2.scene, 'basement', '当前场景可读');
  assert.strictEqual(st2.edits.basement.get('5,18,10'), 6, '桶内裸值可读');
  assert.deepStrictEqual(st2.edits.house.get('7,20,3'), {id: 24, lv: 1}, '桶内流体格可读');
});

test('守门: 两模式经 journal 接线, 流体格编码判据与节流不在模式层誊写第二份', () => {
  const advSrc = fs.readFileSync(path.join(ROOT, 'js/modes/adventure.js'), 'utf8');
  const bldSrc = fs.readFileSync(path.join(ROOT, 'js/modes/build.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(advSrc.includes('mkWorldJournal(advWorldSlot'), '探险: journal 挂在世界档槽上');
  assert.ok(bldSrc.includes('mkWorldJournal(buildSlot'), '建造: journal 挂在云同步档槽上');
  for (const [name, src] of [['adventure', advSrc], ['build', bldSrc]]) {
    assert.ok(!/BLOCKS\[id\] && BLOCKS\[id\]\.fluid/.test(src),
        name + '.js 不得誊写内联流体格编码(判据单份在 world-journal-core 的 fluidCell)');
    assert.ok(src.includes('fluidCell('), name + '.js 经 fluidCell 编码');
    assert.ok(src.includes('setFluidEditSink'), name + '.js 流体账本缝仍在(接线位置不变)');
    assert.ok(!/(advSaveT|buildSaveT)/.test(src), name + '.js 节流计时不复存在(收编 journal.tick)');
  }
  const jIdx = html.indexOf('js/world-journal-core.js');
  assert.ok(jIdx > 0, 'index.html 加载新文件');
  assert.ok(jIdx < html.indexOf('js/modes/build.js') && jIdx < html.indexOf('js/modes/adventure.js'),
      '加载序: world-journal-core 在两个模式文件之前(依赖序)');
});
