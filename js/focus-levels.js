'use strict';
/* ============================================================
   关卡参数表 (FocusLevels) — 应用层·数据表+纯函数
   ------------------------------------------------------------
   专注训练营 2.0 的数值唯一权威: 五维元数据(规则/tip 文案) ·
   paramsFor 难度曲线(tier 1..19, qualitative 跳变一律概率渐进
   混编——台阶变坡道) · 100 关螺旋编排 · 通过门槛/三星 ·
   战利品掉落表与里程碑工具 · 体检/魔鬼特训/图章数据与纯函数。
   数值出处: docs/focus-revamp-design.md §2(D1~D5)/§3(L3~L4)/§8(B1~B8)。
   科学依据(见 MISSION.md): 五维范式 · 每关只动一个难度维度(Davidson 2006)
   · 复习/交错编排 = 间隔效应+交错练习(Cepeda 2006; Klimovich 2025)
   interface: FOCUS_DIMS · FOCUS_META · paramsFor(dim, tier, li) ·
     FOCUS_LEVELS · focusPassed · focusStars · FOCUS_LOOT · FOCUS_MILESTONES ·
     FOCUS_CHECK_PARAMS · focusFlame · devilStep · devilParams ·
     FOCUS_STAMP_DAILY · FOCUS_STAMP_REWARDS · stampRecord(stamps, day, count) ·
     stampTrim(stamps, today) · stampCount(stamps) · stampMilestones(count) ·
     stampRewardsDue(count, claimed) · stampRewardFor(line)
   依赖(均经全局名): 纯函数无依赖; FOCUS_META 的图标字段在构造期调用
     mcIcon/creeperFace(js/focus-icons.js, 加载序在本文件之前, 见 index.html)
   可测性: 零 THREE·零 DOM(图标为惰性字符串拼接)·有单测
     (test/focus-paradigms.test.js, vm 直测)
   ============================================================ */

const FOCUS_DIMS = ['cpt', 'gonogo', 'flanker', 'corsi', 'switch']; // 阶段顺序
const mcIco = (n) => '<img class="f-mcicon" draggable="false" src="' + mcIcon(n) + '">';
const FOCUS_META = {
  cpt: {name: '持续警觉', game: '矿洞瞭望塔', icon: mcIco('torch'),
    rule: '看到钻石，快点点它！别的矿不要点。',
    tip(p) {
      return p.similar ? '小心！绿宝石长得像钻石，看清楚了再点！' :
             '矿灯闪得' + (p.isi < 1150 ? '很快' : '比较快') + '，钻石出现得不多，眼睛要一直盯着。';
    }},
  gonogo: {name: '抑制控制', game: '挖矿小能手', icon: mcIco('pickaxe'),
    rule: '钻石快挖！别的矿和 TNT 都不要碰。',
    tip(p) {
      return p.disguiseRate >= 1 ? 'TNT 全都会变成绿宝石的样子混进来！手别太快，看清楚再挖。' :
             p.disguiseRate > 0 ? '有的 TNT 会变成绿宝石的样子，手别太快，看清楚再挖。' :
             '钻石变少、TNT 变多了，忍住不碰 TNT 才能拿星星。';
    }},
  flanker: {name: '干扰控制', game: '苦力怕排队', icon: '<img class="f-mcicon" draggable="false" src="'+creeperFace(1)+'">',
    rule: '只看中间那只苦力怕，它看哪边，就点哪边。',
    tip(p) {
      let s = '队伍变成 ' + p.len + ' 只，两边捣乱的苦力怕' + (p.congruentRate < 0.6 ? '很多' : '不少') + '。记住：只看中间那只！';
      if (p.neutralRate > 0) s += '有的位置会换成中立的猪和羊，别被它们带偏！';
      if (p.mobMix > 0) s += '队伍里还会混进别的生物，只认苦力怕！';
      return s;
    }},
  corsi: {name: '视空记忆', game: '钻石闪闪光', icon: mcIco('diamond'),
    rule: '看清楚宝石亮的顺序，再按一样的顺序点回去。',
    tip(p) {
      let s = '要记住 ' + p.len + ' 个' + (p.gem === 'gold_ingot' ? '金锭' : '钻石') + '亮的顺序' + (p.grid===16 ? '，格子也变成 4×4 了' : '') + '。';
      if (p.lenMix > 0) s += '有时候会少亮一个，别担心，记住亮过的顺序就好！';
      if (p.antiChunk > 0) s += '格子还会换位置排，别想着只记位置哦！';
      return s;
    }},
  switch: {name: '规则切换', game: '听指挥的小矿工', icon: mcIco('flag'),
    rule: '看旗子！按旗子说的采方块，旗子变了就换方法。',
    tip(p) {
      let s = (p.rules===3 ? '现在有三种旗子：颜色、材质、大小。' : '两种旗子：颜色和材质。') +
          (p.switchJitter ? '旗子说变就变，不定时哦，盯紧它！' : '旗子大约每 ' + p.switchEvery + ' 次换一次，盯紧旗子！');
      if (p.choices === 5) s += '方块变多了，看仔细再点！';
      if (p.bivalent > 0) s += '有的方块会故意长得像目标，只看旗子说的那一样！';
      return s;
    }},
};

