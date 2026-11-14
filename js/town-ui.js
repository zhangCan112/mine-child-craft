'use strict';
/* ============================================================
   城镇 HUD 适配层 (TownUi) — 应用层·DOM 装配
   ------------------------------------------------------------
   一句话职责: 把 town-ui-core 的五态决策落到 #townHud 四槽 DOM——机器
   身份对账(进镇挂/离镇收/新机清)、emit 事件消费、TTS 意图与表扬节奏
   落地、L2 方位指引器(签名门控脏标刷新, 低频位姿采样驱动档位)、可交互
   高亮层(事件驱动命中+四态标记+点选结算)、会话避让监听入口。
   interface: mkTownUi({doc, machineRef, poseRef, speech, timer, showPage,
      raf, camRef, hlSource, onInteract}) → {targetEvent(name, payload),
      dialogEvent(name, payload), sync(), start(), cardState(), root} ·
      TownUi(自动实例) · townUiTargetEvent(name, payload)(adventure.js 建机
      步 emit 实参); poseRef=位姿采样源({x, y, z, yaw}|null, 缺省惰性读
      voxel 全局 pos/yaw, 沙盒安全); camRef=视采样源({origin, dir, yaw,
      pitch, fovDeg, aspect, vw, vh}|null, 缺省 null); hlSource=可交互清单
      源(缺省 TOWN_INTERACTS 注册派生快照); onInteract=点选结算出口(玩法
      侧消费, 缺省空旁路)
   依赖(均经全局名, 调用期解析): town-ui-core.js 的 TOWN_UI_PARAMS/
      townHudCardState/townHudDimming/townHintSentence/townPointerTarget/
      townPointerBand/townPointerHeading/townPointerSig/townHlClass/
      townHlDim/townHlSig/townHlHit/townHlProject(必须先装载; 经典
      script 共享词法直用, Node require 走 core 的 CJS 导出面解析);
      speech.js SpeechKit(缺省桩); modes/adventure.js AdventureMode.adv.
      advTownState(缺省机器挂点, 闭包内惰性解析); town-map-core.js
      TOWN_MAP.anchors(bell-tower 回落锚, 惰性解析缺席降级零方位档);
      town-interact-core.js TOWN_INTERACTS/townInteractRegistry(高亮清单
      生产缺省, 惰性解析缺席空清单); voxel 全局 pos/yaw(缺省位姿源,
      typeof 守卫); 宿主 chrome showPage(缺省 null); index.html 装载序
      town-interact-core → town-ui-core → 本文件 → mode-registry。
   可测性声明: THREE 零依赖·DOM 惰性创建(mount 前零触碰, Node 可安全
      require)·墙钟经注入 timer/raf(rAF 250ms 节流对账)·有同名单测
      (test/town-ui.test.js)。
   ============================================================ */

/* ---------- L1 卡图标映射(emoji 占位先行, UI-01 像素图标资产入库前策略;
    未知 iconKey→⭐; 「探索中」轻状态另用🚶) ---------- */
const TOWN_CARD_ICONS = {
  belltower: '🗼',
  plaza: '⛲',
  lavachicken: '🍗',
  farm: '🌾',
  stash: '🏠',
  windmill: '🌬️',
  find: '🔍',
  help: '💬',
};

/* ---------- core 解析(装载序双栖): 经典 script 里 town-ui-core 先装载,
    共享词法全局名直用; Node require 沙盒无共享词法, 走 core 的 CJS 导出面。
    core 缺席(装载序破坏)→null: 工厂内防御回落, 不炸加载 ---------- */
const TOWN_UI_CORE = typeof townHudCardState === 'function' ?
  {TOWN_UI_PARAMS, townHudCardState, townHudDimming, townHintSentence,
    townPointerTarget, townPointerBand, townPointerHeading, townPointerSig,
    townHlClass, townHlDim, townHlSig, townHlHit, townHlProject} :
  (typeof module !== 'undefined' && module.exports ?
    require('./town-ui-core.js') : null);

/* 高亮清单生产缺省(T-UI-03): 交互锚点注册派生快照(id/kind/iconKey/label/
    anchor 六锚点+三轻任务九条目); TOWN_INTERACTS/townInteractRegistry 缺席
    (沙盒/装载序破坏)→空清单, 不炸加载。 */
