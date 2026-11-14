'use strict';
/* 城镇交互核心 (js/town-interact-core.js) 可执行规格 — node --test (零依赖)
   运行: node --test test/town-interact-core.test.js
   T-MAP-04 红测(票: docs/town-architecture-design.md §11 T-MAP-04「交互锚点
   与轻任务状态钩子(无 UI 细化)」; 规格: docs/town-map-design.md §4/§6.2 M8;
   A-01 协议输入: docs/design/town-ui-hud-prebuild.md §2.6 草案 + 5 歧义;
   B 侧输入: docs/design/town-ui-dialog-prebuild.md §2.4/§9 歧义销号)。
   只测票文要的外显行为, 全走公共 seam:
   ① 协议常量域: 事件名表(town-ui/target/focus|update · town-ui/interact/
      focus|blur)、交互对象四类、会话种类五值(N4 销号)——全冻结防漂移;
   ② 注册面: TOWN_INTERACTS 交互锚点清单(M8 默认: 六锚点条目+三轻任务)
      + townInteractRegistry 派生快照(锚点坐标单源 TOWN_MAP.anchors,
      taskRef 恒派生自 id, 错误两档: 未知锚/野 kind 拼写域抛错);
   ③ 目标形状: townTargetOf 产出 A 侧消费最小面恰六键(hud-prebuild §2.6
      townTarget 草案定稿——id 继承锚 id 空间, 偏离草案拼写见回执);
   ④ 状态钩子: mkTownTargets 小机器 focus/found/reset——事件经返回值
      events + emit 注入双面暴露(本仓无事件总线, 载体定稿); 状态域只有
      active|done 两值, 无失败/无倒计时/无墙钟(零惩罚可离开红线);
   ⑤ 模式接线: index.html 第四 script(序: map-core < assembly-core <
      interact-core < town < main) + town.js 的 townInteractBoot 注册启动
      (init 全链追加, 不触引擎缝) + townTargets 模式态可查。
   装具: 经典脚本共享词法环境现实还原(town-mode.test.js 先例), vm 里按
   加载序装载; 引擎缝只留记录桩——交互核心零 THREE 零 DOM 零墙钟, 沙盒
   不提供这些符号, 装载即证明。红期 town-interact-core.js 缺席: core 段
   全红(装载断言), 模式接线段红(town.js 尚无 townInteractBoot)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 装具: 注册/机器测试共用(vm 共享词法环境还原) ----------
   条件装载 js/town-interact-core.js: 红期缺席时 core 段红(装载断言即红),
   绿后全绿。T-SEAM-05: js/modes/town.js 模式壳退场——壳四桩(mkMode/
   loadScene/requestLock/ModeKit.spawn 记录)与 ⑤ 接线段随壳撤, 消费端断言
   由 test/adventure-mode.test.js T-SEAM-04 宿主测试接管。 */
function interactBoot(extra) {
  const rec = {events: [], builds: []};
  const sandbox = Object.assign({
    console: {log() {}, warn() {}, error() {}},
  }, extra || {});
  const ctx = vm.createContext(sandbox);
  /* 引擎件真实装载惯例保留(core 零引擎依赖零消费——纯件装载面不动,
     extra 数据注入经同一沙盒) */
  const files = ['js/config.js', 'js/voxel.js', 'js/scene-kit.js', 'js/prefab-kit.js',
    'js/town-map-core.js', 'js/town-assembly-core.js'];
  if (fs.existsSync(path.join(ROOT, 'js/town-interact-core.js'))) {
    files.push('js/town-interact-core.js');
  }
  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotThrow(() => vm.runInContext(code, ctx, {filename: f}),
        '脚本应可加载: ' + f + '(缺文件/顶层炸错在此暴露)');
  }
  return {ctx, rec};
}

const probe = (ctx, expr) => vm.runInContext(expr, ctx);

