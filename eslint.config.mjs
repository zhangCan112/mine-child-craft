// ESLint 配置 —— 规范正文见 docs/conventions.md，规则依据见 docs/google-style-research.md
// 基线: eslint-config-google（Google JavaScript Style Guide 的机检子集）
//       + 补指南缺口(no-eval/eqeqeq) + 本地适配(列宽 100，中文注释按字符计数天然更长)。
// 本仓库是经典 <script> 共享词法环境（无模块系统）: 所有 js 文件的顶层声明互相可见，
// ESLint 逐文件 lint 无法跨文件推断 → 加载时动态扫描 js/ 顶层声明生成跨文件全局名单，
// 新增模块自动纳入，无需手工登记。no-undef 由此可查跨文件引用手滑。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import google from 'eslint-config-google';
import globals from 'globals';
import { builtinRules } from 'eslint/use-at-your-own-risk';

// eslint-config-google 是老包：含 ESLint 10 已移除的规则(valid-jsdoc 等)，按内置规则集过滤
const googleRules = Object.fromEntries(
  Object.entries(google.rules).filter(([id]) => builtinRules.has(id)));

const root = path.dirname(fileURLToPath(import.meta.url));

function scanModuleGlobals() {
  const names = new Set(['THREE']); // lib/three.min.js 注入
  // 深度感知解析：一行可含多语句(const A=1; const B=2;)，一语句可含多声明符(let a=1, b=2)
  const splitStatements = (line) => {
    const out = [];
    let depth = 0, cur = '', q = null;
    for (const ch of line) {
      if (q) { cur += ch; if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth--;
      if (ch === ';' && depth <= 0) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  };
  const declaratorNames = (rest) => {
    // 声明符列表 "a = 1, b = {x:1, y:2}, c" → ['a','b','c']（深度 0 逗号分段，段首标识符即名字）
    const names = [], segments = [];
    let depth = 0, q = null, cur = '';
    for (const ch of rest) {
      if (q) { cur += ch; if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
      if ('([{'.includes(ch)) { depth++; cur += ch; continue; }
      if (')]}'.includes(ch)) { depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { segments.push(cur); cur = ''; continue; }
      cur += ch;
    }
    segments.push(cur);
    for (const seg of segments) {
      const m = seg.trim().match(/^([A-Za-z_$][\w$]*)/);
      if (m) names.push(m[1]);
    }
    return names;
  };
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.js')) {
        for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
          if (!/^(const|let|var|function|class)\s/.test(line)) continue;
          for (const stmt of splitStatements(line)) {
            const s = stmt.trim();
            const m = s.match(/^(?:const|let|var)\s+(.*)$/s);
            if (m) names.add(...declaratorNames(m[1]));
            const f = s.match(/^(?:function|class)\s+([A-Za-z_$][\w$]*)/);
            if (f) names.add(f[1]);
          }
        }
      }
    }
  };
  walk(path.join(root, 'js'));
  return Object.fromEntries([...names].sort().map((n) => [n, 'writeable']));
}
const moduleGlobals = scanModuleGlobals();

// Google 基线 + 指南缺口补齐 + 本地适配（各文件块共享）
const googleBase = {
  ...googleRules,
  'no-eval': 'error',                       // 指南 §5.11.2 禁 eval/Function 构造器，google 配置漏配
  'eqeqeq': ['error', 'allow-null'],        // 指南 §5.10: 用 ===，例外 == null
  'no-undef': 'error',                      // 跨文件手滑的查错主力（配上面的动态 globals）
  'max-len': [                            // 指南 §4.4 是 80。本地: 120 上限 + 数据表行豁免
    'error',
    {
      code: 120,
      ignoreUrls: true,
      // 参数表驱动(MISSION 锁定风格): 整行数据记录不折行, 一行一条可扫读
      //   覆盖两类: "key: {…}," 记录行 与 "BLOCKS[KEY] = {…};" 方块表行
      ignorePattern: '^\\s*(?:[\\w$]+:\\s*\\{.*\\},?|BLOCKS\\[[\\w$]+\\]\\s*=\\s*\\{.*\\};?)\\s*(//.*)?$',
    },
  ],
};

export default [
  {
    ignores: ['node_modules/', 'lib/', 'data/', '.pinpoint/'],
  },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      sourceType: 'script',                 // 经典 script，不是 ES module
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...moduleGlobals,
        module: 'writeable',                // CommonJS 导出守卫(typeof module !== 'undefined')
        require: 'writeable',
      },
    },
    rules: {
      ...googleBase,
      // 共享词法环境: 顶层声明是潜在的跨文件公共接口("本文件定义、他文件消费"是常态)，
      // 逐文件的 unused 判定无意义，关闭；真正的未用靠 boot.test.js 全链冒烟兜底。
      'no-unused-vars': 'off',
      // 顶层 let 可能被其他文件写(input.js 写 pitch、build.js 写 flyMode)——逐文件分析
      // 看不见跨文件赋值，const 化判定不可靠(曾把 flyMode const 化炸运行时)，关闭。
      // 文件内部仍应默认 const(指南 §5.1.1)，test/ 与 server.js 保持该规则。
      'prefer-const': 'off',
    },
  },
  {
    files: ['js/mesh-worker.js'],           // Worker 入口: 浏览器 Worker 环境
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    files: ['server.js'],                   // 纯 Node 静态服务器
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.node },
    },
    rules: googleBase,
  },
  {
    files: ['test/**/*.js'],                // node --test（CommonJS）
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.node, ...moduleGlobals },
    },
    rules: { ...googleBase, 'no-invalid-this': 'off' },
  },
];
