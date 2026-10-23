'use strict';
/* ============================================================
   ModeKit — 应用层 shell 服务 (术语见 GLOSSARY.md)
   ------------------------------------------------------------
   mkMode(cfg) 把四个模式各自复制的样板收进一个深 interface:
     · chrome {score,hotbar}   进入模式时施加 DOM 显隐(cleanup 无需还原)
     · hotbar (mkHotbar 实例)  digit/wheel/点选 选块全自动
     · hud(hit) → string[]     每帧 HUD 文本(hit 由主循环注入, 模式不再自行 raycast)
     · touch [...]             setTouchActions 声明 (缺省=null 隐藏)
     · KeyB 默认暂停 · 无 hud 配置则清空并跳过 · onVoidFall 默认回最近出生点
   工具: spawn(对外经 ModeKit.spawn) / lookName / confirmBtn
   T10 扩展(设计稿 D8/D10):
     · mkHotbar 第三种槽型 {item:id} — 像素图标(iconOf)+右上数量(>1 才显)
       +底部耐久条(dur 访问器返 0..1 比, 模式层算 dur/toolOf(id).dur)
     · mkCraftPanel — 背包网格+配方书卡片+分类页签+任务卡占位容器;
       亮灰由 canCraft 驱动, 单击合成(onCraft)/长按 0.4s 连做 0.3s 一发
     · mkFurnacePanel — 三槽+进度条的纯显示面板,「自动放入」只算
       plan 回调 onAutoFill(矿石全放+FUEL 序最省凑料), 不动背包
     · sortInv — 整理按钮底座: 主格区同项合并(快捷栏不动)
     code-review 修复轮(S2): mkHpBar — 头顶血条深接口(canvas 贴图
       Sprite, 血量变化才重绘——逐帧纹理上传是移动端掉帧源):
       update(hp,maxHp,x,y,z)/dispose, 可选 opts.visible() 控显隐
       (下界: 只在下界显示); 探险/下界两模式共用, 原两份同形实现归一
   引擎层(world/input)对本文件零依赖; 本文件属应用层
   引导链 v2: mkChestPanel — 大宝箱面板(箱子格/扩容行/背包格, 点选搬运;
     政策与存档在模式层回调, 顶格档隐藏扩容行)
   interface: mkMode · mkHotbar · mkCraftPanel · mkFurnacePanel ·
              mkChestPanel · mkHpBar · sortInv · spawn · lookName · confirmBtn
   依赖(均经全局名, 调用期解析): items-core 的 ITEMS/toolOf/stackMax ·
     inventory-core 的 HOTBAR_SLOTS/costEntry · craft-core 的 RECIPES/
     canCraft/craft/FUEL/fuelUnits/smeltOf · icons 的 iconOf(icons 加载序
     在本文件之后, 但全部调用发生在用户交互期, 彼时已加载完毕)
   可测性: DOM 惰性创建(doc 可注入), Node 单测注入假 document
     (test/mode-kit.test.js); mkHpBar 的 THREE/DOM 惰性创建,
     Node 无渲染环境时 update/dispose 静默跳过(不参与行为断言)
============================================================ */

const MK = (typeof document !== 'undefined') ?
  {hotbar: document.getElementById('hotbar'),
    score: document.getElementById('score'),
    hud: document.getElementById('hud')} :
  {hotbar: null, score: null, hud: null}; // Node 测试环境

/* ---------- 出生点: 设置玩家状态并记住, 供默认 onVoidFall 兜底 ----------
   (内部名 kitSpawn: 不占用共享全局里最裸的 spawn 一词, 经 ModeKit.spawn 对外) */
let mkLastSpawn = null;
function kitSpawn(x, y, z, o) {
  o = o || {};
  pos.set(x, y, z);
  vel.set(0, 0, 0);
  yaw = o.yaw || 0;
  pitch = o.pitch || 0;
  onGround = false;
  mkLastSpawn = {x, y, z, yaw: o.yaw || 0, pitch: o.pitch || 0};
}

/* "注视"方块名 — arena/build 两处重复的查询 */
function lookName(hit) {
  if (!hit) return '无';
  const id = getBlock(hit.x, hit.y, hit.z);
  return BLOCKS[id] ? BLOCKS[id].name : '?';
}

/* ---------- hotbar: 三种槽型 {block:id} | {icon,lbl,cnt()} | {item:id}(T10) ----------
   cls:'build' 附加类名; cnt 为函数, refresh/show 时重读;
   item 型: 像素图标(iconOf 的 dataURL/emoji 二合一) + 右上数量(>1 才显) +
   底部耐久条(dur 访问器返 0..1 比, 模式层算 dur/toolOf(id).dur, 仅工具条目配) */
