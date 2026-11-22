'use strict';
/* 篝火特效核心 (js/campfire-fx-core.js) 契约测试 — node --test (零依赖)
   运行: node --test test/campfire-fx-core.test.js
   T-C9 世界特效(篝火票据, 观感唯一权威 docs/design/campfire-visual-spec.md §5 C 区):
   本文件收特效系统纯逻辑面——
   ① 参数表单源(§5.2 火苗/§5.3 烟柱/§5.4 柔柱+旋涡, 定稿数值逐项断言) +
      低核触屏档减半(§5.9/表第二列) + 多篝火预算(>3 座降档/>40 格只留烟);
   ② 火苗颜色生命周期三锚(#ffff97→#ff8f00→#e05a1a)/烟暖白 #d6d2c8 vs 风冷白
      #f5f7f3 色温差分色(UI 定稿新色不改);
   ③ 三过渡(§5.5 点燃 pop+渐起 0.5s/§5.6 燃尽渐熄 ≤2s 全清/§5.7 浇熄即刻摘)+
      渐弱(§5.8 剩余 ≤10% 触发、火苗 40%、气柱烟不衰减、双写口径 600 刻=30s);
   ④ 句柄生命周期五纪律(§5.1: 放置=开/三态摘/clear 清场/悬空无害/摘后重启);
   ⑤ 发射节拍(发射计数守恒/寿命域/运动域)+确定性 rng(mulberry32 每源派生,
      同源同流/异源异流=相位错开有据);
   ⑥ 源码卫生: 零墙钟(Date.now/performance.now)/零裸 Math.random/零引擎零 DOM
      实调/零 campfire 音效字面量(T-C11 未登记前零落盘——守门口径,
      campfire-kit.test 零墙钟扫描先例);
   ⑦ 焰片面(T-C13-R3, v1.10 §4/§5.8): params.flamePlanes 参数单源(3 帧 0.15s/帧/
      渐弱 ×(1+tint·fadeMul) 0.30s 封顶/低核 ×2 恒档)+flamePhase 格相位(cellSeed
      派生 ∈[0,1), 同格同流/异格异流/重开一致)+flameFrameAt 帧号纯函数
      (翻页/渐弱降档/低核恒档全下沉本核心, R-4 焰片 sheet 只消费);
      §5.2 火苗发射器转性降档(6→2/3→1 终裁)随 rate 断言与 bench 计数同拍改。
   纯表现层声明(spec §3.7/UI 定稿 §5.1): 粒子可非确定、可按帧率分档、零玩法判定——
   本核心只产观感状态, 不碰世界账本(台账/燃尽时钟归 campfire-kit)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/* 被测核心容错装载: 红测期 js/campfire-fx-core.js 尚未新建, MODULE_NOT_FOUND 在
   顶层会把整文件炸成「test failed」——改为缺位旗标, 各测试自行断言在册红
   (campfire-kit.test.js 同款先例, 红因=断言红非装具炸, conventions §7.4) */
let CampfireFxCore = null;
try {
  CampfireFxCore = require('../js/campfire-fx-core.js');
} catch {
  CampfireFxCore = null;
}
const coreReady = () => {
  assert.ok(CampfireFxCore && typeof CampfireFxCore.mkCampfireFx === 'function',
      'js/campfire-fx-core.js 在册且暴露 CampfireFxCore.mkCampfireFx(新建文件, 票面要求 1)');
};

/* 桌面档工厂(缺省参数=spec §3.9 初值 + 定稿 §5 桌面列) */
function mk(o) {
  return CampfireFxCore.mkCampfireFx(Object.assign({}, o));
}
const FIRE = {x: 10, y: 25, z: 10}; /* 标准火位: 方块基 y=25, 发射点/高度域全相对它 */

/* ============ ① 模块在册 + 参数表单源(UI 定稿 §5.2–5.4 逐项) ============ */

test('篝火特效核心在册: js/campfire-fx-core.js 暴露 mkCampfireFx 工厂(纯核心新文件)', () => {
  coreReady();
});

test('§5.2 火苗发射器参数表(桌面列逐项): 速率 2(v1.10 §5.2 转性降档终裁 6→2)/寿命 0.5~0.7/上升 0.9~1.3/漂移 ±0.15/' +
    '发射点 y+0.4 散布 ±0.25/尺寸 0.10~0.16→0.02/透明度 0.9', () => {
  coreReady();
  const p = mk().params.flame;
  assert.strictEqual(p.rate, 2,
      '发射速率 2 粒/s(桌面档; v1.10 §5.2 转性: 火焰本体归焰片面, 粒子降档为低频焰屑 6→2, 终裁保留)');
  assert.strictEqual(p.rateLow, 1,
      '低核档 1 粒/s(§5.9 减半; v1.10 转性降档 3→1 终裁)');
  assert.strictEqual(p.lifeMin, 0.5, '单粒寿命下限 0.5s');
  assert.strictEqual(p.lifeMax, 0.7, '单粒寿命上限 0.7s');
  assert.strictEqual(p.riseMin, 0.9, '上升速度下限 0.9 格/s');
  assert.strictEqual(p.riseMax, 1.3, '上升速度上限 1.3 格/s');
  assert.strictEqual(p.driftAmp, 0.15, '水平正弦漂移 ±0.15 格');
  assert.strictEqual(p.launchY, 0.4, '发射点 y+0.4(篝火方块中心上方)');
  assert.strictEqual(p.scatter, 0.25, '水平散布 ±0.25 格');
  assert.strictEqual(p.sizeMin, 0.10, '出生尺寸下限 0.10 格');
  assert.strictEqual(p.sizeMax, 0.16, '出生尺寸上限 0.16 格');
  assert.strictEqual(p.sizeEnd, 0.02, '消亡尺寸 0.02 格(收火)');
  assert.strictEqual(p.opacity, 0.9, '透明度 0.9 线性降至 0');
});

test('§5.3 烟柱发射器参数表(桌面列逐项): 速率 2/发射点 y+1.2 ±0.2/寿命 3.5~4.5/' +
    '初速 1.4 减速至 0.4/摆 ±0.35 周期 2.5s/尺寸 0.14→0.55/暖灰白恒色/opacity 0.45→0', () => {
  coreReady();
  const p = mk().params.smoke;
  assert.strictEqual(p.rate, 2, '发射速率 2 粒/s(桌面档)');
  assert.strictEqual(p.rateLow, 1, '低核档 1 粒/s(速率减半)');
  assert.strictEqual(p.launchY, 1.2, '发射点火苗顶 y+1.2');
  assert.strictEqual(p.scatter, 0.2, '水平散布 ±0.2 格');
  assert.strictEqual(p.lifeMin, 3.5, '寿命下限 3.5s');
  assert.strictEqual(p.lifeMax, 4.5, '寿命上限 4.5s');
  assert.strictEqual(p.rise0, 1.4, '初速 1.4 格/s(前快)');
  assert.strictEqual(p.rise1, 0.4, '末速 0.4 格/s(后慢=热烟线性减速)');
  assert.strictEqual(p.swayAmp, 0.35, '正弦摆 ±0.35 格');
  assert.strictEqual(p.swayPeriod, 2.5, '摆周期 2.5s');
  assert.strictEqual(p.size0, 0.14, '出生尺寸 0.14 格');
  assert.strictEqual(p.size1, 0.55, '消亡尺寸 0.55 格(膨胀=烟散开)');
  assert.strictEqual(p.color, '#d6d2c8', '暖灰白恒色 #d6d2c8(UI 定稿新色, 不改)');
  assert.strictEqual(p.opacity0, 0.45, 'opacity 0.45→0 线性');
});

