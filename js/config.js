'use strict';
/* ============================================================
   配置与方块注册表
   (怪物四表 MOB_TYPES/FAMILIES/PROTOS/MOB_DROPS 已拆往 js/mob-registry.js,
   2026-10 架构治理候选 8 — 怪物种类清单唯一权威, -registry 契约)
============================================================ */
const CHUNK = 16;
const NCX = 8; const NCZ = 8;
const WORLD_W = NCX * CHUNK;
const WORLD_D = NCZ * CHUNK;
const WORLD_H = 48;

/* 触屏环境检测(全游戏唯一口径): 输入路由 / 音效配平 / 渲染降载共用
   — 以前 isTouch/sfxTouch/_coarse 三处各测一次且口径不一, 统一于此
   ?touch=1 是桌面浏览器的强制预览口(调触屏布局用): 摇杆/按钮/手势
   全套照常渲染, 且鼠标可当手指驱动(input.js 手势路由不滤鼠标) */
const IS_TOUCH = (()=>{
  try {
    const forced = (location.search || '').includes('touch=1');
    return forced || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  } catch (e) {
    return false;
  }
})();

const PLAYER = {
  hx: 0.3, hz: 0.3, height: 1.8, eye: 1.62,
  speed: 5.0, sprint: 8.5, jump: 8.6, gravity: 26.0,
  flyVert: 7.0, // 飞行模式垂直速度(格/秒)
  fallCap: -30, // 坠落限速(格/秒, 防高坠穿薄板)
  substep: 0.25, // 移动/驾驶的轴向子步长(格, 防高速跨过碰撞判定)
  voidY: -12, // 坠出世界判定线(引擎只报事件, 处理归应用层)
  reach: 6, // 玩家触达/瞄准距离(格)
  heldItem: 'hoe', // 默认手持物(HeldItems.defs 的键; main.js 组合根装配)
  autoJump: IS_TOUCH, // 自动跳(MC 基岩版触屏默认开): 贴地行走撞 1 格台阶自动起跳, 免去跳跃键依赖
};

/* 第三人称相机 (CameraRig 用, 见 js/camera-rig.js) */
const CAM = {
  dist: 3.2, // 轨道距离(格): 相机离眼睛多远
  shoulder: 0.55, // 越肩横移: 相机向人物右肩偏移, 人物落画面左侧, 准心不被挡
  lift: 0.18, // 越肩抬升: 相机沿视线上方轻微抬高
  minDist: 0.35, // 防穿墙收拢下限(贴墙时最近)
  margin: 0.28, // 相机与命中面的留白
  hideDist: 0.9, // 收拢近于此 → 隐藏玩家形象(头不再挡画面)
};

/* 单消费者常量已归位: ARENA/HOTBAR(竞技场) · TANK_VS_MOBS
   (坦克演习场) — 政策常量属应用层, 不在引擎共享命名空间里放着( ambient 可见
   会诱惑跨层乱读); 引擎真正的共享注册表只剩: 世界尺寸/PLAYER/CAM/VIEW/BLOCKS/
   TANK/TANK_MODELS/IS_TOUCH/faceColor — 怪物四表(MOB_TYPES/FAMILIES/PROTOS/
   MOB_DROPS)已迁往 js/mob-registry.js(-registry 契约, 2026-10 候选 8) */

/* ---------- 远景与距离环 (world.js 渲染 adapter 用) ----------
   雾即渲染边界(Minecraft 官方同款语义: render distance 别名 fog):
   far 只需略过雾终点即可。距离环两层(调研见
   docs/chunk-streaming-lod-research.md §7):
   ≤fullChunks 全细节实时构建 · fullChunks~lodChunks 降采样粗网格
   (每 lodStep×lodStep 列合并采样, 成本 ~1/lodStep²) · 更远卸载(GPU
   释放, 数据保留, 走近重建)。当前 8×8 图上远角才进 LOD 环; 地图
   调大(NCX/NCZ)后环自动生效, GPU 对象数按环面积封顶。 */
const VIEW = {
  fogNear: 90, fogFar: 230, far: 240,
  fullChunks: 8, // 全细节环半径(区块)
  lodChunks: 15, // LOD 环半径(区块; ×16 格 ≈ 雾终点)
  lodStep: 2, // LOD 采样步长(格/边; 须整除 CHUNK=16, 否则回落 2)
  dispatch: 8, // Worker 每帧派发上限(派发只含打包+postMessage, 帧成本极低; 同步兜底预算由 pumpRemesh 入参)
};

