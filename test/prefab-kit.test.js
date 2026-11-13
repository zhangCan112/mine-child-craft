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
   config 方块常量/零 Math 随机/零 THREE); 另错误两档(拼写 throw/数值钳)。
   P1 收编票(under-room/mound 两行, 行为零变更): 同款手法追加五组——四份
   oracle(神殿室段/雪屋室段/advMapNest 三图参数/advBuildNest, 必要前置
   地层先铺后比对) · 两行形状第二意见 · 两行脚印包含(×4 朝向×mirror×
   变体) · 确定性+异盐散布不同 · P1 行错误两档(必传缺/torches 枚举/
   exit 子键/floorDy 负域钳); P0 断言中「P1 未立」的未知 id 钉改用
   watchtower(机械翻转, 非迁就实现)。 */
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
      '({PrefabKit, SceneKit, setBlockRaw, getBlock, worldCells, WORLD_W, WORLD_D, WORLD_H})', eng);
  const W = api.WORLD_W; const D = api.WORLD_D;
  return {
    pf: api.PrefabKit, fill: api.SceneKit.fill, set: api.setBlockRaw,
    rand: api.SceneKit.rand, get: api.getBlock,
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
  assert.throws(() => k.pf.place('watchtower', 80, 24, 80), /未知蓝图/,
      '未知 id(P1 已立 under-room/mound, 改用仍未立 id)');
  assert.throws(() => k.pf.footOf('watchtower', 80, 24, 80), /未知蓝图/, 'footOf 未知 id');
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

/* ============ P1·under-room/mound 两行(34ec79d 同款手法) ============ */

/* 神殿款 v: 收编调用形逐字(advDesertTemple 室段拍板——材质=砂岩裸数字) */
const TEMPLE_V = {
  half: 3, cavH: 4, floorDy: -7, shaft: 2, trap: true, torches: 'pair',
  exit: {steps: 7, width: 3, capSwap: true, landing: true},
  mat: 58,
};

/* ---- P1 oracle: 收编前函数体逐字转写(34ec79d 后工作区), 只作对照基准 ----
   h = {fill, set, get, rand, G: ADV_GROUND(24)}; 方块 id 裸数字(58 砂岩/
   54 雪块/55 雪覆草/51 宝箱/48 火把/8 沙/3 石/2 泥=收编前图常量现值);
   旧体循环变量 h 与 harness 形参撞名处机械改名 hh(语义零变) */

function preSand(k, ax, az) {/* 沙漠平坦地层(神殿压平带口径): 石 0..20/砂岩 21..23/沙 24
    ——capSwap(读沙 8)与垫脚(读空气)的分支路径要吃到真地层才不是空转 */
  k.fill(ax - 4, 0, az - 3, ax + 12, 20, az + 3, 3);
  k.fill(ax - 4, 21, az - 3, ax + 12, 23, az + 3, 58);
  k.fill(ax - 4, 24, az - 3, ax + 12, 24, az + 3, 8);
}

function preSnow(k, ax, az) {/* 雪原平坦地层(雪屋压平带口径): 石 0..19/泥 20..23/雪覆草 24 */
  k.fill(ax - 3, 0, az - 3, ax + 10, 19, az + 3, 3);
  k.fill(ax - 3, 20, az - 3, ax + 10, 23, az + 3, 2);
  k.fill(ax - 3, 24, az - 3, ax + 10, 24, az + 3, 55);
}

function oracleTempleRoom(h, cx, cz) {/* 旧 adventure-maps-core.js advDesertTemple 室段 */
  h.fill(cx - 3, 17, cz - 3, cx + 3, 17, cz + 3, 58); /* 室地板 */
  h.fill(cx - 3, 18, cz - 3, cx + 3, 21, cz + 3, 0); /* 室腔 */
  h.fill(cx - 3, 22, cz - 3, cx + 3, 23, cz + 3, 58); /* 室顶+地基 */
  h.fill(cx - 1, 22, cz - 1, cx, 23, cz, 0); /* 竖井 2×2 西北象限 */
  h.fill(cx - 1, 24, cz - 1, cx, 24, cz, 58); /* 可疑地板(trapY=24) */
  h.set(cx, 20, cz, 51);
  h.set(cx - 2, 18, cz - 2, 48);
  h.set(cx + 2, 18, cz + 2, 48);
  for (let i = 0; i <= 6; i++) {
    const x = cx + 4 + i; const y = 19 + i;
    h.fill(x, y, cz - 1, x, y + 2, cz + 1, 0); /* 净空 */
    for (let z = cz - 1; z <= cz + 1; z++) {
      for (let yy = y + 3; yy <= h.G; yy++) {
        if (h.get(x, yy, z) === 8) h.set(x, yy, z, 58); /* 沙顶盖砂岩 */
      }
    }
    if (h.get(x, y - 1, cz) === 0) h.set(x, y - 1, cz, 58); /* 垫脚 */
  }
  h.fill(cx + 10, h.G, cz - 1, cx + 11, h.G, cz + 1, 8); /* 出口沙平台 */
}

function oracleSnowRoom(h, cx, cz) {/* 旧 advSnowHut 地下宝箱室段 */
  h.fill(cx - 2, 18, cz - 2, cx + 2, 18, cz + 2, 54); /* 室地板 */
  h.fill(cx - 2, 19, cz - 2, cx + 2, 21, cz + 2, 0); /* 室腔 */
  h.fill(cx - 2, 22, cz - 2, cx + 2, 23, cz + 2, 54); /* 室顶 */
  h.set(cx, 20, cz, 51);
  h.set(cx - 1, 19, cz - 1, 48);
  for (let i = 0; i <= 5; i++) {/* 东侧 1 宽出路台阶 */
    const x = cx + 3 + i; const y = 19 + i;
    for (let yy = y; yy <= y + 2; yy++) h.set(x, yy, cz, 0);
    if (h.get(x, y - 1, cz) === 0) h.set(x, y - 1, cz, 54); /* 垫脚(雪) */
  }
}

function oracleMapNest(h, n, top, rock) {/* 旧 advMapNest(盐 5102, 三图口径) */
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 2) continue;
      const hh = d < 0.8 ? 3 : (d < 1.8 ? 2 : 1);
      for (let y = h.G + 1; y <= h.G + hh; y++) {
        const id = (d >= 0.8 && h.rand(n.x + dx, n.z + dz, 5102) > 0.72) ? rock : top;
        h.set(n.x + dx, y, n.z + dz, id);
      }
    }
  }
  for (const y of [h.G + 1, h.G + 2]) h.set(n.x, y, n.z + 2, 0); /* 洞口朝南 */
}

function oracleBuildNest(h, n) {/* 旧 advBuildNest(home 巢, 盐 5101) */
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 2) continue;
      const hh = d < 0.8 ? 3 : (d < 1.8 ? 2 : 1);
      for (let y = 25; y <= h.G + hh; y++) {
        const id = (d >= 0.8 && h.rand(n.x + dx, n.z + dz, 5101) > 0.72) ? 14 : 2;
        h.set(n.x + dx, y, n.z + dz, id);
      }
    }
  }
  for (const y of [25, 26]) h.set(n.x, y, n.z + 2, 0); /* 洞口朝南 */
}

/* ============ P1① oracle 等价(等价红线: 缺省/收编调用路径逐字节) ============ */

