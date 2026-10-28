'use strict';
/* ============================================================
   第一人称手持视图 (HandView, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   玩家视角下手与手持物的唯一渲染入口: 自建小场景+独立相机, 主场景渲染后
   清深度再画 — 手永不插墙, 与 MC GameRenderer 手部通道同构(调研 Q1);
   动态四件(equip/挥击/走路 bob/鼠标滞后)全部在本模块推进, 隐藏帧照常
   走完只不渲染(design D5/D6)。
   interface: setItem(id) 声明持物目标(id|null; 经 HeldItems.defFor 解析,
     同目标幂等; 目标变更走「下沉-换-抬起」equip 动画, 沉底经 HeldItems.
     swap 换网格, 空手同走) / swing() 触发一次第一人称挥击(连触发=连挥;
     HeldItems.swingView 原样施加, 曲线不改造) / update(dt) 主循环每帧
     恰一次: 推进动画+可见性自判(隐藏帧只推进不渲染) / render(renderer,
     camera) 恰在主渲染之后一次: 可见=清深度通道, 否则 no-op。
   依赖(均经全局名, 调用期解析): held-item.js 的 HeldItems(装载序先于本
     文件), camera-rig.js 的 CameraRig(mode 读取; mounted 按 typeof 守卫,
     getter 本体 T3 落地), voxel.js 的 vel/onGround/yaw/pitch(bob 与鼠标
     滞后自读, 引擎同侪合法), config.js 的 PLAYER(speed 步频归一),
     lib/three.min.js(THREE 顶层装配须先载)。
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
  const handRoot = new THREE.Group(); /* 手部总根: bob 平移+鼠标滞后旋转施放处 */
  handScene.add(handRoot);

  /* ---------- 动态四件常数 (design D6 口径, 出处逐条标注; 调参不判红) ---------- */
  const EQUIP_HALF = 0.14; /* 半程秒数: 与 Avatar EQUIP_HALF 同值, 两层同拍(design D6) */
  const EQUIP_DIP = 0.6; /* 下沉量(格): 正典 ITEM_HEIGHT_SCALE/ARM_HEIGHT_SCALE
     = −0.6 视空间直取, 纯 y 轴无旋转(调研 Q5, design D6) */
  const LAG_FACTOR = 0.1; /* 鼠标滞后施加系数: 正典 (视角−平滑)×0.1(调研 Q1.5
     逐行确证)。本仓库 pitch 正=抬头/yaw 正=左转, 与 MC 角度约定两轴皆
     反向, 施加式折算为 (平滑−视角)×0.1 — 观感同为「快速甩视角手追上来」 */
  const LAG_RATE = 20 * Math.LN2; /* 平滑追赶速率(1/s): 正典 xBob 以 0.5/tick
     追视线角@20TPS 的连续等价; 平滑内部调研未逐行确证, 本地口径 */
  const BOB_X = 0.02; /* bob 椭圆横摆半径(格): 幅度常数模块本地(design D6:
     装配常数, 非物品数据非玩法政策, 不入 config), 量级=小幅观感起点 */
  const BOB_Y = 0.03; /* bob 椭圆纵沉半径(格): 正典 y=−|cos| 项深于横摆的
     观感折算(调研 Q6: bobView 公式未逐行确证, 形状照 sin/|cos| 家族) */
  const BOB_EASE = 8; /* bob 幅度门控起落平滑速率(1/s): 离地收平/落地渐起,
     模块本地(调参不判红) */
  let equipH = 1; /* 装备高度 1..0: 1=持稳, 0=沉底(换网点); 同 Avatar 口径 */
  let equipDown = false; /* 下沉中(setItem 目标已变更; 空手(null)同走 equip,
     正典 equipProgress 与物品空否无关, 调研 Q5) */
  let swingT = -1; /* <0 空闲; >=0 已挥出秒数(连点重置=连挥, 同 Avatar) */
  let heldDef = null; /* 沉底装配后的当前 def(null=空手; swing dur 沿它的) */
  let bobPhase = 0; /* 步频相位(与 Avatar walkT 同节奏) */
  let bobW = 0; /* bob 幅度门控 0..1(onGround+速度平滑起落) */
  let lagYaw = null; /* 平滑视线角 yaw(null=未初始化, 首帧对齐当前视角) */
  let lagPitch = null; /* 平滑视线角 pitch(同上) */

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
  const armSwing = new THREE.Group(); /* 裸臂挥击枢轴: swingView 位移并入基点
     平移、转角绕基点施加(正典序: 挥击偏移随基座 translate 之后再 mulPose
     旋转, 调研 Q2); equip 下沉同并入基点(正典 ARM_HEIGHT_SCALE 同值) */
  armSwing.position.fromArray(ARM_POS);
  handRoot.add(armSwing);
  const armRig = new THREE.Group();
  armRig.rotation.set(ARM_ROT[0] * Math.PI / 180, ARM_ROT[1] * Math.PI / 180,
      ARM_ROT[2] * Math.PI / 180, 'ZXY');
  armSwing.add(armRig);
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
  const itemSlot = new THREE.Group(); /* 持物槽兼挥击枢轴: swingView 与裸臂
     枢轴同款施加(位移并入基点、转角绕基点), arm+item 同栈挥动 */
  itemSlot.position.fromArray(ITEM_POS);
  handRoot.add(itemSlot);
  let heldId = null; /* 当前声明目标(幂等基线; null=空手) */
  let itemMesh = null; /* 已挂载网格(Group|null; null=空手, 只画裸臂) */

  function mountItem() {/* 沉底瞬间的实际装配: HeldItems.swap 释放旧+挂新 */
    heldDef = HeldItems.defFor(heldId); /* defFor 产物保证带 fp(T1 兜底); 空槽→null */
    itemMesh = HeldItems.swap(itemMesh, heldDef);
    if (itemMesh) {/* def.fp 两族姿态 rot→pos→scale 施于视空间(design D6) */
      itemMesh.rotation.fromArray(heldDef.fp.rot);
      itemMesh.position.fromArray(heldDef.fp.pos);
      itemMesh.scale.setScalar(heldDef.fp.scale);
      itemSlot.add(itemMesh);
    }
  }

  function setItem(id) {/* 声明持物目标; 目标变更只标记下沉, 沉底才换网格 */
    const t = id || null;
    if (t === heldId) return; /* 同目标幂等(与 Avatar.setItem 同纪律) */
    heldId = t;
    equipDown = true; /* 走「下沉-换-抬起」(MC 口径); 连续切换从当前高度续沉 */
  }

  function swing() {/* 触发一次挥击: 连点重置=连挥(同 Avatar); 连挖/连放由
     上游逐帧重触发自动成连续循环(正典 continueAttack 每 tick swing 同义,
     调研 Q3) */
    swingT = 0;
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
  const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a)); /* yaw 环绕差(±π) */

  function update(dt) {/* 主循环每帧恰一次; 隐藏帧动画照常推进(D5「隐藏期间
     也走完」, 与 Avatar 同纪律), 只是 render 走 no-op */
    visible = visibleNow(); /* 隐藏帧照常自判(D5: 政策是本模块内聚知识) */
    /* equip: 下沉→沉底换网格→抬起; 连续切换从当前高度续沉(同 Avatar) */
    if (equipDown || equipH < 1) {
      if (equipDown) {
        equipH -= dt / EQUIP_HALF;
        if (equipH <= 0) {
          equipH = 0;
          equipDown = false;
          mountItem(); /* 沉底才换网格(MC 口径, 姐妹调研 Q4) */
        }
      } else {
        equipH = Math.min(1, equipH + dt / EQUIP_HALF);
      }
    }
    if (swingT >= 0) swingT += dt; /* 挥击推进; 施加处在下方按 dur 收拍 */
    /* 走路 bob: 步频相位随水平速度(与 Avatar walkT 同节奏; vel/onGround
       引擎同侪自读, design D6), 幅度门控随 onGround/速度平滑起落 */
    const hs = Math.hypot(vel.x, vel.z);
    bobPhase += dt * (2 + hs * 1.6);
    bobW += ((onGround ? Math.min(1, hs / PLAYER.speed) : 0) - bobW) *
        Math.min(1, dt * BOB_EASE);
    /* 鼠标滞后: 平滑视线角追视角角(yaw 走环绕差防 ±π 跳变), 施加处取
       (平滑−视角)×LAG_FACTOR(符号折算见常数注) */
    if (lagYaw === null) {/* 首帧对齐: 平滑角从当前视角起算, 不甩初始跳变 */
      lagYaw = yaw;
      lagPitch = pitch;
    }
    const kLag = Math.min(1, dt * LAG_RATE);
    lagYaw += wrapPi(yaw - lagYaw) * kLag;
    lagPitch += (pitch - lagPitch) * kLag;
    /* 施加四件于组层级(自外向内=正典序): 总根 bob 平移(正典共享矩阵层,
       在滞后旋转之外) → 总根滞后旋转(xBob 层) → 两支枢轴把挥击偏移与
       equip 下沉并入基座平移、挥击转角绕基点(swingView 原样施加, 曲线
       不改造 — 端点归零不变量由 held-item.test.js 锁死) */
    let sv = null;
    if (swingT >= 0) {
      const d = heldDef || HeldItems.bare; /* dur/amp 沿当前 def, 空手走 bare 档 */
      if (swingT >= d.swing.dur) swingT = -1; /* 挥完收拍(端点归零无缝衔接) */
      else sv = HeldItems.swingView(swingT / d.swing.dur, d);
    }
    const px = sv ? sv.px : 0;
    const py = sv ? sv.py : 0;
    const pz = sv ? sv.pz : 0;
    const rx = sv ? sv.rx : 0;
    const ry = sv ? sv.ry : 0;
    const sink = EQUIP_DIP * (1 - equipH); /* progress=1−高度, 正典 −0.6×progress */
    handRoot.position.set(Math.sin(bobPhase) * BOB_X * bobW,
        -Math.abs(Math.cos(bobPhase)) * BOB_Y * bobW, 0);
    handRoot.rotation.set((lagPitch - pitch) * LAG_FACTOR,
        wrapPi(lagYaw - yaw) * LAG_FACTOR, 0);
    armSwing.position.set(ARM_POS[0] + px, ARM_POS[1] + py + sink, ARM_POS[2] + pz);
    armSwing.rotation.set(rx, ry, 0);
    itemSlot.position.set(ITEM_POS[0] + px, ITEM_POS[1] + py + sink, ITEM_POS[2] + pz);
    itemSlot.rotation.set(rx, ry, 0);
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

  return {setItem, swing, update, render};
})();