test('§5.4 柔柱+旋涡参数表(桌面列逐项): 柱径 2.6/高=柱满高/风白 #f5f7f3/opacity 0.10±0.05 ' +
    '周期 3.7s/低核 0.06 常值 · 旋涡 16 粒/角速 1.3/半径 0.5~1.1/上升 3.0±0.5/y+0.5 起/尺寸 0.08~0.13', () => {
  coreReady();
  const fx = mk();
  const c = fx.params.column;
  assert.strictEqual(c.diameter, 2.6, '柔柱直径 2.6 格(3×3 截面内切观感)');
  assert.strictEqual(c.h, 20, '柱高=柱满高缺省 20 格(spec §3.9 参数表唯一权威)');
  assert.strictEqual(c.color, '#f5f7f3', '柔柱冷亮白 #f5f7f3(UI 定稿新色, 不改)');
  assert.strictEqual(c.opacityBase, 0.10, 'opacity 基线 0.10');
  assert.strictEqual(c.pulseAmp, 0.05, '正弦脉动 ±0.05(portalBeam 脉动手法同源)');
  assert.strictEqual(c.pulsePeriod, 3.7, '脉动周期 3.7s');
  assert.strictEqual(c.lowOpacity, 0.06, '低核档 opacity 0.06 常值(脉动砍)');
  const v = fx.params.vortex;
  assert.strictEqual(v.count, 16, '活跃粒数 16 粒/柱(桌面档)');
  assert.strictEqual(v.countLow, 8, '低核档 8 粒/柱');
  assert.strictEqual(v.angVel, 1.3, '公转角速度 1.3 rad/s');
  assert.strictEqual(v.radiusMin, 0.5, '公转半径下限 0.5 格(3×3 内缘)');
  assert.strictEqual(v.radiusMax, 1.1, '公转半径上限 1.1 格');
  assert.strictEqual(v.rise, 3.0, '上升 3.0 格/s(观感预告乘流升速初值)');
  assert.strictEqual(v.riseJitter, 0.5, '上升抖动 ±0.5 格/s');
  assert.strictEqual(v.startH, 0.5, '高度域起点 y+0.5');
  assert.strictEqual(v.sizeMin, 0.08, '尺寸下限 0.08 格');
  assert.strictEqual(v.sizeMax, 0.13, '尺寸上限 0.13 格');
  assert.strictEqual(v.color, '#f5f7f3', '旋涡冷亮白 #f5f7f3');
  assert.strictEqual(v.opacity, 0.75, '旋涡 opacity 0.75');
  assert.strictEqual(v.dir, -1, '旋向常量统一(全部篝火同向不打架, §5.4 旋向行)');
});

test('§5.4 柔柱柱高单源: 注入 columnH 覆盖生效(观感柱恒满高, 遮挡穿模=已知边界不跟随截断)', () => {
  coreReady();
  assert.strictEqual(mk({columnH: 12}).params.column.h, 12,
      '注入 12 格即 12 格(生产传 CAMPFIRE.columnH)');
  assert.strictEqual(mk().params.column.h, 20, '缺省=20 格(spec §3.9 初值)');
});

test('火苗颜色生命周期三锚(#ffff97 出生→40% #ff8f00→80% #e05a1a): 锚点逐字+段间连续插值', () => {
  coreReady();
  assert.strictEqual(CampfireFxCore.flameColorAt(0), '#ffff97', '出生 #ffff97(逐字)');
  assert.strictEqual(CampfireFxCore.flameColorAt(0.4), '#ff8f00', '40% 寿命 #ff8f00(逐字)');
  assert.strictEqual(CampfireFxCore.flameColorAt(0.8), '#e05a1a', '80% 寿命 #e05a1a(逐字)');
  assert.strictEqual(CampfireFxCore.flameColorAt(1), '#e05a1a', '段尾持色(淡出归透明度通道)');
  const mid = CampfireFxCore.flameColorAt(0.2);
  const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  for (let i = 0; i < 3; i++) {
    const a = ch('#ffff97', i); const b = ch('#ff8f00', i); const m = ch(mid, i);
    assert.ok(m >= Math.min(a, b) && m <= Math.max(a, b),
        'p=0.2 三通道落在首段两端之间(连续插值非跳变)·通道' + i);
  }
});

test('烟暖白 #d6d2c8 vs 风冷白 #f5f7f3 色温差分色(§5.10 同屏对比走查的程序面)', () => {
  coreReady();
  const p = mk().params;
  assert.notStrictEqual(p.smoke.color, p.vortex.color, '烟色≠风色(分色)');
  assert.notStrictEqual(p.smoke.color, p.column.color, '烟色≠柔柱色(风族同冷白)');
  const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  assert.ok(ch(p.smoke.color, 0) < ch(p.vortex.color, 0),
      '暖灰白红通道低于冷亮白(色温方向: 烟暖风冷)');
});

/* ============ ② 低核分档 + 多篝火预算(§5.9) ============ */

test('低核触屏档: 速率减半(火苗 1(v1.10 转性降档 3→1)/烟 1/旋涡 8 粒)+柔柱 0.06 常值(脉动砍)', () => {
  coreReady();
  const fx = mk({lowcore: true});
  const p = fx.params;
  assert.strictEqual(p.lowcore, true, '分档旗标透出');
  assert.strictEqual(p.flame.rate, 1, '火苗 1 粒/s(v1.10 §5.2 转性降档终裁 3→1, §5.9 减半档)');
  assert.strictEqual(p.smoke.rate, 1, '烟 1 粒/s(2 减半)');
  assert.strictEqual(p.vortex.count, 8, '旋涡 8 粒/柱(16 减半)');
  assert.strictEqual(fx.columnOpacityAt(0), 0.06, '柔柱 opacity 恒 0.06(常值, 脉动砍)');
  assert.strictEqual(fx.columnOpacityAt(3.7 / 4), 0.06, '脉动峰值处仍 0.06(常值非低幅脉动)');
});

test('桌面档柔柱脉动: 0.10±0.05 正弦周期 3.7s(portalBeam 脉动手法同源)', () => {
  coreReady();
  const fx = mk();
  assert.strictEqual(fx.columnOpacityAt(0), 0.10, 't=0 基线 0.10(sin0=0)');
  assert.ok(Math.abs(fx.columnOpacityAt(3.7 / 4) - 0.15) < 1e-9, '四分之一周期达上振幅 0.15');
  assert.ok(Math.abs(fx.columnOpacityAt(3 * 3.7 / 4) - 0.05) < 1e-9, '四分之三周期达下振幅 0.05');
  assert.ok(Math.abs(fx.columnOpacityAt(3.7) - 0.10) < 1e-9, '整周期回基线(周期 3.7s)');
});

test('§5.9 多篝火预算: ≤3 座全额 · 第 4 座起「烟全额+火苗半速+旋涡半数」 · >40 格只留烟柱', () => {
  coreReady();
  const dist = {'10,25,10': 5, '11,25,10': 10, '12,25,10': 15, '13,25,10': 20, '14,25,10': 50};
  const fx = mk({distOf: (x, y, z) => dist[x + ',' + y + ',' + z]});
  for (const k of Object.keys(dist)) {
    const [x, y, z] = k.split(',').map(Number);
    fx.open(x, y, z);
  }
  fx.tick(0.5); /* 渐起爬满 */
  const full = fx.emitters(10, 25, 10);
  assert.strictEqual(full.budget, 'full', '最近第 1 座: 全额档');
  assert.strictEqual(full.flame.rate, 2, '火苗全额 2/s(v1.10 §5.2 转性降档)');
  assert.strictEqual(full.smoke.rate, 2, '烟全额 2/s');
  assert.strictEqual(full.vortex.count, 16, '旋涡全额 16 粒');
  const near = fx.emitters(13, 25, 10);
  assert.strictEqual(near.budget, 'near', '第 4 座(距 20): 降档');
  assert.strictEqual(near.flame.rate, 1, '火苗半速 1/s(v1.10 转性降档后 2→1)');
  assert.strictEqual(near.smoke.rate, 2, '烟柱全额(降档清单没它)');
  assert.strictEqual(near.vortex.count, 8, '旋涡半数 8 粒');
  const far = fx.emitters(14, 25, 10);
  assert.strictEqual(far.budget, 'far', '>40 格: 只留烟柱');
  assert.strictEqual(far.flame.rate, 0, '远火火苗 0');
  assert.strictEqual(far.smoke.rate, 2, '远火烟柱全额(远距信号本分, §5.10 判据一)');
  assert.strictEqual(far.vortex.count, 0, '远火旋涡 0');
  assert.strictEqual(far.column.opacityScale, 0, '远火柔柱 0(只留烟)');
});

