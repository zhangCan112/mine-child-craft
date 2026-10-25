'use strict';
/* ModeKit 单测 — node --test (零依赖)
   运行: node --test test/mode-kit.test.js
   mkHotbar 经 doc/mount 注入假 DOM; 引擎全局(pos/vel/yaw…)以属性占位注入 */
const test = require('node:test');
const assert = require('node:assert');
const ModeKit = require('../js/mode-kit.js');
const {mkMode, mkHotbar, mkCraftPanel, mkFurnacePanel, sortInv, confirmBtn, spawn} = ModeKit;

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

/* —— 合成核心桩(craft-core.js 全局, 测试内可控) —— */
globalThis.costEntry = (key, val) => (typeof val === 'number') ? {cands: [key], n: val} :
  (Array.isArray(val) && Array.isArray(val[0]) ? {cands: val[0], n: val[1] || 0} : null);
let craftOk = true; let craftN = 0;
const defaultCanCraft = () => (craftOk ? {ok: true, missing: []} :
  {ok: false, missing: [{id: 'log', need: 1, have: 0}]});
globalThis.canCraft = defaultCanCraft;
globalThis.craft = () => {
  craftN++; return {ok: true, out: {item: 'planks', n: 4}, leftover: 0};
};
const R_PLANKS = {id: 'planks', out: {item: 'planks', n: 4}, cost: {log: 1}, station: 'hand'};

/* mode-kit 引用的自由变量 → 测试注入全局属性 (浏览器里来自 world.js/input.js) */
globalThis.pos = {set(x, y, z) {
  this.v = [x, y, z];
}};
globalThis.vel = {set(x, y, z) {
  this.v = [x, y, z];
}};
globalThis.yaw = 0; globalThis.pitch = 0; globalThis.onGround = true;

/* T10 item 槽/面板引用的自由变量 → 全局桩 (浏览器里来自 items-core/icons.js) */
globalThis.ITEMS = {
  planks: {name: '木板', block: 6},
  rotten_flesh: {name: '腐肉', food: 2},
  apple: {name: '苹果', food: 4},
  stick: {name: '木棍'},
  pick_wood: {name: '木镐', tool: {kind: 'pick', tier: 1, dmg: 3, dur: 120, speed: 2}},
};
globalThis.iconOf = (id) => (id === 'planks' ? 'data:image/png;base64,AA' : '🥓');
/* 按钮像素图标(button-icons.js)引用的自由变量 → 全局桩(面板标题/页签/徽标) */
globalThis.btnImg = (n) => '<img class="bi" data-btn="' + n + '" alt="" src="data:image/png;base64,BB">';
globalThis.toolOf = (id) => (/^(pick|axe|sword|shovel)_/.test(id) ? {kind: 'pick', tier: 1, dur: 120} : null);
globalThis.HOTBAR_SLOTS = 9; // inventory-core 常量桩

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
  globalThis.stackMax = (id) => ({planks: 64, cobble: 64, pick_wood: 1}[id] || 0);
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
});

/* ============ T10 mkCraftPanel: 挂载/网格 ============ */

test('craft 面板: 挂载/卸载幂等 + 背包网格 18 主格+9 快捷镜像', () => {
  const doc = mkDoc();
  const inv = {slots: [
    ...Array(9).fill(null), {id: 'planks', n: 12}, ...Array(17).fill(null),
  ]};
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
  panel.show();
  panel.show(); // 再挂 → 不重复
  assert.strictEqual(doc.body.children.length, 1);
  const cells = collect(panel.root, 'mkp-cell');
  assert.strictEqual(cells.length, 27); // 18 主格 + 9 快捷镜像
  assert.ok(cells[0].innerHTML.includes('data:image/png;base64,AA')); // 主格首格 = 槽 9 的木板
  assert.ok(collect(panel.root, 'mkp-quest').length === 1); // 任务卡占位容器(T15 填)
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
  const inv = {slots: new Array(27).fill(null)};
  const panel = mkCraftPanel({doc, inv, recipes: [
    R_PLANKS, // hand: 无徽标, 产物 ×4
    {id: 'pick_wood', out: {item: 'pick_wood', n: 1}, cost: {planks: 3, stick: 2}, station: 'table'},
    {id: 'torch', out: {item: 'torch', n: 4}, cost: {fuel: [['coal', 'charcoal'], 1], stick: 1}, station: 'hand'},
  ], onCraft() {}});
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
    {id, out: {item: id, n: 1}, cost: {wheat: 1}, station: 'table'}));
  const p1 = mkCraftPanel({doc, inv, recipes: [...hidden, R_PLANKS], onCraft() {}});
  p1.show();
  assert.strictEqual(collect(p1.root, 'mkp-card').length, 1); // 只剩 planks
  p1.remove();
  const p2 = mkCraftPanel({doc, inv, recipes: [...hidden, R_PLANKS], allow: ['bread'], onCraft() {}});
  p2.show();
  assert.strictEqual(collect(p2.root, 'mkp-card').length, 2); // bread 放开
  p2.remove();
});

