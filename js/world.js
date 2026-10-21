"use strict";
/* ============================================================
   渲染 adapter (THREE): 场景 / 灯光 / 贴图 / 区块网格 / 编辑管线 / 高亮
   纯体素模型(数据/碰撞/物理/射线)在 js/voxel.js — 本文件不定义游戏规则
============================================================ */

/* ---------- 噪声哈希与世界数据已移至 js/voxel.js (体素模型) ---------- */

/* ---------- Three.js 场景 ---------- */
const _coarse = (function(){ try{ return (navigator.maxTouchPoints||0) > 0; }catch(e){ return false; } })();
/* 触屏(pad)策略: 高 DPI 下 MSAA 对像素风画面几乎无感, 关掉省一大块填充率;
   high-performance 提示移动 GPU 拉满时钟(默认不指定偏保守) */
const renderer = new THREE.WebGLRenderer({
  antialias: !_coarse,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(devicePixelRatio, _coarse ? 1.5 : 2));   // 触屏设备限 1.5 省性能
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const sky = new THREE.Color(0x8fc7ff);
scene.background = sky;
scene.fog = new THREE.Fog(sky, 90, 230);

const camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.1, 1000);

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const sun = new THREE.DirectionalLight(0xfff4e0, 0.75);
sun.position.set(60, 120, 40);
scene.add(sun);

function makeSunTexture(){
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64,64,0, 64,64,64);
  grad.addColorStop(0,    'rgba(255,255,235,1)');
  grad.addColorStop(0.22, 'rgba(255,235,140,1)');
  grad.addColorStop(0.45, 'rgba(255,195,70,0.55)');
  grad.addColorStop(1,    'rgba(255,160,40,0)');
  g.fillStyle = grad;
  g.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);
}
const sunTex = makeSunTexture();
const sunSprites = [];
for(let i=0;i<3;i++){
  for(let j=0;j<3;j++){
    const m = new THREE.SpriteMaterial({map:sunTex, fog:false, transparent:true, depthWrite:false});
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
const blockMat = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.FrontSide});
const glassMat = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide,
  transparent:true, opacity:0.32, depthWrite:false});

/* TNT 贴图图集: 上/下/侧 三格竖排, 像素风 */
function makeTntTexture(){
  const c = document.createElement('canvas');
  c.width = 64; c.height = 192;
  const g = c.getContext('2d');
  const red = '#c33a24', dark = '#8f2313';
  const speckle = (x0,y0)=>{                       // 红底像素噪点
    for(let i=0;i<90;i++){
      g.fillStyle = Math.random()<0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.08)';
      g.fillRect(x0+Math.floor(Math.random()*64), y0+Math.floor(Math.random()*64), 2, 2);
    }
  };
  // 第一格: 顶面 (红底 + 深红边框 + 中心引信孔)
  g.fillStyle = red; g.fillRect(0,0,64,64);
  speckle(0,0);
  g.fillStyle = dark;
  g.fillRect(0,0,64,4); g.fillRect(0,60,64,4); g.fillRect(0,0,4,64); g.fillRect(60,0,4,64);
  g.fillStyle = '#5b1508'; g.fillRect(24,24,16,16);
  g.fillStyle = '#e8c07a'; g.fillRect(28,28,8,8);
  // 第二格: 底面 (深红)
  g.fillStyle = dark; g.fillRect(0,64,64,64);
  g.fillStyle = '#7a1d0f'; g.fillRect(6,70,52,52);
  // 第三格: 侧面 (红底 + 白带 + 黑字 TNT)
  g.fillStyle = red; g.fillRect(0,128,64,64);
  speckle(0,128);
  g.fillStyle = dark;
  g.fillRect(0,128,64,4); g.fillRect(0,188,64,4);
  g.fillStyle = '#efe7dc'; g.fillRect(4,148,56,24);
  g.fillStyle = '#111';
  g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('TNT', 32, 161);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}
const tntMat = new THREE.MeshLambertMaterial({map:makeTntTexture(), side:THREE.FrontSide});

/* ---------- 区块网格构建 (不透明 + 玻璃双通道 + 贴地薄块) ---------- */
const FACES = [
  { dir:[-1,0,0], corners:[ [0,1,0],[0,0,0],[0,1,1],[0,0,1] ] },
  { dir:[ 1,0,0], corners:[ [1,1,1],[1,0,1],[1,1,0],[1,0,0] ] },
  { dir:[0,-1,0], corners:[ [1,0,1],[0,0,1],[1,0,0],[0,0,0] ] },
  { dir:[0, 1,0], corners:[ [0,1,1],[1,1,1],[0,1,0],[1,1,0] ] },
  { dir:[0,0,-1], corners:[ [1,0,0],[0,0,0],[1,1,0],[0,1,0] ] },
  { dir:[0,0, 1], corners:[ [0,0,1],[1,0,1],[0,1,1],[1,1,1] ] }
];

const chunkMeshes = new Map();
function chunkKey(cx,cz){ return cx+','+cz; }

