'use strict';
/* ============================================================
   玩家形象 (Avatar, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   玩家的小探险家模型 + 行走/腾空动画 + 手持物装配与挥击 + 随相机距离显隐。
   建模 = 造型档案(MobLookKit.puppet('player'), js/mob-look/player.js):
   官方 8/12/12px 等比人形(旧 Q 版盒子建模退役), 身份件(橙帽/背包/蓝衫/
   五官)全部画进 64×64 皮肤 — 傀儡 −Z 原生朝向与玩家视线一致, 怪物走
   +Z 镜像合批, 同一份数据源的两个 adapter(docs/mob-look-design.md)。
   加载即建并挂入场景(clearWorld 只清区块网格, 本模型跨模式存活);
   每帧 update(dt, camDist) 由主循环驱动, camDist 传 CameraRig.apply
   的返回值: 第一人称(0)与贴墙收拢过近时自动隐藏(手持物随之隐藏)。
   interface: update / setItem(id|null 声明手持目标——观感经 HeldItems.defFor
   解析: 工具/方块/薄片/空手; 换物走「下沉-换-抬起」装备动画, MC 口径
   沉到底才换网格, 连续切换从当前高度续沉不跳变) / swing(挥一次右臂,
   连点连挥, 对空也挥; 与装备动画独立叠加互不打断) / flash(受击闪红:
   全身向红插值再淡出, 传秒数)。
   建模与动画全部是 implementation。
   人物面向 -Z, 与玩家视线一致。
   依赖: world.js 的 scene, voxel.js 的 pos/vel/yaw/pitch/onGround/
   flyMode, config.js 的 PLAYER/CAM, held-item.js 的 HeldItems,
   mob-look-kit.js 的 MobLookKit(player 造型须先声明)。
   零输入 · 零玩法知识。
   ============================================================ */
