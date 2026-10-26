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
     mkHotbar 快捷栏 9 槽镜像背包前 9 槽, 数字键/滚轮/点选全自动。
   票据 T3 的行为线(熔炉展品, 只测编排不重测纯函数——烧炼单步/退炉在
   adventure-core.test 已有): 装场预置熔炉+出生圈内 · 走近点击开面板/远距拒 ·
   自动放料经背包核心扣加 · update 逐炉推进+面板开着喂显 · 关面板烧炼照跑 ·
   cleanup 三笔全额退包清炉态。 */
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

/* ---------- 真引擎件: 体素底座+四纯核心(vm), 共享一个 vm 词法环境 ----------
   T3 起 vm 装真体素底座(config/voxel/scene-kit, adventure-mode.test 同款): 装场
   预置熔炉要对着真 fill/getBlock 断言, fake SceneKit 会把「方块真的在场」变成
   同义反复。烧炼同源纯函数走 require(adventure-core, adventure-mode.test 同款
   — Node realm 创建的对象与断言字面量同原型, vm realm 会因原型不同而
   deepStrictEqual 误红); 其全局名依赖(getBlock/fuelUnits…)在调用期经
   globalThis 解析, 已由 vm 件的 Object.assign 就位 */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
for (const f of ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/items-core.js',
  'js/inventory-core.js', 'js/craft-core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), eng, {filename: f});
}
const api = vm.runInContext(`({ITEMS, stackMax, isTool, toolOf, mkInventory, add, count, remove,
  take, HOTBAR_SLOTS, INV_SLOTS, SMELTS, FUEL, fuelUnits, smeltOf,
  BLOCKS, B_FURNACE, B_COAL_ORE, B_IRON_ORE, B_GOLD_ORE, B_DIAMOND_ORE, B_CLAY, B_WATER,
  B_CRAFT, B_GRASS_TUFT, B_SAPLING, B_TORCH, B_CHEST, B_TNT,
  getBlock, setBlockRaw, blockKey, SceneKit})`, eng);
Object.assign(globalThis, api); /* 模式文件经全局名消费这些真件(经典 script 词法环境) */
const AdventureCore = require('../js/adventure-core.js');
Object.assign(globalThis, AdventureCore); /* advNearStation/ADV_* 等(经全局名消费) */
/* 烧炼三件(SMELT_T/smeltStep/furnaceRefund)已迁 craft-core(2026-10 归属错位修复):
   Node 侧 require 真模块铺到全局(furnace-kit 经全局名调用期解析) */
const CraftCore = require('../js/craft-core.js');
Object.assign(globalThis, {SMELT_T: CraftCore.SMELT_T, smeltStep: CraftCore.smeltStep,
  furnaceRefund: CraftCore.furnaceRefund});

/* ---------- 假应用层(调用期解析的全局名, nether-mode.test 先例) ---------- */
const calls = [];
globalThis.loadScene = (fn) => {
  calls.push(['loadScene']);
  fn();
}; /* 场景装填 seam: 清场+建场(收尾重建归渲染层, 行为断言不需要) */
globalThis.showToast = (s) => calls.push(['toast', s]);
const dropCalls = []; /* 掉落物调用记账: 体验馆退出收场应为零(满包余量静默丢弃口径) */
globalThis.Drops = {spawn: (id, n) => dropCalls.push([id, n])}; /* 掉落物库 stub: 防错网 — 退出链谁落掉落物当场红 */
globalThis.switchMode = (id) => calls.push(['switchMode', id]);
globalThis.showPage = (id) => calls.push(['showPage', id]);
globalThis.overlay = fakeEl();
globalThis.fps = 60; /* HUD 只读(main.js 顶层绑定) */
globalThis.pos = {x: 64.5, y: 13, z: 64.5, set() {}};
globalThis.vel = {set() {}};
globalThis.touchPlaying = false; /* input.js 顶层绑定, showroom init 写"进行中"态(跨文件写先例) */
globalThis.iconOf = (id) => (globalThis.ITEMS[id] && globalThis.ITEMS[id].icon) || ''; /* 像素图标工坊未加载: emoji 兜底 */
globalThis.btnImg = () => ''; /* 按钮像素图标工坊未加载: 空串=面板 chrome 无图(adventure-mode.test 同款) */
globalThis.setTouchActions = () => {}; /* 触屏按钮接线(input.js, mkMode init 必经; 体验馆无按钮 → null 照收) */