test('§5.9 预算缺省容忍: distOf 未注入=全额档(装配前/测试语境零炸)', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5);
  assert.strictEqual(fx.emitters(FIRE.x, FIRE.y, FIRE.z).budget, 'full', '无距离缝=全额');
});

/* ============ ③ 渐弱(§5.8: 剩余 ≤10% 触发, 双写口径 600 刻=30s) ============ */

test('§5.8 渐弱触发: 剩余比例 ≤10%(600 刻)进入渐弱窗 · 桌面满额零渐弱', () => {
  coreReady();
  const fx = mk(); /* fullTicks 缺省 6000 */
  assert.strictEqual(fx.fadeState(6000).active, false, '满时长: 未进渐弱窗');
  assert.strictEqual(fx.fadeState(601).active, false, '剩余 601 刻(>10%): 未触发');
  assert.strictEqual(fx.fadeState(600).active, true, '剩余 600 刻(恰 10%): 触发');
  assert.strictEqual(fx.fadeState(599).active, true, '剩余 599 刻: 渐弱中');
  assert.strictEqual(fx.fadeState(0).active, true, '剩余 0: 渐弱窗尾(燃尽瞬间衔接 §5.6)');
  /* 双写口径拍板下恒等价(UI 定稿 §5.8): 剩余 ≤10% ⇔ 燃尽前最后 30 秒 */
  assert.strictEqual(600 / 20, 30, '600 刻 @20tps = 30s(整数刻游戏钟拍板, 两表述等价任取其一)');
});

test('§5.8 渐弱档位: 火苗线性降至满额 40%+焰色向 #e05a1a 插值 · 烟与气柱 scale 恒 1(不衰减)', () => {
  coreReady();
  const fx = mk();
  const s0 = fx.fadeState(600);
  assert.strictEqual(s0.flameScale, 1, '窗起点火苗满额(线性降到 40% 的起点)');
  assert.strictEqual(s0.tint, 0, '窗起点零插值');
  const sMid = fx.fadeState(300);
  assert.ok(Math.abs(sMid.flameScale - 0.7) < 1e-9, '窗中点火苗 70%(线性降到 40% 的中点)');
  assert.ok(Math.abs(sMid.tint - 0.5) < 1e-9, '窗中点焰色插值一半');
  const sEnd = fx.fadeState(0);
  assert.strictEqual(sEnd.flameScale, 0.4, '窗尾火苗 40%(「火小了」定稿值)');
  assert.strictEqual(sEnd.tint, 1, '窗尾焰色插值满格(向 #e05a1a)');
  for (const s of [fx.fadeState(600), fx.fadeState(300), fx.fadeState(60)]) {
    assert.strictEqual(s.smokeScale, 1, '烟量不变(渐弱窗内恒满额)');
    assert.strictEqual(s.columnScale, 1, '气柱观感完全不衰减(乘流可预期到最后一秒, ADR 0017 相容)');
  }
  assert.ok(fx.fadeState(300).flameScale < fx.fadeState(500).flameScale,
      '窗内单调递减(剩余越少火越小)');
  /* 焰色插值端点: k=1 全 #e05a1a, k=0 原色 */
  assert.strictEqual(CampfireFxCore.fadeTint('#ff8f00', 1), '#e05a1a', '插值满格=#e05a1a');
  assert.strictEqual(CampfireFxCore.fadeTint('#ff8f00', 0), '#ff8f00', '零插值=原色');
});

test('渐弱喂缝: setLeft 驱动发射器实际速率(渐弱只发生在世界内火焰本身)', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5); /* 渐起爬满 */
  assert.strictEqual(fx.emitters(FIRE.x, FIRE.y, FIRE.z).flame.rateScale, 1, '前置: 满额');
  fx.setLeft(FIRE.x, FIRE.y, FIRE.z, 300);
  const e = fx.emitters(FIRE.x, FIRE.y, FIRE.z);
  assert.ok(Math.abs(e.flame.rateScale - 0.7) < 1e-9, '喂余量 300 刻: 火苗 rateScale=0.7');
  assert.strictEqual(e.smoke.rateScale, 1, '烟不衰减');
  assert.strictEqual(e.column.opacityScale, 1, '柔柱不衰减');
  fx.setLeft(99, 25, 99, 100); /* 未知格零炸(presence 口径) */
});

/* ============ ④ 三过渡(§5.5 点燃 / §5.6 燃尽 / §5.7 浇熄) ============ */

test('§5.5 点燃过渡: pop(#ff8f00, r 0.3→1.6, 0.35s, op 0.9)+三发射器 0.5s 线性渐起', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  const pop = fx.particles(FIRE.x, FIRE.y, FIRE.z).transients.find((t) => t.kind === 'pop');
  assert.ok(pop, '点燃 pop 在册');
  assert.strictEqual(pop.color, '#ff8f00', 'pop 色 #ff8f00');
  assert.strictEqual(pop.r0, 0.3, 'r0 0.3 格');
  assert.strictEqual(pop.r1, 1.6, 'r1 1.6 格');
  assert.strictEqual(pop.dur, 0.35, 'dur 0.35s');
  assert.strictEqual(pop.opacity, 0.9, 'opacity 0.9(pop 现行默认)');
  assert.strictEqual(fx.emitters(FIRE.x, FIRE.y, FIRE.z).flame.rateScale, 0,
      'open 瞬间速率 0(渐起起点)');
  fx.tick(0.25);
  const half = fx.emitters(FIRE.x, FIRE.y, FIRE.z).flame.rateScale;
  assert.ok(half > 0 && half < 1, '爬坡中点速率在 0~1 之间(线性渐起)');
  fx.tick(0.25);
  assert.strictEqual(fx.emitters(FIRE.x, FIRE.y, FIRE.z).flame.rateScale, 1,
      '0.5s 爬满(火「噗」地起来, 不是瞬满)');
});

test('§5.5 禁用面: 点燃零 kick 震屏零 debrisBurst(一次性面只有 pop/白汽/尾烟三 kind)', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5);
  const kinds = fx.particles(FIRE.x, FIRE.y, FIRE.z).transients.map((t) => t.kind);
  assert.ok(!kinds.includes('kick') && !kinds.includes('debris'),
      '零 kick/零 debris 条目(零惊吓红线)');
  fx.quench(FIRE.x, FIRE.y, FIRE.z);
  fx.burnout(FIRE.x, FIRE.y, FIRE.z); /* 空转: 已摘零炸 */
});

