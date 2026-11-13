'use strict';
/* ============================================================
   town NPC 造型管线单测 (T-NPC-01 管线 + T-NPC-02 14 键落库) — 引擎层测试
   (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   贴图管线票的红绿守门: kit 非方形画布(tex{w,h} 两态向后兼容, 存量
   49 造型零漂移) · town_v01 试点声明(illager 基座等比 + 面包篮追加
   盒 4×3×3 + 村民 64×64 基线) · golden 逐立方体逐面像素对账(手改贴
   图数据即红, 锁死「游戏贴图=已批产 SVG 像素」) · 两次绘制确定性。
   T-NPC-02 段: 剩余 13 键落库守门 — 13 键在册/画布基线(64×64×9 +
   G01 64×80 + A01/A02 32×32 + A03 48×48) · 几何抽查(T-NPC-01 §5
   box 几何尺寸表: G01 自有骨/动物自有骨/村民 gen ACC 附件盒) ·
   像素抽查(gen 自检同款口径) · greet 元数据随 gen CAST 携带 ·
   golden 扩至 14 键全量。
   interface: node --test test/town-npc-look.test.js
   依赖(均经全局名/require, 调用期解析): js/mob-look-kit.js 的
     MobLookKit; js/mob-look/*.js 经典脚本复刻声明(与浏览器同构);
     test/fixtures/town-npc-golden.json(导出器同步产出, 票 T-NPC-01)
   可测性声明: 纯逻辑直测(零 THREE·零 DOM — 几何 UV 落点/渲染段归
     mob-look.test.js 桩测与 boot 冒烟, 本文件不重复)
   ============================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const LOOK_DIR = path.join(ROOT, 'js', 'mob-look');
const MobLookKit = require('../js/mob-look-kit.js');

/* 经典脚本复刻: look 文件在共享词法环境里对 MobLookKit 声明(与浏览器同构) */
const lookFiles = fs.readdirSync(LOOK_DIR).filter((f) => f.endsWith('.js')).sort();
function declareAll(kit) {
  const ctx = vm.createContext({MobLookKit: kit});
  for (const f of lookFiles) {
    vm.runInContext(fs.readFileSync(path.join(LOOK_DIR, f), 'utf8'), ctx, {filename: f});
  }
}
declareAll(MobLookKit);

/* 测试专用探针(t_ 前缀, 不入 js/mob-look/ 文件域): kit 画布两态声明形状
   —— 非方形 {w,h}(G01 64×80 基线的前提, §6.1) 与方形 {size}(存量两态) */
MobLookKit.declare('t_rect_probe', {
  base: ['humanoid'],
  tex: {w: 64, h: 80, paint: (g, R) => {
    g.fill(R.head.front, [10, 20, 30]); /* 常规区(y<64) */
    g.fill([0, 70, 64, 10], [40, 50, 60]); /* v 轴越 64 深水区(非方形新语义) */
    g.mul([0, 70, 64, 2], 0.5); /* mul 按 v 轴: y70~71 行乘暗 */
    g.fill([60, 74, 8, 2], [1, 2, 3]); /* u 轴越 64 段(x64+ 应被按轴裁掉) */
  }},
});
MobLookKit.declare('t_square_probe', {
  base: ['humanoid'],
  tex: {size: 64, paint: (g, R) => {
    g.fillAll(R.head, [1, 2, 3]); /* 方形声明路径回归: fillAll 六面可画 */
  }},
});

/* ============ kit 非方形扩展(票 §3.1/§6.1) ============ */

