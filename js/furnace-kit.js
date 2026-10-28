'use strict';
/* ============================================================
   熔炉装配 kit (FurnaceKit) — 应用层装配
   ------------------------------------------------------------
   探险(js/modes/adventure.js)与体验馆(js/modes/showroom.js)熔炉装配段
   的共享 kit(票据 T4, showroom-tickets): 状态机/退炉政策不在此——烧炼
   单步/退炉是合成核心(craft-core.js)的纯函数(2026-10 自 adventure-core
   迁入, 政策与烧炼表同居), 本 kit 只收编两模式
   镜像的模式层装配(面板开合/取产物/自动+手动放料/炉槽取回/逐炉推进喂
   显/挖炉退料/燃料余量比/槽形桥接), 两消费者经注入的消费方政策相区分(记账/TTS/
   掉落物/观感/快捷栏刷新全部走 opts 回调缝)。
   产物槽桥接(out→output): 核心炉态产物字段是 out, mode-kit 面板 setSlots
   读 output(其单测锁的契约) — 喂显前在本 kit 桥接(探险侧历史错位
   「产物槽有锭不显示」随 T4 抽取修复, 回归锁在 test/furnace-kit.test.js)。
   interface: FurnaceKit.mkFurnaceStation(opts) → station
     opts.inv: 背包对象(引用稳定, 探险形态) 或 () => 背包(进场换新实例,
       体验馆形态) — 内部一律经取数器读当前包
     opts 回调缝(全部可选, 消费方政策, 4 个语义事件; 同一动作/同一
       reason 至多发一次——缝按语义分事件, 不随内部调用点重复发):
       onPanel(open) 面板开合后(open=true 开·false 收; 指针配套等开合
         政策收口在此——开态唯一真值是 station.isOpen(), 消费方勿自抄
         镜像旗标) ·
       onInvTouched(reason, posKey?) kit 动过背包后, 逐 reason 语义
         (触发点→reason 全集由契约测试锁死, 改前先改测试):
         'collect' 东西成功入包(开/收面板顺带收产物·产物槽点击即收·
           料/燃料整摞取回——快捷栏刷新+拾取音类)
         'collect-full' 满包拒收(产物整撮/料燃料整摞留在炉里——儿童
           提示类)
         'autofill' 自动放料动了包
         'manual-put' 手动放料动了包(含异种对调回写源槽; 不可入炉
           原样放回不动包, 不发)
         'drop' 挖炉退料三笔已入包+炉已删(唯一附带 posKey 的 reason
           ——炉位收尾观感〔火焰即时清〕+快捷栏刷新归消费方) ·
       onRefundLeft(posKey, leftover) 挖炉满包余量(掉落物政策, 与背包
         政策分缝独立; 退出收场 refundAll 静默——不走此缝也不发
         onInvTouched=dev 口径) ·
       onDrop(槽号) 面板「丢弃」头钮透传(可选; 未提供=无钮, 体验馆同此) ·
       onMade(posKey, 新炉态, 件数增量) 烧成记账(任务计数/TTS/观感
         归消费方)
     station: map(炉态 Map<posKey,{input,fuel,out,heat,prog}>, 裸形状
       直写=持久化(消费方 encode/decode)+测线既定口径; 运行时读炉态
       唯一推荐读法是 state() 只读视图) · panel(mkFurnacePanel 实例,
       ✕/Esc 统一出口回 station.close) · open(posKey) · close() ·
       isOpen() · at() 绑定炉 · state(posKey) 只读查询(返回炉态活引用,
       运行时改炉态请走 ensure/autoFill 等意图入口——经引用直写属测线
       口径) · ensure(posKey) 取/建 · autoFill(plan?, posKey?)
       面板「自动放入」意图的执行权(plan 缺省自算; posKey 缺省=绑定炉,
       单炉固定 key 形态〔体验馆〕可无面板直调) · manualPut(idx, posKey?)
       面板背包格「手动放入」意图的执行权(槽整摞路由: 可烧物入料槽·燃料
       入燃料槽·两性物如原木优先当料烧; 空槽整摞入炉·同种并堆·异种整摞
       对调(炉内那摞回源槽, 无损不走 add)·不可入炉原样放回) · slotClick
       (name, posKey?) 炉槽点击意图的执行权(料/燃料整摞取回包, 满包整摞
       留炉发 'collect-full'; 'out'=立即收取产物) · tick(dt) 逐炉推进+
       面板开着喂显(三槽签名节流+✕ 对账) · drop(posKey) 挖炉退料三笔入包
       · refundAll() 退出收场(尽力入包·余量静默丢弃·炉态清空) · reset()
       重进场复位 · dispose() 卸面板复位
   依赖(均经全局名, 调用期解析): mkFurnacePanel/ModeKit(js/mode-kit.js,
     构造期即用——加载序在本文件之前) · add/take/count/remove(js/inventory-core.js)
     · fuelUnits/FUEL/smeltOf/smeltStep/furnaceRefund/SMELT_T(js/craft-core.js
     纯函数, 探险的炉与体验馆的炉是同一缝上的两个 adapter — 不造第二份烧炼实现)
   可测性: THREE/DOM 全经 mode-kit 惰性路径, 假 doc 可注入; 行为由
     test/furnace-kit.test.js 契约测试守门(只测接口外显行为, 纯函数
     单测在 craft-core.test 不重测)
   ============================================================ */

