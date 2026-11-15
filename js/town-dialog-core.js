'use strict';
/* ============================================================
   会话状态机纯核心 (TownDialogCore, 术语见 GLOSSARY「TownDialogCore」)
   — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: 小镇 NPC 会话的纯决策面——九态状态机+关闭三值路由+徽章
   累积+TTS 仲裁+HUD 收敛档+三件套视图/话术派生; DOM/CSS/墙钟节奏归
   适配层 js/town-ui.js, 本层只算数不渲染。
   interface: DIALOG_STATES(冻结九态) · DIALOG_INTENTS(冻结意图词表)
      · DIALOG_TRANSITIONS(冻结转移表, 数组值=多值边) · DIALOG_OPTS
      (冻结参数表 B1-B8+N 系) · TTS_PRIORITIES(冻结五级优先级) ·
      DIALOG_EVENTS(事件名常量) · mkDialogMachine({emit}) →
      {handle, state, snapshot}(非法意图零惩罚拒绝 {changed:false}) ·
      dialogBadgesAfter(before, badge) 纯函数(尾追加, badgesMax 封顶
      丢新不顶替, 入参零突变) · ttsPlanFor(utter, queue, arb) 纯函数
      (drop|now|queue 三裁决) · hudConvergenceFor(state) 纯函数(A 侧
      收敛档单源) · dialogViewFor(state, ctx) 纯函数(三件套视图模型)
      · dialogUtterFor(state, ctx) 纯函数({n} 插值, 无句态返回 null)
   依赖: 零运行时依赖——不引用引擎/THREE/DOM/墙钟/随机; 九态与转移
      边出自 docs/design/town-ui-dialog-spec.md §5/§2, 参数与仲裁出自
      docs/design/town-ui-dialog-prebuild.md §4/§6; sessionKind 值域
      权威=js/town-interact-core.js TOWN_SESSION_KINDS(本层只透传)。
   可测性声明: 零 THREE·零 DOM·零墙钟·零随机·同参同输出·加载零副
      作用; 有同名单测 (test/town-dialog-core.test.js)。
   ============================================================ */

/* ---------- 冻结常量面: 锁表即规格, 单测逐键断言 ---------- */
/* B 侧图标语义名(B5 挥手再见/ghost 再听): 非工坊像素键——装配层只用
   label 不渲染 icon, 像素资产入库归 UI-01 线; 以常量承载, 不落按钮
   图标守网的字面量收网口径(test/button-icons.test.js 扫 icon: '键') */
const CLOSE_ICON_WAVE_BYE = 'wave-bye';
const GHOST_ICON_REPLAY = 'replay';

const DIALOG_STATES = Object.freeze([
  'idle', 'bubble', 'greet', 'guide', 'seek', 'help', 'respond', 'praise',
  'complete',
]);

/* 意图词表(prebuild §2.2 十词+confirm 桥接; replay 不进机器=装配层直执行) */
const DIALOG_INTENTS = Object.freeze([
  'focus', 'blur', 'click-npc', 'route', 'pick-option', 'defer', 'end',
  'target-found', 'confirm', 'next-step', 'continue-explore',
]);

/* 参数表 B1-B8+N 系(dialog-spec §5.4/§7.1; prebuild §6 总表)+TTS 仲裁
   参数(§4.2)。禁词锁定: 无 timeout/countdown/fail/penalty 族键
   (零倒计时零失败态, §6.3, 单测守门)。 */