test('§5.6 燃尽两处形状(评审 SPEC-2 翻新裁定): 火苗发射率 0.4s 线性降 0 · 柔柱透明度 0.3s 线性降 0 后摘 · ' +
    '旋涡停止补充 · ≤2s 全清无残影 · 轻灰 pop(#d6d2c8, 0.4→1.2, 0.5s, op 0.5)+尾烟 3 粒 1.5s 散尽', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  for (let i = 0; i < 5; i++) fx.tick(0.1); /* 渐起爬满, 粒子在飞 */
  fx.burnout(FIRE.x, FIRE.y, FIRE.z);
  assert.strictEqual(fx.active(FIRE.x, FIRE.y, FIRE.z), false, '燃尽即摘(燃烧在册退场, onBurnout 缝同拍)');
  /* 余韵期发射器可达+两处衰减形状如实(评审 SPEC-2: 燃尽非一帧消失) */
  fx.tick(0.1);
  fx.tick(0.1); /* 燃尽后 0.2s */
  const eg = fx.emitters(FIRE.x, FIRE.y, FIRE.z);
  assert.ok(eg && Math.abs(eg.flame.rateScale - 0.5) < 1e-9,
      '燃尽后 0.2s 火苗半速(rateScale=(0.4−0.2)/0.4=0.5, 实际发射乘子如实 — ' +
      '断言红实证: 现实现燃尽即摘快照 null)');
  assert.ok(eg && Math.abs(eg.column.opacityScale - 1 / 3) < 1e-9 && eg.column.opacity > 0,
      '燃尽后 0.2s 柔柱仍可见(opacityScale=(0.3−0.2)/0.3≈1/3, §5.6 柔柱 0.3s 降 0)');
  const pop = fx.particles(FIRE.x, FIRE.y, FIRE.z).transients.find((t) => t.kind === 'pop');
  assert.ok(pop && pop.color === '#d6d2c8', '轻灰 pop #d6d2c8(「轻轻散掉」)');
  assert.strictEqual(pop.r0, 0.4, 'r0 0.4');
  assert.strictEqual(pop.r1, 1.2, 'r1 1.2');
  assert.strictEqual(pop.dur, 0.5, 'dur 0.5s');
  assert.strictEqual(pop.opacity, 0.5, 'opacity 0.5');
  const tail = fx.particles(FIRE.x, FIRE.y, FIRE.z).transients.filter((t) => t.kind === 'tailSmoke');
  assert.strictEqual(tail.length, 3, '尾烟恰 3 粒(一撮)');
  assert.ok(tail.every((t) => t.color === '#d6d2c8'), '尾烟灰白(§5.3 参数族)');
  assert.ok(tail.every((t) => t.life <= 1.5), '尾烟 1.5s 散尽(寿命帽)');
  assert.ok(fx.particles(FIRE.x, FIRE.y, FIRE.z).flame.length > 0,
      '渐熄期存量+余韵火苗在飞(非即刻清)');
  for (let i = 0; i < 3; i++) fx.tick(0.1); /* 燃尽后 0.5s: 两衰减均完(火苗 0.4s/柔柱 0.3s) */
  assert.strictEqual(fx.emitters(FIRE.x, FIRE.y, FIRE.z), null, '余韵期满(0.4s): 发射器快照退场');
  fx.tick(2.0);
  const after = fx.particles(FIRE.x, FIRE.y, FIRE.z);
  assert.strictEqual(after.flame.length + after.smoke.length + after.vortex.length, 0,
      '≤2s 全清(无残影帧, ADR 0018 干净消失; 余韵增量粒子 ≤0.4s+寿命 ≤0.7s 不破预算)');
  assert.strictEqual(after.transients.length, 0, '过渡尾巴也清(pop 0.5s/尾烟 1.5s ≤ 2s)');
});

test('§5.7 浇熄过渡: 即刻摘除零火苗残帧 · 白汽 pop(#f5f7f3, 0.3→1.4, 0.4s, op 0.6)+4 粒 0.8s 上升 1 格/s', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5); /* 满负荷粒子在飞 */
  fx.quench(FIRE.x, FIRE.y, FIRE.z);
  assert.strictEqual(fx.active(FIRE.x, FIRE.y, FIRE.z), false, '浇熄即刻摘(句柄 remove 同款)');
  const now = fx.particles(FIRE.x, FIRE.y, FIRE.z);
  assert.strictEqual(now.flame.length + now.smoke.length + now.vortex.length, 0,
      '无火苗残帧(即刻摘除, 非渐熄)');
  const pop = now.transients.find((t) => t.kind === 'pop');
  assert.ok(pop && pop.color === '#f5f7f3', '白汽 pop 色 #f5f7f3(一缕白汽)');
  assert.strictEqual(pop.r0, 0.3, 'r0 0.3');
  assert.strictEqual(pop.r1, 1.4, 'r1 1.4');
  assert.strictEqual(pop.dur, 0.4, 'dur 0.4s');
  assert.strictEqual(pop.opacity, 0.6, 'opacity 0.6');
  const steam = now.transients.filter((t) => t.kind === 'steam');
  assert.strictEqual(steam.length, 4, '白汽粒恰 4 粒');
  assert.ok(steam.every((t) => t.life === 0.8), '白汽寿命 0.8s');
  assert.ok(steam.every((t) => t.rise === 1.0), '白汽上升 1 格/s');
  fx.tick(0.8);
  assert.strictEqual(fx.particles(FIRE.x, FIRE.y, FIRE.z).transients.length, 0, '白汽 0.8s 后散尽');
});

test('浇熄格回收(R-7 加带二): 浇熄格余韵期满查询面退场(燃尽同款对称) · 白汽散尽后格回收' +
    '(cells 泄漏清零) · 窗口内 dig 悬空无害 · 燃尽对照回收不回退', () => {
  coreReady();
  /* 泄漏清零主面: 旧径 quench 不置时间戳 → 回收门只认 burnoutAt → 浇熄格永不
     回收、永在 cells() 清单(adventure 82 常驻 → 每熄火位址整套场格 Group 滞留) */
  const listed = (fx) => fx.cells().some(
      (c) => c.x === FIRE.x && c.y === FIRE.y && c.z === FIRE.z);
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5);
  fx.quench(FIRE.x, FIRE.y, FIRE.z);
  assert.ok(listed(fx), '浇熄即刻: 格在册(open=false 过渡期, 白汽在飞)');
  fx.tick(0.5); /* 累计 0.5s ≥ BURN_FLAME_S 0.4s 余韵期满 */
  assert.strictEqual(listed(fx), false,
      '浇熄 0.5s: 查询面退场(燃尽余韵期满同款对称; 旧径永在册必红)');
  fx.tick(0.5); /* 累计 1.0s ≥ 白汽 0.8s hold */
  const after = fx.particles(FIRE.x, FIRE.y, FIRE.z);
  assert.strictEqual(
      after.flame.length + after.smoke.length + after.vortex.length + after.transients.length, 0,
      '白汽散尽后四数组全空(格回收, 瞬态池零残留)');
  /* 在册新格不受误伤(回收门只清期满闭格) */
  fx.open(11, 25, 10);
  fx.tick(0.1);
  assert.ok(fx.cells().some((c) => c.x === 11 && c.y === 25 && c.z === 10),
      '新燃格恒在册(回收门不误伤开格)');
  /* 窗口内 dig 悬空无害: 非开格早退(五纪律保留), 残格仍由回收门兜底清账 */
  const fx2 = mk();
  fx2.open(FIRE.x, FIRE.y, FIRE.z);
  fx2.tick(0.5);
  fx2.quench(FIRE.x, FIRE.y, FIRE.z);
  fx2.dig(FIRE.x, FIRE.y, FIRE.z); /* 浇熄后 dig: !open 早退零副作用零删除 */
  fx2.tick(0.1);
  assert.ok(listed(fx2),
      '浇熄+dig 窗口内不提前删格(挖=回收非事件, 摘除幂等语义保留)');
  fx2.tick(0.5);
  assert.strictEqual(listed(fx2), false,
      '浇熄+dig 后仍按回收门清账(泄漏清零口径第二路径: 挖掉熄灭篝火也不滞留)');
  /* 燃尽对照(保全): 既有回收语义不回退(回收门扩展不破燃尽路径) */
  const fx3 = mk();
  fx3.open(FIRE.x, FIRE.y, FIRE.z);
  fx3.tick(0.5);
  fx3.burnout(FIRE.x, FIRE.y, FIRE.z);
  fx3.tick(0.5);
  assert.strictEqual(listed(fx3), false,
      '燃尽 0.5s: 查询面退场(既有语义, 回收门扩展不回退)');
});

test('挖掘=摘(§5.1): 即刻摘除零过渡零 pop · 燃尽渐熄中再 dig 不重启不炸(悬空无害)', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5);
  fx.dig(FIRE.x, FIRE.y, FIRE.z);
  assert.strictEqual(fx.active(FIRE.x, FIRE.y, FIRE.z), false, '挖掘即刻摘');
  assert.strictEqual(fx.particles(FIRE.x, FIRE.y, FIRE.z).transients.length, 0,
      '零过渡零 pop(挖掘是回收非事件)');
  fx.dig(FIRE.x, FIRE.y, FIRE.z); /* 重复 dig 零炸 */
  fx.burnout(FIRE.x, FIRE.y, FIRE.z); /* 已摘再燃尽=空转零炸 */
  /* 渐熄中再 dig: 不取消渐熄尾巴 */
  const fx2 = mk();
  fx2.open(11, 25, 10);
  fx2.tick(0.5);
  fx2.burnout(11, 25, 10);
  fx2.dig(11, 25, 10);
  assert.ok(fx2.particles(11, 25, 10).transients.some((t) => t.kind === 'tailSmoke'),
      '渐熄尾巴不被 dig 取消(过渡是观感事件, 摘除幂等)');
});

