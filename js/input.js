'use strict';
/* ============================================================
   输入:指针锁(桌面) / 触屏(平板) 双路径 + 模式路由
   ------------------------------------------------------------
   触屏按 MC 基岩版新触控(1.19.50+ 默认方案)重设计,
   调研依据见 docs/mc-touch-controls-research.md;
   按钮策略按用户拍板(2026-10-24 pinpoint 备注)调整:
   · 左下动态摇杆(跟手出现, 静息停默认位; 推满向前=疾跑)
   · 画布(摇杆区外): 轻点=放置/交互(作用于指尖) · 拖动=视角;
     长按无动作(分类保留防误触) — 挖掘/攻击走显式按钮
   · ⛏️ 主动作键(holdAct): 按下打/挖(准星有怪打怪, 瞄准方块
     挖掘), 按住连挖(onHold), 松手停
   · 右侧跳跃大键(按住连跳; 飞行中=上升), 飞行时下箭头=下降
     (上下文出现); 常用动作条(右缘) + rare 顶部小键区(低频键)
   · 菜单类按钮固定顶部一行(暂停/视角)
   按钮图标经 Input.icon seam 注入(图标名→dataURL 解析器, 由按钮
   像素图标工坊 button-icons.js 提供): 引擎不反向依赖应用层图标库,
   未注入时按钮回落中文文案 — 与路由 seam 同一依赖倒置口径。
   模式路由经 Input seam 注入(依赖倒置): 本文件属引擎层, 不反向
   依赖应用层的 MODES/onLockChanged — main.js 加载时注入
   Input.route / Input.onLockChange, 未注入时静默(可独立加载)。
   interface: keys/touchMove/touchSprint · Input{route,onLockChange,
   holdPt,icon} · requestLock/uiPause/setTouchActions/refreshTouchUI
   依赖(均经全局名, 调用期解析): config.js 的 IS_TOUCH/PLAYER ·
   world.js 的 renderer/yaw/pitch · voxel.js 的 flyMode ·
   camera-rig.js 的 CameraRig · touch-core.js 的 mkTouchGestures ·
   effects.js 的 showToast(挥击反馈) · avatar.js 的 Avatar
============================================================ */
const keys = {};
let locked = false;

/* 触屏状态(检测口径统一在 config.js 的 IS_TOUCH) */
let touchPlaying = false; // 触屏下的"进行中"等价于 locked
const touchMove = {x: 0, y: 0}; // 摇杆向量 (-1..1)
let touchSprint = false;
let lastTouchT = 0; // 抑制触屏合成的鼠标事件

/* 模式路由 seam: route = MODES(有 .cur 与各 on* 钩子), onLockChange = 指针锁回调;
   holdPt = 触屏长按的屏幕点 {x,y}|null — 探险挖掘进度环等消费方读它把
   反馈画到指尖(MC 口径: 进度图形跟手), 引擎自身不解释它;
   icon = 按钮像素图标解析器(名字→dataURL, 见 button-icons.js) —
   main.js 组合根注入, 引擎层不依赖应用层图标库 */
const Input = {route: null, onLockChange: null, holdPt: null, icon: null};

function requestLock() {
  if (IS_TOUCH) {
    touchPlaying = true;
    holdClear();
    document.getElementById('overlay').style.display = 'none';
    return;
  }
  renderer.domElement.requestPointerLock();
}
/* 暂停/回菜单 (Esc 等价, 触屏可用) */
function uiPause() {
  holdClear();
  if (document.pointerLockElement) {
    document.exitPointerLock();
  } else {
    touchPlaying = false;
    if (Input.onLockChange) Input.onLockChange(false);
  }
}

document.addEventListener('pointerlockchange', ()=>{
  locked = (document.pointerLockElement === renderer.domElement);
  if (Input.onLockChange) Input.onLockChange(locked);
});

document.addEventListener('mousemove', (e)=>{
  if (!locked) return;
  const s = 0.0022;
  yaw -= e.movementX * s;
  pitch -= e.movementY * s;
  pitch = Math.max(-1.55, Math.min(1.55, pitch));
});

