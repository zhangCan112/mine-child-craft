'use strict';
/* ============================================================
   城镇地图布局纯核心 (TownMapCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: Midport Village 城镇布局唯一权威——一份确定性纯数据
   (核心区/广场常量 + 分区/锚点/Prefab 实例/路网/地表/远景/散布七清单)
   外加一个建场步骤平铺纯函数, 藏住全部坐标拍板; 建场装配与材质注入只
   消费不自定坐标。
   interface: 全局 TOWN_MAP 九段(core{核心区闭域+size/groundY} · plaza
     {广场闭域} · zones 六带清单 · anchors/prefab/roads/ground/backdrop/
     scatter 七清单, 闭区间整数坐标, z 小=北) · 纯函数 townBuildSteps()
     → 步骤数组: 按 phase 全序 ['ground','backdrop','road','prefab',
     'scatter','anchor'] 平铺, 每步 = 源条目浅拷贝+phase 标签
     (docs/town-architecture-design.md §5.1.6 建场次序: 先地表/远景/
     路网基底→建筑件→植被道具散布→出生锚点), 同参同输出零副作用。
   依赖: 零运行时依赖——本文件不引用任何引擎件/件库符号(纯布局计划;
     布局常量对齐 docs/town-map-design.md §3-§4(布局权威)与
     docs/design/town-prefab-specs.md §3(件库映射); 脚印合法性由测试
     侧以 PrefabKit.footOf 校验, 材质集中注入归 T-MAP-03, 建场装配归
     T-MAP-02 消费本清单)。
   可测性声明: 零三维渲染库 · 零 DOM · 零墙钟 · 零随机 · 有同名单测
     (test/town-map-core.test.js, 14 test 可执行规格)。
   ============================================================ */