/* TNT 贴图图集竖排格数(含 0 号 mipmap 缓冲垫): 画布高/tileV 编号/UV
   除数三处共用(world.js 画布与 MeshCore UV 各读一次, 单一来源) */
const TNT_TILES = 4;

/* ---------- 液体参数表 (docs/liquid-design.md D3, 调研 docs/mc-liquid-research.md §3.1) ----------
   每种流体一行, MC 参数表直抄: ticks 计划刻延迟(游戏刻) · dropOff 每格水量
   衰减 · maxEmpty 停流水位(到 7/6 不再外铺) · slopeSteps 坡向找洞搜索步数 ·
   regen 源再生(水可=MC 默认口径, 岩浆不可)。岩浆全球一套主世界参数,
   下界加速不移植(设计稿附录 B #33)。 */
const FLUIDS = {
  water: {ticks: 5, dropOff: 1, maxEmpty: 7, slopeSteps: 4, regen: true},
  lava: {ticks: 30, dropOff: 2, maxEmpty: 6, slopeSteps: 2, regen: false},
};
/* 液体全局段: 模拟预算与玩家物理数值(D9/D10)——budgetCells 每帧流体步进
   格数上限 · settleCap 装场激活结算上限 · tickHz 游戏刻频率(排程序时间基,
   与墙钟解耦=确定性) · pushSpeed 水流推力(MC 1.39 格/秒) · swim/sink/lava
   物理乘数 · airMaxS 气泡秒数(MC 15s) · drown/lava 伤害口径(MC 2/秒 · 4/0.5s) */
const FLUID = {
  budgetCells: 128, settleCap: 200000, tickHz: 20,
  pushSpeed: 1.39, swimMult: 0.55, sinkSpeed: 1.6, swimUp: 3.2, gravMul: 0.4,
  lavaMult: 0.5, lavaVert: 0.8, lavaSink: 1.2, lavaRise: 1.6,
  airMaxS: 15, drownDps: 2, lavaDps: 4, lavaTickS: 0.5, renderDiv: 9,
};


/* 坦克载具参数 (tank-core/tank.js 用, 见 js/tank-core.js) */
const TANK = {
  hw: 0.95, height: 1.4, // 碰撞半宽/高(格): 可进 2 格高空间, 过不了 2 格宽窄门
  speed: 7.0, reverse: 3.5, // 前进/倒车极速(格/秒)
  accel: 6.0, friction: 4.0, // 加速/滑行摩擦(指数逼近速率)
  turnRate: 1.9, // 车体转向速率上限(弧度/秒), 亦为 A/D 集成速率(pad 试玩反馈: 1.6 偏慢 → 提速)
  promptR: 2.5, enterR: 3.0, // 上车提示/上车判定半径(格): 走近才提示, 稍远一点仍可上
  shellSpeed: 40.0, // 炮弹初速(格/秒)
  shellG: 4.0, // 炮弹重力(远轻于实体, 弹道近乎平直)
  shellLife: 5.0, // 炮弹超程自毁(秒) → 理论射程 200 格(全图对角线以内)
  shellR: 2.2, // 爆炸破坏半径(格)
  reload: 1.25, // 装填冷却(秒)
};
/* 载具相机 (CameraRig.mount 用, 见 js/camera-rig.js) */
const CAM_TANK = {dist: 6.5, lift: 1.6, eye: 1.8};

/* ---------- 坦克型号注册表 (TANK_MODELS, tank.js 建模 / tank-range 选车页用) ----------
   每款: name 选车页名 · desc 一句话卖点 · perf 性能(键同 TANK, 缺键回落 TANK 基线,
   由 TankCore 逐键解析) · muzzle 出膛点(f 车体系前伸 / y 离地高) ·
   shell 炮弹观感(color 弹体 / glow 自发光 / size 缩放 / stretch 纵向拉伸 /
   trail 曳光 / boom 爆风色)。可选: salvo 一次点射弹数(横向错位+散布),
   homing 追踪转向速率(弧度/秒, "谁是敌人"由模式层经 Tank.targeter 注入)。
   伤害统一走 TANK_VS_MOBS(对每款都公平, 差异只在开起来/看起来)。 */