/* ============================================================
   ① 协议常量域(A-01/B 侧销号定稿, 冻结防漂移)
   ============================================================ */

test('协议: 事件名表恰四键且冻结 — target/focus·update + interact/focus·blur', () => {
  const {ctx} = interactBoot();
  assert.strictEqual(probe(ctx, 'typeof TOWN_UI_EVENTS'), 'object',
      '缺 TOWN_UI_EVENTS 事件名表(A-01 事件协议唯一权威)');
  const ev = JSON.parse(probe(ctx, 'JSON.stringify(TOWN_UI_EVENTS)'));
  assert.deepStrictEqual(Object.keys(ev).sort(),
      ['interactBlur', 'interactFocus', 'targetFocus', 'targetUpdate'],
      '事件名表恰四键(dialog-spec §2 接口表 + dialog-prebuild §2.4 草案定稿)');
  assert.strictEqual(ev.targetFocus, 'town-ui/target/focus', '目标切换事件名(§2.6 草案)');
  assert.strictEqual(ev.targetUpdate, 'town-ui/target/update', '目标状态事件名(active→done 驱动 L1)');
  assert.strictEqual(ev.interactFocus, 'town-ui/interact/focus', '焦点命中事件名(dialog-spec §2 行 1)');
  assert.strictEqual(ev.interactBlur, 'town-ui/interact/blur', '焦点移开事件名(dialog-prebuild §2.4)');
  assert.strictEqual(probe(ctx, 'Object.isFrozen(TOWN_UI_EVENTS)'), true,
      '事件名表冻结(协议常数不可被运行时改写)');
});

test('协议: 交互对象四类冻结 — landmark|npc|prop|task(hud-spec §6.1 分类)', () => {
  const {ctx} = interactBoot();
  assert.strictEqual(probe(ctx, 'typeof TOWN_INTERACT_KINDS'), 'object',
      '缺 TOWN_INTERACT_KINDS 交互对象类型域');
  const kinds = [...probe(ctx, 'TOWN_INTERACT_KINDS')];
  assert.deepStrictEqual(kinds.sort(), ['landmark', 'npc', 'prop', 'task'],
      '四类恰为 hud-spec §6.1 分类(NPC/任务物品/地标导览/观察点)');
  assert.strictEqual(probe(ctx, 'Object.isFrozen(TOWN_INTERACT_KINDS)'), true, '类型域冻结');
});

test('协议: 会话种类五值冻结 — greet|tour|seek|help|care(B 侧 N4 销号定稿)', () => {
  const {ctx} = interactBoot();
  assert.strictEqual(probe(ctx, 'typeof TOWN_SESSION_KINDS'), 'object',
      '缺 TOWN_SESSION_KINDS 会话种类域(dialog-prebuild §2.4 枚举收编)');
  const kinds = [...probe(ctx, 'TOWN_SESSION_KINDS')];
  assert.deepStrictEqual(kinds.sort(), ['care', 'greet', 'help', 'seek', 'tour'],
      '五值恰为 B 侧枚举定稿(care=B7 铁傀儡关怀, 保留)');
  assert.strictEqual(probe(ctx, 'Object.isFrozen(TOWN_SESSION_KINDS)'), true, '会话域冻结');
});

/* ============================================================
   ② 注册面: 清单形状 + 派生快照(坐标单源/校验两档/零副作用)
   ============================================================ */