/* ============ ⑤ 句柄生命周期五纪律(§5.1) + clear/读档恢复 ============ */

test('§5.1 句柄五纪律: open 幂等(不重置不翻倍) · clear 清场 · 悬空无害 · 摘后重开恢复', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5); /* 渐起爬满 */
  fx.open(FIRE.x, FIRE.y, FIRE.z); /* 幂等: 二次开零变化 */
  assert.strictEqual(fx.emitters(FIRE.x, FIRE.y, FIRE.z).flame.rateScale, 1,
      '重复 open 不重置渐起(rateScale 不回 0)');
  assert.strictEqual(fx.particles(FIRE.x, FIRE.y, FIRE.z).transients.filter((t) => t.kind === 'pop').length, 1,
      '重复 open 不重发点燃 pop(恰一次)');
  fx.clear();
  assert.strictEqual(fx.active(FIRE.x, FIRE.y, FIRE.z), false, 'clear 连带清场(模式切换纪律)');
  assert.strictEqual(fx.particles(FIRE.x, FIRE.y, FIRE.z).flame.length, 0, 'clear 粒子零残留');
  /* 悬空句柄无害: clear 后全部摘除面零炸且不复活 */
  fx.quench(FIRE.x, FIRE.y, FIRE.z);
  fx.burnout(FIRE.x, FIRE.y, FIRE.z);
  fx.dig(FIRE.x, FIRE.y, FIRE.z);
  fx.setLeft(FIRE.x, FIRE.y, FIRE.z, 100);
  assert.strictEqual(fx.active(FIRE.x, FIRE.y, FIRE.z), false, '悬空操作零复活');
  /* 摘后重开=恢复(读档恢复燃烧中篝火=三发射器即刻在位, §5.10) */
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5);
  assert.strictEqual(fx.active(FIRE.x, FIRE.y, FIRE.z), true, '重开即恢复');
  assert.strictEqual(fx.emitters(FIRE.x, FIRE.y, FIRE.z).flame.rateScale, 1,
      '重开渐起重新爬满(新的一炉非续旧)');
});

test('active/emitters/particles 查询面: 未开格 active=false · emitters=null · particles 空形状可查', () => {
  coreReady();
  const fx = mk();
  assert.strictEqual(fx.active(FIRE.x, FIRE.y, FIRE.z), false, '未开=不活跃');
  assert.strictEqual(fx.emitters(FIRE.x, FIRE.y, FIRE.z), null, '未开=无发射器快照');
  const empty = fx.particles(FIRE.x, FIRE.y, FIRE.z);
  const okShape = Array.isArray(empty.flame) && Array.isArray(empty.smoke) &&
      Array.isArray(empty.vortex) && Array.isArray(empty.transients);
  assert.ok(okShape, '未开 particles=四空数组(查询面形状恒定)');
});

/* ============ ⑥ 发射节拍 + 粒子推进(数量守恒/寿命域/运动域) ============ */

test('发射积分口径(评审 SPEC-1 翻新裁定, 修法①改实现; v1.10 转性降档 rate=2 期望值重算): 渐起窗发射=∫rate·ramp dt 非矩形满速 — ' +
    '0.5s 期望 ≤1 粒(∫₀^0.5 2·(t/0.5)dt=0.5) · 1s ∈{1,2}(∫=1.5) · 满速段守恒恢复 0.5s=1 · ' +
    '快照 rateScale=实际发射乘子(0.2s 处=0.4 如实)', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  for (let i = 0; i < 5; i++) fx.tick(0.1); /* 0.5s 渐起窗细分驱动(拍内采样离散不越带) */
  let e = fx.emitters(FIRE.x, FIRE.y, FIRE.z);
  assert.ok(e.flame.emitted <= 1,
      '渐起窗 0.5s 发 ≤1 粒(积分 0.5, 累积器相位带; 矩形满速=2 必红 — ' +
      '评审 SPEC-1: 火「噗」地起来不是瞬满, v1.10 降档后期望值 0.5)');
  assert.ok(e.smoke.emitted <= 1, '烟渐起窗 ≤1 粒(积分 0.5, 期望 0 粒容采样顶到 1)');
  /* 快照如实化: rateScale=实际发射乘子(渐起快照语义本如实, 发射面跟上它即撤虚报) */
  const mid = mk();
  mid.open(FIRE.x, FIRE.y, FIRE.z);
  mid.tick(0.1);
  mid.tick(0.1); /* now=0.2, ramp=0.4 */
  assert.ok(Math.abs(mid.emitters(FIRE.x, FIRE.y, FIRE.z).flame.rateScale - 0.4) < 1e-9,
      '0.2s 处 rateScale=0.4(现时点渐起乘子, 与实际发射积分同源如实)');
  for (let i = 0; i < 5; i++) fx.tick(0.1); /* 至 1.0s */
  e = fx.emitters(FIRE.x, FIRE.y, FIRE.z);
  const at1s = e.flame.emitted;
  assert.ok(at1s >= 1 && at1s <= 2,
      '累计 1s 发 1~2 粒(∫₀¹ 2·ramp dt=1.5 相位带; 矩形满速=2 上界; 降档前 4~5 必红)');
  for (let i = 0; i < 5; i++) fx.tick(0.1); /* 至 1.5s(满速段) */
  e = fx.emitters(FIRE.x, FIRE.y, FIRE.z);
  assert.strictEqual(e.flame.emitted - at1s, 1,
      '满速段 [1.0,1.5]s 恢复矩形守恒: 恰 +1(0.5s×2 粒/s; 降档前 +3 必红; 寿命淘汰不侵计数)');
  const low = mk({lowcore: true});
  low.open(FIRE.x, FIRE.y, FIRE.z);
  for (let i = 0; i < 10; i++) low.tick(0.1); /* 1s */
  const le = low.emitters(FIRE.x, FIRE.y, FIRE.z);
  assert.ok(le.flame.emitted <= 1,
      '低核累计 1s 发 ≤1 粒(∫ 1·ramp dt=0.75 相位带; 降档前 2~3 必红)');
  assert.ok(le.smoke.emitted <= 1, '低核烟累计 1s ≤1 粒(积分 0.75)');
});

test('寿命域与粒子带: 火苗 life∈0.5~0.7 · age≤life · 尺寸带 [0.02, 0.16] · 透明度带 [0, 0.9] · ' +
    '从发射点(y+0.4)上升 · 水平不超散布+漂移幅', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  for (let i = 0; i < 10; i++) fx.tick(0.1); /* 喂满 1s(评审 SPEC-1 积分口径
    v1.10 降档重算: 渐起窗首拍 ≤1 粒, 满速段 1 粒在飞; 在飞下界 ∫_0.3^1 2·ramp≈1.32) */
  const ps = fx.particles(FIRE.x, FIRE.y, FIRE.z).flame;
  assert.ok(ps.length >= 1, '前置: 火苗在飞(降档后期望 1~2 粒)');
  for (const p of ps) {
    assert.ok(p.life >= 0.5 && p.life <= 0.7, '寿命在域内(0.5~0.7s)');
    assert.ok(p.age <= p.life + 1e-9, '年龄不越寿命(到期即淘汰)');
    assert.ok(p.size >= 0.02 - 1e-9 && p.size <= 0.16 + 1e-9, '尺寸带(出生域→消亡值)');
    assert.ok(p.opacity >= 0 && p.opacity <= 0.9 + 1e-9, '透明度带(0.9 线性降至 0)');
    assert.ok(p.y > FIRE.y + 0.4 - 1e-9, '从发射点 y+0.4 上升');
    assert.ok(Math.abs(p.x - FIRE.x) <= 0.25 + 0.15 + 1e-9, 'x 偏移 ≤散布 0.25+漂移幅 0.15');
    assert.ok(Math.abs(p.z - FIRE.z) <= 0.25 + 0.15 + 1e-9, 'z 偏移同界');
  }
});

