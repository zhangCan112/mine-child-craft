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
      '({PrefabKit, SceneKit, setBlockRaw, getBlock, worldCells, BLOCKS, PF_ROWS,' +
      ' WORLD_W, WORLD_D, WORLD_H})', eng);
  const W = api.WORLD_W; const D = api.WORLD_D;
  return {
    pf: api.PrefabKit, fill: api.SceneKit.fill, set: api.setBlockRaw,
    rand: api.SceneKit.rand, get: api.getBlock, blocks: api.BLOCKS,
    rows: api.PF_ROWS, /* 蓝图表只读引用(T-09 审计按 defaults 槽名派生门豁免) */
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

const TOWER_IDS = {/* ids 槽子键白名单(总纲 §2 字库 v2): 全 10 键互异显式注入,
    逐槽可判读(不依赖实现缺省裸数字) */
  base: 210, wall: 211, pillar: 212, trim: 213, roof: 214,
  bell: 215, window: 216, flag: 217, door: 218, doorTop: 219,
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
    ['缺省(16 顶旗档)', {ids: TOWER_IDS}],
    ['低档 14', {ids: TOWER_IDS, heightTier: 14}],
    ['中档 15', {ids: TOWER_IDS, heightTier: 15}],
    ['无旗', {ids: TOWER_IDS, flags: false}],
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
        /* footOf 覆盖最大 6×6 外廓与全高 dy0..14+(顶旗档到 dy15; 旗面出挑计入盒) */
        assert.ok(box.x2 - box.x1 + 1 >= 6 && box.z2 - box.z1 + 1 >= 6,
            name + ' ' + face + ' footOf 平面至少覆盖 6×6 外廓');
        assert.ok(box.y1 <= 24 && box.y2 >= 24 + 14,
            name + ' ' + face + ' footOf 覆盖 dy0..14 全高(顶旗档兜 15)');
      }
    }
  }
});

test('形状·tower-belfry: 基座 6×6×2/塔身 4×4×8 half-timber(角柱贯通石英主导)/钟亭角柱+檐层/金钟 2×2×2/阶梯顶三级收分(缺省 16 档)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS});
  /* dy0..1 基座: 恰 6×6×2(base)——三段式第一段 */
  for (let dy = 0; dy <= 1; dy++) {
    for (const [x, z] of towerBaseCells(ax, az)) {
      assert.strictEqual(k.cell(x, y0 + dy, z), TOWER_IDS.base,
          '基座 dy=' + dy + ' (' + (x - ax) + ',' + (z - az) + ')');
    }
  }
  /* dy2..9 塔身: 恰 4×4×8([-1,2]²)half-timber——角柱贯通/石英墙面(PO 石英
      主导重平衡 2026-11-15: 旧 dy5·dy9 周界木腰线撤除, 边中格恒石英) */
  for (let dy = 2; dy <= 9; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      for (let dz = -1; dz <= 2; dz++) {
        const corner = (dx === -1 || dx === 2) && (dz === -1 || dz === 2);
        const want = corner ? TOWER_IDS.pillar : TOWER_IDS.wall;
        /* 前立面 dz=2 覆写格跳过(门/楣 dy2..4 与窗 dy6..7, 后写者赢), 见下方单测 */
        const frontOver = dz === 2 && ((dx === 0 && dy >= 2 && dy <= 4) ||
            (dx >= 0 && dx <= 1 && dy >= 6 && dy <= 7));
        if (frontOver) continue;
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), want,
            '塔身 dy=' + dy + ' (' + dx + ',' + dz + ')');
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
  /* 前立面 dz=2 覆写(序即几何): 门叶两格/门楣/前窗 2w×2h */
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), TOWER_IDS.door, '门叶 dy2');
  assert.strictEqual(k.cell(ax, y0 + 3, az + 2), TOWER_IDS.doorTop, '门上 dy3');
  assert.strictEqual(k.cell(ax, y0 + 4, az + 2), TOWER_IDS.trim, '门楣 dy4');
  for (const dy of [6, 7]) {
    for (const dx of [0, 1]) {
      assert.strictEqual(k.cell(ax + dx, y0 + dy, az + 2), TOWER_IDS.window,
          '前窗 dy' + dy + ' dx' + dx);
    }
  }
  /* dy10..12 钟亭: 四角柱贯通(dy10..11; dy12 角格被后写檐层 trim 覆盖——序即
      几何) + dy12 檐层恰 4×4 全 trim + dy10..11 边开敞 */
  for (let dy = 10; dy <= 11; dy++) {
    for (const dx of [-1, 2]) {
      for (const dz of [-1, 2]) {
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), TOWER_IDS.pillar,
            '钟亭角柱 dy=' + dy + ' (' + dx + ',' + dz + ')');
      }
    }
  }
  for (let dx = -1; dx <= 2; dx++) {
    for (let dz = -1; dz <= 2; dz++) {
      assert.strictEqual(k.cell(ax + dx, y0 + 12, az + dz), TOWER_IDS.trim,
          '檐层 dy12 (' + dx + ',' + dz + ')');
    }
  }
  for (const [dx, dz] of [[0, -1], [1, -1], [0, 2], [1, 2], [-1, 0], [-1, 1], [2, 0], [2, 1]]) {
    assert.strictEqual(k.cell(ax + dx, y0 + 10, az + dz), 0, '钟亭 dy10 边开敞 (' + dx + ',' + dz + ')');
    assert.strictEqual(k.cell(ax + dx, y0 + 11, az + dz), 0, '钟亭 dy11 边开敞 (' + dx + ',' + dz + ')');
  }
  /* 金钟: 恰 2×2×2 室心(dx,dz∈[0,1]×dy10..11)——灯块自发光钟体 */
  for (let dx = 0; dx <= 1; dx++) {
    for (let dz = 0; dz <= 1; dz++) {
      for (let dy = 10; dy <= 11; dy++) {
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), TOWER_IDS.bell,
            '金钟 (' + dx + ',' + dy + ',' + dz + ')');
      }
    }
  }
  /* dy13 阶梯顶: 恰 6×6 roof 檐板 → dy14 收分 4×4 roof → dy15 顶旗单格 */
  for (let dx = -2; dx <= 3; dx++) {
    for (let dz = -2; dz <= 3; dz++) {
      assert.strictEqual(k.cell(ax + dx, y0 + 13, az + dz), TOWER_IDS.roof,
          '顶檐板 dy13 (' + dx + ',' + dz + ')');
    }
  }
  for (let dx = -1; dx <= 2; dx++) {
    for (let dz = -1; dz <= 2; dz++) {
      assert.strictEqual(k.cell(ax + dx, y0 + 14, az + dz), TOWER_IDS.roof,
          '收分帽 dy14 (' + dx + ',' + dz + ')');
    }
  }
  assert.strictEqual(k.cell(ax, y0 + 15, az), TOWER_IDS.flag, '顶旗 dy15 单格');
  assert.strictEqual(k.cell(ax + 1, y0 + 15, az), 0, '顶旗邻格空(恰单格)');
  /* 檐下旗两则(dy12 同高外挑一格, 悬空点缀) */
  assert.strictEqual(k.cell(ax - 2, y0 + 12, az - 1), TOWER_IDS.flag, '檐下旗西后');
  assert.strictEqual(k.cell(ax + 3, y0 + 12, az + 1), TOWER_IDS.flag, '檐下旗东前');
});

test('形状·tower-belfry 封顶档: heightTier 16=顶旗/15=收分帽/14=檐板(阶梯收分随档裁尾)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* 16 档: dy13 檐板 6×6 + dy14 帽 4×4 + dy15 旗 */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, heightTier: 16});
  assert.strictEqual(k.cell(ax, y0 + 15, az), TOWER_IDS.flag, '16 档顶旗 dy15');
  assert.strictEqual(k.cell(ax, y0 + 14, az), TOWER_IDS.roof, '16 档收分帽 dy14');
  assert.strictEqual(k.cell(ax - 2, y0 + 13, az - 2), TOWER_IDS.roof, '16 档檐板 dy13 角');
  /* 15 档: 裁到 dy14 帽封顶, dy15 空 */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, heightTier: 15});
  assert.strictEqual(k.cell(ax, y0 + 14, az), TOWER_IDS.roof, '15 档帽 dy14');
  assert.strictEqual(k.cell(ax, y0 + 15, az), 0, '15 档 dy15 空');
  /* 14 档: 裁到 dy13 檐板封顶, dy14/dy15 空 */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, heightTier: 14});
  assert.strictEqual(k.cell(ax, y0 + 13, az), TOWER_IDS.roof, '14 档檐板 dy13');
  assert.strictEqual(k.cell(ax, y0 + 14, az), 0, '14 档 dy14 空');
  assert.strictEqual(k.cell(ax, y0 + 15, az), 0, '14 档 dy15 空');
});

test('逐朝向·tower-belfry: 门叶/门楣/前窗随 face 旋转(face0=south 前沿 +dz), mirror 翻转 dx', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* face0=south: 门 (0,2,+2)/楣 (0,4,+2)/窗 (0..1,6..7,+2) */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'south'});
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), TOWER_IDS.door, 'south 门叶 z+2');
  assert.strictEqual(k.cell(ax, y0 + 4, az + 2), TOWER_IDS.trim, 'south 门楣 z+2');
  assert.strictEqual(k.cell(ax + 1, y0 + 6, az + 2), TOWER_IDS.window, 'south 前窗 (1,6)');
  /* west: (dx,dz)->(-dz,dx): 塔身域转 [−2,1]², 前沿 x−2; 门 (0,2)→(−2,0) */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'west'});
  assert.strictEqual(k.cell(ax - 2, y0 + 2, az), TOWER_IDS.door, 'west 门叶 x−2');
  assert.strictEqual(k.cell(ax - 2, y0 + 4, az), TOWER_IDS.trim, 'west 门楣 x−2');
  /* north: (-dx,-dz): 塔身域转 dz∈[−2,1], 前沿 z−2; 门 (0,2)→(0,−2) */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'north'});
  assert.strictEqual(k.cell(ax, y0 + 2, az - 2), TOWER_IDS.door, 'north 门叶 z−2');
  /* east: (dz,-dx): 塔身域转 dx∈[−1,2] dz∈[−2,1], 前沿 x+2; 门 (0,2)→(2,0) */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'east'});
  assert.strictEqual(k.cell(ax + 2, y0 + 2, az), TOWER_IDS.door, 'east 门叶 x+2');
  /* mirror: 先翻 dx 后旋转(south) — 门中轴 dx=0 镜像不动, 旗/窗换侧 */
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'south'});
  assert.strictEqual(k.cell(ax - 2, y0 + 12, az - 1), TOWER_IDS.flag, 'south 旗西后');
  assert.strictEqual(k.cell(ax + 3, y0 + 12, az + 1), TOWER_IDS.flag, 'south 旗东前');
  k.clear(); k.pf.place('tower-belfry', ax, y0, az, {ids: TOWER_IDS, face: 'south', mirror: true});
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), TOWER_IDS.door, 'south+mirror 门中轴仍前沿');
  assert.strictEqual(k.cell(ax - 1, y0 + 6, az + 2), TOWER_IDS.window, 'mirror 前窗翻 (−1,6)');
  assert.strictEqual(k.cell(ax + 2, y0 + 12, az - 1), TOWER_IDS.flag, 'mirror 旗落 (2,−1)(西后镜像)');
  assert.strictEqual(k.cell(ax - 3, y0 + 12, az + 1), TOWER_IDS.flag, 'mirror 旗落 (−3,1)(东前镜像)');
});

test('确定性: tower-belfry 同参两次逐字节一致(多朝向×变体)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS}),
    () => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, face: 'east', mirror: true, heightTier: 15}),
    () => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, face: 'north', heightTier: 14, flags: false}),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档·tower-belfry: 未知 v 键(旧 openBelfry/hasDoorNiche 拒收)/ids 子键/face 非法→throw; heightTier 钳域 14..16(数值域)', () => {
  const k = loadKit();
  assert.throws(() => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, facee: 'north'}),
      /v 键/, '未知 v 键');
  assert.throws(() => k.pf.footOf('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, foo: 1}),
      /v 键/, 'footOf 同走未知 v 键检');
  assert.throws(() => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, openBelfry: true}),
      /v 键/, '旧键 openBelfry 已删(v2 钟亭恒开敞, 拼写域拒收)');
  assert.throws(() => k.pf.place('tower-belfry', 80, 24, 80, {ids: TOWER_IDS, hasDoorNiche: false}),
      /v 键/, '旧键 hasDoorNiche 已删(v2 真门叶两格, 拼写域拒收)');
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

/* ids 槽子键白名单(§4.2): 全互异显式注入, 逐槽可判读(不依赖实现缺省裸数字)。
   v2 扩槽 plaster(石英抹灰门脸)/awningTrim(布幔上滚边), 与 kernel/defaults
   同步(行键⊆缺省键 pfMerge 校验的测试侧同源) */
const SHOP_IDS = {
  base: 110, wall: 111, plaster: 119, trim: 113, roof: 112, awning: 114,
  awningTrim: 126, signBg: 115, signAccent: 116, glow: 117, window: 118,
};

/* 局部系契约(字面域钉死, 防宽度漂移): face0=south 店面朝 +dz; 锚=店身地面中心
   投影(偶宽 NW 偏置同 pfSpan 约定: 宽 10→dx∈[-5,4], 深 8→dz∈[-4,3])。
   dy0 地台=店身 10×8+前廊外延 dz=4(共 10×9); dy1..4 店身墙环(四角 trim 角柱·
   前立面抹灰门脸·侧后木板墙·门洞 2w×3h dx∈[-1,0]·橱窗 2w×2h dx∈[-4,-3]与
   [2,3] dy3..4+窗台 dy2 光带)·前廊柱廊 dz=4(柱 dy1..3 dx∈{-5,-2,1,4}+dy4
   横梁全宽); dy5 檐层=店身 roof+前廊遮檐 dz=4 全宽 awning 天蓝主幔; dy6 阶梯
   顶内缩 8×6+布幔上滚边 dz=4 awningTrim; dy7 招牌宽 6(dx∈[-3,2])挑出前廊上空
   dz=4(端框 2+板/徽 4); dy≥8 无物。红线: 无熔岩/火方块语义, glow 仅窗台暖光
   意象(§4.2/§8)。 */

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

