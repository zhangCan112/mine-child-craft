'use strict';
/* ============================================================
   数学关卡参数表 (MathLevels, 术语见 GLOSSARY.md) — 应用层·数据表+纯函数
   ------------------------------------------------------------
   数学冒险岛的数值唯一权威: 六族与变体元数据(规则/tip 话术供 TTS,
   rule/tip 可为按 params 求值的函数形态, 零文字依赖口径) · 关卡参数
   装配三段口径(族曲线→变体覆写→带钳制: 数值轨带内微升, 轮转流 k=5
   溢位档按关卡自身 band 钳回本带上限——永不越带) · mathParamsFor 双轨
   难度曲线(推理轨 single→two-step→reverse→multi-solve 分段, 定性跳变
   概率渐进——台阶变坡道, focus-levels 先例) · 120 关螺旋编排(G4 扩容, 四带×30,
   教学关开局/带首复习/带内末 N 次=挑战序列/带末 boss) · 通过门槛/三星(挑战
   挂钩, 补过回溯) · 战利品表与掷骰(简单版) · 存档默认值/迁移。
   数值出处: docs/math-mode-design.md §4/§5 · docs/math-mode-plan.md
   §4~§7(难度双轨=数字跟着教材走, 思维跳到附加题)。
   interface: MATH_FAMILIES · MATH_META · MATH_VARIANTS · MATH_CONTEXTS
     (变体/情境 rule 可为 (p)=>string 函数形态; 变体/情境可覆写 tip) ·
     MATH_RANGES ·
     mathParamsFor(family, tier, li) · MATH_LEVELS ·
     mathPassed(level, st) · mathStars(level, st, famChallengeDone) ·
     mathFamChallengeDone(save, level) · mathThreeStarReady(level, st) ·
     mathLevelStars(save, level)(三星回溯, 地图/结算星显单一出口) ·
     MATH_LOOT · rollMathLoot(level, {ok, streak, seed}) ·
     grantMathLoot(inv, ids) · MATH_LOG_KEEP_DAYS · mathTodayStr ·
     mathDayIndex · trimMathLog · mathPanelMatrix · mathPanelCsv ·
     mathPanelTrend(US42 族趋势序列) · MATH_TREND_DAYS ·
     MATH_STAMP_KINDS/DAILY/REWARDS/REWARD_TEXT/KEEP_DAYS ·
     mathStampRecord(stamps, day, count) · mathStampTrim(stamps, today) ·
     mathStampCount · mathStampMilestones · mathStampRewardsDue ·
     mathStampRewardFor · mathStampNextLine ·
     MATH_SAVE_DEFAULTS · migrateMathSave
     (图章/日期/授予机制同源 CampCore(js/camp-core.js), 此处家族名为薄委托)
   依赖(均经全局名, 调用期解析): CampCore(js/camp-core.js, 加载序在本文件
     之前, 见 index.html — 图章/日期/授予机制基座, MathStampBook 在本文件
     顶层实例化, 构造期即用); rollMathLoot 调用期解析 RandCore.mkRand
     (js/rand-core.js, 加载序在本文件之前 — 种子 LCG 全仓唯一实现);
     MATH_META 的图标字段在构造期调用
     mcIcon(js/focus-icons.js, 加载序在本文件之前, 惰性字符串拼接
     零 DOM); grantMathLoot/mathTodayStr 的 add/budgetDateStr 解析随机制
     移居 CampCore(其头注释登记: 经全局名调用期解析)。
     命名偏离设计稿: 曲线函数叫 mathParamsFor 而非 paramsFor ——
     focus-levels.js 已占用该全局名(经典 script 共享词法环境, 顶层
     重名会静默覆盖, AGENTS.md 加载序即依赖序), 侧工具同前缀避开。
   可测性: 零 THREE·零 DOM(图标为惰性字符串拼接)·有单测
     (test/math-levels.test.js, vm 直测)
   ============================================================ */

/* 六族轮转序: A 数一数 / B 算一算 / C 跳一跳 / D 摆一摆 / E 搭一搭 / F 找一找
   (design §4.1; plan §6 各族条目)。B/C 是数与运算主线, 配重略高(编排见下)。 */
const MATH_FAMILIES = ['count', 'craft', 'hop', 'mirror', 'plan', 'pattern'];

/* 数值轨四带上限(design §4.1 RANGES): 一上 20 以内 → 一下/二上 100 以内 →
   二下万以内。永不越带=带 0 永不出现 >20 的数(防认知负荷失控, plan §1)。 */
const MATH_RANGES = [20, 100, 100, 10000];

/* mcIcon 惰性拼接(focus-levels 的 mcIco 同款): 零 DOM, 只产 <img> 字符串 */
const mIco = (n) => '<img class="m-mcicon" draggable="false" src="' + mcIcon(n) + '">';

/* 六族元数据: name=族名(地图/结算用) · game=岛上场馆名(情境皮肤) ·
   icon=族图标 · rule=规则话术(报幕用, TTS) · tip(params)=>提示话术
   (随曲线档位更新, 供 TTS; 话术面向 6~8 岁, 不依赖识字) */
const MATH_META = {
  count: {name: '数一数', game: '怪物草地', icon: mIco('cobble'),
    rule: '数一数：草地上来了几位小客人？数清楚，点出正确的数字！',
    tip(p) {
      let s = '这次要数到 ' + p.max + ' 个';
      if (p.groupRate >= 1) s += '，可以 5 个 5 个地数啦';
      else if (p.groupRate > 0) s += '，试试 2 个 2 个地数';
      if (p.mixRate > 0) s += '，小心长得像的小家伙会混进来';
      return s + '。';
    }},
  craft: {name: '算一算', game: '合成小屋', icon: mIco('pickaxe'),
    rule: '算一算：看看材料够不够、还差几个？算一算就知道了！',
    tip(p) {
      let s = '这次的数到 ' + p.max;
      if (p.bundleRate > 0) s += '，10 根木棍可以捆成 1 捆哦';
      if (p.reasoning === 'reverse' || p.reasoning === 'multi-solve') s += '，有的题要倒着想';
      return s + '。';
    }},
  hop: {name: '跳一跳', game: '数字小路', icon: mIco('flag'),
    rule: '跳一跳：沿着数字小路跳格子，数一数跳过了几格！',
    tip(p) {
      let s = '小路这次到 ' + p.max;
      if (p.landmark) s += '，每 10 格有一面小旗';
      if (p.zigRate > 0) s += '，有时候要往回跳，看清方向';
      return s + '。';
    }},
  mirror: {name: '摆一摆', game: '魔法镜花园', icon: mIco('wool_red'),
    rule: '摆一摆：照照魔法镜，把另一半摆得一模一样！',
    tip(p) {
      let s = '图案最大有 ' + p.span + ' 格';
      if (p.layerRate > 0) s += '，有的图案是两层的，上下也要照镜子';
      return s + '。';
    }},
  plan: {name: '搭一搭', game: '图纸工地', icon: mIco('brick'),
    rule: '搭一搭：看着图纸搭积木，别忘了藏起来的方块！',
    tip(p) {
      let s = '这次的建筑最多 ' + p.blocks + ' 块';
      if (p.hiddenRate > 0) s += '，有的方块藏起来了，要想着它们';
      return s + '。';
    }},
  pattern: {name: '找一找', game: '花纹集市', icon: mIco('wool_blue'),
    rule: '找一找：看看花纹的规律，选出下一个该是什么！',
    tip(p) {
      let s = '记住 ' + p.unitLen + ' 个一组的花纹';
      if (p.dualRate > 0) s += '，颜色和形状都要看';
      if (p.clueCount === 3) s += '，破案线索有 ' + p.clueCount + ' 条';
      return s + '。';
    }},
};

