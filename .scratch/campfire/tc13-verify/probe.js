'use strict';
/* T-C13 thin 实机核实探针(runner)
   ------------------------------------------------------------
   目的(票文 §3.4 thin 核实 + 「全尺寸实心」根因定案):
   1. 实测当前 tip 燃烧/熄灭篝火半格几何 maxY(期望 y+0.5);
   2. 热切换 thin=0.4375 后重 mesh 复测(期望 y+0.4375);
   3. 根因定案:几何若半格成立,「看着全尺寸实心」的根因落贴图层——
      实读 atlas tile 62/63 画师格的 alpha>=128 可见像素占比(满格不
      透明=直证);
   4. 石块对照格 maxY=1.0,证测量法本身能分辨全尺寸;
   5. 三态截图留档(lit/out/thin),供五锚走查材料引用。
   用法: node probe.js   (自起 server 8091 + headless Chrome 9223,自清场)
   输出: probe.json + probe-lit.png + probe-out.png + probe-thin.png
   端口纪律: 8090 是 PO 试玩服务,本探针用 8091/9223,互不相扰。 */
const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER_PORT = 8091;
const CDP_PORT = 9223;
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

/* 页面内 driver:全程自足,返回 JSON(含三张 dataURL 截图) */
const DRIVER = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    /* 等 defer 脚本与 boot(至多 20s) */
    let ok = false;
    for (let i = 0; i < 200; i++) {
      if (typeof switchMode === 'function' && typeof MODES !== 'undefined'
        && MODES.showroom && typeof groundTop === 'function' && atlasMat) { ok = true; break; }
      await sleep(100);
    }
    if (!ok) return {ok: false, err: 'boot timeout'};
    /* 进体验馆(dev 全内存档, 不碰真档), 触屏在玩态免指针锁 */
    switchMode('showroom');
    touchPlaying = true;
    await sleep(1200);

    /* 选格: 玩家所在列往外找平地(groundTop=最高非空块自身 y; 放置格=其上)
       要求: 地面非空、放置格与上两格空 */
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

    /* 测量: atlas 通道网格顶点(世界坐标直存, mesh 无偏移)按格包围盒滤 */
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

    /* 图集画师格 alpha 审读: alpha>=128 即可见(atlasMat alphaTest 0.5) */
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
      let visible = 0; const total = d.length / 4;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) visible++;
      return {tile, visible, total, visibleRatio: +(visible / total).toFixed(4),
        atlasPx: {w: Math.round(cw), h: Math.round(ch)}};
    }

    function snap() {
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          renderer.render(scene, camera); /* 同帧渲染后立即读, 免 preserveDrawingBuffer 黑屏 */
          resolve(renderer.domElement.toDataURL('image/png'));
        });
      });
    }

    const atlasInfo = {cols: TextureAtlas.layout.cols, rows: TextureAtlas.layout.rows};

    /* ① 燃烧态: 放块+挂账(plant=放置即燃) */
    editBlock(x, y, z, 81);
    advCampfires.plant(x, y, z);
    await sleep(400);
    const lit = measureCell(x, y, z);
    const lit62 = tileAlphaStats(62);
    const shotLit = await snap();

    /* ② 熄灭态: 摘账+换块 */
    advCampfires.drop(x, y, z);
    editBlock(x, y, z, 82);
    await sleep(400);
    const out = measureCell(x, y, z);
    const out63 = tileAlphaStats(63);
    const shotOut = await snap();

    /* ③ 石块对照(全尺寸=1.0 判据的测量法自证) */
    const stoneId = (typeof B_STONE !== 'undefined') ? B_STONE
      : Object.keys(BLOCKS).find((k) => BLOCKS[k] && BLOCKS[k].name && BLOCKS[k].name.indexOf('石') === 0);
    editBlock(x, y, z, stoneId);
    await sleep(400);
    const stone = measureCell(x, y, z);
    editBlock(x, y, z, 0);
    await sleep(300);

    /* ④ 热切换 thin=0.4375 → 置空再置回强制重 mesh(置同 id 不一定重建) */
    const thinWas = {lit: BLOCKS[81].thin, out: BLOCKS[82].thin};
    BLOCKS[81].thin = 0.4375; BLOCKS[82].thin = 0.4375;
    editBlock(x, y, z, 82);
    await sleep(400);
    const thin = measureCell(x, y, z);
    const shotThin = await snap();

    /* ⑤ 清场恢复: 摘块还原 thin(体验馆 dev 档全内存, 还原只为驱动侧卫生) */
    editBlock(x, y, z, 0);
    advCampfires.drop(x, y, z);
    BLOCKS[81].thin = thinWas.lit; BLOCKS[82].thin = thinWas.out;
    await sleep(200);

    return {ok: true, cell, atlasInfo, lit, lit62, out, out63, stone, thin,
      thinWas, shots: {lit: shotLit, out: shotOut, thin: shotThin}};
  } catch (e) {
    return {ok: false, err: String(e && e.stack || e)};
  }
})()`;

async function main() {
  const outDir = __dirname;
  const server = spawn('node', ['server.js', String(SERVER_PORT)], {cwd: ROOT, stdio: 'ignore'});
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'tc13-chrome-profile'),
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
    '--window-size=1200,800', URL_PAGE,
  ], {stdio: 'ignore'});
  let ws = null;
  try {
    await waitFor(async () => {
      const r = await httpGet(`http://127.0.0.1:${SERVER_PORT}/index.html`);
      return r.status === 200;
    }, 15000);
    console.log('[probe] server up');

    const targets = await waitFor(async () => {
      const r = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = JSON.parse(r.body);
      return list.find((t) => t.type === 'page' && t.url.indexOf(String(SERVER_PORT)) >= 0);
    }, 20000);
    console.log('[probe] page target found');

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
    await sleep(1500); /* load 事件余量(defer 脚本+首次 boot) */

    console.log('[probe] evaluating driver (this can take ~10s)...');
    const resp = await send('Runtime.evaluate', {
      expression: DRIVER, awaitPromise: true, returnByValue: true,
    });
    const v = resp.result && resp.result.result && resp.result.result.value;
    if (!v || !v.ok) {
      console.error('[probe] DRIVER FAILED:', JSON.stringify(v || resp, null, 2));
      process.exitCode = 1;
      return;
    }
    const shots = v.shots; delete v.shots;
    fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(v, null, 2));
    for (const name of Object.keys(shots)) {
      const b64 = shots[name].replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(outDir, `probe-${name}.png`), Buffer.from(b64, 'base64'));
    }
    console.log('[probe] RESULTS');
    console.log('  cell        :', JSON.stringify(v.cell));
    console.log('  atlasInfo   :', JSON.stringify(v.atlasInfo));
    console.log('  lit  (81)   : maxYrel=%s minYrel=%s verts=%s baseVerts=%s',
      v.lit.maxYrel, v.lit.minYrel, v.lit.verts, v.lit.baseVerts);
    console.log('  out  (82)   : maxYrel=%s minYrel=%s verts=%s baseVerts=%s',
      v.out.maxYrel, v.out.minYrel, v.out.verts, v.out.baseVerts);
    console.log('  stone       : maxYrel=%s verts=%s', v.stone.maxYrel, v.stone.verts);
    console.log('  thin 0.4375 : maxYrel=%s minYrel=%s verts=%s baseVerts=%s',
      v.thin.maxYrel, v.thin.minYrel, v.thin.verts, v.thin.baseVerts);
    console.log('  tile62 alpha: visible=%s/%s (%s)', v.lit62.visible, v.lit62.total, v.lit62.visibleRatio);
    console.log('  tile63 alpha: visible=%s/%s (%s)', v.out63.visible, v.out63.total, v.out63.visibleRatio);
    console.log('[probe] done -> probe.json, probe-lit.png, probe-out.png, probe-thin.png');
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* noop */ }
    try { chrome.kill(); } catch (e) { /* noop */ }
    try { server.kill(); } catch (e) { /* noop */ }
  }
}

main().catch((e) => { console.error('[probe] fatal:', e); process.exitCode = 1; });
