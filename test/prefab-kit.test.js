'use strict';
/* 蓝图件库单测(镜像 js/prefab-kit.js) — node --test(零依赖)
   运行: node --test test/prefab-kit.test.js
   P0 立库票(高脚木屋对收编, 行为零变更): vm 装载链 config→voxel→scene-kit→
   prefab-kit(scene-kit.test.js 同款手法, 词法 const 桥 globalThis; scene-kit
   仅 oracle 的 fill 需要——收编前两份函数体经 SceneKit.fill 建场)。
   断言六组: oracle 等价(收编前函数体逐字转写, 空场逐字节比对, 两个收编点
   各一组) · 形状第二意见(手推, 防转写双方同错) · 脚印包含(setBlockRaw 换
   记录 spy, 写出格 ⊆ footOf 同参盒 + footOf 零写) · 逐朝向(门洞/台阶/火把
   世界格=变换表手算值) · 确定性(同参两次逐字节一致) · 源文本守门(零
   config 方块常量/零 Math 随机/零 THREE); 另错误两档(拼写 throw/数值钳)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadKit() {/* vm 装载链: 引擎件按 index.html 序; api 经上下文表达式
    取词法绑定(scene-kit.test.js 同款); spySet 把 setBlockRaw 换记录器
    (voxel 顶函数声明=全局绑定, 后到脚本重绑即换, PrefabKit 调用期解析跟随) */
  const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
  }
  const api = vm.runInContext(
      '({PrefabKit, SceneKit, setBlockRaw, worldCells, WORLD_W, WORLD_D, WORLD_H})', eng);
  const W = api.WORLD_W; const D = api.WORLD_D;
  return {
    pf: api.PrefabKit, fill: api.SceneKit.fill, set: api.setBlockRaw,
    W, D, H: api.WORLD_H,
    cell: (x, y, z) => vm.runInContext('worldCells', eng)[(y * D + z) * W + x],
    snap: () => Buffer.from(vm.runInContext('worldCells', eng)),
    clear: () => vm.runInContext('worldCells.fill(0)', eng),
    spySet() {/* setBlockRaw 换记录 spy(voxel 顶函数声明=全局绑定, 后到脚本
        重绑即换, PrefabKit 调用期解析跟随); reset 每变体清账防上轮写入渗账 */
      vm.runInContext('globalThis.__pfRec = [];' +
          'setBlockRaw = function (x, y, z, id) { globalThis.__pfRec.push([x, y, z, id]); };', eng);
      return {
        reset: () => vm.runInContext('globalThis.__pfRec = [];', eng),
        rec: () => vm.runInContext('globalThis.__pfRec', eng),
      };
    },
  };
}

/* ---- oracle: 收编前函数体逐字转写(fcebe07 后工作区), 只作等价对照基准 ----
   h = {fill: SceneKit.fill, set: setBlockRaw, G: ADV_GROUND(24)}; 方块 id 用
   裸数字(5 原木/6 木板/51 宝箱/48 火把=收编前图常量现值); 西带 oracle 的
   advHeightAt 以 h.ground 注入(位置敏感桩: 喂错坐标系即错值, 逐字节比对红) */

function oracleSwampHut(h, ax, az) {/* 旧 adventure-maps-core.js advSwampHut */
  for (const cn of [[ax - 2, az - 1], [ax + 2, az - 1], [ax - 2, az + 1], [ax + 2, az + 1]]) {
    for (let y = h.G + 1; y <= h.G + 3; y++) h.set(cn[0], y, cn[1], 5); /* 柱脚 */
  }
  h.fill(ax - 2, h.G + 4, az - 1, ax + 2, h.G + 4, az + 2, 6); /* 地板 */
  for (const y of [h.G + 5, h.G + 6]) {/* 墙(留南门洞) */
    h.fill(ax - 2, y, az - 1, ax + 2, y, az - 1, 6);
    h.fill(ax - 2, y, az + 2, ax + 2, y, az + 2, 6);
    h.fill(ax - 2, y, az, ax - 2, y, az + 1, 6);
    h.fill(ax + 2, y, az, ax + 2, y, az + 1, 6);
  }
  h.fill(ax, h.G + 5, az + 2, ax, h.G + 6, az + 2, 0); /* 南门洞 2 高 */
  h.fill(ax - 2, h.G + 7, az - 1, ax + 2, h.G + 7, az + 2, 6); /* 顶 */
  h.set(ax, h.G + 4, az, 51);
  h.set(ax - 2, h.G + 5, az - 1, 48); /* 西墙火把 */
  for (let i = 0; i <= 2; i++) {/* 台阶: y25..y27 三级到地板平步(1 格级) */
    h.set(ax, h.G + 1 + i, az + 5 - i, 6);
  }
}

