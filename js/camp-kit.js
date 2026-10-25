'use strict';
/* ============================================================
   CampKit(训练营壳 kit, 术语见 GLOSSARY.md「训练营壳 kit」)
   — 应用层·装配(CombatKit 同款: THREE/DOM 惰性, 观感件调用期才碰)
   一句话职责: focus/math 两训练营模式壳机器的收编地 — 已收: T1 战利品
   回路五件套(时长 ticker/授予入包/战利品飞行/落袋槽/结算回顾, 矿袋会话
   状态自持实例) + T2 图章仪式四件套(日历条/授予仪式块/三选一 picker/
   烟花) + T3 家长门/迷你折线/CSV 下载仪式/结算星显+自动续程; 家族差异
   (预算访问器 · f-/m- DOM 前缀 · 缺省飞行起点 · 满包回调 · 章白名单/
   章名表/缺省章 · 日期键与计数派生 · 奖励线→文案 · 存档与根容器访问器 ·
   折线数值域与空态 · 自动续程时长)全部经工厂入参注入, 掷骰政策(段位
   变率/族池)、图章与关卡数值表、家长面板数据聚合与布局(家族面)留在
   各自 levels/modes 不进本 kit; 家族观感分叉(focus 魔鬼角标/村长喝彩图
   ↔ math 无)经 badge/awardIcon 缝注入。
   interface: mkCampTicker({budget})→{start(),stop()} ·
     mkLootHud({prefix, bag, hud, defaultOrigin, onFull})→{begin() ·
     grantIntoBag(ids) · noteTap(x,y) · fly(id,from?) · addSlot(id) ·
     recapHtml(ids?) · runRecap(ids?,box?) · clear()} ·
     mkStampRites({prefix, kinds, kindNames, kindDefault, daily, dayKey,
     count, rewardFor, rewardText, save, root, badge?, awardIcon?})→
     {kindOf(save) · calendarHtml(save) · awardHtml(lines,save) ·
     wirePicker(save) · firework()} ·
     mkParentGate({prefix, scope, screen, onPass, onFail})→{open()} ·
     sparkSvg(series,{cls,max,noData}) · downloadCsv(filename,rows) ·
     mkSettleBits({prefix, autoMs})→{starSpans(stars) · popStars(stars) ·
     armAuto(fn,ms?) · clear()}
   依赖(均经全局名, 调用期解析): CampCore(js/camp-core.js — grantLoot
     授予基座) · RandCore(js/rand-core.js — shuffle 家长门干扰项洗牌) ·
     sfx(js/audio.js)与 ITEMS(js/items-core.js)/iconOf(js/icons.js)
     (落袋音与像素图标, icons 在模式文件之后加载, 调用期才解析) ·
     stampIcon(js/focus-icons.js, 章图案 big/gold/家族自选) ·
     SpeechKit(js/speech.js, 三选一选中读章名) · Backpack 实例与满包
     toast 回调经入参注入(ADR 0002: 背包只经壳, 入包即 save) ·
     document/URL/Blob(DOM 惰性, 方法调用时才取), Node 测试可安全加载;
     加载序: camp-core/rand-core 之后 · 两训练营模式文件之前
   可测性: THREE/DOM 惰性创建, Node 测试可安全加载; ticker 钳制与
     授予/节流账目、图章 kindOf/仪式块两分支与角标缝、家长门题面/接线、
     折线数值域、星显与自动续程时长有单测(test/camp-kit.test.js vm 桩
     直测), 其余 DOM 观感件不直测(仓库惯例), 行为面由 boot 冒烟 +
     math-paradigms 流程断言兜底
   ============================================================ */

/* ---------- 训练时长 ticker(focus/math 镜像复制体收编): 每秒 accrue 实际毫秒 ----------
   关卡进行中每秒入账并落账 — 崩溃/关页损失 ≤1 秒; 菜单/地图页不计(口径不变)。
   单拍钳制 2000ms(f3c1fee 修复语义单份保真): 只认连续在场的真实训练时长 —
   iPad 锁屏/切后台时系统冻结 timer, 恢复后第一拍的墙钟差是整段挂机时长,
   曾把 20 分钟日限一夜灌成 20.6 小时(墙钟差一次性入账, 当日入口直接锁死);
   与 main.js play 预算的 dt 钳制同哲学。budget 是预算访问器(模式注入, 如
   () => Budgets.focus); 缺预算的拍不入账也不推 t0(下一拍仍受钳制保护);
   start 幂等(已走先停), stop 后状态复位 */
