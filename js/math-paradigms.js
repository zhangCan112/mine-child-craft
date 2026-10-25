'use strict';
/* ============================================================
   Math Paradigms (数学屏流引擎, 术语见 GLOSSARY.md「数学屏流引擎」) — 应用层·库
   ------------------------------------------------------------
   一句话职责: 藏住 16 个屏流判别变体(count/craft/pattern 全变体 +
   hop 站位比大小 + 商店/钟表/测距情境皮肤)的"呈现-点选-反馈"流程与
   小部件, 调度层(modes/math.js)只给 section 与 handler, 拿回统计;
   引擎不知道奖励/背包/图章/关卡编排。
   出题优先调 PuzzleCore(算式谜/多解/天平=mkScalePuzzle/mkPartitionPuzzle,
   数列/周期/线索排队=mkSeqPuzzle/mkPeriodPuzzle/mkClueOrderPuzzle);
   count 族闪现/取物/比多少与 craft 常规三变体无对应生成器,
   引擎内用 RandCore.mkRand 同常数 LCG 自行生成(种子注入, 同 seed 同输出);
   移多补少(count/balance)为搬动试错(US6): mBalancePair 堆对生成
   纯函数 + 两堆相等自动交卷 + mBalanceReveal 按实际差值语音点破。
   认知负荷红线(PuzzleCore.LIMITS): 一次呈现 ≤4 组块 · 线索 ≤3 条 —
   mathGuardParams 渲染前校验参数, 越界 console.warn 并截断(测试锁)。
   interface: mathScreenDispatch(family, variant) · mathGuardParams(params) ·
     runMathScreen(section, area, h) → {stop()}(T5-b 起经 MathTrack.runners 派发)
     section = {family, variant, tier?, kind?, params, seed?} ·
     mFrameLayout(n, seed) → 十格阵格位序列(呈现反泄漏纯函数, G5) ·
     h = {progress(k, n)?, onTrial({ok, streak})?, end(st)} —
     st = {trials, correct, acc, maxStreakErr}(供 mathPassed/mathStars) ·
     钟部件族 mClockFace/mClockAngles/mClockSay(角度/报时口径纯函数,
     谜题钟面与 modes/math.js G1 常驻昼夜大钟共用, 配单测)
   依赖(均经全局名, 调用期解析): RandCore(js/rand-core.js, 加载序在本
     文件之前 — mkRand 随机流/shuffle 洗牌/childSeed 子种子全仓唯一实现)
     · PuzzleCore(js/math-puzzles-core.js) ·
     SpeechKit/sfx(js/speech.js·js/audio.js) · mcIcon(js/focus-icons.js) ·
     Mobs.face(js/mobs.js, 怪物头像, 缺席回落 mcIcon) ·
     mathPraiseLine/mathComfortLine(js/modes/math.js 应用层话术, 本文件
     加载在其之前, 调用期解析 — focus-paradigms 同款分层口径)
   可测性: DOM 惰性创建(仅 document) · 零 THREE · Node 测试注入假 doc
     安全加载, 有驱动缝单测(test/math-paradigms.test.js, vm 直测)
   ------------------------------------------------------------
   变体子型随推理档(reasoning)混入(双轨的屏流侧):
   count/compare single=谁多 · 其余=多几个 ·
   craft/blank 恒有算式谜(x ? = z, 空位恒第二操作数) · reverse 起混入
   天平代换 · multi-solve 起混入多解找齐 ·
   pattern/chain single/两步=颜色接龙 · 其余混入数列 ·
   pattern/sort reverse 起=线索排队(≤3 线索) ·
   hop/position single=谁站得远 · 其余=相差几。
   情境变体(T7, 挂族不独立成族, 专项小部件+话术皮肤):
   craft/shop 人民币商店 — single=买两样算一共 · two-step 起混付整钞找零 ·
   reverse 起"付钱有几种付法"多解找齐(mkPartitionPuzzle 钱币皮肤, 找齐才
   算对); 金额跟带 min(max,100) 元, 面额按一年级教材常识;
   hop/clock 钟表时刻 — single=认整时/半时(带 0~1 主场, 两步档起仍五成
   复现) · two-step=过半小时/一小时(答案仍落整/半格) · reverse 起=
   过一刻钟(时间推算); DOM 指针钟;
   count/measure 测距步数 — single=两端都数(b-a+1) · two-step=跳几格
   (b-a) · reverse 起六成往返(2×(b-a), ×2 萌芽); a/b 显式注入
   mkIntervalPuzzle(跨度 ≤12 数格可数红线)。
   快照(count/snapshot)数量 ≤12: 感数与按群计数的主场, 大数走取物/比多少。
   ============================================================ */

/* ---------- 小工具(命名加 m 前缀, 避开共享词法环境的既有全局) ---------- */

function mEl(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/* 计时器收口: stop 一次清空(focus mkTimers 同构, 独立副本避免跨引擎耦合) */
function mTimers() {
  const ts = [];
  return {
    after(ms, fn) {
      const id = setTimeout(() => {
        const k = ts.indexOf(id);
        if (k >= 0) ts.splice(k, 1);
        fn();
      }, ms);
      ts.push(id);
      return id;
    },
    stop() {
      ts.forEach((id) => clearTimeout(id));
      ts.length = 0;
    },
  };
}

/* 种子随机流与洗牌已归一 RandCore(js/rand-core.js, 加载序在本文件之前):
   mkRand 同常数 LCG · shuffle 非突变拷贝式 · childSeed 派生子种子 */
function mRi(rnd, lo, hi) {
  if (hi < lo) hi = lo;
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

function mPick(rnd, arr) {
  return arr[Math.floor(rnd() * arr.length)];
}

/* 像素图标出口: mcIcon 惰性拼接(零 DOM 画布) · 怪物头像走 Mobs.face 单一出口 */
function mIconUrl(name) {
  return (typeof mcIcon === 'function') ? mcIcon(name) : '';
}

function mIconImg(name, cls) {
  return '<img class="m-ic' + (cls ? ' ' + cls : '') + '" draggable="false" alt="" src="' + mIconUrl(name) + '">';
}

function mFaceImg(mob, cls) {
  const url = (typeof Mobs !== 'undefined' && Mobs && Mobs.face) ? Mobs.face(mob) : mIconUrl('cobble');
  return '<img class="m-ic m-face' + (cls ? ' ' + cls : '') + '" draggable="false" alt="" src="' + url + '">';
}

/* 颜色号(PuzzleCore 周期谜题 1..3)→ 羊毛图标与话术名(键名避开 button-icons
   防错网的 icon:'字面量' 收网口径, 那是按钮键的语义) */
const MATH_COLORS = {
  1: {ico: 'wool_red', name: '红色'},
  2: {ico: 'wool_blue', name: '蓝色'},
  3: {ico: 'wool_yellow', name: '黄色'},
};

/* ---------- 认知负荷红线(渲染前校验, 越界 warn + 截断) ---------- */

function mathGuardParams(p) {
  const o = Object.assign({}, p || {});
  const cap = (k, want) => {
    if (o[k] !== undefined && o[k] > want) {
      console.warn('[math-paradigms] 认知负荷红线: ' + k + '=' + o[k] + ' 超上限 ' + want + ', 已截断(设计稿 §4.1)');
      o[k] = want;
    }
  };
  cap('chunks', PuzzleCore.LIMITS.chunks);
  cap('unitLen', PuzzleCore.LIMITS.chunks);
  cap('clueCount', PuzzleCore.LIMITS.clues);
  return o;
}

/* ---------- 分发(纯函数, 单测锁住清单) ----------
   清单唯一权威是文件尾的 MATH_SCREEN_ENGINES(变体键→引擎同表登记;
   T2 并表: 原 MATH_SCREEN_KEYS 键集与引擎表各持一份, 增删变体要改两处,
   漏一边即运行时软锁)。此处前向引用经共享词法环境调用期解析 —
   分发只发生在全文件加载完成后, 无 TDZ 风险 */
function mathScreenDispatch(family, variant) {
  const key = family + '/' + variant;
  return MATH_SCREEN_ENGINES[key] ? {kind: 'engine', key} : {kind: 'none'};
}

/* ---------- 通用小部件 ---------- */

/* 可点选项按钮(统一 m-tap 可点语义 + data-v 值) */
function mChoiceBtn(value, html, cls, onPick) {
  const b = mEl('button', 'm-choice m-tap' + (cls ? ' ' + cls : ''), html);
  b.dataset.v = value;
  b.onclick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    onPick(value, b);
  };
  return b;
}

/* 数量选择条: 答案 + 3 个邻近干扰, 恰 4 选项(≤4 组块红线) */
function mNumChoices(stage, rnd, answer, onPick) {
  const vals = [answer];
  let guard = 0;
  while (vals.length < 4 && guard++ < 80) {
    const v = answer + mRi(rnd, -3, 3);
    if (v >= 0 && !vals.includes(v)) vals.push(v);
  }
  let extra = 1;
  while (vals.length < 4) vals.push(answer + 10 + extra++); // 干扰兜底(远离答案)
  const row = mEl('div', 'm-nums');
  for (const v of RandCore.shuffle(rnd, vals)) row.appendChild(mChoiceBtn(v, String(v), 'm-num', onPick));
  stage.appendChild(row);
  return row;
}

/* 图标选项条(颜色/材质类): items = 去重图标键数组(≤4) */
function mIconChoices(stage, rnd, items, onPick) {
  const row = mEl('div', 'm-nums');
  for (const it of RandCore.shuffle(rnd, items.slice(0, 4))) {
    row.appendChild(mChoiceBtn(it, mIconImg(it), 'm-iconc', onPick));
  }
  stage.appendChild(row);
  return row;
}

/* 确认按钮(多选类变体收口): 零文字压力, 语音已说明玩法 */
function mOkBtn(stage, onPick) {
  const b = mEl('button', 'm-ok m-tap', '✔ 好啦');
  b.onclick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    onPick(b);
  };
  stage.appendChild(b);
  return b;
}