function oracleWestHut(h) {/* 旧 adventure-core.js advEdgeWestHut(绝对坐标版,
    锚即旧盒中心 (2, 24, 24)); 兰花两行是壳政策不在几何段, oracle 不含 */
  const x1 = 0; const x2 = 4; const z1 = 22; const z2 = 26;
  for (const [cx, cz] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) {
    const t = h.G + h.ground(cx, cz);
    for (let y = t + 1; y <= h.G + 3; y++) h.set(cx, y, cz, 5);
  }
  h.fill(x1, h.G + 4, z1, x2, h.G + 4, z2, 6); /* 地板 y28 */
  for (const y of [h.G + 5, h.G + 6]) {
    h.fill(x1, y, z1, x2, y, z1, 6);
    h.fill(x1, y, z2, x2, y, z2, 6);
    h.fill(x1, y, z1 + 1, x1, y, z2 - 1, 6);
    h.fill(x2, y, z1 + 1, x2, y, z2 - 1, 6);
  }
  h.fill(x1, h.G + 7, z1, x2, h.G + 7, z2, 6); /* 顶 y31 */
  h.fill(x1 + 1, h.G + 8, z1 + 1, x2 - 1, h.G + 8, z2 - 1, 6); /* 阶梯上层 */
  h.set(x1, h.G + 8, z1 + 1, 48); /* 暖窗光 */
}

/* 西带 v: 收编调用形逐字(票文拍板, 两处调用共用此常量防转写走样) */
const WEST_V = {
  size: {hx: 2, back: 2, front: 2},
  piles: 'terrain', ground: undefined,
  door: false, roof: 'stepped', chest: false, torch: 'rim', steps: 0,
};
/* 位置敏感地形桩: 世界坐标线性组合取模(值域 -2..+2)——内核若喂局部系坐标
   即得错值, 逐字节比对当场红(坐标契约探针) */
const groundStub = (x, z) => ((x * 7 + z * 3) % 5) - 2;

/* ============ ① oracle 等价(等价红线: 缺省路径逐字节) ============ */

