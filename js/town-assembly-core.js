'use strict';
/* ============================================================
   城镇装配纯核心 (TownAssemblyCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: 把 TownMapCore 的建场步骤表规划成一张确定性 op 列表
   (纯计划, 不碰世界), 连同 TOWN_PALETTE 城镇配色映射一起, 藏住全部
   材质拍板与几何派生; 执行器只按 op 词表逐条落地。
   interface: 全局 TOWN_PALETTE 七段配色映射(prefab 十四行集中注入材质 ·
     terrain 基底三层 · ground 铺装 · road 路网 · backdrop 远景 ·
     props 道具 · tree 植被, 值全为 config.js BLOCKS 在册正整数 id) ·
      纯函数 townAssemblyOps(steps) → op 列表(词表封闭 {fill,tree,scrub,
      recolor,place,spinner}): 基底三层垫底(序列最前=后写者赢的显式见证)
      后按 steps 相对次序派生——ground/backdrop/road 段出 fill(ground 含
      T2 town-rim 墙圈: segs 逐段派生+墙头花, 见 palette 注 Step H),
      prefab 段
      出 place/spinner 双胞胎(TIDEA-01 波次二: v.sailStatic===false 严格判据
      →spinner 替代 place, period 顶层钩穿透; tidea.porchLamp→v 注入+
      groundMark 四笔 fill; face/ids 注入一律新对象, 源清单只读), scatter
      段出 tree+recolor(樱花 7→78 覆写落调用方)/scrub(确定性盐)/灯柱路标
      fill, anchor 段零 op(出生归模式层恰一次); 波次二五件派生: 瀑布三笔
      (mountain.waterfall)/emblem 16+axisBloom 32(plaza, 路面嵌花 inlay 补记
      后于全 steps)/harvest 非埂行覆 45(farm-rows.harvest)/记号见 prefab 段。
   依赖: 零运行时依赖——本文件不引用任何引擎件/DOM/墙钟符号; 全局
     TOWN_MAP 调用期解析(消费 core.groundY 派生地表基高与基底范围,
     经典脚本同款; index.html 加载序 js/town-map-core.js → 本文件 →
     使用方)。
   可测性声明: 零三维渲染库 · 零 DOM · 零墙钟 · 零随机(散布确定性只
     走引擎 SceneKit.rand/hashRand, 本件不掷点) · 裸沙盒可装载 ·
     同参同输出 · 有同名单测(test/town-assembly-core.test.js)。
   ============================================================ */