/* 变体表(design §4.1 · plan §6 · G4 扩容): 每族 3 常规范型(★) + 1~2
   思维挑战变体(★★, kind='challenge', 附加题级——逆向/多解/隐藏/周期;
   G4 起 plan/dualview 与 mirror/bridge 入册, 两族变 3+2)。id 是关卡
   variant 字段与屏流/世界轨分发的键; 常规序即教学关与变体轮换的默认序。
   可选字段 trials = 变体级试次数覆写(关卡生成统一应用): 每题交互长的
   变体据此压住族曲线的 trials — 移多补少(count/balance)是搬动试错,
   一次关卡 2~3 题(US6 纯探索口径); 最省桥(mirror/bridge)摆一座桥
   改动+交卷, 一次关卡 2 座。
   可选字段 tune(p, tier) = 变体级曲线覆写(G4): 挑战变体首遇档低于族
   推理轨, 需要变体内重爬的维度(推理档/候选数/视图数/预算)登记在变体
   条目上 — 数值轴(blocks/span/max)永远跟族曲线走, tune 不触碰(数值
   跟带红线)。
   可选字段 introBand = 挑战变体解锁带(dualview=2 二年级「观察物体」
   同频 · bridge=1): 带内挑战序列 = 挑战变体按 introBand 升序过滤
   introBand≤band 者, 占带内末 N 次轮转位(旧挑战在前, 新变体殿后)。
   可选字段 rule = 变体级规则话术(报幕用, 覆写族 rule — 首遇即讲本
   变体玩法): 可为 (p)=>string 函数形态, 按 tune 后的本关 params 求值
   —— 首遇档呈现不超承诺(dualview 单/双视图两版)。可选字段 tip =
   (p)=>string 变体级提示覆写(优先于族 tip): 变体呈现上限与族数值轴
   不同步时用(hop/position 屏流只画到 cap, 族 tip 报 p.max 会谎报)。 */
const MATH_VARIANTS = {
  count: [ /* A 数一数: 感数与计数 → 对应与比较 (T1) */
    {id: 'snapshot', name: '怪物快照'},
    {id: 'fetch', name: '按数取物'},
    {id: 'compare', name: '比多少'},
    {id: 'balance', name: '移多补少', kind: 'challenge', trials: 3,
      rule: '移多补少：两堆不一样多，点一个方块搬过去，让两边一样多！'},
  ],
  craft: [ /* B 算一算: 配方算术 → 逆向与代换 (T2/T5) */
    {id: 'enough', name: '材料够不够'},
    {id: 'shortage', name: '还差几个'},
    {id: 'order', name: '合成订单'},
    {id: 'blank', name: '魔法空格', kind: 'challenge',
      rule: '魔法空格：算式里少了一个数，想一想该是几？点出来！'},
  ],
  hop: [ /* C 跳一跳: 数字线跳格子 → 数序、间隔与数列规律 (T3) */
    {id: 'dice', name: '掷骰前进'},
    {id: 'jumps', name: '跳格子任务'},
    {id: 'position', name: '站位比大小',
      /* tip 覆写: 屏流呈现上限是 cap(math-paradigms.js mHopPosition 同款
         公式, 改一处须同步另一处), 族 tip 报 p.max 在带 3 会谎报 1000 */
      tip(p) {
        const cap = Math.max(10, Math.min(p.max || 20, 100));
        let s = '小路这次到 ' + cap;
        if (p.landmark) s += '，每 10 格有一面小旗';
        return s + '。';
      }},
    {id: 'gaps', name: '间隔问题', kind: 'challenge',
      rule: '间隔问题：先点红色出发小旗，走一走，数一数间隔！'},
  ],
  mirror: [ /* D 摆一摆: 对称建造 → 空间想象与拼组 (T4) */
    {id: 'reflect', name: '魔法镜补全'},
    {id: 'translate', name: '平移复制'},
    {id: 'rotate', name: '旋转对称'},
    {id: 'tangram', name: '拼组与省料', kind: 'challenge',
      rule: '拼组与省料：用积木把玻璃格子全部盖住，不多也不少！'},
    {id: 'bridge', name: '最省桥', kind: 'challenge', introBand: 1, trials: 2,
      /* 曲线(G4, US20): 推理档沿族轨 reverse(带 1 首遇, 先「能过」→
        multi-solve(带 2+, 后「最省」— 恰与 mathReasoningOf 同段, tune
        不覆写 reasoning; 只给预算宽松度 budget: reverse 档 par+3
        (预算牌提示不卡线, 判定=能走通即对) · multi-solve 档 par(+0,
        判定=能走通且 ≤par — 一次最省=acc 满=三星, 改过再省=二星口径
        由 acc 自然映射)。span 数值轴驱动跨度(mkBridgePuzzle 每 5 格
        预算 ≈1 格跨度), 永不越带 */
      tune(p) {
        return {...p, budget: p.reasoning === 'multi-solve' ? 0 : 3};
      },
      rule: '最省桥：在河面上搭一座能走过去的桥！块数有限，越省越棒！'},
  ],
  plan: [ /* E 搭一搭: 按图搭建 → 空间计数与视角推理 (T4/T6) */
    {id: 'build', name: '看图施工'},
    {id: 'pick', name: '反向选图'},
    {id: 'hidden', name: '隐藏块推理'},
    {id: 'countall', name: '数方块', kind: 'challenge',
      rule: '数方块：藏起来的也要数，点出正确答案！'},
    {id: 'dualview', name: '双视角推理', kind: 'challenge', introBand: 2,
      /* 曲线(G4, US24): dualview 首遇在带 2 末次(tier13) — 族推理轨此处
        已是 multi-solve, 但视角推理是新技能, 推理档在变体内重爬:
        带 2 single(单步匹配: 单正视图谜面 + 2 候选, 谜面与目标唯一
        对应) → 带 3 two-step(两步推理: 双视图谜面 + 4 候选, 单视图
        匹配数>1, 须先正视筛再侧视锁 — mkDualViewPuzzle 核心性质)。
        候选/视图 ≤4 组块红线; blocks 数值轴驱动目标结构与画布尺寸
        (mkWorldBuild 同口径), 永不越带 */
      tune(p, tier) {
        const twoStep = tier >= 16; // 带 3(二下)起双视图
        return {...p, reasoning: twoStep ? 'two-step' : 'single',
          dualCands: twoStep ? 4 : 2, dualViews: twoStep ? 2 : 1};
      },
      /* rule 函数形态: 按 tune 后的视图数分两版 —— 带 2 首遇 single 档
         dualViews=1 只立正面一块投影牌, 不承诺「侧面」句(与引擎
         math-build-world.js speak 的 views 分支同口径) */
      rule(p) {
        return p && p.dualViews === 2 ?
          '双视角推理：正面看是山，侧面看是墙——哪座建筑和两块图纸都一样？点它！' :
          '双视角推理：看一看图纸，哪座建筑和它正面一样？点它！';
      }},
  ],
  pattern: [ /* F 找一找: 接龙与分类 → 模式、周期与推理 (T3/T6) */
    {id: 'chain', name: '花纹接龙'},
    {id: 'sort', name: '分装箱'},
    {id: 'odd', name: '找异类'},
    {id: 'cycle', name: '周期问题', kind: 'challenge',
      rule: '周期问题：花纹按规律重复，下一个是什么？点出来！'},
  ],
};

