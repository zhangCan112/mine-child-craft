// T-C13-R 复验 · 熄态脚下黑区归因探针(tc13r-review)
// 现象: 熄态稳定态篝火周围地面呈纯黑菱形区(燃态同区域=block 15 照亮), 2.4s 不收敛
// 归因三问: ①近/远地面顶点 sky/block attribute 实值(渲染数据面)
//          ②石头对照同角度拍(solid 块脚下是否同款黑区→区分篝火特有 vs 光照结构)
//          ③燃态对照读数
'use strict';
const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER_PORT = 8095;
const CDP_PORT = 9227;
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

/* 读格包围盒附近 y≈groundTop 顶点的 sky/block attribute(实机渲染数据面) */
const LIGHT_FN = `
function groundLightSamples(cx, cy, cz) {
  const out = {near: [], far: [], missing: []};
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    const sky = o.geometry.attributes.aSky;
    const blk = o.geometry.attributes.aBlock;
    const bp = o.geometry.boundingSphere;
    const bx = o.position.x + (bp ? bp.center.x : 0), bz = o.position.z + (bp ? bp.center.z : 0);
    const md = Math.max(Math.abs(bx - (cx + 0.5)), Math.abs(bz - (cz + 0.5)));
    if (!sky || !blk) {
      /* 缺光属性 mesh: 若 bbox 落在篝火近区, 登记为嫌疑(渲染端 shader 读缺省 0 = 纯黑) */
      if (md <= 6) out.missing.push({mat: o.material && o.material.type, n: pos.count,
        bx: +bx.toFixed(1), bz: +bz.toFixed(1), r: bp ? +bp.radius.toFixed(1) : -1});
      return;
    }
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      if (Math.abs(vy - cy) > 0.02) continue; /* y=cy 平面 = 地面顶面(可见) */
      const dx = vx - (cx + 0.5), dz = vz - (cz + 0.5);
      const dist = Math.max(Math.abs(dx), Math.abs(dz));
      const rec = {x: +vx.toFixed(2), z: +vz.toFixed(2), sky: +sky.getX(i).toFixed(3), blk: +blk.getX(i).toFixed(3)};
      if (dist <= 3.5) out.near.push(rec);
      if (dist >= 6 && dist <= 9) out.far.push(rec);
    }
  });
  out.near.sort((a, b) => a.sky - b.sky);
  return out;
}`;

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
    ${LIGHT_FN}

    function closeShot(cx, cy, cz) {
      const W = renderer.domElement.width, H = renderer.domElement.height;
      const cam2 = new THREE.PerspectiveCamera(55, W / H, 0.05, 200);
      cam2.position.set(cx + 0.5 + 1.9, cy + 1.45, cz + 0.5 + 1.9);
      cam2.lookAt(cx + 0.5, cy + 0.2, cz + 0.5);
      renderer.render(scene, cam2);
      return renderer.domElement.toDataURL('image/png');
    }
    const px = Math.floor(camera.position.x); const pz = Math.floor(camera.position.z);
    let cell = null;
    outer:
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        const x = px + dx; const z = pz + dz;
        if (dx === 0 && dz === 0) continue;
        const gy = groundTop(x, z);
        const y = gy + 1;
        if (getBlock(x, gy, z) !== 0 && getBlock(x, y, z) === 0 && getBlock(x, y + 1, z) === 0) {
          cell = {x, y, z}; break outer;
        }
      }
    }
    if (!cell) return {ok: false, err: 'no free cell'};
    const {x, y, z} = cell;

    /* ① 燃态光读数+拍 */
    editBlock(x, y, z, 81);
    advCampfires.plant(x, y, z);
    advCampfireFx.open(x, y, z);
    await sleep(1500);
    const litG = groundLightSamples(x, y, z); /* y=cell.y=地面顶面(可见) */
    const shotLit = closeShot(x, y, z);

    /* ② 熄态稳定态(2.4s)光读数+拍 */
    advCampfireFx.quench(x, y, z);
    advCampfires.drop(x, y, z);
    editBlock(x, y, z, 82);
    await sleep(2400);
    const outG = groundLightSamples(x, y, z); /* y=cell.y=地面顶面(可见) */
    const shotOut = closeShot(x, y, z);

    /* ③ 石头对照(同角度): solid 块脚下是否同款黑区 */
    const stoneId = (typeof B_STONE !== 'undefined') ? B_STONE
      : Object.keys(BLOCKS).find((k) => BLOCKS[k] && BLOCKS[k].name && BLOCKS[k].name.indexOf('石') === 0);
    editBlock(x, y, z, stoneId);
    await sleep(1500);
    const stoneG = groundLightSamples(x, y, z); /* y=cell.y=地面顶面(可见) */
    const shotStone = closeShot(x, y, z);

    /* ④ 火把对照(通用撤光路径): light 14 放置→移除——若移除后同留黑区=光引擎
       撤光通病; 若干净=篝火 quench 链特有。归因分流的决定性对照。 */
    editBlock(x, y, z, B_TORCH);
    await sleep(1500);
    const torchG = groundLightSamples(x, y, z);
    const shotTorch = closeShot(x, y, z);
    editBlock(x, y, z, 0);
    await sleep(2400);
    const torchRemovedG = groundLightSamples(x, y, z);
    const shotTorchRemoved = closeShot(x, y, z);

    /* ④ 清场 */
    editBlock(x, y, z, 0);
    advCampfires.drop(x, y, z);
    advCampfireFx.clear();
    await sleep(200);

    const summar = (g) => {
      const pick = (arr) => arr.slice(0, 4).map((r) => r.sky + '/' + r.blk).join(' ');
      const dark = g.near.filter((r) => r.sky === 0)
        .map((r) => '(' + r.x + ',' + r.z + ')').join(' ');
      return {nearN: g.near.length, farN: g.far.length,
        nearSample: pick(g.near), farSample: pick(g.far),
        nearAll: g.near.map((r) => r.sky + '/' + r.blk).join(','),
        darkN: g.near.filter((r) => r.sky === 0).length, darkAt: dark || '(none)',
        missing: g.missing,
        farMinSky: Math.min(...g.far.map((r) => r.sky)),
        farMinBlk: Math.min(...g.far.map((r) => r.blk))};
    };
    return {ok: true, cell, lit: summar(litG), out: summar(outG), stone: summar(stoneG),
      torch: summar(torchG), torchRemoved: summar(torchRemovedG),
      shots: {lit: shotLit, out: shotOut, stone: shotStone,
        torch: shotTorch, torchRemoved: shotTorchRemoved}};
  } catch (e) {
    return {ok: false, err: String(e && e.stack || e)};
  }
})()`;

async function main() {
  const outDir = __dirname;
  const server = spawn('node', ['server.js', String(SERVER_PORT)], {cwd: ROOT, stdio: 'ignore'});
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'tc13r-light-profile'),
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
    '--window-size=1200,800', URL_PAGE,
  ], {stdio: 'ignore'});
  let ws = null;
  try {
    await waitFor(async () => (await httpGet(`http://127.0.0.1:${SERVER_PORT}/index.html`)).status === 200, 15000);
    console.log('[light-probe] server up');
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
    console.log('[light-probe] evaluating driver (~15s)...');
    const resp = await send('Runtime.evaluate', {expression: DRIVER, awaitPromise: true, returnByValue: true});
    const v = resp.result && resp.result.result && resp.result.result.value;
    if (!v || !v.ok) {
      console.error('[light-probe] DRIVER FAILED:', JSON.stringify(v || resp, null, 2));
      process.exitCode = 1;
      return;
    }
    const shots = v.shots; delete v.shots;
    fs.writeFileSync(path.join(outDir, 'probe-light.json'), JSON.stringify(v, null, 2));
    for (const name of Object.keys(shots)) {
      const b64 = shots[name].replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(outDir, `light-${name}.png`), Buffer.from(b64, 'base64'));
    }
    for (const k of ['lit', 'out', 'stone', 'torch', 'torchRemoved']) {
      console.log(`  ${k}: near(${v[k].nearN}) 最暗4[sky/blk] ${v[k].nearSample} · sky0=${v[k].darkN} @ ${v[k].darkAt.slice(0, 120)}`);
      if (v[k].missing.length) console.log(`    !! 缺光属性 mesh: ` + JSON.stringify(v[k].missing));
    }
    console.log('[light-probe] done -> probe-light.json + light-*.png x3');
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* noop */ }
    try { chrome.kill(); } catch (e) { /* noop */ }
    try { server.kill(); } catch (e) { /* noop */ }
  }
}
main().catch((e) => { console.error('[light-probe] FATAL', e); process.exit(1); });
