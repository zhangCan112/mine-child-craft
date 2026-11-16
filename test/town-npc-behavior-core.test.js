'use strict';
/* 镇民行为层推进者核心单测(test/town-npc-behavior-core.test.js) — T-NPC-13 a2+b1:
   G01 巡逻环状态机+腿内位姿派生纯函数, dt 注入零墙钟零随机(conventions §7 -core
   同名单测纪律; 不扩 anchor-core——锚点表/取数器消费经全局名, 时间推进是新词汇域)。
   契约面 = TOWN_NPC_PATROL(参数表) · townPatrolState/townPatrolStep/townPatrolPose/
   townPatrolLegById —— 红方裁决(T-NPC-13 票面 §5.1 授权红方裁, 随票面施工记录归档):
   · 状态机 {anchorId, leg, t, phase, dwellT, yaw, yawFrom}: leg=当前腿出发航点索引;
     phase ∈ 'dwell'|'walk'; t=腿内进度 0..1; yaw=最近朝向(到站=行进方向); yawFrom=
     起步朝向(朝向过渡插值起点); step 恒返回新对象(零突变)。
   · legById = (leg+1) % n ——「HUD 下一站」语义(拍板回执原话): 行走中标记=到站锚
     (本体在路上), 停驻中标记=下一站; legIndex 到站瞬间推进(票面 §6.2「到站推进」
     逐字), 每腿恰一跳=裁决三「到站跳变」节奏逐字保持; 纯 legIndex 整数缝不变。
     进场首拍账本对齐增量(leg0→下一站)属该语义自然结果(仅聚焦 G01 进场场合发一条
     刷新, 此后每腿恰一事件)。
   · 到站判定=t 计时沿(纯时间状态机); 锚点身份判定仍单源在消费机 anchorChanged
     (T-NPC-12 零改动)——本核心不复制重发判定(判据单份红线)。
   · 参数表六键字面锁(PO 后验可调, 改值须连测试过评审, town-npc.js IDLE_KEYS 先例):
     LEG_T=26(每腿 26 格≈1 格/秒慢速巡逻, docs/town-villagers-design.md §5.3) ·
     DWELL_T=3(到站停驻秒) · TURN_T=1.2(起步朝向过渡秒) · SWING_HZ=0.9(摆臂频率,
     铁傀儡重步频) · WALK_ARM_AMP=0.55 / WALK_LEG_AMP=0.7(摆幅弧度, 腿幅>臂幅)。
   · 走摆=walkPose 恰六键(idle 同形, floatY 恒 0——y 通道归 idle 呼吸, 装配层
     零写 y): armSwing=sin(t·LEG_T·SWING_HZ·2π)·WALK_ARM_AMP, legSwing=−sin(·)·
     WALK_LEG_AMP(消费复用 townNpcIdleApply 幂等面: armL=+armSwing/armR=−armSwing/
     legL=+legSwing/legR=−legSwing, 与 idle 同号约定=左臂右腿同相自然步态)。
   · yaw 过渡: 行走前 TURN_T 秒 lerpAngle(yawFrom→townYawOfFace(wp[leg].face), 最短
     弧回绕), 之后恒行进方向; 到站 yaw=行进方向, 停驻保持(「停驻望广场」参数后验)。
   真源装具: town-map+interact+anchor+dims 四纯件小 vm(town-npc.test.js 装载链序
   同款; 锚点表与 townYawOfFace 单源, 不桥第二份), 桥接宿主域供被测模块调用期
   解析; vm 域产物 JSON 往返摊平再断言(conventions §7.1)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 真源装具: town-map+interact+anchor 三纯件+dims-core 小 vm(镜像
    test/town-npc.test.js 装载链序——dims-core 装载期消费 TOWN_MAP, 独载必炸;
    锚点表与 townYawOfFace 单源, 不桥第二份) ---------- */
const ctx = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/town-map-core.js', 'js/town-interact-core.js',
  'js/town-npc-anchor-core.js', 'js/adventure-dims-core.js',
  'js/daylight-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
}
Object.assign(globalThis, vm.runInContext(
    '({anchorOf, anchorChanged, TOWN_NPC_ANCHORS, townYawOfFace, DAYLIGHT, Daylight,' +
    'TOWN_MAP})', ctx));

/* vm 域产物摊平进宿主域(跨域原型比对必假红, conventions §7.1-1) */
const flat = (o) => JSON.parse(JSON.stringify(o));

/* 红期归因装载: 模块缺席不炸装具(红因=实现缺席非装具炸, T-NPC-05 先例口径;
   optional catch binding, town-ui.test.js 装具先例) */
let BC = null;
try {
  BC = require('../js/town-npc-behavior-core.js');
} catch {
  BC = null;
}
function behaviorGuard() {
  assert.ok(BC, 'T-NPC-13 红期: js/town-npc-behavior-core.js 缺席' +
      '(红因=推进者核心未落实现, 非装具炸)');
}

/* G01 巡逻环数据(权威=TOWN_NPC_ANCHORS, 票面 §2.2 四航点闭环): wp0(66,24,66)
   面东 → wp1(92,24,66) 面南 → wp2(92,24,92) 面西 → wp3(66,24,92) 面北;
   face 沿走方向(wp[i].face=第 i 腿行进方向)。townYawOfFace: 东=−π/2 南=π
   西=π/2 北=0(js/adventure-dims-core.js:527)。 */
const EAST = -Math.PI / 2;
const SOUTH = Math.PI;
const pTbl = () => BC.TOWN_NPC_PATROL;

test('导出面恰十二名(c2 翻钉: 五名→十二名=巡逻五名+日程七名) + 巡逻参数表六键字面锁(PO 后验可调, 改值须连测试过评审)', () => {
  behaviorGuard();
  assert.deepStrictEqual(Object.keys(BC).sort(),
      ['TOWN_NPC_PATROL', 'TOWN_NPC_SCHEDULE', 'TOWN_SCHEDULE_PLANS',
        'townPatrolLegById', 'townPatrolPose', 'townPatrolState', 'townPatrolStep',
        'townScheduleLegById', 'townScheduleLegOf', 'townSchedulePose',
        'townScheduleState', 'townScheduleStep'],
      '导出面恰十二名(巡逻 1 表+4 函数 · 日程 2 表+5 函数, 零杂散零遗漏——c2 扩列, ' +
      '票面 §4.2.1-④「恰十名」为登记笔误已随红相修字, 实测面为准)');
  assert.deepStrictEqual(Object.keys(pTbl()).sort(),
      ['DWELL_T', 'LEG_T', 'SWING_HZ', 'TURN_T', 'WALK_ARM_AMP', 'WALK_LEG_AMP'],
      '巡逻参数表恰六键(零杂散零遗漏)');
  assert.deepStrictEqual(
      {LEG_T: pTbl().LEG_T, DWELL_T: pTbl().DWELL_T, TURN_T: pTbl().TURN_T,
        SWING_HZ: pTbl().SWING_HZ, WALK_ARM_AMP: pTbl().WALK_ARM_AMP,
        WALK_LEG_AMP: pTbl().WALK_LEG_AMP},
      {LEG_T: 26, DWELL_T: 3, TURN_T: 1.2, SWING_HZ: 0.9,
        WALK_ARM_AMP: 0.55, WALK_LEG_AMP: 0.7},
      '参数初值字面锁表(26 格腿≈1 格/秒慢巡逻; 停驻 3s; 过渡 1.2s; 0.9Hz 重步频; ' +
      '摆幅腿>臂——红方裁决初值, 依据 docs/town-villagers-design.md §5.3)');
  for (const k of Object.keys(pTbl())) {
    assert.strictEqual(typeof pTbl()[k], 'number', k + ' 为数值');
    assert.ok(Number.isFinite(pTbl()[k]) && pTbl()[k] > 0, k + ' 为正有限数(物理量)');
  }
  /* c2 日程两表在册键形概查(细目=后续日程节专测) */
  assert.ok(BC.TOWN_NPC_SCHEDULE && typeof BC.TOWN_NPC_SCHEDULE === 'object',
      'TOWN_NPC_SCHEDULE 参数表在册(c2 日程 tick 常量)');
  assert.ok(BC.TOWN_SCHEDULE_PLANS && typeof BC.TOWN_SCHEDULE_PLANS === 'object',
      'TOWN_SCHEDULE_PLANS 段表在册(c2 日程 13 村民段数据)');
});

