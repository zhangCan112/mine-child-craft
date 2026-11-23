'use strict';
/* 篝火装配 kit (js/campfire-kit.js) 契约测试 — node --test (零依赖)
   运行: node --test test/campfire-kit.test.js
   T-C1 tracer 竖切(篝火票据): 本文件收两块——
   ① 数据接线守门(票面要求 1/3, 漏一即红): BLOCKS 两态行(81/82, 两态 id/
     campfire 旗标/light/物理形态/hard)/CAMPFIRE 参数块(§3.9 全参初值)/
     ITEMS.campfire 行/ITEM_HINTS.campfire 逐字(UI 定稿 §6.1)+禁词(§6.4)/
     index.html script 行; ITEM_PIX.campfire 键不在此断言——icons-item.test
     既有「ITEM_PIX 键集与 ITEMS 完全一致」全量覆盖守门自动罩住(漏画即红),
     不重复造断言。
   ② kit 行为(票面要求 5/6): mkCampfireLedger 台账 Map/满时长建条/tick(dt)
     累积器量化整刻(零漂)/掉帧追平上限(guard=8, pumpFluids fluidAcc 同款)/
     不喂即冻结/燃尽恰一次且条目删净/drop 删条/reset/encode 桩(存档形状)。
   零墙钟红线(spec §6-8): 篝火账本源码 grep 断言(⑦)。
   vm 装真数据表(config/voxel/items-core/item-hint-registry), Node 侧
   require 被测 kit 与 adventure-core(纯函数经 globalThis 解析到真件,
   place-kit.test 同款惯例; kit 对引擎件的依赖全部调用期经全局名解析,
   装载序无关)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 真数据表: config + voxel(blockKey) + items/hints, 共享一个 vm 词法环境 ---------- */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
/* drops.js 装载: T-C3 回收行消费面(rollBlockDrop) */
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/voxel.js',
  'js/items-core.js', 'js/item-hint-registry.js', 'js/drops.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
/* config 词法绑定不挂 vm 全局: 上下文内具名求值铺 Node globalThis(kit 经全局名
   调用期解析到真件——classic script 共享词法环境的 Node 侧镜像)。
   篝火三新名(B_CAMPFIRE/B_CAMPFIRE_OUT/CAMPFIRE)用安全代理取——红测期 config
   尚无此行, 顶层硬求值会把整文件炸成「test failed」, 各测试改收干净断言红 */
/* BLOCK_HINTS 铺全局: T-C3 调色板零死数据守门 */
for (const n of ['BLOCKS', 'ITEMS', 'ITEM_HINTS', 'BLOCK_HINTS']) {
  globalThis[n] = vm.runInContext(n, eng);
}
const rollBlockDrop = vm.runInContext('rollBlockDrop', eng); /* 回收行消费面(drops.js 真件, T-C3) */
const cfg = vm.runInContext(`({
  lit: typeof B_CAMPFIRE !== 'undefined' ? B_CAMPFIRE : null,
  out: typeof B_CAMPFIRE_OUT !== 'undefined' ? B_CAMPFIRE_OUT : null,
  params: typeof CAMPFIRE !== 'undefined' ? CAMPFIRE : null,
})`, eng);
/* adventure-core 的模块级表格(ADV_ORES 等)引用 config 的 B_ 前缀方块号常数:
   require 前先在上下文内按名单求值、铺到 Node globalThis(名单从源码动态收集
   防漏——place-kit.test 同款) */
const acSrc = fs.readFileSync(path.join(ROOT, 'js', 'adventure-core.js'), 'utf8');
const bNames = [...new Set(acSrc.match(/\bB_[A-Z0-9_]+\b/g) || [])];
for (const n of bNames) globalThis[n] = vm.runInContext(n, eng);
/* 被测 kit 容错装载: 红测期 js/campfire-kit.js 尚未新建, MODULE_NOT_FOUND 在
   顶层会把整文件炸成「test failed」——改为缺位旗标, 各测试自行断言在册红 */
