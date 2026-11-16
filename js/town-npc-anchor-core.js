'use strict';
/* ============================================================
   城镇 NPC 站位锚点纯核心 (TownNpcAnchorCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: 14 实体(V01~V10/G01/A01~A03)站位与巡逻/日程锚点的唯一权威——
   一份确定性纯数据航点表外加纯取数器与快照比较谓词, 藏住全部站位坐标拍板; 锚点
   只在到站(legIndex 变化)时跳变, 不随移动插值。
   interface: 全局 TOWN_NPC_ANCHORS(14 行纯数据, 每行恰四键 {id, npcId,
      waypoints, note}; id = 'npc:' + npcId 小写, 镜像 task: 先例, 与
      TOWN_MAP.anchors 导览锚 id 空间零碰撞; G01 巡逻环=四航点轴对齐闭环,
      13 村民锚=日程航点序列 2~5 点(工作位→[途经拐点]→聚集点→家, c2 数据
      终版票面 §11.7.0-①; 首航点=工作位=TOWN_MAP.anchors 布局行恒不动);
      航点恰四键 {x,y,z,face}, face ∈ 上/北/南/东/西 五值朝向词表, y 恒=
      groundY 贴地) · 纯函数 anchorOf(id, legIndex) → {x,y,z,face} 快照
      拷贝: 村民日程锚=航点序列线性取数 waypoints[leg](缺省视作 0, 越界
      两端钳制——线性序列非环, 末段绕回会「家绕回工作位」错位, 钳制保
      夜间恒在家语义); G01 巡逻锚返 waypoints[归一取模](负数归一到末腿);
      未知 id 抛拼写域错(消息含该 id 与「未知」, 镜像 mkTownTargets.focus
      口径); 每次返回新对象, 外部改写不反渗数据表。
      · 纯函数 anchorChanged(prev, next) → boolean(T-NPC-12 重发判定
      谓词: 快照恰四键 {x,y,z,face} 逐键 !== 比较, 任一异即真; 任一侧
      非对象保守判真——宁重发不漏发)。
   依赖: 零运行时依赖——本文件不引用任何引擎件/件库符号(纯站位计划;
      站位合法性由测试侧以 TOWN_MAP/PrefabKit.footOf 校验, 对齐与避让
      约束(不压脚印/避散布/避导览锚/巡逻可走/语义窗口)全在测试侧锁死,
      镜像 town-map-core 先例; 布局常量对齐 docs/town-map-design.md
      §3-§4 与 docs/town-villagers-design.md §5; 本表独立成件不并入
      TOWN_MAP.anchors, 升格会师归 T-NPC-10)。
   可测性声明: 零三维渲染库 · 零 DOM · 零墙钟 · 零随机 · 有同名单测
      (test/town-npc-anchor-core.test.js, 24 test 可执行规格)。
   ============================================================ */

/* ---------- 站位锚点数据表(14 行纯数据): 坐标拍板死在数据表; note 注
    场景语义(票文 §3.3 对齐依据)。c2 日程扩列(T-NPC-13, 票面 §11.7.0-①
    数据终版=红方探针验证器全过): 13 村民行 waypoints 扩日程航点序列
    (工作位 w→[途经拐点 t]→聚集点 g→家 h; w=SEM 工作朝向面原语义,
    g=面钟塔主轴, h=面镇心 north, t=无驻留途经拐点 face=行进轴)——
    首航点(工作位)x/y/z/face 逐行不动=TOWN_MAP.anchors 布局行零漂移;
    行进朝向不读 face(几何派生归行为层, face 双语义拆分 §11.7.0-②)。
    G01 行零触碰。 ---------- */
