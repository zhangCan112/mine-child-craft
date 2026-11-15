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
     (test/town-map-core.test.js, 16 test 可执行规格)。
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
    /* far-north reachable 随山体波翻旗(PO 亲需①②): 南缘走廊+裙板落位后
        北带自剪影层转可达, 与 arch §12.1 reachable 语义同步(消费方预留) */
    {id: 'far-north', name: '北远景带', x1: 0, z1: 0, x2: 159, z2: 31, reachable: true},
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
    /* TIDEA-01 尾段笔: v.sailStatic=false 叶片组件(轴/框/帆)整体退场不入格,
        旋转 mesh 接管(arch 波次二 spinner 全链已备)——assembly 由此派生
        spinner op, foot 同步收塔体 6×6 高 11(锥尖 dy10) */
    {id: 'windmill-tower', x: 56, y: 24, z: 42, v: {sailStatic: false}, face: 'south', zone: 'north'},
    {id: 'cottage-gable', x: 44, y: 24, z: 71, v: {}, face: 'south', zone: 'west'},
    {id: 'house-loft', x: 42, y: 24, z: 85, v: {}, face: 'north', zone: 'west'},
    {/* TIDEA-09(W-09): stash 寻宝记号两笔契约(顶层 tidea 命名空间键,
        消费实现前全链静默——pfMerge 对 v 未知键抛错故不入 v; footOf 只
        读 v/face, 派生 place 只带 v/ids, 顶层新键双静默零影响):
        porchLamp=门洞上方居中单格 19 暖金挂灯(锚相对 dx2/dy2/dz0, 门朝
        东 x51 线, 蓝图面波次一在制顺手挂); groundMark=门前地面西向
        chevron 4 圆石(锚相对 tiles, 派生面 prefab 后覆写): 顶(55,103)+
        双翼(56,102)/(56,104)+尾(58,103), id 4; under-room 埋室足印
        x55..64 z97..101 挤占门侧正位, 记号南移一档贴院角(规划脚本
        problems=0 留痕); 「秘密基地有记号」叙事召唤, 不写文字纯图形暗示 */
      id: 'stash-hut', x: 49, y: 24, z: 98, v: {},
      tidea: {porchLamp: {dx: 2, dy: 2, dz: 0},
        groundMark: {id: 4, tiles: [{dx: 6, dz: 5}, {dx: 7, dz: 4},
          {dx: 7, dz: 6}, {dx: 9, dz: 5}]}},
      face: 'east', zone: 'west'},
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
    {/* ---- TIDEA 波次二落位批(scene-plan-tidea2 problems=0; 「动骨架-轻」
        红线: 全部增量落位, 既有 13 实例零碰) ---- */
    /* TIDEA-04(W-04②): 稻草人立丰收角金黄区——foot 3×1×3(dy0 桩+dy1 衣/臂+
        dy2 南瓜头), 桩格覆一格金黄=「立麦中」构图本意(prefab 后写赢);
        面南朝 farm-a 南缘来客, 与 3 阶金黄高潮区(z45..47)构图互证 */
      id: 'scarecrow', x: 68, y: 24, z: 45, v: {},
      face: 'south', zone: 'north'},
    {/* TIDEA-08(W-08①): 晾衣绳——两桩一线三衣(蓝/粉/奶白), foot 5×1×3;
        cottage 南墙门脸西段门前第一行(衣格 x40..42 ⊆ 墙段投影, 端桩 x39
        出段 1 格避 npc a02(45,76) 切比 2); 面南衣横排迎 lane-west 来客 */
      id: 'clothesline', x: 41, y: 24, z: 75, v: {},
      face: 'south', zone: 'west'},
    {/* TIDEA-08(W-08③): 柴堆——墙根五根错叠, foot 3×1×2; house-loft 北墙
        (face:north 正面)门前第一行东段(flowerbed-loft(42,80) 相邻不重格);
        与晾衣绳组成 cottage/loft 两组「人家」生活气息 */
      id: 'woodpile', x: 44, y: 24, z: 81, v: {},
      face: 'south', zone: 'west'},
    {/* TIDEA-08(W-08④): 小鸡窝——干草台 2×2+两只块状鸡剪影, foot 2×2×3;
        鸡店(shop-awning, lava-chicken 锚)西门侧贴墙(x105 与店西墙线 x106
        相邻, v07(103,79) 切比 2); face west=鸡面西迎广场来客; 声景区位与
        TIDEA-11② 鸡叫声环境音位对齐(W-08④「鸡店门前小鸡窝」原案) */
      id: 'hencoop', x: 105, y: 24, z: 76, v: {},
      face: 'west', zone: 'east'},
    {/* TIDEA-10(W-10, P2-01 图纸): 高跳板与小水池——板沿 +z 南爬(face west
        经 rot1: 回程玩家沿 main-south 南下, 东侧平行经过全程可见爬升叙事),
        池贴板尾(南端)西侧; 缺省档 boardLen 6/poolSize 2(foot 4×10 高 7,
        dy 序 0,1,2,2,3,4 中段平台读感); 落南彩蛋带东侧空域(回程触发线
        z≥132 以北, 避 gate-e 樱/灯 ≥3); len/池径选档按 arch §9.3② 授权
        走查实拍自裁, 定稿底片留证 */
      id: 'board-pool', x: 86, y: 24, z: 106, v: {boardLen: 6, poolSize: 2},
      face: 'west', zone: 'south'},
    {/* iron-golem-head(PO 亲需③, arch §12.3.6 place pin 归本批): 铁傀儡头
        落山肩平顶。锚 x=65 非 lead 口头 x61——走廊切列 x60..61 的 trench
        顶在盒窗 z13..20 达 39..28, x61 锚盒 x58..64 必跨切列→基座悬空违
        崖体无悬空; x65 锚盒 x62..68 与切列净隔 1 列。y=41 下埋 2 格是硬
        约束: WORLD_H=48, 7 高件 y=42 起顶 y48 出界(dy0 基座插桩面即为此
        用); z=16 盒 z13..20 ⊆ lead 点位窗 z12..20, face south 鼻面齐平
        z20 南向注视镇景(广场 z66+ 远读 7 宽颅+3 凸鼻轮廓=arch §12.1③) */
      id: 'iron-golem-head', x: 65, y: 41, z: 16, v: {},
      face: 'south', zone: 'far-north'},
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
    {id: 'lane-farm', kind: 'lane', x1: 54, z1: 45, x2: 56, z2: 60, curb: true}, /* 尾段翻转随步: 北延贴塔正面(叶盒退场, §3 E 终站) */
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
    {/* TIDEA-07(W-07): 镇徽地花+主轴花带——地面格位重排(emblem/axisBloom
        字段显式启用, 派生侧铺装笔后追加覆写; 未知字段本笔静默缺省):
        emblem 4×4 回字环纹嵌 main-south 路面(spawn 落徽南缘, 白闪落地
        低头第一眼), 图样逐行死注释: z109 [78,17,17,78] / z110 [17,78,78,17] /
        z111 [17,78,78,17] / z112 [78,17,17,78](78 樱粉 8 格+17 石英 8 格);
        axisBloom 主轴双石色花带 x79..80 两列 z76..107(广场域+路域内),
        序列 r=(z-76)%4 取 r<2 → 13 石砖否则 4 圆石, 北端贴塔足 z75
        「直抵塔前台阶」; 平嵌 y24 不挡站位(走廊断言辖 y≥25 零冲突),
        v01(79,94) 站带上=迎客立地毯(美学拍板留痕 §八) */
      id: 'plaza-paving', kind: 'plaza', x1: 66, z1: 66, x2: 93, z2: 93,
      emblem: {x1: 77, z1: 109, x2: 80, z2: 112},
      axisBloom: {x1: 79, z1: 76, x2: 80, z2: 107}},
    {/* TIDEA-04 前半(W-04①): 丰收角——harvest 域显式启用, 派生侧田垄
        行轮转后按域覆写: 非埂行作物强制 45 三阶金黄(埂行 58 不动),
        风车侧(farm-a 西北角)4×4 与周边青苗 42/43 形成成熟色差高潮;
        零几何变化, npc/巡逻零连累(只改格色)。稻草人 blueprint 归 arch
        波次一, 落位归波次二 */
      id: 'farm-a', kind: 'farm-rows', x1: 66, z1: 44, x2: 75, z2: 56,
      harvest: {x1: 66, z1: 44, x2: 69, z2: 47}},
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
    {/* TIDEA-05(W-05): 瀑布白线——waterfall 列域显式启用, 派生侧在 bands
        五段之后追加: 54 雪白瀑布柱 x63..64×z24..28(南缘薄片贴崖面)×
        y25..39(雪带下缘 40 之下直落山脚)+17 石英水花两翼 x62/x65×
        y25..26×z26; 域内列顶 43(拱形公式, 雪段 40..43 在场)。落点过
        规划脚本全约束(崖屋剪影 x55..57 间隔 ≥3/塔影轴 x78..80 外/
        z ≤28 不入空隙带); 派生实现需求归 assembly 侧(未知字段本笔
        静默缺省, op 零变化) */
      id: 'mountain-arch', kind: 'mountain', x1: 16, z1: 8, x2: 143, z2: 28, topY: 44,
      bands: true, waterfall: {x1: 63, x2: 64}, reachable: true,
      /* southCorridor 南缘攀登走廊(PO 亲需②, arch §12.1① 逐字): 台阶列
         x60..61 z28→z10 ≤1 阶北行, 北端接山肩平台; 水花列 x62 天然域外;
         reachable 同步翻旗(语义预留) */
      southCorridor: {x1: 60, x2: 61}},
    {/* mountain-skirt 裙板(PO 亲需①连接, arch §12.1② 逐字): 南缘 z29..31
        三行贴地拱带(顶 24..25 平接镇草), 填平山脚-核心区鸿沟成可行缓坡;
        合脊键 (x,z) 化后与主山 z 域不重叠各归各, 主山柱笔逐字节不变 */
      id: 'mountain-skirt', kind: 'mountain', x1: 16, z1: 29, x2: 143, z2: 31,
      topY: 25, bands: true, reachable: true},
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
    {/* TIDEA-06(W-06, ADR-0011 决策 6c 预授权路径激活): 南门回程仪式件
        ——出镇方向「回家由此去」告示牌, 现成 signpost kind(柱 5+牌 6
        两笔), 落 (75,126) 坪南 3 格路西侧草地(原案 z130 一带内收保
        ⊆核心区纪律, 回程触发线 z≥132 之前最后视觉告别件); 灯柱复用
        既有 lamp-end-south(79,119) 坪芯「门内灯」零新增; 栅栏开间
        两桩无现成 kind, 契约归 arch 需求清单(波次一蓝图面/波次二落位)。
        落点过规划脚本全约束(非路/缘石/脚印/坪, npc·锚切比 ≥2) */
      id: 'signpost-home', kind: 'signpost', x: 75, y: 24, z: 126},
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
    {/* ---- TIDEA-03(W-03) 素墙立面三笔: house-loft 北墙(正面 face:north
        朝 z− 正对广场南缘视线, 南门机位左前视域尽头=W-03「11 号底片
        那面墙」; 墙段 x38..47 连续墙高 4..7 顶 y31, 探测留痕
        scene-plan-tidea2)。「西窗-旗-东窗-角箱」立面节奏, 全部格位
        覆写墙块(后写者赢), 不碰脚印不落地面 ---- */
      /* ① 店旗列: 竖排 4 格(y25..28)三色 i%3 轮转(78 樱粉/15 蓝/17 奶油,
        与钟塔脚旗阵同语言; red 16 不入立面轮转) */
      id: 'wallflag-loft', kind: 'wallflag', x: 42, y: 24, z: 82, v: {len: 4}},
    {/* ② 花窗箱×2: 箱 plank 2 宽+花 61/62+玻璃 2×2(y25..28)——「檐下
        开两扇」, 西端扇 x38..39+中东段扇 x44..45 */
      id: 'windowbox-loft-w', kind: 'windowbox', x: 38, y: 24, z: 82},
    {id: 'windowbox-loft-e', kind: 'windowbox', x: 44, y: 24, z: 82},
    {/* ③ 桶箱角: 桶 5 双高+箱 51 双高(x46..47, y25..26)——东端墙根
        桶箱簇(stash 门前桶堆同语言) */
      id: 'crates-loft', kind: 'crates', x: 46, y: 24, z: 82},
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