const ModeKit = require('../js/mode-kit.js');
globalThis.mkMode = ModeKit.mkMode;
globalThis.ModeKit = ModeKit;
globalThis.FurnaceKit = require('../js/furnace-kit.js'); /* 共享熔炉 kit(T4): 模式顶层即构造 station */
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

/* ============ ⑤ 熔炉展品(票据 T3) ============ */

/* 装场预置位(外部可见规格): 出生点世界中心(64.5, 64.5), yaw=0 面朝 -Z(camera-rig
   口径), 熔炉放在面前 2 格的 (64, 13, 62) — 站立面 y=13(草地顶层 12 + 1),
   炉中心 (64.5, 62.5) 距出生点水平 2 格, 落在探险同款 4 格解锁圈内(spec 故事 4/7) */
const SR_FURNACE = {x: 64, y: 13, z: 62};

test('体验馆: 装场预置熔炉 — 中心方块在场(真件 getBlock) + 出生点落在 4 格解锁圈内', () => {
  freshEnter(); /* init → loadScene → showroomBuild: 真 SceneKit.fill 写真体素 */
  assert.strictEqual(api.getBlock(SR_FURNACE.x, SR_FURNACE.y, SR_FURNACE.z), api.B_FURNACE,
      '场中心预置熔炉方块(B_FURNACE, 装场即在场不靠玩家放置)');
  const d = Math.hypot(SR_FURNACE.x + 0.5 - 64.5, SR_FURNACE.z + 0.5 - 64.5);
  assert.ok(d <= 4, '炉中心距出生点水平 ' + d.toFixed(2) + ' 格 ≤ 4(零走动立刻开测)');
});

test('体验馆: 走近点击熔炉开面板(左右键同达) · 太远 toast 拒不误开 · ✕ 统一出口收面板', () => {
  freshEnter();
  const hit = {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z}; /* 准星/指尖命中炉方块 */
  /* 远距拒: 玩家站到圈外(水平距离 8 > 4), 点击只提示不开(探险 advUseStation 同款口径) */
  const sx = pos.x; const sz = pos.z;
  pos.x = 64.5; pos.z = 72.5;
  ShowroomMode.onMouse(2, hit);
  assert.ok(!ShowroomMode.sr.isOpen(), '圈外点击不开面板');
  assert.ok(calls.some((c) => c[0] === 'toast' && String(c[1]).includes('走近')),
      '圈外点击给走近提示(toast)');
  /* 走近开: 回到出生点(圈内 2 格), 左键/右键都达使用交互(探险同款) */
  pos.x = sx; pos.z = sz;
  ShowroomMode.onMouse(2, hit);
  assert.ok(ShowroomMode.sr.isOpen(), '圈内轻点(右键口径)开熔炉面板');
  ShowroomMode.sr.panel.close(); /* ✕/Esc 统一出口: hide + onClose → 模式层收状态 */
  assert.ok(!ShowroomMode.sr.isOpen(), '✕ 统一出口后面板状态同步收起');
  /* 左键同达(桌面 mousedown 口径) */
  ShowroomMode.onMouse(0, hit);
  assert.ok(ShowroomMode.sr.isOpen(), '圈内左键同样开面板');
  ShowroomMode.sr.panel.close();
});

