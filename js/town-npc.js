'use strict';
/* ============================================================
   城镇 NPC 渲染适配件 (TownNpc) — 应用层·无后缀 adapter(THREE/DOM 允许,
   conventions §1.2)
   ------------------------------------------------------------
   一句话职责: 把注册表条目与造型档案装配成可摆放的渲染傀儡——
   mkTownNpcPuppet(id) 出傀儡加头顶锚高度, placeTownNpc(puppet, anchor)
   出站位快照; 藏住「注册表→kit 傀儡→站位」装配链, 调用方只给 id 与锚点;
   另出待机微动画六纯面(案卷③ idle 段: 形态映射/相位错峰/姿势/头转目标/
   头转限步/姿势消费, 「站得太死」对症)。
   face→yaw 单源: placeTownNpc 消费维度段权威 townYawOfFace
   (js/adventure-dims-core.js, T-NPC-10 会师消名), 本文件不再自带映射。
   interface: mkTownNpcPuppet(id, opts?) → 恰四键 {root, bones, look,
     anchorHeight}(root/bones 系 MobLookKit.puppet(key) 产物透传不改名,
     look=注册表 key, anchorHeight 格: V 系 2.0/G01 2.7 票面权威字面,
     动物随几何=声明盒顶字面登记; 显隐预留只透传 bones 不预造 API) ·
     placeTownNpc(puppet, anchor) → 恰四键纯快照 {x, y, z, yaw}(站立面
     y+1, townSpawnIntent 先例), root.position 置 (x, y+1, z), 入参零
     突变, 不触场景/模式态) · 待机微动画六纯面(案卷③, 全零墙钟零随机,
     dt/参数注入式): townNpcIdleKindOf(look)→形态 kind(humanoid|bird|cat|
     llama, 未知 look 抛中文域错) · townNpcIdlePhaseOffset(id)→确定性
     [0,1) 相位错峰(FNV-1a) · townNpcIdlePose(t, kind, params?)→恰六键
     {floatY,armSwing,legSwing,headPitch,tailYaw,neckPitch}(全 sin 驱动,
     形态通道见下方【动物形态表】) · townNpcIdleHeadTarget(bodyYaw,x,z,
     px,pz,params?)→恰二键 {yaw,engaged}(注视距离门+角域钳) ·
     townNpcIdleHeadStep(cur,target,dt,params?)(±π 回绕最短方向限步+钳) ·
     townNpcIdleApply(puppet,kind,pose,baseY,headYaw)(骨骼旋转+根浮恒幂等,
     缺骨跳过, 骨 position 恒零触, 未知 kind 抛中文域错)。
   依赖(均经全局名, 调用期解析): MobLookKit(js/mob-look-kit.js 引擎层,
     puppet(key) 既有傀儡路径) · TOWN_NPCS(js/town-npc-registry.js
     id→key 唯一权威) · townYawOfFace(js/adventure-dims-core.js 权威,
     前向向量口径同源) · TOWN_UI_PARAMS(js/town-ui-core.js 冻结参数表,
     idle 段调用期 typeof 懒解析——本文件装载序先于 town-ui-core.js,
     顶层取必炸) · THREE/document 惰性(只经 kit 傀儡期触达, 本文件
     顶层零触); 加载序 town-map-core → adventure-dims-core(顶层消费
     TOWN_MAP, 须后于 map-core)→ mob-look-kit → mob-look/town_* →
     town-interact-core → town-npc-anchor-core → town-npc-registry →
     本文件; index.html 挂载链已按此序落(T-NPC-10)。
   可测性声明: THREE/DOM 惰性创建, Node 测试可安全加载(装载零副作用,
     裸沙盒可装载); 有同名单测(test/town-npc.test.js, THREE 桩直测)。
   ============================================================ */

/* ---------- 头顶锚高度(格, 话 UI World Bubble 挂点): V 系 2.0(含裙摆
    视觉口径)/G01 2.7 为票面权威(与几何推导口径并存是既定裁定, 勿
    「修正」); 动物随几何=look 声明盒顶字面登记(A01 冠 13.75+1 ·
    A02 耳 12.75+2 · A03 耳 26.5+1 px, 1px=1/16 格; 三只动物声明盒无
    inflate/旋转, 顶=盒顶)。字面系等价途径登记(测试以独立推导字面
    对账), 声明几何改动时须同步本表。 ---------- */
