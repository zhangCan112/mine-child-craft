'use strict';
/* ============================================================
   城镇 HUD 纯决策核心 (TownUiCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: 城镇内 HUD 的纯决策面——提示卡五态状态机+分层可见性档+
   TTS 完整句派生+三票共用参数表; DOM/CSS 装配与墙钟节奏归适配层
   js/town-ui.js, 本层只算数不渲染。
   interface: TOWN_UI_PARAMS(冻结参数表: 安全区 clamp/L1 最大宽/热区下限/
      L3 浮现带/动效窗/表扬节奏窗/U4-U8 与 P 前缀参数化落点+案卷③ IDLE 前缀
      待机微动画 19 键(呼吸/摆动/头转限步/注视门/动物形态通道, 镇民 idle 段
      懒解析消费), 供 PO 一处改) ·
      townHudCardState(current, event) 纯函数(五态机: hidden/idle-exploring/
      active/step-done/dialog-dimmed + 副作用意图 tts-hint|praise-show) ·
      townHudDimming(cardState, dialogOpen) 纯函数(L1-L4 可见性档
      normal|dim|hidden|frozen) · townHintSentence(label) 纯函数 ·
      townPointerTarget(target, opts) 纯函数(指引目标解析三态: target|
      fallback|off, 回落策略越域抛错) · townPointerBand(dist, inView, bands?)
      纯函数(距离三档定性 nearby|near|far) · townPointerHeading(dx, dz, yaw)
      纯函数(方位四离散 front|left|right|behind) · townPointerSig(targetId,
      state, band, heading) 纯函数(指引签名, DOM 脏标对账载体) ·
      townHlClass(id, ctx) 纯函数(可交互四态状态类 default|hover|pressed|
      active|done|none, 优先级序 done>active>pressed>hover) ·
      townHlDim(activeId, dialogOpen, hlClass) 纯函数(会话降噪显示档
      full|min|off) · townHlSig(objectId, displayClass) 纯函数(高亮签名,
      脏标载体) · townHlHit(origin, dir, entries, opts) 纯函数(准星命中
      判定: 视线-锚点夹角+距离双门, 角度优先序; 同角并列 task: 前缀条目
      优先, 双同类取源序[T-UI-04F 改约, 详见函数头]) ·
      townHlProject(cam, anchor) 纯函数(标准针孔屏幕投影, DOM 投影小图标
      定位)
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
  HL_AIM_DEG: 8, /* T-UI-03 准星命中半角 8°(6 岁宽容热区, §6.4 热区余量在
    指针锁定世界的角度映射) */
  HL_AIM_MAX_DIST: 24, /* T-UI-03 命中/标记展示最大距离 24 格(广场尺度可点,
    远景不误触, §6.4) */
  /* 案卷③ 镇民待机微动画 IDLE 段(恰 19 键, js/town-npc.js idle 段调用期
    懒解析消费; 锁表即规格: 改值须连 test/town-npc-idle.test.js 过评审) */
  IDLE_BREATH_AMP: 0.035, /* 呼吸微浮幅度(格) */
  IDLE_BREATH_S: 2.8, /* 呼吸周期(秒) */
  IDLE_SWING_AMP: 0.07, /* 臂摆幅度(rad) */
  IDLE_SWING_S: 3.2, /* 摆动周期(秒) */
  IDLE_LEG_RATIO: 0.5, /* 腿摆=臂摆×比例(反相) */
  IDLE_HEAD_RATE: 2.4, /* 头转最大角速度(rad/s) */
  IDLE_HEAD_YAW_MAX: 1.0, /* 头相对身体最大偏转(rad, 约 57°) */
  IDLE_GAZE_DIST: 9, /* 注视水平距离(格), 界外头回正 */
  IDLE_BIRD_PECK_AMP: 0.22, /* A01 啄地头俯幅度(rad) */
  IDLE_BIRD_PECK_S: 2.2, /* A01 啄地周期(秒) */
  IDLE_BIRD_TAIL_AMP: 0.3, /* A01 尾摆幅度(rad) */
  IDLE_BIRD_TAIL_S: 1.6, /* A01 尾摆周期(秒) */
  IDLE_CAT_TAIL_AMP: 0.45, /* A02 尾慢摆幅度(rad) */
  IDLE_CAT_TAIL_S: 2.6, /* A02 尾摆周期(秒) */
  IDLE_CAT_NOD_AMP: 0.08, /* A02 头微点幅度(rad) */
  IDLE_CAT_NOD_S: 2.0, /* A02 点头周期(秒) */
  IDLE_LLAMA_GRAZE_AMP: 0.28, /* A03 颈俯啄草幅度(rad) */
  IDLE_LLAMA_GRAZE_S: 4.0, /* A03 颈俯周期(秒) */
  IDLE_LLAMA_HEAD_RATIO: 0.35, /* A03 头随颈俯比例 */
  DLG_AWAY_DIST: 12, /* PO 案①(树 3c89723) 会话走远收口水平阈 12 格: 镇内
    会话中水平远离对话对象超阈即 defer 收会话(阈内会话存活; 镇内走远
    ≠离镇, HUD 不收敛) */
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

