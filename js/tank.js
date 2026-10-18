"use strict";
/* ============================================================
   载具 (Tank, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   可驾驶实体的建模与状态机: 上车/下车/相机挂载/玩家物理切换。
   interface: place / update / toggle / driving / nearby /
              exitAll / clear。驾驶物理在 TankCore(纯核心),
   提示文案与政策在模式层 — 本文件零玩法知识。
   依赖(均经全局名, 调用期解析): tank-core.js 的 TankCore,
   world.js 的 scene, camera-rig.js 的 CameraRig, voxel.js 的
   pos/vel/yaw/collides, config.js 的 TANK/CAM_TANK,
   input.js 的 keys/touchMove/isTouch(仅 update 读取)。
   模型面朝 -Z(与 Avatar/玩家视线一致), root.rotation.y = yaw。
   ============================================================ */
const Tank = (()=>{

  const tanks = [];                       // { T, root, turret, dispose }
  let drivingIdx = -1;                    // -1=无人驾驶

  /* ---------- 体素风建模: 车体 + 炮塔(旋转枢轴) + 履带 ---------- */
  const box = (w, h, d, color)=> new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({color}));
  /* 配色取自方块注册表: 装甲 10 · 履带 11 · 金属 12 */
  const COL = { hull: 0x61753d, track: 0x26262a, turret: 0x55703c, barrel: 0x787d87 };

  function buildModel(){
    const root = new THREE.Group();

    const trackL = box(0.42, 0.50, 3.0, COL.track); trackL.position.set(-0.72, 0.25, 0);
    const trackR = box(0.42, 0.50, 3.0, COL.track); trackR.position.set( 0.72, 0.25, 0);
    const hull = box(1.55, 0.55, 2.9, COL.hull);  hull.position.y = 0.78;

    /* 炮塔独立 Group(枢轴在座圈): 二期开炮只转它, 一期零成本预留 */
    const turret = new THREE.Group();     turret.position.y = 1.12;
    const dome = box(0.95, 0.42, 1.05, COL.turret); dome.position.y = 0.18;
    const barrel = box(0.16, 0.16, 1.6, COL.barrel); barrel.position.set(0, 0.22, -1.05);

    turret.add(dome, barrel);
    root.add(trackL, trackR, hull, turret);

    const dispose = ()=> root.traverse(o=>{
      if(o.isMesh){ o.geometry.dispose(); o.material.dispose(); }
    });
    return { root, turret, dispose };
  }

  /* ---------- 输入映射: 键盘 + 摇杆 → TankCore 的 input 数据 ----------
     lookYaw 单一权威: 桌面上帧鼠标动过(全局 yaw 变化)才采纳为新目标,
     否则传 null 交给 A·D/摇杆在核心里积分 — 三源不打架。 */
  function readInput(){
    let forward = 0, steer = 0;
    if(keys['KeyW']) forward += 1;
    if(keys['KeyS']) forward -= 1;
    if(keys['KeyA']) steer -= 1;
    if(keys['KeyD']) steer += 1;
    forward += -touchMove.y;  steer += touchMove.x;        // 虚拟摇杆(坦克式: 推杆=前后, 左右=转向)
    forward = Math.max(-1, Math.min(1, forward));
    steer   = Math.max(-1, Math.min(1, steer));
    return { forward, steer, lookYaw: null };
  }
  let lastYaw = 0;                        // 上帧全局 yaw(检测鼠标活动)

  function syncMesh(tk){
    tk.root.position.set(tk.T.x, tk.T.y, tk.T.z);
    tk.root.rotation.y = tk.T.yaw;
  }

  /* ---------- 下车寻位: 车体四侧第一个玩家不卡墙的空位 ---------- */
  function exitSpot(tk){
    const T = tk.T;
    const fx = -Math.sin(T.yaw), fz = -Math.cos(T.yaw);    // 车头
    const rx =  Math.cos(T.yaw), rz = -Math.sin(T.yaw);    // 车体右侧
    const cand = [
      [T.x + rx*(TANK.hw+0.8), T.z + rz*(TANK.hw+0.8)],
      [T.x - rx*(TANK.hw+0.8), T.z - rz*(TANK.hw+0.8)],
      [T.x - fx*(TANK.hw+1.3), T.z - fz*(TANK.hw+1.3)],    // 车尾(下车习惯朝后方)
      [T.x + fx*(TANK.hw+1.3), T.z + fz*(TANK.hw+1.3)],
    ];
    for(const [x, z] of cand){
      if(x < 1 || z < 1 || x > WORLD_W-1 || z > WORLD_D-1) continue;
      if(!collides(x, T.y, z)) return { x, z };
    }
    return { x: T.x, z: T.z };            // 兜底: 原地弹出
  }

  /* ---------- interface ---------- */

  function place(x, y, z, o){
    o = o || {};
    const m = buildModel();
    const tk = { T: TankCore.mkT(x, y, z, o.yaw || 0), ...m };
    scene.add(m.root);
    syncMesh(tk);
    tanks.push(tk);
    return tk;
  }

  function update(dt){
    if(drivingIdx < 0) return;            // 无人: 网格静态, 近距提示归模式层
    const tk = tanks[drivingIdx];
    const input = readInput();
    if(!isTouch && yaw !== lastYaw) input.lookYaw = yaw;   // 鼠标动过 → 新车头目标
    TankCore.step(tk.T, input, dt);
    lastYaw = yaw = tk.T.aimYaw;          // 视角跟随车头目标; 鼠标增量在下帧成为新目标
    pos.set(tk.T.x, tk.T.y + 0.5, tk.T.z); vel.set(0, 0, 0);   // 玩家锁进舱内(物理已挂起)
    syncMesh(tk);
  }

  function toggle(){
    if(drivingIdx >= 0){                  /* ---- 下车 ---- */
      const tk = tanks[drivingIdx];
      const spot = exitSpot(tk);
      pos.set(spot.x, tk.T.y, spot.z); vel.set(0, 0, 0); onGround = false;
      drivingIdx = -1;
      CameraRig.mount(null);
      lastYaw = yaw;
      return 'exited';
    }
    /* ---- 上车: 最近车在 enterR 内(距离门控在 TankCore.nearest) ---- */
    const near = TankCore.nearest(tanks.map(tk=>tk.T), pos.x, pos.z, TANK.enterR);
    if(!near) return 'far';
    drivingIdx = tanks.findIndex(tk=>tk.T === near);
    const tk = tanks[drivingIdx];
    const eye = ()=>({ x: tk.T.x, y: tk.T.y + CAM_TANK.eye, z: tk.T.z });
    CameraRig.mount(eye);                 /* 相机锚源换成炮塔顶; apply 返回 0 → Avatar 隐藏 */
    lastYaw = yaw = tk.T.aimYaw;
    return 'entered';
  }

  function driving(){ return drivingIdx >= 0; }

  function nearby(){                      /* promptR 内最近车距 | null(供模式层提示) */
    const T = TankCore.nearest(tanks.map(tk=>tk.T), pos.x, pos.z, TANK.promptR);
    return T ? Math.hypot(T.x - pos.x, T.z - pos.z) : null;
  }

  function exitAll(){ if(drivingIdx >= 0) toggle(); }

  function clear(){
    if(drivingIdx >= 0){ drivingIdx = -1; CameraRig.mount(null); }
    for(const tk of tanks){ scene.remove(tk.root); tk.dispose(); }
    tanks.length = 0;
  }

  return { place, update, toggle, driving, nearby, exitAll, clear };
})();