test('oracle 等价·神殿室段: 预铺沙层后神殿款逐字节=旧 advDesertTemple 室段(三锚)', () => {
  const k = loadKit();
  const h = {fill: k.fill, set: k.set, get: k.get, rand: k.rand, G: 24};
  /* 真锚(64,40)+两处搬位锚(证坐标无关); 前置地层=神殿压平带口径 */
  for (const [ax, az] of [[64, 40], [40, 60], [100, 80]]) {
    k.clear(); preSand(k, ax, az);
    k.pf.place('under-room', ax, 24, az, TEMPLE_V);
    const a = k.snap();
    k.clear(); preSand(k, ax, az); oracleTempleRoom(h, ax, az);
    assert.ok(a.equals(k.snap()), '神殿室段终态逐字节一致: (' + ax + ',' + az + ')');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
  /* 盒手算值: 室 x±3 / 出路末级 x+10 / 平台 x+11 / y 地板 17..末级净空上沿 27 */
  assert.deepStrictEqual({...k.pf.footOf('under-room', 64, 24, 40, TEMPLE_V)},
      {x1: 61, y1: 17, z1: 37, x2: 75, y2: 27, z2: 43}, '神殿款脚印盒=手算盒');
});

test('oracle 等价·雪屋室段: 预铺雪原层后缺省款(只注 mat)逐字节=旧 advSnowHut 室段(三锚)', () => {
  const k = loadKit();
  const h = {fill: k.fill, set: k.set, get: k.get, rand: k.rand, G: 24};
  for (const [ax, az] of [[40, 40], [60, 60], [100, 80]]) {
    k.clear(); preSnow(k, ax, az);
    k.pf.place('under-room', ax, 24, az, {mat: 54});
    const a = k.snap();
    k.clear(); preSnow(k, ax, az); oracleSnowRoom(h, ax, az);
    assert.ok(a.equals(k.snap()), '雪屋室段终态逐字节一致: (' + ax + ',' + az + ')');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
  /* 盒手算值: 室 x±2 / 出路末级 x+8 / y 地板 18..末级净空上沿 26(无平台无盖) */
  assert.deepStrictEqual({...k.pf.footOf('under-room', 40, 24, 40, {mat: 54})},
      {x1: 38, y1: 18, z1: 38, x2: 48, y2: 26, z2: 42}, '雪屋款脚印盒=手算盒');
});

test('oracle 等价·巢穴丘: 三图参数与 home 参数(盐 5101)逐字节=旧 advMapNest/advBuildNest', () => {
  const k = loadKit();
  const h = {fill: k.fill, set: k.set, get: k.get, rand: k.rand, G: 24};
  const cases = [ /* 真巢锚+真参数(desert 8/58 · snow 54/3 · swamp 2/14 · home 2/14) */
    [[24, 28], {top: 8, rock: 58}, (hh, n) => oracleMapNest(hh, n, 8, 58)],
    [[28, 60], {top: 54, rock: 3}, (hh, n) => oracleMapNest(hh, n, 54, 3)],
    [[22, 58], {top: 2, rock: 14}, (hh, n) => oracleMapNest(hh, n, 2, 14)],
    [[60, 60], {top: 2, rock: 14, salt: 5101}, (hh, n) => oracleBuildNest(hh, n)],
  ];
  for (const [[nx, nz], v, oracle] of cases) {
    k.clear();
    k.pf.place('mound', nx, 24, nz, v);
    const a = k.snap();
    k.clear(); oracle(h, {x: nx, z: nz});
    assert.ok(a.equals(k.snap()), '巢穴丘终态逐字节一致: (' + nx + ',' + nz + ') ' + JSON.stringify(v));
    assert.ok(a.some((b) => b !== 0), '场内确有方块(防全空假绿)');
  }
  assert.deepStrictEqual({...k.pf.footOf('mound', 24, 24, 28, {top: 8, rock: 58})},
      {x1: 22, y1: 25, z1: 26, x2: 26, y2: 27, z2: 30}, 'mound 脚印盒=手算盒');
});

/* ============ P1② 形状第二意见(手推, 防转写双方同错) ============ */

test('形状·under-room 神殿款: 三明治层界/竖井西北偏置/可疑地板 2×2/出路逐级/沙盖/平台', () => {
  const k = loadKit();
  const ax = 64; const az = 40;
  k.clear(); preSand(k, ax, az);
  k.pf.place('under-room', ax, 24, az, TEMPLE_V);
  /* 三明治 7×7: 地板 y17 砂岩/腔 y18~21 空/顶 y22~23 两层砂岩——腔内宝箱
     (y20)与双火把(y18)是后写者赢的覆写格, want 制逐格核 */
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      assert.strictEqual(k.cell(ax + dx, 17, az + dz), 58, '室地板 y17');
      for (let y = 18; y <= 21; y++) {
        let want = 0;
        if (dx === 0 && dz === 0 && y === 20) want = 51; /* 宝箱 */
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dx === dz && y === 18) want = 48;
        assert.strictEqual(k.cell(ax + dx, y, az + dz), want, '室腔 y' + y);
      }
      for (let y = 22; y <= 23; y++) {
        const shaft = dx >= -1 && dx <= 0 && dz >= -1 && dz <= 0;
        assert.strictEqual(k.cell(ax + dx, y, az + dz), shaft ? 0 : 58,
            '室顶 y' + y + '(竖井 2×2 西北象限掏穿)');
      }
    }
  }
  /* 竖井: 顶两层西北象限 2×2 掏穿(63..64)×(39..40); 竖井外室顶完好 */
  for (const x of [63, 64]) {
    for (const z of [39, 40]) {
      for (const y of [22, 23]) assert.strictEqual(k.cell(x, y, z), 0, '竖井掏穿');
      assert.strictEqual(k.cell(x, 24, z), 58, '可疑地板(竖井正上)');
    }
  }
  assert.strictEqual(k.cell(65, 22, 41), 58, '竖井外室顶完好');
  assert.strictEqual(k.cell(62, 24, 40), 8, '可疑地板外原沙未动(2×2 精确)');
  /* 宝箱+对角双火把(±2, y18 落地站膛站 y17 地板) */
  assert.strictEqual(k.cell(64, 20, 40), 51, '宝箱(室心中轴 y20)');
  assert.strictEqual(k.cell(62, 18, 38), 48, '西北火把');
  assert.strictEqual(k.cell(66, 18, 42), 48, '东南火把');
  assert.strictEqual(k.cell(62, 17, 38), 58, '火把站膛=室地板');
  /* 出路逐级: 净空 3 高 3 宽; 石层实底不垫脚(空气才垫); 沙盖只换沙 */
  assert.strictEqual(k.cell(68, 18, 40), 3, 'i0 垫脚位=石层(非 0 不垫)');
  for (let i = 0; i <= 6; i++) {
    const x = ax + 4 + i; const y = 19 + i;
    for (let yy = y; yy <= y + 2; yy++) {
      assert.strictEqual(k.cell(x, yy, az), 0, '出路净空 i' + i + ' y' + yy);
    }
    assert.strictEqual(k.cell(x, y + 3, az - 1), i <= 2 ? 58 : 0,
        '净空上沿再上一层(盖/空气) i' + i);
  }
  /* 地表 y24 剖面(沿走廊中轴): 室外原沙→沙盖置换→净空掏空→出口平台 */
  assert.strictEqual(k.cell(67, 24, 40), 8, '室外原沙未动');
  for (const x of [68, 69, 70]) assert.strictEqual(k.cell(x, 24, 40), 58, '沙柱盖砂岩');
  for (const x of [71, 72, 73]) assert.strictEqual(k.cell(x, 24, 40), 0, '净空掏到地表');
  assert.strictEqual(k.cell(74, 24, 40), 8, '出口平台(末级位)');
  assert.strictEqual(k.cell(75, 24, 39), 8, '出口平台(末级+1, 3 宽)');
  assert.strictEqual(k.cell(76, 24, 40), 8, '平台外原沙(未越界)');
});

test('形状·under-room 雪屋款: 5×5 三明治/单火把/出路 1 宽无盖无平台', () => {
  const k = loadKit();
  const ax = 40; const az = 40;
  k.clear(); preSnow(k, ax, az);
  k.pf.place('under-room', ax, 24, az, {mat: 54});
  /* 三明治 5×5: 地板 y18 雪/腔 y19~21 空/顶 y22~23 两层雪——腔内宝箱(y20)
     与单火把(y19)是后写者赢的覆写格, want 制逐格核 */
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      assert.strictEqual(k.cell(ax + dx, 18, az + dz), 54, '室地板 y18');
      for (let y = 19; y <= 21; y++) {
        let want = 0;
        if (dx === 0 && dz === 0 && y === 20) want = 51; /* 宝箱 */
        if (dx === -1 && dz === -1 && y === 19) want = 48; /* 火把 */
        assert.strictEqual(k.cell(ax + dx, y, az + dz), want, '室腔 y' + y);
      }
      for (let y = 22; y <= 23; y++) {
        assert.strictEqual(k.cell(ax + dx, y, az + dz), 54, '室顶 y' + y);
      }
    }
  }
  /* 无竖井无可疑地板: 室顶上无 2×2 特殊层(原地层原样) */
  assert.strictEqual(k.cell(ax, 24, az), 55, '雪屋无 trap: 室心地表=原雪覆草');
  assert.strictEqual(k.cell(ax - 1, 22, az - 1), 54, '雪屋无 shaft: 室顶完好');
  /* 宝箱+单火把(西北内角, y19 站 y18 地板) */
  assert.strictEqual(k.cell(40, 20, 40), 51, '宝箱');
  assert.strictEqual(k.cell(39, 19, 39), 48, '单火把');
  assert.strictEqual(k.cell(39, 18, 39), 54, '火把站膛=室地板');
  /* 出路: 1 宽净空 3; 垫脚石层实底不垫; 无沙盖; 无平台 */
  assert.strictEqual(k.cell(43, 18, 40), 3, 'i0 垫脚位=石层(非 0 不垫)');
  assert.strictEqual(k.cell(43, 19, 39), 3, '走廊 1 宽(z±1 未掏)');
  assert.strictEqual(k.cell(43, 24, 40), 55, '无 capSwap: 地表原样');
  for (let i = 0; i <= 5; i++) {
    const x = ax + 3 + i; const y = 19 + i;
    for (let yy = y; yy <= y + 2; yy++) {
      assert.strictEqual(k.cell(x, yy, az), 0, '出路净空 i' + i + ' y' + yy);
    }
  }
  assert.strictEqual(k.cell(49, 24, 40), 55, '无出口平台(原雪覆草未被覆写)');
});