/* 城镇配色映射 v2(设计权威 docs/design/town-visual-revamp-spec.md §2 字库
   契约与 §3 M 层全表重映射 > 历史语义 docs/town-map-design.md §3-§4 与
   docs/design/town-prefab-specs.md §4 材质语义; 裁决序见总纲 §1; T-PREFAB-09
   材质安全基线: 城镇七行零危险旗标/零显式错用, 测试钉死防漂移)。
   prefab 段按实例 id 取值, 消费方(PrefabKit pfMerge)未指定键回落行缺省
   ——stall-canopy 布幔 canopy 键不在此(引擎侧 theme 映射 PF_STALL_CANOPY
   单源, 双源即漂移)。ground.plazaBand/road.curb 两键为本轮新字库槽位
   (广场边带砂岩 58/路缘石砖 13): 只登记不接线, 消费归 scene 师下一批
   steps 扩 kind, 本件派生分支域不变。
   Step C 扩键登记(arch 岗, 2026-11-15; pfMerge 行键⊆蓝图缺省 ids 键,
   行与蓝图 kernel 同 commit): shop-awning +plaster/awningTrim(抹灰门脸/
   布幔上滚边), 换值 signBg 15→76/signAccent 38→17/awning 52→15/window
   18→68; cottage-gable +frame/doorTop/bedGrass/bedFlower1/bedFlower2
   (窗框楣/门上叶/墙根花坛三格), 换值 base 58→13/door 6→64/chimney
   3→4; house-loft +frame/doorTop/awning(窗框楣/门上叶/布幔), 换值
   base 58→13/wallB 5→17/door 6→64。花坛三槽=40/61/62 cross 薄块,
   T-09 审计按槽名豁免 thin/replaceable(door/doorTop 槽名豁免先例)。
   Step D 扩键登记(arch 岗, 2026-11-15): shop-awning -signAccent
   +signBird/signComb/signLight(招牌鸡剪影立板, lead 终审; 新槽值
   52/16/19); stash-hut +doorTop/barrel/chest/mossy(§3 G 门前桶堆+
   储物箱+苔石点缀升格入蓝图), 换值 door 6→64; stall-canopy -goods
   +goodsBread/goodsFlower/goodsFruit/goodsLeaf1/goodsLeaf2/flag(货物
   主题化+md 叶饰+角旗; 弃 38 金矿旧材质), canopy/canopyTrim 仍不入行
   (引擎侧 PF_STALL_CANOPY/PF_STALL_TRIM theme 映射单源, 双源即漂移)。
   goodsLeaf 两槽=61/62 树叶薄块, T-09 审计按槽名豁免 thin/replaceable
   Step E 扩键登记(arch 岗, 2026-11-15; op 派生 v2, scene 需求表 10 项):
   ground +fieldRidge/fieldFence/shrineCore/shrineEdge(farm-rows 田垄/
   wayshrine 断头小坪); road +curbLane(支路缘石 4, curb 13 本轮接线);
   backdrop +mountainSnow/mountainMoss/mountainGrass/boulder/cliffWall/
   cliffFrame/cliffRoof/cliffLamp/cliffWindow(山体分色 54/14/1+山脚苔石
   14+崖屋 v2 拆键 52/17/9/19/18; cliffHome 6 保留=legacy 几何单源);
   props +tuft/flagPole/flowerbedRing/barrel/pumpkin+flagCloth 四色组+
   flowerCore 两组(散布草丛/旗/花坛/木桶/南瓜; 作物 42-45 走派生字面,
   场景语义不入 palette)。新 kind 全走可选字段(bands/style/curb/
   v.tone/v.cloth), 现 steps 条目行为逐字节不变(dims 零连累;
   花坛三槽=同款先例)。
   Step F 扩键登记(arch 岗, 2026-11-15; TIDEA 波次一 arch 静态陈设批):
   prefab +五行 scarecrow/clothesline/woodpile/hencoop/'board-pool'
   (TIDEA-04 稻草人/TIDEA-08 晾衣绳·柴堆·鸡窝/TIDEA-10 跳板水池,
   行键与 prefab-kit defaults ids 同形, 几何单源在蓝图 kernel;
   windowbox 花窗箱不建行——TIDEA-03 ② 走 scatter kind 单源);
   'board-pool' ids 键面微扩 3→5 键(+flagPole/flag, 板顶旗材质不焊死,
   报 lead 登记); props +plank/glassPane/crateBox(立面三笔用料);
   scatter +三 kind wallflag/windowbox/crates(TIDEA-03 素墙立面三笔:
   旗幡列 v.len 钳 2..6 缺省 4 三色 i%3 轮转/花窗箱 8 格/桶箱角 4 格,
   派生分支域扩——落位归 scene 切清单, 本件只收单点条目)。
   Step G 扩键登记(arch 岗, 2026-11-15; PO 亲需批两件能力面+裙板协同
   6413b00+PO 实屏拍板「头像→全身像」升级): prefab +'iron-golem' 行
   (铁傀儡全身立像七槽 skull/nose/eye/moss/plinth/body/belt=
   17/17/12/14/3/17/12, 行键与 prefab-kit defaults ids 同形, 几何单源
   在蓝图 kernel; 头版 iron-golem-head 未落位即转全身=零死行; PO 亲
   需③村民感恩守卫, 落位归 scene 山脚裙板登山口侧); mountain 条目
   +southCorridor 门控字段
   ({x1,x2}=台阶列域, PO 亲需②攀登支持; lead 裁定中带 x60..61 切崖,
   scene 探勘备妥): 走廊列 z 向阶梯包络 h(z)=min(顶,h(z+1)+1) 构造性
   ≤1 阶北行接山肩平台, 两侧列整柱拱形=崖壁凹槽防护, 水花列域外
   瀑布零写入保全; 缺字段字节级零变化, 非 bands 拼写域抛错; 合脊
   预扫键 x→(x,z)(scene 6413b00 裙板硬需求): z 域不重叠条目各归各,
   裙板拱顶不被主山拱高顶穿, 单条目逐字节不变。
   Step H 扩键登记(2026-11-16, T2 镇缘防坠墙圈, spec §3.3): ground 段新
   kind 'town-rim'(零 palette 扩键——墙体石砖 13/柱帽石英 17 走派生字面,
   作物 42..45 同款先例; 墙头花 61/62 复用 props.flowerCore 组单源):
   条目顶层无 x/z 域, segs 显式分段清单=几何唯一权威(map-core 单源),
   按 part 逐段派生——pad/wall/post/wing/pier→seg 自身闭盒一笔 13,
   cap→seg 单格一笔 17; 墙头花只从 wall 段派生(spec §3.3「每 8 格一簇」:
   沿线坐标 ≡0 mod 8 且 ∈40..120 簇位带, 落墙顶格=段顶+1; 开口段无
   墙身=自然跳空零特判; 翼墙/端头墩/接头柱段无花), 花色 ⌊(x+z)/8⌋
   偶 61 奇 62 固定交替零盐(spec 拍板: x+z 奇偶在定 z 墙线恒同值
   不可用)。纯几何零随机, 合成短段(簇位带外)=恰段笔本身零花。
   合法域枚举同步扩 'town-rim'。 */
