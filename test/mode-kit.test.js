'use strict';
/* ModeKit 单测 — node --test (零依赖)
   运行: node --test test/mode-kit.test.js
   mkHotbar 经 doc/mount 注入假 DOM; 引擎全局(pos/vel/yaw…)以属性占位注入 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ModeKit = require('../js/mode-kit.js');
const {mkMode, mkHotbar, mkCraftPanel, mkFurnacePanel, mkChestPanel, sortInv, confirmBtn, spawn} = ModeKit;

function fakeEl() {
  const el = {
    children: [], _cls: new Set(), _ev: {}, style: {}, dataset: {}, textContent: '',
    addEventListener(type, fn) {
      el._ev[type] = fn; // 记录监听器, 供测试手动派发(T10 面板点击/长按)
    },
    appendChild(c) {
      c.parentNode = this; // 面板挂载幂等判定用(T10)
      this.children.push(c); return c;
    },
    removeChild(c) {
      c.parentNode = null;
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    querySelector(sel) {
      if (!this['q_' + sel]) this['q_' + sel] = fakeEl(); return this['q_' + sel];
    },
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', { // 赋值覆盖子节点(对齐真 DOM 覆盖语义)
    get: () => html,
    set: (v) => {
      html = String(v);
      el.children.length = 0; // 解析不出元素, 但至少清掉 appendChild 的旧子节点
    },
  });
  Object.defineProperty(el, 'className', { // 赋值同步 _cls(对齐真 DOM className↔classList)
    get: () => [...el._cls].join(' '),
    set: (v) => {
      el._cls.clear();
      String(v).split(/\s+/).filter(Boolean).forEach((c) => el._cls.add(c));
    },
  });
  Object.defineProperty(el, 'classList', {value: {
    add: (c)=>el._cls.add(c), remove: (c)=>el._cls.delete(c),
    toggle: (c, v)=>{
      const on = (v === undefined) ? !el._cls.has(c) : v; if (on) el._cls.add(c); else el._cls.delete(c);
    },
    contains: (c)=>el._cls.has(c),
  }});
  return el;
}
const fakeDoc = {createElement: () => fakeEl()};

/* 面板用 doc: body 也是 fakeEl(挂载/卸载可观测) */
function mkDoc() {
  return {createElement: () => fakeEl(), body: fakeEl()};
}

/* 按 class 递归收集子树元素(fakeEl 无 querySelectorAll, 测试自遍历) */
function collect(el, cls, out) {
  out = out || [];
  if (el._cls && el._cls.has(cls)) out.push(el);
  (el.children || []).forEach((c) => collect(c, cls, out));
  return out;
}

