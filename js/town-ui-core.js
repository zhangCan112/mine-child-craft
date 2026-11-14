'use strict';
/* ============================================================
   城镇 HUD 纯决策核心 (TownUiCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: 城镇内 HUD 的纯决策面——提示卡五态状态机+分层可见性档+
   TTS 完整句派生+三票共用参数表; DOM/CSS 装配与墙钟节奏归适配层
   js/town-ui.js, 本层只算数不渲染。
   interface: TOWN_UI_PARAMS(冻结参数表: 安全区 clamp/L1 最大宽/热区下限/
      L3 浮现带/动效窗/表扬节奏窗/U4-U8 与 P 前缀参数化落点, 供 PO 一处改) ·
      townHudCardState(current, event) 纯函数(五态机: hidden/idle-exploring/
      active/step-done/dialog-dimmed + 副作用意图 tts-hint|praise-show) ·
      townHudDimming(cardState, dialogOpen) 纯函数(L1-L4 可见性档
      normal|dim|hidden|frozen) · townHintSentence(label) 纯函数
   依赖: 零运行时依赖——不引用引擎件/件库/DOM/THREE 符号; 事件形状与参数
      默认值出自 docs/design/town-ui-hud-prebuild.md §1-§2/§5-§6 与
      docs/design/town-ui-entry-hud-spec.md §4/§8。
   可测性声明: 零 THREE·零 DOM·零墙钟·零随机·同参同输出·加载零副作用·
      有同名单测(test/town-ui-core.test.js)。
   ============================================================ */

/* ---------- 参数表(全冻结防漂移; 值=prebuild §6 U4-U8+P 前缀默认, 锁表
    即规格: 单测逐键断言, 改值须连测试一起过评审) ---------- */
const TOWN_UI_PARAMS = Object.freeze({
  SAFE_MIN_PX: 16,
  SAFE_VW: 1.6,
  SAFE_MAX_PX: 24, /* 安全区 clamp(16px, 1.6vw, 24px) 三元(hud-spec §4.2) */
  CARD_MAX_W_PX: 320,
  CARD_MAX_VW: 40, /* L1 最大宽 min(320px, 40vw)(prebuild §1.3) */
  HIT_MIN_PX: 44, /* 热区下限 44×44 CSS px 等效(§4.2/§6.4) */
  PRAISE_TOP_MIN_VH: 20,
  PRAISE_TOP_VH: 24,
  PRAISE_TOP_MAX_VH: 28, /* L3 浮现带 20vh-28vh, 默认取中 24(prebuild §1.3) */
  T_IN_MS: Object.freeze([150, 250]),
  T_OUT_MS: Object.freeze([150, 250]),
  T_TAP_MS: Object.freeze([100, 120]), /* 动效窗(§1.4) */
  PRAISE_MS: Object.freeze([1200, 2000]), /* U7 表扬节奏 1.2-2.0s(§4.4) */
  PRAISE_QUEUE_MAX: 1, /* P-S1 等待队列深 1(新事件顶替等待项) */
  U7_PRAISE_SINGLE: true, /* U7 同屏 1 条不刷屏 */
  L1_IDLE_DIM: 'dim', /* P-V1 L1 无任务态=「探索中」轻状态弱化档 */
  L1_DIALOG: 'hidden', /* P-H1 会话中 L1 暂隐 */
  L2_DIALOG: 'hidden', /* P-H2 会话中 L2 暂隐 */
  U4_POINTER_MODE: 'landmark-pointer', /* U4 指引形态=Landmark Pointer(§5.2) */
  U5_FALLBACK: 'belltower-fallback', /* U5 无目标回落=钟塔弱提示(§3.3) */
  U6_REPLAY: true, /* U6 支持重播(喇叭钮, §2.4) */
  U6_MANUAL_DISMISS: false, /* U6 手动收起=可选不启用(§4.5 无负面后果) */
  U8_PROCESS_ITEM: null, /* U8=流程项非视觉参数, 无实现落点(如实标注) */
  P_D1_NEARBY: 12, /* P-D1「就在附近」阈值 ≤12 格(prebuild §6.3) */
  P_D2_NEAR: 40, /* P-D2「近/远」分界 40 格(prebuild §6.3) */
});

/* ---------- 提示卡五态状态机(prebuild §2.3; hud-spec §4.3 状态行) ----------
    纯决策: 无内部可变状态, 同参同输出; elapse/定时节奏全归装配层喂, 核心
    零墙钟。事件类型恰七种(enter/leave/target-focus/target-update/
    dialog-open/dialog-close/step-elapse), 未知事件原样返回(装配层不炸)。
    副作用意图只有 tts-hint(自动朗读)与 praise-show(表扬浮现)两值, 空数组
    表示零副作用。无失败态: 任意事件序列均落在五态集合内(§4.5 硬约束)。 */
