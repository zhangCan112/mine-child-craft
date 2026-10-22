'use strict';
/* ============================================================
   载具 (Tank, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   可驾驶实体的建模与状态机: 上车/下车/相机挂载/玩家物理切换/开炮。
   六款型号(迷彩战车·沙漠之鹰·极地冰狼·熔岩勇士·雷霆战神·张廷彧号)由
   config 的 TANK_MODELS 注册表驱动: 性能经 spec 透传 TankCore 逐键回落
   基线; 建模/炮弹观感(弹色·曳光·爆风)/像素图标(icon)各款一套; 可选
   salvo 齐射与 homing 追踪(转向数学在 TankCore.homeShell, 敌人坐标经
   targeter 钩子由模式层注入), shell.fx:'lightning' 换闪电环弹体+电弧
   曳光+落雷命中, 全是 implementation。
   interface: place / update / toggle / driving / nearby(返回 {d,name}) /
              exitAll / clear / fire / onExplode / targeter / icon。
   爆炸破坏在 TankCore(纯核心), 提示文案与话术在模式层 — 本文件零玩法知识。
   依赖(均经全局名, 调用期解析): tank-core.js 的 TankCore,
   world.js 的 scene/editBlockDirty, effects.js 的 sfx/Fx/engineHum,
   camera-rig.js 的 CameraRig, voxel.js 的 pos/vel/yaw/collides/onGround/WORLD_W/WORLD_D,
   config.js 的 TANK/CAM_TANK,
   input.js 的 keys/touchMove(仅 update 读取), config.js 的 IS_TOUCH。
   模型面朝 -Z(与 Avatar/玩家视线一致), root.rotation.y = yaw。
   ============================================================ */
