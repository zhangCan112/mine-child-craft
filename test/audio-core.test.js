'use strict';
/* 音频核心 (js/audio-core.js) 单测 — node --test (零依赖)
   运行: node --test test/audio-core.test.js
   加载器: 直接 require (CommonJS 导出守卫, 与 combat-core.test.js 同法);
   时间(伪时钟)与随机(脚本序列)全部注入, 断言准入决策与音乐事件序列 —
   决策核心的全部外部行为, 不窥探内部状态。 */
const test = require('node:test');
const assert = require('node:assert');

const loadCore = () => require('../js/audio-core.js');

/* 伪时钟: VoiceGate 的时间注入 */
function fakeClock() {
  let t = 0;
  return {now: () => t, adv: (d) => {
    t += d;
  }};
}

/* 脚本随机: 依次吐出脚本序列, MusicDirector 的 rand 注入 */
function seq(...vals) {
  const q = [...vals];
  return () => q.shift();
}

/* 内存存储: mkVolState 持久化注入(生产=localStorage, seam 口径同 daily-budget) */
function memStore() {
  const m = new Map();
  return {get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => {
    m.set(k, v);
  }};
}

/* 曲目 fixture: durMs(毫秒时长)是核心判"曲毕"的条目契约字段, A7 填真值 */
const TRACKS = [
  {id: 'calm1', file: 'a.m4a', mood: 'calm', g: 0.9, durMs: 10000},
  {id: 'calm2', file: 'b.m4a', mood: 'calm', g: 0.9, durMs: 20000},
  {id: 'battle1', file: 'c.m4a', mood: 'battle', g: 1, durMs: 15000},
];

/* ============ VoiceGate: 发声准入 ============ */

test('VoiceGate 未满放行: 活跃数 < max 时依次 play, activeN 递增', () => {
  const G = loadCore().mkVoiceGate({max: 3, now: () => 0});
  assert.deepStrictEqual(G.admit('zap', 1, 0), {act: 'play', victim: null});
  assert.strictEqual(G.activeN(), 1);
  assert.deepStrictEqual(G.admit('boom', 5, 0), {act: 'play', victim: null});
  assert.strictEqual(G.activeN(), 2);
});

test('VoiceGate 满员抢占: 新声 prio 严格大于最老活跃声才 steal, victim=最老', () => {
  const c = fakeClock();
  const G = loadCore().mkVoiceGate({max: 2, now: c.now});
  G.admit('zap', 1, 0); /* t0 最老 */
  c.adv(100);
  G.admit('boom', 5, 0); /* t100 次新 */
  assert.deepStrictEqual(G.admit('roar', 2, 0), {act: 'steal', victim: 'zap'});
  assert.strictEqual(G.activeN(), 2, '抢占不增活跃数');
});

test('VoiceGate 比较对象是最老声而非最低优先级: 不大于最老即 ignore', () => {
  const c = fakeClock();
  const G = loadCore().mkVoiceGate({max: 2, now: c.now});
  G.admit('zap', 9, 0); /* 最老但 prio 高 */
  c.adv(100);
  G.admit('click', 1, 0); /* 次新但 prio 低 */
  assert.deepStrictEqual(G.admit('roar', 2, 0), {act: 'ignore', victim: null},
      '2 不大于最老声的 9, 即使存在 prio 1 的次新声也不抢');
  assert.strictEqual(G.activeN(), 2);
});

test('VoiceGate prio 恰好相等不抢(严格大于): 满 max 后同优先级新声 ignore', () => {
  const G = loadCore().mkVoiceGate({max: 2, now: () => 0});
  G.admit('zap', 3, 0);
  G.admit('boom', 5, 0);
  assert.deepStrictEqual(G.admit('roar', 3, 0), {act: 'ignore', victim: null});
});