/* 序列槽排(接龙/周期/算式): 真元素+data 神谕, slots = 描述符数组 */
function mSeqRow(stage, slots) {
  const row = mEl('div', 'm-seq');
  for (const s of slots) {
    const el = mEl('span', 'm-slot' + (s.cls ? ' ' + s.cls : ''), s.html || '');
    if (s.item !== undefined) el.dataset.item = s.item;
    if (s.n !== undefined) el.dataset.n = s.n;
    if (s.op !== undefined) el.dataset.op = s.op;
    row.appendChild(el);
  }
  stage.appendChild(row);
  return row;
}

function mItemSlot(icon) {
  return {cls: 'm-itemslot', item: icon, html: mIconImg(icon)};
}

function mNumSlot(n) {
  return {cls: 'm-numslot', n, html: String(n)};
}

function mOpSlot(op) {
  return {cls: 'm-op', op, html: op};
}

const MATH_BLANK_SLOT = {cls: 'm-blank', html: '?'};
const MATH_EQ_SLOT = {cls: 'm-eq', html: '='};

/* 方块堆(点数用): n 枚图标 */
function mPileIcons(n, icon) {
  let s = '';
  for (let k = 0; k < n; k++) s += mIconImg(icon);
  return s;
}

/* ---------- 呈现反泄漏(G5): 十格阵布局(纯函数) ---------- */

/* 十格阵布局: n 个物品铺进 ceil(n/10) 个 2×5 阵框, 每行 5 格(一年级
   教材同款教具), 空格以占位格可见(一一对应/逐个点数是合法策略);
   同十格区间的 n 与 n+1 格位总数相同 → 阵框占位同宽同高, 比长短
   得不到答案(用户实测"对比块的长度就知道够不够", 呈现层修复)。
   seed 注入阵组排列(满阵在前/后)与每阵填充起点(左起/右起),
   同 seed 同输出; 输出 = 恒 10 的倍数格位序列, {f:1}实格/{f:0}空格 */
function mFrameLayout(n, seed) {
  const cnt = Math.max(0, Math.floor(n));
  if (cnt === 0) return [];
  const rnd = RandCore.mkRand(seed === undefined ? 0 : seed);
  const groups = [];
  let left = cnt;
  while (left > 0) {
    groups.push(Math.min(10, left));
    left -= 10;
  }
  if (groups.length > 1 && rnd() < 0.5) groups.reverse(); // 阵组顺序由 seed 派生
  const cells = [];
  for (const g of groups) {
    const fromRight = rnd() < 0.5; // 每阵填充起点由 seed 派生
    for (let k = 0; k < 10; k++) {
      cells.push({f: (fromRight ? 9 - k : k) < g ? 1 : 0});
    }
  }
  return cells;
}

/* 十格阵堆 html(两堆比较呈现): 按组包阵框, 空格占位可见 */
function mFramePileHtml(n, icon, seed) {
  const cells = mFrameLayout(n, seed);
  let html = '';
  for (let g = 0; g < cells.length; g += 10) {
    html += '<span class="m-frame">';
    for (const c of cells.slice(g, g + 10)) {
      html += c.f ? mIconImg(icon) : '<span class="m-frempty"></span>';
    }
    html += '</span>';
  }
  return html;
}

/* ---------- count 族 A 数一数 ---------- */

/* 怪物快照: 小客人闪现 → 藏起 → 点出数量(感数/按群计数; ≤12) */
function mCountSnapshot(stage, p, rnd, ctx) {
  const n = mRi(rnd, 3, Math.min(p.max || 10, 12));
  const guest = mPick(rnd, ['zombie', 'slime', 'spider', 'skeleton']);
  const group5 = (p.groupRate || 0) > 0 && rnd() < p.groupRate;
  const one = (mob) => '<span class="m-mob">' + mFaceImg(mob) + '</span>';
  const mobs = [];
  for (let k = 0; k < n; k++) mobs.push(one(guest));
  if ((p.mixRate || 0) > 0 && rnd() < p.mixRate) { // 相似干扰物(长得像, 不计数)
    const other = mPick(rnd, ['zombie', 'slime', 'spider', 'skeleton'].filter((m) => m !== guest));
    const d = mRi(rnd, 1, 2);
    for (let k = 0; k < d; k++) mobs.push(one(other));
  }
  const ordered = RandCore.shuffle(rnd, mobs);
  let html = '';
  if (group5) { // 按群计数: 5 个一排(乘法前置)
    for (let k = 0; k < ordered.length; k += 5) {
      html += '<span class="m-g5row">' + ordered.slice(k, k + 5).join('') + '</span>';
    }
  } else {
    html = ordered.join('');
  }
  const field = mEl('div', 'm-flash' + (group5 ? ' m-group5' : ''), html);
  stage.appendChild(field);
  ctx.speak('数一数，来了几位小客人？');
  const flashMs = Math.max(600, p.flashMs || 1500);
  ctx.T.after(flashMs, () => {
    field.classList.add('m-hide');
    mNumChoices(stage, rnd, n, (v, b) => ctx.settle(v === n, b));
    ctx.speak('有几只？点数字！');
  });
}