test('形状·mound: 三层丘体/掷点喂世界坐标/朝南洞口精确格', () => {
  const k = loadKit();
  const nx = 60; const nz = 60;
  k.clear();
  k.pf.place('mound', nx, 24, nz, {top: 2, rock: 14});
  /* 锚层不写; 中心柱 3 高全 top(d=0 <0.8 不掷点) */
  assert.strictEqual(k.cell(nx, 24, nz), 0, '锚层不写');
  for (let y = 25; y <= 27; y++) assert.strictEqual(k.cell(nx, y, nz), 2, '中心柱 top');
  assert.strictEqual(k.cell(nx, 28, nz), 0, '丘顶上无物');
  /* 中环(d<1.8) 2 高 · 缘环(d∈[1.8,2]) 1 高——掷点>0.72 换 rock,
     且散列喂世界坐标(喂局部系即错值: 坐标契约探针) */
  const mid = k.rand(nx + 1, nz, 5102) > 0.72 ? 14 : 2;
  for (let y = 25; y <= 26; y++) assert.strictEqual(k.cell(nx + 1, y, nz), mid, '中环掷点');
  const rim = k.rand(nx + 2, nz, 5102) > 0.72 ? 14 : 2;
  assert.strictEqual(k.cell(nx + 2, 25, nz), rim, '缘环掷点');
  assert.strictEqual(k.cell(nx + 2, 26, nz), 0, '缘环 1 高');
  /* 洞口朝南 2 高(r2 缘格先写后被掏); 丘外零写入 */
  assert.strictEqual(k.cell(nx, 25, nz + 2), 0, '洞口下格');
  assert.strictEqual(k.cell(nx, 26, nz + 2), 0, '洞口上格');
  assert.strictEqual(k.cell(nx, 27, nz + 2), 0, '洞口顶上无物');
  assert.strictEqual(k.cell(nx, 25, nz + 3), 0, '丘外 z+3');
  assert.strictEqual(k.cell(nx + 2, 25, nz + 2), 0, '丘外角(d 2.83>2)');
});

/* ============ P1③ 脚印包含(spy): 写出格 ⊆ footOf; footOf 零写 ============ */

test('脚印包含: under-room × 4 朝向 × mirror × 抽样 v 变体 — 每笔写 ∈ footOf 盒', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['雪屋款', {mat: 54}],
    ['神殿款', TEMPLE_V],
    ['神殿款换材质', Object.assign({}, TEMPLE_V, {mat: 6, ids: {chest: 71, torch: 47, cap: 9, land: 9}})],
    ['缩室+单格竖井+可疑地板', {mat: 54, half: 1, cavH: 2, floorDy: -4, shaft: 1, trap: true,
      exit: {steps: 3, width: 2}}],
    ['无出口', {mat: 54, exit: {steps: 0}}],
    ['宽出口平台无盖', {mat: 54, half: 3, cavH: 4, floorDy: -7,
      exit: {steps: 7, width: 3, landing: true}}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('under-room', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' +
              JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('under-room', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
      }
    }
  }
});

test('脚印包含: mound × 4 朝向 × mirror × 抽样 v 变体 — 每笔写 ∈ footOf 盒', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['desert 款', {top: 8, rock: 58}],
    ['swamp 款', {top: 2, rock: 14}],
    ['home 款(盐 5101)', {top: 2, rock: 14, salt: 5101}],
    ['snow 款', {top: 54, rock: 3}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('mound', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' +
              JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('mound', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
      }
    }
  }
});

/* ============ P1④ 确定性 + 错误两档(P1 行) ============ */

test('确定性: under-room/mound 同参两次逐字节一致; mound 异盐散布不同', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('under-room', 64, 24, 40, TEMPLE_V),
    () => k.pf.place('under-room', 60, 24, 60, {mat: 54}),
    () => k.pf.place('mound', 60, 24, 60, {top: 2, rock: 14}),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
  /* 异盐=异纹理: 同锚同材质只换盐, 散布 pattern 必不同(掷点喂世界坐标) */
  k.clear(); k.pf.place('mound', 60, 24, 60, {top: 2, rock: 14, salt: 5101});
  const a = k.snap();
  k.clear(); k.pf.place('mound', 60, 24, 60, {top: 2, rock: 14, salt: 5102});
  assert.ok(!a.equals(k.snap()), 'mound 异盐散布不同');
});

test('错误两档·P1 行: mat/top/rock 必传缺→throw; torches/exit 子键→throw; floorDy 负域钳', () => {
  const k = loadKit();
  assert.throws(() => k.pf.place('under-room', 80, 24, 80), /mat 必传/, 'under-room 缺 mat');
  assert.throws(() => k.pf.footOf('under-room', 80, 24, 80), /mat 必传/, 'footOf 同走必传检');
  assert.throws(() => k.pf.place('mound', 80, 24, 80), /top 必传/, 'mound 缺 top');
  assert.throws(() => k.pf.place('mound', 80, 24, 80, {top: 2}), /rock 必传/, 'mound 缺 rock');
  assert.throws(() => k.pf.place('under-room', 80, 24, 80, {mat: 58, torches: 'pairx'}),
      /torches/, 'torches 枚举');
  assert.throws(() => k.pf.place('under-room', 80, 24, 80, {mat: 58, exit: {step: 3}}),
      /exit/, 'exit 未知子键');
  assert.throws(() => k.pf.place('mound', 80, 24, 80, {top: 2, rock: 14, sal: 1}),
      /v 键/, 'mound 未知 v 键');
  /* 第二档(几何数值域→钳): floorDy 负域收敛 ±255(深埋=全裁界外场全空) */
  k.clear(); k.pf.place('under-room', 80, 24, 80, {mat: 58, floorDy: -999});
  const a = k.snap();
  k.clear(); k.pf.place('under-room', 80, 24, 80, {mat: 58, floorDy: -255});
  assert.ok(a.equals(k.snap()), 'floorDy −999 钳 −255 同形');
  assert.ok(!a.some((v) => v !== 0), '深埋全裁界外(场全空)');
  k.clear(); k.pf.place('mound', 80, 24, 80, {top: 2, rock: 14, salt: 'x'});
  const c = k.snap();
  k.clear(); k.pf.place('mound', 80, 24, 80, {top: 2, rock: 14, salt: 0});
  assert.ok(c.equals(k.snap()), 'salt 非有限数回落 0 同形');
});

/* ============ T-PREFAB-01 tower-belfry(钟塔, 新增行) ============ */

const TOWER_IDS = {/* ids 槽子键白名单(§4.1): 显式注入避免依赖默认裸数字 */
  base: 58, wall: 6, pillar: 5, trim: 47, roof: 40, bell: 41, window: 20, flag: 35,
};

function towerBaseCells(ax, az) {/* dy=0 地基 6×6: dx,dz ∈ [-2,3] */
  const out = [];
  for (let dx = -2; dx <= 3; dx++) {
    for (let dz = -2; dz <= 3; dz++) out.push([ax + dx, az + dz]);
  }
  return out;
}

test('脚印包含·tower-belfry: ×4 朝向 × mirror × 变体 — 每笔写 ∈ footOf 同参盒, footOf 零写', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['缺省', {ids: TOWER_IDS}],
    ['高档 14', {ids: TOWER_IDS, heightTier: 14}],
    ['高档 16', {ids: TOWER_IDS, heightTier: 16}],
    ['无门龛无旗', {ids: TOWER_IDS, hasDoorNiche: false, flags: false}],
    ['钟室非全敞(按 v 开关)', {ids: TOWER_IDS, openBelfry: false}],
    ['换材质', {ids: Object.assign({}, TOWER_IDS, {base: 1, wall: 2, bell: 3, roof: 4})}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('tower-belfry', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' + JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('tower-belfry', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
        /* footOf 覆盖最大 6×6 外廓与全高 dy0..14(含檐/顶饰; 旗面若出挑计入盒) */
        assert.ok(box.x2 - box.x1 + 1 >= 6 && box.z2 - box.z1 + 1 >= 6,
            name + ' ' + face + ' footOf 平面至少覆盖 6×6 外廓');
        assert.ok(box.y1 <= 24 && box.y2 >= 24 + 14,
            name + ' ' + face + ' footOf 覆盖 dy0..14 全高');
      }
    }
  }
});