test('kit 非方形画布: tex{w:64,h:80} — textureBuffer 返 w/h · 缓冲 w*h*4 · v 轴越 64 可画(put/mul 按轴)', () => {
  const tb = MobLookKit.textureBuffer('t_rect_probe');
  assert.strictEqual(tb.w, 64, '画布宽 w=64(旧 kit 只有 size 字段, 非方形无支持)');
  assert.strictEqual(tb.h, 80, '画布高 h=80(G01 基线画布, §4)');
  assert.strictEqual(tb.buf.length, 64 * 80 * 4, 'RGBA 缓冲 = w*h*4(旧 kit 为 64*64*4)');
  const at = (x, y) => {
    const o = (y * 64 + x) * 4;
    return [tb.buf[o], tb.buf[o + 1], tb.buf[o + 2], tb.buf[o + 3]];
  };
  assert.deepStrictEqual(at(5, 72), [40, 50, 60, 255], 'y=72(>64) 行像素已被画上(旧 kit put 按 y>=size 全裁)');
  assert.deepStrictEqual(at(0, 71), [20, 25, 30, 255], 'mul 按轴: y=71 行被乘暗(旧 kit 缓冲无此行, 乘不到)');
  assert.deepStrictEqual(at(63, 74), [1, 2, 3, 255], '越界矩形的界内段照画(x=63 贴边纹素)');
});

test('kit 方形路径回归: tex{size:64} 两态照常 · 存量 creeper 画布 64×64(存量零漂移守门 §3.1)', () => {
  const tb = MobLookKit.textureBuffer('t_square_probe');
  assert.strictEqual(tb.w, 64, '方形声明 w=64');
  assert.strictEqual(tb.h, 64, '方形声明 h=64');
  assert.strictEqual(tb.buf.length, 64 * 64 * 4, '方形缓冲 64*64*4');
  const r = MobLookKit.regions('t_square_probe').head.front;
  const o = (r[1] * 64 + r[0]) * 4;
  assert.deepStrictEqual([tb.buf[o], tb.buf[o + 1], tb.buf[o + 2], tb.buf[o + 3]],
      [1, 2, 3, 255], 'fillAll 六面照常可画');
  const c = MobLookKit.textureBuffer('creeper');
  assert.strictEqual(c.w, 64, '存量怪 creeper 画布宽 64');
  assert.strictEqual(c.h, 64, '存量怪 creeper 画布高 64');
  assert.strictEqual(c.buf.length, 64 * 64 * 4, '存量怪缓冲不变');
});

/* ============ town_v01 试点(票 §6.2) ============ */

test('town_v01 试点: 声明在册 · illager 基座官方等比 · 长袍 overlay · 面包篮追加盒 4×3×3 挂左臂 · 碎块色', () => {
  assert.ok(MobLookKit.has('town_v01'), 'js/mob-look/town_v01.js 应声明 town_v01(管线试点在册)');
  const rig = MobLookKit.rig('town_v01');
  const head = rig.slots.head;
  assert.strictEqual(head.cubes.length, 2, '头槽 cubes=2(头+鼻, §5.1)');
  assert.ok(Math.abs(head.boxes[0].h - 10 / 16) < 1e-9, '头盒 h=10/16(头 8×10×8)');
  assert.ok(Math.abs(head.boxes[1].w - 2 / 16) < 1e-9 &&
      Math.abs(head.boxes[1].h - 4 / 16) < 1e-9, '鼻盒 2×4(×2) 特征前突件');
  const root = rig.slots.root;
  assert.strictEqual(root.cubes.length, 2, '袍体+长袍 overlay 两件(§5.1)');
  assert.ok(Math.abs(root.boxes[0].h - 12 / 16) < 1e-9, '袍体 8×12×6');
  assert.strictEqual(root.cubes[1].inflate, 0.5, '长袍 overlay inflate 0.5');
  assert.strictEqual(root.cubes[1].origin[1], 6, '长袍下摆收 y6(引擎步态可见先例)');
  assert.ok(Math.abs(rig.slots.armR.boxes[0].h - 12 / 16) < 1e-9, '臂 4×12×4');
  assert.ok(Math.abs(rig.slots.legR.boxes[0].h - 12 / 16) < 1e-9, '腿 4×12×4');
  assert.ok(Math.abs(rig.slots.legR.joint[1] - 12 / 16) < 1e-9, '腿枢轴 12px(盒底 y=0 贴地)');
  /* 身顶 = 头枢轴 24px + 头高 10px = 34px: §5.1 部件表(头10+身12+腿12)的
     等比强制和; 设计立绘「整体高 32px」是含裙摆遮挡的视觉口径, 2.0 格
     的锚高消费在 T-NPC-05 anchorHeight — 偏离登记见 T-NPC-01 回执 */
  assert.ok(Math.abs(head.joint[1] + head.boxes[0].h - 34 / 16) < 1e-9,
      '身顶几何 = 34/16(基座等比强制; 2.0 格锚高归 T-NPC-05)');
  const basket = rig.slots.armL.cubes.find(
      (c) => c.size[0] === 4 && c.size[1] === 3 && c.size[2] === 3);
  assert.ok(basket, '面包篮追加盒 4×3×3 挂 armL(gen ACC basket mode=carry 左手持物, §3.2)');
  assert.ok(Array.isArray(basket.uv), '篮盒带独立 UV 区(导出器按 faceRects 公式重排)');
  assert.strictEqual(MobLookKit.debrisOf('town_v01'), 0xf4d9a6, '碎块色=服装主色(V01 袍主 #F4D9A6, §3.2)');
});

