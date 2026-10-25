'use strict';
/* 体验馆模式 (js/modes/showroom.js) 守门测试 — node --test (零依赖)
   运行: node --test test/showroom-mode.test.js
   票据 T2 的四条守门线(adventure-mode.test 契约先例, 只测外显行为, 不伸手进实现):
   ① 契约面: 模式文件可 require(CommonJS 导出守卫照 nether 先例) + 注册行形状 +
     main.js MODES 表接线正则(两空格缩进·行尾逗号, 影子清单断言锁格式);
   ② 数据隔离键扫: 模式源文本零存储 API 名/零存档键字面量(含注释也不许出现,
     T1 头注释特意用中文措辞避开这些名字留的净地) — 键清单=硬编码存量键 ∪
     全库 js/** 扫得的 _save/_backup 后缀字符串字面量, 后来者在任何文件新开
     键, 体验馆这边自动入禁(audio-registry.test 全库键扫同款手法);
   ③ 材料表 SHOWROOM_STOCK: 行形状 {id,n} · 总行数 ≤27(一行一槽) · 数量不超
     堆叠上限 · 全 id ∈ 物品核心注册表(vm 装真件校验) · 覆盖 SMELTS 全原料/
     全产物 + 代表燃料(煤/木板/木棍);
   ④ 进场预装与快捷栏: init 照表重铸内存背包满材料(每次进场干净初始态) +
     mkHotbar 快捷栏 9 槽镜像背包前 9 槽, 数字键/滚轮/点选全自动。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 假 DOM(mode-kit 惰性渲染用, adventure-mode.test 同款) ---------- */
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
      el.children.length = 0; /* innerHTML 重写即清子节点(真 DOM 语义, 重渲染计数不失真) */
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

const fakeClock = 0;
globalThis.performance = {now: () => fakeClock};
const elCache = {};
globalThis.document = {
  createElement: () => fakeEl(),
  getElementById: (id) => (elCache[id] = elCache[id] || fakeEl()),
};

