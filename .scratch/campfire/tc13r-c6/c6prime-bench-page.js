'use strict';
/* ============================================================
   T-C13-R6 C6' 基准 · headless Chrome 真浏览器帧时基准 runner — 一次性装具
   ------------------------------------------------------------
   票文口径(方案 §3-f): C6' 重立基线, 旧 T-C6 收档(tc6-bench-report.md)作
   历史参照不作门槛。本 runner 照 tc6-bench-page.js 原样改参复用:
   ① 从 index.html 生成基准页 c6prime-bench.html(生成物勿手改, <base href="/">
      注入必须保留 — 子路径相对引用 404 防线, tc6 首轮超时根因);
   ② 起 server.js 自管端口(8807 起扫描, 被占顺延; 8090 是 PO 试玩服务永不触碰);
   ③ headless Chrome(SwiftShader 软渲, 无 GPU — 绝对值偏保守, 用于负载量级/
      桌面与低核分档对照)跑探险壳体验馆同屏 50 火;
   ④ 从 stderr 捕获 TC6C6JSON 落盘(标记防串: tc6 用 TC6JSON);
   ⑤ 150s 超时杀进程收尾。
   两变体: desktop(?dev=1) 与 lowcore(?dev=1&touch=1&lowcore=1)。
   相对 tc6 的新增采样面(票文范围 2/3/4):
   a. dc/tri: renderer.info.render.calls/triangles 每帧采样 — 空景/A/B 三态;
      r128 info.autoReset 每帧 reset, driver 的 rAF 在产品主循环回调之后注册,
      读数落点=本帧渲染完账; 每态采 ≥90 帧取中位+min/max, JSON 记 dcSample/
      triSample(含空景值与增量=50 火态-空景);
   b. 错相跑批观察面: 稳态窗内以 advCampfireFx.now() 为时刻源(fx 内时钟,
      零墙钟漂移口径), 每跨 0.05s 采样一次全场景 flameFrameAt 分布,
      窗 1.8s=36 时刻, 与套件协议同口径, A/B 两景都采; JSON 记每时刻分布
      与最差覆盖(worstCovered)及相位散布(flamePhase 三分桶);
   c. 切模式重挂缝覆盖核对: 场景 A 摆放前 switchMode('adventure')→
      sleep 2.5s→switchMode('showroom')→sleep 2s 往返, 再 placeAll;
      摆放稳态后 scene.traverse 数 sheet(材质特征: MeshBasic+alphaTest 0.5+
      map===atlasMat.map — chunk 用的 atlasMat 本体是 MeshLambert, 按材质类
      判别分开)应恰 1, 附可绘段 drawRange 读数; 全场网格材质 census 落
      switchCheck(chunkAtlasMeshes 增量=区块通道边角实测); 若往返在 headless
      下不稳则 try/catch 降级 LOG 级核对并如实记录(不许脑补通过);
   d. 放置链/拆除链成本照 tc6(placeMs/removeMs 逐火计时分布)。
   用法: node .scratch/campfire/tc13r-c6/c6prime-bench-page.js
   ============================================================ */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const HERE = __dirname;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT0 = 8807; /* 自管端口起点(被占顺延; 8090=PO 试玩服务在扫描窗外永不碰) */
const PAGE = path.join(HERE, 'c6prime-bench.html');
const PAGE_URL_PATH = '/.scratch/campfire/tc13r-c6/c6prime-bench.html';