test('VoiceGate 同类冷却: 放行后 coolMs 内 ignore, 窗过放行, 冷却从放行重新起算', () => {
  const c = fakeClock();
  const G = loadCore().mkVoiceGate({max: 8, now: c.now});
  assert.strictEqual(G.admit('zap', 1, 1000).act, 'play');
  c.adv(500);
  assert.strictEqual(G.admit('zap', 1, 1000).act, 'ignore', '窗内忽略');
  c.adv(600); /* t=1100, 距放行已过 1000 */
  assert.strictEqual(G.admit('zap', 1, 1000).act, 'play', '窗过放行且重置冷却起点');
  c.adv(400); /* t=1500, 距上次放行 400 */
  assert.strictEqual(G.admit('zap', 1, 1000).act, 'ignore', '冷却从上次放行重新起算');
});

test('VoiceGate 冷却独立于活跃: release 归还名额但冷却窗继续走', () => {
  const c = fakeClock();
  const G = loadCore().mkVoiceGate({max: 8, now: c.now});
  G.admit('zap', 1, 1000);
  G.release('zap');
  c.adv(500);
  assert.strictEqual(G.admit('zap', 1, 1000).act, 'ignore', '播完放行名额但冷却继续');
  assert.strictEqual(G.activeN(), 0, '冷却中的 ignore 不占名额');
});

test('VoiceGate steal 的放行同样起冷却: 被抢 kind 在窗内再触发 ignore', () => {
  const G = loadCore().mkVoiceGate({max: 1, now: () => 0});
  G.admit('zap', 1, 0);
  assert.deepStrictEqual(G.admit('roar', 2, 10000), {act: 'steal', victim: 'zap'});
  assert.strictEqual(G.admit('roar', 2, 10000).act, 'ignore');
});

test('VoiceGate release 归还名额, 未知 kind 幂等不抛', () => {
  const G = loadCore().mkVoiceGate({max: 1, now: () => 0});
  G.admit('zap', 1, 0);
  G.release('nonexistent');
  G.release('zap');
  assert.strictEqual(G.activeN(), 0);
  assert.strictEqual(G.admit('boom', 1, 0).act, 'play', '名额空出');
});

test('VoiceGate 同 kind 重触发不占新名额: 已活跃时刷新为 play 而非 steal', () => {
  const c = fakeClock();
  const G = loadCore().mkVoiceGate({max: 1, now: c.now});
  G.admit('zap', 1, 0);
  c.adv(100);
  assert.deepStrictEqual(G.admit('zap', 9, 0), {act: 'play', victim: null}, '满员但同 kind 刷新');
  assert.strictEqual(G.activeN(), 1);
});

/* ============ MusicDirector: BGM 稀疏调度 ============ */

test('BGM 未解锁静默: 有曲有情绪但未 unlock, 推进再久也无事件', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0), tracks: TRACKS});
  d.setMood('calm');
  const evs = [];
  for (let i = 0; i < 100; i++) evs.push(...d.tick(1000));
  assert.deepStrictEqual(evs, []);
  assert.deepStrictEqual(d.snapshot(), {state: 'idle', mood: 'calm', ducked: false, unlocked: false});
});

test('BGM 解锁后 5~30s 起曲: rand=0 恰在 5000ms 出 start(menu 口径)', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock();
  assert.deepStrictEqual(d.tick(4999), [], '4999ms 还不起曲');
  const evs = d.tick(1);
  assert.strictEqual(evs.length, 1);
  assert.strictEqual(evs[0].type, 'start');
  assert.strictEqual(evs[0].track.id, 'calm1');
  assert.strictEqual(evs[0].track.mood, 'calm');
  assert.strictEqual(evs[0].gain, 0.30, '起曲目标增益=音乐总线基线');
  assert.strictEqual(evs[0].fadeInMs, 1200);
  assert.strictEqual(d.snapshot().state, 'playing');
});

test('BGM 起曲延迟随 rand 取区间值: rand=0.5 → 17500ms', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0.5, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock();
  let evs = [];
  for (let i = 0; i < 17; i++) evs.push(...d.tick(1000)); /* 17000ms */
  assert.deepStrictEqual(evs, []);
  evs = d.tick(500); /* 17500ms */
  assert.strictEqual(evs.length, 1, '17500ms 恰起曲');
  assert.strictEqual(evs[0].type, 'start');
});

