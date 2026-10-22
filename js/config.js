"use strict";
/* ============================================================
   配置与方块注册表
============================================================ */
const CHUNK = 16;
const NCX = 8, NCZ = 8;
const WORLD_W = NCX * CHUNK;
const WORLD_D = NCZ * CHUNK;
const WORLD_H = 48;

/* 触屏环境检测(全游戏唯一口径): 输入路由 / 音效配平 / 渲染降载共用
   — 以前 isTouch/sfxTouch/_coarse 三处各测一次且口径不一, 统一于此 */
const IS_TOUCH = (()=>{ try{ return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); }catch(e){ return false; } })();

const PLAYER = {
  hx: 0.3, hz: 0.3, height: 1.8, eye: 1.62,
  speed: 5.0, sprint: 8.5, jump: 8.6, gravity: 26.0,
  flyVert: 7.0,     // 飞行模式垂直速度(格/秒)
  fallCap: -30,     // 坠落限速(格/秒, 防高坠穿薄板)
  substep: 0.25,    // 移动/驾驶的轴向子步长(格, 防高速跨过碰撞判定)
  voidY: -12,       // 坠出世界判定线(引擎只报事件, 处理归应用层)
  reach: 6,         // 玩家触达/瞄准距离(格)
  heldItem: 'hoe'   // 默认手持物(HeldItems.defs 的键; main.js 组合根装配)
};

/* 第三人称相机 (CameraRig 用, 见 js/camera-rig.js) */
const CAM = {
  dist: 3.2,       // 轨道距离(格): 相机离眼睛多远
  shoulder: 0.55,  // 越肩横移: 相机向人物右肩偏移, 人物落画面左侧, 准心不被挡
  lift: 0.18,      // 越肩抬升: 相机沿视线上方轻微抬高
  minDist: 0.35,   // 防穿墙收拢下限(贴墙时最近)
  margin: 0.28,    // 相机与命中面的留白
  hideDist: 0.9    // 收拢近于此 → 隐藏玩家形象(头不再挡画面)
};

/* 单消费者常量已归位: ARENA/HOTBAR(竞技场) · TNT_CFG(TNT密室) · TANK_VS_MOBS
   (坦克演习场) — 政策常量属应用层, 不在引擎共享命名空间里放着( ambient 可见
   会诱惑跨层乱读); 引擎真正的共享注册表只剩: 世界尺寸/PLAYER/CAM/VIEW/BLOCKS/
   TANK/TANK_MODELS/MOB_TYPES/IS_TOUCH/faceColor */

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
  fullChunks: 8,      // 全细节环半径(区块)
  lodChunks: 15,      // LOD 环半径(区块; ×16 格 ≈ 雾终点)
  lodStep: 2,         // LOD 采样步长(格/边; 须整除 CHUNK=16, 否则回落 2)
  dispatch: 8         // Worker 每帧派发上限(派发只含打包+postMessage, 帧成本极低; 同步兜底预算由 pumpRemesh 入参)
};

/* TNT 贴图图集竖排格数(含 0 号 mipmap 缓冲垫): 画布高/tileV 编号/UV
   除数三处共用(world.js 画布与 MeshCore UV 各读一次, 单一来源) */
const TNT_TILES = 4;


/* 坦克载具参数 (tank-core/tank.js 用, 见 js/tank-core.js) */
const TANK = {
  hw: 0.95, height: 1.4,      // 碰撞半宽/高(格): 可进 2 格高空间, 过不了 2 格宽窄门
  speed: 7.0, reverse: 3.5,   // 前进/倒车极速(格/秒)
  accel: 6.0, friction: 4.0,  // 加速/滑行摩擦(指数逼近速率)
  turnRate: 1.9,              // 车体转向速率上限(弧度/秒), 亦为 A/D 集成速率(pad 试玩反馈: 1.6 偏慢 → 提速)
  promptR: 2.5, enterR: 3.0,  // 上车提示/上车判定半径(格): 走近才提示, 稍远一点仍可上
  shellSpeed: 40.0,           // 炮弹初速(格/秒)
  shellG: 4.0,                // 炮弹重力(远轻于实体, 弹道近乎平直)
  shellLife: 5.0,             // 炮弹超程自毁(秒) → 理论射程 200 格(全图对角线以内)
  shellR: 2.2,                // 爆炸破坏半径(格)
  reload: 1.25                // 装填冷却(秒)
};
/* 载具相机 (CameraRig.mount 用, 见 js/camera-rig.js) */
const CAM_TANK = { dist: 6.5, lift: 1.6, eye: 1.8 };

