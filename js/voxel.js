'use strict';
/* ============================================================
   体素模型 (VoxelModel, 术语见 GLOSSARY.md) — 引擎层的纯核心
   ------------------------------------------------------------
   方块世界的数据与规则: 存取 / 光场存储 / 碰撞 / 物理 / 射线。
   零 THREE · 零 DOM · 加载零副作用 → Node 可直接加载单测。
   渲染(场景/网格/贴图)是它之上的 adapter, 见 world.js。
   依赖(均经全局名, 调用期解析): config.js 的 BLOCKS·PLAYER·WORLD_*·FLUID(流体物理参数),
   input.js 的 keys/touchMove/touchSprint(仅 physics 读取)。
   ============================================================ */

/* ---------- 哈希 ---------- */
function hashRand(x, z) {
  let n = (x*374761393 + z*668265263) >>> 0;
  n = (n ^ (n >> 13)) >>> 0;
  n = (n * 1274126177) >>> 0;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

/* ---------- 世界数据 ----------
   平面 Uint8Array: getBlock 是全游戏最热的路径(物理/射线/网格重建/怪物
   落地扫描), 演进史: 字符串键 Map(GC 掉帧) → 整数键 Map → 平面数组
   (下标直读, 零分配零哈希; pad 真机爆炸重建实测是最大尖峰来源)。
   160×160×48 ≈ 1.2MB 一次分配(2026-10-27 探险扩容 8→10 区块); 方块 id ≤ 255,
   Uint8 足够。
   blockKey(字符串) 保留为存档/转辙器等外部格式专用, 与内部布局无关。 */
const topCache = new Map(); // 按列高度缓存 (x,z)→顶层 y
const worldCells = new Uint8Array(WORLD_W * WORLD_D * WORLD_H);
/* 双通道光场(D2, docs/mc-daylight-torch-design.md §3.3): sky=天空光(列顶
   直灌 15 · 横向 BFS), block=方块光(光源 BFS 曼哈顿)。算法在
   js/light-core.js(纯核心), 这里只是存储面。与 worldCells 同址编号
   cellIdx, 装场 loadScene 全量算一次写入(编辑期增量属 D4)。越界 getter
   口径: sky 返 15(界外=天光全亮, 与 getBlock 越界空气口径一致), block
   返 0(界外无光) — 消费方(网格化取邻格/刷怪判定)免再判界 */
const lightSky = new Uint8Array(WORLD_W * WORLD_D * WORLD_H);
const lightBlock = new Uint8Array(WORLD_W * WORLD_D * WORLD_H);
function lightSkyAt(x, y, z) {
  if (x<0||y<0||z<0||x>=WORLD_W||y>=WORLD_H||z>=WORLD_D) return 15;
  return lightSky[(y*WORLD_D + z)*WORLD_W + x];
}
function lightBlockAt(x, y, z) {
  if (x<0||y<0||z<0||x>=WORLD_W||y>=WORLD_H||z>=WORLD_D) return 0;
  return lightBlock[(y*WORLD_D + z)*WORLD_W + x];
}
/* 并行水位面(ADR 0004, 设计稿 liquid D2): 与 worldCells 同布局同下标, 只在
   流体格上有意义——0=源 · 1~7 流动(8-lv=水量) · 8=下落柱; 非流体格恒 0
   (写纪律: setFluidLv 原样写, 编辑入口负责清; world-integrity 扫描守卫) */
const fluidLv = new Uint8Array(WORLD_W * WORLD_D * WORLD_H);
const world = { // 门面: 只留 clear(直清数据必须连带
  clear() {
    worldCells.fill(0); topCache.clear();
    lightSky.fill(0); lightBlock.fill(0); // 光场是方块场派生面, 清场一并归零
    fluidLv.fill(0); // 水位面同理(液体是方块场伴生面)
  }, // 失效高度缓存; world.js 清场 与 单测共用此入口)
};
const blockKey = (x, y, z)=> x + ',' + y + ',' + z;
const cellIdx = (x, y, z)=> (y*WORLD_D + z)*WORLD_W + x;
function getBlock(x, y, z) {
  if (y<0 || y>=WORLD_H) return 0;
  if (x<0||z<0||x>=WORLD_W||z>=WORLD_D) return 0;
  return worldCells[(y*WORLD_D + z)*WORLD_W + x];
}
function setBlockRaw(x, y, z, id) {
  worldCells[(y*WORLD_D + z)*WORLD_W + x] = id;
  topCache.delete(x*WORLD_D + z); // 本列高度缓存失效, 读时惰性重算
}
function getFluidLv(x, y, z) {
  if (y<0 || y>=WORLD_H) return 0;
  if (x<0||z<0||x>=WORLD_W||z>=WORLD_D) return 0;
  return fluidLv[(y*WORLD_D + z)*WORLD_W + x];
}
function setFluidLv(x, y, z, lv) {
  if (y<0 || y>=WORLD_H) return;
  if (x<0||z<0||x>=WORLD_W||z>=WORLD_D) return;
  fluidLv[(y*WORLD_D + z)*WORLD_W + x] = lv;
}
/* 液体身份查询(主循环雾色/D9 物理采样共用): 返回 'water'|'lava'|null */
function fluidAt(x, y, z) {
  const b = BLOCKS[getBlock(Math.floor(x), Math.floor(y), Math.floor(z))];
  return (b && b.fluid) || null;
}
function isSolid(id) {
  if (id===0) return false;
  const b = BLOCKS[id];
  return b ? b.solid !== false : true;
}
/* 不透明判定: 相机防穿墙用 — 实心且非玻璃(隔着玻璃透视不收拢相机) */
function isOpaque(id) {
  if (id===0) return false;
  const b = BLOCKS[id];
  return b ? (b.solid !== false && !b.glass) : true;
}
/* 按列高度记忆化: 原自上而下全高扫描(至多 WORLD_H 次 getBlock), 千怪×
   每帧多次落地查询是热点; setBlockRaw 已失效所在列, 这里读时重算一次 */
function groundTop(x, z) {
  if (x<0||z<0||x>=WORLD_W||z>=WORLD_D) return 0;
  const ck = x*WORLD_D + z;
  if (topCache.has(ck)) return topCache.get(ck);
  let y = WORLD_H-1;
  for (; y>=0; y--) if (getBlock(x, y, z)!==0) break;
  const top = y >= 0 ? y : 0; // 空列按 0(与原语义一致)
  topCache.set(ck, top);
  return top;
}

/* ---------- 区块数据打包 (体素模型 → 网格化核心 的数据边界) ----------
   pack = { cells, sky, block, w, d, h, border, bx, bz, yMax }:
   cells 布局 (y*d+lz)*w+lx (y 行优先), border=1 时含邻块边界一圈供跨
   区块剔面(界外恒 0, 与 getBlock 越界语义一致)。sky/block 光照圈与
   cells 同形状同布局(界外圈 sky 15 / block 0, 与 lightSkyAt/lightBlockAt
   越界口径一致 — Worker 侧取光免判界)。bx/bz 是 pack 原点的
   世界坐标 — 网格化核心据此生成世界坐标顶点。yMax 只统计内部列
   (行走上界; 边界圈高于它的块只影响 y≤yMax 的剔面, 与原实现一致)。
   这是主线程兜底路径与 Worker 消息(transferable)共用的打包格式 —
   布局即跨线程契约。 */
function packChunkData(cx, cz, border) {
  const w = CHUNK + 2*border; const d = CHUNK + 2*border;
  const cells = new Uint8Array(w*d*WORLD_H);
  const sky = new Uint8Array(w*d*WORLD_H); sky.fill(15); // 缺省=界外天光全亮
  const block = new Uint8Array(w*d*WORLD_H); // 缺省 0(界外无方块光)
  const levels = new Uint8Array(w*d*WORLD_H); // 水位通道(液体渲染高度): 与 cells 同布局, 跨线程契约
  const bx = cx*CHUNK - border; const bz = cz*CHUNK - border;
  for (let lx=0; lx<w; lx++) {
    for (let lz=0; lz<d; lz++) {
      const x = bx+lx; const z = bz+lz;
      if (x<0||z<0||x>=WORLD_W||z>=WORLD_D) continue; // 界外列: cells/block 0 · sky 15
      const base = lz*w + lx; // 逐列竖扫, 列内步进 w
      for (let y=0; y<WORLD_H; y++) {
        const idx = (y*WORLD_D + z)*WORLD_W + x;
        const id = worldCells[idx];
        if (id !== 0) {
          cells[y*d*w + base] = id;
          if (fluidLv[idx] !== 0) levels[y*d*w + base] = fluidLv[idx];
        }
        sky[y*d*w + base] = lightSky[idx];
        block[y*d*w + base] = lightBlock[idx];
      }
    }
  }
  let yMax = 0;
  for (let x=cx*CHUNK; x<cx*CHUNK+CHUNK; x++) {
    for (let z=cz*CHUNK; z<cz*CHUNK+CHUNK; z++) {
      const t = groundTop(x, z);
      if (t > yMax) yMax = t;
    }
  }
  return {cells, sky, block, levels, w, d, h: WORLD_H, border, bx, bz, yMax};
}

/* ---------- 体素射线 (Amanatides-Woo) ----------
   filter: 可选命中判定 (id)=>bool, 默认任何非空气;
   相机防穿墙传 isSolid — 滤过水面/引线等非实心方块。
   返回值 t: 从 origin 到进入命中格的距离(0=origin 起步就在格内) */
function raycastVoxel(origin, dir, maxDist, filter) {
  const hitFn = filter || ((id) => id !== 0);
  let x=Math.floor(origin.x); let y=Math.floor(origin.y); let z=Math.floor(origin.z);
  const stepX = dir.x>0?1:(dir.x<0?-1:0);
  const stepY = dir.y>0?1:(dir.y<0?-1:0);
  const stepZ = dir.z>0?1:(dir.z<0?-1:0);
  const tDeltaX = stepX!==0 ? Math.abs(1/dir.x) : Infinity;
  const tDeltaY = stepY!==0 ? Math.abs(1/dir.y) : Infinity;
  const tDeltaZ = stepZ!==0 ? Math.abs(1/dir.z) : Infinity;
  let tMaxX = stepX>0 ? (Math.floor(origin.x)+1-origin.x)/dir.x :
            stepX<0 ? (origin.x-Math.floor(origin.x))/(-dir.x) : Infinity;
  let tMaxY = stepY>0 ? (Math.floor(origin.y)+1-origin.y)/dir.y :
            stepY<0 ? (origin.y-Math.floor(origin.y))/(-dir.y) : Infinity;
  let tMaxZ = stepZ>0 ? (Math.floor(origin.z)+1-origin.z)/dir.z :
            stepZ<0 ? (origin.z-Math.floor(origin.z))/(-dir.z) : Infinity;
  let nx=0; let ny=0; let nz=0; // 命中面法线(标量, 免逐格分配数组 — 主循环热路径)
  let t = 0;
  while (t <= maxDist) {
    if (hitFn(getBlock(x, y, z))) {
      return {x, y, z, nx, ny, nz, t};
    }
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x+=stepX; t=tMaxX; tMaxX+=tDeltaX; nx=-stepX; ny=0; nz=0;
      } else {
        z+=stepZ; t=tMaxZ; tMaxZ+=tDeltaZ; nx=0; ny=0; nz=-stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        y+=stepY; t=tMaxY; tMaxY+=tDeltaY; nx=0; ny=-stepY; nz=0;
      } else {
        z+=stepZ; t=tMaxZ; tMaxZ+=tDeltaZ; nx=0; ny=0; nz=-stepZ;
      }
    }
  }
  return null;
}