test('townPatrolState: 初始 dwell 于 wp0 · 恰七键 · leg/t/dwellT 归零 · 朝向=面东', () => {
  behaviorGuard();
  const s = flat(BC.townPatrolState('npc:g01'));
  assert.deepStrictEqual(Object.keys(s).sort(),
      ['anchorId', 'dwellT', 'leg', 'phase', 't', 'yaw', 'yawFrom'],
      '状态机恰七键(零杂散零遗漏)');
  assert.strictEqual(s.anchorId, 'npc:g01');
  assert.strictEqual(s.leg, 0, '初始 leg0(与消费机账本 leg0 基线对齐, 进场零扰动)');
  assert.strictEqual(s.t, 0, '腿内进度归零');
  assert.strictEqual(s.phase, 'dwell', '进场先停驻(到站停驻语义, 望广场)');
  assert.strictEqual(s.dwellT, 0, '停驻计时归零');
  assert.strictEqual(s.yaw, EAST, '初始朝向=wp0 面(townYawOfFace east=−π/2, 与 placeTownNpc 摆放同向)');
  assert.strictEqual(s.yawFrom, EAST, '起步朝向同初始(首腿零转向)');
});

test('townPatrolState: 未知锚 id 抛中文域错(拼写域, anchorOf 同款口径)', () => {
  behaviorGuard();
  assert.throws(() => BC.townPatrolState('npc:zzz'), /未知/,
      '未知 id 抛错且消息含「未知」(镜像 anchorOf 拼写域口径)');
});

test('初始位姿: dwell 于 wp0 (66,66) · moving=false · progress=0 · walkPose 全零', () => {
  behaviorGuard();
  const p = flat(BC.townPatrolPose(BC.townPatrolState('npc:g01')));
  assert.deepStrictEqual(Object.keys(p).sort(),
      ['moving', 'progress', 'swingPhase', 'walkPose', 'x', 'yaw', 'z'],
      '位姿恰七键(零 y 键——y 通道归 idle 呼吸, 装配层零写)');
  assert.strictEqual(p.x, 66, '初始 x=wp0(66)');
  assert.strictEqual(p.z, 66, '初始 z=wp0(66)');
  assert.strictEqual(p.yaw, EAST, '初始朝向面东');
  assert.strictEqual(p.moving, false, '停驻不动');
  assert.strictEqual(p.progress, 0, '腿内进度 0');
  const w = p.walkPose;
  assert.deepStrictEqual(Object.keys(w).sort(),
      ['armSwing', 'floatY', 'headPitch', 'legSwing', 'neckPitch', 'tailYaw'],
      'walkPose 恰六键(idle 同形, 复用 townNpcIdleApply 的形状前提)');
  assert.strictEqual(w.floatY, 0, 'floatY 恒 0(走摆零写 y)');
  assert.strictEqual(w.armSwing, 0, '停驻零摆臂');
  assert.strictEqual(w.legSwing, 0, '停驻零摆腿');
});

test('停驻→行走边界: dwellT 累计到 DWELL_T 即转 walk(t 归零, leg 不变)——出发零跳变', () => {
  behaviorGuard();
  let s = BC.townPatrolState('npc:g01');
  s = BC.townPatrolStep(s, 1);
  assert.strictEqual(flat(s).phase, 'dwell', '停驻中');
  assert.strictEqual(flat(s).dwellT, 1, '停驻计时累计');
  s = BC.townPatrolStep(s, 2); /* 累计 3.0=DWELL_T, 恰到边界 */
  const mid = flat(s);
  assert.strictEqual(mid.phase, 'walk', '停驻满 DWELL_T 即起步');
  assert.strictEqual(mid.t, 0, '腿内进度归零');
  assert.strictEqual(mid.leg, 0, 'leg 到站才推进(起步不推——票面 §6.2「到站推进」)');
  const lbBefore = flat(BC.townPatrolLegById(BC.townPatrolState('npc:g01')));
  const lbAfter = flat(BC.townPatrolLegById(s));
  assert.deepStrictEqual(lbAfter, lbBefore, '出发瞬间 legById 零跳变(跳变只发生在到站)');
});

test('行走进度: 单步大 dt 精确线性(13s→0.5) · 位姿=航点线性插值(79,66) · moving=true', () => {
  behaviorGuard();
  let s = BC.townPatrolStep(BC.townPatrolState('npc:g01'), 3); /* 起步 */
  s = BC.townPatrolStep(s, 13); /* 单步: t=13/26=0.5(二进制精确, 零累积误差) */
  const st = flat(s);
  assert.strictEqual(st.phase, 'walk');
  assert.ok(Math.abs(st.t - 0.5) < 1e-12, 't=0.5(线性: dt/LEG_T)');
  const p = flat(BC.townPatrolPose(s));
  assert.strictEqual(p.moving, true, '行走中');
  assert.ok(Math.abs(p.progress - 0.5) < 1e-12, 'progress=0.5');
  assert.ok(Math.abs(p.x - 79) < 1e-9, 'x=66+(92−66)×0.5=79(匀速滑行, 航点线性插值)');
  assert.strictEqual(p.z, 66, 'z 恒 66(东行腿轴对齐)');
  /* 四分之一腿: 6.5s → t=0.25 → x=72.5 */
  let s2 = BC.townPatrolStep(BC.townPatrolState('npc:g01'), 3);
  s2 = BC.townPatrolStep(s2, 6.5);
  assert.ok(Math.abs(flat(BC.townPatrolPose(s2)).x - 72.5) < 1e-9,
      'x=72.5(progress 0.25, 匀速非缓动——裁决三留白面口径「匀速滑行」)');
});

test('到站: t 满 LEG_T 即到站推进——leg 0→1 · 相位回 dwell · 进度归零 · 到站点精确落 wp1', () => {
  behaviorGuard();
  let s = BC.townPatrolStep(BC.townPatrolState('npc:g01'), 3); /* 起步 */
  s = BC.townPatrolStep(s, 26); /* 满腿: 13+13 也可, 单步跨到站沿 */
  const st = flat(s);
  assert.strictEqual(st.phase, 'dwell', '到站回停驻');
  assert.strictEqual(st.leg, 1, 'legIndex 到站推进 0→1(票面 §6.2「到站推进」)');
  assert.strictEqual(st.t, 0, '进度归零(无过冲残留)');
  assert.strictEqual(st.dwellT, 0, '停驻计时重开');
  assert.strictEqual(st.yaw, EAST, '到站朝向=行进方向(东行腿走完仍面东)');
  const p = flat(BC.townPatrolPose(s));
  assert.strictEqual(p.x, 92, '到站点 x=wp1(92) 精确(无插值过冲)');
  assert.strictEqual(p.z, 66, '到站点 z=wp1(66) 精确');
  assert.strictEqual(p.moving, false, '到站即停');
});