const Avatar = (() => {
  /* ---------- 建模: 官方等比人形傀儡(造型档案 player) ---------- */
  const puppet = MobLookKit.puppet('player');
  const root = puppet.root;
  const legL = puppet.bones.legL; const legR = puppet.bones.legR;
  const armL = puppet.bones.armL; const armR = puppet.bones.armR;
  const head = puppet.bones.head;
  scene.add(root); // 加载即挂: 跨模式存活, 主菜单背景也可见

  /* ---------- 受击闪红: 材质向红插值再淡出 ----------
     傀儡共用一张皮肤材质(贴图 × color), 端点从白精确还原, 无累计漂移。 */
  const FLASH_RED = new THREE.Color(0xe83a2a);
  const bodyMats = [{mat: puppet.material, base: puppet.material.color.clone()}];
  let flashT = -1; // <0 空闲; >=0 剩余闪红秒数

  /* ---------- 动画 ---------- */
  let walkT = 0;

  /* ---------- 手持物 (HeldItems) + 挥击 + 装备动画 ----------
     setItem: 声明目标手持物(id/null; 同目标幂等), 实际换网格在装备
     动画沉底瞬间(mountItem); swing: 触发一次右臂挥击。
     握持姿态在 armR 手部枢轴上施加; mesh 是 Avatar 唯一外部可见物。
     官方臂长 12px(旧 Q 版 ~10px), 握持点随之下移补偿(ITEM_GRIP_DY)。 */
  const ITEM_GRIP_DY = -0.16; // 手部枢轴下移补偿(官方等比手臂更长)
  let itemMesh = null; let itemDef = null;
  let swingT = -1; // <0 空闲; >=0 已挥出秒数

  /* 装备动画(MC 口径, docs/mc-held-item-render-research.md Q4):
     高度 equipH 1→0 下沉, 沉底换物, 0→1 抬起; 目标变更从当前高度
     续沉(mainHandHeight ±0.4/tick 的折算, 全程 ≈0.28s)。 */
  const ARM_R_Y0 = armR.position.y; // 右臂基高(下沉基准, 官方肩枢轴 22px)
  const EQUIP_HALF = 0.14; // 半程秒数
  const EQUIP_DIP = 0.2; // 下沉量(MC -0.6 格按本仓库手臂尺度折算)
  let heldTarget = null; // 落定后的手持物 id; null=空手
  let equipH = 1; // 装备高度 0..1: 1=持稳, 0=沉底(换物点)
  let equipDown = false; // 下沉中(目标已变更)

  function mountItem(id) {/* 沉底瞬间的实际装配: 旧网格释放, defFor 解析新 def */
    if (itemMesh) {
      armR.remove(itemMesh);
      itemMesh.traverse((o)=>{
        if (o.isMesh) {
          o.geometry.dispose(); o.material.dispose();
        }
      });
      itemMesh = null;
    }
    itemDef = HeldItems.defFor(id);
    if (itemDef) {
      itemMesh = HeldItems.mount(itemDef);
      itemMesh.position.fromArray(itemDef.grip.pos);
      itemMesh.position.y += ITEM_GRIP_DY;
      itemMesh.rotation.fromArray(itemDef.grip.rot);
      armR.add(itemMesh);
    }
  }

  function setItem(id) {/* 声明目标(空槽/未知 id 经 defFor 落空手) */
    const t = id || null;
    if (t === heldTarget) return;
    heldTarget = t;
    equipDown = true;
  }

  function swing() {
    swingT = 0;
  } // 连点重置 = 连挥

  function flash(d) {
    flashT = d;
  } // 受击闪红(模式层意图 API, 观感)

  function update(dt, camDist) {
    if (swingT >= 0) swingT += dt; // 隐藏期间也推进, 恢复可见不接旧挥击
    /* 装备动画(隐藏期间也走完, 同 swing 口径) */
    if (equipDown || equipH < 1) {
      if (equipDown) {
        equipH -= dt / EQUIP_HALF;
        if (equipH <= 0) {
          equipH = 0;
          equipDown = false;
          mountItem(heldTarget); // 沉底才换网格(MC 口径)
        }
      } else {
        equipH = Math.min(1, equipH + dt / EQUIP_HALF);
      }
    }
    armR.position.y = ARM_R_Y0 - EQUIP_DIP * (1 - equipH); // 下沉随进度加深, 归位精确回基高
    if (flashT >= 0) { // 闪红同理: 隐藏期间走完, 恢复即基色
      flashT -= dt;
      const k = Math.max(0, Math.min(1, flashT/0.3));
      for (const e of bodyMats) e.mat.color.copy(e.base).lerp(FLASH_RED, k*0.9);
      if (flashT < 0) for (const e of bodyMats) e.mat.color.copy(e.base);
    }
    root.visible = camDist > CAM.hideDist;
    if (!root.visible) return; // 隐藏时省去全部动画

    root.position.set(pos.x, pos.y, pos.z);
    root.rotation.y = yaw;
    head.rotation.x = Math.max(-1.1, Math.min(1.1, pitch)); // 头随视线俯仰

    const hs = Math.hypot(vel.x, vel.z);
    const w = Math.min(1, hs/PLAYER.speed); // 步频/幅度随速度
    walkT += dt * (2 + hs*1.6);
    if (onGround) {
      const sw = Math.sin(walkT) * 0.6 * w;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw*0.85; armR.rotation.x = sw*0.85;
      armL.rotation.z = 0.05; armR.rotation.z = -0.05;
    } else {
      const drift = flyMode ? Math.sin(walkT*0.7)*0.12 : 0; // 飞行时腿轻晃
      legL.rotation.x = 0.35 + drift; legR.rotation.x = -0.20 - drift;
      armL.rotation.x = -0.45; armR.rotation.x = -0.45;
      armL.rotation.z = 0.50; armR.rotation.z = -0.50;
    }

    /* 手持物层, 优先级 挥击 > 走路摆臂 > 待机呼吸。
       加法式叠加: swingPose 端点归零, 边界自动连续, 无混合状态机。 */
    const d = itemDef || HeldItems.bare;
    if (swingT >= 0) {
      if (swingT >= d.swing.dur) swingT = -1;
      else {
        const s = HeldItems.swingPose(swingT / d.swing.dur, d);
        armR.rotation.x += s.x;
        armR.rotation.z += s.z;
      }
    } else {
      const b = Math.sin(walkT*0.55) * d.sway.idle * (1 - w); // 待机双臂轻浮(地面/空中一致)
      armL.rotation.x += b; armR.rotation.x += b;
    }
  }

  return {update, setItem, swing, flash};
})();