test('oracle 等价·沼泽款: 缺省 v(=沼泽现值)空场建, worldCells 逐字节=旧 advSwampHut', () => {
  const k = loadKit();
  const h = {fill: k.fill, set: k.set, G: 24};
  /* 真锚(90,42)+两处搬位锚(证坐标无关); 搬位锚全落界内 */
  for (const [ax, az] of [[90, 42], [40, 60], [120, 100]]) {
    k.clear(); k.pf.place('stilt-hut', ax, 24, az);
    const a = k.snap();
    k.clear(); oracleSwampHut(h, ax, az);
    assert.ok(a.equals(k.snap()), '沼泽款缺省 v 终态逐字节一致: (' + ax + ',' + az + ')');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
  /* 缺省盒手算值: x ±2 / z -1..+2+台阶 3 / y 桩底 25..平顶 31(vm 对象先摊平
     进 Node 域, deepStrictEqual 的原型比对过不了跨域关) */
  assert.deepStrictEqual({...k.pf.footOf('stilt-hut', 90, 24, 42)},
      {x1: 88, y1: 25, z1: 41, x2: 92, y2: 31, z2: 47}, '缺省脚印盒=手算盒');
});

test('oracle 等价·西带款: 西带 v(绝对坐标 oracle)逐字节=旧 advEdgeWestHut', () => {
  const k = loadKit();
  /* 三种 ground: 位置敏感桩(主探针)/零偏移/另一线性组合——逐字节对照 */
  const grounds = [groundStub, () => 0, (x, z) => ((x + z) % 3) - 1];
  for (let gi = 0; gi < grounds.length; gi++) {
    const h = {fill: k.fill, set: k.set, G: 24, ground: grounds[gi]};
    k.clear();
    k.pf.place('stilt-hut', 2, 24, 24, Object.assign({}, WEST_V, {ground: grounds[gi]}));
    const a = k.snap();
    k.clear(); oracleWestHut(h);
    assert.ok(a.equals(k.snap()), '西带款终态逐字节一致(ground 桩 #' + gi + ')');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
  /* 西带盒手算值(ground=位置敏感桩): x 0..4 / z 22..26 / y 桩底 min(24+g+1)=24
     ..阶梯帽 32——桩列世界位 (0,22)(4,22)(0,26)(4,26), g 依次 -1/2/1/-1, min=-1 */
  assert.deepStrictEqual(
      {...k.pf.footOf('stilt-hut', 2, 24, 24, Object.assign({}, WEST_V, {ground: groundStub}))},
      {x1: 0, y1: 24, z1: 22, x2: 4, y2: 32, z2: 26}, '西带脚印盒=手算盒(地形桩收放)');
});

/* ============ ② 形状断言(独立第二意见, 手推防转写双方同错) ============ */

test('形状·沼泽款: 桩柱段/地板/墙环/南门洞/平顶/家具/台阶逐格', () => {
  const k = loadKit();
  const G = 24; const ax = 90; const az = 42;
  k.clear(); k.pf.place('stilt-hut', ax, G, az);
  /* 桩柱 ×4: y25..27 原木, 柱位 (±2,±1)——南端 z+2 无桩(地板前挑, 不对称在案) */
  for (const [dx, dz] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) {
    for (let dy = 1; dy <= 3; dy++) {
      assert.strictEqual(k.cell(ax + dx, G + dy, az + dz), 5, '桩柱段 ' + dx + ',' + dz);
    }
  }
  assert.strictEqual(k.cell(ax - 2, G + 1, az + 2), 0, '南端 z+2 无桩');
  /* 地板 y28 全板, 中轴格被宝箱覆写(写序: 地板→家具) */
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -1; dz <= 2; dz++) {
      const want = dx === 0 && dz === 0 ? 51 : 6;
      assert.strictEqual(k.cell(ax + dx, G + 4, az + dz), want, '地板层 ' + dx + ',' + dz);
    }
  }
  /* 墙环 y29..30: 四壁板/内域空/南门洞 1×2 空气/西墙北端火把(y29) */
  for (const dy of [5, 6]) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -1; dz <= 2; dz++) {
        const onRing = dz === -1 || dz === 2 || (Math.abs(dx) === 2 && dz >= 0 && dz <= 1);
        if (!onRing) {
          assert.strictEqual(k.cell(ax + dx, G + dy, az + dz), 0, '屋内空');
          continue;
        }
        let want = 6;
        if (dx === 0 && dz === 2) want = 0; /* 南门洞 */
        if (dx === -2 && dz === -1 && dy === 5) want = 48; /* 西墙火把 */
        assert.strictEqual(k.cell(ax + dx, G + dy, az + dz), want,
            '墙环 y' + (G + dy) + ' ' + dx + ',' + dz);
      }
    }
  }
  /* 平顶 y31 全盒, y32 无帽(平顶款) */
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -1; dz <= 2; dz++) {
      assert.strictEqual(k.cell(ax + dx, G + 7, az + dz), 6, '平顶层');
      assert.strictEqual(k.cell(ax + dx, G + 8, az + dz), 0, '平顶上无帽');
    }
  }
  /* 台阶三级: (0, G+1+i, +5-i) 木板, 台阶上方无悬空物 */
  for (let i = 0; i <= 2; i++) {
    assert.strictEqual(k.cell(ax, G + 1 + i, az + 5 - i), 6, '台阶第 ' + (i + 1) + ' 级');
    assert.strictEqual(k.cell(ax, G + 2 + i, az + 5 - i), 0, '台阶上方空');
  }
});