test('烟柱运动: 从 y+1.2 起升 · 摆幅带 ±(0.2 散布+0.35 摆) · 恒色 #d6d2c8 · 尺寸膨胀方向 · ' +
    '速度曲线 1.4→0.4 线性(积分口径可见烟高 ≈4~5 格)', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(4.5); /* 最长寿命喂满 */
  const ps = fx.particles(FIRE.x, FIRE.y, FIRE.z).smoke;
  assert.ok(ps.length >= 1, '前置: 烟柱在飞');
  let grown = false;
  for (const p of ps) {
    assert.ok(p.life >= 3.5 && p.life <= 4.5, '烟寿命 3.5~4.5s');
    assert.ok(p.y > FIRE.y + 1.2 - 1e-9, '从发射点 y+1.2 起升');
    assert.ok(Math.abs(p.x - FIRE.x) <= 0.2 + 0.35 + 1e-9, '烟 x 不超散布+摆幅');
    assert.ok(Math.abs(p.z - FIRE.z) <= 0.2 + 0.35 + 1e-9, '烟 z 同界');
    assert.strictEqual(p.color, '#d6d2c8', '暖灰白恒色');
    assert.ok(p.opacity >= 0 && p.opacity <= 0.45 + 1e-9, '透明度带(0.45→0)');
    if (p.size > 0.14 + 1e-9) grown = true;
  }
  assert.ok(grown, '烟粒随寿命膨胀(样本中出现 >0.14 出生值)');
  /* 速度曲线纯函数 + 可见烟高积分(§5.3: 消亡前累计上升 ≈4~5 格) */
  const rise = CampfireFxCore.smokeRiseAt;
  assert.strictEqual(rise(0), 1.4, '初速 1.4(前快)');
  assert.strictEqual(rise(1), 0.4, '末速 0.4(后慢)');
  assert.ok(Math.abs(rise(0.5) - 0.9) < 1e-9, '线性中点 0.9');
  const integral = (rise(0) + rise(1)) / 2 * 4.5; /* 最长寿命梯形积分 */
  assert.ok(integral >= 4.0 && integral <= 5.0,
      '可见烟高 ≈4~5 格(0.9 格/s 均速 × 4.5s=4.05, research §6 烟柱 4~6 格档)');
});

test('旋涡: 渐起后人口恒 16(柱顶回卷取模零缺口) · 高度域 [y+0.5, y+柱满高] · 半径带 0.5~1.1 · 同向公转', () => {
  coreReady();
  const fx = mk();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  assert.ok(fx.particles(FIRE.x, FIRE.y, FIRE.z).vortex.length < 16,
      'open 瞬间未满员(渐起爬坡, §5.5 三发射器渐起)');
  fx.tick(0.5);
  assert.strictEqual(fx.particles(FIRE.x, FIRE.y, FIRE.z).vortex.length, 16, '渐起完成满员 16');
  fx.tick(7.0); /* 上升 3 格/s 走完 20 格柱身有余(回卷多轮) */
  const vs = fx.particles(FIRE.x, FIRE.y, FIRE.z).vortex;
  assert.strictEqual(vs.length, 16, '柱顶回卷取模循环: 人口恒 16(portalBeam motes 同款)');
  for (const v of vs) {
    assert.ok(v.y <= FIRE.y + 20 + 1e-9, '粒高不出柱顶(观感柱高=判定柱满高, §5.10 走查三)');
    assert.ok(v.y >= FIRE.y + 0.5 - 1e-9, '粒高不破柱底(y+0.5 高度域)');
    const r = Math.hypot(v.x - FIRE.x, v.z - FIRE.z);
    assert.ok(r >= 0.5 - 0.05 && r <= 1.1 + 0.05, '公转半径带 0.5~1.1(容差 0.05)');
    assert.ok(v.angleDir === fx.params.vortex.dir, '公转向与旋向常量一致(全柱统一)');
  }
});

/* ============ ⑦ 确定性 rng(mulberry32 每源派生先例) ============ */

test('确定性: 同格同种子重开=同粒子流(逐字段一致) · 异格=异流(相位错开有据)', () => {
  coreReady();
  const a = mk();
  a.open(FIRE.x, FIRE.y, FIRE.z);
  a.tick(1.0);
  const b = mk();
  b.open(FIRE.x, FIRE.y, FIRE.z);
  b.tick(1.0);
  const strip = (ps) => ps.map((p) => ({x: p.x, y: p.y, z: p.z, size: p.size, life: p.life}));
  assert.deepStrictEqual(strip(a.particles(FIRE.x, FIRE.y, FIRE.z).flame),
      strip(b.particles(FIRE.x, FIRE.y, FIRE.z).flame),
      '同格重开: 火苗流逐字段一致(mulberry32 每源派生, 同 seed 同序列)');
  assert.deepStrictEqual(strip(a.particles(FIRE.x, FIRE.y, FIRE.z).smoke),
      strip(b.particles(FIRE.x, FIRE.y, FIRE.z).smoke), '同格重开: 烟流一致');
  const c = mk();
  c.open(11, 25, 10);
  c.tick(1.0);
  assert.notDeepStrictEqual(strip(c.particles(11, 25, 10).flame),
      strip(a.particles(FIRE.x, FIRE.y, FIRE.z).flame),
      '异格异流(发射累积器初相按源派生错开, 多火不齐闪)');
});

/* ============ ⑧ 焰片面(v1.10 §4 交叉动画面片: T-C13-R3 参数单源+相位+帧号纯逻辑) ============ */

test('焰片面参数行单源(v1.10 §5.8 扩含面片+设计线五裁): params.flamePlanes={frames:3, frameS:0.15, ' +
    'fadeMul:1, lowMul:2} — 翻页 3 帧 0.15s/帧(≈6.7fps MC 量级)/渐弱 ×(1+tint·fadeMul) 0.30s 封顶/低核 ×2 恒档', () => {
  coreReady();
  const fx = mk();
  const fp = fx.params.flamePlanes;
  assert.ok(fp && typeof fp === 'object', 'flamePlanes 参数行在册(params 单源, R-4 只消费不复制)');
  assert.strictEqual(fp.frames, 3, '翻页 3 帧(焰帧 tile 74~76 三帧)');
  assert.strictEqual(fp.frameS, 0.15, '帧距 0.15s/帧(≈6.7fps 翻页, MC 量级, 设计线已批)');
  assert.strictEqual(fp.fadeMul, 1, '渐弱帧距乘子系数 1(帧距=frameS×(1+tint·fadeMul), tint=1 时 ×2)');
  assert.strictEqual(fp.lowMul, 2, '低核恒档帧距 ×2(0.30s, 不随 tint 再变)');
  /* 封顶数学对称: 桌面渐弱封顶帧距 = 低核恒档帧距 = 0.30s(「火小了也慢了」语义, 设计线已批) */
  assert.ok(Math.abs(fp.frameS * (1 + 1 * fp.fadeMul) - 0.30) < 1e-9,
      '桌面渐弱封顶帧距 0.15×(1+tint·fadeMul)|tint=1 = 0.30s(封顶)');
  assert.ok(Math.abs(fp.frameS * fp.lowMul - 0.30) < 1e-9, '低核恒档帧距 0.15×2 = 0.30s');
  /* 参数本体不分档: lowcore 实例 flamePlanes 同值(档位因子 lowMul 在表内, 消费端按 lowcore 取) */
  const lo = mk({lowcore: true}).params.flamePlanes;
  assert.deepStrictEqual(lo, fp, 'lowcore 实例参数表同形同值(低核分档只走 lowMul 因子)');
});