/* 按数取物: 听目标数, 点够方块入箱再确认 */
function mCountFetch(stage, p, rnd, ctx) {
  const n = mRi(rnd, 1, Math.min(p.max || 10, 10));
  const m = n + mRi(rnd, 1, 3);
  const box = mEl('div', 'm-box', '<span class="m-boxlabel">📦×' + n + '</span>');
  box.dataset.n = n;
  stage.appendChild(box);
  const tray = mEl('div', 'm-tray');
  for (let k = 0; k < m; k++) {
    tray.appendChild(mChoiceBtn('blk' + k, mIconImg('cobble'), 'm-item', (v, b) => {
      b.classList.toggle('in');
      sfxSafe('click');
    }));
  }
  stage.appendChild(tray);
  mOkBtn(stage, () => {
    const got = tray.children.filter((c) => c.classList.contains('in')).length;
    ctx.settle(got === n, null);
  });
  ctx.speak('请搬 ' + n + ' 个方块进箱子，点够了按好啦。');
}

/* 比多少: 谁多(点堆) / 多几个(数字条) — 两堆铺十格阵(呈现反泄漏:
   同十格区间阵框同形, 空格可见, 比长短得不到答案, 须逐个点数或
   按空格一一对应) */
function mCountCompare(stage, p, rnd, ctx) {
  const cap = Math.max(4, Math.min(p.max || 10, 12));
  let a = mRi(rnd, 1, cap);
  let b = a;
  while (b === a) b = mRi(rnd, 1, cap);
  const diffMode = p.reasoning && p.reasoning !== 'single';
  const wrap = mEl('div', 'm-piles');
  const frameHtml = (n) => mFramePileHtml(n, 'cobble', RandCore.childSeed(rnd));
  if (!diffMode) {
    for (const n of RandCore.shuffle(rnd, [a, b])) {
      const pile = mChoiceBtn(n, frameHtml(n), 'm-pile', (v, el) => ctx.settle(+v === Math.max(a, b), el));
      pile.dataset.n = n;
      wrap.appendChild(pile);
    }
    stage.appendChild(wrap);
    ctx.speak('哪边的方块多？点一点！');
  } else {
    for (const n of [a, b]) {
      const pile = mEl('div', 'm-pile m-pilestat', frameHtml(n));
      pile.dataset.n = n;
      wrap.appendChild(pile);
    }
    stage.appendChild(wrap);
    const ans = Math.abs(a - b);
    mNumChoices(stage, rnd, ans, (v, el) => ctx.settle(v === ans, el));
    ctx.speak('多的一边比少的一边多几个？');
  }
}

/* 移多补少堆对生成(纯函数, 假 doc 单测直锁): 两堆各自 ≤6 且差为偶数 ≤4
   —— 搬动试错要逐个点方块, 堆数守住感数与点数上限; 差恒偶数因为
   "移 k 个差减 2k", 答案 k=差/2(一年级思考题口径, 奇数差不出现 —
   spec 只说移到一样多); 数量跟带注入: max 经 min 钳 6, 挑战关思维
   密度在搬动探索不在数字大小(带 0 首档 max=4 → 差恒 2, 先体会
   "移 1 个差变 2") */
function mBalancePair(rnd, p) {
  const cap = Math.max(4, Math.min(p.max || 6, 6));
  const small = mRi(rnd, 1, cap - 2);
  const big = small + 2 * mRi(rnd, 1, Math.min(2, Math.floor((cap - small) / 2)));
  return {small, big, diff: big - small, answer: (big - small) / 2};
}

/* 揭示话术(纯函数): 交卷后按本关实际差值点破规律 — 夸方法(过程性表扬)
   + 点破"移 1 个差变 2"(US6 语音点破口径) */
function mBalanceReveal(pair) {
  return '你搬得很仔细！原来差 ' + pair.diff + ' 个，移 ' + pair.answer +
      ' 个过去就一样多啦——移 1 个，差就变少 2！';
}

/* 移多补少(挑战, 搬动试错, US6): 两堆方块, 点某堆里的一个方块 → 搬到
   另一堆, 两堆计数即时重显(CPA 具体→表象, 计数徽与堆同步); 来回搬
   零惩罚, 两堆相等时自动交卷判对(探索式只有达成没有失败 — 只奖不罚
   红线); 搬错方向(少 → 多)不判负, 让计数变化自己教育孩子, 每两次无效
   搬动后 TTS 温和提示方向; 交卷后 mBalanceReveal 按本关实际差值语音
   点破。多的一堆恒在前(与旧静态版同序, 话术仍要孩子自己比出哪边多)。 */
const MATH_BALANCE_HINT = '想想哪边多，从多的往少的搬哦';

function mCountBalance(stage, p, rnd, ctx) {
  const pair = mBalancePair(rnd, p);
  const counts = [pair.big, pair.small];
  const wrap = mEl('div', 'm-piles');
  const piles = [];
  for (let j = 0; j < 2; j++) {
    const pile = mEl('div', 'm-pile m-pilelive', '');
    wrap.appendChild(pile);
    piles.push(pile);
  }
  stage.appendChild(wrap);
  let ineff = 0; // 无效搬动(少 → 多)计数, 每满 2 提示一次方向
  let done = false; // 交卷后锁交互(settle 已记账, 残点不再搬)
  const renderPile = (j) => {
    piles[j].dataset.n = counts[j]; // DOM 神 oracle 位 + CPA 即时重显
    piles[j].innerHTML = '';
    for (let k = 0; k < counts[j]; k++) {
      piles[j].appendChild(mChoiceBtn(j + ':' + k, mIconImg('wool_red'), 'm-blk', () => move(j)));
    }
    piles[j].appendChild(mEl('b', 'm-pilecount', String(counts[j]))); // 可见计数徽(数字是学习对象)
  };
  const move = (j) => {
    if (done || counts[j] <= 0) return; // 空堆无从搬
    const wrongWay = counts[j] < counts[1 - j]; // 从少的一堆搬向多的一堆 = 无效方向
    counts[j]--;
    counts[1 - j]++;
    sfxSafe('click');
    renderPile(j);
    renderPile(1 - j);
    if (counts[0] === counts[1]) {
      done = true;
      ctx.settle(true, null); // 相等自动交卷, 恒判对(达成即成功)
      ctx.speak(mBalanceReveal(pair));
      return;
    }
    if (wrongWay && ++ineff % 2 === 0) ctx.speak(MATH_BALANCE_HINT);
  };
  renderPile(0);
  renderPile(1);
  ctx.speak('两堆不一样多，怎么移才一样多？点一个方块搬搬试试！');
}

/* ---------- craft 族 B 算一算 ---------- */

/* 材料位值堆: ≥10 且掷中捆扎率 → 10 根捆成 1 捆(bundleRate 位值渐入) */
function mHavePile(stage, have, p, rnd) {
  const bundled = (p.bundleRate || 0) > 0 && have >= 10 && rnd() < p.bundleRate;
  let html = '';
  if (bundled) {
    const tens = Math.floor(have / 10);
    const ones = have % 10;
    for (let k = 0; k < tens; k++) html += '<span class="m-bundle">' + mIconImg('planks') + '<b>10</b></span>';
    for (let k = 0; k < ones; k++) html += mIconImg('planks');
  } else {
    html = mPileIcons(have, 'planks');
  }
  const el = mEl('div', 'm-have' + (bundled ? ' m-bundled' : ''), html);
  el.dataset.n = have;
  stage.appendChild(el);
  return el;
}