test('形状·tower-belfry: 地基 6×6/塔身 4×4 同心分层/钟室 6×6 开敞/钟体占位/顶饰分层(缺省)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS});
  /* dy=0 地基 6×6 */
  for (const [x, z] of towerBaseCells(ax, az)) {
    assert.strictEqual(k.cell(x, y0, z), TOWER_IDS.base, '地基 dy=0 (' + (x - ax) + ',' + (z - az) + ')');
  }
  /* dy=1..7 塔身 4×4 同心主体([-1,2]², 6×6 内缩1圈; 裁决: PO 超时默认落板 2026-11-13 采纳 4×4) */
  for (let dy = 1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      for (let dz = -1; dz <= 2; dz++) {
        assert.notStrictEqual(k.cell(ax + dx, y0 + dy, az + dz), 0,
            '塔身 dy=' + dy + ' 4×4 域实心 (' + dx + ',' + dz + ')');
      }
    }
    for (let dx = -2; dx <= 3; dx++) {
      for (let dz = -2; dz <= 3; dz++) {
        if (dx >= -1 && dx <= 2 && dz >= -1 && dz <= 2) continue;
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), 0,
            '塔身 dy=' + dy + ' 域外空 (' + dx + ',' + dz + ')');
      }
    }
  }
  /* dy=8..10 钟室外扩 6×6 开敞亭式: 四面开口, 柱脚保留, 室内有钟体占位 2×2×2(ids.bell) */
  let bellCount = 0;
  for (let dx = -2; dx <= 3; dx++) {
    for (let dz = -2; dz <= 3; dz++) {
      for (let dy = 8; dy <= 10; dy++) {
        if (k.cell(ax + dx, y0 + dy, az + dz) === TOWER_IDS.bell) bellCount++;
      }
    }
  }
  assert.ok(bellCount >= 8, '钟体占位 2×2×2(ids.bell) 存在(计数 ' + bellCount + ')');
  /* dy=11..14 顶饰: 有 roof/trim 实体, 且总体封顶不高于 footOf 上界 */
  let roofCount = 0;
  for (let dx = -2; dx <= 3; dx++) {
    for (let dz = -2; dz <= 3; dz++) {
      for (let dy = 11; dy <= 14; dy++) {
        const id = k.cell(ax + dx, y0 + dy, az + dz);
        if (id === TOWER_IDS.roof || id === TOWER_IDS.trim) roofCount++;
      }
    }
  }
  assert.ok(roofCount > 0, '顶饰 dy11..14 有屋顶/饰件实体');
  assert.strictEqual(k.cell(ax, y0 + 15, az), 0, '缺省 heightTier=15 时 dy15 无实体(封顶于 14)');
});

test('形状·tower-belfry: 前立面装饰门龛 dy1..3(开)/关, 侧窗位 dy4..6, 钟室四面开敞(openBelfry)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'south', hasDoorNiche: true});
  /* 前立面朝 +dz: front face 列 dz=+2(5×5 主体前沿), 门龛在中线 dy1..3 */
  let nicheAir = 0;
  for (let dy = 1; dy <= 3; dy++) {
    if (k.cell(ax, y0 + dy, az + 2) === 0 || k.cell(ax, y0 + dy, az + 2) === TOWER_IDS.window) nicheAir++;
  }
  assert.ok(nicheAir >= 1, '前立面中线 dy1..3 有装饰门龛/内衬视觉(开口或浅色内衬)');
  /* 侧窗位 dy4..6: 左右侧(±x)中线存在 window 或开口位 */
  let sideWindow = 0;
  for (let dy = 4; dy <= 6; dy++) {
    const leftW = k.cell(ax - 1, y0 + dy, az + 1) === TOWER_IDS.window ||
        k.cell(ax - 1, y0 + dy, az) === TOWER_IDS.window;
    const rightW = k.cell(ax + 2, y0 + dy, az + 1) === TOWER_IDS.window ||
        k.cell(ax + 2, y0 + dy, az) === TOWER_IDS.window;
    if (leftW || rightW) sideWindow++;
  }
  assert.ok(sideWindow >= 1, '侧面 dy4..6 有小窗位(ids.window)');
  /* 关门龛: 同位不应比开启态更空(墙体/内衬保留) */
  k.clear();
  k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'south', hasDoorNiche: false});
  assert.notStrictEqual(k.cell(ax, y0 + 2, az + 2), 0, 'hasDoorNiche=false 时前立面中线 dy2 非空气洞');
  /* openBelfry=true: 钟室四面开敞(中段四面均有开口) */
  k.clear();
  k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, openBelfry: true});
  let openSides = 0;
  if (k.cell(ax, y0 + 9, az - 2) === 0) openSides++;
  if (k.cell(ax, y0 + 9, az + 3) === 0) openSides++;
  if (k.cell(ax - 2, y0 + 9, az) === 0) openSides++;
  if (k.cell(ax + 3, y0 + 9, az) === 0) openSides++;
  assert.strictEqual(openSides, 4, 'openBelfry=true 钟室 dy9 四面全开敞(计数 ' + openSides + ')');
});

test('逐朝向·tower-belfry: 前立面(+dz, face0=south)门龛/窗随 face 旋转, mirror 翻转 dx', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* face0=south: 门龛在 (0, dy1..3, +2) 前沿中线(相对锚) */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'south'});
  assert.ok(k.cell(ax, y0 + 2, az + 2) === 0 || k.cell(ax, y0 + 2, az + 2) === TOWER_IDS.window,
      'south 前立面门龛位在 z+2');
  /* west: (dx,dz)->(-dz,dx), 门龛前沿转到 x-2 */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'west'});
  assert.ok(k.cell(ax - 2, y0 + 2, az) === 0 || k.cell(ax - 2, y0 + 2, az) === TOWER_IDS.window,
      'west 前立面门龛位在 x-2');
  /* north: (-dx,-dz), 门龛前沿转到 z-2 */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'north'});
  assert.ok(k.cell(ax, y0 + 2, az - 2) === 0 || k.cell(ax, y0 + 2, az - 2) === TOWER_IDS.window,
      'north 前立面门龛位在 z-2');
  /* east: (dz,-dx), 门龛前沿转到 x+3 或 x+2(朝东 6×6 外廓前沿) */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'east'});
  const eastNiche = k.cell(ax + 2, y0 + 2, az) === 0 || k.cell(ax + 2, y0 + 2, az) === TOWER_IDS.window ||
      k.cell(ax + 3, y0 + 2, az) === 0 || k.cell(ax + 3, y0 + 2, az) === TOWER_IDS.window;
  assert.ok(eastNiche, 'east 前立面门龛位随朝向旋转到东侧');
  /* mirror: 先翻 dx 后旋转(south) — 非对称旗位左右互换(镜像非 no-op), 门龛中轴仍在前沿 */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'south'});
  const flagA = [ax - 2, y0 + 10, az - 1];
  const flagB = [ax + 3, y0 + 10, az + 1];
  assert.strictEqual(k.cell(flagA[0], flagA[1], flagA[2]), TOWER_IDS.flag, 'south 旗位A在左后');
  assert.strictEqual(k.cell(flagB[0], flagB[1], flagB[2]), TOWER_IDS.flag, 'south 旗位B在右前');
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'south', mirror: true});
  assert.ok(k.cell(ax, y0 + 2, az + 2) === 0 || k.cell(ax, y0 + 2, az + 2) === TOWER_IDS.window,
      'south+mirror 门龛中轴仍在前沿');
  assert.notStrictEqual(k.cell(flagA[0], flagA[1], flagA[2]), TOWER_IDS.flag,
      'south+mirror 非对称旗位A不再原位(镜像生效)');
  assert.strictEqual(k.cell(ax + 2, y0 + 10, az - 1), TOWER_IDS.flag,
      'south+mirror 旗位A镜像后落左后对称位');
});

