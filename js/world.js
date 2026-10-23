'use strict';
/* ============================================================
   渲染 adapter（World · 术语见 GLOSSARY.md 的"场景装填/距离环"）— 引擎层
   ------------------------------------------------------------
   体素模型的渲染端: 场景/灯光/贴图/区块网格(全细节+LOD)/编辑管线/高亮。
   纯体素数据(存取/碰撞/物理/射线)在 js/voxel.js — 本文件不定义游戏规则。
   interface: loadScene(建场 seam: 清场→批量建→渐进收尾入队) / markDirty /
     pumpRemesh(每帧按预算构建, 编辑优先于环填充) / maintainRings(距离环:
     近实远虚三档) / rebuildAll / raycast / camera / renderer / scene。
   依赖(均经全局名, 调用期解析): voxel.js(体素数据) · mesh-core.js(网格化
   核心, 同一份代码在 Worker 里跑) · config.js(VIEW/CAM) · lib/three.min.js。
   THREE/DOM 惰性创建, Node 测试环境可安全加载(经 boot.test.js 冒烟)。
============================================================ */

/* ---------- 噪声哈希与世界数据已移至 js/voxel.js (体素模型) ---------- */

/* ---------- Three.js 场景 ---------- */
/* 抗锯齿策略: 体素世界的锯齿主源是远处方块轮廓与细线高亮框的高对比几何
   边缘, MSAA 恰好只平滑几何边缘、不糊像素观感, 对本画风收益最大 —
   全设备开启 (旧"触屏关 MSAA 省 1.5 填充率"假设对 2D 像素成立,
   对 3D 透视几何不成立, 已由触屏 DPR 帧率自适应取代, 见 main.js)。
   high-performance 提示移动 GPU 拉满时钟(默认不指定偏保守)。 */
const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // 初始拉满; 触屏按帧率证据自适应回落
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const sky = new THREE.Color(0x8fc7ff);
scene.background = sky;
scene.fog = new THREE.Fog(sky, VIEW.fogNear, VIEW.fogFar); // 雾即渲染边界(Minecraft 同款语义): 远景到雾终点融进天色

// far 只到雾终点+余量 — 雾外顶点不再参与变换与深度精度(原 1000 白交)
const camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.1, VIEW.far);

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const sun = new THREE.DirectionalLight(0xfff4e0, 0.75);
sun.position.set(60, 120, 40);
scene.add(sun);

function makeSunTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,235,1)');
  grad.addColorStop(0.22, 'rgba(255,235,140,1)');
  grad.addColorStop(0.45, 'rgba(255,195,70,0.55)');
  grad.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const sunTex = makeSunTexture();
const sunSprites = [];
for (let i=0; i<3; i++) {
  for (let j=0; j<3; j++) {
    const m = new THREE.SpriteMaterial({map: sunTex, fog: false, transparent: true, depthWrite: false});
    const s = new THREE.Sprite(m);
    const size = 16 + ((i*3+j)%3)*5;
    s.position.set(24 + i*38, 95 + j*24, -110);
    s.scale.set(size, size, 1);
    s.userData.base = size;
    s.userData.phase = (i*3+j) * 0.7;
    sunSprites.push(s);
    scene.add(s);
  }
}

/* 材质侧面: 网格生成已剔除实心邻面且法线一律朝外, 实心/TNT 几何的
   背面永远不可见 → FrontSide 让 GPU 在光栅化前丢弃背面三角形(省约
   一半填充率)。玻璃/水需从透明体内侧观看, 保留 DoubleSide。 */
const blockMat = new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.FrontSide});
const glassMat = new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide,
  transparent: true, opacity: 0.32, depthWrite: false});