const DIALOG_OPTS = Object.freeze({
  panelAnchor: 'bottom-center', /* B1 底部居中 */
  ambientBubbles: false, /* B2 背景 NPC 闲聊默认关闭 */
  maxOptionsPerStep: 3, /* B3 每步选项上限 */
  allowNestedChoice: false, /* B3 无二级嵌套 */
  ttsAutoPerStep: 'once', /* B4 每步自动播一次 */
  ttsRespectMute: true, /* B4 遵循系统静音 */
  closeAffordance: Object.freeze({label: '稍后', icon: CLOSE_ICON_WAVE_BYE}), /* B5 */
  seekTargetThumb: 'persistent', /* B6 目标缩略图常驻 */
  golemCareSession: 'light', /* B7 关怀首版轻交互 */
  praiseSharedComponent: true, /* B8 与 A 反馈构件同源 */
  praiseSessionCompact: true, /* B8 会话内更紧凑 */
  praiseAutoAdvance: true, /* N3 表扬停留后自动步进 */
  badgesMax: 3, /* 徽章累积 1-3 枚(§7.1) */
  praiseInMs: 180, /* 徽章弹入 180ms(§5.4) */
  praiseDwellMinMs: 800, /* 徽章停留下限(§5.4) */
  praiseTotalMs: Object.freeze([1200, 2000]), /* 表扬总时长窗(§4.2) */
  ttsPreempt: 'higher-only', /* 严格更高优先级才抢占 */
  ttsQueueMax: 2, /* 队列上限 */
  ttsSuppressAInSession: true, /* 会话中抑制 A 侧自动播报 */
  ttsDebounceSameMs: 800, /* 同句去抖窗 */
});

/* TTS 五级优先级表(prebuild §4.2): P0 氛围/P2 A 任务/P4 步进=表扬/
   P5 手动重播 */
const TTS_PRIORITIES = Object.freeze({
  ambient: 0,
  aTask: 2,
  step: 4,
  praise: 4,
  replay: 5,
});

/* 事件名常量(B→A seam 对名用, 装配层经此接线不散抄字面量) */
const DIALOG_EVENTS = Object.freeze({
  OPEN: 'town-ui/dialog/open',
  UPDATE: 'town-ui/dialog/update',
  CLOSE: 'town-ui/dialog/close',
});

/* ---------- 转移表(dialog-spec §5.2 状态图逐边; 数组值=多值边,
   分路裁决: payload.to 显式优先→route 按 sessionKind→next-step 缺省
   complete 单步完成) ---------- */
const DIALOG_TRANSITIONS = Object.freeze({
  idle: Object.freeze({focus: 'bubble'}),
  bubble: Object.freeze({'blur': 'idle', 'click-npc': 'greet'}),
  greet: Object.freeze({
    'route': Object.freeze(['guide', 'seek', 'help']),
    'defer': 'idle',
    'end': 'idle',
    'pick-option': 'idle',
  }),
  guide: Object.freeze({'pick-option': 'respond', 'defer': 'idle'}),
  seek: Object.freeze({'target-found': 'respond', 'defer': 'idle'}),
  help: Object.freeze({'pick-option': 'respond', 'defer': 'idle'}),
  respond: Object.freeze({confirm: 'praise', defer: 'idle'}),
  praise: Object.freeze({
    'next-step': Object.freeze(['guide', 'seek', 'help', 'complete']),
    'defer': 'idle',
    'end': 'idle', /* 表扬中直接再见=收口(不阻塞出口, §5.4) */
  }),
  complete: Object.freeze({'end': 'idle', 'continue-explore': 'idle'}),
});

/* ---------- 内部映射(私有, 不导出) ---------- */
/* route 分路: sessionKind→目标态; intent 词(guide=tour/seek=find/
   help=give, dialog-spec §2.2 矩阵) */
