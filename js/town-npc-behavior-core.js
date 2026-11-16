'use strict';
/* ============================================================
   城镇 NPC 巡逻/日程行为纯核心 (TownNpcBehaviorCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: G01 巡逻环与 13 村民日程的时间状态机与腿内位姿派生——
   停驻/行走两相推进、到站 legIndex 推进、朝向派生与走摆相位判定全藏在
   本核心, 装配层(adventure 壳 T-NPC-13 段)只喂 dt/dayTime 与写赢状态。
   interface: 巡逻面(T-NPC-13 a2+b1)——TOWN_NPC_PATROL(参数表六键 {LEG_T,
      DWELL_T, TURN_T, SWING_HZ, WALK_ARM_AMP, WALK_LEG_AMP}, PO 后验可调,
      票面 §3.2 参数表驱动) · townPatrolState(anchorId) → 初始状态恰七键
      {anchorId, leg, t, phase, dwellT, yaw, yawFrom}(未知锚 id 抛中文域
      错) · townPatrolStep(state, dt) → 恒新状态对象(入参零突变; dt<=0/
      非有限回落零步; 巨 dt 单沿交接不连跳两相) · townPatrolPose(state) →
      位姿恰七键 {x, z, yaw, moving, progress, swingPhase, walkPose}(零 y
      键——y 通道归 idle 呼吸; walkPose 恰六键同 idle 形, floatY 恒 0) ·
      townPatrolLegById(state) → {锚id: (leg+1)%n}「HUD 下一站」映射
      (行走中标记=到站锚, 停驻中=下一站; 静态锚不进表由装配层建账保证)。
      日程面(c2, 票面 §11.7.0-③)——TOWN_NPC_SCHEDULE(参数表四键
      {SPEED_GPT, DUSK_T, NIGHT_T, DAWN_T}; 三 tick 常量=DAYLIGHT.DIM_KEYS
      转折值字面, SPEED_GPT=秒/格) · TOWN_SCHEDULE_PLANS(13 村民锚 id 键控
      段表, 每行恰四段 [{from,leg,phase}×4], phase=Daylight.clockPhase id
      四值零新枚举, from 升序覆盖全天 [0,24000), leg 引用锚点行内航点
      索引: day/dawn=0 工作位, dusk=聚集点, night=末航点=家) ·
      townScheduleLegOf(anchorId, dayTime) → {leg, phase} 纯函数
      f(dayTime) 本体(dayTime 归一 [0,24000) 回绕, 段=最后一个 from≤t;
      未知锚与 G01 不在日程簿均抛「未知」域错) · townScheduleState(
      anchorId, dayTime) → 恰七键 {anchorId, leg, t, phase:'dwell', dir,
      yaw, yawFrom}(leg=当前段目标 leg——夜间进镇直接在家=摆放同源零首拍
      跳变; 无 dwellT 键=与巡逻机差异点; dir∈{-1,0,1} dwell 恒 0; yaw=
      停驻语义朝向=航点 face) · townScheduleStep(state, dayTime, dt) →
      恒新对象(零突变; dt<=0/非有限回落零步; dwell+leg==target 恒等保持,
      leg≠target 起步帧余量弃——巨 dt 只起步 G01 同款; walk 相 t+=dt/
      (腿格数×SPEED_GPT), t≥1 到站 leg+=dir 单沿交接不连跳两腿, leg==
      target 转 dwell(yaw=到站航点 face 语义朝向), 否则拐点续 walk(t=0
      转身, yaw=下一腿几何行进方向); 腿中段切沿延迟到腿尾——walk 不中途
      改向, 滑行惯性语义) · townSchedulePose(state) → 位姿恰七键同巡逻形
      (停驻=精确落航点; 行走=航点线性插值 from=wp[leg] to=wp[leg+dir];
      走摆相位=sin(t·腿秒·SWING_HZ·2π)·摆幅——复用 TOWN_NPC_PATROL 摆频
      三参数不复制第二份) · townScheduleLegById(state) → {锚id: legIndex}
      (walk=leg+dir 行进目标腿=「下一站」; dwell=leg 本体位——与 G01
      「停驻中=下一站」差异裁决: 村民停驻以小时计, HUD/交互锚恒本体位;
      到站帧同值零跳变=重发节奏每腿起步帧恰一跳)。
   依赖(均经全局名, 调用期解析): town-npc-anchor-core 的 anchorOf(航点
      单源取数+拼写域校验)与 TOWN_NPC_ANCHORS(航点行); 装载序恒晚于
      anchor-core(index.html 镇民链 / conventions gate CHAIN 同序);
      face→yaw 映射同式自带(维度件不在装具链本核心之前, 派令授权核心内
      自带同式纯函数, 语义对齐 js/adventure-dims-core.js 的 townYawOfFace
      四正交式, 不引第二份模块依赖); 日程行进朝向=legYawOf 几何派生
      (主轴四正交, 与 townYawOfFace 前向向量同式)——face 双语义拆分
      (停驻朝向=锚点 face 语义, 行进朝向不复用 face, 票面 §11.7.0-②)。
   可测性声明: 零三维渲染库 · 零 DOM · 零墙钟 · 零随机 · 零定时器 ·
      有同名单测(test/town-npc-behavior-core.test.js, 35 测可执行规格)。
   ============================================================ */