const CAMP_TICK_MAX_MS = 2000; /* 单拍入账上限 */
function mkCampTicker(cfg) {
  const o = cfg || {};
  let timer = 0;
  let t0 = 0;
  function start() {
    stop();
    t0 = Date.now();
    timer = setInterval(() => {
      const b = o.budget ? o.budget() : null;
      if (!b) return;
      const nowT = Date.now();
      b.accrue(Math.min(nowT - t0, CAMP_TICK_MAX_MS));
      t0 = nowT;
      b.flush();
    }, 1000);
  }
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  }
  return {start, stop};
}

/* ---------- 矿袋战利品 HUD(focus F5/math T8 镜像复制体收编): 一实例一家族 ----------
   prefix 拼 DOM id/类名(f-/m-, CSS 契约一个都不能变): HUD 容器 #fBagHud/
   #mBagHud(经 hud 访问器取) · 槽位 .{p}-bag-slot 与角标 .{p}-bag-n ·
   飞行件 .{p}-loot-fly · 回顾块 .{p}-loot-recap/.{p}-loot-title/.{p}-loot-item
   与 #fLootRecap/#mLootRecap; bag 是 Backpack 实例(ADR 0002: 入包即
   save); defaultOrigin() 是缺省飞行起点(focus=训练区 #fArea 矩心带兜底
   常量 / math=屏心 — 指针锁宿主无点击位可记, 参数化保真两侧现状);
   onFull 是满包 toast 回调(每关至多一次, 节流旗自持); 点击监听挂点留
   模式层, 坐标只经 noteTap 通道入账 */