test('清单: TOWN_INTERACTS 每条形状合法 — id 唯一 · kind 在域 · task 条目 task: 前缀+sessionKind', () => {
  const {ctx} = interactBoot();
  const list = JSON.parse(probe(ctx, 'JSON.stringify(TOWN_INTERACTS)'));
  assert.ok(Array.isArray(list) && list.length > 0, '缺 TOWN_INTERACTS 交互锚点清单(注册无从谈起)');
  const ids = list.map((e) => e.id);
  assert.strictEqual(new Set(ids).size, ids.length, '条目 id 必须唯一(目标 id 空间无重名)');
  for (const e of list) {
    assert.ok(['landmark', 'npc', 'prop', 'task'].includes(e.kind),
        '条目「' + e.id + '」kind 越域(合法域 landmark|npc|prop|task)');
    assert.ok(typeof e.iconKey === 'string' && e.iconKey.length > 0,
        '条目「' + e.id + '」缺 iconKey(UI-01 marker 语义键, A 侧图标资产唯一寻址)');
    assert.ok(typeof e.label === 'string' && e.label.length >= 1 && e.label.length <= 6,
        '条目「' + e.id + '」label 须 1-6 字(hud-prebuild §2.6 短标签口径)');
    assert.ok(typeof e.anchorId === 'string' && e.anchorId.length > 0,
        '条目「' + e.id + '」缺 anchorId(锚点引用显式, 坐标单源 TOWN_MAP.anchors)');
    if (e.kind === 'task') {
      assert.ok(e.id.startsWith('task:'),
          'task 条目「' + e.id + '」id 须 task: 前缀(A-01-5: 任务与目标同一 id 空间的命名约定)');
      assert.ok(['greet', 'tour', 'seek', 'help', 'care'].includes(e.sessionKind),
          'task 条目「' + e.id + '」sessionKind 越域(B 侧 open payload 数据源)');
    }
    if (e.kind === 'npc') {
      assert.ok(['greet', 'tour', 'seek', 'help', 'care'].includes(e.sessionKind),
          'npc 条目「' + e.id + '」必带 sessionKind(B 侧 click-npc 分路依据)');
    }
    if (e.kind !== 'task') {
      assert.strictEqual(e.taskRef, undefined,
          '非 task 条目「' + e.id + '」不带 taskRef(taskRef 只属任务, 派生面单源)');
    }
  }
});

test('清单: M8 默认覆盖 — 六锚点条目在册 · 三轻任务 · spawn 不在册(出生点非交互点)', () => {
  const {ctx} = interactBoot();
  const ids = [...probe(ctx, 'TOWN_INTERACTS.map((e) => e.id)')];
  /* M8 默认(map-design §8#8: 广场导览 + 2-3 个观察-寻找-回应轻任务);
     锚点条目 id 恒等锚 id(定稿: 目标 id 继承 TOWN_MAP.anchors 空间) */
  for (const anchorId of ['bell-tower', 'lava-chicken', 'windmill', 'farm', 'market', 'stash']) {
    assert.ok(ids.includes(anchorId), '缺锚点条目「' + anchorId + '」(§4.2 可交互地标/道具全在册)');
  }
  const taskIds = ids.filter((id) => id.startsWith('task:'));
  assert.ok(taskIds.length >= 2 && taskIds.length <= 3,
      '轻任务 2-3 条(M8 默认区间), 实得 ' + taskIds.length + ': ' + taskIds.join(','));
  assert.ok(!ids.includes('spawn'), 'spawn 不在册(出生锚非交互点, 注册面不收)');
  /* 地标/prop 条目 id 恒等 anchorId(锚 id 空间继承不变式) */
  const nonTask = JSON.parse(probe(ctx,
      'JSON.stringify(TOWN_INTERACTS.filter((e) => e.kind !== \'task\'))'));
  for (const e of nonTask) {
    assert.strictEqual(e.id, e.anchorId,
        '非 task 条目「' + e.id + '」id 恒等 anchorId(目标 id=锚 id 空间, 零第二命名规则)');
  }
});