/* ---------- 巡逻参数表(PO 后验可调, 改值须连测试过评审——town-npc.js
    IDLE_KEYS 先例): 初值依据 docs/town-villagers-design.md §5.3「慢速
    巡逻·停驻望广场·稍微有点动作」。LEG_T=单腿时长秒(26 格≈1 格/秒慢
    巡逻) · DWELL_T=到站停驻秒 · TURN_T=起步朝向过渡秒 · SWING_HZ=走摆
    摆频(铁傀儡重步频) · WALK_ARM_AMP/WALK_LEG_AMP=摆幅弧度(腿幅>臂幅
    =左臂右腿同相自然步态)。 ---------- */
const TOWN_NPC_PATROL = Object.freeze({
  LEG_T: 26, DWELL_T: 3, TURN_T: 1.2, SWING_HZ: 0.9,
  WALK_ARM_AMP: 0.55, WALK_LEG_AMP: 0.7,
});

/* ---------- 航点行取数(锚点表只读消费, 零改动): 行查表仅取航点数 n;
    未知锚 id 抛中文域错(anchorOf 拼写域同款口径, 消息含「未知」)。 ---------- */
function patrolWaypointsOf(anchorId) {
  const row = TOWN_NPC_ANCHORS.find((r) => r.id === anchorId);
  if (!row) {
    throw new Error('townPatrol: 未知锚 id「' + anchorId + '」(须在站位锚注册集内)');
  }
  return row.waypoints;
}

/* ---------- 四正交 face → yaw 朝向(同式纯函数, 语义单源对齐
    js/adventure-dims-core.js 的 townYawOfFace: 前向向量=(-sin yaw, -cos yaw)
    ——north=0/south=π/west=π/2/east=−π/2; 未知 face 抛拼写域错误)。 ---------- */
function patrolYawOfFace(face) {
  switch (face) {
    case 'north': return 0;
    case 'south': return Math.PI;
    case 'west': return Math.PI / 2;
    case 'east': return -Math.PI / 2;
    default:
      throw new Error('patrolYawOfFace: 未知 face「' + face + '」(合法域 north|south|east|west)');
  }
}

/* ---------- 最短弧角插值: delta 先回绕 ±π 再按 k∈[0,1] 线性内插(右转
    45° 不绕远 270° 的回绕口径)。 ---------- */
function patrolLerpAngle(a, b, k) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
}

/* ---------- 初始状态: 进场先停驻于首航点(到站停驻语义, 望广场), leg0
    与消费机账本基线对齐(进场零扰动); leg=当前腿出发航点索引, t=腿内
    进度 0..1, phase∈'dwell'|'walk', yaw=最近朝向, yawFrom=起步朝向
    (朝向过渡插值起点)。 ---------- */
function townPatrolState(anchorId) {
  const wp0 = anchorOf(anchorId); /* 航点单源取数+拼写域校验(未知 id 抛错) */
  const yaw0 = patrolYawOfFace(wp0.face);
  return {
    anchorId, leg: 0, t: 0, phase: 'dwell', dwellT: 0, yaw: yaw0, yawFrom: yaw0,
  };
}

/* ---------- 时间状态机步进(纯 dt 注入, 零墙钟零随机): 单沿交接纪律——
    每步至多一次「到站」交接(到站不连跳两腿, 沿后余量弃); 停驻跨起步沿后
    本步余量 ≤ 一整腿才续走(恰好整腿=同沿到站), 余量超一整腿(巨 dt)只
    起步不入行走末(停驻巨 dt 只起步口径)。写赢归装配层(step 恒返新对象,
    入参零突变); dt<=0/非有限回落零步零炸。 ---------- */