function mkLootHud(cfg) {
  const o = cfg || {};
  const pfx = o.prefix || 'f';
  const flying = []; /* 在场飞行件(clear 收口用 — 它们挂 document.body, 换页收不走) */
  let lootSession = null; /* 本关入包明细 {id: n}(结算回顾与 HUD 计数的唯一数据源) */
  let bagFullSaid = false; /* 满包 toast 每关至多一次 */
  let lastTap = null; /* 最近一次点击坐标 — 战利品飞行起点 */
  function hudEl() {
    return o.hud ? o.hud() : null;
  }
  /* 开张本关会话(模式在关卡 begin 处调): 明细清零 / 节流旗复位 / 起点清零 */
  function begin() {
    lootSession = {};
    bagFullSaid = false;
    lastTap = null;
  }
  /* 授予流(F3 核定口径): CampCore.grantLoot 入包 + 入包成功即 save(频率低,
     不批量, ADR 0002); 余量>0 静默忽略 + 每关至多一次 onFull(零惩罚,
     授予基座在 CampCore, 家族掷骰在各自 levels 纯函数) */
  function grantIntoBag(ids) {
    if (!lootSession) return {granted: [], full: false}; // 非关卡会话(防御)
    const res = CampCore.grantLoot(o.bag.inv, ids);
    for (const id of res.granted) {
      lootSession[id] = (lootSession[id] || 0) + 1;
    }
    if (res.granted.length) o.bag.save();
    if (res.full && !bagFullSaid) {
      bagFullSaid = true;
      if (o.onFull) o.onFull();
    }
    return res;
  }
  /* 记录飞行起点(点击监听挂点在模式层, 本票不动, 只改记录通道) */
  function noteTap(x, y) {
    lastTap = {x, y};
  }
  /* 战利品飞行: iconOf 像素图标从起点沿贝塞尔弧线飞入矿袋槽位 — 位移经
     CSS 变量 --dx/--dy 传给 keyframes(样式在 css/focus.css 与 css/math.css);
     元素挂 document.body(根容器的动画全关降级块管不到, 飞行在
     prefers-reduced-motion 下自退化为淡入); HUD 宽度为 0(隐藏/世界轨
     宿主隐 DOM 屏 — math 侧现状守卫, 收编统一, focus 侧实践上 no-op)
     直接放弃观感, 入包已完成; 落袋后更新 HUD 槽位 */
  function fly(id, from) {
    const h = hudEl();
    if (!h) return; // 无 HUD(教学关/已切屏): 静默放弃观感, 入包已完成
    const to0 = h.getBoundingClientRect();
    if (!to0.width) return; // HUD 隐藏: 放弃观感
    const fromPos = from || lastTap || (o.defaultOrigin ? o.defaultOrigin() : {x: 0, y: 0});
    const slot = h.querySelector('.' + pfx + '-bag-slot[data-item="' + id + '"]');
    const r = (slot || h).getBoundingClientRect(); // 已有槽飞向该槽, 新物品飞向收集条末端
    const to = {x: r.left + r.width / 2, y: r.top + r.height / 2};
    const el = document.createElement('img');
    el.src = iconOf(id);
    el.alt = '';
    el.className = pfx + '-loot-fly';
    el.style.left = (fromPos.x - 22) + 'px'; /* 中心点对齐(44px 图标) */
    el.style.top = (fromPos.y - 22) + 'px';
    el.style.setProperty('--dx', (to.x - fromPos.x) + 'px');
    el.style.setProperty('--dy', (to.y - fromPos.y) + 'px');
    document.body.appendChild(el);
    flying.push(el);
    setTimeout(() => {
      const i = flying.indexOf(el);
      if (i >= 0) flying.splice(i, 1);
      el.remove();
      addSlot(id); // 落袋: 计数 + 弹跳 + 叮咚
    }, 620); // 与 keyframes 时长对齐(0.6s 弧线)
  }
  /* 矿袋 HUD 落袋: 同 id 并槽计数, 新物品开槽(槽满自动滚到最新), 槽位弹跳 +
     叮咚 sfx('pick')(与引擎答对音叠成双声部, 观感对齐 drops 真空吸附) */
  function addSlot(id) {
    const h = hudEl();
    if (!h) return;
    let slot = h.querySelector('.' + pfx + '-bag-slot[data-item="' + id + '"]');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = pfx + '-bag-slot';
      slot.dataset.item = id;
      slot.title = ITEMS[id] ? ITEMS[id].name : id;
      slot.innerHTML = '<img draggable="false" alt="" src="' + iconOf(id) + '"><span class="' +
          pfx + '-bag-n"></span>';
      h.appendChild(slot);
    }
    const n = lootSession ? (lootSession[id] || 1) : 1;
    slot.querySelector('.' + pfx + '-bag-n').textContent = n > 1 ? '×' + n : '';
    h.scrollLeft = h.scrollWidth; // 槽满滚动: 最新拾取始终可见
    slot.classList.remove('bump');
    void slot.offsetWidth;
    slot.classList.add('bump');
    sfx('pick');
  }
  /* 结算屏战利品回顾: 本关获得从矿袋飞出列队 + 计数 — 级联进场逐件 pop
     (星星爆开之后), 无获得不渲染区块; ids 缺省用实例会话(模式侧家族名
     零参薄委托), box 缺省按前缀取回顾容器 */
  function recapHtml(ids) {
    const n = Object.keys(ids || lootSession || {}).length;
    return n ? '<div class="' + pfx + '-loot-recap" id="' + pfx + 'LootRecap">' +
        '<span class="' + pfx + '-loot-title">🎒 本关收获</span></div>' : '';
  }
  function runRecap(ids, box) {
    const el = box || document.getElementById(pfx + 'LootRecap');
    if (!el) return;
    Object.entries(ids || lootSession || {}).forEach(([id, n], k) => {
      setTimeout(() => {
        if (!document.getElementById(pfx + 'LootRecap')) return; // 已切屏: 中止列队
        const nm = ITEMS[id] ? ITEMS[id].name : id;
        const item = document.createElement('span');
        item.className = pfx + '-loot-item';
        item.title = nm;
        item.innerHTML = '<img draggable="false" alt="' + nm + '" src="' + iconOf(id) + '">' +
            (n > 1 ? '<b>×' + n + '</b>' : '');
        el.appendChild(item);
        if (k < 3) sfx('pick'); // 声音节流: 只前 3 件
      }, 220 * k + 250);
    });
  }
  /* 清空: 在场飞行件/HUD 槽位/会话状态(模式 cleanup 调 — 飞行件挂在
     document.body, 根容器换页收不走它们) */
  function clear() {
    while (flying.length) flying.pop().remove();
    const h = hudEl();
    if (h) {
      for (const s of [...h.querySelectorAll('.' + pfx + '-bag-slot')]) s.remove();
    }
    lootSession = null;
    bagFullSaid = false;
    lastTap = null;
  }
  return {begin, grantIntoBag, noteTap, fly, addSlot, recapHtml, runRecap, clear};
}