function mkHotbar(opts) {
  const o = opts || {};
  const doc = o.doc || document; // 可注入, 供 Node 单测
  const mount = o.mount || MK.hotbar;
  const items = o.items || [];
  let sel = 0;
  function render() {
    mount.innerHTML = '';
    mount.classList.toggle('build', o.cls === 'build');
    items.forEach((it, i)=>{
      const div = doc.createElement('div');
      div.className = 'slot';
      let html = '<span class="num">' + (i + 1 <= 9 ? i + 1 : '') + '</span>';
      if (it.block !== undefined) {
        const b = BLOCKS[it.block]; const col = (b.all || b.side);
        html += '<div class="cube" style="background:rgb(' + col.map((c)=>Math.round(c*255)).join(',') + ')"></div>' +
             '<span class="lbl">' + b.name + '</span>';
      } else if (it.item !== undefined) {
        /* 图标统一出口(iconOf): 'data:' 前缀喂 img.src · emoji 文本喂 icon · '' 跳过 */
        const ic = iconOf(it.item);
        html += (ic.startsWith('data:') ? '<img class="pic" alt="" src="' + ic + '">' :
              (ic ? '<span class="icon">' + ic + '</span>' : '')) +
             '<span class="cnt">' + ((it.cnt && it.cnt() > 1) ? it.cnt() : '') + '</span>' +
             (it.dur ? '<i class="dur"><i></i></i>' : '') + // 耐久条骨架, 宽/档位由 sync 填
             '<span class="lbl">' + (ITEMS[it.item] ? ITEMS[it.item].name : '') + '</span>';
      } else {
        html += '<span class="icon">' + it.icon + '</span>' +
             '<span class="cnt">' + (it.cnt ? it.cnt() : '') + '</span>' +
             '<span class="lbl">' + (it.lbl || '') + '</span>';
      }
      div.innerHTML = html;
      div.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault(); select(i);
      });
      mount.appendChild(div);
    });
    sync();
  }
  function sync() {
    [...mount.children].forEach((c, i)=>{
      c.classList.toggle('active', i === sel);
      if (items[i] && items[i].cnt) {
        const raw = items[i].cnt() || 0;
        c.classList.toggle('empty', raw <= 0);
        const cntEl = c.querySelector('.cnt');
        if (cntEl) {
          cntEl.textContent = items[i].item === undefined ? raw : // 旧 icon 型原样(存量口径)
            (raw > 1 ? String(raw) : ''); // item 型单件不显数
        }
      }
      if (items[i] && items[i].dur) { // 耐久条实时重读: 宽=比值, 档位 绿/黄/红(D9 <25% 红)
        const fill = c.querySelector('.dur i');
        if (fill) {
          const r = Math.max(0, Math.min(1, items[i].dur() || 0));
          fill.style.width = Math.round(r * 100) + '%';
          fill.classList.toggle('bar-hi', r >= 0.5);
          fill.classList.toggle('bar-mid', r >= 0.25 && r < 0.5);
          fill.classList.toggle('bar-lo', r < 0.25);
        }
      }
    });
  }
  function select(i) {
    if (i < 0 || i >= items.length) return;
    sel = i;
    sync();
    if (o.onPick) o.onPick(i);
  }
  return {
    get sel() {
      return sel;
    },
    items,
    select,
    refresh: sync,
    render,
    show() {
      render(); mount.style.display = 'flex';
    },
    hide() {
      mount.style.display = 'none';
    },
  };
}

/* ---------- sortInv: 一键整理(D10 🧹) — 只压实主格区(槽 9~26), 快捷栏
   (0~8, 孩子摆好的手上格)不动; 主格内同项合并到堆叠上限·首现序稳定·
   工具耐久随堆保留·空槽压到主格尾部。就地修改并返回 inv;
   堆叠上限经 stackMax(items-core)。---------- */
function sortInv(inv) {
  const s = inv.slots;
  const order = []; // 首现序(稳定: 不按字母重排, 孩子找得到东西)
  const piles = {}; // id → 待合并堆列表
  for (let i = HOTBAR_SLOTS; i < s.length; i++) {
    if (!s[i]) continue;
    if (!piles[s[i].id]) {
      piles[s[i].id] = [];
      order.push(s[i].id);
    }
    piles[s[i].id].push(s[i]);
  }
  for (let i = HOTBAR_SLOTS; i < s.length; i++) s[i] = null; // 清空主格区待回填
  let i = HOTBAR_SLOTS;
  for (const id of order) {
    let n = 0; let dur;
    for (const p of piles[id]) {
      n += p.n;
      if (p.dur != null) dur = p.dur; // 工具(上限1)不跨堆, 保住耐久
    }
    const max = stackMax(id) || 1;
    while (n > 0 && i < s.length) {
      const put = Math.min(n, max);
      s[i] = {id, n: put};
      if (dur != null) s[i].dur = dur;
      n -= put; i++;
    }
  }
  return inv;
}