/* —— 合成/背包/物品核心真件(vm 装载挂全局): 面板测试走真匹配/真扣料/真摆入,
      桩只留 icons/button-icons/hint 等 UI 侧自持件 —— */
{
  const ctx = vm.createContext({console});
  for (const f of ['items-core.js', 'inventory-core.js', 'craft-core.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext(`globalThis.__g = {ITEMS, toolOf, stackMax, durOf, costEntry, shapeCost, canCraft,
    matchGrid, gridCraft, fillGrid, remove, add, count, take, mkInventory, mkStack, RECIPES};`, ctx);
  const g = ctx.__g;
  for (const k of Object.keys(g)) globalThis[k] = g[k];
}
globalThis.HOTBAR_SLOTS = 9; // 常量直挂(真件经 vm realm 取不到 const)

/* 面板测试配方桩(crafting-grid §3 shape 形状; recipes 注入面板) */
const R_PLANKS = {id: 'planks', out: {item: 'planks', n: 4}, station: 'hand', shape: {rows: [['log']]}};
const R_PICK = {id: 'pick_wood', out: {item: 'pick_wood', n: 1}, station: 'table',
  shape: {rows: [['planks', 'planks', 'planks'], [null, 'stick', null], [null, 'stick', null]]}};
const R_TORCH = {id: 'torch', out: {item: 'torch', n: 4}, station: 'hand',
  shape: {rows: [[['coal', 'charcoal']], ['stick']]}};

/* mode-kit 引用的自由变量 → 测试注入全局属性 (浏览器里来自 world.js/input.js) */
globalThis.pos = {set(x, y, z) {
  this.v = [x, y, z];
}};
globalThis.vel = {set(x, y, z) {
  this.v = [x, y, z];
}};
globalThis.yaw = 0; globalThis.pitch = 0; globalThis.onGround = true;

/* T10 item 槽/面板引用的自由变量 → UI 侧全局桩(浏览器里来自 icons.js;
   ITEMS/toolOf/stackMax/durOf 等数据件已由上方真核心装载提供) */
globalThis.iconOf = (id) => (id === 'planks' ? 'data:image/png;base64,AA' : '🥓');
/* 按钮像素图标(button-icons.js)引用的自由变量 → 全局桩(面板标题/页签/徽标) */
globalThis.btnImg = (n) => '<img class="bi" data-btn="' + n + '" alt="" src="data:image/png;base64,BB">';

/* 物品提示(item-hint-registry.js)引用的自由变量 → 全局桩: 缺省 null = 静默
   (镜像 mode-kit 的 typeof 守卫缺装口径), 提示行为断言用例内临时覆写后还原 */
globalThis.hintForSlot = () => null;
globalThis.hintForItem = () => null;
let pausedN = 0;
globalThis.uiPause = ()=>{
  pausedN++;
};
let touchList = 'unset';
globalThis.setTouchActions = (l)=>{
  touchList = l;
}; /* 过渡别名回落路径桩(Input 桩缺装时 mkMode 才走到) */
/* input.js 的 Input 命名空间桩: mkMode 触屏声明与 mkHeldSync 图标刷新的
   正式路径(引擎缝收口); refreshMain 记录主动作键图标切换供断言 */
const mainIconLog = [];
globalThis.Input = {
  setActions(l) {
    touchList = l;
  },
  refreshMain(icon, label) {
    mainIconLog.push([icon, label]);
  },
};

/* 怪物库桩(mkMobPicker 经全局名调用期解析; 口径同 test/tank-mode.test.js
   的 fake 怪物库: types/face/families 三件, families 镜像真库主族归组) */
globalThis.Mobs = {
  types: {zombie: {name: '僵尸', family: ['zombie_line']}, husk: {name: '尸壳', family: ['zombie_line']},
    skeleton: {name: '骷髅', family: ['skeleton_line']}, creeper: {name: '苦力怕'}},
  face: (k) => 'data:face:' + k,
  families() {
    const buckets = {};
    for (const k of Object.keys(this.types)) {
      const fam = (this.types[k].family || [])[0] || 'lone';
      (buckets[fam] = buckets[fam] || []).push(k);
    }
    return Object.keys(buckets).map((key) => ({key, name: key, members: buckets[key]}));
  },
};

/* ============ hotbar 选块状态机 ============ */

test('hotbar: 数字键选块(1-based), 越界忽略', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}, {icon: 'b'}, {icon: 'c'}]});
  hb.show();
  assert.strictEqual(mount.children.length, 3);
  const mode = mkMode({id: 'x', hotbar: hb});
  mode.onDigit(2);
  assert.strictEqual(hb.sel, 1);
  mode.onDigit(9); // 越界 → 忽略
  assert.strictEqual(hb.sel, 1);
});

test('hotbar: 滚轮双向环绕', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}, {icon: 'b'}, {icon: 'c'}]});
  const mode = mkMode({id: 'x', hotbar: hb});
  mode.onWheel(1); mode.onWheel(1);
  assert.strictEqual(hb.sel, 2);
  mode.onWheel(1); // 2→0 环绕
  assert.strictEqual(hb.sel, 0);
  mode.onWheel(-1); // 0→2 反向环绕
  assert.strictEqual(hb.sel, 2);
});

test('hotbar: cnt 实时重读与 empty 态', () => {
  const mount = fakeEl();
  let n = 0;
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: '🧵', lbl: '引线', cnt: ()=>n}]});
  hb.show();
  const slot = mount.children[0];
  assert.ok(slot._cls.has('empty')); // 0 库存 → empty
  n = 5;
  hb.refresh();
  assert.strictEqual(slot['q_.cnt'].textContent, 5);
  assert.ok(!slot._cls.has('empty'));
});

/* ============ T10 item 槽型: 像素图标+数量+耐久条 ============ */

test('item 槽: dataURL 喂 img.src / emoji 文本喂 icon / 名称走 ITEMS', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount,
    items: [{item: 'planks'}, {item: 'rotten_flesh'}]});
  hb.show();
  const pixHtml = mount.children[0].innerHTML;
  assert.ok(pixHtml.includes('<img class="pic"')); // data: 前缀 → <img>
  assert.ok(pixHtml.includes('src="data:image/png;base64,AA"'));
  assert.ok(pixHtml.includes('木板')); // lbl 取 ITEMS[id].name
  const emoHtml = mount.children[1].innerHTML;
  assert.ok(emoHtml.includes('<span class="icon">🥓')); // 文本 → icon span, 不造 img
  assert.ok(!emoHtml.includes('<img'));
});

test('item 槽: refresh 重读数量(>1 才显)与耐久条宽/档位, 归零 empty', () => {
  const mount = fakeEl();
  let n = 1; let r = 0.75;
  const hb = mkHotbar({doc: fakeDoc, mount,
    items: [{item: 'pick_wood', cnt: () => n, dur: () => r}]});
  hb.show();
  const slot = mount.children[0];
  const fill = slot['q_.dur i'];
  assert.strictEqual(slot['q_.cnt'].textContent, ''); // 单件工具不显数量
  assert.strictEqual(fill.style.width, '75%');
  assert.ok(fill._cls.has('bar-hi')); // ≥50% 绿档
  n = 5; r = 0.3;
  hb.refresh();
  assert.strictEqual(slot['q_.cnt'].textContent, '5');
  assert.strictEqual(fill.style.width, '30%');
  assert.ok(fill._cls.has('bar-mid')); // 25%~50% 黄档
  n = 0; r = 0.1;
  hb.refresh();
  assert.ok(slot._cls.has('empty')); // 数量归零 → empty 态
  assert.strictEqual(fill.style.width, '10%');
  assert.ok(fill._cls.has('bar-lo')); // <25% 红档
});

/* ============ T10 sortInv: 一键整理(同项合并·首现序) ============ */

test('sortInv: 主格内同项合并·首现序稳定·工具耐久保留·快捷栏不动', () => {
  const realStackMax = globalThis.stackMax;
  globalThis.stackMax = (id) => ({planks: 64, cobble: 64, pick_wood: 1}[id] || 0);
  try {
    const inv = {slots: [
      ...Array(8).fill(null),
      {id: 'cobble', n: 5}, // 槽 8(快捷栏尾) — 快捷栏不参与整理
      {id: 'planks', n: 30}, {id: 'planks', n: 30}, // 槽 9/10 跨槽同项
      {id: 'pick_wood', n: 1, dur: 77}, // 槽 11 工具带耐久
      ...Array(15).fill(null),
    ]};
    sortInv(inv);
    assert.deepStrictEqual(inv.slots[8], {id: 'cobble', n: 5}); // 快捷栏原位不动
    assert.deepStrictEqual(inv.slots[9], {id: 'planks', n: 60}); // 主格首格合并一整堆
    assert.deepStrictEqual(inv.slots[10], {id: 'pick_wood', n: 1, dur: 77}); // 耐久随堆保留
    assert.strictEqual(inv.slots.filter((x) => x).length, 3); // 主格空槽压到尾部
  } finally {
    globalThis.stackMax = realStackMax; /* 还真件: 桩不外溢(摆放台上限用例走真 stackMax) */
  }
});

/* ============ T10 mkCraftPanel: 挂载/网格 ============ */

test('craft 面板: 挂载/卸载幂等 + 背包网格 18 主格+9 快捷镜像+摆放台 9 格', () => {
  const doc = mkDoc();
  const inv = {slots: [
    ...Array(9).fill(null), {id: 'planks', n: 12}, ...Array(17).fill(null),
  ]};
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
  panel.show();
  panel.show(); // 再挂 → 不重复
  assert.strictEqual(doc.body.children.length, 1);
  const cells = collect(panel.root, 'mkp-cell');
  assert.strictEqual(cells.length, 36); // 18 主格 + 9 快捷镜像 + 摆放台 3×3(DOM 序: 摆放台在后)
  assert.ok(cells[0].innerHTML.includes('data:image/png;base64,AA')); // 主格首格 = 槽 9 的木板
  assert.ok(collect(panel.root, 'mkp-quest').length === 1); // 任务卡占位容器(T15 填)
  assert.strictEqual(collect(panel.root, 'mkp-oslot').length, 1); // 产出槽(crafting-grid §5)
  panel.remove();
  panel.remove(); // 再卸 → 幂等
  assert.strictEqual(doc.body.children.length, 0);
});

test('craft 面板: 🧹 整理按钮 → sortInv 就地合并 + onSort 通知 + 网格重画', () => {
  const doc = mkDoc();
  const inv = {slots: [
    ...Array(9).fill(null), {id: 'planks', n: 30}, {id: 'planks', n: 30}, ...Array(16).fill(null),
  ]};
  let sorted = 0;
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onSort() {
    sorted++;
  }});
  panel.show();
  collect(panel.root, 'mkp-sort')[0].onclick();
  assert.deepStrictEqual(inv.slots[9], {id: 'planks', n: 60}); // 主格首格合并
  assert.strictEqual(sorted, 1);
  const cells = collect(panel.root, 'mkp-cell');
  assert.ok(cells[0].innerHTML.includes('60')); // 主格首格已重画(网格顺序=槽 9 起)
  panel.remove();
});

/* ============ 背包格点选搬运: 起手高亮 → 点目标格 onMove(无拖拽) ============ */

test('craft 面板: 点非空格起手高亮(pick 类), 点目标格 → onMove(from,to) + 收高亮', () => {
  const doc = mkDoc();
  const inv = {slots: [
    {id: 'planks', n: 12}, ...Array(26).fill(null), // 快捷栏槽 0 占位, 其余空
  ]};
  const moves = [];
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onMove(from, to) {
    moves.push([from, to]);
  }});
  panel.show();
  collect(panel.root, 'mkp-cell')[18].onclick(); // 快捷镜像首格 = 槽 0: 起手
  let cells = collect(panel.root, 'mkp-cell'); // refresh 重建, 重取
  assert.ok(cells[18]._cls.has('pick'), '起手格高亮');
  cells[0].onclick(); // 主格首格 = 槽 9(空位): 搬去那里
  assert.deepStrictEqual(moves, [[0, 9]], 'onMove 报模式层执行(空位/并堆/对调政策不在面板)');
  cells = collect(panel.root, 'mkp-cell');
  assert.ok(!cells[18]._cls.has('pick'), '搬运后收高亮');
  panel.remove();
});

test('craft 面板: 搬运边界 — 再点原格=放下, 无起手点空格=无效, 均不触发 onMove', () => {
  const doc = mkDoc();
  const inv = {slots: [
    {id: 'planks', n: 12}, ...Array(26).fill(null),
  ]};
  const moves = [];
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onMove(from, to) {
    moves.push([from, to]);
  }});
  panel.show();
  collect(panel.root, 'mkp-cell')[18].onclick(); // 槽 0 起手
  collect(panel.root, 'mkp-cell')[18].onclick(); // 再点原格 → 放下
  assert.deepStrictEqual(moves, []);
  assert.ok(!collect(panel.root, 'mkp-cell')[18]._cls.has('pick'), '放下后无高亮');
  collect(panel.root, 'mkp-cell')[3].onclick(); // 无起手 + 空格 → 无事
  collect(panel.root, 'mkp-cell')[19].onclick(); // 无起手 + 空格(快捷镜像) → 无事
  assert.deepStrictEqual(moves, []);
  panel.remove();
});

test('craft 面板: onMove 后整幅重画反映搬移结果(面板只重读 inv, 搬移在模式层)', () => {
  const doc = mkDoc();
  const inv = {slots: [
    ...Array(9).fill(null), {id: 'planks', n: 12}, ...Array(17).fill(null), // 槽 9 有货
  ]};
  /* 模式层口径的最小搬移(镜像 moveSlot 空位语义): 整摞搬去空位 */
  const move = (from, to) => {
    inv.slots[to] = inv.slots[from];
    inv.slots[from] = null;
  };
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onMove: move});
  panel.show();
  collect(panel.root, 'mkp-cell')[0].onclick(); // 槽 9 起手
  collect(panel.root, 'mkp-cell')[5].onclick(); // 搬去槽 14
  const cells = collect(panel.root, 'mkp-cell'); // DOM 序: 主格 18 格在前, 快捷镜像 9 格在后
  assert.ok(!cells[0].innerHTML.includes('data:image'), '槽 9 已腾空');
  assert.ok(cells[5].innerHTML.includes('data:image/png;base64,AA'), '槽 14 收到木板');
  panel.remove();
});

test('craft 面板: 🧹 整理收起搬运起手(主格重排后起手槽号失义) + 关面板收手', () => {
  const doc = mkDoc();
  const inv = {slots: [ /* 槽 0/1 快捷栏 · 槽 18 主格(整理对象) */
    {id: 'planks', n: 12}, {id: 'planks', n: 30}, ...Array(16).fill(null),
    {id: 'planks', n: 30}, ...Array(8).fill(null),
  ]};
  const moves = [];
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onMove(from, to) {
    moves.push([from, to]);
  }});
  panel.show();
  collect(panel.root, 'mkp-cell')[18].onclick(); // 槽 0 起手
  collect(panel.root, 'mkp-sort')[0].onclick(); // 整理 → 收起手
  assert.ok(!collect(panel.root, 'mkp-cell')[18]._cls.has('pick'), '整理后无高亮');
  assert.deepStrictEqual(moves, [], '整理不是搬运');
  collect(panel.root, 'mkp-cell')[18].onclick(); // 重新起手
  panel.close(); // 关面板 → 下次打开不带旧高亮
  panel.show();
  assert.ok(!collect(panel.root, 'mkp-cell')[18]._cls.has('pick'), '重开无残留高亮');
  panel.remove();
});

/* ============ T10 配方卡: 形状 + 过滤 ============ */

test('craft 面板: 卡片=产物大图+×数量+材料chip×数+站点徽标, 任选材料逐候选', () => {
  const doc = mkDoc();
  /* 备齐三卡材料(齐料亮卡, chip 无 lack 类可精确计数) */
  const inv = {slots: [
    ...Array(9).fill(null), {id: 'log', n: 2}, {id: 'planks', n: 5}, {id: 'stick', n: 3},
    {id: 'coal', n: 1}, ...Array(13).fill(null),
  ]};
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS, R_PICK, R_TORCH], onCraft() {}});
  panel.show();
  const cards = collect(panel.root, 'mkp-card');
  assert.strictEqual(cards.length, 3);
  const planksCard = cards[0];
  assert.ok(planksCard.innerHTML.includes('src="data:image/png;base64,AA"')); // 产物像素大图
  assert.ok(planksCard.innerHTML.includes('×4')); // 产物数量
  assert.ok(!planksCard.innerHTML.includes('data-btn="table"')); // hand 级无徽标
  assert.strictEqual((planksCard.innerHTML.match(/class="mkp-chip"/g) || []).length, 1); // log×1
  const pickCard = cards[1];
  assert.ok(pickCard.innerHTML.includes('data-btn="table"')); // table 级徽标(像素图标桩标记)
  assert.strictEqual((pickCard.innerHTML.match(/class="mkp-chip"/g) || []).length, 2); // planks + stick
  assert.ok(pickCard.innerHTML.includes('×3'));
  const torchCard = cards[2];
  assert.strictEqual((torchCard.innerHTML.match(/class="mkp-chip"/g) || []).length, 3); // 任选 coal/charcoal + stick
  panel.remove();
});

test('craft 面板: bread/bone_meal/bow_item 默认过滤, opts.allow 放开', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const hidden = ['bread', 'bone_meal', 'bow_item'].map((id) => (
    {id, out: {item: id, n: 1}, station: 'table', shape: {rows: [['wheat'], ['wheat'], ['wheat']]}}));
  const p1 = mkCraftPanel({doc, inv, recipes: [...hidden, R_PLANKS], onCraft() {}});
  p1.show();
  assert.strictEqual(collect(p1.root, 'mkp-card').length, 1); // 只剩 planks
  p1.remove();
  const p2 = mkCraftPanel({doc, inv, recipes: [...hidden, R_PLANKS], allow: ['bread'], onCraft() {}});
  p2.show();
  assert.strictEqual(collect(p2.root, 'mkp-card').length, 2); // bread 放开
  p2.remove();
});

/* ============ T10 卡片亮灰: canCraft(真件)驱动 ============ */

test('craft 面板: 缺料→卡片 dim+chip lack(have/need), 补料刷新恢复亮', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
  panel.show();
  let card = collect(panel.root, 'mkp-card')[0];
  assert.ok(card._cls.has('dim')); // 空背包缺原木 → 整卡灰(真 canCraft 驱动)
  assert.ok(card.innerHTML.includes('class="mkp-chip lack"')); // 缺的材料灰显
  assert.ok(card.innerHTML.includes('>0/1<')); // have/need 计数
  inv.slots[9] = {id: 'log', n: 1}; // 模式层入包路径的等价直改(背包引用共享)
  panel.refresh();
  card = collect(panel.root, 'mkp-card')[0];
  assert.ok(!card._cls.has('dim'));
  assert.ok(!card.innerHTML.includes('lack'));
  panel.remove();
});

test('craft 面板: 站点外只列 hand 级卡(正典配方书口径), 近台全列 + 外圈锁格', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS, R_PICK],
    station: () => false, onCraft() {}});
  panel.show();
  assert.strictEqual(collect(panel.root, 'mkp-card').length, 1, '站点外: table 卡不列, hand 卡在列');
  assert.ok(collect(panel.root, 'mkp-card')[0].dataset.recipe === 'planks');
  const bench = collect(panel.root, 'mkp-cell').slice(27); // 摆放台 9 格(DOM 序在后)
  assert.strictEqual(bench.filter((c) => c._cls.has('lock')).length, 5, '外圈 5 格锁定(左上 2×2 激活)');
  assert.ok(bench[2]._cls.has('lock') && !bench[4]._cls.has('lock'), '下标 2 锁/4 激活');
  assert.strictEqual(typeof bench[2].onclick, 'undefined', '锁定格不接点击(无搬入)');
  panel.close();
  const panel2 = mkCraftPanel({doc, inv, recipes: [R_PLANKS, R_PICK], onCraft() {}});
  panel2.show(); // 缺省 station 恒 true
  assert.strictEqual(collect(panel2.root, 'mkp-card').length, 2, '近台: 全列');
  assert.strictEqual(collect(panel2.root, 'mkp-cell').slice(27).filter((c) => c._cls.has('lock')).length, 0);
  panel2.remove();
  panel.remove();
});

/* ============ 摆放台交互(crafting-grid §5): 点选搬运入格 · BE 一键摆入 · 产出槽 ============ */

test('craft 面板: 点背包格→摆放格整摞入格(真 remove 扣槽)+onGridMove; 异种拒绝收手不散', () => {
  const doc = mkDoc();
  const inv = {slots: [
    ...Array(9).fill(null), {id: 'planks', n: 12}, {id: 'log', n: 3}, ...Array(16).fill(null),
  ]};
  let gridMoves = 0;
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {},
    onGridMove() {
      gridMoves++;
    }});
  panel.show();
  collect(panel.root, 'mkp-cell')[0].onclick(); // 主格首格(槽 9)起手
  collect(panel.root, 'mkp-cell')[27].onclick(); // 摆放台格 0: 整摞入格
  assert.strictEqual(inv.slots[9], null, 'remove 真扣整摞');
  let all = collect(panel.root, 'mkp-cell');
  assert.ok(all[27].innerHTML.includes('12'), '摆放格显示 12 件');
  assert.strictEqual(gridMoves, 1);
  // 异种拒绝: 起 log 点已有 planks 的格 0
  all[1].onclick(); // 槽 10(log)起手
  collect(panel.root, 'mkp-cell')[27].onclick(); // 格 0 异种 → 拒绝
  assert.ok(inv.slots[10] && inv.slots[10].id === 'log', '异种拒绝: 原槽不动');
  assert.strictEqual(gridMoves, 1, '拒绝不算搬');
  all = collect(panel.root, 'mkp-cell');
  assert.ok(all[1]._cls.has('pick'), '起手保留(收手不散)');
  panel.remove();
});

test('craft 面板: 工具/可耗损物不入格(durOf>0 拒绝, 避开耐久重铸)', () => {
  const doc = mkDoc();
  const inv = {slots: [
    ...Array(9).fill(null), {id: 'pick_wood', n: 1, dur: 120}, ...Array(17).fill(null),
  ]};
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
  panel.show();
  collect(panel.root, 'mkp-cell')[0].onclick(); // 工具起手
  collect(panel.root, 'mkp-cell')[27].onclick(); // 摆放格 → 拒绝
  assert.deepStrictEqual({...inv.slots[9]}, {id: 'pick_wood', n: 1, dur: 120}, '工具原槽不动');
  const bench = collect(panel.root, 'mkp-cell')[27];
  assert.strictEqual(bench.innerHTML, '', '摆放格保持空');
  panel.remove();
});

test('craft 面板: 摆放格→背包格整摞退回(真 add 收包); 格→格并堆', () => {
  const doc = mkDoc();
  const inv = {slots: [
    ...Array(9).fill(null), {id: 'planks', n: 12}, ...Array(17).fill(null),
  ]};
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
  panel.show();
  collect(panel.root, 'mkp-cell')[0].onclick(); // 槽 9 起手
  collect(panel.root, 'mkp-cell')[27].onclick(); // 入格 0(12 件)
  collect(panel.root, 'mkp-cell')[27].onclick(); // 格 0 起手
  collect(panel.root, 'mkp-cell')[5].onclick(); // 点背包格 → 整摞退回
  assert.deepStrictEqual({...inv.slots[0]}, {id: 'planks', n: 12}, 'add 收包落首个空位(快捷栏槽 0)');
  assert.strictEqual(collect(panel.root, 'mkp-cell')[27].innerHTML, '', '格 0 已腾空');
  // 同种并堆: 先入一摞, 再从背包入第二摞(堆叠上限经 stackMax(items-core), 12+12=24)
  inv.slots[9] = {id: 'planks', n: 12}; /* 模式层等价直改回填 */
  collect(panel.root, 'mkp-cell')[0].onclick(); // 槽 9 起手
  collect(panel.root, 'mkp-cell')[27].onclick(); // 入格 0(12 件)
  inv.slots[10] = {id: 'planks', n: 12};
  collect(panel.root, 'mkp-cell')[1].onclick(); // 槽 10 起手
  collect(panel.root, 'mkp-cell')[27].onclick(); // 再入格 0 → 并堆
  assert.ok(collect(panel.root, 'mkp-cell')[27].innerHTML.includes('24'),
      '同种并堆到 24(入格容量走 stackMax, 64 魔数已清零)');
  assert.strictEqual(panel.cellAt(9), null, '查询面 cellAt: 槽 9 已整摞入格');
  panel.remove();
});

test('craft 面板: 点卡=BE 一键摆入(真 fillGrid) → 产出槽亮 → 点击一发 onCraft', () => {
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'log', n: 2}, ...Array(17).fill(null)]};
  const outs = [];
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft(out) {
    outs.push(out);
  }});
  panel.show();
  collect(panel.root, 'mkp-card')[0].onclick(); // 点卡 = 一键摆入(拍板③)
  assert.deepStrictEqual({...inv.slots[9]}, {id: 'log', n: 1}, 'fillGrid 真扣背包 1 件');
  const bench = collect(panel.root, 'mkp-cell')[27];
  assert.ok(bench.innerHTML.includes('🥓'), '原木 1 件入格 0(单件不显数量, emoji 图标)');
  let out = collect(panel.root, 'mkp-oslot')[0];
  assert.ok(out._cls.has('on'), '摆对图案 → 产出槽亮(预览 planks ×4)');
  out._ev.pointerdown({preventDefault() {}});
  out._ev.pointerup(); // 短按 → 合成一发
  assert.deepStrictEqual(outs, [{item: 'planks', n: 4, leftover: 0}]);
  out = collect(panel.root, 'mkp-oslot')[0];
  assert.ok(out._cls.has('off'), '格扣空 → 产出槽复灰');
  // 摆空点产出槽: 不合成, 不炸
  out._ev.pointerdown({preventDefault() {}});
  out._ev.pointerup();
  assert.strictEqual(outs.length, 1);
  panel.remove();
});

test('craft 面板: 重复点卡=再备一套, 产出槽长按连做 0.3s/发至材料尽(拍板④)', (t) => {
  t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'log', n: 2}, ...Array(17).fill(null)]};
  const outs = [];
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft(out) {
    outs.push(out);
  }});
  panel.show();
  collect(panel.root, 'mkp-card')[0].onclick(); // 备第一套
  collect(panel.root, 'mkp-card')[0].onclick(); // 再点 = 备第二套(格 0 n=2)
  const bench = collect(panel.root, 'mkp-cell')[27];
  assert.ok(bench.innerHTML.includes('2'), '两套备料');
  const out = collect(panel.root, 'mkp-oslot')[0]; /* 产出槽不随 refresh 重建 */
  out._ev.pointerdown({preventDefault() {}});
  t.mock.timers.tick(399); // 不足 0.4s: 不合成
  assert.strictEqual(outs.length, 0);
  out._ev.pointerup(); // 短按松开 → 一发
  assert.strictEqual(outs.length, 1);

  out._ev.pointerdown({preventDefault() {}});
  t.mock.timers.tick(400); // 0.4s → 连做启动: 立即一发
  assert.strictEqual(outs.length, 2);
  t.mock.timers.tick(300); // 第三发: 格已空 → nomatch 自动停
  assert.strictEqual(outs.length, 2);
  t.mock.timers.tick(900);
  assert.strictEqual(outs.length, 2, '停后不再连发');
  out._ev.pointerup();
  panel.remove();
});

test('craft 面板: 关面板格内材料退回背包; 满包装不下经 onReturnLeft 报掉落(零惩罚)', () => {
  const doc = mkDoc();
  const inv = {slots: Array.from({length: 27}, (v, i) => (
    i === 26 ? {id: 'log', n: 1} : {id: 'stone', n: 64}))}; // 全满只留 1 原木
  const lefts = [];
  let closed = false;
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {},
    onReturnLeft(l) {
      lefts.push(l);
    }, onClose() {
      closed = true;
    }});
  panel.show();
  collect(panel.root, 'mkp-cell')[17].onclick(); // 主格末格(槽 26 log)起手
  collect(panel.root, 'mkp-cell')[27].onclick(); // 入摆放格
  assert.strictEqual(inv.slots[26], null);
  inv.slots[26] = {id: 'stone', n: 64}; // 模拟期间模式层填满该槽(熔炉产物入包等)
  panel.close(); // 关面板 → 退料: 满包 add 拒收 → onReturnLeft
  assert.deepStrictEqual(lefts, [[{id: 'log', n: 1}]]);
  assert.strictEqual(closed, true, '退料不打断 onClose 链');
  panel.remove();
  // 非满包: 退回背包, 不触发 onReturnLeft
  const inv2 = {slots: [...Array(27).fill(null)]};
  inv2.slots[9] = {id: 'log', n: 1};
  const lefts2 = [];
  const p2 = mkCraftPanel({doc, inv: inv2, recipes: [R_PLANKS], onCraft() {},
    onReturnLeft(l) {
      lefts2.push(l);
    }});
  p2.show();
  collect(p2.root, 'mkp-cell')[0].onclick();
  collect(p2.root, 'mkp-cell')[27].onclick(); // 入格
  p2.close();
  assert.deepStrictEqual(lefts2, [], '装得下: 静默退包');
  assert.deepStrictEqual({...inv2.slots[0]}, {id: 'log', n: 1}, '原木回包(add 落首个空位)');
  p2.remove();
});

/* ============ T10 分类页签(图标式: 全部/工具/食物/方块) ============ */

test('craft 面板: 页签过滤 — 工具/食物/方块各归其页, 材料只在全部', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const recipes = [
    R_PLANKS, // planks(block) → 方块页
    R_PICK, // 工具
    {id: 'apple_hand', out: {item: 'apple', n: 1}, station: 'hand', shape: {rows: [['planks']]}}, // 食物
    {id: 'stick', out: {item: 'stick', n: 4}, station: 'hand', shape: {rows: [['planks'], ['planks']]}}, // 材料: 仅全部
  ];
  const panel = mkCraftPanel({doc, inv, recipes, onCraft() {}});
  panel.show();
  const tabs = collect(panel.root, 'mkp-tab');
  assert.strictEqual(tabs.length, 4); // grid/pick/apple/brick 像素图标式零文字
  assert.ok(tabs[0].innerHTML.includes('data-btn="grid"')); // 全部页签=物品格图标(桩标记)
  assert.strictEqual(collect(panel.root, 'mkp-card').length, 4); // 默认全部
  tabs[1].onclick(); // ⛏️ 工具
  assert.strictEqual(collect(panel.root, 'mkp-card').length, 1);
  assert.ok(collect(panel.root, 'mkp-card')[0].dataset.recipe === 'pick_wood');
  assert.ok(collect(panel.root, 'mkp-tab')[1]._cls.has('on')); // 当前页签高亮(重建后重取)
  tabs[2].onclick(); // 🍎 食物
  assert.strictEqual(collect(panel.root, 'mkp-card').length, 1);
  tabs[3].onclick(); // 🧱 方块
  assert.strictEqual(collect(panel.root, 'mkp-card').length, 1);
  assert.ok(collect(panel.root, 'mkp-card')[0].dataset.recipe === 'planks');
  tabs[0].onclick(); // 📦 全部(材料回归)
  assert.strictEqual(collect(panel.root, 'mkp-card').length, 4);
  panel.remove();
});

/* ============ T10 熔炉面板: 三槽 + 进度条 + 自动放料意图 ============ */

test('furnace 面板: 三槽渲染 + setProgress 进度条 + 挂载/卸载幂等', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const panel = mkFurnacePanel({doc, inv, onAutoFill() {}});
  panel.show();
  panel.show(); // 幂等
  assert.strictEqual(doc.body.children.length, 1);
  panel.setSlots({input: {id: 'iron_ore', n: 3}, fuel: {id: 'coal', n: 2},
    output: {id: 'iron_ingot', n: 1}});
  const slots = collect(panel.root, 'mkp-fslot');
  assert.strictEqual(slots.length, 3); // 料 / 燃料 / 产物
  const cells = collect(panel.root, 'mkp-cell'); // 三槽的格子(DOM 序: 料/燃料/产物)
  assert.ok(cells[0].innerHTML.includes('3'));
  assert.ok(cells[0].innerHTML.includes('🥓')); // iron_ore 图标(emoji 桩)
  assert.ok(cells[1].innerHTML.includes('2')); // 燃料 2 件
  assert.ok(!cells[2].innerHTML.includes('cnt')); // 产物 1 件: 不显数量
  panel.setProgress(0.5);
  assert.strictEqual(collect(panel.root, 'mkp-pfill')[0].style.width, '50%');
  panel.setProgress(2); // 越界钳制
  assert.strictEqual(collect(panel.root, 'mkp-pfill')[0].style.width, '100%');
  panel.remove();
  panel.remove(); // 幂等
  assert.strictEqual(doc.body.children.length, 0);
});

test('furnace 面板: 自动放料 plan — 矿石全放 + FUEL 序最省凑料, 只报意图不动包', () => {
  const doc = mkDoc();
  globalThis.smeltOf = (id) => ({iron_ore: 'iron_ingot', clay_ball: 'brick'}[id] || null);
  globalThis.FUEL = ['coal', 'log', 'planks', 'stick']; // 热值降序桩
  globalThis.fuelUnits = (id) => ({coal: 8, log: 1.5, planks: 1.5, stick: 0.5}[id] || 0);
  let plan = null;
  const inv = {slots: [
    ...Array(9).fill(null),
    {id: 'iron_ore', n: 3}, {id: 'clay_ball', n: 2}, // 可烧物 5 件
    {id: 'coal', n: 2}, {id: 'log', n: 5},
    ...Array(13).fill(null),
  ]};
  const panel = mkFurnacePanel({doc, inv, onAutoFill(p) {
    plan = p;
  }});
  panel.show();
  collect(panel.root, 'mkp-autofill')[0].onclick();
  assert.deepStrictEqual(plan.load, [ // 首现序, 烧炼产物随附
    {id: 'iron_ore', n: 3, out: 'iron_ingot'},
    {id: 'clay_ball', n: 2, out: 'brick'},
  ]);
  assert.deepStrictEqual(plan.fuel, [{id: 'coal', n: 1}]); // 煤 1 个(烧 8 件)已覆盖 5 件
  assert.strictEqual(plan.units, 8);
  assert.deepStrictEqual(inv.slots[9], {id: 'iron_ore', n: 3}); // 背包未动(意图口径)
  panel.remove();

  /* 无煤场景: 沿 FUEL 序用原木凑 — 5 件 ÷ 1.5/根 → 4 根 */
  const inv2 = {slots: [
    ...Array(9).fill(null), {id: 'iron_ore', n: 3}, {id: 'clay_ball', n: 2},
    {id: 'log', n: 5}, ...Array(14).fill(null),
  ]};
  let plan2 = null;
  const p2 = mkFurnacePanel({doc, inv: inv2, onAutoFill(p) {
    plan2 = p;
  }});
  p2.show();
  collect(p2.root, 'mkp-autofill')[0].onclick();
  assert.deepStrictEqual(plan2.fuel, [{id: 'log', n: 4}]);
  assert.strictEqual(plan2.units, 6); // 4×1.5
  p2.remove();
});

/* ============ F2 熔炉面板: 燃料余量条(设计稿 §2.2) ============ */

test('furnace 面板: setFuel 燃料余量条 — 宽度百分比 + 越界钳制 + 熄灭灰显切换', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const panel = mkFurnacePanel({doc, inv, onAutoFill() {}});
  panel.show();
  const fire = collect(panel.root, 'mkp-fire')[0];
  const ffill = collect(panel.root, 'mkp-ffill')[0];
  assert.ok(fire && ffill, '火焰复合件在位(火焰图 + 余量条)');
  panel.setFuel(0.5);
  assert.strictEqual(ffill.style.width, '50%');
  assert.strictEqual(fire.classList.contains('mkp-fire-out'), false, '燃烧中不灰显');
  panel.setFuel(2); // 越界钳制(热值可超单件: 换料残留)
  assert.strictEqual(ffill.style.width, '100%');
  panel.setFuel(0);
  assert.strictEqual(ffill.style.width, '0%');
  assert.strictEqual(fire.classList.contains('mkp-fire-out'), true, 'r≤0 熄灭灰显(无热且无燃料)');
  panel.setFuel(-1);
  assert.strictEqual(ffill.style.width, '0%'); // 负值同熄灭(钳制)
  assert.strictEqual(fire.classList.contains('mkp-fire-out'), true, '负值维持灰显');
  panel.setFuel(0.03); // 复燃
  assert.strictEqual(fire.classList.contains('mkp-fire-out'), false, '复燃去灰显');
  panel.remove();
});

/* ============ 熔炉面板: 背包区手动放入(2026-10-25 交互优化) ============ */

test('furnace 面板: 背包区常驻 — 27 格(18 主格+9 快捷镜像), 点击格报 onPut 意图不动包', () => {
  const doc = mkDoc();
  globalThis.smeltOf = (id) => (id === 'iron_ore' ? 'iron_ingot' : null);
  globalThis.fuelUnits = (id) => (id === 'coal' ? 8 : 0);
  const inv = {slots: [...Array(9).fill(null), {id: 'iron_ore', n: 3},
    ...Array(17).fill(null)]};
  const puts = [];
  const panel = mkFurnacePanel({doc, inv, onAutoFill() {}, onPut: (i) => puts.push(i)});
  panel.show();
  const cells = collect(panel.root, 'mkp-cell');
  assert.strictEqual(cells.length, 3 + 27, '炉三槽(DOM 序前 3) + 背包 27 格');
  cells[3].onclick(); /* 主格首格 = 背包槽 9 */
  cells[21].onclick(); /* 快捷镜像首格 = 背包槽 0(空格点击也报意图, 路由归模式层) */
  assert.deepStrictEqual(puts, [9, 0], '点击格报 onPut(槽号) 意图');
  assert.deepStrictEqual(inv.slots[9], {id: 'iron_ore', n: 3}, '面板不动包(意图口径)');
  panel.remove();
});

test('furnace 面板: 不可入炉物 dim 灰显 — 可烧/燃料亮显, 其余灰显(路由前视觉预告)', () => {
  const doc = mkDoc();
  globalThis.smeltOf = (id) => (id === 'iron_ore' ? 'iron_ingot' : null);
  globalThis.fuelUnits = (id) => (id === 'coal' ? 8 : 0);
  const inv = {slots: [...Array(9).fill(null), {id: 'iron_ore', n: 3},
    {id: 'coal', n: 2}, {id: 'apple', n: 1}, ...Array(14).fill(null)]};
  const panel = mkFurnacePanel({doc, inv, onAutoFill() {}, onPut() {}});
  panel.show();
  const cells = collect(panel.root, 'mkp-cell');
  assert.ok(!cells[3]._cls.has('dim'), '可烧物亮显');
  assert.ok(!cells[4]._cls.has('dim'), '燃料亮显');
  assert.ok(cells[5]._cls.has('dim'), '不可烧也非燃料 → dim 灰显');
  panel.remove();
});

test('furnace 面板: 点击炉三槽报 onSlot 意图 — 料/燃料取回·产物收取的政策归模式层', () => {
  const doc = mkDoc();
  const slots = [];
  const panel = mkFurnacePanel({doc, inv: {slots: new Array(27).fill(null)},
    onAutoFill() {}, onSlot: (n) => slots.push(n)});
  panel.show();
  const cells = collect(panel.root, 'mkp-cell');
  cells[0].onclick(); cells[1].onclick(); cells[2].onclick();
  assert.deepStrictEqual(slots, ['input', 'fuel', 'out'], 'DOM 序三槽各报自己的意图键');
  panel.remove();
});

test('furnace 面板: 放料后背包格跟随重画 — onPut/onAutoFill 动包, 面板重读当前包', () => {
  const doc = mkDoc();
  globalThis.smeltOf = (id) => (id === 'iron_ore' ? 'iron_ingot' : null);
  globalThis.FUEL = ['coal'];
  globalThis.fuelUnits = (id) => (id === 'coal' ? 8 : 0);
  const inv = {slots: [...Array(9).fill(null), {id: 'iron_ore', n: 5},
    {id: 'coal', n: 1}, ...Array(16).fill(null)]};
  const panel = mkFurnacePanel({doc, inv,
    /* 模式层桩: onAutoFill 扣包(furnace-kit autoFill) / onPut 整摞入炉(manualPut) */
    onAutoFill() {
      inv.slots[9] = null;
    },
    onPut(i) {
      inv.slots[i] = null;
    }});
  panel.show();
  let cells = collect(panel.root, 'mkp-cell');
  cells[4].onclick(); /* 背包槽 10(煤): 意图后模式层清格 */
  cells = collect(panel.root, 'mkp-cell'); /* 格子已重画: 重取 */
  assert.ok(!String(cells[4].innerHTML).includes('cnt'), '手动放料后背包格重画(煤格已空)');
  collect(panel.root, 'mkp-autofill')[0].onclick(); /* 自动放入: 模式层扣包 */
  cells = collect(panel.root, 'mkp-cell');
  assert.ok(!String(cells[3].innerHTML).includes('cnt'), '自动放料后背包格重画(铁矿格随扣包清空)');
  panel.remove();
});

/* ============ 面板族底座(mkPanelShell, 评审候选 2): 公共骨架契约 ============ */

/* 带事件记录的 doc: 捕获底座挂的 keydown 监听(fakeDoc 无 addEventListener,
   Esc 用例在此手动派发) */
function mkDocEv() {
  const downs = [];
  const doc = {createElement: () => fakeEl(), body: fakeEl(),
    addEventListener(type, fn) {
      /* 同真 DOM 口径: 同回调重复注册去重(面板幂等 show 依赖此语义) */
      if (type === 'keydown' && !downs.includes(fn)) downs.push(fn);
    },
    removeEventListener(type, fn) {
      const i = downs.indexOf(fn);
      if (i >= 0) downs.splice(i, 1);
    }};
  doc.esc = ()=>downs.forEach((fn)=>fn({code: 'Escape', preventDefault() {}}));
  doc.keydownCount = ()=>downs.length;
  return doc;
}

/* 三面板同形的生命周期契约(收编前各面板誊写一遍, 收敛为一组断言跑三家):
   挂卸幂等 · Esc 监听随开合挂摘 · 重开复明 · refresh 不碰开合态 */
function panelLifecycle(name, make) {
  test(`面板生命周期契约(${name}): 挂卸幂等 · Esc=close · 重开复明 · refresh 不碰开合态`, () => {
    const doc = mkDocEv();
    let closed = 0;
    const p = make(doc, ()=>closed++);
    p.show();
    p.show(); // 再挂 → 不重复
    assert.strictEqual(doc.body.children.length, 1, '挂载幂等');
    assert.strictEqual(p.root.style.display, 'flex', 'show 复明');
    assert.strictEqual(doc.keydownCount(), 1, 'Esc 监听恰一条');
    p.hide();
    assert.strictEqual(p.root.style.display, 'none', 'hide 收起');
    assert.strictEqual(doc.keydownCount(), 0, 'hide 摘 Esc 监听');
    p.refresh(); /* refresh 语义统一: 重画内容, 不改变开合状态 */
    assert.strictEqual(p.root.style.display, 'none', '关着时 refresh 不弹面板');
    p.show(); /* hide 后重开复明 */
    assert.strictEqual(p.root.style.display, 'flex', '重开复明');
    doc.esc(); /* Esc → close: 隐藏 + onClose 恰一次 */
    assert.strictEqual(p.root.style.display, 'none', 'Esc 关面板');
    assert.strictEqual(closed, 1, 'onClose 恰一次');
    p.remove();
    p.remove(); // 再卸 → 幂等
    assert.strictEqual(doc.body.children.length, 0, '卸载幂等');
    assert.strictEqual(doc.keydownCount(), 0, '卸载摘 Esc 监听');
  });
}
panelLifecycle('craft', (doc, onClose)=> mkCraftPanel({doc,
  inv: {slots: new Array(27).fill(null)}, recipes: [R_PLANKS], onCraft() {}, onClose}));
panelLifecycle('furnace', (doc, onClose)=> mkFurnacePanel({doc,
  inv: {slots: new Array(27).fill(null)}, onAutoFill() {}, onClose}));
panelLifecycle('chest', (doc, onClose)=> mkChestPanel({doc,
  inv: {slots: new Array(27).fill(null)},
  chest: () => ({size: 9, slots: new Array(9).fill(null)}),
  next: () => null, have: () => 0, onPut() {}, onTake() {}, onExpand() {}, onClose}));

/* ============ mkChestPanel 契约(引导链 v2, 收编前零测试) ============ */

test('chest 面板: 箱格点击报 onTake(箱槽号)/背包格点击报 onPut(背包槽号)意图, 面板不动数据', () => {
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'planks', n: 12}, ...Array(17).fill(null)]};
  const chest = {size: 9, slots: [{id: 'log', n: 3}, ...Array(8).fill(null)]};
  const puts = []; const takes = [];
  const p = mkChestPanel({doc, inv, chest: ()=>chest, next: ()=>null, have: ()=>0,
    onPut: (i)=>puts.push(i), onTake: (i)=>takes.push(i), onExpand() {}, onClose() {}});
  p.show();
  p.refresh(); /* 消费方口径: adventure.js 开面板后自调 refresh(show 不重画内容) */
  const cells = collect(p.root, 'mkp-cell');
  assert.strictEqual(cells.length, 9 + 27, '箱格 9 + 背包 27(18 主格+9 快捷镜像)');
  cells[0].onclick(); /* 箱格 0(log) */
  cells[9].onclick(); /* 背包主格首格 = 槽 9 */
  cells[27].onclick(); /* 快捷镜像首格 = 槽 0(空格点击也报意图, 路由归模式层) */
  assert.deepStrictEqual(takes, [0], '箱格点击报 onTake(箱槽号)意图');
  assert.deepStrictEqual(puts, [9, 0], '背包格点击报 onPut(背包槽号)意图');
  assert.deepStrictEqual(chest.slots[0], {id: 'log', n: 3}, '面板不动箱(政策归模式层)');
  assert.deepStrictEqual(p.cellAt(9), {id: 'planks', n: 12}, '查询面 cellAt: 槽 9 内容');
  assert.strictEqual(p.cellAt(0), null, '查询面 cellAt: 空槽 null');
  p.remove();
});

test('chest 面板: 扩容行 — 材料账单 chip have/need + 缺料 lack + 扩容钮报 onExpand; 顶格档隐藏', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  let nx = {size: 18, cost: {cobble: 8}};
  let expanded = 0;
  const p = mkChestPanel({doc, inv,
    chest: ()=>({size: 9, slots: new Array(9).fill(null)}),
    next: ()=>nx, have: (id)=> (id === 'cobble' ? 3 : 0),
    onPut() {}, onTake() {}, onExpand: ()=>expanded++, onClose() {}});
  p.show(); p.refresh();
  /* chip 的 mkp-chip 类名在 innerHTML 字符串里(fakeEl 不解析), 经扩容行
     子元素断言: children[0]=账单 chip, [1]=扩容钮 */
  const row = collect(p.root, 'mkp-chestrow')[0];
  assert.strictEqual(row.children.length, 2, '一档: 账单 chip + 扩容钮');
  const chipHtml = String(row.children[0].innerHTML);
  assert.ok(chipHtml.includes('3/8'), '账单恒显 have/need');
  assert.ok(chipHtml.includes('mkp-chip lack'), '缺料 lack 灰显');
  row.children[1].onclick();
  assert.strictEqual(expanded, 1, '扩容钮报 onExpand 意图(扣料归模式层)');
  nx = null; /* 顶格档: next()=null */
  p.refresh();
  assert.strictEqual(collect(p.root, 'mkp-chestrow')[0].children.length, 0, '顶格后扩容行清空');
  p.remove();
});

test('chest 面板: 容量提示行(ADR 0007) — 一句话报现存箱子数与总容量(两轨口径)', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const chest = {size: 27, chests: 2, slots: new Array(27).fill(null)};
  const p = mkChestPanel({doc, inv, chest: ()=>chest, next: ()=>null, have: ()=>0,
    onPut() {}, onTake() {}, onExpand() {}, onClose() {}});
  p.show(); p.refresh();
  const lbl = collect(p.root, 'mkp-chestlbl')
      .map((e) => String(e.textContent)).join('|');
  assert.ok(lbl.includes('2 个'), '提示行报现存箱子数(chests)');
  assert.ok(lbl.includes('27 格'), '提示行报总容量(size)');
  chest.chests = 3; chest.size = 36; /* 模式层重算后面板重画跟随 */
  p.refresh();
  const lbl2 = collect(p.root, 'mkp-chestlbl')
      .map((e) => String(e.textContent)).join('|');
  assert.ok(lbl2.includes('3 个') && lbl2.includes('36 格'), '重画跟随账户现状');
  p.remove();
});

test('chest 面板: 存取意图后面板重读现状 — onPut 动包后背包格跟随重画', () => {
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'log', n: 3}, ...Array(17).fill(null)]};
  const p = mkChestPanel({doc, inv,
    chest: ()=>({size: 9, slots: new Array(9).fill(null)}), next: ()=>null, have: ()=>0,
    onPut: (i)=> {
      inv.slots[i] = null; /* 模式层桩: 存入即扣槽 */
    }, onTake() {}, onExpand() {}, onClose() {}});
  p.show(); p.refresh();
  let cells = collect(p.root, 'mkp-cell');
  assert.ok(String(cells[9].innerHTML).includes('🥓'), '槽 9 原木(emoji 图标桩)');
  cells[9].onclick(); /* 存入 → 模式层清槽 → 面板重画 */
  cells = collect(p.root, 'mkp-cell');
  assert.strictEqual(String(cells[9].innerHTML), '', '背包格跟随重画(格已空)');
  p.remove();
});

/* ============ mkMode 默认行为 ============ */

test('KeyB 默认暂停(不转发), 其余键转发给模式', () => {
  const got = [];
  const mode = mkMode({id: 'x', onKey(code) {
    got.push(code);
  }});
  mode.onKey('KeyB');
  assert.strictEqual(pausedN, 1);
  assert.strictEqual(got.length, 0);
  mode.onKey('KeyR');
  assert.deepStrictEqual(got, ['KeyR']);
});

test('init: chrome 施加 + hotbar 现身 + touch 声明', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}]});
  const mode = mkMode({id: 'x', hotbar: hb, chrome: {hotbar: 'flex'}, touch: [{label: '⬆️'}], init() {}});
  mode.init();
  assert.strictEqual(mount.style.display, 'flex');
  assert.deepStrictEqual(touchList, [{label: '⬆️'}]);
});

test('init: 无声明的模式安全通过(Node 无 DOM, MK.* 为 null)', () => {
  const mode = mkMode({id: 'x', init() {}});
  mode.init();
  assert.strictEqual(touchList, null); // touch 缺省 → null 隐藏
});

/* ============ mkMainAct 智能主动作分派(手持感知, 2026-10-24) ============ */

test('mkMainAct: 手持可放置物 → aimClick(2) 且返 false(一次性放置, 不进连发)', () => {
  const clicks = [];
  globalThis.aimClick = (b) => clicks.push(b);
  const act = ModeKit.mkMainAct(() => true);
  assert.strictEqual(act(), false); // input.js 据此跳过 onHold 连发(一按一放)
  assert.deepStrictEqual(clicks, [2]);
  delete globalThis.aimClick;
});

test('mkMainAct: 空手/工具/食物 → aimClick(0) 挖打起步, 返回值非 false 进连发', () => {
  const clicks = [];
  globalThis.aimClick = (b) => clicks.push(b);
  const act = ModeKit.mkMainAct(() => false);
  assert.notStrictEqual(act(), false);
  assert.deepStrictEqual(clicks, [0]);
  delete globalThis.aimClick;
});

/* ============ mkHeldSync: 手持感知同步件(评审候选 6, 五件套收编) ============ */

test('mkHeldSync: 哨兵槽/数字方块判定 — isBlock() 与 itemId()(铁锹映射不外泄)', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}, {icon: 'b'}, {icon: 'c'}]});
  const held = ModeKit.mkHeldSync(['shovel', 6, 5], hb);
  hb.select(0); // 'shovel' 哨兵槽
  assert.strictEqual(held.isBlock(), false, '哨兵槽不是方块');
  assert.strictEqual(held.itemId(), null, '非方块槽 itemId=null(铁锹物品映射藏在实现)');
  hb.select(1); // 数字方块槽
  assert.strictEqual(held.isBlock(), true, '数字槽是方块');
  assert.strictEqual(held.itemId(), 6, '方块槽数字 id 直读');
  hb.select(2);
  assert.strictEqual(held.itemId(), 5);
});

test('mkHeldSync: sync 调 Avatar.setItem 与主动作键图标切换(铲↔砖块)', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}, {icon: 'b'}]});
  const held = ModeKit.mkHeldSync(['shovel', 6], hb);
  const setItems = [];
  globalThis.Avatar = {setItem(id) {
    setItems.push(id);
  }}; /* Avatar 桩: mode-kit 经 typeof 守卫, 缺装静默(下一用例断言) */
  mainIconLog.length = 0;
  try {
    hb.select(0);
    held.sync(); // 铁锹槽
    hb.select(1);
    held.sync(); // 方块槽
    assert.deepStrictEqual(setItems, ['shovel_iron', 6],
        'Avatar.setItem: 哨兵槽→铁锹物品, 方块槽→方块数字 id');
    assert.deepStrictEqual(mainIconLog, [['shovel', '挖掘'], ['brick', '放置']],
        '主动作键图标随手持切换(铲=连挖 / 砖=放置, 经 Input.refreshMain)');
  } finally {
    delete globalThis.Avatar; /* 还原缺装态, 不外溢 */
  }
});

test('mkHeldSync: Avatar/Input 缺装时 sync 静默不炸(精简装载守卫)', () => {
  const mount = fakeEl();
  const hb = mkHotbar({doc: fakeDoc, mount, items: [{icon: 'a'}, {icon: 'b'}]});
  const savedInput = globalThis.Input;
  delete globalThis.Input;
  try {
    const held = ModeKit.mkHeldSync(['shovel', 3], hb);
    hb.select(1);
    held.sync(); /* Avatar 与 Input 都不在 → 静默跳过 */
    assert.strictEqual(held.isBlock(), true, '判定面不依赖外部件');
    assert.strictEqual(held.itemId(), 3);
  } finally {
    globalThis.Input = savedInput;
  }
});

/* ============ 出生点与 onVoidFall ============ */

test('spawn 记住出生点, 默认 onVoidFall 回到出生点', () => {
  spawn(11, 22, 33, {pitch: -0.22});
  assert.deepStrictEqual(pos.v, [11, 22, 33]);
  assert.deepStrictEqual(vel.v, [0, 0, 0]);
  assert.strictEqual(yaw, 0);
  assert.strictEqual(pitch, -0.22);
  assert.strictEqual(onGround, false);
  pos.v = [0, -99, 0]; // 模拟坠出世界
  mkMode({id: 'x'}).onVoidFall();
  assert.deepStrictEqual(pos.v, [11, 22, 33]);
});

test('自定义 onVoidFall 优先 (模式自定义坠落语义)', () => {
  let fell = false;
  mkMode({id: 'x', onVoidFall() {
    fell = true;
  }}).onVoidFall();
  assert.ok(fell);
});

/* ============ 二次确认按钮 ============ */

test('confirmBtn: 首点武装, 再点执行, 超时还原', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const btn = fakeEl();
  let done = 0;
  confirmBtn(btn, {label: '重置 ↺', confirm: '⚠ 确认', onConfirm() {
    done++;
  }});
  btn.onclick(); // 武装
  assert.strictEqual(btn.textContent, '⚠ 确认');
  assert.strictEqual(done, 0);
  btn.onclick(); // 执行
  assert.strictEqual(done, 1);
  assert.strictEqual(btn.textContent, '重置 ↺');
  btn.onclick(); // 再武装…
  t.mock.timers.tick(3000); // …超时还原
  assert.strictEqual(btn.textContent, '重置 ↺');
  btn.onclick(); btn.onclick(); // 超时后需重新武装两步
  assert.strictEqual(done, 2);
});

/* ============ 物品提示(ItemHint): 点到什么读什么(docs/item-hint-design.md) ============ */

test('物品提示: hotbar 点选 → 气泡显名字+说明; 空槽静默不改写气泡', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']}); /* 气泡 3.2s 淡出走 mock */
  const doc = mkDoc();
  const mount = fakeEl();
  globalThis.hintForSlot = (it) => (!it || it.item !== 'planks' ? null :
      {name: '木板', desc: '原木锯成的板子', tts: '木板，原木锯成的板子'});
  try {
    const hb = mkHotbar({doc, mount,
      items: [{item: 'planks', cnt: () => 3}, {item: 'planks', cnt: () => 0}]});
    hb.show();
    hb.select(0); /* 有货槽: 读提示 */
    const bubble = collect(doc.body, 'hint-bubble')[0];
    assert.ok(bubble, '气泡已建(挂 body)');
    assert.ok(String(bubble.innerHTML).includes('木板'), '名字');
    assert.ok(String(bubble.innerHTML).includes('原木锯成的板子'), '说明');
    assert.strictEqual(bubble.style.opacity, 1);
    hb.select(1); /* 空槽(cnt≤0): kitHint(null) 早退, 气泡内容不动 */
    assert.strictEqual(collect(doc.body, 'hint-bubble')[0], bubble, '气泡单例不重建');
    assert.ok(String(bubble.innerHTML).includes('原木锯成的板子'), '空槽不改写气泡');
  } finally {
    globalThis.hintForSlot = () => null;
  }
});

test('物品提示: 背包格点击读被点物品; 点灰卡=一键摆入+读产物提示(缺料尾句)', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'planks', n: 12}, ...Array(17).fill(null)]};
  globalThis.hintForItem = (id) => (id === 'planks' ?
      {name: '木板', desc: '原木锯成的板子', tts: '木板，原木锯成的板子'} :
      (id === 'pick_wood' ? {name: '木镐', desc: '能挖石头的木头镐', tts: '木镐，能挖石头的木头镐'} : null));
  try {
    const panel = mkCraftPanel({doc, inv, recipes: [
      R_PLANKS,
      {id: 'pick_wood', out: {item: 'pick_wood', n: 1}, station: 'hand',
        shape: {rows: [['planks', 'planks', 'planks'], [null, 'stick', null], [null, 'stick', null]]}},
    ], onCraft() {}});
    panel.show();
    collect(panel.root, 'mkp-cell')[0].onclick(); /* 槽 9 起手: 读木板 */
    let bubble = collect(doc.body, 'hint-bubble')[0];
    assert.ok(String(bubble.innerHTML).includes('原木锯成的板子'), '背包格点击出提示');
    const card = collect(panel.root, 'mkp-card')[1]; /* 木镐卡(缺棍 → 灰) */
    card.onclick(); /* 点灰卡 = 一键摆入(缺料格留空) + 读产物提示 */
    const bench = collect(panel.root, 'mkp-cell').slice(27);
    assert.ok(bench[0].innerHTML.includes('data:image/png;base64,AA'), '三块板已部分摆入(拍板③)');
    assert.strictEqual(collect(panel.root, 'mkp-oslot')[0]._cls.has('on'), false, '棍缺摆不中 → 产出槽不亮');
    bubble = collect(doc.body, 'hint-bubble')[0];
    assert.ok(String(bubble.innerHTML).includes('木镐'), '点灰卡读产物提示(名字)');
    assert.ok(String(bubble.innerHTML).includes('能挖石头的木头镐'), '读产物提示(说明)');
    /* 摆空点产出槽: 读指路提示, 不合成 */
    const out = collect(panel.root, 'mkp-oslot')[0];
    out._ev.pointerdown({preventDefault() {}});
    out._ev.pointerup();
    bubble = collect(doc.body, 'hint-bubble')[0];
    assert.ok(String(bubble.innerHTML).includes('摆'), '未命中点击读指路提示(不静默)');
    panel.remove();
  } finally {
    globalThis.hintForItem = () => null;
  }
});

/* mkHpBar 断言已随件迁 test/combat-kit.test.js(C6-T3) */

/* ============ mkMobPicker: 选怪按钮组(评审候选 6, 三处誊写收编) ============ */

test('mkMobPicker: 谱系分组渲染 — 组头+组员簇, 头像与名字, data-type', () => {
  const doc = mkDoc();
  const mount = fakeEl();
  ModeKit.mkMobPicker({doc, mount, onPick() {}}).render();
  const grps = mount.children.filter((c) => c._cls.has('fam-group'));
  assert.strictEqual(grps.length, 3, '三族簇: zombie_line / skeleton_line / lone');
  assert.deepStrictEqual(collect(mount, 'fam-head').map((h) => h.textContent),
      ['zombie_line', 'skeleton_line', 'lone'], '组头文本=族名');
  const btns = [];
  (function walk(el) {
    (el.children || []).forEach((c) => {
      if (c.dataset && c.dataset.type) btns.push(c);
      walk(c);
    });
  })(mount);
  assert.deepStrictEqual(btns.map((b) => b.dataset.type),
      ['zombie', 'husk', 'skeleton', 'creeper'], '组员按钮按族序展开');
  assert.ok(String(btns[0].innerHTML).includes('src="data:face:zombie"'), 'Mobs.face 头像');
  assert.ok(String(btns[0].innerHTML).includes('僵尸'), '名字取 Mobs.types');
});

test('mkMobPicker: headKeys 前置功能位(不归族) + 点击 onPick + 选中态自动重读', () => {
  const doc = mkDoc();
  const mount = fakeEl();
  let cur = 'zombie'; const picks = [];
  ModeKit.mkMobPicker({
    doc, mount, headKeys: ['mix'], activeOf: () => cur,
    onPick(k) {
      picks.push(k);
    },
  }).render();
  assert.strictEqual(mount.children[0].dataset.type, 'mix', 'mix 按钮平铺在最前(不进族簇)');
  assert.ok(String(mount.children[0].innerHTML).includes('data:face:mix'), '功能位同款头像渲染');
  assert.ok(!mount.children[0]._cls.has('active'), '初始选中僵尸, mix 未高亮');
  cur = 'mix'; // 消费方口径: onPick 里写配置, 此处以同效直改模拟
  mount.children[0].onclick();
  assert.deepStrictEqual(picks, ['mix'], '点击报 onPick(键)');
  assert.ok(mount.children[0]._cls.has('active'), '点击后经 activeOf 重读 → mix 高亮');
});

test('mkMobPicker: 未注册键兜底显键名(不静默丢, 面板分组「不丢桶」同款口径)', () => {
  const doc = mkDoc();
  const mount = fakeEl();
  ModeKit.mkMobPicker({doc, mount, headKeys: ['ghost'], onPick() {}}).render();
  const b = mount.children[0];
  assert.strictEqual(b.dataset.type, 'ghost');
  assert.ok(String(b.innerHTML).includes('ghost'), 'types 无此键 → 名字回落键名');
  b.onclick(); // 未注册键点击也不炸
});

test('mkMobPicker: groupOf 恒 null 平铺(出发配置页卡片流) + itemTag/itemCls/itemHtml 观感差异', () => {
  const doc = mkDoc();
  const mount = fakeEl();
  ModeKit.mkMobPicker({
    doc, mount,
    groupOf: () => null,
    itemTag: 'div',
    itemCls: 'scene-card',
    itemHtml: (k) => '<div class="big"><img alt="" src="' + Mobs.face(k) + '"></div>' +
      '<h2>' + Mobs.types[k].name + '</h2>',
    activeOf: () => 'skeleton',
    onPick() {},
  }).render();
  assert.strictEqual(collect(mount, 'fam-group').length, 0, '平铺口径: 不建谱系组头');
  assert.strictEqual(mount.children.length, 4, '四怪四卡直接挂容器');
  assert.ok(mount.children.every((c) => c._cls.has('scene-card')), 'itemCls 附加类');
  assert.ok(String(mount.children[0].innerHTML).includes('<h2>僵尸</h2>'), 'itemHtml 卡片结构(.big + h2)');
  const sk = mount.children.find((c) => c.dataset.type === 'skeleton');
  assert.ok(sk._cls.has('active'), 'activeOf 供给的键高亮');
});

/* ============ editHit 覆盖放置(2026-10-28 花草火把票, 建造/竞技场路径) ============ */

test('editHit 放置覆盖薄块: 命中 replaceable → 落点=被点格本身盖掉; 实心命中走法线侧旧口径', () => {
  /* 引擎全局以属性占位注入(Node 无 world.js), 用完逐键还原防泄漏到同文件其他测试 */
  const saved = {
    BLOCKS: globalThis.BLOCKS, getBlock: globalThis.getBlock,
    editBlock: globalThis.editBlock, collidesAtPlayer: globalThis.collidesAtPlayer,
  };
  globalThis.BLOCKS = [null,
    {name: '泥土', solid: true}, /* 1 实心参照 */
    {name: '草丛', thin: 0.35, solid: false, replaceable: true}, /* 2 覆盖族 */
    {name: '床', thin: 0.55, solid: false}, /* 3 thin 无旗标(家具) */
  ];
  globalThis.getBlock = (x, y, z) =>
    (x === 3 && y === 4 && z === 5) ? 2 : (x === 6 && y === 7 && z === 8) ? 3 : 0;
  const edits = [];
  globalThis.editBlock = (x, y, z, id) => {
    edits.push([x, y, z, id]); return [];
  };
  globalThis.collidesAtPlayer = () => false;
  try {
    const r1 = ModeKit.editHit(2, {x: 3, y: 4, z: 5, nx: 0, ny: 1, nz: 0}, () => 1);
    assert.deepStrictEqual([r1.x, r1.y, r1.z, r1.id], [3, 4, 5, 1],
        '命中草丛: 木板落被点格本身(覆盖, 不架半空)');
    assert.deepStrictEqual(edits, [[3, 4, 5, 1]], '编辑恰一记=覆盖格');
    edits.length = 0;
    const r2 = ModeKit.editHit(2, {x: 6, y: 7, z: 8, nx: 0, ny: 1, nz: 0}, () => 1);
    assert.deepStrictEqual([r2.x, r2.y, r2.z, r2.id], [6, 8, 8, 1],
        '命中床(无旗标): 走原路径落法线侧');
    edits.length = 0;
    globalThis.collidesAtPlayer = (x, y, z) => (x === 3 && y === 4 && z === 5);
    assert.strictEqual(ModeKit.editHit(2, {x: 3, y: 4, z: 5, nx: 0, ny: 1, nz: 0}, () => 1), null,
        '覆盖格撞玩家身体 → 拒(不把自己埋进去, 覆盖路径同守卫)');
    globalThis.collidesAtPlayer = () => false;
    globalThis.getBlock = () => 1; /* 命中实心且法线侧也实心 */
    assert.strictEqual(ModeKit.editHit(2, {x: 6, y: 7, z: 8, nx: 0, ny: 1, nz: 0}, () => 1), null,
        '实心命中+法线侧非空 → 拒(旧行为不回归)');
    assert.deepStrictEqual(edits, [], '拒绝路径零编辑');
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete globalThis[k]; else globalThis[k] = saved[k];
    }
  }
});

/* ============ 丢弃态 + 可变容量背包区(2026-10, docs/bag-and-drop-design.md) ============ */

test('丢弃: 未传 onDrop 无头钮(体验馆零变化); 传了才现身且 paintChrome 注入图标不炸', () => {
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'planks', n: 5}, ...Array(17).fill(null)]};
  const p0 = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
  p0.show();
  assert.strictEqual(collect(p0.root, 'mkp-drop').length, 0, '无 onDrop=无丢弃钮');
  p0.remove();
  const p1 = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}, onDrop() {}});
  p1.show();
  assert.strictEqual(collect(p1.root, 'mkp-drop').length, 1, '有 onDrop=头钮现身');
  p1.remove();
});

test('丢弃: craft armed → 点背包格报 onDrop(槽号); 空格不动; 关面板收态后恢复搬运', () => {
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'planks', n: 5}, null, ...Array(16).fill(null)]};
  const dropped = []; const moves = [];
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {},
    onDrop: (i) => {
      dropped.push(i); inv.slots[i] = null;
    }, /* 模式层扣包(advDropSlot 同构) */
    onMove: (from, to) => moves.push([from, to])});
  panel.show();
  const btn = collect(panel.root, 'mkp-drop')[0];
  btn.onclick();
  assert.ok(btn._cls.has('on'), 'armed 头钮点亮');
  assert.ok(collect(panel.root, 'mkp-grid')[0]._cls.has('dropmode'), '背包格红边警示类');
  collect(panel.root, 'mkp-cell')[0].onclick(); /* 主格首格=槽 9(木板) */
  assert.deepStrictEqual(dropped, [9], '整摞丢弃报槽号');
  assert.strictEqual(inv.slots[9], null, '模式层已扣包');
  collect(panel.root, 'mkp-cell')[0].onclick(); /* 现在是空格 */
  assert.deepStrictEqual(dropped, [9], '空格不报丢弃');
  panel.close(); /* ✕ 统一出口 → 收丢弃态 */
  assert.ok(!btn._cls.has('on'), '关面板收态');
  /* 恢复搬运: 起手(槽 9 放回一摞) → 点目标格 = onMove 而非 onDrop */
  inv.slots[9] = {id: 'planks', n: 3};
  const cells = collect(panel.root, 'mkp-cell');
  cells[0].onclick(); /* 起手槽 9 */
  cells[1].onclick(); /* 目标槽 10(空) */
  assert.deepStrictEqual(moves, [[9, 10]], '收态后点选搬运恢复');
  assert.deepStrictEqual(dropped, [9], '收态后不再报丢弃');
  panel.remove();
});

test('丢弃: chest 面板 wirePut 同口径 — armed 点背包格报 onDrop 不报 onPut', () => {
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'planks', n: 12}, ...Array(17).fill(null)]};
  const chest = {size: 9, slots: new Array(9).fill(null)};
  const puts = []; const dropped = [];
  const p = mkChestPanel({doc, inv, chest: ()=>chest, next: ()=>null, have: ()=>0,
    onPut: (i)=>puts.push(i), onTake() {}, onExpand() {}, onClose() {},
    onDrop: (i) => {
      dropped.push(i); inv.slots[i] = null;
    }});
  p.show();
  p.refresh(); /* 消费方口径: 开面板后自调 refresh */
  collect(p.root, 'mkp-drop')[0].onclick(); /* armed */
  const cells = collect(p.root, 'mkp-cell'); /* 箱格 9 + 背包主格 18 + 快捷镜像 9 */
  cells[9].onclick(); /* 背包主格首格 = 槽 9(木板) */
  assert.deepStrictEqual(dropped, [9], 'armed 报丢弃');
  assert.deepStrictEqual(puts, [], '不再报入箱意图');
  p.remove();
});

test('可变容量: 33 槽背包区按现长度重画(24 主格 + 9 快捷镜像 + 摆放台 9 = 42 格)', () => {
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), ...Array(23).fill(null), {id: 'planks', n: 6}]};
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
  panel.show();
  const cells = collect(panel.root, 'mkp-cell');
  assert.strictEqual(cells.length, 42, '24 主格 + 9 镜像 + 摆放台 9');
  assert.ok(cells[23].innerHTML.includes('data:image/png'), '主格末格=槽 32(扩容区)有内容');
  panel.remove();
});