function townPatrolStep(state, dt) {
  const p = TOWN_NPC_PATROL;
  const s = {
    anchorId: state.anchorId, leg: state.leg, t: state.t, phase: state.phase,
    dwellT: state.dwellT, yaw: state.yaw, yawFrom: state.yawFrom,
  };
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return s;
  const n = patrolWaypointsOf(s.anchorId).length;
  if (s.phase === 'dwell') {
    s.dwellT += dt;
    if (s.dwellT < p.DWELL_T) return s;
    /* 跨起步沿: 停驻满 DWELL_T 即起步(t 归零, leg 到站才推进) */
    const remain = s.dwellT - p.DWELL_T; /* 本步跨沿后的剩余秒 */
    s.phase = 'walk';
    s.t = 0;
    s.dwellT = 0;
    s.yawFrom = s.yaw; /* 朝向过渡插值起点=离站瞬间朝向 */
    if (remain > 0 && remain <= p.LEG_T) {
      /* 余量续走(≤一整腿): 恰好整腿=本步内到站(「dwell3+walk26」单步
          全行程口径); 巨 dt 余量超一整腿只起步(不入行走末) */
      const destYaw = patrolYawOfFace(anchorOf(s.anchorId, s.leg).face);
      s.t = remain / p.LEG_T;
      if (s.t >= 1) {
        s.leg = (s.leg + 1) % n;
        s.phase = 'dwell';
        s.t = 0;
        s.dwellT = 0;
        s.yaw = destYaw;
        return s;
      }
      s.yaw = remain < p.TURN_T ?
        patrolLerpAngle(s.yawFrom, destYaw, remain / p.TURN_T) :
        destYaw;
    }
    return s;
  }
  /* walk 相: 行进方向=当前腿出发航点的 face(沿走方向) */
  const destYaw = patrolYawOfFace(anchorOf(s.anchorId, s.leg).face);
  s.t += dt / p.LEG_T;
  if (s.t >= 1) {
    /* 到站: legIndex 推进(下一腿)+回停驻, 进度/停驻计时归零(无过冲残留),
        到站朝向=行进方向; 沿后余量弃(本步不接着起步——不连跳两腿) */
    s.leg = (s.leg + 1) % n;
    s.phase = 'dwell';
    s.t = 0;
    s.dwellT = 0;
    s.yaw = destYaw;
    return s;
  }
  /* 行走中: 起步 TURN_T 秒朝向过渡(yawFrom→行进方向最短弧), 之后恒行进
      方向(到站 yaw=行进方向由到站沿保证) */
  const walkTime = s.t * p.LEG_T;
  s.yaw = walkTime < p.TURN_T ?
    patrolLerpAngle(s.yawFrom, destYaw, walkTime / p.TURN_T) :
    destYaw;
  return s;
}

/* ---------- 腿内位姿派生(纯读): 停驻=精确落出发航点(t 恒 0, 「到站
    精确落点」口径); 行走=航点线性插值(匀速滑行, 零缓动——裁决三留白面
    口径「本体在路上, 锚点恒精确航点值」); 走摆相位=sin(腿内秒数·SWING_HZ·2π)
    从过零起摆(步态从中立位起), 幅度=参数表(腿幅>臂幅, 反号=自然步态)。
    零 y 键: floatY 恒 0(y 通道归 idle 呼吸, 装配层零写)。 ---------- */
function townPatrolPose(state) {
  const p = TOWN_NPC_PATROL;
  const from = anchorOf(state.anchorId, state.leg);
  const to = anchorOf(state.anchorId, state.leg + 1); /* 归一取模回绕在锚点核心 */
  const moving = state.phase === 'walk';
  const t = moving ? state.t : 0;
  const swing = moving ? Math.sin(t * p.LEG_T * p.SWING_HZ * 2 * Math.PI) : 0;
  return {
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
    yaw: state.yaw,
    moving,
    progress: t,
    swingPhase: t * p.LEG_T * p.SWING_HZ * 2 * Math.PI,
    walkPose: {
      floatY: 0,
      armSwing: swing * p.WALK_ARM_AMP,
      legSwing: (-swing) * p.WALK_LEG_AMP + 0, /* +0 归一(起步过零的严格相等) */
      headPitch: 0, /* 头转通道归 idle 注视, 走摆零头俯 */
      tailYaw: 0,
      neckPitch: 0,
    },
  };
}

