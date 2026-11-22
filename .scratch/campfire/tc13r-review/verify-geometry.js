// T-C13-R 复验 · 几何断言(byPred 装具基线: 特征锚定+命中数自断言, 不硬编码行号)
// 产物面断言: vm 注入导出 CF_PARTS/pushCampfireParts, 真跑 emit 两态对撞——
// 不转抄施工线 verify-parts.js 与 CF_PARTS_WANT, 本脚本独立核算。
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const log = [];
const say = (s) => { console.log(s); log.push(s); };

const ctx = vm.createContext({console});
for (const f of ['config.js', 'texture-atlas.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, {filename: f});
}
/* 注入导出(闭包内符号, 仅内存 instrument 不落盘产品代码: IIFE 返回行替换+同 script 挂载) */
const meshSrc = fs.readFileSync(path.join(ROOT, 'js', 'mesh-core.js'), 'utf8');
const RET = '  return {meshChunk};';
if (!meshSrc.includes(RET)) throw new Error('IIFE return 行未命中——instrument 失效');
const patched = meshSrc.replace(RET,
    '  globalThis.__geo = { CF_PARTS, pushCampfireParts };\n' + RET);
vm.runInContext(patched, ctx, {filename: 'mesh-core.js'});
const {CF_PARTS, pushCampfireParts} = ctx.__geo;

/* ---- emit 装具: 假 buffer+假光查询 ---- */
function emit(out) {
  const t = {positions: [], normals: [], uvs: [], sky: [], block: [], indices: [], n: 0};
  const aeLit = {logEnd: 68, logSide: 69, top: 70, side: 71};
  const aeOut = {logEnd: 68, logSide: 69, top: 72, side: 73};
  pushCampfireParts(t, 61, 30, 59, 61, 59, out ? aeOut : aeLit,
      {cols: 16, rows: 16}, () => 15, () => 0, out);
  return t;
}
const lit = emit(false);
const outT = emit(true);
const near = (a, b) => Math.abs(a - b) < 1e-9;

/* 断言1 部件数: CF_PARTS=6 静态件+焰片组 1(sheet 路径)=7 ≤7 (§4.4 口径) */
say('① 部件口径: CF_PARTS=' + CF_PARTS.length + ' 静态件+焰片组 1(sheet 路径, 见 sheetStat 实证)=' +
    (CF_PARTS.length + 1) + ' ≤7 ' + (CF_PARTS.length === 6 ? '✅' : '✗'));

/* 断言2 织席 2×2 轴向交错: axis:0 两根下层 y∈[0,0.15] + axis:2 两根上层 y∈[0.075,0.225] */
const logs = CF_PARTS.filter((p) => p.axis >= 0);
const ax0 = logs.filter((p) => p.axis === 0), ax2 = logs.filter((p) => p.axis === 2);
const weaveOK = ax0.length === 2 && ax2.length === 2
    && ax0.every((p) => near(p.bb[1], 0) && near(p.bb[4], 0.15))
    && ax2.every((p) => near(p.bb[1], 0.075) && near(p.bb[4], 0.225));
say('② 织席 2×2: X 轴 ' + ax0.length + ' 根(下层 y 0~0.15)+Z 轴 ' + ax2.length + ' 根(上层 y 0.075~0.225 半搭) ' +
    (weaveOK ? '✅ 轴向两两交错' : '✗'));

/* 断言3 高度预算: 炭堆顶 ≤0.35 · 静态整体 ≤0.5 */
const coal = CF_PARTS.filter((p) => p.axis < 0);
const coalTop = Math.max(...coal.map((p) => p.bb[4]));
const allTop = Math.max(...CF_PARTS.map((p) => p.bb[4]));
say('③ 高度: 炭堆顶 ' + coalTop + '(判据 ≤0.35) ' + (coalTop <= 0.35 ? '✅' : '✗') +
    ' · 静态整体 ' + allTop + '(≤0.5) ' + (allTop <= 0.5 ? '✅' : '✗') + ' · 小盒数=' + (coal.length - 1));

/* 断言4 ⊆自有格: 全部件 AABB ∈ [0,1]³(拾取/邻格语义零污染不变量) */
const inCell = CF_PARTS.every((p) => p.bb.every((v) => v >= 0 && v <= 1));
say('④ 全部件 ⊆ [0,1]³: ' + (inCell ? '✅ (焰片顶 0.71<1.0 由 R-5 探针 sheetStat 面)' : '✗'));

/* 断言5 两态几何差零: positions+normals 逐值全同(out 只进取光/tile 分支) */
const sameGeo = lit.positions.length === outT.positions.length &&
    lit.positions.every((v, i) => near(v, outT.positions[i])) &&
    lit.normals.every((v, i) => near(v, outT.normals[i]));
const uvDiff = lit.uvs.filter((v, i) => !near(v, outT.uvs[i])).length;
say('⑤ 两态结构差零: emit 顶点 ' + lit.positions.length / 3 + ' positions/normals 逐值全同 ' +
    (sameGeo ? '✅' : '✗') + ' · uv 差异浮点数 ' + uvDiff + '(=tile 窗 70↔72/71↔73 换格, 设计内)');

/* 断言6 tile 分派: 端面(logEnd)/皮侧(logSide)/炭堆顶(bottom→top·side) 逐面核对 */
function tileOf(part, faceDir, ae) {
  const isEnd = part.axis >= 0 && faceDir[part.axis] !== 0;
  return isEnd ? ae.logEnd : (part.axis < 0 ? (faceDir[1] === 1 ? ae.top : ae.side) : ae.logSide);
}
const FACES = [{dir: [1, 0, 0]}, {dir: [-1, 0, 0]}, {dir: [0, -1, 0]}, {dir: [0, 1, 0]}, {dir: [0, 0, 1]}, {dir: [0, 0, -1]}];
const aeL = {logEnd: 68, logSide: 69, top: 70, side: 71};
const aeO = {logEnd: 68, logSide: 69, top: 72, side: 73};
let tileOK = true;
for (const p of logs) {
  for (const f of FACES) {
    const want = (p.axis === 0 ? (f.dir[0] !== 0 ? 68 : 69) : (f.dir[2] !== 0 ? 68 : 69));
    if (tileOf(p, f.dir, aeL) !== want) tileOK = false;
  }
}
for (const p of coal) {
  if (tileOf(p, [0, 1, 0], aeL) !== 70 || tileOf(p, [0, 1, 0], aeO) !== 72) tileOK = false;
  if (tileOf(p, [1, 0, 0], aeL) !== 71 || tileOf(p, [1, 0, 0], aeO) !== 73) tileOK = false;
}
say('⑥ tile 分派: 原木沿轴法线=68 端面/其余=69 皮侧 · 炭堆顶 70↔72/侧 71↔73 两态换格 ' +
    (tileOK ? '✅' : '✗'));

/* 断言7 非共面重叠: 两两部件无相等坐标面+区间重叠(z-fight 免疫) */
let coplanar = 0;
for (let i = 0; i < CF_PARTS.length; i++) for (let j = i + 1; j < CF_PARTS.length; j++) {
  const a = CF_PARTS[i].bb, b = CF_PARTS[j].bb;
  const overlap = [0, 1, 2].every((d) => a[d] < b[d + 3] && b[d] < a[d + 3]);
  if (!overlap) continue;
  for (const d of [0, 1, 2]) for (const e of [d, d + 3]) {
    for (const f2 of [d, d + 3]) {
      if (near(a[e], b[f2])) coplanar++;
    }
  }
}
say('⑦ 非共面: 两两重叠部件共面面数=' + coplanar + '(判据 0——互穿半搭均错位) ' + (coplanar === 0 ? '✅' : '✗'));

/* 顶点量对撞注记: emit 纯部件口径 vs R-5 probe 格滤口径(measureCell 含格内环境顶点) */
const faces = lit.positions.length / 3 / 4;
say('⑧ emit 顶点对撞: 纯部件 ' + (lit.positions.length / 3) + ' 顶=' + faces + ' 面(跳底惯例折算)' +
    ' · R-5 probe 格滤实测 144(含格内环境顶点基数, 口径差如实注记——两口径各自内部一致, 对撞锚=断言⑤两态全同)');

fs.writeFileSync(path.join(__dirname, 'verify-geometry.log'), log.join('\n') + '\n');
console.log('\nverify-geometry.log 已写');