/* ---------- 坦克型号注册表 (TANK_MODELS, tank.js 建模 / tank-range 选车页用) ----------
   每款: name 选车页名 · desc 一句话卖点 · perf 性能(键同 TANK, 缺键回落 TANK 基线,
   由 TankCore 逐键解析) · muzzle 出膛点(f 车体系前伸 / y 离地高) ·
   shell 炮弹观感(color 弹体 / glow 自发光 / size 缩放 / stretch 纵向拉伸 /
   trail 曳光 / boom 爆风色)。可选: salvo 一次点射弹数(横向错位+散布),
   homing 追踪转向速率(弧度/秒, "谁是敌人"由模式层经 Tank.targeter 注入)。
   伤害统一走 TANK_VS_MOBS(对每款都公平, 差异只在开起来/看起来)。 */
const TANK_MODELS = {
  classic: {
    key: 'classic', order: 1,               // order: 选车页排列序(老兵 → 快枪 → 重炮 → 猛将 → 科技 → 旗舰压轴)
    name: '迷彩战车', desc: '均衡可靠的绿林老兵<br>样样都在行',
    perf: { speed: 7.0, reverse: 3.5, accel: 6.0, turnRate: 1.9, reload: 1.25,
            shellSpeed: 40, shellG: 4.0, shellLife: 5.0, shellR: 2.2 },
    muzzle: { f: 1.9, y: 1.32 },
    shell: { color: 0x23262b, glow: 0x000000, size: 1.0, trail: 0xffc36b, boom: 0xffd9a0 },
  },
  desert: {
    key: 'desert', order: 2, name: '沙漠之鹰', desc: '跑得最快 · 装填最快的<br>黄沙速射猎手',
    perf: { speed: 8.6, reverse: 4.2, accel: 7.5, turnRate: 2.2, reload: 0.9,
            shellSpeed: 44, shellG: 4.0, shellLife: 5.0, shellR: 1.9 },
    muzzle: { f: 2.3, y: 1.28 },
    shell: { color: 0xd9b23c, glow: 0x6b5210, size: 0.9, trail: 0xffe9a0, boom: 0xffe2a8 },
  },
  frost: {
    key: 'frost', order: 3, name: '极地冰狼', desc: '冰原重装巨兽 · 炮弹<br>威力圈特别大',
    perf: { speed: 6.0, reverse: 3.0, accel: 5.0, turnRate: 1.6, reload: 1.6,
            shellSpeed: 36, shellG: 4.5, shellLife: 5.0, shellR: 2.9 },
    muzzle: { f: 1.9, y: 1.66 },
    shell: { color: 0xbfe8ff, glow: 0x2e7fa8, size: 1.35, trail: 0xd8f4ff, boom: 0xcfeeff },
  },
  magma: {
    key: 'magma', order: 4, name: '熔岩勇士', desc: '火山里开出来的黑甲猛将<br>会喷熔岩火球',
    perf: { speed: 6.6, reverse: 3.2, accel: 5.5, turnRate: 1.8, reload: 1.45,
            shellSpeed: 38, shellG: 4.0, shellLife: 5.0, shellR: 2.7 },
    muzzle: { f: 2.05, y: 1.56 },
    shell: { color: 0xff7a2a, glow: 0xbb3d00, size: 1.25, trail: 0xff9a4d, boom: 0xff8a3d },
  },
  thunder: {
    key: 'thunder', order: 5, name: '雷霆战神', desc: '未来科技电光战神<br>闪电环炮 · 命中处天降落雷',
    perf: { speed: 7.6, reverse: 3.8, accel: 7.0, turnRate: 2.4, reload: 0.8,
            shellSpeed: 48, shellG: 2.6, shellLife: 5.0, shellR: 2.0 },
    muzzle: { f: 2.25, y: 1.36 },
    shell: { color: 0x66ecff, glow: 0x0e7f96, size: 1.1, trail: 0x9fe8ff, boom: 0x7deaff,
             fx: 'lightning' },        // 闪电弹: 环形弹体 + 电弧曳光 + 命中落雷(tank.js/Fx 解读)
  },
  tingyu: {
    key: 'tingyu', order: 6, name: '张廷彧号', desc: 'TNT 迷彩涂装 · 苦力怕车长<br>四联追踪导弹 · 爆炸小巧精准',
    perf: { speed: 7.2, reverse: 3.6, accel: 6.5, turnRate: 2.1, reload: 1.9,
            shellSpeed: 34, shellG: 1.2, shellLife: 6.0, shellR: 1.1 },
    muzzle: { f: 1.35, y: 1.62 },
    shell: { color: 0xe04838, glow: 0x7a1c10, size: 0.8, stretch: 1.7, trail: 0xffb040, boom: 0xffd9a0 },
    salvo: 4,                            // 一次点射 4 枚(横向队列弹出, 各自散布)
    homing: 3.4                          // 追踪转向速率(弧度/秒): 引擎只管转向, "谁是敌人"归模式层
  },
};