const TANK_MODELS = {
  classic: {
    key: 'classic', order: 1, // order: 选车页排列序(老兵 → 快枪 → 重炮 → 猛将 → 科技 → 旗舰压轴)
    name: '迷彩战车', desc: '均衡可靠的绿林老兵<br>样样都在行',
    perf: {speed: 7.0, reverse: 3.5, accel: 6.0, turnRate: 1.9, reload: 1.25,
      shellSpeed: 40, shellG: 4.0, shellLife: 5.0, shellR: 2.2},
    muzzle: {f: 1.9, y: 1.32},
    shell: {color: 0x23262b, glow: 0x000000, size: 1.0, trail: 0xffc36b, boom: 0xffd9a0},
  },
  desert: {
    key: 'desert', order: 2, name: '沙漠之鹰', desc: '跑得最快 · 装填最快的<br>黄沙速射猎手',
    perf: {speed: 8.6, reverse: 4.2, accel: 7.5, turnRate: 2.2, reload: 0.9,
      shellSpeed: 44, shellG: 4.0, shellLife: 5.0, shellR: 1.9},
    muzzle: {f: 2.3, y: 1.28},
    shell: {color: 0xd9b23c, glow: 0x6b5210, size: 0.9, trail: 0xffe9a0, boom: 0xffe2a8},
  },
  frost: {
    key: 'frost', order: 3, name: '极地冰狼', desc: '冰原重装巨兽 · 炮弹<br>威力圈特别大',
    perf: {speed: 6.0, reverse: 3.0, accel: 5.0, turnRate: 1.6, reload: 1.6,
      shellSpeed: 36, shellG: 4.5, shellLife: 5.0, shellR: 2.9},
    muzzle: {f: 1.9, y: 1.66},
    shell: {color: 0xbfe8ff, glow: 0x2e7fa8, size: 1.35, trail: 0xd8f4ff, boom: 0xcfeeff},
  },
  magma: {
    key: 'magma', order: 4, name: '熔岩勇士', desc: '火山里开出来的黑甲猛将<br>会喷熔岩火球',
    perf: {speed: 6.6, reverse: 3.2, accel: 5.5, turnRate: 1.8, reload: 1.45,
      shellSpeed: 38, shellG: 4.0, shellLife: 5.0, shellR: 2.7},
    muzzle: {f: 2.05, y: 1.56},
    shell: {color: 0xff7a2a, glow: 0xbb3d00, size: 1.25, trail: 0xff9a4d, boom: 0xff8a3d},
  },
  thunder: {
    key: 'thunder', order: 5, name: '雷霆战神', desc: '未来科技电光战神<br>闪电环炮 · 命中处天降落雷',
    perf: {speed: 7.6, reverse: 3.8, accel: 7.0, turnRate: 2.4, reload: 0.8,
      shellSpeed: 48, shellG: 2.6, shellLife: 5.0, shellR: 2.0},
    muzzle: {f: 2.25, y: 1.36},
    shell: {color: 0x66ecff, glow: 0x0e7f96, size: 1.1, trail: 0x9fe8ff, boom: 0x7deaff,
      fx: 'lightning'}, // 闪电弹: 环形弹体 + 电弧曳光 + 命中落雷(tank.js/Fx 解读)
  },
  tingyu: {
    key: 'tingyu', order: 6, name: '张廷彧号', desc: 'TNT 迷彩涂装 · 苦力怕车长<br>四联追踪导弹 · 爆炸小巧精准',
    perf: {speed: 7.2, reverse: 3.6, accel: 6.5, turnRate: 2.1, reload: 1.9,
      shellSpeed: 34, shellG: 1.2, shellLife: 6.0, shellR: 1.1},
    muzzle: {f: 1.35, y: 1.62},
    shell: {color: 0xe04838, glow: 0x7a1c10, size: 0.8, stretch: 1.7, trail: 0xffb040, boom: 0xffd9a0},
    salvo: 4, // 一次点射 4 枚(横向队列弹出, 各自散布)
    homing: 3.4, // 追踪转向速率(弧度/秒): 引擎只管转向, "谁是敌人"归模式层
  },
};

/* ---------- 怪物数值表/谱系两维表/掉落表(MOB_TYPES/FAMILIES/PROTOS/MOB_DROPS) ----------
   已整段迁往 js/mob-registry.js(-registry 契约, 2026-10 候选 8): 怪物种类清单
   唯一权威纯数据表; 消费方(mobs.js/modes/arena.js/drops.js)经共享词法环境照旧
   读全局名 — index.html 里本文件之后紧邻加载, 加载序安全。 */