const ROUTE_BY_KIND = {tour: 'guide', seek: 'seek', help: 'help'};
const ROUTE_INTENT = {guide: 'tour', seek: 'find', help: 'give'};
/* 等待玩家选择的态(greet 的等待语义=面板选项, 不在此列) */
const PENDING_STEP = {guide: true, seek: true, help: true};
/* 表扬徽章资产映射(prebuild §4.1): 帮助/关爱=flower, 寻找/观察=star */
const PRAISE_ICON_BY_KIND = {help: 'flower', golem: 'flower'};
/* 话术模板(§4.4/§8): {n}=目标名插值; 零倒计时零失败语义(§6.3); 夸过程不夸标签(§7.1) */
const DIALOG_UTTER_TPL = Object.freeze({
  greet: '你好呀, 见到你真开心!',
  guide: '跟我一起去看看吧!',
  seek: '我们一起来{n}吧!',
  help: '请把东西拿给我吧!',
  respond: '找到啦, 你找得真认真!',
  praise: '做得好!给你一颗小星星!',
  complete: '我们完成啦, 你帮了大忙!',
});
/* 面板引导短句(§8 短文案 1-4 字辅助语义, 装配层可直用) */
const PANEL_BODY = Object.freeze({
  greet: '你好呀!',
  guide: '跟我一起去看看吧!',
  seek: '找到它, 点一点!',
  help: '把东西拿给我吧!',
  respond: '找到啦!',
  praise: '谢谢帮忙!',
  complete: '完成啦!',
});

/* ---------- 徽章累积(§7.1 只增不减不清零): 尾追加, badgesMax 封顶
   丢新不顶替; 纯函数红线=入参零突变, 追加元素恰为 {iconId} ---------- */
function dialogBadgesAfter(before, badge) {
  const out = (before || []).map((b) => ({iconId: b.iconId}));
  if (badge && out.length < DIALOG_OPTS.badgesMax) {
    out.push({iconId: badge.iconId});
  }
  return out;
}

/* ---------- TTS 仲裁(prebuild §4.2): 裁决序 ①A 通道会话内抑制
   drop→②空闲通道直接播→③严格更高优先级抢占→④队满丢新句→⑤入队;
   纯函数: queue 入参零突变 ---------- */
function ttsPlanFor(utter, queue, arb) {
  arb = arb || {};
  queue = queue || [];
  if (arb.inSession && arb.suppressAInSession && utter &&
    utter.channel === 'A') {
    return {mode: 'drop'};
  }
  const cur = arb.currentPriority;
  if (cur === null || cur === undefined) {
    return {mode: 'now', cancelCurrent: false};
  }
  if (utter && utter.priority > cur && arb.preempt === 'higher-only') {
    return {mode: 'now', cancelCurrent: true};
  }
  if (queue.length >= (arb.queueMax || 0)) {
    return {mode: 'drop'};
  }
  return {mode: 'queue'};
}

/* ---------- A 侧收敛档单源(prebuild §3.1): idle/bubble 全恢复档
   (bubble 非会话不收敛); 会话七态单档=L1/L2 暂隐+L3 让位(表扬归 B)
   +世界降噪+A 播报抑制 ---------- */
function hudConvergenceFor(state) {
  if (state === 'idle' || state === 'bubble') {
    return {aL1: 'full', aL2: 'full', aL3: 'full', aWorld: 'full',
      aAutoTts: 'full'};
  }
  return {aL1: 'hidden', aL2: 'hidden', aL3: 'frozen', aWorld: 'min',
    aAutoTts: 'suppressed'};
}

/* ---------- 视图派生: 三件套视图模型(dialog-spec §4/§6)。
   只出语义键(iconKey/iconId/label), glyph 翻译归装配层。 ---------- */
function panelGhosts() {
  return [
    {id: 'defer', label: DIALOG_OPTS.closeAffordance.label,
      icon: DIALOG_OPTS.closeAffordance.icon},
    {id: 'replay', label: '再听一次', icon: GHOST_ICON_REPLAY},
  ];
}

function panelOptionsFor(state) {
  if (state === 'greet') {
    return [{id: 'wave', label: '挥手再见', intent: 'pick-option'}];
  }
  if (state === 'guide') {
    return [{id: 'ok', label: '知道啦', intent: 'pick-option'}];
  }
  if (state === 'help') {
    return [{id: 'give', label: '给你', intent: 'pick-option'}];
  }
  if (state === 'complete') {
    return [{id: 'continue', label: '继续看看', intent: 'continue-explore'},
      {id: 'bye', label: '再见', intent: 'end'}];
  }
  return [];
}