test('过冲单步: 大 dt 只推进一个相位(到站不连跳两腿) · 停驻大 dt 只起步不入行走末', () => {
  behaviorGuard();
  let s = BC.townPatrolStep(BC.townPatrolState('npc:g01'), 3); /* 起步 */
  s = BC.townPatrolStep(s, 1e3); /* 巨 dt: 一交接力, 不连穿两沿 */
  let st = flat(s);
  assert.strictEqual(st.leg, 1, '单步单 transition: leg 0→1(不连到 2)');
  assert.strictEqual(st.phase, 'dwell');
  s = BC.townPatrolStep(s, 1e3);
  st = flat(s);
  assert.strictEqual(st.phase, 'walk', '停驻巨 dt 只起步');
  assert.strictEqual(st.leg, 1, 'leg 不动(行走中到站才推进)');
  assert.strictEqual(st.t, 0, '行走进度归零(不跨到站沿)');
});

test('闭环回归: 四腿循环 leg 0→1→2→3→0 · 每腿恰一到站 · legById 序列 1→2→3→0→1', () => {
  behaviorGuard();
  let s = BC.townPatrolState('npc:g01');
  let arrivals = 0;
  const legByIdSeq = [flat(BC.townPatrolLegById(s))['npc:g01']];
  let prevPhase = flat(s).phase;
  /* 480 帧×0.25s=120s > 全环 116s(4×(3+26)), 观测窗恰覆盖一闭环 */
  for (let i = 0; i < 480; i++) {
    s = BC.townPatrolStep(s, 0.25);
    const ph = flat(s).phase;
    if (prevPhase === 'walk' && ph === 'dwell') {
      arrivals++;
      legByIdSeq.push(flat(BC.townPatrolLegById(s))['npc:g01']);
    }
    prevPhase = ph;
  }
  assert.strictEqual(arrivals, 4, '全环恰 4 次到站(116s 环, 120s 观测窗)');
  assert.deepStrictEqual(legByIdSeq, [1, 2, 3, 0, 1],
      'legById 到站推进序列=下一站索引循环(「HUD 下一站」语义, 每腿恰一跳)');
  assert.strictEqual(flat(s).leg, 0, '闭环: 第四腿走完回到 leg0');
});

test('朝向过渡: 起步 TURN_T 内 yawFrom→行进方向最短弧插值 · 过渡完恒行进方向', () => {
  behaviorGuard();
  let s = BC.townPatrolStep(BC.townPatrolState('npc:g01'), 3); /* 起步(首腿 yawFrom=面东=目标, 零转向) */
  /* 造一个带转向的腿: 先闭环一次到 wp1 停驻(面东), 再起步南行(目标 yaw=π) */
  s = BC.townPatrolStep(s, 26); /* 到站 wp1, 面东(行进方向) */
  assert.strictEqual(flat(s).yaw, EAST, '前置: 停驻面东');
  s = BC.townPatrolStep(s, 3); /* 第二腿起步 wp1→wp2(南行, 目标 yaw=π) */
  /* 过渡半程 0.6s(k=0.5): 最短弧 delta=wrap(π−(−π/2))=−π/2 → yaw=−π/2−π/4=−3π/4 */
  s = BC.townPatrolStep(s, 0.6);
  assert.ok(Math.abs(flat(BC.townPatrolPose(s)).yaw - (-3 * Math.PI / 4)) < 1e-9,
      '过渡半程 yaw=−3π/4(最短弧右转 45°, 非绕远 270°——lerpAngle 回绕口径)');
  /* 过渡完(累计 1.2s): 恒行进方向 π(面南) */
  s = BC.townPatrolStep(s, 0.6);
  assert.ok(Math.abs(flat(BC.townPatrolPose(s)).yaw - SOUTH) < 1e-9,
      'TURN_T 满即恒行进方向(yaw=π 面南, wp1.face=行进方向)');
  /* 过渡后再走: yaw 不漂(恒行进方向) */
  s = BC.townPatrolStep(s, 5);
  assert.ok(Math.abs(flat(BC.townPatrolPose(s)).yaw - SOUTH) < 1e-9, '过渡窗外 yaw 恒定');
});

test('legById 键域: 恰 patrol 键一项(静态 13 锚不进 legById=零扰动零事件的数据前提)', () => {
  behaviorGuard();
  let s = BC.townPatrolState('npc:g01');
  const lb0 = flat(BC.townPatrolLegById(s));
  assert.deepStrictEqual(Object.keys(lb0), ['npc:g01'], '恰 g01 一键(静态锚零进表)');
  assert.strictEqual(lb0['npc:g01'], 1, '进场下一站=wp1(「HUD 下一站」语义)');
  s = BC.townPatrolStep(s, 29); /* 首次到站(dwell3+walk26) */
  assert.strictEqual(flat(BC.townPatrolLegById(s))['npc:g01'], 2, '到站后下一站=wp2(每腿恰一跳)');
  s = BC.townPatrolStep(s, 29);
  assert.strictEqual(flat(BC.townPatrolLegById(s))['npc:g01'], 3, '第二到站→wp3');
  s = BC.townPatrolStep(s, 29);
  assert.strictEqual(flat(BC.townPatrolLegById(s))['npc:g01'], 0, '第三到站→wp0(取模回绕)');
});

test('纯度: step/pose/legById 零突变(输入状态逐字节不变) + step 恒返新对象', () => {
  behaviorGuard();
  const s = BC.townPatrolState('npc:g01');
  const before = flat(s);
  BC.townPatrolStep(s, 5);
  BC.townPatrolPose(s);
  BC.townPatrolLegById(s);
  assert.deepStrictEqual(flat(s), before, '入参零突变(-core 纯函数契约)');
  const s2 = BC.townPatrolStep(s, 5);
  assert.notStrictEqual(s2, s, 'step 返回新对象(状态机式, 写赢归装配层)');
});

test('dt 边界: 零步恒等(新对象同值) · 负/非有限 dt 回落零步 · 同 dt 序列确定性重放', () => {
  behaviorGuard();
  const s = BC.townPatrolState('npc:g01');
  const z = flat(BC.townPatrolStep(s, 0));
  assert.deepStrictEqual(z, flat(s), 'dt=0 恒等(暂停不喂 dt 即冻结的口径基础)');
  for (const bad of [-1, NaN, Infinity, -Infinity]) {
    assert.deepStrictEqual(flat(BC.townPatrolStep(s, bad)), flat(s),
        'dt=' + bad + ' 回落零步(非有限输入零步进, 零炸)');
  }
  /* 确定性: 同 dt 序列两条独立状态机终态逐字节一致(零墙钟零随机) */
  const seq = [1, 2, 0.5, 3, 13, 13, 0.25, 0.25];
  let a = BC.townPatrolState('npc:g01');
  let b = BC.townPatrolState('npc:g01');
  for (const dt of seq) {
    a = BC.townPatrolStep(a, dt);
    b = BC.townPatrolStep(b, dt);
  }
  assert.deepStrictEqual(flat(a), flat(b), '同 dt 序列同终态(确定性重放, SpinnerCore 同口径)');
});

