"use strict";
/* ============================================================
   引擎核心:噪声 / 世界数据 / 场景 / 区块网格 / 射线 / 玩家物理
============================================================ */

/* ---------- 噪声 / 哈希 ---------- */
const perm = new Uint8Array(512);
(function(){
  const p = new Uint8Array(256);
  for(let i=0;i<256;i++) p[i]=i;
  let s = 20240614;
  const rnd = ()=> (s = (s*16807)%2147483647)/2147483647;
  for(let i=255;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=p[i];p[i]=p[j];p[j]=t; }
  for(let i=0;i<512;i++) perm[i]=p[i&255];
})();
function hashRand(x,z){
  let n = (x*374761393 + z*668265263) >>> 0;
  n = (n ^ (n >> 13)) >>> 0;
  n = (n * 1274126177) >>> 0;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

/* ---------- 世界数据 ---------- */
const world = new Map();
const key = (x,y,z)=> x + ',' + y + ',' + z;
function getBlock(x,y,z){
  if(y<0 || y>=WORLD_H) return 0;
  if(x<0||z<0||x>=WORLD_W||z>=WORLD_D) return 0;
  return world.get(key(x,y,z)) || 0;
}
function setBlockRaw(x,y,z,id){ world.set(key(x,y,z), id); }
function isSolid(id){
  if(id===0) return false;
  const b = BLOCKS[id];
  return b ? b.solid !== false : true;
}
function groundTop(x, z){
  for(let y=WORLD_H-1; y>=0; y--) if(getBlock(x,y,z)!==0) return y;
  return 0;
}

/* ---------- Three.js 场景 ---------- */
const renderer = new THREE.WebGLRenderer({antialias:true});
const _coarse = (function(){ try{ return (navigator.maxTouchPoints||0) > 0; }catch(e){ return false; } })();
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

const blockMat = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide});
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
const tntMat = new THREE.MeshLambertMaterial({map:makeTntTexture(), side:THREE.DoubleSide});

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
  for(let x=x0; x<x0+CHUNK; x++){
    for(let z=z0; z<z0+CHUNK; z++){
      for(let y=0; y<WORLD_H; y++){
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
  setBlockRaw(x,y,z,id);
  const cx=Math.floor(x/CHUNK), cz=Math.floor(z/CHUNK);
  rebuildChunk(cx,cz);
  if(x % CHUNK === 0)      rebuildChunk(cx-1,cz);
  if(x % CHUNK === CHUNK-1) rebuildChunk(cx+1,cz);
  if(z % CHUNK === 0)      rebuildChunk(cx,cz-1);
  if(z % CHUNK === CHUNK-1) rebuildChunk(cx,cz+1);
}

/* 批量编辑:先记账,最后一次性重建受影响区块(爆炸用) */
const dirtyChunks = new Set();
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
function flushDirty(){
  for(const k of dirtyChunks){
    const [cx,cz] = k.split(',').map(Number);
    rebuildChunk(cx,cz);
  }
  dirtyChunks.clear();
}

/* 清空世界(切换模式/重置关卡用) */
function clearWorld(){
  world.clear();
  dirtyChunks.clear();
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

/* ---------- 体素射线 (Amanatides-Woo) ---------- */
function raycastVoxel(origin, dir, maxDist){
  let x=Math.floor(origin.x), y=Math.floor(origin.y), z=Math.floor(origin.z);
  const stepX = dir.x>0?1:(dir.x<0?-1:0);
  const stepY = dir.y>0?1:(dir.y<0?-1:0);
  const stepZ = dir.z>0?1:(dir.z<0?-1:0);
  const tDeltaX = stepX!==0 ? Math.abs(1/dir.x) : Infinity;
  const tDeltaY = stepY!==0 ? Math.abs(1/dir.y) : Infinity;
  const tDeltaZ = stepZ!==0 ? Math.abs(1/dir.z) : Infinity;
  let tMaxX = stepX>0 ? (Math.floor(origin.x)+1-origin.x)/dir.x
            : stepX<0 ? (origin.x-Math.floor(origin.x))/(-dir.x) : Infinity;
  let tMaxY = stepY>0 ? (Math.floor(origin.y)+1-origin.y)/dir.y
            : stepY<0 ? (origin.y-Math.floor(origin.y))/(-dir.y) : Infinity;
  let tMaxZ = stepZ>0 ? (Math.floor(origin.z)+1-origin.z)/dir.z
            : stepZ<0 ? (origin.z-Math.floor(origin.z))/(-dir.z) : Infinity;
  let normal=[0,0,0];
  let t = 0;
  while(t <= maxDist){
    if(getBlock(x,y,z)!==0){
      return { x,y,z, nx:normal[0], ny:normal[1], nz:normal[2] };
    }
    if(tMaxX < tMaxY){
      if(tMaxX < tMaxZ){ x+=stepX; t=tMaxX; tMaxX+=tDeltaX; normal=[-stepX,0,0]; }
      else            { z+=stepZ; t=tMaxZ; tMaxZ+=tDeltaZ; normal=[0,0,-stepZ]; }
    } else {
      if(tMaxY < tMaxZ){ y+=stepY; t=tMaxY; tMaxY+=tDeltaY; normal=[0,-stepY,0]; }
      else            { z+=stepZ; t=tMaxZ; tMaxZ+=tDeltaZ; normal=[0,0,-stepZ]; }
    }
  }
  return null;
}

/* ---------- 玩家 & 物理 ---------- */
const pos = new THREE.Vector3();
const vel = new THREE.Vector3();
let onGround = false;
let yaw = 0, pitch = 0;
let flyMode = false;                              // 建造模式:飞行(空格升 · Shift 降, 无重力)

function collides(px,py,pz){
  /* ε 收缩: 视"恰好贴面"为不重叠, 消除浮点擦边导致的穿墙/假落地 */
  const EPS = 1e-4;
  const minX=Math.floor(px-PLAYER.hx+EPS), maxX=Math.floor(px+PLAYER.hx-EPS);
  const minY=Math.floor(py+EPS),           maxY=Math.floor(py+PLAYER.height-EPS);
  const minZ=Math.floor(pz-PLAYER.hz+EPS), maxZ=Math.floor(pz+PLAYER.hz-EPS);
  for(let x=minX;x<=maxX;x++)
    for(let y=minY;y<=maxY;y++)
      for(let z=minZ;z<=maxZ;z++)
        if(isSolid(getBlock(x,y,z))) return true;
  return false;
}

function physics(dt){
  let mf=0, ms=0;
  if(keys['KeyW']) mf+=1;
  if(keys['KeyS']) mf-=1;
  if(keys['KeyD']) ms+=1;
  if(keys['KeyA']) ms-=1;
  mf += -touchMove.y;  ms += touchMove.x;               // 虚拟摇杆
  mf = Math.max(-1, Math.min(1, mf));
  ms = Math.max(-1, Math.min(1, ms));
  const sinY=Math.sin(yaw), cosY=Math.cos(yaw);
  let dx = (-sinY)*mf + (cosY)*ms;
  let dz = (-cosY)*mf + (-sinY)*ms;
  const len=Math.hypot(dx,dz);
  if(len>0){ dx/=len; dz/=len; }
  if(flyMode){                                    // 飞行: 恒速平移 + 垂直控制
    vel.x = dx*PLAYER.sprint; vel.z = dz*PLAYER.sprint;
    vel.y = 0;
    if(keys['Space']) vel.y = 7;
    if(keys['ShiftLeft']||keys['ShiftRight']) vel.y = -7;
    onGround = false;
  } else {
    const spd = (keys['ShiftLeft']||keys['ShiftRight']||touchSprint) ? PLAYER.sprint : PLAYER.speed;
    vel.x = dx*spd; vel.z = dz*spd;
    vel.y -= PLAYER.gravity*dt;
    if(vel.y < -30) vel.y = -30;              // 坠落限速: 防止高坠穿透薄楼板
    if((keys['Space']) && onGround){ vel.y = PLAYER.jump; onGround=false; }
    onGround = false;
  }
  /* 轴向子步进移动(每步≤0.25格): 防止斜向贴角/高速一步跨过碰撞判定穿墙
     返回 null=畅通走完; 否则返回受阻的子步目标坐标(供贴齐吸附) */
  const stepMove = (axis, d)=>{
    if(d === 0) return null;
    const n = Math.max(1, Math.ceil(Math.abs(d)/0.25));
    const s = d/n;
    for(let i=0;i<n;i++){
      const nx = axis===0 ? pos.x+s : pos.x;
      const ny = axis===1 ? pos.y+s : pos.y;
      const nz = axis===2 ? pos.z+s : pos.z;
      if(collides(nx,ny,nz)) return {nx,ny,nz};   // 本步受阻
      pos.x = nx; pos.y = ny; pos.z = nz;
    }
    return null;
  };
  const hitY = stepMove(1, vel.y*dt);
  if(hitY){
    if(vel.y < 0){ pos.y = Math.floor(hitY.ny+1e-4)+1; onGround = true; }
    else        { pos.y = Math.floor(hitY.ny+PLAYER.height-1e-4)-PLAYER.height; }
    vel.y = 0;
  }
  let dxStep = vel.x*dt;
  if(pos.x+dxStep < PLAYER.hx)         dxStep = PLAYER.hx-pos.x;          // 世界边缘隐形墙
  if(pos.x+dxStep > WORLD_W-PLAYER.hx) dxStep = WORLD_W-PLAYER.hx-pos.x;
  const hitX = stepMove(0, dxStep);
  if(hitX){
    if(vel.x > 0) pos.x = Math.floor(hitX.nx+PLAYER.hx-1e-4)-PLAYER.hx;
    else          pos.x = Math.floor(hitX.nx-PLAYER.hx+1e-4)+1+PLAYER.hx;
    vel.x = 0;
  }
  let dzStep = vel.z*dt;
  if(pos.z+dzStep < PLAYER.hz)         dzStep = PLAYER.hz-pos.z;
  if(pos.z+dzStep > WORLD_D-PLAYER.hz) dzStep = WORLD_D-PLAYER.hz-pos.z;
  const hitZ = stepMove(2, dzStep);
  if(hitZ){
    if(vel.z > 0) pos.z = Math.floor(hitZ.nz+PLAYER.hz-1e-4)-PLAYER.hz;
    else          pos.z = Math.floor(hitZ.nz-PLAYER.hz+1e-4)+1+PLAYER.hz;
    vel.z = 0;
  }
  /* 兜底: 极端挤压下若仍嵌入方块, 先向上再向四侧弹出 */
  if(collides(pos.x, pos.y, pos.z)){
    let free = false;
    for(let up=1; up<=8 && !free; up++){
      if(!collides(pos.x, pos.y+0.25*up, pos.z)){ pos.y += 0.25*up; vel.y = 0; free = true; }
    }
    if(!free){
      const nudge = [[0.3,0],[-0.3,0],[0,0.3],[0,-0.3]];
      for(const q of nudge){
        if(!collides(pos.x+q[0], pos.y, pos.z+q[1])){ pos.x += q[0]; pos.z += q[1]; free = true; break; }
      }
    }
  }
  if(pos.y < -12){                          // 掉出世界:交给当前模式处理
    if(typeof MODES !== 'undefined' && MODES.cur && MODES.cur.onVoidFall) MODES.cur.onVoidFall();
    else if(typeof spawnPlayer === 'function') spawnPlayer();
  }
}

function collidesAtPlayer(bx,by,bz){
  const minX=pos.x-PLAYER.hx, maxX=pos.x+PLAYER.hx;
  const minY=pos.y,           maxY=pos.y+PLAYER.height;
  const minZ=pos.z-PLAYER.hz, maxZ=pos.z+PLAYER.hz;
  return (bx+1>minX && bx<maxX && by+1>minY && by<maxY && bz+1>minZ && bz<maxZ);
}