/* ---------- 「HUD 下一站」映射((leg+1)%n): 行走中标记=到站锚(本体在
    路上), 停驻中=下一站; 停驻→行走跨界恒值(离站零跳变), 仅到站帧变值
    ——裁决三「到站跳变」节奏的数据前提。单键 {锚id: legIndex}, 静态锚
    不进表(装配层仅多航点锚建账)。 ---------- */
function townPatrolLegById(state) {
  const n = patrolWaypointsOf(state.anchorId).length;
  const legById = {};
  legById[state.anchorId] = (state.leg + 1) % n;
  return legById;
}

/* ============================================================
   c2 日程面: 十三村民日程时间轴(T-NPC-13 c2, 票面 §11.7.0-③④⑤)
   ------------------------------------------------------------
   签名与语义=红方裁决(票面 §11.7.0 归档); 接口缝=ADR-0017 决策 4 四条
   (日程=纯函数 f(dayTime); 时段枚举=Daylight.clockPhase 四段零新枚举;
   细锚点 tick 常量进行为核参数表; 时间源=全局 dayTime 单钟禁新钟——
   dayTime 经参数注入非墙钟, dt 仍走装配层注入)。纯核心零三维/零 DOM/
   零墙钟/零随机/零定时器同巡逻面。
   ============================================================ */

/* ---------- 日程参数表(PO 后验可调): SPEED_GPT=秒/格(1 格/秒与 G01
    LEG_T=26/26 格同速口径) · DUSK_T/NIGHT_T/DAWN_T=三段切 tick 常量
    (字面=DAYLIGHT.DIM_KEYS 转折值, 零新魔法数; 权威=ADR-0017 §2-8
    clockPhase 断点; 同名单测跨表对账执法——改 DAYLIGHT 曲线须连带
    本表过评审)。 ---------- */
const TOWN_NPC_SCHEDULE = Object.freeze({
  SPEED_GPT: 1, DUSK_T: 12040, NIGHT_T: 13670, DAWN_T: 22330,
});

/* ---------- 13 村民段表(锚 id 键控, 每行恰四段): from 升序覆盖全天
    [0,24000)(值=TOWN_NPC_SCHEDULE 断点键值同源, 零第二份 tick 字面);
    phase=Daylight.clockPhase id 四值(day/dusk/night/dawn, 零新枚举);
    leg=段目标航点索引(day/dawn=0 工作位白天在岗·清晨回岗, dusk=聚集点
    傍晚聚集, night=末航点=家夜间归家——锚点行航点序列单源 §11.7.0-①)。
    G01 不在册=装配分流判据「PLANS 含该锚」的数据面。 ---------- */
const TOWN_SCHEDULE_PLANS = Object.freeze({
  'npc:v01': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v02': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 3, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 4, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v03': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v04': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v05': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 3, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v06': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v07': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v08': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v09': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:v10': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:a01': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:a02': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 1, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 2, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
  'npc:a03': [
    {from: 0, leg: 0, phase: 'day'},
    {from: TOWN_NPC_SCHEDULE.DUSK_T, leg: 3, phase: 'dusk'},
    {from: TOWN_NPC_SCHEDULE.NIGHT_T, leg: 4, phase: 'night'},
    {from: TOWN_NPC_SCHEDULE.DAWN_T, leg: 0, phase: 'dawn'}],
});

/* ---------- 段表取数(日程域错单点): PLANS 在册才返段行——未知 id 与
    G01(不在日程簿=巡逻专属)统一抛含「未知」中文域错(装配分流判据=
    「PLANS 含该锚」的数据面同源判定); hasOwnProperty 防原型链键。 ---- */
function schedulePlanOf(anchorId) {
  if (typeof TOWN_SCHEDULE_PLANS[anchorId] === 'undefined' ||
      !Object.prototype.hasOwnProperty.call(TOWN_SCHEDULE_PLANS, anchorId)) {
    throw new Error('townSchedule: 未知日程锚 id「' + anchorId +
        '」(不在 TOWN_SCHEDULE_PLANS 段表; G01 巡逻专属走巡逻机)');
  }
  return TOWN_SCHEDULE_PLANS[anchorId];
}

/* ---------- 纯函数 f(dayTime) 本体(ADR-0017 决策 4): dayTime 归一
    [0,24000) 回绕(镜像 Daylight.advance 口径; 24000=DAYLIGHT.TICKS 权威
    字面, 同名单测跨表对账执法); 段=最后一个 from≤t 的段(左闭沿; 从后
    往前找, from=0 兜底恒命中)。 ---------- */