test('确定性: tower-belfry 同参两次逐字节一致(多朝向×变体)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS}),
    () => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, face: 'east', mirror: true, heightTier: 16}),
    () => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, face: 'north', hasDoorNiche: false, flags: false}),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档·tower-belfry: 未知 v 键/ids 子键/face 非法→throw; heightTier 钳域 14..16(数值域)', () => {
  const k = loadKit();
  assert.throws(() => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, facee: 'north'}),
      /v 键/, '未知 v 键');
  assert.throws(() => k.pf.footOf('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, foo: 1}),
      /v 键/, 'footOf 同走未知 v 键检');
  assert.throws(() => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, face: 'up'}),
      /face/, 'face 非法');
  assert.throws(() => k.pf.place('tower-belfry', 80, 24, 80, {ids: Object.assign({}, TOWER_IDS, {roofx: 1})}),
      /ids/, 'ids 未知子键');
  /* heightTier 档{14,15,16} 钳域: 越界钳到边界, 不 throw */
  k.clear();
  const bLow = k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, heightTier: 10});
  const sLow = k.snap();
  k.clear();
  const b14 = k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, heightTier: 14});
  assert.ok(sLow.equals(k.snap()), 'heightTier 低于档位钳至 14 同形');
  assert.deepStrictEqual(bLow, b14, '钳后脚印盒一致(低档)');
  k.clear();
  const bHigh = k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, heightTier: 99});
  const sHigh = k.snap();
  k.clear();
  const b16 = k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, heightTier: 16});
  assert.ok(sHigh.equals(k.snap()), 'heightTier 高于档位钳至 16 同形');
  assert.deepStrictEqual(bHigh, b16, '钳后脚印盒一致(高档)');
});

/* ============ T-PREFAB-02 shop-awning(Lava Chicken 店, 新增行) ============ */

/* ids 槽子键白名单(§4.2): 全互异显式注入, 逐槽可判读(不依赖实现缺省裸数字) */
const SHOP_IDS = {
  base: 110, wall: 111, roof: 112, trim: 113, awning: 114,
  signBg: 115, signAccent: 116, glow: 117, window: 118,
};

/* 局部系契约(字面域钉死, 防宽度漂移): face0=south 店面朝 +dz; 锚=店身地面中心
   投影(偶宽 NW 偏置同 pfSpan 约定: 宽 10→dx∈[-5,4], 深 8→dz∈[-4,3])。
   dy0 地台=店身 10×8+前廊外延 dz=4(共 10×9); dy1..4 店身墙环(四角 trim 角柱·
   前立面门洞 2w×3h dx∈[-1,0]·展示窗 2w×2h dx∈[-4,-3]与[2,3] dy3..4);
   dy5 檐层=店身 roof+前廊遮檐 dz=4 全宽 awning(前檐突出=遮檐, 奶油布幔);
   dy6 阶梯顶内缩一圈 8×6; dy7 招牌板宽 6(dx∈[-3,2])挑出前廊上空 dz=4(几何只留
   板体); dy≥8 无物。红线: 无熔岩/火方块语义, glow 仅暖橙装饰块意象(§4.2/§8)。 */

test('脚印包含·shop-awning: ×4 朝向 × mirror × 变体 — 每笔写 ∈ footOf 同参盒, footOf 零写', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['缺省', {ids: SHOP_IDS}],
    ['关门', {ids: SHOP_IDS, doorOpen: false}],
    ['无暖光', {ids: SHOP_IDS, windowGlow: 'none'}],
    ['素招牌', {ids: SHOP_IDS, signVariant: 'blank'}],
    ['关门+无暖光+素招牌', {ids: SHOP_IDS, doorOpen: false, windowGlow: 'none', signVariant: 'blank'}],
    ['换材质(部分注入)', {ids: Object.assign({}, SHOP_IDS, {base: 1, roof: 2, awning: 3})}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('shop-awning', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' + JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('shop-awning', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
        /* footOf 覆盖 10×8 地台+前廊外延(平面至少 10×9)与 dy0..7 全高(含招牌挑出) */
        const spanX = box.x2 - box.x1 + 1;
        const spanZ = box.z2 - box.z1 + 1;
        assert.ok(Math.max(spanX, spanZ) >= 10 && Math.min(spanX, spanZ) >= 9,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 平面至少覆盖 10×9(地台+前廊)');
        assert.ok(box.y1 <= 24 && box.y2 >= 24 + 7,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 覆盖 dy0..7 全高');
      }
    }
  }
});

test('形状·shop-awning: 地台 10×9/墙环 dy1..4 四角角柱/门洞 2w×3h/展示窗/檐层+遮檐/内缩顶/招牌板(缺省)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS});
  /* 缺省盒手算值: 店身 dx[-5,4]×dz[-4,4](含前廊)×dy0..7 */
  assert.deepStrictEqual({...k.pf.footOf('shop-awning', ax, y0, az, {ids: SHOP_IDS})},
      {x1: 75, y1: 24, z1: 76, x2: 84, y2: 31, z2: 84}, '缺省脚印盒=手算盒');
  /* dy=0 地台: 店身 10×8(dx∈[-5,4]×dz∈[-4,3])+前廊外延 dz=4 → 恰 10×9 实心 base, 域外全空 */
  for (let dx = -7; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const inPlat = dx >= -5 && dx <= 4 && dz >= -4 && dz <= 4;
      assert.strictEqual(k.cell(ax + dx, y0, az + dz), inPlat ? SHOP_IDS.base : 0,
          '地台 dy0 (' + dx + ',' + dz + ') ' + (inPlat ? '实心' : '域外空'));
    }
  }
  /* dy=1..4 店身墙环(店身周界, 不含前廊): 周界实/内域空/环外空(含前廊上空 dz=4) */
  for (let dy = 1; dy <= 4; dy++) {
    for (let dx = -7; dx <= 6; dx++) {
      for (let dz = -6; dz <= 6; dz++) {
        const onRing = dx >= -5 && dx <= 4 && dz >= -4 && dz <= 3 &&
            (dx === -5 || dx === 4 || dz === -4 || dz === 3);
        const id = k.cell(ax + dx, y0 + dy, az + dz);
        if (!onRing) {
          assert.strictEqual(id, 0, '店身 dy' + dy + ' 环外空 (' + dx + ',' + dz + ')');
          continue;
        }
        /* 门洞 2w×3h 敞开格(缺省 doorOpen=true)豁免「周界实」——由下方墙环材质
            地图钉死为 0(裁决 T-PREFAB-02: 首环循环漏豁免系测试笔误, 门洞=空气
            是派单契约与变体/错误/逐朝向/stilt-hut 先例的多数派口径) */
        const doorHole = dz === 3 && dx >= -1 && dx <= 0 && dy <= 3;
        if (!doorHole) {
          assert.notStrictEqual(id, 0, '店身 dy' + dy + ' 周界实 (' + dx + ',' + dz + ')');
        }
      }
    }
    for (let dx = -4; dx <= 3; dx++) {
      for (let dz = -3; dz <= 2; dz++) {
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), 0, '店身 dy' + dy + ' 内域空');
      }
    }
  }
  /* 墙环材质全钉: 四角 trim 角柱(暖木-深)·前立面(dz=3)门洞/窗/墙·侧后墙 wall */
  for (let dy = 1; dy <= 4; dy++) {
    for (let dx = -5; dx <= 4; dx++) {
      for (const dz of [-4, -3, -2, -1, 0, 1, 2, 3]) {
        const onRing = dx === -5 || dx === 4 || dz === -4 || dz === 3;
        if (!onRing) continue;
        const corner = (dx === -5 || dx === 4) && (dz === -4 || dz === 3);
        let want = SHOP_IDS.wall;
        if (corner) want = SHOP_IDS.trim;
        if (dz === 3 && !corner) {/* 前立面地图 */
          if (dx >= -4 && dx <= -3 && dy >= 3) want = SHOP_IDS.glow; /* 左展示窗 2w×2h */
          if (dx >= 2 && dx <= 3 && dy >= 3) want = SHOP_IDS.glow; /* 右展示窗 2w×2h */
          if (dx >= -1 && dx <= 0 && dy <= 3) want = 0; /* 门洞 2w×3h 敞开(doorOpen) */
        }
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), want,
            '墙环材质 dy' + dy + ' (' + dx + ',' + dz + ')');
      }
    }
  }
  /* dy=5 檐层: 店身 10×8 roof + 前廊遮檐 dz=4 全宽 awning(前檐突出), 域外空 */
  for (let dx = -7; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      let want = 0;
      if (dx >= -5 && dx <= 4 && dz >= -4 && dz <= 3) want = SHOP_IDS.roof;
      if (dx >= -5 && dx <= 4 && dz === 4) want = SHOP_IDS.awning;
      assert.strictEqual(k.cell(ax + dx, y0 + 5, az + dz), want, '檐层 dy5 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=6 阶梯顶内缩一圈: 恰 8×6(dx∈[-4,3]×dz∈[-3,2]) roof, 域外(含遮檐上空)全空 */
  for (let dx = -7; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const inTop = dx >= -4 && dx <= 3 && dz >= -3 && dz <= 2;
      assert.strictEqual(k.cell(ax + dx, y0 + 6, az + dz), inTop ? SHOP_IDS.roof : 0,
          '阶梯顶 dy6 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=7 招牌层: 横向板体恰宽 6(dx∈[-3,2])×1 厚, 挑出前廊上空 dz=4, 板体∈{signBg,signAccent};
     层内板外全空; dy=8 全空(封顶于 7); icon 变体板上有图形区分块(signAccent≥1) */
  let accent = 0; let bg = 0;
  for (let dx = -7; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const id = k.cell(ax + dx, y0 + 7, az + dz);
      const onBoard = dx >= -3 && dx <= 2 && dz === 4;
      if (onBoard) {
        assert.ok(id === SHOP_IDS.signBg || id === SHOP_IDS.signAccent,
            '招牌板 dy7 (' + dx + ',' + dz + ') ∈ {signBg,signAccent}');
        if (id === SHOP_IDS.signAccent) accent++;
        if (id === SHOP_IDS.signBg) bg++;
      } else {
        assert.strictEqual(id, 0, '招牌层 dy7 板外空 (' + dx + ',' + dz + ')');
      }
      assert.strictEqual(k.cell(ax + dx, y0 + 8, az + dz), 0, 'dy8 全空(封顶于 dy7)');
    }
  }
  assert.strictEqual(accent + bg, 6, '招牌板恰 6 格宽(宽 6-7 居中, 本契约钉 6)');
  assert.ok(accent >= 1 && bg >= 1, 'icon 变体: 板上有 signAccent 图形区区分块且有底板');
});

test('形状·shop-awning 变体: 关门补墙/无暖光窗区浅色且全场零 glow/素招牌零 signAccent(去威胁红线)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* doorOpen=false: 门洞 2w×3h 补墙(无敞开感), 其余几何不动(窗/角柱/地台抽查) */
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, doorOpen: false});
  for (let dy = 1; dy <= 3; dy++) {
    for (const dx of [-1, 0]) {
      assert.strictEqual(k.cell(ax + dx, y0 + dy, az + 3), SHOP_IDS.wall,
          '关门: 门洞补墙 dy' + dy + ' dx' + dx);
    }
  }
  assert.strictEqual(k.cell(ax - 4, y0 + 3, az + 3), SHOP_IDS.glow, '关门款窗区不变(左)');
  assert.strictEqual(k.cell(ax + 3, y0 + 4, az + 3), SHOP_IDS.glow, '关门款窗区不变(右)');
  assert.strictEqual(k.cell(ax - 5, y0 + 2, az + 3), SHOP_IDS.trim, '关门款角柱不变');
  assert.strictEqual(k.cell(ax, y0, az + 4), SHOP_IDS.base, '关门款前廊地台不变');
  /* windowGlow=none: 窗区=window 浅色内衬, 全场零 glow 块(暖橙装饰光意象关闭) */
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, windowGlow: 'none'});
  for (let dy = 3; dy <= 4; dy++) {
    for (const dx of [-4, -3, 2, 3]) {
      assert.strictEqual(k.cell(ax + dx, y0 + dy, az + 3), SHOP_IDS.window,
          '无暖光: 窗区浅色内衬 dy' + dy + ' dx' + dx);
    }
  }
  assert.ok(!k.snap().includes(SHOP_IDS.glow), 'windowGlow=none 全场零 glow 块');
  assert.strictEqual(k.cell(ax - 1, y0 + 2, az + 3), 0, '无暖光款门洞仍敞开(doorOpen 独立轴)');
  /* signVariant=blank: 招牌板全 signBg, 全场零 signAccent(图形区归纹理层) */
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, signVariant: 'blank'});
  for (const dx of [-3, -2, -1, 0, 1, 2]) {
    assert.strictEqual(k.cell(ax + dx, y0 + 7, az + 4), SHOP_IDS.signBg,
        '素招牌: 板体全 signBg dx' + dx);
  }
  assert.ok(!k.snap().includes(SHOP_IDS.signAccent), 'blank 变体全场零 signAccent');
  assert.ok(k.snap().includes(SHOP_IDS.signBg), 'blank 板体仍在(防整板消失假绿)');
});