const TOWN_PALETTE = {
  prefab: {
    'tower-belfry': {base: 13, wall: 17, pillar: 5, trim: 5, roof: 9, bell: 19,
      window: 68, flag: 78, door: 64, doorTop: 65},
    'shop-awning': {base: 13, wall: 6, plaster: 17, trim: 5, roof: 9,
      awning: 15, awningTrim: 17, signBg: 76, signBird: 52, signComb: 16,
      signLight: 19, glow: 19, window: 68},
    'windmill-tower': {base: 13, wall: 17, roof: 9, trim: 5, blade: 6, axle: 76, accent: 17},
    'cottage-gable': {base: 13, wall: 6, trim: 5, frame: 17, roof: 9, window: 18,
      door: 64, doorTop: 65, chimney: 4,
      bedGrass: 40, bedFlower1: 61, bedFlower2: 62},
    'house-loft': {base: 13, wallA: 6, wallB: 17, roof: 9, trim: 5, window: 18,
      frame: 17, door: 64, doorTop: 65, balcony: 5, awning: 15},
    'stash-hut': {base: 3, wall: 6, roof: 5, trim: 5, door: 64, doorTop: 65,
      metalAccent: 12, barrel: 5, chest: 51, mossy: 14, porchLamp: 19},
    'under-room': {chest: 51, torch: 48, cap: 8, land: 58},
    'stall-canopy': {frame: 5, counter: 6, goodsBread: 17, goodsFlower: 78,
      goodsFruit: 76, goodsLeaf1: 61, goodsLeaf2: 62, flag: 78},
    'scarecrow': {post: 5, arm: 6, shirt: 15, head: 76},
    'clothesline': {pole: 5, line: 5, shirtBlue: 15, shirtPink: 78, shirtQuartz: 17},
    'woodpile': {log: 5},
    'hencoop': {hay: 58, henBody: 52, henComb: 16},
    'board-pool': {board: 5, poolEdge: 17, water: 15, flagPole: 5, flag: 78},
    'iron-golem': {skull: 17, nose: 17, eye: 12, moss: 14, plinth: 3,
      body: 17, belt: 12},
  },
  terrain: {deep: 3, filler: 2, surface: 1},
  ground: {plaza: 17, farm: 41, plazaBand: 58, fieldRidge: 58, fieldFence: 5,
    shrineCore: 13, shrineEdge: 4},
  road: {main: 13, lane: 4, curb: 13, curbLane: 4},
  backdrop: {mountain: 3, cliffHome: 6, mountainSnow: 54, mountainMoss: 14,
    mountainGrass: 1, boulder: 14, cliffWall: 52, cliffFrame: 17, cliffRoof: 9,
    cliffLamp: 19, cliffWindow: 18},
  props: {lampBase: 17, lampPost: 5, lampLight: 19, signPost: 5, signBoard: 6,
    tuft: 40, flagPole: 5, flowerbedRing: 40, barrel: 5, pumpkin: 76,
    plank: 5, glassPane: 68, crateBox: 51,
    flagCloth: {sakura: 78, blue: 15, quartz: 17, red: 16},
    flowerCore: {y: 61, w: 62}},
  tree: {sakuraLeaf: 78},
};

/* 装配规划器: 步骤表 → op 列表。纯函数零副作用——只读 steps 与
   TOWN_MAP.core/TOWN_PALETTE, 注入(face/ids)一律 Object.assign 造新
   对象(steps 嵌套 v 与源清单共享引用, 原地改即污染布局权威)。 */
