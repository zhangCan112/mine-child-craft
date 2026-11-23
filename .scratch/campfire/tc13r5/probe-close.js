'use strict';
/* T-C13-R5 G 项 · 近景探针(票册验收③, 复用 tc13-review/probe-close.js 骨架改参)
   ------------------------------------------------------------
   对新几何(R-2 多部件)+焰片 sheet(R-4)出近景证据: 燃/熄两态 × 侧视/顶视。
   相对 R4 版改参四处:
   1. 燃态段 advCampfires.plant 后补 advCampfireFx.open(焰片 sheet 才会建,
      fx 句柄真链); 熄灭段补 advCampfireFx.quench(浇熄真链, sheet 挂片即摘);
   2. 新增 sheetStat: 按 material.map===atlasMat.map 特征遍历统计焰片 sheet
      (活火数=drawRange/12, R5-c4 恒定属性案口径)——熄态零火=「熄灭态零焰片」
      近景实证(B 项台账重放恢复的渲染面);
   3. alphaStats 扩面: 存档六格 62~67 + 几何建模九格 68~76(相邻走查备料);
   4. 端口 8093/9225(user-data-dir 换名)——8090=PO 试玩勿动, 与 8091/8092
      既有探针口互不相扰。
   用法: node probe-close.js   (自起 server+headless Chrome, 自清理)
   输出: probe-close.json + close-litSide/litTop/outSide/outTop.png */
const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER_PORT = 8093;
const CDP_PORT = 9225;
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

/* 页面内 driver: 全程自足, 返回 JSON(含四张近景 dataURL) */
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

    /* 焰片 sheet 统计(R5-G): 特征=material.map===atlasMat.map 且 drawRange 有限 —
       真场景 chunk mesh(共享图集材质)同判据命中, 但 chunk 缺省 drawRange.count=
       Infinity(全量绘)而焰片 sheet R5-c4 恒定属性案恒有限, 恰好二分(此前未加
       该特征时 sheets 数被 chunk 灌爆, sheets.length 断言失真);
       活火数=drawRange.count/12(每火 12 索引), 全景恰一张(ADR-0020) */
    function sheetStat() {
      const sheets = [];
      scene.traverse((o) => {
        if (!o.isMesh || !o.material || o.material.map !== atlasMat.map) return;
        const dr = o.geometry && o.geometry.drawRange;
        if (!dr || dr.count === Infinity) return; /* chunk 批 mesh 非焰片 sheet */
        sheets.push(o);
      });
      if (sheets.length === 0) return {sheets: 0, fires: 0, openCells: []};
      let fires = 0;
      for (const m of sheets) {
        fires += m.geometry.drawRange.count / 12;
      }
      /* open 格清单(R5-G 复跑证据: fires 与 cells open 格数互证 — 多出的火
         来源可判: 本测目标格 1 + 进场存量(真档读档恢复 T-C5 真链)N) */
      const openCells = (typeof advCampfireFx !== 'undefined' && advCampfireFx &&
        typeof advCampfireFx.cells === 'function') ?
        advCampfireFx.cells().filter((c) => c.open).map((c) => c.x + ',' + c.y + ',' + c.z) : [];
      return {sheets: sheets.length, fires: Math.round(fires), openCells};
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

    /* ① 燃烧态近景: 放块+挂账+特效句柄 open(真链: sheet 建门=fx.cells() 在册) → 侧视+顶视
       进场存量处理(R5-G 复跑修正): 本机真档有燃烧篝火(读档恢复 T-C5 真链会在
       settle 重开特效), 先快照存量再清特效账——目标格证据与本机档况解耦, 存量
       如实入证据不掩埋 */
    const priorSheet = sheetStat();
    advCampfireFx.clear();
    await sleep(100);
    editBlock(x, y, z, 81);
    advCampfires.plant(x, y, z);
    advCampfireFx.open(x, y, z);
    await sleep(600);
    const lit = measureCell(x, y, z);
    const litSheet = sheetStat();
    const shotLitSide = closeShot(x, y, z, 'side');
    const shotLitTop = closeShot(x, y, z, 'top');
    const alphaStats = {};
    for (const idx of [62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76]) {
      alphaStats[idx] = tileAlphaStats(idx);
    }

    /* ② 熄灭态近景: 浇熄真链(quench 摘片)+id 互换 → 同结构熄态+零焰片 */
    advCampfireFx.quench(x, y, z);
    advCampfires.drop(x, y, z);
    editBlock(x, y, z, 82);
    await sleep(400);
    const out = measureCell(x, y, z);
    const outSheet = sheetStat();
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
    advCampfireFx.clear();
    await sleep(200);

    return {ok: true, cell, atlasInfo, priorSheet, lit, litSheet, alphaStats, out, outSheet, stone,
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
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'tc13r5-chrome-profile'),
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
    '--window-size=1200,800', URL_PAGE,
  ], {stdio: 'ignore'});
  let ws = null;
  try {
    await waitFor(async () => {
      const r = await httpGet(`http://127.0.0.1:${SERVER_PORT}/index.html`);
      return r.status === 200;
    }, 15000);
    console.log('[r5-probe] server up');

    const targets = await waitFor(async () => {
      const r = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = JSON.parse(r.body);
      return list.find((t) => t.type === 'page' && t.url.indexOf(String(SERVER_PORT)) >= 0);
    }, 20000);
    console.log('[r5-probe] page target found');

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

    console.log('[r5-probe] evaluating driver (~12s)...');
    const resp = await send('Runtime.evaluate', {
      expression: DRIVER, awaitPromise: true, returnByValue: true,
    });
    const v = resp.result && resp.result.result && resp.result.result.value;
    if (!v || !v.ok) {
      console.error('[r5-probe] DRIVER FAILED:', JSON.stringify(v || resp, null, 2));
      process.exitCode = 1;
      return;
    }
    const shots = v.shots; delete v.shots;
    fs.writeFileSync(path.join(outDir, 'probe-close.json'), JSON.stringify(v, null, 2));
    for (const name of Object.keys(shots)) {
      const b64 = shots[name].replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(outDir, `close-${name}.png`), Buffer.from(b64, 'base64'));
    }
    console.log('[r5-probe] RESULTS');
    console.log('  cell        :', JSON.stringify(v.cell));
    console.log('  lit  (81)   : maxYrel=%s verts=%s sheet=%j', v.lit.maxYrel, v.lit.verts, v.litSheet);
    console.log('  out  (82)   : maxYrel=%s verts=%s sheet=%j', v.out.maxYrel, v.out.verts, v.outSheet);
    console.log('  stone       : maxYrel=%s verts=%s', v.stone.maxYrel, v.stone.verts);
    const rows = [62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76];
    for (const idx of rows) {
      const a = v.alphaStats[idx];
      console.log('  tile%s alpha : visible=%s/%s transparent0=%s', idx, a.visible, a.total, a.transparent);
    }
    const litHot = v.alphaStats[74].visible + v.alphaStats[75].visible + v.alphaStats[76].visible;
    console.log('  (archived 62~67 + geometry 68~76; flame frames 74~76 visible total = %s)', litHot);
    console.log('  sheets written:', Object.keys(shots).map((n) => 'close-' + n + '.png').join(' '));
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* 探针收尾零炸 */ }
    server.kill();
    chrome.kill();
  }
}

main().catch((e) => { console.error('[r5-probe] FATAL', e); process.exit(1); });