test('BGM 曲毕 60~180s 静默再选: rand=0 → 停后 60s 起下一首且同 mood 不重复', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0, 0, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock();
  d.tick(5000); /* start calm1 (选曲 rand: calm 池 [calm1,calm2] 取第 0) */
  assert.deepStrictEqual(d.tick(9999), [], '曲长 10000ms 未到不停');
  let evs = d.tick(1); /* playMs=10000 → 曲毕 */
  assert.strictEqual(evs.length, 1);
  assert.strictEqual(evs[0].type, 'stop');
  assert.strictEqual(d.snapshot().state, 'waiting');
  evs = [];
  for (let i = 0; i < 60; i++) evs.push(...d.tick(1000)); /* 静默 60s */
  assert.strictEqual(evs.length, 1, 'rand=0 → 静默下界 60s 后起曲');
  assert.strictEqual(evs[0].type, 'start');
  assert.strictEqual(evs[0].track.id, 'calm2', '同 mood 曲库不重复上一首');
});

test('BGM 同 mood 续播: playing 中 setMood 同值不打断', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock();
  d.tick(5000);
  d.setMood('calm'); /* 同值 */
  assert.deepStrictEqual(d.tick(2000), [], '无 fade/stop/start/gain');
  assert.strictEqual(d.snapshot().state, 'playing');
});

test('BGM 换 mood 交叉淡出: 1.2s gain(0) → stop → 15~45s 后新 mood 起曲', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0, 0, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock();
  d.tick(5000); /* start calm1 */
  d.setMood('battle');
  assert.deepStrictEqual(d.tick(1), [{type: 'gain', target: 0, rampMs: 1200}], '先吐淡出增益指令');
  assert.deepStrictEqual(d.tick(1199), [{type: 'stop'}], '1.2s 淡出走完停曲');
  assert.strictEqual(d.snapshot().state, 'waiting');
  const evs = [];
  for (let i = 0; i < 15; i++) evs.push(...d.tick(1000));
  assert.strictEqual(evs.length, 1, 'rand=0 → 15s 后起曲(afterMood 口径)');
  assert.strictEqual(evs[0].type, 'start');
  assert.strictEqual(evs[0].track.mood, 'battle');
});

test('BGM none 恒静默: playing 中切 none 淡出停曲进 idle, 之后不再起; 恢复 mood 后 15s 起新曲', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0, 0, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock();
  d.tick(5000);
  d.setMood('none');
  d.tick(1); /* 吐淡出指令 */
  assert.deepStrictEqual(d.tick(1199), [{type: 'stop'}]);
  assert.deepStrictEqual(d.snapshot(), {state: 'idle', mood: 'none', ducked: false, unlocked: true});
  let evs = [];
  for (let i = 0; i < 120; i++) evs.push(...d.tick(1000));
  assert.deepStrictEqual(evs, [], 'none 情绪下永不起曲');
  d.setMood('calm');
  evs = [];
  for (let i = 0; i < 15; i++) evs.push(...d.tick(1000));
  assert.strictEqual(evs.length, 1, '恢复情绪后 rand=0 → 15s 起曲');
  assert.strictEqual(evs[0].track.id, 'calm2', '恢复后仍避开上一首');
});

test('BGM waiting 中换 mood: 等待计时按 15~45s 口径重置', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock(); /* rand₁=0 → 5s */
  d.setMood('battle'); /* rand₂=0 → 重置为 15s */
  assert.deepStrictEqual(d.tick(5000), [], '原 5s 口径作废');
  const evs = [];
  for (let i = 0; i < 10; i++) evs.push(...d.tick(1000)); /* 累计 15000ms */
  assert.strictEqual(evs.length, 1, '重置后 15s 起曲');
  assert.strictEqual(evs[0].track.mood, 'battle');
});

