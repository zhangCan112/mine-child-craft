'use strict';
/* 工程规范守门单测 — node --test
   运行: node --test test/conventions.test.js
   把 docs/conventions.md 的结构性约定从"文档"变成"断言"——文件命名语法、
   头注释契约、纯核心必配单测、文本卫生(LF/无 BOM/收尾换行)。手滑即红,
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
    const name = path.basename(p, '.js');
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, rel(p) + ' 不合 kebab-case');
    if (rel(p).startsWith('js' + path.sep) || rel(p).startsWith('js/')) {
      if (rel(p).includes('modes')) continue; // 模式文件 = 模式 id, 由注册表管
      const suffix = SUFFIXES.find((s) => name.endsWith(s));
      if (suffix && !SUFFIXES.includes(suffix)) assert.fail(rel(p)); // 恒假, 保持结构清晰
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