test('走摆相位: 行走起步臂摆过零(sin 起点) · 幅度=参数表 · 腿/臂反号比恒 −WALK_LEG_AMP/WALK_ARM_AMP', () => {
  behaviorGuard();
  let s = BC.townPatrolStep(BC.townPatrolState('npc:g01'), 3); /* 起步 */
  const w0 = flat(BC.townPatrolPose(s)).walkPose;
  assert.strictEqual(w0.armSwing, 0, '起步臂摆过零(sin(0), 步态从中立位起)');
  assert.strictEqual(w0.legSwing, 0, '起步腿摆过零');
  s = BC.townPatrolStep(s, 13); /* progress=0.5: swingPhase=23.4π → sin=−0.951 */
  const w = flat(BC.townPatrolPose(s)).walkPose;
  assert.ok(Math.abs(w.armSwing) > 0.4, '腿中段臂摆显著(摆幅可读, |armSwing|≈0.52)');
  assert.ok(Math.abs(w.armSwing) <= pTbl().WALK_ARM_AMP + 1e-9, '臂幅不越参数上界');
  assert.ok(Math.abs(w.legSwing) <= pTbl().WALK_LEG_AMP + 1e-9, '腿幅不越参数上界');
  assert.ok(Math.abs(w.legSwing / w.armSwing - (-pTbl().WALK_LEG_AMP / pTbl().WALK_ARM_AMP)) < 1e-9,
      '腿摆/臂摆恒负比(反号=左臂右腿同相自然步态, 幅比=参数比)');
  assert.strictEqual(w.floatY, 0, '行走中 floatY 恒 0(y 通道归 idle)');
  assert.strictEqual(w.headPitch, 0, 'walkPose 零头俯(头转通道归 idle 注视)');
});

test('源文本卫生: 零三维渲染库·零 DOM·零墙钟·零随机·零定时器(-core 可测性声明执法)', () => {
  behaviorGuard();
  const src = fs.readFileSync(path.join(ROOT, 'js', 'town-npc-behavior-core.js'), 'utf8');
  for (const banned of ['THREE.', 'document.', 'window.', 'Date.now', 'performance.now',
    'Math.random', 'setTimeout', 'setInterval']) {
    assert.ok(src.indexOf(banned) < 0,
        '源文本零 ' + banned + '(纯核心: dt 注入确定性, 装配层才碰渲染件)');
  }
});

/* ============ c2 日程面: 十三村民日程时间轴(T-NPC-13 c2, 票面 §11.7.0-③④⑤) ============
   签名与语义红方裁决(随票面 §11.7.0 归档; 绿方签名以下列为准):
   · TOWN_NPC_SCHEDULE 参数表四键 {SPEED_GPT, DUSK_T, NIGHT_T, DAWN_T}——三 tick
     常量=DAYLIGHT.DIM_KEYS 转折值字面(clockPhase 断点, 零新魔法数); SPEED_GPT=秒/格。
   · TOWN_SCHEDULE_PLANS: 锚 id 键控('npc:v01' 形)段表, 每行恰四段
     [{from,leg,phase}×4]——phase=Daylight.clockPhase id 四值(day/dusk/night/dawn,
     零新枚举); from 升序覆盖全天; leg 引用 TOWN_NPC_ANCHORS 行内航点索引
     (day/dawn=0 工作位, dusk=聚集点, night=末航点=家)。
   · townScheduleLegOf(anchorId, dayTime) → {leg, phase}: 纯函数 f(dayTime)
     本体(ADR-0017 决策 4); dayTime 归一 [0,24000) 回绕; 段=最后一个 from≤t 的段。
   · townScheduleState(anchorId, dayTime) → 恰七键 {anchorId,leg,t,phase:'dwell',
     dir,yaw,yawFrom}: leg=当前段目标 leg(夜间进镇直接在家=摆放同源零首拍跳变);
     dwell 无时长(无 dwellT 键——与巡逻七键差异点); dir∈{-1,0,1}(dwell 恒 0);
     yaw=停驻语义朝向(townYawOfFace(航点 face))。
   · townScheduleStep(state, dayTime, dt): 恒新对象零突变; dt≤0/非有限回落零步;
     dwell+leg==target 恒等保持; dwell+leg≠target 起步(dir=sign(target-leg),
     起步帧 t=0 余量弃——单沿纪律同 G01 巨 dt 口径); walk 相 t+=dt/(腿格数×
     SPEED_GPT), t≥1 到站 leg+=dir 单沿交接(到站不连跳两腿), leg==target 转
     dwell(yaw=到站航点 face 语义朝向), 否则续 walk(t=0 拐点转身, yaw=下一腿
     几何行进方向); 腿中段切沿延迟到腿尾响应(walk 不中途改向, 滑行惯性语义,
     段切响应延迟≤一腿时长)。
   · townSchedulePose(state) → 恰七键 {x,z,yaw,moving,progress,swingPhase,walkPose}:
     停驻=精确落航点; 行走=航点线性插值(from=wp[leg], to=wp[leg+dir]); 走摆=
     sin(t·腿秒·SWING_HZ·2π)·摆幅(复用 TOWN_NPC_PATROL 三参数, 不复制第二份摆频表)。
   · townScheduleLegById(state) → {锚id: legIndex}: walk=leg+dir(行进目标腿=
     下一站); dwell=leg(本体位——与 G01「停驻中=下一站」差异裁决: 村民停驻以
     小时计, HUD/交互锚恒本体位, 点谁气泡在谁脚下); 到站帧同值零跳变
     (重发节奏=每腿起步帧恰一跳)。
   · 行进朝向=几何派生(legYawOf: 北 0/南 π/东 −π/2/西 π/2, 与 townYawOfFace
     前向向量同式)——停驻朝向=锚点 face 语义, 行进朝向不得复用 face
     (face 双语义拆分, §11.7.0-②; 工作位 face=SEM 工作朝向如 V01 面南迎客)。
   日程数据锚例(字面终版见 test/town-npc-anchor-core.test.js c2 锁, 此处只引用):
     V01=[(79,94)w,(79,80)g,(79,96)h] 腿 14/16 格 · V03=[(91,85)w,(68,85)g,(56,85)h]
     腿 23/12 格 · V02 五点 [(69,57),(69,66),(73,66),(73,72)g,(56,72)h] 腿 9/4/6/17 格。
   时间换算: 20 tick/秒(DAYLIGHT.advance 口径); 一日 24000 tick=1200s。 */

const schedTbl = () => BC.TOWN_NPC_SCHEDULE;
const plansTbl = () => BC.TOWN_SCHEDULE_PLANS;

/* 红期归因守卫(日程节专用): BC 在但日程面缺席时红因=「日程面未施工」而非
   TypeError 炸(镜像 anchor-core 红期守卫式提取口径); 巡逻节保持 behaviorGuard
   不被污染——日程节红在日程语义上, 巡逻节 15 测保持绿。 */
function schedGuard() {
  behaviorGuard();
  for (const fn of ['TOWN_NPC_SCHEDULE', 'TOWN_SCHEDULE_PLANS', 'townScheduleLegOf',
    'townScheduleState', 'townScheduleStep', 'townSchedulePose', 'townScheduleLegById']) {
    assert.ok(BC[fn], 'T-NPC-13 c2 红期: town-npc-behavior-core.js 缺 ' + fn +
        '(红因=日程面未施工, 非装具炸)');
  }
}

/* 日程状态造法小工具: 恒以 townScheduleState 造合法初态(与装配层同源) */
const schedState = (id, dayTime) => BC.townScheduleState(id, dayTime);

