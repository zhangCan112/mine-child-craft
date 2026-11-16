'use strict';
/* ============================================================
   城镇 HUD 适配层 (TownUi) — 应用层·DOM 装配
   ------------------------------------------------------------
   一句话职责: 把 town-ui-core 的五态决策落到 #townHud 四槽 DOM——机器
   身份对账(进镇挂/离镇收/新机清)、emit 事件消费、TTS 意图与表扬节奏
   落地、L2 方位指引器(签名门控脏标刷新, 低频位姿采样驱动档位)、可交互
   高亮层(事件驱动命中+四态标记+点选结算)、会话三件套(B 侧 DOM:
   World Bubble+Session Panel+Option Chip/Action Ghost, 机器 emit→
   dialogEvent 同实例闭环)、会话避让监听入口。
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
      town-dialog-core.js 的 DIALOG_EVENTS/DIALOG_OPTS/mkDialogMachine/
      dialogViewFor/dialogUtterFor(装载序 town-ui-core < town-dialog-core
      < 本文件; Node require 同走 CJS 导出面); speech.js SpeechKit(缺省
      桩); modes/adventure.js AdventureMode.adv.
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
  care: '💗', // T-NPC-10 G01 关怀语义 marker(iconkey-decision.md §五.2 授权随接线落)
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

/* 会话核心解析(T-UI-04): 同款双栖。core 缺席(装载序破坏)→null: 会话
    驱动缝全旁路(点选保持纯 A 侧结算), 不炸加载 */
const DIALOG_CORE = typeof mkDialogMachine === 'function' ?
  {DIALOG_EVENTS, DIALOG_OPTS, ROUTE_BY_KIND, mkDialogMachine,
    dialogViewFor, dialogUtterFor} :
  (typeof module !== 'undefined' && module.exports ?
    require('./town-dialog-core.js') : null);

/* respond 确认短驻泵窗(<300ms 可感知窗, prebuild §4.1; 墙钟归装配层) */
const DLG_CONFIRM_MS = 280;

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

/* ---------- 城镇翻新波次二参数(呈现层节奏, 与 css/town.css 动画同源):
   BUBBLE_SAFE 安全区夹紧边距(16px) / BUBBLE_GAP 尾尖悬距(锚点→气泡底边,
   尾尖同高, TIDEA-14); TOWER_SEEN_COOLDOWN 回望回礼冷却 30s 防刷 /
   TOWER_PULSE 脉冲驻留 1.6s(band-nearby 呼吸周期同族, TIDEA-16) ---------- */
const TOWN_BUBBLE_SAFE = 16;
const TOWN_BUBBLE_GAP = 12;
const TOWN_TOWER_SEEN_COOLDOWN_MS = 30000;
const TOWN_TOWER_PULSE_MS = 1600;