/* ---------- 键盘 ---------- */
document.addEventListener('keydown', (e)=>{
  keys[e.code] = true;
  if (!locked && !touchPlaying) return;
  if (e.code==='KeyV' || e.code==='KeyC') { // 视角切换(不用 F5: 留给浏览器刷新)
    showToast('📷 视角：' + CameraRig.cycle());
    return;
  }
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    const M = Input.route;
    if (M && M.cur && M.cur.onDigit) M.cur.onDigit(n);
  }
  {const M = Input.route; if (M && M.cur && M.cur.onKey) M.cur.onKey(e.code);}
});
document.addEventListener('keyup', (e)=>{
  keys[e.code] = false;
});

document.addEventListener('wheel', (e)=>{
  if (!locked && !touchPlaying) return;
  const M = Input.route;
  if (M && M.cur && M.cur.onWheel) M.cur.onWheel(e.deltaY>0 ? 1 : -1);
});

/* ---------- 鼠标 (触屏合成事件会被抑制) ---------- */
document.addEventListener('contextmenu', (e)=> e.preventDefault());
renderer.domElement.addEventListener('click', ()=>{
  if (IS_TOUCH || locked) return;
  requestLock();
});
/* 准星点击统一入口(桌面 mousedown 与触屏手势共用):
   aim → raycast → 手持物挥击 → 分发模式。挥臂是纯手部反馈,
   不含命中判定(挖/放/对空一致 — 按共识收在输入层一处, 全模式统一)。
   aim() 被 holdAim 覆盖时自动指指尖(触屏轻点/长按的落点)。 */
function aimClick(button) {
  const aim = CameraRig.aim(camera);
  const hit = raycastVoxel(aim.origin, aim.dir, PLAYER.reach);
  if (button === 0 || button === 2) Avatar.swing();
  const M = Input.route;
  if (M && M.cur && M.cur.onMouse) M.cur.onMouse(button, hit);
}

renderer.domElement.addEventListener('mousedown', (e)=>{
  if (performance.now() - lastTouchT < 600) return; // 触屏合成鼠标事件, 忽略
  if (!locked) return;
  aimClick(e.button);
});

/* ============================================================
   触屏: 手势路由(tap/drag) + 动态摇杆 + 按钮系统
   ------------------------------------------------------------
   手势分类状态机在 touch-core.js(纯核心, 有单测)。
   用户拍板(2026-10-24 pinpoint 备注): 挖掘/攻击收进显式 ⛏️ 主动作键
   (holdAct: 按下=打/挖起步, 按住=连挖, 松手=停), 画布长按无动作
   (hold 分类保留——防静置手指被误判轻点)。
   轻点=放置/交互(作用于指尖) · 拖动=视角 不变。
   按钮分两区: 常用动作条(右缘, 拇指区) + rare 顶部小键区
   (🎒🏠 等低频键不占操作区)。
============================================================ */
const tGest = mkTouchGestures({holdMs: 250, moveTolPx: 12}); /* 250ms 对齐探险 TNT 短按窗口 */
let holdActive = false; /* 主动作键按住中(holdClear 幂等用) */

function viewportPt(x, y) {
  return {x, y, w: innerWidth, h: innerHeight};
}
/* 轻点屏幕点注入: CameraRig 指尖射线(点哪放哪) + Input.holdPt(瞬态) */
function setHoldPt(pt) {
  Input.holdPt = pt;
  CameraRig.holdAim(pt ? viewportPt(pt.x, pt.y) : null);
}
/* 收按钮按住的场(暂停/退出模式兜底; 未激活时静默) */
function holdClear() {
  if (!holdActive) return;
  holdActive = false;
  const M = Input.route;
  if (M && M.cur && M.cur.onHold) M.cur.onHold(false);
}

/* 手势事件 → 行为: 轻点=放置/交互(指尖) · 拖动=视角;
   长按三事件(holdstart/holdmove/holdend)当前无动作, 显式忽略 */
function touchDispatch(evs) {
  for (const ev of evs) {
    if (ev.type === 'dragmove') {
      const s = 0.0045;
      yaw -= ev.dx * s;
      pitch -= ev.dy * s;
      pitch = Math.max(-1.55, Math.min(1.55, pitch));
    } else if (ev.type === 'tap') {
      lastTouchT = performance.now();
      setHoldPt({x: ev.x, y: ev.y}); /* 一帧性覆盖: aimClick 的射线穿过指尖 */
      aimClick(2);
      setHoldPt(null);
    }
  }
}

