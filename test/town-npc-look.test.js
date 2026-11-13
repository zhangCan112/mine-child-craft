'use strict';
/* ============================================================
   town NPC 造型管线单测 (T-NPC-01) — 引擎层测试 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   贴图管线票的红绿守门: kit 非方形画布(tex{w,h} 两态向后兼容, 存量
   49 造型零漂移) · town_v01 试点声明(illager 基座等比 + 面包篮追加
   盒 4×3×3 + 村民 64×64 基线) · golden 逐立方体逐面像素对账(手改贴
   图数据即红, 锁死「游戏贴图=已批产 SVG 像素」) · 两次绘制确定性。
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

test('golden 对账: town_v01 每立方体每面像素内容 == fixture(逐纹素等值, 手改即红)', () => {
  const golden = loadGolden();
  const reg = MobLookKit.regions('town_v01');
  const parts = Object.keys(reg).sort();
  assert.ok(golden.town_v01 && golden.town_v01.faces, 'fixture 应含 town_v01.faces(导出器同步产出)');
  assert.deepStrictEqual(Object.keys(golden.town_v01.faces).sort(), parts,
      'fixture 面集合 == kit regions 键集(基座/追加盒无缺无余)');
  for (const part of parts) {
    for (const face of Object.keys(reg[part])) {
      assert.ok(golden.town_v01.faces[part][face], 'fixture 缺面: ' + part + '.' + face);
      assert.deepStrictEqual(faceRows('town_v01', part, face), golden.town_v01.faces[part][face],
          'golden 面内容漂移: ' + part + '.' + face + '(游戏贴图=已批产 SVG 像素红线)');
    }
  }
});

test('golden 元数据: town_v01 贴图基线口径与 look 声明一致(64×64)', () => {
  const golden = loadGolden();
  assert.deepStrictEqual(golden.town_v01.tex, {w: 64, h: 64}, 'fixture 基线口径(§4 村民 64×64)');
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
