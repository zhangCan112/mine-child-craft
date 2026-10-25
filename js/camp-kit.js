'use strict';
/* ============================================================
   CampKit(训练营壳 kit, 术语见 GLOSSARY.md「训练营壳 kit」)
   — 应用层·装配(CombatKit 同款: THREE/DOM 惰性, 观感件调用期才碰)
   一句话职责: focus/math 两训练营模式壳机器的收编地 — 本票(C1-T1)先收
   战利品回路五件套(时长 ticker/授予入包/战利品飞行/落袋槽/结算回顾),
   矿袋会话状态(入包明细/满包节流旗/最近点击坐标)自持实例; 家族差异
   (预算访问器 · f-/m- DOM 前缀 · 缺省飞行起点 · 满包回调)全部经工厂
   入参注入, 掷骰政策(段位变率/族池)留在各自 levels, 不进本 kit。
   interface: mkCampTicker({budget})→{start(),stop()} ·
     mkLootHud({prefix, bag, hud, defaultOrigin, onFull})→{begin() ·
     grantIntoBag(ids) · noteTap(x,y) · fly(id,from?) · addSlot(id) ·
     recapHtml(ids?) · runRecap(ids?,box?) · clear()}
   依赖(均经全局名, 调用期解析): CampCore(js/camp-core.js — grantLoot
     授予基座) · sfx(js/audio.js)与 ITEMS(js/items-core.js)/iconOf
     (js/icons.js)(落袋音与像素图标, icons 在模式文件之后加载, 调用期
     才解析) · Backpack 实例与满包 toast 回调经入参注入(ADR 0002:
     背包只经壳, 入包即 save); DOM 全惰性(方法调用时才取), Node 测试
     可安全加载; 加载序: camp-core 之后 · 两训练营模式文件之前
   可测性: THREE/DOM 惰性创建, Node 测试可安全加载; ticker 钳制与
     授予/节流账目有单测(test/camp-kit.test.js vm 桩直测), DOM 观感件
     不直测(仓库惯例), 行为面由 boot 冒烟 + math-paradigms 流程断言兜底
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

const CampKit = {mkCampTicker, mkLootHud};
if (typeof module !== 'undefined' && module.exports) module.exports = CampKit;
