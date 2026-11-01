'use strict';
/* ============================================================
   Robot Commander Levels (怪物指挥官关卡库, 术语见 GLOSSARY.md) — 库层(数据+纯函数)
   ------------------------------------------------------------
   一句话职责: 关卡数值唯一权威——100 关编排(4 带×25, kind 分布/怪物包
   轮换)、paramsFor 难度曲线(棋盘尺寸/槽位上限/特征量/演示淡出/陷阱率/
   假旗)、decode/debug 关预置程序派生、通过门槛与三星(par 预算挂钩)、
   战利品表与掷骰、存档默认值与迁移; 棋盘实例化参数随 T4 世界宿主消费。
   interface: ROBOT_BANDS · ROBOT_PACKS · ROBOT_KIND_TEMPLATES · ROBOT_LEVELS ·
     ROBOT_SEED_BASE · ROBOT_LOOT · ROBOT_SAVE_VERSION · ROBOT_SAVE_DEFAULTS ·
     migrateRobotSave(s, from) · paramsFor(level) · presetFor(level, boardIdx) ·
     debugPresetFor(level, boardIdx) · robotPassed(solved) ·
     robotStars(boardStats) · rollRobotLoot(rnd, level, solvedBoards) ·
     boardSeed(levelIdx, boardIdx) · boardOpts(level, boardIdx) · robotTierFor(band, k) ·
     图章一本家族段(T5): ROBOT_STAMP_KINDS/DAILY/REWARDS/REWARD_TEXT/KEEP_DAYS ·
     robotStampRecord/Trim/Count/Milestones/RewardsDue/RewardFor/
     RewardClaimed/NextLine(薄委托 CampCore.mkStampBook 八件) ·
     robotTodayStr(now)(日期键单点出口) · ROBOT_LOG_KEEP_DAYS
   依赖(均经全局名, 调用期解析): RandCore(js/rand-core.js, boardSeed 派生,
     Node 测试先挂 global) · RobotCore(js/robot-core.js, 仅 presetFor/
     debugPresetFor 用, typeof 守卫兼容精简装载) · CampCore(js/camp-core.js,
     图章一本构造期即用 — 加载序在 robot-levels 之前, Node 测试先挂 global)
   可测性: 零 THREE·零 DOM, 有同名单测 test/robot-levels.test.js
   ============================================================ */

/* ---------- 怪物包(设计稿 §3.2: Robot Turtles 解锁制, 每包只教一个新语义) ----------
   mob = 怪物库 MOB_TYPES 键(本包主角怪); skill = 特技卡语义键(robot-core
   stepSim 的分支键); relay 包无双怪主角——带3 双怪接力由 params.relay 声明
   (铁傀儡 A 段/苦力怕 B 段), 不在此复制怪键 */
const ROBOT_PACKS = [
  {key: 'creeper', mob: 'creeper', name: '找朋友', skill: 'boom', skillName: '炸开'},
  {key: 'golem', mob: 'golem', name: '送快递', skill: 'smash', skillName: '砸碎'},
  {key: 'spider', mob: 'spider', name: '过河', skill: 'climb', skillName: '爬墙'},
  {key: 'chicken', mob: 'chicken', name: '缓降', skill: 'glide', skillName: '滑翔'},
  {key: 'relay', mob: null, name: '大护送', skill: null, skillName: null},
];

/* ---------- 带元数据(地图页/今日页文案与 TTS 用) ---------- */
const ROBOT_BANDS = [
  {name: '跟着走', story: '苦力怕想去找朋友，帮它排好每一步！'},
  {name: '排程序', story: '笨笨的铁傀儡要去送快递，一路障碍靠你啦！'},
  {name: '记忆与找错', story: '小蜘蛛要过河——先看它走一遍，再凭记忆排指令。'},
  {name: '大护送', story: '两只小怪物要接力回家，指挥官，出发！'},
];