let CampfireKit = null;
try {
  CampfireKit = require('../js/campfire-kit.js');
} catch {
  CampfireKit = null;
}
const kitReady = () => {
  assert.ok(CampfireKit && typeof CampfireKit.mkCampfireLedger === 'function',
      'js/campfire-kit.js 在册且暴露 CampfireKit.mkCampfireLedger(新建文件, 票面要求 5)');
};

/* ============ ① 数据接线守门(票面要求 1/3, spec §3.1/§3.4/§3.9) ============ */

test('campfire 两态行: B_CAMPFIRE=81/B_CAMPFIRE_OUT=82 · campfire 旗标 lit|out · ' +
    'light 15/0 · 半格实体 · hard 0 · 无 replaceable', () => {
  assert.strictEqual(cfg.lit, 81, '燃烧态 id=81(定稿建议值, 现号段 81/82 空闲已核实)');
  assert.strictEqual(cfg.out, 82, '熄灭态 id=82(两态连号)');
  const lit = BLOCKS[cfg.lit];
  const out = BLOCKS[cfg.out];
  assert.ok(lit && out, '两态行在册(漏配即红)');
  assert.strictEqual(lit.campfire, 'lit', '燃烧态身份旗标 lit(机制跟着「它是什么」走, spec §3.4)');
  assert.strictEqual(out.campfire, 'out', '熄灭态身份旗标 out');
  assert.strictEqual(lit.light, 15, '燃烧态 light 15(数据驱动字段, §3.9)');
  assert.strictEqual(out.light, 0, '熄灭态 light 0(不发光)');
  for (const [tag, def] of [['燃烧态', lit], ['熄灭态', out]]) {
    assert.strictEqual(def.thin, 0.4375,
        tag + '矮半格 thin 0.4375(=7/16 正典, UI 定稿 §4.1 v1.9; thin 不参与物理—§3.4 裁定, 仅渲染形态)');
    assert.strictEqual(def.solid, true, tag + '可碰撞可站立 solid true(踩火起飞前提)');
    assert.strictEqual(def.hard, 0, tag + ' hard 0: 徒手可移除(本票挖掘无回收, T-C3 补回收)');
    assert.strictEqual(def.replaceable, undefined,
        tag + '不配 replaceable(覆盖放置机制不适用篝火——否则点篝火顶会触发覆盖路径误判)');
    assert.ok(def.name, tag + '有名字');
  }
});

test('campfire 参数块: CAMPFIRE 六键照 §3.9 初值(6000 刻/柱高 20/截面半径 1/升速 3.0/烫伤节拍 20/烫伤 1 血)', () => {
  assert.ok(cfg.params && typeof cfg.params === 'object', 'CAMPFIRE 参数块在册(config, 照 GLIDE/FLUIDS 风格)');
  assert.strictEqual(cfg.params.ticks, 6000, '燃尽时长 6000 刻(300s, spec §3.9/ADR 0018)');
  assert.strictEqual(cfg.params.columnH, 20, '气柱高度 20 格(⭐PO 拍板)');
  assert.strictEqual(cfg.params.columnR, 1, '气柱截面 3×3=Chebyshev 半径 1(T-C2 消费)');
  assert.strictEqual(cfg.params.lift, 3.0, '乘流升速 +3.0 格/s(T-C2 消费)');
  assert.strictEqual(cfg.params.burnTick, 20, '烫伤节拍 20 刻(T-C4 消费)');
  assert.strictEqual(cfg.params.burnHp, 1, '烫伤 1 血/秒(T-C4 消费)');
});

test('campfire 物品行: ITEMS.campfire 三字段(name/icon/block 路由) · 无 dur(可堆叠消耗品)', () => {
  const it = ITEMS.campfire;
  assert.ok(it, 'ITEMS.campfire 在册(票面要求 1: 放置路由走 block 字段既有链)');
  assert.strictEqual(it.name, '篝火', '名字');
  assert.strictEqual(it.icon, '🔥', '图标(UI 定稿)');
  assert.strictEqual(it.block, cfg.lit, 'block 字段=放置路由依据(torch 同款)');
  assert.strictEqual(it.dur, undefined, '无 dur: 可堆叠消耗品, 燃烧账在方块侧');
});