/* 一期不点亮的配方 id(T6 备注: 原料/用途归二期, 模式层过滤口径收在面板) */
const KIT_HIDDEN_RECIPES = ['bread', 'bone_meal', 'bow_item'];

/* 站点徽标(D8): table=工作台 furnace=二期烧炼站点配方预留 hand=无
   (设计稿 D8 定稿: 一期熔炉是走近点击的开面板交互, 非 station 门槛配方——
   furnace 键位为二期烧炼站点配方占位, 出处可溯而非泛泛「备用」) */
const KIT_STATION_BADGE = {table: '🛠️', furnace: '♨️'};

/* 分类页签(D8): 图标式零文字; 分类判据=产物(工具 toolOf/食物 food/方块 block),
   其余(材料)不归类 — 只在「全部」页出现 */
const KIT_TABS = [
  {key: 'all', icon: '📦'},
  {key: 'tool', icon: '⛏️'},
  {key: 'food', icon: '🍎'},
  {key: 'block', icon: '🧱'},
];

/* ---------- 背包+配方书面板(D8/D10, T10): 自建遮罩挂 body 级, 不动 index.html ----------
   opts: inv(mkInventory 背包) · recipes(缺省 RECIPES 全表) · station()桌站点
   判定(缺省恒 true) · allow(放开默认过滤的配方 id 数组) · onCraft(out)/onSort
   挂载幂等: 同一遮罩节点反复 show 只挂一次, remove 可重复调 */
