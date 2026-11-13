'use strict';
/* ============================================================
   小镇漫步 (TownMode, 术语见 GLOSSARY.md「小镇漫步」) — 模式层
   ------------------------------------------------------------
   一句话职责: town 模式骨架壳——按建场 phase 全序驱动 townBuildSteps()
   平铺步骤消费 TownMapCore 的布局计划(锚点段消费出生意图), 藏住装配
   分段与出生派生; 实拼几何归 T-MAP-03、锚点交互归 T-MAP-04。
   interface: TownMode(mkMode 壳, id='town'; init = loadScene(townBuild)
     → ModeKit.spawn(townSpawnIntent()) → requestLock(U3 点卡直进)) ·
     townAssemblyPhases(steps) 纯函数(平铺步骤按权威 phase 序分组, 只含
     非空段且组序恒等于权威序, 同段条目保持输入相对次序) ·
     townSpawnIntent() 纯函数(spawn 锚点 → 站立面 y+1 与朝向 yaw) ·
     townYawOfFace(face) 纯函数(四正交 face → yaw, 前向向量 (-sin,-cos))
   依赖(均经全局名, 调用期解析; index.html 加载序 js/town-map-core.js →
     本文件 → main.js): js/town-map-core.js 的 TOWN_MAP/townBuildSteps ·
     js/world.js 的 loadScene · js/mode-kit.js 的 ModeKit · js/input.js 的
     requestLock(后三者加载序在后, mkMode init 调用期已就绪)
   可测性声明: 顶层三纯函数零 THREE 零 DOM(Node vm 直测, 有同名单测
     test/town-mode.test.js); 模式壳对引擎的全部触点即 loadScene/
     ModeKit.spawn/requestLock 三缝, vm 记录桩替身可全链驱动。
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

/* 建场: 按 phase 全序分段驱动 townBuildSteps() 平铺步骤。骨架期只消费
   anchor 段(出生恰一次); 其余五段纯 no-op, 是 T-MAP-03 的拼装注入点。 */
function townBuild() {
  for (const {phase, steps} of townAssemblyPhases(townBuildSteps())) {
    if (phase === 'anchor') {
      /* 出生锚: 只出生恰一次(经 ModeKit 记住出生点); 其余锚点的交互
         注册归 T-MAP-04, 一次都不许多 */
      const it = townSpawnIntent();
      ModeKit.spawn(it.x, it.y, it.z, {yaw: it.yaw});
      continue;
    }
    /* T-MAP-03 拼装注入点(§5.1.6 该段实拼, 消费 steps), 骨架按 phase 序
       驱动、可空段不炸——ground/backdrop/road/prefab/scatter 五段在此 */
  }
}

/* ---------- 模式壳: 骨架薄壳(无自有资源, mkMode 缺省 chrome/score 即可) ----------
   init 全链顺序钉死: ① loadScene(townBuild) 装配(内含 anchor 段出生——
   §5.1.6 锚点末段纪律, 先建场后落人) → ② requestLock(U3 点卡直进:
   请求指针锁/触屏进行中, 无出发页无二次确认)。hud/hotbar/cleanup/
   update/onKey 骨架期不需要就不写(HUD 归 T-UI-01)。 */
const TownMode = mkMode({
  id: 'town',

  init() {
    loadScene(townBuild); /* 场景装填 seam: 清场→建场→收尾重建一步到位(装配在先) */
    requestLock(); /* U3 直进(出生在 loadScene 内 anchor 段, 已然其后) */
  },
});
