'use strict';
/* 掉落物实体库 (js/drops.js) 单测 — node --test (零依赖)
   运行: node --test test/drops.test.js
   加载器: 同一 vm context 依次执行 config.js + items-core.js + held-item.js + drops.js —
   精确镜像浏览器 <script defer> 的共享词法环境(drops.js 顶层纯函数段零 THREE 零 DOM,
   壳段 THREE/DOM 惰性创建, 无桩时 spawn 不建 Sprite、实体逻辑照跑, 见其文件头)。
   groundTop 以平地桩注入(恒 11, 与 test/mobs.test.js 同口径 → 悬浮线 = 12.35)。
   本文件另承担三张注册表的交叉断言(工单 T7 核心价值, 防改表漏改注册):
   MOB_DROPS/BLOCKS.drop 引用的物品 id ⊆ ITEMS · ITEMS 工具(除 shears)⊆ HeldItems.defs ·
   MOB_DROPS 键 ⊆ MOB_TYPES。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDrops(extra) {
  const ctx = vm.createContext(Object.assign({console, groundTop: () => 11}, extra));
  for (const f of ['config.js', 'items-core.js', 'held-item.js', 'drops.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  vm.runInContext('globalThis.__d = {Drops, rollDrops, rollBlockDrop, pickupCheck, resolveIcon,' +
      ' ITEMS, MOB_DROPS, MOB_TYPES, BLOCKS, HeldItems};', ctx);
  return ctx.__d;
}

/* 顺序掷骰桩: 依次吐出给定序列(种子化断言依赖「rolls 先保底后加成、再 rare」的取数顺序) */
const seqRand = (seq) => () => seq.shift();

/* ============ 加载: 共享词法环境的顶层接口 ============ */

test('加载: 顶层暴露四个纯函数 + Drops 壳(spawn/update/render/clear/list/onCollect)', () => {
  const h = loadDrops();
  ['rollDrops', 'rollBlockDrop', 'pickupCheck', 'resolveIcon'].forEach(
      (f) => assert.strictEqual(typeof h[f], 'function', f));
  ['spawn', 'update', 'render', 'clear', 'list', 'onCollect',
    'rollDrops', 'rollBlockDrop', 'pickupCheck', 'resolveIcon'].forEach(
      (f) => assert.strictEqual(typeof h.Drops[f], 'function', 'Drops.' + f));
});