function mkCraftPanel(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const inv = o.inv;
  const station = o.station || (() => true); // 站点规则归模式层(T13 传 Mobs.near 判定)
  const root = doc.createElement('div');
  root.className = 'mkp-mask';
  const box = doc.createElement('div');
  box.className = 'mkp-box';
  const main = doc.createElement('div');
  main.className = 'mkp-main';
  const quest = doc.createElement('aside'); // 任务卡占位容器(T15 填内容)
  quest.className = 'mkp-quest';
  root.appendChild(box); box.appendChild(main); box.appendChild(quest);

  /* —— 头部: 标题 + 整理按钮 + 关闭 —— */
  const head = doc.createElement('div');
  head.className = 'mkp-head';
  head.innerHTML = '<span class="mkp-title">🎒 背包与配方书</span>';
  const sortBtn = doc.createElement('button');
  sortBtn.className = 'mkp-sort';
  sortBtn.textContent = '🧹 整理';
  sortBtn.onclick = ()=>{
    sortInv(inv);
    refresh();
    if (o.onSort) o.onSort();
  };
  const closeBtn = doc.createElement('button');
  closeBtn.className = 'mkp-x';
  closeBtn.textContent = '✕';
  closeBtn.onclick = ()=>close(); /* 统一出口: 隐藏+通知模式层(状态同步/回锁) */
  head.appendChild(sortBtn); head.appendChild(closeBtn);
  main.appendChild(head);

  /* —— 背包网格: 18 主格(槽 9~26, 6 列×3 行) + 9 快捷栏镜像(槽 0~8) —— */
  const grid = doc.createElement('div');
  grid.className = 'mkp-grid';
  const hotrow = doc.createElement('div');
  hotrow.className = 'mkp-hotrow';
  main.appendChild(grid); main.appendChild(hotrow);

  /* —— 配方书区: 页签 + 卡片列表(卡片渲染在下方 renderCards) —— */
  const tabs = doc.createElement('div');
  tabs.className = 'mkp-tabs';
  const cards = doc.createElement('div');
  cards.className = 'mkp-cards';
  main.appendChild(tabs); main.appendChild(cards);

  /* 槽堆 → 格子元素(像素图标/emoji 二合一 + 数量>1 才显) */
  function cellEl(stack) {
    const d = doc.createElement('div');
    d.className = 'mkp-cell';
    if (stack) {
      const ic = iconOf(stack.id);
      d.innerHTML = (ic.startsWith('data:') ? '<img class="pic" alt="" src="' + ic + '">' :
        (ic ? '<span class="icon">' + ic + '</span>' : '')) +
        (stack.n > 1 ? '<span class="cnt">' + stack.n + '</span>' : '');
    }
    return d;
  }

  function renderGrid() {
    grid.innerHTML = ''; hotrow.innerHTML = '';
    for (let i = HOTBAR_SLOTS; i < inv.slots.length; i++) grid.appendChild(cellEl(inv.slots[i]));
    for (let i = 0; i < HOTBAR_SLOTS; i++) hotrow.appendChild(cellEl(inv.slots[i]));
  }

  /* —— 配方可见集: 一期过滤(bread/bone_meal/bow_item 不点亮) + allow 放开 —— */
  const recipes = o.recipes || (typeof RECIPES !== 'undefined' ? RECIPES : []);
  const visible = recipes.filter((r) => !KIT_HIDDEN_RECIPES.includes(r.id) ||
    (o.allow && o.allow.includes(r.id)));
  let tab = 'all'; // 当前分类页签
  function cardTab(r) {
    if (toolOf(r.out.item)) return 'tool';
    const it = ITEMS[r.out.item];
    if (it && it.food) return 'food';
    if (it && it.block) return 'block';
    return 'all'; // 未归类(材料): 只在「全部」页出现
  }
  function renderCards() {
    cards.innerHTML = '';
    visible.filter((r) => tab === 'all' || cardTab(r) === tab) // 未归类只随「全部」
        .forEach((r) => cards.appendChild(cardEl(r)));
  }
  function renderTabs() {
    tabs.innerHTML = '';
    KIT_TABS.forEach((t)=>{
      const b = doc.createElement('button');
      b.className = 'mkp-tab' + (tab === t.key ? ' on' : '');
      b.innerHTML = t.icon;
      b.onclick = ()=>{
        tab = t.key;
        renderTabs();
        renderCards();
      };
      tabs.appendChild(b);
    });
  }
  function iconHtml(id, cls) {
    const ic = iconOf(id);
    return ic.startsWith('data:') ? '<img class="' + cls + '" alt="" src="' + ic + '">' :
      (ic ? '<span class="icon ' + cls + '">' + ic + '</span>' : '');
  }
  function chipHtml(id, n, lack, have) {
    /* 缺料单候选显示 have/need(如 0/1), 齐料显示 ×n */
    const b = (lack && have != null) ? '<b>' + have + '/' + n + '</b>' : '<b>×' + n + '</b>';
    return '<span class="mkp-chip' + (lack ? ' lack' : '') + '" data-id="' + id + '">' +
      iconHtml(id, 'mini') + b + '</span>';
  }
  function cardEl(r) {
    const d = doc.createElement('div');
    d.dataset.recipe = r.id;
    /* 亮灰判定: canCraft(inv, recipe, stationOk)(craft-core 三形状 missing 驱动灰显) */
    const check = canCraft(inv, r, station());
    const lackHave = {}; // id → have(单候选缺料)
    const lackAny = new Set(); // 任选组全缺的候选
    let stationLack = false;
    for (const m of check.missing) {
      if (m.station) stationLack = true; // 站点未解锁 → 徽标灰
      else if (m.id != null) lackHave[m.id] = m.have;
      else if (m.any) m.any.forEach((c) => lackAny.add(c));
    }
    d.className = 'mkp-card' + (check.ok ? '' : ' dim');
    let chips = '';
    for (const [key, val] of Object.entries(r.cost)) {
      const e = costEntry(key, val); // 候选数组+数量(inventory-core 统一形状)
      if (!e) continue;
      e.cands.forEach((c) => {
        chips += chipHtml(c, e.n, c in lackHave || lackAny.has(c), lackHave[c]);
      }); // 任选=逐候选一枚(需求量同一份)
    }
    const badge = KIT_STATION_BADGE[r.station] || '';
    d.innerHTML = (badge ? '<span class="mkp-badge' + (stationLack ? ' lack' : '') + '">' + badge + '</span>' : '') +
      '<div class="mkp-out">' + iconHtml(r.out.item, 'big') +
      (r.out.n > 1 ? '<b class="mkp-n">×' + r.out.n + '</b>' : '') + '</div>' +
      '<div class="mkp-chips">' + chips + '</div>';
    wireCard(d, r); // 单击合成 / 长按连做
    return d;
  }

  /* —— 合成执行: canCraft 预检过才 craft(不坏包), 成功 → onCraft + 刷新 —— */
  function craftOnce(r) {
    if (!canCraft(inv, r, station()).ok) return false;
    const res = craft(inv, r, station());
    if (!res.ok) return false;
    if (o.onCraft) o.onCraft({item: res.out.item, n: res.out.n, leftover: res.leftover});
    refresh(); // 数量/灰显实时重读
    return true;
  }
  /* —— 按压状态机(D8): 长按 0.4s 进入连做(立即一发+0.3s/发), 松开/离开/
     材料尽停; 面板同时至多一个活动按压(新按压让位, 多指互斥) —— */
  let active = null; // {el, repeating, stop}
  function stopPress() {
    if (active) active.stop();
  }
  function wireCard(d, r) {
    d.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      stopPress(); // 旧按压让位
      let holdT = 0; let repT = 0;
      const stop = ()=>{
        clearTimeout(holdT); clearInterval(repT);
        if (active && active.el === d) active = null;
      };
      active = {el: d, repeating: false, stop};
      holdT = setTimeout(()=>{ // 0.4s 判定线
        if (active && active.el === d) active.repeating = true;
        if (!craftOnce(r)) {
          stop(); // 材料尽 → 不进连做
          return;
        }
        repT = setInterval(()=>{ // 0.3s/发, 缺料自动停
          if (!craftOnce(r)) stop();
        }, 300);
      }, 400);
    });
    d.addEventListener('pointerup', ()=>{ // 松开: 未进连做→补单击; 连做中→只停
      const a = active;
      if (!a || a.el !== d) return;
      const rep = a.repeating;
      a.stop();
      if (!rep) craftOnce(r);
    });
    d.addEventListener('pointerleave', ()=>{
      if (active && active.el === d) active.stop();
    });
  }

  /* —— 生命周期: show 幂等挂载, remove 幂等卸载并停连做计时 —— */
  function show() {
    refresh();
    if (root.parentNode !== doc.body) doc.body.appendChild(root);
    if (doc.addEventListener) doc.addEventListener('keydown', onEsc, true); /* 面板开着: Esc=关面板, 不走菜单链 */
  }
  function hide() {
    root.style.display = 'none';
    if (doc.removeEventListener) doc.removeEventListener('keydown', onEsc, true);
  }
  function close() {/* ✕/Esc 统一出口: 隐藏 + onClose(模式层做状态同步与指针回锁) */
    hide();
    if (o.onClose) o.onClose();
  }
  function onEsc(e) {
    if (e.code !== 'Escape') return;
    e.preventDefault();
    close();
  }
  function remove() {
    stopPress(); // 停掉在飞的连做计时
    if (doc.removeEventListener) doc.removeEventListener('keydown', onEsc, true);
    if (root.parentNode === doc.body) doc.body.removeChild(root);
  }
  function refresh() {
    root.style.display = 'flex';
    renderTabs();
    renderGrid();
    renderCards();
  }
  return {root, questEl: quest, show, hide, close, remove, refresh};
}