/* ---------- 怪物数值表 (js/mobs.js 怪物库用; 竞技场与坦克演习场共用) ----------
   数值按 Minecraft 原版等比映射(与初代五怪同口径):
   hp≈原版生命×1.5 · dmg≈原版普通难度伤害×1.6 · speed≈原版移速属性×10
   h/hitR≈原版碰撞箱(高/半宽) — 竞技场配平战力已归位 modes/arena.js(ARENA_POWER)
   旗标: ranged 远程 · boom 自爆 · fly 飞行 · boss Boss级(不进混合编队池)
   谱系(术语见 GLOSSARY「怪物谱系」): **种族=长相接近的血统组**(用户拍板),
   另允许职责组(守卫组: 不长相近但都是"守卫"); 不按地域/维度分族。
   proto 行为原型(AI 模板位) · family 物种族(有序多标签: 首位=主族=面板归组+
   家传技能发放; 每怪必归种族, 单员族合法; 多族合法 — 僵尸猪灵/僵尸疣猪兽=猪物种+僵尸血统)。
   特有技能: 家传=族共享模板(竞技场 FAMILY_SKILLS) · 个体特化每怪至多一招
   (竞技场 MOB_QUIRKS: 守卫者系蓄力激光 · 末影人颤栗瞬移; 苦力怕扑袭/
   铁傀儡震地/末影龙龙息是移动一体型特化, 留在原型分支) */
