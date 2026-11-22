// T-C13-R7 复验备料 · H2 黑区修复 headless 探针(tc13r7)
// 口径: 真实 config BLOCKS + 真渲染管线(headless Chrome + CDP; 范式抄 tc13r-review/probe-light.js);
//      自管端口 server 8097 / CDP 9229(PO 试玩服务 8090 不碰); 结构自建(沙壁 2×3×3 + 木门额)
//      保证受采样几何确定; 零墙钟只用于等帧/等重建(非装具断言面)。
// 判据(读数面与截图面对账):
//  a1 熄态近景: 熄态篝火四周无黑框 — outGroundDarkN=0(火下地面顶点 sky 全非零)
//     且沙壁火层带顶点 sky 非全零(旧径墙面采样挡光熄格恒 0/0 必黑);
//  a2 燃态光晕: 同机位燃态拍 — 同形状呈暖亮(block 15 源), 与 a1 成对账(黑框=旧光晕同形);
//  a3 夜拍: 夜段(dayTime=14000)+火把 2 格外 — 沙壁火层带顶点 block 全 ≥1
//     (H2 双通道: 熄格随环境 BFS 透光; 旧径熄格 block 恒 0 → 夜间暗差接缝必现), 同机位拍;
//  b 顶点光读数面: 沙壁朝火格整格高竖直面顶点 aSky/aBlock — 归因报告 §2 病灶面
//     直接读数(旧径 0/0 渲染纯黑的黑侧壁), 修复后 sky=15 / 随环境 block;
//  c 门额牌状态: 木横梁下挂 id 80 门额牌 — 横梁朝牌底面顶点 sky 非全零(≈14 BFS 绕入;
//     旧径牌格挡光恒 0=横梁底面黑)。unit 面 opaque(80)===false 已由红测锁定, 本件补观感读数。
'use strict';
const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER_PORT = 8097;
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

/* 地面顶面(y=cy 平面)顶点 sky/block 读数(参照件同款)。
   口径注记: 仅收体素面顶点(坐标全整数) — 篝火部件网格顶点是格内分数坐标
   (CF_PARTS bb 0.125/0.875 等), 其「面朝向邻格」采样在贴邻真挡光格(如本次
   自建沙壁)时恒 0/0 是 MC 正确语义非病灶回归, 从地形判据读数中剔除。 */