function confirmBtn(btn, o) {
  let armed = false; let t = 0;
  btn.textContent = o.label;
  btn.onclick = ()=>{
    if (armed) {
      armed = false; clearTimeout(t);
      btn.textContent = o.label;
      o.onConfirm();
    } else {
      armed = true;
      btn.textContent = o.confirm;
      t = setTimeout(()=>{
        armed = false; btn.textContent = o.label;
      }, o.hold || 3000);
    }
  };
}

/* ---------- 熔炉面板(D8, T10): 三槽(料/燃料/产物)+进度条+自动放料意图 ----------
   面板是纯显示+意图出口: 烧炼状态(槽内容/进度)由模式层经 setSlots/
   setProgress 喂入(烧炼计时与扣加归 T13 模式层, 经 inventory-core);
   「自动放入」只算 plan(矿石全放 + FUEL 序最省凑料)回调 onAutoFill,
   不动背包 — 实际扣加由模式层执行 */
function mkFurnacePanel(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const inv = o.inv;
  const root = doc.createElement('div');
  root.className = 'mkp-mask';
  const box = doc.createElement('div');
  box.className = 'mkp-box mkp-furnace';
  root.appendChild(box);

  const head = doc.createElement('div');
  head.className = 'mkp-head';
  head.innerHTML = '<span class="mkp-title">♨️ 熔炉</span>';
  const closeBtn = doc.createElement('button');
  closeBtn.className = 'mkp-x';
  closeBtn.textContent = '✕';
  closeBtn.onclick = ()=>close(); /* 统一出口: 隐藏+通知模式层(状态同步/回锁) */
  head.appendChild(closeBtn);
  box.appendChild(head);

  const row = doc.createElement('div');
  row.className = 'mkp-frow';
  function fslot(label) {
    const wrap = doc.createElement('div');
    wrap.className = 'mkp-fslot';
    const cell = doc.createElement('div');
    cell.className = 'mkp-cell';
    const lbl = doc.createElement('span');
    lbl.className = 'mkp-flbl';
    lbl.textContent = label;
    wrap.appendChild(cell);
    wrap.appendChild(lbl);
    row.appendChild(wrap);
    return cell;
  }
  const cellIn = fslot('要烧的');
  const cellFuel = fslot('燃料');
  const prog = doc.createElement('div');
  prog.className = 'mkp-pbar';
  const fire = doc.createElement('span');
  fire.className = 'mkp-fire';
  fire.textContent = '🔥';
  const fill = doc.createElement('i');
  fill.className = 'mkp-pfill';
  prog.appendChild(fill);
  const mid = doc.createElement('div');
  mid.className = 'mkp-fmid';
  mid.appendChild(fire);
  mid.appendChild(prog);
  row.appendChild(mid);
  const cellOut = fslot('产物');
  box.appendChild(row);

  const autoBtn = doc.createElement('button');
  autoBtn.className = 'mkp-autofill';
  autoBtn.textContent = '📥 自动放入';
  autoBtn.onclick = ()=>{
    if (o.onAutoFill) o.onAutoFill(autoPlan());
  };
  box.appendChild(autoBtn);

  function paint(cell, stack) {
    cell.innerHTML = '';
    if (stack) {
      const ic = iconOf(stack.id);
      cell.innerHTML = (ic.startsWith('data:') ? '<img class="pic" alt="" src="' + ic + '">' :
        (ic ? '<span class="icon">' + ic + '</span>' : '')) +
        (stack.n > 1 ? '<span class="cnt">' + stack.n + '</span>' : '');
    }
  }
  function setSlots(s) { // 烧炼三槽现状(模式层每态变化时喂)
    paint(cellIn, s && s.input);
    paint(cellFuel, s && s.fuel);
    paint(cellOut, s && s.output);
  }
  function setProgress(r) { // 0..1 进度条(越界钳制)
    fill.style.width = Math.round(Math.max(0, Math.min(1, r || 0)) * 100) + '%';
  }
  function autoPlan() { // 意图计算: 矿石全放(首现序聚合) + FUEL 序最省凑料
    const load = [];
    const seen = {};
    let need = 0;
    for (const s of inv.slots) {
      if (!s || seen[s.id] || !smeltOf(s.id)) continue;
      seen[s.id] = true;
      let n = 0;
      for (const t of inv.slots) if (t && t.id === s.id) n += t.n;
      load.push({id: s.id, n, out: smeltOf(s.id)});
      need += n;
    }
    const fuel = [];
    let units = 0;
    for (const id of FUEL) { // FUEL 序即最省排序(craft-core 派生)
      if (units >= need) break;
      const per = fuelUnits(id);
      if (!per) continue;
      let have = 0;
      for (const t of inv.slots) if (t && t.id === id) have += t.n;
      if (!have) continue;
      const take = Math.min(have, Math.ceil((need - units) / per));
      fuel.push({id, n: take});
      units += take * per;
    }
    return {load, fuel, units}; // 执行权在模式层(T13): take/add 经 inventory-core
  }
  function show() {
    root.style.display = 'flex'; /* hide 后重开要复明(mkCraftPanel.refresh 同口径) */
    if (root.parentNode !== doc.body) doc.body.appendChild(root);
    if (doc.addEventListener) doc.addEventListener('keydown', onEsc, true); /* 面板开着: Esc=关面板 */
  }
  function hide() {
    root.style.display = 'none';
    if (doc.removeEventListener) doc.removeEventListener('keydown', onEsc, true);
  }
  function close() {/* ✕/Esc 统一出口: 隐藏 + onClose(模式层做状态同步与指针回锁) */
    hide();
    if (o.onClose) o.onClose();
  }
  function onEsc(e) {
    if (e.code !== 'Escape') return;
    e.preventDefault();
    close();
  }
  function remove() {
    if (doc.removeEventListener) doc.removeEventListener('keydown', onEsc, true);
    if (root.parentNode === doc.body) doc.body.removeChild(root);
  }
  return {root, show, hide, close, remove, setSlots, setProgress, autoPlan};
}