const TOWN_NPC_ANCHORS = [
  /* v01: 日程 w→g→h(票面 §11.7.0-①: dusk 14s/night 16s/dawn 30s) */
  {id: 'npc:v01', npcId: 'V01',
    waypoints: [{x: 79, y: 24, z: 94, face: 'south'},
      {x: 79, y: 24, z: 80, face: 'north'}, {x: 79, y: 24, z: 96, face: 'north'}],
    note: '广场南入口迎客, main-south 路端面南对 spawn 来向; 日程: 傍晚钟塔旁聚集·夜间归南带村舍'},
  /* v02: 票文建议(70,57)距 farm 导览锚(71,58)切比 1 <2, 西移 1 格。
      日程 w→t→t→g→h(19s/17s/36s, 票面 §11.7.0-①); 途经拐点 z=65 行——
      约束赢微调: 票面探针值 (69,66)→(73,66) 的 (73,66) 距 signpost-plaza
      (73,67) 切比 1 违既有避散布≥2(拐点不在探针约束清单, 既有测试对全部
      航点执法), 拐轴南移 1 行绕散布点(z=66 行撞摊棚足印 z[67,69] 北缘),
      总路程 19 格=票面秒数不变。 */
  {id: 'npc:v02', npcId: 'V02',
    waypoints: [{x: 69, y: 24, z: 57, face: 'north'},
      {x: 69, y: 24, z: 65, face: 'south'}, {x: 73, y: 24, z: 65, face: 'east'},
      {x: 73, y: 24, z: 72, face: 'east'}, {x: 56, y: 24, z: 72, face: 'north'}],
    note: '农田查看, farm-a 南缘面田; 日程: 傍晚钟塔东南聚集·夜间归西生活带民居街'},
  {id: 'npc:v03', npcId: 'V03',
    waypoints: [{x: 91, y: 24, z: 85, face: 'west'},
      {x: 68, y: 24, z: 85, face: 'east'}, {x: 56, y: 24, z: 85, face: 'north'}],
    note: '广场修缮点, 广场东缘面西; 日程: 傍晚广场西缘聚集·夜间归西生活带民居街'},
  {id: 'npc:v04', npcId: 'V04',
    waypoints: [{x: 76, y: 24, z: 69, face: 'north'},
      {x: 74, y: 24, z: 69, face: 'south'}, {x: 74, y: 24, z: 96, face: 'north'}],
    note: '钟塔旁告示架边, signpost-plaza 侧钟塔足印外; 日程: 傍晚原地近聚·夜间归南带村舍'},
  {id: 'npc:v05', npcId: 'V05',
    waypoints: [{x: 90, y: 24, z: 68, face: 'south'},
      {x: 90, y: 24, z: 71, face: 'west'}, {x: 88, y: 24, z: 71, face: 'east'},
      {x: 88, y: 24, z: 96, face: 'north'}],
    note: '铁匠角(暂无熔炉承载建筑, 待建筑侧增量), 广场东北角; 日程: 傍晚广场东北聚集·夜间归南带村舍'},
  {id: 'npc:v06', npcId: 'V06',
    waypoints: [{x: 87, y: 24, z: 76, face: 'east'},
      {x: 87, y: 24, z: 80, face: 'west'}, {x: 87, y: 24, z: 94, face: 'north'}],
    note: '花摊旁, flower 摊西邻面摊; 日程: 傍晚广场南缘聚集·夜间归南带村舍'},
  /* v07: 票文建议(106,80)压 shop-awning 实际足印 x[106,114]z[74,83] 且距
      lava-chicken 锚切比 1 <2, 西移 3 格。 */
  {id: 'npc:v07', npcId: 'V07',
    waypoints: [{x: 103, y: 24, z: 79, face: 'west'},
      {x: 68, y: 24, z: 79, face: 'east'}, {x: 56, y: 24, z: 79, face: 'north'}],
    note: 'Lava Chicken 门前, 锚旁面西对店; 日程: 傍晚广场西缘聚集·夜间归西生活带民居街'},
  /* v08: 票文建议(76,78)在钟塔实际足印 x[77,82]z[70,75] 西侧, 违「足印外
      东侧」语义窗口, 移足印外东侧邻位。 */
  {id: 'npc:v08', npcId: 'V08',
    waypoints: [{x: 83, y: 24, z: 76, face: 'east'},
      {x: 76, y: 24, z: 76, face: 'east'}, {x: 76, y: 24, z: 96, face: 'north'}],
    note: '钟塔值守, 钟塔足印外东侧; 日程: 傍晚钟塔南聚集·夜间归南带村舍'},
  {id: 'npc:v09', npcId: 'V09',
    waypoints: [{x: 83, y: 24, z: 59, face: 'north'},
      {x: 83, y: 24, z: 78, face: 'west'}, {x: 34, y: 24, z: 78, face: 'north'}],
    note: '围栏边照看, farm-b 南缘面田; 日程: 傍晚钟塔西聚集·夜间归西生活带深处'},
  {id: 'npc:v10', npcId: 'V10',
    waypoints: [{x: 84, y: 24, z: 86, face: 'south'},
      {x: 78, y: 24, z: 86, face: 'north'}, {x: 64, y: 24, z: 86, face: 'north'}],
    note: '广场空地玩耍, 广场东南留白; 日程: 傍晚广场中聚集·夜间归西生活带民居街'},
  /* G01: 票文建议环(70,70)-(90,70)-(90,90)-(70,90) 北段 z70 穿钟塔实际
      足印 z[70,75], 改贴广场缘四角环(face 沿走方向)。c2 零触碰。 */
  {id: 'npc:g01', npcId: 'G01',
    waypoints: [{x: 66, y: 24, z: 66, face: 'east'}, {x: 92, y: 24, z: 66, face: 'south'},
      {x: 92, y: 24, z: 92, face: 'west'}, {x: 66, y: 24, z: 92, face: 'north'}],
    note: '广场巡逻环, 贴缘四角沿走方向闭环慢巡逻; 日程化到站语义归行为层'},
  {id: 'npc:a01', npcId: 'A01',
    waypoints: [{x: 72, y: 24, z: 60, face: 'south'},
      {x: 72, y: 24, z: 70, face: 'east'}, {x: 48, y: 24, z: 70, face: 'north'}],
    note: '农田边踱步, farm-a 南侧路缘; 日程: 傍晚钟塔西南聚集·夜间归西生活带'},
  {id: 'npc:a02', npcId: 'A02',
    waypoints: [{x: 45, y: 24, z: 76, face: 'north'},
      {x: 70, y: 24, z: 76, face: 'east'}, {x: 56, y: 24, z: 76, face: 'north'}],
    note: '民居门口晒太阳, cottage-gable 南侧门前面门; 日程: 傍晚广场西缘聚集·夜间归西生活带民居街'},
  /* a03: 日程 w→t→t→g→h(15s/14s/29s, 票面 §11.7.0-①); 首个途经拐点
      (76,92)→(75,92)——约束赢微调: 票面探针值 (76,92) 恰在 V08 聚集→家
      段(x=76 列 z76~96)格点上=互穿观感守门红(拐点不在探针约束清单),
      西移 1 格出列, 总路程 15 格=票面秒数不变。 */
  {id: 'npc:a03', npcId: 'A03',
    waypoints: [{x: 73, y: 24, z: 92, face: 'south'},
      {x: 75, y: 24, z: 92, face: 'east'}, {x: 80, y: 24, z: 92, face: 'east'},
      {x: 80, y: 24, z: 84, face: 'north'}, {x: 80, y: 24, z: 98, face: 'north'}],
    note: '货摊旁, fruit 摊东北邻; 日程: 傍晚广场东南聚集·夜间归南带村舍'},
];