test('c2·TOWN_NPC_SCHEDULE 四键字面锁: SPEED_GPT=1 秒/格 · 三 tick 常量=DAYLIGHT.DIM_KEYS 转折值(clockPhase 断点, 零新魔法数)', () => {
  schedGuard();
  const s = schedTbl();
  assert.deepStrictEqual(Object.keys(s).sort(),
      ['DAWN_T', 'DUSK_T', 'NIGHT_T', 'SPEED_GPT'], '参数表恰四键(零杂散零遗漏)');
  assert.deepStrictEqual({SPEED_GPT: s.SPEED_GPT, DUSK_T: s.DUSK_T,
    NIGHT_T: s.NIGHT_T, DAWN_T: s.DAWN_T},
  {SPEED_GPT: 1, DUSK_T: 12040, NIGHT_T: 13670, DAWN_T: 22330},
  '参数初值字面锁(1 格/秒与 G01 LEG_T=26/26 格同速口径; 断点=ADR-0017 §2-8)');
  /* 跨表对账: 与 daylight-core 同源零漂移(改 DAYLIGHT 曲线须连带日程过评审) */
  assert.strictEqual(s.DUSK_T, DAYLIGHT.DIM_KEYS[1][0], 'DUSK_T=白天→傍晚折线转折 tick');
  assert.strictEqual(s.NIGHT_T, DAYLIGHT.DIM_KEYS[2][0], 'NIGHT_T=傍晚→夜晚折线转折 tick');
  assert.strictEqual(s.DAWN_T, DAYLIGHT.DIM_KEYS[3][0], 'DAWN_T=夜晚→清晨折线转折 tick');
  assert.strictEqual(DAYLIGHT.TICKS, 24000, '一日 24000 tick(时间轴权威对账)');
  for (const k of ['DUSK_T', 'NIGHT_T', 'DAWN_T']) {
    assert.ok(Number.isInteger(s[k]) && s[k] > 0 && s[k] < DAYLIGHT.TICKS,
        k + ' 为 [0,24000) 内整数 tick');
  }
});

test('c2·TOWN_SCHEDULE_PLANS 键域: 恰 13 村民锚 id 键(npc: 形) · 与 TOWN_NPC_ANCHORS 村民集对账 · G01 不在册(巡逻专属, 装配分流数据前提)', () => {
  schedGuard();
  const keys = Object.keys(plansTbl());
  const villagers = TOWN_NPC_ANCHORS.filter((r) => r.npcId !== 'G01').map((r) => r.id);
  assert.deepStrictEqual([...keys].sort(), [...villagers].sort(),
      '段表键域=13 村民锚 id 集合(锚点表对账, 零杂散零遗漏)');
  assert.ok(!keys.includes('npc:g01'), 'G01 不在段表(日程机/巡逻机分流判据=「段表在册」)');
  assert.strictEqual(keys.length, 13, '恰 13 键(十三村民, c2 口径)');
});

test('c2·PLANS 行形状: 每行恰四段×恰三键 {from,leg,phase} · from 字面升序覆盖全天 · ' +
    'phase=clockPhase id 词表序 · leg 界内且 day/dawn=0 · night=末航点(家) · dusk 指向∈hub 带', () => {
  schedGuard();
  const FROMS = [0, schedTbl().DUSK_T, schedTbl().NIGHT_T, schedTbl().DAWN_T];
  const PHASES = ['day', 'dusk', 'night', 'dawn'];
  const hub = TOWN_MAP.zones.find((zn) => zn.id === 'hub');
  const rowById = Object.fromEntries(TOWN_NPC_ANCHORS.map((r) => [r.id, r]));
  for (const id of Object.keys(plansTbl())) {
    const plan = plansTbl()[id];
    assert.ok(Array.isArray(plan) && plan.length === 4,
        '「' + id + '」恰四段(全天四段覆盖)');
    plan.forEach((seg, i) => {
      assert.deepStrictEqual(Object.keys(seg).sort(), ['from', 'leg', 'phase'],
          '「' + id + '」段 ' + i + ' 恰三键 from/leg/phase');
      assert.strictEqual(seg.from, FROMS[i], '「' + id + '」段 ' + i + ' from=' + FROMS[i] +
          '(字面升序, 断点对账 TOWN_NPC_SCHEDULE)');
      assert.strictEqual(seg.phase, PHASES[i], '「' + id + '」段 ' + i + ' phase=' +
          PHASES[i] + '(clockPhase 四段词表序, 零新枚举)');
      const n = rowById[id].waypoints.length;
      assert.ok(Number.isInteger(seg.leg) && seg.leg >= 0 && seg.leg < n,
          '「' + id + '」段 ' + i + ' leg=' + seg.leg + ' 界内 [0,' + n + ')');
    });
    assert.strictEqual(plan[0].leg, 0, '「' + id + '」day 段 leg0=工作位(白天在岗)');
    assert.strictEqual(plan[3].leg, 0, '「' + id + '」dawn 段 leg0=工作位(清晨回岗)');
    assert.strictEqual(plan[2].leg, rowById[id].waypoints.length - 1,
        '「' + id + '」night 段 leg=末航点=家(夜间归家=序列终点)');
    const g = rowById[id].waypoints[plan[1].leg];
    assert.ok(g.x >= hub.x1 && g.x <= hub.x2 && g.z >= hub.z1 && g.z <= hub.z2,
        '「' + id + '」dusk 段 leg 指向 (' + g.x + ',' + g.z + ') ∈ hub 带(傍晚聚集, ' +
        '段表×锚点表×世界分区三方对账)');
  }
});

test('c2·townScheduleLegOf 四段取样(V01): day→{0,day} · dusk→{1,dusk} · night→{2,night} · ' +
    'dawn→{0,dawn}(纯函数 f(dayTime) 本体)', () => {
  schedGuard();
  const legOf = (t) => flat(BC.townScheduleLegOf('npc:v01', t));
  assert.deepStrictEqual(Object.keys(legOf(1000)).sort(), ['leg', 'phase'],
      '返回恰二键 leg/phase');
  assert.deepStrictEqual(legOf(1000), {leg: 0, phase: 'day'}, '白天→工作位 leg0');
  assert.deepStrictEqual(legOf(12100), {leg: 1, phase: 'dusk'}, '傍晚→聚集点 leg1');
  assert.deepStrictEqual(legOf(15000), {leg: 2, phase: 'night'}, '夜晚→家 leg2(末航点)');
  assert.deepStrictEqual(legOf(23000), {leg: 0, phase: 'dawn'}, '清晨→工作位 leg0');
});

test('c2·townScheduleLegOf 边界沿与回绕: from≤t 左闭(12040 恰 dusk) · 24000 回绕 day · 负值/越界归一(镜像 dlNorm 口径)', () => {
  schedGuard();
  const legOf = (t) => flat(BC.townScheduleLegOf('npc:v01', t));
  assert.deepStrictEqual(legOf(12040), {leg: 1, phase: 'dusk'},
      't=12040 恰落 dusk(段=最后一个 from≤t, 左闭沿)');
  assert.deepStrictEqual(legOf(13670), {leg: 2, phase: 'night'}, 't=13670 恰落 night');
  assert.deepStrictEqual(legOf(22330), {leg: 0, phase: 'dawn'}, 't=22330 恰落 dawn');
  assert.deepStrictEqual(legOf(23999), {leg: 0, phase: 'dawn'}, 't=23999 仍 dawn');
  assert.deepStrictEqual(legOf(24000), {leg: 0, phase: 'day'}, 't=24000 回绕=次日 day');
  assert.deepStrictEqual(legOf(0), {leg: 0, phase: 'day'}, 't=0 day 段起点');
  assert.deepStrictEqual(legOf(-100), {leg: 0, phase: 'dawn'},
      't=-100 归一回绕→23900∈dawn(负值防御, Daylight.advance 回绕同款)');
  assert.deepStrictEqual(legOf(25040), {leg: 0, phase: 'day'}, 't=25040 归一→1040∈day');
});