/* ---------- 大宝箱面板(mkChestPanel, 引导链 v2): 点选搬运的纯格子面板 ----------
    全局共享账户的观感层: 箱子格(前 size 格, 点击=取回背包) + 扩容行(下一档
    材料 chip + 按钮, 顶格隐藏) + 背包格(18 主格+9 快捷镜像, 点击=存入箱子)。
    存取/扩容的政策与存档全在模式层(onPut/onTake/onExpand 回调), 面板只管
    格子与点击, 每次动作后自 chest()/inv 重画; 触屏桌面同一套点选(无拖拽, 拍板②)。
    opts: inv(mkInventory 背包) · chest()→{size, slots} 账户现状 · next()→
    {size, cost}|null 下一扩容档 · have(id)→背包持有数(缺料角标 have/need) ·
    onPut(invSlotIdx) · onTake(chestSlotIdx) · onExpand() · onClose */
function mkChestPanel(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const inv = o.inv;
  const root = doc.createElement('div');
  root.className = 'mkp-mask';
  const box = doc.createElement('div');
  box.className = 'mkp-box mkp-chest';
  root.appendChild(box);

  const head = doc.createElement('div');
  head.className = 'mkp-head';
  head.innerHTML = '<span class="mkp-title">📦 我的宝箱</span>';
  const closeBtn = doc.createElement('button');
  closeBtn.className = 'mkp-x';
  closeBtn.textContent = '✕';
  closeBtn.onclick = ()=>close(); /* 统一出口: 隐藏+通知模式层(状态同步/回锁) */
  head.appendChild(closeBtn);
  box.appendChild(head);

  const chestGrid = doc.createElement('div');
  chestGrid.className = 'mkp-grid mkp-chestgrid';
  box.appendChild(chestGrid);

  const expandRow = doc.createElement('div');
  expandRow.className = 'mkp-chestrow';
  box.appendChild(expandRow);

  const bpLabel = doc.createElement('div');
  bpLabel.className = 'mkp-chestlbl';
  bpLabel.textContent = '🎒 背包（点一下放进箱子）';
  box.appendChild(bpLabel);
  const grid = doc.createElement('div');
  grid.className = 'mkp-grid';
  const hotrow = doc.createElement('div');
  hotrow.className = 'mkp-hotrow';
  box.appendChild(grid); box.appendChild(hotrow);

  function cellEl(stack) {/* 槽堆→格子(与 mkCraftPanel 同观感: 像素图标+数量) */
    const d = doc.createElement('div');
    d.className = 'mkp-cell';
    if (stack) {
      const ic = iconOf(stack.id);
      d.innerHTML = (ic.startsWith('data:') ? '<img class="pic" alt="" src="' + ic + '">' :
        (ic ? '<span class="icon">' + ic + '</span>' : '')) +
        (stack.n > 1 ? '<span class="cnt">' + stack.n + '</span>' : '');
    }
    return d;
  }
  function chipHtml(id, need, have) {/* 扩容材料 chip: 缺料显 have/need(配方卡同口径) */
    const ic = iconOf(id);
    const img = ic.startsWith('data:') ? '<img class="mini" alt="" src="' + ic + '">' :
      '<span class="icon mini">' + ic + '</span>';
    return '<span class="mkp-chip' + (have < need ? ' lack' : '') + '">' + img +
        '<b>' + have + '/' + need + '</b></span>';
  }

  function refresh() {/* 每次动作后整幅重画(格子数 ≤27+27, 无性能顾虑) */
    const ch = o.chest();
    chestGrid.innerHTML = '';
    for (let i = 0; i < ch.size; i++) {
      const d = cellEl(ch.slots[i]);
      const idx = i;
      d.onclick = ()=>{
        o.onTake(idx);
        refresh();
      };
      chestGrid.appendChild(d);
    }
    expandRow.innerHTML = '';
    const nx = o.next();
    if (nx) {
      for (const key of Object.keys(nx.cost)) {
        const chip = doc.createElement('span'); /* 材料账单 chip(配方卡同观感) */
        chip.innerHTML = chipHtml(key, nx.cost[key], o.have(key));
        expandRow.appendChild(chip);
      }
      const btn = doc.createElement('button');
      btn.className = 'mkp-autofill';
      btn.textContent = '＋ 扩到 ' + nx.size + ' 格';
      btn.onclick = ()=>{
        o.onExpand();
        refresh();
      };
      expandRow.appendChild(btn);
    }
    grid.innerHTML = ''; hotrow.innerHTML = '';
    for (let i = HOTBAR_SLOTS; i < inv.slots.length; i++) {
      const d = cellEl(inv.slots[i]);
      const idx = i;
      d.onclick = ()=>{
        o.onPut(idx);
        refresh();
      };
      grid.appendChild(d);
    }
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const d = cellEl(inv.slots[i]);
      const idx = i;
      d.onclick = ()=>{
        o.onPut(idx);
        refresh();
      };
      hotrow.appendChild(d);
    }
  }

  function show() {
    root.style.display = 'flex'; /* hide 后重开要复明(mkCraftPanel 同口径) */
    if (root.parentNode !== doc.body) doc.body.appendChild(root);
    if (doc.addEventListener) doc.addEventListener('keydown', onEsc, true); /* 面板开着: Esc=关面板 */
  }
  function hide() {
    root.style.display = 'none';
    if (doc.removeEventListener) doc.removeEventListener('keydown', onEsc, true);
  }
  function close() {/* ✕/Esc 统一出口: 隐藏 + onClose(模式层做状态同步与指针回锁) */
    hide();
    if (o.onClose) o.onClose();
  }
  function onEsc(e) {
    if (e.code !== 'Escape') return;
    e.preventDefault();
    close();
  }
  function remove() {
    if (doc.removeEventListener) doc.removeEventListener('keydown', onEsc, true);
    if (root.parentNode === doc.body) doc.body.removeChild(root);
  }
  return {root, show, hide, close, remove, refresh};
}