/* 画布 = 摇杆区外的全部区域: 手势都从这进(摇杆区独立 div 截流, 不达画布)。
   鼠标指针仅在桌面常态(IS_TOUCH=false)走原指针锁路径; 触屏环境
   (含 ?touch=1 桌面强制预览)下鼠标当手指驱动手势 — 预览/蓝牙鼠标皆可操作 */
renderer.domElement.addEventListener('pointerdown', (e)=>{
  if (e.pointerType === 'mouse' && !IS_TOUCH) return;
  lastTouchT = performance.now();
  tGest.down(e.pointerId, e.clientX, e.clientY, performance.now());
});
addEventListener('pointermove', (e)=>{
  if (!tGest.has(e.pointerId)) return;
  touchDispatch(tGest.move(e.pointerId, e.clientX, e.clientY));
});
const gestUp = (e)=>{
  if (!tGest.has(e.pointerId)) return;
  touchDispatch(tGest.up(e.pointerId, e.clientX, e.clientY, performance.now()));
};
addEventListener('pointerup', gestUp);
addEventListener('pointercancel', gestUp);

/* ---------- 虚拟摇杆 + 动作按钮 ---------- */
let touchBuilt = false;
/* 按钮 glyph: seam 有图标则像素图, 否则回落中文文案(aria 恒在) */
function btnGlyph(id, iconKey, label) {
  const url = (Input.icon && Input.icon(iconKey)) || '';
  return '<button id="' + id + '" aria-label="' + label + '">' +
      (url ? '<img alt="" draggable="false" src="' + url + '">' : label) + '</button>';
}
function buildTouchUI() {
  if (touchBuilt) return;
  touchBuilt = true;
  const root = document.createElement('div');
  root.id = 'touchUI';
  root.innerHTML = '<div id="joyZone"><div id="joy"><div id="joyKnob"></div></div></div>' +
    '<div id="touchActs"></div>' +
    '<div id="touchTop"></div>' +
    btnGlyph('touchJump', 'jump', '跳跃') +
    btnGlyph('touchDown', 'down', '下降') +
    btnGlyph('touchCam', 'cam', '视角') +
    btnGlyph('touchPause', 'pause', '暂停');
  document.body.appendChild(root);
  document.getElementById('touchPause').onpointerdown = (e)=>{
    e.preventDefault(); uiPause();
  };
  document.getElementById('touchCam').onpointerdown = (e)=>{
    e.preventDefault(); showToast('📷 视角：' + CameraRig.cycle());
  };
  holdKeyBtn(document.getElementById('touchJump'), 'Space');
  holdKeyBtn(document.getElementById('touchDown'), 'ShiftLeft');
  buildJoy();
}

/* 按住型按钮(跳跃/下降): 按下=键落, 抬起=键起(MC 按住连跳口径)。
   指针捕获: 手指在键上小幅滑动不松键(儿童手抖宽容), 真正抬起才放 */
function holdKeyBtn(el, code) {
  el.onpointerdown = (e)=>{
    e.preventDefault(); lastTouchT = performance.now();
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) { }
    keys[code] = true;
  };
  const off = ()=>{
    keys[code] = false;
  };
  el.onpointerup = el.onpointercancel = off;
}

/* 动态摇杆(MC 新触控口径: 静息停在默认位, 按下处起杆跟手):
   左下 zone 独立 div — 落在 zone 的指针只管移动, 不进画布手势 */
