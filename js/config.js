"use strict";
/* ============================================================
   配置与方块注册表
============================================================ */
const CHUNK = 16;
const NCX = 8, NCZ = 8;
const WORLD_W = NCX * CHUNK;
const WORLD_D = NCZ * CHUNK;
const WORLD_H = 48;

const PLAYER = {
  hx: 0.3, hz: 0.3, height: 1.8, eye: 1.62,
  speed: 5.0, sprint: 8.5, jump: 8.6, gravity: 26.0,
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

/* 竞技场几何参数 */
const ARENA = {
  cx: WORLD_W/2, cz: WORLD_D/2,   // 中心 (64,64)
  floorY: 14,                     // 场地地面顶层方块 y
  rIn: 36,                        // 内墙半径
  rOut: 40,                       // 外墙半径
  flyAlt: 7.8                     // 飞行单位悬停高度(离地面)
};

/* TNT 密室逃生参数 */
const TNT_CFG = {
  radius: 3.5,      // 爆炸破坏半径
  chainR: 3.0,      // 链式引爆半径
  sparkSpeed: 2.0,  // 火花速度(格/秒)
  sparkFast: 4.0,   // 快引线火花速度(格/秒)
  tntFuse: 1.0,     // TNT 点燃后白闪倒计时(秒)
  hurtR: 4.5,       // 玩家被炸昏迷半径
  breakBase: 0.95,  // 爆心软方块破坏概率(随距离衰减)
  chainDelay: 0.3   // 链式引爆延迟(秒)
};

/* 儿童游玩时限(竞技场+TNT+建造共享): PLAY_LIMIT_DEFAULT_MIN 为每日默认分钟数;
   TEMP_PLAY_LIMIT_MIN 按日期临时调整, 键=日期(年-月-日, 无前导零, 如 2026-10-12), 值=当天分钟数,
   只对列出的日期生效, 次日自动恢复默认 */
const PLAY_LIMIT_DEFAULT_MIN = 10;
const TEMP_PLAY_LIMIT_MIN = {
  '2026-10-17': 20,
  '2026-10-18': 20
};

/* 专注训练营每日预算(独立于儿童时限): 每日关卡数与训练时长上限 */
const FOCUS_DAILY_LEVELS = 6;
const FOCUS_DAILY_MIN = 20;

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

/* 可被爆炸破坏的软方块(密室外壳石质方块不可破坏,防止把房间炸穿) */
[5,6,8,9].forEach(id=> BLOCKS[id].soft = true);

const HOTBAR = [3,4,13,5,6,17,16,15,18];

function faceColor(id, dir){
  const b = BLOCKS[id];
  if(b.all) return b.all;
  if(dir[1] === 1)  return b.top;
  if(dir[1] === -1) return b.bottom;
  return b.side;
}
