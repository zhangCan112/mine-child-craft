'use strict';
/* ============================================================
   关卡参数表 (FocusLevels) — 应用层·数据表+纯函数
   ------------------------------------------------------------
   专注训练营 2.0 的数值唯一权威: 六维元数据(规则/tip 文案) ·
   paramsFor 难度曲线(tier 1..19, qualitative 跳变一律概率渐进
   混编——台阶变坡道) · 100 关螺旋编排 · 通过门槛/三星 ·
   战利品掉落表与里程碑工具 · 体检/魔鬼特训/图章数据与纯函数。
   数值出处: docs/focus-revamp-design.md §2(D1~D5)/§3(L3~L4)/§8(B1~B8);
   奖励数值(2026-10 调优)出处: docs/focus-reward-tuning-design.md(段位表/EV 台账);
   第六维 search(视觉搜索「矿洞大扫除」, 2026-10)出处: docs/focus-search-dim-design.md
   (证据链: docs/focus-interaction-research.md §A1 — TEA-Ch2 J 5-7 岁常模子测验 Balloon Hunt 系)。
   科学依据(见 MISSION.md): 六维范式 · 每关只动一个难度维度(Davidson 2006)
   · 复习/交错编排 = 间隔效应+交错练习(Cepeda 2006; Klimovich 2025)
   interface: FOCUS_DIMS · FOCUS_META · paramsFor(dim, tier, li) ·
     FOCUS_LEVELS · focusPassed · focusStars · FOCUS_REWARD_STAGES ·
     rewardStageFor(tier) · rewardTrialCount(level, dim) · FOCUS_MILESTONES ·
     milestoneLevels · milestoneDue · focusProgress ·
     rollFocusLoot(level,{ok,dry,dim,seed}) · levelBonusLoot(passed,stars,level,{seed}) ·
     grantFocusLoot(inv,ids) ·
     FOCUS_CHECK_PARAMS · focusFlame · devilStep · devilParams ·
     FOCUS_STAMP_DAILY · FOCUS_STAMP_REWARDS · stampRecord(stamps, day, count) ·
     stampTrim(stamps, today) · stampCount(stamps) · stampMilestones(count) ·
     stampRewardsDue(count, claimed) · stampRewardFor(line) ·
     FOCUS_STAMP_KINDS(自选图案白名单) · stampRewardClaimed(claimed, rid) ·
     focusDayIndex · trimFocusLog · FOCUS_LOG_KEEP_DAYS · FOCUS_DEVIL_TIME_MS ·
     devilDimFor · focusCheckEntry · checkBaseline · devilEntry · devilTierFor ·
     echoParamsFor(tier) ·
     focusTodayStr(now) · focusTodayDims · focusDimStars · focusLastBreakthrough ·
     FOCUS_SAVE_DEFAULTS · migrateFocusSave
     (图章/日期/授予机制同源 CampCore(js/camp-core.js), 此处家族名为薄委托)
   依赖(均经全局名, 调用期解析): CampCore(js/camp-core.js, 加载序先于本文件,
     见 index.html — 图章/日期/授予机制基座, FocusStampBook 在本文件顶层
     实例化, 构造期即用); rollFocusLoot/levelBonusLoot 调用期解析
     RandCore.mkRand(js/rand-core.js, 加载序先于本文件, 见 index.html —
     种子 LCG 全仓唯一实现); FOCUS_META
     的图标字段在构造期调用 mcIcon/creeperFace(js/focus-icons.js, 加载序在
     本文件之前); grantFocusLoot/focusTodayStr 的 add/budgetDateStr 解析
     随机制移居 CampCore(其头注释登记: 经全局名调用期解析)
   可测性: 零 THREE·零 DOM(图标为惰性字符串拼接)·有单测
     (test/focus-paradigms.test.js, vm 直测)
   ============================================================ */

