'use strict';
/* ============================================================
   T-C6 基准 · headless Chrome 真浏览器帧时基准 runner — 一次性装具
   ------------------------------------------------------------
   票文口径: 帧时分布以 headless 工具实测落盘(派令工程纪律明示路径)。
   本 runner: ① 从 index.html 生成基准页(.scratch/campfire/tc6-bench.html,
   注入 prelude 低核覆盖 + 基准驱动, 零产品 js 改动); ② 起 server.js;
   ③ headless Chrome(SwiftShader 软渲染, 无 GPU——绝对值偏保守, 用于
   负载量级/桌面与低核分档对照)跑探险壳体验馆同屏 50 火; ④ 从 stderr
   捕获 TC6JSON 落盘; ⑤ 杀进程收尾。
   两轮: desktop(?dev=1) 与 lowcore(?dev=1&touch=1&lowcore=1 —
   config.js 官方低核桌面预览口: IS_TOUCH 强制 + 逻辑核覆盖 ≤2)。
   用法: node .scratch/campfire/tc6-bench-page.js
   ============================================================ */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const HERE = __dirname;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8807;
const PAGE = path.join(HERE, 'tc6-bench.html');

/* ---------- 驱动脚本(注入生成页; 经典 script, 全局词法直取产品装配件) ---------- */
const DRIVER = `
window.addEventListener('load', function() {
  var LOG = function(m) { try { console.log('TC6LOG:' + m); } catch (e) {} };
  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
  function sampleFrames(ms) {
    return new Promise(function(resolve) {
      var xs = []; var last = 0; var t0 = performance.now();
      function step(t) {
        if (last) xs.push(t - last);
        last = t;
        if (t - t0 >= ms) return resolve(xs);
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  function stats(xs) {
    if (!xs.length) return null;
    var s = xs.slice().sort(function(a, b) { return a - b; });
    var mean = 0;
    for (var i = 0; i < s.length; i++) mean += s[i];
    mean /= s.length;
    function pct(p) { return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
    return {n: s.length, mean: mean, p50: pct(0.5), p95: pct(0.95),
      p99: pct(0.99), max: s[s.length - 1]};
  }
  /* 50 火确定性摆位(网格偏移, 相对玩家; 禁随机) */
  function grid50(step) {
    var out = [];
    for (var row = 0; row < 7; row++) {
      for (var col = 0; col < 7; col++) {
        if ((row === 0 || row === 6) && (col === 0 || col === 6)) continue;
        out.push([(col - 3) * step, (row - 3) * step]);
      }
    }
    out.push([-2 * step, 6 * step], [-1 * step, 6 * step], [0, 6 * step],
        [1 * step, 6 * step], [2 * step, 6 * step]);
    return out; /* 50 项 */
  }
  function countMeshes() {
    var n = 0;
    scene.traverse(function(o) { if (o.isMesh) n++; });
    return n;
  }
  function collectCounts(placed) {
    var flame = 0; var smoke = 0; var vortex = 0; var transients = 0;
    var tiers = {full: 0, near: 0, far: 0};
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      var ps = advCampfireFx.particles(p.x, p.y, p.z);
      flame += ps.flame.length; smoke += ps.smoke.length;
      vortex += ps.vortex.length; transients += ps.transients.length;
      var em = advCampfireFx.emitters(p.x, p.y, p.z);
      if (em && em.budget) tiers[em.budget]++;
    }
    return {fires: placed.length, flame: flame, smoke: smoke, vortex: vortex,
      transients: transients, total: flame + smoke + vortex + transients,
      perFire: (flame + smoke + vortex) / placed.length, tiers: tiers,
      fxActive: advCampfireFx.activeCount(), updraft: UPDRAFT_SIM.count(),
      meshes: countMeshes()};
  }
  function placeAll(offs, px, pz, sinkMs) {
    var placed = [];
    for (var i = 0; i < offs.length; i++) {
      var x = px + offs[i][0]; var z = pz + offs[i][1];
      var y = groundTop(x, z) + 1;
      var t0 = performance.now();
      editBlock(x, y, z, B_CAMPFIRE); /* 写格+增量光 BFS+网格收口(生产同缝) */
      advCampfires.plant(x, y, z); /* 台账+气柱注册 */
      advCampfireFx.open(x, y, z); /* 特效句柄开 */
      sinkMs.push(performance.now() - t0);
      placed.push({x: x, y: y, z: z});
    }
    return placed;
  }
  function removeAll(placed, sinkMs) {
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      var t0 = performance.now();
      editBlock(p.x, p.y, p.z, 0, {debris: false});
      advCampfires.drop(p.x, p.y, p.z);
      advCampfireFx.dig(p.x, p.y, p.z);
      sinkMs.push(performance.now() - t0);
    }
  }
  function timeQuery(n) {
    var px = pos.x + 0.5; var pz = pos.z + 0.5;
    var ys = groundTop(Math.round(pos.x), Math.round(pos.z));
    var t0 = performance.now();
    var hit = 0;
    for (var i = 0; i < n; i++) {
      if (UPDRAFT_SIM.query(px, ys, pz)) hit++;
    }
    return {calls: n, ms: performance.now() - t0, usPerCall: (performance.now() - t0) * 1000 / n, hits: hit};
  }
  function statsOf(xs) { return stats(xs); }

  async function main() {
    LOG('driver start, lowcore=' + (typeof IS_LOWCORE_TOUCH !== 'undefined' ? IS_LOWCORE_TOUCH : '?'));
    switchMode('showroom');
    touchPlaying = true; /* 主循环 gameplay 门(headless 无手势, 直开等价位) */
    await sleep(3000); /* 体验馆 loadScene+渐进铺满 */

    var base = await sampleFrames(6000);

    var px = Math.round(pos.x); var pz = Math.round(pos.z);
    LOG('spawn=' + px + ',' + pz);

    /* 场景 A: 密集 50(间距 5, 全部 ≤40 格 → 全额 3+降半 47) */
    var placeMsA = [];
    var placedA = placeAll(grid50(5), px, pz, placeMsA);
    LOG('A placed=' + placedA.length);
    await sleep(6500); /* 渐起 0.5s+烟寿 4.5s+余量 */
    var framesA = await sampleFrames(10000);
    var countsA = collectCounts(placedA);
    var queryA = timeQuery(2000);

    var rmMs = [];
    removeAll(placedA, rmMs);
    await sleep(2000);

    /* 场景 B: 疏散 50(间距 18, 远格 → far 档混入) */
    var placeMsB = [];
    var placedB = placeAll(grid50(18), px, pz, placeMsB);
    LOG('B placed=' + placedB.length);
    await sleep(6500);
    var framesB = await sampleFrames(10000);
    var countsB = collectCounts(placedB);
    var queryB = timeQuery(2000);

    removeAll(placedB, rmMs);
    await sleep(1000);

    var report = {
      lowcore: (typeof IS_LOWCORE_TOUCH !== 'undefined') ? !!IS_LOWCORE_TOUCH : null,
      dpr: (typeof renderer !== 'undefined' && renderer.getPixelRatio) ? renderer.getPixelRatio() : null,
      viewport: {w: innerWidth, h: innerHeight},
      baselineFrames: stats(base),
      sceneA: {step: 5, frames: stats(framesA), counts: countsA, query: queryA,
        placeMs: stats(placeMsA)},
      sceneB: {step: 18, frames: stats(framesB), counts: countsB, query: queryB,
        placeMs: stats(placeMsB)},
      removeMs: stats(rmMs),
      fxNow: advCampfireFx.now(), fxCellsLeft: advCampfireFx.cells().length,
    };
    console.log('TC6JSON:' + JSON.stringify(report));
    LOG('done');
  }
  main().catch(function(e) {
    console.log('TC6ERR:' + ((e && e.stack) ? e.stack : String(e)));
  });
});
`;