test('BGM unlock 先于 setMood: 解锁后再设情绪走 15~45s 口径', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0), tracks: TRACKS});
  d.unlock(); /* mood 尚空 → 仍 idle */
  assert.strictEqual(d.snapshot().state, 'idle');
  d.setMood('calm'); /* rand₁=0 → 15s */
  const evs = [];
  for (let i = 0; i < 15; i++) evs.push(...d.tick(1000));
  assert.strictEqual(evs.length, 1);
  assert.strictEqual(evs[0].type, 'start');
});

test('BGM duck: 压到 0.08(0.25s) / 回基线(0.8s), 幂等不重复发', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock();
  d.tick(5000); /* playing, 基线 0.30 */
  d.duck(true);
  d.duck(true);
  assert.deepStrictEqual(d.tick(16), [{type: 'gain', target: 0.08, rampMs: 250}], 'TTS 起让路');
  d.duck(false);
  assert.deepStrictEqual(d.tick(16), [{type: 'gain', target: 0.30, rampMs: 800}], '说完回基线');
  assert.strictEqual(d.snapshot().ducked, false);
});

test('BGM duck 在淡出中释放回 0: 不把正在消失的音乐拉响', () => {
  const d = loadCore().mkMusicDirector({rand: seq(0, 0), tracks: TRACKS});
  d.setMood('calm');
  d.unlock();
  d.tick(5000);
  d.setMood('battle'); /* 淡出中 */
  d.duck(true);
  d.tick(16); /* 吐淡出与压低两条指令(执行侧后发者为准) */
  d.duck(false);
  assert.deepStrictEqual(d.tick(1), [{type: 'gain', target: 0, rampMs: 800}], '淡出中释放目标仍为 0');
});

test('BGM 空曲表恒 idle: unlock/setMood 后推进再久也无 start, 但 gain 事件结构先立', () => {
  const d = loadCore().mkMusicDirector({rand: seq(), tracks: []});
  d.setMood('calm');
  d.unlock();
  const evs = [];
  for (let i = 0; i < 300; i++) evs.push(...d.tick(1000));
  assert.deepStrictEqual(evs, []);
  assert.strictEqual(d.snapshot().state, 'idle');
  d.duck(true);
  assert.deepStrictEqual(d.tick(16), [{type: 'gain', target: 0.08, rampMs: 250}], '无曲也照发让路指令');
});

/* ============ VolState: 音量滑杆状态(A8) ============ */

test('VolState 默认倍率 1.0(存倍率不存绝对值): 基准按 isTouch 取 AUDIO_MIX 双端两档', () => {
  const desk = loadCore().mkVolState({storage: memStore(), isTouch: false});
  assert.strictEqual(desk.music(), 1, '音乐默认倍率 1.0 = 基线原样');
  assert.strictEqual(desk.sfx(), 1);
  assert.deepStrictEqual(desk.baseline(), {music: 0.30, sfx: 0.9}, '桌面两档');
  const touch = loadCore().mkVolState({storage: memStore(), isTouch: true});
  assert.deepStrictEqual(touch.baseline(), {music: 0.25, sfx: 0.8}, '触屏两档');
});

test('VolState 0..1 钳制: 超界夹回, 非有限数忽略不动', () => {
  const v = loadCore().mkVolState({storage: memStore()});
  assert.strictEqual(v.setMusic(1.7), 1, '上界夹回 1');
  assert.strictEqual(v.setMusic(-0.5), 0, '下界夹回 0');
  assert.strictEqual(v.setMusic(0.4), 0.4);
  assert.strictEqual(v.setMusic(NaN), 0.4, 'NaN 忽略, 原值不动');
  assert.strictEqual(v.setMusic(Infinity), 0.4, 'Infinity 忽略');
  assert.strictEqual(v.setSfx(2), 1);
  assert.strictEqual(v.setSfx('loud'), 1, '字符串不是有限数, 忽略');
});

