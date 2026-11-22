// R-7 复验 · gate 黑面定位诊断探针（复用 tc13r7/probe-r7-light.js 骨架，只搭门架+牌，
// 全量读 y∈[base,base+3] 区域带光属性 mesh 的顶点，找低光顶点簇+坐标）
'use strict';
const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER_PORT = 8098;
const CDP_PORT = 9229;
const URL_PAGE = `http://127.0.0.1:${SERVER_PORT}/index.html`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({status: res.statusCode, body: b}));
    }).on('error', reject);
  });
}
function waitFor(fn, ms, step) {
  const ddl = Date.now() + ms;
  return new Promise((resolve, reject) => {
    (function poll() {
      Promise.resolve().then(fn).then((v) => {
        if (v) return resolve(v);
        if (Date.now() > ddl) return reject(new Error('waitFor timeout'));
        setTimeout(poll, step || 250);
      }).catch(() => {
        if (Date.now() > ddl) return reject(new Error('waitFor timeout'));
        setTimeout(poll, step || 250);
      });
    })();
  });
}

const DRIVER = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    let ok = false;
    for (let i = 0; i < 200; i++) {
      if (typeof switchMode === 'function' && typeof MODES !== 'undefined'
        && MODES.showroom && typeof groundTop === 'function' && atlasMat) { ok = true; break; }
      await sleep(100);
    }
    if (!ok) return {ok: false, err: 'boot timeout'};
    switchMode('showroom');
    touchPlaying = true;
    await sleep(1200);

    function shotAt(px, py, pz, tx, ty, tz) {
      const W = renderer.domElement.width, H = renderer.domElement.height;
      const cam2 = new THREE.PerspectiveCamera(55, W / H, 0.05, 200);
      cam2.position.set(px, py, pz);
      cam2.lookAt(tx, ty, tz);
      renderer.render(scene, cam2);
      return renderer.domElement.toDataURL('image/png');
    }

    /* 与施工探针同选址逻辑 */
    const WOOD = 6;
    const put = (bx, by, bz, id) => editBlock(bx, by, bz, id);
    const px = Math.floor(camera.position.x); const pz = Math.floor(camera.position.z);
    let gate = null;
    for (const [candX, candZ] of [[px + 5, pz - 5], [px, pz - 5], [px + 5, pz + 5],
      [px, pz + 5], [px, pz - 6], [px, pz + 6], [px + 6, pz], [px - 6, pz]]) {
      const g0 = groundTop(candX, candZ); const g1 = groundTop(candX + 1, candZ);
      const g2 = groundTop(candX + 2, candZ);
      if (!(g0 === g1 && g1 === g2)) continue;
      const b = g0 + 1;
      const empty = (bx, by, bz) => getBlock(bx, by, bz) === 0;
      if (!empty(candX + 1, b + 2, candZ)) continue;
      if (!empty(candX + 1, b + 2, candZ - 1) || !empty(candX + 1, b + 2, candZ + 1)) continue;
      if (!empty(candX, b, candZ) || !empty(candX + 2, b, candZ)) continue;
      if (!empty(candX, b + 3, candZ) || !empty(candX + 1, b + 3, candZ) ||
          !empty(candX + 2, b + 3, candZ)) continue;
      gate = {x: candX, z: candZ, base: b};
      break;
    }
    if (!gate) return {ok: false, err: 'no clear gate site'};
    const gx = gate.x; const gz = gate.z; const base = gate.base;
    for (let wy = base; wy <= base + 2; wy++) { put(gx, wy, gz, WOOD); put(gx + 2, wy, gz, WOOD); }
    for (let wx = gx; wx <= gx + 2; wx++) put(wx, base + 3, gz, WOOD);
    put(gx + 1, base + 2, gz, 80);
    await sleep(1800);

    /* 全量顶点读数: 门架包围盒内所有带光属性 mesh 的顶点 */
    const reads = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position;
      const sky = o.geometry.attributes.aSky;
      const blk = o.geometry.attributes.aBlock;
      if (!sky || !blk) return;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
        if (vx < gx - 0.05 || vx > gx + 3.05 || vz < gz - 0.05 || vz > gz + 1.05) continue;
        if (vy < base - 0.05 || vy > base + 4.05) continue;
        reads.push({x: +vx.toFixed(2), y: +vy.toFixed(2), z: +vz.toFixed(2),
          sky: +sky.getX(i).toFixed(3), blk: +blk.getX(i).toFixed(3)});
      }
    });
    const dark = reads.filter((r) => r.sky < 0.05 && r.blk < 0.05);
    /* 格值诊断 */
    const diag = {};
    for (const [dx, dy, dz, name] of [
      [gx, base, gz, 'pillarW_base'], [gx, base + 1, gz, 'pillarW_mid'], [gx, base + 2, gz, 'pillarW_top'],
      [gx + 1, base, gz, 'doorway_low'], [gx + 1, base + 1, gz, 'doorway_mid'], [gx + 1, base + 2, gz, 'signCell'],
      [gx + 1, base + 3, gz, 'lintelMid'], [gx, base + 3, gz, 'lintelW'], [gx + 2, base + 3, gz, 'lintelE'],
      [gx, base + 3, gz - 1, 'aboveLintelW_zm'], [gx + 1, base + 3, gz + 1, 'frontLintelMid_zp']]) {
      diag[name] = {sky: lightSkyAt(dx, dy, dz), blk: lightBlockAt(dx, dy, dz)};
    }
    const shots = {
      gateWide: shotAt(gx + 1.5, base + 2.6, gz + 3.2, gx + 1.5, base + 2.2, gz + 0.5),
      gateClose: shotAt(gx + 1.5, base + 2.2, gz + 1.8, gx + 1.05, base + 2.1, gz + 0.3)};
    for (const [bx, by, bz, id] of [[gx, base, gz, 0], [gx, base + 1, gz, 0], [gx, base + 2, gz, 0],
      [gx + 2, base, gz, 0], [gx + 2, base + 1, gz, 0], [gx + 2, base + 2, gz, 0],
      [gx, base + 3, gz, 0], [gx + 1, base + 3, gz, 0], [gx + 2, base + 3, gz, 0],
      [gx + 1, base + 2, gz, 0]]) editBlock(bx, by, bz, id);
    await sleep(300);
    return {ok: true, gate, diag, total: reads.length, darkN: dark.length,
      darkSample: dark.slice(0, 30), shots};
  } catch (e) {
    return {ok: false, err: String(e && e.stack || e)};
  }
})()`;

async function main() {
  const outDir = __dirname;
  const server = spawn('node', ['server.js', String(SERVER_PORT)], {cwd: ROOT, stdio: 'ignore'});
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'tc13r-gatediag-profile'),
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
    '--window-size=1200,800', URL_PAGE,
  ], {stdio: 'ignore'});
  let ws = null;
  try {
    await waitFor(async () => (await httpGet(`http://127.0.0.1:${SERVER_PORT}/index.html`)).status === 200, 15000);
    console.log('[gate-diag] server up');
    const targets = await waitFor(async () => {
      const r = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
      return JSON.parse(r.body).find((t) => t.type === 'page' && t.url.indexOf(String(SERVER_PORT)) >= 0);
    }, 20000);
    ws = new WebSocket(targets.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let msgId = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    function send(method, params) {
      return new Promise((res) => {
        const id = ++msgId;
        pending.set(id, res);
        ws.send(JSON.stringify({id, method, params}));
      });
    }
    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(1500);
    console.log('[gate-diag] evaluating driver (~12s)...');
    const resp = await send('Runtime.evaluate', {expression: DRIVER, awaitPromise: true, returnByValue: true});
    const v = resp.result && resp.result.result && resp.result.result.value;
    if (!v || !v.ok) {
      console.error('[gate-diag] DRIVER FAILED:', JSON.stringify(v || resp, null, 2).slice(0, 800));
      process.exitCode = 1;
      return;
    }
    const shots = v.shots; delete v.shots;
    fs.writeFileSync(path.join(outDir, 'gate-diag.json'), JSON.stringify(v, null, 2));
    for (const name of Object.keys(shots)) {
      const b64 = shots[name].replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(outDir, `gatediag-${name}.png`), Buffer.from(b64, 'base64'));
    }
    console.log('gate=', JSON.stringify(v.gate));
    console.log('diag(格值)=', JSON.stringify(v.diag));
    console.log(`顶点总数 ${v.total} · 低光(0/0)顶点 ${v.darkN}`);
    for (const r of v.darkSample) console.log(`  dark (${r.x},${r.y},${r.z}) sky=${r.sky} blk=${r.blk}`);
    console.log('[gate-diag] done -> gate-diag.json + gatediag-*.png');
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* noop */ }
    try { chrome.kill(); } catch (e) { /* noop */ }
    try { server.kill(); } catch (e) { /* noop */ }
  }
}
main().catch((e) => { console.error('[gate-diag] FATAL', e); process.exit(1); });