/* ---------- 玩家 & 物理 ----------
   pos/vel 为带 set() 的普通对象(仅 .set 被调用), 保持零 THREE;
   raycastVoxel 只读 .x/.y/.z, 与 THREE.Vector3 鸭子类型兼容
   玩家六绑定(pos/vel/onGround/yaw/pitch/flyMode)可写白名单(对齐 mobs.js
   判例: 逐类给理由, 白名单之外零裸写):
   · physics           本模块自身 — 每帧物理结算的唯一写者
   · input.js          鼠标/触屏热路径直写 yaw/pitch — 视角唯一属主 +
     事件频率高于帧率, 性能口径例外(登记不改)
   · math-world.js     自持 rAF 直写 pos/vel/pitch/onGround — 根因: 主循环
     以指针锁为门跑 physics, 不锁指针宿主只能自持驱动(该文件头已自白;
     治理归引擎「非锁定宿主驱动入口」的未来票)
   · tank.js           引擎同侪直写(驾驶锁舱姿态/上下车视角对齐, 引擎层内部)
   其余写者一律走意图入口: 传送/出生 → ModeKit.spawn(mode-kit.js),
   飞行态 → setFly(下方); 模式文件与组合根(main.js)零裸写。 */
const pos = {x: 0, y: 0, z: 0, set(x, y, z) {
  this.x=x; this.y=y; this.z=z; return this;
}};
const vel = {x: 0, y: 0, z: 0, set(x, y, z) {
  this.x=x; this.y=y; this.z=z; return this;
}};
let onGround = false;
let yaw = 0; let pitch = 0;
let flyMode = false; // 建造模式:飞行(空格升 · Shift 降, 无重力)
/* 流体玩家态(liquid 设计稿 D9): 溺力气泡余秒(头出水即刻回满, HUD 气泡条读它)
   与接触计息器——模式层只读 playerAirS/消费 worldEvents 事件, 不直写 */