test('town_v01 贴图基线: 村民画布 64×64(PO 冻结 §4)', () => {
  const tb = MobLookKit.textureBuffer('town_v01');
  assert.strictEqual(tb.w, 64, '村民画布宽 64');
  assert.strictEqual(tb.h, 64, '村民画布高 64');
  assert.strictEqual(tb.buf.length, 64 * 64 * 4, '缓冲 64*64*4');
});

test('town_v01 头像裁切: 中心像素=V01 冻结色盘暖肤系(r>g>b)', () => {
  const px = MobLookKit.facePixels('town_v01');
  assert.ok(px && px.length === 256, '16×16 头像网(8×10 头正面居中裁切)');
  const c = px[8 * 16 + 8];
  assert.ok(c, '中心像素非空');
  /* 票文「肤色系(g>r>b 族)」按 PO 冻结的 V01 色盘落实: s=#C89A6A/d=#B98558
     均为暖肤通道序 r>g>b(偏离登记见回执); 此序同时防眼色/描边滑进脸心 */
  assert.ok(c[0] > c[1] && c[1] > c[2], '中心像素 r>g>b 暖肤系, 实测 ' + JSON.stringify(c));
});

/* ============ golden 逐面对账(票 §6.3) ============ */

function loadGolden() {
  const p = path.join(ROOT, 'test', 'fixtures', 'town-npc-golden.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/* 逐面像素内容摘要: faceRects 矩形逐纹素取 RGB → 每行一条 hex 串(每纹素 6 字符) */
function faceRows(type, part, face) {
  const tex = MobLookKit.textureBuffer(type);
  const r = MobLookKit.regions(type)[part][face];
  const rows = [];
  for (let y = 0; y < r[3]; y++) {
    let s = '';
    for (let x = 0; x < r[2]; x++) {
      const o = ((r[1] + y) * tex.w + (r[0] + x)) * 4;
      s += [tex.buf[o], tex.buf[o + 1], tex.buf[o + 2]]
          .map((v) => v.toString(16).padStart(2, '0')).join('');
    }
    rows.push(s);
  }
  return {w: r[2], h: r[3], rows};
}

/* T-NPC-02 扩容: 14 键全量(town_v01 + 剩余 13) */
const T2_VILLAGERS = ['town_v02', 'town_v03', 'town_v04', 'town_v05', 'town_v06',
  'town_v07', 'town_v08', 'town_v09', 'town_v10'];
const T2_NEW = T2_VILLAGERS.concat(['town_g01', 'town_a01', 'town_a02', 'town_a03']);
const T2_ALL14 = ['town_v01'].concat(T2_NEW);

test('golden 对账: 14 键全量每立方体每面像素内容 == fixture(逐纹素等值, 手改即红)', () => {
  const golden = loadGolden();
  assert.deepStrictEqual(Object.keys(golden).sort(), T2_ALL14.slice().sort(),
      'fixture 键集 = 14 键全量(导出器同步产出, 票 T-NPC-02 §4.2)');
  for (const key of T2_ALL14) {
    const reg = MobLookKit.regions(key);
    const parts = Object.keys(reg).sort();
    assert.ok(golden[key] && golden[key].faces, 'fixture 缺实体: ' + key);
    assert.deepStrictEqual(Object.keys(golden[key].faces).sort(), parts,
        key + ' fixture 面集合 == kit regions 键集(基座/追加盒无缺无余)');
    for (const part of parts) {
      for (const face of Object.keys(reg[part])) {
        assert.ok(golden[key].faces[part][face], 'fixture 缺面: ' + key + ' ' + part + '.' + face);
        assert.deepStrictEqual(faceRows(key, part, face), golden[key].faces[part][face],
            'golden 面内容漂移: ' + key + ' ' + part + '.' + face + '(游戏贴图=已批产 SVG 像素红线)');
      }
    }
  }
});

test('golden 元数据: 14 键贴图基线口径与 look 声明一致(村民/A01/A02 64×64·32² G01 64×80 A03 48²)', () => {
  const golden = loadGolden();
  const want = {};
  for (const v of T2_VILLAGERS.concat(['town_v01'])) want[v] = {w: 64, h: 64};
  want.town_g01 = {w: 64, h: 80};
  want.town_a01 = {w: 32, h: 32};
  want.town_a02 = {w: 32, h: 32};
  want.town_a03 = {w: 48, h: 48};
  for (const [key, tex] of Object.entries(want)) {
    assert.ok(golden[key], 'fixture 缺实体: ' + key);
    assert.deepStrictEqual(golden[key].tex, tex, key + ' fixture 基线口径(§4 PO 冻结)');
  }
});

/* ============ 确定性(票 §6.2 同 type 两次绘制逐字节一致) ============ */

test('town_v01 确定性: 两次声明+绘制逐字节一致(种子化程序贴图口径)', () => {
  const first = MobLookKit.textureBuffer('town_v01').buf.slice();
  delete require.cache[require.resolve('../js/mob-look-kit.js')];
  const kit2 = require('../js/mob-look-kit.js');
  declareAll(kit2);
  assert.deepStrictEqual(Array.from(kit2.textureBuffer('town_v01').buf), Array.from(first),
      '重进世界观感逐像素一致');
});

/* ============================================================
   T-NPC-02 段: 剩余 13 键落库(V02~V10 / G01 / A01~A03)
   验收口径 = 票 §4(红绿可测): 在册+画布基线 · 几何抽查(T-NPC-01
   §5 box 尺寸表) · 像素抽查(gen 自检同款口径) · greet 元数据随
   gen CAST · golden 14 键 · 确定性。期望值全部取规格字面量
   (T-NPC-01 §5 表 / gen-rollout-* CAST·ACC 自检像素), 不依赖
   .scratch 文件(入库测试零 scratch 依赖)。
   ============================================================ */

/* 几何探针: 按立方体尺寸 px 找槽位(公共缝 = rig.slots[].cubes, 不预设骨名) */
function cubesOf(rig, w, h, d) {
  const out = [];
  for (const [name, slot] of Object.entries(rig.slots)) {
    for (const c of slot.cubes) {
      if (c.size[0] === w && c.size[1] === h && c.size[2] === d) out.push({bone: name, cube: c});
    }
  }
  return out;
}
/* 纹理探针: 画布 (x,y) 处 RGB(公共缝 = textureBuffer().buf, 行距按 w) */
function texel(tex, x, y) {
  const o = (y * tex.w + x) * 4;
  return [tex.buf[o], tex.buf[o + 1], tex.buf[o + 2]];
}

test('T-NPC-02 落库在册: 13 新键 has(k)(文件名=声明键, mob-look 全键循环自动并入)', () => {
  for (const k of T2_NEW) {
    assert.ok(MobLookKit.has(k), k + ' 应已落库(js/mob-look/' + k + '.js declare, 票 §2)');
  }
});

test('T-NPC-02 贴图基线: 村民 64×64 ×9 · G01 64×80 · A01/A02 32×32 · A03 48×48(§4 PO 冻结)', () => {
  const want = {};
  for (const v of T2_VILLAGERS) want[v] = [64, 64];
  want.town_g01 = [64, 80];
  want.town_a01 = [32, 32];
  want.town_a02 = [32, 32];
  want.town_a03 = [48, 48];
  for (const [k, [w, h]] of Object.entries(want)) {
    const tb = MobLookKit.textureBuffer(k);
    assert.strictEqual(tb.w, w, k + ' 画布宽');
    assert.strictEqual(tb.h, h, k + ' 画布高');
    assert.strictEqual(tb.buf.length, w * h * 4, k + ' RGBA 缓冲 = w*h*4');
  }
});

test('T-NPC-02 G01 几何抽查: 身高 43px≈2.7 格 · 长臂 4×30×6 过膝 · 髋 10×5×7 · 躯干/腿/献花盒(§5.2)', () => {
  assert.ok(MobLookKit.has('town_g01'), 'town_g01 应在册');
  const rig = MobLookKit.rig('town_g01');
  const head = rig.slots.head;
  assert.strictEqual(head.cubes.length, 2, '头槽 cubes=2(头 8×10×8 + 鼻 2×4×2, §5.2)');
  assert.ok(Math.abs(head.boxes[0].w - 8 / 16) < 1e-9 &&
      Math.abs(head.boxes[0].h - 10 / 16) < 1e-9, '头盒 8×10(×8)');
  assert.ok(Math.abs(head.boxes[1].w - 2 / 16) < 1e-9 &&
      Math.abs(head.boxes[1].h - 4 / 16) < 1e-9, '鼻盒 2×4(×2, §5.2【打样后补已采纳】)');
  assert.ok(Math.abs(head.joint[1] + head.boxes[0].h - 43 / 16) < 1e-9,
      '整体高 = 头枢轴 + 头高 = 43px ≈ 2.7 格(§5.2, 票 §4.3)');
  const torso = cubesOf(rig, 14, 12, 8);
  assert.strictEqual(torso.length, 1, '躯干 14×12×8(§5.2)');
  assert.strictEqual(torso[0].cube.origin[1], 21, '躯干 y21~33(§5.2 位置列)');
  const hip = cubesOf(rig, 10, 5, 7);
  assert.ok(hip.length >= 1, '髋盒 10×5×7 存在(§5.2/S-b, 票 §4.3)');
  assert.strictEqual(hip[0].cube.origin[1], 16, '髋盒 y16~21(§5.2 位置列)');
  const legs = cubesOf(rig, 6, 16, 5);
  assert.strictEqual(legs.length, 2, '腿 6×16×5 ×2(§5.2)');
  assert.strictEqual(legs[0].cube.origin[1], 0, '腿落地 y0');
  assert.strictEqual(Math.abs(legs[0].cube.origin[0] - legs[1].cube.origin[0]), 8,
      '腿间距 2px(§5.2: 6 宽 + 2 隙 → 原点距 8)');
  const arms = cubesOf(rig, 4, 30, 6);
  assert.strictEqual(arms.length, 2, '臂 4×30×6 ×2(§5.2 长臂, 票 §4.3)');
  for (const {cube} of arms) {
    assert.strictEqual(cube.origin[1] + 30, 31, '臂肩接 y31(§5.2 位置列)');
    assert.ok(cube.origin[1] >= 1 && cube.origin[1] <= 3, '臂下垂至 y≈1~3 过膝(§5.2)');
  }
  const flower = cubesOf(rig, 4, 4, 4);
  assert.strictEqual(flower.length, 1, '献花盒 4×4×4(§5.2/票 §1 骨照建)');
  const baseBones = new Set(['head', 'root', 'hip', 'armR', 'armL', 'legR', 'legL']);
  assert.ok(!baseBones.has(flower[0].bone), '献花盒=独立附件骨(显隐后置, 不并躯干骨)');
});

test('T-NPC-02 动物几何抽查(§5.3 自有骨): A01 冠/喙/体/尾/腿 · A02 坐姿体/耳/前腿×4/尾 · A03 体/颈/头/腿×4/耳', () => {
  assert.ok(MobLookKit.has('town_a01') && MobLookKit.has('town_a02') && MobLookKit.has('town_a03'),
      '动物 3 键应在册');
  const a1 = MobLookKit.rig('town_a01');
  assert.strictEqual(cubesOf(a1, 4, 5, 4).length, 1, 'A01 头 4×5×4');
  assert.strictEqual(cubesOf(a1, 2, 1, 2).length, 2, 'A01 冠 2×1×2 + 喙 2×1×2(§5.3 上突/前突件)');
  assert.strictEqual(cubesOf(a1, 6, 6, 8).length, 1, 'A01 体 6×6×8');
  assert.strictEqual(cubesOf(a1, 2, 2, 1).length, 1, 'A01 尾 2×2×1');
  assert.strictEqual(cubesOf(a1, 1, 3, 1).length, 2, 'A01 腿 1×3×1 ×2(票 §4.3)');
  const a2 = MobLookKit.rig('town_a02');
  assert.strictEqual(cubesOf(a2, 5, 5, 5).length, 1, 'A02 头 5×5×5');
  assert.strictEqual(cubesOf(a2, 1, 2, 1).length, 2, 'A02 耳 1×2×1 ×2');
  assert.strictEqual(cubesOf(a2, 5, 8, 6).length, 1, 'A02 体(臀团+胸坐姿盒) 5×8×6(bind 即坐姿)');
  assert.strictEqual(cubesOf(a2, 1, 5, 1).length, 5,
      'A02 前腿 1×5×1 ×4 + 尾 1×5×1 同尺寸计 5(§5.3)');
  assert.strictEqual(cubesOf(a2, 1, 5, 1).filter((x) => x.bone === 'tail').length, 1,
      'A02 尾独立骨(骨名沿 quad 惯例 tail, 票 §3)');
  assert.strictEqual(cubesOf(a2, 1, 5, 1).filter((x) => x.bone !== 'tail').length, 4,
      'A02 前腿 ×4(坐姿直立)');
  const a3 = MobLookKit.rig('town_a03');
  assert.strictEqual(cubesOf(a3, 8, 7, 12).length, 1, 'A03 体 8×7×12');
  assert.strictEqual(cubesOf(a3, 3, 7, 3).length, 1, 'A03 颈 3×7×3(竖直)');
  assert.strictEqual(cubesOf(a3, 4, 4, 6).length, 1, 'A03 头 4×4×6');
  assert.strictEqual(cubesOf(a3, 2, 9, 2).length, 4, 'A03 腿 2×9×2 ×4');
  assert.strictEqual(cubesOf(a3, 1, 1, 1).length, 2, 'A03 耳 1×1×1 ×2');
});

test('T-NPC-02 村民附件追加盒(gen ACC 表机械移植): V02 麦束 … V10 挎包 · 托盘按 gen 6×2×4 含沿', () => {
  /* 尺寸真源 = gen-rollout-villagers.js ACC 表(T-NPC-01 §5.1「附件盒尺寸表随 gen ACC 表」)。
     票文 §4.3「托盘盒 6×1×4」是盘体口径; gen ACC.tray w6 h2 d4(「盘 6×1×4 → 高 2 含沿」)
     按「gen 像素唯一真源」落 6×2×4 — 偏离登记见 T-NPC-02 回执。 */
  const want = {
    town_v02: [3, 6, 2], town_v03: [2, 6, 2], town_v04: [2, 6, 2], town_v05: [2, 5, 2],
    town_v06: [3, 5, 2], town_v07: [6, 2, 4], town_v08: [2, 2, 2], town_v09: [3, 4, 2],
    town_v10: [3, 3, 2],
  };
  for (const [k, [w, h, d]] of Object.entries(want)) {
    assert.ok(MobLookKit.has(k), k + ' 应在册');
    assert.ok(cubesOf(MobLookKit.rig(k), w, h, d).length >= 1,
        k + ' 附件追加盒 ' + w + '×' + h + '×' + d + ' 存在(gen ACC)');
  }
});

test('T-NPC-02 碎块色同构: 13 键 debris=服装/体主色(villagers pal.a · G01 铁主体 · 动物体主色)', () => {
  const want = {
    town_v02: 0x7fb069, town_v03: 0x6b4e3d, town_v04: 0x7ec8d8, town_v05: 0x5a4636,
    town_v06: 0xf4c7d9, town_v07: 0xf7f3ec, town_v08: 0x6b4e3d, town_v09: 0x7ec8d8,
    town_v10: 0xf0a45d, town_g01: 0xbfc5cb, town_a01: 0xe6c35c, town_a02: 0xe89b5e,
    town_a03: 0xc8a97e,
  };
  for (const [k, hex] of Object.entries(want)) {
    assert.strictEqual(MobLookKit.debrisOf(k), hex, k + ' 碎块色=主色(§3.2 声明形状同构)');
  }
});

test('T-NPC-02 动物像素抽查(gen 自检同款口径): A01 正面眼/冠红/喙金 · A02 胸白纹 3×3 · A03 耳内红(背视等价)', () => {
  const t1 = MobLookKit.textureBuffer('town_a01');
  const hf = MobLookKit.regions('town_a01').head.front;
  for (const [dx, dy] of [[0, 1], [0, 2], [3, 1], [3, 2]]) {
    assert.deepStrictEqual(texel(t1, hf[0] + dx, hf[1] + dy), [47, 93, 80],
        'A01 正面眼深绿 #2F5D50 1×2 ×2(贴边, D7 豁免)');
  }
  const smalls1 = Object.values(MobLookKit.regions('town_a01'))
      .filter((f) => f.front[2] === 2 && f.front[3] === 1);
  const flat1 = smalls1.map((f) => [texel(t1, f.front[0], f.front[1]), texel(t1, f.front[0] + 1, f.front[1])]);
  assert.ok(flat1.some(([a, b]) => a.join() === '217,107,82' && b.join() === '217,107,82'),
      'A01 冠红 #D96B52 2×1 在册(§4.4 正面冠)');
  assert.ok(flat1.some(([a, b]) => a.join() === '217,164,65' && b.join() === '217,164,65'),
      'A01 喙金 #D9A441 2×1 在册(§4.4 正面喙)');
  const t2 = MobLookKit.textureBuffer('town_a02');
  const rf = MobLookKit.regions('town_a02').root.front;
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 1; dx <= 3; dx++) {
      assert.deepStrictEqual(texel(t2, rf[0] + dx, rf[1] + dy), [247, 243, 236],
          'A02 胸白纹 #F7F3EC(' + dx + ',' + dy + ')(§4.4)');
    }
  }
  const t3 = MobLookKit.textureBuffer('town_a03');
  const ears = Object.entries(MobLookKit.regions('town_a03'))
      .filter(([, f]) => f.front[2] === 1 && f.front[3] === 1);
  assert.ok(ears.length >= 2, 'A03 耳 ×2 在册(1×1 面)');
  for (const [name, f] of ears) {
    assert.deepStrictEqual(texel(t3, f.back[0], f.back[1]), [217, 107, 82],
        'A03 耳内红 #D96B52 在耳盒背面(' + name + ')(§4.4; gen 背视 1px 点缀的 3D 等价映射)');
  }
});