function praiseViewFor(state, ctx) {
  if (state !== 'praise' && state !== 'complete') return null;
  const iconId = PRAISE_ICON_BY_KIND[ctx.sessionKind] || 'star';
  return {level: state === 'praise' ? 'light' : 'cheer', iconId};
}

function dialogViewFor(state, ctx) {
  ctx = ctx || {};
  if (state === 'idle') {
    return {bubble: null, panel: null, praise: null};
  }
  if (state === 'bubble') {
    return {bubble: {size: 'S', label: ctx.npcLabel || '',
      iconKey: ctx.iconKey || null}, panel: null, praise: null};
  }
  const panel = {
    speaker: {name: ctx.npcLabel || ''},
    body: PANEL_BODY[state] || '',
    options: panelOptionsFor(state),
    ghosts: panelGhosts(),
    thumb: state === 'seek' ? {iconId: ctx.targetIconId || null} : null,
    hasPendingChoice: PENDING_STEP[state] === true,
  };
  return {bubble: null, panel, praise: praiseViewFor(state, ctx)};
}

/* ---------- 话术派生(§4.4): 会话七态有句({n} 插值目标名);
   bubble/idle 不播(矩阵行, 避免与 A 抢话)返回 null ---------- */
function dialogUtterFor(state, ctx) {
  const tpl = DIALOG_UTTER_TPL[state];
  if (!tpl) return null;
  return tpl.replace('{n}', (ctx && ctx.npcLabel) || '');
}

/* ---------- 会话状态机工厂: 零墙钟(表扬停留节奏归装配层 timer);
   open 恰发一次; close 类边=事件先于状态复位派生(携复位前 taskRef);
   payload 键仅在有值时写入 ---------- */
