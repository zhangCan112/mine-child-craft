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
   全身向红插值再淡出, 传秒数) / setArmor(worn 声明目标穿戴, 装备 T4:
   骨挂 overlay 盒四槽型——头盔=头骨挂五面盒前开脸 / 胸甲=身骨挂主盒+
   双肩帽 / 护腿=双腿骨上 2/3 盒+髋带挂身骨 / 靴子=双腿骨下 1/4 盒+鞋头;
   尺寸=对应骨盒 +1px, 颜色=HeldItems.ARMOR_TIER_COLORS 穿戴层色板;
   同目标幂等——四槽 id 集不变即不动, 磨损只变 dur 不重建)。
   建模与动画全部是 implementation。
   人物面向 -Z, 与玩家视线一致。
   依赖: world.js 的 scene, voxel.js 的 pos/vel/yaw/pitch/onGround/
   flyMode, config.js 的 PLAYER/CAM, held-item.js 的 HeldItems,
   hand-view.js 的 HandView(setItem/swing 镜像转发, 装载序先于本文件),
   mob-look-kit.js 的 MobLookKit(player 造型须先声明)。
   零输入 · 零玩法知识。
   ============================================================ */
const Avatar = (() => {
  /* ---------- 建模: 官方等比人形傀儡(造型档案 player) ----------
     骨架名 ≠ 解剖学左右: 官方 bedrock 数据把 armR/legR 建在 −X 侧, 怪物
     路径经 z 镜像(+Z 朝向)后 −X 恰是解剖学右手; 玩家傀儡 −Z 原生不镜像,
     解剖学右手在 +X = 骨架名 armL(腿同理)。装配处按解剖学交换绑定
     (2026-10-26 用户反馈: 迁官方骨架后手持物落到左手), 动画/握持代码
     零改动即回右手观感; 皮肤左右对称(双臂/双腿同图), 交换无观感差。 */
  const puppet = MobLookKit.puppet('player');
  const root = puppet.root;
  /* 人物本体微缩(config PLAYER.modelScale, 缺省 1=官方等比): 0.9 时模型顶高
     32px×PX×0.9=1.8 格恰与碰撞壳同高(2026-10-28 家长反馈: 人物偏大, 门洞里
     身体挡视线)。只缩观感, 手持物挂臂骨随缩, 第一人称 HandView 独立不受影响 */
  root.scale.setScalar(PLAYER.modelScale || 1);
  const legL = puppet.bones.legR; const legR = puppet.bones.legL;
  const armL = puppet.bones.armR; const armR = puppet.bones.armL;
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
  const EQUIP_HALF = HeldItems.equipHalf; // 半程秒数(收口 held-item.js, 与 HandView 同源, design D6)
  const EQUIP_DIP = 0.2; // 下沉量(MC -0.6 格按本仓库手臂尺度折算)
  let heldTarget = null; // 落定后的手持物 id; null=空手
  let equipH = 1; // 装备高度 0..1: 1=持稳, 0=沉底(换物点)
  let equipDown = false; // 下沉中(目标已变更)

  function mountItem(id) {/* 沉底瞬间的实际装配: swap 释放旧组+mount 新 def
     (defFor 解析); swap 只 dispose 不摘父节点, 摘除旧组归施加侧 */
    armR.remove(itemMesh);
    itemDef = HeldItems.defFor(id);
    itemMesh = HeldItems.swap(itemMesh, itemDef);
    if (itemMesh) {
      itemMesh.position.fromArray(itemDef.grip.pos);
      itemMesh.position.y += ITEM_GRIP_DY;
      itemMesh.rotation.fromArray(itemDef.grip.rot);
      armR.add(itemMesh);
    }
  }

  function setItem(id) {/* 声明目标(空槽/未知 id 经 defFor 落空手) */
    HandView.setItem(id); /* 镜像转发第一人称视图(唯一漏斗, design D2) */
    const t = id || null;
    if (t === heldTarget) return;
    heldTarget = t;
    equipDown = true;
  }

  function swing() {
    HandView.swing(); /* 镜像转发第一人称挥击(design D2 无条件直调; 方法本体 T2b) */
    swingT = 0;
  } // 连点重置 = 连挥

  /* ---------- 穿戴层 (setArmor, 装备 T4 / 设计稿 §4.3) ----------
     骨挂 overlay 盒: 头盔=头骨五面盒(前开脸露五官, 正典盔甲层语言) ·
     胸甲=身骨主盒+双肩帽 · 护腿=双腿骨上 2/3 盒+髋带(挂身骨) ·
     靴子=双腿骨下 1/4 盒+鞋头。尺寸=对应骨盒(官方等比 8/12/4px, 与
     mob-look player 档案同源)各向 +1px; 位置=复制本体盒中心再按段偏移
     (数据驱动对齐, 零硬编码关节)。颜色=ARMOR_TIER_COLORS 穿戴层色板
     (held-item.js, §7.3 层板——与图标色板两套独立调色)。
     同目标幂等: 四槽 id 集不变即不动(磨损只变 dur, 不重建网格)。
     穿/卸即时贴身, 不走手持物装备动画(MC 穿戴即时口径)。 */
  const SCALE = puppet.scale; // 官方 px → 格(mob-look-kit 建模换算, 缺省 1)
  const armorMeshes = []; // [{bone, mesh}] 卸甲/换件的全量清单
  let armorSig = ''; // 当前穿戴四槽 id 签名(幂等判据; ''=空穿)

  /* 挂一只 overlay 盒: 尺寸 px×SCALE · 位置=本体盒中心 + opts 偏移(dx/dy
     段内 px) · hideFront 前脸透明(头盔开脸——BoxGeometry 材质数组 -z=index 5) */
  function addArmorBox(bone, w, h, d, color, opts) {
    opts = opts || {};
    const geo = new THREE.BoxGeometry(w * SCALE, h * SCALE, d * SCALE);
    const solid = new THREE.MeshLambertMaterial({color});
    let mesh;
    if (opts.hideFront) {
      const open = new THREE.MeshLambertMaterial({transparent: true, opacity: 0});
      mesh = new THREE.Mesh(geo, [solid, solid, solid, solid, solid, open]);
    } else {
      mesh = new THREE.Mesh(geo, solid);
    }
    const src = bone.children[0]; /* 本体盒 mesh: 位置=骨盒中心(相对关节) */
    mesh.position.copy(src.position);
    if (opts.dx) mesh.position.x += opts.dx * SCALE;
    if (opts.dy) mesh.position.y += opts.dy * SCALE;
    bone.add(mesh);
    armorMeshes.push({bone, mesh});
  }

  function setArmor(worn) {
    /* 四槽 id 签名: 槽形 {id, dur}|null → id|''(armorOf 判据单份在 items-core) */
    const sig = EQUIP_SLOTS.map((s) => (worn && worn[s] ? worn[s].id : '')).join(',');
    if (sig === armorSig) return; /* 同目标幂等(磨损/重声明不动网格) */
    armorSig = sig;
    for (const e of armorMeshes) e.bone.remove(e.mesh); /* 卸旧全量 */
    armorMeshes.length = 0;
    if (!worn) return;
    const colorOf = (id) => HeldItems.ARMOR_TIER_COLORS[armorOf(id).tier];
    const body = puppet.bones.body; /* 躯干骨(mob-look-kit 槽位 root 改名 body) */
    /* 头盔: 头盒 8×8×8 +1px → 9×9×9, 前开脸 */
    if (worn.helmet) addArmorBox(head, 9, 9, 9, colorOf(worn.helmet.id), {hideFront: true});
    /* 胸甲: 身盒 8×12×4 +1px → 主盒 9×13×5 + 双肩帽 5×2×5(顶上两角对称) */
    if (worn.chestplate) {
      const c = colorOf(worn.chestplate.id);
      addArmorBox(body, 9, 13, 5, c);
      addArmorBox(body, 5, 2, 5, c, {dx: -2.5, dy: 7});
      addArmorBox(body, 5, 2, 5, c, {dx: 2.5, dy: 7});
    }
    /* 护腿: 腿盒 4×12×4 上 2/3 → 每腿 5×9×5(段内上移对齐上部) + 髋带 9×3×5(挂身骨下缘) */
    if (worn.leggings) {
      const c = colorOf(worn.leggings.id);
      addArmorBox(legL, 5, 9, 5, c, {dy: 1});
      addArmorBox(legR, 5, 9, 5, c, {dy: 1});
      addArmorBox(body, 9, 3, 5, c, {dy: -5});
    }
    /* 靴子: 腿盒下 1/4 → 每腿 5×4×5(段内下移) + 鞋头前伸 5×2×3(-z 前) */
    if (worn.boots) {
      const c = colorOf(worn.boots.id);
      addArmorBox(legL, 5, 4, 5, c, {dy: -4});
      addArmorBox(legR, 5, 4, 5, c, {dy: -4});
      addArmorBox(legL, 5, 2, 3, c, {dy: -5});
      addArmorBox(legR, 5, 2, 3, c, {dy: -5});
    }
  }

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

  return {update, setItem, swing, flash, setArmor};
})();