let playerAirS = 15; // 满值在 physics 首帧经 FLUID.airMaxS 校准(config 加载序在前)
let drownAcc = 0; let lavaAcc = 0; let prevBodyFluid = null;
/* 飞行态意图入口: 模式/组合根切换飞行一律经此, 禁止裸写 flyMode(白名单
   见本段头注释)。语义: 切换时清垂直速度 — 关飞行瞬间不被残留升/坠速
   拖着走(照 build.js F 键开关的既有语义), 复位场景 vel.y 本就近 0,
   清之无害。只原地改 vel.y 字段: vel 是共享对象(combat-kit 的 mkFighter
   把 pos/vel 可变引用别名进战斗实体), 不得替换绑定 */
function setFly(v) {
  flyMode = v;
  vel.y = 0;
}

function collides(px, py, pz) {
  /* ε 收缩: 视"恰好贴面"为不重叠, 消除浮点擦边导致的穿墙/假落地 */
  const EPS = 1e-4;
  const minX=Math.floor(px-PLAYER.hx+EPS); const maxX=Math.floor(px+PLAYER.hx-EPS);
  const minY=Math.floor(py+EPS); const maxY=Math.floor(py+PLAYER.height-EPS);
  const minZ=Math.floor(pz-PLAYER.hz+EPS); const maxZ=Math.floor(pz+PLAYER.hz-EPS);
  for (let x=minX; x<=maxX; x++) {
    for (let y=minY; y<=maxY; y++) {
      for (let z=minZ; z<=maxZ; z++) {
        if (isSolid(getBlock(x, y, z))) return true;
      }
    }
  }
  return false;
}