/* 情境变体登记(T7, plan §6 情境挂载): 挂在既有族上的皮肤变体, 不独立
   成族 — 配重/战利品/日志/挑战表全记在承载族(family 字段), 排班由
   编排生成器在每带首个轮转位换 variant 实现(tier/kind/params
   与族曲线同源, 结构不变量零扰动)。rule/tip 为变体级话术(rule 可为
   (p)=>string 函数形态, 同 MATH_VARIANTS), 模式层 mathLevelMeta 据此
   覆盖族元数据(TTS 零文字依赖)。id 即关卡 variant 与屏流分发键
   (math-paradigms MATH_SCREEN_KEYS 同步在册)。 */
const MATH_CONTEXTS = {
  shop: {family: 'craft', name: '人民币商店',
    rule: '欢迎来到人民币商店！买材料、算找零，想一想付钱有几种付法！',
    tip(p) {
      let s = '商品价钱最多 ' + Math.min(p.max, 100) + ' 元';
      if (p.reasoning === 'reverse' || p.reasoning === 'multi-solve') s += '，有的题要把付钱的方法都找齐哦';
      return s + '。';
    }},
  clock: {family: 'hop', name: '钟表时刻',
    rule: '看一看大钟：长针短针指向哪儿？读出时刻，再算算过一会儿是几点！',
    tip(p) {
      if (p.reasoning === 'single') return '先认整时和半时。';
      if (p.reasoning === 'two-step') return '想一想，过半小时或过一小时是几点。';
      return '过一刻钟是几点？想好了再点！';
    }},
  measure: {family: 'count', name: '测距步数',
    /* rule 函数形态: 往返题只在 reverse/multi-solve 档(math-paradigms.js
       mCountMeasure 的 round 分支), single/two-step 档不承诺「走过去
       再回来」句 —— 首遇档呈现不超承诺 */
    rule(p) {
      const round = !!p && (p.reasoning === 'reverse' || p.reasoning === 'multi-solve');
      return round ? '数一数格子：从小怪物到小旗有几格？走过去再回来又是几格？' :
        '数一数格子：从小怪物到小旗有几格？点出正确的数字！';
    },
    tip(p) {
      const cap = Math.max(6, Math.min(p.max || 20, 60)); // 呈现上限, 与 math-paradigms.js mCountMeasure 同步
      let s = '这次最多数到 ' + cap + ' 格';
      if (p.reasoning === 'reverse' || p.reasoning === 'multi-solve') s += '，来回要走两趟，两倍别忘算';
      return s + '。';
    }},
};

/* family → 情境变体 id(mirror/plan/pattern 暂无情境, 返回 null 照常轮换) */
function mathContextVariantOf(f) {
  for (const id of Object.keys(MATH_CONTEXTS)) {
    if (MATH_CONTEXTS[id].family === f) return id;
  }
  return null;
}

/* ---------- mathParamsFor 双轨难度曲线(design §4.1) ----------
   tier 1..19 = 关卡在族内的档位; band = min(3, floor((tier-1)/4)),
   k = min(4, tier - band*4) = 带内第几档(1..4)。两轨:
   · 数值轨: 每族一张 (带内低档, 带内高档) 表, k 上 lerp 微升,
     高档封顶即带的 RANGES 上限以内 —— 数字跟着教材走, 永不超前。
   · 推理轨: reasoning 随 tier 分段(带对齐): 1-4 single → 5-8 two-step
     → 9-12 reverse → 13+ multi-solve —— 思维跳到附加题。
   定性新元素(干扰物/按群计数/位值捆/往返跳/多层/隐藏块/双属性)一律
   概率渐入(引入档 0<值<1, 单调爬到封顶, 台阶变坡道, focus 先例);
   定性首发档与推理档变化错开 —— 每关只动一个难度维度(Davidson 2006),
   数值轴的连续微升不算定性事件。认知负荷红线(research §2.6)写死在
   字段上: chunks ≤4(一次呈现组块), clueCount ≤3(线索), unitLen ≤4。

   族 A count(数一数)  tier: 1────4────8────12───19
     max        带内微升  [4..20] [20..60] [60..100] [100..1000]
     flashMs    闪现时长  1800 ───────────────→ 1000(逐档渐短)
     mixRate    相似干扰  0 → tier3 引入 0.2 → 封顶 0.6
     groupRate  按群计数  0 → tier10 引入 0.3 → 封顶 1(乘法前置)
     chunks 恒 2(单堆/两堆), trials 6→10
   族 B craft(算一算)
     max    [10..20] [20..100] [100..100] [1000..10000](位值→万以内)
     bundleRate 位值捆扎(10 根=1 捆) 0 → tier6 引入 0.25 → 封顶 1
     chunks 恒 4(算式组块), trials 6→10
   族 C hop(跳一跳)
     max(=路长) [10..20] [30..100] [100..100] [200..1000]
     landmark 整十小旗 tier6 起为真(0-100 路十格一档标位值)
     zigRate 往返/非整十跳 0 → tier8 引入 0.15 → 封顶 0.5
     chunks 恒 2(起点+终点), trials 6→9
   族 D mirror(摆一摆)
     span(图案格数) [6..16] [16..36] [36..64] [64..144]
     layerRate 多层立体 0 → tier10 引入 0.3 → 封顶 1(2D→3D)
     chunks 恒 3, trials 4→7(摆放大, 试次少)
   族 E plan(搭一搭)
     blocks(方块数) [8..20] [20..60] [60..100] [100..600]
     hiddenRate 隐藏块 0 → tier7 引入 0.25 → 封顶 1
     chunks 恒 3, trials 4→7
   族 F pattern(找一找)
     max(数列值) [10..20] [20..100] [100..100] [500..10000]
     unitLen 单元长度 2 → tier6 起 3 → tier10 起 4(=呈现组块)
     clueCount 线索数 2 → tier11 起 3(线索排队)
     dualRate 双属性规律 0 → tier12 引入 0.3 → 封顶 1
     trials 8→12(试次小而快) */

/* 线性插值(fLerp 在 focus-levels.js 已占用全局名, 数学侧换名) */
function mLerp(a, b, t) {
  return a + (b-a)*t;
}