/* ---------- 指引目标解析(prebuild §5 函数 3; hud-spec §5.2 U4/U5) ----------
    有目标原样透传(mode=target, 回落策略不抢活目标); null 按回落策略:
    钟塔弱提示(U5 默认, 携注入的回落锚)或全收起(off)。核心零依赖: 锚恒
    由装配层喂, 本层不查表。策略越域即抛(拼写域错静默吞=漂移温床,
    townInteractRegistry 同款体例)。 */
function townPointerTarget(target, opts) {
  opts = opts || {};
  if (opts.fallback !== 'belltower-fallback' && opts.fallback !== 'hidden') {
    throw new Error('townPointerTarget: 回落策略越域「' + opts.fallback +
      '」(合法域 belltower-fallback|hidden)');
  }
  if (target) {
    /* 目标态: 图标/锚点原样透传(mode=target) */
    return {iconKey: target.iconKey, anchor: target.anchor, mode: 'target'};
  }
  if (opts.fallback === 'belltower-fallback') {
    /* 弱提示态: 恒指钟塔(回家/集合锚点语义), 锚=注入值 */
    return {iconKey: 'belltower', anchor: opts.fallbackAnchor, mode: 'fallback'};
  }
  /* 全收起态: 零锚零图标(不伪造方向) */
  return {iconKey: null, anchor: null, mode: 'off'};
}

/* ---------- 距离三档定性(prebuild §5 函数 4+§3.3 阈值口径) ----------
    阈值缺省消费 TOWN_UI_PARAMS(P_D1_NEARBY/P_D2_NEAR), 可注入覆盖(PO
    调参位); 「就在附近」需在视野角内(inView=false 时 nearby 不可达,
    ≤P_D1 落 near); 边界恰等含等号; 儿童化三档不显数字。 */
function townPointerBand(dist, inView, bands) {
  bands = bands ||
    {nearby: TOWN_UI_PARAMS.P_D1_NEARBY, near: TOWN_UI_PARAMS.P_D2_NEAR};
  if (inView && dist <= bands.nearby) return 'nearby';
  if (dist <= bands.near) return 'near';
  return 'far';
}

/* ---------- 方位四离散(prebuild §5 函数 5; camera-rig lookDir 同式) ----------
    前向=(-sin yaw, -cos yaw)(yaw=0 面北 -Z, voxel 同式); 相对角 ρ=
    atan2(叉积, 点积)——|ρ|≤45° front(恰在前方含 ±45°), 45°<ρ≤135° right,
    -135°≤ρ<-45° left, 其余(|ρ|>135°) behind(四扇全覆无间隙); 零位移
    atan2(0,0)=0 归 front(踩锚即「在视野」, 配 dist=0 → nearby); yaw 任意
    圈回绕由三角函数自然吸收。 */
function townPointerHeading(dx, dz, yaw) {
  /* 零位移显式归 front(踩锚即「在视野」): atan2(±0, -0) 按 IEEE 语义
     会返回 ±π(负零点积), 不走下方通用口径 */
  if (dx === 0 && dz === 0) return 'front';
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rho = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
  const QUARTER = Math.PI / 4;
  const THREE_EIGHTHS = (3 * Math.PI) / 4;
  if (Math.abs(rho) <= QUARTER) return 'front';
  if (rho > QUARTER && rho <= THREE_EIGHTHS) return 'right';
  if (rho < -QUARTER && rho >= -THREE_EIGHTHS) return 'left';
  return 'behind';
}