test('flamePhase(x,y,z) 实例方法(v1.10 §5.2 建议·方案 §3-i): cellSeed 派生 ∈[0,1) — ' +
    '同格同流/异格异流/重开一致/根种子敏感(哈希单一来源复用 cellSeed, 不复制公式)', () => {
  coreReady();
  const a = mk();
  assert.strictEqual(typeof a.flamePhase, 'function',
      'flamePhase 在册(fx 实例方法, 票面 R-3 产品面 2)');
  for (const g of [FIRE, {x: 0, y: 0, z: 0}, {x: 35, y: 1, z: 35}, {x: -7, y: 30, z: 12}]) {
    const p = a.flamePhase(g.x, g.y, g.z);
    assert.ok(p >= 0 && p < 1, '相位 ∈[0,1) (' + g.x + ',' + g.y + ',' + g.z + '→' + p.toFixed(4) + ')');
  }
  /* 同格同流: 同实例两次调用一致 + 另实例(同根 seed 缺省)一致 */
  assert.strictEqual(a.flamePhase(FIRE.x, FIRE.y, FIRE.z), a.flamePhase(FIRE.x, FIRE.y, FIRE.z),
      '同格两次调用同值(纯查询不漂移)');
  const b = mk();
  assert.strictEqual(a.flamePhase(FIRE.x, FIRE.y, FIRE.z), b.flamePhase(FIRE.x, FIRE.y, FIRE.z),
      '同根 seed 异实例同格同值');
  /* 重开一致: clear 清场后(格状态不复存在)相位不变 — 相位只依赖(根 seed,格坐标) */
  a.open(FIRE.x, FIRE.y, FIRE.z);
  a.tick(1.0);
  a.clear();
  assert.strictEqual(a.flamePhase(FIRE.x, FIRE.y, FIRE.z), b.flamePhase(FIRE.x, FIRE.y, FIRE.z),
      '重开一致(clear/重灌后同格同相位, 确定性重放口径)');
  /* 异格异流: bench grid50 同款 50 摆位两两全异(多火不齐翻的结构面) */
  const cells = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue;
      cells.push({x: col * 5, y: 1, z: row * 5});
    }
  }
  cells.push({x: 15, y: 1, z: 35}, {x: 20, y: 1, z: 35}, {x: 25, y: 1, z: 35},
      {x: 30, y: 1, z: 35}, {x: 35, y: 1, z: 35});
  const phases = cells.map((c) => a.flamePhase(c.x, c.y, c.z));
  assert.strictEqual(new Set(phases).size, 50,
      '50 格相位两两全异(异格异流, 恒 0/同值塌缩必红)');
  const spread = Math.max(...phases) - Math.min(...phases);
  assert.ok(spread > 0.9, '相位散布极差 >0.9(实测 ' + spread.toFixed(4) + ', 全周期铺开)');
  /* 根种子敏感: opts.seed 变则同格相位变 */
  const s1 = mk({seed: 1}).flamePhase(FIRE.x, FIRE.y, FIRE.z);
  const s2 = mk({seed: 2}).flamePhase(FIRE.x, FIRE.y, FIRE.z);
  assert.notStrictEqual(s1, s2, '不同根 seed 同格异相位(种子入哈希)');
});

test('flameFrameAt(x,y,z) 帧号纯函数(方案 §3-d: floor((now+phase·T)/frameS)%3 下沉 fx-core, R-4 只消费): ' +
    '翻页周期 0.45s/帧号域 {0,1,2}/50 火任意采样时刻三帧全覆盖/未知格可查', () => {
  coreReady();
  const fx = mk();
  assert.strictEqual(typeof fx.flameFrameAt, 'function',
      'flameFrameAt 在册(fx 实例方法, 帧号纯逻辑单源, R-4 焰片 UV 翻页只消费)');
  const fp = fx.params.flamePlanes;
  const p = fx.flamePhase(FIRE.x, FIRE.y, FIRE.z);
  /* 帧号域: 整数 ∈{0..frames-1}(now 只由 tick 推进, 零墙钟纪律) */
  let acc = 0;
  for (const dt of [0.05, 0.08, 0.37, 1.2, 1.6]) {
    fx.tick(dt);
    acc += dt;
    const f = fx.flameFrameAt(FIRE.x, FIRE.y, FIRE.z);
    assert.ok(Number.isInteger(f) && f >= 0 && f < fp.frames,
        '帧号=非负整数 <frames (t=' + acc.toFixed(2) + ' f=' + f + ')');
  }
  /* 镜像公式断言(票面 §3-d 公式, 红测独立照写): f=floor((now+phase·T)/frameS)%frames, T=frames·frameS
     (R-7 注记: 通用不变量 T=frames×fs_eff — 桌面 tint=0 时 fs_eff=frameS 二者同值, 本断言数值不变;
      渐弱/低核档见 fx-core flameFrameAt 注记) */
  fx.clear();
  fx.open(FIRE.x, FIRE.y, FIRE.z);
  fx.tick(0.5);
  const now = fx.now();
  const T = fp.frames * fp.frameS;
  const expect = Math.floor((now + p * T) / fp.frameS) % fp.frames;
  assert.strictEqual(fx.flameFrameAt(FIRE.x, FIRE.y, FIRE.z), expect,
      '全额档帧号=票面公式逐字(floor((now+phase·T)/frameS)%3, tint=0 满额帧距)');
  /* 翻页周期: 相位平移语义 — phase 直接决定帧错位: 找两格相位差 >1/3, 某时刻帧号必不同 */
  let gA = null; let gB = null;
  for (let x = 100; x < 200 && (!gA || !gB); x++) {
    const q = fx.flamePhase(x, 25, 10);
    if (Math.abs(q - p) > 1 / 3) {
      if (!gA) gA = x; else if (Math.abs(fx.flamePhase(gA, 25, 10) - q) > 1 / 3) gB = x;
    }
  }
  assert.ok(gA !== null && gB !== null, '前置: 相位差 >1/3 的格对找到(错相结构性存在)');
  let differ = false;
  for (let i = 0; i < 10; i++) {
    fx.tick(0.05);
    if (fx.flameFrameAt(gA, 25, 10) !== fx.flameFrameAt(gB, 25, 10)) {
      differ = true;
      break;
    }
  }
  assert.ok(differ, '相位差 >1/3 的两格在 0.5s 观测窗内帧号必出现错位(翻页错相语义)');
  /* 50 火任意采样时刻三帧全覆盖(错相自然感程序面, R-4 验收①的纯逻辑前置) */
  const grid = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue;
      grid.push({x: col * 5, y: 1, z: row * 5});
    }
  }
  grid.push({x: 15, y: 1, z: 35}, {x: 20, y: 1, z: 35}, {x: 25, y: 1, z: 35},
      {x: 30, y: 1, z: 35}, {x: 35, y: 1, z: 35});
  for (const t of [0, 0.07, 0.5]) {
    const fxG = mk();
    fxG.tick(t);
    const set = new Set(grid.map((c) => fxG.flameFrameAt(c.x, c.y, c.z)));
    assert.strictEqual(set.size, 3,
        't=' + t + ' 50 火帧号分布覆盖全部 3 帧(实测 [' + [...set].sort().join(',') + '])');
  }
  /* 未知格可查(悬空无害 presence 口径): 与同相位数学一致, 零炸 */
  const ghost = fx.flameFrameAt(999, 25, 999);
  assert.ok(Number.isInteger(ghost) && ghost >= 0 && ghost < fp.frames, '未知格帧号可查零炸');
});