/* 需求配方卡(呈现反泄漏, enough/shortage 共用): 需求数不画方块行 —
   镐子 + 大数字 + 单枚物品图标, 数字是 CPA 的 A 层学习对象; 孩子
   必须数库存方块(m-have 侧)再与数字比较, 两条长度不再可比 */
function mNeedRow(stage, need) {
  const needEl = mEl('div', 'm-need',
      mIconImg('pickaxe') + '<b class="m-neednum">' + need + '</b>' + mIconImg('planks') +
      '<span class="m-needtag">要 ' + need + ' 块</span>');
  needEl.dataset.n = need;
  stage.appendChild(needEl);
  return needEl;
}

/* 材料够不够: need 与 have 比, 点 够/不够 */
function mCraftEnough(stage, p, rnd, ctx) {
  const need = mRi(rnd, 2, Math.min(p.max || 10, 10));
  const have = Math.max(0, need + mRi(rnd, -3, 3));
  mNeedRow(stage, need);
  mHavePile(stage, have, p, rnd);
  const row = mEl('div', 'm-nums');
  row.appendChild(mChoiceBtn(1, '✔ 够', 'm-yes', (v, el) => ctx.settle((have >= need) === (v === 1), el)));
  row.appendChild(mChoiceBtn(0, '✗ 不够', 'm-no', (v, el) => ctx.settle((have >= need) === (v === 1), el)));
  stage.appendChild(row);
  ctx.speak('做一把镐子要用 ' + need + ' 块木板，看看材料，够不够？');
}

/* 还差几个: 缺料减法 */
function mCraftShortage(stage, p, rnd, ctx) {
  const need = mRi(rnd, 3, Math.min(p.max || 12, 12));
  const have = Math.max(0, need - mRi(rnd, 1, Math.min(4, need - 1)));
  mNeedRow(stage, need);
  mHavePile(stage, have, p, rnd);
  const ans = need - have;
  mNumChoices(stage, rnd, ans, (v, el) => ctx.settle(v === ans, el));
  ctx.speak('还差几块木板？');
}

/* 合成订单: k 件 × per 块(乘法先遇) */
function mCraftOrder(stage, p, rnd, ctx) {
  const per = mRi(rnd, 2, 4);
  const kMax = Math.max(2, Math.min(4, Math.floor((p.max || 12) / per)));
  const k = mRi(rnd, 2, kMax);
  let html = '';
  for (let j = 0; j < k; j++) {
    html += '<span class="m-ogroup">' + mIconImg('pickaxe') + mPileIcons(per, 'planks') + '</span>';
  }
  const order = mEl('div', 'm-order', html);
  order.dataset.k = k;
  order.dataset.per = per;
  stage.appendChild(order);
  const ans = k * per;
  mNumChoices(stage, rnd, ans, (v, el) => ctx.settle(v === ans, el));
  ctx.speak('做 ' + k + ' 把镐子，每把要 ' + per + ' 块木板，一共要几块？');
}

/* 魔法空格(挑战): 算式谜 / 天平代换 / 多解找齐, 按推理档混入 */
function mCraftBlank(stage, p, rnd, ctx) {
  const r = p.reasoning || 'single';
  const roll = rnd();
  if (r === 'multi-solve' && roll < 0.34) return mCraftBlankPartition(stage, p, rnd, ctx);
  if ((r === 'reverse' || r === 'multi-solve') && roll < 0.67) return mCraftBlankScale(stage, p, rnd, ctx);
  return mCraftBlankEq(stage, p, rnd, ctx);
}

/* 算式谜: x ? = z(空位恒第二操作数; reverse 起有减形) */
function mCraftBlankEq(stage, p, rnd, ctx) {
  const max = Math.max(8, Math.min(p.max || 20, 20));
  const subForm = (p.reasoning === 'reverse' || p.reasoning === 'multi-solve') && rnd() < 0.5;
  let x;
  let z;
  let ans;
  let op;
  if (subForm) {
    ans = mRi(rnd, 1, Math.floor(max / 2) - 1);
    z = mRi(rnd, ans + 2, max - 1);
    x = z + ans;
    op = '-';
  } else {
    ans = mRi(rnd, 1, Math.max(2, Math.floor(max / 2)));
    x = mRi(rnd, 1, Math.max(1, max - ans - 1));
    z = x + ans;
    op = '+';
  }
  mSeqRow(stage, [mNumSlot(x), mOpSlot(op), MATH_BLANK_SLOT, MATH_EQ_SLOT, mNumSlot(z)]);
  mNumChoices(stage, rnd, ans, (v, el) => ctx.settle(v === ans, el));
  ctx.speak('空格里是几？');
}

/* 天平代换(PuzzleCore.mkScalePuzzle): l 只 A = r 只 B, 问换算 */
function mCraftBlankScale(stage, p, rnd, ctx) {
  const pz = PuzzleCore.mkScalePuzzle({seed: RandCore.childSeed(rnd), max: p.max || 20});
  const iconOf = {a: 'diamond', b: 'emerald', c: 'coal'};
  const nameOf = {a: '钻石', b: '绿宝石', c: '煤炭'};
  for (const rel of pz.relations) {
    const row = mEl('div', 'm-rel',
        mPileIcons(rel.left, iconOf[rel.from]) + '<span class="m-rel-eq">=</span>' +
        mPileIcons(rel.right, iconOf[rel.to]));
    row.dataset.l = rel.left;
    row.dataset.r = rel.right;
    row.dataset.from = rel.from;
    row.dataset.to = rel.to;
    stage.appendChild(row);
  }
  const ask = mEl('div', 'm-ask',
      mPileIcons(pz.ask.n, iconOf[pz.ask.from]) + '<span class="m-rel-eq">=</span>' +
      '<span class="m-slot m-blank">?</span>');
  ask.dataset.n = pz.ask.n;
  ask.dataset.from = pz.ask.from;
  ask.dataset.to = pz.ask.to;
  stage.appendChild(ask);
  mNumChoices(stage, rnd, pz.answer, (v, el) => ctx.settle(v === pz.answer, el));
  const relText = pz.relations
      .map((rel) => rel.left + ' 只' + nameOf[rel.from] + '和 ' + rel.right + ' 只' + nameOf[rel.to] + '一样重')
      .join('，');
  ctx.speak(relText + '。那 ' + pz.ask.n + ' 只' + nameOf[pz.ask.from] + '，能换几只' + nameOf[pz.ask.to] + '？');
}

/* 多解找齐共用体(T7 收口): craft/blank 数字对与 craft/shop 钱币对同构,
   只差题面/chip 文案/话术 — qHtml=题面 html · chipOf(x,y)=chip 文案 ·
   line=话术; 找齐(恰选全部对选项, 不多不漏)才算对 */