test('campfire 物品提示: ITEM_HINTS.campfire 逐字=UI 定稿 §6.1 · 全文零剧透禁词(§6.4 词集)', () => {
  const hint = ITEM_HINTS.campfire;
  assert.strictEqual(hint, '放在地上，烧好久好久，又亮又暖',
      '逐字定稿(UI 定稿 §6.1, 禁改写——T-C10 逐字核对锚)');
  /* 禁词表扫描(⭐R2-3 不剧透红线): 篝火文案不得出现乘流机制字样 */
  for (const w of ['风', '升', '上升', '飞', '气流', '翅膀', '翼', '滑翔', '乘', '托', '任务', '倒计时']) {
    assert.ok(!hint.includes(w), '禁词「' + w + '」零命中');
  }
});

test('campfire 接线: index.html script 行在册且 adventure-core < campfire-kit < modes/adventure.js' +
    '(装载序=依赖序, boot 按真实序装载)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
  const iKit = srcs.indexOf('js/campfire-kit.js');
  const iAdv = srcs.indexOf('js/modes/adventure.js');
  const iCore = srcs.indexOf('js/adventure-core.js');
  assert.ok(iKit >= 0, 'script 行在册(campfire-kit.js)');
  assert.ok(iAdv >= 0, 'adventure.js 在册(哨兵)');
  assert.ok(iKit < iAdv, 'campfire-kit.js 先于 modes/adventure.js(adventure 顶层构造 kit 实例, 加载序即依赖序)');
  assert.ok(iCore >= 0, 'adventure-core.js 在册(哨兵)');
  assert.ok(iCore < iKit,
      'adventure-core.js 先于 campfire-kit.js(kit 头注释声明的硬依赖边: cfKitResolve 顶层' +
      '求值依赖 adventure-core 的 advCampfiresStep/Clean 先在册, 加载序即依赖序)');
});

/* ============ ⑦ 零墙钟红线(spec §6-8): 账本源码 grep 断言 ============ */

test('campfire 零墙钟: campfire-kit.js 源码零 Date.now/performance.now(确定性重放红线)', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'js', 'campfire-kit.js')), 'js/campfire-kit.js 在册');
  const src = fs.readFileSync(path.join(ROOT, 'js', 'campfire-kit.js'), 'utf8');
  assert.ok(!/Date\.now/.test(src), '零 Date.now');
  assert.ok(!/performance\.now/.test(src), '零 performance.now');
});

/* ============ ② kit 行为(票面要求 5/6, spec §4 时钟拍板案) ============ */

/* 小步喂刻工具: step=0.05s=恰 1 刻(20tps), n 步共 n 刻 */
function burnTicks(ledger, n) {
  for (let i = 0; i < n; i++) ledger.tick(0.05);
}

test('campfire kit plant: 满时长建条(posKey 键 + {x,y,z,left} 条目, left=6000=CAMPFIRE.ticks)', () => {
  const burned = [];
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger({onBurnout: (x, y, z) => burned.push([x, y, z])});
  assert.ok(ledger.map instanceof Map, '台账 Map 裸形状暴露(furnace-kit station.map 同款口径)');
  ledger.plant(10, 20, 30);
  const e = ledger.map.get('10,20,30');
  assert.ok(e, '条目在册(blockKey 键形)');
  assert.deepStrictEqual([e.x, e.y, e.z], [10, 20, 30], '坐标在册(燃尽回调要坐标做 editBlock 收尾)');
  assert.strictEqual(e.left, 6000, '满时长建条(放置即燃, spec §3.3)');
  assert.ok(cfg.params, 'CAMPFIRE 参数块在册(单源锚)');
  assert.strictEqual(e.left, cfg.params.ticks, '满时长=参数块 ticks(单源)');
});

