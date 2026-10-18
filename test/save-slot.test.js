"use strict";
/* 存档槽 (js/save-slot.js) 单测 — node --test (零依赖)
   运行: node --test test/save-slot.test.js */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { mkSaveSlot } = require('../js/save-slot.js');

function mkStorage(seed){
  const m = new Map(Object.entries(seed || {}));
  return { get:k=> (m.has(k) ? m.get(k) : null), set:(k,v)=>{ m.set(k, v); }, remove:k=>{ m.delete(k); }, _m:m };
}
const parse = s => JSON.parse(s);

/* ============ 槽语义 ============ */

test('空槽: 返回 defaults 深拷贝, 两次 load 互不污染', () => {
  const st = mkStorage();
  const slot = mkSaveSlot(st, 'k', { defaults: { unlocked: 0, stars: {} } });
  const a = slot.load();
  a.stars['0'] = 3; a.unlocked = 9;
  const b = slot.load();
  assert.deepStrictEqual(b, { unlocked: 0, stars: {} });   // 不受上次污染
  assert.deepStrictEqual(a.stars, { '0': 3 });
});

test('save/load 往返, 存档写入 _v', () => {
  const st = mkStorage();
  const slot = mkSaveSlot(st, 'k', { defaults: { unlocked: 0, stars: {} } });
  slot.save({ unlocked: 5, stars: { '2': 3 } });
  assert.strictEqual(parse(st._m.get('k'))._v, 1);         // 版本落盘
  const s = slot.load();
  assert.strictEqual(s.unlocked, 5);
  assert.strictEqual(s.stars['2'], 3);
  assert.strictEqual(s._v, undefined);                     // 版本号不进调用方状态
});

test('损坏 JSON / 非对象 → defaults, 不抛', () => {
  const st = mkStorage({ a: 'not-json{{{', b: '"hello"', c: '[1,2]' });
  const slot = k => mkSaveSlot(st, k, { defaults: { ok: 1 } });
  for(const k of ['a', 'b', 'c']) assert.deepStrictEqual(slot(k).load(), { ok: 1 });
});

test('未来版本(_v 高于 schema) → 不猜形状, 回 defaults', () => {
  const st = mkStorage({ k: JSON.stringify({ _v: 99, x: 1 }) });
  const s = mkSaveSlot(st, 'k', { version: 1, defaults: { x: 0 } }).load();
  assert.deepStrictEqual(s, { x: 0 });
});

test('migrate 链: 老数据(无 _v = 版本0)逐级升级', () => {
  const st = mkStorage({ k: JSON.stringify({ old: 7 }) });
  const slot = mkSaveSlot(st, 'k', {
    version: 2, defaults: { old: 0, a: '', b: '' },
    migrate(s, from){
      if(from === 0) s.a = 'm0';
      if(from === 1) s.b = 'm1';
      return s;
    },
  });
  const s = slot.load();
  assert.strictEqual(s.old, 7);                            // 原字段保留
  assert.strictEqual(s.a, 'm0');
  assert.strictEqual(s.b, 'm1');
});

test('defaults 只补缺失字段: 已存值不被覆盖', () => {
  const st = mkStorage({ k: JSON.stringify({ unlocked: 4 }) });
  const s = mkSaveSlot(st, 'k', { defaults: { unlocked: 0, stars: {}, history: [] } }).load();
  assert.strictEqual(s.unlocked, 4);
  assert.deepStrictEqual(s.stars, {});
  assert.deepStrictEqual(s.history, []);
});

test('encode/decode: Map 往返与空 Map', () => {
  const st = mkStorage();
  const slot = mkSaveSlot(st, 'k', {
    defaults: { scene: null, edits: {} },
    encode: t => ({ scene: t.scene, edits: Object.fromEntries([...t.edits].map(([id, m]) => [id, [...m.entries()]])) }),
    decode: v => ({ scene: v.scene, edits: Object.fromEntries(Object.keys(v.edits).map(id => [id, new Map(v.edits[id])])) }),
  });
  const edits = new Map([['grass', new Map([['1,2,3', 5]])], ['house', new Map()]]);
  slot.save({ scene: 'grass', edits });
  const s = slot.load();
  assert.strictEqual(s.scene, 'grass');
  assert.ok(s.edits.grass instanceof Map);
  assert.strictEqual(s.edits.grass.get('1,2,3'), 5);
  assert.strictEqual(s.edits.house.size, 0);
});

test('decode 抛错 → defaults, 不抛', () => {
  const st = mkStorage({ k: JSON.stringify({ edits: { x: 'garbage-not-array' } }) });
  const slot = mkSaveSlot(st, 'k', {
    defaults: { edits: {} },
    decode: v => { if(!Array.isArray(v.edits.x)) throw new Error('bad'); return v; },
  });
  assert.deepStrictEqual(slot.load(), { edits: {} });
});

test('reset: 移除槽位', () => {
  const st = mkStorage();
  const slot = mkSaveSlot(st, 'k', { defaults: { a: 1 } });
  slot.save({ a: 2 });
  slot.reset();
  assert.strictEqual(st._m.has('k'), false);
  assert.deepStrictEqual(slot.load(), { a: 1 });
});

/* ============ 真实用户数据夹具 (schema 与三个模式文件一致) ============ */

for(const f of ['progress-device-a.json', 'progress-device-b.json']){
  test(`真实夹具 ${f}: 三种存档过槽, 字段零丢失`, () => {
    const blob = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));
    const st = mkStorage(blob);

    /* tnt (与 modes/tnt.js 同 schema; 该设备可能从未玩过 TNT → 应回 defaults) */
    const tnt = mkSaveSlot(st, 'tnt_escape_progress', { defaults: { unlocked: 0, stars: {} } }).load();
    if(blob.tnt_escape_progress){
      const origTnt = parse(blob.tnt_escape_progress);
      assert.strictEqual(tnt.unlocked, origTnt.unlocked);
      assert.deepStrictEqual(tnt.stars, origTnt.stars || {});
    } else {
      assert.deepStrictEqual(tnt, { unlocked: 0, stars: {} });
    }

    /* focus (含 v0 残留 daily 的摘除验证) */
    const focus = mkSaveSlot(st, 'focus_camp_save', {
      defaults: { unlocked: 0, stars: {}, history: [] },
      migrate(s, from){ if(from === 0 && s && s.daily) delete s.daily; return s; },
    }).load();
    const origFocus = parse(blob.focus_camp_save);
    assert.strictEqual(focus.unlocked, origFocus.unlocked);
    assert.deepStrictEqual(focus.stars, origFocus.stars || {});
    assert.strictEqual(focus.history.length, (origFocus.history || []).length);
    assert.strictEqual(focus.daily, undefined);            // 老字段被 v0 迁移摘除

    /* build (Map 编解码) */
    const build = mkSaveSlot(st, 'build_world_save', {
      defaults: { scene: null, edits: {} },
      encode: t => ({ scene: t.scene, edits: Object.fromEntries(Object.keys(t.edits).map(id => [id, [...t.edits[id].entries()]])) }),
      decode: v => ({ scene: v.scene, edits: Object.fromEntries(Object.keys(v.edits || {}).map(id => [id, new Map(v.edits[id])])) }),
    }).load();
    const origBuild = parse(blob.build_world_save);
    assert.strictEqual(build.scene, origBuild.scene);
    for(const id in (origBuild.edits || {})){
      assert.ok(build.edits[id] instanceof Map);
      assert.strictEqual(build.edits[id].size, origBuild.edits[id].length);
    }
  });
}
