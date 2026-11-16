'use strict';
/* 声音清单注册表 (js/audio-registry.js) 消费端断言 — node --test
   运行: node --test test/audio-registry.test.js
   把"清单是唯一权威"从口头约定变成断言(先例 mode-registry.test.js):
   ① js/** 每处 sfx('…') 字面量都在 SFX_KINDS 登记(漏登记即红),
     且只收活着的 kind(TNT 死键不迁);
   ② 条目形状防错网(synth/file 至少其一(file 须带 synth 回退, A7 起共存) + g/gTouch/prio/coolMs 齐全);
   ③ MOODS 收窄为仅 menu(模式情绪唯一权威在 mode-registry 各行 mood 字段), 值 ∈ 合法情绪集;
   ④ 样本 file 条目须真实存在于 assets/audio/ 且 CREDITS.md 记载
     (A2 无样本空转, A7 素材入库后咬合); 反向覆盖: 目录内全部素材
     文件漏记 CREDITS 即红;
   ⑤ 过渡期守卫: synth 定义与 effects.js 的 SFX_DEFS 原样一致
     (A4 迁走解释器删表后自动退场)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const AudioRegistry = require('../js/audio-registry.js');

const ROOT = path.join(__dirname, '..');
const walk = (d) => {
  const out = [];
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/* 扫 js/** 全部 sfx('…') / advSfx('…') 字面量调用: [{where: '文件:行', kind}]。
   动态 kind(变量传参)无法静态收网(如 o.sfx 缝以变量注入的动态转发不在此列
   ——本正则只收带引号字面量), 新代码若出现动态 kind, 应改回字面量或来注册表
   补登后再议。
   T-C11 翻新裁定(2026-11-17, 票面授权: 守门断言翻新): 正则扩罩 advSfx(。
   依据=GLOSSARY advProfile 词条「媒体三通道——壳内直接调用点全量经薄包装
   advSpeak/advSfx/advToast 路由」: 冒险壳新接线一律走 advSfx 媒体缝(dev
   静默经 profile 置换, 体验馆同装配零分支), 字面量落 advSfx 者此前是扫描
   盲区(bell_town/pick/snow_throw 等既有调用均漏罩)——kind 在册判据与 sfx
   直调同权, 漏登记即红。纯扩面: 既有 sfx 直调 62 处+advSfx/缝字面量 39 处
   翻新日全量在册, 零弱化(禁词面零改), 守门从 62 处罩到 101 处。 */