test('形状·shop-awning: 地台 10×9/墙环 dy1..4 抹灰门脸混搭/门洞 2w×3h/橱窗+窗台光带/柱廊/檐层+双层布幔/内缩顶/招牌(缺省)', () => {
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
  /* dy=1..3 店身墙环+前廊柱(周界实/内域空/环外仅柱位实): 柱 dz=4 dx∈{-5,-2,1,4} */
  for (let dy = 1; dy <= 3; dy++) {
    for (let dx = -7; dx <= 6; dx++) {
      for (let dz = -6; dz <= 6; dz++) {
        const onRing = dx >= -5 && dx <= 4 && dz >= -4 && dz <= 3 &&
            (dx === -5 || dx === 4 || dz === -4 || dz === 3);
        const isPost = dz === 4 && (dx === -5 || dx === -2 || dx === 1 || dx === 4);
        const id = k.cell(ax + dx, y0 + dy, az + dz);
        if (!onRing && !isPost) {
          assert.strictEqual(id, 0, 'dy' + dy + ' 环外空 (' + dx + ',' + dz + ')');
          continue;
        }
        /* 门洞 2w×3h 敞开格(缺省 doorOpen=true)豁免「周界实」(T-PREFAB-02 先例) */
        const doorHole = dz === 3 && dx >= -1 && dx <= 0 && dy <= 3;
        if (!doorHole) {
          assert.notStrictEqual(id, 0, 'dy' + dy + ' 周界/柱实 (' + dx + ',' + dz + ')');
        }
      }
    }
    for (let dx = -4; dx <= 3; dx++) {
      for (let dz = -3; dz <= 2; dz++) {
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), 0, '店身 dy' + dy + ' 内域空');
      }
    }
  }
  /* 墙环材质全钉(v2 三段式): 四角 trim 角柱·前立面(dz=3)抹灰门脸+橱窗/
     窗台光带/门洞·侧后墙 wall; 前廊柱(dy1..3 四柱)与横梁(dy4 全宽)全 trim。
     注意 onRing 带 dz∈[-4,3] 域限制(柱位 dz=4 在店身域外, 不可并入环判定) */
  for (let dy = 1; dy <= 4; dy++) {
    for (let dx = -5; dx <= 4; dx++) {
      for (const dz of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
        const inShop = dz >= -4 && dz <= 3;
        const corner = inShop && (dx === -5 || dx === 4) && (dz === -4 || dz === 3);
        const onRing = inShop && (corner || dx === -5 || dx === 4 || dz === -4 || dz === 3);
        const postOrBeam = dz === 4 && (dy <= 3 ?
          (dx === -5 || dx === -2 || dx === 1 || dx === 4) : true);
        if (!onRing && !postOrBeam) continue;
        let want;
        if (postOrBeam && !onRing) {
          want = SHOP_IDS.trim; /* 前廊柱/横梁(纯 dz=4 域) */
        } else if (corner) {
          want = SHOP_IDS.trim;
        } else if (dz === 3) {/* 前立面门脸地图(后写覆写) */
          const win = (dx >= -4 && dx <= -3) || (dx >= 2 && dx <= 3);
          if (win && dy >= 3) want = SHOP_IDS.window; /* 橱窗玻璃板 dy3..4 */
          else if (win && dy === 2) {
            want = SHOP_IDS.glow; /* 窗台内藏暖光带 dy2(warm 缺省) */
          } else if (dx >= -1 && dx <= 0 && dy <= 3) want = 0; /* 门洞 2w×3h 敞开 */
          else want = SHOP_IDS.plaster; /* 抹灰门脸 */
        } else {
          want = SHOP_IDS.wall; /* 侧后木板墙 */
        }
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), want,
            '墙环/柱廊材质 dy' + dy + ' (' + dx + ',' + dz + ')');
      }
    }
  }
  /* dy=5 檐层: 店身 10×8 roof + 前廊遮檐 dz=4 全宽 awning 天蓝主幔, 域外空 */
  for (let dx = -7; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      let want = 0;
      if (dx >= -5 && dx <= 4 && dz >= -4 && dz <= 3) want = SHOP_IDS.roof;
      if (dx >= -5 && dx <= 4 && dz === 4) want = SHOP_IDS.awning;
      assert.strictEqual(k.cell(ax + dx, y0 + 5, az + dz), want, '檐层 dy5 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=6: 阶梯顶内缩一圈 8×6 roof + 前廊上滚边 dz=4 awningTrim(双层布幔), 其余全空 */
  for (let dx = -7; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      let want = 0;
      if (dx >= -4 && dx <= 3 && dz >= -3 && dz <= 2) want = SHOP_IDS.roof;
      if (dx >= -5 && dx <= 4 && dz === 4) want = SHOP_IDS.awningTrim;
      assert.strictEqual(k.cell(ax + dx, y0 + 6, az + dz), want, 'dy6 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=7 招牌层: 横向板体恰宽 6(dx∈[-3,2])×1 厚挑出 dz=4——v2 端框 2 格 trim
     +中段板/徽(icon: dx∈[-1,0]=signAccent 白徽 2 格+signBg 底板 2 格); 板外全空;
     dy=8 全空(封顶于 7) */
  let accent = 0; let bg = 0; let frameEnd = 0;
  for (let dx = -7; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const id = k.cell(ax + dx, y0 + 7, az + dz);
      const onBoard = dx >= -3 && dx <= 2 && dz === 4;
      if (onBoard) {
        assert.ok(id === SHOP_IDS.signBg || id === SHOP_IDS.signAccent ||
            id === SHOP_IDS.trim, '招牌板 dy7 (' + dx + ',' + dz + ') ∈ {端框,板,徽}');
        if (id === SHOP_IDS.signAccent) accent++;
        if (id === SHOP_IDS.signBg) bg++;
        if (id === SHOP_IDS.trim) frameEnd++;
      } else {
        assert.strictEqual(id, 0, '招牌层 dy7 板外空 (' + dx + ',' + dz + ')');
      }
      assert.strictEqual(k.cell(ax + dx, y0 + 8, az + dz), 0, 'dy8 全空(封顶于 dy7)');
    }
  }
  assert.strictEqual(accent + bg + frameEnd, 6, '招牌板恰 6 格宽(宽 6-7 居中, 本契约钉 6)');
  assert.strictEqual(frameEnd, 2, 'v2 端框恰 2 格(dx=-3 与 dx=2)');
  assert.ok(accent >= 1 && bg >= 1, 'icon 变体: 板上有 signAccent 徽区且有 signBg 底板');
});

test('形状·shop-awning 变体: 关门补抹灰/无暖光窗台落灰且全场零 glow/素招牌中段全板零徽端框仍在(去威胁红线)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* doorOpen=false: 门洞 2w×3h 补 plaster 抹灰(无敞开感), 其余几何不动(窗/角柱/柱廊抽查) */
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, doorOpen: false});
  for (let dy = 1; dy <= 3; dy++) {
    for (const dx of [-1, 0]) {
      assert.strictEqual(k.cell(ax + dx, y0 + dy, az + 3), SHOP_IDS.plaster,
          '关门: 门洞补抹灰 dy' + dy + ' dx' + dx);
    }
  }
  assert.strictEqual(k.cell(ax - 4, y0 + 3, az + 3), SHOP_IDS.window, '关门款橱窗玻璃不变(左)');
  assert.strictEqual(k.cell(ax + 3, y0 + 4, az + 3), SHOP_IDS.window, '关门款橱窗玻璃不变(右)');
  assert.strictEqual(k.cell(ax - 4, y0 + 2, az + 3), SHOP_IDS.glow, '关门款窗台光带不变(左)');
  assert.strictEqual(k.cell(ax - 5, y0 + 2, az + 3), SHOP_IDS.trim, '关门款角柱不变');
  assert.strictEqual(k.cell(ax - 2, y0 + 2, az + 4), SHOP_IDS.trim, '关门款廊柱不变');
  assert.strictEqual(k.cell(ax, y0, az + 4), SHOP_IDS.base, '关门款前廊地台不变');
  /* windowGlow=none: 窗台 dy2 四格落 plaster 抹灰, 全场零 glow 块(暖光意象关闭);
     橱窗玻璃板 dy3..4 与门洞开合互不相干(windowGlow 独立轴) */
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, windowGlow: 'none'});
  for (const dx of [-4, -3, 2, 3]) {
    assert.strictEqual(k.cell(ax + dx, y0 + 2, az + 3), SHOP_IDS.plaster,
        '无暖光: 窗台落抹灰 dx' + dx);
    assert.strictEqual(k.cell(ax + dx, y0 + 3, az + 3), SHOP_IDS.window,
        '无暖光: 橱窗玻璃板不动 dy3 dx' + dx);
  }
  assert.ok(!k.snap().includes(SHOP_IDS.glow), 'windowGlow=none 全场零 glow 块');
  assert.strictEqual(k.cell(ax - 1, y0 + 2, az + 3), 0, '无暖光款门洞仍敞开(doorOpen 独立轴)');
  /* signVariant=blank: 招牌中段(dx∈[-2,1])全 signBg 零 signAccent(徽退场);
     端框 dx∈{-3,2} trim 仍在(端框属板体骨架, 不随 icon 开关) */
  k.clear();
  k.pf.place('shop-awning', ax, y0, az, {ids: SHOP_IDS, signVariant: 'blank'});
  for (const dx of [-2, -1, 0, 1]) {
    assert.strictEqual(k.cell(ax + dx, y0 + 7, az + 4), SHOP_IDS.signBg,
        '素招牌: 中段全底板 dx' + dx);
  }
  assert.ok(!k.snap().includes(SHOP_IDS.signAccent), 'blank 变体全场零 signAccent');
  for (const dx of [-3, 2]) {
    assert.strictEqual(k.cell(ax + dx, y0 + 7, az + 4), SHOP_IDS.trim,
        '素招牌: 端框仍在 dx' + dx);
  }
  assert.ok(k.snap().includes(SHOP_IDS.signBg), 'blank 板体仍在(防整板消失假绿)');
});

test('逐朝向·shop-awning: 门洞/遮檐/招牌随 face 旋转(face0=south 朝 +dz), mirror 翻 dx 非对称差分', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* 手算表: k1(west)=(dx,dz)→(-dz,dx) · k2(north)=(-dx,-dz) · k3(east)=(dz,-dx);
     门洞局部 (dx∈[-1,0], dy1..3, dz=3) · 遮檐 (·, 5, 4) · 招牌板 (dx∈[-3,2], 7, 4) */
  const onBoard = (id) => id === SHOP_IDS.signBg || id === SHOP_IDS.signAccent ||
    id === SHOP_IDS.trim;
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
    assert.strictEqual(board, 6, face + ' 招牌板宽 6 随朝向旋转(含端框)');
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
  assert.strictEqual(k.cell(79, y0 + 2, 83), SHOP_IDS.plaster, 'south+mirror 门洞左格翻成抹灰墙');
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
      /windowGlow/, 'windowGlow 枚举非法(暖光意象仅 warm/none, 禁火语义)');
  assert.throws(() => k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, signVariant: 'text'}),
      /signVariant/, 'signVariant 枚举非法(文字不硬编码几何, 仅 icon/blank)');
  /* 第二档(布尔轴收放不炸): doorOpen 非布尔按真值钳 */
  k.clear();
  k.pf.place('shop-awning', 80, 24, 80, {ids: SHOP_IDS, doorOpen: 0});
  assert.strictEqual(k.cell(79, 25, 83), SHOP_IDS.plaster, 'doorOpen=0 钳 false: 门洞补抹灰');
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

/* ============ T-PREFAB-04 windmill-tower(风车塔, 新增行) ============ */

/* ids 槽子键白名单(总纲 §2 字库 v2): 全 7 键互异显式注入, 逐槽可判读(不依赖
   实现缺省裸数字)。去威胁钉: 机械件无光/火语义槽位(白名单无 torch/glow, §8 红线) */
const WIND_IDS = {
  base: 230, wall: 231, roof: 232, trim: 233, blade: 234, axle: 235, accent: 236,
};

/* 局部系契约(字面域钉死, 防宽度漂移): face0=south 叶轮面朝 +dz; 锚=塔基地面
   中心投影(偶宽 6 NW 偏置同 pfSpan 口径: 6→dx,dz∈[-3,2], 宽=2−(−3)+1=6,
   中心偏置 −0.5; 5×5 奇宽居中 [-2,2]², 4×4 [-2,1]², 2×2 [-1,0]² 同口径)。
   dy0 基座=恰 6×6 实心板; dy1..4 塔身 5×5 实心 dy3 箍带=周界 trim;
   dy5..7 塔身 4×4 实心 dy6 箍带同; dy8 檐层=4×4 roof; dy9 锥顶=2×2 roof;
   dy10 锥尖=单格 roof(三级收分, v2 新增); 门洞 1w×2h 局部 (0,dy1..2,2)=空气,
   小窗 (0,4,2)=trim。叶片组件(sailStatic=true 缺省): 轮面 dz=3(塔前沿外 1 格),
   轴心 axle 3 连格 (0,8,1..3); 十字骨架=石英细肋 accent 单格臂——上 (0,dy,3)
   dy9..8+S/下 dy8−S..7/东 (dx,8,3) dx1..S/西 dx−S..−1; 帆板=木板 blade 单列
   贴肋错位外侧——上 (−1,dy,3) dy10..8+S/下 (1,·) dy8−S..6/东 (dx,9,3) dx2..S/
   西 (dx,7,3) dx−S..−2(「斜格栅」读法); S=4 → 肋16+帆12+轴3=31 组件格,
   总高 13(dy0..12); S=3 → 肋12+帆8+轴3=23, 总高 12。sailStatic=false: 组件
   (肋+帆+轴)整体不入几何(§4.4「资产可分件预留」拍板), 塔体独立成景(含锥尖
   dy10, 盒恰 6×6×11); bladeSpan 不参与动态档几何。footOf: 静态=叶片展向
   保守盒(±S×深 7)∪塔体, y2=max(8+S,10); 动态=纯塔体盒 y2=10。 */
test('脚印包含·windmill-tower: ×4 朝向 × mirror × 变体 — 每笔写 ∈ footOf 同参盒, footOf 零写', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['缺省(静态 span4)', {ids: WIND_IDS}],
    ['span3', {ids: WIND_IDS, bladeSpan: 3}],
    ['动态(false)', {ids: WIND_IDS, sailStatic: false}],
    ['span3+动态', {ids: WIND_IDS, bladeSpan: 3, sailStatic: false}],
    ['换材质(部分注入)', {ids: Object.assign({}, WIND_IDS, {base: 1, blade: 2, axle: 3})}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('windmill-tower', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' + JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('windmill-tower', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
        /* 盒域钉死: 静态 span4 → 平面 9×7(叶轮轴向 9)×高 13; span3 → 7×7×12;
            动态 → 恰 6×6×11(组件退场, 锥尖 dy10 兜底) */
        const spanX = box.x2 - box.x1 + 1;
        const spanZ = box.z2 - box.z1 + 1;
        assert.strictEqual(box.y1, 24, name + ' ' + face + ' footOf 下界=锚层基座 dy0');
        if (vv.sailStatic === false) {
          assert.strictEqual(spanX, 6, name + ' ' + face + ' 动态盒平面恰宽 6');
          assert.strictEqual(spanZ, 6, name + ' ' + face + ' 动态盒平面恰深 6');
          assert.strictEqual(box.y2, 34, name + ' ' + face + ' 动态盒高 11(锥尖 dy10)');
        } else if (vv.bladeSpan === 3) {
          assert.strictEqual(Math.max(spanX, spanZ), 7, name + ' ' + face + ' span3 平面至宽 7');
          assert.strictEqual(Math.min(spanX, spanZ), 7, name + ' ' + face + ' span3 平面至深 7');
          assert.strictEqual(box.y2, 35, name + ' ' + face + ' span3 总高 12(帆顶 dy11)');
        } else {
          assert.strictEqual(Math.max(spanX, spanZ), 9, name + ' ' + face + ' span4 平面至宽 9(±4)');
          assert.strictEqual(Math.min(spanX, spanZ), 7, name + ' ' + face + ' span4 平面至深 7');
          assert.strictEqual(box.y2, 36, name + ' ' + face + ' span4 总高 13(帆顶 dy12)');
        }
      }
    }
  }
});

test('形状·windmill-tower: 基座 6×6/收分塔身 5×5→4×4 逐层钉宽/箍带/锥顶锥尖/门洞小窗/转轴/肋帆叶轮(缺省 span4)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS});
  /* 缺省盒手算值: 叶展 dx±4 · 轮面 dz=3 → dz∈[-3,3] · dy0..12(总高 13) */
  assert.deepStrictEqual({...k.pf.footOf('windmill-tower', ax, y0, az, {ids: WIND_IDS})},
      {x1: 76, y1: 24, z1: 77, x2: 84, y2: 36, z2: 83}, '缺省脚印盒=手算盒');
  /* 逐层 want 制全扫描(dx,dz∈[-5,5]): 塔体先写, 叶片组件后写覆写(序即几何) */
  const inRect = (dx, dz, lo, hi) => dx >= lo && dx <= hi && dz >= lo && dz <= hi;
  const onEdge = (dx, dz, lo, hi) => dx === lo || dx === hi || dz === lo || dz === hi;
  for (let dy = 0; dy <= 13; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      for (let dz = -5; dz <= 5; dz++) {
        let want = 0;
        if (dy === 0) {/* 基座恰 6×6 */
          if (inRect(dx, dz, -3, 2)) want = WIND_IDS.base;
        } else if (dy <= 4) {/* 塔身 5×5 段(dy1..4) */
          if (inRect(dx, dz, -2, 2)) {
            want = WIND_IDS.wall;
            if (dy === 3 && onEdge(dx, dz, -2, 2)) want = WIND_IDS.trim; /* dy3 箍带周界 */
            if (dx === 0 && dz === 2 && dy <= 2) want = 0; /* 门洞 1w×2h */
            if (dx === 0 && dz === 2 && dy === 4) want = WIND_IDS.trim; /* 小窗 y4 */
          }
        } else if (dy <= 7) {/* 塔身 4×4 段(dy5..7) */
          if (inRect(dx, dz, -2, 1)) {
            want = WIND_IDS.wall;
            if (dy === 6 && onEdge(dx, dz, -2, 1)) want = WIND_IDS.trim; /* dy6 箍带周界 */
          }
        } else if (dy === 8) {/* 檐层 4×4 */
          if (inRect(dx, dz, -2, 1)) want = WIND_IDS.roof;
        } else if (dy === 9) {/* 锥顶 2×2 */
          if (inRect(dx, dz, -1, 0)) want = WIND_IDS.roof;
        } else if (dy === 10) {/* 锥尖单格(v2 三级收分) */
          if (dx === 0 && dz === 0) want = WIND_IDS.roof;
        }
        /* 叶片组件(缺省在位, S=4): 轴 3 连格 dz1..3@dy8; 十字肋 accent——
            上 (0,9..12,3)/下 (0,4..7,3)/东 (1..4,8,3)/西 (-4..-1,8,3);
            帆 blade 错位单列——上 (-1,10..12,3)/下 (1,4..6,3)/东 (2..4,9,3)/
            西 (-4..-2,7,3) */
        if (dy === 8 && dx === 0 && dz >= 1 && dz <= 3) want = WIND_IDS.axle;
        if (dz === 3) {
          if (dx === 0 && dy >= 4 && dy <= 7) want = WIND_IDS.accent; /* 下臂肋 */
          if (dx === 0 && dy >= 9 && dy <= 12) want = WIND_IDS.accent; /* 上臂肋 */
          if (dy === 8 && dx >= 1 && dx <= 4) want = WIND_IDS.accent; /* 东臂肋 */
          if (dy === 8 && dx >= -4 && dx <= -1) want = WIND_IDS.accent; /* 西臂肋 */
          if (dx === 1 && dy >= 4 && dy <= 6) want = WIND_IDS.blade; /* 下臂帆 */
          if (dx === -1 && dy >= 10 && dy <= 12) want = WIND_IDS.blade; /* 上臂帆 */
          if (dy === 9 && dx >= 2 && dx <= 4) want = WIND_IDS.blade; /* 东臂帆 */
          if (dy === 7 && dx >= -4 && dx <= -2) want = WIND_IDS.blade; /* 西臂帆 */
        }
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), want,
            '逐层 dy' + dy + ' (' + dx + ',' + dz + ')');
      }
    }
  }
  /* 计数第二意见: 肋恰 16 · 帆恰 12 · 轴恰 3(S=4 手算并集——肋单格臂与帆
     错位列不相交, 与旧版「臂宽2 共享角格」的 31 并集口径不同, v2 无共格) */
  let ribs = 0; let sails = 0; let axles = 0;
  for (const b of k.snap()) {
    if (b === WIND_IDS.accent) ribs++;
    if (b === WIND_IDS.blade) sails++;
    if (b === WIND_IDS.axle) axles++;
  }
  assert.strictEqual(ribs, 16, '石英肋恰 16 格(上4+下4+东4+西4)');
  assert.strictEqual(sails, 12, '木板帆恰 12 格(上3+下3+东3+西3, 错位单列)');
  assert.strictEqual(axles, 3, '南瓜轴恰 3 格(根覆写檐+连杆+轮心)');
});