test('逐朝向·shop-awning: 门洞/遮檐/招牌随 face 旋转(face0=south 朝 +dz), mirror 翻 dx 非对称差分', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* 手算表: k1(west)=(dx,dz)→(-dz,dx) · k2(north)=(-dx,-dz) · k3(east)=(dz,-dx);
     门洞局部 (dx∈[-1,0], dy1..3, dz=3) · 遮檐 (·, 5, 4) · 招牌板 (dx∈[-3,2], 7, 4) */
  const onBoard = (id) => id === SHOP_IDS.signBg || id === SHOP_IDS.signAccent;
  const faces = [ /* [face, 门洞两格, 遮檐格, 招牌行固定轴(计数行)] */
    ['west', [[77, 79], [77, 80]], [76, 80], ['x', 76]],
    ['north', [[80, 77], [81, 77]], [80, 76], ['z', 76]],
    ['east', [[83, 80], [83, 81]], [84, 80], ['x', 84]],
  ];
  for (const [face, door, awn, [axis, at]] of faces) {
    k.clear();
    k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, face});
    for (const dy of [1, 2, 3]) {
      for (const [px, pz] of door) {
        assert.strictEqual(k.cell(px, y0 + dy, pz), 0, face + ' 门洞敞开 y' + dy);
      }
    }
    assert.strictEqual(k.cell(awn[0], y0 + 5, awn[1]), SHOP_IDS.awning,
        face + ' 遮檐随朝向(前廊侧)');
    let board = 0;
    for (let t = 70; t <= 90; t++) {
      const id = axis === 'x' ? k.cell(at, y0 + 7, t) : k.cell(t, y0 + 7, at);
      if (onBoard(id)) board++;
    }
    assert.strictEqual(board, 6, face + ' 招牌板宽 6 随朝向旋转');
    assert.ok(onBoard(axis === 'x' ? k.cell(at, y0 + 7, az) : k.cell(ax, y0 + 7, at)),
        face + ' 招牌板中段在位');
  }
  /* south 恒等基线: 门洞 (79..80,·,83), 遮檐 (·,29,84), 平台西缘在 75/东缘在 84 */
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, face: 'south'});
  assert.strictEqual(k.cell(79, y0 + 2, 83), 0, 'south 门洞左格敞开');
  assert.strictEqual(k.cell(80, y0 + 2, 83), 0, 'south 门洞右格敞开');
  assert.strictEqual(k.cell(75, y0, 80), SHOP_IDS.base, 'south 平台西缘=dx-5');
  assert.strictEqual(k.cell(85, y0, 80), 0, 'south 平台东缘外(dx5 域外)');
  /* mirror 非对称差分(偶宽体 [-5,4] 关于 dx=0 不对称): 先翻 dx 后旋转——
     门洞 [-1,0]→[0,1], 体 [-5,4]→[-4,5]: 西缘补格/东缘让格双翻转 */
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, face: 'south', mirror: true});
  assert.strictEqual(k.cell(79, y0 + 2, 83), SHOP_IDS.wall, 'south+mirror 门洞左格翻成墙');
  assert.strictEqual(k.cell(80, y0 + 2, 83), 0, 'south+mirror 门洞中轴格仍敞开');
  assert.strictEqual(k.cell(81, y0 + 2, 83), 0, 'south+mirror 门洞右移到 dx=1');
  assert.strictEqual(k.cell(85, y0, 80), SHOP_IDS.base, 'south+mirror 平台东移(dx5 入域)');
  assert.strictEqual(k.cell(75, y0, 80), 0, 'south+mirror 平台西让(dx-5 出域)');
  assert.strictEqual(k.cell(80, y0 + 5, 84), SHOP_IDS.awning, 'south+mirror 遮檐仍在前廊侧');
});

