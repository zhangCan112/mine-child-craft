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
for (const f of ['js/config.js', 'js/mob-registry.js', 'js/voxel.js',
  'js/items-core.js', 'js/item-hint-registry.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
/* config 词法绑定不挂 vm 全局: 上下文内具名求值铺 Node globalThis(kit 经全局名
   调用期解析到真件——classic script 共享词法环境的 Node 侧镜像)。
   篝火三新名(B_CAMPFIRE/B_CAMPFIRE_OUT/CAMPFIRE)用安全代理取——红测期 config
   尚无此行, 顶层硬求值会把整文件炸成「test failed」, 各测试改收干净断言红 */
for (const n of ['BLOCKS', 'ITEMS', 'ITEM_HINTS']) {
  globalThis[n] = vm.runInContext(n, eng);
}
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
    assert.strictEqual(def.thin, 0.5, tag + '半格实体 thin 0.5(spec §3.4 物理形态裁定)');
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

test('campfire 接线: index.html script 行在册且先于 adventure.js(装载序=依赖序, boot 按真实序装载)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
  const iKit = srcs.indexOf('js/campfire-kit.js');
  const iAdv = srcs.indexOf('js/modes/adventure.js');
  assert.ok(iKit >= 0, 'script 行在册(campfire-kit.js)');
  assert.ok(iAdv >= 0, 'adventure.js 在册(哨兵)');
  assert.ok(iKit < iAdv, 'campfire-kit.js 先于 modes/adventure.js(adventure 顶层构造 kit 实例, 加载序即依赖序)');
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
