'use strict';
/* ============================================================
   小镇漫步 (TownMode, 术语见 GLOSSARY.md「小镇漫步」) — 模式层
   ------------------------------------------------------------
   一句话职责: town 模式装配壳——平铺消费 townAssemblyOps(townBuildSteps())
   逐 op 经 townConsumeOp 落世界(引擎触点唯一面), 锚点段消费出生意图,
   藏住装配序与 op 执行细节; 锚点交互注册与轻任务状态机在本文件建机
   (协议与数据归 town-interact-core.js, T-MAP-04; UI 消费归 T-UI 线)。
   interface: TownMode(mkMode 壳, id='town'; init = loadScene(townBuild)
     → townInteractBoot() → ModeKit.spawn(townSpawnIntent()) → requestLock(U3 点卡直进)) ·
     townConsumeOp(op) 执行器(op 词表封闭 {fill,tree,scrub,recolor,place}
     → 引擎唯一触点面) · townAssemblyPhases(steps) 纯函数(平铺步骤按
     权威 phase 序分组, 只含非空段且组序恒等于权威序, 同段条目保持输入
     相对次序) · townInteractBoot() 注册启动(建交互注册快照与目标机器
      入模式态 townTargets, 事件 emit 缺省空实现) · townSpawnIntent() 纯函数(spawn 锚点 → 站立面 y+1 与
     朝向 yaw) · townYawOfFace(face) 纯函数(四正交 face → yaw, 前向向量
     (-sin,-cos))
   依赖(均经全局名, 调用期解析; index.html 加载序 js/town-map-core.js →
     js/town-assembly-core.js → js/town-interact-core.js → 本文件 →
      main.js, 引擎件皆在前):
     js/town-map-core.js 的 TOWN_MAP/townBuildSteps ·
     js/town-assembly-core.js 的 townAssemblyOps · js/scene-kit.js 的
     SceneKit(fill/tree/scrub 树家族几何) · js/prefab-kit.js 的 PrefabKit
     (place 蓝图落位) · js/voxel.js 的 getBlock/setBlockRaw(recolor 盒内
     置换读写) · js/world.js 的 loadScene · js/mode-kit.js 的 ModeKit ·
     js/input.js 的 requestLock(后三者加载序在后, mkMode init 调用期已
     就绪)
   可测性声明: 顶层纯函数与执行器零 DOM(Node vm 直测, 有同名单测
     test/town-mode.test.js 与 test/town-assembly-core.test.js); 引擎
     触点全部收口在 loadScene/ModeKit.spawn/requestLock/townConsumeOp
     四缝, vm 记录桩或真引擎替身可全链驱动。
   ============================================================ */

/* ---------- 装配 phase 权威全序(§5.1.6 建场次序: 地表→远景→路网→建筑→
   散布→锚点; 锚点必须末段=「先建场后落人」的装配纪律。组序恒等于此序,
   不信输入序) ---------- */
const TOWN_PHASE_ORDER = ['ground', 'backdrop', 'road', 'prefab', 'scatter', 'anchor'];

/* 四正交 face → yaw 朝向协议: 前向向量 = (-sin yaw, -cos yaw)(引擎
   camera-rig lookDir 同式)——north=-Z(北望广场)/south=+Z/east=+X/
   west=-X。未知 face 按错误两档先例抛拼写域错误(布局件契约破坏即炸)。 */
function townYawOfFace(face) {
  switch (face) {
    case 'north': return 0;
    case 'south': return Math.PI;
    case 'west': return Math.PI / 2;
    case 'east': return -Math.PI / 2;
    default:
      throw new Error('townYawOfFace: 未知 face「' + face + '」(合法域 north|south|east|west)');
  }
}

/* 出生意图: 读 TOWN_MAP.anchors 里 id==='spawn' 的唯一锚(南主路上, 面北)
   → 站立面(锚点 y+1, tank-range groundY+1 先例)与朝向(yaw 由 face 派生,
   面北望广场/回望钟塔走廊)。出生意图单点, anchor 段消费它。 */
function townSpawnIntent() {
  const a = TOWN_MAP.anchors.find((anchor) => anchor.id === 'spawn');
  if (!a) throw new Error('townSpawnIntent: TOWN_MAP.anchors 缺 spawn 锚(布局件契约破坏)');
  return {x: a.x, y: a.y + 1, z: a.z, yaw: townYawOfFace(a.face)};
}

/* 平铺步骤按权威 phase 序分组: 组序恒=权威序(不信输入序)、只保留非空段
   (可空段不炸)、同段条目保持输入相对次序(无重排); 纯派生零副作用——
   filter 产新数组, 不改 steps。空表 → []。 */