function buildJoy() {
  const zone = document.getElementById('joyZone');
  const joy = document.getElementById('joy');
  const knob = document.getElementById('joyKnob');
  const R = 66; /* 摇杆半径(px, 与 css 尺寸对齐) */
  const JOY_HOME = {left: 26, bottom: 96}; /* 静息默认位(贴近旧行为, 拇指起手区) */
  let joyId = null;
  let homeXY = null;

  function joyHome() {
    joy.style.left = JOY_HOME.left + 'px';
    joy.style.bottom = JOY_HOME.bottom + 'px';
    joy.style.top = 'auto';
    knob.style.transform = 'translate(-50%,-50%)';
    touchMove.x = touchMove.y = 0;
    touchSprint = false;
  }
  /* 跟手起杆: 杆心=按下点(贴边内收, 杆圈不越屏) */
  function joyAt(x, y) {
    const pad = R + 8;
    const cx = Math.max(pad, Math.min(innerWidth * 0.5, x));
    const cy = Math.max(pad, Math.min(innerHeight - pad, y));
    joy.style.left = (cx - R) + 'px';
    joy.style.top = (cy - R) + 'px';
    joy.style.bottom = 'auto';
    homeXY = {x: cx, y: cy};
    return homeXY;
  }
  function joyMove(e) {
    const c = homeXY || joyAt(e.clientX, e.clientY);
    let dx = (e.clientX - c.x) / R;
    let dy = (e.clientY - c.y) / R;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m; dy /= m;
    }
    touchMove.x = dx; touchMove.y = dy;
    touchSprint = (m > 0.92 && dy < -0.6); /* 推满向前 = 疾跑(MC easy-sprint 同源) */
    knob.style.transform = 'translate(calc(-50% + ' + (dx*40) + 'px), calc(-50% + ' + (dy*40) + 'px))';
  }
  zone.onpointerdown = (e)=>{
    e.preventDefault(); lastTouchT = performance.now();
    if (joyId !== null) return; /* 第二根手指落 zone: 不抢杆(MC 单摇杆) */
    joyId = e.pointerId;
    try {
      zone.setPointerCapture(joyId);
    } catch (_) { }
    joyAt(e.clientX, e.clientY);
    joyMove(e);
  };
  zone.onpointermove = (e)=>{
    if (e.pointerId === joyId) joyMove(e);
  };
  const joyEnd = (e)=>{
    if (e.pointerId !== joyId) return;
    joyId = null;
    joyHome();
  };
  zone.onpointerup = zone.onpointercancel = joyEnd;
  joyHome();
}

/* 上下文刷新: 飞行时才亮下降键(MC: 潜行键飞行中变下降;
   建造模式切飞行后调用; 其余时刻两键状态不变) */
function refreshTouchUI() {
  if (!touchBuilt) return;
  const down = document.getElementById('touchDown');
  if (down) down.style.display = flyMode ? 'flex' : 'none';
}
/* 模式设置动作按钮, 两区分布(用户拍板 2026-10-24):
   · 常用动作条(右缘 #touchActs, 拇指区): [{icon, label, act:fn} | {icon, label, holdAct:fn}]
     holdAct = 主动作键: 按下=fn() 打/挖起步 + 按住连挖(onHold), 松手=停
   · 顶部小键区(#touchTop, 低频不占操作区): {icon, label, act:fn, rare: true}
   icon = 按钮像素图标键名(经 Input.icon seam 解析, button-icons.js 工坊);
   label = 无障碍名与像素图缺失时的文案回落。null = 全部隐藏 */
function setTouchActions(list) {
  buildTouchUI();
  const root = document.getElementById('touchUI');
  if (!list || !IS_TOUCH) {
    root.style.display = 'none'; return;
  }
  root.style.display = 'block';
  const strip = document.getElementById('touchActs');
  const top = document.getElementById('touchTop');
  strip.innerHTML = '';
  top.innerHTML = '';
  for (const a of list) {
    const b = document.createElement('button');
    const url = (a.icon && Input.icon && Input.icon(a.icon)) || '';
    if (url) {
      b.innerHTML = '<img alt="" draggable="false" src="' + url + '">';
      b.setAttribute('aria-label', a.label || a.icon);
    } else {
      b.textContent = a.label; /* 回落: 文案按钮(图标工坊缺席时) */
    }
    if (a.main || a.holdAct) b.classList.add('main'); /* 主动作键放大占拇指主位(用户拍板: 挖掘为主, 跳跃次之) */
    if (a.holdAct) {
      let held = false;
      b.onpointerdown = (e)=>{
        e.preventDefault(); lastTouchT = performance.now();
        try {
          b.setPointerCapture(e.pointerId);
        } catch (_) { }
        a.holdAct();
        held = true; holdActive = true;
        const M = Input.route;
        if (M && M.cur && M.cur.onHold) M.cur.onHold(true);
      };
      const off = ()=>{
        if (!held) return;
        held = false; holdActive = false;
        const M = Input.route;
        if (M && M.cur && M.cur.onHold) M.cur.onHold(false);
      };
      b.onpointerup = b.onpointercancel = off;
    } else if (a.hold) {
      holdKeyBtn(b, a.hold);
    } else {
      b.onpointerdown = (e)=>{
        e.preventDefault(); lastTouchT = performance.now(); a.act();
      };
    }
    (a.rare ? top : strip).appendChild(b);
  }
  top.style.display = top.children.length ? 'flex' : 'none';
  refreshTouchUI();
}