test('确定性: shop-awning 同参两次逐字节一致(多朝向×变体)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS}),
    () => k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, face: 'east', mirror: true}),
    () => k.pf.place('shop-awning', 80, 24, 80, {
      ids: SHOP_IDS, face: 'north',
      doorOpen: false, windowGlow: 'none', signVariant: 'blank',
    }),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档·shop-awning: 未知 v 键/ids 子键/face/windowGlow/signVariant 非法→throw; doorOpen 钳布尔', () => {
  const k = loadKit();
  /* 第一档(装场期炸=拼写防火墙): place 与 footOf 同走合并校验路径 */
  assert.throws(() => k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, facee: 'north'}),
      /v 键/, '未知 v 键(拼写)');
  assert.throws(() => k.pf.footOf('shop-awning', 80, 24, 80, {ids: SHOP_IDS, foo: 1}),
      /v 键/, 'footOf 同走未知 v 键检');
  assert.throws(() => k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, face: 'up'}),
      /face/, 'face 非法');
  assert.throws(() => k.pf.place('shop-awning', 80, 24, 80,
      {ids: Object.assign({}, SHOP_IDS, {awnin: 1})}), /ids/, 'ids 未知子键');
  assert.throws(() => k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, windowGlow: 'fire'}),
      /windowGlow/, 'windowGlow 枚举非法(暖橙装饰光意象仅 warm/none, 禁火语义)');
  assert.throws(() => k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, signVariant: 'text'}),
      /signVariant/, 'signVariant 枚举非法(文字不硬编码几何, 仅 icon/blank)');
  /* 第二档(布尔轴收放不炸): doorOpen 非布尔按真值钳 */
  k.clear();
  k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, doorOpen: 0});
  assert.strictEqual(k.cell(79, 25, 83), SHOP_IDS.wall, 'doorOpen=0 钳 false: 门洞补墙');
  k.clear();
  k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, doorOpen: 1});
  assert.strictEqual(k.cell(79, 25, 83), 0, 'doorOpen=1 钳 true: 门洞敞开');
});

/* ============ T-PREFAB-03 stash-hut(秘密储藏小屋, 新增行) ============ */

/* ids 槽子键白名单(§4.3): 全互异显式注入, 逐槽可判读(不依赖实现缺省裸数字)。
   metalAccent=铁灰小配件点缀——§4.3「可选」拍板(回执登记): 槽位常驻白名单,
   几何=门侧小配件恰一格 */
const STASH_IDS = {
  base: 120, wall: 121, roof: 122, trim: 123, door: 124, metalAccent: 125,
};

/* 局部系契约(字面域钉死, 防宽度漂移): face0=south 门面朝 +dz; 锚=小屋地面
    中心投影(偶宽 6 NW 偏置同 pfSpan 口径: 6→dx,dz∈[-3,2], 宽=2−(−3)+1=6,
    中心偏置 −0.5)。dy0 中石基座=恰 6×6 实心板; dy1..3 墙环(周界 wall, 内域
    空无家具——箱/桶属外部道具散布, §4.3 明示不强绑); 门叶 1w×2h 局部
    (0,dy1..2,dz2)=ids.door, door=false 敞开门洞, 门上 dy3 补墙; 门侧铁灰
    小配件 (1,1,2)=metalAccent 一格; dy4 檐层=恰 6×6(周界 trim 暖木-深屋檐
    +内芯 4×4[-2,1]² roof); roofPitch=mid(缺省)→dy5 再内缩恰 4×4 roof 封顶
    (总高 6), low→封顶 dy4(总高 5)——高 5-6 读作含 dy0 基座总层数; 封顶上一
    层无物。红线: 无光/火语义槽位(ids 白名单无 torch/glow, 去威胁钉在错误
    档), 门侧箱/桶不入蓝图。 */

test('脚印包含·stash-hut: ×4 朝向 × mirror × 变体 — 每笔写 ∈ footOf 同参盒, footOf 零写', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['缺省(mid)', {ids: STASH_IDS}],
    ['low 顶', {ids: STASH_IDS, roofPitch: 'low'}],
    ['无门叶(敞开)', {ids: STASH_IDS, door: false}],
    ['low+无门叶', {ids: STASH_IDS, roofPitch: 'low', door: false}],
    ['换材质(部分注入)', {ids: Object.assign({}, STASH_IDS, {base: 1, roof: 2, door: 3})}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('stash-hut', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' + JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('stash-hut', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
        /* footOf 恰 6×6 底×全高: 方角 90° 旋转平面恰 6×6, y1=锚层基座,
           y2 随 roofPitch(low=dy4 总高 5/mid=dy5 总高 6)——§4.3 高 5-6 域 */
        assert.strictEqual(box.x2 - box.x1 + 1, 6,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 平面恰宽 6');
        assert.strictEqual(box.z2 - box.z1 + 1, 6,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 平面恰深 6');
        assert.strictEqual(box.y1, 24, name + ' ' + face + ' footOf 下界=锚层基座 dy0');
        assert.strictEqual(box.y2, v.roofPitch === 'low' ? 28 : 29,
            name + ' ' + face + ' footOf 上界随 roofPitch');
      }
    }
  }
});

test('形状·stash-hut: 基座 6×6/墙环 dy1..3 内域空/门叶 1w×2h/门侧小配件/檐层 6×6/内缩顶(mid 缺省)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('stash-hut', ax, y0, az, {ids: STASH_IDS});
  /* 缺省(mid)盒手算值: dx,dz∈[-3,2]×dy0..5 */
  assert.deepStrictEqual({...k.pf.footOf('stash-hut', ax, y0, az, {ids: STASH_IDS})},
      {x1: 77, y1: 24, z1: 77, x2: 82, y2: 29, z2: 82}, '缺省脚印盒=手算盒');
  /* dy=0 基座: 恰 6×6 实心 base, 域外空 */
  for (let dx = -5; dx <= 4; dx++) {
    for (let dz = -5; dz <= 4; dz++) {
      const inBase = dx >= -3 && dx <= 2 && dz >= -3 && dz <= 2;
      assert.strictEqual(k.cell(ax + dx, y0, az + dz), inBase ? STASH_IDS.base : 0,
          '基座 dy0 (' + dx + ',' + dz + ') ' + (inBase ? '实心' : '域外空'));
    }
  }
  /* dy=1..3 墙环: 周界实(want 制: 门叶/门上补墙/门侧小配件)/内域空(无家具)/环外空 */
  for (let dy = 1; dy <= 3; dy++) {
    for (let dx = -5; dx <= 4; dx++) {
      for (let dz = -5; dz <= 4; dz++) {
        const inBox = dx >= -3 && dx <= 2 && dz >= -3 && dz <= 2;
        const onRing = inBox && (dx === -3 || dx === 2 || dz === -3 || dz === 2);
        const id = k.cell(ax + dx, y0 + dy, az + dz);
        if (!onRing) {
          assert.strictEqual(id, 0, '墙环 dy' + dy + ' 内域/环外空 (' + dx + ',' + dz + ')');
          continue;
        }
        let want = STASH_IDS.wall;
        if (dx === 0 && dz === 2 && dy <= 2) want = STASH_IDS.door; /* 门叶 1w×2h */
        if (dx === 1 && dz === 2 && dy === 1) want = STASH_IDS.metalAccent; /* 门侧小配件 */
        assert.strictEqual(id, want, '墙环 dy' + dy + ' (' + dx + ',' + dz + ')');
      }
    }
  }
  /* dy=4 檐层: 恰 6×6——周界 trim(暖木-深屋檐)+内芯 4×4[-2,1]² roof */
  for (let dx = -5; dx <= 4; dx++) {
    for (let dz = -5; dz <= 4; dz++) {
      let want = 0;
      if (dx >= -3 && dx <= 2 && dz >= -3 && dz <= 2) {
        const onRing = dx === -3 || dx === 2 || dz === -3 || dz === 2;
        want = onRing ? STASH_IDS.trim : STASH_IDS.roof;
      }
      assert.strictEqual(k.cell(ax + dx, y0 + 4, az + dz), want,
          '檐层 dy4 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=5 内缩顶(mid): 恰 4×4[-2,1]² roof 域外空; dy=6 全空(封顶于 5) */
  for (let dx = -5; dx <= 4; dx++) {
    for (let dz = -5; dz <= 4; dz++) {
      const inTop = dx >= -2 && dx <= 1 && dz >= -2 && dz <= 1;
      assert.strictEqual(k.cell(ax + dx, y0 + 5, az + dz), inTop ? STASH_IDS.roof : 0,
          '内缩顶 dy5 (' + dx + ',' + dz + ')');
      assert.strictEqual(k.cell(ax + dx, y0 + 6, az + dz), 0, 'dy6 全空(封顶于 dy5)');
    }
  }
});

test('形状·stash-hut 变体: door=false 门洞敞开全场零门叶/low 顶 dy5 全空檐层仍在(防假绿)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* door=false: 门叶 1×2 掏空气, 全场零 door 块; 其余几何不动(配件/门上墙抽查) */
  k.clear();
  k.pf.place('stash-hut', ax, y0, az, {ids: STASH_IDS, door: false});
  assert.strictEqual(k.cell(ax, y0 + 1, az + 2), 0, '无门叶: 门洞下格敞开');
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), 0, '无门叶: 门洞上格敞开');
  assert.strictEqual(k.cell(ax, y0 + 3, az + 2), STASH_IDS.wall, '无门叶: 门上 dy3 补墙');
  assert.strictEqual(k.cell(ax + 1, y0 + 1, az + 2), STASH_IDS.metalAccent,
      '无门叶: 门侧小配件不动');
  assert.strictEqual(k.cell(ax, y0 + 4, az), STASH_IDS.roof, '无门叶: 檐层内芯不动');
  assert.ok(!k.snap().includes(STASH_IDS.door), 'door=false 全场零门叶块');
  /* roofPitch=low: dy5 全空(封顶 dy4), dy4 檐层/内芯仍在(防整板消失), 盒收 y2=dy4 */
  k.clear();
  k.pf.place('stash-hut', ax, y0, az, {ids: STASH_IDS, roofPitch: 'low'});
  for (let dx = -5; dx <= 4; dx++) {
    for (let dz = -5; dz <= 4; dz++) {
      assert.strictEqual(k.cell(ax + dx, y0 + 5, az + dz), 0, 'low 顶: dy5 全空');
    }
  }
  assert.strictEqual(k.cell(ax - 3, y0 + 4, az), STASH_IDS.trim, 'low 顶: 檐层周界仍在(西缘)');
  assert.strictEqual(k.cell(ax, y0 + 4, az), STASH_IDS.roof, 'low 顶: 檐层内芯仍在');
  assert.strictEqual(k.cell(ax, y0 + 1, az + 2), STASH_IDS.door, 'low 顶: 门叶不动(轴独立)');
  assert.deepStrictEqual(
      {...k.pf.footOf('stash-hut', ax, y0, az, {ids: STASH_IDS, roofPitch: 'low'})},
      {x1: 77, y1: 24, z1: 77, x2: 82, y2: 28, z2: 82}, 'low 顶盒=手算盒(总高 5)');
  assert.ok(k.snap().includes(STASH_IDS.roof), 'low 顶: roof 块仍在(防全空假绿)');
});