function townAssemblyOps(steps) {
  const core = TOWN_MAP.core;
  const groundY = core.groundY;
  const pal = TOWN_PALETTE;
  const ops = [];
  /* 路面嵌花补记表(TIDEA-07): emblem/axisBloom 是「嵌 main-south 路面」
     读法(map-core 条目注)——ground 相位派生会被 road 相位后写覆埋, 故
     收集延后, 全 steps 循环收口后统一补记(补记序=收集序, 确定性不破) */
  const inlays = [];
  /* 基底三层垫底(序列最前三笔): deep 0..groundY-4 石 / filler 泥 /
     surface groundY 草——后写者赢, 广场/路网/建筑压得住草地。 */
  ops.push({op: 'fill', x1: core.x1, y1: 0, z1: core.z1, x2: core.x2, y2: groundY - 4, z2: core.z2,
    id: pal.terrain.deep});
  ops.push({op: 'fill', x1: core.x1, y1: groundY - 3, z1: core.z1, x2: core.x2, y2: groundY - 1, z2: core.z2,
    id: pal.terrain.filler});
  ops.push({op: 'fill', x1: core.x1, y1: groundY, z1: core.z1, x2: core.x2, y2: groundY, z2: core.z2,
    id: pal.terrain.surface});
  /* 山体合脊预扫(#7 五段弧形): 键 (x,z)=x*64+z(条目 z 域<64 安全),
     同列同线多条目重叠域取 max——z 域不重叠的条目(主山 z8..28/裙板
     z29..31)各归各, 裙板拱顶不被主山拱高顶穿(6413b00 裙板协同,
     旧 x 单键 max 会把 z29..31 顶成拱高墙); 单条目=自身行为不变。
     mountain 逐柱派生统一取合脊顶 */
  const ridgeTop = {};
  for (const b of steps) {
    if (b.phase === 'backdrop' && b.kind === 'mountain') {
      const bcx = (b.x1 + b.x2) / 2;
      const bhalf = (b.x2 - b.x1) / 2;
      for (let x = b.x1; x <= b.x2; x++) {
        const bt = (x - bcx) / bhalf;
        const btop = Math.round(b.topY * (1 - bt * bt) + groundY * (bt * bt));
        for (let z = b.z1; z <= b.z2; z++) {
          const k = x * 64 + z;
          ridgeTop[k] = Math.max(ridgeTop[k] || 0, btop);
        }
      }
    }
  }
  for (const s of steps) {
    if (s.phase === 'ground') {
      /* 地表铺装: ground/road 类条目无 y 字段, 一律取 core.groundY(地表基高) */
      if (s.kind === 'plaza' || s.kind === 'farm') {
        const id = s.kind === 'plaza' ? pal.ground.plaza : pal.ground.farm;
        ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: s.z1, x2: s.x2, y2: groundY,
          z2: s.z2, id});
        /* TIDEA-07 镇徽+花带(波次二): emblem 4×4 逐格覆写(回字环纹图样死
           字面——78 樱粉 8+17 石英 8, 与 map-core 数据死注释同源, 底稿
           scene-closeout §8.2.6 「落地低头脚下即徽」); axisBloom 逐行横纹
           (r=(z−z1)%4<2→13 石砖 else 4 圆石, 行相位款式同 farm-rows)。
           两者入 inlays 延后补记(嵌路面读法, 见 inlays 声明注) */
        if (s.emblem) {
          const EMBLEM = [[78, 17, 17, 78], [17, 78, 78, 17],
            [17, 78, 78, 17], [78, 17, 17, 78]];
          for (let ri = 0; ri < 4; ri++) {
            for (let ci = 0; ci < 4; ci++) {
              inlays.push({op: 'fill', x1: s.emblem.x1 + ci, y1: groundY,
                z1: s.emblem.z1 + ri, x2: s.emblem.x1 + ci, y2: groundY,
                z2: s.emblem.z1 + ri, id: EMBLEM[ri][ci]});
            }
          }
        }
        if (s.axisBloom) {
          for (let z = s.axisBloom.z1; z <= s.axisBloom.z2; z++) {
            inlays.push({op: 'fill', x1: s.axisBloom.x1, y1: groundY, z1: z,
              x2: s.axisBloom.x2, y2: groundY, z2: z,
              id: (z - s.axisBloom.z1) % 4 < 2 ? 13 : 4});
          }
        }
      } else if (s.kind === 'farm-rows') {
        /* 田垄(#4): 全域 41 沟底先铺, 再逐行条带覆写——行号 r=z-z1,
           周期 5: r%5===0 田埂 58 / 其余 42+(r%5)-1 作物轮转(42/43/44/45
           相位混排); 域四边 y+1 每 2 格 5 号围栏桩(x 侧含四角, z 侧
           自 z1+2 起步不重复)。作物=场景语义块(T-09 审计辖 prefab 段,
           ground 段场景叙事不注册旗标豁免); 走向锚定 x(条带按 z 切行) */
        ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: s.z1, x2: s.x2, y2: groundY,
          z2: s.z2, id: pal.ground.farm});
        for (let z = s.z1; z <= s.z2; z++) {
          const r = z - s.z1;
          const id = r % 5 === 0 ? pal.ground.fieldRidge : 42 + (r % 5) - 1;
          ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: z, x2: s.x2, y2: groundY,
            z2: z, id});
        }
        for (let x = s.x1; x <= s.x2; x += 2) {
          ops.push({op: 'fill', x1: x, y1: groundY + 1, z1: s.z1, x2: x,
            y2: groundY + 1, z2: s.z1, id: pal.ground.fieldFence});
          ops.push({op: 'fill', x1: x, y1: groundY + 1, z1: s.z2, x2: x,
            y2: groundY + 1, z2: s.z2, id: pal.ground.fieldFence});
        }
        for (let z = s.z1 + 2; z <= s.z2; z += 2) {
          ops.push({op: 'fill', x1: s.x1, y1: groundY + 1, z1: z, x2: s.x1,
            y2: groundY + 1, z2: z, id: pal.ground.fieldFence});
          ops.push({op: 'fill', x1: s.x2, y1: groundY + 1, z1: z, x2: s.x2,
            y2: groundY + 1, z2: z, id: pal.ground.fieldFence});
        }
        /* TIDEA-04 前半丰收角(波次二): harvest 域内非埂行(r=(z−s.z1)%5!==
           0, 与上行相位同源)整行覆 45 成熟小麦——埂行跳过保田垄肌理
           (风车侧 4×4 与周边青苗 42/43 成熟色差高潮, TOWN_MAP 条目注) */
        if (s.harvest) {
          for (let z = s.harvest.z1; z <= s.harvest.z2; z++) {
            if ((z - s.z1) % 5 === 0) continue;
            ops.push({op: 'fill', x1: s.harvest.x1, y1: groundY, z1: z,
              x2: s.harvest.x2, y2: groundY, z2: z, id: 45});
          }
        }
      } else if (s.kind === 'wayshrine') {
        /* 断头小坪(#6): 全域边环 4 先写+内缩一格 13 芯后写——条目须排
           在 road 段之后(steps 序即写序, 后写者赢才不被路体覆盖),
           既存信标灯柱归 scatter 条目(本件不管) */
        ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: s.z1, x2: s.x2, y2: groundY,
          z2: s.z2, id: pal.ground.shrineEdge});
        ops.push({op: 'fill', x1: s.x1 + 1, y1: groundY, z1: s.z1 + 1, x2: s.x2 - 1,
          y2: groundY, z2: s.z2 - 1, id: pal.ground.shrineCore});
      } else if (s.kind === 'town-rim') {
        /* 镇缘防坠墙圈(T2, spec §3.3 块级规格): 条目顶层无 x/z 域, segs
           显式分段清单=几何唯一权威, 按 part 逐段派生——pad/wall/post/
           wing/pier→seg 自身闭盒一笔石砖 13(pad 数据即单层 y1=y2);
           cap→seg 单格一笔石英 17(南角帽)。墙头花只从 wall 段派生(spec
           §3.3「每 8 格一簇」): 沿线坐标 ≡0 mod 8 且 ∈40..120 簇位带,
           落墙顶格(段顶+1, 真墙顶 26→27); 开口段无墙身=自然跳空(x80
           不布, 零特判), 翼墙/端头墩/接头柱段无花; 花色 ⌊(x+z)/8⌋ 偶
           61 奇 62 固定交替零盐(spec 拍板——x+z 奇偶在定 z 墙线恒同值
           不可用), 61/62 走 props.flowerCore 组单源(与散布花/花坛芯同
           语言)。纯几何零随机: 合成短段(簇位带外)=恰段笔本身零花。
           材质 13/17 为派生字面(场景功能件不入 palette——作物 42..45
           同款先例, 见 palette 注 Step H) */
        for (const seg of s.segs) {
          ops.push({op: 'fill', x1: seg.x1, y1: seg.y1, z1: seg.z1,
            x2: seg.x2, y2: seg.y2, z2: seg.z2,
            id: seg.part === 'cap' ? 17 : 13});
          if (seg.part !== 'wall') continue;
          const col = seg.x1 === seg.x2; /* 列墙(东西缘)沿线=z, 行墙(南缘)沿线=x */
          for (let x = seg.x1; x <= seg.x2; x++) {
            for (let z = seg.z1; z <= seg.z2; z++) {
              const along = col ? z : x;
              if (along % 8 !== 0 || along < 40 || along > 120) continue;
              ops.push({op: 'fill', x1: x, y1: seg.y2 + 1, z1: z,
                x2: x, y2: seg.y2 + 1, z2: z,
                id: Math.floor((x + z) / 8) % 2 === 0 ?
                  pal.props.flowerCore.y : pal.props.flowerCore.w});
            }
          }
        }
      } else {
        throw new Error('townAssemblyOps: ground 条目「' + s.id + '」kind 非法「' + s.kind +
          '」(合法域 plaza|farm|farm-rows|wayshrine|town-rim)');
      }
    } else if (s.phase === 'backdrop') {
      if (s.kind === 'mountain') {
        /* 拱形山体逐柱满覆盖+合脊(#7 五段弧形): 顶高沿二次拱形自两缘
           (落地=地表基高)升至脊线 topY, 列顶取 ridgeTop 预扫合脊(键
           (x,z): 同列同线多条目重叠域取 max, z 域不重叠条目各归各,
           单条目=自身行为不变); 每柱自 y0 满填(崖体无悬空), 柱内 z
           域按合脊顶连续段切 run——单条目常态单 run(逐柱单笔=旧 pin
           逐字节不动)。条目 bands 字段显式启用三段分色——基段
           y0..groundY-1 石 3 单笔不变, 表层 groundY..30 苔 14(南缘
           z27..28 两行草坡 1 过渡)/31..39 石 3/40..顶 雪 54, 空段跳笔;
           缺省(无 bands)全 3 单色逐柱单笔(旧 pin 逐字节不动) */
        /* 南缘攀登走廊(southCorridor 门控, PO 亲需②; lead 裁定中带,
           scene 探勘 6413b00): 值 {x1,x2}=台阶列域(数据化, 东带备胎
           西带死不焊死)。走廊列改 z 向阶梯——包络 h(z)=min(合脊顶(z),
           h(z+1)+1) 自南缘 groundY 起步北行, 构造性保证 ≤1 格步高
           (可攀), 北端自然接列顶平台(山肩); 两侧列维持整柱拱形=崖壁
           凹槽天然防护(引擎无摔伤机制, 女儿墙不设——儿童口径登记
           回执 §十二); 水花列不在域内=拱形原样, 瀑布域零写入保全
           (TIDEA-05)。缺字段字节级零变化(派生分支整体跳过); 非 bands
           拼写域抛错——单色派生无分段堆叠可切阶, 静默忽略会埋假
           阶梯(scene 拼错字段时立即红, 不落无效数据) */
        if (s.southCorridor && !s.bands) {
          throw new Error('townAssemblyOps: southCorridor 需 bands:true「' +
            s.id + '」(单色山体无包络可分阶)');
        }
        const corr = s.southCorridor;
        for (let x = s.x1; x <= s.x2; x++) {
          /* 走廊列: z 向阶梯拆线, 每线柱笔组(base+分段堆叠至 h)——
             南端 z2 贴地(起步 hPrev=groundY-1 → h=groundY 与镇草/裙
             板平接), 北行每线 ≤+1, h 收敛到合脊顶后维持=自然接顶 */
          if (corr && x >= corr.x1 && x <= corr.x2) {
            let hPrev = groundY - 1;
            for (let z = s.z2; z >= s.z1; z--) {
              const h = Math.min(ridgeTop[x * 64 + z], hPrev + 1);
              ops.push({op: 'fill', x1: x, y1: 0, z1: z, x2: x,
                y2: groundY - 1, z2: z, id: pal.backdrop.mountain});
              const seg2 = (yA, yB, id) => {
                if (yA <= yB) {
                  ops.push({op: 'fill', x1: x, y1: yA, z1: z,
                    x2: x, y2: yB, z2: z, id});
                }
              };
              seg2(groundY, Math.min(h, 30), pal.backdrop.mountainMoss);
              seg2(31, Math.min(h, 39), pal.backdrop.mountain);
              seg2(40, h, pal.backdrop.mountainSnow);
              hPrev = h;
            }
            continue;
          }
          /* 合脊 run 切分: 柱内 z 域按合脊顶连续段分组——单条目常态
             全柱单 run(=旧逐柱单笔逐字节不动), 重叠域拆 run 各顶各笔 */
          const runs = [{z1: s.z1, z2: s.z1, top: ridgeTop[x * 64 + s.z1]}];
          for (let z = s.z1 + 1; z <= s.z2; z++) {
            const t = ridgeTop[x * 64 + z];
            const last = runs[runs.length - 1];
            if (t === last.top) last.z2 = z;
            else runs.push({z1: z, z2: z, top: t});
          }
          for (const r of runs) {
            const top = r.top;
            if (!s.bands) {
              ops.push({op: 'fill', x1: x, y1: 0, z1: r.z1, x2: x, y2: top,
                z2: r.z2, id: pal.backdrop.mountain});
              continue;
            }
            ops.push({op: 'fill', x1: x, y1: 0, z1: r.z1, x2: x,
              y2: groundY - 1, z2: r.z2, id: pal.backdrop.mountain});
            const seg = (yA, yB, zA, zB, id) => {
              if (yA > yB || zA > zB) return;
              ops.push({op: 'fill', x1: x, y1: yA, z1: zA, x2: x, y2: yB, z2: zB, id});
            };
            const sZ1 = Math.max(r.z1, 27); const sZ2 = Math.min(r.z2, 28);
            const midTop = Math.min(top, 30);
            seg(groundY, midTop, r.z1, sZ1 - 1, pal.backdrop.mountainMoss);
            seg(groundY, midTop, sZ1, sZ2, pal.backdrop.mountainGrass);
            seg(groundY, midTop, sZ2 + 1, r.z2, pal.backdrop.mountainMoss);
            seg(31, Math.min(top, 39), r.z1, r.z2, pal.backdrop.mountain);
            seg(40, top, r.z1, r.z2, pal.backdrop.mountainSnow);
          }
        }
        /* TIDEA-05 瀑布白线(波次二): 列域南缘薄片 54 雪(顶接雪带下缘 y40,
           底 y25 山脚)+两翼石英水花——贴面不穿山, 山体北面剪影不被涂白
           (派生契约 scene-closeout §8.2.5) */
        if (s.waterfall) {
          ops.push({op: 'fill', x1: s.waterfall.x1, y1: 25, z1: 24,
            x2: s.waterfall.x2, y2: 39, z2: 28, id: pal.backdrop.mountainSnow});
          ops.push({op: 'fill', x1: s.waterfall.x1 - 1, y1: 25, z1: 26,
            x2: s.waterfall.x1 - 1, y2: 26, z2: 26, id: pal.backdrop.cliffFrame});
          ops.push({op: 'fill', x1: s.waterfall.x2 + 1, y1: 25, z1: 26,
            x2: s.waterfall.x2 + 1, y2: 26, z2: 26, id: pal.backdrop.cliffFrame});
        }
      } else if (s.kind === 'cliff-home') {
        if (s.style === 'v2') {
          /* 崖顶房屋 v2 造型(#8, style 字段显式启用; 缺省 legacy=旧
             3×3×6 单盒 pin 逐字节不动): 白墙 52 主体+石英角柱 17 四根+
             窗 18 四脸中格(baseY+2 层, 十字两笔, 后写覆墙不撞角柱)+
             橙顶 9 双层阶梯(顶盖 3×3+内缩芯)+顶缘灯点 19×2(x±1)。
             baseY/topY 数据差恒 6 不变, v2 总高 7(顶缘层) */
          const wallTop = s.topY - 2;
          ops.push({op: 'fill', x1: s.x - 1, y1: s.baseY, z1: s.z - 1,
            x2: s.x + 1, y2: wallTop, z2: s.z + 1, id: pal.backdrop.cliffWall});
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            ops.push({op: 'fill', x1: s.x + px, y1: s.baseY, z1: s.z + pz,
              x2: s.x + px, y2: wallTop, z2: s.z + pz, id: pal.backdrop.cliffFrame});
          }
          ops.push({op: 'fill', x1: s.x - 1, y1: s.baseY + 2, z1: s.z,
            x2: s.x + 1, y2: s.baseY + 2, z2: s.z, id: pal.backdrop.cliffWindow});
          ops.push({op: 'fill', x1: s.x, y1: s.baseY + 2, z1: s.z - 1,
            x2: s.x, y2: s.baseY + 2, z2: s.z + 1, id: pal.backdrop.cliffWindow});
          ops.push({op: 'fill', x1: s.x - 1, y1: s.topY - 1, z1: s.z - 1,
            x2: s.x + 1, y2: s.topY - 1, z2: s.z + 1, id: pal.backdrop.cliffRoof});
          ops.push({op: 'fill', x1: s.x, y1: s.topY, z1: s.z, x2: s.x,
            y2: s.topY, z2: s.z, id: pal.backdrop.cliffRoof});
          ops.push({op: 'fill', x1: s.x - 1, y1: s.topY, z1: s.z,
            x2: s.x + 1, y2: s.topY, z2: s.z, id: pal.backdrop.cliffLamp});
        } else {
          /* 崖顶房屋 legacy: 锚(中心 x/z)±1 的 3×3×6 盒(baseY..topY-1,
             数据 baseY/topY 差恒 6), 坐山体肩部 */
          ops.push({op: 'fill', x1: s.x - 1, y1: s.baseY, z1: s.z - 1,
            x2: s.x + 1, y2: s.topY - 1, z2: s.z + 1, id: pal.backdrop.cliffHome});
        }
      } else if (s.kind === 'scrub') {
        /* 山脚矮丛(#7): 域 z26..31 出核心区散布断言辖域, 落 backdrop
           段同款确定性盐(op 同 scatter.scrub; top=脚下表面格) */
        ops.push({op: 'scrub', x: s.x, top: s.y, z: s.z, salt: s.x * 131 + s.z});
      } else if (s.kind === 'boulder') {
        /* 山脚苔石点(#7): 单格 14 于表面格上一格 */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 1,
          z2: s.z, id: pal.backdrop.boulder});
      } else {
        throw new Error('townAssemblyOps: backdrop 条目「' + s.id + '」kind 非法「' + s.kind +
          '」(合法域 mountain|cliff-home|scrub|boulder)');
      }
    } else if (s.phase === 'road') {
      const id = s.kind === 'main' ? pal.road.main :
        s.kind === 'lane' ? pal.road.lane : null;
      if (!id) {
        throw new Error('townAssemblyOps: road 条目「' + s.id + '」kind 非法「' + s.kind +
          '」(合法域 main|lane)');
      }
      ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: s.z1, x2: s.x2, y2: groundY, z2: s.z2, id});
      if (s.curb) {
        /* 缘石带(#5, 条目 curb 字段显式启用): 路体后写两侧外扩一格
           同层细条——长轴判走向(|dx|>=|dz| 沿 x, 两侧=z1-1/z2+1; 否则
           沿 z, 两侧=x1-1/x2+1); main 用 curb 13/lane 用 curbLane 4。
           外扩格越域/撞邻归 scene 切清单避让(本件纯派生不管避让) */
        const cid = s.kind === 'main' ? pal.road.curb : pal.road.curbLane;
        const alongX = (s.x2 - s.x1) >= (s.z2 - s.z1);
        if (alongX) {
          ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: s.z1 - 1, x2: s.x2,
            y2: groundY, z2: s.z1 - 1, id: cid});
          ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: s.z2 + 1, x2: s.x2,
            y2: groundY, z2: s.z2 + 1, id: cid});
        } else {
          ops.push({op: 'fill', x1: s.x1 - 1, y1: groundY, z1: s.z1, x2: s.x1 - 1,
            y2: groundY, z2: s.z2, id: cid});
          ops.push({op: 'fill', x1: s.x2 + 1, y1: groundY, z1: s.z1, x2: s.x2 + 1,
            y2: groundY, z2: s.z2, id: cid});
        }
      }
    } else if (s.phase === 'prefab') {
      /* 建筑件: face 在条目顶层(不在 v 内), ids 集中注入——v/ids 一律新
         对象(op 消费方改写不反渗源清单与 palette 单源)。
         波次二: 顶层 tidea 命名空间键(全链静默, §8.2.2 教训)→porchLamp
         v 注入(pfMerge 白名单已在 prefab 面合法化)+groundMark 四笔 fill
         (世界系直加, y=groundY); v.sailStatic===false(严格判据, undefined
         =静态无 op)→spinner op 替代 place(place 双胞胎——dims spinner
         case 塔体+叶片 mesh 双消费), period 顶层钩穿透(可选, 秒) */
      const row = pal.prefab[s.id];
      if (!row) {
        throw new Error('townAssemblyOps: prefab 实例「' + s.id + '」缺 palette 材质映射' +
          '(TOWN_PALETTE.prefab 是唯一权威)');
      }
      const v = Object.assign({}, s.v, {face: s.face, ids: Object.assign({}, row)});
      if (s.tidea && s.tidea.porchLamp) v.porchLamp = true;
      ops.push(s.v && s.v.sailStatic === false ?
        {op: 'spinner', id: s.id, x: s.x, y: s.y, z: s.z, v, period: s.period} :
        {op: 'place', id: s.id, x: s.x, y: s.y, z: s.z, v});
      if (s.tidea && s.tidea.groundMark) {
        for (const t of s.tidea.groundMark.tiles) {
          ops.push({op: 'fill', x1: s.x + t.dx, y1: groundY, z1: s.z + t.dz,
            x2: s.x + t.dx, y2: groundY, z2: s.z + t.dz, id: s.tidea.groundMark.id});
        }
      }
    } else if (s.phase === 'scatter') {
      if (s.kind === 'sakura') {
        /* 樱花 = 树家族 op + 覆写 op 两笔: 树几何单源引擎(SceneKit.tree,
           干基=散布点 y+1); recolor 盒覆两型干高冠域(叶层 top-2..top,
           top=y+1+{4,5} → [y+3, y+6]), 7→樱粉覆写落调用方(map-design §5.4) */
        ops.push({op: 'tree', x: s.x, y: s.y, z: s.z});
        ops.push({op: 'recolor', x1: s.x - 2, y1: s.y + 3, z1: s.z - 2, x2: s.x + 2, y2: s.y + 6,
          z2: s.z + 2, from: 7, to: pal.tree.sakuraLeaf});
      } else if (s.kind === 'scrub') {
        /* 矮丛带确定性盐(同参同丛, SceneKit.scrub 契约): top=脚下表面格 */
        ops.push({op: 'scrub', x: s.x, top: s.y, z: s.z, salt: s.x * 131 + s.z});
      } else if (s.kind === 'lamp') {
        /* 灯柱三笔(视觉重制 §3 M props 升级): 石英座 1+深木柱 3+灯头 1,
           总高 5(props palette 单源)——座收底盘、柱修长、灯头悬浮顶 */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 1, z2: s.z,
          id: pal.props.lampBase});
        ops.push({op: 'fill', x1: s.x, y1: s.y + 2, z1: s.z, x2: s.x, y2: s.y + 4, z2: s.z,
          id: pal.props.lampPost});
        ops.push({op: 'fill', x1: s.x, y1: s.y + 5, z1: s.z, x2: s.x, y2: s.y + 5, z2: s.z,
          id: pal.props.lampLight});
      } else if (s.kind === 'signpost') {
        /* 路标=柱2+牌1 两笔 fill */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 2, z2: s.z,
          id: pal.props.signPost});
        ops.push({op: 'fill', x1: s.x, y1: s.y + 3, z1: s.z, x2: s.x, y2: s.y + 3, z2: s.z,
          id: pal.props.signBoard});
      } else if (s.kind === 'tuft') {
        /* 草丛散布点(#1): 单格 40 于表面格上一格。定点枚举(域+步距+
           hashRand)归 scene 切清单——本件只收单点条目(零依赖红线:
           散布确定性走引擎函数, 规划器不掷点), 新散布 kind 同口径 */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 1,
          z2: s.z, id: pal.props.tuft});
      } else if (s.kind === 'flower') {
        /* 花散布点(#2): 单格 61/62, v.tone 选键(缺省 y=蒲公英 61,
           w=雏菊 62)——与花坛芯共用 flowerCore 组(语义同为花, 单源) */
        const tone = s.v && s.v.tone === 'w';
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 1,
          z2: s.z, id: tone ? pal.props.flowerCore.w : pal.props.flowerCore.y});
      } else if (s.kind === 'flag') {
        /* 旗(#3): 柱 2 高 5+旗面 1 块(杆顶 y+3, 读作旗杆顶旗), v.cloth
           四色选键(缺省 sakura 樱粉)——钟塔脚四角各一, 色即方位叙事 */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 2,
          z2: s.z, id: pal.props.flagPole});
        ops.push({op: 'fill', x1: s.x, y1: s.y + 3, z1: s.z, x2: s.x, y2: s.y + 3,
          z2: s.z, id: pal.props.flagCloth[(s.v && s.v.cloth) || 'sakura']});
      } else if (s.kind === 'flowerbed') {
        /* 花坛(#10): y+1 层 3×3——边环 8 格 40 草丛围+中央花芯 v.tone
           选键(61/62)。确定性落点(广场角/建筑门前)归 scene 切清单 */
        ops.push({op: 'fill', x1: s.x - 1, y1: s.y + 1, z1: s.z - 1, x2: s.x + 1,
          y2: s.y + 1, z2: s.z + 1, id: pal.props.flowerbedRing});
        const btone = s.v && s.v.tone === 'w';
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 1,
          z2: s.z, id: btone ? pal.props.flowerCore.w : pal.props.flowerCore.y});
      } else if (s.kind === 'barrel') {
        /* 木桶(#10): 单格 5 于表面格上一格 */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 1,
          z2: s.z, id: pal.props.barrel});
      } else if (s.kind === 'pumpkin') {
        /* 南瓜(#10): 单格 76 于表面格上一格 */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x, y2: s.y + 1,
          z2: s.z, id: pal.props.pumpkin});
      } else if (s.kind === 'wallflag') {
        /* 店旗列(TIDEA-03/W-03 ①, 素墙立面三笔之一): 竖排旗幡 len 格
           (v.len 钳 2..6 缺省 4, 数值域→钳口径同 pfMerge), y+1 起逐格
           单笔 fill, 色 flagCloth 三色 i%3 轮转(78 樱粉/15 蓝/17 奶油,
           与钟塔脚旗阵同语言; red 16 不入立面轮转) */
        let n = Math.floor(Number(s.v && s.v.len));
        if (!Number.isFinite(n)) n = 4;
        n = Math.max(2, Math.min(6, n));
        for (let i = 0; i < n; i++) {
          ops.push({op: 'fill', x1: s.x, y1: s.y + 1 + i, z1: s.z,
            x2: s.x, y2: s.y + 1 + i, z2: s.z,
            id: pal.props.flagCloth[['sakura', 'blue', 'quartz'][i % 3]]});
        }
      } else if (s.kind === 'windowbox') {
        /* 花窗箱(TIDEA-03/W-03 ②, 素墙立面三笔之二): 箱 plank 2 宽
           (y+1)+花 61/62 各一(y+2, 走 flowerCore 组单源, 与墙根花坛
           同语言)+窗玻璃板 2 宽×2 高(y+3..y+4)——临广场空白窗台的
           檐下立面向, 全 8 格 */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x + 1,
          y2: s.y + 1, z2: s.z, id: pal.props.plank});
        ops.push({op: 'fill', x1: s.x, y1: s.y + 2, z1: s.z, x2: s.x,
          y2: s.y + 2, z2: s.z, id: pal.props.flowerCore.y});
        ops.push({op: 'fill', x1: s.x + 1, y1: s.y + 2, z1: s.z, x2: s.x + 1,
          y2: s.y + 2, z2: s.z, id: pal.props.flowerCore.w});
        ops.push({op: 'fill', x1: s.x, y1: s.y + 3, z1: s.z, x2: s.x + 1,
          y2: s.y + 4, z2: s.z, id: pal.props.glassPane});
      } else if (s.kind === 'crates') {
        /* 桶箱角(TIDEA-03/W-03 ③, 素墙立面三笔之三): 桶 5 双高(x 列)+
           箱 51 双高(x+1 列), 各 y+1..y+2——墙角桶箱簇, stash 门前
           桶堆同语言 */
        ops.push({op: 'fill', x1: s.x, y1: s.y + 1, z1: s.z, x2: s.x,
          y2: s.y + 2, z2: s.z, id: pal.props.barrel});
        ops.push({op: 'fill', x1: s.x + 1, y1: s.y + 1, z1: s.z, x2: s.x + 1,
          y2: s.y + 2, z2: s.z, id: pal.props.crateBox});
      } else {
        throw new Error('townAssemblyOps: scatter 条目「' + s.id + '」kind 非法「' + s.kind +
          '」(合法域 sakura|scrub|lamp|signpost|tuft|flower|flag|flowerbed|' +
          'barrel|pumpkin|wallflag|windowbox|crates)');
      }
    } else if (s.phase !== 'anchor') {
      /* anchor 段零 op(出生归模式层恰一次); 其余未知 phase 抛拼写域错误 */
      throw new Error('townAssemblyOps: 未知 phase「' + s.phase + '」(合法域 ground|backdrop|' +
        'road|prefab|scatter|anchor)');
    }
  }
  /* 路面嵌花补记(emblem/axisBloom 延后于全 steps——road 相位后写不再覆埋) */
  ops.push(...inlays);
  return ops;
}