/* ---------- 驱动脚本(注入生成页; 经典 script, 全局词法直取产品装配件) ---------- */
const DRIVER = `
window.addEventListener('load', function() {
  var LOG = function(m) { try { console.log('TC6C6LOG:' + m); } catch (e) {} };
  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
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
  function medStats(xs) { /* dc/tri 采样面: 中位+min/max+n(票文口径) */
    if (!xs.length) return null;
    var s = xs.slice().sort(function(a, b) { return a - b; });
    return {n: s.length, median: s[Math.floor(s.length / 2)],
      min: s[0], max: s[s.length - 1]};
  }
  /* 采样窗: rAF 逐帧收帧时+dc/tri; withMoments 时按 fx 内时钟跨 0.05s 采帧号分布 */
  function sampleWindow(ms, withMoments, placed) {
    return new Promise(function(resolve) {
      var frames = []; var dcs = []; var tris = []; var moments = [];
      var last = 0; var win0 = null; var fxBase = null; var nextB = 0;
      function step(t) {
        if (last) frames.push(t - last);
        last = t;
        var info = renderer.info.render; /* 读数落点=本帧渲染完账(autoReset 帧首 reset) */
        dcs.push(info.calls); tris.push(info.triangles);
        if (withMoments && moments.length < 36) {
          var fxT = advCampfireFx.now(); /* fx 内时钟: 零墙钟漂移口径 */
          if (fxBase === null) { fxBase = fxT; nextB = fxT + 0.05; }
          while (fxT >= nextB && moments.length < 36) {
            var d = [0, 0, 0];
            for (var i = 0; i < placed.length; i++) {
              var f = advCampfireFx.flameFrameAt(placed[i].x, placed[i].y, placed[i].z);
              if (f >= 0 && f <= 2) d[f]++;
            }
            var covered = (d[0] > 0 ? 1 : 0) + (d[1] > 0 ? 1 : 0) + (d[2] > 0 ? 1 : 0);
            moments.push({t: +nextB.toFixed(2), readAt: +fxT.toFixed(4),
              dist: d, covered: covered});
            nextB += 0.05;
          }
        }
        if (win0 === null) win0 = t;
        if (t - win0 >= ms) {
          resolve({frames: stats(frames), dc: medStats(dcs), tri: medStats(tris),
            moments: moments});
          return;
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  /* 50 火确定性摆位(网格偏移, 相对玩家; 禁随机) — tc6 原样 */
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
  /* sheet 计数+网格材质 census(重挂缝覆盖核对+dc 增量拆解证据):
     sheet 材质特征=MeshBasic 且 alphaTest 0.5 且 map===atlasMat.map(与套件识别
     口径同源; chunk 网格用的 atlasMat 本体是 MeshLambert, 须按材质类判别分开);
     chunkAtlas=Lambert+atlas 图 (chunk atlas 通道 mesh 计数, 其增量=50 火区块
     通道边角实测); 附可绘段 drawRange 对账读数 */
  function countSheets() {
    var meshes = 0; var visible = 0; var chunkAtlas = 0; var sheetBasic = 0;
    var noFrustumCull = 0; var drawable = null;
    scene.traverse(function(o) {
      if (o && o.isMesh) {
        meshes++;
        if (o.visible) visible++;
        if (o.frustumCulled === false) noFrustumCull++;
        var m = o.material;
        if (m && atlasMat && m.map === atlasMat.map) {
          if (m.isMeshLambertMaterial) chunkAtlas++;
          else if (m.isMeshBasicMaterial && m.alphaTest === 0.5) {
            sheetBasic++;
            if (o.geometry && o.geometry.drawRange) drawable = o.geometry.drawRange.count;
          }
        }
      }
    });
    return {meshes: meshes, meshesVisible: visible, chunkAtlasMeshes: chunkAtlas,
      sheetBasic: sheetBasic, sheetDrawable: drawable,
      frustumCulledFalse: noFrustumCull, atlasMapPresent: !!(atlasMat && atlasMat.map)};
  }
  function phaseSpread(placed) { /* 相位散布(fx-core 单源 flamePhase 直读) */
    var seen = {}; var distinct = 0; var buckets = [0, 0, 0];
    for (var i = 0; i < placed.length; i++) {
      var p = advCampfireFx.flamePhase(placed[i].x, placed[i].y, placed[i].z);
      var k = String(p);
      if (!seen[k]) { seen[k] = 1; distinct++; }
      buckets[Math.min(2, Math.floor(p * 3))]++;
    }
    return {n: placed.length, distinct: distinct, buckets: buckets};
  }
  function phaseSummary(win, placed) {
    var worst = 36;
    for (var i = 0; i < win.moments.length; i++) {
      if (win.moments[i].covered < worst) worst = win.moments[i].covered;
    }
    return {n: win.moments.length, worstCovered: worst, moments: win.moments,
      spread: phaseSpread(placed)};
  }
  /* 切模式重挂缝往返(headless 下不稳则降级 LOG 级, 主流程 try/catch 包住) */
  async function switchRoundtrip() {
    var t0 = performance.now();
    switchMode('adventure');
    await sleep(2500);
    switchMode('showroom');
    await sleep(2000);
    return {ms: Math.round(performance.now() - t0)};
  }

  async function main() {
    LOG('driver start, lowcore=' + (typeof IS_LOWCORE_TOUCH !== 'undefined' ? IS_LOWCORE_TOUCH : '?'));
    switchMode('showroom');
    touchPlaying = true; /* 主循环 gameplay 门(headless 无手势, 直开等价位) */
    await sleep(3000); /* 体验馆 loadScene+渐进铺满 */

    var base = await sampleWindow(6000, false, []); /* 空景基线 6s(帧时+dc/tri) */
    var baseCensus = countSheets(); /* 基线 census(chunk 通道边角/sheet 形态的对照面) */
    LOG('baseline census: ' + JSON.stringify(baseCensus) +
        ' fxActive=' + advCampfireFx.activeCount());

    /* 切模式重挂缝往返: 场景 A 摆放前(T-C13-R4/R5 装配缝: Fx.clear 摘场后
       init 重挂同一管理器是常态路径 — 往返后再摆 50 火, 稳态数 sheet 恰 1) */
    var switchCheck = {attempted: true};
    try {
      var rt = await switchRoundtrip();
      switchCheck.roundtripMs = rt.ms;
      LOG('switch roundtrip ok, ' + rt.ms + 'ms');
    } catch (e) {
      switchCheck.error = String(e && e.stack ? e.stack : e);
      LOG('switch roundtrip FAILED: ' + switchCheck.error);
      try { switchMode('showroom'); touchPlaying = true; await sleep(2000); } catch (e2) {
        switchCheck.recoverError = String(e2);
      }
    }

    var px = Math.round(pos.x); var pz = Math.round(pos.z);
    LOG('spawn=' + px + ',' + pz);

    /* 场景 A: 密集 50(间距 5, 全部 ≤40 格 → 全额 3+降半 47) */
    var placeMsA = [];
    var placedA = placeAll(grid50(5), px, pz, placeMsA);
    LOG('A placed=' + placedA.length);
    await sleep(6500); /* 渐起 0.5s+烟寿 4.5s+余量 */
    var winA = await sampleWindow(10000, true, placedA);
    var countsA = collectCounts(placedA);
    var queryA = timeQuery(2000);
    switchCheck.afterA = countSheets(); /* 摆放稳态: sheet 应恰 1(核对项)+census */
    LOG('A census=' + JSON.stringify(switchCheck.afterA));

    var rmMs = [];
    removeAll(placedA, rmMs);
    await sleep(2000);

    /* 场景 B: 疏散 50(间距 18, 远格 → far 档混入) */
    var placeMsB = [];
    var placedB = placeAll(grid50(18), px, pz, placeMsB);
    LOG('B placed=' + placedB.length);
    await sleep(6500);
    var winB = await sampleWindow(10000, true, placedB);
    var countsB = collectCounts(placedB);
    var queryB = timeQuery(2000);
    switchCheck.afterB = countSheets();
    LOG('B census=' + JSON.stringify(switchCheck.afterB));

    removeAll(placedB, rmMs);
    await sleep(1000);
    switchCheck.afterClear = countSheets(); /* 拆清: 残壳在场可绘段 0(套件同形读数) */

    var report = {
      lowcore: (typeof IS_LOWCORE_TOUCH !== 'undefined') ? !!IS_LOWCORE_TOUCH : null,
      dpr: (typeof renderer !== 'undefined' && renderer.getPixelRatio) ? renderer.getPixelRatio() : null,
      viewport: {w: innerWidth, h: innerHeight},
      baseline: {frames: base.frames, dc: base.dc, tri: base.tri,
        fxActive: advCampfireFx.activeCount(), census: baseCensus},
      sceneA: {step: 5, frames: winA.frames, counts: countsA, query: queryA,
        placeMs: stats(placeMsA), dc: winA.dc, tri: winA.tri,
        dcInc: winA.dc && base.dc ? winA.dc.median - base.dc.median : null,
        triInc: winA.tri && base.tri ? winA.tri.median - base.tri.median : null,
        phase: phaseSummary(winA, placedA)},
      sceneB: {step: 18, frames: winB.frames, counts: countsB, query: queryB,
        placeMs: stats(placeMsB), dc: winB.dc, tri: winB.tri,
        dcInc: winB.dc && base.dc ? winB.dc.median - base.dc.median : null,
        triInc: winB.tri && base.tri ? winB.tri.median - base.tri.median : null,
        phase: phaseSummary(winB, placedB)},
      removeMs: stats(rmMs),
      switchCheck: switchCheck,
      fxNow: advCampfireFx.now(), fxCellsLeft: advCampfireFx.cells().length,
    };
    console.log('TC6C6JSON:' + JSON.stringify(report));
    LOG('done');
  }
  main().catch(function(e) {
    console.log('TC6C6ERR:' + ((e && e.stack) ? e.stack : String(e)));
  });
});
`;

