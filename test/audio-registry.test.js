'use strict';
/* 声音清单注册表 (js/audio-registry.js) 消费端断言 — node --test
   运行: node --test test/audio-registry.test.js
   把"清单是唯一权威"从口头约定变成断言(先例 mode-registry.test.js):
   ① js/** 每处 sfx('…') 字面量都在 SFX_KINDS 登记(漏登记即红),
     且只收活着的 kind(TNT 死键不迁);
   ② 条目形状防错网(synth/file 至少其一(file 须带 synth 回退, A7 起共存) + g/gTouch/prio/coolMs 齐全);
   ③ MOODS 键集与模式注册表逐条对齐, 值 ∈ 合法情绪集;
   ④ 样本 file 条目须真实存在于 assets/audio/ 且 CREDITS.md 记载
     (A2 无样本空转, A7 素材入库后咬合);
   ⑤ 过渡期守卫: synth 定义与 effects.js 的 SFX_DEFS 原样一致
     (A4 迁走解释器删表后自动退场)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const AudioRegistry = require('../js/audio-registry.js');
const ModeRegistry = require('../js/mode-registry.js');

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

/* 扫 js/** 全部 sfx('…') / sfx("…") 字面量调用: [{where: '文件:行', kind}]。
   动态 kind(变量传参)无法静态收网, 现全库 37 处调用均为字面量;
   新代码若出现动态 kind, 应改回字面量或来注册表补登后再议。 */
function scanSfxLiterals() {
  const found = [];
  for (const p of walk(path.join(ROOT, 'js'))) {
    if (!p.endsWith('.js')) continue;
    const src = fs.readFileSync(p, 'utf8');
    let m;
    const re = /\bsfx\(\s*(['"])([A-Za-z0-9_-]+)\1\s*\)/g;
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

test('声音清单: 只收活着的 kind — 12 活键齐备, TNT 死键(fss/door/splash)不迁', () => {
  const keys = Object.keys(AudioRegistry.SFX_KINDS);
  for (const k of ['zap', 'boom', 'pick', 'click', 'death', 'hit', 'hurt',
    'shoot', 'level', 'win', 'roar', 'breath']) {
    assert.ok(keys.includes(k), '缺活键: ' + k + '(工单 A2 基线)');
  }
  for (const dead of ['fss', 'door', 'splash']) {
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

test('声音清单: MOODS 键 = 模式注册表全集 + menu(新模式忘声明情绪即红), 值 ∈ 合法情绪集', () => {
  const legal = ['calm', 'battle', 'dark', 'none'];
  const expectKeys = [...ModeRegistry.all.map((m) => m.id), 'menu'].sort();
  assert.deepStrictEqual(Object.keys(AudioRegistry.MOODS).sort(), expectKeys,
      'MOODS 键集应覆盖全部模式 id + menu(无配乐的模式显式写 none)');
  for (const [k, v] of Object.entries(AudioRegistry.MOODS)) {
    assert.ok(legal.includes(v), 'MOODS.' + k + ' 情绪值非法: ' + v + ' ∈ ' + legal.join('|'));
  }
});

test('声音清单: MOODS 基线 = menu/build→calm · arena/tank→battle · nether/adventure→dark · focus→none', () => {
  const m = AudioRegistry.MOODS;
  assert.strictEqual(m.menu, 'calm');
  assert.strictEqual(m.build, 'calm');
  assert.strictEqual(m.arena, 'battle');
  assert.strictEqual(m.tank, 'battle');
  assert.strictEqual(m.nether, 'dark');
  assert.strictEqual(m.adventure, 'dark');
  assert.strictEqual(m.focus, 'none', '专注训练营无 BGM(注意力训练哲学, spec 拍板)');
});

test('声音清单: MUSIC_TRACKS 条目形状 {file, mood, g, durMs}, 曲目情绪不含 none(A7 起填曲)', () => {
  for (const [id, t] of Object.entries(AudioRegistry.MUSIC_TRACKS)) {
    assert.strictEqual(typeof t.file, 'string', id + ' 缺 file(assets/audio/ 下文件名)');
    assert.ok(['calm', 'battle', 'dark'].includes(t.mood),
        id + ' mood 非法: ' + t.mood + '(none=不放曲, 曲目不该有)');
    assert.strictEqual(typeof t.g, 'number', id + ' 缺数值增益 g');
    assert.ok(t.g > 0, id + '.g 须为正增益');
    assert.ok(Number.isInteger(t.durMs) && t.durMs > 0,
        id + ' 缺实测 durMs(MusicDirector 判曲毕唯一依据, A3 备注②; 转码后 ffmpeg 实测毫秒)');
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