const TOWN_MAP = {
  /* 核心区: 160×160 世界居中 96×96, 四边各留 32 格远景/过渡带
     (map-design §3.1 ~96×96 口径); groundY=24 对齐既有地图地表基高
     先例, 之上余量放得下最高档 16 层钟塔(24+16=40 ≤ 47)。 */
  core: {x1: 32, z1: 32, x2: 127, z2: 127, size: 96, groundY: 24},
  /* 主广场: 28×28 与核心区同心(中心同为 79.5, ±1 内); 钟塔/摊位簇/
     广场樱花全落于此, 四缘贴放射路网(§3.2/§4.3 视线通廊)。 */
  plaza: {x1: 66, z1: 66, x2: 93, z2: 93, size: 28},
  /* 六带(§4.1 方位语义): 除 far-north(核心区外北侧剪影层)外全部
     ⊆ 核心区; hub 域=广场域; south 标 optional(P2 可选彩蛋带)。 */
  zones: [
    {id: 'far-north', name: '北远景带', x1: 0, z1: 0, x2: 159, z2: 31, reachable: false},
    {id: 'north', name: '北田园带', x1: 32, z1: 32, x2: 127, z2: 65, reachable: true},
    {id: 'hub', name: '中心广场带', x1: 66, z1: 66, x2: 93, z2: 93, reachable: true},
    {id: 'east', name: '东商业带', x1: 94, z1: 66, x2: 127, z2: 93, reachable: true},
    {id: 'west', name: '西生活带', x1: 32, z1: 66, x2: 65, z2: 127, reachable: true},
    {id: 'south', name: '南彩蛋带', x1: 66, z1: 94, x2: 127, z2: 127, reachable: true, optional: true},
  ],
  /* 导览锚(§6.2「观察-寻找-回应」锚点底料, T-MAP-02 出生意图/T-MAP-04
     导览消费): spawn 唯一、落南主路上面北望广场, 与钟塔东西对齐 ±2,
     spawn→钟塔走廊(x ±1)全建筑避让(§4.3 回望视线管理)。 */
  anchors: [
    {id: 'spawn', x: 79, y: 24, z: 112, face: 'north'},
    {id: 'bell-tower', x: 79, y: 24, z: 76, face: 'north'},
    {id: 'lava-chicken', x: 105, y: 24, z: 79, face: 'east'},
    {id: 'stash', x: 53, y: 24, z: 98, face: 'west'},
    {id: 'windmill', x: 56, y: 24, z: 47, face: 'north'},
    {id: 'farm', x: 71, y: 24, z: 58, face: 'north'},
    {id: 'market', x: 85, y: 24, z: 75, face: 'east'},
  ],
  /* Prefab 实例清单(§4.2 映射): P0/P1 全入=七新行+under-room 复用
      (cache-cellar); board-pool 按 PO 2026-11-13 裁决推迟不列, mound
      本布局不落。字段 {id,x,y,z,v,face,zone}, y 统一=groundY, v 无
      ids 槽(材质集中注入归 T-MAP-03)。脚印盒两两无交(布局自洽)。 */
  prefab: [
    {id: 'tower-belfry', x: 79, y: 24, z: 72, v: {}, face: 'south', zone: 'hub'},
    {id: 'shop-awning', x: 110, y: 24, z: 79, v: {}, face: 'west', zone: 'east'},
    {id: 'windmill-tower', x: 56, y: 24, z: 42, v: {}, face: 'south', zone: 'north'},
    {id: 'cottage-gable', x: 44, y: 24, z: 71, v: {}, face: 'south', zone: 'west'},
    {id: 'house-loft', x: 42, y: 24, z: 85, v: {}, face: 'north', zone: 'west'},
    {id: 'stash-hut', x: 49, y: 24, z: 98, v: {}, face: 'east', zone: 'west'},
    {/* cache-cellar(prefab-specs §4.9 覆写): 埋室室心, 室板埋 6 层,
         出路朝东伸入 stash-hut 东南侧空地; v.mat=3 石头(安全实义方块,
         材质基线黑名单外) */
      id: 'under-room', x: 57, y: 24, z: 99, v: {mat: 3, half: 2, cavH: 3,
        floorDy: -6, shaft: 0, trap: null, torches: 'solo', chest: true,
        exit: {steps: 5, width: 1}}, face: 'east', zone: 'west'},
    {/* 摊位簇(§3.2/§4.7): 沿广场边缘成组, 避让钟塔与视线走廊;
         theme 面包/花束/果篮齐, sm/md 两档都有 */
      id: 'stall-canopy', x: 70, y: 24, z: 68, v: {size: 'md', theme: 'bread'},
      face: 'south', zone: 'hub'},
    {id: 'stall-canopy', x: 89, y: 24, z: 75, v: {size: 'sm', theme: 'flower'},
      face: 'west', zone: 'hub'},
    {id: 'stall-canopy', x: 71, y: 24, z: 90, v: {size: 'md', theme: 'fruit'},
      face: 'north', zone: 'hub'},
  ],
  /* 路网(§4.3): 三条主路 5 宽放射贴广场三缘(北/东/南), 三条支路 3 宽
      通民居门前/田园/储藏角; 均为轴对齐闭域矩形段(厚=窄边跨度),
      段段贴广场或互相连通, 不压任何建筑脚印(含埋室 xz 域),
      非 hub 建筑距最近路段 ≤4 格。 */
  roads: [
    {id: 'main-north', kind: 'main', x1: 54, z1: 61, x2: 80, z2: 65}, /* 北主路 5 宽(西延
        至 x54 与田园支路北端贴边连通): 广场北缘→田园 */
    {id: 'main-east', kind: 'main', x1: 94, z1: 84, x2: 120, z2: 88},
    {id: 'main-south', kind: 'main', x1: 76, z1: 94, x2: 80, z2: 118},
    {id: 'lane-west', kind: 'lane', x1: 48, z1: 78, x2: 65, z2: 80},
    {id: 'lane-farm', kind: 'lane', x1: 54, z1: 46, x2: 56, z2: 60},
    {id: 'lane-stash', kind: 'lane', x1: 52, z1: 94, x2: 75, z2: 96},
  ],
  /* 地表分类(prefab-specs §5.2 场景拼装, 不入 PrefabKit): 广场铺装恰
      一条=plaza 常量域; 农田成组归北田园带(8-10 宽 × 11-14 深)。 */
  ground: [
    {id: 'plaza-paving', kind: 'plaza', x1: 66, z1: 66, x2: 93, z2: 93},
    {id: 'farm-a', kind: 'farm', x1: 66, z1: 44, x2: 75, z2: 56},
    {id: 'farm-b', kind: 'farm', x1: 80, z1: 46, x2: 88, z2: 57},
  ],
  /* 远景剪影(§4.2 R-01/R-02; R-03 神庙 M7 可选默认不落): 拱形山体
      横贯聚落背屏(宽 ≥ 核心区宽, 顶高过钟塔), 崖顶房屋 1-2 栋落
      山体域内; 全部不可达, 装配归 T-MAP-02 场景拼装。 */
  backdrop: [
    {id: 'mountain-arch', kind: 'mountain', x1: 16, z1: 8, x2: 143, z2: 28, topY: 44, reachable: false},
    {id: 'cliff-home-a', kind: 'cliff-home', x: 40, z: 16, baseY: 36, topY: 42, reachable: false},
    {id: 'cliff-home-b', kind: 'cliff-home', x: 112, z: 20, baseY: 35, topY: 41, reachable: false},
  ],
  /* 散布(prefab-specs §5.1/§5.2 落位政策归调用方=本计划): 樱花/灌木/
      灯柱/路标四类各 ≥1, 总数克制(6-16); 广场核心樱花必备; 逐点
      避让全部建筑脚印与路面, y=地面基高。 */
  scatter: [
    {id: 'sakura-plaza', kind: 'sakura', x: 68, y: 24, z: 88},
    {id: 'sakura-farm', kind: 'sakura', x: 78, y: 24, z: 52},
    {id: 'scrub-west', kind: 'scrub', x: 60, y: 24, z: 70},
    {id: 'scrub-east', kind: 'scrub', x: 98, y: 24, z: 92},
    {id: 'lamp-plaza', kind: 'lamp', x: 77, y: 24, z: 92},
    {id: 'lamp-west', kind: 'lamp', x: 64, y: 24, z: 67},
    {id: 'signpost-plaza', kind: 'signpost', x: 73, y: 24, z: 67},
    {id: 'signpost-stash', kind: 'signpost', x: 50, y: 24, z: 95},
  ],
};

/* 建场步骤平铺: 六清单按 phase 全序展开成一张步骤表, 每步 = 源条目
   浅拷贝 + phase 标签——嵌套 v 仍与源清单共享引用, 消费方只读(不改源清单,
   同参同输出; 纯函数红线, 两次调用深度相等; 消费方按序装场即可, 无需知道分段)。 */
function townBuildSteps() {
  const phases = [['ground', TOWN_MAP.ground], ['backdrop', TOWN_MAP.backdrop],
    ['road', TOWN_MAP.roads], ['prefab', TOWN_MAP.prefab],
    ['scatter', TOWN_MAP.scatter], ['anchor', TOWN_MAP.anchors]];
  const steps = [];
  for (const [phase, list] of phases) {
    for (const entry of list) {
      steps.push(Object.assign({}, entry, {phase}));
    }
  }
  return steps;
}

/* Node require 域导出守卫(浏览器域零影响——经典 script 词法共享不需要它):
   adventure-dims-core 的 Node 装载兜底经 require 取 TOWN_MAP 自举挂全局,
   镇件同名单测走 vm 域惯例不受此导出影响(无 module 即跳过) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {TOWN_MAP, townBuildSteps};
}