test('campfire kit tick 量化整刻: 0.05s=1 刻零漂 · 不喂即冻结(零墙钟, 账本自己不动)', () => {
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger({onBurnout: () => {}});
  ledger.plant(1, 2, 3);
  burnTicks(ledger, 20); /* 20×0.05s = 1.0s = 20 刻 */
  assert.strictEqual(ledger.map.get('1,2,3').left, 5980, '20 刻整减(累积器量化零漂: 整数入账, spec §4)');
  ledger.tick(0.07); /* 1.4 刻 → 量化 1 刻, 余量留累积器 */
  assert.strictEqual(ledger.map.get('1,2,3').left, 5979, '非整步量化 1 刻(丢的是亚刻, 不是整刻)');
  /* 不喂即冻结: 挂 gameplay 块的暂停语义=主循环不调 tick 即停(菜单/未锁定/暂停,
     advFurnace.tick 同缝同拍)——账本自身零主动推进 */
  assert.strictEqual(ledger.map.get('1,2,3').left, 5979, '不喂不动(冻结可证)');
});

test('campfire kit 燃尽恰一次: 5999 刻不燃 · 第 6000 刻回调恰一次+条目删净 · 燃尽后再喂零回调', () => {
  const burned = [];
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger({onBurnout: (x, y, z) => burned.push([x, y, z])});
  ledger.plant(10, 20, 30);
  burnTicks(ledger, 5999);
  assert.strictEqual(ledger.map.get('10,20,30').left, 1, '5999 刻: 还剩 1 刻不燃(整刻边界)');
  assert.strictEqual(burned.length, 0, '未到期零回调');
  burnTicks(ledger, 1);
  assert.deepStrictEqual(burned, [[10, 20, 30]], '第 6000 刻: 燃尽回调恰一次(坐标全参)');
  assert.strictEqual(ledger.map.size, 0, '条目删净(侧账零残留, spec §3.4)');
  burnTicks(ledger, 10);
  assert.strictEqual(burned.length, 1, '燃尽后再喂不重复回调(删条后无账可烧)');
});

test('campfire kit 掉帧追平: 单帧大 dt 只走 8 刻(guard 防螺旋) · 后续帧累积追平零丢刻(pumpFluids fluidAcc 同款)', () => {
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger({onBurnout: () => {}});
  ledger.plant(1, 2, 3);
  ledger.tick(2.0); /* 请求 40 刻: guard=8 只走 8 刻 */
  assert.strictEqual(ledger.map.get('1,2,3').left, 5992, '单帧至多追 8 刻(6000−8)');
  for (let i = 0; i < 4; i++) ledger.tick(0.4); /* 每帧又 8 刻(guard 恰满) */
  assert.strictEqual(ledger.map.get('1,2,3').left, 5960, '剩余 32 刻后续帧追平(6000−40, 优雅降级不丢)');
});

test('campfire kit drop/reset: 挖除删条 · 未知格零炸 · reset 清空(重进场复位口径)', () => {
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger({onBurnout: () => {}});
  ledger.plant(10, 20, 30);
  ledger.plant(11, 20, 30);
  ledger.drop(10, 20, 30); /* 挖走/覆盖: 破坏钩删条(advMarkEdit presence Map 缝) */
  assert.strictEqual(ledger.map.size, 1, '挖除格删条, 邻格不动');
  ledger.drop(99, 98, 97); /* 未知格: 零炸零影响 */
  assert.strictEqual(ledger.map.size, 1, '未知格 drop 无副作用');
  ledger.reset();
  assert.strictEqual(ledger.map.size, 0, 'reset 清空(重进场复位, 存档重灌归消费方)');
});

test('campfire kit encode 桩: [[posKey,{left}]] 存档形状(advCampfiresClean 同形, T-C5 档键缝)', () => {
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger({onBurnout: () => {}});
  ledger.plant(3, 14, 15);
  ledger.plant(4, 14, 15);
  burnTicks(ledger, 100); /* 两格各烧 100 刻 */
  const out = ledger.encode();
  assert.deepStrictEqual(out, [['3,14,15', {left: 5900}], ['4,14,15', {left: 5900}]],
      'encode=clean 形态: 二元组数组, 只挑 left(坐标由 posKey 还原不双写)');
});

test('campfire kit 无 onBurnout 注入: 燃尽不炸(回调缺省=无观感政策)', () => {
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger();
  ledger.plant(1, 2, 3);
  assert.doesNotThrow(() => burnTicks(ledger, 6000), '燃尽路径零注入不炸');
  assert.strictEqual(ledger.map.size, 0, '条目照删');
});

