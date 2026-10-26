'use strict';
/* 熔炉装配 kit (js/furnace-kit.js) 契约测试 — node --test (零依赖)
   运行: node --test test/furnace-kit.test.js
   票据 T4(showroom-tickets): 探险/体验馆两模式熔炉装配段的共享 kit —
   只测 kit 外显行为(接口即测试面), 不重测纯函数(烧炼单步/退炉在
   craft-core.test 已有), 只测编排:
   ① 开合生命周期: open 绑炉取产物亮面板, panel.close() ✕ 统一出口收状态
     (开合事件走 onPanel(open));
   ② 产物槽桥接(out→output): 核心炉态产物字段是 out, 面板 setSlots 读
     output(mode-kit 契约) — kit 喂显前桥接, 产物槽有锭必显示
     (探险侧历史错位随抽取修复的回归锁);
   ③ 自动放料: 面板 autoPlan 意图 → 经背包核心扣加(首现矿种全量 + 最省
     燃料补热值缺口);
   ④ 烧炼推进: tick 逐炉 smeltStep 写回, 烧成件数经 onMade 回调(记账/
     TTS/观感归消费方);
   ⑤ 满包政策: 取产物满包拒收留炉(onInvTouched 'collect-full'), 腾位后可收;
   ⑥ 挖炉退料 drop: 三笔入包 + 余量经 onRefundLeft + 删炉 + 绑定面板连带关;
   ⑦ refundAll(退出收场): 三笔尽力入包、余量静默丢弃(dev 口径)、炉态清空;
   ⑧ 燃料余量比 fuelR 上收: 无燃料按最高热值锚估、没在烧一律 0;
   ⑨ inv 两种供给形态: 背包对象(探险, 引用稳定) 与取数器(体验馆, 进场换
     新实例) 等价;
   ⑩ reset/dispose 生命周期复位;
   ⑪ onInvTouched reason 全集: 逐触发点→reason 语义锁(collect/collect-full/
     autofill/manual-put/drop, 同一动作只发一次; refundAll 静默)——防缝漂移。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 假 DOM(mode-kit 惰性渲染用, showroom-mode.test 同款本地副本) ---------- */
function fakeEl() {
  const el = {
    children: [], _cls: new Set(), style: {}, dataset: {}, textContent: '',
    addEventListener() {},
    appendChild(c) {
      c.parentNode = this;
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      c.parentNode = null;
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    querySelector(sel) {
      if (!this['q_' + sel]) this['q_' + sel] = fakeEl();
      return this['q_' + sel];
    },
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => html,
    set: (v) => {
      html = String(v);
      el.children.length = 0; /* innerHTML 重写即清子节点(真 DOM 语义) */
    },
  });
  Object.defineProperty(el, 'className', {
    get: () => [...el._cls].join(' '),
    set: (v) => {
      el._cls.clear();
      String(v).split(/\s+/).filter(Boolean).forEach((c) => el._cls.add(c));
    },
  });
  Object.defineProperty(el, 'classList', {value: {
    add: (c)=>el._cls.add(c), remove: (c)=>el._cls.delete(c),
    toggle: (c, v)=>{
      const on = (v === undefined) ? !el._cls.has(c) : v;
      if (on) el._cls.add(c); else el._cls.delete(c);
    },
    contains: (c)=>el._cls.has(c),
  }});
  return el;
}

globalThis.performance = {now: () => 0};
const elCache = {};
globalThis.document = {
  createElement: () => fakeEl(),
  getElementById: (id) => (elCache[id] = elCache[id] || fakeEl()),
};

/* ---------- 真件: 纯核心三件(vm 共享词法环境) + 两 require 件 ---------- */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/config.js', 'js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
/* 点名提取(vm 顶层 const 不上 globalThis, showroom-mode.test 同款手法) */
const api = vm.runInContext(`({ITEMS, stackMax, isTool, toolOf, mkInventory, add, count, remove,
  take, HOTBAR_SLOTS, INV_SLOTS, SMELTS, FUEL, fuelUnits, smeltOf,
  BLOCKS, B_FURNACE, B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER,
  B_CRAFT, B_GRASS_TUFT, B_SAPLING, B_TORCH, B_CHEST, B_TNT})`, eng);