/* ---------- 指引签名(prebuild §5 函数 6+§3.4 脏标口径) ----------
    四分量(targetId|state|距离档|方位档)→签名字符串: 同参恒等, 任一分量
    变则变; null 目标 id 可签名(回落态同样进对账)。适配层拿它对账, 签名
    不变零 DOM 操作(无闪烁承诺 core 半边, DOM 半边归 town-ui.js)。 */
function townPointerSig(targetId, state, band, heading) {
  return JSON.stringify([targetId, state, band, heading]);
}

/* ---------- 可交互四态状态类(prebuild §5 函数 7; hud-spec §6.1-§6.2) ----------
    单对象视角: 对照命中/按下/选中/完成四标志返回恰一状态类, 优先级序
    done > active > pressed > hover > default(多标志并存取其一, 完成后不
    再回选中环=单向迁移); id 缺席=none(非交互对象无标记); ctx 缺席=可
    交互静置默认态。doneIds 兼容 Set/数组双形态(装配层 Set, 小面数组)。 */
function townHlClass(id, ctx) {
  if (!id) return 'none';
  ctx = ctx || {};
  const done = ctx.doneIds;
  const isDone = !!done && (typeof done.has === 'function' ?
    done.has(id) : done.includes(id));
  if (isDone) return 'done';
  if (ctx.activeId === id) return 'active';
  if (ctx.pressedId === id) return 'pressed';
  if (ctx.hoveredId === id) return 'hover';
  return 'default';
}

/* ---------- 会话降噪档(prebuild §5 函数 8; dialog-spec §2.3 注意力归会话) ----------
    非会话恒 full(标记照常展示); 会话开=选中对象保持 full(柔和选中环),
    悬停/按下对象降 min(最低存在感档), 其余可交互 off(默认不显示, 完成
    语义已由 L1 表扬承担同样收敛)。 */
function townHlDim(activeId, dialogOpen, hlClass) {
  if (!dialogOpen) return 'full';
  if (hlClass === 'active') return 'full';
  if (hlClass === 'hover' || hlClass === 'pressed') return 'min';
  return 'off';
}

/* ---------- 高亮签名(prebuild §5 函数 9; townPointerSig 同款体例) ----------
    二分量(对象id|有效显示档)→签名字符串: 同参恒等, 任一分量变则变;
    适配层拿它做脏标对账(签名不变零 DOM 操作)。 */
function townHlSig(objectId, displayClass) {
  return JSON.stringify([objectId, displayClass]);
}

/* ---------- 准星命中判定(prebuild §4.1-§4.3; 纯几何零 THREE) ----------
    指针锁定世界: 准星即光标, 命中判据=视线-锚点夹角 ≤ HL_AIM_DEG(含
    等号, 1e-9 容差抗舍入)且欧氏距离 ≤ HL_AIM_MAX_DIST(含等号)双门;
    通过者取夹角最小(准星指着谁); 同角并列: task: 前缀条目优先于非任务
    条目(T-UI-04F 契约改约 2026-11-14: 真清单 TOWN_INTERACTS 三 task
    条目被同锚 prop/landmark 源序遮挡→点选接任务全不可达=功能阻断;
    清单表序是机器红线不动, 改的是命中裁决契约; PO 追认挂 PO 待裁清单
    条款 9), 双方同类→维持清单源序取前; 非同角时角度门先行零变化;
    dir 零向量/空表/全部落空 → null。opts {maxDist, deg} 注入覆盖(PO 调
    调参位, 缺省消费 TOWN_UI_PARAMS 单一出处); dir 允许未归一化(内部分
    归一)。返回 {id, dist}, 无命中 null。 */