const MOB_TYPES = {
  /* —— 僵尸一家(主族 zombie_line, 家传·狂暴) —— */
  zombie:  {name:'僵尸',   hp:30,  dmg:5,  speed:2.3, range:2.1, cd:1.1, h:1.9, hitR:0.55,
            proto:'charger', family:['zombie_line']},
  husk:    {name:'尸壳',   hp:30,  dmg:5,  speed:2.3, range:2.1, cd:1.1, h:1.9, hitR:0.55,
            proto:'charger', family:['zombie_line']},
  drowned: {name:'溺尸',   hp:30,  dmg:5,  speed:2.3, range:2.1, cd:1.1, h:1.9, hitR:0.55,
            proto:'archer',  family:['zombie_line']},
  /* —— 骷髅一家(主族 skeleton_line, 家传·强力箭节奏/节奏重斩) —— */
  skeleton:{name:'骷髅',   hp:26,  dmg:6,  speed:2.6, range:14,  cd:2.6, h:1.9, ranged:true, hitR:0.55,
            proto:'archer',  family:['skeleton_line']},
  stray:   {name:'流浪者', hp:30,  dmg:6,  speed:2.5, range:14,  cd:2.8, h:1.9, ranged:true, hitR:0.55,
            proto:'archer',  family:['skeleton_line']},
  bogged:  {name:'沼骸',   hp:24,  dmg:6,  speed:2.5, range:14,  cd:2.8, h:1.9, ranged:true, hitR:0.55,
            proto:'archer',  family:['skeleton_line']},
  wither_skeleton:{name:'凋灵骷髅', hp:30, dmg:13, speed:2.5, range:2.4, cd:1.3, h:2.4, hitR:0.6,
            proto:'charger', family:['skeleton_line']},
  /* —— 虫虫族(主族 arthropod, 家传·疾爬突进) —— */
  spider:      {name:'蜘蛛',     hp:24, dmg:3,  speed:3.0, range:2.2, cd:1.2, h:0.9, hitR:0.65,
            proto:'ambusher', family:['arthropod']},
  cave_spider: {name:'洞穴蜘蛛', hp:18, dmg:3,  speed:3.0, range:2.0, cd:1.1, h:0.5, hitR:0.35,
            proto:'ambusher', family:['arthropod']},
  silverfish:  {name:'蠹虫',     hp:12, dmg:2,  speed:2.6, range:1.6, cd:0.9, h:0.35, hitR:0.25,
            proto:'ambusher', family:['arthropod']},
  endermite:   {name:'末影螨',   hp:12, dmg:3,  speed:2.6, range:1.6, cd:1.0, h:0.35, hitR:0.25,
            proto:'ambusher', family:['arthropod']},
  /* —— 软软族(主族 slime_line, 家传·分裂) —— */
  slime:      {name:'史莱姆', hp:24, dmg:6,  speed:2.0, range:2.2, cd:1.4, h:2.0, hitR:0.55,
            proto:'splitter', family:['slime_line']},
  magma_cube: {name:'岩浆怪', hp:24, dmg:9,  speed:2.1, range:2.2, cd:1.5, h:2.0, hitR:0.55,
            proto:'splitter', family:['slime_line']},
  /* —— 猪猪一家(主族 pig_line, 家传·蛮冲): 人形猪+野兽猪, 都是猪 —— */
  piglin:          {name:'猪灵',     hp:24, dmg:8,  speed:2.7, range:2.2, cd:1.1, h:1.9, hitR:0.55,
            proto:'charger', family:['pig_line']},
  piglin_brute:    {name:'猪灵蛮兵', hp:75, dmg:20, speed:2.6, range:2.4, cd:1.3, h:2.0, hitR:0.6,
            proto:'charger', family:['pig_line']},
  zombified_piglin:{name:'僵尸猪灵', hp:30, dmg:8,  speed:2.3, range:2.2, cd:1.1, h:1.9, hitR:0.55,
            proto:'charger', family:['pig_line','zombie_line']},   // 双物种血统: 主族领家传, 副族只领分组
  hoglin:          {name:'疣猪兽',   hp:60, dmg:9,  speed:2.8, range:2.6, cd:1.5, h:1.4, hitR:0.7,
            proto:'charger', family:['pig_line']},
  zoglin:          {name:'僵尸疣猪兽', hp:60, dmg:9, speed:2.8, range:2.6, cd:1.5, h:1.4, hitR:0.7,
            proto:'charger', family:['pig_line','zombie_line']},   // 双物种血统(同僵尸猪灵)
  /* —— 鬼一族(主族 ghost, 家传·阴风): 长相/气质是幽灵飘忽的 —— */
  ghast:   {name:'恶魂',   hp:15, dmg:14, speed:3.2, range:16,  cd:3.4, h:3.4, fly:true, ranged:true, hitR:1.8,
            proto:'turret',  family:['ghost']},
  phantom: {name:'幻翼',   hp:30, dmg:6,  speed:3.5, range:3.5, cd:1.3, h:0.6, fly:true, hitR:0.45,
            proto:'diver',   family:['ghost']},
  blaze:   {name:'烈焰人', hp:30, dmg:8,  speed:2.3, range:15,  cd:2.4, h:1.8, fly:true, ranged:true, hitR:0.45,
            proto:'turret',  family:['ghost']},
  wither:  {name:'凋灵',   hp:450, dmg:13, speed:3.8, range:15, cd:2.2, h:3.5, fly:true, ranged:true, hitR:0.9, boss:true,
            proto:'turret',  family:['ghost']},
  enderman:{name:'末影人', hp:60, dmg:11, speed:3.0, range:2.6, cd:1.2, h:2.9, hitR:0.35,
            proto:'skirmisher', family:['ghost']},   // 个体特化=颤栗瞬移(模式层 MOB_QUIRKS)
  vex:     {name:'恼鬼',   hp:21, dmg:8,  speed:3.4, range:3.0, cd:1.0, h:0.8, fly:true, hitR:0.25,
            proto:'diver',  family:['ghost']},
  /* —— 守卫组(主族 guard, 职责组: 不长相近但都是"守卫"; 家传·磐石) —— */
  golem:          {name:'铁傀儡',     hp:110, dmg:15, speed:2.0, range:3.0, cd:1.6, h:2.8, hitR:1.0,
            proto:'charger', family:['guard']},      // 个体特化=震地/巨石(原型分支)
  warden:         {name:'监守者',     hp:750, dmg:45, speed:2.7, range:3.2, cd:1.8, h:2.9, hitR:0.9, boss:true,
            proto:'charger', family:['guard']},
  guardian:       {name:'守卫者',     hp:45, dmg:8,  speed:2.0, range:13, cd:2.8, h:0.9, ranged:true, hitR:0.6,
            proto:'turret',  family:['guard']},      // 个体特化=蓄力激光(模式层 MOB_QUIRKS)
  elder_guardian: {name:'远古守卫者', hp:120, dmg:13, speed:1.9, range:15, cd:3.2, h:2.0, ranged:true, hitR:1.0, boss:true,
            proto:'turret',  family:['guard']},
  /* —— 灾厄帮(主族 illager, 家传·袭击协同) —— */
  vindicator:{name:'卫道士', hp:36, dmg:20, speed:2.9, range:2.2, cd:1.2, h:1.9, hitR:0.55,
            proto:'charger', family:['illager']},
  evoker:    {name:'唤魔者', hp:36, dmg:9,  speed:2.2, range:13,  cd:3.0, h:1.9, ranged:true, hitR:0.55,
            proto:'charger', family:['illager']},
  pillager:  {name:'掠夺者', hp:36, dmg:6,  speed:2.4, range:14,  cd:2.7, h:1.9, ranged:true, hitR:0.55,
            proto:'archer',  family:['illager']},
  ravager:   {name:'劫掠兽', hp:150, dmg:18, speed:2.7, range:2.8, cd:1.6, h:2.2, hitR:1.0,
            proto:'charger', family:['illager']},
  witch:     {name:'女巫',   hp:39, dmg:9,  speed:2.5, range:14,  cd:3.0, h:2.0, ranged:true, hitR:0.45,
            proto:'archer',  family:['illager']},   // raider 圈: 村民的邪恶亲戚(物种归帮, 原版亦此划分)
  /* —— 独行侠已撤销(用户拍板"不要不伦不类的兜底族"): 每怪必归种族, 单员族合法 —— */
  /* —— 草木族(主族 plant): 植物身子的怪(家传三期补) —— */
  creeper: {name:'苦力怕', hp:28, dmg:33, speed:3.1, range:2.0, cd:9,   h:1.7, boom:true, hitR:0.5,
            proto:'bomber', family:['plant']},     // 个体特化=扑袭+读条取消(原型分支)
  creaking:{name:'嘎枝',   hp:30, dmg:5,  speed:3.0, range:2.2, cd:1.1, h:1.7, hitR:0.5,
            proto:'skirmisher', family:['plant']},
  /* —— 龙族(主族 dragon, 单员族): 家传无(龙息即本体特化, 原型分支) —— */
  dragon:  {name:'末影龙', hp:300, dmg:7,  speed:4.4, range:17,  cd:4.5, h:3.0, fly:true, hitR:2.2, boss:true,
            proto:'diver', family:['dragon']},
  /* —— 海族(主族 sea, 单员族): 贝壳身子(家传无, 追踪弹特化三期补) —— */
  shulker: {name:'潜影贝', hp:45, dmg:6,  speed:0.3, range:15,  cd:3.0, h:1.0, ranged:true, hitR:0.5,
            proto:'turret', family:['sea']},
  /* —— 伪类型: 竞技场混合编队按钮(种类池在 modes/arena.js 动态生成, 不带谱系) —— */
  mix:     {name:'混合编队', hp:0, dmg:0, speed:0, range:0, cd:0, h:2}
};