Object.assign(globalThis, api);
/* 烧炼三件(SMELT_T/smeltStep/furnaceRefund)已迁 craft-core: Node 侧 require 真模块
   铺到全局——浏览器侧 index.html 里 craft-core(L260) 先于本 kit(L295) 加载, 同构;
   adventure-core 不再是本 kit 的依赖(2026-10 归属错位修复), 不加载 */
const CraftCore = require('../js/craft-core.js');
Object.assign(globalThis, {SMELT_T: CraftCore.SMELT_T, smeltStep: CraftCore.smeltStep,
  furnaceRefund: CraftCore.furnaceRefund});
globalThis.iconOf = (id) => (globalThis.ITEMS[id] && globalThis.ITEMS[id].icon) || ''; /* emoji 兜底(工坊未加载) */
globalThis.btnImg = () => ''; /* 面板 chrome 无图(工坊未加载) */
const ModeKit = require('../js/mode-kit.js');
globalThis.ModeKit = ModeKit;
const FurnaceKit = require('../js/furnace-kit.js');

/* ---------- 测试件: 面板 DOM 查询 + 带记账 hooks 的快捷构造 ---------- */
function collectByClass(root, cls) {
  const out = [];
  const walk = (el) => {
    for (const c of el.children || []) {
      if ((' ' + c.className + ' ').includes(' ' + cls + ' ')) out.push(c);
      walk(c);
    }
  };
  walk(root);
  return out;
}

function mkStation(over) {
  const log = [];
  const inv = mkInventory();
  const st = FurnaceKit.mkFurnaceStation(Object.assign({
    inv,
    onPanel: (isOpen) => log.push([isOpen ? 'open' : 'close']),
    onInvTouched: (reason, posKey) => log.push(['inv', reason, posKey]),
    onRefundLeft: (k, left) => log.push(['left', k, left]),
    onMade: (k, n, made) => log.push(['made', k, made]),
  }, over));
  return {st, inv, log};
}

function fillInv(inv) {/* 27 槽圆石填满(取产物必拒收的满包前提) */
  add(inv, 'cobble', 27 * stackMax('cobble'));
}

/* 预置炉态快捷件: posKey 固定 '10,20,30' */
const KEY = '10,20,30';
function setState(st, over) {
  const s = Object.assign({input: null, fuel: null, out: null, heat: 0, prog: 0}, over);
  st.map.set(KEY, s);
  return s;
}

test('熔炉装配: 开合生命周期 — open 绑炉取产物亮面板, ✕ 统一出口收状态', () => {
  const {st, log} = mkStation();
  assert.ok(!st.isOpen(), '初始关');
  st.open(KEY);
  assert.ok(st.isOpen(), '开后开');
  assert.strictEqual(st.at(), KEY, '面板绑定这台炉');
  assert.deepStrictEqual(log[0], ['open'], 'onPanel(true) 恰一次');
  st.panel.close(); /* ✕/Esc 统一出口: hide + onClose → kit 收状态 */
  assert.ok(!st.isOpen(), '✕ 后关');
  assert.strictEqual(st.at(), null, '解绑(多炉口径)');
  assert.deepStrictEqual(log.filter((e) => e[0] === 'close').length, 1, 'onPanel(false) 恰一次');
});

test('熔炉装配: 产物槽桥接(out→output) — 满包留炉的产物在面板上有显示(T4 回归锁)', () => {
  const {st, inv} = mkStation();
  fillInv(inv); /* 满包: 开面板取产物必拒收, 产物留在炉里 */
  setState(st, {out: {id: 'iron_ingot', n: 3}});
  st.open(KEY);
  const cells = collectByClass(st.panel.root, 'mkp-cell');
  assert.ok(cells.length >= 3, '三槽在场');
  assert.ok(cells[2].innerHTML.includes('<span class="cnt">3</span>'),
      '产物槽显示 3 件铁锭(核心炉态字段 out 经桥接喂面板 output)');
});

test('熔炉装配: 自动放料 — autoPlan 意图经背包核心扣加(首现矿种全量+最省燃料)', () => {
  const {st, inv, log} = mkStation();
  add(inv, 'iron_ore', 5);
  add(inv, 'coal', 1);
  st.open(KEY);
  st.autoFill(); /* 无参 = 面板 autoPlan 自算 */
  const f = st.state(KEY);
  assert.deepStrictEqual(f.input, {id: 'iron_ore', n: 5}, '待烧 5 件(首现矿种全量)');
  assert.deepStrictEqual(f.fuel, {id: 'coal', n: 1}, '燃料 1 块煤(缺口 5/热值 8 → 1 块)');
  assert.strictEqual(count(inv, 'iron_ore'), 0, '料已扣');
  assert.strictEqual(count(inv, 'coal'), 0, '燃料已扣');
  assert.ok(log.some((e) => e[0] === 'inv' && e[1] === 'autofill'), '库存变动通知(onInvTouched autofill, 快捷栏刷新缝)');
});