test('形状·西带款: 地形桩逐柱/无门洞/阶梯帽/顶沿火把/无宝箱无台阶', () => {
  const k = loadKit();
  const G = 24; const ax = 2; const az = 24;
  k.clear();
  k.pf.place('stilt-hut', ax, G, az, Object.assign({}, WEST_V, {ground: groundStub}));
  /* 地形桩逐柱: 各柱从 24+g(柱世界位)+1 到 27, 深柱下探浅柱被吞(超埋段现行为) */
  for (const [cx, cz] of [[0, 22], [4, 22], [0, 26], [4, 26]]) {
    const start = G + groundStub(cx, cz) + 1;
    for (let y = start; y <= G + 3; y++) {
      assert.strictEqual(k.cell(cx, y, cz), 5, '地形桩柱 (' + cx + ',' + cz + ') y' + y);
    }
    assert.strictEqual(k.cell(cx, start - 1, cz), 0, '桩底下一格不写');
  }
  /* 地板/墙环: 无门洞(南墙中轴是板)/无宝箱(中轴地板是板) */
  assert.strictEqual(k.cell(2, G + 4, 24), 6, '地板中轴格无宝箱');
  assert.strictEqual(k.cell(2, G + 5, 26), 6, '南墙中轴无门洞');
  assert.strictEqual(k.cell(2, G + 6, 26), 6, '南墙中轴二层无门洞');
  /* 顶 y31 全盒 + 阶梯帽 y32 内缩一层(1..3 × 23..25); 帽外除顶沿火把(0,32,23)无物 */
  for (let dx = 0; dx <= 4; dx++) {
    for (let dz = 22; dz <= 26; dz++) {
      assert.strictEqual(k.cell(dx, G + 7, dz), 6, '顶全盒');
      const inCap = dx >= 1 && dx <= 3 && dz >= 23 && dz <= 25;
      const want = inCap ? 6 : (dx === 0 && dz === 23 ? 48 : 0);
      assert.strictEqual(k.cell(dx, G + 8, dz), want, '阶梯帽内缩一层');
    }
  }
  /* 顶沿火把 (0, 32, 23)=阶梯帽角; 无台阶(门前空) */
  assert.strictEqual(k.cell(0, G + 8, 23), 48, '顶沿火把(帽角)');
  for (let i = 0; i <= 2; i++) {
    assert.strictEqual(k.cell(2, G + 1 + i, 26 + 3 - i), 0, '无台阶');
  }
});

/* ============ ③ 脚印包含(spy): 写出格 ⊆ footOf 同参盒; footOf 零写 ============ */

test('脚印包含: stilt-hut × 4 朝向 × mirror × 抽样 v 变体 — 每笔写 ∈ footOf 盒', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['缺省(沼泽款)', undefined],
    ['西带款', Object.assign({}, WEST_V, {ground: groundStub})],
    ['去门去台阶', {door: false, steps: 0}],
    ['换材质(部分注入)', {ids: {log: 3, plank: 1}}],
    ['阶梯顶+顶沿火把', {roof: 'stepped', torch: 'rim'}],
    ['无火把无宝箱', {torch: 'none', chest: false}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('stilt-hut', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' +
              JSON.stringify(box) + '(写出格必须落在脚印盒内)');
        }
        /* footOf: 同参同盒 + 零写(纯查询) */
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('stilt-hut', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
      }
    }
  }
});

/* ============ ④ 越界守卫(树家族先例: 界外格静默不写, 平面数组不回卷) ============ */