/* ---------- 头顶血条(mkHpBar, S2): canvas 贴图 Sprite 的深接口 ----------
    探险/下界两模式的同形实现归一: 血量变化才重绘(逐帧纹理上传是移动端
    掉帧源); update 惰性建条(THREE/DOM/scene 缺任一即静默待命——Node 单测
    无渲染环境不参与行为断言), opts.visible() 可选回调控制显隐(下界:
    只在下界显示; 缺省恒显)。Sprite 挂 scene/位置随玩家都收在 update 里,
    调用方每帧只喂 {hp, maxHp, x, y, z}。128×16 贴图 → 世界尺寸 1.5×0.19,
    头顶 y+2.2 的口径由调用方给坐标。 */
function mkHpBar(opts) {
  const o = opts || {};
  let bar = null; let ctx = null; let tex = null; let last = -1;
  function ensure() {
    if (bar || typeof THREE === 'undefined' || typeof document === 'undefined' ||
        typeof scene === 'undefined') return;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 16;
    ctx = cv.getContext('2d');
    tex = new THREE.CanvasTexture(cv);
    bar = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true}));
    bar.scale.set(1.5, 0.19, 1); /* 128×16 的等比世界尺寸 */
    scene.add(bar);
  }
  function update(hp, maxHp, x, y, z) {
    ensure();
    if (!bar) return;
    bar.visible = o.visible ? o.visible() : true;
    if (!bar.visible) return;
    const h = Math.max(0, Math.ceil(hp));
    if (h !== last) {/* 血量变化才重绘 */
      last = h;
      const c = ctx; const W = 128;
      c.clearRect(0, 0, W, 16);
      c.fillStyle = 'rgba(16,16,20,0.82)'; c.fillRect(14, 3, W - 16, 10); /* 底槽 */
      c.fillStyle = '#e83a3a'; c.fillRect(16, 5, Math.max(0, (W - 20) * h / maxHp), 6); /* 血量 */
      c.strokeStyle = '#f0f0f0'; c.lineWidth = 1; c.strokeRect(14.5, 3.5, W - 17, 9);
      c.fillStyle = '#ff5a5a'; c.font = '13px sans-serif'; c.textBaseline = 'top'; c.fillText('❤', 1, 1);
      tex.needsUpdate = true;
    }
    bar.position.set(x, y, z); /* 头顶(身高 1.8 + 余量; billboard 正面视角也常读) */
  }
  function dispose() {
    if (!bar) return;
    if (typeof scene !== 'undefined') scene.remove(bar);
    bar.material.dispose(); tex.dispose();
    bar = null; ctx = null; tex = null; last = -1;
  }
  return {update, dispose};
}

