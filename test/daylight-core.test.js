'use strict';
/* 昼夜核心 (js/daylight-core.js) 单测 — node --test (零依赖)
   运行: node --test test/daylight-core.test.js
   加载器: vm context 执行 daylight-core.js (纯核心, 零依赖);
   数值与边界权威 = docs/mc-daylight-torch-design.md §2 (MC 数值依据
   docs/mc-daylight-torch-research.md §1.4/§1.6/§2.4)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCore() {
  const ctx = vm.createContext({console});
  vm.runInContext(
      fs.readFileSync(path.join(__dirname, '..', 'js', 'daylight-core.js'), 'utf8'),
      ctx, {filename: 'daylight-core.js'});
  /* 顶层 const 在共享词法环境不挂 context 对象, 以探针脚本取 (quality-core.test.js 同法) */
  return vm.runInContext('({DAYLIGHT, Daylight})', ctx);
}

/* ============ 常量表形状(§2.1) ============ */

test('常量表: 一日 24000 tick · 夜窗口 [13000, 23000) · skyDim 折线五关键点', () => {
  const {DAYLIGHT} = loadCore();
  assert.strictEqual(DAYLIGHT.TICKS, 24000, '一天 = 24000 tick = 20 分钟');
  assert.strictEqual(DAYLIGHT.NIGHT_A, 13000, '夜晚开始(差异 #15 整千口径)');
  assert.strictEqual(DAYLIGHT.NIGHT_B, 23000, '夜晚结束');
  assert.strictEqual(JSON.stringify(DAYLIGHT.DIM_KEYS),
      JSON.stringify([[0, 0], [12040, 0], [13670, 11], [22330, 11], [23961, 0]]),
      'skyDim 折线 = internal 表反推(dim = 15 − internal); JSON 比较: 跨 realm 数组原型不同(boot.test.js 同注)');
});

/* ============ advance: 时间推进(§2.1) ============ */

test('advance: dt 秒 × 20 tick/秒, 一日回绕', () => {
  const {Daylight} = loadCore();
  assert.strictEqual(Daylight.advance(0, 0.05), 1, 'dt=0.05s → +1 tick');
  assert.strictEqual(Daylight.advance(0, 60), 1200, '一分钟 = 1200 tick');
  assert.strictEqual(Daylight.advance(12000, 600), 0, '十分钟 = 12000 tick, 整日回绕到 tick 0');
  assert.strictEqual(Daylight.advance(23990, 1), 10, '日末回绕到次日清晨');
  assert.strictEqual(Daylight.advance(24010, 0), 10, '越界输入归一到 [0, 24000)');
  assert.strictEqual(Daylight.advance(5000, 0), 5000, 'dt=0 原值(纯函数不改入参)');
});

/* ============ skyDim: 折线插值(§2.1 / research §1.4) ============ */

test('skyDim: 五关键点取值精确(正午 0 → 夜 11 → 次日 0)', () => {
  const {Daylight} = loadCore();
  assert.strictEqual(Daylight.skyDim(0), 0);
  assert.strictEqual(Daylight.skyDim(12040), 0);
  assert.strictEqual(Daylight.skyDim(13670), 11);
  assert.strictEqual(Daylight.skyDim(22330), 11);
  assert.strictEqual(Daylight.skyDim(23961), 0);
  assert.strictEqual(Daylight.skyDim(24000), 0, '24000 归一同 tick 0');
  assert.strictEqual(Daylight.skyDim(18000), 11, '午夜 plateau');
});

test('skyDim: 半程插值线性(黄昏/黎明中点 = 5.5)', () => {
  const {Daylight} = loadCore();
  const duskMid = (12040 + 13670) / 2; /* 12855 */
  const dawnMid = (22330 + 23961) / 2; /* 23145.5 */
  assert.strictEqual(Daylight.skyDim(duskMid), 5.5, '黄昏半程');
  assert.strictEqual(Daylight.skyDim(dawnMid), 5.5, '黎明半程');
  assert.ok(Math.abs(Daylight.skyDim(12490) - 11 * 450 / 1630) < 1e-9, '黄昏段任意点线性');
});

/* ============ isNight: 夜窗口边界(§2.1) ============ */

test('isNight: [13000, 23000) 闭开边界', () => {
  const {Daylight} = loadCore();
  assert.strictEqual(Daylight.isNight(12999), false, '夜始前一夜');
  assert.strictEqual(Daylight.isNight(13000), true, '13000 起是夜');
  assert.strictEqual(Daylight.isNight(22999), true, '22999 仍是夜');
  assert.strictEqual(Daylight.isNight(23000), false, '23000 起日出');
  assert.strictEqual(Daylight.isNight(0), false, '清晨');
  assert.strictEqual(Daylight.isNight(6000), false, '正午');
  assert.strictEqual(Daylight.isNight(18000), true, '午夜');
  assert.strictEqual(Daylight.isNight(23999), false, '日末前');
});

