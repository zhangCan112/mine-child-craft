'use strict';
/* T-C2 验收复核: 绿方接线面速览(world/kit/adventure/index.html) */
const fs = require('fs');
for (const f of ['js/world.js', 'js/campfire-kit.js', 'js/modes/adventure.js']) {
  const s = fs.readFileSync(f, 'utf8');
  const lines = s.split(/\r?\n/);
  console.log('==== ' + f + ' ====');
  lines.forEach((l, i) => {
    if (/[Uu]pdraft|UPDRAFT|CF_COLUMN/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 155));
  });
}
const h = fs.readFileSync('index.html', 'utf8');
const srcs = [...h.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
console.log('==== index.html ====');
console.log('updraft-core idx: ' + srcs.indexOf('js/updraft-core.js') +
    ' | light-core: ' + srcs.indexOf('js/light-core.js') +
    ' | voxel: ' + srcs.indexOf('js/voxel.js') +
    ' | world: ' + srcs.indexOf('js/world.js'));
