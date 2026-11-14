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
     'scatter','anchor'] 平铺(wayshrine 条目加冠于 road 后, 见函数注),
     每步 = 源条目浅拷贝+phase 标签
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
      本布局不落。视觉重制 §3 A: 摊位 3→6(广场 4+主路口 2, 详见摊位
      簇注)。字段 {id,x,y,z,v,face,zone}, y 统一=groundY, v 无
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
    {/* 摊位 3→6(视觉重制 §3 A 氛围层: 广场 4+主路口 2): 三新摊补广场
         空角与路口迎面——东北角(md 花)背靠钟塔不进视线走廊 x78..80
         且不入 G01 巡逻环(z66 行外); 东路口(sm 面包)贴 main-east 入口
         迎客、盒子 x89..90 让巡逻环 x92 列; 南路口(md 果, 面北朝摊面
         迎出生动线)、盒子 z89..91 让巡逻环 z92 行。脚印全 ⊆ 广场、两两
         无交、避 npc 站位与巡逻格(同名单测钉) */
      id: 'stall-canopy', x: 86, y: 24, z: 68, v: {size: 'md', theme: 'flower'},
      face: 'south', zone: 'hub'},
    {id: 'stall-canopy', x: 89, y: 24, z: 87, v: {size: 'sm', theme: 'bread'},
      face: 'west', zone: 'hub'},
    {id: 'stall-canopy', x: 83, y: 24, z: 90, v: {size: 'md', theme: 'fruit'},
      face: 'north', zone: 'hub'},
  ],
  /* 路网(§4.3): 三条主路 5 宽放射贴广场三缘(北/东/南), 三条支路 3 宽
      通民居门前/田园/储藏角; 均为轴对齐闭域矩形段(厚=窄边跨度),
      段段贴广场或互相连通, 不压任何建筑脚印(含埋室 xz 域),
      非 hub 建筑距最近路段 ≤4 格。
      视觉重制 §3 E(v2 #5): 全段 curb:true——派生侧路体后写两侧外扩一格
      同层缘石(main=13 石/lane=4 木板); 外扩线撞广场两处(main-north 南缘
      z66/lane-stash 北缘 z93)按「广场路肩镶边」拍板保留(后写缘石覆盖
      铺装边行, 读法=入口路肩); 散布类落点一律避开外扩线。 */
  roads: [
    {id: 'main-north', kind: 'main', x1: 54, z1: 61, x2: 80, z2: 65, curb: true}, /* 北主路 5 宽(西延
        至 x54 与田园支路北端贴边连通): 广场北缘→田园 */
    {id: 'main-east', kind: 'main', x1: 94, z1: 84, x2: 120, z2: 88, curb: true},
    {id: 'main-south', kind: 'main', x1: 76, z1: 94, x2: 80, z2: 118, curb: true},
    {id: 'lane-west', kind: 'lane', x1: 48, z1: 78, x2: 65, z2: 80, curb: true},
    {id: 'lane-farm', kind: 'lane', x1: 54, z1: 46, x2: 56, z2: 60, curb: true},
    {id: 'lane-stash', kind: 'lane', x1: 52, z1: 94, x2: 75, z2: 96, curb: true},
  ],
  /* 地表分类(prefab-specs §5.2 场景拼装, 不入 PrefabKit): 广场铺装恰
      一条=plaza 常量域; 农田成组归北田园带(8-10 宽 × 11-14 深)。
      视觉重制 §3 E 地表层(v2): farm 两块升格 farm-rows 田垄——派生侧
      沟底 41 打底+逐行条带覆写(r=z-z1, r%5===0 田埂 58/其余作物 42..45
      轮转)+域四边 y+1 每 2 格围栏桩 5; 域不变故 npc 站位/巡逻面零连累。
      wayshrine 断头小坪×2(v2 #6): 贴 main-east/main-south 断头端外侧
      5×5(边环 4 木板+内缩芯 13 圆石), 坪内恰含既有驿站灯柱(v1 先落灯
      柱/圆石小坪 v2 的拍板兑现); 条目按契约排在清单末尾——buildSteps
      平铺时加冠于 road 段之后(后写者赢, 见 townBuildSteps 注) */
  ground: [
    {id: 'plaza-paving', kind: 'plaza', x1: 66, z1: 66, x2: 93, z2: 93},
    {id: 'farm-a', kind: 'farm-rows', x1: 66, z1: 44, x2: 75, z2: 56},
    {id: 'farm-b', kind: 'farm-rows', x1: 80, z1: 46, x2: 88, z2: 57},
    {id: 'wayshrine-east', kind: 'wayshrine', x1: 121, z1: 84, x2: 125, z2: 88},
    {id: 'wayshrine-south', kind: 'wayshrine', x1: 76, z1: 119, x2: 80, z2: 123},
  ],
  /* 远景剪影(§4.2 R-01/R-02; R-03 神庙 M7 可选默认不落): 拱形山体
      横贯聚落背屏(宽 ≥ 核心区宽, 顶高过钟塔), 崖顶房屋 2 栋落
      山体域内; 全部不可达, 装配归 T-MAP-02 场景拼装。
      视觉重制 §3 B 拍板: 崖屋从旧位(x40/x112, 距脊线远+塔影+雾距
      三重吃掉)移到脊线最高肩段 x56/x103——装配侧拱形公式下局部脊高
      恰 41, 屋盒 y41..46 露出脊线 5 格成剪影, 且分列钟塔影轴(塔半宽
      张角 ~4°)两侧 ~14° 不被塔影吞; 白墙 52/17+橙顶 9+19 灯点的造型
      字段走 assembly 侧(见交付报告新 kind 需求表)。 */
  backdrop: [
    {id: 'mountain-arch', kind: 'mountain', x1: 16, z1: 8, x2: 143, z2: 28, topY: 44,
      bands: true, reachable: false},
    {id: 'cliff-home-a', kind: 'cliff-home', x: 56, z: 22, baseY: 41, topY: 47,
      style: 'v2', reachable: false},
    {id: 'cliff-home-b', kind: 'cliff-home', x: 103, z: 22, baseY: 41, topY: 47,
      style: 'v2', reachable: false},
    /* 山缘植被(v2 #7): 低柱段(x 列顶 ≤27, 东西两缘)墙顶矮丛×4+苔石×3——
        top=脚下表面格=该列拱形列顶(装配侧合脊值, 17/18→25, 19→26,
        21→27, 139→26, 141→25, 143→24); z 带压在 24..28 山体域内南缘,
        冠域 x±1/z±1 不溢 z29 空隙带不出山域; 远景东西两缘增植被剪影。
        空隙带 z29..31 保持零写入(虚空护城河, 贴地点缀落虚空=浮空穿帮,
        美学拍板不落, 严于派生侧 op 层豁免口径) */
    {id: 'scrub-rim-w1', kind: 'scrub', x: 17, y: 25, z: 26, reachable: false},
    {id: 'scrub-rim-w2', kind: 'scrub', x: 19, y: 26, z: 26, reachable: false},
    {id: 'scrub-rim-w3', kind: 'scrub', x: 21, y: 27, z: 27, reachable: false},
    {id: 'scrub-rim-e1', kind: 'scrub', x: 141, y: 25, z: 26, reachable: false},
    {id: 'boulder-rim-w1', kind: 'boulder', x: 18, y: 25, z: 28, reachable: false},
    {id: 'boulder-rim-e1', kind: 'boulder', x: 139, y: 26, z: 27, reachable: false},
    {id: 'boulder-rim-e2', kind: 'boulder', x: 143, y: 24, z: 26, reachable: false},
  ],
  /* 散布(prefab-specs §5.1/§5.2 落位政策归调用方=本计划): 樱花/灌木/
      灯柱/路标四类(视觉重制 §3 A 密度升级); 广场核心樱花必备; 逐点
      避让全部建筑脚印与路面, y=地面基高。三组构图意图:
      ① 进镇门廊(出生第一眼): spawn(79,112) 面北主路 x76..80 两侧灯柱
        x75/x81 + 樱花 x75/x83 对位(z101..105 交错), 树冠 ±2 恰覆/贴路缘
        成「穿过樱花拱门望钟塔」前景框; e 树 x83 让出生回望走廊 x78..80
        (冠幅 81..85 不入走廊, 走廊零写见 adventure-dims 同名测试);
      ② 广场家具: 角樱 2(西北 67,69/东北 88,67, 避 npc 站位 90,68 与
        G01 角点 66,66 各 ≥2)+灯柱环(南 77,92/北 74,67/东 91,80/东南
        91,90, 让 G01 巡逻环 x66/x92/z66/z92 线不压柱)沿摊位簇与塔脚
        空隙补暖光;
      ③ 断头驿站信标(v1 先落灯柱, 圆石小坪 v2): main-east 东端
        (121,86)/main-south 南端(79,119)/lane-west 西端(47,79) 路尽头
        各 1 灯, 消解「断头扎草地」;
      草丛 40/花 61/62 全域散布与钟塔脚旗阵为新 kind, 按「新 kind 协议」
      二版交(见交付报告需求表), 本版克制不加。 */
  scatter: [
    {id: 'sakura-plaza', kind: 'sakura', x: 68, y: 24, z: 88},
    {id: 'sakura-farm', kind: 'sakura', x: 78, y: 24, z: 52},
    {id: 'sakura-corner-ne', kind: 'sakura', x: 88, y: 24, z: 67},
    {id: 'sakura-corner-nw', kind: 'sakura', x: 67, y: 24, z: 69},
    {id: 'sakura-gate-w', kind: 'sakura', x: 75, y: 24, z: 101},
    {id: 'sakura-gate-e', kind: 'sakura', x: 83, y: 24, z: 102},
    {id: 'scrub-west', kind: 'scrub', x: 60, y: 24, z: 70},
    {id: 'scrub-east', kind: 'scrub', x: 98, y: 24, z: 92},
    {id: 'lamp-plaza', kind: 'lamp', x: 77, y: 24, z: 92},
    {id: 'lamp-west', kind: 'lamp', x: 64, y: 24, z: 67},
    {id: 'lamp-north', kind: 'lamp', x: 74, y: 24, z: 67},
    {id: 'lamp-east', kind: 'lamp', x: 91, y: 24, z: 80},
    {id: 'lamp-southeast', kind: 'lamp', x: 91, y: 24, z: 90},
    {id: 'lamp-north-road', kind: 'lamp', x: 62, y: 24, z: 60},
    {id: 'lamp-gate-w', kind: 'lamp', x: 75, y: 24, z: 104},
    {id: 'lamp-gate-e', kind: 'lamp', x: 81, y: 24, z: 105},
    {id: 'lamp-end-east', kind: 'lamp', x: 121, y: 24, z: 86},
    {id: 'lamp-end-south', kind: 'lamp', x: 79, y: 24, z: 119},
    {id: 'lamp-end-west', kind: 'lamp', x: 47, y: 24, z: 79},
    {id: 'signpost-plaza', kind: 'signpost', x: 73, y: 24, z: 67},
    {id: 'signpost-stash', kind: 'signpost', x: 50, y: 24, z: 95},
    {id: 'signpost-east', kind: 'signpost', x: 95, y: 24, z: 89},
    {id: 'signpost-south', kind: 'signpost', x: 82, y: 24, z: 94},
    /* ---- 视觉重制 §3 E(v2 显式设计点, 全部过规划脚本全约束过滤:
        13 脚印/6 路+12 curb 外扩线/广场/农田/走廊 x78..80/空隙带/2 坪/
        14 npc 站位切比 ≥2/7 导览锚切比 ≥2/散布互不重格) ---- */
    /* 旗阵(v2 #3): 钟塔足印 x77..82×z70..75 贴脚半环四色, 色即方位叙事
        (北双旗 sakura/blue, 西翼 quartz, 东翼 red); 全部塔足印外 1 格,
        避 npc v04/v08 站位 ≥2, 避回望走廊(z≤71 <76) */
    {id: 'flag-tower-nw', kind: 'flag', x: 78, y: 24, z: 68, v: {cloth: 'sakura'}},
    {id: 'flag-tower-ne', kind: 'flag', x: 80, y: 24, z: 68, v: {cloth: 'blue'}},
    {id: 'flag-tower-w', kind: 'flag', x: 76, y: 24, z: 71, v: {cloth: 'quartz'}},
    {id: 'flag-tower-e', kind: 'flag', x: 83, y: 24, z: 71, v: {cloth: 'red'}},
    /* 花坛(v2 #10): 3×3 草丛环+花芯——广场东南角 1(灯柱东南邻组家具)
        +cottage 南门前 1(雏菊芯)+loft 北门前 1(蒲公英芯); 域全过脚印/
        路缘/npc ≥2 */
    {id: 'flowerbed-plaza-se', kind: 'flowerbed', x: 90, y: 24, z: 92, v: {tone: 'y'}},
    {id: 'flowerbed-cottage', kind: 'flowerbed', x: 42, y: 24, z: 76, v: {tone: 'w'}},
    {id: 'flowerbed-loft', kind: 'flowerbed', x: 42, y: 24, z: 80, v: {tone: 'y'}},
    /* 木桶(v2 #10): stash 东门前(驿站卸货桶)+windmill 东南角(磨坊货桶) */
    {id: 'barrel-stash', kind: 'barrel', x: 54, y: 24, z: 100},
    {id: 'barrel-windmill', kind: 'barrel', x: 58, y: 24, z: 46},
    /* 南瓜(v2 #10): cottage 西侧墙角+farm-b 东田头(丰收季叙事) */
    {id: 'pumpkin-cottage', kind: 'pumpkin', x: 40, y: 24, z: 77},
    {id: 'pumpkin-farm', kind: 'pumpkin', x: 89, y: 24, z: 58},
    /* 草丛全域散布(v2 #1): 每 8×8 块恰 1 候选(块锚+确定性偏移
        (bx*73+bz*151+3)%8), 全约束过滤后 112 件——弃 32(压 13 脚印/
        落 6 路+12 缘石线/广场/农田/走廊/贴 npc·锚站位/入花坛域)。
        规划期枚举产物冻结成字面清单, 装配侧零掷点(单点条目纪律) */
    {id: 'tuft-35-35', kind: 'tuft', x: 35, y: 24, z: 35},
    {id: 'tuft-35-43', kind: 'tuft', x: 35, y: 24, z: 43},
    {id: 'tuft-35-51', kind: 'tuft', x: 35, y: 24, z: 51},
    {id: 'tuft-35-59', kind: 'tuft', x: 35, y: 24, z: 59},
    {id: 'tuft-35-67', kind: 'tuft', x: 35, y: 24, z: 67},
    {id: 'tuft-35-75', kind: 'tuft', x: 35, y: 24, z: 75},
    {id: 'tuft-35-83', kind: 'tuft', x: 35, y: 24, z: 83},
    {id: 'tuft-35-91', kind: 'tuft', x: 35, y: 24, z: 91},
    {id: 'tuft-35-99', kind: 'tuft', x: 35, y: 24, z: 99},
    {id: 'tuft-35-107', kind: 'tuft', x: 35, y: 24, z: 107},
    {id: 'tuft-35-115', kind: 'tuft', x: 35, y: 24, z: 115},
    {id: 'tuft-35-123', kind: 'tuft', x: 35, y: 24, z: 123},
    {id: 'tuft-43-35', kind: 'tuft', x: 43, y: 24, z: 35},
    {id: 'tuft-43-43', kind: 'tuft', x: 43, y: 24, z: 43},
    {id: 'tuft-43-51', kind: 'tuft', x: 43, y: 24, z: 51},
    {id: 'tuft-43-59', kind: 'tuft', x: 43, y: 24, z: 59},
    {id: 'tuft-43-67', kind: 'tuft', x: 43, y: 24, z: 67},
    {id: 'tuft-43-91', kind: 'tuft', x: 43, y: 24, z: 91},
    {id: 'tuft-43-99', kind: 'tuft', x: 43, y: 24, z: 99},
    {id: 'tuft-43-107', kind: 'tuft', x: 43, y: 24, z: 107},
    {id: 'tuft-43-115', kind: 'tuft', x: 43, y: 24, z: 115},
    {id: 'tuft-43-123', kind: 'tuft', x: 43, y: 24, z: 123},
    {id: 'tuft-51-35', kind: 'tuft', x: 51, y: 24, z: 35},
    {id: 'tuft-51-43', kind: 'tuft', x: 51, y: 24, z: 43},
    {id: 'tuft-51-51', kind: 'tuft', x: 51, y: 24, z: 51},
    {id: 'tuft-51-59', kind: 'tuft', x: 51, y: 24, z: 59},
    {id: 'tuft-51-67', kind: 'tuft', x: 51, y: 24, z: 67},
    {id: 'tuft-51-75', kind: 'tuft', x: 51, y: 24, z: 75},
    {id: 'tuft-51-83', kind: 'tuft', x: 51, y: 24, z: 83},
    {id: 'tuft-51-91', kind: 'tuft', x: 51, y: 24, z: 91},
    {id: 'tuft-51-107', kind: 'tuft', x: 51, y: 24, z: 107},
    {id: 'tuft-51-115', kind: 'tuft', x: 51, y: 24, z: 115},
    {id: 'tuft-51-123', kind: 'tuft', x: 51, y: 24, z: 123},
    {id: 'tuft-59-35', kind: 'tuft', x: 59, y: 24, z: 35},
    {id: 'tuft-59-51', kind: 'tuft', x: 59, y: 24, z: 51},
    {id: 'tuft-59-59', kind: 'tuft', x: 59, y: 24, z: 59},
    {id: 'tuft-59-67', kind: 'tuft', x: 59, y: 24, z: 67},
    {id: 'tuft-59-75', kind: 'tuft', x: 59, y: 24, z: 75},
    {id: 'tuft-59-83', kind: 'tuft', x: 59, y: 24, z: 83},
    {id: 'tuft-59-91', kind: 'tuft', x: 59, y: 24, z: 91},
    {id: 'tuft-59-107', kind: 'tuft', x: 59, y: 24, z: 107},
    {id: 'tuft-59-115', kind: 'tuft', x: 59, y: 24, z: 115},
    {id: 'tuft-59-123', kind: 'tuft', x: 59, y: 24, z: 123},
    {id: 'tuft-67-35', kind: 'tuft', x: 67, y: 24, z: 35},
    {id: 'tuft-67-43', kind: 'tuft', x: 67, y: 24, z: 43},
    {id: 'tuft-67-59', kind: 'tuft', x: 67, y: 24, z: 59},
    {id: 'tuft-67-99', kind: 'tuft', x: 67, y: 24, z: 99},
    {id: 'tuft-67-107', kind: 'tuft', x: 67, y: 24, z: 107},
    {id: 'tuft-67-115', kind: 'tuft', x: 67, y: 24, z: 115},
    {id: 'tuft-67-123', kind: 'tuft', x: 67, y: 24, z: 123},
    {id: 'tuft-75-35', kind: 'tuft', x: 75, y: 24, z: 35},
    {id: 'tuft-75-43', kind: 'tuft', x: 75, y: 24, z: 43},
    {id: 'tuft-75-59', kind: 'tuft', x: 75, y: 24, z: 59},
    {id: 'tuft-75-123', kind: 'tuft', x: 75, y: 24, z: 123},
    {id: 'tuft-83-35', kind: 'tuft', x: 83, y: 24, z: 35},
    {id: 'tuft-83-43', kind: 'tuft', x: 83, y: 24, z: 43},
    {id: 'tuft-83-99', kind: 'tuft', x: 83, y: 24, z: 99},
    {id: 'tuft-83-107', kind: 'tuft', x: 83, y: 24, z: 107},
    {id: 'tuft-83-115', kind: 'tuft', x: 83, y: 24, z: 115},
    {id: 'tuft-83-123', kind: 'tuft', x: 83, y: 24, z: 123},
    {id: 'tuft-91-35', kind: 'tuft', x: 91, y: 24, z: 35},
    {id: 'tuft-91-43', kind: 'tuft', x: 91, y: 24, z: 43},
    {id: 'tuft-91-51', kind: 'tuft', x: 91, y: 24, z: 51},
    {id: 'tuft-91-59', kind: 'tuft', x: 91, y: 24, z: 59},
    {id: 'tuft-91-99', kind: 'tuft', x: 91, y: 24, z: 99},
    {id: 'tuft-91-107', kind: 'tuft', x: 91, y: 24, z: 107},
    {id: 'tuft-91-115', kind: 'tuft', x: 91, y: 24, z: 115},
    {id: 'tuft-91-123', kind: 'tuft', x: 91, y: 24, z: 123},
    {id: 'tuft-99-35', kind: 'tuft', x: 99, y: 24, z: 35},
    {id: 'tuft-99-43', kind: 'tuft', x: 99, y: 24, z: 43},
    {id: 'tuft-99-51', kind: 'tuft', x: 99, y: 24, z: 51},
    {id: 'tuft-99-59', kind: 'tuft', x: 99, y: 24, z: 59},
    {id: 'tuft-99-67', kind: 'tuft', x: 99, y: 24, z: 67},
    {id: 'tuft-99-75', kind: 'tuft', x: 99, y: 24, z: 75},
    {id: 'tuft-99-91', kind: 'tuft', x: 99, y: 24, z: 91},
    {id: 'tuft-99-99', kind: 'tuft', x: 99, y: 24, z: 99},
    {id: 'tuft-99-107', kind: 'tuft', x: 99, y: 24, z: 107},
    {id: 'tuft-99-115', kind: 'tuft', x: 99, y: 24, z: 115},
    {id: 'tuft-99-123', kind: 'tuft', x: 99, y: 24, z: 123},
    {id: 'tuft-107-35', kind: 'tuft', x: 107, y: 24, z: 35},
    {id: 'tuft-107-43', kind: 'tuft', x: 107, y: 24, z: 43},
    {id: 'tuft-107-51', kind: 'tuft', x: 107, y: 24, z: 51},
    {id: 'tuft-107-59', kind: 'tuft', x: 107, y: 24, z: 59},
    {id: 'tuft-107-67', kind: 'tuft', x: 107, y: 24, z: 67},
    {id: 'tuft-107-91', kind: 'tuft', x: 107, y: 24, z: 91},
    {id: 'tuft-107-99', kind: 'tuft', x: 107, y: 24, z: 99},
    {id: 'tuft-107-107', kind: 'tuft', x: 107, y: 24, z: 107},
    {id: 'tuft-107-115', kind: 'tuft', x: 107, y: 24, z: 115},
    {id: 'tuft-107-123', kind: 'tuft', x: 107, y: 24, z: 123},
    {id: 'tuft-115-35', kind: 'tuft', x: 115, y: 24, z: 35},
    {id: 'tuft-115-43', kind: 'tuft', x: 115, y: 24, z: 43},
    {id: 'tuft-115-51', kind: 'tuft', x: 115, y: 24, z: 51},
    {id: 'tuft-115-59', kind: 'tuft', x: 115, y: 24, z: 59},
    {id: 'tuft-115-67', kind: 'tuft', x: 115, y: 24, z: 67},
    {id: 'tuft-115-75', kind: 'tuft', x: 115, y: 24, z: 75},
    {id: 'tuft-115-91', kind: 'tuft', x: 115, y: 24, z: 91},
    {id: 'tuft-115-99', kind: 'tuft', x: 115, y: 24, z: 99},
    {id: 'tuft-115-107', kind: 'tuft', x: 115, y: 24, z: 107},
    {id: 'tuft-115-115', kind: 'tuft', x: 115, y: 24, z: 115},
    {id: 'tuft-115-123', kind: 'tuft', x: 115, y: 24, z: 123},
    {id: 'tuft-123-35', kind: 'tuft', x: 123, y: 24, z: 35},
    {id: 'tuft-123-43', kind: 'tuft', x: 123, y: 24, z: 43},
    {id: 'tuft-123-51', kind: 'tuft', x: 123, y: 24, z: 51},
    {id: 'tuft-123-59', kind: 'tuft', x: 123, y: 24, z: 59},
    {id: 'tuft-123-67', kind: 'tuft', x: 123, y: 24, z: 67},
    {id: 'tuft-123-75', kind: 'tuft', x: 123, y: 24, z: 75},
    {id: 'tuft-123-83', kind: 'tuft', x: 123, y: 24, z: 83},
    {id: 'tuft-123-91', kind: 'tuft', x: 123, y: 24, z: 91},
    {id: 'tuft-123-99', kind: 'tuft', x: 123, y: 24, z: 99},
    {id: 'tuft-123-107', kind: 'tuft', x: 123, y: 24, z: 107},
    {id: 'tuft-123-115', kind: 'tuft', x: 123, y: 24, z: 115},
    {id: 'tuft-123-123', kind: 'tuft', x: 123, y: 24, z: 123},
    /* 花全域散布(v2 #2): 每 16×16 块恰 1 候选(偏移盐 5/9), 过滤后 26 件;
        v.tone 双色混排(y 蒲公英 61/w 雏菊 62, (x+z) 奇偶定) */
    {id: 'flower-37-41', kind: 'flower', x: 37, y: 24, z: 41, v: {tone: 'y'}},
    {id: 'flower-37-57', kind: 'flower', x: 37, y: 24, z: 57, v: {tone: 'w'}},
    {id: 'flower-37-73', kind: 'flower', x: 37, y: 24, z: 73, v: {tone: 'y'}},
    {id: 'flower-37-89', kind: 'flower', x: 37, y: 24, z: 89, v: {tone: 'w'}},
    {id: 'flower-37-105', kind: 'flower', x: 37, y: 24, z: 105, v: {tone: 'y'}},
    {id: 'flower-37-121', kind: 'flower', x: 37, y: 24, z: 121, v: {tone: 'w'}},
    {id: 'flower-53-73', kind: 'flower', x: 53, y: 24, z: 73, v: {tone: 'w'}},
    {id: 'flower-53-89', kind: 'flower', x: 53, y: 24, z: 89, v: {tone: 'y'}},
    {id: 'flower-53-105', kind: 'flower', x: 53, y: 24, z: 105, v: {tone: 'w'}},
    {id: 'flower-53-121', kind: 'flower', x: 53, y: 24, z: 121, v: {tone: 'y'}},
    {id: 'flower-69-41', kind: 'flower', x: 69, y: 24, z: 41, v: {tone: 'y'}},
    {id: 'flower-69-105', kind: 'flower', x: 69, y: 24, z: 105, v: {tone: 'y'}},
    {id: 'flower-69-121', kind: 'flower', x: 69, y: 24, z: 121, v: {tone: 'w'}},
    {id: 'flower-85-41', kind: 'flower', x: 85, y: 24, z: 41, v: {tone: 'w'}},
    {id: 'flower-85-105', kind: 'flower', x: 85, y: 24, z: 105, v: {tone: 'w'}},
    {id: 'flower-85-121', kind: 'flower', x: 85, y: 24, z: 121, v: {tone: 'y'}},
    {id: 'flower-101-41', kind: 'flower', x: 101, y: 24, z: 41, v: {tone: 'y'}},
    {id: 'flower-101-57', kind: 'flower', x: 101, y: 24, z: 57, v: {tone: 'w'}},
    {id: 'flower-101-73', kind: 'flower', x: 101, y: 24, z: 73, v: {tone: 'y'}},
    {id: 'flower-101-105', kind: 'flower', x: 101, y: 24, z: 105, v: {tone: 'y'}},
    {id: 'flower-101-121', kind: 'flower', x: 101, y: 24, z: 121, v: {tone: 'w'}},
    {id: 'flower-117-41', kind: 'flower', x: 117, y: 24, z: 41, v: {tone: 'w'}},
    {id: 'flower-117-57', kind: 'flower', x: 117, y: 24, z: 57, v: {tone: 'y'}},
    {id: 'flower-117-73', kind: 'flower', x: 117, y: 24, z: 73, v: {tone: 'w'}},
    {id: 'flower-117-105', kind: 'flower', x: 117, y: 24, z: 105, v: {tone: 'w'}},
    {id: 'flower-117-121', kind: 'flower', x: 117, y: 24, z: 121, v: {tone: 'y'}},
  ],
};

/* 建场步骤平铺: 六清单按 phase 全序展开成一张步骤表, 每步 = 源条目
   浅拷贝 + phase 标签——嵌套 v 仍与源清单共享引用, 消费方只读(不改源清单,
   同参同输出; 纯函数红线, 两次调用深度相等; 消费方按序装场即可, 无需知道分段)。
   v2 写序特例(op 派生契约): wayshrine 条目(steps 序即写序, 后写者赢)必须
   排在 road 段之后才不被路体/缘石覆盖——故 ground 段拆两笔平铺:
   非 wayshrine 地表条目照常打头, wayshrine 尾随 road 之后、prefab 之前
   加冠(phase 标签不变, 消费方 phase 分支零感知; 分组视图 townAssemblyPhases
   按权威序归并, 组内保序=源清单序)。 */
function townBuildSteps() {
  const capGround = TOWN_MAP.ground.filter((e) => e.kind === 'wayshrine');
  const baseGround = TOWN_MAP.ground.filter((e) => e.kind !== 'wayshrine');
  const phases = [['ground', baseGround], ['backdrop', TOWN_MAP.backdrop],
    ['road', TOWN_MAP.roads], ['ground', capGround], ['prefab', TOWN_MAP.prefab],
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