test('形状·windmill-tower 变体: sailStatic=false 叶片组件整体退场(零 blade 零 accent 零 axle)/span3 肋帆收短(防假绿)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* sailStatic=false: 叶片组件(肋+帆+轴)整体不入几何(§4.4「资产可分件预留」),
     塔体/锥顶/门洞小窗不动; 盒收到恰 6×6×11(锥尖 dy10 兜底) */
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS, sailStatic: false});
  assert.ok(!k.snap().includes(WIND_IDS.blade), '动态档全场零 blade 块');
  assert.ok(!k.snap().includes(WIND_IDS.accent), '动态档全场零 accent 块(肋随组件退场)');
  assert.ok(!k.snap().includes(WIND_IDS.axle), '动态档全场零 axle 块(组件整体退场)');
  assert.strictEqual(k.cell(ax, y0 + 1, az + 2), 0, '动态档门洞仍在(塔体不动)');
  assert.strictEqual(k.cell(ax, y0 + 4, az + 2), WIND_IDS.trim, '动态档小窗仍在');
  assert.strictEqual(k.cell(ax, y0 + 10, az), WIND_IDS.roof, '动态档锥尖 dy10 仍在(塔体独立成景)');
  assert.deepStrictEqual(
      {...k.pf.footOf('windmill-tower', ax, y0, az, {ids: WIND_IDS, sailStatic: false})},
      {x1: 77, y1: 24, z1: 77, x2: 82, y2: 34, z2: 82}, '动态档盒=手算盒(恰 6×6×11)');
  assert.ok(k.snap().includes(WIND_IDS.roof), '动态档 roof 块仍在(防全空假绿)');
  /* bladeSpan 不参与动态档几何: span3+false 与 span4+false 逐字节同形 */
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS, sailStatic: false, bladeSpan: 3});
  const dynS3 = k.snap();
  assert.ok(dynS3.some((b) => b !== 0), '动态档场内确有方块');
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS, sailStatic: false});
  assert.ok(dynS3.equals(k.snap()), '动态档 bladeSpan 不改几何(同形)');
  /* span3(S=3): 上肋顶收到 dy11/上帆顶 dy11/下肋底 dy5/东臂收到 dx3, dy12 零;
     盒收 7×7×12(y2=35) */
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS, bladeSpan: 3});
  assert.strictEqual(k.cell(ax, y0 + 11, az + 3), WIND_IDS.accent, 'span3 上肋顶 dy11');
  assert.strictEqual(k.cell(ax, y0 + 12, az + 3), 0, 'span3 dy12 无肋');
  assert.strictEqual(k.cell(ax - 1, y0 + 11, az + 3), WIND_IDS.blade, 'span3 上帆顶 dy11');
  assert.strictEqual(k.cell(ax - 1, y0 + 12, az + 3), 0, 'span3 dy12 无帆');
  assert.strictEqual(k.cell(ax, y0 + 5, az + 3), WIND_IDS.accent, 'span3 下肋底 dy5');
  assert.strictEqual(k.cell(ax, y0 + 4, az + 3), 0, 'span3 dy4 无肋');
  assert.strictEqual(k.cell(ax + 3, y0 + 8, az + 3), WIND_IDS.accent, 'span3 东肋至 dx3');
  assert.strictEqual(k.cell(ax + 4, y0 + 8, az + 3), 0, 'span3 东肋 dx4 无');
  assert.strictEqual(k.cell(ax + 3, y0 + 9, az + 3), WIND_IDS.blade, 'span3 东帆至 dx3(肋上错位)');
  assert.strictEqual(k.cell(ax, y0 + 8, az + 3), WIND_IDS.axle, 'span3 轮心不动');
  assert.deepStrictEqual(
      {...k.pf.footOf('windmill-tower', ax, y0, az, {ids: WIND_IDS, bladeSpan: 3})},
      {x1: 77, y1: 24, z1: 77, x2: 83, y2: 35, z2: 83}, 'span3 盒=手算盒(7×7×12)');
});

test('叶展计入·windmill-tower: 静态盒=动态塔体盒∪叶片展向保守盒, 叶尖格∈盒(south/east 手算差分)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* 手算表: 静态 span4 盒(含叶展) · 动态盒(纯塔体, 锥尖 dy10 兜底 y2=34) ·
     上臂帆顶叶尖 · 东臂帆外叶尖(v2 帆单列错位: 东帆外=(4,9,3) 肋上错位;
     k3(east)=(dz,-dx): 塔体 [-3,2]²→x∈[77,82]×z∈[78,83], 叶展 [-4,4]×[-3,3]→
     x∈[77,83]×z∈[76,84]) */
  const cases = [
    ['south', {x1: 76, y1: 24, z1: 77, x2: 84, y2: 36, z2: 83},
      {x1: 77, y1: 24, z1: 77, x2: 82, y2: 34, z2: 82}, [79, 36, 83], [84, 33, 83]],
    ['east', {x1: 77, y1: 24, z1: 76, x2: 83, y2: 36, z2: 84},
      {x1: 77, y1: 24, z1: 78, x2: 82, y2: 34, z2: 83}, [83, 36, 81], [83, 33, 76]],
  ];
  for (const [face, statBox, dynBox, tipUp, tipEast] of cases) {
    const sv = {ids: WIND_IDS, face};
    const dv = {ids: WIND_IDS, face, sailStatic: false};
    assert.deepStrictEqual({...k.pf.footOf('windmill-tower', ax, y0, az, sv)}, statBox,
        face + ' 静态盒=手算盒(叶片展向计入)');
    assert.deepStrictEqual({...k.pf.footOf('windmill-tower', ax, y0, az, dv)}, dynBox,
        face + ' 动态盒=手算盒(纯塔体)');
    /* 独立差分: 静态盒 ⊇ 动态盒且总高严格更大——叶展(±4×高 13)恰是静态盒
       比动态盒多出的保守域 */
    assert.ok(statBox.x1 <= dynBox.x1 && statBox.x2 >= dynBox.x2 &&
        statBox.z1 <= dynBox.z1 && statBox.z2 >= dynBox.z2 && statBox.y2 > dynBox.y2,
    face + ' 静态盒包含动态盒且更高(帆顶 dy12 > 锥尖 dy10)');
    const statSpan = Math.max(statBox.x2 - statBox.x1, statBox.z2 - statBox.z1);
    const dynSpan = Math.max(dynBox.x2 - dynBox.x1, dynBox.z2 - dynBox.z1);
    assert.ok(statSpan > dynSpan, face + ' 静态平面外廓 9 > 纯塔体 6(叶展计入)');
    /* 叶尖格实测落盒(保守盒恰覆盖叶尖可达域) */
    k.clear();
    const box = k.pf.place('windmill-tower', ax, y0, az, sv);
    for (const t of [tipUp, tipEast]) {
      assert.ok(t[0] >= box.x1 && t[0] <= box.x2 && t[1] >= box.y1 && t[1] <= box.y2 &&
          t[2] >= box.z1 && t[2] <= box.z2, face + ' 叶尖格 ' + t + ' ∈ footOf 盒');
    }
  }
});

test('逐朝向·windmill-tower: 门洞/小窗/轮心/肋帆叶尖随 face 旋转(face0=south 轮面朝 +dz), mirror 翻 dx 非对称差分', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* 手算表: k1(west)=(dx,dz)→(-dz,dx) · k2(north)=(-dx,-dz) · k3(east)=(dz,-dx);
     门洞局部 (0,dy1..2,2) · 小窗 (0,4,2) · 轮心 (0,8,3) · 上臂肋顶 (0,12,3) ·
     上臂帆顶 (-1,12,3) · 东臂肋外 (4,8,3) · 东臂帆外 (4,9,3) */
  const faces = [ /* [face, 门洞格, 小窗格, 轮心格, 上肋顶, 上帆顶, 东肋外, 东帆外] */
    ['west', [78, 80], [78, 28, 80], [77, 32, 80], [77, 36, 80], [77, 36, 79], [77, 32, 84], [77, 33, 84]],
    ['north', [80, 78], [80, 28, 78], [80, 32, 77], [80, 36, 77], [81, 36, 77], [76, 32, 77], [76, 33, 77]],
    ['east', [82, 80], [82, 28, 80], [83, 32, 80], [83, 36, 80], [83, 36, 81], [83, 32, 76], [83, 33, 76]],
  ];
  for (const [face, door, win, hub, ribTop, sailTop, ribEast, sailEast] of faces) {
    k.clear();
    k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS, face});
    for (const dy of [1, 2]) {
      assert.strictEqual(k.cell(door[0], y0 + dy, door[1]), 0, face + ' 门洞 y' + dy);
    }
    assert.strictEqual(k.cell(win[0], win[1], win[2]), WIND_IDS.trim, face + ' 小窗 dy4');
    assert.strictEqual(k.cell(hub[0], hub[1], hub[2]), WIND_IDS.axle, face + ' 轮心 dy8');
    assert.strictEqual(k.cell(ribTop[0], ribTop[1], ribTop[2]), WIND_IDS.accent,
        face + ' 上臂肋顶(十字骨架随轮面旋转)');
    assert.strictEqual(k.cell(sailTop[0], sailTop[1], sailTop[2]), WIND_IDS.blade,
        face + ' 上臂帆顶(错位单列随轮面旋转)');
    assert.strictEqual(k.cell(ribEast[0], ribEast[1], ribEast[2]), WIND_IDS.accent,
        face + ' 东臂肋外');
    assert.strictEqual(k.cell(sailEast[0], sailEast[1], sailEast[2]), WIND_IDS.blade,
        face + ' 东臂帆外(肋上错位)');
  }
  /* south 恒等基线: 门洞/小窗在 z+2 前沿, 基座西缘在 dx-3/东缘外 dx3 */
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS, face: 'south'});
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), 0, 'south 门洞在 z+2 中轴');
  assert.strictEqual(k.cell(ax, y0 + 4, az + 2), WIND_IDS.trim, 'south 小窗在 z+2 中轴');
  assert.strictEqual(k.cell(ax - 3, y0, az), WIND_IDS.base, 'south 基座西缘=dx-3');
  assert.strictEqual(k.cell(ax + 3, y0, az), 0, 'south 基座东缘外(dx3 域外)');
  /* mirror 非对称差分(帆列偏置 [-1]/[1] 与偶宽塔体 [-3,2] 各自关于 dx=0 不对称):
     先翻 dx 后旋转——上臂帆西列翻到东列, 基座西让东补; 门洞/小窗/轮心/肋在
     dx=0 中轴 mirror 不动(轴上格不变式) */
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS, face: 'south', mirror: true});
  assert.strictEqual(k.cell(ax - 1, y0 + 12, az + 3), 0, 'south+mirror 上臂帆西列翻走');
  assert.strictEqual(k.cell(ax + 1, y0 + 12, az + 3), WIND_IDS.blade,
      'south+mirror 上臂帆翻到东列');
  assert.strictEqual(k.cell(ax, y0 + 12, az + 3), WIND_IDS.accent,
      'south+mirror 上臂肋中轴列在(肋 dx=0 不变式)');
  assert.strictEqual(k.cell(ax + 3, y0, az), WIND_IDS.base, 'south+mirror 基座东移(dx3 入域)');
  assert.strictEqual(k.cell(ax - 3, y0, az), 0, 'south+mirror 基座西让(dx-3 出域)');
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), 0, 'south+mirror 门洞仍在中轴');
  assert.strictEqual(k.cell(ax, y0 + 8, az + 3), WIND_IDS.axle, 'south+mirror 轮心仍在中轴');
  /* east+mirror: 轮心中轴不变式跨朝向成立; 上臂帆顶 (83,36,81) 翻到 (83,36,79) */
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az, {ids: WIND_IDS, face: 'east', mirror: true});
  assert.strictEqual(k.cell(83, 32, 80), WIND_IDS.axle, 'east+mirror 轮心仍在轮面中轴');
  assert.strictEqual(k.cell(83, 36, 79), WIND_IDS.blade, 'east+mirror 上臂帆顶翻到北侧');
  assert.strictEqual(k.cell(83, 36, 81), 0, 'east+mirror 原上臂帆顶位翻走');
});

test('确定性: windmill-tower 同参两次逐字节一致(多朝向×变体)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS}),
    () => k.pf.place('windmill-tower', 80, 24, 80,
        {ids: WIND_IDS, face: 'east', mirror: true, bladeSpan: 3}),
    () => k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, face: 'north', sailStatic: false}),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档·windmill-tower: 未知 v 键/ids 子键(含 torch/glow 去威胁钉)/face 非法→throw; sailStatic 钳布尔 bladeSpan 钳域 3..4', () => {
  const k = loadKit();
  /* 第一档(装场期炸=拼写防火墙): place 与 footOf 同走合并校验路径 */
  assert.throws(() => k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, sails: 4}),
      /v 键/, '未知 v 键(拼写)');
  assert.throws(() => k.pf.footOf('windmill-tower', 80, 24, 80, {ids: WIND_IDS, foo: 1}),
      /v 键/, 'footOf 同走未知 v 键检');
  assert.throws(() => k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, face: 'up'}),
      /face/, 'face 非法');
  assert.throws(() => k.pf.place('windmill-tower', 80, 24, 80,
      {ids: Object.assign({}, WIND_IDS, {bladex: 1})}), /ids/, 'ids 未知子键');
  /* 去威胁钉(§4.4/§8): 机械件无光/火语义槽位——torch/glow 子键不在白名单即炸 */
  assert.throws(() => k.pf.place('windmill-tower', 80, 24, 80,
      {ids: Object.assign({}, WIND_IDS, {torch: 48})}), /ids/, '无 torch 槽(零火语义)');
  assert.throws(() => k.pf.place('windmill-tower', 80, 24, 80,
      {ids: Object.assign({}, WIND_IDS, {glow: 19})}), /ids/, '无 glow 槽(零光意象)');
  /* 第二档(布尔/数值档收放不炸): sailStatic 非布尔按真值钳(door 先例);
     bladeSpan 越档钳到边界 3/4(heightTier 档先例) */
  k.clear();
  k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, sailStatic: 0});
  assert.strictEqual(k.cell(80, 32, 83), 0, 'sailStatic=0 钳 false: 轮心位无轴(组件退场)');
  k.clear();
  k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, sailStatic: 1});
  assert.strictEqual(k.cell(80, 32, 83), WIND_IDS.axle, 'sailStatic=1 钳 true: 轮心在位');
  k.clear();
  const bLo = k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, bladeSpan: 1});
  const sLo = k.snap();
  k.clear();
  const b3 = k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, bladeSpan: 3});
  assert.ok(sLo.equals(k.snap()), 'bladeSpan 低于档位钳至 3 同形');
  assert.deepStrictEqual(bLo, b3, '钳后脚印盒一致(低档)');
  k.clear();
  const bHi = k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, bladeSpan: 99});
  const sHi = k.snap();
  k.clear();
  const b4 = k.pf.place('windmill-tower', 80, 24, 80, {ids: WIND_IDS, bladeSpan: 4});
  assert.ok(sHi.equals(k.snap()), 'bladeSpan 高于档位钳至 4 同形');
  assert.deepStrictEqual(bHi, b4, '钳后脚印盒一致(高档)');
});