/* ---------- prelude(生成页 head 注入: ① <base href="/"> 修子路径相对引用 404;
   ② 低核覆盖 script, 只在 ?lowcore=1 生效) — tc6 原样 ---------- */
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
  const prelude = '<script>/* C6\' 基准 prelude(生成件, 非产品) */' + PRELUDE + '</script>\n';
  const driver = '<script>/* C6\' 基准驱动(生成件, 非产品) */' + DRIVER + '</script>\n</body>';
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

async function pickPort(start) { /* 自管端口: 起点被占顺延(8090=PO 服务在窗外) */
  for (let p = start; p < start + 20; p++) {
    if (!(await ping(p))) return p;
  }
  throw new Error('无空闲端口(' + start + '+' + 20 + '内)');
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
      '--user-data-dir=' + path.join(process.env.TEMP || HERE, 'c6prime-chrome-profile'),
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
        const m = line.match(/TC6C6JSON:(\{.*\})/);
        if (m) {
          try { json = JSON.parse(m[1]); } catch (e) { json = null; }
        }
        const lm = line.match(/TC6C6(?:LOG|ERR):(.*)$/);
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
  const port = await pickPort(PORT0);
  const server = spawn('node', [path.join(ROOT, 'server.js'), String(port)],
      {stdio: 'ignore', shell: true});
  try {
    await waitForServer(port);
    console.log('server.js 就绪 :' + port);
    const variants = [
      {name: 'desktop', url: 'http://127.0.0.1:' + port + PAGE_URL_PATH + '?dev=1'},
      {name: 'lowcore',
        url: 'http://127.0.0.1:' + port + PAGE_URL_PATH + '?dev=1&touch=1&lowcore=1'},
    ];
    const results = {};
    for (const v of variants) {
      console.log('跑 ' + v.name + ' ...');
      try {
        const r = await runChrome(v.url, 150000);
        results[v.name] = r.json;
        fs.writeFileSync(path.join(HERE, 'c6prime-bench-chrome-' + v.name + '.json'),
            JSON.stringify(r.json, null, 2), 'utf8');
        fs.writeFileSync(path.join(HERE, 'c6prime-bench-chrome-' + v.name + '.log'),
            r.logs.join('\n') + '\n', 'utf8');
        console.log(v.name + ' 完成: 场景A p50=' + (r.json.sceneA && r.json.sceneA.frames ?
            r.json.sceneA.frames.p50.toFixed(1) : '?') + 'ms dcInc=' +
            (r.json.sceneA && r.json.sceneA.dcInc != null ? r.json.sceneA.dcInc : '?') +
            ' 场景B p50=' + (r.json.sceneB && r.json.sceneB.frames ?
            r.json.sceneB.frames.p50.toFixed(1) : '?') + 'ms dcInc=' +
            (r.json.sceneB && r.json.sceneB.dcInc != null ? r.json.sceneB.dcInc : '?'));
      } catch (e) {
        console.error(v.name + ' 失败: ' + e.message);
        results[v.name] = {error: e.message};
      }
    }
    fs.writeFileSync(path.join(HERE, 'c6prime-bench-chrome.json'),
        JSON.stringify(results, null, 2), 'utf8');
    console.log('全部落盘 .scratch/campfire/tc13r-c6/c6prime-bench-chrome*.json');
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