/* ---------- 怪物谱系注册表(数值表的两张维度表, 术语见 GLOSSARY「怪物谱系」) ----------
   FAMILIES: 种族展示注册表 — 种族=长相接近的血统组(守卫组是唯一职责组例外);
             name=孩子叫法(面板组头) · order=展示顺序; **无兜底族**(独行侠已撤):
             每怪必归种族, 单员族合法(龙族/海族); 未注册键由怪物库兜底键名不丢桶。
   PROTOS: 行为原型合法值(战斗 AI 模板位, 分期③的原型化分发键)。 */
const FAMILIES = {
  zombie_line:  {name:'僵尸一家', order:1},
  skeleton_line:{name:'骷髅一家', order:2},
  arthropod:    {name:'虫虫族',   order:3},
  pig_line:     {name:'猪猪一家', order:4},
  ghost:        {name:'鬼一族',   order:5},
  guard:        {name:'守卫组',   order:6},
  illager:      {name:'灾厄帮',   order:7},
  slime_line:   {name:'软软族',   order:8},
  plant:        {name:'草木族',   order:9},
  dragon:       {name:'龙族',     order:10},
  sea:          {name:'海族',     order:11},
};
const PROTOS = ['charger','archer','bomber','ambusher','diver','turret','splitter','skirmisher'];