const Tank = (()=>{
  const tanks = []; // { T(含 spec/model), modelKey, root, turret, barrel, antenna, flash, trackL, trackR, ... }
  let drivingIdx = -1; // -1=无人驾驶
  const shells = []; // 在飞的炮弹 { S, mesh, trailT, shell(型号弹观感) }
  let boomCb = null; // 模式注册的爆炸回调(命中反馈, 政策在模式层)
  let protectFn = null; // 模式注册的爆炸保护谓词(什么不可炸, 政策在模式层)
  let obstacleFn = null; // 模式注册的炮弹障碍谓词(什么挡炮弹, 如怪物身体 — 政策在模式层)
  let targetFn = null; // 模式注册的索敌钩子(追踪导弹的"敌人是谁", 政策在模式层)

  /* ---------- 体素风建模: 每款型号一个 builder, 共用 盒件/履带/炮口焰 ----------
     契约: 每款必回 { root, turret, barrel, antenna, flash, trackL, trackR, dispose },
     barrel 记 userData.baseZ(后坐归位基准), flash 初始 visible=false 由 update 驱动。
     模型面朝 -Z(与 Avatar/玩家视线一致), root.rotation.y = yaw。 */
  const box = (w, h, d, color, opts)=>{
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial(Object.assign({color}, opts)));
    return m;
  };

  /* 履带: 底带 + 5 节循环滚动的履带节(差速: 原地转也滚), 各型号只换配色 */
  function mkTracks(trackCol, linkCol) {
    const mk = (x)=>{
      const g = new THREE.Group(); g.position.x = x;
      const base = box(0.42, 0.50, 3.1, trackCol); base.position.y = 0.25; g.add(base);
      g.userData.links = [];
      for (let i=0; i<5; i++) {
        const link = box(0.46, 0.06, 0.30, linkCol);
        link.position.set(0, 0.52, -1.2 + i*0.6);
        g.add(link); g.userData.links.push(link);
      }
      return g;
    };
    return [mk(-0.78), mk(0.78)];
  }

  /* 炮口焰: 开炮瞬闪(0.12 秒缩小消失), 颜色随型号 */
  function mkFlash(color, glow, s) {
    s = s || 0.55;
    const f = box(s, s, s*1.27, color, {emissive: glow, transparent: true, opacity: 0.95});
    f.visible = false;
    return f;
  }

  /* 天线: 杆 + 顶端发光件(五款共用件, 各款只给参数)
     o: {rodW, rodD(缺省=rodW), rodH, rodY, tipW, tipH, tipY, rodCol, tipCol, glow} */
  function mkAntenna(x, y, z, o) {
    const a = new THREE.Group(); a.position.set(x, y, z);
    const rod = box(o.rodW, o.rodH, o.rodD || o.rodW, o.rodCol); rod.position.y = o.rodY;
    const tip = box(o.tipW, o.tipH, o.tipW, o.tipCol, {emissive: o.glow}); tip.position.y = o.tipY;
    a.add(rod, tip);
    return a;
  }

  const disposeModel = (root)=> ()=> root.traverse((o)=>{
    if (o.isMesh) {
      o.geometry.dispose(); o.material.dispose();
    }
  });

  /* ---------- classic · 迷彩战车: 斜甲车首 · 侧裙 · 迷彩 · 阶梯炮塔 ----------
     配色取自方块注册表: 装甲 10 · 履带 11 · 金属 12, 迷彩/灯为观感增强 */
  const COL = {
    hull: 0x61753d, hullDark: 0x4a5a30, camo: 0x3c4a28, camo2: 0x6f7f46,
    track: 0x26262a, link: 0x3d3d44, skirt: 0x333d24,
    turret: 0x55703c, turretTop: 0x476031, barrel: 0x787d87, brake: 0x8b909a,
    lamp: 0xfff2b0, antTip: 0xff4444,
  };
  function buildClassic() {
    const root = new THREE.Group();
    const [trackL, trackR] = mkTracks(COL.track, COL.link);

    /* 侧裙板: 盖住履带上半, 装甲感 */
    const skirtL = box(0.14, 0.36, 2.75, COL.skirt); skirtL.position.set(-0.82, 0.72, 0);
    const skirtR = box(0.14, 0.36, 2.75, COL.skirt); skirtR.position.set( 0.82, 0.72, 0);

    /* 车体主甲 + 阶梯斜甲车首(三段收窄, 迎弹面) + 尾部排气筒 ×2 */
    const hull = box(1.7, 0.5, 2.9, COL.hull); hull.position.y = 0.92;
    const glacis1 = box(1.66, 0.16, 0.62, COL.hullDark); glacis1.position.set(0, 0.76, -1.48);
    const glacis2 = box(1.5, 0.18, 0.5, COL.hullDark); glacis2.position.set(0, 0.94, -1.28);
    const glacis3 = box(1.28, 0.2, 0.46, COL.hullDark); glacis3.position.set(0, 1.12, -1.08);
    const exhL = box(0.14, 0.16, 0.42, COL.track); exhL.position.set(-0.4, 1.18, 1.42);
    const exhR = box(0.14, 0.16, 0.42, COL.track); exhR.position.set( 0.4, 1.18, 1.42);

    /* 迷彩色块(微浮出表面, 免 z-fight) */
    const camo1 = box(0.5, 0.52, 0.5, COL.camo); camo1.position.set(-0.42, 0.92, -0.4);
    const camo2 = box(0.44, 0.52, 0.4, COL.camo2); camo2.position.set(0.45, 0.92, 0.55);
    const camo3 = box(0.36, 0.52, 0.34, COL.camo); camo3.position.set(0.3, 0.92, -0.95);

    /* 车头灯 ×2(自发光, 夜里也亮) */
    const lampL = box(0.16, 0.13, 0.1, COL.lamp, {emissive: 0x997f30});
    lampL.position.set(-0.56, 1.06, -1.5);
    const lampR = box(0.16, 0.13, 0.1, COL.lamp, {emissive: 0x997f30});
    lampR.position.set( 0.56, 1.06, -1.5);

    /* 炮塔群(枢轴在座圈): 阶梯塔身 · 舱盖 · 天线(红头) ·
       炮管 + 炮口制退器 + 炮口焰(开炮瞬闪) */
    const turret = new THREE.Group(); turret.position.y = 1.34;
    const dome1 = box(1.05, 0.34, 1.2, COL.turret); dome1.position.y = 0.14;
    const dome2 = box(0.8, 0.26, 0.92, COL.turretTop); dome2.position.y = 0.42;
    const hatch = box(0.34, 0.08, 0.34, COL.barrel); hatch.position.set(0, 0.58, 0.18);
    const mantlet = box(0.3, 0.3, 0.36, COL.barrel); mantlet.position.set(0, 0.22, -0.62);
    const barrel = box(0.15, 0.15, 1.7, COL.barrel); barrel.position.set(0, 0.22, -1.1);
    barrel.userData.baseZ = -1.1;
    const brake = box(0.24, 0.24, 0.3, COL.brake); brake.position.set(0, 0.22, -1.98);
    const antenna = mkAntenna(0.42, 0.5, 0.44, {rodW: 0.045, rodH: 0.95, rodY: 0.48,
      tipW: 0.06, tipH: 0.12, tipY: 1.0, rodCol: COL.brake, tipCol: COL.antTip, glow: 0x881111});
    const flash = mkFlash(0xffa030, 0xcc6600);
    flash.position.set(0, 0.22, -2.3);
    turret.add(dome1, dome2, hatch, mantlet, barrel, brake, antenna, flash);

    root.add(trackL, trackR, skirtL, skirtR, hull, glacis1, glacis2, glacis3,
        exhL, exhR, camo1, camo2, camo3, lampL, lampR, turret);
    return {root, turret, barrel, antenna, flash, trackL, trackR, dispose: disposeModel(root)};
  }

  /* ---------- desert · 沙漠之鹰: 低矮楔形车体 · 超长速射炮 · 尾部油桶 ---------- */
  function buildDesert() {
    const C = {hull: 0xc9a44e, hullDark: 0xa9823c, track: 0x2c261d, link: 0x4a4033,
      turret: 0xd6b56a, turretTop: 0xbfa156, barrel: 0x8f7c4e, brake: 0xb3a06c,
      stripe: 0xf4efe2, lamp: 0xfff2b0, drum: 0x9c8a5a, antTip: 0xffcf60};
    const root = new THREE.Group();
    const [trackL, trackR] = mkTracks(C.track, C.link);

    /* 低矮楔形车首: 四段收窄斜甲(锐利迎弹面, 显速度感) */
    const hull = box(1.66, 0.44, 2.7, C.hull); hull.position.y = 0.86;
    const g1 = box(1.6, 0.14, 0.5, C.hullDark); g1.position.set(0, 0.72, -1.36);
    const g2 = box(1.42, 0.16, 0.44, C.hullDark); g2.position.set(0, 0.86, -1.18);
    const g3 = box(1.2, 0.16, 0.4, C.hullDark); g3.position.set(0, 1.0, -1.0);
    const g4 = box(0.94, 0.14, 0.36, C.hullDark); g4.position.set(0, 1.12, -0.84);

    /* 尾部油桶 ×2(沙漠远征的浪漫) + 车头灯 ×2 */
    const drumL = box(0.3, 0.34, 0.3, C.drum); drumL.position.set(-0.5, 1.22, 1.16);
    const drumR = box(0.3, 0.34, 0.3, C.drum); drumR.position.set( 0.5, 1.22, 1.16);
    const lampL = box(0.15, 0.12, 0.1, C.lamp, {emissive: 0x997f30}); lampL.position.set(-0.55, 0.98, -1.4);
    const lampR = box(0.15, 0.12, 0.1, C.lamp, {emissive: 0x997f30}); lampR.position.set( 0.55, 0.98, -1.4);

    /* 小炮塔后置 + 超长炮管(速射猎手) + 白色识别条 */
    const turret = new THREE.Group(); turret.position.set(0, 1.1, 0.28);
    const dome = box(0.92, 0.3, 1.0, C.turret); dome.position.y = 0.13;
    const top = box(0.66, 0.2, 0.7, C.turretTop); top.position.y = 0.36;
    const stripe = box(0.94, 0.06, 0.28, C.stripe); stripe.position.set(0, 0.3, 0.34);
    const mantlet = box(0.26, 0.26, 0.3, C.barrel); mantlet.position.set(0, 0.18, -0.5);
    const barrel = box(0.12, 0.12, 2.1, C.barrel); barrel.position.set(0, 0.18, -1.55);
    barrel.userData.baseZ = -1.55;
    const brake = box(0.2, 0.2, 0.26, C.brake); brake.position.set(0, 0.18, -2.62);
    const antenna = mkAntenna(-0.34, 0.42, 0.4, {rodW: 0.04, rodH: 0.8, rodY: 0.4,
      tipW: 0.055, tipH: 0.1, tipY: 0.85, rodCol: C.brake, tipCol: C.antTip, glow: 0x8a6a20});
    const flash = mkFlash(0xffd070, 0xcc8a20);
    flash.position.set(0, 0.18, -2.85);
    turret.add(dome, top, stripe, mantlet, barrel, brake, antenna, flash);

    root.add(trackL, trackR, hull, g1, g2, g3, g4, drumL, drumR, lampL, lampR, turret);
    return {root, turret, barrel, antenna, flash, trackL, trackR, dispose: disposeModel(root)};
  }

  /* ---------- frost · 极地冰狼: 高大箱体 · 前铲雪刃 · 短粗重炮 · 蓝旗 ---------- */
  function buildFrost() {
    const C = {hull: 0xe6eef6, hullDark: 0xb9cbdb, track: 0x3a4652, link: 0x5d6d7d,
      turret: 0xd7e5ef, turretTop: 0xc3d6e4, barrel: 0x9fb8c8, brake: 0xd5e6f0,
      glow: 0x9fe8ff, flag: 0x3f8fd9, lamp: 0xd8f6ff};
    const root = new THREE.Group();
    const [trackL, trackR] = mkTracks(C.track, C.link);

    /* 高大箱形车体(冰原重装) + 大块斜甲 + 冰蓝观景窗 */
    const hull = box(1.8, 0.66, 2.85, C.hull); hull.position.y = 1.05;
    const glacis = box(1.76, 0.5, 0.5, C.hullDark); glacis.position.set(0, 0.98, -1.42);
    const visor = box(1.2, 0.14, 0.1, C.glow, {emissive: 0x2e7fa8}); visor.position.set(0, 1.32, -1.32);

    /* 前铲雪刃: 宽板 + 上沿冰光(推开一切的样子) */
    const plow = box(2.1, 0.5, 0.18, C.hullDark); plow.position.set(0, 0.62, -1.62);
    const plowTop = box(2.12, 0.06, 0.2, C.glow, {emissive: 0x2e7fa8}); plowTop.position.set(0, 0.89, -1.62);

    /* 宽扁炮塔 + 短粗胖炮(威慑感) + 顶置探照灯 */
    const turret = new THREE.Group(); turret.position.y = 1.45;
    const dome = box(1.15, 0.32, 1.3, C.turret); dome.position.y = 0.15;
    const top = box(0.9, 0.22, 1.0, C.turretTop); top.position.y = 0.4;
    const spot = box(0.3, 0.18, 0.22, C.lamp, {emissive: 0x3d7080}); spot.position.set(0, 0.56, -0.3);
    const mantlet = box(0.4, 0.4, 0.34, C.barrel); mantlet.position.set(0, 0.2, -0.66);
    const barrel = box(0.26, 0.26, 1.15, C.barrel); barrel.position.set(0, 0.2, -1.1);
    barrel.userData.baseZ = -1.1;
    const brake = box(0.36, 0.36, 0.26, C.brake); brake.position.set(0, 0.2, -1.78);
    /* 天线 → 后旗杆 + 蓝色小旗(随风摆的也是它) */
    const antenna = new THREE.Group(); antenna.position.set(0.45, 0.48, 0.5);
    const rod = box(0.05, 0.9, 0.05, C.barrel); rod.position.y = 0.45;
    const flag = box(0.04, 0.2, 0.34, C.flag); flag.position.set(0, 0.72, 0.2);
    antenna.add(rod, flag);
    const flash = mkFlash(0xcaf0ff, 0x3a8ab0, 0.6);
    flash.position.set(0, 0.2, -1.98);
    turret.add(dome, top, spot, mantlet, barrel, brake, antenna, flash);

    root.add(trackL, trackR, hull, glacis, visor, plow, plowTop, turret);
    return {root, turret, barrel, antenna, flash, trackL, trackR, dispose: disposeModel(root)};
  }

  /* ---------- magma · 熔岩勇士: 黑甲 + 熔岩光缝 · 火山口炮塔 · 双烟囱 ---------- */
  function buildMagma() {
    const C = {hull: 0x392e28, hullDark: 0x281f1b, track: 0x1d1a18, link: 0x3d3630,
      turret: 0x453530, turretTop: 0x352824, barrel: 0x241e1c, brake: 0x57423a,
      lava: 0xff6a1f, core: 0xd84a12, stack: 0x211a16};
    const root = new THREE.Group();
    const [trackL, trackR] = mkTracks(C.track, C.link);

    /* 黑铁车体 + 阶梯斜甲 */
    const hull = box(1.74, 0.52, 2.9, C.hull); hull.position.y = 0.92;
    const g1 = box(1.7, 0.16, 0.6, C.hullDark); g1.position.set(0, 0.74, -1.5);
    const g2 = box(1.5, 0.18, 0.5, C.hullDark); g2.position.set(0, 0.94, -1.3);
    const g3 = box(1.24, 0.2, 0.44, C.hullDark); g3.position.set(0, 1.12, -1.1);

    /* 熔岩光缝: 车体两侧自发光(火山在甲缝里烧) */
    const stripL = box(0.05, 0.1, 2.2, C.lava, {emissive: 0x9c2f00}); stripL.position.set(-0.88, 0.98, 0);
    const stripR = box(0.05, 0.1, 2.2, C.lava, {emissive: 0x9c2f00}); stripR.position.set( 0.88, 0.98, 0);

    /* 车尾双烟囱(顶端烧红) */
    const stackL = box(0.18, 0.5, 0.18, C.stack); stackL.position.set(-0.45, 1.4, 1.3);
    const stackR = box(0.18, 0.5, 0.18, C.stack); stackR.position.set( 0.45, 1.4, 1.3);
    const tipL = box(0.2, 0.08, 0.2, C.lava, {emissive: 0x9c2f00}); tipL.position.set(-0.45, 1.68, 1.3);
    const tipR = box(0.2, 0.08, 0.2, C.lava, {emissive: 0x9c2f00}); tipR.position.set( 0.45, 1.68, 1.3);

    /* 火山口炮塔: 阶梯收顶 + 中央岩浆核(发光) + 粗炮管大制退器 */
    const turret = new THREE.Group(); turret.position.y = 1.34;
    const dome = box(1.08, 0.36, 1.24, C.turret); dome.position.y = 0.14;
    const mid = box(0.86, 0.26, 0.98, C.turretTop); mid.position.y = 0.42;
    const core = box(0.5, 0.14, 0.5, C.core, {emissive: 0xaa3300}); core.position.set(0, 0.6, 0.1);
    const mantlet = box(0.28, 0.28, 0.36, C.barrel); mantlet.position.set(0, 0.22, -0.62);
    const barrel = box(0.18, 0.18, 1.6, C.barrel); barrel.position.set(0, 0.22, -1.05);
    barrel.userData.baseZ = -1.05;
    const brake = box(0.3, 0.3, 0.34, C.brake); brake.position.set(0, 0.22, -1.92);
    const antenna = mkAntenna(0.42, 0.5, 0.44, {rodW: 0.045, rodH: 0.95, rodY: 0.48,
      tipW: 0.06, tipH: 0.12, tipY: 1.0, rodCol: C.brake, tipCol: C.lava, glow: 0x993300});
    const flash = mkFlash(0xffa040, 0xcc5500, 0.7);
    flash.position.set(0, 0.22, -2.2);
    turret.add(dome, mid, core, mantlet, barrel, brake, antenna, flash);

    root.add(trackL, trackR, hull, g1, g2, g3, stripL, stripR,
        stackL, stackR, tipL, tipR, turret);
    return {root, turret, barrel, antenna, flash, trackL, trackR, dispose: disposeModel(root)};
  }

  /* ---------- thunder · 雷霆战神: 深海军蓝 + 青霓光带 · 双前齿 · 等离子炮 ---------- */
  function buildThunder() {
    const C = {hull: 0x232f4e, hullDark: 0x18213b, track: 0x14182a, link: 0x32405f,
      turret: 0x2b3a5f, turretTop: 0x374a75, barrel: 0x101826, brake: 0x3f5a8a,
      neon: 0x39e6ff, flash: 0x8ff4ff};
    const root = new THREE.Group();
    const [trackL, trackR] = mkTracks(C.track, C.link);

    /* 楔形车体 + 双前齿(科幻叉首) + 车首霓虹灯带 + 侧光带 */
    const hull = box(1.7, 0.46, 2.8, C.hull); hull.position.y = 0.9;
    const glacis = box(1.66, 0.4, 0.7, C.hullDark); glacis.position.set(0, 0.78, -1.3);
    const prongL = box(0.24, 0.3, 0.9, C.hullDark); prongL.position.set(-0.55, 0.62, -1.7);
    const prongR = box(0.24, 0.3, 0.9, C.hullDark); prongR.position.set( 0.55, 0.62, -1.7);
    const bow = box(1.2, 0.08, 0.08, C.neon, {emissive: 0x0e7f96}); bow.position.set(0, 1.02, -1.44);
    const sideL = box(0.04, 0.06, 1.8, C.neon, {emissive: 0x0e7f96}); sideL.position.set(-0.86, 0.96, 0.2);
    const sideR = box(0.04, 0.06, 1.8, C.neon, {emissive: 0x0e7f96}); sideR.position.set( 0.86, 0.96, 0.2);

    /* 扁平多面炮塔 + 发光感应器 + 细长能量炮(三道发光环箍) + 双天线 */
    const turret = new THREE.Group(); turret.position.y = 1.16;
    const dome = box(1.0, 0.3, 1.15, C.turret); dome.position.y = 0.13;
    const top = box(0.7, 0.2, 0.85, C.turretTop); top.position.y = 0.36;
    const sensor = box(0.34, 0.1, 0.3, C.neon, {emissive: 0x0e7f96}); sensor.position.set(0, 0.5, -0.2);
    const mantlet = box(0.24, 0.24, 0.3, C.brake); mantlet.position.set(0, 0.2, -0.55);
    const barrel = box(0.13, 0.13, 1.9, C.barrel); barrel.position.set(0, 0.2, -1.3);
    barrel.userData.baseZ = -1.3;
    const rings = [];
    for (const rz of [-0.9, -1.3, -1.7]) {
      const ring = box(0.21, 0.21, 0.08, C.neon, {emissive: 0x0e7f96});
      ring.position.set(0, 0.2, rz); rings.push(ring);
    }
    /* 双天线: 前斜装饰 + 后立(后立那根随行进晃动) */
    const antFront = new THREE.Group(); antFront.position.set(-0.36, 0.42, -0.3);
    const frontRod = box(0.035, 0.7, 0.035, C.brake); frontRod.position.y = 0.35;
    antFront.rotation.x = 0.45; antFront.add(frontRod);
    const antenna = mkAntenna(0.4, 0.44, 0.42, {rodW: 0.04, rodH: 0.85, rodY: 0.42,
      tipW: 0.055, tipH: 0.11, tipY: 0.9, rodCol: C.brake, tipCol: C.neon, glow: 0x0e7f96});
    const flash = mkFlash(0x8ff4ff, 0x1a9ab8, 0.6);
    flash.position.set(0, 0.2, -2.42);
    turret.add(dome, top, sensor, mantlet, barrel, ...rings, antFront, antenna, flash);

    root.add(trackL, trackR, hull, glacis, prongL, prongR, bow, sideL, sideR, turret);
    return {root, turret, barrel, antenna, flash, trackL, trackR, dispose: disposeModel(root)};
  }

  /* ---------- tingyu · 张廷彧号: TNT 迷彩涂装 · 苦力怕车长 · 四联导弹巢 ----------
     全场最酷炫的一辆: TNT 红底 + 白色绑带 + 橄榄迷彩, 塔顶站着苦力怕
     车长(黑脸像素), 天线是点着的 TNT 引信(橙光), 主炮是 2×2 四联
     发射管(整组后坐), 弹药为追踪导弹(config: salvo 4 + homing)。 */
  function buildTingyu() {
    const C = {hull: 0xd14738, hullDark: 0xa83528, camo: 0x4a5a30, camo2: 0x39302c,
      track: 0x26262a, link: 0x3d3d44, skirt: 0x8f2e24,
      turret: 0xc43e30, turretTop: 0xa83528, band: 0xf2efe8, tube: 0x33262a,
      tubeRim: 0xd14738, creep: 0x4fae4f, creepDark: 0x3d8f3d, face: 0x14200f,
      fuse: 0xffb040, lamp: 0xfff2b0};
    const root = new THREE.Group();
    const [trackL, trackR] = mkTracks(C.track, C.link);

    /* 深红侧裙 + TNT 红车体 + 阶梯斜甲 */
    const skirtL = box(0.14, 0.36, 2.75, C.skirt); skirtL.position.set(-0.82, 0.72, 0);
    const skirtR = box(0.14, 0.36, 2.75, C.skirt); skirtR.position.set( 0.82, 0.72, 0);
    const hull = box(1.72, 0.5, 2.9, C.hull); hull.position.y = 0.92;
    const g1 = box(1.68, 0.16, 0.62, C.hullDark); g1.position.set(0, 0.76, -1.48);
    const g2 = box(1.52, 0.18, 0.5, C.hullDark); g2.position.set(0, 0.94, -1.28);
    const g3 = box(1.3, 0.2, 0.46, C.hullDark); g3.position.set(0, 1.12, -1.08);

    /* TNT 白色绑带: 两侧纵带 + 首上横带(微浮出表面, TNT 方块的招牌) */
    const bandL = box(0.06, 0.34, 2.6, C.band); bandL.position.set(-0.87, 0.92, 0.05);
    const bandR = box(0.06, 0.34, 2.6, C.band); bandR.position.set( 0.87, 0.92, 0.05);
    const bandF = box(1.56, 0.32, 0.06, C.band); bandF.position.set(0, 0.78, -1.5);

    /* 迷彩色块(橄榄绿+炭黑扫过红底) */
    const camo1 = box(0.5, 0.52, 0.5, C.camo); camo1.position.set(-0.42, 0.92, -0.35);
    const camo2 = box(0.44, 0.52, 0.4, C.camo2); camo2.position.set(0.45, 0.92, 0.6);
    const camo3 = box(0.36, 0.52, 0.34, C.camo); camo3.position.set(0.28, 0.92, -0.98);

    /* 车头灯 ×2 + 车尾喷口 ×2(微发光) */
    const lampL = box(0.16, 0.13, 0.1, C.lamp, {emissive: 0x997f30}); lampL.position.set(-0.56, 1.06, -1.5);
    const lampR = box(0.16, 0.13, 0.1, C.lamp, {emissive: 0x997f30}); lampR.position.set( 0.56, 1.06, -1.5);
    const exhL = box(0.14, 0.16, 0.42, C.hullDark, {emissive: 0x551808}); exhL.position.set(-0.4, 1.18, 1.42);
    const exhR = box(0.14, 0.16, 0.42, C.hullDark, {emissive: 0x551808}); exhR.position.set( 0.4, 1.18, 1.42);

    /* 炮塔群: 阶梯红塔 + 白色塔带 + 四联导弹巢 + 苦力怕车长 + 引信天线 */
    const turret = new THREE.Group(); turret.position.y = 1.36;
    const dome1 = box(1.05, 0.34, 1.2, C.turret); dome1.position.y = 0.14;
    const dome2 = box(0.8, 0.26, 0.92, C.turretTop); dome2.position.y = 0.42;
    const tband = box(0.84, 0.12, 0.96, C.band); tband.position.y = 0.36;

    /* 四联导弹巢: 2×2 短管 + 红色管口(整组随开炮后坐, 满足 barrel 契约) */
    const barrel = new THREE.Group();
    barrel.position.set(0, 0.26, -0.75); barrel.userData.baseZ = -0.75;
    for (const dx of [-0.13, 0.13]) {
      for (const dy of [0.13, -0.13]) {
        const tube = box(0.15, 0.15, 0.95, C.tube); tube.position.set(dx, dy, -0.1);
        const rim = box(0.18, 0.18, 0.09, C.tubeRim); rim.position.set(dx, dy, -0.61);
        barrel.add(tube, rim);
      }
    }

    /* 苦力怕车长: 绿头黑脸小身, 立在塔顶后部盯着战场 */
    const creep = new THREE.Group(); creep.position.set(0.3, 0.55, 0.4);
    const cBody = box(0.18, 0.14, 0.12, C.creepDark); cBody.position.y = 0.07;
    const cHead = box(0.26, 0.26, 0.26, C.creep); cHead.position.y = 0.27;
    const eyeL = box(0.06, 0.06, 0.02, C.face); eyeL.position.set(-0.06, 0.32, -0.13);
    const eyeR = box(0.06, 0.06, 0.02, C.face); eyeR.position.set( 0.06, 0.32, -0.13);
    const cMouth = box(0.14, 0.12, 0.02, C.face); cMouth.position.set(0, 0.2, -0.13);
    creep.add(cBody, cHead, eyeL, eyeR, cMouth);

    /* 引信天线: 白杆 + 顶端橙色火光(TNT 点着了!) */
    const antenna = mkAntenna(-0.35, 0.42, 0.42, {rodW: 0.045, rodD: 0.05, rodH: 0.85, rodY: 0.42,
      tipW: 0.07, tipH: 0.14, tipY: 0.88, rodCol: C.band, tipCol: C.fuse, glow: 0xcc7710});

    const flash = mkFlash(0xffd070, 0xcc7710, 0.7); /* 四管齐射一大团 */
    flash.position.set(0, 0.26, -1.42);
    turret.add(dome1, dome2, tband, barrel, creep, antenna, flash);

    root.add(trackL, trackR, skirtL, skirtR, hull, g1, g2, g3,
        bandL, bandR, bandF, camo1, camo2, camo3, lampL, lampR, exhL, exhR, turret);
    return {root, turret, barrel, antenna, flash, trackL, trackR, dispose: disposeModel(root)};
  }

  const BUILDERS = {classic: buildClassic, desert: buildDesert, frost: buildFrost,
    magma: buildMagma, thunder: buildThunder, tingyu: buildTingyu};
  function buildModel(key) {
    const fn = BUILDERS[key] || BUILDERS.classic; // 未知型号回落迷彩战车
    return fn();
  }

  /* ---------- 输入映射: 键盘 + 摇杆 → TankCore 的 input 数据 ----------
     lookYaw 单一权威: 桌面上帧鼠标动过(全局 yaw 变化)才采纳为新目标,
     否则传 null 交给 A·D/摇杆在核心里积分 — 三源不打架。 */
  function readInput() {
    let forward = 0; let steer = 0;
    if (keys['KeyW']) forward += 1;
    if (keys['KeyS']) forward -= 1;
    if (keys['KeyA']) steer -= 1;
    if (keys['KeyD']) steer += 1;
    forward += -touchMove.y; steer += touchMove.x; // 虚拟摇杆(坦克式: 推杆=前后, 左右=转向)
    forward = Math.max(-1, Math.min(1, forward));
    steer = Math.max(-1, Math.min(1, steer));
    return {forward, steer, lookYaw: null};
  }
  let lastYaw = 0; // 上帧全局 yaw(检测鼠标活动)

  function syncMesh(tk) {
    tk.root.position.set(tk.T.x, tk.T.y, tk.T.z);
    tk.root.rotation.y = tk.T.yaw;
  }

  /* ---------- 下车寻位: 车体四侧第一个玩家不卡墙的空位 ---------- */
  function exitSpot(tk) {
    const T = tk.T;
    const fx = -Math.sin(T.yaw); const fz = -Math.cos(T.yaw); // 车头
    const rx = Math.cos(T.yaw); const rz = -Math.sin(T.yaw); // 车体右侧
    const cand = [
      [T.x + rx*(TANK.hw+0.8), T.z + rz*(TANK.hw+0.8)],
      [T.x - rx*(TANK.hw+0.8), T.z - rz*(TANK.hw+0.8)],
      [T.x - fx*(TANK.hw+1.3), T.z - fz*(TANK.hw+1.3)], // 车尾(下车习惯朝后方)
      [T.x + fx*(TANK.hw+1.3), T.z + fz*(TANK.hw+1.3)],
    ];
    for (const [x, z] of cand) {
      if (x < 1 || z < 1 || x > WORLD_W-1 || z > WORLD_D-1) continue;
      if (!collides(x, T.y, z)) return {x, z};
    }
    return {x: T.x, z: T.z}; // 兜底: 原地弹出
  }

  /* 履带滚动: 速度 + 转向差速(原地转两侧反向滚), 节距 0.6 循环 */
  function animateTreads(tk, dt) {
    const yawDelta = TankCore.wrapAngle(tk.T.yaw - tk.prevYaw);
    tk.prevYaw = tk.T.yaw;
    const vL = tk.T.vel - yawDelta*0.8; // 差速视觉量(非物理): 原地转两侧反向滚
    const vR = tk.T.vel + yawDelta*0.8;
    for (const [g, v] of [[tk.trackL, vL], [tk.trackR, vR]]) {
      for (const link of g.userData.links) {
        link.position.z = ((link.position.z + v*dt) % 3 + 3) % 3 - 1.5;
      }
    }
  }

  /* 在飞炮弹: 步进 + 命中/超程 → 爆炸(Fx + 批量破坏 + 回调)
     几何模块级共享(高频开炮零分配); 材质按型号缓存(弹色/自发光各异),
     dispose 只摘不释放。曳光按型号拖彩点(弹道读得见, 酷炫);
     fx:'lightning' 弹体为发光环(面朝航向自旋), 曳光换成锯齿电弧,
     命中换成落雷(Fx.bolt 内含 zap 音)+ 雷鸣爆风 */
  const shellGeo = new THREE.BoxGeometry(0.24, 0.24, 0.36);
  const shellMats = {}; // 型号键 → 材质(懒建常驻)
  function shellMat(key) {
    const def = TANK_MODELS[key] || TANK_MODELS.classic;
    if (!shellMats[key]) {
      shellMats[key] = new THREE.MeshLambertMaterial({
        color: def.shell.color, emissive: def.shell.glow || 0x000000});
    }
    return shellMats[key];
  }
  const ringGeo = new THREE.TorusGeometry(0.19, 0.055, 8, 18); // 闪电环弹体(共享)
  const ringMats = {}; // 型号键 → 环材质(Basic 不受光 = 常亮)
  function ringMat(key) {
    const def = TANK_MODELS[key] || TANK_MODELS.classic;
    if (!ringMats[key]) ringMats[key] = new THREE.MeshBasicMaterial({color: def.shell.color});
    return ringMats[key];
  }
  function disposeShell(sh) {
    scene.remove(sh.mesh); // 共享资源不 dispose(常驻复用)
  }
  function stepShells(dt) {
    for (let i=shells.length-1; i>=0; i--) {
      const sh = shells[i];
      /* 追踪弹: 模式注入的索敌钩子给最近敌人坐标, 核心纯函数按角速率转向(无目标直飞) */
      if (sh.homing && targetFn) {
        const t = targetFn(sh.S.x, sh.S.y, sh.S.z);
        if (t) TankCore.homeShell(sh.S, t.x, t.y, t.z, sh.homing, dt);
      }
      TankCore.shellStep(sh.S, dt, obstacleFn);
      sh.mesh.position.set(sh.S.x, sh.S.y, sh.S.z);
      if (sh.lightning) {/* 闪电环: 面朝航向 + 绕航向自旋 */
        sh.mesh.lookAt(sh.S.x + sh.S.vx, sh.S.y + sh.S.vy, sh.S.z + sh.S.vz);
        sh.mesh.rotateZ(dt*16);
      } else if (sh.homing) sh.mesh.lookAt(sh.S.x + sh.S.vx, sh.S.y + sh.S.vy, sh.S.z + sh.S.vz); // 导弹: 弹头指向航向
      else sh.mesh.rotation.x += dt*9;
      if (sh.shell && sh.shell.trail) {/* 曳光: 闪电弹走锯齿电弧, 其余走光点 */
        sh.trailT -= dt;
        if (sh.trailT <= 0) {
          if (sh.lightning) {
            sh.trailT = 0.05;
            Fx.arc(sh.S.x, sh.S.y, sh.S.z, {color: sh.shell.trail, pts: 4, spread: 0.9, dur: 0.1});
          } else {
            sh.trailT = 0.04;
            Fx.pop(sh.S.x, sh.S.y, sh.S.z, {color: sh.shell.trail, r0: 0.14, r1: 0.5, dur: 0.3, opacity: 0.6});
          }
        }
      }
      if (!sh.S.dead) continue;
      disposeShell(sh);
      shells.splice(i, 1);
      const res = TankCore.explode(sh.S.x, sh.S.y, sh.S.z, editBlockDirty, protectFn, sh.S.spec);
      const sr = TankCore.specV(sh.S.spec, 'shellR'); // 爆炸半径的同一回落规则(勿手抄 ||)
      if (sh.lightning) {/* 命中: 天降落雷(含 zap) + 雷鸣爆风 */
        Fx.bolt(sh.S.x, sh.S.y, sh.S.z, {color: sh.shell && sh.shell.boom, r1: sr + 1.0});
        Fx.boom(sh.S.x, sh.S.y, sh.S.z, {r1: sr + 1.2, n: 8, color: sh.shell && sh.shell.boom, kick: 0.5});
      } else {
        Fx.boom(sh.S.x, sh.S.y, sh.S.z, { // 爆风随型号配色(内含 boom 音+震屏)
          r1: sr + 1.2, n: 12, color: sh.shell && sh.shell.boom});
      }
      if (boomCb) boomCb(sh.S.x, sh.S.y, sh.S.z, res); // 带爆点坐标: 波及判定归模式层
    }
  }

  /* ---------- interface ---------- */

  function place(x, y, z, o) {
    o = o || {};
    const def = model(o.model); // 型号注册表(config), 未知回落经典款(单一回落口)
    const m = buildModel(def.key);
    const T = TankCore.mkT(x, y, z, o.yaw || 0, def.perf);
    T.model = def; // 挂上型号 def(模式层读 name 做提示)
    const tk = {T, modelKey: def.key, prevYaw: o.yaw || 0, recoil: 0, animT: 0, flashT: 0, ...m};
    scene.add(m.root);
    syncMesh(tk);
    tanks.push(tk);
    return tk;
  }

  function update(dt) {
    if (drivingIdx >= 0) {
      const tk = tanks[drivingIdx];
      const input = readInput();
      if (!IS_TOUCH && yaw !== lastYaw) input.lookYaw = yaw; // 鼠标动过 → 新车头目标(触屏口径 config.IS_TOUCH)
      TankCore.step(tk.T, input, dt);
      lastYaw = yaw = tk.T.aimYaw; // 视角跟随车头目标; 鼠标增量在下帧成为新目标
      pos.set(tk.T.x, tk.T.y + 0.5, tk.T.z); vel.set(0, 0, 0); // 玩家锁进舱内(物理已挂起)
      syncMesh(tk);
      animateTreads(tk, dt);
      engineHum(Math.abs(tk.T.vel)/TANK.speed); // 引擎嗡鸣随车速(内部量化免抖)
      /* 天线随行进晃动, 停车缓摆回正 */
      tk.animT += dt*(1 + Math.abs(tk.T.vel)*0.6);
      tk.antenna.rotation.x = Math.sin(tk.animT*5.5)*0.1*Math.min(1, Math.abs(tk.T.vel)/2);
      tk.antenna.rotation.z = Math.cos(tk.animT*4.2)*0.07*Math.min(1, Math.abs(tk.T.vel)/2);
      if (tk.recoil > 0) {/* 炮管后坐复位(基准随型号炮长) */
        tk.recoil = Math.max(0, tk.recoil - dt*1.4);
        tk.barrel.position.z = tk.barrel.userData.baseZ + tk.recoil;
      }
      if (tk.flashT > 0) {/* 炮口焰: 0.12 秒缩小消失 */
        tk.flashT -= dt;
        const k = Math.max(0, tk.flashT)/0.12;
        tk.flash.scale.set(0.5 + k*0.7, 0.5 + k*0.7, 0.4 + k*0.9);
        tk.flash.material.opacity = 0.35 + k*0.6;
        if (tk.flashT <= 0) tk.flash.visible = false;
      }
    } else {
      engineHum(0); // 无人驾驶即熄声(切模式/回菜单由 clear 兜底)
    }
    stepShells(dt); // 炮弹独立于驾驶状态(下车后仍在飞)
  }

  /* 开炮: 出膛点/初速/装填随型号(TANK_MODELS 的 muzzle 与 perf), 方向=准星;
     salvo>1 一次点射多弹(横向错位出膛 + 小散布角, 追踪弹自会汇到目标);
     装填中拒发 */
  function fire() {
    if (drivingIdx < 0) return 'nodrive';
    const tk = tanks[drivingIdx];
    const def = tk.T.model || TANK_MODELS.classic;
    if (tk.T.cool > 0) return 'cooldown';
    tk.T.cool = TankCore.specV(def.perf, 'reload');
    tk.recoil = 0.32;
    tk.flashT = 0.12; tk.flash.visible = true; tk.flash.scale.set(1.2, 1.2, 1.3);
    sfx('shoot');
    const aim = CameraRig.aim(camera);
    const T = tk.T;
    if (!def.muzzle) console.warn('TANK_MODELS[' + def.key + '] 缺 muzzle, 回落 classic 出膛点');
    const mz = def.muzzle || TANK_MODELS.classic.muzzle;
    const sp = TankCore.specV(def.perf, 'shellSpeed');
    const n = def.salvo || 1;
    const rvx = Math.cos(T.yaw); const rvz = -Math.sin(T.yaw); // 车体右向(横向错位用)
    for (let i=0; i<n; i++) {
      const lane = (i - (n - 1)/2);
      const ang = lane * 0.055; // 每档散布角(弧度), 左右对称
      const ca = Math.cos(ang); const sa = Math.sin(ang);
      const S = TankCore.mkShell(
          T.x - Math.sin(T.yaw)*mz.f + rvx*lane*0.15,
          T.y + mz.y,
          T.z - Math.cos(T.yaw)*mz.f + rvz*lane*0.15,
          (aim.dir.x*ca + aim.dir.z*sa)*sp, aim.dir.y*sp, (-aim.dir.x*sa + aim.dir.z*ca)*sp,
          def.perf);
      const lightning = !!(def.shell && def.shell.fx === 'lightning');
      const mesh = lightning ?
        new THREE.Mesh(ringGeo, ringMat(tk.modelKey)) : // 闪电环: 常亮圆环弹体
        new THREE.Mesh(shellGeo, shellMat(tk.modelKey));
      const sz = (def.shell && def.shell.size) || 1;
      const st = (def.shell && def.shell.stretch) || 1;
      mesh.scale.set(sz, sz, lightning ? sz : sz*st); // 环保持圆形(拉伸仅弹体)
      scene.add(mesh);
      shells.push({S, mesh, trailT: 0, shell: def.shell, homing: def.homing || 0, lightning});
    }
    return 'fired';
  }

  function onExplode(cb) {
    boomCb = cb;
  } /* 命中反馈钩子: 政策(表扬/计数)归模式层 */
  function protect(fn) {
    protectFn = fn;
  } /* 爆炸保护钩子: 政策(什么不可炸)归模式层 */
  function obstacle(fn) {
    obstacleFn = fn;
  } /* 炮弹障碍钩子: 政策(什么挡炮弹, 怪物身体)归模式层 */
  function targeter(fn) {
    targetFn = fn;
  } /* 索敌钩子: 追踪弹只拿坐标, 政策(谁是敌人)归模式层 */

  function toggle() {
    if (drivingIdx >= 0) {/* ---- 下车 ---- */
      const tk = tanks[drivingIdx];
      const spot = exitSpot(tk);
      pos.set(spot.x, tk.T.y, spot.z); vel.set(0, 0, 0); onGround = false;
      drivingIdx = -1;
      CameraRig.mount(null);
      lastYaw = yaw;
      return 'exited';
    }
    /* ---- 上车: 最近车在 enterR 内(距离门控在 TankCore.nearest) ---- */
    const near = TankCore.nearest(tanks.map((tk)=>tk.T), pos.x, pos.z, TANK.enterR);
    if (!near) return 'far';
    drivingIdx = tanks.findIndex((tk)=>tk.T === near);
    const tk = tanks[drivingIdx];
    const eye = ()=>({x: tk.T.x, y: tk.T.y + CAM_TANK.eye, z: tk.T.z});
    CameraRig.mount(eye); /* 相机锚源换成炮塔顶; apply 返回 0 → Avatar 隐藏 */
    lastYaw = yaw = tk.T.aimYaw;
    return 'entered';
  }

  function driving() {
    return drivingIdx >= 0;
  }

  function at() {/* 驾驶中坦克的车体状态快照(供模式层碾压/索敌), 否则 null */
    if (drivingIdx < 0) return null;
    const T = tanks[drivingIdx].T;
    return {x: T.x, y: T.y, z: T.z, yaw: T.yaw}; /* 拷贝快照: 不外泄可变物理状态(GLOSSARY 契约) */
  }

  /* 型号查询的单一回落(specV 的注册表级同伴): 未知键回落 classic 并告警。
     模式层不得手抄 `TANK_MODELS[k] || classic`(tank-range 曾三处手抄) */
  function model(key) {
    const def = TANK_MODELS[key];
    if (def) return def;
    console.warn('[Tank] 未知坦克型号 ' + key + ', 回落 classic');
    return TANK_MODELS.classic;
  }

  function nearby() {/* promptR 内最近车 {d, name} | null(供模式层提示) */
    const T = TankCore.nearest(tanks.map((tk)=>tk.T), pos.x, pos.z, TANK.promptR);
    return T ? {d: Math.hypot(T.x - pos.x, T.z - pos.z), name: (T.model && T.model.name) || '坦克'} : null;
  }

  function exitAll() {
    if (drivingIdx >= 0) {
      toggle(); engineHum(0);
    }
  }

  /* ---------- 型号像素图标 (16×16 手绘 → 64×64 dataURL, 选坦克菜单卡用;
     与怪物头像 Mobs.face 同法)。各型号同构不同色 + 一个签名细节 ---------- */
  const ICON_PAL = { // 侧视配色(炮口朝左): hull 车体 turret 炮塔 metal 炮管
    /* gun: 炮管 [x,y,w,h](长度随型号); brake:false 不画炮口制退器(发射巢) — 纯数据, icon() 只画 */
    classic: {hull: '#5a6b4a', hull2: '#6d7f58', turret: '#55703c', track: '#22261e', wheel: '#454d3e', metal: '#8a9184', detail: null},
    desert: {hull: '#c9a44e', hull2: '#d6b56a', turret: '#bfa156', track: '#2c261d', wheel: '#5d5238', metal: '#8f7c4e', detail: 'drums', gun: [0, 4, 7, 1]},
    frost: {hull: '#dce8f2', hull2: '#eef5fa', turret: '#c3d6e4', track: '#3a4652', wheel: '#6d7d8d', metal: '#9fb8c8', detail: 'plow', glow: '#9fe8ff', gun: [1, 5, 5, 2]},
    magma: {hull: '#392e28', hull2: '#4a3a30', turret: '#453530', track: '#1d1a18', wheel: '#4a4038', metal: '#57423a', detail: 'lava', glow: '#ff6a1f'},
    thunder: {hull: '#232f4e', hull2: '#31415f', turret: '#374a75', track: '#14182a', wheel: '#32405f', metal: '#3f5a8a', detail: 'neon', glow: '#39e6ff', gun: [0, 4, 7, 1]},
    tingyu: {hull: '#d14738', hull2: '#e25a4a', turret: '#c43e30', track: '#26262a', wheel: '#5d3a33', metal: '#f2efe8', detail: 'tnt', glow: '#ffb040', creep: '#4fae4f', gun: [1, 4, 4, 3], brake: false},
  };
  const iconCache = {};
  function icon(key) {
    if (iconCache[key]) return iconCache[key];
    const p = ICON_PAL[key] || ICON_PAL.classic;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const px = (x, y, w, h, col)=>{
      g.fillStyle = col; g.fillRect(x, y, w, h);
    };
    /* 炮管(朝左, 长度随型号: 沙鹰最长/冰狼最短粗/廷彧号是宽发射巢) + 炮口制退器 */
    const gun = p.gun || [0, 4, 6, 2]; // 注册表数据驱动, 缺省与 classic 一致
    px(gun[0], gun[1], gun[2], gun[3], p.metal);
    if (p.brake !== false) px(0, 3, 2, 4, p.metal); // 发射巢(brake:false)不画制退器
    /* 炮塔 + 车体 + 斜甲高光 */
    px(6, 2, 5, 1, p.hull2);
    px(5, 3, 7, 4, p.turret);
    px(3, 7, 12, 3, p.hull);
    px(3, 7, 2, 1, p.hull2);
    /* 履带与负重轮(共形) */
    px(2, 10, 13, 4, p.track);
    for (const x of [3, 5, 7, 9, 11, 13]) px(x, 11, 1, 2, p.wheel);
    /* 签名细节: 冰狼铲刃 · 沙鹰尾油桶 · 熔岩光缝 · 雷霆霓虹带 · 廷彧号 TNT 绑带+苦力怕+引信 */
    if (p.detail === 'plow') {
      px(1, 7, 1, 5, p.metal); px(1, 7, 1, 2, p.glow);
    }
    if (p.detail === 'drums') {
      px(13, 4, 2, 2, p.metal); px(13, 7, 2, 2, p.metal);
    }
    if (p.detail === 'lava') {
      px(4, 8, 2, 1, p.glow); px(8, 8, 3, 1, p.glow); px(7, 4, 2, 1, p.glow);
    }
    if (p.detail === 'neon') {
      px(3, 9, 12, 1, p.glow); px(12, 0, 1, 3, p.glow);
    }
    if (p.detail === 'tnt') {
      px(8, 7, 2, 3, '#f2efe8'); // TNT 白绑带(竖过车体)
      px(5, 3, 2, 2, p.creep); px(6, 4, 1, 1, '#14200f'); // 塔顶小苦力怕(绿身黑眼)
      px(12, 0, 1, 2, p.glow); // 引信火光
    }
    const big = document.createElement('canvas');
    big.width = big.height = 64;
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(c, 0, 0, 64, 64);
    iconCache[key] = big.toDataURL();
    return iconCache[key];
  }

  function clear() {
    if (drivingIdx >= 0) {
      drivingIdx = -1; CameraRig.mount(null);
    }
    engineHum(0);
    for (const tk of tanks) {
      scene.remove(tk.root); tk.dispose();
    }
    tanks.length = 0;
    for (const sh of shells) disposeShell(sh);
    shells.length = 0;
    /* 模式钩子(onExplode/protect/obstacle/targeter)是会话级接线, 不随清场解除:
       clear 只清实体(车/弹/驾驶位), 模式在加载时注册一次即可, 重进无需重挂 */
  }

  return {place, update, toggle, driving, at, nearby, exitAll, clear, fire,
    onExplode, protect, obstacle, targeter, icon, model};
})();