/* ============================================================
   方块定义
============================================================ */
/* 光源字段(昼夜设计稿 mc-daylight-torch §5.1, D4): light = 方块光发射级
   1..15 —— 火把 14(照亮半径 13 菱形) · 灯块/发光岩/岩浆 15(MC 口径,
   research TL;DR #7); 无 light = 不发光。装场全量(loadScene 的 computeAll)
   与编辑增量(world.js setBlockLit 的 updateEdit)共用本表 —— LightCore.
   mkPolicy.lightOf 读此字段, 光源清单数据驱动零硬编码。 */
const BLOCKS = {
  1: {name: '草地', top: [0.43, 0.74, 0.34], side: [0.56, 0.43, 0.30], bottom: [0.55, 0.40, 0.27]},
  2: {name: '泥土', all: [0.55, 0.40, 0.27]},
  3: {name: '石头', all: [0.50, 0.50, 0.53]},
  4: {name: '圆石', all: [0.42, 0.42, 0.45]},
  5: {name: '木头', top: [0.62, 0.50, 0.33], side: [0.40, 0.30, 0.20], bottom: [0.62, 0.50, 0.33]},
  6: {name: '木板', all: [0.66, 0.52, 0.33]},
  7: {name: '树叶', all: [0.20, 0.50, 0.22]},
  8: {name: '沙子', all: [0.86, 0.80, 0.55]},
  9: {name: '红砖', all: [0.60, 0.25, 0.20]},
  10: {name: '装甲', all: [0.38, 0.46, 0.24]},
  11: {name: '履带', all: [0.15, 0.15, 0.16]},
  12: {name: '金属', all: [0.47, 0.49, 0.53]},
  13: {name: '石砖', all: [0.55, 0.57, 0.60]},
  14: {name: '苔石', all: [0.45, 0.52, 0.38]},
  15: {name: '蓝羊毛', all: [0.30, 0.42, 0.80]},
  16: {name: '红羊毛', all: [0.80, 0.32, 0.32]},
  17: {name: '石英', all: [0.90, 0.88, 0.82]},
  18: {name: '玻璃', all: [0.75, 0.90, 0.95], glass: true},
  19: {name: '灯块', all: [1.00, 0.92, 0.55], light: 15},
};

/* TNT 密室方块 (id 20~29) — 模式已下线, 保留者均为创意资产:
   B_TNT 仍被物品/合成的 tnt 条目引用, B_WATER/B_LAVA 为建造/下界地形件;
   七死键已清偿(B_CRACK/B_SWITCH/B_PLATE/B_DOOR/B_SUPPORT/B_WEIGHT +
   下界段 B_SOUL_SAND — 全仓 js+html+test 零消费, 2026-10 候选 8 逐键 grep 佐证;
   soft 死旗标同批删除 — forEach 全仓零读者)。
   solid:false 不可碰撞 · thin:N 贴地薄块高度 */
const B_TNT=20; const B_FUSE=21; const B_WATER=24;
const B_LAVA=25;
BLOCKS[B_TNT] = {name: 'TNT', all: [0.82, 0.28, 0.22], tnt: true,
  hard: 0, tool: null, tier: 0, drop: [['tnt', 1, 0]]}; // 可回收(挖掘硬度修正 D3, MC 硬度 0): 短按点燃/按住挖走
BLOCKS[B_FUSE] = {name: '引线', all: [0.92, 0.75, 0.30], fuse: true, thin: 0.14, solid: false};
// B_FUSE 运行时死键(全仓 js 零读), 但 test/voxel.test.js / test/mesh-core.test.js 当
// thin 块 fixture — 创意资产保留; 若复活须先找回消费方(候选 8 清偿口径)
/* fluid 旗标 = 液体身份(设计稿 liquid D2): id 恒为 B_WATER/B_LAVA, 水位在
   voxel.js 的并行水位面 fluidLv(ADR 0004)——水 glass 走透渲通道, 岩浆不透明实心通道;
   light:15 = 岩浆自发光(昼夜光照系统, docs/mc-daylight-torch-design.md) */
BLOCKS[B_WATER] = {name: '水', all: [0.25, 0.45, 0.85], glass: true, water: true, fluid: 'water', solid: false};
BLOCKS[B_LAVA] = {name: '岩浆', all: [1.00, 0.42, 0.08], lava: true, fluid: 'lava', solid: false, light: 15};

