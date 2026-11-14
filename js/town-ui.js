'use strict';
/* ============================================================
   城镇 HUD 适配层 (TownUi) — 应用层·DOM 装配
   ------------------------------------------------------------
   一句话职责: 把 town-ui-core 的五态决策落到 #townHud 四槽 DOM——机器
   身份对账(进镇挂/离镇收/新机清)、emit 事件消费、TTS 意图与表扬节奏
   落地、会话避让监听入口(L2 槽位本票只预留, 指引内容归 T-UI-02)。
   interface: mkTownUi({doc, machineRef, speech, timer, showPage, raf})
      → {targetEvent(name, payload), dialogEvent(name, payload), sync(),
      start(), cardState(), root} · TownUi(自动实例) ·
      townUiTargetEvent(name, payload)(adventure.js 建机步 emit 实参)
   依赖(均经全局名, 调用期解析): town-ui-core.js 的 TOWN_UI_PARAMS/
      townHudCardState/townHudDimming/townHintSentence(必须先装载; 经典
      script 共享词法直用, Node require 走 core 的 CJS 导出面解析);
      speech.js SpeechKit(缺省桩); modes/adventure.js AdventureMode.adv.
      advTownState(缺省机器挂点, 闭包内惰性解析); 宿主 chrome showPage
      (缺省 null); index.html 装载序 town-interact-core → town-ui-core →
      本文件 → mode-registry。
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
  {TOWN_UI_PARAMS, townHudCardState, townHudDimming, townHintSentence} :
  (typeof module !== 'undefined' && module.exports ?
    require('./town-ui-core.js') : null);

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
      const el = {
        tag, children: [], parent: null, hidden: false, textContent: '',
        attrs: {}, style: {}, onclick: null,
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
          el.attrs[k] = String(v);
        },
        getAttribute(k) {
          return el.attrs[k];
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
  let root = null; /* 挂载前 null(零常驻 DOM, 未进镇不挂载) */
  let card = null;
  let pointerSlot = null;
  let praiseSlot = null;
  let sysSlot = null;
  let iconEl = null;
  let labelEl = null;
  let ttsBtn = null;
  let praiseEl = null;
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
    pointerSlot.classList.add('town-hud-pointer'); /* 槽位空留, T-UI-02 填充 */
    praiseSlot = doc.createElement('div');
    praiseSlot.classList.add('town-hud-praise');
    sysSlot = doc.createElement('div');
    sysSlot.classList.add('town-hud-sys');
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
    /* 进场喂核心不依赖 DOM 成败(doc 缺席沙盒态照走, applyState 自守卫) */
    feed({type: 'enter'});
  }

  function leaveTown() {
    feed({type: 'leave'});
    if (root) root.hidden = true;
    speech.cancel(); /* 提示句不残声 */
    clearHandle(praiseHideH);
    clearHandle(elapseH);
    praiseHideH = null;
    elapseH = null;
  }

  function sync() {
    const m = machineRef();
    if (!seenMachine) {
      seenMachine = true;
      prevMachine = m;
      if (m) enterTown(); /* 首次对账即按 m 有无动作(root 未事件前保持 null) */
      return;
    }
    if (m === prevMachine) return; /* 幂等零动作 */
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
    } else if (name === 'town-ui/target/update') {
      if (!root) mount();
      if (payload.state === 'done') doneIds.add(payload.id);
      feed({type: 'target-update', id: payload.id, state: payload.state});
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
    } else if (name === 'town-ui/dialog/close') {
      /* 先摘会话闸再喂: close(done) 的表扬意图要能落槽(L3 会话中冻结由
         核心承担, 关闸后解冻) */
      dialogOpen = false;
      feed({type: 'dialog-close', result: payload.result,
        taskRef: payload.taskRef, prev: prevCardState});
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