/* ============ ③ updraft 注册/注销接线(篝火 T-C2, spec §3.5) ============
   票面要求 4: 模式层在状态迁移点调 add/remove——燃烧态=plant 时 add、
   燃尽(tick 到期)与挖除(drop)=remove; 注入走 opts.updraft 缝(onBurnout
   同款先例), 生产侧传 world.js 装配的 UPDRAFT_SIM(adventure 接线守门在
   test/updraft-core.test.js 装配守门段)。add 参数三件来自 CAMPFIRE 参数块
   (columnR/columnH/lift, 字面值已由本文件参数块测试钉死, 此处只钉转发)。 */

function mkUpdraftRecorder() {
  const added = [];
  const removed = [];
  return {
    added, removed,
    updraft: {
      add: (s) => added.push(s),
      remove: (x, y, z) => removed.push([x, y, z]),
    },
  };
}

test('campfire kit updraft 接线: plant → sim.add(源格心+CAMPFIRE 柱参三件, 单次单源)', () => {
  kitReady();
  assert.ok(cfg.params, 'CAMPFIRE 参数块在册(柱参单源)');
  const rec = mkUpdraftRecorder();
  const ledger = CampfireKit.mkCampfireLedger({updraft: rec.updraft});
  ledger.plant(10, 20, 30);
  assert.strictEqual(rec.added.length, 1, '放置即燃=注册恰一次(燃烧态=add, spec §3.5)');
  assert.deepStrictEqual(rec.added[0],
      {x: 10, y: 20, z: 30, r: cfg.params.columnR, h: cfg.params.columnH, lift: cfg.params.lift},
      'add 载荷=源格心+柱参三件(r/h/lift 全部来自 CAMPFIRE 参数块, 单源不誊写)');
});

test('campfire kit updraft 接线: 燃尽(tick 到期) → sim.remove(坐标全参, 与 onBurnout 同拍)', () => {
  kitReady();
  const rec = mkUpdraftRecorder();
  const ledger = CampfireKit.mkCampfireLedger({onBurnout: () => {}, updraft: rec.updraft});
  ledger.plant(10, 20, 30);
  burnTicks(ledger, 5999);
  assert.strictEqual(rec.removed.length, 0, '未燃尽零注销');
  burnTicks(ledger, 1);
  assert.deepStrictEqual(rec.removed, [[10, 20, 30]],
      '燃尽=注销(燃尽收尾与 onBurnout 同一状态迁移点, spec §3.5)');
});

test('campfire kit updraft 接线: drop 已知格 → sim.remove · 未知格 drop 零注销(presence 口径)', () => {
  kitReady();
  const rec = mkUpdraftRecorder();
  const ledger = CampfireKit.mkCampfireLedger({updraft: rec.updraft});
  ledger.plant(10, 20, 30);
  ledger.plant(11, 20, 30);
  ledger.drop(10, 20, 30);
  assert.deepStrictEqual(rec.removed, [[10, 20, 30]], '挖除/覆盖=注销, 邻格不动');
  ledger.drop(99, 98, 97);
  assert.strictEqual(rec.removed.length, 1, '未知格 drop 零注销(未知格零副作用口径)');
});

test('campfire kit updraft 缺席容忍: opts.updraft 未注入 plant/tick/drop 零炸(装配前/Node 语境)', () => {
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger({});
  ledger.plant(1, 2, 3);
  assert.doesNotThrow(() => burnTicks(ledger, 6000), '燃尽路径零 updraft 注入不炸');
  assert.doesNotThrow(() => ledger.drop(1, 2, 3), '挖除路径零 updraft 注入不炸');
  assert.strictEqual(ledger.map.size, 0, '台账行为不受影响');
});

/* ============ T-C3 水浇熄灭/回收(篝火票据 T-C3, campfire-spec §3.4) ============ */