/* ============ T10 卡片亮灰: canCraft 驱动 ============ */

test('craft 面板: 缺料→卡片 dim+chip lack(have/need), 补料刷新恢复亮', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  let check = {ok: false, missing: [{id: 'log', need: 1, have: 0}]};
  globalThis.canCraft = () => check; // mock 驱动亮灰
  let panel;
  try {
    panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
    panel.show();
    let card = collect(panel.root, 'mkp-card')[0];
    assert.ok(card._cls.has('dim')); // 缺料 → 整卡灰
    assert.ok(card.innerHTML.includes('class="mkp-chip lack"')); // 缺的材料灰显
    assert.ok(card.innerHTML.includes('>0/1<')); // have/need 计数
    check = {ok: true, missing: []};
    panel.refresh();
    card = collect(panel.root, 'mkp-card')[0];
    assert.ok(!card._cls.has('dim'));
    assert.ok(!card.innerHTML.includes('lack'));
    panel.remove();
  } finally {
    globalThis.canCraft = defaultCanCraft; // 还原共享桩
  }
});

test('craft 面板: 站点未解锁 → 徽标灰显(missing {station} 形状)', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  globalThis.canCraft = () => ({ok: false, missing: [{station: 'table'}]});
  let panel;
  try {
    panel = mkCraftPanel({doc, inv, recipes: [
      {id: 'pick_wood', out: {item: 'pick_wood', n: 1}, cost: {planks: 3, stick: 2}, station: 'table'},
    ], onCraft() {}});
    panel.show();
    const card = collect(panel.root, 'mkp-card')[0];
    assert.ok(card._cls.has('dim'));
    assert.ok(card.innerHTML.includes('mkp-badge lack')); // 🛠️ 徽标灰
    panel.remove();
  } finally {
    globalThis.canCraft = defaultCanCraft;
  }
});

/* ============ T10 单击合成 ============ */

test('craft 面板: 单击亮卡 → craft + onCraft({item,n,leftover}) + 刷新; 灰卡不动包', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const outs = [];
  craftOk = true; craftN = 0;
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft(out) {
    outs.push(out);
  }});
  panel.show();
  let card = collect(panel.root, 'mkp-card')[0];
  card._ev.pointerdown({preventDefault() {}});
  card._ev.pointerup(); // 短按 = 单击合成
  assert.strictEqual(craftN, 1);
  assert.deepStrictEqual(outs, [{item: 'planks', n: 4, leftover: 0}]);
  craftOk = false; // 转缺料
  panel.refresh();
  card = collect(panel.root, 'mkp-card')[0];
  assert.ok(card._cls.has('dim'));
  card._ev.pointerdown({preventDefault() {}});
  card._ev.pointerup(); // 灰卡点击 → 不执行
  assert.strictEqual(craftN, 1);
  assert.strictEqual(outs.length, 1);
  panel.remove();
});

/* ============ T10 长按连做(0.4s 进入 · 0.3s/发 · 松开/材料尽停) ============ */

test('craft 面板: 短按 0.4s 内松开=单击一发; 长按进入连做 0.3s/发, 松开停', (t) => {
  t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  craftOk = true; craftN = 0;
  const panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
  panel.show();
  let card = collect(panel.root, 'mkp-card')[0];
  card._ev.pointerdown({preventDefault() {}});
  t.mock.timers.tick(399); // 不足 0.4s: 不合成
  assert.strictEqual(craftN, 0);
  card._ev.pointerup(); // 短按松开 → 单击一发
  assert.strictEqual(craftN, 1);

  card = collect(panel.root, 'mkp-card')[0]; // refresh 已重建卡片, 重新取
  card._ev.pointerdown({preventDefault() {}});
  t.mock.timers.tick(400); // 0.4s → 连做启动: 立即一发
  assert.strictEqual(craftN, 2);
  t.mock.timers.tick(300);
  assert.strictEqual(craftN, 3);
  t.mock.timers.tick(600); // 两发
  assert.strictEqual(craftN, 5);
  card._ev.pointerup(); // 松开 → 停
  t.mock.timers.tick(1200);
  assert.strictEqual(craftN, 5);
  panel.remove();
});

