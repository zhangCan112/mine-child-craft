'use strict';
/* ============================================================
   城镇 NPC 巡逻行为纯核心 (TownNpcBehaviorCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: G01 巡逻环的时间状态机与腿内位姿派生——停驻/行走两相推进、
   到站 legIndex 推进、起步朝向过渡与走摆相位判定全藏在本核心, 装配层
   (adventure 壳 T-NPC-13 段)只喂 dt 与写赢状态。
   interface: TOWN_NPC_PATROL(参数表六键 {LEG_T, DWELL_T, TURN_T, SWING_HZ,
      WALK_ARM_AMP, WALK_LEG_AMP}, PO 后验可调, 票面 §3.2 参数表驱动) ·
      townPatrolState(anchorId) → 初始状态恰七键 {anchorId, leg, t, phase,
      dwellT, yaw, yawFrom}(未知锚 id 抛中文域错) · townPatrolStep(state,
      dt) → 恒新状态对象(入参零突变; dt<=0/非有限回落零步; 巨 dt 单沿
      交接不连跳两相) · townPatrolPose(state) → 位姿恰七键 {x, z, yaw,
      moving, progress, swingPhase, walkPose}(零 y 键——y 通道归 idle 呼吸;
      walkPose 恰六键同 idle 形, floatY 恒 0) · townPatrolLegById(state)
      → {锚id: (leg+1)%n}「HUD 下一站」映射(行走中标记=到站锚, 停驻中=
      下一站; 静态锚不进表由装配层建账保证)。
   依赖(均经全局名, 调用期解析): town-npc-anchor-core 的 anchorOf(航点
      单源取数+拼写域校验)与 TOWN_NPC_ANCHORS(航点数 n); 装载序恒晚于
      anchor-core(index.html 镇民链 / conventions gate CHAIN 同序);
      face→yaw 映射同式自带(维度件不在装具链本核心之前, 派令授权核心内
      自带同式纯函数, 语义对齐 js/adventure-dims-core.js 的 townYawOfFace
      四正交式, 不引第二份模块依赖)。
   可测性声明: 零三维渲染库 · 零 DOM · 零墙钟 · 零随机 · 零定时器 ·
      有同名单测(test/town-npc-behavior-core.test.js, 15 测可执行规格)。
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

/* ---------- CommonJS 导出守卫(town-npc.js 同款): 浏览器经典脚本共享
    词法环境, 顶层声明即全局, 供消费方直接引用; Node 下仅测试与装配
    消费, 挂 module.exports(导出面恰五名, 零杂散零遗漏)。 ---------- */
const TownNpcBehavior = {TOWN_NPC_PATROL, townPatrolState, townPatrolStep,
  townPatrolPose, townPatrolLegById};
if (typeof module !== 'undefined' && module.exports) module.exports = TownNpcBehavior;