test('T-C3 两态回收行: BLOCKS[81]/[82].drop=[["campfire",1,0]] 保底 1 零加成 · rollBlockDrop 消费面恒 1 件(非木炭)', () => {
  assert.ok(cfg.lit != null && cfg.out != null, '两态 id 在册(前置)');
  /* 红方裁决修正(2026-11-17): drop 行数组产自 vm realm, deepStrictEqual 按
     prototype 恒等比较跨 realm 必红(内容同形也红)——改字段化断言(本文件
     数据段 house style: 两态行断言同款) */
  for (const [tag, id] of [['燃烧态', cfg.lit], ['熄灭态', cfg.out]]) {
    const row = BLOCKS[id].drop;
    assert.ok(Array.isArray(row) && row.length === 1, tag + '回收行恰一条');
    assert.strictEqual(row[0][0], 'campfire', tag + '回收=篝火(非木炭, PO 拍板沿用)');
    assert.strictEqual(row[0][1], 1, tag + '保底 1(挖走即还篝火, 烧剩价值保留)');
    assert.strictEqual(row[0][2], 0, tag + '零加成概率');
  }
  const gotLit = rollBlockDrop(BLOCKS[cfg.lit], () => 0.99);
  assert.ok(Array.isArray(gotLit) && gotLit.length === 1, '消费面: 燃烧态恰得一条');
  assert.strictEqual(gotLit[0].id, 'campfire', '燃烧态消费 id=篝火');
  assert.strictEqual(gotLit[0].n, 1, '燃烧态消费 1 件(加成概率 0, 掷骰无关)');
  const gotOut = rollBlockDrop(BLOCKS[cfg.out], () => 0.99);
  assert.ok(Array.isArray(gotOut) && gotOut.length === 1, '消费面: 熄灭态恰得一条');
  assert.strictEqual(gotOut[0].id, 'campfire', '熄灭态同款(烧剩价值保留)');
  assert.strictEqual(gotOut[0].n, 1, '熄灭态恒 1 件');
});

test('T-C3 调色板零死数据: BLOCK_HINTS 无 81/82 行(两态不进建造调色板, hint 行=零消费死数据, spec §3.4 裁定)', () => {
  assert.strictEqual(BLOCK_HINTS[cfg.lit], undefined, '燃烧态无 hint 行');
  assert.strictEqual(BLOCK_HINTS[cfg.out], undefined, '熄灭态无 hint 行');
});

/* 水面桩: cells=有水格集合('x,y,z' 键形), 其余空气——read 缝的测试形态 */
function mkWaterRead(cells) {
  return (x, y, z) => (cells.has(x + ',' + y + ',' + z) ? 24 : 0);
}

test('T-C3 水浇接线: read 缝命中(水邻) → 下一刻台账删条+onQuench 坐标全参+updraft 注销同拍 · 零燃尽回调', () => {
  kitReady();
  const quenched = [];
  const burned = [];
  const rec = mkUpdraftRecorder();
  const ledger = CampfireKit.mkCampfireLedger({
    onBurnout: (x, y, z) => burned.push([x, y, z]),
    onQuench: (x, y, z) => quenched.push([x, y, z]),
    read: mkWaterRead(new Set(['11,20,30'])), /* 东邻有水 */
    updraft: rec.updraft,
  });
  ledger.plant(10, 20, 30);
  assert.strictEqual(ledger.map.size, 1, '前置: 燃烧条目在册');
  burnTicks(ledger, 1); /* 水邻后的第一刻 */
  assert.strictEqual(ledger.map.size, 0, '下一刻内台账删条(零残留)');
  assert.deepStrictEqual(quenched, [[10, 20, 30]], 'onQuench 坐标全参(消费方做 id 互换收尾)');
  assert.deepStrictEqual(rec.removed, [[10, 20, 30]], '浇熄=气流注销(与燃尽同一状态迁移点)');
  assert.deepStrictEqual(burned, [], '浇熄不是燃尽(零燃尽回调, 两态互换非消失)');
});

test('T-C3 水浇几何: 正上有水=熄 · 正下有水不熄(火在实体块顶, 底面不沾水)', () => {
  kitReady();
  const q = [];
  const ledAbove = CampfireKit.mkCampfireLedger({
    onQuench: () => q.push('above'), read: mkWaterRead(new Set(['5,3,5'])), /* 正上 */
  });
  ledAbove.plant(5, 2, 5);
  burnTicks(ledAbove, 1);
  assert.deepStrictEqual(q, ['above'], '正上有水: 下一刻熄');
  const ledBelow = CampfireKit.mkCampfireLedger({
    onQuench: () => q.push('below'), read: mkWaterRead(new Set(['7,1,7'])), /* 正下 */
  });
  ledBelow.plant(7, 2, 7);
  burnTicks(ledBelow, 10);
  assert.strictEqual(ledBelow.map.get('7,2,7').left, 5990, '正下有水: 照常烧(10 刻整减)');
  assert.strictEqual(q.length, 1, '正下不熄(零浇熄回调)');
});

