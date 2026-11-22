// 评审实验(conventions 只评审不施工: 全程在 .scratch 副本上, 零触碰工作树)
// 目的: 验证 stepFields 倒序遍历是否为 R4-8 装具承重(正序 for-of 下 R4-8 是否红)
'use strict';
const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const ROOT = path.join(__dirname, '..');
const DST = path.join(__dirname, 'tc13r4-flip');
fs.rmSync(DST, {recursive: true, force: true});
fs.mkdirSync(path.join(DST, 'js'), {recursive: true});
fs.mkdirSync(path.join(DST, 'test', 'helpers'), {recursive: true});
for (const f of ['config.js', 'texture-atlas.js', 'campfire-fx-core.js', 'effects.js']) {
  fs.copyFileSync(path.join(ROOT, 'js', f), path.join(DST, 'js', f));
}
fs.copyFileSync(path.join(ROOT, 'test', 'helpers', 'fake-dom.js'),
    path.join(DST, 'test', 'helpers', 'fake-dom.js'));
fs.copyFileSync(path.join(ROOT, 'test', 'effects-campfire-sheet.test.js'),
    path.join(DST, 'test', 'effects-campfire-sheet.test.js'));
// 翻回正序(基线 d86965d 的循环头)
const eff = path.join(DST, 'js', 'effects.js');
let src = fs.readFileSync(eff, 'utf8');
const REV = '    for (let fi = fields.length - 1; fi >= 0; fi--) {\n      const f = fields[fi];\n';
const FWD = '    for (const f of fields) {\n';
if (!src.includes(REV)) { console.error('FLIP-TARGET-NOT-FOUND'); process.exit(2); }
src = src.replace(REV, FWD);
fs.writeFileSync(eff, src);
console.log('flipped to forward for-of');
// 对照组: 不翻转的另一份(正本拷贝)
const CTL = path.join(__dirname, 'tc13r4-ctl');
fs.rmSync(CTL, {recursive: true, force: true});
fs.mkdirSync(path.join(CTL, 'js'), {recursive: true});
fs.mkdirSync(path.join(CTL, 'test', 'helpers'), {recursive: true});
for (const f of ['config.js', 'texture-atlas.js', 'campfire-fx-core.js', 'effects.js']) {
  fs.copyFileSync(path.join(ROOT, 'js', f), path.join(CTL, 'js', f));
}
fs.copyFileSync(path.join(ROOT, 'test', 'helpers', 'fake-dom.js'),
    path.join(CTL, 'test', 'helpers', 'fake-dom.js'));
fs.copyFileSync(path.join(ROOT, 'test', 'effects-campfire-sheet.test.js'),
    path.join(CTL, 'test', 'effects-campfire-sheet.test.js'));
for (const [name, dir] of [['CTL(现状=倒序)', CTL], ['FLIP(正序 for-of)', DST]]) {
  console.log('=== ' + name + ' ===');
  try {
    const out = execSync('node --test test/effects-campfire-sheet.test.js',
        {cwd: dir, encoding: 'utf8', maxBuffer: 1e8});
    const pass = (out.match(/^ℹ pass\s+(\d+)/m) || [])[1];
    const fail = (out.match(/^ℹ fail\s+(\d+)/m) || [])[1];
    console.log('pass=' + pass + ' fail=' + fail);
  } catch (e) {
    const out = e.stdout || '';
    const pass = (out.match(/^ℹ pass\s+(\d+)/m) || [])[1];
    const fail = (out.match(/^ℹ fail\s+(\d+)/m) || [])[1];
    console.log('pass=' + pass + ' fail=' + fail);
    for (const m of out.matchAll(/✖ [^\n]+/g)) {
      if (/R4-|焰片|顶点/.test(m[0])) console.log('  ' + m[0].slice(0, 100));
    }
    const errLine = out.split('\n').find((l) => l.includes('AssertionError') ||
      l.includes('落在任何 open 格外'));
    if (errLine) console.log('  首错: ' + errLine.trim().slice(0, 120));
  }
}