function fLerp(a, b, t) {
  return a + (b-a)*t;
}

/* 各范式难度参数: tier 1..19 (关卡在阶段内的档位, 教学关固定 tier 1)
   时间类参数会被关内阶梯微调(calib)缩放 —— 时间放宽=更简单
   设计总则(设计稿 §2): qualitative 变化一律概率渐进混入(p 随 tier 升至封顶),
   不再一步全量; li = 关卡号(0 基, 可选), 供 corsi 宝石按关卡奇偶轮换 */
function paramsFor(dim, tier, li) {
  const t = Math.min(1, Math.max(0, (tier-1)/18)); // 0..1 归一
  switch (dim) {
    case 'cpt': // D1 警觉:更快+目标更少+干扰更相似(校准恰好, 顶格再紧一档)
      return {
        trials: Math.round(fLerp(16, 28, t)),
        isi: Math.round(fLerp(1500, 900, t)), // 间隔
        dur: Math.round(fLerp(1000, 780, t)), // 呈现时长(calib 杠杆)
        targetRate: fLerp(0.55, 0.28, t),
        similar: tier >= 10, // 加入💎的高相似干扰💠
      };
    case 'gonogo': // D2 抑制:Go 更少+伪装渐入+更快(治 tier8 一步全量的墙)
      return {
        trials: Math.round(fLerp(16, 28, t)),
        dur: Math.round(fLerp(1100, 750, t)), // (calib 杠杆)
        goRate: fLerp(0.75, 0.55, t),
        // 伪装率: 每个 No-Go 试次独立掷骰(中则绿宝石伪装, 否则显性 TNT)
        disguiseRate: Math.min(1, Math.max(0, 0.3*(tier-7))), // tier8→0.3, 9→0.6, 10→0.9, ≥11→1.0
      };
    case 'flanker': { // D3 干扰:不一致更多+排更长+中立行+混生物(治无顶碾压)
      const len = tier <= 6 ? 3 : tier <= 11 ? 5 : tier <= 17 ? 7 : 9; // D3 档位表: tier≤6/7~11/12~17/18+
      return {
        trials: Math.round(fLerp(14, 22, t)),
        len,
        congruentRate: fLerp(0.8, 0.35, t), // 顶格不一致占 65%
        window: Math.round(fLerp(2600, 1500, t)), // (calib 杠杆)
        neutralRate: tier >= 13 ? 0.25 : 0, // 中立行(两侧换猪/羊): 引入即顶格
        mobMix: tier >= 15 ? 0.3 : 0, // 行内混入 1~2 只非苦力怕生物(知觉噪声)
      };
    }
    case 'corsi': { // D4 记忆:序列更长+格阵更大+节奏更快(长度/格阵跳档全部混编成坡)
      const clen = (tr) => Math.min(6, 2 + Math.floor(Math.max(0, tr)/4)); // 公式不变, 顶格 6
      const cgrid = (tr) => tr >= 14 ? 16 : 9; // 4×4 推迟到 tier14, 与 len5@tier12 脱钩拆"同档双跳"
      const jump = (tr) => clen(tr) > clen(tr-1) || cgrid(tr) > cgrid(tr-1); // 过渡档=长度跳档或 4×4 首见
      return {
        seqs: 6,
        grid: cgrid(tier),
        len: clen(tier),
        lenMix: jump(tier) ? 0.5 : (jump(tier-1) ? 0.25 : 0), // 过渡档 50% 出 len-1, +1 档 25%——首见 4×4 的 tier14~15 同时吃减载(D4)
        antiChunk: tier >= 16 ? fLerp(0.3, 0.6, (tier-16)/3) : 0, // 顶格反组块: 序列展示前按概率打乱格位
        pace: Math.round(fLerp(850, 600, t)), // (calib 杠杆)
        gem: (li === undefined || li % 2 === 0) ? 'diamond' : 'gold_ingot', // 关卡奇偶轮换(纯风味, 同序列恒一种)
      };
    }
    case 'switch': // D5 切换:规则更多+切换更频繁+五选项+双价干扰(治无顶碾压)
      return {
        trials: Math.round(fLerp(14, 22, t)),
        rules: tier < 6 ? 2 : 3, // 颜色/形状 (+大小) — Davidson 2006: 6 岁 3 规则封顶
        switchEvery: Math.round(fLerp(5, 2, t)),
        switchJitter: tier >= 14, // 切换点改随机 1~3, 不可预测
        choices: tier >= 10 ? 5 : 4, // 第 5 选项(扫视负载)
        bivalent: tier >= 8 ? fLerp(0.5, 1, (tier-8)/11) : 0, // 无关维度匹配 0.5→顶格 1.0(逼孩子只看当前规则维度)
      };
  }
}

