'use strict';
/* ============================================================
   数学关卡参数表 (MathLevels, 术语见 GLOSSARY.md) — 应用层·数据表+纯函数
   ------------------------------------------------------------
   数学冒险岛的数值唯一权威: 六族与变体元数据(规则/tip 话术供 TTS,
   零文字依赖口径) · mathParamsFor 双轨难度曲线(数值轨带内微升永不
   越带, 推理轨 single→two-step→reverse→multi-solve 分段, 定性跳变
   概率渐进——台阶变坡道, focus-levels 先例) · 100 关螺旋编排(四带×25,
   教学关开局/带首复习/带内末次=挑战/带末 boss) · 通过门槛/三星(挑战
   挂钩, 补过回溯) · 战利品表与掷骰(简单版) · 存档默认值/迁移。
   数值出处: docs/math-mode-design.md §4/§5 · docs/math-mode-plan.md
   §4~§7(难度双轨=数字跟着教材走, 思维跳到附加题)。
   interface: MATH_FAMILIES · MATH_META · MATH_VARIANTS · MATH_CONTEXTS ·
     MATH_RANGES ·
     mathParamsFor(family, tier, li) · MATH_LEVELS ·
     mathPassed(level, st) · mathStars(level, st, famChallengeDone) ·
     MATH_LOOT · rollMathLoot(level, {ok, streak, seed}) ·
     grantMathLoot(inv, ids) · MATH_LOG_KEEP_DAYS · mathTodayStr ·
     mathDayIndex · trimMathLog · mathPanelMatrix · mathPanelCsv ·
     MATH_STAMP_KINDS/DAILY/REWARDS/REWARD_TEXT/KEEP_DAYS ·
     mathStampRecord(stamps, day, count) · mathStampTrim(stamps, today) ·
     mathStampCount · mathStampMilestones · mathStampRewardsDue ·
     mathStampRewardFor · mathStampNextLine ·
     MATH_SAVE_DEFAULTS · migrateMathSave
   依赖(均经全局名, 调用期解析): MATH_META 的图标字段在构造期调用
     mcIcon(js/focus-icons.js, 加载序在本文件之前, 惰性字符串拼接
     零 DOM); grantMathLoot 调用期解析 inventory-core 的 add(加载序
     先于本文件, 见 index.html); mathTodayStr 调用期解析 daily-budget.js
     的 budgetDateStr('Y-M-D' 拼装全库只留那唯一一处)。
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

/* 变体表(design §4.1 · plan §6): 每族 3 常规范型(★) + 1 思维挑战变体(★★,
   kind='challenge', 附加题级——逆向/多解/隐藏/周期)。id 是关卡 variant 字段
   与屏流/世界轨分发的键; 常规序即教学关与变体轮换的默认序。 */
const MATH_VARIANTS = {
  count: [ /* A 数一数: 感数与计数 → 对应与比较 (T1) */
    {id: 'snapshot', name: '怪物快照'},
    {id: 'fetch', name: '按数取物'},
    {id: 'compare', name: '比多少'},
    {id: 'balance', name: '移多补少', kind: 'challenge'},
  ],
  craft: [ /* B 算一算: 配方算术 → 逆向与代换 (T2/T5) */
    {id: 'enough', name: '材料够不够'},
    {id: 'shortage', name: '还差几个'},
    {id: 'order', name: '合成订单'},
    {id: 'blank', name: '魔法空格', kind: 'challenge'},
  ],
  hop: [ /* C 跳一跳: 数字线跳格子 → 数序、间隔与数列规律 (T3) */
    {id: 'dice', name: '掷骰前进'},
    {id: 'jumps', name: '跳格子任务'},
    {id: 'position', name: '站位比大小'},
    {id: 'gaps', name: '间隔问题', kind: 'challenge'},
  ],
  mirror: [ /* D 摆一摆: 对称建造 → 空间想象与拼组 (T4) */
    {id: 'reflect', name: '魔法镜补全'},
    {id: 'translate', name: '平移复制'},
    {id: 'rotate', name: '旋转对称'},
    {id: 'tangram', name: '拼组与省料', kind: 'challenge'},
  ],
  plan: [ /* E 搭一搭: 按图搭建 → 空间计数与视角推理 (T4/T6) */
    {id: 'build', name: '看图施工'},
    {id: 'pick', name: '反向选图'},
    {id: 'hidden', name: '隐藏块推理'},
    {id: 'countall', name: '数方块', kind: 'challenge'},
  ],
  pattern: [ /* F 找一找: 接龙与分类 → 模式、周期与推理 (T3/T6) */
    {id: 'chain', name: '花纹接龙'},
    {id: 'sort', name: '分装箱'},
    {id: 'odd', name: '找异类'},
    {id: 'cycle', name: '周期问题', kind: 'challenge'},
  ],
};