test('越界守卫: 跨缘落位静默裁件不炸, 对侧缘零污染(旧 setBlockRaw 回卷位)', () => {
  const k = loadKit();
  /* 贴东缘: x+2 出界——无守卫时平面下标回卷污染 x=0 列(北带 z=1 事故同款) */
  k.clear(); k.pf.place('stilt-hut', k.W - 1, 24, 80);
  for (let y = 0; y < k.H; y++) {
    for (let z = 0; z < k.D; z++) {
      assert.strictEqual(k.cell(0, y, z), 0, '贴东缘落位: x=0 列零写入(回卷事故位)');
    }
  }
  /* 贴北缘(z-2 出界)/贴南缘(steps z+5 出界): 不炸且界内件还在(地板探针取
     各自界内格: 北缘 z∈0..3 取 z2; 南缘 z∈157..160 取 z159, 避开中轴宝箱列) */
  for (const [ax, az, probe] of [[80, 1, [81, 28, 2]], [80, k.D - 2, [81, 28, k.D - 1]]]) {
    k.clear();
    const box = k.pf.place('stilt-hut', ax, 24, az);
    assert.strictEqual(k.cell(probe[0], probe[1], probe[2]), 6,
        '贴缘落位界内地板仍在 (' + ax + ',' + az + ')');
    assert.ok(box.x1 <= box.x2 && box.z1 <= box.z2, '盒坐标序合法');
  }
  /* y 界: 顶溢出世界高也静默(H=48, 屋顶 y31 在界内——用高锚位 y40 顶 y48 界上) */
  k.clear(); k.pf.place('stilt-hut', 80, 40, 80);
  assert.strictEqual(k.cell(80, 47, 82), 6, '高锚位: 界内格(y47 南墙)正常写');
});

/* ============ ⑤ 逐朝向: 世界格=变换表手算值(k=0 恒等归 oracle 组) ============ */

test('逐朝向: 门洞/台阶/火把/宝箱/桩柱世界格=变换表手算值(锚 80,24,80)', () => {
  const k = loadKit();
  /* 手算表: k1(west)=(dx,dz)→(-dz,dx) · k2(north)=(-dx,-dz) · k3(east)=(dz,-dx);
     门洞 local (0,·,+2) / 火把 (-2,29,-1) / 台阶 i → (0,25+i,5-i) / 宝箱 (0,28,0) */
  const FACE = {
    west: {door: [[78, 80]], torch: [81, 78], steps: [[75, 80], [76, 80], [77, 80]]},
    north: {door: [[80, 78]], torch: [82, 81], steps: [[80, 75], [80, 76], [80, 77]]},
    east: {door: [[82, 80]], torch: [79, 82], steps: [[85, 80], [84, 80], [83, 80]]},
  };
  for (const [face, exp] of Object.entries(FACE)) {
    k.clear(); k.pf.place('stilt-hut', 80, 24, 80, {face});
    for (const dy of [29, 30]) {
      assert.strictEqual(k.cell(exp.door[0][0], dy, exp.door[0][1]), 0,
          face + ' 门洞 1×2 空气 y' + dy);
    }
    assert.strictEqual(k.cell(exp.torch[0], 29, exp.torch[1]), 48, face + ' 火把');
    for (let i = 0; i < 3; i++) {
      assert.strictEqual(k.cell(exp.steps[i][0], 25 + i, exp.steps[i][1]), 6,
          face + ' 台阶第 ' + (i + 1) + ' 级(下行向 ' + face + ')');
    }
    assert.strictEqual(k.cell(80, 28, 80), 51, face + ' 宝箱=锚列(旋转变换不动原点)');
  }
  /* mirror 手算: 先翻 dx 后旋转——南向火把 (82,29,79); 东向火把 (79,29,78);
     门洞在 x=0 中轴, mirror 不动门位(轴上格不变式) */
  k.clear(); k.pf.place('stilt-hut', 80, 24, 80, {face: 'south', mirror: true});
  assert.strictEqual(k.cell(82, 29, 79), 48, 'south+mirror 火把(西墙→东墙)');
  assert.strictEqual(k.cell(80, 29, 82), 0, 'south+mirror 门洞仍在 z+2 中轴');
  k.clear(); k.pf.place('stilt-hut', 80, 24, 80, {face: 'east', mirror: true});
  assert.strictEqual(k.cell(79, 29, 78), 48, 'east+mirror 火把');
  assert.strictEqual(k.cell(82, 29, 80), 0, 'east+mirror 门洞仍在 x+2 中轴');
  /* west 向桩柱四柱(几何第二意见): (±2,±1) 过 k1 → x=79/81, z=78/82 */
  k.clear(); k.pf.place('stilt-hut', 80, 24, 80, {face: 'west'});
  for (const [px, pz] of [[81, 78], [81, 82], [79, 78], [79, 82]]) {
    for (let dy = 25; dy <= 27; dy++) assert.strictEqual(k.cell(px, dy, pz), 5, 'west 桩柱');
  }
});