function townHudCardState(current, event) {
  const type = event.type;
  if (type === 'leave') {
    return {state: 'hidden', intents: []}; /* 离场/清场任意态收口 */
  }
  if (type === 'enter') {
    /* 进场且无任务→探索中轻状态(P-V1); 其余态进场不变 */
    return current === 'hidden' ?
      {state: 'idle-exploring', intents: []} :
      {state: current, intents: []};
  }
  if (type === 'target-focus') {
    if (current === 'dialog-dimmed') {
      /* 会话中不切态不抢话(会话播报优先, dialog-spec §2.2 TTS 通道行) */
      return {state: current, intents: []};
    }
    if (event.target) {
      /* 新主提示出现→进行中+自动朗读一次(§2.4 自动播报行) */
      return {state: 'active', intents: ['tts-hint']};
    }
    /* target null=显式清空→探索中(机器 focus(null) 语义对齐); 无卡保持 */
    return current === 'hidden' ?
      {state: 'hidden', intents: []} :
      {state: 'idle-exploring', intents: []};
  }
  if (type === 'target-update') {
    if (event.state !== 'done') {
      return {state: current, intents: []}; /* 非 done 状态更新零动作 */
    }
    if (current === 'active') {
      /* 完成一步+过程性表扬(§4.4 L3; 验收锚 found→完成一步) */
      return {state: 'step-done', intents: ['praise-show']};
    }
    if (current === 'idle-exploring' || current === 'step-done') {
      /* 无卡时状态不动轻状态照给表扬(不吞正向反馈); 完成态再达成同样表扬 */
      return {state: current, intents: ['praise-show']};
    }
    /* hidden(无卡不弹)与 dialog-dimmed(L3 冻结: 会话中不弹全局表扬)零意图 */
    return {state: current, intents: []};
  }
  if (type === 'dialog-open') {
    /* 会话中注意力归会话(P-H1): 进行中/完成一步收敛进 dialog-dimmed */
    return (current === 'active' || current === 'step-done') ?
      {state: 'dialog-dimmed', intents: []} :
      {state: current, intents: []};
  }
  if (type === 'dialog-close') {
    if (event.result === 'done' && event.taskRef) {
      /* B 播局部完成, A 落常驻完成态(dialog-spec §2.3 宣布权分工);
         唯一落完成一步的 close 入口; 无卡(hidden)不凭空落完成 */
      return current === 'hidden' ?
        {state: 'hidden', intents: []} :
        {state: 'step-done', intents: ['praise-show']};
    }
    if (current !== 'dialog-dimmed') {
      return {state: current, intents: []}; /* 非会话态收 close 零动作 */
    }
    /* 会话已关一律恢复原态(prev 由装配层记忆携带): continue/deferred 照
       恢复; done 无 taskRef=与任务无关联只恢复不落完成; 其他 result 值
       同恢复(会话已关 HUD 不得卡死收敛, 失败安全缺省, 非惩罚语义) */
    return {state: event.prev || 'idle-exploring', intents: []};
  }
  if (type === 'step-elapse') {
    if (current !== 'step-done') {
      return {state: current, intents: []}; /* 停留计时只属完成一步态 */
    }
    /* 停留后: 有下一条→切进行中; 无→自动收起回探索中(prebuild §2.3) */
    return event.hasNext === true ?
      {state: 'active', intents: []} :
      {state: 'idle-exploring', intents: []};
  }
  return {state: current, intents: []}; /* 未知事件: 原样返回 */
}

/* ---------- 分层可见性档(prebuild §5 函数 2; hud-spec §4.3 末段) ----------
    会话开=非必要 HUD 全收敛(L1 暂隐 P-H1+L2 暂隐 P-H2+L3 冻结)而 L4 恒
    normal(安全返回能力不收敛, dialog-spec §2.3); 会话关=按卡态恢复,
    探索中弱化档(P-V1), dialog-dimmed 防御档保持暂隐(close 语义负责恢复)。 */
function townHudDimming(cardState, dialogOpen) {
  if (dialogOpen) {
    return {l1: 'hidden', l2: 'hidden', l3: 'frozen', l4: 'normal'};
  }
  const l1ByState = {
    'hidden': 'hidden',
    'idle-exploring': 'dim',
    'active': 'normal',
    'step-done': 'normal',
    'dialog-dimmed': 'hidden', /* 防御档: 未恢复前保持暂隐 */
  };
  return {
    l1: l1ByState[cardState] || 'hidden',
    l2: 'normal',
    l3: 'normal',
    l4: 'normal',
  };
}

/* ---------- TTS 完整句(短标签只是辅助, TTS 才是完整句——hud-spec §4.3;
    纯函数同参同输出, 零墙钟零随机) ---------- */
function townHintSentence(label) {
  return '我们去' + label + '吧！';
}

/* ---------- CJS 导出面(仅 Node require 双栖用: 适配层 js/town-ui.js 在
    Node 沙盒经此解析 core; 浏览器经典 script 走共享词法环境不走此支) ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {TOWN_UI_PARAMS, townHudCardState, townHudDimming,
    townHintSentence};
}