test('c2·townScheduleLegOf 域错: 未知锚抛含「未知」中文错(拼写域, anchorOf/townPatrolState 同款) · G01 不在日程簿抛错(分流判据=段表在册)', () => {
  schedGuard();
  assert.throws(() => BC.townScheduleLegOf('npc:zzz', 1000), /未知/,
      '未知 id 抛错且消息含「未知」');
  assert.throws(() => BC.townScheduleLegOf('npc:g01', 1000), /未知/,
      'G01 不在段表=非日程锚(装配层「PLANS 含该锚」分流的数据面同源判定)');
});

test('c2·townScheduleState 白天在岗: V01@dayTime=1000 恰七键(无 dwellT——与巡逻机差异点) · ' +
    'leg0/dwell/dir0 · yaw=yawFrom=工作位 face 语义朝向(面南迎客, SEM 零漂移)', () => {
  schedGuard();
  const s = flat(schedState('npc:v01', 1000));
  assert.deepStrictEqual(Object.keys(s).sort(),
      ['anchorId', 'dir', 'leg', 'phase', 't', 'yaw', 'yawFrom'],
      '日程状态恰七键(零 dwellT——村民停驻无时长, 段切即走)');
  assert.strictEqual(s.anchorId, 'npc:v01');
  assert.strictEqual(s.leg, 0, 'day 段目标 leg0=工作位');
  assert.strictEqual(s.t, 0, '腿内进度归零');
  assert.strictEqual(s.phase, 'dwell', '初态停驻(摆放同源)');
  assert.strictEqual(s.dir, 0, '停驻方向归零');
  assert.strictEqual(s.yaw, Math.PI, 'yaw=工作位 face 语义朝向(wp0 face south→π, ' +
      '现网镇貌零漂移: V01 面南迎客 SEM 锚定)');
  assert.strictEqual(s.yawFrom, Math.PI, 'yawFrom 同 yaw(零转向初值)');
});

test('c2·townScheduleState 段切初值: dusk→聚集 dwell · night→家 dwell(yaw=家 face) · ' +
    'dawn→工作位 dwell——「夜间进镇直接在家」摆放同源零首拍跳变', () => {
  schedGuard();
  const dusk = flat(schedState('npc:v01', 12100));
  assert.strictEqual(dusk.leg, 1, 'dusk 段初始 leg=聚集点(段表 leg 直取)');
  assert.strictEqual(dusk.phase, 'dwell', '初始即停驻于聚集(不做半路插值)');
  const night = flat(schedState('npc:v01', 15000));
  assert.strictEqual(night.leg, 2, 'night 段初始 leg=家(末航点——夜间进镇村民直接在家)');
  assert.strictEqual(night.yaw, 0, '家 face north→yaw=0(面镇心安眠语义)');
  const dawn = flat(schedState('npc:v01', 23000));
  assert.strictEqual(dawn.leg, 0, 'dawn 段初始 leg=工作位');
  assert.strictEqual(dawn.yaw, Math.PI, '工作位 face south→yaw=π(回岗即恢复 SEM 朝向)');
});

test('c2·townScheduleState 域错: 未知锚抛含「未知」中文错 · G01 不在日程簿抛错(与 LegOf 同口径)', () => {
  schedGuard();
  assert.throws(() => BC.townScheduleState('npc:zzz', 1000), /未知/, '未知 id 抛错');
  assert.throws(() => BC.townScheduleState('npc:g01', 1000), /未知/,
      'G01 非日程锚(段表在册分流的数据面同源)');
});

test('c2·dwell 恒等保持: day 段 leg==target · 多帧 step 恒 dwell 同值新对象 · dayTime 越界读数归一后同恒等(25000→day 段)', () => {
  schedGuard();
  let s = schedState('npc:v01', 1000);
  const before = flat(s);
  for (const [dt, dayTime] of [[1, 1000], [10, 3000], [3600, 11900]]) {
    const s2 = BC.townScheduleStep(s, dayTime, dt);
    assert.deepStrictEqual(flat(s2), before, 'day 段 step(dt=' + dt + ') 恒等保持(在岗无位移)');
    assert.notStrictEqual(s2, s, '恒返回新对象(零突变红线)');
    s = s2;
  }
  assert.deepStrictEqual(flat(BC.townScheduleStep(s, 25040, 5)), before,
      'dayTime=25040 归一→day 段, 同恒等(越界读数防御)');
});

test('c2·段切起步+起步帧余量弃: dusk 段 dwell≠target 首帧起步 walk(dir=+1,t=0) · 巨 dt 只起步不跨到站沿(单沿纪律同 G01)', () => {
  schedGuard();
  const s = schedState('npc:v01', 11000); /* 白天在岗 dwell@0 */
  const w = flat(BC.townScheduleStep(s, 12040, 1)); /* 首个 dusk 读数帧 */
  assert.strictEqual(w.phase, 'walk', 'dusk 段首帧即起步(dwell 无时长, 段切即走)');
  assert.strictEqual(w.dir, 1, 'dir=sign(1−0)=+1(向聚集行进)');
  assert.strictEqual(w.t, 0, '起步帧 t=0(本帧余量弃)');
  assert.strictEqual(w.leg, 0, 'leg 到站才推进(起步不推)');
  const big = flat(BC.townScheduleStep(s, 12100, 1e3)); /* 巨 dt 起步帧 */
  assert.strictEqual(big.phase, 'walk');
  assert.strictEqual(big.t, 0, '巨 dt 只起步: t=0 不跨到站沿(一帧一 transition)');
  assert.strictEqual(big.leg, 0, 'leg 不动');
});

test('c2·walk 行进线性与位姿插值: t=dt/(腿格数×SPEED_GPT) · V01 北行 t=0.5→(79,87) yaw=0 · ' +
    'V03 西行 t=0.5→(79.5,85) yaw=π/2(行进朝向=几何派生, 不复用 face)', () => {
  schedGuard();
  let s = BC.townScheduleStep(schedState('npc:v01', 11000), 12040, 1); /* dusk 起步 */
  s = BC.townScheduleStep(s, 12100, 7); /* 腿 0→1 长 14 格×1=14s: t=0.5 */
  const st = flat(s);
  assert.ok(Math.abs(st.t - 0.5) < 1e-12, 't=0.5(dt/(14×1), 二进制精确)');
  const p = flat(BC.townSchedulePose(s));
  assert.strictEqual(p.moving, true, '行走中');
  assert.ok(Math.abs(p.progress - 0.5) < 1e-12, 'progress=0.5');
  assert.strictEqual(p.x, 79, 'x 恒 79(x 轴对齐腿)');
  assert.ok(Math.abs(p.z - 87) < 1e-9, 'z=94+(80−94)×0.5=87(航点线性插值, 匀速滑行)');
  assert.strictEqual(p.yaw, 0, '北行 yaw=0(legYawOf 几何派生: dz<0→北; ' +
      'wp1.face=north 恰同值但语义源不同——西行例另证)');
  /* 西行: V03=(91,85)→(68,85), face=south(π) 的工作位走西行腿——yaw 必 π/2 证几何派生 */
  let s3 = BC.townScheduleStep(schedState('npc:v03', 11000), 12040, 1);
  s3 = BC.townScheduleStep(s3, 12100, 11.5); /* 腿 0→1 长 23 格: t=0.5 */
  const p3 = flat(BC.townSchedulePose(s3));
  assert.ok(Math.abs(p3.x - 79.5) < 1e-9, 'x=91+(68−91)×0.5=79.5');
  assert.strictEqual(p3.z, 85, 'z 恒 85');
  assert.ok(Math.abs(p3.yaw - Math.PI / 2) < 1e-12,
      '西行 yaw=π/2(几何派生: dx<0→西; 若复用 wp0.face=south 会得 π——双语义拆分实证)');
});