/* 下界模式新方块 (id 30~35) — 下界荒原主题: 下界岩/黑曜石/下界砖/发光岩/传送门面
   (B_SOUL_SAND 死键已清偿, docs/mining-gap-analysis.md:89 先行记账) */
/* 无 hard = 声明式不可破坏(craft-core breakTime 挖掘侧返 time Infinity + drops
   false, 含 TNT 免疫判据): 本段方块均未登记 hard——门框/门面永不可破坏(下界
   并入探险 D5), 下界岩系挖不动(D7 接受), 配套话术在模式层 */
const B_NETHERRACK=30; const B_OBSIDIAN=31;
const B_NETHER_BRICK=33; const B_GLOWSTONE=34; const B_PORTAL=35;
BLOCKS[B_NETHERRACK]= {name: '下界岩', all: [0.52, 0.28, 0.16]};
BLOCKS[B_OBSIDIAN] = {name: '黑曜石', all: [0.10, 0.08, 0.16]};
BLOCKS[B_NETHER_BRICK]= {name: '下界砖', all: [0.48, 0.20, 0.16]};
BLOCKS[B_GLOWSTONE] = {name: '发光岩', all: [1.00, 0.85, 0.45], light: 15};
/* 传送门面: 门内口的紫色半透明门面。glass 走透明渲染通道(勿用 thin —
   LOD 降采样会跳过 thin 块, 远处门面会消失); solid:false 可直接走入
   (传送判定只看坐标区间, 不看点位); portal 旗标 = 门面唯一身份 */
BLOCKS[B_PORTAL] = {name: '传送门面', all: [0.50, 0.20, 0.80], glass: true, solid: false, portal: true};

/* 物品与合成一期新方块 (id 36~50, 附录 A) — 探险地形与站点件
   四矿: 石头底色+矿斑的纯色近似(嵌斑贴图归 T9 图集) · 硬度 3 = MC 矿石原值
   tier 门槛照 MC 标签口径平移(手0/木1/石2/铁3/钻4): 煤1(木镐) 铁2(石镐) 金3/钻3(铁镐) — 设计稿 D5
   掉落: 铁/金掉矿石物品(粗矿口径, 需熔炼), 煤/钻直接掉成品
   薄块(thin)一律 solid:false 不挡人(B_FUSE 同款); 勿用 thin 做远观物(LOD 降采样会跳过)
   B_SAPLING 附录 A 的 id 栏未编号(「—」), 36~49 已被 14 方块占满 → 顺延 50(号段不冲突);
   B_CHEST 是引导链 v2 新增件(51, docs/story-quest-research.md)——不在附录 A, 号段顺延同款 */
const B_COAL_ORE=36; const B_IRON_ORE=37; const B_GOLD_ORE=38; const B_DIAMOND_ORE=39;
const B_GRASS_TUFT=40; const B_FARMLAND=41;
const B_WHEAT_0=42; const B_WHEAT_1=43; const B_WHEAT_2=44; const B_WHEAT_3=45;
const B_CRAFT=46; const B_FURNACE=47; const B_TORCH=48; const B_CLAY=49; const B_SAPLING=50;
const B_CHEST=51;
const B_WOOL=52; /* F4 羊毛(二期设计稿 §4.7): 号段顺延同款(B_SAPLING/B_CHEST 先例) */
const B_BED=53; /* 床(昼夜 D6, mc-daylight-torch §7.1): 号段顺延同款 */
BLOCKS[B_COAL_ORE] = {name: '煤矿', all: [0.36, 0.36, 0.38], hard: 3.0, tool: 'pick', tier: 1, drop: [['coal', 1, 0]]};
BLOCKS[B_IRON_ORE] = {name: '铁矿', all: [0.55, 0.44, 0.36], hard: 3.0, tool: 'pick', tier: 2, drop: [['iron_ore', 1, 0]]};
BLOCKS[B_GOLD_ORE] = {name: '金矿', all: [0.62, 0.52, 0.28], hard: 3.0, tool: 'pick', tier: 3, drop: [['gold_ore', 1, 0]]};
BLOCKS[B_DIAMOND_ORE] = {name: '钻石矿', all: [0.42, 0.56, 0.58], hard: 3.0, tool: 'pick', tier: 3, drop: [['diamond', 1, 0]]};
BLOCKS[B_GRASS_TUFT] = {name: '草丛', all: [0.38, 0.66, 0.28], thin: 0.35, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['wheat_seeds', 0, 0.5]]}; // 无保底, 50% 掉种子(MC 12.5% → 儿童加倍)
BLOCKS[B_FARMLAND] = {name: '耕地', top: [0.32, 0.22, 0.13], side: [0.42, 0.30, 0.18], bottom: [0.42, 0.30, 0.18],
  hard: 0.6, tool: 'shovel', tier: 0, drop: [['dirt', 1, 0]]}; // 锄头点草地/泥土转来(二期农田链)