/* ============ T-PREFAB-05 cottage-gable(民居 A, 新增行) ============ */

/* ids 槽子键白名单(§4.5): 全互异显式注入, 逐槽可判读(不依赖实现缺省裸数字)。
   v2 扩槽 frame(窗框楣)/doorTop(门上叶)/bedGrass·bedFlower1·bedFlower2(墙根
   花坛三格); chimney=后侧装饰烟囱(无烟)材质槽; windowLit 为观感变体开关。 */
const COTTAGE_IDS = {
  base: 140, wall: 141, roof: 142, trim: 143, window: 144, door: 145,
  chimney: 146, frame: 147, doorTop: 148,
  bedGrass: 149, bedFlower1: 150, bedFlower2: 151,
};

/* 局部系契约(对齐票文): face0=south 门窗立面朝 +dz; 锚=小屋地面中心投影。
   偶宽 8 NW 偏置同 pfSpan 口径: dx∈[-4,3]; 奇深 7 居中: dz∈[-3,3](平面恰 8×7)。
   v2 几何: dy0 石砖基座; dy1..3 墙环(四角深木柱)+墙根花坛(前墙根门窗域外
   5 格)+前门 64/65 成对门叶+前窗「框楣 17+玻璃 18」+侧窗; dy4 檐层全覆;
   dy5..6 双坡顶(脊沿 dz: dy5 第二阶 4×5+山墙带, dy6 脊带 2×5+山墙顶尖)+
   后侧装饰烟囱(dy5 圆石身+dy6 深木口, 无烟, 受 hasChimney); windowLit 观感
   开关(缺省 false)。脚印 8×7×高 7(含檐出挑与山墙顶尖)与 footOf 同参同盒。 */

function cottageFootDims(box) {
  return {w: box.x2 - box.x1 + 1, d: box.z2 - box.z1 + 1, h: box.y2 - box.y1 + 1};
}

function cottageFrontDz(box, face) {
  if (face === 'south') return box.z2;
  if (face === 'north') return box.z1;
  if (face === 'east') return box.x2;
  return box.x1; /* west */
}

function cottageRearDz(box, face) {
  if (face === 'south') return box.z1;
  if (face === 'north') return box.z2;
  if (face === 'east') return box.x1;
  return box.x2; /* west */
}

function cottageSideCols(box, face) {
  if (face === 'south' || face === 'north') {
    return {axis: 'x', frontAxis: 'z', min: box.x1, max: box.x2};
  }
  return {axis: 'z', frontAxis: 'x', min: box.z1, max: box.z2};
}

function cellAt(k, axis, frontAxis, av, fv, y) {
  if (axis === 'x' && frontAxis === 'z') return k.cell(av, y, fv);
  return k.cell(fv, y, av);
}

test('脚印包含·cottage-gable: ×4 朝向 × mirror × 变体 — 每笔写 ∈ footOf 同参盒, footOf 零写', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['缺省', {ids: COTTAGE_IDS}],
    ['无烟囱', {ids: COTTAGE_IDS, hasChimney: false}],
    ['窗亮', {ids: COTTAGE_IDS, windowLit: true}],
    ['无烟囱+窗亮', {ids: COTTAGE_IDS, hasChimney: false, windowLit: true}],
    ['换材质(部分注入)', {ids: Object.assign({}, COTTAGE_IDS, {base: 1, roof: 2, chimney: 3})}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('cottage-gable', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' + JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('cottage-gable', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
        const dim = cottageFootDims(box);
        /* 脚印 8×7 × 高 7(含檐出挑/山墙顶尖/烟囱口 dy6)与 foot 一致:
           方角 90° 旋转下平面仍 8×7, 高域恒 7(v2 山墙阶梯与脊带上移一层) */
        assert.strictEqual(Math.max(dim.w, dim.d), 8, name + ' ' + face + ' 平面长边 8');
        assert.strictEqual(Math.min(dim.w, dim.d), 7, name + ' ' + face + ' 平面短边 7');
        assert.strictEqual(box.y1, 24, name + ' ' + face + ' footOf 下界=锚层基座 dy0');
        assert.strictEqual(dim.h, 7, name + ' ' + face + ' footOf 高 7(含檐/山墙顶尖)');
        assert.strictEqual(box.y2, 30, name + ' ' + face + ' footOf 封顶 dy6');
      }
    }
  }
});

test('形状·cottage-gable: 8×7 基座/墙环四角柱 dy1..3/墙根花坛/门 64..65/窗框楣+玻璃/侧窗/檐层/双坡顶+阶梯山墙 dy5..6/烟囱(缺省)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('cottage-gable', ax, y0, az, {ids: COTTAGE_IDS, face: 'south'});
  /* 缺省盒手算值: dx[-4,3]×dz[-3,3]×dy0..6 */
  assert.deepStrictEqual(
      {...k.pf.footOf('cottage-gable', ax, y0, az, {ids: COTTAGE_IDS, face: 'south'})},
      {x1: 76, y1: 24, z1: 77, x2: 83, y2: 30, z2: 83}, '缺省脚印盒=手算盒');
  /* dy=0 基座: 恰 8×7=56 格 base, 域外全空 */
  for (let dx = -6; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      const inPlat = dx >= -4 && dx <= 3 && dz >= -3 && dz <= 3;
      assert.strictEqual(k.cell(ax + dx, y0, az + dz), inPlat ? COTTAGE_IDS.base : 0,
          '基座 dy0 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=1..3 墙环材质全钉: 四角 trim 深木柱/环 wall 木板/内域空; 前立面(dz=3)
     覆写地图: 花坛(门左带 3 格+窗下 2 格)/门 64..65/窗框楣+玻璃 */
  for (let dy = 1; dy <= 3; dy++) {
    for (let dx = -6; dx <= 5; dx++) {
      for (let dz = -5; dz <= 5; dz++) {
        /* onRing 带平面域限制(dx∈[-4,3]×dz∈[-3,3]), 越界格不可并入环判定 */
        const inPlat = dx >= -4 && dx <= 3 && dz >= -3 && dz <= 3;
        const corner = inPlat && (dx === -4 || dx === 3) && (dz === -3 || dz === 3);
        const onRing = inPlat &&
            (corner || dx === -4 || dx === 3 || dz === -3 || dz === 3);
        if (!onRing) {
          assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), 0,
              'dy' + dy + ' 环外空 (' + dx + ',' + dz + ')');
          continue;
        }
        let want = corner ? COTTAGE_IDS.trim : COTTAGE_IDS.wall;
        if (dz === 3) {/* 前立面覆写地图(后写者赢) */
          if (dy === 1) {/* 花坛带+门下叶 */
            if (dx === -4 || dx === -2) want = COTTAGE_IDS.bedGrass;
            if (dx === -3) want = COTTAGE_IDS.bedFlower1;
            if (dx === 1) want = COTTAGE_IDS.bedFlower2;
            if (dx === 2) want = COTTAGE_IDS.bedGrass;
            if (dx === -1) want = COTTAGE_IDS.door;
          }
          if (dy === 2) {/* 玻璃行+门上叶 */
            if (dx === 1 || dx === 2) want = COTTAGE_IDS.window;
            if (dx === -1) want = COTTAGE_IDS.doorTop;
          }
          if (dy === 3 && (dx === 1 || dx === 2)) want = COTTAGE_IDS.frame; /* 框楣行 */
        }
        if (dz === 0 && dx === 3 && dy === 2) want = COTTAGE_IDS.window; /* 侧窗 */
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), want,
            '墙环/立面材质 dy' + dy + ' (' + dx + ',' + dz + ')');
      }
    }
  }
  /* dy=4 檐层: roof 全覆 8×7, 域外全空 */
  for (let dx = -6; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      const inEave = dx >= -4 && dx <= 3 && dz >= -3 && dz <= 3;
      assert.strictEqual(k.cell(ax + dx, y0 + 4, az + dz), inEave ? COTTAGE_IDS.roof : 0,
          '檐层 dy4 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=5 第二阶: roof 4×5(dx∈[-2,1]×dz∈[-2,2])+前后山墙带 wall(dx∈[-2,1]×
     dz=±3)+烟囱身 chimney(dz=-3, dx=-2, 后写覆写山墙带); 其余全空 */
  for (let dx = -6; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      let want = 0;
      if (dx >= -2 && dx <= 1 && dz >= -2 && dz <= 2) want = COTTAGE_IDS.roof;
      if (dx >= -2 && dx <= 1 && (dz === -3 || dz === 3)) want = COTTAGE_IDS.wall;
      if (dx === -2 && dz === -3) want = COTTAGE_IDS.chimney;
      assert.strictEqual(k.cell(ax + dx, y0 + 5, az + dz), want, 'dy5 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=6 脊带+山墙顶尖: roof 2×5(dx∈[-1,0]×dz∈[-2,2])+山墙顶尖
     wall(dx∈[-1,0]×dz=±3)+烟囱口 trim(dz=-3, dx=-2); 其余全空(封顶 dy6) */
  for (let dx = -6; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      let want = 0;
      if (dx >= -1 && dx <= 0 && dz >= -2 && dz <= 2) want = COTTAGE_IDS.roof;
      if (dx >= -1 && dx <= 0 && (dz === -3 || dz === 3)) want = COTTAGE_IDS.wall;
      if (dx === -2 && dz === -3) want = COTTAGE_IDS.trim;
      assert.strictEqual(k.cell(ax + dx, y0 + 6, az + dz), want, 'dy6 (' + dx + ',' + dz + ')');
    }
  }
  /* dy=7 全空(封顶于 dy6, 总高 7) */
  for (let dx = -6; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      assert.strictEqual(k.cell(ax + dx, y0 + 7, az + dz), 0, 'dy7 全空(封顶 dy6)');
    }
  }
  /* 烟囱无烟: 烟囱口正上方无额外非空 */
  assert.strictEqual(k.cell(ax - 2, y0 + 7, az - 3), 0, '烟囱无烟(口上方无块)');
});

test('形状·cottage-gable: hasChimney=false 烟囱双格退场且山墙带补位; windowLit 开关同盒', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('cottage-gable', ax, y0, az, {ids: COTTAGE_IDS, hasChimney: false, face: 'south'});
  /* 烟囱双格(身 dy5+口 dy6)退场: dz=-3 后沿 dx=-2 两层落回山墙带 wall(dy5)与空(dy6) */
  assert.strictEqual(k.cell(ax - 2, y0 + 5, az - 3), COTTAGE_IDS.wall,
      'hasChimney=false: dy5 后沿=山墙带 wall(不露烟囱身)');
  assert.strictEqual(k.cell(ax - 2, y0 + 6, az - 3), 0,
      'hasChimney=false: dy6 后沿空(不露烟囱口)');
  assert.ok(!k.snap().includes(COTTAGE_IDS.chimney), '全场零 chimney 块');
  /* 山墙带其余格不动(dy5 dz=-3 dx∈[-1,0] 仍 wall) */
  assert.strictEqual(k.cell(ax - 1, y0 + 5, az - 3), COTTAGE_IDS.wall, '山墙带 dy5 邻格不动');
  /* windowLit 观感开关: 被接受且与缺省同盒(脚印同形域) */
  k.clear();
  const boxLit = k.pf.place('cottage-gable', ax, y0, az, {ids: COTTAGE_IDS, windowLit: true, face: 'south'});
  const boxDef = k.pf.footOf('cottage-gable', ax, y0, az, {ids: COTTAGE_IDS, windowLit: false, face: 'south'});
  assert.deepStrictEqual(boxLit, boxDef, 'windowLit 观感开关不改变脚印盒(同形域)');
});

test('逐朝向·cottage-gable: 前立面门窗/后侧烟囱随 face 旋转, mirror 不破坏脚印与必需元素', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  for (const face of ['south', 'west', 'north', 'east']) {
    k.clear();
    k.pf.place('cottage-gable', ax, y0, az, {ids: COTTAGE_IDS, face, hasChimney: true});
    const box = k.pf.footOf('cottage-gable', ax, y0, az, {ids: COTTAGE_IDS, face, hasChimney: true});
    const fz = cottageFrontDz(box, face);
    const rz = cottageRearDz(box, face);
    const sc = cottageSideCols(box, face);
    let frontDoor = false; let frontWin = false; let rearChimney = false;
    for (let a = sc.min + 1; a <= sc.max - 1; a++) {
      const d1 = cellAt(k, sc.axis, sc.frontAxis, a, fz, y0 + 1);
      const d2 = cellAt(k, sc.axis, sc.frontAxis, a, fz, y0 + 2);
      /* 门=下叶 door+上叶 doorTop 成对(v2 真门叶) */
      if (d1 === COTTAGE_IDS.door && d2 === COTTAGE_IDS.doorTop) frontDoor = true;
      const w2 = cellAt(k, sc.axis, sc.frontAxis, a, fz, y0 + 2);
      const w3 = cellAt(k, sc.axis, sc.frontAxis, a, fz, y0 + 3);
      if (w2 === COTTAGE_IDS.window || w3 === COTTAGE_IDS.frame) frontWin = true;
      /* 烟囱=身 dy5 chimney+口 dy6 trim(后沿两层任一见即认) */
      if (cellAt(k, sc.axis, sc.frontAxis, a, rz, y0 + 5) === COTTAGE_IDS.chimney ||
          cellAt(k, sc.axis, sc.frontAxis, a, rz, y0 + 6) === COTTAGE_IDS.trim) rearChimney = true;
    }
    assert.ok(frontDoor, face + ' 前立面存在门位(64/65 成对随朝向旋转)');
    assert.ok(frontWin, face + ' 前立面存在窗位(玻璃/框楣随朝向旋转)');
    assert.ok(rearChimney, face + ' 后侧存在烟囱(随朝向旋转)');
  }
  k.clear();
  const b0 = k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, face: 'south', mirror: false});
  k.clear();
  const bm = k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, face: 'south', mirror: true});
  assert.deepStrictEqual(bm, b0, 'mirror 变换保持脚印盒同域(对称 8×7)');
});

test('确定性: cottage-gable 同参两次逐字节一致(多朝向×变体)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS}),
    () => k.pf.place('cottage-gable', 80, 24, 80,
        {ids: COTTAGE_IDS, face: 'east', mirror: true, hasChimney: false}),
    () => k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, face: 'north', windowLit: true}),
    () => k.pf.place('cottage-gable', 80, 24, 80,
        {ids: COTTAGE_IDS, face: 'west', mirror: true, hasChimney: false, windowLit: true}),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档·cottage-gable: 未知 v 键/ids 子键/face 非法→throw; 布尔变体收放', () => {
  const k = loadKit();
  assert.throws(() => k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, facee: 'north'}),
      /v 键/, '未知 v 键');
  assert.throws(() => k.pf.footOf('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, unknown: 1}),
      /v 键/, 'footOf 同走未知 v 键检');
  assert.throws(() => k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, face: 'up'}),
      /face/, 'face 非法');
  assert.throws(() => k.pf.place('cottage-gable', 80, 24, 80,
      {ids: Object.assign({}, COTTAGE_IDS, {roofx: 1})}), /ids/, 'ids 未知子键');
  /* 布尔收放不炸(door/hasChimney 先例): 非布尔按真值钳 */
  k.clear();
  k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, hasChimney: 0});
  const off = k.snap();
  k.clear();
  k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, hasChimney: false});
  assert.ok(off.equals(k.snap()), 'hasChimney=0 钳 false 同形');
  k.clear();
  k.pf.place('cottage-gable', 80, 24, 80, {ids: COTTAGE_IDS, windowLit: 1});
  assert.ok(k.snap().some((v) => v !== 0), 'windowLit 真值可建场(开关被接受)');
});