test('T-NPC-02 G01 像素抽查: 献花盒贴图在册(花瓣/花心/茎) · 裂纹示意像素不进默认画布(裁决二)', () => {
  const tex = MobLookKit.textureBuffer('town_g01');
  const flower = Object.entries(MobLookKit.regions('town_g01'))
      .filter(([, f]) => f.front[2] === 4 && f.front[3] === 4);
  assert.ok(flower.length >= 1, '4×4 面部件(献花盒)在册');
  const ff = flower[0][1].front;
  assert.deepStrictEqual(texel(tex, ff[0], ff[1]), [244, 167, 193], '花盒正面花瓣 P #F4A7C1');
  assert.deepStrictEqual(texel(tex, ff[0] + 1, ff[1] + 1), [247, 227, 181], '花盒花心 p #F7E3B5');
  assert.deepStrictEqual(texel(tex, ff[0] + 3, ff[1] + 3), [127, 176, 105], '花盒底行茎 t #7FB069');
  /* 票 §3: gen 已内嵌的裂纹示意像素(_crack1/_crack2 线 c/X)保留在 golden 对照域之外,
     不进默认画布——c #7A8086 / X #8D9399 在 G01 正常面图中零出现, 全画布扫描应零命中 */
  const hits = [];
  for (let i = 0; i < tex.buf.length; i += 4) {
    const r = tex.buf[i]; const g = tex.buf[i + 1]; const b = tex.buf[i + 2];
    if ((r === 122 && g === 128 && b === 134) || (r === 141 && g === 147 && b === 153)) {
      hits.push(i / 4);
    }
  }
  assert.deepStrictEqual(hits, [], 'G01 默认画布不得含裂纹示意像素(c/X 色纹素, 票 §3)');
});

