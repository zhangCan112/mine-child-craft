'use strict';
/* ============================================================
   相机装置 (CameraRig, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   玩家视角的唯一入口:
   · apply(camera, dt)  每帧摆相机, 返回实际轨道距离(第一人称 0)
   · cycle()            循环切换 第一/第三背后/第三正面
   · mount(fn|null)     挂载/卸载载具锚源; 挂载后轨道换 CAM_TANK(车尾跟随),
                        apply 恒返回 0 — 复用"近距隐藏玩家形象"契约,
                        驾驶中 Avatar 自动隐藏, 主循环与 Avatar 零改动
   · aim(camera)         统一的角色瞄准射线 — 准星指什么就操作什么,
                        且不会瞄到人物身旁/身后
   · holdAim(pt|null)    触屏长按屏幕点注入: 指尖所在即瞄准所在(挖/高亮
                        跟手), null 还原准星口径
   越肩偏移(人物落画面左侧, 准心不被挡)、体素射线防穿墙收拢、
   贴墙平滑、正面视角翻转、肩平面推进都是 implementation。
   依赖(均经全局名, 调用期解析): voxel.js 的 pos/yaw/pitch/
   raycastVoxel/isOpaque, config.js 的 PLAYER/CAM/CAM_TANK, world.js 的 camera。
   ============================================================ */