const GROUND_FN = `
function groundLightSamples(cx, cy, cz) {
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-4;
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
      if (md <= 6) out.missing.push({mat: o.material && o.material.type, n: pos.count,
        bx: +bx.toFixed(1), bz: +bz.toFixed(1), r: bp ? +bp.radius.toFixed(1) : -1});
      return;
    }
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      if (Math.abs(vy - cy) > 0.02) continue;
      if (!isInt(vx) || !isInt(vy) || !isInt(vz)) continue; /* 只收体素面顶点 */
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

/* 病灶面直读: 沙壁朝火格竖直面(x=cx+1 平面, 火格层带 y∈[cy,cy+2])顶点 aSky/aBlock。
   火层带(fireLevel, y<cy+1)四面顶点=墙面采样熄态篝火格 — 归因报告 §2 黑侧壁病灶面;
   上层带(airLevel, y≥cy+1)=墙面采样火格上方空气 — 天然对照(恒 sky 15)。
   同款整数坐标过滤(剔篝火部件分数坐标顶点, 见 groundLightSamples 口径注记)。 */
const WALL_FN = `
function sideWallSamples(cx, cy, cz) {
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-4;
  const out = {fireLevel: [], airLevel: [], missing: []};
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    const sky = o.geometry.attributes.aSky;
    const blk = o.geometry.attributes.aBlock;
    const bp = o.geometry.boundingSphere;
    const bx = o.position.x + (bp ? bp.center.x : 0), bz = o.position.z + (bp ? bp.center.z : 0);
    const md = Math.max(Math.abs(bx - (cx + 0.5)), Math.abs(bz - (cz + 0.5)));
    if (md > 12) return;
    if (!sky || !blk) {
      out.missing.push({mat: o.material && o.material.type, n: pos.count,
        bx: +bx.toFixed(1), bz: +bz.toFixed(1)});
      return;
    }
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      if (Math.abs(vx - (cx + 1)) > 0.02) continue; /* 沙壁朝火格竖直面所在平面 */
      if (vz < cz - 0.02 || vz > cz + 1.02) continue; /* 火格正后方一列 */
      if (vy < cy - 0.02 || vy > cy + 2 + 0.02) continue;
      if (!isInt(vx) || !isInt(vy) || !isInt(vz)) continue;
      const rec = {x: +vx.toFixed(2), y: +vy.toFixed(2), z: +vz.toFixed(2),
        sky: +sky.getX(i).toFixed(3), blk: +blk.getX(i).toFixed(3)};
      (vy < cy + 1 ? out.fireLevel : out.airLevel).push(rec);
    }
  });
  const bySky = (a, b) => a.sky - b.sky;
  out.fireLevel.sort(bySky);
  out.airLevel.sort(bySky);
  return out;
}`;

/* 门额牌读数: 横梁底面(y=ly 平面, 牌格正上方一列)朝下面(normal.y≈−1)顶点
   sky/block — 采样牌格(id 80)。法线过滤剔出门额牌竖板自身顶缘顶点(板顶面朝上
   采样横梁、板侧面朝西采样木柱 — 采样真挡光格恒 0 是 MC 正确语义, 非本判据面) */
const GATE_FN = `
function lintelBottomSamples(lx0, lx1, ly, lz) {
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    const nor = o.geometry.attributes.normal;
    const sky = o.geometry.attributes.aSky;
    const blk = o.geometry.attributes.aBlock;
    if (!sky || !blk) return;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      if (Math.abs(vy - ly) > 0.02) continue;
      if (vx < lx0 - 0.02 || vx > lx1 + 0.02) continue;
      if (vz < lz - 0.02 || vz > lz + 1.02) continue;
      if (!nor || nor.getY(i) > -0.99) continue; /* 只收朝下面(横梁底面) */
      out.push({x: +vx.toFixed(2), y: +vy.toFixed(2), z: +vz.toFixed(2),
        sky: +sky.getX(i).toFixed(3), blk: +blk.getX(i).toFixed(3)});
    }
  });
  out.sort((a, b) => a.sky - b.sky);
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
    ${GROUND_FN}
    ${WALL_FN}
    ${GATE_FN}

    function shotAt(ex, ey, ez, tx, ty, tz) {
      const W = renderer.domElement.width, H = renderer.domElement.height;
      const cam2 = new THREE.PerspectiveCamera(55, W / H, 0.05, 200);
      cam2.position.set(ex, ey, ez);
      cam2.lookAt(tx, ty, tz);
      renderer.render(scene, cam2);
      return renderer.domElement.toDataURL('image/png');
    }
    const wallShot = () => shotAt(cell.x - 2.2, cell.y + 1.4, cell.z + 0.5,
      cell.x + 1.5, cell.y + 0.6, cell.z + 0.5); /* 东望沙壁, 火格居中前景 */

    /* 选址: 出生点旁自由格(参照件同款) */
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

    /* 自建受采样几何: 沙壁 2×3×3 紧贴火格东面(wall west face x=x+1 即病灶竖直面) */
    const placed = [];
    const put = (bx, by, bz, id) => { editBlock(bx, by, bz, id); placed.push([bx, by, bz, id]); };
    const SAND = (typeof B_SANDSTONE !== 'undefined') ? B_SANDSTONE : 58;
    for (let wx = x + 1; wx <= x + 2; wx++) {
      for (let wy = y; wy <= y + 2; wy++) {
        for (let wz = z - 1; wz <= z + 1; wz++) put(wx, wy, wz, SAND);
      }
    }
    await sleep(1500);

    const summar = (g) => ({
      nearN: g.near.length,
      nearAll: g.near.map((r) => r.sky + '/' + r.blk).join(','),
      darkN: g.near.filter((r) => r.sky === 0 && r.blk === 0).length,
      darkAt: g.near.filter((r) => r.sky === 0 && r.blk === 0)
        .map((r) => '(' + r.x + ',' + r.z + ')').join(' ') || '(none)',
      missing: g.missing});
    const wallSummar = (w) => ({
      fireN: w.fireLevel.length, airN: w.airLevel.length,
      fireAll: w.fireLevel.map((r) => r.sky + '/' + r.blk).join(','),
      airAll: w.airLevel.map((r) => r.sky + '/' + r.blk).join(','),
      fireMinSky: w.fireLevel.length ? Math.min(...w.fireLevel.map((r) => r.sky)) : -1,
      fireMinBlk: w.fireLevel.length ? Math.min(...w.fireLevel.map((r) => r.blk)) : -1,
      missing: w.missing});

    /* ① 燃态: 光晕读数+拍(a2) */
    editBlock(x, y, z, 81);
    advCampfires.plant(x, y, z);
    advCampfireFx.open(x, y, z);
    await sleep(1500);
    const litGround = summar(groundLightSamples(x, y, z));
    const litWall = wallSummar(sideWallSamples(x, y, z));
    const shotLit = wallShot();

    /* ② 熄态稳定态(2.4s): 黑框消除判据读数+拍(a1/b) */
    advCampfireFx.quench(x, y, z);
    advCampfires.drop(x, y, z);
    editBlock(x, y, z, 82);
    await sleep(2400);
    const outGround = summar(groundLightSamples(x, y, z));
    const outWall = wallSummar(sideWallSamples(x, y, z));
    const shotOut = wallShot();

    /* ③ 夜拍: 火把 2 格外 + 夜段 — 双通道无暗差接缝判据(a3) */
    const torchId = (typeof B_TORCH !== 'undefined') ? B_TORCH : 3;
    put(x - 2, y, z, torchId);
    dayTime = 14000;
    await sleep(1800);
    const nightWall = wallSummar(sideWallSamples(x, y, z));
    const nightGround = summar(groundLightSamples(x, y, z));
    const shotNight = wallShot();

    /* 回昼, 拆火把(夜间件收尾) */
    dayTime = 600;
    editBlock(x - 2, y, z, 0);
    await sleep(600);

    /* ④ 门额牌: 木横梁下挂 id 80 — 横梁朝牌底面读数(c)。
       选址扫描(确定性序): 三柱列等高 + 牌格自身/两侧邻格空气(BFS 天光侧源)
       才定址 — 展馆展台(x55/69)等展品结构会遮天光, 撞上则牌格 sky 恒 0 读数失效 */
    const WOOD = 6;
    let gate = null;
    for (const [candX, candZ] of [[x + 5, z - 5], [x, z - 5], [x + 5, z + 5],
      [x, z + 5], [x, z - 6], [x, z + 6], [x + 6, z], [x - 6, z]]) {
      const g0 = groundTop(candX, candZ); const g1 = groundTop(candX + 1, candZ);
      const g2 = groundTop(candX + 2, candZ);
      if (!(g0 === g1 && g1 === g2)) continue;
      const b = g0 + 1;
      const empty = (bx, by, bz) => getBlock(bx, by, bz) === 0;
      /* 牌格中列 + 两侧邻格(天光侧源)+ 横梁带 + 柱位全空才定址 */
      if (!empty(candX + 1, b + 2, candZ)) continue;
      if (!empty(candX + 1, b + 2, candZ - 1) || !empty(candX + 1, b + 2, candZ + 1)) continue;
      if (!empty(candX, b, candZ) || !empty(candX + 2, b, candZ)) continue;
      if (!empty(candX, b + 3, candZ) || !empty(candX + 1, b + 3, candZ) ||
          !empty(candX + 2, b + 3, candZ)) continue;
      gate = {x: candX, z: candZ, base: b};
      break;
    }
    if (!gate) return {ok: false, err: 'no clear gate site', cell};
    const gx = gate.x; const gz = gate.z; const base = gate.base;
    for (let wy = base; wy <= base + 2; wy++) { put(gx, wy, gz, WOOD); put(gx + 2, wy, gz, WOOD); }
    for (let wx = gx; wx <= gx + 2; wx++) put(wx, base + 3, gz, WOOD); /* 横梁 */
    put(gx + 1, base + 2, gz, 80); /* 门额牌挂横梁下 */
    await sleep(1500);
    /* 格值自诊断(lightSkyAt/lightBlockAt 全局读数): 牌格预期 sky≈14(BFS 绕入)
       — 若 0 则定址仍被遮挡, 读数标 invalid 不作判据 */
    const diag = {
      signCell: {sky: lightSkyAt(gx + 1, base + 2, gz), blk: lightBlockAt(gx + 1, base + 2, gz)},
      sideAirZm1: {sky: lightSkyAt(gx + 1, base + 2, gz - 1), blk: lightBlockAt(gx + 1, base + 2, gz - 1)},
      sideAirZp1: {sky: lightSkyAt(gx + 1, base + 2, gz + 1), blk: lightBlockAt(gx + 1, base + 2, gz + 1)}};
    const lintelBottom = lintelBottomSamples(gx + 1, gx + 2, base + 3, gz);
    const shotGate = shotAt(gx + 1.5, base + 2.6, gz + 3.2, gx + 1.5, base + 2.2, gz + 0.5);

    /* 清场(展馆内存派生退出无痕, 礼貌复位) */
    for (const [bx, by, bz] of placed) editBlock(bx, by, bz, 0);
    editBlock(x, y, z, 0);
    editBlock(gx + 1, base + 2, gz, 0);
    advCampfires.drop(x, y, z);
    advCampfireFx.clear();
    await sleep(400);

    const gateSummar = {
      at: [gx + 1, base + 2, gz],
      diag,
      signCellValid: diag.signCell.sky > 0, /* 定址有效: 牌格有侧源天光 */
      n: lintelBottom.length,
      all: lintelBottom.map((r) => r.sky + '/' + r.blk).join(','),
      minSky: lintelBottom.length ? Math.min(...lintelBottom.map((r) => r.sky)) : -1};
    return {ok: true, cell, wall: {at: [x + 1, y, z], note: 'west face x=x+1 即病灶竖直面'},
      gate: {summary: gateSummar},
      lit: {ground: litGround, wall: litWall},
      out: {ground: outGround, wall: outWall},
      night: {ground: nightGround, wall: nightWall},
      criteria: {
        a1_outGroundDarkN: outGround.darkN,
        a1_outWallFireMinSky: outWall.fireMinSky,
        b_outWallFireAll: outWall.fireAll,
        a2_litWallFireAll: litWall.fireAll,
        a3_nightWallFireMinBlk: nightWall.fireMinBlk,
        a3_nightWallFireAll: nightWall.fireAll,
        c_gateLintelMinSky: gateSummar.minSky},
      shots: {lit: shotLit, out: shotOut, night: shotNight, gate: shotGate}};
  } catch (e) {
    return {ok: false, err: String(e && e.stack || e)};
  }
})()`;

async function main() {
  const outDir = __dirname;
  const server = spawn('node', ['server.js', String(SERVER_PORT)], {cwd: ROOT, stdio: 'ignore'});
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'tc13r7-light-profile'),
    '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader',
    '--window-size=1200,800', URL_PAGE,
  ], {stdio: 'ignore'});
  let ws = null;
  try {
    await waitFor(async () => (await httpGet(`http://127.0.0.1:${SERVER_PORT}/index.html`)).status === 200, 15000);
    console.log('[r7-probe] server up (port ' + SERVER_PORT + ', PO 试玩 8090 未触碰)');
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
    console.log('[r7-probe] evaluating driver (~18s)...');
    const resp = await send('Runtime.evaluate', {expression: DRIVER, awaitPromise: true, returnByValue: true});
    const v = resp.result && resp.result.result && resp.result.result.value;
    if (!v || !v.ok) {
      console.error('[r7-probe] DRIVER FAILED:', JSON.stringify(v || resp, null, 2));
      process.exitCode = 1;
      return;
    }
    const shots = v.shots; delete v.shots;
    fs.writeFileSync(path.join(outDir, 'probe-r7-light.json'), JSON.stringify(v, null, 2));
    for (const name of Object.keys(shots)) {
      const b64 = shots[name].replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(outDir, `r7-${name}.png`), Buffer.from(b64, 'base64'));
    }
    console.log('cell=' + JSON.stringify(v.cell));
    console.log('criteria=' + JSON.stringify(v.criteria, null, 2));
    console.log('[r7-probe] done -> probe-r7-light.json + r7-lit/out/night/gate.png');
  } finally {
    try { if (ws) ws.close(); } catch (e) { /* noop */ }
    try { chrome.kill(); } catch (e) { /* noop */ }
    try { server.kill(); } catch (e) { /* noop */ }
  }
}
main().catch((e) => { console.error('[r7-probe] FATAL', e); process.exit(1); });
