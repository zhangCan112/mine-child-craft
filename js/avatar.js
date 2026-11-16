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
   骨挂 overlay 盒四槽型——头盔=头骨挂整盒+面具前脸(额带+眼窗+护颊+
   护鼻, alphaTest 抠窗露五官) / 胸甲=身骨挂主盒+臂骨挂甲袖(正典肩甲
   语言=臂上段袖筒) / 护腿=双腿骨上 2/3 盒+髋带挂身骨 / 靴子=双腿骨下
   1/4 盒+鞋头;
   尺寸=对应骨盒 +1px, 观感=每 tier 程序生成像素贴图(底色=
   HeldItems.ARMOR_TIER_COLORS 穿戴层色板);
   同目标幂等——五槽 id 集不变即不动, 磨损只变 dur 不重建; T9 起几何
   抽件 js/armor-overlay.js 单份权威, Avatar 与纸娃娃共享, 设计稿 §9.4;
   v1.2 起与翼显隐彻底解耦——setArmor 不消费 worn.glider, 装备信号只走
   HUD/装备页槽位图标) / setWings('hidden'|'spread' 滑翔翼目标态声明,
   T-G03/UI spec v1.2 §6.4: 滑翔状态沿由模式层调用(Avatar.flash 同款
   意图 API 先例), 0.25s 过渡插值是形象层内部动作; 'spread'=以收拢
   姿态可见瞬间起 0.25s 展开, 'hidden'=0.25s 收拢、到位瞬间隐藏;
   形象层零玩法知识) / forceWingsHidden(对账兜底: 无条件立即隐藏,
   切模式/读档/死亡重生时由模式层调用, v1.2 §6.4 纪律)。
   建模与动画全部是 implementation。
   人物面向 -Z, 与玩家视线一致。
   依赖: world.js 的 scene, voxel.js 的 pos/vel/yaw/pitch/onGround/
   flyMode, config.js 的 PLAYER/CAM, held-item.js 的 HeldItems,
   hand-view.js 的 HandView(setItem/swing 镜像转发, 装载序先于本文件),
   mob-look-kit.js 的 MobLookKit(player 造型须先声明),
   armor-overlay.js 的 mkArmorOverlay(穿戴层几何抽件, 装备 T9——
   装载序先于本文件, 载入即建)。
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
  /* 滑翔翼翼骨(T-G03 形象层): 档案 wingL/wingR 双端共享, Avatar 只动
     显隐与 rotation.z; 载入即隐藏——未装备永不出现翼(§6.4 红线) */
  const wingL = puppet.bones.wingL;
  const wingR = puppet.bones.wingR;
  wingL.visible = false; wingR.visible = false;
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

  /* ---------- 穿戴层 (setArmor, 装备 T4/T9 / 设计稿 §4.3·§9.4) ----------
     骨挂 overlay 盒几何自本文件抽件(js/armor-overlay.js mkArmorOverlay,
     单份权威: Avatar 与背包面板纸娃娃共享, 尺寸/配色/幂等口径逐字平移);
     本段只持有实例并委托 apply。穿/卸即时贴身, 不走手持物装备动画
     (MC 穿戴即时口径)。 */
  /* ---------- 滑翔翼显隐与动效 (T-G03 形象层, UI spec v1.2 §6.4/§6.5) ----------
     四态机 hidden/spreading/spread/folding——v1.2 完全隐藏口径: 翼只在
     滑翔时可见(装备未滑翔=完全隐藏; folded 静止态删除——收拢烘焙仅作
     两过渡的起止姿态, §6.2)。可见性唯一驱动=模式层滑翔状态沿经
     setWings 目标态声明; 装备态不操纵翼(setArmor 与翼显隐解耦)。
     衔接语义(§6.5): 出现=以收拢姿态可见的瞬间起 0.25s 展开至水平
     (「跳下去→翅膀砰地张开」); 消失=水平收拢 0.25s, 收拢到位瞬间
     visible=false(无残影帧), 播完前翼保持可见, 不做淡出/缩放。
     动效口径不变: 单轴(axis z)线性匀速无回弹端点即停; 展平后微动
     ±0.05rad(≈2.9°)正弦双翼反相, 主周期 1.4s。 */
  const WING_SPREAD_A = Math.PI / 2; // 展平端点: 收拢竖拢旋出 90°=水平带(60°~120° 带)
  const WING_SPREAD_T = 0.25; // 展/收过渡时长(与换手装备动画 ≈0.28s 同拍长家族)
  const WING_FLAP_AMP = 0.05; // 滑翔微动幅度(§6.5 ±2.5°~3° 带内取 ≈2.9°)
  const WING_FLAP_T = 1.4; // 微动主周期(呼吸感, 不干扰第三人称读景)
  let wingState = 'hidden'; // 'hidden'|'spreading'|'spread'|'folding'(v1.2 四态)
  let wingA = 0; // 当前展角(左翼带符号; 右翼镜像取反)
  let wingFlap = 0; // 微动相位(秒, 仅 spread 态累加)

  function setWings(mode) {/* 目标态声明(v1.2 §6.4, 模式层滑翔沿):
      'spread'——hidden 起步=立即以收拢姿态可见转 spreading; folding 中
      反向续展(衔接不跳变); spreading/spread 幂等继续。
      'hidden'——spread/spreading 转 folding(0.25s 收拢, 到位瞬间隐藏);
      hidden/folding 幂等继续(folding 目标本就是 hidden)。 */
    if (mode === 'spread') {
      if (wingState === 'hidden') {
        wingState = 'spreading'; /* 过渡首帧=收拢姿态可见(§6.2 烘焙) */
        wingA = 0;
      } else if (wingState === 'folding') {
        wingState = 'spreading'; /* 从当前角续展, 不重起跳变 */
      }
    } else if (mode === 'hidden') {
      if (wingState === 'spread' || wingState === 'spreading') {
        wingState = 'folding'; /* 从当前角续收(含展开中途收) */
      }
    }
  }

  function forceWingsHidden() {/* 对账兜底(v1.2 §6.4): 无条件立即 hidden
      ——切模式/读档/死亡重生时模式层调用(滑翔态不可能跨切模式存活,
      无条件安全), 载入期亦经此归位; 残影修复同款纪律 */
    wingState = 'hidden';
    wingA = 0;
    wingFlap = 0;
    wingL.visible = false;
    wingR.visible = false;
    wingL.rotation.z = 0;
    wingR.rotation.z = 0;
  }

  function updWings(dt) {/* 每帧自驱(隐藏期间也走完, swing/equip 同惯例):
      线性匀速, 端点即停无回弹; spreading 到位入 spread, spread 微动;
      folding 收拢到位瞬间 visible=false(§6.5 无残影帧) */
    if (wingState === 'hidden') return;
    const step = dt * WING_SPREAD_A / WING_SPREAD_T;
    wingL.visible = true; /* 三活态恒可见(folding 播完前不提前隐藏) */
    wingR.visible = true;
    if (wingState === 'spreading') {
      wingA = Math.min(WING_SPREAD_A, wingA + step);
      if (wingA >= WING_SPREAD_A) wingState = 'spread';
      wingFlap = 0;
      wingL.rotation.z = wingA;
      wingR.rotation.z = -wingA; // 双翼反号镜像(几何共区, 摆位对称)
    } else if (wingState === 'folding') {
      wingA = Math.max(0, wingA - step);
      if (wingA <= 0) {/* 收拢到位瞬间隐藏(§6.5 无残影帧) */
        forceWingsHidden();
        return;
      }
      wingL.rotation.z = wingA;
      wingR.rotation.z = -wingA;
    } else {/* spread: 展平+滑翔微动(双翼反相, 一侧上摆一侧下摆) */
      wingFlap += dt;
      const a = WING_SPREAD_A + WING_FLAP_AMP * Math.sin(wingFlap * Math.PI * 2 / WING_FLAP_T);
      wingL.rotation.z = a;
      wingR.rotation.z = -a;
    }
  }

  const armorOverlay = mkArmorOverlay(puppet); // 载入即建(脚本序 armor-overlay 先于本文件)

  function setArmor(worn) {
    armorOverlay.apply(worn); /* v1.2 起与翼显隐解耦: 不消费 worn.glider
      (装备信号只走 HUD/装备页槽位图标; 翼可见性唯一驱动=模式层
      setWings, 切模式/读档对账兜底走 forceWingsHidden) */
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
    updWings(dt); /* 翼动效自驱: 隐藏期间也走完(swing/equip 同惯例) */
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

  return {update, setItem, swing, flash, setArmor, setWings, forceWingsHidden};
})();