test('熔炉装配: autoFill 显式 posKey — 未开面板也能装炉(体验馆单炉固定 key 形态)', () => {
  const {st, inv} = mkStation();
  add(inv, 'iron_ore', 2);
  add(inv, 'coal', 1);
  st.autoFill(undefined, KEY); /* 面板从未打开: 显式 key 直调 */
  assert.deepStrictEqual(st.state(KEY).input, {id: 'iron_ore', n: 2}, '未绑定面板照常装炉');
  assert.ok(!st.isOpen(), '不产生开态');
});

test('熔炉装配: tick 逐炉推进 — 烧成经 onMade 回调(件数增量), 炉态写回', () => {
  const {st, log} = mkStation();
  setState(st, {input: {id: 'iron_ore', n: 2}, fuel: {id: 'coal', n: 1}});
  st.tick(SMELT_T + 0.1); /* 2.6s: 首件烧成 */
  const f = st.state(KEY);
  assert.deepStrictEqual(f.out, {id: 'iron_ingot', n: 1}, '首件烧成');
  assert.deepStrictEqual(log.filter((e) => e[0] === 'made'), [['made', KEY, 1]], 'onMade 恰一次·增量 1');
  st.tick(SMELT_T);
  assert.deepStrictEqual(st.state(KEY).out, {id: 'iron_ingot', n: 2}, '第二件烧成');
});

test('熔炉装配: 满包政策 — 取产物拒收留炉(collect-full), 腾位后关面板即收', () => {
  const {st, inv, log} = mkStation();
  fillInv(inv);
  setState(st, {out: {id: 'iron_ingot', n: 2}});
  st.open(KEY); /* 开面板先取产物: 满包拒收 */
  assert.deepStrictEqual(st.state(KEY).out, {id: 'iron_ingot', n: 2}, '产物整撮留炉');
  assert.ok(log.some((e) => e[0] === 'inv' && e[1] === 'collect-full'), '满包回调(儿童提示归消费方)');
  inv.slots[26] = null; /* 腾一格 */
  st.close();
  assert.strictEqual(st.state(KEY).out, null, '关面板顺带取走产物');
  assert.strictEqual(count(inv, 'iron_ingot'), 2, '产物入包');
  assert.ok(log.some((e) => e[0] === 'inv' && e[1] === 'collect'), '成功收取回调');
});

test('熔炉装配: 挖炉退料 drop — 三笔入包·余量回调·删炉·绑定面板连带关', () => {
  const {st, inv, log} = mkStation();
  setState(st, {input: {id: 'iron_ore', n: 2}, fuel: {id: 'coal', n: 1},
    out: {id: 'iron_ingot', n: 1}});
  st.open(KEY);
  st.drop(KEY);
  assert.strictEqual(st.state(KEY), null, '炉状态删除');
  assert.strictEqual(count(inv, 'iron_ore'), 2, '待烧料退包');
  assert.strictEqual(count(inv, 'coal'), 1, '燃料退包');
  assert.strictEqual(count(inv, 'iron_ingot'), 1, '产物退包');
  assert.ok(!st.isOpen(), '绑定面板连带关闭');
  assert.ok(log.some((e) => e[0] === 'inv' && e[1] === 'drop' && e[2] === KEY),
      'onInvTouched drop 附带 posKey(炉位观感/快捷栏收口缝)');
});

test('熔炉装配: 挖炉余量 — 满包装不下的走 onRefundLeft(探险掉炉位口径)', () => {
  const {st, inv, log} = mkStation();
  fillInv(inv);
  inv.slots[26] = {id: 'iron_ingot', n: 63}; /* 只留 1 件余量的半摞: 铁锭 2 只收得下 1 */
  setState(st, {out: {id: 'iron_ingot', n: 2}});
  st.drop(KEY);
  assert.strictEqual(count(inv, 'iron_ingot'), 64, '收下一件(63→64)');
  assert.deepStrictEqual(log.filter((e) => e[0] === 'left'), [['left', KEY, [{id: 'iron_ingot', n: 1}]]],
      '余量清单经回调(消费方决定落地/丢弃)');
});