test('加载: drops.js 不定义全局 iconOf(T8 的 icons.js 将提供, 引擎只消费不收口)', () => {
  const ctx = vm.createContext({console, groundTop: () => 11});
  for (const f of ['config.js', 'items-core.js', 'drops.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, {filename: f});
  }
  assert.strictEqual(vm.runInContext('typeof iconOf', ctx), 'undefined');
});

/* ============ rollDrops: MOB_DROPS 掷骰(保底必得 · 50% 加成 · rare 独立) ============ */

/* 掷骰结果断言用宽松 deepEqual: 对象/数组产自 vm context, deepStrictEqual 会因
   跨 realm 原型不同而误判(test/blocks-fields.test.js 先例) */
const eq = assert.deepEqual;

test('rollDrops 保底必得: 加成与稀有全不中时仍有保底 1(儿童配平的底线)', () => {
  const h = loadDrops();
  eq(h.rollDrops('zombie', seqRand([0.99, 0.99])),
      [{id: 'rotten_flesh', n: 1}]);
  eq(h.rollDrops('skeleton', seqRand([0.99])), [{id: 'bone', n: 1}]);
  eq(h.rollDrops('slime', seqRand([0.5])),
      [{id: 'slimeball', n: 1}], '加成掷边界: rand 恰 0.5 不算中(< 0.5 才加成)');
});

test('rollDrops 50% 加成掷: 掷中 +1 · rand=0 必中 · 五怪全表掷骰形状', () => {
  const h = loadDrops();
  eq(h.rollDrops('zombie', seqRand([0.4, 0.99])),
      [{id: 'rotten_flesh', n: 2}], '加成掷中一次 → 保底 1 + 1');
  eq(h.rollDrops('creeper', seqRand([0.0])),
      [{id: 'gunpowder', n: 2}], 'rand=0 是加成掷的下界(必中)');
  eq(h.rollDrops('spider', seqRand([0.9])), [{id: 'string', n: 1}]);
  eq(h.rollDrops('slime', seqRand([0.3])), [{id: 'slimeball', n: 2}]);
});

test('rollDrops rare 独立掷骰: 与加成掷互不相干(两个方向都验)', () => {
  const h = loadDrops();
  eq(h.rollDrops('zombie', seqRand([0.9, 0.04])),
      [{id: 'rotten_flesh', n: 1}, {id: 'iron_ingot', n: 1}],
      '加成不中但稀有中(0.04 < 0.05) → 额外铁锭 1');
  eq(h.rollDrops('zombie', seqRand([0.4, 0.05])),
      [{id: 'rotten_flesh', n: 2}],
      '加成中但稀有不中(0.05 不小于 0.05) → 无铁锭');
});

test('rollDrops 未注册怪种返回空数组(掉落表未收录 = 不掉落, 不抛错)', () => {
  const {rollDrops} = loadDrops();
  eq(rollDrops('golem', seqRand([])), []);
  eq(rollDrops('no_such_mob', seqRand([])), []);
});

test('rollDrops F4 农场四怪: 牛/羊双条目按序掷, 猪/鸡单肉+副产物(设计稿 §4.5)', () => {
  const h = loadDrops();
  /* 牛: 生牛肉保底+加成中, 皮革保底不中加成 */
  eq(h.rollDrops('cow', seqRand([0.3, 0.9])),
      [{id: 'raw_beef', n: 2}, {id: 'leather', n: 1}], '牛肉 1+1 · 皮革保底 1');
  /* 羊: 羊毛与生羊肉双保底, 加成全不中 */
  eq(h.rollDrops('sheep', seqRand([0.9, 0.9])),
      [{id: 'wool', n: 1}, {id: 'raw_mutton', n: 1}]);
  /* 猪/鸡: 单条肉 + 副产物(鸡) */
  eq(h.rollDrops('pig', seqRand([0.9])), [{id: 'raw_porkchop', n: 1}]);
  eq(h.rollDrops('chicken', seqRand([0.1, 0.1])),
      [{id: 'raw_chicken', n: 2}, {id: 'feather', n: 2}], '双条目各保底 1+加成 1');
});

/* ============ rollBlockDrop: BLOCKS.drop 三元组(保底 + 概率额外 +1) ============ */

test('rollBlockDrop 保底: 概率 0 的条组(rand=0 下界也不加成) · 黏土一次掉 4', () => {
  const h = loadDrops();
  eq(h.rollBlockDrop(h.BLOCKS[3], seqRand([0.0])),
      [{id: 'cobble', n: 1}], '石头: 概率 0 → rand=0 也不加成');
  eq(h.rollBlockDrop(h.BLOCKS[49], seqRand([0.0])),
      [{id: 'clay_ball', n: 4}], '黏土: 保底 4 一次到位');
});

test('rollBlockDrop 概率边界: 草丛保底 0 — 恰 0.5 不掉 · 0.49 掉 1 个种子', () => {
  const h = loadDrops();
  const tuft = h.BLOCKS[40];
  eq(h.rollBlockDrop(tuft, seqRand([0.5])), [],
      '保底 0 + 概率不中 → 空手(条目不出现)');
  eq(h.rollBlockDrop(tuft, seqRand([0.49])), [{id: 'wheat_seeds', n: 1}]);
});

test('rollBlockDrop 多条目混合: 树叶三件各自独立掷(无保底) · 熟麦 1 小麦 + 1~2 种子', () => {
  const h = loadDrops();
  eq(h.rollBlockDrop(h.BLOCKS[7], seqRand([0.11, 0.11, 0.11])),
      [{id: 'sapling', n: 1}],
      '只有树苗掷中(0.11<0.12), 苹果/木棍未中且无保底(设计稿 D7 口径)');
  eq(h.rollBlockDrop(h.BLOCKS[7], seqRand([0.03, 0.03, 0.05])),
      [{id: 'sapling', n: 1}, {id: 'apple', n: 1}, {id: 'stick', n: 1}],
      '三件全中: 各 1 个');
  eq(h.rollBlockDrop(h.BLOCKS[45], seqRand([0.9, 0.49])),
      [{id: 'wheat', n: 1}, {id: 'wheat_seeds', n: 2}]);
});

test('rollBlockDrop 无掉落字段/空表 → 空数组(创造专属方块与防错网)', () => {
  const h = loadDrops();
  eq(h.rollBlockDrop(h.BLOCKS[10], seqRand([])), []);
  eq(h.rollBlockDrop({name: '裸定义'}, seqRand([])), []);
  eq(h.rollBlockDrop(null, seqRand([])), []);
});

test('rollBlockDrop 第三参: 剪刀 × shearDrop 掷专属表(D2) · 不传/非剪刀回落默认表', () => {
  const h = loadDrops();
  eq(h.rollBlockDrop(h.BLOCKS[7], seqRand([0.0]), {id: 'shears'}),
      [{id: 'leaves', n: 1}],
      '剪刀剪树叶 → 掉树叶方块本身(专属表保底 1)');
  eq(h.rollBlockDrop(h.BLOCKS[7], seqRand([0.11, 0.11, 0.11]), {id: 'shovel_diamond'}),
      [{id: 'sapling', n: 1}],
      '非剪刀持具走默认概率表(爆炸/错工具同口径)');
  eq(h.rollBlockDrop(h.BLOCKS[7], seqRand([0.11, 0.11, 0.11])),
      [{id: 'sapling', n: 1}],
      '不传工具(TNT 爆炸路径) → 默认表');
  eq(h.rollBlockDrop(h.BLOCKS[3], seqRand([0.0]), {id: 'shears'}),
      [{id: 'cobble', n: 1}],
      '无 shearDrop 的方块持剪刀 → 照默认表');
  eq(h.rollBlockDrop(null, seqRand([]), {id: 'shears'}), [], '裸定义/null 持剪刀也不炸');
});

/* ============ pickupCheck: 2.5 格真空吸附 / 0.6 格收集(三维距离) ============ */

test('pickupCheck 距离边界: 恰 0.6 收集 · 0.6+ 吸附 · 恰 2.5 吸附 · 2.5+ 不理睬', () => {
  const {pickupCheck} = loadDrops();
  const at = (x, y, z) => ({x, y, z});
  const origin = at(0, 0, 0);
  assert.strictEqual(pickupCheck(origin, at(0.6, 0, 0)), 'collect', '<=0.6 收集(含等号)');
  assert.strictEqual(pickupCheck(origin, at(0, 0.6, 0)), 'collect', 'y 轴同样计入三维距离');
  assert.strictEqual(pickupCheck(origin, at(0.61, 0, 0)), 'attract');
  assert.strictEqual(pickupCheck(origin, at(2.5, 0, 0)), 'attract', '<=2.5 吸附(含等号)');
  assert.strictEqual(pickupCheck(origin, at(0, 2.4, 0.7)), 'attract', '斜向三维距离 hypot(2.4,0.7)=2.5');
  assert.strictEqual(pickupCheck(origin, at(2.51, 0, 0)), 'far');
  assert.strictEqual(pickupCheck(origin, at(0, 3, 0)), 'far', '脚下隔着 3 格高差也吸不到');
});

/* ============ resolveIcon: 图标出口延迟绑定(iconOf 可选, emoji 兜底) ============ */

test('resolveIcon: 无全局 iconOf 时读 ITEMS.icon 兜底 · 未注册物品给 ❓', () => {
  const {resolveIcon} = loadDrops();
  eq(resolveIcon('coal'), {emoji: '⚫'});
  eq(resolveIcon('no_such_item'), {emoji: '❓'});
});

test('resolveIcon: 运行时存在全局 iconOf(T8)则优先, 返回像素图 dataURL', () => {
  const h = loadDrops({iconOf: (id) => 'data:image/png;base64,' + id});
  eq(h.resolveIcon('coal'), {url: 'data:image/png;base64,coal'});
});

/* ============ 壳段: 实体生命周期(vm 无 THREE/DOM, 纯实体逻辑直测) ============ */

test('壳: spawn 入队并返回实体引用 · 无 THREE/DOM 环境不建 Sprite 也不炸', () => {
  const {Drops} = loadDrops();
  Drops.clear();
  const e = Drops.spawn('coal', 2, 10, 16, 10);
  assert.strictEqual(Drops.list().length, 1);
  assert.strictEqual(Drops.list()[0], e, '返回实体即内部引用(list 只读约定)');
  assert.strictEqual(e.id, 'coal');
  assert.strictEqual(e.n, 2);
  assert.strictEqual(e.sprite, null, '无 THREE/DOM 时不建 Sprite');
  assert.strictEqual(e.gone, false);
  Drops.clear();
});

test('壳: 落地弹跳恰一次 → 贴地悬浮(y 在悬浮线上下摆动)', () => {
  const {Drops} = loadDrops();
  Drops.clear();
  const e = Drops.spawn('bone', 1, 10, 16, 10);
  let bounceFrames = 0; let settled = false;
  for (let i = 0; i < 240 && !settled; i++) {
    Drops.update(1 / 30, null);
    if (Math.abs(e.y - 12.35) < 1e-9 && e.vy > 0) bounceFrames++; // 触地瞬间被弹起
    if (e.grounded) settled = true;
  }
  for (let i = 0; i < 30; i++) Drops.update(1 / 30, null); // 静置后再观察 1 秒
  assert.ok(settled, '应已触地静止');
  assert.strictEqual(bounceFrames, 1, '落地弹跳恰一次');
  assert.ok(e.grounded && e.bounced);
  assert.ok(Math.abs(e.y - 12.35) <= 0.06 + 1e-9, '悬浮在 12.35 附近 ±0.06 摆动, 实际 ' + e.y);
  assert.strictEqual(e.vy, 0, '静止后垂直速度归零');
  Drops.clear();
});

test('壳: 2.5 格真空吸附加速飞向玩家 · 玩家走远后停止并复位吸附速度', () => {
  const {Drops} = loadDrops();
  Drops.clear();
  const e = Drops.spawn('coal', 1, 10, 16, 10);
  for (let i = 0; i < 240; i++) Drops.update(1 / 30, null); // 先落地静置(出生散布会挪动落点)
  // 玩家摆在实际落点旁 2.4 格(吸附圈内、收集圈外) — 断言不依赖随机散布
  const player = {x: e.x, y: e.y, z: e.z + 2.4};
  const dist = () => Math.hypot(e.x - player.x, e.y - player.y, e.z - player.z);
  const d0 = dist();
  for (let i = 0; i < 3; i++) Drops.update(1 / 30, player);
  const d1 = dist();
  assert.ok(d1 < d0, '吸附中距离递减(' + d0.toFixed(3) + ' → ' + d1.toFixed(3) + ')');
  assert.ok(e.pullV > 0, '吸附速度在累积(加速飞向玩家)');
  player.z = e.z + 40; // 玩家走远
  const xLeft = e.x;
  for (let i = 0; i < 5; i++) Drops.update(1 / 30, player);
  assert.strictEqual(e.x, xLeft, '出圈后水平位置不再变化');
  assert.strictEqual(e.pullV, 0, '出圈后吸附速度复位');
  Drops.clear();
});

test('壳: 0.6 格收集 — onCollect(itemId, n) 恰一次 · 多回调都收到 · 实体离场', () => {
  const {Drops} = loadDrops();
  Drops.clear();
  let gotA = null; let gotB = null;
  Drops.onCollect((id, n) => {
    gotA = [id, n];
  });
  Drops.onCollect((id, n) => {
    gotB = [id, n];
  });
  const e = Drops.spawn('iron_ingot', 2, 10, 16, 10);
  for (let i = 0; i < 240; i++) Drops.update(1 / 30, null); // 落地静置
  Drops.update(1 / 30, {x: e.x, y: e.y, z: e.z}); // 玩家踩在掉落物上
  Drops.update(1 / 30, {x: e.x, y: e.y, z: e.z}); // 再喂一帧确认不重复
  assert.deepStrictEqual(gotA, ['iron_ingot', 2]);
  assert.deepStrictEqual(gotB, ['iron_ingot', 2]);
  assert.strictEqual(Drops.list().length, 0, '收集后实体离场');
  Drops.clear();
});

test('壳: 回调返回 false = 拒收(背包满) — 掉落物停在地上, 冷却结束后再试', () => {
  const {Drops} = loadDrops();
  Drops.clear();
  let calls = 0; let accept = false;
  Drops.onCollect((id, n) => {
    calls++; return accept;
  });
  const e = Drops.spawn('gunpowder', 1, 10, 16, 10);
  for (let i = 0; i < 240; i++) Drops.update(1 / 30, null);
  const on = {x: e.x, y: e.y, z: e.z};
  Drops.update(1 / 30, on);
  assert.strictEqual(calls, 1, '触发过一次拒收');
  assert.strictEqual(Drops.list().length, 1, '拒收后掉落物留在场上');
  assert.ok(e.rejectT > 0, '进入拒收冷却');
  for (let i = 0; i < 30; i++) Drops.update(1 / 30, on); // 冷却 1.2s 内不吸附不收集
  assert.strictEqual(calls, 1, '冷却期内不再重试');
  accept = true;
  for (let i = 0; i < 30; i++) Drops.update(1 / 30, on); // 冷却结束 → 重试收集
  assert.strictEqual(calls, 2, '冷却结束重试');
  assert.strictEqual(Drops.list().length, 0, '这次收下了');
  Drops.clear();
});

test('壳: 3 分钟到期静默消失(不触发收集回调)', () => {
  const {Drops} = loadDrops();
  Drops.clear();
  let calls = 0;
  Drops.onCollect(() => {
    calls++;
  });
  Drops.spawn('string', 1, 10, 16, 10);
  // 玩家在场但远在吸附圈外(3 格+): 验证的是「不收集也会到期」, 而非玩家不在场
  for (let i = 0; i < 1806; i++) Drops.update(0.1, {x: 20, y: 12, z: 20}); // 180.6s
  assert.strictEqual(Drops.list().length, 0, '超时实体消失');
  assert.strictEqual(calls, 0, '到期消失不是收集');
  Drops.clear();
});

test('壳: clear 清空实体并解除收集回调(与 Mobs.clear 同口径, 切模式不残留闭包)', () => {
  const {Drops} = loadDrops();
  Drops.clear();
  let calls = 0;
  Drops.onCollect(() => {
    calls++;
  });
  const e = Drops.spawn('slimeball', 1, 10, 16, 10);
  Drops.clear();
  assert.strictEqual(Drops.list().length, 0);
  Drops.update(1 / 30, {x: e.x, y: e.y, z: e.z});
  assert.strictEqual(calls, 0, 'clear 后回调已解除');
});

/* ============ 交叉断言(工单核心价值): 三张注册表互查 ============ */

test('交叉: MOB_DROPS 与 BLOCKS.drop 引用的全部物品 id ⊆ ITEMS(防改表漏改注册)', () => {
  const h = loadDrops();
  const missing = [];
  for (const [type, tbl] of Object.entries(h.MOB_DROPS)) {
    for (const entry of (tbl.rolls || [])) {
      if (!h.ITEMS[entry[0]]) missing.push('MOB_DROPS.' + type + '.rolls → ' + entry[0]);
    }
    for (const entry of (tbl.rare || [])) {
      if (!h.ITEMS[entry[0]]) missing.push('MOB_DROPS.' + type + '.rare → ' + entry[0]);
    }
  }
  for (const [bid, def] of Object.entries(h.BLOCKS)) {
    for (const entry of (def.drop || [])) {
      if (!h.ITEMS[entry[0]]) missing.push('BLOCKS[' + bid + '].drop → ' + entry[0]);
    }
  }
  assert.deepStrictEqual(missing, [], '掉落表引用了未注册物品: ' + missing.join(', '));
});

test('交叉: ITEMS 工具 id(除 shears)⊆ HeldItems.defs(Avatar.setItem 直用)', () => {
  const h = loadDrops();
  /* 豁免口径(工单备注): shears 无手持观感属预期 — 豁免集只收 shears,
     若日后给剪刀补了观感, 本断言自动收紧无需改动 */
  const exempt = new Set(['shears']);
  const kinds = new Set(['pick', 'axe', 'sword', 'shovel', 'hoe']);
  const missing = Object.entries(h.ITEMS)
      .filter(([id, it]) => it.tool && kinds.has(it.tool.kind) && !exempt.has(id))
      .map(([id]) => id)
      .filter((id) => !h.HeldItems.defs[id]);
  assert.deepStrictEqual(missing, [], '工具物品缺手持物 def: ' + missing.join(', '));
});

test('交叉: MOB_DROPS 键 ⊆ MOB_TYPES(掉落表引用的怪种必须真实存在)', () => {
  const h = loadDrops();
  for (const k of Object.keys(h.MOB_DROPS)) {
    assert.ok(h.MOB_TYPES[k], 'MOB_TYPES 应注册 ' + k);
  }
});
