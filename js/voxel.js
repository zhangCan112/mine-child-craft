"use strict";
/* ============================================================
   体素模型 (VoxelModel, 术语见 GLOSSARY.md) — 引擎层的纯核心
   ------------------------------------------------------------
   方块世界的数据与规则: 存取 / 碰撞 / 物理 / 射线。
   零 THREE · 零 DOM · 加载零副作用 → Node 可直接加载单测。
   渲染(场景/网格/贴图)是它之上的 adapter, 见 world.js。
   依赖(均经全局名, 调用期解析): config.js 的 BLOCKS/PLAYER/WORLD_*,
   input.js 的 keys/touchMove/touchSprint(仅 physics 读取)。
   ============================================================ */

/* ---------- 哈希 ---------- */
function hashRand(x,z){
  let n = (x*374761393 + z*668265263) >>> 0;
  n = (n ^ (n >> 13)) >>> 0;
  n = (n * 1274126177) >>> 0;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

/* ---------- 世界数据 ---------- */
const world = new Map();
const blockKey = (x,y,z)=> x + ',' + y + ',' + z;
function getBlock(x,y,z){
  if(y<0 || y>=WORLD_H) return 0;
  if(x<0||z<0||x>=WORLD_W||z>=WORLD_D) return 0;
  return world.get(blockKey(x,y,z)) || 0;
}
function setBlockRaw(x,y,z,id){ world.set(blockKey(x,y,z), id); }
function isSolid(id){
  if(id===0) return false;
  const b = BLOCKS[id];
  return b ? b.solid !== false : true;
}
function groundTop(x, z){
  for(let y=WORLD_H-1; y>=0; y--) if(getBlock(x,y,z)!==0) return y;
  return 0;
}

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

/* ---------- 玩家 & 物理 ----------
   pos/vel 为带 set() 的普通对象(仅 .set 被调用), 保持零 THREE;
   raycastVoxel 只读 .x/.y/.z, 与 THREE.Vector3 鸭子类型兼容 */
const pos = { x:0, y:0, z:0, set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; } };
const vel = { x:0, y:0, z:0, set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; } };
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
  if(pos.y < -12) worldEvents.voidFall = true;   // 掉出世界: 引擎只报事件, 处理由应用层分发(main loop)
}
const worldEvents = { voidFall: false };         // 引擎→应用 的单向事件通道(分层规则见 GLOSSARY.md)

function collidesAtPlayer(bx,by,bz){
  const minX=pos.x-PLAYER.hx, maxX=pos.x+PLAYER.hx;
  const minY=pos.y,           maxY=pos.y+PLAYER.height;
  const minZ=pos.z-PLAYER.hz, maxZ=pos.z+PLAYER.hz;
  return (bx+1>minX && bx<maxX && by+1>minY && by<maxY && bz+1>minZ && bz<maxZ);
}