/* tier → 所属带(0..3): 带 0=tier1-4(一上) … 带 3=tier13+(二下), 越界钳 3 */
function mathBandOf(tier) {
  return Math.min(3, Math.max(0, Math.floor((tier-1)/4)));
}

/* 推理轨分段(design §4.1): 随 tier 单调递进, 与带对齐 */
function mathReasoningOf(tier) {
  if (tier <= 4) return 'single';
  if (tier <= 8) return 'two-step';
  if (tier <= 12) return 'reverse';
  return 'multi-solve';
}

/* 概率坡道通用形: 引入档前恒 0, 引入档起步 start, 每档 +step, 封顶 cap */
function mathRamp(tier, introTier, start, step, cap) {
  if (tier < introTier) return 0;
  return Math.min(cap, start + step*(tier-introTier));
}

/* 各族数值轨表: [带0(低,高), 带1, 带2, 带3] — 高档 ≤ RANGES[带] 永不越带;
   全程单调不降(带间持平=该学期数值轴到顶, 上探全在推理轨——双轨本义) */
const MATH_NUM_TRACK = {
  count: [[4, 20], [20, 60], [60, 100], [100, 1000]],
  craft: [[10, 20], [20, 100], [100, 100], [1000, 10000]], // 二上持平 100(表内乘/百内加减)
  hop: [[10, 20], [30, 100], [100, 100], [200, 1000]], // 二上持平 100(百内数序)
  mirror: [[6, 16], [16, 36], [36, 64], [64, 144]],
  plan: [[8, 20], [20, 60], [60, 100], [100, 600]],
  pattern: [[10, 20], [20, 100], [100, 100], [500, 10000]],
};

/* 各族数值轴键(带钳制与关卡层红线测试共用口径): max=题内最大数,
   其余为族的规模轴 —— 三段口径末段只钳这些键, 推理档等保持 tier 派生 */
const MATH_NUM_KEYS = {count: ['max'], craft: ['max'], hop: ['max'],
  mirror: ['span'], plan: ['blocks'], pattern: ['max']};

function mathParamsFor(family, tier, li) {
  const t = Math.min(1, Math.max(0, (tier-1)/18)); // 0..1 归一(时间类参数用)
  const band = mathBandOf(tier);
  const k = Math.min(4, Math.max(1, tier - band*4)); // 带内档 1..4
  const track = MATH_NUM_TRACK[family] || MATH_NUM_TRACK.count;
  const num = Math.round(mLerp(track[band][0], track[band][1], (k-1)/3)); // 带内微升
  const base = {reasoning: mathReasoningOf(tier), max: num};
  switch (family) {
    case 'count': // A: 感数与计数 → 对应与比较
      return {...base, chunks: 2, trials: Math.round(mLerp(6, 10, t)),
        flashMs: Math.round(mLerp(1800, 1000, t)), // 呈现时长渐短(快照类)
        mixRate: mathRamp(tier, 3, 0.2, 0.1, 0.6), // 相似干扰物 tier3 渐入
        groupRate: mathRamp(tier, 10, 0.3, 0.175, 1)}; // 按群计数 tier10 渐入
    case 'craft': // B: 配方算术 → 逆向与代换
      return {...base, chunks: 4, trials: Math.round(mLerp(6, 10, t)),
        bundleRate: mathRamp(tier, 6, 0.25, 0.15, 1)}; // 位值捆扎 tier6 渐入
    case 'hop': // C: 数字线跳格子 → 数序、间隔与规律(线性, Ramani & Siegler)
      return {...base, chunks: 2, trials: Math.round(mLerp(6, 9, t)),
        landmark: tier >= 6, // 0-100 路十格一旗(位值标档)
        zigRate: mathRamp(tier, 8, 0.15, 0.075, 0.5)}; // 往返跳 tier8 渐入
    case 'mirror': // D: 对称建造 → 空间想象与拼组
      return {...base, span: num, chunks: 3, trials: Math.round(mLerp(4, 7, t)),
        layerRate: mathRamp(tier, 10, 0.3, 0.2, 1)}; // 多层立体 tier10 渐入
    case 'plan': // E: 按图搭建 → 空间计数与视角推理
      return {...base, blocks: num, chunks: 3, trials: Math.round(mLerp(4, 7, t)),
        hiddenRate: mathRamp(tier, 7, 0.25, 0.15, 1)}; // 隐藏块 tier7 渐入
    case 'pattern': // F: 接龙与分类 → 模式、周期与推理
      return {...base, chunks: tier < 6 ? 2 : tier < 10 ? 3 : 4,
        unitLen: tier < 6 ? 2 : tier < 10 ? 3 : 4, // 单元长度=呈现组块
        clueCount: tier < 11 ? 2 : 3, // 线索排队(挑战)最多 3 条线索
        trials: Math.round(mLerp(8, 12, t)),
        dualRate: mathRamp(tier, 12, 0.3, 0.2, 1)}; // 双属性规律 tier12 渐入
  }
}

/* ---------- 120 关螺旋编排生成(plan §7 · G4 扩容 100→120) ----------
   每带 30 关 = 带首复习(带 0 改为六族教学开局) + 六族轮转 + 带末 boss。
   · 轮转流: 教学+normal+challenge 共 104 关, 按每带每族目标次数表
     (MATH_LEVEL_MIX)均匀交错排布——每步取「已排/目标」进度比最落后
     的族, 平局按六族序(确定性): 同族永不相邻(交错练习+间隔复习合一,
     focus 严格循环先例在非均匀配重下的推广)。
   · 配重口径(测试锁定): 族账 = 该族全部关(含教学/复习/挑战/boss 记账);
     轮转表 104 槽 = count 15 · craft 18 · hop 18 · mirror 19 · plan 19 ·
     pattern 15; 复习固定落 craft/hop(数与运算主线, 各 +3), boss 名义族 =
     sections 首族(偶带 craft·奇带 hop, 各 +2), 教学各 +1 → 终值
     count/pattern=16, craft/hop=24, mirror/plan=20(plan §7 "B/C 配重略高",
     mirror/plan 承载 G4 新挑战变体)。
   · tier = min(19, band*4 + k), k = 带内轮转第几次出现(1..5); 复习关
     tier = band*4(回访上一带顶档), boss 关 tier = min(19, band*4+4)。
   · 挑战序列(G4): 每族带内末 N 次轮转出现 = 挑战关(N=该带解锁的挑战
     变体数, 按 introBand 升序, 旧挑战在前新变体殿后); mirror 带 1~3 与
     plan 带 2~3 末两次 = tangram+bridge / countall+dualview 各占一, 其余
     族末次 = 唯一 ★★ 变体; 常规关在该族 3 个常规范型间轮换(全局计数,
     每族 3 个都出场)。dualview 只在带 2+(二年级"观察物体"同频),
     bridge 带带 1+(introBand 登记, 生成器不特判)。
   · 情境关(T7): 每情境族(shop→craft · clock→hop · measure→count)带内
     首个轮转位换情境皮肤(带 0 教学关占掉第 1 位, 落第 2 位) — 只换
     variant, tier/kind/params 与族曲线同源(难度轴零扰动); 四带各一关,
     认钟/推算与算钱/付法的子型随推理档自然爬坡。
   · boss = 三族 ★★ 小任务串联(sections, focus 大师关先例): 偶带
     [craft, mirror, pattern] · 奇带 [hop, plan, count] —— 两带一轮覆盖
     全部六族; 各节取该族该带挑战序列末位变体(新变体殿后=boss 节同档,
     带 2 boss mirror 节=bridge · 带 3 boss plan 节=dualview 自然落位)。 */