/* ---------- 100 关编排(4 带 × 25) ----------
   kind: tut 直接驱动(点一张走一步, D4 防挫败阶梯第一阶) · decode 解码关
   (预置程序缺 1 卡, 研究口径「解码他人程序」) · debug 找错关(预置 1 处
   错误看回放找) · relay 双怪接力 · boss 带末大关 · normal 常规。
   分布为显式模板(测试逐带断言, 防编排漂移): 带0 = 6 tut + 4 decode +
   14 normal + boss; 带2 每 3~4 关混入 1 debug; 带3 后半混入 relay。
   ── 加关纪律(内容契约, 用户拍板 2026-10-28 = 设计稿 D9)──
   只许两动法: ① 追加式扩容(带内 boss 前插新 normal / 带末加新带), 星表
   按关号仍对位, 前沿自然推进——孩子按序玩到新关, 不升版本位;
   ② 插入/重排/删改编排, 必须升 ROBOT_SAVE_VERSION → 星表清空, 从头玩,
   绝不许旧进度把新关标记成已玩(跳关红线)。两动法都保证: 新增关卡
   一定被从头玩到。 */
const ROBOT_KIND_TEMPLATES = [
  /* 带0 */ ['tut', 'tut', 'tut', 'tut', 'tut', 'tut', 'decode', 'decode', 'decode', 'decode',
    'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal',
    'normal', 'normal', 'normal', 'normal', 'normal', 'boss'],
  /* 带1 */ ['normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal',
    'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal',
    'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'boss'],
  /* 带2 */ ['normal', 'normal', 'normal', 'debug', 'normal', 'normal', 'debug', 'normal',
    'normal', 'debug', 'normal', 'normal', 'debug', 'normal', 'normal', 'debug', 'normal',
    'normal', 'debug', 'normal', 'normal', 'debug', 'normal', 'normal', 'boss'],
  /* 带3 */ ['normal', 'normal', 'normal', 'normal', 'normal', 'relay', 'normal', 'normal',
    'relay', 'normal', 'normal', 'relay', 'normal', 'normal', 'relay', 'normal', 'normal',
    'relay', 'normal', 'relay', 'normal', 'relay', 'normal', 'relay', 'boss'],
];

/* 怪物包轮换(每带一行, 入参带内序 k): 带0 全程苦力怕; 带1 前 8 关苦力怕
   (boom 教学), 第 9 关铁傀儡解锁后**全铁傀儡**(D15 v2 拍板: 交替制会让
   两种特技教学互相打断, 单语义连续段更好教; v6 槽位 7 后 boom 已能出
   1 转 3×3 微盘, 教学期 k1 起即出弯, 但「一包教一个语义」的分段不变);
   带2 前 8 蜘蛛(climb)接 8 小鸡(glide)再交替; 带3 relay 关用 relay 包,
   其余**全铁傀儡**——v7 苦力怕退出带3: boom 代价 +3 下 3 转盘预算盒
   只剩 3×3×dz2 一种形状, 指令池 = 2 < 4, 同关防重(v7 红线)数学不可满足;
   苦力怕的规划练习由带0 全程与带1 教学期承接 */
const ROBOT_PACK_ROTATION = [
  (k) => 'creeper',
  (k) => (k < 8 ? 'creeper' : 'golem'),
  (k) => (k < 8 ? 'spider' : (k < 16 ? 'chicken' : (k % 2 === 0 ? 'spider' : 'chicken'))),
  (k) => (ROBOT_KIND_TEMPLATES[3][k] === 'relay' ? 'relay' : 'golem'),
];

function robotTierFor(band, k) {
  return Math.min(19, band * 5 + Math.floor(k / 5) + 1); /* 带×5+带内序÷5, 顶格 19 */
}

const ROBOT_LEVELS = [];
for (let band = 0; band < 4; band++) {
  for (let k = 0; k < 25; k++) {
    const i = band * 25 + k;
    ROBOT_LEVELS.push({i, band, k, kind: ROBOT_KIND_TEMPLATES[band][k],
      pack: ROBOT_PACK_ROTATION[band](k), tier: robotTierFor(band, k)});
  }
}

/* ---------- 难度曲线 paramsFor(level) ----------
   沿「程序长度」爬坡(研究 §6.2.1): 主轴=槽位上限(带0 3/4 → 带3 10),
   棋盘尺寸次要轴(4×4 → 7×7); 特征量随包给(skill 错配自动归零——mkBoard
   同款静默少放语义); previewSec=演示脚印淡出秒数(0=无消退, 带0/1 恒 0,
   构念保护: 教学类关不消退); trapRate=托盘出现闪亮陷阱卡概率(带2 起渐进
   混入——focus-revamp「台阶变坡道」口径); decoy=假旗数(带3 起, 无害档);
   turnsMin=路径转弯下限(形状闸③, D15 转弯爬坡, mkBoard 装不下自动降档) */
function paramsFor(level) {
  const band = level.band;
  const t = level.tier;
  const meta = ROBOT_PACKS.find((p) => p.key === level.pack) || {};
  /* 带0 封印特技卡(D4 防挫败阶梯: 先学会走和转); 软/水/台特征量随 skill
     归零——mkBoard 静默少放语义, 托盘 S 卡(modes/robot.js 按 p.skill 派生)
     随之不出, 与设计稿 §4 带表一致(带0 只有走/转) */
  const skill = level.band === 0 ? null : (meta.skill || null);
  const relay = level.kind === 'relay';
  /* 槽位上限: 带0 直接驱动 1 张/其余 6 张; 带1 = 8 · 带2 = 9 · 带3 = 10
     —— v7 再升(带0 5→6 / 带1 7→8 / 带2 8→9): 同关 4 盘指令不得重复
     (v7 用户红线), 预算盒的指令池必须 ≥ 4——带0 2 转 cap5 池只有 2
     (FRFLF/FLFRF 必撞)、带1 boom 1 转 cap7 池也只有 2、带2 3 转 cap8
     池只有 4(10 关共用一组), 各升 1 张后风味条目够分。par 阶梯
     5(1转) → 6(2转) → 8 → 9 → 10 逐档只升 */
  const slots = band === 0 ?
    (level.kind === 'tut' ? 1 : 6) :
    [0, 8, 9, 10][band];
  /* 转弯爬坡(D15 v6, 用户 2026-11-01「1-3 关重做, 除第一关第一盘都带弯;
     难度提升一档, 第 4 关难度作为第一关标准, 后续依次提升」): v5 已做到
     par 阶梯逐关不降(预算全关给足 + 形状盘 dz 恒上限), v6 把前段整体
     上移一档——旧第 4 关的 1 转/par4 成为本关新标准:
     带0 = 1 转(tut k0-2; 第 1 关第 1 盘特批直路, 见 boardOpts) → 2 转
     (k3+ 全线: tut/decode/normal/boss, par 5) · 带1 boom 1/smash 2 ·
     带2 2→3 · 带3 恒 3 —— 跨带不回降, par 阶梯 4→5→7→8→10。历史:
     v4 削直线(槽位微升换转弯预算) · v5 修难度倒挂(tut 预算闸 4 封顶 +
     dz 恒上限 + 跨带不回降)。带内不减(台阶不变陡) */
  const skillExtra = skill === 'boom' ? 3 : skill === 'smash' ? 1 : 0;
  let turnsMin = band === 0 ?
    (level.kind === 'tut' && level.k < 3 ? 1 : 2) :
    band === 1 ? (skill === 'smash' ? 2 : 1) :
    band === 2 ? (level.k < 15 ? 2 : 3) :
    3;
  /* 预算闸(parCap): 非 tut = 槽位; tut = 5(1 转 k0-2)/6(2 转 k3+,
     直接驱动 5/6 次点按)——v7 随防重预算盒再放宽(1 转指令池 6、2 转
     指令池 8 都需要 cap 5/6 才装得下)。历史: v5 封顶 4 修难度倒挂,
     v6 放宽到 4/5 */
  const parCap = level.kind === 'tut' ? (level.k < 3 ? 5 : 6) : slots;
  /* 宽度让步(§4 次要轴): t 转盘需 (w-1) + ceil(t/2) + t + skillExtra ≤
     预算, 反解 w 上限; 预算口径=parCap。装不下(下限 3 都不够)就静默降回
     直路——请求必可交付, 不依赖 mkBoard 预检兜底。v7: v4 弯深让步
     (wTurnMax ≥4 且 t≤2 再收一格宽)退役——盘位风味(boardFlavor)在预算
     盒内抽样 宽×纵深, 弯深由 dz 抽样表达, 不再压盘宽(压宽 = 指令池
     变小 = 同关防重的天敌) */
  const turnCap = parCap;
  let wTurnMax = 0;
  if (turnsMin > 0) {
    const needDz = Math.ceil(turnsMin / 2);
    wTurnMax = turnCap - turnsMin - skillExtra - needDz + 1;
    if (wTurnMax < 3) turnsMin = 0;
  }
  /* 棋盘尺寸: 带内后半放大一级, 带尺寸表封顶; boom 关宽钳到 slots-2 ——
     程序长度主轴优先, 次要轴(棋盘)让步: boom 代价恒 +3 卡(S+打盹吞 2),
     v4 后仅带1 k0 首课直路 5×5(par=7 恰满); 转向盘再让: 宽度钳到
     wTurnMax(弯深让步已含在内) */
  const grow = level.k < 12 ? 0 : 1;
  const size = [[4, 5], [5, 6], [6, 6], [7, 7]][band];
  let w = Math.min(size[0] + grow, size[1],
      skill === 'boom' ? slots - 2 : size[1]);
  if (turnsMin > 0) w = Math.min(w, wTurnMax);
  const h = w;
  /* 特征量: 包解锁首关给 1 个(只教一个新语义), 之后 1~2 随 tier */
  const firstOfPack = ROBOT_LEVELS.find((l) => l.pack === level.pack && l.band === band);
  const isUnlock = !!firstOfPack && firstOfPack.i === level.i && band > 0;
  const featN = isUnlock ? 1 : Math.min(2, 1 + Math.floor(t / 12));
  const softPath = (skill === 'boom' || skill === 'smash') ? featN : 0;
  const waterPath = skill === 'glide' ? Math.min(2, featN) : 0;
  const ledgePath = skill === 'climb' ? Math.min(2, featN) : 0;
  const previewSec = band >= 2 ?
    (level.kind === 'debug' ? 8 : Math.max(3, 8 - Math.floor(t / 4))) : 0;
  const trapRate = band >= 2 ? Math.min(0.3, 0.05 * (t - 9)) : 0;
  const decoy = band === 3 ? Math.min(2, Math.floor(t / 8)) : 0;
  const groundDecor = Math.floor(w * h / 14) + Math.floor(t / 8);
  const waterDecor = Math.max(1, Math.floor(w / 3));
  return {w, h, slots, parCap, skill, relay, turnsMin, softPath, waterPath,
    ledgePath, groundDecor, waterDecor, previewSec, trapRate, decoy, boards: 4};
}

/* ---------- decode/debug 关预置程序(调用期经全局 RobotCore 派生) ---------- */

const presetBoard = (level, boardIdx) => {
  if (typeof RobotCore === 'undefined') return null;
  return mkBoardUnique(level, boardIdx);
};

/* presetFor: 解码关预置卡列 = BFS 最短解去掉最后一张(孩子补最后一步);
   解过短(<2)则该盘不出题(T5 换下一盘) */
function presetFor(level, boardIdx) {
  if (level.kind !== 'decode') return null;
  const board = presetBoard(level, boardIdx);
  if (!board) return null;
  const sol = RobotCore.parSolution(board);
  return sol && sol.length >= 2 ? sol.slice(0, -1) : null;
}

/* debugPresetFor: 找错关预置卡列 = 最短解中段换一张错卡(确定性: 按卡序
   找第一张能把它弄坏的); 换不坏则不出题 */
function debugPresetFor(level, boardIdx) {
  if (level.kind !== 'debug') return null;
  const board = presetBoard(level, boardIdx);
  if (!board) return null;
  const sol = RobotCore.parSolution(board);
  if (!sol || sol.length < 2) return null;
  const k = Math.floor(sol.length / 2);
  for (const alt of RobotCore.CARDS) {
    if (alt === sol[k]) continue;
    const broken = sol.slice();
    broken[k] = alt;
    if (RobotCore.simulate(board, broken).status !== 'win') return broken;
  }
  return null;
}

/* ---------- 通过门槛与三星(设计稿 §4: ⭐通关 ⭐⭐全对 ⭐⭐⭐par 预算) ---------- */

function robotPassed(solved) {
  return solved >= 3; /* 4 块棋盘答对 ≥3(0.70 训练带同源) */
}

/* boardStats: [{solved: bool, used: 指令数, par: 最短指令数}] —— used ≤ par+1
   算「打到预算」; 全对且 ≥3 块进预算 = ⭐⭐⭐ */
function robotStars(boardStats) {
  const solved = (boardStats || []).filter((b) => b && b.solved).length;
  if (solved < 3) return 0;
  if (solved < 4) return 1;
  const parHits = boardStats.filter((b) => b.solved && b.used <= b.par + 1).length;
  return parHits >= 3 ? 3 : 2;
}

/* ---------- 棋盘实例化参数(T4 世界宿主消费) ---------- */
const ROBOT_SEED_BASE = 20261028;
const boardSeed = (levelIdx, boardIdx) =>
  (typeof RandCore !== 'undefined') ?
    RandCore.seedAt(ROBOT_SEED_BASE, levelIdx, boardIdx) : 0;
/* 盘位风味(v7 防重): 同关 4 盘取不同 宽×纵深 组合 ⇒ 指令串互不相同。
   风味清单 = 预算盒枚举(宽从大到小、纵深从大到小; 锚盘 = 首项 =
   par 贴预算, 关卡阶梯的载体; 第 1 关例外: 盘0 特批直路, 锚 = 盘1);
   盘位按序错开取味 ⇒ 同关结构性不重味; 条目 < 4 的段(带1 boom/带0)
   由 mkBoardUnique 的方向/切分重试兜底。
   w=3 只留最小纵深(v7 探针 i=58 实锤): 小盘 + 特征 + 装饰洞的深纵深
   旁路组合会系统性耗尽重试(glide/climb 尤其)。返回 null = 直路盘 */
function boardFlavor(level, boardIdx) {
  const p = paramsFor(level);
  if (p.turnsMin <= 0) return null;
  const bd = boardIdx || 0;
  const anchorBd = (level.i === 0) ? 1 : 0;
  const skillExtra = p.skill === 'boom' ? 3 : p.skill === 'smash' ? 1 : 0;
  const needDz = Math.ceil(p.turnsMin / 2);
  const wMax = Math.max(3, Math.min(p.w,
      p.parCap - p.turnsMin - skillExtra - needDz + 1));
  const dzMaxOf = (w) =>
    Math.max(needDz, Math.min(w - 1,
        p.parCap - (w - 1) - p.turnsMin - skillExtra));
  const entries = [];
  for (let w = wMax; w >= 3; w--) {
    /* w=3 深纵深钉死仅限 glide/climb(v7 探针 i=58 实锤: 水面/高台特征
       + 装饰洞的旁路组合系统性耗尽重试); boom/smash 无旁路风险不钉 */
    const dzTop = (w === 3 && (p.skill === 'glide' || p.skill === 'climb')) ?
      needDz : dzMaxOf(w);
    for (let dz = dzTop; dz >= needDz; dz--) entries.push({w, dz});
  }
  if (!entries.length) entries.push({w: wMax, dz: needDz});
  let idx = (bd - anchorBd) % entries.length;
  if (idx < 0) idx += entries.length;
  /* 末盘复用锚味时按关轮换复用位(防跨关同指令集——池恰好 4 的段
     带内各关轮着用不同味) */
  if (idx === 0 && bd !== anchorBd) idx = level.i % entries.length;
  return entries[idx];
}

const boardOpts = (level, boardIdx) => {
  const p = paramsFor(level);
  const bd = boardIdx || 0;
  /* 第 1 关第 1 盘特批直路(v6 用户拍板「除了第一关第一盘都带点弯」):
     全游戏第一盘恒纯直线 F 走法首秀, 此后每盘至少 1 转 */
  const turnsMin = (level.i === 0 && bd === 0) ? 0 : p.turnsMin;
  const flavor = boardFlavor(level, bd);
  const w = flavor ? flavor.w : p.w;
  return {w, h: w, skill: p.skill, softPath: p.softPath,
    waterPath: p.waterPath, ledgePath: p.ledgePath,
    groundDecor: p.groundDecor, waterDecor: p.waterDecor,
    /* par 预算闸(mkBoard 三闸①): 非 tut = 槽位; tut = 5/6(曲线单调红线,
       旧「不设闸」让第一关游走出 7 卡长程序, 难度倒挂) */
    parCap: p.parCap,
    dz: flavor ? flavor.dz : undefined,
    turnsMin};
};

/* mkBoardUnique(v7 防重, 用户红线「同一关 4 盘不要重复」): 先重建盘
   0..bd-1 收集指令串(全确定性, 重建即所得), 再以子种子重试当前盘, 直到
   指令串不与之前任何盘相同——预算盒池 ≥ 4(槽位阶梯 v7 扩容的理由),
   40 次重试耗尽理论不可达; 万一耗尽回落最后一次可解盘(宁重复不可无解) */
function mkBoardUnique(level, boardIdx) {
  const bd = boardIdx || 0;
  if (typeof RobotCore === 'undefined' || typeof RandCore === 'undefined') {
    return null;
  }
  const opts = boardOpts(level, bd);
  if (!opts.turnsMin) return RobotCore.mkBoard(boardSeed(level.i, bd), opts);
  const prior = [];
  for (let b = 0; b < bd; b++) {
    const ps = RobotCore.parSolution(mkBoardUnique(level, b));
    if (ps) prior.push(ps.join(''));
  }
  const base = boardSeed(level.i, bd);
  let fallback = null;
  for (let k = 0; k < 40; k++) {
    /* 重试种子用小基数派生(97*7919 ≈ 77 万, level/bd/k 编入低位)——
       严禁在 boardSeed(≈1.6e11) 上再乘 7919: 1.27e15 经 mkBoard 内部
       seedAt(×7919) 变 1.007e19 > 2^53, 种子精度塌缩 = 80 次重试同盘,
       一败全败静默落直路兜底(v7 探针 i=3 实锤) */
    const b = RobotCore.mkBoard(RandCore.seedAt(97, level.i * 160 + bd * 40 + k, 0), opts);
    const s = RobotCore.parSolution(b);
    if (!s) continue;
    fallback = b;
    if (prior.indexOf(s.join('')) < 0) return b;
  }
  return fallback || RobotCore.mkBoard(base, opts);
}

/* ---------- 战利品(设计稿 §8: 怪物包主题化, 只奖不罚) ----------
   池键 ⊆ ITEMS(单测对着 items-core 断言); 教学类关(tut/decode)豁免不掷 */
const ROBOT_LOOT = [
  {common: ['coal', 'coal', 'raw_chicken'], rare: ['gunpowder']},
  {common: ['coal', 'raw_porkchop'], rare: ['iron_ingot']},
  {common: ['string', 'wool'], rare: ['gold_ingot']},
  {common: ['feather', 'raw_chicken'], rare: ['diamond']},
];

/* rollRobotLoot(rnd, level, solvedBoards) → 物品键数组: 每块答对棋盘
   p=0.45 掷一次(2 成稀有), boss 答对 ≥3 追加一件稀有保底; rnd 注入 */
function rollRobotLoot(rnd, level, solvedBoards) {
  const out = [];
  if (level.kind === 'tut' || level.kind === 'decode') return out; /* 教学豁免 */
  const pool = ROBOT_LOOT[Math.min(3, level.band)];
  const roll = () => {
    const from = rnd() < 0.2 ? pool.rare : pool.common;
    return from[Math.floor(rnd() * from.length)];
  };
  for (let k = 0; k < solvedBoards; k++) {
    if (rnd() < 0.45) out.push(roll());
  }
  if (level.kind === 'boss' && solvedBoards >= 3) out.push(pool.rare[0]);
  return out;
}

/* ---------- 存档(家族键名 robot_camp_save, SyncDB.slot 经壳骨架收编) ----------
   版本位 v = 编排内容契约的执行者(加关纪律见 ROBOT_KIND_TEMPLATES 注释):
   升版本位 = 关号语义变化 → 星表清空从头玩; 不升 = 星表按关号对位保留 */
const ROBOT_SAVE_VERSION = 1;
const ROBOT_SAVE_DEFAULTS = {v: ROBOT_SAVE_VERSION, stars: {},
  stamps: {}, stampClaimed: [], stampKind: 'gem', log: {}};

/* 存档迁移(save-slot 的 migrate 链调用, (s, from) 两参): v ≠ 当前版 =
   关号语义变化(插入/重排/删改), 星表一次性清空——新关卡从头玩, 不许
   旧进度跳关(D9 用户拍板); stamps/stampClaimed/stampKind/log 按日期记账
   与关号无关, 原样保留(进度保护: 图章/战利品/家长日志零损失——重玩
   不是惩罚, 是新内容)。v=当前版只做幂等修形: 字段缺/损坏补空 */
function migrateRobotSave(s, from) {
  if (!s || typeof s !== 'object') return {...ROBOT_SAVE_DEFAULTS};
  if (s.v !== ROBOT_SAVE_VERSION) s.stars = {};
  s.v = ROBOT_SAVE_VERSION;
  for (const k of ['stars', 'stamps', 'log']) {
    if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  }
  if (!Array.isArray(s.stampClaimed)) s.stampClaimed = [];
  if (typeof s.stampKind !== 'string') s.stampKind = 'gem';
  return s;
}

/* ---------- 图章一本(modes 层仪式件与单测共用, 形态照 math-levels 图章段) ----------
   robot 独立图章日历(不与 focus/math 共用账本): stamps 形状 {日期: 当日关数}
   (键与 budgetDateStr 同款 'Y-M-D' 无前导零), 落账点在 modes/robot.js 的
   robotSettleSave(单一写入点); 全部无突变。机制单份在 CampCore.mkStampBook
   (八件 record/trim/count/milestones/rewardsDue/rewardFor/rewardClaimed/
   nextLine), 家族差异只注入三参: 达成线表/滚动窗口/日限(dailyCap 按值 6 =
   ROBOT_DAILY_LEVELS, 按值拷贝免跨文件依赖)。口径与家族同构: 当日 ≥1 关
   普通章(图案 stampKind 三选一自选), 满 3 关大章; 集章数按天计; 集章达成线
   只发观感奖励, 永不解锁关卡/难度(红线)。
   达成线表二期再填(奖励领取仪式二期): 表空 = 无观感奖励可发 —— 结算屏
   集章块只报章数进度、领取仪式块恒空、进度行不预告奖励(诚实口径);
   mkStampBook 机制不受影响, 二期填表后 robotStampRewardsDue 的过滤自动
   放行, 仪式链零改动。 */
const ROBOT_STAMP_KEEP_DAYS = 90; // 滚动保留窗口(与日志窗口有意分立, focus 先例)
const ROBOT_STAMP_DAILY = {min: 1, big: 3}; // 当日 ≥1 关普通章 / 满 3 关大章
const ROBOT_STAMP_KINDS = ['gem', 'star', 'plus']; // 自选章图案三选一(stampIcon 合法 kind 子集)
const ROBOT_STAMP_REWARDS = {}; // 达成线 → 观感奖励 id —— 奖励领取仪式二期
const ROBOT_STAMP_REWARD_TEXT = {};

const RobotStampBook = CampCore.mkStampBook({rewards: ROBOT_STAMP_REWARDS,
  keepDays: ROBOT_STAMP_KEEP_DAYS, dailyCap: 6});

/* 落账: 当日计数钳 1~6(日限 ROBOT_DAILY_LEVELS=6, 按值拷贝), 当日取 max
   不重复累加(重玩同日不叠章); 0/负/NaN 关不落账 */
function robotStampRecord(stamps, day, count) {
  return RobotStampBook.record(stamps, day, count);
}

/* 裁剪: 只保留今天起 90 天窗口内的键(防存档膨胀), 机制在 CampCore.trimLog */
function robotStampTrim(stamps, today) {
  return RobotStampBook.trim(stamps, today);
}

/* 集章总数 = 有章天数(每天至多 1 枚; 普通/大章是同一枚章的两种大小) */
function robotStampCount(stamps) {
  return RobotStampBook.count(stamps);
}

/* 达成线: 表内线 + 60/90/…每 30 章递进(二期表空时只剩递进线, 无奖励可发) */
function robotStampMilestones(count) {
  return RobotStampBook.milestones(count);
}

/* 待领 = 已越线 − 已领(差集) 再过一道「表内有奖励」滤网: 二期前恒空 */
function robotStampRewardsDue(count, claimed) {
  const due = RobotStampBook.rewardsDue(count, claimed);
  return due.filter((line) => RobotStampBook.rewardFor(line) !== undefined);
}

/* 达成线 → 奖励 id: 递进线(60/90/…)不在表内, 沿用 30 线(二期填表后生效) */
function robotStampRewardFor(line) {
  return RobotStampBook.rewardFor(line);
}

/* 已领奖励判定(观感恢复用): claimed 线集合里是否领过某奖励 id */
function robotStampRewardClaimed(claimed, rid) {
  return RobotStampBook.rewardClaimed(claimed, rid);
}

/* 下一目标线(集章进度口径): 表内线优先, 过表后为 30 的倍数 */
function robotStampNextLine(count) {
  return RobotStampBook.nextLine(count);
}

/* 今日日期串(单点出口): 薄委托 CampCore.todayStr(其内再委托 budgetDateStr
   — 'Y-M-D' 拼装全库只留在 daily-budget.js 那一处); now 可注入 */
function robotTodayStr(now) {
  return CampCore.todayStr(now);
}

/* 家长日志滚动窗口(与图章窗口有意分立, focus/math 同款双 90) */
const ROBOT_LOG_KEEP_DAYS = 90;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {ROBOT_BANDS, ROBOT_PACKS, ROBOT_KIND_TEMPLATES, ROBOT_LEVELS,
    ROBOT_SEED_BASE, ROBOT_LOOT, ROBOT_SAVE_VERSION, ROBOT_SAVE_DEFAULTS,
    migrateRobotSave, paramsFor, presetFor, debugPresetFor, robotPassed,
    robotStars, rollRobotLoot, boardSeed, boardOpts, mkBoardUnique, robotTierFor,
    ROBOT_STAMP_KINDS, ROBOT_STAMP_DAILY, ROBOT_STAMP_REWARDS,
    ROBOT_STAMP_REWARD_TEXT, ROBOT_STAMP_KEEP_DAYS, robotStampRecord,
    robotStampTrim, robotStampCount, robotStampMilestones, robotStampRewardsDue,
    robotStampRewardFor, robotStampRewardClaimed, robotStampNextLine,
    robotTodayStr, ROBOT_LOG_KEEP_DAYS};
}