test('逐朝向·stash-hut: 门叶/门侧小配件/檐角随 face 旋转(face0=south 朝 +dz), mirror 翻 dx 非对称差分', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* 手算表: k1(west)=(dx,dz)→(-dz,dx) · k2(north)=(-dx,-dz) · k3(east)=(dz,-dx);
     门叶局部 (0,dy1..2,2) · 小配件 (1,1,2) · 檐角 (2,4,2) */
  const faces = [ /* [face, 门叶格, 小配件格, 檐角格]
      [裁决登记 T-PREFAB-03: 门叶列初版多包一层方括号, door[0]=数组/door[1]=
       undefined 恒 NaN 索引红——红方笔误(绿方指认属实, 数值经 PF_ROTS 手算
       复核无误), 红方亲修拍平, 非断言弱化] */
    ['west', [78, 80], [78, 81], [78, 82]],
    ['north', [80, 78], [79, 78], [78, 78]],
    ['east', [82, 80], [82, 79], [82, 78]],
  ];
  for (const [face, door, latch, corner] of faces) {
    k.clear();
    k.pf.place('stash-hut', ax, y0, az, {ids: STASH_IDS, face});
    for (const dy of [1, 2]) {
      assert.strictEqual(k.cell(door[0], y0 + dy, door[1]), STASH_IDS.door,
          face + ' 门叶 y' + dy);
    }
    assert.strictEqual(k.cell(latch[0], y0 + 1, latch[1]), STASH_IDS.metalAccent,
        face + ' 门侧小配件随朝向');
    assert.strictEqual(k.cell(corner[0], y0 + 4, corner[1]), STASH_IDS.trim,
        face + ' 檐角(周界)随朝向');
  }
  /* south 恒等基线: 门叶/配件在 z+2 前沿, 基座西缘在 dx-3/东缘外 dx3 */
  k.clear();
  k.pf.place('stash-hut', ax, y0, az, {ids: STASH_IDS, face: 'south'});
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), STASH_IDS.door, 'south 门叶在 z+2 中轴');
  assert.strictEqual(k.cell(ax + 1, y0 + 1, az + 2), STASH_IDS.metalAccent,
      'south 小配件在门东侧');
  assert.strictEqual(k.cell(ax - 3, y0, az), STASH_IDS.base, 'south 基座西缘=dx-3');
  assert.strictEqual(k.cell(ax + 3, y0, az), 0, 'south 基座东缘外(dx3 域外)');
  /* mirror 非对称差分(偶宽体 [-3,2] 关于 dx=0 不对称): 先翻 dx 后旋转——门叶
      在 dx=0 中轴 mirror 不动(轴上格不变式); 小配件 1→-1; 盒缘 [-3,2]→[-2,3]
      西缘让格/东缘补格双翻转 */
  k.clear();
  k.pf.place('stash-hut', ax, y0, az, {ids: STASH_IDS, face: 'south', mirror: true});
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), STASH_IDS.door, 'south+mirror 门叶仍在中轴');
  assert.strictEqual(k.cell(ax - 1, y0 + 1, az + 2), STASH_IDS.metalAccent,
      'south+mirror 小配件翻到门西侧');
  assert.strictEqual(k.cell(ax + 1, y0 + 1, az + 2), STASH_IDS.wall,
      'south+mirror 原小配件位补墙');
  assert.strictEqual(k.cell(ax + 3, y0, az), STASH_IDS.base, 'south+mirror 基座东移(dx3 入域)');
  assert.strictEqual(k.cell(ax - 3, y0, az), 0, 'south+mirror 基座西让(dx-3 出域)');
  assert.strictEqual(k.cell(ax + 3, y0 + 4, az), STASH_IDS.trim, 'south+mirror 檐层东缘随盒');
});

test('确定性: stash-hut 同参两次逐字节一致(多朝向×变体)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('stash-hut', 80, 24, 80, {ids: STASH_IDS}),
    () => k.pf.place('stash-hut', 80, 24, 80, {ids: STASH_IDS, face: 'east', mirror: true}),
    () => k.pf.place('stash-hut', 80, 24, 80, {
      ids: STASH_IDS, face: 'north', roofPitch: 'low', door: false,
    }),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档·stash-hut: 未知 v 键/ids 子键(含 torch/glow 去威胁钉)/face/roofPitch 非法→throw; door 钳布尔', () => {
  const k = loadKit();
  /* 第一档(装场期炸=拼写防火墙): place 与 footOf 同走合并校验路径 */
  assert.throws(() => k.pf.place('stash-hut', 80, 24, 80, {ids: STASH_IDS, facee: 'north'}),
      /v 键/, '未知 v 键(拼写)');
  assert.throws(() => k.pf.footOf('stash-hut', 80, 24, 80, {ids: STASH_IDS, foo: 1}),
      /v 键/, 'footOf 同走未知 v 键检');
  assert.throws(() => k.pf.place('stash-hut', 80, 24, 80, {ids: STASH_IDS, face: 'up'}),
      /face/, 'face 非法');
  assert.throws(() => k.pf.place('stash-hut', 80, 24, 80,
      {ids: Object.assign({}, STASH_IDS, {roofx: 1})}), /ids/, 'ids 未知子键');
  assert.throws(() => k.pf.place('stash-hut', 80, 24, 80, {ids: STASH_IDS, roofPitch: 'high'}),
      /roofPitch/, 'roofPitch 枚举非法(仅 low/mid)');
  /* 去威胁钉(§4.3/§8): 本行无光/火语义槽位——torch/glow 子键不在白名单即炸 */
  assert.throws(() => k.pf.place('stash-hut', 80, 24, 80,
      {ids: Object.assign({}, STASH_IDS, {torch: 48})}), /ids/, '无 torch 槽(零火语义)');
  assert.throws(() => k.pf.place('stash-hut', 80, 24, 80,
      {ids: Object.assign({}, STASH_IDS, {glow: 19})}), /ids/, '无 glow 槽(零暖光意象)');
  /* 第二档(布尔轴收放不炸): door 非布尔按真值钳 */
  k.clear();
  k.pf.place('stash-hut', 80, 24, 80, {ids: STASH_IDS, door: 0});
  assert.strictEqual(k.cell(80, 25, 82), 0, 'door=0 钳 false: 门洞敞开');
  k.clear();
  k.pf.place('stash-hut', 80, 24, 80, {ids: STASH_IDS, door: 1});
  assert.strictEqual(k.cell(80, 25, 82), STASH_IDS.door, 'door=1 钳 true: 门叶在位');
});