function townHlHit(origin, dir, entries, opts) {
  opts = opts || {};
  const maxDist = opts.maxDist !== undefined ?
    opts.maxDist : TOWN_UI_PARAMS.HL_AIM_MAX_DIST;
  const deg = opts.deg !== undefined ?
    opts.deg : TOWN_UI_PARAMS.HL_AIM_DEG;
  const EPS = 1e-9;
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
  if (!len || !entries || !entries.length) return null;
  const cosLimit = Math.cos(deg * Math.PI / 180);
  let best = null;
  let bestCos = -Infinity;
  for (const e of entries) {
    if (!e || !e.anchor) continue;
    const vx = e.anchor.x - origin.x;
    const vy = e.anchor.y - origin.y;
    const vz = e.anchor.z - origin.z;
    const d = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (d > maxDist + EPS) continue; /* 距离门(含等号) */
    let cosAngle;
    if (d === 0) {
      cosAngle = 1; /* 踩在锚点上=正中(零向量点积不伪造) */
    } else {
      cosAngle = (vx * dir.x + vy * dir.y + vz * dir.z) / (d * len);
    }
    if (cosAngle < cosLimit - EPS) continue; /* 角度门(含等号, 舍入容差) */
    /* 角度优先(严格大于); 同角并列: task: 前缀条目压过非任务条目
       (T-UI-04F 契约改约), 双方同类→维持源序取前 */
    /* best.id 同守(非字符串=非任务条目): 04F note N1 防御, 真清单 id 恒字符串实际不可达 */
    const tieTask = cosAngle === bestCos && best !== null &&
      typeof e.id === 'string' && e.id.startsWith('task:') &&
      !(typeof best.id === 'string' && best.id.startsWith('task:'));
    if (cosAngle > bestCos || tieTask) {
      best = {id: e.id, dist: d};
      bestCos = cosAngle;
    }
  }
  return best;
}

/* ---------- 屏幕投影(prebuild §4.4; 标准针孔模型, DOM 投影定位) ----------
    cam 全裸数字 {x, y, z, yaw, pitch, fovDeg, aspect, vw, vh}(voxel 朝向
    式: yaw=0 面北 -Z, pitch 正=仰视; fovDeg 取竖向半角, aspect 横向扩)。
    相机基: 前向 F=(-sin yaw·cos pitch, sin pitch, -cos yaw·cos pitch),
    右向 R=(cos yaw, 0, -sin yaw), 上向 U=R×F。深度 t≤0(含背后)=null 不
    伪造位置; 屏外 visible=false 坐标照算(裁剪归 visible 不抹算术); 屏
    坐标取整到像素(定位贴像素, 舍入噪声不外溢)。返回 {x, y, visible,
    dist}(dist=欧氏距离, 与命中/展示距离门共用口径)。 */
function townHlProject(cam, anchor) {
  if (!cam || !anchor) return null;
  const vx = anchor.x - cam.x;
  const vy = anchor.y - cam.y;
  const vz = anchor.z - cam.z;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const fx = -sy * cp;
  const fy = sp;
  const fz = -cy * cp;
  const depth = vx * fx + vy * fy + vz * fz;
  if (!(depth > 0)) return null; /* 背后/零深/NaN 一律不投影 */
  const rx = cy;
  const rz = -sy;
  const right = vx * rx + vz * rz;
  /* 上向 U = R×F 分量化: U=(sy·sp, cp, cy·sp) */
  const upComp = vx * (sy * sp) + vy * cp + vz * (cy * sp);
  const tanHalf = Math.tan((cam.fovDeg || 90) * Math.PI / 360);
  const ndcX = right / (depth * tanHalf * (cam.aspect || 1));
  const ndcY = upComp / (depth * tanHalf);
  return {
    x: Math.round((ndcX + 1) / 2 * cam.vw),
    y: Math.round((1 - ndcY) / 2 * cam.vh),
    visible: Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1,
    dist: Math.sqrt(vx * vx + vy * vy + vz * vz),
  };
}

/* ---------- CJS 导出面(仅 Node require 双栖用: 适配层 js/town-ui.js 在
    Node 沙盒经此解析 core; 浏览器经典 script 走共享词法环境不走此支) ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {TOWN_UI_PARAMS, townHudCardState, townHudDimming,
    townHintSentence, townPointerTarget, townPointerBand, townPointerHeading,
    townPointerSig, townHlClass, townHlDim, townHlSig, townHlHit,
    townHlProject};
}