function townScheduleLegOf(anchorId, dayTime) {
  const plan = schedulePlanOf(anchorId);
  const t = ((dayTime % 24000) + 24000) % 24000;
  let seg = plan[0];
  for (const row of plan) {
    if (row.from <= t) seg = row;
  }
  return {leg: seg.leg, phase: seg.phase};
}

/* ---------- 初始状态: 进场即停驻于当前段目标 leg(白天=工作位现网零
    漂移; 夜间进镇直接在家=摆放同源零首拍跳变; 停驻无时长——段切即走,
    无 dwellT 键=与巡逻七键差异点); dir∈{-1,0,1} 行进方向(dwell 恒 0);
    yaw=停驻语义朝向(锚点 face 语义, 工作位=SEM 工作朝向面原语义);
    yawFrom=起步朝向(零转向初值)。 ---------- */
function townScheduleState(anchorId, dayTime) {
  const leg = townScheduleLegOf(anchorId, dayTime).leg;
  const yaw = patrolYawOfFace(anchorOf(anchorId, leg).face);
  return {
    anchorId, leg, t: 0, phase: 'dwell', dir: 0, yaw, yawFrom: yaw,
  };
}

/* ---------- 行进朝向几何派生(face 双语义拆分 §11.7.0-②: 停驻朝向=
    锚点 face 语义, 行进朝向不得复用 face——工作位 face=SEM 工作朝向
    如 V01 面南迎客, 行进朝向=腿向量主轴四正交): 主轴=|dx|≥|dz| 取东西
    轴否则南北轴(轴对齐腿单轴天然命中); 前向向量与 townYawOfFace 同式
    (north=0/south=π/west=π/2/east=−π/2)。 ---------- */
function schedLegYawOf(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx >= 0 ? -Math.PI / 2 : Math.PI / 2; /* 东负/西正(同式) */
  }
  return dz > 0 ? Math.PI : 0; /* 南正/北零 */
}

/* ---------- 日程时间状态机步进(纯 dayTime+dt 注入, 零墙钟零随机):
    dwell 相——leg==target 恒等保持(在岗/在家无位移); leg≠target 起步
    (dir=sign(target-leg), 起步帧 t=0 余量弃——巨 dt 只起步 G01 同款
    单沿纪律)。walk 相——t+=dt/(腿格数×SPEED_GPT) 线性行进; 腿中不重判
    target(段切沿延迟到腿尾——滑行惯性语义, 段切响应延迟≤一腿时长);
    t≥1 到站 leg+=dir 单沿交接(到站不连跳两腿, 余量弃): leg==target 转
    dwell(停驻朝向=到站航点 face 语义), 否则拐点不停驻续 walk(t=0 转身,
    yaw=下一腿几何行进方向)。写赢归装配层(step 恒返新对象, 入参零突变);
    dt<=0/非有限回落零步零炸。 ---------- */
function townScheduleStep(state, dayTime, dt) {
  const sched = TOWN_NPC_SCHEDULE;
  const s = {
    anchorId: state.anchorId, leg: state.leg, t: state.t, phase: state.phase,
    dir: state.dir, yaw: state.yaw, yawFrom: state.yawFrom,
  };
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return s;
  const wps = patrolWaypointsOf(s.anchorId); /* 锚点行只读消费(在册性已
      由段表取数校验——PLANS ⊂ TOWN_NPC_ANCHORS 同表单源) */
  if (s.phase === 'dwell') {
    const target = townScheduleLegOf(s.anchorId, dayTime).leg;
    if (s.leg === target) return s; /* 段内恒等保持(新对象同值) */
    /* 段切起步: 方向=目标差符号; 起步帧余量弃(本帧不入行走末) */
    s.phase = 'walk';
    s.dir = Math.sign(target - s.leg);
    s.t = 0;
    s.yawFrom = s.yaw; /* 朝向过渡插值起点=离站瞬间朝向 */
    s.yaw = schedLegYawOf(wps[s.leg], wps[s.leg + s.dir]);
    return s;
  }
  /* walk 相: 行进朝向=几何派生(腿中恒行进方向, 起步帧已设同值重申) */
  const from = wps[s.leg];
  const to = wps[s.leg + s.dir];
  const cells = Math.abs(to.x - from.x) + Math.abs(to.z - from.z); /* 轴对齐腿格数 */
  s.t += dt / (cells * sched.SPEED_GPT);
  if (s.t < 1) {
    s.yaw = schedLegYawOf(from, to);
    return s;
  }
  /* 到站: leg+=dir 单沿交接(不连跳两腿, 本步余量弃); 腿尾重判 target
      ——段切此刻才响应(腿中不改向) */
  s.leg += s.dir;
  const target = townScheduleLegOf(s.anchorId, dayTime).leg;
  if (s.leg === target) {
    /* 到家/到岗: 停驻(停驻朝向=到站航点 face 语义朝向) */
    s.phase = 'dwell';
    s.t = 0;
    s.dir = 0;
    s.yawFrom = s.yaw;
    s.yaw = patrolYawOfFace(anchorOf(s.anchorId, s.leg).face);
    return s;
  }
  /* 拐点不停驻: 续走新目标(新腿从零起, 下一帧才走——到站帧余量弃) */
  s.t = 0;
  s.dir = Math.sign(target - s.leg);
  s.yawFrom = s.yaw;
  s.yaw = schedLegYawOf(wps[s.leg], wps[s.leg + s.dir]);
  return s;
}