/* 情境变体登记(T7, plan §6 情境挂载): 挂在既有族上的皮肤变体, 不独立
   成族 — 配重/战利品/日志/挑战表全记在承载族(family 字段), 排班由
   编排生成器在每带首个轮转位换 variant 实现(tier/kind/params
   与族曲线同源, 结构不变量零扰动)。rule/tip 为变体级话术, 模式层
   mathLevelMeta 据此覆盖族元数据(TTS 零文字依赖)。id 即关卡 variant
   与屏流分发键(math-paradigms MATH_SCREEN_KEYS 同步在册)。 */
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
    rule: '数一数格子：从小怪物到小旗有几格？走过去再回来又是几格？',
    tip(p) {
      let s = '这次最多数到 ' + Math.min(p.max, 60) + ' 格';
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

/* ---------- 100 关螺旋编排生成(plan §7) ----------
   每带 25 关 = 带首复习(带 0 改为六族教学开局) + 六族轮转 + 带末 boss。
   · 轮转流: 教学+normal+challenge 共 84 关, 全程严格按 MATH_FAMILIES
     循环(84=6×14, 每族恰 14 次; 带 0 内各 3 次, 带 1~3 内 3~4 次) ——
     交错练习+间隔复习合一(focus 编排先例)。
   · 配重口径(测试锁定): 族账 = 该族全部关(含教学/复习/挑战/boss 记账);
     复习固定落 craft/hop(数与运算主线, 各 +3), boss 名义族 = sections
     首族(偶带 craft·奇带 hop, 各 +2) → count/mirror/plan/pattern=15,
     craft/hop=20(plan §7 "B/C 配重略高")。
   · tier = min(19, band*4 + k), k = 带内轮转第几次出现(1..4); 复习关
     tier = band*4(回访上一带顶档), boss 关 tier = min(19, band*4+4)。
   · 每族带内末次轮转出现 = 挑战关(★★变体); 常规关在该族 3 个常规范型
     间轮换(全局计数, 每族 3 个都出场)。
   · 情境关(T7): 每情境族(shop→craft · clock→hop · measure→count)带内
     首个轮转位换情境皮肤(带 0 教学关占掉第 1 位, 落第 2 位) — 只换
     variant, tier/kind/params 与族曲线同源(难度轴零扰动, 该档亦无定性
     新事件); 四带各一关, 认钟/推算与算钱/付法的子型随推理档自然爬坡。
   · boss = 三族 ★★ 小任务串联(sections, focus 大师关先例): 偶带
     [craft, mirror, pattern] · 奇带 [hop, plan, count] —— 两带一轮
     覆盖全部六族, 各节参数取该族该带挑战关同档。 */
const MATH_LEVELS = [];
(function generateMathLevels() {
  const regularOf = (f) => MATH_VARIANTS[f].filter((v) => v.kind !== 'challenge');
  const challengeOf = (f) => MATH_VARIANTS[f].find((v) => v.kind === 'challenge');
  const turn = {}; // 每族常规变体轮换计数
  for (const f of MATH_FAMILIES) turn[f] = 0;
  let rot = 0; // 全局轮转指针(0..83, 严格六族循环)
  let i = 0;
  for (let band = 0; band < 4; band++) {
    /* 带内轮转槽的族分布预扫: 算每族本带轮转次数与末次槽号(末次=挑战) */
    const slotCount = band === 0 ? 18 : 22; // 带 0: 6 教学+18 轮转; 带 1~3: 2 复习+22 轮转
    const rotStart = rot;
    const counts = {};
    for (const f of MATH_FAMILIES) counts[f] = 0;
    for (let s = 0; s < slotCount; s++) counts[MATH_FAMILIES[(rotStart+s) % 6]]++;
    const seen = {}; // 本带已出现次数(带 0 教学关占掉第 1 次)
    if (band === 0) for (const f of MATH_FAMILIES) seen[f] = 1;
    else for (const f of MATH_FAMILIES) seen[f] = 0;
    const chalTier = {}; // 本带该族挑战关(末次出现)的 tier — boss 各节取同档
    const lastSeen = {}; // 本带该族轮转流总次数(带 0 含教学关的 1 次)
    for (const f of MATH_FAMILIES) lastSeen[f] = counts[f] + (band === 0 ? 1 : 0);

    const push = (family, kind, tier, variant) => {
      const idx = i++;
      MATH_LEVELS.push({i: idx, band, family, variant, kind, tier,
        params: mathParamsFor(family, tier, idx)});
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
    for (let s = 0; s < slotCount; s++) { // 六族轮转
      const f = MATH_FAMILIES[rot % 6];
      rot++;
      seen[f]++;
      const k = seen[f]; // 带内第几次轮转出现(带 0 含教学=1)
      const tier = Math.min(19, band*4 + k);
      if (seen[f] === lastSeen[f]) { // 本带末次出现 = 挑战关(★★)
        chalTier[f] = tier;
        push(f, 'challenge', tier, challengeOf(f).id);
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
    /* 带末 boss: 三族 ★★ 串联; 名义族=首节族(偶带 craft·奇带 hop) */
    const bossFams = band % 2 === 0 ? ['craft', 'mirror', 'pattern'] : ['hop', 'plan', 'count'];
    const bossTier = Math.min(19, band*4 + 4);
    const boss = {i: i++, band, family: bossFams[0], variant: challengeOf(bossFams[0]).id,
      kind: 'boss', tier: bossTier, params: mathParamsFor(bossFams[0], bossTier, i)};
    boss.sections = bossFams.map((f) => ({family: f, variant: challengeOf(f).id,
      tier: chalTier[f], params: mathParamsFor(f, chalTier[f])}));
    MATH_LEVELS.push(boss);
  }
})();

/* ---------- 通过门槛 / 三星(design §4.2, 纯函数, 模式层与单测共用) ----------
   通过: 教学关恒过(零压力); 常规/复习 acc≥0.70(自适应训练带下界, 同
   focus); 挑战 acc≥0.80(附加题水平, plan D3); boss 聚合三段按单关 70% 口径。
   三星: ⭐通过 ⭐⭐acc≥85% ⭐⭐⭐acc≥95% 且无连续 3 错, 且该族当带挑战关
   已通过(famChallengeDone 注入, 存档 challenge 表查 'family:band')——
   挑战/boss 关自成该条件(过关即点亮); 补过挑战后常规关第三星回溯点亮
   (地图星显按本函数重算即得, 星数只取历史最高)。 */
function mathPassed(level, st) {
  if (level.kind === 'tutorial') return true;
  const acc = (st && st.acc) || 0;
  if (level.kind === 'challenge') return acc >= 0.80;
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

/* 种子可注入的 LCG(与 focus mkLootRand 同常数, 独立副本避免共享词法
   环境重名): seed 缺省回落 Math.random —— 不回落则首步得 NaN, NaN>=p
   恒假=掉率虚涨 100%, 池内比较全假=恒掉最后一键 */
function mathLootRand(seed) {
  let s = seed === undefined ? Math.floor(Math.random() * 2147483648) : seed;
  return function() {
    s = (s*1103515245 + 12345) % 2147483648;
    return s/2147483648;
  };
}

/* 骰值落累积区间取件(池概率和=1 由测试锁死); 浮点尾差兜底最后一键 */
function pickMathPool(pool, r) {
  let acc = 0;
  for (const id of Object.keys(pool)) {
    acc += pool[id];
    if (r < acc) return id;
  }
  return Object.keys(pool).pop();
}

/* t = {ok, streak, seed} → itemId|null; ok=该试次答对 · streak=当前连对
   计数(模式层维护, 答错清零) — 连对每满 3 跳过 p 掷骰必得本族稀有件,
   其余答对按 p=0.45 掷骰取本族池 */
function rollMathLoot(level, t) {
  const e = t || {};
  if (!level || level.kind === 'tutorial' || !e.ok) return null; // 教学豁免 + 只奖不罚
  const fam = MATH_LOOT[level.family];
  if (!fam) return null; // 未知族(防御)
  const rnd = mathLootRand(e.seed);
  if (e.streak >= MATH_LOOT_STREAK && e.streak % MATH_LOOT_STREAK === 0) {
    return fam.rare[Math.min(fam.rare.length - 1, Math.floor(rnd() * fam.rare.length))];
  }
  if (rnd() >= MATH_LOOT_P) return null; // 未中
  return pickMathPool(fam.pool, rnd());
}

/* 战利品入包授予流(grantFocusLoot 同形态): 逐件 add 进背包本体,
   余量>0 静默忽略(不入 granted 清单)并标 full — 「背包满啦」toast 与
   save 时机归模式层; add 经全局名调用期解析(inventory-core 加载序
   先于本文件, 见 index.html) */
function grantMathLoot(inv, ids) {
  const granted = []; let full = false;
  for (const id of ids || []) {
    if (add(inv, id, 1) > 0) full = true;
    else granted.push(id);
  }
  return {granted, full};
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

/* 落账: 当日计数钳 1~6(日限 MATH_DAILY_LEVELS=6, 按值拷贝免跨文件依赖),
   当日取 max 不重复累加(重玩同日不叠章); 0/负/NaN 关不落账 */
function mathStampRecord(stamps, day, count) {
  if (!(count > 0)) return stamps;
  const n = Math.max(1, Math.min(6, Math.round(count)));
  const next = {...stamps};
  next[day] = Math.max(next[day] || 0, n);
  return next;
}

/* 裁剪: 只保留今天起 90 天窗口内的键(防存档膨胀), 机制复用 trimMathLog,
   仅窗口常量分立 */
function mathStampTrim(stamps, today) {
  return trimMathLog(stamps, today, MATH_STAMP_KEEP_DAYS);
}

/* 集章总数 = 有章天数(每天至多 1 枚; 普通/大章是同一枚章的两种大小) */
function mathStampCount(stamps) {
  return Object.keys(stamps || {}).length;
}

/* 达成线: 表内 3/7/30 + 60/90/…每 30 章递进(都是金图章, 30 已在表内) */
function mathStampMilestones(count) {
  const lines = Object.keys(MATH_STAMP_REWARDS).map(Number).filter((k) => count >= k);
  for (let m = 60; m <= count; m += 30) lines.push(m);
  return lines.sort((a, b) => a - b);
}

/* 待领 = 已越线 − 已领(差集): 幂等, 领取方把线记进存档后不再重发 */
function mathStampRewardsDue(count, claimed) {
  const got = new Set(claimed || []);
  return mathStampMilestones(count).filter((line) => !got.has(line));
}

/* 达成线 → 奖励 id: 递进线(60/90/…)不在表内, 沿用 30 的金图章 */
function mathStampRewardFor(line) {
  return MATH_STAMP_REWARDS[line] || MATH_STAMP_REWARDS[30];
}

/* 下一目标线(结算屏/日历的集章进度口径): 表内线优先, 过 30 后为 30 的倍数 */
function mathStampNextLine(count) {
  for (const k of Object.keys(MATH_STAMP_REWARDS).map(Number).sort((a, b) => a - b)) {
    if (count < k) return k;
  }
  return Math.ceil((count + 1) / 30) * 30;
}

/* ---------- 存档形状与迁移(design §4.3, modes 层 slot 与单测共用) ----------
   math_camp_save: stars{关i:星} · challenge{'family:band':true} ·
   stamps{日期:当日关数} · stampKind 自选章图案(缺省 'gem', 合法清单
   T8 激励票定义, 此处只修形不设白名单) · log{日期:{family:{acc, n,
   chalN, chalOk}}}(家长面板数据源, 滚动 90 天防膨胀)。 */
const MATH_LOG_KEEP_DAYS = 90;

/* 今日日期串(单点出口): 委托 budgetDateStr(daily-budget.js, 加载序先
   于本文件, 调用期解析) — 'Y-M-D' 拼装全库只留那唯一一处; now 可注入 */
function mathTodayStr(now) {
  return budgetDateStr(now === undefined ? Date.now() : now);
}

/* 日期串(年-月-日 无前导零)→本地日序数: 滚动窗口的日差基于它;
   损坏串返回 NaN(调用方按"无记录"处理) */
function mathDayIndex(dateStr) {
  const m = /^(\d+)-(\d+)-(\d+)$/.exec(String(dateStr));
  if (!m) return NaN;
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  return Math.round((d.getTime() - new Date(1970, 0, 1).getTime())/86400000);
}

/* 按日记录滚动裁剪: 返回只保留最近 keepDays 天(含今天)的新对象, 不改原;
   未来日期(时钟回拨产物)保留 — 零惩罚哲学不因设备时钟惩罚孩子; 非法键
   丢弃(防死数据); today 非法时原样返回(防御: 不清档) */
function trimMathLog(log, today, keepDays) {
  const t0 = mathDayIndex(today);
  if (!Number.isFinite(t0)) return log || {};
  const out = {};
  if (!log) return out;
  for (const k of Object.keys(log)) {
    const diff = t0 - mathDayIndex(k);
    if (diff < keepDays) out[k] = log[k]; // NaN 比较为 false 自然丢弃
  }
  return out;
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

const MATH_SAVE_DEFAULTS = {stars: {}, challenge: {}, stamps: {}, stampClaimed: [], stampKind: 'gem', log: {}};

/* 存档迁移(save-slot 的 migrate 链调用, (s, from) 两参): 只做幂等修形 —
   四个表字段缺/损坏补空对象, stampClaimed 非数组补 [](T8 集章已领线),
   stampKind 非字符串回落 'gem'; 存量进度原样保留; 90 天滚动裁剪由模式层
   在落账时调 trimMathLog/mathStampTrim(写入点单一) */
function migrateMathSave(s, from) {
  if (!s || typeof s !== 'object') return {...MATH_SAVE_DEFAULTS};
  for (const k of ['stars', 'challenge', 'stamps', 'log']) {
    if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  }
  if (!Array.isArray(s.stampClaimed)) s.stampClaimed = []; // T8: 集章已领达成线
  if (!MATH_STAMP_KINDS.includes(s.stampKind)) s.stampKind = 'gem'; // T8: 自选章图案白名单修形(focus 同款)
  return s;
}