test('派生: townInteractRegistry 快照 — 坐标单源锚点 · taskRef 恒派生 · 确定性 · 零副作用', () => {
  const {ctx} = interactBoot();
  assert.strictEqual(probe(ctx, 'typeof townInteractRegistry'), 'function',
      '缺 townInteractRegistry 注册派生函数');
  const reg = JSON.parse(probe(ctx, 'JSON.stringify(townInteractRegistry())'));
  const anchors = JSON.parse(probe(ctx, 'JSON.stringify(TOWN_MAP.anchors)'));
  const byId = {};
  for (const a of anchors) byId[a.id] = a;
  const entries = JSON.parse(probe(ctx, 'JSON.stringify(TOWN_INTERACTS)'));
  assert.strictEqual(reg.length, entries.length, '快照条目数=清单条目数(无增删)');
  for (let i = 0; i < entries.length; i++) {
    const src = entries[i];
    const out = reg[i];
    assert.strictEqual(out.id, src.id, '快照保源序(条目 ' + i + ')');
    const a = byId[src.anchorId];
    assert.ok(a, '条目「' + src.id + '」锚点在册(装具自检)');
    assert.deepStrictEqual(out.anchor, {x: a.x, y: a.y, z: a.z},
        '条目「' + src.id + '」anchor 坐标=锚点坐标(布局权威单源, 注册面不自定坐标)');
    if (src.kind === 'task') {
      assert.strictEqual(out.taskRef, src.id,
          'task 条目「' + src.id + '」快照补 taskRef 恒=id(B 侧 open/close payload 透传键)');
    } else {
      assert.strictEqual(out.taskRef, undefined,
          '非 task 条目「' + src.id + '」快照无 taskRef');
    }
    assert.strictEqual(out.state, 'active', '条目「' + src.id + '」快照初始 state=active');
  }
  /* 确定性: 同参同输出(两次调用深度相等) */
  const again = JSON.parse(probe(ctx, 'JSON.stringify(townInteractRegistry())'));
  assert.deepStrictEqual(again, reg, 'registry 两次调用深度相等(纯派生同参同输出)');
  /* 零副作用: 源清单与布局权威不被改写 */
  const beforeList = probe(ctx, 'JSON.stringify(TOWN_INTERACTS)');
  const beforeMap = probe(ctx, 'JSON.stringify(TOWN_MAP)');
  probe(ctx, 'townInteractRegistry()');
  assert.strictEqual(probe(ctx, 'JSON.stringify(TOWN_INTERACTS)'), beforeList,
      'registry 消费零副作用(TOWN_INTERACTS 不被改写)');
  assert.strictEqual(probe(ctx, 'JSON.stringify(TOWN_MAP)'), beforeMap,
      'registry 消费零副作用(TOWN_MAP 不被改写)');
});

test('派生: 错误两档 — 未知锚点/野 kind 拼写域抛错(可注入清单可测)', () => {
  const {ctx} = interactBoot({
    /* 坏清单经沙盒注入(vm 变量), 不拼内联字面量(lint quotes/indent 友好) */
    __badAnchor: [{id: 'task:x', anchorId: 'no-such-anchor', kind: 'task',
      iconKey: 'find', label: '测试', sessionKind: 'seek'}],
    __badKind: [{id: 'weird', anchorId: 'bell-tower', kind: 'castle',
      iconKey: 'belltower', label: '怪'}],
    __badSession: [{id: 'task:y', anchorId: 'bell-tower', kind: 'task',
      iconKey: 'find', label: '测', sessionKind: 'party'}],
  });
  assert.throws(() => probe(ctx, 'townInteractRegistry(__badAnchor)'),
      /no-such-anchor/, '未知 anchorId 须抛(布局契约破坏即炸, 错误两档拼写域)');
  assert.throws(() => probe(ctx, 'townInteractRegistry(__badKind)'),
      /castle/, '野 kind 须抛(合法域 landmark|npc|prop|task)');
  assert.throws(() => probe(ctx, 'townInteractRegistry(__badSession)'),
      /party/, 'task 条目野 sessionKind 须抛(合法域五值, N4 销号域)');
});