test('体验馆: 自动放入 — 矿石首现全量入炉 + 最省燃料凑热值, 扣加全经背包核心', () => {
  freshEnter();
  const hit = {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z};
  ShowroomMode.onMouse(2, hit); /* 开面板(自动放料是面板意图出口) */
  ShowroomMode.sr.autoFill(); /* 无参 = 面板 autoPlan 自算真 plan(读真包) */
  const key = api.blockKey(SR_FURNACE.x, SR_FURNACE.y, SR_FURNACE.z);
  const f = ShowroomMode.sr.furnaces.get(key);
  /* 独立推演: 材料表首现矿种 = iron_ore×16(SHOWROOM_STOCK 第一行) → 全量入炉;
     热值缺口 16 件, FUEL 择优序首是煤(热值 8 件/块) → ceil(16/8)=2 块煤 */
  assert.deepStrictEqual(f.input, {id: 'iron_ore', n: 16}, '待烧料 = 首现矿种全量');
  assert.deepStrictEqual(f.fuel, {id: 'coal', n: 2}, '燃料 = 最省凑料(煤 2 块覆盖 16 件)');
  const inv = ShowroomMode.getInv();
  assert.strictEqual(api.count(inv, 'iron_ore'), 0, '背包铁矿全额扣减(经 take)');
  assert.strictEqual(api.count(inv, 'coal'), 14, '背包煤扣 2 块(16−2)');
  assert.strictEqual(f.out, null, '产物槽尚空(2.5s/件还没烧)');
  assert.strictEqual(f.heat, 0, '放料不点火: 热值在首次烧炼步进才折算(smeltStep 语义, 与探险一致)');
});

/* 面板 DOM 面读喂显结果: 递归找类名(进度/燃料填充条), 只断言「被喂过」
   (钳制/灰显等渲染语义归 mode-kit.test, 这里不重测) */
function findByClass(el, cls) {
  if (String(el.className || '').split(/\s+/).includes(cls)) return el;
  for (const c of el.children || []) {
    const r = findByClass(c, cls);
    if (r) return r;
  }
  return null;
}

/* 同上, 但收全清单(DOM 序): 熔炉三槽 cell 顺序 = 料/燃料/产物 */
function collectByClass(el, cls, acc) {
  acc = acc || [];
  if (String(el.className || '').split(/\s+/).includes(cls)) acc.push(el);
  for (const c of el.children || []) collectByClass(c, cls, acc);
  return acc;
}