const MATH_LEVELS = [];
/* 每带每族轮转次数表(单一权威, 测试锁死): 行=带 0..3, 带 0 23 槽/带 1~3
   各 27 槽, 合 104 = 轮转流总数 */
const MATH_LEVEL_MIX = [
  {count: 3, craft: 4, hop: 4, mirror: 4, plan: 4, pattern: 4},
  {count: 4, craft: 5, hop: 4, mirror: 5, plan: 5, pattern: 4},
  {count: 4, craft: 4, hop: 5, mirror: 5, plan: 5, pattern: 4},
  {count: 4, craft: 5, hop: 5, mirror: 5, plan: 5, pattern: 3},
];
(function generateMathLevels() {
  const regularOf = (f) => MATH_VARIANTS[f].filter((v) => v.kind !== 'challenge');
  /* 该族该带出场的挑战序列: introBand≤band 的挑战变体按 introBand 升序
     (旧挑战在前, 新变体殿后 = 带内末次轮转位) */
  const challengesOf = (f, band) => MATH_VARIANTS[f]
      .filter((v) => v.kind === 'challenge' && (v.introBand || 0) <= band);
  /* 带内槽序 = 目标次数的均匀交错: 每步取进度比 (placed+0.5)/target 最小
     的族, 平局按六族序 — 确定性(同表同序), 同族永不相邻 */
  const interleave = (mix) => {
    const placed = {};
    for (const f of MATH_FAMILIES) placed[f] = 0;
    const total = MATH_FAMILIES.reduce((a, f) => a + mix[f], 0);
    const seq = [];
    for (let s = 0; s < total; s++) {
      let best = null; let bestAt = Infinity;
      for (const f of MATH_FAMILIES) {
        if (placed[f] >= mix[f]) continue;
        const at = (placed[f] + 0.5) / mix[f];
        if (at < bestAt) {
          bestAt = at;
          best = f;
        }
      }
      placed[best]++;
      seq.push(best);
    }
    return seq;
  };
  const turn = {}; // 每族常规变体轮换计数
  for (const f of MATH_FAMILIES) turn[f] = 0;
  let i = 0;
  for (let band = 0; band < 4; band++) {
    const counts = MATH_LEVEL_MIX[band]; // 每族本带轮转次数(表即权威)
    const slotFamilies = interleave(counts); // 带内槽序(均匀交错)
    const seen = {}; // 本带已出现次数(带 0 教学关占掉第 1 次)
    if (band === 0) for (const f of MATH_FAMILIES) seen[f] = 1;
    else for (const f of MATH_FAMILIES) seen[f] = 0;
    const chalTier = {}; // 本带该族末次挑战关的 tier — boss 各节取同档
    const lastSeen = {}; // 本带该族轮转流总次数(带 0 含教学关的 1 次)
    for (const f of MATH_FAMILIES) lastSeen[f] = counts[f] + (band === 0 ? 1 : 0);

    /* 变体级参数覆写(变体表单一权威): 族曲线出参后按变体表 trials/tune
       等可选字段覆写 — 搬动试错关(count/balance)每题探索长一次 2~3 题,
       新挑战变体(dualview/bridge)的推理档/候选/视图/预算在变体内重爬。
       装配三段口径: 族曲线 → 变体覆写 → 带钳制 */
    const paramsOf = (family, variant, tier, idx) => {
      const meta = (MATH_VARIANTS[family] || []).find((x) => x.id === variant);
      let params = mathParamsFor(family, tier, idx);
      if (meta && meta.tune) params = meta.tune(params, tier);
      if (meta && meta.trials) params.trials = meta.trials;
      /* 带钳制(红线兜底): 轮转流 k 可达 5, tier=band*4+k 溢到下一带
         区间时 mathParamsFor 按 tier 派生带会取到下一带数值 —— 数值轴
         按关卡自身 band 钳回本带上限(MATH_RANGES); 推理档等非数值键
         保持 tier 派生(bridge 带 1=reverse 等已钉口径不动) */
      const cap = MATH_RANGES[band];
      for (const key of MATH_NUM_KEYS[family] || []) {
        params[key] = Math.min(params[key], cap);
      }
      return params;
    };

    const push = (family, kind, tier, variant) => {
      const idx = i++;
      MATH_LEVELS.push({i: idx, band, family, variant, kind, tier,
        params: paramsOf(family, variant, tier, idx)});
    };

    if (band === 0) { // 六族教学关开局(核心变体入门, tier1)
      for (const f of MATH_FAMILIES) push(f, 'tutorial', 1, regularOf(f)[0].id);
    } else { // 带首两关复习上一带(craft/hop 主线, tier=上一带顶档)
      const revFams = ['craft', 'hop'];
      for (let r = 0; r < 2; r++) {
        const f = revFams[r];
        push(f, 'review', band*4, regularOf(f)[(band-1)%3].id);
      }
    }
    for (const f of slotFamilies) { // 六族轮转(均匀交错槽序)
      seen[f]++;
      const k = seen[f]; // 带内第几次轮转出现(带 0 含教学=1)
      const tier = Math.min(19, band*4 + k);
      const chList = challengesOf(f, band);
      const rem = lastSeen[f] - seen[f]; // 距带内末次的剩余出现数(含本次)
      if (rem < chList.length) { // 带内末 N 次 = 挑战序列(旧挑战在前)
        if (rem === 0) chalTier[f] = tier; // 末次挑战(新变体) — boss 节同档
        push(f, 'challenge', tier, chList[chList.length - rem - 1].id);
      } else if (seen[f] === (band === 0 ? 2 : 1) && mathContextVariantOf(f)) {
        /* 情境关(T7): 每情境族带内首个轮转位换皮肤(带 0 教学关占掉第 1
           次出现, 情境落第 2 位) — 只换 variant, tier/kind/params 与族曲线
           同源; 该档恰无定性新事件(每关只动一个维度), 轮换计数不消耗,
           三常规范型出场覆盖不变 */
        push(f, 'normal', tier, mathContextVariantOf(f));
      } else {
        push(f, 'normal', tier, regularOf(f)[turn[f]++ % 3].id);
      }
    }
    /* 带末 boss: 三族 ★★ 串联; 名义族=首节族(偶带 craft·奇带 hop),
       各节 = 该族该带挑战序列末位变体(与带内末次挑战同变体同档) */
    const bossFams = band % 2 === 0 ? ['craft', 'mirror', 'pattern'] : ['hop', 'plan', 'count'];
    const bossTier = Math.min(19, band*4 + 4);
    const bossChal = bossFams.map((f) => challengesOf(f, band).pop());
    const idx = i++; // 关号先取定 — 同字面量 params 实参不再拿到自增后的 i(死参错位修复)
    const boss = {i: idx, band, family: bossFams[0], variant: bossChal[0].id,
      kind: 'boss', tier: bossTier,
      params: paramsOf(bossFams[0], bossChal[0].id, bossTier, idx)};
    boss.sections = bossFams.map((f, s) => ({family: f, variant: bossChal[s].id,
      tier: chalTier[f], params: paramsOf(f, bossChal[s].id, chalTier[f])}));
    MATH_LEVELS.push(boss);
  }
})();