test('T-C3 熄灭后零侧账长期保留: 浇熄后再喂 700s(14000 刻) — 零复活零燃尽零重复回调', () => {
  kitReady();
  let quenches = 0;
  const rec = mkUpdraftRecorder();
  const ledger = CampfireKit.mkCampfireLedger({
    onQuench: () => quenches++, read: mkWaterRead(new Set(['1,3,1'])), updraft: rec.updraft,
  });
  ledger.plant(1, 2, 1);
  burnTicks(ledger, 1); /* 浇熄 */
  burnTicks(ledger, 14000); /* 700s 长期喂: 水一直邻接 */
  assert.strictEqual(quenches, 1, '浇熄恰一次(条目已删, 无账可浇)');
  assert.strictEqual(ledger.map.size, 0, '零复活(不重挂账)');
  assert.strictEqual(rec.added.length, 1, '气流零重注册(放置时恰一次)');
  assert.strictEqual(rec.removed.length, 1, '注销恰一次');
});

test('T-C3 自然因果零防呆: 水仍邻接时重燃(plant) → 下一刻再熄(无「浇过一次就免疫」闩)', () => {
  kitReady();
  const quenched = [];
  const ledger = CampfireKit.mkCampfireLedger({
    onQuench: (x, y, z) => quenched.push([x, y, z]), read: mkWaterRead(new Set(['3,2,3'])),
  });
  ledger.plant(2, 2, 3); /* 水在东邻 (3,2,3) */
  burnTicks(ledger, 1);
  assert.strictEqual(ledger.map.size, 0, '前置: 第一次浇熄');
  ledger.plant(2, 2, 3); /* 点击重燃(kit 级=plant 满时长重建条) */
  assert.strictEqual(ledger.map.size, 1, '重燃建条');
  burnTicks(ledger, 1);
  assert.deepStrictEqual(quenched, [[2, 2, 3], [2, 2, 3]], '下一刻再熄(自然因果, 零防呆)');
});

test('T-C3 read 缺席容忍: 无 read 注入 — 燃尽路径照常(装配前/无水世界零炸)', () => {
  kitReady();
  const burned = [];
  const ledger = CampfireKit.mkCampfireLedger({onBurnout: (x, y, z) => burned.push([x, y, z])});
  ledger.plant(1, 1, 1);
  assert.doesNotThrow(() => burnTicks(ledger, 6000), '全程零 read 注入不炸');
  assert.deepStrictEqual(burned, [[1, 1, 1]], '燃尽照常(6000 刻到期恰一次)');
});

/* ---------- 篝火 T-C5: 跨图四缝(campfire-spec §3.8 跨图同烧) ----------
   opts.key 键形注入(台账/encode/回调同源) · opts.sceneGate 浇熄门禁(跨图条目
   不被当前世界水误淬) · onQuench/onBurnout 第 4 参 posKey(跨图收尾按键落桶)
   · ledger.readd presence 重注册(重进对账后气流柱重挂, 柱参单源不誊抄)。 */

test('T-C5 opts.key 注入: 台账键=注入前缀+坐标 — encode/drop/建条同源一键形(跨图键不誊抄)', () => {
  kitReady();
  const ledger = CampfireKit.mkCampfireLedger({
    key: (x, y, z) => 'n|' + x + ',' + y + ',' + z,
  });
  ledger.plant(1, 2, 3);
  assert.ok(ledger.map.has('n|1,2,3'), '建条走注入键形(带图前缀)');
  assert.ok(!ledger.map.has('1,2,3'), '裸键不在(键形单源)');
  assert.strictEqual(ledger.encode()[0][0], 'n|1,2,3', 'encode 键形同源(档键带前缀)');
  ledger.drop(1, 2, 3);
  assert.strictEqual(ledger.map.size, 0, 'drop 同键删条(破坏缝同形)');
});