/* ---------- 100 关编排 (螺旋轮换制) ----------
   - 第 1~5 关: 五个游戏的入门教学关 (从第一关就换着玩)
   - 第 6~99 关: 每 5 关一轮, 五个游戏轮换出现, 难度档随轮次递进
     (交错练习+间隔复习合一: Klimovich 2025; Cepeda 2006)
   - 第 100 关: 五维大师考验
   - 特殊变体随难度档渐进混入(新曲线见 paramsFor): 伪装渐入 tier8 ·
     假钻石 tier10 · 五选项 tier10 · 中立行 tier13 · 4×4 格阵 tier14 ·
     混生物 tier15 · 队伍 9 只 tier18                                */
const FOCUS_LEVELS = [];
(function generateFocusLevels() {
  for (let i=0; i<100; i++) {
    let dim; let kind = 'normal'; let tier;
    if (i < 5) { // 五个教学关
      dim = FOCUS_DIMS[i];
      kind = 'tutorial';
      tier = 1;
    } else if (i === 99) { // 大师考验
      dim = FOCUS_DIMS[4];
      kind = 'master';
      tier = 19;
    } else { // 螺旋轮换
      const k = i - 5;
      dim = FOCUS_DIMS[k % 5];
      tier = Math.min(19, 2 + Math.floor(k / 5));
    }
    FOCUS_LEVELS.push({i, stage: Math.floor(i/5)+1, dim, kind, tier, params: paramsFor(dim, tier, i)});
  }
  // 大师关: 五维连续小节(各 tier 8 难度)
  FOCUS_LEVELS[99].sections = FOCUS_DIMS.map((d) => ({dim: d, params: paramsFor(d, 8)}));
})();

/* ---------- 通过门槛 / 三星(纯函数, focus.js 与单测共用) ---------- */
/* 通过门槛(科学标准): 正确率≥70%(自适应训练区下界, EndeavorRx 同款目标带)
   警觉/抑制类与大师考验另需命中率≥60% (防止不动手靠"正确拒斥"混过;
   大师关聚合各小节的 goTrials/hits, 口径与单局相同) */