/* ---------- 通过门槛 / 三星(design §4.2, 纯函数, 模式层与单测共用) ----------
   通过: 教学关恒过(零压力); 常规/复习 acc≥0.70(自适应训练带下界, 同
   focus); 挑战 acc≥0.80(附加题水平, plan D3)—— 变体表带显式 trials 覆写
   的探索型挑战例外(balance 搬动试错/bridge 摆桥是长交互): 容错线
   correct ≥ trials−1(2/3·1/2 过, design §9 拍板「全对线对 6 岁过苛」);
   st 缺 correct/trials(异常结算)回落 acc 线。boss 聚合三段按单关 70%
   口径(整关 acc, 不走逐节线, 容错线不涉及)。
   三星: ⭐通过 ⭐⭐acc≥85% ⭐⭐⭐acc≥95% 且无连续 3 错, 且该族当带挑战关
   已通过(famChallengeDone 注入, 存档 challenge 表查 'family:band')——
   挑战/boss 关自成该条件(过关即点亮); 补过挑战后常规关第三星回溯点亮
   (地图星显按本函数重算即得, 星数只取历史最高)。 */
function mathPassed(level, st) {
  if (level.kind === 'tutorial') return true;
  const s = st || {};
  const acc = s.acc || 0;
  if (level.kind === 'challenge') {
    /* 探索容错线(design §9): 变体表带显式 trials 覆写的挑战(长交互
       搬动/摆桥)按 correct ≥ trials−1 判, 其余挑战维持 acc≥0.80 */
    const v = (MATH_VARIANTS[level.family] || []).find((x) => x.id === level.variant);
    if (v && v.trials && Number.isFinite(s.correct) && Number.isFinite(s.trials)) {
      return s.correct >= s.trials - 1;
    }
    return acc >= 0.80;
  }
  return acc >= 0.70; // normal/review/boss(boss 聚合三段, 单关口径)
}

function mathStars(level, st, famChallengeDone) {
  if (level.kind === 'tutorial') return 0; // 教学关不计星
  if (!mathPassed(level, st)) return 0; // 1 星 = 通过
  const acc = (st && st.acc) || 0;
  let s = 1;
  if (acc >= 0.85) s++;
  if (acc >= 0.95 && st.maxStreakErr < 3) {
    if (level.kind === 'challenge' || level.kind === 'boss' || famChallengeDone) s++;
  }
  return s;
}

/* 第三星挂钩判据(原住 modes/math.js, mathLevelStars 需要同一判据下沉至此):
    挑战/boss 关自成条件; 常规关查存档 challenge 表的 'family:band' 键 */
function mathFamChallengeDone(save, level) {
  if (level.kind === 'challenge' || level.kind === 'boss') return true;
  return !!(save && save.challenge && save.challenge[level.family + ':' + level.band]);
}

/* 三星素质线(第三星的纯表现侧条件, 与挂钩无关): 结算时据此记 ready */
function mathThreeStarReady(level, st) {
  return level.kind !== 'tutorial' && mathPassed(level, st) &&
      (st.acc || 0) >= 0.95 && st.maxStreakErr < 3;
}

/* 该关当前应显星数(地图/结算展示的单一出口, spec US35/D4 三星回溯):
    = max(已存星(历史最高), ready 且该族当带挑战已过 ? 3 : 0)。
    ready 在结算时记素质线达标而挑战未过的关(mathSettleSave), 补过挑战
    后这里重算即点亮第三星 — stars 表不回写(继续作历史最高)。 */
function mathLevelStars(save, level) {
  const got = (save && save.stars && save.stars[level.i]) || 0;
  if (save && save.ready && save.ready[level.i] && mathFamChallengeDone(save, level)) {
    return Math.max(got, 3);
  }
  return got;
}

/* ---------- 战利品表与掷骰(design §5 · ADR 0002 经济口径) ----------
   六族主题池: count→怪物掉落系 · craft→矿物系 · hop→染料系(染料物品
   未注册, 以骨粉=白色染料领衔过渡) · mirror→玻璃石英系(石英未注册,
   玻璃/黏土近似) · plan→木材系 · pattern→花与染料系(花未注册, 以
   种子/树苗/苹果近似)。以基础材料为主, 稀有件权重 ≤0.2(rare 清单=
   连对保底目标), 为未来消费模式留经济余量(ADR 0002)。
   掷骰政策按设计稿 §5 保持简单版: 正确试次 p=0.45 概率掉落 · 连对每
   满 3 保底稀有 · 教学关豁免 · 只奖不罚。
   与当前 focus 掉落的差异(政策备注): focus 已于奖励调优(3d2a8e8,
   docs/focus-reward-tuning-design.md)升级为段位变率+总量压制+干燥
   兜底(FOCUS_REWARD_STAGES); 数学模式按设计稿保持简单版——数学关
   期望试次更少且族池主题化, 先以直白变率跑通回路, 产出量需要治理时
   按同构预算(段位表+试次基准+干燥阈值三件)接入, 掉落永不与表现排名
   挂钩的红线不变。 */
const MATH_LOOT_P = 0.45; // 正确试次掉落概率(设计稿 §5 字面值)
const MATH_LOOT_STREAK = 3; // 连对每满 3 保底稀有

const MATH_LOOT = {
  count: {pool: {rotten_flesh: 0.35, bone: 0.30, string: 0.25, slimeball: 0.10},
    rare: ['slimeball']},
  craft: {pool: {coal: 0.40, cobble: 0.30, iron_ore: 0.20, gold_ore: 0.10},
    rare: ['gold_ore']},
  hop: {pool: {bone_meal: 0.35, string: 0.30, wheat_seeds: 0.20, apple: 0.15},
    rare: ['apple']},
  mirror: {pool: {glass: 0.40, sand: 0.30, clay_ball: 0.20, brick: 0.10},
    rare: ['brick']},
  plan: {pool: {planks: 0.40, log: 0.30, stick: 0.20, sapling: 0.10},
    rare: ['sapling']},
  pattern: {pool: {wheat_seeds: 0.35, bone_meal: 0.25, sapling: 0.25, apple: 0.15},
    rare: ['apple']},
};