function mSolveChips(stage, rnd, ctx, pz, qHtml, chipOf, line) {
  const n = pz.n;
  const q = mEl('div', 'm-q', qHtml);
  q.dataset.n = n;
  stage.appendChild(q);
  const goodKeys = new Set(pz.solutions.map((s) => s[0] + '+' + s[1]));
  const options = [];
  const nGood = 1 + (rnd() < 0.5 ? 1 : 0); // 1~2 个正确选项(≤4 组块)
  for (const s of RandCore.shuffle(rnd, pz.solutions).slice(0, nGood)) options.push({x: s[0], y: s[1], ok: true});
  let guard = 0;
  while (options.length < 4 && guard++ < 60) {
    const x = mRi(rnd, 1, Math.max(2, n - 1));
    const y = mRi(rnd, 1, Math.max(2, n - 1));
    if (x + y !== n && !options.some((o) => o.x === x && o.y === y)) options.push({x, y, ok: false});
  }
  const goodPresent = options.filter((o) => o.ok).length;
  const chosen = new Set();
  const row = mEl('div', 'm-nums');
  for (const o of RandCore.shuffle(rnd, options).slice(0, 4)) {
    const chip = mChoiceBtn(o.x + '+' + o.y, chipOf(o.x, o.y), 'm-chip', (v, el) => {
      el.classList.toggle('on');
      if (el.classList.contains('on')) chosen.add(v);
      else chosen.delete(v);
      sfxSafe('click');
    });
    chip.dataset.x = o.x;
    chip.dataset.y = o.y;
    row.appendChild(chip);
  }
  stage.appendChild(row);
  mOkBtn(stage, () => {
    const ok = chosen.size === goodPresent && [...chosen].every((k) => goodKeys.has(k));
    ctx.settle(ok, null);
  });
  ctx.speak(line);
}

/* 多解找齐(PuzzleCore.mkPartitionPuzzle): 合成 n 的数对全找齐 */
function mCraftBlankPartition(stage, p, rnd, ctx) {
  const pz = PuzzleCore.mkPartitionPuzzle({seed: RandCore.childSeed(rnd),
    max: Math.min(p.max || 12, 12), parts: 2});
  mSolveChips(stage, rnd, ctx, pz,
      '哪两个数合起来是 <b>' + pz.n + '</b>？把对的都找出来！',
      (x, y) => x + ' + ' + y,
      '哪两个数合起来是 ' + pz.n + '？把对的都找出来！');
}

/* ---------- pattern 族 F 找一找 ---------- */

/* 花纹接龙: 颜色/混排单元 · 推理档起混入数列(mkSeqPuzzle) */
function mPatternChain(stage, p, rnd, ctx) {
  const r = p.reasoning || 'single';
  const numericProb = r === 'single' ? 0 : (r === 'two-step' ? 0.5 : 0.75);
  if (rnd() < numericProb) return mPatternChainSeq(stage, p, rnd, ctx);
  return mPatternChainColor(stage, p, rnd, ctx);
}

function mPatternChainColor(stage, p, rnd, ctx) {
  const len = Math.min(4, Math.max(2, p.unitLen || 2));
  const dual = (p.dualRate || 0) > 0 && rnd() < p.dualRate;
  const alphabet = dual ? ['wool_red', 'wool_blue', 'wool_yellow', 'planks', 'brick', 'cobble'] :
    ['wool_red', 'wool_blue', 'wool_yellow'];
  const unit = [];
  for (let k = 0; k < len; k++) unit.push(mPick(rnd, alphabet));
  if (new Set(unit).size < 2) unit[len - 1] = alphabet.find((a) => a !== unit[0]); // 全同不成规律
  const r = mRi(rnd, 1, len - 1); // 展示 2 轮 + 不完整前缀, ? = unit[r]
  const slots = unit.concat(unit, unit.slice(0, r)).map((it) => mItemSlot(it));
  slots.push(MATH_BLANK_SLOT);
  mSeqRow(stage, slots);
  const distinct = [...new Set(unit)];
  const ans = unit[r];
  mIconChoices(stage, rnd, distinct, (v, el) => ctx.settle(v === ans, el));
  ctx.speak('看一看花纹的规律，下一个是什么？');
}

function mPatternChainSeq(stage, p, rnd, ctx) {
  const pz = PuzzleCore.mkSeqPuzzle({seed: RandCore.childSeed(rnd), max: p.max || 20});
  const slots = pz.seq.map((v) => mNumSlot(v));
  slots.push(MATH_BLANK_SLOT);
  mSeqRow(stage, slots);
  mNumChoices(stage, rnd, pz.next, (v, el) => ctx.settle(v === pz.next, el));
  ctx.speak('找找数的规律，下一个是几？');
}

/* 分装箱: 同款全挑出 · 推理档起=线索排队(mkClueOrderPuzzle, ≤3 线索) */
function mPatternSort(stage, p, rnd, ctx) {
  const r = p.reasoning || 'single';
  if (r === 'reverse' || r === 'multi-solve') return mPatternSortClue(stage, p, rnd, ctx);
  return mPatternSortBin(stage, p, rnd, ctx);
}

function mPatternSortBin(stage, p, rnd, ctx) {
  const wools = ['wool_red', 'wool_blue', 'wool_yellow'];
  const ruleIcon = mPick(rnd, wools);
  const rule = mEl('div', 'm-binrule', '<span class="m-binlabel">放进箱子：</span>' + mIconImg(ruleIcon, 'm-big'));
  rule.dataset.v = ruleIcon;
  stage.appendChild(rule);
  const k = mRi(rnd, 2, 3);
  const othersPool = ['planks', 'brick', 'cobble', 'coal'].filter((i) => i !== ruleIcon);
  const items = [];
  for (let j = 0; j < k; j++) items.push(ruleIcon);
  const total = mRi(rnd, 4, 6);
  for (let j = k; j < total; j++) items.push(mPick(rnd, othersPool));
  const wantCount = items.filter((it) => it === ruleIcon).length;
  const tray = mEl('div', 'm-tray');
  let idx = 0;
  for (const it of RandCore.shuffle(rnd, items)) {
    const el = mChoiceBtn('it' + idx++, mIconImg(it), 'm-item', (v, b) => {
      b.classList.toggle('in');
      sfxSafe('click');
    });
    el.dataset.v = it;
    tray.appendChild(el);
  }
  stage.appendChild(tray);
  mOkBtn(stage, () => {
    const sel = tray.children.filter((c) => c.classList.contains('in'));
    const ok = sel.length === wantCount && sel.every((c) => c.dataset.v === ruleIcon);
    ctx.settle(ok, null);
  });
  ctx.speak('把和箱子上一样的都挑出来，点好了按好啦。');
}

function mPatternSortClue(stage, p, rnd, ctx) {
  const pz = PuzzleCore.mkClueOrderPuzzle({seed: RandCore.childSeed(rnd), max: p.max || 20});
  const colorOf = {a: 'wool_red', b: 'wool_blue', c: 'wool_yellow'};
  const nameOf = {a: '红色的', b: '蓝色的', c: '黄色的'};
  const clueCount = Math.min(p.clueCount || 3, PuzzleCore.LIMITS.clues);
  const clues = pz.clues.slice(0, clueCount);
  const clueWrap = mEl('div', 'm-clues');
  for (const c of clues) {
    const row = mEl('div', 'm-clue',
        mIconImg(colorOf[c.hi]) + '<span class="m-clue-hi">高</span><span class="m-clue-gt">＞</span>' +
        mIconImg(colorOf[c.lo]));
    row.dataset.hi = c.hi;
    row.dataset.lo = c.lo;
    clueWrap.appendChild(row);
  }
  stage.appendChild(clueWrap);
  const picked = [];
  const row = mEl('div', 'm-cards');
  for (const k of RandCore.shuffle(rnd, ['a', 'b', 'c'])) {
    const card = mChoiceBtn(k, mIconImg(colorOf[k]), 'm-card', (v, el) => {
      if (el.classList.contains('picked')) return;
      el.classList.add('picked');
      picked.push(v);
      sfxSafe('click');
      if (picked.length >= 3) {
        ctx.settle(picked.join(',') === pz.solution.join(','), null);
      }
    });
    card.dataset.k = k;
    row.appendChild(card);
  }
  stage.appendChild(row);
  const clueText = clues.map((c) => nameOf[c.hi] + '比' + nameOf[c.lo] + '高').join('，');
  ctx.speak(clueText + '。按从高到矮，把他们排一排！');
}