test('VolState 持久化往返: 单键 JSON 存档, 新实例恢复', () => {
  const mem = memStore();
  const a = loadCore().mkVolState({storage: mem});
  a.setMusic(0.4);
  a.setSfx(0);
  assert.ok(String(mem.get('audio_vol_save')).includes('"music":0.4'), '键名与格式钉死(audio_vol_save)');
  const b = loadCore().mkVolState({storage: mem});
  assert.strictEqual(b.music(), 0.4);
  assert.strictEqual(b.sfx(), 0);
});

test('VolState 坏档回落: 坏 JSON 整档弃, 非数值字段逐项回落默认', () => {
  const mem = memStore();
  mem.set('audio_vol_save', '{oops');
  const c = loadCore().mkVolState({storage: mem});
  assert.strictEqual(c.music(), 1, '坏 JSON → 默认 1.0');
  assert.strictEqual(c.sfx(), 1);
  mem.set('audio_vol_save', JSON.stringify({music: 'loud', sfx: 0.3}));
  const d = loadCore().mkVolState({storage: mem});
  assert.strictEqual(d.music(), 1, 'music 字段非数值 → 该项回落');
  assert.strictEqual(d.sfx(), 0.3, 'sfx 字段完好保留');
});

test('VolState 越界持久值读入时同样钳制(存档被手改/损坏不炸总线)', () => {
  const mem = memStore();
  mem.set('audio_vol_save', JSON.stringify({music: 3, sfx: -2}));
  const v = loadCore().mkVolState({storage: mem});
  assert.strictEqual(v.music(), 1);
  assert.strictEqual(v.sfx(), 0);
});

test('VolState 无存储注入也内存可用(不抛, 纯决策态)', () => {
  const v = loadCore().mkVolState();
  assert.strictEqual(v.setMusic(0.5), 0.5);
  assert.strictEqual(v.music(), 0.5);
});

/* ============ musicBusTarget: 让路×音量的总线目标换算(A1 duck 修复) ============ */

test('musicBusTarget 基线类目标(> duck 深度)按音量倍率缩放', () => {
  const f = loadCore().musicBusTarget;
  assert.strictEqual(f(0.30, 1, 0.30), 0.30, '倍率 1 基线原样');
  assert.strictEqual(f(0.30, 0.5, 0.30), 0.15);
  assert.strictEqual(f(0.25, 0.5, 0.25), 0.125, '触屏两档同口径');
});

test('musicBusTarget 让路只降不升: duck 目标 = min(基线×倍率, 0.08), 静音 0 时 TTS 开口不抬声', () => {
  const f = loadCore().musicBusTarget;
  assert.strictEqual(f(0.08, 1, 0.30), 0.08, '基线高于让路深度: 照常压到 0.08');
  assert.strictEqual(f(0.08, 0.2, 0.30), 0.06, '基线×倍率 0.06 已低于 0.08: 让路到 0.06 不抬升');
  assert.strictEqual(f(0.08, 0, 0.30), 0, '静音时让路保持 0(让路不得变抬声)');
});

test('musicBusTarget 淡出目标 0 恒 0(换曲交叉淡出不因倍率回弹)', () => {
  const f = loadCore().musicBusTarget;
  assert.strictEqual(f(0, 0.5, 0.30), 0);
  assert.strictEqual(f(0, 1, 0.25), 0);
});

/* ============ AUDIO_MIX: 响度常数表 ============ */

test('AUDIO_MIX 儿童保守响度常数钉死(spec 音频图与调度参数的防漂移锚点)', () => {
  const M = loadCore().AUDIO_MIX;
  assert.strictEqual(M.music, 0.30);
  assert.strictEqual(M.musicTouch, 0.25);
  assert.strictEqual(M.sfx, 0.9);
  assert.strictEqual(M.sfxTouch, 0.8);
  assert.strictEqual(M.master, 0.8);
  assert.strictEqual(M.duck, 0.08);
  assert.strictEqual(M.duckRampMs, 250);
  assert.strictEqual(M.duckReleaseMs, 800);
  assert.strictEqual(M.fadeOutMs, 1200);
  assert.strictEqual(M.fadeInMs, 1200);
});