test('派生: 注入清单生效(与全局清单解耦的纯函数形态)', () => {
  const {ctx} = interactBoot({
    __one: [{id: 'bell-tower', anchorId: 'bell-tower', kind: 'landmark',
      iconKey: 'belltower', label: '钟塔'}],
  });
  const n = probe(ctx, 'townInteractRegistry(__one).length');
  assert.strictEqual(n, 1, '注入单条清单 → 快照恰一条(清单参数化, 机器/校验共用此缝)');
});

/* ============================================================
   ③ 目标形状: townTargetOf(A 侧消费最小面, hud-prebuild §2.6 定稿)
   ============================================================ */

test('形状: townTargetOf 产出恰六键 {id,kind,iconKey,label,anchor,state} — state 缺省 active', () => {
  const {ctx} = interactBoot();
  assert.strictEqual(probe(ctx, 'typeof townTargetOf'), 'function', '缺 townTargetOf 目标形状函数');
  const t = JSON.parse(probe(ctx,
      'JSON.stringify(townTargetOf(TOWN_INTERACTS.find((e) => e.id === \'bell-tower\'), ' +
      'townInteractRegistry().find((e) => e.id === \'bell-tower\')))'));
  assert.deepStrictEqual(Object.keys(t).sort(),
      ['anchor', 'iconKey', 'id', 'kind', 'label', 'state'],
      'townTarget 恰六键(A 草案最小面: 不多不少, 多余字段即协议泄漏)');
  assert.strictEqual(t.id, 'bell-tower', 'id=锚 id(定稿: 继承 TOWN_MAP.anchors 空间)');
  assert.strictEqual(t.kind, 'landmark', 'kind 透传');
  assert.strictEqual(t.iconKey, 'belltower', 'iconKey=UI-01 marker 语义键(资产寻址, 与 id 分工)');
  assert.strictEqual(t.label, '钟塔', 'label 短标签透传');
  assert.deepStrictEqual(t.anchor, {x: 79, y: 24, z: 76},
      'anchor=钟塔锚点坐标(独立字面量, 防同义反复)');
  assert.strictEqual(t.state, 'active', '快照态透传(初始 active)');
  /* done 态透传: 机器置 done 后形状携带完成态(A 侧 L1 完成显示数据源) */
  const t2 = JSON.parse(probe(ctx,
      'JSON.stringify(townTargetOf(TOWN_INTERACTS[0], Object.assign({}, ' +
      'townInteractRegistry()[0], {state: \'done\'})))'));
  assert.strictEqual(t2.state, 'done', 'state 注入透传(done 由机器写入, 形状函数只读)');
});

/* ============================================================
   ④ 状态钩子: mkTownTargets(轻任务状态机, 零惩罚红线)
   ============================================================ */