function focusPassed(level, st) {
  if (level.kind === 'tutorial') return true;
  if (st.acc < 0.70) return false;
  if ((level.kind==='master' || level.dim==='cpt' || level.dim==='gonogo') &&
     st.hitRate !== undefined && st.hitRate < 0.6) {
    return false;
  }
  return true;
}
/* 三星:⭐通过 ⭐⭐优秀≥85% ⭐⭐⭐专注之星≥95%且无连续3错 (仅在通过时) */
function focusStars(level, st) {
  if (level.kind === 'tutorial') return 0;
  let s = 1;
  if (st.acc >= 0.85) s++;
  if (st.acc >= 0.95 && st.maxStreakErr < 3) s++;
  return s;
}

/* ---------- 战利品掉落表(设计稿 §3 L3) ----------
   按维度主题化、以基础材料为主(为未来探险经济留余量, ADR 0002);
   概率和=1, id 全部在物品注册表注册(items-core 的 ITEMS)。
   掷骰政策(正确 p=0.45 · 3 连对保底稀有池 · 教学关豁免 · 通关/三星追加)
   归训练营模式层(F5 工单), 本表只出数据; 稀有池五维共用。 */
const FOCUS_LOOT_RARE = {gold_ingot: 0.6, diamond: 0.4};
const FOCUS_LOOT = {
  cpt: {pool: {coal: 0.40, iron_ore: 0.25, torch: 0.20, iron_ingot: 0.12, gold_ingot: 0.03}, rare: FOCUS_LOOT_RARE},
  gonogo: {pool: {cobble: 0.30, coal: 0.25, iron_ore: 0.20, iron_ingot: 0.15, diamond: 0.10}, rare: FOCUS_LOOT_RARE},
  flanker: {pool: {gunpowder: 0.45, string: 0.25, bone: 0.20, slimeball: 0.10}, rare: FOCUS_LOOT_RARE}, // 苦力怕/蜘蛛/骷髅的掉落物
  corsi: {pool: {diamond: 0.40, gold_ingot: 0.25, iron_ingot: 0.20, bone_meal: 0.15}, rare: FOCUS_LOOT_RARE},
  switch: {pool: {planks: 0.25, stick: 0.25, brick: 0.20, clay_ball: 0.15, bread: 0.15}, rare: FOCUS_LOOT_RARE},
};

/* ---------- 里程碑工具表(设计稿 §3 L4): 进度阶梯 ----------
   unlocked 首次越线授予(木镐→钻镐→钻剑的长线追求); 存量档按当前
   unlocked 一次性追溯补授、不重授(补授纯函数归 F6 工单) */
const FOCUS_MILESTONES = {10: 'pick_wood', 30: 'pick_stone', 50: 'pick_iron', 70: 'sword_iron', 90: 'pick_diamond', 100: 'sword_diamond'};

/* ---------- 每日体检短参数(设计稿 §8 B3) ----------
   复用大师关的五维连跑机制(sections 分发), 各维度取低档(tier 2)
   短参数、每节约 6 试次; 计费归模式层(F8): 计入时长、不占关数额度 */
const FOCUS_CHECK_PARAMS = FOCUS_DIMS.map((dim) => {
  const p = {...paramsFor(dim, 2)};
  if (p.trials) p.trials = 6; // corsi 无 trials, 序列数本就是 6
  return {dim, params: p};
});

/* 探险家火苗(设计稿 §8 B3): 三档按当次五维平均正确率映射(≥85 大/≥70 中/其余小);
   brighter 只在超过自己近 7 天体检均值时为真(只显示变亮, 不显示回落, 不与常模比较) */
function focusFlame(acc, baseline) {
  const flame = acc >= 0.85 ? 3 : acc >= 0.70 ? 2 : 1;
  return {flame, brighter: baseline !== undefined && acc > baseline};
}

/* ---------- 魔鬼特训(设计稿 §8 B8) ----------
   每维度独立鬼等级 1~10, 按 85/66 双阈进退(≥85 升 / 66~84 保持 / ≤65 降,
   降级文案中性, 失败零扣损); 挑战档 = 该维度当前档 +2, 封顶 19 */
function devilStep(level, acc) {
  if (acc >= 0.85) return Math.min(10, level + 1);
  if (acc >= 0.66) return level;
  return Math.max(1, level - 1);
}
function devilParams(dim, currentTier) {
  return paramsFor(dim, Math.min(19, currentTier + 2));
}