/* 贴地薄块(引线/压力板):不参与面剔除,始终绘制一个扁盒子 */
function pushThin(t, x, y, z, h, col, tint){
  for(let f=0; f<6; f++){
    if(f===2) continue;                       // 跳过底面
    const face = FACES[f];
    for(let c=0;c<4;c++){
      const cor = face.corners[c];
      t.positions.push(x+cor[0], y+cor[1]*h, z+cor[2]);
      t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
      t.colors.push(col[0]*tint, col[1]*tint, col[2]*tint);
    }
    t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
    t.n += 4;
  }
}

/* 面朝向 → UV (保证侧面文字不镜像) */
function faceUV(dir, cor){
  let u, v;
  if(dir[1] === 1)       { u = cor[0];   v = 1-cor[2]; }   // 顶
  else if(dir[1] === -1) { u = 1-cor[0]; v = 1-cor[2]; }   // 底
  else if(dir[0] === 1)  { u = 1-cor[2]; v = cor[1];   }   // 东
  else if(dir[0] === -1) { u = cor[2];   v = cor[1];   }   // 西
  else if(dir[2] === 1)  { u = cor[0];   v = cor[1];   }   // 南
  else                   { u = 1-cor[0]; v = cor[1];   }   // 北
  return [u, v];
}

function buildChunkGeometries(cx, cz){
  const S = {positions:[], colors:[], normals:[], indices:[], n:0};
  const G = {positions:[], colors:[], normals:[], indices:[], n:0};
  const T = {positions:[], uvs:[], normals:[], indices:[], n:0};   // TNT 贴图通道
  const x0=cx*CHUNK, z0=cz*CHUNK;
  /* y 上限截断: 经高度缓存 O(1) 取本区块实际最高方块, 不再扫整段天空
     (竞技场柱高 ~26/48 · TNT 密室 ~15/48, 挖放/爆炸触发的重建省约
     一半扫描; 邻块面剔除只读本格 y≤上限, 不受邻区块高度影响) */
  let yMax = 0;
  for(let x=x0; x<x0+CHUNK; x++)
    for(let z=z0; z<z0+CHUNK; z++){
      const t = groundTop(x,z);
      if(t > yMax) yMax = t;
    }
  for(let x=x0; x<x0+CHUNK; x++){
    for(let z=z0; z<z0+CHUNK; z++){
      for(let y=0; y<=yMax; y++){
        const id = getBlock(x,y,z);
        if(id===0) continue;
        const b = BLOCKS[id];
        if(b.thin){                             // 引线 / 压力板
          const col = b.all;
          const tint = 0.92 + hashRand(x*3+z, y)*0.12;
          pushThin(S, x, y, z, b.thin, col, tint);
          continue;
        }
        if(b.tnt){                              // TNT: 走贴图通道
          for(let f=0; f<6; f++){
            const face = FACES[f];
            const nx=x+face.dir[0], ny=y+face.dir[1], nz=z+face.dir[2];
            const nid = getBlock(nx,ny,nz);
            const nb = nid!==0 ? BLOCKS[nid] : null;
            if(nb && !nb.glass && !nb.thin) continue;
            const tileV = face.dir[1]===1 ? 2 : (face.dir[1]===-1 ? 1 : 0);  // 顶/底/侧
            for(let c=0;c<4;c++){
              const cor = face.corners[c];
              T.positions.push(x+cor[0], y+cor[1], z+cor[2]);
              T.normals.push(face.dir[0], face.dir[1], face.dir[2]);
              const uv = faceUV(face.dir, cor);
              T.uvs.push(uv[0], (tileV+uv[1])/3);
            }
            T.indices.push(T.n, T.n+1, T.n+2, T.n+2, T.n+1, T.n+3);
            T.n += 4;
          }
          continue;
        }
        const isGlass = !!b.glass;
        for(let f=0; f<6; f++){
          const face = FACES[f];
          const nx=x+face.dir[0], ny=y+face.dir[1], nz=z+face.dir[2];
          const nid = getBlock(nx,ny,nz);
          const nb = nid!==0 ? BLOCKS[nid] : null;
          let target;
          if(isGlass){
            if(nb && !nb.thin) continue;        // 玻璃只对着空气/薄块显示面
            target = G;
          } else {
            if(nb && !nb.glass && !nb.thin) continue; // 实心面被实心邻居遮挡才剔除
            target = S;
          }
          const col = faceColor(id, face.dir);
          const tint = isGlass ? 1 : (0.92 + hashRand(x*3+z, y)*0.12);
          for(let c=0;c<4;c++){
            const cor = face.corners[c];
            target.positions.push(x+cor[0], y+cor[1], z+cor[2]);
            target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
            target.colors.push(col[0]*tint, col[1]*tint, col[2]*tint);
          }
          target.indices.push(target.n, target.n+1, target.n+2, target.n+2, target.n+1, target.n+3);
          target.n += 4;
        }
      }
    }
  }
  const make = (b)=>{
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions,3));
    g.setAttribute('normal',   new THREE.Float32BufferAttribute(b.normals,3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(b.colors,3));
    g.setIndex(b.indices);
    return g;
  };
  const makeTex = (b)=>{
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions,3));
    g.setAttribute('normal',   new THREE.Float32BufferAttribute(b.normals,3));
    g.setAttribute('uv',       new THREE.Float32BufferAttribute(b.uvs,2));
    g.setIndex(b.indices);
    return g;
  };
  return { solid: S.n>0 ? make(S) : null, glass: G.n>0 ? make(G) : null, tnt: T.n>0 ? makeTex(T) : null };
}