test('c2·到站: t 满腿即到站 leg+=dir 单沿 · 转 dwell · 进度归零 · 落点精确=聚集航点 · yaw=到站航点 face 语义朝向(停驻语义)', () => {
  schedGuard();
  let s = BC.townScheduleStep(schedState('npc:v01', 11000), 12040, 1); /* 起步 */
  s = BC.townScheduleStep(s, 12100, 14); /* 满腿 14s 单步跨到站沿 */
  const st = flat(s);
  assert.strictEqual(st.phase, 'dwell', '到站回停驻');
  assert.strictEqual(st.leg, 1, 'legIndex 到站推进 0→1');
  assert.strictEqual(st.t, 0, '进度归零(无过冲残留)');
  assert.strictEqual(st.dir, 0, '停驻方向归零');
  assert.strictEqual(st.yaw, 0, '到站 yaw=wp1.face=north→0(聚集面钟塔主轴, 停驻=face 语义)');
  const p = flat(BC.townSchedulePose(s));
  assert.strictEqual(p.x, 79, '到站点 x=聚集(79) 精确');
  assert.strictEqual(p.z, 80, '到站点 z=聚集(80) 精确');
  assert.strictEqual(p.moving, false, '到站即停');
});

test('c2·过冲单步+到站不连跳两腿(V02 五点 dawn 逆行): 巨 dt 起步帧只起步 · 再巨 dt 只跨一沿(leg 4→3 续 walk t=0, 不连到 2)', () => {
  schedGuard();
  const s = schedState('npc:v02', 15000); /* night 段 dwell@4(家) */
  assert.strictEqual(flat(s).leg, 4, '前置: night 初始在家 leg4');
  const w = flat(BC.townScheduleStep(s, 22331, 1e3)); /* dawn 段巨 dt: 起步帧 */
  assert.strictEqual(w.phase, 'walk', 'dawn 段首帧起步(逆行回家→工作位)');
  assert.strictEqual(w.dir, -1, 'dir=sign(0−4)=−1(沿序列逆行)');
  assert.strictEqual(w.t, 0, '起步帧余量弃');
  const a = flat(BC.townScheduleStep(w, 22331 + 20 * 1e3, 1e3)); /* 巨 dt 行进帧(自起步帧 w 续泵, 红方 :588 入参笔误随绿相裁决修) */
  assert.strictEqual(a.leg, 3, '单步单 transition: leg 4→3(不连到 2)');
  assert.strictEqual(a.phase, 'walk',
      '到站重判 target(42331 归一 18331∈night→target=2≠3)续 walk(拐点不停驻)');
  assert.strictEqual(a.t, 0, '新腿 t=0(到站帧余量弃, 下一帧才走)');
});

test('c2·腿中段切沿延迟到腿尾: walk 中 dayTime 拨入 night 不中途改向 · 本腿走完到站才重判 target 续走新目标(滑行惯性, 段切延迟≤一腿)', () => {
  schedGuard();
  let s = BC.townScheduleStep(schedState('npc:v01', 11000), 12040, 1); /* dusk 起步(target=1) */
  s = BC.townScheduleStep(s, 12100, 7); /* 腿中 t=0.5 */
  assert.strictEqual(flat(s).phase, 'walk', '前置: 行进中');
  s = BC.townScheduleStep(s, 13700, 7); /* dayTime 已入 night(target=2), 本腿只剩 7s<14s */
  const st = flat(s);
  assert.strictEqual(st.leg, 1, '本腿走完到站 leg=1(未中途折向聚集→家)');
  assert.strictEqual(st.phase, 'walk', '到站重判 target=2≠1: 续 walk(拐点不停驻)');
  assert.strictEqual(st.t, 0, '新腿(1→2)从零起');
  assert.strictEqual(st.dir, 1, 'dir 仍 +1(向 leg2 家)');
  const p = flat(BC.townSchedulePose(s));
  assert.ok(Math.abs(p.yaw - Math.PI) < 1e-12, '拐点转身: yaw=下一腿(南行)几何方向 π');
  s = BC.townScheduleStep(s, 13700, 16); /* 腿 1→2 长 16s 走完 */
  const home = flat(s);
  assert.strictEqual(home.phase, 'dwell', '到家停驻');
  assert.strictEqual(home.leg, 2, 'leg=2=家(night target 达成)');
  assert.strictEqual(home.yaw, 0, '家 face north→yaw=0');
});

test('c2·全日端到端泵(V01, dt=1s 泵一日回绕): dusk 到聚集 · night 到家 · dawn 回工作位 · 恰三次到站 · 恒沿序列逐腿(dir=±1)', () => {
  schedGuard();
  let s = schedState('npc:v01', 11800); /* day 段在岗 */
  const arrivals = [];
  const phases = new Set(['day']);
  let prev = flat(s).phase;
  for (let i = 0; i < 1210; i++) {/* 1210 帧=24200tick>24000 跨回绕; 窗收在次日
      dusk 起步帧(i=1212)之前——恰含三次到站(dusk/night/dawn), 次日循环不入窗
      (原 1260 帧会把第 4 次到站卷进来, 红方泵窗算术随绿相裁决修) */
    const dayTime = ((11800 + i * 20) % 24000 + 24000) % 24000;
    s = BC.townScheduleStep(s, dayTime, 1);
    const ph = flat(s).phase;
    phases.add(ph);
    if (prev === 'walk' && ph === 'dwell') {
      arrivals.push({leg: flat(s).leg, dayTime});
    }
    prev = ph;
  }
  assert.deepStrictEqual(arrivals.map((a) => a.leg), [1, 2, 0],
      '到站序列: 聚集(1)→家(2)→工作位(0)——日程三段往返');
  assert.ok(arrivals.length === 3 && arrivals[0].dayTime >= 12040 && arrivals[0].dayTime < 13670,
      '第一次到站落 dusk 段(到聚集)');
  assert.ok(arrivals[1].dayTime >= 13670 && arrivals[1].dayTime < 22330,
      '第二次到站落 night 段(到家)');
  assert.ok(arrivals[2].dayTime >= 22330,
      '第三次到站落 dawn 段(回岗)');
  const end = flat(s);
  assert.strictEqual(end.leg, 0, '一日终态: 回到工作位 leg0');
  assert.strictEqual(end.phase, 'dwell', '终态停驻(在岗)');
});

test('c2·townScheduleLegById: dwell=本体位(HUD 气泡在脚下) · walk=下一站(leg+dir) · 起步帧恰一跳 · 到站帧同值零跳变(重发节奏=每腿起步帧恰一跳)', () => {
  schedGuard();
  const lb = (st) => flat(BC.townScheduleLegById(st))['npc:v01'];
  const s0 = schedState('npc:v01', 1000);
  assert.deepStrictEqual(Object.keys(flat(BC.townScheduleLegById(s0))), ['npc:v01'],
      '恰锚 id 一键(键域与 PLANS 同源)');
  assert.strictEqual(lb(s0), 0, 'day 停驻: legById=0=本体位(工作位, 与 G01「停驻中=下一站」差异裁决)');
  let s = BC.townScheduleStep(s0, 12040, 1); /* dusk 起步帧 */
  assert.strictEqual(lb(s), 1, '起步帧跳到下一站 leg1(每腿恰一跳=消费机重发节奏)');
  s = BC.townScheduleStep(s, 12100, 7); /* 腿中 */
  assert.strictEqual(lb(s), 1, 'walk 中恒=行进目标腿');
  s = BC.townScheduleStep(s, 12100, 7); /* 到站 dwell@1 */
  assert.strictEqual(lb(s), 1, '到站帧 legById 同值零跳变(dwell=本体位=聚集, 账本幂等)');
  const night = schedState('npc:v01', 15000);
  assert.strictEqual(lb(night), 2, 'night 停驻: legById=2=家=本体位');
});

