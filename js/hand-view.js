'use strict';
/* ============================================================
   第一人称手持视图 (HandView, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   玩家视角下手与手持物的唯一渲染入口: 自建小场景+独立相机, 主场景渲染后
   清深度再画 — 手永不插墙, 与 MC GameRenderer 手部通道同构(调研 Q1)。
   本票(T2a)交付静态通道: 固定灯 handScene(环境+方向, design D4)+handCam ·
   裸臂盒建模(肤+蓝衫袖, 身份色对齐玩家皮肤色板) · 持物槽(HeldItems.swap
   换装 + def.fp 两族姿态施加, 空手=仅裸臂) · 可见性自判(第一人称且非
   驾驶) · clearDepth 渲染通道(投影每帧同步主相机)。动态四件(equip/挥击/
   bob/鼠标滞后)归 T2b, avatar 镜像与主循环接线归 T3 — 本票独立绿, 允许
   暂不上屏(静态观感 T3 合入后统一直观确认)。
   interface: setItem(id) 声明持物目标(id|null; 经 HeldItems.defFor 解析,
     同目标幂等; equip 动画 T2b 落地, 本票直换网格) / update(dt) 主循环
     每帧恰一次: 可见性自判+动画推进(T2b; 隐藏帧只推进不渲染) / render(
     renderer, camera) 恰在主渲染之后一次: 可见=清深度通道, 否则 no-op。
   依赖(均经全局名, 调用期解析): held-item.js 的 HeldItems(装载序先于本
     文件), camera-rig.js 的 CameraRig(mode 读取; mounted 按 typeof 守卫,
     getter 本体 T3 落地), lib/three.min.js(THREE 顶层装配须先载)。
   可测性: THREE 顶层装配(同 avatar.js 惯例), Node 不直测, 由
     test/boot.test.js 按 index.html 真实顺序全链冒烟; fp 姿态/swingView/
     swap 的数据形状断言归 test/held-item.test.js 直测。
   ============================================================ */