/* ---------- 日程腿内位姿派生(纯读, 巡逻机同形): 停驻=精确落航点
    (moving=false 进度归零); 行走=航点线性插值(from=wp[leg] to=
    wp[leg+dir]——逆行腿 dir=-1 由 dir 通道表达, 巡逻 pose 取 leg+1
    不同此通道); 走摆相位=sin(腿内秒数·SWING_HZ·2π) 从过零起摆——
    摆频/摆幅三参数复用 TOWN_NPC_PATROL 不复制第二份(腿秒=腿格数×
    SPEED_GPT)。零 y 键: floatY 恒 0(y 通道归 idle 呼吸)。 ---------- */
function townSchedulePose(state) {
  const p = TOWN_NPC_PATROL;
  const wps = patrolWaypointsOf(state.anchorId);
  const from = wps[state.leg];
  const moving = state.phase === 'walk';
  const t = moving ? state.t : 0;
  const to = moving ? wps[state.leg + state.dir] : from;
  const cells = Math.abs(to.x - from.x) + Math.abs(to.z - from.z);
  const legSec = cells * TOWN_NPC_SCHEDULE.SPEED_GPT;
  const swing = moving ? Math.sin(t * legSec * p.SWING_HZ * 2 * Math.PI) : 0;
  return {
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
    yaw: state.yaw,
    moving,
    progress: t,
    swingPhase: t * legSec * p.SWING_HZ * 2 * Math.PI,
    walkPose: {
      floatY: 0,
      armSwing: swing * p.WALK_ARM_AMP,
      legSwing: (-swing) * p.WALK_LEG_AMP + 0, /* +0 归一(起步过零的严格相等) */
      headPitch: 0, /* 头转通道归 idle 注视, 走摆零头俯 */
      tailYaw: 0,
      neckPitch: 0,
    },
  };
}

/* ---------- 「HUD 下一站」映射(日程版): walk=leg+dir(行进目标腿=
    「下一站」——逆行 dir=-1 同式); dwell=leg 本体位(与 G01「停驻中=
    下一站」差异裁决: 村民停驻以小时计, HUD/交互锚恒本体位, 6 岁可读
    =点谁气泡在谁脚下)。起步帧 walk 化即跳值(每腿起步帧恰一跳=消费机
    重发节奏); 到站帧 dwell 化取本体位与行进目标同值=零跳变(账本幂等)。
    单键 {锚id: legIndex}。 ---------- */
function townScheduleLegById(state) {
  const leg = state.phase === 'walk' ? state.leg + state.dir : state.leg;
  const legById = {};
  legById[state.anchorId] = leg;
  return legById;
}

/* ---------- CommonJS 导出守卫(town-npc.js 同款): 浏览器经典脚本共享
    词法环境, 顶层声明即全局, 供消费方直接引用; Node 下仅测试与装配
    消费, 挂 module.exports(导出面恰十二名=巡逻五名+日程七名, 零杂散
    零遗漏)。 ---------- */
const TownNpcBehavior = {TOWN_NPC_PATROL, TOWN_NPC_SCHEDULE,
  TOWN_SCHEDULE_PLANS, townPatrolState, townPatrolStep, townPatrolPose,
  townPatrolLegById, townScheduleLegOf, townScheduleState, townScheduleStep,
  townSchedulePose, townScheduleLegById};
if (typeof module !== 'undefined' && module.exports) module.exports = TownNpcBehavior;