const FOCUS_DIMS = ['cpt', 'gonogo', 'flanker', 'corsi', 'switch', 'search']; // 阶段顺序(六维; search=视觉搜索, 2026-10 第六维追加)
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
      let s = p.disguiseRate >= 1 ? 'TNT 全都会变成绿宝石的样子混进来！手别太快，看清楚再挖。' :
             p.disguiseRate > 0 ? '有的 TNT 会变成绿宝石的样子，手别太快，看清楚再挖。' :
             '钻石变少、TNT 变多了，忍住不碰 TNT 才能拿星星。';
      if (p.defuse) s += '万一碰到 TNT 别慌——引信会烧一小会儿，马上再点它一下就能拆掉！';
      return s;
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
      let s = '要记住 ' + p.len + ' 个' + (p.gem === 'gold_ingot' ? '金锭' : '钻石') + '亮的顺序' +
          (p.grid === 16 ? '，格子也变成 4×4 了' : '') + '。';
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
  search: {name: '视觉搜索', game: '矿洞大扫除', icon: mcIco('iron'),
    rule: '把石头堆里的钻石全都找出来点掉，一颗都别漏！石头和别的矿石不要点。',
    tip(p) {
      let s = '石头堆里一共藏着 ' + (p.rounds*p.targets) +
          ' 颗钻石，全部找出来！越到后面假石头越多，一排一排找就不会漏。';
      if (p.similarMix > 0) {
        s += p.similarMix >= 1 ? '小心！绿宝石长得跟钻石几乎一样，看清楚再点！' :
            '有时候会混进像钻石的绿宝石，看清楚再点！';
      }
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
        // 拆弹窗(P2 停止信号变体, 2026-10): tier≥12 点中 TNT 进入引信燃烧窗,
        // 窗内再点一下=拆弹成功(反应式抑制+错误修正); 引信随档变短
        defuse: tier >= 12,
        fuseMs: Math.round(fLerp(650, 380, t)),
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
    case 'search': { // D6 搜索(2026-10 第六维): 自定步调视觉划消 — 无时窗压迫,
      // 难度轴=网格变大 × 干扰密度上移 × 绿宝石相似混入(与 cpt similar 同款门槛)
      // 结构照 TEA-Ch2 J Balloon Hunt: 首回合纯目标, 后回合渐进混入干扰
      const rounds = 3;
      const targets = 6; // 每回合目标数; 3×6=18 恰为 FOCUS_REWARD_TRIAL_REF(掉落归一天然对齐)
      const cols = Math.round(fLerp(6, 8, t)); // 网格 6×4=24 格 → 8×4=32 格
      const rows = 4;
      const base = fLerp(0.3, 0.55, t); // 干扰密度基线(非目标格成为干扰矿石的概率)
      return {
        trials: rounds*targets, // 奖励试次归一口径(rewardTrialCount 读; 引擎不消费)
        rounds, targets, cols, rows,
        // 回合 1/2 的干扰率(回合 0 恒 0 纯目标 — Balloon Hunt 前段结构), 顶格 0.8 封底
        density: [Math.min(0.8, base), Math.min(0.8, base + 0.15)],
        // 绿宝石混入率(qualitative 跳变一律渐进混编红线): tier8→0.3, 9→0.6, 10→0.9, ≥11→1
        similarMix: tier < 8 ? 0 : Math.min(1, 0.3*(tier-7)),
      };
    }
  }
}

/* ---------- 100 关编排 (螺旋轮换制, 2026-10 起六维) ----------
   - 第 1~6 关: 六个游戏的入门教学关 (从第一关就换着玩)
   - 第 7~99 关: 六个游戏轮换出现, 难度档随轮次递进
     (交错练习+间隔复习合一: Klimovich 2025; Cepeda 2006)
   - 第 100 关: 六维大师考验
   - 特殊变体随难度档渐进混入(新曲线见 paramsFor): 伪装渐入 tier8 ·
     假钻石 tier10 · 五选项 tier10 · 中立行 tier13 · 4×4 格阵 tier14 ·
     混生物 tier15 · 队伍 9 只 tier18 · 绿宝石相似混入 tier8(search)
   - 存量档口径: 编排从五维变六维会重排 unlocked 之后的关卡内容 —
     档位带(tier 公式不变)与通过门槛不动, mkAdapt 阶梯与挫败阀照常兜住
     (决策记录: docs/adr/0008-search-sixth-dim.md) */