/* ---------- 纯取数器: 村民日程锚=航点序列线性取数 waypoints[leg](缺省
    视作 0, 越界两端钳制——线性序列非环, 取模会「末段绕回首段」把夜间
    在家读成回工作位错位, 钳制=日程终点语义; n=1 旧数据上钳制与取模退化
    重合); G01 巡逻锚=闭环取模归一(缺省视作 0, 负数归一到末腿)——不
    做时间推进, 消费与重发节奏归装配层(T-NPC-12 消费机/T-NPC-13 推进
    机), legIndex 由装配层注入; 返回快照拷贝, 外部改写不反渗数据表。 ---- */
function anchorOf(id, legIndex) {
  const row = TOWN_NPC_ANCHORS.find((r) => r.id === id);
  if (!row) {
    throw new Error('anchorOf: 未知锚 id「' + id + '」(须在站位锚注册集内)');
  }
  const n = row.waypoints.length;
  let leg;
  if (n === 1) {
    leg = 0; /* 单航点(日程机未扩形的防御位)恒首航点 */
  } else if (row.npcId === 'G01') {
    leg = (((legIndex || 0) % n) + n) % n; /* 巡逻环: 归一取模(闭环) */
  } else {
    leg = Math.min(Math.max(legIndex | 0, 0), n - 1); /* 日程锚: 线性两端钳制 */
  }
  const w = row.waypoints[leg];
  return {x: w.x, y: w.y, z: w.z, face: w.face};
}

/* ---------- 重发判定纯谓词(T-NPC-12, README §3.3 裁决三) ----------
   快照比较: 航点身份=四键 {x,y,z,face} 逐键 !== 全等, 任一键跳变即真
   (到站跳变的判定数据基础); 缺键按键级比较(undefined ≠ 有值); 任一侧
   非对象(缺席/非快照)保守判真——宁重发不漏发, 防脏账本静默吞事件。
   零时间推进纪律同 ⑮(纯比较无墙钟), 消费与重发节奏归装配层
   (advTownAnchorTick); 同参取数幂等即零重发的数据基础。 ---------- */
function anchorChanged(prev, next) {
  if (typeof prev !== 'object' || prev === null ||
      typeof next !== 'object' || next === null) return true;
  return prev.x !== next.x || prev.y !== next.y ||
      prev.z !== next.z || prev.face !== next.face;
}