/* ============ T-PREFAB-06 house-loft(民居 B, 新增行) ============ */

/* ids 槽子键白名单(§4.6): 全互异显式注入, 逐槽可判读(不依赖实现缺省裸数字)。
   v2 扩槽 frame(窗框楣)/doorTop(门上叶)/awning(天蓝布幔: 窗楣+阳台帘栏);
   wallA/wallB=木板前墙/石英抹灰后墙混搭(v2: wallB 5→17 换值); balcony=二层
   前立面小阳台平台材质槽(§7.4「2×1 暖木平台」) */
const LOFT_IDS = {
  base: 150, wallA: 151, wallB: 152, roof: 153, trim: 154,
  window: 155, door: 156, balcony: 157,
  frame: 158, doorTop: 159, awning: 160,
};

/* 局部系契约(对齐票文 §4.6 + buildings-visual-spec §7.4): face0=south 门窗立面
   朝 +dz; 锚=地面中心投影。偶宽 NW 偏置同 pfSpan 口径(shop-awning 同尺寸
   10×8 先例): 宽 10→dx∈[-5,4], 深 8→dz∈[-4,3](平面恰 10×8)。
   v2 几何: dy0 石砖基座 10×8 实心; dy1..3 一层墙环(四角深木柱/后墙石英抹灰
   wallB/前侧+侧山墙木板 wallA)+前门 64/65 成对门叶+一层前窗(玻璃 dy2+框楣
   dy3, 框楣可覆天蓝布幔 awningAccent)+东侧窗; dy4..6 二层内缩一圈 8×6 墙环+
   二层窗组①真挑窗(dx∈[-3,-2]: dy4 trim 托架+dy5..6 窗体外挑 dz=3)+组②阳台
   落地窗(dx∈[1,2], dz=2)+前立面外挑小阳台(balcony 缺省 true: dy4 暖木平台
   2 格+dy5 天蓝布幔帘栏 2 格); dy7 低屋面全域(周界 trim 檐口线+内域 roof)+
   dy8 高屋面北半内缩 8×4 全 roof——错落差分落一层, dy9 无物, 总高 9。
   awningAccent 缺省 true(cottage hasChimney 装饰缺省 true 先例): true=窗楣覆
   布幔 awning/false=落回窗框楣 frame——差分非空, 同盒。
   mirror=标准 pfOrient(-dx 先翻后旋, 偶宽 [-5,4]→[-4,5] 盒平移一格——
   shop-awning/stash-hut 先例口径; kernel 走统一 put 通道不自管朝向)。
   脚印 10×8×高 9 与 footOf 同参同盒(4 角过朝向表; 挑窗/阳台 dz=3 在平面域内)。 */

function loftFrontOf(box, face) {/* 前立面平面(face0=south 前沿 dz=3 过朝向表后的世界面) */
  if (face === 'south') return {axis: 'z', at: box.z2, min: box.x1, max: box.x2};
  if (face === 'north') return {axis: 'z', at: box.z1, min: box.x1, max: box.x2};
  if (face === 'west') return {axis: 'x', at: box.x1, min: box.z1, max: box.z2};
  return {axis: 'x', at: box.x2, min: box.z1, max: box.z2}; /* east */
}

function loftCellAt(k, f, a, y) {/* 前立面平面格: f.axis='z' 时 a=x 固定 z, 否则 a=z 固定 x */
  return f.axis === 'z' ? k.cell(a, y, f.at) : k.cell(f.at, y, a);
}

test('脚印包含·house-loft: ×4 朝向 × mirror × 变体 — 每笔写 ∈ footOf 同参盒, footOf 零写', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['缺省', {ids: LOFT_IDS}],
    ['无阳台', {ids: LOFT_IDS, balcony: false}],
    ['无布幔', {ids: LOFT_IDS, awningAccent: false}],
    ['无阳台+无布幔', {ids: LOFT_IDS, balcony: false, awningAccent: false}],
    ['换材质(部分注入)', {ids: Object.assign({}, LOFT_IDS, {base: 1, roof: 2, balcony: 3})}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('house-loft', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' + JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('house-loft', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
        /* 脚印 10×8×高 9(错顶最高点计入; 挑窗/阳台在平面域内): 方角 90° 旋转
           下平面仍 10×8, 装饰开关不改盒 */
        const spanX = box.x2 - box.x1 + 1;
        const spanZ = box.z2 - box.z1 + 1;
        assert.strictEqual(Math.max(spanX, spanZ), 10,
            name + ' ' + face + (mirror ? '+m' : '') + ' 平面长边 10');
        assert.strictEqual(Math.min(spanX, spanZ), 8,
            name + ' ' + face + (mirror ? '+m' : '') + ' 平面短边 8');
        assert.strictEqual(box.y1, 24, name + ' ' + face + ' footOf 下界=锚层基座 dy0');
        assert.strictEqual(box.y2, 32, name + ' ' + face + ' footOf 封顶 dy8(总高 9)');
      }
    }
  }
});

test('形状·house-loft: 10×8 基座/一层墙环三段混搭+门 64..65+窗框布幔/二层挑窗+布幔阳台/檐口线+错高顶 dy7..8(缺省)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, face: 'south'});
  /* 缺省盒手算值: dx∈[-5,4]×dz∈[-4,3]×dy0..8 → 10×8×9 */
  assert.deepStrictEqual({...k.pf.footOf('house-loft', ax, y0, az, {ids: LOFT_IDS, face: 'south'})},
      {x1: 75, y1: 24, z1: 76, x2: 84, y2: 32, z2: 83}, '缺省脚印盒=手算盒');
  /* dy=0 基座: 恰 10×8 实心 base, 域外空(余量一圈) */
  for (let dx = -7; dx <= 6; dx++) {
    for (let dz = -6; dz <= 5; dz++) {
      const inBase = dx >= -5 && dx <= 4 && dz >= -4 && dz <= 3;
      assert.strictEqual(k.cell(ax + dx, y0, az + dz), inBase ? LOFT_IDS.base : 0,
          '基座 dy0 (' + dx + ',' + dz + ') ' + (inBase ? '实心' : '域外空'));
    }
  }
  /* 一层 dy1..3 墙环材质全钉(v2 三段混搭): 四角 trim 深木柱/后墙 dz=-4=
     wallB 石英抹灰/前侧+侧山墙=wallA 木板; 前立面覆写: 门 64/65 成对/
     前窗 dy2 玻璃+dy3 布幔(awningAccent 缺省 true 覆框楣); 东侧窗 dy2 */
  for (let dy = 1; dy <= 3; dy++) {
    for (let dx = -5; dx <= 4; dx++) {
      for (let dz = -4; dz <= 3; dz++) {
        const corner = (dx === -5 || dx === 4) && (dz === -4 || dz === 3);
        const onRing = corner || dx === -5 || dx === 4 || dz === -4 || dz === 3;
        if (!onRing) {
          assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), 0,
              '一层 dy' + dy + ' 内域空 (' + dx + ',' + dz + ')');
          continue;
        }
        let want;
        if (corner) want = LOFT_IDS.trim;
        else if (dz === -4) want = LOFT_IDS.wallB;
        else if (dz === 3) {/* 前立面覆写地图(后写者赢) */
          if (dx === -1 && dy === 1) want = LOFT_IDS.door;
          else if (dx === -1 && dy === 2) want = LOFT_IDS.doorTop;
          else if (dx >= 1 && dx <= 2 && dy === 2) want = LOFT_IDS.window;
          else if (dx >= 1 && dx <= 2 && dy === 3) want = LOFT_IDS.awning;
          else want = LOFT_IDS.wallA;
        } else want = LOFT_IDS.wallA;
        if (dx === 4 && dz === 0 && dy === 2) want = LOFT_IDS.window; /* 东侧窗 */
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), want,
            '一层材质 dy' + dy + ' (' + dx + ',' + dz + ')');
      }
    }
  }
  assert.ok(k.snap().includes(LOFT_IDS.wallB), 'wallB 石英抹灰后墙在(混搭成立)');
  /* 二层 dy4..6 墙环(内缩 8×6: dx∈[-4,3]×dz∈[-3,2])+覆写: 挑窗托架/窗组①
     外挑 dz=3/窗组② dz=2+阳台平台(dy4)与布幔帘栏(dy5, dz=3 dx∈[1,2]) */
  for (let dy = 4; dy <= 6; dy++) {
    for (let dx = -4; dx <= 3; dx++) {
      for (let dz = -3; dz <= 2; dz++) {
        const corner = (dx === -4 || dx === 3) && (dz === -3 || dz === 2);
        const onRing = corner || dx === -4 || dx === 3 || dz === -3 || dz === 2;
        if (!onRing) {
          assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), 0,
              '二层 dy' + dy + ' 内域空 (' + dx + ',' + dz + ')');
          continue;
        }
        let want;
        if (corner) want = LOFT_IDS.trim;
        else if (dz === -3) want = LOFT_IDS.wallB;
        else if (dx >= 1 && dx <= 2 && dz === 2) {/* 窗组②(阳台落地窗, 仅 dy5..6) */
          want = dy === 5 ? LOFT_IDS.window :
            (dy === 6 ? LOFT_IDS.frame : LOFT_IDS.wallA);
        } else want = LOFT_IDS.wallA;
        assert.strictEqual(k.cell(ax + dx, y0 + dy, az + dz), want,
            '二层材质 dy' + dy + ' (' + dx + ',' + dz + ')');
      }
    }
  }
  /* 挑窗组①(dx∈[-3,-2]): dy4 托架 trim+dy5 玻璃+dy6 框楣, 外挑 dz=3(一层
     立面线, 二层墙 dz=2 之外一格)——「二层挑窗」体量感; 阳台(balcony 缺省):
     dy4 平台 balcony+dy5 帘栏 awning(dz=3 dx∈[1,2]) */
  for (const wx of [-3, -2]) {
    assert.strictEqual(k.cell(ax + wx, y0 + 4, az + 3), LOFT_IDS.trim,
        '挑窗托架 trim dy4 dx' + wx);
    assert.strictEqual(k.cell(ax + wx, y0 + 5, az + 3), LOFT_IDS.window,
        '挑窗玻璃 dy5 dz3 dx' + wx);
    assert.strictEqual(k.cell(ax + wx, y0 + 6, az + 3), LOFT_IDS.frame,
        '挑窗框楣 dy6 dz3 dx' + wx);
    assert.strictEqual(k.cell(ax + wx, y0 + 5, az + 2), LOFT_IDS.wallA,
        '挑窗后墙 dz=2 不开洞(凸出体量感)dx' + wx);
  }
  for (const wx of [1, 2]) {
    assert.strictEqual(k.cell(ax + wx, y0 + 4, az + 3), LOFT_IDS.balcony,
        '阳台平台 balcony dy4 dx' + wx);
    assert.strictEqual(k.cell(ax + wx, y0 + 5, az + 3), LOFT_IDS.awning,
        '阳台布幔帘栏 awning dy5 dx' + wx);
  }
  /* dy7 低屋面: 周界 trim 檐口线一圈+内域 roof; dy8 高屋面: 北半 8×4 全 roof
     覆写(错高落差 1 层); dy9 全空(封顶 dy8, 总高 9) */
  let roof7 = 0; let rim7 = 0; let roof8 = 0;
  for (let dx = -5; dx <= 4; dx++) {
    for (let dz = -4; dz <= 3; dz++) {
      const id7 = k.cell(ax + dx, y0 + 7, az + dz);
      const rim = dx === -5 || dx === 4 || dz === -4 || dz === 3;
      if (rim) {
        assert.strictEqual(id7, LOFT_IDS.trim, '檐口线 dy7 (' + dx + ',' + dz + ')');
        rim7++;
      } else {
        assert.strictEqual(id7, LOFT_IDS.roof, '低屋面 dy7 (' + dx + ',' + dz + ')');
        roof7++;
      }
      const inTop = dx >= -4 && dx <= 3 && dz >= -4 && dz <= -1;
      assert.strictEqual(k.cell(ax + dx, y0 + 8, az + dz), inTop ? LOFT_IDS.roof : 0,
          '高屋面 dy8 (' + dx + ',' + dz + ')');
      if (inTop) roof8++;
      assert.strictEqual(k.cell(ax + dx, y0 + 9, az + dz), 0, 'dy9 无物(封顶 dy8)');
    }
  }
  assert.ok(rim7 > 0 && roof7 > 0 && roof8 > 0, '檐口线/两屋面实体都在');
  assert.ok(roof8 < roof7, '错落差分: dy8 覆盖(' + roof8 + ') < dy7 覆盖(' + roof7 + ')');
});

test('形状·house-loft 变体: balcony=false 平台帘栏双退/awningAccent=false 框楣落回且差分真实/缺省=显式 true(防假绿)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* 缺省=装饰在位(PO 知悉批次: 装饰性元素缺省 true, cottage hasChimney 先例):
      无 balcony/awningAccent 键 ≡ 两键显式 true(逐字节同形) */
  k.clear();
  k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, face: 'south'});
  const sDef = k.snap();
  k.clear();
  k.pf.place('house-loft', ax, y0, az,
      {ids: LOFT_IDS, balcony: true, awningAccent: true, face: 'south'});
  assert.ok(sDef.equals(k.snap()), '缺省=balcony+awningAccent 显式 true 同形');
  /* balcony=false: 平台 balcony+布幔帘栏 awning(dy5)双退场(帘栏属阳台件);
     窗楣布幔(awningAccent 独立轴)仍在; 其余几何不动(门/屋顶/窗抽查) */
  k.clear();
  k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, balcony: false, face: 'south'});
  assert.ok(!k.snap().includes(LOFT_IDS.balcony), 'balcony=false 全场零阳台平台块');
  for (const wx of [1, 2]) {
    assert.strictEqual(k.cell(ax + wx, y0 + 4, az + 3), 0,
        '无阳台: 平台格退场(dz=3 立面外挑域)dx' + wx);
    assert.strictEqual(k.cell(ax + wx, y0 + 5, az + 3), 0,
        '无阳台: 帘栏格退场 dx' + wx);
  }
  assert.strictEqual(k.cell(ax + 1, y0 + 3, az + 3), LOFT_IDS.awning,
      '无阳台: 窗楣布幔仍在(awningAccent 独立轴)');
  assert.ok(k.snap().includes(LOFT_IDS.door), '无阳台: 前门仍在(64 下叶)');
  assert.ok(k.snap().includes(LOFT_IDS.roof), '无阳台: 屋顶仍在');
  /* awningAccent 开关: false 时窗楣 dy3 落回窗框楣 frame(不再回退窗材);
     差分=窗楣 2 格 awning↔frame(开关非 no-op); 同参同盒(点缀不出脚印) */
  k.clear();
  const bOn = k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, awningAccent: true, face: 'south'});
  const sOn = k.snap();
  k.clear();
  const bOff = k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, awningAccent: false, face: 'south'});
  const sOff = k.snap();
  for (const wx of [1, 2]) {
    assert.strictEqual(k.cell(ax + wx, y0 + 3, az + 3), LOFT_IDS.frame,
        '布幔关: 窗楣落回石英框楣 dx' + wx);
  }
  assert.ok(!sOn.equals(sOff), 'awningAccent 开关差分非空(布幔点缀有几何生命)');
  assert.deepStrictEqual(bOff, bOn, '布幔点缀不改脚印盒(同形域)');
  assert.ok(sOn.includes(LOFT_IDS.awning) && sOff.includes(LOFT_IDS.frame),
      '开关两态材质各在位(布幔/框楣互换)');
});

