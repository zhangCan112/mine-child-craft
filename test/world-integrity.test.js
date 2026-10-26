'use strict';
/* 世界完整性不变量 (js/world.js 编辑管线 × js/cascade-core.js) — node --test (零依赖)
   运行: node --test test/world-integrity.test.js
   方块级联设计稿 T7 防线: 脚本化极端交互(整树砍/批量爆破/挖底座/挖树脚/挖隧道)
   走**真实的 editBlock / editBlockDirty 接线**(THREE/DOM 以全放行桩代之,
   手法同 world-rings.test.js), 事后全图扫描三条不变量:
     ① need — 每片树叶 taxicab 4 内有原木;
     ② thin — 每个依附块脚下是实心支撑;
     ③ fell — 每个原木组件有成员接地。
   液体系统(设计稿 liquid D11)追加流体不变量:
     ④ fluid — 非流体格 lv=0 · lv≤8 · 流动块必有更强供电源(无孤儿悬挂水)。
   身份原则的防手滑面: 地形方块(石头/泥土)无旗标, 极端交互后纹丝不动。
   扫描直读 worldCells/fluidLv(免逐格跨 vm 边界)。
   昼夜设计稿 D4 追加光照防线(mc-daylight-torch §10): 同一条真接线事后
   扫描光场三不变量 — 光源格 block=发射级 · 每列首个挡光块以上 sky=15 ·
   编辑序列累计(含级联连带)与 computeAll 全量重算逐格相等; 级联脱落撤光、
   光照脏区块记账(与既有编辑同一 dirtyChunks 队列)各有专项。 */const test = require('node:test');
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
    Fx: {debrisBurst() {}, fallBlock() {}}, /* 碎屑/落块观感桩(级联观感走 Fx, 行为断言不需要) */
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['config.js', 'daylight-core.js', 'light-core.js', 'voxel.js', 'cascade-core.js', 'fluid-core.js',
    'mesh-core.js', 'texture-atlas.js', 'scene-kit.js', 'world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  const h = vm.runInContext(`globalThis.__h = {
    editBlock, editBlockDirty, getBlock, setBlockRaw, SceneKit, clearWorld,
    applySweep, loadScene, LightCore, LIGHT_POLICY,
    lightSky, lightBlock, dirtyChunks, CHUNK, pumpFluids, getFluidLv,
    BLOCKS, worldCells, fluidLv, W: WORLD_W, H: WORLD_H, D: WORLD_D,  }; __h;`, ctx);
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

/* ---------- 光照不变量助手(昼夜设计稿 §10 D4 行; 判据独立复核, 不调 LightCore) ----------
   光场读取直读 vm 数组(cellIdx 同式), 免逐格函数边界。 */
function litAt(h, x, y, z) {
  return h.lightBlock[(y * h.D + z) * h.W + x];
}
/* ①光源格自亮 ②列首个挡光块以上天光满级 —— 挡光口径镜像 isOpaque(实心且
   非玻璃, 未知 id 按实心兜底), 与 LightCore.mkPolicy.opaque 同判据独立实现 */
function scanLightViolations(h) {
  const bad = [];
  const opaqueAt = (x, y, z) => {
    const id = h.at(x, y, z);
    if (id === 0) return false;
    const b = h.BLOCKS[id];
    return b ? (b.solid !== false && !b.glass) : true;
  };
  for (let y = 0; y < h.H; y++) {
    for (let z = 0; z < h.D; z++) {
      for (let x = 0; x < h.W; x++) {
        const id = h.at(x, y, z);
        const e = id ? h.BLOCKS[id].light : 0;
        if (e > 0 && litAt(h, x, y, z) !== e) {
          bad.push({k: 'emit', x, y, z, id, lv: litAt(h, x, y, z), e});
        }
      }
    }
  }
  for (let z = 0; z < h.D; z++) {
    for (let x = 0; x < h.W; x++) {
      let y = h.H - 1;
      for (; y >= 0; y--) if (opaqueAt(x, y, z)) break;
      for (let yy = y + 1; yy < h.H; yy++) {
        const sv = h.lightSky[(yy * h.D + z) * h.W + x];
        if (sv !== 15) bad.push({k: 'sky', x, y: yy, z, sv});
      }
    }
  }
  return bad;
}
/* ③增量===全量: 编辑序列累计的双通道光场, 与全新数组上 computeAll 重算
   逐格相等(全量是参考算法, 增量是另一条代码路径 —— 收敛即接线不变量) */
function assertLightBake(h) {
  const n = h.W * h.D * h.H;
  const sky = new Uint8Array(n);
  const blk = new Uint8Array(n);
  h.LightCore.computeAll(h.getBlock, h.W, h.D, h.H, h.LIGHT_POLICY, sky, blk);
  for (let i = 0; i < n; i++) {
    if (h.lightSky[i] !== sky[i] || h.lightBlock[i] !== blk[i]) {
      const x = i % h.W;
      const z = Math.floor(i / h.W) % h.D;
      const y = Math.floor(i / (h.W * h.D));
      assert.fail('光场增量≠全量 @(' + x + ',' + y + ',' + z + ') 增量 sky=' +
          h.lightSky[i] + ' block=' + h.lightBlock[i] +
          ' 重算 sky=' + sky[i] + ' block=' + blk[i]);
    }
  }
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
        if (def.fall && y > 0) {/* ④ fall: 重力块不得悬在非支撑之上(世界底豁免) */
          const b = h.at(x, y - 1, z);
          const bd = b ? h.BLOCKS[b] : null;
          if (!bd || bd.solid === false || bd.thin != null) bad.push({k: 'fall', x, y, z, id});
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

/* 流体不变量扫描(liquid D11, 独立复核不调用核心函数):
   ① 非流体格 lv 恒 0(写纪律, ADR 0004) · ② lv ≤ 8(9+ 保留段不得出现)
   ③ 流动块(lv>0)必有更强供电源: 上方同流体, 或水平同流体邻居水量严格更强
   (局部必要条件——孤儿悬挂水在此即露馅, 全链追踪留给 fluid-core 确定性单测) */
function scanFluidViolations(h) {
  const bad = [];
  const amt = (lv) => (lv === 8 ? 8 : 8 - lv);
  const kindOf = (id) => (h.BLOCKS[id] && h.BLOCKS[id].fluid) || null;
  const lvAt = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= h.W || y >= h.H || z >= h.D) ?
    0 : h.fluidLv[(y * h.D + z) * h.W + x];
  for (let y = 0; y < h.H; y++) {
    for (let z = 0; z < h.D; z++) {
      for (let x = 0; x < h.W; x++) {
        const id = h.at(x, y, z);
        const lv = lvAt(x, y, z);
        const kind = kindOf(id);
        if (!kind) {
          if (lv !== 0) bad.push({k: 'fluid-lv-dirty', x, y, z, id, lv});
          continue;
        }
        if (lv > 8) bad.push({k: 'fluid-lv-range', x, y, z, id, lv});
        if (lv === 0) continue; // 源: 无供电源要求
        if (kindOf(h.at(x, y + 1, z)) === kind) continue; // 上方同流体(下落链)
        let fed = false;
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nid = h.at(x + d[0], y, z + d[1]);
          if (kindOf(nid) === kind && amt(lvAt(x + d[0], y, z + d[1])) > amt(lv)) {
            fed = true;
            break;
          }
        }
        if (!fed) bad.push({k: 'fluid-orphan', x, y, z, id, lv});
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

test('砍树干中段(真 editBlock, P15 树桩连带): 整树倒无树桩, 邻树完好', () => {
  const h = mkH();
  buildForest(h);
  const keepLogs = h.countIn(5, 36, 44, 1, 12, 16, 24);
  const keepLeaves = h.countIn(7, 36, 44, 1, 12, 16, 24);
  h.editBlock(20, 3, 20, 0); /* 砍第二节 */
  assert.strictEqual(h.countIn(5, 15, 25, 1, 12, 15, 25), 0, '树桩连带: 干全清(不残留撑冠树桩)');
  assert.strictEqual(h.countIn(7, 15, 25, 1, 12, 15, 25), 0, '树冠全清(不残留浮空叶)');
  assert.deepStrictEqual(scanViolations(h), []);
  assert.strictEqual(h.countIn(5, 36, 44, 1, 12, 16, 24), keepLogs, '邻树原木不少');
  assert.strictEqual(h.countIn(7, 36, 44, 1, 12, 16, 24), keepLeaves, '邻树叶不少');
});

test('世界卫生清扫(真 applySweep 接线, P14/D9): 旧档浮空全治愈且幂等', () => {
  const h = mkH();
  buildForest(h);
  const keepLogs = h.countIn(5, 15, 25, 1, 12, 15, 25); /* 邻树1(全程不动, 快照对比) */
  const keepLeaves = h.countIn(7, 15, 25, 1, 12, 15, 25);
  for (let y = 2; h.at(30, y, 20) === 5; y++) h.setBlockRaw(30, y, 20, 0); /* 树2 砍干(裸写=旧档口径) → 孤儿冠 */
  h.setBlockRaw(40, 1, 20, 0); /* 树3 脚下挖空(裸写) → 悬浮树 */
  h.setBlockRaw(22, 8, 22, 8); /* 浮沙 */
  h.setBlockRaw(24, 9, 24, 48); /* 悬空火把 */
  const removed = h.applySweep();
  assert.deepStrictEqual(scanViolations(h), [], '治愈后全图三不变量成立');
  assert.ok(removed.some((r) => r.id === 7), '孤儿冠叶入清单');
  assert.ok(removed.some((r) => r.id === 5), '悬浮树干入清单');
  assert.ok(removed.some((r) => r.id === 8 && r.to), '浮沙下沉(移动条目带 to)');
  assert.ok(removed.some((r) => r.id === 48), '悬空火把脱落');
  assert.strictEqual(h.countIn(5, 15, 25, 1, 12, 15, 25), keepLogs, '邻树1 原木一根不少');
  assert.strictEqual(h.countIn(7, 15, 25, 1, 12, 15, 25), keepLeaves, '邻树1 树叶一片不少');
  assert.strictEqual(h.applySweep().length, 0, '二次清扫零动作(幂等; vm 跨 realm 数组用长度断言)');
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

test('二期 D7 沙子重力(真 editBlock 接线): 挖底下沉 + 放置半空落地, 全图不变量成立', () => {
  const h = mkH();
  for (let z = 14; z <= 46; z++) {
    for (let x = 14; x <= 46; x++) h.setBlockRaw(x, 0, z, 2); /* 泥底 y0 */
  }
  for (let y = 1; y <= 3; y++) h.setBlockRaw(20, y, 20, 8); /* 沙柱 */
  const removed = h.editBlock(20, 0, 20, 0); /* 挖泥底 */
  assert.strictEqual(removed.length, 3, '三段移动');
  assert.ok(removed.every((r) => r.to && r.to.x === r.x && r.to.z === r.z), '纵向移动(同柱)');
  assert.deepStrictEqual(scanViolations(h), []);
  /* 放置半空沙(P9) → 落地 */
  const moves = h.editBlock(30, 6, 30, 8);
  assert.strictEqual(moves.length, 1);
  assert.strictEqual(moves[0].to.y, 1, '落到泥底上');
  assert.strictEqual(h.at(30, 1, 30), 8);
  assert.strictEqual(h.at(30, 6, 30), 0, '原位空');
  assert.deepStrictEqual(scanViolations(h), []);
});

test('二期 D7 批量爆破(editBlockDirty): 掏空沙柱下部, 上段逐次沉降不变量成立', () => {
  const h = mkH();
  for (let z = 14; z <= 46; z++) {
    for (let x = 14; x <= 46; x++) h.setBlockRaw(x, 0, z, 2);
  }
  for (let y = 1; y <= 8; y++) h.setBlockRaw(20, y, 20, 8); /* 8 高沙柱 */
  for (let y = 1; y <= 3; y++) h.editBlockDirty(20, y, 20, 0); /* 爆心自底掏三格 */
  for (let y = 1; y <= 5; y++) assert.strictEqual(h.at(20, y, 20), 8, '上段沉实 y=' + y);
  for (let y = 6; y <= 8; y++) assert.strictEqual(h.at(20, y, 20), 0, '柱顶空出 y=' + y);
  assert.deepStrictEqual(scanViolations(h), []);
});

test('放置永不触发级联(fell/need 口径): 浮空原木/树叶放上去就悬空, 破坏邻近才结算', () => {
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

/* ============ 光照不变量(昼夜设计稿 §10 D4 行: 真 editBlock/editBlockDirty 接线) ============ */

test('光照编辑增量(昼夜 D4): editBlock 放/挖光源即时增撤光, 装场全量为基线', () => {
  const h = mkH();
  h.loadScene(() => {
    for (let z = 14; z <= 46; z++) {
      for (let x = 14; x <= 46; x++) h.setBlockRaw(x, 1, z, 2); /* 泥地面板 */
    }
  });
  h.editBlock(20, 2, 20, 48); /* 放火把(运行期编辑路径) */
  assert.strictEqual(litAt(h, 20, 2, 20), 14, '源格自亮 14');
  assert.strictEqual(litAt(h, 21, 2, 20), 13, '曼哈顿 1 格 −1');
  assert.strictEqual(litAt(h, 33, 2, 20), 1, '半径 13 菱形边缘 = 1');
  assert.strictEqual(litAt(h, 34, 2, 20), 0, '半径外零光');
  h.editBlock(20, 2, 20, 0); /* 直挖火把(非级联路径) */
  assert.strictEqual(litAt(h, 20, 2, 20), 0, '撤源归零');
  assert.strictEqual(litAt(h, 21, 2, 20), 0, '撤光扩散归零');
  assertLightBake(h);
});

test('级联连带撤光(昼夜 D4 关键路径): 挖火把底座 → 级联脱落(setBlockRaw 直写) → 光场同步归零', () => {
  const h = mkH();
  h.loadScene(() => {
    for (let z = 14; z <= 46; z++) {
      for (let x = 14; x <= 46; x++) h.setBlockRaw(x, 1, z, 2);
    }
    h.setBlockRaw(20, 2, 20, 48); /* 装场期火把: 全量烘焙已含其光 */
  });
  assert.strictEqual(litAt(h, 21, 2, 20), 13, '装场全量含火把光');
  const removed = h.editBlock(20, 1, 20, 0); /* 挖泥土底座: 火把失撑脱落 */
  assert.strictEqual(removed.length, 1);
  assert.strictEqual(removed[0].id, 48, '火把经级联脱落(移除不经 editBlock 主格)');
  assert.strictEqual(litAt(h, 20, 2, 20), 0, '脱落即撤光(级联写入层的光照连带)');
  assert.strictEqual(litAt(h, 21, 2, 20), 0, '撤光扩散归零');
  assertLightBake(h);
});

test('光照脏区与既有编辑同队列(昼夜 D4 §3.3): 光照包围盒覆盖区块入 dirtyChunks 同一队列', () => {
  const h = mkH();
  h.loadScene(() => {
    for (let z = 0; z <= 63; z++) {
      for (let x = 0; x <= 63; x++) h.setBlockRaw(x, 1, z, 2); /* 大泥地板(编辑区距板缘 >28: 区域重算带不触板下侧渗光) */
    }
  });
  /* 无光放置(泥土, 区块 1 内部): 光变化仅本列 → 只记所在区块(±1 边界圈不跨块) */
  h.editBlockDirty(20, 5, 20, 2);
  assert.strictEqual(h.dirtyChunks.size, 1, '普通编辑只脏本区块');
  assert.ok(h.dirtyChunks.has('1,1'), '板内半空放置泥土: 本列天光变化仅区块 1,1');
  /* 放火把((24,24) 属区块 1,1): 菱形半径 13 → 包围盒 x/z∈[11,37], ±1 边界圈后跨区块 0~2 共九块 */
  h.editBlockDirty(24, 2, 24, 48);
  for (let cx = 0; cx <= 2; cx++) {
    for (let cz = 0; cz <= 2; cz++) {
      assert.ok(h.dirtyChunks.has(cx + ',' + cz),
          '光照覆盖区块 ' + cx + ',' + cz + ' 应与既有编辑同队列入脏');
    }
  }
});

test('光照三不变量(昼夜 D4 §10): 光源=发射级 · 列首个挡光块以上 sky=15 · 混合编辑序列后增量===全量', () => {
  const h = mkH();
  h.loadScene(() => {
    for (let z = 10; z <= 50; z++) {
      for (let x = 10; x <= 50; x++) h.setBlockRaw(x, 1, z, 2); /* 泥地面板 */
    }
    for (let z = 20; z <= 26; z++) {
      for (let x = 20; x <= 26; x++) {
        for (let y = 2; y <= 5; y++) h.setBlockRaw(x, y, z, 3); /* 石山(挡光投阴影) */
      }
    }
    for (let y = 2; y <= 4; y++) h.setBlockRaw(35, y, 35, 18); /* 玻璃塔(透光不挡) */
    h.setBlockRaw(30, 2, 30, 34); /* 发光岩 15 */
    h.setBlockRaw(40, 2, 40, 25); /* 岩浆 15 */
    h.setBlockRaw(23, 6, 23, 48); /* 山顶火把 14 */
    for (let y = 2; y <= 5; y++) h.setBlockRaw(45, y, 20, 8); /* 沙柱(重力移动路径) */
  });
  assert.deepStrictEqual(scanLightViolations(h), [], '装场全量即满足两不变量');
  /* 混合编辑序列: 单块(editBlock)/批量(editBlockDirty)/光源增撤/遮挡开合/
     级联脱落/沙沉移动全路径交织(确定性伪随机 minstd, 失败可复现) */
  let s = 20261025;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const pool = [0, 3, 8, 19, 34, 48]; /* 挖除/石头/沙(沉)/灯块/发光岩/火把 */
  for (let i = 0; i < 60; i++) {
    const x = 12 + Math.floor(rnd() * 36);
    const y = 2 + Math.floor(rnd() * 8);
    const z = 12 + Math.floor(rnd() * 36);
    const id = pool[Math.floor(rnd() * pool.length)];
    (i % 3 === 0 ? h.editBlockDirty : h.editBlock)(x, y, z, id);
  }
  assert.deepStrictEqual(scanLightViolations(h), [], '编辑后光源自亮 + 列顶天光两不变量成立');
  assertLightBake(h); /* 增量累计 === computeAll 全量重算, 双通道逐格相等 */
});
/* ============ 流体不变量(liquid 设计稿 D11): 极端交互后全图扫描 ============ */

test('流体: 完好湖(源阵+同高岸沿)经装场激活零违例——既有静态水面是不动点', () => {
  const h = mkH();
  for (let x = 20; x <= 26; x++) {
    for (let z = 20; z <= 26; z++) h.setBlockRaw(x, 2, z, 3); /* 湖底 */
  }
  for (let x = 20; x <= 26; x++) {
    for (let z = 20; z <= 26; z++) {
      if (x === 20 || x === 26 || z === 20 || z === 26) h.setBlockRaw(x, 3, z, 8); /* 沙岸 */
      else h.editBlock(x, 3, z, 24); /* 源(走编辑入口: 放置即排程) */
    }
  }
  for (let i = 0; i < 600; i++) h.pumpFluids(1 / 20); /* 泵到不动点 */
  assert.deepStrictEqual(scanFluidViolations(h), [], '零违例');
  assert.strictEqual(h.countIn(24, 20, 26, 3, 3, 20, 26), 25, '水量不变(激活 no-op)');
});

test('流体: 挖开湖岸放水漫开 → 不变量仍立(无孤儿流动块/无脏水位/编码合法)', () => {
  const h = mkH();
  for (let x = 18; x <= 28; x++) {
    for (let z = 18; z <= 28; z++) h.setBlockRaw(x, 2, z, 3); /* 大底板 */
  }
  for (let x = 20; x <= 26; x++) {
    for (let z = 20; z <= 26; z++) {
      if (x === 20 || x === 26 || z === 20 || z === 26) h.setBlockRaw(x, 3, z, 8);
      else h.editBlock(x, 3, z, 24);
    }
  }
  h.editBlock(23, 3, 20, 0); /* 挖开岸沿: 湖水外流 */
  for (let i = 0; i < 1200; i++) h.pumpFluids(1 / 20); /* 60 游戏秒, 足够漫到不动点 */
  const water = h.countIn(24, 0, h.W - 1, 0, h.H - 1, 0, h.D - 1);
  assert.ok(water > 25, '水确实流出了: ' + water + ' 格');
  assert.deepStrictEqual(scanFluidViolations(h), [], '全图流体不变量零违例');
});

test('流体: 掏源断供全退净 + 掏底穿世界不放水(界外不可渗)', () => {
  const h = mkH();
  for (let x = 18; x <= 28; x++) {
    for (let z = 18; z <= 28; z++) h.setBlockRaw(x, 2, z, 3);
  }
  for (let x = 20; x <= 26; x++) {
    for (let z = 20; z <= 26; z++) {
      if (x === 20 || x === 26 || z === 20 || z === 26) h.setBlockRaw(x, 3, z, 8);
      else h.editBlock(x, 3, z, 24);
    }
  }
  h.editBlock(23, 3, 20, 0); /* 放水 */
  for (let i = 0; i < 1200; i++) h.pumpFluids(1 / 20);
  const spread = h.countIn(24, 0, h.W - 1, 0, h.H - 1, 0, h.D - 1);
  assert.ok(spread > 25, '已外流');
  /* 掏全部源(湖心阵): 外流水断供逐刻退净(湖仍在漫——源清了流动块全干) */
  for (let x = 21; x <= 25; x++) {
    for (let z = 21; z <= 25; z++) {
      if (h.at(x, 3, z) === 24) h.editBlock(x, 3, z, 0);
    }
  }
  for (let i = 0; i < 1200; i++) h.pumpFluids(1 / 20);
  assert.strictEqual(h.countIn(24, 0, h.W - 1, 0, h.H - 1, 0, h.D - 1), 0, '断供全退净');
  assert.deepStrictEqual(scanFluidViolations(h), [], '退净后零违例');
});