test('熔炉装配: refundAll 退出收场 — 三笔尽力入包·余量静默丢弃·炉态清空', () => {
  const {st, inv, log} = mkStation();
  fillInv(inv);
  inv.slots[26] = {id: 'iron_ingot', n: 63}; /* 满包 + 仅 1 件余量: 料/燃料整笔丢弃, 产物收 1 */
  setState(st, {input: {id: 'iron_ore', n: 2}, fuel: {id: 'coal', n: 1},
    out: {id: 'iron_ingot', n: 2}});
  st.refundAll();
  assert.strictEqual(count(inv, 'iron_ore'), 0, '待烧料无处容身→静默丢弃');
  assert.strictEqual(count(inv, 'coal'), 0, '燃料无处容身→静默丢弃');
  assert.strictEqual(count(inv, 'iron_ingot'), 64, '产物尽力入包(63→64, 余 1 丢弃)');
  assert.strictEqual(st.map.size, 0, '炉态清空(纯内存退出即清)');
  assert.ok(!log.some((e) => e[0] === 'left'), '退出余量不走掉落回调(dev 静默口径)');
});

test('熔炉装配: 燃料余量比 — 无燃料按最高热值锚估, 没在烧一律 0(F2 口径上收)', () => {
  const {st, inv} = mkStation();
  fillInv(inv);
  setState(st, {input: {id: 'iron_ore', n: 1}, fuel: null, heat: 2}); /* 煤热值 8 锚估 */
  st.open(KEY);
  const ffill = collectByClass(st.panel.root, 'mkp-ffill')[0];
  assert.strictEqual(ffill.style.width, '25%', 'r = 2/8 = 0.25(无燃料锚最高热值)');
  const fire = collectByClass(st.panel.root, 'mkp-fire')[0];
  assert.ok(!fire.classList.contains('mkp-fire-out'), '燃烧中(有热有料)');
});

test('熔炉装配: inv 取数器供给(体验馆形态) — 进场换新实例照常工作', () => {
  let inv = mkInventory(); /* 体验馆进场照表重铸: 引用会换 */
  const {st} = mkStation({inv: () => inv});
  add(inv, 'iron_ore', 3);
  st.open(KEY);
  st.autoFill();
  assert.deepStrictEqual(st.state(KEY).input, {id: 'iron_ore', n: 3}, '取数器读到当前包');
  inv = mkInventory(); /* 换新实例(重进场) */
  add(inv, 'sand', 2);
  st.autoFill();
  assert.strictEqual(st.state(KEY).input.id, 'iron_ore', '旧料还在炉里(炉态独立于包)');
  const inv2 = inv;
  inv2.slots[0] = null; /* 从新包再装一次: 面板 autoPlan 读的是新包 */
  st.map.clear();
  st.autoFill();
  assert.strictEqual(st.state(KEY).input, null, '新包被腾空 → 无料可装');
});

test('熔炉装配: reset 复位 — 炉态/开态/绑定全清(init 重进场口径)', () => {
  const {st} = mkStation();
  setState(st, {input: {id: 'iron_ore', n: 1}});
  st.open(KEY);
  st.reset();
  assert.strictEqual(st.map.size, 0, '炉态清');
  assert.ok(!st.isOpen(), '开态清');
  assert.strictEqual(st.at(), null, '绑定清');
});

test('熔炉装配: 面板三槽签名节流 — 槽不变不重喂(DOM 省 redraw)', () => {
  const {st} = mkStation();
  setState(st, {input: {id: 'iron_ore', n: 1}, fuel: {id: 'coal', n: 1}});
  st.open(KEY);
  const cellIn = collectByClass(st.panel.root, 'mkp-cell')[0];
  const before = cellIn.innerHTML;
  st.tick(0.001); /* 槽签名未变 */
  assert.strictEqual(cellIn.innerHTML, before, '槽不变不重画');
  st.state(KEY).input = {id: 'sand', n: 2}; /* 换料 → 签名变 */
  st.tick(0.001);
  assert.notStrictEqual(cellIn.innerHTML, before, '签名变才重画');
});

/* ---------- 手动放料 + 炉槽取回(2026-10-25 交互优化) ---------- */