function townAssemblyPhases(steps) {
  const groups = [];
  for (const phase of TOWN_PHASE_ORDER) {
    const seg = steps.filter((s) => s.phase === phase);
    if (seg.length > 0) groups.push({phase, steps: seg});
  }
  return groups;
}

/* op 执行器: 规划器 op → 引擎触点唯一面(本模式的全部世界写入只此一处)。
   词表封闭 {fill,tree,scrub,recolor,place}: fill→SceneKit.fill 长方体 ·
   tree→SceneKit.tree 圆冠树(干基=散布点 y+1, 立在地面) · scrub→
   SceneKit.scrub 矮丛(top=脚下表面格, 盐定形同参同丛) · recolor→盒内
   from→to 逐格置换(樱花覆写落调用方, 地图设计 §5.4; 只动命中格, 干与
   立地天然不涉) · place→PrefabKit.place(face/ids 已由规划器注入 v,
   材质集中映射单源)。未知 op 抛拼写域错误(错误两档先例)。 */
function townConsumeOp(op) {
  switch (op.op) {
    case 'fill':
      SceneKit.fill(op.x1, op.y1, op.z1, op.x2, op.y2, op.z2, op.id);
      break;
    case 'tree':
      SceneKit.tree(op.x, op.y + 1, op.z);
      break;
    case 'scrub':
      SceneKit.scrub(op.x, op.top, op.z, op.salt);
      break;
    case 'recolor':
      for (let x = op.x1; x <= op.x2; x++) {
        for (let y = op.y1; y <= op.y2; y++) {
          for (let z = op.z1; z <= op.z2; z++) {
            if (getBlock(x, y, z) === op.from) setBlockRaw(x, y, z, op.to);
          }
        }
      }
      break;
    case 'place':
      PrefabKit.place(op.id, op.x, op.y, op.z, op.v);
      break;
    default:
      throw new Error('townConsumeOp: 未知 op「' + op.op +
        '」(合法域 fill|tree|scrub|recolor|place)');
  }
}

/* 建场: 平铺消费规划器 op 序列逐 op 执行(规划器内部已按 §5.1.6 建场次序
   产出——基底三层垫底是后写者赢的显式见证, 之后远景/路网/建筑/散布依
   steps 相对次序), 世界写入只经 townConsumeOp 一面; 锚点段规划为零 op,
   出生在此收口(§5.1.6 末段纪律: 先建场后落人, 恰一次)。 */
function townBuild() {
  for (const op of townAssemblyOps(townBuildSteps())) {
    townConsumeOp(op);
  }
  const it = townSpawnIntent();
  ModeKit.spawn(it.x, it.y, it.z, {yaw: it.yaw});
}

/* ---------- 交互锚点注册(T-MAP-04): 模式运行态 seam(T-UI 线消费) ----------
   townTargets 持交互注册快照与目标状态机, init 期 townInteractBoot 建机
   (每次进场新机, 不串轮); 本票无 UI 消费端, 事件 emit 用空实现旁路
   (T-UI 票只换 emit 实现, 不改机器)。boot 是纯核心动作, 不触引擎缝。 */
let townTargets; /* 模式运行态: 进场建机, T-UI 线经此查目标与焦点状态 */

/* 注册启动: 建交互机器(构造期即跑注册校验, 坏清单即抛)写入模式态;
   注册核心不在装载序时跳过(引擎替身沙盒最小装载容差, 与装具对
   assembly-core 的 existsSync 容缺席同款); 交互锚点/轻任务的目标 id、
   图标语义键与坐标全部源自注册核心, 本函数不自定任何数据。 */
function townInteractBoot() {
  if (typeof mkTownTargets === 'undefined') return;
  townTargets = mkTownTargets({emit: () => {}});
}

/* ---------- 模式壳: 骨架薄壳(无自有资源, mkMode 缺省 chrome/score 即可) ----------
   init 全链顺序钉死: ① loadScene(townBuild) 装配(内含 anchor 段出生——
   §5.1.6 锚点末段纪律, 先建场后落人) → ② townInteractBoot()(交互注册
   启动, 纯核心建机不触引擎缝) → ③ requestLock(U3 点卡直进:
   请求指针锁/触屏进行中, 无出发页无二次确认)。hud/hotbar/cleanup/
   update/onKey 骨架期不需要就不写(HUD 归 T-UI-01)。 */
const TownMode = mkMode({
  id: 'town',

  init() {
    loadScene(townBuild); /* 场景装填 seam: 清场→建场→收尾重建一步到位(装配在先) */
    townInteractBoot(); /* 交互锚点注册启动(T-MAP-04; 纯核心建机, 不触引擎缝) */
    requestLock(); /* U3 直进(出生在 loadScene 内 anchor 段, 已然其后) */
  },
});