test('机器: mkTownTargets 构造面 — snapshot 初始全 active · focusId null · 无墙钟依赖', () => {
  const {ctx} = interactBoot();
  assert.strictEqual(probe(ctx, 'typeof mkTownTargets'), 'function', '缺 mkTownTargets 机器工厂');
  probe(ctx, 'var __emitted = []; var m = mkTownTargets({emit: (n, p) => __emitted.push(n)});');
  const snap = JSON.parse(probe(ctx, 'JSON.stringify(m.snapshot())'));
  assert.strictEqual(snap.focusId, null, '初始无活动目标(U5 回落语义的初始态)');
  const states = snap.states;
  const ids = [...probe(ctx, 'TOWN_INTERACTS.map((e) => e.id)')];
  assert.deepStrictEqual(Object.keys(states).sort(), ids.sort(),
      'states 键=注册条目全集(每条目标都有状态位)');
  for (const id of Object.keys(states)) {
    assert.strictEqual(states[id], 'active', '初始状态恒 active(' + id + ')');
  }
  /* 无墙钟: 工厂入参面无 now/tick(签名面断言——零倒计时压迫的协议红线) */
  const src = fs.readFileSync(path.join(ROOT, 'js/town-interact-core.js'), 'utf8');
  assert.ok(!/mkTownTargets\s*\(\s*\{[^}]*now/.test(src),
      '机器工厂签名不含 now(零墙钟, 装配层才管节奏)');
});

test('机器: focus(id) 切换主目标 — 事件恰一条 focus · payload 携带完整 townTarget', () => {
  const {ctx} = interactBoot();
  probe(ctx, 'var __emitted = []; var m = mkTownTargets({emit: (n, p) => __emitted.push({n, p})});');
  const r = JSON.parse(probe(ctx, 'JSON.stringify(m.focus(\'bell-tower\'))'));
  assert.strictEqual(r.changed, true, 'focus 新目标 → changed');
  assert.strictEqual(r.events.length, 1, 'focus 恰发一条事件');
  assert.strictEqual(r.events[0].name, 'town-ui/target/focus', '事件名=协议表 targetFocus');
  assert.strictEqual(r.events[0].payload.target.id, 'bell-tower', 'payload.target=完整 townTarget');
  assert.strictEqual(r.events[0].payload.target.state, 'active', 'target.state 随事件透传');
  assert.strictEqual(probe(ctx, 'm.snapshot().focusId'), 'bell-tower', 'focusId 已切换');
  /* 旁路观察与返回值一致(emit 注入面) */
  const emitted = JSON.parse(probe(ctx, 'JSON.stringify(__emitted)'));
  assert.strictEqual(emitted.length, 1, 'emit 旁路恰一次(与 events 同步)');
  assert.strictEqual(emitted[0].n, 'town-ui/target/focus', 'emit 收到同名事件');
  assert.strictEqual(emitted[0].p.target.id, 'bell-tower', 'emit payload 同构');
});

test('机器: focus(null) 无目标信号 — payload.target=null(草案默认, 不设 clear 事件)', () => {
  const {ctx} = interactBoot();
  probe(ctx, 'var m = mkTownTargets({emit: () => {}}); m.focus(\'bell-tower\');');
  const r = JSON.parse(probe(ctx, 'JSON.stringify(m.focus(null))'));
  assert.strictEqual(r.changed, true, 'focus(null) 是显式状态迁移');
  assert.strictEqual(r.events.length, 1, '恰一条事件');
  assert.strictEqual(r.events[0].name, 'town-ui/target/focus', '仍走 focus 事件(A-01-4 定稿: 无 clear)');
  assert.strictEqual(r.events[0].payload.target, null, 'payload.target=null(U5 回落触发信号)');
  assert.strictEqual(probe(ctx, 'm.snapshot().focusId'), null, 'focusId 复位');
});

test('机器: focus 幂等与防火墙 — 重复同目标零事件 · 未知 id 抛拼写域错误', () => {
  const {ctx} = interactBoot();
  probe(ctx, 'var m = mkTownTargets({emit: () => {}}); m.focus(\'windmill\');');
  const r = JSON.parse(probe(ctx, 'JSON.stringify(m.focus(\'windmill\'))'));
  assert.strictEqual(r.changed, false, '重复 focus 同目标 → 不迁移');
  assert.deepStrictEqual(r.events, [], '重复 focus 零事件(不重复打扰 HUD)');
  assert.throws(() => probe(ctx, 'm.focus(\'no-such\')'), /no-such/,
      'focus 未知 id 须抛(注册表在册性, 拼写域错误先例)');
  /* null→null 幂等(初始态重复清空) */
  probe(ctx, 'var m2 = mkTownTargets({emit: () => {}});');
  const r2 = JSON.parse(probe(ctx, 'JSON.stringify(m2.focus(null))'));
  assert.strictEqual(r2.changed, false, 'null→null 不迁移(已是无目标)');
});

test('机器: found(id) 目标达成 — update 事件 {id, state done} · 任务与地标皆可达成', () => {
  const {ctx} = interactBoot();
  probe(ctx, 'var m = mkTownTargets({emit: () => {}}); m.focus(\'task:find-bread\');');
  const r = JSON.parse(probe(ctx, 'JSON.stringify(m.found(\'task:find-bread\'))'));
  assert.strictEqual(r.changed, true, 'found 未完成目标 → 迁移');
  assert.strictEqual(r.events.length, 1, 'found 恰发一条事件');
  assert.strictEqual(r.events[0].name, 'town-ui/target/update', '事件名=协议表 targetUpdate');
  assert.deepStrictEqual(r.events[0].payload, {id: 'task:find-bread', state: 'done'},
      'update payload 恰 {id, state}(hud-prebuild §2.6: active→done 驱动 L1 step-done)');
  const snap = JSON.parse(probe(ctx, 'JSON.stringify(m.snapshot())'));
  assert.strictEqual(snap.states['task:find-bread'], 'done', '状态已置 done');
  /* 地标导览同样可达成(观察导览完成也是正向一步, 不限 task 类) */
  const r2 = JSON.parse(probe(ctx, 'JSON.stringify(m.found(\'bell-tower\'))'));
  assert.strictEqual(r2.changed, true, '地标 found 也合法(§6.2 观察导览锚点)');
  assert.strictEqual(JSON.parse(probe(ctx, 'JSON.stringify(m.snapshot())')).states['bell-tower'],
      'done', '地标状态置 done');
});

test('机器: found 幂等零惩罚 — 已 done 再 found 不迁移零事件 · 不回退不扣账', () => {
  const {ctx} = interactBoot();
  probe(ctx, 'var m = mkTownTargets({emit: () => {}}); m.found(\'task:find-bread\');');
  const r = JSON.parse(probe(ctx, 'JSON.stringify(m.found(\'task:find-bread\'))'));
  assert.strictEqual(r.changed, false, '已 done 再 found → 不迁移(不重复表扬)');
  assert.deepStrictEqual(r.events, [], '已 done 再 found 零事件');
  assert.throws(() => probe(ctx, 'm.found(\'no-such\')'), /no-such/,
      'found 未知 id 须抛(与 focus 同款防火墙)');
});

test('机器: 状态域红线 — 任意序列后值域 ⊆ {active, done}, 无失败态字段', () => {
  const {ctx} = interactBoot();
  probe(ctx,
      'var m = mkTownTargets({emit: () => {}});' +
      'm.focus(\'bell-tower\'); m.found(\'bell-tower\'); m.found(\'task:find-bread\');' +
      'm.focus(null); m.focus(\'task:visit-stash\'); m.focus(null);');
  const states = JSON.parse(probe(ctx, 'JSON.stringify(m.snapshot().states)'));
  const legal = new Set(['active', 'done']);
  for (const [id, st] of Object.entries(states)) {
    assert.ok(legal.has(st), '状态值越域: ' + id + '=' + st + '(零惩罚: 无 failed/missed/locked)');
  }
  /* 协议面无失败语义常量: 源文件不出现失败态字面量 */
  const src = fs.readFileSync(path.join(ROOT, 'js/town-interact-core.js'), 'utf8');
  assert.ok(!/['"](?:failed|missed|locked|timeout)['"]/.test(src),
      '交互核心源无失败态字面量(零惩罚协议红线)');
});

test('机器: reset 重来 — 全量回 active · focus 清空 · 零事件(装配层显式重放)', () => {
  const {ctx} = interactBoot();
  probe(ctx, 'var m = mkTownTargets({emit: () => {}}); m.focus(\'bell-tower\');' +
      'm.found(\'bell-tower\'); m.found(\'task:find-bread\');');
  const r = JSON.parse(probe(ctx, 'JSON.stringify(m.reset())'));
  assert.strictEqual(r.changed, true, 'reset 有迁移');
  assert.deepStrictEqual(r.events, [], 'reset 不发事件(重放 focus 是装配层显式动作)');
  const snap = JSON.parse(probe(ctx, 'JSON.stringify(m.snapshot())'));
  assert.strictEqual(snap.focusId, null, 'reset 清空主目标');
  for (const [id, st] of Object.entries(snap.states)) {
    assert.strictEqual(st, 'active', 'reset 后 ' + id + ' 回 active(零惩罚可重来)');
  }
});

test('机器: focus 已 done 目标合法 — target.state=done 透传(完成态回看)', () => {
  const {ctx} = interactBoot();
  probe(ctx, 'var m = mkTownTargets({emit: () => {}}); m.found(\'stash\'); m.focus(\'stash\');');
  const r = JSON.parse(probe(ctx, 'JSON.stringify(m.focus(\'stash\'))'));
  assert.strictEqual(r.changed, true, 'focus 已 done 目标合法(回看完成目标)');
  assert.strictEqual(r.events[0].payload.target.state, 'done',
      '事件携带 done 态(A 侧显示完成标的数据源)');
});

test('机器: 确定性与零突变 — 同序列同事件轨迹 · snapshot 拷贝隔离 · 源清单只读', () => {
  const {ctx} = interactBoot();
  const seq = 'm.focus(\'bell-tower\'); m.found(\'bell-tower\'); m.focus(\'task:find-bread\');';
  probe(ctx, 'var __emittedA = []; var a = mkTownTargets({emit: (n, p) => __emittedA.push(n)});' +
      'var m = a;' + seq);
  probe(ctx, 'var __emittedB = []; var b = mkTownTargets({emit: (n, p) => __emittedB.push(n)});' +
      'var m = b;' + seq);
  assert.deepStrictEqual([...probe(ctx, '__emittedB')], [...probe(ctx, '__emittedA')],
      '同序列 → 同事件轨迹(纯逻辑确定性)');
  assert.strictEqual(probe(ctx, 'JSON.stringify(a.snapshot())'),
      probe(ctx, 'JSON.stringify(b.snapshot())'), '同序列 → 同终态');
  /* snapshot 拷贝隔离: 改返回不反渗机器 */
  probe(ctx, 'var s1 = a.snapshot(); s1.states[\'bell-tower\'] = \'active\'; s1.focusId = \'x\';');
  assert.strictEqual(probe(ctx, 'a.snapshot().states[\'bell-tower\']'), 'done',
      'snapshot 返回拷贝(外部改写不反渗)');
  assert.strictEqual(probe(ctx, 'a.snapshot().focusId'), 'task:find-bread',
      'snapshot focusId 拷贝隔离(seq 末步 focus 真值不被 s1 改写反渗)');
  probe(ctx, 'a.focus(\'windmill\'); var s2 = a.snapshot(); s2.focusId = \'tampered\';');
  assert.strictEqual(probe(ctx, 'a.snapshot().focusId'), 'windmill', 'focusId 拷贝隔离复验');
  /* 源清单只读: 机器全操作后 TOWN_INTERACTS 深度不变 */
  const before = probe(ctx, 'JSON.stringify(TOWN_INTERACTS)');
  probe(ctx, 'a.found(\'windmill\'); a.reset();');
  assert.strictEqual(probe(ctx, 'JSON.stringify(TOWN_INTERACTS)'), before,
      '机器消费零副作用(注册清单只读)');
});

/* ============================================================
   ⑥ 术语: GLOSSARY 词条(跨模块消费, 收录判据 §1.8-1)
   ============================================================ */

test('术语: GLOSSARY 收录「城镇交互核心(TownInteractCore)」词条', () => {
  const g = fs.readFileSync(path.join(ROOT, 'GLOSSARY.md'), 'utf8');
  assert.ok(g.includes('TownInteractCore'),
      'GLOSSARY 缺 TownInteractCore 词条(core+mode 两文件消费, 收录判据 1)');
});