/* ---------- 模式工厂: 模式只声明差异, 样板在此吸收 ---------- */
function mkMode(cfg) {
  const hb = cfg.hotbar || null;
  function applyChrome() {
    if (MK.score) MK.score.style.display = (cfg.chrome && cfg.chrome.score) || 'none';
    /* hotbar: 'flex' 立即显示; 'deferred' 现在隐藏、由模式在合适时机自行 show();
       缺省/none 恒隐藏 */
    if (hb && cfg.chrome && cfg.chrome.hotbar === 'flex') hb.show();
    else if (MK.hotbar) MK.hotbar.style.display = 'none';
    if (!cfg.hud && MK.hud) MK.hud.innerHTML = '';
  }
  const mode = {
    id: cfg.id,
    hotbar: hb,
    init() {
      applyChrome();
      setTouchActions(cfg.touch || null);
      if (cfg.init) cfg.init();
    },
    cleanup() {
      if (cfg.cleanup) cfg.cleanup();
    },
    update(dt) {
      if (cfg.update) cfg.update(dt);
    },
    onKey(code) {
      if (code === 'KeyB') {
        uiPause(); return;
      } // 三模式共用的默认暂停键
      if (cfg.onKey) cfg.onKey(code);
    },
    onDigit(n) {
      if (hb) hb.select(n - 1); if (cfg.onDigit) cfg.onDigit(n);
    },
    onWheel(d) {
      if (hb) hb.select((hb.sel + d + hb.items.length) % hb.items.length); if (cfg.onWheel) cfg.onWheel(d);
    },
    onMouse(b, hit) {
      if (cfg.onMouse) cfg.onMouse(b, hit);
    },
    onVoidFall() {
      if (cfg.onVoidFall) cfg.onVoidFall();
      else if (mkLastSpawn) kitSpawn(mkLastSpawn.x, mkLastSpawn.y, mkLastSpawn.z, mkLastSpawn);
    },
  };
  if (cfg.onHighlight) mode.onHighlight = cfg.onHighlight;
  if (cfg.onMenu) mode.onMenu = cfg.onMenu;
  if (cfg.buildMenu) mode.buildMenu = cfg.buildMenu;
  if (cfg.hud && MK.hud) {
    /* HUD 节流: 主循环每帧调用, 但文本至多 10Hz 变化 — 先限频再比对,
       内容相同直接跳过 innerHTML 写入(省去每帧 DOM 重建/布局/重绘,
       也省掉 hud() 内的全量重算, 如竞技场记分板遍历全部怪物) */
    let hudLastT = -1e9; let hudLastHtml = null;
    mode.updateHud = (hit)=>{
      const now = performance.now();
      if (now - hudLastT < 100) return;
      hudLastT = now;
      const html = cfg.hud(hit).join('<br>');
      if (html === hudLastHtml) return;
      hudLastHtml = html;
      MK.hud.innerHTML = html;
    };
  }
  return mode;
}

const ModeKit = {mkMode, mkHotbar, mkCraftPanel, mkFurnacePanel, mkChestPanel, mkHpBar, sortInv,
  spawn: kitSpawn, lookName, confirmBtn};
if (typeof module !== 'undefined' && module.exports) module.exports = ModeKit;