const TOWN_NPC_ANCHOR_HEIGHTS = {
  V01: 2.0, V02: 2.0, V03: 2.0, V04: 2.0, V05: 2.0,
  V06: 2.0, V07: 2.0, V08: 2.0, V09: 2.0, V10: 2.0,
  G01: 2.7,
  A01: 14.75 / 16, A02: 14.75 / 16, A03: 27.5 / 16,
};

/* ---------- 傀儡工厂: id→key 按注册表行查(未知 id 抛拼写域错, 消息含
    该 id 与合法域提示), 走 MobLookKit.puppet 既有傀儡路径(逐骨
    Group+Mesh, −Z 原生, 材质 NearestFilter), 产物恰四键——root/bones
    透传(显隐预留只给 bones, G01 flower 花盒骨已在册, 不预造
    show/hide), look=key 供回查注册表, anchorHeight 见上(锚高表与
    注册表 id 域对齐, 漏登记即炸防静默); opts 本票无语义(签名预留,
    供后续票注入式扩展)。 ---------- */
function mkTownNpcPuppet(id, opts) {
  const row = TOWN_NPCS.find((e) => e.id === id);
  if (!row) {
    throw new Error('mkTownNpcPuppet: 未知 id「' + id +
      '」(合法域 V01~V10|G01|A01~A03, 见 TOWN_NPCS 注册表)');
  }
  const puppet = MobLookKit.puppet(row.key);
  const anchorHeight = TOWN_NPC_ANCHOR_HEIGHTS[id];
  if (anchorHeight === undefined) {
    throw new Error('mkTownNpcPuppet: id「' + id +
      '」无锚高登记(须在 TOWN_NPC_ANCHOR_HEIGHTS 表内)');
  }
  return {root: puppet.root, bones: puppet.bones, look: row.key, anchorHeight};
}

/* ---------- 站位纯装配: 返回恰四键快照(站立面 y+1, townSpawnIntent
    先例), root.position 同步置 (x, y+1, z); 入参 anchor 只读零突变,
    不触场景/模式态。 ---------- */
function placeTownNpc(puppet, anchor) {
  const x = anchor.x;
  const y = anchor.y + 1;
  const z = anchor.z;
  puppet.root.position.set(x, y, z);
  return {x, y, z, yaw: townYawOfFace(anchor.face)};
}

/* ---------- 待机微动画·参数解析(案卷③ idle 段私有助手): params 注入优先
    (禁硬编码字面), 缺省懒解析全局 TOWN_UI_PARAMS——本文件装载序先于
    town-ui-core.js(index.html 394 行 vs 402 行), 顶层取必炸, 故调用期
    typeof 解析; 表缺席抛中文错不静默。 ---------- */
function townNpcIdleParams(params) {
  if (params) return params;
  if (typeof TOWN_UI_PARAMS === 'undefined') {
    throw new Error('townNpcIdleParams: 参数表缺席(TOWN_UI_PARAMS 未装载,' +
      ' 须先载 js/town-ui-core.js 或注入 params)');
  }
  return TOWN_UI_PARAMS;
}

/* ---------- 待机微动画·形态映射(【动物形态表】单源): look→kind 纯查表,
    V01~V10 村民与 G01 铁傀儡同 humanoid 骨架, A01 鸟/A02 猫/A03 羊驼各按
    形态动不同的骨; 未知 look 抛中文域错(消息含面名与合法域提示)。 ---------- */
const TOWN_NPC_IDLE_KINDS = Object.freeze({
  town_v01: 'humanoid', town_v02: 'humanoid', town_v03: 'humanoid',
  town_v04: 'humanoid', town_v05: 'humanoid', town_v06: 'humanoid',
  town_v07: 'humanoid', town_v08: 'humanoid', town_v09: 'humanoid',
  town_v10: 'humanoid', town_g01: 'humanoid',
  town_a01: 'bird', town_a02: 'cat', town_a03: 'llama',
});
function townNpcIdleKindOf(look) {
  const kind = TOWN_NPC_IDLE_KINDS[look];
  if (!kind) {
    throw new Error('townNpcIdleKindOf: 未知 look「' + look +
      '」(合法域 town_v01~town_v10|town_g01|town_a01~town_a03)');
  }
  return kind;
}