test('T-NPC-02 表情帧元数据: 10 村民 greet 随 gen CAST 携带(V01=browlift 其余=eyesmile; 非村民不带)', () => {
  const captured = {};
  const ctx = vm.createContext({MobLookKit: {declare: (k, def) => {
    captured[k] = def;
  }}});
  for (const f of lookFiles.filter((n) => n.startsWith('town_'))) {
    vm.runInContext(fs.readFileSync(path.join(LOOK_DIR, f), 'utf8'), ctx, {filename: f});
  }
  const want = {town_v01: 'browlift'};
  for (const v of T2_VILLAGERS) want[v] = 'eyesmile';
  for (const [k, greet] of Object.entries(want)) {
    assert.ok(captured[k], 'look 声明缺失: ' + k);
    assert.strictEqual(captured[k].greet, greet,
        k + '.greet 应= ' + greet + '(gen CAST 机械移植, 消费在 T-NPC-03)');
  }
  for (const k of ['town_g01', 'town_a01', 'town_a02', 'town_a03']) {
    assert.ok(captured[k], 'look 声明缺失: ' + k);
    assert.strictEqual(captured[k].greet, undefined, k + ' 无表情帧体系, 不带 greet 元数据');
  }
});

test('T-NPC-02 确定性: 14 town 键两次声明+绘制逐字节一致(种子化程序贴图口径)', () => {
  const first = {};
  for (const k of T2_ALL14) first[k] = Array.from(MobLookKit.textureBuffer(k).buf);
  delete require.cache[require.resolve('../js/mob-look-kit.js')];
  const kit2 = require('../js/mob-look-kit.js');
  declareAll(kit2);
  for (const k of T2_ALL14) {
    assert.deepStrictEqual(Array.from(kit2.textureBuffer(k).buf), first[k],
        k + ' 重进世界观感逐像素一致');
  }
});