/* 找异类: 类别少数派 */
const MATH_ODD_CATS = [
  ['wool_red', 'wool_blue', 'wool_yellow'],
  ['coal', 'iron', 'diamond'],
  ['cobble', 'planks', 'brick', 'stone'],
];

function mPatternOdd(stage, p, rnd, ctx) {
  const catIdx = mRi(rnd, 0, MATH_ODD_CATS.length - 1);
  const otherIdx = (catIdx + mRi(rnd, 1, MATH_ODD_CATS.length - 1)) % MATH_ODD_CATS.length;
  const total = (p.reasoning === 'single') ? 4 : 6;
  const oddIcon = mPick(rnd, MATH_ODD_CATS[otherIdx]);
  const items = [];
  for (let k = 0; k < total - 1; k++) items.push(mPick(rnd, MATH_ODD_CATS[catIdx]));
  items.push(oddIcon);
  const row = mEl('div', 'm-oddrow');
  for (const it of RandCore.shuffle(rnd, items)) {
    row.appendChild(mChoiceBtn(it, mIconImg(it), 'm-iconc', (v, el) => ctx.settle(v === oddIcon, el)));
  }
  stage.appendChild(row);
  ctx.speak('哪一个和其他的不一样？');
}

/* 周期问题(挑战): mkPeriodPuzzle, 问项必越过已展示(靠规律推) */
function mPatternCycle(stage, p, rnd, ctx) {
  const pz = PuzzleCore.mkPeriodPuzzle({seed: RandCore.childSeed(rnd),
    max: p.max || 20, unitLen: Math.min(4, Math.max(2, p.unitLen || 2))});
  const icons = pz.unit.map((c) => MATH_COLORS[c].ico);
  const names = pz.unit.map((c) => MATH_COLORS[c].name);
  const slots = icons.concat(icons).map((it) => mItemSlot(it));
  slots.push({cls: 'm-more', html: '…'});
  slots.push(MATH_BLANK_SLOT);
  mSeqRow(stage, slots);
  const q = mEl('div', 'm-q', '一直这样排下去，第 <b>' + pz.n + '</b> 个是什么颜色？');
  q.dataset.n = pz.n;
  stage.appendChild(q);
  const distinct = [...new Set(icons)];
  const ans = MATH_COLORS[pz.answer.item].ico;
  mIconChoices(stage, rnd, distinct, (v, el) => ctx.settle(v === ans, el));
  ctx.speak('颜色这样排：' + names.join('、') + '。一直排下去，第 ' + pz.n + ' 个是什么颜色？');
}

/* ---------- hop 族 C 屏流变体: 站位比大小 ---------- */

function mHopPosition(stage, p, rnd, ctx) {
  const cap = Math.max(10, Math.min(p.max || 20, 100));
  const a = mRi(rnd, 1, cap - 2);
  const b = mRi(rnd, a + 1, cap);
  const diffMode = p.reasoning && p.reasoning !== 'single';
  const line = mEl('div', 'm-line');
  const step = cap <= 20 ? 1 : ((p.landmark ? 10 : 5));
  for (let v = 0; v <= cap; v += step) {
    const tick = mEl('span', 'm-tick', v % step === 0 && (step === 1 ? v % 5 === 0 : true) ? String(v) : '');
    tick.style.left = (v / cap * 100) + '%';
    if (v === cap) tick.classList.add('m-tick-end');
    line.appendChild(tick);
  }
  stage.appendChild(line);
  const marks = [[a, 'zombie'], [b, 'skeleton']];
  if (!diffMode) {
    for (const [n, mob] of marks) {
      const mk = mChoiceBtn(n, mFaceImg(mob) + '<b class="m-marknum">' + n + '</b>', 'm-mark',
          (v, el) => ctx.settle(+v === b, el));
      mk.dataset.n = n;
      mk.style.left = 'calc(' + (n / cap * 100) + '% - 24px)';
      stage.appendChild(mk);
    }
    ctx.speak('谁站得远？点出大的数！');
  } else {
    for (const [n, mob] of marks) {
      const mk = mEl('div', 'm-mark m-markstat', mFaceImg(mob) + '<b class="m-marknum">' + n + '</b>');
      mk.dataset.n = n;
      mk.style.left = 'calc(' + (n / cap * 100) + '% - 24px)';
      stage.appendChild(mk);
    }
    const ans = b - a;
    mNumChoices(stage, rnd, ans, (v, el) => ctx.settle(v === ans, el));
    ctx.speak('两个数相差几？');
  }
}

/* ---------- 情境变体(T7): 商店/钟表/测距 — 挂族不独立成族 ---------- */

/* 商店货物册: mcIcon 物品系图标 + TTS 名(价签另挂, goods 项为只读描述符,
   出题时克隆附 price — 不污染共享表) */
const MATH_SHOP_GOODS = [
  {ico: 'coal', name: '煤炭'},
  {ico: 'iron', name: '铁锭'},
  {ico: 'planks', name: '木板'},
  {ico: 'brick', name: '砖块'},
  {ico: 'torch', name: '火把'},
  {ico: 'emerald', name: '绿宝石'},
];

/* 找零付款整钞序列(一年级教材常识: 5/10/20/50/100 元); 付款=大于价签的
   最小整钞(找零恒非零) */
const MATH_SHOP_BILLS = [5, 10, 20, 50, 100];

/* 货架行: k 件货各自带价(≤4 组块), 神 oracle 在 dataset.price */
function mShopGoods(stage, goods) {
  const row = mEl('div', 'm-shoprow');
  for (const g of goods) {
    const el = mEl('div', 'm-shopgood',
        mIconImg(g.ico, 'm-big') + '<span class="m-pricetag">' + g.price + ' 元</span>');
    el.dataset.price = g.price;
    el.dataset.ico = g.ico;
    row.appendChild(el);
  }
  stage.appendChild(row);
  return row;
}

/* 人民币商店(craft 皮肤): 买两样算一共 · 付整钞找零 · 付法找齐(挑战);
   金额跟带 min(max,100) 元 — 人民币金额口径 ≤100 */
function mCraftShop(stage, p, rnd, ctx) {
  const r = p.reasoning || 'single';
  const roll = rnd();
  if ((r === 'reverse' || r === 'multi-solve') && roll < 0.5) return mShopPayWays(stage, p, rnd, ctx);
  if (r !== 'single' && roll >= 0.5) return mShopChange(stage, p, rnd, ctx);
  return mShopSum(stage, p, rnd, ctx);
}