/* ---------- 待机微动画·逐 id 相位错峰: 任意字符串→确定性 [0,1)
    (FNV-1a 32 位哈希 ÷ 2^32)——同 id 同值, 14 实体不齐步走; 零随机零
    墙钟, 未知 id 不炸(哈希域全串)。 ---------- */
function townNpcIdlePhaseOffset(id) {
  let h = 0x811c9dc5; /* FNV-1a 偏移基 2166136261 */
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193); /* FNV 素数 16777619, imul 保 32 位卷绕 */
  }
  return (h >>> 0) / 4294967296;
}

/* ---------- 待机微动画·姿势纯函数: t(秒, 注入相位)×kind → 恰六键
    {floatY, armSwing, legSwing, headPitch, tailYaw, neckPitch}, 全 sin
    驱动 2π·t/周期, 同参同输出(零墙钟零随机), t=0 全零(零残留)。形态通道
    (【动物形态表】): humanoid 呼吸微浮+臂摆+腿反相半幅(IDLE_LEG_RATIO);
    bird 呼吸浮+啄地点头+尾摆(无臂腿); cat 尾慢摆+头微点(坐姿零浮);
    llama 颈俯啄草+头随颈按 IDLE_LLAMA_HEAD_RATIO 比例(零浮无尾)。
    未知 kind 抛中文域错。 ---------- */
function townNpcIdlePose(t, kind, params) {
  const p = townNpcIdleParams(params);
  if (kind === 'humanoid') {
    return {
      floatY: p.IDLE_BREATH_AMP * Math.sin(2 * Math.PI * t / p.IDLE_BREATH_S),
      armSwing: p.IDLE_SWING_AMP * Math.sin(2 * Math.PI * t / p.IDLE_SWING_S),
      legSwing: -p.IDLE_SWING_AMP * p.IDLE_LEG_RATIO *
          Math.sin(2 * Math.PI * t / p.IDLE_SWING_S),
      headPitch: 0, tailYaw: 0, neckPitch: 0,
    };
  }
  if (kind === 'bird') {
    return {
      floatY: p.IDLE_BREATH_AMP * Math.sin(2 * Math.PI * t / p.IDLE_BREATH_S),
      armSwing: 0, legSwing: 0,
      headPitch: p.IDLE_BIRD_PECK_AMP *
          Math.sin(2 * Math.PI * t / p.IDLE_BIRD_PECK_S),
      tailYaw: p.IDLE_BIRD_TAIL_AMP *
          Math.sin(2 * Math.PI * t / p.IDLE_BIRD_TAIL_S),
      neckPitch: 0,
    };
  }
  if (kind === 'cat') {
    return {
      floatY: 0, armSwing: 0, legSwing: 0,
      headPitch: p.IDLE_CAT_NOD_AMP *
          Math.sin(2 * Math.PI * t / p.IDLE_CAT_NOD_S),
      tailYaw: p.IDLE_CAT_TAIL_AMP *
          Math.sin(2 * Math.PI * t / p.IDLE_CAT_TAIL_S),
      neckPitch: 0,
    };
  }
  if (kind === 'llama') {
    const graze = Math.sin(2 * Math.PI * t / p.IDLE_LLAMA_GRAZE_S);
    return {
      floatY: 0, armSwing: 0, legSwing: 0,
      headPitch: p.IDLE_LLAMA_GRAZE_AMP * p.IDLE_LLAMA_HEAD_RATIO * graze,
      tailYaw: 0,
      neckPitch: p.IDLE_LLAMA_GRAZE_AMP * graze,
    };
  }
  throw new Error('townNpcIdlePose: 未知形态「' + kind +
    '」(合法域 humanoid|bird|cat|llama)');
}

/* ---------- 待机微动画·头转目标(纯面): 玩家水平位 (px,pz) 对照傀儡
    (bodyYaw, x, z) → 恰二键 {yaw, engaged}。注视距离门: 水平距离
    hypot(px−x, pz−z) > IDLE_GAZE_DIST 即界外 {yaw: 0, engaged: false}
    (太远不扭头, 回正交给 headStep 目标 0); 界内目标偏航 yaw_t=
    atan2(−(px−x), −(pz−z))(前向向量口径 (−sin,·,−cos), 与 townYawOfFace
    同源), 相对角 rel=回绕±π(yaw_t−bodyYaw), 输出钳 ±IDLE_HEAD_YAW_MAX
    (身后目标最多转到界, 不拧脖子)。 ---------- */