/* ---------- prelude(生成页 head 注入: ① <base href="/"> 修子路径相对引用 404;
   ② 低核覆盖 script, 只在 ?lowcore=1 生效) ---------- */
const PRELUDE = `
if ((location.search || '').indexOf('lowcore=1') >= 0) {
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', {value: 2, configurable: true});
  } catch (e) {}
}
`;

function generatePage() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const baseTag = '<base href="/">\n';
  const prelude = '<script>/* T-C6 基准 prelude(生成件, 非产品) */' + PRELUDE + '</script>\n';
  const driver = '<script>/* T-C6 基准驱动(生成件, 非产品) */' + DRIVER + '</script>\n</body>';
  let out;
  if (html.includes('</head>')) {
    out = html.replace('</head>', baseTag + prelude + '</head>');
  } else {
    throw new Error('index.html 缺 </head>');
  }
  if (!out.includes('</body>')) throw new Error('index.html 缺 </body>');
  out = out.replace('</body>', driver);
  fs.writeFileSync(PAGE, out, 'utf8');
  return PAGE;
}

function ping(port) {
  return new Promise((resolve) => {
    const req = http.get({host: '127.0.0.1', port, path: '/ping', timeout: 1000}, (r) => {
      r.resume();
      resolve(r.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function waitForServer(port, tries) {
  return new Promise((resolve, reject) => {
    const n = tries || 40;
    const attempt = async (k) => {
      if (await ping(port)) return resolve(true);
      if (k >= n) return reject(new Error('server 不就绪'));
      setTimeout(() => attempt(k + 1), 250);
    };
    attempt(0);
  });
}

function runChrome(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-logging=stderr',
      '--v=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--user-data-dir=' + path.join(process.env.TEMP || HERE, 'tc6-chrome-profile'),
      '--window-size=1280,800',
      url,
    ];
    const child = spawn(CHROME, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let buf = '';
    let json = null;
    const logs = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('chrome 超时(' + timeoutMs + 'ms), 已捕获 ' + logs.length + ' 条日志'));
    }, timeoutMs);
    child.stderr.on('data', (d) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        const m = line.match(/TC6JSON:(\{.*\})/);
        if (m) {
          try { json = JSON.parse(m[1]); } catch (e) { json = null; }
        }
        const lm = line.match(/TC6(?:LOG|ERR):(.*)$/);
        if (lm) logs.push(lm[1]);
      }
      if (json) {
        clearTimeout(timer);
        child.kill();
        resolve({json, logs});
      }
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('exit', () => {
      clearTimeout(timer);
      if (!json) reject(new Error('chrome 退出未捕获 JSON; 日志:\n' + logs.join('\n')));
    });
  });
}

async function main() {
  const page = generatePage();
  console.log('基准页生成: ' + page);
  const server = spawn('node', [path.join(ROOT, 'server.js'), String(PORT)],
      {stdio: 'ignore', shell: true});
  try {
    await waitForServer(PORT);
    console.log('server.js 就绪 :'+PORT);
    const variants = [
      {name: 'desktop', url: 'http://127.0.0.1:' + PORT + '/.scratch/campfire/tc6-bench.html?dev=1'},
      {name: 'lowcore', url: 'http://127.0.0.1:' + PORT + '/.scratch/campfire/tc6-bench.html?dev=1&touch=1&lowcore=1'},
    ];
    const results = {};
    for (const v of variants) {
      console.log('跑 ' + v.name + ' ...');
      try {
        const r = await runChrome(v.url, 150000);
        results[v.name] = r.json;
        fs.writeFileSync(path.join(HERE, 'tc6-bench-chrome-' + v.name + '.json'),
            JSON.stringify(r.json, null, 2), 'utf8');
        fs.writeFileSync(path.join(HERE, 'tc6-bench-chrome-' + v.name + '.log'),
            r.logs.join('\n') + '\n', 'utf8');
        console.log(v.name + ' 完成: 场景A p50=' + (r.json.sceneA && r.json.sceneA.frames ?
            r.json.sceneA.frames.p50.toFixed(1) : '?') + 'ms 场景B p50=' +
            (r.json.sceneB && r.json.sceneB.frames ? r.json.sceneB.frames.p50.toFixed(1) : '?') + 'ms');
      } catch (e) {
        console.error(v.name + ' 失败: ' + e.message);
        results[v.name] = {error: e.message};
      }
    }
    fs.writeFileSync(path.join(HERE, 'tc6-bench-chrome.json'),
        JSON.stringify(results, null, 2), 'utf8');
    console.log('全部落盘 .scratch/campfire/tc6-bench-chrome*.json');
  } finally {
    server.kill();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('runner 失败: ' + (e.stack || e.message));
    process.exit(1);
  });
}
module.exports = { generatePage };