BLOCKS[B_WHEAT_0] = {name: '麦苗', all: [0.45, 0.70, 0.30], thin: 0.3, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['wheat_seeds', 1, 0]]};
BLOCKS[B_WHEAT_1] = {name: '麦苗', all: [0.50, 0.72, 0.25], thin: 0.45, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['wheat_seeds', 1, 0]]};
BLOCKS[B_WHEAT_2] = {name: '麦苗', all: [0.60, 0.70, 0.22], thin: 0.55, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['wheat_seeds', 1, 0]]};
BLOCKS[B_WHEAT_3] = {name: '小麦', all: [0.85, 0.72, 0.20], thin: 0.7, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['wheat', 1, 0], ['wheat_seeds', 1, 0.5]]}; // 熟麦: 小麦×1 + 种子 1-2
BLOCKS[B_CRAFT] = {name: '工作台', top: [0.55, 0.42, 0.26], side: [0.66, 0.52, 0.33], bottom: [0.60, 0.47, 0.30],
  hard: 2.5, tool: 'axe', tier: 0, drop: [['craft_table', 1, 0]]}; // 站点: table 级配方
BLOCKS[B_FURNACE] = {name: '熔炉', top: [1.00, 0.45, 0.10], side: [0.35, 0.35, 0.38], bottom: [0.35, 0.35, 0.38],
  hard: 3.5, tool: 'pick', tier: 1, drop: [['furnace', 1, 0]]}; // 站点: 烧炼
BLOCKS[B_TORCH] = {name: '火把', all: [1.00, 0.70, 0.25], thin: 0.5, solid: false, light: 14,
  hard: 0, tool: null, tier: 0, drop: [['torch', 1, 0]]}; // 光源 14 照亮半径 13(§5.1); 不烧完/不能当燃料(vanilla 维持项)
BLOCKS[B_CLAY] = {name: '黏土', all: [0.58, 0.60, 0.68],
  hard: 0.6, tool: 'shovel', tier: 0, drop: [['clay_ball', 4, 0]]}; // 掉 4 黏土球(红砖链源头, §3.5); 湖底生成
BLOCKS[B_SAPLING] = {name: '树苗', all: [0.30, 0.60, 0.25], thin: 0.4, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['sapling', 1, 0]]}; // 20s 长成树(T12 模式层计时)
BLOCKS[B_CHEST] = {name: '箱子', top: [0.72, 0.55, 0.30], side: [0.62, 0.44, 0.22], bottom: [0.55, 0.38, 0.20],
  hard: 2.5, tool: 'axe', tier: 0, drop: [['chest', 1, 0]]}; // 引导链 v2: 点击开大宝箱面板(走近 4 格, 熔炉同款); 全局共享账户, 挖掉不丢内容
/* F4 羊毛(二期设计稿 §4.7): 羊掉毛转入采集 — 徒手可挖掉自身(零惩罚);
   蓝/红羊毛(15/16)维持创造专属, 只开白羊毛(染料 Out of Scope) */
BLOCKS[B_WOOL] = {name: '羊毛', all: [0.92, 0.92, 0.92], hard: 0.8, tool: null, tier: 0,
  drop: [['wool', 1, 0]]};
/* 床(昼夜 D6 §7.1): 1 格半高薄块(差异 #1: MC 2 格×0.5625 简化) — thin 旗标白送
   顶面限定放置(advPlaceCheck thin 路径)与失撑脱落(cascade); hard 0 徒手秒碎回收。
   颜色: top=红毯(亮) / all=床架深红 — 注: 实心通道 pushThin 现取 b.all 单色,
   top 字段按规格 §7.1 原样入表(mesh-core thin 路径分色归 D3/后续观感票) */