function townNpcIdleHeadTarget(bodyYaw, x, z, px, pz, params) {
  const p = townNpcIdleParams(params);
  const dist = Math.hypot(px - x, pz - z);
  if (dist > p.IDLE_GAZE_DIST) return {yaw: 0, engaged: false};
  const yawT = Math.atan2(-(px - x), -(pz - z));
  const rel = Math.atan2(Math.sin(yawT - bodyYaw), Math.cos(yawT - bodyYaw));
  const max = p.IDLE_HEAD_YAW_MAX;
  return {yaw: Math.max(-max, Math.min(max, rel)), engaged: true};
}

/* ---------- 待机微动画·头转限步(headTarget 目标→本帧头偏): delta=
    回绕±π(target−cur) 取最短方向, 单步限 |IDLE_HEAD_RATE·dt|(大步一步
    直达), 结果再钳 ±IDLE_HEAD_YAW_MAX——单调收敛到目标且永不出角域。 ---------- */
function townNpcIdleHeadStep(cur, target, dt, params) {
  const p = townNpcIdleParams(params);
  const delta = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  const step = Math.max(-p.IDLE_HEAD_RATE * dt,
      Math.min(p.IDLE_HEAD_RATE * dt, delta));
  const max = p.IDLE_HEAD_YAW_MAX;
  return Math.max(-max, Math.min(max, cur + step));
}

/* ---------- 待机微动画·姿势消费(适配面): pose 六键+baseY+headYaw →
    傀儡骨骼旋转与根浮, 恒幂等(每帧全量写, 零转姿势+headYaw=0 即复位)。
    root.position.y=baseY+pose.floatY(一切 kind); 逐 kind 按【动物形态表】
    动骨: humanoid armL/armR·legL/legR 反相摆+head.rotation.y=headYaw
    (rotation.x 恒 0) · bird head 俯仰+tail 摆(head.rotation.y 恒 0) ·
    cat tail 摆+head 微点 · llama neck 俯+head 随。缺骨跳过(不炸不造骨);
    骨 position 恒零触(只写 rotation 与 root.position.y; G01 flower/hip
    等恒零骨不在写集=零触碰红线)。未知 kind 抛中文域错。 ---------- */
function townNpcIdleApply(puppet, kind, pose, baseY, headYaw) {
  const bones = puppet.bones || {};
  if (puppet.root && puppet.root.position) {
    puppet.root.position.y = baseY + pose.floatY;
  }
  const head = bones.head;
  if (kind === 'humanoid') {
    if (bones.armL) bones.armL.rotation.x = pose.armSwing;
    if (bones.armR) bones.armR.rotation.x = -pose.armSwing;
    if (bones.legL) bones.legL.rotation.x = pose.legSwing;
    if (bones.legR) bones.legR.rotation.x = -pose.legSwing;
    if (head) {
      head.rotation.y = headYaw;
      head.rotation.x = 0;
    }
    return;
  }
  if (kind === 'bird') {
    if (bones.tail) bones.tail.rotation.y = pose.tailYaw;
    if (head) {
      head.rotation.x = pose.headPitch;
      head.rotation.y = 0;
    }
    return;
  }
  if (kind === 'cat') {
    if (bones.tail) bones.tail.rotation.y = pose.tailYaw;
    if (head) {
      head.rotation.x = pose.headPitch;
      head.rotation.y = 0;
    }
    return;
  }
  if (kind === 'llama') {
    if (bones.neck) bones.neck.rotation.x = pose.neckPitch;
    if (head) {
      head.rotation.x = pose.headPitch;
      head.rotation.y = 0;
    }
    return;
  }
  throw new Error('townNpcIdleApply: 未知形态「' + kind +
    '」(合法域 humanoid|bird|cat|llama)');
}

/* ---------- CommonJS 导出守卫(town-npc-registry.js 同款): 浏览器经典
    脚本共享词法环境, 顶层声明即全局, 供消费方直接引用; Node 下仅测试
    消费, 挂 module.exports。 ---------- */
const TownNpc = {mkTownNpcPuppet, placeTownNpc, townNpcIdleKindOf,
  townNpcIdlePhaseOffset, townNpcIdlePose, townNpcIdleHeadTarget,
  townNpcIdleHeadStep, townNpcIdleApply};
if (typeof module !== 'undefined' && module.exports) module.exports = TownNpc;