/* t = {ok, streak, seed} → itemId|null; ok=该试次答对 · streak=当前连对
   计数(模式层维护, 答错清零) — 连对每满 3 跳过 p 掷骰必得本族稀有件,
   其余答对按 p=0.45 掷骰取本族池; 骰值取件机制在 CampCore.pickWeighted
   (骰值落累积区间取件+浮点尾差兜底) */
function rollMathLoot(level, t) {
  const e = t || {};
  if (!level || level.kind === 'tutorial' || !e.ok) return null; // 教学豁免 + 只奖不罚
  const fam = MATH_LOOT[level.family];
  if (!fam) return null; // 未知族(防御)
  const rnd = RandCore.mkRand(e.seed);
  if (e.streak >= MATH_LOOT_STREAK && e.streak % MATH_LOOT_STREAK === 0) {
    return fam.rare[Math.min(fam.rare.length - 1, Math.floor(rnd() * fam.rare.length))];
  }
  if (rnd() >= MATH_LOOT_P) return null; // 未中
  return CampCore.pickWeighted(fam.pool, rnd());
}

/* 战利品入包授予流(grantFocusLoot 同形态): 机制基座在 CampCore.grantLoot
   (逐件 add 进背包本体, 余量>0 静默忽略不入 granted 清单并标 full), 此处
   家族名为薄委托 — 「背包满啦」toast 与 save 时机归模式层 */
function grantMathLoot(inv, ids) {
  return CampCore.grantLoot(inv, ids);
}

/* ---------- 图章一本纯函数(T8, 形态对齐 focus F7 但数据独立) ----------
    数学岛独立图章日历(不与专注训练营共用账本): stamps 形状 {日期: 当日关数}
    (键与 budgetDateStr 同款 'Y-M-D' 无前导零), 落账点在 modes/math.js 的
    mathSettleSave(单一写入点); 全部无突变。口径与专注侧同构:
    当日 ≥1 关盖普通章(图案 stampKind 三选一自选, 缺省宝石章), 满 3 关盖
    大章; 集章数按天计(每天至多 1 枚, 普通/大章是同一枚章的两种大小);
    集章达成线只发观感奖励, 永不解锁关卡/范式/难度(红线)。 */
const MATH_STAMP_KEEP_DAYS = 90; // 滚动保留窗口(与日志窗口有意分立, focus 先例)
const MATH_STAMP_DAILY = {min: 1, big: 3}; // 当日 ≥1 关普通章 / 满 3 关大章
const MATH_STAMP_KINDS = ['gem', 'star', 'plus']; // 自选章图案三选一(stampIcon 合法 kind 子集)
const MATH_STAMP_REWARDS = { // 达成线 → 观感奖励 id(纯观感, 不解锁玩法)
  3: 'stamp_pattern', // 三选一图章图案
  7: 'firework', // 今日页烟花彩蛋
  30: 'gold_stamp', // 金图章
};
const MATH_STAMP_REWARD_TEXT = {
  stamp_pattern: '自选图章图案', firework: '今日页烟花', gold_stamp: '金图章',
};

/* 图章一本工厂实例: 机制单份在 CampCore.mkStampBook(八件 record/trim/count/
   milestones/rewardsDue/rewardFor/rewardClaimed/nextLine), 家族差异只注入
   三参 — 达成线表/滚动窗口/日限; dailyCap 按值 6(MATH_DAILY_LEVELS=6,
   按值拷贝免跨文件依赖), 下方七个家族名为薄委托 */
const MathStampBook = CampCore.mkStampBook({rewards: MATH_STAMP_REWARDS, keepDays: MATH_STAMP_KEEP_DAYS, dailyCap: 6});

/* 落账: 当日计数钳 1~6(日限 MATH_DAILY_LEVELS=6, 按值拷贝免跨文件依赖),
   当日取 max 不重复累加(重玩同日不叠章); 0/负/NaN 关不落账 */
function mathStampRecord(stamps, day, count) {
  return MathStampBook.record(stamps, day, count);
}

/* 裁剪: 只保留今天起 90 天窗口内的键(防存档膨胀), 机制复用 trimMathLog,
   仅窗口常量分立 */
function mathStampTrim(stamps, today) {
  return MathStampBook.trim(stamps, today);
}

/* 集章总数 = 有章天数(每天至多 1 枚; 普通/大章是同一枚章的两种大小) */
function mathStampCount(stamps) {
  return MathStampBook.count(stamps);
}

/* 达成线: 表内 3/7/30 + 60/90/…每 30 章递进(都是金图章, 30 已在表内) */
function mathStampMilestones(count) {
  return MathStampBook.milestones(count);
}

/* 待领 = 已越线 − 已领(差集): 幂等, 领取方把线记进存档后不再重发 */
function mathStampRewardsDue(count, claimed) {
  return MathStampBook.rewardsDue(count, claimed);
}

/* 达成线 → 奖励 id: 递进线(60/90/…)不在表内, 沿用 30 的金图章 */
function mathStampRewardFor(line) {
  return MathStampBook.rewardFor(line);
}

/* 下一目标线(结算屏/日历的集章进度口径): 表内线优先, 过 30 后为 30 的倍数 */
function mathStampNextLine(count) {
  return MathStampBook.nextLine(count);
}

/* ---------- 存档形状与迁移(design §4.3, modes 层 slot 与单测共用) ----------
   math_camp_save: stars{关i:星} · challenge{'family:band':true} ·
   ready{关i:true}(三星回溯档: 素质线达标而挑战未过, 见 mathLevelStars) ·
   stamps{日期:当日关数} · stampKind 自选章图案(缺省 'gem', 合法清单
   T8 激励票定义, 此处只修形不设白名单) · log{日期:{family:{acc, n,
   chalN, chalOk}}}(家长面板数据源, 滚动 90 天防膨胀)。 */
const MATH_LOG_KEEP_DAYS = 90;

/* 今日日期串(单点出口): 薄委托 CampCore.todayStr(其内再委托 budgetDateStr
   — 'Y-M-D' 拼装全库只留在 daily-budget.js 那一处); now 可注入 */
function mathTodayStr(now) {
  return CampCore.todayStr(now);
}

/* 日期串(年-月-日 无前导零)→本地日序数: 滚动窗口的日差基于它;
   损坏串返回 NaN(调用方按"无记录"处理); 机制在 CampCore.dayIndex */
function mathDayIndex(dateStr) {
  return CampCore.dayIndex(dateStr);
}

/* 按日记录滚动裁剪(机制在 CampCore.trimLog, 此处家族名为薄委托): 返回只
   保留最近 keepDays 天(含今天)的新对象, 不改原; 未来日期(时钟回拨产物)
   保留 — 零惩罚哲学不因设备时钟惩罚孩子; 非法键丢弃(防死数据); today
   非法时原样返回(防御: 不清档) */
function trimMathLog(log, today, keepDays) {
  return CampCore.trimLog(log, today, keepDays);
}

/* ---------- 家长面板聚合(T9, 纯函数, 模式层面板与单测共用) ----------
    log 形状: {日期: {'族:带': {acc, n, chalN, chalOk}}}(T9 起, 写入点
    mathSettleSave); 无冒号的旧键(开发期 T4~T8 形状, 键=族名)按"只入族
    合计、不入学期带格"兼容读取, 不需要存档迁移。acc 是记录内运行均值,
    聚合一律按 n 加权重算(Σacc·n / Σn)。 */