test('craft 面板: 连做中材料尽 → 自动停', (t) => {
  t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  craftN = 0;
  globalThis.canCraft = () => (craftN < 2 ? {ok: true, missing: []} :
    {ok: false, missing: [{id: 'log', need: 1, have: 0}]}); // 两发后缺料
  let panel;
  try {
    panel = mkCraftPanel({doc, inv, recipes: [R_PLANKS], onCraft() {}});
    panel.show();
    const card = collect(panel.root, 'mkp-card')[0];
    card._ev.pointerdown({preventDefault() {}});
    t.mock.timers.tick(400); // 连做启动(第 1 发)
    t.mock.timers.tick(300); // 第 2 发
    assert.strictEqual(craftN, 2);
    t.mock.timers.tick(300); // 第 3 发预检缺料 → 停
    assert.strictEqual(craftN, 2);
    t.mock.timers.tick(900); // 不再连发
    assert.strictEqual(craftN, 2);
    card._ev.pointerup();
    panel.remove();
  } finally {
    globalThis.canCraft = defaultCanCraft;
  }
});

/* ============ T10 分类页签(图标式: 全部/工具/食物/方块) ============ */

test('craft 面板: 页签过滤 — 工具/食物/方块各归其页, 材料只在全部', () => {
  const doc = mkDoc();
  const inv = {slots: new Array(27).fill(null)};
  const recipes = [
    R_PLANKS, // planks(block) → 方块页
    {id: 'pick_wood', out: {item: 'pick_wood', n: 1}, cost: {planks: 3, stick: 2}, station: 'table'}, // 工具
    {id: 'apple_hand', out: {item: 'apple', n: 1}, cost: {planks: 1}, station: 'hand'}, // 食物
    {id: 'stick', out: {item: 'stick', n: 4}, cost: {planks: 2}, station: 'hand'}, // 材料: 仅全部
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

test('物品提示: 背包格点击读被点物品; 灰卡单击 → 不合成且提示代替静默', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const doc = mkDoc();
  const inv = {slots: [...Array(9).fill(null), {id: 'planks', n: 12}, ...Array(17).fill(null)]};
  globalThis.hintForItem = (id) => (id === 'planks' ?
      {name: '木板', desc: '原木锯成的板子', tts: '木板，原木锯成的板子'} :
      (id === 'pick_wood' ? {name: '木镐', desc: '能挖石头的木头镐', tts: '木镐，能挖石头的木头镐'} : null));
  craftOk = false; /* 转缺料: 配方卡全灰 */
  craftN = 0;
  try {
    const panel = mkCraftPanel({doc, inv, recipes: [
      R_PLANKS, {id: 'pick_wood', out: {item: 'pick_wood', n: 1}, cost: {planks: 3, stick: 2}, station: 'hand'},
    ], onCraft() {}});
    panel.show();
    collect(panel.root, 'mkp-cell')[0].onclick(); /* 槽 9 起手: 读木板 */
    let bubble = collect(doc.body, 'hint-bubble')[0];
    assert.ok(String(bubble.innerHTML).includes('原木锯成的板子'), '背包格点击出提示');
    const card = collect(panel.root, 'mkp-card')[1]; /* 木镐卡(灰) */
    card._ev.pointerdown({preventDefault() {}});
    card._ev.pointerup(); /* 灰卡单击: 不执行合成 + 读产物提示 */
    assert.strictEqual(craftN, 0, '灰卡不动包');
    bubble = collect(doc.body, 'hint-bubble')[0];
    assert.ok(String(bubble.innerHTML).includes('木镐'), '灰卡点击读产物提示(名字)');
    assert.ok(String(bubble.innerHTML).includes('能挖石头的木头镐'), '灰卡点击读产物提示(说明)');
    panel.remove();
  } finally {
    globalThis.hintForItem = () => null;
    craftOk = true;
  }
});

/* mkHpBar 断言已随件迁 test/combat-kit.test.js(C6-T3) */