/* TNT 贴图图集: 缓冲垫/顶/底/侧 四格竖排, 像素风。
   高度取 2 的幂(256): WebGL1 下 NPOT 纹理不能生成 mipmap; 第 0 格画满
   侧格底色, 远处 mipmap 混采样时贴图边界不串色。
   图集格数 TNT_TILES 已移 config.js — 单一来源, 本画布与网格化核心的
   UV 除数共读(Worker 侧 importScripts 同源取值) */
function makeTntTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64*TNT_TILES;
  const g = c.getContext('2d');
  const red = '#c33a24'; const dark = '#8f2313';
  const speckle = (x0, y0)=>{ // 红底像素噪点
    for (let i=0; i<90; i++) {
      g.fillStyle = Math.random()<0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.08)';
      g.fillRect(x0+Math.floor(Math.random()*64), y0+Math.floor(Math.random()*64), 2, 2);
    }
  };
  // 第一格: 顶面 (红底 + 深红边框 + 中心引信孔)
  g.fillStyle = red; g.fillRect(0, 0, 64, 64);
  speckle(0, 0);
  g.fillStyle = dark;
  g.fillRect(0, 0, 64, 4); g.fillRect(0, 60, 64, 4); g.fillRect(0, 0, 4, 64); g.fillRect(60, 0, 4, 64);
  g.fillStyle = '#5b1508'; g.fillRect(24, 24, 16, 16);
  g.fillStyle = '#e8c07a'; g.fillRect(28, 28, 8, 8);
  // 第二格: 底面 (深红)
  g.fillStyle = dark; g.fillRect(0, 64, 64, 64);
  g.fillStyle = '#7a1d0f'; g.fillRect(6, 70, 52, 52);
  // 第三格: 侧面 (红底 + 白带 + 黑字 TNT)
  g.fillStyle = red; g.fillRect(0, 128, 64, 64);
  speckle(0, 128);
  g.fillStyle = dark;
  g.fillRect(0, 128, 64, 4); g.fillRect(0, 188, 64, 4);
  g.fillStyle = '#efe7dc'; g.fillRect(4, 148, 56, 24);
  g.fillStyle = '#111';
  g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('TNT', 32, 161);
  // 第 0 号格(末格): mipmap 缓冲垫, 画满侧格底色防远处混色
  g.fillStyle = red; g.fillRect(0, 64*(TNT_TILES-1), 64, 64); const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; // 近处保持像素颗粒
  tex.minFilter = THREE.NearestMipmapLinearFilter; // 远处走 mipmap, 消高频闪烁
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
const tntMat = new THREE.MeshLambertMaterial({map: makeTntTexture(), side: THREE.FrontSide});

/* 方块贴图图集 (js/texture-atlas.js): 像素在纯数据缓冲里确定性生成,
   此处只做画布壳 + CanvasTexture 包装(与 TNT 图集同款管线/滤波口径)。
   alphaTest 裁切让植物十字面片与树叶孔洞呈镂空观感(不透明像素照常
   渲染, 无透明排序负担); 256×256 正方形 2 的幂, WebGL1 mipmap 合法。
   typeof 防御与下方 ringCenter 的 Tank 同款: texture-atlas.js 的 script
   行由集成者加入 index.html, 并入前 boot 冒烟不炸(缺图集 → 纯色兜底)。 */