test('逐朝向·house-loft: 前门/窗/阳台随 face 旋转(face0=south 朝 +dz), mirror 盒平移一格非对称差分(shop 口径)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  for (const face of ['south', 'west', 'north', 'east']) {
    k.clear();
    k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, face});
    const box = k.pf.footOf('house-loft', ax, y0, az, {ids: LOFT_IDS, face});
    const f = loftFrontOf(box, face);
    /* 前立面平面: 门列 1w×2h(door+doorTop 成对)+窗格(window/frame 任一)+
        阳台格(balcony 平台 dy4)——三要素随朝向旋转到各自前平面 */
    let door = 0; let win = 0; let balc = 0;
    for (let a = f.min + 1; a <= f.max - 1; a++) {
      if (loftCellAt(k, f, a, y0 + 1) === LOFT_IDS.door &&
          loftCellAt(k, f, a, y0 + 2) === LOFT_IDS.doorTop) door++;
      for (let dy = 1; dy <= 6; dy++) {
        const id = loftCellAt(k, f, a, y0 + dy);
        if (id === LOFT_IDS.window || id === LOFT_IDS.frame) win++;
      }
      for (let dy = 4; dy <= 6; dy++) {
        if (loftCellAt(k, f, a, y0 + dy) === LOFT_IDS.balcony) balc++;
      }
    }
    assert.ok(door >= 1, face + ' 前立面有 1×2 门(64/65 成对随朝向旋转)');
    assert.ok(win >= 1, face + ' 前立面有窗格(玻璃/框楣随朝向旋转)');
    assert.ok(balc >= 2, face + ' 前立面有小阳台(随朝向旋转)');
  }
  /* mirror 差分(shop-awning/stash-hut 先例口径: 标准 -dx 先翻后旋, 偶宽体
      [-5,4] 关于 dx=0 不对称 → 盒平移一格): south 基座西缘在 dx-5/东缘外 dx5;
      south+mirror 东补西让双翻转; 门/阳台仍在前立面平面 */
  k.clear();
  k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, face: 'south'});
  assert.strictEqual(k.cell(75, y0, 80), LOFT_IDS.base, 'south 基座西缘=dx-5');
  assert.strictEqual(k.cell(85, y0, 80), 0, 'south 基座东缘外(dx5 域外)');
  k.clear();
  k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, face: 'south', mirror: true});
  assert.strictEqual(k.cell(85, y0, 80), LOFT_IDS.base, 'south+mirror 基座东移(dx5 入域)');
  assert.strictEqual(k.cell(75, y0, 80), 0, 'south+mirror 基座西让(dx-5 出域)');
  const bm = k.pf.footOf('house-loft', ax, y0, az, {ids: LOFT_IDS, face: 'south', mirror: true});
  const fm = loftFrontOf(bm, 'south');
  let doorM = 0; let balcM = 0;
  for (let a = fm.min + 1; a <= fm.max - 1; a++) {
    if (loftCellAt(k, fm, a, y0 + 1) === LOFT_IDS.door &&
        loftCellAt(k, fm, a, y0 + 2) === LOFT_IDS.doorTop) doorM++;
    for (let dy = 4; dy <= 6; dy++) {
      if (loftCellAt(k, fm, a, y0 + dy) === LOFT_IDS.balcony) balcM++;
    }
  }
  assert.ok(doorM >= 1, 'south+mirror 前门仍在前立面');
  assert.ok(balcM >= 2, 'south+mirror 小阳台仍在前立面');
  /* east+mirror: 旋转+镜像复合——门仍在东侧前平面 */
  k.clear();
  k.pf.place('house-loft', ax, y0, az, {ids: LOFT_IDS, face: 'east', mirror: true});
  const be = k.pf.footOf('house-loft', ax, y0, az, {ids: LOFT_IDS, face: 'east', mirror: true});
  const fe = loftFrontOf(be, 'east');
  let doorE = 0;
  for (let a = fe.min + 1; a <= fe.max - 1; a++) {
    if (loftCellAt(k, fe, a, y0 + 1) === LOFT_IDS.door &&
        loftCellAt(k, fe, a, y0 + 2) === LOFT_IDS.doorTop) doorE++;
  }
  assert.ok(doorE >= 1, 'east+mirror 前门仍在东侧前平面(旋转+镜像复合)');
});

test('确定性: house-loft 同参两次逐字节一致(多朝向×变体)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('house-loft', 80, 24, 80, {ids: LOFT_IDS}),
    () => k.pf.place('house-loft', 80, 24, 80,
        {ids: LOFT_IDS, face: 'east', mirror: true, balcony: false}),
    () => k.pf.place('house-loft', 80, 24, 80, {ids: LOFT_IDS, face: 'north', awningAccent: false}),
    () => k.pf.place('house-loft', 80, 24, 80,
        {ids: LOFT_IDS, face: 'west', mirror: true, balcony: false, awningAccent: false}),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档·house-loft: 未知 v 键/ids 子键(含 torch 去威胁钉)/face 非法→throw; balcony/awningAccent 钳布尔', () => {
  const k = loadKit();
  /* 第一档(装场期炸=拼写防火墙): place 与 footOf 同走合并校验路径 */
  assert.throws(() => k.pf.place('house-loft', 80, 24, 80, {ids: LOFT_IDS, balconyy: true}),
      /v 键/, '未知 v 键(拼写)');
  assert.throws(() => k.pf.footOf('house-loft', 80, 24, 80, {ids: LOFT_IDS, foo: 1}),
      /v 键/, 'footOf 同走未知 v 键检');
  assert.throws(() => k.pf.place('house-loft', 80, 24, 80, {ids: LOFT_IDS, face: 'up'}),
      /face/, 'face 非法');
  assert.throws(() => k.pf.place('house-loft', 80, 24, 80,
      {ids: Object.assign({}, LOFT_IDS, {roofx: 1})}), /ids/, 'ids 未知子键');
  /* 去威胁钉(§4.6/§8): 民居无光/火语义槽位——torch 子键不在白名单即炸
     (awning 是布幔材质槽非光源, glow 语义仍拒收) */
  assert.throws(() => k.pf.place('house-loft', 80, 24, 80,
      {ids: Object.assign({}, LOFT_IDS, {torch: 48})}), /ids/, '无 torch 槽(零火语义)');
  assert.throws(() => k.pf.place('house-loft', 80, 24, 80,
      {ids: Object.assign({}, LOFT_IDS, {glow: 19})}), /ids/, '无 glow 槽(零光意象)');
  /* 第二档(布尔轴收放不炸): balcony/awningAccent 非布尔按真值钳(door 先例) */
  k.clear();
  k.pf.place('house-loft', 80, 24, 80, {ids: LOFT_IDS, balcony: 0});
  const b0 = k.snap();
  k.clear();
  k.pf.place('house-loft', 80, 24, 80, {ids: LOFT_IDS, balcony: false});
  assert.ok(b0.equals(k.snap()), 'balcony=0 钳 false 同形');
  k.clear();
  k.pf.place('house-loft', 80, 24, 80, {ids: LOFT_IDS, awningAccent: 1});
  const a1 = k.snap();
  k.clear();
  k.pf.place('house-loft', 80, 24, 80, {ids: LOFT_IDS, awningAccent: true});
  assert.ok(a1.equals(k.snap()), 'awningAccent=1 钳 true 同形');
  assert.ok(a1.includes(LOFT_IDS.door), '钳 true 建场正常(门在位, 防全空假绿)');
});

/* ============ T-PREFAB-07 stall-canopy(市集摊位, 新增行) ============ */

/* ids 槽子键白名单(§4.7): 全互异显式注入, 逐槽可判读(不依赖实现缺省裸数字)。
   frame=木架四角柱 · canopy=顶棚布幔(theme 缺省映射的显式覆写口) · counter=
   台面柜身 · goods=台面货品色块(细碎货品子层最小自洽: 后沿中段少数格) */
const STALL_IDS = {frame: 160, canopy: 161, counter: 162, goods: 163};

/* 局部系契约(对齐票文 §4.7 + buildings-visual-spec §6.1/§5.3 P2-02): face0=south
   摊面(顾客侧)朝 +dz; 锚=摊位地面中心投影。size 枚举两档推荐默认(PO 知悉批次,
   贴规格区间下/上沿自洽): sm=占地 3×2(dx∈[-1,1] 奇宽居中 × dz∈[-1,0] 偶深 NW
   偏置同 pfSpan 口径)总高 3(dy0..2) · md=占地 4×3(dx∈[-2,1] 偶宽 NW 偏置 ×
   dz∈[-1,1] 奇深居中)总高 4(dy0..3)。层序(序即几何): dy0 台面柜身=全 footprint
   实心 counter(spec「建议主体含台面与棚」)→dy1 四角柱 frame+后沿(dz=back)中段
   goods 色块(sm 单格 (0,1,-1)/md 两格 (-1..0,1,-1) NW 偏置偶簇)→高款柱腿更长
   (md 柱 dy1..2, sm 柱仅 dy1——两档高差落棚架腿)→顶层全 footprint canopy 布幔
   (sm dy2/md dy3), 顶层之上一层无物。theme 四档(bread/flower/fruit/generic)
   几何同形仅材质差异(备忘): canopy 缺省按 theme 注入——bread/generic→52 羊毛
   奶油 · flower→16 红羊毛(樱粉最近似, 现调色板无粉色块, 备忘 PO) · fruit→15
   蓝羊毛天蓝; 缺省 theme='generic'; 显式 ids.canopy 覆写 theme 映射, 部分注入
   其余槽回落缺省。mirror=标准 pfOrient -dx 先翻后旋(shop-awning/house-loft
   盒平移口径, 架构线挂账统一中): sm 奇宽 dx 对称形→同盒同形; md 偶宽
   [-2,1]→[-1,2] 盒东移一格——两档都以此钉死。脚印=随 size 变体外包围盒, 与
   footOf 同参同盒(4 角过朝向表)。无光/火语义槽位(ids 白名单无 torch/glow,
   §8 去威胁红线)。 */

function stallFrontOf(box, face) {/* 前平面(=摊面/顾客侧, face0=south 前沿过朝向表) */
  if (face === 'south') return {axis: 'z', at: box.z2, min: box.x1, max: box.x2};
  if (face === 'north') return {axis: 'z', at: box.z1, min: box.x1, max: box.x2};
  if (face === 'west') return {axis: 'x', at: box.x1, min: box.z1, max: box.z2};
  return {axis: 'x', at: box.x2, min: box.z1, max: box.z2}; /* east */
}

function stallRearOf(box, face) {/* 后平面(货品/后沿柱侧=front 的对侧) */
  if (face === 'south') return {axis: 'z', at: box.z1, min: box.x1, max: box.x2};
  if (face === 'north') return {axis: 'z', at: box.z2, min: box.x1, max: box.x2};
  if (face === 'west') return {axis: 'x', at: box.x2, min: box.z1, max: box.z2};
  return {axis: 'x', at: box.x1, min: box.z1, max: box.z2}; /* east */
}

function stallCellAt(k, f, a, y) {/* 平面格: f.axis='z' 时 a=x 固定 z, 否则 a=z 固定 x */
  return f.axis === 'z' ? k.cell(a, y, f.at) : k.cell(f.at, y, a);
}

test('脚印包含·stall-canopy: ×4 朝向 × mirror × 变体 — 每笔写 ∈ footOf 同参盒, footOf 零写', () => {
  const k = loadKit();
  const spy = k.spySet();
  const variants = [
    ['缺省 sm', {ids: STALL_IDS}],
    ['md', {ids: STALL_IDS, size: 'md'}],
    ['md 换 theme', {ids: STALL_IDS, size: 'md', theme: 'bread'}],
    ['部分注入', {ids: {frame: 170, counter: 171}, size: 'sm'}],
  ];
  for (const face of ['south', 'west', 'north', 'east']) {
    for (const mirror of [false, true]) {
      for (const [name, vv] of variants) {
        const v = Object.assign({}, vv, {face, mirror});
        k.clear();
        spy.reset();
        const box = k.pf.place('stall-canopy', 80, 24, 80, v);
        const writes = spy.rec();
        assert.ok(writes.length > 0, name + ' ' + face + (mirror ? '+m' : '') + ' 有写(防全空假绿)');
        for (const w of writes) {
          assert.ok(w[0] >= box.x1 && w[0] <= box.x2 && w[1] >= box.y1 && w[1] <= box.y2 &&
              w[2] >= box.z1 && w[2] <= box.z2,
          name + ' ' + face + (mirror ? '+m' : '') + ' 写 (' + w + ') ⊄ 盒 ' + JSON.stringify(box));
        }
        const n = spy.rec().length;
        assert.deepStrictEqual(k.pf.footOf('stall-canopy', 80, 24, 80, v), box,
            name + ' ' + face + (mirror ? '+m' : '') + ' footOf 同参同盒');
        assert.strictEqual(spy.rec().length, n, 'footOf 零写');
        /* 脚印随 size 变体外包围盒: 方角 90° 旋转平面恒 sm 3×2 / md 4×3(theme
            同形不改盒), y 域 dy0..顶层(sm 封顶 dy2/md dy3) */
        const md = vv.size === 'md';
        const spanX = box.x2 - box.x1 + 1;
        const spanZ = box.z2 - box.z1 + 1;
        assert.strictEqual(Math.max(spanX, spanZ), md ? 4 : 3,
            name + ' ' + face + (mirror ? '+m' : '') + ' 平面长边 ' + (md ? 4 : 3));
        assert.strictEqual(Math.min(spanX, spanZ), md ? 3 : 2,
            name + ' ' + face + (mirror ? '+m' : '') + ' 平面短边 ' + (md ? 3 : 2));
        assert.strictEqual(box.y1, 24, name + ' ' + face + ' footOf 下界=锚层台面 dy0');
        assert.strictEqual(box.y2, md ? 27 : 26,
            name + ' ' + face + ' footOf 封顶 ' + (md ? 'dy3(总高 4)' : 'dy2(总高 3)'));
      }
    }
  }
});

test('形状·stall-canopy sm 缺省档: 3×2×3 台面柜身/四角柱+后沿货品/顶层布幔', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('stall-canopy', ax, y0, az, {ids: STALL_IDS, face: 'south'});
  /* 缺省档手算盒: dx∈[-1,1]×dz∈[-1,0]×dy0..2 → 3×2×3 */
  assert.deepStrictEqual({...k.pf.footOf('stall-canopy', ax, y0, az, {ids: STALL_IDS, face: 'south'})},
      {x1: 79, y1: 24, z1: 79, x2: 81, y2: 26, z2: 80}, 'sm 缺省脚印盒=手算盒');
  /* dy0 台面柜身: 恰 3×2 实心 counter, 域外空(余量一圈) */
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 2; dz++) {
      const inBase = dx >= -1 && dx <= 1 && dz >= -1 && dz <= 0;
      assert.strictEqual(k.cell(ax + dx, y0, az + dz), inBase ? STALL_IDS.counter : 0,
          '台面 dy0 (' + dx + ',' + dz + ') ' + (inBase ? '实心' : '域外空'));
    }
  }
  /* dy1: 四角柱 frame + 后沿中段 goods 单格 + 前沿中段空(顾客位), 其余空 */
  const posts = [[-1, -1], [1, -1], [-1, 0], [1, 0]];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 0; dz++) {
      const isPost = posts.some((p) => p[0] === dx && p[1] === dz);
      const isGoods = dx === 0 && dz === -1;
      assert.strictEqual(k.cell(ax + dx, y0 + 1, az + dz),
          isPost ? STALL_IDS.frame : (isGoods ? STALL_IDS.goods : 0),
          'dy1 (' + dx + ',' + dz + ') ' + (isPost ? '柱' : (isGoods ? '货品' : '空')));
    }
  }
  /* dy2 顶层布幔: 恰 3×2 全 canopy; dy3 无物(封顶 dy2, 总高 3) */
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 0; dz++) {
      assert.strictEqual(k.cell(ax + dx, y0 + 2, az + dz), STALL_IDS.canopy,
          '布幔 dy2 (' + dx + ',' + dz + ')');
      assert.strictEqual(k.cell(ax + dx, y0 + 3, az + dz), 0, 'dy3 无物(封顶 dy2)');
    }
  }
});

