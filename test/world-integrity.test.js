'use strict';
/* 世界完整性不变量 (js/world.js 编辑管线 × js/cascade-core.js) — node --test (零依赖)
   运行: node --test test/world-integrity.test.js
   方块级联设计稿 T7 防线: 脚本化极端交互(整树砍/批量爆破/挖底座/挖树脚/挖隧道)
   走**真实的 editBlock / editBlockDirty 接线**(THREE/DOM 以全放行桩代之,
   手法同 world-rings.test.js), 事后全图扫描三条不变量:
     ① need — 每片树叶 taxicab 4 内有原木;
     ② thin — 每个依附块脚下是实心支撑;
     ③ fell — 每个原木组件有成员接地。
   身份原则的防手滑面: 地形方块(石头/泥土)无旗标, 极端交互后纹丝不动。
   扫描直读 worldCells(免逐格跨 vm 边界)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mkAny() {
  const f = function() {
    return any;
  };
  const any = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '{}';
      if (k === Symbol.iterator) {
        return function() {
          return {next: () => ({done: true, value: any})};
        };
      }
      return any;
    },
    set() {
      return true;
    },
    apply() {
      return any;
    },
    construct() {
      return any;
    },
    has() {
      return true;
    },
  });
  return any;
}

/* 每测试一世界: fresh vm(与 world-rings 同款桩), editBlock 级联走真装配 */
function mkH() {
  const sandbox = {
    console: {log() {}, warn() {}, error() {}},
    performance: {now: () => 0},
    requestAnimationFrame() {},
    THREE: mkAny(), document: mkAny(), navigator: {maxTouchPoints: 0},
    location: {protocol: 'file:'},
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {},
    Fx: {debrisBurst() {}}, /* 碎屑观感桩(级联碎屑走 Fx, 行为断言不需要) */
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['config.js', 'voxel.js', 'cascade-core.js', 'mesh-core.js',
    'texture-atlas.js', 'scene-kit.js', 'world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  const h = vm.runInContext(`globalThis.__h = {
    editBlock, editBlockDirty, getBlock, setBlockRaw, SceneKit, clearWorld,
    BLOCKS, worldCells, W: WORLD_W, H: WORLD_H, D: WORLD_D,
  }; __h;`, ctx);
  h.at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= h.W || y >= h.H || z >= h.D) ?
    0 : h.worldCells[(y * h.D + z) * h.W + x];
  h.countIn = (id, x1, x2, y1, y2, z1, z2) => {
    let n = 0;
    for (let y = y1; y <= y2; y++) {
      for (let z = z1; z <= z2; z++) {
        for (let x = x1; x <= x2; x++) if (h.at(x, y, z) === id) n++;
      }
    }
    return n;
  };
  return h;
}

/* 全图三不变量扫描(设计稿 D2 语义的独立复核, 不调用核心函数) */
function scanViolations(h) {
  const bad = [];
  const fellSeen = new Set();
  const depNear = (x, y, z, need) => {/* need 存活: taxicab dist 内有依赖方块 */
    for (let dy = -need.dist; dy <= need.dist; dy++) {
      for (let dz = -need.dist; dz <= need.dist; dz++) {
        for (let dx = -need.dist; dx <= need.dist; dx++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > need.dist) continue;
          if (h.at(x + dx, y + dy, z + dz) === need.id) return true;
        }
      }
    }
    return false;
  };
  for (let y = 0; y < h.H; y++) {
    for (let z = 0; z < h.D; z++) {
      for (let x = 0; x < h.W; x++) {
        const id = h.at(x, y, z);
        if (!id) continue;
        const def = h.BLOCKS[id];
        if (def.need && !depNear(x, y, z, def.need)) bad.push({k: 'need', x, y, z, id});
        if (def.thin != null) {
          const b = h.at(x, y - 1, z);
          const bd = b ? h.BLOCKS[b] : null;
          if (!bd || bd.solid === false || bd.thin != null) bad.push({k: 'thin', x, y, z, id});
        }
        if (def.fell && !fellSeen.has(x + ',' + y + ',' + z)) {
          /* fell 组件接地: BFS 收全组件, 任一成员 y=0 或脚下是外部实心支撑 */
          const comp = [];
          const stack = [[x, y, z]];
          fellSeen.add(x + ',' + y + ',' + z);
          let grounded = false;
          while (stack.length) {
            const m = stack.pop();
            comp.push(m);
            if (m[1] === 0) grounded = true;
            const below = h.at(m[0], m[1] - 1, m[2]);
            if (below !== 0 && !h.BLOCKS[below].fell && h.BLOCKS[below].solid !== false) grounded = true;
            for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
              const nx = m[0] + d[0]; const ny = m[1] + d[1]; const nz = m[2] + d[2];
              const k = nx + ',' + ny + ',' + nz;
              const nid = h.at(nx, ny, nz);
              if (nid !== 0 && h.BLOCKS[nid].fell && !fellSeen.has(k)) {
                fellSeen.add(k);
                stack.push([nx, ny, nz]);
              }
            }
          }
          if (!grounded) for (const m of comp) bad.push({k: 'fell', x: m[0], y: m[1], z: m[2], id});
        }
      }
    }
  }
  return bad;
}

/* 布景: 泥地面板 + 三棵树(间距 10, 冠不交叠) */
function buildForest(h) {
  for (let z = 14; z <= 46; z++) {
    for (let x = 14; x <= 46; x++) h.setBlockRaw(x, 1, z, 2);
  }
  h.SceneKit.tree(20, 2, 20);
  h.SceneKit.tree(30, 2, 20);
  h.SceneKit.tree(40, 2, 20);
}

test('不变量基线: 布景森林本身干净(扫描器对无交互世界零违例)', () => {
  const h = mkH();
  buildForest(h);
  assert.deepStrictEqual(scanViolations(h), []);
});

test('砍整树(真 editBlock 接线): 干+叶全清, 返回级联清单, 邻树完好', () => {
  const h = mkH();
  buildForest(h);
  const keepLogs = h.countIn(5, 36, 44, 1, 12, 16, 24);
  const keepLeaves = h.countIn(7, 36, 44, 1, 12, 16, 24);
  const removed = h.editBlock(20, 2, 20, 0);
  assert.ok(removed.length >= 40, '级联清单含整树(干+叶), 实际 ' + removed.length);
  assert.ok(removed.some((r) => r.id === 5) && removed.some((r) => r.id === 7), '清单含原木与树叶');
  assert.deepStrictEqual(scanViolations(h), [], '交互后全图三不变量成立');
  assert.strictEqual(h.countIn(5, 36, 44, 1, 12, 16, 24), keepLogs, '邻树原木不少');
  assert.strictEqual(h.countIn(7, 36, 44, 1, 12, 16, 24), keepLeaves, '邻树叶不少');
});

test('批量爆破(真 editBlockDirty 接线, 坦克/TNT 同款 seam): 波及原木整树倒', () => {
  const h = mkH();
  buildForest(h);
  const cx = 30; const cy = 2; const cz = 20; /* 爆心在树2根部 */
  for (let dx = -4; dx <= 4; dx++) {
    for (let dy = -1; dy <= 4; dy++) {
      for (let dz = -4; dz <= 4; dz++) {
        const bx = cx + dx; const by = cy + dy; const bz = cz + dz;
        if (Math.hypot(bx + 0.5 - cx - 0.5, by + 0.5 - cy - 0.5, bz + 0.5 - cz - 0.5) > 3.5) continue;
        if (h.at(bx, by, bz) !== 0) h.editBlockDirty(bx, by, bz, 0);
      }
    }
  }
  assert.strictEqual(h.countIn(5, 25, 35, 1, 12, 15, 25), 0, '爆心树整棵倒(级联超出爆区)');
  assert.deepStrictEqual(scanViolations(h), [], '爆破后全图不变量成立');
});

test('挖火把底座(真 editBlock): 依附块脱落, 全图无悬空 thin', () => {
  const h = mkH();
  h.setBlockRaw(20, 1, 20, 1); /* 草地 */
  h.setBlockRaw(20, 2, 20, 48); /* 火把 */
  const removed = h.editBlock(20, 1, 20, 0);
  assert.strictEqual(removed.length, 1, '火把脱落');
  assert.strictEqual(removed[0].id, 48);
  assert.deepStrictEqual(scanViolations(h), []);
});

test('挖树脚泥土(真 editBlock): 失接地整树倒(P5 身份原则推论)', () => {
  const h = mkH();
  buildForest(h);
  h.editBlock(20, 1, 20, 0); /* 挖的是泥土 */
  assert.strictEqual(h.countIn(5, 15, 25, 1, 12, 15, 25), 0, '整树倒');
  assert.deepStrictEqual(scanViolations(h), []);
});

test('地下隧道(身份原则防线): 石头无旗标, 挖空洞穴顶板纹丝不动', () => {
  const h = mkH();
  for (let z = 10; z <= 30; z++) {
    for (let x = 10; x <= 30; x++) {
      for (let y = 1; y <= 10; y++) h.setBlockRaw(x, y, z, 3); /* 实心石方 */
    }
  }
  const stoneBefore = h.countIn(3, 10, 30, 1, 10, 10, 30);
  let cascades = 0;
  for (let z = 15; z <= 25; z++) {
    for (let x = 15; x <= 25; x++) {
      for (let y = 2; y <= 4; y++) cascades += h.editBlock(x, y, z, 0).length; /* 挖 11×3×11 隧道 */
    }
  }
  assert.strictEqual(cascades, 0, '石头零级联(每一次破坏的返回清单都是空)');
  const carved = 11 * 11 * 3;
  assert.strictEqual(h.countIn(3, 10, 30, 1, 10, 10, 30), stoneBefore - carved, '顶板/四壁一块不少');
  assert.deepStrictEqual(scanViolations(h), []);
});

test('放置永不触发级联: 浮空原木/树叶放上去就悬空, 破坏邻近才结算', () => {
  const h = mkH();
  for (let z = 14; z <= 46; z++) {
    for (let x = 14; x <= 46; x++) h.setBlockRaw(x, 1, z, 2);
  }
  const r1 = h.editBlock(20, 6, 20, 5); /* 放浮空原木 */
  const r2 = h.editBlock(30, 6, 20, 7); /* 放浮空树叶(远离原木, 不被误支撑) */
  assert.strictEqual(r1.length, 0, '放置返回空清单(级联只在破坏时结算)');
  assert.strictEqual(r2.length, 0);
  assert.strictEqual(h.at(20, 6, 20), 5, '浮空原木在(建造模式装饰保护)');
  assert.strictEqual(h.at(30, 6, 20), 7, '浮空树叶在');
  assert.deepStrictEqual(scanViolations(h), [ /* 不变量如实报告既有浮空——世界自洽只在编辑后追认, 放置不追溯 */
    {k: 'fell', x: 20, y: 6, z: 20, id: 5},
    {k: 'need', x: 30, y: 6, z: 20, id: 7},
  ]);
});
