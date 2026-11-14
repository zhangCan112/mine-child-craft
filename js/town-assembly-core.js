'use strict';
/* ============================================================
   城镇装配纯核心 (TownAssemblyCore) — 应用层·纯核心
   ------------------------------------------------------------
   一句话职责: 把 TownMapCore 的建场步骤表规划成一张确定性 op 列表
   (纯计划, 不碰世界), 连同 TOWN_PALETTE 城镇配色映射一起, 藏住全部
   材质拍板与几何派生; 执行器只按 op 词表逐条落地。
   interface: 全局 TOWN_PALETTE 七段配色映射(prefab 八行集中注入材质 ·
     terrain 基底三层 · ground 铺装 · road 路网 · backdrop 远景 ·
     props 道具 · tree 植被, 值全为 config.js BLOCKS 在册正整数 id) ·
     纯函数 townAssemblyOps(steps) → op 列表(词表封闭 {fill,tree,scrub,
     recolor,place}): 基底三层垫底(序列最前=后写者赢的显式见证)后按
     steps 相对次序派生——ground/backdrop/road 段出 fill, prefab 段出
     place(face/ids 注入一律新对象, 源清单只读), scatter 段出
     tree+recolor(樱花 7→78 覆写落调用方)/scrub(确定性盐)/灯柱路标
     fill, anchor 段零 op(出生归模式层恰一次)。
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
   T-09 审计按槽名豁免 thin/replaceable(door/doorTop 槽名豁免先例)。 */
const TOWN_PALETTE = {
  prefab: {
    'tower-belfry': {base: 13, wall: 17, pillar: 5, trim: 5, roof: 9, bell: 19,
      window: 68, flag: 78, door: 64, doorTop: 65},
    'shop-awning': {base: 13, wall: 6, plaster: 17, trim: 5, roof: 9,
      awning: 15, awningTrim: 17, signBg: 76, signAccent: 17, glow: 19, window: 68},
    'windmill-tower': {base: 13, wall: 17, roof: 9, trim: 5, blade: 6, axle: 76, accent: 17},
    'cottage-gable': {base: 13, wall: 6, trim: 5, frame: 17, roof: 9, window: 18,
      door: 64, doorTop: 65, chimney: 4,
      bedGrass: 40, bedFlower1: 61, bedFlower2: 62},
    'house-loft': {base: 13, wallA: 6, wallB: 17, roof: 9, trim: 5, window: 18,
      frame: 17, door: 64, doorTop: 65, balcony: 5, awning: 15},
    'stash-hut': {base: 3, wall: 6, roof: 5, trim: 5, door: 6, metalAccent: 12},
    'under-room': {chest: 51, torch: 48, cap: 8, land: 58},
    'stall-canopy': {frame: 5, counter: 6, goods: 38},
  },
  terrain: {deep: 3, filler: 2, surface: 1},
  ground: {plaza: 17, farm: 41, plazaBand: 58},
  road: {main: 13, lane: 4, curb: 13},
  backdrop: {mountain: 3, cliffHome: 6},
  props: {lampBase: 17, lampPost: 5, lampLight: 19, signPost: 5, signBoard: 6},
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
  /* 基底三层垫底(序列最前三笔): deep 0..groundY-4 石 / filler 泥 /
     surface groundY 草——后写者赢, 广场/路网/建筑压得住草地。 */
  ops.push({op: 'fill', x1: core.x1, y1: 0, z1: core.z1, x2: core.x2, y2: groundY - 4, z2: core.z2,
    id: pal.terrain.deep});
  ops.push({op: 'fill', x1: core.x1, y1: groundY - 3, z1: core.z1, x2: core.x2, y2: groundY - 1, z2: core.z2,
    id: pal.terrain.filler});
  ops.push({op: 'fill', x1: core.x1, y1: groundY, z1: core.z1, x2: core.x2, y2: groundY, z2: core.z2,
    id: pal.terrain.surface});
  for (const s of steps) {
    if (s.phase === 'ground') {
      /* 地表铺装: ground/road 类条目无 y 字段, 一律取 core.groundY(地表基高) */
      const id = s.kind === 'plaza' ? pal.ground.plaza :
        s.kind === 'farm' ? pal.ground.farm : null;
      if (!id) {
        throw new Error('townAssemblyOps: ground 条目「' + s.id + '」kind 非法「' + s.kind +
          '」(合法域 plaza|farm)');
      }
      ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: s.z1, x2: s.x2, y2: groundY, z2: s.z2, id});
    } else if (s.phase === 'backdrop') {
      if (s.kind === 'mountain') {
        /* 拱形山体逐柱满覆盖: 顶高沿二次拱形自两缘(落地=地表基高)升至
           脊线 topY, 双中心列同高(压钟塔 38); 每柱自 y0 满填(崖体无悬空) */
        const cx = (s.x1 + s.x2) / 2;
        const half = (s.x2 - s.x1) / 2;
        for (let x = s.x1; x <= s.x2; x++) {
          const t = (x - cx) / half;
          const top = Math.round(s.topY * (1 - t * t) + groundY * (t * t));
          ops.push({op: 'fill', x1: x, y1: 0, z1: s.z1, x2: x, y2: top, z2: s.z2,
            id: pal.backdrop.mountain});
        }
      } else if (s.kind === 'cliff-home') {
        /* 崖顶房屋: 锚(中心 x/z)±1 的 3×3×6 盒(baseY..topY-1, 数据
           baseY/topY 差恒 6), 坐山体肩部 */
        ops.push({op: 'fill', x1: s.x - 1, y1: s.baseY, z1: s.z - 1, x2: s.x + 1, y2: s.topY - 1,
          z2: s.z + 1, id: pal.backdrop.cliffHome});
      } else {
        throw new Error('townAssemblyOps: backdrop 条目「' + s.id + '」kind 非法「' + s.kind +
          '」(合法域 mountain|cliff-home)');
      }
    } else if (s.phase === 'road') {
      const id = s.kind === 'main' ? pal.road.main :
        s.kind === 'lane' ? pal.road.lane : null;
      if (!id) {
        throw new Error('townAssemblyOps: road 条目「' + s.id + '」kind 非法「' + s.kind +
          '」(合法域 main|lane)');
      }
      ops.push({op: 'fill', x1: s.x1, y1: groundY, z1: s.z1, x2: s.x2, y2: groundY, z2: s.z2, id});
    } else if (s.phase === 'prefab') {
      /* 建筑件: face 在条目顶层(不在 v 内), ids 集中注入——v/ids 一律新
         对象(op 消费方改写不反渗源清单与 palette 单源) */
      const row = pal.prefab[s.id];
      if (!row) {
        throw new Error('townAssemblyOps: prefab 实例「' + s.id + '」缺 palette 材质映射' +
          '(TOWN_PALETTE.prefab 是唯一权威)');
      }
      const v = Object.assign({}, s.v, {face: s.face, ids: Object.assign({}, row)});
      ops.push({op: 'place', id: s.id, x: s.x, y: s.y, z: s.z, v});
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
      } else {
        throw new Error('townAssemblyOps: scatter 条目「' + s.id + '」kind 非法「' + s.kind +
          '」(合法域 sakura|scrub|lamp|signpost)');
      }
    } else if (s.phase !== 'anchor') {
      /* anchor 段零 op(出生归模式层恰一次); 其余未知 phase 抛拼写域错误 */
      throw new Error('townAssemblyOps: 未知 phase「' + s.phase + '」(合法域 ground|backdrop|' +
        'road|prefab|scatter|anchor)');
    }
  }
  return ops;
}
