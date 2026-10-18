"use strict";
/* ============================================================
   坦克驾驶核心 (TankCore, 术语见 GLOSSARY.md) — 引擎层的纯核心
   ------------------------------------------------------------
   差速转向 · 惯性 · 履带爬台阶 · 大盒碰撞。零 THREE · 零 DOM ·
   不读键盘(输入由调用方映射为 input 数据传入) → Node 直测。
   依赖(均经全局名, 调用期解析): config.js 的 TANK/PLAYER,
   voxel.js 的 getBlock/isSolid/WORLD_W/WORLD_D。
   方向不变量: aimYaw 是唯一车头目标(鼠标/摇杆/A·D 皆写入它),
   车体 yaw 以 turnRate 平滑追踪 — 三个输入源互不打架。
   ============================================================ */
const TankCore = (()=>{

  /* 角差归一化到 (-PI, PI]: 车头追踪取最短旋转方向 */
  function wrapAngle(a){
    while(a >  Math.PI) a -= Math.PI*2;
    while(a <= -Math.PI) a += Math.PI*2;
    return a;
  }

  /* 坦克尺寸的盒碰撞(voxel.collides 是玩家尺寸写死的, 此处参数化) */
  const EPS = 1e-4;
  function boxCollides(px, py, pz){
    const minX = Math.floor(px - TANK.hw + EPS), maxX = Math.floor(px + TANK.hw - EPS);
    const minY = Math.floor(py + EPS),            maxY = Math.floor(py + TANK.height - EPS);
    const minZ = Math.floor(pz - TANK.hw + EPS),  maxZ = Math.floor(pz + TANK.hw - EPS);
    for(let x=minX; x<=maxX; x++)
      for(let y=minY; y<=maxY; y++)
        for(let z=minZ; z<=maxZ; z++)
          if(isSolid(getBlock(x, y, z))) return true;
    return false;
  }

  /* 载具状态: x/y/z 舱位 · yaw 车体朝向 · aimYaw 车头目标(方向权威) ·
     vel 前向标量速度(负=倒车) · vy 垂直速度 · onGround 触地 ·
     cool 装填冷却(>0 不能开炮, step 递减) */
  function mkT(x, y, z, yaw){
    return { x, y, z, yaw, aimYaw: yaw, vel: 0, vy: 0, onGround: false, cool: 0 };
  }

  function step(T, input, dt){
    /* --- 装填冷却 --- */
    if(T.cool > 0) T.cool = Math.max(0, T.cool - dt);

    /* --- 方向权威: 鼠标/摇杆(lookYaw 非空即采纳) > A·D(以转向速率积分) --- */
    if(input.lookYaw !== null && input.lookYaw !== undefined) T.aimYaw = input.lookYaw;
    else if(input.steer) T.aimYaw += input.steer * TANK.turnRate * dt;

    /* 车体以 turnRate 追踪 aimYaw(取最短方向) */
    const d = wrapAngle(T.aimYaw - T.yaw);
    T.yaw += Math.max(-TANK.turnRate*dt, Math.min(TANK.turnRate*dt, d));

    /* --- 纵向: 指数逼近目标速度 — 加速与滑行摩擦同一式, dt 稳健 --- */
    const target = input.forward > 0 ? TANK.speed
                 : input.forward < 0 ? -TANK.reverse
                 : 0;
    const rate = input.forward !== 0 ? TANK.accel : TANK.friction;
    T.vel += (target - T.vel) * Math.min(1, rate*dt);

    /* --- 垂直: 重力 + 落地(贴齐方块顶面, 同 physics 惯例) --- */
    T.vy -= PLAYER.gravity*dt;
    if(T.vy < -30) T.vy = -30;
    T.onGround = false;
    const ny = T.y + T.vy*dt;
    if(boxCollides(T.x, ny, T.z)){
      if(T.vy < 0){ T.y = Math.floor(ny + 1e-4) + 1; T.onGround = true; }
      else        { T.y = Math.floor(ny + TANK.height - 1e-4) - TANK.height; }
      T.vy = 0;
    } else T.y = ny;

    /* --- 水平: 轴向子步进(每步≤0.25格, 同 physics 惯例)+ 履带爬台阶 --- */
    const tryAxis = (axis, d)=>{
      if(d === 0) return;
      const n = Math.max(1, Math.ceil(Math.abs(d)/0.25));
      const s = d/n;
      for(let i=0; i<n; i++){
        const nx = axis===0 ? T.x+s : T.x;
        const nz = axis===2 ? T.z+s : T.z;
        if(!boxCollides(nx, T.y, nz)){ T.x = nx; T.z = nz; continue; }
        /* 履带爬台阶: 前方受阻且抬升一格后净空 → 爬上(仅触地时) */
        if(T.onGround && !boxCollides(nx, T.y+1, nz)){
          T.y += 1;
          T.x = nx; T.z = nz;
          continue;
        }
        T.vel = 0;                                  /* 撞墙刹停(爬不上去) */
        return;
      }
    };
    let dx = -Math.sin(T.yaw)*T.vel*dt;
    let dz = -Math.cos(T.yaw)*T.vel*dt;
    /* 世界边缘隐形墙(同 physics 惯例) */
    if(T.x + dx < TANK.hw)           dx = TANK.hw - T.x;
    if(T.x + dx > WORLD_W - TANK.hw) dx = WORLD_W - TANK.hw - T.x;
    if(T.z + dz < TANK.hw)           dz = TANK.hw - T.z;
    if(T.z + dz > WORLD_D - TANK.hw) dz = WORLD_D - TANK.hw - T.z;
    tryAxis(0, dx);
    tryAxis(2, dz);

    /* 挤压兜底: 极端嵌入时先向上再向四侧弹出(同 physics 惯例) */
    if(boxCollides(T.x, T.y, T.z)){
      let free = false;
      for(let up=1; up<=8 && !free; up++){
        if(!boxCollides(T.x, T.y + 0.25*up, T.z)){ T.y += 0.25*up; T.vy = 0; free = true; }
      }
      if(!free){
        const nudge = [[0.3,0],[-0.3,0],[0,0.3],[0,-0.3]];
        for(const q of nudge){
          if(!boxCollides(T.x+q[0], T.y, T.z+q[1])){ T.x += q[0]; T.z += q[1]; free = true; break; }
        }
      }
    }

    return T;
  }

  /* 最近车距门控: 返回半径内最近的车状态, 无则 null —
     提示(promptR)与上车(enterR)共用同一条规则, 走远自动消失 */
  function nearest(list, x, z, maxR){
    let best = null, bestD = Infinity;
    for(const T of list){
      const d = Math.hypot(T.x - x, T.z - z);
      if(d < bestD){ bestD = d; best = T; }
    }
    return (best !== null && bestD <= maxR) ? best : null;
  }

  /* ---------- 炮弹: 平直弹道 + 轻重力 + 体素命中 ----------
     shellStep 每帧推进: 命中实心方块记 S.hit 并终止(dead);
     life 耗尽或坠出世界自毁。爆炸由调用方在命中点接手。 */
  function mkShell(x, y, z, vx, vy, vz){
    return { x, y, z, vx, vy, vz, life: TANK.shellLife, dead: false, hit: null };
  }
  const _sd = { x:0, y:0, z:0 };
  function shellStep(S, dt){
    S.life -= dt;
    S.vy -= TANK.shellG*dt;
    const nx = S.x + S.vx*dt, ny = S.y + S.vy*dt, nz = S.z + S.vz*dt;
    const dist = Math.hypot(nx - S.x, ny - S.y, nz - S.z);
    if(dist > 1e-9){
      _sd.x = (nx - S.x)/dist; _sd.y = (ny - S.y)/dist; _sd.z = (nz - S.z)/dist;
      const hit = raycastVoxel(S, _sd, dist, isSolid);
      if(hit){
        S.x = S.x + _sd.x*hit.t; S.y = S.y + _sd.y*hit.t; S.z = S.z + _sd.z*hit.t;
        S.hit = { x: hit.x, y: hit.y, z: hit.z };
        S.dead = true;
        return S;
      }
    }
    S.x = nx; S.y = ny; S.z = nz;
    if(S.life <= 0 || S.y < -4 ||
       S.x < 0 || S.z < 0 || S.x > WORLD_W || S.z > WORLD_D) S.dead = true;
    return S;
  }

  /* ---------- 爆炸: 球形破坏随距离衰减(确定性哈希), 按方块 id 分桶计数 ----------
     edit 为注入的写入口: Node 单测传 setBlockRaw(或 spy),
     浏览器侧传 world.js 的 editBlockDirty(记账+markDirty), 事后 flushDirty。
     keep(id,bx,by,bz) 可选保护谓词: 命中即分毫不动、不计入破坏数 —
     "什么不可炸"是模式政策(如演习场草海永固), 判定归调用方。
     返回 counts 按被毁方块 id 分桶 — "什么算靶"同理, 判定归模式层。 */
  function explode(x, y, z, edit, keep){
    const set = edit || setBlockRaw;
    const r = TANK.shellR;
    let removed = 0;
    const counts = {};
    const R = Math.ceil(r);
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    for(let dx=-R; dx<=R; dx++)
      for(let dy=-R; dy<=R; dy++)
        for(let dz=-R; dz<=R; dz++){
          const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if(d > r) continue;
          const bx = cx+dx, by = cy+dy, bz = cz+dz;
          const id = getBlock(bx, by, bz);
          if(id === 0) continue;
          if(keep && keep(id, bx, by, bz)) continue;          /* 受保护: 不炸不计数 */
          /* 爆心必毁, 边缘按确定性哈希渐稀(与 TNT 密室的破坏思路同构) */
          if(d > 0.5 && hashRand(bx*3 + dy + 7, bz*5 - dz + 11) > 1 - (d/r)*0.55) continue;
          counts[id] = (counts[id] || 0) + 1;
          set(bx, by, bz, 0);
          removed++;
        }
    return { removed, counts };
  }

  return { mkT, step, boxCollides, wrapAngle, nearest, mkShell, shellStep, explode };
})();
if(typeof module !== 'undefined' && module.exports) module.exports = TankCore;