test('体验馆: update 逐炉推进 — 2.5s/件出锭 · 面板开着喂进度条 · 关面板烧炼照跑(进度保留)', () => {
  freshEnter();
  const hit = {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z};
  ShowroomMode.onMouse(2, hit);
  ShowroomMode.sr.autoFill(); /* iron_ore×16 + coal×2 入炉 */
  const key = api.blockKey(SR_FURNACE.x, SR_FURNACE.y, SR_FURNACE.z);
  /* 第一步 2.6s: 首步折算煤热值 8 件 → 烧 1 件出锭, 余 0.1s 结转下一件;
     heat = 8 − 2.6/2.5 = 6.96; 燃料首步耗 1 块(剩 1) */
  ShowroomMode.update(2.6);
  let f = ShowroomMode.sr.furnaces.get(key);
  assert.deepStrictEqual(f.out, {id: 'iron_ingot', n: 1}, '烧满 2.5s 出 1 锭(真实速率口径)');
  assert.deepStrictEqual(f.input, {id: 'iron_ore', n: 15}, '待烧料 −1');
  assert.deepStrictEqual(f.fuel, {id: 'coal', n: 1}, '煤首步折算耗 1 块');
  assert.ok(Math.abs(f.heat - 6.96) < 1e-9, '热值余 6.96(8−1.04, 不白烧)');
  assert.ok(Math.abs(f.prog - 0.1) < 1e-9, '余 0.1s 结转下一件(半件不丢)');
  /* 面板开着 → 进度条被喂过(0.1/2.5 = 4%) */
  const fill = findByClass(ShowroomMode.sr.panel.root, 'mkp-pfill');
  assert.ok(fill, '面板 DOM 有进度填充条');
  assert.strictEqual(fill.style.width, '4%', '进度条喂显 4%(0.1/2.5)');
  /* 三槽喂显(字段桥接): 核心炉态产物字段是 out, 面板 setSlots 读 output
     (mode-kit 契约) — 桥接后烧出的锭在产物槽露脸(修复前喂错字段, 产物槽
     即使有锭也永远空白) */
  const cells = collectByClass(ShowroomMode.sr.panel.root, 'mkp-cell');
  assert.strictEqual(cells.length, 3 + 27, '炉三槽(料/燃料/产物) + 背包 27 格(手动放入常驻区)');
  assert.ok(String(cells[0].innerHTML).indexOf('🟠') >= 0, '料槽显示铁矿石图标');
  assert.ok(String(cells[2].innerHTML).indexOf('⬜') >= 0, '产物槽显示铁锭图标(out→output 桥接喂显)');
  /* 关面板: 顺带取走产物入包(探险同款即时回报), 烧炼照跑(面板只是回显) */
  ShowroomMode.sr.panel.close();
  assert.ok(!ShowroomMode.sr.isOpen(), '面板收起');
  f = ShowroomMode.sr.furnaces.get(key);
  assert.strictEqual(f.out, null, '关面板取走产物(炉内不积压)');
  assert.strictEqual(api.count(ShowroomMode.getInv(), 'iron_ingot'), 5, '产物入包(对照样 4 + 新锭 1)');
  ShowroomMode.update(2.5);
  f = ShowroomMode.sr.furnaces.get(key);
  assert.deepStrictEqual(f.out, {id: 'iron_ingot', n: 1}, '面板关着照烧: 结转的 0.1s+2.5s 再出 1 锭');
  assert.deepStrictEqual(f.input, {id: 'iron_ore', n: 14}, '待烧料继续 −1');
});

test('体验馆: 边界口径与探险一致 — 无热无料暂停进度保留(不白烧) · 产物槽异 id 占满停炉待取', () => {
  freshEnter();
  const key = api.blockKey(SR_FURNACE.x, SR_FURNACE.y, SR_FURNACE.z);
  /* 断档: 半件在手 + 炉冷无燃料 → 暂停, prog/heat 原样保留(spec 故事 11) */
  ShowroomMode.sr.furnaces.set(key, {input: {id: 'iron_ore', n: 2}, fuel: null,
    out: null, heat: 0, prog: 1.2});
  ShowroomMode.update(0.1);
  let f = ShowroomMode.sr.furnaces.get(key);
  assert.ok(Math.abs(f.prog - 1.2) < 1e-9, '暂停期进度原样(1.2s 不清零不白烧)');
  assert.deepStrictEqual(f.input, {id: 'iron_ore', n: 2}, '暂停不耗料');
  /* 补燃料后从原进度续烧(断档续烧边界, 复现的就是探险行为) */
  f.fuel = {id: 'coal', n: 1};
  ShowroomMode.update(0.5);
  f = ShowroomMode.sr.furnaces.get(key);
  assert.ok(f.prog > 1.2, '复燃后续烧(进度接上, prog=' + f.prog.toFixed(2) + ')');
  /* 异 id 占满: 产物槽躺着铁锭, 金矿烧满也不出锭(MC 阻塞口径, spec 故事 10) */
  ShowroomMode.sr.furnaces.set(key, {input: {id: 'gold_ore', n: 1}, fuel: {id: 'coal', n: 1},
    out: {id: 'iron_ingot', n: 1}, heat: 4, prog: 0});
  ShowroomMode.update(3);
  f = ShowroomMode.sr.furnaces.get(key);
  assert.deepStrictEqual(f.input, {id: 'gold_ore', n: 1}, '产物槽被异 id 占满: 停炉待取, 金矿不耗');
  assert.deepStrictEqual(f.out, {id: 'iron_ingot', n: 1}, '产物槽不被顶掉');
});

