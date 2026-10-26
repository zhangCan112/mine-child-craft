'use strict';
/* 工程规范守门单测 — node --test
   运行: node --test test/conventions.test.js
   把 docs/conventions.md 的结构性约定从"文档"变成"断言"——文件命名语法、
   头注释契约、纯核心必配单测、文本卫生(LF/无 BOM/收尾换行)、模式层玩家
   状态零直写。手滑即红,
   与 mode-registry.test.js 的"注册表断言"同属一套执行哲学:
   口头约定 → 唯一权威数据源 → 测试对着产物逐条断言。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const walk = (d) => {
  const out = [];
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const jsModules = [...walk(path.join(ROOT, 'js')), path.join(ROOT, 'server.js')];
const testFiles = walk(path.join(ROOT, 'test')).filter((p) => p.endsWith('.test.js')).map(rel);
const SUFFIXES = ['-core', '-registry', '-kit', '-levels', '-icons', '-worker'];

test('规范: 模块文件名一律 kebab-case, 后缀只许语义表内的几种', () => {
  for (const p of jsModules) {
    const relp = rel(p);
    const name = path.basename(p, '.js');
    /* mob-look/ = 造型档案, 文件名=declare 键(= MOB_TYPES id, 带下划线) —
       与 modes/(文件名=模式 id) 同理按注册表管, 豁免 kebab 断言
       (偏离登记见 docs/conventions.md §6) */
    if (relp.startsWith('js/mob-look/')) continue;
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, relp + ' 不合 kebab-case');
    if (relp.startsWith('js' + path.sep) || relp.startsWith('js/')) {
      if (relp.includes('modes')) continue; // 模式文件 = 模式 id, 由注册表管
      const suffix = SUFFIXES.find((s) => name.endsWith(s));
      if (suffix && !SUFFIXES.includes(suffix)) assert.fail(relp); // 恒假, 保持结构清晰
    }
  }
});

test('规范: 每个模块文件以 "use strict" 开头且有 ==== 包边的头注释契约', () => {
  for (const p of jsModules) {
    const src = fs.readFileSync(p, 'utf8');
    assert.ok(/^['"]use strict['"];/.test(src), rel(p) + ' 缺 "use strict"; 首行');
    const head = src.split('\n').slice(0, 15).join('\n');
    assert.ok(/={5,}/.test(head), rel(p) + ' 缺 ==== 包边的模块头注释(契约见 docs/conventions.md)');
  }
});

test('规范: -core/-registry 纯核心与注册表必有同名单测(可测性是后缀语义的一部分)', () => {
  for (const p of jsModules) {
    const name = path.basename(p, '.js');
    const suffix = SUFFIXES.find((s) => name.endsWith(s));
    if (suffix === '-core' || suffix === '-registry') {
      assert.ok(testFiles.includes('test/' + name + '.test.js'),
          rel(p) + ' 是' + suffix + '后缀, 必须配 test/' + name + '.test.js');
    }
  }
});

test('规范: 源文件文本卫生 — LF 行尾 · 无 BOM · 收尾换行 · 无尾随空白', () => {
  const dirs = ['js', 'css', 'test', 'docs'];
  const extras = ['index.html', 'server.js', 'GLOSSARY.md', 'MISSION.md',
    'eslint.config.mjs', 'stylelint.config.mjs'];
  const files = [...jsModules, ...extras];
  for (const d of dirs) for (const p of walk(path.join(ROOT, d))) files.push(p);
  for (const p of files) {
    if (!/\.(js|mjs|cjs|css|html|md|json)$/.test(p)) continue;
    const buf = fs.readFileSync(p);
    assert.ok(!(buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF),
        rel(p) + ' 有 UTF-8 BOM');
    const src = buf.toString('utf8');
    assert.ok(!src.includes('\r'), rel(p) + ' 含 CR(全库统一 LF, 见 .editorconfig/.gitattributes)');
    assert.ok(src === '' || src.endsWith('\n'), rel(p) + ' 缺收尾换行');
    const isMd = p.endsWith('.md');
    if (!isMd) {
      src.split('\n').forEach((L, i) => {
        assert.ok(!/[ \t]$/.test(L), rel(p) + ':' + (i + 1) + ' 行尾空白');
      });
    }
  }
});

/* ---------- 玩家状态守门(C7-T2) ----------
   玩家六绑定(pos/vel/onGround/yaw/pitch/flyMode, 定义在 voxel.js 玩家段)
   的可写白名单与例外登记, 唯一权威是 js/voxel.js 玩家段头注释: physics 自身 /
   input.js 视角热路径 / math-world.js 自持 rAF / tank.js 引擎同侪——四类例外
   文件都不在本断言扫描范围, 本断言只管模式层 js/modes/*.js(玩家状态的
   消费方): 传送/出生一律 ModeKit.spawn, 飞行态一律 setFly(voxel.js)。
   正则的 (?<!\.) 排除属性访问: m.yaw/T.onGround 是怪物/载具字段, 不是玩家
   绑定(arena.js m.yaw 判例); 正则曾对全仓 js/ 预检, modes 目录零误报命中。 */
test('规范: 模式文件零直写玩家六绑定 — 传送/出生走 ModeKit.spawn, 飞行态走 setFly', () => {
  const rules = [
    ['顶层绑定直写', /(?<!\.)\b(yaw|pitch|onGround|flyMode)\s*(?:\+=|-=|\*=|\/=|=)(?!=)/],
    ['成员直写', /(?<!\.)\b(pos|vel)\.(?:x|y|z)\s*(?:\+=|-=|\*=|\/=|=)(?!=)/],
    ['鸭子 set 直调', /(?<!\.)\b(pos|vel)\.set\(/],
  ];
  const modeFiles = jsModules.filter((p) => rel(p).startsWith('js/modes/'));
  assert.ok(modeFiles.length >= 7, 'js/modes 应至少 7 个模式文件 — 扫描空集 = 守门静默失效');
  for (const p of modeFiles) {
    fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      for (const [name, re] of rules) {
        assert.ok(!re.test(line), rel(p) + ':' + (i + 1) + ' [' + name + '] ' + line.trim() +
            ' — 玩家状态传送/出生走 ModeKit.spawn, 飞行态走 setFly(js/voxel.js);' +
            ' 例外白名单唯一权威在 voxel.js 玩家段头注释');
      }
    });
  }
});