test('T-C5 opts.sceneGate 门禁: 跨图条目拒答浇熄问询(误淬防线) — 放行路径照常浇熄(对照)', () => {
  kitReady();
  const quenched = [];
  const blocked = CampfireKit.mkCampfireLedger({
    key: (x, y, z) => 'n|' + x + ',' + y + ',' + z,
    read: mkWaterRead(new Set(['1,3,1'])), /* 当前世界正上方见水(纯布景) */
    sceneGate: () => false, /* 跨图条目: 不属于当前场景 → 不问 */
    onQuench: (x, y, z) => quenched.push([x, y, z]),
  });
  blocked.plant(1, 2, 1);
  burnTicks(blocked, 10);
  assert.strictEqual(blocked.map.size, 1, '门禁拒答: 跨图条目存活(零误淬)');
  assert.strictEqual(quenched.length, 0, '零浇熄回调');
  /* 对照: 同布景 sceneGate 放行 → 照常浇熄(门禁只拦跨图, 不拦本图) */
  const passed = CampfireKit.mkCampfireLedger({
    read: mkWaterRead(new Set(['1,3,1'])), sceneGate: () => true,
    onQuench: (x, y, z) => quenched.push([x, y, z]),
  });
  passed.plant(1, 2, 1);
  burnTicks(passed, 1);
  assert.strictEqual(passed.map.size, 0, '放行路径: 浇熄照常(本图水浇本图火)');
  assert.strictEqual(quenched.length, 1, '对照回调恰一次');
});

test('T-C5 回调第 4 参 posKey: onQuench/onBurnout 收台账键(带注入前缀) — 跨图收尾按键落桶的依据', () => {
  kitReady();
  const got = [];
  const quencher = CampfireKit.mkCampfireLedger({
    key: (x, y, z) => 'n|' + x + ',' + y + ',' + z,
    read: mkWaterRead(new Set(['1,3,1'])), sceneGate: () => true,
    onQuench: (x, y, z, k) => got.push(['q', x, y, z, k]),
  });
  quencher.plant(1, 2, 1);
  burnTicks(quencher, 1);
  assert.deepStrictEqual(got, [['q', 1, 2, 1, 'n|1,2,1']], '浇熄回调第 4 参=台账键(坐标在前键在后)');
  const burned = [];
  const burner = CampfireKit.mkCampfireLedger({
    key: (x, y, z) => 'n|' + x + ',' + y + ',' + z,
    onBurnout: (x, y, z, k) => burned.push(['b', x, y, z, k]),
  });
  burner.plant(1, 2, 1);
  burnTicks(burner, 6000);
  assert.deepStrictEqual(burned, [['b', 1, 2, 1, 'n|1,2,1']], '燃尽回调第 4 参=台账键');
});

test('T-C5 ledger.readd: presence 口径 sim 重注册(柱三参单源) — 未知格零炸零注册', () => {
  kitReady();
  const rec = mkUpdraftRecorder();
  const ledger = CampfireKit.mkCampfireLedger({updraft: rec.updraft});
  assert.strictEqual(typeof ledger.readd, 'function', 'readd 缝在场(重进重注册, 免誊抄柱参)');
  ledger.map.set('1,2,3', {x: 1, y: 2, z: 3, left: 4000}); /* 档恢复灌装(模拟 init 对账后) */
  ledger.readd(1, 2, 3);
  assert.strictEqual(rec.added.length, 1, '注册恰一次');
  assert.deepStrictEqual(rec.added[0], {x: 1, y: 2, z: 3, r: 1, h: 20, lift: 3},
      '柱三参单源(CAMPFIRE 参数值, spec §3.9——mode 层零誊抄)');
  ledger.readd(1, 2, 3);
  assert.strictEqual(rec.added.length, 1, '重复 readd 幂等(sim 键去重口径)');
  ledger.readd(9, 9, 9); /* 未知格: presence 口径 */
  assert.strictEqual(rec.added.length, 1, '未知格零炸零注册(台账无条不挂柱)');
});