test('体验馆: 退出收场 — cleanup 三笔全额退包(零损耗) + 炉态清空 + 再进场干净初始态', () => {
  freshEnter();
  const hit = {x: SR_FURNACE.x, y: SR_FURNACE.y, z: SR_FURNACE.z};
  ShowroomMode.onMouse(2, hit);
  ShowroomMode.sr.autoFill(); /* iron_ore×16 + coal×2 入炉 */
  ShowroomMode.update(2.6); /* 烧 1 锭: 炉内 input 15 / fuel 1 / out 1 */
  ShowroomMode.sr.panel.close(); /* 产物即时入包: 包 iron_ingot 5, 炉 out 清空 */
  ShowroomMode.update(2.5); /* 再烧 1 锭在炉: input 14 / fuel 1 / out 1 */
  ShowroomMode.cleanup(); /* 退出: 三笔(14 铁 + 1 煤 + 1 锭)全额退包 */
  assert.strictEqual(api.count(ShowroomMode.getInv(), 'iron_ore'), 14, '待烧料退回背包');
  assert.strictEqual(api.count(ShowroomMode.getInv(), 'coal'), 15, '燃料退回背包(14 + 炉内 1)');
  assert.strictEqual(api.count(ShowroomMode.getInv(), 'iron_ingot'), 6, '产物退回背包(5 + 炉内 1)');
  assert.strictEqual(ShowroomMode.sr.furnaces.size, 0, '炉态 Map 清空(纯内存, 退出即清)');
  assert.ok(!ShowroomMode.sr.isOpen(), '面板状态收起');
  assert.strictEqual(dropCalls.length, 0, '常规路径三笔零损耗全额入包, 不落任何掉落物');
  /* 再进场: 干净初始态(炉态/背包照表重铸, spec 故事 17) */
  freshEnter();
  assert.strictEqual(ShowroomMode.sr.furnaces.size, 0, '重进场炉态干净');
  assert.strictEqual(api.count(ShowroomMode.getInv(), 'iron_ore'), 16, '背包照表重铸');
});

test('体验馆: 满包退出 — 余量静默丢弃不落掉落物(主循环切模同拍清场, 落地即蒸发)', () => {
  freshEnter();
  const inv = ShowroomMode.getInv();
  /* 铺满背包: 三笔相关堆叠顶到 64 上限 + 剩余空槽塞杂项 → 退炉任何一笔都无处可去 */
  api.add(inv, 'iron_ore', 64 - 16);
  api.add(inv, 'coal', 64 - 16);
  api.add(inv, 'iron_ingot', 64 - 4);
  for (const id of ['diamond', 'apple', 'bread', 'bone']) api.add(inv, id, 1);
  assert.strictEqual(inv.slots.filter(Boolean).length, api.INV_SLOTS, '满包前提: 27 槽全占');
  const key = api.blockKey(SR_FURNACE.x, SR_FURNACE.y, SR_FURNACE.z);
  ShowroomMode.sr.furnaces.set(key, {input: {id: 'iron_ore', n: 2}, fuel: {id: 'coal', n: 1},
    out: {id: 'iron_ingot', n: 1}, heat: 3, prog: 1});
  dropCalls.length = 0;
  ShowroomMode.cleanup();
  assert.strictEqual(api.count(inv, 'iron_ore'), 64, '满包: 待烧料无处入包 → 静默丢弃(数量不动)');
  assert.strictEqual(api.count(inv, 'coal'), 64, '满包: 燃料无处入包 → 静默丢弃');
  assert.strictEqual(api.count(inv, 'iron_ingot'), 64, '满包: 产物无处入包 → 静默丢弃');
  assert.strictEqual(dropCalls.length, 0, '余量不产生任何掉落物调用(dev 调试场降噪口径, 与取产物满包静默留炉同款)');
  assert.strictEqual(ShowroomMode.sr.furnaces.size, 0, '炉态 Map 照清(退出即清)');
});