const ATLAS_LAYOUT = (typeof TextureAtlas !== 'undefined') ? TextureAtlas.layout : null;
function makeAtlasTexture() {
  const tex = new THREE.CanvasTexture(TextureAtlas.makeCanvas(document));
  tex.magFilter = THREE.NearestFilter; // 近处保持像素颗粒
  tex.minFilter = THREE.NearestMipmapLinearFilter; // 远处走 mipmap, 消高频闪烁
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
const atlasMat = new THREE.MeshLambertMaterial({map: ATLAS_LAYOUT ? makeAtlasTexture() : null,
  alphaTest: 0.5, side: THREE.FrontSide});

/* ---------- 区块网格装配 (纯几何在 MeshCore, 此处只做 THREE 装配与场景挂载) ----------
   四通道: solid(不透明)/glass(玻璃)/tnt(TNT贴图)/atlas(方块图集); LOD 通道单网格。
   几何生成走 js/mesh-core.js 纯核心 — 同一份代码在主线程(同步兜底)与
   js/mesh-worker.js(http 服务主路径)里运行, 输出裸数组经 makeGeo 装配。 */
const chunkMeshes = new Map(); // 全细节: key → [Mesh...]
const lodMeshes = new Map(); // LOD 粗网格: key → Mesh
function chunkKey(cx, cz) {
  return cx+','+cz;
}

const makeGeo = (b)=>{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  // 显式包装: Worker 回传的 Uint32Array 不是 BufferAttribute, setIndex 直接塞会炸渲染
  g.setIndex(new THREE.Uint32BufferAttribute(b.indices, 1));
  return g;
};
const makeTexGeo = (b)=>{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  g.setIndex(new THREE.Uint32BufferAttribute(b.indices, 1));
  return g;
};
const addSceneMesh = (geo, mat)=>{
  const m = new THREE.Mesh(geo, mat);
  scene.add(m);
  return m;
};

/* 全细节上挂: 替换该区块全部既有网格(先统一释放再重建)。
   空结果也记账(空数组) — "已服务但无网格"与"未服务"必须可区分, 否则距离环
   会把空气区块当缺口无限重排(测试 test/world-rings.test.js 锁定此行为) */
function mountChunk(cx, cz, r) {
  const k = chunkKey(cx, cz);
  unloadChunk(k);
  const arr = [];
  if (r.solid) arr.push(addSceneMesh(makeGeo(r.solid), blockMat));
  if (r.glass) arr.push(addSceneMesh(makeGeo(r.glass), glassMat));
  if (r.tnt) arr.push(addSceneMesh(makeTexGeo(r.tnt), tntMat));
  if (r.atlas) arr.push(addSceneMesh(makeTexGeo(r.atlas), atlasMat)); // 方块图集通道
  chunkMeshes.set(k, arr); // 空区块记空数组: 环状态机的"已服务"凭据
}
/* LOD 上挂: 顶替全细节(降采样网格成本 ~1/step², 远景视觉等价 — 雾中不可辨) */
function mountChunkLod(cx, cz, r) {
  const k = chunkKey(cx, cz);
  unloadChunk(k);
  lodMeshes.set(k, r && r.solid ? addSceneMesh(makeGeo(r.solid), blockMat) : null); // null=已服务无网格(空气区块)
}

/* 区块三通道网格的统一释放(重建替换与清场共用一条规则) */
function disposeChunkArr(arr) {
  arr.forEach((m)=>{
    scene.remove(m); m.geometry.dispose();
  });
}

/* 一个区块的完整卸载(全细节 + LOD, 含空记账条目) — 上挂替换/环维护/清场的
   唯一释放入口, 两个 Map 的键必须同进同退(残留会挡住环重建) */
function unloadChunk(k) {
  const f = chunkMeshes.get(k);
  if (f) disposeChunkArr(f);
  chunkMeshes.delete(k);
  const l = lodMeshes.get(k);
  if (l) disposeChunkArr([l]);
  lodMeshes.delete(k);
}

/* ---------- 距离环 · 近实远虚 (调研与参数语义: docs/chunk-streaming-lod-research.md §7) ----------
   玩家(或驾驶中的坦克)为环心: ≤fullChunks 全细节实时构建 · 到 lodChunks
   降采样粗网格(成本 ~1/lodStep²) · 更远卸载(GPU 释放, 数据保留, 走近重建)。
   环切换在消费端(pump 出队时按当前距离决定形态), 入队侧只登记缺口 —
   队列条目不会因走远而失效(出队时按 'none' 惰性丢弃)。 */
function ringCenter() {
  if (typeof Tank === 'object' && Tank.driving && Tank.driving()) {
    const t = Tank.at(); // 驾驶中: 坦克是环心
    return {x: t.x, z: t.z};
  }
  return {x: pos.x, z: pos.z};
}
function chunkDist(cx, cz) { // 区块中心到环心的距离(区块单位)
  const c = ringCenter();
  return Math.hypot(cx + 0.5 - c.x/CHUNK, cz + 0.5 - c.z/CHUNK);
}
function desiredState(cx, cz) {
  const d = chunkDist(cx, cz);
  if (d <= VIEW.fullChunks) return 'full';
  if (d <= VIEW.lodChunks) return 'lod';
  return 'none';
}

/* ---------- 网格 Worker (http 服务主路径; file:// 直开自动降级同步构建) ----------
   同源 http 下 Worker 规范保证合法(MDN Worker: same-origin); file:// 下
   构造抛错 → try/catch 兜底走同步路径(同一队列, 只是消费者不同)。
   协议: 请求 {gen,cx,cz,token,kind,cells(ArrayBuffer 转移),pack 元数据} →
   响应 {gen,cx,cz,token,kind,res}。gen=清场次号(旧响应整体作废);
   token=同区块递增(在途期间再入队, 旧响应丢弃)。 */
let meshWorker = null;
let workerTried = false;
let meshGen = 0;
const inFlight = new Map(); // key → {token, gen}
const meshToken = new Map(); // key → 最新 token

function ensureWorker() {
  if (workerTried) return;
  workerTried = true;
  try {
    meshWorker = new Worker('js/mesh-worker.js');
    meshWorker.onmessage = (e)=>{
      const m = e.data;
      if (m.gen !== meshGen) return; // 清场后的旧响应: 整体作废
      const k = chunkKey(m.cx, m.cz);
      const fl = inFlight.get(k);
      if (!fl || fl.token !== m.token) return; // 已被更新的请求取代
      inFlight.delete(k);
      if (m.kind === 'full') mountChunk(m.cx, m.cz, m.res);
      else mountChunkLod(m.cx, m.cz, m.res);
    };
    meshWorker.onerror = ()=>{ // 加载失败等: 回落同步, 在途区块回队
      meshWorker = null;
      for (const k of inFlight.keys()) {
        if (!remeshQueued.has(k)) {
          remeshQueued.add(k); remeshQueue.push(k);
        }
      }
      inFlight.clear();
    };
  } catch (e) {
    meshWorker = null;
  } // file://: SecurityError / 测试桩: ReferenceError → 同步兜底
}

/* 消费一个区块 key: 按当前环形态走 Worker 或同步构建。
   kind→构建参数的映射与 js/mesh-worker.js 的 onmessage 各持一份(跨线程
   无法共享函数), 改协议须两边同步改 — test/mesh-worker.test.js 锁协议 */
/* 全细节 opts: hashRand 来自 voxel.js, 图集布局来自 texture-atlas.js — 均单一来源 */
const MESH_OPTS = {hashRand, tntTiles: TNT_TILES, atlas: ATLAS_LAYOUT};
function serveChunkKey(k) {
  const c = k.split(','); const cx = +c[0]; const cz = +c[1];
  if (cx<0||cz<0||cx>=NCX||cz>=NCZ) return false;
  const st = desiredState(cx, cz);
  if (st === 'none') return false; // 走远了: 惰性丢弃
  ensureWorker();
  if (meshWorker) {
    const pack = packChunkData(cx, cz, st === 'full' ? 1 : 0);
    const token = (meshToken.get(k) || 0) + 1;
    meshToken.set(k, token);
    inFlight.set(k, {token, gen: meshGen});
    meshWorker.postMessage(
        {gen: meshGen, cx, cz, token, kind: st, cells: pack.cells.buffer,
          w: pack.w, d: pack.d, h: pack.h, border: pack.border, bx: pack.bx, bz: pack.bz, yMax: pack.yMax},
        [pack.cells.buffer]); // transferable: 所有权零拷贝转移
  } else if (st === 'full') {
    mountChunk(cx, cz, MeshCore.meshChunk(packChunkData(cx, cz, 1), MESH_OPTS));
  } else {
    mountChunkLod(cx, cz, MeshCore.meshChunkLod(packChunkData(cx, cz, 0), {step: VIEW.lodStep}));
  }
  return true;
}

/* 环维护: 卸载远区块 · 登记形态缺口/需切换的区块(近处优先)。
   环心跨界才全扫 — 同区块内的小位移不重算(消除 fullChunks 边界上的
   形态抖动, 也免大地图每帧全扫); 清场后由 rebuildAll 全量入队兜底 */
const ringQueue = []; // 距离环填充队列(已按距离排序)
const ringQueued = new Set();
let ringCcx = -1e9; let ringCcz = -1e9; // 上次全扫的环心区块
function maintainRings() {
  const c = ringCenter();
  const ncx = Math.floor(c.x/CHUNK); const ncz = Math.floor(c.z/CHUNK);
  if (ncx === ringCcx && ncz === ringCcz) return; // 未跨界: 环状态不变
  ringCcx = ncx; ringCcz = ncz;
  for (let cx=0; cx<NCX; cx++) {
    for (let cz=0; cz<NCZ; cz++) {
      const k = chunkKey(cx, cz);
      const d = chunkDist(cx, cz);
      if (d > VIEW.lodChunks) { // 卸载环: GPU 释放, 数据保留
        unloadChunk(k);
        continue;
      }
      const wantFull = d <= VIEW.fullChunks;
      const hasFull = chunkMeshes.has(k); const hasLod = lodMeshes.has(k);
      if (wantFull ? hasFull : hasLod) continue; // 已是目标形态
      if (ringQueued.has(k) || remeshQueued.has(k) || inFlight.has(k)) continue;
      ringQueued.add(k);
      ringQueue.push({k, d});
    }
  }
  ringQueue.sort((a, b)=>a.d-b.d); // 近处优先(≤ 数百项, 每帧排序无感)
}

/* 收尾纪律的渐进版: 全部区块入环队列(近处优先), 由 pump 每帧按预算构建 —
   进场先见脚下, 远景数帧内铺满; 建场不再一次性顶爆帧预算 */
function rebuildAll() {
  const all = [];
  for (let cx=0; cx<NCX; cx++) {
    for (let cz=0; cz<NCZ; cz++) {
      all.push({k: chunkKey(cx, cz), d: chunkDist(cx, cz)});
    }
  }
  all.sort((a, b)=>a.d-b.d);
  for (const it of all) {
    if (!ringQueued.has(it.k)) {
      ringQueued.add(it.k); ringQueue.push(it);
    }
  }
}

/* 场景装填 seam: 清场 → 批量建 → 收尾入队, 一步到位。
   "建完必须 rebuildAll 否则整场不可见"的收尾纪律收在此处, 调用方
   不可能忘(曾有模式建场漏调收尾, 进场一片天蓝 — ca3ac43)。
   clearWorld 幂等(switchMode 已清过再清无害)。 */
function loadScene(buildFn) {
  clearWorld();
  buildFn();
  rebuildAll();
}

/* 单块编辑: 挖除出同色碎屑是默认反馈; 调用方要静默挖除(如模式自己的
   定制反馈)传 opt {debris:false}。反馈政策可关, 缺省保持原行为 */
function editBlock(x, y, z, id, opt) {
  const old = getBlock(x, y, z);
  setBlockRaw(x, y, z, id);
  if (id === 0 && old !== 0 && !(opt && opt.debris === false)) { // 挖除反馈: 同色碎屑(唯一入口经 Fx, 见 GLOSSARY)
    const c = faceColor(old, [0, 1, 0]); // 顶面色 — 方块注册表的单一来源
    Fx.debrisBurst(x+0.5, y+0.5, z+0.5, 6, {
      color: (Math.round(c[0]*255)<<16) | (Math.round(c[1]*255)<<8) | Math.round(c[2]*255),
      life: 0.7});
  }
  markDirty(x, z); // 单块编辑与批量同走队列(连续挖掘同样摊平)
  flushDirty();
}

/* ---------- 编辑管线: 单块/批量统一走重建队列 ----------
   重建一个 16×16×48 区块在移动端要数毫秒, 爆炸(1~4 区块)或连续挖掘
   同帧全量重建会顶爆帧预算(pad 真机开炮顿挫的主因) → 统一入队,
   主循环每帧按预算出队(视觉滞后 ≤2 帧 ≈ 33ms, 不可感知)。 */
const dirtyChunks = new Set(); // 本批已记账、尚未入队的区块
const remeshQueue = []; // 重建队列(FIFO)
const remeshQueued = new Set(); // 在队去重(同区块多次标记只排一次)
function markDirty(x, z) {
  const cx=Math.floor(x/CHUNK); const cz=Math.floor(z/CHUNK);
  dirtyChunks.add(chunkKey(cx, cz));
  if (x % CHUNK === 0) dirtyChunks.add(chunkKey(cx-1, cz));
  if (x % CHUNK === CHUNK-1) dirtyChunks.add(chunkKey(cx+1, cz));
  if (z % CHUNK === 0) dirtyChunks.add(chunkKey(cx, cz-1));
  if (z % CHUNK === CHUNK-1) dirtyChunks.add(chunkKey(cx, cz+1));
}
function editBlockDirty(x, y, z, id) {
  setBlockRaw(x, y, z, id);
  markDirty(x, z);
}
function flushDirty() { // 记账收口: 脏区块转入重建队列
  for (const k of dirtyChunks) {
    if (!remeshQueued.has(k)) {
      remeshQueued.add(k); remeshQueue.push(k);
    }
  }
  dirtyChunks.clear();
}
function pumpRemesh(n) { // 每帧出队(主循环每帧调用; 同步预算 n, Worker 派发上限 VIEW.dispatch)
  flushDirty(); // 自动收口: 漏调 flushDirty 的脏区块最迟本帧入队(不再永远不可见); 批量编辑后手动 flush 仍是可选的即时提交
  ensureWorker();
  maintainRings();
  /* 编辑优先(玩家正看着), 环填充其次; Worker 路径下"出队"只是打包+派发,
     帧成本极低 — 网格在后台算, 响应异步回来挂载(视觉滞后 ≤2 帧不变) */
  let budget = meshWorker ? VIEW.dispatch : n;
  while (budget > 0 && remeshQueue.length) {
    const k = remeshQueue.shift();
    remeshQueued.delete(k);
    if (serveChunkKey(k)) budget--;
  }
  while (budget > 0 && ringQueue.length) {
    const it = ringQueue.shift();
    ringQueued.delete(it.k);
    if (serveChunkKey(it.k)) budget--;
  }
}

/* 清空世界(切换模式/重置关卡用) */
function clearWorld() {
  world.clear();
  meshGen++; // 在途 Worker 响应整体作废
  inFlight.clear();
  meshToken.clear();
  dirtyChunks.clear();
  remeshQueue.length = 0;
  remeshQueued.clear();
  ringQueue.length = 0;
  ringQueued.clear();
  ringCcx = ringCcz = -1e9; // 环缓存作废: 新世界的环维护必须重新全扫
  for (const k of chunkMeshes.keys()) unloadChunk(k);
  chunkMeshes.clear();
  lodMeshes.clear();
}

/* ---------- 方块高亮 ---------- */
const hlGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
const hlEdges = new THREE.EdgesGeometry(hlGeo);
const highlight = new THREE.LineSegments(hlEdges,
    new THREE.LineBasicMaterial({color: 0x000000, transparent: true, opacity: 0.5}));
highlight.visible = false;
scene.add(highlight);
