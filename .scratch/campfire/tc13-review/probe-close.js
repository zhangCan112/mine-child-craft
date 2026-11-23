'use strict';
/* T-C13 复验 · 近景探针(design-lead 管线, 复用 tc13-verify/probe.js 骨架)
   ------------------------------------------------------------
   与原 probe 的差异: 原版三截图=玩家默认远景视角, 篝火在画面中不可辨
   (评审无图像输入未目验)——本版改独立相机近景特写, 支撑 §4.5-6 五锚目验:
   1. lit/out 各拍 侧视 45° 特写 + 正顶视(灶面) 两张, 篝火占画面 ~1/3 宽;
   2. 独立 PerspectiveCamera 同步 render→立即读, 零 rig 竞态;
   3. 数值面独立复跑(maxYrel 两态+石块对照 / alphaStats 六格)与 probe.json 对撞。
   用法: node probe-close.js   (自起 server 8092 + headless Chrome 9224, 自清场)
   输出: probe-close.json + close-lit-side/top.png + close-out-side/top.png
   端口纪律: 8090=PO 试玩 / 8091=tc13-verify 探针, 本版用 8092/9224 三不相扰。 */
const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER_PORT = 8092;
const CDP_PORT = 9224;
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

/* 页面内 driver:全程自足,返回 JSON(含四张近景 dataURL) */
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
    if (!cell) return {ok: false, err: 'no free cell near spawn'};
    const {x, y, z} = cell;

    function measureCell(cx, cy, cz) {
      const res = {verts: 0, maxY: -Infinity, minY: Infinity, baseVerts: 0, meshIds: []};
      scene.traverse((o) => {
        if (!o.isMesh || o.material !== atlasMat) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i); const vy = pos.getY(i); const vz = pos.getZ(i);
          if (vx >= cx - 0.02 && vx <= cx + 1.02 && vz >= cz - 0.02 && vz <= cz + 1.02
            && vy >= cy - 0.02 && vy <= cy + 2.02) {
            res.verts++;
            if (vy > res.maxY) res.maxY = vy;
            if (vy < res.minY) res.minY = vy;
            if (Math.abs(vy - cy) < 0.02) res.baseVerts++;
            if (res.meshIds.indexOf(o.id) < 0) res.meshIds.push(o.id);
          }
        }
      });
      if (res.verts === 0) return {verts: 0};
      res.maxYrel = +(res.maxY - cy).toFixed(4);
      res.minYrel = +(res.minY - cy).toFixed(4);
      return res;
    }

    function tileAlphaStats(tile) {
      const img = atlasMat.map.image;
      const cols = TextureAtlas.layout.cols; const rows = TextureAtlas.layout.rows;
      const tc = tile % cols; const tr = Math.floor(tile / cols);
      const cw = img.width / cols; const ch = img.height / rows;
      const c2 = document.createElement('canvas');
      c2.width = img.width; c2.height = img.height;
      const g = c2.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(Math.round(tc * cw), Math.round(tr * ch), Math.round(cw), Math.round(ch)).data;
      let visible = 0; let transparent = 0; const total = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] >= 128) visible++;
        if (d[i + 3] === 0) transparent++;
      }
      return {tile, visible, transparent, total, visibleRatio: +(visible / total).toFixed(4)};
    }

    /* 近景独立相机: 绕开游戏循环 rig(每帧重置相机), 一帧同步渲染后立即读 */
    function closeShot(cx, cy, cz, mode) {
      const W = renderer.domElement.width, H = renderer.domElement.height;
      const cam2 = new THREE.PerspectiveCamera(55, W / H, 0.05, 200);
      if (mode === 'top') {
        cam2.position.set(cx + 0.5, cy + 3.0, cz + 0.53);
        cam2.lookAt(cx + 0.5, cy, cz + 0.5);
      } else {
        cam2.position.set(cx + 0.5 + 1.9, cy + 1.45, cz + 0.5 + 1.9);
        cam2.lookAt(cx + 0.5, cy + 0.2, cz + 0.5);
      }
      renderer.render(scene, cam2);
      return renderer.domElement.toDataURL('image/png');
    }

    const atlasInfo = {cols: TextureAtlas.layout.cols, rows: TextureAtlas.layout.rows};

    /* ① 燃烧态近景: 放块+挂账 → 侧视特写+顶视灶面 */
    editBlock(x, y, z, 81);
    advCampfires.plant(x, y, z);
    await sleep(400);
    const lit = measureCell(x, y, z);
    const shotLitSide = closeShot(x, y, z, 'side');
    const shotLitTop = closeShot(x, y, z, 'top');
    const alphaStats = {};
    for (const idx of [62, 63, 64, 65, 66, 67]) alphaStats[idx] = tileAlphaStats(idx);

    /* ② 熄灭态近景 */
    advCampfires.drop(x, y, z);
    editBlock(x, y, z, 82);
    await sleep(400);
    const out = measureCell(x, y, z);
    const shotOutSide = closeShot(x, y, z, 'side');
    const shotOutTop = closeShot(x, y, z, 'top');

    /* ③ 石块对照(测量法自证) */
    const stoneId = (typeof B_STONE !== 'undefined') ? B_STONE
      : Object.keys(BLOCKS).find((k) => BLOCKS[k] && BLOCKS[k].name && BLOCKS[k].name.indexOf('石') === 0);
    editBlock(x, y, z, stoneId);
    await sleep(400);
    const stone = measureCell(x, y, z);

    /* ④ 清场 */
    editBlock(x, y, z, 0);
    advCampfires.drop(x, y, z);
    await sleep(200);

    return {ok: true, cell, atlasInfo, lit, alphaStats, out, stone,
      shots: {litSide: shotLitSide, litTop: shotLitTop, outSide: shotOutSide, outTop: shotOutTop}};
  } catch (e) {
    return {ok: false, err: String(e && e.stack || e)};
  }
})()`;

async function main() {
  const outDir = __dirname;
  const server = spawn('node', ['server.js', String(SERVER_PORT)], {cwd: ROOT, stdio: 'ignore'});
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'tc13-lead-chrome-profile'),
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
    '--window-size=1200,800', URL_PAGE,
  ], {stdio: 'ignore'});
  let ws = null;
  try {
    await waitFor(async () => {
      const r = await httpGet(`http://127.0.0.1:${SERVER_PORT}/index.html`);
      return r.status === 200;
    }, 15000);
    console.log('[close-probe] server up');

    const targets = await waitFor(async () => {
      const r = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = JSON.parse(r.body);
      return list.find((t) => t.type === 'page' && t.url.indexOf(String(SERVER_PORT)) >= 0);
    }, 20000);
    console.log('[close-probe] page target found');

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

    console.log('[close-probe] evaluating driver (~10s)...');
    const resp = await send('Runtime.evaluate', {
      expression: DRIVER, awaitPromise: true, returnByValue: true,
    });
    const v = resp.result && resp.result.result && resp.result.result.value;
    if (!v || !v.ok) {
      console.error('[close-probe] DRIVER FAILED:', JSON.stringify(v || resp, null, 2));
      process.exitCode = 1;
      return;
    }
    const shots = v.shots; delete v.shots;
    fs.writeFileSync(path.join(outDir, 'probe-close.json'), JSON.stringify(v, null, 2));
    for (const name of Object.keys(shots)) {
      const b64 = shots[name].replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(outDir, `close-${name}.png`), Buffer.from(b64, 'base64'));
    }
    console.log('[close-probe] RESULTS');
    console.log('  cell        :', JSON.stringify(v.cell));
    console.log('  lit  (81)   : maxYrel=%s verts=%s', v.lit.maxYrel, v.lit.verts);
    console.log('  out  (82)   : maxYrel=%s verts=%s', v.out.maxYrel, v.out.verts);
    console.log('  stone       : maxYrel=%s verts=%s', v.stone.maxYrel, v.stone.verts);
    for (const idx of [62, 63, 64, 65, 66, 67]) {
      const a = v.alphaStats[idx];
      console.log('  tile%s alpha : visible=%s/%s transparent0=%s', idx, a.visible, a.total, a.transparent);
    }
    console.log('[close-probe] done -> probe-close.json + close-*.png x4');
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* noop */ }
    try { chrome.kill(); } catch (e) { /* noop */ }
    try { server.kill(); } catch (e) { /* noop */ }
  }
}
main();