function mkDialogMachine(opts) {
  const emit = opts && typeof opts.emit === 'function' ?
    opts.emit : function() {};
  let state = 'idle';
  let npcId = null;
  let npcLabel = null;
  let anchor = null;
  let sessionKind = null;
  let taskRef = null;
  let stepN = 0;
  let badges = [];

  function resetSession() {
    npcId = null;
    npcLabel = null;
    anchor = null;
    sessionKind = null;
    taskRef = null;
    stepN = 0;
    badges = [];
  }

  function snapshot() {
    return {
      state,
      npcId,
      sessionKind,
      taskRef,
      stepN,
      badges: badges.map((b) => ({iconId: b.iconId})),
      canClose: true, /* 无压力出口恒可关(§6.2) */
      hasPendingChoice: PENDING_STEP[state] === true,
      targetIconId: null,
    };
  }

  function openPayload() {
    const p = {npcId,
      anchor: anchor ? {x: anchor.x, y: anchor.y, z: anchor.z} : null,
      sessionKind};
    if (taskRef) p.taskRef = taskRef;
    return p;
  }

  function updatePayload(step, intent) {
    const p = {step, canClose: true,
      hasPendingChoice: PENDING_STEP[step] === true};
    if (intent) p.intent = intent;
    return p;
  }

  function closePayload(result) {
    const p = {result};
    if (taskRef) p.taskRef = taskRef; /* 复位前透传(A 落常驻用) */
    return p;
  }

  /* 多值边分路: payload.to 显式优先(裁决权移交, 仅限边数组内 outcome);
     route 缺省按 sessionKind 映射; next-step 缺省=单步会话本轮完成。
     越边 to(不在边数组内)→null, 调用点零惩罚拒绝: 机器不产生表外态,
     也不经 close 侧门收会话(§5.3-1/2 运行时半边) */
  function resolveBranch(type, payload, allowed) {
    if (payload && payload.to) {
      return allowed.includes(payload.to) ? payload.to : null;
    }
    if (type === 'route') return ROUTE_BY_KIND[sessionKind] || 'guide';
    return 'complete';
  }

  function handle(ev) {
    const type = ev && ev.type;
    const payload = (ev && ev.payload) || {};
    /* click-npc 开会话双起步: idle 直达(装配层点选即开, 转移表图外,
       §2.2「点选接任务」入口)+bubble 图内边; 会话中重复点选无此边
       (零惩罚拒绝=open 不重发) */
    const to = type === 'click-npc' &&
      (state === 'idle' || state === 'bubble') ? 'greet' :
      (DIALOG_TRANSITIONS[state] || {})[type];
    if (!to) return {changed: false, events: []}; /* 非法意图零惩罚拒绝 */
    const next = Array.isArray(to) ? resolveBranch(type, payload, to) : to;
    if (!next) return {changed: false, events: []}; /* 多值边越边 to 零惩罚拒绝 */
    const events = [];
    const fire = (name, p) => {
      events.push({name, payload: p});
      emit(name, p);
    };
    if (type === 'focus' || type === 'blur') {
      state = next; /* 局部提示往返零 dialog 事件(A 不收敛, prebuild §1.3) */
      return {changed: true, events};
    }
    if (type === 'click-npc') {
      const entry = payload.entry || {};
      npcId = entry.id || null;
      npcLabel = entry.label || null;
      anchor = entry.anchor ?
        {x: entry.anchor.x, y: entry.anchor.y, z: entry.anchor.z} : null;
      sessionKind = entry.sessionKind || 'greet'; /* 无任务条目=轻问候 */
      taskRef = entry.taskRef || null;
      /* 先切态再派发: emit 闭环里装配层即时读 snapshot 须见新态 */
      state = next;
      fire(DIALOG_EVENTS.OPEN, openPayload());
      fire(DIALOG_EVENTS.UPDATE, updatePayload('greet'));
      return {changed: true, events};
    }
    if (next === 'idle') {
      /* close 三值路由(§2.3): payload 先于复位构造(携复位前 taskRef),
         态先切再派发, 复位收尾。defer=零负面 deferred; complete+end=done;
         continue-explore 与轻问候收尾(pick-option/end)=continue */
      const result = type === 'defer' ? 'deferred' :
        (type === 'end' && state === 'complete' ? 'done' : 'continue');
      state = next;
      fire(DIALOG_EVENTS.CLOSE, closePayload(result));
      resetSession();
      return {changed: true, events};
    }
    if (type === 'route') {
      stepN = 1;
    } else if (next === 'respond') {
      /* target-found(seek)/pick-option(guide|help)→系统确认步 */
      stepN += 1;
    } else if (next === 'praise') {
      /* confirm→表扬: 徽章累积一枚(§7.1 不倒扣不清零) */
      stepN += 1;
      badges = dialogBadgesAfter(badges,
          {iconId: PRAISE_ICON_BY_KIND[sessionKind] || 'star'});
    } else if (Array.isArray(to)) {
      /* praise/next-step 数组边(to 已解析为单值) */
      stepN += 1;
    }
    state = next;
    fire(DIALOG_EVENTS.UPDATE,
        updatePayload(next, type === 'route' ? ROUTE_INTENT[next] : undefined));
    return {changed: true, events};
  }

  return {handle, state: () => state, snapshot};
}

/* ---------- CJS 导出面(Node require 双栖: 适配层 js/town-ui.js 的
   Node 沙盒经此解析 core; 浏览器经 <script> 走共享词法环境不走此面) ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {DIALOG_STATES, DIALOG_INTENTS, DIALOG_TRANSITIONS,
    DIALOG_OPTS, TTS_PRIORITIES, DIALOG_EVENTS, mkDialogMachine,
    dialogBadgesAfter, ttsPlanFor, hudConvergenceFor, dialogViewFor,
    dialogUtterFor};
}