test('渐弱帧率降档+低核恒档(§5.8 v1.10「火小了也慢了」+设计线已批 0.30 封顶): ' +
    '渐弱窗尾帧距 ×(1+tint·fadeMul)=0.30s(同距采样 full 翻帧 fade 不翻) · 低核帧距恒 0.30s 不随 tint', () => {
  coreReady();
  const fp = mk().params.flamePlanes;
  assert.ok(fp && fp.frames && fp.frameS,
      'flamePlanes 在册(前置; 参数行本体由上一测试直证, 此处守卫防装具炸)');
  const T = fp.frames * fp.frameS;
  /* R-7 注记: T 为桌面 tint=0 档周期(fs_eff=frameS); 渐弱档通用不变量
     period=frames×fs_eff, fs_eff=frameS×(1+tint·fadeMul)(0.30s 封顶), 故窗尾
     周期 TW=frames×frameS×(1+fadeMul)。下行窗尾镜像 expectW 直接以 TW/fs_eff
     断言该新不变量(追令 minor 2: 与桌面格相位脱钩, 消除「g 恰使两式同帧」
     的数值巧合耦合; 断言强化归类, 非红转绿, 如实申报)。 */
  const TW = fp.frames * fp.frameS * (1 + fp.fadeMul);
  /* 节奏断言格: 确定性扫描找相位使 now0 处全额帧距余量 <0.005s 且低口径余量 >0.145s 的格
     (跨 0.15 边界不跨 0.30 边界 ⇔ m\'=(now0+p·T) mod 0.30 ∈[0.005, 0.155), 红测设计已预演) */
  const NOW0 = 10; const DELTA = 0.145;
  let g = -1;
  for (let x = 100; x < 400 && g < 0; x++) {
    const q = mk().flamePhase(x, 25, 10);
    const m = (NOW0 + q * T) % (2 * fp.frameS);
    if (m >= 0.005 && m < 0.155) g = x;
  }
  assert.ok(g >= 0, '前置: 节奏断言格找到(确定性扫描, 非随机)');
  /* 桌面全额(tint=0, 帧距 0.15): Δ=0.145 跨帧 → 帧号恰 +1(mod 3) */
  const fxD = mk();
  fxD.tick(NOW0);
  const d0 = fxD.flameFrameAt(g, 25, 10);
  fxD.tick(DELTA);
  const d1 = fxD.flameFrameAt(g, 25, 10);
  assert.strictEqual((d1 - d0 + fp.frames) % fp.frames, 1,
      '全额档 0.145s 跨帧边界: 帧号 +1(帧距 0.15s 的翻页节奏)');
  /* 渐弱窗尾(setLeft=0 → tint=1, 帧距封顶 0.30): 同距采样不翻帧 */
  const fxW = mk();
  fxW.open(g, 25, 10);
  fxW.setLeft(g, 25, 10, 0);
  fxW.tick(NOW0);
  const w0 = fxW.flameFrameAt(g, 25, 10);
  fxW.tick(DELTA);
  const w1 = fxW.flameFrameAt(g, 25, 10);
  assert.strictEqual(w1, w0, '渐弱窗尾帧距 0.30s: 同距 0.145s 不翻帧(火小了也慢了)');
  /* 镜像公式: 窗尾 tint=1 帧距 fs_eff=frameS×(1+fadeMul)=0.30, 周期 TW=frames×fs_eff */
  const expectW = Math.floor((fxW.now() + fxW.flamePhase(g, 25, 10) * TW) /
      (fp.frameS * (1 + 1 * fp.fadeMul))) % fp.frames;
  assert.strictEqual(w1, expectW, '渐弱帧号=降档帧距公式(0.30s 封顶逐字)');
  /* 低核恒档: 帧距恒 0.30(lowMul=2), tint=0 与 tint=1 行为一致(恒档=不随渐弱再变) */
  const fxL0 = mk({lowcore: true});
  fxL0.tick(NOW0);
  const l0a = fxL0.flameFrameAt(g, 25, 10);
  fxL0.tick(DELTA);
  const l0b = fxL0.flameFrameAt(g, 25, 10);
  assert.strictEqual(l0b, l0a, '低核档 tint=0: 0.145s 不翻帧(恒档帧距 0.30s)');
  const fxL1 = mk({lowcore: true});
  fxL1.open(g, 25, 10);
  fxL1.setLeft(g, 25, 10, 0);
  fxL1.tick(NOW0);
  const l1a = fxL1.flameFrameAt(g, 25, 10);
  fxL1.tick(DELTA);
  const l1b = fxL1.flameFrameAt(g, 25, 10);
  assert.strictEqual(l1b, l1a, '低核档窗尾 tint=1: 同行为(恒档不随 tint 复合放大, 封顶对称)');
  assert.ok(Math.abs(fp.frameS * fp.lowMul - fp.frameS * (1 + fp.fadeMul)) < 1e-9,
      '低核恒档帧距=桌面渐弱封顶帧距(0.30s, 设计对称)');
});

test('lowcore 相位窗(R-7 加带一): 低核档 50 火逐时刻帧覆盖=3 — 相位·T 铺满 fs_eff 整圈' +
    '(翻页非冻结; 对旧不变量 T=frames×frameS 真红: 低核相位散布只落 ≤2 个帧号档)', () => {
  coreReady();
  const fx = mk({lowcore: true});
  const fp = fx.params.flamePlanes;
  assert.ok(fp && fp.frames === 3 && fp.lowMul === 2,
      '前置: 3 帧×低核 lowMul 2(参数行单源, 分档只走因子)');
  /* bench-c6 同款 50 摆位: 7×7 去四角 45 + 中轴补 5(确定性网格序, 零随机) */
  const grid = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue;
      grid.push({x: col * 5, y: 1, z: row * 5});
    }
  }
  for (let k = 0; k < 5; k++) grid.push({x: (3 + k) * 5, y: 1, z: 7 * 5});
  assert.strictEqual(grid.length, 50, '摆位装具自检: 50 座');
  for (const c of grid) fx.open(c.x, c.y, c.z);
  /* 36 采样时刻(0.05s×36=1.8s ≈ 6 个 0.30s 帧步周期, bench-c6 同协议)逐时刻覆盖 3 帧:
     低核 fs_eff=0.30s, 相位偏移 phase·T 须铺满一个 0.30s 帧距的整圈(T=frames×fs_eff=0.90s)
     → 任一时刻 50 格帧分布恒 3 帧; 旧 T=0.45s 时散布跨度 <2 帧步 → 覆盖塌缩 ≤2(冻结) */
  for (let t = 0; t < 36; t++) {
    fx.tick(0.05);
    const d = [0, 0, 0];
    for (const c of grid) d[fx.flameFrameAt(c.x, c.y, c.z)]++;
    const covered = d.filter((n) => n > 0).length;
    assert.strictEqual(covered, 3,
        '低核 t=' + fx.now().toFixed(2) + 's 帧分布覆盖 3 帧(实测 [' + d.join(',') + '])');
  }
});

/* ============ ⑨ 源码卫生扫描(零墙钟/零裸随机/零引擎零 DOM 实调/零 campfire 音效字面量) ============ */

test('零墙钟+零裸随机: campfire-fx-core.js 零 Date.now/performance.now/Math.random 实调' +
    '(确定性重放红线; 粒子随机走 mulberry32 每源派生先例)', () => {
  coreReady();
  const src = fs.readFileSync(path.join(ROOT, 'js', 'campfire-fx-core.js'), 'utf8');
  assert.ok(!src.includes('Date.now'), '零 Date.now(spec §6-8)');
  assert.ok(!src.includes('performance.now'), '零 performance.now(spec §6-8)');
  assert.ok(!src.includes('Math.random'), '零裸 Math.random(确定性 rng 派生先例: mulberry32)');
  assert.ok(!/\bTHREE\s*\./.test(src) && !/new\s+THREE\b/.test(src),
      '零引擎实调(纯核心, 渲染归 effects.js adapter; 头注释「零 THREE」声明字样不在禁列)');
  assert.ok(!/document\s*\./.test(src), '零 DOM 实调');
  assert.ok(!/\bsfx\s*\(\s*['"]/.test(src), '零音效调用(声本体归 T-C11, 本票零落盘)');
});

test('effects.js 零 campfire 音效字面量: sfx(campfire_lit)/sfx(campfire_out) 未登记前零落盘' +
    '(audio-registry 守门口径, 调用位只留注释同 C3 先例)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'effects.js'), 'utf8');
  const sq = '\''; /* 单引号字元(断言针内含引号形, 转义构造避开引号规) */
  const lit = (kind) => 'sfx(' + sq + kind + sq;
  assert.ok(!src.includes(lit('campfire_lit')), '零 campfire_lit 调用字面量');
  assert.ok(!src.includes(lit('campfire_out')), '零 campfire_out 调用字面量');
  assert.ok(!src.includes('sfx("campfire_lit"'), '双引号变体也零');
  assert.ok(!src.includes('sfx("campfire_out"'), '双引号变体也零');
});

test('index.html script 行: campfire-fx-core.js 在册且先于 modes/adventure.js(壳顶层构造 fx 管理器)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const iCore = html.indexOf('js/campfire-fx-core.js');
  const iAdv = html.indexOf('js/modes/adventure.js');
  assert.ok(iCore >= 0, 'script 行在册(campfire-fx-core.js)');
  assert.ok(iAdv >= 0, '锚: adventure.js 行在册(装具自检)');
  assert.ok(iCore < iAdv, 'campfire-fx-core.js 先于 modes/adventure.js(加载序即依赖序)');
});