test('形状·stall-canopy md 档: 4×3×4 柱腿两节/后沿货品两格 — 外包围盒随 size 放大', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('stall-canopy', ax, y0, az, {ids: STALL_IDS, size: 'md', face: 'south'});
  /* md 手算盒: dx∈[-2,1]×dz∈[-1,1]×dy0..3 → 4×3×4 */
  assert.deepStrictEqual(
      {...k.pf.footOf('stall-canopy', ax, y0, az, {ids: STALL_IDS, size: 'md', face: 'south'})},
      {x1: 78, y1: 24, z1: 79, x2: 81, y2: 27, z2: 81}, 'md 脚印盒=手算盒');
  /* 随 size 变体外包围盒: md 三维都大于 sm(占地 4×3>3×2, 总高 4>3) */
  const smBox = k.pf.footOf('stall-canopy', ax, y0, az, {ids: STALL_IDS, face: 'south'});
  const mdBox = k.pf.footOf('stall-canopy', ax, y0, az,
      {ids: STALL_IDS, size: 'md', face: 'south'});
  assert.ok((mdBox.x2 - mdBox.x1) > (smBox.x2 - smBox.x1) &&
      (mdBox.z2 - mdBox.z1) > (smBox.z2 - smBox.z1) && mdBox.y2 > smBox.y2,
  'md 外包围盒三维严格大于 sm(随 size 变体)');
  /* dy0 台面柜身: 恰 4×3 实心 counter */
  for (let dx = -2; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      assert.strictEqual(k.cell(ax + dx, y0, az + dz), STALL_IDS.counter,
          'md 台面 dy0 (' + dx + ',' + dz + ') 实心');
    }
  }
  /* dy1: 四角柱 frame + 后沿中段 goods 两格(NW 偏置偶簇)——后沿行恰满: 柱/货/货/柱 */
  const posts = [[-2, -1], [1, -1], [-2, 1], [1, 1]];
  for (let dx = -2; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const isPost = posts.some((p) => p[0] === dx && p[1] === dz);
      const isGoods = dz === -1 && (dx === -1 || dx === 0);
      assert.strictEqual(k.cell(ax + dx, y0 + 1, az + dz),
          isPost ? STALL_IDS.frame : (isGoods ? STALL_IDS.goods : 0),
          'md dy1 (' + dx + ',' + dz + ') ' + (isPost ? '柱' : (isGoods ? '货品' : '空')));
    }
  }
  /* dy2 柱腿第二节: 恰 4 角 frame 其余空(高款棚架腿更长——两档高差落腿) */
  let legs = 0;
  for (let dx = -2; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const isPost = posts.some((p) => p[0] === dx && p[1] === dz);
      const id = k.cell(ax + dx, y0 + 2, az + dz);
      assert.strictEqual(id, isPost ? STALL_IDS.frame : 0,
          'md dy2 (' + dx + ',' + dz + ') ' + (isPost ? '柱腿' : '空'));
      if (id === STALL_IDS.frame) legs++;
    }
  }
  assert.strictEqual(legs, 4, 'md dy2 柱腿恰 4 格');
  /* dy3 顶层布幔: 恰 4×3 全 canopy; dy4 无物(封顶 dy3, 总高 4) */
  for (let dx = -2; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      assert.strictEqual(k.cell(ax + dx, y0 + 3, az + dz), STALL_IDS.canopy,
          'md 布幔 dy3 (' + dx + ',' + dz + ')');
      assert.strictEqual(k.cell(ax + dx, y0 + 4, az + dz), 0, 'md dy4 无物(封顶 dy3)');
    }
  }
});

test('theme 注入·stall-canopy: canopy 缺省按 theme 映射(52/16/15)四档几何同形, 显式 ids.canopy 覆写', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  /* 缺省核对表钉实(T-06 硬教训: 缺省裸数字逐槽对 config.js BLOCKS 实义核真,
      均无 tnt/thin/replaceable/solid:false 旗标): frame=5 木头暖木(柱, tower
      pillar/cottage trim 先例) · counter=6 木板暖木-中(stilt 地板/店身墙先例) ·
      goods=38 金矿暖金(shop signAccent 先例) · canopy(generic)=52 羊毛奶油
      (shop awning 先例) */
  k.clear();
  const boxD = k.pf.place('stall-canopy', ax, y0, az, {face: 'south'}); /* 无 ids=全缺省 */
  assert.strictEqual(k.cell(ax, y0, az), 6, '缺省台面=6 木板暖木-中');
  assert.strictEqual(k.cell(ax - 1, y0 + 1, az - 1), 5, '缺省柱=5 木头暖木');
  assert.strictEqual(k.cell(ax, y0 + 1, az - 1), 38, '缺省货品=38 金矿暖金');
  assert.strictEqual(k.cell(ax, y0 + 2, az), 52, '缺省布幔(generic)=52 羊毛奶油');
  /* theme 四档: canopy 缺省映射 bread/generic→52 奶油 · flower→16 红羊毛(樱粉
      最近似, 现调色板无粉色块——PO 备忘) · fruit→15 蓝羊毛天蓝; 几何同形(同盒+
      其余槽位不动), 同 canopy 色的 theme 逐字节同形 */
  const themes = [['bread', 52], ['flower', 16], ['fruit', 15], ['generic', 52]];
  let refSnap = null;
  for (const [th, cid] of themes) {
    k.clear();
    const b = k.pf.place('stall-canopy', ax, y0, az, {theme: th, face: 'south'});
    assert.deepStrictEqual(b, boxD, th + ' 几何同形: 同盒');
    assert.strictEqual(k.cell(ax, y0 + 2, az), cid, th + ' 布幔缺省=' + cid + '(按 theme 注入)');
    assert.strictEqual(k.cell(ax, y0, az), 6, th + ' 台面不动');
    assert.strictEqual(k.cell(ax - 1, y0 + 1, az - 1), 5, th + ' 柱不动');
    assert.strictEqual(k.cell(ax, y0 + 1, az - 1), 38, th + ' 货品不动');
    if (th === 'bread') {
      refSnap = k.snap();
    } else if (cid === 52) {
      assert.ok(refSnap.equals(k.snap()), '同 canopy 色的 theme 逐字节同形(仅材质差异)');
    }
  }
  /* 显式 ids.canopy 覆写 theme 映射; 部分注入其余槽回落缺省 */
  k.clear();
  k.pf.place('stall-canopy', ax, y0, az, {theme: 'flower', ids: {canopy: 200}, face: 'south'});
  assert.strictEqual(k.cell(ax, y0 + 2, az), 200, '显式 canopy 覆写 theme 映射');
  assert.strictEqual(k.cell(ax, y0 + 1, az - 1), 38, '部分注入: 其余槽回落缺省(货品 38)');
});

test('逐朝向·stall-canopy: 台面/布幔随 face 旋转到前平面(face0=south 摊面朝 +dz), mirror sm 同盒同形/md 盒平移一格(shop 口径)', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  for (const face of ['south', 'west', 'north', 'east']) {
    k.clear();
    k.pf.place('stall-canopy', ax, y0, az, {ids: STALL_IDS, face});
    const box = k.pf.footOf('stall-canopy', ax, y0, az, {ids: STALL_IDS, face});
    const f = stallFrontOf(box, face);
    /* 前平面=摊面(顾客侧): dy0 台面行 ≥2 格 counter(全宽), 顶层布幔 ≥2 格 canopy */
    let counter = 0; let canopy = 0;
    for (let a = f.min; a <= f.max; a++) {
      if (stallCellAt(k, f, a, y0) === STALL_IDS.counter) counter++;
      if (stallCellAt(k, f, a, y0 + 2) === STALL_IDS.canopy) canopy++;
    }
    assert.ok(counter >= 2, face + ' 前平面 dy0 台面行(摊面朝顾客)');
    assert.ok(canopy >= 2, face + ' 前平面顶层布幔(棚盖摊面)');
    /* 后平面: dy1 后沿柱+货品随朝向旋转 */
    const r = stallRearOf(box, face);
    let frame = 0; let goods = 0;
    for (let a = r.min; a <= r.max; a++) {
      const id = stallCellAt(k, r, a, y0 + 1);
      if (id === STALL_IDS.frame) frame++;
      if (id === STALL_IDS.goods) goods++;
    }
    assert.ok(frame >= 2, face + ' 后平面后沿柱(随朝向旋转)');
    assert.ok(goods >= 1, face + ' 后平面货品(随朝向旋转)');
  }
  /* mirror sm: dx 对称形 → 同盒同形(逐字节); mirror=标准 -dx 先翻后旋(shop 口径) */
  k.clear();
  k.pf.place('stall-canopy', ax, y0, az, {ids: STALL_IDS, face: 'south'});
  const smNoM = k.snap();
  const smBoxM = k.pf.footOf('stall-canopy', ax, y0, az, {ids: STALL_IDS, face: 'south'});
  k.clear();
  k.pf.place('stall-canopy', ax, y0, az, {ids: STALL_IDS, face: 'south', mirror: true});
  assert.deepStrictEqual(k.pf.footOf('stall-canopy', ax, y0, az,
      {ids: STALL_IDS, face: 'south', mirror: true}), smBoxM, 'sm mirror 同盒(奇宽 dx 对称)');
  assert.ok(smNoM.equals(k.snap()), 'sm mirror 同形(对称形翻不动)');
  /* mirror md: 偶宽 [-2,1]→[-1,2] 盒东移一格(shop-awning/house-loft 盒平移口径);
      货品簇随镜像翻转(西簇→东簇), 摊面仍南平面 */
  k.clear();
  k.pf.place('stall-canopy', ax, y0, az, {ids: STALL_IDS, size: 'md', face: 'south'});
  assert.strictEqual(k.cell(78, y0, 80), STALL_IDS.counter, 'md south 台面西缘=dx-2');
  assert.strictEqual(k.cell(82, y0, 80), 0, 'md south 台面东缘外(dx2 域外)');
  assert.strictEqual(k.cell(79, y0 + 1, 79), STALL_IDS.goods, 'md 非镜货品西簇(dx-1)');
  k.clear();
  k.pf.place('stall-canopy', ax, y0, az, {ids: STALL_IDS, size: 'md', face: 'south', mirror: true});
  assert.strictEqual(k.cell(78, y0, 80), 0, 'md south+mirror 西让(dx-2 出域)');
  assert.strictEqual(k.cell(79, y0, 80), STALL_IDS.counter, 'md south+mirror 盒东移(dx+1 入)');
  assert.strictEqual(k.cell(82, y0, 80), STALL_IDS.counter, 'md south+mirror 东补(dx-2 翻入)');
  assert.strictEqual(k.cell(79, y0 + 1, 79), STALL_IDS.frame, 'md mirror 货品簇翻走(西簇让位柱)');
  assert.strictEqual(k.cell(81, y0 + 1, 79), STALL_IDS.goods, 'md mirror 货品簇翻至东簇(dx0..1)');
  const bm = k.pf.footOf('stall-canopy', ax, y0, az,
      {ids: STALL_IDS, size: 'md', face: 'south', mirror: true});
  const fm = stallFrontOf(bm, 'south');
  let counterM = 0;
  for (let a = fm.min; a <= fm.max; a++) {
    if (stallCellAt(k, fm, a, y0) === STALL_IDS.counter) counterM++;
  }
  assert.ok(counterM >= 2, 'md south+mirror 摊面仍南平面(台面行在位)');
});

test('确定性: stall-canopy 同参两次逐字节一致(多朝向×size×theme×变体)', () => {
  const k = loadKit();
  const builds = [
    () => k.pf.place('stall-canopy', 80, 24, 80),
    () => k.pf.place('stall-canopy', 80, 24, 80, {size: 'md', face: 'east', mirror: true}),
    () => k.pf.place('stall-canopy', 80, 24, 80, {theme: 'flower', size: 'md'}),
    () => k.pf.place('stall-canopy', 80, 24, 80, {ids: STALL_IDS, face: 'north', size: 'sm'}),
  ];
  for (const build of builds) {
    k.clear(); build();
    const a = k.snap();
    k.clear(); build();
    assert.ok(a.equals(k.snap()), '同参两次建场终态逐字节一致');
    assert.ok(a.some((v) => v !== 0), '场内确有方块(防全空假绿)');
  }
});

test('错误两档·stall-canopy: 未知 v 键/ids 子键(含 torch/glow 去威胁钉)/face/size·theme 枚举→throw; mirror 钳布尔', () => {
  const k = loadKit();
  /* 第一档(装场期炸=拼写防火墙): place 与 footOf 同走合并校验路径 */
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80, {ids: STALL_IDS, sizee: 'md'}),
      /v 键/, '未知 v 键(拼写)');
  assert.throws(() => k.pf.footOf('stall-canopy', 80, 24, 80, {foo: 1}),
      /v 键/, 'footOf 同走未知 v 键检');
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80, {ids: STALL_IDS, face: 'up'}),
      /face/, 'face 非法');
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80, {size: 'lg'}),
      /size/, 'size 枚举拼写域(sm/md)');
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80, {size: {hx: 1}}),
      /size/, 'size 对象形拒收(本行 size=枚举轴, 区别于 stilt-hut)');
  assert.throws(() => k.pf.footOf('stall-canopy', 80, 24, 80, {size: 'lg'}),
      /size/, 'footOf 同走 size 枚举检');
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80, {theme: 'fish'}),
      /theme/, 'theme 枚举拼写域(bread/flower/fruit/generic)');
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80,
      {ids: Object.assign({}, STALL_IDS, {canopyy: 1})}), /ids/, 'ids 未知子键');
  /* 去威胁钉(§4.7/§8): 摊位无光/火语义槽位——torch/glow 子键不在白名单即炸 */
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80,
      {ids: Object.assign({}, STALL_IDS, {torch: 48})}), /ids/, '无 torch 槽(零火语义)');
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80,
      {ids: Object.assign({}, STALL_IDS, {glow: 19})}), /ids/, '无 glow 槽(零光意象)');
  /* 第二档(布尔轴收放不炸): mirror 非布尔按真值钳(house-loft balcony 先例) */
  k.clear();
  k.pf.place('stall-canopy', 80, 24, 80, {ids: STALL_IDS, mirror: 1});
  const m1 = k.snap();
  k.clear();
  k.pf.place('stall-canopy', 80, 24, 80, {ids: STALL_IDS, mirror: true});
  assert.ok(m1.equals(k.snap()), 'mirror=1 钳 true 同形');
  assert.ok(m1.includes(STALL_IDS.canopy), '钳 true 建场正常(布幔在位, 防全空假绿)');
});

/* ============ T-PREFAB-09 复用行校验与材质映射基线 ============ */
/* 两块红面(bugfix 基线票, 断言按修复后正确基线写): ①三行缺省材质逐槽实义核真
   ——已知错号(T-06 评审票外发现, 逐字沿袭先例): tower-belfry trim:47=熔炉/
   roof:40=草丛/bell:41=耕地/window:20=TNT/flag:35=传送门面, cottage-gable
   roof:40/window:20, windmill-tower roof:40(T-06 已修 house-loft 同款); 修正值
   按 spec §4 材质口径+全行先例: 顶=9 红砖陶橙/暖褐 · 窗=18 玻璃浅色内衬(shop/
   house-loft 先例) · trim=5 木头暖木-深(全行 trim 先例) · bell=38 金矿暖金
   (§4.1「bell 暖金」, shop signAccent/stall goods 先例) · flag=16 红羊毛
   (§4.1「樱粉或天蓝」之樱粉最近似, stall-canopy flower→16 先例+PO 备忘)。
   ②全行缺省建场安全审计可执行化: 城镇七行(T-01..07)零危险旗标块(tnt/fuse/
   portal/fluid/crop/thin/replaceable/door/bed/lchest 旗标即判据)+全行零功能/
   下界/传送门系错用; 收编三行(stilt-hut/under-room/mound)火把 48=既有探险
   语义(oracle 锁死), 不按旗标检、只检显式清单。
   视觉重制 v2 起: 城镇行缺省按总纲 §2 字库重映射(以各蓝图「v2 核对表」为准,
   上列 ① 修正值系 T-06/T-09 历史脉络); door=64/65 关态成对块按槽名豁免
   (defaults.ids 声明 door/doorTop 槽即立面建材, 非槽名门族块仍违例)。
   另一块防回归面(绿态自证, 重构前后同绿): 枚举校验链九轴+size 双型错误消息
   逐字钉——pfMerge 表驱动收编(§1.10 升格: 清单≥3 处+新轴漂移史)的等价基线。 */