/* ---------- 真引擎件: 物品核心+背包核心+合成核心(SMELTS), 共享一个 vm 词法环境 ---------- */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/items-core.js', 'js/inventory-core.js', 'js/craft-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({ITEMS, stackMax, isTool, toolOf, mkInventory, add, count, remove,
  HOTBAR_SLOTS, INV_SLOTS, SMELTS, FUEL, fuelUnits, smeltOf})`, eng);
Object.assign(globalThis, api); /* 模式文件经全局名消费这些真件(经典 script 词法环境) */

/* ---------- 假应用层(调用期解析的全局名, nether-mode.test 先例) ---------- */
const calls = [];
globalThis.loadScene = (fn) => {
  calls.push(['loadScene']);
  fn();
}; /* 场景装填 seam: 清场+建场(收尾重建归渲染层, 行为断言不需要) */
globalThis.SceneKit = {fill() {}};
globalThis.showToast = (s) => calls.push(['toast', s]);
globalThis.switchMode = (id) => calls.push(['switchMode', id]);
globalThis.showPage = (id) => calls.push(['showPage', id]);
globalThis.overlay = fakeEl();
globalThis.fps = 60; /* HUD 只读(main.js 顶层绑定) */
globalThis.pos = {x: 64.5, y: 13, z: 64.5, set() {}};
globalThis.vel = {set() {}};
globalThis.touchPlaying = false; /* input.js 顶层绑定, showroom init 写"进行中"态(跨文件写先例) */
globalThis.iconOf = (id) => (globalThis.ITEMS[id] && globalThis.ITEMS[id].icon) || ''; /* 像素图标工坊未加载: emoji 兜底 */
globalThis.setTouchActions = () => {}; /* 触屏按钮接线(input.js, mkMode init 必经; 体验馆无按钮 → null 照收) */

const ModeKit = require('../js/mode-kit.js');
globalThis.mkMode = ModeKit.mkMode;
globalThis.ModeKit = ModeKit;
ModeKit.spawn = (x, y, z, o) => {
  calls.push(['spawn', x, y, z, o]);
}; /* 出生点记账(不写真玩家状态, 进场断言只需要调用记录) */

const ShowroomMode = require('../js/modes/showroom.js');
const showroomSrc = fs.readFileSync(path.join(ROOT, 'js', 'modes', 'showroom.js'), 'utf8');

function freshEnter() {
  calls.length = 0;
  elCache['hotbar'].children.length = 0;
  ShowroomMode.init();
}

/* ============ ① 契约面 ============ */

test('体验馆: 模式文件可 require + 注册行形状(dev 调试场) + main.js MODES 接线正则', () => {
  assert.ok(ShowroomMode, 'CommonJS 导出守卫(nether 先例): require 不炸且有导出');
  assert.strictEqual(ShowroomMode.id, 'showroom', '模式对象 id');
  const ModeRegistry = require('../js/mode-registry.js');
  const row = ModeRegistry.all.find((m) => m.id === 'showroom');
  assert.ok(row, 'mode-registry.js 有 showroom 行');
  assert.match(row.name, /\S/, '有面向开发者的显示名');
  assert.strictEqual(row.gated, false, '不进儿童时限(gated:false)');
  assert.strictEqual(row.page, false, '无菜单页(卡点击直进, focus/math 先例)');
  assert.strictEqual(row.dev, true, 'dev 行(卡默认隐藏, ?dev=1 解锁)');
  assert.strictEqual(row.mood, 'none', '情绪 none');
  assert.strictEqual(ModeRegistry.scriptSrc(row), 'js/modes/showroom.js', '派生脚本路径');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  assert.match(mainSrc, /^ {2}showroom: ShowroomMode,$/m,
      'main.js MODES 表接线(两空格缩进+行尾逗号, mode-registry 影子清单锁的同款格式)');
});

/* ============ ② 数据隔离键扫 ============ */

/* 全库 js/** 扫存档键形状的字符串字面量(_save/_backup 后缀), 与硬编码存量键取并集:
   后来者在任何文件新开键, 体验馆的禁字清单自动跟上(清单是派生产物, 不是手抄两份) */
function scanSaveKeys() {
  const keys = new Set(['audio_vol_save', 'inventory_save', 'daily_budget_save',
    'daily_budget_migrate_backup', 'play_time_save', 'focus_camp_save', 'play_extra_save',
    'build_world_save', 'adventure_world_save', 'adventure_quest_save',
    'adventure_chest_save', 'math_camp_save']);
  const walk = (d) => {
    const out = [];
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) out.push(...walk(p));
      else if (p.endsWith('.js')) out.push(p);
    }
    return out;
  };
  const re = /'([a-z0-9]+(?:_[a-z0-9]+)*_(?:save|backup))'/g;
  for (const p of walk(path.join(ROOT, 'js'))) {
    const src = fs.readFileSync(p, 'utf8');
    let m;
    while ((m = re.exec(src)) !== null) keys.add(m[1]);
  }
  return keys;
}

test('体验馆: 数据隔离键扫 — 源文本零存储 API 名/零存档键字面量(含注释, T1 留的净地)', () => {
  const keys = scanSaveKeys();
  assert.ok(keys.size >= 12, '扫描器失灵? 全库存档键应不少于 12 个, 实得 ' + keys.size);
  for (const bad of ['localStorage', 'sessionStorage', 'SyncDB']) {
    assert.ok(!showroomSrc.includes(bad),
        'showroom.js 不得出现存储 API 名: ' + bad + '(spec 故事 16: 调试永不读写真实进度)');
  }
  for (const k of keys) {
    assert.ok(!showroomSrc.includes(k),
        'showroom.js 不得出现存档键字面量: ' + k + '(体验馆自建内存实例, 不经背包壳)');
  }
});

/* ============ ③ 材料数据表 ============ */

test('体验馆: SHOWROOM_STOCK — 行形状 {id,n} · ≤27 行 · 不超堆叠 · 全 id ∈ 物品核心 · 覆盖 SMELTS 全原料/产物+代表燃料', () => {
  const stock = ShowroomMode.stock;
  assert.ok(Array.isArray(stock) && stock.length > 0, '材料数据表在位(模式挂点, adventure .adv 先例)');
  assert.ok(stock.length <= api.INV_SLOTS,
      '总行数 ≤ ' + api.INV_SLOTS + '(一行一槽的装包预算): ' + stock.length);
  const ids = new Set();
  for (const row of stock) {
    assert.ok(row && typeof row.id === 'string' && Number.isInteger(row.n) && row.n >= 1,
        '行形状 {id, n}(id 字符串·n ≥1 整数): ' + JSON.stringify(row));
    assert.ok(Object.prototype.hasOwnProperty.call(api.ITEMS, row.id),
        '材料 id 须在物品核心注册(入包门禁 stackMax=0 即拒收): ' + row.id);
    assert.ok(row.n <= api.stackMax(row.id), '数量不超堆叠上限(保证一行一槽): ' + row.id + ' ×' + row.n);
    assert.ok(!ids.has(row.id), '行 id 不重复(对照样与原料同表不同行): ' + row.id);
    ids.add(row.id);
  }
  /* 票据口径: 初始清单 = SMELTS 全部原料 + 代表燃料(煤/木板/木棍) + 各产物对照样 */
  for (const [raw, out] of Object.entries(api.SMELTS)) {
    assert.ok(ids.has(raw), '缺 SMELTS 原料: ' + raw);
    assert.ok(ids.has(out), '缺烧炼产物对照样: ' + out);
  }
  for (const f of ['coal', 'planks', 'stick']) {
    assert.ok(ids.has(f), '缺代表燃料: ' + f);
  }
});

/* ============ ④ 进场预装与快捷栏 ============ */

test('体验馆: 进场预装 — init 照表重铸内存背包, 一行一槽·数量对表·每次进场干净初始态', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  assert.ok(inv && Array.isArray(inv.slots) && inv.slots.length === api.INV_SLOTS,
      '内存背包实例(mkInventory 27 槽, 不经背包壳)');
  for (const row of ShowroomMode.stock) {
    assert.strictEqual(api.count(inv, row.id), row.n, '预装数量对表: ' + row.id);
  }
  assert.strictEqual(inv.slots.filter(Boolean).length, ShowroomMode.stock.length,
      '一行一槽(行数 ≤27 且不超堆叠 ⇒ 槽占用 = 行数)');
  /* 干净初始态: 腾空一格后再进场, 照表重铸(spec 故事 17: 体验馆不读旧档) */
  inv.slots[0] = null;
  freshEnter();
  for (const row of ShowroomMode.stock) {
    assert.strictEqual(api.count(ShowroomMode.getInv(), row.id), row.n, '重进场重铸: ' + row.id);
  }
  assert.notStrictEqual(ShowroomMode.getInv(), inv, '重铸是新实例(旧包引用随进场丢弃)');
});

test('体验馆: 材料快捷栏 — mkHotbar 9 槽镜像背包前 9 槽, 数字键/滚轮/点选全自动, 进场可见', () => {
  freshEnter();
  const hb = ShowroomMode.hotbar;
  assert.ok(hb, '模式壳接了 mkHotbar(cfg.hotbar, mkMode 默认路由的接线面)');
  assert.strictEqual(hb.items.length, api.HOTBAR_SLOTS, '快捷栏 9 槽');
  const inv = ShowroomMode.getInv();
  for (let i = 0; i < api.HOTBAR_SLOTS; i++) {
    assert.strictEqual(hb.items[i].item, inv.slots[i] ? inv.slots[i].id : '',
        '槽 ' + i + ' 镜像背包(名字/图标随槽内容)');
  }
  /* 渲染出来的是真材料名(第一行材料在快捷栏第 1 槽露脸) */
  const firstName = api.ITEMS[ShowroomMode.stock[0].id].name;
  assert.ok(String(elCache['hotbar'].children[0].innerHTML).indexOf(firstName) >= 0,
      '快捷栏第 1 槽渲染材料名: ' + firstName);
  /* 点选 */
  hb.select(2);
  assert.strictEqual(hb.sel, 2, '点选选中第 3 槽');
  /* 数字键: mkMode 默认路由 onDigit(n) → hb.select(n-1) */
  ShowroomMode.onDigit(1);
  assert.strictEqual(hb.sel, 0, '数字键 1 → 槽 0');
  /* 滚轮: mkMode 默认路由 onWheel(d) → 环形换槽 */
  ShowroomMode.onWheel(1);
  assert.strictEqual(hb.sel, 1, '滚轮下滚 → 下一槽');
  ShowroomMode.onWheel(-1);
  assert.strictEqual(hb.sel, 0, '滚轮上滚 → 上一槽');
  ShowroomMode.onWheel(-1);
  assert.strictEqual(hb.sel, api.HOTBAR_SLOTS - 1, '滚轮在槽 0 上继续上滚 → 环回末槽');
  /* 进场可见(T1 默认隐藏, 装满材料后现身) */
  assert.strictEqual(elCache['hotbar'].style.display, 'flex', '进场快捷栏可见');
});