function physics(dt) {
  let mf=0; let ms=0;
  if (keys['KeyW']) mf+=1;
  if (keys['KeyS']) mf-=1;
  if (keys['KeyD']) ms+=1;
  if (keys['KeyA']) ms-=1;
  mf += -touchMove.y; ms += touchMove.x; // 虚拟摇杆
  mf = Math.max(-1, Math.min(1, mf));
  ms = Math.max(-1, Math.min(1, ms));
  const wasGround = onGround; // 帧首贴地快照: 自动跳的判定基准(下方 Y 结算会改写 onGround)
  const sinY=Math.sin(yaw); const cosY=Math.cos(yaw);
  let dx = (-sinY)*mf + (cosY)*ms;
  let dz = (-cosY)*mf + (-sinY)*ms;
  const len=Math.hypot(dx, dz);
  if (len>0) {
    dx/=len; dz/=len;
  }
  if (flyMode) { // 飞行: 恒速平移 + 垂直控制(流体不生效——MC 创造飞行同口径)
    vel.x = dx*PLAYER.sprint; vel.z = dz*PLAYER.sprint;
    vel.y = 0;
    if (keys['Space']) vel.y = PLAYER.flyVert;
    if (keys['ShiftLeft']||keys['ShiftRight']) vel.y = -PLAYER.flyVert;
    onGround = false;
    prevBodyFluid = null; // 出入水状态不跨飞行态
  } else {
    /* 流体采样(liquid D9): 身体=脚上 0.5 格 · 头=眼点; 浅水豁免=脚在水 ·
       上一格净空(水深 ≤1) · 贴地 → 按蹚水走(近常速可正常跳), 不进游泳物理 */
    const bodyF = fluidAt(pos.x, pos.y + 0.5, pos.z);
    const headF = fluidAt(pos.x, pos.y + PLAYER.eye, pos.z);
    const feetF = fluidAt(pos.x, pos.y + 0.05, pos.z);
    const wade = feetF && onGround && !fluidAt(pos.x, pos.y + 1.2, pos.z);
    const swim = bodyF && !wade;
    const spd0 = (keys['ShiftLeft']||keys['ShiftRight']||touchSprint) ? PLAYER.sprint : PLAYER.speed;
    const spd = swim ? spd0 * (bodyF === 'lava' ? FLUID.lavaMult : FLUID.swimMult) :
      (feetF ? spd0 * 0.75 : spd0);
    vel.x = dx*spd; vel.z = dz*spd;
    if (swim && bodyF === 'water') {
      vel.y -= PLAYER.gravity * FLUID.gravMul * dt;
      if (vel.y < -FLUID.sinkSpeed) vel.y = -FLUID.sinkSpeed; // 缓沉; 坠落截断=入水免摔伤
      if (keys['Space']) vel.y = headF === 'water' ? FLUID.swimUp : PLAYER.jump * 0.62; // 上浮/水面跃出
    } else if (swim && bodyF === 'lava') {
      vel.y -= PLAYER.gravity * 0.35 * dt;
      vel.y *= FLUID.lavaVert; // 垂直阻尼(MC 每刻 -20% 口径的帧化)
      if (vel.y < -FLUID.lavaSink) vel.y = -FLUID.lavaSink;
      if (keys['Space']) vel.y = FLUID.lavaRise; // 岩浆中弱上浮(稠)
    } else {
      vel.y -= PLAYER.gravity*dt;
      if (vel.y < PLAYER.fallCap) vel.y = PLAYER.fallCap; // 坠落限速: 防止高坠穿透薄楼板
      if ((keys['Space']) && onGround) {
        vel.y = PLAYER.jump; onGround=false;
      }
    }
    /* 水流推力(liquid D9): 身处流动水(1-7 级, 源/下落柱无横向流)按水位梯度
       被推向下游——向量合成四邻水位差, pushSpeed 封顶(MC 1.39 格/秒) */
    if (bodyF === 'water') {
      const bx = Math.floor(pos.x); const by = Math.floor(pos.y + 0.5); const bz = Math.floor(pos.z);
      const lv = getFluidLv(bx, by, bz);
      if (lv >= 1 && lv <= 7) {
        const myAmt = 8 - lv;
        let px = 0; let pz = 0;
        const dirs4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const d of dirs4) {
          const nb = BLOCKS[getBlock(bx + d[0], by, bz + d[1])];
          if (nb && nb.fluid === 'water') {
            const g = myAmt - (8 - getFluidLv(bx + d[0], by, bz + d[1]));
            px += g * d[0]; pz += g * d[1];
          }
        }
        const pl = Math.hypot(px, pz);
        if (pl > 0.01) {
          vel.x += px / pl * FLUID.pushSpeed; vel.z += pz / pl * FLUID.pushSpeed;
        }
      }
    }
    onGround = false;
    /* 溺气(head 口径, 15s 耗尽后每秒发 drownTick——HP 结算在模式层) ·
       岩浆接触(每 0.5s 发 lavaTick) · 高速入水水花事件(sfx 在主循环分发) */
    if (headF === 'water') {
      playerAirS = Math.max(0, playerAirS - dt);
      if (playerAirS <= 0) {
        drownAcc += dt;
        if (drownAcc >= 1) {
          drownAcc -= 1; worldEvents.drownTick = true;
        }
      }
    } else {
      playerAirS = FLUID.airMaxS; drownAcc = 0; // 头出水即刻回满(MC 口径)
    }
    if (bodyF === 'lava') {
      lavaAcc += dt;
      if (lavaAcc >= FLUID.lavaTickS) {
        lavaAcc -= FLUID.lavaTickS; worldEvents.lavaTick = true;
      }
    } else lavaAcc = 0;
    if (bodyF && bodyF !== prevBodyFluid && vel.y < -4) worldEvents.splash = true;
    prevBodyFluid = bodyF;
  }
  /* 轴向子步进移动(每步≤PLAYER.substep 格): 防止斜向贴角/高速一步跨过碰撞判定穿墙
     返回 null=畅通走完; 否则返回受阻的子步目标坐标(供贴齐吸附) */
  const stepMove = (axis, d)=>{
    if (d === 0) return null;
    const n = Math.max(1, Math.ceil(Math.abs(d)/PLAYER.substep));
    const s = d/n;
    for (let i=0; i<n; i++) {
      const nx = axis===0 ? pos.x+s : pos.x;
      const ny = axis===1 ? pos.y+s : pos.y;
      const nz = axis===2 ? pos.z+s : pos.z;
      if (collides(nx, ny, nz)) return {nx, ny, nz}; // 本步受阻
      pos.x = nx; pos.y = ny; pos.z = nz;
    }
    return null;
  };
  const hitY = stepMove(1, vel.y*dt);
  if (hitY) {
    if (vel.y < 0) {
      pos.y = Math.floor(hitY.ny+1e-4)+1; onGround = true;
    } else {
      pos.y = Math.floor(hitY.ny+PLAYER.height-1e-4)-PLAYER.height;
    }
    vel.y = 0;
  }
  let dxStep = vel.x*dt;
  if (pos.x+dxStep < PLAYER.hx) dxStep = PLAYER.hx-pos.x; // 世界边缘隐形墙
  if (pos.x+dxStep > WORLD_W-PLAYER.hx) dxStep = WORLD_W-PLAYER.hx-pos.x;
  const hitX = stepMove(0, dxStep);
  if (hitX) {
    if (vel.x > 0) pos.x = Math.floor(hitX.nx+PLAYER.hx-1e-4)-PLAYER.hx;
    else pos.x = Math.floor(hitX.nx-PLAYER.hx+1e-4)+1+PLAYER.hx;
    vel.x = 0;
  }
  let dzStep = vel.z*dt;
  if (pos.z+dzStep < PLAYER.hz) dzStep = PLAYER.hz-pos.z;
  if (pos.z+dzStep > WORLD_D-PLAYER.hz) dzStep = WORLD_D-PLAYER.hz-pos.z;
  const hitZ = stepMove(2, dzStep);
  if (hitZ) {
    if (vel.z > 0) pos.z = Math.floor(hitZ.nz+PLAYER.hz-1e-4)-PLAYER.hz;
    else pos.z = Math.floor(hitZ.nz-PLAYER.hz+1e-4)+1+PLAYER.hz;
    vel.z = 0;
  }
  /* 自动跳(MC 基岩版触屏默认): 贴地行走被水平面挡住 + 台阶上方有净空
     (目标确是 1 格台阶而非高墙/屋檐) → 自动起跳攀上去; 跳跃键仍可用,
     越沟/躲怪的手动跳不受影响。仅走路物理(飞行分支无重力, 不参与)。
     净空探测点=沿移动方向前探 0.45 格(身体贴墙不重叠, 原位查不到墙) */
  if (PLAYER.autoJump && !flyMode && wasGround && (hitX || hitZ) && len>0 && vel.y<=0.01 &&
      !collides(pos.x + dx/len*0.45, pos.y+1.05, pos.z + dz/len*0.45)) {
    vel.y = PLAYER.jump;
  }
  /* 兜底: 极端挤压下若仍嵌入方块, 先向上再向四侧弹出 */
  if (collides(pos.x, pos.y, pos.z)) {
    let free = false;
    for (let up=1; up<=8 && !free; up++) {
      if (!collides(pos.x, pos.y+0.25*up, pos.z)) {
        pos.y += 0.25*up; vel.y = 0; free = true;
      }
    }
    if (!free) {
      const nudge = [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]];
      for (const q of nudge) {
        if (!collides(pos.x+q[0], pos.y, pos.z+q[1])) {
          pos.x += q[0]; pos.z += q[1]; free = true; break;
        }
      }
    }
  }
  if (pos.y < PLAYER.voidY) worldEvents.voidFall = true; // 掉出世界: 引擎只报事件, 处理由应用层分发(main loop)
}
const worldEvents = {voidFall: false, drownTick: false, lavaTick: false, splash: false};
// 引擎→应用 的单向事件通道(分层规则见 GLOSSARY.md): voidFall 坠出世界 ·
// drownTick/lavaTick 溺水与岩浆接触的计息到点(HP 结算在模式层, liquid D9) ·
// splash 高速入水(音效分发在主循环); 消费方读完置回 false

function collidesAtPlayer(bx, by, bz) {
  const minX=pos.x-PLAYER.hx; const maxX=pos.x+PLAYER.hx;
  const minY=pos.y; const maxY=pos.y+PLAYER.height;
  const minZ=pos.z-PLAYER.hz; const maxZ=pos.z+PLAYER.hz;
  return (bx+1>minX && bx<maxX && by+1>minY && by<maxY && bz+1>minZ && bz<maxZ);
}