const CameraRig = (()=>{
  const MODE_NAMES = ['第一人称', '第三人称 · 背后', '第三人称 · 正面'];
  let mode = 1; // 默认第三人称(背后)
  let curS = 1; // 平滑中的偏移比例(0..1, 防穿墙收拢用)
  let aimSkip = 0; // 越肩瞄准: 相机沿准心推进到人物肩平面的距离
  let mountFn = null; // 载具锚源(() → {x,y,z} 炮塔顶眼位); null = 玩家自己

  const _dir = new THREE.Vector3(); // 玩家视线方向
  const _off = new THREE.Vector3(); // 眼睛→相机 的世界偏移
  const _v = new THREE.Vector3(); // 触屏长按: 屏幕点反投影的工作向量
  const _ray = {x: 0, y: 0, z: 0}; // 偏移方向(鸭类型, raycastVoxel 只读 xyz)
  const _eye = {x: 0, y: 0, z: 0}; // 眼睛位置(同上)
  const _aimO = {x: 0, y: 0, z: 0}; // 瞄准起点(同上)
  const _aim = {origin: null, dir: null}; // aim() 的复用返回值(调用方即取即用, 勿跨帧持有)
  let holdPt = null; // 触屏长按屏幕点(NDC 预算) | null; aim() 优先走指尖射线

  function eyePos() {
    if (mountFn) return mountFn(); /* 载具锚: 炮塔顶眼位 */
    _eye.x = pos.x; _eye.y = pos.y + PLAYER.eye; _eye.z = pos.z;
    return _eye;
  }

  /* 玩家视线方向 (与相机 rotation.set(pitch,yaw,0,'YXZ') 的朝向一致) */
  function lookDir() {
    const cp = Math.cos(pitch);
    _dir.set(-Math.sin(yaw)*cp, Math.sin(pitch), -Math.cos(yaw)*cp);
    return _dir;
  }

  /* 每帧摆相机; 返回实际轨道距离 — Avatar 据此显隐 */
  function apply(camera, dt) {
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (mountFn) { // 载具锚: 车尾跟随轨道, 防穿墙/收拢照常生效
      _off.set(0, CAM_TANK.lift, CAM_TANK.dist);
      _off.applyQuaternion(camera.quaternion); // 局部 → 世界
    } else if (mode === 0) { // 第一人称: 原位原样
      camera.position.set(pos.x, pos.y+PLAYER.eye, pos.z);
      aimSkip = 0;
      return 0;
    } else {
      if (mode === 2) camera.rotation.set(-pitch, yaw+Math.PI, 0, 'YXZ');
      /* 目标偏移(相机局部 +z): 背后越肩(右移+抬升, 人物落画面左侧);
         正面相机已转 180°, 其局部 +z 恰是人物前方 — 两种模式同为 +dist */
      _off.set(mode===1 ? CAM.shoulder : 0, mode===1 ? CAM.lift : 0, CAM.dist);
      _off.applyQuaternion(camera.quaternion); // 局部 → 世界
    }
    const len = _off.length();
    _ray.x = _off.x/len; _ray.y = _off.y/len; _ray.z = _off.z/len;
    /* 防穿墙: 眼睛沿偏移方向做不透明射线(玻璃可透视, 不触发收拢), 命中则整体按比例收拢 */
    const eye = eyePos();
    const hit = raycastVoxel(eye, _ray, len + 0.4, isOpaque);
    const targetS = hit ? Math.max(CAM.minDist/len, (hit.t - CAM.margin)/len) : 1;
    /* 收拢快 · 放开慢: 贴墙不抖, 转身缓出 */
    const k = targetS < curS ? 18 : 6;
    curS += (targetS - curS) * Math.min(1, dt*k);
    if (Math.abs(targetS - curS) < 1e-3) curS = targetS;
    camera.position.set(eye.x + _off.x*curS, eye.y + _off.y*curS, eye.z + _off.z*curS);
    /* 越肩瞄准跳距: 相机沿视线到人物肩平面的投影距离(收拢时同步变短) */
    aimSkip = (!mountFn && mode === 1) ? Math.max(0, curS*CAM.dist - 0.12) : 0;
    return mountFn ? 0 : curS * len; /* 载具锚恒 0: Avatar 按既有契约隐藏 */
  }

  /* 循环切换视角, 返回新模式名(供 toast) */
  function cycle() {
    if (mountFn) return '🚙 驾驶中 · 视角锁定'; // 载具锚下不切视角模式
    mode = (mode + 1) % 3;
    curS = 1; // 新模式直接用满距离, 不从旧距离滑过去
    return MODE_NAMES[mode];
  }

  /* 统一瞄准射线 — 与视角模式无关的"准星所指":
     · 第一人称/正面: 眼睛出发沿玩家视线(正面时相机朝脸, 只能以视线为准)
     · 越肩背后: 相机沿准心方向推进到人物肩平面再发射 — 跳过相机与
       人物之间的方块, 不会瞄到身旁/身后, 准星与高亮严格一致
     · 触屏长按期间(holdAim 屏幕点): 眼睛出发穿过触点 — 挖掘/高亮跟随
       指尖(MC 基岩版触控"所见即所点"口径), 每帧重算不惧相机转动
     camera 显式传入(与 apply 同口径, 不隐读全局); 返回复用对象零分配 */
  function aim(camera) {
    if (holdPt) {
      _v.set(holdPt.nx, holdPt.ny, 0.5).unproject(camera);
      const eye = eyePos();
      _aimO.x = eye.x; _aimO.y = eye.y; _aimO.z = eye.z;
      _v.x -= eye.x; _v.y -= eye.y; _v.z -= eye.z;
      const l = Math.hypot(_v.x, _v.y, _v.z) || 1;
      _v.x /= l; _v.y /= l; _v.z /= l;
      _aim.origin = _aimO; _aim.dir = _v;
      return _aim;
    }
    const dir = lookDir();
    if (mode !== 1 || aimSkip <= 0.001) {
      _aim.origin = eyePos(); _aim.dir = dir;
      return _aim;
    }
    _aimO.x = camera.position.x + dir.x*aimSkip;
    _aimO.y = camera.position.y + dir.y*aimSkip;
    _aimO.z = camera.position.z + dir.z*aimSkip;
    _aim.origin = _aimO; _aim.dir = dir;
    return _aim;
  }

  /* 触屏长按瞄准注入: pt = {x, y, w, h} 屏幕点(内部换算 NDC); null 清除 */
  function holdAim(pt) {
    if (!pt) {
      holdPt = null; return;
    }
    holdPt = {nx: (pt.x / pt.w) * 2 - 1, ny: -(pt.y / pt.h) * 2 + 1};
  }

  /* 挂载/卸载载具锚源: fn() → {x,y,z}(炮塔顶眼位); 卸载传 null */
  function mount(fn) {
    mountFn = fn;
    curS = 1; // 换锚直接用满距离, 不从旧距离滑过去
  }

  return {apply, cycle, aim, holdAim, mount, get mode() {
    return mode;
  }, get mounted() {/* mountFn 现状态只读暴露: HandView 可见性判定用(design D5) */
    return mountFn !== null;
  }};
})();