/* ============================================================
   方块定义
============================================================ */
const BLOCKS = {
  1:{name:'草地',   top:[0.43,0.74,0.34], side:[0.56,0.43,0.30], bottom:[0.55,0.40,0.27]},
  2:{name:'泥土',   all:[0.55,0.40,0.27]},
  3:{name:'石头',   all:[0.50,0.50,0.53]},
  4:{name:'圆石',   all:[0.42,0.42,0.45]},
  5:{name:'木头',   top:[0.62,0.50,0.33], side:[0.40,0.30,0.20], bottom:[0.62,0.50,0.33]},
  6:{name:'木板',   all:[0.66,0.52,0.33]},
  7:{name:'树叶',   all:[0.20,0.50,0.22]},
  8:{name:'沙子',   all:[0.86,0.80,0.55]},
  9:{name:'红砖',   all:[0.60,0.25,0.20]},
  10:{name:'装甲',  all:[0.38,0.46,0.24]},
  11:{name:'履带',  all:[0.15,0.15,0.16]},
  12:{name:'金属',  all:[0.47,0.49,0.53]},
  13:{name:'石砖',  all:[0.55,0.57,0.60]},
  14:{name:'苔石',  all:[0.45,0.52,0.38]},
  15:{name:'蓝羊毛',all:[0.30,0.42,0.80]},
  16:{name:'红羊毛',all:[0.80,0.32,0.32]},
  17:{name:'石英',  all:[0.90,0.88,0.82]},
  18:{name:'玻璃',  all:[0.75,0.90,0.95], glass:true},
  19:{name:'灯块',  all:[1.00,0.92,0.55]}
};