BLOCKS[B_BED] = {name: '床', top: [0.90, 0.30, 0.30], all: [0.75, 0.22, 0.22], thin: 0.55,
  solid: false, hard: 0, tool: null, tier: 0, drop: [['bed', 1, 0]]};

/* 生态地图新方块 (id 54~62, 冒险模式生态地图设计稿 §6) — 雪原/沙漠/沼泽三图资源,
   号段顺延同款(B_SAPLING/B_CHEST/B_WOOL/B_BED 先例)。B_ICE 不入贴图图集——
   glass 透光透渲与玻璃同走纯色通道; 半滑物理二期。B_CACTUS 儿童版无触碰伤害
   (设计稿幼儿红线)。雪块挖掉得 4 雪球(雪仗弹药, 黏土 4 球同款; 合成反向归 T9)。 */
const B_SNOW=54; const B_SNOWY_GRASS=55; const B_ICE=56; const B_CACTUS=57;
const B_SANDSTONE=58; const B_DEAD_BUSH=59;
const B_ORCHID=60; const B_FLOWER_Y=61; const B_FLOWER_W=62;
BLOCKS[B_SNOW] = {name: '雪块', all: [0.93, 0.95, 0.98],
  hard: 0.2, tool: 'shovel', tier: 0, drop: [['snowball', 4, 0]]}; // MC 硬度 0.2; 雪原地表/雪堆
BLOCKS[B_SNOWY_GRASS] = {name: '雪覆草', top: [0.93, 0.95, 0.98], side: [0.68, 0.58, 0.51], bottom: [0.55, 0.40, 0.27],
  hard: 0.6, tool: 'shovel', tier: 0, drop: [['dirt', 1, 0]]}; // 掉泥土(草地同款); top 白 side 雪泥带 bottom 泥
BLOCKS[B_ICE] = {name: '冰', all: [0.63, 0.78, 0.94], glass: true,
  hard: 0.5, tool: null, tier: 0, drop: [['ice', 1, 0]]}; // MC 掉无 → 零惩罚哲学掉自身(玻璃同款); 冰面/冻湖
BLOCKS[B_CACTUS] = {name: '仙人掌', all: [0.29, 0.53, 0.22],
  hard: 0.4, tool: null, tier: 0, drop: [['cactus', 1, 0]]}; // 沙漠绿柱; 无触碰伤害(儿童版)
BLOCKS[B_SANDSTONE] = {name: '砂岩', all: [0.85, 0.78, 0.57],
  hard: 0.8, tool: 'pick', tier: 1, drop: [['sandstone', 1, 0]]}; // 沙漠地下层/神殿墙体
BLOCKS[B_DEAD_BUSH] = {name: '枯灌木', all: [0.50, 0.35, 0.18], thin: 0.6, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['stick', 1, 0.5]]}; // thin 十字片; 掉木棍 1~2(MC 0~2 → 儿童保底 1)
BLOCKS[B_ORCHID] = {name: '兰花', all: [0.42, 0.66, 0.78], thin: 0.65, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['orchid', 1, 0]]}; // 沼泽唯一产地收藏(设计稿 §6)
BLOCKS[B_FLOWER_Y] = {name: '蒲公英', all: [0.91, 0.79, 0.19], thin: 0.65, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['flower_y', 1, 0]]}; // 家园花丛草场(T5 散布)
BLOCKS[B_FLOWER_W] = {name: '雏菊', all: [0.93, 0.93, 0.91], thin: 0.65, solid: false,
  hard: 0, tool: null, tier: 0, drop: [['flower_w', 1, 0]]};

/* ---------- 存量方块采集字段 (物品与合成一期, 设计稿 §3.4/§3.5) ----------
   只增不改: 名字/颜色/既有旗标原样, 集中在此补 hard/tool/tier/drop 四字段
   (Object.assign 赋值式, 原 soft 旗标先例已随死旗标清偿删除)。hard = MC 硬度原值(徒手石头 7.5s 口径的来源) ·
   tool = 加速工具(null = 徒手同速, 如树叶/玻璃) ·
   tier = 掉落所需镐等级(手0/木1/石2/铁3/钻4; 不足可挖但慢且不掉落) ·
   drop 条目 [itemId, 保底, 概率]: 保底=破坏必得数量, 概率=额外再得 1 个的几率。
   创造专属 10/11/12/15/16/17/19 不加(探险不可得, 建造即点即碎政策不变)。 */