function scanSfxLiterals() {
  const found = [];
  for (const p of walk(path.join(ROOT, 'js'))) {
    if (!p.endsWith('.js')) continue;
    const src = fs.readFileSync(p, 'utf8');
    let m;
    const re = /\b(?:advSfx|sfx)\(\s*(['"])([A-Za-z0-9_-]+)\1\s*\)/g;
    while ((m = re.exec(src)) !== null) {
      found.push({where: rel(p) + ':' + src.slice(0, m.index).split('\n').length, kind: m[2]});
    }
  }
  return found;
}

test('声音清单: js/** 每处 sfx(…) 字面量都在 SFX_KINDS 登记(漏登记即红)', () => {
  const found = scanSfxLiterals();
  assert.ok(found.length >= 30, '扫描器失灵? 全库 sfx 字面量应不少于 30 处, 实得 ' + found.length);
  for (const {where, kind} of found) {
    assert.ok(Object.prototype.hasOwnProperty.call(AudioRegistry.SFX_KINDS, kind),
        where + ' 调用了未登记的音效 kind: ' + kind);
  }
});

test('声音清单: 只收活着的 kind — 16 活键齐备, TNT 死键(fss/door)不迁', () => {
  const keys = Object.keys(AudioRegistry.SFX_KINDS);
  for (const k of ['zap', 'boom', 'pick', 'click', 'death', 'hit', 'hurt',
    'shoot', 'level', 'win', 'roar', 'breath', 'splash', 'lava_hiss',
    'snow_throw', 'snow_hit', 'gate_unlock']) {
    assert.ok(keys.includes(k), '缺活键: ' + k +
        '(splash/lava_hiss 液体系统; snow_throw/snow_hit 雪球投掷 T9; gate_unlock 门点亮仪式 T8)');
  }
  for (const dead of ['fss', 'door']) {
    assert.ok(!keys.includes(dead), '死键不迁(TNT 密室已下线, 复活时再登记): ' + dead);
  }
});

test('声音清单: 条目形状 — synth/file 至少其一, file 条目须带 synth 回退(降级链互锁) + 增益/优先级/冷却齐全', () => {
  for (const [kind, e] of Object.entries(AudioRegistry.SFX_KINDS)) {
    const hasSynth = e.synth !== undefined;
    const hasFile = e.file !== undefined;
    /* A7 起条目形状演进: file(样本优先) 与 synth(回退) 可共存 —
       audio.js 的降级链在样本未就绪/加载失败时无条件消费 e.synth,
       纯 file 条目失败即哑(违背"游戏永不哑"); 纯 synth 条目仍允许 */
    assert.ok(hasSynth || hasFile, kind + ' 须 synth/file 至少其一(合成或样本)');
    if (hasFile) {
      assert.strictEqual(typeof e.file, 'string', kind + ' file 须为 assets/audio/ 下文件名');
      assert.ok(hasSynth, kind + ' 标 file 须同时保留 synth 做加载失败回退(游戏永不哑)');
    }
    if (hasSynth) {
      assert.ok(typeof e.synth === 'object' && e.synth !== null, kind + ' synth 须为合成定义对象');
    }
    for (const f of ['g', 'gTouch']) {
      assert.strictEqual(typeof e[f], 'number', kind + ' 缺数值字段 ' + f);
      assert.ok(e[f] > 0, kind + '.' + f + ' 须为正增益倍率');
    }
    assert.ok(Number.isInteger(e.prio) && e.prio >= 1, kind + '.prio 须为 ≥1 整数(大者优先抢占)');
    assert.ok(Number.isInteger(e.coolMs) && e.coolMs >= 0, kind + '.coolMs 须为 ≥0 整数毫秒');
  }
});

test('声音清单: MOODS 收窄为仅 menu — 模式情绪唯一权威在 mode-registry 各行 mood 字段, 值 ∈ 合法情绪集', () => {
  const legal = ['calm', 'adventure', 'night', 'nether', 'battle', 'none'];
  assert.deepStrictEqual(Object.keys(AudioRegistry.MOODS), ['menu'],
      '引擎侧只需 menu 键(各游玩模式情绪随 mode-registry 各行 mood 字段走, 不再镜像)');
  for (const v of Object.values(AudioRegistry.MOODS)) {
    assert.ok(legal.includes(v), 'MOODS 情绪值非法: ' + v + ' ∈ ' + legal.join('|'));
  }
});

test('声音清单: 传送门双音效(冒险地图 T7) — 蓄能上行/到达琶音, 纯合成无样本(仪式层)', () => {
  for (const k of ['portal_charge', 'portal_travel']) {
    const e = AudioRegistry.SFX_KINDS[k];
    assert.ok(e, '登记活键: ' + k + '(进门蓄能/到达播报两段, 设计稿 §4.1)');
    assert.ok(e.synth && typeof e.synth === 'object', k + ' 带合成定义(样本二期可选, synth 是回退底线)');
    assert.strictEqual(e.file, undefined, k + ' 暂无样本条目(CC0 素材二期再挂)');
    assert.strictEqual(e.prio, 4, k + ' 仪式层(与 level/gem 同档: 切图是冒险地图的大事件)');
  }
  /* 形状细节: 蓄能=上行滑音(f0<f1), 到达=上行琶音(steps 递增)——听感方向都是「升」 */
  const c = AudioRegistry.SFX_KINDS.portal_charge.synth;
  assert.ok(c.f0 < c.f1, 'portal_charge 是上行滑音(f0<f1)');
  const t = AudioRegistry.SFX_KINDS.portal_travel.synth;
  assert.ok(Array.isArray(t.steps) && t.steps.length >= 2 &&
      t.steps.every((v, i) => i === 0 || v > t.steps[i - 1]), 'portal_travel 是上行琶音(steps 递增)');
});

/* ============ 滑翔翼双音效(T-G03 形象层, UI spec §7.1 合成口径) ============ */

test('声音清单: 滑翔翼双音效 — wing_open 上滑/wing_close 下滑更轻, prio 2/coolMs 300, 纯合成可回退', () => {
  const open = AudioRegistry.SFX_KINDS.wing_open;
  assert.ok(open, '登记 wing_open(展翼瞬间, 触发接线归 T-G04)');
  const close = AudioRegistry.SFX_KINDS.wing_close;
  assert.ok(close, '登记 wing_close(收翼瞬间, 触发接线归 T-G04)');
  for (const [k, e] of [['wing_open', open], ['wing_close', close]]) {
    assert.ok(e.synth && typeof e.synth === 'object',
        k + ' 带合成定义(「永不哑」互锁: 无样本也出声)');
    assert.strictEqual(e.prio, 2, k + ' 状态音 prio 2(可压环境声, §7.1)');
    assert.strictEqual(e.coolMs, 300, k + ' coolMs 300(空中可连点再展, 防快速连开叠爆)');
  }
  assert.ok(open.synth.f0 === 220 && open.synth.f1 === 520,
      'wing_open 布面抖开上行短音 220→520(§7.1)');
  assert.ok(open.synth.dur >= 0.18 && open.synth.dur <= 0.26, 'wing_open dur≈0.22');
  assert.ok(open.synth.g >= 0.08 && open.synth.g <= 0.12, 'wing_open g≈0.10');
  assert.ok(close.synth.f0 === 520 && close.synth.f1 === 200,
      'wing_close 反向下滑 520→200(收=安顿感)');
  assert.ok(close.synth.dur >= 0.14 && close.synth.dur <= 0.22, 'wing_close dur≈0.18');
  assert.ok(close.synth.g >= 0.05 && close.synth.g <= 0.09, 'wing_close g≈0.07');
  assert.ok(close.synth.g < open.synth.g, '收翼比展翼更轻(§7.1 收=安顿感, 比展开安静)');
});

/* ============ 篝火双音效(T-C11 UI E 区, UI 定稿 §7.1 参数表逐格照抄) ============
   声音性格(§7.1 转写): campfire_lit=PO A15「噗地点着」的声学直译(低通 480Hz
   白噪短噗); campfire_out=「轻轻熄灭」的安顿音(更低 320/更轻 g0.08/更长 0.45s)。
   触发接线归本票(js/modes/adventure.js 三锚), 断言在 adventure-mode.test。 */

test('声音清单: 篝火双音效 — campfire_lit 软噗/campfire_out 轻叹更低更轻更长, prio 2/coolMs 300/g 1·1, synth-only 永不哑, 命名定稿恰两枚', () => {
  const lit = AudioRegistry.SFX_KINDS.campfire_lit;
  assert.ok(lit, '登记 campfire_lit(放置即燃成功/熄灭态点击重燃成功同拍, 同键共用)');
  const out = AudioRegistry.SFX_KINDS.campfire_out;
  assert.ok(out, '登记 campfire_out(自然燃尽=方块移除帧, spec §3.7「消失瞬间」)');
  for (const [k, e] of [['campfire_lit', lit], ['campfire_out', out]]) {
    assert.strictEqual(e.file, undefined,
        k + ' synth-only 无 file 字段(wing_open 同款「永不哑」互锁: 无样本直接走合成; CC0 样本后补列 UI 定稿 §9.2-5 非本票)');
    assert.strictEqual(e.prio, 2, k + ' 状态音 prio 2(wing 先例; 仪式档 4 留给升级/胜利/穿门, §7.1 参数依据)');
    assert.strictEqual(e.coolMs, 300, k + ' coolMs 300(防连放多座/浇熄秒重燃的同声叠爆, wing 同款)');
    assert.strictEqual(e.g, 1, k + ' 桌面增益中性 1(响度由 synth 内 g 配平, 注册表「中性 1 起步」现行纪律)');
    assert.strictEqual(e.gTouch, 1, k + ' 触屏增益中性 1(触屏总线级衰减收在 AUDIO_MIX, 条目级不叠加)');
  }
  /* 逐格(§7.1 表): lit={noise:{lowpass,480,0.18},g:0.10} / out={noise:{lowpass,320,0.45},g:0.08} */
  assert.strictEqual(lit.synth.noise.type, 'lowpass', 'campfire_lit 低通白噪(snow_throw 低通闷噗家族放长, 比 fuse 高通急嘶柔两档, 儿童零惊吓)');
  assert.strictEqual(lit.synth.noise.freq, 480, 'campfire_lit freq 480(§7.1 逐格)');
  assert.strictEqual(lit.synth.noise.dur, 0.18, 'campfire_lit dur 0.18(短噗不拖尾)');
  assert.strictEqual(lit.synth.g, 0.10, 'campfire_lit 合成增益 0.10(§7.1 逐格)');
  assert.strictEqual(out.synth.noise.type, 'lowpass', 'campfire_out 同族低通(轻轻熄灭)');
  assert.strictEqual(out.synth.noise.freq, 320, 'campfire_out freq 320(更低, §7.1 逐格)');
  assert.strictEqual(out.synth.noise.dur, 0.45, 'campfire_out dur 0.45(更长=安顿不惊悚)');
  assert.strictEqual(out.synth.g, 0.08, 'campfire_out 合成增益 0.08(更轻, wing_close「收=安顿感」口径)');
  /* 声音性格关系(§7.1 转写): out 比 lit 更低/更轻/更长 */
  assert.ok(out.synth.noise.freq < lit.synth.noise.freq, '燃尽比点燃更低(§7.1)');
  assert.ok(out.synth.g < lit.synth.g, '燃尽比点燃更轻(§7.1)');
  assert.ok(out.synth.noise.dur > lit.synth.noise.dur, '燃尽比点燃更长(§7.1)');
  /* 命名定稿(§7.1): 否决 campfire_light(动词歧义)/campfire_burnout(过长且「燃尽」语义偏机制), 不改名 */
  assert.ok(!AudioRegistry.SFX_KINDS.campfire_light && !AudioRegistry.SFX_KINDS.campfire_burnout,
      '否决名不收(命名定稿 campfire_lit/campfire_out, UI 定稿 §7.1)');
  assert.deepStrictEqual(
      Object.keys(AudioRegistry.SFX_KINDS).filter((k) => k.startsWith('campfire')),
      ['campfire_lit', 'campfire_out'],
      'campfire* 键恰两枚(任何第三声不做: 循环燃烧声 R1-15/浇熄音效不新增/事件 TTS 零条目, §7.2 不做清单)');
});

test('声音清单: 篝火音效接线白名单 — campfire* 调用字面量恰 3 处全在 modes/adventure.js' +
    '(放置/重燃/燃尽三锚=终态), 其余文件零(T-C11 翻新裁定: 两键合法化仅限登记行+接线点)', () => {
  const cf = scanSfxLiterals().filter((f) => f.kind.startsWith('campfire'));
  assert.strictEqual(cf.length, 3,
      'campfire 音效调用恰 3 处(放置即燃/重燃成功/燃尽移除帧三锚; 超出=超票面, 少于=接线缺席)');
  for (const f of cf) {
    assert.ok(f.where.startsWith('js/modes/adventure.js:'),
        f.where + ' campfire 音效接线越权(白名单=模式壳 adventure.js 共享装配——引擎层 effects.js/' +
        '纯核心 campfire-kit.js+campfire-fx-core.js/体验馆 showroom.js 永久零 campfire 音效字面量, 其余文件仍禁)');
  }
  const kinds = new Set(cf.map((f) => f.kind));
  assert.ok(kinds.has('campfire_lit') && kinds.has('campfire_out'),
      '两键齐接线(lit=放置+重燃两锚共用一键, out=燃尽移除帧一锚, §7.1 触发列)');
});

test('声音清单: MOODS.menu = calm(主菜单轻柔迎接, spec 故事 9)', () => {
  assert.strictEqual(AudioRegistry.MOODS.menu, 'calm');
});

test('声音清单: MUSIC_TRACKS 条目形状 {file, mood, g, durMs}, 曲目情绪不含 none(A7 起填曲)', () => {
  for (const [id, t] of Object.entries(AudioRegistry.MUSIC_TRACKS)) {
    assert.strictEqual(typeof t.file, 'string', id + ' 缺 file(assets/audio/ 下文件名)');
    assert.ok(['calm', 'adventure', 'night', 'nether', 'battle'].includes(t.mood),
        id + ' mood 非法: ' + t.mood + '(none=不放曲, 曲目不该有)');
    assert.strictEqual(typeof t.g, 'number', id + ' 缺数值增益 g');
    assert.ok(t.g > 0, id + '.g 须为正增益');
    assert.ok(Number.isInteger(t.durMs) && t.durMs > 0,
        id + ' 缺实测 durMs(MusicDirector 判曲毕唯一依据, A3 备注②; 转码后 ffmpeg 实测毫秒)');
  }
});

test('声音清单: 曲目情绪覆盖 — 模式/场景用到的情绪都有曲(空池=该场景永无 BGM)', () => {
  const ModeRegistry = require('../js/mode-registry.js');
  const pool = {};
  for (const t of Object.values(AudioRegistry.MUSIC_TRACKS)) pool[t.mood] = (pool[t.mood] || 0) + 1;
  for (const m of ModeRegistry.all) {
    if (m.mood === 'none') continue;
    assert.ok(pool[m.mood] > 0, m.id + ' 的 mood ' + m.mood + ' 在 MUSIC_TRACKS 无曲目(空池)');
  }
  /* 场景分组钉死: night/nether 由探险壳层动态报(advMusicMood), 不在
     mode-registry 行内出现, 故在此直接断言分组存在 */
  for (const need of ['calm', 'adventure', 'night', 'nether', 'battle']) {
    assert.ok(pool[need] > 0, '场景分组 ' + need + ' 至少 1 曲(2026-10-27 换曲口径)');
  }
});

test('声音清单: 样本 file 条目在 assets/audio/ 真实存在且 CREDITS.md 记载(A7 起咬合)', () => {
  const entries = [];
  for (const [kind, e] of Object.entries(AudioRegistry.SFX_KINDS)) {
    if (e.file !== undefined) entries.push([kind, e.file]);
  }
  for (const [id, t] of Object.entries(AudioRegistry.MUSIC_TRACKS)) {
    entries.push([id, t.file]);
  }
  if (entries.length === 0) return; /* A2 无样本条目空转; A7 填 file 后逐条咬合 */
  const creditsPath = path.join(ROOT, 'assets/audio/CREDITS.md');
  assert.ok(fs.existsSync(creditsPath), '缺 assets/audio/CREDITS.md(素材溯源义务)');
  const credits = fs.readFileSync(creditsPath, 'utf8');
  for (const [id, file] of entries) {
    assert.ok(fs.existsSync(path.join(ROOT, 'assets/audio', file)),
        id + ' 样本文件缺失: assets/audio/' + file);
    assert.ok(credits.includes(file), 'CREDITS.md 未记载 ' + file + ' 的来源/许可');
  }
});

test('声音清单: 反向覆盖 — assets/audio/ 下全部素材文件都在 CREDITS.md 记载(备用池 jingles 漏记也红)', () => {
  const dir = path.join(ROOT, 'assets/audio');
  const credits = fs.readFileSync(path.join(dir, 'CREDITS.md'), 'utf8');
  const files = walk(dir).map((p) => path.basename(p)).filter((n) => n !== 'CREDITS.md');
  assert.ok(files.length >= 90, '扫描器失灵? 入库素材应 98 文件, 实得 ' + files.length);
  for (const n of files) {
    assert.ok(credits.includes(n), 'CREDITS.md 未记载 assets/audio/' + n + '(反向覆盖: 文件在而记录缺)');
  }
});

test('声音清单: 过渡期守卫 — synth 与 effects.js 的 SFX_DEFS 原样一致(A4 删表后自动退场)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/effects.js'), 'utf8');
  if (!src.includes('const SFX_DEFS = {')) return; /* A4 已迁走解释器并删表: 守卫退场 */
  /* effects.js 顶层只触碰 THREE 的几何/材质构造与 document 两方法, 最小桩即可单载;
     IS_TOUCH/window 为 A1 微修(A2 并行工单)可能新增的顶层引用防御性预留 */
  const sandbox = {
    THREE: {BoxGeometry: Object, MeshLambertMaterial: Object, SphereGeometry: Object,
      CylinderGeometry: Object, Vector3: Object},
    document: {addEventListener() {}, getElementById: () => ({})},
    performance: {now: () => 0},
    IS_TOUCH: false,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(src, ctx, {filename: 'js/effects.js'});
  const defs = vm.runInContext('SFX_DEFS', ctx);
  assert.ok(defs && typeof defs === 'object', 'SFX_DEFS 应为对象(守卫假设失灵, 检查桩环境)');
  /* vm 跨 realm 的对象原型与本 realm 不同, deepStrictEqual 直接比会假红;
     SFX_DEFS 是纯 JSON 数据(数/串/数组/_plain 对象), JSON 往返转成本 realm 对象再比 */
  for (const [kind, e] of Object.entries(AudioRegistry.SFX_KINDS)) {
    if (e.synth === undefined) continue;
    assert.ok(defs[kind] !== undefined, kind + ' 不在 SFX_DEFS 里, 谈不上原样迁入');
    assert.deepStrictEqual(e.synth, JSON.parse(JSON.stringify(defs[kind])),
        kind + ' synth 应与 SFX_DEFS 原样一致');
  }
});