/* ---------- 图章仪式(focus F7/B6/math T8 镜像复制体收编, C1-T2): 一实例一家族 ----------
   四件套: 本月日历条(当日 ≥min 普通章/≥big 大章, 漏签空白无负面标记,
   30 章起头部常驻金章 — 纯观感不占章位, 阈值 30 两侧现状字面量, 与
   CampCore 图章步长同源) · 授予仪式块(奖励声明 + 可选喝彩图) · 三选一
   图案 picker(达成 stamp_pattern 线时渲染, wirePicker 接线: 选中即写
   存档并高亮 + sfx + TTS 读章名) · 烟花(box-shadow 粒子手法, 样式在
   各自 css, prefers-reduced-motion 下动画全关且基础 opacity=0)。
   家族数据经 opts 注入: kinds 章白名单/kindNames 章名表/kindDefault
   缺省章(损坏存档回落, 白名单在各自 levels)/daily{min,big} 当日章线/
   dayKey 日期键(库层单点出口)/count 集章数(库层薄委托)/rewardFor
   达成线→奖励 id/rewardText 奖励文案/save 写档/root 烟花挂的根容器
   访问器; 家族观感分叉经缝注入: badge(day, save)→角标 html(focus=
   魔鬼特训鬼图章, 与普通章并存不改集章口径; math 无, 缺省无角标) ·
   awardIcon()→喝彩图 html(focus=村长喝彩, 有图时奖励文本包进
   {p}-award-text; math 无, 缺省裸文本)。落账差集与领取归各自 levels
   (settleFocusStamps/mathStampClaim), 触发时机(仪式/宝物柜/今日页
   恢复)是调用方差异, 留在 modes */