function mkTownUi(deps) {
  deps = deps || {};
  /* 无件两栖: document 缺席(Node/沙盒)时用内置最小元素桩——状态与 DOM
     映射全链照走, root 语义不变(挂载后非 null); 真件浏览器不受此支影响 */
  /* live 只读集合视图(S-1 契约收紧 2026-11-14): children 面模拟真元素
     HTMLCollection——length/整数索引可读、可迭代、只读快照方法在册;
     无 pop/push 等变更法(拿到的是集合视图, 不是可变数组), 子件增删唯一
     通道=appendChild/removeChild(真 DOM 契约)。 */
  function liveKids(kids) {
    const methods = {
      item(i) {
        return kids[i];
      },
      find(fn) {
        return kids.find(fn);
      },
      filter(fn) {
        return kids.filter(fn);
      },
      map(fn) {
        return kids.map(fn);
      },
      forEach(fn) {
        return kids.forEach(fn);
      },
      slice(...a) {
        return kids.slice(...a);
      },
      indexOf(x) {
        return kids.indexOf(x);
      },
      includes(x) {
        return kids.includes(x);
      },
    };
    return new Proxy(methods, {
      get(t, k) {
        if (k === 'length') {
          return kids.length;
        }
        if (typeof k === 'string' && /^[0-9]+$/.test(k)) {
          return kids[+k];
        }
        if (k === Symbol.iterator) {
          return () => kids[Symbol.iterator]();
        }
        return t[k];
      },
    });
  }
  function mkHeadlessDoc() {
    function mkEl(tag) {
      const classes = new Set();
      const attrs = {}; /* 闭包私有(F1): 公开面只走 get/setAttribute=真实 DOM 面 */
      const kids = []; /* 闭包私有(S-1): children 只暴露 live 只读视图 */
      const view = liveKids(kids);
      const el = {
        tag, parent: null, hidden: false, textContent: '',
        style: {}, onclick: null,
        get children() {
          return view;
        },
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
          kids.push(c);
          c.parent = el;
          return c;
        },
        removeChild(c) {
          const i = kids.indexOf(c);
          if (i < 0) throw new Error('NotFoundError: removeChild 的实参不是子件');
          kids.splice(i, 1);
          c.parent = null;
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
  /* 城镇翻新波次三专项一(lead 扩权最薄接线): bubbleCamRef=锚定功能档专用
     视采样源(deps 注入或 attachBubbleCam 运行时挂, 缺省回落 camRef)——
     消费面=hover 判定(recomputeHit)+气泡锚定投影(positionBubbleAtSpeaker),
     同相机自洽。产线 camRef=null 休眠态下只接本缝即点亮「hover→气泡→
     点选会话」整链(点选结算随 hover 连带激活=对话可达前提, 报告披露);
     T-UI-03 标记视觉档(refreshHl)仍吃 camRef 保持休眠=授权边界。T-UI-03
     相机源票将来接 camRef 时全档齐活, 本缝缺省回落零破兼容 */
  let bubbleCamFn = deps.bubbleCamRef || null;
  const bubbleCamRef = () => (bubbleCamFn ? bubbleCamFn() : camRef());
  /* 城镇翻新波次三 TIDEA-18: 反馈音效缝(deps 注入, 缺省 null=静默——Node
     沙盒/替身装具零音频依赖); 自动实例装载时传页全局 sfx(audio.js 在本
     文件之前装载, typeof 求值即得), respectMute/VoiceGate 纪律全在总线侧 */
  const sfxFn = typeof deps.sfx === 'function' ? deps.sfx : null;
  const hlSource = deps.hlSource || townUiHlDefaultSource;
  const onInteract = deps.onInteract || (() => {});
  let root = null; /* 挂载前 null(零常驻 DOM, 未进镇不挂载) */
  let pointerSlot = null;
  let praiseSlot = null;
  let sysSlot = null;
  let praiseEl = null;
  let pointerBadge = null; /* L2 指引器徽章(mount 恒等创建, 刷新零重建) */
  let pointerIcon = null;
  let pointerArrow = null;
  let hlLayer = null; /* T-UI-03 高亮层(mount 恒等创建, 独立 town-hl- 命名空间) */
  let dlgLayer = null; /* T-UI-04 会话层(mount 恒等创建, 独立 town-dlg- 命名空间) */
  let dlgBubble = null;
  let dlgPanel = null;
  let dlgSpeaker = null;
  let dlgThumb = null;
  let dlgBody = null;
  let dlgOpts = null;
  let dlgGhosts = null;
  let dlgPraise = null;
  let hoveredId = null; /* 事件驱动命中记忆(仅 mousemove 重算, sync 不判) */
  let hoveredEntry = null; /* 命中条目快照(bubble 文案/会话驱动缝用) */
  let pressedId = null; /* 按下记忆(pointerdown 置/pointerup 清并结算) */
  const hlStateMemo = new Map(); /* 标记状态签名记忆(id→memo, 脏标对账) */
  let cur = 'hidden'; /* 核心态唯一事实(town-ui-core 状态机输出) */
  let prevMachine;
  let seenMachine = false; /* 首次对账按 m 有无动作(首帧不误判进场) */
  let dialogOpen = false;
  let prevCardState = 'hidden'; /* 会话打开时的卡态快照(close 恢复用) */
  let dlgSessionHad = false; /* PO 案①(树 3c89723): 本镇轮开过会话的留痕
      (open 置真, 进镇复位)——掉机时已收口会话的卡态已由 CLOSE 链复原,
      leaveTown 据此走 defer 半边(idle 零惩罚 no-op)不 feed(leave) 覆盖 */
  let focusTarget = null; /* 最近 focus 的目标(标签句/hasNext 判断用) */
  const doneIds = new Set(); /* 装配层自有事件记忆(state==='done' id 集) */
  /* 城镇翻新波次二会话态(TIDEA-16): 钟塔回望 armed=先观察到非正前再回
     正前(防出生直视即烧), 冷却/脉冲句柄离镇清。TIDEA-19 首访提示链
     (enteredOnce/greetDone/hintOn)随左上状态卡移除一并清(PO 返工 2026-11-15;
     greet done 事件 feed 链保留=机制层不动, 仅撤卡文案消费面) */
  let towerSeenArmed = false;
  let towerSeenLast = 0;
  let towerPulseH = null;
  let praiseHideH = null; /* 未决定时句柄(离镇/换机要清) */
  let elapseH = null;
  let rafStarted = false;
  /* T-UI-04 会话机器与泵(B 侧; emit→onDlgEvent 同实例闭环) */
  let dlg = null;
  let dlgCtx = null; /* 会话上下文(entry 快照: 视图/话术派生输入) */
  let dlgSig = null; /* 会话层签名记忆(脏标对账, 同态零 DOM 操作) */
  /* TIDEA-18 翻转沿记忆(音频沿检测: 进面板/浮现表扬/气泡冒出各响一声,
     持续态零重响; enterTown 清=新机新账零跨轮) */
  let dlgPanelOpen = false;
  let dlgPraiseShown = false;
  let dlgBubbleShown = false;
  let dlgSentence = ''; /* 当前会话播报句(再听 ghost 口径) */
  let dlgConfirmH = null; /* respond 确认泵句柄 */
  let dlgDwellH = null; /* praise 停留泵句柄 */
  if (DIALOG_CORE) {
    dlg = DIALOG_CORE.mkDialogMachine({emit: onDlgEvent});
  } /* enterTown 会重建(新机新会话), 此处先备防进镇前事件 */

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
    /* 左上状态卡(town-hud-card 三件)已移除(PO 返工 2026-11-15: 卡丑且与
       现 UI 风格不一致; 机制层核心状态机/feed 链 headless 保留, 仅撤持久
       卡 DOM——四槽语义塌为三槽: L2 指引/L3 表扬/L4 返回) */
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
    /* T-UI-04 会话三件套: 独立 town-dlg- 命名空间(bubble/panel/praise
       平级; panel 内 speaker/thumb/body/opts/ghosts 子件恒等复用, 刷新
       只写文本/显隐/children, 零重建——签名门控在 refreshDlg) */
    dlgLayer = doc.createElement('div');
    dlgLayer.classList.add('town-dlg-layer');
    dlgBubble = doc.createElement('div');
    dlgBubble.classList.add('town-dlg-bubble');
    dlgBubble.setAttribute('data-state', 'idle');
    dlgBubble.hidden = true;
    dlgPanel = doc.createElement('div');
    dlgPanel.classList.add('town-dlg-panel');
    dlgPanel.setAttribute('data-state', 'idle');
    dlgPanel.hidden = true;
    dlgSpeaker = doc.createElement('div');
    dlgSpeaker.classList.add('town-dlg-speaker');
    dlgThumb = doc.createElement('div');
    dlgThumb.classList.add('town-dlg-thumb');
    dlgThumb.hidden = true;
    dlgBody = doc.createElement('div');
    dlgBody.classList.add('town-dlg-body');
    dlgOpts = doc.createElement('div');
    dlgOpts.classList.add('town-dlg-opts');
    dlgGhosts = doc.createElement('div');
    dlgGhosts.classList.add('town-dlg-ghosts');
    dlgPraise = doc.createElement('div');
    dlgPraise.classList.add('town-dlg-praise');
    dlgPraise.hidden = true;
    dlgPanel.appendChild(dlgSpeaker);
    dlgPanel.appendChild(dlgThumb);
    dlgPanel.appendChild(dlgBody);
    dlgPanel.appendChild(dlgOpts);
    dlgPanel.appendChild(dlgGhosts);
    dlgLayer.appendChild(dlgBubble);
    dlgLayer.appendChild(dlgPraise);
    dlgLayer.appendChild(dlgPanel);
    const homeBtn = doc.createElement('button');
    homeBtn.setAttribute('aria-label', '回主菜单');
    homeBtn.textContent = '🏠';
    homeBtn.onclick = () => {
      /* 宿主 chrome 页面缝(模式页 back 按钮先例); 本票不另造退出链 */
      if (typeof gotoPage === 'function') gotoPage('main');
    };
    sysSlot.appendChild(homeBtn);
    root.appendChild(pointerSlot);
    root.appendChild(praiseSlot);
    root.appendChild(sysSlot);
    root.appendChild(hlLayer);
    root.appendChild(dlgLayer);
    doc.body.appendChild(root);
  }

  /* ---------- apply: 核心态 → 槽显隐(每次喂核心后调用)。左上状态卡已移除
     (PO 返工 2026-11-15): 卡壳/三态文案/重播钮全撤, 核心态 cur 仍步进
     (机制 headless 保留——feed/L3 表扬/L2 指引语义不变) ---------- */
  function applyState() {
    if (!root) return;
    const d = TOWN_UI_CORE.townHudDimming(cur, dialogOpen);
    pointerSlot.hidden = d.l2 !== 'normal';
    sysSlot.hidden = false; /* L4 安全返回永不收敛 */
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

  /* 回望钟塔「看到了!」回礼(城镇翻新 TIDEA-16, U-05): 250ms 位姿采样驱动
     (sync 幂等分支调用, 零新增循环), 钟塔锚入视野中央(yaw 夹角 front 档,
     同族纯函数)给 L2 徽章一次性柔和脉冲——单次+冷却防刷, 不占 L3 夸奖
     通道(纯视觉, 钟鸣配对归波次三音频批)。armed=先观察到非正前再回正前
     (出生直视即烧的防误触, 保「回望」仪式感); 纯方位判定不查遮挡
     (钟塔=全镇地标尺度)。类写按 contains 守卫(同态重入零 classList) */
  function checkTowerSeen() {
    if (!pointerBadge || !root || root.hidden) return;
    const pose = poseRef();
    const anchor = bellTowerAnchor();
    if (!pose || !anchor) return; /* 几何输入缺一零判定(同 refreshPointer) */
    const heading = TOWN_UI_CORE.townPointerHeading(
        anchor.x - pose.x, anchor.z - pose.z, pose.yaw);
    if (heading !== 'front') {
      towerSeenArmed = true; /* 离开正前=预备「回望」语义 */
      return;
    }
    if (!towerSeenArmed) return; /* 未曾离开正前不烧触发(出生直视) */
    towerSeenArmed = false; /* 单次: 触发即撤臂(再看须先离开正前) */
    if (Date.now() - towerSeenLast < TOWN_TOWER_SEEN_COOLDOWN_MS) return;
    towerSeenLast = Date.now();
    if (!pointerBadge.classList.contains('seen-pulse')) {
      pointerBadge.classList.add('seen-pulse');
    }
    /* TIDEA-18: 回望回礼钟鸣配对一响(bell_town 同枚=TIDEA-02 迎宾钟, 语义
       统一「镇钟」; coolMs 350 不挡低频回望) */
    if (sfxFn) sfxFn('bell_town');
    clearHandle(towerPulseH);
    towerPulseH = timer.set(() => {
      pointerBadge.classList.remove('seen-pulse');
      towerPulseH = null;
    }, TOWN_TOWER_PULSE_MS);
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
      if (c.getAttribute('data-hl-id') === id) return c;
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

  /* 命中重算(仅鼠标事件到达时跑): cam/清单任一缺席→无命中(零伪造悬停)。
     城镇翻新波次三专项一: 判定源=bubbleCamRef(锚定功能档同源——hover 是
     气泡显隐的前置输入, 与锚定投影同一相机自洽; 产线 camRef=null 休眠态
     下只接本缝即可点亮「hover→气泡→点选会话」整链)。标记视觉档(refreshHl
     投影)仍吃 camRef=null→标记 hidden 全隐藏, hover 状态类写进隐藏标记=
     零视觉溢出(T-UI-03 命中/标记档登记不动的授权边界) */
  function recomputeHit() {
    const cam = bubbleCamRef();
    if (!cam || !cam.origin || !cam.dir) {
      hoveredId = null;
      hoveredEntry = null;
      refreshHl();
      return;
    }
    const candidates = [];
    for (const e of hlSource()) {
      if (e && e.id && e.anchor) candidates.push({id: e.id, anchor: e.anchor});
    }
    const hit = TOWN_UI_CORE.townHlHit(cam.origin, cam.dir, candidates, {});
    hoveredId = hit ? hit.id : null;
    hoveredEntry = hit ?
      hlSource().find((e) => e && e.id === hit.id) || null : null;
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
    refreshDlg(); /* hover 翻转→bubble 显隐随事件(签名门控) */
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
      onEntryClick(entry); /* 会话驱动缝先挂闸: open 先于 A 回流(settleFocus
         的 tts-hint 被会话冻结吞, 防 A 句污染会话播报) */
      settleFocus(entry);
      /* 恰一次派发命中对象载荷(五键, 协议面=dialog-spec §2.2 载荷形状) */
      onInteract({id: entry.id, kind: entry.kind, iconKey: entry.iconKey,
        label: entry.label, anchor: entry.anchor});
      /* 探索中点选开会话的收敛补喂: settleFocus 已把卡带到 active(tts-hint
         被闸吞), 核心 dialog-open 收敛边只认 active/step-done——此处补一次
         幂等收敛(已 dimmed 零动作) */
      if (dlg && dlg.state() !== 'idle') feed({type: 'dialog-open'});
    }
    refreshHl(); /* 抬起回弹: pressed 清, 仍在瞄→hover 恢复 */
  }

  /* ---------- T-UI-04 会话三件套装配(dialog-spec §2/§4-§7) ----------
     会话驱动缝: 点选 sessionKind 在册条目→开会话+自动 route(任务会话);
     会话中点中同目标=target-found(世界点选确认); landmark/prop 点选
     保持纯 A 侧结算既有行为零变。机器 emit→onDlgEvent 同实例闭环:
     open/close 转投 dialogEvent(A 收敛/恢复), update 驱动会话 DOM 刷新
     +步进播报(B4 每步一次)+confirm/dwell 泵(墙钟归装配层)。DOM 刷新
     全程签名门控(同态零 classList/零重建), chip/ghost onclick 闭包捕获
     id(不依赖 DOM 属性寻址)。 */
  /* 清空容器: children 是 live HTMLCollection(真浏览器无 pop 等数组方法,
     直调即 TypeError, S-1 评审教训)——子件增删唯一通道 appendChild/
     removeChild, 遍历只认 length/索引(源文本守门锁死数组方法直调) */
  function clearChildren(el) {
    while (el.children.length) el.removeChild(el.children[0]);
  }

  /* 点选会话驱动缝(landmark/prop 纯 A 零变; seek pending 中点中同目标=
     找到) */
  function onEntryClick(entry) {
    if (!dlg || !DIALOG_CORE) return;
    const snap = dlg.snapshot();
    if (snap.state === 'idle') {
      if (!entry.sessionKind) return; /* 无会话语义条目不开会话 */
      dlgCtx = {npcId: entry.id, npcLabel: entry.label,
        iconKey: entry.iconKey, sessionKind: entry.sessionKind,
        taskRef: entry.taskRef || null, targetIconId: entry.iconKey};
      dlg.handle({type: 'click-npc', payload: {entry}});
      /* route 派发在册判据(T-NPC-11): 只认 DIALOG_CORE.ROUTE_BY_KIND
         在册键(任务会话点选即接); greet/care 轻问候豁免零派发——
         会话停 greet 态, 走 [挥手再见]/[稍后] 出口。判据单份=core
         的 ROUTE_BY_KIND(双栖解析同源), 零第二份 kind 清单 */
      if (DIALOG_CORE.ROUTE_BY_KIND &&
          Object.prototype.hasOwnProperty.call(
              DIALOG_CORE.ROUTE_BY_KIND, entry.sessionKind)) {
        dlg.handle({type: 'route'}); /* 自动 route */
      }
    } else if (entry.id === snap.npcId && snap.hasPendingChoice) {
      dlg.handle({type: 'target-found', payload: {targetId: entry.id}});
    }
  }

  /* 会话层刷新(签名门控脏标): 状态/上下文/徽章级签名不变零 DOM 操作;
     面板 data-state 是可观测钩子(dialog-spec §11), 恒写不门控 */
  function refreshDlg() {
    if (!dlgLayer || !dlg || !root || root.hidden) return;
    const snap = dlg.snapshot();
    const view = DIALOG_CORE.dialogViewFor(snap.state, dlgCtx || {});
    const bubbleText = snap.state === 'idle' && hoveredEntry ?
      hoveredEntry.label || '' : '';
    const sig = [snap.state, dlgCtx ? dlgCtx.npcId : null,
      view.praise ? view.praise.level : '', bubbleText].join('|');
    const bubbleVisible = !!(snap.state === 'idle' && hoveredEntry);
    if (sig !== dlgSig) {
      dlgSig = sig;
      dlgPanel.setAttribute('data-state', snap.state);
      dlgPanel.hidden = snap.state === 'idle';
      if (dlgPanel.hidden) {
        dlgSpeaker.textContent = '';
        dlgBody.textContent = '';
        clearChildren(dlgOpts);
        clearChildren(dlgGhosts);
      } else {
        dlgSpeaker.textContent = view.panel.speaker.name;
        dlgBody.textContent = view.panel.body;
        renderDlgOptions(view.panel.options);
        renderDlgGhosts(view.panel.ghosts);
      }
      dlgThumb.hidden = !(view.panel && view.panel.thumb);
      if (view.panel && view.panel.thumb) {
        /* emoji 占位同 L1/L2 策略(UI-01 语义键入库前) */
        dlgThumb.textContent = TOWN_CARD_ICONS[dlgCtx.targetIconId] || '⭐';
      }
      dlgPraise.hidden = !view.praise;
      if (view.praise) {
        dlgPraise.textContent = view.praise.level === 'cheer' ? '🌟' : '⭐';
      }
      /* World Bubble 仅 idle 态环境感知(hover 驱动, 局部提示非会话) */
      dlgBubble.hidden = !bubbleVisible;
      if (dlgBubble.hidden) {
        dlgBubble.textContent = '';
        dlgBubble.setAttribute('data-state', 'idle');
      } else {
        dlgBubble.textContent = bubbleText;
        dlgBubble.setAttribute('data-state', 'bubble');
      }
    }
    /* 城镇翻新 TIDEA-14: 锚定位写不进签名门(相机转动签名不变, 位置必须
       跟帧——250ms 位姿采样经 sync 到此)——可见时无条件重投影; 隐藏/hover
       丢失时摘锚定残留(类+内联位, 不然下次气泡回底部固定位形态时残留
       内联位错位——内联优先级高于 CSS inset)。类写按 contains 守卫 */
    if (bubbleVisible && !dlgBubble.hidden) {
      positionBubbleAtSpeaker();
    } else if (dlgBubble.classList.contains('is-anchored')) {
      dlgBubble.classList.remove('is-anchored');
      dlgBubble.style.left = '';
      dlgBubble.style.top = '';
    }
    /* TIDEA-18 翻转沿对账(沿到沿响一声, 持续态零重响): 面板开合/表扬浮现/
       气泡冒出各一音; sfxFn 缺省 null 静默(沙盒/替身零音频依赖) */
    const openNow = snap.state !== 'idle';
    if (openNow !== dlgPanelOpen) {
      if (sfxFn) sfxFn('dlg_flip');
      dlgPanelOpen = openNow;
    }
    const praiseNow = openNow && !!view.praise;
    if (praiseNow && !dlgPraiseShown && sfxFn) sfxFn('praise_jingle');
    dlgPraiseShown = praiseNow;
    const bubbleNow = bubbleVisible && !dlgBubble.hidden;
    if (bubbleNow && !dlgBubbleShown && sfxFn) sfxFn('bubble_pop');
    dlgBubbleShown = bubbleNow;
  }

  /* 世界气泡锚定(城镇翻新 TIDEA-14, U-03): 说话人锚屏幕投影挂头顶, 尾尖
     指向说话人(指针槽同族投影面, 装具契约同 refreshHl); 投影缺席/出视野
     回落现有底部固定位(摘锚类+清内联位, CSS 兜底)——保底可用性优先。
     16px 安全区夹紧(offsetWidth 实测半宽; transform -50%/-100% 中心底
     对齐, 底边停在锚点上方 GAP 处)。类写按 contains 守卫(同态重入零
     classList 操作, 签名门控纪律同族) */
  function positionBubbleAtSpeaker() {
    const cam = bubbleCamRef(); /* 锚定档专用源(波次三专项一; 缺省回落 camRef) */
    const anchor = hoveredEntry && hoveredEntry.anchor;
    let proj = null;
    if (cam && cam.origin && anchor) {
      proj = TOWN_UI_CORE.townHlProject({
        x: cam.origin.x, y: cam.origin.y, z: cam.origin.z,
        yaw: cam.yaw, pitch: cam.pitch, fovDeg: cam.fovDeg,
        aspect: cam.aspect, vw: cam.vw, vh: cam.vh,
      }, anchor);
    }
    if (!proj || !proj.visible) {
      if (dlgBubble.classList.contains('is-anchored')) {
        dlgBubble.classList.remove('is-anchored');
      }
      dlgBubble.style.left = '';
      dlgBubble.style.top = '';
      return;
    }
    const halfW = (dlgBubble.offsetWidth || 0) / 2;
    const height = dlgBubble.offsetHeight || 0;
    const minX = TOWN_BUBBLE_SAFE + halfW;
    const maxX = Math.max(minX, (cam.vw || 0) - TOWN_BUBBLE_SAFE - halfW);
    const x = Math.min(Math.max(proj.x, minX), maxX);
    const minY = TOWN_BUBBLE_SAFE + height + TOWN_BUBBLE_GAP;
    if (!dlgBubble.classList.contains('is-anchored')) {
      dlgBubble.classList.add('is-anchored');
    }
    dlgBubble.style.left = x + 'px';
    dlgBubble.style.top = Math.max(proj.y - TOWN_BUBBLE_GAP, minY) + 'px';
  }

  function renderDlgOptions(options) {
    clearChildren(dlgOpts);
    for (const opt of options) {
      const chip = doc.createElement('button');
      chip.classList.add('town-dlg-chip');
      chip.textContent = opt.label;
      const intent = opt.intent;
      const optionId = opt.id;
      chip.onclick = () => {
        if (!dlg) return;
        if (sfxFn) sfxFn('chip_pop'); /* TIDEA-18: 选项轻点 pop(轻快短音) */
        dlg.handle({type: intent, payload: {optionId}});
      };
      dlgOpts.appendChild(chip);
    }
  }

  function renderDlgGhosts(ghosts) {
    clearChildren(dlgGhosts);
    for (const g of ghosts) {
      const btn = doc.createElement('button');
      btn.classList.add('town-dlg-ghost');
      btn.textContent = g.label;
      const ghostId = g.id;
      btn.onclick = () => {
        if (!dlg) return;
        if (ghostId === 'defer') dlg.handle({type: 'defer'});
        else if (ghostId === 'replay') replayDlgSentence();
      };
      dlgGhosts.appendChild(btn);
    }
  }

  /* 再听当前句(§6.2): replay 不进机器(状态不推进), 装配层 TTS 直执行;
     cancel-then-speak 单通道不重叠抢话 */
  function replayDlgSentence() {
    speech.cancel();
    if (dlgSentence) speech.speak(dlgSentence);
  }

  /* 会话步进播报(B4 每步自动一次): greet 瞬态(在册键将至 route)不播
     =矩阵 greet 行照旧; greet/care 豁免键驻留 greet 态播问候句
     (§2.2 矩阵 greet 行自动一次, T-NPC-11 轻问候路径)。判据同源
     DIALOG_CORE.ROUTE_BY_KIND: 在册=瞬态(零双播), 不在册=驻留(播) */
  function speakDlgStep(step) {
    if (step === 'greet') {
      const kind = dlgCtx ? dlgCtx.sessionKind : null;
      if (!DIALOG_CORE.ROUTE_BY_KIND ||
          Object.prototype.hasOwnProperty.call(
              DIALOG_CORE.ROUTE_BY_KIND, kind)) return;
    }
    const line = DIALOG_CORE.dialogUtterFor(step, dlgCtx || {});
    if (!line) return;
    speech.cancel();
    dlgSentence = line;
    speech.speak(line);
  }

  function dlgConfirmFire() {
    dlgConfirmH = null;
    if (dlg) dlg.handle({type: 'confirm'});
  }

  function dlgDwellFire() {
    dlgDwellH = null;
    if (dlg) dlg.handle({type: 'next-step'}); /* N3 dwell 自动步进 */
  }

  /* F5: 取 praiseTotalMs 窗上限——表扬句完整可听再步进(1.2s 下限档会被 cancel 截断, PO 待裁条款 8 消解) */
  function dlgDwellMs() {
    return DIALOG_CORE && DIALOG_CORE.DIALOG_OPTS ?
      DIALOG_CORE.DIALOG_OPTS.praiseTotalMs[1] : 2000;
  }

  /* 机器 emit 闭环: open/close 转投 A 侧 seam(dialogEvent 同实例),
     update 驱动刷新+播报+泵(收敛补喂在 onHlUp 链尾: settleFocus 之后) */
  function onDlgEvent(name, payload) {
    payload = payload || {};
    if (name === DIALOG_CORE.DIALOG_EVENTS.OPEN) {
      dialogEvent(name, payload);
      refreshDlg();
    } else if (name === DIALOG_CORE.DIALOG_EVENTS.UPDATE) {
      refreshDlg();
      speakDlgStep(payload.step);
      if (payload.step === 'respond') {
        clearHandle(dlgConfirmH);
        dlgConfirmH = timer.set(dlgConfirmFire, DLG_CONFIRM_MS);
      } else if (payload.step === 'praise') {
        clearHandle(dlgDwellH);
        dlgDwellH = timer.set(dlgDwellFire, dlgDwellMs());
      }
    } else if (name === DIALOG_CORE.DIALOG_EVENTS.CLOSE) {
      dialogEvent(name, payload); /* A 恢复/落完成先于会话层收敛 */
      clearHandle(dlgConfirmH);
      clearHandle(dlgDwellH);
      dlgConfirmH = null;
      dlgDwellH = null;
      dlgCtx = null;
      refreshDlg();
    }
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
       收敛边, praise-show 的落地闸由装配层承担——dialogOpen=true 时意图照
       收但不落地(不弹表扬, dialog-spec §2.2 会话播报优先); close 先摘闸再
       喂(dialogEvent), close 自身 done+taskRef 的落完成+表扬照给(会话避让
       测试锁死), 冻结随会话解除非永久静音。tts-hint 意图随左上状态卡移除
       不再落地(卡话术 TTS 伴随面; 核心态步进照收, PO 返工 2026-11-15) */
    if (dialogOpen) return;
    for (const intent of out.intents) {
      if (intent === 'praise-show' && root) {
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
    hoveredEntry = null;
    /* 城镇翻新 TIDEA-16 会话态进场结转: 钟塔回望臂/冷却/脉冲全清零串轮
       (TIDEA-19 首访提示结转随左上状态卡移除一并清, PO 返工 2026-11-15) */
    towerSeenArmed = false;
    towerSeenLast = 0;
    clearHandle(towerPulseH);
    towerPulseH = null;
    /* TIDEA-18 翻转沿记忆随进镇清(新机新账, 防残留漏误) */
    dlgPanelOpen = false;
    dlgPraiseShown = false;
    dlgBubbleShown = false;
    if (pointerBadge && pointerBadge.classList.contains('seen-pulse')) {
      pointerBadge.classList.remove('seen-pulse');
    }
    if (DIALOG_CORE) {
      dlg = DIALOG_CORE.mkDialogMachine({emit: onDlgEvent});
      dlgCtx = null; /* 新机新会话: 上下文/签名/播报句全清(可重入零串轮) */
      dlgSig = null;
      dlgSentence = '';
      dlgSessionHad = false; /* PO 案①: 会话留痕随进镇清(新轮新账) */
    }
    /* 进场喂核心不依赖 DOM 成败(doc 缺席沙盒态照走, applyState 自守卫) */
    feed({type: 'enter'});
    refreshDlg(); /* 会话层初始落位(data-state=idle 面板隐藏) */
    refreshPointer(); /* 进镇弱提示按当帧位姿重算(签名记忆已被离镇清零) */
    buildHlMarks(); /* 高亮标记挂出(幂等复用, 新机新账) */
    refreshHl(); /* 按当帧视采样落位/显隐 */
    attachHlListeners(); /* 文档级三件套(离镇镜像摘除) */
  }

  function leaveTown() {
    if (dlg && (dlg.state() !== 'idle' || dlgSessionHad)) {
      /* 会话中离镇=defer 语义收会话(A 收 deferred 恢复 prev 卡态, 零
         负面); close 事件已恢复卡态, 跳过 feed(leave)——leave 会把卡
         推回 hidden, 覆盖 close 的恢复语义。PO 案①(树 3c89723)扩门:
         本镇轮已收口过的会话(走远 defer 先收, dlgSessionHad 留痕)同此
         口——idle 态 defer 零惩罚拒绝 no-op, 卡态保持 CLOSE 已复原值;
         未开过会话的纯离场才 feed(leave) 推 hidden(既有语义) */
      dlg.handle({type: 'defer'});
    } else {
      feed({type: 'leave'});
    }
    if (root) root.hidden = true;
    speech.cancel(); /* 提示句不残声 */
    clearHandle(praiseHideH);
    clearHandle(elapseH);
    praiseHideH = null;
    elapseH = null;
    clearHandle(dlgConfirmH); /* 会话泵随离镇清(零跨轮误发) */
    clearHandle(dlgDwellH);
    dlgConfirmH = null;
    dlgDwellH = null;
    /* 城镇翻新 TIDEA-16: 脉冲句柄/回望臂随离镇清(零跨轮误摘误烧) */
    clearHandle(towerPulseH);
    towerPulseH = null;
    towerSeenArmed = false;
    towerSeenLast = 0;
    if (pointerBadge && pointerBadge.classList.contains('seen-pulse')) {
      pointerBadge.classList.remove('seen-pulse');
    }
    dlgCtx = null;
    dlgSentence = '';
    dlgSig = null; /* 会话层签名记忆清零(再进零残留) */
    hoveredEntry = null;
    refreshDlg(); /* 会话层收敛(面板/气泡收起) */
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

  /* PO 案①(树 3c89723) 镇内会话走远收口: 会话中水平远离对话对象超阈即
     defer 收会话(leaveTown :992-999 会话半边同构 CLOSE 链, 零新事件名;
     A 卡 deferred 复原, HUD 不收敛——镇内走远≠离镇, 与 leaveTown 的区分
     面)。锚=会话上下文 npcId 回查高亮清单(锚点单源在条目, 清单缺席/无锚
     容差跳过), 位姿=poseRef 低频采样(缺省沙盒 null 同跳过), 阈值=参数表
     DLG_AWAY_DIST 单源(锁表即规格, 阈内会话存活零抖动) */
  function checkDialogAway() {
    if (!dlg || !dlgCtx || dlg.state() === 'idle') return;
    const entry = hlSource().find((e) => e && e.id === dlgCtx.npcId);
    const pose = poseRef();
    if (!entry || !entry.anchor || !pose) return;
    if (Math.hypot(pose.x - entry.anchor.x, pose.z - entry.anchor.z) >
        TOWN_UI_CORE.TOWN_UI_PARAMS.DLG_AWAY_DIST) {
      dlg.handle({type: 'defer'}); /* CLOSE 链收口(onDlgEvent 内含卡态复原+面板收敛) */
    }
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
      /* 城镇翻新 TIDEA-14/16: 位姿采样半边——气泡锚位跟帧(refreshDlg
         内容照签名门控, 锚位写在其门之外) + 钟塔回望查检 */
      checkDialogAway(); /* PO 案①: 会话走远收口(与下行刷新同排零新泵; 收口走
          CLOSE 链内含 refreshDlg, 未收口/阈内时零动作) */
      refreshDlg();
      checkTowerSeen();
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
      dlgSessionHad = true; /* PO 案①: 本镇轮会话留痕(掉机时不覆盖 close 复原) */
      feed({type: 'dialog-open'});
      /* 城镇翻新 TIDEA-13: 会话档全隐 hotbar/气泡条(H 层补遗二契约, 优先级高于
         漫步淡档)——class 与 style.css 的 body.adv-dim-town 门控叠加, 关会话
         回落淡档。doc 判法同高亮层挂载(284 行先例)。 */
      if (doc && doc.body) doc.body.classList.add('town-dialog-open');
      refreshHl(); /* 会话降噪档随开落位(选中环保持/其余隐藏) */
    } else if (name === 'town-ui/dialog/close') {
      /* 先摘会话闸再喂: close(done) 的表扬意图要能落槽(L3 会话中冻结由
         核心承担, 关闸后解冻)。greet done 事件 feed 链保留(机制层 headless,
         玩法侧消费 payload.result/taskRef)——TIDEA-19 首访记账随左上状态卡
         移除一并清(PO 返工 2026-11-15) */
      dialogOpen = false;
      if (doc && doc.body) doc.body.classList.remove('town-dialog-open'); /* TIDEA-13: 回漫步淡档 */
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
    /* 城镇翻新波次三专项一: 锚定档视采样源运行时换装(app 层进镇 boot 注入) */
    attachBubbleCam(fn) {
      bubbleCamFn = fn || null;
    },
    get root() {
      return root;
    },
  };
}

/* ---------- 自动实例与 emit 全局缝(模块装载零 DOM 触碰: mount 惰性到
    首次事件/进镇, boot 冒烟 vm 全放行桩不炸) ---------- */
const TownUi = mkTownUi({
  sfx: (typeof sfx === 'function') ? sfx : null, /* TIDEA-18: 页全局 sfx 直通(audio.js 先于本文件装载); Node 沙盒无→null 静默 */
});

/* adventure.js 建机步 emit 实参(守卫式: 本文件未装载时退回空旁路) */
function townUiTargetEvent(name, payload) {
  TownUi.targetEvent(name, payload);
}

/* 城镇翻新波次三专项一(lead 扩权): 世界气泡锚定档视采样源接线缝——app 层
   (adventure.js advTownInteractBoot)把真相机参数喂进自动实例, 引擎零改动;
   只活锚定档, T-UI-03 命中/标记档仍随 camRef=null 休眠(授权边界) */
function townUiAttachBubbleCam(fn) {
  TownUi.attachBubbleCam(fn);
}

if (typeof requestAnimationFrame === 'function') {
  TownUi.start(); /* 浏览器节流对账; Node/沙盒无 rAF 不启动 */
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {mkTownUi};
}