test('c2·townSchedulePose 形与走摆: dwell 全零停驻 · walk 起步摆过零 · ' +
    '中段显著+腿臂反号幅比=PATROL 参数比 · swingPhase=t·腿秒·SWING_HZ·2π(复用摆频表不复制)', () => {
  schedGuard();
  const p0 = flat(BC.townSchedulePose(schedState('npc:v01', 1000)));
  assert.deepStrictEqual(Object.keys(p0).sort(),
      ['moving', 'progress', 'swingPhase', 'walkPose', 'x', 'yaw', 'z'],
      '位姿恰七键(零 y 键, 巡逻机同形)');
  assert.deepStrictEqual(Object.keys(p0.walkPose).sort(),
      ['armSwing', 'floatY', 'headPitch', 'legSwing', 'neckPitch', 'tailYaw'],
      'walkPose 恰六键(idle 同形)');
  assert.strictEqual(p0.x, 79, '停驻精确落航点 x');
  assert.strictEqual(p0.z, 94, '停驻精确落航点 z');
  assert.strictEqual(p0.walkPose.armSwing, 0, '停驻零摆臂');
  assert.strictEqual(p0.walkPose.floatY, 0, 'floatY 恒 0(y 通道归 idle)');
  let s = BC.townScheduleStep(schedState('npc:v01', 11000), 12040, 1); /* 起步帧 */
  const w0 = flat(BC.townSchedulePose(s)).walkPose;
  assert.strictEqual(w0.armSwing, 0, '起步臂摆过零(sin(0))');
  s = BC.townScheduleStep(s, 12100, 7); /* t=0.5: swingPhase=0.5×14×0.9×2π=12.6π */
  const p = flat(BC.townSchedulePose(s));
  assert.ok(Math.abs(p.swingPhase - 0.5 * 14 * pTbl().SWING_HZ * 2 * Math.PI) < 1e-9,
      'swingPhase=t·腿秒·SWING_HZ·2π(腿秒=14s, 复用巡逻摆频参数)');
  assert.ok(Math.abs(p.walkPose.armSwing) > 0.4, '腿中段臂摆显著(|≈0.52|)');
  assert.ok(Math.abs(p.walkPose.armSwing) <= pTbl().WALK_ARM_AMP + 1e-9, '臂幅不越上界');
  assert.ok(Math.abs(p.walkPose.legSwing / p.walkPose.armSwing -
      (-pTbl().WALK_LEG_AMP / pTbl().WALK_ARM_AMP)) < 1e-9, '腿臂反号恒比(自然步态)');
  assert.strictEqual(p.walkPose.floatY, 0, '行走 floatY 恒 0');
  assert.strictEqual(p.walkPose.headPitch, 0, 'walkPose 零头俯');
});

test('c2·纯度与 dt 边界: 零突变恒新对象 · dt≤0/非有限回落零步 · 跨段切 dt 序列确定性重放(零墙钟零随机)', () => {
  schedGuard();
  const s = schedState('npc:v01', 11000);
  const before = flat(s);
  BC.townScheduleStep(s, 12100, 5);
  BC.townSchedulePose(s);
  BC.townScheduleLegById(s);
  assert.deepStrictEqual(flat(s), before, '入参状态零突变(-core 纯函数契约)');
  const s2 = BC.townScheduleStep(s, 12100, 5);
  assert.notStrictEqual(s2, s, 'step 恒返回新对象');
  const z = flat(BC.townScheduleStep(s, 12100, 0));
  assert.deepStrictEqual(z, before, 'dt=0 恒等(暂停不喂 dt 即冻结)');
  for (const bad of [-1, NaN, Infinity, -Infinity]) {
    assert.deepStrictEqual(flat(BC.townScheduleStep(s, 12100, bad)), before,
        'dt=' + bad + ' 回落零步(非有限输入零步进, 零炸)');
  }
  /* 确定性: 跨段切序列(起步→行进→到站→停驻)两条独立状态机终态逐字节一致 */
  const seq = [[1, 12040], [7, 12100], [7, 12100], [3, 13500], [1, 13700], [16, 13700]];
  let a = schedState('npc:v01', 11000);
  let b = schedState('npc:v01', 11000);
  for (const [dt, dayTime] of seq) {
    a = BC.townScheduleStep(a, dayTime, dt);
    b = BC.townScheduleStep(b, dayTime, dt);
  }
  assert.deepStrictEqual(flat(a), flat(b), '同(dayTime,dt)序列同终态(确定性重放)');
});

test('c2·节奏断言(段表×锚点表×参数表三方对账): 13 村民 dusk/night/dawn 行程秒 ≤ 段长秒 · day 在岗零行程(数据终版可观察性, 票面 §11.7.0-⑤)', () => {
  schedGuard();
  const SPEED = schedTbl().SPEED_GPT;
  const duskSec = (schedTbl().NIGHT_T - schedTbl().DUSK_T) / 20; /* 1630tick=81.5s */
  const nightSec = (schedTbl().DAWN_T - schedTbl().NIGHT_T) / 20; /* 8660tick=433s */
  const dawnSec = (DAYLIGHT.TICKS - schedTbl().DAWN_T) / 20; /* 1670tick=83.5s */
  assert.strictEqual(duskSec, 81.5, 'dusk 段长 81.5s(20 tick/秒换算锚定)');
  assert.strictEqual(nightSec, 433, 'night 段长 433s(=7.2 分钟)');
  assert.strictEqual(dawnSec, 83.5, 'dawn 段长 83.5s');
  const rowById = Object.fromEntries(TOWN_NPC_ANCHORS.map((r) => [r.id, r]));
  const legLen = (wp, i, j) => Math.abs(wp[j].x - wp[i].x) + Math.abs(wp[j].z - wp[i].z);
  for (const id of Object.keys(plansTbl())) {
    const wp = rowById[id].waypoints;
    const g = plansTbl()[id][1].leg;
    const n = wp.length;
    let duskTrip = 0;
    for (let i = 0; i < g; i++) duskTrip += legLen(wp, i, i + 1); /* 工作位→聚集 全腿 */
    let nightTrip = 0;
    for (let i = g; i < n - 1; i++) nightTrip += legLen(wp, i, i + 1); /* 聚集→家 */
    let dawnTrip = 0;
    for (let i = 0; i < n - 1; i++) dawnTrip += legLen(wp, i, i + 1); /* 家→工作位=全序列逆行 */
    assert.ok(duskTrip * SPEED <= duskSec,
        '「' + id + '」dusk 行程 ' + (duskTrip * SPEED) + 's ≤ 81.5s(傍晚聚集走得到)');
    assert.ok(nightTrip * SPEED <= nightSec,
        '「' + id + '」night 行程 ' + (nightTrip * SPEED) + 's ≤ 433s(夜里到家不熬夜)');
    assert.ok(dawnTrip * SPEED <= dawnSec,
        '「' + id + '」dawn 行程 ' + (dawnTrip * SPEED) + 's ≤ 83.5s(清晨准时到岗)');
  }
});