/* 买两样算一共: 价签加法(高带约半数掷整十价签, 100 以内加减先遇) */
function mShopSum(stage, p, rnd, ctx) {
  const cap = Math.max(4, Math.min(p.max || 20, 100));
  const tens = cap >= 50 && rnd() < 0.5;
  const pair = RandCore.shuffle(rnd, MATH_SHOP_GOODS).slice(0, 2);
  const p1 = tens ? mRi(rnd, 2, Math.min(9, Math.floor((cap - 9) / 10))) * 10 :
      mRi(rnd, 1, Math.min(9, cap - 1));
  const p2 = tens ? mRi(rnd, 1, 9) : mRi(rnd, 1, Math.min(9, cap - p1));
  mShopGoods(stage, [Object.assign({}, pair[0], {price: p1}), Object.assign({}, pair[1], {price: p2})]);
  const ans = p1 + p2;
  mNumChoices(stage, rnd, ans, (v, el) => ctx.settle(v === ans, el));
  ctx.speak('买 ' + pair[0].name + '和' + pair[1].name + '，一共要付几元？');
}

/* 找零: 价签 price, 付款=大于价签的最小整钞, 找回 bill-price(减法真用途) */
function mShopChange(stage, p, rnd, ctx) {
  const cap = Math.max(4, Math.min(p.max || 20, 95));
  const good = Object.assign({}, mPick(rnd, MATH_SHOP_GOODS), {price: mRi(rnd, 2, cap)});
  mShopGoods(stage, [good]);
  const bill = MATH_SHOP_BILLS.find((b) => b > good.price);
  const pay = mEl('div', 'm-shoppay', '付：');
  const billEl = mEl('span', 'm-bill', bill + ' 元');
  billEl.dataset.v = bill;
  pay.appendChild(billEl);
  stage.appendChild(pay);
  const ans = bill - good.price;
  mNumChoices(stage, rnd, ans, (v, el) => ctx.settle(v === ans, el));
  ctx.speak('买 ' + good.price + ' 元的' + good.name + '，付 1 张 ' + bill + ' 元，要找回来几元？');
}

/* 付法找齐(挑战): 哪两张钱合起来正好 n 元 — 有序枚举找齐才算对
   (mkPartitionPuzzle 钱币皮肤, 与 craft/blank 多解找齐同构) */
function mShopPayWays(stage, p, rnd, ctx) {
  const pz = PuzzleCore.mkPartitionPuzzle({seed: RandCore.childSeed(rnd),
    max: Math.min(p.max || 12, 12), parts: 2});
  mSolveChips(stage, rnd, ctx, pz,
      '买 <b>' + pz.n + ' 元</b>的东西，哪两张钱合起来正好？把对的都找出来！',
      (x, y) => x + ' 元 + ' + y + ' 元',
      '买 ' + pz.n + ' 元的东西，哪两张钱合起来正好 ' + pz.n + ' 元？把对的都找出来！');
}

/* 钟面小部件: DOM 指针钟(12/3/6/9 刻度 + 时/分针 transform 旋转);
   dataset.h/dataset.m 为神 oracle 位, 12 时制 1..12, 零 DOM 画布;
   针角度出自 mClockAngles 单一出处(常驻钟面 G1 与谜题钟面同形态) */
function mClockFace(stage, h, m) {
  const a = mClockAngles(h, m);
  const el = mEl('div', 'm-clock',
      '<span class="m-clock-num m-clock-n12">12</span>' +
      '<span class="m-clock-num m-clock-n3">3</span>' +
      '<span class="m-clock-num m-clock-n6">6</span>' +
      '<span class="m-clock-num m-clock-n9">9</span>' +
      '<span class="m-clock-hand m-hourhand" style="transform: rotate(' + a.hour + 'deg)"></span>' +
      '<span class="m-clock-hand m-minhand" style="transform: rotate(' + a.min + 'deg)"></span>');
  el.dataset.h = h;
  el.dataset.m = m;
  stage.appendChild(el);
  return el;
}

/* 时刻→时/分针角度(纯函数, G1 常驻钟面与谜题钟面的单一直出处):
   12 点制 — 12/0 时都指正上 0°(h%12); 分针角 = m×6(0..354, 59 分→0 分
   顺接无回卷); 时针角随分推进 ((h%12)×30 + m×0.5) — 半时时针落在两个
   数字中间, 正是"长针指 6 短针走过 x"的认钟教学点 */
function mClockAngles(h, m) {
  return {hour: (h % 12) * 30 + m * 0.5, min: m * 6};
}

/* 时刻→报时中文串(纯函数, 一年级教材口径): 整时「X 点整」· 半时「X 点半」·
   其余「X 点 Y 分」; h 收 24 时制(0..23)内部归 12 点制 — 报的就是钟面针
   指的; G1 常驻钟面点击 SpeechKit 报时用 */
function mClockSay(h, m) {
  const hh = (h % 12) || 12;
  if (m === 0) return '现在是 ' + hh + ' 点整';
  if (m === 30) return '现在是 ' + hh + ' 点半';
  return '现在是 ' + hh + ' 点 ' + m + ' 分';
}

/* 分钟总数 → 'h:mm' 12 时制串(数字符号是学习对象, 允许出现; 负数入参
   先归正 — 干扰项偏移用) */
function mClockStr(min) {
  const t = ((min % 720) + 720) % 720;
  return (Math.floor(t / 60) || 12) + ':' + String(t % 60).padStart(2, '0');
}

/* 时刻选项条: 答案 + 邻近时刻干扰(±一刻/半时/整时), 恰 4 选项(≤4 组块) */
function mClockChoices(stage, rnd, ansMin, onPick) {
  const answer = mClockStr(ansMin);
  const vals = [answer];
  for (const o of RandCore.shuffle(rnd, [15, -15, 30, -30, 60, -60, 120, -120])) {
    if (vals.length >= 4) break;
    const s = mClockStr(ansMin + o);
    if (!vals.includes(s)) vals.push(s);
  }
  let extra = 1;
  while (vals.length < 4 && extra < 40) {
    const s = mClockStr(ansMin + 305 + 7 * extra++);
    if (!vals.includes(s)) vals.push(s);
  }
  const row = mEl('div', 'm-nums');
  for (const v of RandCore.shuffle(rnd, vals)) row.appendChild(mChoiceBtn(v, v, 'm-num', onPick));
  stage.appendChild(row);
}

/* 钟表时刻(hop 皮肤): 认整时/半时(single, 带 0~1 主场 — two-step 起仍
   五成复现) · 过半小时/过一小时(two-step, 答案仍落整/半格) · 过一刻钟
   (reverse 起, 时间推算的挑战口径) */
function mHopClock(stage, p, rnd, ctx) {
  const r = p.reasoning || 'single';
  const roll = rnd();
  if (r === 'single') return mClockRead(stage, rnd, ctx, roll < 0.5 ? 0 : 30);
  if (r === 'two-step') {
    return roll < 0.5 ? mClockRead(stage, rnd, ctx, rnd() < 0.5 ? 0 : 30) :
        mClockAfter(stage, rnd, ctx, rnd() < 0.5 ? 30 : 60);
  }
  return roll < 0.25 ? mClockRead(stage, rnd, ctx, rnd() < 0.5 ? 0 : 30) :
      mClockAfter(stage, rnd, ctx, 15); // 过一刻钟(挑战口径)
}

/* 认时刻: 读指针钟(整时=短针指数字长针指 12; 半时=长针指 6) */
function mClockRead(stage, rnd, ctx, minute) {
  const h = mRi(rnd, 1, 12);
  const t = (h % 12) * 60 + minute;
  mClockFace(stage, h, minute);
  mClockChoices(stage, rnd, t, (v, el) => ctx.settle(v === mClockStr(t), el));
  ctx.speak(minute === 0 ? '看一看，钟上是几点整？' : '看一看，钟上是几点半？');
}