function townUiHlDefaultSource() {
  if (typeof townInteractRegistry !== 'function' ||
    typeof TOWN_INTERACTS === 'undefined') {
    return [];
  }
  return townInteractRegistry(TOWN_INTERACTS);
}

/* 表扬浮现/完成一步停留节奏(窗内单值): PRAISE_MS 中点 1600ms, 与参数表
    同源派生不另立权威 */
const TOWN_PRAISE_MID_MS = TOWN_UI_CORE ?
  (TOWN_UI_CORE.TOWN_UI_PARAMS.PRAISE_MS[0] +
    TOWN_UI_CORE.TOWN_UI_PARAMS.PRAISE_MS[1]) / 2 :
  1600;

function mkTownUi(deps) {
  deps = deps || {};
  /* 无件两栖: document 缺席(Node/沙盒)时用内置最小元素桩——状态与 DOM
     映射全链照走, root 语义不变(挂载后非 null); 真件浏览器不受此支影响 */
  function mkHeadlessDoc() {
    function mkEl(tag) {
      const classes = new Set();
      const attrs = {}; /* 闭包私有(F1): 公开面只走 get/setAttribute=真实 DOM 面 */
      const el = {
        tag, children: [], parent: null, hidden: false, textContent: '',
        style: {}, onclick: null,
        classList: {
          add(...cs) {
            for (const c of cs) classes.add(c);
          },
          remove(...cs) {
            for (const c of cs) classes.delete(c);
          },
          contains(c) {
            return classes.has(c);
          },
        },
        setAttribute(k, v) {
          attrs[k] = String(v);
        },
        getAttribute(k) {
          return attrs[k];
        },
        appendChild(c) {
          el.children.push(c);
          c.parent = el;
          return c;
        },
        click() {
          if (el.onclick) el.onclick({});
        },
      };
      return el;
    }
    const body = mkEl('body');
    return {body, createElement: (tag) => mkEl(tag), getElementById: () => null};
  }
  const doc = deps.doc ||
    (typeof document !== 'undefined' ? document : mkHeadlessDoc());
  /* 缺省机器挂点: A.adv.advTownState().targets(判据在闭包内惰性解析,
     装载序不敏感; 沙盒无 AdventureMode 回落 null) */
  const machineRef = deps.machineRef || (() => {
    if (typeof AdventureMode === 'undefined' || !AdventureMode.adv ||
      !AdventureMode.adv.advTownState) {
      return null;
    }
    const st = AdventureMode.adv.advTownState();
    return st ? st.targets : null;
  });
  /* 缺省位姿采样源: 惰性读 voxel 全局词法 pos/yaw(经典 script 共享环境;
     Node/沙盒无此全局→null, typeof 守卫不炸)。低频采样(事件/对账挂点),
     非每帧。 */
  const poseRef = deps.poseRef || (() => {
    if (typeof pos === 'undefined' || typeof yaw === 'undefined') return null;
    return {x: pos.x, y: pos.y, z: pos.z, yaw};
  });
  const speech = deps.speech ||
    (typeof SpeechKit !== 'undefined' ? SpeechKit : {speak() {}, cancel() {}});
  /* timer 缺省守卫 setTimeout(vm/boot 沙盒无定时器原语: 闭包创建即安全) */
  const timer = deps.timer || (typeof setTimeout === 'function' ?
    {set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h)} :
    {set: () => null, clear: () => {}});
  /* 局部名 gotoPage 避开与全局 showPage 同名自指(缺省解析宿主 chrome) */
  const gotoPage = deps.showPage ||
    (typeof showPage === 'function' ? showPage : null);
  const rafFn = deps.raf ||
    (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  /* T-UI-03 高亮装具注入: camRef=视采样源(命中/投影几何输入, 缺省 null=
      零伪造全隐藏); hlSource=可交互清单源(缺省走注册派生快照);
      onInteract=点选结算出口(玩法侧消费, A 侧不代写玩法, 缺省空旁路) */
  const camRef = deps.camRef || (() => null);
  const hlSource = deps.hlSource || townUiHlDefaultSource;
  const onInteract = deps.onInteract || (() => {});
  let root = null; /* 挂载前 null(零常驻 DOM, 未进镇不挂载) */
  let card = null;
  let pointerSlot = null;
  let praiseSlot = null;
  let sysSlot = null;
  let iconEl = null;
  let labelEl = null;
  let ttsBtn = null;
  let praiseEl = null;
  let pointerBadge = null; /* L2 指引器徽章(mount 恒等创建, 刷新零重建) */
  let pointerIcon = null;
  let pointerArrow = null;
  let hlLayer = null; /* T-UI-03 高亮层(mount 恒等创建, 独立 town-hl- 命名空间) */
  let hoveredId = null; /* 事件驱动命中记忆(仅 mousemove 重算, sync 不判) */
  let pressedId = null; /* 按下记忆(pointerdown 置/pointerup 清并结算) */
  const hlStateMemo = new Map(); /* 标记状态签名记忆(id→memo, 脏标对账) */
  let cur = 'hidden'; /* 核心态唯一事实(town-ui-core 状态机输出) */
  let prevMachine;
  let seenMachine = false; /* 首次对账按 m 有无动作(首帧不误判进场) */
  let dialogOpen = false;
  let prevCardState = 'hidden'; /* 会话打开时的卡态快照(close 恢复用) */
  let focusTarget = null; /* 最近 focus 的目标(标签句/hasNext 判断用) */
  const doneIds = new Set(); /* 装配层自有事件记忆(state==='done' id 集) */
  let curSentence = ''; /* 当前提示完整句(重播钮口径) */
  let praiseHideH = null; /* 未决定时句柄(离镇/换机要清) */
  let elapseH = null;
  let rafStarted = false;

  function clearHandle(h) {
    if (h) timer.clear(h);
  }

  /* ---------- mount: #townHud 四槽惰性创建(幂等)。append 到 body 而非
     #hud——#hud 内 innerHTML 被 mode-kit 每帧重写会冲掉子容器(prebuild
     §1.1 落点建议实现票可微调, 此适配落点已登记) ---------- */
  function mount() {
    if (root || !doc || !doc.body) return;
    root = doc.createElement('div');
    root.setAttribute('id', 'townHud');
    card = doc.createElement('div');
    card.classList.add('town-hud-card');
    iconEl = doc.createElement('span');
    iconEl.classList.add('town-hud-card-icon');
    labelEl = doc.createElement('span');
    labelEl.classList.add('town-hud-card-label');
    ttsBtn = doc.createElement('button');
    ttsBtn.classList.add('town-hud-card-tts');
    ttsBtn.textContent = '🔊';
    ttsBtn.setAttribute('aria-label', '再听一遍');
    ttsBtn.onclick = () => {
      /* 重播完整句: cancel-then-speak 不重叠抢话; 不喂核心不改态(§2.4) */
      speech.cancel();
      if (curSentence) speech.speak(curSentence);
    };
    card.appendChild(iconEl);
    card.appendChild(labelEl);
    card.appendChild(ttsBtn);
    pointerSlot = doc.createElement('div');
    pointerSlot.classList.add('town-hud-pointer'); /* 槽类名不变(显隐归 applyState) */
    /* L2 指引器徽章三件: 槽内恰一徽章, 内含图标+指针(子件引用恒等,
       后续刷新只换类名/图标文本, 绝不重建 DOM——签名门控在 refreshPointer) */
    pointerBadge = doc.createElement('div');
    pointerBadge.classList.add('town-hud-pointer-badge');
    pointerIcon = doc.createElement('span');
    pointerIcon.classList.add('town-hud-pointer-icon');
    pointerArrow = doc.createElement('span');
    pointerArrow.classList.add('town-hud-pointer-arrow');
    pointerBadge.appendChild(pointerIcon);
    pointerBadge.appendChild(pointerArrow);
    pointerSlot.appendChild(pointerBadge);
    praiseSlot = doc.createElement('div');
    praiseSlot.classList.add('town-hud-praise');
    sysSlot = doc.createElement('div');
    sysSlot.classList.add('town-hud-sys');
    /* T-UI-03 高亮层: 独立命名空间不占 L1-L4 四槽; 零鼠标捕获(css 同款),
       点选走文档级事件链(mousemove/pointerdown/pointerup), 标记纯视觉 */
    hlLayer = doc.createElement('div');
    hlLayer.classList.add('town-hl-layer');
    const homeBtn = doc.createElement('button');
    homeBtn.setAttribute('aria-label', '回主菜单');
    homeBtn.textContent = '🏠';
    homeBtn.onclick = () => {
      /* 宿主 chrome 页面缝(模式页 back 按钮先例); 本票不另造退出链 */
      if (typeof gotoPage === 'function') gotoPage('main');
    };
    sysSlot.appendChild(homeBtn);
    root.appendChild(card);
    root.appendChild(pointerSlot);
    root.appendChild(praiseSlot);
    root.appendChild(sysSlot);
    root.appendChild(hlLayer);
    doc.body.appendChild(root);
  }

  /* ---------- apply: 核心态 → 槽显隐与卡内容(每次喂核心后调用) ---------- */
  function applyState() {
    if (!root) return;
    const d = TOWN_UI_CORE.townHudDimming(cur, dialogOpen);
    card.hidden = d.l1 === 'hidden';
    pointerSlot.hidden = d.l2 !== 'normal';
    sysSlot.hidden = false; /* L4 安全返回永不收敛 */
    /* 卡内容按态刷(P-V1: 无任务=「随便逛逛」轻状态) */
    const exploring = cur === 'idle-exploring';
    labelEl.textContent = exploring ?
      '随便逛逛' :
      ((focusTarget && focusTarget.label) || '随便逛逛');
    iconEl.textContent = exploring ?
      '🚶' :
      TOWN_CARD_ICONS[focusTarget && focusTarget.iconKey] || '⭐';
    card.classList.remove('is-idle-exploring', 'is-active', 'is-step-done');
    if (exploring) {
      card.classList.add('is-idle-exploring');
    } else if (cur === 'active') {
      card.classList.add('is-active');
    } else if (cur === 'step-done') {
      card.classList.add('is-step-done');
    }
    /* TTS 重播钮仅 active/step-done 可见(prebuild §2.4 显隐行) */
    ttsBtn.hidden = !(cur === 'active' || cur === 'step-done');
  }

  /* ---------- L2 方位指引器(T-UI-02; prebuild §3.1-§3.4) ----------
      签名门控脏标刷新: 签名不变零 DOM 操作(§3.4 无闪烁), 变了才落档位类
      (互斥替换先摘后加); 几何输入缺一(无锚/无位姿)即零方位零距离档不伪造
      方向。有效目标复用装配层既有事件记忆(focusTarget+doneIds): focus 且
      非 done 才指, done 回落钟塔弱提示(U5); 全程零新增状态源。 */
  const POINTER_MODE_CLASSES = ['is-target', 'is-fallback'];
  const POINTER_HEADING_CLASSES =
    ['is-front', 'is-left', 'is-right', 'is-behind'];
  const POINTER_BAND_CLASSES = ['band-nearby', 'band-near', 'band-far'];
  let pointerSig = null; /* 指引签名记忆(脏标对账; leaveTown 清零防串轮) */

  /* 回落锚: TOWN_MAP bell-tower 锚(缺席→null, 沙盒降级为仅图标弱提示) */
  function bellTowerAnchor() {
    if (typeof TOWN_MAP === 'undefined' || !TOWN_MAP || !TOWN_MAP.anchors) {
      return null;
    }
    const hit = TOWN_MAP.anchors.find((a) => a && a.id === 'bell-tower');
    return hit ? {x: hit.x, y: hit.y, z: hit.z} : null;
  }

  function refreshPointer() {
    if (!pointerBadge || !root || root.hidden) return;
    const pose = poseRef();
    const target = focusTarget && focusTarget.state !== 'done' &&
      !doneIds.has(focusTarget.id) ? focusTarget : null;
    const resolved =
      TOWN_UI_CORE.townPointerTarget(target,
          {fallback: TOWN_UI_CORE.TOWN_UI_PARAMS.U5_FALLBACK,
            fallbackAnchor: bellTowerAnchor()});
    let band = null;
    let heading = null;
    if (resolved.anchor && pose) {
      const dx = resolved.anchor.x - pose.x;
      const dz = resolved.anchor.z - pose.z;
      heading = TOWN_UI_CORE.townPointerHeading(dx, dz, pose.yaw);
      band = TOWN_UI_CORE.townPointerBand(
          Math.sqrt(dx * dx + dz * dz), heading === 'front');
    }
    const sig = TOWN_UI_CORE.townPointerSig(
      target ? target.id : null, resolved.mode, band, heading);
    if (sig === pointerSig) return; /* 签名不变: 零 DOM 操作(同位姿采样) */
    pointerSig = sig;
    pointerBadge.classList.remove(...POINTER_MODE_CLASSES);
    pointerBadge.classList.remove(...POINTER_HEADING_CLASSES);
    pointerBadge.classList.remove(...POINTER_BAND_CLASSES);
    if (resolved.mode === 'target' || resolved.mode === 'fallback') {
      pointerBadge.classList.add('is-' + resolved.mode);
    }
    if (heading) pointerBadge.classList.add('is-' + heading);
    if (band) pointerBadge.classList.add('band-' + band);
    /* 图标只在变化时写文本(回落恒钟塔, 未知 iconKey→⭐ 同 L1 策略) */
    const glyph = resolved.mode !== 'off' && resolved.iconKey ?
      (TOWN_CARD_ICONS[resolved.iconKey] || '⭐') : '';
    if (pointerIcon.textContent !== glyph) pointerIcon.textContent = glyph;
  }

  /* ---------- T-UI-03 可交互高亮/标记与点选反馈(hud-spec §6; prebuild §4) ----------
      事件驱动口径: 命中判定只挂文档级 mousemove/pointerdown/pointerup(零
      每帧/零每 sync 重算, 架构 §8); 判定本体走 core townHlHit 纯几何
      (零 raycast), 刷新走签名门控脏标(同态重复事件零 DOM 操作, 无闪烁)。
      高亮层零鼠标捕获, 标记纯视觉层不代点选(零 onclick); 点选结算经
      onInteract 出口交玩法侧(机器 focus/found 不由本层调, prebuild §4.3),
      结算同时把「孩子点了什么」回流自家 L1 卡状态机(机器态不动, 状态回
      流只进 HUD)。几何输入缺一(无 cam/无锚)即全标隐藏零伪造位置。 */
  const HL_STATE_CLASSES =
    ['is-default', 'is-hover', 'is-pressed', 'is-done', 'is-active'];

  function markElOf(id) {
    if (!hlLayer) return null;
    for (const c of hlLayer.children) {
      if (c.attrs && c.attrs['data-hl-id'] === id) return c;
    }
    return null;
  }

  /* 挂标(enterTown 期调用): 每条目一标, 子件按 id 复用不重建(幂等);
     emoji 占位同 L1/L2 策略(UI-01 语义键), 初始默认态零跨轮残留 */
  function buildHlMarks() {
    if (!hlLayer) return;
    for (const e of hlSource()) {
      if (!e || !e.id) continue;
      let mk = markElOf(e.id);
      if (!mk) {
        mk = doc.createElement('div');
        mk.classList.add('town-hl-mark');
        hlLayer.appendChild(mk);
      }
      mk.setAttribute('data-hl-id', e.id);
      mk.textContent = TOWN_CARD_ICONS[e.iconKey] || '⭐';
      mk.classList.remove(...HL_STATE_CLASSES);
      mk.classList.add('is-default');
      mk.hidden = false;
    }
    hlStateMemo.clear(); /* 新会话新账: 首刷全量落位(签名字段全量重置) */
  }

  /* 标记刷新(签名门控脏标): 状态类=core townHlClass(优先级序), 显示档=
     core townHlDim(会话降噪), 隐藏=off 档 ∨ 无 cam ∨ 投影缺席 ∨ 屏外 ∨
     超展示距离门; memo 含签名+状态类+隐藏(位置随事件照写, 类与显隐只在
     memo 翻转时动——同态重复事件零 classList 调用) */
  function refreshHl() {
    if (!hlLayer || !root || root.hidden) return;
    const cam = camRef();
    const maxDist = TOWN_UI_CORE.TOWN_UI_PARAMS.HL_AIM_MAX_DIST;
    const activeId = dialogOpen && focusTarget ? focusTarget.id : null;
    for (const e of hlSource()) {
      if (!e || !e.id || !e.anchor) continue;
      const mk = markElOf(e.id);
      if (!mk) continue;
      const cls = TOWN_UI_CORE.townHlClass(e.id,
          {hoveredId, pressedId, activeId, doneIds});
      const dim = TOWN_UI_CORE.townHlDim(activeId, dialogOpen, cls);
      let proj = null;
      let hidden = dim === 'off' || !cam || !cam.origin;
      if (!hidden) {
        /* 投影吃裸数字 cam(hud-spec 装具契约: hit 用 origin+dir, 投影用
           yaw/pitch/fovDeg/aspect/vw/vh, 不交叉校验 dir 一致性) */
        proj = TOWN_UI_CORE.townHlProject({
          x: cam.origin.x, y: cam.origin.y, z: cam.origin.z,
          yaw: cam.yaw, pitch: cam.pitch, fovDeg: cam.fovDeg,
          aspect: cam.aspect, vw: cam.vw, vh: cam.vh,
        }, e.anchor);
        hidden = !proj || !proj.visible || proj.dist > maxDist;
      }
      const memo = TOWN_UI_CORE.townHlSig(e.id, dim) + '|' + cls +
        '|' + (hidden ? 'h' : 'v');
      if (hlStateMemo.get(e.id) !== memo) {
        hlStateMemo.set(e.id, memo);
        mk.classList.remove(...HL_STATE_CLASSES);
        mk.classList.add('is-' + cls);
        if (dim === 'min') mk.classList.add('is-min');
        else mk.classList.remove('is-min');
        mk.hidden = hidden;
      }
      if (!hidden && proj) {
        mk.style.left = proj.x + 'px';
        mk.style.top = proj.y + 'px';
      }
    }
  }

  /* 命中重算(仅鼠标事件到达时跑): cam/清单任一缺席→无命中(零伪造悬停) */
  function recomputeHit() {
    const cam = camRef();
    if (!cam || !cam.origin || !cam.dir) {
      hoveredId = null;
      refreshHl();
      return;
    }
    const candidates = [];
    for (const e of hlSource()) {
      if (e && e.id && e.anchor) candidates.push({id: e.id, anchor: e.anchor});
    }
    const hit = TOWN_UI_CORE.townHlHit(cam.origin, cam.dir, candidates, {});
    hoveredId = hit ? hit.id : null;
    refreshHl();
  }

  /* 结算回流: 「孩子点了什么」进自家 L1 卡状态机(机器不动——focus/found
     归玩法侧, 架构 §7.1 事件流; 完成一步由玩法侧 found 事件回冲) */
  function settleFocus(entry) {
    focusTarget = {id: entry.id, kind: entry.kind, iconKey: entry.iconKey,
      label: entry.label, anchor: entry.anchor, state: entry.state || 'active'};
    feed({type: 'target-focus', target: focusTarget});
  }

  function onHlMove() {
    recomputeHit(); /* 悬停=鼠标唯一发现通道(§4.6) */
  }

  function onHlDown() {
    if (!hoveredId) return; /* 未悬停按下零反馈(不可交互不误导, §4.6) */
    pressedId = hoveredId;
    refreshHl(); /* 按下态即时确认「系统听到了」 */
  }

  function onHlUp() {
    if (!pressedId) return; /* 空放不结算 */
    const id = pressedId;
    pressedId = null;
    const entry = hlSource().find((e) => e && e.id === id);
    if (entry && entry.anchor) {
      settleFocus(entry);
      /* 恰一次派发命中对象载荷(五键, 协议面=dialog-spec §2.2 载荷形状) */
      onInteract({id: entry.id, kind: entry.kind, iconKey: entry.iconKey,
        label: entry.label, anchor: entry.anchor});
    }
    refreshHl(); /* 抬起回弹: pressed 清, 仍在瞄→hover 恢复 */
  }

  /* 文档级三件套挂/摘(离镇卫生: 监听不泄漏); 裸 doc(无监听宿主=boot
     沙盒形)守卫跳过不炸 */
  function attachHlListeners() {
    if (!doc || typeof doc.addEventListener !== 'function') return;
    doc.addEventListener('mousemove', onHlMove);
    doc.addEventListener('pointerdown', onHlDown);
    doc.addEventListener('pointerup', onHlUp);
  }

  function detachHlListeners() {
    if (!doc || typeof doc.removeEventListener !== 'function') return;
    doc.removeEventListener('mousemove', onHlMove);
    doc.removeEventListener('pointerdown', onHlDown);
    doc.removeEventListener('pointerup', onHlUp);
  }

  function praiseShow() {
    if (!praiseEl) {
      praiseEl = doc.createElement('span'); /* emoji ⭐ 占位(UI-04 入库前) */
      praiseEl.textContent = '⭐';
      praiseSlot.appendChild(praiseEl);
    }
    praiseEl.hidden = false; /* 复用同一条=U7 同屏 1 条(新事件顶替旧条) */
  }

  function praiseHide() {
    if (praiseEl) praiseEl.hidden = true;
  }

  function elapseFeed() {
    /* 到点若已被其他事件迁走, 核心天然忽略, 这里喂前自查省一次调用 */
    if (cur !== 'step-done') return;
    /* hasNext 用装配层自有事件记忆(focusTarget+doneIds), 不回读机器快照 */
    const hasNext = !!(focusTarget && !doneIds.has(focusTarget.id));
    feed({type: 'step-elapse', hasNext: hasNext});
  }

  /* ---------- feed: 喂核心+落 DOM+意图落地(唯一写 cur 的口) ---------- */
  function feed(ev) {
    const out = TOWN_UI_CORE.townHudCardState(cur, ev);
    cur = out.state;
    applyState();
    /* 会话中意图冻结(轻状态侧): 核心状态机对 idle-exploring 无 dialog-open
       收敛边, tts-hint/praise-show 的落地闸由装配层承担——dialogOpen=true
       时意图照收但不落地(不开麦不弹表扬不换重播句, dialog-spec §2.2 会话
       播报优先); close 先摘闸再喂(dialogEvent), close 自身 done+taskRef 的
       落完成+表扬照给(会话避让测试锁死), 冻结随会话解除非永久静音 */
    if (dialogOpen) return;
    for (const intent of out.intents) {
      if (intent === 'tts-hint') {
        /* cancel-then-speak 统一口径(SpeechKit 单通道不重叠抢话) */
        speech.cancel();
        curSentence =
          TOWN_UI_CORE.townHintSentence((focusTarget && focusTarget.label) || '');
        speech.speak(curSentence);
      } else if (intent === 'praise-show' && root) {
        praiseShow();
        clearHandle(praiseHideH);
        praiseHideH = timer.set(praiseHide, TOWN_PRAISE_MID_MS);
        if (cur === 'step-done') {
          /* 完成一步停留 1.2-2.0s 后自动切(U7 节奏; 墙钟归装配层) */
          clearHandle(elapseH);
          elapseH = timer.set(elapseFeed, TOWN_PRAISE_MID_MS);
        }
      }
    }
  }

  /* ---------- 机器身份对账: 进镇建机/离镇弃机经 machineRef 感知 ---------- */
  function enterTown() {
    mount();
    if (root) root.hidden = false;
    doneIds.clear(); /* 新会话新账(机器不串轮) */
    focusTarget = null;
    hoveredId = null; /* 高亮命中/按下记忆同清(零跨轮残留) */
    pressedId = null;
    /* 进场喂核心不依赖 DOM 成败(doc 缺席沙盒态照走, applyState 自守卫) */
    feed({type: 'enter'});
    refreshPointer(); /* 进镇弱提示按当帧位姿重算(签名记忆已被离镇清零) */
    buildHlMarks(); /* 高亮标记挂出(幂等复用, 新机新账) */
    refreshHl(); /* 按当帧视采样落位/显隐 */
    attachHlListeners(); /* 文档级三件套(离镇镜像摘除) */
  }

  function leaveTown() {
    feed({type: 'leave'});
    if (root) root.hidden = true;
    speech.cancel(); /* 提示句不残声 */
    clearHandle(praiseHideH);
    clearHandle(elapseH);
    praiseHideH = null;
    elapseH = null;
    pointerSig = null; /* 指引签名记忆清零(再进新机重算零残留) */
    detachHlListeners(); /* 三件套摘除(监听不泄漏) */
    hoveredId = null;
    pressedId = null;
  }

  /* 机器身份对账: 引用或快照等价(同一状态机两次 snapshot 拷贝恒等;
     machineRef 允许返回等价新对象——幂等对账不误判换机, 位姿采样照走;
     快照真变(focusId/states 迁移)即换机, 串轮复位语义不变) */
  function sameMachine(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a.snapshot !== 'function' ||
      typeof b.snapshot !== 'function') {
      return false;
    }
    return JSON.stringify(a.snapshot()) === JSON.stringify(b.snapshot());
  }

  function sync() {
    const m = machineRef();
    if (!seenMachine) {
      seenMachine = true;
      prevMachine = m;
      if (m) enterTown(); /* 首次对账即按 m 有无动作(root 未事件前保持 null) */
      return;
    }
    if (sameMachine(m, prevMachine)) {
      refreshPointer(); /* 幂等对账后低频位姿采样(签名门控: 同位姿零 DOM) */
      return; /* 幂等零动作 */
    }
    if (!m) {
      leaveTown();
    } else if (!prevMachine) {
      enterTown();
    } else {
      leaveTown(); /* 新机不串轮: 先按离镇清再按进镇走 */
      enterTown();
    }
    prevMachine = m;
  }

  /* ---------- emit 接线面(目标协议恰两键, 协议外静默忽略不炸) ---------- */
  function targetEvent(name, payload) {
    payload = payload || {};
    if (name === 'town-ui/target/focus') {
      if (!root) mount(); /* 先到事件先挂兜底竞态 */
      focusTarget = payload.target || null;
      feed({type: 'target-focus', target: payload.target || null});
      refreshPointer(); /* 指引随 focus 换目标(签名门控零闪烁) */
      refreshHl(); /* 高亮随 focus 迁移(选中环/降噪档随事件到位) */
    } else if (name === 'town-ui/target/update') {
      if (!root) mount();
      if (payload.state === 'done') doneIds.add(payload.id);
      feed({type: 'target-update', id: payload.id, state: payload.state});
      refreshPointer(); /* done 目标不再指→回落钟塔(U5), 非-done 档位随动 */
      refreshHl(); /* 完成态/状态回流随事件落到标记(签名门控) */
    }
    /* 其他(含 town-ui/interact/*——T-UI-03 域): 静默忽略 */
  }

  /* ---------- 会话避让监听侧(B→A seam; dialog 本体归 T-UI-04, 本票零依赖,
     此入口即未来对接点) ---------- */
  function dialogEvent(name, payload) {
    payload = payload || {};
    if (name === 'town-ui/dialog/open') {
      prevCardState = cur;
      dialogOpen = true;
      feed({type: 'dialog-open'});
      refreshHl(); /* 会话降噪档随开落位(选中环保持/其余隐藏) */
    } else if (name === 'town-ui/dialog/close') {
      /* 先摘会话闸再喂: close(done) 的表扬意图要能落槽(L3 会话中冻结由
         核心承担, 关闸后解冻) */
      dialogOpen = false;
      feed({type: 'dialog-close', result: payload.result,
        taskRef: payload.taskRef, prev: prevCardState});
      refreshHl(); /* 降噪随会话解除恢复(标记回默认态可见) */
    }
    /* town-ui/dialog/update 等: T-UI-04 未来对接点, 本票无动作 */
  }

  /* ---------- start: rAF 循环 250ms 节流对账(时间源 rAF 回参 now;
     raf 缺省 null(Node/沙盒)不启动, 零常驻循环) ---------- */
  function start() {
    if (!rafFn || rafStarted) return;
    rafStarted = true;
    let last = 0;
    const loop = (now) => {
      if (typeof now !== 'number' || now - last >= 250) {
        last = typeof now === 'number' ? now : 0;
        sync();
      }
      rafFn(loop);
    };
    rafFn(loop);
  }

  return {
    targetEvent,
    dialogEvent,
    sync,
    start,
    cardState: () => cur,
    get root() {
      return root;
    },
  };
}

/* ---------- 自动实例与 emit 全局缝(模块装载零 DOM 触碰: mount 惰性到
    首次事件/进镇, boot 冒烟 vm 全放行桩不炸) ---------- */
const TownUi = mkTownUi({});

/* adventure.js 建机步 emit 实参(守卫式: 本文件未装载时退回空旁路) */
function townUiTargetEvent(name, payload) {
  TownUi.targetEvent(name, payload);
}

if (typeof requestAnimationFrame === 'function') {
  TownUi.start(); /* 浏览器节流对账; Node/沙盒无 rAF 不启动 */
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {mkTownUi};
}