/* TNT 模式新方块 (id 20~29)
   solid:false 不可碰撞 · thin:N 贴地薄块高度 · soft 可被炸毁 · crack 必被炸毁 */
const B_TNT=20, B_FUSE=21, B_CRACK=22, B_SWITCH=23, B_WATER=24,
      B_LAVA=25, B_PLATE=26, B_DOOR=27, B_SUPPORT=28, B_WEIGHT=29;
BLOCKS[B_TNT]    = {name:'TNT',    all:[0.82,0.28,0.22], tnt:true};
BLOCKS[B_FUSE]   = {name:'引线',   all:[0.92,0.75,0.30], fuse:true,  thin:0.14, solid:false};
BLOCKS[B_CRACK]  = {name:'裂纹砖', all:[0.74,0.68,0.58], crack:true};
BLOCKS[B_SWITCH] = {name:'转辙器', top:[0.78,0.62,0.36], side:[0.46,0.36,0.22], bottom:[0.46,0.36,0.22], switch:true};
BLOCKS[B_WATER]  = {name:'水',     all:[0.25,0.45,0.85], glass:true, water:true, solid:false};
BLOCKS[B_LAVA]   = {name:'岩浆',   all:[1.00,0.42,0.08], lava:true,  solid:false};
BLOCKS[B_PLATE]  = {name:'压力板', all:[0.58,0.36,0.20], plate:true, thin:0.16, solid:false};
BLOCKS[B_DOOR]   = {name:'铁门',   all:[0.58,0.64,0.70], door:true};
BLOCKS[B_SUPPORT]= {name:'支架',   all:[0.42,0.32,0.20], support:true};
BLOCKS[B_WEIGHT] = {name:'重物块', all:[0.33,0.34,0.40], weight:true};

/* 下界模式新方块 (id 30~35) — 下界荒原主题: 下界岩/黑曜石/灵魂沙/下界砖/发光岩/传送门面 */
const B_NETHERRACK=30, B_OBSIDIAN=31, B_SOUL_SAND=32, B_NETHER_BRICK=33, B_GLOWSTONE=34, B_PORTAL=35;
BLOCKS[B_NETHERRACK]= {name:'下界岩', all:[0.52,0.28,0.16]};
BLOCKS[B_OBSIDIAN]  = {name:'黑曜石', all:[0.10,0.08,0.16]};
BLOCKS[B_SOUL_SAND] = {name:'灵魂沙', all:[0.38,0.30,0.22]};
BLOCKS[B_NETHER_BRICK]= {name:'下界砖', all:[0.48,0.20,0.16]};
BLOCKS[B_GLOWSTONE] = {name:'发光岩', all:[1.00,0.85,0.45]};
/* 传送门面: 门内口的紫色半透明门面。glass 走透明渲染通道(勿用 thin —
   LOD 降采样会跳过 thin 块, 远处门面会消失); solid:false 可直接走入
   (传送判定只看坐标区间, 不看点位); portal 旗标 = 门面唯一身份 */
BLOCKS[B_PORTAL]    = {name:'传送门面', all:[0.50,0.20,0.80], glass:true, solid:false, portal:true};

/* 可被爆炸破坏的软方块(密室外壳石质方块不可破坏,防止把房间炸穿) */
[5,6,8,9].forEach(id=> BLOCKS[id].soft = true);

function faceColor(id, dir){
  const b = BLOCKS[id];
  if(b.all) return b.all;
  if(dir[1] === 1)  return b.top;
  if(dir[1] === -1) return b.bottom;
  return b.side;
}