test('熔炉装配: 手动放料 — 背包槽整摞路由(可烧→料槽·燃料→燃料槽), 不可入炉原样放回', () => {
  const {st, inv, log} = mkStation();
  inv.slots[9] = {id: 'iron_ore', n: 5};
  inv.slots[10] = {id: 'coal', n: 2};
  inv.slots[11] = {id: 'apple', n: 3}; /* 既不可烧也非燃料 */
  st.open(KEY);
  st.manualPut(9); /* 可烧: 整摞入料槽 */
  st.manualPut(10); /* 燃料: 整摞入燃料槽 */
  st.manualPut(11); /* 不可入炉: 原样放回 */
  const f = st.state(KEY);
  assert.deepStrictEqual(f.input, {id: 'iron_ore', n: 5}, '铁矿整摞入料槽');
  assert.deepStrictEqual(f.fuel, {id: 'coal', n: 2}, '煤整摞入燃料槽');
  assert.strictEqual(inv.slots[9], null, '料槽源格已空');
  assert.strictEqual(inv.slots[10], null, '燃料源格已空');
  assert.deepStrictEqual(inv.slots[11], {id: 'apple', n: 3}, '不可入炉物原样放回(苹果: 不可烧非燃料)');
  assert.strictEqual(log.filter((e) => e[0] === 'inv' && e[1] === 'manual-put').length, 2,
      '恰两次成功放料通知(放回不动包不误报)');
});

test('熔炉装配: 手动放料异种对调 — 炉内整摞回源槽(无损不走 add), 同种并堆', () => {
  const {st, inv} = mkStation();
  setState(st, {input: {id: 'sand', n: 2}});
  inv.slots[9] = {id: 'iron_ore', n: 3};
  st.open(KEY);
  st.manualPut(9); /* 异种: 沙子整摞回源槽, 铁矿入炉 */
  assert.deepStrictEqual(st.state(KEY).input, {id: 'iron_ore', n: 3}, '铁矿接管料槽');
  assert.deepStrictEqual(inv.slots[9], {id: 'sand', n: 2}, '炉内原料整摞回源槽(腾出的槽必容得下)');
  inv.slots[9] = {id: 'iron_ore', n: 4};
  st.manualPut(9); /* 同种并堆 3+4(不限堆叠上限, autoFill 全量同口径) */
  assert.deepStrictEqual(st.state(KEY).input, {id: 'iron_ore', n: 7}, '同种并堆');
  assert.strictEqual(inv.slots[9], null, '并堆后源格空');
});

test('熔炉装配: 炉槽取回 — 料/燃料整摞回包, 满包整摞留炉发 collect-full', () => {
  const {st, inv, log} = mkStation();
  fillInv(inv); /* 满包: 取回必拒收 */
  setState(st, {input: {id: 'iron_ore', n: 2}});
  st.open(KEY);
  st.slotClick('input');
  assert.deepStrictEqual(st.state(KEY).input, {id: 'iron_ore', n: 2}, '满包整摞留炉(拒收口径)');
  assert.ok(log.some((e) => e[0] === 'inv' && e[1] === 'collect-full'), '满包回调(儿童提示与取产物同 reason)');
  inv.slots[26] = null; /* 腾一格 */
  st.slotClick('input');
  assert.strictEqual(st.state(KEY).input, null, '取回后料槽空');
  assert.strictEqual(count(inv, 'iron_ore'), 2, '整摞回包');
  assert.ok(log.some((e) => e[0] === 'inv' && e[1] === 'collect'), '成功回调(快捷栏刷新+音效)');
});

test('熔炉装配: 产物槽点击即收 — 面板开着烧成的新产物点一下入包(自动收的手动补发)', () => {
  const {st, inv} = mkStation();
  setState(st, {input: {id: 'iron_ore', n: 1}, fuel: {id: 'coal', n: 1}});
  st.open(KEY);
  st.tick(SMELT_T + 0.1); /* 烧成 1 件躺在炉里(面板开着不自动收) */
  assert.deepStrictEqual(st.state(KEY).out, {id: 'iron_ingot', n: 1}, '前提: 产物在炉');
  st.slotClick('out');
  assert.strictEqual(st.state(KEY).out, null, '点击产物槽即收');
  assert.strictEqual(count(inv, 'iron_ingot'), 1, '产物入包');
});