Object.assign(BLOCKS[1], {hard: 0.6, tool: 'shovel', tier: 0, drop: [['dirt', 1, 0]]}); // 草地: MC 掉泥土
Object.assign(BLOCKS[2], {hard: 0.5, tool: 'shovel', tier: 0, drop: [['dirt', 1, 0]]});
Object.assign(BLOCKS[3], {hard: 1.5, tool: 'pick', tier: 1, drop: [['cobble', 1, 0]]}); // 石头掉圆石; 徒手挖不动→教做镐
Object.assign(BLOCKS[4], {hard: 2.0, tool: 'pick', tier: 1, drop: [['cobble', 1, 0]]});
Object.assign(BLOCKS[5], {hard: 2.0, tool: 'axe', tier: 0, drop: [['log', 1, 0]]});
Object.assign(BLOCKS[6], {hard: 2.0, tool: 'axe', tier: 0, drop: [['planks', 1, 0]]});
Object.assign(BLOCKS[7], {hard: 0.2, tool: 'shears', tier: 0, // 剪刀品类(挖掘硬度修正 D2): 剪刀加速+掉树叶本身; 其它工具/徒手无加成 0.3s
  drop: [['sapling', 0, 0.12], ['apple', 0, 0.04], ['stick', 0, 0.08]], // 默认表: 概率掉落 MC 5%/0.5%/2% → 儿童加倍(附录 B·D7)
  shearDrop: [['leaves', 1, 0]]}); // 剪刀专属表: 直接得树叶方块(MC 口径, rollBlockDrop 第三参)
Object.assign(BLOCKS[8], {hard: 0.5, tool: 'shovel', tier: 0, drop: [['sand', 1, 0]]});
Object.assign(BLOCKS[9], {hard: 2.0, tool: 'pick', tier: 1, drop: [['bricks', 1, 0]]}); // 红砖块: 黏土链合成来路(§3.5)
Object.assign(BLOCKS[13], {hard: 1.5, tool: 'pick', tier: 1, drop: [['stone_bricks', 1, 0]]}); // 石砖: 4 石合成(§3.5)
Object.assign(BLOCKS[14], {hard: 2.0, tool: 'pick', tier: 1, drop: [['mossy_cobble', 1, 0]]}); // 苔石: 矿洞/遗迹直接采集(§3.5)
Object.assign(BLOCKS[18], {hard: 0.3, tool: null, tier: 0, drop: [['glass', 1, 0]]}); // MC 玻璃无掉落 → 零惩罚哲学掉自身

/* ---------- 方块级联身份旗标 (docs/block-lifecycle-design.md D1) ----------
   编辑后世界自洽的级联判据(block-lifecycle): 身份即白名单——机制跟着
   「它是什么」走, 不跟「它在哪」走(石头无旗标, 在哪挖都不塌; 是树就倒,
   孩子搭的原木柱与自然树同一规则)。
   fell  结构身份: 连成一体共享接地, 失撑整组件倒(砍一节=整树倒/柱脚被挖=柱倒);
   need  伴生身份: {id, dist} 依赖某方块在 taxicab 距离内, 失依即落
         (树叶 4 格内须有原木——MC BE 口径, JE 6 会让贴脸双树互保);
   fall  重力身份: 失撑整段下沉(移动语义, 二期 D7——落沙砸碎沿途 thin、穿水,
         放置半空即落地 P9);
   thin  依附身份: 旗标既有(草丛/麦/火把/树苗), 破坏侧随底座脱落——复用不新增。 */
Object.assign(BLOCKS[5], {fell: true}); // 原木: 结构成员(木板 6 不参与——原木房子承重墙不受牵连)
Object.assign(BLOCKS[7], {need: {id: 5, dist: 4}}); // 树叶: 4 格内有原木才存活
Object.assign(BLOCKS[8], {fall: true}); // 沙子: 重力方块(MC 口径, 二期 D7)

function faceColor(id, dir) {
  const b = BLOCKS[id];
  /* 顶面显式 top 优先于 all(昼夜 D3: 床=红毯顶/深红架, mc-daylight-torch
     §7.1 — D6 的 top 字段由此生效; 存量方块 top 与 all 不同存, 零变化) */
  if (dir[1] === 1 && b.top) return b.top;
  if (b.all) return b.all;
  if (dir[1] === 1) return b.top;
  if (dir[1] === -1) return b.bottom;
  return b.side;
}
