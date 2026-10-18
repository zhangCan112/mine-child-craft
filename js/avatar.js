"use strict";
/* ============================================================
   玩家形象 (Avatar, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   玩家的小探险家模型 + 行走/腾空动画 + 随相机距离显隐。
   加载即建并挂入场景(clearWorld 只清区块网格, 本模型跨模式存活);
   每帧 update(dt, camDist) 由主循环驱动, camDist 传 CameraRig.apply
   的返回值: 第一人称(0)与贴墙收拢过近时自动隐藏。
   建模与动画全部是 implementation。人物面向 -Z, 与玩家视线一致。
   依赖: world.js 的 scene, voxel.js 的 pos/vel/yaw/pitch/onGround/
   flyMode, config.js 的 PLAYER/CAM。零输入 · 零玩法知识。
   ============================================================ */
const Avatar = (()=>{
  const box = (w,h,d,color)=> new THREE.Mesh(
    new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({color}));
  /* 枢轴在顶端的肢体: 盒子垂挂 -y, 摆动绕肩/髋 */
  const limb = (w,h,d,color)=>{
    const g = new THREE.Group();
    const m = box(w,h,d,color); m.position.y = -h/2; g.add(m);
    return g;
  };

  /* ---------- 建模: 小探险家 ----------
     肤 0xf0c297 · 发 0x5a3a22 · 帽 0xe8642c/檐 0xc44f1f · 衫 0x4f8fdd
     裤 0x2e4a8f · 鞋 0x2f3238 · 背包 0xd94f4f · 五官 0x2a2a33 */
  const root = new THREE.Group();

  const legL = limb(0.21,0.52,0.22,0x2e4a8f); legL.position.set(-0.13,0.72,0);
  const legR = limb(0.21,0.52,0.22,0x2e4a8f); legR.position.set( 0.13,0.72,0);
  for(const leg of [legL,legR]){                       // 鞋: 随腿摆动, 略前突
    const s = box(0.23,0.18,0.26,0x2f3238); s.position.set(0,-0.62,-0.02); leg.add(s);
  }
  const body = box(0.52,0.68,0.30,0x4f8fdd); body.position.y = 1.04;

  const armL = new THREE.Group(); armL.position.set(-0.34,1.32,0);
  const armR = new THREE.Group(); armR.position.set( 0.34,1.32,0);
  for(const arm of [armL,armR]){                       // 蓝袖 + 肤色小手
    const sleeve = box(0.17,0.36,0.19,0x4f8fdd); sleeve.position.y = -0.18; arm.add(sleeve);
    const hand   = box(0.15,0.26,0.16,0xf0c297); hand.position.y   = -0.47; arm.add(hand);
  }
  /* 背包(背面 +Z) + 背带 */
  const bag = box(0.34,0.40,0.15,0xd94f4f); bag.position.set(0,1.10,0.245); root.add(bag);
  const strap = box(0.46,0.06,0.02,0x8a3232); strap.position.set(0,1.30,0.16); root.add(strap);

  /* 头(枢轴在颈 1.38): 脸朝 -Z */
  const head = new THREE.Group(); head.position.y = 1.38;
  const skull = box(0.46,0.46,0.46,0xf0c297); skull.position.y = 0.23; head.add(skull);
  const eL = box(0.09,0.10,0.03,0x2a2a33); eL.position.set(-0.10,0.27,-0.235); head.add(eL);
  const eR = box(0.09,0.10,0.03,0x2a2a33); eR.position.set( 0.10,0.27,-0.235); head.add(eR);
  const smile = box(0.12,0.035,0.03,0x2a2a33); smile.position.set(0,0.13,-0.235); head.add(smile);
  const cL = box(0.07,0.05,0.02,0xf5a08c); cL.position.set(-0.165,0.19,-0.235); head.add(cL);
  const cR = box(0.07,0.05,0.02,0xf5a08c); cR.position.set( 0.165,0.19,-0.235); head.add(cR);
  const hairBack  = box(0.48,0.30,0.12,0x5a3a22); hairBack.position.set(0,0.28, 0.20); head.add(hairBack);
  const hairFront = box(0.48,0.10,0.08,0x5a3a22); hairFront.position.set(0,0.40,-0.22); head.add(hairFront);
  const capTop  = box(0.50,0.15,0.50,0xe8642c); capTop.position.set(0,0.46,0); head.add(capTop);
  const capBrim = box(0.44,0.05,0.20,0xc44f1f); capBrim.position.set(0,0.40,-0.31); head.add(capBrim);

  root.add(legL, legR, body, armL, armR, head);
  scene.add(root);                     // 加载即挂: 跨模式存活, 主菜单背景也可见

  /* ---------- 动画 ---------- */
  let walkT = 0;
  function update(dt, camDist){
    root.visible = camDist > CAM.hideDist;
    if(!root.visible) return;          // 隐藏时省去全部动画

    root.position.set(pos.x, pos.y, pos.z);
    root.rotation.y = yaw;
    head.rotation.x = Math.max(-1.1, Math.min(1.1, pitch));   // 头随视线俯仰

    const hs = Math.hypot(vel.x, vel.z);
    const w  = Math.min(1, hs/PLAYER.speed);          // 步频/幅度随速度
    walkT += dt * (2 + hs*1.6);
    if(onGround){
      const sw = Math.sin(walkT) * 0.6 * w;
      legL.rotation.x =  sw;              legR.rotation.x = -sw;
      armL.rotation.x = -sw*0.85;         armR.rotation.x =  sw*0.85;
      armL.rotation.z = 0.05;             armR.rotation.z = -0.05;
    } else {
      const drift = flyMode ? Math.sin(walkT*0.7)*0.12 : 0;   // 飞行时腿轻晃
      legL.rotation.x =  0.35 + drift;    legR.rotation.x = -0.20 - drift;
      armL.rotation.x = -0.45;            armR.rotation.x = -0.45;
      armL.rotation.z =  0.50;            armR.rotation.z = -0.50;
    }
  }

  return { update };
})();
