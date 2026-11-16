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
  'js/town-npc-anchor-core.js', 'js/adventure-dims-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, {filename: f});
}
Object.assign(globalThis, vm.runInContext(
    '({anchorOf, anchorChanged, TOWN_NPC_ANCHORS, townYawOfFace})', ctx));

/* vm 域产物摊平进宿主域(跨域原型比对必假红, conventions §7.1-1) */
const flat = (o) => JSON.parse(JSON.stringify(o));

/* 红期归因装载: 模块缺席不炸装具(红因=实现缺席非装具炸, T-NPC-05 先例口径) */
let BC = null;
try {
  BC = require('../js/town-npc-behavior-core.js');
} catch (e) { /* 红期: 模块缺席, 各测试首断言归因 */ }
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
const P = () => BC.TOWN_NPC_PATROL;

test('导出面恰五名 + 参数表六键字面锁(PO 后验可调, 改值须连测试过评审)', () => {
  behaviorGuard();
  assert.deepStrictEqual(Object.keys(BC).sort(),
      ['TOWN_NPC_PATROL', 'townPatrolLegById', 'townPatrolPose',
        'townPatrolState', 'townPatrolStep'],
      '导出面恰五名(参数表+状态机四函数, 零杂散零遗漏——interface 即测试面)');
  assert.deepStrictEqual(Object.keys(P()).sort(),
      ['DWELL_T', 'LEG_T', 'SWING_HZ', 'TURN_T', 'WALK_ARM_AMP', 'WALK_LEG_AMP'],
      '参数表恰六键(零杂散零遗漏)');
  assert.deepStrictEqual({LEG_T: P().LEG_T, DWELL_T: P().DWELL_T, TURN_T: P().TURN_T,
    SWING_HZ: P().SWING_HZ, WALK_ARM_AMP: P().WALK_ARM_AMP, WALK_LEG_AMP: P().WALK_LEG_AMP},
  {LEG_T: 26, DWELL_T: 3, TURN_T: 1.2, SWING_HZ: 0.9,
    WALK_ARM_AMP: 0.55, WALK_LEG_AMP: 0.7},
      '参数初值字面锁表(26 格腿≈1 格/秒慢巡逻; 停驻 3s; 过渡 1.2s; 0.9Hz 重步频; ' +
      '摆幅腿>臂——红方裁决初值, 依据 docs/town-villagers-design.md §5.3)');
  for (const k of Object.keys(P())) {
    assert.strictEqual(typeof P()[k], 'number', k + ' 为数值');
    assert.ok(Number.isFinite(P()[k]) && P()[k] > 0, k + ' 为正有限数(物理量)');
  }
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
  for (let i = 0; i < 480; i++) { /* 120s=0.25×480 > 全环 116s(4×(3+26)) */
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
  assert.ok(Math.abs(w.armSwing) <= P().WALK_ARM_AMP + 1e-9, '臂幅不越参数上界');
  assert.ok(Math.abs(w.legSwing) <= P().WALK_LEG_AMP + 1e-9, '腿幅不越参数上界');
  assert.ok(Math.abs(w.legSwing / w.armSwing - (-P().WALK_LEG_AMP / P().WALK_ARM_AMP)) < 1e-9,
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