function rebuildChunk(cx,cz){
  if(cx<0||cz<0||cx>=NCX||cz>=NCZ) return;
  const k = chunkKey(cx,cz);
  const old = chunkMeshes.get(k);
  if(old){ old.forEach(m=>{ scene.remove(m); m.geometry.dispose(); }); }
  const {solid, glass, tnt} = buildChunkGeometries(cx,cz);
  const arr = [];
  if(solid){ const m=new THREE.Mesh(solid, blockMat); scene.add(m); arr.push(m); }
  if(glass){ const m=new THREE.Mesh(glass, glassMat); scene.add(m); arr.push(m); }
  if(tnt){   const m=new THREE.Mesh(tnt, tntMat);     scene.add(m); arr.push(m); }
  if(arr.length) chunkMeshes.set(k, arr); else chunkMeshes.delete(k);
}

function rebuildAll(){
  for(let cx=0;cx<NCX;cx++)
    for(let cz=0;cz<NCZ;cz++)
      rebuildChunk(cx,cz);
}

function editBlock(x,y,z,id){
  const old = getBlock(x,y,z);
  setBlockRaw(x,y,z,id);
  if(id === 0 && old !== 0){           // 挖除反馈: 同色碎屑(唯一入口经 Fx, 见 GLOSSARY)
    const c = faceColor(old, [0,1,0]);               // 顶面色 — 方块注册表的单一来源
    Fx.debrisBurst(x+0.5, y+0.5, z+0.5, 6, {
      color: (Math.round(c[0]*255)<<16) | (Math.round(c[1]*255)<<8) | Math.round(c[2]*255),
      life: 0.7 });
  }
  markDirty(x,z);                     // 单块编辑与批量同走队列(连续挖掘同样摊平)
  flushDirty();
}

/* ---------- 编辑管线: 单块/批量统一走重建队列 ----------
   重建一个 16×16×48 区块在移动端要数毫秒, 爆炸(1~4 区块)或连续挖掘
   同帧全量重建会顶爆帧预算(pad 真机开炮顿挫的主因) → 统一入队,
   主循环每帧按预算出队(视觉滞后 ≤2 帧 ≈ 33ms, 不可感知)。 */
const dirtyChunks = new Set();                  // 本批已记账、尚未入队的区块
const remeshQueue = [];                         // 重建队列(FIFO)
const remeshQueued = new Set();                 // 在队去重(同区块多次标记只排一次)
function markDirty(x,z){
  const cx=Math.floor(x/CHUNK), cz=Math.floor(z/CHUNK);
  dirtyChunks.add(chunkKey(cx,cz));
  if(x % CHUNK === 0)       dirtyChunks.add(chunkKey(cx-1,cz));
  if(x % CHUNK === CHUNK-1) dirtyChunks.add(chunkKey(cx+1,cz));
  if(z % CHUNK === 0)       dirtyChunks.add(chunkKey(cx,cz-1));
  if(z % CHUNK === CHUNK-1) dirtyChunks.add(chunkKey(cx,cz+1));
}
function editBlockDirty(x,y,z,id){
  setBlockRaw(x,y,z,id);
  markDirty(x,z);
}
function flushDirty(){                          // 记账收口: 脏区块转入重建队列
  for(const k of dirtyChunks){
    if(!remeshQueued.has(k)){ remeshQueued.add(k); remeshQueue.push(k); }
  }
  dirtyChunks.clear();
}
function pumpRemesh(n){                         // 每帧出队重建 n 个(主循环每帧调用)
  while(n-- > 0 && remeshQueue.length){
    const k = remeshQueue.shift();
    remeshQueued.delete(k);
    const c = k.split(',');
    rebuildChunk(+c[0], +c[1]);
  }
}

/* 清空世界(切换模式/重置关卡用) */
function clearWorld(){
  world.clear();
  dirtyChunks.clear();
  remeshQueue.length = 0;
  remeshQueued.clear();
  for(const arr of chunkMeshes.values())
    arr.forEach(m=>{ scene.remove(m); m.geometry.dispose(); });
  chunkMeshes.clear();
}

/* ---------- 方块高亮 ---------- */
const hlGeo = new THREE.BoxGeometry(1.002,1.002,1.002);
const hlEdges = new THREE.EdgesGeometry(hlGeo);
const highlight = new THREE.LineSegments(hlEdges,
  new THREE.LineBasicMaterial({color:0x000000, transparent:true, opacity:0.5}));
highlight.visible = false;
scene.add(highlight);