/* ---------- 图章/集章(设计稿 §8 B1/B6): 习惯阶梯 ----------
   与里程碑工具(进度阶梯)双轨独立计数、互不折算; 漏签无任何负面标记。
   集章只发观感/收集类奖励, 永不解锁关卡/范式/难度(红线);
   30 章起每 30 章递进金图章(60/90/…由 F7 按 章数%30 派生) */
const FOCUS_STAMP_DAILY = {min: 1, big: 3}; // 当日完成 ≥1 关得章, 满 3 关(日限 6 的一半)得大章
const FOCUS_STAMP_REWARDS = {
  3: 'stamp_pattern', // 自选图章图案(⛏️💎🧨 三选一)
  7: 'bag_skin', // 矿袋皮肤(木箱→铁箱)
  14: 'firework', // 宝物柜烟花彩蛋
  30: 'gold_stamp', // 金图章
};

/* ---------- 图章纯函数(F7 工单): 落账/裁剪/集章计数/里程碑判定 ----------
   stamps 形状 {日期: 当日关数}(键与 budgetDateStr 同款 'Y-M-D' 无前导零);
   全部无突变(返回新对象/新数组)。落账点在 modes/focus.js 的结算处,
   count 传当日预算已耗关数(与今日页 dots 同口径, 通过与否都计) */
const FOCUS_STAMP_KEEP_DAYS = 90; // 滚动保留窗口(含今天), 防存档膨胀
const FOCUS_STAMP_DAY_MS = 86400000;

/* 'Y-M-D' → 当天 00:00 时间戳; 非法键 NaN(裁剪时自然丢弃) */
function stampDayTs(day) {
  const m = /^(\d+)-(\d+)-(\d+)$/.exec(String(day));
  return m ? new Date(+m[1], +m[2]-1, +m[3]).getTime() : NaN;
}

/* 落账: 当日计数钳 1~6(日限 FOCUS_DAILY_LEVELS=6, 按值拷贝免跨文件依赖),
   当日取 max 不重复累加(重玩同日不叠章); 0/负/NaN 关不落账 */
function stampRecord(stamps, day, count) {
  if (!(count > 0)) return stamps;
  const n = Math.max(1, Math.min(6, Math.round(count)));
  const next = {...stamps};
  next[day] = Math.max(next[day] || 0, n);
  return next;
}

/* 裁剪: 只保留今天起 90 天窗口内的键(含今天), 更老与非法键丢弃(防存档膨胀);
   today 本身非法时原样返回(防御: 不清档) */
function stampTrim(stamps, today) {
  const t0 = stampDayTs(today);
  if (Number.isNaN(t0)) return stamps;
  const cutoff = t0 - (FOCUS_STAMP_KEEP_DAYS-1)*FOCUS_STAMP_DAY_MS;
  const next = {};
  for (const day in stamps) {
    if (stampDayTs(day) >= cutoff) next[day] = stamps[day];
  }
  return next;
}

/* 集章总数 = 有章天数(每天至多 1 章; 普通/大章是同一枚章的两种大小, 不双计) */
function stampCount(stamps) {
  return Object.keys(stamps).length;
}

/* 达成线: 表内 3/7/14/30 + 60/90/…每 30 章递进(都是金图章, 30 已在表内) */
function stampMilestones(count) {
  const lines = Object.keys(FOCUS_STAMP_REWARDS).map(Number).filter((k) => count >= k);
  for (let m = 60; m <= count; m += 30) lines.push(m);
  return lines.sort((a, b) => a - b);
}

/* 待领 = 已越线 − 已领(差集): 幂等, 领取方把线记进存档后不再重发;
   存量档首次落账时一次性补授全部已越线(观感奖励, 无重复入账风险) */
function stampRewardsDue(count, claimed) {
  const got = new Set(claimed || []);
  return stampMilestones(count).filter((line) => !got.has(line));
}

/* 达成线 → 奖励 id: 递进线(60/90/…)不在表内, 沿用 30 的金图章 */
function stampRewardFor(line) {
  return FOCUS_STAMP_REWARDS[line] || FOCUS_STAMP_REWARDS[30];
}