test('熔炉装配: 面板背包格点击全链 — onPut/onSlot 意图出口接线(手动放入入口)', () => {
  const {st, inv} = mkStation();
  inv.slots[9] = {id: 'iron_ore', n: 3};
  inv.slots[10] = {id: 'coal', n: 1};
  st.open(KEY);
  const cells = collectByClass(st.panel.root, 'mkp-cell');
  assert.strictEqual(cells.length, 3 + 27, '炉三槽(DOM 序前 3) + 背包 27 格(18 主格+9 快捷镜像)');
  cells[3].onclick(); /* 主格首格 = 背包槽 9: 铁矿整摞入炉 */
  cells[4].onclick(); /* 背包槽 10: 煤入燃料槽 */
  const f = st.state(KEY);
  assert.deepStrictEqual(f.input, {id: 'iron_ore', n: 3}, '经面板点击: 料入炉');
  assert.deepStrictEqual(f.fuel, {id: 'coal', n: 1}, '经面板点击: 燃料入炉');
  collectByClass(st.panel.root, 'mkp-cell')[1].onclick(); /* 炉燃料槽(cells[1]): 点击取回 */
  assert.strictEqual(st.state(KEY).fuel, null, '点击燃料槽整摞取回');
  assert.strictEqual(count(inv, 'coal'), 1, '煤回包');
  assert.ok(st.isOpen(), '取回不开合面板(开态不变)');
});

/* ---------- onInvTouched reason 全集(语义锁, 防缝漂移) ---------- */

test('熔炉装配: onInvTouched reason 全集 — 逐触发点发什么 reason, 同一动作只发一次', () => {
  const {st, inv, log} = mkStation();
  const invLog = () => log.filter((e) => e[0] === 'inv');
  /* collect-full: 开面板收产物满包 + 炉槽取回满包(两个触发点同 reason 同政策) */
  fillInv(inv);
  setState(st, {out: {id: 'iron_ingot', n: 2}, input: {id: 'iron_ore', n: 2}});
  st.open(KEY);
  st.slotClick('input');
  assert.deepStrictEqual(invLog(), [['inv', 'collect-full', undefined], ['inv', 'collect-full', undefined]],
      '开面板收产物满包 + 料槽取回满包 → 各一次 collect-full');
  /* collect: 腾位后关面板顺带收产物成功 */
  inv.slots[26] = null;
  st.close();
  assert.deepStrictEqual(invLog().slice(2), [['inv', 'collect', undefined]], '关面板收产物成功 → collect');
  /* manual-put: 整摞入炉恰一次; 不可入炉原样放回不动包不发(显式 posKey=体验馆口径) */
  inv.slots[9] = {id: 'iron_ore', n: 1};
  inv.slots[10] = {id: 'apple', n: 1}; /* 既不可烧也非燃料 */
  st.manualPut(9, KEY); /* 炉内还有 2 件: 同种并堆 */
  st.manualPut(10, KEY);
  assert.deepStrictEqual(invLog().slice(3), [['inv', 'manual-put', undefined]],
      '手动放料动包 → manual-put 恰一次(放回不动包不发)');
  /* autofill: 料槽已占 → 只走燃料分支动包 */
  inv.slots[9] = {id: 'coal', n: 1};
  st.autoFill({load: [], fuel: [{id: 'coal', n: 1}]}, KEY);
  assert.deepStrictEqual(invLog().slice(4), [['inv', 'autofill', undefined]], '自动放料动包 → autofill');
  /* collect: 炉槽取回成功恰一次(旧缝 onCollect+onInvChange 双发在此收口) */
  st.slotClick('fuel', KEY);
  assert.deepStrictEqual(invLog().slice(5), [['inv', 'collect', undefined]], '燃料整摞取回成功 → collect 恰一次');
  /* drop: 挖炉退料已入包+炉已删, 唯一附带 posKey 的 reason */
  inv.slots[8] = null; /* 腾位: 退料全额入包, 不触发 onRefundLeft */
  st.drop(KEY);
  assert.deepStrictEqual(invLog().slice(6), [['inv', 'drop', KEY]], '挖炉退料 → drop 附带 posKey(炉位观感政策用)');
  /* refundAll: 退出收场动包但静默(dev 口径, 不发任何事件) */
  setState(st, {input: {id: 'iron_ore', n: 1}});
  st.refundAll();
  assert.deepStrictEqual(invLog().slice(7), [], 'refundAll 动包不发事件(退出收场静默)');
});
