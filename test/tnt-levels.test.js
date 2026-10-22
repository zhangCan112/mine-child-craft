'use strict';
/* TNT 关卡数据 (js/tnt-levels.js) 可建性冒烟 — node --test (零依赖)
   vm 同 context 链式加载 config→voxel→scene-kit→tnt-levels,
   镜像浏览器 <script defer> 共享词法环境(同 test/voxel.test.js 的加载器思路)
   每关: 清场 → build() → 四类断言:
   (a) 不抛错 (b) exit zone 存在且出口墙柱可达(裂纹砖/铁门)
   (c) tnts/pickups 落点 build 后为空 (d) 出生格为空且脚下有支撑 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLevels() {
  const ctx = vm.createContext({console});
  for (const f of ['config.js', 'voxel.js', 'scene-kit.js', 'tnt-levels.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`
    globalThis.__lv = { TNT_LEVELS, world, getBlock, B_CRACK, B_DOOR };
  `, ctx);
  return ctx.__lv;
}

test('TNT_LEVELS 共 10 关且都有 build/spawn', () => {
  const lv = loadLevels();
  assert.strictEqual(lv.TNT_LEVELS.length, 10);
  for (const L of lv.TNT_LEVELS) {
    assert.strictEqual(typeof L.build, 'function');
    assert.ok(L.spawn && L.spawn.x !== undefined);
  }
});

for (let i=0; i<10; i++) {
  test('L'+(i+1)+' 可建性: build 不抛错, 出口墙可达, 实体落点为空, 出生有支撑', () => {
    const lv = loadLevels();
    lv.world.clear(); // 前置清场(纯数据侧, 不涉渲染)
    const L = lv.TNT_LEVELS[i];
    assert.doesNotThrow(()=> L.build()); // (a)
    const z = L.exit; // (b)
    assert.ok(z && z.x1 !== undefined, 'exit zone 存在');
    let doorish = 0;
    for (let x=z.x1; x<=z.x2; x++) {
      for (let y=11; y<=13; y++) {
        const id = lv.getBlock(x, y, z.z2+1); // 出口墙 = zone 紧北一列
        if (id===lv.B_CRACK || id===lv.B_DOOR) doorish++;
      }
    }
    assert.ok(doorish >= 1, '出口墙柱有裂纹砖/铁门');
    for (const t of (L.tnts||[])) { // (c)
      assert.strictEqual(lv.getBlock(t.x, t.y, t.z), 0, 'tnt 落点为空');
    }
    for (const p of (L.pickups||[])) {
      assert.strictEqual(lv.getBlock(p.x, p.y, p.z), 0, 'pickup 落点为空');
    }
    const s = L.spawn; // (d)
    assert.strictEqual(lv.getBlock(s.x, 11, s.z), 0, '出生格为空');
    let support = false;
    for (let y=10; y>=5; y--) {
      if (lv.getBlock(s.x, y, s.z) !== 0) {
        support = true; break;
      }
    }
    assert.ok(support, '出生脚下 6 格内有支撑');
  });
}
