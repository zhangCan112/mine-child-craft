'use strict';
/* T2-joint 联验核账探针(T1a 交T2 联验进位票, 派令第 3 条):
   双态块集合对账——合并态(工作树=b4cd21d) vs 无 T1a/T3 态(9ba1821 提取件),
   南缘计数域 nonAir(32,127,24,27,128,128) 逐格展开, 后写者赢归属,
   产出 +5 逐块坐标/id/来源 op 清单 + 开口净空 + z129..131 缓冲带现状。
   输出纯 ASCII(坐标数字), 报告直写 .scratch/t2-joint-verify.out.txt
   (conventions 7.3: 留档走文件不走控制台管道)。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const HERE = __dirname;
const ROOT = path.join(HERE, '..');
const OLD = path.join(HERE, 'old9ba');
const FILES = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
  'js/town-map-core.js', 'js/town-assembly-core.js'];
const lines = [];
const out = (s) => { lines.push(s); console.log(s); };

function loadState(jsRoot, tag, flatStripJs) {
  const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
  for (const f of FILES) {
    const p = flatStripJs ? path.join(jsRoot, f.slice(3)) : path.join(jsRoot, f);
    vm.runInContext(fs.readFileSync(p, 'utf8'), eng, {filename: tag + '/' + f});
  }
  const ops = JSON.parse(vm.runInContext(
      'JSON.stringify(townAssemblyOps(townBuildSteps()))', eng));
  const fills = ops.filter((o) => o.op === 'fill');
  out('[' + tag + '] ops=' + ops.length + ' fills=' + fills.length);
  return {ops, fills};
}

/* 计数域 = 南缘断言几何(nonAir(32,127,24,27,128,128)) */
const D = {x1: 32, x2: 127, y1: 24, y2: 27, z1: 128, z2: 128};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* 逐格展开(fill 序序覆盖=后写者赢, 与世界语义同构); 记最后写者 op */
function cellsInDomain(state) {
  const map = new Map();
  for (const o of state.fills) {
    const x1 = clamp(o.x1, D.x1, D.x2), x2 = clamp(o.x2, D.x1, D.x2);
    const y1 = clamp(o.y1, D.y1, D.y2), y2 = clamp(o.y2, D.y1, D.y2);
    const z1 = clamp(o.z1, D.z1, D.z2), z2 = clamp(o.z2, D.z1, D.z2);
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        for (let z = z1; z <= z2; z++) {
          map.set(x + ',' + y + ',' + z, {id: o.id,
            op: [o.x1, o.y1, o.z1, o.x2, o.y2, o.z2, o.id]});
        }
      }
    }
  }
  return map;
}

/* 域外/缓冲带任意域展开(独立小域, 后写者赢同构) */
function cellsInBox(state, B) {
  const map = new Map();
  for (const o of state.fills) {
    const x1 = clamp(o.x1, B.x1, B.x2), x2 = clamp(o.x2, B.x1, B.x2);
    const y1 = clamp(o.y1, B.y1, B.y2), y2 = clamp(o.y2, B.y1, B.y2);
    const z1 = clamp(o.z1, B.z1, B.z2), z2 = clamp(o.z2, B.z1, B.z2);
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        for (let z = z1; z <= z2; z++) {
          map.set(x + ',' + y + ',' + z, {id: o.id,
            op: [o.x1, o.y1, o.z1, o.x2, o.y2, o.z2, o.id]});
        }
      }
    }
  }
  return map;
}

const scrubsInDomain = (state) => state.ops.filter((o) => o.op === 'scrub' &&
    !(o.x2 < D.x1 || o.x1 > D.x2) && !(o.z2 < D.z1 || o.z1 > D.z2));

const oldState = loadState(OLD, 'old9ba_9ba1821', true);
const newState = loadState(ROOT, 'merged_b4cd21d');
out('');

const oldCells = cellsInDomain(oldState);
const newCells = cellsInDomain(newState);
out('domain x' + D.x1 + '..' + D.x2 + ' y' + D.y1 + '..' + D.y2 + ' z' + D.z1 +
    '..' + D.z2);
out('cells old=' + oldCells.size + ' new=' + newCells.size +
    ' delta=' + (newCells.size - oldCells.size));
out('scrub ops touching domain: old=' + scrubsInDomain(oldState).length +
    ' new=' + scrubsInDomain(newState).length);

const added = [];
const removed = [];
const changed = [];
for (const [k, v] of newCells) {
  if (!oldCells.has(k)) added.push(k + ' id=' + v.id + ' op=[' + v.op.join(' ') + ']');
  else if (oldCells.get(k).id !== v.id) changed.push(k + ' ' + oldCells.get(k).id + '->' + v.id);
}
for (const [k, v] of oldCells) {
  if (!newCells.has(k)) removed.push(k + ' id=' + v.id + ' op=[' + v.op.join(' ') + ']');
}
const byKey = (a, b) => a < b ? -1 : a > b ? 1 : 0;
out('--- added (' + added.length + ') ---');
added.sort(byKey).forEach((s) => out(s));
out('--- removed (' + removed.length + ') ---');
removed.sort(byKey).forEach((s) => out(s));
out('--- changed id (' + changed.length + ') ---');
changed.sort(byKey).forEach((s) => out(s));

/* 开口净空复核(既有断言面): x76..80 x y25..27 x z128 应全空 */
const OPEN = cellsInBox(newState, {x1: 76, x2: 80, y1: 25, y2: 27, z1: 128, z2: 128});
out('--- opening x76..80 y25..27 z128 blocks in merged: ' + OPEN.size +
    (OPEN.size === 0 ? ' (clear)' : ' (VIOLATION)'));
OPEN.forEach((v, k) => out('  ' + k + ' id=' + v.id));

/* z129..131 缓冲带现状(全 x 域, y20..40 扫塔身): 合并态块与来源 op */
const BUF = cellsInBox(newState, {x1: 0, x2: 159, y1: 20, y2: 40, z1: 129, z2: 131});
out('--- buffer z129..131 y20..40 blocks in merged: ' + BUF.size);
const bufByOp = new Map();
for (const v of BUF.values()) {
  const key = v.op.join(' ');
  const e = bufByOp.get(key) || {n: 0, id: v.id};
  e.n++;
  bufByOp.set(key, e);
}
[...bufByOp.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
    .forEach(([k, v]) => out('  op=[' + k + '] cells=' + v.n + ' id=' + v.id));
const oldBuf = cellsInBox(oldState, {x1: 0, x2: 159, y1: 20, y2: 40, z1: 129, z2: 131});
out('--- buffer z129..131 y20..40 blocks in old: ' + oldBuf.size);

fs.writeFileSync(path.join(HERE, 't2-joint-verify.out.txt'), lines.join('\n') + '\n', 'utf8');
out('report written: .scratch/t2-joint-verify.out.txt');