function mkStampRites(opts) {
  const o = opts || {};
  const pfx = o.prefix || 'f';
  const kinds = o.kinds || [];
  const kindNames = o.kindNames || {};
  const daily = o.daily || {min: 1, big: 3};
  /* 当前章图案: 损坏/缺省回落家族缺省章(与 migrate 存档同一白名单) */
  function kindOf(save) {
    return save && kinds.includes(save.stampKind) ? save.stampKind : o.kindDefault;
  }
  /* 本月日历条(本月外不渲染): 普通章用自选图案, 大章固定, 今日单元格
     带高亮类; 集章数与日期键经库层派生注入 */
  function calendarHtml(save) {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const days = new Date(year, month + 1, 0).getDate(); // 本月总天数
    const todayStr = o.dayKey(now.getTime());
    const kind = kindOf(save);
    const total = o.count(save.stamps);
    let cells = '';
    for (let d = 1; d <= days; d++) {
      const key = o.dayKey(new Date(year, month, d).getTime()); // 日期键单点出口
      const n = save.stamps[key] || 0;
      const ico = n >= daily.big ? stampIcon('big') :
          n >= daily.min ? stampIcon(kind) : '';
      const badge = o.badge ? (o.badge(key, save) || '') : '';
      cells += '<div class="' + pfx + '-stamp-cell' + (key === todayStr ? ' ' + pfx + '-stamp-today' : '') + '">' +
        (ico ? '<img draggable="false" alt="" src="' + ico + '">' : '') +
        badge +
        '<span>' + d + '</span></div>';
    }
    // 金图章: 30 章起日历头部常驻(纯观感, 不占章位)
    const gold = total >= 30 ?
        '<img class="' + pfx + '-stamp-gold" draggable="false" alt="" src="' + stampIcon('gold') + '">' : '';
    return '<div class="' + pfx + '-stamp-cal"><div class="' + pfx + '-stamp-title">📅 ' + (month + 1) +
        ' 月的图章 · 已集 ' + total + ' 枚' + gold + '</div><div class="' + pfx + '-stamp-grid">' +
        cells + '</div></div>';
  }
  /* 集章授予仪式块: 奖励声明 + 可选喝彩图(awardIcon 缝 — 有图时文本
     包进 {p}-award-text, 无图裸文本, 两家族字节对齐现状) + 三选一
     图案选择器(达成 stamp_pattern 线时) */
  function awardHtml(lines, save) {
    if (!lines || !lines.length) return '';
    const items = lines.map((line) => '<div>🎖️ ' + o.rewardText(o.rewardFor(line)) + '</div>').join('');
    const pattern = lines.some((line) => o.rewardFor(line) === 'stamp_pattern');
    const picker = pattern ? '<div class="' + pfx + '-stamp-pick" id="' + pfx + 'StampPick">' +
        '<div class="' + pfx + '-stamp-pick-label">选一个你喜欢的图章</div>' +
        kinds.map((kind) => '<button type="button" data-kind="' + kind + '"' +
            (kind === kindOf(save) ? ' class="on"' : '') + ' title="' +
            kindNames[kind] + '" aria-label="' + kindNames[kind] + '">' +
            '<img draggable="false" alt="" src="' + stampIcon(kind) + '"></button>').join('') +
        '</div>' : '';
    const icon = o.awardIcon ? (o.awardIcon() || '') : '';
    const body = icon ?
        '<div class="' + pfx + '-award-text"><b>集齐 ' + lines[lines.length - 1] + ' 枚图章啦！</b>' +
            items + '</div>' :
        '<b>集齐 ' + lines[lines.length - 1] + ' 枚图章啦！</b>' + items;
    return '<div class="' + pfx + '-award">' + icon + body + '</div>' + picker;
  }
  /* 三选一图案选择器接线: 选中即写存档(经 save 缝)并高亮, 日历下次
     渲染即用新图案; 未达成时无节点自动 no-op */
  function wirePicker(save) {
    const box = document.getElementById(pfx + 'StampPick');
    if (!box) return;
    const buttons = [...box.querySelectorAll('button')];
    const mark = () => buttons.forEach((b) => b.classList.toggle('on', b.dataset.kind === kindOf(save)));
    mark();
    buttons.forEach((btn) => {
      btn.onclick = () => {
        save.stampKind = btn.dataset.kind;
        o.save(save);
        mark();
        sfx('pick');
        SpeechKit.speak(kindNames[btn.dataset.kind]);
      };
    });
  }
  /* 一次性 CSS 粒子迸发(firework 奖励): 元素挂根容器(经 root 访问器
     注入), 1600ms 后自清 */
  function firework() {
    const r = o.root ? o.root() : null;
    if (!r) return;
    const el = document.createElement('div');
    el.className = pfx + '-firework';
    el.setAttribute('aria-hidden', 'true');
    r.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
  return {kindOf, calendarHtml, awardHtml, wirePicker, firework};
}

/* ---------- 家长门(focus/math 镜像复制体收编, C1-T3): 算术题门一实例一家族 ----------
   防幼童误入的轻量门: 两随机数 ∈[5,9] 的加法, 干扰项 ans+1..3 与
   ans-1..3(下限钳 2, 与正解恒不撞), RandCore.shuffle 洗牌(替换原
   .sort(random-0.5) 手写洗牌 — Fisher-Yates 单件实现且不偏分布);
   parseInt 比对: 答对 onPass(各自家长面板), 答错 onFail(各自今日页,
   不重试不提示 — 零羞辱静默回落); 渲染经 screen 缝注入(家族屏函数:
   换屏清自动续程/带返回条), 按钮查询范围经 scope 注入(#focusRoot/
   #mathRoot, 防跨模式误配); 面板本体(数据聚合与布局)是家族面, 留 modes */
function mkParentGate(cfg) {
  const o = cfg || {};
  const pfx = o.prefix || 'f';
  function open() {
    const a = 5 + Math.floor(Math.random() * 5); const b = 5 + Math.floor(Math.random() * 5);
    const ans = a + b;
    const opts = RandCore.shuffle(Math.random, [ans,
      ans + 1 + Math.floor(Math.random() * 3),
      Math.max(2, ans - 1 - Math.floor(Math.random() * 3))]);
    const buttons = opts.map((x) => '<button class="' + pfx + '-btn" data-a="' + x + '">' + x + '</button>').join('');
    o.screen(`
    <div class="${pfx}-screen">
      <h1>家长入口</h1>
      <p class="${pfx}-sub">请回答：${a} + ${b} = ?</p>
      <div class="${pfx}-gate-row">${buttons}</div>
    </div>`);
    document.querySelectorAll((o.scope || '') + ' .' + pfx + '-gate-row button').forEach((btn) => {
      btn.onclick = () => {
        parseInt(btn.dataset.a, 10) === ans ? o.onPass() : o.onFail();
      };
    });
  }
  return {open};
}

/* ---------- 迷你折线(家长面板 spark, C1-T3): SVG polyline 纯 html 构造件 ----------
   W120×H36/stroke #7cfc00/2px 两侧现状同参; 数值域与空态经 cfg 注入保真:
   max=100(focus 喂 save.history 尾 20 条, acc∈0–100)或 1(math 喂
   mathPanelTrend 序列, acc∈0..1); noData 为 <2 点空态(focus「数据不足」
   带 f-nodata 样式 / math「—」); cls 为 svg 类名(f-spark/m-spark) */
function sparkSvg(series, cfg) {
  const o = cfg || {};
  const list = series || [];
  if (list.length < 2) return o.noData !== undefined ? o.noData : '—';
  const W = 120; const H = 36;
  const max = o.max !== undefined ? o.max : 1;
  const pts = list.map((x, k) => (k * (W / (list.length - 1))).toFixed(1) + ',' +
      (H - 2 - (H - 6) * x.acc / max).toFixed(1)).join(' ');
  return `<svg width="${W}" height="${H}" class="${o.cls || 'f-spark'}">` +
      `<polyline points="${pts}" fill="none" stroke="#7cfc00" stroke-width="2"/></svg>`;
}

/* ---------- CSV 下载仪式(家长面板导出, C1-T3): BOM + Blob + a.click + 5s revoke ----------
   '\uFEFF' 前置防 Excel 中文乱码; 行构造不在此件(focus 模式层内联拼行 /
   math 走库层 mathPanelCsv — 数据聚合是家族面) */
function downloadCsv(filename, rows) {
  const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- 结算件(星显+自动续程, C1-T3): 一实例一家族 ----------
   starSpans: 三星 span 行(⭐ + on 类 + data-n, 结算屏模板注入);
   popStars: 350ms*n 逐星 pop + sfx('pick')(星容器 #{p}Stars, 已切屏
   查不到即静默); armAuto/clear: 结算屏自动续程计时 — 时长经 autoMs
   注入保真两侧现状(focus 4000 / math 4500 — math 结算屏 TTS 更长是
   刻意), armAuto 可带 ms 覆盖(focus 里程碑串播复用同一轨道, 4500ms);
   到点是否续程的自检(继续按钮是否在场)是调用方政策, 留在回调里;
   clear 供换屏收口(家族 screen 函数)与模式 cleanup */
function mkSettleBits(cfg) {
  const o = cfg || {};
  const pfx = o.prefix || 'f';
  let timer = 0;
  function starSpans(stars) {
    return [1, 2, 3].map((n) =>
      '<span class="st ' + (n <= stars ? 'on' : '') + '" data-n="' + n + '">⭐</span>').join('');
  }
  function popStars(stars) {
    [1, 2, 3].forEach((n) => {
      if (n <= stars) {
        setTimeout(() => {
          const el = document.querySelector('#' + pfx + 'Stars .st[data-n="' + n + '"]');
          if (el) {
            el.classList.add('pop');
            sfx('pick');
          }
        }, 350 * n);
      }
    });
  }
  function armAuto(fn, ms) {
    clear();
    timer = setTimeout(fn, ms !== undefined ? ms : o.autoMs);
  }
  function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  }
  return {starSpans, popStars, armAuto, clear};
}

const CampKit = {mkCampTicker, mkLootHud, mkStampRites, mkParentGate, sparkSvg, downloadCsv, mkSettleBits};
if (typeof module !== 'undefined' && module.exports) module.exports = CampKit;