const HandView = (() => {
  /* ---------- 通道: 独立小场景 + 独立相机 (design D4, 调研 Q1) ---------- */
  /* 小场景不设雾: 正典手部贴脸, 不受距离雾影响
     (docs/mc-first-person-hand-research.md Q1.3; 主场景 fog 不外溢) */
  const handScene = new THREE.Scene();
  /* 固定灯(环境+方向): 配比对齐主场景两灯(world.js 0.65/0.75), 求与第三
     人称观感协调; 不随昼夜/世界光衰减是 design D4 刻意差异(附录 B #4,
     洞穴里手不变暗, 儿童友好)。灯位与强度=调参不判红, T3 上屏后统校。 */
  handScene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const handSun = new THREE.DirectionalLight(0xfff4e0, 0.75);
  handSun.position.set(-0.6, 1, 0.5); /* 左上前打光: 手/物朝屏面受光, 暖色同主 sun */
  handScene.add(handSun);
  const handCam = new THREE.PerspectiveCamera(72, 1, 0.05, 10);
  /* 初值不承担语义: fov/aspect/near/far 每帧从主相机同步(正典共用投影,
     调研 Q1.4); 近裁剪面正典口径 PROJECTION_Z_NEAR=0.05 仅作占位 */
  const handRoot = new THREE.Group(); /* 手部总根: T2b 的 bob/鼠标滞后施加处 */
  handScene.add(handRoot);

  /* ---------- 裸臂建模: 盒子小臂 (design D6, 调研 Q2) ----------
     盒建模(肤+蓝衫袖), 不剖官方 64×64 皮肤 UV; 身份色对齐玩家皮肤色板
     (js/mob-look/player.js 配色锚 SKIN/SHIRT)。持物时臂照画(正典
     arm+item 同栈渲染, design D6)。 */
  const ARM_SKIN = 0xf0c297; /* 肤 [240,194,151](mob-look/player.js SKIN) */
  const ARM_SHIRT = 0x4f8fdd; /* 蓝衫 [79,143,221](mob-look/player.js SHIRT) */
  const ARM_POS = [0.64, -0.6, -0.72]; /* 基座平移: 视空间 右/下/前, 正典
     renderPlayerArm 字面量 0.64/−0.6/−0.72(调研 Q2 逐行) */
  /* 肩部重定位旋转链: 正典 mulPose 代码序 rotZ120→rotX200→rotY−135(调研
     Q2) → Euler('ZXY') 一次折合 —— 矩阵积 RotZ·RotX·RotY 与 mulPose 链
     同序(后 mulPose 者套在外层)。正典另有的模型空间平移(translate(-1,
     3.6, 3.5)/translate(5.6, 0, 0))属于官方 12px 手臂枢轴系, 盒子建模不
     搬; 观感折算调参不判红, T3 上屏统校。 */
  const ARM_ROT = [200, -135, 120];
  const ARM_LEN = 0.62; /* 小臂全长(本仓库玩家臂长口径, 调研落点建议 ~0.6) */
  const ARM_THICK = 0.22; /* 断面宽(官方臂 4px=0.25 格, 贴脸观感略收细) */
  const ARM_SLEEVE = 5 / 12; /* 蓝袖占比(官方臂贴图: 蓝袖 5 行+肤色手 7 行) */
  const armRig = new THREE.Group();
  armRig.position.fromArray(ARM_POS);
  armRig.rotation.set(ARM_ROT[0] * Math.PI / 180, ARM_ROT[1] * Math.PI / 180,
      ARM_ROT[2] * Math.PI / 180, 'ZXY');
  handRoot.add(armRig);
  /* 沿臂轴(局部 Y)两段: 肤色手段(−Y 拳侧) + 蓝衫袖(+Y 肘侧); 相贴端面
     法线相向, 单视点至多见其一, 无共面闪烁 */
  const armSkin = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_THICK, ARM_LEN * (1 - ARM_SLEEVE), ARM_THICK),
      new THREE.MeshLambertMaterial({color: ARM_SKIN}));
  armSkin.position.y = -ARM_LEN * (1 - ARM_SLEEVE) / 2;
  armRig.add(armSkin);
  const armSleeve = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_THICK, ARM_LEN * ARM_SLEEVE, ARM_THICK),
      new THREE.MeshLambertMaterial({color: ARM_SHIRT}));
  armSleeve.position.y = ARM_LEN * ARM_SLEEVE / 2;
  armRig.add(armSleeve);

  /* ---------- 持物槽 (design D3: fp 姿态数据归 HeldItems, 本模块只施加) ---------- */
  /* 基点 = 正典 ITEM_POS_X/Y/Z 0.56/−0.52/−0.72(视空间 右/下/前, 格单位
     同刻度直取; 调研 Q3 关键数值清单, design D6) */
  const ITEM_POS = [0.56, -0.52, -0.72];
  const itemSlot = new THREE.Group();
  itemSlot.position.fromArray(ITEM_POS);
  handRoot.add(itemSlot);
  let heldId = null; /* 当前声明目标(幂等基线; null=空手) */
  let itemMesh = null; /* 已挂载网格(Group|null; null=空手, 只画裸臂) */

  function setItem(id) {/* 声明持物目标; 换装生命周期走 HeldItems.swap */
    const t = id || null;
    if (t === heldId) return; /* 同目标幂等(与 Avatar.setItem 同纪律) */
    heldId = t;
    const def = HeldItems.defFor(t); /* defFor 产物保证带 fp(T1 兜底); 空槽→null */
    /* equip「沉底才换网格」动画归 T2b; 本票(静态通道)直换不播动画 */
    itemMesh = HeldItems.swap(itemMesh, def);
    if (itemMesh) {/* def.fp 两族姿态 rot→pos→scale 施于视空间(design D6) */
      itemMesh.rotation.fromArray(def.fp.rot);
      itemMesh.position.fromArray(def.fp.pos);
      itemMesh.scale.setScalar(def.fp.scale);
      itemSlot.add(itemMesh);
    }
  }

  /* ---------- 可见性自判 (design D5) ----------
     camDist=0 有两义(第一人称/载具锚), 只看 mode 分不开 → 还须非驾驶。
     CameraRig.mounted 是 T3 的只读 getter: 本票按 typeof 守卫读取,
     undefined 视作未挂载; 不自加 getter(票面归 T3)。 */
  function visibleNow() {
    if (CameraRig.mode !== 0) return false;
    return !(typeof CameraRig.mounted !== 'undefined' && CameraRig.mounted);
  }

  let visible = false; /* 最近一次 update 的可见性(隐藏帧 render=no-op) */

  function update(dt) {/* 主循环每帧恰一次; T2b 的动画四件也在此推进 */
    visible = visibleNow(); /* 隐藏帧照常自判(D5: 政策是本模块内聚知识) */
  }

  function render(rn, cam) {/* 恰在 renderer.render(scene, camera) 之后一次 */
    if (!visible) return; /* 不可见帧 no-op: 零副作用可调用(boot 默认 mode 1) */
    handCam.fov = cam.fov; /* 投影每帧同步主相机(正典共用投影, 调研 Q1.4) */
    handCam.aspect = cam.aspect;
    handCam.near = cam.near;
    handCam.far = cam.far;
    handCam.updateProjectionMatrix();
    /* 清深度通道(正典 RenderSystem.clear(256)=深度位, 调研 Q1.2): 抹掉主
       场景深度再画手部小场景 → 手永不插墙; autoClear 原值进出不留痕 */
    const prevClear = rn.autoClear;
    rn.autoClear = false;
    rn.clearDepth();
    rn.render(handScene, handCam);
    rn.autoClear = prevClear;
  }

  return {setItem, update, render};
})();
