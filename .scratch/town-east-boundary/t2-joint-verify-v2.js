'use strict';
/* T2-joint 联验核账探针 v2: 逐 op 归因。域=南缘计数域 nonAir(32,127,24,27,128,128)。
   v1 教训: 朴素 fill 展开双态均 384 格而世界 283/288, op 表存在 scrub/place 及
   后写覆盖语义, 需逐 op 归因+执行器语义建模。输出 ASCII 直写文件。 */
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
  out('[' + tag + '] ops=' + ops.length);
  return ops;
}

const D = {x1: 32, x2: 127, y1: 24, y2: 27, z1: 128, z2: 128};
const ov = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2) && !(a.y2 < b.y1 || a.y1 > b.y2) &&
    !(a.z2 < b.z1 || a.z1 > b.z2);
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const volIn = (o) => (clampN(o.x2, D.x1, D.x2) - clampN(o.x1, D.x1, D.x2) + 1) *
    (clampN(o.y2, D.y1, D.y2) - clampN(o.y1, D.y1, D.y2) + 1) *
    (clampN(o.z2, D.z1, D.z2) - clampN(o.z1, D.z1, D.z2) + 1);

/* scrub 单柱(x, top=表面格, z): 展开为该柱 top 及其上矮丛格(SceneKit.salt 定形,
   探针只钉单格归因面: top 格本身) */
const touchesD = (o) => o.op === 'fill' && ov(o, D) ||
    o.op === 'scrub' && o.x >= D.x1 && o.x <= D.x2 && o.z >= D.z1 && o.z <= D.z2 &&
      o.top >= D.y1 && o.top <= D.y2 ||
    o.op === 'place' && ov(o, D);

for (const [tag, root, flat] of [['OLD_9ba1821', OLD, true], ['NEW_b4cd21d', ROOT, false]]) {
  const ops = loadState(root, tag, flat);
  out('=== ' + tag + ' ops intersecting south-edge domain ===');
  let i = 0;
  for (const o of ops) {
    if (!touchesD(o)) continue;
    i++;
    const g = o.op === 'scrub' ? 'scrub@' + o.x + ',' + o.top + ',' + o.z + ' salt=' + o.salt
      : '[' + [o.x1, o.y1, o.z1, o.x2, o.y2, o.z2].join(' ') + ']';
    out('  #' + i + ' ' + o.op + ' ' + g + ' id=' + o.id +
        (o.op === 'fill' ? ' cellsInD=' + volIn(o) : '') +
        (o.id2 !== undefined ? ' stepId=' + o.id2 : ''));
  }
  if (i === 0) out('  (none)');
}
out('');

/* 开口带双态: x76..80 x y25..27 x z128 相交的 op 清单 */
for (const [tag, root, flat] of [['OLD', OLD, true], ['NEW', ROOT, false]]) {
  const ops = loadState(root, tag, flat);
  const B = {x1: 76, x2: 80, y1: 25, y2: 27, z1: 128, z2: 128};
  out('=== ' + tag + ' ops intersecting OPENING x76..80 y25..27 z128 ===');
  let n = 0;
  for (const o of ops) {
    if (o.op === 'fill' && ov(o, B)) { n++; out('  fill [' + [o.x1, o.y1, o.z1, o.x2, o.y2, o.z2].join(' ') + '] id=' + o.id); }
    else if (o.op === 'place' && ov(o, B)) { n++; out('  place [' + [o.x1, o.y1, o.z1, o.x2, o.y2, o.z2].join(' ') + '] id=' + o.id); }
    else if (o.op === 'scrub' && o.x >= 76 && o.x <= 80 && o.z === 128 && o.top >= 25 && o.top <= 27) { n++; out('  scrub@' + o.x + ',' + o.top + ',' + o.z); }
  }
  if (n === 0) out('  (none)');
}
out('');

/* 变更格 (75,27,128) 写者链: 双态所有触该格 op */
for (const [tag, root, flat] of [['OLD', OLD, true], ['NEW', ROOT, false]]) {
  const ops = loadState(root, tag, flat);
  out('=== ' + tag + ' ops touching cell 75,27,128 ===');
  let n = 0;
  for (const o of ops) {
    if (o.op === 'fill' && o.x1 <= 75 && o.x2 >= 75 && o.y1 <= 27 && o.y2 >= 27 &&
        o.z1 <= 128 && o.z2 >= 128) { n++; out('  fill [' + [o.x1, o.y1, o.z1, o.x2, o.y2, o.z2].join(' ') + '] id=' + o.id); }
    if (o.op === 'scrub' && o.x === 75 && o.z === 128) { n++; out('  scrub@' + o.x + ',' + o.top + ',' + o.z + ' salt=' + o.salt); }
  }
  if (n === 0) out('  (none)');
}

fs.writeFileSync(path.join(HERE, 't2-joint-verify-v2.out.txt'), lines.join('\n') + '\n', 'utf8');
out('report written: .scratch/t2-joint-verify-v2.out.txt');
