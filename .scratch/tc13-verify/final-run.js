// T-C13 绿方终验: 跑两红测文件, 结果干净落盘 UTF-8(替代 Out-File, conventions 7.3)
'use strict';
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const r = spawnSync(process.execPath, ['--test', 'test/texture-atlas.test.js', 'test/campfire-kit.test.js'],
  {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
const out = (r.stdout || '') + (r.stderr || '');
fs.writeFileSync(__dirname + '/green-final.log', out, 'utf8');
const m = out.match(/# tests (\d+)[\s\S]*?# pass (\d+)[\s\S]*?# fail (\d+)[\s\S]*?# skipped (\d+)/) ||
  out.match(/tests (\d+)[\s\S]*?pass (\d+)[\s\S]*?fail (\d+)[\s\S]*?skipped (\d+)/);
console.log('tests=' + m[1] + ' pass=' + m[2] + ' fail=' + m[3] + ' skipped=' + m[4]);
const fails = [...out.matchAll(/✖ ([^\r\n]+?) \(\d+\.\d+ms\)/g)].map((x) => x[1]);
console.log('红名单: ' + (fails.length ? fails.join(' | ') : '无'));