test('材质基线·全行缺省建场安全: 城镇七行零危险旗标块 + 全行零功能/下界/传送门系错用(T-09 审计可执行化)', () => {
  const k = loadKit();
  /* 危险旗标(判据单份在 config BLOCKS 旗标, 测试动态派生不复制): 20 TNT(tnt) ·
     21 引线(fuse/thin) · 35 传送门面(portal) · 24/25 水岩浆(fluid) · 42..45 麦
     (crop/thin) · 40 草丛(thin/replaceable) · 64..67 门(door) · 53/69 床(bed) ·
     48 火把(wall/thin/replaceable——收编三行既有语义, 城镇七行缺省不含) */
  const DANGER_FLAGS = ['tnt', 'fuse', 'portal', 'fluid', 'crop', 'thin',
    'replaceable', 'door', 'bed', 'lchest'];
  /* 功能/下界/传送门系显式清单(旗标不可判的错义): 30/31/33/34 下界系 · 41 耕地 ·
     46 工作台 · 47 熔炉 · 63 熄灭门面 · 70..72 巢穴之心与战利品宝箱系——
     城镇行缺省永禁(注入是调用方自由, 缺省须安全, spec §5.2 行内安全缺省) */
  const BAD_EXPLICIT = [30, 31, 33, 34, 41, 46, 47, 63, 70, 71, 72];
  /* v2 槽名豁免表(视觉重制总纲 §2 字库; 判据单份=defaults.ids 槽名→旗标集):
     door/doorTop 槽=关态成对门叶(64/65), 豁免 door 旗标——城镇行把门当立面
     建材(tower 先例, cottage/loft 复用); bedGrass/bedFlower1/bedFlower2 槽=
     墙根花坛 cross 薄块(40/61/62, §2「地被零成本点缀」), 豁免 thin/
     replaceable——点缀语义, 花坛仍受 BAD 显式清单与旗标其余项管辖; 非豁免槽
     漏进的门族块(66/67 开态)、草丛/花(裸 40/61/62 无槽名)仍违例。收编三行
     无 defaults.ids → 空集不豁免 */
  const EXEMPT_SLOT_FLAGS = {
    door: ['door'], doorTop: ['door'],
    bedGrass: ['thin', 'replaceable'],
    bedFlower1: ['thin', 'replaceable'],
    bedFlower2: ['thin', 'replaceable'],
  };
  const slotExempt = (id) => {
    const d = k.rows[id] && k.rows[id].defaults && k.rows[id].defaults.ids;
    const map = {}; /* bid → 允许旗标集(同 bid 多槽并集) */
    for (const [slot, flags] of Object.entries(EXEMPT_SLOT_FLAGS)) {
      const bid = d && d[slot];
      if (bid == null) continue;
      map[bid] = new Set([...(map[bid] || []), ...flags]);
    }
    return map;
  };
  const townRows = ['tower-belfry', 'shop-awning', 'stash-hut', 'windmill-tower',
    'cottage-gable', 'house-loft', 'stall-canopy'];
  const legacyRows = [['stilt-hut', undefined], ['under-room', {mat: 58}],
    ['mound', {top: 2, rock: 14}]];
  for (const [id, v] of [...townRows.map((r) => [r, undefined]), ...legacyRows]) {
    k.clear();
    k.pf.place(id, 80, 24, 80, v);
    const snap = k.snap();
    assert.ok(snap.some((b) => b !== 0), id + ' 建场非空(防全空假绿)');
    for (const bid of BAD_EXPLICIT) {
      assert.ok(!snap.includes(bid), id + ' 缺省建场含功能/下界系错用块 ' + bid);
    }
    if (!townRows.includes(id)) continue; /* 收编三行: 火把/宝箱=既有语义止于显式清单 */
    const exempt = slotExempt(id);
    for (const bid of new Set(snap)) {
      const b = k.blocks[bid];
      if (!b) continue;
      const allow = exempt[bid] || new Set();
      for (const f of DANGER_FLAGS) {
        if (allow.has(f)) continue; /* 槽名豁免(门叶/花坛, 见 EXEMPT_SLOT_FLAGS) */
        assert.ok(!b[f], id + ' 缺省建场含危险旗标块 ' + bid + '(' + f + ' 旗标)');
      }
    }
  }
});

test('材质基线·tower-belfry 缺省逐槽(v2 核对表): base13/wall17/roof9/bell19/window68/flag78/door64/doorTop65', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('tower-belfry', ax, y0, az); /* 全缺省 */
  assert.strictEqual(k.cell(ax, y0, az), 13, 'base=13 石砖基座(三段式第一段 dy0)——旧 58, 视觉重制 §2 字库重映射');
  assert.strictEqual(k.cell(ax, y0 + 3, az - 1), 17, 'wall=17 石英奶油白(half-timber 填墙 dy3 后沿)——旧 6 木板');
  assert.strictEqual(k.cell(ax - 1, y0 + 5, az - 1), 5, 'pillar=5 木头(四角柱贯通, half-timber 框架)');
  assert.strictEqual(k.cell(ax, y0 + 4, az + 2), 5, 'trim=5 深木(门楣)——PO 石英主导裁决后水平木节奏由楣/檐承担');
  assert.strictEqual(k.cell(ax, y0 + 5, az - 1), 17, 'wall 对照: 边中格恒石英(旧 dy5·dy9 腰线已撤, 远读不再似旧木墙)');
  assert.strictEqual(k.cell(ax, y0 + 13, az), 9, 'roof=9 红砖陶橙(阶梯顶檐板 dy13)');
  assert.strictEqual(k.cell(ax, y0 + 10, az), 19, 'bell=19 灯块自发光金钟(§2「亮橙-趣味光」, 夜里看得见钟)——旧 38 金矿');
  assert.strictEqual(k.cell(ax, y0 + 6, az + 2), 68, 'window=68 玻璃板(前窗 dy6)——旧 18, v2 统一玻璃板');
  assert.strictEqual(k.cell(ax, y0 + 15, az), 78, 'flag=78 粉羊毛顶旗(dy15 樱粉, §4.1「樱粉或天蓝」)——旧 16 红羊毛');
  assert.strictEqual(k.cell(ax, y0 + 2, az + 2), 64, 'door=64 门叶(前立面关态下格, 总纲 §2 字库点名)——v2 真门叶替代门龛');
  assert.strictEqual(k.cell(ax, y0 + 3, az + 2), 65, 'doorTop=65 门上叶(关态上格, 与 64 成对)');
});

test('材质基线·shop-awning 缺省逐槽(v2 核对表): base13/plaster17/awning15/signBg76/window68', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('shop-awning', ax, y0, az); /* 全缺省 */
  assert.strictEqual(k.cell(ax, y0, az), 13, 'base=13 石砖基座(dy0)——旧 58 砂岩, 视觉重制 §2 字库重映射');
  assert.strictEqual(k.cell(ax, y0 + 1, az - 4), 6, 'wall=6 木板侧后墙(店身周界)——不变, §3 M「6 木板为主」');
  assert.strictEqual(k.cell(ax + 1, y0 + 1, az + 3), 17, 'plaster=17 石英抹灰门脸(前立面 dz=3 门右侧格)——v2 新槽「17 石英抹灰混搭」');
  assert.strictEqual(k.cell(ax - 5, y0 + 2, az + 4), 5, 'trim=5 深木廊柱(前廊 dz=4 dy1..3)——v2 柱廊');
  assert.strictEqual(k.cell(ax, y0 + 5, az - 4), 9, 'roof=9 红砖陶橙(dy5 檐层)——不变');
  assert.strictEqual(k.cell(ax, y0 + 5, az + 4), 15, 'awning=15 天蓝主幔(dy5 遮檐全宽)——旧 52 白羊毛, §2「天蓝-布幔」');
  assert.strictEqual(k.cell(ax, y0 + 6, az + 4), 17, 'awningTrim=17 奶油上滚边(dy6)——v2 新槽双层布幔');
  assert.strictEqual(k.cell(ax - 2, y0 + 7, az + 4), 76, 'signBg=76 南瓜亮橙招牌板(dy7 中段)——旧 15, checkpoint 定稿「板 76」');
  assert.strictEqual(k.cell(ax - 1, y0 + 7, az + 4), 17, 'signAccent=17 石英白徽(icon 中央)——旧 38 金矿, checkpoint 定稿「徽 17」');
  assert.strictEqual(k.cell(ax - 4, y0 + 2, az + 3), 19, 'glow=19 灯块窗台内藏暖光带(dy2 左橱窗, warm 缺省)——不变');
  assert.strictEqual(k.cell(ax - 4, y0 + 3, az + 3), 68, 'window=68 玻璃板橱窗(dy3..4)——旧 18 玻璃, 大面橱窗用带框板');
});

test('材质基线·cottage-gable 缺省逐槽(v2 核对表): base13/frame17/door64/chimney4/花坛40·61·62', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('cottage-gable', ax, y0, az); /* 全缺省 */
  assert.strictEqual(k.cell(ax, y0, az), 13, 'base=13 石砖基座——旧 58 砂岩, §2 字库重映射');
  assert.strictEqual(k.cell(ax, y0 + 1, az - 3), 6, 'wall=6 木板(后墙 dy1)——不变, §3 M「6 木板为主」');
  assert.strictEqual(k.cell(ax - 4, y0 + 2, az + 3), 5, 'trim=5 深木角柱(四角 dy1..3)+烟囱口——旧「预留槽未消费」, v2 起消费');
  assert.strictEqual(k.cell(ax + 1, y0 + 3, az + 3), 17, 'frame=17 石英窗框楣(前窗 dy3)——v2 新槽「17 框」');
  assert.strictEqual(k.cell(ax + 1, y0 + 2, az + 3), 18, 'window=18 玻璃(前窗 dy2)——旧 20=TNT 可点燃已修, 民居玻璃口径');
  assert.strictEqual(k.cell(ax, y0 + 4, az), 9, 'roof=9 红砖陶橙(檐层 dy4 与双坡顶)——旧 40=草丛 thin 可穿行, 已修');
  assert.strictEqual(k.cell(ax - 1, y0 + 1, az + 3), 64, 'door=64 门叶下格——旧 6 木板门叶, 总纲 §2「门 64/65」真门叶');
  assert.strictEqual(k.cell(ax - 1, y0 + 2, az + 3), 65, 'doorTop=65 门上叶(关态成对)——v2 新槽');
  assert.strictEqual(k.cell(ax - 2, y0 + 5, az - 3), 4, 'chimney=4 圆石烟囱身(dy5)——旧 3 石头, 总纲「4 石」');
  assert.strictEqual(k.cell(ax - 2, y0 + 6, az - 3), 5, '烟囱口=trim 5 深木(dy6 顶格)——「口 5 深木」白天态裁决');
  assert.strictEqual(k.cell(ax - 4, y0 + 1, az + 3), 40, 'bedGrass=40 草丛(花坛门左带)——v2 新槽「地被零成本点缀」');
  assert.strictEqual(k.cell(ax - 3, y0 + 1, az + 3), 61, 'bedFlower1=61 蒲公英(花坛)——v2 新槽');
  assert.strictEqual(k.cell(ax + 1, y0 + 1, az + 3), 62, 'bedFlower2=62 雏菊(花坛窗下)——v2 新槽');
});

test('材质基线·house-loft 缺省逐槽(v2 核对表): base13/wallB17/frame17/door64/balcony5/awning15', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('house-loft', ax, y0, az); /* 全缺省 */
  assert.strictEqual(k.cell(ax, y0, az), 13, 'base=13 石砖基座——旧 58 砂岩, §2 字库重映射');
  assert.strictEqual(k.cell(ax, y0 + 1, az + 3), 6, 'wallA=6 木板(前立面 dz=3 门脸段)——不变');
  assert.strictEqual(k.cell(ax, y0 + 1, az - 4), 17, 'wallB=17 石英抹灰后墙——旧 5 木头, §3 M「17 石英抹灰混搭」');
  assert.strictEqual(k.cell(ax - 5, y0 + 2, az - 4), 5, 'trim=5 深木角柱(西北角 dy2)+檐口线——不变');
  assert.strictEqual(k.cell(ax, y0 + 7, az), 9, 'roof=9 红砖陶橙(dy7 低屋面内域)——不变');
  assert.strictEqual(k.cell(ax, y0 + 7, az + 3), 5, '檐口线=trim 5 深木(dy7 周界圈)——§3 M「檐口 5」');
  assert.strictEqual(k.cell(ax + 1, y0 + 2, az + 3), 18, 'window=18 玻璃(前窗 dy2)——不变, 民居口径');
  assert.strictEqual(k.cell(ax - 3, y0 + 6, az + 3), 17, 'frame=17 石英窗框楣(挑窗 dy6)——v2 新槽「17 框」');
  assert.strictEqual(k.cell(ax - 1, y0 + 1, az + 3), 64, 'door=64 门叶下格——旧 6 木板门叶, 总纲 §2「门 64/65」');
  assert.strictEqual(k.cell(ax - 1, y0 + 2, az + 3), 65, 'doorTop=65 门上叶(关态成对)——v2 新槽');
  assert.strictEqual(k.cell(ax + 1, y0 + 4, az + 3), 5, 'balcony=5 暖木阳台平台(dy4)——不变, §7.4「2×1 暖木平台」');
  assert.strictEqual(k.cell(ax + 1, y0 + 5, az + 3), 15, 'awning=15 天蓝布幔(阳台帘栏 dy5)——v2 新槽「布幔阳台」');
});

test('材质基线·windmill-tower 缺省逐槽(v2 核对表): base13/wall17/roof9/trim5/blade6/axle76/accent17', () => {
  const k = loadKit();
  const ax = 80; const az = 80; const y0 = 24;
  k.clear();
  k.pf.place('windmill-tower', ax, y0, az); /* 全缺省 */
  assert.strictEqual(k.cell(ax, y0, az), 13, 'base=13 石砖基座(dy0)——旧 3 石头, 视觉重制 §2 字库重映射');
  assert.strictEqual(k.cell(ax, y0 + 1, az), 17, 'wall=17 石英塔身(5×5 内域 dy1)——旧 6 木板');
  assert.strictEqual(k.cell(ax + 2, y0 + 3, az + 2), 5, 'trim=5 木头(dy3 箍带周界)');
  assert.strictEqual(k.cell(ax, y0 + 8, az), 9, 'roof=9 红砖暖褐(檐层 dy8 与锥顶锥尖)');
  assert.strictEqual(k.cell(ax - 1, y0 + 11, az + 3), 6, 'blade=6 木板帆面(上臂帆 dy11 错位列)——旧 52 羊毛');
  assert.strictEqual(k.cell(ax, y0 + 8, az + 1), 76,
      'axle=76 南瓜亮橙轴心(根格覆写檐层; 总纲「南瓜 75」系 id 笔误, §2 字库权威' +
      '南瓜=76, 勘误登记 2026-11-15)——旧 12 金属');
  assert.strictEqual(k.cell(ax, y0 + 9, az + 3), 17, 'accent=17 石英细肋(十字骨架上臂 dy9)——v2 新增肋槽');
});

test('枚举校验链·十轴错误消息逐字钉(pfMerge 表驱动收编的等价基线, 重构前后同绿)', () => {
  const k = loadKit();
  /* 每轴一行: 声明该轴的行 × 非法值 → 逐字消息(值域单份在表, 收编后由表派生) */
  const cases = [
    ['stilt-hut', {face: 'up'}, 'PrefabKit: face 非法「up」(north/east/south/west)'],
    ['stilt-hut', {piles: 'both'}, 'PrefabKit: piles 非法「both」(fixed/terrain)'],
    ['stilt-hut', {roof: 'pointy'}, 'PrefabKit: roof 非法「pointy」(flat/stepped)'],
    ['stilt-hut', {torch: 'floor'}, 'PrefabKit: torch 非法「floor」(wall/rim/none)'],
    ['under-room', {mat: 58, torches: 'trio'}, 'PrefabKit: torches 非法「trio」(solo/pair)'],
    ['shop-awning', {windowGlow: 'fire'}, 'PrefabKit: windowGlow 非法「fire」(warm/none)'],
    ['shop-awning', {signVariant: 'text'}, 'PrefabKit: signVariant 非法「text」(icon/blank)'],
    ['stash-hut', {roofPitch: 'high'}, 'PrefabKit: roofPitch 非法「high」(low/mid)'],
    ['stall-canopy', {theme: 'fish'}, 'PrefabKit: theme 非法「fish」(bread/flower/fruit/generic)'],
    ['stall-canopy', {size: 'lg'}, 'PrefabKit: size 非法「lg」(sm/md)'],
  ];
  for (const [id, v, msg] of cases) {
    assert.throws(() => k.pf.place(id, 80, 24, 80, v), {message: msg},
        id + ' ' + JSON.stringify(v) + ' 消息逐字');
  }
  /* 多错位序等价钉: piles:'terrain' 缺 ground 与 roof 非法并存时, ground 检先于
     roof 枚举检(现行为——表驱动收编必须保序: ground 检随 piles 轴就地, 不后置) */
  assert.throws(() => k.pf.place('stilt-hut', 80, 24, 80, {piles: 'terrain', roof: 'pointy'}),
      /必传 ground/, '多错位序: piles ground 检先于 roof 枚举检');
  /* size 双型轴: stilt-hut 对象档不受枚举检(走形状校验合法放行), stall-canopy
      字符串枚举档对象形拒收 */
  k.clear();
  k.pf.place('stilt-hut', 80, 24, 80, {size: {hx: 1, back: 1, front: 1}});
  assert.ok(k.snap().some((b) => b !== 0), 'stilt-hut 对象档 size 合法建场');
  assert.throws(() => k.pf.place('stall-canopy', 80, 24, 80, {size: {hx: 1}}),
      /size 非法/, 'stall-canopy 对象形拒收(本行 size=字符串枚举轴)');
});