/* ============ internalSky: 内部天空光(§2.1) ============ */

test('internalSky: max(0, skyLevel − skyDim) — MC 语义', () => {
  const {Daylight} = loadCore();
  assert.strictEqual(Daylight.internalSky(15, 0), 15, '正午地表 15');
  assert.strictEqual(Daylight.internalSky(15, 18000), 4, '午夜地表 4(research §1.4)');
  assert.strictEqual(Daylight.internalSky(15, 12855), 9.5, '黄昏半程 15−5.5');
  assert.strictEqual(Daylight.internalSky(3, 13670), 0, '负值钳 0');
  assert.strictEqual(Daylight.internalSky(12, 22330), 1, '黎明边缘');
  assert.strictEqual(Daylight.internalSky(8, 0), 8, '白天不衰减(无遮挡列)');
});

/* ============ renderBright: 渲染亮度锚点拟合(§2.1 / research §2.4) ============ */

test('renderBright: 三锚点 0→5% · 4→17% · 15→98%(容差 ±2%)', () => {
  const {Daylight} = loadCore();
  assert.ok(Math.abs(Daylight.renderBright(0) - 0.05) < 1e-9, '全暗 5%');
  assert.ok(Math.abs(Daylight.renderBright(4) - 0.17) <= 0.02, '夜级 4 ≈ 17%');
  assert.ok(Math.abs(Daylight.renderBright(15) - 0.98) < 1e-9, '满级 98%');
  assert.ok(Daylight.renderBright(4) < Daylight.renderBright(8) && Daylight.renderBright(8) < Daylight.renderBright(15),
      '亮度随等级单调升');
});

/* ============ skyTint / skyColor: 端点与中点(§2.1) ============ */

test('skyTint: 白天 [1,1,1] → 夜 [0.60,0.66,1.00] 按 skyDim/11 插值(月光偏蓝)', () => {
  const {Daylight} = loadCore();
  const day = Daylight.skyTint(0);
  assert.ok(Math.abs(day[0] - 1) < 1e-9 && Math.abs(day[1] - 1) < 1e-9 && Math.abs(day[2] - 1) < 1e-9, '白天无染色');
  const night = Daylight.skyTint(18000);
  assert.ok(Math.abs(night[0] - 0.60) < 1e-9 && Math.abs(night[1] - 0.66) < 1e-9 && Math.abs(night[2] - 1.00) < 1e-9,
      '午夜满染');
  const mid = Daylight.skyTint(12855); /* dim=5.5 → k=0.5 */
  assert.ok(Math.abs(mid[0] - 0.8) < 1e-9 && Math.abs(mid[1] - 0.83) < 1e-9 && Math.abs(mid[2] - 1) < 1e-9, '半程中点');
});

test('skyColor: 天空/雾色 白日 #8fc7ff ↔ 夜 #0a1430 按 skyDim/11 插值', () => {
  const {Daylight} = loadCore();
  const day = Daylight.skyColor(0);
  assert.ok(Math.abs(day[0] - 143 / 255) < 1e-4 && Math.abs(day[1] - 199 / 255) < 1e-4 && Math.abs(day[2] - 1) < 1e-9,
      '白日 = world.js 现状天色 #8fc7ff');
  const night = Daylight.skyColor(18000);
  assert.ok(Math.abs(night[0] - 10 / 255) < 1e-4 && Math.abs(night[1] - 20 / 255) < 1e-4 &&
    Math.abs(night[2] - 48 / 255) < 1e-4,
  '午夜 #0a1430');
});

/* ============ sleepWindow: 睡觉窗口(§2.1 / research §1.6 裁决) ============ */

test('sleepWindow: ⇔ 晴天 [12542, 23459](闭开区间, 23460 起不可睡)', () => {
  const {Daylight} = loadCore();
  assert.strictEqual(Daylight.sleepWindow(12541), false, '窗口前一 tick');
  assert.strictEqual(Daylight.sleepWindow(12542), true, '12542 起可睡');
  assert.strictEqual(Daylight.sleepWindow(23459), true, '23459 是最后一刻可睡');
  assert.strictEqual(Daylight.sleepWindow(23460), false, '23460 起不可睡');
  assert.strictEqual(Daylight.sleepWindow(0), false, '清晨不可睡');
  assert.strictEqual(Daylight.sleepWindow(12000), false, '日落开始仍不可睡');
  assert.strictEqual(Daylight.sleepWindow(18000), true, '午夜可睡');
  assert.strictEqual(Daylight.sleepWindow(23999), false, '黎明尾声不可睡');
});