/* ============ ⑥ 确定性 + 错误两档 + 源文本守门 ============ */

test('确定性: 同参两次独立建场, 全图逐字节一致(4 朝向×两款式)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('stilt-hut', 90, 24, 42),
    () => k.pf.place('stilt-hut', 2, 24, 24, Object.assign({}, WEST_V, {ground: groundStub})),
    () => k.pf.place('stilt-hut', 60, 24, 100, {face: 'east', mirror: true}),
    () => k.pf.place('stilt-hut', 60, 24, 100, {face: 'north'}),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档: 未知 id/未知 v 键/face 非法/terrain 缺 ground→throw; 数值域→钳', () => {
  const k = loadKit();
  /* 第一档(装场期炸=拼写防火墙): place 与 footOf 同走合并校验路径 */
  assert.throws(() => k.pf.place('under-room', 80, 24, 80), /未知蓝图/, '未知 id(P1 未立)');
  assert.throws(() => k.pf.footOf('mound', 80, 24, 80), /未知蓝图/, 'footOf 未知 id');
  assert.throws(() => k.pf.place('stilt-hut', 80, 24, 80, {facee: 'north'}), /v 键/, '未知 v 键(拼写)');
  assert.throws(() => k.pf.place('stilt-hut', 80, 24, 80, {face: 'up'}), /face/, 'face 非法');
  assert.throws(() => k.pf.place('stilt-hut', 80, 24, 80, {piles: 'terrain'}), /ground/,
      'terrain 缺 ground');
  assert.throws(() => k.pf.place('stilt-hut', 80, 24, 80, {roof: 'dome'}), /roof/, 'roof 枚举');
  assert.throws(() => k.pf.place('stilt-hut', 80, 24, 80, {ids: {plonk: 6}}), /ids/, 'ids 子键');
  /* 第二档(几何数值域→钳): steps 负=0(无台阶), size 负=0 不炸 */
  k.clear();
  const b1 = k.pf.place('stilt-hut', 80, 24, 80, {steps: -3});
  const s1 = k.snap();
  k.clear();
  const b2 = k.pf.place('stilt-hut', 80, 24, 80, {steps: 0});
  assert.ok(s1.equals(k.snap()), 'steps 负值钳 0=无台阶同形');
  assert.deepStrictEqual(b1, b2, '钳后脚印盒一致');
  k.clear();
  k.pf.place('stilt-hut', 80, 24, 80, {size: {hx: -1, back: -2, front: -1}});
  assert.strictEqual(k.cell(80, 28, 80), 51, 'size 负值钳 0 不炸仍建(中轴宝箱在)');
});

test('源文本守门: prefab-kit.js 零 config 方块常量 · 零 Math 随机 · 零 THREE(引擎层红线)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'prefab-kit.js'), 'utf8');
  assert.ok(!/B_[A-Z]/.test(src), '引擎层零玩法知识: 不读任何 config 方块常量');
  assert.ok(!src.includes('Math.random'), '本件无散布无随机源(零 Math 随机)');
  assert.ok(!src.includes('THREE'), '零 THREE(纯核心可单测)');
});