function mathLogFamBand(key) {
  const s = String(key);
  const i = s.indexOf(':');
  return i < 0 ? {fam: s, band: -1} : {fam: s.slice(0, i), band: Number(s.slice(i + 1))};
}

/* 六族×四带矩阵 + 族合计 + 思维挑战遇到/通过(跨日全量聚合):
   返回 {rows: [{family, cells: [{acc, n}×4], acc, n, chalN, chalOk}]};
   损坏记录/未知族键/带号越界(含旧键 band=-1)跳过或只入族合计 */
function mathPanelMatrix(log) {
  const rows = {};
  for (const f of MATH_FAMILIES) {
    rows[f] = {family: f, cells: [0, 1, 2, 3].map(() => ({acc: 0, n: 0})),
      acc: 0, n: 0, chalN: 0, chalOk: 0};
  }
  const days = log || {};
  for (const day of Object.keys(days)) {
    const d = days[day] || {};
    for (const k of Object.keys(d)) {
      const r = d[k];
      if (!r || typeof r !== 'object') continue; // 损坏记录防御
      const fb = mathLogFamBand(k);
      const row = rows[fb.fam];
      if (!row) continue; // 未知族键兜底丢弃
      row.acc += (r.acc || 0) * (r.n || 0); row.n += r.n || 0;
      row.chalN += r.chalN || 0; row.chalOk += r.chalOk || 0;
      if (fb.band >= 0 && fb.band < 4) { // 旧键(无冒号)只入族合计不入带格
        const c = row.cells[fb.band];
        c.acc += (r.acc || 0) * (r.n || 0); c.n += r.n || 0;
      }
    }
  }
  const fin = (c) => ({acc: c.n ? c.acc / c.n : 0, n: c.n});
  return {rows: MATH_FAMILIES.map((f) => {
    const row = rows[f];
    return {family: f, cells: row.cells.map(fin), ...fin(row),
      chalN: row.chalN, chalOk: row.chalOk};
  })};
}

/* CSV 行集(BOM 与下载由模式层): 首行表头, 行=日期(升序, 非法日期键过滤),
   列=日期 + 六族×{正确率%, 次数, 挑战遇到, 挑战通过} + 当日图章数;
   族列聚合当日该族全部键(含带与旧键); 正确率四舍五入整数, 无记录留空 */
function mathPanelCsv(save) {
  const log = (save && save.log) || {};
  const stamps = (save && save.stamps) || {};
  const days = Object.keys(log).filter((k) => Number.isFinite(mathDayIndex(k)))
      .sort((a, b) => mathDayIndex(a) - mathDayIndex(b));
  const head = ['日期'];
  for (const f of MATH_FAMILIES) {
    head.push(MATH_META[f].name + '正确率%', MATH_META[f].name + '次数',
        MATH_META[f].name + '挑战遇到', MATH_META[f].name + '挑战通过');
  }
  head.push('图章');
  const rows = [head];
  for (const day of days) {
    const d = log[day] || {};
    const line = [day];
    for (const f of MATH_FAMILIES) {
      let acc = 0; let n = 0; let chalN = 0; let chalOk = 0;
      for (const k of Object.keys(d)) {
        if (mathLogFamBand(k).fam !== f) continue;
        const r = d[k] || {};
        acc += (r.acc || 0) * (r.n || 0); n += r.n || 0;
        chalN += r.chalN || 0; chalOk += r.chalOk || 0;
      }
      line.push(n ? Math.round(acc / n * 100) : '', n, chalN, chalOk);
    }
    line.push(stamps[day] || 0);
    rows.push(line);
  }
  return rows;
}

/* 族近期趋势序列(US42 家长面板行尾迷你图数据源): log 按日聚合出该族
    最近 MATH_TREND_DAYS 个有记录日的 acc 序列(升序, {day, acc, n});
    键聚合与 mathPanelCsv 族列同口径(当日该族全部键含旧键, 按 n 加权);
    非法日期键过滤; 该族无记录的日不进序列("有记录日"而非日历日)。 */
const MATH_TREND_DAYS = 7;
function mathPanelTrend(log, family) {
  const days = log || {};
  const recs = [];
  for (const day of Object.keys(days)) {
    if (!Number.isFinite(mathDayIndex(day))) continue; // 非法日期键丢弃
    const d = days[day] || {};
    let acc = 0; let n = 0;
    for (const k of Object.keys(d)) {
      if (mathLogFamBand(k).fam !== family) continue;
      const r = d[k] || {};
      acc += (r.acc || 0) * (r.n || 0); n += r.n || 0;
    }
    if (n > 0) recs.push({day, acc: acc / n, n});
  }
  recs.sort((a, b) => mathDayIndex(a.day) - mathDayIndex(b.day));
  return recs.slice(-MATH_TREND_DAYS);
}

/* 存档版本位: v=2 — G4 扩容(每带 25→30 关)改动关号语义, 旧档一次性
   迁移见 migrateMathSave; stamps/log 按日期记账与关号无关, 不受影响 */
const MATH_SAVE_VERSION = 2;
const MATH_SAVE_DEFAULTS = {v: MATH_SAVE_VERSION, stars: {}, challenge: {},
  ready: {}, stamps: {}, stampClaimed: [], stampKind: 'gem', log: {}};

/* 存档迁移(save-slot 的 migrate 链调用, (s, from) 两参): 版本位 + 幂等修形 —
   v≠当前版(G4 关号语义 25/带→30/带): stars/challenge/ready 三表按新编排
   全部失真, 一次性清空(数学岛上线仅一天损失可忽略, 用户拍板); stamps
   图章与 log 家长日志按日期记账, 原样保留。v=2 后只做幂等修形: 五个表
   字段缺/损坏(含被写成数组的 —— typeof [] === 'object', 不拦会把数组
   长度当天数, 如 mathStampCount 读数组 stamps)补空对象
   (ready=三星回溯档), stampClaimed 非数组补 [](T8
   集章已领线), stampKind 非字符串回落 'gem'; 存量进度原样保留; 90 天
   滚动裁剪由模式层在落账时调 trimMathLog/mathStampTrim(写入点单一) */
function migrateMathSave(s, from) {
  if (!s || typeof s !== 'object') return {...MATH_SAVE_DEFAULTS};
  if (s.v !== MATH_SAVE_VERSION) { // 旧档(无 v)或异版: 关号语义变化, 三表清空
    s.stars = {};
    s.challenge = {};
    s.ready = {};
    s.v = MATH_SAVE_VERSION;
  }
  for (const k of ['stars', 'challenge', 'ready', 'stamps', 'log']) {
    if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
  }
  if (!Array.isArray(s.stampClaimed)) s.stampClaimed = []; // T8: 集章已领达成线
  if (!MATH_STAMP_KINDS.includes(s.stampKind)) s.stampKind = 'gem'; // T8: 自选章图案白名单修形(focus 同款)
  return s;
}