const FOCUS_LEVELS = [];
(function generateFocusLevels() {
  for (let i=0; i<100; i++) {
    let dim; let kind = 'normal'; let tier;
    if (i < 6) { // 六个教学关
      dim = FOCUS_DIMS[i];
      kind = 'tutorial';
      tier = 1;
    } else if (i === 99) { // 大师考验
      dim = FOCUS_DIMS[5];
      kind = 'master';
      tier = 19;
    } else { // 螺旋轮换
      const k = i - 6;
      dim = FOCUS_DIMS[k % 6];
      tier = Math.min(19, 2 + Math.floor(k / 5));
    }
    FOCUS_LEVELS.push({i, stage: Math.floor(i/5)+1, dim, kind, tier, params: paramsFor(dim, tier, i)});
  }
  // 大师关: 六维连续小节(各 tier 8 难度)
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

/* ---------- 矿袋段位奖励表(奖励调优 2026-10, docs/focus-reward-tuning-design.md) ----------
   品质镜像探险深度带(adventure-core D5): 段越深矿越贵——段1 煤带级 → 段4
   钻带级(钻石只在此段出现, 金段3 首见, 铁锭全程不发——烧炼教学归探险)。
   幅度随段递增(变率 p 0.06→0.15 · 通关 1→2 件 · 三星追加煤→钻), 总量压至
   旧口径(固定 p=0.45+连对保底, 日产约 60 件)的 1/3~1/5: 段1 日约 11 件、
   段4 满载约 25 件。奖励形态依动机研究(docs/reward-model-research.md §4):
   变率掷骰=意外层(意外奖励 d≈0 无害), 通关/三星=庆祝层, 星级/火苗=能力
   反馈层; 连对保底(每满 3 必得=预期的实物工资, completion-contingent
   d=−0.36)退役, 防空关挫败改关内干燥兜底(连续 FOCUS_REWARD_DRY 个答对
   未掉则必得, Schreiber L7 干燥期后必给大奖的背书)。概率和=1, id 全部在
   物品注册表注册(items-core 的 ITEMS)。
   复用契约(后续带奖励模式接入同构预算治理, 见设计文档 §5): 登记段位表
   {tier 门槛, p, pool, bonus, star3} + 试次基准 + 干燥阈值三件即可,
   掉落永远不与表现排名挂钩(差额奖励 d=−0.88 最危险形态, 红线)。 */
const FOCUS_REWARD_STAGES = [
  {tier: 2, p: 0.06, pool: {coal: 0.55, cobble: 0.25, planks: 0.20},
    bonus: [['torch']], star3: [['coal']]},
  {tier: 6, p: 0.09, pool: {coal: 0.35, iron_ore: 0.30, cobble: 0.20, clay_ball: 0.15},
    bonus: [['torch', 'apple']], star3: [['coal']]},
  {tier: 11, p: 0.12, pool: {coal: 0.25, iron_ore: 0.35, bread: 0.20, bone_meal: 0.10, gold_ingot: 0.10},
    bonus: [['apple', 'bread']], star3: [['gold_ingot']]},
  {tier: 16, p: 0.15, pool: {iron_ore: 0.40, coal: 0.12, bread: 0.25, gold_ingot: 0.15, diamond: 0.08},
    bonus: [['bread', 'apple'], ['iron_ore']], star3: [['diamond']]},
];

/* 矿袋掷骰政策(F5 起源 → 奖励调优): 种子可注入的纯函数。seed 缺省走
   Math.random(运行时); 注入数字则用与测试惯例同常数的 LCG — 同 seed
   同输出, 概率边界可锁定。HUD/飞入观感/满包 toast 归模式层
   (modes/focus.js), 本层只出决策。 */
const FOCUS_REWARD_TRIAL_REF = 18; // 试次归一基准: 各维每关期望产次趋同
const FOCUS_REWARD_DRY = 10; // 干燥兜底: 关内连续 10 个答对未掉, 下一答对必得

/* tier → 奖励段行(纯函数): 返回 tier 所属段的表行; 教学(tier1)/越界无段
   返回 null(掷骰侧另有教学豁免双保险, 此处防御不奖励白给) */
function rewardStageFor(tier) {
  let st = null;
  for (const row of FOCUS_REWARD_STAGES) {
    if (tier >= row.tier) st = row;
  }
  return st;
}

/* 该关该维度的期望试次数(纯函数): 普通关读 params, 大师关 sections 各节
   各归各(dim 补注); corsi 无 trials 用 seqs 兜底, 未知回落基准(=归一 1.0) */
function rewardTrialCount(level, dim) {
  const d = dim || level.dim;
  if (Array.isArray(level.sections)) {
    const sec = level.sections.find((s)=>s.dim === d);
    if (sec) return sec.params.trials || sec.params.seqs || FOCUS_REWARD_TRIAL_REF;
  }
  if (d === level.dim && level.params) {
    return level.params.trials || level.params.seqs || FOCUS_REWARD_TRIAL_REF;
  }
  /* 维度补注与本体不同且无对应节(防御): 按该维度难度现算期望试次 */
  const p = paramsFor(d, level.tier || 1) || {};
  return p.trials || p.seqs || FOCUS_REWARD_TRIAL_REF;
}

/* t = {ok, dry, dim, seed} → itemId|null; dry = 关内连续答对未掉计数
   (模式层维护, 关开始清零, 答错清零), 达 FOCUS_REWARD_DRY 跳过掷骰必得;
   骰值取件机制在 CampCore.pickWeighted(骰值落累积区间取件+浮点尾差兜底) */
function rollFocusLoot(level, t) {
  const e = t || {};
  if (level.kind === 'tutorial' || !e.ok) return null; // 教学豁免 + 只奖不罚
  const st = rewardStageFor(level.tier);
  if (!st) return null; // 无奖励段(防御)
  const rnd = RandCore.mkRand(e.seed);
  // 试次归一: corsi 6 序列 vs cpt 28 试次, 不归一则记忆维度关恒穷
  const pEff = st.p * FOCUS_REWARD_TRIAL_REF / rewardTrialCount(level, e.dim);
  if (!(e.dry >= FOCUS_REWARD_DRY) && rnd() >= pEff) return null; // 未中
  return CampCore.pickWeighted(st.pool, rnd());
}

/* 段位表条目展开(纯函数): [[a,b],[c]] → 掷骰选一 + 固定 c 的 id 清单 */
function expandRewardEntries(entries, rnd) {
  const out = [];
  for (const one of entries || []) {
    out.push(one.length === 1 ? one[0] : one[Math.min(one.length - 1, Math.floor(rnd() * one.length))]);
  }
  return out;
}

/* 结算奖励(庆祝层): 通关按段位表展开 bonus, 三星追加 star3; 未通过/教学关
   不发。内层数组单元素=固定得, 多元素=掷骰选一(保留开箱风味); opts = {seed} */
function levelBonusLoot(passed, stars, level, opts) {
  const o = opts || {};
  if (!passed || !level || level.kind === 'tutorial') return [];
  const st = rewardStageFor(level.tier);
  if (!st) return [];
  const rnd = RandCore.mkRand(o.seed);
  const out = expandRewardEntries(st.bonus, rnd);
  if (stars >= 3) out.push(...expandRewardEntries(st.star3, rnd));
  return out;
}

/* 战利品入包授予流(F3 核定口径): 机制基座在 CampCore.grantLoot(逐件 add
   进背包本体, 余量>0 静默忽略不入 granted 清单并标 full), 此处家族名为
   薄委托 — 每关至多一次「背包满啦」toast 与 save 时机归模式层 */
function grantFocusLoot(inv, ids) {
  return CampCore.grantLoot(inv, ids);
}

/* ---------- 里程碑工具表(设计稿 §3 L4 · spec 实现决策 9/17): 进度阶梯 ----------
   unlocked 首次越线授予(木镐→钻镐→钻剑的长线追求); 与图章习惯阶梯双轨
   独立计数; 工具不进共享背包(F3 混装核定选型 B)——记账进训练营存档
   tools 字段(已授 id 集合), 宝物柜工具组从该字段渲染。 */
const FOCUS_MILESTONES = {
  10: 'pick_wood', 30: 'pick_stone', 50: 'pick_iron',
  70: 'sword_iron', 90: 'pick_diamond', 100: 'sword_diamond',
};

/* 里程碑升序派生的唯一出口(纯函数): 门槛升序的 [{line, id}] 清单 —
   milestoneDue 应授差集与宝物柜工具组渲染两处共用, 升序编排只此一份,
   消费方不得再手抄 Object.keys+sort */
function milestoneLevels() {
  return Object.keys(FOCUS_MILESTONES).map(Number).sort((a, b) => a - b)
      .map((k) => ({line: k, id: FOCUS_MILESTONES[k]}));
}

/* 应授差集(纯函数, 幂等): progress ≥ 门槛且不在已授集合内的工具 id,
   按门槛升序返回; 存量档补授 = 差集一次性追授(F6), 再次计算自然得
   空集(不重授); 授予流 = 结果并入存档 tools 字段 */
function milestoneDue(progress, tools) {
  const owned = new Set(tools || []);
  return milestoneLevels()
      .filter((e) => progress >= e.line && !owned.has(e.id))
      .map((e) => e.id);
}

/* 有效通关数(纯函数, 里程碑的进度口径): unlocked 在模式层被 99 封顶
   (通关后不再前进, 今日页索引用), 第 100 关大师考验的进度兜底取
   history 里已通关最高关号——大师关(i=99)通关可到 100, 钻剑不漏发 */
function focusProgress(save) {
  let top = (save && typeof save.unlocked === 'number') ? save.unlocked : 0;
  if (save && Array.isArray(save.history)) {
    for (const h of save.history) {
      if (h && h.passed && typeof h.i === 'number') top = Math.max(top, h.i + 1);
    }
  }
  return top;
}

/* ---------- 每日体检短参数(设计稿 §8 B3) ----------
   复用大师关的六维连跑机制(sections 分发), 各维度取低档(tier 2)
   短参数、每节约 6 试次; 计费归模式层(F8): 计入时长、不占关数额度 */
const FOCUS_CHECK_PARAMS = FOCUS_DIMS.map((dim) => {
  const p = {...paramsFor(dim, 2)};
  if (dim === 'search') { // 搜索自定步调无试次轴: 减回合/目标/列控时长(2×4=8 目标)
    p.rounds = 2; p.targets = 4; p.cols = 5; p.trials = 8;
  } else if (p.trials) {
    p.trials = 6; // corsi 无 trials, 序列数本就是 6
  }
  return {dim, params: p};
});

/* 探险家火苗(设计稿 §8 B3): 三档按当次六维平均正确率映射(≥85 大/≥70 中/其余小);
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

/* ---------- 回声矿洞(听觉持续注意, 2026-10 P1 附加块) ----------
   数狗叫式(TEA-Ch2 J Barking 系, 证据 docs/focus-interaction-research.md §A2):
   一段长间隔的狼嚎声里数共有几声, 听完点一样多的答案格; 干扰声(猫叫)高 tier
   渐入(Hide & Seek Auditory 系)。长间隔=任务"不抓"注意, 考核自主维持(Barking
   官方设计意图); 目标/干扰音色恒定合成采样(音色漂移即知觉干扰, 调研 §A2 警示)。
   形态=今日页附加块(不进 100 关螺旋, 不重排存量进度): 计 1 关额度, 每日一次。
   纯函数只出参数, 引擎在 focus-paradigms.js, 流程装配在 modes/focus.js */
function echoParamsFor(tier) {
  const t = Math.min(1, Math.max(0, (tier-1)/18));
  return {
    trials: 5, // 回合数=试次数(每回合听一段答一次)
    barkMin: tier < 5 ? 2 : 3, // 低档 2~3 声起步
    barkMax: Math.round(fLerp(3, 6, t)), // 顶格 3~6 声
    isi: Math.round(fLerp(2200, 1500, t)), // 声间隔秒级(刻意"慢而无聊", Barking 同款)
    decoyRate: tier < 8 ? 0 : Math.min(0.5, 0.15*(tier-7)), // 干扰猫叫混入率渐进
  };
}

/* ---------- F8 每日体检/魔鬼特训的入口与记账纯函数(设计稿 §8 B3/B8) ---------- */
/* 存档按日记录(checks/devil.days)的滚动保留窗口: 防存档膨胀(90 天) */
const FOCUS_LOG_KEEP_DAYS = 90;
/* 魔鬼特训 5 分钟硬顶(到点当前小节打完即强制结束, B8) */
const FOCUS_DEVIL_TIME_MS = 5*60*1000;

/* 今日日期串(单点出口, focus-levels 的日期工具族): 薄委托 CampCore.todayStr
   (其内再委托 budgetDateStr — 'Y-M-D' 拼装全库只留在 daily-budget.js 那一处)
   — 模式层一律经此取 'Y-M-D' 键; now 可注入(毫秒时间戳)供日历单元格与单测复用 */
function focusTodayStr(now) {
  return CampCore.todayStr(now);
}

/* 日期串(年-月-日 无前导零, budgetDateStr 同款)→本地日序数:
   近 7 天均值与 90 天滚动的日差全部基于它; 损坏串返回 NaN(调用方按"无记录"处理);
   机制在 CampCore.dayIndex, 此处家族名为薄委托 */
function focusDayIndex(dateStr) {
  return CampCore.dayIndex(dateStr);
}

/* 按日记录滚动裁剪(机制在 CampCore.trimLog, 此处家族名为薄委托): 返回只保留
   最近 keepDays 天(含今天)的新对象, 不改原; 未来日期(时钟回拨产物)保留 —
   零惩罚哲学不因设备时钟惩罚孩子; 非法键丢弃(防死数据); today 本身
   非法时原样返回(防御: 不清档)。checks/devil.days 与 stamps 只差窗口
   常量(两个 KEEP_DAYS 有意分立, 见 tickets F10 收口②), 机制不并概念 */
function trimFocusLog(log, today, keepDays) {
  return CampCore.trimLog(log, today, keepDays);
}

/* 魔鬼特训维度按日严格轮换: 日序数(focusDayIndex 派生) % 维度数映射六维
   — 相邻两天必不同维、六天一轮全覆盖, 纯函数不依赖 Date.now */
function devilDimFor(dateStr) {
  const idx = focusDayIndex(dateStr);
  const n = Number.isFinite(idx) ? idx : 0; // 损坏串回落第 0 维(不炸)
  return FOCUS_DIMS[((n % FOCUS_DIMS.length) + FOCUS_DIMS.length) % FOCUS_DIMS.length];
}

/* 体检入口: 当日未做过即可见(当天做完即消失, B3 "每天一次") */
function focusCheckEntry(checks, today) {
  return !checks || !hasFocusDay(checks, today);
}

/* 体检成长基线: 自己近 7 天(不含今天)体检 acc 的均值; 无记录返回 undefined
   (focusFlame 的 brighter 只在此值存在时才作对比 — 只显示变亮, 不显示回落) */
function checkBaseline(checks, today) {
  const t0 = focusDayIndex(today);
  if (!Number.isFinite(t0) || !checks) return undefined;
  let sum = 0; let n = 0;
  for (const k of Object.keys(checks)) {
    const diff = t0 - focusDayIndex(k);
    if (diff >= 1 && diff <= 7 && checks[k] && typeof checks[k].acc === 'number') {
      sum += checks[k].acc; n++;
    }
  }
  return n ? sum/n : undefined;
}

/* 魔鬼特训入口决策: 当日已训→done(入口消失); 关数余额<2→quota(禁用态);
   否则 ok — 特训计 2 关额度, 余额不足时不得开训(B8 预算完整性优先) */
function devilEntry(devil, today, playedCount, capCount) {
  if (devil && devil.days && hasFocusDay(devil.days, today)) return {open: false, reason: 'done'};
  if (playedCount + 2 > capCount) return {open: false, reason: 'quota'};
  return {open: true, reason: 'ok'};
}

/* 孩子在某维度的"当前档": 从待打关(unlocked)向下找该维最近一关的 tier —
   魔鬼特训挑战档 = devilParams(dim, 该档+2)(封顶 19); 前 6 关教学覆盖六维, 循环必命中 */
function devilTierFor(dim, unlocked) {
  for (let i = Math.min(unlocked, 99); i >= 0; i--) {
    if (FOCUS_LEVELS[i].dim === dim) return FOCUS_LEVELS[i].tier;
  }
  return 1; // 不可达兜底(防御性, 不影响正常档)
}

/* 日期键探测(避开原型链与 hasOwnProperty 重复书写) */
function hasFocusDay(log, day) {
  return Object.prototype.hasOwnProperty.call(log, day);
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
const FOCUS_STAMP_KEEP_DAYS = 90; // 滚动保留窗口(含今天), 防存档膨胀(与 FOCUS_LOG_KEEP_DAYS 有意分立, 见 tickets F10 收口②)

/* 自选图章图案三选一白名单(B6 集章 3 章奖励 ⛏️💎🧨): stampIcon 的合法 kind
   子集; 存档字段 stampKind 记孩子选择(缺省 'pick'), 选择器只渲这三个 */
const FOCUS_STAMP_KINDS = ['pick', 'gem', 'tnt'];

/* 图章一本工厂实例: 机制单份在 CampCore.mkStampBook(八件 record/trim/count/
   milestones/rewardsDue/rewardFor/rewardClaimed/nextLine), 家族差异只注入
   三参 — 达成线表/滚动窗口/日限; dailyCap 按值 6(FOCUS_DAILY_LEVELS=6,
   按值拷贝免跨文件依赖), 下方七个家族名为薄委托 */
const FocusStampBook = CampCore.mkStampBook(
    {rewards: FOCUS_STAMP_REWARDS, keepDays: FOCUS_STAMP_KEEP_DAYS, dailyCap: 6});

/* 落账: 当日计数钳 1~6(日限 FOCUS_DAILY_LEVELS=6, 按值拷贝免跨文件依赖),
   当日取 max 不重复累加(重玩同日不叠章); 0/负/NaN 关不落账 */
function stampRecord(stamps, day, count) {
  return FocusStampBook.record(stamps, day, count);
}

/* 裁剪: 只保留今天起 90 天窗口内的键(含今天), 更老与非法键丢弃(防存档膨胀);
   today 本身非法时原样返回(防御: 不清档) — 机制与 trimFocusLog 同一实现
   (共享工具), 仅窗口常量分立 */
function stampTrim(stamps, today) {
  return FocusStampBook.trim(stamps, today);
}

/* 集章总数 = 有章天数(每天至多 1 章; 普通/大章是同一枚章的两种大小, 不双计)。
   统一为防御版: null/undefined 入参从抛错变为 0(空账本按无章处理, math 侧口径) */
function stampCount(stamps) {
  return FocusStampBook.count(stamps);
}

/* 达成线: 表内 3/7/14/30 + 60/90/…每 30 章递进(都是金图章, 30 已在表内) */
function stampMilestones(count) {
  return FocusStampBook.milestones(count);
}

/* 待领 = 已越线 − 已领(差集): 幂等, 领取方把线记进存档后不再重发;
   存量档首次落账时一次性补授全部已越线(观感奖励, 无重复入账风险) */
function stampRewardsDue(count, claimed) {
  return FocusStampBook.rewardsDue(count, claimed);
}

/* 达成线 → 奖励 id: 递进线(60/90/…)不在表内, 沿用 30 的金图章 */
function stampRewardFor(line) {
  return FocusStampBook.rewardFor(line);
}

/* 已领奖励判定(纯函数): claimed 线集合里是否领过某奖励 id — 矿袋皮肤/
   烟花等持久观感奖励的"进场恢复"与"触发迸发"共用同一口径 */
function stampRewardClaimed(claimed, rid) {
  return FocusStampBook.rewardClaimed(claimed, rid);
}

/* ---------- 今日任务单/我的进步(B2/B5 最小呈现)的派生纯函数 ----------
   编排不动(100 关螺旋是科学编排, 只做呈现升级), 模式层拿清单渲染图标 */

/* 今日任务单: 从待打关(FOCUS_LEVELS[unlocked])起取今日预算内将轮到的
   维度, 按出场序去重, 至多 2 个(今日先玩什么的一行图标) */
function focusTodayDims(unlocked, remaining) {
  const dims = [];
  const cur = Math.min(Math.max(0, unlocked || 0), 99);
  for (let k = 0; k < remaining && cur + k < 100; k++) {
    const d = FOCUS_LEVELS[cur + k].dim;
    if (!dims.includes(d)) dims.push(d);
    if (dims.length >= 2) break;
  }
  return dims;
}

/* 我的进步·六维星柱: 各维累计星数(stars 按关卡号归维求和; 每关历史最高,
   重玩不稀释——防刷天然满足)。返回六维齐全的计数对象, 零星也占位 */
function focusDimStars(save) {
  const out = {};
  for (const d of FOCUS_DIMS) out[d] = 0;
  if (save && save.stars) {
    for (const k of Object.keys(save.stars)) {
      const lv = FOCUS_LEVELS[+k];
      if (lv) out[lv.dim] += save.stars[k] || 0;
    }
  }
  return out;
}

/* 我的进步·最新突破维: history 里最近一条通过记录的维度(无记录 null)
   — B5 只呈现累计与突破, 不呈现下滑 */
function focusLastBreakthrough(save) {
  if (!save || !Array.isArray(save.history)) return null;
  for (let k = save.history.length - 1; k >= 0; k--) {
    const h = save.history[k];
    if (h && h.passed && typeof h.i === 'number' && FOCUS_LEVELS[h.i]) {
      return FOCUS_LEVELS[h.i].dim;
    }
  }
  return null;
}

/* ---------- 训练营存档形状(纯函数, modes/focus.js 的 slot 与 vm 单测共用) ----------
   FOCUS_SAVE_DEFAULTS: 新档默认形状(mkSaveSlot 浅并入幂等补缺);
   migrateFocusSave(s, from): 按 fromVer 迁移一步(幂等 — 已是好形状再跑
   原样), 供 save-slot 的 migrate 链调用; 存量进度字段原样保留 */
const FOCUS_SAVE_DEFAULTS = {unlocked: 0, stars: {}, history: [], tools: [],
  stamps: {}, stampClaimed: [], stampKind: 'pick',
  checks: {}, devil: {levels: {}, days: {}}, echo: {days: {}}};

function migrateFocusSave(s, from) {
  if (from === 0 && s && s.daily) delete s.daily; // v0 老形状可能仍带 daily(已迁 daily_budget_save) → 摘除
  if (s && !Array.isArray(s.tools)) s.tools = []; // F6: 里程碑工具记账字段幂等补缺/修形
  if (s && !FOCUS_STAMP_KINDS.includes(s.stampKind)) s.stampKind = 'pick'; // B6: 自选图章图案字段修形(缺/损坏回落默认镐章)
  return s;
}