/* 时间推算: 基时刻(整/半)+delta, 答案可跨时进位(11:30 过半小时=12:00) */
function mClockAfter(stage, rnd, ctx, delta) {
  const h = mRi(rnd, 1, 12);
  const minute = rnd() < 0.5 ? 0 : 30;
  const base = (h % 12) * 60 + minute;
  mClockFace(stage, h, minute);
  const name = delta === 15 ? '一刻钟' : (delta === 30 ? '半小时' : '一小时');
  const q = mEl('div', 'm-q', '再过 <b>' + name + '</b>是几点？');
  q.dataset.delta = delta;
  stage.appendChild(q);
  mClockChoices(stage, rnd, base + delta, (v, el) => ctx.settle(v === mClockStr(base + delta), el));
  ctx.speak('现在是 ' + (minute === 0 ? h + ' 时整' : h + ' 时半') + '，再过 ' + name + '是几点？');
}

/* 测距步数(count 皮肤): 数格子量距离 — single=两端都数(b-a+1) ·
   two-step=跳几格(b-a) · reverse 起六成往返(2×(b-a), ×2 萌芽);
   a/b 显式注入 mkIntervalPuzzle(跨度 ≤12 数格可数红线), 起点挂小怪物
   终点挂小旗, 格子带绝对序号(大数跟带在格子号上) */
function mCountMeasure(stage, p, rnd, ctx) {
  const r = p.reasoning || 'single';
  const cap = Math.max(6, Math.min(p.max || 20, 60));
  const round = (r === 'reverse' || r === 'multi-solve') && rnd() < 0.6;
  let mode;
  if (round) mode = 'one';
  else if (r === 'single') mode = 'both';
  else mode = rnd() < 0.5 ? 'one' : 'both';
  const span = mRi(rnd, 3, Math.min(12, cap - 2));
  const a = mRi(rnd, 1, cap - span);
  const b = a + span;
  const pz = PuzzleCore.mkIntervalPuzzle({max: cap, a, b, mode});
  const path = mEl('div', 'm-path');
  path.dataset.a = a;
  path.dataset.b = b;
  path.dataset.mode = mode;
  path.dataset.round = round ? '1' : '0';
  for (let v = a; v <= b; v++) {
    const mark = v === a ? mFaceImg('zombie') : (v === b ? mIconImg('flag', 'm-big') : '');
    const cell = mEl('span', 'm-cell' + (mark ? ' m-cellend' : ''),
        (mark || '') + '<b class="m-cellnum">' + v + '</b>');
    cell.dataset.n = v;
    path.appendChild(cell);
  }
  stage.appendChild(path);
  const ans = pz.answer * (round ? 2 : 1);
  mNumChoices(stage, rnd, ans, (v, el) => ctx.settle(v === ans, el));
  ctx.speak(round ? '小怪物走到小旗再走回来，一共走了几格？' :
      (mode === 'both' ? '从小怪物那里数到小旗，一共有几格？' : '小怪物跳到小旗那里，要跳几格？'));
}


/* ---------- 试次驱动器 ---------- */

function sfxSafe(name) {
  if (typeof sfx === 'function') sfx(name);
}

/* 屏流变体清单唯一权威(T2 并表后): 键集即 mathScreenDispatch 的判定源,
   T5-b 起也是驱动器统一注册表(MATH_TRACK_RUNNERS)屏流键的派生源 —
   增删屏流变体只改这一张表, 与注册表的一致性由「单一权威」测试互锁 */
const MATH_SCREEN_ENGINES = {
  'count/snapshot': mCountSnapshot,
  'count/fetch': mCountFetch,
  'count/compare': mCountCompare,
  'count/balance': mCountBalance,
  'craft/enough': mCraftEnough,
  'craft/shortage': mCraftShortage,
  'craft/order': mCraftOrder,
  'craft/blank': mCraftBlank,
  'pattern/chain': mPatternChain,
  'pattern/sort': mPatternSort,
  'pattern/odd': mPatternOdd,
  'pattern/cycle': mPatternCycle,
  'hop/position': mHopPosition,
  'count/measure': mCountMeasure,
  'craft/shop': mCraftShop,
  'hop/clock': mHopClock,
};

/* 主入口: 屏流节的引擎出口(T5-b 起经驱动器统一注册表 MathTrack.runners
   派发, 注册表键集即本文件引擎表派生 — 误调防御随 dispatch 反转消亡,
   世界变体键在此查不到引擎, 直接抛错即编程错误); 逐试次
   onTrial({ok, streak}) 供 T8 挂 loot; 完成回调 st 供
   mathPassed/mathStars(单关口径); stop()=中止: 断计时器闸并清 area
   (Q11「清完再发 end」的 DOM 项, 与 next() 每试次清场同款)。 */
function runMathScreen(section, area, h) {
  const key = section.family + '/' + section.variant; /* 引擎键(注册表派生源) */
  const p = mathGuardParams(section.params || {});
  const rnd = RandCore.mkRand(section.seed !== undefined ? section.seed : p.seed);
  const T = mTimers();
  const hh = h || {};
  const n = MathTrackCore.clampTrials(p.trials);
  const loop = MathTrackCore.mkTrialLoop(); /* 试次循环骨架(T3 并一): 记分与节拍决策在纯核心 */
  const stats = loop.stats;
  let idx = 0;
  let settled = false;
  let stopped = false;

  function settle(ok, el) {
    if (settled || stopped) return;
    settled = true;
    const ev = loop.settle(ok); /* 记分+节拍决策(表扬/安慰口径唯一在核心) */
    if (el) el.classList.add(ok ? 'good' : 'bad');
    sfxSafe(ev.ok ? 'pick' : 'click');
    if (hh.onTrial) hh.onTrial({ok: ev.ok, streak: ev.streak});
    /* 过程性表扬/安慰: 话术住模式层(modes/math.js), 经全局名调用期解析 */
    const speakSafe = (s) => {
      if (typeof SpeechKit !== 'undefined' && SpeechKit) SpeechKit.speak(s);
    };
    if (ev.praise && typeof mathPraiseLine === 'function') {
      speakSafe(mathPraiseLine());
    }
    if (ev.comfort && typeof mathComfortLine === 'function') {
      speakSafe(mathComfortLine());
    }
    T.after(700, next);
  }

  function next() {
    if (stopped) return;
    if (idx >= n) {
      loop.end();
      if (hh.end) hh.end(stats);
      return;
    }
    if (hh.progress) hh.progress(idx, n);
    settled = false;
    area.innerHTML = '';
    const stage = mEl('div', 'm-stage');
    area.appendChild(stage);
    MATH_SCREEN_ENGINES[key](stage, p, rnd, {
      T,
      speak: (s) => {
        if (typeof SpeechKit !== 'undefined' && SpeechKit) SpeechKit.speak(s);
      },
      settle,
    });
    idx++;
  }

  next();
  return {
    stop() {
      stopped = true;
      T.stop();
      /* Q11「清完再发 end」的 DOM 项收进 seam: 最后试次的 .m-stage 不再
         残留到模式层换屏(stopped 闸先判幂等; boss 400ms 接力窗内下一节
         next() 的每试次清场与这里双清无害) */
      area.innerHTML = '';
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {mathScreenDispatch, mathGuardParams, runMathScreen, mFrameLayout};
}