/* 炉态 → 面板槽形状: 核心炉态(craft-core smeltStep 的状态形状)产物字段是
   out, 面板 setSlots 读 output(mode-kit 契约) — 喂显前桥接一个字段名,
   其余槽位同形直传 */
function furnaceSlots(f) {
  return f ? {input: f.input, fuel: f.fuel, output: f.out} :
    {input: null, fuel: null, output: null};
}

/* 燃料余量比(探险 F2 口径上收, 原 advFurnaceFuelR/showroomFuelR 两份镜像归一):
   r = heat/fuelUnits(炉内燃料单件热值), 燃料槽空(末件已折算)按最高热值锚估
   ——条随热值衰减(MC 口径); 没在烧(与世界火焰同判定)一律 0 */
function furnaceFuelR(f) {
  if (!f || !(f.heat > 0) || !f.input) return 0;
  if (!f.fuel) return Math.min(1, f.heat / fuelUnits(FUEL[0]));
  const per = fuelUnits(f.fuel.id);
  return per ? Math.min(1, f.heat / per) : 1;
}

function mkFurnaceStation(opts) {
  const o = opts || {};
  const invOf = (typeof o.inv === 'function') ? o.inv : () => o.inv; /* 两种供给形态归一 */
  const invView = {get slots() {
    return invOf().slots;
  }}; /* 面板 autoPlan 只读 slots, 经视图跟到当前包 */
  let st; /* 面板回调经闭包引用 station(构造完成即就绪) */
  const panel = ModeKit.mkFurnacePanel({inv: invView,
    onAutoFill: (plan) => st.autoFill(plan),
    onPut: (i) => st.manualPut(i), /* 手动放入(背包格点击): 路由/扣加归本 kit */
    onSlot: (name) => st.slotClick(name), /* 炉槽点击: 取回(料/燃料)/收取(产物) */
    onDrop: o.onDrop, /* 丢弃头钮透传(2026-10; 未提供=无钮, 体验馆同此) */
    onClose: () => st.close()});
  const furnaces = new Map(); /* posKey → 炉态 {input,fuel,out,heat,prog}; 引用跨 init 稳定, reset() 复位不换 Map */
  let at = null; /* 面板绑定的炉 posKey(面板开着时非 null) */
  let open = false; /* 面板开态 */
  let sig = ''; /* 绑定炉三槽签名(变化才喂 setSlots, 省 DOM) */

  function state(posKey) {/* 炉状态只读查询(未建返回 null——单测触达面) */
    return furnaces.get(posKey) || null;
  }
  function ensure(posKey) {/* 取/建炉状态(首次交互才建) */
    let s = furnaces.get(posKey);
    if (!s) {
      s = {input: null, fuel: null, out: null, heat: 0, prog: 0};
      furnaces.set(posKey, s);
    }
    return s;
  }
  function slotSig(f) {/* 三槽签名(与 tick 喂显节流同一口径, 手动动作后 paint 同步) */
    return f ? [f.input, f.fuel, f.out].map((x) => (x ? x.id + '×' + x.n : '-')).join('|') : '';
  }
  function paint() {/* 面板回显: 绑定炉三槽现状(桥接槽形) + 当前进度(0..1) + 燃料余量;
    顺带同步三槽签名(手动放料/取回即时喂显后, tick 不再重复喂同一内容) */
    const f = at ? furnaces.get(at) : null;
    panel.setSlots(furnaceSlots(f));
    panel.setProgress((f ? f.prog : 0) / SMELT_T);
    panel.setFuel(furnaceFuelR(f));
    sig = slotSig(f);
  }
  /* 取产物入包(绑定炉): 满包一件都放不下则整撮留炉(拒收口径), 部分放不下留余量在炉 */
  function collectOut() {
    const f = at ? furnaces.get(at) : null;
    if (!f || !f.out) return;
    const left = add(invOf(), f.out.id, f.out.n);
    if (left >= f.out.n) {
      if (o.onInvTouched) o.onInvTouched('collect-full');
      return;
    }
    f.out = left > 0 ? {id: f.out.id, n: left} : null;
    if (o.onInvTouched) o.onInvTouched('collect');
  }
  function openPanel(posKey) {/* 走近熔炉点击打开: 绑定这台炉, 先取走产物(即时回报)再回显 */
    at = posKey;
    open = true;
    collectOut();
    panel.show();
    paint();
    if (o.onPanel) o.onPanel(true);
  }
  function closePanel() {/* 收面板(✕/Esc 面板钩与消费方直调共用): 顺带取走产物, 烧炼照跑(进度保留) */
    if (!open) return;
    open = false;
    panel.hide();
    collectOut();
    at = null; /* 解绑(多炉口径: 下次点击重新绑定) */
    if (o.onPanel) o.onPanel(false);
  }
  /* 自动放料(面板 📥 意图出口): 先取产物腾槽 → 入料(单槽单矿种, 只收首现
     矿种全量) → 热值不足以覆盖剩余件数时补最省燃料(炉内已有则同种加码)。
     plan 缺省自算(面板回调会喂, 直调/测试可省); posKey 缺省=面板绑定炉,
     体验馆单炉固定 key 形态可无面板直调; 扣加全经背包核心 */
  function autoFill(plan, posKey) {
    const key = (posKey != null) ? posKey : at;
    if (key == null) return;
    const f = ensure(key);
    collectOut();
    plan = plan || panel.autoPlan();
    const inv = invOf();
    if (!f.input && plan.load.length) {
      const ld = plan.load[0];
      if (take(inv, {[ld.id]: ld.n})) f.input = {id: ld.id, n: ld.n};
    }
    const deficit = Math.max(0, (f.input ? f.input.n : 0) - f.heat);
    if (deficit > 0) {
      const fid = f.fuel ? f.fuel.id : (plan.fuel.length ? plan.fuel[0].id : null);
      const per = fid ? fuelUnits(fid) : 0;
      const have = fid ? count(inv, fid) : 0;
      const want = per ? Math.min(have, Math.ceil(deficit / per)) : 0;
      if (want > 0 && take(inv, {[fid]: want})) {
        f.fuel = (f.fuel && f.fuel.id === fid) ? {id: fid, n: f.fuel.n + want} : {id: fid, n: want};
      }
    }
    paint();
    if (o.onInvTouched) o.onInvTouched('autofill');
  }
  /* 手动放料(面板背包格意图出口, 2026-10-25 交互优化): 点击背包槽整摞路由
     ——可烧物入料槽(两性物如原木优先当料烧, 与 autoPlan「矿石全放」同判据
     smeltOf), 燃料入燃料槽(fuelUnits>0); 目标槽空=整摞入炉, 同种并堆(不设
     堆叠上限——autoFill 全量同口径), 异种=整摞对调(炉内那摞回源槽——源槽刚
     腾出必容得下, 无损不走 add、满包零风险); 不可入炉(不可烧也非燃料)整摞
     原样放回(面板侧该格 dim 灰显)。posKey 缺省=面板绑定炉(autoFill 同口径) */
  function manualPut(idx, posKey) {
    const key = (posKey != null) ? posKey : at;
    if (key == null || idx == null || idx < 0) return;
    const inv = invOf();
    const raw = remove(inv, idx); /* 槽级整摞移除(背包核心, 返回拷贝) */
    if (!raw) return;
    const pile = (raw.dur != null) ? {id: raw.id, n: raw.n, dur: raw.dur} :
      {id: raw.id, n: raw.n}; /* 归一为本域纯栈形状(炉态/回写槽统一) */
    const slot = smeltOf(pile.id) ? 'input' : (fuelUnits(pile.id) > 0 ? 'fuel' : null);
    if (!slot) {
      inv.slots[idx] = pile; /* 不可入炉: 原样放回 */
      return;
    }
    const f = ensure(key);
    const cur = f[slot];
    if (!cur) f[slot] = pile; /* 空槽: 整摞入炉 */
    else if (cur.id === pile.id) f[slot] = {id: cur.id, n: cur.n + pile.n}; /* 同种并堆 */
    else {
      inv.slots[idx] = cur; /* 异种对调: 炉内整摞回源槽(腾出的槽必容得下) */
      f[slot] = pile;
    }
    paint();
    if (o.onInvTouched) o.onInvTouched('manual-put');
  }
  /* 炉槽点击意图(面板三槽): 料/燃料=整摞取回背包(满包整摞留炉发
     'collect-full' 儿童提示——与取产物同 reason 同政策); 'out'=立即收取
     产物(开/关面板自动收的手动补发, 烧炼中面板开着也能即点即得) */
  function slotClick(name, posKey) {
    if (name === 'out') {
      collectOut();
      paint();
      return;
    }
    if (name !== 'input' && name !== 'fuel') return;
    const key = (posKey != null) ? posKey : at;
    if (key == null) return;
    const f = furnaces.get(key);
    if (!f || !f[name]) return;
    const st0 = f[name];
    const left = add(invOf(), st0.id, st0.n);
    if (left >= st0.n) {
      if (o.onInvTouched) o.onInvTouched('collect-full'); /* 满包拒收: 整摞留炉 */
      return;
    }
    f[name] = left > 0 ? {id: st0.id, n: left} : null;
    if (o.onInvTouched) o.onInvTouched('collect'); /* 取回成功: 恰一次(旧缝 onCollect+onInvChange 双发已收口) */
    paint();
  }
  /* 挖炉/TNT 掀炉退料: 炉内三笔全额入包, 满包余量经 onRefundLeft(消费方决定
     落地/丢弃); 炉状态删除; 面板正绑定这台炉则连带关闭; onInvTouched('drop',
     posKey) 收尾(炉位观感/快捷栏归消费方) */
  function drop(posKey) {
    const f = furnaces.get(posKey);
    if (!f) return;
    const left = furnaceRefund(invOf(), f);
    if (left.length && o.onRefundLeft) o.onRefundLeft(posKey, left);
    furnaces.delete(posKey);
    if (at === posKey && open) closePanel();
    if (o.onInvTouched) o.onInvTouched('drop', posKey);
  }
  /* 烧炼节律(update 常开, 面板只是回显——烧炼中可关面板走人): 多炉逐炉推进
     (纯函数返新对象写回), 烧成件数经 onMade(记账/TTS 归消费方); 面板开着喂
     进度/燃料(逐帧), 三槽签名变化才喂 setSlots(省 DOM); ✕ 直关面板不经
     模式层 → 以 root.display 对账收状态(幂等保险) */
  function tick(dt) {
    for (const [k, f] of furnaces) {
      const hadOut = f.out ? f.out.n : 0;
      const n = smeltStep(f, dt);
      furnaces.set(k, n);
      const made = (n.out ? n.out.n : 0) - hadOut;
      if (made > 0 && o.onMade) o.onMade(k, n, made);
    }
    if (!open) return;
    const f = at ? furnaces.get(at) : null;
    panel.setProgress((f ? f.prog : 0) / SMELT_T);
    panel.setFuel(furnaceFuelR(f)); /* 余量条与进度条同拍(热值逐帧衰减, 逐帧喂) */
    const s = slotSig(f);
    if (s !== sig) {
      sig = s;
      panel.setSlots(furnaceSlots(f));
    }
    if (panel.root.style.display === 'none') closePanel(); /* ✕ 对账 */
  }
  /* 退出收场(体验馆口径): 逐炉三笔尽力入包, 满包余量静默丢弃(不走 onRefundLeft
     也不发 onInvTouched——掉落物会在世界清场同拍蒸发, 白造必蒸发的实体); 炉态清空 */
  function refundAll() {
    for (const f of furnaces.values()) furnaceRefund(invOf(), f);
    furnaces.clear();
  }
  function reset() {/* 重进场复位: 炉态清空 + 解绑 + 签名复位(存档重灌归消费方) */
    furnaces.clear();
    at = null;
    open = false;
    sig = '';
  }
  function dispose() {/* 模式卸载: 复位 + 面板一并卸下 */
    reset();
    panel.remove();
  }
  st = {map: furnaces, panel, open: openPanel, close: closePanel,
    isOpen: () => open, at: () => at, state, ensure, autoFill, manualPut,
    slotClick, tick, drop, refundAll, reset, dispose};
  return st;
}

const FurnaceKit = {mkFurnaceStation};
if (typeof module !== 'undefined' && module.exports) module.exports = FurnaceKit;
